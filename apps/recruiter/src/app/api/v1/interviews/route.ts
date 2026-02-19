import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { validateApiKey, getAgencyClientIds } from '../auth';
import { handleCorsOptions, withCors } from '../cors';
import { toPhilippinesTime, formatInPhilippinesTime, PH_TIMEZONE } from '@/lib/timezone';
import { createDailyRoom, createMeetingToken, generateRoomName } from '@/lib/daily';
import { webhookInterviewScheduled, webhookInterviewCompleted } from '@/lib/webhooks/events';

/**
 * OPTIONS - CORS preflight
 */
export async function OPTIONS(request: NextRequest) {
  return handleCorsOptions(request);
}

/**
 * GET /api/v1/interviews
 * List interviews for agency's jobs
 * 
 * TIER: Pro+
 */
export async function GET(request: NextRequest) {
  const auth = await validateApiKey(request);
  if ('error' in auth) {
    return withCors(NextResponse.json({ error: auth.error }, { status: auth.status }), request);
  }

  const tier = await getAgencyTier(auth.agency_id);
  if (tier === 'free') {
    return withCors(NextResponse.json({
      error: 'Interview management requires Pro plan',
    }, { status: 403 }));
  }

  const { searchParams } = new URL(request.url);
  const status = searchParams.get('status');
  const clientId = searchParams.get('clientId'); // Filter by specific client
  const limit = Math.min(parseInt(searchParams.get('limit') || '50'), 100);
  const offset = parseInt(searchParams.get('offset') || '0');

  try {
    // Get agency's clients (or specific client if filtered)
    let clientIds: string[];
    if (clientId) {
      const allClientIds = await getAgencyClientIds(auth.agency_id);
      if (!allClientIds.includes(clientId)) {
        return withCors(NextResponse.json({ error: 'Client not found' }, { status: 404 }), request);
      }
      clientIds = [clientId];
    } else {
      clientIds = await getAgencyClientIds(auth.agency_id);
    }

    if (clientIds.length === 0) {
      return withCors(NextResponse.json({ interviews: [], total: 0 }), request);
    }

    // Get jobs
    const { data: jobs } = await supabaseAdmin
      .from('jobs')
      .select('id, title')
      .in('agency_client_id', clientIds);

    const jobIds = jobs?.map(j => j.id) || [];
    const jobMap = Object.fromEntries((jobs || []).map(j => [j.id, j.title]));

    if (jobIds.length === 0) {
      return withCors(NextResponse.json({ interviews: [], total: 0 }), request);
    }

    // Get applications
    const { data: applications } = await supabaseAdmin
      .from('job_applications')
      .select('id, job_id, candidate_id')
      .in('job_id', jobIds);

    const appIds = applications?.map(a => a.id) || [];
    const appMap = Object.fromEntries((applications || []).map(a => [a.id, a]));

    if (appIds.length === 0) {
      return withCors(NextResponse.json({ interviews: [], total: 0 }), request);
    }

    // Get interviews
    let query = supabaseAdmin
      .from('job_interviews')
      .select('*', { count: 'exact' })
      .in('application_id', appIds)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (status) query = query.eq('status', status);

    const { data: interviews, count, error } = await query;

    if (error) {
      return withCors(NextResponse.json({ error: 'Failed to fetch interviews' }, { status: 500 }), request);
    }

    // If there's an associated Daily room, clients need a tokenized URL to join private rooms.
    const interviewIds = (interviews || []).map((i: any) => i.id);
    const { data: rooms } = await supabaseAdmin
      .from('video_call_rooms')
      .select('interview_id, daily_room_name, daily_room_url')
      .in('interview_id', interviewIds.length > 0 ? interviewIds : ['none']);
    const roomByInterviewId = new Map((rooms || []).map((r: any) => [r.interview_id, r]));

    // Get candidate details
    const candidateIds = [...new Set(applications?.map(a => a.candidate_id) || [])];
    const { data: candidates } = await supabaseAdmin
      .from('candidates')
      .select('id, first_name, last_name, email')
      .in('id', candidateIds.length > 0 ? candidateIds : ['none']);

    const candidateMap = Object.fromEntries(
      (candidates || []).map(c => [c.id, { name: `${c.first_name} ${c.last_name}`.trim(), email: c.email }])
    );

    const formattedInterviews = await Promise.all((interviews || []).map(async (i: any) => {
      const app = appMap[i.application_id];
      const room = roomByInterviewId.get(i.id);

      // Calculate formatted times if not stored
      let clientTime = i.scheduled_at_client_local;
      let phTime = i.scheduled_at_ph;

      if (i.scheduled_at && !phTime) {
        phTime = formatInPhilippinesTime(i.scheduled_at) + ' (PHT)';
      }
      if (i.scheduled_at && !clientTime) {
        const tz = i.client_timezone || 'UTC';
        clientTime = new Date(i.scheduled_at).toLocaleString('en-US', {
          timeZone: tz,
          year: 'numeric',
          month: 'short',
          day: 'numeric',
          hour: '2-digit',
          minute: '2-digit',
          hour12: true,
        }) + ` (${tz.split('/').pop()?.replace('_', ' ') || tz})`;
      }

      const isClientInterview = typeof i.interview_type === 'string' && i.interview_type.startsWith('client_');
      let clientJoinUrl: string | null = null;
      let clientJoinToken: string | null = null;
      if (isClientInterview && room?.daily_room_name && room?.daily_room_url) {
        try {
          const token = await createMeetingToken({
            roomName: room.daily_room_name,
            userId: undefined,
            userName: 'Client',
            isOwner: false,
            enableRecording: false,
            enableScreenShare: true,
          });
          clientJoinToken = token;
          clientJoinUrl = `${room.daily_room_url}?t=${token}`;
        } catch (e) {
          console.error('Failed to create client join token for interview', i.id, e);
        }
      }

      return {
        ...i, // Return ALL database fields
        // Also include formatted/camelCase versions for backward compatibility
        application_id: i.application_id,
        interviewType: i.interview_type,
        scheduledAt: i.scheduled_at, // UTC
        clientTime,
        clientTimezone: i.client_timezone || 'UTC',
        phTime,
        durationMinutes: i.duration_minutes,
        // For client_* interviews, meetingLink is tokenized so ShoreAgents can join private rooms.
        meetingLink: clientJoinUrl || i.meeting_link,
        clientJoinUrl,
        clientJoinToken,
        interviewerId: i.interviewer_id,
        interviewerNotes: i.interviewer_notes,
        startedAt: i.started_at,
        endedAt: i.ended_at,
        created_at: i.created_at,
        updated_at: i.updated_at,
        // Additional context
        job_title: app ? jobMap[app.job_id] : 'Unknown',
        candidate: app ? candidateMap[app.candidate_id] : null,
      };
    }));

    return withCors(NextResponse.json({
      interviews: formattedInterviews,
      total: count || 0,
      limit,
      offset,
    }), request);

  } catch (error) {
    console.error('API v1 interviews error:', error);
    return withCors(NextResponse.json({ error: 'Internal server error' }, { status: 500 }), request);
  }
}

/**
 * POST /api/v1/interviews
 * Schedule an interview
 * 
 * Body:
 *   application_id: string (required)
 *   type: Interview type - RECRUITER: 'recruiter_prescreen' | 'recruiter_round_1' | 'recruiter_round_2' | 'recruiter_round_3' | 'recruiter_offer'
 *                         CLIENT: 'client_round_1' | 'client_round_2' | 'client_final'
 *   scheduledAt?: string (ISO date) - Stored in UTC
 *   clientTimezone?: string (e.g., 'America/New_York') - Client's timezone for display
 *   notes?: string
 */
export async function POST(request: NextRequest) {
  const auth = await validateApiKey(request);
  if ('error' in auth) {
    return withCors(NextResponse.json({ error: auth.error }, { status: auth.status }), request);
  }

  const tier = await getAgencyTier(auth.agency_id);
  if (tier === 'free') {
    return withCors(NextResponse.json({
      error: 'Interview management requires Pro plan',
    }, { status: 403 }));
  }

  try {
    const body = await request.json();
    const {
      application_id,
      type = 'recruiter_prescreen',
      scheduledAt,
      clientTimezone,
      notes,
      enableVideo = true,  // Auto-create Daily.co room
      enableRecording = true,
      enableTranscription = true,
      // Optional: allow API clients (ShoreAgents) to attribute host correctly
      recruiterUserId,
      recruiterName,
    } = body;

    // Validate interview type
    const validTypes = [
      'recruiter_prescreen', 'recruiter_round_1', 'recruiter_round_2', 'recruiter_round_3', 'recruiter_offer', 'recruiter_general',
      'client_round_1', 'client_round_2', 'client_final', 'client_general',
    ];
    if (!validTypes.includes(type)) {
      return withCors(NextResponse.json({
        error: `Invalid interview type. Valid types: ${validTypes.join(', ')}`,
      }, { status: 400 }));
    }

    // Process scheduled time - store UTC, client local, and PH formatted times
    let scheduledAtUTC: string | null = null;
    let scheduledAtClientLocal: string | null = null;
    let scheduledAtPHFormatted: string | null = null;
    const timezone = clientTimezone || 'UTC';

    if (scheduledAt) {
      // Keep the original as UTC (TIMESTAMPTZ handles this)
      scheduledAtUTC = new Date(scheduledAt).toISOString();

      // Format for client's timezone display
      scheduledAtClientLocal = new Date(scheduledAt).toLocaleString('en-US', {
        timeZone: timezone,
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        hour12: true,
      }) + ` (${timezone.split('/').pop()?.replace('_', ' ') || timezone})`;

      // Format for PH timezone display
      scheduledAtPHFormatted = formatInPhilippinesTime(scheduledAt) + ' (PHT)';

      console.log(`📅 [Interview] Time breakdown:`);
      console.log(`   UTC: ${scheduledAtUTC}`);
      console.log(`   Client (${timezone}): ${scheduledAtClientLocal}`);
      console.log(`   PH Time: ${scheduledAtPHFormatted}`);
    }

    if (!application_id) {
      return withCors(NextResponse.json({ error: 'application_id is required' }, { status: 400 }));
    }

    // Verify application belongs to agency
    const clientIds = await getAgencyClientIds(auth.agency_id);
    const { data: jobs } = await supabaseAdmin
      .from('jobs')
      .select('id')
      .in('agency_client_id', clientIds);

    const jobIds = jobs?.map(j => j.id) || [];

    const { data: app } = await supabaseAdmin
      .from('job_applications')
      .select('id, job_id, candidate_id')
      .eq('id', application_id)
      .in('job_id', jobIds)
      .single();

    if (!app) {
      return withCors(NextResponse.json({ error: 'Application not found' }, { status: 404 }), request);
    }

    // Create interview with timezone info
    // scheduled_at = UTC (source of truth)
    // client_timezone = client's timezone for reference
    // scheduled_at_client_local = formatted string for client display
    // scheduled_at_ph = formatted string for PH display
    const insertData: Record<string, any> = {
      application_id: application_id,
      interview_type: type,
      status: 'scheduled',
      scheduled_at: scheduledAtUTC || null, // UTC (TIMESTAMPTZ)
      interviewer_notes: notes || null,
    };

    // Add timezone columns if they exist (migration may not be applied yet)
    // We try with all columns first, then fallback if columns don't exist
    const fullInsertData = {
      ...insertData,
      client_timezone: timezone,
      scheduled_at_client_local: scheduledAtClientLocal,
      scheduled_at_ph: scheduledAtPHFormatted,
    };

    let interview: any = null;
    let error: any = null;

    // Try full insert first
    const result1 = await supabaseAdmin
      .from('job_interviews')
      .insert(fullInsertData)
      .select()
      .single();

    if (result1.error) {
      // Fallback to basic insert if timezone columns don't exist yet
      console.log('⚠️ [Interview] Full insert failed, trying basic insert:', result1.error.message);
      const result2 = await supabaseAdmin
        .from('job_interviews')
        .insert(insertData)
        .select()
        .single();
      interview = result2.data;
      error = result2.error;
    } else {
      interview = result1.data;
      error = result1.error;
    }

    if (error) {
      return withCors(NextResponse.json({ error: 'Failed to create interview' }, { status: 500 }), request);
    }

    // Update application status
    await supabaseAdmin
      .from('job_applications')
      .update({ status: 'interview_scheduled' })
      .eq('id', application_id);

    // Create video room if enabled
    let videoRoom = null;
    let hostJoinUrl = null;
    let participantJoinUrl = null;
    let clientJoinUrl = null;
    let clientJoinToken = null;

    if (enableVideo) {
      try {
        // Get candidate info for display name
        const { data: candidate } = await supabaseAdmin
          .from('candidates')
          .select('id, first_name, last_name, email, user_id')
          .eq('id', app.candidate_id)
          .single();

        const displayName = candidate ? `${candidate.first_name} ${candidate.last_name}`.trim() : 'Candidate';
        const candidateAuthId = candidate?.id || null;

        const isClientInterview = typeof type === 'string' && type.startsWith('client_');

        // Create Daily.co room
        const roomName = generateRoomName('agency-interview');
        // IMPORTANT: client-scheduled interviews can be days in the future.
        // Do NOT set exp=now+3h or the room will expire before the interview happens.
        const nowSec = Math.floor(Date.now() / 1000);
        const minLifetimeSec = 7 * 24 * 60 * 60; // 7 days
        let expirationTimestamp = nowSec + minLifetimeSec;
        const scheduledMs =
          (scheduledAtUTC ? new Date(scheduledAtUTC).getTime() : NaN) ||
          (interview?.scheduled_at ? new Date(interview.scheduled_at as any).getTime() : NaN);
        if (Number.isFinite(scheduledMs)) {
          expirationTimestamp = Math.max(expirationTimestamp, Math.floor(scheduledMs / 1000) + (6 * 60 * 60)); // 6h after scheduled time
        }

        const dailyRoom = await createDailyRoom({
          name: roomName,
          privacy: 'private',
          properties: {
            exp: expirationTimestamp,
            max_participants: 10,
            enable_chat: true,
            enable_screenshare: true,
            enable_recording: enableRecording ? 'cloud' : undefined,
            // UX: recruiter "Start Now" should enter immediately (no extra Join screen).
            enable_prejoin_ui: false,
            enable_knocking: false,
            eject_at_room_exp: true,
          },
        });

        // Create meeting tokens
        // Prefer recruiter identity if provided so Daily shows a real name and join auth can work.
        const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
        const hasRecruiterUserId = typeof recruiterUserId === 'string' && UUID_REGEX.test(recruiterUserId);

        // For client_* interviews, we allow agency-hosted rooms so any recruiter in the agency can host.

        let hostUserName =
          typeof recruiterName === 'string' && recruiterName.trim().length > 0 ? recruiterName.trim() : '';

        if (!hostUserName && hasRecruiterUserId) {
          const { data: p } = await supabaseAdmin
            .from('user_profiles')
            .select('full_name, first_name, last_name')
            .eq('user_id', recruiterUserId)
            .maybeSingle();
          hostUserName =
            (p as any)?.full_name ||
            `${(p as any)?.first_name || ''} ${(p as any)?.last_name || ''}`.trim() ||
            '';
        }

        if (!hostUserName) {
          const { data: a } = await supabaseAdmin.from('agencies').select('name').eq('id', auth.agency_id).maybeSingle();
          hostUserName = (a as any)?.name || 'Host';
        }

        const hostDisplayName = hostUserName ? `${hostUserName} — Recruiter` : 'Recruiter';
        const candidateDisplayName = displayName ? `${displayName} — Candidate` : 'Candidate';

        const hostToken = await createMeetingToken({
          roomName,
          // If recruiterUserId is provided, embed it for nicer Daily attribution.
          // Otherwise this is an "agency-hosted" room; recruiters will join via BPOC and get their own token.
          userId: hasRecruiterUserId ? recruiterUserId : undefined,
          userName: hostDisplayName,
          isOwner: true,
          enableRecording,
          enableScreenShare: true,
        });

        const participantToken = await createMeetingToken({
          roomName,
          // IMPORTANT: candidate auth id is candidates.id (same id used in job_applications.candidate_id)
          userId: candidateAuthId || undefined,
          userName: candidateDisplayName,
          isOwner: false,
          enableRecording: false,
          enableScreenShare: true,
        });

        // Client token (for client_* interview joins via Daily JS/React: callObject.join({ url, token }))
        if (isClientInterview) {
          clientJoinToken = await createMeetingToken({
            roomName,
            userId: undefined,
            userName: 'Client — Client',
            isOwner: false,
            enableRecording: false,
            enableScreenShare: true,
          });
          clientJoinUrl = `${dailyRoom.url}?t=${clientJoinToken}`;
        }

        hostJoinUrl = `${dailyRoom.url}?t=${hostToken}`;
        participantJoinUrl = `${dailyRoom.url}?t=${participantToken}`;

        // Store video room in database
        const { data: roomData } = await supabaseAdmin
          .from('video_call_rooms')
          .insert({
            daily_room_name: roomName,
            daily_room_url: dailyRoom.url,
            daily_room_token: hostToken,
            // Agency-hosted by default: allows any recruiter in agency to host.
            // If recruiterUserId is provided we still keep host_user_id = agencyId (so any recruiter can host),
            // and we rely on participants tracking to record who actually hosted.
            host_user_id: auth.agency_id,
            // IMPORTANT: candidate auth id is candidates.id
            participant_user_id: candidateAuthId,
            job_id: app.job_id,
            application_id: application_id,
            interviewId: interview.id,
            status: 'created',
            enable_recording: enableRecording,
            enable_transcription: enableTranscription,
            call_type: type,
            scheduled_for: scheduledAtUTC || null,
            agencyId: auth.agency_id,
            // For client_* stages, sharing should be ON by default (formal stage).
            share_with_client: isClientInterview ? true : false,
            share_with_candidate: isClientInterview ? true : false,
          })
          .select()
          .single();

        videoRoom = roomData;

        // Update interview with video room reference
        await supabaseAdmin
          .from('job_interviews')
          .update({
            meeting_link: dailyRoom.url,
            // Store host and participant URLs if columns exist
          })
          .eq('id', interview.id);

        // Create invitation + participant rows (do not rely on Daily participant webhooks)
        if (videoRoom && candidate && candidateAuthId && participantJoinUrl) {
          try {
            const nowIso = new Date().toISOString();
            await supabaseAdmin
              .from('video_call_invitations')
              .insert({
                room_id: videoRoom.id,
                invitee_user_id: candidateAuthId,
                invitee_email: candidate.email || null,
                join_url: participantJoinUrl,
                status: 'pending',
                inviter_user_id: hasRecruiterUserId ? recruiterUserId : null,
                inviter_name: hostUserName,
                call_type: type,
                call_title: `Interview: ${displayName}`,
                created_at: nowIso,
                expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
                notification_sent: true,
                notification_sent_at: nowIso,
                notification_type: 'api',
              });

            // Participants table should reflect who was invited.
            const hostParticipant = {
              room_id: videoRoom.id,
              user_id: hasRecruiterUserId ? recruiterUserId : null,
              email: null,
              name: hostUserName || 'Recruiter',
              role: 'host',
              status: 'invited',
              invited_at: nowIso,
              updated_at: nowIso,
            };
            const candidateParticipant = {
              room_id: videoRoom.id,
              user_id: candidateAuthId,
              email: candidate.email || null,
              name: displayName || 'Candidate',
              role: 'candidate',
              status: 'invited',
              invited_at: nowIso,
              join_url: participantJoinUrl,
              daily_token: participantToken,
              updated_at: nowIso,
            };

            const up = await supabaseAdmin
              .from('video_call_participants')
              .upsert([hostParticipant, candidateParticipant], { onConflict: 'room_id,user_id' });
            if (up.error) console.warn('⚠️ [Interview] Participant upsert failed (non-fatal):', up.error.message);

            console.log(`📧 [Interview] Invitation + participants created for ${candidate.email}`);
          } catch (inviteError) {
            console.error('⚠️ [Interview] Failed to create invitation/participants:', inviteError);
            // Continue - invitation is not critical
          }
        }

        console.log(`📹 [Interview] Video room created: ${roomName}`);
      } catch (videoError) {
        console.error('⚠️ [Interview] Failed to create video room:', videoError);
        // Continue without video - interview still created successfully
      }
    }

    // Trigger webhook for interview scheduled
    if (scheduledAtUTC) {
      webhookInterviewScheduled({
        interviewId: interview.id,
        application_id: application_id,
        candidateId: app?.candidate_id,
        scheduledAt: scheduledAtUTC,
        interviewType: type,
        meetingLink: videoRoom?.daily_room_url || null,
        agencyId: auth.agency_id,
      }).catch(err => console.error('[Webhook] Interview scheduled error:', err));
    }

    return withCors(NextResponse.json({
      success: true,
      interview: {
        ...interview,
        scheduledAt: interview.scheduled_at,
        clientTime: interview.scheduled_at_client_local || scheduledAtClientLocal,
        clientTimezone: interview.client_timezone || timezone,
        phTime: interview.scheduled_at_ph || scheduledAtPHFormatted,
        // Video URLs
        hostJoinUrl,
        participantJoinUrl,
        clientJoinUrl,
        clientJoinToken,
        videoRoomId: videoRoom?.id || null,
      },
      // Also include at top level for easy access
      hostJoinUrl,
      participantJoinUrl,
      clientJoinUrl,
      clientJoinToken,
      videoRoom: videoRoom ? {
        id: videoRoom.id,
        roomUrl: videoRoom.daily_room_url,
        recordingEnabled: enableRecording,
        transcriptionEnabled: enableTranscription,
      } : null,
      message: scheduledAtUTC
        ? `Interview scheduled for ${scheduledAtPHFormatted} (Philippines) / ${scheduledAtClientLocal}`
        : 'Interview created without scheduled time',
    }, { status: 201 }), request);

  } catch (error) {
    console.error('API v1 interviews POST error:', error);
    return withCors(NextResponse.json({ error: 'Internal server error' }, { status: 500 }), request);
  }
}

/**
 * PATCH /api/v1/interviews
 * Update interview outcome, rating, and feedback
 * 
 * Body:
 *   interviewId: string (required)
 *   outcome?: 'passed' | 'failed' | 'pending_decision' | 'needs_followup'
 *   rating?: number (1-5 star rating)
 *   feedback?: object (structured feedback JSON)
 *   notes?: string
 * 
 * Feedback object example:
 * {
 *   "communication": 4,
 *   "technicalSkills": 5,
 *   "cultureFit": 4,
 *   "overallImpression": "Strong candidate with excellent skills",
 *   "strengths": ["Great communicator", "Problem solver"],
 *   "areasForImprovement": ["Could improve time management"]
 * }
 */
export async function PATCH(request: NextRequest) {
  const auth = await validateApiKey(request);
  if ('error' in auth) {
    return withCors(NextResponse.json({ error: auth.error }, { status: auth.status }), request);
  }

  const tier = await getAgencyTier(auth.agency_id);
  if (tier === 'free') {
    return withCors(NextResponse.json({
      error: 'Interview management requires Pro plan',
    }, { status: 403 }));
  }

  try {
    const body = await request.json();
    const { interviewId, outcome, rating, feedback, notes } = body;

    if (!interviewId) {
      return withCors(NextResponse.json({ error: 'interviewId is required' }, { status: 400 }));
    }

    // Validate rating if provided
    if (rating !== undefined && (rating < 1 || rating > 5)) {
      return withCors(NextResponse.json({ error: 'rating must be between 1 and 5' }, { status: 400 }));
    }

    // Build update data
    const updateData: Record<string, any> = {};

    if (outcome) {
      updateData.outcome = outcome;
      updateData.status = 'completed';
    }
    if (rating !== undefined) updateData.rating = rating;

    // Feedback can be string OR object - we normalize to JSONB
    if (feedback !== undefined) {
      if (typeof feedback === 'string') {
        // If string passed, wrap it in an object
        updateData.feedback = { text: feedback };
      } else {
        // If object passed, use as-is
        updateData.feedback = feedback;
      }
    }

    if (notes) updateData.interviewer_notes = notes;

    // Must have at least one field to update
    if (Object.keys(updateData).length === 0) {
      return withCors(NextResponse.json({
        error: 'At least one of outcome, rating, feedback, or notes is required'
      }, { status: 400 }));
    }

    const { data: updated, error } = await supabaseAdmin
      .from('job_interviews')
      .update(updateData)
      .eq('id', interviewId)
      .select('*, job_applications!inner(candidate_id, job_id)')
      .single();

    if (error) {
      console.error('Interview update error:', error);
      return withCors(NextResponse.json({ error: 'Failed to update interview' }, { status: 500 }), request);
    }

    // Trigger webhook for interview completion
    if (outcome && updated.status === 'completed' && updated.job_applications) {
      const application = Array.isArray(updated.job_applications)
        ? updated.job_applications[0]
        : updated.job_applications;

      webhookInterviewCompleted({
        interviewId: updated.id,
        application_id: updated.application_id,
        candidate_id: application.candidate_id,
        outcome: outcome,
        rating: rating || updated.rating,
        agencyId: auth.agency_id,
      }).catch(err => console.error('[Webhook] Interview completed error:', err));
    }

    return withCors(NextResponse.json({
      success: true,
      interview: {
        ...updated, // Return ALL fields
      }
    }), request);

  } catch (error) {
    console.error('API v1 interviews PATCH error:', error);
    return withCors(NextResponse.json({ error: 'Internal server error' }, { status: 500 }), request);
  }
}

async function getAgencyTier(agency_id: string): Promise<string> {
  const { data } = await supabaseAdmin
    .from('agencies')
    .select('api_tier')
    .eq('id', agency_id)
    .single();

  return data?.api_tier || 'free';
}

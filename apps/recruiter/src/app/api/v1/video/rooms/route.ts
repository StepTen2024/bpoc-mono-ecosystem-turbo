import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { validateApiKey, getAgencyClientIds } from '../../auth';
import { handleCorsOptions, withCors } from '../../cors';
import { createDailyRoom, createMeetingToken, generateRoomName } from '@/lib/daily';

/**
 * OPTIONS - CORS preflight
 */
export async function OPTIONS() {
  return handleCorsOptions();
}

/**
 * GET /api/v1/video/rooms
 * List video rooms for agency's calls
 * 
 * Query params:
 *   - callType: Filter by call type (screening, technical, client_intro, etc.)
 *   - interviewId: Filter by specific interview
 *   - application_id: Filter by application
 *   - status: Filter by room status (created, active, ended)
 *   - outcome: Filter by call outcome (successful, no_show, etc.)
 *   - from: Filter calls scheduled from this date (ISO)
 *   - to: Filter calls scheduled until this date (ISO)
 *   - limit: Max results (default 50, max 100)
 *   - offset: Pagination offset
 * 
 * TIER: Pro+ (Video features require Pro plan)
 */
export async function GET(request: NextRequest) {
  const auth = await validateApiKey(request);
  if ('error' in auth) {
    return withCors(NextResponse.json({ error: auth.error }, { status: auth.status }));
  }

  const tier = await getAgencyTier(auth.agency_id);
  if (tier === 'free') {
    return withCors(NextResponse.json({ 
      error: 'Video interview features require Pro plan. Upgrade at bpoc.app/pricing',
    }, { status: 403 }));
  }

  const { searchParams } = new URL(request.url);
  const callType = searchParams.get('callType');
  const interviewId = searchParams.get('interviewId');
  const application_id = searchParams.get('application_id');
  const status = searchParams.get('status');
  const outcome = searchParams.get('outcome');
  const clientId = searchParams.get('clientId'); // ShoreAgents: may be agency_clients.id OR agency_clients.company_id
  const clientName = searchParams.get('clientName') || searchParams.get('name'); // Optional display name
  const fromDate = searchParams.get('from');
  const toDate = searchParams.get('to');
  const limit = Math.min(parseInt(searchParams.get('limit') || '50'), 100);
  const offset = parseInt(searchParams.get('offset') || '0');

  try {
    // Get agency's client IDs to verify access
    const agencyClientIds = await getAgencyClientIds(auth.agency_id);
    
    if (agencyClientIds.length === 0) {
      return withCors(NextResponse.json({ rooms: [], total: 0 }));
    }

    // Optional: validate clientId if provided (supports either agency_clients.id or agency_clients.company_id)
    let resolvedAgencyClientIdForToken: string | null = null;
    if (clientId) {
      const { data: agencyClients } = await supabaseAdmin
        .from('agency_clients')
        .select('id, company_id')
        .eq('agency_id', auth.agency_id);

      const match = (agencyClients || []).find((c: any) => c.id === clientId || c.company_id === clientId);
      if (!match) {
        return withCors(NextResponse.json({ error: 'Client not found' }, { status: 404 }));
      }
      resolvedAgencyClientIdForToken = match.id;
    }

    // Get jobs for these clients
    const { data: jobs } = await supabaseAdmin
      .from('jobs')
      .select('id')
      .in('agency_client_id', agencyClientIds);

    const jobIds = jobs?.map(j => j.id) || [];

    if (jobIds.length === 0) {
      return withCors(NextResponse.json({ rooms: [], total: 0 }));
    }

    // Build query for video rooms linked to agency's jobs
    let query = supabaseAdmin
      .from('video_call_rooms')
      .select(`
        id,
        daily_room_name,
        daily_room_url,
        status,
        call_type,
        call_title,
        scheduled_for,
        outcome,
        notes,
        created_at,
        started_at,
        ended_at,
        duration_seconds,
        enable_recording,
        interview_id,
        application_id,
        job_id,
        agency_id
      `, { count: 'exact' })
      .in('job_id', jobIds)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    // Apply filters
    if (callType) query = query.eq('call_type', callType);
    if (interviewId) query = query.eq('interview_id', interviewId);
    if (application_id) query = query.eq('application_id', application_id);
    if (status) query = query.eq('status', status);
    if (outcome) query = query.eq('outcome', outcome);
    if (fromDate) query = query.gte('scheduled_for', fromDate);
    if (toDate) query = query.lte('scheduled_for', toDate);

    const { data: rooms, count, error } = await query;

    if (error) {
      console.error('API v1 video rooms GET error:', error);
      return withCors(NextResponse.json({ error: 'Failed to fetch video rooms' }, { status: 500 }));
    }

    // Add optional client join token details for private rooms.
    // ShoreAgents can join via Daily JS/React: callObject.join({ url: roomUrl, token: client.token })
    const formattedRooms = await Promise.all((rooms || []).map(async (room: any) => {
      let clientJoin: { joinUrl: string; token: string; name: string } | null = null;

      // Only generate tokens when the integration asked for a specific client context (clientId provided)
      // or is targeting a specific interviewId (common ShoreAgents join flow).
      const shouldGenerateClientToken = !!clientId || !!interviewId;
      if (shouldGenerateClientToken && room.daily_room_name && room.daily_room_url) {
        try {
          const token = await createMeetingToken({
            roomName: room.daily_room_name,
            userId: resolvedAgencyClientIdForToken || undefined,
            userName: typeof clientName === 'string' && clientName.trim().length > 0 ? clientName.trim() : 'Client',
            isOwner: false,
            enableRecording: false,
            enableScreenShare: true,
          });
          clientJoin = {
            joinUrl: `${room.daily_room_url}?t=${token}`,
            token,
            name: typeof clientName === 'string' && clientName.trim().length > 0 ? clientName.trim() : 'Client',
          };
        } catch (e) {
          console.error('Failed to create client join token for room', room.id, e);
        }
      }

      return {
        id: room.id,
        roomName: room.daily_room_name,
        roomUrl: room.daily_room_url, // raw URL (no token)
        status: room.status,
        callType: room.call_type || 'recruiter_general',
        title: room.call_title,
        scheduledFor: room.scheduled_for,
        outcome: room.outcome,
        notes: room.notes,
        interviewId: room.interview_id,
        application_id: room.application_id,
        job_id: room.job_id,
        recordingEnabled: room.enable_recording,
        duration: room.duration_seconds,
        created_at: room.created_at,
        startedAt: room.started_at,
        endedAt: room.ended_at,
        client: clientJoin,
      };
    }));

    return withCors(NextResponse.json({
      rooms: formattedRooms,
      total: count || 0,
      limit,
      offset,
    }));

  } catch (error) {
    console.error('API v1 video rooms error:', error);
    return withCors(NextResponse.json({ error: 'Internal server error' }, { status: 500 }));
  }
}

/**
 * POST /api/v1/video/rooms
 * Create a new video room for candidate calls
 * 
 * Body:
 *   application_id: string (required) - The application this call is for
 *   callType: string (required) - Type of call:
 *     RECRUITER-LED:
 *       - 'recruiter_prescreen' - Initial screening call
 *       - 'recruiter_round_1' - First BPOC interview
 *       - 'recruiter_round_2' - Second BPOC interview
 *       - 'recruiter_round_3' - Third interview (rare)
 *       - 'recruiter_offer' - Offer discussion
 *       - 'recruiter_general' - Ad-hoc recruiter call
 *     CLIENT-LED:
 *       - 'client_round_1' - First client interview
 *       - 'client_round_2' - Second client interview
 *       - 'client_final' - Final client interview
 *       - 'client_general' - Ad-hoc client call
 *   interview_id?: string - Link to existing job_interviews record
 *   candidate_name?: string - Display name for candidate
 *   title?: string - Custom title for the call (e.g., "Technical Interview with John")
 *   scheduledFor?: string - ISO date when call is scheduled (for reference)
 *   enableRecording?: boolean - Enable cloud recording (default: true)
 *   enableTranscription?: boolean - Auto-transcribe after call (default: true)
 *   expiresInHours?: number - Room expiration (default: 3 hours)
 * 
 * Returns:
 *   - Room URL and tokens for both host (agency) and participant (candidate)
 *   - Tokens are valid for 2 hours
 * 
 * TIER: Pro+ (Video features require Pro plan)
 */
export async function POST(request: NextRequest) {
  const auth = await validateApiKey(request);
  if ('error' in auth) {
    return withCors(NextResponse.json({ error: auth.error }, { status: auth.status }));
  }

  const tier = await getAgencyTier(auth.agency_id);
  if (tier === 'free') {
    return withCors(NextResponse.json({ 
      error: 'Video interview features require Pro plan. Upgrade at bpoc.app/pricing',
    }, { status: 403 }));
  }

  // Valid call types - RECRUITER & CLIENT led
  const validCallTypes = [
    // Recruiter-led
    'recruiter_prescreen', 'recruiter_round_1', 'recruiter_round_2', 'recruiter_round_3', 'recruiter_offer', 'recruiter_general',
    // Client-led
    'client_round_1', 'client_round_2', 'client_final', 'client_general',
    // Legacy (for backwards compatibility)
    'screening', 'technical', 'client_intro', 'offer_discussion', 'acceptance', 'onboarding', 'general',
  ];

  try {
    const body = await request.json();
    const { 
      application_id,
      callType = 'recruiter_general',
      interviewId,
      recruiterUserId,
      recruiterName,
      candidateName,
      title,
      scheduledFor,
      enableRecording = true,
      enableTranscription = true,
      expiresInHours = 3,
    } = body;

    // Validate call type
    if (!validCallTypes.includes(callType)) {
      return withCors(NextResponse.json({ 
        error: `Invalid callType. Must be one of: ${validCallTypes.join(', ')}`,
      }, { status: 400 }));
    }

    if (!application_id) {
      return withCors(NextResponse.json({ 
        error: 'application_id is required',
        hint: 'Provide the job application ID for this video interview',
      }, { status: 400 }));
    }

    // Verify application belongs to agency
    const clientIds = await getAgencyClientIds(auth.agency_id);
    const { data: jobs } = await supabaseAdmin
      .from('jobs')
      .select('id')
      .in('agency_client_id', clientIds);

    const jobIds = jobs?.map(j => j.id) || [];

    const { data: application } = await supabaseAdmin
      .from('job_applications')
      .select('id, job_id, candidate_id')
      .eq('id', application_id)
      .in('job_id', jobIds)
      .single();

    if (!application) {
      return withCors(NextResponse.json({ 
        error: 'Application not found',
        hint: 'Make sure the application_id belongs to one of your jobs',
      }, { status: 404 }));
    }

    // Get candidate info for display name
    const { data: candidate } = await supabaseAdmin
      .from('candidates')
      .select('id, first_name, last_name, email, user_id')
      .eq('id', application.candidate_id)
      .single();

    const displayName = candidateName || 
      (candidate ? `${candidate.first_name} ${candidate.last_name}`.trim() : 'Candidate');
    const candidateAuthId = candidate?.id || null;
    const isClientCall = typeof callType === 'string' && callType.startsWith('client_');

    // Create Daily.co room
    const roomName = generateRoomName('agency-interview');
    const nowSec = Math.floor(Date.now() / 1000);
    let expirationTimestamp = nowSec + (expiresInHours * 60 * 60);

    // IMPORTANT: scheduled/client calls may be in the future; keep the room alive long enough.
    if (isClientCall || scheduledFor) {
      expirationTimestamp = Math.max(expirationTimestamp, nowSec + (7 * 24 * 60 * 60)); // 7 days minimum
      const scheduledMs = scheduledFor ? new Date(scheduledFor).getTime() : NaN;
      if (Number.isFinite(scheduledMs)) {
        expirationTimestamp = Math.max(expirationTimestamp, Math.floor(scheduledMs / 1000) + (6 * 60 * 60));
      }
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
        // UX: for agency-hosted rooms, the recruiter should be able to "Start Now" without an extra Join screen.
        // Daily still prompts for camera/mic permissions as needed.
        enable_prejoin_ui: false,
        enable_knocking: false,
        eject_at_room_exp: true,
      },
    });

    // Create meeting tokens
    // Optional: if Agency Portal passes recruiterUserId (BPOC auth.users.id / agency_recruiters.user_id),
    // embed it in the token so Daily webhook participant events can attribute the host correctly.
    const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    const hasRecruiterUserId = typeof recruiterUserId === 'string' && UUID_REGEX.test(recruiterUserId);
    const hostUserId = hasRecruiterUserId ? recruiterUserId : auth.agency_id;

    // For client_* calls, we allow agency-hosted rooms so any recruiter in the agency can host.

    // Best-effort: resolve a human name for the recruiter host
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
      userId: hasRecruiterUserId ? recruiterUserId : undefined,
      userName: hostDisplayName,
      isOwner: true,
      enableRecording,
      enableScreenShare: true,
    });

    const participantToken = await createMeetingToken({
      roomName,
      // IMPORTANT: candidate auth id is candidates.id
      userId: candidateAuthId || undefined,
      userName: candidateDisplayName,
      isOwner: false,
      enableRecording: false, // Only host can control recording
      enableScreenShare: true,
    });

    // Generate call title if not provided
    const callTitle = title || `${callType.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase())} - ${displayName}`;

    // Store room in database
    const { data: videoRoom, error: insertError } = await supabaseAdmin
      .from('video_call_rooms')
      .insert({
        daily_room_name: roomName,
        daily_room_url: dailyRoom.url,
        daily_room_token: hostToken, // Store host token for later use
        // Agency-hosted by default: allows any recruiter in agency to host.
        host_user_id: auth.agency_id,
        participant_user_id: candidateAuthId,
        job_id: application.job_id,
        application_id: application_id,
        interviewId: interviewId || null,
        status: 'created',
        enable_recording: enableRecording,
        enable_transcription: enableTranscription,
        // New fields for action tracking
        call_type: callType,
        call_title: callTitle,
        scheduled_for: scheduledFor || null,
        agencyId: auth.agency_id,
        // For client_* stages, sharing should be ON by default (formal stage).
        share_with_client: isClientCall ? true : false,
        share_with_candidate: isClientCall ? true : false,
      })
      .select()
      .single();

    if (insertError) {
      console.error('Failed to store video room:', insertError);
      return withCors(NextResponse.json({ error: 'Failed to create video room' }, { status: 500 }));
    }

    return withCors(NextResponse.json({
      success: true,
      room: {
        id: videoRoom.id,
        roomName: dailyRoom.name,
        roomUrl: dailyRoom.url,
        status: 'created',
        callType,
        title: callTitle,
        scheduledFor: scheduledFor || null,
        expiresAt: new Date(expirationTimestamp * 1000).toISOString(),
        recordingEnabled: enableRecording,
        transcriptionEnabled: enableTranscription,
      },
      // Host (agency) credentials
      host: {
        joinUrl: `${dailyRoom.url}?t=${hostToken}`,
        token: hostToken,
        userId: hasRecruiterUserId ? recruiterUserId : null,
        name: hostUserName,
      },
      // Participant (candidate) credentials
      participant: {
        name: displayName,
        joinUrl: `${dailyRoom.url}?t=${participantToken}`,
        token: participantToken,
      },
      // Metadata for reference
      application_id,
      interviewId: interviewId || null,
      candidate_id: application.candidate_id,
      agencyId: auth.agency_id,
    }, { status: 201 }));

  } catch (error: any) {
    console.error('API v1 video rooms POST error:', error);
    
    if (error.message?.includes('DAILY_API_KEY')) {
      return withCors(NextResponse.json({ 
        error: 'Video service not configured',
        hint: 'Contact support to enable video interviews',
      }, { status: 503 }));
    }

    return withCors(NextResponse.json({ error: 'Internal server error' }, { status: 500 }));
  }
}

/**
 * Get agency tier for feature gating
 */
async function getAgencyTier(agency_id: string): Promise<string> {
  const { data } = await supabaseAdmin
    .from('agencies')
    .select('api_tier')
    .eq('id', agencyId)
    .single();
  
  return data?.api_tier || 'free';
}

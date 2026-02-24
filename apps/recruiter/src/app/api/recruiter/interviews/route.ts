import { getAgencyJobIds } from '@/lib/db/agency-jobs';
import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { formatInPhilippinesTime } from '@/lib/timezone';
import { verifyAuthToken } from '@/lib/auth/verify-token';

/**
 * GET /api/recruiter/interviews
 * Fetch interviews for jobs that belong to this recruiter's agency
 */
export async function GET(request: NextRequest) {
  try {
    const auth = await verifyAuthToken(request);
    const userId = auth.userId;
    if (!userId) return NextResponse.json({ error: auth.error || 'Unauthorized' }, { status: 401 });

    // Get recruiter's agency_id
    const { data: recruiter, error: recruiterError } = await supabaseAdmin
      .from('agency_recruiters')
      .select('agency_id')
      .eq('user_id', userId)
      .single();

    if (recruiterError || !recruiter) {
      return NextResponse.json({ 
        interviews: [],
        message: 'Recruiter not found'
      });
    }

    const agencyId = recruiter.agency_id;

    // Get ALL job IDs for this agency (client + agency-direct)
    const jobIds = await getAgencyJobIds(agencyId);
    if (jobIds.length === 0) {
      return NextResponse.json({ interviews: [], message: 'No jobs found' });
    }

    const { data: jobs } = await supabaseAdmin
      .from('jobs')
      .select('id, title')
      .in('id', jobIds);

    const jobIds = jobs.map(j => j.id);
    const jobMap = Object.fromEntries(jobs.map(j => [j.id, j.title]));

    // Get applications for these jobs
    const { data: applications } = await supabaseAdmin
      .from('job_applications')
      .select('id, job_id, candidate_id')
      .in('job_id', jobIds);

    if (!applications || applications.length === 0) {
      return NextResponse.json({ interviews: [] });
    }

    const appIds = applications.map(a => a.id);
    const appMap = Object.fromEntries(applications.map(a => [a.id, { job_id: a.job_id, candidate_id: a.candidate_id }]));

    // Get interviews for these applications
    const { data: interviews, error: interviewsError } = await supabaseAdmin
      .from('job_interviews')
      .select('*')
      .in('application_id', appIds)
      .order('created_at', { ascending: false });

    if (interviewsError) {
      console.error('Error fetching interviews:', interviewsError);
      return NextResponse.json({ error: 'Failed to fetch interviews' }, { status: 500 });
    }

    // Get candidate details from candidates table AND auth.users for fallback
    const candidateIds = [...new Set(applications.map(a => a.candidate_id))];
    let candidateMap: Record<string, { name: string; email: string; userId: string; avatar_url?: string }> = {};
    
    if (candidateIds.length > 0) {
      // First try candidates table
      const { data: candidates } = await supabaseAdmin
        .from('candidates')
        .select('id, first_name, last_name, email, avatar_url')
        .in('id', candidateIds);

      console.log('🔍 [interviews] Fetched from candidates table:', candidates?.length || 0);

      // Build initial map from candidates table
      if (candidates) {
        for (const c of candidates) {
          let name = `${c.first_name || ''} ${c.last_name || ''}`.trim();
          candidateMap[c.id] = {
            name: name || '',
            email: c.email || '',
            userId: c.id,
            avatar_url: c.avatar_url,
          };
        }
      }

      // For any candidates still missing names, try auth.users metadata
      const missingNames = candidateIds.filter(id => !candidateMap[id]?.name);
      console.log('🔍 [interviews] Missing names for:', missingNames.length);

      for (const candidateId of candidateIds) {
        // If we don't have data or name is empty, fetch from auth.users
        if (!candidateMap[candidateId] || !candidateMap[candidateId].name) {
          try {
            const { data: authUser } = await supabaseAdmin.auth.admin.getUserById(candidateId);
            if (authUser?.user) {
              const metadata = authUser.user.user_metadata || {};
              const email = authUser.user.email || '';
              
              // Try multiple sources for name
              let name = metadata.full_name 
                || metadata.name 
                || `${metadata.first_name || ''} ${metadata.last_name || ''}`.trim()
                || (email ? email.split('@')[0].replace(/[._-]/g, ' ').replace(/\b\w/g, (l: string) => l.toUpperCase()) : '')
                || 'Candidate';

              console.log('🔍 [interviews] Got from auth.users:', { id: candidateId, name, email });

              candidateMap[candidateId] = {
                name,
                email,
                userId: candidateId,
                avatar_url: metadata.avatar_url || metadata.picture || candidateMap[candidateId]?.avatar_url,
              };
            }
          } catch (e) {
            console.log('⚠️ [interviews] Could not fetch auth user:', candidateId);
          }
        }
      }
    }

    // Check for existing offers for these applications
    let offerMap: Record<string, { status: string; id: string }> = {};
    if (appIds.length > 0) {
      const { data: offers } = await supabaseAdmin
        .from('job_offers')
        .select('id, application_id, status')
        .in('application_id', appIds);

      if (offers) {
        offerMap = Object.fromEntries(
          offers.map(o => [o.application_id, { status: o.status, id: o.id }])
        );
      }
    }

    // Attach video room info (if created for this interview)
    const interviewIds = (interviews || []).map((i: any) => i.id);
    let roomByInterviewId: Record<string, any> = {};
    if (interviewIds.length > 0) {
      const { data: rooms } = await supabaseAdmin
        .from('video_call_rooms')
        .select('id, interview_id, status, call_type, daily_room_url, daily_room_name, scheduled_for, created_at')
        .in('interview_id', interviewIds)
        .order('created_at', { ascending: false });

      for (const r of rooms || []) {
        if (!r.interview_id) continue;
        // Keep the most recent room per interview
        if (!roomByInterviewId[r.interview_id]) roomByInterviewId[r.interview_id] = r;
      }
    }

    // Format response
    const formattedInterviews = (interviews || []).map(interview => {
      const app = appMap[interview.application_id];
      const offer = offerMap[interview.application_id];
      const candidate = app ? candidateMap[app.candidate_id] : null;
      const room = roomByInterviewId[interview.id] || null;
      
      return {
        id: interview.id,
        applicationId: interview.application_id,
        // Candidate info for video calls
        candidate_id: candidate?.userId || '', // user_id for starting video call
        candidate_name: candidate?.name || 'Unknown',
        candidate_email: candidate?.email || '',
        candidate_avatar: candidate?.avatar_url || null,
        // Job info
        job_id: app?.job_id || null,
        job_title: app ? jobMap[app.job_id] || 'Unknown Job' : 'Unknown Job',
        // Interview details
        type: interview.interview_type,
        status: interview.status,
        outcome: interview.outcome,
        scheduledAt: interview.scheduled_at,
        duration: interview.duration_minutes || 30,
        notes: interview.interviewer_notes,
        created_at: interview.created_at,
        // Video room (optional)
        room_id: room?.id || null,
        roomStatus: room?.status || null,
        roomUrl: room?.daily_room_url || null,
        roomName: room?.daily_room_name || null,
        callType: room?.call_type || null,
        scheduledFor: room?.scheduled_for || null,
        // Offer info
        has_offer: !!offer,
        offer_status: offer?.status || null,
        offer_id: offer?.id || null,
      };
    });

    return NextResponse.json({ 
      interviews: formattedInterviews,
      total: formattedInterviews.length 
    });

  } catch (error) {
    console.error('Error in recruiter interviews:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

/**
 * POST /api/recruiter/interviews
 * Create/schedule an interview (with UTC + PH + client display fields)
 *
 * Body:
 *   application_id: string (required)
 *   interviewType: string (required)
 *   scheduledAt: string (ISO, UTC) (required)
 *   clientTimezone?: string (IANA, default 'UTC')
 *   durationMinutes?: number (default 30)
 *   notes?: string
 */
export async function POST(request: NextRequest) {
  try {
    const auth = await verifyAuthToken(request);
    const userId = auth.userId;
    if (!userId) return NextResponse.json({ error: auth.error || 'Unauthorized' }, { status: 401 });

    const body = await request.json();
    const {
      application_id,
      interviewType,
      scheduledAt,
      clientTimezone = 'UTC',
      durationMinutes = 30,
      notes,
    } = body || {};

    if (!application_id || !interviewType || !scheduledAt) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    // Verify recruiter agency scope
    const { data: recruiter } = await supabaseAdmin
      .from('agency_recruiters')
      .select('agency_id, id')
      .eq('user_id', userId)
      .single();

    if (!recruiter) {
      return NextResponse.json({ error: 'Recruiter not found' }, { status: 403 });
    }

    const jobIds = await getAgencyJobIds(recruiter.agency_id);

    // Ensure application belongs to agency
    const { data: app } = await supabaseAdmin
      .from('job_applications')
      .select('id, job_id')
      .eq('id', application_id)
      .single();

    if (!app || !jobIds.includes(app.job_id)) {
      return NextResponse.json({ error: 'Application not found' }, { status: 404 });
    }

    const scheduledAtUTC = new Date(scheduledAt).toISOString();
    const scheduledAtClientLocal =
      new Date(scheduledAtUTC).toLocaleString('en-US', {
        timeZone: clientTimezone,
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        hour12: true,
      }) + ` (${clientTimezone.split('/').pop()?.replace('_', ' ') || clientTimezone})`;
    const scheduledAtPH = formatInPhilippinesTime(scheduledAtUTC) + ' (PHT)';

    const { data: interview, error } = await supabaseAdmin
      .from('job_interviews')
      .insert({
        applicationId: application_id,
        interview_type: interviewType,
        status: 'scheduled',
        interviewer_id: recruiter.id,
        interviewer_notes: notes || null,
        scheduled_at: scheduledAtUTC,
        duration_minutes: durationMinutes,
        client_timezone: clientTimezone,
        scheduled_at_client_local: scheduledAtClientLocal,
        scheduled_at_ph: scheduledAtPH,
      })
      .select()
      .single();

    if (error || !interview) {
      console.error('Error creating interview:', error);
      return NextResponse.json({ error: 'Failed to create interview' }, { status: 500 });
    }

    // Update application status + reviewed stamping
    await supabaseAdmin
      .from('job_applications')
      .update({
        status: 'interview_scheduled',
        reviewed_by: recruiter.id,
        reviewed_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', application_id);

    return NextResponse.json({ success: true, interview });
  } catch (error) {
    console.error('Error creating recruiter interview:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

/**
 * PATCH /api/recruiter/interviews
 * Update interview outcome
 */
export async function PATCH(request: NextRequest) {
  try {
    const auth = await verifyAuthToken(request);
    const userId = auth.userId;
    if (!userId) return NextResponse.json({ error: auth.error || 'Unauthorized' }, { status: 401 });

    const { interviewId, outcome, status, notes } = await request.json();

    const updateData: any = {};
    if (outcome) updateData.outcome = outcome;
    if (status) updateData.status = status;
    if (notes) updateData.interviewer_notes = notes;

    const { error } = await supabaseAdmin
      .from('job_interviews')
      .update(updateData)
      .eq('id', interviewId);

    if (error) {
      console.error('Error updating interview:', error);
      return NextResponse.json({ error: 'Failed to update interview' }, { status: 500 });
    }

    return NextResponse.json({ success: true });

  } catch (error) {
    console.error('Error updating interview:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}


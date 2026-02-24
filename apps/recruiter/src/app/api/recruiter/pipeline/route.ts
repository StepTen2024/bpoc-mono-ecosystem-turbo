import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { verifyAuthToken } from '@/lib/auth/verify-token';

/**
 * GET /api/recruiter/pipeline
 * Fetch all candidates across all stages for Kanban pipeline view
 * Returns candidates grouped by stage with job info, video recordings, and metrics
 */
export async function GET(request: NextRequest) {
  try {
    const auth = await verifyAuthToken(request);
    const userId = auth.userId;
    
    if (!userId) {
      return NextResponse.json({ error: auth.error || 'Unauthorized' }, { status: 401 });
    }

    // Get recruiter's agency_id
    const { data: recruiter, error: recruiterError } = await supabaseAdmin
      .from('agency_recruiters')
      .select('agency_id')
      .eq('user_id', userId)
      .single();

    if (recruiterError || !recruiter) {
      return NextResponse.json({ 
        candidates: [],
        stages: getEmptyStages(),
        message: 'Recruiter not found'
      });
    }

    const agencyId = recruiter.agency_id;

    // Get agency_clients for this agency (with company names)
    const { data: clients } = await supabaseAdmin
      .from('agency_clients')
      .select(`
        id,
        company_id,
        companies (
          name
        )
      `)
      .eq('agency_id', agencyId);

    const clientIds = (clients || []).map(c => c.id);
    const clientMap = Object.fromEntries((clients || []).map(c => [c.id, (c.companies as any)?.name || 'Client']));

    // Get agency name for agency-direct jobs
    const { data: agency } = await supabaseAdmin
      .from('agencies')
      .select('name')
      .eq('id', agencyId)
      .single();
    const agencyName = agency?.name || 'Agency';

    // Get ALL jobs for this agency — both client jobs and agency-direct jobs
    // Agency-direct jobs: posted_by is a recruiter in this agency, agency_client_id is null
    const { data: agencyRecruiters } = await supabaseAdmin
      .from('agency_recruiters')
      .select('id')
      .eq('agency_id', agencyId);
    const recruiterIds = (agencyRecruiters || []).map(r => r.id);

    // Fetch client jobs + agency-direct jobs
    let allJobs: any[] = [];
    
    if (clientIds.length > 0) {
      const { data: clientJobs } = await supabaseAdmin
        .from('jobs')
        .select('id, title, agency_client_id, job_type')
        .in('agency_client_id', clientIds);
      if (clientJobs) allJobs.push(...clientJobs);
    }
    
    if (recruiterIds.length > 0) {
      const { data: agencyJobs } = await supabaseAdmin
        .from('jobs')
        .select('id, title, agency_client_id, job_type')
        .is('agency_client_id', null)
        .in('posted_by', recruiterIds);
      if (agencyJobs) allJobs.push(...agencyJobs);
    }

    // Deduplicate
    const jobIdSet = new Set<string>();
    const jobs = allJobs.filter(j => { if (jobIdSet.has(j.id)) return false; jobIdSet.add(j.id); return true; });

    if (jobs.length === 0) {
      return NextResponse.json({ 
        candidates: [],
        stages: getEmptyStages(),
        message: 'No jobs found'
      });
    }

    const jobIds = jobs.map(j => j.id);
    const jobMap = Object.fromEntries(jobs.map(j => [j.id, { title: j.title, client_id: j.agency_client_id }]));

    // Get ALL applications for these jobs with their interviews and offers
    const { data: applications, error: appError } = await supabaseAdmin
      .from('job_applications')
      .select(`
        id,
        job_id,
        candidate_id,
        status,
        created_at,
        updated_at
      `)
      .in('job_id', jobIds)
      .order('created_at', { ascending: false });

    if (appError) {
      console.error('Error fetching applications:', appError);
      return NextResponse.json({ 
        candidates: [],
        stages: getEmptyStages(),
        debug: { error: appError.message }
      });
    }

    if (!applications || applications.length === 0) {
      return NextResponse.json({ 
        candidates: [],
        stages: getEmptyStages(),
        debug: { message: 'No applications found for jobs', jobCount: jobs.length }
      });
    }

    const appIds = applications.map(a => a.id);
    const candidateIds = [...new Set(applications.map(a => a.candidate_id))];

    // Fetch related data in parallel (with error handling for optional data)
    const [candidatesResult, profilesResult, interviewsResult, offersResult] = await Promise.all([
      // Candidates basic info
      supabaseAdmin
        .from('candidates')
        .select('id, first_name, last_name, email, avatar_url')
        .in('id', candidateIds),
      
      // Candidate profiles (for location) - optional
      (async () => {
        try {
          return await supabaseAdmin
            .from('candidate_profiles')
            .select('candidate_id, location')
            .in('candidate_id', candidateIds);
        } catch {
          return { data: [] };
        }
      })(),
      
      // Interviews (using correct table name 'job_interviews')
      (async () => {
        try {
          return await supabaseAdmin
            .from('job_interviews')
            .select('id, application_id, interview_type, status, outcome, created_at')
            .in('application_id', appIds);
        } catch {
          return { data: [] };
        }
      })(),
      
      // Offers
      (async () => {
        try {
          return await supabaseAdmin
            .from('job_offers')
            .select('id, application_id, status, salary_offered, currency, created_at')
            .in('application_id', appIds);
        } catch {
          return { data: [] };
        }
      })(),
    ]);

    // Video calls - fetch separately as it's optional and may fail
    let videoCallsResult: { data: any[] } = { data: [] };
    try {
      const vcResult = await supabaseAdmin
        .from('video_call_rooms')
        .select(`
          id,
          application_id,
          call_type,
          status,
          created_at,
          video_call_recordings(id, status)
        `)
        .in('application_id', appIds);
      if (vcResult.data) videoCallsResult = vcResult as { data: any[] };
    } catch (e) {
      console.log('Video calls query failed (optional):', e);
    }

    // Build profile map for location
    const profileMap = Object.fromEntries(
      ((profilesResult as any).data || []).map((p: { candidate_id: string; location: string }) => [p.candidate_id, p.location])
    );

    // Build lookup maps
    const candidateMap = Object.fromEntries(
      (candidatesResult.data || []).map(c => [c.id, {
        name: `${c.first_name || ''} ${c.last_name || ''}`.trim() || 'Unknown',
        email: c.email || '',
        avatar_url: c.avatar_url,
        location: profileMap[c.id] || null,
      }])
    );

    // Group interviews by application
    const interviewsByApp: Record<string, any[]> = {};
    ((interviewsResult as any).data || []).forEach((i: { application_id: string; interview_type: string; id: string; status: string; outcome: string; created_at: string }) => {
      if (!interviewsByApp[i.application_id]) interviewsByApp[i.application_id] = [];
      // Map job_interviews structure to our internal structure
      interviewsByApp[i.application_id].push({
        ...i,
        type: i.interview_type // Map interview_type to type
      });
    });

    // Group offers by application
    const offersByApp: Record<string, any[]> = {};
    ((offersResult as any).data || []).forEach((o: { application_id: string; id: string; status: string; salary_offered: number; currency: string; created_at: string }) => {
      if (!offersByApp[o.application_id]) offersByApp[o.application_id] = [];
      offersByApp[o.application_id].push(o);
    });

    // Group video calls by application
    const videoCallsByApp: Record<string, any[]> = {};
    (videoCallsResult.data || []).forEach(v => {
      if (!videoCallsByApp[v.application_id]) videoCallsByApp[v.application_id] = [];
      videoCallsByApp[v.application_id].push(v);
    });

    // Build pipeline candidates
    const pipelineCandidates = applications.map(app => {
      const candidate = candidateMap[app.candidate_id] || { name: 'Unknown', email: '' };
      const job = jobMap[app.job_id] || { title: 'Unknown Job', client_id: null };
      const interviews = interviewsByApp[app.id] || [];
      const offers = offersByApp[app.id] || [];
      const videoCalls = videoCallsByApp[app.id] || [];
      
      // Determine stage based on status and related data
      const stage = determineStage(app.status, interviews, offers);
      
      // Calculate days in current stage
      const lastUpdate = app.updated_at || app.created_at;
      const daysInStage = Math.floor((Date.now() - new Date(lastUpdate).getTime()) / (1000 * 60 * 60 * 24));
      
      // Count recordings
      const recordingsCount = videoCalls.reduce((count, vc) => {
        return count + (vc.video_call_recordings?.length || 0);
      }, 0);

      return {
        id: app.id,
        candidate_id: app.candidate_id,
        candidate_name: candidate.name,
        candidate_email: candidate.email,
        candidate_avatar: candidate.avatar_url,
        candidate_location: candidate.location,
        job_id: app.job_id,
        job_title: job.title,
        client_name: job.client_id ? clientMap[job.client_id] || '' : '',
        stage,
        status: app.status,
        applied_at: app.created_at,
        updated_at: app.updated_at,
        daysInStage,
        // Interview info
        interviewCount: interviews.length,
        latestInterview: interviews[0] || null,
        interviewOutcome: interviews.find(i => i.outcome)?.outcome || null,
        // Offer info
        has_offer: offers.length > 0,
        offer_status: offers[0]?.status || null,
        offerAmount: offers[0]?.salary_offered || null,
        offerCurrency: offers[0]?.currency || 'PHP',
        // Video calls
        videoCallCount: videoCalls.length,
        recordingsCount,
        hasRecordings: recordingsCount > 0,
      };
    });

    // Group by stage
    const stages = getEmptyStages();
    pipelineCandidates.forEach(c => {
      if (stages[c.stage]) {
        stages[c.stage].candidates.push(c);
        stages[c.stage].count++;
      }
    });

    return NextResponse.json({ 
      candidates: pipelineCandidates,
      stages,
      total: pipelineCandidates.length,
    });

  } catch (error) {
    console.error('Error in pipeline:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

/**
 * PATCH /api/recruiter/pipeline
 * Move a candidate to a different stage
 */
export async function PATCH(request: NextRequest) {
  try {
    const auth = await verifyAuthToken(request);
    const userId = auth.userId;
    if (!userId) {
      return NextResponse.json({ error: auth.error || 'Unauthorized' }, { status: 401 });
    }

    const { application_id, newStage } = await request.json();

    if (!application_id || !newStage) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    // Map stage to application status
    const stageToStatus: Record<string, string> = {
      'applied': 'submitted',
      'reviewing': 'under_review',
      'shortlisted': 'shortlisted',
      'round_1': 'interview_scheduled',
      'round_2': 'interview_scheduled',
      'final': 'interview_scheduled',
      'offer_sent': 'offer_sent',
      'hired': 'hired',
      'rejected': 'rejected',
    };

    const newStatus = stageToStatus[newStage];
    if (!newStatus) {
      return NextResponse.json({ error: 'Invalid stage' }, { status: 400 });
    }

    // Update application status
    const { error } = await supabaseAdmin
      .from('job_applications')
      .update({ 
        status: newStatus,
        updated_at: new Date().toISOString()
      })
      .eq('id', application_id);

    if (error) {
      console.error('Error updating application:', error);
      return NextResponse.json({ error: 'Failed to update' }, { status: 500 });
    }

    return NextResponse.json({ success: true });

  } catch (error) {
    console.error('Error in pipeline PATCH:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// Helper: Determine stage from status and related data
// Check if interview type is a client-led interview
function isClientInterview(type: string): boolean {
  return type.startsWith('client_') || type === 'final' || type === 'final_interview' || type === 'client';
}

// Check if interview type is a recruiter-led interview
function isRecruiterInterview(type: string): boolean {
  return type.startsWith('recruiter_') || ['prescreen', 'round_1', 'round_2', 'round_3', 'screening', 'technical'].includes(type);
}

function determineStage(status: string, interviews: any[], offers: any[]): string {
  // Check for offer first
  if (offers.length > 0) {
    const latestOffer = offers[0];
    if (latestOffer.status === 'accepted') return 'hired';
    if (latestOffer.status === 'rejected') return 'offer_sent'; // Stay in offer_sent, they declined
    return 'offer_sent';
  }

  // Check interviews
  if (interviews.length > 0) {
    const interviewTypes = interviews.map(i => i.type);
    const latestOutcome = interviews.find(i => i.outcome)?.outcome;
    
    // Check if any client interviews exist
    const hasClientInterview = interviewTypes.some(isClientInterview);
    // Count recruiter interviews
    const recruiterInterviews = interviewTypes.filter(isRecruiterInterview);
    
    if (latestOutcome === 'passed') {
      // Passed interview - check which stage
      if (hasClientInterview) return 'final'; // Client interview stage
      if (recruiterInterviews.length >= 2) return 'round_2';
      return 'round_1';
    }
    
    // Has interviews scheduled/in progress
    if (hasClientInterview) return 'final'; // Client interview stage
    if (recruiterInterviews.length >= 2) return 'round_2';
    return 'round_1';
  }

  // Based on status
  switch (status) {
    case 'submitted':
    case 'new':
      return 'applied';
    case 'under_review':
    case 'reviewing':
      return 'reviewing';
    case 'shortlisted':
    case 'qualified':
      return 'shortlisted';
    case 'interview_scheduled':
    case 'interviewing':
      return 'round_1';
    case 'offer_sent':
      return 'offer_sent';
    case 'hired':
    case 'accepted':
      return 'hired';
    case 'rejected':
    case 'declined':
      return 'rejected';
    default:
      return 'applied';
  }
}

// Helper: Get empty stages structure
function getEmptyStages(): Record<string, { label: string; count: number; candidates: any[]; color: string }> {
  return {
    applied: { label: 'Applied', count: 0, candidates: [], color: 'blue' },
    reviewing: { label: 'Reviewing', count: 0, candidates: [], color: 'cyan' },
    shortlisted: { label: 'Shortlisted', count: 0, candidates: [], color: 'purple' },
    round_1: { label: 'BPOC R1', count: 0, candidates: [], color: 'orange' },       // BPOC Recruiter Round 1
    round_2: { label: 'BPOC R2', count: 0, candidates: [], color: 'amber' },        // BPOC Recruiter Round 2
    final: { label: 'Client Interview', count: 0, candidates: [], color: 'pink' },  // Client Interview Stage
    offer_sent: { label: 'Offer Sent', count: 0, candidates: [], color: 'emerald' },
    hired: { label: 'Hired', count: 0, candidates: [], color: 'green' },
  };
}

import { getAgencyJobIds } from '@/lib/db/agency-jobs';
import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { verifyAuthToken } from '@/lib/auth/verify-token';

/**
 * GET /api/recruiter/applications
 * Fetch applications for jobs that belong to this recruiter's agency
 * With detailed candidate info when ?detailed=true
 */
export async function GET(request: NextRequest) {
  try {
    const auth = await verifyAuthToken(request);
    const userId = auth.userId;
    const detailed = request.nextUrl.searchParams.get('detailed') === 'true';
    
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
        applications: [],
        debug: { userId, recruiterError: recruiterError?.message }
      });
    }

    const agencyId = recruiter.agency_id;

    // Get ALL job IDs for this agency (client + agency-direct)
    const jobIds = await getAgencyJobIds(agencyId);
    if (jobIds.length === 0) {
      return NextResponse.json({ applications: [] });
    }

    const { data: jobs } = await supabaseAdmin
      .from('jobs')
      .select('id, title')
      .in('id', jobIds);
    const jobMap = Object.fromEntries((jobs || []).map(j => [j.id, j.title]));

    // Get applications for these jobs
    const { data: applications, error: appsError } = await supabaseAdmin
      .from('job_applications')
      .select(`
        id,
        job_id,
        candidate_id,
        status,
        created_at,
        recruiter_notes,
        reviewed_by,
        reviewed_at,
        released_to_client,
        released_at,
        released_by
      `)
      .in('job_id', jobIds)
      .order('created_at', { ascending: false });

    if (appsError || !applications) {
      // Fail gracefully - return empty array
      return NextResponse.json({ applications: [], error: 'Failed to fetch applications - showing empty data' });
    }

    // Get candidate details
    const candidateIds = [...new Set(applications.map(a => a.candidate_id))];
    
    // Basic candidate info
    const { data: candidates } = await supabaseAdmin
      .from('candidates')
      .select('id, first_name, last_name, email, avatar_url')
      .in('id', candidateIds);

    const candidateMap = Object.fromEntries(
      (candidates || []).map(c => [c.id, c])
    );

    // If detailed, fetch more info
    let profileMap: Record<string, any> = {};
    let aiAnalysisMap: Record<string, any> = {};
    // Game maps removed
    let skillsMap: Record<string, string[]> = {};
    let resumeMap: Record<string, boolean> = {};
    let offerMap: Record<string, any> = {};

    if (detailed && candidateIds.length > 0) {
      // Profiles
      const { data: profiles } = await supabaseAdmin
        .from('candidate_profiles')
        .select('candidate_id, location, experience_years')
        .in('candidate_id', candidateIds);
      
      profileMap = Object.fromEntries(
        (profiles || []).map(p => [p.candidate_id, p])
      );

      // AI Analysis
      const { data: aiAnalyses } = await supabaseAdmin
        .from('candidate_ai_analysis')
        .select('candidate_id, overall_score')
        .in('candidate_id', candidateIds);
      
      aiAnalysisMap = Object.fromEntries(
        (aiAnalyses || []).map(a => [a.candidate_id, a])
      );

      // Game assessments removed

      // Skills
      const { data: skills } = await supabaseAdmin
        .from('candidate_skills')
        .select('candidate_id, name')
        .in('candidate_id', candidateIds);
      
      (skills || []).forEach(s => {
        if (!skillsMap[s.candidate_id]) skillsMap[s.candidate_id] = [];
        skillsMap[s.candidate_id].push(s.name);
      });

      // Resumes
      const { data: resumes } = await supabaseAdmin
        .from('candidate_resumes')
        .select('candidate_id, id, file_name, file_url, is_primary, uploaded_at, created_at')
        .in('candidate_id', candidateIds);
      
      // Choose the "best" resume per candidate: primary > newest
      (resumes || []).forEach((r: any) => {
        const existing = (resumeMap as any)[r.candidate_id] as any | undefined;
        const isPrimary = !!r.is_primary;
        const ts = new Date(r.uploaded_at || r.created_at || 0).getTime();

        if (!existing) {
          (resumeMap as any)[r.candidate_id] = { ...r, _ts: ts };
          return;
        }

        const existingPrimary = !!existing.is_primary;
        const existingTs = new Date(existing.uploaded_at || existing.created_at || 0).getTime();

        if (isPrimary && !existingPrimary) {
          (resumeMap as any)[r.candidate_id] = { ...r, _ts: ts };
          return;
        }

        if (isPrimary === existingPrimary && ts > existingTs) {
          (resumeMap as any)[r.candidate_id] = { ...r, _ts: ts };
        }
      });

      // Check for existing offers
      const application_ids = applications.map(a => a.id);
      const { data: offers } = await supabaseAdmin
        .from('job_offers')
        .select('application_id, status')
        .in('application_id', application_ids);
      
      offerMap = Object.fromEntries(
        (offers || []).map(o => [o.application_id, o])
      );
    }

    // Format response
    const formattedApplications = applications.map(app => {
      const candidate = candidateMap[app.candidate_id];
      const profile = profileMap[app.candidate_id];
      const aiAnalysis = aiAnalysisMap[app.candidate_id];
      const offer = offerMap[app.id];

      return {
        id: app.id,
        candidate_id: app.candidate_id,
        candidate_name: candidate ? `${candidate.first_name || ''} ${candidate.last_name || ''}`.trim() : 'Unknown',
        candidate_email: candidate?.email || '',
        candidate_phone: candidate?.phone || null,
        candidate_avatar: candidate?.avatar_url || null,
        candidate_location: profile?.location || null,
        job_id: app.job_id,
        job_title: jobMap[app.job_id] || 'Unknown Job',
        status: app.status,
        applied_at: app.created_at,
        recruiter_notes: app.recruiter_notes,
        reviewed_by: (app as any).reviewed_by || null,
        reviewed_at: (app as any).reviewed_at || null,
        released_to_client: !!(app as any).released_to_client,
        released_at: (app as any).released_at || null,
        released_by: (app as any).released_by || null,
        // Detailed info
        has_resume: !!(resumeMap as any)[app.candidate_id],
        resume_url: (resumeMap as any)[app.candidate_id]?.file_url || null,
        resume_file_name: (resumeMap as any)[app.candidate_id]?.file_name || null,
        has_ai_analysis: !!aiAnalysis,
        ai_score: aiAnalysis?.overall_score || null,
        skills: skillsMap[app.candidate_id] || [],
        experience_years: profile?.experience_years || null,
        // Offer info
        has_offer: !!offer,
        offer_status: offer?.status || null,
      };
    });

    return NextResponse.json({ 
      applications: formattedApplications,
      total: formattedApplications.length,
    });

  } catch (error) {
    console.error('Error in recruiter applications:', error);
    // Fail gracefully - return empty array instead of 500
    return NextResponse.json({ 
      applications: [], 
      total: 0,
      error: 'Internal server error - showing empty data' 
    });
  }
}

/**
 * POST /api/recruiter/applications
 * Request interview for an application
 */
export async function POST(request: NextRequest) {
  try {
    const auth = await verifyAuthToken(request);
    const userId = auth.userId;
    if (!userId) {
      return NextResponse.json({ error: auth.error || 'Unauthorized' }, { status: 401 });
    }

    const { application_id, interviewType } = await request.json();

    // Get recruiter's agency_recruiters ID
    const { data: recruiter } = await supabaseAdmin
      .from('agency_recruiters')
      .select('id')
      .eq('user_id', userId)
      .single();

    // Create interview request
    const { data: interview, error } = await supabaseAdmin
      .from('job_interviews')
      .insert({
        applicationId: application_id,
        interview_type: interviewType || 'screening',
        status: 'scheduled',
        interviewer_id: recruiter?.id || null,
      })
      .select()
      .single();

    if (error) {
      console.error('Error creating interview:', error);
      return NextResponse.json({ error: 'Failed to create interview' }, { status: 500 });
    }

    // Update application status
    await supabaseAdmin
      .from('job_applications')
      .update({ status: 'interview_scheduled' })
      .eq('id', application_id);

    return NextResponse.json({ success: true, interview });

  } catch (error) {
    console.error('Error creating interview:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

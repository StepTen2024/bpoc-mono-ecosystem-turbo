import { getAgencyJobIds } from '@/lib/db/agency-jobs';
import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { verifyAuthToken } from '@/lib/auth/verify-token';

/**
 * GET /api/recruiter/onboarding
 * Get all onboarding candidates for jobs in this recruiter's agency
 */
export async function GET(request: NextRequest) {
  try {
    const auth = await verifyAuthToken(request);
    const userId = auth.userId;
    if (!userId) {
      return NextResponse.json({ error: auth.error || 'Unauthorized' }, { status: 401 });
    }

    // Get recruiter's agency
    const { data: recruiter, error: recruiterError } = await supabaseAdmin
      .from('agency_recruiters')
      .select('agency_id')
      .eq('user_id', userId)
      .single();

    if (recruiterError || !recruiter) {
      return NextResponse.json({ onboardings: [], message: 'Recruiter not found' });
    }

    // Get agency clients
    const { data: clients } = await supabaseAdmin
      .from('agency_clients')
      .select('id')
      .eq('agency_id', recruiter.agency_id);

    if (!clients || clients.length === 0) {
      return NextResponse.json({ onboardings: [], message: 'No clients found' });
    }

    const clientIds = clients.map(c => c.id);

    // Get jobs for these clients
    const { data: jobs } = await supabaseAdmin
      .from('jobs')
      .select('id, title, agency_clients(companies(name))')
      .in('id', await getAgencyJobIds(agencyId));

    if (!jobs || jobs.length === 0) {
      return NextResponse.json({ onboardings: [], message: 'No jobs found' });
    }

    const jobIds = jobs.map(j => j.id);
    const jobMap = new Map(jobs.map(j => [j.id, {
      title: j.title,
      company: (j.agency_clients as any)?.companies?.name || 'Unknown'
    }]));

    // Get applications for these jobs that have onboarding
    // Note: 'onboarding' is not a valid ApplicationStatus enum - candidates at onboarding stage 
    // have status 'offer_accepted' or 'hired'
    const { data: applications } = await supabaseAdmin
      .from('job_applications')
      .select('id, job_id, candidate_id')
      .in('job_id', jobIds)
      .in('status', ['offer_accepted', 'hired']);

    if (!applications || applications.length === 0) {
      return NextResponse.json({ onboardings: [] });
    }

    const appIds = applications.map(a => a.id);
    const appMap = new Map(applications.map(a => [a.id, { job_id: a.job_id, candidate_id: a.candidate_id }]));

    // Get onboarding records
    const { data: onboardings, error: onboardingError } = await supabaseAdmin
      .from('candidate_onboarding')
      .select('*')
      .in('job_application_id', appIds)
      .order('created_at', { ascending: false });

    if (onboardingError) {
      console.error('Error fetching onboardings:', onboardingError);
      return NextResponse.json({ error: 'Failed to fetch onboardings' }, { status: 500 });
    }

    // Format response
    const formattedOnboardings = (onboardings || []).map(o => {
      const app = appMap.get(o.job_application_id);
      const job = app ? jobMap.get(app.job_id) : null;
      
      return {
        id: o.id,
        candidate_id: o.candidate_id,
        application_id: o.job_application_id,
        first_name: o.first_name,
        last_name: o.last_name,
        email: o.email,
        position: job?.title || o.position || 'Unknown Position',
        company: job?.company || 'Unknown Company',
        job_id: app?.job_id,
        completionPercent: o.completion_percent || 0,
        isComplete: o.is_complete || false,
        contractSigned: o.contract_signed || false,
        employmentStarted: o.employment_started || false,
        start_date: o.start_date || o.employment_start_date,
        created_at: o.created_at,
        checklist: {
          personalInfo: o.personal_info_status,
          govId: o.gov_id_status,
          education: o.education_status,
          medical: o.medical_status,
          dataPrivacy: o.data_privacy_status,
          resume: o.resume_status,
          signature: o.signature_status,
          emergencyContact: o.emergency_contact_status,
        },
      };
    });

    return NextResponse.json({ onboardings: formattedOnboardings });
  } catch (error: any) {
    console.error('Error in recruiter onboarding API:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

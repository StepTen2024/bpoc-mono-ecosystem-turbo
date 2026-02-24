import { getAgencyJobIds } from '@/lib/db/agency-jobs';
import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { verifyAuthToken } from '@/lib/auth/verify-token';

/**
 * GET /api/recruiter/placements
 * Fetch all successful placements (accepted offers) for this recruiter's agency
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
      return NextResponse.json({ placements: [] });
    }

    const agencyId = recruiter.agency_id;

    // Get ALL jobs for this agency (client + agency-direct)
    const allJobIds = await getAgencyJobIds(agencyId);
    if (allJobIds.length === 0) {
      return NextResponse.json({ placements: [] });
    }

    // Get client info for display
    const { data: clients } = await supabaseAdmin
      .from('agency_clients')
      .select('id, companies(id, name)')
      .eq('agency_id', agencyId);

    const clientMap = Object.fromEntries(
      (clients || []).map(c => [c.id, { 
        id: c.id, 
        name: (c.companies as any)?.name || 'Unknown Client' 
      }])
    );

    // Get jobs
    const { data: jobs } = await supabaseAdmin
      .from('jobs')
      .select('id, title, agency_client_id')
      .in('id', allJobIds);

    const jobIds = (jobs || []).map(j => j.id);
    const jobMap = Object.fromEntries(
      jobs.map(j => [j.id, { title: j.title, client_id: j.agency_client_id }])
    );

    // Get applications for these jobs
    const { data: applications } = await supabaseAdmin
      .from('job_applications')
      .select('id, job_id, candidate_id, status')
      .in('job_id', jobIds)
      .eq('status', 'hired');

    if (!applications || applications.length === 0) {
      return NextResponse.json({ placements: [] });
    }

    const appIds = applications.map(a => a.id);
    const appMap = Object.fromEntries(
      applications.map(a => [a.id, { job_id: a.job_id, candidate_id: a.candidate_id }])
    );

    // Get accepted offers
    const { data: offers, error: offersError } = await supabaseAdmin
      .from('job_offers')
      .select('*')
      .in('application_id', appIds)
      .eq('status', 'accepted')
      .order('created_at', { ascending: false });

    if (offersError || !offers || offers.length === 0) {
      return NextResponse.json({ placements: [] });
    }

    // Get candidate details
    const candidateIds = [...new Set(applications.map(a => a.candidate_id))];
    const { data: candidates } = await supabaseAdmin
      .from('candidates')
      .select('id, first_name, last_name, email, avatar_url')
      .in('id', candidateIds);

    const candidateMap = Object.fromEntries(
      (candidates || []).map(c => [c.id, {
        name: `${c.first_name || ''} ${c.last_name || ''}`.trim(),
        email: c.email,
        avatar: c.avatar_url,
      }])
    );

    // Format placements
    const placements = offers.map(offer => {
      const app = appMap[offer.application_id];
      const job = app ? jobMap[app.job_id] : null;
      const client = job ? clientMap[job.client_id] : null;
      const candidate = app ? candidateMap[app.candidate_id] : null;

      return {
        id: offer.id,
        offer_id: offer.id,
        applicationId: offer.application_id,
        // Candidate
        candidate_id: app?.candidate_id || '',
        candidate_name: candidate?.name || 'Unknown',
        candidate_email: candidate?.email || '',
        candidate_avatar: candidate?.avatar || null,
        // Job
        job_id: app?.job_id || '',
        job_title: job?.title || 'Unknown Job',
        // Client
        client_id: client?.id || '',
        client_name: client?.name || 'Unknown Client',
        // Offer details
        salary: offer.salary_offered || 0,
        currency: offer.currency || 'PHP',
        start_date: offer.start_date,
        status: offer.status,
        hired_at: offer.accepted_at || offer.updated_at || offer.created_at,
      };
    });

    return NextResponse.json({
      placements,
      total: placements.length,
    });

  } catch (error) {
    console.error('Error fetching placements:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}


import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { requireRecruiter, roleErrorResponse } from '@/lib/api-role-auth';
import { getAgencyJobIds } from '@/lib/db/agency-jobs';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);

    // CRITICAL SECURITY: Verify user is a recruiter (not just authenticated)
    // This prevents candidates from calling recruiter APIs
    const auth = await requireRecruiter(request);
    if (!auth.success) {
      return roleErrorResponse(auth);
    }

    const { agencyId } = auth.user!;

    // Get ALL job IDs for this agency (client + agency-direct)
    const jobIds = await getAgencyJobIds(agencyId);
    if (jobIds.length === 0) {
      return NextResponse.json({ jobs: [] });
    }

    const status = searchParams.get('status') || '';

    let query = supabaseAdmin
      .from('jobs')
      .select(`
        id,
        title,
        slug,
        status,
        rejection_reason,
        work_type,
        work_arrangement,
        salary_min,
        salary_max,
        currency,
        views,
        applicants_count,
        created_at,
        job_type,
        agency_client_id,
        agency_clients (
          company_id,
          companies (
            name
          )
        )
      `)
      .in('id', jobIds)
      .order('created_at', { ascending: false });

    if (status && status !== 'all') {
      query = query.eq('status', status);
    }

    const { data: jobs, error } = await query;
    if (error) throw error;

    const formattedJobs = (jobs || []).map((job: any) => ({
      id: job.id,
      title: job.title,
      slug: job.slug,
      status: job.status,
      rejectionReason: job.rejection_reason || null,
      workType: job.work_type,
      workArrangement: job.work_arrangement,
      salary_min: job.salary_min,
      salary_max: job.salary_max,
      currency: job.currency || 'PHP',
      views: job.views || 0,
      applicantsCount: job.applicants_count || 0,
      created_at: job.created_at,
      agency_client_id: job.agency_client_id,
      client_name: job.agency_clients?.companies?.name || 'Unknown Client',
    }));

    return NextResponse.json({ jobs: formattedJobs });
  } catch (error) {
    console.error('Recruiter jobs error:', error);
    // Fail gracefully - return empty array instead of 500
    return NextResponse.json({ 
      jobs: [], 
      error: 'Failed to fetch jobs - showing empty data' 
    });
  }
}

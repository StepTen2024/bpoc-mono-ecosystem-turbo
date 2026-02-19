import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/admin';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const clientId = searchParams.get('clientId');

    let query = supabaseAdmin
      .from('jobs')
      .select('id, title, status, created_at, agency_client_id')
      .order('created_at', { ascending: false });

    if (clientId) {
      query = query.eq('agency_client_id', clientId);
    }

    const { data: jobs, error } = await query;

    if (error) {
      console.error('Error fetching jobs:', error);
      return NextResponse.json({ error: 'Failed to fetch jobs' }, { status: 500 });
    }

    // Get application stats per job
    const jobsWithStats = await Promise.all(
      (jobs || []).map(async (job: any) => {
        const { data: apps } = await supabaseAdmin
          .from('applications')
          .select('status')
          .eq('job_id', job.id);

        const applicationStats = {
          pending: 0,
          under_review: 0,
          interview_scheduled: 0,
          offer_sent: 0,
        };

        (apps || []).forEach((app: any) => {
          if (app.status === 'pending' || app.status === 'applied') applicationStats.pending++;
          else if (app.status === 'under_review' || app.status === 'screening') applicationStats.under_review++;
          else if (app.status === 'interview_scheduled' || app.status === 'interview') applicationStats.interview_scheduled++;
          else if (app.status === 'offer_sent' || app.status === 'offered') applicationStats.offer_sent++;
        });

        return { ...job, applicationStats };
      })
    );

    return NextResponse.json({ jobs: jobsWithStats });
  } catch (error) {
    console.error('Error in jobs route:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

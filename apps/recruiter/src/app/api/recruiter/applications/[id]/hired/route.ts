import { getAgencyJobIds } from '@/lib/db/agency-jobs';
import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { updateHiredStatus } from '@/lib/db/applications/queries.supabase';
import { verifyAuthToken } from '@/lib/auth/verify-token';

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await verifyAuthToken(request);
    const userId = auth.userId;
    if (!userId) return NextResponse.json({ error: auth.error || 'Unauthorized' }, { status: 401 });

    const { id } = await params;
    const body = await request.json();
    const { offer_acceptance_date, contract_signed, first_day_date, started_status } = body;

    // Verify application belongs to recruiter's agency
    const { data: recruiter } = await supabaseAdmin
      .from('agency_recruiters')
      .select('agency_id')
      .eq('user_id', userId)
      .single();

    if (!recruiter) {
      return NextResponse.json({ error: 'Recruiter not found' }, { status: 404 });
    }

    const jobIds = await getAgencyJobIds(recruiter.agency_id);

    const { data: app } = await supabaseAdmin
      .from('job_applications')
      .select('id, job_id')
      .eq('id', id)
      .single();
    
    // Verify this application belongs to a job in this agency
    if (app && !jobIds.includes(app.job_id)) {
      return NextResponse.json({ error: 'Application not found' }, { status: 404 });
    }

    if (!app) {
      return NextResponse.json({ error: 'Application not found' }, { status: 404 });
    }

    if (started_status && !['hired', 'started', 'no_show'].includes(started_status)) {
      return NextResponse.json(
        { error: 'started_status must be "hired", "started", or "no_show"' },
        { status: 400 }
      );
    }

    const updated = await updateHiredStatus(id, {
      offer_acceptance_date,
      contract_signed,
      first_day_date,
      started_status,
    });

    if (!updated) {
      return NextResponse.json({ error: 'Failed to update hired status' }, { status: 500 });
    }

    // Update status if started_status is 'hired'
    if (started_status === 'hired') {
      await supabaseAdmin
        .from('job_applications')
        .update({ status: 'hired' })
        .eq('id', id);
    }

    return NextResponse.json({ application: updated });
  } catch (error) {
    console.error('Error updating hired status:', error);
    return NextResponse.json(
      { error: 'Failed to update hired status' },
      { status: 500 }
    );
  }
}


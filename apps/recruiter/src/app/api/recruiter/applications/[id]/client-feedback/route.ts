import { getAgencyJobIds } from '@/lib/db/agency-jobs';
import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { updateClientFeedback } from '@/lib/db/applications/queries.supabase';
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
    const { notes, rating } = body;

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

    const updated = await updateClientFeedback(id, { notes, rating });

    if (!updated) {
      return NextResponse.json({ error: 'Failed to update client feedback' }, { status: 500 });
    }

    return NextResponse.json({ feedback: updated });
  } catch (error) {
    console.error('Error updating client feedback:', error);
    return NextResponse.json(
      { error: 'Failed to update client feedback' },
      { status: 500 }
    );
  }
}


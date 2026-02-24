import { getAgencyJobIds } from '@/lib/db/agency-jobs';
import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { logApplicationActivity } from '@/lib/db/applications/queries.supabase';
import { verifyAuthToken } from '@/lib/auth/verify-token';

/**
 * POST /api/recruiter/applications/:id/send-back
 * Client sends application back to recruiter (recruiter portal supports this action for now)
 *
 * Body:
 *   reason?: string
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await verifyAuthToken(request);
    const userId = auth.userId;
    if (!userId) return NextResponse.json({ error: auth.error || 'Unauthorized' }, { status: 401 });

    const { id } = await params;
    const body = await request.json().catch(() => ({}));
    const { reason } = body || {};

    // Verify recruiter + scope to agency
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
      .select('id, status, job_id')
      .eq('id', id)
      .single();

    if (!app) {
      return NextResponse.json({ error: 'Application not found' }, { status: 404 });
    }

    const now = new Date().toISOString();

    const { data: updated, error: updateError } = await supabaseAdmin
      .from('job_applications')
      .update({
        released_to_client: false,
        status: 'reviewed',
        updated_at: now,
      })
      .eq('id', id)
      .select('id, status, released_to_client')
      .single();

    if (updateError || !updated) {
      console.error('Recruiter send-back update failed:', updateError);
      return NextResponse.json({ error: 'Failed to send back application' }, { status: 500 });
    }

    await logApplicationActivity(id, {
      action_type: 'sent_back_to_recruiter',
      performed_by_type: 'client',
      performed_by_id: userId,
      description: `Application sent back to recruiter${reason ? `: ${reason}` : ''}`,
      metadata: { reason: reason || null },
    });

    return NextResponse.json({ success: true, application: updated });
  } catch (error) {
    console.error('Recruiter send-back error:', error);
    return NextResponse.json({ error: 'Failed to send back application' }, { status: 500 });
  }
}



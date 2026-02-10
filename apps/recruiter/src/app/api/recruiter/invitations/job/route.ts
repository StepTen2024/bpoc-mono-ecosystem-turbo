import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { verifyAuthToken } from '@/lib/auth/verify-token';

/**
 * POST /api/recruiter/invitations/job
 * Invite a candidate from Talent Pool to apply for a specific job.
 *
 * Body:
 *  - candidate_id: string (required) candidates.id
 *  - job_id: string (required) jobs.id
 *  - message?: string (optional) stored in recruiter_notes for now
 *
 * Notes:
 * - Creates (or updates) a job_applications row with status='invited'
 * - Requires DB check constraint to allow 'invited' status (see migration)
 */
export async function POST(request: NextRequest) {
  try {
    const auth = await verifyAuthToken(request);
    const userId = auth.userId;
    if (!userId) return NextResponse.json({ error: auth.error || 'Unauthorized' }, { status: 401 });

    const body = await request.json();
    const { candidate_id, job_id, message } = body as { candidate_id?: string; job_id?: string; message?: string };

    if (!candidate_id || !job_id) {
      return NextResponse.json({ error: 'candidate_id and job_id are required' }, { status: 400 });
    }

    // Recruiter context
    const { data: recruiter } = await supabaseAdmin
      .from('agency_recruiters')
      .select('id, agency_id')
      .eq('user_id', userId)
      .single();

    if (!recruiter) {
      return NextResponse.json({ error: 'Recruiter not found' }, { status: 403 });
    }

    // Verify job belongs to agency
    const { data: job } = await supabaseAdmin
      .from('jobs')
      .select('id, agency_client_id')
      .eq('id', job_id)
      .single();

    if (!job) return NextResponse.json({ error: 'Job not found' }, { status: 404 });

    const { data: agencyClient } = await supabaseAdmin
      .from('agency_clients')
      .select('id, agency_id')
      .eq('id', (job as any).agency_client_id)
      .single();

    if (!agencyClient || (agencyClient as any).agency_id !== recruiter.agency_id) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    const now = new Date().toISOString();

    // Upsert application as invited
    const { data: application, error } = await supabaseAdmin
      .from('job_applications')
      .upsert(
        {
          candidate_id: candidate_id,
          job_id: job_id,
          status: 'invited',
          recruiter_notes: typeof message === 'string' && message.trim().length > 0 ? message.trim() : null,
          updated_at: now,
        },
        { onConflict: 'candidate_id,job_id' }
      )
      .select('id, status')
      .single();

    if (error) {
      console.error('[invite job] failed to upsert job_application:', error);
      return NextResponse.json(
        {
          error: 'Failed to invite candidate to job',
          details: (error as any)?.message,
          hint: 'Ensure job_applications.status allows "invited" (check constraint/migration).',
        },
        { status: 500 }
      );
    }

    // Candidate notification (so invite shows up in bell + notifications page)
    let notificationCreated = false;
    let notificationError: string | null = null;
    if (candidate_id) {
      const { error: notifyError } = await supabaseAdmin.from('notifications').insert({
        user_id: candidate_id,
        type: 'job_invite',
        title: 'You were invited to apply ✨',
        message: 'A recruiter invited you to apply for a job. Review the invite and accept or decline.',
        action_url: '/candidate/applications',
        action_label: 'Review invite',
        is_urgent: true,
        is_read: false,
        metadata: {
          application_id: application?.id,
          job_id,
          candidate_id,
          timestamp: now,
        },
      } as any);
      if (notifyError) {
        notificationError = notifyError.message;
        console.warn('[invite job] failed to create notification:', notifyError);
      } else {
        notificationCreated = true;
      }
    }

    // Best-effort activity timeline entry (so invited shows in history)
    try {
      await supabaseAdmin.from('application_activity_timeline').insert({
        application_id: application?.id,
        action_type: 'invited',
        performed_by_type: 'recruiter',
        performed_by_id: recruiter.id,
        description: 'Recruiter invited candidate to apply',
        metadata: {
          job_id,
          candidate_id,
          timestamp: now,
        },
      });
    } catch (e) {
      console.warn('[invite job] failed to insert activity timeline entry:', e);
    }

    return NextResponse.json({
      success: true,
      application_id: application?.id,
      status: application?.status,
      message: 'Invitation sent',
      notificationCreated,
      notificationError,
    });
  } catch (e) {
    console.error('[invite job] unexpected error:', e);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}



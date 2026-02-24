import { getAgencyJobIds } from '@/lib/db/agency-jobs';
import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { logApplicationActivity } from '@/lib/db/applications/queries.supabase';
import { verifyAuthToken } from '@/lib/auth/verify-token';

/**
 * POST /api/recruiter/applications/:id/release
 * Recruiter releases an application to the client (Recruiter Gate)
 *
 * Body:
 *   share_calls_with_client?: Array<{ room_id: string; share_video?: boolean; share_notes?: boolean; share_transcript?: boolean }>
 *   share_calls_with_candidate?: Array<{ room_id: string; share_video?: boolean; share_notes?: boolean; share_transcript?: boolean }>
 *   status?: string (optional)
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const debug = request.nextUrl.searchParams.get('debug') === '1';
    const auth = await verifyAuthToken(request);
    const userId = auth.userId;
    if (!userId) return NextResponse.json({ error: auth.error || 'Unauthorized' }, { status: 401 });

    const { id } = await params;
    const body = await request.json().catch(() => ({}));
    const {
      share_calls_with_client,
      share_calls_with_candidate,
      status,
    } = body || {};

    // Verify recruiter + scope to agency
    const { data: recruiter, error: recruiterErr } = await supabaseAdmin
      .from('agency_recruiters')
      .select('agency_id')
      .eq('user_id', userId)
      .single();

    if (recruiterErr || !recruiter) {
      return NextResponse.json(
        { error: 'Recruiter not found', details: debug ? recruiterErr?.message : undefined },
        { status: 404 }
      );
    }

    const jobIds = await getAgencyJobIds(recruiter.agency_id);

    const { data: app, error: appErr } = await supabaseAdmin
      .from('job_applications')
      .select('id, status, job_id')
      .eq('id', id)
      .single();

    if (appErr || !app || !jobIds.includes(app.job_id)) {
      return NextResponse.json(
        { error: 'Application not found', details: debug ? appErr?.message : undefined },
        { status: 404 }
      );
    }

    const now = new Date().toISOString();

    // Optional: persist per-call sharing flags (source of truth)
    // This should not block release if migrations are missing; we best-effort and continue.
    // Accept either:
    // - [{ room_id, share: true/false }]
    // - ["room_id1", "room_id2"] (treated as share=true)
    const normalizeShareArray = (value: any) => {
      if (!Array.isArray(value)) return [] as Array<any>;
      return value
        .map((v: any) => (typeof v === 'string' ? { room_id: v, share: true } : v))
        .filter(Boolean);
    };
    const clientShares = normalizeShareArray(share_calls_with_client);
    const candidateShares = normalizeShareArray(share_calls_with_candidate);

    const deriveShareBool = (s: any) =>
      s?.share === true ||
      s?.share_all === true ||
      !!s?.share_video ||
      !!s?.share_notes ||
      !!s?.share_transcript;

    let shareWarning: string | null = null;
    try {
      // Update rooms for client sharing
      for (const s of clientShares) {
        if (!s?.room_id) continue;
        const shareAll = deriveShareBool(s);
        const r1 = await supabaseAdmin
          .from('video_call_rooms')
          .update({
            // Simplified flags (new primary)
            share_with_client: shareAll,
          })
          .eq('id', s.room_id)
          .eq('application_id', id);
        if (r1.error) throw new Error(`video_call_rooms update failed: ${r1.error.message}`);

        // Update transcript share flags (room_id is the FK in transcripts)
        const t1 = await supabaseAdmin
          .from('video_call_transcripts')
          .update({
            shared_with_client: shareAll,
          })
          .eq('room_id', s.room_id);
        if (t1.error) throw new Error(`video_call_transcripts update failed: ${t1.error.message}`);

        // Update recording share flags (optional convenience)
        const rec1 = await supabaseAdmin
          .from('video_call_recordings')
          .update({
            shared_with_client: shareAll,
          })
          .eq('room_id', s.room_id);
        if (rec1.error) throw new Error(`video_call_recordings update failed: ${rec1.error.message}`);
      }

      // Update rooms for candidate sharing
      for (const s of candidateShares) {
        if (!s?.room_id) continue;
        const shareAll = deriveShareBool(s);
        const r2 = await supabaseAdmin
          .from('video_call_rooms')
          .update({
            share_with_candidate: shareAll,
          })
          .eq('id', s.room_id)
          .eq('application_id', id);
        if (r2.error) throw new Error(`video_call_rooms update failed: ${r2.error.message}`);

        const t2 = await supabaseAdmin
          .from('video_call_transcripts')
          .update({
            shared_with_candidate: shareAll,
          })
          .eq('room_id', s.room_id);
        if (t2.error) throw new Error(`video_call_transcripts update failed: ${t2.error.message}`);

        const rec2 = await supabaseAdmin
          .from('video_call_recordings')
          .update({
            shared_with_candidate: shareAll,
          })
          .eq('room_id', s.room_id);
        if (rec2.error) throw new Error(`video_call_recordings update failed: ${rec2.error.message}`);
      }
    } catch (e) {
      // Likely missing columns if migrations aren't applied; do not block release.
      shareWarning = e instanceof Error ? e.message : 'Failed to update call sharing flags';
      console.error('Recruiter release: call sharing update failed (non-fatal):', e);
    }

    const { data: updated, error: updateError } = await supabaseAdmin
      .from('job_applications')
      .update({
        released_to_client: true,
        released_at: now,
        released_by: userId, // auth.users(id)
        status: status || (app as any).status,
        updated_at: now,
      })
      .eq('id', id)
      .select('id, status, released_to_client, released_at, released_by')
      .single();

    if (updateError || !updated) {
      console.error('Recruiter release update failed:', updateError);
      return NextResponse.json(
        {
          error: 'Failed to release application',
          details: updateError?.message || 'Unknown error',
          hint: debug
            ? 'If this is an enum error, verify ApplicationStatus contains your status value.'
            : undefined,
        },
        { status: 500 }
      );
    }

    // Timeline logging should not block releasing; if it fails, we still return success.
    let timelineWarning: string | null = null;
    try {
      await logApplicationActivity(id, {
        action_type: 'released_to_client',
        performed_by_type: 'recruiter',
        performed_by_id: userId,
        description: `Application released to client${(updated as any).status ? ` (status: ${(updated as any).status})` : ''}`,
        metadata: {
          // per-call sharing (new)
          share_calls_with_client_count: clientShares.length,
          share_calls_with_candidate_count: candidateShares.length,
        },
      });
    } catch (e) {
      timelineWarning = e instanceof Error ? e.message : 'Failed to log timeline activity';
      console.error('Recruiter release timeline log failed:', e);
    }

    return NextResponse.json({
      success: true,
      application: updated,
      warning: timelineWarning || shareWarning,
      debug: debug
        ? {
            requestBody: body || null,
            share_calls_with_client_len: clientShares.length,
            share_calls_with_candidate_len: candidateShares.length,
            statusRequested: status || null,
          }
        : undefined,
    });
  } catch (error) {
    console.error('Recruiter release error:', error);
    return NextResponse.json(
      {
        error: 'Failed to release application',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}



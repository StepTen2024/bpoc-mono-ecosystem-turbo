import { getAgencyJobIds } from '@/lib/db/agency-jobs';
import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { updateRejection } from '@/lib/db/applications/queries.supabase';
import { verifyAuthToken } from '@/lib/auth/verify-token';
import { getTemplateById } from '@/lib/constants/rejection-templates';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await verifyAuthToken(request);
    const userId = auth.userId;
    if (!userId) return NextResponse.json({ error: auth.error || 'Unauthorized' }, { status: 401 });

    const { id } = await params;
    const body = await request.json();
    const { reason, rejected_by, templateId, customReason } = body;

    // Support both template-based and custom rejections
    let rejectionReason = reason;
    
    if (templateId) {
      const template = getTemplateById(templateId);
      if (template) {
        rejectionReason = template.message;
      }
    } else if (customReason) {
      rejectionReason = customReason;
    }

    if (!rejectionReason || !rejected_by) {
      return NextResponse.json(
        { error: 'Reason and rejected_by are required' },
        { status: 400 }
      );
    }

    // Verify application belongs to recruiter's agency
    const { data: recruiter } = await supabaseAdmin
      .from('agency_recruiters')
      .select('agency_id, id')
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

    const updated = await updateRejection(id, {
      reason: rejectionReason,
      rejected_by: rejected_by as 'client' | 'recruiter',
      rejected_by_id: rejected_by === 'recruiter' ? recruiter.id : undefined,
    });

    if (!updated) return NextResponse.json({ error: 'Failed to reject application' }, { status: 500 });

    return NextResponse.json({ application: updated });
  } catch (error) {
    console.error('Error rejecting application:', error);
    return NextResponse.json(
      { error: 'Failed to reject application', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}


import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { cookies } from 'next/headers';
import { createServerClient } from '@supabase/ssr';

export async function POST(req: Request) {
  try {
    // Parse form data
    const formData = await req.formData();
    const tinNumber = formData.get('tinNumber') as string;
    const birnNumber = formData.get('birnNumber') as string;
    const dtiFile = formData.get('dtiFile') as File;
    const businessPermitFile = formData.get('businessPermitFile') as File;
    const secFile = formData.get('secFile') as File;
    const nbiFile = formData.get('nbiFile') as File;

    if (!tinNumber || !birnNumber || !dtiFile || !businessPermitFile || !secFile || !nbiFile) {
      return NextResponse.json(
        { error: 'All documents are required' },
        { status: 400 }
      );
    }

    // Get authenticated user from session
    const cookieStore = await cookies();
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          get(name: string) {
            return cookieStore.get(name)?.value;
          },
          set() {},
          remove() {},
        },
      }
    );

    const { data: { user }, error: userError } = await supabase.auth.getUser();

    if (userError || !user) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    // Get recruiter record
    const { data: recruiter, error: recruiterError } = await supabaseAdmin
      .from('agency_recruiters')
      .select('id, agency_id, role')
      .eq('user_id', user.id)
      .single();

    if (recruiterError || !recruiter) {
      return NextResponse.json(
        { error: 'Recruiter profile not found' },
        { status: 404 }
      );
    }

    // Only admin/owner can upload documents
    if (!['admin', 'owner'].includes(recruiter.role)) {
      return NextResponse.json(
        { error: 'Only agency admins can upload documents' },
        { status: 403 }
      );
    }

    const agencyId = recruiter.agency_id;

    // Upload files to Supabase storage
    const bucket = 'agency-documents';

    // Helper function to upload file
    const uploadFile = async (file: File, folder: string): Promise<string> => {
      const fileExt = file.name.split('.').pop();
      const fileName = `${agencyId}/${folder}/${Date.now()}.${fileExt}`;
      const fileBuffer = Buffer.from(await file.arrayBuffer());

      const { data, error } = await supabaseAdmin.storage
        .from(bucket)
        .upload(fileName, fileBuffer, {
          contentType: file.type,
          upsert: true,
        });

      if (error) {
        console.error(`Failed to upload ${folder}:`, error);
        throw new Error(`Failed to upload ${folder}`);
      }

      // Get public URL
      const { data: { publicUrl } } = supabaseAdmin.storage
        .from(bucket)
        .getPublicUrl(data.path);

      return publicUrl;
    };

    // Upload all documents
    const [dtiUrl, businessPermitUrl, secUrl, nbiUrl] = await Promise.all([
      uploadFile(dtiFile, 'dti'),
      uploadFile(businessPermitFile, 'business-permit'),
      uploadFile(secFile, 'sec'),
      uploadFile(nbiFile, 'nbi'),
    ]);

    // Update agency record with document URLs
    const { error: updateError } = await supabaseAdmin
      .from('agencies')
      .update({
        tin_number: tinNumber,
        birn_number: birnNumber,
        dti_certificate_url: dtiUrl,
        business_permit_url: businessPermitUrl,
        sec_registration_url: secUrl,
        nbi_clearance_url: nbiUrl,
        documents_uploaded_at: new Date().toISOString(),
        documents_verified: false,
      })
      .eq('id', agencyId);

    if (updateError) {
      console.error('Failed to update agency:', updateError);
      return NextResponse.json(
        { error: 'Failed to save document information' },
        { status: 500 }
      );
    }

    // Update recruiter verification status
    const { error: statusError } = await supabaseAdmin
      .from('agency_recruiters')
      .update({
        verification_status: 'pending_admin_review',
        profile_completion_percentage: 100,
      })
      .eq('id', recruiter.id);

    if (statusError) {
      console.error('Failed to update recruiter status:', statusError);
    }

    console.log('✅ Documents uploaded successfully:', {
      agencyId,
      recruiter_id: recruiter.id,
      documents: {
        dti: dtiUrl,
        businessPermit: businessPermitUrl,
        sec: secUrl,
        nbi: nbiUrl,
      },
    });

    // Trigger AI verification in the background (fire and forget)
    // The admin verify-documents endpoint handles the full pipeline:
    // Document AI extraction → Gemini analysis → auto-approve if confident
    const baseUrl = process.env.NEXT_PUBLIC_ADMIN_URL || 'https://admin.bpoc.io';
    fetch(`${baseUrl}/api/agencies/${agencyId}/verify-documents`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-internal-trigger': 'auto-verify-on-upload',
      },
    }).then(res => {
      console.log(`🤖 [AUTO-VERIFY] Triggered for agency ${agencyId}, status: ${res.status}`);
    }).catch(err => {
      console.error(`🤖 [AUTO-VERIFY] Failed to trigger for agency ${agencyId}:`, err.message);
    });

    return NextResponse.json({
      message: 'Documents uploaded successfully. AI verification in progress.',
      agencyId,
      verificationStatus: 'processing',
    }, { status: 200 });

  } catch (error) {
    console.error('Document Upload API Error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    );
  }
}

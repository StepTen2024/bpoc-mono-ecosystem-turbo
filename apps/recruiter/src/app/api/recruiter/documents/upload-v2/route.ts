import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { cookies } from 'next/headers';
import { createServerClient } from '@supabase/ssr';

const GEMINI_API_KEY = process.env.GOOGLE_GENERATIVE_AI_API_KEY;

interface ExtractedDocData {
  documentType: string;
  company_name: string | null;
  registrationNumber: string | null;
  tinNumber: string | null;
  dateIssued: string | null;
  expiryDate: string | null;
  isExpired: boolean;
  businessType: string | null;
  isBpoRelated: boolean;
  address: string | null;
  city: string | null;
  province: string | null;
  officerNames: string[];
  foundedYear: number | null;
  employeeCount: string | null;
  confidence: 'HIGH' | 'MEDIUM' | 'LOW';
  issues: string[];
}

const EXTRACTION_PROMPT = `You are a Philippine business document verification AI for BPOC, a BPO recruitment platform.

Analyze this uploaded business document and extract ALL verifiable information.

Return a JSON object with these exact fields:
{
  "documentType": "The document type: SEC Certificate | BIR Certificate/Form 2303 | Business Permit | Authority to Operate | DTI Certificate | Unknown",
  "companyName": "Company/business name exactly as written, or null",
  "registrationNumber": "Primary registration/reference/certificate number, or null",
  "tinNumber": "TIN (Tax Identification Number) if visible, format XXX-XXX-XXX-XXXXX, or null",
  "dateIssued": "Date issued in YYYY-MM-DD format, or null",
  "expiryDate": "Expiry/validity end date in YYYY-MM-DD format, or null",
  "isExpired": false,
  "businessType": "Line of business / business purpose as stated, or null",
  "isBpoRelated": true if business type mentions BPO/outsourcing/IT services/call center/data processing,
  "address": "Full business address as written, or null",
  "city": "City extracted from address, or null",
  "province": "Province/region extracted from address, or null",
  "officerNames": ["Names of officers/incorporators/signatories visible"],
  "foundedYear": Year of incorporation/registration as integer, or null,
  "employeeCount": null,
  "confidence": "HIGH if clearly a real PH government document, MEDIUM if partially readable, LOW if suspicious/unreadable",
  "issues": ["List any problems: expired, unreadable, potential tampering, etc"]
}

IMPORTANT:
- Extract EVERYTHING you can see. Every detail matters.
- For BIR Form 2303, the TIN is the most critical field.
- For SEC, the registration number and company name are critical.
- For Business Permit / Authority to Operate, check expiry date.
- If document appears to be from Clark Development Corporation (CDC), it's an Authority to Operate which counts as a Business Permit.
- Return clean JSON only, no markdown.`;

async function extractDocumentData(file: File): Promise<ExtractedDocData> {
  const buffer = Buffer.from(await file.arrayBuffer());
  const base64 = buffer.toString('base64');
  const mimeType = file.type || 'application/pdf';

  // For PDFs, we still send as-is — Gemini handles PDFs
  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-pro:generateContent?key=${GEMINI_API_KEY}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{
          parts: [
            { text: EXTRACTION_PROMPT },
            { inline_data: { mime_type: mimeType, data: base64 } }
          ]
        }],
        generationConfig: { response_mime_type: 'application/json' }
      }),
    }
  );

  if (!response.ok) {
    const errText = await response.text();
    console.error('Gemini extraction error:', errText);
    throw new Error(`Gemini API returned ${response.status}`);
  }

  const result = await response.json();
  const parsed = JSON.parse(result.candidates[0].content.parts[0].text);
  const data = Array.isArray(parsed) ? parsed[0] : parsed;

  // Check expiry
  let isExpired = false;
  if (data.expiryDate) {
    try {
      isExpired = new Date(data.expiryDate) < new Date();
    } catch { /* ignore */ }
  }

  return {
    ...data,
    isExpired,
    confidence: data.confidence || 'LOW',
    issues: data.issues || [],
    officerNames: data.officerNames || [],
  };
}

function crossCheckDocuments(docs: ExtractedDocData[]): {
  companyNameConsistent: boolean;
  company_name: string | null;
  tinNumber: string | null;
  address: string | null;
  city: string | null;
  province: string | null;
  businessType: string | null;
  isBpoCompany: boolean;
  foundedYear: number | null;
  registrationNumbers: Record<string, string>;
  overallConfidence: number;
  overallStatus: 'VERIFIED' | 'NEEDS_REVIEW' | 'REJECTED';
  issues: string[];
} {
  const issues: string[] = [];

  // Collect company names
  const names = docs.map(d => d.company_name?.toLowerCase().replace(/[^a-z0-9]/g, '')).filter(Boolean);
  const uniqueNames = [...new Set(names)];
  const companyNameConsistent = uniqueNames.length <= 1;
  if (!companyNameConsistent) {
    issues.push(`Company name mismatch: ${docs.map(d => d.company_name).filter(Boolean).join(' vs ')}`);
  }

  // Best company name (prefer SEC/DTI)
  const companyName = docs.find(d => d.documentType?.includes('SEC') || d.documentType?.includes('DTI'))?.company_name
    || docs.find(d => d.company_name)?.company_name || null;

  // TIN from BIR
  const tinNumber = docs.find(d => d.tinNumber)?.tinNumber || null;

  // Address (prefer business permit)
  const address = docs.find(d => d.documentType?.includes('Permit') || d.documentType?.includes('Authority'))?.address
    || docs.find(d => d.address)?.address || null;
  const city = docs.find(d => d.city)?.city || null;
  const province = docs.find(d => d.province)?.province || null;

  // Business type
  const businessType = docs.find(d => d.businessType)?.businessType || null;
  const isBpoCompany = docs.some(d => d.isBpoRelated);
  if (!isBpoCompany) {
    issues.push('No document confirms BPO/outsourcing as the business type');
  }

  // Founded year from SEC
  const foundedYear = docs.find(d => d.foundedYear)?.foundedYear || null;

  // Registration numbers
  const registrationNumbers: Record<string, string> = {};
  for (const doc of docs) {
    if (doc.registrationNumber) {
      const type = doc.documentType?.includes('SEC') ? 'sec'
        : doc.documentType?.includes('DTI') ? 'dti'
        : doc.documentType?.includes('BIR') ? 'bir'
        : doc.documentType?.includes('Permit') || doc.documentType?.includes('Authority') ? 'business_permit'
        : 'other';
      registrationNumbers[type] = doc.registrationNumber;
    }
  }

  // Expired docs
  const expiredDocs = docs.filter(d => d.isExpired);
  if (expiredDocs.length > 0) {
    issues.push(`Expired documents detected: ${expiredDocs.map(d => d.documentType).join(', ')}`);
  }

  // Low confidence docs
  const lowConf = docs.filter(d => d.confidence === 'LOW');
  if (lowConf.length > 0) {
    issues.push(`Low confidence documents: ${lowConf.map(d => d.documentType).join(', ')}`);
  }

  // Calculate score
  let score = 100;
  for (const doc of docs) {
    if (doc.confidence === 'LOW') score -= 25;
    else if (doc.confidence === 'MEDIUM') score -= 10;
    if (doc.isExpired) score -= 15;
    if (doc.issues.length > 0) score -= doc.issues.length * 3;
  }
  if (!companyNameConsistent) score -= 20;
  if (!isBpoCompany) score -= 10;
  score = Math.max(0, Math.min(100, score));

  let overallStatus: 'VERIFIED' | 'NEEDS_REVIEW' | 'REJECTED';
  if (score >= 75 && companyNameConsistent && expiredDocs.length === 0 && lowConf.length === 0) {
    overallStatus = 'VERIFIED';
  } else if (score >= 40) {
    overallStatus = 'NEEDS_REVIEW';
  } else {
    overallStatus = 'REJECTED';
  }

  return {
    companyNameConsistent,
    company_name: companyName,
    tinNumber,
    address,
    city,
    province,
    businessType,
    isBpoCompany,
    foundedYear,
    registrationNumbers,
    overallConfidence: score,
    overallStatus,
    issues,
  };
}

export async function POST(req: Request) {
  try {
    if (!GEMINI_API_KEY) {
      return NextResponse.json({ error: 'AI service not configured' }, { status: 500 });
    }

    const formData = await req.formData();
    const doc1 = formData.get('doc1') as File | null; // SEC or DTI
    const doc2 = formData.get('doc2') as File | null; // BIR
    const doc3 = formData.get('doc3') as File | null; // Business Permit / ATO

    // Need at least 2 of 3 (SEC/DTI might not apply to all)
    const docs = [doc1, doc2, doc3].filter(Boolean) as File[];
    if (docs.length < 2) {
      return NextResponse.json(
        { error: 'Please upload at least 2 documents' },
        { status: 400 }
      );
    }

    // Get authenticated user
    const cookieStore = await cookies();
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          get(name: string) { return cookieStore.get(name)?.value; },
          set() {},
          remove() {},
        },
      }
    );

    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    // Get recruiter
    const { data: recruiter, error: recruiterError } = await supabaseAdmin
      .from('agency_recruiters')
      .select('id, agency_id, role')
      .eq('user_id', user.id)
      .single();

    if (recruiterError || !recruiter) {
      return NextResponse.json({ error: 'Recruiter profile not found' }, { status: 404 });
    }

    if (!['admin', 'owner'].includes(recruiter.role)) {
      return NextResponse.json({ error: 'Only agency admins can upload documents' }, { status: 403 });
    }

    const agencyId = recruiter.agency_id;
    const bucket = 'agency-documents';

    console.log(`📄 [UPLOAD-V2] Processing ${docs.length} documents for agency ${agencyId}`);

    // Step 1: Upload all files to Supabase Storage
    const uploadFile = async (file: File, index: number): Promise<string> => {
      const fileExt = file.name.split('.').pop() || 'pdf';
      const fileName = `${agencyId}/doc-${index + 1}/${Date.now()}.${fileExt}`;
      const fileBuffer = Buffer.from(await file.arrayBuffer());

      const { data, error } = await supabaseAdmin.storage
        .from(bucket)
        .upload(fileName, fileBuffer, {
          contentType: file.type,
          upsert: true,
        });

      if (error) throw new Error(`Failed to upload document ${index + 1}: ${error.message}`);

      const { data: { publicUrl } } = supabaseAdmin.storage
        .from(bucket)
        .getPublicUrl(data.path);

      return publicUrl;
    };

    // Upload all in parallel
    const uploadPromises = docs.map((file, i) => uploadFile(file, i));
    const urls = await Promise.all(uploadPromises);

    console.log(`☁️ [UPLOAD-V2] Files uploaded to storage:`, urls);

    // Step 2: Extract data from all docs with Gemini Vision (parallel)
    console.log(`🤖 [UPLOAD-V2] Running AI extraction on ${docs.length} documents...`);
    const extractions = await Promise.all(docs.map(file => extractDocumentData(file)));

    console.log(`🔍 [UPLOAD-V2] Extraction results:`, extractions.map(e => ({
      type: e.documentType,
      company: e.company_name,
      tin: e.tinNumber,
      confidence: e.confidence,
    })));

    // Step 3: Cross-check and verify
    const verification = crossCheckDocuments(extractions);

    console.log(`✅ [UPLOAD-V2] Verification: ${verification.overallStatus} (${verification.overallConfidence}%)`);

    // Step 4: Determine which URL is which based on extraction
    let secUrl: string | null = null;
    let dtiUrl: string | null = null;
    let birUrl: string | null = null;
    let businessPermitUrl: string | null = null;

    for (let i = 0; i < extractions.length; i++) {
      const docType = extractions[i].documentType?.toLowerCase() || '';
      if (docType.includes('sec')) secUrl = urls[i];
      else if (docType.includes('dti')) dtiUrl = urls[i];
      else if (docType.includes('bir') || docType.includes('2303')) birUrl = urls[i];
      else if (docType.includes('permit') || docType.includes('authority')) businessPermitUrl = urls[i];
      else {
        // Fallback: assign by position
        if (i === 0) secUrl = urls[i]; // First slot is SEC/DTI
        else if (i === 1) birUrl = urls[i]; // Second slot is BIR
        else if (i === 2) businessPermitUrl = urls[i]; // Third slot is Permit
      }
    }

    // Step 5: Build the full verification result for storage
    const verificationResult = {
      overallConfidence: verification.overallConfidence,
      overallStatus: verification.overallStatus,
      documents: extractions.map((ext, i) => ({
        ...ext,
        file_url: urls[i],
        originalFileName: docs[i].name,
      })),
      crossCheck: {
        companyNameConsistent: verification.companyNameConsistent,
        isBpoCompany: verification.isBpoCompany,
        issues: verification.issues,
      },
      extractedProfile: {
        company_name: verification.company_name,
        tinNumber: verification.tinNumber,
        address: verification.address,
        city: verification.city,
        province: verification.province,
        businessType: verification.businessType,
        foundedYear: verification.foundedYear,
        registrationNumbers: verification.registrationNumbers,
      },
      verifiedAt: new Date().toISOString(),
    };

    // Step 6: Update agency record
    const agencyUpdate: Record<string, unknown> = {
      documents_uploaded_at: new Date().toISOString(),
      document_verification: verificationResult,
      document_verification_at: new Date().toISOString(),
    };

    // Set doc URLs
    if (secUrl) agencyUpdate.sec_registration_url = secUrl;
    if (dtiUrl) agencyUpdate.dti_certificate_url = dtiUrl;
    if (birUrl) {
      // We don't have a bir_url column yet, store in document_verification
    }
    if (businessPermitUrl) agencyUpdate.business_permit_url = businessPermitUrl;

    // Auto-fill from extracted data
    if (verification.tinNumber) agencyUpdate.tin_number = verification.tinNumber;
    if (verification.address) agencyUpdate.address = verification.address;
    if (verification.city) agencyUpdate.city = verification.city;
    agencyUpdate.country = 'Philippines';

    // If auto-verified, mark as verified
    if (verification.overallStatus === 'VERIFIED') {
      agencyUpdate.documents_verified = true;
      agencyUpdate.documents_verified_at = new Date().toISOString();
      agencyUpdate.is_verified = true;
    } else {
      agencyUpdate.documents_verified = false;
    }

    const { error: updateError } = await supabaseAdmin
      .from('agencies')
      .update(agencyUpdate)
      .eq('id', agencyId);

    if (updateError) {
      console.error('Failed to update agency:', updateError);
      return NextResponse.json({ error: 'Failed to save document information' }, { status: 500 });
    }

    // Step 7: Update agency_profiles with extracted data
    if (verification.address || verification.foundedYear) {
      const profileUpdate: Record<string, unknown> = {};
      if (verification.address) profileUpdate.address_line1 = verification.address;
      if (verification.city) profileUpdate.city = verification.city;
      if (verification.province) profileUpdate.state = verification.province;
      profileUpdate.country = 'Philippines';
      if (verification.foundedYear) profileUpdate.founded_year = verification.foundedYear;
      if (verification.businessType) profileUpdate.description = verification.businessType;

      await supabaseAdmin
        .from('agency_profiles')
        .update(profileUpdate)
        .eq('agency_id', agencyId);
    }

    // Step 8: Update recruiter verification status
    const newStatus = verification.overallStatus === 'VERIFIED'
      ? 'verified'
      : 'pending_admin_review';

    await supabaseAdmin
      .from('agency_recruiters')
      .update({
        verification_status: newStatus,
        profile_completion_percentage: 100,
      })
      .eq('id', recruiter.id);

    // If fully verified, update ALL recruiters in this agency
    if (verification.overallStatus === 'VERIFIED') {
      await supabaseAdmin
        .from('agency_recruiters')
        .update({ verification_status: 'verified' })
        .eq('agency_id', agencyId);
    }

    console.log(`🎉 [UPLOAD-V2] Complete! Agency ${agencyId}: ${verification.overallStatus} (${verification.overallConfidence}%)`);

    return NextResponse.json({
      success: true,
      verification: {
        status: verification.overallStatus,
        confidence: verification.overallConfidence,
        company_name: verification.company_name,
        tinNumber: verification.tinNumber,
        issues: verification.issues,
        extractedProfile: verificationResult.extractedProfile,
      },
    });

  } catch (error) {
    console.error('Upload V2 Error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    );
  }
}

import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase/admin';
import { requireAdmin, getAdminFromSession } from '@/lib/admin-helpers';
import { logAdminAction } from '@/lib/admin-audit';

const GEMINI_API_KEY = process.env.GOOGLE_GENERATIVE_AI_API_KEY;

interface DocumentVerification {
  documentType: string;
  expectedType: string;
  isCorrectType: boolean;
  companyName: string | null;
  registrationNumber: string | null;
  tinNumber: string | null;
  dateIssued: string | null;
  expiryDate: string | null;
  isExpired: boolean;
  businessType: string | null;
  isBpoRelated: boolean;
  address: string | null;
  officerNames: string[];
  confidence: 'HIGH' | 'MEDIUM' | 'LOW';
  issues: string[];
  extractedText: string;
}

interface VerificationResult {
  overallConfidence: number;
  overallStatus: 'VERIFIED' | 'NEEDS_REVIEW' | 'REJECTED';
  documents: Record<string, DocumentVerification>;
  crossCheckResults: {
    companyNameConsistent: boolean;
    tinConsistent: boolean;
    addressConsistent: boolean;
    isBpoCompany: boolean;
    allDocsValid: boolean;
    issues: string[];
  };
  verifiedAt: string;
}

const DOCUMENT_ANALYSIS_PROMPT = `You are a Philippine business document verification AI for BPOC, a BPO recruitment platform.

Analyze this uploaded business document image and extract all verifiable information.

Return a JSON object with these exact fields:
{
  "documentType": "The actual document type you see (SEC Certificate, BIR COR/Form 2303, Business Permit/Mayor's Permit, DTI Registration, NBI Clearance, PEZA Certificate, or Unknown)",
  "companyName": "Company/business name as written on document, or null",
  "registrationNumber": "Primary registration/reference number on the document, or null",
  "tinNumber": "TIN if visible on document, or null",
  "dateIssued": "Date issued in YYYY-MM-DD format, or null",
  "expiryDate": "Expiry/validity date in YYYY-MM-DD format, or null",
  "businessType": "Line of business / business purpose as stated, or null",
  "address": "Business address as written, or null",
  "officerNames": ["List of officer/signatory names visible"],
  "confidence": "HIGH if clearly a real PH government document with readable details, MEDIUM if partially readable or slightly unclear, LOW if not a valid document, unreadable, or fake",
  "issues": ["List any problems: expired, unreadable sections, potential tampering, wrong document type, not a business document, etc"],
  "isBpoRelated": true/false,
  "extractedText": "Brief summary of key text visible on the document"
}

IMPORTANT RULES:
- BPOs should have SEC registration (corporations), NOT DTI (sole proprietors). Flag DTI for BPOs as unusual.
- BIR COR (Form 2303) must show a TIN and line of business
- Business Permit / Mayor's Permit should be current year (check expiry)
- NBI Clearance is for individual officers, verify it has a name and clearance number
- If the image is NOT a Philippine business document (random photo, screenshot, blank page), set confidence to LOW and explain in issues
- Look for signs of document tampering (inconsistent fonts, misaligned text, obvious edits)
- BPO-related business types include: BPO, outsourcing, call center, contact center, IT services, information technology, business process, KPO, shared services, back office, customer service, technical support, virtual assistance`;

// Google Document AI configuration
const DOCUMENT_AI_ENDPOINT = 'https://us-documentai.googleapis.com/v1';
const FORM_PARSER_PROCESSOR = 'projects/155785088759/locations/us/processors/ee9a8694c07404ef';

async function getGoogleAccessToken(): Promise<string> {
  const keyData = process.env.GOOGLE_SERVICE_ACCOUNT_KEY;
  if (!keyData) throw new Error('GOOGLE_SERVICE_ACCOUNT_KEY not configured');
  
  let key: any;
  try {
    const decoded = Buffer.from(keyData, 'base64').toString('utf-8');
    key = JSON.parse(decoded);
  } catch {
    key = JSON.parse(keyData);
  }

  const crypto = await import('crypto');
  const now = Math.floor(Date.now() / 1000);
  const header = Buffer.from(JSON.stringify({ alg: 'RS256', typ: 'JWT' })).toString('base64url');
  const payload = Buffer.from(JSON.stringify({
    iss: key.client_email,
    scope: 'https://www.googleapis.com/auth/cloud-platform',
    aud: 'https://oauth2.googleapis.com/token',
    iat: now,
    exp: now + 3600,
  })).toString('base64url');

  const signer = crypto.createSign('RSA-SHA256');
  signer.update(`${header}.${payload}`);
  const signature = signer.sign(key.private_key, 'base64url');
  const jwt = `${header}.${payload}.${signature}`;

  const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: `grant_type=urn:ietf:params:oauth:grant-type:jwt-bearer&assertion=${jwt}`,
  });
  const tokenData = await tokenResponse.json();
  if (!tokenData.access_token) throw new Error('Failed to get Google access token');
  return tokenData.access_token;
}

async function extractWithDocumentAI(base64Content: string, mimeType: string): Promise<{ text: string; formFields: Array<{ name: string; value: string }> }> {
  try {
    const token = await getGoogleAccessToken();
    const response = await fetch(`${DOCUMENT_AI_ENDPOINT}/${FORM_PARSER_PROCESSOR}:process`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        rawDocument: { content: base64Content, mimeType },
      }),
    });

    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      console.error('[DocumentAI] Error:', err?.error?.message);
      return { text: '', formFields: [] };
    }

    const result = await response.json();
    const document = result.document || {};
    const text = document.text || '';
    
    const formFields: Array<{ name: string; value: string }> = [];
    for (const page of document.pages || []) {
      for (const field of page.formFields || []) {
        const getFieldText = (anchor: any) => {
          if (!anchor?.textSegments?.length) return '';
          return anchor.textSegments
            .map((seg: any) => text.substring(parseInt(seg.startIndex || '0'), parseInt(seg.endIndex || '0')))
            .join('').trim();
        };
        const fieldName = getFieldText(field.fieldName?.textAnchor);
        const fieldValue = getFieldText(field.fieldValue?.textAnchor);
        if (fieldName || fieldValue) formFields.push({ name: fieldName, value: fieldValue });
      }
    }

    console.log(`[DocumentAI] ✅ Extracted ${text.length} chars, ${formFields.length} form fields`);
    return { text, formFields };
  } catch (error: any) {
    console.error('[DocumentAI] Extraction failed:', error.message);
    return { text: '', formFields: [] };
  }
}

async function analyzeDocument(
  imageUrl: string,
  expectedType: string
): Promise<DocumentVerification> {
  if (!GEMINI_API_KEY) {
    throw new Error('GOOGLE_GENERATIVE_AI_API_KEY not configured');
  }

  try {
    // Fetch the image and convert to base64
    const imageResponse = await fetch(imageUrl);
    if (!imageResponse.ok) {
      return {
        documentType: 'Unknown',
        expectedType,
        isCorrectType: false,
        companyName: null,
        registrationNumber: null,
        tinNumber: null,
        dateIssued: null,
        expiryDate: null,
        isExpired: false,
        businessType: null,
        isBpoRelated: false,
        address: null,
        officerNames: [],
        confidence: 'LOW',
        issues: ['Failed to fetch document image — URL may be invalid or expired'],
        extractedText: '',
      };
    }

    const imageBuffer = await imageResponse.arrayBuffer();
    const base64Image = Buffer.from(imageBuffer).toString('base64');
    const mimeType = imageResponse.headers.get('content-type') || 'image/jpeg';

    // Step 1: Extract text with Google Document AI (accurate OCR)
    const docAIResult = await extractWithDocumentAI(base64Image, mimeType);
    const docAIContext = docAIResult.text 
      ? `\n\nDOCUMENT AI EXTRACTED TEXT (high-accuracy OCR):\n${docAIResult.text.substring(0, 3000)}\n\nFORM FIELDS:\n${docAIResult.formFields.map(f => `${f.name}: ${f.value}`).join('\n').substring(0, 1000)}`
      : '';

    // Step 2: Send to Gemini for intelligent analysis (with both image + extracted text)
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-pro:generateContent?key=${GEMINI_API_KEY}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{
            parts: [
              { text: DOCUMENT_ANALYSIS_PROMPT + docAIContext },
              { inline_data: { mime_type: mimeType, data: base64Image } }
            ]
          }],
          generationConfig: { response_mime_type: 'application/json' }
        }),
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Gemini API error:', errorText);
      throw new Error(`Gemini API returned ${response.status}`);
    }

    const result = await response.json();
    const parsed = JSON.parse(result.candidates[0].content.parts[0].text);
    
    // Handle array response (Gemini sometimes wraps in array)
    const data = Array.isArray(parsed) ? parsed[0] : parsed;

    // Determine if document type matches expected
    const typeMap: Record<string, string[]> = {
      'sec': ['SEC Certificate', 'SEC Registration', 'Certificate of Incorporation'],
      'bir': ['BIR COR', 'BIR Certificate', 'Form 2303', 'BIR COR/Form 2303'],
      'business_permit': ['Business Permit', "Mayor's Permit", 'Municipal Permit'],
      'dti': ['DTI Registration', 'DTI Certificate'],
      'nbi': ['NBI Clearance'],
      'peza': ['PEZA Certificate', 'PEZA Registration'],
    };

    const expectedTypes = typeMap[expectedType] || [];
    const isCorrectType = expectedTypes.some(t => 
      data.documentType?.toLowerCase().includes(t.toLowerCase())
    );

    // Check expiry
    let isExpired = false;
    if (data.expiryDate) {
      try {
        isExpired = new Date(data.expiryDate) < new Date();
      } catch { /* ignore parse errors */ }
    }

    return {
      documentType: data.documentType || 'Unknown',
      expectedType,
      isCorrectType,
      companyName: data.companyName || null,
      registrationNumber: data.registrationNumber || null,
      tinNumber: data.tinNumber || null,
      dateIssued: data.dateIssued || null,
      expiryDate: data.expiryDate || null,
      isExpired,
      businessType: data.businessType || null,
      isBpoRelated: data.isBpoRelated ?? false,
      address: data.address || null,
      officerNames: data.officerNames || [],
      confidence: data.confidence || 'LOW',
      issues: data.issues || [],
      extractedText: data.extractedText || '',
    };
  } catch (error) {
    console.error(`Document analysis failed for ${expectedType}:`, error);
    return {
      documentType: 'Error',
      expectedType,
      isCorrectType: false,
      companyName: null,
      registrationNumber: null,
      tinNumber: null,
      dateIssued: null,
      expiryDate: null,
      isExpired: false,
      businessType: null,
      isBpoRelated: false,
      address: null,
      officerNames: [],
      confidence: 'LOW',
      issues: [`Analysis failed: ${error instanceof Error ? error.message : 'Unknown error'}`],
      extractedText: '',
    };
  }
}

function crossCheckDocuments(docs: Record<string, DocumentVerification>): VerificationResult['crossCheckResults'] {
  const issues: string[] = [];
  
  // Collect company names from all docs
  const companyNames = Object.values(docs)
    .map(d => d.companyName?.toLowerCase().trim())
    .filter(Boolean) as string[];
  
  // Check company name consistency
  const uniqueNames = [...new Set(companyNames)];
  const companyNameConsistent = uniqueNames.length <= 1;
  if (!companyNameConsistent) {
    issues.push(`Company name mismatch across documents: ${uniqueNames.join(' vs ')}`);
  }

  // Check TIN consistency
  const tins = Object.values(docs)
    .map(d => d.tinNumber?.replace(/[^0-9]/g, ''))
    .filter(Boolean) as string[];
  const uniqueTins = [...new Set(tins)];
  const tinConsistent = uniqueTins.length <= 1;
  if (!tinConsistent) {
    issues.push(`TIN mismatch across documents: ${uniqueTins.join(' vs ')}`);
  }

  // Check address consistency (loose match)
  const addresses = Object.values(docs)
    .map(d => d.address?.toLowerCase().trim())
    .filter(Boolean) as string[];
  const addressConsistent = addresses.length <= 1 || 
    addresses.every(a => addresses[0] && a.includes(addresses[0].substring(0, 20)));
  if (!addressConsistent) {
    issues.push('Business address varies across documents');
  }

  // Check if any document confirms BPO business
  const isBpoCompany = Object.values(docs).some(d => d.isBpoRelated);
  if (!isBpoCompany) {
    issues.push('No document confirms BPO/outsourcing as the line of business');
  }

  // Check all docs are valid
  const allDocsValid = Object.values(docs).every(d => 
    d.confidence !== 'LOW' && d.isCorrectType && !d.isExpired
  );

  // Check for expired docs
  const expiredDocs = Object.entries(docs)
    .filter(([, d]) => d.isExpired)
    .map(([key]) => key);
  if (expiredDocs.length > 0) {
    issues.push(`Expired documents: ${expiredDocs.join(', ')}`);
  }

  // Check for wrong document types
  const wrongTypes = Object.entries(docs)
    .filter(([, d]) => !d.isCorrectType && d.confidence !== 'LOW')
    .map(([key, d]) => `${key}: expected ${d.expectedType}, got ${d.documentType}`);
  if (wrongTypes.length > 0) {
    issues.push(`Wrong document types: ${wrongTypes.join('; ')}`);
  }

  // Check for low confidence docs
  const lowConfDocs = Object.entries(docs)
    .filter(([, d]) => d.confidence === 'LOW')
    .map(([key]) => key);
  if (lowConfDocs.length > 0) {
    issues.push(`Low confidence documents (may not be valid): ${lowConfDocs.join(', ')}`);
  }

  // BPO-specific: SEC > DTI for corporations
  if (docs.dti?.isCorrectType && !docs.sec?.isCorrectType) {
    issues.push('DTI Registration found but BPOs typically need SEC Registration (corporations, not sole proprietors)');
  }

  return {
    companyNameConsistent,
    tinConsistent,
    addressConsistent,
    isBpoCompany,
    allDocsValid,
    issues,
  };
}

function calculateOverallConfidence(
  docs: Record<string, DocumentVerification>,
  crossCheck: VerificationResult['crossCheckResults']
): number {
  let score = 100;

  // Document confidence scores
  for (const doc of Object.values(docs)) {
    if (doc.confidence === 'LOW') score -= 25;
    else if (doc.confidence === 'MEDIUM') score -= 10;
    if (!doc.isCorrectType) score -= 15;
    if (doc.isExpired) score -= 15;
    if (doc.issues.length > 0) score -= doc.issues.length * 3;
  }

  // Cross-check penalties
  if (!crossCheck.companyNameConsistent) score -= 20;
  if (!crossCheck.tinConsistent) score -= 15;
  if (!crossCheck.isBpoCompany) score -= 10;
  if (!crossCheck.addressConsistent) score -= 5;

  return Math.max(0, Math.min(100, score));
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireAdmin();
    const admin = await getAdminFromSession();
    const { id: agencyId } = await params;

    // Fetch agency with document URLs
    const { data: agency, error: agencyError } = await supabase
      .from('agencies')
      .select('*')
      .eq('id', agencyId)
      .single();

    if (agencyError || !agency) {
      return NextResponse.json({ error: 'Agency not found' }, { status: 404 });
    }

    // Check which documents are uploaded
    const documentUrls: Record<string, string> = {};
    if (agency.sec_registration_url) documentUrls.sec = agency.sec_registration_url;
    if (agency.dti_certificate_url) documentUrls.dti = agency.dti_certificate_url;
    if (agency.business_permit_url) documentUrls.business_permit = agency.business_permit_url;
    if (agency.nbi_clearance_url) documentUrls.nbi = agency.nbi_clearance_url;

    if (Object.keys(documentUrls).length === 0) {
      return NextResponse.json(
        { error: 'No documents uploaded for this agency' },
        { status: 400 }
      );
    }

    console.log(`🔍 [DOC-VERIFY] Starting AI verification for agency ${agency.name} (${agencyId})`);
    console.log(`📄 [DOC-VERIFY] Documents to analyze: ${Object.keys(documentUrls).join(', ')}`);

    // Analyze all documents in parallel
    const docEntries = Object.entries(documentUrls);
    const analyses = await Promise.all(
      docEntries.map(([type, url]) => analyzeDocument(url, type))
    );

    // Build results map
    const documents: Record<string, DocumentVerification> = {};
    docEntries.forEach(([type], i) => {
      documents[type] = analyses[i];
    });

    // Cross-check all documents
    const crossCheckResults = crossCheckDocuments(documents);

    // Calculate overall confidence
    const overallConfidence = calculateOverallConfidence(documents, crossCheckResults);

    // Determine status
    let overallStatus: VerificationResult['overallStatus'];
    if (overallConfidence >= 80 && crossCheckResults.allDocsValid && crossCheckResults.companyNameConsistent) {
      overallStatus = 'VERIFIED';
    } else if (overallConfidence >= 50) {
      overallStatus = 'NEEDS_REVIEW';
    } else {
      overallStatus = 'REJECTED';
    }

    const result: VerificationResult = {
      overallConfidence,
      overallStatus,
      documents,
      crossCheckResults,
      verifiedAt: new Date().toISOString(),
    };

    console.log(`✅ [DOC-VERIFY] Result: ${overallStatus} (${overallConfidence}%) for ${agency.name}`);

    // Store verification results on the agency
    const updateData: Record<string, any> = {
      document_verification: result,
      document_verification_at: new Date().toISOString(),
    };

    // AUTO-APPROVE: If AI is confident (VERIFIED status), approve the agency automatically
    // Only flag for manual review if confidence is low or issues found
    if (overallStatus === 'VERIFIED') {
      updateData.is_verified = true;
      updateData.documents_verified = true;
      updateData.documents_verified_at = new Date().toISOString();
      updateData.documents_verified_by = admin.adminId;
      
      console.log(`🎉 [DOC-VERIFY] AUTO-APPROVED agency "${agency.name}" (${overallConfidence}% confidence)`);

      // Update all recruiters in this agency to verified status
      await supabase
        .from('agency_recruiters')
        .update({ 
          verification_status: 'verified',
          is_active: true,
        })
        .eq('agency_id', agencyId);
      
      console.log(`✅ [DOC-VERIFY] All recruiters for "${agency.name}" set to verified`);
    }

    await supabase
      .from('agencies')
      .update(updateData)
      .eq('id', agencyId);

    // Log the action
    await logAdminAction({
      adminId: admin.adminId,
      adminName: admin.adminName,
      action: 'verify_documents_ai',
      entityType: 'agency',
      entityId: agencyId,
      entityName: agency.name,
      details: {
        overallConfidence,
        overallStatus,
        documentsAnalyzed: Object.keys(documentUrls),
      },
    });

    return NextResponse.json({
      success: true,
      result,
    });

  } catch (error) {
    console.error('Document verification error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Verification failed' },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/agencies/[id]/verify-documents
 * Admin approve or reject agency documents
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: agencyId } = await params;
    const body = await request.json();
    const { action } = body;

    if (!action || !['approve', 'reject'].includes(action)) {
      return NextResponse.json({ error: 'Invalid action. Must be "approve" or "reject".' }, { status: 400 });
    }

    // Authenticate via Bearer token OR cookies
    let adminId = 'system';
    let adminName = 'System Admin';

    const authHeader = request.headers.get('authorization');
    if (authHeader?.startsWith('Bearer ')) {
      const token = authHeader.replace('Bearer ', '');
      const { data: { user }, error: authError } = await supabase.auth.getUser(token);
      if (authError || !user) {
        return NextResponse.json({ error: 'Unauthorized: Invalid token' }, { status: 401 });
      }
      // Verify admin role
      const { data: bpocUser, error: roleError } = await supabase
        .from('bpoc_users')
        .select('id, role, first_name, last_name')
        .eq('email', user.email)
        .single();
      if (roleError || !bpocUser || (bpocUser.role !== 'admin' && bpocUser.role !== 'super_admin')) {
        return NextResponse.json({ error: 'Unauthorized: Not an admin' }, { status: 403 });
      }
      adminId = bpocUser.id;
      adminName = `${bpocUser.first_name || ''} ${bpocUser.last_name || ''}`.trim() || user.email?.split('@')[0] || 'Admin';
    } else {
      // Fallback to cookie auth
      try {
        await requireAdmin();
        const admin = await getAdminFromSession();
        adminId = admin.adminId;
        adminName = admin.adminName;
      } catch {
        return NextResponse.json({ error: 'Unauthorized: Not authenticated' }, { status: 401 });
      }
    }

    const admin = { adminId, adminName };

    // Verify agency exists
    const { data: agency, error: agencyError } = await supabase
      .from('agencies')
      .select('id, name')
      .eq('id', agencyId)
      .single();

    if (agencyError || !agency) {
      return NextResponse.json({ error: 'Agency not found' }, { status: 404 });
    }

    if (action === 'approve') {
      // Fetch full agency with document_verification to extract profile data
      const { data: fullAgency } = await supabase
        .from('agencies')
        .select('*, agency_profiles(*)')
        .eq('id', agencyId)
        .single();

      const docVerification = fullAgency?.document_verification as Record<string, unknown> | null;
      const extractedProfile = docVerification?.extractedProfile as Record<string, unknown> | null;

      // Build agency update with extracted data
      const agencyUpdate: Record<string, unknown> = {
        is_verified: true,
        documents_verified: true,
        documents_verified_at: new Date().toISOString(),
        documents_verified_by: admin.adminId,
        updated_at: new Date().toISOString(),
      };

      // Auto-fill agency fields from AI extraction
      if (extractedProfile) {
        if (extractedProfile.companyName && !fullAgency?.name?.includes('Test')) {
          agencyUpdate.name = extractedProfile.companyName;
        }
        if (extractedProfile.tinNumber) agencyUpdate.tin_number = extractedProfile.tinNumber;
        if (extractedProfile.address) agencyUpdate.address = extractedProfile.address;
        if (extractedProfile.city) agencyUpdate.city = extractedProfile.city;
        agencyUpdate.country = 'Philippines';

        // Save registration numbers
        const regNums = extractedProfile.registrationNumbers as Record<string, string> | null;
        if (regNums?.sec) agencyUpdate.sec_registration_number = regNums.sec;
        if (regNums?.business_permit) agencyUpdate.business_permit_number = regNums.business_permit;
      }

      // Extract earliest expiry date from documents for tracking
      const documents = (docVerification?.documents as Array<Record<string, unknown>>) || [];
      const expiryDates = documents
        .filter(d => d.expiryDate && typeof d.expiryDate === 'string')
        .map(d => d.expiryDate as string)
        .sort();
      if (expiryDates.length > 0) {
        agencyUpdate.document_expiry_date = expiryDates[0]; // earliest expiry
        // Also set specific permit expiry if available
        const permitDoc = documents.find(d => 
          (d.documentType as string)?.toLowerCase().includes('permit') || 
          (d.documentType as string)?.toLowerCase().includes('authority')
        );
        if (permitDoc?.expiryDate) {
          agencyUpdate.business_permit_expiry = permitDoc.expiryDate;
        }
      }

      const { error: updateError } = await supabase
        .from('agencies')
        .update(agencyUpdate)
        .eq('id', agencyId);

      if (updateError) {
        console.error('Error approving agency documents:', updateError);
        return NextResponse.json({ error: 'Failed to approve documents' }, { status: 500 });
      }

      // Auto-fill agency_profiles from extracted data
      if (extractedProfile) {
        const profileUpdate: Record<string, unknown> = {};
        if (extractedProfile.address) profileUpdate.address_line1 = extractedProfile.address;
        if (extractedProfile.city) profileUpdate.city = extractedProfile.city;
        if (extractedProfile.province) profileUpdate.state = extractedProfile.province;
        profileUpdate.country = 'Philippines';
        if (extractedProfile.foundedYear) profileUpdate.founded_year = extractedProfile.foundedYear;
        if (extractedProfile.businessType) profileUpdate.description = extractedProfile.businessType;

        const existingProfile = fullAgency?.agency_profiles?.[0];
        if (existingProfile) {
          await supabase
            .from('agency_profiles')
            .update(profileUpdate)
            .eq('agency_id', agencyId);
        } else {
          await supabase
            .from('agency_profiles')
            .insert({ agency_id: agencyId, ...profileUpdate });
        }
      }

      // Update all agency_recruiters verification_status to 'verified'
      await supabase
        .from('agency_recruiters')
        .update({ verification_status: 'verified' })
        .eq('agency_id', agencyId);

      // Send email notification to all recruiters in this agency
      const { data: recruiters } = await supabase
        .from('agency_recruiters')
        .select('email, first_name')
        .eq('agency_id', agencyId);

      if (recruiters && recruiters.length > 0) {
        // Fire and forget - don't block the response
        Promise.all(recruiters.map(async (r) => {
          try {
            await fetch(`${process.env.NEXT_PUBLIC_SITE_URL || 'https://www.bpoc.io'}/api/email/send`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                to: r.email,
                subject: '🎉 Your Agency Has Been Verified! - BPOC',
                html: `
                  <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
                    <div style="background: linear-gradient(135deg, #10b981, #14b8a6); padding: 30px; border-radius: 12px; text-align: center; margin-bottom: 20px;">
                      <h1 style="color: white; margin: 0; font-size: 24px;">🚀 You're Verified!</h1>
                      <p style="color: rgba(255,255,255,0.9); margin: 10px 0 0;">Your agency is now fully active on BPOC</p>
                    </div>
                    <p>Hi ${r.first_name || 'there'},</p>
                    <p>Great news! <strong>${agency.name}</strong> has been verified and your account is now fully active.</p>
                    <p><strong>Here's what you can do now:</strong></p>
                    <ul>
                      <li>👥 Add your clients</li>
                      <li>💼 Post job listings</li>
                      <li>🔍 Browse the talent pool</li>
                      <li>📊 Manage your recruitment pipeline</li>
                    </ul>
                    <div style="text-align: center; margin: 30px 0;">
                      <a href="https://www.bpoc.io/recruiter" style="background: linear-gradient(135deg, #f97316, #f59e0b); color: white; padding: 14px 28px; border-radius: 8px; text-decoration: none; font-weight: bold; display: inline-block;">Go to Dashboard →</a>
                    </div>
                    <p style="color: #888; font-size: 12px;">— The BPOC Team</p>
                  </div>
                `,
              }),
            });
          } catch (emailErr) {
            console.error(`Failed to send verification email to ${r.email}:`, emailErr);
          }
        })).catch(err => console.error('Email batch error:', err));
      }

      await logAdminAction({
        adminId: admin.adminId,
        adminName: admin.adminName,
        action: 'approve_documents',
        entityType: 'agency',
        entityId: agencyId,
        entityName: agency.name,
        details: { action: 'approve' },
      });

      console.log(`✅ [DOC-VERIFY] Admin ${admin.adminName} APPROVED documents for ${agency.name}`);

      return NextResponse.json({ success: true, action: 'approved' });

    } else {
      // Reject: clear verified flags
      const { error: updateError } = await supabase
        .from('agencies')
        .update({
          is_verified: false,
          documents_verified: false,
          updated_at: new Date().toISOString(),
        })
        .eq('id', agencyId);

      if (updateError) {
        console.error('Error rejecting agency documents:', updateError);
        return NextResponse.json({ error: 'Failed to reject documents' }, { status: 500 });
      }

      await logAdminAction({
        adminId: admin.adminId,
        adminName: admin.adminName,
        action: 'reject_documents',
        entityType: 'agency',
        entityId: agencyId,
        entityName: agency.name,
        details: { action: 'reject' },
      });

      console.log(`❌ [DOC-VERIFY] Admin ${admin.adminName} REJECTED documents for ${agency.name}`);

      return NextResponse.json({ success: true, action: 'rejected' });
    }

  } catch (error) {
    console.error('Document action error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Action failed' },
      { status: 500 }
    );
  }
}

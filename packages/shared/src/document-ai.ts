/**
 * Google Document AI Service
 * 
 * Uses Document AI Form Parser for structured extraction from business documents.
 * Falls back to Gemini 2.5 Pro for intelligent verification/cross-referencing.
 * 
 * Processors (GCP Project: ai-agents-clark):
 *   Form Parser: projects/155785088759/locations/us/processors/ee9a8694c07404ef
 *   OCR:         projects/155785088759/locations/us/processors/e5a9a8c6bb7762ca
 */

const DOCUMENT_AI_ENDPOINT = 'https://us-documentai.googleapis.com/v1';
const FORM_PARSER_PROCESSOR = 'projects/155785088759/locations/us/processors/ee9a8694c07404ef';
const OCR_PROCESSOR = 'projects/155785088759/locations/us/processors/e5a9a8c6bb7762ca';

// Environment variables needed:
// GOOGLE_SERVICE_ACCOUNT_KEY - base64-encoded service account JSON key
// GOOGLE_GENERATIVE_AI_API_KEY - for Gemini verification step

interface DocumentAIResult {
  text: string;
  pages: number;
  entities: Array<{
    type: string;
    mentionText: string;
    confidence: number;
  }>;
  formFields: Array<{
    fieldName: string;
    fieldValue: string;
    confidence: number;
  }>;
}

interface VerificationResult {
  documentType: string;
  companyName: string | null;
  registrationNumber: string | null;
  tinNumber: string | null;
  dateIssued: string | null;
  expiryDate: string | null;
  issuingAuthority: string | null;
  extractedText: string;
  confidence: number;
  status: 'valid' | 'suspicious' | 'unreadable';
  issues: string[];
  rawData: Record<string, any>;
}

/**
 * Get Google OAuth2 access token from service account key
 */
async function getAccessToken(serviceAccountKey?: string): Promise<string> {
  const keyData = serviceAccountKey || process.env.GOOGLE_SERVICE_ACCOUNT_KEY;
  
  if (!keyData) {
    throw new Error('GOOGLE_SERVICE_ACCOUNT_KEY environment variable not set');
  }

  // Decode the service account key
  let key: any;
  try {
    const decoded = Buffer.from(keyData, 'base64').toString('utf-8');
    key = JSON.parse(decoded);
  } catch {
    // Maybe it's already JSON
    key = JSON.parse(keyData);
  }

  // Create JWT for token exchange
  const now = Math.floor(Date.now() / 1000);
  const header = Buffer.from(JSON.stringify({ alg: 'RS256', typ: 'JWT' })).toString('base64url');
  const payload = Buffer.from(JSON.stringify({
    iss: key.client_email,
    scope: 'https://www.googleapis.com/auth/cloud-platform',
    aud: 'https://oauth2.googleapis.com/token',
    iat: now,
    exp: now + 3600,
  })).toString('base64url');

  // Sign with private key
  const crypto = await import('crypto');
  const signer = crypto.createSign('RSA-SHA256');
  signer.update(`${header}.${payload}`);
  const signature = signer.sign(key.private_key, 'base64url');
  
  const jwt = `${header}.${payload}.${signature}`;

  // Exchange JWT for access token
  const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: `grant_type=urn:ietf:params:oauth:grant-type:jwt-bearer&assertion=${jwt}`,
  });

  const tokenData = await tokenResponse.json();
  if (!tokenData.access_token) {
    throw new Error(`Failed to get access token: ${JSON.stringify(tokenData)}`);
  }

  return tokenData.access_token;
}

/**
 * Process a document with Document AI Form Parser
 */
export async function extractDocument(
  fileContent: Buffer | string,
  mimeType: string = 'application/pdf',
  processorType: 'form' | 'ocr' = 'form'
): Promise<DocumentAIResult> {
  const token = await getAccessToken();
  const processor = processorType === 'form' ? FORM_PARSER_PROCESSOR : OCR_PROCESSOR;
  
  // Convert to base64 if buffer
  const base64Content = typeof fileContent === 'string' 
    ? fileContent 
    : fileContent.toString('base64');

  const response = await fetch(`${DOCUMENT_AI_ENDPOINT}/${processor}:process`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      rawDocument: {
        content: base64Content,
        mimeType,
      },
    }),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(`Document AI error: ${error?.error?.message || response.statusText}`);
  }

  const result = await response.json();
  const document = result.document || {};

  // Extract form fields
  const formFields: DocumentAIResult['formFields'] = [];
  for (const page of document.pages || []) {
    for (const field of page.formFields || []) {
      const fieldName = field.fieldName?.textAnchor?.content || 
        getTextFromLayout(document.text, field.fieldName?.textAnchor);
      const fieldValue = field.fieldValue?.textAnchor?.content ||
        getTextFromLayout(document.text, field.fieldValue?.textAnchor);
      
      if (fieldName || fieldValue) {
        formFields.push({
          fieldName: (fieldName || '').trim(),
          fieldValue: (fieldValue || '').trim(),
          confidence: field.fieldValue?.confidence || 0,
        });
      }
    }
  }

  // Extract entities
  const entities = (document.entities || []).map((e: any) => ({
    type: e.type || '',
    mentionText: e.mentionText || '',
    confidence: e.confidence || 0,
  }));

  return {
    text: document.text || '',
    pages: (document.pages || []).length,
    entities,
    formFields,
  };
}

/**
 * Helper to extract text from text anchors
 */
function getTextFromLayout(fullText: string, textAnchor: any): string {
  if (!textAnchor?.textSegments?.length) return '';
  
  return textAnchor.textSegments
    .map((seg: any) => fullText.substring(
      parseInt(seg.startIndex || '0'),
      parseInt(seg.endIndex || '0')
    ))
    .join('');
}

/**
 * Verify a business document using Document AI extraction + Gemini analysis
 * 
 * Step 1: Extract text & fields with Document AI (accurate OCR)
 * Step 2: Send extracted text to Gemini for intelligent verification
 */
export async function verifyBusinessDocument(
  fileContent: Buffer | string,
  mimeType: string = 'application/pdf',
  expectedDocumentType?: string,
  agencyName?: string,
): Promise<VerificationResult> {
  // Step 1: Extract with Document AI
  console.log('[DocumentAI] Extracting document...');
  const extraction = await extractDocument(fileContent, mimeType, 'form');
  
  console.log(`[DocumentAI] Extracted ${extraction.text.length} chars, ${extraction.pages} pages, ${extraction.formFields.length} form fields`);

  // Step 2: Analyze with Gemini for intelligent verification
  const geminiKey = process.env.GOOGLE_GENERATIVE_AI_API_KEY;
  if (!geminiKey) {
    // Return basic extraction without Gemini analysis
    return {
      documentType: expectedDocumentType || 'unknown',
      companyName: extractPattern(extraction.text, /(?:name|company|corporation)[:\s]+([A-Z][A-Za-z\s.]+(?:INC|CORP|LLC|CO)?\.?)/i),
      registrationNumber: extractPattern(extraction.text, /(?:reg|registration|certificate)\s*(?:no|number|#)?[.:\s]+([A-Z0-9-]+)/i),
      tinNumber: extractPattern(extraction.text, /(?:TIN|tax.*identification)[:\s]+([0-9-]+)/i),
      dateIssued: null,
      expiryDate: null,
      issuingAuthority: null,
      extractedText: extraction.text,
      confidence: 0.7,
      status: 'valid',
      issues: [],
      rawData: { formFields: extraction.formFields, entities: extraction.entities },
    };
  }

  // Use Gemini to intelligently parse the extracted text
  const geminiResponse = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-pro:generateContent?key=${geminiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{
          parts: [{
            text: `You are a document verification specialist for Philippine business documents. Analyze this extracted text from a scanned document and return a JSON object.

EXTRACTED TEXT:
${extraction.text.substring(0, 4000)}

FORM FIELDS DETECTED:
${extraction.formFields.map(f => `${f.fieldName}: ${f.fieldValue}`).join('\n').substring(0, 2000)}

${agencyName ? `EXPECTED COMPANY NAME: ${agencyName}` : ''}
${expectedDocumentType ? `EXPECTED DOCUMENT TYPE: ${expectedDocumentType}` : ''}

Return ONLY a valid JSON object (no markdown, no code blocks):
{
  "documentType": "SEC Certificate" | "BIR Certificate (Form 2303)" | "DTI Registration" | "Business Permit" | "Authority to Operate" | "NBI Clearance" | "other",
  "companyName": "extracted company name or null",
  "registrationNumber": "extracted registration/certificate number or null",
  "tinNumber": "extracted TIN number or null",
  "dateIssued": "YYYY-MM-DD or null",
  "expiryDate": "YYYY-MM-DD or null",
  "issuingAuthority": "issuing government body or null",
  "confidence": 0.0 to 1.0,
  "status": "valid" | "suspicious" | "unreadable",
  "issues": ["list of any concerns, e.g. 'company name mismatch', 'document appears expired'"],
  "keyFindings": "brief summary of what was found in the document"
}`
          }]
        }],
        generationConfig: {
          temperature: 0.1,
          maxOutputTokens: 1024,
        },
      }),
    }
  );

  if (!geminiResponse.ok) {
    console.error('[DocumentAI] Gemini analysis failed, returning extraction-only result');
    return {
      documentType: expectedDocumentType || 'unknown',
      companyName: null,
      registrationNumber: null,
      tinNumber: null,
      dateIssued: null,
      expiryDate: null,
      issuingAuthority: null,
      extractedText: extraction.text,
      confidence: 0.6,
      status: 'valid',
      issues: ['AI analysis unavailable — manual review recommended'],
      rawData: { formFields: extraction.formFields, entities: extraction.entities },
    };
  }

  const geminiData = await geminiResponse.json();
  const geminiText = geminiData?.candidates?.[0]?.content?.parts?.[0]?.text || '';
  
  // Parse JSON from Gemini response
  let analysis: any = {};
  try {
    // Strip markdown code blocks if present
    const jsonStr = geminiText.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    analysis = JSON.parse(jsonStr);
  } catch (e) {
    console.error('[DocumentAI] Failed to parse Gemini response:', geminiText.substring(0, 200));
    analysis = {};
  }

  return {
    documentType: analysis.documentType || expectedDocumentType || 'unknown',
    companyName: analysis.companyName || null,
    registrationNumber: analysis.registrationNumber || null,
    tinNumber: analysis.tinNumber || null,
    dateIssued: analysis.dateIssued || null,
    expiryDate: analysis.expiryDate || null,
    issuingAuthority: analysis.issuingAuthority || null,
    extractedText: extraction.text,
    confidence: analysis.confidence || 0.5,
    status: analysis.status || 'valid',
    issues: analysis.issues || [],
    rawData: {
      formFields: extraction.formFields,
      entities: extraction.entities,
      geminiAnalysis: analysis,
    },
  };
}

/**
 * Helper to extract patterns from text
 */
function extractPattern(text: string, pattern: RegExp): string | null {
  const match = text.match(pattern);
  return match?.[1]?.trim() || null;
}

/**
 * Verify multiple documents and cross-reference them
 */
export async function verifyAgencyDocuments(
  documents: Array<{
    content: Buffer | string;
    mimeType: string;
    type: string; // 'sec', 'bir', 'business_permit'
  }>,
  agencyName: string,
): Promise<{
  overallStatus: 'verified' | 'needs_review' | 'rejected';
  documents: VerificationResult[];
  crossReferenceIssues: string[];
  summary: string;
}> {
  // Process each document
  const results: VerificationResult[] = [];
  for (const doc of documents) {
    try {
      const result = await verifyBusinessDocument(
        doc.content,
        doc.mimeType,
        doc.type,
        agencyName,
      );
      results.push(result);
    } catch (error: any) {
      results.push({
        documentType: doc.type,
        companyName: null,
        registrationNumber: null,
        tinNumber: null,
        dateIssued: null,
        expiryDate: null,
        issuingAuthority: null,
        extractedText: '',
        confidence: 0,
        status: 'unreadable',
        issues: [`Failed to process: ${error.message}`],
        rawData: {},
      });
    }
  }

  // Cross-reference: check company names match across documents
  const crossReferenceIssues: string[] = [];
  const companyNames = results
    .map(r => r.companyName)
    .filter(Boolean) as string[];
  
  if (companyNames.length > 1) {
    const normalized = companyNames.map(n => n.toLowerCase().replace(/[^a-z0-9]/g, ''));
    const allMatch = normalized.every(n => n === normalized[0]);
    if (!allMatch) {
      crossReferenceIssues.push(`Company names differ across documents: ${companyNames.join(', ')}`);
    }
  }

  // Check if company name matches the agency
  if (agencyName && companyNames.length > 0) {
    const agencyNorm = agencyName.toLowerCase().replace(/[^a-z0-9]/g, '');
    const anyMatch = companyNames.some(n => {
      const norm = n.toLowerCase().replace(/[^a-z0-9]/g, '');
      return norm.includes(agencyNorm) || agencyNorm.includes(norm);
    });
    if (!anyMatch) {
      crossReferenceIssues.push(`Agency name "${agencyName}" doesn't match document company names: ${companyNames.join(', ')}`);
    }
  }

  // Check TIN consistency
  const tins = results.map(r => r.tinNumber).filter(Boolean) as string[];
  if (tins.length > 1) {
    const uniqueTins = [...new Set(tins.map(t => t.replace(/[^0-9]/g, '')))];
    if (uniqueTins.length > 1) {
      crossReferenceIssues.push(`Different TIN numbers found: ${tins.join(', ')}`);
    }
  }

  // Determine overall status
  const hasUnreadable = results.some(r => r.status === 'unreadable');
  const hasSuspicious = results.some(r => r.status === 'suspicious');
  const hasCrossIssues = crossReferenceIssues.length > 0;

  let overallStatus: 'verified' | 'needs_review' | 'rejected' = 'verified';
  if (hasUnreadable || hasSuspicious || hasCrossIssues) {
    overallStatus = 'needs_review';
  }

  const summary = `Processed ${results.length} documents for "${agencyName}". ` +
    `${results.filter(r => r.status === 'valid').length} valid, ` +
    `${results.filter(r => r.status === 'suspicious').length} suspicious, ` +
    `${results.filter(r => r.status === 'unreadable').length} unreadable. ` +
    (crossReferenceIssues.length > 0 ? `Cross-reference issues: ${crossReferenceIssues.join('; ')}` : 'No cross-reference issues.');

  return { overallStatus, documents: results, crossReferenceIssues, summary };
}

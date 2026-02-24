import { NextRequest, NextResponse } from 'next/server';

const GEMINI_API_KEY = process.env.GOOGLE_GENERATIVE_AI_API_KEY;
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

/**
 * POST /api/recruiter/documents/scan
 * 
 * Quick AI scan of an uploaded document using:
 * 1. Google Document AI (Form Parser) for accurate text extraction
 * 2. Gemini 2.5 Pro for intelligent document identification
 */
export async function POST(request: NextRequest) {
  try {
    if (!GEMINI_API_KEY) {
      return NextResponse.json({ error: 'AI service not configured' }, { status: 500 });
    }

    const formData = await request.formData();
    const file = formData.get('file') as File;

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const base64 = buffer.toString('base64');
    const mimeType = file.type || 'application/pdf';

    // Step 1: Extract text with Document AI
    let extractedText = '';
    let formFields: string[] = [];
    try {
      const token = await getGoogleAccessToken();
      const docAIResponse = await fetch(`${DOCUMENT_AI_ENDPOINT}/${FORM_PARSER_PROCESSOR}:process`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ rawDocument: { content: base64, mimeType } }),
      });

      if (docAIResponse.ok) {
        const docAIResult = await docAIResponse.json();
        const doc = docAIResult.document || {};
        extractedText = doc.text || '';
        
        for (const page of doc.pages || []) {
          for (const field of page.formFields || []) {
            const getText = (anchor: any) => {
              if (!anchor?.textSegments?.length) return '';
              return anchor.textSegments
                .map((seg: any) => extractedText.substring(parseInt(seg.startIndex || '0'), parseInt(seg.endIndex || '0')))
                .join('').trim();
            };
            const name = getText(field.fieldName?.textAnchor);
            const value = getText(field.fieldValue?.textAnchor);
            if (name || value) formFields.push(`${name}: ${value}`);
          }
        }
        console.log(`[DocScan] ✅ Document AI extracted ${extractedText.length} chars`);
      }
    } catch (docError: any) {
      console.warn('[DocScan] Document AI extraction failed, falling back to Gemini-only:', docError.message);
    }

    // Step 2: Gemini analysis with extracted text context
    const docAIContext = extractedText 
      ? `\n\nPRE-EXTRACTED TEXT (Google Document AI OCR - high accuracy):\n${extractedText.substring(0, 3000)}\n\nFORM FIELDS:\n${formFields.join('\n').substring(0, 1000)}`
      : '';

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-pro:generateContent?key=${GEMINI_API_KEY}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{
            parts: [
              {
                text: `Quickly identify this Philippine business document. Return JSON:
{
  "documentType": "sec" | "bir" | "business_permit" | "nbi" | "dti" | "peza" | "unknown",
  "label": "Human-readable document name (e.g. 'SEC Certificate of Incorporation', 'BIR Form 2303', 'Mayor's Business Permit')",
  "companyName": "Company name if visible, or null",
  "registrationNumber": "Main registration/reference number, or null",
  "tinNumber": "TIN if visible, or null",
  "isValid": true if this appears to be a real Philippine business/government document,
  "summary": "One-line description of what you see"
}

Document type mappings:
- SEC Certificate / Certificate of Incorporation → "sec"
- BIR COR / Form 2303 / Certificate of Registration → "bir"
- Business Permit / Mayor's Permit → "business_permit"  
- NBI Clearance → "nbi"
- DTI Registration / Certificate → "dti"
- PEZA Certificate → "peza"
- Anything else → "unknown"${docAIContext}`
              },
              { inline_data: { mime_type: mimeType, data: base64 } }
            ]
          }],
          generationConfig: { response_mime_type: 'application/json' }
        }),
      }
    );

    if (!response.ok) {
      console.error('Gemini scan error:', await response.text());
      return NextResponse.json({ error: 'AI scan failed' }, { status: 500 });
    }

    const result = await response.json();
    const parsed = JSON.parse(result.candidates[0].content.parts[0].text);
    const data = Array.isArray(parsed) ? parsed[0] : parsed;

    return NextResponse.json({
      success: true,
      scan: data,
      extraction: {
        textLength: extractedText.length,
        formFieldCount: formFields.length,
        method: extractedText ? 'document_ai+gemini' : 'gemini_only',
      },
    });

  } catch (error) {
    console.error('Document scan error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Scan failed' },
      { status: 500 }
    );
  }
}

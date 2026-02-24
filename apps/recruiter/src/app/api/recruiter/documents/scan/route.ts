import { NextRequest, NextResponse } from 'next/server';

const GEMINI_API_KEY = process.env.GOOGLE_GENERATIVE_AI_API_KEY;

/**
 * POST /api/recruiter/documents/scan
 * 
 * Quick AI scan of an uploaded document to identify what type it is
 * and extract key info. Used during the upload flow to auto-categorize.
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

    // Convert to base64
    const buffer = Buffer.from(await file.arrayBuffer());
    const base64 = buffer.toString('base64');
    const mimeType = file.type || 'image/jpeg';

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
  "label": "Human-readable document name (e.g. 'SEC Certificate of Incorporation', 'BIR Form 2303', 'Mayor\\'s Business Permit')",
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
- Anything else → "unknown"`
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
    });

  } catch (error) {
    console.error('Document scan error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Scan failed' },
      { status: 500 }
    );
  }
}

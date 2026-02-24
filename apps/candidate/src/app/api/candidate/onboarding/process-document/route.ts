import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { getUserFromRequest } from '@/lib/supabase/auth';

// Document type configurations with extraction prompts
const DOC_CONFIGS: Record<string, { fields: string[]; prompt: string }> = {
  gov_id: {
    fields: ['sss', 'tin', 'philhealth_no', 'pagibig_no'],
    prompt: `Extract government ID information from this document image.
Look for any of these ID numbers:
- SSS Number (Social Security System) - format: XX-XXXXXXX-X
- TIN (Tax Identification Number) - format: XXX-XXX-XXX or XXX-XXX-XXX-XXX
- PhilHealth Number - format: XX-XXXXXXXXX-X
- Pag-IBIG/HDMF Number - format: XXXX-XXXX-XXXX

Return ONLY a JSON object with these fields (use null if not found):
{"sss": "...", "tin": "...", "philhealth_no": "...", "pagibig_no": "...", "id_type": "...", "full_name": "..."}`,
  },
  valid_id: {
    fields: ['full_name', 'date_of_birth', 'address', 'id_type', 'id_number'],
    prompt: `Extract personal information from this valid ID (passport, driver's license, national ID, etc).

Return ONLY a JSON object with these fields (use null if not found):
{"full_name": "...", "date_of_birth": "YYYY-MM-DD", "address": "...", "id_type": "...", "id_number": "...", "gender": "male/female"}`,
  },
  education: {
    fields: ['education_level', 'school_name', 'degree', 'year_graduated'],
    prompt: `Extract education information from this document (diploma, transcript, certificate).

Return ONLY a JSON object with these fields (use null if not found):
{"education_level": "high_school/vocational/bachelors/masters/doctorate", "school_name": "...", "degree": "...", "field_of_study": "...", "year_graduated": "YYYY"}`,
  },
  medical: {
    fields: ['medical_cert_valid', 'clinic_name', 'doctor_name', 'issue_date', 'findings'],
    prompt: `Extract information from this medical certificate.

Return ONLY a JSON object with these fields (use null if not found):
{"medical_cert_valid": true/false, "clinic_name": "...", "doctor_name": "...", "issue_date": "YYYY-MM-DD", "findings": "fit to work/with conditions/...", "license_no": "..."}`,
  },
};

// Use Gemini Vision for document processing
async function processWithGeminiVision(imageBase64: string, docType: string): Promise<any> {
  const config = DOC_CONFIGS[docType];
  if (!config) throw new Error(`Unknown document type: ${docType}`);

  const GEMINI_API_KEY = process.env.GOOGLE_GENERATIVE_AI_KEY;
  if (!GEMINI_API_KEY) throw new Error('Gemini API key not configured');

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-pro:generateContent?key=${GEMINI_API_KEY}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{
          parts: [
            { text: config.prompt },
            {
              inline_data: {
                mime_type: 'image/jpeg',
                data: imageBase64.replace(/^data:image\/\w+;base64,/, ''),
              },
            },
          ],
        }],
        generationConfig: {
          temperature: 0.1,
          maxOutputTokens: 1024,
        },
      }),
    }
  );

  if (!response.ok) {
    const error = await response.text();
    console.error('Gemini API error:', error);
    throw new Error('Failed to process document with AI');
  }

  const data = await response.json();
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
  
  // Extract JSON from response
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    console.error('No JSON found in response:', text);
    throw new Error('Could not extract data from document');
  }

  try {
    return JSON.parse(jsonMatch[0]);
  } catch (e) {
    console.error('Failed to parse JSON:', jsonMatch[0]);
    throw new Error('Invalid data format from AI');
  }
}

// POST - Process uploaded document
export async function POST(request: NextRequest) {
  try {
    const user = await getUserFromRequest(request);
    
    const formData = await request.formData();
    const file = formData.get('file') as File;
    const docType = formData.get('docType') as string;
    const onboardingId = formData.get('onboardingId') as string;

    if (!file || !docType) {
      return NextResponse.json({ error: 'Missing file or document type' }, { status: 400 });
    }

    // Validate document type
    if (!DOC_CONFIGS[docType]) {
      return NextResponse.json({ 
        error: 'Invalid document type',
        validTypes: Object.keys(DOC_CONFIGS)
      }, { status: 400 });
    }

    // Convert file to base64
    const bytes = await file.arrayBuffer();
    const base64 = Buffer.from(bytes).toString('base64');

    // Process with Gemini Vision
    console.log(`[Doc Process] Processing ${docType} document for user ${user.id}`);
    const extractedData = await processWithGeminiVision(base64, docType);
    console.log(`[Doc Process] Extracted:`, extractedData);

    // Upload original file to Supabase Storage
    const fileName = `${user.id}/${docType}/${Date.now()}-${file.name}`;
    const { data: uploadData, error: uploadError } = await supabaseAdmin.storage
      .from('onboarding-documents')
      .upload(fileName, Buffer.from(bytes), {
        contentType: file.type,
        upsert: true,
      });

    if (uploadError) {
      console.error('Upload error:', uploadError);
      // Continue even if upload fails - we still have extracted data
    }

    // Get public URL
    const { data: urlData } = supabaseAdmin.storage
      .from('onboarding-documents')
      .getPublicUrl(fileName);

    // If onboardingId provided, update the record with extracted data
    if (onboardingId) {
      const updateFields: Record<string, any> = {};
      
      // Map extracted data to database fields based on doc type
      if (docType === 'gov_id') {
        if (extractedData.sss) updateFields.sss = extractedData.sss;
        if (extractedData.tin) updateFields.tin = extractedData.tin;
        if (extractedData.philhealth_no) updateFields.philhealth_no = extractedData.philhealth_no;
        if (extractedData.pagibig_no) updateFields.pagibig_no = extractedData.pagibig_no;
      } else if (docType === 'valid_id') {
        if (extractedData.full_name) {
          const nameParts = extractedData.full_name.split(' ');
          updateFields.first_name = nameParts[0];
          updateFields.last_name = nameParts.slice(1).join(' ') || nameParts[0];
        }
        if (extractedData.date_of_birth) updateFields.date_of_birth = extractedData.date_of_birth;
        if (extractedData.address) updateFields.address = extractedData.address;
        if (extractedData.gender) updateFields.gender = extractedData.gender.toLowerCase();
        updateFields.valid_id_url = urlData?.publicUrl;
      } else if (docType === 'education') {
        if (extractedData.education_level) updateFields.education_level = extractedData.education_level;
        updateFields.education_doc_url = urlData?.publicUrl;
      } else if (docType === 'medical') {
        updateFields.medical_cert_url = urlData?.publicUrl;
        if (extractedData.findings) updateFields.medical_notes = extractedData.findings;
      }

      if (Object.keys(updateFields).length > 0) {
        const { error: updateError } = await supabaseAdmin
          .from('candidate_onboarding')
          .update(updateFields)
          .eq('id', onboardingId)
          .eq('candidate_id', user.id); // Security: ensure user owns this record

        if (updateError) {
          console.error('Update error:', updateError);
        }
      }
    }

    // Auto-process: AI decides approve/flag/review
    let autoResult = null;
    if (onboardingId) {
      const { autoProcessDocument } = await import('@/lib/onboarding/auto-processor');
      autoResult = await autoProcessDocument(onboardingId, docType, extractedData);
      console.log(`[Doc Process] Auto-process result:`, autoResult);
    }

    return NextResponse.json({
      success: true,
      docType,
      extractedData,
      documentUrl: urlData?.publicUrl,
      autoProcess: autoResult,
      message: autoResult?.action === 'auto_approved' 
        ? 'Document auto-approved! ✓' 
        : autoResult?.action === 'flagged'
        ? 'Document flagged for review'
        : 'Document processed successfully',
    });

  } catch (error: any) {
    console.error('[Doc Process] Error:', error);
    return NextResponse.json({ 
      error: error.message || 'Failed to process document' 
    }, { status: 500 });
  }
}

// GET - Get supported document types
export async function GET() {
  return NextResponse.json({
    documentTypes: Object.entries(DOC_CONFIGS).map(([type, config]) => ({
      type,
      fields: config.fields,
    })),
  });
}

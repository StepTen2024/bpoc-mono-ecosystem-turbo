/**
 * Document Processor Engine
 * Uses Gemini Vision to classify and extract data from documents
 */

import { DOCUMENT_TYPES, DOCUMENT_CLASSIFICATION_PROMPT, DocumentTypeConfig } from './document-types';

interface ClassificationResult {
  document_type: string;
  confidence: number;
  detected_text?: string;
}

interface ExtractionResult {
  success: boolean;
  document_type: string;
  extracted_data: Record<string, any>;
  confidence_scores: Record<string, number>;
  error?: string;
}

const GEMINI_API_KEY = process.env.GOOGLE_GENERATIVE_AI_KEY;

/**
 * Classify a document image to determine its type
 */
export async function classifyDocument(imageBase64: string): Promise<ClassificationResult> {
  if (!GEMINI_API_KEY) throw new Error('Gemini API key not configured');

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_API_KEY}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{
          parts: [
            { text: DOCUMENT_CLASSIFICATION_PROMPT },
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
          maxOutputTokens: 512,
        },
      }),
    }
  );

  if (!response.ok) {
    const error = await response.text();
    console.error('Gemini classification error:', error);
    throw new Error('Failed to classify document');
  }

  const data = await response.json();
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
  
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    return { document_type: 'unknown', confidence: 0 };
  }

  try {
    return JSON.parse(jsonMatch[0]);
  } catch {
    return { document_type: 'unknown', confidence: 0 };
  }
}

/**
 * Extract data from a document using its type-specific prompt
 */
export async function extractDocumentData(
  imageBase64: string,
  documentType: string
): Promise<ExtractionResult> {
  if (!GEMINI_API_KEY) throw new Error('Gemini API key not configured');

  const docConfig = DOCUMENT_TYPES[documentType];
  if (!docConfig) {
    return {
      success: false,
      document_type: documentType,
      extracted_data: {},
      confidence_scores: {},
      error: `Unknown document type: ${documentType}`,
    };
  }

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_API_KEY}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{
          parts: [
            { text: docConfig.aiPrompt },
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
    console.error('Gemini extraction error:', error);
    return {
      success: false,
      document_type: documentType,
      extracted_data: {},
      confidence_scores: {},
      error: 'Failed to extract data from document',
    };
  }

  const data = await response.json();
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
  
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    return {
      success: false,
      document_type: documentType,
      extracted_data: {},
      confidence_scores: {},
      error: 'Could not extract data from document',
    };
  }

  try {
    const extracted = JSON.parse(jsonMatch[0]);
    
    // Generate confidence scores (simplified - all fields get same score)
    const confidenceScores: Record<string, number> = {};
    for (const field of docConfig.extractableFields) {
      if (extracted[field] !== null && extracted[field] !== undefined) {
        confidenceScores[field] = 0.9; // High confidence if extracted
      }
    }

    return {
      success: true,
      document_type: documentType,
      extracted_data: extracted,
      confidence_scores: confidenceScores,
    };
  } catch {
    return {
      success: false,
      document_type: documentType,
      extracted_data: {},
      confidence_scores: {},
      error: 'Invalid data format from AI',
    };
  }
}

/**
 * Process a document: classify and extract in one go
 */
export async function processDocument(imageBase64: string, hintType?: string): Promise<{
  classification: ClassificationResult;
  extraction: ExtractionResult;
  points: number;
}> {
  // Step 1: Classify (or use hint)
  let classification: ClassificationResult;
  
  if (hintType && DOCUMENT_TYPES[hintType]) {
    classification = { document_type: hintType, confidence: 1.0 };
  } else {
    classification = await classifyDocument(imageBase64);
  }

  // Step 2: Extract data using detected type
  const extraction = await extractDocumentData(imageBase64, classification.document_type);

  // Step 3: Get points
  const docConfig = DOCUMENT_TYPES[classification.document_type];
  const points = docConfig?.points || 0;

  return {
    classification,
    extraction,
    points,
  };
}

/**
 * Validate extracted data across multiple documents
 * Check for consistency in names, DOBs, etc.
 */
export function crossValidateDocuments(
  documents: Array<{ type: string; extracted: Record<string, any> }>
): {
  isValid: boolean;
  warnings: string[];
  matchedFields: Record<string, string>;
} {
  const warnings: string[] = [];
  const matchedFields: Record<string, string> = {};

  // Collect all names and DOBs
  const names: string[] = [];
  const dobs: string[] = [];
  const sssNumbers: string[] = [];
  const tinNumbers: string[] = [];

  for (const doc of documents) {
    if (doc.extracted.full_name) {
      names.push(doc.extracted.full_name.toUpperCase().trim());
    }
    if (doc.extracted.date_of_birth) {
      dobs.push(doc.extracted.date_of_birth);
    }
    if (doc.extracted.sss_number) {
      sssNumbers.push(doc.extracted.sss_number.replace(/\D/g, ''));
    }
    if (doc.extracted.tin_number) {
      tinNumbers.push(doc.extracted.tin_number.replace(/\D/g, ''));
    }
  }

  // Check name consistency
  if (names.length > 1) {
    const uniqueNames = [...new Set(names)];
    if (uniqueNames.length > 1) {
      // Allow for minor variations (married names, suffixes)
      const baseName = uniqueNames[0].split(' ').slice(0, 2).join(' ');
      const mismatches = uniqueNames.filter(n => !n.includes(baseName.split(' ')[0]));
      if (mismatches.length > 0) {
        warnings.push(`Name mismatch detected across documents: ${uniqueNames.join(' vs ')}`);
      }
    }
    matchedFields.full_name = names[0];
  }

  // Check DOB consistency
  if (dobs.length > 1) {
    const uniqueDobs = [...new Set(dobs)];
    if (uniqueDobs.length > 1) {
      warnings.push(`Date of birth mismatch: ${uniqueDobs.join(' vs ')}`);
    }
    matchedFields.date_of_birth = dobs[0];
  }

  // Check SSS consistency
  if (sssNumbers.length > 1) {
    const uniqueSss = [...new Set(sssNumbers)];
    if (uniqueSss.length > 1) {
      warnings.push(`SSS number mismatch: ${sssNumbers.join(' vs ')}`);
    }
    matchedFields.sss_number = sssNumbers[0];
  }

  // Check TIN consistency
  if (tinNumbers.length > 1) {
    const uniqueTin = [...new Set(tinNumbers)];
    if (uniqueTin.length > 1) {
      warnings.push(`TIN number mismatch: ${tinNumbers.join(' vs ')}`);
    }
    matchedFields.tin_number = tinNumbers[0];
  }

  return {
    isValid: warnings.length === 0,
    warnings,
    matchedFields,
  };
}

/**
 * Determine if a document can be auto-verified
 */
export function canAutoVerify(
  extraction: ExtractionResult,
  classification: ClassificationResult
): { canAutoVerify: boolean; reason: string } {
  // Must have high classification confidence
  if (classification.confidence < 0.85) {
    return { canAutoVerify: false, reason: 'Low classification confidence' };
  }

  // Must have successful extraction
  if (!extraction.success) {
    return { canAutoVerify: false, reason: 'Extraction failed' };
  }

  // Must have key fields extracted
  const docConfig = DOCUMENT_TYPES[classification.document_type];
  if (!docConfig) {
    return { canAutoVerify: false, reason: 'Unknown document type' };
  }

  // Check if we got at least 50% of expected fields
  const extractedFieldCount = Object.values(extraction.extracted_data).filter(v => v !== null && v !== undefined).length;
  const expectedFieldCount = docConfig.extractableFields.length;
  
  if (extractedFieldCount < expectedFieldCount * 0.5) {
    return { canAutoVerify: false, reason: 'Too few fields extracted' };
  }

  return { canAutoVerify: true, reason: 'All checks passed' };
}

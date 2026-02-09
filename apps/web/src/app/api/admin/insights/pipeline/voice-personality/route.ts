/**
 * AI CONTENT PIPELINE - STAGE 1
 * Voice Personality Capture
 * 
 * Uses Whisper-1 to transcribe voice recordings and create personality profiles
 */

import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';
import { createClient } from '@supabase/supabase-js';
import { logError } from '@/lib/error-logger';
export const maxDuration = 120;
export const preferredRegion = 'iad1';
export const dynamic = 'force-dynamic';
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY!,
});

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const audioFile = formData.get('audio') as File;
    const personalityName = formData.get('name') as string || 'Ate Yna';

    if (!audioFile) {
      return NextResponse.json({ error: 'No audio file provided' }, { status: 400 });
    }

    console.log('🎤 STAGE 1: Voice Personality Capture');
    console.log(`Processing voice for: ${personalityName}`);

    // Step 1: Transcribe with Whisper
    const transcription = await openai.audio.transcriptions.create({
      file: audioFile,
      model: 'whisper-1',
      language: 'en', // Can handle mixed English/Filipino
    });

    console.log('✅ Transcription complete:', transcription.text.slice(0, 100) + '...');

    // Step 2: Analyze personality with Claude
    const personalityAnalysis = await analyzePersonality(transcription.text);

    // Step 3: Upload audio to Supabase Storage
    const audioBuffer = await audioFile.arrayBuffer();
    const audioPath = `personalities/${personalityName.toLowerCase().replace(/\s/g, '-')}-${Date.now()}.webm`;

    const { data: uploadData, error: uploadError } = await supabase.storage
      .from('marketing')
      .upload(`articles/${audioPath}`, audioBuffer, {
        contentType: audioFile.type,
        upsert: false
      });

    if (uploadError) {
      console.error('Upload error:', uploadError);
    }

    const audioUrl = uploadData ? supabase.storage.from('marketing').getPublicUrl(`articles/${audioPath}`).data.publicUrl : null;

    // Step 4: Save to database
    const { data, error } = await supabase
      .from('personality_profiles')
      .upsert({
        name: personalityName,
        voice_recording_url: audioUrl,
        transcription: transcription.text,
        profile_data: personalityAnalysis.profile_data,
        sample_phrases: personalityAnalysis.sample_phrases,
        tone_attributes: personalityAnalysis.tone_attributes,
        is_active: true,
      }, {
        onConflict: 'name'
      })
      .select()
      .single();

    if (error) {
      console.error('Database error:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      personality: data,
      transcription: transcription.text,
      transcript: transcription.text, // Also include as 'transcript' for compatibility
    });

  } catch (error: any) {
    console.error('❌ Voice personality error:', error);

    // Log error to platform error system
    await logError(error, {
      endpoint: '/api/admin/insights/pipeline/voice-personality',
      http_method: 'POST',
      external_service: 'openai',
    });

    return NextResponse.json({
      error: error.message || 'Failed to process voice personality'
    }, { status: 500 });
  }
}

async function analyzePersonality(transcription: string) {
  const prompt = `Analyze this voice description and create a writing personality profile.

Voice Description:
"${transcription}"

Extract and return JSON with:
1. profile_data: warmth level, professionalism, use of Filipino, writing style, target audience
2. sample_phrases: Array of 5-10 characteristic phrases this person would use
3. tone_attributes: friendly, encouraging, insider tips, avoids jargon, etc.

Format as valid JSON only.`;

  const response = await openai.chat.completions.create({
    model: 'gpt-4o-mini',
    messages: [{ role: 'user', content: prompt }],
    response_format: { type: 'json_object' },
  });

  return JSON.parse(response.choices[0].message.content || '{}');
}


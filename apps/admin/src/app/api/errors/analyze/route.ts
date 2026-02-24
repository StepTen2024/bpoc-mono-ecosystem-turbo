/**
 * AI ERROR DIAGNOSIS API
 * 
 * Uses the appropriate AI model to analyze errors and provide:
 * - Root cause analysis
 * - Suggested fixes
 * - Code snippets (if applicable)
 * - Priority recommendation
 * 
 * Decision tree for AI assignment:
 * - API/External Service errors → Claude (best at code/API issues)
 * - Database errors → Claude (SQL expertise)
 * - UI/Design errors → Gemini (visual understanding)
 * - Auth/Security errors → Claude (security expertise)
 * - Rate limits → GPT-4o-mini (quick, simple response)
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import Anthropic from '@anthropic-ai/sdk';
import OpenAI from 'openai';
import { GoogleGenerativeAI } from '@google/generative-ai';

// Lazy initialization to avoid build-time errors
function getSupabaseClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

function getAnthropicClient() {
  return new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! });
}

function getOpenAIClient() {
  return new OpenAI({ apiKey: process.env.OPENAI_API_KEY! });
}

function getGenAIClient() {
  return new GoogleGenerativeAI(process.env.GOOGLE_GENERATIVE_AI_API_KEY!);
}

interface AnalyzeRequest {
  errorId: string;
}

// Determine which AI to use based on error category
function selectAI(category: string, errorMessage: string): { model: string; provider: 'claude' | 'openai' | 'gemini' } {
  const msg = errorMessage.toLowerCase();
  
  // Rate limits and simple errors → GPT-4o-mini (fast, cheap)
  if (category === 'rate_limit' || msg.includes('timeout')) {
    return { model: 'gpt-4o-mini', provider: 'openai' };
  }
  
  // UI/Design errors → Gemini (visual understanding)
  if (category === 'ui' || msg.includes('render') || msg.includes('component') || msg.includes('style')) {
    return { model: 'gemini-2.5-flash', provider: 'gemini' };
  }
  
  // Default to Claude for most errors (best at code)
  return { model: 'claude-sonnet-4-5-20250929', provider: 'claude' };
}

async function analyzeWithClaude(errorData: any): Promise<any> {
  const anthropic = getAnthropicClient();
  const message = await anthropic.messages.create({
    model: 'claude-sonnet-4-5-20250929',
    max_tokens: 2000,
    messages: [{
      role: 'user',
      content: `You are a senior developer debugging an error in a Next.js/TypeScript application.

ERROR DETAILS:
- Message: ${errorData.error_message}
- Code: ${errorData.error_code || 'N/A'}
- Endpoint: ${errorData.endpoint || 'N/A'}
- Category: ${errorData.category}
- Severity: ${errorData.severity}
- External Service: ${errorData.external_service || 'N/A'}
- Stack Trace: ${errorData.error_stack || 'N/A'}
- Request Body: ${JSON.stringify(errorData.request_body || {}).slice(0, 500)}
- Response Body: ${JSON.stringify(errorData.response_body || {}).slice(0, 500)}

Analyze this error and return JSON with:
{
  "root_cause": "Clear explanation of what caused this error",
  "suggested_fix": "Step-by-step instructions to fix it",
  "code_snippet": "Any code changes needed (if applicable)",
  "prevention": "How to prevent this in the future",
  "priority": "critical|high|medium|low",
  "confidence": 0.0-1.0,
  "related_docs": ["URLs to relevant documentation"],
  "estimated_time": "How long to fix (e.g., '15 minutes', '1 hour')"
}

Return ONLY valid JSON.`
    }],
  });

  const content = message.content[0];
  if (content.type === 'text') {
    try {
      return JSON.parse(content.text);
    } catch {
      return { root_cause: content.text, confidence: 0.5 };
    }
  }
  return { root_cause: 'Analysis failed', confidence: 0 };
}

async function analyzeWithOpenAI(errorData: any): Promise<any> {
  const openai = getOpenAIClient();
  const response = await openai.chat.completions.create({
    model: 'gpt-4o-mini',
    response_format: { type: 'json_object' },
    messages: [{
      role: 'user',
      content: `Analyze this error quickly and suggest a fix:

Error: ${errorData.error_message}
Category: ${errorData.category}
Service: ${errorData.external_service || 'N/A'}

Return JSON:
{
  "root_cause": "Brief explanation",
  "suggested_fix": "Quick fix suggestion",
  "priority": "critical|high|medium|low",
  "confidence": 0.0-1.0
}`
    }],
  });

  return JSON.parse(response.choices[0].message.content || '{}');
}

async function analyzeWithGemini(errorData: any): Promise<any> {
  const genAI = getGenAIClient();
  const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });
  
  const result = await model.generateContent(`Analyze this UI/frontend error:

Error: ${errorData.error_message}
Stack: ${errorData.error_stack || 'N/A'}

Return JSON with:
- root_cause
- suggested_fix (with CSS/React code if needed)
- priority
- confidence`);

  const text = result.response.text();
  try {
    // Try to extract JSON from response
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]);
    }
  } catch {}
  
  return { root_cause: text, confidence: 0.5 };
}

export async function POST(req: NextRequest) {
  try {
    const { errorId }: AnalyzeRequest = await req.json();

    const supabase = getSupabaseClient();

    // Get the error
    const { data: errorData, error: fetchError } = await supabase
      .from('platform_errors')
      .select('*')
      .eq('id', errorId)
      .single();

    if (fetchError || !errorData) {
      return NextResponse.json({ success: false, error: 'Error not found' }, { status: 404 });
    }

    // Update status to analyzing
    await supabase
      .from('platform_errors')
      .update({ status: 'analyzing' })
      .eq('id', errorId);

    // Select AI based on error type
    const { model, provider } = selectAI(errorData.category, errorData.error_message);
    console.log(`🤖 Analyzing error with ${provider} (${model})`);

    let diagnosis;
    try {
      switch (provider) {
        case 'claude':
          diagnosis = await analyzeWithClaude(errorData);
          break;
        case 'openai':
          diagnosis = await analyzeWithOpenAI(errorData);
          break;
        case 'gemini':
          diagnosis = await analyzeWithGemini(errorData);
          break;
      }
    } catch (aiError: any) {
      console.error('AI analysis failed:', aiError);
      diagnosis = {
        root_cause: 'AI analysis failed - manual review required',
        suggested_fix: 'Please review the error details manually',
        confidence: 0,
        ai_error: aiError.message,
      };
    }

    // Update error with diagnosis
    const { error: updateError } = await supabase
      .from('platform_errors')
      .update({
        status: 'diagnosed',
        ai_diagnosis: {
          ...diagnosis,
          assigned_ai: provider,
        },
        ai_analyzed_at: new Date().toISOString(),
        ai_model_used: model,
      })
      .eq('id', errorId);

    if (updateError) {
      console.error('Failed to save diagnosis:', updateError);
    }

    return NextResponse.json({
      success: true,
      diagnosis: {
        ...diagnosis,
        model,
        provider,
      },
    });

  } catch (error: any) {
    console.error('Error analysis failed:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

import { verifyAuthToken } from '@/lib/auth/verify-token';
import { supabase } from '@/lib/supabase/admin';

// ... imports ...

// GET: Get stats
export async function GET(req: NextRequest) {
  try {
    // 1. Verify Admin Auth
    const { userId, error: authError } = await verifyAuthToken(req);
    if (!userId) {
      return NextResponse.json({ error: authError || 'Unauthorized' }, { status: 401 });
    }

    // Double check admin role
    const { data: adminUser } = await supabase
      .from('bpoc_users')
      .select('role')
      .eq('id', userId)
      .single();

    if (adminUser?.role !== 'admin' && adminUser?.role !== 'super_admin') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { data, error } = await supabase
      .from('error_stats_view')
      .select('*')
      .single();

    if (error) {
      // View might not exist yet, return empty stats
      return NextResponse.json({
        success: true,
        stats: {
          new_count: 0,
          analyzing_count: 0,
          diagnosed_count: 0,
          in_progress_count: 0,
          resolved_count: 0,
          critical_open: 0,
          high_open: 0,
          errors_24h: 0,
          errors_7d: 0,
        }
      });
    }

    return NextResponse.json({ success: true, stats: data });

  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}


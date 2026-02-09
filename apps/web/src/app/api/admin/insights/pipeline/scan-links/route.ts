/**
 * AI CONTENT PIPELINE - STAGE 8
 * Smart Link Scanner
 * 
 * THE GENIUS FEATURE: Bidirectional link suggestions between articles
 * - Analyzes new article
 * - Finds semantically similar existing articles
 * - Suggests where to add links in BOTH directions
 * - Ensures sentences make sense!
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import Anthropic from '@anthropic-ai/sdk';
import OpenAI from 'openai';
import { logError } from '@/lib/error-logger';
export const maxDuration = 120;
export const preferredRegion = 'iad1';
export const dynamic = 'force-dynamic';
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY!,
});

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY!,
});

interface ScanRequest {
  insightId: string;
  minSimilarity?: number;
}

export async function POST(req: NextRequest) {
  try {
    const body: ScanRequest = await req.json();
    const { insightId, minSimilarity = 0.75 } = body;

    console.log('🔗 STAGE 8: Smart Link Scanner');
    console.log(`Scanning for link opportunities for insight: ${insightId}`);

    const startTime = Date.now();

    // Get the new article
    const { data: newArticle, error: fetchError } = await supabase
      .from('insights_posts')
      .select('*')
      .eq('id', insightId)
      .single();

    if (fetchError || !newArticle) {
      return NextResponse.json({ error: 'Article not found' }, { status: 404 });
    }

    // Step 1: Generate embedding for new article
    const embedding = await generateEmbedding(newArticle.content);

    // Step 2: Store embedding
    await storeEmbedding(insightId, newArticle.content, embedding);

    // Step 3: Find similar articles
    const { data: similarArticles } = await supabase.rpc(
      'get_related_insights_for_linking',
      {
        source_insight_id: insightId,
        match_count: 10,
        min_similarity: minSimilarity,
      }
    );

    if (!similarArticles || similarArticles.length === 0) {
      console.log('No similar articles found');
      return NextResponse.json({
        success: true,
        suggestions: [],
        message: 'No similar articles found',
      });
    }

    console.log(`Found ${similarArticles.length} similar articles`);

    // Step 4: Generate bidirectional link suggestions
    const suggestions = [];
    for (const similar of similarArticles) {
      // Get full article content
      const { data: targetArticle } = await supabase
        .from('insights_posts')
        .select('*')
        .eq('id', similar.insight_id)
        .single();

      if (!targetArticle) continue;

      // Suggest link FROM new TO old
      const forwardSuggestion = await generateLinkSuggestion(
        newArticle,
        targetArticle,
        'forward',
        similar.semantic_keywords
      );

      if (forwardSuggestion) {
        suggestions.push(forwardSuggestion);
      }

      // Suggest link FROM old TO new
      const backwardSuggestion = await generateLinkSuggestion(
        targetArticle,
        newArticle,
        'backward',
        similar.semantic_keywords
      );

      if (backwardSuggestion) {
        suggestions.push(backwardSuggestion);
      }
    }

    // Step 5: Store suggestions
    for (const suggestion of suggestions) {
      await supabase.from('article_links').insert({
        from_article_id: suggestion.source_post_id,
        to_article_id: suggestion.target_post_id,
        anchor_text: suggestion.anchor_text,
        link_type: 'sibling',  // Default to sibling
        context: suggestion.sentence,
      });
    }

    // Step 6: Update article status
    await supabase
      .from('insights_posts')
      .update({
        pipeline_stage: 'ready_for_review',
        generation_metadata: {
          ...newArticle.generation_metadata,
          link_scan_completed_at: new Date().toISOString(),
          article_links_count: suggestions.length,
        },
      })
      .eq('id', insightId);

    // Log execution
    await supabase.from('pipeline_execution_logs').insert({
      insight_id: insightId,
      stage: 'link_scanning',
      model: 'claude-3-5-sonnet-20241022',
      output_data: { suggestions_count: suggestions.length },
      duration_ms: Date.now() - startTime,
      status: 'success',
    });

    return NextResponse.json({
      success: true,
      suggestions: suggestions.map(s => ({
        from: s.source_title,
        to: s.target_title,
        anchor: s.anchor_text,
        direction: s.direction,
      })),
    });

  } catch (error: any) {
    console.error('❌ Link scanning error:', error);
    await logError(error, {
      endpoint: '/api/admin/insights/pipeline/scan-links',
      http_method: 'POST',
      external_service: 'anthropic',
    });
    return NextResponse.json({
      error: error.message || 'Link scanning failed'
    }, { status: 500 });
  }
}

async function generateEmbedding(content: string): Promise<number[]> {
  console.log('📊 Generating embedding...');

  const response = await openai.embeddings.create({
    model: 'text-embedding-3-small',
    input: content.slice(0, 8000), // Truncate if too long
  });

  return response.data[0].embedding;
}

async function storeEmbedding(insightId: string, content: string, embedding: number[]) {
  // Extract semantic keywords
  const keywords = await extractSemanticKeywords(content);

  // Store embedding
  await supabase.from('article_embeddings').insert({
    article_id: insightId,
    chunk_index: 0,
    content: content.slice(0, 1000),
    embedding: JSON.stringify(embedding),
  });
}

async function extractSemanticKeywords(content: string): Promise<string[]> {
  // Simple extraction - can be enhanced
  const words = content
    .toLowerCase()
    .replace(/[^\w\s]/g, '')
    .split(/\s+/)
    .filter(w => w.length > 4);

  const frequency: Record<string, number> = {};
  words.forEach(w => {
    frequency[w] = (frequency[w] || 0) + 1;
  });

  return Object.entries(frequency)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 20)
    .map(([word]) => word);
}

async function generateLinkSuggestion(
  sourceArticle: any,
  targetArticle: any,
  direction: 'forward' | 'backward',
  semanticKeywords: string[]
) {
  console.log(`💡 Generating ${direction} link: ${sourceArticle.title} → ${targetArticle.title}`);

  const message = await anthropic.messages.create({
    model: 'claude-3-5-sonnet-20241022',
    max_tokens: 1000,
    messages: [{
      role: 'user',
      content: `Suggest a natural link insertion from one article to another.

SOURCE ARTICLE:
Title: ${sourceArticle.title}
Content: ${sourceArticle.content.slice(0, 2000)}...

TARGET ARTICLE:
Title: ${targetArticle.title}
Slug: ${targetArticle.slug}
Semantic Keywords: ${semanticKeywords.join(', ')}

TASK:
Find a natural place in the SOURCE article to link to the TARGET article.

Requirements:
1. Find exact sentence in source where link makes sense
2. Suggest natural anchor text (descriptive but not keyword-stuffed)
3. Make sure the sentence flows naturally with the link
4. Provide context before and after (50 chars each)
5. Explain why this link makes sense

Return JSON with:
- sentence: The complete sentence with [anchor text] marked
- anchor_text: Just the anchor text
- context_before: 50 chars before the sentence
- context_after: 50 chars after the sentence
- reasoning: Why this link makes sense
- similarity: How relevant (0.0-1.0)

If no good place found, return null.`
    }],
  });

  const content = message.content[0];
  if (content.type === 'text') {
    try {
      const result = JSON.parse(content.text);
      if (!result || result === null) return null;

      return {
        source_post_id: sourceArticle.id,
        target_post_id: targetArticle.id,
        source_title: sourceArticle.title,
        target_title: targetArticle.title,
        anchor_text: result.anchor_text,
        sentence: result.sentence,
        context_before: result.context_before,
        context_after: result.context_after,
        similarity: result.similarity || 0.8,
        direction,
        reasoning: result.reasoning,
      };
    } catch (error) {
      console.error('Failed to parse link suggestion:', error);
      return null;
    }
  }

  return null;
}


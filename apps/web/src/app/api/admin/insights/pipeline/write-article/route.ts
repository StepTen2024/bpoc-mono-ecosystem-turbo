/**
 * AI CONTENT PIPELINE - STAGE 4: WRITE ARTICLE (STREAMING)
 *
 * MODEL: Claude Sonnet 4 (reliable long-form content)
 * PERSONALITY: Ate Yna (warm Filipino career advisor)
 *
 * STREAMS Server-Sent Events to keep the connection alive and prevent 504 timeouts.
 * Events: progress, token, metrics, complete, error
 */

export const maxDuration = 300;
export const preferredRegion = 'iad1';
export const dynamic = 'force-dynamic';

import { NextRequest } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import Anthropic from '@anthropic-ai/sdk';
import { marked } from 'marked';
import { logError } from '@/lib/error-logger';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const anthropic = new Anthropic({
  apiKey: process.env.CLAUDE_API_KEY!,
});

// Ate Yna personality — kept compact to reduce token costs
const ATE_YNA_PERSONALITY = `# ATE YNA - Filipino Career Ate (Older Sister)

## Background
- Yna Cruz, 38, 15+ years in BPO (CSR → TSR → Team Lead → Training Manager)
- Worked at Concentrix, TELUS International, TaskUs
- Based in BGC, started in Ortigas

## Voice
- Warm, encouraging older sister — professional but never corporate
- Direct and honest, no sugarcoating
- Uses "you" frequently, speaks directly to reader
- Occasional Filipino expressions (natural, not forced): "Kaya mo 'yan!", "Alam mo ba?", "Totoo"
- Contractions: you'll, we'll, that's, here's

## Writing Style
- Short paragraphs (2-4 sentences max), one idea per paragraph
- Mix short punchy sentences with longer explanatory ones (avg 15-20 words)
- Specific examples: real companies (Concentrix, TaskUs), real amounts (₱22,000/month), real locations (Makati, Cebu IT Park)
- NO emojis, NO corporate jargon, NO passive voice, NO condescension

## Formatting (USE THESE)
- **Tables**: | Column | Column | for comparisons, salary ranges
- **Numbered sequences**: **1.** Step one **2.** Step two
- **Callout boxes**: > [TIP] / > [WARNING] / > [KEY] / > [INFO] / > [SUCCESS]
- **Comparison tables**: | Do This ✓ | Avoid This ✗ |
- **Process flows**: Step A → Step B → Step C

## Personal Stories (draw from these)
- First day nerves at Concentrix, hands shaking on first call
- Night shift health tricks after 3 years
- Negotiated ₱7k raise moving from CSR to TSR
- 45-minute screaming customer that taught resilience
- ₱18k to ₱60k in 8 years career growth

## Expertise
- Entry requirements, salary ranges (₱18k-25k entry, ₱30k-50k mid)
- Major companies, career paths, common challenges
- Metro Manila hubs, Cebu IT Park, Davao growth
- Government requirements (SSS, PhilHealth, Pag-IBIG, TIN)
- Resume building, English fluency, soft skills, metrics (CSAT, AHT, QA)`;

interface WriteRequest {
  plan: any;
  research: any;
  originalBrief?: string;
  insightId?: string;
  pipelineId?: string;
}

export async function POST(req: NextRequest) {
  const encoder = new TextEncoder();

  // Helper to send SSE events
  const formatSSE = (event: string, data: any): Uint8Array => {
    return encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
  };

  const stream = new ReadableStream({
    async start(controller) {
      let stepName = 'init';

      try {
        stepName = 'parsing request';
        const body: WriteRequest = await req.json();
        const { plan, research, originalBrief, insightId, pipelineId } = body;

        controller.enqueue(formatSSE('progress', {
          percent: 5,
          message: 'Preparing article brief...',
        }));

        // Get word count config from plan
        const competitorAnalysis = plan?.competitorAnalysis || {};
        const articleType = competitorAnalysis.articleType || 'supporting';
        const isPillar = articleType === 'pillar';
        const minWordCount = competitorAnalysis.minWordCount || (isPillar ? 3000 : 1800);
        const maxWordCount = competitorAnalysis.maxWordCount || (isPillar ? 4000 : 2200);
        const targetWordCount = competitorAnalysis.recommendedWordCount || plan?.targetWordCount || (isPillar ? 3500 : 2000);

        const structure = plan?.structure || {};
        const keywords = plan?.keywords || {};
        const linkStrategy = plan?.linkStrategy || {};
        const writingInstructions = plan?.writingInstructions || {};

        console.log(`✍️ STAGE 4 STREAMING: ${articleType.toUpperCase()} | Target: ${targetWordCount} words`);

        controller.enqueue(formatSSE('progress', {
          percent: 10,
          message: 'Calling Claude Sonnet 4 as Ate Yna...',
        }));

        // Build the prompt
        const prompt = buildPrompt({
          structure, keywords, linkStrategy, writingInstructions,
          originalBrief, isPillar, minWordCount, maxWordCount, targetWordCount, research,
        });

        // Stream from Claude
        stepName = 'streaming from Claude';
        let fullText = '';
        let tokenCount = 0;

        // Estimated characters for target word count (avg 5.5 chars/word + markdown)
        const estimatedChars = targetWordCount * 7;

        // Cap max_tokens based on article type to enforce word count
        // Pillars: generous room (they can go 4000-6000+ words, that's fine for SEO)
        // Supporting: tight cap to keep them focused (1800-2200 words)
        const tokenLimit = isPillar ? 16384 : Math.round(maxWordCount * 1.8);
        console.log(`📊 Token limit: ${tokenLimit} (${isPillar ? 'pillar — uncapped' : `supporting — max ${maxWordCount} words × 1.8`})`);

        const claudeStream = anthropic.messages.stream({
          model: 'claude-sonnet-4-20250514',
          max_tokens: tokenLimit,
          system: `You are Ate Yna, a warm and experienced Filipino career advisor writing articles for BPO workers. Write in a conversational, sisterly tone with practical advice. CRITICAL: Your article MUST be between ${minWordCount}-${maxWordCount} words. You will be cut off if you exceed this — plan your sections accordingly. Budget your words across sections before writing.`,
          messages: [{ role: 'user', content: prompt }],
        });

        // Stream tokens to keep connection alive
        claudeStream.on('text', (text) => {
          fullText += text;
          tokenCount++;

          // Send token event every 20 tokens to avoid overwhelming the client
          if (tokenCount % 20 === 0) {
            const progress = Math.min(85, 15 + Math.round((fullText.length / estimatedChars) * 70));
            controller.enqueue(formatSSE('token', {
              length: fullText.length,
              percent: progress,
            }));
          }
        });

        // Wait for completion
        const finalMessage = await claudeStream.finalMessage();
        console.log(`✅ Claude streaming complete: ${fullText.length} chars`);

        if (!fullText) {
          throw new Error('No response from Claude Sonnet 4');
        }

        // Render HTML
        controller.enqueue(formatSSE('progress', {
          percent: 88,
          message: 'Rendering HTML...',
        }));

        stepName = 'rendering HTML';
        const html = await renderHTML(fullText);

        // Calculate metrics
        controller.enqueue(formatSSE('progress', {
          percent: 92,
          message: 'Calculating quality metrics...',
        }));

        stepName = 'calculating metrics';
        const metrics = calculateMetrics(fullText, plan);

        // Word count warning
        let wordCountWarning: string | null = null;
        if (!metrics.isWithinRange) {
          if (metrics.wordCount > metrics.maxWordCount + 500) {
            wordCountWarning = `⚠️ Article is ${metrics.wordCount} words — exceeds hard ceiling of ${metrics.maxWordCount + 500} by ${metrics.wordCount - (metrics.maxWordCount + 500)} words. Trimming recommended.`;
          } else if (metrics.wordCount > metrics.maxWordCount) {
            wordCountWarning = `⚡ Article is ${metrics.wordCount} words — slightly above ${metrics.maxWordCount} target max. Consider light trimming.`;
          } else if (metrics.wordCount < metrics.minWordCount) {
            wordCountWarning = `⚠️ Article is only ${metrics.wordCount} words — below ${metrics.minWordCount} minimum for ${metrics.articleType} content.`;
          }
        }

        // Save to DB (non-blocking)
        controller.enqueue(formatSSE('progress', {
          percent: 95,
          message: 'Saving to database...',
        }));

        stepName = 'saving to database';
        if (insightId) {
          try {
            await supabase
              .from('insights_posts')
              .update({
                content: fullText,
                pipeline_stage: 'article_review',
                generation_metadata: {
                  ...plan,
                  article_generated_at: new Date().toISOString(),
                  model: 'claude-sonnet-4-20250514',
                  metrics,
                },
                updated_at: new Date().toISOString(),
              })
              .eq('id', insightId);
          } catch (dbErr: any) {
            console.error('DB save error (non-fatal):', dbErr.message);
          }
        }

        if (pipelineId) {
          try {
            await supabase
              .from('content_pipelines')
              .update({
                current_stage: 4,
                article_data: {
                  markdown: fullText,
                  wordCount: metrics.wordCount,
                },
              })
              .eq('id', pipelineId);
          } catch (dbErr: any) {
            console.error('Pipeline save error (non-fatal):', dbErr.message);
          }
        }

        // Send final complete event with all data
        controller.enqueue(formatSSE('complete', {
          success: true,
          article: fullText,
          html,
          metrics,
          wordCount: metrics.wordCount,
          wordCountWarning,
          insightId,
          _meta: {
            targetWordCount: metrics.targetWordCount,
            actualWordCount: metrics.wordCount,
            withinTarget: metrics.isWithinRange,
            articleType: metrics.articleType,
            seoScore: metrics.seoScore,
          },
        }));

        console.log(`✅ Article complete: ${metrics.wordCount} words (target: ${targetWordCount})`);

      } catch (error: any) {
        console.error(`❌ Write-article streaming error at "${stepName}":`, error.message);

        try {
          await logError(error, {
            endpoint: '/api/admin/insights/pipeline/write-article',
            http_method: 'POST',
            external_service: 'claude_sonnet_4',
            step: stepName,
          });
        } catch (logErr) {
          // ignore log failures
        }

        controller.enqueue(formatSSE('error', {
          success: false,
          error: `${stepName}: ${error.message || 'Article writing failed'}`,
        }));
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no', // Disable nginx buffering if present
    },
  });
}

// ──────────────────────────────────────────────────────────
// Prompt builder (extracted for cleanliness)
// ──────────────────────────────────────────────────────────
function buildPrompt(opts: {
  structure: any;
  keywords: any;
  linkStrategy: any;
  writingInstructions: any;
  originalBrief?: string;
  isPillar: boolean;
  minWordCount: number;
  maxWordCount: number;
  targetWordCount: number;
  research: any;
}): string {
  const {
    structure, keywords, linkStrategy, writingInstructions,
    originalBrief, isPillar, minWordCount, maxWordCount, targetWordCount, research,
  } = opts;

  return `You are Ate Yna, writing an article for Filipino BPO workers.

${ATE_YNA_PERSONALITY}

# ARTICLE PLAN

**Title**: ${structure.title || ''}
**H1 Context**: ${structure.h1 || ''} (NOTE: Page template renders H1 automatically. NEVER use # heading in body. Start with ## for all top-level headings.)
**Type**: ${isPillar ? 'PILLAR (comprehensive, in-depth)' : 'SUPPORTING (focused, targeted)'}
**Word Count**: STRICTLY ${minWordCount}-${maxWordCount} words (Target: ${targetWordCount})
**Meta**: ${structure.metaDescription || ''}

> [CRITICAL] This article MUST be ${minWordCount}-${maxWordCount} words. Hard ceiling: ${maxWordCount + 500}.
> ${isPillar ? 'Pillar: comprehensive, authoritative, multiple sections with detailed explanations.' : 'Supporting: focused and concise, adequate depth without padding.'}

${originalBrief ? `## USER'S CORE THESIS:\n"${originalBrief}"\nEvery section must support this perspective.\n` : ''}

## Sections:
${JSON.stringify(structure.sections || [], null, 2)}

## FAQ:
${JSON.stringify(structure.faq || [], null, 2)}

## Keywords:
- Main: ${keywords.main || ''}
- Cluster: ${keywords.cluster?.join(', ') || ''}
- Semantic: ${keywords.semantic?.join(', ') || ''}
- Target Density: ${keywords.targetDensity || '1-2%'}

## Links:
${JSON.stringify(linkStrategy, null, 2)}

## Research:
${JSON.stringify(research?.synthesis || research?.research?.synthesis || {}, null, 2)}

## Writing Style:
- Plagiarism: ${writingInstructions.plagiarismAvoidance?.join('; ') || 'Use original examples'}
- AI Detection: ${writingInstructions.aiDetectionAvoidance?.join('; ') || 'Varied sentence structure'}
- Unique Angles: ${writingInstructions.uniqueAngles?.join('; ') || 'Philippine-specific context'}

# WRITE THE FULL ARTICLE

1. **Intro** (${isPillar ? '200-300' : '150-200'} words) — Hook, problem, promise. Main keyword in first paragraph. NO # heading.
2. **Body** (H2/H3) — Follow sections above. ${isPillar ? '400-600 words per H2.' : '250-400 words per H2.'} Include [TIP]/[WARNING]/[KEY]/[INFO]/[SUCCESS] callouts, tables, lists.
3. **FAQ** (H2: "Frequently Asked Questions") — H3 per question. ${isPillar ? '100-150' : '75-100'} words each.
4. **Conclusion** (${isPillar ? '200-250' : '150-200'} words) — Takeaways, CTA, Ate Yna sign-off.

Links: outbound=[text](URL) <!-- OUTBOUND -->, internal=[text](#) <!-- INTERNAL: topic -->
Target exactly ${targetWordCount} words. Count before finishing.`;
}

// ──────────────────────────────────────────────────────────
// HTML renderer
// ──────────────────────────────────────────────────────────
async function renderHTML(markdown: string): Promise<string> {
  try {
    const html = await marked.parse(markdown, { gfm: true, breaks: true });
    return `<div class="prose prose-invert max-w-none">
      <style>
        .prose p { margin-bottom: 1rem; line-height: 1.75; color: #d1d5db; }
        .prose ul, .prose ol { margin: 1rem 0; padding-left: 1.5rem; }
        .prose li { margin-bottom: 0.5rem; color: #d1d5db; }
        .prose strong { color: #fff; font-weight: 600; }
        .prose h2 { font-size: 1.875rem; font-weight: 700; margin-bottom: 1rem; margin-top: 2rem; color: white; border-bottom: 2px solid #374151; padding-bottom: 0.5rem; }
        .prose h3 { font-size: 1.5rem; font-weight: 600; margin-bottom: 0.75rem; margin-top: 1.5rem; color: #e5e7eb; }
        .prose table { width: 100%; border-collapse: collapse; margin: 1.5rem 0; }
        .prose th, .prose td { padding: 0.75rem 1rem; border: 1px solid #374151; }
        .prose th { background: #1f2937; font-weight: 600; text-align: left; }
        .prose blockquote { border-left: 4px solid #4b5563; padding-left: 1rem; margin: 1rem 0; font-style: italic; color: #9ca3af; }
        .prose a { color: #60a5fa; text-decoration: underline; }
      </style>
      ${html}
    </div>`;
  } catch {
    return `<div class="prose prose-invert max-w-none"><pre>${markdown}</pre></div>`;
  }
}

// ──────────────────────────────────────────────────────────
// Metrics
// ──────────────────────────────────────────────────────────
function calculateMetrics(markdown: string, plan: any) {
  const wordCount = markdown.split(/\s+/).length;
  const competitorAnalysis = plan?.competitorAnalysis || {};
  const articleType = competitorAnalysis.articleType || 'supporting';
  const isPillar = articleType === 'pillar';

  const minWordCount = competitorAnalysis.minWordCount || (isPillar ? 3000 : 1800);
  const maxWordCount = competitorAnalysis.maxWordCount || (isPillar ? 4000 : 2200);
  const targetWordCount = competitorAnalysis.recommendedWordCount || plan?.targetWordCount || (isPillar ? 3500 : 2000);

  const mainKeyword = plan?.keywords?.main || '';
  const isWithinRange = wordCount >= minWordCount && wordCount <= maxWordCount;
  const wordCountStatus = wordCount < minWordCount ? 'below_minimum' : wordCount > maxWordCount ? 'above_maximum' : 'within_range';

  const keywordCount = mainKeyword ? (markdown.match(new RegExp(mainKeyword, 'gi')) || []).length : 0;
  const keywordDensity = wordCount > 0 ? ((keywordCount / wordCount) * 100).toFixed(2) : '0.00';

  const outboundLinks = (markdown.match(/\[.*?\]\(http.*?\)/g) || []).length;
  const internalLinks = (markdown.match(/<!-- INTERNAL:/g) || []).length;
  const callouts = (markdown.match(/> \[(TIP|WARNING|KEY|INFO|SUCCESS)\]/g) || []).length;
  const tables = Math.round((markdown.match(/\|.*\|/g) || []).length / 3);

  const sentences = markdown.split(/[.!?]+/).length;
  const avgWordsPerSentence = sentences > 0 ? wordCount / sentences : 0;
  const readabilityScore = 20 - (avgWordsPerSentence / 5);

  return {
    wordCount,
    targetWordCount,
    minWordCount,
    maxWordCount,
    articleType,
    wordCountDiff: wordCount - targetWordCount,
    wordCountStatus,
    isWithinRange,
    keywordCount,
    keywordDensity: `${keywordDensity}%`,
    links: { outbound: outboundLinks, internal: internalLinks, total: outboundLinks + internalLinks },
    engagement: { callouts, tables },
    readability: {
      score: readabilityScore.toFixed(1),
      grade: avgWordsPerSentence < 15 ? '8th' : avgWordsPerSentence < 20 ? '10th' : '12th',
      avgWordsPerSentence: avgWordsPerSentence.toFixed(1),
    },
    seoScore: calculateSEOScore(markdown, plan),
  };
}

function calculateSEOScore(markdown: string, plan: any): number {
  let score = 0;
  const mainKeyword = plan?.keywords?.main || '';

  const firstPara = markdown.split('\n\n')[1] || '';
  if (firstPara.toLowerCase().includes(mainKeyword.toLowerCase())) score += 10;

  const h2s = markdown.match(/^##\s+(.+)$/gm) || [];
  if (h2s.filter(h2 => h2.toLowerCase().includes(mainKeyword.toLowerCase())).length >= 2) score += 15;

  if (markdown.split(/\s+/).length >= 1500) score += 15;
  if ((markdown.match(/<!-- INTERNAL:/g) || []).length >= 2) score += 10;
  if ((markdown.match(/\[.*?\]\(http.*?\)/g) || []).length >= 1) score += 10;
  if (markdown.includes('FAQ') || markdown.includes('Frequently Asked')) score += 10;
  if ((markdown.match(/> \[(TIP|WARNING|KEY|INFO|SUCCESS)\]/g) || []).length >= 3) score += 10;
  if ((markdown.match(/\|.*\|/g) || [])?.length > 10) score += 5;
  if (plan?.structure?.metaDescription) score += 5;

  // Removed duplicate H1 check since we no longer use H1 in articles
  score += 10;

  return score;
}

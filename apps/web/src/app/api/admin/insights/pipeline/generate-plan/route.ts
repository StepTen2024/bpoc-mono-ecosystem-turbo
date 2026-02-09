/**
 * AI CONTENT PIPELINE - STAGE 3: PLAN GENERATION
 *
 * MODEL: Claude Sonnet 4 (for strategic planning)
 *
 * GENERATES:
 * - Competitor word count analysis
 * - Keyword strategy (main + cluster + semantic)
 * - Content structure (H1, H2s, H3s)
 * - Outbound link anchor text strategy
 * - SEO checklist (RankMath 100/100)
 * - Writing instructions (plagiarism/AI detection avoidance)
 * - LLM crawling optimization
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import Anthropic from '@anthropic-ai/sdk';
import { logError } from '@/lib/error-logger';
export const maxDuration = 300;
export const preferredRegion = 'iad1';
export const dynamic = 'force-dynamic';
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const anthropic = new Anthropic({
  apiKey: process.env.CLAUDE_API_KEY!,
});

interface PlanRequest {
  topic: string;
  focusKeyword: string;
  siloTopic: string;
  research: any; // From Stage 2
  originalBrief?: string;
  selectedIdea?: any;
  insightId?: string;
  pipelineId?: string;
  isPillar?: boolean; // True for pillar/silo articles, false for supporting articles
}

// Silo configuration for dynamic prompts
const SILO_CONFIG: Record<string, { name: string; context: string; examples: string; voice: string }> = {
  'salary': {
    name: 'Salary & Compensation',
    context: 'salary negotiations, pay scales, compensation packages, benefits',
    examples: 'salary ranges, bonuses, allowances, pay structures',
    voice: 'professional, informative, data-driven',
  },
  'career': {
    name: 'Career Growth',
    context: 'promotions, leadership development, career advancement, professional growth',
    examples: 'career paths, skill development, promotions, management roles',
    voice: 'motivational, strategic, forward-looking',
  },
  'jobs': {
    name: 'Job Opportunities',
    context: 'job openings, hiring trends, employment opportunities, job market',
    examples: 'job listings, hiring companies, employment trends',
    voice: 'informative, timely, actionable',
  },
  'interview': {
    name: 'Interview Tips',
    context: 'interview preparation, common questions, interview techniques, hiring process',
    examples: 'interview questions, preparation tips, assessment guides',
    voice: 'practical, encouraging, detailed',
  },
  'employment-guide': {
    name: 'Employment Guide',
    context: 'labor laws, employee rights, workplace policies, legal compliance',
    examples: 'DOLE regulations, labor code, employee protections',
    voice: 'authoritative, informative, accurate',
  },
  'companies': {
    name: 'Company Reviews',
    context: 'company culture, employer reviews, workplace environment, company ratings',
    examples: 'company profiles, workplace reviews, employer comparisons',
    voice: 'balanced, honest, detailed',
  },
  'training': {
    name: 'Training & Certifications',
    context: 'professional development, certifications, training programs, skill building',
    examples: 'training programs, certifications, courses, skill development',
    voice: 'educational, practical, encouraging',
  },
  'worklife': {
    name: 'Work-Life Balance',
    context: 'stress management, work schedules, mental health, workplace wellness',
    examples: 'wellness tips, schedule management, self-care strategies',
    voice: 'supportive, empathetic, practical',
  },
};

// Get silo config with fallback
function getSiloConfig(siloId?: string) {
  if (siloId && SILO_CONFIG[siloId]) {
    return SILO_CONFIG[siloId];
  }
  return {
    name: 'General Career',
    context: 'career development, professional growth, employment',
    examples: 'career tips, job advice, professional development',
    voice: 'professional, helpful, informative',
  };
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    // Handle both old format (direct) and new format (articleTemplate)
    const articleTemplate = body.articleTemplate || {};
    const topic = body.topic || articleTemplate.title || body.selectedIdea?.title || 'Article';
    const focusKeyword = body.focusKeyword || articleTemplate.focusKeyword || body.selectedIdea?.keywords?.[0] || topic;
    const siloTopic = body.siloTopic || body.selectedIdea?.silo || '';
    const research = body.research;
    const originalBrief = body.originalBrief;
    const selectedIdea = body.selectedIdea;
    const insightId = body.insightId;
    const pipelineId = body.pipelineId;
    const isPillar = body.isPillar || false;

    // Get silo configuration
    const siloConfig = getSiloConfig(siloTopic);

    console.log('📋 STAGE 3: PLAN GENERATION (Claude Sonnet 4)');
    console.log(`CLAUDE_API_KEY present: ${!!process.env.CLAUDE_API_KEY}, ends: ...${(process.env.CLAUDE_API_KEY || "").slice(-8)}`);
    console.log(`Topic: ${topic}`);
    console.log(`Category: ${siloConfig.name}`);
    console.log(`Article Type: ${isPillar ? 'PILLAR/SILO (3000-4000 words)' : 'SUPPORTING (1800-2200 words)'}`);
    console.log(`Brief: ${originalBrief ? originalBrief.slice(0, 100) + '...' : 'None'}`);

    // Generate comprehensive plan with GPT-4o
    const plan = await generatePlan(
      topic,
      focusKeyword,
      siloTopic,
      research,
      originalBrief,
      selectedIdea,
      isPillar
    );

    // Save to database (skip if engine is handling post creation in finalize)
    const skipPostCreation = body.skipPostCreation === true;
    let insight;
    let error;

    if (skipPostCreation) {
      console.log('⏭️ Skipping post creation (engine mode — finalize handles it)');
      insight = null;
      error = null;
    } else if (insightId) {
      // UPDATE existing draft
      const result = await supabase
        .from('insights_posts')
        .update({
          title: plan.structure?.title || plan.title || topic,
          meta_description: plan.structure?.metaDescription || plan.metaDescription,
          pipeline_stage: 'plan_review',
          generation_metadata: {
            plan: plan,
            plan_generated_at: new Date().toISOString(),
            model: 'claude-sonnet-4-20250514',
          },
          updated_at: new Date().toISOString(),
        })
        .eq('id', insightId)
        .select()
        .single();

      insight = result.data;
      error = result.error;
    } else {
      // INSERT new record
      // For pillar/silo pages, use the silo slug from the database
      let finalSlug = plan.structure?.slug || topic.toLowerCase().replace(/[^a-z0-9]+/g, '-');
      
      if (isPillar && siloTopic) {
        // Look up the actual silo slug from the database
        const { data: siloData } = await supabase
          .from('insights_silos')
          .select('slug')
          .or(`name.ilike.%${siloTopic}%,slug.ilike.%${siloTopic}%`)
          .single();
        
        if (siloData?.slug) {
          finalSlug = siloData.slug;
          console.log(`📌 Using silo slug for pillar: ${finalSlug}`);
        }
      }

      // First check if a post with this slug already exists (e.g. from a previous failed attempt)
      const { data: existingPost } = await supabase
        .from('insights_posts')
        .select('id, is_published')
        .eq('slug', finalSlug)
        .single();

      let result;
      if (existingPost && !existingPost.is_published) {
        // Update the existing draft instead of failing on duplicate
        console.log(`♻️ Updating existing draft post with slug: ${finalSlug}`);
        result = await supabase
          .from('insights_posts')
          .update({
            title: plan.structure?.title || plan.title || topic,
            content: '',
            meta_description: plan.structure?.metaDescription || plan.metaDescription,
            category: siloConfig.name,
            pipeline_stage: 'plan_review',
            silo_id: siloConfig.id || null,
            generation_metadata: {
              plan: plan,
              plan_generated_at: new Date().toISOString(),
              model: 'claude-sonnet-4-20250514',
            },
            ai_logs: [{
              stage: 'plan_generation',
              timestamp: new Date().toISOString(),
              model: 'claude-sonnet-4-20250514',
              reasoning: plan.reasoning,
            }],
          })
          .eq('id', existingPost.id)
          .select()
          .single();
      } else {
        result = await supabase
          .from('insights_posts')
          .insert({
            slug: finalSlug,
            title: plan.structure?.title || plan.title || topic,
            content: '',
            meta_description: plan.structure?.metaDescription || plan.metaDescription,
            author: 'Admin',
            author_slug: 'admin',
            category: siloConfig.name,
            pipeline_stage: 'plan_review',
            is_published: false,
            generation_metadata: {
              plan: plan,
              plan_generated_at: new Date().toISOString(),
              model: 'claude-sonnet-4-20250514',
            },
            ai_logs: [{
              stage: 'plan_generation',
              timestamp: new Date().toISOString(),
              model: 'claude-sonnet-4-20250514',
              reasoning: plan.reasoning,
            }],
          })
          .select()
          .single();
      }

      insight = result.data;
      error = result.error;
    }

    if (error) {
      console.error('Database error:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    console.log('✅ Plan saved to database');

    // Link pipeline if provided
    if (pipelineId && insight?.id) {
      const { error: linkError } = await supabase
        .from('content_pipelines')
        .update({
          insight_id: insight.id,
          current_stage: 3,
          plan_data: plan,
        })
        .eq('id', pipelineId);

      if (linkError) {
        console.error('Failed to link pipeline:', linkError);
      } else {
        console.log(`🔗 Linked pipeline ${pipelineId} to insight ${insight.id}`);
      }
    }

    return NextResponse.json({
      success: true,
      insightId: insight?.id || null,
      plan,
    });

  } catch (error: any) {
    console.error('❌ Plan generation error:', error);
    await logError(error, {
      endpoint: '/api/admin/insights/pipeline/generate-plan',
      http_method: 'POST',
      external_service: 'claude_sonnet_4',
    });
    return NextResponse.json({
      success: false,
      error: error.message || 'Plan generation failed'
    }, { status: 500 });
  }
}

async function generatePlan(
  topic: string,
  focusKeyword: string,
  siloTopic: string,
  research: any,
  originalBrief?: string,
  selectedIdea?: any,
  isPillar?: boolean
) {
  console.log('🧠 Claude Sonnet 4: Generating comprehensive SEO plan...');

  // Word count limits based on article type
  // Pillar/Silo articles: 3000-4000 words (comprehensive, authoritative content)
  // Supporting articles: 1800-2200 words (focused, targeted content)
  const wordCountRange = isPillar
    ? { min: 3000, max: 4000, recommended: 3500 }
    : { min: 1800, max: 2200, recommended: 2000 };

  // Get silo-specific configuration
  const siloConfig = getSiloConfig(siloTopic);

  // Extract research data from Stage 2 output
  const researchData = research?.research || research || {};

  // Perplexity insights
  const perplexityInsights = researchData.perplexity?.insights || '';
  const perplexityCitations = researchData.perplexity?.citations || [];

  // Serper/Google data
  const serperCompetitors = researchData.serper?.competitors || [];
  const serperSocialLinks = researchData.serper?.socialLinks || [];
  const peopleAlsoAsk = researchData.serper?.peopleAlsoAsk || [];
  const relatedSearches = researchData.serper?.relatedSearches || [];

  // Validated links
  const validatedLinks = researchData.validatedLinks?.validLinks || [];

  // GPT-4o Synthesis from Stage 2
  const synthesis = researchData.synthesis || {};

  console.log('📊 Research data received:');
  console.log(`- Perplexity insights: ${perplexityInsights ? 'Yes' : 'No'}`);
  console.log(`- Competitors: ${serperCompetitors.length}`);
  console.log(`- Validated links: ${validatedLinks.length}`);
  console.log(`- Synthesis keys: ${Object.keys(synthesis).length}`);

  const response = await anthropic.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 16384,
    system: 'You are a world-class SEO content strategist. Create comprehensive article plans based on research data. Always respond with valid JSON only, no explanations or markdown code blocks.',
    messages: [
      {
        role: 'user',
        content: `Create a comprehensive article plan based on the research data provided.

# CONTENT CATEGORY: ${siloConfig.name}
Context: ${siloConfig.context}
Voice/Tone: ${siloConfig.voice}

# ARTICLE TYPE: ${isPillar ? 'PILLAR/SILO ARTICLE' : 'SUPPORTING ARTICLE'}
**Word Count Target**: ${wordCountRange.min}-${wordCountRange.max} words (recommended: ${wordCountRange.recommended})
${isPillar ? '**Note**: This is a pillar article that serves as the main hub for the silo. It should be comprehensive, authoritative, and cover the topic in-depth.' : '**Note**: This is a supporting article that links back to the pillar. It should be focused, targeted, and address a specific subtopic.'}

# SELECTED TOPIC FROM STAGE 1

**Topic**: ${topic}
**Focus Keyword**: ${focusKeyword}

${originalBrief ? `**ADMIN'S ORIGINAL BRIEF** (The article MUST support this perspective):
"${originalBrief}"` : ''}

${selectedIdea ? `**Selected Idea from Stage 1**:
- Title: ${selectedIdea.title}
- Description: ${selectedIdea.description || selectedIdea.rationale || ''}
- Keywords: ${selectedIdea.keywords?.join(', ') || focusKeyword}` : ''}

# RESEARCH DATA FROM STAGE 2

## Perplexity AI Research Insights:
${perplexityInsights || 'No Perplexity insights available'}

## Perplexity Citations:
${perplexityCitations.length > 0 ? JSON.stringify(perplexityCitations.slice(0, 3), null, 2) : 'No citations'}

## Google Competitors (from Serper) — ANALYZE BUT DO NOT LINK TO THESE:
These are our COMPETITORS. Study their content for gaps, weak angles, and things we can do better.
NEVER give them outbound links — they compete for the same keywords.
${serperCompetitors.length > 0 ? JSON.stringify(serperCompetitors.slice(0, 5), null, 2) : 'No competitors found'}

## High Authority Non-Competing Links (for potential outbound links):
Only link to NON-COMPETING authority sources (.gov, .edu, industry reports, statistics).
NEVER link to sites ranking for our target keywords.
${validatedLinks.length > 0 ? JSON.stringify(validatedLinks.slice(0, 3), null, 2) : 'No validated links'}

## People Also Ask:
${peopleAlsoAsk.length > 0 ? JSON.stringify(peopleAlsoAsk.slice(0, 5), null, 2) : 'No PAA questions'}

## Research Synthesis:
${Object.keys(synthesis).length > 0 ? JSON.stringify(synthesis, null, 2) : 'No synthesis available'}

# YOUR TASK

Generate a JSON object with this structure:

{
  "title": "SEO-optimized article title (max 60 chars)",
  "slug": "url-friendly-slug",
  "metaDescription": "Compelling meta description (max 160 chars)",
  "structure": {
    "title": "Same as above (NO year numbers - must be evergreen)",
    "slug": "Same as above",
    "metaDescription": "Same as above",
    "h1": "Main heading with focus keyword",
    "introduction": {
      "hook": "Opening sentence that grabs attention",
      "problem": "Problem being solved",
      "promise": "What reader will learn",
      "targetWordCount": 250
    },
    "sections": [
      {
        "h2": "Section heading (include target/secondary keywords naturally)",
        "h3s": ["Subsection 1", "Subsection 2", "Subsection 3"],
        "keywords": ["keywords to include in this section"],
        "contentFocus": "Detailed brief of what this section covers — specific enough that a writer needs no guessing",
        "keyPoints": ["Specific point 1 to cover", "Point 2", "Point 3"],
        "targetWordCount": 400,
        "internalLinkPlaceholder": "Link to [related topic] if relevant, or null",
        "outboundLinkPlaceholder": "Link to [NON-COMPETING authority source: .gov/.edu/industry report] if relevant, or null. NEVER link to competitors."
      }
    ],
    "faq": [
      { "question": "FAQ question (from People Also Ask research)", "answerPreview": "2-3 sentence answer outline", "keywordToInclude": "keyword" }
    ],
    "conclusion": {
      "summary": "Key takeaways",
      "cta": "Call to action",
      "targetWordCount": 200
    }
  },
  "keywords": {
    "main": "${focusKeyword}",
    "cluster": ["related keyword 1", "related keyword 2"],
    "semantic": ["LSI keyword 1", "LSI keyword 2"]
  },
  "linkStrategy": {
    "outbound": [
      {
        "url": "https://authority-source.gov.ph",
        "anchorText": "anchor text",
        "reason": "Why this NON-COMPETING authority link adds value"
      }
    ],
    "internal": [
      {
        "targetTopic": "Related topic in our silo",
        "anchorText": "anchor text",
        "direction": "Links to pillar or sibling article"
      }
    ]
  },
  "competitorAnalysis": {
    "recommendedWordCount": ${wordCountRange.recommended},
    "minWordCount": ${wordCountRange.min},
    "maxWordCount": ${wordCountRange.max},
    "articleType": "${isPillar ? 'pillar' : 'supporting'}",
    "competitorGaps": ["What competitors are missing that we should cover"],
    "competitorWeaknesses": ["Angles competitors got wrong or covered poorly"],
    "contentToExpandOn": ["Topics we can cover more deeply than anyone else"],
    "reasoning": "${isPillar ? 'Pillar article requires comprehensive coverage (3000-4000 words)' : 'Supporting article should be focused and targeted (1800-2200 words)'}"
  },
  "reasoning": "Why this plan will rank well"
}

This plan targets a Rank Math SEO score of 100/100. Include proper heading hierarchy (H2, H3), keyword placement strategy, and detailed section briefs.

OUTBOUND LINK RULES (CRITICAL — SEO):
- NEVER link to competitor articles that rank for our target keywords
- ONLY link to NON-COMPETING authority sources: .gov, .edu, industry reports, research papers, statistics
- Competitors from the research are for ANALYSIS ONLY — study their gaps and weaknesses
- Maximum 2-3 outbound links per article, all to high-DA non-competing sources
- Internal links to our own silo content are unlimited and encouraged

COMPETITOR STRATEGY:
- Study what competitors rank for and find what they're MISSING
- Identify weak angles competitors took that we can do better
- Find content gaps where no competitor has good coverage
- Use their structure as reference but create something BETTER and MORE COMPREHENSIVE

SECTION REQUIREMENTS:
- ${isPillar ? 'Minimum 8-12 main sections for pillar article (3000-4000 words)' : 'Include 4-6 main sections for supporting article (1800-2200 words)'}
- Each section MUST have: heading, targetWordCount, keyPoints (3+ specific points), keywords to include
- Each H2 should have 2-3 H3 subsections
- Include FAQ section with ${isPillar ? '6-8' : '3-5'} questions (prioritize People Also Ask from research)
- Plan should be detailed enough that a writer could execute without guessing
- Distribute word counts across sections to hit the ${wordCountRange.recommended} word target
- NEVER include year numbers in titles or headings — keep content evergreen

IMPORTANT: Return ONLY valid JSON, no markdown code blocks or explanations.`
      }
    ],
  });

  const rawContent = response.content[0].type === 'text'
    ? response.content[0].text
    : '';

  if (!rawContent) {
    throw new Error('No response from Claude Sonnet 4');
  }

  // Multi-strategy JSON parsing
  const { parseAIJson } = await import('@/lib/parse-ai-json');
  return parseAIJson(rawContent, 'Claude Plan');
}

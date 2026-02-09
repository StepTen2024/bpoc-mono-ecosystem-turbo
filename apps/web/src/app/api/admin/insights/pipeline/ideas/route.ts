import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { logError } from '@/lib/error-logger';
export const maxDuration = 300;
export const preferredRegion = 'iad1';
export const dynamic = 'force-dynamic';

/**
 * STAGE 1: Idea Generation — powered by Grok (xAI)
 * 
 * Now silo-aware: fetches existing content in the silo so ideas 
 * know what already exists and can suggest gap-filling content.
 * 
 * For PILLAR pages: generates the oracle + a content map of sub-articles
 * For SUPPORTING articles: knows the pillar + siblings, suggests complementary angles
 */

const GROK_API_KEY = process.env.GROK_API_KEY || process.env.XAI_API_KEY || '';
const GROK_API_URL = 'https://api.x.ai/v1/chat/completions';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// Fetch existing content in this silo for context
async function getSiloContext(siloId: string) {
  try {
    // Get the silo info
    const { data: silo } = await supabase
      .from('insights_silos')
      .select('*')
      .eq('slug', siloId)
      .single();

    // Get existing posts in this silo (published + drafts)
    const { data: posts } = await supabase
      .from('insights_posts')
      .select('id, title, slug, is_pillar, pipeline_stage, is_published, silo_topic, description')
      .or(`silo_topic.eq.${siloId},silo_id.eq.${silo?.id || 'none'}`)
      .order('created_at', { ascending: false });

    const pillar = posts?.find(p => p.is_pillar);
    const published = posts?.filter(p => p.is_published) || [];
    const drafts = posts?.filter(p => !p.is_published && p.pipeline_stage !== 'abandoned') || [];

    return {
      silo,
      pillar,
      publishedArticles: published.map(p => ({ title: p.title, slug: p.slug, isPillar: p.is_pillar })),
      draftArticles: drafts.map(p => ({ title: p.title, stage: p.pipeline_stage })),
      totalCount: posts?.length || 0,
    };
  } catch (err) {
    console.error('Error fetching silo context:', err);
    return null;
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { topic, silo, voiceTranscript, isPillar = false } = body;

    const userBrief = voiceTranscript || topic || '';
    console.log('📥 Ideas API received:', {
      voiceTranscript: voiceTranscript ? `"${voiceTranscript.substring(0, 100)}..."` : 'EMPTY',
      topic: topic || 'EMPTY',
      silo: silo || 'EMPTY',
      isPillar,
    });

    // Fetch existing silo content for context
    let siloContext: any = null;
    if (silo) {
      siloContext = await getSiloContext(silo);
      console.log(`📚 Silo context: ${siloContext?.totalCount || 0} existing articles, pillar: ${siloContext?.pillar?.title || 'none'}`);
    }

    // Detect if user's brief mentions BPO/call center topics
    const bpoKeywords = ['bpo', 'call center', 'contact center', 'outsourcing', 'customer service', 'agent', 'csr'];
    const isBpoRelated = bpoKeywords.some(keyword => userBrief.toLowerCase().includes(keyword));

    // Build the prompt
    let prompt = '';

    if (isBpoRelated || !userBrief) {
      prompt = `You are an AI content strategist for BPOC.io - a BPO careers platform for Filipino professionals.\n\n`;
    } else {
      prompt = `You are an AI content strategist. Generate article ideas based EXACTLY on what the user wants to write about.\n\nCRITICAL: The user's topic is NOT about BPO/call centers. Do NOT add BPO, call center, or outsourcing context.\n\n`;
    }

    // Add user's brief
    if (userBrief) {
      prompt += `=== USER'S BRIEF (DOMAIN EXPERT) ===
The following brief is from someone with deep industry knowledge. Their specific insights, angles, and direction MUST shape the ideas:
"""
${userBrief}
"""

`;
    }

    // PILLAR PAGE CONTEXT
    if (isPillar) {
      prompt += `=== THIS IS A PILLAR PAGE (SILO ORACLE) ===
This is the MAIN authority page for this content silo. It is the foundation.
ALL future articles in this silo will link UP to this page.
The idea must be:
- BROAD enough to be the definitive resource on the topic
- STRUCTURED to naturally allow sub-articles to flow underneath
- The "oracle" — comprehensive, authoritative, THE page to rank for the main keyword
- Sections should map to potential sub-article clusters

Think of it like a tree trunk — it needs to be strong enough for many branches.
Each major section of this pillar should hint at a topic that could become its own article.

`;
    }

    // EXISTING SILO CONTENT — what already exists
    if (siloContext) {
      prompt += `=== EXISTING CONTENT IN THIS SILO ===
`;
      if (siloContext.pillar) {
        prompt += `PILLAR PAGE (already exists): "${siloContext.pillar.title}"
`;
      }

      if (siloContext.publishedArticles.length > 0) {
        prompt += `\nPUBLISHED ARTICLES (${siloContext.publishedArticles.length}):\n`;
        siloContext.publishedArticles.forEach((a: any) => {
          prompt += `- ${a.title}${a.isPillar ? ' [PILLAR]' : ''}\n`;
        });
      }

      if (siloContext.draftArticles.length > 0) {
        prompt += `\nIN-PROGRESS DRAFTS (${siloContext.draftArticles.length}):\n`;
        siloContext.draftArticles.forEach((a: any) => {
          prompt += `- ${a.title} (${a.stage})\n`;
        });
      }

      if (!isPillar && siloContext.pillar) {
        prompt += `
IMPORTANT: New ideas must COMPLEMENT the pillar and existing articles, not duplicate them.
Ideas should fill GAPS in the silo and naturally link to/from existing content.
`;
      }

      if (!isPillar && !siloContext.pillar) {
        prompt += `
NOTE: This silo has NO pillar page yet. Consider if one of these ideas should be the pillar.
`;
      }

      prompt += `\n`;
    }

    // Silo category context
    if (silo && isBpoRelated) {
      prompt += `=== CONTENT SILO: "${silo}" ===
${siloContext?.silo?.description || ''}
Ideas must fit this category and strengthen the silo structure.

`;
    }

    // Idea generation rules
    if (isPillar) {
      prompt += `Generate 5-7 PILLAR PAGE ideas. Each idea must:
- Be comprehensive enough to be THE definitive page for this topic
- Have sections that map to potential sub-articles (include a "subTopics" array)
- Target the main, broad keyword for this silo
- Be the page that ranks #1 and everything else points to
${siloContext?.publishedArticles?.length ? `- NOT duplicate any existing content listed above` : ''}

`;
    } else {
      prompt += `Generate 5-7 article ideas that:
${userBrief ? `- Are based EXACTLY on the user's brief above` : '- Solve real problems readers face'}
${siloContext?.pillar ? `- COMPLEMENT the pillar page "${siloContext.pillar.title}" and link to it naturally` : ''}
${siloContext?.publishedArticles?.length ? `- Fill GAPS — don't duplicate existing articles` : ''}
- Target specific long-tail keywords that support the silo
- Provide genuine practical value

`;
    }

    prompt += `TITLE RULES (CRITICAL):
- NEVER include specific years (2024, 2025, 2026, etc.). Content must be EVERGREEN.
- Create BOLD, opinionated titles that provoke curiosity
- Use power words: "Secret", "Truth", "Nobody Tells You", "Actually", "Real Numbers", "Exposed"
- BAD: "Top 10 Tips for 2025", "Complete Guide to Jobs"
- GOOD: "The Salary Secret Companies Don't Want You to Know", "Why Your QA Score Doesn't Matter"

Return ONLY valid JSON:
{
  "ideas": [
    {
      "title": "Bold, evergreen, scroll-stopping title",
      "description": "2-sentence pitch explaining the unique angle",
      "keywords": ["primary keyword", "secondary keyword", "lsi keyword"],
      "difficulty": "beginner|intermediate|advanced",
      "searchVolume": "high|medium|low",
      "angle": "The contrarian or insider angle"${isPillar ? `,
      "subTopics": ["Sub-topic 1 that could be its own article", "Sub-topic 2", "Sub-topic 3", "Sub-topic 4", "Sub-topic 5"]` : `,
      "linksTo": "Which existing article this naturally links to/from (or 'pillar' if it links to the pillar)"`}
    }
  ]
}`;

    console.log('🤖 Generating ideas with Grok (xAI)...');
    console.log(`📋 Input — silo: ${silo || 'none'}, isPillar: ${isPillar}, existing: ${siloContext?.totalCount || 0}`);

    if (!GROK_API_KEY) {
      throw new Error('GROK_API_KEY not configured. Add GROK_API_KEY to .env.local');
    }

    const grokResponse = await fetch(GROK_API_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${GROK_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'grok-4-1-fast-reasoning',
        messages: [
          { role: 'system', content: 'You are a creative content strategist. Return ONLY valid JSON. No markdown, no code blocks, just raw JSON.' },
          { role: 'user', content: prompt },
        ],
        max_tokens: 131072,
        temperature: 0.9,
      }),
    });

    if (!grokResponse.ok) {
      const errBody = await grokResponse.text();
      throw new Error(`Grok API error ${grokResponse.status}: ${errBody}`);
    }

    const grokResult = await grokResponse.json();
    const content = grokResult.choices?.[0]?.message?.content || '';

    if (!content) {
      throw new Error('No response from Grok');
    }

    // Multi-strategy JSON parsing
    const { parseAIJson } = await import('@/lib/parse-ai-json');
    const result = parseAIJson(content, 'Grok Ideas');
    const ideas = result.ideas || [];

    // Post-process: strip year numbers
    const cleanedIdeas = ideas.map((idea: any) => ({
      ...idea,
      title: idea.title.replace(/\b(20\d{2})\b/g, '').replace(/\s{2,}/g, ' ').trim(),
    }));

    console.log(`✅ Generated ${cleanedIdeas.length} ideas via Grok (isPillar: ${isPillar})`);

    return NextResponse.json({
      success: true,
      ideas: cleanedIdeas,
      voiceTranscript,
      siloContext: siloContext ? {
        existingCount: siloContext.totalCount,
        hasPillar: !!siloContext.pillar,
        pillarTitle: siloContext.pillar?.title,
      } : null,
      _meta: {
        model: 'grok-4-1-fast-reasoning',
        provider: 'xAI',
        ideasCount: cleanedIdeas.length,
        hadVoiceBrief: !!voiceTranscript,
        isPillar,
        existingSiloContent: siloContext?.totalCount || 0,
      },
    });

  } catch (error: any) {
    console.error('❌ Error generating ideas:', error);
    await logError(error, {
      endpoint: '/api/admin/insights/pipeline/ideas',
      http_method: 'POST',
      external_service: 'xai-grok',
    });
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

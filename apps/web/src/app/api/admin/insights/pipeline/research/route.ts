/**
 * AI CONTENT PIPELINE - STAGE 2: ENHANCED RESEARCH
 * 
 * 2-STAGE RESEARCH PIPELINE:
 * Stage 1: Perplexity AI (Quick, broad research with unique perspectives)
 * Stage 2: Serper Google Search (Deep competitor analysis, high DA links)
 * 
 * OUTBOUND LINK RULES:
 * - 1-3 outbound links per article (depending on length)
 * - High DA sites OR genuinely good niche sites with valuable info
 * - Prioritize: .edu, .gov, .org domains
 * - Consider: Reddit, Medium, LinkedIn, X (for social/cultural relevance)
 * 
 * VALIDATION:
 * - Verify all links are not 404
 * - Validate content quality of target pages
 * - Rank competitors trying to rank for same topic
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import OpenAI from 'openai';
import { logError } from '@/lib/error-logger';
export const maxDuration = 300;
export const preferredRegion = 'iad1';
export const dynamic = 'force-dynamic';
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY!,
});

interface ResearchRequest {
  topic: string;
  focusKeyword: string;
  siloTopic?: string; // The silo/category this article belongs to
  originalBrief?: string;
  selectedIdea?: any;
  isPillar?: boolean; // True = this is the SILO PAGE (pillar/oracle), sub-articles flow under it
  articleLength?: 'short' | 'medium' | 'long'; // Determines outbound link count
}

// Silo configuration for dynamic prompts
const SILO_CONFIG: Record<string, { name: string; context: string; subreddits: string; platforms: string }> = {
  'salary': {
    name: 'Salary & Compensation',
    context: 'salary negotiations, pay scales, compensation packages, benefits',
    subreddits: 'r/jobs, r/careeradvice, r/personalfinance, r/Philippines',
    platforms: 'LinkedIn salary posts, Glassdoor discussions, PayScale forums',
  },
  'career': {
    name: 'Career Growth',
    context: 'promotions, leadership development, career advancement, professional growth',
    subreddits: 'r/careerguidance, r/jobs, r/LifeProTips, r/Philippines',
    platforms: 'LinkedIn career posts, Medium career articles, professional forums',
  },
  'jobs': {
    name: 'Job Opportunities',
    context: 'job openings, hiring trends, employment opportunities, job market',
    subreddits: 'r/jobs, r/forhire, r/Philippines, r/phcareers',
    platforms: 'LinkedIn job posts, Indeed discussions, JobStreet forums',
  },
  'interview': {
    name: 'Interview Tips',
    context: 'interview preparation, common questions, interview techniques, hiring process',
    subreddits: 'r/jobs, r/interviews, r/careeradvice, r/Philippines',
    platforms: 'LinkedIn interview tips, Glassdoor interview reviews, career blogs',
  },
  'employment-guide': {
    name: 'Employment Guide',
    context: 'labor laws, employee rights, DOLE regulations, workplace policies',
    subreddits: 'r/legaladvice, r/Philippines, r/antiwork, r/jobs',
    platforms: 'DOLE official resources, legal forums, HR professional groups',
  },
  'companies': {
    name: 'Company Reviews',
    context: 'company culture, employer reviews, workplace environment, company ratings',
    subreddits: 'r/jobs, r/Philippines, r/cscareerquestions, r/antiwork',
    platforms: 'Glassdoor reviews, LinkedIn company pages, Indeed reviews',
  },
  'training': {
    name: 'Training & Certifications',
    context: 'professional development, certifications, training programs, skill building',
    subreddits: 'r/learnprogramming, r/ITCareerQuestions, r/certifications, r/Philippines',
    platforms: 'LinkedIn Learning discussions, Coursera forums, professional certification groups',
  },
  'worklife': {
    name: 'Work-Life Balance',
    context: 'stress management, work schedules, mental health, workplace wellness',
    subreddits: 'r/antiwork, r/workreform, r/mentalhealth, r/Philippines',
    platforms: 'LinkedIn wellness posts, Medium work-life articles, health forums',
  },
};

// Get silo config with fallback
function getSiloConfig(siloId?: string) {
  if (siloId && SILO_CONFIG[siloId]) {
    return SILO_CONFIG[siloId];
  }
  // Default/fallback for unknown or empty silo
  return {
    name: 'General Career',
    context: 'career development, professional growth, employment',
    subreddits: 'r/jobs, r/careeradvice, r/Philippines',
    platforms: 'LinkedIn, Medium career articles, professional forums',
  };
}

export async function POST(req: NextRequest) {
  try {
    const body: ResearchRequest = await req.json();
    const { 
      topic, 
      focusKeyword, 
      siloTopic,
      originalBrief, 
      selectedIdea,
      isPillar = false,
      articleLength = 'medium'
    } = body;

    // Extract selected idea details for prioritized research
    const selectedTitle = selectedIdea?.title || topic;
    const selectedDescription = selectedIdea?.description || selectedIdea?.rationale || '';
    const selectedKeywords = selectedIdea?.keywords || [];

    console.log('🔍 STAGE 2: ENHANCED DUAL RESEARCH');
    console.log(`Selected Topic Title: ${selectedTitle}`);
    console.log(`Selected Topic Description: ${selectedDescription ? selectedDescription.slice(0, 100) + '...' : 'None'}`);
    console.log(`Silo: ${siloTopic || 'General'}`);
    console.log(`Is Pillar/Silo Page: ${isPillar}`);
    console.log(`Original Brief: ${originalBrief ? originalBrief.slice(0, 100) + '...' : 'None'}`);

    const results: any = {
      topic,
      isPillar,
      focusKeyword,
      siloTopic,
      originalBrief,
      selectedIdea,
      timestamp: new Date().toISOString(),
    };

    // ========================================
    // STAGE 1: PERPLEXITY AI RESEARCH
    // Quick, unique perspectives, content gaps
    // ========================================
    console.log('🧠 Stage 1: Perplexity AI Research...');
    try {
      results.perplexity = await perplexityResearch(
        selectedTitle,
        focusKeyword,
        siloTopic,
        originalBrief,
        selectedDescription,
        selectedKeywords,
        isPillar
      );
    } catch (error: any) {
      console.error('Perplexity error:', error);
      results.perplexity = { error: error.message };
    }

    // ========================================
    // STAGE 2: SERPER GOOGLE DEEP RESEARCH
    // Competitor analysis, high DA links, ranking
    // ========================================
    console.log('🔍 Stage 2: Google/Serper Deep Research...');
    try {
      results.serper = await serperDeepResearch(topic, focusKeyword, siloTopic);
    } catch (error: any) {
      console.error('Serper error:', error);
      results.serper = { error: error.message };
    }

    // ========================================
    // STAGE 3: LINK VALIDATION & RANKING
    // Verify links work, check DA, validate content
    // ========================================
    console.log('✅ Stage 3: Link Validation & Competitor Ranking...');
    const validatedLinks = await validateAndRankLinks(results.serper?.competitors || []);
    results.validatedLinks = validatedLinks;

    // ========================================
    // STAGE 4: SYNTHESIZE FINAL RESEARCH
    // Combine Perplexity + Google insights
    // ========================================
    console.log('🎯 Stage 4: Final Synthesis...');
    const synthesis = await synthesizeResearch(results, articleLength);

    // Compute research metrics for visibility
    const perplexityHasInsights = !!results.perplexity?.insights;
    const serperCompetitorsCount = results.serper?.competitors?.length || 0;
    const serperHighDACount = results.serper?.highDALinks?.length || 0;
    const serperSocialCount = results.serper?.socialLinks?.length || 0;
    const paaCount = results.serper?.peopleAlsoAsk?.length || 0;
    const validLinksCount = results.validatedLinks?.validCount || 0;

    console.log('📊 Research Metrics:');
    console.log(`  Perplexity: ${perplexityHasInsights ? 'YES' : 'NO'}`);
    console.log(`  Serper competitors: ${serperCompetitorsCount}`);
    console.log(`  High DA links: ${serperHighDACount}`);
    console.log(`  Social links: ${serperSocialCount}`);
    console.log(`  PAA questions: ${paaCount}`);
    console.log(`  Validated links: ${validLinksCount}`);

    return NextResponse.json({
      success: true,
      research: {
        ...results,
        synthesis,
      },
      _meta: {
        perplexity_used: perplexityHasInsights,
        perplexity_citations: results.perplexity?.citations?.length || 0,
        serper_queries: 1, // Main competitor query
        serper_competitors: serperCompetitorsCount,
        serper_high_da_links: serperHighDACount,
        serper_social_links: serperSocialCount,
        paa_questions: paaCount,
        validated_links: validLinksCount,
        sources_found: serperCompetitorsCount + serperHighDACount + serperSocialCount,
        research_depth: (perplexityHasInsights && serperCompetitorsCount > 5) ? 'deep' : 
                        (perplexityHasInsights || serperCompetitorsCount > 3) ? 'standard' : 'shallow',
      },
    });

  } catch (error: any) {
    console.error('❌ Research error:', error);
    
    await logError(error, {
      endpoint: '/api/admin/insights/pipeline/research',
      http_method: 'POST',
      external_service: error.message?.includes('perplexity') ? 'perplexity' : 
                        error.message?.includes('serper') ? 'serper' : undefined,
    });
    
    return NextResponse.json({ 
      success: false,
      error: error.message || 'Research failed' 
    }, { status: 500 });
  }
}

// ========================================
// PERPLEXITY AI RESEARCH
// Unique perspectives, content gaps, social insights
// ========================================
async function perplexityResearch(
  topic: string,
  keyword: string,
  siloTopic?: string,
  originalBrief?: string,
  topicDescription?: string,
  topicKeywords?: string[],
  isPillar?: boolean
) {
  console.log('🧠 Perplexity: Finding unique angles...');

  // Get silo-specific configuration
  const siloConfig = getSiloConfig(siloTopic);

  // Build context-aware query prioritizing selected topic
  let query = `${topic} ${keyword}`;
  if (topicKeywords && topicKeywords.length > 0) {
    query += ` ${topicKeywords.slice(0, 3).join(' ')}`;
  }
  query += ` ${siloConfig.context} Philippines`;

  const pillarContext = isPillar ? `
=== ARTICLE TYPE: PILLAR / SILO PAGE ===
This is the MAIN PILLAR PAGE for the "${siloConfig.name}" content silo.
It is the top-level authority page. ALL other articles in this silo will link up to this page.
Research must be COMPREHENSIVE and BROAD — covering the full scope of the topic.
This page needs to be the definitive resource that sub-articles reference.
Think of it as the "oracle" — the foundation everything else builds on.
Sub-topics should be identified but NOT fully explored (they get their own articles).
` : '';

  const response = await fetch('https://api.perplexity.ai/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${process.env.PERPLEXITY_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'sonar-pro',
      messages: [{
        role: 'user',
        content: `Research this topic for an article about ${siloConfig.name}.

=== SELECTED ARTICLE TOPIC (PRIORITY) ===
TITLE: "${topic}"
${topicDescription ? `DESCRIPTION: ${topicDescription}` : ''}
${topicKeywords && topicKeywords.length > 0 ? `TARGET KEYWORDS: ${topicKeywords.join(', ')}` : ''}
${pillarContext}
${originalBrief ? `=== AUTHOR'S ORIGINAL BRIEF (DOMAIN EXPERT) ===\nThe following is from someone with deep industry knowledge. Use their specific insights, angles, and direction to guide research:\n${originalBrief}\n` : ''}
TOPIC CATEGORY: ${siloConfig.name}
CONTEXT: ${siloConfig.context}

IMPORTANT: Your research MUST focus on the SELECTED ARTICLE TOPIC above. The title and description define what this article will be about.
${isPillar ? 'This is a PILLAR page — research broadly across the full topic. Identify sub-topics that could become their own supporting articles.' : ''}

Provide research insights in the following areas:

1. UNIQUE PERSPECTIVES: What angles are NOT being covered by existing content for "${topic}"? What fresh takes can we provide?

2. CONTENT GAPS: What questions are people asking about "${topic}" that aren't being answered well?

3. SOCIAL INSIGHTS: Find relevant discussions about this specific topic from:
   - Reddit: ${siloConfig.subreddits}
   - ${siloConfig.platforms}
   - X/Twitter discussions

4. EMERGING TRENDS: What's changing in the Philippines that affects "${topic}"?

5. COMPETITOR BLIND SPOTS: What are popular articles about "${topic}" missing or getting wrong?

${isPillar ? '6. SUB-TOPIC OPPORTUNITIES: What specific sub-topics should get their own dedicated articles that link back to this pillar page? List 5-10 potential supporting articles.' : ''}

Format your response as structured insights, not as an article. Focus on research findings specific to the selected topic.`
      }],
      temperature: 0.2,
      max_tokens: 8000,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Perplexity API error: ${response.statusText} - ${errorText}`);
  }

  const data = await response.json();
  const content = data.choices[0]?.message?.content || '';

  // Parse Perplexity response for citations (it includes sources)
  const citations = data.citations || [];

  return {
    insights: content,
    citations: citations.slice(0, 5), // Top 5 sources Perplexity used
    timestamp: new Date().toISOString(),
  };
}

// ========================================
// SERPER GOOGLE DEEP RESEARCH
// Competitor ranking, high DA links, authority sites
// ========================================
async function serperDeepResearch(topic: string, keyword: string, siloTopic?: string) {
  console.log('📊 Serper: Deep competitor analysis...');

  // Get silo-specific configuration
  const siloConfig = getSiloConfig(siloTopic);

  // Search query optimized for finding competitors - using silo context
  let searchQuery = `${keyword} ${siloConfig.context} Philippines`;
  
  const response = await fetch('https://google.serper.dev/search', {
    method: 'POST',
    headers: {
      'X-API-KEY': process.env.SERPER_API_KEY!,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      q: searchQuery,
      num: 20, // Get more results for better competitor analysis
      gl: 'ph', // Philippines results
    }),
  });

  if (!response.ok) {
    throw new Error(`Serper API error: ${response.statusText}`);
  }

  const data = await response.json();
  
  // Analyze competitors and categorize by domain authority indicators
  const competitors = (data.organic || []).map((result: any, index: number) => {
    const url = new URL(result.link);
    const domain = url.hostname;
    
    // Categorize by domain type
    const domainType = 
      domain.endsWith('.edu') ? 'education' :
      domain.endsWith('.gov') ? 'government' :
      domain.endsWith('.org') ? 'organization' :
      domain.includes('reddit.com') ? 'reddit' :
      domain.includes('medium.com') ? 'medium' :
      domain.includes('linkedin.com') ? 'linkedin' :
      'commercial';
    
    // Estimate DA based on domain + position
    const estimatedDA = 
      domainType === 'education' ? 90 :
      domainType === 'government' ? 95 :
      domainType === 'organization' ? 80 :
      index < 3 ? 70 : // Top 3 results usually high DA
      index < 10 ? 50 :
      30;

    return {
      rank: index + 1,
      title: result.title,
      url: result.link,
      domain,
      domainType,
      estimatedDA,
      snippet: result.snippet,
      position: result.position,
    };
  });

  // Find high authority outbound link candidates
  const highDALinks = competitors.filter((c: any) => 
    c.domainType === 'education' || 
    c.domainType === 'government' || 
    c.domainType === 'organization' ||
    c.estimatedDA >= 60
  ).slice(0, 10);

  // Find social/cultural relevance links
  const socialLinks = competitors.filter((c: any) => 
    c.domainType === 'reddit' || 
    c.domainType === 'medium' || 
    c.domainType === 'linkedin'
  ).slice(0, 5);

  return {
    competitors: competitors.slice(0, 10), // Top 10 competitors
    highDALinks,
    socialLinks,
    peopleAlsoAsk: data.peopleAlsoAsk || [],
    relatedSearches: data.relatedSearches || [],
  };
}

// ========================================
// LINK VALIDATION & RANKING
// Verify links work (not 404), validate content
// ========================================
async function validateAndRankLinks(competitors: any[]) {
  console.log('✅ Validating links and ranking competitors...');
  
  const validatedLinks = await Promise.all(
    competitors.slice(0, 10).map(async (comp) => {
      try {
        // Quick HEAD request to verify link works
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 5000); // 5s timeout

        const response = await fetch(comp.url, {
          method: 'HEAD',
          signal: controller.signal,
        });
        
        clearTimeout(timeout);

        const isValid = response.ok;
        const statusCode = response.status;

        return {
          ...comp,
          validated: true,
          isValid,
          statusCode,
          contentType: response.headers.get('content-type'),
        };
      } catch (error) {
        return {
          ...comp,
          validated: true,
          isValid: false,
          error: 'Link validation failed (timeout or unreachable)',
        };
      }
    })
  );

  // Filter to only valid links
  const validLinks = validatedLinks.filter(link => link.isValid);

  // Rank by DA and domain type
  const rankedLinks = validLinks.sort((a, b) => {
    // .edu/.gov/.org first
    if (a.domainType !== b.domainType) {
      const typeOrder: any = { government: 1, education: 2, organization: 3, commercial: 4 };
      return (typeOrder[a.domainType] || 5) - (typeOrder[b.domainType] || 5);
    }
    // Then by estimated DA
    return (b.estimatedDA || 0) - (a.estimatedDA || 0);
  });

  return {
    validLinks: rankedLinks,
    invalidLinks: validatedLinks.filter(link => !link.isValid),
    totalChecked: competitors.length,
    validCount: validLinks.length,
  };
}

// ========================================
// FINAL SYNTHESIS
// Combine Perplexity + Google insights
// ========================================
async function synthesizeResearch(results: any, articleLength: string) {
  console.log('🧠 GPT-4: Final synthesis...');

  // Get silo-specific configuration
  const siloConfig = getSiloConfig(results.siloTopic);

  // Determine outbound link count based on article length
  const outboundLinkCount =
    articleLength === 'short' ? 1 :
    articleLength === 'medium' ? 2 :
    3; // long

  // Extract selected idea details for prioritized synthesis
  const selectedTitle = results.selectedIdea?.title || results.topic;
  const selectedDescription = results.selectedIdea?.description || results.selectedIdea?.rationale || '';
  const selectedKeywords = results.selectedIdea?.keywords || [];

  const response = await openai.chat.completions.create({
    model: 'gpt-4o',
    max_tokens: 16384,
    response_format: { type: 'json_object' },
    messages: [{
      role: 'user',
      content: `Synthesize this dual-stage research into actionable insights for an article about ${siloConfig.name}.

=== SELECTED ARTICLE TOPIC (PRIORITY - This is what we're writing about) ===
TITLE: "${selectedTitle}"
${selectedDescription ? `DESCRIPTION: ${selectedDescription}` : ''}
${selectedKeywords.length > 0 ? `TARGET KEYWORDS: ${selectedKeywords.join(', ')}` : ''}

IMPORTANT: All research synthesis MUST focus on the selected article topic above. The unique angle, content gaps, and structure should directly support this specific topic.

TOPIC CATEGORY: ${siloConfig.name}
CONTEXT: ${siloConfig.context}
${results.originalBrief ? `ADMIN'S ORIGINAL BRIEF: ${results.originalBrief}` : ''}

=== PERPLEXITY INSIGHTS (Unique Angles) ===
${results.perplexity?.insights || 'Not available'}

Perplexity Citations:
${JSON.stringify(results.perplexity?.citations || [], null, 2)}

=== GOOGLE COMPETITOR ANALYSIS ===
Top Competitors:
${JSON.stringify(results.serper?.competitors?.slice(0, 5) || [], null, 2)}

High DA Link Candidates:
${JSON.stringify(results.validatedLinks?.validLinks?.slice(0, 5) || [], null, 2)}

Social/Cultural Links:
${JSON.stringify(results.serper?.socialLinks || [], null, 2)}

People Also Ask:
${JSON.stringify(results.serper?.peopleAlsoAsk || [], null, 2)}

=== YOUR TASK ===
Create a comprehensive content plan with:

1. "uniqueAngle": The unique perspective we'll take (based on Perplexity insights + user's brief)

2. "contentGaps": Array of specific gaps in competitor content we'll fill

3. "competitorRanking": Array of top 5 competitors with their strengths/weaknesses

4. "outboundLinks": Array of EXACTLY ${outboundLinkCount} recommended outbound links:
   - Must be from validated links provided above
   - Prioritize: .edu > .gov > .org > high DA commercial
   - Include 1 social link (Reddit/Medium/LinkedIn) if relevant
   - Format: { url, domain, reason, domainType, estimatedDA }

5. "socialContext": How Reddit/Medium/LinkedIn discussions inform our angle

6. "unansweredQuestions": Questions people ask that competitors don't answer well

7. "topicalAuthority": How to establish authority (citing official sources, expert opinions, studies, etc.)

8. "contentStructure": Suggested article structure based on research

9. "keyStats": Important statistics/data points to include

10. "internalLinkOpportunities": Suggest 2-3 related topics for internal linking within the ${siloConfig.name} category

Return ONLY valid JSON. Be specific and actionable.`,
    }],
  });

  const content = response.choices[0]?.message?.content;
  if (content) {
    try {
      const { parseAIJson } = await import('@/lib/parse-ai-json');
      return parseAIJson(content, 'GPT-4o Synthesis');
    } catch {
      return { raw: content };
    }
  }

  return {};
}

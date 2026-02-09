/**
 * AI CONTENT PIPELINE - STAGE 6: SEO OPTIMIZATION
 *
 * AI MODELS USED:
 * - Claude Sonnet 4 (Anthropic): Link categorization, article optimization
 * - OpenAI text-embedding-3-small: Vector embeddings for semantic search
 *
 * FEATURES:
 * - Vector embeddings for semantic article matching
 * - 4-way internal linking (parent, child, sibling, cross-silo)
 * - Keyword cannibalization detection
 * - Orphan article detection
 * - RankMath 100-point scoring
 * - Readability analysis
 * - Link quality validation
 *
 * FLOW:
 * 1. Check keyword cannibalization
 * 2. Generate vector embeddings (OpenAI)
 * 3. Find similar articles via vector search
 * 4. Categorize link relationships with Claude
 * 5. Analyze SEO quality
 * 6. Calculate RankMath score
 * 7. Detect orphan articles
 * 8. Claude optimizes article with links
 * 9. Save embeddings + keywords to database
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import Anthropic from '@anthropic-ai/sdk';
import OpenAI from 'openai';
import { logError } from '@/lib/error-logger';
export const maxDuration = 300;
export const dynamic = 'force-dynamic';
export const preferredRegion = 'iad1';
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// Claude Sonnet 4 for AI reasoning (link categorization, optimization)
const anthropic = new Anthropic({
  apiKey: process.env.CLAUDE_API_KEY!,
});

// OpenAI for embeddings only (vector search)
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY!,
});

// ============================================
// TYPES
// ============================================

interface InternalLinkSuggestion {
  articleId: string;
  title: string;
  slug: string;
  similarity: number;
  linkType: 'parent' | 'child' | 'sibling' | 'cross-silo';
  anchorTextSuggestions: string[];
  reason: string;
}

interface KeywordCannibalizationWarning {
  keyword: string;
  existingArticleId: string;
  existingArticleTitle: string;
  existingArticleSlug: string;
  isPrimary: boolean;
  createdAt: string;
}

interface SEOAnalysis {
  keywordDensity: number;
  primaryKeywordInFirstParagraph: boolean;
  primaryKeywordInH1: boolean;
  primaryKeywordInH2Count: number;
  headingHierarchyValid: boolean;
  readabilityScore: number;
  avgSentenceLength: number;
  avgWordLength: number;
  complexWords: number;
  totalWords: number;
  // Additional properties for UI changes display
  headingCount: number;
  headingKeywordCount: number;
  keywordInFirst100: boolean;
  faqCount: number;
}

interface RankMathScore {
  total: number;
  breakdown: {
    contentLength: number;
    keywordInFirstPara: number;
    keywordInH1: number;
    keywordInH2s: number;
    keywordDensity: number;
    internalLinks: number;
    outboundLinks: number;
    faqSection: number;
    calloutBoxes: number;
    tables: number;
    metaDescription: number;
    readability: number;
  };
  recommendations: string[];
}

interface OrphanArticle {
  id: string;
  title: string;
  slug: string;
  category: string;
  daysPublished: number;
}

// ============================================
// MAIN ROUTE HANDLER
// ============================================

export async function POST(req: NextRequest) {
  const startTime = Date.now();

  try {
    const { 
      article, 
      title, 
      keywords, 
      plan,
      articleId, // If updating existing article
      pipelineId 
    } = await req.json();

    console.log('🚀 STAGE 6: SEO Optimization (Claude Sonnet 4 + OpenAI)');
    console.log(`📊 Article: "${title}"`);

    // Validate required inputs
    if (!article || article.trim().length === 0) {
      return NextResponse.json(
        { success: false, error: 'No article content provided for SEO optimization' },
        { status: 400 }
      );
    }

    // Ensure keywords is an array with at least one value
    const safeKeywords = Array.isArray(keywords) && keywords.length > 0
      ? keywords
      : [title?.split(' ').slice(0, 3).join(' ') || 'BPO outsourcing']; // Fallback to title words

    console.log(`🎯 Keywords: ${safeKeywords.slice(0, 3).join(', ')}...`);

    // ============================================
    // PHASE 1: Run independent steps in PARALLEL
    // (cannibalization + embeddings + SEO analysis at the same time)
    // ============================================
    console.log('\n⚡ Phase 1: Running Steps 1-2-5 in parallel...');

    const [cannibalizationWarnings, embeddingsResult, seoAnalysis] = await Promise.all([
      // STEP 1: Keyword Cannibalization Check
      checkKeywordCannibalization(safeKeywords).then(warnings => {
        if (warnings.length > 0) {
          console.log(`⚠️  Step 1: Found ${warnings.length} keyword conflicts`);
        } else {
          console.log('✅ Step 1: No keyword cannibalization detected');
        }
        return warnings;
      }),

      // STEP 2: Generate Vector Embeddings (OpenAI)
      generateArticleEmbeddings(article, title).then(embs => {
        console.log(`✅ Step 2: Generated ${embs.length} embedding chunks`);
        return embs;
      }).catch((embError: any) => {
        console.log(`⚠️  Step 2: Embeddings failed: ${embError.message}`);
        return [] as Array<{ chunkIndex: number; content: string; embedding: number[] }>;
      }),

      // STEP 5: SEO Analysis (local, instant)
      Promise.resolve(analyzeSEO(article, safeKeywords[0])).then(analysis => {
        console.log(`✅ Step 5: SEO Analysis — density: ${(analysis.keywordDensity * 100).toFixed(2)}%, readability: ${analysis.readabilityScore.toFixed(1)}`);
        return analysis;
      }),
    ]);

    const embeddings = embeddingsResult;

    // STEP 6: RankMath Score (instant, depends on step 5)
    const rankMathScore = calculateRankMathScore(article, safeKeywords[0], seoAnalysis);
    console.log(`✅ Step 6: RankMath Score: ${rankMathScore.total}/100`);

    // ============================================
    // PHASE 2: Vector search + orphan detection in PARALLEL
    // ============================================
    console.log('\n⚡ Phase 2: Running Steps 3+7 in parallel...');

    const [similarArticlesResult, orphanArticles] = await Promise.all([
      // STEP 3: Find Similar Articles
      (async () => {
        let results: any[] = [];
        if (embeddings.length > 0) {
          results = await findSimilarArticles(embeddings[0].embedding, articleId, 15);
        }
        if (results.length === 0) {
          console.log('⚠️  Step 3: Vector search empty, using keyword fallback...');
          results = await findRelatedArticlesByKeyword(safeKeywords, articleId);
        }
        console.log(`✅ Step 3: Found ${results.length} similar articles`);
        return results;
      })(),

      // STEP 7: Detect Orphan Articles
      detectOrphanArticles().then(orphans => {
        console.log(`✅ Step 7: Found ${orphans.length} orphan articles`);
        return orphans;
      }),
    ]);

    const similarArticles = similarArticlesResult;

    // ============================================
    // STEP 4: Categorize Internal Link Relationships (Claude call)
    // ============================================
    console.log('\n🎯 Step 4: Categorizing link relationships (4-way)...');
    const internalLinkSuggestions = await categorizeInternalLinks(
      article,
      title,
      safeKeywords,
      similarArticles,
      plan
    );

    console.log(`✅ Generated ${internalLinkSuggestions.length} link suggestions`);
    const linkTypes = internalLinkSuggestions.reduce((acc, link) => {
      acc[link.linkType] = (acc[link.linkType] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
    console.log(`   Parent: ${linkTypes.parent || 0} | Child: ${linkTypes.child || 0} | Sibling: ${linkTypes.sibling || 0} | Cross-silo: ${linkTypes['cross-silo'] || 0}`);

    // ============================================
    // STEP 8a: BPOC Promotional Feature Lookup (semantic)
    // ============================================
    let bpocPromos: Array<{ feature_name: string; feature_url: string; description: string; cta_templates: string[] }> = [];
    try {
      console.log('\n📢 Step 8a: Finding matching BPOC promotions...');
      const promoEmbedText = `${title}. ${safeKeywords.join(', ')}. ${plan?.silo || ''}`;
      const promoEmbedRes = await openai.embeddings.create({
        model: 'text-embedding-3-small',
        input: promoEmbedText,
      });
      const promoEmbedding = promoEmbedRes.data[0].embedding;

      const { data: promos } = await supabase.rpc('match_bpoc_promotions', {
        query_embedding: promoEmbedding,
        match_threshold: 0.3,
        match_count: 3,
      });

      if (promos && promos.length > 0) {
        bpocPromos = promos;
        console.log(`✅ Found ${promos.length} BPOC promotions: ${promos.map((p: any) => p.feature_name).join(', ')}`);
      } else {
        console.log('ℹ️  No matching BPOC promotions for this article');
      }
    } catch (promoErr: any) {
      console.log(`⚠️  BPOC promotion lookup failed (non-critical): ${promoErr.message}`);
    }

    // ============================================
    // STEP 8b: Claude Sonnet 4 - Link Insertion & Optimization
    // ============================================
    console.log('\n🤖 Step 8b: Claude optimizing article...');
    const optimizedArticle = await optimizeWithClaude(
      article,
      title,
      safeKeywords,
      internalLinkSuggestions,
      plan,
      seoAnalysis,
      rankMathScore,
      bpocPromos
    );
    console.log('✅ Article optimized with links and SEO improvements');

    // ============================================
    // STEP 9: Save to Database (non-blocking)
    // ============================================
    console.log('\n💾 Step 9: Saving to database...');

    // Save embeddings for future semantic search - non-blocking
    if (articleId && embeddings.length > 0) {
      try {
        await saveEmbeddings(articleId, embeddings);
        console.log(`✅ Saved ${embeddings.length} embeddings`);
      } catch (embErr: any) {
        console.log(`⚠️  Embeddings save skipped: ${embErr.message}`);
      }
    }

    // Save targeted keywords (prevent future cannibalization) - non-blocking
    try {
      await saveTargetedKeywords(articleId, safeKeywords, plan?.silo || 'general');
      console.log(`✅ Saved ${safeKeywords.length} targeted keywords`);
    } catch (kwErr: any) {
      console.log(`⚠️  Keywords save skipped: ${kwErr.message}`);
    }

    // Update pipeline metadata - non-blocking
    if (pipelineId) {
      try {
        await supabase
          .from('content_pipelines')
          .update({
            seo_optimization: {
              cannibalizationWarnings,
              internalLinkSuggestions,
              seoAnalysis,
              rankMathScore,
              orphanArticles: orphanArticles.slice(0, 5), // Top 5 only
              optimizedAt: new Date().toISOString(),
            },
            current_stage: 6,
            last_updated: new Date().toISOString(),
          })
          .eq('id', pipelineId);
        console.log('✅ Updated pipeline metadata');
      } catch (pipeErr: any) {
        console.log(`⚠️  Pipeline update skipped: ${pipeErr.message}`);
      }
    }

    // ============================================
    // DONE!
    // ============================================
    const duration = ((Date.now() - startTime) / 1000).toFixed(2);
    console.log(`\n✅ STAGE 6 COMPLETE in ${duration}s`);

    // Count links in optimized article for stats
    const internalLinksCount = (optimizedArticle.match(/\[([^\]]+)\]\(\/insights\/[^\)]+\)/g) || []).length;
    const outboundLinksCount = (optimizedArticle.match(/\[([^\]]+)\]\(https?:\/\/[^\)]+\)/g) || []).length;

    // Build internal/outbound link details for the UI
    const internalLinkDetails = (optimizedArticle.match(/\[([^\]]+)\]\(\/insights\/[^\)]+\)/g) || []).map((link: string) => {
      const match = link.match(/\[([^\]]+)\]\(([^\)]+)\)/);
      return match ? { anchor: match[1], url: match[2] } : { anchor: link, url: '' };
    });
    const outboundLinkDetails = (optimizedArticle.match(/\[([^\]]+)\]\(https?:\/\/[^\)]+\)/g) || []).map((link: string) => {
      const match = link.match(/\[([^\]]+)\]\(([^\)]+)\)/);
      return match ? { anchor: match[1], url: match[2] } : { anchor: link, url: '' };
    });

    // Build changes summary for UI display
    const changes = {
      headingsOptimized: seoAnalysis.headingKeywordCount || 0,
      headingsTotal: seoAnalysis.headingCount || 0,
      keywordDensity: typeof seoAnalysis.keywordDensity === 'number' ? `${(seoAnalysis.keywordDensity * 100).toFixed(1)}%` : (seoAnalysis.keywordDensity || '0%'),
      keywordInFirst100Words: seoAnalysis.keywordInFirst100 ?? true,
      faqSectionsAdded: seoAnalysis.faqCount || 0,
      internalLinksAdded: internalLinksCount,
      internalLinkDetails,
      outboundLinksAdded: outboundLinksCount,
      outboundLinkDetails,
      readabilityScore: seoAnalysis.readabilityScore || 'Good',
      estimatedRankMathScore: rankMathScore.total,
      wordCountBefore: seoAnalysis.totalWords || 0,
      wordCountAfter: optimizedArticle.split(/\s+/).length,
    };

    const summaryParts = [
      `${changes.headingsOptimized} headings optimized`,
      `${internalLinksCount} internal links`,
      `${outboundLinksCount} outbound links`,
      `Keyword density: ${changes.keywordDensity}`,
      `Readability: ${changes.readabilityScore}`,
      `Rank Math: ${rankMathScore.total}/100`,
    ];

    return NextResponse.json({
      success: true,
      optimizedArticle,
      // Original format
      seoStats: {
        internalLinksCount,
        outboundLinksCount,
        rankMathScore: rankMathScore.total,
        readabilityScore: seoAnalysis.readabilityScore,
        keywordDensity: seoAnalysis.keywordDensity,
        wordCount: seoAnalysis.totalWords,
        estimatedRankMathScore: rankMathScore.total,
      },
      // New: detailed changes for UI display
      changes,
      summary: summaryParts.join(' | '),
      // Original metadata
      metadata: {
        cannibalizationWarnings,
        internalLinkSuggestions: internalLinkSuggestions.slice(0, 8),
        seoAnalysis,
        rankMathScore,
        orphanArticles: orphanArticles.slice(0, 5),
        embeddingsGenerated: embeddings.length,
        similarArticlesFound: similarArticles.length,
        processingTime: parseFloat(duration),
      },
    });

  } catch (error: any) {
    console.error('❌ SEO Optimization error:', error);
    await logError(error, {
      endpoint: '/api/admin/insights/pipeline/seo-optimize',
      http_method: 'POST',
      external_service: 'claude_sonnet_4',
    });
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}

// ============================================
// HELPER FUNCTIONS
// ============================================

/**
 * Check if target keywords are already used in other published articles
 */
async function checkKeywordCannibalization(
  keywords: string[]
): Promise<KeywordCannibalizationWarning[]> {
  if (!keywords || keywords.length === 0) return [];

  try {
    const { data, error } = await supabase.rpc('check_keyword_cannibalization', {
      target_keywords: keywords,
    });

    if (error) throw error;

    return (data || []).map((row: any) => ({
      keyword: row.keyword,
      existingArticleId: row.article_id,
      existingArticleTitle: row.article_title,
      existingArticleSlug: row.article_slug,
      isPrimary: row.is_primary,
      createdAt: row.created_at,
    }));
  } catch (error) {
    console.error('Cannibalization check failed:', error);
    return [];
  }
}

/**
 * Generate vector embeddings using OpenAI (for semantic search)
 */
async function generateArticleEmbeddings(
  article: string,
  title: string
): Promise<Array<{ chunkIndex: number; content: string; embedding: number[] }>> {
  const CHUNK_SIZE = 500; // words
  const words = article.split(/\s+/);
  const chunks: string[] = [];

  // Add title to first chunk for context
  chunks.push(`${title}\n\n${words.slice(0, CHUNK_SIZE).join(' ')}`);

  // Chunk remaining content
  for (let i = CHUNK_SIZE; i < words.length; i += CHUNK_SIZE) {
    chunks.push(words.slice(i, i + CHUNK_SIZE).join(' '));
  }

  // Generate embeddings for each chunk using OpenAI
  const embeddings = await Promise.all(
    chunks.map(async (chunk, index) => {
      const response = await openai.embeddings.create({
        model: 'text-embedding-3-small', // 1536 dimensions, cost-effective
        input: chunk,
      });

      return {
        chunkIndex: index,
        content: chunk,
        embedding: response.data[0].embedding,
      };
    })
  );

  return embeddings;
}

/**
 * Find semantically similar articles using vector search (Supabase pgvector)
 */
async function findSimilarArticles(
  queryEmbedding: number[],
  excludeArticleId?: string,
  limit: number = 10
): Promise<any[]> {
  try {
    const { data, error } = await supabase.rpc('search_similar_articles', {
      query_embedding: queryEmbedding,
      match_count: limit,
      min_similarity: 0.7,
      exclude_article_id: excludeArticleId || null,
    });

    if (error) throw error;
    return data || [];
  } catch (error) {
    console.error('Vector search failed:', error);
    return [];
  }
}

/**
 * Fallback: Find related articles using keyword matching (if vector search fails)
 */
async function findRelatedArticlesByKeyword(
  keywords: string[],
  excludeArticleId?: string
): Promise<any[]> {
  try {
    const { data, error } = await supabase
      .from('insights_posts')
      .select('id, title, slug, category, meta_description, created_at, silo_id, insights_silos(slug)')
      .eq('is_published', true)
      .neq('id', excludeArticleId || '00000000-0000-0000-0000-000000000000')
      .limit(30);

    if (error) throw error;

    // Filter by keyword relevance
    const keywordsLower = keywords.map(k => k.toLowerCase());
    const relevant = (data || []).filter(article => {
      const titleLower = (article.title || '').toLowerCase();
      const descLower = (article.meta_description || '').toLowerCase();
      return keywordsLower.some(kw =>
        titleLower.includes(kw) || descLower.includes(kw)
      );
    });

    if (relevant.length === 0) {
      return (data || []).slice(0, 15);
    }

    return relevant.slice(0, 20);
  } catch (error) {
    console.error('Keyword search failed:', error);
    return [];
  }
}

/**
 * Use Claude Sonnet 4 to analyze which articles are most relevant for internal linking
 */
async function analyzeArticleRelevance(
  article: string,
  title: string,
  keywords: string[],
  candidates: any[]
): Promise<any[]> {
  if (candidates.length === 0) return [];

  const prompt = `You are an SEO expert. Analyze which of these existing articles would be good internal link targets for the new article.

NEW ARTICLE:
Title: "${title}"
Keywords: ${keywords.join(', ')}
Content preview: ${article.slice(0, 1000)}...

CANDIDATE ARTICLES FOR INTERNAL LINKING:
${candidates.map((a, i) => `${i + 1}. "${a.title}" (/${a.slug}) - ${a.category || 'general'}`).join('\n')}

Select the TOP 10 most relevant articles for internal linking. Consider:
- Topic relevance
- Complementary content (not competing)
- User journey value

Return JSON array with article indices and similarity scores (0.7-1.0):
[{"index": 1, "similarity": 0.85, "reason": "Brief reason"}, ...]

Return ONLY valid JSON, no explanations.`;

  try {
    const response = await anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 4096,
      messages: [{ role: 'user', content: prompt }],
    });

    const content = response.content[0].type === 'text' ? response.content[0].text : '';
    const { parseAIJson } = await import('@/lib/parse-ai-json');
    const selections = parseAIJson(content, 'Claude SEO Selections');
    return selections.map((sel: any) => {
      const article = candidates[sel.index - 1];
      if (!article) return null;
      return {
        ...article,
        similarity: sel.similarity || 0.75,
        reason: sel.reason || 'Related content',
      };
    }).filter(Boolean).slice(0, 10);

  } catch (error) {
    console.error('Claude relevance analysis failed:', error);
    // Fallback: return first 10 candidates
    return candidates.slice(0, 10).map(a => ({ ...a, similarity: 0.75 }));
  }
}

/**
 * Categorize internal link relationships using Claude Sonnet 4
 * 
 * Link Types:
 * - PARENT: Overview/pillar article (this article is more detailed)
 * - CHILD: Deep-dive article (this article is overview)
 * - SIBLING: Related topic in same category
 * - CROSS-SILO: Related topic in different category
 */
async function categorizeInternalLinks(
  article: string,
  title: string,
  keywords: string[],
  similarArticles: any[],
  plan: any
): Promise<InternalLinkSuggestion[]> {
  if (similarArticles.length === 0) return [];

  const prompt = `You are an SEO expert analyzing internal linking relationships.

CURRENT ARTICLE:
Title: ${title}
Keywords: ${keywords.join(', ')}
Category/Silo: ${plan?.silo || plan?.category || 'general'}
Content Length: ${article.split(/\s+/).length} words

SIMILAR ARTICLES (found via semantic search):
${similarArticles.map((a, i) => `
${i + 1}. "${a.title}"
   - URL: /insights/${a.insights_silos?.slug || a.silo_slug || "bpo-jobs"}/${a.slug}
   - Category: ${a.category}
   - Similarity: ${(a.similarity * 100).toFixed(1)}%
   - Word Count: ${a.word_count || 'unknown'}
`).join('')}

TASK:
Analyze each similar article and categorize the relationship type:

1. **PARENT** - The similar article is a high-level overview/pillar, and THIS article goes deeper
   Example: Similar article "What is BPO?" (overview) → This article "BPO Call Center Best Practices" (specific)

2. **CHILD** - The similar article goes deeper into a subtopic, and THIS article is the overview
   Example: Similar article "BPO Call Center Scripts for Sales" (specific) → This article "BPO Call Center Guide" (overview)

3. **SIBLING** - The similar article is a related topic at the same depth level, same category
   Example: Similar article "BPO Outsourcing to India" → This article "BPO Outsourcing to Philippines" (parallel topics)

4. **CROSS-SILO** - The similar article is related but in a different category/silo
   Example: Similar article in "HR & Recruitment" → This article in "Call Center Operations"

For each article, provide:
- Link type (parent/child/sibling/cross-silo)
- 3 suggested anchor texts (natural, varied, not exact-match keywords)
- Brief reason for the relationship

Return JSON array:
[
  {
    "articleId": "uuid",
    "linkType": "parent|child|sibling|cross-silo",
    "anchorTexts": ["suggestion 1", "suggestion 2", "suggestion 3"],
    "reason": "Brief explanation"
  }
]

IMPORTANT: Return ONLY valid JSON, no explanations.`;

  try {
    const response = await anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 4096,
      messages: [{ role: 'user', content: prompt }],
    });

    const content = response.content[0].type === 'text' 
      ? response.content[0].text 
      : '';

    // Multi-strategy JSON parsing
    const { parseAIJson } = await import('@/lib/parse-ai-json');
    const categorizations = parseAIJson(content, 'Claude SEO Categorizations');

    // Merge with similar articles data
    return categorizations.map((cat: any) => {
      const article = similarArticles.find(a => a.id === cat.articleId);
      return {
        articleId: cat.articleId,
        title: article?.title || 'Unknown',
        slug: article?.slug || '',
        silo_slug: article?.insights_silos?.slug || '',
        similarity: article?.similarity || 0,
        linkType: cat.linkType,
        anchorTextSuggestions: cat.anchorTexts || [],
        reason: cat.reason || '',
      };
    });

  } catch (error) {
    console.error('Link categorization failed:', error);
    // Fallback: categorize by similarity only
    return similarArticles.slice(0, 5).map(a => ({
      articleId: a.id,
      title: a.title,
      slug: a.slug,
      silo_slug: a.insights_silos?.slug || '',
      similarity: a.similarity,
      linkType: a.similarity > 0.85 ? 'sibling' : 'cross-silo',
      anchorTextSuggestions: [
        `Learn more about ${a.title.toLowerCase()}`,
        `Read our guide on ${a.title.toLowerCase()}`,
        a.title,
      ],
      reason: 'High semantic similarity',
    }));
  }
}

/**
 * Analyze SEO quality of article
 */
function analyzeSEO(article: string, primaryKeyword: string): SEOAnalysis {
  const lowerArticle = article.toLowerCase();
  const lowerKeyword = primaryKeyword.toLowerCase();

  // Word count
  const words = article.split(/\s+/).filter(w => w.length > 0);
  const totalWords = words.length;

  // Keyword density (avoid division by zero)
  const keywordMatches = (lowerArticle.match(new RegExp(lowerKeyword, 'g')) || []).length;
  const keywordDensity = totalWords > 0 ? keywordMatches / totalWords : 0;

  // Check keyword in first paragraph
  const firstParagraph = article.split('\n\n')[0] || '';
  const primaryKeywordInFirstParagraph = firstParagraph.toLowerCase().includes(lowerKeyword);

  // Check keyword in H1
  const h1Match = article.match(/^#\s+(.+)/m);
  const primaryKeywordInH1 = h1Match ? h1Match[1].toLowerCase().includes(lowerKeyword) : false;

  // Count keyword in H2s
  const h2Matches = article.match(/^##\s+(.+)/gm) || [];
  const primaryKeywordInH2Count = h2Matches.filter(h2 => 
    h2.toLowerCase().includes(lowerKeyword)
  ).length;

  // Total heading count and keyword heading count (used by changes object)
  const headingCount = h2Matches.length;
  const headingKeywordCount = primaryKeywordInH2Count;

  // Check keyword in first 100 words
  const first100Words = words.slice(0, 100).join(' ').toLowerCase();
  const keywordInFirst100 = first100Words.includes(lowerKeyword);

  // Count FAQ questions
  const faqSectionMatch = article.match(/##\s*(?:FAQ|Frequently Asked Questions)([\s\S]*?)(?=\n##[^#]|$)/i);
  const faqCount = faqSectionMatch ? (faqSectionMatch[1].match(/###\s+/g) || []).length : 0;

  // Check heading hierarchy
  const headings = article.match(/^#{1,6}\s+/gm) || [];
  const headingLevels = headings.map(h => h.match(/#/g)?.length || 0);
  let headingHierarchyValid = true;
  for (let i = 1; i < headingLevels.length; i++) {
    if (headingLevels[i] > headingLevels[i - 1] + 1) {
      headingHierarchyValid = false;
      break;
    }
  }

  // Readability (Flesch Reading Ease)
  const sentences = article.split(/[.!?]+/).filter(s => s.trim().length > 0);
  const syllables = words.reduce((count, word) => {
    return count + countSyllables(word);
  }, 0);

  const avgSentenceLength = totalWords / sentences.length;
  const avgSyllablesPerWord = totalWords > 0 ? syllables / totalWords : 0;
  const readabilityScore = 206.835 - 1.015 * avgSentenceLength - 84.6 * avgSyllablesPerWord;

  // Complex words (3+ syllables)
  const complexWords = words.filter(w => countSyllables(w) >= 3).length;

  // Average word length
  const totalChars = words.reduce((sum, w) => sum + w.length, 0);
  const avgWordLength = totalWords > 0 ? totalChars / totalWords : 0;

  return {
    keywordDensity,
    primaryKeywordInFirstParagraph,
    primaryKeywordInH1,
    primaryKeywordInH2Count,
    headingHierarchyValid,
    readabilityScore: Math.max(0, Math.min(100, readabilityScore)),
    avgSentenceLength,
    avgWordLength,
    complexWords,
    totalWords,
    // Additional properties used by the changes object in the response
    headingCount,
    headingKeywordCount,
    keywordInFirst100,
    faqCount,
  };
}

/**
 * Calculate RankMath SEO score (0-100)
 */
function calculateRankMathScore(
  article: string,
  primaryKeyword: string,
  seoAnalysis: SEOAnalysis
): RankMathScore {
  const breakdown = {
    contentLength: 0,
    keywordInFirstPara: 0,
    keywordInH1: 0,
    keywordInH2s: 0,
    keywordDensity: 0,
    internalLinks: 0,
    outboundLinks: 0,
    faqSection: 0,
    calloutBoxes: 0,
    tables: 0,
    metaDescription: 0,
    readability: 0,
  };

  const recommendations: string[] = [];

  // Content Length (10 points)
  if (seoAnalysis.totalWords >= 2000) {
    breakdown.contentLength = 10;
  } else if (seoAnalysis.totalWords >= 1500) {
    breakdown.contentLength = 7;
    recommendations.push('Add more content to reach 2000+ words for better SEO');
  } else if (seoAnalysis.totalWords >= 1000) {
    breakdown.contentLength = 5;
    recommendations.push('Aim for 1500+ words for comprehensive coverage');
  } else {
    recommendations.push('Content is too short. Aim for at least 1000 words');
  }

  // Keyword in First Paragraph (10 points)
  if (seoAnalysis.primaryKeywordInFirstParagraph) {
    breakdown.keywordInFirstPara = 10;
  } else {
    recommendations.push('Add primary keyword to first 100 words');
  }

  // Keyword in H1 (10 points)
  if (seoAnalysis.primaryKeywordInH1) {
    breakdown.keywordInH1 = 10;
  } else {
    recommendations.push('Include primary keyword in H1 title');
  }

  // Keyword in H2s (15 points)
  if (seoAnalysis.primaryKeywordInH2Count >= 2) {
    breakdown.keywordInH2s = 15;
  } else if (seoAnalysis.primaryKeywordInH2Count === 1) {
    breakdown.keywordInH2s = 8;
    recommendations.push('Use primary keyword in at least 2 H2 headings');
  } else {
    recommendations.push('Add primary keyword to H2 headings');
  }

  // Keyword Density (10 points)
  const densityPercent = seoAnalysis.keywordDensity * 100;
  if (densityPercent >= 0.5 && densityPercent <= 2.5) {
    breakdown.keywordDensity = 10;
  } else if (densityPercent < 0.5) {
    breakdown.keywordDensity = 5;
    recommendations.push('Increase keyword density (currently too low)');
  } else {
    breakdown.keywordDensity = 5;
    recommendations.push('Reduce keyword density to avoid keyword stuffing');
  }

  // Internal Links (10 points)
  const internalLinks = (article.match(/\[([^\]]+)\]\(\/insights\/[^\)]+\)/g) || []).length;
  if (internalLinks >= 3 && internalLinks <= 8) {
    breakdown.internalLinks = 10;
  } else if (internalLinks >= 2) {
    breakdown.internalLinks = 7;
    recommendations.push('Add 1-2 more internal links');
  } else if (internalLinks === 1) {
    breakdown.internalLinks = 4;
    recommendations.push('Add at least 2 more internal links');
  } else {
    recommendations.push('Add internal links to related articles');
  }

  // Outbound Links (10 points)
  const outboundLinks = (article.match(/\[([^\]]+)\]\(https?:\/\/[^\)]+\)/g) || []).length;
  if (outboundLinks >= 2 && outboundLinks <= 5) {
    breakdown.outboundLinks = 10;
  } else if (outboundLinks === 1) {
    breakdown.outboundLinks = 6;
    recommendations.push('Add 1-2 more outbound links to authoritative sources');
  } else if (outboundLinks === 0) {
    recommendations.push('Add outbound links to .edu/.gov/.org sources');
  } else {
    breakdown.outboundLinks = 7;
    recommendations.push('Too many outbound links may dilute authority');
  }

  // FAQ Section (10 points)
  const hasFAQ = article.includes('## FAQ') || article.includes('## Frequently Asked');
  if (hasFAQ) {
    breakdown.faqSection = 10;
  } else {
    recommendations.push('Add FAQ section for rich snippets');
  }

  // Callout Boxes (5 points)
  const calloutCount = (article.match(/\[TIP\]|\[WARNING\]|\[KEY\]|\[INFO\]|\[SUCCESS\]/g) || []).length;
  if (calloutCount >= 2) {
    breakdown.calloutBoxes = 5;
  } else if (calloutCount === 1) {
    breakdown.calloutBoxes = 3;
  }

  // Tables (5 points)
  const tableCount = (article.match(/\|(.+)\|/g) || []).length;
  if (tableCount >= 3) {
    breakdown.tables = 5;
  } else if (tableCount > 0) {
    breakdown.tables = 3;
  }

  // Meta Description (5 points) - Placeholder
  breakdown.metaDescription = 0;
  recommendations.push('Generate meta description in Stage 7');

  // Readability (5 points)
  if (seoAnalysis.readabilityScore >= 60) {
    breakdown.readability = 5;
  } else if (seoAnalysis.readabilityScore >= 50) {
    breakdown.readability = 3;
    recommendations.push('Improve readability by using shorter sentences');
  } else {
    recommendations.push('Content is difficult to read. Simplify language');
  }

  const total = Object.values(breakdown).reduce((sum, score) => sum + score, 0);

  return {
    total,
    breakdown,
    recommendations,
  };
}

/**
 * Detect orphan articles (no incoming links)
 */
async function detectOrphanArticles(): Promise<OrphanArticle[]> {
  try {
    const { data, error } = await supabase.rpc('detect_orphan_articles');

    if (error) throw error;

    return (data || []).map((row: any) => ({
      id: row.id,
      title: row.title,
      slug: row.slug,
      category: row.category,
      daysPublished: row.days_published,
    }));
  } catch (error) {
    console.error('Orphan detection failed:', error);
    return [];
  }
}

/**
 * Optimize article with Claude Sonnet 4 - insert links and improve SEO
 */
async function optimizeWithClaude(
  article: string,
  title: string,
  keywords: string[],
  internalLinks: InternalLinkSuggestion[],
  plan: any,
  seoAnalysis: SEOAnalysis,
  rankMathScore: RankMathScore,
  bpocPromos: Array<{ feature_name: string; feature_url: string; description: string; cta_templates: string[] }> = []
): Promise<string> {
  // STRATEGY: Instead of asking Claude to rewrite the entire 7000-word article
  // (which takes 5+ minutes and times out), ask Claude for a JSON edit plan,
  // then apply the edits programmatically. This takes ~30 seconds.

  const articlePreview = article.length > 6000 
    ? article.slice(0, 3000) + '\n\n[... middle section ...]\n\n' + article.slice(-3000)
    : article;

  // Get the H2 headings for reference
  const h2Headings = article.match(/^##\s+.+$/gm) || [];

  const prompt = `You are Ate Yna, a Filipino SEO expert. Analyze this article and return a JSON edit plan.

ARTICLE TITLE: ${title}
PRIMARY KEYWORD: ${keywords[0]}
ALL KEYWORDS: ${keywords.join(', ')}

ARTICLE HEADINGS:
${h2Headings.map((h, i) => `${i + 1}. ${h}`).join('\n')}

ARTICLE PREVIEW (first + last 3000 chars):
${articlePreview}

SEO STATS:
- RankMath: ${rankMathScore.total}/100
- Keyword Density: ${(seoAnalysis.keywordDensity * 100).toFixed(2)}% (target: 1-2%)
- Readability: ${seoAnalysis.readabilityScore.toFixed(1)} (Flesch)
- Word Count: ${seoAnalysis.totalWords}

TOP ISSUES: ${rankMathScore.recommendations.slice(0, 3).join(' | ')}

AVAILABLE INTERNAL LINKS:
${internalLinks.slice(0, 6).map((link, i) => `${i + 1}. "${link.title}" → /insights/${link.silo_slug || "bpo-jobs"}/${link.slug} (${link.linkType}) — anchors: ${link.anchorTextSuggestions.slice(0, 2).join(', ')}`).join('\n') || 'NONE AVAILABLE'}

BPOC PROMOTIONAL FEATURES (pick 1-2 that fit NATURALLY — skip if none fit):
${bpocPromos.length > 0 ? bpocPromos.map((p, i) => `${i + 1}. ${p.feature_name} → https://bpoc.io${p.feature_url}\n   ${p.description}\n   CTAs: ${(p.cta_templates || []).slice(0, 2).join(' | ')}`).join('\n') : 'NONE AVAILABLE'}

Return a JSON object with these edit instructions:
{
  "link_insertions": [
    {
      "find_text": "exact sentence or phrase from article to find",
      "replace_with": "same text but with [anchor text](/insights/slug) inserted naturally",
      "reason": "brief reason"
    }
  ],
  "heading_changes": [
    {
      "old_heading": "## Current Heading",
      "new_heading": "## New Heading With Keyword",
      "reason": "brief reason"  
    }
  ],
  "intro_keyword_fix": "If primary keyword is missing from first paragraph, provide a rewritten first sentence that includes it naturally. Otherwise null.",
  "promotional_insertions": [
    {
      "find_text": "exact sentence from article where promo fits naturally",
      "replace_with": "same text with [CTA text](https://bpoc.io/feature-url) woven in",
      "feature_name": "which BPOC feature",
      "reason": "why it fits here"
    }
  ],
  "meta_improvements": {
    "suggested_meta_description": "150-char meta description with primary keyword"
  }
}

RULES:
- Only use links from AVAILABLE INTERNAL LINKS — never invent URLs
- Only use promotional links from BPOC PROMOTIONAL FEATURES — never invent feature URLs
- Promotional links go mid-article or end-of-section, NEVER in the intro
- Max 1-2 promotional insertions — skip if nothing fits naturally
- If no links available, return empty link_insertions array
- find_text must be EXACT text from the article (20-80 chars, unique enough to match once)
- Keep Ate Yna's Filipino-English voice
- Max 6 link insertions, max 3 heading changes
- Return ONLY valid JSON`;

  try {
    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 4096,
      messages: [{ role: 'user', content: prompt }],
    });

    const content = response.content[0].type === 'text' ? response.content[0].text : '';
    const { parseAIJson } = await import('@/lib/parse-ai-json');
    const editPlan = parseAIJson(content, 'Claude SEO Edit Plan');

    // Apply edits programmatically
    let optimized = article;

    // Apply link insertions
    if (editPlan.link_insertions && Array.isArray(editPlan.link_insertions)) {
      for (const insertion of editPlan.link_insertions) {
        if (insertion.find_text && insertion.replace_with) {
          // Only replace if the find_text actually exists in the article
          if (optimized.includes(insertion.find_text)) {
            optimized = optimized.replace(insertion.find_text, insertion.replace_with);
            console.log(`  📎 Link inserted: ${insertion.reason || 'internal link'}`);
          }
        }
      }
    }

    // Apply heading changes
    if (editPlan.heading_changes && Array.isArray(editPlan.heading_changes)) {
      for (const change of editPlan.heading_changes) {
        if (change.old_heading && change.new_heading && optimized.includes(change.old_heading)) {
          optimized = optimized.replace(change.old_heading, change.new_heading);
          console.log(`  📝 Heading updated: ${change.old_heading} → ${change.new_heading}`);
        }
      }
    }

    // Apply promotional insertions
    if (editPlan.promotional_insertions && Array.isArray(editPlan.promotional_insertions)) {
      for (const promo of editPlan.promotional_insertions) {
        if (promo.find_text && promo.replace_with && optimized.includes(promo.find_text)) {
          optimized = optimized.replace(promo.find_text, promo.replace_with);
          console.log(`  📢 Promo inserted: ${promo.feature_name || 'BPOC feature'}`);
        }
      }
    }

    // Apply intro keyword fix
    if (editPlan.intro_keyword_fix && typeof editPlan.intro_keyword_fix === 'string') {
      // Find first paragraph after the first heading
      const firstParaMatch = optimized.match(/^(#[^\n]+\n+)([^\n]+)/m);
      if (firstParaMatch) {
        const oldFirstSentence = firstParaMatch[2].split(/[.!?]/)[0];
        if (oldFirstSentence && !oldFirstSentence.toLowerCase().includes(keywords[0].toLowerCase())) {
          optimized = optimized.replace(oldFirstSentence, editPlan.intro_keyword_fix.replace(/[.!?]$/, ''));
          console.log('  🎯 Intro keyword fix applied');
        }
      }
    }

    return optimized;

  } catch (error) {
    console.error('Claude optimization failed, returning original:', error);
    return article; // Return original if optimization fails
  }
}

/**
 * Save vector embeddings to database for future semantic search
 */
async function saveEmbeddings(
  articleId: string,
  embeddings: Array<{ chunkIndex: number; content: string; embedding: number[] }>
): Promise<void> {
  // Delete existing embeddings for this article
  await supabase
    .from('article_embeddings')
    .delete()
    .eq('article_id', articleId);

  // Insert new embeddings
  const rows = embeddings.map(emb => ({
    article_id: articleId,
    chunk_index: emb.chunkIndex,
    content: emb.content,
    embedding: emb.embedding,
  }));

  const { error } = await supabase
    .from('article_embeddings')
    .insert(rows);

  if (error) throw error;
}

/**
 * Save targeted keywords to prevent cannibalization
 */
async function saveTargetedKeywords(
  articleId: string | undefined,
  keywords: string[],
  silo: string
): Promise<void> {
  if (!articleId) return;

  // Delete existing keywords for this article
  await supabase
    .from('targeted_keywords')
    .delete()
    .eq('article_id', articleId);

  // Insert new keywords
  const rows = keywords.map((keyword, index) => ({
    keyword: keyword.toLowerCase(),
    article_id: articleId,
    silo,
    is_primary: index === 0, // First keyword is primary
  }));

  const { error } = await supabase
    .from('targeted_keywords')
    .insert(rows);

  if (error && !error.message.includes('duplicate key')) {
    throw error;
  }
}

/**
 * Count syllables in a word (approximation)
 */
function countSyllables(word: string): number {
  word = word.toLowerCase().replace(/[^a-z]/g, '');
  if (word.length <= 3) return 1;
  
  const vowels = 'aeiouy';
  let count = 0;
  let previousWasVowel = false;
  
  for (let i = 0; i < word.length; i++) {
    const isVowel = vowels.includes(word[i]);
    if (isVowel && !previousWasVowel) {
      count++;
    }
    previousWasVowel = isVowel;
  }
  
  // Adjust for silent 'e'
  if (word.endsWith('e')) {
    count--;
  }
  
  return Math.max(1, count);
}

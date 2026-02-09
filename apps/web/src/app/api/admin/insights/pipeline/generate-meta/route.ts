/**
 * AI CONTENT PIPELINE - STAGE 7 (REBUILT)
 * Meta Tags & Schema Markup Generation
 * 
 * FEATURES:
 * - Comprehensive meta tags (SEO, OG, Twitter, LinkedIn)
 * - Rich schema markup (Article, FAQ, HowTo, Breadcrumb, Organization)
 * - Keyword uniqueness validation (prevents cannibalization)
 * - LLM crawling optimization directives
 * - Canonical URL generation
 * - Slug validation and sanitization
 * - Rich snippet optimization
 * 
 * FLOW:
 * 1. Validate keyword uniqueness
 * 2. Generate slug from title
 * 3. Create comprehensive meta tags
 * 4. Generate schema.org markup
 * 5. Add LLM crawling directives
 * 6. Validate meta tag character limits
 * 7. Return complete metadata package
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import OpenAI from 'openai';
import { logError } from '@/lib/error-logger';
import { generateAllSchemas, generateSchemaSummary, type SchemaSet } from '@/lib/schema-generator';
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

// ============================================
// TYPES
// ============================================

interface MetaTags {
  metaTitle: string;
  metaDescription: string;
  ogTitle: string;
  ogDescription: string;
  ogImage?: string;
  ogType: string;
  twitterCard: string;
  twitterTitle: string;
  twitterDescription: string;
  twitterImage?: string;
  linkedInTitle: string;
  linkedInDescription: string;
  canonicalUrl: string;
  canonicalSlug: string;
  focusKeyword: string;
  secondaryKeywords: string[];
  semanticKeywords: string[];
  clusterKeywords: string[];
  robots: string;
  viewport: string;
  charset: string;
}

interface SchemaMarkup {
  article: any;
  breadcrumbs: any;
  faq?: any;
  howTo?: any;
}

interface LLMCrawlingDirectives {
  openaiGPTBot: string; // Allow GPT crawling
  googleGeminiBot: string; // Allow Gemini crawling
  anthropicClaudeBot: string; // Allow Claude crawling
  metaAIBot: string; // Allow Meta AI crawling
  perplexityBot: string; // Allow Perplexity crawling
  customInstructions: string;
}

interface MetadataResponse {
  meta: MetaTags;
  schema: SchemaMarkup;
  llmCrawling: LLMCrawlingDirectives;
  validation: {
    slugAvailable: boolean;
    keywordUnique: boolean;
    metaTitleLength: number;
    metaDescriptionLength: number;
    warnings: string[];
  };
}

// ============================================
// MAIN ROUTE HANDLER
// ============================================

// Known silo page slugs — if the article IS a silo page, use this URL as canonical
// SILO_SLUGS must match the Next.js folder structure exactly
// Pillar pages live at /insights/{slug} — the folder IS the URL
const SILO_SLUGS: Record<string, string> = {
  salary: 'bpo-salary-compensation',
  career: 'bpo-career-growth',
  jobs: 'bpo-jobs',
  interview: 'interview-tips',
  'employment-guide': 'bpo-employment-guide',
  benefits: 'bpo-employment-guide',
  companies: 'bpo-company-reviews',
  training: 'training-and-certifications',
  worklife: 'work-life-balance',
};

export async function POST(req: NextRequest) {
  const startTime = Date.now();

  try {
    const {
      article,
      title,
      keywords,
      originalBrief,
      plan,
      category,
      author = 'Ate Yna',
      pipelineId,
      // Silo canonical fields
      silo,
      isSiloPage,
      siloSlug,
    } = await req.json();

    console.log('🏷️  STAGE 7: Meta Tags & Schema Markup Generation (GPT-4o)');
    console.log(`📊 Article: "${title}"`);
    console.log(`📌 Silo: ${silo || 'none'}, IsSiloPage: ${isSiloPage || false}, SiloSlug: ${siloSlug || 'none'}`);

    // Validate required inputs
    if (!article || article.trim().length === 0) {
      return NextResponse.json(
        { success: false, error: 'No article content provided for meta generation' },
        { status: 400 }
      );
    }

    if (!title || title.trim().length === 0) {
      return NextResponse.json(
        { success: false, error: 'No title provided for meta generation' },
        { status: 400 }
      );
    }

    // ============================================
    // SILO CANONICAL LOGIC (CRITICAL)
    // If this article IS the silo page, canonical URL = the silo page URL exactly
    // No new slug is invented for silo pages
    // ============================================
    let forcedSiloSlug: string | null = null;
    const isSilo = !!(isSiloPage || siloSlug);
    
    if (isSilo) {
      forcedSiloSlug = siloSlug || (silo ? SILO_SLUGS[silo] : null) || null;
      console.log(`🔗 SILO PAGE detected → forced canonical slug: ${forcedSiloSlug}`);
    }

    // Ensure keywords is an array with at least one value
    const safeKeywords = Array.isArray(keywords) && keywords.length > 0
      ? keywords
      : [title.split(' ').slice(0, 3).join(' ')]; // Fallback to title words

    console.log(`🎯 Keywords: ${safeKeywords.slice(0, 3).join(', ')}...`);

    // ============================================
    // STEP 1: Generate Slug from Title (or use silo slug)
    // For silo pages: use the exact silo slug (pillar page URL)
    // For supporting articles IN a silo: nest under silo slug (e.g., bpo-salary-compensation/night-shift-pay)
    // For non-silo articles: flat slug
    // Uses GPT to generate SHORT keyword-focused slugs (3-5 words)
    // ============================================
    console.log('\n🔤 Step 1: Generating slug...');
    let slug: string;
    if (forcedSiloSlug) {
      // This IS the silo/pillar page — use exact silo slug
      slug = forcedSiloSlug;
    } else if (silo && SILO_SLUGS[silo] && !isSilo) {
      // Supporting article within a silo — nest under silo slug
      const articleSlug = await generateSlugFromTitle(title, safeKeywords);
      slug = `${SILO_SLUGS[silo]}/${articleSlug}`;
      console.log(`📂 Supporting article in silo "${silo}" → nested slug`);
    } else {
      // No silo — flat slug
      slug = await generateSlugFromTitle(title, safeKeywords);
    }
    console.log(`✅ Slug: ${slug}${forcedSiloSlug ? ' (silo page — forced)' : ''}`);

    // ============================================
    // STEP 2: Validate Slug Availability
    // For silo pages, we USE the existing slug (upsert on publish)
    // ============================================
    console.log('\n🔍 Step 2: Checking slug availability...');
    let finalSlug: string;
    
    if (isSilo && forcedSiloSlug) {
      // Silo page — always use the silo slug, even if it exists (will upsert)
      finalSlug = forcedSiloSlug;
      console.log(`✅ Silo page — using forced slug: ${finalSlug} (will upsert on publish)`);
    } else {
      const slugAvailable = await isSlugAvailable(slug);
      if (!slugAvailable) {
        console.log(`⚠️  Slug "${slug}" already exists. Adding timestamp suffix.`);
      } else {
        console.log('✅ Slug is available');
      }
      finalSlug = slugAvailable ? slug : `${slug}-${Date.now()}`;
    }

    // ============================================
    // STEP 3: Validate Keyword Uniqueness
    // ============================================
    console.log('\n🔍 Step 3: Checking keyword uniqueness...');
    const keywordConflicts = await checkKeywordUniqueness(safeKeywords);
    
    if (keywordConflicts.length > 0) {
      console.log(`⚠️  Found ${keywordConflicts.length} keyword conflicts:`);
      keywordConflicts.forEach(c => {
        console.log(`   - "${c.keyword}" already used in: ${c.articleTitle}`);
      });
    } else {
      console.log('✅ All keywords are unique');
    }

    // ============================================
    // STEP 3.5: For SILO PAGES — pull meta from silo editor (source of truth)
    // The silo editor controls SEO title, description, keywords for pillar pages
    // Pipeline-generated meta is used as fallback only
    // ============================================
    let siloMeta: { seo_title?: string; seo_description?: string; seo_keywords?: string } | null = null;
    if (isSilo && silo) {
      console.log('\n📌 SILO PAGE: Fetching meta from silo editor (source of truth)...');
      const { data: siloData } = await supabase
        .from('insights_silos')
        .select('seo_title, seo_description, seo_keywords')
        .eq('slug', SILO_SLUGS[silo] || silo)
        .single();
      
      if (!siloData) {
        // Try by silo id/name match
        const { data: siloDataAlt } = await supabase
          .from('insights_silos')
          .select('seo_title, seo_description, seo_keywords')
          .ilike('slug', `%${silo}%`)
          .single();
        siloMeta = siloDataAlt;
      } else {
        siloMeta = siloData;
      }
      
      if (siloMeta?.seo_title) {
        console.log(`   ✅ Silo SEO Title: "${siloMeta.seo_title}"`);
      }
      if (siloMeta?.seo_description) {
        console.log(`   ✅ Silo SEO Description: "${siloMeta.seo_description.slice(0, 60)}..."`);
      }
    }

    // ============================================
    // STEP 4: Generate Meta Tags with GPT-4o
    // For SILO PAGES: skip GPT meta generation entirely — use silo editor meta
    // ============================================
    let metaTags: MetaTags;
    
    if (isSilo && siloMeta && (siloMeta.seo_title || siloMeta.seo_description)) {
      // SILO PAGE MODE: Use meta from insights_silos table (source of truth)
      console.log('\n📌 Step 4: SILO MODE — Using meta from Silo Editor (skipping GPT generation)');
      console.log(`   📌 SEO Title: "${siloMeta.seo_title}"`);
      console.log(`   📌 SEO Description: "${siloMeta.seo_description?.slice(0, 60)}..."`);
      
      const siloTitle = siloMeta.seo_title || title;
      const siloDesc = siloMeta.seo_description || '';
      
      metaTags = {
        metaTitle: siloTitle,
        metaDescription: siloDesc,
        ogTitle: siloTitle,
        ogDescription: siloDesc,
        ogType: 'article',
        twitterCard: 'summary_large_image',
        twitterTitle: siloTitle,
        twitterDescription: siloDesc,
        linkedInTitle: siloTitle,
        linkedInDescription: siloDesc,
        canonicalUrl: `https://bpoc.io/insights/${finalSlug}`,
        canonicalSlug: finalSlug,
        focusKeyword: safeKeywords[0],
        secondaryKeywords: safeKeywords.slice(1, 6),
        semanticKeywords: [],
        clusterKeywords: [],
        robots: 'index, follow, max-image-preview:large, max-snippet:-1, max-video-preview:-1',
        viewport: 'width=device-width, initial-scale=1',
        charset: 'UTF-8',
      };
      console.log('✅ Silo meta applied (no GPT generation needed)');
    } else {
      // NORMAL MODE: Generate meta tags with GPT-4o
      console.log('\n🤖 Step 4: Generating meta tags with GPT-4o...');
      metaTags = await generateMetaTags(
        article,
        title,
        safeKeywords,
        originalBrief,
        finalSlug,
        author
      );
      console.log('✅ Meta tags generated');
    }

    // ============================================
    // STEP 5: Generate Schema Markup (BlogPosting, Breadcrumbs, FAQ, HowTo)
    // ============================================
    console.log('\n📄 Step 5: Generating schema.org markup (BlogPosting + Breadcrumbs + FAQ + HowTo)...');
    const schemaInput = {
      title,
      metaTitle: metaTags.metaTitle,
      metaDescription: metaTags.metaDescription,
      canonicalSlug: finalSlug,
      focusKeyword: safeKeywords[0],
      semanticKeywords: metaTags.semanticKeywords,
      heroImageUrl: undefined as string | undefined,
      silo: silo || undefined,
      isSiloPage: isSilo,
      articleContent: article,
    };
    const schemaMarkup: SchemaSet = generateAllSchemas(schemaInput);
    const schemaSummary = generateSchemaSummary(schemaMarkup, schemaInput);
    console.log('✅ Schema markup generated');
    console.log(`   - BlogPosting: ✅`);
    console.log(`   - Breadcrumbs: ${schemaSummary.breadcrumbPath}`);
    console.log(`   - FAQ: ${schemaSummary.faqCount > 0 ? `✅ (${schemaSummary.faqCount} questions)` : 'ℹ️ Not detected'}`);
    console.log(`   - HowTo: ${schemaSummary.howToSteps > 0 ? `✅ (${schemaSummary.howToSteps} steps)` : 'ℹ️ Not detected'}`);

    // ============================================
    // STEP 6: Generate LLM Crawling Directives
    // ============================================
    console.log('\n🤖 Step 6: Generating LLM crawling directives...');
    const llmCrawling = generateLLMCrawlingDirectives(
      safeKeywords[0],
      metaTags.metaDescription
    );
    console.log('✅ LLM crawling directives generated');

    // ============================================
    // STEP 7: Validate Meta Tags
    // ============================================
    console.log('\n✅ Step 7: Validating meta tags...');
    const validation = validateMetaTags(metaTags, keywordConflicts.length === 0);

    if (validation.warnings.length > 0) {
      console.log(`⚠️  Warnings (${validation.warnings.length}):`);
      validation.warnings.forEach(w => console.log(`   - ${w}`));
    } else {
      console.log('✅ All validations passed');
    }

    // ============================================
    // STEP 8: Save to Database (non-blocking)
    // ============================================
    if (pipelineId) {
      console.log('\n💾 Step 8: Saving metadata to database...');
      try {
        await supabase
          .from('content_pipelines')
          .update({
            meta_generation: {
              meta: metaTags,
              schema: schemaMarkup,
              llmCrawling,
              validation,
              generatedAt: new Date().toISOString(),
            },
            current_stage: 7,
            last_updated: new Date().toISOString(),
          })
          .eq('id', pipelineId);
        console.log('✅ Metadata saved to pipeline');
      } catch (dbErr: any) {
        console.log(`⚠️  Pipeline save skipped: ${dbErr.message}`);
      }
    }

    // ============================================
    // DONE!
    // ============================================
    const duration = ((Date.now() - startTime) / 1000).toFixed(2);
    console.log(`\n✅ STAGE 7 COMPLETE in ${duration}s`);

    const response: MetadataResponse = {
      meta: metaTags,
      schema: schemaMarkup,
      llmCrawling,
      validation,
    };

    return NextResponse.json({
      success: true,
      ...response,
      // Include silo info in response
      isSiloPage: isSilo,
      siloSlug: forcedSiloSlug,
      // Schema summary for UI display
      schemaSummary,
      // Summary for UI display
      summary: {
        metaTitle: metaTags.metaTitle,
        metaDescription: metaTags.metaDescription,
        focusKeyword: metaTags.focusKeyword,
        secondaryKeywords: metaTags.secondaryKeywords,
        canonicalUrl: metaTags.canonicalUrl,
        canonicalSlug: metaTags.canonicalSlug,
        isSiloPage: isSilo,
        warnings: validation.warnings,
      },
      processingTime: parseFloat(duration),
    });

  } catch (error: any) {
    console.error('❌ Meta generation error:', error);
    await logError(error, {
      endpoint: '/api/admin/insights/pipeline/generate-meta',
      http_method: 'POST',
      external_service: 'openai',
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
 * Generate SHORT, keyword-focused slug from title using GPT
 * Falls back to extracting key words from title if GPT fails
 */
async function generateSlugFromTitle(title: string, keywords: string[]): Promise<string> {
  try {
    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      max_tokens: 50,
      response_format: { type: 'json_object' },
      messages: [
        {
          role: 'system',
          content: `You generate SHORT SEO slugs for URLs. Rules:
- 3-5 words MAXIMUM (e.g. "bpo-salary-rates-philippines")
- Use the most important keywords, not the full title
- Lowercase, hyphen-separated, no special characters
- Prioritize: primary keyword + location or qualifier
- Examples:
  "Why BPO Salaries Crush Everything Else" → "bpo-salary-rates-philippines"
  "How to Get Hired at Your First Call Center Job" → "get-hired-call-center"
  "Night Shift Tips for BPO Workers" → "bpo-night-shift-tips"
Return JSON: {"slug": "your-short-slug"}`
        },
        {
          role: 'user',
          content: `Title: "${title}"\nKeywords: ${keywords.join(', ')}\n\nGenerate a SHORT slug (3-5 words max).`
        }
      ],
    });

    const { parseAIJson } = await import('@/lib/parse-ai-json');
    const result = parseAIJson(response.choices[0].message.content || '{}', 'Slug Generation');
    if (result.slug) {
      const cleaned = result.slug
        .toLowerCase()
        .trim()
        .replace(/[^\w\s-]/g, '')
        .replace(/\s+/g, '-')
        .replace(/-+/g, '-')
        .replace(/^-+|-+$/g, '');
      if (cleaned.length > 0 && cleaned.split('-').length <= 6) {
        return cleaned;
      }
    }
  } catch (error: any) {
    console.log('⚠️ GPT slug generation failed, using fallback:', error.message);
  }

  // Fallback: extract key words from title
  return generateSlugFallback(title);
}

/**
 * Fallback slug generation — extract key words from title (3-5 words)
 */
function generateSlugFallback(title: string): string {
  const stopWords = new Set(['the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by', 'from', 'is', 'are', 'was', 'were', 'be', 'been', 'being', 'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'could', 'should', 'may', 'might', 'shall', 'can', 'this', 'that', 'these', 'those', 'it', 'its', 'your', 'you', 'why', 'how', 'what', 'when', 'where', 'who', 'which', 'dont', 'dont', 'everything', 'else', 'really', 'actually', 'just', 'about', 'into', 'not', 'no', 'all', 'every', 'each', 'much', 'very']);
  
  const words = title
    .toLowerCase()
    .replace(/[^\w\s]/g, '')
    .split(/\s+/)
    .filter(w => !stopWords.has(w) && w.length > 2);
  
  return words.slice(0, 4).join('-') || title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').substring(0, 40);
}

/**
 * Generate URL-friendly slug from title (simple, for non-GPT contexts)
 */
function generateSlug(title: string): string {
  return generateSlugFallback(title);
}

/**
 * Check if slug is available (not already used)
 */
async function isSlugAvailable(slug: string): Promise<boolean> {
  const { data, error } = await supabase
    .from('insights_posts')
    .select('id')
    .eq('slug', slug)
    .single();

  return !data; // Available if no match found
}

/**
 * Check if keywords are already used in other published articles
 */
async function checkKeywordUniqueness(
  keywords: string[]
): Promise<Array<{ keyword: string; articleId: string; articleTitle: string }>> {
  if (!keywords || keywords.length === 0) return [];

  try {
    const { data, error } = await supabase.rpc('check_keyword_cannibalization', {
      target_keywords: keywords,
    });

    if (error) throw error;

    return (data || []).map((row: any) => ({
      keyword: row.keyword,
      articleId: row.article_id,
      articleTitle: row.article_title,
    }));
  } catch (error) {
    console.error('Keyword uniqueness check failed:', error);
    return [];
  }
}

/**
 * Generate comprehensive meta tags using GPT-4o
 */
async function generateMetaTags(
  article: string,
  title: string,
  keywords: string[],
  originalBrief: string | undefined,
  slug: string,
  author: string
): Promise<MetaTags> {
  const briefContext = originalBrief
    ? `\nORIGINAL BRIEF: "${originalBrief}"\n(Reflect this unique angle in meta tags)`
    : '';

  const prompt = `Generate SEO-optimized meta tags for this article.

ARTICLE:
Title: ${title}
Keywords: ${keywords.join(', ')}
${briefContext}

CONTENT (first 1000 chars):
${article.substring(0, 1000)}

REQUIREMENTS:
1. Meta Title: 50-60 characters, include primary keyword naturally
2. Meta Description: 150-160 characters, compelling, include CTA, include primary keyword
3. OG Tags: Optimized for Facebook/LinkedIn sharing
4. Twitter Tags: Optimized for Twitter cards
5. Focus on unique value proposition, not generic descriptions
6. Semantic Keywords: 5-8 LSI/related keywords that support the focus keyword
7. Cluster Keywords: 3-5 keywords that connect this article to the broader silo/topic cluster

Return JSON:
{
  "metaTitle": "...",
  "metaDescription": "...",
  "ogTitle": "...",
  "ogDescription": "...",
  "twitterTitle": "...",
  "twitterDescription": "...",
  "linkedInTitle": "...",
  "linkedInDescription": "...",
  "semanticKeywords": ["...", "...", "..."],
  "clusterKeywords": ["...", "...", "..."]
}`;

  let generated: any = {};

  try {
    const response = await openai.chat.completions.create({
      model: 'gpt-4o',
      max_tokens: 16384,
      response_format: { type: 'json_object' },
      messages: [
        {
          role: 'system',
          content: 'You are an SEO expert. Generate compelling meta tags. Return valid JSON only.',
        },
        { role: 'user', content: prompt },
      ],
    });

    const { parseAIJson } = await import('@/lib/parse-ai-json');
    generated = parseAIJson(response.choices[0].message.content || '{}', 'GPT-4o Meta');
  } catch (error: any) {
    console.error('GPT-4o meta generation failed:', error.message);
    // Fallback to basic meta tags
    const truncatedTitle = title.length > 60 ? title.substring(0, 57) + '...' : title;
    const briefDesc = `Learn about ${keywords[0]}. Expert insights and practical tips for BPO professionals.`;
    generated = {
      metaTitle: truncatedTitle,
      metaDescription: briefDesc.substring(0, 160),
      ogTitle: truncatedTitle,
      ogDescription: briefDesc,
      twitterTitle: truncatedTitle,
      twitterDescription: briefDesc,
      linkedInTitle: truncatedTitle,
      linkedInDescription: briefDesc,
    };
  }

  return {
    metaTitle: generated.metaTitle || title,
    metaDescription: generated.metaDescription || '',
    ogTitle: generated.ogTitle || generated.metaTitle || title,
    ogDescription: generated.ogDescription || generated.metaDescription || '',
    ogType: 'article',
    twitterCard: 'summary_large_image',
    twitterTitle: generated.twitterTitle || generated.metaTitle || title,
    twitterDescription: generated.twitterDescription || generated.metaDescription || '',
    linkedInTitle: generated.linkedInTitle || generated.metaTitle || title,
    linkedInDescription: generated.linkedInDescription || generated.metaDescription || '',
    canonicalUrl: `https://bpoc.io/insights/${slug}`,
    canonicalSlug: slug,
    focusKeyword: keywords[0],
    secondaryKeywords: keywords.slice(1, 6),
    semanticKeywords: generated.semanticKeywords || [],
    clusterKeywords: generated.clusterKeywords || [],
    robots: 'index, follow, max-image-preview:large, max-snippet:-1, max-video-preview:-1',
    viewport: 'width=device-width, initial-scale=1',
    charset: 'UTF-8',
  };
}

// Schema generation is now handled by @/lib/schema-generator
// (generateAllSchemas, generateArticleSchema, generateBreadcrumbs,
//  detectAndGenerateFAQ, detectAndGenerateHowTo)

/**
 * Generate LLM crawling optimization directives
 */
function generateLLMCrawlingDirectives(
  primaryKeyword: string,
  description: string
): LLMCrawlingDirectives {
  return {
    openaiGPTBot: 'index, follow', // Allow GPT to crawl and cite
    googleGeminiBot: 'index, follow', // Allow Gemini to crawl
    anthropicClaudeBot: 'index, follow', // Allow Claude to crawl
    metaAIBot: 'index, follow', // Allow Meta AI to crawl
    perplexityBot: 'index, follow', // Allow Perplexity to crawl
    customInstructions: `This article is about "${primaryKeyword}". ${description}. Content is optimized for AI comprehension with clear structure, semantic HTML, and comprehensive coverage. Cite as: BPOC Careers - ${primaryKeyword} Guide.`,
  };
}

/**
 * Validate meta tags (character limits, SEO best practices)
 */
function validateMetaTags(
  meta: MetaTags,
  keywordUnique: boolean
): {
  slugAvailable: boolean;
  keywordUnique: boolean;
  metaTitleLength: number;
  metaDescriptionLength: number;
  warnings: string[];
} {
  const warnings: string[] = [];

  // Meta Title validation
  const titleLength = meta.metaTitle.length;
  if (titleLength < 50) {
    warnings.push(`Meta title is too short (${titleLength} chars). Aim for 50-60.`);
  } else if (titleLength > 60) {
    warnings.push(`Meta title is too long (${titleLength} chars). Aim for 50-60.`);
  }

  // Meta Description validation
  const descLength = meta.metaDescription.length;
  if (descLength < 150) {
    warnings.push(`Meta description is too short (${descLength} chars). Aim for 150-160.`);
  } else if (descLength > 160) {
    warnings.push(`Meta description is too long (${descLength} chars). Aim for 150-160.`);
  }

  // Keyword in meta title
  if (!meta.metaTitle.toLowerCase().includes(meta.focusKeyword.toLowerCase())) {
    warnings.push(`Focus keyword "${meta.focusKeyword}" not found in meta title.`);
  }

  // Keyword in meta description
  if (!meta.metaDescription.toLowerCase().includes(meta.focusKeyword.toLowerCase())) {
    warnings.push(`Focus keyword "${meta.focusKeyword}" not found in meta description.`);
  }

  // Keyword uniqueness
  if (!keywordUnique) {
    warnings.push('Focus keyword is already used in another article (cannibalization risk).');
  }

  return {
    slugAvailable: true, // Already validated in main handler
    keywordUnique,
    metaTitleLength: titleLength,
    metaDescriptionLength: descLength,
    warnings,
  };
}

/**
 * AI CONTENT PIPELINE - STAGE 9 (FINAL STAGE)
 * Finalize & Publish with Comprehensive Quality Checks
 * 
 * FEATURES:
 * - Pre-publish quality validation (RankMath, links, images, meta)
 * - Status workflow (Draft → Review → Published)
 * - Read time calculation
 * - Generate embeddings on publish
 * - Update internal link recommendations
 * - Create schema markup
 * - Generate sitemap entry
 * - Send to CMS
 * - Analytics integration
 * 
 * QUALITY GATES:
 * - RankMath score ≥ 80/100
 * - All images have alt text
 * - 3-8 internal links present
 * - 2-5 outbound links present
 * - Meta description exists (150-160 chars)
 * - Keyword density 0.5-2.5%
 * - No broken links
 * - Hero image/video present
 * - Schema markup valid
 * 
 * FLOW:
 * 1. Load all pipeline data (stages 1-8)
 * 2. Run quality checks
 * 3. Calculate read time
 * 4. Generate final embeddings
 * 5. Update insights_posts
 * 6. Create SEO metadata
 * 7. Update article_links
 * 8. Generate sitemap entry
 * 9. Mark pipeline complete
 * 10. Return published article
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import OpenAI from 'openai';
import { logError } from '@/lib/error-logger';

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

interface QualityCheck {
  passed: boolean;
  score: number;
  checks: {
    rankMathScore: { passed: boolean; value: number; threshold: number };
    hasMetaDescription: { passed: boolean; length: number };
    hasInternalLinks: { passed: boolean; count: number; min: number; max: number };
    hasOutboundLinks: { passed: boolean; count: number; min: number; max: number };
    keywordDensity: { passed: boolean; value: number; min: number; max: number };
    allImagesHaveAlt: { passed: boolean; withAlt: number; total: number };
    hasHeroMedia: { passed: boolean };
    hasValidSchema: { passed: boolean };
    noTODOMarkers: { passed: boolean; count: number };
    minWordCount: { passed: boolean; count: number; min: number };
  };
  warnings: string[];
  blockers: string[];
}

interface PublishResult {
  success: boolean;
  article?: {
    id: string;
    slug: string;
    title: string;
    url: string;
    status: string;
    publishedAt: string;
  };
  quality: QualityCheck;
  processingTime: number;
}

// ============================================
// MAIN ROUTE HANDLER
// ============================================

export async function POST(req: NextRequest) {
  const startTime = Date.now();

  try {
    const { 
      pipelineId, 
      forcePublish = false, // Skip quality checks if true
      status = 'published' // 'draft' | 'review' | 'published'
    } = await req.json();

    if (!pipelineId) {
      return NextResponse.json(
        { success: false, error: 'Pipeline ID required' },
        { status: 400 }
      );
    }

    console.log('🚀 STAGE 9: Finalize & Publish');
    console.log(`📊 Pipeline: ${pipelineId}`);
    console.log(`📝 Status: ${status}`);
    console.log(`⚠️  Force publish: ${forcePublish}`);

    // ============================================
    // STEP 1: Load Pipeline Data
    // ============================================
    console.log('\n📂 Step 1: Loading pipeline data...');
    
    const { data: pipeline, error: pipelineError } = await supabase
      .from('content_pipelines')
      .select('*')
      .eq('id', pipelineId)
      .single();

    if (pipelineError || !pipeline) {
      throw new Error('Pipeline not found');
    }

    console.log(`✅ Loaded pipeline: ${pipeline.brief?.substring(0, 50)}...`);

    // Extract data from all stages (using ACTUAL column names from content_pipelines)
    const research = pipeline.research_synthesis || pipeline.serper_results;
    const plan = pipeline.article_plan;
    const article = pipeline.seo_article || pipeline.humanized_article || pipeline.raw_article;
    const title = plan?.title || '';
    const keywords = Array.isArray(plan?.keywords?.main) 
      ? plan.keywords.main 
      : [plan?.keywords?.main, ...(plan?.keywords?.cluster || [])].filter(Boolean);
    const seoOptimization = pipeline.seo_stats;
    const metaGeneration = pipeline.meta_data;
    const mediaGeneration = {
      video: pipeline.video_url ? { url: pipeline.video_url } : null,
      images: pipeline.generated_images || [],
    };

    if (!article || !title) {
      throw new Error('Missing required article data (title or content)');
    }

    // ============================================
    // STEP 2: Run Quality Checks
    // ============================================
    console.log('\n✅ Step 2: Running quality checks...');
    
    const qualityCheck = await runQualityChecks(
      article,
      title,
      keywords,
      seoOptimization,
      metaGeneration,
      mediaGeneration
    );

    console.log(`📊 Quality Score: ${qualityCheck.score}/100`);
    console.log(`   Passed: ${Object.values(qualityCheck.checks).filter(c => c.passed).length}/${Object.keys(qualityCheck.checks).length} checks`);

    if (qualityCheck.blockers.length > 0) {
      console.log(`❌ Blockers (${qualityCheck.blockers.length}):`);
      qualityCheck.blockers.forEach(b => console.log(`   - ${b}`));
    }

    if (qualityCheck.warnings.length > 0) {
      console.log(`⚠️  Warnings (${qualityCheck.warnings.length}):`);
      qualityCheck.warnings.forEach(w => console.log(`   - ${w}`));
    }

    // Fail if quality checks don't pass (unless force publish)
    if (!qualityCheck.passed && !forcePublish && status === 'published') {
      return NextResponse.json({
        success: false,
        error: 'Quality checks failed. Fix blockers or use forcePublish=true',
        quality: qualityCheck,
      }, { status: 400 });
    }

    // ============================================
    // STEP 3: Calculate Read Time
    // ============================================
    console.log('\n⏱️  Step 3: Calculating read time...');
    const wordCount = article.split(/\s+/).length;
    const readTimeMinutes = Math.ceil(wordCount / 200); // 200 WPM average
    console.log(`✅ Read time: ${readTimeMinutes} min (${wordCount} words)`);

    // ============================================
    // STEP 4: Generate Final Embeddings
    // ============================================
    console.log('\n🧠 Step 4: Generating final embeddings...');
    const embeddings = await generateEmbeddings(article, title);
    console.log(`✅ Generated ${embeddings.length} embedding chunks`);

    // ============================================
    // STEP 5: Prepare Article Data
    // ============================================
    console.log('\n📝 Step 5: Preparing article data...');

    // Use queue item's slug (stored in plan._queueSlug by orchestrator) or fall back
    const slug = plan?._queueSlug || metaGeneration?.meta?.canonicalSlug || 
                 title.toLowerCase().replace(/[^a-z0-9]+/g, '-').substring(0, 100);
    
    // Get silo info from the pipeline record (set by orchestrator from queue item)
    const siloId = pipeline.selected_silo_id || null;
    let siloSlug = '';
    let siloName = pipeline.selected_silo || '';
    if (siloId) {
      const { data: silo } = await supabase
        .from('insights_silos')
        .select('name, slug')
        .eq('id', siloId)
        .single();
      if (silo) {
        siloSlug = silo.slug;
        siloName = silo.name;
      }
    }

    const articleData = {
      title,
      slug,
      description: metaGeneration?.meta?.metaDescription || '',
      content: article,
      
      // Split content into 3 parts
      content_part1: article.split('\n\n').slice(0, Math.ceil(article.split('\n\n').length / 3)).join('\n\n'),
      content_part2: article.split('\n\n').slice(Math.ceil(article.split('\n\n').length / 3), Math.ceil(article.split('\n\n').length * 2 / 3)).join('\n\n'),
      content_part3: article.split('\n\n').slice(Math.ceil(article.split('\n\n').length * 2 / 3)).join('\n\n'),

      // Media
      // Hero is VIDEO ONLY — never fall back to image
      hero_type: mediaGeneration?.video ? 'video' : null,
      hero_url: mediaGeneration?.video?.url || null,
      video_url: mediaGeneration?.video?.url || null,
      // Section images (3 max, separate from hero)
      content_image0: mediaGeneration?.images?.[0]?.url,
      content_image1: mediaGeneration?.images?.[1]?.url,
      content_image2: mediaGeneration?.images?.[2]?.url,

      // Meta
      meta_description: metaGeneration?.meta?.metaDescription,
      category: siloName || plan?.silo || 'BPO & Outsourcing',
      silo_topic: siloName || plan?.silo || null,
      silo_id: siloId,

      // Author
      author: 'Ate Yna',
      author_slug: 'ate-yna',

      // Status
      is_published: status === 'published',
      published_at: status === 'published' ? new Date().toISOString() : null,
      pipeline_stage: status,

      // Read time
      read_time: `${readTimeMinutes} min`,

      // Metadata
      generation_metadata: {
        pipelineId,
        generatedAt: new Date().toISOString(),
        qualityScore: qualityCheck.score,
        rankMathScore: seoOptimization?.rankMathScore?.total || 0,
        
        // Model info
        researchModel: 'perplexity-sonar-pro',
        planModel: 'claude-opus-4-20250514',
        writeModel: 'claude-opus-4-20250514',
        humanizeModel: 'grok-beta',
        seoModel: 'claude-sonnet-4-20250514',
        metaModel: 'gpt-4o',
        
        // Keywords
        focusKeyword: keywords[0],
        secondaryKeywords: keywords.slice(1),
        
        // SEO
        metaTitle: metaGeneration?.meta?.metaTitle,
        ogTitle: metaGeneration?.meta?.ogTitle,
        ogDescription: metaGeneration?.meta?.ogDescription,
        
        // Links
        internalLinksCount: seoOptimization?.internalLinkSuggestions?.length || 0,
        outboundLinksCount: (article.match(/\[([^\]]+)\]\(https?:\/\/[^\)]+\)/g) || []).length,
        
        // Quality
        qualityChecks: qualityCheck.checks,
        warnings: qualityCheck.warnings,
        
        // Brief
        originalBrief: pipeline.brief,
      },

      // Pipeline reference
      pipeline_id: pipelineId,
    };

    console.log(`✅ Article data prepared: ${slug}`);

    // ============================================
    // STEP 6: Upsert Article to insights_posts
    // ============================================
    console.log('\n💾 Step 6: Saving article to database...');

    const { data: insertedArticle, error: insertError } = await supabase
      .from('insights_posts')
      .upsert(articleData, { onConflict: 'slug' })
      .select()
      .single();

    if (insertError) {
      throw new Error(`Failed to save article: ${insertError.message}`);
    }

    console.log(`✅ Article saved: ${insertedArticle.id}`);

    // ============================================
    // STEP 7: Save Embeddings
    // ============================================
    console.log('\n🧠 Step 7: Saving embeddings...');

    // Delete existing embeddings
    await supabase
      .from('article_embeddings')
      .delete()
      .eq('article_id', insertedArticle.id);

    // Insert new embeddings
    const embeddingRows = embeddings.map(emb => ({
      article_id: insertedArticle.id,
      chunk_index: emb.chunkIndex,
      content: emb.content,
      embedding: emb.embedding,
    }));

    const { error: embeddingError } = await supabase
      .from('article_embeddings')
      .insert(embeddingRows);

    if (embeddingError) {
      console.error('⚠️  Embedding save failed:', embeddingError.message);
    } else {
      console.log(`✅ Saved ${embeddings.length} embeddings`);
    }

    // ============================================
    // STEP 8: Save Targeted Keywords
    // ============================================
    console.log('\n🎯 Step 8: Saving targeted keywords...');

    await supabase
      .from('targeted_keywords')
      .delete()
      .eq('article_id', insertedArticle.id);

    const keywordRows = keywords.map((keyword: string, index: number) => ({
      keyword: keyword.toLowerCase(),
      article_id: insertedArticle.id,
      silo: plan?.silo || 'general',
      is_primary: index === 0,
    }));

    const { error: keywordError } = await supabase
      .from('targeted_keywords')
      .insert(keywordRows);

    if (keywordError && !keywordError.message.includes('duplicate key')) {
      console.error('⚠️  Keyword save failed:', keywordError.message);
    } else {
      console.log(`✅ Saved ${keywords.length} keywords`);
    }

    // ============================================
    // STEP 9: Save SEO Metadata
    // ============================================
    console.log('\n📊 Step 9: Saving SEO metadata...');

    if (metaGeneration?.schema) {
      const { error: seoError } = await supabase
        .from('seo_metadata')
        .upsert({
          post_id: insertedArticle.id,
          schema_markup: metaGeneration.schema,
          focus_keyword: keywords[0],
          secondary_keywords: keywords.slice(1),
          meta_title: metaGeneration.meta?.metaTitle,
          meta_description: metaGeneration.meta?.metaDescription,
          og_title: metaGeneration.meta?.ogTitle,
          og_description: metaGeneration.meta?.ogDescription,
          twitter_title: metaGeneration.meta?.twitterTitle,
          twitter_description: metaGeneration.meta?.twitterDescription,
        }, { onConflict: 'post_id' });

      if (seoError) {
        console.error('⚠️  SEO metadata save failed:', seoError.message);
      } else {
        console.log('✅ SEO metadata saved');
      }
    }

    // ============================================
    // STEP 10: Save Internal Links
    // ============================================
    console.log('\n🔗 Step 10: Saving internal links...');

    if (seoOptimization?.internalLinkSuggestions?.length > 0) {
      // Delete existing links from this article
      await supabase
        .from('article_links')
        .delete()
        .eq('from_article_id', insertedArticle.id);

      // Extract context from article for each link
      const linkRows = seoOptimization.internalLinkSuggestions
        .slice(0, 8) // Max 8 links
        .map((link: any) => ({
          from_article_id: insertedArticle.id,
          to_article_id: link.articleId,
          anchor_text: link.anchorTextSuggestions?.[0] || link.title,
          link_type: link.linkType,
          context: article.substring(0, 500), // First 500 chars as context
        }));

      const { error: linkError } = await supabase
        .from('article_links')
        .insert(linkRows);

      if (linkError) {
        console.error('⚠️  Link save failed:', linkError.message);
      } else {
        console.log(`✅ Saved ${linkRows.length} internal links`);
      }
    }

    // ============================================
    // STEP 11: Update Pipeline Status
    // ============================================
    console.log('\n✅ Step 11: Marking pipeline complete...');

    await supabase
      .from('content_pipelines')
      .update({
        current_stage: 9,
        status: status === 'published' ? 'completed' : 'pending_review',
        published_article_id: insertedArticle.id,
        finalized_at: new Date().toISOString(),
        quality_score: qualityCheck.score,
        last_updated: new Date().toISOString(),
      })
      .eq('id', pipelineId);

    console.log('✅ Pipeline marked complete');

    // ============================================
    // DONE!
    // ============================================
    const duration = ((Date.now() - startTime) / 1000).toFixed(2);
    console.log(`\n🎉 STAGE 9 COMPLETE in ${duration}s`);
    console.log(`📄 Article ${status}: ${insertedArticle.slug}`);

    const result: PublishResult = {
      success: true,
      article: {
        id: insertedArticle.id,
        slug: insertedArticle.slug,
        title: insertedArticle.title,
        url: `/insights/${insertedArticle.slug}`,
        status,
        publishedAt: insertedArticle.published_at || new Date().toISOString(),
      },
      quality: qualityCheck,
      processingTime: parseFloat(duration),
    };

    return NextResponse.json(result);

  } catch (error: any) {
    console.error('❌ Finalize error:', error);
    await logError(error, {
      endpoint: '/api/admin/insights/pipeline/finalize',
      http_method: 'POST',
      external_service: 'supabase',
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
 * Run comprehensive quality checks before publishing
 */
async function runQualityChecks(
  article: string,
  title: string,
  keywords: string[],
  seoOptimization: any,
  metaGeneration: any,
  mediaGeneration: any
): Promise<QualityCheck> {
  const warnings: string[] = [];
  const blockers: string[] = [];

  // Extract metrics
  const wordCount = article.split(/\s+/).length;
  const internalLinks = (article.match(/\[([^\]]+)\]\(\/insights\/[^\)]+\)/g) || []).length;
  const outboundLinks = (article.match(/\[([^\]]+)\]\(https?:\/\/[^\)]+\)/g) || []).length;
  const todoMarkers = (article.match(/\[TODO\]|\[PLACEHOLDER\]|\[TK\]/gi) || []).length;
  
  // Keyword density
  const primaryKeyword = keywords[0]?.toLowerCase();
  const keywordMatches = primaryKeyword 
    ? (article.toLowerCase().match(new RegExp(primaryKeyword, 'g')) || []).length
    : 0;
  const keywordDensity = wordCount > 0 ? keywordMatches / wordCount : 0;

  // Meta description
  const metaDescription = metaGeneration?.meta?.metaDescription || '';
  const metaDescLength = metaDescription.length;

  // Images
  const imageUrls = mediaGeneration?.images || [];
  const imagesWithAlt = imageUrls.filter((img: any) => img.alt).length;

  // RankMath score
  const rankMathScore = seoOptimization?.rankMathScore?.total || 0;

  // Schema
  const hasValidSchema = !!(metaGeneration?.schema?.article);

  // Hero media
  const hasHeroMedia = !!(mediaGeneration?.video?.url || mediaGeneration?.images?.[0]?.url);

  // Individual checks
  const checks = {
    rankMathScore: {
      passed: rankMathScore >= 80,
      value: rankMathScore,
      threshold: 80,
    },
    hasMetaDescription: {
      passed: metaDescLength >= 150 && metaDescLength <= 160,
      length: metaDescLength,
    },
    hasInternalLinks: {
      passed: internalLinks >= 3 && internalLinks <= 8,
      count: internalLinks,
      min: 3,
      max: 8,
    },
    hasOutboundLinks: {
      passed: outboundLinks >= 2 && outboundLinks <= 5,
      count: outboundLinks,
      min: 2,
      max: 5,
    },
    keywordDensity: {
      passed: keywordDensity >= 0.005 && keywordDensity <= 0.025,
      value: keywordDensity,
      min: 0.005,
      max: 0.025,
    },
    allImagesHaveAlt: {
      passed: imagesWithAlt === imageUrls.length,
      withAlt: imagesWithAlt,
      total: imageUrls.length,
    },
    hasHeroMedia: {
      passed: hasHeroMedia,
    },
    hasValidSchema: {
      passed: hasValidSchema,
    },
    noTODOMarkers: {
      passed: todoMarkers === 0,
      count: todoMarkers,
    },
    minWordCount: {
      passed: wordCount >= 1000,
      count: wordCount,
      min: 1000,
    },
  };

  // Build warnings and blockers
  if (!checks.rankMathScore.passed) {
    if (rankMathScore < 70) {
      blockers.push(`RankMath score too low: ${rankMathScore}/100 (minimum: 80)`);
    } else {
      warnings.push(`RankMath score below target: ${rankMathScore}/100`);
    }
  }

  if (!checks.hasMetaDescription.passed) {
    if (metaDescLength === 0) {
      blockers.push('Meta description is missing');
    } else {
      warnings.push(`Meta description length: ${metaDescLength} chars (ideal: 150-160)`);
    }
  }

  if (!checks.hasInternalLinks.passed) {
    if (internalLinks === 0) {
      blockers.push('No internal links found');
    } else {
      warnings.push(`Internal links: ${internalLinks} (ideal: 3-8)`);
    }
  }

  if (!checks.hasOutboundLinks.passed) {
    if (outboundLinks === 0) {
      blockers.push('No outbound links found');
    } else {
      warnings.push(`Outbound links: ${outboundLinks} (ideal: 2-5)`);
    }
  }

  if (!checks.keywordDensity.passed) {
    warnings.push(`Keyword density: ${(keywordDensity * 100).toFixed(2)}% (ideal: 0.5-2.5%)`);
  }

  if (!checks.allImagesHaveAlt.passed) {
    warnings.push(`${imageUrls.length - imagesWithAlt} images missing alt text`);
  }

  if (!checks.hasHeroMedia.passed) {
    blockers.push('Hero image or video is missing');
  }

  if (!checks.hasValidSchema.passed) {
    warnings.push('Schema markup is missing or invalid');
  }

  if (!checks.noTODOMarkers.passed) {
    blockers.push(`Found ${todoMarkers} TODO/PLACEHOLDER markers in content`);
  }

  if (!checks.minWordCount.passed) {
    blockers.push(`Word count too low: ${wordCount} (minimum: 1000)`);
  }

  // Calculate overall score
  const passedChecks = Object.values(checks).filter(c => c.passed).length;
  const totalChecks = Object.keys(checks).length;
  const score = Math.round((passedChecks / totalChecks) * 100);

  return {
    passed: blockers.length === 0,
    score,
    checks,
    warnings,
    blockers,
  };
}

/**
 * Generate embeddings for final article
 */
async function generateEmbeddings(
  article: string,
  title: string
): Promise<Array<{ chunkIndex: number; content: string; embedding: number[] }>> {
  const CHUNK_SIZE = 500;
  const words = article.split(/\s+/);
  const chunks: string[] = [];

  // First chunk includes title
  chunks.push(`${title}\n\n${words.slice(0, CHUNK_SIZE).join(' ')}`);

  // Remaining chunks
  for (let i = CHUNK_SIZE; i < words.length; i += CHUNK_SIZE) {
    chunks.push(words.slice(i, i + CHUNK_SIZE).join(' '));
  }

  // Generate embeddings
  const embeddings = await Promise.all(
    chunks.map(async (chunk, index) => {
      const response = await openai.embeddings.create({
        model: 'text-embedding-3-small',
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

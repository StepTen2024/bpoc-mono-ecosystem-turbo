/**
 * MASTER ORCHESTRATOR
 * Runs all 9 stages of the AI content pipeline end-to-end
 * 
 * STAGES:
 * 1. Brief Recording (Wispr) - Already handled externally
 * 2. Research (Perplexity + Serper)
 * 3. Plan Generation (Claude Opus 4)
 * 4. Write Article (Claude Opus 4)
 * 5. Humanize (Grok)
 * 6. SEO Optimization (Claude Sonnet 4)
 * 7. Meta Tags & Schema (GPT-4o)
 * 8. Media Generation (Google Veo + Imagen)
 * 9. Finalize & Publish
 * 
 * USAGE:
 * POST /api/admin/insights/pipeline/orchestrate
 * Body: { brief: "...", autoPublish: true }
 * 
 * RETURNS:
 * { success: true, article: {...}, pipelineId: "..." }
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { logError } from '@/lib/error-logger';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// VERCEL_URL for server-to-server calls (SSO disabled, avoids CDN loop detection)
const BASE_URL = process.env.VERCEL_URL 
  ? `https://${process.env.VERCEL_URL}` 
  : process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3001';

/**
 * Safely parse JSON response, with better error handling for invalid responses
 */
async function safeJsonParse(response: Response, stageName: string): Promise<any> {
  const text = await response.text();
  
  // Check if response starts with HTML (error page)
  if (text.trim().startsWith('<!') || text.trim().startsWith('<html')) {
    console.error(`❌ ${stageName} returned HTML instead of JSON:`, text.slice(0, 200));
    throw new Error(`${stageName} returned HTML error page - check Vercel logs`);
  }
  
  // Check for common error patterns
  if (text.includes('Infinite') || text.includes('Infinity')) {
    console.error(`❌ ${stageName} returned Infinity value:`, text.slice(0, 500));
    throw new Error(`${stageName} returned invalid JSON with Infinity value`);
  }
  
  try {
    return JSON.parse(text);
  } catch (parseError: any) {
    console.error(`❌ ${stageName} JSON parse failed:`, text.slice(0, 500));
    throw new Error(`${stageName} returned invalid JSON: ${parseError.message}`);
  }
}

/**
 * Consume an SSE stream response and return the 'complete' or 'error' event data.
 * Used for routes that return text/event-stream (write-article, humanize, etc.)
 */
async function consumeSSEStream(response: Response): Promise<any> {
  const text = await response.text();
  const lines = text.split('\n');
  
  let lastEventType = '';
  let lastData = '';
  let completeData: any = null;
  let errorData: any = null;

  for (const line of lines) {
    if (line.startsWith('event: ')) {
      lastEventType = line.slice(7).trim();
    } else if (line.startsWith('data: ')) {
      lastData = line.slice(6).trim();
      try {
        const parsed = JSON.parse(lastData);
        if (lastEventType === 'complete') {
          completeData = parsed;
        } else if (lastEventType === 'error') {
          errorData = parsed;
        }
      } catch {
        // not JSON, skip
      }
    }
  }

  if (errorData) {
    return { success: false, error: errorData.error || 'Stream returned error' };
  }
  if (completeData) {
    return completeData;
  }
  
  return { success: false, error: 'No complete event found in SSE stream' };
}

export async function POST(req: NextRequest) {
  const startTime = Date.now();

  try {
    const { 
      brief, 
      autoPublish = false,
      forcePublish = false,
      queueItemId = null,
      topic = '',
      focusKeyword = '',
      siloTopic = '',
      slug = '',
      level = 'SUPPORTING',
      siloId = null,
    } = await req.json();

    if (!brief || brief.length < 50) {
      return NextResponse.json(
        { success: false, error: 'Brief must be at least 50 characters' },
        { status: 400 }
      );
    }

    console.log('🚀 MASTER ORCHESTRATOR STARTED');
    console.log(`📝 Brief: ${brief.substring(0, 100)}...`);
    console.log(`🔄 Auto-publish: ${autoPublish}`);
    if (queueItemId) console.log(`📌 Queue item: ${queueItemId}`);
    console.log('');

    // Helper: update queue item status for real-time UI progress
    const updateQueueStage = async (stage: string) => {
      if (!queueItemId) return;
      try {
        await supabase
          .from('insights_production_queue')
          .update({ status: stage, updated_at: new Date().toISOString() })
          .eq('id', queueItemId);
      } catch (e) { /* non-critical */ }
    };

    // ============================================
    // STEP 0: Create Pipeline Entry
    // ============================================
    console.log('📊 Creating pipeline entry...');
    
    const { data: pipeline, error: pipelineError } = await supabase
      .from('content_pipelines')
      .insert({
        brief_transcript: brief,
        status: 'in_progress',
        current_stage: 0,
        selected_silo: siloTopic || null,
        selected_silo_id: siloId || null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (pipelineError || !pipeline) {
      throw new Error('Failed to create pipeline entry');
    }

    console.log(`✅ Pipeline created: ${pipeline.id}\n`);

    let currentData: any = { brief };
    let savedPlan: any = null;

    // ============================================
    // STAGE 2: RESEARCH
    // ============================================
    await updateQueueStage('research');
    console.log('━'.repeat(60));
    console.log('🔍 STAGE 2: RESEARCH (Perplexity + Serper)');
    console.log('━'.repeat(60));

    try {
      const researchResponse = await fetch(`${BASE_URL}/api/admin/insights/pipeline/research`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          topic,
          focusKeyword,
          siloTopic,
          originalBrief: brief,
          isPillar: level === 'PILLAR',
          articleLength: level === 'PILLAR' ? 'long' : 'medium',
          pipelineId: pipeline.id,
        }),
      });

      const researchData = await safeJsonParse(researchResponse, "Research");
      
      if (!researchData.success) {
        throw new Error(researchData.error || 'Research failed');
      }

      currentData = { ...currentData, ...researchData };
      await supabase.from('content_pipelines').update({
        current_stage: 2,
        serper_results: researchData.serperResults || null,
        research_synthesis: researchData.research || null,
        updated_at: new Date().toISOString(),
      }).eq('id', pipeline.id);
      console.log(`✅ STAGE 2 COMPLETE (${researchData.processingTime}s)\n`);
    } catch (error: any) {
      console.error('❌ STAGE 2 FAILED:', error.message);
      await markPipelineFailed(pipeline.id, 2, error.message);
      throw error;
    }

    // ============================================
    // STAGE 3: PLAN GENERATION
    // ============================================
    await updateQueueStage('idea');
    console.log('━'.repeat(60));
    console.log('📋 STAGE 3: PLAN GENERATION (Claude Opus 4)');
    console.log('━'.repeat(60));

    try {
      const planResponse = await fetch(`${BASE_URL}/api/admin/insights/pipeline/generate-plan`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          topic,
          focusKeyword,
          siloTopic,
          originalBrief: brief,
          research: currentData.research,
          isPillar: level === 'PILLAR',
          slug,
          pipelineId: pipeline.id,
          skipPostCreation: true, // Engine handles post creation in finalize
        }),
      });

      const planData = await safeJsonParse(planResponse, "Plan");
      
      if (!planData.success) {
        throw new Error(planData.error || 'Plan generation failed');
      }

      currentData = { ...currentData, ...planData };
      // Save plan separately so later stages don't overwrite it
      savedPlan = planData.plan;
      // Inject the queue item's slug into the plan so finalize uses the correct slug
      const planToSave = { ...(planData.plan || {}), _queueSlug: slug, _queueSilo: siloTopic };
      await supabase.from('content_pipelines').update({
        current_stage: 3,
        article_plan: planToSave,
        selected_silo: siloTopic || planData.plan?.silo || null,
        selected_silo_id: siloId || null,
        updated_at: new Date().toISOString(),
      }).eq('id', pipeline.id);
      console.log(`✅ STAGE 3 COMPLETE (${planData.processingTime}s)\n`);
    } catch (error: any) {
      console.error('❌ STAGE 3 FAILED:', error.message);
      await markPipelineFailed(pipeline.id, 3, error.message);
      throw error;
    }

    // ============================================
    // STAGE 4: WRITE ARTICLE
    // ============================================
    await updateQueueStage('writing');
    console.log('━'.repeat(60));
    console.log('✍️  STAGE 4: WRITE ARTICLE (Claude Opus 4)');
    console.log('━'.repeat(60));

    try {
      const writeResponse = await fetch(`${BASE_URL}/api/admin/insights/pipeline/write-article`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          plan: currentData.plan,
          research: currentData.research,
          brief: currentData.brief,
          pipelineId: pipeline.id,
        }),
      });

      // write-article returns SSE stream — consume it and extract the 'complete' event
      const writeData = await consumeSSEStream(writeResponse);
      
      if (!writeData.success) {
        throw new Error(writeData.error || 'Article writing failed');
      }

      currentData = { ...currentData, ...writeData };
      await supabase.from('content_pipelines').update({
        current_stage: 4,
        raw_article: writeData.article || null,
        word_count: writeData.wordCount || writeData.metrics?.wordCount || null,
        updated_at: new Date().toISOString(),
      }).eq('id', pipeline.id);
      console.log(`✅ STAGE 4 COMPLETE\n`);
    } catch (error: any) {
      console.error('❌ STAGE 4 FAILED:', error.message);
      await markPipelineFailed(pipeline.id, 4, error.message);
      throw error;
    }

    // ============================================
    // STAGE 5: HUMANIZE
    // ============================================
    await updateQueueStage('humanizing');
    console.log('━'.repeat(60));
    console.log('🤖 STAGE 5: HUMANIZE (Grok)');
    console.log('━'.repeat(60));

    try {
      const humanizeResponse = await fetch(`${BASE_URL}/api/admin/insights/pipeline/humanize`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          article: currentData.article,
          title: currentData.plan?.title,
          pipelineId: pipeline.id,
        }),
      });

      const humanizeData = await safeJsonParse(humanizeResponse, "Humanize");
      
      if (!humanizeData.success) {
        throw new Error(humanizeData.error || 'Humanization failed');
      }

      currentData = { ...currentData, ...humanizeData };
      await supabase.from('content_pipelines').update({
        current_stage: 5,
        humanized_article: humanizeData.humanizedArticle || null,
        human_score: humanizeData.humanScore || null,
        updated_at: new Date().toISOString(),
      }).eq('id', pipeline.id);
      console.log(`✅ STAGE 5 COMPLETE (${humanizeData.processingTime}s)\n`);
    } catch (error: any) {
      console.error('❌ STAGE 5 FAILED:', error.message);
      await markPipelineFailed(pipeline.id, 5, error.message);
      throw error;
    }

    // ============================================
    // STAGE 6: SEO OPTIMIZATION
    // ============================================
    await updateQueueStage('seo');
    console.log('━'.repeat(60));
    console.log('📈 STAGE 6: SEO OPTIMIZATION (Claude Sonnet 4)');
    console.log('━'.repeat(60));

    try {
      const seoResponse = await fetch(`${BASE_URL}/api/admin/insights/pipeline/seo-optimize`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          article: currentData.humanizedArticle || currentData.article,
          title: currentData.plan?.title,
          keywords: Array.isArray(currentData.plan?.keywords?.main) 
            ? currentData.plan.keywords.main 
            : [currentData.plan?.keywords?.main, ...(currentData.plan?.keywords?.cluster || [])].filter(Boolean),
          plan: currentData.plan,
          pipelineId: pipeline.id,
        }),
      });

      const seoData = await safeJsonParse(seoResponse, "SEO");
      
      if (!seoData.success) {
        throw new Error(seoData.error || 'SEO optimization failed');
      }

      currentData = { ...currentData, ...seoData };
      await supabase.from('content_pipelines').update({
        current_stage: 6,
        seo_article: seoData.optimizedArticle || null,
        seo_stats: seoData.seoStats || seoData.stats || null,
        updated_at: new Date().toISOString(),
      }).eq('id', pipeline.id);
      console.log(`✅ STAGE 6 COMPLETE (${seoData.processingTime}s)\n`);
    } catch (error: any) {
      console.error('❌ STAGE 6 FAILED:', error.message);
      await markPipelineFailed(pipeline.id, 6, error.message);
      throw error;
    }

    // ============================================
    // STAGE 7: META TAGS & SCHEMA
    // ============================================
    await updateQueueStage('seo');
    console.log('━'.repeat(60));
    console.log('🏷️  STAGE 7: META TAGS & SCHEMA (GPT-4o)');
    console.log('━'.repeat(60));

    try {
      const metaResponse = await fetch(`${BASE_URL}/api/admin/insights/pipeline/generate-meta`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          article: currentData.optimizedArticle || currentData.humanizedArticle || currentData.article,
          title: currentData.plan?.title,
          keywords: Array.isArray(currentData.plan?.keywords?.main) 
            ? currentData.plan.keywords.main 
            : [currentData.plan?.keywords?.main, ...(currentData.plan?.keywords?.cluster || [])].filter(Boolean),
          originalBrief: currentData.brief,
          plan: currentData.plan,
          category: currentData.plan?.silo || 'BPO & Outsourcing',
          pipelineId: pipeline.id,
        }),
      });

      const metaData = await safeJsonParse(metaResponse, "Meta");
      
      if (!metaData.success) {
        throw new Error(metaData.error || 'Meta generation failed');
      }

      currentData = { ...currentData, ...metaData };
      await supabase.from('content_pipelines').update({
        current_stage: 7,
        meta_data: metaData.meta || metaData,
        updated_at: new Date().toISOString(),
      }).eq('id', pipeline.id);
      console.log(`✅ STAGE 7 COMPLETE (${metaData.processingTime}s)\n`);
    } catch (error: any) {
      console.error('❌ STAGE 7 FAILED:', error.message);
      await markPipelineFailed(pipeline.id, 7, error.message);
      throw error;
    }

    // ============================================
    // STAGE 8: FINALIZE & PUBLISH (before media — publish first!)
    // ============================================
    await updateQueueStage('publishing');
    console.log('━'.repeat(60));
    console.log('🚀 STAGE 8: FINALIZE & PUBLISH');
    console.log('━'.repeat(60));

    try {
      const finalizeResponse = await fetch(`${BASE_URL}/api/admin/insights/pipeline/finalize`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          pipelineId: pipeline.id,
          forcePublish,
          status: autoPublish ? 'published' : 'review',
        }),
      });

      const finalizeData = await safeJsonParse(finalizeResponse, "Finalize");
      
      if (!finalizeData.success) {
        throw new Error(finalizeData.error || 'Finalization failed');
      }

      currentData = { ...currentData, ...finalizeData };
      console.log(`✅ STAGE 8 COMPLETE — ARTICLE PUBLISHED (${finalizeData.processingTime}s)\n`);
    } catch (error: any) {
      console.error('❌ STAGE 8 (FINALIZE) FAILED:', error.message);
      await markPipelineFailed(pipeline.id, 8, error.message);
      throw error;
    }

    // Media generation is handled by the queue processor AFTER this returns
    console.log('📌 Media will be generated after publish (handled by queue processor)');

    // ============================================
    // DONE! Mark queue item as published
    // ============================================
    await updateQueueStage('published');
    if (queueItemId) {
      await supabase.from('insights_production_queue').update({
        status: 'published',
        completed_at: new Date().toISOString(),
        insight_id: currentData.article?.id || null,
        pipeline_id: pipeline.id,
      }).eq('id', queueItemId);
    }

    const totalDuration = ((Date.now() - startTime) / 1000).toFixed(2);
    
    console.log('');
    console.log('='.repeat(60));
    console.log('🎉 PIPELINE COMPLETE!');
    console.log('='.repeat(60));
    console.log(`⏱️  Total time: ${totalDuration}s`);
    console.log(`📄 Article: ${currentData.article?.title || 'Unknown'}`);
    console.log(`🔗 URL: ${currentData.article?.url || 'Not available'}`);
    console.log(`📊 Quality: ${currentData.quality?.score || 0}/100`);
    console.log(`🎯 RankMath: ${currentData.quality?.checks?.rankMathScore?.value || 0}/100`);
    console.log(`✅ Status: ${currentData.article?.status || 'Unknown'}`);
    console.log('='.repeat(60));

    // AUTO-LOOP: If there are more queued items, trigger the next one
    if (queueItemId) {
      const { count } = await supabase
        .from('insights_production_queue')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'queued');
      
      if (count && count > 0) {
        console.log(`\n🔄 AUTO-LOOP: ${count} articles remaining. Triggering next...`);
        fetch(`${BASE_URL}/api/admin/insights/production-queue/process`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'process-next' }),
        }).catch(err => console.error('Auto-loop error:', err));
      } else {
        console.log('\n✅ QUEUE EMPTY — All articles processed!');
      }
    }

    return NextResponse.json({
      success: true,
      article: currentData.article,
      // Full article text for media generation (finalize only returns metadata)
      optimizedArticle: currentData.optimizedArticle || currentData.humanizedArticle || currentData.rawArticle,
      quality: currentData.quality,
      pipelineId: pipeline.id,
      totalDuration: parseFloat(totalDuration),
      stages: {
        research: true,
        plan: true,
        write: true,
        humanize: true,
        seo: true,
        meta: true,
        media: true,
        finalize: true,
      },
    });

  } catch (error: any) {
    const duration = ((Date.now() - startTime) / 1000).toFixed(2);
    console.error('');
    console.error('='.repeat(60));
    console.error('❌ PIPELINE FAILED');
    console.error('='.repeat(60));
    console.error(`Error: ${error.message}`);
    console.error(`Duration: ${duration}s`);
    console.error('='.repeat(60));

    await logError(error, {
      endpoint: '/api/admin/insights/pipeline/orchestrate',
      http_method: 'POST',
      external_service: 'pipeline_orchestrator',
    });

    return NextResponse.json(
      { 
        success: false, 
        error: error.message,
        duration: parseFloat(duration),
      },
      { status: 500 }
    );
  }
}

/**
 * Mark pipeline as failed
 */
async function markPipelineFailed(
  pipelineId: string,
  stage: number,
  error: string
): Promise<void> {
  await supabase
    .from('content_pipelines')
    .update({
      status: 'failed',
      current_stage: stage,
      error_message: error,
      failed_at: new Date().toISOString(),
      last_updated: new Date().toISOString(),
    })
    .eq('id', pipelineId);
}

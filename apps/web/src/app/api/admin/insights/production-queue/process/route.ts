/**
 * NO HANDS ENGINE — Process Pipeline
 * 
 * Picks the highest priority queued item and runs it through the
 * EXISTING 9-stage pipeline via the orchestrator route.
 * 
 * Does NOT reimplement anything — calls the same routes the UI uses:
 * 1. Research (Perplexity + Serper)
 * 2. Plan (Claude)
 * 3. Write (Claude)
 * 4. Humanize (Grok)
 * 5. SEO (Claude Sonnet)
 * 6. Meta (GPT-4o)
 * 7. Media (Veo + Imagen)
 * 8. Finalize & Publish
 * 
 * The only job of this route is:
 * 1. Pick the next queued item
 * 2. Build a brief from the queue item's data
 * 3. Call the orchestrator
 * 4. Update queue status based on result
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const maxDuration = 300;
export const dynamic = 'force-dynamic';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// VERCEL_URL for server-to-server calls (SSO disabled, avoids CDN loop detection)  
const BASE_URL = process.env.VERCEL_URL 
  ? `https://${process.env.VERCEL_URL}` 
  : process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3001';

// ═══════════════════════════════════════════════════════════
// STATUS HELPERS
// ═══════════════════════════════════════════════════════════

async function updateStatus(
  itemId: string,
  status: string,
  extra: Record<string, any> = {}
) {
  const updates: Record<string, any> = {
    status,
    updated_at: new Date().toISOString(),
    ...extra,
  };
  const { error } = await supabase
    .from('insights_production_queue')
    .update(updates)
    .eq('id', itemId);
  if (error) console.error(`[QUEUE] Status update failed (${status}):`, error.message);
  else console.log(`📌 [QUEUE] ${itemId.slice(0, 8)}… → ${status}`);
}

async function failItem(itemId: string, errorMessage: string, currentRetry: number) {
  await updateStatus(itemId, 'failed', {
    error_message: errorMessage.slice(0, 500),
    retry_count: currentRetry + 1,
  });
}

// ═══════════════════════════════════════════════════════════
// BUILD BRIEF FROM QUEUE ITEM
// ═══════════════════════════════════════════════════════════

function buildBrief(item: any): string {
  const parts = [
    `Write an article about: ${item.title}`,
    ``,
    `TARGET KEYWORDS: ${item.target_keywords || ''}`,
    `CONTENT SUMMARY: ${item.content_summary || ''}`,
    `SILO: ${item.silo_name || ''}`,
    `ARTICLE LEVEL: ${item.level || 'SUPPORTING'}`,
    `SLUG: ${item.slug}`,
    ``,
    `This is a ${item.level === 'PILLAR' ? 'comprehensive pillar page (3000-4500 words)' : 'focused supporting article (1800-2500 words)'} for the ${item.silo_name} silo on bpoc.io.`,
    ``,
    `The article should be written as Ate Yna, targeting Filipino BPO workers.`,
    `Use specific Philippine examples, ₱ salary figures, real company names.`,
  ];

  if (item.cluster_name) {
    parts.push(`KEYWORD CLUSTER: ${item.cluster_name}`);
  }

  return parts.join('\n');
}

// ═══════════════════════════════════════════════════════════
// MAIN PROCESS HANDLER
// ═══════════════════════════════════════════════════════════

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const { action, itemId } = body;

    // Pick the item to process
    let item: any;

    if (action === 'process-item' && itemId) {
      const { data, error } = await supabase
        .from('insights_production_queue')
        .select('*')
        .eq('id', itemId)
        .single();
      if (error || !data) {
        return NextResponse.json({ error: 'Item not found' }, { status: 404 });
      }
      item = data;
    } else {
      // Pick highest priority queued item
      const { data, error } = await supabase
        .from('insights_production_queue')
        .select('*')
        .eq('status', 'queued')
        .order('priority', { ascending: false })
        .order('created_at', { ascending: true })
        .limit(1)
        .single();

      if (error || !data) {
        return NextResponse.json({
          success: true,
          message: 'No queued items to process',
          processed: false,
        });
      }
      item = data;
    }

    console.log(`\n🏭 ══════════════════════════════════════════`);
    console.log(`🏭 NO HANDS ENGINE — Processing: "${item.title}"`);
    console.log(`🏭 Slug: ${item.slug} | Silo: ${item.silo_name} | Level: ${item.level}`);
    console.log(`🏭 Using existing pipeline orchestrator (same as UI)`);
    console.log(`🏭 ══════════════════════════════════════════\n`);

    // Mark as started (use 'research' — 'processing' isn't in the check constraint)
    await updateStatus(item.id, 'research', {
      started_at: new Date().toISOString(),
      error_message: null,
    });

    // Build the brief from queue item data
    const brief = buildBrief(item);

    // Call the EXISTING orchestrator — same route the UI uses
    const orchestratorUrl = `${BASE_URL}/api/admin/insights/pipeline/orchestrate`;
    console.log(`📡 Calling orchestrator: ${orchestratorUrl}`);

    const orchResponse = await fetch(orchestratorUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        brief,
        autoPublish: true,
        forcePublish: true,
        queueItemId: item.id,
        // Pass structured data so pipeline routes get proper fields
        topic: item.title,
        focusKeyword: (item.target_keywords || '').split(',')[0]?.trim() || item.title,
        siloTopic: item.silo_name,
        slug: item.slug,
        level: item.level,
        siloId: item.silo_id,
      }),
    });

    const orchData = await orchResponse.json();

    if (!orchData.success) {
      await failItem(item.id, orchData.error || 'Orchestrator failed', item.retry_count || 0);
      return NextResponse.json({
        success: false,
        error: orchData.error,
        step: 'orchestrator',
      }, { status: 500 });
    }

    // Mark as published (media still generating async)
    await updateStatus(item.id, 'media', {
      insight_id: orchData.article?.id || null,
      pipeline_id: orchData.pipelineId || null,
    });

    console.log(`\n🎉 ══════════════════════════════════════════`);
    console.log(`🎉 PUBLISHED: "${orchData.article?.title || item.title}"`);
    console.log(`🎉 URL: ${orchData.article?.url || `/insights/${item.slug}`}`);
    console.log(`🎉 Pipeline: ${orchData.pipelineId}`);
    console.log(`🎉 Quality: ${orchData.quality?.score || 'N/A'}/100`);
    console.log(`🎉 Duration: ${orchData.totalDuration}s`);
    console.log(`🎉 ══════════════════════════════════════════\n`);

    // GENERATE MEDIA — await it. Fire-and-forget dies on Vercel serverless.
    // Takes ~2 min (video 70s + 3 images 30s + upload 20s). Function has 800s timeout.
    console.log(`🎬 Generating media (video + images)...`);
    try {
      const mediaRes = await fetch(`${BASE_URL}/api/admin/insights/pipeline/generate-media`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          article: orchData.optimizedArticle || orchData.article?.content || '',
          title: orchData.article?.title || item.title,
          keywords: (item.target_keywords || '').split(',').map((k: string) => k.trim()).filter(Boolean),
          category: item.silo_name || 'BPO & Outsourcing',
          style: 'people-focused',
          pipelineId: orchData.pipelineId,
          articleSlug: orchData.article?.slug || item.slug,
          articleId: orchData.article?.id,
          queueItemId: item.id,
        }),
      });
      const mediaData = await mediaRes.json();
      if (mediaData.success) {
        console.log(`✅ Media: video=${!!mediaData.video} images=${mediaData.images?.length || 0}`);
      } else {
        console.log(`⚠️ Media failed: ${mediaData.error} — article published without media`);
      }
    } catch (mediaErr: any) {
      console.log(`⚠️ Media error: ${mediaErr.message} — article published without media`);
    }

    // Mark fully done
    await updateStatus(item.id, 'published', {
      completed_at: new Date().toISOString(),
    });

    // AUTO-LOOP: Process next article (don't wait for media)
    if (action !== 'process-item') {
      const { count } = await supabase
        .from('insights_production_queue')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'queued');

      if (count && count > 0) {
        console.log(`\n🔄 AUTO-LOOP: ${count} articles remaining. Triggering next...`);
        const selfUrl = `${BASE_URL}/api/admin/insights/production-queue/process`;
        fetch(selfUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'process-next' }),
        }).catch(err => console.error('Auto-loop trigger error:', err));
      } else {
        console.log('\n✅ QUEUE EMPTY — Engine complete!');
      }
    }

    return NextResponse.json({
      success: true,
      processed: true,
      article: orchData.article,
      quality: orchData.quality,
      pipelineId: orchData.pipelineId,
      totalDuration: orchData.totalDuration,
      queueItem: {
        id: item.id,
        title: item.title,
        slug: item.slug,
        siloName: item.silo_name,
      },
    });

  } catch (error: any) {
    console.error('❌ [PROCESS] Unhandled error:', error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}

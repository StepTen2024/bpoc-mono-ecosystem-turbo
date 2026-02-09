/**
 * NO HANDS ENGINE — Production Queue API
 * 
 * GET:  Queue stats, recent items, activity log
 * POST: Start the engine (trigger next article processing)
 * PATCH: Update item status (pause, retry, skip)
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const maxDuration = 30;
export const dynamic = 'force-dynamic';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// Engine state (in-memory for this instance — shared via DB flag in production)
let engineRunning = false;

export async function GET() {
  try {
    // 1. Get queue stats by status
    const { data: statusCounts, error: statsErr } = await supabase
      .from('insights_production_queue')
      .select('status');
    
    if (statsErr) throw statsErr;

    const stats: Record<string, number> = {};
    for (const row of statusCounts || []) {
      stats[row.status] = (stats[row.status] || 0) + 1;
    }

    // 2. Get silo breakdown
    const { data: siloCounts } = await supabase
      .from('insights_production_queue')
      .select('silo_name, status');
    
    const siloStats: Record<string, { total: number; published: number; queued: number; inProgress: number; failed: number }> = {};
    for (const row of siloCounts || []) {
      if (!siloStats[row.silo_name]) {
        siloStats[row.silo_name] = { total: 0, published: 0, queued: 0, inProgress: 0, failed: 0 };
      }
      siloStats[row.silo_name].total++;
      if (row.status === 'published') siloStats[row.silo_name].published++;
      else if (row.status === 'queued' || row.status === 'paused') siloStats[row.silo_name].queued++;
      else if (row.status === 'failed') siloStats[row.silo_name].failed++;
      else siloStats[row.silo_name].inProgress++;
    }

    // 3. Get active/recently processed items (for pipeline visualization)
    const { data: activeItems } = await supabase
      .from('insights_production_queue')
      .select('*')
      .not('status', 'in', '("queued","published","paused")')
      .order('updated_at', { ascending: false })
      .limit(10);

    // 4. Get recently published
    const { data: recentPublished } = await supabase
      .from('insights_production_queue')
      .select('*')
      .eq('status', 'published')
      .order('completed_at', { ascending: false })
      .limit(5);

    // 5. Get failed items
    const { data: failedItems } = await supabase
      .from('insights_production_queue')
      .select('*')
      .eq('status', 'failed')
      .order('updated_at', { ascending: false })
      .limit(5);

    // 6. Get next up (highest priority queued items)
    const { data: nextUp } = await supabase
      .from('insights_production_queue')
      .select('*')
      .eq('status', 'queued')
      .order('priority', { ascending: false })
      .order('created_at', { ascending: true })
      .limit(5);

    // 7. Build activity log from recent changes
    const allItems = [
      ...(activeItems || []).map(i => ({ ...i, _type: 'active' })),
      ...(recentPublished || []).map(i => ({ ...i, _type: 'published' })),
      ...(failedItems || []).map(i => ({ ...i, _type: 'failed' })),
    ];

    const activityLog = allItems
      .sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime())
      .slice(0, 20)
      .map(item => ({
        id: item.id,
        timestamp: item.updated_at,
        articleTitle: item.title,
        stage: item.status,
        siloName: item.silo_name,
        type: item.status === 'failed' ? 'error' as const :
              item.status === 'published' ? 'success' as const :
              'info' as const,
        message: item.status === 'failed' 
          ? `Failed: ${item.error_message || 'Unknown error'} (retry #${item.retry_count})`
          : item.status === 'published'
          ? `Published: "${item.title}" → /insights/${item.slug}`
          : `Processing: "${item.title}" — ${item.status} stage`,
      }));

    return NextResponse.json({
      stats: {
        total: statusCounts?.length || 0,
        queued: stats.queued || 0,
        published: stats.published || 0,
        failed: stats.failed || 0,
        paused: stats.paused || 0,
        inProgress: (stats.research || 0) + (stats.idea || 0) + (stats.writing || 0) + 
                    (stats.humanizing || 0) + (stats.seo || 0) + (stats.media || 0) + (stats.publishing || 0),
        research: stats.research || 0,
        idea: stats.idea || 0,
        writing: stats.writing || 0,
        humanizing: stats.humanizing || 0,
        seo: stats.seo || 0,
        media: stats.media || 0,
        publishing: stats.publishing || 0,
      },
      siloStats,
      activeItems: activeItems || [],
      recentPublished: recentPublished || [],
      failedItems: failedItems || [],
      nextUp: nextUp || [],
      activityLog,
      engineRunning,
    });
  } catch (error: any) {
    console.error('❌ [QUEUE] GET error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { action } = body;

    if (action === 'start') {
      engineRunning = true;

      // Trigger processing by calling the process endpoint
      const processUrl = new URL('/api/admin/insights/production-queue/process', req.url);
      
      // Fire-and-forget: trigger the processing pipeline
      fetch(processUrl.toString(), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Cookie': req.headers.get('cookie') || '',
        },
        body: JSON.stringify({ action: 'process-next' }),
      }).catch(err => console.error('Process trigger error:', err));

      return NextResponse.json({ success: true, message: 'Engine started', engineRunning: true });
    }

    if (action === 'stop') {
      engineRunning = false;
      return NextResponse.json({ success: true, message: 'Engine stopping after current article', engineRunning: false });
    }

    if (action === 'process-single') {
      const { itemId } = body;
      if (!itemId) return NextResponse.json({ error: 'itemId required' }, { status: 400 });

      // Set item to research status and trigger processing
      const { error } = await supabase
        .from('insights_production_queue')
        .update({ status: 'research', started_at: new Date().toISOString(), updated_at: new Date().toISOString() })
        .eq('id', itemId);

      if (error) throw error;

      // Trigger processing
      const processUrl = new URL('/api/admin/insights/production-queue/process', req.url);
      fetch(processUrl.toString(), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Cookie': req.headers.get('cookie') || '',
        },
        body: JSON.stringify({ action: 'process-item', itemId }),
      }).catch(err => console.error('Process trigger error:', err));

      return NextResponse.json({ success: true, message: `Processing started for ${itemId}` });
    }

    return NextResponse.json({ error: 'Invalid action. Use: start, stop, process-single' }, { status: 400 });
  } catch (error: any) {
    console.error('❌ [QUEUE] POST error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const body = await req.json();
    const { itemId, action } = body;

    if (!itemId) {
      return NextResponse.json({ error: 'itemId required' }, { status: 400 });
    }

    const updates: Record<string, any> = { updated_at: new Date().toISOString() };

    switch (action) {
      case 'pause':
        updates.status = 'paused';
        break;
      case 'resume':
        updates.status = 'queued';
        break;
      case 'retry':
        updates.status = 'queued';
        updates.error_message = null;
        updates.retry_count = 0;
        break;
      case 'skip':
        updates.status = 'paused';
        updates.error_message = 'Skipped by admin';
        break;
      case 'reset':
        updates.status = 'queued';
        updates.error_message = null;
        updates.retry_count = 0;
        updates.started_at = null;
        updates.completed_at = null;
        updates.pipeline_id = null;
        updates.insight_id = null;
        break;
      default:
        return NextResponse.json({ error: 'Invalid action. Use: pause, resume, retry, skip, reset' }, { status: 400 });
    }

    const { data, error } = await supabase
      .from('insights_production_queue')
      .update(updates)
      .eq('id', itemId)
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json({ success: true, item: data });
  } catch (error: any) {
    console.error('❌ [QUEUE] PATCH error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

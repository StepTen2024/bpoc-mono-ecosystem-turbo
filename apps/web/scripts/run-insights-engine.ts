/**
 * NO HANDS - Insights Production Engine Kickoff
 * 
 * Starts the self-looping engine that processes all queued articles.
 * Run: npx tsx scripts/run-insights-engine.ts
 * 
 * The engine will:
 * 1. Pick the next queued item from insights_production_queue
 * 2. Run the 9-stage pipeline (Research → Plan → Write → Humanize → SEO → Meta → Media → Publish)
 * 3. Auto-trigger itself for the next item
 * 4. Continue until queue is empty
 */

const BASE_URL = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3003';

async function getQueueStats() {
  const { createClient } = await import('@supabase/supabase-js');
  
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const { data, error } = await supabase
    .from('insights_production_queue')
    .select('status');

  if (error) {
    console.error('Error fetching queue:', error);
    return null;
  }

  const stats = {
    total: data.length,
    queued: data.filter(d => d.status === 'queued').length,
    published: data.filter(d => d.status === 'published').length,
    failed: data.filter(d => d.status === 'failed').length,
    processing: data.filter(d => !['queued', 'published', 'failed'].includes(d.status)).length,
  };

  return stats;
}

async function kickoffEngine() {
  console.log('\n🏭 ══════════════════════════════════════════════════════');
  console.log('🏭  NO HANDS — INSIGHTS PRODUCTION ENGINE');
  console.log('🏭 ══════════════════════════════════════════════════════\n');

  // Get current stats
  const stats = await getQueueStats();
  if (stats) {
    console.log('📊 Queue Status:');
    console.log(`   • Queued:     ${stats.queued}`);
    console.log(`   • Published:  ${stats.published}`);
    console.log(`   • Failed:     ${stats.failed}`);
    console.log(`   • Processing: ${stats.processing}`);
    console.log(`   • Total:      ${stats.total}`);
    console.log('');

    if (stats.queued === 0) {
      console.log('✅ No items in queue. Nothing to process!');
      return;
    }

    console.log(`🚀 Starting engine to process ${stats.queued} queued articles...`);
    console.log(`   Each article takes ~3-5 minutes (including media generation)`);
    console.log(`   Estimated time: ${Math.round(stats.queued * 4 / 60)} hours`);
    console.log('');
  }

  // Kick off the engine
  const url = `${BASE_URL}/api/admin/insights/production-queue/process`;
  console.log(`📡 Calling: ${url}`);
  console.log('');

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'process-next' }),
    });

    const data = await response.json();

    if (data.success) {
      console.log('✅ Engine started successfully!');
      console.log('');
      console.log('🔄 The engine is now running and will auto-loop through all queued items.');
      console.log('   Monitor progress in the logs or check the database:');
      console.log('   SELECT status, COUNT(*) FROM insights_production_queue GROUP BY status;');
      console.log('');
      if (data.article) {
        console.log(`📝 First article being processed: "${data.article.title}"`);
      }
    } else {
      console.log('❌ Engine failed to start:', data.error || data.message);
    }
  } catch (error: any) {
    console.error('❌ Error calling engine:', error.message);
    console.log('');
    console.log('Make sure the web app is running: cd apps/web && pnpm dev');
  }
}

// Load env and run
import { config } from 'dotenv';
import { resolve } from 'path';

config({ path: resolve(__dirname, '../.env.local') });

kickoffEngine();

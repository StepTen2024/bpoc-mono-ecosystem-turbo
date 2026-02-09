import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import OpenAI from 'openai';

export const maxDuration = 800;
export const dynamic = 'force-dynamic';

/**
 * CLEANUP / BACKFILL ENGINE
 * 
 * Scans published posts, finds what's missing, generates ONLY what's needed.
 * 
 * Actions:
 *   scan     — Returns a report of all published posts and what they're missing
 *   fix-one  — Fixes one specific post (by id or slug), generating only missing items
 *   fix-next — Finds the next post that needs fixing and fixes it
 *   fix-all  — Processes all posts needing fixes (with auto-continue)
 * 
 * What it checks per post:
 *   - video_url          (hero video)
 *   - hero_type/hero_url (hero metadata)
 *   - content_image0/1/2 (section images)
 *   - section1/2/3_image_alt (image alt text)
 *   - meta_description   (SEO meta)
 */

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY! });

interface PostStatus {
  id: string;
  slug: string;
  title: string;
  silo_slug: string | null;
  missing: string[];
  has: string[];
}

async function scanPosts(): Promise<PostStatus[]> {
  // Fetch silos for slug lookup
  const { data: silos } = await supabase
    .from('insights_silos')
    .select('id, slug');
  const siloMap = new Map((silos || []).map((s: any) => [s.id, s.slug]));

  const { data: posts, error } = await supabase
    .from('insights_posts')
    .select(`
      id, slug, title, silo_id,
      hero_type, hero_url, video_url,
      content_image0, content_image1, content_image2,
      section1_image_alt, section2_image_alt, section3_image_alt,
      meta_description, content
    `)
    .eq('is_published', true)
    .order('created_at', { ascending: true });

  if (error) throw error;

  return (posts || []).map((p: any) => {
    const missing: string[] = [];
    const has: string[] = [];

    // Video
    if (p.video_url) has.push('video');
    else missing.push('video');

    // Hero metadata (should match video)
    if (p.hero_type && p.hero_url) has.push('hero');
    else missing.push('hero');

    // Images (need all 3)
    const imgCount = [p.content_image0, p.content_image1, p.content_image2].filter(Boolean).length;
    if (imgCount === 3) has.push('images');
    else missing.push(`images(${imgCount}/3)`);

    // Alt text (need all 3)
    const altCount = [p.section1_image_alt, p.section2_image_alt, p.section3_image_alt].filter(Boolean).length;
    if (altCount === 3) has.push('alts');
    else missing.push(`alts(${altCount}/3)`);

    // Meta description
    if (p.meta_description) has.push('meta');
    else missing.push('meta');

    return {
      id: p.id,
      slug: p.slug,
      title: p.title,
      silo_slug: siloMap.get(p.silo_id) || null,
      missing,
      has,
    };
  });
}

async function fixPost(post: PostStatus): Promise<{ fixed: string[]; errors: string[] }> {
  const fixed: string[] = [];
  const errors: string[] = [];

  console.log(`\n🔧 Fixing: ${post.title}`);
  console.log(`   Missing: ${post.missing.join(', ')}`);

  // Fetch full post content for prompt generation
  const { data: fullPost } = await supabase
    .from('insights_posts')
    .select('content, title, meta_description')
    .eq('id', post.id)
    .single();

  if (!fullPost) {
    errors.push('Could not fetch post content');
    return { fixed, errors };
  }

  const articleText = fullPost.content || '';
  const keywords = (fullPost.meta_description || fullPost.title || 'bpo jobs philippines')
    .split(/[,.]/)
    .map((k: string) => k.trim())
    .filter(Boolean)
    .slice(0, 5);

  const needsVideo = post.missing.some(m => m === 'video');
  const needsImages = post.missing.some(m => m.startsWith('images'));
  const needsAlts = post.missing.some(m => m.startsWith('alts'));
  const needsMeta = post.missing.some(m => m === 'meta');
  const needsHero = post.missing.some(m => m === 'hero');

  // === GENERATE VIDEO ===
  if (needsVideo) {
    console.log('  🎥 Generating video...');
    try {
      // Use public domain — VERCEL_URL triggers Vercel middleware loop detection
      const BASE_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://www.bpoc.io';

      const response = await fetch(`${BASE_URL}/api/admin/insights/generate-video`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: post.title,
          sectionContent: articleText.substring(0, 2000),
          articleSlug: post.slug,
        }),
      });

      const result = await response.json();
      if (result.videoUrl) {
        await supabase.from('insights_posts').update({
          video_url: result.videoUrl,
          hero_type: 'video',
          hero_url: result.videoUrl,
        }).eq('id', post.id);
        fixed.push('video');
        fixed.push('hero');
        console.log(`  ✅ Video uploaded: ${result.videoUrl.substring(0, 60)}...`);
      } else {
        errors.push(`video: ${result.error || 'no URL returned'}`);
      }
    } catch (err: any) {
      errors.push(`video: ${err.message}`);
      console.log(`  ❌ Video failed: ${err.message}`);
    }
  }

  // === GENERATE IMAGES ===
  if (needsImages) {
    console.log('  🖼️  Generating images...');
    
    // Check which specific images are missing
    const { data: imgCheck } = await supabase
      .from('insights_posts')
      .select('content_image0, content_image1, content_image2')
      .eq('id', post.id)
      .single();

    const missingSlots = [];
    if (!imgCheck?.content_image0) missingSlots.push(0);
    if (!imgCheck?.content_image1) missingSlots.push(1);
    if (!imgCheck?.content_image2) missingSlots.push(2);

    // Extract H2 sections for image prompts
    const h2Matches = articleText.match(/^##\s+(.+)$/gm) || [];
    const sections = h2Matches.map((h: string) => h.replace(/^##\s+/, '')).slice(0, 3);

    for (const slot of missingSlots) {
      const sectionTitle = sections[slot] || `Section ${slot + 1}`;
      console.log(`  🖼️  Generating image ${slot} for "${sectionTitle.substring(0, 40)}..."`);

      try {
        // Find the section content (text between this H2 and the next)
        const sectionRegex = new RegExp(`^## ${sectionTitle.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\n([\\s\\S]*?)(?=^## |$)`, 'gm');
        const sectionMatch = sectionRegex.exec(articleText);
        const sectionContent = sectionMatch ? sectionMatch[1].substring(0, 1000) : sectionTitle;

        const BASE_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://www.bpoc.io';

        const response = await fetch(`${BASE_URL}/api/admin/insights/generate-image`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            title: post.title,
            sectionContent: sectionContent,
            articleSlug: post.slug,
            imageIndex: slot,
          }),
        });

        const result = await response.json();
        if (result.imageUrl) {
          const updateData: any = {};
          updateData[`content_image${slot}`] = result.imageUrl;
          await supabase.from('insights_posts').update(updateData).eq('id', post.id);
          fixed.push(`image${slot}`);
          console.log(`  ✅ Image ${slot} uploaded`);
        } else {
          errors.push(`image${slot}: ${result.error || 'no URL returned'}`);
        }
      } catch (err: any) {
        errors.push(`image${slot}: ${err.message}`);
        console.log(`  ❌ Image ${slot} failed: ${err.message}`);
      }
    }
  }

  // === GENERATE ALT TEXT ===
  if (needsAlts && !needsImages) {
    // Only generate alt text if images exist but alts don't
    console.log('  📝 Generating alt text...');
    try {
      const { data: imgData } = await supabase
        .from('insights_posts')
        .select('content_image0, content_image1, content_image2')
        .eq('id', post.id)
        .single();

      const images = [imgData?.content_image0, imgData?.content_image1, imgData?.content_image2];
      const altUpdate: any = {};

      for (let i = 0; i < 3; i++) {
        if (images[i]) {
          const h2s = (articleText.match(/^##\s+(.+)$/gm) || []).map((h: string) => h.replace(/^##\s+/, ''));
          const section = h2s[i] || post.title;
          altUpdate[`section${i + 1}_image_alt`] = `${section} - ${post.title} | BPOC.io`;
        }
      }

      if (Object.keys(altUpdate).length > 0) {
        await supabase.from('insights_posts').update(altUpdate).eq('id', post.id);
        fixed.push('alts');
        console.log(`  ✅ Alt text generated for ${Object.keys(altUpdate).length} images`);
      }
    } catch (err: any) {
      errors.push(`alts: ${err.message}`);
    }
  }

  // === GENERATE META DESCRIPTION ===
  if (needsMeta) {
    console.log('  📝 Generating meta description...');
    try {
      const response = await openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [{
          role: 'user',
          content: `Write a 150-160 character SEO meta description for this article. Include the primary keyword naturally. Be compelling and accurate.\n\nTitle: ${post.title}\n\nFirst 500 chars: ${articleText.substring(0, 500)}\n\nReturn ONLY the meta description text, nothing else.`,
        }],
        max_tokens: 100,
      });

      const meta = response.choices[0]?.message?.content?.trim();
      if (meta) {
        await supabase.from('insights_posts').update({ meta_description: meta }).eq('id', post.id);
        fixed.push('meta');
        console.log(`  ✅ Meta: ${meta.substring(0, 60)}...`);
      }
    } catch (err: any) {
      errors.push(`meta: ${err.message}`);
    }
  }

  // === FIX HERO (if video exists but hero not set) ===
  if (needsHero && !needsVideo) {
    console.log('  🎯 Fixing hero metadata...');
    try {
      const { data: vidCheck } = await supabase
        .from('insights_posts')
        .select('video_url')
        .eq('id', post.id)
        .single();

      if (vidCheck?.video_url) {
        await supabase.from('insights_posts').update({
          hero_type: 'video',
          hero_url: vidCheck.video_url,
        }).eq('id', post.id);
        fixed.push('hero');
        console.log('  ✅ Hero set to video');
      }
    } catch (err: any) {
      errors.push(`hero: ${err.message}`);
    }
  }

  return { fixed, errors };
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { action = 'scan', id, slug } = body;

    // === SCAN ===
    if (action === 'scan') {
      const posts = await scanPosts();
      const needsFix = posts.filter(p => p.missing.length > 0);
      const complete = posts.filter(p => p.missing.length === 0);

      return NextResponse.json({
        success: true,
        total: posts.length,
        complete: complete.length,
        needsFix: needsFix.length,
        posts: needsFix.map(p => ({
          slug: p.slug,
          title: p.title,
          silo_slug: p.silo_slug,
          missing: p.missing,
          has: p.has,
        })),
      });
    }

    // === FIX-ONE ===
    if (action === 'fix-one') {
      if (!id && !slug) {
        return NextResponse.json({ error: 'id or slug required' }, { status: 400 });
      }

      const posts = await scanPosts();
      const post = posts.find(p => p.id === id || p.slug === slug);
      if (!post) {
        return NextResponse.json({ error: 'Post not found' }, { status: 404 });
      }

      if (post.missing.length === 0) {
        return NextResponse.json({ success: true, message: 'Post already complete', post });
      }

      const result = await fixPost(post);
      return NextResponse.json({ success: true, ...result, post: { slug: post.slug, title: post.title } });
    }

    // === FIX-NEXT ===
    if (action === 'fix-next') {
      const posts = await scanPosts();
      const needsFix = posts.filter(p => p.missing.length > 0);

      if (needsFix.length === 0) {
        return NextResponse.json({ success: true, message: 'All posts complete!', remaining: 0 });
      }

      const post = needsFix[0];
      const result = await fixPost(post);
      return NextResponse.json({
        success: true,
        ...result,
        post: { slug: post.slug, title: post.title, missing: post.missing },
        remaining: needsFix.length - 1,
      });
    }

    return NextResponse.json({ error: `Unknown action: ${action}` }, { status: 400 });

  } catch (error: any) {
    console.error('Cleanup error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

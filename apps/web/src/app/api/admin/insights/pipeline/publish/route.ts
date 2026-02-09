/**
 * AI CONTENT PIPELINE - PUBLISH STAGE
 * Generate Media & Publish Article
 * 
 * This route:
 * 1. Generates hero video/image (if needed)
 * 2. Generates section images (if needed)
 * 3. Uploads media to Supabase storage
 * 4. Publishes article with media URLs
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { logError } from '@/lib/error-logger';
import { VeoService } from '@/lib/veo-service';

export const maxDuration = 300;
export const preferredRegion = 'iad1';
export const dynamic = 'force-dynamic';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const VIDEO_BUCKET_NAME = "insights-images";
const IMAGE_BUCKET_NAME = "insights-images";

/**
 * Generate image using Google Imagen 4
 */
async function generateImageWithImagen4(
  prompt: string,
  slug: string,
  position: string,
  aspectRatio: string = "16:9"
): Promise<string | null> {
  if (!process.env.GOOGLE_GENERATIVE_AI_API_KEY) {
    console.log("⚠️ [PUBLISH] Google AI API key not configured");
    return null;
  }

  try {
    console.log(`🖼️ [PUBLISH] Generating ${position} image with Imagen 4...`);

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/imagen-4.0-generate-001:predict?key=${process.env.GOOGLE_GENERATIVE_AI_API_KEY}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          instances: [{ prompt }],
          parameters: {
            sampleCount: 1,
            aspectRatio,
            personGeneration: "allow_adult",
            safetyFilterLevel: "block_few",
          }
        })
      }
    );

    if (!response.ok) {
      console.log("⚠️ [PUBLISH] Imagen 4 error, trying Fast...");
      const fastResponse = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/imagen-4.0-fast-generate-001:predict?key=${process.env.GOOGLE_GENERATIVE_AI_API_KEY}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            instances: [{ prompt }],
            parameters: {
              sampleCount: 1,
              aspectRatio,
              personGeneration: "allow_adult",
              safetyFilterLevel: "block_few",
            }
          })
        }
      );

      if (!fastResponse.ok) {
        return null;
      }

      const fastData = await fastResponse.json();
      if (!fastData.predictions?.[0]?.bytesBase64Encoded) {
        return null;
      }

      // Upload to Supabase
      const buffer = Buffer.from(fastData.predictions[0].bytesBase64Encoded, 'base64');
      const ext = fastData.predictions[0].mimeType?.includes('png') ? 'png' : 'webp';
      const filename = `articles/${slug}-${position}-${Date.now()}.${ext}`;

      const { error: uploadError } = await supabase.storage
        .from(IMAGE_BUCKET_NAME)
        .upload(filename, buffer, { contentType: fastData.predictions[0].mimeType || 'image/png' });

      if (uploadError) {
        console.error('[PUBLISH] Upload error:', uploadError);
        return null;
      }

      const { data: urlData } = supabase.storage.from(IMAGE_BUCKET_NAME).getPublicUrl(filename);
      console.log(`✅ [PUBLISH] ${position} image generated (Fast)`);
      return urlData.publicUrl;
    }

    const data = await response.json();

    if (!data.predictions?.[0]?.bytesBase64Encoded) {
      return null;
    }

    // Upload to Supabase
    const buffer = Buffer.from(data.predictions[0].bytesBase64Encoded, 'base64');
    const ext = data.predictions[0].mimeType?.includes('png') ? 'png' : 'webp';
    const filename = `articles/${slug}-${position}-${Date.now()}.${ext}`;

    const { error: uploadError } = await supabase.storage
      .from(IMAGE_BUCKET_NAME)
      .upload(filename, buffer, { contentType: data.predictions[0].mimeType || 'image/png' });

    if (uploadError) {
      console.error('[PUBLISH] Upload error:', uploadError);
      return null;
    }

    const { data: urlData } = supabase.storage.from(IMAGE_BUCKET_NAME).getPublicUrl(filename);
    console.log(`✅ [PUBLISH] ${position} image generated`);
    return urlData.publicUrl;

  } catch (error: any) {
    console.log(`⚠️ [PUBLISH] Imagen error for ${position}:`, error.message);
    return null;
  }
}

export async function POST(req: NextRequest) {
  try {
    const {
      title,
      content,
      contentSections,
      slug,
      silo,
      siloId, // UUID of the selected silo
      isPillar, // True if this is a pillar post
      keywords,
      meta,
      heroType, // 'image' or 'video'
      heroSource, // 'generate' or 'upload'
      sectionSource, // 'generate' or 'upload'
      uploadedHeroUrl,
      uploadedSectionUrls,
      sectionImages, // Array of { url, alt, position } for SEO
      coverImageAlt, // Alt text for hero/cover image
      isDraft,
      draftId,
      // Editor compatibility fields (optional)
      iconName,
      color,
      bgColor,
      readTime,
      appliedLinks,
    } = await req.json();

    console.log('📤 PUBLISH: Starting publication process');
    console.log(`   Hero Type: ${heroType}, Hero Source: ${heroSource}`);
    console.log(`   Section Source: ${sectionSource}`);
    console.log(`   Silo: ${silo}, SiloId: ${siloId}, IsPillar: ${isPillar}`);

    // Resolve siloId from slug if not provided
    let resolvedSiloId = siloId;
    if (!resolvedSiloId && silo) {
      const { data: siloData } = await supabase
        .from('insights_silos')
        .select('id')
        .or(`slug.eq.${silo},slug.ilike.%${silo}%`)
        .single();
      if (siloData) {
        resolvedSiloId = siloData.id;
        console.log(`📌 Resolved siloId from slug "${silo}": ${resolvedSiloId}`);
      }
    }

    // Split content into 3 parts
    let contentPart1, contentPart2, contentPart3;

    if (contentSections && contentSections.length >= 3) {
      contentPart1 = contentSections[0];
      contentPart2 = contentSections[1];
      contentPart3 = contentSections[2];
    } else {
      const h2Sections = content.split(/(?=^##\s)/m);

      if (h2Sections.length >= 3) {
        const sectionsPerPart = Math.ceil(h2Sections.length / 3);
        contentPart1 = h2Sections.slice(0, sectionsPerPart).join('\n\n');
        contentPart2 = h2Sections.slice(sectionsPerPart, sectionsPerPart * 2).join('\n\n');
        contentPart3 = h2Sections.slice(sectionsPerPart * 2).join('\n\n');
      } else {
        const paragraphs = content.split('\n\n');
        const third = Math.floor(paragraphs.length / 3);
        contentPart1 = paragraphs.slice(0, third).join('\n\n');
        contentPart2 = paragraphs.slice(third, third * 2).join('\n\n');
        contentPart3 = paragraphs.slice(third * 2).join('\n\n');
      }
    }

    // ========== MEDIA GENERATION ==========
    let heroUrl = uploadedHeroUrl || null;
    let section1Url = uploadedSectionUrls?.[0] || null;
    let section2Url = uploadedSectionUrls?.[1] || null;
    let section3Url = uploadedSectionUrls?.[2] || null;

    // Generate hero video if needed (Google Veo)
    if (heroType === 'video' && heroSource === 'generate' && !uploadedHeroUrl) {
      console.log('🎬 [PUBLISH] Generating hero video with Google Veo...');
      const videoPrompt = `Professional video for article: "${title}". 
Philippine BPO industry, modern call center environment. 
Show real Filipino professionals in authentic work scenarios. 
High quality production, corporate setting, natural lighting. 
NO text overlays, NO watermarks, NO clipart.`;

      try {
        const apiKey = process.env.GOOGLE_GENERATIVE_AI_API_KEY;
        if (!apiKey) {
          console.log('⚠️ [PUBLISH] GOOGLE_GENERATIVE_AI_API_KEY not configured');
        } else {
          const veo = new VeoService(apiKey);
          const veoResult = await veo.generateVideo({
            prompt: videoPrompt,
            duration: 8,
            aspectRatio: '16:9',
            resolution: '1080p'
          });

          if (veoResult.success && veoResult.videoUrl) {
            // Upload to Supabase
            const videoResponse = await fetch(veoResult.videoUrl);
            if (videoResponse.ok) {
              const videoBuffer = Buffer.from(await videoResponse.arrayBuffer());
              const safeSlug = (slug || meta?.canonicalSlug || "video")
                .toLowerCase().replace(/[^a-z0-9]+/g, "-").substring(0, 50);
              const fileName = `ai-generated/${safeSlug}-hero-${Date.now()}.mp4`;

              const { error: uploadError } = await supabase.storage
                .from(VIDEO_BUCKET_NAME)
                .upload(fileName, videoBuffer, {
                  contentType: "video/mp4",
                  cacheControl: "31536000",
                  upsert: true,
                });

              if (!uploadError) {
                const { data: urlData } = supabase.storage.from(VIDEO_BUCKET_NAME).getPublicUrl(fileName);
                heroUrl = urlData.publicUrl;
                console.log('✅ [PUBLISH] Hero video generated and uploaded');
              } else {
                heroUrl = veoResult.videoUrl;
                console.log('⚠️ [PUBLISH] Upload failed, using temporary URL');
              }
            } else {
              heroUrl = veoResult.videoUrl;
            }
          } else {
            console.log('⚠️ [PUBLISH] Veo generation failed:', veoResult.error);
          }
        }
      } catch (veoError: any) {
        console.log('⚠️ [PUBLISH] Video generation error:', veoError.message);
      }
    }

    // Generate hero image if needed
    if (heroType === 'image' && heroSource === 'generate' && !uploadedHeroUrl) {
      console.log('🖼️ [PUBLISH] Generating hero image...');
      const imagePrompt = `Hyper-realistic photograph: Professional featured image for "${title}". Filipino professionals in modern BPO office, natural lighting, professional DSLR quality, authentic expressions. NO: cartoons, illustrations, AI artifacts, distorted faces.`;

      heroUrl = await generateImageWithImagen4(imagePrompt, slug || meta?.canonicalSlug || 'hero', 'hero', '16:9');
    }

    // Generate section images if needed
    if (sectionSource === 'generate' && (!uploadedSectionUrls || uploadedSectionUrls.length === 0)) {
      console.log('🖼️ [PUBLISH] Generating section images...');

      const sectionPrompts = [
        `Hyper-realistic photograph: Filipino BPO professionals collaborating in modern office. Natural lighting, professional quality. NO: cartoons, illustrations.`,
        `Hyper-realistic photograph: Filipino call center agent working professionally. Modern workspace, natural expressions. NO: cartoons, illustrations.`,
        `Hyper-realistic photograph: Filipino team in BPO office, professional setting. Authentic workplace scenario. NO: cartoons, illustrations.`,
      ];

      const results = await Promise.all(
        sectionPrompts.map((prompt, i) =>
          generateImageWithImagen4(prompt, slug || meta?.canonicalSlug || 'section', `section${i + 1}`, '16:9')
        )
      );

      section1Url = results[0] || section1Url;
      section2Url = results[1] || section2Url;
      section3Url = results[2] || section3Url;
    }

    // ========== EXTRACT SECTION ALT TEXTS ==========
    const section1Alt = sectionImages?.[0]?.alt || '';
    const section2Alt = sectionImages?.[1]?.alt || '';
    const section3Alt = sectionImages?.[2]?.alt || '';

    // ========== PUBLISH ARTICLE ==========
    // Columns matching actual insights_posts table schema
    const { data: article, error } = await supabase
      .from('insights_posts')
      .upsert({
        title,
        slug: slug || meta?.canonicalSlug,
        description: meta?.metaDescription || '',
        content: contentPart1 + '\n\n' + contentPart2 + '\n\n' + contentPart3,
        content_part1: contentPart1,
        content_part2: contentPart2,
        content_part3: contentPart3,
        hero_type: heroType || 'image',
        hero_url: heroUrl,
        video_url: heroType === 'video' ? heroUrl : null,
        content_image0: section1Url || null,
        content_image1: section2Url || null,
        content_image2: section3Url || null,
        section1_image_alt: section1Alt,
        section2_image_alt: section2Alt,
        section3_image_alt: section3Alt,
        meta_description: meta?.metaDescription,
        category: silo || 'General',
        content_type: isPillar ? 'pillar' : 'supporting',
        is_pillar: isPillar || false,
        silo_id: resolvedSiloId || null,
        silo_topic: silo,
        author: 'Ate Yna',
        author_name: 'Ate Yna',
        author_avatar: '/Chat Agent/Ate Yna.png',
        author_slug: 'ate-yna',
        icon_name: iconName || 'FileText',
        color: color || 'text-cyan-400',
        bg_color: bgColor || 'bg-cyan-500/10',
        read_time: readTime || `${Math.ceil((contentPart1 + contentPart2 + contentPart3).split(/\s+/).length / 200)} min read`,
        applied_links: appliedLinks || [],
        is_published: !isDraft,
        published_at: isDraft ? null : new Date().toISOString(),
        pipeline_stage: isDraft ? 'draft' : 'published',
        generation_metadata: {
          generatedAt: new Date().toISOString(),
          model: 'gpt-4o',
          humanized: true,
          seoOptimized: true,
          heroType: heroType || 'image',
          heroSource,
          sectionSource,
          metaTitle: meta?.metaTitle,
          ogTitle: meta?.ogTitle,
          ogDescription: meta?.ogDescription,
          focusKeyword: meta?.focusKeyword,
          secondaryKeywords: meta?.secondaryKeywords,
          isPillar: isPillar || false,
        },
      }, { onConflict: 'slug' })
      .select()
      .single();

    if (error) {
      console.error('Database error:', error);
      throw error;
    }

    // Insert SEO metadata (schema stored in both schema_markup and schema_data)
    if (meta?.schema) {
      await supabase.from('seo_metadata').upsert({
        post_id: article.id,
        meta_title: meta.metaTitle || title,
        meta_description: meta.metaDescription || '',
        keywords: meta.secondaryKeywords ? [meta.focusKeyword, ...meta.secondaryKeywords].filter(Boolean) : [meta.focusKeyword].filter(Boolean),
        canonical_url: meta.canonicalUrl || `https://bpoc.io/insights/${slug || meta.canonicalSlug}`,
        schema_type: 'BlogPosting',
        schema_data: meta.schema,
        schema_markup: meta.schema,
        focus_keyword: meta.focusKeyword,
        secondary_keywords: meta.secondaryKeywords,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'post_id' });
    }

    // Delete draft if exists
    if (draftId) {
      await supabase.from('insights_pipeline_drafts').delete().eq('id', draftId);
    }

    // If this is a pillar post, update the silo to link to it
    if (isPillar && resolvedSiloId && !isDraft) {
      console.log(`📌 Linking pillar post ${article.id} to silo ${siloId}`);
      const { error: siloUpdateError } = await supabase
        .from('insights_silos')
        .update({ pillar_post_id: article.id })
        .eq('id', resolvedSiloId);

      if (siloUpdateError) {
        console.error('⚠️ Failed to link pillar post to silo:', siloUpdateError);
      } else {
        console.log('✅ Pillar post linked to silo successfully');
      }
    }

    console.log(`✅ Article ${isDraft ? 'saved as draft' : 'published'}: ${article.slug}${isPillar ? ' (PILLAR)' : ''}`);

    return NextResponse.json({
      success: true,
      article: {
        id: article.id,
        slug: article.slug,
        title: article.title,
        url: `/insights/${article.slug}`,
        isPublished: !isDraft,
        heroUrl,
        sectionUrls: [section1Url, section2Url, section3Url].filter(Boolean),
      },
    });

  } catch (error: any) {
    console.error('❌ Publish error:', error);
    await logError(error, {
      endpoint: '/api/admin/insights/pipeline/publish',
      http_method: 'POST',
      external_service: 'supabase',
    });
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

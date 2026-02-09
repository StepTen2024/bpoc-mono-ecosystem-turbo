/**
 * AI CONTENT PIPELINE - STAGE 8 (REBUILT)
 * Media Generation (Video + Images)
 * 
 * VIDEO: Google Veo (via VeoService)
 * IMAGES: Google Imagen 3
 * 
 * FEATURES:
 * - Hero video (16:9, 5-10s)
 * - Section images (3-5 per article)
 * - Consistent Filipino/BPO aesthetic
 * - SEO alt text with keywords
 * - Supabase storage integration
 * - Style selection (cinematic/people-focused/location)
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import OpenAI from 'openai';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { logError } from '@/lib/error-logger';
import { VeoService } from '@/lib/veo-service';
export const maxDuration = 800; // No rush — video + images + upload. Takes as long as it needs.
export const preferredRegion = 'iad1';
export const dynamic = 'force-dynamic';
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY!,
});

const gemini = new GoogleGenerativeAI(
  process.env.GOOGLE_GENERATIVE_AI_API_KEY || process.env.NEXT_PUBLIC_GOOGLE_API_KEY!
);

// ============================================
// TYPES
// ============================================

interface MediaGenerationRequest {
  article: string;
  title: string;
  keywords: string[];
  category: string;
  style?: 'cinematic' | 'people-focused' | 'location' | 'abstract';
  pipelineId?: string;
}

interface VideoResult {
  url: string;
  provider: 'google-veo';
  duration: number;
  prompt: string;
  taskId?: string;
}

interface ImageResult {
  url: string;
  provider: 'google-imagen' | 'openai-dalle';
  alt: string;
  prompt: string;
  section?: string;
}

// ============================================
// MAIN ROUTE HANDLER
// ============================================

export async function POST(req: NextRequest) {
  const startTime = Date.now();

  try {
    const body = await req.json();
    const {
      article,
      title,
      keywords,
      category = 'BPO & Outsourcing',
      style = 'people-focused',
      pipelineId,
      articleSlug,
      articleId,
    } = body as MediaGenerationRequest & { articleSlug?: string; articleId?: string };

    // Normalize keywords to array (backfill sends string, pipeline sends array)
    const keywordsArray = Array.isArray(keywords) ? keywords : 
      (typeof keywords === 'string' ? keywords.split(',').map((k: string) => k.trim()).filter(Boolean) : ['bpo jobs philippines']);

    // If article text is empty/short, fetch from DB
    let articleText = article;
    if ((!articleText || articleText.length < 100) && (articleId || articleSlug)) {
      console.log('📥 Article text empty — fetching from DB...');
      const query = articleId 
        ? supabase.from('insights_posts').select('content, title').eq('id', articleId).single()
        : supabase.from('insights_posts').select('content, title').eq('slug', articleSlug).single();
      const { data: postData } = await query;
      if (postData?.content) {
        articleText = postData.content;
        console.log(`✅ Fetched ${articleText.length} chars from DB`);
      }
    }

    console.log('🎬 STAGE 8: Media Generation');
    console.log(`📊 Article: "${title}" (${articleText?.length || 0} chars)`);
    console.log(`🎨 Style: ${style}`);

    // ============================================
    // STEP 1: Generate Video Prompt
    // ============================================
    console.log('\n📝 Step 1: Generating video prompt...');
    const videoPrompt = await generateVideoPrompt(title, keywordsArray, category, style);
    console.log(`✅ Video prompt: ${videoPrompt.substring(0, 100)}...`);

    // ============================================
    // STEP 2: Generate Hero Video with Google Veo
    // ============================================
    console.log('\n🎥 Step 2: Generating hero video...');
    console.log(`${'='.repeat(60)}`);
    console.log('🎬 [VIDEO GENERATION] Agent: GOOGLE_VEO_3.1');
    console.log(`${'='.repeat(60)}`);

    let videoResult: VideoResult | null = null;

    try {
      videoResult = await generateVideoWithGoogleVeo(videoPrompt);
      console.log('✅ [VIDEO] Agent: GOOGLE_VEO_3.1 - SUCCESS!');
    } catch (error: any) {
      console.log('❌ [VIDEO] Agent: GOOGLE_VEO_3.1 - FAILED:', error.message);
      console.log('   Skipping video generation for this article.');
    }

    // ============================================
    // STEP 3: Generate Image Prompts (3-5 sections)
    // ============================================
    console.log('\n📝 Step 3: Generating image prompts...');
    const imagePrompts = await generateImagePrompts(articleText, title, keywordsArray, style);
    console.log(`✅ Generated ${imagePrompts.length} image prompts`);

    // ============================================
    // STEP 4: Generate Images with Google Imagen
    // ============================================
    console.log('\n🖼️  Step 4: Generating images...');
    console.log(`${'='.repeat(60)}`);
    console.log('🎨 [IMAGE GENERATION] Agent: GOOGLE_IMAGEN_3');
    console.log(`${'='.repeat(60)}`);

    const imageResults: ImageResult[] = [];

    for (let i = 0; i < imagePrompts.length; i++) {
      const imagePrompt = imagePrompts[i];
      console.log(`\n📸 [IMAGE ${i + 1}/${imagePrompts.length}] Section: "${imagePrompt.section}"`);

      try {
        const imageResult = await generateImageWithImagen(
          imagePrompt.prompt,
          imagePrompt.alt,
          imagePrompt.section
        );
        imageResults.push(imageResult);
        console.log(`   ✅ Agent: GOOGLE_IMAGEN_3 - SUCCESS!`);
      } catch (error: any) {
        console.log(`   ❌ Agent: GOOGLE_IMAGEN_3 - FAILED:`, error.message);
        console.log(`   ⚠️ Skipping this image`);
      }
    }

    console.log(`\n${'='.repeat(60)}`);
    console.log(`✅ [IMAGE GENERATION] Complete: ${imageResults.length}/${imagePrompts.length} images generated`);
    console.log(`${'='.repeat(60)}`);

    // ============================================
    // STEP 5: Upload to Supabase Storage
    // ============================================
    console.log('\n☁️  Step 5: Uploading to Supabase storage...');
    
    let uploadedVideoUrl: string | null = null;
    if (videoResult) {
      uploadedVideoUrl = await uploadVideoToSupabase(videoResult, title);
      console.log(`✅ Video uploaded: ${uploadedVideoUrl}`);
    }

    const uploadedImageUrls: string[] = [];
    for (const image of imageResults) {
      const uploadedUrl = await uploadImageToSupabase(image, title);
      uploadedImageUrls.push(uploadedUrl);
    }
    console.log(`✅ Uploaded ${uploadedImageUrls.length} images`);

    // ============================================
    // STEP 6: Save to Database
    // ============================================
    if (pipelineId) {
      console.log('\n💾 Step 6: Saving media metadata...');
      await supabase
        .from('content_pipelines')
        .update({
          media_generation: {
            video: videoResult ? {
              url: uploadedVideoUrl,
              provider: videoResult.provider,
              duration: videoResult.duration,
              prompt: videoResult.prompt,
            } : null,
            images: imageResults.map((img, i) => ({
              url: uploadedImageUrls[i],
              provider: img.provider,
              alt: img.alt,
              section: img.section,
              prompt: img.prompt,
            })),
            generatedAt: new Date().toISOString(),
          },
          current_stage: 8,
          last_updated: new Date().toISOString(),
        })
        .eq('id', pipelineId);

      console.log('✅ Media metadata saved');
    }

    // ============================================
    // UPDATE THE PUBLISHED POST DIRECTLY
    // ============================================
    if (articleSlug || articleId) {
      const updateData: any = {};
      if (uploadedVideoUrl) {
        updateData.hero_type = 'video';
        updateData.hero_url = uploadedVideoUrl;
        updateData.video_url = uploadedVideoUrl;
      }
      if (uploadedImageUrls[0]) updateData.content_image0 = uploadedImageUrls[0];
      if (uploadedImageUrls[1]) updateData.content_image1 = uploadedImageUrls[1];
      if (uploadedImageUrls[2]) updateData.content_image2 = uploadedImageUrls[2];
      
      if (Object.keys(updateData).length > 0) {
        const query = articleId 
          ? supabase.from('insights_posts').update(updateData).eq('id', articleId)
          : supabase.from('insights_posts').update(updateData).eq('slug', articleSlug);
        await query;
        console.log(`✅ Updated post with media: hero=${!!uploadedVideoUrl}, images=${uploadedImageUrls.filter(Boolean).length}`);
      }
      
      // Update queue status
      if (pipelineId) {
        await supabase.from('insights_production_queue')
          .update({ status: 'published' })
          .eq('pipeline_id', pipelineId);
      }
    }

    // ============================================
    // DONE!
    // ============================================
    const duration = ((Date.now() - startTime) / 1000).toFixed(2);
    console.log(`\n✅ MEDIA COMPLETE in ${duration}s`);

    return NextResponse.json({
      success: true,
      video: videoResult ? {
        url: uploadedVideoUrl,
        provider: videoResult.provider,
        duration: videoResult.duration,
      } : null,
      images: imageResults.map((img, i) => ({
        url: uploadedImageUrls[i],
        provider: img.provider,
        alt: img.alt,
        section: img.section,
      })),
      processingTime: parseFloat(duration),
    });

  } catch (error: any) {
    console.error('❌ Media generation error:', error);
    await logError(error, {
      endpoint: '/api/admin/insights/pipeline/generate-media',
      http_method: 'POST',
      external_service: 'media_generation',
    });
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}

// ============================================
// VIDEO GENERATION FUNCTIONS
// ============================================

/**
 * Generate video prompt using GPT-4o
 */
async function generateVideoPrompt(
  title: string,
  keywords: string[] | string,
  category: string,
  style: string
): Promise<string> {
  // Defensive: ensure keywords is always an array
  const kw = Array.isArray(keywords) ? keywords : String(keywords || '').split(',').map(k => k.trim()).filter(Boolean);
  if (kw.length === 0) kw.push('bpo jobs philippines');
  const styleGuides = {
    cinematic: 'Cinematic, dramatic lighting, smooth camera movements, professional cinematography',
    'people-focused': 'Filipino professionals in modern office, diverse team, natural interactions, warm lighting',
    location: 'Philippines locations, Manila skyline, BPO offices, modern workspace, city views',
    abstract: 'Abstract concepts, data visualization, digital transformation, futuristic tech',
  };

  const prompt = `Generate a 5-10 second video prompt for an article hero video.

Article Title: "${title}"
Category: ${category}
Keywords: ${kw.join(', ')}
Style: ${style} (${styleGuides[style as keyof typeof styleGuides]})

CRITICAL RULES:
- The hero video MUST capture the essence of the article TITLE — not just generic BPO workers at desks
- If the article is about salary/compensation → show money, paychecks, salary negotiations, financial growth
- If about career growth → show promotions, achievements, climbing metaphors
- If about interviews → show interview settings, handshakes, confidence
- If about work-life balance → show contrasting work vs leisure, family, relaxation
- Filipino representation when showing people
- BPOC brand aesthetic: modern, professional, warm Filipino energy
- No text overlays or logos
- Smooth motion, cinematic quality, 16:9 aspect ratio
- DO NOT default to "generic people sitting at desks in a call center" — be SPECIFIC to the article topic

Return ONLY the video prompt (2-3 sentences, descriptive, cinematic, specific to this article's topic).`;

  const response = await openai.chat.completions.create({
    model: 'gpt-4o',
    messages: [{ role: 'user', content: prompt }],
    max_tokens: 200,
  });

  return response.choices[0].message.content || '';
}

/**
 * Generate video with Google Veo 3.1
 * Uses GOOGLE_GENERATIVE_AI_API_KEY for authentication
 */
async function generateVideoWithGoogleVeo(prompt: string): Promise<VideoResult> {
  const apiKey = process.env.GOOGLE_GENERATIVE_AI_API_KEY;

  if (!apiKey) {
    throw new Error('GOOGLE_GENERATIVE_AI_API_KEY not configured');
  }

  console.log('🎬 [GOOGLE_VEO_3.1] Starting video generation...');
  console.log('🎬 [GOOGLE_VEO_3.1] Prompt:', prompt.substring(0, 150) + '...');

  const veo = new VeoService(apiKey);
  const result = await veo.generateVideo({
    prompt,
    duration: 8,
    aspectRatio: '16:9',
    resolution: '1080p'
  });

  if (!result.success || !result.videoUrl) {
    throw new Error(result.error || 'Veo video generation failed');
  }

  console.log(`✅ [GOOGLE_VEO_3.1] Video generated in ${result.generationTime?.toFixed(1)}s`);
  console.log(`💰 [GOOGLE_VEO_3.1] Estimated cost: $${result.estimatedCost?.toFixed(2)}`);

  return {
    url: result.videoUrl,
    provider: 'google-veo',
    duration: 8,
    prompt,
  };
}

// ============================================
// IMAGE GENERATION FUNCTIONS
// ============================================

/**
 * Generate image prompts for article sections
 */
async function generateImagePrompts(
  article: string,
  title: string,
  keywords: string[] | string,
  style: string
): Promise<Array<{ prompt: string; alt: string; section: string }>> {
  // Defensive: ensure keywords is always an array
  const kw = Array.isArray(keywords) ? keywords : String(keywords || '').split(',').map(k => k.trim()).filter(Boolean);
  if (kw.length === 0) kw.push('bpo jobs philippines');

  // Extract H2 headings as sections
  const h2Matches = article.match(/^##\s+(.+)$/gm) || [];
  const sections = h2Matches.map(h => h.replace(/^##\s+/, '')).slice(0, 3); // Only 3 images (matches DB slots)

  const prompt = `Generate image prompts for article sections.

Article Title: "${title}"
Keywords: ${kw.join(', ')}
Style: ${style}

Sections:
${sections.map((s, i) => `${i + 1}. ${s}`).join('\n')}

For each section, generate:
1. Image prompt (2-3 sentences, descriptive, SPECIFIC to what that section discusses)
2. SEO alt text (descriptive, include primary keyword: "${kw[0]}")
3. Image title attribute (short, descriptive)
4. Image caption (1 sentence describing what's shown, for screen readers)

CRITICAL RULES:
- Each image MUST relate to the SPECIFIC CONTENT of its section — not just generic BPO workers
- If section is about "salary ranges" → show salary charts, pay slips, money, financial planning
- If section is about "night shift" → show nighttime office, city lights, graveyard shift workers
- If section is about "skills" → show training, learning, certifications, skill development
- DO NOT make every image "professionals in a call center" — each should be DIFFERENT and relevant
- NO text overlays in images (AI text is usually wrong)
- Filipino representation when showing people
- BPOC brand: modern, professional, warm Filipino energy
- Photorealistic quality, 16:9 aspect ratio

Return JSON array:
[
  {
    "section": "Section name",
    "prompt": "Detailed image generation prompt specific to this section's content",
    "alt": "SEO-optimized alt text with keyword — describes what's shown in the image",
    "title": "Short descriptive title for the image",
    "caption": "Screen-reader friendly caption describing the image content"
  }
]`;

  const response = await openai.chat.completions.create({
    model: 'gpt-4o',
    response_format: { type: 'json_object' },
    messages: [
      {
        role: 'system',
        content: 'You are an image prompt engineer. Return valid JSON only.',
      },
      { role: 'user', content: prompt },
    ],
  });

  const result = JSON.parse(response.choices[0].message.content || '{}');
  // GPT-4o returns under varying keys — check all known ones
  const images = result.images || result.sections || result.prompts || 
                 result.image_prompts || result.data || result.results ||
                 (Array.isArray(result) ? result : []);
  console.log(`📋 Image prompt response keys: ${Object.keys(result).join(', ')}`);
  return images;
}

/**
 * Generate image with Google Imagen 3
 * Uses GOOGLE_GENERATIVE_AI_API_KEY for authentication
 */
async function generateImageWithImagen(
  prompt: string,
  alt: string,
  section: string
): Promise<ImageResult> {
  const apiKey = process.env.GOOGLE_GENERATIVE_AI_API_KEY;

  if (!apiKey) {
    throw new Error('GOOGLE_GENERATIVE_AI_API_KEY not configured');
  }

  console.log('🎨 [GOOGLE_IMAGEN_3] Starting image generation...');
  console.log('🎨 [GOOGLE_IMAGEN_3] Prompt:', prompt.substring(0, 100) + '...');

  // Use Imagen 3 via Generative Language API
  const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/imagen-4.0-generate-001:predict`;

  const response = await fetch(apiUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-goog-api-key': apiKey
    },
    body: JSON.stringify({
      instances: [{ prompt }],
      parameters: {
        sampleCount: 1,
        aspectRatio: "16:9",
        personGeneration: "allow_adult",
        safetyFilterLevel: "block_few",
      }
    })
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Imagen API error: ${response.status} - ${errorText}`);
  }

  const data = await response.json();

  // Imagen 4 uses predictions array
  const images = data.predictions || data.generatedImages || [];
  if (images.length > 0) {
    const imageData = images[0];
    const b64 = imageData.bytesBase64Encoded || imageData.image?.bytesBase64Encoded;
    const mime = imageData.mimeType || imageData.image?.mimeType || 'image/png';
    if (b64) {
      console.log('✅ [GOOGLE_IMAGEN_4] Image generated successfully!');
      return {
        url: `data:${mime};base64,${b64}`,
        provider: 'google-imagen',
        alt,
        prompt,
        section,
      };
    }
  }

  console.error('❌ Imagen response:', JSON.stringify(data).slice(0, 500));
  throw new Error('No image data returned from Imagen');
}

/**
 * Generate image with OpenAI DALL-E 3
 */
async function generateImageWithDALLE(
  prompt: string,
  alt: string,
  section: string
): Promise<ImageResult> {
  console.log('🎨 [OPENAI_DALLE_3] Starting image generation...');
  console.log('🎨 [OPENAI_DALLE_3] Prompt:', prompt.substring(0, 100) + '...');

  const response = await openai.images.generate({
    model: 'dall-e-3',
    prompt,
    n: 1,
    size: '1792x1024', // 16:9 aspect ratio
    quality: 'hd',
    style: 'natural',
  });

  const imageUrl = response.data?.[0]?.url;
  if (!imageUrl) {
    throw new Error('No image URL returned from DALL-E');
  }

  console.log('✅ [OPENAI_DALLE_3] Image generated successfully!');

  return {
    url: imageUrl,
    provider: 'openai-dalle',
    alt,
    prompt,
    section,
  };
}

// ============================================
// STORAGE FUNCTIONS
// ============================================

/**
 * Upload video to Supabase storage
 */
async function uploadVideoToSupabase(video: VideoResult, articleTitle: string): Promise<string> {
  const slug = articleTitle.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '');
  const filename = `videos/${slug}-hero-video.mp4`;

  // Download video from provider URL
  const videoResponse = await fetch(video.url);
  const videoBlob = await videoResponse.blob();

  // Upload to Supabase
  const { data, error } = await supabase.storage
    .from('insights')
    .upload(filename, videoBlob, {
      contentType: 'video/mp4',
      upsert: true,
    });

  if (error) throw error;

  // Get public URL
  const { data: publicUrlData } = supabase.storage
    .from('insights')
    .getPublicUrl(filename);

  return publicUrlData.publicUrl;
}

/**
 * Upload image to Supabase storage
 */
async function uploadImageToSupabase(image: ImageResult, articleTitle: string): Promise<string> {
  const slug = articleTitle.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '');
  // Build SEO-friendly filename from section + article context (no UUIDs)
  const sectionSlug = image.section?.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '') || 'featured';
  // Truncate to avoid absurdly long filenames, keep it keyword-rich
  const truncatedSection = sectionSlug.split('-').slice(0, 6).join('-');
  const filename = `images/${slug}-${truncatedSection}.png`;

  // Convert data URL or fetch from URL
  let imageBlob: Blob;
  
  if (image.url.startsWith('data:')) {
    // Base64 data URL
    const base64Data = image.url.split(',')[1];
    const binaryData = Buffer.from(base64Data, 'base64');
    imageBlob = new Blob([binaryData], { type: 'image/png' });
  } else {
    // External URL
    const imageResponse = await fetch(image.url);
    imageBlob = await imageResponse.blob();
  }

  // Upload to Supabase
  const { data, error } = await supabase.storage
    .from('insights')
    .upload(filename, imageBlob, {
      contentType: 'image/png',
      upsert: true,
    });

  if (error) throw error;

  // Get public URL
  const { data: publicUrlData } = supabase.storage
    .from('insights')
    .getPublicUrl(filename);

  return publicUrlData.publicUrl;
}

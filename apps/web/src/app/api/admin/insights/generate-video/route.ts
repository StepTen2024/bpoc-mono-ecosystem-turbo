import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { VeoService } from "@/lib/veo-service";

// Admin client for storage uploads
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const VIDEO_BUCKET_NAME = "hero-videos";

/**
 * Generate video using Google Veo 3.1
 */
async function generateWithVeo(prompt: string): Promise<{ videoUrl: string; isBase64: boolean } | null> {
  const apiKey = process.env.GOOGLE_GENERATIVE_AI_API_KEY;

  console.log(`\n${'='.repeat(60)}`);
  console.log(`🎬 [VIDEO GENERATION] Agent: GOOGLE_VEO_3.1`);
  console.log(`${'='.repeat(60)}`);

  if (!apiKey) {
    console.log("❌ [VIDEO] Agent: GOOGLE_VEO_3.1 - API key not configured");
    return null;
  }

  try {
    console.log("🎬 [VIDEO] Agent: GOOGLE_VEO_3.1 - STARTING generation...");
    console.log("🎬 [VIDEO] Prompt:", prompt.substring(0, 200));

    const veo = new VeoService(apiKey);
    const result = await veo.generateVideo({
      prompt,
      duration: 8,
      aspectRatio: '16:9',
      resolution: '1080p'
    });

    if (result.success && result.videoUrl) {
      console.log("✅ [VIDEO] Agent: GOOGLE_VEO_3.1 - SUCCESS!");
      console.log(`✅ [VIDEO] Generation time: ${result.generationTime?.toFixed(1)}s`);
      console.log(`✅ [VIDEO] Estimated cost: $${result.estimatedCost?.toFixed(2)}`);

      return {
        videoUrl: result.videoUrl,
        isBase64: result.videoUrl.startsWith('data:')
      };
    }

    console.log("❌ [VIDEO] Agent: GOOGLE_VEO_3.1 - FAILED:", result.error);
    return null;

  } catch (error: any) {
    console.error("❌ [VIDEO] Agent: GOOGLE_VEO_3.1 - ERROR:", error.message);
    return null;
  }
}

/**
 * Creative Director — analyzes article title & content to create dynamic, 
 * content-matched video prompts with visual metaphors and energy
 */
async function optimizePromptWithGPT(title: string, content: string): Promise<string> {
  try {
    console.log("🎬 [VIDEO] Creative Director analyzing content...");

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content: `You are a Creative Director making 8-second hero videos for a Filipino careers website. Your job is to match the ENERGY and MEANING of the article title with dynamic visuals.

CREATIVE APPROACH:
1. Read the title — what's the ENERGY? (Bold claim? How-to? Comparison? Inspirational?)
2. Find the visual METAPHOR that captures that energy
3. Design 2-3 scenes that tell a micro-story in 8 seconds

EXAMPLES OF MATCHING ENERGY:
- "Salaries Crush Everything" → Split-screen comparison: BPO worker's modern condo vs generic office worker's cramped space. Dynamic camera push-in on both.
- "BPO Ninja" → Playful: office worker doing confident, precise movements at their desk like a martial artist. Quick cuts, dramatic lighting.
- "How to Get Hired" → Journey sequence: nervous walk to building → confident handshake → celebration walk out
- "Night Shift Survival" → Time-lapse: sunset over Manila skyline → office lights turning on → worker commuting at dawn
- "Career Growth" → Vertical dolly shot: starting at ground-floor lobby → rising through floors → reaching executive level with panoramic view
- "Work-Life Balance" → Dual life: morning yoga on a rooftop → focused work at modern desk → evening with family at a Filipino dinner table

SCENE DESIGN RULES:
- Match the content, NOT a generic office
- Use visual metaphors and dynamic compositions
- Camera movements: dolly, crane, tracking, time-lapse, split-screen
- Lighting should match mood (warm=positive, cool=professional, golden=aspirational)
- Filipino settings when relevant (Manila skyline, jeepneys, local food stalls, BGC towers)
- Keep it CINEMATIC — not corporate stock footage

STRICT VIDEO RULES:
- ABSOLUTELY NO text, titles, captions, words, letters, or numbers visible in the video
- NO logos, watermarks, UI elements, or overlays
- NO on-screen text of any kind — pure visual storytelling only
- Short, punchy scene descriptions that Veo can render well
- Max 400 characters total
- Ensure seamless loop potential (end scene mirrors start)`
          },
          {
            role: 'user',
            content: `Article title: "${title}"

Content summary: ${content.substring(0, 800)}

Create a cinematic video prompt that matches this title's energy. 2-3 scenes, max 400 characters. NO TEXT IN VIDEO.`
          }
        ],
        max_tokens: 200,
        temperature: 0.8,
      }),
    });

    if (response.ok) {
      const data = await response.json();
      let optimizedPrompt = data.choices[0].message.content.trim();

      // Reinforce no-text rule
      optimizedPrompt += " STRICTLY no text, titles, captions, or words visible anywhere in the video. Pure cinematic visual footage only.";

      console.log("✅ [VIDEO] Creative Director prompt created:", optimizedPrompt.substring(0, 100) + "...");
      return optimizedPrompt;
    } else {
      console.log("⚠️ [VIDEO] Creative Director API failed, using fallback prompt");
      return buildFallbackPrompt(title);
    }
  } catch (error: any) {
    console.log("⚠️ [VIDEO] Creative Director error:", error.message);
    return buildFallbackPrompt(title);
  }
}

/**
 * Build fallback prompt when GPT is unavailable
 * Uses content-specific visual direction based on article title
 */
function buildFallbackPrompt(title: string): string {
  const titleLower = (title || '').toLowerCase();
  let scene1 = 'Wide establishing shot of modern Manila skyline at golden hour';
  let scene2 = 'Filipino professional in a candid work moment, warm natural lighting';
  
  if (titleLower.includes('salary') || titleLower.includes('compensation') || titleLower.includes('pay')) {
    scene1 = 'Aerial view of BGC towers at sunset, city lights beginning to glow';
    scene2 = 'Young Filipino professional checking phone with confident smile outside modern office building';
  } else if (titleLower.includes('interview') || titleLower.includes('hired')) {
    scene1 = 'Glass-walled corporate lobby, morning light streaming in';
    scene2 = 'Confident Filipino candidate walking through modern office corridor, determined expression';
  } else if (titleLower.includes('career') || titleLower.includes('promot')) {
    scene1 = 'Vertical dolly shot rising along office building exterior';
    scene2 = 'Filipino team leader whiteboarding with engaged team, collaborative energy';
  } else if (titleLower.includes('night') || titleLower.includes('shift')) {
    scene1 = 'Time-lapse of Manila sunset transitioning to city lights';
    scene2 = 'Worker commuting through illuminated city streets, neon reflections';
  } else if (titleLower.includes('company') || titleLower.includes('review')) {
    scene1 = 'Slow tracking shot through a vibrant modern office space';
    scene2 = 'Diverse team in casual collaboration area, authentic laughter and discussion';
  } else if (titleLower.includes('balance') || titleLower.includes('wellness')) {
    scene1 = 'Sunrise over Manila Bay, peaceful morning';
    scene2 = 'Worker transitioning from morning exercise to confident office arrival';
  }
  
  return `Cinematic 8-second loop. Scene 1 (0-3s): ${scene1}. Scene 2 (3-6s): ${scene2}. Scene 3 (6-8s): Pull back to wide establishing shot for seamless loop. Cinematic quality, warm color grade. STRICTLY no text, titles, captions, or words visible.`;
}

export async function POST(req: NextRequest) {
  console.log("🎬 [VIDEO] ========== VIDEO GENERATION REQUEST ==========");

  try {
    const body = await req.json();
    const { prompt, title, slug, brief, content } = body;

    console.log("🎬 [VIDEO] Generating for:", title || prompt);

    const apiKey = process.env.GOOGLE_GENERATIVE_AI_API_KEY;
    if (!apiKey) {
      console.error("❌ [VIDEO] Google API key not configured");
      return NextResponse.json({
        success: false,
        error: "Google API key not configured",
        suggestion: "Please add GOOGLE_GENERATIVE_AI_API_KEY to your environment variables.",
      }, { status: 503 });
    }

    const timestamp = Date.now();
    const safeSlug = (slug || title || "video")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/-+/g, "-")
      .substring(0, 50);

    // Build enhanced prompt
    let enhancedPrompt = '';

    if (title && content) {
      enhancedPrompt = await optimizePromptWithGPT(title, content);
    } else if (brief) {
      enhancedPrompt = `Cinematic career video: ${brief}. Three scenes with smooth transitions: 1) Establishing shot of modern Filipino workplace 2) Close-up of authentic professional moment 3) Inspiring wide shot that loops back to start. Cinematic quality, warm lighting, seamless loop. STRICTLY no text, titles, or captions visible.`;
    } else {
      enhancedPrompt = `${prompt || title}. Cinematic Filipino professional scene. Three smooth transitions: establishing shot, authentic work moment, inspiring pullback for seamless loop. Warm cinematic lighting, high quality. STRICTLY no text, titles, or captions visible.`;
    }

    // Ensure under 1000 characters (API limit)
    if (enhancedPrompt.length > 1000) {
      console.log(`⚠️ [VIDEO] Prompt too long (${enhancedPrompt.length} chars), truncating`);
      enhancedPrompt = enhancedPrompt.substring(0, 997) + '...';
    }

    console.log(`🎬 [VIDEO] Prompt length: ${enhancedPrompt.length} characters`);

    // Generate with Google Veo 3.1
    const veoResult = await generateWithVeo(enhancedPrompt);

    if (veoResult && veoResult.videoUrl) {
      // Upload to Supabase
      if (veoResult.isBase64) {
        console.log("🎬 [VIDEO] Uploading base64 video to Supabase...");

        try {
          const base64Data = veoResult.videoUrl.split(',')[1];
          const videoBuffer = Buffer.from(base64Data, 'base64');
          const fileName = `ai-generated/${safeSlug}-${timestamp}.mp4`;

          const { error: uploadError } = await supabaseAdmin.storage
            .from(VIDEO_BUCKET_NAME)
            .upload(fileName, videoBuffer, {
              contentType: "video/mp4",
              cacheControl: "31536000",
              upsert: true,
            });

          if (!uploadError) {
            const { data: urlData } = supabaseAdmin.storage
              .from(VIDEO_BUCKET_NAME)
              .getPublicUrl(fileName);

            console.log("✅ [VIDEO] Uploaded to Supabase:", urlData.publicUrl);

            return NextResponse.json({
              success: true,
              videoUrl: urlData.publicUrl,
              permanent: true,
              generatedWith: "google-veo-3.1",
              message: "Video generated and saved successfully!",
              prompt: enhancedPrompt,
              metadata: { altText: `${title} - Hero video`, title, description: `AI-generated hero video for: ${title}` },
            });
          } else {
            console.error("❌ [VIDEO] Supabase upload error:", uploadError);
            return NextResponse.json({
              success: true,
              videoUrl: veoResult.videoUrl,
              permanent: false,
              generatedWith: "google-veo-3.1",
              message: "Video generated but upload failed",
              prompt: enhancedPrompt,
            });
          }
        } catch (uploadError: any) {
          console.error("❌ [VIDEO] Upload error:", uploadError);
          return NextResponse.json({
            success: true,
            videoUrl: veoResult.videoUrl,
            permanent: false,
            generatedWith: "google-veo-3.1",
            message: "Video generated but storage failed",
            prompt: enhancedPrompt,
          });
        }
      } else {
        // Download from URL and upload to Supabase
        console.log("🎬 [VIDEO] Downloading video from URL...");

        try {
          const videoResponse = await fetch(veoResult.videoUrl);

          if (!videoResponse.ok) {
            return NextResponse.json({
              success: true,
              videoUrl: veoResult.videoUrl,
              permanent: false,
              generatedWith: "google-veo-3.1",
              message: "Video generated but download failed",
              prompt: enhancedPrompt,
            });
          }

          const videoBuffer = Buffer.from(await videoResponse.arrayBuffer());
          const fileName = `ai-generated/${safeSlug}-${timestamp}.mp4`;

          const { error: uploadError } = await supabaseAdmin.storage
            .from(VIDEO_BUCKET_NAME)
            .upload(fileName, videoBuffer, {
              contentType: "video/mp4",
              cacheControl: "31536000",
              upsert: true,
            });

          if (!uploadError) {
            const { data: urlData } = supabaseAdmin.storage
              .from(VIDEO_BUCKET_NAME)
              .getPublicUrl(fileName);

            console.log("✅ [VIDEO] Uploaded to Supabase:", urlData.publicUrl);

            return NextResponse.json({
              success: true,
              videoUrl: urlData.publicUrl,
              permanent: true,
              generatedWith: "google-veo-3.1",
              message: "Video generated and saved successfully!",
              prompt: enhancedPrompt,
              metadata: { altText: `${title} - Hero video`, title, description: `AI-generated hero video for: ${title}` },
            });
          } else {
            console.error("❌ [VIDEO] Supabase upload error:", uploadError);
            return NextResponse.json({
              success: true,
              videoUrl: veoResult.videoUrl,
              permanent: false,
              generatedWith: "google-veo-3.1",
              message: "Video generated but upload failed",
              prompt: enhancedPrompt,
            });
          }
        } catch (downloadError: any) {
          console.error("❌ [VIDEO] Download/upload error:", downloadError);
          return NextResponse.json({
            success: true,
            videoUrl: veoResult.videoUrl,
            permanent: false,
            generatedWith: "google-veo-3.1",
            message: "Video generated but storage failed",
            prompt: enhancedPrompt,
          });
        }
      }
    }

    // Generation failed
    console.log(`\n${'='.repeat(60)}`);
    console.log("❌ [VIDEO GENERATION] GOOGLE_VEO_3.1 FAILED");
    console.log("   Please upload a video manually.");
    console.log(`${'='.repeat(60)}\n`);

    return NextResponse.json({
      success: false,
      error: "Video generation failed",
      message: "Google Veo 3.1 video generation failed. Please upload a video manually.",
      suggestion: "Use the upload button to add your own video file, or try generating again later.",
    }, { status: 500 });

  } catch (error: any) {
    console.error("❌ [VIDEO] Error:", error.message);

    return NextResponse.json({
      success: false,
      error: error.message || "Generation failed",
      suggestion: "Please upload a video manually.",
    }, { status: 500 });
  }
}

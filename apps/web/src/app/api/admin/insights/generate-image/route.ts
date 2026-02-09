import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { ImagenService } from "@/lib/imagen-service";

// Admin client for storage uploads
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const BUCKET_NAME = "insights-images";

// Negative prompt to avoid unwanted styles
const NEGATIVE_STYLE = "ABSOLUTELY NO: clipart, vector art, cartoon, illustration, anime, 3D render, CGI, artificial looking, stock illustration, flat design, icons, digital art, painting, drawing, sketch, watercolor, oil painting, graphic design, infographic, diagram, AI artifacts, plastic skin, uncanny valley, distorted faces, extra limbs, blurry, low resolution, watermark, text overlay, logo, any text or words or letters or numbers in the image";

/**
 * Smart Visual Art Director — analyzes content and creates varied, contextual image prompts
 * Decides image type, subject, composition based on section content
 */
async function optimizeImagePromptWithGPT(sectionContent: string, title: string, imageIndex?: number): Promise<string> {
  if (!process.env.OPENAI_API_KEY) {
    const firstLine = sectionContent.split('\n')[0].replace(/^#+\s*/, '').trim();
    return `${firstLine} - Professional Filipino workplace scene`;
  }

  try {
    console.log("🎨 [IMAGE] Visual Art Director analyzing content...");

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
            content: `You are a Visual Art Director for a Filipino BPO careers website. Your job is to create SPECIFIC, VARIED image prompts that match article content.

STEP 1 — Decide the image TYPE based on content:
- PHOTOGRAPHY (PERSON): If about individual roles, interviews, career stories → specific person doing a specific activity
- PHOTOGRAPHY (SCENE): If about workplaces, commuting, environments → scene/setting shot
- PHOTOGRAPHY (GROUP): If about teams, collaboration, meetings → group dynamics
- CONCEPTUAL: If about abstract concepts (growth, success, balance) → visual metaphor

STEP 2 — Choose SPECIFIC subjects (NEVER default to "Filipina with headset at desk"):
- Salary content → professional reviewing payslip on phone, or two colleagues comparing offers over coffee
- Interview content → candidate walking confidently into a glass-walled meeting room
- Night shift → worker commuting home at dawn past a jeepney, city waking up
- Career growth → team leader whiteboarding strategy with their team
- Work-life balance → worker at a weekend family gathering, or exercising at sunrise
- Training → small group workshop, mentor demonstrating on screen
- Companies → distinctive office lobbies, rooftop break areas, modern coworking spaces

STEP 3 — Composition & Camera:
- Vary between: wide establishing shots, medium shots with bokeh, close-up detail shots, over-the-shoulder perspective
- Lighting: natural window light, warm golden hour, modern office fluorescents, screen-lit faces
- Each image in a set should use a DIFFERENT composition and angle

BRAND GUIDELINES:
- Warm, professional, authentically Filipino
- Aspirational but realistic — real people in real settings
- Include Filipino cultural markers naturally (jeepneys, local food, familiar office setups, BGC/Ortigas skylines)
- NOT stock photo generic — specific moments, specific people, specific places

OUTPUT: One paragraph, max 500 characters. Describe the scene vividly. Include camera/lighting details.`
          },
          {
            role: 'user',
            content: `Article title: "${title}"
Image position: ${imageIndex !== undefined ? `Section image #${imageIndex + 1} (vary from other sections)` : 'Hero image'}

Content to visualize:
${sectionContent.substring(0, 1500)}

Create a SPECIFIC photography prompt. NOT a generic "Filipino professional at desk" — match the actual content.`
          }
        ],
        max_tokens: 250,
        temperature: 0.8,
      }),
    });

    if (response.ok) {
      const data = await response.json();
      const optimizedPrompt = data.choices[0].message.content.trim();
      console.log("✅ [IMAGE] Art Director prompt created");
      return optimizedPrompt;
    } else {
      const firstLine = sectionContent.split('\n')[0].replace(/^#+\s*/, '').trim();
      return `${firstLine} - Authentic Filipino professional scene, warm natural lighting, candid moment`;
    }
  } catch (error: any) {
    console.log("⚠️ [IMAGE] Art Director error:", error.message);
    const firstLine = sectionContent.split('\n')[0].replace(/^#+\s*/, '').trim();
    return `${firstLine} - Authentic Filipino professional scene, warm natural lighting, candid moment`;
  }
}

/**
 * Upload image buffer to Supabase Storage
 */
async function uploadToSupabase(
  imageBuffer: Uint8Array,
  contentType: string,
  slug: string,
  title: string,
  isSection: boolean = false
): Promise<string | null> {
  const timestamp = Date.now();
  const safeSlug = (slug || title || "image")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/-+/g, "-")
    .substring(0, 50);

  const ext = contentType.includes('png') ? 'png' : 'webp';
  const folder = isSection ? 'section' : 'heroes';
  const fileName = `${folder}/${safeSlug}-${timestamp}.${ext}`;

  console.log("📤 [IMAGE] Uploading to Supabase:", fileName);

  const { error: uploadError } = await supabaseAdmin.storage
    .from(BUCKET_NAME)
    .upload(fileName, imageBuffer, {
      contentType,
      cacheControl: "31536000",
      upsert: true,
    });

  if (uploadError) {
    console.error("❌ [IMAGE] Supabase upload error:", uploadError);
    return null;
  }

  const { data: urlData } = supabaseAdmin.storage
    .from(BUCKET_NAME)
    .getPublicUrl(fileName);

  console.log("✅ [IMAGE] Uploaded to Supabase:", urlData.publicUrl);
  return urlData.publicUrl;
}

export async function POST(req: NextRequest) {
  console.log("🎨 [IMAGE] ========== IMAGE GENERATION REQUEST ==========");

  try {
    const { prompt, title, style, slug, brief, content, sectionContent } = await req.json();

    const apiKey = process.env.GOOGLE_GENERATIVE_AI_API_KEY;
    if (!apiKey) {
      console.error("❌ [IMAGE] Google API key not configured");
      return NextResponse.json({
        success: false,
        error: "Google API key not configured",
        suggestion: "Please add GOOGLE_GENERATIVE_AI_API_KEY to your environment variables.",
      }, { status: 503 });
    }

    console.log("🎨 [IMAGE] Generating for:", title || prompt);

    // Build prompt — ALL images go through the smart Art Director
    let basePrompt = prompt || `Article hero image for: ${title}`;

    if (sectionContent) {
      // Section image — pass index for variety
      const sectionIndex = parseInt(slug?.match(/section(\d)/)?.[1] || '0') || 0;
      basePrompt = await optimizeImagePromptWithGPT(sectionContent, title || 'BPO Article', sectionIndex);
    } else if (brief || content) {
      // Hero image — also goes through Art Director optimization
      const heroContent = `${title}\n\n${brief || content?.slice(0, 1500) || ''}`;
      basePrompt = await optimizeImagePromptWithGPT(heroContent, title || 'BPO Article');
    }

    // Build enhanced prompt for Imagen — no hardcoded "BPO office" setting
    const imagenPrompt = `Hyper-realistic photograph: ${basePrompt}. Authentic Filipino professionals, shot on professional DSLR, natural lighting, 8K quality, shallow depth of field, genuine expressions. ${NEGATIVE_STYLE}`;

    console.log("🎨 [IMAGE] Prompt:", imagenPrompt.substring(0, 150) + "...");
    console.log(`🎨 [IMAGE] Prompt length: ${imagenPrompt.length} characters`);

    // Generate with Google Imagen 4 using the service
    const imagen = new ImagenService(apiKey);
    const result = await imagen.generateImage({
      prompt: imagenPrompt,
      aspectRatio: '16:9',
      numberOfImages: 1,
      safetyFilterLevel: 'block_few',
      personGeneration: 'allow_adult'
    });

    if (result.success && result.imageBase64) {
      try {
        const imageBuffer = new Uint8Array(Buffer.from(result.imageBase64, 'base64'));
        const permanentUrl = await uploadToSupabase(
          imageBuffer,
          result.mimeType || 'image/png',
          slug,
          title,
          !!sectionContent
        );

        if (permanentUrl) {
          console.log("✅ [IMAGE] Final result: Generated with GOOGLE_IMAGEN_4");
          return NextResponse.json({
            success: true,
            imageUrl: permanentUrl,
            permanent: true,
            generatedWith: "google-imagen-4",
            generationTime: result.generationTime,
            prompt: imagenPrompt,
            metadata: {
              altText: `${title} - Filipino BPO professionals in modern office setting`,
              title: title,
              description: `Professional photograph illustrating ${title}. Features Filipino BPO professionals in an authentic corporate environment.`,
              caption: title,
            },
          });
        } else {
          console.error("❌ [IMAGE] Upload to Supabase failed");
          return NextResponse.json({
            success: false,
            error: "Image upload to storage failed. Please try again."
          }, { status: 500 });
        }
      } catch (uploadError: any) {
        console.error("❌ [IMAGE] Upload error:", uploadError.message);
        return NextResponse.json({
          success: false,
          error: `Image upload failed: ${uploadError.message}`
        }, { status: 500 });
      }
    }

    // Generation failed
    console.log(`\n${'='.repeat(60)}`);
    console.log("❌ [IMAGE GENERATION] GOOGLE_IMAGEN_4 FAILED");
    console.log(`   Error: ${result.error || 'Unknown error'}`);
    console.log("   Please try again or upload manually.");
    console.log(`${'='.repeat(60)}\n`);

    return NextResponse.json({
      success: false,
      error: result.error || "Google Imagen 4 failed to generate image. Please try again or upload manually.",
      suggestion: "Check that your GOOGLE_GENERATIVE_AI_API_KEY has access to Imagen 4."
    }, { status: 500 });

  } catch (error: any) {
    console.error("❌ [IMAGE] Error:", error.message);
    console.error("❌ [IMAGE] Stack:", error.stack);

    if (error?.error?.code === "content_policy_violation") {
      return NextResponse.json({
        success: false,
        error: "Content policy violation. Try a different prompt."
      }, { status: 400 });
    }

    return NextResponse.json({
      success: false,
      error: error.message || "Image generation failed. Check server logs for details."
    }, { status: 500 });
  }
}

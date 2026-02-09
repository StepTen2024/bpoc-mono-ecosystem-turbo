/**
 * Generate Image using Google Imagen API
 * Creates section images for articles
 */

import { NextRequest, NextResponse } from 'next/server';
export const maxDuration = 120;
export const preferredRegion = 'iad1';
export const dynamic = 'force-dynamic';
const GOOGLE_API_KEY = process.env.NEXT_PUBLIC_GOOGLE_API_KEY || process.env.GOOGLE_GENERATIVE_AI_API_KEY;
const GOOGLE_PROJECT_ID = 'shoreagents-daily'; // From your NEXT_PUBLIC_DAILY_DOMAIN
const IMAGEN_API_URL = `https://us-central1-aiplatform.googleapis.com/v1/projects/${GOOGLE_PROJECT_ID}/locations/us-central1/publishers/google/models/imagegeneration@006:predict`;

export async function POST(req: NextRequest) {
    try {
        const { prompt } = await req.json();

        if (!prompt) {
            return NextResponse.json({ success: false, error: 'Prompt is required' }, { status: 400 });
        }

        if (!GOOGLE_API_KEY) {
            return NextResponse.json({
                success: false,
                error: 'Google API key not configured'
            }, { status: 500 });
        }

        console.log(`🎨 Generating image: ${prompt}`);

        // Call Google Imagen API
        const response = await fetch(IMAGEN_API_URL, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${GOOGLE_API_KEY}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                instances: [
                    {
                        prompt: prompt,
                    }
                ],
                parameters: {
                    sampleCount: 1,
                    aspectRatio: '16:9',
                    negativePrompt: 'blurry, low quality, distorted',
                    safetySetting: 'block_some',
                }
            }),
        });

        if (!response.ok) {
            const errorData = await response.json();
            console.error('Imagen API error:', errorData);
            return NextResponse.json({
                success: false,
                error: `Imagen API error: ${errorData.error?.message || 'Unknown error'}`
            }, { status: response.status });
        }

        const data = await response.json();
        const imageUrl = data.predictions?.[0]?.bytesBase64Encoded;

        if (!imageUrl) {
            return NextResponse.json({
                success: false,
                error: 'No image generated'
            }, { status: 500 });
        }

        // Convert base64 to data URL
        const dataUrl = `data:image/png;base64,${imageUrl}`;

        console.log(`✅ Image generated successfully`);

        return NextResponse.json({
            success: true,
            imageUrl: dataUrl,
        });

    } catch (error: any) {
        console.error('❌ Image generation error:', error);
        return NextResponse.json({
            success: false,
            error: error.message || 'Failed to generate image'
        }, { status: 500 });
    }
}

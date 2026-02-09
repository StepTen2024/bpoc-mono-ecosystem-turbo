import { NextRequest, NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';

// Initialize Anthropic client
const apiKey = process.env.ANTHROPIC_API_KEY || process.env.CLAUDE_API_KEY || '';
const anthropic = new Anthropic({
  apiKey,
});

export async function POST(req: NextRequest) {
  if (!apiKey) {
    console.error('AI Service Error: Missing ANTHROPIC_API_KEY or CLAUDE_API_KEY');
    return NextResponse.json({ error: 'AI Service not configured' }, { status: 503 });
  }

  try {
    const body = await req.json();
    const { content, type, context_posts, title, description, category, sectionType } = body;

    // For generate_full and generate_description, content is optional (can generate from just title)
    if (!content && type !== 'generate_full' && type !== 'generate_description') {
      return NextResponse.json({ error: 'Content is required' }, { status: 400 });
    }

    // For generate_full, we need at least a title
    if (type === 'generate_full' && !title && !content) {
      return NextResponse.json({ error: 'Title or content is required for article generation' }, { status: 400 });
    }

    // For generate_description, we need a title
    if (type === 'generate_description' && !title) {
      return NextResponse.json({ error: 'Title is required for description generation' }, { status: 400 });
    }

    let prompt = '';
    
    if (type === 'improve') {
      prompt = `
        You are "Ate Yna", a veteran Filipino BPO Career Coach and SEO Expert.
        
        YOUR GOAL: Rewrite the following content to be:
        1. **High-Ranking (RankMath/SEMRush Standards):** 
           - Use active voice.
           - Keep paragraphs short (2-3 sentences).
           - Use LSI keywords naturally.
           - Ensure high readability score (Flesch-Kincaid).
        2. **Authentic "Ate Yna" Persona:**
           - Tone: Warm, encouraging, "Real Talk", authoritative but friendly.
           - Language: 90% English, 10% Taglish (use natural slang like "diskarte", "grabe", "sayang", "kaya mo yan", "bawal sumuko").
           - NO generic AI fluff (e.g., "In the dynamic landscape of..."). Start with a hook.
        
        FORMATTING RULES:
        - Return the content in **Markdown**.
        - Use **bold** for key concepts.
        - Use > Blockquotes for "Real Talk" tips.
        - Ensure headings are clear and hierarchical.

        Original Content:
        "${content}"
      `;
    } else if (type === 'suggest_links') {
      const postsList = context_posts?.map((p: any) => `- Title: "${p.title}", Slug: "${p.slug}"`).join('\n') || '';
      
      prompt = `
        You are an elite SEO Interlinking Expert. Your job is to find text in the content and suggest PERFECT anchor text replacements.

        Available Articles to Link To:
        ${postsList}
        
        Content to Search:
        """
        ${content}
        """
        
        TASK: Find 3-5 opportunities to add internal links. For each:
        1. Find an EXACT phrase that exists in the content (original_text)
        2. Suggest an SEO-optimized anchor text replacement (anchor_text)
        3. Match to a relevant target article (slug)
        
        OUTPUT: Return JSON with "suggestions" array. Each item has:
        - "original_text": The EXACT phrase from the content (copy-paste, must exist word-for-word)
        - "anchor_text": SEO-optimized replacement text (can be same as original or slightly improved)
        - "slug": Target article slug
        - "reason": Brief reason
        
        EXAMPLES of good suggestions:
        - original_text: "your salary", anchor_text: "your BPO salary", slug: "bpo-salary-guide-philippines"
        - original_text: "get promoted", anchor_text: "get promoted fast in BPO", slug: "how-to-get-promoted-bpo-call-center"
        - original_text: "benefits", anchor_text: "employee benefits", slug: "bpo-employee-benefits-rights-philippines"
        
        RULES:
        - original_text MUST exist exactly in the content (search carefully!)
        - anchor_text should be natural, keyword-rich, 2-5 words
        - Don't link same target twice
        - Prioritize high-value SEO keywords
        
        Return ONLY valid JSON. No markdown, no explanation.
      `;
    } else if (type === 'generate_full') {
      prompt = `
        You are "Ate Yna", a veteran Filipino BPO Career Coach, SEO Expert, and Content Writer.
        
        YOUR TASK: Write a complete, high-quality blog article with THREE distinct sections based on the following information:
        
        Title: "${title || content}"
        Description: "${description || ''}"
        Category: "${category || 'BPO Jobs & Careers'}"
        ${content ? `\nExisting Introduction (expand on this):\n"${content}"` : ''}
        
        STRUCTURE REQUIREMENTS:
        Return a JSON object with exactly these 3 fields:
        {
          "content_part1": "Introduction section (3-4 paragraphs) - Hook the reader, introduce the topic, state what they'll learn",
          "content_part2": "Main Body section (5-7 paragraphs) - Detailed information, tips, examples, data, actionable advice WITH TABLES AND VISUAL ELEMENTS",
          "content_part3": "Conclusion section (2-3 paragraphs) - Summary, call-to-action, encouragement"
        }
        
        CONTENT RULES:
        1. **High-Ranking (RankMath/SEMRush Standards):**
           - Use active voice
           - Keep paragraphs short (2-3 sentences max)
           - Use LSI keywords naturally
           - Ensure high readability score (Flesch-Kincaid)
           - Include relevant statistics and numbers when appropriate
        
        2. **Authentic "Ate Yna" Persona:**
           - Tone: Warm, encouraging, "Real Talk", authoritative but friendly
           - Language: 90% English, 10% Taglish (use natural slang like "diskarte", "grabe", "sayang", "kaya mo yan", "bawal sumuko", "alam mo ba")
           - NO generic AI fluff (e.g., "In the dynamic landscape of...")
           - Start Section 1 with a strong hook
           - Include "Real Talk" tips using > blockquotes
        
        3. **Formatting (Markdown):**
           - Use **bold** for key concepts
           - Use > Blockquotes for "Ate Yna Real Talk" tips
           - Use bullet points or numbered lists where appropriate
           - Include subheadings (## or ###) to break up content
           - Each section should be self-contained but flow naturally
        
        4. **INFOGRAPHIC FORMATTING (Clean & Professional - NO EMOJIS!):**
           
           a) **COMPACT TABLES** (3-5 rows max):
              | Role | Salary | Level |
              |------|--------|-------|
              | CSR | ₱18-22k | Entry |
              | TSR | ₱25-35k | Mid |
           
           b) **NUMBERED SEQUENCES** (bold numbers, no emoji):
              **1.** First step → **2.** Second step → **3.** Third step
           
           c) **FLOW DIAGRAMS** (arrows only, no emoji):
              Apply → Screen → Test → Interview → Hired
           
           d) **CALLOUT BOXES** (use these exact markers):
              > [TIP] Concise advice in one line
              > [KEY] Main takeaway in one line
              > [WARNING] Quick warning in one line
              > [INFO] Statistics or data
              > [SUCCESS] Encouragement message
           
           e) **TIMELINE FORMAT**:
              **Month 1:** Training | **Month 3:** Solo | **Month 6:** Review | **Year 1:** Promo
           
           f) **INLINE STATS**:
              **Numbers:** ₱18-25k entry | ₱30-50k mid | ₱60k+ senior
           
           g) **BULLET LIST** (dashes, no emoji):
              - Resume ready
              - English fluent
              - IDs complete
              - Flexible schedule
        
        5. **Length:**
           - Section 1: ~400-500 words
           - Section 2: ~800-1000 words (MUST include at least 1 table)
           - Section 3: ~300-400 words
           - Total: ~1500-1900 words
        
        Return ONLY the JSON object. No markdown code blocks, no explanation.
      `;
    } else if (type === 'improve_section') {
      // Improve a single section of the article
      const sectionContext = {
        'Introduction': 'This is the INTRODUCTION section. Hook readers, introduce the topic, and set expectations.',
        'Main Body': 'This is the MAIN BODY section. Provide detailed information, tips, examples, and actionable advice.',
        'Conclusion': 'This is the CONCLUSION section. Summarize key points, provide a call-to-action, and encourage readers.',
      };
      
      prompt = `
        You are "Ate Yna", a veteran Filipino BPO Career Coach and SEO Expert.
        
        CONTEXT:
        - Article Title: "${title || 'BPO Career Article'}"
        - Category: "${category || 'BPO Jobs & Careers'}"
        - Section Type: ${sectionType} - ${sectionContext[sectionType as keyof typeof sectionContext] || ''}
        
        YOUR TASK: Rewrite and improve ONLY this ${sectionType} section to be:
        
        1. **High-Ranking (RankMath/SEMRush Standards):**
           - Use active voice
           - Keep paragraphs short (2-3 sentences)
           - Use LSI keywords naturally
           - Ensure high readability score (Flesch-Kincaid)
        
        2. **Authentic "Ate Yna" Persona:**
           - Tone: Warm, encouraging, "Real Talk", authoritative but friendly
           - Language: 90% English, 10% Taglish (natural slang like "diskarte", "grabe", "sayang", "kaya mo yan")
           - NO generic AI fluff (e.g., "In the dynamic landscape of...")
           ${sectionType === 'Introduction' ? '- Start with a strong hook that grabs attention' : ''}
           ${sectionType === 'Conclusion' ? '- End with encouragement and a clear call-to-action' : ''}
        
        3. **Formatting (Markdown):**
           - Use **bold** for key concepts
           - Use > Blockquotes for "Ate Yna Real Talk" tips
           - Use bullet points or numbered lists where appropriate
           - Include subheadings (## or ###) if the section is long
        
        4. **INFOGRAPHIC FORMATTING (Clean & Professional - NO EMOJIS!):**
           
           ${sectionType === 'Introduction' ? `
           a) **CALLOUT BOXES** (use exact markers):
              > [KEY] What you'll learn: Point 1, Point 2, Point 3
              > [TIP] Quick advice in one line
           
           b) **INLINE STATS**:
              **Quick Numbers:** Stat 1 | Stat 2 | Stat 3
           
           c) **PREVIEW SEQUENCE**:
              **1.** Topic 1 → **2.** Topic 2 → **3.** Topic 3
           ` : ''}
           
           ${sectionType === 'Main Body' ? `
           a) **COMPACT TABLES** (3-5 rows, include 1-2):
              | Item | Value | Notes |
              |------|-------|-------|
              | Data | Data | Data |
           
           b) **NUMBERED SEQUENCES** (bold numbers, no emoji):
              **1.** Step one → **2.** Step two → **3.** Step three
           
           c) **FLOW DIAGRAMS** (arrows only):
              Start → Process → Check → Done
           
           d) **CALLOUT BOXES** (2-3 throughout, use exact markers):
              > [TIP] Advice in one line
              > [WARNING] Caution in one line
              > [KEY] Takeaway in one line
              > [INFO] Data or statistics
              > [SUCCESS] Encouragement (Ate Yna style)
           
           e) **TIMELINE**:
              **Week 1:** Start | **Month 1:** Progress | **Month 6:** Milestone
           
           f) **COMPARISON TABLE**:
              | Do This | Avoid This |
              |---------|------------|
              | Action 1 | Mistake 1 |
           ` : ''}
           
           ${sectionType === 'Conclusion' ? `
           a) **ACTION LIST** (bullet format):
              - Action 1
              - Action 2
              - Action 3
           
           b) **SUMMARY TABLE** (2-3 rows):
              | Key Point | Your Action |
              |-----------|-------------|
              | Point 1 | Do this now |
           
           c) **NUMBERED NEXT STEPS**:
              **1.** First priority → **2.** Second priority → **3.** Third priority
           
           d) **FINAL CALLOUT**:
              > [SUCCESS] Motivational message here. Kaya mo 'yan!
           ` : ''}
        
        ORIGINAL ${sectionType.toUpperCase()} CONTENT TO IMPROVE:
        """
        ${content}
        """
        
        CRITICAL INSTRUCTIONS:
        1. You MUST significantly rewrite and improve the content - do NOT return similar text
        2. ADD at least 1-2 visual elements (table, numbered sequence, or callout box)
        3. TRANSFORM plain paragraphs into scannable formats:
           - Convert lists to numbered sequences (bold numbers like **1.** **2.** **3.**)
           - Add relevant comparison tables
           - Include callout boxes using markers: > [TIP], > [KEY], > [WARNING], > [INFO], > [SUCCESS]
        4. Keep the same core message but make it MORE ENGAGING
        5. Make VISIBLE changes - the user should clearly see the improvement
        6. NO EMOJIS - use text markers and bold numbers only
        
        Return ONLY the improved markdown content. No explanations, no "Here's the improved version", just the content itself.
      `;
    } else if (type === 'generate_description') {
      prompt = `
        You are "Ate Yna", a veteran Filipino BPO Career Coach and SEO Expert.
        
        YOUR TASK: Write an SEO-optimized meta description/excerpt for this article.
        
        Article Title: "${title}"
        Category: "${category || 'BPO Jobs & Careers'}"
        ${content ? `Content Preview: "${content.substring(0, 500)}..."` : ''}
        
        REQUIREMENTS:
        1. **Length**: 120-155 characters (optimal for Google snippets)
        2. **SEO-Optimized**:
           - Include the main keyword naturally
           - Use action words (Learn, Discover, Find out, Get)
           - Make it compelling to click
        3. **"Ate Yna" Style**:
           - Warm and encouraging tone
           - Can include one Taglish word if natural (e.g., "diskarte", "tips")
           - No generic AI fluff
        4. **Structure**:
           - Hook + Value proposition + Benefit
           - Example: "Discover the real BPO salary ranges in 2026. Get insider tips on negotiating your pay and maximizing your career growth."
        
        IMPORTANT:
        - Return ONLY the description text
        - No quotes around it
        - No "Description:" prefix
        - Keep it under 160 characters
        - Make it sound human, not robotic
      `;
    } else if (type === 'score') {
      prompt = `
        Analyze the following blog post content for SEO and Engagement.
        
        Content:
        "${content}"
        
        Provide a JSON response with the following fields:
        - score (0-100)
        - readability_level (String)
        - keyword_density (String)
        - suggestions (Array of strings)
        - sentiment (String)
        
        Return ONLY the JSON.
      `;
    }

    // Use higher max_tokens for full article generation and improve_section
    const maxTokens = (type === 'generate_full' || type === 'improve_section') ? 8192 : 2048;
    
    // Use better model for content generation/improvement
    const model = (type === 'generate_full' || type === 'improve_section' || type === 'improve') 
      ? "claude-sonnet-4-20250514"
      : "claude-3-haiku-20240307";
    
    console.log(`[Analyze API] Type: ${type}, Model: ${model}, MaxTokens: ${maxTokens}`);
    
    const response = await anthropic.messages.create({
      model,
      max_tokens: maxTokens,
      messages: [{ role: "user", content: prompt }],
    });

    const textResponse = response.content[0].type === 'text' ? response.content[0].text : '';
    
    console.log(`[Analyze API] Response length: ${textResponse.length} chars`);

    if (type === 'score' || type === 'suggest_links' || type === 'generate_full') {
      try {
        // Extract JSON if wrapped in markdown code blocks
        const jsonMatch = textResponse.match(/\{[\s\S]*\}/);
        const jsonStr = jsonMatch ? jsonMatch[0] : textResponse;
        const jsonResponse = JSON.parse(jsonStr);
        return NextResponse.json(jsonResponse);
      } catch (e) {
        // For generate_full, return error with raw response for debugging
        if (type === 'generate_full') {
          return NextResponse.json({ 
            error: 'Failed to parse AI response. The content may be incomplete.',
            raw: textResponse 
          }, { status: 500 });
        }
        return NextResponse.json({ 
          score: 0, 
          suggestions: ["AI response parsing failed. Raw response available."],
          raw: textResponse 
        });
      }
    }

    // Clean up the response - remove any prefixes the AI might add
    let cleanedResponse = textResponse;
    
    // Remove common AI prefixes
    const prefixesToRemove = [
      /^Here['']s the improved.*?:\s*/i,
      /^Here is the improved.*?:\s*/i,
      /^Improved content:\s*/i,
      /^The improved.*?:\s*/i,
      /^```markdown\s*/i,
      /^```\s*/i,
    ];
    
    for (const prefix of prefixesToRemove) {
      cleanedResponse = cleanedResponse.replace(prefix, '');
    }
    
    // Remove trailing code block markers
    cleanedResponse = cleanedResponse.replace(/\s*```$/i, '').trim();
    
    console.log(`[Analyze API] Returning cleaned response: ${cleanedResponse.length} chars`);

    return NextResponse.json({ result: cleanedResponse });

  } catch (error) {
    console.error('AI Analysis Error:', error);
    return NextResponse.json({ error: 'Failed to analyze content' }, { status: 500 });
  }
}

import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { verifyAuthToken } from '@/lib/auth/verify-token';
import { generateJobToken } from '@/lib/client-tokens';
import { sendClientJobCreatedEmail } from '@/lib/email';

const GEMINI_API_KEY = process.env.GOOGLE_GENERATIVE_AI_API_KEY;

interface JobValidationResult {
  isValid: boolean;
  approvalStatus: 'approved' | 'pending_review' | 'rejected';
  score: number;
  checks: {
    hasSubstantialContent: boolean;
    looksLegitimate: boolean;
    noInappropriateContent: boolean;
    hasReasonableTitle: boolean;
    hasRequirements: boolean;
  };
  issues: string[];
  summary: string;
}

async function validateJobWithAI(job: {
  title: string;
  description: string;
  requirements?: string[];
  responsibilities?: string[];
  company_name?: string;
  agencyName?: string;
}): Promise<JobValidationResult> {
  if (!GEMINI_API_KEY) {
    // No AI key — auto-approve with basic checks
    const hasContent = (job.description?.length || 0) > 50;
    return {
      isValid: hasContent,
      approvalStatus: hasContent ? 'approved' : 'pending_review',
      score: hasContent ? 80 : 40,
      checks: {
        hasSubstantialContent: hasContent,
        looksLegitimate: true,
        noInappropriateContent: true,
        hasReasonableTitle: (job.title?.length || 0) > 3,
        hasRequirements: (job.requirements?.length || 0) > 0,
      },
      issues: hasContent ? [] : ['Job description is too short'],
      summary: hasContent ? 'Basic validation passed' : 'Job needs more content',
    };
  }

  try {
    const prompt = `You are a job posting validator for BPOC, a BPO recruitment platform in the Philippines.

Validate this job posting and return a JSON object:

JOB TITLE: ${job.title}
COMPANY: ${job.company_name || 'Unknown'}
AGENCY: ${job.agencyName || 'Unknown'}
DESCRIPTION: ${job.description || 'None provided'}
REQUIREMENTS: ${JSON.stringify(job.requirements || [])}
RESPONSIBILITIES: ${JSON.stringify(job.responsibilities || [])}

Return this exact JSON structure:
{
  "isValid": true/false,
  "score": 0-100,
  "checks": {
    "hasSubstantialContent": true if description has meaningful content (not just 1-2 sentences),
    "looksLegitimate": true if this looks like a real job posting (not spam, test, or fake),
    "noInappropriateContent": true if no offensive, discriminatory, or suspicious content,
    "hasReasonableTitle": true if job title is realistic (not gibberish or inappropriate),
    "hasRequirements": true if there are actual job requirements listed
  },
  "issues": ["list any problems found"],
  "summary": "One sentence summary of the validation result"
}

RULES:
- BPO jobs should have clear descriptions of the role
- One-liner descriptions = NOT valid
- Test/dummy jobs = NOT valid  
- Inappropriate content (harassment, discrimination, scams) = NOT valid
- Generic but real jobs with minimal info = valid but lower score
- Be lenient for legitimate-looking jobs, strict for obvious problems`;

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_API_KEY}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { response_mime_type: 'application/json' },
        }),
      }
    );

    if (!response.ok) {
      console.error('AI validation failed:', await response.text());
      return {
        isValid: true,
        approvalStatus: 'approved',
        score: 70,
        checks: { hasSubstantialContent: true, looksLegitimate: true, noInappropriateContent: true, hasReasonableTitle: true, hasRequirements: true },
        issues: ['AI validation unavailable — auto-approved'],
        summary: 'AI validation unavailable, approved by default',
      };
    }

    const result = await response.json();
    const parsed = JSON.parse(result.candidates[0].content.parts[0].text);
    const data = Array.isArray(parsed) ? parsed[0] : parsed;

    // Determine approval status based on score and checks
    let approvalStatus: 'approved' | 'pending_review' | 'rejected' = 'approved';
    if (!data.isValid || data.score < 40) {
      approvalStatus = 'rejected';
    } else if (data.score < 60 || data.issues?.length > 2) {
      approvalStatus = 'pending_review';
    }

    return {
      isValid: data.isValid ?? true,
      approvalStatus,
      score: data.score ?? 70,
      checks: data.checks ?? {},
      issues: data.issues ?? [],
      summary: data.summary ?? 'Validation complete',
    };
  } catch (error) {
    console.error('AI job validation error:', error);
    return {
      isValid: true,
      approvalStatus: 'approved',
      score: 70,
      checks: { hasSubstantialContent: true, looksLegitimate: true, noInappropriateContent: true, hasReasonableTitle: true, hasRequirements: true },
      issues: ['AI validation error — auto-approved'],
      summary: 'AI validation error, approved by default',
    };
  }
}

export async function POST(request: NextRequest) {
  try {
    const auth = await verifyAuthToken(request);
    const userId = auth.userId;
    if (!userId) {
      return NextResponse.json({ error: auth.error || 'Not authenticated' }, { status: 401 });
    }

    // Verify recruiter and get their info
    const { data: recruiter, error: recruiterError } = await supabaseAdmin
      .from('agency_recruiters')
      .select('id, agency_id, role')
      .eq('user_id', userId)
      .single();

    if (recruiterError || !recruiter) {
      return NextResponse.json({ error: 'Recruiter not found' }, { status: 403 });
    }

    const body = await request.json();
    const {
      agency_client_id,
      clientId, // Also accept clientId for compatibility
      title,
      description,
      briefDescription,
      requirements,
      responsibilities,
      benefits,
      skills,
      salaryMin,
      salaryMax,
      currency,
      workType,
      workArrangement,
      shift,
      experienceLevel,
    } = body;

    // Use agency_client_id or clientId
    const selectedClientId = agency_client_id || clientId;

    if (!title) {
      return NextResponse.json({ error: 'Title is required' }, { status: 400 });
    }

    if (!selectedClientId) {
      return NextResponse.json({ error: 'Client is required' }, { status: 400 });
    }

    // Verify the client belongs to this recruiter's agency
    const { data: client, error: clientError } = await supabaseAdmin
      .from('agency_clients')
      .select('id, agency_id')
      .eq('id', selectedClientId)
      .eq('agency_id', recruiter.agency_id)
      .single();

    if (clientError || !client) {
      return NextResponse.json({ error: 'Client not found or does not belong to your agency' }, { status: 400 });
    }

    // Generate slug
    const slug = title.toLowerCase().replace(/[^a-z0-9]+/g, '-') + '-' + Math.random().toString(36).substring(2, 10);

    // Map form values to database enum values
    const expLevelMap: Record<string, string> = {
      'entry': 'entry_level',
      'mid': 'mid_level',
      'senior': 'senior_level',
      'lead': 'senior_level',
      'entry_level': 'entry_level',
      'mid_level': 'mid_level',
      'senior_level': 'senior_level',
    };
    const mappedExperienceLevel = expLevelMap[experienceLevel] || 'mid_level';

    // Map shift values (form might send 'flexible' but db expects 'both')
    const shiftMap: Record<string, string> = {
      'day': 'day',
      'night': 'night',
      'flexible': 'both',
      'both': 'both',
    };
    const mappedShift = shiftMap[shift] || 'day';

    // Get company and agency names for validation context
    let companyName = '';
    let agencyName = '';
    if (selectedClientId) {
      const { data: clientData } = await supabaseAdmin
        .from('agency_clients')
        .select('companies(name), agencies(name)')
        .eq('id', selectedClientId)
        .single();
      companyName = (clientData as any)?.companies?.name || '';
      agencyName = (clientData as any)?.agencies?.name || '';
    }

    // AI validates the job posting
    console.log(`🤖 [JOB-CREATE] Running AI validation for: ${title}`);
    const validation = await validateJobWithAI({
      title,
      description: description || briefDescription || '',
      requirements: requirements || [],
      responsibilities: responsibilities || [],
      company_name: companyName,
      agencyName,
    });
    console.log(`✅ [JOB-CREATE] AI validation result: ${validation.approvalStatus} (score: ${validation.score})`);

    // Use AI validation result for approval
    const approvalStatus = validation.approvalStatus;
    const jobStatus = validation.approvalStatus === 'approved' ? 'active' : 'draft';

    // Create job
    const { data: job, error: jobError } = await supabaseAdmin
      .from('jobs')
      .insert({
        agency_client_id: selectedClientId,
        posted_by: recruiter.id,
        title,
        slug,
        description: description || briefDescription || '',
        requirements: requirements || [],
        responsibilities: responsibilities || [],
        benefits: benefits || [],
        salary_min: salaryMin ? parseFloat(salaryMin) : null,
        salary_max: salaryMax ? parseFloat(salaryMax) : null,
        currency: currency || 'PHP',
        work_type: workType || 'full_time',
        work_arrangement: workArrangement || 'remote',
        shift: mappedShift,
        experience_level: mappedExperienceLevel,
        status: jobStatus,
        approval_status: approvalStatus,
        approved_by: validation.approvalStatus === 'approved' ? recruiter.id : null,
        approved_at: validation.approvalStatus === 'approved' ? new Date().toISOString() : null,
        requires_approval: validation.approvalStatus !== 'approved',
        ai_validation: validation,
        ai_validated_at: new Date().toISOString(),
        source: 'manual',
      })
      .select()
      .single();

    if (jobError) {
      console.error('Job creation error:', jobError);
      return NextResponse.json({ error: 'Failed to create job', details: jobError.message }, { status: 500 });
    }

    // Add skills
    if (skills && skills.length > 0) {
      const skillInserts = skills.map((skill: string) => ({
        job_id: job.id,
        name: skill,
        is_required: true,
      }));

      await supabaseAdmin
        .from('job_skills')
        .insert(skillInserts);
    }

    // Generate client job access token (standard platform)
    let jobToken = null;
    try {
      const tokenData = await generateJobToken(
        job.id,
        selectedClientId,
        userId,
        null // No expiration - permanent until job closes
      );
      jobToken = tokenData;

      // Send email to client with job dashboard link
      try {
        // Get client contact information
        const { data: clientContact } = await supabaseAdmin
          .from('agency_clients')
          .select('contact_name, contact_email')
          .eq('id', selectedClientId)
          .single();

        // Get recruiter information
        const { data: recruiterUser } = await supabaseAdmin
          .from('users')
          .select('first_name, last_name')
          .eq('id', userId)
          .single();

        if (clientContact?.contact_email && recruiterUser) {
          const recruiterName = `${recruiterUser.first_name} ${recruiterUser.last_name}`;
          await sendClientJobCreatedEmail(
            clientContact.contact_email,
            clientContact.contact_name || 'Client',
            title,
            recruiterName,
            tokenData.dashboardUrl
          );
          console.log('Job created email sent to client:', clientContact.contact_email);
        }
      } catch (emailError) {
        console.error('Failed to send job created email:', emailError);
        // Don't fail the request if email fails
      }
    } catch (tokenError) {
      console.error('Failed to generate job token:', tokenError);
      // Continue anyway - token generation failure shouldn't block job creation
    }

    return NextResponse.json({
      success: true,
      message: 'Job created successfully',
      job,
      clientJobToken: jobToken, // Include token data in response
    });

  } catch (error) {
    console.error('Create job error:', error);
    return NextResponse.json({ error: 'Failed to create job' }, { status: 500 });
  }
}

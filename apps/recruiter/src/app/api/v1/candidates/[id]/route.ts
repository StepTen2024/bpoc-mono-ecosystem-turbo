import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { validateApiKey } from '../../auth';
import { handleCorsOptions, withCors } from '../../cors';
import { transformToApi, transformFromApi, apiError, apiSuccess, API_ERROR_CODES } from '@/lib/api/transform';

/**
 * OPTIONS - CORS preflight
 */
export async function OPTIONS() {
  return handleCorsOptions();
}

/**
 * GET /api/v1/candidates/:id
 * Get a specific candidate's details
 */
export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const auth = await validateApiKey(request);
  if ('error' in auth) {
    return withCors(NextResponse.json({ error: auth.error }, { status: auth.status }));
  }

  try {
    const { id } = await context.params;

    // Fetch candidate
    const { data: candidate, error: candidateError } = await supabaseAdmin
      .from('candidates')
      .select(`
        id,
        first_name,
        last_name,
        email,
        phone,
        avatar_url,
        is_active,
        created_at,
        updated_at
      `)
      .eq('id', id)
      .single();

    if (candidateError || !candidate) {
      const error = apiError(
        'Candidate not found',
        API_ERROR_CODES.NOT_FOUND,
        404
      );
      return withCors(NextResponse.json(error.body, { status: error.status }));
    }

    // Fetch profile
    const { data: profile } = await supabaseAdmin
      .from('candidate_profiles')
      .select('headline, bio, position, location, location_city, location_province, location_country, work_status, expected_salary_min, expected_salary_max, preferred_shift, preferred_work_setup')
      .eq('candidate_id', id)
      .single();

    // Fetch skills
    const { data: skills } = await supabaseAdmin
      .from('candidate_skills')
      .select('name')
      .eq('candidate_id', id);

    // Fetch resume
    const { data: resume } = await supabaseAdmin
      .from('candidate_resumes')
      .select('file_url, file_name, uploaded_at')
      .eq('candidate_id', id)
      .eq('is_primary', true)
      .single();

    // Fetch work experiences for experience years calculation
    const { data: workExps } = await supabaseAdmin
      .from('candidate_work_experiences')
      .select('start_date, end_date, is_current, job_title, company_name')
      .eq('candidate_id', id)
      .order('start_date', { ascending: false });

    let experienceYears = 0;
    (workExps || []).forEach(w => {
      const start = w.start_date ? new Date(w.start_date) : null;
      const end = w.is_current ? new Date() : (w.end_date ? new Date(w.end_date) : null);
      if (start && end) {
        experienceYears += (end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24 * 365.25);
      }
    });

    // Build response
    const response = {
      ...candidate,
      headline: profile?.headline || null,
      bio: profile?.bio || null,
      position: profile?.position || null,
      location: profile?.location || profile?.location_city || null,
      location_city: profile?.location_city || null,
      location_province: profile?.location_province || null,
      location_country: profile?.location_country || null,
      work_status: profile?.work_status || null,
      expected_salary_min: profile?.expected_salary_min || null,
      expected_salary_max: profile?.expected_salary_max || null,
      preferred_shift: profile?.preferred_shift || null,
      preferred_work_setup: profile?.preferred_work_setup || null,
      experience_years: Math.round(experienceYears) || null,
      latest_job_title: workExps?.[0]?.job_title || null,
      latest_company: workExps?.[0]?.company_name || null,
      work_experiences: (workExps || []).map(w => ({
        job_title: w.job_title,
        company_name: w.company_name,
        start_date: w.start_date,
        end_date: w.end_date,
        is_current: w.is_current,
      })),
      skills: (skills || []).map(s => s.name),
      resume_url: resume?.file_url || null,
    };

    const success = apiSuccess(response, 200);
    return withCors(NextResponse.json(success.body, { status: success.status }));

  } catch (error) {
    console.error('API v1 GET candidate error:', error);
    const err = apiError(
      'Internal server error',
      API_ERROR_CODES.INTERNAL_ERROR,
      500
    );
    return withCors(NextResponse.json(err.body, { status: err.status }));
  }
}

/**
 * PUT /api/v1/candidates/:id
 * Update an existing candidate
 * 
 * Body (camelCase or snake_case accepted):
 *   firstName/first_name: string (optional)
 *   lastName/last_name: string (optional)
 *   email: string (optional)
 *   phone: string (optional)
 *   avatarUrl/avatar_url: string (optional)
 *   headline: string (optional)
 *   location: string (optional)
 *   experienceYears/experience_years: number (optional)
 *   bio: string (optional)
 *   skills: string[] (optional - replaces all skills)
 *   resumeUrl/resume_url: string (optional)
 */
export async function PUT(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const auth = await validateApiKey(request);
  if ('error' in auth) {
    return withCors(NextResponse.json({ error: auth.error }, { status: auth.status }));
  }

  try {
    const { id } = await context.params;
    const body = await request.json();
    
    // Transform input to snake_case for database
    const input = transformFromApi(body);

    // Check if candidate exists
    const { data: existingCandidate, error: checkError } = await supabaseAdmin
      .from('candidates')
      .select('id, email')
      .eq('id', id)
      .single();

    if (checkError || !existingCandidate) {
      const error = apiError(
        'Candidate not found',
        API_ERROR_CODES.NOT_FOUND,
        404
      );
      return withCors(NextResponse.json(error.body, { status: error.status }));
    }

    // If email is being changed, check for conflicts
    if (input.email && input.email !== existingCandidate.email) {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(input.email)) {
        const error = apiError(
          'Invalid email format',
          API_ERROR_CODES.INVALID_FORMAT,
          400
        );
        return withCors(NextResponse.json(error.body, { status: error.status }));
      }

      const { data: emailCheck } = await supabaseAdmin
        .from('candidates')
        .select('id')
        .eq('email', input.email.toLowerCase())
        .neq('id', id)
        .single();

      if (emailCheck) {
        const error = apiError(
          'Email already in use by another candidate',
          API_ERROR_CODES.ALREADY_EXISTS,
          409
        );
        return withCors(NextResponse.json(error.body, { status: error.status }));
      }
    }

    // Update candidate base fields
    const candidateUpdates: any = {};
    if (input.first_name) candidateUpdates.first_name = input.first_name;
    if (input.last_name) candidateUpdates.last_name = input.last_name;
    if (input.email) candidateUpdates.email = input.email.toLowerCase();
    if (input.phone !== undefined) candidateUpdates.phone = input.phone;
    if (input.avatar_url !== undefined) candidateUpdates.avatar_url = input.avatar_url;
    
    if (Object.keys(candidateUpdates).length > 0) {
      candidateUpdates.updated_at = new Date().toISOString();
      
      const { error: updateError } = await supabaseAdmin
        .from('candidates')
        .update(candidateUpdates)
        .eq('id', id);

      if (updateError) {
        console.error('Failed to update candidate:', updateError);
        const error = apiError(
          'Failed to update candidate',
          API_ERROR_CODES.DATABASE_ERROR,
          500,
          { details: updateError.message }
        );
        return withCors(NextResponse.json(error.body, { status: error.status }));
      }
    }

    // Update or create profile if profile data provided
    if (input.headline !== undefined || input.location !== undefined || 
        input.experience_years !== undefined || input.bio !== undefined) {
      
      const profileUpdates: any = {};
      if (input.headline !== undefined) profileUpdates.headline = input.headline;
      if (input.location !== undefined) profileUpdates.location = input.location;
      if (input.experience_years !== undefined) profileUpdates.experience_years = input.experience_years;
      if (input.bio !== undefined) profileUpdates.bio = input.bio;

      // Try to update first
      const { data: existingProfile } = await supabaseAdmin
        .from('candidate_profiles')
        .select('candidate_id')
        .eq('candidate_id', id)
        .single();

      if (existingProfile) {
        await supabaseAdmin
          .from('candidate_profiles')
          .update(profileUpdates)
          .eq('candidate_id', id);
      } else {
        await supabaseAdmin
          .from('candidate_profiles')
          .insert({
            candidate_id: id,
            ...profileUpdates,
          });
      }
    }

    // Update skills if provided (replaces all existing skills)
    if (input.skills && Array.isArray(input.skills)) {
      // Delete existing skills
      await supabaseAdmin
        .from('candidate_skills')
        .delete()
        .eq('candidate_id', id);

      // Insert new skills
      if (input.skills.length > 0) {
        const skillsToInsert = input.skills.map((skill: string) => ({
          candidate_id: id,
          name: skill,
        }));

        await supabaseAdmin
          .from('candidate_skills')
          .insert(skillsToInsert);
      }
    }

    // Update resume URL if provided
    if (input.resume_url !== undefined) {
      if (input.resume_url) {
        // Check if primary resume exists
        const { data: existingResume } = await supabaseAdmin
          .from('candidate_resumes')
          .select('id')
          .eq('candidate_id', id)
          .eq('is_primary', true)
          .single();

        if (existingResume) {
          // Update existing
          await supabaseAdmin
            .from('candidate_resumes')
            .update({ file_url: input.resume_url })
            .eq('id', existingResume.id);
        } else {
          // Insert new
          await supabaseAdmin
            .from('candidate_resumes')
            .insert({
              candidate_id: id,
              file_url: input.resume_url,
              file_name: 'Resume',
              file_type: 'application/pdf',
              is_primary: true,
            });
        }
      } else {
        // Remove resume if set to null/empty
        await supabaseAdmin
          .from('candidate_resumes')
          .delete()
          .eq('candidate_id', id)
          .eq('is_primary', true);
      }
    }

    // Fetch updated candidate data
    const { data: updatedCandidate } = await supabaseAdmin
      .from('candidates')
      .select(`
        id,
        first_name,
        last_name,
        email,
        phone,
        avatar_url,
        is_active,
        created_at,
        updated_at
      `)
      .eq('id', id)
      .single();

    // Fetch profile
    const { data: updatedProfile } = await supabaseAdmin
      .from('candidate_profiles')
      .select('headline, bio, position, location, location_city, location_province, location_country, work_status')
      .eq('candidate_id', id)
      .single();

    // Fetch skills
    const { data: updatedSkills } = await supabaseAdmin
      .from('candidate_skills')
      .select('name')
      .eq('candidate_id', id);

    // Fetch resume
    const { data: updatedResume } = await supabaseAdmin
      .from('candidate_resumes')
      .select('file_url')
      .eq('candidate_id', id)
      .eq('is_primary', true)
      .single();

    // Build response
    const response = {
      ...updatedCandidate,
      headline: updatedProfile?.headline || null,
      bio: updatedProfile?.bio || null,
      position: updatedProfile?.position || null,
      location: updatedProfile?.location || updatedProfile?.location_city || null,
      work_status: updatedProfile?.work_status || null,
      skills: (updatedSkills || []).map(s => s.name),
      resume_url: updatedResume?.file_url || null,
    };

    const success = apiSuccess(response, 200);
    return withCors(NextResponse.json(success.body, { status: success.status }));

  } catch (error) {
    console.error('API v1 PUT candidate error:', error);
    const err = apiError(
      'Internal server error',
      API_ERROR_CODES.INTERNAL_ERROR,
      500
    );
    return withCors(NextResponse.json(err.body, { status: err.status }));
  }
}

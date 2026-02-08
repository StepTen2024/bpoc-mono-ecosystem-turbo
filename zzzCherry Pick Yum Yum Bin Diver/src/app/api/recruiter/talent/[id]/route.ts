import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { verifyAuthToken } from '@/lib/auth/verify-token';

/**
 * GET /api/recruiter/talent/[id]
 * Fetch a single candidate's full profile for recruiters
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const auth = await verifyAuthToken(request);
    const userId = auth.userId;
    
    if (!userId) {
      return NextResponse.json({ error: auth.error || 'Unauthorized' }, { status: 401 });
    }

    // Verify recruiter exists
    const { data: recruiter } = await supabaseAdmin
      .from('agency_recruiters')
      .select('agency_id')
      .eq('user_id', userId)
      .single();

    if (!recruiter) {
      return NextResponse.json({ error: 'Recruiter not found' }, { status: 403 });
    }

    // PERFORMANCE OPTIMIZED: Use candidate_truth view (1 query instead of 7!)
    const { data: candidate, error: candidateError } = await supabaseAdmin
      .from('candidate_truth')
      .select('*')
      .eq('id', id)
      .single();

    if (candidateError || !candidate) {
      return NextResponse.json({ error: 'Candidate not found' }, { status: 404 });
    }

    // Fetch contact details from candidates table (not included in candidate_truth for privacy)
    const { data: contactInfo } = await supabaseAdmin
      .from('candidates')
      .select('email, phone')
      .eq('id', id)
      .single();

    // Parse skills to extract just the names
    const candidateSkills = Array.isArray(candidate.skills)
      ? candidate.skills.map((s: any) => typeof s === 'string' ? s : s.name)
      : [];

    // All data is now in the candidate object from candidate_truth view!
    const formattedCandidate = {
      id: candidate.id,
      firstName: candidate.first_name,
      lastName: candidate.last_name,
      email: contactInfo?.email || null,
      phone: candidate.phone || contactInfo?.phone || null,
      avatarUrl: candidate.avatar_url,
      username: candidate.username,
      location: candidate.location || null,
      locationCity: candidate.location_city || null,
      locationState: candidate.location_province || null,
      locationCountry: candidate.location_country || null,
      headline: candidate.headline || candidate.current_position || candidate.bio?.substring(0, 100) || null,
      createdAt: candidate.candidate_created_at,
      updatedAt: candidate.candidate_updated_at,
      isActive: candidate.is_active,
      activityStatus: candidate.activity_status,
      lastActive: candidate.last_active,
      isNew: candidate.is_new,
      profile: {
        bio: candidate.bio,
        position: candidate.current_position,
        experienceYears: candidate.experience_years || 0,
        totalExperienceYears: candidate.experience_years || 0,
        currentRole: candidate.current_position,
        targetRole: null,
        expectedSalaryMin: candidate.expected_salary_min,
        expectedSalaryMax: candidate.expected_salary_max,
        salaryCurrency: 'PHP',
        availableFrom: null,
        noticePeriodDays: candidate.notice_period_days,
        workStatus: candidate.work_status,
        linkedinUrl: candidate.linkedin,
        portfolioUrl: candidate.portfolio,
        githubUrl: candidate.github,
      },
      skills: candidateSkills,
      workExperiences: Array.isArray(candidate.work_experiences) ? candidate.work_experiences : [],
      educations: Array.isArray(candidate.educations) ? candidate.educations : [],
      resume: candidate.resume ? {
        id: candidate.resume.id,
        fileName: candidate.resume.fileName,
        uploadedAt: candidate.resume.uploadedAt,
      } : null,
      aiAnalysis: candidate.ai_analysis ? {
        overallScore: candidate.ai_analysis.overallScore,
        strengths: candidate.ai_analysis.keyStrengths,
        weaknesses: candidate.ai_analysis.improvements,
        summary: candidate.ai_analysis.improvedSummary,
        recommendations: candidate.ai_analysis.recommendations,
      } : null,
      discAssessment: null, // Not in view
      gamification: {
        totalXp: candidate.total_xp || 0,
        level: candidate.level || 1,
        badges: [],
      },
      stats: {
        totalApplications: candidate.total_applications || 0,
        totalPlacements: candidate.total_placements || 0,
      },
    };

    return NextResponse.json({
      success: true,
      candidate: formattedCandidate
    });

  } catch (error) {
    console.error('Fetch candidate error:', error);
    return NextResponse.json({ error: 'Failed to fetch candidate' }, { status: 500 });
  }
}


import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase/admin';

/**
 * GET /api/agencies/[id]
 * Fetch detailed agency info for admin
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    // Get agency with agency_profiles (LEFT JOIN)
    const { data: agency, error } = await supabase
      .from('agencies')
      .select(`
        *,
        agency_profiles (
          description,
          founded_year,
          employee_count,
          address_line1,
          address_line2,
          city,
          state,
          country,
          postal_code,
          linkedin_url,
          facebook_url,
          twitter_url,
          settings,
          branding
        )
      `)
      .eq('id', id)
      .single();

    if (error || !agency) {
      return NextResponse.json({ error: 'Agency not found' }, { status: 404 });
    }

    // Get recruiters
    const { data: recruiters } = await supabase
      .from('agency_recruiters')
      .select('id, first_name, last_name, email, avatar_url, role, created_at')
      .eq('agency_id', id);

    // Get clients with company info
    const { data: clients } = await supabase
      .from('agency_clients')
      .select(`
        id,
        status,
        created_at,
        companies (
          name,
          logo_url,
          industry
        )
      `)
      .eq('agency_id', id)
      .order('created_at', { ascending: false });

    const clientIds = clients?.map(c => c.id) || [];

    // Get job counts per client
    let jobCountMap: Record<string, number> = {};
    if (clientIds.length > 0) {
      const { data: jobs } = await supabase
        .from('jobs')
        .select('id, agency_client_id')
        .in('agency_client_id', clientIds);

      (jobs || []).forEach(j => {
        jobCountMap[j.agency_client_id] = (jobCountMap[j.agency_client_id] || 0) + 1;
      });
    }

    // Get all jobs for this agency's clients
    const { data: agencyJobs } = await supabase
      .from('jobs')
      .select('id, title, status, applicants_count, created_at, agency_client_id')
      .in('agency_client_id', clientIds.length > 0 ? clientIds : ['none'])
      .order('created_at', { ascending: false })
      .limit(10);

    const totalJobs = agencyJobs?.length || 0;
    const activeJobs = agencyJobs?.filter(j => j.status === 'active').length || 0;

    // Get placements (accepted offers) for this agency
    const jobIds = agencyJobs?.map(j => j.id) || [];
    let totalPlacements = 0;
    let totalRevenue = 0;

    if (jobIds.length > 0) {
      const { data: apps } = await supabase
        .from('job_applications')
        .select('id')
        .in('job_id', jobIds);

      const appIds = apps?.map(a => a.id) || [];

      if (appIds.length > 0) {
        const { data: offers } = await supabase
          .from('job_offers')
          .select('id, salary_offered')
          .in('application_id', appIds)
          .eq('status', 'accepted');

        totalPlacements = offers?.length || 0;
        totalRevenue = offers?.reduce((acc, o) => acc + (o.salary_offered || 0), 0) || 0;
      }
    }

    // Extract agency_profiles data (it's an array with one item or empty)
    const profile = Array.isArray(agency.agency_profiles) && agency.agency_profiles.length > 0
      ? agency.agency_profiles[0]
      : null;

    // Lookup admin who verified documents
    let verifiedByAdmin = null;
    if (agency.documents_verified_by) {
      const { data: admin } = await supabase
        .from('bpoc_users')
        .select('id, email, first_name, last_name')
        .eq('id', agency.documents_verified_by)
        .single();

      if (admin) {
        verifiedByAdmin = {
          id: admin.id,
          email: admin.email,
          firstName: admin.first_name || '',
          lastName: admin.last_name || '',
        };
      }
    }

    // Format response - camelCase to match frontend interfaces
    const formattedAgency = {
      id: agency.id,
      name: agency.name,
      slug: agency.slug,
      email: agency.email,
      phone: agency.phone,
      logoUrl: agency.logo_url,
      website: agency.website,
      isActive: agency.is_active,
      isVerified: agency.is_verified || false,
      description: profile?.description || agency.description,
      address: agency.address,
      city: profile?.city || agency.city,
      country: profile?.country || agency.country,
      createdAt: agency.created_at,

      // Profile data (from agency_profiles)
      foundedYear: profile?.founded_year,
      employeeCount: profile?.employee_count,
      addressLine1: profile?.address_line1,
      addressLine2: profile?.address_line2,
      state: profile?.state,
      postalCode: profile?.postal_code,
      linkedinUrl: profile?.linkedin_url,
      facebookUrl: profile?.facebook_url,
      twitterUrl: profile?.twitter_url,
      settings: profile?.settings || {},
      branding: profile?.branding || {},

      // Document fields
      tinNumber: agency.tin_number,
      dtiCertificateUrl: agency.dti_certificate_url,
      businessPermitUrl: agency.business_permit_url,
      secRegistrationUrl: agency.sec_registration_url,
      documentsUploadedAt: agency.documents_uploaded_at,
      documentsVerified: agency.documents_verified || false,
      documentsVerifiedAt: agency.documents_verified_at,
      documentsVerifiedBy: agency.documents_verified_by,
      documentVerification: agency.document_verification,
      verifiedByAdmin: verifiedByAdmin,

      // Stats
      totalJobs: totalJobs,
      activeJobs: activeJobs,
      totalPlacements: totalPlacements,
      totalRevenue: totalRevenue,

      // Related data
      recruiters: (recruiters || []).map(r => ({
        id: r.id,
        firstName: r.first_name || '',
        lastName: r.last_name || '',
        email: r.email,
        avatarUrl: r.avatar_url,
        role: r.role || 'recruiter',
        createdAt: r.created_at,
      })),
      clients: (clients || []).map(c => ({
        id: c.id,
        status: c.status || 'active',
        companyName: (c.companies as any)?.name || 'Unknown',
        companyLogo: (c.companies as any)?.logo_url,
        industry: (c.companies as any)?.industry,
        jobCount: jobCountMap[c.id] || 0,
        createdAt: c.created_at,
      })),
      recentJobs: (agencyJobs || []).map(j => ({
        id: j.id,
        title: j.title,
        status: j.status,
        applicantsCount: j.applicants_count || 0,
        createdAt: j.created_at,
      })),
    };

    return NextResponse.json({ agency: formattedAgency });

  } catch (error) {
    console.error('Error fetching agency:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

/**
 * PATCH /api/agencies/[id]
 * Update agency information
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();

    // Validate agency exists
    const { data: existingAgency, error: fetchError } = await supabase
      .from('agencies')
      .select('id')
      .eq('id', id)
      .single();

    if (fetchError || !existingAgency) {
      return NextResponse.json({ error: 'Agency not found' }, { status: 404 });
    }

    // Separate fields for agencies table vs agency_profiles table
    const agenciesFields: Record<string, any> = {};
    const profileFields: Record<string, any> = {};

    // Fields for agencies table
    if (body.name !== undefined) agenciesFields.name = body.name;
    if (body.email !== undefined) agenciesFields.email = body.email;
    if (body.phone !== undefined) agenciesFields.phone = body.phone;
    if (body.website !== undefined) agenciesFields.website = body.website;
    if (body.logoUrl !== undefined) agenciesFields.logo_url = body.logoUrl;
    if (body.isActive !== undefined) agenciesFields.is_active = body.isActive;
    if (body.isVerified !== undefined) agenciesFields.is_verified = body.isVerified;
    if (body.address !== undefined) agenciesFields.address = body.address;
    if (body.city !== undefined && !body.addressLine1) agenciesFields.city = body.city;
    if (body.country !== undefined && !body.addressLine1) agenciesFields.country = body.country;

    // Fields for agency_profiles table
    if (body.description !== undefined) profileFields.description = body.description;
    if (body.foundedYear !== undefined) profileFields.founded_year = body.foundedYear;
    if (body.employeeCount !== undefined) profileFields.employee_count = body.employeeCount;
    if (body.addressLine1 !== undefined) profileFields.address_line1 = body.addressLine1;
    if (body.addressLine2 !== undefined) profileFields.address_line2 = body.addressLine2;
    if (body.city !== undefined && body.addressLine1 !== undefined) profileFields.city = body.city;
    if (body.state !== undefined) profileFields.state = body.state;
    if (body.country !== undefined && body.addressLine1 !== undefined) profileFields.country = body.country;
    if (body.postalCode !== undefined) profileFields.postal_code = body.postalCode;
    if (body.linkedinUrl !== undefined) profileFields.linkedin_url = body.linkedinUrl;
    if (body.facebookUrl !== undefined) profileFields.facebook_url = body.facebookUrl;
    if (body.twitterUrl !== undefined) profileFields.twitter_url = body.twitterUrl;
    if (body.settings !== undefined) profileFields.settings = body.settings;
    if (body.branding !== undefined) profileFields.branding = body.branding;

    // Update agencies table
    if (Object.keys(agenciesFields).length > 0) {
      agenciesFields.updated_at = new Date().toISOString();

      const { error: updateError } = await supabase
        .from('agencies')
        .update(agenciesFields)
        .eq('id', id);

      if (updateError) {
        console.error('Error updating agency:', updateError);
        return NextResponse.json({ error: 'Failed to update agency' }, { status: 500 });
      }
    }

    // Update or create agency_profiles
    if (Object.keys(profileFields).length > 0) {
      profileFields.updated_at = new Date().toISOString();

      // Check if profile exists
      const { data: existingProfile } = await supabase
        .from('agency_profiles')
        .select('id')
        .eq('agency_id', id)
        .single();

      if (existingProfile) {
        // Update existing profile
        const { error: updateProfileError } = await supabase
          .from('agency_profiles')
          .update(profileFields)
          .eq('agency_id', id);

        if (updateProfileError) {
          console.error('Error updating agency profile:', updateProfileError);
          return NextResponse.json({ error: 'Failed to update agency profile' }, { status: 500 });
        }
      } else {
        // Create new profile
        const { error: createProfileError } = await supabase
          .from('agency_profiles')
          .insert({
            agency_id: id,
            ...profileFields,
            created_at: new Date().toISOString(),
          });

        if (createProfileError) {
          console.error('Error creating agency profile:', createProfileError);
          return NextResponse.json({ error: 'Failed to create agency profile' }, { status: 500 });
        }
      }
    }

    // Fetch updated agency data
    const { data: updatedAgency } = await supabase
      .from('agencies')
      .select(`
        *,
        agency_profiles (
          description,
          founded_year,
          employee_count,
          address_line1,
          address_line2,
          city,
          state,
          country,
          postal_code,
          linkedin_url,
          facebook_url,
          twitter_url,
          settings,
          branding
        )
      `)
      .eq('id', id)
      .single();

    const profile = Array.isArray(updatedAgency?.agency_profiles) && updatedAgency.agency_profiles.length > 0
      ? updatedAgency.agency_profiles[0]
      : null;

    const formattedAgency = {
      id: updatedAgency.id,
      name: updatedAgency.name,
      slug: updatedAgency.slug,
      email: updatedAgency.email,
      phone: updatedAgency.phone,
      logo_url: updatedAgency.logo_url,
      website: updatedAgency.website,
      is_active: updatedAgency.is_active,
      is_verified: updatedAgency.is_verified,
      description: profile?.description || updatedAgency.description,
      address: updatedAgency.address,
      city: profile?.city || updatedAgency.city,
      country: profile?.country || updatedAgency.country,

      // Profile data
      founded_year: profile?.founded_year,
      employee_count: profile?.employee_count,
      address_line1: profile?.address_line1,
      address_line2: profile?.address_line2,
      state: profile?.state,
      postal_code: profile?.postal_code,
      linkedin_url: profile?.linkedin_url,
      facebook_url: profile?.facebook_url,
      twitter_url: profile?.twitter_url,
      settings: profile?.settings || {},
      branding: profile?.branding || {},
    };

    return NextResponse.json({
      message: 'Agency updated successfully',
      agency: formattedAgency
    });

  } catch (error) {
    console.error('Error updating agency:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

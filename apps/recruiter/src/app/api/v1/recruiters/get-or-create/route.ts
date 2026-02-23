import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { validateApiKey } from '../../../v1/auth';
import { handleCorsOptions, withCors } from '../../../v1/cors';
import { transformToApi, transformFromApi } from '@/lib/api/transform';
import crypto from 'crypto';

/**
 * OPTIONS - CORS preflight
 */
export async function OPTIONS() {
  return handleCorsOptions();
}

/**
 * POST /api/v1/recruiters/get-or-create
 *
 * Find existing recruiter or create new one for the agency.
 * Returns the BPOC recruiter ID that the agency portal should store.
 *
 * Body:
 *   email: string (required)
 *   first_name: string (required)
 *   last_name: string (required)
 *   phone: string (optional)
 *   position: string (optional)
 *   linkedin_url: string (optional)
 */
export async function POST(request: NextRequest) {
  const auth = await validateApiKey(request);
  if ('error' in auth) {
    return withCors(NextResponse.json({ error: auth.error }, { status: auth.status }));
  }

  try {
    const body = await request.json();
    const input = transformFromApi(body);
    const {
      email,
      first_name,
      last_name,
      phone,
      position,
      linkedin_url,
    } = input;

    if (!email || !first_name || !last_name) {
      return withCors(
        NextResponse.json(
          { error: 'Missing required fields: email, first_name, last_name' },
          { status: 400 }
        )
      );
    }

    // Check if recruiter with this email already exists for this agency
    const { data: existing } = await supabaseAdmin
      .from('agency_recruiters')
      .select('id, email, first_name, last_name, role, user_id')
      .eq('agency_id', auth.agency_id)
      .eq('email', email.toLowerCase())
      .single();

    if (existing) {
      console.log('✅ Found existing recruiter:', {
        recruiter_id: existing.id,
        email: existing.email,
        name: `${existing.first_name} ${existing.last_name}`,
      });

      const response = {
        recruiter_id: existing.id,
        user_id: existing.user_id,
        email: existing.email,
        name: `${existing.first_name} ${existing.last_name}`,
        role: existing.role,
        created: false,
        message: 'Existing recruiter found',
      };
      return withCors(NextResponse.json(transformToApi(response)));
    }

    console.log('➕ Creating new recruiter for agency:', auth.agency_id, email);

    // Create auth user with random password (they'll use magic link)
    const randomPassword = crypto.randomBytes(24).toString('hex');
    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email: email.toLowerCase(),
      password: randomPassword,
      email_confirm: true,
      user_metadata: {
        first_name,
        last_name,
        full_name: `${first_name} ${last_name}`,
        role: 'recruiter',
        admin_level: 'recruiter',
      },
    });

    if (authError) {
      // If user already exists in auth but not in agency_recruiters, find them
      if (authError.message?.includes('already been registered')) {
        const { data: { users } } = await supabaseAdmin.auth.admin.listUsers();
        const existingUser = users?.find(
          (u: any) => u.email?.toLowerCase() === email.toLowerCase()
        );

        if (existingUser) {
          // Create recruiter record linked to existing auth user
          const { data: newRecruiter, error: recError } = await supabaseAdmin
            .from('agency_recruiters')
            .insert({
              user_id: existingUser.id,
              agency_id: auth.agency_id,
              email: email.toLowerCase(),
              first_name,
              last_name,
              full_name: `${first_name} ${last_name}`,
              phone: phone || null,
              position: position || null,
              linkedin_url: linkedin_url || null,
              role: 'recruiter',
              is_active: true,
              can_post_jobs: true,
              can_manage_applications: true,
              can_invite_recruiters: false,
              can_manage_clients: false,
              joined_at: new Date().toISOString(),
              verification_status: 'verified',
              profile_completion_percentage: 80,
            })
            .select()
            .single();

          if (recError) {
            console.error('Failed to create recruiter record:', recError);
            return withCors(
              NextResponse.json(
                { error: 'Failed to create recruiter', details: recError.message },
                { status: 500 }
              )
            );
          }

          const response = {
            recruiter_id: newRecruiter.id,
            user_id: existingUser.id,
            email: email.toLowerCase(),
            name: `${first_name} ${last_name}`,
            role: 'recruiter',
            created: true,
            message: 'Recruiter created (linked to existing auth user)',
          };
          return withCors(NextResponse.json(transformToApi(response), { status: 201 }));
        }
      }

      console.error('Auth user creation failed:', authError);
      return withCors(
        NextResponse.json(
          { error: 'Failed to create user', details: authError.message },
          { status: 500 }
        )
      );
    }

    if (!authData.user) {
      return withCors(
        NextResponse.json({ error: 'Failed to create auth user' }, { status: 500 })
      );
    }

    // Create agency_recruiters record
    const { data: newRecruiter, error: recruiterError } = await supabaseAdmin
      .from('agency_recruiters')
      .insert({
        user_id: authData.user.id,
        agency_id: auth.agency_id,
        email: email.toLowerCase(),
        first_name,
        last_name,
        full_name: `${first_name} ${last_name}`,
        phone: phone || null,
        position: position || null,
        linkedin_url: linkedin_url || null,
        role: 'recruiter',
        is_active: true,
        can_post_jobs: true,
        can_manage_applications: true,
        can_invite_recruiters: false,
        can_manage_clients: false,
        joined_at: new Date().toISOString(),
        verification_status: 'verified',
        profile_completion_percentage: 80,
      })
      .select()
      .single();

    if (recruiterError) {
      console.error('Failed to create recruiter:', recruiterError);
      // Cleanup auth user
      await supabaseAdmin.auth.admin.deleteUser(authData.user.id);
      return withCors(
        NextResponse.json(
          { error: 'Failed to create recruiter', details: recruiterError.message },
          { status: 500 }
        )
      );
    }

    console.log('✅ New recruiter created:', {
      recruiter_id: newRecruiter.id,
      user_id: authData.user.id,
      email: email.toLowerCase(),
      name: `${first_name} ${last_name}`,
    });

    const response = {
      recruiter_id: newRecruiter.id,
      user_id: authData.user.id,
      email: email.toLowerCase(),
      name: `${first_name} ${last_name}`,
      role: 'recruiter',
      created: true,
      message: 'New recruiter created successfully',
    };
    return withCors(NextResponse.json(transformToApi(response), { status: 201 }));
  } catch (error) {
    console.error('API v1 recruiters/get-or-create error:', error);
    return withCors(
      NextResponse.json({ error: 'Internal server error' }, { status: 500 })
    );
  }
}

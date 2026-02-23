import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { sendTeamInvitationEmail } from '@/lib/email';
import crypto from 'crypto';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const email = body.email;
    const password = body.password;
    // Accept both camelCase and snake_case field names
    const firstName = body.firstName || body.first_name;
    const lastName = body.lastName || body.last_name;
    const agencyName = body.agencyName || body.agency_name;
    const inviteToken = body.inviteToken || body.invite_token;
    const isAuthorized = body.isAuthorized ?? body.is_authorized ?? true;
    const authorizedPersonFirstName = body.authorizedPersonFirstName || body.authorized_person_first_name || '';
    const authorizedPersonLastName = body.authorizedPersonLastName || body.authorized_person_last_name || '';
    const authorizedPersonEmail = body.authorizedPersonEmail || body.authorized_person_email || '';

    if (!email || !password || !firstName || !lastName) {
      return NextResponse.json({ error: 'All fields are required' }, { status: 400 });
    }

    // Validate authorized person details if not authorized
    if (isAuthorized === false) {
      if (!authorizedPersonFirstName || !authorizedPersonLastName || !authorizedPersonEmail) {
        return NextResponse.json({
          error: 'Authorized person details are required when you are not the recruitment head'
        }, { status: 400 });
      }
    }

    // Check if this signup is from a team invitation
    let invitation: any = null;
    let invitedAgencyId: string | null = null;
    let invitedRole: string = 'admin';

    if (inviteToken) {
      // Validate the invitation
      const { data: inv, error: invError } = await supabaseAdmin
        .from('team_invitations')
        .select('*, agencies(name)')
        .eq('invite_token', inviteToken)
        .eq('status', 'pending')
        .single();

      if (invError || !inv) {
        return NextResponse.json({ error: 'Invalid or expired invitation' }, { status: 400 });
      }

      // Check if invitation has expired
      if (new Date(inv.expires_at) < new Date()) {
        await supabaseAdmin
          .from('team_invitations')
          .update({ status: 'expired' })
          .eq('id', inv.id);
        return NextResponse.json({ error: 'This invitation has expired' }, { status: 400 });
      }

      // Verify email matches invitation
      if (inv.invitee_email.toLowerCase() !== email.toLowerCase()) {
        return NextResponse.json({ 
          error: 'Email does not match invitation. Please use the invited email address.' 
        }, { status: 400 });
      }

      invitation = inv;
      invitedAgencyId = inv.agency_id;
      invitedRole = inv.role || 'recruiter';

      console.log('📨 Signup with team invitation:', {
        email,
        agency_id: invitedAgencyId,
        agencyName: (inv.agencies as any)?.name,
        role: invitedRole,
      });
    }

    // 1. Create user in Supabase Auth
    // IMPORTANT: Set both admin_level and role to 'recruiter' to prevent
    // the user from being added to the candidates table during auth sync
    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: {
        first_name: firstName,
        last_name: lastName,
        full_name: `${firstName} ${lastName}`,
        role: 'recruiter',
        admin_level: 'recruiter', // This prevents candidate creation in user-sync
      },
    });

    if (authError) {
      console.error('Supabase Auth Error:', authError);
      return NextResponse.json({ error: authError.message }, { status: 400 });
    }

    if (!authData.user) {
      return NextResponse.json({ error: 'Failed to create auth user' }, { status: 500 });
    }

    const userId = authData.user.id;

    // 2. Determine agency - use invited agency or create/find one
    let agencyId: string;
    let isNewAgency = false;
    
    if (invitedAgencyId) {
      // Use the agency from the invitation
      agencyId = invitedAgencyId;
      console.log('✅ Using invited agency:', agencyId);
    } else if (agencyName) {
      // Check if agency exists
      const { data: existingAgency } = await supabaseAdmin
        .from('agencies')
        .select('id')
        .eq('name', agencyName)
        .single();

      if (existingAgency) {
        agencyId = existingAgency.id;
      } else {
        // Create new agency
        const slug = agencyName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
        const { data: newAgency, error: agencyError } = await supabaseAdmin
          .from('agencies')
          .insert({
            name: agencyName,
            slug: slug,
            is_active: true,
          })
          .select()
          .single();

        if (agencyError) {
          console.error('Agency creation error:', agencyError);
          // Cleanup: delete auth user
          await supabaseAdmin.auth.admin.deleteUser(userId);
          return NextResponse.json({ error: 'Failed to create agency' }, { status: 500 });
        }
        agencyId = newAgency.id;
        isNewAgency = true;

        // Create agency profile
        await supabaseAdmin
          .from('agency_profiles')
          .insert({
            agency_id: agencyId,
            about: '',
            specializations: [],
            company_size: 'small',
          });
      }
    } else {
      // Create placeholder agency for this recruiter
      const slug = `${firstName.toLowerCase()}-${lastName.toLowerCase()}-agency-${Date.now()}`;
      const { data: newAgency, error: agencyError } = await supabaseAdmin
        .from('agencies')
        .insert({
          name: `${firstName} ${lastName}'s Agency`,
          slug: slug,
          is_active: true,
        })
        .select()
        .single();

      if (agencyError) {
        await supabaseAdmin.auth.admin.deleteUser(userId);
        return NextResponse.json({ error: 'Failed to create agency' }, { status: 500 });
      }
      agencyId = newAgency.id;
      isNewAgency = true;
    }

    // 3. Create agency_recruiters record
    // Determine role and verification status based on authorization
    let recruiterRole: string;
    let verificationStatus: string;
    let canInvite: boolean;
    let canManageClients: boolean;

    if (invitedAgencyId) {
      // Coming from invitation - use invited role
      recruiterRole = invitedRole;
      verificationStatus = invitedRole === 'admin' ? 'pending_documents' : 'pending_authorization_head';
      canInvite = invitedRole === 'admin';
      canManageClients = invitedRole === 'admin';
    } else if (isAuthorized) {
      // User claims to be authorized - they need to upload documents
      recruiterRole = 'admin';
      verificationStatus = 'pending_documents';
      canInvite = true;
      canManageClients = true;
    } else {
      // User is not authorized - they're waiting for auth head
      recruiterRole = 'recruiter';
      verificationStatus = 'pending_authorization_head';
      canInvite = false;
      canManageClients = false;
    }

    const { data: recruiterData, error: recruiterError } = await supabaseAdmin
      .from('agency_recruiters')
      .insert({
        user_id: userId,
        agency_id: agencyId,
        email: email,
        first_name: firstName,
        last_name: lastName,
        role: recruiterRole,
        is_active: true,
        can_post_jobs: true,
        can_manage_applications: true,
        can_invite_recruiters: canInvite,
        can_manage_clients: canManageClients,
        joined_at: new Date().toISOString(),
        verification_status: verificationStatus,
        profile_completion_percentage: isAuthorized ? 50 : 25,
      })
      .select()
      .single();

    if (recruiterError) {
      console.error('Recruiter creation error:', recruiterError);
      await supabaseAdmin.auth.admin.deleteUser(userId);
      return NextResponse.json({ error: 'Failed to create recruiter profile', details: recruiterError.message }, { status: 500 });
    }

    // 4. Mark invitation as accepted (if applicable)
    if (invitation) {
      await supabaseAdmin
        .from('team_invitations')
        .update({
          status: 'accepted',
          accepted_at: new Date().toISOString()
        })
        .eq('id', invitation.id);

      console.log('✅ Invitation accepted:', invitation.id);
    }

    // 5. If user is not authorized, send invitation to authorization head
    let authorizationHeadInvited = false;
    if (!isAuthorized && !invitedAgencyId) {
      try {
        // Generate secure token for invitation
        const token = `inv_${Date.now()}_${crypto.randomBytes(16).toString('hex')}`;
        // ALWAYS use production URL for invite links - NEVER localhost!
        const inviteLink = `https://www.bpoc.io/recruiter/signup?invite=${token}`;

        // Get the full agency name for the invitation
        const { data: agencyData } = await supabaseAdmin
          .from('agencies')
          .select('name')
          .eq('id', agencyId)
          .single();

        const fullAgencyName = agencyData?.name || agencyName || `${firstName} ${lastName}'s Agency`;

        // Create invitation record
        const { data: invitationData, error: invitationError } = await supabaseAdmin
          .from('team_invitations')
          .insert({
            agency_id: agencyId,
            inviter_id: userId,
            inviter_email: email,
            inviter_name: `${firstName} ${lastName}`,
            invitee_email: authorizedPersonEmail,
            invitee_name: `${authorizedPersonFirstName} ${authorizedPersonLastName}`,
            role: 'admin',
            invite_token: token,
            status: 'pending',
            expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(), // 7 days
          })
          .select()
          .single();

        if (invitationError) {
          console.error('❌ Failed to create invitation:', JSON.stringify(invitationError, null, 2));
          console.error('Invitation data attempted:', {
            authorizedPersonEmail,
            authorizedPersonFirstName,
            authorizedPersonLastName,
            agencyId,
          });
        } else {
          console.log('✅ Invitation record created successfully:', invitationData.id);
          // Update recruiter record with invited_by reference (they invited the auth head, so we'll update this later)
          // For now, just send the email

          // Send invitation email
          console.log('📧 Sending invitation email to:', authorizedPersonEmail);
          await sendTeamInvitationEmail(
            authorizedPersonEmail,
            `${firstName} ${lastName}`,
            fullAgencyName,
            token,
            inviteLink
          );

          authorizationHeadInvited = true;
          console.log('✅ Authorization head invitation email sent successfully:', {
            to: authorizedPersonEmail,
            name: `${authorizedPersonFirstName} ${authorizedPersonLastName}`,
            inviteLink,
          });
        }
      } catch (error) {
        console.error('❌ Error in authorization head invitation flow:', error);
        console.error('Error details:', JSON.stringify(error, null, 2));
        // Don't fail the signup, just log the error
      }
    }

    return NextResponse.json({
      message: authorizationHeadInvited
        ? 'Account created. Authorization head invitation sent.'
        : 'Recruiter account created successfully',
      userId,
      agencyId: agencyId,
      role: recruiterRole,
      joinedViaInvite: !!invitation,
      verificationStatus,
      requiresDocuments: (isAuthorized && !invitedAgencyId) || (invitedAgencyId && invitedRole === 'admin'),
      awaitingAuthorizationHead: (!isAuthorized && !invitedAgencyId) || (invitedAgencyId && invitedRole === 'recruiter'),
    }, { status: 201 });

  } catch (error) {
    console.error('Recruiter Signup API Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}


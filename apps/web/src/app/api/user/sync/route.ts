import { NextRequest, NextResponse } from 'next/server'
import { createCandidate, updateCandidate, getCandidateById } from '@/lib/db/candidates'
import { createProfile, updateProfile, getProfileByCandidate } from '@/lib/db/profiles'
import { supabaseAdmin } from '@/lib/supabase/admin'

// Test endpoint to verify the route is working
export async function GET() {
  return NextResponse.json({
    message: 'User sync API is working',
    methods: ['GET', 'POST'],
    timestamp: new Date().toISOString()
  })
}

export async function POST(request: NextRequest) {
  console.log('🚀 POST /api/user/sync called')

  let userData: any = null

  try {
    // Check Supabase environment variables
    if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
      console.error('❌ Missing Supabase environment variables')
      return NextResponse.json({
        error: 'Supabase configuration error',
        details: 'NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY not set'
      }, { status: 500 })
    }

    userData = await request.json()

    console.log('📥 Received user sync request:', {
      id: userData.id,
      email: userData.email,
      first_name: userData.first_name,
      last_name: userData.last_name,
    })

    // Validate required fields
    if (!userData.id || !userData.email) {
      console.error('❌ [sync] Missing required fields:', { id: userData.id, email: userData.email })
      return NextResponse.json({
        error: 'Missing required fields: id and email'
      }, { status: 400 })
    }

    // CRITICAL: Verify user exists in auth.users before creating candidate
    console.log('🔍 [sync] Verifying user exists in auth.users:', userData.id)
    const { data: authUser, error: authError } = await supabaseAdmin.auth.admin.getUserById(userData.id)

    if (authError || !authUser?.user) {
      console.error('❌ [sync] User NOT found in auth.users:', {
        error: authError?.message,
        user_id: userData.id,
      })
      return NextResponse.json({
        error: 'User authentication verification failed',
        details: `User ${userData.id} not found in auth.users`,
        code: 'AUTH_USER_NOT_FOUND',
      }, { status: 400 })
    }

    console.log('✅ [sync] User verified in auth.users:', authUser.user.id)

    // Skip internal BPOC users (admins, recruiters)
    const computedAdminLevel = userData.admin_level || authUser.user?.user_metadata?.admin_level || authUser.user?.user_metadata?.role || 'user'
    if (computedAdminLevel === 'recruiter' || computedAdminLevel === 'admin' || computedAdminLevel === 'super_admin') {
      console.log('⏭️ [sync] Skipping candidate sync for internal user:', {
        user_id: userData.id,
        admin_level: computedAdminLevel,
      })
      return NextResponse.json({
        success: true,
        action: 'skipped',
        reason: 'bpoc_internal_user'
      })
    }

    // Check if candidate exists
    console.log('🔍 [sync] Checking if candidate exists:', userData.id)
    let existingCandidate
    try {
      existingCandidate = await getCandidateById(userData.id, true) // Use admin to bypass RLS
      console.log('🔍 [sync] Candidate lookup result:', existingCandidate ? 'EXISTS' : 'NOT FOUND')
    } catch (lookupError) {
      console.error('❌ [sync] Error checking candidate existence:', lookupError)
      // If not found, existingCandidate will be null/undefined, that's fine
    }

    let result
    if (existingCandidate) {
      // Update existing candidate - only update if incoming has data
      console.log('👤 [sync] Candidate EXISTS - updating...')
      const candidateUpdateData: any = {}

      if (userData.first_name && userData.first_name.trim() && !existingCandidate.first_name) {
        candidateUpdateData.first_name = userData.first_name
      }
      if (userData.last_name && userData.last_name.trim() && !existingCandidate.last_name) {
        candidateUpdateData.last_name = userData.last_name
      }
      if (userData.phone && userData.phone.trim() && !existingCandidate.phone) {
        candidateUpdateData.phone = userData.phone
      }
      if (userData.avatar_url && !existingCandidate.avatar_url) {
        candidateUpdateData.avatar_url = userData.avatar_url
      }

      let updated = existingCandidate
      if (Object.keys(candidateUpdateData).length > 0) {
        console.log('📝 [sync] Updating candidate with:', candidateUpdateData)
        updated = await updateCandidate(userData.id, candidateUpdateData, true)
        console.log('✅ [sync] Candidate updated successfully')
      }

      // Update or create profile
      const existingProfile = await getProfileByCandidate(userData.id, true)
      if (existingProfile) {
        console.log('👤 [sync] Profile EXISTS')
        const profileUpdateData: any = {}
        if (userData.bio && userData.bio.trim() && !existingProfile.bio) {
          profileUpdateData.bio = userData.bio
        }
        if (userData.position && userData.position.trim() && !existingProfile.position) {
          profileUpdateData.position = userData.position
        }
        if (userData.location && userData.location.trim() && !existingProfile.location) {
          profileUpdateData.location = userData.location
        }
        if (Object.keys(profileUpdateData).length > 0) {
          await updateProfile(userData.id, profileUpdateData, true)
          console.log('✅ [sync] Profile updated')
        }
      } else {
        console.log('➕ [sync] Creating profile...')
        await createProfile(userData.id, {
          bio: userData.bio || null,
          position: userData.position || null,
          location: userData.location || null,
          birthday: userData.birthday || null,
          gender: userData.gender as any || null,
          profile_completed: userData.completed_data ?? false,
        })
        console.log('✅ [sync] Profile created')
      }

      result = { success: true, action: 'updated', user: updated }
    } else {
      // Create new candidate
      console.log('➕ [sync] Creating new candidate...')
      const newCandidate = await createCandidate({
        id: userData.id,
        email: userData.email,
        first_name: userData.first_name || '',
        last_name: userData.last_name || '',
        phone: userData.phone || null,
        avatar_url: userData.avatar_url || null,
      })
      console.log('✅ [sync] Candidate created:', newCandidate.id)

      // Create profile
      console.log('➕ [sync] Creating profile...')
      await createProfile(userData.id, {
        bio: userData.bio || null,
        position: userData.position || null,
        location: userData.location || null,
        birthday: userData.birthday || null,
        gender: userData.gender as any || null,
        profile_completed: userData.completed_data ?? false,
      })
      console.log('✅ [sync] Profile created')

      result = { success: true, action: 'created', user: newCandidate }
    }

    console.log('✅ [sync] User sync completed:', result.action)
    return NextResponse.json(result)
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    console.error('❌ [sync] Error:', errorMessage)
    
    if (error instanceof Error) {
      const errorLower = error.message.toLowerCase()
      if (errorLower.includes('duplicate key') || errorLower.includes('unique constraint')) {
        return NextResponse.json({
          error: 'User already exists',
          code: 'DUPLICATE_USER_ERROR',
        }, { status: 409 })
      }
      if (errorLower.includes('foreign key') || errorLower.includes('constraint')) {
        return NextResponse.json({
          error: 'Database constraint violation',
          details: error.message,
          code: 'DB_CONSTRAINT_ERROR',
        }, { status: 400 })
      }
    }

    return NextResponse.json({
      error: 'Internal server error',
      details: errorMessage,
    }, { status: 500 })
  }
}

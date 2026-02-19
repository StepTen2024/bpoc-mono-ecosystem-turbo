import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

// GET /api/notifications - Fetch notifications for current user
export async function GET(request: NextRequest) {
  try {
    const userId = request.headers.get('x-user-id');
    const userRole = request.headers.get('x-user-role') || 'candidate';
    const agencyId = request.headers.get('x-agency-id');
    
    if (!userId) {
      return NextResponse.json({ error: 'User ID required' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const unreadOnly = searchParams.get('unread') === 'true';
    const limit = parseInt(searchParams.get('limit') || '50');
    const offset = parseInt(searchParams.get('offset') || '0');

    // Build query to fetch:
    // 1. Notifications specifically for this user
    // 2. Broadcast notifications for this role
    // 3. Agency-scoped notifications (for recruiters)
    let query = supabase
      .from('notifications')
      .select('*')
      .or(`user_id.eq.${userId},and(user_id.is.null,or(target_role.is.null,target_role.eq.${userRole}))`)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    // Filter by unread if requested
    if (unreadOnly) {
      query = query.eq('is_read', false);
    }

    // Filter by agency for recruiters
    if (userRole === 'recruiter' && agencyId) {
      query = query.or(`agency_id.is.null,agency_id.eq.${agencyId}`);
    }

    // Exclude expired notifications
    query = query.or(`expires_at.is.null,expires_at.gt.${new Date().toISOString()}`);

    const { data: notifications, error, count } = await query;

    if (error) {
      console.error('Failed to fetch notifications:', error);
      return NextResponse.json({ error: 'Failed to fetch notifications' }, { status: 500 });
    }

    // Get unread count
    const { count: unreadCount } = await supabase
      .from('notifications')
      .select('*', { count: 'exact', head: true })
      .or(`user_id.eq.${userId},and(user_id.is.null,or(target_role.is.null,target_role.eq.${userRole}))`)
      .eq('is_read', false)
      .or(`expires_at.is.null,expires_at.gt.${new Date().toISOString()}`);

    return NextResponse.json({
      notifications: notifications || [],
      unreadCount: unreadCount || 0,
      total: count || 0,
    });
  } catch (error) {
    console.error('Notifications GET error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// POST /api/notifications - Create a new notification
export async function POST(request: NextRequest) {
  try {
    const userId = request.headers.get('x-user-id');
    const userRole = request.headers.get('x-user-role');
    
    // Only admins and recruiters can create notifications
    if (!userId || !['admin', 'recruiter'].includes(userRole || '')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    const body = await request.json();
    const {
      targetUserId,
      targetRole,
      agencyId,
      type,
      title,
      message,
      actionUrl,
      metadata,
      expiresAt,
    } = body;

    if (!type || !title || !message) {
      return NextResponse.json(
        { error: 'Type, title, and message are required' },
        { status: 400 }
      );
    }

    const { data: notification, error } = await supabase
      .from('notifications')
      .insert({
        user_id: targetUserId || null,
        target_role: targetRole || null,
        agency_id: agencyId || null,
        type,
        title,
        message,
        action_url: actionUrl || null,
        metadata: metadata || {},
        expires_at: expiresAt || null,
      })
      .select()
      .single();

    if (error) {
      console.error('Failed to create notification:', error);
      return NextResponse.json({ error: 'Failed to create notification' }, { status: 500 });
    }

    return NextResponse.json({ notification }, { status: 201 });
  } catch (error) {
    console.error('Notifications POST error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

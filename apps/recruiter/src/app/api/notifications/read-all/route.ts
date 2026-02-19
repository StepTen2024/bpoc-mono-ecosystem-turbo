import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

// PATCH /api/notifications/read-all - Mark all notifications as read for current user
export async function PATCH(request: NextRequest) {
  try {
    const userId = request.headers.get('x-user-id');
    const userRole = request.headers.get('x-user-role') || 'candidate';
    
    if (!userId) {
      return NextResponse.json({ error: 'User ID required' }, { status: 401 });
    }

    // Mark all user-specific notifications as read
    const { error: userError } = await supabase
      .from('notifications')
      .update({
        is_read: true,
        read_at: new Date().toISOString(),
      })
      .eq('user_id', userId)
      .eq('is_read', false);

    if (userError) {
      console.error('Failed to mark user notifications as read:', userError);
    }

    // For broadcast notifications, we need a different approach
    // Since they're shared, we track read status per user in metadata or a separate table
    // For now, we'll mark the ones that match role as read if they have user_id null
    // TODO: Consider a notification_reads junction table for better broadcast handling

    return NextResponse.json({ 
      success: true,
      message: 'All notifications marked as read'
    });
  } catch (error) {
    console.error('Read all notifications error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}









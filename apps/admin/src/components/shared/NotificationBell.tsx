'use client';

import React, { useState, useEffect } from 'react';
import { Bell, X, Check, Clock, ExternalLink } from 'lucide-react';
import { Button } from '@/components/shared/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from '@/components/shared/ui/dropdown-menu';
import { Badge } from '@/components/shared/ui/badge';
import { useAuth } from '@/contexts/AuthContext';
import Link from 'next/link';
import { formatDistanceToNow } from 'date-fns';
import { toast } from '@/components/shared/ui/toast';
import { usePathname } from 'next/navigation';

interface Notification {
  id: string;
  type: string;
  title: string;
  message: string;
  actionUrl?: string;
  actionLabel?: string;
  metadata?: any;
  isRead: boolean;
  isUrgent: boolean;
  createdAt: string;
}

export function NotificationBell() {
  const { session } = useAuth();
  const pathname = usePathname();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [isOpen, setIsOpen] = useState(false);

  // Admin app always uses /api/notifications directly
  const apiBase = `/api/notifications`;

  const fetchNotifications = async () => {
    if (!session?.access_token) return;

    setLoading(true);
    try {
      const response = await fetch(apiBase, {
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
        },
      });

      const data = await response.json();

      if (response.ok) {
        setNotifications(data.notifications || []);
        setUnreadCount(data.unreadCount || 0);
      }
    } catch (error) {
      console.error('Failed to fetch notifications:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchNotifications();

    // Poll every 30 seconds
    const interval = setInterval(fetchNotifications, 30000);
    return () => clearInterval(interval);
  }, [session]);

  const markAsRead = async (notificationId: string) => {
    if (!session?.access_token) return;

    try {
      await fetch(apiBase, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ notificationId }),
      });

      setNotifications(prev =>
        prev.map(n => n.id === notificationId ? { ...n, isRead: true } : n)
      );
      setUnreadCount(prev => Math.max(0, prev - 1));
    } catch (error) {
      console.error('Failed to mark notification as read:', error);
    }
  };

  const markAllAsRead = async () => {
    if (!session?.access_token) return;

    try {
      await fetch(apiBase, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ markAllRead: true }),
      });

      setNotifications(prev => prev.map(n => ({ ...n, isRead: true })));
      setUnreadCount(0);
    } catch (error) {
      console.error('Failed to mark all as read:', error);
    }
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'incoming_call':
      case 'interview_reminder':
        return <Clock className="h-4 w-4" />;
      default:
        return <Bell className="h-4 w-4" />;
    }
  };

  const handleInviteAction = async (notification: Notification, action: 'accept' | 'decline') => {
    if (!session?.access_token) return;
    const applicationId = notification?.metadata?.applicationId as string | undefined;
    if (!applicationId) {
      toast.error('Missing invite details');
      return;
    }

    try {
      const url =
        action === 'accept'
          ? `/api/candidate/applications/${applicationId}/accept-invite`
          : `/api/candidate/applications/${applicationId}/decline-invite`;

      const res = await fetch(url, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data?.error || 'Action failed');
        return;
      }

      toast.success(action === 'accept' ? 'Invite accepted' : 'Invite declined');
      await markAsRead(notification.id);
      await fetchNotifications();
    } catch (e) {
      console.error('Invite action failed:', e);
      toast.error('Action failed');
    }
  };

  return (
    <DropdownMenu open={isOpen} onOpenChange={setIsOpen}>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="relative hover:bg-white/10 text-gray-300"
        >
          <Bell className="h-5 w-5" />
          {unreadCount > 0 && (
            <Badge
              className="absolute -top-1 -right-1 h-5 w-5 flex items-center justify-center p-0 bg-orange-600 border-none text-white text-xs"
            >
              {unreadCount > 9 ? '9+' : unreadCount}
            </Badge>
          )}
        </Button>
      </DropdownMenuTrigger>

      <DropdownMenuContent
        align="end"
        className="w-[380px] bg-[#0F1419] border-white/10 p-0"
      >
        {/* Header */}
        <div className="p-4 border-b border-white/10 flex items-center justify-between">
          <h3 className="font-semibold text-white">Notifications</h3>
          {unreadCount > 0 && (
            <Button
              onClick={markAllAsRead}
              variant="ghost"
              size="sm"
              className="text-orange-500 hover:text-orange-400 hover:bg-orange-500/10 h-auto p-1"
            >
              <Check className="h-4 w-4 mr-1" />
              Mark all read
            </Button>
          )}
        </div>

        {/* Notifications List */}
        <div className="max-h-[400px] overflow-y-auto">
          {loading ? (
            <div className="p-8 text-center text-gray-400">
              Loading...
            </div>
          ) : notifications.length === 0 ? (
            <div className="p-8 text-center text-gray-400">
              <Bell className="h-12 w-12 mx-auto mb-3 opacity-30" />
              <p>No notifications</p>
            </div>
          ) : (
            <div className="divide-y divide-white/5">
              {notifications.slice(0, 10).map((notification) => (
                <div
                  key={notification.id}
                  className={`p-4 hover:bg-white/5 transition-colors cursor-pointer ${
                    !notification.isRead ? 'bg-orange-500/5' : ''
                  }`}
                  onClick={() => !notification.isRead && markAsRead(notification.id)}
                >
                  <div className="flex gap-3">
                    {/* Icon */}
                    <div className={`mt-1 ${notification.isUrgent ? 'text-red-400' : 'text-gray-400'}`}>
                      {getTypeIcon(notification.type)}
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <h4 className={`font-medium text-sm ${!notification.isRead ? 'text-white' : 'text-gray-300'}`}>
                          {notification.title}
                        </h4>
                        {!notification.isRead && (
                          <div className="h-2 w-2 rounded-full bg-orange-500 flex-shrink-0 mt-1" />
                        )}
                      </div>

                      <p className="text-sm text-gray-400 mt-1 line-clamp-2">
                        {notification.message}
                      </p>

                      {notification.type === 'job_invite' && notification?.metadata?.applicationId && (
                        <div className="flex items-center gap-2 mt-3">
                          <Button
                            size="sm"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleInviteAction(notification, 'accept');
                            }}
                            className="bg-indigo-500/20 text-indigo-300 hover:bg-indigo-500/30 border border-indigo-500/30 h-8"
                          >
                            Accept
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleInviteAction(notification, 'decline');
                            }}
                            className="text-red-300 hover:text-red-200 hover:bg-red-500/10 h-8"
                          >
                            Decline
                          </Button>
                        </div>
                      )}

                      <div className="flex items-center justify-between mt-2">
                        <span className="text-xs text-gray-500">
                          {formatDistanceToNow(new Date(notification.createdAt), { addSuffix: true })}
                        </span>

                        {notification.actionUrl && (
                          <Link
                            href={notification.actionUrl}
                            onClick={(e) => e.stopPropagation()}
                            className="text-xs text-orange-500 hover:text-orange-400 flex items-center gap-1"
                          >
                            {notification.actionLabel || 'View'}
                            <ExternalLink className="h-3 w-3" />
                          </Link>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        {notifications.length > 0 && (
          <div className="p-3 border-t border-white/10 text-center">
            <Link
              href={`/${roleBase}/notifications`}
              className="text-sm text-orange-500 hover:text-orange-400"
            >
              View all notifications
            </Link>
          </div>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

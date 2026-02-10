'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import {
  LayoutDashboard,
  User,
  Building2,
  Briefcase,
  Users,
  FileText,
  Calendar,
  Gift,
  Settings,
  Key,
  LogOut,
  Search,
  Trophy,
  Video,
  Kanban,
  Bell,
  ChevronLeft,
  ChevronRight,
  X,
  FileCheck,
} from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/shared/ui/avatar';
import { Badge } from '@/components/shared/ui/badge';

interface NavItem {
  name: string;
  href: string;
  icon: React.ElementType;
  badgeKey?: string; // Key to check for notification count
  highlight?: boolean; // Highlight special items
}

const mainNavItems: NavItem[] = [
  { name: 'Dashboard', href: '/', icon: LayoutDashboard },
  { name: 'Clients', href: '/clients', icon: Building2 },
  { name: 'Talent Pool', href: '/talent', icon: Search },
  { name: 'Jobs', href: '/jobs', icon: Briefcase },
  { name: 'Applications', href: '/applications', icon: FileText, badgeKey: 'newApplications' },
  { name: 'Pipeline', href: '/pipeline', icon: Kanban },
  { name: 'Interviews', href: '/interviews', icon: Calendar, badgeKey: 'pendingInterviews' },
  { name: 'Recordings', href: '/interviews/recordings', icon: Video },
  { name: 'Offers', href: '/offers', icon: Gift, badgeKey: 'pendingOffers' },
  { name: 'Onboarding', href: '/onboarding', icon: FileCheck, badgeKey: 'pendingOnboarding', highlight: true },
  { name: 'Placements', href: '/placements', icon: Trophy },
  { name: 'Labor Law Compliance', href: '/hr-assistant', icon: FileCheck },
  { name: 'Notifications', href: '/notifications', icon: Bell, badgeKey: 'unreadNotifications' },
];

const settingsNavItems: NavItem[] = [
  { name: 'Profile', href: '/profile', icon: User },
  { name: 'Agency', href: '/agency', icon: Building2 },
  { name: 'Team', href: '/team', icon: Users },
  { name: 'API Keys', href: '/settings/api', icon: Key },
  { name: 'Settings', href: '/settings', icon: Settings },
];

interface NotificationBadges {
  newApplications: number;
  pendingInterviews: number;
  pendingOffers: number;
  unreadNotifications: number;
}

interface RecruiterSidebarProps {
  recruiter?: {
    first_name: string;
    last_name: string;
    email: string;
    id?: string;
    agency_id?: string;
    agency?: {
      name: string;
      logo_url?: string;
    };
  };
  onSignOut?: () => void;
  collapsed?: boolean;
  onToggleCollapse?: () => void;
  mobileOpen?: boolean;
  onMobileClose?: () => void;
}

export default function RecruiterSidebar({ 
  recruiter, 
  onSignOut, 
  collapsed = false,
  onToggleCollapse,
  mobileOpen = false,
  onMobileClose,
}: RecruiterSidebarProps) {
  const pathname = usePathname();
  const [badges, setBadges] = useState<NotificationBadges>({
    newApplications: 0,
    pendingInterviews: 0,
    pendingOffers: 0,
    unreadNotifications: 0,
  });
  const [showNotifications, setShowNotifications] = useState(false);

  // Fetch notification badges
  useEffect(() => {
    const fetchBadges = async () => {
      if (!recruiter?.id) return;
      
      try {
        // Fetch from dashboard stats for real counts
        const response = await fetch('/api/recruiter/dashboard/stats', {
          headers: {
            'x-user-id': recruiter.id,
            'x-agency-id': recruiter.agency_id || '',
          },
        });
        
        if (response.ok) {
          const data = await response.json();
          setBadges({
            newApplications: data.stats?.newApplicationsToday || 0,
            pendingInterviews: data.stats?.scheduledInterviews || 0,
            pendingOffers: data.stats?.pendingOffers || 0,
            unreadNotifications: 0, // Will be fetched separately
          });
        }
      } catch (error) {
        console.error('Failed to fetch badges:', error);
      }
    };

    fetchBadges();
    // Refresh every 30 seconds
    const interval = setInterval(fetchBadges, 30000);
    return () => clearInterval(interval);
  }, [recruiter?.id, recruiter?.agency_id]);

  const isActive = (href: string) => {
    if (href === '/') {
      return pathname === '/' || pathname === '';
    }
    return pathname.startsWith(href);
  };

  const getBadgeCount = (badgeKey?: string): number => {
    if (!badgeKey) return 0;
    return badges[badgeKey as keyof NotificationBadges] || 0;
  };

  const totalBadges = badges.newApplications + badges.pendingInterviews + badges.pendingOffers;

  return (
    <>
      {/* Mobile backdrop */}
      <AnimatePresence>
        {mobileOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40 lg:hidden"
            onClick={onMobileClose}
          />
        )}
      </AnimatePresence>
    <motion.div 
      className={`h-screen bg-[#0a0a0f] border-r border-white/10 flex flex-col fixed left-0 top-0 z-50 transition-transform duration-300 ease-in-out ${
        collapsed ? 'w-20' : 'w-64'
      } ${mobileOpen ? 'translate-x-0' : '-translate-x-full'} lg:translate-x-0`}
      animate={{ width: collapsed ? 80 : 256 }}
      transition={{ duration: 0.2, ease: 'easeInOut' }}
    >
      {/* Logo & Collapse Toggle */}
      <div className="p-4 border-b border-white/10">
        <div className="flex items-center justify-between">
          <Link href="/" className="flex items-center gap-3">
            {recruiter?.agency?.logo_url ? (
              <Avatar className="h-10 w-10 rounded-xl">
                <AvatarImage src={recruiter.agency.logo_url} alt={recruiter.agency.name} />
                <AvatarFallback className="bg-gradient-to-br from-orange-500 to-amber-600 text-white rounded-xl">
                  {recruiter.agency.name?.substring(0, 2).toUpperCase() || 'BP'}
                </AvatarFallback>
              </Avatar>
            ) : (
              <div className="p-2 rounded-xl bg-gradient-to-br from-orange-500 to-amber-600">
                <Building2 className="h-6 w-6 text-white" />
              </div>
            )}
            <AnimatePresence>
              {!collapsed && (
                <motion.div
                  initial={{ opacity: 0, width: 0 }}
                  animate={{ opacity: 1, width: 'auto' }}
                  exit={{ opacity: 0, width: 0 }}
                  className="overflow-hidden"
                >
                  <span className="text-lg font-bold text-white whitespace-nowrap">
                    {recruiter?.agency?.name || 'BPOC'}
                  </span>
                  <span className="text-xs block text-orange-400">Recruiter</span>
                </motion.div>
              )}
            </AnimatePresence>
          </Link>
          
          {onToggleCollapse && (
            <button
              onClick={onToggleCollapse}
              className="p-1.5 rounded-lg text-gray-400 hover:text-white hover:bg-white/10 transition-colors"
              title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            >
              {collapsed ? (
                <ChevronRight className="h-4 w-4" />
              ) : (
                <ChevronLeft className="h-4 w-4" />
              )}
            </button>
          )}
        </div>
      </div>

      {/* Notification Bell (when collapsed or always visible) */}
      {totalBadges > 0 && (
        <div className={`px-4 py-2 ${collapsed ? 'text-center' : ''}`}>
          <button 
            onClick={() => setShowNotifications(!showNotifications)}
            className="relative p-2 rounded-lg text-gray-400 hover:text-white hover:bg-white/10 transition-colors"
          >
            <Bell className="h-5 w-5" />
            <span className="absolute -top-1 -right-1 h-5 w-5 rounded-full bg-orange-500 text-white text-xs font-bold flex items-center justify-center">
              {totalBadges > 9 ? '9+' : totalBadges}
            </span>
          </button>
        </div>
      )}

      {/* Main Navigation */}
      <nav className="flex-1 p-2 space-y-1 overflow-y-auto">
        <div className="mb-4">
          {!collapsed && (
            <p className="text-xs text-gray-500 uppercase tracking-wider px-3 mb-2">Main</p>
          )}
          {mainNavItems.map((item) => {
            const active = isActive(item.href);
            const badgeCount = getBadgeCount(item.badgeKey);
            
            return (
              <Link
                key={item.name}
                href={item.href}
                onClick={onMobileClose}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all relative group ${
                  item.highlight && !active
                    ? 'text-white bg-gradient-to-r from-orange-500/20 to-amber-500/20 border border-orange-500/30 shadow-lg shadow-orange-500/20 hover:shadow-orange-500/40'
                    : active
                    ? 'text-white bg-orange-500/10'
                    : 'text-gray-400 hover:text-white hover:bg-white/5'
                } ${collapsed ? 'justify-center' : ''}`}
                title={collapsed ? item.name : undefined}
              >
                {active && (
                  <motion.div
                    layoutId="activeTab"
                    className="absolute left-0 top-0 bottom-0 w-1 bg-gradient-to-b from-orange-500 to-amber-500 rounded-full"
                    initial={false}
                    transition={{ type: 'spring', stiffness: 300, damping: 30 }}
                  />
                )}
                <div className="relative">
                  <item.icon className={`h-5 w-5 ${item.highlight && !active ? 'text-orange-300' : active ? 'text-orange-400' : ''}`} />
                  {badgeCount > 0 && collapsed && (
                    <span className="absolute -top-1 -right-1 h-4 w-4 rounded-full bg-orange-500 text-white text-[10px] font-bold flex items-center justify-center">
                      {badgeCount > 9 ? '9+' : badgeCount}
                    </span>
                  )}
                </div>
                <AnimatePresence>
                  {!collapsed && (
                    <motion.div
                      initial={{ opacity: 0, width: 0 }}
                      animate={{ opacity: 1, width: 'auto' }}
                      exit={{ opacity: 0, width: 0 }}
                      className="flex-1 flex items-center justify-between overflow-hidden"
                    >
                      <span className="font-medium whitespace-nowrap">{item.name}</span>
                      {badgeCount > 0 && (
                        <Badge className="bg-orange-500/20 text-orange-400 border-orange-500/30 text-xs">
                          {badgeCount}
                        </Badge>
                      )}
                      {item.highlight && !active && (
                        <Badge className="bg-orange-500/30 text-orange-200 text-[10px] font-bold">NEW</Badge>
                      )}
                    </motion.div>
                  )}
                </AnimatePresence>
                
                {/* Tooltip for collapsed mode */}
                {collapsed && (
                  <div className="absolute left-full ml-2 px-2 py-1 bg-gray-900 text-white text-sm rounded-md opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all whitespace-nowrap z-50">
                    {item.name}
                    {badgeCount > 0 && (
                      <span className="ml-2 text-orange-400">({badgeCount})</span>
                    )}
                  </div>
                )}
              </Link>
            );
          })}
        </div>

        <div className="pt-4 border-t border-white/10">
          {!collapsed && (
            <p className="text-xs text-gray-500 uppercase tracking-wider px-3 mb-2">Settings</p>
          )}
          {settingsNavItems.map((item) => {
            const active = isActive(item.href);
            return (
              <Link
                key={item.name}
                href={item.href}
                onClick={onMobileClose}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all group ${
                  active
                    ? 'text-white bg-orange-500/10'
                    : 'text-gray-400 hover:text-white hover:bg-white/5'
                } ${collapsed ? 'justify-center' : ''}`}
                title={collapsed ? item.name : undefined}
              >
                <item.icon className={`h-5 w-5 ${active ? 'text-orange-400' : ''}`} />
                <AnimatePresence>
                  {!collapsed && (
                    <motion.span
                      initial={{ opacity: 0, width: 0 }}
                      animate={{ opacity: 1, width: 'auto' }}
                      exit={{ opacity: 0, width: 0 }}
                      className="font-medium whitespace-nowrap overflow-hidden"
                    >
                      {item.name}
                    </motion.span>
                  )}
                </AnimatePresence>
                
                {/* Tooltip for collapsed mode */}
                {collapsed && (
                  <div className="absolute left-full ml-2 px-2 py-1 bg-gray-900 text-white text-sm rounded-md opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all whitespace-nowrap z-50">
                    {item.name}
                  </div>
                )}
              </Link>
            );
          })}
        </div>
      </nav>

      {/* User Profile */}
      <div className="p-4 border-t border-white/10">
        <div className={`flex items-center gap-3 mb-3 ${collapsed ? 'justify-center' : ''}`}>
          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-orange-500 to-amber-600 flex items-center justify-center text-white font-semibold flex-shrink-0">
            {recruiter?.first_name?.[0] || 'R'}
            {recruiter?.last_name?.[0] || ''}
          </div>
          <AnimatePresence>
            {!collapsed && (
              <motion.div
                initial={{ opacity: 0, width: 0 }}
                animate={{ opacity: 1, width: 'auto' }}
                exit={{ opacity: 0, width: 0 }}
                className="flex-1 min-w-0 overflow-hidden"
              >
                <p className="text-white font-medium truncate">
                  {recruiter ? `${recruiter.first_name} ${recruiter.last_name}` : 'Recruiter'}
                </p>
                <p className="text-gray-400 text-xs truncate">
                  {recruiter?.agency?.name || 'Agency'}
                </p>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
        <button
          onClick={onSignOut}
          className={`flex items-center gap-2 w-full px-3 py-2 text-gray-400 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-all ${
            collapsed ? 'justify-center' : ''
          }`}
          title={collapsed ? 'Sign Out' : undefined}
        >
          <LogOut className="h-4 w-4" />
          <AnimatePresence>
            {!collapsed && (
              <motion.span
                initial={{ opacity: 0, width: 0 }}
                animate={{ opacity: 1, width: 'auto' }}
                exit={{ opacity: 0, width: 0 }}
                className="text-sm whitespace-nowrap overflow-hidden"
              >
                Sign Out
              </motion.span>
            )}
          </AnimatePresence>
        </button>
      </div>
    </motion.div>
    </>
  );
}


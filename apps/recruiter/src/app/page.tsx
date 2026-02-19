'use client';

import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Briefcase,
  Users,
  FileText,
  Calendar,
  Gift,
  TrendingUp,
  Eye,
  Clock,
  ArrowUpRight,
  Loader2,
  Plus,
  CheckCircle,
  Video,
  Award,
  Sparkles,
  Activity,
  ChevronRight,
  Target,
  Brain,
  Zap,
  Crown,
  Building2,
  DollarSign,
  TrendingDown,
  Bell,
  X,
  CheckCircle2,
  Search,
  BarChart3,
  Users2,
  Flame,
} from 'lucide-react';
import { Card, CardContent } from '@/components/shared/ui/card';
import { Button } from '@/components/shared/ui/button';
import { Badge } from '@/components/shared/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/shared/ui/avatar';
import Link from 'next/link';
import { useAuth } from '@/contexts/AuthContext';
import { getSessionToken } from '@/lib/auth-helpers';

interface DashboardStats {
  activeJobs: number;
  totalApplications: number;
  scheduledInterviews: number;
  pendingOffers: number;
  totalViews: number;
  newApplicationsToday: number;
  placementsThisMonth: number;
  conversionRate: number;
}

interface RecentApplication {
  id: string;
  candidate_id: string;
  candidate_name: string;
  candidate_avatar?: string;
  job_title: string;
  applied_at: string;
  status: string;
}

interface UpcomingInterview {
  id: string;
  candidate_name: string;
  candidate_avatar?: string;
  job_title: string;
  scheduledAt: string;
  type: string;
}

interface ActivityItem {
  id: string;
  type: 'application' | 'interview' | 'offer' | 'placement' | 'hire';
  title: string;
  description: string;
  timestamp: string;
  icon: React.ElementType;
  color: string;
}

interface OnboardingTask {
  id: string;
  title: string;
  description: string;
  completed: boolean;
  href: string;
  icon: React.ElementType;
}

interface Client {
  id: string;
  name: string;
  logo?: string;
  openRoles: number;
  pipeline: {
    new: number;
    screening: number;
    interview: number;
    offer: number;
  };
}

interface TeamMember {
  id: string;
  name: string;
  avatar?: string;
  placements: number;
  isOnline: boolean;
}

interface Notification {
  id: string;
  type: 'application' | 'interview' | 'offer' | 'message';
  title: string;
  description: string;
  timestamp: string;
  read: boolean;
  actionUrl?: string;
}

interface PipelineStage {
  id: string;
  name: string;
  count: number;
  color: string;
  candidates: Array<{
    id: string;
    name: string;
    avatar?: string;
  }>;
}

// Animated counter hook
function useAnimatedCounter(end: number, duration: number = 1000) {
  const [count, setCount] = useState(0);
  const countRef = useRef(0);
  const startTimeRef = useRef<number | null>(null);

  useEffect(() => {
    // Handle undefined, null, NaN, or 0
    if (end == null || isNaN(end) || end === 0) {
      setCount(0);
      return;
    }

    const animate = (timestamp: number) => {
      if (!startTimeRef.current) startTimeRef.current = timestamp;
      const progress = Math.min((timestamp - startTimeRef.current) / duration, 1);
      
      // Easing function for smooth animation
      const easeOutQuart = 1 - Math.pow(1 - progress, 4);
      const current = Math.floor(easeOutQuart * end);
      
      if (current !== countRef.current) {
        countRef.current = current;
        setCount(current);
      }

      if (progress < 1) {
        requestAnimationFrame(animate);
      } else {
        setCount(end);
      }
    };

    startTimeRef.current = null;
    requestAnimationFrame(animate);
  }, [end, duration]);

  return count;
}

// Animated stat card component
function AnimatedStatCard({
  title,
  value,
  icon: Icon,
  color,
  href,
  badge,
  trend,
  loading,
  delay = 0,
}: {
  title: string;
  value: number;
  icon: React.ElementType;
  color: string;
  href: string;
  badge?: string;
  trend?: { value: number; isPositive: boolean };
  loading: boolean;
  delay?: number;
}) {
  const animatedValue = useAnimatedCounter(loading ? 0 : value, 1200);

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: delay * 0.1, duration: 0.4 }}
    >
      <Link href={href}>
        <Card className="relative overflow-hidden bg-white/5 backdrop-blur-xl border-white/10 hover:border-orange-500/30 transition-all duration-300 group cursor-pointer">
          {/* Glassmorphism hover effect */}
          <div className="absolute inset-0 bg-gradient-to-br from-white/5 via-transparent to-white/5 opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
          
          <CardContent className="p-4 sm:p-6 relative z-10">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-gray-400 text-xs sm:text-sm font-medium">{title}</p>
                <div className="flex items-baseline gap-2 mt-1">
                  <p className="text-2xl sm:text-3xl font-bold text-white tabular-nums">
                    {loading ? (
                      <Loader2 className="h-6 w-6 animate-spin" />
                    ) : (
                      (animatedValue ?? 0).toLocaleString()
                    )}
                  </p>
                  {trend && !loading && (
                    <span className={`text-xs font-medium ${trend.isPositive ? 'text-emerald-400' : 'text-red-400'}`}>
                      {trend.isPositive ? '+' : ''}{trend.value}%
                    </span>
                  )}
                </div>
                {badge && (
                  <Badge className="mt-2 bg-emerald-500/20 text-emerald-400 border-emerald-500/30">
                    <Sparkles className="h-3 w-3 mr-1" />
                    {badge}
                  </Badge>
                )}
              </div>
              <div className={`p-3 rounded-xl bg-gradient-to-br ${color} shadow-lg`}>
                <Icon className="h-6 w-6 text-white" />
              </div>
            </div>
            <div className="mt-4 flex items-center text-gray-400 text-sm group-hover:text-orange-400 transition-colors">
              <span>View details</span>
              <ArrowUpRight className="h-4 w-4 ml-1 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform" />
            </div>
          </CardContent>
        </Card>
      </Link>
    </motion.div>
  );
}

// Activity timeline component
function ActivityTimeline({ activities, loading }: { activities: ActivityItem[]; loading: boolean }) {
  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-6 w-6 text-orange-400 animate-spin" />
      </div>
    );
  }

  if (activities.length === 0) {
    return (
      <div className="text-center py-8">
        <Activity className="h-12 w-12 text-gray-500 mx-auto mb-3" />
        <p className="text-gray-400">No recent activity</p>
        <p className="text-gray-500 text-sm">Activity will appear as you use the platform</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {activities.map((activity, index) => (
        <motion.div
          key={activity.id}
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: index * 0.05 }}
          className="flex gap-4 group"
        >
          {/* Timeline line */}
          <div className="flex flex-col items-center">
            <div className={`p-2 rounded-lg ${activity.color} shadow-lg`}>
              <activity.icon className="h-4 w-4 text-white" />
            </div>
            {index < activities.length - 1 && (
              <div className="w-0.5 h-full mt-2 bg-gradient-to-b from-white/20 to-transparent" />
            )}
          </div>

          {/* Content */}
          <div className="flex-1 pb-4">
            <p className="text-white font-medium text-sm">{activity.title}</p>
            <p className="text-gray-400 text-sm mt-0.5">{activity.description}</p>
            <p className="text-gray-500 text-xs mt-1">{activity.timestamp}</p>
          </div>
        </motion.div>
      ))}
    </div>
  );
}

// Onboarding Checklist Component
function OnboardingChecklist({
  tasks,
  onDismiss
}: {
  tasks: OnboardingTask[];
  onDismiss: () => void;
}) {
  const completedCount = tasks.filter(t => t.completed).length;
  const progress = (completedCount / tasks.length) * 100;

  return (
    <motion.div
      initial={{ opacity: 0, y: -20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20, height: 0 }}
      transition={{ duration: 0.3 }}
    >
      <Card className="bg-gradient-to-br from-orange-500/10 via-amber-500/5 to-orange-500/10 backdrop-blur-xl border-orange-500/20 overflow-hidden relative">
        <div className="absolute inset-0 bg-[url('/grid.svg')] opacity-5" />
        <CardContent className="p-6 relative z-10">
          <div className="flex items-start justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-xl bg-gradient-to-br from-orange-500 to-amber-600 shadow-lg">
                <Target className="h-5 w-5 text-white" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-white flex items-center gap-2">
                  Getting Started
                  <Badge className="bg-orange-500/20 text-orange-400 border-orange-500/30">
                    {completedCount}/{tasks.length}
                  </Badge>
                </h3>
                <p className="text-gray-400 text-sm">Complete these steps to get the most out of the platform</p>
              </div>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={onDismiss}
              className="text-gray-400 hover:text-white"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>

          {/* Progress Bar */}
          <div className="mb-4">
            <div className="h-2 bg-white/10 rounded-full overflow-hidden">
              <motion.div
                className="h-full bg-gradient-to-r from-orange-500 to-amber-600"
                initial={{ width: 0 }}
                animate={{ width: `${progress}%` }}
                transition={{ duration: 0.5, ease: 'easeOut' }}
              />
            </div>
          </div>

          {/* Tasks */}
          <div className="space-y-2">
            {tasks.map((task, index) => (
              <motion.div
                key={task.id}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: index * 0.05 }}
              >
                <Link href={task.href}>
                  <div className={`flex items-center gap-3 p-3 rounded-lg border transition-all group cursor-pointer ${
                    task.completed
                      ? 'bg-white/5 border-white/10 opacity-60'
                      : 'bg-white/5 border-orange-500/30 hover:border-orange-500/50 hover:bg-white/10'
                  }`}>
                    <div className={`flex-shrink-0 ${task.completed ? 'text-emerald-400' : 'text-orange-400'}`}>
                      {task.completed ? (
                        <CheckCircle2 className="h-5 w-5" />
                      ) : (
                        <task.icon className="h-5 w-5" />
                      )}
                    </div>
                    <div className="flex-1">
                      <p className={`text-sm font-medium ${task.completed ? 'text-gray-400 line-through' : 'text-white group-hover:text-orange-400'}`}>
                        {task.title}
                      </p>
                      <p className="text-xs text-gray-500">{task.description}</p>
                    </div>
                    {!task.completed && (
                      <ChevronRight className="h-4 w-4 text-gray-500 group-hover:text-orange-400 group-hover:translate-x-1 transition-all" />
                    )}
                  </div>
                </Link>
              </motion.div>
            ))}
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}

// AI Insights Card Component
function AIInsightsCard({ loading }: { loading: boolean }) {
  const insights = [
    { icon: Brain, text: "5 candidates match your open roles", color: "text-cyan-400" },
    { icon: TrendingUp, text: "3 candidates updated profiles this week", color: "text-emerald-400" },
    { icon: Sparkles, text: "Trending skills: Excel, Zendesk, English", color: "text-purple-400" },
  ];

  return (
    <Card className="bg-gradient-to-br from-purple-500/10 via-pink-500/5 to-purple-500/10 backdrop-blur-xl border-purple-500/20 hover:border-purple-500/40 transition-all duration-300 group overflow-hidden relative">
      <div className="absolute inset-0 bg-gradient-to-br from-purple-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
      <CardContent className="p-6 relative z-10">
        <div className="flex items-center gap-3 mb-4">
          <div className="p-3 rounded-xl bg-gradient-to-br from-purple-500 to-pink-600 shadow-lg shadow-purple-500/25">
            <Brain className="h-5 w-5 text-white" />
          </div>
          <div>
            <h3 className="text-lg font-bold text-white flex items-center gap-2">
              AI Insights
              <Badge className="bg-purple-500/20 text-purple-400 border-purple-500/30">
                <Zap className="h-3 w-3 mr-1" />
                New
              </Badge>
            </h3>
            <p className="text-gray-400 text-sm">Powered by AI matching</p>
          </div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 text-purple-400 animate-spin" />
          </div>
        ) : (
          <div className="space-y-3">
            {insights.map((insight, index) => (
              <motion.div
                key={index}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: index * 0.1 }}
                className="flex items-start gap-3 p-3 rounded-lg bg-white/5 border border-white/10 hover:border-purple-500/30 transition-all group/item"
              >
                <insight.icon className={`h-5 w-5 ${insight.color} flex-shrink-0 mt-0.5`} />
                <p className="text-sm text-gray-300 group-hover/item:text-white transition-colors">
                  {insight.text}
                </p>
              </motion.div>
            ))}
          </div>
        )}

        <Link href="/talent">
          <Button className="w-full mt-4 bg-gradient-to-r from-purple-500 to-pink-600 hover:from-purple-600 hover:to-pink-700 shadow-lg shadow-purple-500/25">
            <Search className="h-4 w-4 mr-2" />
            Explore Matched Candidates
          </Button>
        </Link>
      </CardContent>
    </Card>
  );
}

// Mini Pipeline Preview Component
function MiniPipelinePreview({ stages, loading }: { stages: PipelineStage[]; loading: boolean }) {
  if (loading) {
    return (
      <Card className="bg-white/5 backdrop-blur-xl border-white/10">
        <CardContent className="p-6">
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-6 w-6 text-orange-400 animate-spin" />
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="bg-white/5 backdrop-blur-xl border-white/10 hover:border-orange-500/30 transition-all duration-300 group overflow-hidden relative">
      <div className="absolute inset-0 bg-gradient-to-br from-orange-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
      <CardContent className="p-6 relative z-10">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-gradient-to-br from-orange-500 to-amber-600 shadow-lg">
              <BarChart3 className="h-5 w-5 text-white" />
            </div>
            <h3 className="text-lg font-bold text-white">Candidate Pipeline</h3>
          </div>
          <Link href="/pipeline">
            <Button variant="ghost" size="sm" className="text-orange-400 hover:text-orange-300">
              Full View
              <ChevronRight className="h-4 w-4 ml-1" />
            </Button>
          </Link>
        </div>

        <div className="grid grid-cols-3 sm:grid-cols-5 gap-3">
          {stages.map((stage, index) => (
            <motion.div
              key={stage.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.1 }}
              className="relative"
            >
              <div className="text-center">
                <div className={`h-1 w-full ${stage.color} rounded-full mb-2`} />
                <p className="text-xs text-gray-400 mb-2 font-medium">{stage.name}</p>
                <div className="text-2xl font-bold text-white mb-3">{stage.count}</div>

                {/* Candidate Avatars */}
                <div className="flex justify-center -space-x-2">
                  {stage.candidates.slice(0, 3).map((candidate, idx) => (
                    <Avatar key={candidate.id} className="h-6 w-6 border-2 border-[#0a0a0f]">
                      <AvatarImage src={candidate.avatar} />
                      <AvatarFallback className="text-xs bg-gradient-to-br from-gray-600 to-gray-700">
                        {candidate.name.split(' ').map(n => n[0]).join('')}
                      </AvatarFallback>
                    </Avatar>
                  ))}
                  {stage.count > 3 && (
                    <div className="h-6 w-6 rounded-full bg-white/10 border-2 border-[#0a0a0f] flex items-center justify-center">
                      <span className="text-[10px] text-gray-400 font-medium">+{stage.count - 3}</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Arrow */}
              {index < stages.length - 1 && (
                <div className="absolute top-12 -right-3 text-gray-600 hidden lg:block">
                  <ChevronRight className="h-4 w-4" />
                </div>
              )}
            </motion.div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

// Performance/Revenue Card Component
function PerformanceCard({
  placements,
  revenue,
  avgTimeToFill,
  loading
}: {
  placements: number;
  revenue: number;
  avgTimeToFill: number;
  loading: boolean;
}) {
  const animatedRevenue = useAnimatedCounter(loading ? 0 : revenue, 1500);
  const animatedPlacements = useAnimatedCounter(loading ? 0 : placements, 1200);

  return (
    <Card className="bg-gradient-to-br from-emerald-500/10 via-green-500/5 to-emerald-500/10 backdrop-blur-xl border-emerald-500/20 hover:border-emerald-500/40 transition-all duration-300 group overflow-hidden relative">
      <div className="absolute inset-0 bg-gradient-to-br from-emerald-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
      <CardContent className="p-6 relative z-10">
        <div className="flex items-center gap-3 mb-6">
          <div className="p-3 rounded-xl bg-gradient-to-br from-emerald-500 to-green-600 shadow-lg shadow-emerald-500/25">
            <DollarSign className="h-5 w-5 text-white" />
          </div>
          <div>
            <h3 className="text-lg font-bold text-white">This Month</h3>
            <p className="text-gray-400 text-sm">Performance overview</p>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-2 sm:gap-4">
          <div>
            <p className="text-gray-400 text-xs mb-1">Placements</p>
            <p className="text-xl sm:text-2xl font-bold text-white">
              {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : animatedPlacements}
            </p>
            <Badge className="mt-2 bg-emerald-500/20 text-emerald-400 border-emerald-500/30 text-xs">
              <TrendingUp className="h-3 w-3 mr-1" />
              +12%
            </Badge>
          </div>
          <div>
            <p className="text-gray-400 text-xs mb-1">Revenue</p>
            <p className="text-2xl font-bold text-white">
              {loading ? (
                <Loader2 className="h-5 w-5 animate-spin" />
              ) : (
                `₱${(animatedRevenue ?? 0).toLocaleString()}`
              )}
            </p>
            <Badge className="mt-2 bg-emerald-500/20 text-emerald-400 border-emerald-500/30 text-xs">
              <TrendingUp className="h-3 w-3 mr-1" />
              +8%
            </Badge>
          </div>
          <div>
            <p className="text-gray-400 text-xs mb-1">Avg. Time</p>
            <p className="text-2xl font-bold text-white">
              {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : avgTimeToFill}d
            </p>
            <Badge className="mt-2 bg-cyan-500/20 text-cyan-400 border-cyan-500/30 text-xs">
              <TrendingDown className="h-3 w-3 mr-1" />
              -2d
            </Badge>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// Team Leaderboard Component
function TeamLeaderboard({ members, loading }: { members: TeamMember[]; loading: boolean }) {
  if (loading) {
    return (
      <Card className="bg-white/5 backdrop-blur-xl border-white/10">
        <CardContent className="p-6">
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 text-orange-400 animate-spin" />
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="bg-white/5 backdrop-blur-xl border-white/10 hover:border-amber-500/30 transition-all duration-300 group overflow-hidden relative">
      <div className="absolute inset-0 bg-gradient-to-br from-amber-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
      <CardContent className="p-6 relative z-10">
        <div className="flex items-center gap-3 mb-6">
          <div className="p-2 rounded-xl bg-gradient-to-br from-amber-500 to-orange-600 shadow-lg">
            <Crown className="h-5 w-5 text-white" />
          </div>
          <div>
            <h3 className="text-lg font-bold text-white">Team Leaderboard</h3>
            <p className="text-gray-400 text-sm">Top performers this month</p>
          </div>
        </div>

        <div className="space-y-3">
          {members.slice(0, 5).map((member, index) => (
            <motion.div
              key={member.id}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: index * 0.05 }}
              className="flex items-center gap-3 p-3 rounded-lg bg-white/5 border border-white/10 hover:border-amber-500/30 transition-all group/item"
            >
              <div className="flex items-center gap-3 flex-1">
                {index < 3 && (
                  <div className={`text-lg font-bold ${
                    index === 0 ? 'text-amber-400' :
                    index === 1 ? 'text-gray-400' :
                    'text-orange-600'
                  }`}>
                    {index + 1}
                  </div>
                )}
                <div className="relative">
                  <Avatar className="h-8 w-8">
                    <AvatarImage src={member.avatar} />
                    <AvatarFallback className="bg-gradient-to-br from-amber-500 to-orange-600 text-white text-xs">
                      {member.name.split(' ').map(n => n[0]).join('')}
                    </AvatarFallback>
                  </Avatar>
                  {member.isOnline && (
                    <div className="absolute -bottom-0.5 -right-0.5 h-3 w-3 bg-emerald-500 border-2 border-[#0a0a0f] rounded-full" />
                  )}
                </div>
                <div className="flex-1">
                  <p className="text-sm font-medium text-white group-hover/item:text-amber-400 transition-colors">
                    {member.name}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Badge className="bg-amber-500/20 text-amber-400 border-amber-500/30">
                    <Flame className="h-3 w-3 mr-1" />
                    {member.placements}
                  </Badge>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

// Client Overview Component
function ClientOverview({ clients, loading }: { clients: Client[]; loading: boolean }) {
  if (loading) {
    return (
      <Card className="bg-white/5 backdrop-blur-xl border-white/10">
        <CardContent className="p-6">
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 text-orange-400 animate-spin" />
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="bg-white/5 backdrop-blur-xl border-white/10 hover:border-cyan-500/30 transition-all duration-300 group overflow-hidden relative">
      <div className="absolute inset-0 bg-gradient-to-br from-cyan-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
      <CardContent className="p-6 relative z-10">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-gradient-to-br from-cyan-500 to-blue-600 shadow-lg">
              <Building2 className="h-5 w-5 text-white" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-white">Active Clients</h3>
              <p className="text-gray-400 text-sm">{clients.length} clients</p>
            </div>
          </div>
          <Link href="/clients">
            <Button variant="ghost" size="sm" className="text-cyan-400 hover:text-cyan-300">
              View All
              <ChevronRight className="h-4 w-4 ml-1" />
            </Button>
          </Link>
        </div>

        <div className="space-y-3">
          {clients.slice(0, 4).map((client, index) => (
            <motion.div
              key={client.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.05 }}
              className="p-4 rounded-lg bg-white/5 border border-white/10 hover:border-cyan-500/30 transition-all group/item"
            >
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-3">
                  <Avatar className="h-10 w-10">
                    <AvatarImage src={client.logo} />
                    <AvatarFallback className="bg-gradient-to-br from-cyan-500 to-blue-600 text-white text-xs">
                      {client.name ? client.name.split(' ').map(n => n[0]).join('').slice(0, 2) : 'CL'}
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    <p className="text-sm font-medium text-white group-hover/item:text-cyan-400 transition-colors">
                      {client.name}
                    </p>
                    <p className="text-xs text-gray-500">{client.openRoles} open roles</p>
                  </div>
                </div>
              </div>

              {/* Mini pipeline */}
              <div className="flex gap-2">
                {Object.entries(client.pipeline).map(([stage, count]) => (
                  <div key={stage} className="flex-1">
                    <div className="h-1 bg-white/10 rounded-full overflow-hidden">
                      <div
                        className={`h-full ${
                          stage === 'new' ? 'bg-cyan-400' :
                          stage === 'screening' ? 'bg-blue-400' :
                          stage === 'interview' ? 'bg-purple-400' :
                          'bg-emerald-400'
                        }`}
                        style={{ width: `${Math.min(count * 20, 100)}%` }}
                      />
                    </div>
                    <p className="text-[10px] text-gray-500 mt-1 text-center">{count}</p>
                  </div>
                ))}
              </div>
            </motion.div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

// Enhanced Notifications Component
function EnhancedNotifications({
  notifications,
  loading
}: {
  notifications: Notification[];
  loading: boolean;
}) {
  if (loading) {
    return (
      <Card className="bg-white/5 backdrop-blur-xl border-white/10">
        <CardContent className="p-6">
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 text-orange-400 animate-spin" />
          </div>
        </CardContent>
      </Card>
    );
  }

  const getNotificationIcon = (type: string) => {
    switch (type) {
      case 'application': return FileText;
      case 'interview': return Calendar;
      case 'offer': return Gift;
      default: return Bell;
    }
  };

  const getNotificationColor = (type: string) => {
    switch (type) {
      case 'application': return 'from-cyan-500 to-blue-500';
      case 'interview': return 'from-purple-500 to-pink-500';
      case 'offer': return 'from-emerald-500 to-green-500';
      default: return 'from-gray-500 to-gray-600';
    }
  };

  return (
    <Card className="bg-white/5 backdrop-blur-xl border-white/10">
      <CardContent className="p-6">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-gradient-to-br from-orange-500 to-amber-600 shadow-lg">
              <Bell className="h-5 w-5 text-white" />
            </div>
            <h3 className="text-lg font-bold text-white">Notifications</h3>
          </div>
          <Badge className="bg-orange-500/20 text-orange-400 border-orange-500/30">
            {notifications.filter(n => !n.read).length} new
          </Badge>
        </div>

        {notifications.length === 0 ? (
          <div className="text-center py-8">
            <Bell className="h-12 w-12 text-gray-500 mx-auto mb-3" />
            <p className="text-gray-400">No notifications</p>
            <p className="text-gray-500 text-sm">You're all caught up!</p>
          </div>
        ) : (
          <div className="space-y-2 max-h-[400px] overflow-y-auto pr-2">
            {notifications.map((notification, index) => {
              const Icon = getNotificationIcon(notification.type);
              const color = getNotificationColor(notification.type);

              return (
                <motion.div
                  key={notification.id}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: index * 0.03 }}
                >
                  <Link href={notification.actionUrl || '#'}>
                    <div className={`p-3 rounded-lg border transition-all group cursor-pointer ${
                      notification.read
                        ? 'bg-white/5 border-white/10 opacity-60'
                        : 'bg-white/5 border-orange-500/30 hover:border-orange-500/50 hover:bg-white/10'
                    }`}>
                      <div className="flex gap-3">
                        <div className={`p-2 rounded-lg bg-gradient-to-br ${color} shadow-lg flex-shrink-0`}>
                          <Icon className="h-4 w-4 text-white" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-white group-hover:text-orange-400 transition-colors">
                            {notification.title}
                          </p>
                          <p className="text-xs text-gray-400 mt-0.5">{notification.description}</p>
                          <p className="text-xs text-gray-500 mt-1">{notification.timestamp}</p>
                        </div>
                        {!notification.read && (
                          <div className="flex-shrink-0 h-2 w-2 bg-orange-500 rounded-full mt-2" />
                        )}
                      </div>
                    </div>
                  </Link>
                </motion.div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default function RecruiterDashboard() {
  const { user } = useAuth();
  const [stats, setStats] = useState<DashboardStats>({
    activeJobs: 0,
    totalApplications: 0,
    scheduledInterviews: 0,
    pendingOffers: 0,
    totalViews: 0,
    newApplicationsToday: 0,
    placementsThisMonth: 0,
    conversionRate: 0,
  });
  const [loading, setLoading] = useState(true);
  const [recentApplications, setRecentApplications] = useState<RecentApplication[]>([]);
  const [upcomingInterviews, setUpcomingInterviews] = useState<UpcomingInterview[]>([]);
  const [activities, setActivities] = useState<ActivityItem[]>([]);
  const [showOnboarding, setShowOnboarding] = useState(true);
  const [onboardingTasks, setOnboardingTasks] = useState<OnboardingTask[]>([]);
  const [pipelineStages, setPipelineStages] = useState<PipelineStage[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [performanceMetrics, setPerformanceMetrics] = useState({
    revenue: 0,
    avgTimeToFill: 0,
  });
  const [verificationStatus, setVerificationStatus] = useState<string>('verified');

  useEffect(() => {
    if (user?.id) {
      fetchDashboardData();
      fetchVerificationStatus();
      initializeOnboardingTasks();
      loadPipelineData();
      loadClientsData();
      loadTeamData();
      loadNotifications();
    }
  }, [user?.id]);

  const fetchVerificationStatus = async () => {
    try {
      const response = await fetch('/api/recruiter/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: user?.id }),
      });
      const data = await response.json();
      if (response.ok && data.recruiter) {
        setVerificationStatus(data.recruiter.verificationStatus || 'verified');
      }
    } catch (error) {
      console.error('Failed to fetch verification status:', error);
    }
  };

  const fetchDashboardData = async () => {
    try {
      const token = await getSessionToken();
      const response = await fetch('/api/recruiter/dashboard/stats', {
        headers: {
          'Authorization': `Bearer ${token}`,
          'x-user-id': user?.id || '',
        }
      });
      const data = await response.json();

      if (response.ok) {
        setStats({
          ...data.stats,
          placementsThisMonth: data.stats?.placementsThisMonth || 0,
          conversionRate: data.stats?.conversionRate || 0,
        });
        setRecentApplications(data.recentApplications || []);
        setUpcomingInterviews(data.upcomingInterviews || []);

        // Set performance metrics (mock data for now - replace with real API)
        setPerformanceMetrics({
          revenue: (data.stats?.placementsThisMonth || 0) * 50000, // Assume 50k per placement
          avgTimeToFill: 5, // Mock data
        });

        // Generate activity items from recent data
        const activityItems: ActivityItem[] = [];

        // Add recent applications to activity
        (data.recentApplications || []).slice(0, 3).forEach((app: RecentApplication) => {
          activityItems.push({
            id: `app-${app.id}`,
            type: 'application',
            title: 'New Application',
            description: `${app.candidate_name} applied for ${app.job_title}`,
            timestamp: formatTimeAgo(app.applied_at),
            icon: FileText,
            color: 'bg-blue-500',
          });
        });

        setActivities(activityItems);
      }
    } catch (error) {
      console.error('Failed to fetch dashboard stats:', error);
    } finally {
      setLoading(false);
    }
  };

  const initializeOnboardingTasks = () => {
    // Check localStorage for onboarding completion
    const dismissed = localStorage.getItem('onboarding-dismissed');
    if (dismissed === 'true') {
      setShowOnboarding(false);
      return;
    }

    // Initialize onboarding tasks
    const tasks: OnboardingTask[] = [
      {
        id: '1',
        title: 'Complete your agency profile',
        description: 'Add your company details and branding',
        completed: false, // TODO: Check actual completion status
        href: '/settings',
        icon: Building2,
      },
      {
        id: '2',
        title: verificationStatus === 'verified' ? 'Post your first job' : 'Post your first job (Verification Required)',
        description: verificationStatus === 'verified'
          ? 'Create a job posting to attract candidates'
          : 'Complete verification before posting jobs',
        completed: stats.activeJobs > 0,
        href: verificationStatus === 'verified' ? '/jobs/create' : '#',
        icon: Plus,
      },
      {
        id: '3',
        title: 'Search the talent pool',
        description: 'Find candidates for your open roles',
        completed: false, // TODO: Track if user has visited talent page
        href: '/talent',
        icon: Search,
      },
      {
        id: '4',
        title: 'Schedule your first interview',
        description: 'Set up a video call with a candidate',
        completed: stats.scheduledInterviews > 0,
        href: '/interviews',
        icon: Video,
      },
    ];

    setOnboardingTasks(tasks);

    // Auto-dismiss if all tasks completed
    if (tasks.every(t => t.completed)) {
      setShowOnboarding(false);
      localStorage.setItem('onboarding-dismissed', 'true');
    }
  };

  const loadPipelineData = async () => {
    try {
      const token = await getSessionToken();
      const response = await fetch('/api/applications?limit=50', {
        headers: {
          'Authorization': `Bearer ${token}`,
          'x-user-id': user?.id || '',
        }
      });

      if (!response.ok) {
        console.error('Failed to fetch pipeline data');
        return;
      }

      const data = await response.json();
      const applications = data.applications || [];

      // Group applications by status
      const statusMap: Record<string, { name: string; color: string; order: number }> = {
        'pending': { name: 'New', color: 'bg-cyan-400', order: 1 },
        'under_review': { name: 'Screening', color: 'bg-blue-400', order: 2 },
        'interview_scheduled': { name: 'Interview', color: 'bg-purple-400', order: 3 },
        'offer_sent': { name: 'Offer', color: 'bg-emerald-400', order: 4 },
        'hired': { name: 'Placed', color: 'bg-green-500', order: 5 },
      };

      const grouped = applications.reduce((acc: any, app: any) => {
        const status = app.status || 'pending';
        if (!statusMap[status]) return acc;

        if (!acc[status]) {
          acc[status] = {
            applications: [],
            count: 0,
          };
        }
        acc[status].applications.push(app);
        acc[status].count++;
        return acc;
      }, {});

      // Build pipeline stages
      const stages: PipelineStage[] = Object.keys(statusMap)
        .sort((a, b) => statusMap[a].order - statusMap[b].order)
        .map(status => ({
          id: status,
          name: statusMap[status].name,
          count: grouped[status]?.count || 0,
          color: statusMap[status].color,
          candidates: (grouped[status]?.applications || [])
            .slice(0, 3)
            .map((app: any) => ({
              id: app.candidate_id,
              name: app.candidate_name,
              avatar: app.candidate_avatar || '',
            })),
        }));

      setPipelineStages(stages);
    } catch (error) {
      console.error('Error loading pipeline data:', error);
    }
  };

  const loadClientsData = async () => {
    try {
      const token = await getSessionToken();
      const response = await fetch('/api/recruiter/clients', {
        headers: {
          'Authorization': `Bearer ${token}`,
          'x-user-id': user?.id || '',
        }
      });

      if (!response.ok) {
        console.error('Failed to fetch clients data');
        return;
      }

      const data = await response.json();
      const clientsData = data.clients || [];

      // For each client, count their pipeline stages from job applications
      const clientsWithPipeline = await Promise.all(
        clientsData.slice(0, 4).map(async (client: any) => {
          try {
            const jobsResponse = await fetch(`/api/jobs?clientId=${client.id}`, {
              headers: {
                'Authorization': `Bearer ${token}`,
                'x-user-id': user?.id || '',
              }
            });

            let openRoles = 0;
            let pipeline = { new: 0, screening: 0, interview: 0, offer: 0 };

            if (jobsResponse.ok) {
              const jobsData = await jobsResponse.json();
              const jobs = jobsData.jobs || [];
              openRoles = jobs.filter((j: any) => j.status === 'open').length;

              // Aggregate pipeline counts from all client jobs
              for (const job of jobs) {
                if (job.applicationStats) {
                  pipeline.new += job.applicationStats.pending || 0;
                  pipeline.screening += job.applicationStats.under_review || 0;
                  pipeline.interview += job.applicationStats.interview_scheduled || 0;
                  pipeline.offer += job.applicationStats.offer_sent || 0;
                }
              }
            }

            return {
              id: client.id,
              name: client.company_name || client.name,
              logo: client.logo || '',
              openRoles,
              pipeline,
            };
          } catch (error) {
            console.error(`Error loading data for client ${client.id}:`, error);
            return {
              id: client.id,
              name: client.company_name || client.name,
              logo: client.logo || '',
              openRoles: 0,
              pipeline: { new: 0, screening: 0, interview: 0, offer: 0 },
            };
          }
        })
      );

      setClients(clientsWithPipeline);
    } catch (error) {
      console.error('Error loading clients data:', error);
    }
  };

  const loadTeamData = async () => {
    try {
      const token = await getSessionToken();
      const response = await fetch('/api/recruiter/team', {
        headers: {
          'Authorization': `Bearer ${token}`,
          'x-user-id': user?.id || '',
        }
      });

      if (!response.ok) {
        console.error('Failed to fetch team data');
        return;
      }

      const data = await response.json();
      const teamData = data.members || [];

      // Format team members with placement counts
      const formattedTeam: TeamMember[] = teamData.map((member: any) => ({
        id: member.id,
        name: `${member.first_name || ''} ${member.last_name || ''}`.trim() || member.email,
        avatar: member.avatar_url || '',
        placements: member.placementsThisMonth || 0,
        isOnline: member.last_active ? (new Date().getTime() - new Date(member.last_active).getTime() < 300000) : false, // Online if active in last 5 minutes
      }));

      // Sort by placements descending
      formattedTeam.sort((a, b) => b.placements - a.placements);

      setTeamMembers(formattedTeam);
    } catch (error) {
      console.error('Error loading team data:', error);
    }
  };

  const loadNotifications = async () => {
    try {
      const token = await getSessionToken();
      const response = await fetch('/api/recruiter/notifications?limit=20', {
        headers: {
          'Authorization': `Bearer ${token}`,
          'x-user-id': user?.id || '',
        }
      });

      if (!response.ok) {
        console.error('Failed to fetch notifications');
        return;
      }

      const data = await response.json();
      const notificationsData = data.notifications || [];

      // Format notifications
      const formattedNotifications: Notification[] = notificationsData.map((notif: any) => {
        // Map notification types
        let type: 'application' | 'interview' | 'offer' | 'message' = 'application';
        if (notif.type === 'interview_scheduled' || notif.type === 'interview_reminder') {
          type = 'interview';
        } else if (notif.type === 'offer_sent' || notif.type === 'offer_accepted' || notif.type === 'offer_rejected') {
          type = 'offer';
        } else if (notif.type === 'message' || notif.type === 'team_message') {
          type = 'message';
        }

        return {
          id: notif.id,
          type,
          title: notif.title || 'Notification',
          description: notif.message || notif.description || '',
          timestamp: formatTimeAgo(notif.created_at || notif.timestamp),
          read: notif.read || notif.isRead || false,
          actionUrl: notif.actionUrl || notif.link || '/',
        };
      });

      setNotifications(formattedNotifications);
    } catch (error) {
      console.error('Error loading notifications:', error);
    }
  };

  const handleDismissOnboarding = () => {
    setShowOnboarding(false);
    localStorage.setItem('onboarding-dismissed', 'true');
  };

  const formatTimeAgo = (dateStr: string) => {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) return '';
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);
    
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString();
  };

  const statCards = [
    {
      title: 'Active Jobs',
      value: stats.activeJobs,
      icon: Briefcase,
      color: 'from-orange-500 to-amber-500',
      href: '/jobs',
    },
    {
      title: 'Applications',
      value: stats.total_applications,
      icon: FileText,
      color: 'from-cyan-500 to-blue-500',
      href: '/applications',
      badge: stats.newApplicationsToday > 0 ? `+${stats.newApplicationsToday} today` : undefined,
    },
    {
      title: 'Interviews',
      value: stats.scheduledInterviews,
      icon: Calendar,
      color: 'from-purple-500 to-pink-500',
      href: '/interviews',
    },
    {
      title: 'Pending Offers',
      value: stats.pendingOffers,
      icon: Gift,
      color: 'from-emerald-500 to-green-500',
      href: '/offers',
    },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <motion.h1
            className="text-2xl sm:text-3xl font-bold text-white"
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
          >
            Dashboard
          </motion.h1>
          <motion.p
            className="text-gray-400 mt-1 text-sm sm:text-base"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.1 }}
          >
            Welcome back, {user?.email?.split('@')[0]}!
          </motion.p>
        </div>
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.2 }}
        >
          {verificationStatus === 'verified' ? (
            <Link href="/jobs/create">
              <Button className="w-full sm:w-auto bg-gradient-to-r from-orange-500 to-amber-600 hover:from-orange-600 hover:to-amber-700 shadow-lg shadow-orange-500/25">
                <Plus className="h-4 w-4 mr-2" />
                Post New Job
              </Button>
            </Link>
          ) : (
            <Button
              disabled
              className="w-full sm:w-auto bg-gray-500/20 cursor-not-allowed opacity-50"
              title="Complete verification to post jobs"
            >
              <Plus className="h-4 w-4 mr-2" />
              Post New Job
            </Button>
          )}
        </motion.div>
      </div>

      {/* Onboarding Checklist - Dismissible */}
      <AnimatePresence>
        {showOnboarding && onboardingTasks.length > 0 && (
          <OnboardingChecklist
            tasks={onboardingTasks}
            onDismiss={handleDismissOnboarding}
          />
        )}
      </AnimatePresence>

      {/* Main Stats Grid */}
      <div className="grid grid-cols-2 md:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        {statCards.map((stat, index) => (
          <AnimatedStatCard
            key={stat.title}
            {...stat}
            loading={loading}
            delay={index}
          />
        ))}
      </div>

      {/* AI Insights & Performance Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
        >
          <AIInsightsCard loading={loading} />
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.6 }}
        >
          <PerformanceCard
            placements={stats.placementsThisMonth}
            revenue={performanceMetrics.revenue}
            avgTimeToFill={performanceMetrics.avgTimeToFill}
            loading={loading}
          />
        </motion.div>
      </div>

      {/* Pipeline Preview - Full Width */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.7 }}
      >
        <MiniPipelinePreview stages={pipelineStages} loading={loading} />
      </motion.div>

      {/* Team & Clients Row */}
      {teamMembers.length > 0 && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.8 }}
          >
            <TeamLeaderboard members={teamMembers} loading={loading} />
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.9 }}
          >
            <ClientOverview clients={clients} loading={loading} />
          </motion.div>
        </div>
      )}

      {/* Main Content Grid - Applications, Notifications, Activity */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Recent Applications - 2 cols */}
        <motion.div
          className="lg:col-span-2"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 1.0 }}
        >
          <Card className="bg-white/5 backdrop-blur-xl border-white/10 h-full hover:border-orange-500/30 transition-all duration-300 group overflow-hidden relative">
            <div className="absolute inset-0 bg-gradient-to-br from-orange-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
            <CardContent className="p-6 relative z-10">
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-xl bg-gradient-to-br from-cyan-500 to-blue-600 shadow-lg">
                    <FileText className="h-5 w-5 text-white" />
                  </div>
                  <h2 className="text-xl font-semibold text-white">Recent Applications</h2>
                </div>
                <Link href="/applications">
                  <Button variant="ghost" size="sm" className="text-orange-400 hover:text-orange-300">
                    View All
                    <ChevronRight className="h-4 w-4 ml-1" />
                  </Button>
                </Link>
              </div>

              {loading ? (
                <div className="text-center py-12">
                  <Loader2 className="h-6 w-6 text-gray-400 animate-spin mx-auto" />
                </div>
              ) : recentApplications.length === 0 ? (
                <div className="text-center py-12">
                  <div className="relative mx-auto mb-6 w-24 h-24">
                    <div className="absolute inset-0 bg-gradient-to-br from-cyan-500/20 to-blue-500/20 rounded-full blur-xl" />
                    <div className="relative bg-gradient-to-br from-cyan-500/10 to-blue-500/10 rounded-full p-6 border border-cyan-500/20">
                      <FileText className="h-12 w-12 text-cyan-400" />
                    </div>
                  </div>
                  <h3 className="text-xl font-bold text-white mb-2">No Applications Yet</h3>
                  <p className="text-gray-400 mb-6">Share your job posts to start receiving applications</p>
                  <Link href="/jobs/create">
                    <Button className="bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-600 hover:to-blue-700 shadow-lg shadow-cyan-500/25">
                      <Plus className="h-4 w-4 mr-2" />
                      Post Your First Job
                    </Button>
                  </Link>
                </div>
              ) : (
                <div className="space-y-3">
                  {recentApplications.slice(0, 5).map((app, index) => (
                    <motion.div
                      key={app.id}
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: 1.1 + index * 0.05 }}
                    >
                      <Link href={`/talent/${app.candidate_id}`}>
                        <div className="flex items-center justify-between p-4 rounded-xl bg-white/5 border border-white/10 hover:border-cyan-500/30 hover:bg-white/10 transition-all group/item cursor-pointer">
                          <div className="flex items-center gap-4">
                            <Avatar className="h-10 w-10">
                              <AvatarImage src={app.candidate_avatar} />
                              <AvatarFallback className="bg-gradient-to-br from-cyan-500 to-blue-600 text-white">
                                {app.candidate_name.split(' ').map(n => n[0]).join('')}
                              </AvatarFallback>
                            </Avatar>
                            <div>
                              <p className="text-white font-medium group-hover/item:text-cyan-400 transition-colors">
                                {app.candidate_name}
                              </p>
                              <p className="text-gray-400 text-sm">{app.job_title}</p>
                            </div>
                          </div>
                          <div className="flex items-center gap-3">
                            <Badge variant="outline" className="bg-blue-500/10 text-blue-400 border-blue-500/30">
                              {app.status || 'New'}
                            </Badge>
                            <span className="text-gray-500 text-sm flex items-center gap-1">
                              <Clock className="h-3 w-3" />
                              {formatTimeAgo(app.applied_at)}
                            </span>
                          </div>
                        </div>
                      </Link>
                    </motion.div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </motion.div>

        {/* Sidebar - Notifications & Activity */}
        <motion.div
          className="space-y-6"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 1.1 }}
        >
          {/* Enhanced Notifications */}
          <EnhancedNotifications notifications={notifications} loading={loading} />

          {/* Quick Actions */}
          <Card className="bg-white/5 backdrop-blur-xl border-white/10">
            <CardContent className="p-6">
              <h2 className="text-lg font-semibold text-white mb-4">Quick Actions</h2>

              <div className="space-y-2">
                {verificationStatus === 'verified' ? (
                  <Link href="/jobs/create" className="block">
                    <div className="flex items-center gap-3 p-3 rounded-lg bg-gradient-to-r from-orange-500/10 to-amber-500/10 border border-orange-500/20 hover:border-orange-500/40 transition-all group">
                      <Plus className="h-4 w-4 text-orange-400" />
                      <span className="text-white text-sm group-hover:text-orange-400 transition-colors">Post a New Job</span>
                    </div>
                  </Link>
                ) : (
                  <div
                    className="flex items-center gap-3 p-3 rounded-lg bg-gray-500/10 border border-gray-500/20 cursor-not-allowed opacity-50"
                    title="Complete verification to post jobs"
                  >
                    <Plus className="h-4 w-4 text-gray-400" />
                    <span className="text-gray-400 text-sm">Post a New Job (Verification Required)</span>
                  </div>
                )}

                <Link href="/talent" className="block">
                  <div className="flex items-center gap-3 p-3 rounded-lg bg-white/5 border border-white/10 hover:border-cyan-500/30 transition-all group">
                    <Users className="h-4 w-4 text-cyan-400" />
                    <span className="text-white text-sm group-hover:text-cyan-400 transition-colors">Search Talent Pool</span>
                  </div>
                </Link>

                <Link href="/pipeline" className="block">
                  <div className="flex items-center gap-3 p-3 rounded-lg bg-white/5 border border-white/10 hover:border-purple-500/30 transition-all group">
                    <Activity className="h-4 w-4 text-purple-400" />
                    <span className="text-white text-sm group-hover:text-purple-400 transition-colors">View Pipeline</span>
                  </div>
                </Link>

                <Link href="/interviews" className="block">
                  <div className="flex items-center gap-3 p-3 rounded-lg bg-white/5 border border-white/10 hover:border-emerald-500/30 transition-all group">
                    <Video className="h-4 w-4 text-emerald-400" />
                    <span className="text-white text-sm group-hover:text-emerald-400 transition-colors">Manage Interviews</span>
                  </div>
                </Link>
              </div>
            </CardContent>
          </Card>

          {/* Activity Feed */}
          <Card className="bg-white/5 backdrop-blur-xl border-white/10">
            <CardContent className="p-6">
              <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                <Activity className="h-5 w-5 text-orange-400" />
                Recent Activity
              </h2>
              <ActivityTimeline activities={activities} loading={loading} />
            </CardContent>
          </Card>
        </motion.div>
      </div>
    </div>
  );
}

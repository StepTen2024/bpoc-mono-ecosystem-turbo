'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import {
  Mail,
  Users,
  Send,
  CheckCircle,
  XCircle,
  TrendingUp,
  FileUp,
  Plus,
  BarChart3,
  Loader2
} from 'lucide-react';

interface Analytics {
  overview: {
    totalContacts: number;
    registeredContacts: number;
    validEmails: number;
    unsubscribed: number;
    totalEmailsSent: number;
    totalCampaigns: number;
    activeCampaigns: number;
    completedCampaigns: number;
  };
  emailStats: {
    totalSent: number;
    totalOpened: number;
    totalClicked: number;
    totalBounced: number;
    totalFailed: number;
    deliveryRate: string;
    openRate: string;
    clickRate: string;
    bounceRate: string;
  };
}

export default function OutboundDashboard() {
  const [analytics, setAnalytics] = useState<Analytics | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchAnalytics();
  }, []);

  const fetchAnalytics = async () => {
    try {
      const response = await fetch('/api/outbound/analytics');
      if (response.ok) {
        const data = await response.json();
        setAnalytics(data);
      }
    } catch (error) {
      console.error('Error fetching analytics:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-96">
        <Loader2 className="h-8 w-8 text-red-500 animate-spin" />
      </div>
    );
  }

  const stats = [
    {
      label: 'Total Contacts',
      value: analytics?.overview.totalContacts.toLocaleString() || '0',
      icon: Users,
      color: 'from-cyan-500 to-blue-500',
    },
    {
      label: 'Valid Emails',
      value: analytics?.overview.validEmails.toLocaleString() || '0',
      icon: CheckCircle,
      color: 'from-green-500 to-emerald-500',
    },
    {
      label: 'Registered',
      value: analytics?.overview.registeredContacts.toLocaleString() || '0',
      icon: Users,
      color: 'from-purple-500 to-pink-500',
    },
    {
      label: 'Emails Sent',
      value: analytics?.overview.totalEmailsSent.toLocaleString() || '0',
      icon: Send,
      color: 'from-orange-500 to-red-500',
    },
  ];

  const campaignStats = [
    {
      label: 'Total Campaigns',
      value: analytics?.overview.totalCampaigns || 0,
      color: 'text-gray-300',
    },
    {
      label: 'Active',
      value: analytics?.overview.activeCampaigns || 0,
      color: 'text-green-400',
    },
    {
      label: 'Completed',
      value: analytics?.overview.completedCampaigns || 0,
      color: 'text-blue-400',
    },
  ];

  const emailMetrics = [
    {
      label: 'Delivery Rate',
      value: `${analytics?.emailStats.deliveryRate || '0'}%`,
      color: 'text-green-400',
    },
    {
      label: 'Open Rate',
      value: `${analytics?.emailStats.openRate || '0'}%`,
      color: 'text-blue-400',
    },
    {
      label: 'Click Rate',
      value: `${analytics?.emailStats.clickRate || '0'}%`,
      color: 'text-purple-400',
    },
    {
      label: 'Bounce Rate',
      value: `${analytics?.emailStats.bounceRate || '0'}%`,
      color: 'text-red-400',
    },
  ];

  const quickActions = [
    {
      label: 'Import CSV',
      href: '/outbound/import',
      icon: FileUp,
      description: 'Import contacts from CSV file',
      color: 'from-cyan-500 to-blue-500',
    },
    {
      label: 'Create Campaign',
      href: '/outbound/campaigns/create',
      icon: Plus,
      description: 'Start a new email campaign',
      color: 'from-orange-500 to-red-500',
    },
    {
      label: 'View Contacts',
      href: '/outbound/contacts',
      icon: Users,
      description: 'Manage contact database',
      color: 'from-purple-500 to-pink-500',
    },
    {
      label: 'Analytics',
      href: '/outbound/analytics',
      icon: BarChart3,
      description: 'View detailed analytics',
      color: 'from-green-500 to-emerald-500',
    },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-white mb-2">Outbound Email Campaigns</h1>
        <p className="text-gray-400">Manage contacts, send campaigns, and track email performance</p>
      </div>

      {/* Main Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map((stat, index) => {
          const Icon = stat.icon;
          return (
            <motion.div
              key={stat.label}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.1 }}
              className="bg-slate-900/50 border border-white/10 rounded-xl p-6 backdrop-blur-sm"
            >
              <div className="flex items-center gap-4">
                <div className={`w-12 h-12 rounded-lg bg-gradient-to-br ${stat.color} flex items-center justify-center`}>
                  <Icon className="h-6 w-6 text-white" />
                </div>
                <div className="flex-1">
                  <p className="text-gray-400 text-sm">{stat.label}</p>
                  <p className="text-2xl font-bold text-white">{stat.value}</p>
                </div>
              </div>
            </motion.div>
          );
        })}
      </div>

      {/* Campaign Stats */}
      <div className="bg-slate-900/50 border border-white/10 rounded-xl p-6 backdrop-blur-sm">
        <h2 className="text-xl font-bold text-white mb-4">Campaign Overview</h2>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
          {campaignStats.map((stat) => (
            <div key={stat.label} className="text-center">
              <p className={`text-3xl font-bold ${stat.color}`}>{stat.value}</p>
              <p className="text-gray-400 text-sm mt-1">{stat.label}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Email Performance Metrics */}
      <div className="bg-slate-900/50 border border-white/10 rounded-xl p-6 backdrop-blur-sm">
        <h2 className="text-xl font-bold text-white mb-4">Email Performance</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
          {emailMetrics.map((metric) => (
            <div key={metric.label} className="text-center">
              <p className={`text-3xl font-bold ${metric.color}`}>{metric.value}</p>
              <p className="text-gray-400 text-sm mt-1">{metric.label}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Quick Actions */}
      <div>
        <h2 className="text-xl font-bold text-white mb-4">Quick Actions</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {quickActions.map((action, index) => {
            const Icon = action.icon;
            return (
              <Link
                key={action.label}
                href={action.href}
                className="group"
              >
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.3 + index * 0.1 }}
                  className="bg-slate-900/50 border border-white/10 rounded-xl p-6 backdrop-blur-sm hover:border-white/20 transition-all"
                >
                  <div className={`w-12 h-12 rounded-lg bg-gradient-to-br ${action.color} flex items-center justify-center mb-4`}>
                    <Icon className="h-6 w-6 text-white" />
                  </div>
                  <h3 className="text-white font-semibold mb-2">{action.label}</h3>
                  <p className="text-gray-400 text-sm">{action.description}</p>
                </motion.div>
              </Link>
            );
          })}
        </div>
      </div>

      {/* Recent Campaigns */}
      <div className="bg-slate-900/50 border border-white/10 rounded-xl p-6 backdrop-blur-sm">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-bold text-white">Recent Campaigns</h2>
          <Link
            href="/admin/outbound/campaigns"
            className="text-red-400 hover:text-red-300 text-sm font-medium"
          >
            View All →
          </Link>
        </div>
        <div className="text-gray-400 text-center py-8">
          No campaigns yet. <Link href="/admin/outbound/campaigns/create" className="text-red-400 hover:text-red-300">Create your first campaign</Link>
        </div>
      </div>
    </div>
  );
}

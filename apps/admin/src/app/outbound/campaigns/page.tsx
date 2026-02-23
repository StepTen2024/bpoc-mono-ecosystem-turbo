'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import {
  Plus,
  Send,
  Pause,
  Play,
  Eye,
  Copy,
  Trash2,
  Loader2,
  Clock,
  CheckCircle,
  AlertCircle,
  Mail
} from 'lucide-react';

interface Campaign {
  id: string;
  name: string;
  subject: string;
  status: string;
  total_recipients: number;
  sent_count: number;
  opened_count: number;
  clicked_count: number;
  failed_count: number;
  scheduled_at: string | null;
  created_at: string;
}

export default function CampaignsPage() {
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('all');

  useEffect(() => {
    fetchCampaigns();
  }, [statusFilter]);

  const fetchCampaigns = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (statusFilter !== 'all') {
        params.append('status', statusFilter);
      }

      const response = await fetch(`/api/outbound/campaigns?${params}`);
      if (response.ok) {
        const data = await response.json();
        setCampaigns(data.campaigns || []);
      }
    } catch (error) {
      console.error('Error fetching campaigns:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSendCampaign = async (campaignId: string) => {
    if (!confirm('Are you sure you want to send this campaign?')) return;

    try {
      const response = await fetch(`/api/outbound/campaigns/${campaignId}/send`, {
        method: 'POST',
      });

      if (response.ok) {
        alert('Campaign sending started!');
        fetchCampaigns();
      } else {
        alert('Failed to send campaign');
      }
    } catch (error) {
      console.error('Error sending campaign:', error);
      alert('Error sending campaign');
    }
  };

  const handlePauseCampaign = async (campaignId: string) => {
    try {
      const response = await fetch(`/api/outbound/campaigns/${campaignId}/pause`, {
        method: 'POST',
      });

      if (response.ok) {
        alert('Campaign paused');
        fetchCampaigns();
      }
    } catch (error) {
      console.error('Error pausing campaign:', error);
    }
  };

  const handleDeleteCampaign = async (campaignId: string) => {
    if (!confirm('Are you sure you want to delete this campaign?')) return;

    try {
      const response = await fetch(`/api/outbound/campaigns/${campaignId}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        fetchCampaigns();
      } else {
        const error = await response.json();
        alert(error.error || 'Failed to delete campaign');
      }
    } catch (error) {
      console.error('Error deleting campaign:', error);
    }
  };

  const getStatusBadge = (status: string) => {
    const configs: Record<string, { label: string; color: string; icon: any }> = {
      draft: { label: 'Draft', color: 'bg-gray-500/20 text-gray-400', icon: AlertCircle },
      scheduled: { label: 'Scheduled', color: 'bg-blue-500/20 text-blue-400', icon: Clock },
      sending: { label: 'Sending', color: 'bg-yellow-500/20 text-yellow-400', icon: Send },
      completed: { label: 'Completed', color: 'bg-green-500/20 text-green-400', icon: CheckCircle },
      paused: { label: 'Paused', color: 'bg-orange-500/20 text-orange-400', icon: Pause },
    };

    const config = configs[status] || configs.draft;
    const Icon = config.icon;

    return (
      <span className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-medium ${config.color}`}>
        <Icon className="h-3 w-3" />
        {config.label}
      </span>
    );
  };

  const formatDate = (dateString: string | null) => {
    if (!dateString) return '—';
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const calculateOpenRate = (opened: number, sent: number) => {
    if (sent === 0) return '—';
    return `${((opened / sent) * 100).toFixed(1)}%`;
  };

  const calculateClickRate = (clicked: number, sent: number) => {
    if (sent === 0) return '—';
    return `${((clicked / sent) * 100).toFixed(1)}%`;
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-white mb-2">Email Campaigns</h1>
          <p className="text-gray-400">{campaigns.length} campaigns total</p>
        </div>
        <Link
          href="/outbound/campaigns/create"
          className="inline-flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-red-500 to-orange-500 hover:from-red-600 hover:to-orange-600 text-white font-semibold rounded-lg transition-all"
        >
          <Plus className="h-5 w-5" />
          Create Campaign
        </Link>
      </div>

      {/* Filters */}
      <div className="bg-slate-900/50 border border-white/10 rounded-xl p-4 backdrop-blur-sm">
        <div className="flex items-center gap-2">
          <span className="text-sm text-gray-400">Filter by status:</span>
          {['all', 'draft', 'scheduled', 'sending', 'completed', 'paused'].map((status) => (
            <button
              key={status}
              onClick={() => setStatusFilter(status)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                statusFilter === status
                  ? 'bg-red-500/20 text-red-400 border border-red-500/30'
                  : 'text-gray-400 hover:text-white hover:bg-white/5'
              }`}
            >
              {status.charAt(0).toUpperCase() + status.slice(1)}
            </button>
          ))}
        </div>
      </div>

      {/* Campaigns Table */}
      <div className="bg-slate-900/50 border border-white/10 rounded-xl backdrop-blur-sm overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 text-red-500 animate-spin" />
          </div>
        ) : campaigns.length === 0 ? (
          <div className="text-center py-12">
            <Mail className="h-12 w-12 text-gray-600 mx-auto mb-4" />
            <p className="text-gray-400 mb-4">No campaigns found</p>
            <Link
              href="/outbound/campaigns/create"
              className="inline-flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-red-500 to-orange-500 hover:from-red-600 hover:to-orange-600 text-white font-semibold rounded-lg transition-all"
            >
              <Plus className="h-5 w-5" />
              Create Your First Campaign
            </Link>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-slate-800/50 border-b border-white/10">
                <tr>
                  <th className="text-left px-6 py-4 text-sm font-medium text-gray-400">Campaign</th>
                  <th className="text-left px-6 py-4 text-sm font-medium text-gray-400">Status</th>
                  <th className="text-left px-6 py-4 text-sm font-medium text-gray-400">Recipients</th>
                  <th className="text-left px-6 py-4 text-sm font-medium text-gray-400">Sent</th>
                  <th className="text-left px-6 py-4 text-sm font-medium text-gray-400">Open Rate</th>
                  <th className="text-left px-6 py-4 text-sm font-medium text-gray-400">Click Rate</th>
                  <th className="text-left px-6 py-4 text-sm font-medium text-gray-400">Scheduled</th>
                  <th className="text-right px-6 py-4 text-sm font-medium text-gray-400">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {campaigns.map((campaign) => (
                  <tr key={campaign.id} className="hover:bg-white/5 transition-colors">
                    <td className="px-6 py-4">
                      <div>
                        <p className="text-white font-medium">{campaign.name}</p>
                        <p className="text-sm text-gray-400 truncate max-w-md">{campaign.subject}</p>
                      </div>
                    </td>
                    <td className="px-6 py-4">{getStatusBadge(campaign.status)}</td>
                    <td className="px-6 py-4">
                      <span className="text-gray-300">{campaign.total_recipients.toLocaleString()}</span>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex flex-col">
                        <span className="text-gray-300">{campaign.sent_count.toLocaleString()}</span>
                        {campaign.failed_count > 0 && (
                          <span className="text-xs text-red-400">
                            {campaign.failed_count} failed
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className="text-gray-300">
                        {calculateOpenRate(campaign.opened_count, campaign.sent_count)}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <span className="text-gray-300">
                        {calculateClickRate(campaign.clicked_count, campaign.sent_count)}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <span className="text-gray-400 text-sm">{formatDate(campaign.scheduled_at)}</span>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center justify-end gap-2">
                        <Link
                          href={`/admin/outbound/campaigns/${campaign.id}`}
                          className="p-2 text-gray-400 hover:text-white hover:bg-white/5 rounded-lg transition-colors"
                          title="View Details"
                        >
                          <Eye className="h-4 w-4" />
                        </Link>

                        {campaign.status === 'draft' && (
                          <button
                            onClick={() => handleSendCampaign(campaign.id)}
                            className="p-2 text-gray-400 hover:text-green-400 hover:bg-green-500/10 rounded-lg transition-colors"
                            title="Send Campaign"
                          >
                            <Send className="h-4 w-4" />
                          </button>
                        )}

                        {campaign.status === 'sending' && (
                          <button
                            onClick={() => handlePauseCampaign(campaign.id)}
                            className="p-2 text-gray-400 hover:text-yellow-400 hover:bg-yellow-500/10 rounded-lg transition-colors"
                            title="Pause Campaign"
                          >
                            <Pause className="h-4 w-4" />
                          </button>
                        )}

                        {campaign.status === 'draft' && (
                          <button
                            onClick={() => handleDeleteCampaign(campaign.id)}
                            className="p-2 text-gray-400 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors"
                            title="Delete"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

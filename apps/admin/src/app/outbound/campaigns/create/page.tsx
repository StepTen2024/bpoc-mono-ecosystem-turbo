'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import {
  Save,
  Send,
  Calendar,
  Loader2,
  Eye,
  AlertCircle
} from 'lucide-react';
import { MIGRATION_TEMPLATE, FOLLOW_UP_TEMPLATE, JOB_ALERT_TEMPLATE } from '@/lib/outbound/email-templates';

export default function CreateCampaignPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  // Form state
  const [name, setName] = useState('');
  const [subject, setSubject] = useState('');
  const [templateType, setTemplateType] = useState<'migration' | 'follow_up' | 'job_alert' | 'custom'>('migration');
  const [emailHtml, setEmailHtml] = useState(MIGRATION_TEMPLATE);
  const [fromName, setFromName] = useState('BPOC Team');
  const [fromEmail, setFromEmail] = useState('team@bpoc.com');
  const [replyTo, setReplyTo] = useState('');
  const [batchSize, setBatchSize] = useState(50);
  const [delayBetweenBatches, setDelayBetweenBatches] = useState(5000);
  const [scheduledAt, setScheduledAt] = useState('');

  // Target filters
  const [filterRegistered, setFilterRegistered] = useState<'all' | 'true' | 'false'>('false');
  const [filterEmailValid, setFilterEmailValid] = useState(true);
  const [filterUnsubscribed, setFilterUnsubscribed] = useState(false);

  const handleTemplateChange = (type: 'migration' | 'follow_up' | 'job_alert' | 'custom') => {
    setTemplateType(type);

    switch (type) {
      case 'migration':
        setEmailHtml(MIGRATION_TEMPLATE);
        setSubject('🎉 Your BPOC Account is Ready - Join Thousands of BPO Professionals');
        break;
      case 'follow_up':
        setEmailHtml(FOLLOW_UP_TEMPLATE);
        setSubject("⏰ Don't Miss Out - Activate Your BPOC Account");
        break;
      case 'job_alert':
        setEmailHtml(JOB_ALERT_TEMPLATE);
        setSubject('🎯 New Jobs Match Your Profile');
        break;
      case 'custom':
        setEmailHtml('');
        setSubject('');
        break;
    }
  };

  const handleSubmit = async (action: 'draft' | 'schedule' | 'send') => {
    if (!name || !subject || !emailHtml) {
      alert('Please fill in all required fields');
      return;
    }

    setLoading(true);

    try {
      const targetFilters: any = {
        email_valid: filterEmailValid,
        unsubscribed: filterUnsubscribed,
      };

      if (filterRegistered !== 'all') {
        targetFilters.is_registered = filterRegistered === 'true';
      }

      const payload = {
        name,
        subject,
        template_type: templateType,
        email_html: emailHtml,
        from_name: fromName,
        from_email: fromEmail,
        reply_to: replyTo || undefined,
        batch_size: batchSize,
        delay_between_batches: delayBetweenBatches,
        scheduled_at: action === 'schedule' && scheduledAt ? new Date(scheduledAt).toISOString() : undefined,
        target_filters: targetFilters,
      };

      const response = await fetch('/api/outbound/campaigns', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to create campaign');
      }

      const data = await response.json();
      const campaignId = data.campaign.id;

      // If action is 'send', immediately trigger sending
      if (action === 'send') {
        const sendResponse = await fetch(`/api/outbound/campaigns/${campaignId}/send`, {
          method: 'POST',
        });

        if (!sendResponse.ok) {
          alert('Campaign created but failed to send. You can send it from the campaigns list.');
        }
      }

      alert(
        action === 'send'
          ? 'Campaign created and sending started!'
          : action === 'schedule'
          ? 'Campaign scheduled successfully!'
          : 'Campaign saved as draft!'
      );

      router.push('/outbound/campaigns');
    } catch (error: any) {
      console.error('Error creating campaign:', error);
      alert(error.message || 'Failed to create campaign');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-white mb-2">Create Email Campaign</h1>
        <p className="text-gray-400">Design and send email campaigns to your contacts</p>
      </div>

      {/* Campaign Details */}
      <div className="bg-slate-900/50 border border-white/10 rounded-xl p-6 backdrop-blur-sm space-y-4">
        <h2 className="text-xl font-semibold text-white">Campaign Details</h2>

        <div>
          <label className="block text-sm font-medium text-gray-400 mb-2">Campaign Name *</label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g., Migration Wave 1"
            className="w-full px-4 py-3 bg-slate-800 border border-white/10 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-red-500"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-400 mb-2">Subject Line *</label>
          <input
            type="text"
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            placeholder="Email subject line"
            className="w-full px-4 py-3 bg-slate-800 border border-white/10 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-red-500"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-400 mb-2">Email Template</label>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {[
              { value: 'migration', label: 'Migration' },
              { value: 'follow_up', label: 'Follow-Up' },
              { value: 'job_alert', label: 'Job Alert' },
              { value: 'custom', label: 'Custom' },
            ].map((template) => (
              <button
                key={template.value}
                onClick={() => handleTemplateChange(template.value as any)}
                className={`px-4 py-3 rounded-lg border font-medium transition-all ${
                  templateType === template.value
                    ? 'bg-red-500/20 border-red-500/50 text-red-400'
                    : 'bg-slate-800 border-white/10 text-gray-300 hover:border-white/20'
                }`}
              >
                {template.label}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-400 mb-2">Email Content (HTML) *</label>
          <textarea
            value={emailHtml}
            onChange={(e) => setEmailHtml(e.target.value)}
            rows={10}
            placeholder="Enter HTML email content..."
            className="w-full px-4 py-3 bg-slate-800 border border-white/10 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-red-500 font-mono text-sm"
          />
          <p className="text-xs text-gray-500 mt-1">
            Available variables: {'{'}firstName{'}'}, {'{'}lastName{'}'}, {'{'}email{'}'}, {'{'}phoneNumber{'}'}
          </p>
        </div>
      </div>

      {/* Sender Details */}
      <div className="bg-slate-900/50 border border-white/10 rounded-xl p-6 backdrop-blur-sm space-y-4">
        <h2 className="text-xl font-semibold text-white">Sender Details</h2>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-400 mb-2">From Name</label>
            <input
              type="text"
              value={fromName}
              onChange={(e) => setFromName(e.target.value)}
              className="w-full px-4 py-3 bg-slate-800 border border-white/10 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-red-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-400 mb-2">From Email</label>
            <input
              type="email"
              value={fromEmail}
              onChange={(e) => setFromEmail(e.target.value)}
              className="w-full px-4 py-3 bg-slate-800 border border-white/10 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-red-500"
            />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-400 mb-2">Reply-To Email (Optional)</label>
          <input
            type="email"
            value={replyTo}
            onChange={(e) => setReplyTo(e.target.value)}
            placeholder="support@bpoc.com"
            className="w-full px-4 py-3 bg-slate-800 border border-white/10 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-red-500"
          />
        </div>
      </div>

      {/* Target Filters */}
      <div className="bg-slate-900/50 border border-white/10 rounded-xl p-6 backdrop-blur-sm space-y-4">
        <h2 className="text-xl font-semibold text-white">Target Audience</h2>

        <div>
          <label className="block text-sm font-medium text-gray-400 mb-2">Registration Status</label>
          <select
            value={filterRegistered}
            onChange={(e) => setFilterRegistered(e.target.value as any)}
            className="w-full px-4 py-3 bg-slate-800 border border-white/10 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-red-500"
          >
            <option value="all">All Contacts</option>
            <option value="true">Registered Only</option>
            <option value="false">Not Registered Only</option>
          </select>
        </div>

        <div className="flex items-center gap-4">
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={filterEmailValid}
              onChange={(e) => setFilterEmailValid(e.target.checked)}
              className="w-5 h-5 rounded border-white/20 bg-slate-800 text-red-500 focus:ring-red-500"
            />
            <span className="text-gray-300">Only valid emails</span>
          </label>

          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={!filterUnsubscribed}
              onChange={(e) => setFilterUnsubscribed(!e.target.checked)}
              className="w-5 h-5 rounded border-white/20 bg-slate-800 text-red-500 focus:ring-red-500"
            />
            <span className="text-gray-300">Exclude unsubscribed</span>
          </label>
        </div>

        <div className="p-4 bg-blue-500/10 border border-blue-500/20 rounded-lg">
          <p className="text-sm text-blue-400 flex items-center gap-2">
            <AlertCircle className="h-4 w-4" />
            Estimated recipients will be calculated when campaign is created
          </p>
        </div>
      </div>

      {/* Sending Settings */}
      <div className="bg-slate-900/50 border border-white/10 rounded-xl p-6 backdrop-blur-sm space-y-4">
        <h2 className="text-xl font-semibold text-white">Sending Settings</h2>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-400 mb-2">Batch Size</label>
            <input
              type="number"
              value={batchSize}
              onChange={(e) => setBatchSize(parseInt(e.target.value))}
              min={10}
              max={100}
              className="w-full px-4 py-3 bg-slate-800 border border-white/10 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-red-500"
            />
            <p className="text-xs text-gray-500 mt-1">Emails per batch (10-100)</p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-400 mb-2">Delay Between Batches (ms)</label>
            <input
              type="number"
              value={delayBetweenBatches}
              onChange={(e) => setDelayBetweenBatches(parseInt(e.target.value))}
              min={1000}
              max={30000}
              step={1000}
              className="w-full px-4 py-3 bg-slate-800 border border-white/10 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-red-500"
            />
            <p className="text-xs text-gray-500 mt-1">Milliseconds (1000-30000)</p>
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-400 mb-2">Schedule For Later (Optional)</label>
          <input
            type="datetime-local"
            value={scheduledAt}
            onChange={(e) => setScheduledAt(e.target.value)}
            className="w-full px-4 py-3 bg-slate-800 border border-white/10 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-red-500"
          />
        </div>
      </div>

      {/* Actions */}
      <div className="flex gap-4">
        <button
          onClick={() => router.push('/outbound/campaigns')}
          className="px-6 py-3 bg-slate-800 hover:bg-slate-700 text-white rounded-lg transition-colors"
          disabled={loading}
        >
          Cancel
        </button>

        <button
          onClick={() => handleSubmit('draft')}
          disabled={loading}
          className="flex items-center gap-2 px-6 py-3 bg-slate-700 hover:bg-slate-600 text-white rounded-lg transition-colors disabled:opacity-50"
        >
          {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : <Save className="h-5 w-5" />}
          Save as Draft
        </button>

        {scheduledAt && (
          <button
            onClick={() => handleSubmit('schedule')}
            disabled={loading}
            className="flex items-center gap-2 px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors disabled:opacity-50"
          >
            {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : <Calendar className="h-5 w-5" />}
            Schedule Campaign
          </button>
        )}

        <button
          onClick={() => handleSubmit('send')}
          disabled={loading}
          className="flex-1 flex items-center justify-center gap-2 px-6 py-3 bg-gradient-to-r from-red-500 to-orange-500 hover:from-red-600 hover:to-orange-600 text-white font-semibold rounded-lg transition-all disabled:opacity-50"
        >
          {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : <Send className="h-5 w-5" />}
          Send Campaign Now
        </button>
      </div>
    </div>
  );
}

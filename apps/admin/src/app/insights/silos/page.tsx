'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/shared/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/shared/ui/card';
import { Badge } from '@/components/shared/ui/badge';
import { Input } from '@/components/shared/ui/input';
import { Textarea } from '@/components/shared/ui/textarea';
import {
  Plus, Edit, Trash2, Eye, Loader2, X, Save,
  GripVertical, FileText, CheckCircle, XCircle,
  ArrowLeft, Palette, Link2, Search as SearchIcon
} from 'lucide-react';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';

interface Silo {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  context: string | null;
  voice: string | null;
  subreddits: string | null;
  platforms: string | null;
  icon: string | null;
  color: string | null;
  hero_image: string | null;
  seo_title: string | null;
  seo_description: string | null;
  seo_keywords: string | null;
  is_active: boolean;
  sort_order: number;
  created_at: string;
  updated_at: string;
  article_count?: number;
}

const ICON_OPTIONS = [
  'DollarSign', 'TrendingUp', 'Briefcase', 'MessageSquare',
  'FileText', 'Building2', 'GraduationCap', 'Heart',
  'Star', 'Lightbulb', 'Target', 'Users', 'Globe', 'Award'
];

const COLOR_OPTIONS = [
  '#10B981', '#3B82F6', '#8B5CF6', '#F59E0B',
  '#EF4444', '#06B6D4', '#EC4899', '#14B8A6',
  '#6366F1', '#84CC16', '#F97316', '#0EA5E9'
];

export default function SilosAdminPage() {
  const [silos, setSilos] = useState<Silo[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingSilo, setEditingSilo] = useState<Silo | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<Silo | null>(null);
  const [formData, setFormData] = useState<Partial<Silo>>({});
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const fetchSilos = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/silos?includeCount=true');
      const data = await res.json();
      if (data.silos) {
        setSilos(data.silos);
      }
    } catch (error) {
      console.error('Error fetching silos:', error);
      setMessage({ type: 'error', text: 'Failed to load silos' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSilos();
  }, []);

  const showMessage = (type: 'success' | 'error', text: string) => {
    setMessage({ type, text });
    setTimeout(() => setMessage(null), 4000);
  };

  const openCreateModal = () => {
    setFormData({
      name: '',
      slug: '',
      description: '',
      context: '',
      voice: '',
      subreddits: '',
      platforms: '',
      icon: 'FileText',
      color: '#3B82F6',
      hero_image: '',
      seo_title: '',
      seo_description: '',
      seo_keywords: '',
      is_active: true,
      sort_order: silos.length + 1,
    });
    setIsCreating(true);
    setEditingSilo(null);
  };

  const openEditModal = (silo: Silo) => {
    setFormData({ ...silo });
    setEditingSilo(silo);
    setIsCreating(false);
  };

  const closeModal = () => {
    setEditingSilo(null);
    setIsCreating(false);
    setFormData({});
  };

  const generateSlug = (name: string) => {
    return name.toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '');
  };

  const handleNameChange = (name: string) => {
    const updates: Partial<Silo> = { name };
    if (isCreating && !formData.slug) {
      updates.slug = generateSlug(name);
    }
    setFormData(prev => ({ ...prev, ...updates }));
  };

  const handleSave = async () => {
    if (!formData.name || !formData.slug) {
      showMessage('error', 'Name and slug are required');
      return;
    }

    setSaving(true);
    try {
      const url = isCreating
        ? '/api/silos'
        : `/api/silos/${editingSilo?.id}`;

      const method = isCreating ? 'POST' : 'PUT';

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });

      const data = await res.json();

      if (!res.ok || data.error) {
        showMessage('error', data.error || 'Failed to save silo');
        return;
      }

      showMessage('success', isCreating ? 'Silo created!' : 'Silo updated!');
      closeModal();
      fetchSilos();
    } catch (error: any) {
      showMessage('error', error.message || 'Failed to save silo');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteConfirm) return;

    setSaving(true);
    try {
      const res = await fetch(`/api/silos/${deleteConfirm.id}`, {
        method: 'DELETE',
      });

      const data = await res.json();

      if (!res.ok || data.error) {
        if (data.article_count) {
          showMessage('error', `Cannot delete: ${data.article_count} articles use this silo`);
        } else {
          showMessage('error', data.error || 'Failed to delete silo');
        }
        return;
      }

      showMessage('success', 'Silo deleted');
      setDeleteConfirm(null);
      fetchSilos();
    } catch (error: any) {
      showMessage('error', error.message || 'Failed to delete silo');
    } finally {
      setSaving(false);
    }
  };

  const toggleActive = async (silo: Silo) => {
    try {
      const res = await fetch(`/api/silos/${silo.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_active: !silo.is_active }),
      });

      if (res.ok) {
        fetchSilos();
        showMessage('success', silo.is_active ? 'Silo deactivated' : 'Silo activated');
      }
    } catch (error) {
      showMessage('error', 'Failed to update silo');
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div className="flex items-center gap-4">
          <Link href="/insights">
            <Button variant="ghost" size="sm" className="text-gray-400 hover:text-white">
              <ArrowLeft className="w-4 h-4 mr-2" /> Back
            </Button>
          </Link>
          <div>
            <h1 className="text-3xl font-bold gradient-text">Content Silos</h1>
            <p className="text-gray-400">Manage your content categories and topic clusters.</p>
          </div>
        </div>
        <Button
          onClick={openCreateModal}
          className="bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500"
        >
          <Plus className="w-4 h-4 mr-2" /> New Silo
        </Button>
      </div>

      {/* Message */}
      <AnimatePresence>
        {message && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className={`p-4 rounded-lg border ${
              message.type === 'success'
                ? 'bg-green-500/10 border-green-500/30 text-green-400'
                : 'bg-red-500/10 border-red-500/30 text-red-400'
            }`}
          >
            {message.type === 'success' ? <CheckCircle className="w-4 h-4 inline mr-2" /> : <XCircle className="w-4 h-4 inline mr-2" />}
            {message.text}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="rounded-2xl bg-gradient-to-br from-slate-800/80 to-slate-900/80 border border-slate-700/50 p-5">
          <p className="text-slate-400 text-xs font-medium tracking-wider uppercase mb-1">Total Silos</p>
          <p className="text-3xl font-bold text-white">{silos.length}</p>
        </div>
        <div className="rounded-2xl bg-gradient-to-br from-emerald-950/80 to-emerald-900/40 border border-emerald-800/50 p-5">
          <p className="text-emerald-400/80 text-xs font-medium tracking-wider uppercase mb-1">Active</p>
          <p className="text-3xl font-bold text-emerald-400">{silos.filter(s => s.is_active).length}</p>
        </div>
        <div className="rounded-2xl bg-gradient-to-br from-amber-950/80 to-amber-900/40 border border-amber-800/50 p-5">
          <p className="text-amber-400/80 text-xs font-medium tracking-wider uppercase mb-1">Inactive</p>
          <p className="text-3xl font-bold text-amber-400">{silos.filter(s => !s.is_active).length}</p>
        </div>
        <div className="rounded-2xl bg-gradient-to-br from-cyan-950/80 to-cyan-900/40 border border-cyan-800/50 p-5">
          <p className="text-cyan-400/80 text-xs font-medium tracking-wider uppercase mb-1">Total Articles</p>
          <p className="text-3xl font-bold text-cyan-400">{silos.reduce((sum, s) => sum + (s.article_count || 0), 0)}</p>
        </div>
      </div>

      {/* Silos List */}
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-8 h-8 animate-spin text-cyan-400" />
          <span className="ml-3 text-gray-400">Loading silos...</span>
        </div>
      ) : silos.length === 0 ? (
        <div className="text-center py-20 text-gray-400">
          <FileText className="w-16 h-16 mx-auto mb-4 opacity-20" />
          <p className="text-lg">No silos yet</p>
          <p className="text-sm mt-1">Create your first content silo to get started</p>
        </div>
      ) : (
        <div className="space-y-3">
          {silos.map((silo, index) => (
            <motion.div
              key={silo.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.05 }}
              className={`group relative rounded-xl border transition-all duration-300 overflow-hidden ${
                silo.is_active
                  ? 'bg-gradient-to-r from-slate-900/80 to-slate-900/80 border-slate-700/50 hover:border-slate-600/50'
                  : 'bg-gradient-to-r from-slate-900/50 to-slate-900/50 border-slate-800/50 opacity-60'
              }`}
            >
              {/* Color indicator */}
              <div
                className="absolute left-0 top-0 bottom-0 w-1"
                style={{ backgroundColor: silo.color || '#3B82F6' }}
              />

              <div className="p-5 pl-6 flex items-center justify-between">
                <div className="flex items-center gap-4 flex-1 min-w-0">
                  {/* Icon */}
                  <div
                    className="w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0"
                    style={{ backgroundColor: `${silo.color}20` || '#3B82F620' }}
                  >
                    <span className="text-2xl" style={{ color: silo.color || '#3B82F6' }}>
                      {silo.icon === 'DollarSign' && '$'}
                      {silo.icon === 'TrendingUp' && '📈'}
                      {silo.icon === 'Briefcase' && '💼'}
                      {silo.icon === 'MessageSquare' && '💬'}
                      {silo.icon === 'FileText' && '📄'}
                      {silo.icon === 'Building2' && '🏢'}
                      {silo.icon === 'GraduationCap' && '🎓'}
                      {silo.icon === 'Heart' && '❤️'}
                      {!silo.icon && '📁'}
                    </span>
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="text-white font-semibold text-lg truncate">{silo.name}</h3>
                      <Badge
                        className={`text-[10px] ${
                          silo.is_active
                            ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30'
                            : 'bg-slate-500/20 text-slate-400 border-slate-500/30'
                        }`}
                      >
                        {silo.is_active ? 'Active' : 'Inactive'}
                      </Badge>
                      <Badge variant="outline" className="border-slate-700 text-slate-400 text-[10px]">
                        {silo.article_count || 0} articles
                      </Badge>
                    </div>
                    <p className="text-slate-500 text-sm truncate">{silo.description || `/${silo.slug}`}</p>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-1">
                  <Link href={`/insights/silo/${silo.slug}`} target="_blank">
                    <Button size="sm" variant="ghost" className="h-9 w-9 p-0 text-slate-400 hover:text-white hover:bg-white/10">
                      <Eye className="w-4 h-4" />
                    </Button>
                  </Link>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => openEditModal(silo)}
                    className="h-9 w-9 p-0 text-cyan-400 hover:text-cyan-300 hover:bg-cyan-500/10"
                  >
                    <Edit className="w-4 h-4" />
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => toggleActive(silo)}
                    className={`h-9 px-3 ${
                      silo.is_active
                        ? 'text-amber-400 hover:text-amber-300 hover:bg-amber-500/10'
                        : 'text-emerald-400 hover:text-emerald-300 hover:bg-emerald-500/10'
                    }`}
                  >
                    {silo.is_active ? <XCircle className="w-4 h-4 mr-1" /> : <CheckCircle className="w-4 h-4 mr-1" />}
                    {silo.is_active ? 'Deactivate' : 'Activate'}
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => setDeleteConfirm(silo)}
                    className="h-9 w-9 p-0 text-red-400 hover:text-red-300 hover:bg-red-500/10"
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      )}

      {/* Create/Edit Modal */}
      <AnimatePresence>
        {(isCreating || editingSilo) && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-black/80 backdrop-blur-sm"
              onClick={closeModal}
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="relative bg-gradient-to-br from-gray-900 via-gray-900 to-slate-900 border border-slate-700/50 rounded-2xl p-6 max-w-2xl w-full max-h-[90vh] overflow-y-auto shadow-2xl"
            >
              {/* Header */}
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-bold text-white">
                  {isCreating ? 'Create New Silo' : 'Edit Silo'}
                </h2>
                <button onClick={closeModal} className="text-gray-500 hover:text-white transition-colors">
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Form */}
              <div className="space-y-5">
                {/* Basic Info */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm font-medium text-gray-400 mb-2 block">Name *</label>
                    <Input
                      value={formData.name || ''}
                      onChange={(e) => handleNameChange(e.target.value)}
                      placeholder="e.g., Salary & Compensation"
                      className="bg-white/5 border-white/10 text-white"
                    />
                  </div>
                  <div>
                    <label className="text-sm font-medium text-gray-400 mb-2 block">Slug *</label>
                    <Input
                      value={formData.slug || ''}
                      onChange={(e) => setFormData(prev => ({ ...prev, slug: e.target.value }))}
                      placeholder="e.g., salary"
                      className="bg-white/5 border-white/10 text-white"
                    />
                  </div>
                </div>

                <div>
                  <label className="text-sm font-medium text-gray-400 mb-2 block">Description</label>
                  <Textarea
                    value={formData.description || ''}
                    onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                    placeholder="Brief description of this content silo..."
                    className="bg-white/5 border-white/10 text-white min-h-[80px]"
                  />
                </div>

                {/* Visual */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm font-medium text-gray-400 mb-2 block">Icon</label>
                    <div className="flex flex-wrap gap-2">
                      {ICON_OPTIONS.map((icon) => (
                        <button
                          key={icon}
                          onClick={() => setFormData(prev => ({ ...prev, icon }))}
                          className={`w-10 h-10 rounded-lg flex items-center justify-center transition-all ${
                            formData.icon === icon
                              ? 'bg-cyan-500/20 border-2 border-cyan-500'
                              : 'bg-white/5 border border-white/10 hover:border-white/30'
                          }`}
                        >
                          <span className="text-lg">
                            {icon === 'DollarSign' && '$'}
                            {icon === 'TrendingUp' && '📈'}
                            {icon === 'Briefcase' && '💼'}
                            {icon === 'MessageSquare' && '💬'}
                            {icon === 'FileText' && '📄'}
                            {icon === 'Building2' && '🏢'}
                            {icon === 'GraduationCap' && '🎓'}
                            {icon === 'Heart' && '❤️'}
                            {icon === 'Star' && '⭐'}
                            {icon === 'Lightbulb' && '💡'}
                            {icon === 'Target' && '🎯'}
                            {icon === 'Users' && '👥'}
                            {icon === 'Globe' && '🌐'}
                            {icon === 'Award' && '🏆'}
                          </span>
                        </button>
                      ))}
                    </div>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-gray-400 mb-2 block">Color</label>
                    <div className="flex flex-wrap gap-2">
                      {COLOR_OPTIONS.map((color) => (
                        <button
                          key={color}
                          onClick={() => setFormData(prev => ({ ...prev, color }))}
                          className={`w-10 h-10 rounded-lg transition-all ${
                            formData.color === color
                              ? 'ring-2 ring-white ring-offset-2 ring-offset-gray-900'
                              : 'hover:scale-110'
                          }`}
                          style={{ backgroundColor: color }}
                        />
                      ))}
                    </div>
                  </div>
                </div>

                {/* AI Context */}
                <div className="pt-4 border-t border-white/10">
                  <h3 className="text-white font-medium mb-4">AI Content Generation Context</h3>
                  <div className="space-y-4">
                    <div>
                      <label className="text-sm font-medium text-gray-400 mb-2 block">Topic Context</label>
                      <Textarea
                        value={formData.context || ''}
                        onChange={(e) => setFormData(prev => ({ ...prev, context: e.target.value }))}
                        placeholder="e.g., salary negotiations, pay scales, compensation packages, benefits, bonuses"
                        className="bg-white/5 border-white/10 text-white min-h-[60px]"
                      />
                      <p className="text-xs text-gray-500 mt-1">Keywords and topics for AI to focus on</p>
                    </div>
                    <div>
                      <label className="text-sm font-medium text-gray-400 mb-2 block">Subreddits for Research</label>
                      <Input
                        value={formData.subreddits || ''}
                        onChange={(e) => setFormData(prev => ({ ...prev, subreddits: e.target.value }))}
                        placeholder="e.g., r/jobs, r/careeradvice, r/Philippines"
                        className="bg-white/5 border-white/10 text-white"
                      />
                    </div>
                    <div>
                      <label className="text-sm font-medium text-gray-400 mb-2 block">Other Platforms</label>
                      <Input
                        value={formData.platforms || ''}
                        onChange={(e) => setFormData(prev => ({ ...prev, platforms: e.target.value }))}
                        placeholder="e.g., LinkedIn salary posts, Glassdoor discussions"
                        className="bg-white/5 border-white/10 text-white"
                      />
                    </div>
                  </div>
                </div>

                {/* SEO */}
                <div className="pt-4 border-t border-white/10">
                  <h3 className="text-white font-medium mb-4">SEO for Silo Page</h3>
                  <div className="space-y-4">
                    <div>
                      <label className="text-sm font-medium text-gray-400 mb-2 block">SEO Title</label>
                      <Input
                        value={formData.seo_title || ''}
                        onChange={(e) => setFormData(prev => ({ ...prev, seo_title: e.target.value }))}
                        placeholder="e.g., BPO Salary & Compensation Guide | ShoreAgents"
                        maxLength={70}
                        className="bg-white/5 border-white/10 text-white"
                      />
                      <p className="text-xs text-gray-500 mt-1">{(formData.seo_title || '').length}/70 characters</p>
                    </div>
                    <div>
                      <label className="text-sm font-medium text-gray-400 mb-2 block">Meta Description</label>
                      <Textarea
                        value={formData.seo_description || ''}
                        onChange={(e) => setFormData(prev => ({ ...prev, seo_description: e.target.value }))}
                        placeholder="Meta description for search results..."
                        maxLength={160}
                        className="bg-white/5 border-white/10 text-white min-h-[60px]"
                      />
                      <p className="text-xs text-gray-500 mt-1">{(formData.seo_description || '').length}/160 characters</p>
                    </div>
                    <div>
                      <label className="text-sm font-medium text-gray-400 mb-2 block">Keywords</label>
                      <Input
                        value={formData.seo_keywords || ''}
                        onChange={(e) => setFormData(prev => ({ ...prev, seo_keywords: e.target.value }))}
                        placeholder="keyword1, keyword2, keyword3"
                        className="bg-white/5 border-white/10 text-white"
                      />
                    </div>
                  </div>
                </div>

                {/* Settings */}
                <div className="pt-4 border-t border-white/10">
                  <div className="flex items-center gap-4">
                    <div className="flex-1">
                      <label className="text-sm font-medium text-gray-400 mb-2 block">Sort Order</label>
                      <Input
                        type="number"
                        value={formData.sort_order || 0}
                        onChange={(e) => setFormData(prev => ({ ...prev, sort_order: parseInt(e.target.value) || 0 }))}
                        className="bg-white/5 border-white/10 text-white w-24"
                      />
                    </div>
                    <div className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        id="is_active"
                        checked={formData.is_active ?? true}
                        onChange={(e) => setFormData(prev => ({ ...prev, is_active: e.target.checked }))}
                        className="w-4 h-4 rounded border-gray-600 bg-gray-700 text-cyan-500 focus:ring-cyan-500"
                      />
                      <label htmlFor="is_active" className="text-sm text-gray-400">Active</label>
                    </div>
                  </div>
                </div>
              </div>

              {/* Actions */}
              <div className="flex gap-3 mt-6 pt-4 border-t border-white/10">
                <Button
                  variant="outline"
                  onClick={closeModal}
                  className="flex-1 border-white/20 hover:bg-white/5"
                >
                  Cancel
                </Button>
                <Button
                  onClick={handleSave}
                  disabled={saving}
                  className="flex-1 bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500"
                >
                  {saving ? (
                    <Loader2 className="w-4 h-4 animate-spin mr-2" />
                  ) : (
                    <Save className="w-4 h-4 mr-2" />
                  )}
                  {isCreating ? 'Create Silo' : 'Save Changes'}
                </Button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Delete Confirmation Modal */}
      <AnimatePresence>
        {deleteConfirm && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-black/80 backdrop-blur-sm"
              onClick={() => setDeleteConfirm(null)}
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="relative bg-gradient-to-br from-gray-900 via-gray-900 to-red-950/30 border border-red-500/30 rounded-2xl p-6 max-w-md w-full shadow-2xl"
            >
              <div className="text-center mb-6">
                <div className="w-16 h-16 rounded-full bg-red-500/20 border border-red-500/30 flex items-center justify-center mx-auto mb-4">
                  <Trash2 className="w-8 h-8 text-red-400" />
                </div>
                <h3 className="text-xl font-bold text-white mb-2">Delete Silo?</h3>
                <p className="text-gray-400">
                  Are you sure you want to delete "{deleteConfirm.name}"?
                  {deleteConfirm.article_count && deleteConfirm.article_count > 0 && (
                    <span className="block text-amber-400 mt-2">
                      Warning: This silo has {deleteConfirm.article_count} articles attached.
                    </span>
                  )}
                </p>
              </div>
              <div className="flex gap-3">
                <Button
                  variant="outline"
                  onClick={() => setDeleteConfirm(null)}
                  className="flex-1 border-white/20 hover:bg-white/5"
                >
                  Cancel
                </Button>
                <Button
                  onClick={handleDelete}
                  disabled={saving}
                  className="flex-1 bg-red-600 hover:bg-red-700 text-white border-0"
                >
                  {saving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Trash2 className="w-4 h-4 mr-2" />}
                  Delete
                </Button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}

'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { Button } from '@/components/shared/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/shared/ui/card';
import { Badge } from '@/components/shared/ui/badge';
import { Plus, Edit, Trash2, Eye, FileText, BarChart2, Activity, Search, Zap, Loader2, CheckCircle, XCircle, TrendingUp, AlertTriangle, X, AlertOctagon, FolderTree, Crown, Newspaper, Wrench } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { format } from 'date-fns';

interface Silo {
  id: string;
  name: string;
  slug: string;
  icon: string | null;
  color: string | null;
}
import SiloVisualization from '@/components/admin/insights/SiloVisualization';
import SEODashboard from '@/components/admin/insights/SEODashboard';
import OutboundResearch from '@/components/admin/insights/OutboundResearch';
import NoHandsEngine from '@/components/admin/insights/NoHandsEngine';
import CleanupEngine from '@/components/admin/insights/CleanupEngine';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/shared/ui/tabs';

export default function InsightsAdminPage() {
  const [posts, setPosts] = useState<any[]>([]);
  const [silos, setSilos] = useState<Silo[]>([]);
  const [loading, setLoading] = useState(true);
  const [isCreatingPost, setIsCreatingPost] = useState(false);
  const [publishedTab, setPublishedTab] = useState<'silo' | 'articles'>('silo');
  const [draftsTab, setDraftsTab] = useState<'silo' | 'articles'>('silo');
  const [activeFilter, setActiveFilter] = useState<string | null>(null);
  const router = useRouter();

  const fetchSilos = async () => {
    try {
      const res = await fetch('/api/silos');
      const data = await res.json();
      if (data.silos) {
        setSilos(data.silos);
      }
    } catch (error) {
      console.error('Error fetching silos:', error);
    }
  };

  // Helper to get silo info by slug (silo_topic)
  const getSiloBySlug = (siloSlug: string | null) => {
    if (!siloSlug) return null;
    return silos.find(s => s.slug === siloSlug);
  };

  const fetchPosts = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('insights_posts')
      .select(`
        id, slug, title, description, category, is_published, created_at, read_time,
        hero_url, video_url, hero_type,
        content_part1, content_part2, content_part3,
        content_image0, content_image1, content_image2,
        pipeline_stage,
        silo_id,
        silo_topic,
        is_pillar,
        seo:seo_metadata(meta_title, keywords)
      `)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching posts:', error);
    } else {
      setPosts(data || []);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchPosts();
    fetchSilos();
  }, []);

  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [actionMessage, setActionMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<{ id: string; title: string } | null>(null);
  const [publishValidation, setPublishValidation] = useState<{ post: any; issues: { label: string; status: boolean }[] } | null>(null);

  // Validate if article is ready to publish
  const validateForPublish = (post: any): { isValid: boolean; issues: { label: string; status: boolean }[] } => {
    const issues: { label: string; status: boolean }[] = [];

    // 1. Title
    issues.push({
      label: 'Article title',
      status: !!post.title && post.title.length > 5 && !post.title.toLowerCase().includes('untitled')
    });

    // 2. Content sections
    issues.push({
      label: 'Content Section 1',
      status: !!post.content_part1 && post.content_part1.length > 100
    });
    issues.push({
      label: 'Content Section 2',
      status: !!post.content_part2 && post.content_part2.length > 100
    });
    issues.push({
      label: 'Content Section 3',
      status: !!post.content_part3 && post.content_part3.length > 100
    });

    // 3. Hero media (image or video)
    issues.push({
      label: 'Hero media (image or video)',
      status: !!post.hero_url || !!post.video_url
    });

    // 4. Meta description
    issues.push({
      label: 'Meta description',
      status: !!post.description && post.description.length > 50
    });

    // 5. Category/Silo
    issues.push({
      label: 'Category assigned',
      status: !!post.category
    });

    // 6. Pipeline stage check - should be at ready/meta stage or later
    const completedStages = ['ready', 'meta', 'published', 'seo'];
    const isStageComplete = !post.pipeline_stage || completedStages.includes(post.pipeline_stage);
    issues.push({
      label: 'Pipeline stages completed',
      status: isStageComplete
    });

    const isValid = issues.every(i => i.status);
    return { isValid, issues };
  };

  // Attempt to publish with validation
  const attemptPublish = (post: any) => {
    const validation = validateForPublish(post);
    if (validation.isValid) {
      handleAction(post.id, 'publish');
    } else {
      setPublishValidation({ post, issues: validation.issues });
    }
  };

  const handleAction = async (id: string, action: 'publish' | 'unpublish' | 'delete') => {
    setActionLoading(id);
    setActionMessage(null);

    try {
      const res = await fetch('/api/insights/publish', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, action })
      });

      const data = await res.json();

      if (!res.ok || data.error) {
        console.error('❌ Action failed:', data.error);
        setActionMessage({ type: 'error', text: data.error || 'Action failed' });
        return;
      }

      console.log('✅ Action success:', data.message);
      setActionMessage({ type: 'success', text: data.message });

      fetchPosts();

      // Clear message after 3 seconds
      setTimeout(() => setActionMessage(null), 3000);

    } catch (error: any) {
      console.error('❌ Action error:', error);
      setActionMessage({ type: 'error', text: error.message || 'Network error' });
    } finally {
      setActionLoading(null);
    }
  };

  const handleDelete = (post: any) => {
    setDeleteConfirm({ id: post.id, title: post.title });
  };
  const confirmDelete = async () => {
    if (deleteConfirm) {
      await handleAction(deleteConfirm.id, 'delete');
      setDeleteConfirm(null);
    }
  };
  const handlePublish = (id: string) => handleAction(id, 'publish');
  const handleUnpublish = (id: string) => handleAction(id, 'unpublish');

  // Calculate SEO Health Score (1-100)
  const calculateSEOScore = (post: any): number => {
    let score = 0;

    // Title (15 points) - required, optimal 50-60 chars
    if (post.title) {
      score += 10;
      if (post.title.length >= 30 && post.title.length <= 70) score += 5;
    }

    // Description/Excerpt (15 points) - optimal 120-160 chars
    if (post.description) {
      score += 10;
      if (post.description.length >= 100 && post.description.length <= 200) score += 5;
    }

    // Content Parts (20 points)
    if (post.content_part1 && post.content_part1.length > 100) score += 7;
    if (post.content_part2 && post.content_part2.length > 100) score += 7;
    if (post.content_part3 && post.content_part3.length > 100) score += 6;

    // Hero Media (10 points)
    if (post.hero_url || post.video_url) score += 10;

    // Body Images (10 points)
    if (post.content_image0) score += 4;
    if (post.content_image1) score += 3;
    if (post.content_image2) score += 3;

    // Category (5 points)
    if (post.category) score += 5;

    // Slug (5 points) - readable, no special chars
    if (post.slug && post.slug.length > 5) score += 5;

    // SEO Metadata/Keywords (15 points)
    if (post.seo?.keywords && post.seo.keywords.length > 0) {
      score += Math.min(15, post.seo.keywords.length * 3);
    }

    // Read Time (5 points)
    if (post.read_time) score += 5;

    return Math.min(100, score);
  };

  // Get score color and label
  const getScoreStyle = (score: number) => {
    if (score >= 80) return { color: 'text-green-400', bg: 'bg-green-500/20', border: 'border-green-500/30', label: 'Excellent' };
    if (score >= 60) return { color: 'text-yellow-400', bg: 'bg-yellow-500/20', border: 'border-yellow-500/30', label: 'Good' };
    if (score >= 40) return { color: 'text-orange-400', bg: 'bg-orange-500/20', border: 'border-orange-500/30', label: 'Needs Work' };
    return { color: 'text-red-400', bg: 'bg-red-500/20', border: 'border-red-500/30', label: 'Poor' };
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold gradient-text">Insights Manager</h1>
          <p className="text-gray-400">Manage Insights, SEO Metadata, and Content Silos.</p>
        </div>
        <div className="flex items-center gap-3">
          <Link href="/admin/insights/silos">
            <Button
              variant="outline"
              className="border-white/20 hover:bg-white/5 hover:border-purple-500/50"
            >
              <FolderTree className="w-4 h-4 mr-2" /> Manage Silos
            </Button>
          </Link>
          <Button
            onClick={() => {
              setIsCreatingPost(true);
              router.push('/insights/create');
            }}
            disabled={isCreatingPost}
            className="bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 disabled:opacity-80 disabled:cursor-wait min-w-[130px] transition-all duration-200"
          >
            {isCreatingPost ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                <span className="animate-pulse">Creating...</span>
              </>
            ) : (
              <>
                <Plus className="w-4 h-4 mr-2" /> New Post
              </>
            )}
          </Button>
        </div>
      </div>

      {/* Action Feedback Message */}
      {actionMessage && (
        <div className={`p-4 rounded-lg border mb-4 ${actionMessage.type === 'success'
          ? 'bg-green-500/10 border-green-500/30 text-green-400'
          : 'bg-red-500/10 border-red-500/30 text-red-400'
          }`}>
          {actionMessage.type === 'success' ? '✅' : '❌'} {actionMessage.text}
        </div>
      )}

      <Tabs defaultValue="list" className="w-full">
        <TabsList className="bg-white/5 border border-white/10 mb-6">
          <TabsTrigger value="list" className="data-[state=active]:bg-cyan-500/20 data-[state=active]:text-cyan-400">
            <FileText className="w-4 h-4 mr-2" /> All Articles
          </TabsTrigger>
          <TabsTrigger value="health" className="data-[state=active]:bg-green-500/20 data-[state=active]:text-green-400">
            <Activity className="w-4 h-4 mr-2" /> SEO Health
          </TabsTrigger>
          <TabsTrigger value="silo" className="data-[state=active]:bg-purple-500/20 data-[state=active]:text-purple-400">
            <BarChart2 className="w-4 h-4 mr-2" /> Silo Visualization
          </TabsTrigger>
          <TabsTrigger value="research" className="data-[state=active]:bg-yellow-500/20 data-[state=active]:text-yellow-400">
            <Search className="w-4 h-4 mr-2" /> Link Research
          </TabsTrigger>
          <TabsTrigger value="engine" className="data-[state=active]:bg-amber-500/20 data-[state=active]:text-amber-400">
            <Zap className="w-4 h-4 mr-2" /> No Hands Engine
          </TabsTrigger>
          <TabsTrigger value="cleanup" className="data-[state=active]:bg-orange-500/20 data-[state=active]:text-orange-400">
            <Wrench className="w-4 h-4 mr-2" /> Cleanup
          </TabsTrigger>
        </TabsList>

        <TabsContent value="list">
          {/* Stats Bar */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
            <button
              onClick={() => setActiveFilter(activeFilter === 'all' ? null : 'all')}
              className={`relative overflow-hidden rounded-2xl border p-5 transition-all duration-300 hover:scale-105 text-left ${
                activeFilter === 'all'
                  ? 'bg-gradient-to-br from-slate-700/80 to-slate-800/80 border-slate-600/80 shadow-lg shadow-slate-500/20'
                  : 'bg-gradient-to-br from-slate-800/80 to-slate-900/80 border-slate-700/50 hover:border-slate-600/70'
              }`}
            >
              <div className="absolute top-0 right-0 w-20 h-20 bg-white/5 rounded-full -translate-y-1/2 translate-x-1/2" />
              <p className="text-slate-400 text-xs font-medium tracking-wider uppercase mb-1">Total Articles</p>
              <p className="text-3xl font-bold text-white">{posts.length}</p>
            </button>
            
            <button
              onClick={() => setActiveFilter(activeFilter === 'pillar-live' ? null : 'pillar-live')}
              className={`relative overflow-hidden rounded-2xl border p-5 transition-all duration-300 hover:scale-105 text-left ${
                activeFilter === 'pillar-live'
                  ? 'bg-gradient-to-br from-violet-900/80 to-violet-800/80 border-violet-700/80 shadow-lg shadow-violet-500/20'
                  : 'bg-gradient-to-br from-violet-950/80 to-violet-900/40 border-violet-800/50 hover:border-violet-700/70'
              }`}
            >
              <div className="absolute top-0 right-0 w-20 h-20 bg-violet-500/10 rounded-full -translate-y-1/2 translate-x-1/2" />
              <p className="text-violet-400/80 text-xs font-medium tracking-wider uppercase mb-1">Pillar Posts Live</p>
              <p className="text-3xl font-bold text-violet-400">{posts.filter(p => p.is_published && p.is_pillar === true).length}</p>
            </button>
            
            <button
              onClick={() => setActiveFilter(activeFilter === 'supporting-live' ? null : 'supporting-live')}
              className={`relative overflow-hidden rounded-2xl border p-5 transition-all duration-300 hover:scale-105 text-left ${
                activeFilter === 'supporting-live'
                  ? 'bg-gradient-to-br from-emerald-900/80 to-emerald-800/80 border-emerald-700/80 shadow-lg shadow-emerald-500/20'
                  : 'bg-gradient-to-br from-emerald-950/80 to-emerald-900/40 border-emerald-800/50 hover:border-emerald-700/70'
              }`}
            >
              <div className="absolute top-0 right-0 w-20 h-20 bg-emerald-500/10 rounded-full -translate-y-1/2 translate-x-1/2" />
              <p className="text-emerald-400/80 text-xs font-medium tracking-wider uppercase mb-1">Supporting Articles Live</p>
              <p className="text-3xl font-bold text-emerald-400">{posts.filter(p => p.is_published && p.is_pillar !== true).length}</p>
            </button>
            
            <button
              onClick={() => setActiveFilter(activeFilter === 'drafts' ? null : 'drafts')}
              className={`relative overflow-hidden rounded-2xl border p-5 transition-all duration-300 hover:scale-105 text-left ${
                activeFilter === 'drafts'
                  ? 'bg-gradient-to-br from-amber-900/80 to-amber-800/80 border-amber-700/80 shadow-lg shadow-amber-500/20'
                  : 'bg-gradient-to-br from-amber-950/80 to-amber-900/40 border-amber-800/50 hover:border-amber-700/70'
              }`}
            >
              <div className="absolute top-0 right-0 w-20 h-20 bg-amber-500/10 rounded-full -translate-y-1/2 translate-x-1/2" />
              <p className="text-amber-400/80 text-xs font-medium tracking-wider uppercase mb-1">Drafts</p>
              <p className="text-3xl font-bold text-amber-400">{posts.filter(p => !p.is_published).length}</p>
              {posts.filter((p: any) => !p.is_published && p.pipeline_stage && p.pipeline_stage !== 'draft' && p.pipeline_stage !== 'idea').length > 0 && (
                <p className="text-purple-400 text-xs mt-1">
                  {posts.filter((p: any) => !p.is_published && p.pipeline_stage && p.pipeline_stage !== 'draft' && p.pipeline_stage !== 'idea').length} in AI pipeline
                </p>
              )}
            </button>
          </div>

          {/* Active Filter Indicator */}
          {activeFilter && (
            <div className="flex items-center justify-between bg-white/5 border border-white/10 rounded-lg p-3 mb-6">
              <div className="flex items-center gap-2">
                <span className="text-sm text-slate-400">Filtered by:</span>
                <Badge className={`text-sm px-3 py-1 ${
                  activeFilter === 'all' ? 'bg-slate-500/20 text-slate-400 border-slate-500/30' :
                  activeFilter === 'pillar-live' ? 'bg-violet-500/20 text-violet-400 border-violet-500/30' :
                  activeFilter === 'supporting-live' ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30' :
                  'bg-amber-500/20 text-amber-400 border-amber-500/30'
                }`}>
                  {activeFilter === 'all' ? 'All Articles' :
                   activeFilter === 'pillar-live' ? 'Pillar Posts Live' :
                   activeFilter === 'supporting-live' ? 'Supporting Articles Live' :
                   'Drafts'}
                </Badge>
              </div>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => setActiveFilter(null)}
                className="text-slate-400 hover:text-white"
              >
                <X className="w-4 h-4 mr-1" />
                Clear Filter
              </Button>
            </div>
          )}

          {loading ? (
            <div className="flex items-center justify-center py-20">
              <Loader2 className="w-8 h-8 animate-spin text-cyan-400" />
              <span className="ml-3 text-gray-400">Loading articles...</span>
            </div>
          ) : posts.length === 0 ? (
            <div className="text-center py-20 text-gray-400">
              <FileText className="w-16 h-16 mx-auto mb-4 opacity-20" />
              <p className="text-lg">No articles yet</p>
              <p className="text-sm mt-1">Create your first post to get started</p>
            </div>
          ) : (
            <div className="space-y-8">
              
              {(() => {
                // Filter posts based on active filter
                let filteredPosts = posts;
                if (activeFilter) {
                  switch (activeFilter) {
                    case 'all':
                      // Show all posts
                      filteredPosts = posts;
                      break;
                    case 'pillar-live':
                      filteredPosts = posts.filter(p => p.is_published && p.is_pillar === true);
                      break;
                    case 'supporting-live':
                      filteredPosts = posts.filter(p => p.is_published && p.is_pillar !== true);
                      break;
                    case 'drafts':
                      filteredPosts = posts.filter(p => !p.is_published);
                      break;
                    default:
                      filteredPosts = posts;
                  }
                }
                
                return (
                  <>
                    {/* Use filteredPosts instead of posts for sections below */}
              {/* ═══════════════════════════════════════════════════════════════
                  PUBLISHED ARTICLES SECTION (Tabbed: Silo Posts vs Articles)
                  ═══════════════════════════════════════════════════════════════ */}
              {(!activeFilter || ['all', 'pillar-live', 'supporting-live'].includes(activeFilter)) && 
               filteredPosts.filter(p => p.is_published).length > 0 && (
                <section>
                  <div className="flex items-center gap-3 mb-4">
                    <div className="flex items-center gap-2 px-4 py-2 rounded-full bg-emerald-500/10 border border-emerald-500/30">
                      <span className="relative flex h-2 w-2">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                      </span>
                      <span className="text-emerald-400 font-semibold text-sm tracking-wide">PUBLISHED</span>
                    </div>
                    <div className="flex-1 h-px bg-gradient-to-r from-emerald-500/30 to-transparent" />
                    <span className="text-emerald-400/60 text-sm">{filteredPosts.filter(p => p.is_published).length} articles live</span>
                  </div>

                  {/* Sub-tabs for Silo Posts vs Articles */}
                  <div className="flex gap-2 mb-4">
                    <button
                      onClick={() => setPublishedTab('silo')}
                      className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                        publishedTab === 'silo'
                          ? 'bg-violet-500/20 text-violet-400 border border-violet-500/30'
                          : 'bg-slate-800/50 text-slate-400 border border-slate-700/50 hover:bg-slate-800/70'
                      }`}
                    >
                      <Crown className="w-4 h-4" />
                      Pillar Posts
                      <Badge variant="outline" className={`text-[10px] ml-1 ${publishedTab === 'silo' ? 'border-violet-500/30 text-violet-400' : 'border-slate-600 text-slate-500'}`}>
                        {filteredPosts.filter(p => p.is_published && p.is_pillar === true).length}
                      </Badge>
                    </button>
                    <button
                      onClick={() => setPublishedTab('articles')}
                      className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                        publishedTab === 'articles'
                          ? 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/30'
                          : 'bg-slate-800/50 text-slate-400 border border-slate-700/50 hover:bg-slate-800/70'
                      }`}
                    >
                      <Newspaper className="w-4 h-4" />
                      Supporting Articles
                      <Badge variant="outline" className={`text-[10px] ml-1 ${publishedTab === 'articles' ? 'border-cyan-500/30 text-cyan-400' : 'border-slate-600 text-slate-500'}`}>
                        {filteredPosts.filter(p => p.is_published && p.is_pillar !== true).length}
                      </Badge>
                    </button>
                  </div>

                  <div className="grid gap-3">
                    {filteredPosts
                      .filter(p => p.is_published && (publishedTab === 'silo' ? p.is_pillar === true : p.is_pillar !== true))
                      .map((post) => {
                        const seoScore = calculateSEOScore(post);
                        const scoreStyle = getScoreStyle(seoScore);
                        const silo = getSiloBySlug(post.silo_topic);

                        return (
                          <div
                            key={post.id}
                            className="group relative rounded-xl bg-gradient-to-r from-emerald-950/30 via-slate-900/80 to-slate-900/80 border border-emerald-900/50 hover:border-emerald-700/50 transition-all duration-300 overflow-hidden"
                          >
                            {/* Live indicator bar */}
                            <div className="absolute left-0 top-0 bottom-0 w-1 bg-gradient-to-b from-emerald-400 to-emerald-600" />

                            <div className="p-5 pl-6 flex items-center justify-between">
                              <div className="flex-1 min-w-0 pr-4">
                                <div className="flex items-center gap-2 mb-2 flex-wrap">
                                  <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/30 text-[10px] px-2 py-0">
                                    LIVE
                                  </Badge>
                                  {publishedTab === 'silo' && (
                                    <Badge className="bg-violet-500/20 text-violet-400 border-violet-500/30 text-[10px] px-2 py-0">
                                      <Crown className="w-3 h-3 mr-1" />
                                      PILLAR
                                    </Badge>
                                  )}
                                  {/* Silo Badge */}
                                  {silo && (
                                    <Badge
                                      className="text-[10px] px-2 py-0 border"
                                      style={{
                                        backgroundColor: `${silo.color || '#8B5CF6'}20`,
                                        borderColor: `${silo.color || '#8B5CF6'}50`,
                                        color: silo.color || '#8B5CF6'
                                      }}
                                    >
                                      {silo.name}
                                    </Badge>
                                  )}
                                  <span className="text-xs text-slate-500">{format(new Date(post.created_at), 'MMM d, yyyy')}</span>
                                  <div className={`flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium ${scoreStyle.bg} ${scoreStyle.border} border`}>
                                    <TrendingUp className={`w-3 h-3 ${scoreStyle.color}`} />
                                    <span className={scoreStyle.color}>{seoScore}</span>
                                  </div>
                                </div>
                                <Link href={`/admin/insights/${post.id}`} className="block">
                                  <h3 className="text-white font-semibold text-lg truncate group-hover:text-emerald-400 transition-colors">
                                    {post.title}
                                  </h3>
                                </Link>
                                <p className="text-slate-500 text-sm truncate mt-1">
                                  {post.description || (publishedTab === 'silo'
                                    ? `/insights/${post.silo_topic || post.slug}`
                                    : `/insights/${post.silo_topic ? `${post.silo_topic}/` : ''}${post.slug}`)}
                                </p>
                              </div>

                              <div className="flex items-center gap-1">
                                <Link href={publishedTab === 'silo'
                                  ? `/insights/${post.silo_topic || post.slug}`
                                  : `/insights/${post.silo_topic ? `${post.silo_topic}/` : ''}${post.slug}`} target="_blank">
                                  <Button size="sm" variant="ghost" className="h-9 w-9 p-0 text-slate-400 hover:text-white hover:bg-white/10">
                                    <Eye className="w-4 h-4" />
                                  </Button>
                                </Link>
                                <Link href={`/admin/insights/${post.id}`}>
                                  <Button size="sm" variant="ghost" className="h-9 w-9 p-0 text-cyan-400 hover:text-cyan-300 hover:bg-cyan-500/10">
                                    <Edit className="w-4 h-4" />
                                  </Button>
                                </Link>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  className="h-9 px-3 text-amber-400 hover:text-amber-300 hover:bg-amber-500/10"
                                  onClick={() => handleUnpublish(post.id)}
                                  disabled={actionLoading === post.id}
                                >
                                  {actionLoading === post.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <><XCircle className="w-4 h-4 mr-1" /> Unpublish</>}
                                </Button>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  className="h-9 w-9 p-0 text-red-400 hover:text-red-300 hover:bg-red-500/10"
                                  onClick={() => handleDelete(post)}
                                  disabled={actionLoading === post.id}
                                >
                                  <Trash2 className="w-4 h-4" />
                                </Button>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    {filteredPosts.filter(p => p.is_published && (publishedTab === 'silo' ? p.is_pillar === true : p.is_pillar !== true)).length === 0 && (
                      <div className="text-center py-10 text-slate-500">
                        <FileText className="w-12 h-12 mx-auto mb-3 opacity-30" />
                        <p>No {publishedTab === 'silo' ? 'pillar posts' : 'supporting articles'} published yet</p>
                      </div>
                    )}
                  </div>
                </section>
              )}

              {/* ═══════════════════════════════════════════════════════════════
                  DRAFTS & IN-PROGRESS SECTION (Tabbed: Silo Posts vs Articles)
                  ═══════════════════════════════════════════════════════════════ */}
              {(!activeFilter || ['all', 'drafts'].includes(activeFilter)) && 
               filteredPosts.filter(p => !p.is_published).length > 0 && (
                <section>
                  <div className="flex items-center gap-3 mb-4">
                    <div className="flex items-center gap-2 px-4 py-2 rounded-full bg-amber-500/10 border border-amber-500/30">
                      <Edit className="w-3.5 h-3.5 text-amber-400" />
                      <span className="text-amber-400 font-semibold text-sm tracking-wide">DRAFTS & IN PROGRESS</span>
                    </div>
                    <div className="flex-1 h-px bg-gradient-to-r from-amber-500/30 to-transparent" />
                    <span className="text-amber-400/60 text-sm">{filteredPosts.filter(p => !p.is_published).length} articles</span>
                  </div>

                  {/* Sub-tabs for Silo Posts vs Articles */}
                  <div className="flex gap-2 mb-4">
                    <button
                      onClick={() => setDraftsTab('silo')}
                      className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                        draftsTab === 'silo'
                          ? 'bg-violet-500/20 text-violet-400 border border-violet-500/30'
                          : 'bg-slate-800/50 text-slate-400 border border-slate-700/50 hover:bg-slate-800/70'
                      }`}
                    >
                      <Crown className="w-4 h-4" />
                      Pillar Posts
                      <Badge variant="outline" className={`text-[10px] ml-1 ${draftsTab === 'silo' ? 'border-violet-500/30 text-violet-400' : 'border-slate-600 text-slate-500'}`}>
                        {filteredPosts.filter(p => !p.is_published && p.is_pillar === true).length}
                      </Badge>
                    </button>
                    <button
                      onClick={() => setDraftsTab('articles')}
                      className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                        draftsTab === 'articles'
                          ? 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/30'
                          : 'bg-slate-800/50 text-slate-400 border border-slate-700/50 hover:bg-slate-800/70'
                      }`}
                    >
                      <Newspaper className="w-4 h-4" />
                      Supporting Articles
                      <Badge variant="outline" className={`text-[10px] ml-1 ${draftsTab === 'articles' ? 'border-cyan-500/30 text-cyan-400' : 'border-slate-600 text-slate-500'}`}>
                        {filteredPosts.filter(p => !p.is_published && p.is_pillar !== true).length}
                      </Badge>
                    </button>
                  </div>

                  <div className="grid gap-3">
                    {(() => {
                      // Pipeline stage styling
                      const getPipelineStyle = (stage: string) => {
                        const styles: Record<string, { color: string; bg: string; border: string; label: string }> = {
                          'idea': { color: 'text-slate-400', bg: 'bg-slate-500/20', border: 'border-slate-500/30', label: 'Idea' },
                          'research': { color: 'text-blue-400', bg: 'bg-blue-500/20', border: 'border-blue-500/30', label: 'Research' },
                          'plan_review': { color: 'text-purple-400', bg: 'bg-purple-500/20', border: 'border-purple-500/30', label: 'Plan Review' },
                          'plan_approved': { color: 'text-violet-400', bg: 'bg-violet-500/20', border: 'border-violet-500/30', label: 'Plan OK' },
                          'writing': { color: 'text-blue-400', bg: 'bg-blue-500/20', border: 'border-blue-500/30', label: 'Writing' },
                          'humanizing': { color: 'text-pink-400', bg: 'bg-pink-500/20', border: 'border-pink-500/30', label: 'Humanizing' },
                          'seo': { color: 'text-orange-400', bg: 'bg-orange-500/20', border: 'border-orange-500/30', label: 'SEO' },
                          'meta': { color: 'text-teal-400', bg: 'bg-teal-500/20', border: 'border-teal-500/30', label: 'Meta' },
                          'ready': { color: 'text-emerald-400', bg: 'bg-emerald-500/20', border: 'border-emerald-500/30', label: 'Ready' },
                        };
                        return styles[stage] || { color: 'text-amber-400', bg: 'bg-amber-500/20', border: 'border-amber-500/30', label: 'Draft' };
                      };

                      return filteredPosts
                        .filter(p => !p.is_published && (draftsTab === 'silo' ? p.is_pillar === true : p.is_pillar !== true))
                        .map((post) => {
                          const seoScore = calculateSEOScore(post);
                          const scoreStyle = getScoreStyle(seoScore);
                          const isInPipeline = post.pipeline_stage && post.pipeline_stage !== 'draft' && post.pipeline_stage !== 'idea';
                          const pipelineStyle = getPipelineStyle(post.pipeline_stage || 'draft');
                          const silo = getSiloBySlug(post.silo_topic);

                          return (
                            <div
                              key={post.id}
                              className={`group relative rounded-xl border transition-all duration-300 overflow-hidden ${
                                isInPipeline
                                  ? 'bg-gradient-to-r from-purple-950/30 via-slate-900/80 to-slate-900/80 border-purple-900/50 hover:border-purple-700/50'
                                  : 'bg-gradient-to-r from-amber-950/20 via-slate-900/80 to-slate-900/80 border-amber-900/40 hover:border-amber-700/50'
                              }`}
                            >
                              {/* Status indicator bar */}
                              <div className={`absolute left-0 top-0 bottom-0 w-1 ${isInPipeline ? 'bg-gradient-to-b from-purple-400 to-purple-600' : 'bg-gradient-to-b from-amber-400 to-amber-600'}`} />

                              <div className="p-5 pl-6 flex items-center justify-between">
                                <div className="flex-1 min-w-0 pr-4">
                                  <div className="flex items-center gap-2 mb-2 flex-wrap">
                                    {isInPipeline ? (
                                      <Badge className={`${pipelineStyle.bg} ${pipelineStyle.color} ${pipelineStyle.border} border text-[10px] px-2 py-0`}>
                                        <Zap className="w-3 h-3 mr-1" />
                                        {pipelineStyle.label}
                                      </Badge>
                                    ) : (
                                      <Badge className="bg-amber-500/20 text-amber-400 border-amber-500/30 border text-[10px] px-2 py-0">
                                        DRAFT
                                      </Badge>
                                    )}
                                    {draftsTab === 'silo' && (
                                      <Badge className="bg-violet-500/20 text-violet-400 border-violet-500/30 text-[10px] px-2 py-0">
                                        <Crown className="w-3 h-3 mr-1" />
                                        PILLAR
                                      </Badge>
                                    )}
                                    {/* Silo Badge */}
                                    {silo && (
                                      <Badge
                                        className="text-[10px] px-2 py-0 border"
                                        style={{
                                          backgroundColor: `${silo.color || '#8B5CF6'}20`,
                                          borderColor: `${silo.color || '#8B5CF6'}50`,
                                          color: silo.color || '#8B5CF6'
                                        }}
                                      >
                                        {silo.name}
                                      </Badge>
                                    )}
                                    <span className="text-xs text-slate-500">{format(new Date(post.created_at), 'MMM d, yyyy')}</span>
                                    {seoScore > 0 && (
                                      <div className={`flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium ${scoreStyle.bg} ${scoreStyle.border} border`}>
                                        {seoScore >= 60 ? <TrendingUp className={`w-3 h-3 ${scoreStyle.color}`} /> : <AlertTriangle className={`w-3 h-3 ${scoreStyle.color}`} />}
                                        <span className={scoreStyle.color}>{seoScore}</span>
                                      </div>
                                    )}
                                  </div>
                                  <Link href={`/admin/insights/${post.id}`} className="block">
                                    <h3 className={`font-semibold text-lg truncate transition-colors ${isInPipeline ? 'text-white group-hover:text-purple-400' : 'text-white group-hover:text-amber-400'}`}>
                                      {post.title || 'Untitled Draft'}
                                    </h3>
                                  </Link>
                                  <p className="text-slate-500 text-sm truncate mt-1">
                                    {post.description || (draftsTab === 'silo'
                                      ? `/insights/${post.silo_topic || post.slug}`
                                      : `/insights/${post.silo_topic ? `${post.silo_topic}/` : ''}${post.slug}`)}
                                  </p>
                                </div>

                                <div className="flex items-center gap-1">
                                  <Link href={draftsTab === 'silo'
                                    ? `/insights/${post.silo_topic || post.slug}`
                                    : `/insights/${post.silo_topic ? `${post.silo_topic}/` : ''}${post.slug}`} target="_blank">
                                    <Button size="sm" variant="ghost" className="h-9 w-9 p-0 text-slate-400 hover:text-white hover:bg-white/10">
                                      <Eye className="w-4 h-4" />
                                    </Button>
                                  </Link>
                                  <Link href={`/admin/insights/${post.id}`}>
                                    <Button size="sm" variant="ghost" className="h-9 w-9 p-0 text-cyan-400 hover:text-cyan-300 hover:bg-cyan-500/10">
                                      <Edit className="w-4 h-4" />
                                    </Button>
                                  </Link>
                                  {isInPipeline && (
                                    <Button
                                      size="sm"
                                      variant="ghost"
                                      className="h-9 px-3 text-purple-400 hover:text-purple-300 hover:bg-purple-500/10"
                                      onClick={async () => {
                                        try {
                                          const { data: pipeline } = await supabase
                                            .from('content_pipelines')
                                            .select('id')
                                            .eq('insight_id', post.id)
                                            .single();
                                          if (pipeline?.id) {
                                            router.push(`/admin/insights/create?resume=${pipeline.id}`);
                                          }
                                        } catch (err) {
                                          console.error('Error:', err);
                                        }
                                      }}
                                    >
                                      <Zap className="w-4 h-4 mr-1" /> Resume
                                    </Button>
                                  )}
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    className="h-9 px-3 text-emerald-400 hover:text-emerald-300 hover:bg-emerald-500/10"
                                    onClick={() => attemptPublish(post)}
                                    disabled={actionLoading === post.id}
                                  >
                                    {actionLoading === post.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <><CheckCircle className="w-4 h-4 mr-1" /> Publish</>}
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    className="h-9 w-9 p-0 text-red-400 hover:text-red-300 hover:bg-red-500/10"
                                    onClick={() => handleDelete(post)}
                                    disabled={actionLoading === post.id}
                                  >
                                    <Trash2 className="w-4 h-4" />
                                  </Button>
                                </div>
                              </div>
                            </div>
                          );
                        });
                    })()}
                    {filteredPosts.filter(p => !p.is_published && (draftsTab === 'silo' ? p.is_pillar === true : p.is_pillar !== true)).length === 0 && (
                      <div className="text-center py-10 text-slate-500">
                        <FileText className="w-12 h-12 mx-auto mb-3 opacity-30" />
                        <p>No {draftsTab === 'silo' ? 'pillar post' : 'supporting article'} drafts</p>
                      </div>
                    )}
                  </div>
                </section>
              )}
                  </>
                );
              })()}
            </div>
          )}
        </TabsContent>

        <TabsContent value="health">
          <SEODashboard />
        </TabsContent>

        <TabsContent value="silo">
          <SiloVisualization />
        </TabsContent>

        <TabsContent value="research">
          <OutboundResearch />
        </TabsContent>

        <TabsContent value="engine">
          <NoHandsEngine />
        </TabsContent>

        <TabsContent value="cleanup">
          <CleanupEngine />
        </TabsContent>

      </Tabs>

      {/* Delete Confirmation Modal */}
      {deleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/80 backdrop-blur-sm"
            onClick={() => setDeleteConfirm(null)}
          />

          {/* Modal */}
          <div className="relative bg-gradient-to-br from-gray-900 via-gray-900 to-red-950/30 border border-red-500/30 rounded-2xl p-6 max-w-md w-full shadow-2xl shadow-red-500/10 animate-in fade-in zoom-in-95 duration-200">
            {/* Close button */}
            <button
              onClick={() => setDeleteConfirm(null)}
              className="absolute top-4 right-4 text-gray-500 hover:text-white transition-colors"
            >
              <X className="w-5 h-5" />
            </button>

            {/* Icon */}
            <div className="flex justify-center mb-4">
              <div className="w-16 h-16 rounded-full bg-red-500/20 border border-red-500/30 flex items-center justify-center">
                <AlertOctagon className="w-8 h-8 text-red-400" />
              </div>
            </div>

            {/* Content */}
            <div className="text-center mb-6">
              <h3 className="text-xl font-bold text-white mb-2">Delete Article?</h3>
              <p className="text-gray-400 mb-3">
                Are you sure you want to delete this article? This action cannot be undone.
              </p>
              <div className="bg-white/5 rounded-lg p-3 border border-white/10">
                <p className="text-white font-medium truncate">{deleteConfirm.title}</p>
              </div>
            </div>

            {/* Actions */}
            <div className="flex gap-3">
              <Button
                variant="outline"
                onClick={() => setDeleteConfirm(null)}
                className="flex-1 h-11 border-white/20 hover:bg-white/5"
              >
                Cancel
              </Button>
              <Button
                onClick={confirmDelete}
                disabled={actionLoading === deleteConfirm.id}
                className="flex-1 h-11 bg-red-600 hover:bg-red-700 text-white border-0"
              >
                {actionLoading === deleteConfirm.id ? (
                  <Loader2 className="w-4 h-4 animate-spin mr-2" />
                ) : (
                  <Trash2 className="w-4 h-4 mr-2" />
                )}
                Delete
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Publish Validation Modal */}
      {publishValidation && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/80 backdrop-blur-sm"
            onClick={() => setPublishValidation(null)}
          />

          {/* Modal */}
          <div className="relative bg-gradient-to-br from-gray-900 via-gray-900 to-amber-950/30 border border-amber-500/30 rounded-2xl p-6 max-w-lg w-full shadow-2xl shadow-amber-500/10 animate-in fade-in zoom-in-95 duration-200">
            {/* Close button */}
            <button
              onClick={() => setPublishValidation(null)}
              className="absolute top-4 right-4 text-gray-500 hover:text-white transition-colors"
            >
              <X className="w-5 h-5" />
            </button>

            {/* Icon */}
            <div className="flex justify-center mb-4">
              <div className="w-16 h-16 rounded-full bg-amber-500/20 border border-amber-500/30 flex items-center justify-center">
                <AlertTriangle className="w-8 h-8 text-amber-400" />
              </div>
            </div>

            {/* Content */}
            <div className="text-center mb-4">
              <h3 className="text-xl font-bold text-white mb-2">Cannot Publish Yet</h3>
              <p className="text-gray-400">
                This article is missing required content. Please complete all stages before publishing.
              </p>
            </div>

            {/* Article title */}
            <div className="bg-white/5 rounded-lg p-3 border border-white/10 mb-4">
              <p className="text-white font-medium truncate">{publishValidation.post.title || 'Untitled'}</p>
            </div>

            {/* Checklist */}
            <div className="space-y-2 mb-6">
              {publishValidation.issues.map((issue, idx) => (
                <div
                  key={idx}
                  className={`flex items-center gap-3 p-3 rounded-lg border ${
                    issue.status
                      ? 'bg-emerald-500/10 border-emerald-500/30'
                      : 'bg-red-500/10 border-red-500/30'
                  }`}
                >
                  {issue.status ? (
                    <CheckCircle className="w-5 h-5 text-emerald-400 flex-shrink-0" />
                  ) : (
                    <XCircle className="w-5 h-5 text-red-400 flex-shrink-0" />
                  )}
                  <span className={issue.status ? 'text-emerald-300' : 'text-red-300'}>
                    {issue.label}
                  </span>
                </div>
              ))}
            </div>

            {/* Summary */}
            <div className="text-center text-sm text-gray-400 mb-4">
              {publishValidation.issues.filter(i => i.status).length} of {publishValidation.issues.length} requirements met
            </div>

            {/* Actions */}
            <div className="flex gap-3">
              <Button
                variant="outline"
                onClick={() => setPublishValidation(null)}
                className="flex-1 h-11 border-white/20 hover:bg-white/5"
              >
                Close
              </Button>
              <Link href={`/admin/insights/${publishValidation.post.id}`} className="flex-1">
                <Button
                  className="w-full h-11 bg-cyan-600 hover:bg-cyan-700 text-white border-0"
                  onClick={() => setPublishValidation(null)}
                >
                  <Edit className="w-4 h-4 mr-2" />
                  Edit Article
                </Button>
              </Link>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

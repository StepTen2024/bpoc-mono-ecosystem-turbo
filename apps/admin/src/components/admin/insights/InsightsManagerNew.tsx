'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { Button } from '@/components/shared/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/shared/ui/card';
import { Badge } from '@/components/shared/ui/badge';
import { Plus, Scan, Link2, Activity, TrendingUp, AlertTriangle, Layers, CheckCircle, XCircle, ArrowRight, Eye, Edit, Trash2, Loader2 } from 'lucide-react';
import Link from 'next/link';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/shared/ui/tabs';

interface Article {
  id: string;
  title: string;
  slug: string;
  description: string;
  category: string;
  is_published: boolean;
  created_at: string;
  // NEW SILO FIELDS
  content_type: 'pillar' | 'supporting' | 'hub' | null;
  silo_topic: string | null;
  depth: number | null;
  parent_id: string | null;
  // NEW AI FIELDS
  pipeline_stage: string | null;
  humanization_score: number | null;
}

interface LinkHealthData {
  totalArticles: number;
  avgLinkHealth: number;
  articlesNeedingAttention: number;
  wellLinkedArticles: number;
  needsAttentionPercent: number;
}

interface PendingSuggestion {
  id: string;
  source_post: { title: string; slug: string };
  target_post: { title: string; slug: string };
  suggested_anchor_text: string;
  similarity_score: number;
  created_at: string;
}

export default function InsightsManagerNew() {
  const [articles, setArticles] = useState<Article[]>([]);
  const [loading, setLoading] = useState(true);
  const [linkHealth, setLinkHealth] = useState<LinkHealthData | null>(null);
  const [pendingSuggestions, setPendingSuggestions] = useState<PendingSuggestion[]>([]);
  const [scanLoading, setScanLoading] = useState(false);
  const [scanResult, setScanResult] = useState<string | null>(null);

  // Fetch articles with NEW fields
  const fetchArticles = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('insights_posts')
      .select(`
        id, slug, title, description, category, is_published, created_at,
        content_type, silo_topic, depth, parent_id,
        pipeline_stage, humanization_score
      `)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching articles:', error);
    } else {
      setArticles(data || []);
    }
    setLoading(false);
  };

  // Fetch link health data
  const fetchLinkHealth = async () => {
    try {
      const res = await fetch('/api/insights/link-health?type=overview');
      const result = await res.json();
      if (result.success) {
        setLinkHealth(result.summary);
      }
    } catch (error) {
      console.error('Error fetching link health:', error);
    }
  };

  // Fetch pending suggestions
  const fetchPendingSuggestions = async () => {
    try {
      const res = await fetch('/api/insights/approve-link?status=pending');
      const result = await res.json();
      if (result.success) {
        setPendingSuggestions(result.suggestions || []);
      }
    } catch (error) {
      console.error('Error fetching suggestions:', error);
    }
  };

  useEffect(() => {
    fetchArticles();
    fetchLinkHealth();
    fetchPendingSuggestions();
  }, []);

  // Run smart link scanner
  const handleScanAll = async () => {
    setScanLoading(true);
    setScanResult(null);
    try {
      const res = await fetch('/api/insights/scan-links', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'scan-all' })
      });
      const result = await res.json();
      if (result.success) {
        setScanResult(`✅ Scanned ${result.articlesScanned} articles, created ${result.totalSuggestions} suggestions`);
        fetchPendingSuggestions();
        fetchLinkHealth();
      } else {
        setScanResult(`❌ ${result.error}`);
      }
    } catch (error: any) {
      setScanResult(`❌ ${error.message}`);
    } finally {
      setScanLoading(false);
    }
  };

  // Approve suggestion
  const handleApproveSuggestion = async (suggestionId: string) => {
    try {
      const res = await fetch('/api/insights/approve-link', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ suggestionId })
      });
      const result = await res.json();
      if (result.success) {
        fetchPendingSuggestions();
        fetchLinkHealth();
      }
    } catch (error) {
      console.error('Error approving suggestion:', error);
    }
  };

  // Get depth badge
  const getDepthBadge = (depth: number | null) => {
    if (!depth) return null;
    const labels = ['Hub', 'Pillar', 'Sub-Pillar', 'Topic', 'Deep'];
    const colors = ['bg-purple-500/20 text-purple-400', 'bg-blue-500/20 text-blue-400', 'bg-cyan-500/20 text-cyan-400', 'bg-green-500/20 text-green-400', 'bg-yellow-500/20 text-yellow-400'];
    return <Badge className={colors[depth] || colors[4]}>{labels[depth] || `L${depth}`}</Badge>;
  };

  // Get content type badge
  const getContentTypeBadge = (type: string | null) => {
    if (!type) return null;
    const styles = {
      pillar: 'bg-indigo-500/20 text-indigo-400 border-indigo-500/30',
      supporting: 'bg-gray-500/20 text-gray-400 border-gray-500/30',
      hub: 'bg-purple-500/20 text-purple-400 border-purple-500/30'
    };
    return <Badge variant="outline" className={styles[type as keyof typeof styles] || styles.supporting}>{type}</Badge>;
  };

  // Stats
  const totalArticles = articles.length;
  const published = articles.filter(a => a.is_published).length;
  const drafts = totalArticles - published;
  const pillars = articles.filter(a => a.content_type === 'pillar').length;
  const silos = [...new Set(articles.map(a => a.silo_topic).filter(Boolean))].length;

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold gradient-text">Insights Manager</h1>
          <p className="text-gray-400">Multi-level silos, smart linking, AI pipeline</p>
        </div>
        <div className="flex gap-3">
          <Button 
            onClick={handleScanAll}
            disabled={scanLoading}
            className="bg-purple-600 hover:bg-purple-700"
          >
            {scanLoading ? (
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            ) : (
              <Scan className="w-4 h-4 mr-2" />
            )}
            Scan All Articles
          </Button>
          <Link href="/insights/create">
            <Button className="bg-gradient-to-r from-cyan-500 to-blue-600">
              <Plus className="w-4 h-4 mr-2" /> New Article
            </Button>
          </Link>
        </div>
      </div>

      {/* Scan Result */}
      {scanResult && (
        <div className={`p-4 rounded-lg border ${
          scanResult.startsWith('✅') 
            ? 'bg-green-500/10 border-green-500/30 text-green-400' 
            : 'bg-red-500/10 border-red-500/30 text-red-400'
        }`}>
          {scanResult}
        </div>
      )}

      {/* Stats Grid */}
      <div className="grid grid-cols-2 md:grid-cols-6 gap-4">
        <Card className="bg-white/5 border-white/10">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-gray-400">Total</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-white">{totalArticles}</div>
          </CardContent>
        </Card>
        
        <Card className="bg-white/5 border-white/10">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-gray-400">Published</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-400">{published}</div>
          </CardContent>
        </Card>
        
        <Card className="bg-white/5 border-white/10">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-gray-400">Pillars</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-400">{pillars}</div>
          </CardContent>
        </Card>
        
        <Card className="bg-white/5 border-white/10">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-gray-400">Silos</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-purple-400">{silos}</div>
          </CardContent>
        </Card>
        
        <Card className="bg-white/5 border-white/10">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-gray-400 flex items-center gap-1">
              <Activity className="w-3 h-3" /> Link Health
            </CardTitle>
          </CardHeader>
          <CardContent>
            {linkHealth ? (
              <div className="flex items-center gap-2">
                <span className={`text-2xl font-bold ${
                  linkHealth.avgLinkHealth >= 70 ? 'text-green-400' : 
                  linkHealth.avgLinkHealth >= 40 ? 'text-yellow-400' : 'text-red-400'
                }`}>
                  {linkHealth.avgLinkHealth}
                </span>
                <span className="text-xs text-gray-500">/100</span>
              </div>
            ) : (
              <div className="text-xl text-gray-500">--</div>
            )}
          </CardContent>
        </Card>
        
        <Card className="bg-white/5 border-white/10">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-gray-400 flex items-center gap-1">
              <Link2 className="w-3 h-3" /> Suggestions
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-cyan-400">{pendingSuggestions.length}</div>
          </CardContent>
        </Card>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="articles" className="w-full">
        <TabsList className="bg-white/5 border border-white/10">
          <TabsTrigger value="articles">
            <Layers className="w-4 h-4 mr-2" /> Articles
          </TabsTrigger>
          <TabsTrigger value="suggestions">
            <Link2 className="w-4 h-4 mr-2" /> Suggestions ({pendingSuggestions.length})
          </TabsTrigger>
          <TabsTrigger value="health">
            <Activity className="w-4 h-4 mr-2" /> Link Health
          </TabsTrigger>
        </TabsList>

        {/* Articles Tab */}
        <TabsContent value="articles">
          <div className="bg-white/5 rounded-xl border border-white/10 overflow-hidden">
            {loading ? (
              <div className="p-8 text-center text-gray-400">Loading...</div>
            ) : articles.length === 0 ? (
              <div className="p-8 text-center text-gray-400">No articles yet. Create one!</div>
            ) : (
              <div className="divide-y divide-white/10">
                {articles.map((article) => (
                  <div key={article.id} className="p-4 hover:bg-white/[0.02] transition-colors">
                    <div className="flex items-start justify-between">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-2">
                          <Badge className={article.is_published ? 'bg-green-500/20 text-green-400' : 'bg-yellow-500/20 text-yellow-400'}>
                            {article.is_published ? 'Published' : 'Draft'}
                          </Badge>
                          {getContentTypeBadge(article.content_type)}
                          {getDepthBadge(article.depth)}
                          {article.silo_topic && (
                            <Badge variant="outline" className="border-purple-500/30 text-purple-400">
                              {article.silo_topic}
                            </Badge>
                          )}
                          {article.pipeline_stage && (
                            <Badge variant="outline" className="border-cyan-500/30 text-cyan-400 text-xs">
                              {article.pipeline_stage}
                            </Badge>
                          )}
                        </div>
                        <Link href={`/admin/insights/${article.id}`}>
                          <h4 className="text-lg font-bold text-white hover:text-cyan-400 transition-colors mb-1">
                            {article.title}
                          </h4>
                        </Link>
                        <p className="text-sm text-gray-400 mb-2">{article.description}</p>
                        <div className="flex items-center gap-3 text-xs text-gray-500">
                          <span>/{article.slug}</span>
                          {article.humanization_score && (
                            <>
                              <span>•</span>
                              <span className="text-green-400">Human: {article.humanization_score}%</span>
                            </>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-2 ml-4">
                        <Link href={`/insights/${article.slug}`} target="_blank">
                          <Button size="sm" variant="ghost" className="h-8 w-8 p-0">
                            <Eye className="w-4 h-4" />
                          </Button>
                        </Link>
                        <Link href={`/admin/insights/${article.id}`}>
                          <Button size="sm" variant="ghost" className="h-8 w-8 p-0 text-cyan-400">
                            <Edit className="w-4 h-4" />
                          </Button>
                        </Link>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </TabsContent>

        {/* Suggestions Tab */}
        <TabsContent value="suggestions">
          <div className="bg-white/5 rounded-xl border border-white/10 overflow-hidden">
            {pendingSuggestions.length === 0 ? (
              <div className="p-8 text-center text-gray-400">
                No pending suggestions. Run the scanner!
              </div>
            ) : (
              <div className="divide-y divide-white/10">
                {pendingSuggestions.map((suggestion) => (
                  <div key={suggestion.id} className="p-4 hover:bg-white/[0.02] transition-colors">
                    <div className="flex items-center justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-2">
                          <span className="text-sm text-white font-medium">{suggestion.source_post?.title}</span>
                          <ArrowRight className="w-4 h-4 text-gray-500" />
                          <span className="text-sm text-cyan-400">{suggestion.target_post?.title}</span>
                        </div>
                        <div className="flex items-center gap-3">
                          <span className="text-xs text-gray-400">Anchor: "{suggestion.suggested_anchor_text}"</span>
                          <Badge variant="outline" className="text-xs border-green-500/30 text-green-400">
                            Score: {(suggestion.similarity_score * 100).toFixed(0)}%
                          </Badge>
                        </div>
                      </div>
                      <Button 
                        size="sm"
                        onClick={() => handleApproveSuggestion(suggestion.id)}
                        className="bg-green-600 hover:bg-green-700"
                      >
                        <CheckCircle className="w-4 h-4 mr-1" /> Approve
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </TabsContent>

        {/* Health Tab */}
        <TabsContent value="health">
          <div className="grid gap-4">
            {linkHealth && (
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <Card className="bg-white/5 border-white/10">
                  <CardHeader>
                    <CardTitle className="text-sm text-gray-400">Avg Health</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className={`text-3xl font-bold ${
                      linkHealth.avgLinkHealth >= 70 ? 'text-green-400' : 
                      linkHealth.avgLinkHealth >= 40 ? 'text-yellow-400' : 'text-red-400'
                    }`}>
                      {linkHealth.avgLinkHealth}/100
                    </div>
                  </CardContent>
                </Card>
                <Card className="bg-white/5 border-white/10">
                  <CardHeader>
                    <CardTitle className="text-sm text-gray-400 flex items-center gap-2">
                      <TrendingUp className="w-4 h-4" /> Well Linked
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-3xl font-bold text-green-400">{linkHealth.wellLinkedArticles}</div>
                  </CardContent>
                </Card>
                <Card className="bg-white/5 border-white/10">
                  <CardHeader>
                    <CardTitle className="text-sm text-gray-400 flex items-center gap-2">
                      <AlertTriangle className="w-4 h-4" /> Need Attention
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-3xl font-bold text-red-400">{linkHealth.articlesNeedingAttention}</div>
                  </CardContent>
                </Card>
                <Card className="bg-white/5 border-white/10">
                  <CardHeader>
                    <CardTitle className="text-sm text-gray-400">Attention %</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-3xl font-bold text-orange-400">{linkHealth.needsAttentionPercent}%</div>
                  </CardContent>
                </Card>
              </div>
            )}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}


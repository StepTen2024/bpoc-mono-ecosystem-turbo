'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { Button } from '@/components/shared/ui/button';
import { Input } from '@/components/shared/ui/input';
import { Label } from '@/components/shared/ui/label';
import { Textarea } from '@/components/shared/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/shared/ui/card';
import { Badge } from '@/components/shared/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/shared/ui/tabs';
import { Save, Sparkles, Globe, Link as LinkIcon, Search, Loader2, Zap, X, CheckCircle, ExternalLink, ImageIcon, Wand2, Video, Upload, Play, Eye, EyeOff, Columns, Maximize2, Minimize2, Pencil, RotateCcw, ArrowLeft } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useToast } from '@/hooks/use-toast';
import LinkManager from './LinkManager';
import ArticlePreview from './ArticlePreview';

interface InsightsEditorProps {
  post?: any;
  isNew?: boolean;
}

export default function InsightsEditor({ post, isNew = false }: InsightsEditorProps) {
  const router = useRouter();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [aiLoading, setAiLoading] = useState(false);
  const [linkSuggestions, setLinkSuggestions] = useState<any[]>([]);
  const [appliedLinks, setAppliedLinks] = useState<any[]>(post?.applied_links || []);
  const [imageLoading, setImageLoading] = useState(false);
  const [imagePrompt, setImagePrompt] = useState('');
  const [imageStyle, setImageStyle] = useState('professional');
  const [imageUnsaved, setImageUnsaved] = useState(false);
  const [descriptionLoading, setDescriptionLoading] = useState(false);
  const [originalHeroUrl] = useState(post?.hero_url || '');

  // Video upload state
  const [videoUploading, setVideoUploading] = useState(false);
  const [videoUploadProgress, setVideoUploadProgress] = useState(0);
  const [originalVideoUrl] = useState(post?.video_url || '');
  const [originalHeroType] = useState(post?.hero_type || 'image');
  const [showVideoUpload, setShowVideoUpload] = useState(false);

  // Video choice modal state
  const [showVideoChoiceModal, setShowVideoChoiceModal] = useState(false);
  const [videoGenerating, setVideoGenerating] = useState(false);
  const [videoPrompt, setVideoPrompt] = useState('');
  const [videoStyle, setVideoStyle] = useState('professional');

  // Save status for clear UI feedback
  const [saveStatus, setSaveStatus] = useState<{
    state: 'idle' | 'saving' | 'success' | 'error';
    message: string;
  }>({ state: 'idle', message: '' });

  // Preview mode state
  const [previewMode, setPreviewMode] = useState<'editor' | 'preview' | 'split'>('editor');
  const [isFullscreenPreview, setIsFullscreenPreview] = useState(false);

  // Image preview popup state
  const [previewImageUrl, setPreviewImageUrl] = useState<string | null>(null);

  const [formData, setFormData] = useState({
    title: post?.title || '',
    slug: post?.slug || '',
    description: post?.description || '',
    content: post?.content || '',
    // Split content into 3 parts
    content_part1: post?.content_part1 || '',
    content_part2: post?.content_part2 || '',
    content_part3: post?.content_part3 || '',
    // Body images between sections
    content_image0: post?.content_image0 || '', // After title, before section 1
    content_image1: post?.content_image1 || '', // After section 1
    content_image2: post?.content_image2 || '', // After section 2
    // Section image alt texts
    section1_image_alt: post?.section1_image_alt || '',
    section2_image_alt: post?.section2_image_alt || '',
    section3_image_alt: post?.section3_image_alt || '',
    category: post?.category || 'BPO Jobs & Careers',
    author: post?.author || 'Ate Yna',
    author_slug: post?.author_slug || 'ate-yna',
    read_time: post?.read_time || '5 min read',
    icon_name: post?.icon_name || 'FileText',
    color: post?.color || 'text-cyan-400',
    bg_color: post?.bg_color || 'bg-cyan-500/10',
    hero_type: post?.hero_type || 'image',
    hero_url: post?.hero_url || '',
    video_url: post?.video_url || '',
    is_published: post?.is_published || false,
    // Silo and content classification fields
    silo_id: post?.silo_id || '',
    silo_topic: post?.silo_topic || '',
    is_pillar: post?.is_pillar || false,
    content_type: post?.content_type || 'supporting',
    // Open Graph fields
    og_image: post?.og_image || '',
    og_title: post?.og_title || '',
    og_description: post?.og_description || '',
    cover_image: post?.cover_image || '',
    cover_image_alt: post?.cover_image_alt || '',
    // Generation metadata
    humanization_score: post?.humanization_score || null,
  });

  // Silos state for silo selector
  const [silos, setSilos] = useState<Array<{ id: string; name: string; slug: string; description: string }>>([]);
  const [silosLoading, setSilosLoading] = useState(false);

  // Body image upload states
  const [bodyImageLoading, setBodyImageLoading] = useState<{ [key: string]: boolean }>({
    image0: false,
    image1: false,
    image2: false,
  });

  // Alt text AI generation and save states
  const [altTextGenerating, setAltTextGenerating] = useState<{ [key: string]: boolean }>({
    section1: false,
    section2: false,
    section3: false,
  });
  const [altTextSaving, setAltTextSaving] = useState<{ [key: string]: boolean }>({
    section1: false,
    section2: false,
    section3: false,
  });

  // ========== INDIVIDUAL CARD SAVE TRACKING ==========
  // Track original values for change detection
  const [originalValues, setOriginalValues] = useState({
    // Basic Info Card
    title: post?.title || '',
    slug: post?.slug || '',
    category: post?.category || 'BPO Jobs & Careers',
    description: post?.description || '',
    // Content Card
    content_part1: post?.content_part1 || '',
    content_part2: post?.content_part2 || '',
    content_part3: post?.content_part3 || '',
    // Hero Media Card
    hero_type: post?.hero_type || 'image',
    hero_url: post?.hero_url || '',
    video_url: post?.video_url || '',
    // Body Images Card
    content_image0: post?.content_image0 || '',
    section1_image_alt: post?.section1_image_alt || '',
    content_image1: post?.content_image1 || '',
    section2_image_alt: post?.section2_image_alt || '',
    content_image2: post?.content_image2 || '',
    section3_image_alt: post?.section3_image_alt || '',
    // Meta Card
    author: post?.author || 'Ate Yna',
    author_slug: post?.author_slug || 'ate-yna',
    read_time: post?.read_time || '5 min read',
    icon_name: post?.icon_name || 'FileText',
    color: post?.color || 'text-cyan-400',
    bg_color: post?.bg_color || 'bg-cyan-500/10',
    is_published: post?.is_published || false,
    // Silo and classification
    silo_id: post?.silo_id || '',
    silo_topic: post?.silo_topic || '',
    is_pillar: post?.is_pillar || false,
    content_type: post?.content_type || 'supporting',
    // Open Graph
    og_image: post?.og_image || '',
    og_title: post?.og_title || '',
    og_description: post?.og_description || '',
    cover_image: post?.cover_image || '',
    cover_image_alt: post?.cover_image_alt || '',
    humanization_score: post?.humanization_score || null,
  });

  // Track saving state per card
  const [cardSaving, setCardSaving] = useState<{ [key: string]: boolean }>({
    basicInfo: false,
    content: false,
    heroMedia: false,
    bodyImages: false,
    meta: false,
    seo: false,
  });

  // Track "saved" state per card (shows "Saved" button after successful save)
  const [cardSaved, setCardSaved] = useState<{ [key: string]: boolean }>({
    basicInfo: false,
    content: false,
    heroMedia: false,
    bodyImages: false,
    meta: false,
    seo: false,
  });

  // Check if a specific card has unsaved changes
  const hasCardChanges = {
    basicInfo: formData.title !== originalValues.title ||
      formData.slug !== originalValues.slug ||
      formData.category !== originalValues.category ||
      formData.description !== originalValues.description,
    content: formData.content_part1 !== originalValues.content_part1 ||
      formData.content_part2 !== originalValues.content_part2 ||
      formData.content_part3 !== originalValues.content_part3,
    heroMedia: formData.hero_type !== originalValues.hero_type ||
      formData.hero_url !== originalValues.hero_url ||
      formData.video_url !== originalValues.video_url,
    bodyImages: formData.content_image0 !== originalValues.content_image0 ||
      formData.section1_image_alt !== originalValues.section1_image_alt ||
      formData.content_image1 !== originalValues.content_image1 ||
      formData.section2_image_alt !== originalValues.section2_image_alt ||
      formData.content_image2 !== originalValues.content_image2 ||
      formData.section3_image_alt !== originalValues.section3_image_alt,
    meta: formData.author !== originalValues.author ||
      formData.author_slug !== originalValues.author_slug ||
      formData.read_time !== originalValues.read_time ||
      formData.icon_name !== originalValues.icon_name ||
      formData.color !== originalValues.color ||
      formData.bg_color !== originalValues.bg_color ||
      formData.is_published !== originalValues.is_published,
  };


  // Auto-split existing content into 3 parts when loading an article that has content but no split parts
  useEffect(() => {
    if (post?.content && !post?.content_part1 && !post?.content_part2 && !post?.content_part3) {
      // Split existing content by paragraph breaks
      const content = post.content;
      const paragraphs = content.split(/\n\n+/);
      const totalParas = paragraphs.length;

      if (totalParas >= 3) {
        // Distribute paragraphs across 3 sections
        const parasPerPart = Math.ceil(totalParas / 3);

        setFormData(prev => ({
          ...prev,
          content_part1: paragraphs.slice(0, parasPerPart).join('\n\n'),
          content_part2: paragraphs.slice(parasPerPart, parasPerPart * 2).join('\n\n'),
          content_part3: paragraphs.slice(parasPerPart * 2).join('\n\n'),
        }));
      } else if (totalParas === 2) {
        // 2 paragraphs: first goes to part1, second goes to part2
        setFormData(prev => ({
          ...prev,
          content_part1: paragraphs[0] || '',
          content_part2: paragraphs[1] || '',
          content_part3: '',
        }));
      } else {
        // 1 paragraph or less: all goes to part1
        setFormData(prev => ({
          ...prev,
          content_part1: content,
          content_part2: '',
          content_part3: '',
        }));
      }
    }
  }, [post?.content, post?.content_part1, post?.content_part2, post?.content_part3]);

  // Fetch silos for silo selector dropdown
  useEffect(() => {
    const fetchSilos = async () => {
      setSilosLoading(true);
      try {
        const { data, error } = await supabase
          .from('insights_silos')
          .select('id, name, slug, description')
          .order('name');

        if (error) {
          console.error('Failed to fetch silos:', error);
          return;
        }

        if (data) {
          setSilos(data);
        }
      } catch (err) {
        console.error('Error fetching silos:', err);
      } finally {
        setSilosLoading(false);
      }
    };

    fetchSilos();
  }, []);

  // Helper function to split content into 3 parts
  const splitContentIntoParts = (content: string) => {
    if (!content) return { part1: '', part2: '', part3: '' };

    // Remove image markdown syntax (keep only text content for splitting)
    const textOnly = content.replace(/!\[.*?\]\(.*?\)/g, '').trim();

    // Split by paragraph breaks
    const paragraphs = textOnly.split(/\n\n+/).filter(p => p.trim());
    const totalParas = paragraphs.length;

    if (totalParas >= 3) {
      // Distribute paragraphs across 3 sections
      const parasPerPart = Math.ceil(totalParas / 3);
      return {
        part1: paragraphs.slice(0, parasPerPart).join('\n\n'),
        part2: paragraphs.slice(parasPerPart, parasPerPart * 2).join('\n\n'),
        part3: paragraphs.slice(parasPerPart * 2).join('\n\n'),
      };
    } else if (totalParas === 2) {
      return {
        part1: paragraphs[0] || '',
        part2: paragraphs[1] || '',
        part3: '',
      };
    } else {
      return {
        part1: content,
        part2: '',
        part3: '',
      };
    }
  };

  // Helper function to combine parts into final content for preview/save
  const combineContent = () => {
    // Check if any split content exists
    const hasSplitContent = formData.content_part1 || formData.content_part2 || formData.content_part3;

    // If no split content, fall back to original content field
    if (!hasSplitContent) {
      return formData.content || '';
    }

    let combined = '';

    // Image 0 goes at the very beginning (after title, before section 1)
    if (formData.content_image0) {
      combined += `![](${formData.content_image0})\n\n`;
    }

    combined += formData.content_part1 || '';

    if (formData.content_image1) {
      combined += `\n\n![](${formData.content_image1})\n\n`;
    }

    if (formData.content_part2) {
      combined += (combined && !formData.content_image1 ? '\n\n' : '') + formData.content_part2;
    }

    if (formData.content_image2) {
      combined += `\n\n![](${formData.content_image2})\n\n`;
    }

    if (formData.content_part3) {
      combined += (combined && !formData.content_image2 ? '\n\n' : '') + formData.content_part3;
    }

    return combined;
  };

  // ========== INDIVIDUAL CARD SAVE FUNCTIONS (defined after combineContent) ==========

  // Individual card save function
  const saveCard = async (cardType: string, fields: string[]) => {
    if (isNew) {
      toast({ title: 'Save the full post first', description: 'Create the post before saving individual sections.', variant: 'destructive' });
      return;
    }

    setCardSaving(prev => ({ ...prev, [cardType]: true }));

    try {
      // Build update payload with only the specified fields
      const updatePayload: any = { updated_at: new Date().toISOString() };
      fields.forEach(field => {
        if (field === 'content') {
          // For content, also update combined content
          updatePayload.content = combineContent();
          updatePayload.content_part1 = formData.content_part1;
          updatePayload.content_part2 = formData.content_part2;
          updatePayload.content_part3 = formData.content_part3;
        } else {
          updatePayload[field] = (formData as any)[field];
        }
      });

      const { error } = await supabase
        .from('insights_posts')
        .update(updatePayload)
        .eq('id', post.id);

      if (error) throw error;

      toast({
        title: '✅ Saved!',
        description: `${cardType.charAt(0).toUpperCase() + cardType.slice(1)} updated successfully.`,
      });

      // Update original values to match current formData so hasChanges becomes false
      // This prevents the save button from showing again until user makes new edits
      if (cardType === 'basicInfo') {
        setOriginalValues(prev => ({
          ...prev,
          title: formData.title,
          slug: formData.slug,
          category: formData.category,
          description: formData.description,
        }));
      } else if (cardType === 'content') {
        setOriginalValues(prev => ({
          ...prev,
          content_part1: formData.content_part1,
          content_part2: formData.content_part2,
          content_part3: formData.content_part3,
        }));
      } else if (cardType === 'heroMedia') {
        setOriginalValues(prev => ({
          ...prev,
          hero_type: formData.hero_type,
          hero_url: formData.hero_url,
          video_url: formData.video_url,
        }));
      } else if (cardType === 'bodyImages') {
        setOriginalValues(prev => ({
          ...prev,
          content_image0: formData.content_image0,
          section1_image_alt: formData.section1_image_alt,
          content_image1: formData.content_image1,
          section2_image_alt: formData.section2_image_alt,
          content_image2: formData.content_image2,
          section3_image_alt: formData.section3_image_alt,
        }));
      } else if (cardType === 'meta') {
        setOriginalValues(prev => ({
          ...prev,
          author: formData.author,
          author_slug: formData.author_slug,
          read_time: formData.read_time,
          icon_name: formData.icon_name,
          color: formData.color,
          bg_color: formData.bg_color,
          is_published: formData.is_published,
        }));
      }

      // Set saved state briefly to show success feedback
      setCardSaved(prev => ({ ...prev, [cardType]: true }));
      setTimeout(() => {
        setCardSaved(prev => ({ ...prev, [cardType]: false }));
      }, 2000);

      // Refresh to get updated data
      router.refresh();

    } catch (error: any) {
      toast({
        title: '❌ Save Failed',
        description: error.message,
        variant: 'destructive',
      });
    }

    setCardSaving(prev => ({ ...prev, [cardType]: false }));
  };

  // Card-specific save handlers
  const saveBasicInfo = () => saveCard('basicInfo', ['title', 'slug', 'category', 'description']);
  const saveContent = () => saveCard('content', ['content']);
  const saveHeroMedia = () => saveCard('heroMedia', ['hero_type', 'hero_url', 'video_url']);
  const saveBodyImages = () => saveCard('bodyImages', [
    'content_image0', 'section1_image_alt',
    'content_image1', 'section2_image_alt',
    'content_image2', 'section3_image_alt'
  ]);
  const saveMeta = () => saveCard('meta', ['author', 'author_slug', 'read_time', 'icon_name', 'color', 'bg_color', 'is_published']);

  // Reusable Card Header with Edit/Save buttons
  const CardHeaderWithSave = ({
    title,
    cardType,
    hasChanges,
    onSave,
    isSaving,
    isSaved,
    children
  }: {
    title: string;
    cardType: string;
    hasChanges: boolean;
    onSave: () => void;
    isSaving: boolean;
    isSaved?: boolean;
    children?: React.ReactNode;
  }) => (
    <CardHeader className="flex flex-row items-center justify-between pb-2">
      <div className="flex items-center gap-3">
        <CardTitle className="text-base">{title}</CardTitle>
        {hasChanges && !isNew && !isSaved && (
          <Badge variant="outline" className="text-[10px] px-2 py-0 border-yellow-500/50 text-yellow-400 animate-pulse">
            Unsaved
          </Badge>
        )}
        {isSaved && (
          <Badge variant="outline" className="text-[10px] px-2 py-0 border-green-500/50 text-green-400">
            ✓ Saved
          </Badge>
        )}
      </div>
      <div className="flex items-center gap-2">
        {children}
        {/* Show Save button when there are unsaved changes */}
        {hasChanges && !isNew && !isSaved && (
          <Button
            size="sm"
            onClick={onSave}
            disabled={isSaving}
            className={`h-7 text-xs text-white transition-all ${isSaving
              ? 'bg-yellow-600 hover:bg-yellow-500'
              : 'bg-green-600 hover:bg-green-500'
              }`}
          >
            {isSaving ? (
              <>
                <Loader2 className="w-3 h-3 mr-1 animate-spin" />
                Saving...
              </>
            ) : (
              <>
                <Save className="w-3 h-3 mr-1" />
                Save
              </>
            )}
          </Button>
        )}
        {/* Show Saved button after successful save */}
        {isSaved && (
          <Button
            size="sm"
            disabled
            className="h-7 text-xs bg-green-700 text-white cursor-default opacity-80"
          >
            <CheckCircle className="w-3 h-3 mr-1" />
            Saved
          </Button>
        )}
      </div>
    </CardHeader>
  );

  // Get preview data with combined content
  const getPreviewData = () => ({
    ...formData,
    content: combineContent(),
  });

  const [seoData, setSeoData] = useState({
    meta_title: post?.seo?.meta_title || '',
    meta_description: post?.seo?.meta_description || '',
    keywords: post?.seo?.keywords?.join(', ') || '',
    canonical_url: post?.seo?.canonical_url || '',
    // Pipeline-aligned fields
    focus_keyword: post?.seo?.focus_keyword || '',
    secondary_keywords: post?.seo?.secondary_keywords || [],
    schema_markup: post?.seo?.schema_markup || null,
  });

  // Check if hero media has changed (image, video, or type)
  const hasHeroMediaChanges =
    formData.hero_url !== originalHeroUrl ||
    formData.video_url !== originalVideoUrl ||
    formData.hero_type !== originalHeroType;

  const handleAiImprove = async () => {
    // Get content to optimize - prefer split parts, fallback to content field
    const contentToOptimize = combineContent();

    if (!contentToOptimize || !contentToOptimize.trim()) {
      toast({
        title: 'No Content',
        description: 'Please add some content before optimizing.',
        variant: 'destructive',
      });
      return;
    }

    setAiLoading(true);
    try {
      const response = await fetch('/api/insights/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          content: contentToOptimize,
          type: 'improve'
        })
      });

      const data = await response.json();

      if (data.error) throw new Error(data.error);

      // Split the optimized content back into three parts
      const { part1, part2, part3 } = splitContentIntoParts(data.result);

      // Update formData with optimized split parts
      setFormData(prev => ({
        ...prev,
        content_part1: part1,
        content_part2: part2,
        content_part3: part3,
        // Also update content field as fallback
        content: data.result,
      }));

      toast({
        title: 'Content Optimized',
        description: 'Applied RankMath SEO standards & Ate Yna persona. Content divided into 3 sections.',
      });
    } catch (error: any) {
      toast({
        title: 'AI Error',
        description: error.message || 'Failed to improve content',
        variant: 'destructive',
      });
    }
    setAiLoading(false);
  };

  // State to track which section is being improved
  const [sectionImproving, setSectionImproving] = useState<number | null>(null);

  // Improve a single content section
  const handleImproveSingleSection = async (sectionNumber: 1 | 2 | 3) => {
    const sectionKey = `content_part${sectionNumber}` as keyof typeof formData;
    const sectionContent = formData[sectionKey] as string;

    console.log(`[Improve] Starting improvement for Section ${sectionNumber}`);
    console.log(`[Improve] Section key: ${sectionKey}`);
    console.log(`[Improve] Content length: ${sectionContent?.length || 0} chars`);

    if (!sectionContent || !sectionContent.trim()) {
      toast({
        title: 'No Content',
        description: `Please add content to Section ${sectionNumber} before improving.`,
        variant: 'destructive',
      });
      return;
    }

    const sectionNames = { 1: 'Introduction', 2: 'Main Body', 3: 'Conclusion' };

    setSectionImproving(sectionNumber);
    try {
      const response = await fetch('/api/insights/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          content: sectionContent,
          type: 'improve_section',
          sectionType: sectionNames[sectionNumber],
          title: formData.title,
          category: formData.category,
        })
      });

      const data = await response.json();

      console.log(`[Improve] API Response keys:`, Object.keys(data));
      console.log(`[Improve] Result length: ${data.result?.length || 0} chars`);

      if (data.error) throw new Error(data.error);

      // Update ONLY the specific section - do not spread any other fields from response
      const improvedContent = data.result || sectionContent;
      console.log(`[Improve] Updating ONLY ${sectionKey} with improved content`);

      setFormData(prev => {
        const updated = {
          ...prev,
          [sectionKey]: improvedContent,
        };
        console.log(`[Improve] Updated form data - Section 1 changed: ${updated.content_part1 !== prev.content_part1}`);
        console.log(`[Improve] Updated form data - Section 2 changed: ${updated.content_part2 !== prev.content_part2}`);
        console.log(`[Improve] Updated form data - Section 3 changed: ${updated.content_part3 !== prev.content_part3}`);
        return updated;
      });

      toast({
        title: `✨ Section ${sectionNumber} Improved!`,
        description: `${sectionNames[sectionNumber]} optimized with Ate Yna style.`,
      });
    } catch (error: any) {
      console.error(`[Improve] Error:`, error);
      toast({
        title: 'AI Error',
        description: error.message || 'Failed to improve section',
        variant: 'destructive',
      });
    }
    setSectionImproving(null);
  };

  // Generate description with AI
  const handleGenerateDescription = async () => {
    if (!formData.title) {
      toast({
        title: 'Title Required',
        description: 'Please add a title first to generate a description.',
        variant: 'destructive',
      });
      return;
    }

    setDescriptionLoading(true);
    try {
      const response = await fetch('/api/insights/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: formData.title,
          category: formData.category,
          content: formData.content_part1 || '',
          type: 'generate_description'
        })
      });

      const data = await response.json();

      if (data.error) throw new Error(data.error);

      if (data.result) {
        setFormData(prev => ({ ...prev, description: data.result }));
        toast({
          title: '✨ Description Generated!',
          description: 'SEO-optimized description created. Review and save.',
        });
      }
    } catch (error: any) {
      toast({
        title: 'Generation Failed',
        description: error.message || 'Could not generate description',
        variant: 'destructive',
      });
    }
    setDescriptionLoading(false);
  };

  const handleAiGenerateFull = async () => {
    if (!formData.title) {
      toast({
        title: 'Title Required',
        description: 'Please add a title before generating the full article.',
        variant: 'destructive',
      });
      return;
    }

    setAiLoading(true);
    try {
      const response = await fetch('/api/insights/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          content: formData.content_part1 || '', // Use existing intro if any
          title: formData.title,
          description: formData.description,
          category: formData.category,
          type: 'generate_full'
        })
      });

      const data = await response.json();

      if (data.error) throw new Error(data.error);

      // Update formData with the generated content parts
      setFormData(prev => ({
        ...prev,
        content_part1: data.content_part1 || prev.content_part1,
        content_part2: data.content_part2 || prev.content_part2,
        content_part3: data.content_part3 || prev.content_part3,
      }));

      toast({
        title: '✨ Full Article Generated!',
        description: 'All 3 sections have been created. Review and click "Save Post" to save.',
      });
    } catch (error: any) {
      toast({
        title: 'AI Error',
        description: error.message || 'Failed to generate article',
        variant: 'destructive',
      });
    }
    setAiLoading(false);
  };

  const handleLinkSuggestions = async () => {
    // Get content to analyze - prefer split parts, fallback to content field
    const contentToAnalyze = combineContent();

    if (!contentToAnalyze || !contentToAnalyze.trim()) {
      toast({
        title: 'No Content',
        description: 'Please add some content before generating link suggestions.',
        variant: 'destructive',
      });
      return;
    }

    setAiLoading(true);
    setLinkSuggestions([]);

    try {
      // 1. Fetch available posts for context
      const { data: posts } = await supabase.from('insights_posts').select('title, slug').neq('id', post?.id);

      // 2. Ask AI for suggestions
      const response = await fetch('/api/insights/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          content: contentToAnalyze,
          type: 'suggest_links',
          context_posts: posts
        })
      });

      const data = await response.json();
      if (data.suggestions) {
        setLinkSuggestions(data.suggestions);
        if (data.suggestions.length === 0) {
          toast({ title: 'No links found', description: 'AI couldn\'t find relevant anchor text matches.' });
        }
      }

    } catch (error) {
      console.error(error);
      toast({ title: 'Error', description: 'Failed to generate link suggestions', variant: 'destructive' });
    }
    setAiLoading(false);
  };

  const applyLink = async (suggestion: any) => {
    if (!post?.id) {
      toast({
        title: 'Save Post First',
        description: 'Please save the post before adding links.',
        variant: 'destructive'
      });
      return;
    }

    try {
      // 1. Get target post info via API
      const targetRes = await fetch(`/api/insights/links?slug=${suggestion.slug}`);
      const targetPost = await targetRes.json();

      if (targetPost.error) {
        toast({ title: 'Error', description: 'Target article not found', variant: 'destructive' });
        return;
      }

      // 2. Create link object with both original and optimized text
      const originalText = suggestion.original_text || suggestion.anchor_text;
      const newLink = {
        original_text: originalText,  // What to find in content
        anchor_text: suggestion.anchor_text,  // What to replace with (linked)
        target_slug: suggestion.slug,
        target_title: targetPost.title,
        target_id: targetPost.id,
        created_at: new Date().toISOString()
      };

      // 3. Save via API (bypasses RLS)
      const res = await fetch('/api/insights/links', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'add',
          postId: post.id,
          link: newLink
        })
      });

      const result = await res.json();

      if (result.error) {
        throw new Error(result.error);
      }

      // 4. Update local state
      setAppliedLinks(result.applied_links);
      setLinkSuggestions(prev => prev.filter(p => p.slug !== suggestion.slug));

      toast({
        title: '✅ Link Saved!',
        description: `"${originalText}" → "${suggestion.anchor_text}" linked to /${suggestion.slug}`
      });

    } catch (error: any) {
      console.error('Apply link error:', error);
      toast({
        title: 'Error Saving Link',
        description: error.message,
        variant: 'destructive'
      });
    }
  };

  const removeAppliedLink = async (index: number) => {
    if (!post?.id) return;

    try {
      const res = await fetch('/api/insights/links', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'remove',
          postId: post.id,
          linkIndex: index
        })
      });

      const result = await res.json();

      if (result.error) {
        throw new Error(result.error);
      }

      setAppliedLinks(result.applied_links);
      toast({ title: 'Link Removed' });
    } catch (error: any) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    }
  };

  const handleSave = async () => {
    setLoading(true);
    setSaveStatus({ state: 'saving', message: 'Saving post...' });

    try {
      // 1. Upsert Post
      setSaveStatus({ state: 'saving', message: 'Updating article...' });

      // Only include fields that exist in the database
      // For pillar posts, use silo slug; for supporting articles, use article slug
      const selectedSilo = silos.find(s => s.id === formData.silo_id);
      const articleSlug = formData.is_pillar
        ? (formData.silo_topic || selectedSilo?.slug || formData.title.toLowerCase().replace(/ /g, '-').replace(/[^\w-]+/g, ''))
        : (formData.slug || formData.title.toLowerCase().replace(/ /g, '-').replace(/[^\w-]+/g, ''));

      // For pillar posts, category is locked to silo name
      const articleCategory = formData.is_pillar
        ? (selectedSilo?.name || formData.category)
        : formData.category;

      // Build postPayload matching Pipeline's publish route structure
      // Columns matching actual insights_posts table schema
      const postPayload: Record<string, any> = {
        // Basic content
        title: formData.title,
        slug: articleSlug,
        description: formData.description,
        content: combineContent(),
        content_part1: formData.content_part1,
        content_part2: formData.content_part2,
        content_part3: formData.content_part3,
        // Hero media
        hero_type: formData.hero_type,
        hero_url: formData.hero_url,
        video_url: formData.video_url,
        // Section images
        content_image0: formData.content_image0,
        content_image1: formData.content_image1,
        content_image2: formData.content_image2,
        section1_image_alt: formData.section1_image_alt,
        section2_image_alt: formData.section2_image_alt,
        section3_image_alt: formData.section3_image_alt,
        // Category and classification
        category: articleCategory,
        content_type: formData.is_pillar ? 'pillar' : 'supporting',
        is_pillar: formData.is_pillar || false,
        // Silo fields
        silo_id: formData.silo_id || null,
        silo_topic: formData.silo_topic || null,
        // Author fields
        author: formData.author,
        author_slug: formData.author_slug,
        author_name: formData.author,
        author_avatar: '/Chat Agent/Ate Yna.png',
        // Display styling
        icon_name: formData.icon_name,
        color: formData.color,
        bg_color: formData.bg_color,
        read_time: formData.read_time || `${Math.ceil(combineContent().split(/\s+/).length / 200)} min read`,
        // SEO field in posts table
        meta_description: formData.description,
        // Links and pipeline tracking
        applied_links: appliedLinks || [],
        pipeline_stage: formData.is_published ? 'published' : 'draft',
        humanization_score: formData.humanization_score || null,
        // Publication status
        is_published: formData.is_published,
        updated_at: new Date().toISOString(),
      };

      if (formData.is_published && !post?.published_at) {
        postPayload.published_at = new Date().toISOString();
      }

      let postId = post?.id;

      if (isNew) {
        const { data, error } = await supabase
          .from('insights_posts')
          .insert(postPayload)
          .select()
          .single();

        if (error) {
          console.error('❌ [SAVE] Insert error:', error.message, error.details, error.hint);
          throw new Error(error.message || 'Failed to create post');
        }
        postId = data.id;
      } else {
        const { error } = await supabase
          .from('insights_posts')
          .update(postPayload)
          .eq('id', postId);

        if (error) {
          console.error('❌ [SAVE] Update error:', error.message, error.details, error.hint);
          throw new Error(error.message || 'Failed to update post');
        }
      }

      // 2. Upsert SEO
      setSaveStatus({ state: 'saving', message: 'Saving SEO metadata...' });

      // Build canonical URL based on silo structure
      // Supporting articles: /insights/{silo-slug}/{article-slug}
      // Pillar articles: /insights/{silo-slug}
      const canonicalPath = formData.is_pillar
        ? `/insights/${formData.silo_topic || articleSlug}`
        : formData.silo_topic
          ? `/insights/${formData.silo_topic}/${articleSlug}`
          : `/insights/${articleSlug}`;

      const seoPayload = {
        post_id: postId,
        meta_title: seoData.meta_title || formData.title,
        meta_description: seoData.meta_description || formData.description,
        keywords: seoData.keywords.split(',').map((k: string) => k.trim()).filter(Boolean),
        canonical_url: seoData.canonical_url || `https://www.bpoc.io${canonicalPath}`,
        og_image: formData.og_image || formData.hero_url || null,
        schema_type: 'Article',
        schema_data: seoData.schema_markup || {},
        updated_at: new Date().toISOString(),
      };

      const { error: seoError } = await supabase
        .from('seo_metadata')
        .upsert(seoPayload, { onConflict: 'post_id' });

      if (seoError) throw seoError;

      // 3. Link pillar post to silo (if this is a pillar post)
      if (formData.is_pillar && formData.silo_id && formData.is_published) {
        console.log(`📌 Linking pillar post ${postId} to silo ${formData.silo_id}`);
        const { error: siloUpdateError } = await supabase
          .from('insights_silos')
          .update({ pillar_post_id: postId })
          .eq('id', formData.silo_id);

        if (siloUpdateError) {
          console.error('⚠️ Failed to link pillar post to silo:', siloUpdateError);
          // Don't throw - silo linking is not critical for save
        } else {
          console.log('✅ Pillar post linked to silo successfully');
        }
      }

      // SUCCESS!
      const successMsg = `✅ "${formData.title}" ${formData.is_published ? 'is now LIVE!' : 'saved as draft'}`;
      setSaveStatus({ state: 'success', message: successMsg });
      setImageUnsaved(false);

      toast({
        title: '🎉 Saved!',
        description: successMsg,
      });

      // Update original values to reflect saved state (prevents "unsaved changes" warning)
      setOriginalValues({
        title: formData.title,
        slug: formData.slug,
        category: formData.category,
        description: formData.description,
        content_part1: formData.content_part1,
        content_part2: formData.content_part2,
        content_part3: formData.content_part3,
        hero_type: formData.hero_type,
        hero_url: formData.hero_url,
        video_url: formData.video_url,
        content_image0: formData.content_image0,
        section1_image_alt: formData.section1_image_alt,
        content_image1: formData.content_image1,
        section2_image_alt: formData.section2_image_alt,
        content_image2: formData.content_image2,
        section3_image_alt: formData.section3_image_alt,
        author: formData.author,
        author_slug: formData.author_slug,
        read_time: formData.read_time,
        icon_name: formData.icon_name,
        color: formData.color,
        bg_color: formData.bg_color,
        is_published: formData.is_published,
        // Silo and classification
        silo_id: formData.silo_id,
        silo_topic: formData.silo_topic,
        is_pillar: formData.is_pillar,
        content_type: formData.content_type,
        // Open Graph
        og_image: formData.og_image,
        og_title: formData.og_title,
        og_description: formData.og_description,
        cover_image: formData.cover_image,
        cover_image_alt: formData.cover_image_alt,
        humanization_score: formData.humanization_score,
      });

      // Clear success after 3 seconds
      setTimeout(() => {
        setSaveStatus({ state: 'idle', message: '' });
      }, 3000);

      if (isNew) {
        // Redirect to edit page for new posts
        router.push(`/admin/insights/${postId}`);
      }
      // Don't refresh for existing posts - state is already updated

    } catch (error: any) {
      console.error('❌ [SAVE] Error:', error);
      console.error('❌ [SAVE] Error details:', JSON.stringify(error, null, 2));
      const errorMsg = error?.message || error?.error?.message || (typeof error === 'string' ? error : 'Failed to save post');
      setSaveStatus({ state: 'error', message: `❌ ${errorMsg}` });
      toast({
        title: '❌ Save Failed',
        description: errorMsg,
        variant: 'destructive',
      });
    }
    setLoading(false);
  };

  return (
    <div className="space-y-6">
      {/* Back Button */}
      <Button
        variant="ghost"
        onClick={() => router.push('/insights')}
        className="text-gray-400 hover:text-white hover:bg-white/5 -ml-2 mb-2"
      >
        <ArrowLeft className="w-4 h-4 mr-2" />
        Back to Insights Manager
      </Button>

      {/* Header with Stats */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-white">
            {isNew ? 'Create New Post' : `Edit: ${formData.title}`}
          </h1>
          {!isNew && (
            <div className="flex items-center gap-4 mt-2 text-sm">
              <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${formData.is_published ? 'bg-green-500/20 text-green-400' : 'bg-yellow-500/20 text-yellow-400'}`}>
                {formData.is_published ? '● LIVE' : '○ DRAFT'}
              </span>
              <span className="text-gray-400">
                <LinkIcon className="w-3 h-3 inline mr-1" />
                {appliedLinks.length} Active Links
              </span>
            </div>
          )}
        </div>
        <div className="flex gap-2">
          {/* Preview Mode Toggle */}
          <div className="flex items-center gap-1 p-1 rounded-lg bg-white/5 border border-white/10">
            <Button
              variant="ghost"
              size="sm"
              className={`h-8 px-3 ${previewMode === 'editor' ? 'bg-cyan-500/20 text-cyan-400' : 'text-gray-400 hover:text-white'}`}
              onClick={() => setPreviewMode('editor')}
            >
              <EyeOff className="w-4 h-4 mr-1.5" />
              Editor
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className={`h-8 px-3 ${previewMode === 'split' ? 'bg-purple-500/20 text-purple-400' : 'text-gray-400 hover:text-white'}`}
              onClick={() => setPreviewMode('split')}
            >
              <Columns className="w-4 h-4 mr-1.5" />
              Split
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className={`h-8 px-3 ${previewMode === 'preview' ? 'bg-green-500/20 text-green-400' : 'text-gray-400 hover:text-white'}`}
              onClick={() => setPreviewMode('preview')}
            >
              <Eye className="w-4 h-4 mr-1.5" />
              Preview
            </Button>
          </div>

          {!isNew && formData.slug && (
            <Button
              variant="outline"
              className="border-green-500/30 text-green-400 hover:bg-green-500/10"
              onClick={() => window.open(`/insights/${formData.slug}`, '_blank')}
            >
              <ExternalLink className="w-4 h-4 mr-2" />
              View Live
            </Button>
          )}
          <Button
            onClick={handleSave}
            disabled={loading}
            className={`min-w-[160px] ${saveStatus.state === 'success'
              ? 'bg-green-500 hover:bg-green-600'
              : saveStatus.state === 'error'
                ? 'bg-red-500 hover:bg-red-600'
                : hasHeroMediaChanges
                  ? 'bg-gradient-to-r from-yellow-500 to-orange-500 animate-pulse'
                  : 'bg-gradient-to-r from-cyan-500 to-blue-600'
              }`}
          >
            {saveStatus.state === 'saving' ? (
              <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Saving...</>
            ) : saveStatus.state === 'success' ? (
              <><CheckCircle className="w-4 h-4 mr-2" /> Saved!</>
            ) : saveStatus.state === 'error' ? (
              <><X className="w-4 h-4 mr-2" /> Failed</>
            ) : hasHeroMediaChanges ? (
              <><Save className="w-4 h-4 mr-2" /> Save Changes?</>
            ) : (
              <><Save className="w-4 h-4 mr-2" /> Save Post</>
            )}
          </Button>
        </div>
      </div>

      {/* SAVE STATUS BANNER - Big visible feedback */}
      {saveStatus.state !== 'idle' && (
        <div className={`p-4 rounded-lg border flex items-center gap-3 ${saveStatus.state === 'saving'
          ? 'bg-blue-500/10 border-blue-500/30'
          : saveStatus.state === 'success'
            ? 'bg-green-500/10 border-green-500/30'
            : 'bg-red-500/10 border-red-500/30'
          }`}>
          {saveStatus.state === 'saving' && <Loader2 className="w-5 h-5 text-blue-400 animate-spin" />}
          {saveStatus.state === 'success' && <CheckCircle className="w-5 h-5 text-green-400" />}
          {saveStatus.state === 'error' && <X className="w-5 h-5 text-red-400" />}
          <span className={`font-medium ${saveStatus.state === 'saving' ? 'text-blue-400'
            : saveStatus.state === 'success' ? 'text-green-400'
              : 'text-red-400'
            }`}>
            {saveStatus.message}
          </span>
          {saveStatus.state === 'success' && (
            <span className="text-xs text-gray-400 ml-auto">Dismissing in 5s...</span>
          )}
        </div>
      )}

      {/* Preview Only Mode */}
      {previewMode === 'preview' && (
        <div className="rounded-2xl border border-white/10">
          <ArticlePreview
            data={getPreviewData()}
            onClose={() => setPreviewMode('editor')}
          />
        </div>
      )}

      {/* Split View Mode */}
      {previewMode === 'split' && (
        <div className="grid grid-cols-2 gap-6">
          {/* Left: Editor */}
          <div className="space-y-6">
            <div className="flex items-center gap-2 mb-4">
              <div className="px-3 py-1.5 rounded-full bg-cyan-500/10 border border-cyan-500/30">
                <span className="text-sm font-medium text-cyan-400 flex items-center gap-2">
                  <EyeOff className="w-4 h-4" /> Editor
                </span>
              </div>
            </div>
            <Tabs defaultValue="content" className="w-full">
              <TabsList className="bg-white/5 border border-white/10 w-full justify-start p-1 h-auto rounded-xl mb-6">
                <TabsTrigger value="content" className="data-[state=active]:bg-cyan-500/20 data-[state=active]:text-cyan-400 text-xs">
                  Content
                </TabsTrigger>
                <TabsTrigger value="seo" className="data-[state=active]:bg-green-500/20 data-[state=active]:text-green-400 text-xs">
                  SEO
                </TabsTrigger>
              </TabsList>

              <TabsContent value="content">
                <Card className="bg-white/5 border-white/10">
                  <CardContent className="space-y-4 pt-4">
                    <div className="space-y-2">
                      <Label>Title</Label>
                      <Input
                        value={formData.title}
                        onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                        className="text-lg font-bold bg-black/20"
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>Slug</Label>
                        {formData.is_pillar ? (
                          <div className="h-10 px-3 rounded-md bg-black/30 border border-white/10 flex items-center">
                            <span className="text-xs text-gray-400 font-mono truncate">
                              /insights/{formData.silo_topic || '[silo]'}
                            </span>
                          </div>
                        ) : (
                          <Input
                            value={formData.slug}
                            onChange={(e) => setFormData({ ...formData, slug: e.target.value })}
                            className="font-mono text-sm bg-black/20"
                          />
                        )}
                      </div>
                      <div className="space-y-2">
                        <Label>Category</Label>
                        {formData.is_pillar ? (
                          <div className="h-10 px-3 rounded-md bg-black/30 border border-white/10 flex items-center">
                            <span className="text-xs text-gray-400 truncate">
                              {silos.find(s => s.id === formData.silo_id)?.name || '[silo]'}
                            </span>
                          </div>
                        ) : (
                          <Input
                            value={formData.category}
                            onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                            className="bg-black/20"
                          />
                        )}
                      </div>
                    </div>

                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <Label>Description</Label>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-6 px-2 text-purple-400 hover:text-purple-300 hover:bg-purple-500/10 text-xs"
                          onClick={handleGenerateDescription}
                          disabled={descriptionLoading || !formData.title}
                        >
                          {descriptionLoading ? (
                            <><Loader2 className="w-3 h-3 mr-1 animate-spin" /> Generating...</>
                          ) : (
                            <><Wand2 className="w-3 h-3 mr-1" /> AI Generate</>
                          )}
                        </Button>
                      </div>
                      <Textarea
                        value={formData.description}
                        onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                        className="bg-black/20 min-h-[80px]"
                        placeholder="SEO-friendly excerpt (120-160 chars ideal)"
                      />
                    </div>

                    {/* Split Content - Compact for Split View */}
                    <div className="space-y-4">
                      <div className="space-y-2">
                        <Label className="text-xs flex items-center gap-1">
                          <span className="w-5 h-5 rounded-full bg-cyan-500/20 text-cyan-400 flex items-center justify-center text-[10px] font-bold">1</span>
                          Section 1
                        </Label>
                        <Textarea
                          value={formData.content_part1}
                          onChange={(e) => setFormData({ ...formData, content_part1: e.target.value })}
                          className="bg-black/20 min-h-[120px] font-mono text-xs leading-relaxed"
                          placeholder="Introduction..."
                        />
                      </div>
                      <div className="space-y-2">
                        <Label className="text-xs flex items-center gap-1">
                          <span className="w-5 h-5 rounded-full bg-purple-500/20 text-purple-400 flex items-center justify-center text-[10px] font-bold">2</span>
                          Section 2
                        </Label>
                        <Textarea
                          value={formData.content_part2}
                          onChange={(e) => setFormData({ ...formData, content_part2: e.target.value })}
                          className="bg-black/20 min-h-[120px] font-mono text-xs leading-relaxed"
                          placeholder="Main body..."
                        />
                      </div>
                      <div className="space-y-2">
                        <Label className="text-xs flex items-center gap-1">
                          <span className="w-5 h-5 rounded-full bg-green-500/20 text-green-400 flex items-center justify-center text-[10px] font-bold">3</span>
                          Section 3
                        </Label>
                        <Textarea
                          value={formData.content_part3}
                          onChange={(e) => setFormData({ ...formData, content_part3: e.target.value })}
                          className="bg-black/20 min-h-[120px] font-mono text-xs leading-relaxed"
                          placeholder="Conclusion..."
                        />
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="seo">
                <Card className="bg-white/5 border-white/10">
                  <CardContent className="space-y-4 pt-4">
                    <div className="space-y-2">
                      <Label>Meta Title</Label>
                      <Input
                        value={seoData.meta_title}
                        onChange={(e) => setSeoData({ ...seoData, meta_title: e.target.value })}
                        className="bg-black/20"
                        placeholder="Defaults to post title"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Focus Keyword</Label>
                      <Input
                        value={seoData.focus_keyword}
                        onChange={(e) => setSeoData({ ...seoData, focus_keyword: e.target.value })}
                        className="bg-black/20"
                        placeholder="Primary keyword to target"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Keywords</Label>
                      <Textarea
                        value={seoData.keywords}
                        onChange={(e) => setSeoData({ ...seoData, keywords: e.target.value })}
                        className="bg-black/20 h-20"
                      />
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>
            </Tabs>
          </div>

          {/* Right: Preview */}
          <div className="space-y-6">
            <div className="flex items-center justify-between mb-4">
              <div className="px-3 py-1.5 rounded-full bg-green-500/10 border border-green-500/30">
                <span className="text-sm font-medium text-green-400 flex items-center gap-2">
                  <Eye className="w-4 h-4" /> Live Preview
                </span>
              </div>
              <Button
                variant="ghost"
                size="sm"
                className="text-gray-400 hover:text-white"
                onClick={() => setIsFullscreenPreview(true)}
              >
                <Maximize2 className="w-4 h-4 mr-1" /> Fullscreen
              </Button>
            </div>
            <div className="rounded-2xl border border-white/10">
              <ArticlePreview data={getPreviewData()} />
            </div>
          </div>
        </div>
      )}

      {/* Fullscreen Preview Modal */}
      {isFullscreenPreview && (
        <div className="fixed inset-0 z-50 bg-black">
          <ArticlePreview
            data={getPreviewData()}
            isFullscreen={true}
            onClose={() => setIsFullscreenPreview(false)}
          />
        </div>
      )}

      {/* Editor Only Mode (Default) */}
      {previewMode === 'editor' && (
        <Tabs defaultValue="content" className="w-full">
          <TabsList className="bg-white/5 border border-white/10 w-full justify-start p-1 h-auto rounded-xl mb-6">
            <TabsTrigger value="content" className="data-[state=active]:bg-cyan-500/20 data-[state=active]:text-cyan-400">
              Content Editor
            </TabsTrigger>
            <TabsTrigger value="links" disabled={isNew} className="data-[state=active]:bg-purple-500/20 data-[state=active]:text-purple-400">
              Link Graph
            </TabsTrigger>
            <TabsTrigger value="seo" className="data-[state=active]:bg-green-500/20 data-[state=active]:text-green-400">
              SEO & Metadata
            </TabsTrigger>
          </TabsList>

          <TabsContent value="content">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Main Content Area */}
              <div className="lg:col-span-2 space-y-6">
                <Card className="bg-white/5 border-white/10">
                  <CardHeaderWithSave
                    title="Content"
                    cardType="content"
                    hasChanges={hasCardChanges.content}
                    onSave={saveContent}
                    isSaving={cardSaving.content}
                    isSaved={cardSaved.content}
                  >
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-7 text-xs border-purple-500/30 text-purple-400 hover:bg-purple-500/10"
                      onClick={handleLinkSuggestions}
                      disabled={aiLoading}
                    >
                      {aiLoading ? <Loader2 className="w-3 h-3 mr-1 animate-spin" /> : <LinkIcon className="w-3 h-3 mr-1" />}
                      Interlink
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-7 text-xs border-green-500/30 text-green-400 hover:bg-green-500/10"
                      onClick={handleAiGenerateFull}
                      disabled={aiLoading || !formData.title}
                    >
                      {aiLoading ? <Loader2 className="w-3 h-3 mr-1 animate-spin" /> : <Wand2 className="w-3 h-3 mr-1" />}
                      AI Generate
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-7 text-xs border-cyan-500/30 text-cyan-400 hover:bg-cyan-500/10"
                      onClick={handleAiImprove}
                      disabled={aiLoading}
                    >
                      {aiLoading ? <Loader2 className="w-3 h-3 mr-1 animate-spin" /> : <Sparkles className="w-3 h-3 mr-1" />}
                      Optimize
                    </Button>
                  </CardHeaderWithSave>
                  <CardContent className="space-y-4">
                    {/* Link Suggestions Panel */}
                    {linkSuggestions.length > 0 && (
                      <div className="mb-4 p-4 bg-purple-500/10 border border-purple-500/20 rounded-lg">
                        <h4 className="text-sm font-bold text-purple-300 mb-3 flex items-center gap-2">
                          <Zap className="w-3 h-3" /> AI Link Suggestions
                        </h4>
                        <div className="space-y-3">
                          {linkSuggestions.map((s, i) => (
                            <div key={i} className="bg-black/30 p-3 rounded-lg border border-white/10">
                              <div className="flex items-start justify-between gap-3">
                                <div className="flex-1 space-y-1">
                                  <div className="text-xs text-gray-500">
                                    Find: <span className="text-yellow-400 font-mono">"{s.original_text || s.anchor_text}"</span>
                                  </div>
                                  <div className="text-sm">
                                    <span className="text-gray-400">Replace with: </span>
                                    <strong className="text-green-400">"{s.anchor_text}"</strong>
                                    <span className="text-gray-400"> → </span>
                                    <span className="text-cyan-400 text-xs">/{s.slug}</span>
                                  </div>
                                  {s.reason && <div className="text-[10px] text-gray-600 italic mt-1">{s.reason}</div>}
                                </div>
                                <Button size="sm" className="h-7 text-xs bg-purple-600 hover:bg-purple-500 shrink-0" onClick={() => applyLink(s)}>
                                  Apply
                                </Button>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Applied Links Display */}
                    {appliedLinks.length > 0 && (
                      <div className="mb-4 p-4 bg-green-500/10 border border-green-500/20 rounded-lg">
                        <h4 className="text-sm font-bold text-green-300 mb-3 flex items-center gap-2">
                          <CheckCircle className="w-3 h-3" /> Active Links ({appliedLinks.length})
                        </h4>
                        <div className="space-y-2">
                          {appliedLinks.map((link, i) => (
                            <div key={i} className="flex items-center justify-between bg-black/20 p-2 rounded border border-white/5">
                              <div className="text-sm space-y-0.5">
                                {link.original_text && link.original_text !== link.anchor_text && (
                                  <div className="text-[10px] text-gray-500">
                                    Find: <span className="text-yellow-400">"{link.original_text}"</span>
                                  </div>
                                )}
                                <div>
                                  <strong className="text-green-400">"{link.anchor_text}"</strong>
                                  <span className="text-gray-400"> → </span>
                                  <span className="text-cyan-400 text-xs">/{link.target_slug}</span>
                                </div>
                              </div>
                              <Button
                                size="sm"
                                variant="ghost"
                                className="h-6 w-6 p-0 text-red-400 hover:text-red-300 hover:bg-red-500/10"
                                onClick={() => removeAppliedLink(i)}
                              >
                                <X className="w-3 h-3" />
                              </Button>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    <div className="space-y-2">
                      <Label>Title</Label>
                      <Input
                        value={formData.title}
                        onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                        className="text-lg font-bold bg-black/20"
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>Slug (URL)</Label>
                        {formData.is_pillar ? (
                          // Pillar posts have fixed URLs based on silo
                          <div className="space-y-1">
                            <div className="h-10 px-3 rounded-md bg-black/30 border border-white/10 flex items-center">
                              <span className="text-sm text-gray-400 font-mono">
                                /insights/{formData.silo_topic || silos.find(s => s.id === formData.silo_id)?.slug || '[select-silo]'}
                              </span>
                            </div>
                            <p className="text-xs text-yellow-400/80">
                              Pillar post URL is fixed to the silo landing page
                            </p>
                          </div>
                        ) : (
                          // Supporting articles have editable slugs
                          <div className="space-y-1">
                            <Input
                              value={formData.slug}
                              onChange={(e) => setFormData({ ...formData, slug: e.target.value })}
                              className="font-mono text-sm bg-black/20"
                            />
                            {formData.silo_topic && (
                              <p className="text-xs text-gray-500">
                                Full URL: /insights/{formData.silo_topic}/{formData.slug || '[slug]'}
                              </p>
                            )}
                          </div>
                        )}
                      </div>
                      <div className="space-y-2">
                        <Label>Category</Label>
                        {formData.is_pillar ? (
                          // Pillar posts have category locked to silo
                          <div className="h-10 px-3 rounded-md bg-black/30 border border-white/10 flex items-center">
                            <span className="text-sm text-gray-400">
                              {silos.find(s => s.id === formData.silo_id)?.name || formData.category || '[select-silo]'}
                            </span>
                          </div>
                        ) : (
                          <Input
                            value={formData.category}
                            onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                            className="bg-black/20"
                          />
                        )}
                      </div>
                    </div>

                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <Label>Description (Excerpt)</Label>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-7 px-3 text-purple-400 hover:text-purple-300 hover:bg-purple-500/10 text-xs border border-purple-500/30"
                          onClick={handleGenerateDescription}
                          disabled={descriptionLoading || !formData.title}
                        >
                          {descriptionLoading ? (
                            <><Loader2 className="w-3 h-3 mr-1.5 animate-spin" /> Generating...</>
                          ) : (
                            <><Wand2 className="w-3 h-3 mr-1.5" /> Generate with AI</>
                          )}
                        </Button>
                      </div>
                      <Textarea
                        value={formData.description}
                        onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                        className="bg-black/20 min-h-[100px]"
                        placeholder="SEO-friendly excerpt describing your article (120-160 characters ideal for search results)"
                      />
                      <p className="text-[10px] text-gray-500">
                        {formData.description.length}/160 characters {formData.description.length >= 120 && formData.description.length <= 160 ? '✓ Optimal' : formData.description.length > 160 ? '⚠️ Too long' : ''}
                      </p>
                    </div>

                    {/* Split Content Sections */}
                    <div className="space-y-6">
                      {/* Featured Image Indicator (After Title) */}
                      {formData.content_image0 && (
                        <div className="flex items-center gap-3 p-3 rounded-lg bg-yellow-500/10 border border-yellow-500/20">
                          <div className="relative group cursor-pointer" onClick={() => setPreviewImageUrl(formData.content_image0)}>
                            <img src={formData.content_image0} alt="" className="w-16 h-16 object-cover rounded" />
                            <div className="absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity rounded">
                              <Eye className="w-5 h-5 text-white" />
                            </div>
                          </div>
                          <div>
                            <p className="text-xs text-yellow-400 font-medium">⭐ Featured Image will appear here</p>
                            <p className="text-[10px] text-gray-500">Uploaded via Body Images card</p>
                          </div>
                        </div>
                      )}

                      {/* Section 1 */}
                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <Label className="flex items-center gap-2">
                            <span className="w-7 h-7 rounded-full bg-cyan-500/20 border border-cyan-500/30 flex items-center justify-center text-cyan-400 text-sm font-bold">1</span>
                            Content Section 1 (Introduction)
                          </Label>
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-7 text-xs border-cyan-500/30 text-cyan-400 hover:bg-cyan-500/10"
                            onClick={() => handleImproveSingleSection(1)}
                            disabled={sectionImproving !== null || !formData.content_part1?.trim()}
                          >
                            {sectionImproving === 1 ? (
                              <><Loader2 className="w-3 h-3 mr-1 animate-spin" /> Improving...</>
                            ) : (
                              <><Sparkles className="w-3 h-3 mr-1" /> Improve</>
                            )}
                          </Button>
                        </div>
                        <Textarea
                          value={formData.content_part1}
                          onChange={(e) => setFormData({ ...formData, content_part1: e.target.value })}
                          className="bg-black/20 min-h-[200px] font-mono text-sm leading-relaxed"
                          placeholder="Start writing your article introduction here..."
                        />
                      </div>

                      {/* Image 1 Indicator */}
                      {formData.content_image1 && (
                        <div className="flex items-center gap-3 p-3 rounded-lg bg-cyan-500/10 border border-cyan-500/20">
                          <div className="relative group cursor-pointer" onClick={() => setPreviewImageUrl(formData.content_image1)}>
                            <img src={formData.content_image1} alt="" className="w-16 h-16 object-cover rounded" />
                            <div className="absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity rounded">
                              <Eye className="w-5 h-5 text-white" />
                            </div>
                          </div>
                          <div>
                            <p className="text-xs text-cyan-400 font-medium">📷 Image 1 will appear here</p>
                            <p className="text-[10px] text-gray-500">Uploaded via Body Images card</p>
                          </div>
                        </div>
                      )}

                      {/* Section 2 */}
                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <Label className="flex items-center gap-2">
                            <span className="w-7 h-7 rounded-full bg-purple-500/20 border border-purple-500/30 flex items-center justify-center text-purple-400 text-sm font-bold">2</span>
                            Content Section 2 (Main Body)
                          </Label>
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-7 text-xs border-purple-500/30 text-purple-400 hover:bg-purple-500/10"
                            onClick={() => handleImproveSingleSection(2)}
                            disabled={sectionImproving !== null || !formData.content_part2?.trim()}
                          >
                            {sectionImproving === 2 ? (
                              <><Loader2 className="w-3 h-3 mr-1 animate-spin" /> Improving...</>
                            ) : (
                              <><Sparkles className="w-3 h-3 mr-1" /> Improve</>
                            )}
                          </Button>
                        </div>
                        <Textarea
                          value={formData.content_part2}
                          onChange={(e) => setFormData({ ...formData, content_part2: e.target.value })}
                          className="bg-black/20 min-h-[200px] font-mono text-sm leading-relaxed"
                          placeholder="Continue with the main content..."
                        />
                      </div>

                      {/* Image 2 Indicator */}
                      {formData.content_image2 && (
                        <div className="flex items-center gap-3 p-3 rounded-lg bg-purple-500/10 border border-purple-500/20">
                          <div className="relative group cursor-pointer" onClick={() => setPreviewImageUrl(formData.content_image2)}>
                            <img src={formData.content_image2} alt="" className="w-16 h-16 object-cover rounded" />
                            <div className="absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity rounded">
                              <Eye className="w-5 h-5 text-white" />
                            </div>
                          </div>
                          <div>
                            <p className="text-xs text-purple-400 font-medium">📷 Image 2 will appear here</p>
                            <p className="text-[10px] text-gray-500">Uploaded via Body Images card</p>
                          </div>
                        </div>
                      )}

                      {/* Section 3 */}
                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <Label className="flex items-center gap-2">
                            <span className="w-7 h-7 rounded-full bg-green-500/20 border border-green-500/30 flex items-center justify-center text-green-400 text-sm font-bold">3</span>
                            Content Section 3 (Conclusion)
                          </Label>
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-7 text-xs border-green-500/30 text-green-400 hover:bg-green-500/10"
                            onClick={() => handleImproveSingleSection(3)}
                            disabled={sectionImproving !== null || !formData.content_part3?.trim()}
                          >
                            {sectionImproving === 3 ? (
                              <><Loader2 className="w-3 h-3 mr-1 animate-spin" /> Improving...</>
                            ) : (
                              <><Sparkles className="w-3 h-3 mr-1" /> Improve</>
                            )}
                          </Button>
                        </div>
                        <Textarea
                          value={formData.content_part3}
                          onChange={(e) => setFormData({ ...formData, content_part3: e.target.value })}
                          className="bg-black/20 min-h-[200px] font-mono text-sm leading-relaxed"
                          placeholder="Wrap up your article with conclusion..."
                        />
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Sidebar Settings */}
              <div className="space-y-6">
                {/* Publishing Settings */}
                <Card className="bg-white/5 border-white/10">
                  <CardHeaderWithSave
                    title="🌐 Publishing & Meta"
                    cardType="meta"
                    hasChanges={hasCardChanges.meta}
                    onSave={saveMeta}
                    isSaving={cardSaving.meta}
                    isSaved={cardSaved.meta}
                  />
                  <CardContent className="space-y-4">
                    <div className="flex items-center justify-between p-3 rounded-lg bg-black/20 border border-white/5">
                      <Label>Published Status</Label>
                      <div
                        className={`cursor-pointer px-3 py-1 rounded-full text-xs font-bold transition-colors ${formData.is_published ? 'bg-green-500/20 text-green-400' : 'bg-yellow-500/20 text-yellow-400'}`}
                        onClick={() => setFormData({ ...formData, is_published: !formData.is_published })}
                      >
                        {formData.is_published ? 'LIVE' : 'DRAFT'}
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label>Author</Label>
                      <Input
                        value={formData.author}
                        onChange={(e) => setFormData({ ...formData, author: e.target.value })}
                        className="bg-black/20"
                      />
                    </div>

                    <div className="space-y-2">
                      <Label>Read Time</Label>
                      <Input
                        value={formData.read_time}
                        onChange={(e) => setFormData({ ...formData, read_time: e.target.value })}
                        className="bg-black/20"
                      />
                    </div>
                  </CardContent>
                </Card>

                {/* Content Classification - Silo & Pillar Status */}
                <Card className="bg-white/5 border-white/10">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-base flex items-center gap-2">
                      <Globe className="w-4 h-4 text-blue-400" />
                      Content Classification
                      {formData.is_pillar && (
                        <Badge variant="outline" className="ml-2 border-yellow-500/50 text-yellow-400 text-[10px]">
                          LOCKED
                        </Badge>
                      )}
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {/* Locked notice for pillar posts */}
                    {formData.is_pillar && (
                      <div className="p-2 rounded-lg bg-yellow-500/10 border border-yellow-500/20">
                        <p className="text-xs text-yellow-400">
                          Pillar post classification cannot be changed in this manager.
                        </p>
                      </div>
                    )}

                    {/* Silo Selection */}
                    <div className="space-y-2">
                      <Label>Silo Topic</Label>
                      {formData.is_pillar ? (
                        // Locked for pillar posts
                        <div className="h-10 px-3 rounded-md bg-black/30 border border-white/10 flex items-center">
                          <span className="text-sm text-gray-400">
                            {silos.find(s => s.id === formData.silo_id)?.name || formData.silo_topic || 'Unknown Silo'}
                          </span>
                        </div>
                      ) : (
                        // Editable for supporting articles
                        <select
                          value={formData.silo_id}
                          onChange={(e) => {
                            const selectedSilo = silos.find(s => s.id === e.target.value);
                            setFormData({
                              ...formData,
                              silo_id: e.target.value,
                              silo_topic: selectedSilo?.slug || '',
                            });
                          }}
                          className="w-full h-10 px-3 rounded-md bg-black/20 border border-white/10 text-sm text-white focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                          disabled={silosLoading}
                        >
                          <option value="">No silo (standalone article)</option>
                          {silos.map(silo => (
                            <option key={silo.id} value={silo.id}>
                              {silo.name}
                            </option>
                          ))}
                        </select>
                      )}
                      {silosLoading && (
                        <p className="text-xs text-gray-500">Loading silos...</p>
                      )}
                    </div>

                    {/* Pillar Article Toggle */}
                    {formData.silo_id && (
                      <div className="flex items-center justify-between p-3 rounded-lg bg-black/20 border border-white/5">
                        <div>
                          <Label className="text-sm">Pillar Article</Label>
                          <p className="text-xs text-gray-500">
                            {formData.is_pillar ? 'This is the main article for this silo' : 'Main article for this silo topic'}
                          </p>
                        </div>
                        {formData.is_pillar ? (
                          // Locked badge for pillar posts
                          <div className="px-3 py-1 rounded-full text-xs font-bold bg-blue-500/20 text-blue-400 border border-blue-500/30">
                            PILLAR
                          </div>
                        ) : (
                          // Toggleable for non-pillar articles
                          <div
                            className="cursor-pointer px-3 py-1 rounded-full text-xs font-bold transition-colors bg-gray-500/20 text-gray-400 hover:bg-blue-500/20 hover:text-blue-400"
                            onClick={() => setFormData({
                              ...formData,
                              is_pillar: true,
                              content_type: 'pillar',
                            })}
                          >
                            SUPPORTING
                          </div>
                        )}
                      </div>
                    )}

                    {/* Content Type Badge */}
                    {formData.silo_id && (
                      <div className="text-xs text-gray-500">
                        Type: <Badge variant="outline" className={formData.is_pillar ? 'border-blue-500/50 text-blue-400' : 'border-gray-500/50 text-gray-400'}>
                          {formData.content_type || 'supporting'}
                        </Badge>
                      </div>
                    )}
                  </CardContent>
                </Card>

                {/* Hero Media Section - Image or Video */}
                <Card className="bg-white/5 border-white/10">
                  <CardHeaderWithSave
                    title={formData.hero_type === 'video' ? '🎬 Hero Video' : '🖼️ Hero Image'}
                    cardType="heroMedia"
                    hasChanges={hasCardChanges.heroMedia}
                    onSave={saveHeroMedia}
                    isSaving={cardSaving.heroMedia}
                    isSaved={cardSaved.heroMedia}
                  />
                  <CardContent className="space-y-4">

                    {/* ========== NO MEDIA - SHOW TYPE SELECTION ========== */}
                    {!formData.hero_url && !formData.video_url && (
                      <div className="space-y-4">
                        <div className="text-center py-2">
                          <p className="text-sm text-gray-400 mb-4">What type of hero media do you want?</p>
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                          {/* Image Option Card */}
                          <button
                            onClick={() => setFormData({ ...formData, hero_type: 'image' })}
                            className={`relative p-4 rounded-xl border-2 transition-all duration-200 text-left group hover:scale-[1.02] ${formData.hero_type === 'image'
                              ? 'border-purple-500 bg-purple-500/10 shadow-lg shadow-purple-500/20'
                              : 'border-white/10 bg-white/5 hover:border-purple-500/50 hover:bg-purple-500/5'
                              }`}
                          >
                            {formData.hero_type === 'image' && (
                              <div className="absolute top-2 right-2">
                                <CheckCircle className="w-5 h-5 text-purple-400" />
                              </div>
                            )}
                            <div className={`w-12 h-12 rounded-xl flex items-center justify-center mb-3 ${formData.hero_type === 'image' ? 'bg-purple-500/20' : 'bg-white/10 group-hover:bg-purple-500/10'
                              }`}>
                              <ImageIcon className={`w-6 h-6 ${formData.hero_type === 'image' ? 'text-purple-400' : 'text-gray-400 group-hover:text-purple-400'}`} />
                            </div>
                            <p className={`font-semibold flex items-center gap-1.5 ${formData.hero_type === 'image' ? 'text-purple-400' : 'text-white'}`}>
                              <ImageIcon className="w-4 h-4" /> Image
                            </p>
                            <p className="text-[11px] text-gray-500 mt-1">
                              AI generate with Gemini or upload
                            </p>
                          </button>

                          {/* Video Option Card */}
                          <button
                            onClick={() => setFormData({ ...formData, hero_type: 'video' })}
                            className={`relative p-4 rounded-xl border-2 transition-all duration-200 text-left group hover:scale-[1.02] ${formData.hero_type === 'video'
                              ? 'border-red-500 bg-red-500/10 shadow-lg shadow-red-500/20'
                              : 'border-white/10 bg-white/5 hover:border-red-500/50 hover:bg-red-500/5'
                              }`}
                          >
                            {formData.hero_type === 'video' && (
                              <div className="absolute top-2 right-2">
                                <CheckCircle className="w-5 h-5 text-red-400" />
                              </div>
                            )}
                            <div className={`w-12 h-12 rounded-xl flex items-center justify-center mb-3 ${formData.hero_type === 'video' ? 'bg-red-500/20' : 'bg-white/10 group-hover:bg-red-500/10'
                              }`}>
                              <Video className={`w-6 h-6 ${formData.hero_type === 'video' ? 'text-red-400' : 'text-gray-400 group-hover:text-red-400'}`} />
                            </div>
                            <p className={`font-semibold flex items-center gap-1.5 ${formData.hero_type === 'video' ? 'text-red-400' : 'text-white'}`}>
                              <Video className="w-4 h-4" /> Video
                            </p>
                            <p className="text-[11px] text-gray-500 mt-1">
                              Upload MP4, WebM, MOV
                            </p>
                          </button>
                        </div>
                      </div>
                    )}

                    {/* ========== HAS MEDIA - SHOW CHANGE TYPE OPTION ========== */}
                    {(formData.hero_url || formData.video_url) && (
                      <div className="flex items-center justify-between p-2 bg-black/20 rounded-lg border border-white/5">
                        <div className="flex items-center gap-2">
                          {formData.hero_type === 'video' ? (
                            <>
                              <Video className="w-4 h-4 text-red-400" />
                              <span className="text-sm text-red-400 font-medium">Video Hero</span>
                            </>
                          ) : (
                            <>
                              <ImageIcon className="w-4 h-4 text-purple-400" />
                              <span className="text-sm text-purple-400 font-medium">Image Hero</span>
                            </>
                          )}
                        </div>
                        <button
                          onClick={() => {
                            const newType = formData.hero_type === 'image' ? 'video' : 'image';
                            setFormData({ ...formData, hero_type: newType });
                            toast({
                              title: `Switched to ${newType} mode`,
                              description: newType === 'video' && formData.video_url
                                ? 'Your existing video is ready'
                                : newType === 'image' && formData.hero_url
                                  ? 'Your existing image is ready'
                                  : `Add a ${newType} below`
                            });
                          }}
                          className="flex items-center gap-1.5 text-xs text-gray-400 hover:text-white px-2 py-1 rounded hover:bg-white/10 transition-colors"
                        >
                          Switch to {formData.hero_type === 'image' ? (
                            <><Video className="w-3.5 h-3.5" /> Video</>
                          ) : (
                            <><ImageIcon className="w-3.5 h-3.5" /> Image</>
                          )}
                        </button>
                      </div>
                    )}

                    {/* ========== IMAGE MODE ========== */}
                    {formData.hero_type === 'image' && (
                      <>
                        {/* Current Image Preview */}
                        {formData.hero_url && (
                          <div className="relative rounded-lg overflow-hidden border-2 border-purple-500/30 bg-black">
                            <img
                              src={formData.hero_url}
                              alt="Hero preview"
                              className="w-full h-40 object-cover"
                            />
                            <div className="absolute top-2 right-2 flex gap-1">
                              <Button
                                size="sm"
                                variant="ghost"
                                className="h-7 px-2 bg-black/70 hover:bg-red-500/80 text-white text-xs"
                                onClick={() => {
                                  setFormData({ ...formData, hero_url: '' });
                                  setImageUnsaved(true);
                                  toast({ title: '🗑️ Image removed - click Save to confirm' });
                                }}
                              >
                                <X className="w-3 h-3 mr-1" /> Remove
                              </Button>
                            </div>
                            <div className="absolute bottom-0 left-0 right-0 bg-black/80 px-2 py-1">
                              <p className="text-[10px] text-gray-400 truncate">
                                {formData.hero_url.includes('supabase') ? '✓ Supabase Storage' : '⚠️ External URL'}
                              </p>
                            </div>
                          </div>
                        )}

                        {/* Manual URL Input */}
                        <div className="space-y-2">
                          <Label className="text-xs text-gray-400">Image URL (paste or generate below)</Label>
                          <Input
                            value={formData.hero_url}
                            onChange={(e) => {
                              setFormData({ ...formData, hero_url: e.target.value });
                              setImageUnsaved(true);
                            }}
                            className="bg-black/20 text-sm font-mono"
                            placeholder="https://..."
                          />
                        </div>

                        {/* AI Image Generation */}
                        <div className="p-3 bg-gradient-to-br from-purple-500/10 to-pink-500/10 rounded-lg border border-purple-500/20">
                          <h4 className="text-sm font-medium text-purple-400 mb-2 flex items-center gap-2">
                            <Wand2 className="w-4 h-4" /> Generate with AI (Gemini)
                          </h4>

                          <div className="flex flex-wrap gap-1 mb-3">
                            {['professional', 'illustration', 'cinematic', 'tech', 'warm'].map((style) => (
                              <button
                                key={style}
                                onClick={() => setImageStyle(style)}
                                className={`px-2 py-1 text-xs rounded-full border transition-all ${imageStyle === style
                                  ? 'bg-purple-500/20 border-purple-500/50 text-purple-300'
                                  : 'border-white/10 text-gray-400 hover:border-purple-500/30'
                                  }`}
                              >
                                {style}
                              </button>
                            ))}
                          </div>

                          <Input
                            value={imagePrompt}
                            onChange={(e) => setImagePrompt(e.target.value)}
                            placeholder={`Custom prompt (or leave empty to use title)`}
                            className="bg-black/20 text-sm mb-2"
                          />

                          <Button
                            onClick={async () => {
                              setImageLoading(true);
                              try {
                                const res = await fetch('/api/insights/generate-image', {
                                  method: 'POST',
                                  headers: { 'Content-Type': 'application/json' },
                                  body: JSON.stringify({
                                    prompt: imagePrompt || undefined,
                                    title: formData.title,
                                    slug: formData.slug,
                                    style: imageStyle,
                                    brief: formData.description, // Pass article brief
                                    content: formData.content || formData.content_part1, // Pass article content
                                  })
                                });
                                const data = await res.json();
                                if (data.error) {
                                  toast({ title: '❌ ' + data.error, variant: 'destructive' });
                                } else if (data.imageUrl) {
                                  setFormData({ ...formData, hero_url: data.imageUrl });
                                  setImageUnsaved(true);
                                  toast({
                                    title: '🎨 Image generated!',
                                    description: 'Click "Save Post" to apply it to this article.'
                                  });
                                }
                              } catch (err) {
                                toast({ title: '❌ Image generation failed', variant: 'destructive' });
                              }
                              setImageLoading(false);
                            }}
                            disabled={imageLoading || !formData.title}
                            className="w-full bg-gradient-to-r from-purple-500 to-pink-500"
                          >
                            {imageLoading ? (
                              <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Generating (~15s)...</>
                            ) : formData.hero_url ? (
                              <><Wand2 className="w-4 h-4 mr-2" /> Replace with New Image</>
                            ) : (
                              <><Wand2 className="w-4 h-4 mr-2" /> Generate Hero Image</>
                            )}
                          </Button>
                          <p className="text-[10px] text-gray-500 mt-1 text-center">
                            Gemini Imagen 3 → Supabase Storage (permanent URL)
                          </p>
                        </div>
                      </>
                    )}

                    {/* ========== VIDEO MODE ========== */}
                    {formData.hero_type === 'video' && (
                      <>
                        {/* Current Video Preview */}
                        {formData.video_url && (
                          <div className="relative rounded-lg overflow-hidden border-2 border-red-500/30 bg-black">
                            <video
                              src={formData.video_url}
                              className="w-full h-40 object-cover"
                              controls
                              preload="metadata"
                            />
                            <div className="absolute top-2 right-2 flex gap-1">
                              <Button
                                size="sm"
                                variant="ghost"
                                className="h-7 px-2 bg-black/70 hover:bg-red-500/80 text-white text-xs"
                                onClick={() => {
                                  setFormData({ ...formData, video_url: '' });
                                  setShowVideoUpload(true);
                                  toast({ title: '🗑️ Video removed - click Save to confirm' });
                                }}
                              >
                                <X className="w-3 h-3 mr-1" /> Remove
                              </Button>
                            </div>
                            <div className="absolute bottom-0 left-0 right-0 bg-black/80 px-2 py-1">
                              <p className="text-[10px] text-gray-400 truncate">
                                {formData.video_url.includes('supabase') ? '✓ Supabase Storage' : '⚠️ External URL'}
                              </p>
                            </div>
                          </div>
                        )}

                        {/* Replace Video Button - Only shown when video exists and upload zone is hidden */}
                        {formData.video_url && !showVideoUpload && !showVideoChoiceModal && (
                          <Button
                            variant="outline"
                            className="w-full border-red-500/30 text-red-400 hover:bg-red-500/10"
                            onClick={() => setShowVideoChoiceModal(true)}
                          >
                            <Upload className="w-4 h-4 mr-2" /> Replace Video
                          </Button>
                        )}

                        {/* Video Choice Modal - Upload or Generate */}
                        {showVideoChoiceModal && (
                          <div className="p-4 bg-gradient-to-br from-red-500/10 to-purple-500/10 rounded-xl border border-red-500/30 space-y-4">
                            <div className="flex items-center justify-between">
                              <h4 className="text-sm font-bold text-white">How do you want to add a video?</h4>
                              <Button
                                size="sm"
                                variant="ghost"
                                className="h-6 px-2 text-gray-400 hover:text-white"
                                onClick={() => setShowVideoChoiceModal(false)}
                              >
                                <X className="w-4 h-4" />
                              </Button>
                            </div>

                            <div className="grid grid-cols-2 gap-3">
                              {/* Upload Option */}
                              <button
                                onClick={() => {
                                  setShowVideoChoiceModal(false);
                                  setShowVideoUpload(true);
                                }}
                                className="p-4 rounded-lg border-2 border-white/10 hover:border-cyan-500/50 hover:bg-cyan-500/10 transition-all text-left group"
                              >
                                <Upload className="w-8 h-8 text-cyan-400 mb-2 group-hover:scale-110 transition-transform" />
                                <p className="font-semibold text-white text-sm">Upload Video</p>
                                <p className="text-[10px] text-gray-400 mt-1">
                                  Upload your own MP4, WebM, or MOV file
                                </p>
                              </button>

                              {/* Generate Option */}
                              <button
                                onClick={() => {
                                  setShowVideoChoiceModal(false);
                                  setVideoPrompt(formData.title || '');
                                }}
                                disabled={videoGenerating}
                                className="p-4 rounded-lg border-2 border-white/10 hover:border-purple-500/50 hover:bg-purple-500/10 transition-all text-left group relative"
                              >
                                <Wand2 className="w-8 h-8 text-purple-400 mb-2 group-hover:scale-110 transition-transform" />
                                <p className="font-semibold text-white text-sm">AI Generate</p>
                                <p className="text-[10px] text-gray-400 mt-1">
                                  Create video with Google Veo AI
                                </p>
                                <span className="absolute top-2 right-2 px-1.5 py-0.5 text-[8px] bg-green-500/30 text-green-300 rounded-full font-bold">
                                  NEW
                                </span>
                              </button>
                            </div>
                          </div>
                        )}

                        {/* AI Video Generation Section */}
                        {videoPrompt !== '' && !showVideoUpload && !showVideoChoiceModal && (
                          <div className="p-4 bg-gradient-to-br from-purple-500/10 to-pink-500/10 rounded-xl border border-purple-500/30 space-y-4">
                            <div className="flex items-center justify-between">
                              <h4 className="text-sm font-bold text-purple-400 flex items-center gap-2">
                                <Wand2 className="w-4 h-4" /> AI Video Generation
                              </h4>
                              <Button
                                size="sm"
                                variant="ghost"
                                className="h-6 px-2 text-gray-400 hover:text-white"
                                onClick={() => setVideoPrompt('')}
                              >
                                <X className="w-4 h-4" />
                              </Button>
                            </div>

                            {/* Video Prompt Input */}
                            <div className="space-y-2">
                              <Label className="text-xs text-gray-400">Describe your video</Label>
                              <Textarea
                                value={videoPrompt}
                                onChange={(e) => setVideoPrompt(e.target.value)}
                                placeholder="Professional BPO call center agents working in a modern office..."
                                className="bg-black/30 text-sm min-h-[80px] border-purple-500/30 focus:border-purple-500"
                              />
                            </div>

                            {/* Style Selection */}
                            <div className="space-y-2">
                              <Label className="text-xs text-gray-400">Video Style</Label>
                              <div className="grid grid-cols-3 gap-2">
                                {[
                                  { id: 'professional', label: 'Professional', icon: '💼' },
                                  { id: 'cinematic', label: 'Cinematic', icon: '🎬' },
                                  { id: 'tech', label: 'Tech', icon: '💻' },
                                  { id: 'warm', label: 'Warm', icon: '☀️' },
                                  { id: 'animated', label: 'Animated', icon: '✨' },
                                ].map((s) => (
                                  <button
                                    key={s.id}
                                    onClick={() => setVideoStyle(s.id)}
                                    className={`p-2 rounded-lg border text-xs transition-all ${videoStyle === s.id
                                      ? 'border-purple-500 bg-purple-500/20 text-purple-300'
                                      : 'border-white/10 text-gray-400 hover:border-purple-500/50'
                                      }`}
                                  >
                                    <span className="mr-1">{s.icon}</span> {s.label}
                                  </button>
                                ))}
                              </div>
                            </div>

                            {/* Generate Button */}
                            <Button
                              onClick={async () => {
                                if (!videoPrompt.trim()) {
                                  toast({ title: 'Please enter a video description', variant: 'destructive' });
                                  return;
                                }

                                setVideoGenerating(true);

                                // Minimum loading time for better UX
                                const startTime = Date.now();
                                const minLoadingTime = 1500;

                                try {
                                  const res = await fetch('/api/insights/generate-video', {
                                    method: 'POST',
                                    headers: { 'Content-Type': 'application/json' },
                                    body: JSON.stringify({
                                      prompt: videoPrompt,
                                      title: formData.title,
                                      style: videoStyle,
                                      slug: formData.slug || formData.title.toLowerCase().replace(/ /g, '-'),
                                      duration: 5,
                                      brief: formData.description, // Pass article brief/description
                                      content: formData.content || formData.content_part1, // Pass article content
                                    })
                                  });

                                  const data = await res.json();

                                  // Ensure minimum loading time for visual feedback
                                  const elapsed = Date.now() - startTime;
                                  if (elapsed < minLoadingTime) {
                                    await new Promise(resolve => setTimeout(resolve, minLoadingTime - elapsed));
                                  }

                                  if (data.success && data.videoUrl) {
                                    // Video generated successfully
                                    setFormData({ ...formData, video_url: data.videoUrl });
                                    setVideoPrompt('');
                                    toast({
                                      title: '🎬 Video Generated!',
                                      description: data.message || 'AI video created. Click "Save Post" to apply.'
                                    });
                                  } else if (data.success && data.imageUrl) {
                                    // Image generated as fallback - switch to image mode
                                    setFormData({
                                      ...formData,
                                      hero_url: data.imageUrl,
                                      hero_type: 'image'
                                    });
                                    setVideoPrompt('');
                                    toast({
                                      title: '🖼️ Hero Image Generated!',
                                      description: data.message || 'Created a high-quality hero image.',
                                    });
                                    if (data.suggestion) {
                                      setTimeout(() => {
                                        toast({ title: '💡 Tip', description: data.suggestion });
                                      }, 500);
                                    }
                                  } else if (data.error || !data.success) {
                                    // Error with helpful message
                                    toast({
                                      title: '⚠️ ' + (data.error || 'Generation failed'),
                                      description: data.message || data.suggestion || 'Please try again or upload a video.',
                                      variant: 'destructive'
                                    });
                                  }
                                } catch (err: any) {
                                  // Ensure minimum loading time even on error
                                  const elapsed = Date.now() - startTime;
                                  if (elapsed < minLoadingTime) {
                                    await new Promise(resolve => setTimeout(resolve, minLoadingTime - elapsed));
                                  }
                                  toast({
                                    title: '❌ Generation failed',
                                    description: err.message || 'Please try uploading a video instead.',
                                    variant: 'destructive'
                                  });
                                }
                                setVideoGenerating(false);
                              }}
                              disabled={videoGenerating || !videoPrompt.trim()}
                              className={`w-full text-white transition-all duration-300 ${videoGenerating
                                ? 'bg-gradient-to-r from-purple-700 to-pink-700 animate-pulse cursor-wait'
                                : 'bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500'
                                }`}
                            >
                              {videoGenerating ? (
                                <span className="flex items-center justify-center">
                                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                  <span className="animate-pulse">Generating with Google Veo (30-90s)...</span>
                                </span>
                              ) : (
                                <>
                                  <Wand2 className="w-4 h-4 mr-2" />
                                  Generate Video with AI
                                </>
                              )}
                            </Button>

                            <p className="text-[10px] text-gray-500 text-center">
                              Powered by Google Veo 2 • Creates video from your prompt
                            </p>
                          </div>
                        )}

                        {/* No Video - Show Choice Between Upload and AI Generate */}
                        {!formData.video_url && !showVideoUpload && !showVideoChoiceModal && videoPrompt === '' && (
                          <div className="p-4 bg-gradient-to-br from-slate-500/10 to-slate-600/10 rounded-xl border border-white/10 space-y-4">
                            <h4 className="text-sm font-bold text-white text-center">Add Hero Video</h4>
                            <div className="grid grid-cols-2 gap-3">
                              {/* Upload Option */}
                              <button
                                onClick={() => setShowVideoUpload(true)}
                                className="p-4 rounded-lg border-2 border-white/10 hover:border-cyan-500/50 hover:bg-cyan-500/10 transition-all text-left group"
                              >
                                <Upload className="w-8 h-8 text-cyan-400 mb-2 group-hover:scale-110 transition-transform" />
                                <p className="font-semibold text-white text-sm">Upload Video</p>
                                <p className="text-[10px] text-gray-400 mt-1">
                                  Upload your own MP4, WebM, or MOV file
                                </p>
                              </button>

                              {/* Generate Option */}
                              <button
                                onClick={() => setVideoPrompt(formData.title || '')}
                                className="p-4 rounded-lg border-2 border-white/10 hover:border-purple-500/50 hover:bg-purple-500/10 transition-all text-left group relative"
                              >
                                <Wand2 className="w-8 h-8 text-purple-400 mb-2 group-hover:scale-110 transition-transform" />
                                <p className="font-semibold text-white text-sm">AI Generate</p>
                                <p className="text-[10px] text-gray-400 mt-1">
                                  Create video with Google Veo 2
                                </p>
                                <span className="absolute top-2 right-2 px-1.5 py-0.5 text-[8px] bg-green-500/30 text-green-300 rounded-full font-bold">
                                  NEW
                                </span>
                              </button>
                            </div>
                          </div>
                        )}

                        {/* Video Upload Section - Only shown when showVideoUpload is true */}
                        {showVideoUpload && (
                          <div className="p-3 bg-gradient-to-br from-red-500/10 to-orange-500/10 rounded-lg border border-red-500/20">
                            <div className="flex items-center justify-between mb-3">
                              <h4 className="text-sm font-medium text-red-400 flex items-center gap-2">
                                <Upload className="w-4 h-4" /> Upload Video
                              </h4>
                              <div className="flex items-center gap-2">
                                {/* AI Generate Option */}
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  className="h-6 px-2 text-purple-400 hover:text-purple-300 hover:bg-purple-500/10 text-xs"
                                  onClick={() => {
                                    setShowVideoUpload(false);
                                    setVideoPrompt(formData.title || '');
                                  }}
                                >
                                  <Wand2 className="w-3 h-3 mr-1" /> AI Generate
                                </Button>
                                {/* Cancel button */}
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  className="h-6 px-2 text-gray-400 hover:text-white text-xs"
                                  onClick={() => setShowVideoUpload(false)}
                                >
                                  <X className="w-3 h-3 mr-1" /> Cancel
                                </Button>
                              </div>
                            </div>

                            {/* Upload Progress */}
                            {videoUploading && (
                              <div className="mb-3 p-3 bg-black/30 rounded-lg border border-red-500/20">
                                <div className="flex items-center gap-3">
                                  <Loader2 className="w-5 h-5 text-red-400 animate-spin" />
                                  <div className="flex-1">
                                    <p className="text-sm text-red-400 font-medium">Uploading video...</p>
                                    <p className="text-[10px] text-gray-500">This may take a moment for large files</p>
                                  </div>
                                </div>
                              </div>
                            )}

                            {/* File Upload Input */}
                            <div className="relative">
                              <input
                                type="file"
                                accept="video/mp4,video/webm,video/quicktime"
                                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                                disabled={videoUploading}
                                onChange={async (e) => {
                                  const file = e.target.files?.[0];
                                  if (!file) return;

                                  // Validate size client-side
                                  const maxSize = 100 * 1024 * 1024;
                                  if (file.size > maxSize) {
                                    toast({
                                      title: '❌ File too large',
                                      description: `Max size is 100MB. Your file: ${(file.size / 1024 / 1024).toFixed(1)}MB`,
                                      variant: 'destructive'
                                    });
                                    return;
                                  }

                                  setVideoUploading(true);

                                  try {
                                    const formDataUpload = new FormData();
                                    formDataUpload.append('file', file);
                                    formDataUpload.append('slug', formData.slug || formData.title.toLowerCase().replace(/ /g, '-'));
                                    if (post?.id) formDataUpload.append('postId', post.id);

                                    const res = await fetch('/api/insights/upload-video', {
                                      method: 'POST',
                                      body: formDataUpload
                                    });

                                    const data = await res.json();

                                    if (data.error) {
                                      toast({ title: '❌ ' + data.error, variant: 'destructive' });
                                    } else if (data.videoUrl) {
                                      setFormData({ ...formData, video_url: data.videoUrl });
                                      setShowVideoUpload(false); // Hide upload zone after successful upload
                                      toast({
                                        title: '🎬 Video uploaded!',
                                        description: `${data.sizeFormatted} - Click "Save Post" to apply.`
                                      });
                                    }
                                  } catch (err) {
                                    toast({ title: '❌ Upload failed', variant: 'destructive' });
                                  }

                                  setVideoUploading(false);
                                  e.target.value = ''; // Reset input
                                }}
                              />
                              <div className={`p-4 rounded-lg border-2 border-dashed transition-colors ${videoUploading
                                ? 'border-red-500/30 bg-red-500/5'
                                : 'border-white/20 hover:border-red-500/50 hover:bg-red-500/5'
                                }`}>
                                <div className="text-center">
                                  <Upload className={`w-8 h-8 mx-auto mb-2 ${videoUploading ? 'text-red-400 animate-pulse' : 'text-gray-500'}`} />
                                  <p className="text-sm text-gray-400">
                                    {videoUploading ? 'Uploading...' : 'Drop video here or click to upload'}
                                  </p>
                                  <p className="text-[10px] text-gray-600 mt-1">
                                    MP4, WebM, MOV • Max 100MB
                                  </p>
                                </div>
                              </div>
                            </div>

                            {/* Manual URL Input */}
                            <div className="mt-3 space-y-2">
                              <Label className="text-xs text-gray-400">Or paste video URL</Label>
                              <Input
                                value={formData.video_url}
                                onChange={(e) => setFormData({ ...formData, video_url: e.target.value })}
                                className="bg-black/20 text-sm font-mono"
                                placeholder="https://...supabase.co/insights_video/..."
                              />
                            </div>

                            <p className="text-[10px] text-gray-500 mt-2 text-center">
                              Uploads to Supabase Storage (insights_video bucket)
                            </p>
                          </div>
                        )}

                        {/* Poster Image for Video */}
                        {formData.video_url && (
                          <div className="space-y-2">
                            <Label className="text-xs text-gray-400">Hero Image URL (Poster)</Label>
                            <Input
                              value={formData.hero_url}
                              onChange={(e) => setFormData({ ...formData, hero_url: e.target.value })}
                              className="bg-black/20 text-sm font-mono"
                              placeholder="https://... (shown before video plays)"
                            />
                          </div>
                        )}
                      </>
                    )}

                    {/* Icon/Color Settings (shared) */}
                    <div className="grid grid-cols-2 gap-2 pt-2 border-t border-white/10">
                      <div>
                        <Label className="text-xs text-gray-400">Icon Name</Label>
                        <Input
                          value={formData.icon_name}
                          onChange={(e) => setFormData({ ...formData, icon_name: e.target.value })}
                          className="bg-black/20 text-sm"
                        />
                      </div>
                      <div>
                        <Label className="text-xs text-gray-400">Color Class</Label>
                        <Input
                          value={formData.color}
                          onChange={(e) => setFormData({ ...formData, color: e.target.value })}
                          className="bg-black/20 text-sm"
                        />
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Body Images Section - Images between content sections */}
                <Card className="bg-white/5 border-white/10">
                  <CardHeaderWithSave
                    title="📷 Body Images"
                    cardType="bodyImages"
                    hasChanges={hasCardChanges.bodyImages}
                    onSave={saveBodyImages}
                    isSaving={cardSaving.bodyImages}
                    isSaved={cardSaved.bodyImages}
                  />
                  <CardContent className="space-y-4">
                    {/* Body Image 0 - After Title, Before Section 1 */}
                    <div className="p-3 rounded-lg bg-gradient-to-br from-yellow-500/10 to-orange-500/10 border border-yellow-500/20">
                      <div className="flex items-center justify-between mb-3">
                        <h4 className="text-sm font-medium text-yellow-400 flex items-center gap-2">
                          <span className="w-6 h-6 rounded-full bg-yellow-500/20 border border-yellow-500/30 flex items-center justify-center text-xs font-bold">★</span>
                          After Title (Featured)
                        </h4>
                        {formData.content_image0 && (
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-6 px-2 text-red-400 hover:text-red-300 hover:bg-red-500/10"
                            onClick={() => setFormData(prev => ({ ...prev, content_image0: '' }))}
                          >
                            <X className="w-3 h-3 mr-1" /> Remove
                          </Button>
                        )}
                      </div>

                      {formData.content_image0 && (
                        <div className="mb-3 rounded-lg overflow-hidden border border-yellow-500/30 relative group">
                          <img
                            src={formData.content_image0}
                            alt="Featured image"
                            className="w-full h-24 object-cover"
                          />
                          <button
                            onClick={() => setPreviewImageUrl(formData.content_image0)}
                            className="absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
                          >
                            <div className="w-10 h-10 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center border border-white/30">
                              <Eye className="w-5 h-5 text-white" />
                            </div>
                          </button>
                        </div>
                      )}

                      {/* Upload and AI Generate Options */}
                      <div className="grid grid-cols-2 gap-2">
                        {/* Upload Button */}
                        <div className="relative">
                          <input
                            type="file"
                            accept="image/*"
                            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                            disabled={bodyImageLoading.image0}
                            onChange={async (e) => {
                              const file = e.target.files?.[0];
                              if (!file) return;

                              setBodyImageLoading(prev => ({ ...prev, image0: true }));

                              try {
                                const formDataUpload = new FormData();
                                formDataUpload.append('file', file);
                                formDataUpload.append('type', 'body-image');
                                formDataUpload.append('slug', formData.slug || formData.title.toLowerCase().replace(/ /g, '-'));

                                const res = await fetch('/api/insights/upload-image', {
                                  method: 'POST',
                                  body: formDataUpload
                                });

                                const data = await res.json();
                                if (data.imageUrl) {
                                  setFormData(prev => ({ ...prev, content_image0: data.imageUrl }));
                                  toast({ title: '📷 Featured image uploaded!' });
                                } else if (data.error) {
                                  toast({ title: '❌ ' + data.error, variant: 'destructive' });
                                }
                              } catch (err) {
                                toast({ title: '❌ Upload failed', variant: 'destructive' });
                              }

                              setBodyImageLoading(prev => ({ ...prev, image0: false }));
                              e.target.value = '';
                            }}
                          />
                          <div className={`p-2 rounded-lg border-2 border-dashed transition-colors ${bodyImageLoading.image0
                            ? 'border-yellow-500/30 bg-yellow-500/5'
                            : 'border-white/20 hover:border-yellow-500/50 hover:bg-yellow-500/5'
                            }`}>
                            <div className="text-center">
                              {bodyImageLoading.image0 ? (
                                <Loader2 className="w-5 h-5 mx-auto mb-1 text-yellow-400 animate-spin" />
                              ) : (
                                <Upload className="w-5 h-5 mx-auto mb-1 text-gray-500" />
                              )}
                              <p className="text-[10px] text-gray-400">
                                {bodyImageLoading.image0 ? 'Uploading...' : 'Upload'}
                              </p>
                            </div>
                          </div>
                        </div>

                        {/* AI Generate Button */}
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-full border-yellow-500/30 text-yellow-400 hover:bg-yellow-500/10 flex flex-col items-center justify-center gap-1 py-2"
                          disabled={bodyImageLoading.image0 || !formData.title}
                          onClick={async () => {
                            setBodyImageLoading(prev => ({ ...prev, image0: true }));
                            try {
                              const res = await fetch('/api/insights/generate-image', {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({
                                  prompt: `HYPER-REALISTIC PROFESSIONAL PHOTOGRAPHY: Hero shot for article "${formData.title}". 
Shot on Canon EOS R5 with 24-70mm f/2.8 lens. Natural window lighting with soft fill. 
Subject: Filipino BPO professionals in premium modern call center office. Glass partitions, ergonomic workstations, multiple monitors.
Composition: Rule of thirds, shallow depth of field f/2.8, bokeh background.
Color grading: Clean, corporate, slightly warm tones. 8K resolution, ultra sharp focus.
Style: Award-winning corporate photography, Getty Images editorial quality.
ABSOLUTELY NO: illustrations, clipart, cartoons, 3D renders, AI artifacts, text overlays.`,
                                  title: formData.title,
                                  slug: formData.slug,
                                  style: 'professional'
                                })
                              });
                              const data = await res.json();
                              if (data.imageUrl) {
                                setFormData(prev => ({ ...prev, content_image0: data.imageUrl }));
                                toast({ title: '🎨 Featured image generated!' });
                              } else if (data.error) {
                                toast({ title: '❌ ' + data.error, variant: 'destructive' });
                              }
                            } catch (err) {
                              toast({ title: '❌ Generation failed', variant: 'destructive' });
                            }
                            setBodyImageLoading(prev => ({ ...prev, image0: false }));
                          }}
                        >
                          {bodyImageLoading.image0 ? (
                            <Loader2 className="w-5 h-5 animate-spin" />
                          ) : (
                            <Wand2 className="w-5 h-5" />
                          )}
                          <span className="text-[10px]">AI Generate</span>
                        </Button>
                      </div>

                      {/* Section 1 Alt Text */}
                      <div className="mt-3 space-y-1">
                        <div className="flex items-center justify-between">
                          <Label className="text-[10px] text-gray-500 uppercase tracking-tight">Section 1 Alt Text (SEO)</Label>
                          <div className="flex gap-1">
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-5 px-1.5 text-[10px] text-yellow-400 hover:text-yellow-300 hover:bg-yellow-500/10"
                              disabled={altTextGenerating.section1 || !formData.content_image0}
                              onClick={async () => {
                                setAltTextGenerating(prev => ({ ...prev, section1: true }));
                                try {
                                  const res = await fetch('/api/insights/generate-alt-text', {
                                    method: 'POST',
                                    headers: { 'Content-Type': 'application/json' },
                                    body: JSON.stringify({
                                      sectionContent: formData.content_part1 || formData.description,
                                      imageUrl: formData.content_image0,
                                      articleTitle: formData.title,
                                      sectionNumber: 1,
                                    }),
                                  });
                                  const data = await res.json();
                                  if (data.success && data.altText) {
                                    setFormData(prev => ({ ...prev, section1_image_alt: data.altText }));
                                    toast({ title: '✨ Alt text generated for Section 1' });
                                  } else {
                                    toast({ title: '❌ ' + (data.error || 'Generation failed'), variant: 'destructive' });
                                  }
                                } catch (err) {
                                  toast({ title: '❌ Generation failed', variant: 'destructive' });
                                }
                                setAltTextGenerating(prev => ({ ...prev, section1: false }));
                              }}
                            >
                              {altTextGenerating.section1 ? (
                                <Loader2 className="w-3 h-3 animate-spin" />
                              ) : (
                                <><Wand2 className="w-3 h-3 mr-0.5" />AI</>
                              )}
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-5 px-1.5 text-[10px] text-green-400 hover:text-green-300 hover:bg-green-500/10"
                              disabled={altTextSaving.section1 || !formData.section1_image_alt}
                              onClick={async () => {
                                setAltTextSaving(prev => ({ ...prev, section1: true }));
                                try {
                                  const res = await fetch('/api/insights/save-alt-text', {
                                    method: 'POST',
                                    headers: { 'Content-Type': 'application/json' },
                                    body: JSON.stringify({
                                      insightId: post?.id,
                                      sectionNumber: 1,
                                      altText: formData.section1_image_alt,
                                      imageUrl: formData.content_image0,
                                    }),
                                  });
                                  const data = await res.json();
                                  if (data.success) {
                                    toast({ title: '💾 Section 1 alt text saved!' });
                                  } else {
                                    toast({ title: '❌ ' + (data.error || 'Save failed'), variant: 'destructive' });
                                  }
                                } catch (err) {
                                  toast({ title: '❌ Save failed', variant: 'destructive' });
                                }
                                setAltTextSaving(prev => ({ ...prev, section1: false }));
                              }}
                            >
                              {altTextSaving.section1 ? (
                                <Loader2 className="w-3 h-3 animate-spin" />
                              ) : (
                                <><Save className="w-3 h-3 mr-0.5" />Save</>
                              )}
                            </Button>
                          </div>
                        </div>
                        <Input
                          value={formData.section1_image_alt}
                          onChange={(e) => setFormData({ ...formData, section1_image_alt: e.target.value })}
                          className="bg-black/20 text-xs h-8 border-yellow-500/20 focus:border-yellow-500/50"
                          placeholder="Describe image 1 for SEO..."
                        />
                      </div>
                    </div>

                    {/* Body Image 1 - After Section 1 */}
                    <div className="p-3 rounded-lg bg-gradient-to-br from-cyan-500/10 to-blue-500/10 border border-cyan-500/20">
                      <div className="flex items-center justify-between mb-3">
                        <h4 className="text-sm font-medium text-cyan-400 flex items-center gap-2">
                          <span className="w-6 h-6 rounded-full bg-cyan-500/20 border border-cyan-500/30 flex items-center justify-center text-xs font-bold">1</span>
                          After Section 1
                        </h4>
                        {formData.content_image1 && (
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-6 px-2 text-red-400 hover:text-red-300 hover:bg-red-500/10"
                            onClick={() => setFormData(prev => ({ ...prev, content_image1: '' }))}
                          >
                            <X className="w-3 h-3 mr-1" /> Remove
                          </Button>
                        )}
                      </div>

                      {formData.content_image1 && (
                        <div className="mb-3 rounded-lg overflow-hidden border border-cyan-500/30 relative group">
                          <img
                            src={formData.content_image1}
                            alt="Body image 1"
                            className="w-full h-24 object-cover"
                          />
                          <button
                            onClick={() => setPreviewImageUrl(formData.content_image1)}
                            className="absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
                          >
                            <div className="w-10 h-10 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center border border-white/30">
                              <Eye className="w-5 h-5 text-white" />
                            </div>
                          </button>
                        </div>
                      )}

                      {/* Upload and AI Generate Options */}
                      <div className="grid grid-cols-2 gap-2">
                        {/* Upload Button */}
                        <div className="relative">
                          <input
                            type="file"
                            accept="image/*"
                            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                            disabled={bodyImageLoading.image1}
                            onChange={async (e) => {
                              const file = e.target.files?.[0];
                              if (!file) return;

                              setBodyImageLoading(prev => ({ ...prev, image1: true }));

                              try {
                                const formDataUpload = new FormData();
                                formDataUpload.append('file', file);
                                formDataUpload.append('type', 'body-image');
                                formDataUpload.append('slug', formData.slug || formData.title.toLowerCase().replace(/ /g, '-'));

                                const res = await fetch('/api/insights/upload-image', {
                                  method: 'POST',
                                  body: formDataUpload
                                });

                                const data = await res.json();
                                if (data.imageUrl) {
                                  setFormData(prev => ({ ...prev, content_image1: data.imageUrl }));
                                  toast({ title: '📷 Image 1 uploaded!' });
                                } else if (data.error) {
                                  toast({ title: '❌ ' + data.error, variant: 'destructive' });
                                }
                              } catch (err) {
                                toast({ title: '❌ Upload failed', variant: 'destructive' });
                              }

                              setBodyImageLoading(prev => ({ ...prev, image1: false }));
                              e.target.value = '';
                            }}
                          />
                          <div className={`p-2 rounded-lg border-2 border-dashed transition-colors ${bodyImageLoading.image1
                            ? 'border-cyan-500/30 bg-cyan-500/5'
                            : 'border-white/20 hover:border-cyan-500/50 hover:bg-cyan-500/5'
                            }`}>
                            <div className="text-center">
                              {bodyImageLoading.image1 ? (
                                <Loader2 className="w-5 h-5 mx-auto mb-1 text-cyan-400 animate-spin" />
                              ) : (
                                <Upload className="w-5 h-5 mx-auto mb-1 text-gray-500" />
                              )}
                              <p className="text-[10px] text-gray-400">
                                {bodyImageLoading.image1 ? 'Uploading...' : 'Upload'}
                              </p>
                            </div>
                          </div>
                        </div>

                        {/* AI Generate Button */}
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-full border-cyan-500/30 text-cyan-400 hover:bg-cyan-500/10 flex flex-col items-center justify-center gap-1 py-2"
                          disabled={bodyImageLoading.image1 || !formData.title}
                          onClick={async () => {
                            setBodyImageLoading(prev => ({ ...prev, image1: true }));
                            try {
                              const res = await fetch('/api/insights/generate-image', {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({
                                  prompt: `HYPER-REALISTIC DOCUMENTARY PHOTOGRAPHY: Candid workplace moment for "${formData.title}".
Shot on Sony A7R IV with 85mm f/1.4 portrait lens. Soft diffused natural light from large windows.
Subject: Authentic Filipino call center agents actively working, wearing headsets, engaged with customers. Real expressions, genuine interaction.
Setting: Modern BPO floor with clean workstations, LED monitors, professional headsets, subtle brand colors.
Composition: Environmental portrait, medium shot, natural poses, eye-level angle.
Technical: ISO 400, 1/125s, f/2.0 for creamy bokeh. Color: natural skin tones, corporate blue accents.
Style: National Geographic workplace documentary, authentic human connection.
ABSOLUTELY NO: staged poses, stock photo smiles, illustrations, cartoons, CGI, artificial lighting.`,
                                  title: formData.title,
                                  slug: formData.slug,
                                  style: 'warm'
                                })
                              });
                              const data = await res.json();
                              if (data.imageUrl) {
                                setFormData(prev => ({ ...prev, content_image1: data.imageUrl }));
                                toast({ title: '🎨 Image 1 generated!' });
                              } else if (data.error) {
                                toast({ title: '❌ ' + data.error, variant: 'destructive' });
                              }
                            } catch (err) {
                              toast({ title: '❌ Generation failed', variant: 'destructive' });
                            }
                            setBodyImageLoading(prev => ({ ...prev, image1: false }));
                          }}
                        >
                          {bodyImageLoading.image1 ? (
                            <Loader2 className="w-5 h-5 animate-spin" />
                          ) : (
                            <Wand2 className="w-5 h-5" />
                          )}
                          <span className="text-[10px]">AI Generate</span>
                        </Button>
                      </div>

                      {/* Section 2 Alt Text */}
                      <div className="mt-3 space-y-1">
                        <div className="flex items-center justify-between">
                          <Label className="text-[10px] text-gray-500 uppercase tracking-tight">Section 2 Alt Text (SEO)</Label>
                          <div className="flex gap-1">
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-5 px-1.5 text-[10px] text-cyan-400 hover:text-cyan-300 hover:bg-cyan-500/10"
                              disabled={altTextGenerating.section2 || !formData.content_image1}
                              onClick={async () => {
                                setAltTextGenerating(prev => ({ ...prev, section2: true }));
                                try {
                                  const res = await fetch('/api/insights/generate-alt-text', {
                                    method: 'POST',
                                    headers: { 'Content-Type': 'application/json' },
                                    body: JSON.stringify({
                                      sectionContent: formData.content_part2 || formData.content_part1,
                                      imageUrl: formData.content_image1,
                                      articleTitle: formData.title,
                                      sectionNumber: 2,
                                    }),
                                  });
                                  const data = await res.json();
                                  if (data.success && data.altText) {
                                    setFormData(prev => ({ ...prev, section2_image_alt: data.altText }));
                                    toast({ title: '✨ Alt text generated for Section 2' });
                                  } else {
                                    toast({ title: '❌ ' + (data.error || 'Generation failed'), variant: 'destructive' });
                                  }
                                } catch (err) {
                                  toast({ title: '❌ Generation failed', variant: 'destructive' });
                                }
                                setAltTextGenerating(prev => ({ ...prev, section2: false }));
                              }}
                            >
                              {altTextGenerating.section2 ? (
                                <Loader2 className="w-3 h-3 animate-spin" />
                              ) : (
                                <><Wand2 className="w-3 h-3 mr-0.5" />AI</>
                              )}
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-5 px-1.5 text-[10px] text-green-400 hover:text-green-300 hover:bg-green-500/10"
                              disabled={altTextSaving.section2 || !formData.section2_image_alt}
                              onClick={async () => {
                                setAltTextSaving(prev => ({ ...prev, section2: true }));
                                try {
                                  const res = await fetch('/api/insights/save-alt-text', {
                                    method: 'POST',
                                    headers: { 'Content-Type': 'application/json' },
                                    body: JSON.stringify({
                                      insightId: post?.id,
                                      sectionNumber: 2,
                                      altText: formData.section2_image_alt,
                                      imageUrl: formData.content_image1,
                                    }),
                                  });
                                  const data = await res.json();
                                  if (data.success) {
                                    toast({ title: '💾 Section 2 alt text saved!' });
                                  } else {
                                    toast({ title: '❌ ' + (data.error || 'Save failed'), variant: 'destructive' });
                                  }
                                } catch (err) {
                                  toast({ title: '❌ Save failed', variant: 'destructive' });
                                }
                                setAltTextSaving(prev => ({ ...prev, section2: false }));
                              }}
                            >
                              {altTextSaving.section2 ? (
                                <Loader2 className="w-3 h-3 animate-spin" />
                              ) : (
                                <><Save className="w-3 h-3 mr-0.5" />Save</>
                              )}
                            </Button>
                          </div>
                        </div>
                        <Input
                          value={formData.section2_image_alt}
                          onChange={(e) => setFormData({ ...formData, section2_image_alt: e.target.value })}
                          className="bg-black/20 text-xs h-8 border-cyan-500/20 focus:border-cyan-500/50"
                          placeholder="Describe image 2 for SEO..."
                        />
                      </div>
                    </div>

                    {/* Body Image 2 - After Section 2 */}
                    <div className="p-3 rounded-lg bg-gradient-to-br from-purple-500/10 to-pink-500/10 border border-purple-500/20">
                      <div className="flex items-center justify-between mb-3">
                        <h4 className="text-sm font-medium text-purple-400 flex items-center gap-2">
                          <span className="w-6 h-6 rounded-full bg-purple-500/20 border border-purple-500/30 flex items-center justify-center text-xs font-bold">2</span>
                          After Section 2
                        </h4>
                        {formData.content_image2 && (
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-6 px-2 text-red-400 hover:text-red-300 hover:bg-red-500/10"
                            onClick={() => setFormData(prev => ({ ...prev, content_image2: '' }))}
                          >
                            <X className="w-3 h-3 mr-1" /> Remove
                          </Button>
                        )}
                      </div>

                      {formData.content_image2 && (
                        <div className="mb-3 rounded-lg overflow-hidden border border-purple-500/30 relative group">
                          <img
                            src={formData.content_image2}
                            alt="Body image 2"
                            className="w-full h-24 object-cover"
                          />
                          <button
                            onClick={() => setPreviewImageUrl(formData.content_image2)}
                            className="absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
                          >
                            <div className="w-10 h-10 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center border border-white/30">
                              <Eye className="w-5 h-5 text-white" />
                            </div>
                          </button>
                        </div>
                      )}

                      {/* Upload and AI Generate Options */}
                      <div className="grid grid-cols-2 gap-2">
                        {/* Upload Button */}
                        <div className="relative">
                          <input
                            type="file"
                            accept="image/*"
                            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                            disabled={bodyImageLoading.image2}
                            onChange={async (e) => {
                              const file = e.target.files?.[0];
                              if (!file) return;

                              setBodyImageLoading(prev => ({ ...prev, image2: true }));

                              try {
                                const formDataUpload = new FormData();
                                formDataUpload.append('file', file);
                                formDataUpload.append('type', 'body-image');
                                formDataUpload.append('slug', formData.slug || formData.title.toLowerCase().replace(/ /g, '-'));

                                const res = await fetch('/api/insights/upload-image', {
                                  method: 'POST',
                                  body: formDataUpload
                                });

                                const data = await res.json();
                                if (data.imageUrl) {
                                  setFormData(prev => ({ ...prev, content_image2: data.imageUrl }));
                                  toast({ title: '📷 Image 2 uploaded!' });
                                } else if (data.error) {
                                  toast({ title: '❌ ' + data.error, variant: 'destructive' });
                                }
                              } catch (err) {
                                toast({ title: '❌ Upload failed', variant: 'destructive' });
                              }

                              setBodyImageLoading(prev => ({ ...prev, image2: false }));
                              e.target.value = '';
                            }}
                          />
                          <div className={`p-2 rounded-lg border-2 border-dashed transition-colors ${bodyImageLoading.image2
                            ? 'border-purple-500/30 bg-purple-500/5'
                            : 'border-white/20 hover:border-purple-500/50 hover:bg-purple-500/5'
                            }`}>
                            <div className="text-center">
                              {bodyImageLoading.image2 ? (
                                <Loader2 className="w-5 h-5 mx-auto mb-1 text-purple-400 animate-spin" />
                              ) : (
                                <Upload className="w-5 h-5 mx-auto mb-1 text-gray-500" />
                              )}
                              <p className="text-[10px] text-gray-400">
                                {bodyImageLoading.image2 ? 'Uploading...' : 'Upload'}
                              </p>
                            </div>
                          </div>
                        </div>

                        {/* AI Generate Button */}
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-full border-purple-500/30 text-purple-400 hover:bg-purple-500/10 flex flex-col items-center justify-center gap-1 py-2"
                          disabled={bodyImageLoading.image2 || !formData.title}
                          onClick={async () => {
                            setBodyImageLoading(prev => ({ ...prev, image2: true }));
                            try {
                              const res = await fetch('/api/insights/generate-image', {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({
                                  prompt: `HYPER-REALISTIC CINEMATIC PHOTOGRAPHY: Inspiring conclusion shot for "${formData.title}".
Shot on RED Komodo 6K cinema camera with Zeiss Supreme Prime 50mm. Golden hour side lighting through floor-to-ceiling windows.
Subject: Successful Filipino BPO team celebrating, collaborative meeting, or professional achievement moment. Genuine smiles, team spirit.
Setting: Executive conference room or premium open office with Manila skyline visible. Plants, modern furniture, glass walls.
Composition: Wide establishing shot or medium group shot, cinematic 2.39:1 aspect, lens flare accents.
Technical: 6K resolution, film grain texture, teal and orange color grade, dramatic shadows.
Mood: Aspirational, empowering, career success, bright future ahead.
Style: Fortune 500 annual report cover, premium brand campaign quality.
ABSOLUTELY NO: fake enthusiasm, clipart, illustrations, 3D renders, obvious AI generation, text.`,
                                  title: formData.title,
                                  slug: formData.slug,
                                  style: 'cinematic'
                                })
                              });
                              const data = await res.json();
                              if (data.imageUrl) {
                                setFormData(prev => ({ ...prev, content_image2: data.imageUrl }));
                                toast({ title: '🎨 Image 2 generated!' });
                              } else if (data.error) {
                                toast({ title: '❌ ' + data.error, variant: 'destructive' });
                              }
                            } catch (err) {
                              toast({ title: '❌ Generation failed', variant: 'destructive' });
                            }
                            setBodyImageLoading(prev => ({ ...prev, image2: false }));
                          }}
                        >
                          {bodyImageLoading.image2 ? (
                            <Loader2 className="w-5 h-5 animate-spin" />
                          ) : (
                            <Wand2 className="w-5 h-5" />
                          )}
                          <span className="text-[10px]">AI Generate</span>
                        </Button>
                      </div>

                      {/* Section 3 Alt Text */}
                      <div className="mt-3 space-y-1">
                        <div className="flex items-center justify-between">
                          <Label className="text-[10px] text-gray-500 uppercase tracking-tight">Section 3 Alt Text (SEO)</Label>
                          <div className="flex gap-1">
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-5 px-1.5 text-[10px] text-purple-400 hover:text-purple-300 hover:bg-purple-500/10"
                              disabled={altTextGenerating.section3 || !formData.content_image2}
                              onClick={async () => {
                                setAltTextGenerating(prev => ({ ...prev, section3: true }));
                                try {
                                  const res = await fetch('/api/insights/generate-alt-text', {
                                    method: 'POST',
                                    headers: { 'Content-Type': 'application/json' },
                                    body: JSON.stringify({
                                      sectionContent: formData.content_part3 || formData.content_part2,
                                      imageUrl: formData.content_image2,
                                      articleTitle: formData.title,
                                      sectionNumber: 3,
                                    }),
                                  });
                                  const data = await res.json();
                                  if (data.success && data.altText) {
                                    setFormData(prev => ({ ...prev, section3_image_alt: data.altText }));
                                    toast({ title: '✨ Alt text generated for Section 3' });
                                  } else {
                                    toast({ title: '❌ ' + (data.error || 'Generation failed'), variant: 'destructive' });
                                  }
                                } catch (err) {
                                  toast({ title: '❌ Generation failed', variant: 'destructive' });
                                }
                                setAltTextGenerating(prev => ({ ...prev, section3: false }));
                              }}
                            >
                              {altTextGenerating.section3 ? (
                                <Loader2 className="w-3 h-3 animate-spin" />
                              ) : (
                                <><Wand2 className="w-3 h-3 mr-0.5" />AI</>
                              )}
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-5 px-1.5 text-[10px] text-green-400 hover:text-green-300 hover:bg-green-500/10"
                              disabled={altTextSaving.section3 || !formData.section3_image_alt}
                              onClick={async () => {
                                setAltTextSaving(prev => ({ ...prev, section3: true }));
                                try {
                                  const res = await fetch('/api/insights/save-alt-text', {
                                    method: 'POST',
                                    headers: { 'Content-Type': 'application/json' },
                                    body: JSON.stringify({
                                      insightId: post?.id,
                                      sectionNumber: 3,
                                      altText: formData.section3_image_alt,
                                      imageUrl: formData.content_image2,
                                    }),
                                  });
                                  const data = await res.json();
                                  if (data.success) {
                                    toast({ title: '💾 Section 3 alt text saved!' });
                                  } else {
                                    toast({ title: '❌ ' + (data.error || 'Save failed'), variant: 'destructive' });
                                  }
                                } catch (err) {
                                  toast({ title: '❌ Save failed', variant: 'destructive' });
                                }
                                setAltTextSaving(prev => ({ ...prev, section3: false }));
                              }}
                            >
                              {altTextSaving.section3 ? (
                                <Loader2 className="w-3 h-3 animate-spin" />
                              ) : (
                                <><Save className="w-3 h-3 mr-0.5" />Save</>
                              )}
                            </Button>
                          </div>
                        </div>
                        <Input
                          value={formData.section3_image_alt}
                          onChange={(e) => setFormData({ ...formData, section3_image_alt: e.target.value })}
                          className="bg-black/20 text-xs h-8 border-purple-500/20 focus:border-purple-500/50"
                          placeholder="Describe image 3 for SEO..."
                        />
                      </div>
                    </div>

                    <p className="text-[10px] text-gray-500 text-center">
                      Images will be inserted between content sections in the article
                    </p>
                  </CardContent>
                </Card>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="links">
            {post?.id ? (
              <LinkManager postId={post.id} postTitle={formData.title} />
            ) : (
              <div className="text-center p-12 text-gray-400">
                Please save the post first to manage internal links.
              </div>
            )}
          </TabsContent>

          <TabsContent value="seo">
            <Card className="bg-white/5 border-white/10">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Search className="w-4 h-4 text-green-400" /> SEO & Metadata
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label>Meta Title</Label>
                  <Input
                    value={seoData.meta_title}
                    onChange={(e) => setSeoData({ ...seoData, meta_title: e.target.value })}
                    className="bg-black/20"
                    placeholder="Defaults to post title"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Keywords (comma separated)</Label>
                  <Textarea
                    value={seoData.keywords}
                    onChange={(e) => setSeoData({ ...seoData, keywords: e.target.value })}
                    className="bg-black/20 h-24"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Canonical URL</Label>
                  <Input
                    value={seoData.canonical_url}
                    onChange={(e) => setSeoData({ ...seoData, canonical_url: e.target.value })}
                    className="bg-black/20 text-xs"
                  />
                </div>

                {/* Focus Keywords Section */}
                <div className="space-y-4 border-t border-white/10 pt-4 mt-4">
                  <h4 className="font-medium text-sm text-gray-300 flex items-center gap-2">
                    <Search className="w-4 h-4 text-green-400" /> Focus Keywords
                  </h4>

                  <div className="space-y-2">
                    <Label>Primary Focus Keyword</Label>
                    <Input
                      value={seoData.focus_keyword}
                      onChange={(e) => setSeoData({ ...seoData, focus_keyword: e.target.value })}
                      className="bg-black/20"
                      placeholder="Main keyword to target (e.g., 'BPO salary Philippines')"
                    />
                    <p className="text-xs text-gray-500">The primary keyword this article should rank for</p>
                  </div>

                  <div className="space-y-2">
                    <Label>Secondary Keywords</Label>
                    <Textarea
                      value={seoData.secondary_keywords?.join(', ') || ''}
                      onChange={(e) => setSeoData({
                        ...seoData,
                        secondary_keywords: e.target.value.split(',').map((k: string) => k.trim()).filter(Boolean)
                      })}
                      className="bg-black/20 h-20"
                      placeholder="Related keywords, comma separated (e.g., 'call center pay, BPO compensation')"
                    />
                    <p className="text-xs text-gray-500">Supporting keywords to include naturally in content</p>
                  </div>
                </div>

                {/* Schema Markup Section */}
                <div className="space-y-4 border-t border-white/10 pt-4 mt-4">
                  <h4 className="font-medium text-sm text-gray-300 flex items-center gap-2">
                    <Globe className="w-4 h-4 text-purple-400" /> Schema Markup (JSON-LD)
                  </h4>

                  <div className="space-y-2">
                    <Label>Schema Markup</Label>
                    <Textarea
                      value={seoData.schema_markup ? JSON.stringify(seoData.schema_markup, null, 2) : ''}
                      onChange={(e) => {
                        try {
                          const parsed = e.target.value ? JSON.parse(e.target.value) : null;
                          setSeoData({ ...seoData, schema_markup: parsed });
                        } catch {
                          // Allow invalid JSON while typing
                        }
                      }}
                      className="bg-black/20 h-40 font-mono text-xs"
                      placeholder='{"@context": "https://schema.org", "@type": "Article", ...}'
                    />
                    <p className="text-xs text-gray-500">Structured data for search engines (Article, FAQ, HowTo schema)</p>
                  </div>

                  {/* Quick Schema Templates */}
                  <div className="flex gap-2 flex-wrap">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="h-7 text-xs border-purple-500/30 text-purple-400 hover:bg-purple-500/10"
                      onClick={() => {
                        const articleSchema = {
                          '@context': 'https://schema.org',
                          '@type': 'Article',
                          headline: formData.title,
                          description: formData.description,
                          image: formData.hero_url,
                          author: {
                            '@type': 'Person',
                            name: formData.author || 'Ate Yna'
                          },
                          publisher: {
                            '@type': 'Organization',
                            name: 'BPOC.IO',
                            logo: { '@type': 'ImageObject', url: 'https://www.bpoc.io/logo.png' }
                          },
                          datePublished: new Date().toISOString(),
                          dateModified: new Date().toISOString()
                        };
                        setSeoData({ ...seoData, schema_markup: articleSchema });
                      }}
                    >
                      Article Schema
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="h-7 text-xs border-green-500/30 text-green-400 hover:bg-green-500/10"
                      onClick={() => {
                        const faqSchema = {
                          '@context': 'https://schema.org',
                          '@type': 'FAQPage',
                          mainEntity: [
                            {
                              '@type': 'Question',
                              name: 'Question 1?',
                              acceptedAnswer: { '@type': 'Answer', text: 'Answer 1' }
                            }
                          ]
                        };
                        setSeoData({ ...seoData, schema_markup: faqSchema });
                      }}
                    >
                      FAQ Schema
                    </Button>
                    {seoData.schema_markup && (
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="h-7 text-xs border-red-500/30 text-red-400 hover:bg-red-500/10"
                        onClick={() => setSeoData({ ...seoData, schema_markup: null })}
                      >
                        Clear Schema
                      </Button>
                    )}
                  </div>
                </div>

                {/* Open Graph Section */}
                <div className="space-y-4 border-t border-white/10 pt-4 mt-4">
                  <h4 className="font-medium text-sm text-gray-300 flex items-center gap-2">
                    <Globe className="w-4 h-4 text-blue-400" /> Open Graph (Social Sharing)
                  </h4>

                  <div className="space-y-2">
                    <Label>OG Title</Label>
                    <Input
                      value={formData.og_title}
                      onChange={(e) => setFormData({ ...formData, og_title: e.target.value })}
                      className="bg-black/20"
                      placeholder="Title for social media (defaults to post title)"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label>OG Description</Label>
                    <Textarea
                      value={formData.og_description}
                      onChange={(e) => setFormData({ ...formData, og_description: e.target.value })}
                      className="bg-black/20 h-20"
                      placeholder="Description for social shares (defaults to post description)"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label>OG Image URL</Label>
                    <Input
                      value={formData.og_image}
                      onChange={(e) => setFormData({ ...formData, og_image: e.target.value })}
                      className="bg-black/20 text-xs font-mono"
                      placeholder="Image for social sharing (defaults to hero image)"
                    />
                    {formData.og_image && (
                      <div className="mt-2 rounded-lg overflow-hidden border border-white/10">
                        <img src={formData.og_image} alt="OG Preview" className="w-full h-24 object-cover" />
                      </div>
                    )}
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Cover Image URL</Label>
                      <Input
                        value={formData.cover_image}
                        onChange={(e) => setFormData({ ...formData, cover_image: e.target.value })}
                        className="bg-black/20 text-xs font-mono"
                        placeholder="Defaults to hero image"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Cover Image Alt</Label>
                      <Input
                        value={formData.cover_image_alt}
                        onChange={(e) => setFormData({ ...formData, cover_image_alt: e.target.value })}
                        className="bg-black/20"
                        placeholder="Alt text for cover image"
                      />
                    </div>
                  </div>
                </div>

                {/* Humanization Score Display */}
                {formData.humanization_score && (
                  <div className="border-t border-white/10 pt-4 mt-4">
                    <div className="flex items-center justify-between p-3 rounded-lg bg-black/20 border border-white/5">
                      <div>
                        <Label className="text-sm">Humanization Score</Label>
                        <p className="text-xs text-gray-500">Content authenticity rating</p>
                      </div>
                      <Badge
                        variant="outline"
                        className={`text-lg font-bold ${
                          formData.humanization_score >= 85
                            ? 'border-green-500/50 text-green-400'
                            : formData.humanization_score >= 70
                              ? 'border-yellow-500/50 text-yellow-400'
                              : 'border-red-500/50 text-red-400'
                        }`}
                      >
                        {formData.humanization_score}%
                      </Badge>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      )
      }

      {/* Image Preview Modal */}
      {
        previewImageUrl && (
          <div
            className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm animate-in fade-in duration-200"
            onClick={() => setPreviewImageUrl(null)}
          >
            <div className="relative max-w-[90vw] max-h-[90vh]">
              {/* Close button */}
              <button
                onClick={() => setPreviewImageUrl(null)}
                className="absolute -top-12 right-0 w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center transition-colors border border-white/20"
              >
                <X className="w-5 h-5 text-white" />
              </button>

              {/* Image */}
              <img
                src={previewImageUrl}
                alt="Full size preview"
                className="max-w-[90vw] max-h-[85vh] object-contain rounded-lg shadow-2xl"
                onClick={(e) => e.stopPropagation()}
              />

              {/* Open in new tab link */}
              <a
                href={previewImageUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="absolute -bottom-12 left-1/2 -translate-x-1/2 flex items-center gap-2 px-4 py-2 rounded-full bg-white/10 hover:bg-white/20 text-white text-sm transition-colors border border-white/20"
                onClick={(e) => e.stopPropagation()}
              >
                <ExternalLink className="w-4 h-4" />
                Open in new tab
              </a>
            </div>
          </div>
        )
      }
    </div >
  );
}

'use client';

/**
 * AI CONTENT PIPELINE - COMPLETE 9-STAGE WIZARD
 * 
 * Stage 1: Voice Brief → Whisper → AI Fix → Confirm
 * Stage 2: Research → Serper.ai + HR KB
 * Stage 3: Plan → Claude generates structure → Approve
 * Stage 4: Write → Claude + Ate Yna personality
 * Stage 5: Humanize → Grok (pass AI detectors)
 * Stage 6: SEO → Gemini (internal links, keywords) + Changes Summary
 * Stage 7: Meta → GPT-4o-mini (silo-aware canonical)
 * Stage 8: Media → Hero video/image + Section images (Veo, Imagen 4)
 * Stage 9: Publish → Preview + Save/Publish
 */

import { useState, useRef, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/shared/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/shared/ui/card';
import { Input } from '@/components/shared/ui/input';
import { Textarea } from '@/components/shared/ui/textarea';
import { Badge } from '@/components/shared/ui/badge';
import { 
  Mic, Square, Loader2, Search, FileText, Pencil, Bot, Sparkles, 
  CheckCircle, Image as ImageIcon, ArrowLeft, ArrowRight, Save, ChevronRight, Brain,
  Wand2, Check, X, AlertTriangle, HelpCircle, Edit3, Eye, RefreshCw,
  Clock, TrendingUp, Hash, Link as LinkIcon, BarChart3, Globe
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import MediaStage from './components/MediaStage';

// ============================================================================
// TYPES
// ============================================================================
interface PipelineState {
  // Stage 1
  transcript: string;
  briefConfirmed: boolean;
  selectedSilo: string;
  selectedSiloId: string | null;
  customTopic: string;
  selectedIdea: any;
  isSiloPage: boolean; // Whether this article IS a silo page
  isPillar: boolean; // Alias for isSiloPage (used by types.ts StageProps)
  
  // Stage 2
  researchData: any;
  
  // Stage 3
  plan: any;
  planApproved: boolean;
  
  // Stage 4
  article: string;
  wordCount: number;
  
  // Stage 5
  humanizedArticle: string;
  humanScore: number;
  humanizeChanges: any;
  
  // Stage 6
  seoArticle: string;
  seoStats: any;
  seoChanges: any;
  seoSummary: string;
  
  // Stage 7
  meta: any;
  images: any[];
  imagePrompts: any[];
  metaSummary: any;
  
  // Stage 8 - Media
  contentSections: string[];
  heroType: 'image' | 'video' | null;
  videoUrl: string | null;
  
  // Pipeline
  draftId: string | null;
  insightId: string | null;
  pipelineId: string | null;
}

const initialState: PipelineState = {
  transcript: '',
  briefConfirmed: false,
  selectedSilo: '',
  selectedSiloId: null,
  customTopic: '',
  selectedIdea: null,
  isSiloPage: false,
  isPillar: false,
  researchData: null,
  plan: null,
  planApproved: false,
  article: '',
  wordCount: 0,
  humanizedArticle: '',
  humanScore: 0,
  humanizeChanges: null,
  seoArticle: '',
  seoStats: null,
  seoChanges: null,
  seoSummary: '',
  meta: null,
  images: [],
  imagePrompts: [],
  metaSummary: null,
  contentSections: [],
  heroType: null,
  videoUrl: null,
  draftId: null,
  insightId: null,
  pipelineId: null,
};

// ============================================================================
// SILOS
// ============================================================================
const BPO_SILOS = [
  { id: 'salary', name: '💰 Salary & Compensation', description: 'BPO salary guides, pay scales', slug: 'bpo-salary-compensation' },
  { id: 'career', name: '📈 Career Growth', description: 'Promotions, leadership', slug: 'bpo-career-growth' },
  { id: 'jobs', name: '🔎 BPO Jobs', description: 'Job openings, hiring', slug: 'bpo-jobs' },
  { id: 'interview', name: '🎤 Interview Tips', description: 'Interview prep, Versant', slug: 'interview-tips' },
  { id: 'employment-guide', name: '🇵🇭 Employment Guide', description: 'DOLE laws, rights', slug: 'bpo-employment-guide' },
  { id: 'companies', name: '🏢 Company Reviews', description: 'BPO reviews, culture', slug: 'bpo-company-reviews' },
  { id: 'training', name: '📚 Training', description: 'Training, certifications', slug: 'training-and-certifications' },
  { id: 'worklife', name: '⚖️ Work-Life Balance', description: 'Stress, schedules', slug: 'work-life-balance' },
];

// ============================================================================
// ELAPSED TIME HOOK
// ============================================================================
function useElapsedTime(isRunning: boolean) {
  const [elapsed, setElapsed] = useState(0);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (isRunning) {
      setElapsed(0);
      intervalRef.current = setInterval(() => {
        setElapsed(prev => prev + 1);
      }, 1000);
    } else {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    }
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [isRunning]);

  const formatted = `${Math.floor(elapsed / 60)}:${String(elapsed % 60).padStart(2, '0')}`;
  return { elapsed, formatted };
}

// ============================================================================
// STEP PRELOADER COMPONENT
// ============================================================================
function StepPreloader({ icon, title, description, warning, elapsed }: {
  icon: string;
  title: string;
  description: string;
  warning?: string;
  elapsed: string;
}) {
  return (
    <div className="text-center space-y-4 py-8">
      <Loader2 className="w-10 h-10 animate-spin text-purple-500 mx-auto" />
      <h3 className="text-xl font-bold text-white">{icon} {title}</h3>
      <p className="text-gray-400">{description}</p>
      <div className="flex items-center justify-center gap-2 text-sm text-gray-500">
        <Clock className="w-4 h-4" />
        <span>Elapsed: {elapsed}</span>
      </div>
      {warning && (
        <p className="text-xs text-amber-500 flex items-center justify-center gap-1">
          <AlertTriangle className="w-3 h-3" /> {warning}
        </p>
      )}
    </div>
  );
}

// ============================================================================
// RESULT PANEL COMPONENT
// ============================================================================
function ResultPanel({ title, icon, children, color = 'green' }: {
  title: string;
  icon: React.ReactNode;
  children: React.ReactNode;
  color?: 'green' | 'blue' | 'purple' | 'pink' | 'indigo' | 'yellow';
}) {
  const colorClasses = {
    green: 'bg-green-500/10 border-green-500/30',
    blue: 'bg-blue-500/10 border-blue-500/30',
    purple: 'bg-purple-500/10 border-purple-500/30',
    pink: 'bg-pink-500/10 border-pink-500/30',
    indigo: 'bg-indigo-500/10 border-indigo-500/30',
    yellow: 'bg-yellow-500/10 border-yellow-500/30',
  };

  return (
    <div className={`${colorClasses[color]} border rounded-xl p-4 space-y-3`}>
      <div className="flex items-center gap-2 font-semibold text-white">
        {icon}
        <span>{title}</span>
      </div>
      {children}
    </div>
  );
}

// ============================================================================
// VOICE RECORDER COMPONENT
// ============================================================================
function VoiceRecorder({ onTranscript }: { onTranscript: (text: string) => void }) {
  const [status, setStatus] = useState<'idle' | 'recording' | 'processing' | 'transcribing'>('idle');
  const [seconds, setSeconds] = useState(0);
  const [error, setError] = useState('');

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  const { toast } = useToast();

  const cleanup = () => {
    if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
    if (streamRef.current) { streamRef.current.getTracks().forEach(t => t.stop()); streamRef.current = null; }
    mediaRecorderRef.current = null;
    setSeconds(0);
  };

  const startRecording = async () => {
    setError('');
    chunksRef.current = [];
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } });
      streamRef.current = stream;
      const mimeTypes = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4'];
      let selectedMime = mimeTypes.find(m => MediaRecorder.isTypeSupported(m)) || '';
      const recorder = selectedMime ? new MediaRecorder(stream, { mimeType: selectedMime }) : new MediaRecorder(stream);
      mediaRecorderRef.current = recorder;
      recorder.ondataavailable = (e) => { if (e.data.size > 0) chunksRef.current.push(e.data); };
      recorder.onstop = async () => {
        cleanup();
        if (chunksRef.current.length === 0) { setError('No audio captured'); setStatus('idle'); return; }
        const blob = new Blob(chunksRef.current, { type: recorder.mimeType || 'audio/webm' });
        if (blob.size < 1000) { setError('Recording too short'); setStatus('idle'); return; }
        setStatus('transcribing');
        try {
          const formData = new FormData();
          formData.append('audio', blob, 'recording.webm');
          const res = await fetch('/api/insights/pipeline/voice-personality', { method: 'POST', body: formData });
          const json = await res.json();
          const text = json.transcription || json.transcript;
          if (text) { onTranscript(text); toast({ title: '✅ Transcribed!' }); }
          else { setError(json.error || 'No transcript'); }
        } catch (err: any) { setError(err.message); }
        setStatus('idle');
      };
      recorder.start(500);
      setStatus('recording');
      toast({ title: '🔴 Recording', description: 'Click STOP when done' });
      let count = 0;
      timerRef.current = setInterval(() => { count++; setSeconds(count); }, 1000);
    } catch (err: any) { setError(err.message); cleanup(); }
  };

  const stopRecording = () => {
    const recorder = mediaRecorderRef.current;
    if (recorder && recorder.state === 'recording') {
      try { recorder.requestData(); } catch {}
      recorder.stop();
      setStatus('processing');
    } else { setStatus('idle'); cleanup(); }
  };

  const formatTime = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;

  return (
    <Card className="bg-gradient-to-br from-purple-500/10 to-pink-500/10 border-purple-500/20">
      <CardContent className="pt-6 text-center space-y-4">
        {error && <div className="bg-red-500/20 border border-red-500 rounded-lg p-3"><p className="text-red-400 text-sm">❌ {error}</p></div>}
        {status === 'idle' && (
          <>
            <div className="w-24 h-24 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 mx-auto flex items-center justify-center">
              <Mic className="w-12 h-12 text-white" />
            </div>
            <p className="text-lg font-bold text-white">Record Your Brief</p>
            <Button onClick={startRecording} size="lg" className="w-56 h-14 bg-gradient-to-r from-purple-500 to-pink-500 text-lg font-bold">
              <Mic className="w-5 h-5 mr-2" /> START
            </Button>
          </>
        )}
        {status === 'recording' && (
          <>
            <div className="w-24 h-24 rounded-full bg-red-500 mx-auto flex items-center justify-center animate-pulse"><Square className="w-10 h-10 text-white fill-white" /></div>
            <p className="text-2xl font-bold text-white">🔴 RECORDING</p>
            <p className="text-3xl font-mono font-bold text-red-400">{formatTime(seconds)}</p>
            <Button onClick={stopRecording} size="lg" className="w-56 h-14 bg-red-600 hover:bg-red-700 text-lg font-bold">
              <Square className="w-5 h-5 mr-2 fill-white" /> STOP
            </Button>
          </>
        )}
        {(status === 'processing' || status === 'transcribing') && (
          <>
            <Loader2 className="w-16 h-16 mx-auto text-purple-400 animate-spin" />
            <p className="text-lg font-bold text-white">{status === 'processing' ? 'Processing...' : 'Transcribing with Whisper...'}</p>
          </>
        )}
      </CardContent>
    </Card>
  );
}

// ============================================================================
// MAIN PAGE COMPONENT
// ============================================================================
// ============================================================================
// LOCAL STORAGE PERSISTENCE - Save/restore pipeline state per stage
// ============================================================================
const PIPELINE_STORAGE_KEY = 'bpoc-pipeline-progress';

function savePipelineToStorage(stage: number, state: PipelineState, extras?: Record<string, any>) {
  try {
    const data = { stage, state, extras: extras || {}, savedAt: Date.now() };
    localStorage.setItem(PIPELINE_STORAGE_KEY, JSON.stringify(data));
  } catch (e) { console.warn('Failed to save pipeline to localStorage:', e); }
}

function loadPipelineFromStorage(): { stage: number; state: PipelineState; extras: Record<string, any> } | null {
  try {
    const raw = localStorage.getItem(PIPELINE_STORAGE_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw);
    // Expire after 24 hours
    if (Date.now() - data.savedAt > 24 * 60 * 60 * 1000) {
      localStorage.removeItem(PIPELINE_STORAGE_KEY);
      return null;
    }
    return data;
  } catch (e) { return null; }
}

function clearPipelineStorage() {
  localStorage.removeItem(PIPELINE_STORAGE_KEY);
}

// ============================================================================
// PIPELINE ROW ↔ STATE MAPPING
// ============================================================================
function pipelineRowToState(row: any): { stage: number; state: PipelineState; extras: Record<string, any> } {
  return {
    stage: row.current_stage || 1,
    state: {
      ...initialState,
      transcript: row.brief_transcript || '',
      briefConfirmed: !!(row.brief_transcript),
      selectedSilo: row.selected_silo || '',
      selectedSiloId: row.selected_silo_id || null,
      customTopic: '',
      selectedIdea: row.selected_idea || null,
      isSiloPage: row.meta_data?.isSiloPage || false,
      isPillar: row.meta_data?.isSiloPage || false,
      researchData: row.serper_results ? { research: { serper: row.serper_results, perplexity: row.hr_kb_results, synthesis: row.research_synthesis } } : null,
      plan: row.article_plan || null,
      planApproved: row.plan_approved || false,
      article: row.raw_article || '',
      wordCount: row.word_count || 0,
      humanizedArticle: row.humanized_article || '',
      humanScore: row.human_score || 0,
      humanizeChanges: null,
      seoArticle: row.seo_article || '',
      seoStats: row.seo_stats || null,
      seoChanges: null,
      seoSummary: '',
      meta: row.meta_data || null,
      images: row.generated_images || [],
      imagePrompts: row.image_prompts || [],
      metaSummary: null,
      contentSections: [row.content_section1, row.content_section2, row.content_section3].filter(Boolean),
      heroType: row.hero_type || null,
      videoUrl: row.video_url || null,
      draftId: null,
      insightId: row.insight_id || null,
      pipelineId: row.id,
    },
    extras: {
      heroType: row.hero_type || 'video',
      heroSource: row.hero_source || null,
      sectionSource: row.section_source || null,
    },
  };
}

// Get stage-specific data for pipeline update
function getStageUpdateData(stageNum: number, currentState: PipelineState, extras: { heroType?: string; heroSource?: string | null; sectionSource?: string | null }) {
  switch (stageNum) {
    case 1: return { transcript: currentState.transcript, selectedSilo: currentState.selectedSilo, selectedSiloId: currentState.selectedSiloId, selectedIdea: currentState.selectedIdea, isSiloPage: currentState.isSiloPage };
    case 2: return { researchData: currentState.researchData, selectedIdea: currentState.selectedIdea };
    case 3: return { plan: currentState.plan, planApproved: currentState.planApproved };
    case 4: return { article: currentState.article, wordCount: currentState.wordCount };
    case 5: return { humanizedArticle: currentState.humanizedArticle, humanScore: currentState.humanScore };
    case 6: return { seoArticle: currentState.seoArticle, seoStats: currentState.seoStats };
    case 7: return { meta: currentState.meta, images: currentState.images, imagePrompts: currentState.imagePrompts };
    case 8: return { heroSource: extras.heroSource, sectionSource: extras.sectionSource, videoUrl: currentState.videoUrl, heroType: extras.heroType, images: currentState.images, contentSections: currentState.contentSections };
    case 9: return { markComplete: true };
    default: return {};
  }
}

export default function CreateInsightPage() {
  const [stage, setStage] = useState(1);
  const [state, setState] = useState<PipelineState>(initialState);
  const [loading, setLoading] = useState(false);
  const [ideas, setIdeas] = useState<any[]>([]);
  const [aiCorrections, setAiCorrections] = useState<any[]>([]);
  const [isEditingBrief, setIsEditingBrief] = useState(false);
  const [editedBrief, setEditedBrief] = useState('');
  const [briefMode, setBriefMode] = useState<'voice' | 'text'>('voice');
  const [textBrief, setTextBrief] = useState('');
  const [stageOutputs, setStageOutputs] = useState<Record<string, any>>({});
  const [heroType, setHeroType] = useState<'image' | 'video'>('video');
  const [heroSource, setHeroSource] = useState<'generate' | 'upload' | null>(null);
  const [sectionSource, setSectionSource] = useState<'generate' | 'upload' | null>(null);
  const [uploadedImages, setUploadedImages] = useState<{ hero?: string; section1?: string; section2?: string; section3?: string }>({});
  const [hasRestoredSession, setHasRestoredSession] = useState(false);
  const [existingDrafts, setExistingDrafts] = useState<any[]>([]);
  const [loadingDrafts, setLoadingDrafts] = useState(false);
  
  const router = useRouter();
  const { toast } = useToast();
  const { formatted: elapsedTime } = useElapsedTime(loading);

  const update = (updates: Partial<PipelineState>) => setState(prev => {
    const newState = { ...prev, ...updates };
    // Quick localStorage save for instant persistence
    savePipelineToStorage(stage, newState, { heroType, heroSource, sectionSource, uploadedImages });
    return newState;
  });

  // ========== PIPELINE PERSISTENCE (content_pipelines table) ==========
  
  // Create a new pipeline in the database
  const createPipeline = useCallback(async (currentState: PipelineState): Promise<string | null> => {
    try {
      const res = await fetch('/api/content-pipeline/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          briefType: briefMode || 'text',
          briefTranscript: currentState.transcript,
          selectedSilo: currentState.selectedSilo || null,
          selectedSiloId: currentState.selectedSiloId || null,
          isSiloPage: currentState.isSiloPage || false,
        }),
      });
      const result = await res.json();
      if (result.success && result.pipelineId) {
        console.log(`[Pipeline] Created pipeline ${result.pipelineId}`);
        return result.pipelineId;
      }
      console.error('[Pipeline] Failed to create:', result.error);
    } catch (err) {
      console.error('[Pipeline] Error creating pipeline:', err);
    }
    return null;
  }, [briefMode]);

  // Update pipeline with stage-specific data
  const updatePipeline = useCallback(async (pipelineId: string, stageNum: number, data: Record<string, any>, silent = true) => {
    try {
      const res = await fetch('/api/content-pipeline/update', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pipelineId, stage: stageNum, data }),
      });
      const result = await res.json();
      if (!result.success) {
        console.error('[Pipeline] Update failed:', result.error);
      } else if (!silent) {
        toast({ title: '💾 Progress saved!', description: `Stage ${stageNum} saved to pipeline` });
      }
      return result.success;
    } catch (err) {
      console.error('[Pipeline] Error updating pipeline:', err);
      return false;
    }
  }, []);

  // Load a pipeline from the database
  const loadPipelineFromServer = useCallback(async (pipelineId: string) => {
    try {
      const res = await fetch(`/api/content-pipeline/get?id=${pipelineId}`);
      const result = await res.json();
      if (result.success && result.pipeline) {
        const row = result.pipeline;
        const restored = pipelineRowToState(row);
        setState(restored.state);
        setStage(restored.stage);
        if (restored.extras.heroType) setHeroType(restored.extras.heroType);
        if (restored.extras.heroSource) setHeroSource(restored.extras.heroSource);
        if (restored.extras.sectionSource) setSectionSource(restored.extras.sectionSource);
        toast({ 
          title: `♻️ Pipeline Restored — Stage ${restored.stage}`, 
          description: `"${row.selected_idea?.title || row.brief_transcript?.slice(0, 50) || 'Untitled'}"` 
        });
        console.log(`[Pipeline] Restored pipeline ${pipelineId} at Stage ${restored.stage}`);
        return true;
      }
    } catch (err) {
      console.error('[Pipeline] Failed to load pipeline:', err);
    }
    return false;
  }, []);

  // ========== RESTORE ON MOUNT: ?pipeline=ID > ?test=media > localStorage ==========
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);

    // Priority 1: ?pipeline=ID — load from content_pipelines
    const pipelineId = params.get('pipeline');
    if (pipelineId) {
      loadPipelineFromServer(pipelineId);
      return;
    }

    // Priority 2: ?test=media — jump to Stage 8 with test data
    const testMode = params.get('test');
    if (testMode === 'media') {
      const testArticle = `## Top BPO Jobs in the Philippines for 2025\n\nThe Business Process Outsourcing (BPO) industry in the Philippines continues to thrive, offering numerous career opportunities for Filipino professionals.\n\n## Customer Service Representative\n\nCustomer service roles remain the backbone of the Philippine BPO industry. These positions require excellent English communication skills, patience, and the ability to resolve customer issues efficiently.\n\n## Technical Support Specialist\n\nWith the growing demand for tech-savvy professionals, technical support roles have become increasingly popular in Philippine call centers. These positions offer higher salaries and clear career advancement paths.\n\n## Quality Assurance Analyst\n\nQA analysts play a crucial role in maintaining service standards across BPO operations. They monitor calls, evaluate agent performance, and provide actionable feedback to improve customer satisfaction.\n\n## Team Leader / Supervisor\n\nFor those looking to advance beyond agent-level positions, team leader roles offer a natural progression. These positions involve managing a team of 15-20 agents and meeting performance targets.\n\n## The Future of BPO Careers\n\nAs AI and automation reshape the industry, BPO professionals who upskill in areas like data analysis, AI prompt engineering, and digital transformation will be best positioned for long-term career growth.`;
      setState({
        ...initialState,
        transcript: 'Write an article about the top BPO jobs in the Philippines for 2025, covering customer service, tech support, QA, and team leader roles.',
        briefConfirmed: true, selectedSilo: 'jobs', customTopic: '',
        selectedIdea: { title: 'Top BPO Jobs in the Philippines for 2025', keywords: ['BPO jobs', 'Philippines employment', 'call center careers'] },
        isSiloPage: false,
        researchData: { sources: ['industry reports', 'IBPAP data'], keyFindings: ['BPO employs 1.7M Filipinos', 'Industry growing 7% annually'] },
        plan: { title: 'Top BPO Jobs in the Philippines for 2025', sections: ['Customer Service', 'Tech Support', 'QA', 'Team Leader', 'Future'], wordTarget: 1500 },
        planApproved: true, article: testArticle, wordCount: 287,
        humanizedArticle: testArticle, humanScore: 92, humanizeChanges: null,
        seoArticle: testArticle, seoStats: { readabilityScore: 85, keywordDensity: 2.1 }, seoChanges: null, seoSummary: 'Added internal links',
        meta: { metaTitle: 'Top BPO Jobs in the Philippines for 2025 | BPOC', metaDescription: 'Discover the highest-paying BPO jobs in the Philippines.', canonicalUrl: 'https://bpoc.io/insights/top-bpo-jobs-philippines-2025', canonicalSlug: 'top-bpo-jobs-philippines-2025', focusKeyword: 'BPO jobs Philippines', semanticKeywords: ['call center jobs', 'Philippines employment'], clusterKeywords: ['career growth', 'BPO salary'], ogTitle: 'Top BPO Jobs in the Philippines for 2025', twitterTitle: 'Best BPO Career Opportunities', isSiloPage: false },
        images: [], imagePrompts: [], metaSummary: null, contentSections: [], heroType: null, videoUrl: null, draftId: null, insightId: null, pipelineId: null, selectedSiloId: null, isPillar: false,
      });
      setStage(8);
      toast({ title: '🧪 Test Mode — Stage 8: Media', description: 'Pre-populated with test article data' });
      return;
    }

    // Priority 3: localStorage fallback
    const saved = loadPipelineFromStorage();
    if (saved && saved.stage > 1) {
      const restoredState = { ...initialState, ...saved.state };
      setState(restoredState);
      setStage(saved.stage);
      if (saved.extras?.heroType) setHeroType(saved.extras.heroType);
      if (saved.extras?.heroSource) setHeroSource(saved.extras.heroSource);
      if (saved.extras?.sectionSource) setSectionSource(saved.extras.sectionSource);
      if (saved.extras?.uploadedImages) setUploadedImages(saved.extras.uploadedImages);
      setHasRestoredSession(true);
    }
  }, []);

  // Show restore toast for localStorage
  useEffect(() => {
    if (hasRestoredSession) {
      toast({ title: `♻️ Session Restored — Stage ${stage}`, description: 'Your previous progress was loaded. Click "Start Fresh" to reset.' });
      setHasRestoredSession(false);
    }
  }, [hasRestoredSession]);

  // ========== FETCH EXISTING PIPELINES ON MOUNT ==========
  useEffect(() => {
    (async () => {
      try {
        setLoadingDrafts(true);
        const res = await fetch('/api/content-pipeline/list?status=active&limit=5');
        const result = await res.json();
        if (result.success && result.pipelines?.length > 0) {
          setExistingDrafts(result.pipelines);
        }
      } catch (e) { console.error('Failed to load pipelines:', e); }
      finally { setLoadingDrafts(false); }
    })();
  }, []);

  // ========== AUTO-SAVE PIPELINE ON STAGE CHANGE ==========
  useEffect(() => {
    if (stage > 1) {
      // localStorage (instant fallback)
      savePipelineToStorage(stage, state, { heroType, heroSource, sectionSource, uploadedImages });
      // Pipeline DB (async, silent) — save the PREVIOUS stage's data since we just transitioned
      if (state.pipelineId && stage > 1) {
        const prevStage = stage - 1;
        const prevData = getStageUpdateData(prevStage, state, { heroType, heroSource, sectionSource });
        updatePipeline(state.pipelineId, stage, prevData);
      }
    }
  }, [stage]);

  // ========== AUTO-SAVE ON PAGE EXIT ==========
  useEffect(() => {
    const handleBeforeUnload = () => {
      // Always save localStorage (instant)
      savePipelineToStorage(stage, state, { heroType, heroSource, sectionSource, uploadedImages });
      // Use sendBeacon to save pipeline if we have one
      if (state.pipelineId && stage > 1) {
        const stageData = getStageUpdateData(stage, state, { heroType, heroSource, sectionSource });
        const payload = JSON.stringify({
          pipelineId: state.pipelineId,
          stage,
          data: stageData,
        });
        navigator.sendBeacon('/api/content-pipeline/update', new Blob([payload], { type: 'application/json' }));
      }
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [stage, state, heroType, heroSource, sectionSource, uploadedImages]);

  const stages = [
    { num: 1, icon: Mic, label: 'Brief' },
    { num: 2, icon: Search, label: 'Research' },
    { num: 3, icon: FileText, label: 'Plan' },
    { num: 4, icon: Pencil, label: 'Write' },
    { num: 5, icon: Bot, label: 'Humanize' },
    { num: 6, icon: Sparkles, label: 'SEO' },
    { num: 7, icon: Globe, label: 'Meta' },
    { num: 8, icon: ImageIcon, label: 'Media' },
    { num: 9, icon: CheckCircle, label: 'Publish' },
  ];

  // ========== STAGE 1: AI Fix Brief ==========
  const fixBrief = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/insights/pipeline/fix-brief', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ brief: state.transcript })
      });
      const result = await res.json();
      if (result.success) {
        setAiCorrections(result.corrections || []);
        if (!result.corrections?.length) { update({ briefConfirmed: true }); toast({ title: '✅ Brief looks good!' }); }
        else { toast({ title: '🔍 Found suggestions', description: `${result.corrections.length} items` }); }
      }
    } catch (err: any) { toast({ title: 'Error', description: err.message, variant: 'destructive' }); }
    finally { setLoading(false); }
  };

  const applyCorrection = (c: any) => {
    update({ transcript: state.transcript.replace(c.original, c.suggested) });
    setAiCorrections(prev => prev.filter(x => x.original !== c.original));
  };

  // ========== STAGE 1: Generate Ideas (Grok 4.1) ==========
  const generateIdeas = async () => {
    setLoading(true);
    try {
      const inputPayload = {
        voiceTranscript: state.transcript,
        silo: state.selectedSilo,
        topic: state.customTopic,
        isPillar: state.isSiloPage || false,
      };
      const res = await fetch('/api/insights/pipeline/ideas', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(inputPayload)
      });
      const result = await res.json();
      if (result.success && result.ideas) {
        setIdeas(result.ideas);
        setStageOutputs(prev => ({ ...prev, ideas: { input: inputPayload, output: result.ideas, model: 'Grok 4.1' } }));
        toast({ title: '✨ Ideas ready!', description: `${result.ideas.length} ideas from Grok 4.1` });
      } else { toast({ title: 'Error', description: result.error, variant: 'destructive' }); }
    } catch (err: any) { toast({ title: 'Error', description: err.message, variant: 'destructive' }); }
    finally { setLoading(false); }
  };

  // ========== STAGE 2: Research (Perplexity + Serper) ==========
  const runResearch = async () => {
    setLoading(true);
    try {
      const inputPayload = {
        topic: state.selectedIdea?.title || state.customTopic,
        focusKeyword: state.selectedIdea?.keywords?.[0] || state.selectedIdea?.title,
        siloTopic: state.selectedSilo || undefined,
        originalBrief: state.transcript || undefined,
        selectedIdea: state.selectedIdea || undefined,
        isPillar: state.isSiloPage || false,
        includeSerper: true,
      };
      const res = await fetch('/api/insights/pipeline/research', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(inputPayload)
      });
      const result = await res.json();
      if (result.success) {
        update({ researchData: result });
        setStageOutputs(prev => ({ ...prev, research: { input: inputPayload, output: result, model: 'Perplexity + Serper' } }));
        toast({ title: '🔍 Research complete!' });
      } else { toast({ title: 'Error', description: result.error, variant: 'destructive' }); }
    } catch (err: any) { toast({ title: 'Error', description: err.message, variant: 'destructive' }); }
    finally { setLoading(false); }
  };

  // ========== STAGE 3: Generate Plan ==========
  const generatePlan = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/insights/pipeline/generate-plan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          articleTemplate: {
            title: state.selectedIdea?.title || state.customTopic,
            slug: (state.selectedIdea?.title || state.customTopic || 'article').toLowerCase().replace(/[^a-z0-9]+/g, '-'),
            focusKeyword: state.selectedIdea?.keywords?.[0] || state.selectedIdea?.title,
            h2Headlines: state.selectedIdea?.sections || [],
          },
          research: state.researchData,
          originalBrief: state.transcript,
          selectedIdea: state.selectedIdea,
          siloTopic: state.selectedSilo,
          isPillar: state.isSiloPage,
          insightId: state.insightId,
          wordCountTarget: state.isSiloPage ? 3500 : 2000,
        })
      });
      const result = await res.json();
      if (result.success) {
        update({ plan: result.plan, insightId: result.insightId });
        toast({ title: '📋 Plan generated!' });
      } else { toast({ title: 'Error', description: result.error, variant: 'destructive' }); }
    } catch (err: any) { toast({ title: 'Error', description: err.message, variant: 'destructive' }); }
    finally { setLoading(false); }
  };

  // ========== STAGE 4: Write Article (Claude Sonnet 4) — SSE Streaming ==========
  const [writeProgress, setWriteProgress] = useState(0);
  const [writeStatus, setWriteStatus] = useState('');
  const [writeWordEstimate, setWriteWordEstimate] = useState(0);

  const writeArticle = async () => {
    setLoading(true);
    setWriteProgress(0);
    setWriteStatus('Starting...');
    setWriteWordEstimate(0);
    try {
      const inputPayload = { plan: state.plan, research: state.researchData, idea: state.selectedIdea, isPillar: state.isSiloPage, originalBrief: state.transcript, siloTopic: state.selectedSilo };
      const res = await fetch('/api/insights/pipeline/write-article', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(inputPayload)
      });

      if (!res.ok) throw new Error(`Server error: ${res.status}`);

      // Read SSE stream with real-time progress
      const reader = res.body!.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      let result: any = null;

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const chunks = buffer.split('\n\n');
        buffer = chunks.pop() || '';
        for (const chunk of chunks) {
          if (!chunk.trim()) continue;
          const lines = chunk.split('\n');
          const eventType = lines.find(l => l.startsWith('event: '))?.slice(7)?.trim();
          const dataStr = lines.find(l => l.startsWith('data: '))?.slice(6);
          if (!eventType || !dataStr) continue;
          try {
            const data = JSON.parse(dataStr);
            switch (eventType) {
              case 'progress':
                setWriteProgress(data.percent || 0);
                setWriteStatus(data.message || '');
                break;
              case 'token':
                setWriteProgress(data.percent || 50);
                setWriteWordEstimate(Math.round((data.length || 0) / 7));
                setWriteStatus(`Writing... ~${Math.round((data.length || 0) / 7)} words`);
                break;
              case 'complete':
                result = data;
                setWriteProgress(100);
                setWriteStatus('Complete!');
                break;
              case 'error':
                throw new Error(data.error || 'Writing failed');
            }
          } catch (e: any) { if (e.message && eventType === 'error') throw e; }
        }
      }

      if (result?.success) {
        update({ article: result.article, wordCount: result.wordCount });
        setStageOutputs(prev => ({ ...prev, write: { input: { title: state.plan?.title, sections: state.plan?.structure?.sections?.length }, output: { wordCount: result.wordCount, sections: (result.article.match(/^## /gm) || []).length }, model: 'Claude Sonnet 4' } }));
        toast({ title: '✍️ Article written!', description: `${result.wordCount} words by Claude Sonnet 4` });
      } else { toast({ title: 'Error', description: result?.error || 'Writing failed', variant: 'destructive' }); }
    } catch (err: any) { toast({ title: 'Error', description: err.message, variant: 'destructive' }); }
    finally { setLoading(false); setWriteProgress(0); setWriteStatus(''); setWriteWordEstimate(0); }
  };

  // ========== STAGE 5: Humanize (Grok 4.1 Fast) ==========
  const humanizeArticle = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/insights/pipeline/humanize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ article: state.article, isPillar: state.isSiloPage, originalBrief: state.transcript })
      });
      const result = await res.json();
      if (result.success) {
        update({ 
          humanizedArticle: result.humanizedArticle, 
          humanScore: result.humanScore,
          humanizeChanges: result.changes,
        });
        setStageOutputs(prev => ({ ...prev, humanize: { input: { wordCount: state.wordCount }, output: { humanScore: result.humanScore, changes: result.changes }, model: 'Grok 4.1 Fast' } }));
        toast({ title: '🤖 Humanized!', description: `Human score: ${result.humanScore}% via Grok 4.1 Fast` });
      } else { toast({ title: 'Error', description: result.error, variant: 'destructive' }); }
    } catch (err: any) { toast({ title: 'Error', description: err.message, variant: 'destructive' }); }
    finally { setLoading(false); }
  };

  // ========== STAGE 6: SEO Optimize (Claude + OpenAI) ==========
  const seoOptimize = async () => {
    setLoading(true);
    try {
      const inputPayload = {
        article: state.humanizedArticle || state.article,
        title: state.plan?.title || state.selectedIdea?.title,
        keywords: state.selectedIdea?.keywords,
        research: state.researchData,
        isPillar: state.isSiloPage,
        siloTopic: state.selectedSilo,
        originalBrief: state.transcript,
        plan: state.plan,
      };
      const res = await fetch('/api/insights/pipeline/seo-optimize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(inputPayload)
      });
      const result = await res.json();
      if (result.success) {
        update({ 
          seoArticle: result.optimizedArticle, 
          seoStats: result.seoStats,
          seoChanges: result.changes,
          seoSummary: result.summary,
        });
        setStageOutputs(prev => ({ ...prev, seo: { input: { title: inputPayload.title, keywords: inputPayload.keywords }, output: { rankMath: result.seoStats?.estimatedRankMathScore, changes: result.changes, summary: result.summary }, model: 'Claude + OpenAI' } }));
        toast({ title: '🚀 SEO optimized!', description: `Rank Math: ~${result.seoStats?.estimatedRankMathScore || '?'}/100` });
      } else { toast({ title: 'Error', description: result.error, variant: 'destructive' }); }
    } catch (err: any) { toast({ title: 'Error', description: err.message, variant: 'destructive' }); }
    finally { setLoading(false); }
  };

  // ========== STAGE 7: Generate Meta + Images (silo-aware, GPT-4o + Imagen) ==========
  const generateMeta = async () => {
    setLoading(true);
    try {
      const siloData = BPO_SILOS.find(s => s.id === state.selectedSilo);
      const inputPayload = {
        article: state.seoArticle || state.humanizedArticle || state.article,
        title: state.plan?.title || state.selectedIdea?.title,
        keywords: state.selectedIdea?.keywords,
        silo: state.selectedSilo,
        isSiloPage: state.isSiloPage,
        siloSlug: state.isSiloPage && siloData ? siloData.slug : undefined,
      };
      const res = await fetch('/api/insights/pipeline/generate-meta', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(inputPayload)
      });
      const result = await res.json();
      if (result.success) {
        // Handle both old format (result.meta + result.images) and new format (result.meta only)
        const metaData = result.meta || {};
        // Merge silo info from response
        if (result.isSiloPage) metaData.isSiloPage = true;
        if (result.siloSlug) metaData.canonicalSlug = result.siloSlug;
        // Schema comes separately in rebuilt version
        if (result.schema) metaData.schema = result.schema;
        // Store schema summary for UI display
        if (result.schemaSummary) metaData.schemaSummary = result.schemaSummary;
        
        update({ 
          meta: metaData, 
          images: result.images || [],
          imagePrompts: result.imagePrompts || [],
          metaSummary: result.summary || null,
        });
        setStageOutputs(prev => ({ ...prev, meta: { input: { title: inputPayload.title, silo: inputPayload.silo, isSiloPage: inputPayload.isSiloPage }, output: { slug: metaData.canonicalSlug, focusKeyword: metaData.focusKeyword, semanticKeywords: metaData.semanticKeywords, clusterKeywords: metaData.clusterKeywords, isSiloPage: metaData.isSiloPage, warnings: result.validation?.warnings, schemaSummary: result.schemaSummary }, model: 'GPT-4o' } }));
        toast({ title: '📊 Meta ready!', description: result.images?.length ? `${result.images.length} images generated` : 'Metadata generated via GPT-4o' });
      } else { toast({ title: 'Error', description: result.error, variant: 'destructive' }); }
    } catch (err: any) { toast({ title: 'Error', description: err.message, variant: 'destructive' }); }
    finally { setLoading(false); }
  };

  // ========== HELPER: SAVE PIPELINE PROGRESS ==========
  const savePipelineProgress = async (pipelineId: string, stageNum: number, data: Record<string, any>, aiLog?: any): Promise<boolean> => {
    try {
      const res = await fetch('/api/content-pipeline/update', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pipelineId, stage: stageNum, data, aiLog })
      });
      const result = await res.json();
      if (!result.success) {
        console.error('Failed to save pipeline progress:', result.error);
      }
      return result.success;
    } catch (err) {
      console.error('Error saving pipeline:', err);
      return false;
    }
  };

  // ========== HELPER: SAVE TO INSIGHTS_POSTS ==========
  const saveProgress = async (insightId: string, updates: Record<string, any>, pipelineStage: string) => {
    try {
      const res = await fetch('/api/insights/pipeline/save-progress', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ insightId, updates, pipelineStage })
      });
      const result = await res.json();
      return result;
    } catch (err) {
      console.error('Error saving progress:', err);
      return { success: false };
    }
  };

  // ========== STAGE 9: Publish ==========
  const publishArticle = async (isDraft: boolean) => {
    setLoading(true);
    try {
      if (state.pipelineId) {
        // Save Stage 8 media data first, then publish via pipeline
        await updatePipeline(state.pipelineId, 8, {
          heroSource: heroSource,
          sectionSource: sectionSource,
          videoUrl: state.videoUrl || uploadedImages.hero,
          heroType: heroType,
          images: state.images,
          contentSections: state.contentSections,
        });

        // Use pipeline publish route
        const res = await fetch('/api/content-pipeline/publish', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            pipelineId: state.pipelineId,
            isDraft,
            sectionImages: [
              uploadedImages.section1 ? { url: uploadedImages.section1, alt: 'Section 1', position: 'section1' } : null,
              uploadedImages.section2 ? { url: uploadedImages.section2, alt: 'Section 2', position: 'section2' } : null,
              uploadedImages.section3 ? { url: uploadedImages.section3, alt: 'Section 3', position: 'section3' } : null,
            ].filter(Boolean),
            uploadedSectionUrls: [uploadedImages.section1, uploadedImages.section2, uploadedImages.section3].filter(Boolean),
            contentSections: state.contentSections.length === 3 ? state.contentSections : undefined,
            coverImageAlt: state.meta?.ogTitle || state.plan?.title || '',
            isPillar: state.isSiloPage,
            heroUrl: state.videoUrl || uploadedImages.hero || undefined,
          })
        });
        const result = await res.json();
        if (result.success) {
          // Mark pipeline as completed
          if (!isDraft) {
            await updatePipeline(state.pipelineId, 9, { markComplete: true });
          }
          clearPipelineStorage();
          toast({ title: isDraft ? '📝 Saved as draft!' : '🎉 Published!' });
          router.push(isDraft ? '/insights' : (result.article?.url || `/insights/${result.article?.slug}`));
        } else { toast({ title: 'Error', description: result.error, variant: 'destructive' }); }
      } else {
        // Fallback: publish via old route if no pipeline (shouldn't happen normally)
        const finalContent = state.seoArticle || state.humanizedArticle || state.article;
        const siloData = BPO_SILOS.find(s => s.id === state.selectedSilo);
        // @ts-ignore — fallback publish route
        const res = await fetch('/api/insights/pipeline/publish', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            title: state.plan?.title || state.selectedIdea?.title,
            content: finalContent,
            contentSections: state.contentSections.length === 3 ? state.contentSections : undefined,
            slug: state.meta?.canonicalSlug,
            silo: state.selectedSilo,
            keywords: state.selectedIdea?.keywords,
            meta: state.meta,
            images: state.images,
            heroType: heroType,
            uploadedHeroUrl: uploadedImages.hero || undefined,
            uploadedSectionUrls: [uploadedImages.section1, uploadedImages.section2, uploadedImages.section3].filter(Boolean),
            sectionImages: [
              uploadedImages.section1 ? { url: uploadedImages.section1, alt: 'Section 1', position: 'section1' } : null,
              uploadedImages.section2 ? { url: uploadedImages.section2, alt: 'Section 2', position: 'section2' } : null,
              uploadedImages.section3 ? { url: uploadedImages.section3, alt: 'Section 3', position: 'section3' } : null,
            ].filter(Boolean),
            coverImageAlt: state.meta?.ogTitle || state.plan?.title || '',
            isDraft,
            isPillar: state.isSiloPage,
          })
        });
        const result = await res.json();
        if (result.success) {
          clearPipelineStorage();
          toast({ title: isDraft ? '📝 Saved as draft!' : '🎉 Published!' });
          // Pillar pages redirect to /insights/{silo-slug}, supporting to /insights/{silo-slug}/{article-slug}
          const fallbackUrl = state.isSiloPage && siloData 
            ? `/insights/${siloData.slug}` 
            : siloData 
              ? `/insights/${siloData.slug}/${result.article?.slug}` 
              : `/insights/${result.article?.slug}`;
          router.push(isDraft ? '/insights' : (result.article?.url || fallbackUrl));
        } else { toast({ title: 'Error', description: result.error, variant: 'destructive' }); }
      }
    } catch (err: any) { toast({ title: 'Error', description: err.message, variant: 'destructive' }); }
    finally { setLoading(false); }
  };

  // ========== SAVE DRAFT ==========
  const saveDraft = async () => {
    // Save to localStorage immediately
    savePipelineToStorage(stage, state, { heroType, heroSource, sectionSource, uploadedImages });
    // Save to pipeline if we have one
    if (state.pipelineId) {
      const stageData = getStageUpdateData(stage, state, { heroType, heroSource, sectionSource });
      await updatePipeline(state.pipelineId, stage, stageData, false);
    } else {
      toast({ title: '💾 Saved locally', description: 'Progress saved to browser' });
    }
  };

  // ========== RENDER ==========
  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-purple-900/20 to-gray-900 p-4 md:p-6">
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Header */}
        <div className="text-center">
          <h1 className="text-3xl md:text-4xl font-bold bg-gradient-to-r from-purple-400 via-pink-400 to-cyan-400 bg-clip-text text-transparent">AI Content Pipeline</h1>
          <div className="flex items-center justify-center gap-3 mt-1">
            <p className="text-gray-400">Stage {stage} of 9</p>
            {stage > 1 && (
              <button 
                onClick={() => { clearPipelineStorage(); setState(initialState); setStage(1); setIdeas([]); setUploadedImages({}); setHeroSource(null); setSectionSource(null); window.history.replaceState({}, '', window.location.pathname); toast({ title: '🔄 Fresh start' }); }}
                className="text-xs text-gray-500 hover:text-red-400 underline transition-colors"
              >
                Start Fresh
              </button>
            )}
          </div>
        </div>

        {/* Progress Bar */}
        <div className="flex justify-between items-center">
          {stages.map(s => {
            const Icon = s.icon;
            const isActive = stage === s.num;
            const isComplete = stage > s.num;
            return (
              <button key={s.num} onClick={() => s.num < stage && setStage(s.num)} disabled={s.num > stage} className="flex flex-col items-center group">
                <div className={`w-10 h-10 md:w-12 md:h-12 rounded-full flex items-center justify-center transition-all ${isActive ? 'bg-purple-500 scale-110 ring-4 ring-purple-500/30' : isComplete ? 'bg-green-500' : 'bg-gray-700'}`}>
                  {isComplete ? <CheckCircle className="w-5 h-5 text-white" /> : <Icon className="w-5 h-5 text-white" />}
                </div>
                <span className={`text-xs mt-1 hidden md:block ${isActive ? 'text-white font-semibold' : 'text-gray-500'}`}>{s.label}</span>
              </button>
            );
          })}
        </div>

        {/* ============ STAGE 1: BRIEF ============ */}
        {stage === 1 && (
          <div className="space-y-6">
            {/* Resume Existing Drafts */}
            {existingDrafts.length > 0 && !state.briefConfirmed && (
              <Card className="bg-amber-500/10 border-amber-500/20">
                <CardContent className="pt-4">
                  <p className="text-amber-400 font-semibold text-sm mb-3 flex items-center gap-2">
                    <RefreshCw className="w-4 h-4" /> Resume a Pipeline
                  </p>
                  <div className="space-y-2">
                    {existingDrafts.map((pipeline: any) => {
                      const title = pipeline.title || 'Untitled';
                      const stageLabel = pipeline.stageLabel || stages.find(s => s.num === pipeline.currentStage)?.label || `Stage ${pipeline.currentStage}`;
                      const updatedAt = new Date(pipeline.updatedAt).toLocaleString();
                      return (
                        <button
                          key={pipeline.id}
                          onClick={() => loadPipelineFromServer(pipeline.id)}
                          className="w-full text-left bg-white/5 hover:bg-white/10 rounded-lg p-3 border border-white/10 hover:border-amber-500/30 transition-all"
                        >
                          <div className="flex items-center justify-between">
                            <div>
                              <p className="text-white text-sm font-medium truncate">{title}</p>
                              <p className="text-gray-500 text-xs mt-0.5">{updatedAt}</p>
                            </div>
                            <Badge className="bg-amber-500/20 text-amber-400 text-xs">{stageLabel}</Badge>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Brief Input: Voice OR Text */}
            {!state.transcript && (
              <Card className="bg-white/5 border-white/10">
                <CardContent className="pt-4 space-y-4">
                  <div className="flex gap-2 mb-3">
                    <button
                      onClick={() => setBriefMode('voice')}
                      className={`flex-1 py-3 px-4 rounded-lg text-sm font-semibold transition-all flex items-center justify-center gap-2 ${briefMode === 'voice' ? 'bg-purple-500/20 border-2 border-purple-500 text-purple-300' : 'bg-white/5 border-2 border-white/10 text-gray-400 hover:border-white/30'}`}
                    >
                      <Mic className="w-4 h-4" /> Record Brief
                    </button>
                    <button
                      onClick={() => setBriefMode('text')}
                      className={`flex-1 py-3 px-4 rounded-lg text-sm font-semibold transition-all flex items-center justify-center gap-2 ${briefMode === 'text' ? 'bg-cyan-500/20 border-2 border-cyan-500 text-cyan-300' : 'bg-white/5 border-2 border-white/10 text-gray-400 hover:border-white/30'}`}
                    >
                      <FileText className="w-4 h-4" /> Paste / Type Brief
                    </button>
                  </div>
                  {briefMode === 'voice' ? (
                    <VoiceRecorder onTranscript={(text) => update({ transcript: text, briefConfirmed: false })} />
                  ) : (
                    <div className="space-y-3">
                      <Textarea
                        value={textBrief}
                        onChange={(e) => setTextBrief(e.target.value)}
                        placeholder="Paste your brief here, or type what the article should cover..."
                        className="min-h-[150px] bg-white/5 border-white/20 text-white placeholder:text-gray-500"
                      />
                      {textBrief.trim() && (
                        <Button
                          onClick={() => update({ transcript: textBrief.trim(), briefConfirmed: false })}
                          className="w-full h-12 bg-cyan-600 hover:bg-cyan-700"
                        >
                          <Check className="w-4 h-4 mr-2" /> Use This Brief
                        </Button>
                      )}
                    </div>
                  )}
                </CardContent>
              </Card>
            )}
            {state.transcript && <VoiceRecorder onTranscript={(text) => update({ transcript: text, briefConfirmed: false })} />}

            {state.transcript && (
              <Card className={`${state.briefConfirmed ? 'bg-green-500/10 border-green-500/30' : 'bg-yellow-500/10 border-yellow-500/30'}`}>
                <CardContent className="pt-4 space-y-4">
                  <div className="flex items-center justify-between">
                    <p className={`text-sm font-semibold ${state.briefConfirmed ? 'text-green-400' : 'text-yellow-400'}`}>
                      {state.briefConfirmed ? '✅ Brief Confirmed' : '📝 Review Your Brief'}
                    </p>
                    <div className="flex gap-2">
                      <Button size="sm" variant="outline" onClick={() => { setIsEditingBrief(true); setEditedBrief(state.transcript); }} className="h-8">
                        <Edit3 className="w-4 h-4 mr-1" /> Edit
                      </Button>
                      {!state.briefConfirmed && (
                        <Button size="sm" onClick={fixBrief} disabled={loading} className="h-8 bg-purple-600">
                          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <><Wand2 className="w-4 h-4 mr-1" /> AI Fix</>}
                        </Button>
                      )}
                    </div>
                  </div>

                  {isEditingBrief ? (
                    <div className="space-y-2">
                      <Textarea value={editedBrief} onChange={(e) => setEditedBrief(e.target.value)} className="min-h-[100px] bg-white/5 border-white/20 text-white" />
                      <div className="flex gap-2">
                        <Button size="sm" onClick={() => { update({ transcript: editedBrief, briefConfirmed: false }); setIsEditingBrief(false); }} className="bg-green-600">
                          <Check className="w-4 h-4 mr-1" /> Save
                        </Button>
                        <Button size="sm" variant="outline" onClick={() => setIsEditingBrief(false)}><X className="w-4 h-4 mr-1" /> Cancel</Button>
                      </div>
                    </div>
                  ) : (
                    <p className="text-white leading-relaxed">{state.transcript}</p>
                  )}

                  {aiCorrections.length > 0 && (
                    <div className="space-y-2 border-t border-white/10 pt-3">
                      <p className="text-orange-400 text-sm font-semibold"><AlertTriangle className="w-4 h-4 inline mr-1" /> Suggestions:</p>
                      {aiCorrections.map((c, i) => (
                        <div key={i} className="bg-white/5 rounded-lg p-3 flex items-center justify-between">
                          <div>
                            <span className="text-red-400 line-through">{c.original}</span>
                            <span className="text-gray-400 mx-2">→</span>
                            <span className="text-green-400">{c.suggested}</span>
                          </div>
                          <div className="flex gap-1">
                            <Button size="sm" variant="ghost" onClick={() => applyCorrection(c)} className="h-7 w-7 p-0 text-green-400"><Check className="w-4 h-4" /></Button>
                            <Button size="sm" variant="ghost" onClick={() => setAiCorrections(prev => prev.filter(x => x.original !== c.original))} className="h-7 w-7 p-0 text-red-400"><X className="w-4 h-4" /></Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {!state.briefConfirmed && aiCorrections.length === 0 && !isEditingBrief && (
                    <Button onClick={() => update({ briefConfirmed: true })} className="w-full bg-green-600"><Check className="w-4 h-4 mr-2" /> Confirm Brief</Button>
                  )}
                </CardContent>
              </Card>
            )}

            <div>
              <h3 className="text-lg font-bold text-white mb-3">Select Content Silo</h3>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                {BPO_SILOS.map(silo => (
                  <button key={silo.id} onClick={() => update({ selectedSilo: silo.id })}
                    className={`p-3 rounded-xl text-left transition-all ${state.selectedSilo === silo.id ? 'bg-cyan-500/20 border-2 border-cyan-500' : 'bg-white/5 border-2 border-white/10 hover:border-white/30'}`}>
                    <p className="font-bold text-white text-sm">{silo.name}</p>
                    <p className="text-xs text-gray-400 mt-1">{silo.description}</p>
                  </button>
                ))}
              </div>
            </div>

            {/* Silo Page Toggle */}
            {state.selectedSilo && (
              <div className="p-4 bg-purple-500/10 border border-purple-500/20 rounded-xl">
                <label className="flex items-center gap-3 cursor-pointer">
                  <input 
                    type="checkbox" 
                    checked={state.isSiloPage}
                    onChange={(e) => {
                      update({ isSiloPage: e.target.checked, isPillar: e.target.checked });
                      // Persist to pipeline immediately if one exists
                      if (state.pipelineId) {
                        updatePipeline(state.pipelineId, 1, { isSiloPage: e.target.checked });
                      }
                    }}
                    className="w-5 h-5 rounded bg-gray-700 border-gray-600 text-purple-500 focus:ring-purple-500"
                  />
                  <div>
                    <p className="font-bold text-white text-sm">📌 This IS the Silo Page (Pillar)</p>
                    <p className="text-xs text-gray-400">
                      Canonical URL will be: /insights/{BPO_SILOS.find(s => s.id === state.selectedSilo)?.slug}
                    </p>
                  </div>
                </label>
              </div>
            )}

            <Input value={state.customTopic} onChange={e => update({ customTopic: e.target.value })} placeholder="Or type a custom topic..." className="bg-white/5 border-white/10 h-12 text-white" />

            <div className="flex gap-3">
              <Button onClick={generateIdeas} disabled={loading || (!state.briefConfirmed && !state.customTopic && !state.selectedSilo)} className="flex-1 h-12 bg-gradient-to-r from-purple-500 to-pink-500">
                {loading ? <><Loader2 className="w-5 h-5 animate-spin mr-2" /> Grok 4.1 generating ideas ({elapsedTime})...</> : <><Sparkles className="w-5 h-5 mr-2" /> Generate Ideas (Grok 4.1)</>}
              </Button>
              <Button onClick={saveDraft} variant="outline" className="h-12"><Save className="w-5 h-5" /></Button>
            </div>

            {ideas.length > 0 && (
              <div className="space-y-2">
                <h3 className="text-lg font-bold text-white">Select an Idea:</h3>
                {ideas.map((idea, i) => (
                  <button key={i} onClick={async () => {
                    const updatedState = { ...state, selectedIdea: idea };
                    update({ selectedIdea: idea });
                    // Create pipeline if we don't have one yet
                    if (!state.pipelineId) {
                      const newPipelineId = await createPipeline(updatedState);
                      if (newPipelineId) {
                        update({ pipelineId: newPipelineId });
                        window.history.replaceState({}, '', `?pipeline=${newPipelineId}`);
                        // Save Stage 1 data to the new pipeline
                        await updatePipeline(newPipelineId, 1, {
                          transcript: state.transcript,
                          selectedSilo: state.selectedSilo,
                          selectedSiloId: state.selectedSiloId,
                          generatedIdeas: ideas,
                          selectedIdea: idea,
                          briefType: briefMode,
                        });
                      }
                    } else {
                      // Pipeline exists, save ideas + selected idea
                      await updatePipeline(state.pipelineId, 1, {
                        generatedIdeas: ideas,
                        selectedIdea: idea,
                      });
                    }
                    setStage(2);
                  }}
                    className="w-full p-4 bg-white/5 border border-white/10 rounded-xl text-left hover:bg-cyan-500/10 hover:border-cyan-500/50 transition-all">
                    <div className="flex justify-between items-center">
                      <h4 className="font-bold text-white">{idea.title}</h4>
                      <ChevronRight className="w-5 h-5 text-gray-500" />
                    </div>
                    <p className="text-gray-400 text-sm mt-1">{idea.description}</p>
                    {idea.keywords && (
                      <div className="flex flex-wrap gap-1 mt-2">
                        {idea.keywords.slice(0, 5).map((kw: string, ki: number) => (
                          <Badge key={ki} variant="outline" className="text-[10px] border-cyan-500/30 text-cyan-400">{kw}</Badge>
                        ))}
                      </div>
                    )}
                    {idea.subTopics && idea.subTopics.length > 0 && (
                      <div className="mt-2 pt-2 border-t border-white/5">
                        <p className="text-[10px] text-purple-400 mb-1">📌 Sub-articles that flow from this pillar:</p>
                        <div className="flex flex-wrap gap-1">
                          {idea.subTopics.slice(0, 5).map((sub: string, si: number) => (
                            <span key={si} className="text-[10px] px-1.5 py-0.5 bg-purple-500/10 text-purple-300 rounded">↳ {sub}</span>
                          ))}
                          {idea.subTopics.length > 5 && <span className="text-[10px] text-purple-500">+{idea.subTopics.length - 5} more</span>}
                        </div>
                      </div>
                    )}
                    {idea.linksTo && (
                      <p className="text-[10px] text-blue-400 mt-1">🔗 Links to: {idea.linksTo}</p>
                    )}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ============ STAGE 2: RESEARCH ============ */}
        {stage === 2 && (
          <Card className="bg-blue-500/10 border-blue-500/20">
            <CardHeader>
              <CardTitle className="text-blue-400 flex items-center gap-2"><Search className="w-6 h-6" /> Stage 2: Research</CardTitle>
              <CardDescription>Perplexity AI deep research + Google Serper competitor analysis</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="bg-white/5 rounded-lg p-4">
                <p className="text-gray-400 text-sm">Article Topic:</p>
                <p className="text-white font-semibold">{state.selectedIdea?.title || state.customTopic}</p>
              </div>

              {!state.researchData ? (
                loading ? (
                  <StepPreloader
                    icon="🔍"
                    title="Researching (Perplexity + Serper)..."
                    description="Perplexity AI finding unique angles + Serper searching Google for competitor analysis and People Also Ask data."
                    elapsed={elapsedTime}
                    warning="This usually takes 15-30 seconds"
                  />
                ) : (
                  <Button onClick={runResearch} disabled={loading} className="w-full h-14 bg-blue-600 hover:bg-blue-700 text-lg">
                    <Search className="w-5 h-5 mr-2" /> Start Research
                  </Button>
                )
              ) : (() => {
                const rd = state.researchData?.research || state.researchData;
                const perp = rd?.perplexity;
                const serp = rd?.serper;
                const validated = rd?.validatedLinks;
                const competitors = serp?.competitors || [];
                const paa = serp?.peopleAlsoAsk || [];
                const highDA = serp?.highDALinks || validated?.validLinks || [];
                const social = serp?.socialLinks || [];
                
                return (
                <div className="space-y-4">
                  {/* Stats bar */}
                  <div className="grid grid-cols-4 gap-2 text-sm">
                    <div className="bg-white/5 rounded-lg p-3 text-center">
                      <p className="text-gray-400 text-xs">Competitors</p>
                      <p className="text-white font-bold text-lg">{competitors.length}</p>
                    </div>
                    <div className="bg-white/5 rounded-lg p-3 text-center">
                      <p className="text-gray-400 text-xs">Perplexity</p>
                      <p className="text-white font-bold text-lg">{perp?.insights ? '✅' : '—'}</p>
                    </div>
                    <div className="bg-white/5 rounded-lg p-3 text-center">
                      <p className="text-gray-400 text-xs">High DA Links</p>
                      <p className="text-white font-bold text-lg">{highDA.length}</p>
                    </div>
                    <div className="bg-white/5 rounded-lg p-3 text-center">
                      <p className="text-gray-400 text-xs">PAA Questions</p>
                      <p className="text-white font-bold text-lg">{paa.length}</p>
                    </div>
                  </div>

                  {/* Perplexity Insights */}
                  {perp?.insights && (
                    <div className="bg-purple-500/10 border border-purple-500/20 rounded-xl p-4">
                      <p className="text-purple-400 font-semibold text-sm mb-2">🧠 Perplexity AI Insights</p>
                      <div className="text-gray-300 text-sm whitespace-pre-wrap max-h-[300px] overflow-y-auto leading-relaxed">
                        {typeof perp.insights === 'string' ? perp.insights : JSON.stringify(perp.insights, null, 2)}
                      </div>
                      {perp.citations && perp.citations.length > 0 && (
                        <div className="mt-3 pt-2 border-t border-purple-500/20">
                          <p className="text-xs text-purple-400 mb-1">Sources ({perp.citations.length}):</p>
                          <div className="flex flex-wrap gap-1">
                            {perp.citations.slice(0, 6).map((c: string, i: number) => (
                              <a key={i} href={c} target="_blank" rel="noopener" className="text-[10px] px-2 py-0.5 bg-purple-500/10 text-purple-300 rounded hover:bg-purple-500/20 truncate max-w-[200px]">
                                {new URL(c).hostname.replace('www.', '')}
                              </a>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Top Competitors */}
                  {competitors.length > 0 && (
                    <div className="bg-blue-500/10 border border-blue-500/20 rounded-xl p-4">
                      <p className="text-blue-400 font-semibold text-sm mb-2">🔍 Top Competitors ({competitors.length})</p>
                      <div className="space-y-2 max-h-[250px] overflow-y-auto">
                        {competitors.slice(0, 8).map((c: any, i: number) => (
                          <div key={i} className="flex items-start gap-2 bg-white/5 rounded-lg p-2">
                            <span className="text-blue-400 text-xs font-mono mt-0.5">#{i+1}</span>
                            <div className="flex-1 min-w-0">
                              <a href={c.link || c.url} target="_blank" rel="noopener" className="text-white text-sm font-medium hover:text-blue-400 transition-colors block truncate">
                                {c.title}
                              </a>
                              <p className="text-gray-500 text-xs truncate">{c.link || c.url}</p>
                              {c.snippet && <p className="text-gray-400 text-xs mt-1 line-clamp-2">{c.snippet}</p>}
                            </div>
                            {c.da && <span className="text-xs bg-blue-500/20 text-blue-300 px-1.5 py-0.5 rounded">DA {c.da}</span>}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* People Also Ask */}
                  {paa.length > 0 && (
                    <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-4">
                      <p className="text-amber-400 font-semibold text-sm mb-2">❓ People Also Ask ({paa.length})</p>
                      <div className="space-y-1">
                        {paa.map((q: any, i: number) => (
                          <div key={i} className="flex items-center gap-2 text-sm">
                            <span className="text-amber-500">→</span>
                            <span className="text-gray-300">{q.question || q}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* High DA Links */}
                  {highDA.length > 0 && (
                    <div className="bg-green-500/10 border border-green-500/20 rounded-xl p-4">
                      <p className="text-green-400 font-semibold text-sm mb-2">🔗 High Authority Links ({highDA.length})</p>
                      <div className="space-y-1">
                        {highDA.slice(0, 5).map((l: any, i: number) => (
                          <div key={i} className="flex items-center gap-2 text-sm">
                            <a href={l.link || l.url} target="_blank" rel="noopener" className="text-green-300 hover:text-green-200 truncate flex-1">
                              {l.title || new URL(l.link || l.url).hostname}
                            </a>
                            {l.da && <span className="text-xs bg-green-500/20 text-green-300 px-1.5 py-0.5 rounded">DA {l.da}</span>}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Social/Cultural */}
                  {social.length > 0 && (
                    <div className="bg-pink-500/10 border border-pink-500/20 rounded-xl p-4">
                      <p className="text-pink-400 font-semibold text-sm mb-2">💬 Social & Cultural ({social.length})</p>
                      <div className="space-y-1">
                        {social.slice(0, 5).map((s: any, i: number) => (
                          <a key={i} href={s.link || s.url} target="_blank" rel="noopener" className="flex items-center gap-2 text-sm text-pink-300 hover:text-pink-200">
                            <span>↗</span> {s.title || s.link}
                          </a>
                        ))}
                      </div>
                    </div>
                  )}

                  <Button onClick={async () => {
                    // Save research data to pipeline
                    if (state.pipelineId) {
                      await updatePipeline(state.pipelineId, 2, { researchData: state.researchData, selectedIdea: state.selectedIdea });
                    }
                    setStage(3);
                  }} className="w-full h-12 bg-green-600 hover:bg-green-700">
                    <ArrowRight className="w-5 h-5 mr-2" /> Continue to Plan
                  </Button>
                </div>
                );
              })()}
            </CardContent>
          </Card>
        )}

        {/* ============ STAGE 3: PLAN ============ */}
        {stage === 3 && (
          <Card className="bg-cyan-500/10 border-cyan-500/20">
            <CardHeader>
              <CardTitle className="text-cyan-400 flex items-center gap-2"><FileText className="w-6 h-6" /> Stage 3: Article Plan</CardTitle>
              <CardDescription>Claude Sonnet 4 generates the article structure with H2/H3 headings, FAQs, and section briefs</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {!state.plan ? (
                loading ? (
                  <StepPreloader
                    icon="📋"
                    title="Claude Sonnet 4 generating plan..."
                    description="Claude Sonnet 4 is creating the article structure with H2/H3 headings, FAQs, and section briefs."
                    elapsed={elapsedTime}
                    warning="This usually takes 10-20 seconds"
                  />
                ) : (
                  <Button onClick={generatePlan} disabled={loading} className="w-full h-14 bg-cyan-600 hover:bg-cyan-700 text-lg">
                    <FileText className="w-5 h-5 mr-2" /> Generate Plan
                  </Button>
                )
              ) : (
                <div className="space-y-3">
                  <ResultPanel title="Plan Generated" icon={<FileText className="w-5 h-5 text-cyan-400" />} color="blue">
                    <p className="text-white font-bold">{state.plan.title || state.plan.finalTitle}</p>
                    <p className="text-gray-400 text-sm mt-1">{state.plan.metaDescription}</p>
                    {state.plan.structure?.sections && (
                      <div className="mt-3 bg-white/5 rounded-lg p-3">
                        <p className="text-xs text-gray-400 mb-2">Sections ({state.plan.structure.sections.length}):</p>
                        {state.plan.structure.sections.map((s: any, i: number) => (
                          <p key={i} className="text-white text-sm py-0.5">
                            <span className="text-cyan-400 mr-2">H2</span> {s.h2 || s}
                          </p>
                        ))}
                      </div>
                    )}
                  </ResultPanel>
                  <div className="flex gap-3">
                    <Button onClick={generatePlan} variant="outline" disabled={loading} className="flex-1 h-12">
                      <RefreshCw className="w-4 h-4 mr-2" /> Regenerate
                    </Button>
                    <Button onClick={async () => {
                      update({ planApproved: true });
                      if (state.pipelineId) {
                        await updatePipeline(state.pipelineId, 3, { plan: state.plan, planApproved: true });
                      }
                      setStage(4);
                    }} className="flex-1 h-12 bg-green-600 hover:bg-green-700">
                      <Check className="w-4 h-4 mr-2" /> Approve Plan
                    </Button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* ============ STAGE 4: WRITE (Streaming Progress) ============ */}
        {stage === 4 && (
          <Card className="bg-green-500/10 border-green-500/20">
            <CardHeader>
              <CardTitle className="text-green-400 flex items-center gap-2"><Pencil className="w-6 h-6" /> Stage 4: Write Article</CardTitle>
              <CardDescription className="flex items-center gap-2">
                Claude Sonnet 4 writes with Ate Yna&apos;s warm, Filipino personality
                <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                  state.isSiloPage
                    ? 'bg-purple-500/20 text-purple-300 border border-purple-500/30'
                    : 'bg-green-500/20 text-green-300 border border-green-500/30'
                }`}>
                  Target: {state.isSiloPage ? '3,000-4,000' : '1,800-2,200'} words
                </span>
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {!state.article ? (
                loading ? (
                  <div className="space-y-3">
                    <div className="bg-white/5 rounded-xl p-5 border border-green-500/30">
                      {/* Progress header */}
                      <div className="flex items-center justify-between mb-3">
                        <span className="text-white font-semibold text-sm">{writeStatus || 'Writing article...'}</span>
                        <span className="text-green-400 font-bold text-sm">{writeProgress}%</span>
                      </div>
                      {/* Progress bar */}
                      <div className="h-3 bg-white/10 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-gradient-to-r from-green-500 via-emerald-500 to-green-500 rounded-full transition-all duration-500 ease-out relative"
                          style={{ width: `${writeProgress}%` }}
                        >
                          <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/30 to-transparent animate-pulse" />
                        </div>
                      </div>
                      {/* Stats row */}
                      <div className="flex items-center justify-between mt-4">
                        <div className="flex items-center gap-3">
                          <Pencil className="w-5 h-5 text-green-400 animate-pulse" />
                          <span className="text-gray-400 text-xs">
                            {writeWordEstimate > 0 ? `~${writeWordEstimate.toLocaleString()} words written` : 'Preparing Ate Yna...'}
                          </span>
                        </div>
                        <span className="text-2xl font-mono font-bold text-green-400">{elapsedTime}</span>
                      </div>
                      {/* Warning */}
                      <div className="mt-3 flex items-center justify-center gap-2 text-yellow-400/80 text-xs">
                        <AlertTriangle className="w-3 h-3" />
                        <span>Please don&apos;t close this window while writing is in progress.</span>
                      </div>
                    </div>
                  </div>
                ) : (
                  <Button onClick={writeArticle} disabled={loading} className="w-full h-14 bg-green-600 hover:bg-green-700 text-lg">
                    <Pencil className="w-5 h-5 mr-2" /> Write Article
                  </Button>
                )
              ) : (
                <div className="space-y-3">
                  <ResultPanel title="Article Written" icon={<CheckCircle className="w-5 h-5 text-green-400" />} color="green">
                    <div className="grid grid-cols-3 gap-3 text-sm">
                      <div className="bg-white/5 rounded-lg p-3 text-center">
                        <p className="text-gray-400 text-xs">Words</p>
                        <p className="text-white font-bold text-xl">{state.wordCount.toLocaleString()}</p>
                      </div>
                      <div className="bg-white/5 rounded-lg p-3 text-center">
                        <p className="text-gray-400 text-xs">Sections</p>
                        <p className="text-white font-bold text-xl">{(state.article.match(/^## /gm) || []).length}</p>
                      </div>
                      <div className="bg-white/5 rounded-lg p-3 text-center">
                        <p className="text-gray-400 text-xs">Paragraphs</p>
                        <p className="text-white font-bold text-xl">{state.article.split(/\n\n+/).filter(p => p.trim()).length}</p>
                      </div>
                    </div>
                    <div className="bg-white/5 rounded-lg p-3 max-h-48 overflow-y-auto mt-2">
                      <div className="text-white text-sm whitespace-pre-wrap">{state.article.slice(0, 800)}...</div>
                    </div>
                  </ResultPanel>
                  <Button onClick={async () => {
                    if (state.pipelineId) {
                      await updatePipeline(state.pipelineId, 4, { article: state.article, wordCount: state.wordCount });
                    }
                    setStage(5);
                  }} className="w-full h-12 bg-green-600 hover:bg-green-700">
                    <ArrowRight className="w-5 h-5 mr-2" /> Continue to Humanize
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* ============ STAGE 5: HUMANIZE ============ */}
        {stage === 5 && (
          <Card className="bg-yellow-500/10 border-yellow-500/20">
            <CardHeader>
              <CardTitle className="text-yellow-400 flex items-center gap-2"><Bot className="w-6 h-6" /> Stage 5: Humanize</CardTitle>
              <CardDescription>Grok 4.1 Fast rewrites to pass AI detectors (85%+ human score)</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {!state.humanizedArticle ? (
                loading ? (
                  <StepPreloader
                    icon="🤖"
                    title="Grok 4.1 Fast humanizing..."
                    description="Grok 4.1 Fast is rewriting for natural speech patterns, sentence variety, and Filipino personality. Targeting 85%+ human score."
                    elapsed={elapsedTime}
                    warning="⚠️ Please don't close this window — typically takes 1-3 minutes"
                  />
                ) : (
                  <Button onClick={humanizeArticle} disabled={loading} className="w-full h-14 bg-yellow-600 hover:bg-yellow-700 text-lg">
                    <Bot className="w-5 h-5 mr-2" /> Humanize
                  </Button>
                )
              ) : (
                <div className="space-y-3">
                  <ResultPanel title={`Human Score: ${state.humanScore}%`} icon={<Bot className="w-5 h-5 text-yellow-400" />} color="yellow">
                    {state.humanizeChanges && (
                      <>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-sm">
                          <div className="bg-white/5 rounded-lg p-2 text-center">
                            <p className="text-gray-400 text-[10px]">Contractions Added</p>
                            <p className="text-white font-bold">+{state.humanizeChanges.contractionsAdded || 0}</p>
                          </div>
                          <div className="bg-white/5 rounded-lg p-2 text-center">
                            <p className="text-gray-400 text-[10px]">Questions Added</p>
                            <p className="text-white font-bold">+{state.humanizeChanges.questionsAdded || 0}</p>
                          </div>
                          <div className="bg-white/5 rounded-lg p-2 text-center">
                            <p className="text-gray-400 text-[10px]">Filipino Expressions</p>
                            <p className="text-white font-bold">{state.humanizeChanges.filipinoExpressionsCount || 0}</p>
                          </div>
                          <div className="bg-white/5 rounded-lg p-2 text-center">
                            <p className="text-gray-400 text-[10px]">Word Count Δ</p>
                            <p className="text-white font-bold">{(state.humanizeChanges.wordCountDiff ?? 0) >= 0 ? '+' : ''}{state.humanizeChanges.wordCountDiff ?? 0}</p>
                          </div>
                        </div>
                        <p className="text-xs text-gray-400 mt-2">{state.humanizeChanges.summary}</p>
                      </>
                    )}
                  </ResultPanel>
                  <Button onClick={async () => {
                    if (state.pipelineId) {
                      await updatePipeline(state.pipelineId, 5, { humanizedArticle: state.humanizedArticle, humanScore: state.humanScore });
                    }
                    setStage(6);
                  }} className="w-full h-12 bg-green-600 hover:bg-green-700">
                    <ArrowRight className="w-5 h-5 mr-2" /> Continue to SEO
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* ============ STAGE 6: SEO ============ */}
        {stage === 6 && (
          <Card className="bg-pink-500/10 border-pink-500/20">
            <CardHeader>
              <CardTitle className="text-pink-400 flex items-center gap-2"><Sparkles className="w-6 h-6" /> Stage 6: SEO Optimize</CardTitle>
              <CardDescription>Claude + OpenAI add internal links, .edu/.org outbound links, optimize keywords for Rank Math 100/100</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {!state.seoArticle ? (
                loading ? (
                  <StepPreloader
                    icon="🚀"
                    title="Claude + OpenAI optimizing SEO..."
                    description="Adding internal links, outbound authority links, checking keyword density, heading optimization, and FAQ schema. Targeting Rank Math 100/100."
                    elapsed={elapsedTime}
                    warning="⚠️ Please don't close this window — typically takes 30-60 seconds"
                  />
                ) : (
                  <Button onClick={seoOptimize} disabled={loading} className="w-full h-14 bg-pink-600 hover:bg-pink-700 text-lg">
                    <Sparkles className="w-5 h-5 mr-2" /> Optimize SEO
                  </Button>
                )
              ) : (
                <div className="space-y-3">
                  <ResultPanel title={`Rank Math: ~${state.seoStats?.estimatedRankMathScore || '?'}/100`} icon={<TrendingUp className="w-5 h-5 text-pink-400" />} color="pink">
                    {state.seoChanges && (
                      <>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-sm">
                          <div className="bg-white/5 rounded-lg p-2 text-center">
                            <p className="text-gray-400 text-[10px]">Internal Links</p>
                            <p className="text-white font-bold">{state.seoChanges.internalLinksAdded}</p>
                          </div>
                          <div className="bg-white/5 rounded-lg p-2 text-center">
                            <p className="text-gray-400 text-[10px]">Outbound Links</p>
                            <p className="text-white font-bold">{state.seoChanges.outboundLinksAdded}</p>
                          </div>
                          <div className="bg-white/5 rounded-lg p-2 text-center">
                            <p className="text-gray-400 text-[10px]">Keyword Density</p>
                            <p className="text-white font-bold">{state.seoChanges.keywordDensity}</p>
                          </div>
                          <div className="bg-white/5 rounded-lg p-2 text-center">
                            <p className="text-gray-400 text-[10px]">Readability</p>
                            <p className="text-white font-bold">{state.seoChanges.readabilityScore}</p>
                          </div>
                        </div>

                        {/* Internal Links Detail */}
                        {state.seoChanges.internalLinkDetails?.length > 0 && (
                          <div className="mt-3 bg-white/5 rounded-lg p-3">
                            <p className="text-xs text-gray-400 mb-1 flex items-center gap-1"><LinkIcon className="w-3 h-3" /> Internal Links:</p>
                            {state.seoChanges.internalLinkDetails.map((link: any, i: number) => (
                              <p key={i} className="text-xs text-cyan-400">• {link.anchor} → {link.url}</p>
                            ))}
                          </div>
                        )}

                        {/* Outbound Links Detail */}
                        {state.seoChanges.outboundLinkDetails?.length > 0 && (
                          <div className="mt-2 bg-white/5 rounded-lg p-3">
                            <p className="text-xs text-gray-400 mb-1 flex items-center gap-1"><Globe className="w-3 h-3" /> Outbound Links:</p>
                            {state.seoChanges.outboundLinkDetails.map((link: any, i: number) => (
                              <p key={i} className="text-xs text-green-400">• {link.anchor} → {link.url}</p>
                            ))}
                          </div>
                        )}

                        <div className="mt-2 flex items-center gap-2 text-xs">
                          {state.seoChanges.keywordInFirst100Words 
                            ? <Badge className="bg-green-500/20 text-green-400 text-[10px]">✅ Keyword in first 100 words</Badge>
                            : <Badge className="bg-red-500/20 text-red-400 text-[10px]">⚠️ Keyword missing from first 100 words</Badge>
                          }
                          <Badge className="bg-blue-500/20 text-blue-400 text-[10px]">
                            {state.seoChanges.headingsOptimized} headings optimized
                          </Badge>
                          {state.seoChanges.faqSectionsAdded > 0 && (
                            <Badge className="bg-purple-500/20 text-purple-400 text-[10px]">
                              {state.seoChanges.faqSectionsAdded} FAQ questions
                            </Badge>
                          )}
                        </div>
                      </>
                    )}
                  </ResultPanel>
                  <Button onClick={async () => {
                    if (state.pipelineId) {
                      await updatePipeline(state.pipelineId, 6, { seoArticle: state.seoArticle, seoStats: state.seoStats });
                    }
                    setStage(7);
                  }} className="w-full h-12 bg-green-600 hover:bg-green-700">
                    <ArrowRight className="w-5 h-5 mr-2" /> Continue to Meta
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* ============ STAGE 7: META + IMAGES ============ */}
        {stage === 7 && (
          <Card className="bg-indigo-500/10 border-indigo-500/20">
            <CardHeader>
              <CardTitle className="text-indigo-400 flex items-center gap-2"><Globe className="w-6 h-6" /> Stage 7: Meta & Schema</CardTitle>
              <CardDescription>
                GPT-4o-mini generates meta tags{state.isSiloPage && ' (silo canonical)'}, schema markup, and SEO metadata.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Silo Page Indicator */}
              {state.isSiloPage && (
                <div className="bg-purple-500/10 border border-purple-500/30 rounded-lg p-3">
                  <p className="text-purple-400 text-sm font-semibold flex items-center gap-2">
                    📌 Silo Page Mode
                  </p>
                  <p className="text-gray-400 text-xs mt-1">
                    Canonical URL: /insights/{BPO_SILOS.find(s => s.id === state.selectedSilo)?.slug}
                  </p>
                </div>
              )}

              {/* Silo Mode Note */}
              {state.isSiloPage && !state.meta && !loading && (
                <div className="bg-amber-500/10 border border-amber-500/30 rounded-lg p-3">
                  <p className="text-amber-400 text-sm font-semibold">📌 Using meta from Silo Editor — generating schema only</p>
                  <p className="text-gray-400 text-xs mt-1">Meta title, description, and slug will be pulled from the silo editor. Only schema markup (BlogPosting, Breadcrumbs, FAQ) will be generated.</p>
                </div>
              )}

              {!state.meta ? (
                loading ? (
                  <StepPreloader
                    icon="📊"
                    title={state.isSiloPage ? "Generating schema markup..." : "Generating meta tags & schema markup..."}
                    description={state.isSiloPage 
                      ? 'Pulling meta from Silo Editor. Generating schema: BlogPosting, breadcrumbs, FAQ detection.'
                      : `GPT-4o-mini: meta title, description, OG tags, canonical URL, keywords. Schema: BlogPosting, breadcrumbs, FAQ detection.`}
                    elapsed={elapsedTime}
                    warning="⚠️ Usually takes 10-15 seconds"
                  />
                ) : (
                  <Button onClick={generateMeta} disabled={loading} className="w-full h-14 bg-indigo-600 hover:bg-indigo-700 text-lg">
                    <Globe className="w-5 h-5 mr-2" /> {state.isSiloPage ? 'Generate Schema' : 'Generate Meta & Schema'}
                  </Button>
                )
              ) : (
                <div className="space-y-3">
                  {/* Meta Tags Display */}
                  <ResultPanel title="Meta Tags Generated" icon={<Hash className="w-5 h-5 text-indigo-400" />} color="indigo">
                    <div className="space-y-3">
                      <div className="bg-white/5 rounded-lg p-3">
                        <p className="text-gray-400 text-xs mb-1">Meta Title ({state.meta.metaTitle?.length || 0} chars)</p>
                        <p className="text-blue-400 font-semibold text-sm">{state.meta.metaTitle}</p>
                      </div>
                      <div className="bg-white/5 rounded-lg p-3">
                        <p className="text-gray-400 text-xs mb-1">Meta Description ({state.meta.metaDescription?.length || 0} chars)</p>
                        <p className="text-gray-300 text-sm">{state.meta.metaDescription}</p>
                      </div>
                      <div className="bg-white/5 rounded-lg p-3">
                        <p className="text-gray-400 text-xs mb-1">Canonical URL</p>
                        <p className="text-cyan-400 font-mono text-sm">{state.meta.canonicalUrl || `/insights/${state.meta.canonicalSlug}`}</p>
                        {state.meta.isSiloPage && (
                          <Badge className="bg-purple-500/20 text-purple-400 text-[10px] mt-1">📌 Silo Page Canonical</Badge>
                        )}
                      </div>

                      {/* Keywords Display */}
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                        <div className="bg-white/5 rounded-lg p-3">
                          <p className="text-gray-400 text-xs mb-2">🎯 Focus Keyword</p>
                          <Badge className="bg-yellow-500/20 text-yellow-400">{state.meta.focusKeyword}</Badge>
                        </div>
                        <div className="bg-white/5 rounded-lg p-3">
                          <p className="text-gray-400 text-xs mb-2">📊 Semantic Keywords</p>
                          <div className="flex flex-wrap gap-1">
                            {(state.meta.semanticKeywords || []).slice(0, 5).map((kw: string, i: number) => (
                              <Badge key={i} variant="outline" className="text-[10px] border-green-500/30 text-green-400">{kw}</Badge>
                            ))}
                          </div>
                        </div>
                        <div className="bg-white/5 rounded-lg p-3">
                          <p className="text-gray-400 text-xs mb-2">🔗 Cluster Keywords</p>
                          <div className="flex flex-wrap gap-1">
                            {(state.meta.clusterKeywords || []).slice(0, 3).map((kw: string, i: number) => (
                              <Badge key={i} variant="outline" className="text-[10px] border-purple-500/30 text-purple-400">{kw}</Badge>
                            ))}
                          </div>
                        </div>
                      </div>

                      {/* OG / Twitter */}
                      <div className="grid grid-cols-2 gap-2">
                        <div className="bg-white/5 rounded-lg p-3">
                          <p className="text-gray-400 text-xs mb-1">OG Title</p>
                          <p className="text-white text-xs">{state.meta.ogTitle}</p>
                        </div>
                        <div className="bg-white/5 rounded-lg p-3">
                          <p className="text-gray-400 text-xs mb-1">Twitter Title</p>
                          <p className="text-white text-xs">{state.meta.twitterTitle}</p>
                        </div>
                      </div>
                    </div>
                  </ResultPanel>

                  {/* Schema Markup Summary */}
                  {state.meta.schemaSummary && (
                    <div className="bg-white/5 rounded-lg p-4 border border-white/10">
                      <p className="text-gray-400 text-xs font-semibold mb-3 uppercase tracking-wider">📋 Schema Markup (JSON-LD)</p>
                      <div className="space-y-2">
                        <div className="flex items-center gap-2">
                          <span className="text-green-400 text-sm">✅</span>
                          <span className="text-gray-300 text-sm">BlogPosting schema</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-green-400 text-sm">✅</span>
                          <span className="text-gray-300 text-sm">Breadcrumbs: {state.meta.schemaSummary.breadcrumbPath}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          {state.meta.schemaSummary.faqCount > 0 ? (
                            <>
                              <span className="text-green-400 text-sm">✅</span>
                              <span className="text-gray-300 text-sm">FAQ schema ({state.meta.schemaSummary.faqCount} questions detected)</span>
                            </>
                          ) : (
                            <>
                              <span className="text-blue-400 text-sm">ℹ️</span>
                              <span className="text-gray-500 text-sm">No FAQ detected</span>
                            </>
                          )}
                        </div>
                        <div className="flex items-center gap-2">
                          {state.meta.schemaSummary.howToSteps > 0 ? (
                            <>
                              <span className="text-green-400 text-sm">✅</span>
                              <span className="text-gray-300 text-sm">HowTo schema ({state.meta.schemaSummary.howToSteps} steps)</span>
                            </>
                          ) : (
                            <>
                              <span className="text-blue-400 text-sm">ℹ️</span>
                              <span className="text-gray-500 text-sm">No HowTo detected</span>
                            </>
                          )}
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Generated Images with Prompts */}
                  {state.images.length > 0 && (
                    <ResultPanel title={`${state.images.length} Images Generated`} icon={<ImageIcon className="w-5 h-5 text-green-400" />} color="green">
                      <div className="space-y-3">
                        {state.images.map((img: any, i: number) => (
                          <div key={i} className="bg-white/5 rounded-lg overflow-hidden">
                            <img src={img.url} alt={img.altText} className="w-full h-32 object-cover" />
                            <div className="p-3 space-y-1">
                              <div className="flex items-center gap-2">
                                <Badge variant="outline" className="text-[10px] border-indigo-500/30 text-indigo-400">{img.position}</Badge>
                                {img.filename && <span className="text-[10px] text-gray-500 font-mono">{img.filename}</span>}
                              </div>
                              <p className="text-xs text-gray-400"><strong>Alt:</strong> {img.altText}</p>
                              {img.title && <p className="text-xs text-gray-500"><strong>Title:</strong> {img.title}</p>}
                              {img.caption && <p className="text-xs text-gray-500"><strong>Caption:</strong> {img.caption}</p>}
                              {img.prompt && (
                                <details className="mt-1">
                                  <summary className="text-[10px] text-purple-400 cursor-pointer">View AI Prompt</summary>
                                  <p className="text-[10px] text-gray-500 mt-1 bg-black/20 p-2 rounded">{img.prompt}</p>
                                </details>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    </ResultPanel>
                  )}

                  {/* Image Prompts (even if images failed) */}
                  {state.imagePrompts?.length > 0 && state.images.length === 0 && (
                    <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-3">
                      <p className="text-yellow-400 text-sm font-semibold">⚠️ Image generation failed, but prompts are ready:</p>
                      {state.imagePrompts.map((p: any, i: number) => (
                        <div key={i} className="mt-2 text-xs text-gray-400 bg-black/20 p-2 rounded">
                          <strong>{p.position}:</strong> {p.prompt}
                        </div>
                      ))}
                    </div>
                  )}

                  <Button onClick={async () => {
                    if (state.pipelineId) {
                      await updatePipeline(state.pipelineId, 7, { meta: state.meta, images: state.images, imagePrompts: state.imagePrompts });
                    }
                    setStage(8);
                  }} className="w-full h-12 bg-green-600 hover:bg-green-700">
                    <ArrowRight className="w-5 h-5 mr-2" /> Continue to Media
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* ============ STAGE 8: MEDIA ============ */}
        {stage === 8 && (
          <MediaStage
            state={state}
            updateState={update}
            loading={loading}
            setLoading={setLoading}
            toast={toast}
            savePipelineProgress={savePipelineProgress}
            saveProgress={saveProgress}
            heroType={heroType}
            setHeroType={setHeroType}
            heroSource={heroSource}
            setHeroSource={setHeroSource}
            sectionSource={sectionSource}
            setSectionSource={setSectionSource}
            uploadedImages={uploadedImages}
            setUploadedImages={setUploadedImages}
            onContinue={() => setStage(9)}
            onBack={() => setStage(7)}
          />
        )}

        {/* ============ STAGE 9: PUBLISH ============ */}
        {stage === 9 && (
          <Card className="bg-emerald-500/10 border-emerald-500/20">
            <CardHeader>
              <CardTitle className="text-emerald-400 flex items-center gap-2"><CheckCircle className="w-6 h-6" /> Stage 9: Preview & Publish</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Article Preview with Media */}
              <div className="bg-white/5 rounded-lg p-4 max-h-96 overflow-y-auto">
                <h1 className="text-2xl font-bold text-white mb-2">{state.plan?.title || state.selectedIdea?.title}</h1>
                {/* Hero Media Preview */}
                {uploadedImages.hero && (
                  <div className="mb-4 rounded-lg overflow-hidden">
                    {heroType === 'video' ? (
                      <video src={uploadedImages.hero} controls className="w-full h-48 object-cover" />
                    ) : (
                      <img src={uploadedImages.hero} alt="Hero" className="w-full h-48 object-cover" />
                    )}
                  </div>
                )}
                <div className="text-white text-sm whitespace-pre-wrap">{(state.seoArticle || state.humanizedArticle || state.article).slice(0, 1500)}...</div>
              </div>

              {/* AI Pipeline Transparency — what each stage did */}
              {Object.keys(stageOutputs).length > 0 && (
                <details className="bg-white/5 border border-white/10 rounded-xl">
                  <summary className="p-3 cursor-pointer text-sm font-semibold text-purple-400 flex items-center gap-2">
                    <Eye className="w-4 h-4" /> View AI Pipeline Details (Input → Output per stage)
                  </summary>
                  <div className="p-3 space-y-2 border-t border-white/10">
                    {stageOutputs.ideas && (
                      <div className="bg-black/20 rounded-lg p-2 text-xs">
                        <p className="text-cyan-400 font-semibold">Stage 1: Ideas ({stageOutputs.ideas.model})</p>
                        <p className="text-gray-500">Input: Silo={stageOutputs.ideas.input.silo || 'none'}, Topic=&quot;{stageOutputs.ideas.input.topic || stageOutputs.ideas.input.voiceTranscript?.slice(0, 50)}...&quot;</p>
                        <p className="text-gray-400">Output: {stageOutputs.ideas.output?.length || 0} ideas generated</p>
                      </div>
                    )}
                    {stageOutputs.research && (
                      <div className="bg-black/20 rounded-lg p-2 text-xs">
                        <p className="text-blue-400 font-semibold">Stage 2: Research ({stageOutputs.research.model})</p>
                        <p className="text-gray-500">Input: Topic=&quot;{stageOutputs.research.input.topic}&quot;, Keyword=&quot;{stageOutputs.research.input.focusKeyword}&quot;</p>
                        <p className="text-gray-400">Output: {stageOutputs.research.output?.research?.serper?.competitors?.length || '?'} competitors, Perplexity: ${stageOutputs.research.output?.research?.perplexity ? 'YES' : 'NO'}</p>
                      </div>
                    )}
                    {stageOutputs.write && (
                      <div className="bg-black/20 rounded-lg p-2 text-xs">
                        <p className="text-green-400 font-semibold">Stage 4: Write ({stageOutputs.write.model})</p>
                        <p className="text-gray-500">Input: {stageOutputs.write.input.sections} planned sections</p>
                        <p className="text-gray-400">Output: {stageOutputs.write.output.wordCount} words, {stageOutputs.write.output.sections} sections</p>
                      </div>
                    )}
                    {stageOutputs.humanize && (
                      <div className="bg-black/20 rounded-lg p-2 text-xs">
                        <p className="text-yellow-400 font-semibold">Stage 5: Humanize ({stageOutputs.humanize.model})</p>
                        <p className="text-gray-500">Input: {stageOutputs.humanize.input.wordCount} words</p>
                        <p className="text-gray-400">Output: {stageOutputs.humanize.output.humanScore}% human score, +{stageOutputs.humanize.output.changes?.contractionsAdded || 0} contractions, +{stageOutputs.humanize.output.changes?.questionsAdded || 0} questions</p>
                      </div>
                    )}
                    {stageOutputs.seo && (
                      <div className="bg-black/20 rounded-lg p-2 text-xs">
                        <p className="text-pink-400 font-semibold">Stage 6: SEO ({stageOutputs.seo.model})</p>
                        <p className="text-gray-500">Input: Keywords=[{stageOutputs.seo.input.keywords?.slice(0, 3).join(', ')}]</p>
                        <p className="text-gray-400">Output: Rank Math ~{stageOutputs.seo.output.rankMath}/100{stageOutputs.seo.output.summary ? ` — ${stageOutputs.seo.output.summary}` : ''}</p>
                      </div>
                    )}
                    {stageOutputs.meta && (
                      <div className="bg-black/20 rounded-lg p-2 text-xs">
                        <p className="text-indigo-400 font-semibold">Stage 7: Meta ({stageOutputs.meta.model})</p>
                        <p className="text-gray-500">Input: Silo={stageOutputs.meta.input.silo || 'none'}, IsSiloPage={stageOutputs.meta.input.isSiloPage ? 'YES' : 'no'}</p>
                        <p className="text-gray-400">Output: Slug=&quot;{stageOutputs.meta.output.slug}&quot;, Focus=&quot;{stageOutputs.meta.output.focusKeyword}&quot;</p>
                        {stageOutputs.meta.output.semanticKeywords?.length > 0 && (
                          <p className="text-gray-500">Semantic: [{stageOutputs.meta.output.semanticKeywords.join(', ')}]</p>
                        )}
                        {stageOutputs.meta.output.warnings?.length > 0 && (
                          <p className="text-amber-400">⚠️ {stageOutputs.meta.output.warnings.join(' | ')}</p>
                        )}
                      </div>
                    )}
                  </div>
                </details>
              )}

              {/* Pipeline Summary */}
              <ResultPanel title="Pipeline Summary" icon={<BarChart3 className="w-5 h-5 text-emerald-400" />} color="green">
                <div className="grid grid-cols-2 md:grid-cols-5 gap-2 text-sm">
                  <div className="bg-white/5 rounded-lg p-2 text-center">
                    <p className="text-gray-400 text-[10px]">Words</p>
                    <p className="text-white font-bold">{state.seoArticle?.split(/\s+/).length || state.wordCount}</p>
                  </div>
                  <div className="bg-white/5 rounded-lg p-2 text-center">
                    <p className="text-gray-400 text-[10px]">Human Score</p>
                    <p className="text-white font-bold">{state.humanScore}%</p>
                  </div>
                  <div className="bg-white/5 rounded-lg p-2 text-center">
                    <p className="text-gray-400 text-[10px]">Rank Math</p>
                    <p className="text-white font-bold">~{state.seoStats?.estimatedRankMathScore || '?'}/100</p>
                  </div>
                  <div className="bg-white/5 rounded-lg p-2 text-center">
                    <p className="text-gray-400 text-[10px]">Images</p>
                    <p className="text-white font-bold">{state.images?.length || 0}</p>
                  </div>
                  <div className="bg-white/5 rounded-lg p-2 text-center">
                    <p className="text-gray-400 text-[10px]">Hero</p>
                    <p className="text-white font-bold">{uploadedImages.hero ? '✅' : '⏳'}</p>
                  </div>
                </div>
                {state.isSiloPage && (
                  <Badge className="bg-purple-500/20 text-purple-400 text-xs mt-2">📌 Publishing as Silo Page (Pillar)</Badge>
                )}
              </ResultPanel>

              {/* Meta Preview */}
              {state.meta && (
                <div className="bg-white/5 rounded-lg p-3">
                  <p className="text-blue-400 text-sm font-semibold">{state.meta.metaTitle}</p>
                  <p className="text-green-400 text-xs font-mono mt-1">{state.meta.canonicalUrl || `/insights/${state.meta.canonicalSlug}`}</p>
                  <p className="text-gray-400 text-xs mt-1">{state.meta.metaDescription}</p>
                </div>
              )}

              <div className="flex gap-3">
                <Button onClick={() => publishArticle(true)} disabled={loading} variant="outline" className="flex-1 h-14">
                  {loading ? <><Loader2 className="w-5 h-5 animate-spin mr-2" /> Saving...</> : <><Save className="w-5 h-5 mr-2" /> Save Draft</>}
                </Button>
                <Button onClick={() => publishArticle(false)} disabled={loading} className="flex-1 h-14 bg-emerald-600 hover:bg-emerald-700">
                  {loading ? <><Loader2 className="w-5 h-5 animate-spin mr-2" /> Publishing...</> : <><CheckCircle className="w-5 h-5 mr-2" /> Publish</>}
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Navigation */}
        <div className="flex justify-between pt-4">
          <Button onClick={() => stage > 1 && setStage(stage - 1)} disabled={stage === 1} variant="outline">
            <ArrowLeft className="w-4 h-4 mr-2" /> Back
          </Button>
          <Button onClick={() => router.push('/insights')} variant="ghost" className="text-gray-400">Exit</Button>
        </div>
      </div>
    </div>
  );
}

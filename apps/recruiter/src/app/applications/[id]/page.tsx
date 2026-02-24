'use client';

import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { useParams, useRouter } from 'next/navigation';
import {
  ArrowLeft,
  Loader2,
  User,
  Mail,
  Phone,
  MapPin,
  Briefcase,
  Calendar,
  FileText,
  Star,
  Building2,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/shared/ui/card';
import { Button } from '@/components/shared/ui/button';
import { Badge } from '@/components/shared/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/shared/ui/avatar';
import { Input } from '@/components/shared/ui/input';
import { Checkbox } from '@/components/shared/ui/checkbox';
import Link from 'next/link';
import { useAuth } from '@/contexts/AuthContext';
import { getSessionToken } from '@/lib/auth-helpers';
import { toast } from '@/components/shared/ui/toast';
import { ActivityTimeline, ActivityEvent } from '@/components/shared/application/ActivityTimeline';
import { ClientFeedback } from '@/components/shared/application/ClientFeedback';
import { RejectionInfo } from '@/components/shared/application/RejectionInfo';
import { HiredStatus } from '@/components/shared/application/HiredStatus';
import { OnboardingTaskManager } from '@/components/recruiter/OnboardingTaskManager';
import { CallArtifacts, type CallArtifactRoom } from '@/components/shared/application/CallArtifacts';
import { VideoCallButton } from '@/components/video';
import { InterviewSchedulerModal } from '@/components/recruiter/InterviewSchedulerModal';

interface ApplicationCard {
  id: string;
  candidate_id: string;
  job_id: string;
  status: string;
  recruiter_notes?: string | null;
  reviewed_by?: string | null;
  reviewed_at?: string | null;
  released_to_client?: boolean | null;
  released_at?: string | null;
  released_by?: string | null;
  client_notes?: string | null;
  client_rating?: number | null;
  rejection_reason?: string | null;
  rejected_by?: 'client' | 'recruiter' | null;
  rejected_date?: string | null;
  offer_acceptance_date?: string | null;
  contract_signed?: boolean;
  first_day_date?: string | null;
  started_status?: 'hired' | 'started' | 'no_show' | null;
  created_at: string;
  updated_at: string;
  resume_url?: string | null;
  resume_file_name?: string | null;
  timeline?: ActivityEvent[];
  interviews?: any[];
  offers?: any[];
  calls?: CallArtifactRoom[];
  candidates?: {
    id: string;
    first_name?: string;
    last_name?: string;
    email?: string;
    phone?: string;
    avatar_url?: string;
    location?: string;
  };
  jobs?: {
    id: string;
    title?: string;
  };
}

type SharePrefs = {
  video: boolean;
  notes: boolean;
  transcript: boolean;
};

type ShareAllPrefs = {
  shareWithClient: boolean;
  shareWithCandidate: boolean;
};

const CALL_TYPE_LABELS: Record<string, string> = {
  recruiter_prescreen: 'Pre-Screen',
  recruiter_round_1: 'Recruiter Round 1',
  recruiter_round_2: 'Recruiter Round 2',
  recruiter_round_3: 'Recruiter Round 3',
  recruiter_offer: 'Recruiter Offer Call',
  recruiter_general: 'Recruiter Call',
  client_round_1: 'Client Round 1',
  client_round_2: 'Client Round 2',
  client_final: 'Client Final',
  client_general: 'Client Call',
};

export default function ApplicationDetailPage() {
  const params = useParams();
  const router = useRouter();
  const applicationId = params.id as string;
  const { user } = useAuth();

  const [loading, setLoading] = useState(true);
  const [application, setApplication] = useState<ApplicationCard | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [notesDraft, setNotesDraft] = useState('');
  const [savingNotes, setSavingNotes] = useState(false);
  const [notesJustSaved, setNotesJustSaved] = useState(false);
  const [releaseLoading, setReleaseLoading] = useState(false);
  const [statusLoading, setStatusLoading] = useState<string | null>(null);
  const [shareByRoom, setShareByRoom] = useState<Record<string, ShareAllPrefs>>({});
  const [scheduleOpen, setScheduleOpen] = useState(false);
  const [scheduleType, setScheduleType] = useState('recruiter_prescreen');
  const [scheduleAt, setScheduleAt] = useState('');
  const [scheduleTz, setScheduleTz] = useState('UTC');
  const [scheduleDuration, setScheduleDuration] = useState(30);
  const [showSchedulerModal, setShowSchedulerModal] = useState(false);

  useEffect(() => {
    if (user?.id && applicationId) {
      fetchApplication();
    }
  }, [user?.id, applicationId]);

  const fetchApplication = async () => {
    try {
      const token = await getSessionToken();
      // Using internal API route since we're in the recruiter portal
      const response = await fetch(`/api/recruiter/applications/${applicationId}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'x-user-id': user?.id || '',
        },
      });

      const data = await response.json().catch(() => ({}));

      if (response.ok && data.application) {
        // Transform the data to match our ApplicationCard interface
        const app = data.application;
        setApplication({
          id: app.id,
          candidate_id: app.candidate_id,
          job_id: app.job_id,
          status: app.status,
          recruiter_notes: app.recruiter_notes,
          reviewed_by: app.reviewed_by,
          reviewed_at: app.reviewed_at,
          released_to_client: app.released_to_client,
          released_at: app.released_at,
          released_by: app.released_by,
          client_notes: app.client_notes,
          client_rating: app.client_rating,
          rejection_reason: app.rejection_reason,
          rejected_by: app.rejected_by,
          rejected_date: app.rejected_date,
          offer_acceptance_date: app.offer_acceptance_date,
          contract_signed: app.contract_signed || false,
          first_day_date: app.first_day_date,
          started_status: app.started_status,
          created_at: app.created_at,
          updated_at: app.updated_at,
          resume_url: app.resume_url,
          resume_file_name: app.resume_file_name,
          timeline: app.timeline || [],
          interviews: app.interviews || [],
          offers: app.offers || [],
          calls: app.calls || [],
          candidates: app.candidates,
          jobs: app.jobs,
        });
        setNotesDraft(app.recruiter_notes || '');
        // Initialize per-call sharing from DB fields when present.
        const recruiterCalls = (app.calls || []).filter((c: any) => String(c?.call_type || '').startsWith('recruiter_'));

        const nextShareByRoom: Record<string, ShareAllPrefs> = {};
        for (const c of recruiterCalls) {
          const id = String(c.id);

          const shareWithClient =
            typeof c.share_with_client === 'boolean' ? !!c.share_with_client : false;

          const shareWithCandidate =
            typeof c.share_with_candidate === 'boolean'
              ? !!c.share_with_candidate
              : false;

          nextShareByRoom[id] = { shareWithClient, shareWithCandidate };
        }
        setShareByRoom(nextShareByRoom);
        setLoadError(null);
      } else {
        const msg = data?.error || data?.message || 'Application not found or you do not have access';
        console.error('[Recruiter Application Detail] Failed to load', {
          applicationId,
          status: response.status,
          msg,
        });
        setApplication(null);
        setLoadError(`(${response.status}) ${msg}`);
      }
    } catch (error) {
      console.error('Failed to fetch application:', error);
      toast.error('Failed to load application');
      setLoadError('(network) Failed to load application');
    } finally {
      setLoading(false);
    }
  };

  const handleUpdate = () => {
    fetchApplication();
  };

  const updateApplicationStatus = async (nextStatus: string) => {
    if (!application) return;
    setStatusLoading(nextStatus);
    try {
      const token = await getSessionToken();
      const res = await fetch('/api/recruiter/applications/status', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
          'x-user-id': user?.id || '',
        },
        body: JSON.stringify({
          application_id: application.id,
          status: nextStatus,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data?.error || 'Failed to update status');
        return;
      }
      toast.success('Status updated');
      setApplication((prev) => (prev ? { ...prev, status: nextStatus } : prev));
      handleUpdate();
    } catch (e) {
      console.error('Failed to update status:', e);
      toast.error('Failed to update status');
    } finally {
      setStatusLoading(null);
    }
  };

  const saveRecruiterNotes = async () => {
    if (!application) return;
    setSavingNotes(true);
    try {
      const token = await getSessionToken();
      const res = await fetch('/api/recruiter/applications/status', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
          'x-user-id': user?.id || '',
        },
        body: JSON.stringify({
          application_id: application.id,
          notes: notesDraft,
        }),
      });
      const data = await res.json();
      if (res.ok) {
        toast.success('Recruiter notes saved');
        setApplication((prev) => {
          if (!prev) return prev;
          return {
            ...prev,
            recruiter_notes: (data?.application?.recruiter_notes ?? notesDraft) as any,
            reviewed_at: (data?.application?.reviewed_at ?? prev.reviewed_at) as any,
          };
        });
        setNotesJustSaved(true);
        setTimeout(() => setNotesJustSaved(false), 1500);
        handleUpdate();
      } else {
        toast.error(data.error || 'Failed to save recruiter notes');
      }
    } catch (e) {
      console.error('Failed to save recruiter notes:', e);
      toast.error('Failed to save recruiter notes');
    } finally {
      setSavingNotes(false);
    }
  };

  const handleReleaseToClient = async (release: boolean) => {
    if (!application) return;
    setReleaseLoading(true);
    try {
      const token = await getSessionToken();
      const url = release
        ? `/api/recruiter/applications/${application.id}/release?debug=1`
        : `/api/recruiter/applications/${application.id}/send-back`;

      // Simplified: one toggle per call. Server will apply to video+notes+transcript together.
      const share_calls_with_client = Object.entries(shareByRoom)
        .filter(([, v]) => !!v.shareWithClient)
        .map(([room_id]) => ({ room_id, share: true }));

      const share_calls_with_candidate = Object.entries(shareByRoom)
        .filter(([, v]) => !!v.shareWithCandidate)
        .map(([room_id]) => ({ room_id, share: true }));

      const res = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
          'x-user-id': user?.id || '',
        },
        body: release
          ? JSON.stringify({
              // New: per-call sharing (source of truth)
              share_calls_with_client,
              share_calls_with_candidate,
              status: application.status,
            })
          : JSON.stringify({ reason: 'Sent back from client' }),
      });
      const data = await res.json();
      if (res.ok) {
        toast.success(release ? 'Released to client' : 'Sent back to recruiter');
        handleUpdate();
      } else {
        const msg = (data?.details
          ? `${data?.error || 'Release failed'}: ${String(data.details)}`
          : (data?.error || 'Failed to update release status')) as string;
        toast.error(msg.length > 220 ? msg.slice(0, 220) + '…' : msg);
      }
    } catch (e) {
      console.error('Release action failed:', e);
      toast.error('Failed to update release status');
    } finally {
      setReleaseLoading(false);
    }
  };

  const handleScheduleInterview = async () => {
    if (!application) return;
    if (!scheduleAt) {
      toast.error('Pick a date/time');
      return;
    }
    try {
      const token = await getSessionToken();
      const res = await fetch('/api/recruiter/interviews', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
          'x-user-id': user?.id || '',
        },
        body: JSON.stringify({
          application_id: application.id,
          interviewType: scheduleType,
          scheduledAt: new Date(scheduleAt).toISOString(),
          durationMinutes: scheduleDuration,
          clientTimezone: scheduleTz || 'UTC',
        }),
      });
      const data = await res.json();
      if (res.ok) {
        toast.success('Interview scheduled');
        setScheduleOpen(false);
        handleUpdate();
      } else {
        toast.error(data.error || 'Failed to schedule interview');
      }
    } catch (e) {
      console.error('Schedule interview failed:', e);
      toast.error('Failed to schedule interview');
    }
  };

  const getStatusConfig = (status: string) => {
    const configs: Record<string, { label: string; color: string; bg: string }> = {
      submitted: { label: 'Submitted', color: 'text-blue-400', bg: 'bg-blue-500/10 border-blue-500/30' },
      under_review: { label: 'Under Review', color: 'text-cyan-400', bg: 'bg-cyan-500/10 border-cyan-500/30' },
      shortlisted: { label: 'Shortlisted', color: 'text-purple-400', bg: 'bg-purple-500/10 border-purple-500/30' },
      interview_scheduled: { label: 'Interview Scheduled', color: 'text-orange-400', bg: 'bg-orange-500/10 border-orange-500/30' },
      offer_sent: { label: 'Offer Sent', color: 'text-yellow-400', bg: 'bg-yellow-500/10 border-yellow-500/30' },
      hired: { label: 'Hired', color: 'text-emerald-400', bg: 'bg-emerald-500/10 border-emerald-500/30' },
      rejected: { label: 'Rejected', color: 'text-red-400', bg: 'bg-red-500/10 border-red-500/30' },
    };
    return configs[status] || { label: status, color: 'text-gray-400', bg: 'bg-gray-500/10 border-gray-500/30' };
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 text-orange-400 animate-spin" />
      </div>
    );
  }

  if (!application) {
    return (
      <div className="max-w-3xl mx-auto space-y-4 py-10">
        <div className="flex items-center justify-between">
          <Link
            href="/applications"
            className="inline-flex items-center text-gray-400 hover:text-white transition-colors"
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Applications
          </Link>
        </div>

        <Card className="bg-white/5 border-white/10">
          <CardHeader>
            <CardTitle className="text-white">Application could not be loaded</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="text-gray-300 text-sm">
              Application ID: <span className="text-orange-400 font-mono">{applicationId}</span>
            </div>
            {loadError && (
              <div className="text-red-300 text-sm">
                {loadError}
              </div>
            )}
            <div className="text-gray-500 text-sm">
              This usually means the application is not in your agency scope, or the request was unauthorized.
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                onClick={() => {
                  setLoading(true);
                  fetchApplication();
                }}
                className="border-white/10"
              >
                Retry
              </Button>
              <Link href="/applications">
                <Button className="bg-orange-500 hover:bg-orange-600">Go to Applications</Button>
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  const statusConfig = getStatusConfig(application.status);
  const notesDirty = application ? (notesDraft ?? '') !== (application.recruiter_notes ?? '') : false;

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <Link
          href="/applications"
          className="inline-flex items-center text-gray-400 hover:text-white transition-colors"
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Applications
        </Link>
        <Badge variant="outline" className={statusConfig.bg + ' ' + statusConfig.color}>
          {statusConfig.label}
        </Badge>
      </div>

      {/* Main Content */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column - Main Info */}
        <div className="lg:col-span-2 space-y-6">
          {/* Candidate Info */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
          >
            <Card className="bg-white/5 border-white/10">
              <CardHeader>
                <CardTitle className="text-white flex items-center gap-3">
                  <Avatar className="h-12 w-12">
                    <AvatarImage src={application.candidates?.avatar_url || undefined} />
                    <AvatarFallback className="bg-gradient-to-br from-orange-500 to-amber-600 text-white">
                      <User className="h-6 w-6" />
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    <h2 className="text-xl font-semibold">
                      {application.candidates?.first_name && application.candidates?.last_name
                        ? `${application.candidates.first_name} ${application.candidates.last_name}`
                        : 'Candidate Information'}
                    </h2>
                    <Link
                      href={`/talent/${application.candidate_id}`}
                      className="text-sm text-orange-400 hover:text-orange-300"
                    >
                      View Full Profile →
                    </Link>
                  </div>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div className="flex items-center gap-2 text-gray-300">
                    <Briefcase className="h-4 w-4" />
                    <span>Job: {application.jobs?.title || application.job_id}</span>
                  </div>
                  {application.candidates?.email && (
                    <div className="flex items-center gap-2 text-gray-300">
                      <Mail className="h-4 w-4" />
                      <span>{application.candidates.email}</span>
                    </div>
                  )}
                  {application.candidates?.phone && (
                    <div className="flex items-center gap-2 text-gray-300">
                      <Phone className="h-4 w-4" />
                      <span>{application.candidates.phone}</span>
                    </div>
                  )}
                  {application.candidates?.location && (
                    <div className="flex items-center gap-2 text-gray-300">
                      <MapPin className="h-4 w-4" />
                      <span>{application.candidates.location}</span>
                    </div>
                  )}
                  <div className="flex items-center gap-2 text-gray-300">
                    <Calendar className="h-4 w-4" />
                    <span>Applied: {new Date(application.created_at).toLocaleDateString()}</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.div>

          {/* Recruiter Notes */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
          >
            <Card className="bg-white/5 border-white/10">
              <CardHeader>
                <CardTitle className="text-white flex items-center gap-2">
                  <FileText className="h-5 w-5" />
                  Recruiter Notes
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <textarea
                  value={notesDraft}
                  onChange={(e) => setNotesDraft(e.target.value)}
                  rows={5}
                  placeholder="Add recruiter notes..."
                  className="w-full rounded-lg bg-white/5 border border-white/10 text-white placeholder:text-gray-500 p-3 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500/30"
                />
                <div className="flex items-center justify-between">
                  <div className="text-xs text-gray-500">
                    {application.reviewed_at ? `Reviewed: ${new Date(application.reviewed_at).toLocaleString()}` : 'Not reviewed yet'}
                  </div>
                  <Button
                    size="sm"
                    onClick={saveRecruiterNotes}
                    disabled={savingNotes || !notesDirty}
                    className="bg-orange-500/20 text-orange-400 hover:bg-orange-500/30 border border-orange-500/30"
                  >
                    {savingNotes ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : notesJustSaved ? (
                      'Saved'
                    ) : (
                      'Save Notes'
                    )}
                  </Button>
                </div>
              </CardContent>
            </Card>
          </motion.div>

          {/* Resume */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.15 }}
          >
            <Card className="bg-white/5 border-white/10">
              <CardHeader>
                <CardTitle className="text-white flex items-center gap-2">
                  <FileText className="h-5 w-5" />
                  Resume
                </CardTitle>
              </CardHeader>
              <CardContent className="flex items-center justify-between">
                <div className="text-sm text-gray-300">
                  {application.resume_file_name || (application.resume_url ? 'Resume available' : 'No resume uploaded')}
                </div>
                {application.resume_url && (
                  <a href={application.resume_url} target="_blank" rel="noreferrer">
                    <Button size="sm" variant="outline" className="border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/10">
                      Open Resume
                    </Button>
                  </a>
                )}
              </CardContent>
            </Card>
          </motion.div>

          {/* Recruiter Gate */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.18 }}
          >
            <Card className="bg-white/5 border-white/10">
              <CardHeader>
                <CardTitle className="text-white flex items-center gap-2">
                  <Building2 className="h-5 w-5" />
                  Release To Client (Recruiter Gate)
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="text-sm text-gray-300">
                    Visibility: {application.released_to_client ? 'Client can see this application' : 'Recruiter-only'}
                  </div>
                  <Badge variant="outline" className={application.released_to_client ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30' : 'bg-white/5 text-gray-400 border-white/10'}>
                    {application.released_to_client ? 'Released' : 'Hidden'}
                  </Badge>
                </div>
                <div className="text-sm text-gray-200 font-medium">Share Call Artifacts (Real Data)</div>
                {(() => {
                  const recruiterCalls = (application.calls || []).filter((c: any) =>
                    String(c?.call_type || '').startsWith('recruiter_')
                  );
                  if (recruiterCalls.length === 0) {
                    return <div className="text-xs text-gray-500">No recruiter calls yet. After a call is recorded, it will appear here for sharing.</div>;
                  }
                  return (
                    <div className="space-y-3">
                      {recruiterCalls.map((c: any) => {
                        const roomId = String(c.id);
                        const label = CALL_TYPE_LABELS[String(c.call_type || '')] || String(c.call_type || 'Call');
                        const title = c.call_title || c.title || label;
                        const prefs = shareByRoom[roomId] || { shareWithClient: false, shareWithCandidate: false };

                        // Check what data is available for this call
                        const hasRecording = (c.recordings && c.recordings.length > 0);
                        const hasNotes = !!(c.notes && c.notes.trim());
                        const hasTranscript = (c.transcripts && c.transcripts.some((t: any) => t.status === 'completed' && t.full_text));
                        const callEnded = c.status === 'ended' || c.ended_at;

                        return (
                          <div key={roomId} className="rounded-lg border border-white/10 bg-black/20 p-3">
                            <div className="flex items-center justify-between">
                              <div className="text-sm text-white/90 font-semibold">{title}</div>
                              <Badge 
                                variant="outline" 
                                className={callEnded 
                                  ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30 text-xs' 
                                  : 'bg-yellow-500/10 text-yellow-400 border-yellow-500/30 text-xs'
                                }
                              >
                                {callEnded ? 'Completed' : 'In Progress'}
                              </Badge>
                            </div>
                            <div className="text-xs text-white/60 mt-0.5">
                              {label}
                              {c.created_at ? ` • ${new Date(c.created_at).toLocaleString()}` : ''}
                            </div>

                            {/* Available Data Indicators */}
                            <div className="mt-2 flex flex-wrap gap-2">
                              <div className={`flex items-center gap-1 text-xs px-2 py-1 rounded-full ${
                                hasRecording 
                                  ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30' 
                                  : 'bg-gray-500/10 text-gray-500 border border-gray-500/30'
                              }`}>
                                {hasRecording ? '✓' : '✗'} Video
                              </div>
                              <div className={`flex items-center gap-1 text-xs px-2 py-1 rounded-full ${
                                hasNotes 
                                  ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30' 
                                  : 'bg-gray-500/10 text-gray-500 border border-gray-500/30'
                              }`}>
                                {hasNotes ? '✓' : '✗'} Notes
                              </div>
                              <div className={`flex items-center gap-1 text-xs px-2 py-1 rounded-full ${
                                hasTranscript 
                                  ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30' 
                                  : 'bg-gray-500/10 text-gray-500 border border-gray-500/30'
                              }`}>
                                {hasTranscript ? '✓' : '✗'} Transcript
                              </div>
                            </div>

                            <div className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-3">
                              <div className="flex items-center justify-between rounded-md border border-white/10 bg-white/5 p-2">
                                <div>
                                  <div className="text-xs text-white/70">Share with Client</div>
                                  <div className="text-xs text-white/50">Shares video + notes + transcript</div>
                                </div>
                                <Checkbox
                                  checked={!!prefs.shareWithClient}
                                  onCheckedChange={(v) =>
                                    setShareByRoom((prev) => ({
                                      ...prev,
                                      [roomId]: { ...prefs, shareWithClient: v === true },
                                    }))
                                  }
                                />
                              </div>
                              <div className="flex items-center justify-between rounded-md border border-white/10 bg-white/5 p-2">
                                <div>
                                  <div className="text-xs text-white/70">Share with Candidate</div>
                                  <div className="text-xs text-white/50">Shares video + notes + transcript</div>
                                </div>
                                <Checkbox
                                  checked={!!prefs.shareWithCandidate}
                                  onCheckedChange={(v) =>
                                    setShareByRoom((prev) => ({
                                      ...prev,
                                      [roomId]: { ...prefs, shareWithCandidate: v === true },
                                    }))
                                  }
                                />
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  );
                })()}
                <div className="flex flex-col gap-2 pt-1">
                  {(() => {
                    // Check if any call has been completed (has ended or has recordings)
                    const hasCompletedCall = (application.calls || []).some((call: any) => 
                      call.status === 'ended' || 
                      call.ended_at || 
                      (call.recordings && call.recordings.length > 0)
                    );
                    
                    if (application.status === 'rejected') {
                      return (
                        <div className="w-full p-2 rounded-lg bg-red-500/10 border border-red-500/20">
                          <p className="text-red-400 text-xs text-center">
                            Cannot release rejected applications to client
                          </p>
                        </div>
                      );
                    }
                    
                    if (!hasCompletedCall) {
                      return (
                        <div className="w-full p-2 rounded-lg bg-yellow-500/10 border border-yellow-500/20">
                          <p className="text-yellow-400 text-xs text-center">
                            Complete at least one video call before releasing to client
                          </p>
                        </div>
                      );
                    }
                    
                    // If already released, show success state with only Hide option
                    if (application?.released_to_client) {
                      return (
                        <div className="flex flex-col gap-2">
                          <div className="w-full p-2 rounded-lg bg-emerald-500/10 border border-emerald-500/20">
                            <p className="text-emerald-400 text-xs text-center">
                              ✓ Application released to client
                            </p>
                          </div>
                          <Button
                            onClick={() => handleReleaseToClient(false)}
                            disabled={releaseLoading}
                            variant="outline"
                            className="w-full border-orange-500/30 text-orange-400 hover:bg-orange-500/10"
                          >
                            {releaseLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Hide from Client'}
                          </Button>
                        </div>
                      );
                    }
                    
                    return (
                      <Button
                        onClick={() => handleReleaseToClient(true)}
                        disabled={releaseLoading}
                        className="w-full bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30 border border-emerald-500/30"
                      >
                        {releaseLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Release To Client'}
                      </Button>
                    );
                  })()}
                </div>
              </CardContent>
            </Card>
          </motion.div>

          {/* Client Feedback - Only show after released to client */}
          {application.released_to_client && (application.client_notes || application.client_rating || true) && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
            >
              <ClientFeedback
                applicationId={application.id}
                notes={application.client_notes}
                rating={application.client_rating}
                onUpdate={handleUpdate}
                editable={false}
              />
            </motion.div>
          )}

          {/* Rejection Info */}
          {application.status === 'rejected' && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
            >
              <RejectionInfo
                applicationId={application.id}
                rejectionReason={application.rejection_reason}
                rejectedBy={application.rejected_by}
                rejectedDate={application.rejected_date}
                onUpdate={handleUpdate}
                editable={true}
              />
            </motion.div>
          )}

          {/* Hired Status */}
          {(application.offer_acceptance_date ||
            application.contract_signed ||
            application.first_day_date ||
            application.started_status) && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4 }}
            >
              <HiredStatus
                applicationId={application.id}
                offerAcceptanceDate={application.offer_acceptance_date}
                contractSigned={application.contract_signed}
                firstDayDate={application.first_day_date}
                startedStatus={application.started_status}
                onUpdate={handleUpdate}
                editable={true}
              />
            </motion.div>
          )}

          {/* Onboarding Task Manager - Only show if hired */}
          {application.status === 'hired' && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.45 }}
            >
              <OnboardingTaskManager
                applicationId={application.id}
                candidateName={
                  application.candidates?.first_name && application.candidates?.last_name
                    ? `${application.candidates.first_name} ${application.candidates.last_name}`
                    : 'Candidate'
                }
                jobTitle={application.jobs?.title || 'Position'}
                onTaskUpdated={handleUpdate}
              />
            </motion.div>
          )}

          {/* Call Artifacts (Rooms → Recordings → Transcripts) */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.48 }}
          >
            <CallArtifacts rooms={application.calls || []} allowTranscribe onDataChanged={handleUpdate} />
          </motion.div>

          {/* Activity Timeline */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5 }}
          >
            <ActivityTimeline events={application.timeline || []} loading={false} />
          </motion.div>
        </div>

        {/* Right Column - Quick Actions */}
        <div className="space-y-6">
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.2 }}
          >
            <Card className="bg-white/5 border-white/10">
              <CardHeader>
                <CardTitle className="text-white">Quick Actions</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {(() => {
                  // Define stage-based button visibility
                  const status = application.status;
                  const isRejected = status === 'rejected';
                  const isHired = status === 'hired' || status === 'offer_accepted';
                  const isOfferStage = status === 'offer_sent' || status === 'offer_accepted';
                  const isInterviewStage = ['shortlisted', 'interview_scheduled', 'bpoc_round_1', 'bpoc_round_2', 'client_interview', 'interviewed'].includes(status);
                  const isEarlyStage = ['submitted', 'under_review', 'shortlisted'].includes(status);
                  
                  return (
                    <>
                      {/* Status-based notices */}
                      {isRejected && (
                        <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/20 mb-2">
                          <p className="text-red-400 text-sm text-center font-medium">
                            This application has been rejected. Actions are disabled.
                          </p>
                        </div>
                      )}
                      
                      {isHired && (
                        <div className="p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/20 mb-2">
                          <p className="text-emerald-400 text-sm text-center font-medium">
                            🎉 Candidate has accepted the offer!
                          </p>
                        </div>
                      )}

                      {isOfferStage && !isHired && (
                        <div className="p-3 rounded-lg bg-yellow-500/10 border border-yellow-500/20 mb-2">
                          <p className="text-yellow-400 text-sm text-center font-medium">
                            Offer sent - awaiting candidate response
                          </p>
                        </div>
                      )}

                      {/* Call Button - Always show unless rejected */}
                      {!isRejected ? (
                        <VideoCallButton
                          candidateUserId={application.candidate_id}
                          candidateName={
                            application.candidates?.first_name && application.candidates?.last_name
                              ? `${application.candidates.first_name} ${application.candidates.last_name}`
                              : 'Candidate'
                          }
                          candidateEmail={application.candidates?.email}
                          candidateAvatar={application.candidates?.avatar_url}
                          jobId={application.job_id}
                          jobTitle={application.jobs?.title}
                          applicationId={application.id}
                          context="all"
                          variant="default"
                          className="w-full justify-center"
                        />
                      ) : (
                        <Button
                          disabled
                          className="w-full justify-center bg-gray-500/10 text-gray-500 border border-gray-500/20 cursor-not-allowed"
                        >
                          <Calendar className="h-4 w-4 mr-2" />
                          General Call
                        </Button>
                      )}

                      {/* Early Stage Actions: Review & Shortlist - Only for early stages */}
                      {isEarlyStage && !isRejected && (
                        <div className="grid grid-cols-2 gap-2">
                          <Button
                            variant="outline"
                            className={`w-full justify-center ${
                              status === 'under_review' || status === 'shortlisted'
                                ? 'border-gray-500/20 text-gray-500 cursor-not-allowed'
                                : 'border-cyan-500/30 text-cyan-300 hover:bg-cyan-500/10'
                            }`}
                            onClick={() => updateApplicationStatus('under_review')}
                            disabled={!!statusLoading || status === 'under_review' || status === 'shortlisted'}
                            title={status === 'shortlisted' ? 'Already shortlisted' : 'Mark as Under Review'}
                          >
                            {statusLoading === 'under_review' ? (
                              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                            ) : (
                              <FileText className="h-4 w-4 mr-2" />
                            )}
                            Review
                          </Button>
                          <Button
                            variant="outline"
                            className={`w-full justify-center ${
                              status === 'shortlisted'
                                ? 'border-gray-500/20 text-gray-500 cursor-not-allowed'
                                : 'border-purple-500/30 text-purple-300 hover:bg-purple-500/10'
                            }`}
                            onClick={() => updateApplicationStatus('shortlisted')}
                            disabled={!!statusLoading || status === 'shortlisted'}
                            title={status === 'shortlisted' ? 'Already shortlisted' : 'Shortlist candidate'}
                          >
                            {statusLoading === 'shortlisted' ? (
                              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                            ) : (
                              <Star className="h-4 w-4 mr-2" />
                            )}
                            Shortlist
                          </Button>
                        </div>
                      )}

                      {/* Interview Stage Actions */}
                      {isInterviewStage && !isRejected && (
                        <div className="grid grid-cols-2 gap-2">
                          <Link href="/interviews" className="w-full">
                            <Button variant="outline" className="w-full justify-center border-orange-500/30 text-orange-300 hover:bg-orange-500/10">
                              <Calendar className="h-4 w-4 mr-2" />
                              View Interviews
                            </Button>
                          </Link>
                          <Button
                            variant="outline"
                            className="w-full justify-center border-emerald-500/30 text-emerald-300 hover:bg-emerald-500/10"
                            onClick={() => updateApplicationStatus('offer_sent')}
                            disabled={!!statusLoading}
                          >
                            {statusLoading === 'offer_sent' ? (
                              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                            ) : (
                              <Star className="h-4 w-4 mr-2" />
                            )}
                            Send Offer
                          </Button>
                        </div>
                      )}

                      {/* Offer Stage Actions */}
                      {isOfferStage && !isHired && !isRejected && (
                        <div className="grid grid-cols-2 gap-2">
                          <Link href="/offers" className="w-full">
                            <Button variant="outline" className="w-full justify-center border-yellow-500/30 text-yellow-300 hover:bg-yellow-500/10">
                              <FileText className="h-4 w-4 mr-2" />
                              View Offer
                            </Button>
                          </Link>
                          <Button
                            variant="outline"
                            className="w-full justify-center border-red-500/30 text-red-300 hover:bg-red-500/10"
                            onClick={() => updateApplicationStatus('rejected')}
                            disabled={!!statusLoading}
                          >
                            Withdraw Offer
                          </Button>
                        </div>
                      )}

                      {/* Hired Stage Actions */}
                      {isHired && (
                        <div className="grid grid-cols-2 gap-2">
                          <Link href="/onboarding" className="w-full">
                            <Button variant="outline" className="w-full justify-center border-emerald-500/30 text-emerald-300 hover:bg-emerald-500/10">
                              <FileText className="h-4 w-4 mr-2" />
                              View Onboarding
                            </Button>
                          </Link>
                          <Link href="/placements" className="w-full">
                            <Button variant="outline" className="w-full justify-center border-purple-500/30 text-purple-300 hover:bg-purple-500/10">
                              <Briefcase className="h-4 w-4 mr-2" />
                              View Placement
                            </Button>
                          </Link>
                        </div>
                      )}

                      {/* Schedule & Profile - Always show for non-hired, non-offer stages */}
                      {!isHired && !isOfferStage && (
                        <div className="grid grid-cols-2 gap-2">
                          <Button
                            variant="outline"
                            className={`w-full justify-center ${
                              isRejected
                                ? 'border-gray-500/20 text-gray-500 cursor-not-allowed'
                                : 'border-orange-500/30 text-orange-300 hover:bg-orange-500/10'
                            }`}
                            onClick={() => !isRejected && setShowSchedulerModal(true)}
                            disabled={isRejected}
                          >
                            <Calendar className="h-4 w-4 mr-2" />
                            Schedule
                          </Button>
                          <Link href={`/talent/${application.candidate_id}`} className="w-full">
                            <Button variant="outline" className="w-full justify-center border-blue-500/30 text-blue-300 hover:bg-blue-500/10">
                              <User className="h-4 w-4 mr-2" />
                              Profile
                            </Button>
                          </Link>
                        </div>
                      )}

                      {/* Profile only for hired/offer stages */}
                      {(isHired || isOfferStage) && (
                        <Link href={`/talent/${application.candidate_id}`} className="w-full">
                          <Button variant="outline" className="w-full justify-center border-blue-500/30 text-blue-300 hover:bg-blue-500/10">
                            <User className="h-4 w-4 mr-2" />
                            View Full Profile
                          </Button>
                        </Link>
                      )}
                    </>
                  );
                })()}

                {/* Schedule Interview Expanded Panel (only when not rejected) */}
                {scheduleOpen && application.status !== 'rejected' && (
                  <div className="space-y-2 rounded-lg border border-white/10 bg-black/20 p-3">
                    <div className="text-sm text-gray-300">Interview Type</div>
                    <select
                      value={scheduleType}
                      onChange={(e) => setScheduleType(e.target.value)}
                      className="w-full rounded-md bg-white/5 border border-white/10 text-white p-2 text-sm"
                    >
                      <option value="recruiter_prescreen">Pre-Screen</option>
                      <option value="recruiter_round_1">Recruiter Round 1</option>
                      <option value="recruiter_round_2">Recruiter Round 2</option>
                      <option value="recruiter_round_3">Recruiter Round 3</option>
                      <option value="recruiter_general">Recruiter General</option>
                      <option value="client_round_1">Client Round 1</option>
                      <option value="client_round_2">Client Round 2</option>
                      <option value="client_final">Client Final</option>
                      <option value="client_general">Client General</option>
                    </select>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <div className="text-sm text-gray-300">When</div>
                        <Input
                          type="datetime-local"
                          value={scheduleAt}
                          onChange={(e) => setScheduleAt(e.target.value)}
                          className="bg-white/5 border-white/10 text-white"
                        />
                      </div>
                      <div>
                        <div className="text-sm text-gray-300">Duration (min)</div>
                        <Input
                          type="number"
                          value={scheduleDuration}
                          min={15}
                          step={15}
                          onChange={(e) => setScheduleDuration(parseInt(e.target.value || '30', 10))}
                          className="bg-white/5 border-white/10 text-white"
                        />
                      </div>
                    </div>
                    <div>
                      <div className="text-sm text-gray-300">Client Timezone (IANA)</div>
                      <Input
                        value={scheduleTz}
                        onChange={(e) => setScheduleTz(e.target.value)}
                        placeholder="e.g., America/New_York"
                        className="bg-white/5 border-white/10 text-white"
                      />
                    </div>
                    <Button onClick={handleScheduleInterview} className="w-full bg-orange-500 hover:bg-orange-600">
                      Save Interview
                    </Button>
                  </div>
                )}
                {/* Rejection Info - only show for early/interview stages (not hired, offer_accepted, or already rejected) */}
                {(() => {
                  const status = application.status;
                  const hideRejection = ['rejected', 'hired', 'offer_accepted', 'offer_sent'].includes(status);
                  if (hideRejection) return null;
                  
                  return (
                    <RejectionInfo
                      applicationId={application.id}
                      rejectionReason={application.rejection_reason}
                      rejectedBy={application.rejected_by}
                      rejectedDate={application.rejected_date}
                      onUpdate={handleUpdate}
                      editable={true}
                    />
                  );
                })()}
              </CardContent>
            </Card>
          </motion.div>
        </div>
      </div>

      {/* Interview Scheduler Modal */}
      {application && (
        <InterviewSchedulerModal
          isOpen={showSchedulerModal}
          onClose={() => setShowSchedulerModal(false)}
          onSuccess={handleUpdate}
          applicationId={application.id}
          candidateId={application.candidate_id}
          candidateName={
            application.candidates?.first_name && application.candidates?.last_name
              ? `${application.candidates.first_name} ${application.candidates.last_name}`
              : 'Candidate'
          }
        />
      )}
    </div>
  );
}


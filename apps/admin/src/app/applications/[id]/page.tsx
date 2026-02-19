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
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/shared/ui/card';
import { Button } from '@/components/shared/ui/button';
import { Badge } from '@/components/shared/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/shared/ui/avatar';
import Link from 'next/link';
import { toast } from '@/components/shared/ui/toast';
import { ActivityTimeline, ActivityEvent } from '@/components/shared/application/ActivityTimeline';
import { ClientFeedback } from '@/components/shared/application/ClientFeedback';
import { RejectionInfo } from '@/components/shared/application/RejectionInfo';
import { HiredStatus } from '@/components/shared/application/HiredStatus';
import { CallArtifacts, type CallArtifactRoom } from '@/components/shared/application/CallArtifacts';

interface ApplicationCard {
  id: string;
  candidate_id: string;
  job_id: string;
  status: string;
  recruiter_notes?: string | null;
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

export default function AdminApplicationDetailPage() {
  const params = useParams();
  const router = useRouter();
  const applicationId = params.id as string;

  const [loading, setLoading] = useState(true);
  const [application, setApplication] = useState<ApplicationCard | null>(null);

  useEffect(() => {
    if (applicationId) {
      fetchApplication();
    }
  }, [applicationId]);

  const fetchApplication = async () => {
    try {
      const response = await fetch(`/api/applications/${applicationId}`);

      const data = await response.json();

      if (response.ok && data.application) {
        const app = data.application;
        setApplication({
          id: app.id,
          candidate_id: app.candidate_id,
          job_id: app.job_id,
          status: app.status,
          recruiter_notes: app.recruiter_notes,
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
          timeline: app.timeline || [],
          interviews: app.interviews || [],
          offers: app.offers || [],
          calls: app.calls || [],
          candidates: app.candidates,
          jobs: app.jobs,
        });
      } else {
        toast.error('Application not found');
        router.push('/applications');
      }
    } catch (error) {
      console.error('Failed to fetch application:', error);
      toast.error('Failed to load application');
    } finally {
      setLoading(false);
    }
  };

  const handleUpdate = () => {
    fetchApplication();
  };

  const getStatusConfig = (status: string) => {
    const configs: Record<string, { label: string; color: string; bg: string }> = {
      invited: { label: 'Invited', color: 'text-slate-300', bg: 'bg-slate-500/10 border-slate-500/30' },
      submitted: { label: 'Submitted', color: 'text-blue-400', bg: 'bg-blue-500/10 border-blue-500/30' },
      under_review: { label: 'Under Review', color: 'text-cyan-400', bg: 'bg-cyan-500/10 border-cyan-500/30' },
      shortlisted: { label: 'Shortlisted', color: 'text-purple-400', bg: 'bg-purple-500/10 border-purple-500/30' },
      interview_scheduled: { label: 'Interview Scheduled', color: 'text-orange-400', bg: 'bg-orange-500/10 border-orange-500/30' },
      interviewed: { label: 'Interviewed', color: 'text-indigo-300', bg: 'bg-indigo-500/10 border-indigo-500/30' },
      offer_pending: { label: 'Offer Pending', color: 'text-amber-300', bg: 'bg-amber-500/10 border-amber-500/30' },
      offer_sent: { label: 'Offer Sent', color: 'text-yellow-400', bg: 'bg-yellow-500/10 border-yellow-500/30' },
      offer_accepted: { label: 'Offer Accepted', color: 'text-emerald-300', bg: 'bg-emerald-500/10 border-emerald-500/30' },
      hired: { label: 'Hired', color: 'text-emerald-400', bg: 'bg-emerald-500/10 border-emerald-500/30' },
      rejected: { label: 'Rejected', color: 'text-red-400', bg: 'bg-red-500/10 border-red-500/30' },
      withdrawn: { label: 'Withdrawn', color: 'text-gray-400', bg: 'bg-gray-500/10 border-gray-500/30' },
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
    return null;
  }

  const statusConfig = getStatusConfig(application.status);

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <Link
          href="/admin/applications"
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
                    <AvatarImage src={application.candidates?.avatar_url} />
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
          {application.recruiter_notes && (
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
                <CardContent>
                  <p className="text-gray-300 whitespace-pre-wrap">{application.recruiter_notes}</p>
                </CardContent>
              </Card>
            </motion.div>
          )}

          {/* Client Feedback */}
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
                editable={false}
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
                editable={false}
              />
            </motion.div>
          )}

          {/* Call Artifacts (Rooms → Recordings → Transcripts) */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.48 }}
          >
            <CallArtifacts rooms={application.calls || []} />
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

        {/* Right Column intentionally omitted: Admin view is read-only oversight */}
      </div>
    </div>
  );
}


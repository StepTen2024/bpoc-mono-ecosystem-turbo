'use client';

import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { useParams, useRouter } from 'next/navigation';
import {
  ArrowLeft,
  User,
  Mail,
  Phone,
  MapPin,
  Briefcase,
  Star,
  FileText,
  Brain,
  Gamepad2,
  Loader2,
  Download,
  Calendar,
  Clock,
  Award,
  Target,
  X,
  ExternalLink
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/shared/ui/card';
import { Button } from '@/components/shared/ui/button';
import { Badge } from '@/components/shared/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/shared/ui/avatar';
import Link from 'next/link';
import { useAuth } from '@/contexts/AuthContext';
import { getSessionToken } from '@/lib/auth-helpers';
import { toast } from '@/components/shared/ui/toast';
import { VideoCallButton } from '@/components/video';

interface CandidateProfile {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phone?: string;
  avatarUrl?: string;
  headline?: string;
  location?: string;
  username?: string;
  createdAt: string;
  profile?: {
    bio?: string;
    experienceYears?: number;
    currentRole?: string;
    targetRole?: string;
    expectedSalary?: number;
    availability?: string;
  };
  skills: string[];
  resume?: {
    id: string;
    fileName: string;
    uploadedAt: string;
  };
  aiAnalysis?: {
    overallScore?: number;
    strengths?: string[];
    weaknesses?: string[];
    recommendations?: string[];
    summary?: string;
  };
  discAssessment?: {
    type: string;
    dominance: number;
    influence: number;
    steadiness: number;
    conscientiousness: number;
    completedAt: string;
  };
}

export default function CandidateProfilePage() {
  const params = useParams();
  const router = useRouter();
  const candidateId = params.id as string;
  const { user } = useAuth();
  
  const [loading, setLoading] = useState(true);
  const [candidate, setCandidate] = useState<CandidateProfile | null>(null);
  const [showInvite, setShowInvite] = useState(false);
  const [inviting, setInviting] = useState(false);
  const [inviteMessage, setInviteMessage] = useState('');
  const [clients, setClients] = useState<Array<{ id: string; name: string }>>([]);
  const [jobs, setJobs] = useState<Array<{ id: string; title: string; clientId: string; clientName: string; status: string }>>([]);
  const [selectedClientId, setSelectedClientId] = useState<string>('');
  const [selectedJobId, setSelectedJobId] = useState<string>('');

  useEffect(() => {
    if (user?.id && candidateId) {
      fetchCandidate();
    }
  }, [user?.id, candidateId]);

  const fetchCandidate = async () => {
    try {
      const token = await getSessionToken();
      const response = await fetch(`/api/recruiter/talent/${candidateId}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'x-user-id': user?.id || '',
        }
      });
      
      const data = await response.json();
      
      if (response.ok && data.candidate) {
        setCandidate(data.candidate);
      } else {
        toast.error('Candidate not found');
        router.push('/recruiter/talent');
      }
    } catch (error) {
      console.error('Failed to fetch candidate:', error);
      toast.error('Failed to load candidate');
    } finally {
      setLoading(false);
    }
  };

  const fetchInviteData = async () => {
    try {
      const token = await getSessionToken();
      const [clientsRes, jobsRes] = await Promise.all([
        fetch('/api/recruiter/clients', {
          headers: { 'Authorization': `Bearer ${token}`, 'x-user-id': user?.id || '' },
        }),
        fetch('/api/recruiter/jobs?status=active', {
          headers: { 'Authorization': `Bearer ${token}`, 'x-user-id': user?.id || '' },
        }),
      ]);

      const clientsJson = await clientsRes.json();
      const jobsJson = await jobsRes.json();

      const clientList = (clientsJson.clients || [])
        .filter((c: any) => c?.company?.name)
        .map((c: any) => ({ id: c.id, name: c.company.name as string }))
        .sort((a: any, b: any) => a.name.localeCompare(b.name));

      const jobList = (jobsJson.jobs || []).map((j: any) => ({
        id: j.id,
        title: j.title,
        clientId: j.agencyClientId || j.agency_client_id || '',
        clientName: j.clientName || 'Unknown Client',
        status: j.status,
      }));

      setClients(clientList);
      setJobs(jobList);
    } catch (e) {
      console.error('Failed to load invite data:', e);
      toast.error('Failed to load clients/jobs');
    }
  };

  const openInviteModal = async () => {
    setShowInvite(true);
    await fetchInviteData();
  };

  const submitInvite = async () => {
    if (!candidate) return;
    if (!selectedJobId) {
      toast.error('Select a job to invite to');
      return;
    }
    setInviting(true);
    try {
      const token = await getSessionToken();
      const res = await fetch('/api/recruiter/invitations/job', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
          'x-user-id': user?.id || '',
        },
        body: JSON.stringify({
          candidateId: candidate.id,
          jobId: selectedJobId,
          message: inviteMessage,
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        toast.error(json.error || 'Failed to invite');
        return;
      }
      toast.success('Invitation sent');
      setShowInvite(false);
      setInviteMessage('');
      setSelectedClientId('');
      setSelectedJobId('');
    } finally {
      setInviting(false);
    }
  };

  const getDISCDescription = (type: string) => {
    const descriptions: Record<string, string> = {
      D: 'Dominance - Results-oriented, decisive, competitive',
      I: 'Influence - Enthusiastic, optimistic, collaborative',
      S: 'Steadiness - Patient, reliable, team-oriented',
      C: 'Conscientiousness - Analytical, systematic, quality-focused',
    };
    return descriptions[type] || type;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 text-orange-400 animate-spin" />
      </div>
    );
  }

  if (!candidate) {
    return null;
  }

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      {/* Header */}
      <Link href="/recruiter/talent" className="inline-flex items-center text-gray-400 hover:text-white">
        <ArrowLeft className="h-4 w-4 mr-2" />
        Back to Talent Pool
      </Link>

      {/* Profile Header */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
      >
        <Card className="bg-gradient-to-br from-orange-500/10 to-amber-500/5 border-orange-500/30">
          <CardContent className="p-8">
            <div className="flex items-start gap-6">
              <Avatar className="h-24 w-24">
                <AvatarImage src={candidate.avatarUrl} />
                <AvatarFallback className="bg-gradient-to-br from-orange-500 to-amber-600 text-white text-2xl">
                  {candidate.firstName[0]}{candidate.lastName[0]}
                </AvatarFallback>
              </Avatar>
              
              <div className="flex-1">
                <div className="flex items-start justify-between">
                  <div>
                    <h1 className="text-3xl font-bold text-white">
                      {candidate.firstName} {candidate.lastName}
                    </h1>
                    <p className="text-gray-400 text-lg mt-1">
                      {candidate.headline || candidate.profile?.currentRole || 'Candidate'}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <VideoCallButton
                      candidateUserId={candidate.id}
                      candidateName={`${candidate.firstName} ${candidate.lastName}`}
                      candidateEmail={candidate.email}
                      candidateAvatar={candidate.avatarUrl}
                      variant="default"
                      context="talent_pool"
                    />
                    <Button
                      className="bg-gradient-to-r from-orange-500 to-amber-600"
                      onClick={openInviteModal}
                    >
                      <Briefcase className="h-4 w-4 mr-2" />
                      Invite to Job
                    </Button>
                  </div>
                </div>

                <div className="flex flex-wrap gap-4 mt-4">
                  <span className="flex items-center gap-2 text-gray-400">
                    <Mail className="h-4 w-4" />
                    {candidate.email}
                  </span>
                  {candidate.phone && (
                    <span className="flex items-center gap-2 text-gray-400">
                      <Phone className="h-4 w-4" />
                      {candidate.phone}
                    </span>
                  )}
                  {candidate.location && (
                    <span className="flex items-center gap-2 text-gray-400">
                      <MapPin className="h-4 w-4" />
                      {candidate.location}
                    </span>
                  )}
                </div>

                {/* Quick Stats */}
                <div className="flex gap-3 mt-4">
                  {candidate.profile?.experienceYears && (
                    <Badge variant="outline" className="bg-white/5 text-gray-300 border-white/20">
                      <Briefcase className="h-3 w-3 mr-1" />
                      {candidate.profile.experienceYears} years exp
                    </Badge>
                  )}
                  {candidate.resume && (
                    <Badge variant="outline" className="bg-cyan-500/10 text-cyan-400 border-cyan-500/30">
                      <FileText className="h-3 w-3 mr-1" />
                      Resume
                    </Badge>
                  )}
                  {candidate.aiAnalysis && (
                    <Badge variant="outline" className="bg-purple-500/10 text-purple-400 border-purple-500/30">
                      <Brain className="h-3 w-3 mr-1" />
                      AI Analyzed
                    </Badge>
                  )}
                  {candidate.discAssessment && (
                    <Badge variant="outline" className="bg-orange-500/10 text-orange-400 border-orange-500/30">
                      <Target className="h-3 w-3 mr-1" />
                      DISC: {candidate.discAssessment.type}
                    </Badge>
                  )}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </motion.div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Content */}
        <div className="lg:col-span-2 space-y-6">
          {/* Bio */}
          {candidate.profile?.bio && (
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
              <Card className="bg-white/5 border-white/10">
                <CardHeader>
                  <CardTitle className="text-white flex items-center gap-2">
                    <User className="h-5 w-5 text-orange-400" />
                    About
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-gray-300 leading-relaxed">{candidate.profile.bio}</p>
                </CardContent>
              </Card>
            </motion.div>
          )}

          {/* Skills */}
          {candidate.skills.length > 0 && (
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}>
              <Card className="bg-white/5 border-white/10">
                <CardHeader>
                  <CardTitle className="text-white flex items-center gap-2">
                    <Award className="h-5 w-5 text-orange-400" />
                    Skills
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex flex-wrap gap-2">
                    {candidate.skills.map((skill) => (
                      <Badge key={skill} variant="outline" className="bg-white/5 text-gray-300 border-white/20">
                        {skill}
                      </Badge>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          )}

          {/* AI Analysis */}
          {candidate.aiAnalysis && (
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
              <Card className="bg-white/5 border-white/10">
                <CardHeader>
                  <CardTitle className="text-white flex items-center gap-2">
                    <Brain className="h-5 w-5 text-purple-400" />
                    AI Analysis
                    {candidate.aiAnalysis.overallScore && (
                      <Badge className="ml-auto bg-purple-500/20 text-purple-400 border-purple-500/30">
                        Score: {candidate.aiAnalysis.overallScore}/100
                      </Badge>
                    )}
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {candidate.aiAnalysis.summary && (
                    <div>
                      <p className="text-gray-300">{candidate.aiAnalysis.summary}</p>
                    </div>
                  )}
                  
                  {candidate.aiAnalysis.strengths && candidate.aiAnalysis.strengths.length > 0 && (
                    <div>
                      <h4 className="text-emerald-400 font-medium mb-2">Strengths</h4>
                      <ul className="space-y-1">
                        {candidate.aiAnalysis.strengths.map((s, i) => (
                          <li key={i} className="text-gray-400 text-sm flex items-start gap-2">
                            <span className="text-emerald-400">✓</span>
                            {s}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                  
                  {candidate.aiAnalysis.weaknesses && candidate.aiAnalysis.weaknesses.length > 0 && (
                    <div>
                      <h4 className="text-orange-400 font-medium mb-2">Areas for Improvement</h4>
                      <ul className="space-y-1">
                        {candidate.aiAnalysis.weaknesses.map((w, i) => (
                          <li key={i} className="text-gray-400 text-sm flex items-start gap-2">
                            <span className="text-orange-400">•</span>
                            {w}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </CardContent>
              </Card>
            </motion.div>
          )}

          {/* DISC Assessment */}
          {candidate.discAssessment && (
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.25 }}>
              <Card className="bg-white/5 border-white/10">
                <CardHeader>
                  <CardTitle className="text-white flex items-center gap-2">
                    <Target className="h-5 w-5 text-orange-400" />
                    DISC Personality Profile
                    <Badge className="ml-auto bg-orange-500/20 text-orange-400 border-orange-500/30 text-lg px-3">
                      {candidate.discAssessment.type}
                    </Badge>
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <p className="text-gray-400">{getDISCDescription(candidate.discAssessment.type)}</p>
                  
                  <div className="space-y-3">
                    {[
                      { label: 'Dominance', value: candidate.discAssessment.dominance, color: 'bg-red-500' },
                      { label: 'Influence', value: candidate.discAssessment.influence, color: 'bg-yellow-500' },
                      { label: 'Steadiness', value: candidate.discAssessment.steadiness, color: 'bg-green-500' },
                      { label: 'Conscientiousness', value: candidate.discAssessment.conscientiousness, color: 'bg-blue-500' },
                    ].map((trait) => (
                      <div key={trait.label}>
                        <div className="flex justify-between text-sm mb-1">
                          <span className="text-gray-400">{trait.label}</span>
                          <span className="text-white">{trait.value}%</span>
                        </div>
                        <div className="h-2 bg-white/10 rounded-full overflow-hidden">
                          <div 
                            className={`h-full ${trait.color} rounded-full transition-all`}
                            style={{ width: `${trait.value}%` }}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          )}
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Resume */}
          {candidate.resume && (
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}>
              <Card className="bg-white/5 border-white/10">
                <CardHeader>
                  <CardTitle className="text-white flex items-center gap-2">
                    <FileText className="h-5 w-5 text-cyan-400" />
                    Resume
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="p-4 rounded-lg bg-cyan-500/10 border border-cyan-500/20">
                    <p className="text-white font-medium truncate">{candidate.resume.fileName}</p>
                    <p className="text-gray-400 text-sm mt-1">
                      Uploaded {new Date(candidate.resume.uploadedAt).toLocaleDateString()}
                    </p>
                  </div>
                  <Button className="w-full mt-4 bg-cyan-500/20 text-cyan-400 hover:bg-cyan-500/30">
                    <Download className="h-4 w-4 mr-2" />
                    Download Resume
                  </Button>
                </CardContent>
              </Card>
            </motion.div>
          )}

          {/* Member Since */}
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
            <Card className="bg-white/5 border-white/10">
              <CardContent className="p-6">
                <div className="flex items-center gap-3 text-gray-400">
                  <Calendar className="h-5 w-5" />
                  <div>
                    <p className="text-white">Member since</p>
                    <p className="text-sm">{new Date(candidate.createdAt).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        </div>
      </div>

      {/* Invite to Job Modal */}
      {showInvite && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={() => setShowInvite(false)} />
          <div className="relative w-full max-w-xl mx-4 rounded-2xl bg-[#0a0a0f] border border-white/10 shadow-2xl">
            <div className="flex items-center justify-between px-6 py-4 border-b border-white/10">
              <div>
                <h3 className="text-white font-semibold text-lg">Invite to Job</h3>
                <p className="text-gray-400 text-sm">Invite {candidate.firstName} {candidate.lastName} to apply</p>
              </div>
              <button
                onClick={() => setShowInvite(false)}
                className="p-2 rounded-lg hover:bg-white/10 text-gray-400 hover:text-white"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="p-6 space-y-4">
              <div>
                <label className="block text-gray-400 text-sm mb-2">Client</label>
                <select
                  value={selectedClientId}
                  onChange={(e) => {
                    setSelectedClientId(e.target.value);
                    setSelectedJobId('');
                  }}
                  className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-lg text-white"
                >
                  <option value="">Select a client</option>
                  {clients.map((c) => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-gray-400 text-sm mb-2">Job</label>
                <select
                  value={selectedJobId}
                  onChange={(e) => setSelectedJobId(e.target.value)}
                  className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-lg text-white"
                >
                  <option value="">Select a job</option>
                  {jobs
                    .filter((j) => !selectedClientId || j.clientId === selectedClientId || j.clientName)
                    .map((j) => (
                      <option key={j.id} value={j.id}>
                        {j.title} ({j.clientName})
                      </option>
                    ))}
                </select>
                <p className="text-gray-500 text-xs mt-2">
                  If you don’t see jobs, ensure the client has at least one active job.
                </p>
              </div>

              <div>
                <label className="block text-gray-400 text-sm mb-2">Message (optional)</label>
                <textarea
                  value={inviteMessage}
                  onChange={(e) => setInviteMessage(e.target.value)}
                  rows={4}
                  placeholder="Add a short note to the candidate..."
                  className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-lg text-white placeholder:text-gray-500 focus:outline-none focus:border-orange-500/50 resize-none"
                />
              </div>
            </div>

            <div className="px-6 py-4 border-t border-white/10 flex gap-3 justify-end">
              <Button
                variant="outline"
                className="border-white/10 text-gray-300 hover:bg-white/5"
                onClick={() => setShowInvite(false)}
              >
                Cancel
              </Button>
              <Button
                className="bg-gradient-to-r from-orange-500 to-amber-600"
                disabled={inviting || !selectedJobId}
                onClick={submitInvite}
              >
                {inviting ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Send Invite'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}


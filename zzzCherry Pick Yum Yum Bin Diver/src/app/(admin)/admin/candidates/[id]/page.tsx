'use client';

import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { useParams, useRouter } from 'next/navigation';
import {
  ArrowLeft, User, Mail, Phone, MapPin, Briefcase, Star, FileText,
  Brain, Gamepad2, Loader2, Download, Calendar, Clock, Award, Target,
  MessageSquare, ExternalLink, CheckCircle, XCircle, Trophy, Eye
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/shared/ui/card';
import { Button } from '@/components/shared/ui/button';
import { Badge } from '@/components/shared/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/shared/ui/avatar';
import Link from 'next/link';
import { getSessionToken } from '@/lib/auth-helpers';
import { toast } from '@/components/shared/ui/toast';

interface CandidateDetail {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phone?: string;
  avatarUrl?: string;
  username?: string;
  isActive: boolean;
  emailVerified: boolean;
  createdAt: string;
  profile?: {
    bio?: string;
    headline?: string;
    location?: string;
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
  applications: {
    id: string;
    jobTitle: string;
    agencyName: string;
    status: string;
    appliedAt: string;
  }[];
  placements: {
    id: string;
    jobTitle: string;
    salary: number;
    startDate?: string;
    hiredAt: string;
  }[];
}

export default function AdminCandidateDetailPage() {
  const params = useParams();
  const router = useRouter();
  const candidateId = params.id as string;
  
  const [loading, setLoading] = useState(true);
  const [candidate, setCandidate] = useState<CandidateDetail | null>(null);

  useEffect(() => {
    if (candidateId) fetchCandidate();
  }, [candidateId]);

  const fetchCandidate = async () => {
    try {
      const token = await getSessionToken();
      const response = await fetch(`/api/admin/candidates/${candidateId}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      
      const data = await response.json();
      
      if (response.ok && data.candidate) {
        setCandidate(data.candidate);
      } else {
        toast.error('Candidate not found');
        router.push('/admin/candidates');
      }
    } catch (error) {
      console.error('Failed to fetch candidate:', error);
      toast.error('Failed to load candidate');
    } finally {
      setLoading(false);
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

  const getStatusBadge = (status: string) => {
    const styles: Record<string, string> = {
      submitted: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
      under_review: 'bg-cyan-500/20 text-cyan-400 border-cyan-500/30',
      shortlisted: 'bg-purple-500/20 text-purple-400 border-purple-500/30',
      interview_scheduled: 'bg-orange-500/20 text-orange-400 border-orange-500/30',
      hired: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
      rejected: 'bg-red-500/20 text-red-400 border-red-500/30',
    };
    return <Badge variant="outline" className={`${styles[status] || styles.submitted} capitalize`}>{status.replace('_', ' ')}</Badge>;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 text-cyan-400 animate-spin" />
      </div>
    );
  }

  if (!candidate) return null;

  return (
    <div className="space-y-6">
      {/* Back Button */}
      <Link href="/admin/candidates" className="inline-flex items-center text-gray-400 hover:text-white transition-colors">
        <ArrowLeft className="h-4 w-4 mr-2" />
        Back to Candidates
      </Link>

      {/* Profile Header */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
        <Card className="relative overflow-hidden bg-gradient-to-br from-purple-500/10 via-white/5 to-cyan-500/10 border-purple-500/30">
          <div className="absolute inset-0 bg-gradient-to-br from-purple-500/5 via-transparent to-cyan-500/5" />
          <CardContent className="relative z-10 p-8">
            <div className="flex items-start gap-6">
              <Avatar className="h-24 w-24">
                <AvatarImage src={candidate.avatarUrl} />
                <AvatarFallback className="bg-gradient-to-br from-purple-500 to-pink-600 text-white text-2xl">
                  {candidate.firstName[0]}{candidate.lastName[0]}
                </AvatarFallback>
              </Avatar>
              
              <div className="flex-1">
                <div className="flex items-start justify-between">
                  <div>
                    <div className="flex items-center gap-3 mb-2">
                      <h1 className="text-3xl font-bold text-white">
                        {candidate.firstName} {candidate.lastName}
                      </h1>
                      <Badge className={candidate.isActive 
                        ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30' 
                        : 'bg-red-500/20 text-red-400 border-red-500/30'
                      }>
                        {candidate.isActive ? 'Active' : 'Inactive'}
                      </Badge>
                      {candidate.emailVerified && (
                        <Badge className="bg-cyan-500/20 text-cyan-400 border-cyan-500/30">
                          <CheckCircle className="h-3 w-3 mr-1" />
                          Verified
                        </Badge>
                      )}
                    </div>
                    <p className="text-gray-400 text-lg">
                      {candidate.profile?.headline || candidate.profile?.currentRole || 'Candidate'}
                    </p>
                  </div>
                </div>

                {/* Contact Info */}
                <div className="flex flex-wrap gap-6 mt-4">
                  <a href={`mailto:${candidate.email}`} className="flex items-center gap-2 text-gray-400 hover:text-cyan-400 transition-colors">
                    <Mail className="h-4 w-4" />
                    {candidate.email}
                  </a>
                  {candidate.phone && (
                    <span className="flex items-center gap-2 text-gray-400">
                      <Phone className="h-4 w-4" />
                      {candidate.phone}
                    </span>
                  )}
                  {candidate.profile?.location && (
                    <span className="flex items-center gap-2 text-gray-400">
                      <MapPin className="h-4 w-4" />
                      {candidate.profile.location}
                    </span>
                  )}
                </div>

                {/* Quick Stats */}
                <div className="flex gap-4 mt-4">
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
                      AI Score: {candidate.aiAnalysis.overallScore || 'N/A'}
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

      <div className="grid grid-cols-3 gap-6">
        {/* Main Content */}
        <div className="col-span-2 space-y-6">
          {/* Bio */}
          {candidate.profile?.bio && (
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
              <Card className="bg-white/5 border-white/10">
                <CardHeader className="border-b border-white/10">
                  <CardTitle className="text-white flex items-center gap-2">
                    <User className="h-5 w-5 text-cyan-400" />
                    About
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-6">
                  <p className="text-gray-300 leading-relaxed">{candidate.profile.bio}</p>
                </CardContent>
              </Card>
            </motion.div>
          )}

          {/* Skills */}
          {candidate.skills.length > 0 && (
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}>
              <Card className="bg-white/5 border-white/10">
                <CardHeader className="border-b border-white/10">
                  <CardTitle className="text-white flex items-center gap-2">
                    <Award className="h-5 w-5 text-purple-400" />
                    Skills
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-6">
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

          {/* Applications */}
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
            <Card className="bg-white/5 border-white/10">
              <CardHeader className="border-b border-white/10">
                <CardTitle className="text-white flex items-center gap-2">
                  <FileText className="h-5 w-5 text-cyan-400" />
                  Applications ({candidate.applications?.length || 0})
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                {candidate.applications && candidate.applications.length > 0 ? (
                  <div className="divide-y divide-white/10">
                    {candidate.applications.map((app, i) => (
                      <motion.div
                        key={app.id}
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: i * 0.05 }}
                        className="p-4 flex items-center justify-between hover:bg-white/5 transition-all"
                      >
                        <div>
                          <p className="text-white font-medium">{app.jobTitle}</p>
                          <p className="text-gray-500 text-sm">{app.agencyName}</p>
                        </div>
                        <div className="flex items-center gap-4">
                          {getStatusBadge(app.status)}
                          <span className="text-gray-500 text-xs">
                            {new Date(app.appliedAt).toLocaleDateString()}
                          </span>
                        </div>
                      </motion.div>
                    ))}
                  </div>
                ) : (
                  <div className="p-8 text-center">
                    <FileText className="h-12 w-12 mx-auto mb-3 text-gray-600" />
                    <p className="text-gray-500">No applications yet</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </motion.div>

          {/* Placements */}
          {candidate.placements && candidate.placements.length > 0 && (
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.25 }}>
              <Card className="bg-gradient-to-br from-emerald-500/10 to-green-500/5 border-emerald-500/30">
                <CardHeader className="border-b border-emerald-500/20">
                  <CardTitle className="text-white flex items-center gap-2">
                    <Trophy className="h-5 w-5 text-yellow-400" />
                    Placements ({candidate.placements.length})
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                  <div className="divide-y divide-emerald-500/20">
                    {candidate.placements.map((placement, i) => (
                      <div key={placement.id} className="p-4 flex items-center justify-between">
                        <div>
                          <p className="text-white font-medium">{placement.jobTitle}</p>
                          <p className="text-emerald-400 font-semibold">
                            ₱{placement.salary.toLocaleString()}/month
                          </p>
                        </div>
                        <div className="text-right">
                          <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/30">
                            <CheckCircle className="h-3 w-3 mr-1" />
                            Hired
                          </Badge>
                          <p className="text-gray-500 text-xs mt-1">
                            {new Date(placement.hiredAt).toLocaleDateString()}
                          </p>
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
          {/* DISC Assessment */}
          {candidate.discAssessment && (
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
              <Card className="bg-white/5 border-white/10">
                <CardHeader className="border-b border-white/10">
                  <CardTitle className="text-white flex items-center gap-2">
                    <Target className="h-5 w-5 text-orange-400" />
                    DISC Profile
                    <Badge className="ml-auto bg-orange-500/20 text-orange-400 border-orange-500/30 text-lg px-3">
                      {candidate.discAssessment.type}
                    </Badge>
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-4 space-y-4">
                  <p className="text-gray-400 text-sm">{getDISCDescription(candidate.discAssessment.type)}</p>
                  
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

          {/* Candidate Info */}
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
            <Card className="bg-white/5 border-white/10">
              <CardHeader className="border-b border-white/10">
                <CardTitle className="text-white text-sm">Candidate Details</CardTitle>
              </CardHeader>
              <CardContent className="p-4 space-y-3">
                <div>
                  <p className="text-gray-500 text-xs">Candidate ID</p>
                  <p className="text-white font-mono text-sm break-all">{candidate.id}</p>
                </div>
                {candidate.username && (
                  <div>
                    <p className="text-gray-500 text-xs">Username</p>
                    <p className="text-gray-300 text-sm">@{candidate.username}</p>
                  </div>
                )}
                <div>
                  <p className="text-gray-500 text-xs">Member Since</p>
                  <p className="text-gray-300 text-sm">
                    {new Date(candidate.createdAt).toLocaleDateString('en-US', { 
                      month: 'long', day: 'numeric', year: 'numeric' 
                    })}
                  </p>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        </div>
      </div>
    </div>
  );
}


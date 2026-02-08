'use client';

import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import {
  User,
  MapPin,
  Briefcase,
  Mail,
  Phone,
  Calendar,
  Star,
  Trophy,
  Brain,
  FileText,
  Sparkles,
  Eye,
  ArrowLeft,
  ExternalLink,
  CheckCircle,
  Award,
  Zap,
  Clock,
  Globe
} from 'lucide-react';
import { Card, CardContent } from '@/components/shared/ui/card';
import { Button } from '@/components/shared/ui/button';
import { Badge } from '@/components/shared/ui/badge';
import { Progress } from '@/components/shared/ui/progress';
import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { cn } from '@/lib/utils';

interface ProfileData {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phone?: string;
  avatarUrl?: string;
  position?: string;
  location?: string;
  bio?: string;
  memberSince?: string;
  username?: string;
}

interface AssessmentData {
  disc: {
    completed: boolean;
    primaryType?: string;
    secondaryType?: string;
    dScore?: number;
    iScore?: number;
    sScore?: number;
    cScore?: number;
    totalXp?: number;
  };
  resume: {
    completed: boolean;
    score?: number;
    hasResume?: boolean;
    resumeSlug?: string;
  };
}

// DISC Type configurations
const DISC_TYPES: Record<string, { name: string; emoji: string; color: string; bgColor: string; description: string }> = {
  D: { name: 'Dominant', emoji: '🦁', color: 'text-red-400', bgColor: 'bg-red-500/20', description: 'Direct, decisive, results-oriented' },
  I: { name: 'Influential', emoji: '🦋', color: 'text-yellow-400', bgColor: 'bg-yellow-500/20', description: 'Enthusiastic, optimistic, collaborative' },
  S: { name: 'Steady', emoji: '🐢', color: 'text-green-400', bgColor: 'bg-green-500/20', description: 'Patient, reliable, team-oriented' },
  C: { name: 'Conscientious', emoji: '🦉', color: 'text-blue-400', bgColor: 'bg-blue-500/20', description: 'Analytical, precise, quality-focused' },
};

export default function ProfilePreviewPage() {
  const { user } = useAuth();
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [assessments, setAssessments] = useState<AssessmentData | null>(null);
  const [skills, setSkills] = useState<string[]>([]);

  useEffect(() => {
    const fetchProfileData = async () => {
      if (!user?.id) {
        setLoading(false);
        return;
      }

      try {
        // Fetch profile data
        const [profileRes, discRes, aiRes] = await Promise.all([
          fetch(`/api/user/profile?userId=${user.id}`),
          fetch(`/api/user/disc-stats?userId=${user.id}`),
          fetch(`/api/user/ai-analysis?userId=${user.id}`),
        ]);

        if (profileRes.ok) {
          const data = await profileRes.json();
          setProfile({
            id: user.id,
            firstName: data.user?.first_name || '',
            lastName: data.user?.last_name || '',
            email: data.user?.email || '',
            phone: data.user?.phone,
            avatarUrl: data.user?.avatar_url,
            position: data.user?.position,
            location: data.user?.location,
            bio: data.user?.bio,
            memberSince: data.user?.created_at,
            username: data.user?.username,
          });
        }

        const assessmentData: AssessmentData = {
          disc: { completed: false },
          resume: { completed: false },
        };

        if (discRes.ok) {
          const data = await discRes.json();
          if (data.stats) {
            assessmentData.disc = {
              completed: true,
              primaryType: data.stats.primary_type,
              secondaryType: data.stats.secondary_type,
              dScore: data.stats.d_score,
              iScore: data.stats.i_score,
              sScore: data.stats.s_score,
              cScore: data.stats.c_score,
              totalXp: data.stats.total_xp,
            };
          }
        }

        if (aiRes.ok) {
          const data = await aiRes.json();
          if (data.analysis?.overall_score) {
            assessmentData.resume = {
              completed: true,
              score: data.analysis.overall_score,
              hasResume: true,
            };
            // Extract skills from AI analysis
            if (data.analysis.key_strengths) {
              setSkills(data.analysis.key_strengths.slice(0, 6));
            }
          }
        }

        setAssessments(assessmentData);
      } catch (error) {
        console.error('Error fetching profile data:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchProfileData();
  }, [user?.id]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-cyan-500 mx-auto"></div>
          <p className="mt-4 text-gray-400">Loading profile preview...</p>
        </div>
      </div>
    );
  }

  const getScoreColor = (score: number) => {
    if (score >= 80) return 'text-emerald-400';
    if (score >= 60) return 'text-yellow-400';
    return 'text-orange-400';
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-white flex items-center gap-3">
            <Eye className="h-8 w-8 text-cyan-400" />
            Profile Preview
          </h1>
          <p className="text-gray-400 mt-1">
            This is how recruiters see your profile
          </p>
        </div>
        <div className="flex gap-3">
          <Link href="/candidate/profile">
            <Button variant="outline" className="border-white/20 text-gray-300 hover:bg-white/10">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Edit
            </Button>
          </Link>
        </div>
      </div>

      {/* Preview Notice */}
      <div className="p-4 rounded-xl bg-cyan-500/10 border border-cyan-500/30 flex items-center gap-3">
        <Eye className="h-5 w-5 text-cyan-400" />
        <p className="text-cyan-300 text-sm">
          <span className="font-semibold">Preview Mode:</span> You're viewing your profile as it appears to recruiters in the Talent Pool.
        </p>
      </div>

      {/* Profile Card - Recruiter View */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="relative overflow-hidden rounded-xl border border-white/10 bg-gradient-to-br from-white/5 to-white/0 backdrop-blur-xl"
      >
        <div className="absolute top-0 left-0 w-full h-32 bg-gradient-to-r from-cyan-500/20 via-purple-500/20 to-pink-500/20" />
        
        <CardContent className="relative z-10 p-8">
          {/* Profile Header */}
          <div className="flex flex-col md:flex-row gap-6 items-start md:items-end -mt-4">
            {/* Avatar */}
            <div className="relative">
              <div className="w-24 h-24 sm:w-32 sm:h-32 rounded-full border-4 border-[#0B0B0D] overflow-hidden bg-gradient-to-br from-cyan-500/30 to-purple-500/30">
                {profile?.avatarUrl ? (
                  <Image
                    src={profile.avatarUrl}
                    alt={profile.firstName || 'Profile'}
                    fill
                    className="object-cover"
                    unoptimized
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <User className="h-16 w-16 text-gray-400" />
                  </div>
                )}
              </div>
              {assessments?.disc.completed && assessments.disc.primaryType && (
                <div className={cn(
                  "absolute -bottom-2 -right-2 w-10 h-10 rounded-full flex items-center justify-center text-xl border-2 border-[#0B0B0D]",
                  DISC_TYPES[assessments.disc.primaryType]?.bgColor
                )}>
                  {DISC_TYPES[assessments.disc.primaryType]?.emoji}
                </div>
              )}
            </div>

            {/* Basic Info */}
            <div className="flex-1">
              <h2 className="text-2xl sm:text-3xl font-bold text-white mb-1">
                {profile?.firstName} {profile?.lastName?.charAt(0)}.
              </h2>
              {profile?.position && (
                <p className="text-xl text-cyan-400 mb-2">{profile.position}</p>
              )}
              <div className="flex flex-wrap gap-4 text-gray-400">
                {profile?.location && (
                  <span className="flex items-center gap-1">
                    <MapPin className="h-4 w-4" />
                    {profile.location}
                  </span>
                )}
                {profile?.memberSince && (
                  <span className="flex items-center gap-1">
                    <Calendar className="h-4 w-4" />
                    Member since {new Date(profile.memberSince).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}
                  </span>
                )}
              </div>
            </div>

            {/* Quick Stats */}
            <div className="flex gap-3">
              {assessments?.disc.completed && assessments.disc.primaryType && (
                <Badge className={cn(
                  "px-3 py-1.5",
                  DISC_TYPES[assessments.disc.primaryType]?.bgColor,
                  DISC_TYPES[assessments.disc.primaryType]?.color,
                  "border border-white/10"
                )}>
                  <Brain className="h-3 w-3 mr-1" />
                  {assessments.disc.primaryType}
                </Badge>
              )}
              {assessments?.resume.completed && (
                <Badge className={cn(
                  "px-3 py-1.5 border",
                  (assessments.resume.score || 0) >= 80 
                    ? "bg-emerald-500/20 text-emerald-400 border-emerald-500/30"
                    : "bg-yellow-500/20 text-yellow-400 border-yellow-500/30"
                )}>
                  <FileText className="h-3 w-3 mr-1" />
                  {assessments.resume.score}/100
                </Badge>
              )}
            </div>
          </div>

          {/* Bio */}
          {profile?.bio && (
            <div className="mt-6 p-4 rounded-xl bg-white/5 border border-white/10">
              <p className="text-gray-300 leading-relaxed">{profile.bio}</p>
            </div>
          )}
        </CardContent>
      </motion.div>

      {/* Assessment Details */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* DISC Card */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
        >
          <Card className={cn(
            "h-full border-white/10",
            assessments?.disc.completed ? "bg-purple-500/5" : "bg-white/5"
          )}>
            <CardContent className="p-6">
              <div className="flex items-center gap-3 mb-4">
                <div className="p-2 rounded-lg bg-purple-500/20">
                  <Brain className="h-5 w-5 text-purple-400" />
                </div>
                <h3 className="text-white font-semibold">DISC Profile</h3>
              </div>
              
              {assessments?.disc.completed && assessments.disc.primaryType ? (
                <div className="space-y-4">
                  <div className={cn(
                    "p-3 rounded-lg border",
                    DISC_TYPES[assessments.disc.primaryType]?.bgColor,
                    "border-white/10"
                  )}>
                    <div className="flex items-center gap-2">
                      <span className="text-2xl">{DISC_TYPES[assessments.disc.primaryType]?.emoji}</span>
                      <div>
                        <p className={cn("font-bold", DISC_TYPES[assessments.disc.primaryType]?.color)}>
                          {DISC_TYPES[assessments.disc.primaryType]?.name}
                        </p>
                        <p className="text-gray-400 text-xs">
                          {DISC_TYPES[assessments.disc.primaryType]?.description}
                        </p>
                      </div>
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-2">
                    {['D', 'I', 'S', 'C'].map((type) => {
                      const score = assessments.disc[`${type.toLowerCase()}Score` as keyof typeof assessments.disc] as number || 0;
                      return (
                        <div key={type} className="text-center p-2 rounded bg-white/5">
                          <span className={cn("text-sm", DISC_TYPES[type].color)}>{type}</span>
                          <p className="text-white font-bold">{score}%</p>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ) : (
                <div className="text-center py-4">
                  <p className="text-gray-500 text-sm">Not completed</p>
                </div>
              )}
            </CardContent>
          </Card>
        </motion.div>

        {/* Resume Score Card */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
        >
          <Card className={cn(
            "h-full border-white/10",
            assessments?.resume.completed ? "bg-emerald-500/5" : "bg-white/5"
          )}>
            <CardContent className="p-6">
              <div className="flex items-center gap-3 mb-4">
                <div className="p-2 rounded-lg bg-emerald-500/20">
                  <FileText className="h-5 w-5 text-emerald-400" />
                </div>
                <h3 className="text-white font-semibold">Resume Score</h3>
              </div>
              
              {assessments?.resume.completed ? (
                <div className="space-y-4">
                  <div className="text-center p-4 rounded-lg bg-emerald-500/10">
                    <p className={cn("text-4xl font-bold", getScoreColor(assessments.resume.score || 0))}>
                      {assessments.resume.score}
                    </p>
                    <p className="text-gray-400 text-sm">out of 100</p>
                  </div>
                  
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-400">ATS Ready</span>
                      <CheckCircle className="h-4 w-4 text-emerald-400" />
                    </div>
                    <Progress value={assessments.resume.score || 0} className="h-2 bg-gray-700" />
                  </div>
                </div>
              ) : (
                <div className="text-center py-4">
                  <p className="text-gray-500 text-sm">No resume analyzed</p>
                </div>
              )}
            </CardContent>
          </Card>
        </motion.div>
      </div>

      {/* Skills Section */}
      {skills.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
        >
          <Card className="bg-white/5 border-white/10">
            <CardContent className="p-6">
              <div className="flex items-center gap-3 mb-4">
                <div className="p-2 rounded-lg bg-yellow-500/20">
                  <Star className="h-5 w-5 text-yellow-400" />
                </div>
                <h3 className="text-white font-semibold">Key Strengths</h3>
              </div>
              
              <div className="flex flex-wrap gap-2">
                {skills.map((skill, i) => (
                  <Badge key={i} className="bg-yellow-500/10 text-yellow-400 border-yellow-500/30 px-3 py-1">
                    <Star className="h-3 w-3 mr-1" />
                    {skill}
                  </Badge>
                ))}
              </div>
            </CardContent>
          </Card>
        </motion.div>
      )}

      {/* Improvement Tips */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.5 }}
        className="p-6 rounded-xl bg-gradient-to-br from-purple-500/10 to-cyan-500/10 border border-purple-500/30"
      >
        <div className="flex items-start gap-4">
          <div className="p-3 rounded-xl bg-purple-500/20">
            <Sparkles className="h-6 w-6 text-purple-400" />
          </div>
          <div>
            <h3 className="text-white font-semibold mb-2">Tips to Improve Your Profile</h3>
            <ul className="space-y-2 text-gray-300 text-sm">
              {!assessments?.disc.completed && (
                <li className="flex items-center gap-2">
                  <Brain className="h-4 w-4 text-purple-400" />
                  Take the DISC assessment to show your personality type
                </li>
              )}
              {!assessments?.resume.completed && (
                <li className="flex items-center gap-2">
                  <FileText className="h-4 w-4 text-emerald-400" />
                  Upload and analyze your resume for a quality score
                </li>
              )}
              {!profile?.bio && (
                <li className="flex items-center gap-2">
                  <User className="h-4 w-4 text-yellow-400" />
                  Add a bio to tell recruiters about yourself
                </li>
              )}
              {!profile?.avatarUrl && (
                <li className="flex items-center gap-2">
                  <User className="h-4 w-4 text-pink-400" />
                  Upload a professional profile photo
                </li>
              )}
            </ul>
          </div>
        </div>
      </motion.div>
    </div>
  );
}

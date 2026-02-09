'use client';

import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { 
  FileText, 
  Upload, 
  Sparkles, 
  Edit3, 
  Eye,
  Loader2,
  ArrowRight,
  CheckCircle,
  Clock
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { getSessionToken } from '@/lib/auth-helpers';

/**
 * Resume Builder Overview Page
 * Shows current status and directs user to appropriate step
 */
export default function ResumeOverviewPage() {
  const router = useRouter();
  const { user } = useAuth();
  
  const [isLoading, setIsLoading] = useState(true);
  const [hasExtractedResume, setHasExtractedResume] = useState(false);
  const [hasAIAnalysis, setHasAIAnalysis] = useState(false);
  const [hasSavedResume, setHasSavedResume] = useState(false);
  const [resumeSlug, setResumeSlug] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<string | null>(null);

  useEffect(() => {
    const checkResumeStatus = async () => {
      try {
        const sessionToken = await getSessionToken();
        if (!sessionToken || !user?.id) {
          setIsLoading(false);
          return;
        }

        // Check for existing resume data
        const response = await fetch('/api/user/resume-status', {
          headers: {
            'Authorization': `Bearer ${sessionToken}`,
            'x-user-id': String(user.id)
          }
        });

        if (response.ok) {
          const data = await response.json();
          setHasExtractedResume(data.hasExtractedResume || false);
          setHasAIAnalysis(data.hasAIAnalysis || false);
          setHasSavedResume(data.hasSavedResume || false);
          setResumeSlug(data.resumeSlug || null);
          setLastUpdated(data.lastUpdated || null);
        }
      } catch (error) {
        console.error('Error checking resume status:', error);
      } finally {
        setIsLoading(false);
      }
    };

    checkResumeStatus();
  }, [user?.id]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#0B0B0D] flex items-center justify-center relative overflow-hidden">
        {/* Animated background */}
        <div className="absolute inset-0">
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-cyan-500/20 rounded-full blur-3xl animate-pulse" />
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-64 h-64 bg-purple-500/20 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '1s' }} />
        </div>

        <div className="relative z-10 text-center">
          {/* Premium loading spinner */}
          <div className="relative w-20 h-20 mx-auto mb-6">
            <div className="absolute inset-0 rounded-full border-4 border-cyan-500/20" />
            <div className="absolute inset-0 rounded-full border-4 border-transparent border-t-cyan-400 animate-spin" />
            <div className="absolute inset-2 rounded-full border-4 border-transparent border-t-purple-400 animate-spin" style={{ animationDuration: '1.5s', animationDirection: 'reverse' }} />
            <Sparkles className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-6 h-6 text-cyan-400 animate-pulse" />
          </div>

          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.2 }}
          >
            <p className="text-lg font-medium bg-gradient-to-r from-cyan-400 via-purple-400 to-cyan-400 bg-clip-text text-transparent animate-pulse">
              Loading Your Resume Journey
            </p>
            <p className="text-sm text-gray-500 mt-2">Preparing your workspace...</p>
          </motion.div>
        </div>
      </div>
    );
  }

  // Determine which step user should go to
  const getNextStep = () => {
    if (!hasExtractedResume) return '/candidate/resume/upload';
    if (!hasAIAnalysis) return '/candidate/resume/analysis';
    return '/candidate/resume/build';
  };

  const getStepStatus = (step: number) => {
    if (step === 1) return hasExtractedResume ? 'completed' : 'current';
    if (step === 2) return hasAIAnalysis ? 'completed' : hasExtractedResume ? 'current' : 'pending';
    if (step === 3) return hasSavedResume ? 'completed' : hasAIAnalysis ? 'current' : 'pending';
    return 'pending';
  };

  return (
    <div className="min-h-screen bg-[#0B0B0D] relative overflow-hidden">
      {/* Sophisticated background atmosphere */}
      <div className="fixed inset-0 pointer-events-none">
        {/* Gradient orbs */}
        <div className="absolute top-0 left-1/4 w-[500px] h-[500px] bg-cyan-500/10 rounded-full blur-[120px] animate-pulse" />
        <div className="absolute bottom-0 right-1/4 w-[600px] h-[600px] bg-purple-500/10 rounded-full blur-[120px] animate-pulse" style={{ animationDelay: '2s' }} />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[400px] h-[400px] bg-emerald-500/5 rounded-full blur-[100px]" />

        {/* Subtle grid overlay */}
        <div className="absolute inset-0 bg-[linear-gradient(rgba(6,182,212,0.03)_1px,transparent_1px),linear-gradient(90deg,rgba(6,182,212,0.03)_1px,transparent_1px)] bg-[size:100px_100px] [mask-image:radial-gradient(ellipse_80%_50%_at_50%_50%,black,transparent)]" />
      </div>

      <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 lg:py-24">
        {/* Hero Header */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
          className="text-center mb-16 lg:mb-24"
        >
          {/* Badge */}
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.2 }}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-gradient-to-r from-cyan-500/10 via-purple-500/10 to-emerald-500/10 border border-cyan-500/20 mb-8"
          >
            <Sparkles className="w-4 h-4 text-cyan-400" />
            <span className="text-sm font-medium bg-gradient-to-r from-cyan-400 to-purple-400 bg-clip-text text-transparent">
              AI-Powered Resume Builder
            </span>
          </motion.div>

          {/* Main heading with distinctive typography */}
          <h1 className="text-3xl sm:text-5xl lg:text-7xl font-black tracking-tight mb-6">
            <span className="block bg-gradient-to-r from-white via-white to-gray-300 bg-clip-text text-transparent">
              Build Your Dream
            </span>
            <span className="block bg-gradient-to-r from-cyan-400 via-purple-400 to-emerald-400 bg-clip-text text-transparent mt-2">
              Resume in Minutes
            </span>
          </h1>

          <p className="text-xl text-gray-400 max-w-2xl mx-auto leading-relaxed">
            Upload, enhance with Claude AI, and create a professional resume that stands out.
          </p>
        </motion.div>

        {/* Journey Progress Tracker */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3, duration: 0.8 }}
          className="mb-16 lg:mb-20"
        >
          <div className="relative max-w-4xl mx-auto">
            {/* Connection lines */}
            <div className="absolute top-10 left-0 right-0 h-0.5 bg-gradient-to-r from-transparent via-white/10 to-transparent hidden md:block" />

            <div className="grid md:grid-cols-3 gap-8 md:gap-4 relative">
              {/* Step 1: Upload */}
              <motion.div
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.4 }}
                className="relative group"
              >
                <div className="relative z-10 flex flex-col items-center text-center">
                  {/* Icon circle */}
                  <div className={`
                    relative w-20 h-20 rounded-full flex items-center justify-center transition-all duration-500 mb-4
                    ${getStepStatus(1) === 'completed'
                      ? 'bg-gradient-to-br from-cyan-400 to-cyan-600 shadow-[0_0_40px_-10px_rgba(6,182,212,0.6)]'
                      : getStepStatus(1) === 'current'
                      ? 'bg-gradient-to-br from-cyan-500/20 to-purple-500/20 border-2 border-cyan-400 shadow-[0_0_30px_-10px_rgba(6,182,212,0.4)] animate-pulse'
                      : 'bg-white/5 border-2 border-white/10'
                    }
                  `}>
                    {getStepStatus(1) === 'completed' ? (
                      <CheckCircle className="w-10 h-10 text-white" strokeWidth={2.5} />
                    ) : (
                      <Upload className={`w-10 h-10 ${getStepStatus(1) === 'current' ? 'text-cyan-400' : 'text-gray-600'}`} strokeWidth={2} />
                    )}

                    {/* Completion ring */}
                    {getStepStatus(1) === 'completed' && (
                      <div className="absolute inset-0 rounded-full border-2 border-cyan-400/50 animate-ping" />
                    )}
                  </div>

                  {/* Labels */}
                  <div className={`
                    px-4 py-1.5 rounded-full text-xs font-bold uppercase tracking-wider mb-2 transition-all
                    ${getStepStatus(1) === 'completed' ? 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/30' :
                      getStepStatus(1) === 'current' ? 'bg-cyan-500/10 text-cyan-400 border border-cyan-500/20' :
                      'bg-white/5 text-gray-500 border border-white/10'}
                  `}>
                    Step 1
                  </div>

                  <h3 className={`text-lg font-bold mb-1 ${
                    getStepStatus(1) === 'completed' || getStepStatus(1) === 'current' ? 'text-white' : 'text-gray-500'
                  }`}>
                    Upload Resume
                  </h3>

                  <p className="text-sm text-gray-500 max-w-[200px]">
                    Share your existing resume or start fresh
                  </p>
                </div>
              </motion.div>

              {/* Step 2: AI Analysis */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.5 }}
                className="relative group"
              >
                <div className="relative z-10 flex flex-col items-center text-center">
                  <div className={`
                    relative w-20 h-20 rounded-full flex items-center justify-center transition-all duration-500 mb-4
                    ${getStepStatus(2) === 'completed'
                      ? 'bg-gradient-to-br from-purple-400 to-purple-600 shadow-[0_0_40px_-10px_rgba(168,85,247,0.6)]'
                      : getStepStatus(2) === 'current'
                      ? 'bg-gradient-to-br from-purple-500/20 to-pink-500/20 border-2 border-purple-400 shadow-[0_0_30px_-10px_rgba(168,85,247,0.4)] animate-pulse'
                      : 'bg-white/5 border-2 border-white/10'
                    }
                  `}>
                    {getStepStatus(2) === 'completed' ? (
                      <CheckCircle className="w-10 h-10 text-white" strokeWidth={2.5} />
                    ) : (
                      <Sparkles className={`w-10 h-10 ${getStepStatus(2) === 'current' ? 'text-purple-400' : 'text-gray-600'}`} strokeWidth={2} />
                    )}

                    {getStepStatus(2) === 'completed' && (
                      <div className="absolute inset-0 rounded-full border-2 border-purple-400/50 animate-ping" />
                    )}
                  </div>

                  <div className={`
                    px-4 py-1.5 rounded-full text-xs font-bold uppercase tracking-wider mb-2 transition-all
                    ${getStepStatus(2) === 'completed' ? 'bg-purple-500/20 text-purple-400 border border-purple-500/30' :
                      getStepStatus(2) === 'current' ? 'bg-purple-500/10 text-purple-400 border border-purple-500/20' :
                      'bg-white/5 text-gray-500 border border-white/10'}
                  `}>
                    Step 2
                  </div>

                  <h3 className={`text-lg font-bold mb-1 ${
                    getStepStatus(2) === 'completed' || getStepStatus(2) === 'current' ? 'text-white' : 'text-gray-500'
                  }`}>
                    AI Enhancement
                  </h3>

                  <p className="text-sm text-gray-500 max-w-[200px]">
                    Claude AI analyzes and suggests improvements
                  </p>
                </div>
              </motion.div>

              {/* Step 3: Build */}
              <motion.div
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.6 }}
                className="relative group"
              >
                <div className="relative z-10 flex flex-col items-center text-center">
                  <div className={`
                    relative w-20 h-20 rounded-full flex items-center justify-center transition-all duration-500 mb-4
                    ${getStepStatus(3) === 'completed'
                      ? 'bg-gradient-to-br from-emerald-400 to-emerald-600 shadow-[0_0_40px_-10px_rgba(16,185,129,0.6)]'
                      : getStepStatus(3) === 'current'
                      ? 'bg-gradient-to-br from-emerald-500/20 to-cyan-500/20 border-2 border-emerald-400 shadow-[0_0_30px_-10px_rgba(16,185,129,0.4)] animate-pulse'
                      : 'bg-white/5 border-2 border-white/10'
                    }
                  `}>
                    {getStepStatus(3) === 'completed' ? (
                      <CheckCircle className="w-10 h-10 text-white" strokeWidth={2.5} />
                    ) : (
                      <Edit3 className={`w-10 h-10 ${getStepStatus(3) === 'current' ? 'text-emerald-400' : 'text-gray-600'}`} strokeWidth={2} />
                    )}

                    {getStepStatus(3) === 'completed' && (
                      <div className="absolute inset-0 rounded-full border-2 border-emerald-400/50 animate-ping" />
                    )}
                  </div>

                  <div className={`
                    px-4 py-1.5 rounded-full text-xs font-bold uppercase tracking-wider mb-2 transition-all
                    ${getStepStatus(3) === 'completed' ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' :
                      getStepStatus(3) === 'current' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' :
                      'bg-white/5 text-gray-500 border border-white/10'}
                  `}>
                    Step 3
                  </div>

                  <h3 className={`text-lg font-bold mb-1 ${
                    getStepStatus(3) === 'completed' || getStepStatus(3) === 'current' ? 'text-white' : 'text-gray-500'
                  }`}>
                    Build & Customize
                  </h3>

                  <p className="text-sm text-gray-500 max-w-[200px]">
                    Choose templates and finalize your resume
                  </p>
                </div>
              </motion.div>
            </div>
          </div>
        </motion.div>

        {/* Action Cards Grid */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.7 }}
          className="grid lg:grid-cols-2 gap-6 mb-16"
        >
          {/* Primary CTA - Start/Continue */}
          <motion.div
            whileHover={{ y: -4, transition: { duration: 0.2 } }}
            onClick={() => router.push(getNextStep())}
            className="relative group cursor-pointer overflow-hidden rounded-2xl bg-gradient-to-br from-white/10 to-white/5 border border-white/10 backdrop-blur-xl p-8 hover:border-cyan-400/50 transition-all duration-300"
          >
            {/* Gradient glow on hover */}
            <div className="absolute inset-0 bg-gradient-to-br from-cyan-500/0 via-purple-500/0 to-emerald-500/0 group-hover:from-cyan-500/10 group-hover:via-purple-500/10 group-hover:to-emerald-500/10 transition-all duration-500" />

            {/* Accent bar */}
            <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-cyan-400 via-purple-400 to-emerald-400 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />

            <div className="relative z-10">
              {/* Icon badge */}
              <div className="flex items-center justify-between mb-6">
                <div className="relative">
                  <div className="absolute inset-0 bg-gradient-to-br from-cyan-400 to-purple-500 rounded-2xl blur-xl opacity-50 group-hover:opacity-75 transition-opacity" />
                  <div className="relative w-16 h-16 rounded-2xl bg-gradient-to-br from-cyan-400 to-purple-500 flex items-center justify-center shadow-lg">
                    {!hasExtractedResume ? (
                      <Upload className="w-8 h-8 text-white" strokeWidth={2} />
                    ) : !hasAIAnalysis ? (
                      <Sparkles className="w-8 h-8 text-white" strokeWidth={2} />
                    ) : (
                      <Edit3 className="w-8 h-8 text-white" strokeWidth={2} />
                    )}
                  </div>
                </div>

                <div className="w-12 h-12 rounded-full bg-white/5 flex items-center justify-center group-hover:bg-cyan-400/20 transition-all group-hover:scale-110">
                  <ArrowRight className="w-6 h-6 text-gray-500 group-hover:text-cyan-400 transition-colors group-hover:translate-x-1" />
                </div>
              </div>

              {/* Content */}
              <h3 className="text-3xl font-black text-white mb-3 group-hover:bg-gradient-to-r group-hover:from-cyan-400 group-hover:to-purple-400 group-hover:bg-clip-text group-hover:text-transparent transition-all">
                {!hasExtractedResume ? 'Start New Resume' :
                 !hasAIAnalysis ? 'Continue to AI Analysis' :
                 'Edit Your Resume'}
              </h3>

              <p className="text-gray-400 text-lg leading-relaxed">
                {!hasExtractedResume ? 'Upload your existing resume or start from scratch with our AI-powered builder' :
                 !hasAIAnalysis ? 'Let Claude AI analyze and enhance your resume with professional suggestions' :
                 'Customize and perfect your AI-enhanced resume with our editor'}
              </p>

              {/* Progress indicator for current step */}
              {!hasSavedResume && (
                <div className="mt-6 flex items-center gap-2 text-sm">
                  <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-cyan-500/10 border border-cyan-500/20">
                    <div className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse" />
                    <span className="text-cyan-400 font-medium">
                      {!hasExtractedResume ? 'Ready to start' :
                       !hasAIAnalysis ? 'Next step' :
                       'Almost there'}
                    </span>
                  </div>
                </div>
              )}
            </div>
          </motion.div>

          {/* View Resume Card */}
          {hasSavedResume && resumeSlug && (
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.8 }}
              whileHover={{ y: -4, transition: { duration: 0.2 } }}
              onClick={() => window.open(`/resume/${resumeSlug}`, '_blank')}
              className="relative group cursor-pointer overflow-hidden rounded-2xl bg-gradient-to-br from-white/10 to-white/5 border border-white/10 backdrop-blur-xl p-8 hover:border-emerald-400/50 transition-all duration-300"
            >
              <div className="absolute inset-0 bg-gradient-to-br from-emerald-500/0 to-cyan-500/0 group-hover:from-emerald-500/10 group-hover:to-cyan-500/10 transition-all duration-500" />
              <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-emerald-400 to-cyan-400 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />

              <div className="relative z-10">
                <div className="flex items-center justify-between mb-6">
                  <div className="relative">
                    <div className="absolute inset-0 bg-gradient-to-br from-emerald-400 to-cyan-500 rounded-2xl blur-xl opacity-50 group-hover:opacity-75 transition-opacity" />
                    <div className="relative w-16 h-16 rounded-2xl bg-gradient-to-br from-emerald-400 to-cyan-500 flex items-center justify-center shadow-lg">
                      <Eye className="w-8 h-8 text-white" strokeWidth={2} />
                    </div>
                  </div>

                  <div className="w-12 h-12 rounded-full bg-white/5 flex items-center justify-center group-hover:bg-emerald-400/20 transition-all group-hover:scale-110">
                    <ArrowRight className="w-6 h-6 text-gray-500 group-hover:text-emerald-400 transition-colors group-hover:translate-x-1" />
                  </div>
                </div>

                <h3 className="text-3xl font-black text-white mb-3 group-hover:bg-gradient-to-r group-hover:from-emerald-400 group-hover:to-cyan-400 group-hover:bg-clip-text group-hover:text-transparent transition-all">
                  View Public Resume
                </h3>

                <p className="text-gray-400 text-lg leading-relaxed mb-4">
                  See your polished resume as employers and recruiters will see it
                </p>

                {lastUpdated && (
                  <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 w-fit">
                    <Clock className="w-4 h-4 text-emerald-400" />
                    <span className="text-sm text-emerald-400 font-medium">
                      Updated {new Date(lastUpdated).toLocaleDateString()}
                    </span>
                  </div>
                )}
              </div>
            </motion.div>
          )}

          {/* Upload New Resume Card */}
          {hasExtractedResume && (
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.8 }}
              whileHover={{ y: -4, transition: { duration: 0.2 } }}
              onClick={() => router.push('/candidate/resume/upload')}
              className="relative group cursor-pointer overflow-hidden rounded-2xl bg-gradient-to-br from-white/10 to-white/5 border border-white/10 backdrop-blur-xl p-8 hover:border-orange-400/50 transition-all duration-300"
            >
              <div className="absolute inset-0 bg-gradient-to-br from-orange-500/0 to-red-500/0 group-hover:from-orange-500/10 group-hover:to-red-500/10 transition-all duration-500" />
              <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-orange-400 to-red-400 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />

              <div className="relative z-10">
                <div className="flex items-center justify-between mb-6">
                  <div className="relative">
                    <div className="absolute inset-0 bg-gradient-to-br from-orange-400 to-red-500 rounded-2xl blur-xl opacity-50 group-hover:opacity-75 transition-opacity" />
                    <div className="relative w-16 h-16 rounded-2xl bg-gradient-to-br from-orange-400 to-red-500 flex items-center justify-center shadow-lg">
                      <Upload className="w-8 h-8 text-white" strokeWidth={2} />
                    </div>
                  </div>

                  <div className="w-12 h-12 rounded-full bg-white/5 flex items-center justify-center group-hover:bg-orange-400/20 transition-all group-hover:scale-110">
                    <ArrowRight className="w-6 h-6 text-gray-500 group-hover:text-orange-400 transition-colors group-hover:translate-x-1" />
                  </div>
                </div>

                <h3 className="text-3xl font-black text-white mb-3 group-hover:bg-gradient-to-r group-hover:from-orange-400 group-hover:to-red-400 group-hover:bg-clip-text group-hover:text-transparent transition-all">
                  Upload New Resume
                </h3>

                <p className="text-gray-400 text-lg leading-relaxed">
                  Start fresh with a different resume file and create something new
                </p>
              </div>
            </motion.div>
          )}
        </motion.div>

        {/* Features Showcase */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.9 }}
          className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-white/5 to-white/[0.02] border border-white/10 backdrop-blur-xl p-10 lg:p-12"
        >
          {/* Subtle gradient overlay */}
          <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-white/20 to-transparent" />

          <div className="relative z-10">
            <div className="text-center mb-12">
              <h2 className="text-3xl lg:text-4xl font-black text-white mb-3">
                Why Choose Our Resume Builder?
              </h2>
              <p className="text-gray-400 text-lg">
                Powered by cutting-edge AI technology
              </p>
            </div>

            <div className="grid md:grid-cols-3 gap-8 lg:gap-12">
              {/* Feature 1 */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 1.0 }}
                className="relative group"
              >
                <div className="flex flex-col items-center text-center">
                  <div className="relative mb-6">
                    <div className="absolute inset-0 bg-cyan-400/20 rounded-2xl blur-xl group-hover:blur-2xl transition-all" />
                    <div className="relative w-16 h-16 rounded-2xl bg-gradient-to-br from-cyan-400/20 to-cyan-600/20 border border-cyan-400/30 flex items-center justify-center backdrop-blur-sm">
                      <FileText className="w-8 h-8 text-cyan-400" strokeWidth={2} />
                    </div>
                  </div>

                  <h4 className="text-xl font-bold text-white mb-3">Smart Extraction</h4>
                  <p className="text-gray-400 leading-relaxed">
                    AI instantly extracts all your information from any resume format—PDF, Word, or image
                  </p>
                </div>
              </motion.div>

              {/* Feature 2 */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 1.1 }}
                className="relative group"
              >
                <div className="flex flex-col items-center text-center">
                  <div className="relative mb-6">
                    <div className="absolute inset-0 bg-purple-400/20 rounded-2xl blur-xl group-hover:blur-2xl transition-all" />
                    <div className="relative w-16 h-16 rounded-2xl bg-gradient-to-br from-purple-400/20 to-purple-600/20 border border-purple-400/30 flex items-center justify-center backdrop-blur-sm">
                      <Sparkles className="w-8 h-8 text-purple-400" strokeWidth={2} />
                    </div>
                  </div>

                  <h4 className="text-xl font-bold text-white mb-3">Claude AI Enhancement</h4>
                  <p className="text-gray-400 leading-relaxed">
                    Get intelligent suggestions to improve your content, making it more compelling and professional
                  </p>
                </div>
              </motion.div>

              {/* Feature 3 */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 1.2 }}
                className="relative group"
              >
                <div className="flex flex-col items-center text-center">
                  <div className="relative mb-6">
                    <div className="absolute inset-0 bg-emerald-400/20 rounded-2xl blur-xl group-hover:blur-2xl transition-all" />
                    <div className="relative w-16 h-16 rounded-2xl bg-gradient-to-br from-emerald-400/20 to-emerald-600/20 border border-emerald-400/30 flex items-center justify-center backdrop-blur-sm">
                      <Edit3 className="w-8 h-8 text-emerald-400" strokeWidth={2} />
                    </div>
                  </div>

                  <h4 className="text-xl font-bold text-white mb-3">Beautiful Templates</h4>
                  <p className="text-gray-400 leading-relaxed">
                    Choose from professionally designed templates that make your resume stand out from the crowd
                  </p>
                </div>
              </motion.div>
            </div>
          </div>
        </motion.div>
      </div>
    </div>
  );
}

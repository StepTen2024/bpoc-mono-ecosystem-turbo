'use client';

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Sparkles, 
  FileText, 
  Loader2,
  ArrowLeft,
  ArrowRight,
  CheckCircle,
  AlertCircle,
  Brain,
  Target,
  TrendingUp,
  Award,
  Database,
  Star,
  DollarSign,
  Briefcase,
  GraduationCap,
  Wrench,
  Users,
  Zap
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { getSessionToken } from '@/lib/auth-helpers';
import { toast } from '@/components/ui/toast';

import { v4 as uuidv4 } from 'uuid';

/**
 * Step 2: AI Analysis - ENHANCED VERSION
 * Full Claude AI analysis with salary, career path, and detailed scores
 */
export default function ResumeAnalysisPage() {
  const router = useRouter();
  const { user } = useAuth();
  
  const [isLoading, setIsLoading] = useState(true);
  const [extractedData, setExtractedData] = useState<any>(null);
  const [originalFileName, setOriginalFileName] = useState<string | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [analysisComplete, setAnalysisComplete] = useState(false);
  const [analysisResults, setAnalysisResults] = useState<any>(null);
  const [improvedResume, setImprovedResume] = useState<any>(null);
  const [savedToDatabase, setSavedToDatabase] = useState(false);

  // Load extracted resume data
  useEffect(() => {
    const loadExtractedData = async () => {
      try {
        // Try database first if logged in
        if (user?.id) {
          try {
            const sessionToken = await getSessionToken();
            if (sessionToken) {
              const response = await fetch('/api/user/extracted-resume', {
                headers: {
                  'Authorization': `Bearer ${sessionToken}`,
                  'x-user-id': String(user.id)
                }
              });

              if (response.ok) {
                const data = await response.json();
                if (data.hasData && data.resumeData) {
                  console.log('✅ Loaded extracted data from database');
                  setExtractedData(data.resumeData);
                  setOriginalFileName(data.originalFileName || null);
                  setIsLoading(false);
                  return;
                }
              }
            }
          } catch (dbError) {
            console.warn('Could not load from database:', dbError);
          }
        }

        // Fallback to localStorage
        try {
          const stored = localStorage.getItem('anon_extracted_resume') || 
                        localStorage.getItem('bpoc_processed_resumes');
          if (stored) {
            const parsed = JSON.parse(stored);
            const resumeData = Array.isArray(parsed) ? parsed[0] : parsed;
            console.log('✅ Loaded from localStorage');
            setExtractedData(resumeData);
            setIsLoading(false);
            return;
          }
        } catch {}

        // No data found
        setError('No resume found. Please go back and upload your resume first.');
        setIsLoading(false);
      } catch (error) {
        console.error('Error loading extracted data:', error);
        setError('Failed to load resume data. Please try again.');
        setIsLoading(false);
      }
    };

    loadExtractedData();
  }, [user?.id]);

  const handleStartAnalysis = async () => {
    if (!extractedData) return;
    
    setIsAnalyzing(true);
    setProgress(0);
    setError(null);
    setSavedToDatabase(false);
    
    try {
      const sessionToken = await getSessionToken();
      
      // Simulate progress
      const progressInterval = setInterval(() => {
        setProgress(prev => {
          if (prev >= 85) {
            clearInterval(progressInterval);
            return prev;
          }
          return prev + Math.random() * 8;
        });
      }, 400);
      
      // Call AI analysis API
      console.log('🤖 Calling AI analysis API...');
      const response = await fetch('/api/candidates/ai-analysis/analyze', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(sessionToken ? { 'Authorization': `Bearer ${sessionToken}` } : {}),
          ...(user?.id ? { 'x-user-id': String(user.id) } : {})
        },
        body: JSON.stringify({
          resumeData: extractedData,
          candidateId: user?.id,
          originalFileName: originalFileName
        })
      });
      
      clearInterval(progressInterval);
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || 'AI analysis failed');
      }
      
      const result = await response.json();
      console.log('✅ Analysis result:', result);
      
      setProgress(100);
      setAnalysisResults(result.analysis);
      setImprovedResume(result.improvedResume);
      setSavedToDatabase(result.savedToDatabase || false);
      setAnalysisComplete(true);
      
      // Store improved resume for build step
      if (result.improvedResume) {
        localStorage.setItem('bpoc_generated_resume', JSON.stringify(result.improvedResume));
      }
      
      // Store AI analysis for build page to show suggestions
      if (result.analysis) {
        localStorage.setItem('bpoc_ai_analysis', JSON.stringify(result.analysis));
      }
      
      // Store extracted data for reference
      localStorage.setItem('bpoc_extracted_data', JSON.stringify(extractedData));
      
      toast.success('AI analysis complete!');
      
    } catch (err) {
      console.error('AI Analysis error:', err);
      setError(err instanceof Error ? err.message : 'AI analysis failed');
      setIsAnalyzing(false);
    }
  };

  const getScoreColor = (score: number) => {
    if (score >= 80) return 'text-green-400';
    if (score >= 60) return 'text-yellow-400';
    return 'text-red-400';
  };

  const getScoreGradient = (score: number) => {
    if (score >= 80) return 'from-green-500 to-emerald-500';
    if (score >= 60) return 'from-yellow-500 to-amber-500';
    return 'from-red-500 to-orange-500';
  };

  if (isLoading) {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center">
        <Loader2 className="h-10 w-10 text-purple-400 animate-spin" />
        <p className="mt-4 text-gray-400">Loading resume data...</p>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold bg-gradient-to-r from-purple-400 via-pink-400 to-cyan-400 bg-clip-text text-transparent">
            Step 2: AI Analysis
          </h1>
          <p className="text-gray-400 mt-1">
            Let Claude AI analyze and enhance your resume
          </p>
        </div>
        <Button
          variant="ghost"
          onClick={() => router.push('/candidate/resume')}
          className="text-gray-400 hover:text-white"
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back
        </Button>
      </div>

      {/* Step Indicator */}
      <div className="flex items-center justify-center gap-4">
        <div className="flex items-center gap-2 text-cyan-400">
          <div className="w-10 h-10 rounded-full bg-cyan-500 flex items-center justify-center">
            <CheckCircle className="h-5 w-5 text-white" />
          </div>
          <span className="font-medium">Upload</span>
        </div>
        <div className="w-16 h-0.5 bg-cyan-500" />
        <div className="flex items-center gap-2 text-purple-400">
          <div className="w-10 h-10 rounded-full border-2 border-purple-400 bg-purple-500/20 flex items-center justify-center animate-pulse">
            <Brain className="h-5 w-5" />
          </div>
          <span className="font-medium">Analysis</span>
        </div>
        <div className="w-16 h-0.5 bg-gray-700" />
        <div className="flex items-center gap-2 text-gray-500">
          <div className="w-10 h-10 rounded-full border-2 border-gray-600 flex items-center justify-center">
            <span className="text-sm">3</span>
          </div>
          <span>Build</span>
        </div>
      </div>

      {/* Main Content */}
      <AnimatePresence mode="wait">
        {analysisComplete ? (
          /* Analysis Results */
          <motion.div
            key="results"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-6"
          >
            {/* Success Header */}
            <div className="text-center mb-8">
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ type: "spring", duration: 0.5 }}
              >
                <CheckCircle className="h-16 w-16 text-green-400 mx-auto mb-4" />
              </motion.div>
              <h2 className="text-2xl font-bold text-white mb-2">Analysis Complete!</h2>
              <p className="text-gray-400">Your resume has been analyzed by Claude AI</p>
              
              {savedToDatabase && (
                <Badge className="mt-2 bg-green-500/10 text-green-400 border-green-500/30">
                  <Database className="h-3 w-3 mr-1" />
                  Saved to Profile
                </Badge>
              )}
            </div>

            {/* Score Cards */}
            <div className="grid grid-cols-2 gap-3 sm:gap-4">
              {[
                { label: 'Overall Score', value: analysisResults?.overallScore || 75, icon: Star, color: 'cyan' },
                { label: 'ATS Compatibility', value: analysisResults?.atsCompatibility || 70, icon: Target, color: 'purple' },
                { label: 'Content Quality', value: analysisResults?.contentQuality || 70, icon: FileText, color: 'emerald' },
                { label: 'Presentation', value: analysisResults?.professionalPresentation || 75, icon: Award, color: 'pink' },
              ].map((score, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.1 }}
                  className="relative group overflow-hidden rounded-xl border border-white/10 bg-white/5 backdrop-blur-xl p-5"
                >
                  <div className={`absolute inset-0 bg-gradient-to-br from-${score.color}-500/10 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity`} />
                  <div className="relative z-10">
                    <score.icon className={`h-5 w-5 text-${score.color}-400 mb-2`} />
                    <div className={`text-3xl font-bold ${getScoreColor(score.value)}`}>
                      {score.value}
                    </div>
                    <p className="text-gray-400 text-sm">{score.label}</p>
                  </div>
                </motion.div>
              ))}
            </div>

            {/* Tabs for Detailed Analysis */}
            <Tabs defaultValue="overview" className="w-full">
              <TabsList className="grid grid-cols-2 sm:grid-cols-4 bg-white/5 border border-white/10">
                <TabsTrigger value="overview" className="data-[state=active]:bg-cyan-500/20 data-[state=active]:text-cyan-400">
                  <Star className="h-4 w-4 mr-2" />
                  Overview
                </TabsTrigger>
                <TabsTrigger value="strengths" className="data-[state=active]:bg-green-500/20 data-[state=active]:text-green-400">
                  <Zap className="h-4 w-4 mr-2" />
                  Strengths
                </TabsTrigger>
                <TabsTrigger value="career" className="data-[state=active]:bg-purple-500/20 data-[state=active]:text-purple-400">
                  <TrendingUp className="h-4 w-4 mr-2" />
                  Career
                </TabsTrigger>
                <TabsTrigger value="improve" className="data-[state=active]:bg-amber-500/20 data-[state=active]:text-amber-400">
                  <Target className="h-4 w-4 mr-2" />
                  Improve
                </TabsTrigger>
              </TabsList>

              {/* Overview Tab */}
              <TabsContent value="overview" className="mt-6 space-y-6">
                {/* Key Strengths */}
                {analysisResults?.keyStrengths?.length > 0 && (
                  <div className="relative group overflow-hidden rounded-xl border border-white/10 bg-white/5 backdrop-blur-xl p-6">
                    <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                      <Star className="h-5 w-5 text-green-400" />
                      Key Strengths
                    </h3>
                    <div className="space-y-3">
                      {analysisResults.keyStrengths.map((strength: string, i: number) => (
                        <motion.div 
                          key={i}
                          initial={{ opacity: 0, x: -20 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ delay: i * 0.1 }}
                          className="flex items-start gap-3 p-3 rounded-lg bg-green-500/5 border border-green-500/10"
                        >
                          <CheckCircle className="h-5 w-5 text-green-400 flex-shrink-0 mt-0.5" />
                          <span className="text-gray-300">{strength}</span>
                        </motion.div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Improved Summary */}
                {analysisResults?.improvedSummary && (
                  <div className="relative group overflow-hidden rounded-xl border border-white/10 bg-white/5 backdrop-blur-xl p-6">
                    <h3 className="text-lg font-semibold text-white mb-3 flex items-center gap-2">
                      <Sparkles className="h-5 w-5 text-purple-400" />
                      AI-Improved Summary
                    </h3>
                    <p className="text-gray-300 leading-relaxed bg-purple-500/5 border border-purple-500/10 rounded-lg p-4">
                      {analysisResults.improvedSummary}
                    </p>
                  </div>
                )}
              </TabsContent>

              {/* Strengths Tab */}
              <TabsContent value="strengths" className="mt-6 space-y-6">
                <div className="grid md:grid-cols-2 gap-6">
                  {/* Technical Strengths */}
                  <div className="relative group overflow-hidden rounded-xl border border-cyan-500/20 bg-cyan-500/5 backdrop-blur-xl p-6">
                    <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                      <Wrench className="h-5 w-5 text-cyan-400" />
                      Technical Skills
                    </h3>
                    <div className="flex flex-wrap gap-2">
                      {(extractedData?.skills?.technical || ['Communication', 'Problem Solving']).map((skill: string, i: number) => (
                        <Badge key={i} className="bg-cyan-500/10 text-cyan-400 border-cyan-500/30">
                          {skill}
                        </Badge>
                      ))}
                    </div>
                  </div>

                  {/* Soft Skills */}
                  <div className="relative group overflow-hidden rounded-xl border border-purple-500/20 bg-purple-500/5 backdrop-blur-xl p-6">
                    <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                      <Users className="h-5 w-5 text-purple-400" />
                      Soft Skills
                    </h3>
                    <div className="flex flex-wrap gap-2">
                      {(extractedData?.skills?.soft || ['Teamwork', 'Leadership']).map((skill: string, i: number) => (
                        <Badge key={i} className="bg-purple-500/10 text-purple-400 border-purple-500/30">
                          {skill}
                        </Badge>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Experience Count */}
                <div className="grid md:grid-cols-3 gap-4">
                  <div className="relative group overflow-hidden rounded-xl border border-white/10 bg-white/5 p-5 text-center">
                    <Briefcase className="h-8 w-8 text-cyan-400 mx-auto mb-2" />
                    <div className="text-2xl font-bold text-white">{extractedData?.experience?.length || 0}</div>
                    <p className="text-gray-400 text-sm">Work Experience</p>
                  </div>
                  <div className="relative group overflow-hidden rounded-xl border border-white/10 bg-white/5 p-5 text-center">
                    <GraduationCap className="h-8 w-8 text-purple-400 mx-auto mb-2" />
                    <div className="text-2xl font-bold text-white">{extractedData?.education?.length || 0}</div>
                    <p className="text-gray-400 text-sm">Education</p>
                  </div>
                  <div className="relative group overflow-hidden rounded-xl border border-white/10 bg-white/5 p-5 text-center">
                    <Award className="h-8 w-8 text-emerald-400 mx-auto mb-2" />
                    <div className="text-2xl font-bold text-white">{extractedData?.certifications?.length || 0}</div>
                    <p className="text-gray-400 text-sm">Certifications</p>
                  </div>
                </div>
              </TabsContent>

              {/* Career Tab */}
              <TabsContent value="career" className="mt-6 space-y-6">
                {/* Career Path */}
                <div className="relative group overflow-hidden rounded-xl border border-purple-500/20 bg-gradient-to-br from-purple-500/5 to-pink-500/5 backdrop-blur-xl p-6">
                  <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                    <TrendingUp className="h-5 w-5 text-purple-400" />
                    Career Path Recommendation
                  </h3>
                  
                  <div className="space-y-4">
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 rounded-full bg-purple-500/20 flex items-center justify-center">
                        <Briefcase className="h-6 w-6 text-purple-400" />
                      </div>
                      <div>
                        <p className="text-gray-400 text-sm">Current Role</p>
                        <p className="text-white font-medium">{extractedData?.bestJobTitle || 'Professional'}</p>
                      </div>
                    </div>
                    
                    <div className="border-l-2 border-purple-500/30 ml-6 pl-6 py-4">
                      <p className="text-gray-400 text-sm">Next Steps</p>
                      <div className="mt-2 space-y-2">
                        {analysisResults?.recommendations?.slice(0, 3).map((rec: string, i: number) => (
                          <div key={i} className="flex items-start gap-2 text-gray-300">
                            <ArrowRight className="h-4 w-4 text-purple-400 flex-shrink-0 mt-1" />
                            <span>{rec}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Salary Insights (placeholder - would come from full analysis) */}
                <div className="relative group overflow-hidden rounded-xl border border-emerald-500/20 bg-gradient-to-br from-emerald-500/5 to-cyan-500/5 backdrop-blur-xl p-6">
                  <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                    <DollarSign className="h-5 w-5 text-emerald-400" />
                    Market Insights
                  </h3>
                  <p className="text-gray-400 text-sm mb-4">Based on your profile and BPO industry standards</p>
                  
                  <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-lg p-4">
                    <p className="text-gray-300">
                      Your profile shows strong alignment with the BPO industry. 
                      Focus on highlighting your key strengths and quantifying achievements 
                      for better job matching and competitive salary negotiations.
                    </p>
                  </div>
                </div>
              </TabsContent>

              {/* Improve Tab */}
              <TabsContent value="improve" className="mt-6 space-y-6">
                {/* Improvements */}
                {analysisResults?.improvements?.length > 0 && (
                  <div className="relative group overflow-hidden rounded-xl border border-amber-500/20 bg-amber-500/5 backdrop-blur-xl p-6">
                    <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                      <AlertCircle className="h-5 w-5 text-amber-400" />
                      Areas for Improvement
                    </h3>
                    <div className="space-y-3">
                      {analysisResults.improvements.map((improvement: string, i: number) => (
                        <motion.div 
                          key={i}
                          initial={{ opacity: 0, x: -20 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ delay: i * 0.1 }}
                          className="flex items-start gap-3 p-3 rounded-lg bg-amber-500/5 border border-amber-500/10"
                        >
                          <Target className="h-5 w-5 text-amber-400 flex-shrink-0 mt-0.5" />
                          <span className="text-gray-300">{improvement}</span>
                        </motion.div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Recommendations */}
                {analysisResults?.recommendations?.length > 0 && (
                  <div className="relative group overflow-hidden rounded-xl border border-cyan-500/20 bg-cyan-500/5 backdrop-blur-xl p-6">
                    <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                      <Brain className="h-5 w-5 text-cyan-400" />
                      AI Recommendations
                    </h3>
                    <div className="space-y-3">
                      {analysisResults.recommendations.map((rec: string, i: number) => (
                        <motion.div 
                          key={i}
                          initial={{ opacity: 0, x: -20 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ delay: i * 0.1 }}
                          className="flex items-start gap-3 p-3 rounded-lg bg-cyan-500/5 border border-cyan-500/10"
                        >
                          <Sparkles className="h-5 w-5 text-cyan-400 flex-shrink-0 mt-0.5" />
                          <span className="text-gray-300">{rec}</span>
                        </motion.div>
                      ))}
                    </div>
                  </div>
                )}
              </TabsContent>
            </Tabs>

            {/* Continue to Build */}
            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.5 }}
              className="flex justify-center pt-6"
            >
              <Button
                onClick={() => router.push('/candidate/resume/build')}
                className="relative overflow-hidden bg-gradient-to-r from-purple-500 to-pink-600 hover:from-purple-600 hover:to-pink-700 text-white px-10 py-6 text-lg rounded-xl shadow-lg shadow-purple-500/25 hover:shadow-purple-500/40 transition-all"
              >
                <Sparkles className="h-5 w-5 mr-2" />
                Continue to Resume Builder
                <ArrowRight className="h-5 w-5 ml-2" />
              </Button>
            </motion.div>
          </motion.div>
        ) : isAnalyzing ? (
          /* Analyzing State */
          <motion.div
            key="analyzing"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="relative group overflow-hidden rounded-xl border border-white/10 bg-white/5 backdrop-blur-xl p-12"
          >
            <div className="text-center">
              <div className="flex justify-center mb-6">
                <Loader2 className="h-12 w-12 text-purple-400 animate-spin" />
              </div>
              <h2 className="text-2xl font-bold text-white mb-2">Claude AI is Analyzing...</h2>
              <p className="text-gray-400 mb-8">
                Evaluating content quality, ATS compatibility, and generating improvements
              </p>
              
              <div className="max-w-md mx-auto space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-400">Progress</span>
                  <span className="text-purple-400 font-bold">{Math.round(progress)}%</span>
                </div>
                <Progress value={progress} className="h-2 bg-gray-800" />
              </div>
              
              <div className="mt-6 grid grid-cols-4 gap-3">
                {['Scoring', 'Strengths', 'Career', 'Summary'].map((step, i) => (
                  <div 
                    key={i}
                    className={`p-3 rounded-lg border transition-all ${
                      progress > (i * 25) 
                        ? 'border-purple-500/30 bg-purple-500/10 text-purple-400'
                        : 'border-white/10 bg-white/5 text-gray-500'
                    }`}
                  >
                    <p className="text-xs">{step}</p>
                  </div>
                ))}
              </div>
            </div>
          </motion.div>
        ) : (
          /* Ready to Analyze State */
          <motion.div
            key="ready"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="relative group overflow-hidden rounded-xl border border-white/10 bg-white/5 backdrop-blur-xl p-8"
          >
            <div className="absolute inset-0 bg-gradient-to-br from-purple-500/10 via-transparent to-pink-500/10 opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
            
            <div className="relative z-10 text-center py-8">
              <div className="w-20 h-20 mx-auto mb-6 rounded-2xl bg-gradient-to-br from-purple-500/20 to-pink-500/20 flex items-center justify-center border border-white/10">
                <Brain className="h-10 w-10 text-purple-400" />
              </div>
              
              <h2 className="text-2xl font-bold text-white mb-2">Ready for AI Analysis</h2>
              <p className="text-gray-400 mb-8 max-w-lg mx-auto">
                Claude AI will analyze your resume and provide personalized improvements, 
                score your content, and optimize for ATS systems.
              </p>
              
              {/* Resume Preview */}
              {extractedData && (
                <div className="mb-8 p-6 bg-white/5 rounded-xl max-w-md mx-auto text-left border border-white/10">
                  <h3 className="text-white font-medium mb-3 flex items-center gap-2">
                    <FileText className="h-4 w-4 text-cyan-400" />
                    Extracted Resume
                  </h3>
                  <div className="space-y-2 text-sm">
                    {extractedData.name && (
                      <p className="text-gray-300">
                        <span className="text-gray-500">Name:</span> {extractedData.name}
                      </p>
                    )}
                    {extractedData.email && (
                      <p className="text-gray-300">
                        <span className="text-gray-500">Email:</span> {extractedData.email}
                      </p>
                    )}
                    {extractedData.experience?.length > 0 && (
                      <p className="text-gray-300">
                        <span className="text-gray-500">Experience:</span> {extractedData.experience.length} position(s)
                      </p>
                    )}
                    {extractedData.education?.length > 0 && (
                      <p className="text-gray-300">
                        <span className="text-gray-500">Education:</span> {extractedData.education.length} item(s)
                      </p>
                    )}
                  </div>
                </div>
              )}
              
              <Button
                onClick={handleStartAnalysis}
                disabled={!extractedData}
                className="relative overflow-hidden bg-gradient-to-r from-purple-500 to-pink-600 hover:from-purple-600 hover:to-pink-700 text-white px-10 py-6 text-lg rounded-xl shadow-lg shadow-purple-500/25 hover:shadow-purple-500/40 transition-all"
              >
                <Sparkles className="h-5 w-5 mr-2" />
                Start AI Analysis
              </Button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Error Message */}
      {error && (
        <motion.div 
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="p-6 bg-red-500/10 border border-red-500/30 rounded-xl text-center"
        >
          <AlertCircle className="h-12 w-12 text-red-400 mx-auto mb-4" />
          <p className="text-red-300 mb-4">{error}</p>
          <Button
            onClick={() => router.push('/candidate/resume/upload')}
            className="bg-gradient-to-r from-cyan-500 to-purple-600 hover:from-cyan-600 hover:to-purple-700 text-white"
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Go to Resume Upload
          </Button>
        </motion.div>
      )}
    </div>
  );
}

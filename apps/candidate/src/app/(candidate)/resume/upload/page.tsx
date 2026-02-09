'use client';

import React, { useState, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Upload, 
  FileText, 
  Loader2,
  ArrowLeft,
  ArrowRight,
  CheckCircle,
  AlertCircle,
  X,
  Sparkles,
  Brain
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';

/**
 * Step 1: Resume Upload
 * Handles file upload and extraction via API
 */
export default function ResumeUploadPage() {
  const router = useRouter();
  const { user, session } = useAuth();
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const [file, setFile] = useState<File | null>(null);
  const [dragActive, setDragActive] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [progressText, setProgressText] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [uploadComplete, setUploadComplete] = useState(false);

  const handleDrag = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    const droppedFile = e.dataTransfer.files[0];
    if (droppedFile) {
      validateAndSetFile(droppedFile);
    }
  }, []);

  const validateAndSetFile = (selectedFile: File) => {
    setError(null);

    const validTypes = [
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'image/jpeg',
      'image/png'
    ];
    
    const isValidType = validTypes.some(t => selectedFile.type.includes(t.split('/')[1] ?? '')) ||
                        selectedFile.name.endsWith('.pdf') ||
                        selectedFile.name.endsWith('.doc') ||
                        selectedFile.name.endsWith('.docx');

    if (!isValidType) {
      setError('Please upload a PDF, DOC, DOCX, or image file');
      return;
    }

    if (selectedFile.size > 10 * 1024 * 1024) {
      setError('File too large. Maximum 10MB.');
      return;
    }

    setFile(selectedFile);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      validateAndSetFile(selectedFile);
    }
  };

  const processResume = async () => {
    if (!file || !user?.id) return;

    setIsProcessing(true);
    setError(null);
    setProgress(0);

    // Progress simulation
    const progressSteps = [
      { pct: 15, text: '📤 Uploading file...' },
      { pct: 35, text: '🔄 Converting document...' },
      { pct: 55, text: '🔍 Extracting content...' },
      { pct: 75, text: '🤖 Processing with AI...' },
      { pct: 90, text: '💾 Saving data...' },
    ];

    let stepIndex = 0;
    const progressInterval = setInterval(() => {
      const step = progressSteps[stepIndex];
      if (stepIndex < progressSteps.length && step) {
        setProgress(step.pct);
        setProgressText(step.text);
        stepIndex++;
      }
    }, 800);

    try {
      // Convert file to base64
      const base64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });

      // Call the process API
      const response = await fetch('/api/candidates/resume/process', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-user-id': user.id,
          ...(session?.access_token ? { 'Authorization': `Bearer ${session.access_token}` } : {})
        },
        body: JSON.stringify({
          file: {
            data: base64,
            name: file.name,
            type: file.type,
            size: file.size
          },
          useAI: true
        })
      });

      clearInterval(progressInterval);

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || 'Failed to process resume');
      }

      const result = await response.json();
      console.log('✅ Resume processed:', result);

      // Save to localStorage for the analysis step
      if (result.resumeData) {
        localStorage.setItem('bpoc_extracted_resume', JSON.stringify(result.resumeData));
        localStorage.setItem('bpoc_original_filename', file.name);
      }

      // Also save extracted data to database
      try {
        await fetch('/api/candidates/resume/save-extracted', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-user-id': user.id,
            ...(session?.access_token ? { 'Authorization': `Bearer ${session.access_token}` } : {})
          },
          body: JSON.stringify({
            extractedData: result.resumeData,
            originalFileName: file.name
          })
        });
      } catch (saveErr) {
        console.warn('Could not save to database:', saveErr);
      }

      setProgress(100);
      setProgressText('✅ Processing complete!');
      setUploadComplete(true);

      // Auto-redirect after a moment
      setTimeout(() => {
        router.push('/resume/analysis');
      }, 1500);

    } catch (err) {
      clearInterval(progressInterval);
      console.error('Resume processing error:', err);
      setError(err instanceof Error ? err.message : 'Something went wrong');
      setIsProcessing(false);
    }
  };

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold bg-gradient-to-r from-cyan-400 via-purple-400 to-pink-400 bg-clip-text text-transparent">
            Step 1: Upload Resume
          </h1>
          <p className="text-gray-400 mt-1">
            Upload your existing resume to get started
          </p>
        </div>
        <Button
          variant="ghost"
          onClick={() => router.push('/resume')}
          className="text-gray-400 hover:text-white"
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back
        </Button>
      </div>

      {/* Step Indicator */}
      <div className="flex items-center justify-center gap-4">
        <div className="flex items-center gap-2 text-cyan-400">
          <div className="w-10 h-10 rounded-full border-2 border-cyan-400 bg-cyan-500/20 flex items-center justify-center animate-pulse">
            <Upload className="h-5 w-5" />
          </div>
          <span className="font-medium">Upload</span>
        </div>
        <div className="w-16 h-0.5 bg-gray-700" />
        <div className="flex items-center gap-2 text-gray-500">
          <div className="w-10 h-10 rounded-full border-2 border-gray-600 flex items-center justify-center">
            <Brain className="h-5 w-5" />
          </div>
          <span>Analysis</span>
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
        {uploadComplete ? (
          <motion.div
            key="complete"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="relative overflow-hidden rounded-2xl border border-green-500/30 bg-green-500/5 backdrop-blur-xl p-12 text-center"
          >
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ type: "spring", duration: 0.5 }}
            >
              <CheckCircle className="h-20 w-20 text-green-400 mx-auto mb-6" />
            </motion.div>
            <h2 className="text-2xl font-bold text-white mb-2">Resume Uploaded!</h2>
            <p className="text-gray-400 mb-6">Redirecting to AI Analysis...</p>
            <div className="flex justify-center">
              <Loader2 className="h-6 w-6 text-green-400 animate-spin" />
            </div>
          </motion.div>
        ) : isProcessing ? (
          <motion.div
            key="processing"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="relative overflow-hidden rounded-2xl border border-white/10 bg-white/5 backdrop-blur-xl p-12"
          >
            <div className="text-center">
              <div className="w-24 h-24 mx-auto mb-6 relative">
                <div className="absolute inset-0 rounded-full border-4 border-cyan-500/20" />
                <motion.div
                  className="absolute inset-0 rounded-full border-4 border-cyan-400 border-t-transparent"
                  animate={{ rotate: 360 }}
                  transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
                />
                <div className="absolute inset-0 flex items-center justify-center">
                  <span className="text-2xl font-bold text-white">{Math.round(progress)}%</span>
                </div>
              </div>
              
              <motion.p
                key={progressText}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="text-xl font-semibold text-white mb-2"
              >
                {progressText}
              </motion.p>
              <p className="text-gray-400">This usually takes 15-30 seconds...</p>
            </div>
          </motion.div>
        ) : (
          <motion.div
            key="upload"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="relative overflow-hidden rounded-2xl border border-white/10 bg-white/5 backdrop-blur-xl p-8"
          >
            {/* Drop Zone */}
            <div
              className={`relative border-2 border-dashed rounded-2xl p-16 transition-all duration-300 cursor-pointer group ${
                dragActive
                  ? 'border-cyan-400 bg-cyan-400/10 shadow-[0_0_30px_rgba(0,217,255,0.2)]'
                  : file
                    ? 'border-green-500/50 bg-green-500/5'
                    : 'border-white/20 hover:border-cyan-400/50 hover:bg-white/5'
              }`}
              onDragEnter={handleDrag}
              onDragLeave={handleDrag}
              onDragOver={handleDrag}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept=".pdf,.doc,.docx,.jpg,.jpeg,.png"
                onChange={handleFileChange}
                className="hidden"
              />

              <div className="text-center">
                {file ? (
                  <motion.div initial={{ scale: 0.8 }} animate={{ scale: 1 }}>
                    <div className="w-20 h-20 mx-auto mb-6 rounded-2xl bg-gradient-to-br from-green-500 to-emerald-500 flex items-center justify-center shadow-lg shadow-green-500/30">
                      <FileText className="w-10 h-10 text-white" />
                    </div>
                    <p className="text-white font-bold text-lg mb-2">{file.name}</p>
                    <p className="text-gray-400 text-sm mb-4">{(file.size / 1024).toFixed(1)} KB</p>
                    <button
                      onClick={(e) => { e.stopPropagation(); setFile(null); }}
                      className="text-gray-400 hover:text-white text-sm flex items-center gap-2 mx-auto px-4 py-2 rounded-lg hover:bg-white/10 transition-all"
                    >
                      <X className="w-4 h-4" /> Remove File
                    </button>
                  </motion.div>
                ) : (
                  <>
                    <motion.div
                      whileHover={{ scale: 1.05 }}
                      className="w-20 h-20 mx-auto mb-6 rounded-2xl bg-white/10 flex items-center justify-center group-hover:bg-cyan-500/10 group-hover:border group-hover:border-cyan-500/30 transition-all"
                    >
                      <Upload className="w-10 h-10 text-gray-400 group-hover:text-cyan-400 transition-colors" />
                    </motion.div>
                    <p className="text-white font-bold text-xl mb-2">Drop your resume here</p>
                    <p className="text-gray-400 text-base mb-4">or click to browse your files</p>
                    <div className="inline-flex items-center gap-3 px-4 py-2 rounded-full bg-white/5 border border-white/10 text-gray-500 text-sm">
                      <span>Supported:</span>
                      <span className="text-cyan-400 font-medium">PDF, DOC, DOCX, JPG, PNG</span>
                      <span>•</span>
                      <span className="text-purple-400 font-medium">Max 10MB</span>
                    </div>
                  </>
                )}
              </div>
            </div>

            {/* Error Message */}
            {error && (
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                className="mt-6 p-5 rounded-xl bg-red-500/10 border border-red-500/20 flex items-center gap-4"
              >
                <AlertCircle className="w-6 h-6 text-red-400 flex-shrink-0" />
                <p className="text-red-300 font-medium">{error}</p>
              </motion.div>
            )}

            {/* Process Button */}
            <motion.div whileHover={{ scale: file ? 1.02 : 1 }} whileTap={{ scale: file ? 0.98 : 1 }}>
              <Button
                onClick={processResume}
                disabled={!file}
                className="w-full mt-8 h-16 text-lg font-bold rounded-2xl bg-gradient-to-r from-cyan-500 to-purple-600 hover:from-cyan-400 hover:to-purple-500 disabled:opacity-40 disabled:cursor-not-allowed border-0 shadow-[0_0_30px_rgba(0,217,255,0.3)] hover:shadow-[0_0_50px_rgba(0,217,255,0.5)] transition-all duration-300"
              >
                <Sparkles className="w-5 h-5 mr-2" />
                Process Resume with AI
                <ArrowRight className="w-5 h-5 ml-2" />
              </Button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

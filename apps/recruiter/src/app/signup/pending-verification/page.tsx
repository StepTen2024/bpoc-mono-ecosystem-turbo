'use client';

import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import Link from 'next/link';
import {
  Clock,
  Shield,
  CheckCircle,
  AlertCircle,
  ArrowRight,
  FileText,
  RefreshCw,
} from 'lucide-react';
import { Button } from '@/components/shared/ui/button';
import { AnimatedLogo } from '@/components/shared/ui/AnimatedLogo';
import { createClient } from '@supabase/supabase-js';
import { useRouter } from 'next/navigation';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export default function PendingVerificationPage() {
  const router = useRouter();
  const [checking, setChecking] = useState(false);
  const [status, setStatus] = useState<'pending_admin_review' | 'verified' | 'rejected'>('pending_admin_review');

  useEffect(() => {
    checkStatus();
    // Poll every 10 seconds (AI verification is fast)
    const interval = setInterval(checkStatus, 10000);
    return () => clearInterval(interval);
  }, []);

  const checkStatus = async () => {
    setChecking(true);
    try {
      const response = await fetch('/api/recruiter/verify');
      const data = await response.json();

      if (data.recruiter) {
        setStatus(data.recruiter.verification_status);

        // If verified, redirect to dashboard
        if (data.recruiter.verification_status === 'verified') {
          setTimeout(() => {
            router.push('/recruiter');
          }, 2000);
        }
      }
    } catch (error) {
      console.error('Error checking status:', error);
    } finally {
      setChecking(false);
    }
  };

  if (status === 'verified') {
    return (
      <div className="min-h-screen bg-[#0B0B0D] flex items-center justify-center px-4">
        <div className="max-w-md w-full text-center">
          <div className="w-20 h-20 mx-auto mb-6 rounded-full bg-green-500/20 flex items-center justify-center">
            <CheckCircle className="h-10 w-10 text-green-500" />
          </div>
          <h2 className="text-2xl font-bold text-white mb-4">You're Verified!</h2>
          <p className="text-gray-400 mb-6">Your account has been approved. Redirecting to your dashboard...</p>
          <Link href="/recruiter">
            <Button className="bg-gradient-to-r from-orange-500 to-amber-600">
              Go to Dashboard
              <ArrowRight className="ml-2 w-4 h-4" />
            </Button>
          </Link>
        </div>
      </div>
    );
  }

  if (status === 'rejected') {
    return (
      <div className="min-h-screen bg-[#0B0B0D] flex items-center justify-center px-4">
        <div className="max-w-md w-full text-center">
          <div className="w-20 h-20 mx-auto mb-6 rounded-full bg-red-500/20 flex items-center justify-center">
            <AlertCircle className="h-10 w-10 text-red-500" />
          </div>
          <h2 className="text-2xl font-bold text-white mb-4">Application Rejected</h2>
          <p className="text-gray-400 mb-6">Your documents could not be verified. Please contact support for more information.</p>
          <Link href="mailto:support@bpoc.io">
            <Button className="bg-gradient-to-r from-orange-500 to-amber-600">
              Contact Support
            </Button>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0B0B0D] selection:bg-orange-500/20 selection:text-orange-200">
      {/* Background Ambience */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none z-0">
        <div className="absolute top-[-10%] right-[-10%] w-[800px] h-[800px] bg-orange-500/5 rounded-full blur-[120px] animate-pulse-slow" />
        <div className="absolute bottom-[-10%] left-[-10%] w-[800px] h-[800px] bg-amber-500/5 rounded-full blur-[120px] animate-pulse-slow delay-1000" />
      </div>

      {/* Nav */}
      <motion.nav
        initial={{ y: -100 }}
        animate={{ y: 0 }}
        className="sticky top-0 z-50 border-b border-white/5 bg-[#0B0B0D]/80 backdrop-blur-md"
      >
        <div className="container mx-auto px-6 h-20 flex items-center justify-between">
          <Link href="/" className="flex items-center space-x-3 group">
            <div className="w-10 h-10 relative flex items-center justify-center rounded-xl bg-white/5 border border-white/10 overflow-hidden group-hover:border-orange-500/50 transition-colors">
              <AnimatedLogo className="from-orange-400 via-amber-500 to-yellow-500" />
            </div>
            <div className="flex flex-col">
              <span className="font-bold text-xl tracking-tight text-white group-hover:text-orange-400 transition-colors">BPOC.IO</span>
              <span className="text-[10px] tracking-wider text-orange-500 font-mono uppercase">Recruiter</span>
            </div>
          </Link>
          <div className="flex items-center gap-4">
            <Link href="/login">
              <Button variant="ghost" className="text-gray-400 hover:text-white">
                Sign Out
              </Button>
            </Link>
          </div>
        </div>
      </motion.nav>

      <main className="relative z-10 py-20">
        <div className="container mx-auto px-6 max-w-2xl">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-center"
          >
            <div className="w-24 h-24 mx-auto mb-8 rounded-full bg-orange-500/20 flex items-center justify-center relative">
              <Shield className="h-12 w-12 text-orange-400" />
              <motion.div
                animate={{ rotate: 360 }}
                transition={{ duration: 3, repeat: Infinity, ease: "linear" }}
                className="absolute inset-0 rounded-full border-2 border-transparent border-t-orange-500/50"
              />
            </div>

            <h1 className="text-4xl font-bold text-white mb-4">
              Documents Under Review
            </h1>

            <p className="text-xl text-gray-400 mb-8">
              Your documents have been submitted for verification. Our AI will review them and you'll be approved automatically if everything checks out.
            </p>

            {/* Status Card */}
            <div className="bg-[#121217] border border-white/10 rounded-2xl p-8 text-left mb-8">
              <div className="space-y-6">
                {/* Step 1 */}
                <div className="flex items-start gap-4">
                  <div className="w-8 h-8 rounded-full bg-green-500/20 flex items-center justify-center flex-shrink-0">
                    <CheckCircle className="w-4 h-4 text-green-500" />
                  </div>
                  <div>
                    <p className="text-white font-medium mb-1">Account created</p>
                    <p className="text-sm text-gray-400">You successfully signed up and claimed authorization</p>
                  </div>
                </div>

                {/* Step 2 */}
                <div className="flex items-start gap-4">
                  <div className="w-8 h-8 rounded-full bg-green-500/20 flex items-center justify-center flex-shrink-0">
                    <CheckCircle className="w-4 h-4 text-green-500" />
                  </div>
                  <div>
                    <p className="text-white font-medium mb-1">Documents uploaded</p>
                    <p className="text-sm text-gray-400">TIN, DTI, business permit, and SEC registration</p>
                  </div>
                </div>

                {/* Step 3 */}
                <div className="flex items-start gap-4">
                  <div className="w-8 h-8 rounded-full bg-orange-500/20 flex items-center justify-center flex-shrink-0 relative">
                    <FileText className="w-4 h-4 text-orange-400" />
                    <motion.div
                      animate={{ scale: [1, 1.3, 1] }}
                      transition={{ duration: 2, repeat: Infinity }}
                      className="absolute inset-0 rounded-full border-2 border-orange-500/30"
                    />
                  </div>
                  <div>
                    <p className="text-white font-medium mb-1">Admin reviewing documents</p>
                    <p className="text-sm text-gray-400">Our team is verifying your company information</p>
                  </div>
                </div>

                {/* Step 4 */}
                <div className="flex items-start gap-4 opacity-50">
                  <div className="w-8 h-8 rounded-full bg-white/5 flex items-center justify-center flex-shrink-0">
                    <CheckCircle className="w-4 h-4 text-gray-500" />
                  </div>
                  <div>
                    <p className="text-gray-500 font-medium mb-1">Account activated</p>
                    <p className="text-sm text-gray-500">You'll get full access to the recruiter dashboard</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Info Box */}
            <div className="p-4 rounded-lg bg-blue-500/10 border border-blue-500/20 flex items-start gap-3 text-left mb-8">
              <AlertCircle className="w-5 h-5 text-blue-400 flex-shrink-0 mt-0.5" />
              <div className="text-sm text-blue-400">
                <p className="font-medium mb-1">What we're checking</p>
                <p className="text-blue-300/80">
                  We verify that your TIN, DTI, business permit, and SEC registration are valid and match your agency information. This protects both recruiters and candidates on our platform.
                </p>
              </div>
            </div>

            {/* Timeline */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
              <div className="text-center">
                <div className="text-2xl font-bold text-orange-400 mb-1">&lt;1 hour</div>
                <div className="text-xs text-gray-500">Average review time</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-orange-400 mb-1">A few minutes</div>
                <div className="text-xs text-gray-500">Maximum wait time</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-orange-400 mb-1">99%</div>
                <div className="text-xs text-gray-500">Approval rate</div>
              </div>
            </div>

            {/* Actions */}
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Button
                onClick={checkStatus}
                disabled={checking}
                variant="outline"
                className="border-white/10 hover:border-orange-500/50 text-white"
              >
                {checking ? (
                  <>
                    <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                    Checking Status...
                  </>
                ) : (
                  <>
                    <RefreshCw className="w-4 h-4 mr-2" />
                    Refresh Status
                  </>
                )}
              </Button>

              <Link href="/login">
                <Button variant="ghost" className="text-gray-400 hover:text-white">
                  Sign Out
                </Button>
              </Link>
            </div>

            {/* Email Notice */}
            <p className="text-sm text-gray-500 mt-8">
              We'll email you immediately once your account is approved. You can also check back here anytime.
            </p>
          </motion.div>
        </div>
      </main>
    </div>
  );
}

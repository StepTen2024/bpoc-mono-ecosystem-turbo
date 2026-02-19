'use client';

import React, { useState, useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import RecruiterSidebar from '@/components/recruiter/RecruiterSidebar';
import { Loader2, AlertCircle, Clock, FileText, CheckCircle2, Menu, X, Upload, Shield, ArrowRight, Rocket, Sparkles, Users, Briefcase, Search, BookOpen } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { NotificationBell } from '@/components/shared/NotificationBell';
import { Button } from '@/components/shared/ui/button';

interface Recruiter {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  agency_id: string;
  avatar_url?: string;
  verificationStatus?: string;
  agency?: {
    id: string;
    name: string;
    logo_url?: string;
    is_verified?: boolean;
    document_expiry_date?: string;
    business_permit_expiry?: string;
  };
}

// Get saved sidebar state from localStorage
const getSavedSidebarState = (): boolean => {
  if (typeof window === 'undefined') return false;
  const saved = localStorage.getItem('recruiter-sidebar-collapsed');
  return saved === 'true';
};

export default function RecruiterLayoutClient({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const { user, session, loading: authLoading, signOut } = useAuth();
  const [loading, setLoading] = useState(true);
  const [recruiter, setRecruiter] = useState<Recruiter | null>(null);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [isDesktop, setIsDesktop] = useState(false);
  const [showVerificationModal, setShowVerificationModal] = useState(false);
  const [showVerifiedCelebration, setShowVerifiedCelebration] = useState(false);

  // Track viewport for sidebar margin
  useEffect(() => {
    const checkDesktop = () => setIsDesktop(window.innerWidth >= 1024);
    checkDesktop();
    window.addEventListener('resize', checkDesktop);
    return () => window.removeEventListener('resize', checkDesktop);
  }, []);

  // Load sidebar state on mount
  useEffect(() => {
    setSidebarCollapsed(getSavedSidebarState());
  }, []);

  const handleToggleSidebar = () => {
    const newState = !sidebarCollapsed;
    setSidebarCollapsed(newState);
    localStorage.setItem('recruiter-sidebar-collapsed', String(newState));
  };

  // Skip auth check for login/signup/demo/command-center pages
  const isAuthPage = pathname === '/login' || pathname === '/signup' || pathname === '/demo' || pathname === '/command-center';

  // Skip verification check for specific pages where redirects go
  const isVerificationPage = pathname?.startsWith('/signup/documents') ||
                               pathname?.startsWith('/signup/pending-verification') ||
                               pathname?.startsWith('/signup/awaiting-authorization');

  // Show modal every time for unverified recruiters until docs are uploaded
  useEffect(() => {
    if (recruiter?.verificationStatus && 
        recruiter.verificationStatus !== 'verified' &&
        recruiter.verificationStatus !== 'rejected' &&
        recruiter.verificationStatus !== 'pending_admin_review' &&
        !isAuthPage && !isVerificationPage) {
      setShowVerificationModal(true);
    }
  }, [recruiter, isAuthPage, isVerificationPage]);

  // Show celebration when recruiter becomes verified
  // Track previous status to detect the transition - only show ONCE per recruiter ever
  useEffect(() => {
    if (recruiter?.verificationStatus === 'verified' && !isAuthPage) {
      // Show if we haven't celebrated for THIS recruiter (persists across sessions)
      const celebratedForId = localStorage.getItem('verification-celebrated-id');
      if (celebratedForId !== recruiter.id) {
        setShowVerifiedCelebration(true);
        localStorage.setItem('verification-celebrated-id', recruiter.id);
      }
    }
  }, [recruiter, isAuthPage]);

  useEffect(() => {
    if (isAuthPage) {
      setLoading(false);
      return;
    }

    const checkAuth = async () => {
      try {
        if (authLoading) return;

        if (!session || !user) {
          router.push('/login');
          return;
        }

        // Verify recruiter status
        const response = await fetch('/api/recruiter/verify', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ userId: user.id }),
        });

        const data = await response.json();

        if (!response.ok || !data.isRecruiter) {
          await signOut();
          router.push('/login');
          return;
        }

        setRecruiter(data.recruiter);

        // Allow ALL verified statuses to see the dashboard with a banner
        // Only redirect to verification pages if user navigates there directly
        // The dashboard shows status banners for unverified recruiters
        if (data.recruiter) {
          const status = data.recruiter.verificationStatus;

          if (status === 'rejected') {
            // Rejected recruiters can still see dashboard with rejection banner
            // Could create a dedicated rejection page later
          }
          // All other statuses (pending_documents, pending_admin_review, 
          // pending_authorization_head, verified) — let them see the dashboard
          // with the appropriate status banner shown in the layout
        }
      } catch (error) {
        console.error('Auth check failed:', error);
        router.push('/login');
      } finally {
        setLoading(false);
      }
    };

    checkAuth();
  }, [isAuthPage, router, pathname, authLoading, session, user, signOut]);

  const handleSignOut = async () => {
    await signOut();
    router.push('/login');
  };

  // For auth pages, render without sidebar
  if (isAuthPage) {
    return <>{children}</>;
  }

  // Loading state
  if (loading) {
    return (
      <div className="min-h-screen bg-[#0a0a0f] flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="h-8 w-8 text-orange-500 animate-spin mx-auto mb-4" />
          <p className="text-gray-400">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0a0a0f]">
      {/* Background Effects */}
      <div className="fixed inset-0 pointer-events-none">
        <div className="absolute top-0 right-0 w-[600px] h-[600px] bg-orange-500/5 rounded-full blur-[120px]" />
        <div className="absolute bottom-0 left-0 w-[600px] h-[600px] bg-amber-500/5 rounded-full blur-[120px]" />
        {/* Grid Pattern */}
        <div 
          className="absolute inset-0 opacity-[0.03]"
          style={{
            backgroundImage: `linear-gradient(to right, white 1px, transparent 1px), linear-gradient(to bottom, white 1px, transparent 1px)`,
            backgroundSize: '40px 40px',
          }}
        />
      </div>

      {/* Sidebar */}
      <RecruiterSidebar 
        recruiter={recruiter ? {
          ...recruiter,
          id: recruiter.id,
          agency_id: recruiter.agency_id,
        } : undefined} 
        onSignOut={handleSignOut}
        collapsed={sidebarCollapsed}
        onToggleCollapse={handleToggleSidebar}
        mobileOpen={mobileMenuOpen}
        onMobileClose={() => setMobileMenuOpen(false)}
      />

      {/* Main Content - adjusts based on sidebar state */}
      <motion.main
        className="min-h-screen relative z-10"
        animate={{ marginLeft: isDesktop ? (sidebarCollapsed ? 80 : 256) : 0 }}
        transition={{ duration: 0.2, ease: 'easeInOut' }}
      >
        <div className="p-4 md:p-6 lg:p-8">
          {/* Mobile header with hamburger */}
          <div className="flex items-center justify-between mb-4 lg:justify-end">
            <button
              onClick={() => setMobileMenuOpen(true)}
              className="lg:hidden p-2 rounded-lg text-gray-400 hover:text-white hover:bg-white/10 transition-colors"
              aria-label="Open menu"
            >
              <Menu className="h-6 w-6" />
            </button>
            <NotificationBell />
          </div>

          {/* Verified Success Banner */}
          {recruiter?.verificationStatus === 'verified' && pathname === '/recruiter' && (
            <div className="mb-6">
              <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-lg p-4 flex items-start gap-4">
                <CheckCircle2 className="h-6 w-6 text-emerald-400 flex-shrink-0 mt-1" />
                <div className="flex-1">
                  <h3 className="text-emerald-400 font-semibold mb-1">Agency Verified ✅</h3>
                  <p className="text-gray-300 text-sm">
                    Your agency is fully verified and active. Add clients, post jobs, and start recruiting!
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Document Expiry Warning */}
          {recruiter?.agency?.document_expiry_date && (() => {
            const expiry = new Date(recruiter.agency!.document_expiry_date!);
            if (isNaN(expiry.getTime())) return null;
            const now = new Date();
            const daysUntil = Math.ceil((expiry.getTime() - now.getTime()) / 86400000);
            const isExpired = daysUntil < 0;
            const isExpiringSoon = daysUntil >= 0 && daysUntil <= 30;
            
            if (isExpired) return (
              <div className="mb-6">
                <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-4 flex items-start gap-4">
                  <AlertCircle className="h-6 w-6 text-red-400 flex-shrink-0 mt-1" />
                  <div className="flex-1">
                    <h3 className="text-red-400 font-semibold mb-1">⚠️ Documents Expired</h3>
                    <p className="text-gray-300 text-sm">
                      Your agency documents expired on {expiry.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}. 
                      Please upload updated documents to maintain your verified status.
                    </p>
                  </div>
                </div>
              </div>
            );
            
            if (isExpiringSoon) return (
              <div className="mb-6">
                <div className="bg-amber-500/10 border border-amber-500/30 rounded-lg p-4 flex items-start gap-4">
                  <Clock className="h-6 w-6 text-amber-400 flex-shrink-0 mt-1" />
                  <div className="flex-1">
                    <h3 className="text-amber-400 font-semibold mb-1">📋 Documents Expiring Soon</h3>
                    <p className="text-gray-300 text-sm">
                      Your agency documents expire in {daysUntil} days ({expiry.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}). 
                      Please prepare updated documents.
                    </p>
                  </div>
                </div>
              </div>
            );
            
            return null;
          })()}

          {/* Verification Status Banner */}
          {recruiter?.verificationStatus && recruiter.verificationStatus !== 'verified' && (
            <div className="mb-6">
              {recruiter.verificationStatus === 'pending_documents' && (
                <div className="bg-orange-500/10 border border-orange-500/30 rounded-lg p-4 flex items-start gap-4">
                  <FileText className="h-6 w-6 text-orange-400 flex-shrink-0 mt-1" />
                  <div className="flex-1">
                    <h3 className="text-orange-400 font-semibold mb-1">Upload Required Documents</h3>
                    <p className="text-gray-300 text-sm mb-3">
                      Please upload your agency documents (TIN, DTI Certificate, Business Permit, SEC Registration) to activate your account.
                    </p>
                    <Button
                      onClick={() => router.push('/signup/documents')}
                      className="bg-orange-500 hover:bg-orange-600"
                    >
                      Upload Documents
                    </Button>
                  </div>
                </div>
              )}
              {recruiter.verificationStatus === 'pending_admin_review' && (
                <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-4 flex items-start gap-4">
                  <Clock className="h-6 w-6 text-blue-400 flex-shrink-0 mt-1" />
                  <div className="flex-1">
                    <h3 className="text-blue-400 font-semibold mb-1">Documents Under Review</h3>
                    <p className="text-gray-300 text-sm">
                      Your documents are being verified automatically by AI. This usually takes just a few minutes.
                    </p>
                  </div>
                </div>
              )}
              {recruiter.verificationStatus === 'pending_authorization_head' && (
                <div className="bg-amber-500/10 border border-amber-500/30 rounded-lg p-4 flex items-start gap-4">
                  <AlertCircle className="h-6 w-6 text-amber-400 flex-shrink-0 mt-1" />
                  <div className="flex-1">
                    <h3 className="text-amber-400 font-semibold mb-1">Awaiting Authorization</h3>
                    <p className="text-gray-300 text-sm">
                      Your authorization head has been invited to complete the signup process. Once they upload the required documents and are verified, your account will be activated.
                    </p>
                  </div>
                </div>
              )}
            </div>
          )}

          {children}
        </div>
      </motion.main>

      {/* Verification Modal — big popup on first load for unverified recruiters */}
      <AnimatePresence>
        {showVerificationModal && recruiter && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 backdrop-blur-sm p-4"
            onClick={() => {
              setShowVerificationModal(false);
              
            }}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 20 }}
              transition={{ type: 'spring', duration: 0.5 }}
              className="relative max-w-lg w-full rounded-2xl overflow-hidden"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Close button */}
              <button
                onClick={() => {
                  setShowVerificationModal(false);
                  
                }}
                className="absolute top-4 right-4 z-10 p-2 rounded-full bg-white/10 hover:bg-white/20 transition-colors"
              >
                <X className="h-5 w-5 text-white" />
              </button>

              {recruiter.verificationStatus === 'pending_documents' && (
                <div className="bg-gradient-to-br from-[#1a1a2e] to-[#0f0f1a] border border-orange-500/30">
                  {/* Header with icon */}
                  <div className="bg-gradient-to-r from-orange-500/20 to-amber-500/20 p-8 text-center">
                    <div className="w-20 h-20 mx-auto mb-4 rounded-full bg-orange-500/20 flex items-center justify-center ring-4 ring-orange-500/30">
                      <Upload className="h-10 w-10 text-orange-400" />
                    </div>
                    <h2 className="text-2xl font-bold text-white mb-2">Welcome to BPOC! 🎉</h2>
                    <p className="text-orange-300 text-lg font-medium">One quick step to activate your account</p>
                  </div>

                  {/* Body */}
                  <div className="p-8">
                    <p className="text-gray-300 text-center mb-6">
                      To start posting jobs and managing candidates, we need to verify your agency. 
                      Upload your company documents — it only takes a minute.
                    </p>

                    <div className="space-y-3 mb-8">
                      {['TIN Certificate', 'DTI / SEC Registration', 'Business Permit', 'NBI Clearance'].map((doc, i) => (
                        <div key={i} className="flex items-center gap-3 bg-white/5 rounded-lg p-3">
                          <div className="w-8 h-8 rounded-full bg-orange-500/20 flex items-center justify-center flex-shrink-0">
                            <FileText className="h-4 w-4 text-orange-400" />
                          </div>
                          <span className="text-gray-300 text-sm">{doc}</span>
                        </div>
                      ))}
                    </div>

                    <Button
                      onClick={() => {
                        setShowVerificationModal(false);
                        
                        router.push('/signup/documents');
                      }}
                      className="w-full bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-white font-semibold py-6 text-lg rounded-xl"
                    >
                      Upload Documents Now
                      <ArrowRight className="ml-2 h-5 w-5" />
                    </Button>

                    <button
                      onClick={() => {
                        setShowVerificationModal(false);
                        
                      }}
                      className="w-full mt-3 text-gray-500 hover:text-gray-400 text-sm py-2 transition-colors"
                    >
                      I&apos;ll do this later
                    </button>
                  </div>
                </div>
              )}

              {recruiter.verificationStatus === 'pending_admin_review' && (
                <div className="bg-gradient-to-br from-[#1a1a2e] to-[#0f0f1a] border border-blue-500/30 p-8 text-center">
                  <div className="w-20 h-20 mx-auto mb-4 rounded-full bg-blue-500/20 flex items-center justify-center ring-4 ring-blue-500/30">
                    <Clock className="h-10 w-10 text-blue-400" />
                  </div>
                  <h2 className="text-2xl font-bold text-white mb-2">Documents Submitted! ✅</h2>
                  <p className="text-blue-300 text-lg font-medium mb-4">We&apos;re reviewing your documents</p>
                  <p className="text-gray-400 mb-6">Your documents are being verified by AI. This usually takes just a few minutes. Feel free to explore the platform while you wait.</p>
                  <Button
                    onClick={() => {
                      setShowVerificationModal(false);
                      
                    }}
                    className="bg-blue-500 hover:bg-blue-600 px-8"
                  >
                    Got it, thanks!
                  </Button>
                </div>
              )}

              {recruiter.verificationStatus === 'pending_authorization_head' && (
                <div className="bg-gradient-to-br from-[#1a1a2e] to-[#0f0f1a] border border-amber-500/30 p-8 text-center">
                  <div className="w-20 h-20 mx-auto mb-4 rounded-full bg-amber-500/20 flex items-center justify-center ring-4 ring-amber-500/30">
                    <Shield className="h-10 w-10 text-amber-400" />
                  </div>
                  <h2 className="text-2xl font-bold text-white mb-2">Almost There! 👋</h2>
                  <p className="text-amber-300 text-lg font-medium mb-4">Waiting for your recruitment head</p>
                  <p className="text-gray-400 mb-6">We&apos;ve sent an invitation to your Head of Recruitment. Once they sign up and verify your agency, your account will be fully activated. You can still explore the platform while you wait.</p>
                  <Button
                    onClick={() => {
                      setShowVerificationModal(false);
                      
                    }}
                    className="bg-amber-500 hover:bg-amber-600 px-8"
                  >
                    Got it, I&apos;ll explore!
                  </Button>
                </div>
              )}
            </motion.div>
          </motion.div>
        )}
        {/* Verified Celebration Modal */}
        {showVerifiedCelebration && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 backdrop-blur-sm p-4"
            onClick={() => setShowVerifiedCelebration(false)}
          >
            <motion.div
              initial={{ scale: 0.8, opacity: 0, y: 30 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.8, opacity: 0, y: 30 }}
              transition={{ type: 'spring', duration: 0.6, bounce: 0.4 }}
              className="relative max-w-lg w-full rounded-2xl overflow-hidden bg-gradient-to-br from-[#1a1a2e] to-[#0f0f1a] border border-emerald-500/30"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Confetti-style header */}
              <div className="bg-gradient-to-r from-emerald-500/20 via-green-500/20 to-teal-500/20 p-8 text-center relative overflow-hidden">
                <div className="absolute inset-0 opacity-20">
                  <div className="absolute top-2 left-8 text-2xl">🎉</div>
                  <div className="absolute top-4 right-12 text-xl">✨</div>
                  <div className="absolute bottom-2 left-16 text-lg">🎊</div>
                  <div className="absolute bottom-4 right-8 text-2xl">⭐</div>
                  <div className="absolute top-6 left-1/2 text-xl">🎯</div>
                </div>
                <motion.div
                  initial={{ rotate: -10, scale: 0 }}
                  animate={{ rotate: 0, scale: 1 }}
                  transition={{ delay: 0.2, type: 'spring', bounce: 0.5 }}
                  className="w-20 h-20 mx-auto mb-4 rounded-full bg-emerald-500/30 flex items-center justify-center ring-4 ring-emerald-500/40"
                >
                  <Rocket className="h-10 w-10 text-emerald-400" />
                </motion.div>
                <motion.h2
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.3 }}
                  className="text-2xl font-bold text-white mb-2"
                >
                  You&apos;re Verified! 🚀
                </motion.h2>
                <motion.p
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.4 }}
                  className="text-emerald-300 text-lg font-medium"
                >
                  Your agency is 100% ready to go
                </motion.p>
              </div>

              {/* Next Steps */}
              <div className="p-8">
                <p className="text-gray-300 text-center mb-6">
                  Your documents have been verified and your agency is fully activated.
                  Here&apos;s what to do next:
                </p>

                <div className="space-y-3 mb-8">
                  {[
                    { icon: Users, label: 'Add your clients', desc: 'Set up the companies you recruit for' },
                    { icon: Briefcase, label: 'Post a job', desc: 'Create job listings to attract candidates' },
                    { icon: Search, label: 'Browse the talent pool', desc: 'Search through verified candidates' },
                    { icon: BookOpen, label: 'Complete your agency profile', desc: 'Add your logo, description & details' },
                  ].map((step, i) => (
                    <motion.div
                      key={i}
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: 0.5 + i * 0.1 }}
                      className="flex items-center gap-3 bg-white/5 rounded-lg p-3"
                    >
                      <div className="w-10 h-10 rounded-full bg-emerald-500/20 flex items-center justify-center flex-shrink-0">
                        <step.icon className="h-5 w-5 text-emerald-400" />
                      </div>
                      <div>
                        <span className="text-white text-sm font-medium">{step.label}</span>
                        <p className="text-gray-500 text-xs">{step.desc}</p>
                      </div>
                    </motion.div>
                  ))}
                </div>

                <Button
                  onClick={() => setShowVerifiedCelebration(false)}
                  className="w-full bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600 text-white font-semibold py-6 text-lg rounded-xl"
                >
                  <Sparkles className="mr-2 h-5 w-5" />
                  Let&apos;s Get Started!
                </Button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}


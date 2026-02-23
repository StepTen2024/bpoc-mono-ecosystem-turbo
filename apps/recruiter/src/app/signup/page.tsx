'use client';

import React, { useState, useEffect, Suspense } from 'react';
import { motion } from 'framer-motion';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  Building2,
  Mail,
  Lock,
  User,
  Briefcase,
  ArrowRight,
  Loader2,
  CheckCircle,
  Sparkles,
  Code,
  Globe,
  Zap,
  Users,
  Search,
  LayoutDashboard,
  UserPlus,
  TrendingUp,
  Clock,
  Target,
  AlertCircle,
  MessageSquare,
  Phone,
  Star,
  Shield,
  Award,
  Laptop,
  Video,
  FileText,
  Brain,
  Keyboard,
  Bot,
  ChevronDown,
  ChevronUp,
  CheckCircle2,
  Sparkle,
  DollarSign,
  Infinity
} from 'lucide-react';
import { Button } from '@/components/shared/ui/button';
import { Input } from '@/components/shared/ui/input';
import { Badge } from '@/components/shared/ui/badge';
import { createClient } from '@supabase/supabase-js';
import { AnimatedLogo } from '@/components/shared/ui/AnimatedLogo';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

interface InvitationData {
  email: string;
  name?: string;
  role: string;
  agencyName: string;
}

// Wrapper component to handle Suspense for useSearchParams
export default function RecruiterSignupPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-[#0B0B0D] flex items-center justify-center">
        <Loader2 className="h-8 w-8 text-orange-400 animate-spin" />
      </div>
    }>
      <RecruiterSignupContent />
    </Suspense>
  );
}

function RecruiterSignupContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const inviteToken = searchParams.get('invite');

  const [invitation, setInvitation] = useState<InvitationData | null>(null);
  const [loadingInvite, setLoadingInvite] = useState(!!inviteToken);
  const [inviteError, setInviteError] = useState('');

  const [formData, setFormData] = useState({
    first_name: '',
    last_name: '',
    email: '',
    password: '',
    agencyName: '',
    isAuthorized: true, // Default to true (they are the head)
    authorizedPersonFirstName: '',
    authorizedPersonLastName: '',
    authorizedPersonEmail: '',
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [openFaq, setOpenFaq] = useState<number | null>(null);
  const [mounted, setMounted] = useState(false);

  // Client-side only mounting to avoid hydration issues with browser extensions
  useEffect(() => {
    setMounted(true);
  }, []);

  // Fetch invitation details if invite token is present
  useEffect(() => {
    if (inviteToken) {
      fetchInvitation();
    }
  }, [inviteToken]);

  const fetchInvitation = async () => {
    try {
      const response = await fetch(`/api/recruiter/team/accept?token=${inviteToken}`);
      const data = await response.json();

      if (!response.ok || !data.valid) {
        setInviteError(data.error || 'Invalid or expired invitation');
        return;
      }

      const inv = data.invitation;
      setInvitation(inv);

      let firstName = '';
      let lastName = '';
      if (inv.name) {
        const parts = inv.name.trim().split(' ');
        firstName = parts[0] || '';
        lastName = parts.slice(1).join(' ') || '';
      }

      setFormData(prev => ({
        ...prev,
        email: inv.email,
        firstName,
        lastName,
      }));
    } catch (error) {
      setInviteError('Failed to load invitation details');
    } finally {
      setLoadingInvite(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const response = await fetch('/api/recruiter/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...formData,
          inviteToken: inviteToken || undefined,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to create account');
      }

      const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
        email: formData.email,
        password: formData.password,
      });

      if (signInError) {
        console.error('Auto-login error:', signInError);
        throw new Error('Account created but auto-login failed. Please login manually.');
      }

      if (!signInData.session) {
        throw new Error('Account created but session not established. Please login manually.');
      }

      console.log('✅ Auto-login successful, session established');

      setSuccess(true);

      // Use router.push for SPA navigation so auth context is preserved
      // window.location.href causes a full reload which loses the session before cookies are set
      setTimeout(() => {
        router.push('/');
      }, 500);

    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
    } finally {
      setLoading(false);
    }
  };

  // Show invite error if token is invalid
  if (inviteToken && inviteError) {
    return (
      <div className="min-h-screen bg-[#0B0B0D] flex items-center justify-center px-4">
        <div className="max-w-md w-full text-center">
          <div className="w-20 h-20 mx-auto mb-6 rounded-full bg-red-500/20 flex items-center justify-center">
            <UserPlus className="h-10 w-10 text-red-400" />
          </div>
          <h2 className="text-2xl font-bold text-white mb-4">Invalid Invitation</h2>
          <p className="text-gray-400 mb-6">{inviteError}</p>
          <Link href="/signup">
            <Button className="bg-gradient-to-r from-orange-500 to-amber-600">
              Create New Account Instead
            </Button>
          </Link>
        </div>
      </div>
    );
  }

  // Show loading while fetching invitation
  if (loadingInvite) {
    return (
      <div className="min-h-screen bg-[#0B0B0D] flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="h-8 w-8 text-orange-400 animate-spin mx-auto mb-4" />
          <p className="text-gray-400">Loading invitation...</p>
        </div>
      </div>
    );
  }

  return (
    <div suppressHydrationWarning className="min-h-screen bg-[#0B0B0D] selection:bg-orange-500/20 selection:text-orange-200 overflow-x-hidden">

      {/* Background Ambience */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none z-0">
        <div className="absolute top-[-10%] right-[-10%] w-[800px] h-[800px] bg-orange-500/5 rounded-full blur-[120px] animate-pulse-slow" />
        <div className="absolute bottom-[-10%] left-[-10%] w-[800px] h-[800px] bg-amber-500/5 rounded-full blur-[120px] animate-pulse-slow delay-1000" />
        <div className="absolute top-1/2 left-1/2 w-[600px] h-[600px] bg-orange-400/3 rounded-full blur-[100px] animate-pulse-slow delay-500" />
        <div className="absolute inset-0 bg-[url('/images/grid-pattern.svg')] opacity-[0.03] bg-center" />
      </div>

      {/* Sticky Nav */}
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
            <Link href="/login" className="text-sm font-medium text-gray-400 hover:text-white transition-colors">
              Log In
            </Link>
            <Link href="#signup-form">
              <Button className="bg-gradient-to-r from-orange-500 to-amber-600 hover:from-orange-600 hover:to-amber-700 text-white rounded-full px-6">
                Start Hiring
              </Button>
            </Link>
          </div>
        </div>
      </motion.nav>

      <main className="relative z-10">

        {/* Hero Section */}
        <section className="pt-20 pb-32">
          <div className="container mx-auto px-6">
            <div className="grid lg:grid-cols-2 gap-16 items-center">

              {/* Left Column: Copy */}
              <motion.div
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.6 }}
              >
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.2 }}
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-orange-500/10 border border-orange-500/20 text-orange-400 text-sm font-medium mb-6"
                >
                  <Sparkles className="w-4 h-4" />
                  <span>Trusted by 500+ Philippine Agencies</span>
                </motion.div>

                <motion.h1
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.3 }}
                  className="text-5xl lg:text-7xl font-bold text-white leading-tight mb-6"
                >
                  Hire Top Filipino <br />
                  <span className="text-transparent bg-clip-text bg-gradient-to-r from-orange-400 via-amber-500 to-yellow-500">
                    BPO Talent
                  </span>
                  <br />
                  <span className="text-4xl lg:text-5xl text-gray-300">in Days, Not Months</span>
                </motion.h1>

                <motion.p
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.4 }}
                  className="text-xl text-gray-400 mb-8 leading-relaxed max-w-xl"
                >
                  Access 50,000+ pre-vetted candidates with verified DISC scores, typing tests, and AI-analyzed resumes. Only pay when you successfully place someone.
                </motion.p>

                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.5 }}
                  className="flex flex-col sm:flex-row gap-4 mb-12"
                >
                  <div className="flex items-center gap-2 text-gray-300">
                    <CheckCircle className="w-5 h-5 text-green-500 flex-shrink-0" />
                    <span>Free Unlimited Job Posts</span>
                  </div>
                  <div className="flex items-center gap-2 text-gray-300">
                    <CheckCircle className="w-5 h-5 text-green-500 flex-shrink-0" />
                    <span>AI Candidate Matching</span>
                  </div>
                  <div className="flex items-center gap-2 text-gray-300">
                    <CheckCircle className="w-5 h-5 text-green-500 flex-shrink-0" />
                    <span>White-Label API</span>
                  </div>
                </motion.div>

                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.6 }}
                  className="p-6 rounded-2xl bg-white/5 border border-white/10 backdrop-blur-sm max-w-md"
                >
                  <div className="flex items-center gap-4 mb-4">
                    <div className="flex -space-x-3">
                      {[1, 2, 3, 4].map((i) => (
                        <div key={i} className="w-10 h-10 rounded-full border-2 border-[#0B0B0D] bg-gray-800 flex items-center justify-center overflow-hidden">
                          <img src={`https://i.pravatar.cc/100?img=${i + 10}`} alt="Candidate" className="w-full h-full object-cover" />
                        </div>
                      ))}
                    </div>
                    <div className="text-sm">
                      <p className="text-white font-bold">10,000+ Candidates</p>
                      <p className="text-gray-500">Pre-vetted and ready to work</p>
                    </div>
                  </div>
                  <div className="h-1.5 w-full bg-white/10 rounded-full overflow-hidden">
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: '75%' }}
                      transition={{ delay: 0.8, duration: 1 }}
                      className="h-full bg-gradient-to-r from-orange-500 to-amber-500 rounded-full"
                    />
                  </div>
                </motion.div>
              </motion.div>

              {/* Right Column: Signup Form */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, delay: 0.2 }}
                id="signup-form"
                className="relative"
                suppressHydrationWarning
              >
                {/* Glow Effect */}
                <div className="absolute inset-0 bg-gradient-to-br from-orange-500/20 to-amber-500/20 rounded-3xl blur-2xl transform rotate-3 scale-105 opacity-50" />

                <div suppressHydrationWarning className="relative bg-[#121217] border border-white/10 rounded-3xl p-8 shadow-2xl">
                  <div className="text-center mb-8">
                    {invitation ? (
                      <>
                        <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-orange-500/20 flex items-center justify-center">
                          <UserPlus className="h-8 w-8 text-orange-400" />
                        </div>
                        <h3 className="text-2xl font-bold text-white mb-2">Join {invitation.agencyName}</h3>
                        <p className="text-gray-400 text-sm">You&apos;ve been invited to join the team</p>
                        <Badge className="mt-3 bg-orange-500/20 text-orange-400 border-orange-500/30">
                          Joining as {invitation.role}
                        </Badge>
                      </>
                    ) : (
                      <>
                        <h3 className="text-2xl font-bold text-white mb-2">Create Agency Account</h3>
                        <p className="text-gray-400 text-sm">Join the fastest growing BPO network</p>
                      </>
                    )}
                  </div>

                  {success ? (
                    <div className="text-center py-12">
                      <div className="w-20 h-20 mx-auto mb-6 rounded-full bg-green-500/20 flex items-center justify-center">
                        <CheckCircle className="h-10 w-10 text-green-500" />
                      </div>
                      <h3 className="text-2xl font-bold text-white mb-2">Welcome Aboard!</h3>
                      <p className="text-gray-400">Redirecting to your dashboard...</p>
                    </div>
                  ) : !mounted ? (
                    <div className="text-center py-12">
                      <Loader2 className="h-8 w-8 text-orange-400 animate-spin mx-auto" />
                    </div>
                  ) : (
                    <form suppressHydrationWarning onSubmit={handleSubmit} className="space-y-5">
                      {error && (
                        <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/30 text-red-400 text-sm text-center">
                          {error}
                        </div>
                      )}

                      {invitation ? (
                        <>
                          <div className="space-y-2">
                            <label className="text-xs font-medium text-gray-400 uppercase tracking-wide">Email</label>
                            <div className="px-4 py-3 rounded-lg bg-white/5 border border-white/10 text-gray-300">
                              {formData.email}
                            </div>
                          </div>

                          <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                              <label className="text-xs font-medium text-gray-400 uppercase tracking-wide">First Name</label>
                              <Input
                                type="text"
                                placeholder="John"
                                value={formData.first_name}
                                onChange={(e) => setFormData(prev => ({ ...prev, first_name: e.target.value }))}
                                className="bg-white/5 border-white/10 text-white focus:border-orange-500/50 focus:ring-orange-500/20"
                                required
                              />
                            </div>
                            <div className="space-y-2">
                              <label className="text-xs font-medium text-gray-400 uppercase tracking-wide">Last Name</label>
                              <Input
                                type="text"
                                placeholder="Doe"
                                value={formData.last_name}
                                onChange={(e) => setFormData(prev => ({ ...prev, last_name: e.target.value }))}
                                className="bg-white/5 border-white/10 text-white focus:border-orange-500/50 focus:ring-orange-500/20"
                                required
                              />
                            </div>
                          </div>

                          <div className="space-y-2">
                            <label className="text-xs font-medium text-gray-400 uppercase tracking-wide">Create Password</label>
                            <Input
                              type="password"
                              placeholder="Min 8 characters"
                              value={formData.password}
                              onChange={(e) => setFormData(prev => ({ ...prev, password: e.target.value }))}
                              className="bg-white/5 border-white/10 text-white focus:border-orange-500/50 focus:ring-orange-500/20"
                              required
                              minLength={8}
                              autoFocus
                            />
                          </div>
                        </>
                      ) : (
                        <>
                          <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                              <label className="text-xs font-medium text-gray-400 uppercase tracking-wide">First Name</label>
                              <Input
                                type="text"
                                placeholder="John"
                                value={formData.first_name}
                                onChange={(e) => setFormData(prev => ({ ...prev, first_name: e.target.value }))}
                                className="bg-white/5 border-white/10 text-white focus:border-orange-500/50 focus:ring-orange-500/20"
                                required
                              />
                            </div>
                            <div className="space-y-2">
                              <label className="text-xs font-medium text-gray-400 uppercase tracking-wide">Last Name</label>
                              <Input
                                type="text"
                                placeholder="Doe"
                                value={formData.last_name}
                                onChange={(e) => setFormData(prev => ({ ...prev, last_name: e.target.value }))}
                                className="bg-white/5 border-white/10 text-white focus:border-orange-500/50 focus:ring-orange-500/20"
                                required
                              />
                            </div>
                          </div>

                          <div className="space-y-2">
                            <label className="text-xs font-medium text-gray-400 uppercase tracking-wide">Work Email</label>
                            <Input
                              type="email"
                              placeholder="john@agency.com"
                              value={formData.email}
                              onChange={(e) => setFormData(prev => ({ ...prev, email: e.target.value }))}
                              className="bg-white/5 border-white/10 text-white focus:border-orange-500/50 focus:ring-orange-500/20"
                              required
                            />
                          </div>

                          <div className="space-y-2">
                            <label className="text-xs font-medium text-gray-400 uppercase tracking-wide">Password</label>
                            <Input
                              type="password"
                              placeholder="Min 8 characters"
                              value={formData.password}
                              onChange={(e) => setFormData(prev => ({ ...prev, password: e.target.value }))}
                              className="bg-white/5 border-white/10 text-white focus:border-orange-500/50 focus:ring-orange-500/20"
                              required
                              minLength={8}
                            />
                          </div>

                          <div className="space-y-2">
                            <label className="text-xs font-medium text-gray-400 uppercase tracking-wide">Agency Name <span className="text-gray-500">(Optional)</span></label>
                            <Input
                              type="text"
                              placeholder="Global Talent Solutions"
                              value={formData.agencyName}
                              onChange={(e) => setFormData(prev => ({ ...prev, agencyName: e.target.value }))}
                              className="bg-white/5 border-white/10 text-white focus:border-orange-500/50 focus:ring-orange-500/20"
                            />
                          </div>

                          {/* Authorization Question */}
                          <div className="space-y-4 pt-4 border-t border-white/10">
                            <label className="text-sm font-medium text-white">
                              Are you authorized to make recruitment decisions for your company?
                            </label>
                            <div className="space-y-3">
                              <div
                                onClick={() => setFormData(prev => ({ ...prev, isAuthorized: true }))}
                                className={`p-4 rounded-lg border-2 cursor-pointer transition-all ${
                                  formData.isAuthorized
                                    ? 'border-orange-500 bg-orange-500/10'
                                    : 'border-white/10 bg-white/5 hover:border-white/20'
                                }`}
                              >
                                <div className="flex items-start gap-3">
                                  <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 mt-0.5 ${
                                    formData.isAuthorized ? 'border-orange-500 bg-orange-500' : 'border-white/30'
                                  }`}>
                                    {formData.isAuthorized && (
                                      <div className="w-2 h-2 rounded-full bg-white" />
                                    )}
                                  </div>
                                  <div>
                                    <p className="text-white font-medium">Yes, I am the recruitment head</p>
                                    <p className="text-sm text-gray-400 mt-1">You'll upload company documents and verify your agency</p>
                                  </div>
                                </div>
                              </div>

                              <div
                                onClick={() => setFormData(prev => ({ ...prev, isAuthorized: false }))}
                                className={`p-4 rounded-lg border-2 cursor-pointer transition-all ${
                                  !formData.isAuthorized
                                    ? 'border-orange-500 bg-orange-500/10'
                                    : 'border-white/10 bg-white/5 hover:border-white/20'
                                }`}
                              >
                                <div className="flex items-start gap-3">
                                  <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 mt-0.5 ${
                                    !formData.isAuthorized ? 'border-orange-500 bg-orange-500' : 'border-white/30'
                                  }`}>
                                    {!formData.isAuthorized && (
                                      <div className="w-2 h-2 rounded-full bg-white" />
                                    )}
                                  </div>
                                  <div>
                                    <p className="text-white font-medium">No, someone else is the head</p>
                                    <p className="text-sm text-gray-400 mt-1">We'll send them an invitation to complete setup</p>
                                  </div>
                                </div>
                              </div>
                            </div>
                          </div>

                          {/* Authorized Person Fields (Conditional) */}
                          {!formData.isAuthorized && (
                            <div className="space-y-4 p-4 rounded-lg bg-orange-500/5 border border-orange-500/20">
                              <p className="text-sm text-orange-400 font-medium">
                                Who should we contact to authorize your agency?
                              </p>

                              <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                  <label className="text-xs font-medium text-gray-400 uppercase tracking-wide">First Name</label>
                                  <Input
                                    type="text"
                                    placeholder="Cath"
                                    value={formData.authorizedPersonFirstName}
                                    onChange={(e) => setFormData(prev => ({ ...prev, authorizedPersonFirstName: e.target.value }))}
                                    className="bg-white/5 border-white/10 text-white focus:border-orange-500/50 focus:ring-orange-500/20"
                                    required
                                  />
                                </div>
                                <div className="space-y-2">
                                  <label className="text-xs font-medium text-gray-400 uppercase tracking-wide">Last Name</label>
                                  <Input
                                    type="text"
                                    placeholder="Smith"
                                    value={formData.authorizedPersonLastName}
                                    onChange={(e) => setFormData(prev => ({ ...prev, authorizedPersonLastName: e.target.value }))}
                                    className="bg-white/5 border-white/10 text-white focus:border-orange-500/50 focus:ring-orange-500/20"
                                    required
                                  />
                                </div>
                              </div>

                              <div className="space-y-2">
                                <label className="text-xs font-medium text-gray-400 uppercase tracking-wide">Their Email</label>
                                <Input
                                  type="email"
                                  placeholder="cath@agency.com"
                                  value={formData.authorizedPersonEmail}
                                  onChange={(e) => setFormData(prev => ({ ...prev, authorizedPersonEmail: e.target.value }))}
                                  className="bg-white/5 border-white/10 text-white focus:border-orange-500/50 focus:ring-orange-500/20"
                                  required
                                />
                              </div>

                              <div className="flex items-start gap-2 p-3 rounded-lg bg-blue-500/10 border border-blue-500/20">
                                <AlertCircle className="w-4 h-4 text-blue-400 flex-shrink-0 mt-0.5" />
                                <p className="text-xs text-blue-400">
                                  We'll email them an invitation link. Once they complete verification, you'll both be able to post jobs.
                                </p>
                              </div>
                            </div>
                          )}
                        </>
                      )}

                      <Button
                        type="submit"
                        disabled={loading}
                        className="w-full h-12 bg-gradient-to-r from-orange-500 to-amber-600 hover:from-orange-600 hover:to-amber-700 text-white font-semibold rounded-xl shadow-lg shadow-orange-500/20 transition-all hover:scale-[1.02]"
                      >
                        {loading ? (
                          <Loader2 className="animate-spin" />
                        ) : invitation ? (
                          "Join Team & Go to Dashboard"
                        ) : !formData.isAuthorized ? (
                          "Send Invitation & Create Account"
                        ) : (
                          "Get Started for Free"
                        )}
                      </Button>

                      <p className="text-xs text-center text-gray-500">
                        By signing up, you agree to our Terms & Conditions.
                      </p>
                    </form>
                  )}
                </div>
              </motion.div>
            </div>
          </div>
        </section>

        {/* Stats Banner */}
        <motion.section
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          className="py-16 bg-gradient-to-r from-orange-500/10 via-amber-500/10 to-orange-500/10 border-y border-orange-500/20"
        >
          <div className="container mx-auto px-6">
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-8">
              {[
                { number: "50,000+", label: "Active Candidates" },
                { number: "500+", label: "BPO Agencies" },
                { number: "10,000+", label: "Successful Placements" },
                { number: "60%", label: "Faster Time-to-Hire" }
              ].map((stat, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: i * 0.1 }}
                  className="text-center"
                >
                  <div className="text-4xl lg:text-5xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-orange-400 to-amber-500 mb-2">
                    {stat.number}
                  </div>
                  <div className="text-gray-400 text-sm lg:text-base">{stat.label}</div>
                </motion.div>
              ))}
            </div>
          </div>
        </motion.section>

        {/* Pain Points Section */}
        <section className="py-24 relative">
          <div className="container mx-auto px-6">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              className="text-center mb-16"
            >
              <h2 className="text-4xl md:text-5xl font-bold text-white mb-6">
                Stop Losing Candidates to <span className="text-orange-400">Faster Agencies</span>
              </h2>
              <p className="text-gray-400 max-w-2xl mx-auto text-lg">
                You know the pain. We built the solution.
              </p>
            </motion.div>

            <div className="grid md:grid-cols-3 gap-8">
              {[
                {
                  icon: AlertCircle,
                  title: "Drowning in Unqualified Resumes",
                  description: "Sifting through 500+ applications just to find 5 qualified candidates wastes your entire week.",
                  stat: "98% time wasted on unqualified applicants"
                },
                {
                  icon: Clock,
                  title: "Clients Demanding Faster Turnaround",
                  description: "\"We needed someone yesterday\" - Sound familiar? Lose clients to agencies who can deliver faster.",
                  stat: "45-day average time-to-fill killing your deals"
                },
                {
                  icon: Phone,
                  title: "Manual Screening Eating Your Time",
                  description: "Spending 10+ hours per week on pre-screening calls that could be automated.",
                  stat: "40 hours/month lost to manual screening"
                }
              ].map((pain, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, y: 30 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: i * 0.1 }}
                  className="p-8 rounded-2xl bg-red-500/5 border border-red-500/20 hover:border-red-500/30 transition-all duration-300 group"
                >
                  <div className="w-14 h-14 rounded-xl bg-red-500/10 flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
                    <pain.icon className="w-7 h-7 text-red-400" />
                  </div>
                  <h3 className="text-2xl font-bold text-white mb-4">{pain.title}</h3>
                  <p className="text-gray-400 leading-relaxed mb-4">{pain.description}</p>
                  <div className="pt-4 border-t border-red-500/20">
                    <p className="text-red-400 text-sm font-mono">{pain.stat}</p>
                  </div>
                </motion.div>
              ))}
            </div>
          </div>
        </section>

        {/* Testimonials */}
        <section className="py-24 bg-white/5 border-y border-white/5">
          <div className="container mx-auto px-6">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              className="text-center mb-16"
            >
              <h2 className="text-4xl md:text-5xl font-bold text-white mb-6">
                Loved by Recruiters <span className="text-orange-400">Across the Philippines</span>
              </h2>
            </motion.div>

            <div className="grid md:grid-cols-3 gap-8">
              {[
                {
                  quote: "We filled 12 customer service roles in 2 weeks. Usually takes us 2 months.",
                  name: "Maria Santos",
                  title: "HR Manager",
                  company: "Manila BPO Inc.",
                  image: 20
                },
                {
                  quote: "The AI matching saved us 15 hours of screening per week. It's like having an extra recruiter on the team.",
                  name: "James Reyes",
                  title: "Founder",
                  company: "TalentEdge Philippines",
                  image: 33
                },
                {
                  quote: "Our clients love the candidate quality. DISC scores and typing tests mean we only present serious applicants.",
                  name: "Patricia Cruz",
                  title: "Senior Recruiter",
                  company: "GlobalHire PH",
                  image: 47
                }
              ].map((testimonial, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, y: 30 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: i * 0.15 }}
                  className="p-8 rounded-2xl bg-[#0B0B0D] border border-white/10 hover:border-orange-500/30 transition-all duration-300"
                >
                  <div className="flex gap-1 mb-6">
                    {[...Array(5)].map((_, i) => (
                      <Star key={i} className="w-5 h-5 fill-orange-400 text-orange-400" />
                    ))}
                  </div>
                  <p className="text-xl text-gray-300 leading-relaxed mb-8 italic">
                    &ldquo;{testimonial.quote}&rdquo;
                  </p>
                  <div className="flex items-center gap-4 pt-6 border-t border-white/10">
                    <img
                      src={`https://i.pravatar.cc/100?img=${testimonial.image}`}
                      alt={testimonial.name}
                      className="w-12 h-12 rounded-full border-2 border-orange-500/30"
                    />
                    <div>
                      <p className="text-white font-semibold">{testimonial.name}</p>
                      <p className="text-sm text-gray-400">{testimonial.title}, {testimonial.company}</p>
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>
          </div>
        </section>

        {/* How It Works */}
        <section className="py-24 relative overflow-hidden">
          <div className="container mx-auto px-6">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              className="text-center mb-20"
            >
              <h2 className="text-4xl md:text-5xl font-bold text-white mb-6">
                From Job Post to Placed Candidate in <span className="text-orange-400">4 Simple Steps</span>
              </h2>
            </motion.div>

            <div className="max-w-5xl mx-auto">
              <div className="grid md:grid-cols-4 gap-8 relative">
                {/* Connection Line */}
                <div className="hidden md:block absolute top-12 left-0 right-0 h-0.5 bg-gradient-to-r from-orange-500/50 via-amber-500/50 to-orange-500/50" style={{ top: '48px' }} />

                {[
                  {
                    number: "01",
                    icon: UserPlus,
                    title: "Create Free Account",
                    description: "No credit card required. Set up in 60 seconds."
                  },
                  {
                    number: "02",
                    icon: Search,
                    title: "Post Jobs or Search Talent",
                    description: "AI matches candidates to your requirements instantly."
                  },
                  {
                    number: "03",
                    icon: Video,
                    title: "Screen & Interview",
                    description: "Video interviews, DISC scores, and typing tests included."
                  },
                  {
                    number: "04",
                    icon: CheckCircle2,
                    title: "Make Offer & Place",
                    description: "Only pay when you successfully place a candidate."
                  }
                ].map((step, i) => (
                  <motion.div
                    key={i}
                    initial={{ opacity: 0, y: 30 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    transition={{ delay: i * 0.15 }}
                    className="relative text-center"
                  >
                    <div className="relative inline-flex items-center justify-center w-24 h-24 mb-6 mx-auto">
                      <div className="absolute inset-0 bg-gradient-to-br from-orange-500 to-amber-600 rounded-full opacity-20 blur-xl" />
                      <div className="relative w-full h-full bg-[#0B0B0D] border-2 border-orange-500/30 rounded-full flex items-center justify-center">
                        <step.icon className="w-10 h-10 text-orange-400" />
                      </div>
                      <div className="absolute -top-2 -right-2 w-8 h-8 bg-gradient-to-br from-orange-500 to-amber-600 rounded-full flex items-center justify-center text-xs font-bold text-white">
                        {step.number}
                      </div>
                    </div>
                    <h3 className="text-xl font-bold text-white mb-3">{step.title}</h3>
                    <p className="text-gray-400 text-sm leading-relaxed">{step.description}</p>
                  </motion.div>
                ))}
              </div>
            </div>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              className="text-center mt-16"
            >
              <Link href="#signup-form">
                <Button size="lg" className="h-14 px-10 bg-gradient-to-r from-orange-500 to-amber-600 hover:from-orange-600 hover:to-amber-700 text-white rounded-full text-lg shadow-lg shadow-orange-500/30">
                  Start Hiring for Free
                  <ArrowRight className="ml-2 w-5 h-5" />
                </Button>
              </Link>
            </motion.div>
          </div>
        </section>

        {/* Candidate Quality Section */}
        <section className="py-24 bg-white/5 border-y border-white/5">
          <div className="container mx-auto px-6">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              className="text-center mb-6"
            >
              <h2 className="text-4xl md:text-5xl font-bold text-white mb-6">
                Pre-Vetted Candidates, <span className="text-orange-400">Not Random Applicants</span>
              </h2>
              <p className="text-gray-400 max-w-2xl mx-auto text-lg">
                Every candidate completes our rigorous assessment before you see them
              </p>
            </motion.div>

            <div className="grid md:grid-cols-3 gap-8 max-w-6xl mx-auto mt-16">
              {[
                {
                  icon: Brain,
                  title: "DISC Personality Assessment",
                  stat: "97%",
                  statLabel: "candidates complete behavioral profiling",
                  description: "Match communication styles to your BPO roles. Know if they're a natural fit before the first interview."
                },
                {
                  icon: Keyboard,
                  title: "Typing Speed Verification",
                  stat: "65 WPM",
                  statLabel: "average, tested via gamified assessment",
                  description: "No more candidates claiming skills they don't have. Every typing score is verified through our game."
                },
                {
                  icon: Bot,
                  title: "AI Resume Analysis",
                  stat: "0-100",
                  statLabel: "Claude Sonnet 4 scores every resume",
                  description: "See quality and ATS compatibility scores before you even read the resume. Filter by AI score instantly."
                }
              ].map((quality, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, y: 30 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: i * 0.1 }}
                  className="p-8 rounded-2xl bg-[#0B0B0D] border border-white/10 hover:border-orange-500/30 transition-all duration-300 group"
                >
                  <div className="w-16 h-16 rounded-xl bg-gradient-to-br from-orange-500/20 to-amber-500/20 flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
                    <quality.icon className="w-8 h-8 text-orange-400" />
                  </div>
                  <h3 className="text-2xl font-bold text-white mb-4">{quality.title}</h3>
                  <div className="mb-4 p-4 bg-orange-500/10 rounded-lg border border-orange-500/20">
                    <div className="text-3xl font-bold text-orange-400 mb-1">{quality.stat}</div>
                    <div className="text-sm text-gray-400">{quality.statLabel}</div>
                  </div>
                  <p className="text-gray-400 leading-relaxed">{quality.description}</p>
                </motion.div>
              ))}
            </div>
          </div>
        </section>

        {/* Features Grid */}
        <section className="py-24">
          <div className="container mx-auto px-6">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              className="text-center mb-16"
            >
              <h2 className="text-4xl md:text-5xl font-bold text-white mb-6">
                Everything You Need to <span className="text-orange-400">Scale Your Recruiting Business</span>
              </h2>
              <p className="text-gray-400 max-w-2xl mx-auto text-lg">
                A complete platform built specifically for BPO agencies in the Philippines
              </p>
            </motion.div>

            <div className="grid md:grid-cols-3 gap-6 max-w-7xl mx-auto">
              {[
                {
                  icon: Sparkles,
                  title: "AI-Powered Job Creation",
                  description: "Generate professional job descriptions in seconds with Claude AI. Just enter a title and brief requirements."
                },
                {
                  icon: Users,
                  title: "Smart Talent Pool",
                  description: "Search 50K+ candidates with advanced filters: English level, typing speed, DISC personality, and more."
                },
                {
                  icon: Video,
                  title: "Video Interview Platform",
                  description: "Pre-screen, recruiter rounds, and client interviews - all built-in. Recordings and transcripts included."
                },
                {
                  icon: LayoutDashboard,
                  title: "Kanban Pipeline Board",
                  description: "Drag-and-drop candidates through your hiring stages. Visual tracking from application to placement."
                },
                {
                  icon: Building2,
                  title: "Multi-Client Management",
                  description: "Manage jobs for 10+ BPO clients in one dashboard. Client-specific pipelines and branding."
                },
                {
                  icon: FileText,
                  title: "Offer & Negotiation Tools",
                  description: "Send offers, handle counter-offers, track negotiations, and collect e-signatures - all in one place."
                },
                {
                  icon: Shield,
                  title: "Philippine Labor Law AI",
                  description: "Ask questions about DOLE compliance, regularization, termination. Get instant answers with legal citations."
                },
                {
                  icon: Laptop,
                  title: "Recording Library",
                  description: "Review all interview recordings with searchable transcripts. Share with clients for approval."
                },
                {
                  icon: Code,
                  title: "White-Label API",
                  description: "Build custom client portals with our RESTful API. Full documentation and webhook support included."
                }
              ].map((feature, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, y: 30 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: (i % 3) * 0.1 }}
                  className="p-8 rounded-2xl bg-white/5 border border-white/10 hover:border-orange-500/30 transition-all duration-300 group"
                >
                  <div className="w-12 h-12 rounded-lg bg-orange-500/10 flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
                    <feature.icon className="w-6 h-6 text-orange-400" />
                  </div>
                  <h3 className="text-xl font-bold text-white mb-3">{feature.title}</h3>
                  <p className="text-gray-400 leading-relaxed text-sm">{feature.description}</p>
                </motion.div>
              ))}
            </div>
          </div>
        </section>

        {/* Pricing Section */}
        <section className="py-24 bg-gradient-to-b from-white/5 to-transparent border-t border-white/5">
          <div className="container mx-auto px-6">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              className="text-center mb-6"
            >
              <h2 className="text-4xl md:text-5xl font-bold text-white mb-6">
                Simple, <span className="text-orange-400">Transparent Pricing</span>
              </h2>
              <p className="text-gray-400 max-w-2xl mx-auto text-lg">
                No monthly fees. No commitments. Pay only for results.
              </p>
            </motion.div>

            <div className="grid md:grid-cols-2 gap-8 max-w-5xl mx-auto mt-16">
              {/* Free Tier */}
              <motion.div
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                className="relative p-8 rounded-2xl bg-gradient-to-br from-orange-500/10 to-amber-500/10 border-2 border-orange-500/30"
              >
                <div className="absolute -top-4 left-1/2 -translate-x-1/2">
                  <Badge className="bg-gradient-to-r from-orange-500 to-amber-600 text-white border-none px-6 py-1">
                    Most Popular
                  </Badge>
                </div>
                <div className="text-center mb-8">
                  <h3 className="text-2xl font-bold text-white mb-2">Free Tier</h3>
                  <p className="text-gray-400 text-sm mb-6">Perfect for growing agencies</p>
                  <div className="flex items-baseline justify-center gap-2">
                    <span className="text-5xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-orange-400 to-amber-500">FREE</span>
                    <span className="text-gray-400">forever</span>
                  </div>
                </div>
                <ul className="space-y-4 mb-8">
                  {[
                    "Unlimited job posts",
                    "Search all 50K+ candidates",
                    "AI candidate matching",
                    "Video interviews & recording",
                    "Basic analytics",
                    "Email support"
                  ].map((item, i) => (
                    <li key={i} className="flex items-start gap-3">
                      <CheckCircle className="w-5 h-5 text-green-500 flex-shrink-0 mt-0.5" />
                      <span className="text-gray-300">{item}</span>
                    </li>
                  ))}
                </ul>
                <Link href="#signup-form">
                  <Button className="w-full h-12 bg-gradient-to-r from-orange-500 to-amber-600 hover:from-orange-600 hover:to-amber-700 text-white rounded-xl font-semibold">
                    Start Free
                  </Button>
                </Link>
              </motion.div>

              {/* Enterprise Tier */}
              <motion.div
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: 0.1 }}
                className="p-8 rounded-2xl bg-white/5 border border-white/10"
              >
                <div className="text-center mb-8">
                  <h3 className="text-2xl font-bold text-white mb-2">Enterprise</h3>
                  <p className="text-gray-400 text-sm mb-6">For high-volume agencies</p>
                  <div className="flex items-baseline justify-center gap-2">
                    <span className="text-3xl font-bold text-white">Contact Sales</span>
                  </div>
                </div>
                <div className="mb-6">
                  <p className="text-sm text-gray-400 mb-4">Everything in Free, plus:</p>
                </div>
                <ul className="space-y-4 mb-8">
                  {[
                    "White-label API access",
                    "Client portal builder",
                    "Advanced analytics & reporting",
                    "Priority support",
                    "Custom integrations",
                    "Dedicated account manager"
                  ].map((item, i) => (
                    <li key={i} className="flex items-start gap-3">
                      <CheckCircle className="w-5 h-5 text-orange-400 flex-shrink-0 mt-0.5" />
                      <span className="text-gray-300">{item}</span>
                    </li>
                  ))}
                </ul>
                <Button className="w-full h-12 bg-white/10 hover:bg-white/20 text-white border border-white/20 rounded-xl font-semibold">
                  Talk to Sales
                </Button>
              </motion.div>
            </div>

            <motion.div
              initial={{ opacity: 0 }}
              whileInView={{ opacity: 1 }}
              viewport={{ once: true }}
              className="text-center mt-12"
            >
              <p className="text-gray-400 text-sm">
                <span className="text-orange-400 font-medium">Note:</span> Placement fees apply to both tiers when you successfully hire a candidate
              </p>
            </motion.div>
          </div>
        </section>

        {/* API/White-Label Section */}
        <section className="py-24 relative overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-b from-transparent via-blue-500/5 to-transparent pointer-events-none" />

          <div className="container mx-auto px-6">
            <div className="grid lg:grid-cols-2 gap-16 items-center">
              <motion.div
                initial={{ opacity: 0, x: -20 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true }}
              >
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-500/10 border border-blue-500/20 text-blue-400 text-sm font-medium mb-6">
                  <Code className="w-4 h-4" />
                  <span>For Developers & Agencies</span>
                </div>
                <h2 className="text-4xl font-bold text-white mb-6">
                  Build Your Own <br />
                  <span className="text-blue-400">Client Portal</span>
                </h2>
                <p className="text-gray-400 text-lg mb-8 leading-relaxed">
                  Connect your agency website to our candidate database. Give your clients a custom-branded experience while leveraging our powerful platform.
                </p>

                <div className="space-y-4 mb-8">
                  {[
                    "RESTful API endpoints",
                    "Client-scoped data isolation",
                    "Webhooks for real-time updates",
                    "OAuth 2.0 authentication",
                    "Comprehensive documentation",
                    "Rate limiting & analytics"
                  ].map((item, i) => (
                    <motion.div
                      key={i}
                      initial={{ opacity: 0, x: -20 }}
                      whileInView={{ opacity: 1, x: 0 }}
                      viewport={{ once: true }}
                      transition={{ delay: i * 0.1 }}
                      className="flex items-center gap-3"
                    >
                      <div className="w-6 h-6 rounded-full bg-blue-500/20 flex items-center justify-center flex-shrink-0">
                        <CheckCircle className="w-3 h-3 text-blue-400" />
                      </div>
                      <span className="text-gray-300">{item}</span>
                    </motion.div>
                  ))}
                </div>

                <div className="mt-8">
                  <Link href="/developer/docs" className="text-blue-400 hover:text-blue-300 font-mono text-sm flex items-center gap-2 group">
                    VIEW_API_DOCS
                    <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                  </Link>
                </div>
              </motion.div>

              <motion.div
                initial={{ opacity: 0, x: 20 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true }}
                className="relative"
              >
                <div className="absolute -inset-1 bg-gradient-to-r from-blue-500 to-cyan-500 rounded-2xl blur opacity-20" />
                <div className="relative rounded-2xl bg-[#0a0a0f] border border-white/10 p-6 font-mono text-xs text-gray-300 shadow-2xl overflow-hidden">
                  <div className="flex items-center gap-2 mb-4 border-b border-white/5 pb-4">
                    <div className="w-3 h-3 rounded-full bg-red-500" />
                    <div className="w-3 h-3 rounded-full bg-yellow-500" />
                    <div className="w-3 h-3 rounded-full bg-green-500" />
                    <span className="ml-2 text-gray-500">api-example.js</span>
                  </div>
                  <pre className="overflow-x-auto">
                    <code className="text-xs">
{`// Fetch jobs for a specific client
const jobs = await fetch('https://bpoc.io/api/v1/jobs', {
  headers: {
    'X-API-Key': 'bpoc_sk_...',
    'Content-Type': 'application/json'
  },
  params: {
    client_id: 'client_123',
    status: 'active'
  }
});

const data = await jobs.json();
console.log(data);
// {
//   "jobs": [
//     {
//       "id": "1",
//       "title": "Customer Service Rep",
//       "candidates": 47,
//       "matched": 12
//     }
//   ]
// }`}
                    </code>
                  </pre>
                </div>
              </motion.div>
            </div>
          </div>
        </section>

        {/* Trust & Compliance */}
        <section className="py-24 bg-white/5 border-y border-white/5">
          <div className="container mx-auto px-6">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              className="text-center mb-16"
            >
              <h2 className="text-4xl md:text-5xl font-bold text-white mb-6">
                Enterprise-Grade <span className="text-orange-400">Security & Compliance</span>
              </h2>
              <p className="text-gray-400 max-w-2xl mx-auto">
                Bank-grade security. Your data is encrypted and stored in ISO-certified data centers.
              </p>
            </motion.div>

            <div className="grid md:grid-cols-4 gap-8 max-w-5xl mx-auto">
              {[
                {
                  icon: Award,
                  title: "SEC Registered",
                  description: "Securities and Exchange Commission"
                },
                {
                  icon: Shield,
                  title: "Data Privacy Compliant",
                  description: "Philippine Data Privacy Act"
                },
                {
                  icon: Shield,
                  title: "256-bit SSL",
                  description: "Bank-grade encryption"
                },
                {
                  icon: Award,
                  title: "SOC 2 Type II",
                  description: "Security compliance certified"
                }
              ].map((trust, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, y: 30 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: i * 0.1 }}
                  className="text-center p-6 rounded-xl bg-white/5 border border-white/10"
                >
                  <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-green-500/10 flex items-center justify-center">
                    <trust.icon className="w-8 h-8 text-green-400" />
                  </div>
                  <h3 className="text-white font-bold mb-2">{trust.title}</h3>
                  <p className="text-sm text-gray-400">{trust.description}</p>
                </motion.div>
              ))}
            </div>
          </div>
        </section>

        {/* FAQ Section */}
        <section className="py-24">
          <div className="container mx-auto px-6">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              className="text-center mb-16"
            >
              <h2 className="text-4xl md:text-5xl font-bold text-white mb-6">
                Frequently Asked <span className="text-orange-400">Questions</span>
              </h2>
            </motion.div>

            <div className="max-w-3xl mx-auto space-y-4">
              {[
                {
                  question: "How much does it cost?",
                  answer: "BPOC is free to use for posting jobs and searching candidates. We only charge a placement fee when you successfully hire a candidate through our platform. There are no monthly fees, setup costs, or hidden charges."
                },
                {
                  question: "What is a placement fee?",
                  answer: "A placement fee is a percentage of the candidate's first-year salary, charged only when you successfully hire someone. This aligns our success with yours - we only make money when you do. Contact us for specific pricing based on your volume."
                },
                {
                  question: "Can I try it for free?",
                  answer: "Yes! Our free tier is free forever. Post unlimited jobs, search all 50,000+ candidates, use AI matching, conduct video interviews, and access basic analytics. No credit card required to get started."
                },
                {
                  question: "How are candidates pre-vetted?",
                  answer: "Every candidate is evaluated through our comprehensive AI resume analysis powered by Claude Sonnet 4, which scores resume quality and ATS compatibility. Candidates also complete detailed profile information including skills, experience, and work preferences. You can review all this information before contacting anyone."
                },
                {
                  question: "Can I manage multiple clients?",
                  answer: "Absolutely! Our platform is built for BPO agencies. Manage unlimited clients in one dashboard, create client-specific job pipelines, and give clients restricted portal access to view and approve candidates for their roles."
                },
                {
                  question: "Do you have an API?",
                  answer: "Yes! Our Enterprise tier includes full API access. Build custom client portals, integrate with your existing systems, and access our candidate database programmatically. We provide RESTful endpoints, webhooks, OAuth 2.0, and comprehensive documentation."
                },
                {
                  question: "What if I need help?",
                  answer: "Free tier users get email support with 24-hour response times. Enterprise clients get priority support, dedicated account managers, and direct access to our technical team. We also have extensive documentation and video tutorials."
                },
                {
                  question: "How quickly can I start hiring?",
                  answer: "You can create an account and start posting jobs in under 60 seconds. Our AI will help you write job descriptions instantly. Most agencies make their first placement within 2 weeks of signing up."
                }
              ].map((faq, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: i * 0.05 }}
                  className="border border-white/10 rounded-xl overflow-hidden bg-white/5"
                >
                  <button
                    onClick={() => setOpenFaq(openFaq === i ? null : i)}
                    className="w-full p-6 flex items-center justify-between text-left hover:bg-white/5 transition-colors"
                  >
                    <span className="text-lg font-semibold text-white pr-8">{faq.question}</span>
                    {openFaq === i ? (
                      <ChevronUp className="w-5 h-5 text-orange-400 flex-shrink-0" />
                    ) : (
                      <ChevronDown className="w-5 h-5 text-gray-400 flex-shrink-0" />
                    )}
                  </button>
                  {openFaq === i && (
                    <div className="px-6 pb-6">
                      <p className="text-gray-400 leading-relaxed">{faq.answer}</p>
                    </div>
                  )}
                </motion.div>
              ))}
            </div>
          </div>
        </section>

        {/* Final CTA */}
        <section className="py-32 relative overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-r from-orange-500/10 via-amber-500/10 to-orange-500/10" />

          <div className="container mx-auto px-6 text-center relative z-10">
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
            >
              <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-orange-500/10 border border-orange-500/20 text-orange-400 text-sm font-medium mb-8">
                <Sparkle className="w-4 h-4" />
                <span>Join 500+ agencies already hiring faster</span>
              </div>

              <h2 className="text-5xl md:text-6xl font-bold text-white mb-6">
                Ready to Hire <span className="text-transparent bg-clip-text bg-gradient-to-r from-orange-400 to-amber-500">Faster & Smarter?</span>
              </h2>

              <p className="text-xl text-gray-400 mb-12 max-w-2xl mx-auto">
                Join 500+ Philippine agencies using BPOC to fill roles in days instead of months
              </p>

              <Link href="#signup-form">
                <Button size="lg" className="h-16 px-12 text-xl bg-gradient-to-r from-orange-500 to-amber-600 hover:from-orange-600 hover:to-amber-700 text-white rounded-full shadow-2xl shadow-orange-500/30 mb-8">
                  Create Free Agency Account
                  <ArrowRight className="ml-2 w-6 h-6" />
                </Button>
              </Link>

              <p className="text-sm text-gray-500">
                No credit card required • Free forever • Cancel anytime
              </p>
            </motion.div>
          </div>
        </section>

      </main>

      {/* Footer */}
      <footer className="border-t border-white/5 py-12 bg-[#0B0B0D]">
        <div className="container mx-auto px-6 text-center text-gray-500 text-sm">
          <p>&copy; 2025 BPOC.IO. All rights reserved.</p>
        </div>
      </footer>
    </div>
  );
}

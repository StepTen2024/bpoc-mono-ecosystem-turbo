'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Mail, Lock, ArrowRight, Loader2, User, Briefcase } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useAuth } from '@/contexts/AuthContext';

export default function CandidateLoginPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirect = searchParams.get('redirect') || '/dashboard';
  const { signIn, signUp, signInWithGoogle, user, loading: authLoading } = useAuth();
  
  const [mode, setMode] = useState<'login' | 'signup'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // If already logged in, redirect
  useEffect(() => {
    if (!authLoading && user) {
      router.push(redirect);
    }
  }, [user, authLoading, router, redirect]);

  const ensureCandidate = async (userId: string, userEmail: string, meta?: any) => {
    try {
      await fetch('/api/candidates/ensure', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          id: userId, 
          email: userEmail,
          first_name: meta?.first_name || firstName,
          last_name: meta?.last_name || lastName,
        }),
      });
    } catch (err) {
      console.error('Failed to ensure candidate record:', err);
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const { data, error: authError } = await signIn(email, password);
      if (authError) throw authError;
      if (!data?.user) throw new Error('Login failed');
      
      await ensureCandidate(data.user.id, data.user.email || email, data.user.user_metadata);
      router.push(redirect);
    } catch (err: any) {
      setError(err.message || 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      if (!firstName.trim()) throw new Error('First name is required');
      
      const { data, error: authError } = await signUp(email, password, {
        first_name: firstName,
        last_name: lastName,
        full_name: `${firstName} ${lastName}`.trim(),
      });
      if (authError) throw authError;
      
      if (data?.user) {
        await ensureCandidate(data.user.id, email);
        
        if (data.session) {
          // Auto-confirmed, go to dashboard
          router.push(redirect);
        } else {
          // Email confirmation needed
          setSuccess('Check your email to confirm your account!');
        }
      }
    } catch (err: any) {
      setError(err.message || 'Signup failed');
    } finally {
      setLoading(false);
    }
  };

  const handleGoogle = async () => {
    setLoading(true);
    setError('');
    try {
      await signInWithGoogle();
    } catch (err: any) {
      setError(err.message || 'Google sign-in failed');
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#0a0a0f] flex items-center justify-center px-4">
      {/* Background Effects */}
      <div className="fixed inset-0 pointer-events-none">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-cyan-500/10 rounded-full blur-[120px]" />
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-teal-500/10 rounded-full blur-[120px]" />
      </div>

      <div className="w-full max-w-md relative z-10">
        {/* Logo */}
        <div className="text-center mb-8">
          <Link href="https://bpoc.io" className="inline-flex items-center gap-2">
            <div className="p-2 rounded-xl bg-gradient-to-br from-cyan-500 to-teal-600">
              <Briefcase className="h-6 w-6 text-white" />
            </div>
            <span className="text-xl font-bold text-white">BPOC Candidate</span>
          </Link>
        </div>

        {/* Login/Signup Card */}
        <div className="bg-white/5 border border-white/10 rounded-2xl p-8 backdrop-blur-xl">
          <div className="text-center mb-6">
            <h1 className="text-2xl font-bold text-white">
              {mode === 'login' ? 'Welcome Back' : 'Create Account'}
            </h1>
            <p className="text-gray-400 mt-1">
              {mode === 'login' 
                ? 'Sign in to find your next opportunity' 
                : 'Join BPOC and discover BPO careers'}
            </p>
          </div>

          {/* Mode Toggle */}
          <div className="flex bg-white/5 rounded-lg p-1 mb-6">
            <button
              onClick={() => { setMode('login'); setError(''); setSuccess(''); }}
              className={`flex-1 py-2 text-sm font-medium rounded-md transition-all ${
                mode === 'login' 
                  ? 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/30' 
                  : 'text-gray-400 hover:text-white'
              }`}
            >
              Sign In
            </button>
            <button
              onClick={() => { setMode('signup'); setError(''); setSuccess(''); }}
              className={`flex-1 py-2 text-sm font-medium rounded-md transition-all ${
                mode === 'signup' 
                  ? 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/30' 
                  : 'text-gray-400 hover:text-white'
              }`}
            >
              Sign Up
            </button>
          </div>

          <Button
            type="button"
            disabled={loading}
            onClick={handleGoogle}
            className="w-full bg-white/5 border border-white/10 hover:bg-white/10 text-white py-6 mb-4"
          >
            Continue with Google
          </Button>

          <div className="flex items-center gap-3 my-4">
            <div className="flex-1 h-px bg-white/10" />
            <span className="text-gray-500 text-xs">or use email</span>
            <div className="flex-1 h-px bg-white/10" />
          </div>

          {success && (
            <div className="p-3 rounded-lg bg-green-500/10 border border-green-500/30 text-green-400 text-sm mb-4">
              {success}
            </div>
          )}

          <form onSubmit={mode === 'login' ? handleLogin : handleSignup} className="space-y-4">
            {error && (
              <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/30 text-red-400 text-sm">
                {error}
              </div>
            )}

            {mode === 'signup' && (
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-gray-400 text-sm mb-2">First Name *</label>
                  <div className="relative">
                    <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                    <Input
                      type="text"
                      placeholder="Maria"
                      value={firstName}
                      onChange={(e) => setFirstName(e.target.value)}
                      className="pl-10 bg-white/5 border-white/10 text-white"
                      required
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-gray-400 text-sm mb-2">Last Name</label>
                  <Input
                    type="text"
                    placeholder="Santos"
                    value={lastName}
                    onChange={(e) => setLastName(e.target.value)}
                    className="bg-white/5 border-white/10 text-white"
                  />
                </div>
              </div>
            )}

            <div>
              <label className="block text-gray-400 text-sm mb-2">Email</label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                <Input
                  type="email"
                  placeholder="you@email.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="pl-10 bg-white/5 border-white/10 text-white"
                  required
                />
              </div>
            </div>

            <div>
              <label className="block text-gray-400 text-sm mb-2">Password</label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                <Input
                  type="password"
                  placeholder={mode === 'signup' ? 'Min 6 characters' : 'Your password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="pl-10 bg-white/5 border-white/10 text-white"
                  required
                  minLength={6}
                />
              </div>
            </div>

            <Button
              type="submit"
              disabled={loading}
              className="w-full bg-gradient-to-r from-cyan-500 to-teal-600 hover:from-cyan-600 hover:to-teal-700 text-white py-6"
            >
              {loading ? (
                <Loader2 className="h-5 w-5 animate-spin" />
              ) : (
                <>
                  {mode === 'login' ? 'Sign In' : 'Create Account'}
                  <ArrowRight className="h-5 w-5 ml-2" />
                </>
              )}
            </Button>
          </form>
        </div>

        <p className="text-center text-gray-500 mt-6 text-sm">
          Are you a recruiter?{' '}
          <Link href="https://recruiter.bpoc.io/login" className="text-orange-400 hover:text-orange-300">
            Recruiter login
          </Link>
        </p>
      </div>
    </div>
  );
}

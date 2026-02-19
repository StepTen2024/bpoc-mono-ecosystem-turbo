/* eslint-disable react/no-unescaped-entities */
'use client';

export const dynamic = 'force-dynamic';

import React, { useState } from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { Building2, Mail, Loader2 } from 'lucide-react';
import { Button } from '@/components/shared/ui/button';
import { Input } from '@/components/shared/ui/input';
import { requestPasswordReset } from '@/lib/supabase';

export default function RecruiterForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [sent, setSent] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSent(false);
    setLoading(true);
    try {
      const { error: resetError } = await requestPasswordReset(email);
      if (resetError) throw resetError;
      setSent(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to send reset email');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#0a0a0f] flex items-center justify-center px-4">
      <div className="fixed inset-0 pointer-events-none">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-orange-500/10 rounded-full blur-[120px]" />
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-amber-500/10 rounded-full blur-[120px]" />
      </div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-md relative z-10"
      >
        <div className="text-center mb-8">
          <Link href="/" className="inline-flex items-center gap-2">
            <div className="p-2 rounded-xl bg-gradient-to-br from-orange-500 to-amber-600">
              <Building2 className="h-6 w-6 text-white" />
            </div>
            <span className="text-xl font-bold text-white">BPOC Recruiter</span>
          </Link>
        </div>

        <div className="bg-white/5 border border-white/10 rounded-2xl p-8 backdrop-blur-xl">
          <div className="text-center mb-6">
            <h1 className="text-2xl font-bold text-white">Reset Password</h1>
            <p className="text-gray-400 mt-1">We'll email you a reset link.</p>
          </div>

          {error && (
            <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/30 text-red-400 text-sm mb-4">
              {error}
            </div>
          )}
          {sent && (
            <div className="p-3 rounded-lg bg-green-500/10 border border-green-500/30 text-green-300 text-sm mb-4">
              Reset email sent. Check your inbox.
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-gray-400 text-sm mb-2">Email</label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                <Input
                  type="email"
                  placeholder="mark.n@shoreagents.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="pl-10 bg-white/5 border-white/10 text-white"
                  required
                />
              </div>
            </div>

            <Button
              type="submit"
              disabled={loading}
              className="w-full bg-gradient-to-r from-orange-500 to-amber-600 hover:from-orange-600 hover:to-amber-700 text-white py-6"
            >
              {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : 'Send Reset Email'}
            </Button>
          </form>

          <p className="text-center text-gray-400 mt-6">
            <Link href="/login" className="text-orange-400 hover:text-orange-300">
              Back to login
            </Link>
          </p>
          <p className="text-center text-gray-500 mt-4 text-xs">
            If you signed up with Google, use "Continue with Google" on the login page.
          </p>
        </div>
      </motion.div>
    </div>
  );
}


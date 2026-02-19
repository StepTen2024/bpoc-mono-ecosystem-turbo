'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { ShieldX, ArrowLeft } from 'lucide-react';
import { Button } from '@/components/shared/ui/button';
import Link from 'next/link';

/**
 * Admin Signup is DISABLED
 * 
 * Admins can only be created by other admins via invitation.
 * This page redirects users to login and shows a message.
 */
export default function AdminSignupPage() {
  const router = useRouter();

  // Auto-redirect after 5 seconds
  useEffect(() => {
    const timer = setTimeout(() => {
      router.push('/login');
    }, 5000);
    return () => clearTimeout(timer);
  }, [router]);

  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4">
      {/* Background Effects */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div
          className="absolute inset-0 opacity-[0.02]"
          style={{
            backgroundImage: `linear-gradient(rgba(255,255,255,0.1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.1) 1px, transparent 1px)`,
            backgroundSize: '50px 50px'
          }}
        />
        <div className="absolute top-1/4 left-1/4 w-[600px] h-[600px] bg-red-500/10 rounded-full blur-[150px]" />
        <div className="absolute bottom-1/4 right-1/4 w-[500px] h-[500px] bg-orange-500/10 rounded-full blur-[150px]" />
      </div>

      {/* Message Card */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="relative w-full max-w-md"
      >
        <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl p-8 text-center">
          {/* Icon */}
          <div className="w-20 h-20 rounded-xl bg-red-500/20 border border-red-500/30 flex items-center justify-center mx-auto mb-6">
            <ShieldX className="h-10 w-10 text-red-400" />
          </div>

          {/* Message */}
          <h1 className="text-2xl font-bold text-white mb-3">
            Admin Registration Disabled
          </h1>
          <p className="text-gray-400 mb-6 leading-relaxed">
            Admin accounts cannot be self-registered. You must be <span className="text-orange-400 font-medium">invited by an existing administrator</span> to gain access to the admin panel.
          </p>

          {/* Info Box */}
          <div className="bg-amber-500/10 border border-amber-500/30 rounded-lg p-4 mb-6">
            <p className="text-amber-400 text-sm">
              If you need admin access, please contact your system administrator or the BPOC team.
            </p>
          </div>

          {/* Actions */}
          <div className="space-y-3">
            <Link href="/admin/login" className="block">
              <Button className="w-full bg-gradient-to-r from-red-500 to-orange-600 hover:from-red-600 hover:to-orange-700">
                <ArrowLeft className="h-4 w-4 mr-2" />
                Go to Admin Login
              </Button>
            </Link>

            <p className="text-gray-500 text-xs">
              Redirecting to login in 5 seconds...
            </p>
          </div>
        </div>
      </motion.div>
    </div>
  );
}

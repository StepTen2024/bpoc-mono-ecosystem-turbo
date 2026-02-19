import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase/admin';
import { verifyAuthToken } from '@/lib/auth/verify-token';

export async function GET(request: NextRequest) {
  try {
    // Verify authentication
    const auth = await verifyAuthToken(request);
    if (!auth.userId) {
      return NextResponse.json({ error: auth.error || 'Not authenticated' }, { status: 401 });
    }
    // Fetch all counts in parallel
    const [
      candidatesResult,
      agenciesResult,
      jobsResult,
      applicationsResult,
      interviewsResult,
      offersResult,
      recentActivityResult,
      pendingVerificationResult,
      expiredDocsResult,
      expiringDocsResult
    ] = await Promise.all([
      // Total candidates
      supabase.from('candidates').select('id', { count: 'exact', head: true }),
      
      // Total agencies
      supabase.from('agencies').select('id', { count: 'exact', head: true }).eq('is_active', true),
      
      // Active jobs
      supabase.from('jobs').select('id', { count: 'exact', head: true }).eq('status', 'active'),
      
      // Pending applications
      supabase.from('job_applications').select('id', { count: 'exact', head: true }).in('status', ['submitted', 'under_review']),
      
      // Scheduled interviews
      supabase.from('job_interviews').select('id', { count: 'exact', head: true }).eq('status', 'scheduled'),
      
      // Pending offers
      supabase.from('job_offers').select('id', { count: 'exact', head: true }).eq('status', 'sent'),
      
      // Recent activity - last 10 candidates
      supabase
        .from('candidates')
        .select('id, email, first_name, last_name, created_at')
        .order('created_at', { ascending: false })
        .limit(10),
      
      // Agencies pending verification (docs uploaded but not verified)
      supabase
        .from('agencies')
        .select('id, name', { count: 'exact' })
        .eq('is_active', true)
        .eq('documents_verified', false)
        .not('documents_uploaded_at', 'is', null),

      // Agencies with expired documents
      supabase
        .from('agencies')
        .select('id, name, document_expiry_date, business_permit_expiry')
        .eq('is_verified', true)
        .lt('document_expiry_date', new Date().toISOString().split('T')[0]),

      // Agencies with docs expiring in next 30 days
      supabase
        .from('agencies')
        .select('id, name, document_expiry_date, business_permit_expiry')
        .eq('is_verified', true)
        .gt('document_expiry_date', new Date().toISOString().split('T')[0])
        .lt('document_expiry_date', new Date(Date.now() + 30 * 86400000).toISOString().split('T')[0])
    ]);

    const stats = {
      totalCandidates: candidatesResult.count || 0,
      totalAgencies: agenciesResult.count || 0,
      activeJobs: jobsResult.count || 0,
      pendingApplications: applicationsResult.count || 0,
      scheduledInterviews: interviewsResult.count || 0,
      pendingOffers: offersResult.count || 0,
    };

    // Format recent activity
    const recentActivity = (recentActivityResult.data || []).map((candidate, index) => ({
      id: candidate.id || `activity-${index}`,
      type: 'signup' as const,
      message: `New candidate registered: ${candidate.first_name || ''} ${candidate.last_name || ''} (${candidate.email || 'unknown'})`.trim(),
      time: candidate.created_at ? formatTimeAgo(new Date(candidate.created_at)) : 'Unknown',
    }));

    // Alerts for admin dashboard
    const alerts: Array<{ type: string; severity: 'warning' | 'error' | 'info'; message: string; count: number; href: string }> = [];

    if (pendingVerificationResult.count && pendingVerificationResult.count > 0) {
      alerts.push({
        type: 'pending_verification',
        severity: 'warning',
        message: `${pendingVerificationResult.count} ${pendingVerificationResult.count === 1 ? 'agency needs' : 'agencies need'} document verification`,
        count: pendingVerificationResult.count,
        href: '/agencies',
      });
    }

    if (expiredDocsResult.data && expiredDocsResult.data.length > 0) {
      alerts.push({
        type: 'expired_documents',
        severity: 'error',
        message: `${expiredDocsResult.data.length} ${expiredDocsResult.data.length === 1 ? 'agency has' : 'agencies have'} expired documents`,
        count: expiredDocsResult.data.length,
        href: '/agencies',
      });
    }

    if (expiringDocsResult.data && expiringDocsResult.data.length > 0) {
      alerts.push({
        type: 'expiring_documents',
        severity: 'info',
        message: `${expiringDocsResult.data.length} ${expiringDocsResult.data.length === 1 ? 'agency has' : 'agencies have'} documents expiring within 30 days`,
        count: expiringDocsResult.data.length,
        href: '/agencies',
      });
    }

    return NextResponse.json({
      stats,
      recentActivity,
      alerts,
      expiredAgencies: expiredDocsResult.data || [],
      expiringAgencies: expiringDocsResult.data || [],
    });

  } catch (error) {
    console.error('Dashboard stats error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch dashboard stats' },
      { status: 500 }
    );
  }
}

function formatTimeAgo(date: Date): string {
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins} minute${diffMins > 1 ? 's' : ''} ago`;
  if (diffHours < 24) return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;
  return `${diffDays} day${diffDays > 1 ? 's' : ''} ago`;
}


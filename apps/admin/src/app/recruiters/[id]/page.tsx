'use client';

import React, { useState, useEffect, use } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  ArrowLeft,
  Shield,
  FileText,
  User,
  Building2,
  Mail,
  Calendar,
  CheckCircle,
  XCircle,
  Clock,
  Users,
  Download,
  ExternalLink,
  AlertCircle,
  Loader2,
  Brain,
  Sparkles,
  TriangleAlert,
} from 'lucide-react';
import { Button } from '@/components/shared/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/shared/ui/card';
import { Badge } from '@/components/shared/ui/badge';
import DocumentPreviewModal from '@/components/admin/DocumentPreviewModal';
import AuthorizationChainTree from '@/components/admin/AuthorizationChainTree';

interface RecruiterData {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  role: string;
  verificationStatus: string;
  profileCompletionPercentage: number;
  isVerified: boolean;
  isActive: boolean;
  createdAt: string;
  verifiedAt: string | null;
  rejectedAt: string | null;
  rejectionReason: string | null;
  invitedBy: {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
    role: string;
  } | null;
  invitedMembers: Array<{
    id: string;
    firstName: string;
    lastName: string;
    email: string;
    verificationStatus: string;
    role: string;
  }>;
  agency: {
    id: string;
    name: string;
    email: string;
    logoUrl: string | null;
    tinNumber: string | null;
    birnNumber: string | null;
    dtiCertificateUrl: string | null;
    businessPermitUrl: string | null;
    secRegistrationUrl: string | null;
    nbiClearanceUrl: string | null;
    documentsUploadedAt: string | null;
    documentsVerified: boolean;
    documentsVerifiedAt: string | null;
    verifiedByAdmin: {
      email: string;
      firstName: string;
      lastName: string;
    } | null;
  };
}

export default function RecruiterDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const [recruiter, setRecruiter] = useState<RecruiterData | null>(null);
  const [loading, setLoading] = useState(true);
  const [approving, setApproving] = useState(false);
  const [rejecting, setRejecting] = useState(false);
  const [rejectReason, setRejectReason] = useState('');
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [showDocPreview, setShowDocPreview] = useState(false);
  const [previewDoc, setPreviewDoc] = useState<{ url: string; name: string; type: string } | null>(null);
  const [aiVerifying, setAiVerifying] = useState(false);
  const [aiVerification, setAiVerification] = useState<any>(null);

  const handleAiVerify = async () => {
    if (!recruiter) return;
    setAiVerifying(true);
    try {
      const response = await fetch(`/api/agencies/${recruiter.agency.id}/verify-documents`, {
        method: 'POST',
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'AI verification failed');
      setAiVerification(data.result);
    } catch (error: any) {
      alert(error.message);
    } finally {
      setAiVerifying(false);
    }
  };

  useEffect(() => {
    fetchRecruiterDetails();
  }, [id]);

  const fetchRecruiterDetails = async () => {
    try {
      const response = await fetch(`/api/recruiters/${id}`);
      const data = await response.json();
      if (data.recruiter) {
        setRecruiter(data.recruiter);
      }
    } catch (error) {
      console.error('Failed to fetch recruiter:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleApprove = async () => {
    setApproving(true);
    try {
      const response = await fetch(`/api/recruiters/${id}/verify`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'verify' }),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Approval failed');
      }

      alert('Recruiter verified successfully!');
      fetchRecruiterDetails();
    } catch (error: any) {
      alert(error.message);
    } finally {
      setApproving(false);
    }
  };

  const handleReject = async () => {
    if (!rejectReason.trim()) {
      alert('Please provide a rejection reason');
      return;
    }

    setRejecting(true);
    try {
      const response = await fetch(`/api/recruiters/${id}/verify`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'reject',
          reason: rejectReason,
        }),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Rejection failed');
      }

      alert('Recruiter rejected');
      setShowRejectModal(false);
      fetchRecruiterDetails();
    } catch (error: any) {
      alert(error.message);
    } finally {
      setRejecting(false);
    }
  };

  const getStatusBadge = (status: string) => {
    const statusConfig: Record<string, { label: string; className: string }> = {
      verified: { label: 'Verified', className: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30' },
      rejected: { label: 'Rejected', className: 'bg-red-500/20 text-red-400 border-red-500/30' },
      pending_documents: { label: 'Needs Documents', className: 'bg-orange-500/20 text-orange-400 border-orange-500/30' },
      pending_admin_review: { label: 'Awaiting Review', className: 'bg-blue-500/20 text-blue-400 border-blue-500/30' },
      pending_authorization_head: { label: 'Awaiting Auth Head', className: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30' },
    };

    const config = statusConfig[status] || { label: status, className: 'bg-gray-500/20 text-gray-400 border-gray-500/30' };

    return <Badge className={config.className}>{config.label}</Badge>;
  };

  const formatDate = (dateString: string | null) => {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const openDocPreview = (url: string, name: string, type: string) => {
    setPreviewDoc({ url, name, type });
    setShowDocPreview(true);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-gray-400">Loading...</div>
      </div>
    );
  }

  if (!recruiter) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-red-400">Recruiter not found</div>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="mb-6">
        <Link href="/recruiters">
          <Button variant="ghost" className="mb-4 text-gray-400 hover:text-white">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Recruiters
          </Button>
        </Link>

        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-white mb-2">
              {recruiter.firstName} {recruiter.lastName}
            </h1>
            <p className="text-gray-400">{recruiter.email}</p>
          </div>
          {getStatusBadge(recruiter.verificationStatus)}
        </div>
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        {/* LEFT COLUMN - Main Info */}
        <div className="lg:col-span-2 space-y-6">

          {/* Recruiter Info Card */}
          <Card className="bg-white/5 border-white/10">
            <CardHeader className="border-b border-white/10">
              <CardTitle className="text-white">Recruiter Information</CardTitle>
            </CardHeader>
            <CardContent className="p-6">
              <dl className="grid grid-cols-2 gap-4">
                <div>
                  <dt className="text-sm text-gray-500 mb-1">Role</dt>
                  <dd className="text-white font-medium capitalize">{recruiter.role}</dd>
                </div>
                <div>
                  <dt className="text-sm text-gray-500 mb-1">Agency</dt>
                  <dd>
                    <Link href={`/admin/agencies/${recruiter.agency.id}`} className="text-cyan-400 hover:underline">
                      {recruiter.agency.name}
                    </Link>
                  </dd>
                </div>
                <div>
                  <dt className="text-sm text-gray-500 mb-1">Join Date</dt>
                  <dd className="text-white">{formatDate(recruiter.createdAt)}</dd>
                </div>
                <div>
                  <dt className="text-sm text-gray-500 mb-1">Profile Completion</dt>
                  <dd className="text-white">{recruiter.profileCompletionPercentage}%</dd>
                </div>
                <div>
                  <dt className="text-sm text-gray-500 mb-1">Status</dt>
                  <dd className="text-white">{recruiter.isActive ? 'Active' : 'Inactive'}</dd>
                </div>
                {recruiter.verifiedAt && (
                  <div>
                    <dt className="text-sm text-gray-500 mb-1">Verified At</dt>
                    <dd className="text-white">{formatDate(recruiter.verifiedAt)}</dd>
                  </div>
                )}
              </dl>
            </CardContent>
          </Card>

          {/* Agency Documents Card */}
          <Card className="bg-white/5 border-white/10">
            <CardHeader className="border-b border-white/10 flex flex-row items-center justify-between">
              <CardTitle className="text-white flex items-center gap-2">
                <Shield className="h-5 w-5 text-purple-400" />
                Agency Documents
              </CardTitle>
              {recruiter.agency.documentsVerified ? (
                <Badge className="bg-emerald-500/20 text-emerald-400">Verified</Badge>
              ) : (
                <Badge className="bg-orange-500/20 text-orange-400">Pending</Badge>
              )}
            </CardHeader>
            <CardContent className="p-6 space-y-4">
              {/* TIN Number */}
              <div>
                <label className="text-sm text-gray-500 mb-1 block">TIN Number</label>
                <p className="text-white font-mono">{recruiter.agency.tinNumber || 'Not provided'}</p>
              </div>

              {/* BIRN Number */}
              <div>
                <label className="text-sm text-gray-500 mb-1 block">BIRN Number</label>
                <p className="text-white font-mono">{recruiter.agency.birnNumber || 'Not provided'}</p>
              </div>

              {/* DTI Certificate */}
              <div>
                <label className="text-sm text-gray-500 mb-1 block">DTI Certificate</label>
                {recruiter.agency.dtiCertificateUrl ? (
                  <button
                    onClick={() => openDocPreview(recruiter.agency.dtiCertificateUrl!, 'DTI Certificate', 'DTI Certificate')}
                    className="inline-flex items-center gap-2 text-cyan-400 hover:underline"
                  >
                    <FileText className="w-4 h-4" />
                    View Document
                  </button>
                ) : (
                  <p className="text-gray-500">Not uploaded</p>
                )}
              </div>

              {/* Business Permit */}
              <div>
                <label className="text-sm text-gray-500 mb-1 block">Business Permit</label>
                {recruiter.agency.businessPermitUrl ? (
                  <button
                    onClick={() => openDocPreview(recruiter.agency.businessPermitUrl!, 'Business Permit', 'Business Permit')}
                    className="inline-flex items-center gap-2 text-cyan-400 hover:underline"
                  >
                    <FileText className="w-4 h-4" />
                    View Document
                  </button>
                ) : (
                  <p className="text-gray-500">Not uploaded</p>
                )}
              </div>

              {/* SEC Registration */}
              <div>
                <label className="text-sm text-gray-500 mb-1 block">SEC Registration</label>
                {recruiter.agency.secRegistrationUrl ? (
                  <button
                    onClick={() => openDocPreview(recruiter.agency.secRegistrationUrl!, 'SEC Registration', 'SEC Registration Certificate')}
                    className="inline-flex items-center gap-2 text-cyan-400 hover:underline"
                  >
                    <FileText className="w-4 h-4" />
                    View Document
                  </button>
                ) : (
                  <p className="text-gray-500">Not uploaded</p>
                )}
              </div>

              {/* NBI Clearance */}
              <div>
                <label className="text-sm text-gray-500 mb-1 block">NBI Clearance</label>
                {recruiter.agency.nbiClearanceUrl ? (
                  <button
                    onClick={() => openDocPreview(recruiter.agency.nbiClearanceUrl!, 'NBI Clearance', 'NBI Clearance')}
                    className="inline-flex items-center gap-2 text-cyan-400 hover:underline"
                  >
                    <FileText className="w-4 h-4" />
                    View Document
                  </button>
                ) : (
                  <p className="text-gray-500">Not uploaded</p>
                )}
              </div>

              {/* Upload Timestamp */}
              {recruiter.agency.documentsUploadedAt && (
                <div className="pt-4 border-t border-white/10">
                  <p className="text-sm text-gray-500">
                    Uploaded {formatDate(recruiter.agency.documentsUploadedAt)}
                  </p>
                </div>
              )}

              {/* Verification Info */}
              {recruiter.agency.documentsVerified && recruiter.agency.verifiedByAdmin && (
                <div className="pt-4 border-t border-white/10">
                  <p className="text-sm text-gray-500">
                    Verified by {recruiter.agency.verifiedByAdmin.email} on{' '}
                    {formatDate(recruiter.agency.documentsVerifiedAt)}
                  </p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* AI Document Verification */}
          {recruiter.verificationStatus !== 'verified' && (
            <Card className="bg-gradient-to-br from-purple-500/10 via-white/5 to-blue-500/10 border-purple-500/30">
              <CardHeader className="border-b border-white/10">
                <CardTitle className="text-white flex items-center gap-2">
                  <Brain className="w-5 h-5 text-purple-400" />
                  AI Document Verification
                </CardTitle>
              </CardHeader>
              <CardContent className="p-6">
                {!aiVerification ? (
                  <div>
                    <p className="text-gray-400 text-sm mb-4">
                      Run AI analysis on uploaded documents to verify authenticity, extract key data, 
                      and cross-check company details across all documents.
                    </p>
                    <Button
                      onClick={handleAiVerify}
                      disabled={aiVerifying}
                      className="bg-purple-500 hover:bg-purple-600 text-white"
                    >
                      {aiVerifying ? (
                        <>
                          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                          Analyzing Documents...
                        </>
                      ) : (
                        <>
                          <Sparkles className="w-4 h-4 mr-2" />
                          Run AI Verification
                        </>
                      )}
                    </Button>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {/* Overall Score */}
                    <div className="flex items-center gap-4 p-4 rounded-lg bg-black/20">
                      <div className={`text-4xl font-bold ${
                        aiVerification.overallConfidence >= 80 ? 'text-emerald-400' :
                        aiVerification.overallConfidence >= 50 ? 'text-yellow-400' : 'text-red-400'
                      }`}>
                        {aiVerification.overallConfidence}%
                      </div>
                      <div>
                        <Badge className={
                          aiVerification.overallStatus === 'VERIFIED' ? 'bg-emerald-500/20 text-emerald-400' :
                          aiVerification.overallStatus === 'NEEDS_REVIEW' ? 'bg-yellow-500/20 text-yellow-400' :
                          'bg-red-500/20 text-red-400'
                        }>
                          {aiVerification.overallStatus}
                        </Badge>
                        <p className="text-sm text-gray-400 mt-1">
                          {aiVerification.overallStatus === 'VERIFIED' ? 'All documents appear legitimate' :
                           aiVerification.overallStatus === 'NEEDS_REVIEW' ? 'Some issues found — review required' :
                           'Significant issues detected'}
                        </p>
                      </div>
                    </div>

                    {/* Cross-Check Results */}
                    <div className="grid grid-cols-2 gap-2">
                      {[
                        { label: 'Company Name Match', ok: aiVerification.crossCheckResults.companyNameConsistent },
                        { label: 'TIN Consistent', ok: aiVerification.crossCheckResults.tinConsistent },
                        { label: 'Address Match', ok: aiVerification.crossCheckResults.addressConsistent },
                        { label: 'BPO Company', ok: aiVerification.crossCheckResults.isBpoCompany },
                      ].map((check) => (
                        <div key={check.label} className={`flex items-center gap-2 p-2 rounded text-sm ${
                          check.ok ? 'bg-emerald-500/10 text-emerald-400' : 'bg-red-500/10 text-red-400'
                        }`}>
                          {check.ok ? <CheckCircle className="w-4 h-4" /> : <XCircle className="w-4 h-4" />}
                          {check.label}
                        </div>
                      ))}
                    </div>

                    {/* Individual Document Results */}
                    {Object.entries(aiVerification.documents).map(([key, doc]: [string, any]) => (
                      <div key={key} className="p-3 rounded-lg bg-black/20 border border-white/5">
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-white font-medium capitalize">{key.replace('_', ' ')}</span>
                          <Badge className={
                            doc.confidence === 'HIGH' ? 'bg-emerald-500/20 text-emerald-400' :
                            doc.confidence === 'MEDIUM' ? 'bg-yellow-500/20 text-yellow-400' :
                            'bg-red-500/20 text-red-400'
                          }>
                            {doc.confidence}
                          </Badge>
                        </div>
                        <dl className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
                          {doc.companyName && (
                            <>
                              <dt className="text-gray-500">Company</dt>
                              <dd className="text-gray-300">{doc.companyName}</dd>
                            </>
                          )}
                          {doc.registrationNumber && (
                            <>
                              <dt className="text-gray-500">Reg. Number</dt>
                              <dd className="text-gray-300 font-mono">{doc.registrationNumber}</dd>
                            </>
                          )}
                          {doc.tinNumber && (
                            <>
                              <dt className="text-gray-500">TIN</dt>
                              <dd className="text-gray-300 font-mono">{doc.tinNumber}</dd>
                            </>
                          )}
                          {doc.businessType && (
                            <>
                              <dt className="text-gray-500">Business Type</dt>
                              <dd className="text-gray-300">{doc.businessType}</dd>
                            </>
                          )}
                          {doc.expiryDate && (
                            <>
                              <dt className="text-gray-500">Expiry</dt>
                              <dd className={doc.isExpired ? 'text-red-400' : 'text-gray-300'}>
                                {doc.expiryDate} {doc.isExpired && '(EXPIRED)'}
                              </dd>
                            </>
                          )}
                          <dt className="text-gray-500">Detected As</dt>
                          <dd className={doc.isCorrectType ? 'text-gray-300' : 'text-orange-400'}>
                            {doc.documentType} {!doc.isCorrectType && '⚠️'}
                          </dd>
                        </dl>
                        {doc.issues.length > 0 && (
                          <div className="mt-2 pt-2 border-t border-white/5">
                            {doc.issues.map((issue: string, i: number) => (
                              <p key={i} className="text-xs text-orange-400 flex items-start gap-1">
                                <TriangleAlert className="w-3 h-3 mt-0.5 shrink-0" />
                                {issue}
                              </p>
                            ))}
                          </div>
                        )}
                      </div>
                    ))}

                    {/* Cross-check Issues */}
                    {aiVerification.crossCheckResults.issues.length > 0 && (
                      <div className="p-3 rounded-lg bg-orange-500/10 border border-orange-500/20">
                        <p className="text-orange-400 text-sm font-medium mb-2">⚠️ Cross-Check Issues</p>
                        {aiVerification.crossCheckResults.issues.map((issue: string, i: number) => (
                          <p key={i} className="text-xs text-orange-300 ml-4">• {issue}</p>
                        ))}
                      </div>
                    )}

                    <Button
                      onClick={handleAiVerify}
                      variant="outline"
                      size="sm"
                      className="border-purple-500/30 text-purple-400 hover:bg-purple-500/10"
                    >
                      <Sparkles className="w-3 h-3 mr-1" />
                      Re-run Verification
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* Approval Actions */}
          {recruiter.verificationStatus !== 'verified' && recruiter.verificationStatus !== 'rejected' && (
            recruiter.agency.tinNumber &&
            recruiter.agency.birnNumber &&
            recruiter.agency.dtiCertificateUrl &&
            recruiter.agency.businessPermitUrl &&
            recruiter.agency.secRegistrationUrl &&
            recruiter.agency.nbiClearanceUrl
          ) && (
            <Card className="bg-gradient-to-br from-emerald-500/10 via-white/5 to-cyan-500/10 border-emerald-500/30">
              <CardHeader className="border-b border-white/10">
                <CardTitle className="text-white flex items-center gap-2">
                  <CheckCircle className="w-5 h-5 text-emerald-400" />
                  Documents Ready for Review
                </CardTitle>
              </CardHeader>
              <CardContent className="p-6">
                <div className="mb-4">
                  <p className="text-gray-400 text-sm mb-2">All required documents have been uploaded:</p>
                  <div className="flex flex-wrap gap-2">
                    <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/30">
                      <CheckCircle className="w-3 h-3 mr-1" />
                      TIN Number
                    </Badge>
                    <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/30">
                      <CheckCircle className="w-3 h-3 mr-1" />
                      BIRN Number
                    </Badge>
                    <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/30">
                      <CheckCircle className="w-3 h-3 mr-1" />
                      DTI Certificate
                    </Badge>
                    <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/30">
                      <CheckCircle className="w-3 h-3 mr-1" />
                      Business Permit
                    </Badge>
                    <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/30">
                      <CheckCircle className="w-3 h-3 mr-1" />
                      SEC Registration
                    </Badge>
                    <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/30">
                      <CheckCircle className="w-3 h-3 mr-1" />
                      NBI Clearance
                    </Badge>
                  </div>
                </div>

                <div className="flex gap-4">
                  <Button
                    onClick={handleApprove}
                    disabled={approving}
                    className="bg-emerald-500 hover:bg-emerald-600 text-white flex-1"
                  >
                    {approving ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        Approving...
                      </>
                    ) : (
                      <>
                        <CheckCircle className="w-4 h-4 mr-2" />
                        Approve Documents
                      </>
                    )}
                  </Button>
                  <Button
                    onClick={() => setShowRejectModal(true)}
                    variant="outline"
                    className="border-red-500/30 text-red-400 hover:bg-red-500/10"
                  >
                    <XCircle className="w-4 h-4 mr-2" />
                    Reject
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Missing Documents Warning */}
          {recruiter.verificationStatus !== 'verified' && recruiter.verificationStatus !== 'rejected' && !(
            recruiter.agency.tinNumber &&
            recruiter.agency.birnNumber &&
            recruiter.agency.dtiCertificateUrl &&
            recruiter.agency.businessPermitUrl &&
            recruiter.agency.secRegistrationUrl &&
            recruiter.agency.nbiClearanceUrl
          ) && (
            <Card className="bg-orange-500/10 border-orange-500/30">
              <CardHeader className="border-b border-orange-500/30">
                <CardTitle className="text-orange-400 flex items-center gap-2">
                  <Clock className="w-5 h-5" />
                  Awaiting Documents
                </CardTitle>
              </CardHeader>
              <CardContent className="p-6">
                <p className="text-gray-400 text-sm mb-4">The recruiter needs to upload these documents:</p>
                <div className="flex flex-wrap gap-2">
                  {!recruiter.agency.tinNumber && (
                    <Badge className="bg-orange-500/20 text-orange-400 border-orange-500/30">
                      <Clock className="w-3 h-3 mr-1" />
                      TIN Number
                    </Badge>
                  )}
                  {!recruiter.agency.birnNumber && (
                    <Badge className="bg-orange-500/20 text-orange-400 border-orange-500/30">
                      <Clock className="w-3 h-3 mr-1" />
                      BIRN Number
                    </Badge>
                  )}
                  {!recruiter.agency.dtiCertificateUrl && (
                    <Badge className="bg-orange-500/20 text-orange-400 border-orange-500/30">
                      <Clock className="w-3 h-3 mr-1" />
                      DTI Certificate
                    </Badge>
                  )}
                  {!recruiter.agency.businessPermitUrl && (
                    <Badge className="bg-orange-500/20 text-orange-400 border-orange-500/30">
                      <Clock className="w-3 h-3 mr-1" />
                      Business Permit
                    </Badge>
                  )}
                  {!recruiter.agency.secRegistrationUrl && (
                    <Badge className="bg-orange-500/20 text-orange-400 border-orange-500/30">
                      <Clock className="w-3 h-3 mr-1" />
                      SEC Registration
                    </Badge>
                  )}
                  {!recruiter.agency.nbiClearanceUrl && (
                    <Badge className="bg-orange-500/20 text-orange-400 border-orange-500/30">
                      <Clock className="w-3 h-3 mr-1" />
                      NBI Clearance
                    </Badge>
                  )}
                </div>
                <p className="text-gray-500 text-xs mt-4">No action required until all documents are uploaded.</p>
              </CardContent>
            </Card>
          )}

          {/* Rejection Info */}
          {recruiter.rejectedAt && (
            <Card className="bg-red-500/10 border-red-500/30">
              <CardHeader className="border-b border-red-500/30">
                <CardTitle className="text-red-400 flex items-center gap-2">
                  <XCircle className="w-5 h-5" />
                  Rejected
                </CardTitle>
              </CardHeader>
              <CardContent className="p-6">
                <p className="text-sm text-gray-400 mb-2">Rejected on {formatDate(recruiter.rejectedAt)}</p>
                {recruiter.rejectionReason && (
                  <p className="text-white">{recruiter.rejectionReason}</p>
                )}
              </CardContent>
            </Card>
          )}
        </div>

        {/* RIGHT COLUMN - Sidebar */}
        <div className="space-y-6">

          {/* Authorization Chain Tree */}
          <AuthorizationChainTree
            agencyId={recruiter.agency.id}
            currentRecruiterId={recruiter.id}
          />

          {/* Activity Timeline */}
          <Card className="bg-white/5 border-white/10">
            <CardHeader className="border-b border-white/10">
              <CardTitle className="text-white text-sm">Activity</CardTitle>
            </CardHeader>
            <CardContent className="p-4">
              <div className="space-y-3 text-sm">
                <div>
                  <p className="text-gray-500">Account Created</p>
                  <p className="text-white">{formatDate(recruiter.createdAt)}</p>
                </div>
                {recruiter.agency.documentsUploadedAt && (
                  <div>
                    <p className="text-gray-500">Documents Uploaded</p>
                    <p className="text-white">{formatDate(recruiter.agency.documentsUploadedAt)}</p>
                  </div>
                )}
                {recruiter.verifiedAt && (
                  <div>
                    <p className="text-gray-500">Verified</p>
                    <p className="text-white">{formatDate(recruiter.verifiedAt)}</p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Document Preview Modal */}
      {previewDoc && (
        <DocumentPreviewModal
          isOpen={showDocPreview}
          onClose={() => {
            setShowDocPreview(false);
            setPreviewDoc(null);
          }}
          documentUrl={previewDoc.url}
          documentName={previewDoc.name}
          documentType={previewDoc.type}
        />
      )}

      {/* Reject Modal */}
      {showRejectModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-[#1a1a1f] border border-white/10 rounded-lg p-6 max-w-md w-full">
            <h3 className="text-xl font-bold text-white mb-4">Reject Recruiter</h3>
            <p className="text-gray-400 mb-4">Please provide a reason for rejection:</p>
            <textarea
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              className="w-full h-32 bg-white/5 border border-white/10 rounded-lg p-3 text-white placeholder-gray-500 focus:outline-none focus:border-orange-500/50"
              placeholder="e.g., Invalid business permit, expired documents, etc."
            />
            <div className="flex gap-3 mt-6">
              <Button
                onClick={handleReject}
                disabled={rejecting || !rejectReason.trim()}
                variant="destructive"
                className="flex-1"
              >
                {rejecting ? 'Rejecting...' : 'Confirm Rejection'}
              </Button>
              <Button
                onClick={() => {
                  setShowRejectModal(false);
                  setRejectReason('');
                }}
                variant="ghost"
                className="flex-1"
              >
                Cancel
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

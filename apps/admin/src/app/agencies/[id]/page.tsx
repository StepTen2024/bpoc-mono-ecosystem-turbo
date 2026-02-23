'use client';

import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { useParams, useRouter } from 'next/navigation';
import {
  ArrowLeft, Building2, Mail, Phone, Globe, Users, Briefcase, Loader2,
  MapPin, CheckCircle, XCircle, Trophy, DollarSign, Eye, Calendar,
  Shield, ExternalLink, Edit, Trash2, Plus, Clock, UserPlus, X, FileText,
  ShieldCheck, ShieldAlert, ShieldX, AlertTriangle
} from 'lucide-react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/shared/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/shared/ui/card';
import { Button } from '@/components/shared/ui/button';
import { Badge } from '@/components/shared/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/shared/ui/avatar';
import Link from 'next/link';
import { getSessionToken } from '@/lib/auth-helpers';
import { toast } from '@/components/shared/ui/toast';
import EditAgencyModal from '@/components/admin/EditAgencyModal';
import { AgencyWebhooksView } from '@/components/admin/AgencyWebhooksView';
import DocumentPreviewModal from '@/components/admin/DocumentPreviewModal';

interface AgencyDetail {
  id: string;
  name: string;
  slug: string;
  email?: string;
  phone?: string;
  logoUrl?: string;
  website?: string;
  isActive: boolean;
  isVerified: boolean;
  description?: string;
  address?: string;
  city?: string;
  country?: string;
  createdAt: string;
  // Profile fields (from agency_profiles)
  foundedYear?: number;
  employeeCount?: string;
  addressLine1?: string;
  addressLine2?: string;
  state?: string;
  postalCode?: string;
  linkedinUrl?: string;
  facebookUrl?: string;
  twitterUrl?: string;
  settings?: any;
  branding?: any;
  // Document fields
  tinNumber?: string;
  dtiCertificateUrl?: string;
  businessPermitUrl?: string;
  secRegistrationUrl?: string;
  documentsUploadedAt?: string;
  documentsVerified?: boolean;
  documentsVerifiedAt?: string;
  documentsVerifiedBy?: string;
  documentVerification?: any;
  verifiedByAdmin?: {
    id: string;
    email: string;
    firstName: string;
    lastName: string;
  };
  // Stats
  totalJobs: number;
  activeJobs: number;
  totalPlacements: number;
  totalRevenue: number;
  // Related data
  recruiters: {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
    avatarUrl?: string;
    role: string;
    createdAt: string;
  }[];
  clients: {
    id: string;
    status: string;
    companyName: string;
    companyLogo?: string;
    industry?: string;
    jobCount: number;
    createdAt: string;
  }[];
  recentJobs: {
    id: string;
    title: string;
    status: string;
    applicantsCount: number;
    createdAt: string;
  }[];
}

interface AvailableRecruiter {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  agencyId: string;
  agencyName: string;
}

export default function AdminAgencyDetailPage() {
  const params = useParams();
  const router = useRouter();
  const agencyId = params.id as string;
  
  const [loading, setLoading] = useState(true);
  const [agency, setAgency] = useState<AgencyDetail | null>(null);
  const [showReassignModal, setShowReassignModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [availableRecruiters, setAvailableRecruiters] = useState<AvailableRecruiter[]>([]);
  const [selectedRecruiterId, setSelectedRecruiterId] = useState<string>('');
  const [reassigning, setReassigning] = useState(false);
  const [showDocPreview, setShowDocPreview] = useState(false);
  const [previewDoc, setPreviewDoc] = useState<{ url: string; name: string; type: string } | null>(null);
  const [approvingDocs, setApprovingDocs] = useState(false);
  const [rejectingDocs, setRejectingDocs] = useState(false);

  useEffect(() => {
    if (agencyId) fetchAgency();
  }, [agencyId]);

  // Fetch available recruiters when modal opens
  useEffect(() => {
    if (showReassignModal) {
      fetchAvailableRecruiters();
    }
  }, [showReassignModal]);

  const fetchAvailableRecruiters = async () => {
    try {
      const token = await getSessionToken();
      const response = await fetch(`/api/agencies/reassign-recruiter?excludeAgencyId=${agencyId}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await response.json();
      if (response.ok) {
        setAvailableRecruiters(data.recruiters || []);
      }
    } catch (error) {
      console.error('Error fetching recruiters:', error);
    }
  };

  const handleReassignRecruiter = async () => {
    if (!selectedRecruiterId) return;

    setReassigning(true);
    try {
      const token = await getSessionToken();
      const response = await fetch('/api/agencies/reassign-recruiter', {
        method: 'POST',
        headers: { 
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          recruiterId: selectedRecruiterId,
          newAgencyId: agencyId,
        }),
      });

      const data = await response.json();
      
      if (response.ok) {
        toast.success(data.message || 'Recruiter reassigned successfully');
        setShowReassignModal(false);
        setSelectedRecruiterId('');
        fetchAgency(); // Refresh agency data
      } else {
        toast.error(data.error || 'Failed to reassign recruiter');
      }
    } catch (error) {
      console.error('Error reassigning recruiter:', error);
      toast.error('Failed to reassign recruiter');
    } finally {
      setReassigning(false);
    }
  };

  const handleRemoveRecruiter = async (recruiterId: string, recruiterName: string) => {
    if (!confirm(`Are you sure you want to remove ${recruiterName} from this agency?`)) return;

    try {
      const token = await getSessionToken();
      const response = await fetch('/api/agencies/remove-recruiter', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ recruiterId })
      });

      const data = await response.json();

      if (response.ok) {
        toast.success(data.message || 'Recruiter removed successfully');
        fetchAgency(); // Refresh agency data
      } else {
        toast.error(data.error || 'Failed to remove recruiter');
        if (data.details) {
          toast.info(data.details);
        }
      }
    } catch (error) {
      console.error('Error removing recruiter:', error);
      toast.error('Failed to remove recruiter');
    }
  };

  const fetchAgency = async () => {
    try {
      const token = await getSessionToken();
      const response = await fetch(`/api/agencies/${agencyId}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      
      const data = await response.json();
      
      if (response.ok && data.agency) {
        setAgency(data.agency);
      } else {
        toast.error('Agency not found');
        router.push('/agencies');
      }
    } catch (error) {
      console.error('Failed to fetch agency:', error);
      toast.error('Failed to load agency');
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'PHP',
      maximumFractionDigits: 0,
    }).format(amount);
  };

  const getTimeAgo = (date: string) => {
    const now = new Date();
    const d = new Date(date);
    const diffDays = Math.floor((now.getTime() - d.getTime()) / (1000 * 60 * 60 * 24));
    if (diffDays === 0) return 'Today';
    if (diffDays === 1) return 'Yesterday';
    if (diffDays < 30) return `${diffDays}d ago`;
    return `${Math.floor(diffDays / 30)}mo ago`;
  };

  const openDocPreview = (url: string, name: string, type: string) => {
    setPreviewDoc({ url, name, type });
    setShowDocPreview(true);
  };

  const handleDocumentAction = async (action: 'approve' | 'reject') => {
    const setter = action === 'approve' ? setApprovingDocs : setRejectingDocs;
    setter(true);
    try {
      const token = await getSessionToken();
      const response = await fetch(`/api/agencies/${agencyId}/verify-documents`, {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ action }),
      });
      const data = await response.json();
      if (response.ok) {
        toast.success(action === 'approve' ? 'Agency documents approved & verified!' : 'Agency documents rejected');
        fetchAgency();
      } else {
        toast.error(data.error || `Failed to ${action} documents`);
      }
    } catch (error) {
      console.error(`Error ${action}ing documents:`, error);
      toast.error(`Failed to ${action} documents`);
    } finally {
      setter(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 text-cyan-400 animate-spin" />
      </div>
    );
  }

  if (!agency) return null;

  return (
    <div className="space-y-6">
      {/* Back Button */}
      <Link href="/agencies" className="inline-flex items-center text-gray-400 hover:text-white transition-colors">
        <ArrowLeft className="h-4 w-4 mr-2" />
        Back to Agencies
      </Link>

      {/* Agency Header */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
        <Card className="relative overflow-hidden bg-gradient-to-br from-cyan-500/10 via-white/5 to-purple-500/10 border-cyan-500/30">
          <div className="absolute inset-0 bg-gradient-to-br from-cyan-500/5 via-transparent to-purple-500/5" />
          <CardContent className="relative z-10 p-8">
            <div className="flex items-start gap-6">
              <Avatar className="h-24 w-24 rounded-xl">
                <AvatarImage src={agency.logoUrl} />
                <AvatarFallback className="bg-gradient-to-br from-cyan-500 to-blue-600 text-white text-2xl rounded-xl">
                  {agency.name.substring(0, 2).toUpperCase()}
                </AvatarFallback>
              </Avatar>
              
              <div className="flex-1">
                <div className="flex items-start justify-between">
                  <div>
                    <div className="flex items-center gap-3 mb-2">
                      <h1 className="text-3xl font-bold text-white">{agency.name}</h1>
                      {agency.isVerified && (
                        <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/30">
                          <Shield className="h-3 w-3 mr-1" />
                          Verified
                        </Badge>
                      )}
                      <Badge className={agency.isActive 
                        ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30' 
                        : 'bg-red-500/20 text-red-400 border-red-500/30'
                      }>
                        {agency.isActive ? 'Active' : 'Inactive'}
                      </Badge>
                    </div>
                    {agency.description && (
                      <p className="text-gray-400 max-w-2xl">{agency.description}</p>
                    )}
                  </div>
                  <Button
                    variant="outline"
                    onClick={() => setShowEditModal(true)}
                    className="border-white/10 text-gray-400 hover:text-white hover:bg-white/10"
                  >
                    <Edit className="h-4 w-4 mr-2" />
                    Edit Agency
                  </Button>
                </div>

                {/* Contact Info */}
                <div className="flex flex-wrap gap-6 mt-4">
                  {agency.email && (
                    <a href={`mailto:${agency.email}`} className="flex items-center gap-2 text-gray-400 hover:text-cyan-400 transition-colors">
                      <Mail className="h-4 w-4" />
                      {agency.email}
                    </a>
                  )}
                  {agency.phone && (
                    <span className="flex items-center gap-2 text-gray-400">
                      <Phone className="h-4 w-4" />
                      {agency.phone}
                    </span>
                  )}
                  {agency.website && (
                    <a href={agency.website} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 text-cyan-400 hover:text-cyan-300">
                      <Globe className="h-4 w-4" />
                      {agency.website.replace(/^https?:\/\//, '')}
                      <ExternalLink className="h-3 w-3" />
                    </a>
                  )}
                  {agency.city && (
                    <span className="flex items-center gap-2 text-gray-400">
                      <MapPin className="h-4 w-4" />
                      {agency.city}, {agency.country}
                    </span>
                  )}
                </div>

                {/* Stats */}
                <div className="flex gap-8 mt-6 pt-6 border-t border-white/10">
                  <div>
                    <p className="text-3xl font-bold text-white">{agency.totalPlacements}</p>
                    <p className="text-gray-400 text-sm flex items-center gap-1">
                      <Trophy className="h-4 w-4 text-yellow-400" />
                      Placements
                    </p>
                  </div>
                  <div>
                    <p className="text-3xl font-bold text-purple-400">{formatCurrency(agency.totalRevenue)}</p>
                    <p className="text-gray-400 text-sm flex items-center gap-1">
                      <DollarSign className="h-4 w-4 text-purple-400" />
                      Total Revenue
                    </p>
                  </div>
                  <div>
                    <p className="text-3xl font-bold text-cyan-400">{agency.activeJobs}</p>
                    <p className="text-gray-400 text-sm flex items-center gap-1">
                      <Briefcase className="h-4 w-4 text-cyan-400" />
                      Active Jobs
                    </p>
                  </div>
                  <div>
                    <p className="text-3xl font-bold text-emerald-400">{agency.clients?.length || 0}</p>
                    <p className="text-gray-400 text-sm flex items-center gap-1">
                      <Building2 className="h-4 w-4 text-emerald-400" />
                      Clients
                    </p>
                  </div>
                  <div>
                    <p className="text-3xl font-bold text-orange-400">{agency.recruiters?.length || 0}</p>
                    <p className="text-gray-400 text-sm flex items-center gap-1">
                      <Users className="h-4 w-4 text-orange-400" />
                      Recruiters
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* AI Document Verification — Full Width, Front & Center */}
      {agency.documentVerification && agency.documentVerification.overallStatus ? (
        !agency.isVerified ? (
          /* NOT verified — show full verification panel prominently */
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
            <Card className={`relative overflow-hidden border ${
              agency.documentVerification.overallStatus === 'VERIFIED'
                ? 'bg-emerald-500/5 border-emerald-500/30'
                : agency.documentVerification.overallStatus === 'NEEDS_REVIEW'
                ? 'bg-amber-500/5 border-amber-500/30'
                : 'bg-red-500/5 border-red-500/30'
            }`}>
              <div className={`absolute inset-0 ${
                agency.documentVerification.overallStatus === 'VERIFIED'
                  ? 'bg-gradient-to-r from-emerald-500/5 via-transparent to-emerald-500/5'
                  : agency.documentVerification.overallStatus === 'NEEDS_REVIEW'
                  ? 'bg-gradient-to-r from-amber-500/5 via-transparent to-amber-500/5'
                  : 'bg-gradient-to-r from-red-500/5 via-transparent to-red-500/5'
              }`} />
              <CardHeader className="relative z-10 border-b border-white/10">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-white flex items-center gap-2">
                    {agency.documentVerification.overallStatus === 'VERIFIED' ? (
                      <ShieldCheck className="h-5 w-5 text-emerald-400" />
                    ) : agency.documentVerification.overallStatus === 'NEEDS_REVIEW' ? (
                      <ShieldAlert className="h-5 w-5 text-amber-400" />
                    ) : (
                      <ShieldX className="h-5 w-5 text-red-400" />
                    )}
                    AI Document Verification
                  </CardTitle>
                  <div className="flex items-center gap-3">
                    {agency.documentsVerified && (
                      <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/30 text-xs">
                        <CheckCircle className="h-3 w-3 mr-1" />
                        Admin Approved
                      </Badge>
                    )}
                    {!agency.documentsVerified && (
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          onClick={() => handleDocumentAction('approve')}
                          disabled={approvingDocs || rejectingDocs}
                          className="bg-emerald-600 hover:bg-emerald-700 text-white"
                        >
                          {approvingDocs ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <ShieldCheck className="h-4 w-4 mr-1" />}
                          Approve & Verify
                        </Button>
                        <Button
                          size="sm"
                          onClick={() => handleDocumentAction('reject')}
                          disabled={approvingDocs || rejectingDocs}
                          variant="outline"
                          className="border-red-500/30 text-red-400 hover:bg-red-500/10"
                        >
                          {rejectingDocs ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <ShieldX className="h-4 w-4 mr-1" />}
                          Reject
                        </Button>
                      </div>
                    )}
                  </div>
                </div>
              </CardHeader>
              <CardContent className="relative z-10 p-6">
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                  {/* Column 1: Status + Extracted Profile */}
                  <div className="space-y-5">
                    {/* Verification Status */}
                    <div className={`p-4 rounded-lg border ${
                      agency.documentVerification.overallStatus === 'VERIFIED'
                        ? 'bg-emerald-500/10 border-emerald-500/30'
                        : agency.documentVerification.overallStatus === 'NEEDS_REVIEW'
                        ? 'bg-amber-500/10 border-amber-500/30'
                        : 'bg-red-500/10 border-red-500/30'
                    }`}>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          {agency.documentVerification.overallStatus === 'VERIFIED' ? (
                            <ShieldCheck className="h-8 w-8 text-emerald-400" />
                          ) : agency.documentVerification.overallStatus === 'NEEDS_REVIEW' ? (
                            <ShieldAlert className="h-8 w-8 text-amber-400" />
                          ) : (
                            <ShieldX className="h-8 w-8 text-red-400" />
                          )}
                          <div>
                            <Badge className={`text-sm px-3 py-1 ${
                              agency.documentVerification.overallStatus === 'VERIFIED'
                                ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30'
                                : agency.documentVerification.overallStatus === 'NEEDS_REVIEW'
                                ? 'bg-amber-500/20 text-amber-400 border-amber-500/30'
                                : 'bg-red-500/20 text-red-400 border-red-500/30'
                            }`}>
                              {agency.documentVerification.overallStatus.replace('_', ' ')}
                            </Badge>
                            {agency.documentVerification.verifiedAt && (
                              <p className="text-gray-500 text-xs mt-1">
                                AI analyzed {new Date(agency.documentVerification.verifiedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                              </p>
                            )}
                          </div>
                        </div>
                        <div className="text-right">
                          <p className={`text-2xl font-bold ${
                            agency.documentVerification.overallConfidence >= 80 ? 'text-emerald-400'
                            : agency.documentVerification.overallConfidence >= 50 ? 'text-amber-400'
                            : 'text-red-400'
                          }`}>
                            {agency.documentVerification.overallConfidence}%
                          </p>
                          <p className="text-gray-500 text-xs">Confidence</p>
                        </div>
                      </div>
                    </div>

                    {/* Extracted Company Profile */}
                    {agency.documentVerification.extractedProfile && (
                      <div>
                        <p className="text-gray-400 text-xs font-medium uppercase tracking-wider mb-3">Extracted Company Profile</p>
                        <div className="grid grid-cols-2 gap-3">
                          {agency.documentVerification.extractedProfile.companyName && (
                            <div className="col-span-2">
                              <p className="text-gray-500 text-xs">Company Name</p>
                              <p className="text-white text-sm font-medium">{agency.documentVerification.extractedProfile.companyName}</p>
                            </div>
                          )}
                          {agency.documentVerification.extractedProfile.tinNumber && (
                            <div>
                              <p className="text-gray-500 text-xs">TIN</p>
                              <p className="text-white text-sm font-mono">{agency.documentVerification.extractedProfile.tinNumber}</p>
                            </div>
                          )}
                          {agency.documentVerification.extractedProfile.businessType && (
                            <div>
                              <p className="text-gray-500 text-xs">Business Type</p>
                              <p className="text-white text-sm">{agency.documentVerification.extractedProfile.businessType}</p>
                            </div>
                          )}
                          {agency.documentVerification.extractedProfile.foundedYear && (
                            <div>
                              <p className="text-gray-500 text-xs">Founded</p>
                              <p className="text-white text-sm">{agency.documentVerification.extractedProfile.foundedYear}</p>
                            </div>
                          )}
                          {(agency.documentVerification.extractedProfile.city || agency.documentVerification.extractedProfile.province) && (
                            <div>
                              <p className="text-gray-500 text-xs">Location</p>
                              <p className="text-white text-sm">
                                {[agency.documentVerification.extractedProfile.city, agency.documentVerification.extractedProfile.province].filter(Boolean).join(', ')}
                              </p>
                            </div>
                          )}
                          {agency.documentVerification.extractedProfile.address && (
                            <div className="col-span-2">
                              <p className="text-gray-500 text-xs">Address</p>
                              <p className="text-white text-sm">{agency.documentVerification.extractedProfile.address}</p>
                            </div>
                          )}
                          {agency.documentVerification.extractedProfile.registrationNumbers && (
                            <div className="col-span-2">
                              <p className="text-gray-500 text-xs mb-1">Registration Numbers</p>
                              <div className="flex flex-wrap gap-2">
                                {Object.entries(agency.documentVerification.extractedProfile.registrationNumbers).map(([key, val]: [string, any]) => (
                                  val && (
                                    <Badge key={key} variant="outline" className="bg-white/5 text-gray-300 border-white/10 text-xs font-mono">
                                      {key.toUpperCase()}: {val}
                                    </Badge>
                                  )
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    )}

                    {/* Cross-Check Results */}
                    {(() => {
                      const cc = agency.documentVerification.crossCheck || agency.documentVerification.crossCheckResults;
                      if (!cc) return null;
                      return (
                        <div>
                          <p className="text-gray-400 text-xs font-medium uppercase tracking-wider mb-3">Cross-Check Results</p>
                          <div className="space-y-2">
                            <div className="flex items-center gap-2">
                              {cc.companyNameConsistent ? (
                                <CheckCircle className="h-4 w-4 text-emerald-400" />
                              ) : (
                                <XCircle className="h-4 w-4 text-red-400" />
                              )}
                              <span className="text-gray-300 text-sm">Company name consistent</span>
                            </div>
                            <div className="flex items-center gap-2">
                              {cc.isBpoCompany ? (
                                <CheckCircle className="h-4 w-4 text-emerald-400" />
                              ) : (
                                <XCircle className="h-4 w-4 text-red-400" />
                              )}
                              <span className="text-gray-300 text-sm">Confirmed BPO company</span>
                            </div>
                            {cc.tinConsistent !== undefined && (
                              <div className="flex items-center gap-2">
                                {cc.tinConsistent ? (
                                  <CheckCircle className="h-4 w-4 text-emerald-400" />
                                ) : (
                                  <XCircle className="h-4 w-4 text-red-400" />
                                )}
                                <span className="text-gray-300 text-sm">TIN consistent</span>
                              </div>
                            )}
                            {cc.addressConsistent !== undefined && (
                              <div className="flex items-center gap-2">
                                {cc.addressConsistent ? (
                                  <CheckCircle className="h-4 w-4 text-emerald-400" />
                                ) : (
                                  <XCircle className="h-4 w-4 text-red-400" />
                                )}
                                <span className="text-gray-300 text-sm">Address consistent</span>
                              </div>
                            )}
                            {cc.issues && cc.issues.length > 0 && (
                              <div className="mt-2 p-3 rounded-lg bg-amber-500/10 border border-amber-500/30">
                                <p className="text-amber-400 text-xs font-medium mb-1">Issues Found:</p>
                                {cc.issues.map((issue: string, i: number) => (
                                  <p key={i} className="text-amber-300/80 text-xs flex items-start gap-1 mt-1">
                                    <AlertTriangle className="h-3 w-3 flex-shrink-0 mt-0.5" />
                                    {issue}
                                  </p>
                                ))}
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })()}
                  </div>

                  {/* Column 2-3: Analyzed Documents */}
                  <div className="col-span-2">
                    <p className="text-gray-400 text-xs font-medium uppercase tracking-wider mb-3">Analyzed Documents</p>
                    <div className="grid grid-cols-2 gap-3">
                      {(() => {
                        const docs = agency.documentVerification.documents;
                        const docList: any[] = Array.isArray(docs)
                          ? docs
                          : Object.entries(docs || {}).map(([key, doc]: [string, any]) => ({ ...doc, _key: key }));
                        return docList.map((doc: any, idx: number) => (
                          <div key={idx} className="p-3 rounded-lg bg-white/5 border border-white/10">
                            <div className="flex items-start justify-between mb-2">
                              <div className="flex items-center gap-2">
                                <FileText className="h-4 w-4 text-gray-400 flex-shrink-0" />
                                <div>
                                  <p className="text-white text-sm font-medium">{doc.documentType || doc._key?.toUpperCase()}</p>
                                  {doc.originalFileName && (
                                    <p className="text-gray-500 text-xs">{doc.originalFileName}</p>
                                  )}
                                </div>
                              </div>
                              <Badge className={`text-xs ${
                                doc.confidence === 'HIGH'
                                  ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30'
                                  : doc.confidence === 'MEDIUM'
                                  ? 'bg-amber-500/20 text-amber-400 border-amber-500/30'
                                  : 'bg-red-500/20 text-red-400 border-red-500/30'
                              }`}>
                                {doc.confidence}
                              </Badge>
                            </div>
                            <div className="grid grid-cols-2 gap-2 text-xs">
                              {doc.registrationNumber && (
                                <div>
                                  <span className="text-gray-500">Reg #: </span>
                                  <span className="text-gray-300 font-mono">{doc.registrationNumber}</span>
                                </div>
                              )}
                              {doc.tinNumber && (
                                <div>
                                  <span className="text-gray-500">TIN: </span>
                                  <span className="text-gray-300 font-mono">{doc.tinNumber}</span>
                                </div>
                              )}
                              {doc.dateIssued && (
                                <div>
                                  <span className="text-gray-500">Issued: </span>
                                  <span className="text-gray-300">{doc.dateIssued}</span>
                                </div>
                              )}
                              {doc.expiryDate && (
                                <div>
                                  <span className="text-gray-500">Expires: </span>
                                  <span className={doc.isExpired ? 'text-red-400' : 'text-gray-300'}>
                                    {doc.expiryDate}{doc.isExpired && ' (EXPIRED)'}
                                  </span>
                                </div>
                              )}
                              {doc.companyName && (
                                <div className="col-span-2">
                                  <span className="text-gray-500">Company: </span>
                                  <span className="text-gray-300">{doc.companyName}</span>
                                </div>
                              )}
                              {doc.businessType && (
                                <div className="col-span-2">
                                  <span className="text-gray-500">Business: </span>
                                  <span className="text-gray-300">{doc.businessType}</span>
                                  {doc.isBpoRelated && (
                                    <Badge className="ml-2 text-[10px] bg-cyan-500/20 text-cyan-400 border-cyan-500/30">BPO</Badge>
                                  )}
                                </div>
                              )}
                            </div>
                            {doc.issues && doc.issues.length > 0 && (
                              <div className="mt-2 space-y-1">
                                {doc.issues.map((issue: string, i: number) => (
                                  <p key={i} className="text-xs text-amber-400 flex items-start gap-1">
                                    <AlertTriangle className="h-3 w-3 flex-shrink-0 mt-0.5" />
                                    {issue}
                                  </p>
                                ))}
                              </div>
                            )}
                            <div className="mt-2">
                              <button
                                onClick={() => {
                                  const url = doc.fileUrl || (
                                    doc._key === 'sec' ? agency.secRegistrationUrl :
                                    doc._key === 'dti' ? agency.dtiCertificateUrl :
                                    doc._key === 'business_permit' ? agency.businessPermitUrl :
                                    null
                                  );
                                  if (url) openDocPreview(url, doc.originalFileName || doc.documentType || doc._key, doc.documentType || doc._key);
                                }}
                                className="text-xs text-cyan-400 hover:text-cyan-300 flex items-center gap-1"
                              >
                                <Eye className="h-3 w-3" />
                                View Document
                              </button>
                            </div>
                          </div>
                        ));
                      })()}
                    </div>
                  </div>
                </div>

                {/* Already Verified Info */}
                {agency.documentsVerified && agency.documentsVerifiedAt && (
                  <div className="mt-5 pt-4 border-t border-white/10">
                    <div className="p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/30">
                      <p className="text-emerald-400 text-sm flex items-center gap-2">
                        <CheckCircle className="h-4 w-4" />
                        Documents verified
                        {agency.verifiedByAdmin && (
                          <span className="text-emerald-300/60 text-xs">
                            by {agency.verifiedByAdmin.firstName} {agency.verifiedByAdmin.lastName}
                          </span>
                        )}
                      </p>
                      <p className="text-gray-500 text-xs mt-1">
                        {new Date(agency.documentsVerifiedAt).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
                      </p>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </motion.div>
        ) : (
          /* Verified — show collapsed green summary */
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
            <Card className="bg-emerald-500/5 border-emerald-500/20">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <ShieldCheck className="h-6 w-6 text-emerald-400" />
                    <div className="flex items-center gap-3">
                      <span className="text-emerald-400 font-semibold">✅ Verified Agency</span>
                      <span className="text-gray-500">—</span>
                      <span className="text-white font-medium">{agency.name}</span>
                      {(agency.documentVerification.extractedProfile?.tinNumber || agency.tinNumber) && (
                        <>
                          <span className="text-gray-600">•</span>
                          <span className="text-gray-400 font-mono text-sm">TIN: {agency.documentVerification.extractedProfile?.tinNumber || agency.tinNumber}</span>
                        </>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-3 text-sm">
                    <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/30">
                      {agency.documentVerification.overallConfidence}% Confidence
                    </Badge>
                    {agency.documentsVerifiedAt && (
                      <span className="text-gray-500 text-xs">
                        Verified {new Date(agency.documentsVerifiedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                        {agency.verifiedByAdmin && ` by ${agency.verifiedByAdmin.firstName}`}
                      </span>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        )
      ) : null}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Clients */}
        <div className="lg:col-span-2 space-y-6">
          <Card className="bg-white/5 border-white/10">
            <CardHeader className="border-b border-white/10 flex flex-row items-center justify-between">
              <CardTitle className="text-white flex items-center gap-2">
                <Building2 className="h-5 w-5 text-cyan-400" />
                Clients ({agency.clients?.length || 0})
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {agency.clients && agency.clients.length > 0 ? (
                <div className="divide-y divide-white/10">
                  {agency.clients.map((client, i) => (
                    <motion.div
                      key={client.id}
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: i * 0.05 }}
                      className="p-4 flex items-center justify-between hover:bg-white/5 transition-all"
                    >
                      <div className="flex items-center gap-4">
                        <Avatar className="h-12 w-12 rounded-lg">
                          <AvatarImage src={client.companyLogo} />
                          <AvatarFallback className="bg-gradient-to-br from-purple-500 to-pink-600 text-white rounded-lg">
                            {client.companyName.substring(0, 2).toUpperCase()}
                          </AvatarFallback>
                        </Avatar>
                        <div>
                          <p className="text-white font-medium">{client.companyName}</p>
                          <p className="text-gray-500 text-sm">{client.industry || 'No industry set'}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-6">
                        <div className="text-right">
                          <p className="text-white font-medium">{client.jobCount}</p>
                          <p className="text-gray-500 text-xs">Jobs</p>
                        </div>
                        <Badge variant="outline" className={
                          client.status === 'active' 
                            ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30' 
                            : 'bg-gray-500/20 text-gray-400 border-gray-500/30'
                        }>
                          {client.status}
                        </Badge>
                        <span className="text-gray-500 text-xs">
                          Added {getTimeAgo(client.createdAt)}
                        </span>
                      </div>
                    </motion.div>
                  ))}
                </div>
              ) : (
                <div className="p-8 text-center">
                  <Building2 className="h-12 w-12 mx-auto mb-3 text-gray-600" />
                  <p className="text-gray-500">No clients yet</p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Recent Jobs */}
          <Card className="bg-white/5 border-white/10">
            <CardHeader className="border-b border-white/10">
              <CardTitle className="text-white flex items-center gap-2">
                <Briefcase className="h-5 w-5 text-purple-400" />
                Recent Jobs
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {agency.recentJobs && agency.recentJobs.length > 0 ? (
                <div className="divide-y divide-white/10">
                  {agency.recentJobs.map((job, i) => (
                    <motion.div
                      key={job.id}
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: i * 0.05 }}
                      className="p-4 flex items-center justify-between hover:bg-white/5 transition-all"
                    >
                      <div>
                        <p className="text-white font-medium">{job.title}</p>
                        <p className="text-gray-500 text-sm">
                          {job.applicantsCount} applicants • Posted {getTimeAgo(job.createdAt)}
                        </p>
                      </div>
                      <Badge variant="outline" className={
                        job.status === 'active' ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30' :
                        job.status === 'paused' ? 'bg-orange-500/20 text-orange-400 border-orange-500/30' :
                        'bg-gray-500/20 text-gray-400 border-gray-500/30'
                      }>
                        {job.status}
                      </Badge>
                    </motion.div>
                  ))}
                </div>
              ) : (
                <div className="p-8 text-center">
                  <Briefcase className="h-12 w-12 mx-auto mb-3 text-gray-600" />
                  <p className="text-gray-500">No jobs posted yet</p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Recruiters Sidebar */}
        <div className="space-y-6">
          <Card className="bg-white/5 border-white/10">
            <CardHeader className="border-b border-white/10 flex flex-row items-center justify-between">
              <CardTitle className="text-white flex items-center gap-2">
                <Users className="h-5 w-5 text-orange-400" />
                Team Members
              </CardTitle>
              <Button 
                size="sm" 
                variant="outline" 
                onClick={() => setShowReassignModal(true)}
                className="border-white/10 text-gray-400 hover:text-white hover:bg-white/10"
              >
                <Plus className="h-3 w-3 mr-1" />
                Add
              </Button>
            </CardHeader>
            <CardContent className="p-0">
              {agency.recruiters && agency.recruiters.length > 0 ? (
                <div className="divide-y divide-white/10">
                  {agency.recruiters.map((recruiter, i) => (
                    <motion.div
                      key={recruiter.id}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: i * 0.05 }}
                      className="p-4 hover:bg-white/5 transition-all group"
                    >
                      <div className="flex items-center gap-3">
                        <Avatar className="h-10 w-10">
                          <AvatarImage src={recruiter.avatarUrl} />
                          <AvatarFallback className="bg-gradient-to-br from-orange-500 to-amber-600 text-white">
                            {(recruiter.firstName || 'R')[0]}{(recruiter.lastName || '')[0]}
                          </AvatarFallback>
                        </Avatar>
                        <div className="flex-1">
                          <p className="text-white font-medium text-sm">
                            {recruiter.firstName} {recruiter.lastName}
                          </p>
                          <p className="text-gray-500 text-xs">{recruiter.email}</p>
                        </div>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => handleRemoveRecruiter(recruiter.id, `${recruiter.firstName} ${recruiter.lastName}`)}
                          className="opacity-0 group-hover:opacity-100 text-red-400 hover:bg-red-500/10 h-8 w-8 p-0"
                        >
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </div>
                      <div className="flex items-center justify-between mt-2">
                        <Badge variant="outline" className="bg-white/5 text-gray-400 border-white/10 text-xs capitalize">
                          {recruiter.role}
                        </Badge>
                        <span className="text-gray-600 text-xs">
                          Joined {getTimeAgo(recruiter.createdAt)}
                        </span>
                      </div>
                    </motion.div>
                  ))}
                </div>
              ) : (
                <div className="p-6 text-center">
                  <Users className="h-10 w-10 mx-auto mb-2 text-gray-600" />
                  <p className="text-gray-500 text-sm">No recruiters</p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Agency Info */}
          <Card className="bg-white/5 border-white/10">
            <CardHeader className="border-b border-white/10">
              <CardTitle className="text-white text-sm">Agency Details</CardTitle>
            </CardHeader>
            <CardContent className="p-4 space-y-3">
              <div>
                <p className="text-gray-500 text-xs">Agency ID</p>
                <p className="text-white font-mono text-sm break-all">{agency.id}</p>
              </div>
              <div>
                <p className="text-gray-500 text-xs">Slug</p>
                <p className="text-gray-300 text-sm">{agency.slug}</p>
              </div>
              <div>
                <p className="text-gray-500 text-xs">Created</p>
                <p className="text-gray-300 text-sm">
                  {new Date(agency.createdAt).toLocaleDateString('en-US', {
                    month: 'long', day: 'numeric', year: 'numeric'
                  })}
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Agency Documents — shown when no AI verification data */}
          {(!agency.documentVerification || !agency.documentVerification.overallStatus) && (
            <Card className="bg-white/5 border-white/10">
              <CardHeader className="border-b border-white/10">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-white text-sm flex items-center gap-2">
                    <FileText className="h-4 w-4 text-purple-400" />
                    Agency Documents
                  </CardTitle>
                  {agency.documentsVerified && (
                    <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/30 text-xs">
                      <CheckCircle className="h-3 w-3 mr-1" />
                      Verified
                    </Badge>
                  )}
                </div>
              </CardHeader>
              <CardContent className="p-4 space-y-4">
                <div>
                  <p className="text-gray-500 text-xs mb-1">TIN Number</p>
                  {agency.tinNumber ? (
                    <p className="text-white font-mono text-sm">{agency.tinNumber}</p>
                  ) : (
                    <p className="text-gray-600 text-sm">Not provided</p>
                  )}
                </div>
                <div>
                  <p className="text-gray-500 text-xs mb-1">DTI Certificate</p>
                  {agency.dtiCertificateUrl ? (
                    <button
                      onClick={() => openDocPreview(agency.dtiCertificateUrl!, 'DTI Certificate', 'DTI Certificate')}
                      className="flex items-center gap-2 text-cyan-400 hover:text-cyan-300 text-sm"
                    >
                      <FileText className="w-4 h-4" />
                      View Document
                    </button>
                  ) : (
                    <p className="text-gray-600 text-sm">Not uploaded</p>
                  )}
                </div>
                <div>
                  <p className="text-gray-500 text-xs mb-1">Business Permit</p>
                  {agency.businessPermitUrl ? (
                    <button
                      onClick={() => openDocPreview(agency.businessPermitUrl!, 'Business Permit', 'Business Permit')}
                      className="flex items-center gap-2 text-cyan-400 hover:text-cyan-300 text-sm"
                    >
                      <FileText className="w-4 h-4" />
                      View Document
                    </button>
                  ) : (
                    <p className="text-gray-600 text-sm">Not uploaded</p>
                  )}
                </div>
                <div>
                  <p className="text-gray-500 text-xs mb-1">SEC Registration</p>
                  {agency.secRegistrationUrl ? (
                    <button
                      onClick={() => openDocPreview(agency.secRegistrationUrl!, 'SEC Registration', 'SEC Registration Certificate')}
                      className="flex items-center gap-2 text-cyan-400 hover:text-cyan-300 text-sm"
                    >
                      <FileText className="w-4 h-4" />
                      View Document
                    </button>
                  ) : (
                    <p className="text-gray-600 text-sm">Not uploaded</p>
                  )}
                </div>
                {agency.documentsUploadedAt && (
                  <div className="pt-3 border-t border-white/10">
                    <p className="text-gray-500 text-xs mb-1">Documents Uploaded</p>
                    <p className="text-gray-300 text-sm">
                      {new Date(agency.documentsUploadedAt).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
                    </p>
                  </div>
                )}
                {!agency.documentsVerified && agency.tinNumber && (
                  <div className="p-3 rounded-lg bg-orange-500/10 border border-orange-500/30">
                    <p className="text-orange-400 text-xs flex items-center gap-2">
                      <Clock className="h-3 w-3" />
                      Awaiting admin verification
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* Webhooks */}
          <AgencyWebhooksView agencyId={agencyId} />
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

      {/* Edit Agency Modal */}
      {agency && (
        <EditAgencyModal
          agency={agency}
          isOpen={showEditModal}
          onClose={() => setShowEditModal(false)}
          onSuccess={() => {
            fetchAgency(); // Refresh agency data
          }}
        />
      )}

      {/* Reassign Recruiter Modal */}
      {showReassignModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50">
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-[#121217] border border-white/10 rounded-2xl p-6 max-w-md w-full mx-4 shadow-2xl"
          >
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-cyan-500/20 flex items-center justify-center">
                  <UserPlus className="h-5 w-5 text-cyan-400" />
                </div>
                <div>
                  <h3 className="text-white font-semibold">Add Recruiter to Agency</h3>
                  <p className="text-gray-500 text-sm">Reassign from another agency</p>
                </div>
              </div>
              <Button 
                variant="ghost" 
                size="sm" 
                onClick={() => setShowReassignModal(false)}
                className="text-gray-400 hover:text-white"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="text-gray-400 text-sm mb-2 block">Select Recruiter</label>
                <Select value={selectedRecruiterId} onValueChange={setSelectedRecruiterId}>
                  <SelectTrigger className="bg-white/5 border-white/10 text-white">
                    <SelectValue placeholder="Choose a recruiter..." />
                  </SelectTrigger>
                  <SelectContent className="bg-[#1a1a1f] border-white/10">
                    {availableRecruiters.length === 0 ? (
                      <div className="p-4 text-center text-gray-500">
                        No recruiters available
                      </div>
                    ) : (
                      availableRecruiters.map((r) => (
                        <SelectItem 
                          key={r.id} 
                          value={r.id}
                          className="text-white hover:bg-white/10"
                        >
                          <div className="flex items-center gap-2">
                            <span>{r.firstName} {r.lastName}</span>
                            <span className="text-gray-500 text-xs">({r.agencyName})</span>
                          </div>
                        </SelectItem>
                      ))
                    )}
                  </SelectContent>
                </Select>
              </div>

              {selectedRecruiterId && (
                <div className="p-3 rounded-lg bg-orange-500/10 border border-orange-500/30">
                  <p className="text-orange-400 text-sm">
                    ⚠️ This recruiter will be moved from their current agency to <strong>{agency?.name}</strong>.
                  </p>
                </div>
              )}

              <div className="flex gap-3 pt-4">
                <Button 
                  variant="outline" 
                  onClick={() => setShowReassignModal(false)}
                  className="flex-1 border-white/10 text-gray-400"
                >
                  Cancel
                </Button>
                <Button 
                  onClick={handleReassignRecruiter}
                  disabled={!selectedRecruiterId || reassigning}
                  className="flex-1 bg-gradient-to-r from-cyan-500 to-blue-600"
                >
                  {reassigning ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                  Reassign
                </Button>
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </div>
  );
}


'use client';

export const dynamic = 'force-dynamic';

import React, { useState, useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import { 
  Building2, Globe, Mail, Phone, MapPin, Camera, Save, Loader2, 
  CheckCircle, CreditCard, Users, Briefcase, Shield, ExternalLink,
  Calendar, Hash, Linkedin, Facebook, Twitter, Copy, Check,
  FileText, AlertTriangle, Upload, Eye, Clock, ShieldCheck
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/shared/ui/card';
import { Button } from '@/components/shared/ui/button';
import { Input } from '@/components/shared/ui/input';
import { Badge } from '@/components/shared/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/shared/ui/avatar';
import { useAuth } from '@/contexts/AuthContext';
import { getSessionToken } from '@/lib/auth-helpers';
import { supabase } from '@/lib/supabase';
import { toast } from '@/components/shared/ui/toast';
import { useRouter } from 'next/navigation';

interface DocumentVerificationDoc {
  documentType: string;
  file_url: string;
  originalFileName: string;
  confidence: string;
  expiryDate: string | null;
  isExpired: boolean;
  extractedInfo?: {
    company_name?: string;
    registrationNumber?: string;
    [key: string]: any;
  };
}

interface DocumentVerification {
  status: string;
  documents: DocumentVerificationDoc[];
  overallConfidence?: string;
  verifiedAt?: string;
  [key: string]: any;
}

interface Agency {
  id: string;
  name: string;
  slug: string;
  email: string;
  phone: string;
  website: string;
  logo_url: string;
  logo_symbol_url: string | null;
  logo_stacked_url: string | null;
  logo_landscape_url: string | null;
  description: string;
  address: string;
  city: string;
  country: string;
  is_active: boolean;
  isVerified: boolean;
  created_at: string;
  tinNumber: string | null;
  secRegistrationUrl: string | null;
  dtiCertificateUrl: string | null;
  businessPermitUrl: string | null;
  documentsVerified: boolean;
  documentsUploadedAt: string | null;
  documentExpiryDate: string | null;
  businessPermitExpiry: string | null;
  secRegistrationNumber: string | null;
  documentVerification: DocumentVerification | null;
}

interface AgencyProfile {
  id: string;
  foundedYear: number | null;
  employeeCount: string;
  addressLine1: string;
  addressLine2: string;
  city: string;
  state: string;
  country: string;
  postalCode: string;
  linkedInUrl: string;
  facebookUrl: string;
  twitterUrl: string;
}

interface Stats {
  teamCount: number;
  clientCount: number;
}

interface Permissions {
  role: string;
  canManageAgency: boolean;
  canManageClients: boolean;
}

type LogoType = 'symbol' | 'stacked' | 'landscape';

export default function AgencyPage() {
  const { user } = useAuth();
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const logoSymbolInputRef = useRef<HTMLInputElement>(null);
  const logoStackedInputRef = useRef<HTMLInputElement>(null);
  const logoLandscapeInputRef = useRef<HTMLInputElement>(null);
  
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [copied, setCopied] = useState(false);
  
  const [agency, setAgency] = useState<Agency | null>(null);
  const [agencyProfile, setAgencyProfile] = useState<AgencyProfile | null>(null);
  const [stats, setStats] = useState<Stats>({ teamCount: 0, clientCount: 0 });
  const [permissions, setPermissions] = useState<Permissions | null>(null);
  
  // Form state
  const [formData, setFormData] = useState({
    // Agency fields
    name: '',
    email: '',
    phone: '',
    website: '',
    logo_url: '',
    logo_symbol_url: '',
    logo_stacked_url: '',
    logo_landscape_url: '',
    description: '',
    // Profile fields
    foundedYear: '',
    employeeCount: '',
    addressLine1: '',
    addressLine2: '',
    city: '',
    state: '',
    country: '',
    postalCode: '',
    linkedInUrl: '',
    facebookUrl: '',
    twitterUrl: '',
  });
  const [uploadingLogo, setUploadingLogo] = useState<LogoType | null>(null);

  useEffect(() => {
    if (user?.id) fetchAgency();
  }, [user?.id]);

  const fetchAgency = async () => {
    try {
      const token = await getSessionToken();
      const response = await fetch('/api/recruiter/agency', {
        headers: {
          'Authorization': `Bearer ${token}`,
          'x-user-id': user?.id || '',
        }
      });
      
      const data = await response.json();
      
      if (response.ok && data.agency) {
        setAgency(data.agency);
        setAgencyProfile(data.profile);
        setStats(data.stats);
        setPermissions(data.permissions);
        setFormData({
          name: data.agency.name || '',
          email: data.agency.email || '',
          phone: data.agency.phone || '',
          website: data.agency.website || '',
          logo_url: data.agency.logo_url || '',
          logo_symbol_url: data.agency.logo_symbol_url || data.agency.logo_url || '',
          logo_stacked_url: data.agency.logo_stacked_url || '',
          logo_landscape_url: data.agency.logo_landscape_url || '',
          description: data.agency.description || '',
          foundedYear: data.profile?.foundedYear?.toString() || '',
          employeeCount: data.profile?.employeeCount || '',
          addressLine1: data.profile?.addressLine1 || '',
          addressLine2: data.profile?.addressLine2 || '',
          city: data.profile?.city || data.agency.city || '',
          state: data.profile?.state || '',
          country: data.profile?.country || data.agency.country || '',
          postalCode: data.profile?.postalCode || '',
          linkedInUrl: data.profile?.linkedInUrl || '',
          facebookUrl: data.profile?.facebookUrl || '',
          twitterUrl: data.profile?.twitterUrl || '',
        });
      }
    } catch (error) {
      console.error('Failed to fetch agency:', error);
      toast.error('Failed to load agency');
    } finally {
      setLoading(false);
    }
  };

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>, logoType: LogoType = 'symbol') => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      toast.error('Please select an image file');
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      toast.error('Image must be less than 5MB');
      return;
    }

    setUploadingLogo(logoType);
    setUploading(true);
    
    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `agency-${agency?.id}-${logoType}-${Date.now()}.${fileExt}`;
      const filePath = `logos/${fileName}`;

      const { error } = await supabase.storage
        .from('recruiter')
        .upload(filePath, file, {
          cacheControl: '3600',
          upsert: true
        });

      if (error) throw error;

      const { data: { publicUrl } } = supabase.storage
        .from('recruiter')
        .getPublicUrl(filePath);

      // Update the appropriate logo field
      const fieldKey = logoType === 'symbol' ? 'logo_symbol_url' : 
                       logoType === 'stacked' ? 'logo_stacked_url' : 'logo_landscape_url';
      
      setFormData(prev => ({ 
        ...prev, 
        [fieldKey]: publicUrl,
        // Also update main logo_url if it's the symbol (for backwards compatibility)
        ...(logoType === 'symbol' ? { logo_url: publicUrl } : {})
      }));
      
      const logoNames = { symbol: 'Symbol', stacked: 'Stacked', landscape: 'Landscape' };
      toast.success(`${logoNames[logoType]} logo uploaded successfully`);
      
    } catch (error) {
      console.error('Upload error:', error);
      toast.error('Failed to upload logo');
    } finally {
      setUploading(false);
      setUploadingLogo(null);
    }
  };

  const handleCopyId = () => {
    if (agency?.id) {
      navigator.clipboard.writeText(agency.id);
      setCopied(true);
      toast.success('Agency ID copied!');
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleSave = async () => {
    if (!permissions?.canManageAgency) {
      toast.error('You don\'t have permission to update agency settings');
      return;
    }

    setSaving(true);
    
    try {
      const token = await getSessionToken();
      const response = await fetch('/api/recruiter/agency', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
          'x-user-id': user?.id || '',
        },
        body: JSON.stringify({
          ...formData,
          foundedYear: formData.foundedYear ? parseInt(formData.foundedYear) : null,
        }),
      });

      if (response.ok) {
        toast.success('Agency updated successfully');
        fetchAgency();
      } else {
        const error = await response.json();
        toast.error(error.message || 'Failed to save');
      }
    } catch (error) {
      console.error('Save error:', error);
      toast.error('Failed to save');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 text-orange-400 animate-spin" />
      </div>
    );
  }

  const isComplete = formData.name && formData.email && formData.website;

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-white">Agency Settings</h1>
          <p className="text-gray-400 mt-1">Manage your agency profile and settings</p>
        </div>
        {agency?.isVerified ? (
          <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/30">
            <CheckCircle className="h-4 w-4 mr-1" />Verified
          </Badge>
        ) : (
          <Badge className="bg-orange-500/20 text-orange-400 border-orange-500/30">
            Pending Verification
          </Badge>
        )}
      </div>

      {/* Agency ID Card */}
      <Card className="bg-gradient-to-r from-purple-500/10 to-indigo-500/10 border-purple-500/30">
        <CardContent className="p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-purple-500/20">
                <Hash className="h-5 w-5 text-purple-400" />
              </div>
              <div>
                <p className="text-sm text-gray-400">Agency ID</p>
                <p className="text-white font-mono text-sm">{agency?.id}</p>
              </div>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleCopyId}
              className="text-purple-400 hover:text-purple-300 hover:bg-purple-500/10"
            >
              {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="bg-white/5 border-white/10">
          <CardContent className="p-6 flex items-center gap-4">
            <div className="p-3 rounded-xl bg-orange-500/20">
              <Users className="h-6 w-6 text-orange-400" />
            </div>
            <div>
              <p className="text-2xl font-bold text-white">{stats.teamCount}</p>
              <p className="text-gray-400 text-sm">Team Members</p>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-white/5 border-white/10">
          <CardContent className="p-6 flex items-center gap-4">
            <div className="p-3 rounded-xl bg-cyan-500/20">
              <Building2 className="h-6 w-6 text-cyan-400" />
            </div>
            <div>
              <p className="text-2xl font-bold text-white">{stats.clientCount}</p>
              <p className="text-gray-400 text-sm">Clients</p>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-white/5 border-white/10">
          <CardContent className="p-6 flex items-center gap-4">
            <div className="p-3 rounded-xl bg-purple-500/20">
              <Shield className="h-6 w-6 text-purple-400" />
            </div>
            <div>
              <p className="text-lg font-bold text-white capitalize">{permissions?.role || 'recruiter'}</p>
              <p className="text-gray-400 text-sm">Your Role</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Verification Banner */}
      {!agency?.isVerified && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <Card className="bg-gradient-to-r from-orange-500/10 to-amber-500/10 border-orange-500/30">
            <CardContent className="p-6">
              <div className="flex items-start gap-4">
                <div className="p-3 rounded-xl bg-orange-500/20">
                  <CheckCircle className="h-6 w-6 text-orange-400" />
                </div>
                <div className="flex-1">
                  <h3 className="text-white font-semibold mb-1">Complete Your Agency Profile</h3>
                  <p className="text-gray-400 text-sm mb-3">
                    Fill in all required fields to get verified and unlock premium features.
                  </p>
                  <div className="flex flex-wrap gap-2">
                    <Badge variant="outline" className={formData.name ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30' : 'bg-white/5 text-gray-400 border-white/10'}>
                      {formData.name ? <CheckCircle className="h-3 w-3 mr-1" /> : null}
                      Agency Name
                    </Badge>
                    <Badge variant="outline" className={formData.email ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30' : 'bg-white/5 text-gray-400 border-white/10'}>
                      {formData.email ? <CheckCircle className="h-3 w-3 mr-1" /> : null}
                      Email
                    </Badge>
                    <Badge variant="outline" className={formData.website ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30' : 'bg-white/5 text-gray-400 border-white/10'}>
                      {formData.website ? <CheckCircle className="h-3 w-3 mr-1" /> : null}
                      Website
                    </Badge>
                    <Badge variant="outline" className={formData.logo_url ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30' : 'bg-white/5 text-gray-400 border-white/10'}>
                      {formData.logo_url ? <CheckCircle className="h-3 w-3 mr-1" /> : null}
                      Logo
                    </Badge>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      )}

      {/* Basic Info */}
      <Card className="bg-white/5 border-white/10">
        <CardHeader>
          <CardTitle className="text-white flex items-center gap-2">
            <Building2 className="h-5 w-5 text-orange-400" />
            Basic Information
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Logo Section - Agency Info */}
          <div className="flex items-center gap-6 pb-6 border-b border-white/10">
            <div className="relative">
              <Avatar className="h-24 w-24 rounded-xl">
                <AvatarImage src={formData.logo_symbol_url || formData.logo_url} alt={formData.name} className="object-cover" />
                <AvatarFallback className="bg-gradient-to-br from-orange-500 to-amber-600 text-white text-2xl rounded-xl">
                  {formData.name?.substring(0, 2).toUpperCase() || 'AG'}
                </AvatarFallback>
              </Avatar>
            </div>
            <div>
              <h3 className="text-xl font-semibold text-white">{formData.name || 'Your Agency'}</h3>
              <p className="text-gray-400">bpoc.io/agency/{agency?.slug || 'your-agency'}</p>
              {formData.website && (
                <a 
                  href={formData.website} 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="text-orange-400 text-sm flex items-center gap-1 mt-1 hover:underline"
                >
                  <ExternalLink className="h-3 w-3" />
                  {formData.website.replace(/^https?:\/\//, '')}
                </a>
              )}
            </div>
          </div>

          {/* Logo Upload Section - 3 Types */}
          <div className="pb-6 border-b border-white/10">
            <h4 className="text-sm font-medium text-white mb-3 flex items-center gap-2">
              <Camera className="h-4 w-4 text-orange-400" />
              Brand Logos
            </h4>
            <p className="text-xs text-gray-500 mb-4">Upload your logo in different formats for use across documents and platform</p>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* Symbol Logo (Square) */}
              <div className="relative group">
                <div className="aspect-square rounded-xl border-2 border-dashed border-white/20 bg-white/5 flex flex-col items-center justify-center overflow-hidden hover:border-orange-500/50 transition-colors">
                  {formData.logo_symbol_url ? (
                    <img src={formData.logo_symbol_url} alt="Symbol" className="w-full h-full object-contain p-4" />
                  ) : (
                    <div className="text-center p-4">
                      <div className="w-12 h-12 rounded-lg bg-white/10 mx-auto mb-2 flex items-center justify-center">
                        <span className="text-xl font-bold text-gray-400">S</span>
                      </div>
                      <p className="text-xs text-gray-500">Square icon</p>
                    </div>
                  )}
                  <button 
                    onClick={() => logoSymbolInputRef.current?.click()}
                    disabled={uploading || !permissions?.canManageAgency}
                    className="absolute inset-0 flex items-center justify-center bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity disabled:cursor-not-allowed"
                  >
                    {uploadingLogo === 'symbol' ? (
                      <Loader2 className="h-6 w-6 text-white animate-spin" />
                    ) : (
                      <Upload className="h-6 w-6 text-white" />
                    )}
                  </button>
                </div>
                <p className="text-xs text-gray-400 text-center mt-2 font-medium">Symbol</p>
                <p className="text-[10px] text-gray-500 text-center">1:1 ratio, for icons</p>
                <input
                  ref={logoSymbolInputRef}
                  type="file"
                  accept="image/*"
                  onChange={(e) => handleLogoUpload(e, 'symbol')}
                  className="hidden"
                />
              </div>

              {/* Stacked Logo (Vertical) */}
              <div className="relative group">
                <div className="aspect-square rounded-xl border-2 border-dashed border-white/20 bg-white/5 flex flex-col items-center justify-center overflow-hidden hover:border-orange-500/50 transition-colors">
                  {formData.logo_stacked_url ? (
                    <img src={formData.logo_stacked_url} alt="Stacked" className="w-full h-full object-contain p-4" />
                  ) : (
                    <div className="text-center p-4">
                      <div className="w-10 h-8 rounded bg-white/10 mx-auto mb-1 flex items-center justify-center">
                        <span className="text-sm font-bold text-gray-400">S</span>
                      </div>
                      <div className="w-16 h-2 rounded bg-white/10 mx-auto mb-2"></div>
                      <p className="text-xs text-gray-500">Stacked layout</p>
                    </div>
                  )}
                  <button 
                    onClick={() => logoStackedInputRef.current?.click()}
                    disabled={uploading || !permissions?.canManageAgency}
                    className="absolute inset-0 flex items-center justify-center bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity disabled:cursor-not-allowed"
                  >
                    {uploadingLogo === 'stacked' ? (
                      <Loader2 className="h-6 w-6 text-white animate-spin" />
                    ) : (
                      <Upload className="h-6 w-6 text-white" />
                    )}
                  </button>
                </div>
                <p className="text-xs text-gray-400 text-center mt-2 font-medium">Stacked</p>
                <p className="text-[10px] text-gray-500 text-center">Vertical with text</p>
                <input
                  ref={logoStackedInputRef}
                  type="file"
                  accept="image/*"
                  onChange={(e) => handleLogoUpload(e, 'stacked')}
                  className="hidden"
                />
              </div>

              {/* Landscape Logo (Horizontal) */}
              <div className="relative group">
                <div className="aspect-square rounded-xl border-2 border-dashed border-white/20 bg-white/5 flex flex-col items-center justify-center overflow-hidden hover:border-orange-500/50 transition-colors">
                  {formData.logo_landscape_url ? (
                    <img src={formData.logo_landscape_url} alt="Landscape" className="w-full h-full object-contain p-4" />
                  ) : (
                    <div className="text-center p-4">
                      <div className="flex items-center justify-center gap-1 mb-2">
                        <div className="w-6 h-6 rounded bg-white/10 flex items-center justify-center">
                          <span className="text-xs font-bold text-gray-400">S</span>
                        </div>
                        <div className="w-12 h-3 rounded bg-white/10"></div>
                      </div>
                      <p className="text-xs text-gray-500">Horizontal layout</p>
                    </div>
                  )}
                  <button 
                    onClick={() => logoLandscapeInputRef.current?.click()}
                    disabled={uploading || !permissions?.canManageAgency}
                    className="absolute inset-0 flex items-center justify-center bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity disabled:cursor-not-allowed"
                  >
                    {uploadingLogo === 'landscape' ? (
                      <Loader2 className="h-6 w-6 text-white animate-spin" />
                    ) : (
                      <Upload className="h-6 w-6 text-white" />
                    )}
                  </button>
                </div>
                <p className="text-xs text-gray-400 text-center mt-2 font-medium">Landscape</p>
                <p className="text-[10px] text-gray-500 text-center">Horizontal with text</p>
                <input
                  ref={logoLandscapeInputRef}
                  type="file"
                  accept="image/*"
                  onChange={(e) => handleLogoUpload(e, 'landscape')}
                  className="hidden"
                />
              </div>
            </div>
          </div>

          {/* Form Fields */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-gray-400 text-sm mb-2">Agency Name *</label>
              <div className="relative">
                <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                <Input 
                  value={formData.name} 
                  onChange={(e) => setFormData(f => ({ ...f, name: e.target.value }))} 
                  disabled={!permissions?.canManageAgency}
                  placeholder="Your Agency Name"
                  className="pl-10 bg-white/5 border-white/10 text-white disabled:opacity-50" 
                />
              </div>
            </div>
            <div>
              <label className="block text-gray-400 text-sm mb-2">Website *</label>
              <div className="relative">
                <Globe className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                <Input 
                  value={formData.website} 
                  onChange={(e) => setFormData(f => ({ ...f, website: e.target.value }))} 
                  disabled={!permissions?.canManageAgency}
                  placeholder="https://youragency.com"
                  className="pl-10 bg-white/5 border-white/10 text-white disabled:opacity-50" 
                />
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-gray-400 text-sm mb-2">Contact Email *</label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                <Input 
                  value={formData.email} 
                  onChange={(e) => setFormData(f => ({ ...f, email: e.target.value }))} 
                  disabled={!permissions?.canManageAgency}
                  placeholder="contact@youragency.com"
                  className="pl-10 bg-white/5 border-white/10 text-white disabled:opacity-50" 
                />
              </div>
            </div>
            <div>
              <label className="block text-gray-400 text-sm mb-2">Phone</label>
              <div className="relative">
                <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                <Input 
                  value={formData.phone} 
                  onChange={(e) => setFormData(f => ({ ...f, phone: e.target.value }))} 
                  disabled={!permissions?.canManageAgency}
                  placeholder="+63 XXX XXX XXXX"
                  className="pl-10 bg-white/5 border-white/10 text-white disabled:opacity-50" 
                />
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-gray-400 text-sm mb-2">Founded Year</label>
              <div className="relative">
                <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                <Input 
                  type="number"
                  value={formData.foundedYear} 
                  onChange={(e) => setFormData(f => ({ ...f, foundedYear: e.target.value }))} 
                  disabled={!permissions?.canManageAgency}
                  placeholder="2020"
                  className="pl-10 bg-white/5 border-white/10 text-white disabled:opacity-50" 
                />
              </div>
            </div>
            <div>
              <label className="block text-gray-400 text-sm mb-2">Company Size</label>
              <select
                value={formData.employeeCount}
                onChange={(e) => setFormData(f => ({ ...f, employeeCount: e.target.value }))}
                disabled={!permissions?.canManageAgency}
                className="w-full h-10 px-3 bg-white/5 border border-white/10 rounded-md text-white disabled:opacity-50"
              >
                <option value="">Select size</option>
                <option value="1-10">1-10 employees</option>
                <option value="11-50">11-50 employees</option>
                <option value="51-200">51-200 employees</option>
                <option value="201-500">201-500 employees</option>
                <option value="500+">500+ employees</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-gray-400 text-sm mb-2">About / Description</label>
            <textarea 
              value={formData.description} 
              onChange={(e) => setFormData(f => ({ ...f, description: e.target.value }))} 
              disabled={!permissions?.canManageAgency}
              placeholder="Tell candidates about your agency, your specializations, and what makes you unique..."
              rows={4}
              className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-md text-white placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-orange-500/50 resize-none disabled:opacity-50" 
            />
          </div>
        </CardContent>
      </Card>

      {/* Address */}
      <Card className="bg-white/5 border-white/10">
        <CardHeader>
          <CardTitle className="text-white flex items-center gap-2">
            <MapPin className="h-5 w-5 text-orange-400" />
            Address
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <label className="block text-gray-400 text-sm mb-2">Address Line 1</label>
            <Input 
              value={formData.addressLine1} 
              onChange={(e) => setFormData(f => ({ ...f, addressLine1: e.target.value }))} 
              disabled={!permissions?.canManageAgency}
              placeholder="Street address, P.O. box"
              className="bg-white/5 border-white/10 text-white disabled:opacity-50" 
            />
          </div>
          <div>
            <label className="block text-gray-400 text-sm mb-2">Address Line 2</label>
            <Input 
              value={formData.addressLine2} 
              onChange={(e) => setFormData(f => ({ ...f, addressLine2: e.target.value }))} 
              disabled={!permissions?.canManageAgency}
              placeholder="Apartment, suite, unit, building, floor"
              className="bg-white/5 border-white/10 text-white disabled:opacity-50" 
            />
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div>
              <label className="block text-gray-400 text-sm mb-2">City</label>
              <Input 
                value={formData.city} 
                onChange={(e) => setFormData(f => ({ ...f, city: e.target.value }))} 
                disabled={!permissions?.canManageAgency}
                placeholder="City"
                className="bg-white/5 border-white/10 text-white disabled:opacity-50" 
              />
            </div>
            <div>
              <label className="block text-gray-400 text-sm mb-2">State/Province</label>
              <Input 
                value={formData.state} 
                onChange={(e) => setFormData(f => ({ ...f, state: e.target.value }))} 
                disabled={!permissions?.canManageAgency}
                placeholder="State"
                className="bg-white/5 border-white/10 text-white disabled:opacity-50" 
              />
            </div>
            <div>
              <label className="block text-gray-400 text-sm mb-2">Postal Code</label>
              <Input 
                value={formData.postalCode} 
                onChange={(e) => setFormData(f => ({ ...f, postalCode: e.target.value }))} 
                disabled={!permissions?.canManageAgency}
                placeholder="Postal code"
                className="bg-white/5 border-white/10 text-white disabled:opacity-50" 
              />
            </div>
            <div>
              <label className="block text-gray-400 text-sm mb-2">Country</label>
              <Input 
                value={formData.country} 
                onChange={(e) => setFormData(f => ({ ...f, country: e.target.value }))} 
                disabled={!permissions?.canManageAgency}
                placeholder="Country"
                className="bg-white/5 border-white/10 text-white disabled:opacity-50" 
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Social Links */}
      <Card className="bg-white/5 border-white/10">
        <CardHeader>
          <CardTitle className="text-white flex items-center gap-2">
            <Globe className="h-5 w-5 text-orange-400" />
            Social Media
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <label className="block text-gray-400 text-sm mb-2">LinkedIn</label>
            <div className="relative">
              <Linkedin className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
              <Input 
                value={formData.linkedInUrl} 
                onChange={(e) => setFormData(f => ({ ...f, linkedInUrl: e.target.value }))} 
                disabled={!permissions?.canManageAgency}
                placeholder="https://linkedin.com/company/youragency"
                className="pl-10 bg-white/5 border-white/10 text-white disabled:opacity-50" 
              />
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-gray-400 text-sm mb-2">Facebook</label>
              <div className="relative">
                <Facebook className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                <Input 
                  value={formData.facebookUrl} 
                  onChange={(e) => setFormData(f => ({ ...f, facebookUrl: e.target.value }))} 
                  disabled={!permissions?.canManageAgency}
                  placeholder="https://facebook.com/youragency"
                  className="pl-10 bg-white/5 border-white/10 text-white disabled:opacity-50" 
                />
              </div>
            </div>
            <div>
              <label className="block text-gray-400 text-sm mb-2">Twitter/X</label>
              <div className="relative">
                <Twitter className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                <Input 
                  value={formData.twitterUrl} 
                  onChange={(e) => setFormData(f => ({ ...f, twitterUrl: e.target.value }))} 
                  disabled={!permissions?.canManageAgency}
                  placeholder="https://twitter.com/youragency"
                  className="pl-10 bg-white/5 border-white/10 text-white disabled:opacity-50" 
                />
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Company Documents */}
      <Card className="bg-white/5 border-white/10">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-white flex items-center gap-2">
              <FileText className="h-5 w-5 text-orange-400" />
              Company Documents
            </CardTitle>
            {agency?.documentsVerified ? (
              <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/30">
                <ShieldCheck className="h-3.5 w-3.5 mr-1" />
                Verified
              </Badge>
            ) : agency?.documentVerification?.documents?.length ? (
              <Badge className="bg-amber-500/20 text-amber-400 border-amber-500/30">
                <Clock className="h-3.5 w-3.5 mr-1" />
                Pending Review
              </Badge>
            ) : (
              <Badge className="bg-white/10 text-gray-400 border-white/10">
                No Documents
              </Badge>
            )}
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Registration Numbers */}
          {(agency?.tinNumber || agency?.secRegistrationNumber) && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pb-4 border-b border-white/10">
              {agency?.tinNumber && (
                <div className="flex items-center gap-3 p-3 rounded-lg bg-white/5">
                  <Hash className="h-4 w-4 text-gray-400 flex-shrink-0" />
                  <div>
                    <p className="text-xs text-gray-500">TIN Number</p>
                    <p className="text-sm text-white font-mono">{agency.tinNumber}</p>
                  </div>
                </div>
              )}
              {agency?.secRegistrationNumber && (
                <div className="flex items-center gap-3 p-3 rounded-lg bg-white/5">
                  <Hash className="h-4 w-4 text-gray-400 flex-shrink-0" />
                  <div>
                    <p className="text-xs text-gray-500">SEC Registration</p>
                    <p className="text-sm text-white font-mono">{agency.secRegistrationNumber}</p>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Document List */}
          {agency?.documentVerification?.documents?.length ? (
            <div className="space-y-3">
              {agency.documentVerification.documents.map((doc: DocumentVerificationDoc, idx: number) => {
                const now = new Date();
                const expiry = doc.expiryDate ? new Date(doc.expiryDate) : null;
                const daysUntilExpiry = expiry ? Math.ceil((expiry.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)) : null;
                const isExpired = doc.isExpired || (daysUntilExpiry !== null && daysUntilExpiry < 0);
                const isExpiringSoon = !isExpired && daysUntilExpiry !== null && daysUntilExpiry <= 30;

                return (
                  <div key={idx} className="flex items-center gap-4 p-4 rounded-lg bg-white/5 border border-white/10 hover:border-white/20 transition-colors">
                    {/* Doc Icon */}
                    <div className={`p-2.5 rounded-lg flex-shrink-0 ${
                      isExpired ? 'bg-red-500/20' : isExpiringSoon ? 'bg-amber-500/20' : 'bg-emerald-500/20'
                    }`}>
                      <FileText className={`h-5 w-5 ${
                        isExpired ? 'text-red-400' : isExpiringSoon ? 'text-amber-400' : 'text-emerald-400'
                      }`} />
                    </div>

                    {/* Doc Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <p className="text-sm font-medium text-white truncate">
                          {doc.documentType?.replace(/_/g, ' ').replace(/\b\w/g, (l: string) => l.toUpperCase()) || 'Document'}
                        </p>
                        {/* Confidence Badge */}
                        <Badge className={`text-[10px] px-1.5 py-0 ${
                          doc.confidence === 'HIGH' ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30' :
                          doc.confidence === 'MEDIUM' ? 'bg-amber-500/20 text-amber-400 border-amber-500/30' :
                          'bg-red-500/20 text-red-400 border-red-500/30'
                        }`}>
                          {doc.confidence || 'N/A'}
                        </Badge>
                      </div>
                      <div className="flex items-center gap-3 text-xs text-gray-500">
                        {doc.originalFileName && (
                          <span className="truncate max-w-[200px]">{doc.originalFileName}</span>
                        )}
                        {doc.extractedInfo?.company_name && (
                          <span className="text-gray-400">• {doc.extractedInfo.company_name}</span>
                        )}
                        {doc.extractedInfo?.registrationNumber && (
                          <span className="font-mono text-gray-400">• {doc.extractedInfo.registrationNumber}</span>
                        )}
                      </div>
                    </div>

                    {/* Expiry */}
                    <div className="flex-shrink-0 text-right">
                      {expiry ? (
                        <div>
                          <p className={`text-xs font-medium ${
                            isExpired ? 'text-red-400' : isExpiringSoon ? 'text-amber-400' : 'text-emerald-400'
                          }`}>
                            {isExpired ? 'Expired' : isExpiringSoon ? `Expires in ${daysUntilExpiry}d` : 'Valid'}
                          </p>
                          <p className="text-[10px] text-gray-500">
                            {expiry.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                          </p>
                        </div>
                      ) : (
                        <p className="text-xs text-gray-500">No expiry</p>
                      )}
                    </div>

                    {/* View Link */}
                    {doc.file_url && (
                      <a
                        href={doc.file_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex-shrink-0 p-2 rounded-lg bg-white/5 hover:bg-white/10 text-gray-400 hover:text-white transition-colors"
                        title="View Document"
                      >
                        <Eye className="h-4 w-4" />
                      </a>
                    )}
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="text-center py-8">
              <FileText className="h-10 w-10 text-gray-600 mx-auto mb-3" />
              <p className="text-gray-400 text-sm mb-1">No documents uploaded yet</p>
              <p className="text-gray-500 text-xs">Upload your SEC registration, DTI certificate, and business permit</p>
            </div>
          )}

          {/* Upload Date + Update Button */}
          <div className="flex items-center justify-between pt-4 border-t border-white/10">
            <div className="text-xs text-gray-500">
              {agency?.documentsUploadedAt && (
                <span>
                  Last uploaded: {new Date(agency.documentsUploadedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                </span>
              )}
            </div>
            {permissions?.canManageAgency && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => router.push('/agency/documents')}
                className="border-orange-500/30 text-orange-400 hover:bg-orange-500/10 hover:text-orange-300"
              >
                <Upload className="h-3.5 w-3.5 mr-2" />
                {agency?.documentVerification?.documents?.length ? 'Update Documents' : 'Upload Documents'}
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Save Button */}
      {permissions?.canManageAgency && (
        <motion.div whileHover={{ scale: 1.01 }} whileTap={{ scale: 0.99 }}>
          <Button 
            onClick={handleSave} 
            disabled={saving}
            className="w-full bg-gradient-to-r from-orange-500 to-amber-600 hover:from-orange-600 hover:to-amber-700 text-white font-medium py-6"
          >
            {saving ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Saving...
              </>
            ) : (
              <>
                <Save className="h-4 w-4 mr-2" />
                Save All Changes
              </>
            )}
          </Button>
        </motion.div>
      )}

      {/* Billing Card */}
      <Card className="bg-white/5 border-white/10">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-white flex items-center gap-2">
              <CreditCard className="h-5 w-5 text-orange-400" />
              Billing & Subscription
            </CardTitle>
            <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/30">
              Free Plan
            </Badge>
          </div>
        </CardHeader>
        <CardContent>
          <p className="text-gray-400 mb-4">
            You're currently on the free tier. Upgrade to unlock premium features like 
            advanced analytics, unlimited job posts, and priority support.
          </p>
          <Button variant="outline" className="border-white/10 text-gray-300 hover:bg-white/5">
            <CreditCard className="h-4 w-4 mr-2" />
            Upgrade Plan
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}

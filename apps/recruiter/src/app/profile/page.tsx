'use client';

export const dynamic = 'force-dynamic';

import React, { useState, useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import { 
  User, Mail, Phone, Camera, Save, Loader2, Briefcase, 
  Link as LinkIcon, FileText, CheckCircle, Building2, Shield
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/shared/ui/card';
import { Button } from '@/components/shared/ui/button';
import { Input } from '@/components/shared/ui/input';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/shared/ui/avatar';
import { Badge } from '@/components/shared/ui/badge';
import { useAuth } from '@/contexts/AuthContext';
import { getSessionToken } from '@/lib/auth-helpers';
import { supabase } from '@/lib/supabase';
import { toast } from '@/components/shared/ui/toast';

interface RecruiterProfile {
  id: string;
  userId: string;
  agency_id: string;
  email: string;
  first_name: string;
  last_name: string;
  fullName: string;
  phone: string;
  avatar_url: string;
  role: string;
  position: string;
  linkedIn: string;
  bio: string;
  is_active: boolean;
  canPostJobs: boolean;
  canManageApplications: boolean;
  canInviteRecruiters: boolean;
  canManageClients: boolean;
  joinedAt: string;
  agency: {
    id: string;
    name: string;
    slug: string;
    logo_url: string;
    website: string;
  } | null;
}

export default function RecruiterProfilePage() {
  const { user } = useAuth();
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [profile, setProfile] = useState<RecruiterProfile | null>(null);
  
  // Form state
  const [formData, setFormData] = useState({
    first_name: '',
    last_name: '',
    phone: '',
    position: '',
    linkedIn: '',
    bio: '',
    avatar_url: '',
  });

  useEffect(() => {
    if (user?.id) fetchProfile();
  }, [user?.id]);

  const fetchProfile = async () => {
    try {
      const token = await getSessionToken();
      const response = await fetch('/api/recruiter/profile', {
        headers: {
          'Authorization': `Bearer ${token}`,
          'x-user-id': user?.id || '',
        }
      });
      
      const data = await response.json();
      
      if (response.ok && data.profile) {
        setProfile(data.profile);
        setFormData({
          first_name: data.profile.first_name || '',
          last_name: data.profile.last_name || '',
          phone: data.profile.phone || '',
          position: data.profile.position || '',
          linkedIn: data.profile.linkedIn || '',
          bio: data.profile.bio || '',
          avatar_url: data.profile.avatar_url || '',
        });
      }
    } catch (error) {
      console.error('Failed to fetch profile:', error);
      toast.error('Failed to load profile');
    } finally {
      setLoading(false);
    }
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith('image/')) {
      toast.error('Please select an image file');
      return;
    }

    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      toast.error('Image must be less than 5MB');
      return;
    }

    setUploading(true);
    
    try {
      // Generate unique filename
      const fileExt = file.name.split('.').pop();
      const fileName = `${user?.id}-${Date.now()}.${fileExt}`;
      const filePath = `avatars/${fileName}`;

      // Upload to Supabase storage "recruiter" bucket
      const { data, error } = await supabase.storage
        .from('recruiter')
        .upload(filePath, file, {
          cacheControl: '3600',
          upsert: true
        });

      if (error) {
        throw error;
      }

      // Get public URL
      const { data: { publicUrl } } = supabase.storage
        .from('recruiter')
        .getPublicUrl(filePath);

      // Update form state
      setFormData(prev => ({ ...prev, avatar_url: publicUrl }));
      toast.success('Image uploaded successfully');
      
    } catch (error) {
      console.error('Upload error:', error);
      toast.error('Failed to upload image');
    } finally {
      setUploading(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    
    try {
      const token = await getSessionToken();
      const response = await fetch('/api/recruiter/profile', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
          'x-user-id': user?.id || '',
        },
        body: JSON.stringify(formData),
      });

      if (response.ok) {
        toast.success('Profile updated successfully');
        fetchProfile(); // Refresh data
      } else {
        const error = await response.json();
        toast.error(error.message || 'Failed to save profile');
      }
    } catch (error) {
      console.error('Save error:', error);
      toast.error('Failed to save profile');
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

  const initials = `${formData.first_name?.[0] || ''}${formData.last_name?.[0] || ''}`.toUpperCase() || 'R';

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-white">Profile</h1>
        <p className="text-gray-400 mt-1">Manage your recruiter profile and settings</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Profile Picture Card */}
        <Card className="bg-white/5 border-white/10 lg:col-span-1">
          <CardContent className="p-6 text-center">
            <div className="relative inline-block mb-4">
              <Avatar className="h-32 w-32 mx-auto">
                <AvatarImage src={formData.avatar_url} alt={formData.first_name} />
                <AvatarFallback className="bg-gradient-to-br from-orange-500 to-amber-600 text-white text-3xl">
                  {initials}
                </AvatarFallback>
              </Avatar>
              <button 
                onClick={() => fileInputRef.current?.click()}
                disabled={uploading}
                className="absolute bottom-0 right-0 p-2 rounded-full bg-orange-500 text-white hover:bg-orange-600 transition-colors disabled:opacity-50"
              >
                {uploading ? (
                  <Loader2 className="h-5 w-5 animate-spin" />
                ) : (
                  <Camera className="h-5 w-5" />
                )}
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleImageUpload}
                className="hidden"
              />
            </div>
            
            <h2 className="text-xl font-semibold text-white">
              {formData.first_name} {formData.last_name}
            </h2>
            <p className="text-gray-400">{formData.position || 'Recruiter'}</p>
            
            {profile?.agency && (
              <div className="mt-4 flex items-center justify-center gap-2 text-sm text-gray-400">
                <Building2 className="h-4 w-4" />
                <span>{profile.agency.name}</span>
              </div>
            )}

            {/* Role Badge */}
            <div className="mt-4">
              <Badge 
                variant="outline" 
                className={`
                  ${profile?.role === 'admin' ? 'border-orange-500/50 text-orange-400' : 
                    profile?.role === 'manager' ? 'border-purple-500/50 text-purple-400' : 
                    'border-cyan-500/50 text-cyan-400'}
                `}
              >
                <Shield className="h-3 w-3 mr-1" />
                {profile?.role || 'recruiter'}
              </Badge>
            </div>

            {/* Permissions */}
            <div className="mt-6 text-left space-y-2">
              <h4 className="text-sm font-medium text-gray-300">Permissions</h4>
              <div className="space-y-1 text-sm">
                {profile?.canPostJobs && (
                  <div className="flex items-center gap-2 text-emerald-400">
                    <CheckCircle className="h-3 w-3" />
                    <span>Can post jobs</span>
                  </div>
                )}
                {profile?.canManageApplications && (
                  <div className="flex items-center gap-2 text-emerald-400">
                    <CheckCircle className="h-3 w-3" />
                    <span>Can manage applications</span>
                  </div>
                )}
                {profile?.canInviteRecruiters && (
                  <div className="flex items-center gap-2 text-emerald-400">
                    <CheckCircle className="h-3 w-3" />
                    <span>Can invite recruiters</span>
                  </div>
                )}
                {profile?.canManageClients && (
                  <div className="flex items-center gap-2 text-emerald-400">
                    <CheckCircle className="h-3 w-3" />
                    <span>Can manage clients</span>
                  </div>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Profile Details Card */}
        <Card className="bg-white/5 border-white/10 lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-white flex items-center gap-2">
              <User className="h-5 w-5 text-orange-400" />
              Personal Information
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Name Fields */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-gray-400 text-sm mb-2">First Name</label>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                  <Input 
                    value={formData.first_name} 
                    onChange={(e) => setFormData(p => ({ ...p, first_name: e.target.value }))} 
                    placeholder="First name"
                    className="pl-10 bg-white/5 border-white/10 text-white placeholder:text-gray-500" 
                  />
                </div>
              </div>
              <div>
                <label className="block text-gray-400 text-sm mb-2">Last Name</label>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                  <Input 
                    value={formData.last_name} 
                    onChange={(e) => setFormData(p => ({ ...p, last_name: e.target.value }))} 
                    placeholder="Last name"
                    className="pl-10 bg-white/5 border-white/10 text-white placeholder:text-gray-500" 
                  />
                </div>
              </div>
            </div>

            {/* Email (Read-only) */}
            <div>
              <label className="block text-gray-400 text-sm mb-2">Email</label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                <Input 
                  value={profile?.email || ''} 
                  disabled
                  className="pl-10 bg-white/5 border-white/10 text-gray-400 cursor-not-allowed" 
                />
              </div>
              <p className="text-xs text-gray-500 mt-1">Email cannot be changed</p>
            </div>

            {/* Phone */}
            <div>
              <label className="block text-gray-400 text-sm mb-2">Phone Number</label>
              <div className="relative">
                <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                <Input 
                  value={formData.phone} 
                  onChange={(e) => setFormData(p => ({ ...p, phone: e.target.value }))} 
                  placeholder="+63 XXX XXX XXXX"
                  className="pl-10 bg-white/5 border-white/10 text-white placeholder:text-gray-500" 
                />
              </div>
            </div>

            {/* Position/Title */}
            <div>
              <label className="block text-gray-400 text-sm mb-2">Job Title / Position</label>
              <div className="relative">
                <Briefcase className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                <Input 
                  value={formData.position} 
                  onChange={(e) => setFormData(p => ({ ...p, position: e.target.value }))} 
                  placeholder="e.g. Senior Recruiter, Talent Acquisition Manager"
                  className="pl-10 bg-white/5 border-white/10 text-white placeholder:text-gray-500" 
                />
              </div>
            </div>

            {/* LinkedIn */}
            <div>
              <label className="block text-gray-400 text-sm mb-2">LinkedIn Profile</label>
              <div className="relative">
                <LinkIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                <Input 
                  value={formData.linkedIn} 
                  onChange={(e) => setFormData(p => ({ ...p, linkedIn: e.target.value }))} 
                  placeholder="https://linkedin.com/in/yourprofile"
                  className="pl-10 bg-white/5 border-white/10 text-white placeholder:text-gray-500" 
                />
              </div>
            </div>

            {/* Bio */}
            <div>
              <label className="block text-gray-400 text-sm mb-2">Bio / About</label>
              <div className="relative">
                <FileText className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                <textarea 
                  value={formData.bio} 
                  onChange={(e) => setFormData(p => ({ ...p, bio: e.target.value }))} 
                  placeholder="Tell candidates about yourself and your recruitment experience..."
                  rows={4}
                  className="w-full pl-10 pr-4 py-3 bg-white/5 border border-white/10 rounded-md text-white placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-orange-500/50 resize-none" 
                />
              </div>
            </div>

            {/* Save Button */}
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
                    Save Changes
                  </>
                )}
              </Button>
            </motion.div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

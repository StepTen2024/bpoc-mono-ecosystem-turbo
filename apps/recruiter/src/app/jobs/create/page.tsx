'use client';

import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  Briefcase,
  Sparkles,
  ArrowLeft,
  Loader2,
  DollarSign,
  Building2,
  CheckCircle
} from 'lucide-react';
import { Card, CardContent } from '@/components/shared/ui/card';
import { Button } from '@/components/shared/ui/button';
import { Input } from '@/components/shared/ui/input';
import Link from 'next/link';
import { useAuth } from '@/contexts/AuthContext';
import { getSessionToken } from '@/lib/auth-helpers';
import { toast } from '@/components/shared/ui/toast';

interface Client {
  id: string;
  company: {
    id: string;
    name: string;
    industry: string;
  } | null;
}

export default function CreateJobPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user } = useAuth();

  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [success, setSuccess] = useState(false);
  const [verificationStatus, setVerificationStatus] = useState<string | null>(null);
  const [checkingVerification, setCheckingVerification] = useState(true);

  // Clients
  const [clients, setClients] = useState<Client[]>([]);
  const [loadingClients, setLoadingClients] = useState(true);
  
  const [formData, setFormData] = useState({
    job_type: 'agency' as 'agency' | 'client',
    client_id: searchParams.get('clientId') || '',
    title: '',
    briefDescription: '',
    description: '',
    requirements: [] as string[],
    responsibilities: [] as string[],
    benefits: [] as string[],
    skills: [] as string[],
    salary_min: '',
    salary_max: '',
    currency: 'PHP',
    workType: 'full_time',
    workArrangement: 'remote',
    shift: 'day',
    experienceLevel: 'mid',
  });

  // Check verification status on mount
  useEffect(() => {
    if (user?.id) {
      checkVerification();
      fetchClients();
    }
  }, [user?.id]);

  const checkVerification = async () => {
    try {
      const response = await fetch('/api/recruiter/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: user?.id }),
      });
      const data = await response.json();
      if (response.ok && data.recruiter) {
        setVerificationStatus(data.recruiter.verificationStatus || 'verified');
      } else {
        setVerificationStatus('pending');
      }
    } catch (error) {
      console.error('Failed to check verification:', error);
      setVerificationStatus('pending');
    } finally {
      setCheckingVerification(false);
    }
  };

  const fetchClients = async () => {
    try {
      const token = await getSessionToken();
      const response = await fetch('/api/recruiter/clients', {
        headers: {
          'Authorization': `Bearer ${token}`,
          'x-user-id': user?.id || '',
        }
      });
      const data = await response.json();
      if (response.ok) {
        setClients(data.clients || []);
      }
    } catch (error) {
      console.error('Failed to fetch clients:', error);
    } finally {
      setLoadingClients(false);
    }
  };

  const handleGenerateWithAI = async () => {
    if (!formData.title || !formData.briefDescription) {
      toast.error('Please enter job title and description');
      return;
    }
    if (formData.job_type === 'client' && !formData.client_id) {
      toast.error('Please select a client');
      return;
    }
    
    setGenerating(true);
    try {
      const token = await getSessionToken();
      const response = await fetch('/api/recruiter/jobs/generate', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
          'x-user-id': user?.id || '',
        },
        body: JSON.stringify({
          title: formData.title,
          briefDescription: formData.briefDescription,
        }),
      });

      const data = await response.json();

      if (response.ok && data.generated) {
        setFormData(prev => ({
          ...prev,
          description: data.generated.description || prev.description,
          requirements: data.generated.requirements || prev.requirements,
          responsibilities: data.generated.responsibilities || prev.responsibilities,
          benefits: data.generated.benefits || prev.benefits,
          skills: data.generated.skills || prev.skills,
        }));
        setStep(2);
        toast.success('Job details generated!');
      } else {
        toast.error(data.error || 'Failed to generate');
      }
    } catch (error) {
      console.error('Failed to generate:', error);
      toast.error('Failed to generate job details');
    } finally {
      setGenerating(false);
    }
  };

  const handleSubmit = async () => {
    if (formData.job_type === 'client' && !formData.client_id) {
      toast.error('Please select a client');
      return;
    }
    
    setLoading(true);
    try {
      const token = await getSessionToken();
      const response = await fetch('/api/recruiter/jobs/create', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
          'x-user-id': user?.id || '',
        },
        body: JSON.stringify({
          ...formData,
          job_type: formData.job_type,
          agency_client_id: formData.job_type === 'client' ? formData.client_id : null,
          salary_min: formData.salary_min ? parseInt(formData.salary_min) : null,
          salary_max: formData.salary_max ? parseInt(formData.salary_max) : null,
        }),
      });

      const data = await response.json();
      
      if (response.ok) {
        setSuccess(true);
        toast.success('Job posted successfully!');
        setTimeout(() => {
          router.push('/jobs');
        }, 2000);
      } else {
        toast.error(data.error || 'Failed to create job');
      }
    } catch (error) {
      console.error('Failed to create job:', error);
      toast.error('Failed to create job');
    } finally {
      setLoading(false);
    }
  };

  const selectedClient = clients.find(c => c.id === formData.client_id);

  // Show loading while checking verification
  if (checkingVerification) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="h-8 w-8 text-orange-400 animate-spin" />
      </div>
    );
  }

  // Block access if not verified
  if (verificationStatus !== 'verified') {
    return (
      <div className="max-w-2xl mx-auto">
        <Card className="bg-orange-500/10 border-orange-500/30">
          <CardContent className="p-12 text-center">
            <div className="w-20 h-20 mx-auto mb-6 rounded-full bg-orange-500/20 flex items-center justify-center">
              <Briefcase className="h-10 w-10 text-orange-400" />
            </div>
            <h2 className="text-2xl font-bold text-white mb-3">Verification Required</h2>
            <p className="text-gray-300 mb-6">
              You need to complete your recruiter verification before you can post jobs.
              {verificationStatus === 'pending_documents' && ' Please upload your agency documents to continue.'}
              {verificationStatus === 'pending_admin_review' && ' Your documents are currently under review.'}
              {verificationStatus === 'pending_authorization_head' && ' Waiting for your authorization head to complete signup.'}
            </p>
            <div className="flex gap-3 justify-center">
              <Link href="/recruiter">
                <Button variant="outline" className="border-white/10 text-gray-300">
                  <ArrowLeft className="h-4 w-4 mr-2" />
                  Back to Dashboard
                </Button>
              </Link>
              {verificationStatus === 'pending_documents' && (
                <Link href="/signup/documents">
                  <Button className="bg-gradient-to-r from-orange-500 to-amber-600">
                    Upload Documents
                  </Button>
                </Link>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (success) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <motion.div
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className="text-center"
        >
          <div className="w-20 h-20 mx-auto mb-6 rounded-full bg-emerald-500/20 flex items-center justify-center">
            <CheckCircle className="h-10 w-10 text-emerald-400" />
          </div>
          <h2 className="text-2xl font-bold text-white mb-2">Job Posted Successfully!</h2>
          <p className="text-gray-400">Redirecting to your jobs...</p>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <Link href="/jobs" className="inline-flex items-center text-gray-400 hover:text-white mb-4">
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Jobs
        </Link>
        <h1 className="text-3xl font-bold text-white">Post a New Job</h1>
        <p className="text-gray-400 mt-1">Use AI to help you create the perfect job listing</p>
      </div>

      {/* Progress Steps */}
      <div className="flex items-center gap-4 mb-8">
        {[1, 2, 3].map((s) => (
          <div key={s} className="flex items-center">
            <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
              step >= s 
                ? 'bg-gradient-to-r from-orange-500 to-amber-600 text-white' 
                : 'bg-white/10 text-gray-400'
            }`}>
              {s}
            </div>
            {s < 3 && (
              <div className={`w-20 h-1 mx-2 rounded ${
                step > s ? 'bg-orange-500' : 'bg-white/10'
              }`} />
            )}
          </div>
        ))}
      </div>

      {/* Step 1: Client Selection + Basic Info */}
      {step === 1 && (
        <motion.div
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
        >
          <Card className="bg-white/5 border-white/10">
            <CardContent className="p-8">
              <h2 className="text-xl font-semibold text-white mb-6">Basic Information</h2>
              
              <div className="space-y-6">
                {/* Job Type Toggle */}
                <div>
                  <label className="block text-gray-400 text-sm mb-2">
                    <Briefcase className="inline h-4 w-4 mr-1" />
                    Job Type
                  </label>
                  <div className="flex bg-white/5 rounded-lg p-1 border border-white/10">
                    <button
                      type="button"
                      onClick={() => setFormData(prev => ({ ...prev, job_type: 'agency' as const, client_id: '' }))}
                      className={`flex-1 py-3 px-4 text-sm font-medium rounded-md transition-all ${
                        formData.job_type === 'agency'
                          ? 'bg-orange-500/20 text-orange-400 border border-orange-500/30'
                          : 'text-gray-400 hover:text-white'
                      }`}
                    >
                      🏢 Agency Direct Hire
                    </button>
                    <button
                      type="button"
                      onClick={() => setFormData(prev => ({ ...prev, job_type: 'client' as const }))}
                      className={`flex-1 py-3 px-4 text-sm font-medium rounded-md transition-all ${
                        formData.job_type === 'client'
                          ? 'bg-orange-500/20 text-orange-400 border border-orange-500/30'
                          : 'text-gray-400 hover:text-white'
                      }`}
                    >
                      👤 Client Job
                    </button>
                  </div>
                  <p className="text-xs text-gray-500 mt-2">
                    {formData.job_type === 'agency' 
                      ? 'Hiring directly for your agency. You control the full pipeline.' 
                      : 'Filling a role for a client. Includes client review steps.'}
                  </p>
                </div>

                {/* Client Selector — only for client jobs */}
                {formData.job_type === 'client' && (
                <div>
                  <label className="block text-gray-400 text-sm mb-2">
                    <Building2 className="inline h-4 w-4 mr-1" />
                    Select Client *
                  </label>
                  {loadingClients ? (
                    <div className="flex items-center gap-2 text-gray-400 py-3">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Loading clients...
                    </div>
                  ) : clients.length === 0 ? (
                    <div className="p-4 rounded-lg bg-orange-500/10 border border-orange-500/30">
                      <p className="text-orange-400 text-sm">
                        No clients found. <Link href="/clients" className="underline">Add a client first</Link> to post jobs.
                      </p>
                    </div>
                  ) : (
                    <select
                      value={formData.client_id}
                      onChange={(e) => setFormData(prev => ({ ...prev, client_id: e.target.value }))}
                      className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-lg text-white focus:outline-none focus:border-orange-500/50"
                    >
                      <option value="">-- Select a client --</option>
                      {clients.map((client) => (
                        <option key={client.id} value={client.id}>
                          {client.company?.name || 'Unnamed Client'} 
                          {client.company?.industry ? ` (${client.company.industry})` : ''}
                        </option>
                      ))}
                    </select>
                  )}
                  {selectedClient && (
                    <p className="text-xs text-gray-500 mt-2">
                      Note: Client name is for your reference only. Candidates will see your agency name.
                    </p>
                  )}
                </div>
                )}

                <div>
                  <label className="block text-gray-400 text-sm mb-2">Job Title *</label>
                  <Input
                    placeholder="e.g. Senior Virtual Assistant"
                    value={formData.title}
                    onChange={(e) => setFormData(prev => ({ ...prev, title: e.target.value }))}
                    className="bg-white/5 border-white/10 text-white text-lg py-6"
                  />
                </div>

                <div>
                  <label className="block text-gray-400 text-sm mb-2">Brief Description *</label>
                  <textarea
                    placeholder="Describe the role in a few sentences. Our AI will use this to generate a complete job listing..."
                    value={formData.briefDescription}
                    onChange={(e) => setFormData(prev => ({ ...prev, briefDescription: e.target.value }))}
                    className="w-full h-32 px-4 py-3 bg-white/5 border border-white/10 rounded-lg text-white placeholder:text-gray-500 focus:outline-none focus:border-orange-500/50"
                  />
                </div>

                {/* Quick Settings */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-gray-400 text-sm mb-2">Work Type</label>
                    <select
                      value={formData.workType}
                      onChange={(e) => setFormData(prev => ({ ...prev, workType: e.target.value }))}
                      className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white"
                    >
                      <option value="full_time">Full Time</option>
                      <option value="part_time">Part Time</option>
                      <option value="contract">Contract</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-gray-400 text-sm mb-2">Arrangement</label>
                    <select
                      value={formData.workArrangement}
                      onChange={(e) => setFormData(prev => ({ ...prev, workArrangement: e.target.value }))}
                      className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white"
                    >
                      <option value="remote">Remote</option>
                      <option value="onsite">On-site</option>
                      <option value="hybrid">Hybrid</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-gray-400 text-sm mb-2">Shift</label>
                    <select
                      value={formData.shift}
                      onChange={(e) => setFormData(prev => ({ ...prev, shift: e.target.value }))}
                      className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white"
                    >
                      <option value="day">Day Shift</option>
                      <option value="night">Night Shift</option>
                      <option value="flexible">Flexible</option>
                    </select>
                  </div>
                </div>

                <Button
                  onClick={handleGenerateWithAI}
                  disabled={!formData.title || !formData.briefDescription || (formData.job_type === 'client' && !formData.client_id) || generating}
                  className="w-full bg-gradient-to-r from-orange-500 to-amber-600 hover:from-orange-600 hover:to-amber-700 py-6"
                >
                  {generating ? (
                    <>
                      <Loader2 className="h-5 w-5 mr-2 animate-spin" />
                      Generating with AI...
                    </>
                  ) : (
                    <>
                      <Sparkles className="h-5 w-5 mr-2" />
                      Generate Job Details with AI
                    </>
                  )}
                </Button>

                <div className="text-center">
                  <button
                    onClick={() => (formData.job_type === 'agency' || formData.client_id) ? setStep(2) : toast.error('Please select a client')}
                    className="text-gray-400 hover:text-white text-sm"
                  >
                    Skip AI and write manually →
                  </button>
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      )}

      {/* Step 2: Review/Edit Generated Content */}
      {step === 2 && (
        <motion.div
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
        >
          <Card className="bg-white/5 border-white/10">
            <CardContent className="p-8">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-semibold text-white">Job Details</h2>
                {selectedClient && (
                  <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-white/5 border border-white/10">
                    <Building2 className="h-4 w-4 text-orange-400" />
                    <span className="text-sm text-gray-300">{selectedClient.company?.name}</span>
                  </div>
                )}
              </div>
              
              <div className="space-y-6">
                <div>
                  <label className="block text-gray-400 text-sm mb-2">Full Description</label>
                  <textarea
                    value={formData.description}
                    onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                    className="w-full h-40 px-4 py-3 bg-white/5 border border-white/10 rounded-lg text-white placeholder:text-gray-500 focus:outline-none focus:border-orange-500/50"
                  />
                </div>

                <div className="grid grid-cols-2 gap-6">
                  <div>
                    <label className="block text-gray-400 text-sm mb-2">Requirements</label>
                    <textarea
                      value={formData.requirements.join('\n')}
                      onChange={(e) => setFormData(prev => ({ 
                        ...prev, 
                        requirements: e.target.value.split('\n').filter(r => r.trim()) 
                      }))}
                      placeholder="One requirement per line"
                      className="w-full h-32 px-4 py-3 bg-white/5 border border-white/10 rounded-lg text-white placeholder:text-gray-500 focus:outline-none focus:border-orange-500/50 text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-gray-400 text-sm mb-2">Responsibilities</label>
                    <textarea
                      value={formData.responsibilities.join('\n')}
                      onChange={(e) => setFormData(prev => ({ 
                        ...prev, 
                        responsibilities: e.target.value.split('\n').filter(r => r.trim()) 
                      }))}
                      placeholder="One responsibility per line"
                      className="w-full h-32 px-4 py-3 bg-white/5 border border-white/10 rounded-lg text-white placeholder:text-gray-500 focus:outline-none focus:border-orange-500/50 text-sm"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-gray-400 text-sm mb-2">Skills (comma separated)</label>
                  <Input
                    value={formData.skills.join(', ')}
                    onChange={(e) => setFormData(prev => ({ 
                      ...prev, 
                      skills: e.target.value.split(',').map(s => s.trim()).filter(s => s) 
                    }))}
                    placeholder="e.g. Communication, Time Management, Excel"
                    className="bg-white/5 border-white/10 text-white"
                  />
                </div>
              </div>

              <div className="flex gap-4 mt-8">
                <Button
                  variant="outline"
                  onClick={() => setStep(1)}
                  className="flex-1 border-white/10 text-gray-400"
                >
                  Back
                </Button>
                <Button
                  onClick={() => setStep(3)}
                  className="flex-1 bg-gradient-to-r from-orange-500 to-amber-600"
                >
                  Continue
                </Button>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      )}

      {/* Step 3: Compensation & Final Details */}
      {step === 3 && (
        <motion.div
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
        >
          <Card className="bg-white/5 border-white/10">
            <CardContent className="p-8">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-semibold text-white">Compensation & Details</h2>
                {selectedClient && (
                  <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-white/5 border border-white/10">
                    <Building2 className="h-4 w-4 text-orange-400" />
                    <span className="text-sm text-gray-300">{selectedClient.company?.name}</span>
                  </div>
                )}
              </div>
              
              <div className="space-y-6">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-gray-400 text-sm mb-2">Min Salary</label>
                    <div className="relative">
                      <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                      <Input
                        type="number"
                        placeholder="30000"
                        value={formData.salary_min}
                        onChange={(e) => setFormData(prev => ({ ...prev, salary_min: e.target.value }))}
                        className="pl-10 bg-white/5 border-white/10 text-white"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-gray-400 text-sm mb-2">Max Salary</label>
                    <div className="relative">
                      <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                      <Input
                        type="number"
                        placeholder="50000"
                        value={formData.salary_max}
                        onChange={(e) => setFormData(prev => ({ ...prev, salary_max: e.target.value }))}
                        className="pl-10 bg-white/5 border-white/10 text-white"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-gray-400 text-sm mb-2">Currency</label>
                    <select
                      value={formData.currency}
                      onChange={(e) => setFormData(prev => ({ ...prev, currency: e.target.value }))}
                      className="w-full px-4 py-2 bg-white/5 border border-white/10 rounded-lg text-white"
                    >
                      <option value="PHP">PHP</option>
                      <option value="USD">USD</option>
                      <option value="AUD">AUD</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-gray-400 text-sm mb-2">Experience Level</label>
                    <select
                      value={formData.experienceLevel}
                      onChange={(e) => setFormData(prev => ({ ...prev, experienceLevel: e.target.value }))}
                      className="w-full px-4 py-2 bg-white/5 border border-white/10 rounded-lg text-white"
                    >
                      <option value="entry">Entry Level</option>
                      <option value="mid">Mid Level</option>
                      <option value="senior">Senior</option>
                      <option value="lead">Lead/Manager</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-gray-400 text-sm mb-2">Benefits (comma separated)</label>
                    <Input
                      value={formData.benefits.join(', ')}
                      onChange={(e) => setFormData(prev => ({ 
                        ...prev, 
                        benefits: e.target.value.split(',').map(s => s.trim()).filter(s => s) 
                      }))}
                      placeholder="e.g. HMO, Paid Leave, WFH Setup"
                      className="bg-white/5 border-white/10 text-white"
                    />
                  </div>
                </div>
              </div>

              <div className="flex gap-4 mt-8">
                <Button
                  variant="outline"
                  onClick={() => setStep(2)}
                  className="flex-1 border-white/10 text-gray-400"
                >
                  Back
                </Button>
                <Button
                  onClick={handleSubmit}
                  disabled={loading}
                  className="flex-1 bg-gradient-to-r from-orange-500 to-amber-600"
                >
                  {loading ? (
                    <Loader2 className="h-5 w-5 animate-spin" />
                  ) : (
                    <>
                      <Briefcase className="h-4 w-4 mr-2" />
                      Publish Job
                    </>
                  )}
                </Button>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      )}
    </div>
  );
}

'use client';

import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import {
  Building2,
  Search,
  Plus,
  MoreHorizontal,
  Users,
  Briefcase,
  Mail,
  Phone,
  MapPin,
  Calendar,
  ChevronRight,
  ShieldCheck,
  ShieldAlert,
  FileText,
  AlertCircle,
  Clock
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/shared/ui/card';
import { Button } from '@/components/shared/ui/button';
import { Input } from '@/components/shared/ui/input';
import { Badge } from '@/components/shared/ui/badge';
import Link from 'next/link';

interface Agency {
  id: string;
  name: string;
  logo?: string;
  email: string;
  phone?: string;
  location: string;
  recruitersCount: number;
  activeJobsCount: number;
  status: 'active' | 'inactive' | 'pending';
  verificationStatus: 'verified' | 'auto_verified' | 'needs_review' | 'documents_uploaded' | 'no_documents' | 'rejected';
  createdAt: string;
  tin_number?: string;
  document_verification?: Record<string, unknown>;
}

export default function AgenciesPage() {
  const [agencies, setAgencies] = useState<Agency[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [verificationFilter, setVerificationFilter] = useState<'all' | 'needs_review' | 'no_documents' | 'verified'>('all');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchAgencies = async () => {
      try {
        const response = await fetch(`/api/agencies?search=${searchQuery}`);
        const data = await response.json();
        
        if (response.ok) {
          setAgencies(data.agencies.map((a: Record<string, unknown>) => ({
            id: a.id,
            name: a.name,
            email: a.email || '',
            phone: a.phone || '',
            location: a.location || 'No location',
            recruitersCount: a.recruitersCount || 0,
            activeJobsCount: a.activeJobsCount || 0,
            status: a.status || 'active',
            verificationStatus: a.verificationStatus || 'no_documents',
            createdAt: a.created_at,
            tin_number: a.tin_number,
            document_verification: a.document_verification,
          })));
        }
      } catch (error) {
        console.error('Failed to fetch agencies:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchAgencies();
  }, [searchQuery]);

  const getVerificationBadge = (vs: Agency['verificationStatus']) => {
    const config = {
      verified: { label: 'Verified', icon: ShieldCheck, className: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30' },
      auto_verified: { label: 'AI Verified', icon: ShieldCheck, className: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30' },
      needs_review: { label: 'Needs Review', icon: ShieldAlert, className: 'bg-amber-500/20 text-amber-400 border-amber-500/30' },
      documents_uploaded: { label: 'Docs Uploaded', icon: FileText, className: 'bg-blue-500/20 text-blue-400 border-blue-500/30' },
      no_documents: { label: 'No Documents', icon: AlertCircle, className: 'bg-gray-500/20 text-gray-400 border-gray-500/30' },
      rejected: { label: 'Rejected', icon: ShieldAlert, className: 'bg-red-500/20 text-red-400 border-red-500/30' },
    };
    const c = config[vs] || config.no_documents;
    const Icon = c.icon;
    return (
      <Badge variant="outline" className={`${c.className} flex items-center gap-1`}>
        <Icon className="h-3 w-3" />
        {c.label}
      </Badge>
    );
  };

  const getStatusBadge = (status: Agency['status']) => {
    const styles = {
      active: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
      inactive: 'bg-gray-500/20 text-gray-400 border-gray-500/30',
      pending: 'bg-orange-500/20 text-orange-400 border-orange-500/30',
    };
    return <Badge variant="outline" className={styles[status]}>{status}</Badge>;
  };

  const filteredAgencies = agencies.filter(agency => {
    const matchesSearch = (agency.name || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
      (agency.email || '').toLowerCase().includes(searchQuery.toLowerCase());
    const matchesFilter = verificationFilter === 'all' ||
      (verificationFilter === 'needs_review' && ['needs_review', 'documents_uploaded'].includes(agency.verificationStatus)) ||
      (verificationFilter === 'no_documents' && agency.verificationStatus === 'no_documents') ||
      (verificationFilter === 'verified' && ['verified', 'auto_verified'].includes(agency.verificationStatus));
    return matchesSearch && matchesFilter;
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-white">Agencies</h1>
          <p className="text-gray-400 mt-1">Manage recruitment agencies and their recruiters</p>
        </div>
        <Button className="bg-gradient-to-r from-red-500 to-orange-600 hover:from-red-600 hover:to-orange-700">
          <Plus className="h-4 w-4 mr-2" />
          Add Agency
        </Button>
      </div>

      {/* Needs Attention Banner */}
      {agencies.filter(a => a.verificationStatus === 'needs_review' || a.verificationStatus === 'documents_uploaded').length > 0 && (
        <div className="bg-amber-500/10 border border-amber-500/30 rounded-lg p-4 flex items-center gap-3">
          <ShieldAlert className="h-6 w-6 text-amber-400 flex-shrink-0" />
          <div className="flex-1">
            <span className="text-amber-400 font-semibold">
              {agencies.filter(a => a.verificationStatus === 'needs_review' || a.verificationStatus === 'documents_uploaded').length} agencies need verification attention
            </span>
          </div>
        </div>
      )}

      {/* Search + Filters */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative max-w-md flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <Input
            placeholder="Search agencies..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10 bg-white/5 border-white/10 text-white"
          />
        </div>
        <div className="flex gap-2">
          {(['all', 'needs_review', 'no_documents', 'verified'] as const).map((filter) => (
            <Button
              key={filter}
              variant="outline"
              size="sm"
              onClick={() => setVerificationFilter(filter)}
              className={`border-white/10 ${verificationFilter === filter ? 'bg-white/10 text-white' : 'text-gray-400 hover:text-white'}`}
            >
              {filter === 'all' ? 'All' : filter === 'needs_review' ? '⚠️ Needs Review' : filter === 'no_documents' ? '📄 No Docs' : '✅ Verified'}
            </Button>
          ))}
        </div>
      </div>

      {/* Agencies Grid */}
      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredAgencies.map((agency, index) => (
          <motion.div
            key={agency.id}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.1 }}
          >
            <Link href={`/agencies/${agency.id}`}>
              <Card className="bg-white/5 border-white/10 hover:border-cyan-500/30 transition-all cursor-pointer group">
                <CardContent className="p-6">
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-lg bg-gradient-to-br from-red-500/20 to-orange-500/20 flex items-center justify-center">
                      <Building2 className="h-6 w-6 text-red-400" />
                    </div>
                    <div>
                      <h3 className="text-white font-semibold">{agency.name}</h3>
                      <p className="text-gray-400 text-sm">{agency.email}</p>
                    </div>
                  </div>
                  <div className="flex flex-col gap-1 items-end">
                    {getVerificationBadge(agency.verificationStatus)}
                  </div>
                </div>

                <div className="space-y-2 text-sm">
                  <div className="flex items-center gap-2 text-gray-400">
                    <MapPin className="h-4 w-4" />
                    <span>{agency.location}</span>
                  </div>
                  {agency.phone && (
                    <div className="flex items-center gap-2 text-gray-400">
                      <Phone className="h-4 w-4" />
                      <span>{agency.phone}</span>
                    </div>
                  )}
                </div>

                <div className="flex items-center gap-4 mt-4 pt-4 border-t border-white/10">
                  <div className="flex items-center gap-2">
                    <Users className="h-4 w-4 text-cyan-400" />
                    <span className="text-white">{agency.recruitersCount}</span>
                    <span className="text-gray-500 text-sm">recruiters</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Briefcase className="h-4 w-4 text-purple-400" />
                    <span className="text-white">{agency.activeJobsCount}</span>
                    <span className="text-gray-500 text-sm">jobs</span>
                  </div>
                </div>

                <div className="flex items-center justify-between mt-4 pt-4 border-t border-white/10">
                  <span className="text-gray-500 text-xs flex items-center gap-1">
                    <Calendar className="h-3 w-3" />
                    Joined {new Date(agency.createdAt).toLocaleDateString()}
                  </span>
                  <ChevronRight className="h-4 w-4 text-gray-500 group-hover:text-cyan-400 transition-colors" />
                </div>
              </CardContent>
            </Card>
            </Link>
          </motion.div>
        ))}
      </div>
    </div>
  );
}


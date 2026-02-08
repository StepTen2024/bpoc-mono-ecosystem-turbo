'use client';

import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import {
  Users,
  Search,
  Filter,
  Download,
  MoreHorizontal,
  Mail,
  Phone,
  MapPin,
  Calendar,
  FileText,
  Gamepad2,
  Brain,
  Star,
  Eye,
  ChevronRight
} from 'lucide-react';
import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/shared/ui/card';
import { Button } from '@/components/shared/ui/button';
import { Input } from '@/components/shared/ui/input';
import { Badge } from '@/components/shared/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/shared/ui/avatar';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/shared/ui/table';

interface Candidate {
  id: string;
  name: string;
  email: string;
  phone?: string;
  location?: string;
  avatar?: string;
  hasResume: boolean;
  hasAiAnalysis: boolean;
  gameScores: {
    disc?: string;
  };
  status: 'active' | 'inactive' | 'hired';
  createdAt: string;
}

export default function CandidatesPage() {
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchCandidates = async () => {
      try {
        const response = await fetch(`/api/admin/candidates?search=${searchQuery}`);
        const data = await response.json();
        
        if (response.ok) {
          setCandidates(data.candidates.map((c: Record<string, unknown>) => ({
            id: c.id,
            name: c.name || c.email,
            email: c.email,
            phone: c.phone || undefined,
            location: c.location || undefined,
            avatar: c.avatar || undefined,
            hasResume: c.hasResume || false,
            hasAiAnalysis: c.hasAiAnalysis || false,
            gameScores: c.gameScores || {},
            status: c.status || 'active',
            createdAt: c.createdAt,
          })));
        }
      } catch (error) {
        console.error('Failed to fetch candidates:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchCandidates();
  }, [searchQuery]);

  const getStatusBadge = (status: Candidate['status']) => {
    const styles = {
      active: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
      inactive: 'bg-gray-500/20 text-gray-400 border-gray-500/30',
      hired: 'bg-cyan-500/20 text-cyan-400 border-cyan-500/30',
    };
    return <Badge variant="outline" className={styles[status]}>{status}</Badge>;
  };

  const filteredCandidates = candidates.filter(candidate =>
    (candidate.name || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
    (candidate.email || '').toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-white">Candidates</h1>
          <p className="text-gray-400 mt-1 text-sm md:text-base">Comprehensive view of all candidates</p>
        </div>
        <div className="flex gap-2 sm:gap-3">
          <Button variant="outline" className="border-white/10 text-gray-300 text-sm">
            <Filter className="h-4 w-4 mr-2" />
            Filters
          </Button>
          <Button variant="outline" className="border-white/10 text-gray-300 text-sm">
            <Download className="h-4 w-4 mr-2" />
            Export
          </Button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4">
        <Card className="bg-white/5 border-white/10">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-cyan-500/20">
                <Users className="h-5 w-5 text-cyan-400" />
              </div>
              <div>
                <p className="text-2xl font-bold text-white">{candidates.length}</p>
                <p className="text-gray-400 text-sm">Total Candidates</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-white/5 border-white/10">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-purple-500/20">
                <FileText className="h-5 w-5 text-purple-400" />
              </div>
              <div>
                <p className="text-2xl font-bold text-white">{candidates.filter(c => c.hasResume).length}</p>
                <p className="text-gray-400 text-sm">With Resume</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-white/5 border-white/10">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-orange-500/20">
                <Brain className="h-5 w-5 text-orange-400" />
              </div>
              <div>
                <p className="text-2xl font-bold text-white">{candidates.filter(c => c.hasAiAnalysis).length}</p>
                <p className="text-gray-400 text-sm">AI Analyzed</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-white/5 border-white/10">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-emerald-500/20">
                <Gamepad2 className="h-5 w-5 text-emerald-400" />
              </div>
              <div>
                <p className="text-2xl font-bold text-white">{candidates.filter(c => c.gameScores.disc).length}</p>
                <p className="text-gray-400 text-sm">DISC Assessed</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Search */}
      <div className="relative w-full md:max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
        <Input
          placeholder="Search candidates..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-10 bg-white/5 border-white/10 text-white"
        />
      </div>

      {/* Table */}
      <Card className="bg-white/5 border-white/10 overflow-hidden">
        <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow className="border-white/10 hover:bg-transparent">
              <TableHead className="text-gray-400">Candidate</TableHead>
              <TableHead className="text-gray-400">Contact</TableHead>
              <TableHead className="text-gray-400">Resume</TableHead>
              <TableHead className="text-gray-400">AI Analysis</TableHead>
              <TableHead className="text-gray-400">Games</TableHead>
              <TableHead className="text-gray-400">Status</TableHead>
              <TableHead className="text-gray-400">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredCandidates.map((candidate) => (
              <TableRow key={candidate.id} className="border-white/10 hover:bg-white/5 cursor-pointer group" onClick={() => window.location.href = `/admin/candidates/${candidate.id}`}>
                <TableCell>
                  <div className="flex items-center gap-3">
                    <Avatar className="h-10 w-10">
                      <AvatarImage src={candidate.avatar} />
                      <AvatarFallback className="bg-gradient-to-br from-cyan-500 to-purple-600 text-white">
                        {candidate.name.split(' ').map(n => n[0]).join('')}
                      </AvatarFallback>
                    </Avatar>
                    <div>
                      <p className="text-white font-medium group-hover:text-cyan-400 transition-colors">{candidate.name}</p>
                      <p className="text-gray-500 text-sm">{candidate.location || 'No location'}</p>
                    </div>
                  </div>
                </TableCell>
                <TableCell>
                  <div className="space-y-1">
                    <p className="text-gray-300 text-sm flex items-center gap-1">
                      <Mail className="h-3 w-3" /> {candidate.email}
                    </p>
                    {candidate.phone && (
                      <p className="text-gray-400 text-sm flex items-center gap-1">
                        <Phone className="h-3 w-3" /> {candidate.phone}
                      </p>
                    )}
                  </div>
                </TableCell>
                <TableCell>
                  {candidate.hasResume ? (
                    <Badge variant="outline" className="bg-emerald-500/20 text-emerald-400 border-emerald-500/30">
                      <FileText className="h-3 w-3 mr-1" /> Yes
                    </Badge>
                  ) : (
                    <Badge variant="outline" className="bg-gray-500/20 text-gray-400 border-gray-500/30">
                      No
                    </Badge>
                  )}
                </TableCell>
                <TableCell>
                  {candidate.hasAiAnalysis ? (
                    <Badge variant="outline" className="bg-purple-500/20 text-purple-400 border-purple-500/30">
                      <Brain className="h-3 w-3 mr-1" /> Complete
                    </Badge>
                  ) : (
                    <Badge variant="outline" className="bg-gray-500/20 text-gray-400 border-gray-500/30">
                      Pending
                    </Badge>
                  )}
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-2">
                    {candidate.gameScores.disc && (
                      <Badge variant="outline" className="bg-orange-500/20 text-orange-400 border-orange-500/30">
                        DISC: {candidate.gameScores.disc}
                      </Badge>
                    )}
                    {!candidate.gameScores.disc && (
                      <span className="text-gray-500 text-sm">-</span>
                    )}
                  </div>
                </TableCell>
                <TableCell>{getStatusBadge(candidate.status)}</TableCell>
                <TableCell>
                  <Link href={`/admin/candidates/${candidate.id}`} onClick={(e) => e.stopPropagation()}>
                    <Button variant="ghost" size="sm" className="text-gray-400 hover:text-cyan-400">
                      <Eye className="h-4 w-4 mr-1" />
                      View
                      <ChevronRight className="h-4 w-4 ml-1" />
                    </Button>
                  </Link>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        </div>
      </Card>
    </div>
  );
}


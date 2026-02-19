'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { useAuth } from '@/contexts/AuthContext'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  Briefcase,
  Clock,
  CheckCircle,
  XCircle,
  Calendar,
  Building2,
  Loader2,
  FileText,
  DollarSign,
  Eye,
  ChevronRight,
  Sparkles,
  Flame,
  Star,
  Send,
  Video,
  Gift,
  Home,
  Sun,
  Moon,
  ArrowRight,
  BadgeCheck,
  TrendingUp,
  Users,
  AlertCircle,
  Handshake,
  Building
} from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'

interface Application {
  id: string
  job_id: string
  job_title: string
  company: string
  status: string
  applied_at: string
  released_to_client: boolean
  released_at?: string
  rejection_reason?: string
  work_type?: string
  work_arrangement?: string
  salary?: {
    min: number
    max: number
    currency: string
  }
  interview_scheduled_at?: string
  match_score?: number
}

const statusConfig: Record<string, { 
  label: string
  color: string
  bgColor: string
  borderColor: string
  icon: any
  description: string
  stage: number
}> = {
  submitted: { 
    label: 'Under Review', 
    color: 'text-cyan-400',
    bgColor: 'bg-cyan-500/20',
    borderColor: 'border-cyan-500/30',
    icon: Eye,
    description: 'Being reviewed by recruitment',
    stage: 1
  },
  under_review: { 
    label: 'Under Review', 
    color: 'text-cyan-400',
    bgColor: 'bg-cyan-500/20',
    borderColor: 'border-cyan-500/30',
    icon: Eye,
    description: 'Being reviewed by recruitment',
    stage: 1
  },
  shortlisted: { 
    label: 'Shortlisted', 
    color: 'text-yellow-400',
    bgColor: 'bg-yellow-500/20',
    borderColor: 'border-yellow-500/30',
    icon: Star,
    description: "You've been shortlisted!",
    stage: 2
  },
  released_to_client: { 
    label: 'With Client', 
    color: 'text-orange-400',
    bgColor: 'bg-orange-500/20',
    borderColor: 'border-orange-500/30',
    icon: Building2,
    description: 'Your profile is with the hiring company',
    stage: 3
  },
  interview_scheduled: { 
    label: 'Interview Scheduled', 
    color: 'text-purple-400',
    bgColor: 'bg-purple-500/20',
    borderColor: 'border-purple-500/30',
    icon: Video,
    description: 'Interview coming up!',
    stage: 4
  },
  interviewed: { 
    label: 'Awaiting Decision', 
    color: 'text-indigo-400',
    bgColor: 'bg-indigo-500/20',
    borderColor: 'border-indigo-500/30',
    icon: Clock,
    description: 'Interview done, awaiting decision',
    stage: 5
  },
  offer_sent: { 
    label: 'Offer Received', 
    color: 'text-green-400',
    bgColor: 'bg-green-500/20',
    borderColor: 'border-green-500/30',
    icon: Gift,
    description: 'You have an offer! Review it now',
    stage: 6
  },
  offer_accepted: { 
    label: 'Offer Accepted', 
    color: 'text-emerald-400',
    bgColor: 'bg-emerald-500/20',
    borderColor: 'border-emerald-500/30',
    icon: Handshake,
    description: 'Moving to onboarding!',
    stage: 7
  },
  hired: { 
    label: 'Hired', 
    color: 'text-emerald-400',
    bgColor: 'bg-emerald-500/20',
    borderColor: 'border-emerald-500/30',
    icon: BadgeCheck,
    description: 'Welcome aboard!',
    stage: 7
  },
  rejected: { 
    label: 'Not Selected', 
    color: 'text-red-400',
    bgColor: 'bg-red-500/20',
    borderColor: 'border-red-500/30',
    icon: XCircle,
    description: "Keep applying!",
    stage: -1
  },
  withdrawn: { 
    label: 'Withdrawn', 
    color: 'text-gray-400',
    bgColor: 'bg-gray-500/20',
    borderColor: 'border-gray-500/30',
    icon: XCircle,
    description: 'You withdrew this application',
    stage: -1
  },
}

const activeStatuses = ['submitted', 'under_review', 'shortlisted', 'released_to_client', 'interview_scheduled', 'interviewed', 'offer_sent']
const completedStatuses = ['offer_accepted', 'hired', 'rejected', 'withdrawn']

function getCardStyle(status: string) {
  if (status === 'offer_sent' || status === 'offer_accepted' || status === 'hired') {
    return {
      border: 'border-2 border-green-500/40',
      gradient: 'bg-gradient-to-br from-green-500/10 via-emerald-500/5 to-cyan-500/10',
      glow: 'shadow-[0_0_30px_-5px_rgba(34,197,94,0.4)] hover:shadow-[0_0_50px_-5px_rgba(34,197,94,0.6)]',
      accent: 'green'
    }
  }
  if (status === 'interview_scheduled' || status === 'interviewed') {
    return {
      border: 'border-2 border-purple-500/40',
      gradient: 'bg-gradient-to-br from-purple-500/10 via-indigo-500/5 to-pink-500/10',
      glow: 'shadow-[0_0_30px_-5px_rgba(168,85,247,0.4)] hover:shadow-[0_0_50px_-5px_rgba(168,85,247,0.6)]',
      accent: 'purple'
    }
  }
  if (status === 'released_to_client') {
    return {
      border: 'border-2 border-orange-500/40',
      gradient: 'bg-gradient-to-br from-orange-500/10 via-yellow-500/5 to-red-500/10',
      glow: 'shadow-[0_0_30px_-5px_rgba(249,115,22,0.4)] hover:shadow-[0_0_50px_-5px_rgba(249,115,22,0.6)]',
      accent: 'orange'
    }
  }
  if (status === 'shortlisted') {
    return {
      border: 'border-2 border-yellow-500/40',
      gradient: 'bg-gradient-to-br from-yellow-500/10 via-orange-500/5 to-amber-500/10',
      glow: 'shadow-[0_0_30px_-5px_rgba(234,179,8,0.3)] hover:shadow-[0_0_50px_-5px_rgba(234,179,8,0.5)]',
      accent: 'yellow'
    }
  }
  if (status === 'rejected' || status === 'withdrawn') {
    return {
      border: 'border border-white/10',
      gradient: 'bg-gradient-to-br from-white/[0.03] to-white/[0.01]',
      glow: '',
      accent: 'gray'
    }
  }
  return {
    border: 'border border-white/10',
    gradient: 'bg-gradient-to-br from-white/[0.06] to-white/[0.02]',
    glow: 'hover:border-cyan-500/40 hover:shadow-[0_0_40px_-10px_rgba(6,182,212,0.3)]',
    accent: 'cyan'
  }
}

export default function ApplicationsPage() {
  const { user, session } = useAuth()
  const [loading, setLoading] = useState(true)
  const [applications, setApplications] = useState<Application[]>([])
  const [activeTab, setActiveTab] = useState('active')

  useEffect(() => {
    if (session?.access_token) {
      fetchApplications()
    } else {
      // No session available — stop loading so the page renders empty state
      setLoading(false)
    }
  }, [session?.access_token])

  const fetchApplications = async () => {
    if (!session?.access_token) return
    try {
      const res = await fetch('/api/candidate/applications', {
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
        },
      })
      const data = await res.json()
      if (data.applications) {
        setApplications(data.applications)
      }
    } catch (err) {
      console.error('Error fetching applications:', err)
    } finally {
      setLoading(false)
    }
  }

  const activeApps = applications.filter(app => activeStatuses.includes(app.status))
  const completedApps = applications.filter(app => completedStatuses.includes(app.status))

  const filteredApps = activeTab === 'active' ? activeApps : 
                       activeTab === 'completed' ? completedApps : 
                       applications

  const getStatusInfo = (status: string) => {
    return statusConfig[status] || statusConfig.submitted
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 text-cyan-400 animate-spin" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl sm:text-3xl font-black text-white">My Applications</h1>
          <p className="text-gray-400 mt-1">Track your job applications in real-time</p>
        </div>
        <Link href="/jobs">
          <Button className="bg-gradient-to-r from-cyan-500 to-purple-600 hover:from-cyan-600 hover:to-purple-700 font-bold shadow-lg shadow-cyan-500/30">
            <Briefcase className="h-4 w-4 mr-2" />
            Find More Jobs
          </Button>
        </Link>
      </div>

      {/* Stats Overview - Vibrant */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="p-5 rounded-2xl bg-gradient-to-br from-cyan-500/20 to-blue-500/10 border border-cyan-500/30">
          <p className="text-3xl font-black text-cyan-400">{applications.length}</p>
          <p className="text-gray-400 text-sm font-medium">Total</p>
        </div>
        <div className="p-5 rounded-2xl bg-gradient-to-br from-yellow-500/20 to-orange-500/10 border border-yellow-500/30">
          <p className="text-3xl font-black text-yellow-400">{activeApps.length}</p>
          <p className="text-gray-400 text-sm font-medium">In Progress</p>
        </div>
        <div className="p-5 rounded-2xl bg-gradient-to-br from-green-500/20 to-emerald-500/10 border border-green-500/30">
          <p className="text-3xl font-black text-green-400">
            {applications.filter(a => a.status === 'offer_sent' || a.status === 'hired').length}
          </p>
          <p className="text-gray-400 text-sm font-medium">Offers</p>
        </div>
        <div className="p-5 rounded-2xl bg-gradient-to-br from-purple-500/20 to-pink-500/10 border border-purple-500/30">
          <p className="text-3xl font-black text-purple-400">
            {applications.filter(a => a.status === 'interview_scheduled' || a.status === 'interviewed').length}
          </p>
          <p className="text-gray-400 text-sm font-medium">Interviews</p>
        </div>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="bg-white/5 border border-white/10 p-1">
          <TabsTrigger 
            value="active" 
            className="data-[state=active]:bg-gradient-to-r data-[state=active]:from-cyan-500 data-[state=active]:to-blue-500 data-[state=active]:text-white font-bold"
          >
            Active ({activeApps.length})
          </TabsTrigger>
          <TabsTrigger 
            value="completed" 
            className="data-[state=active]:bg-gradient-to-r data-[state=active]:from-cyan-500 data-[state=active]:to-blue-500 data-[state=active]:text-white font-bold"
          >
            Completed ({completedApps.length})
          </TabsTrigger>
          <TabsTrigger 
            value="all" 
            className="data-[state=active]:bg-gradient-to-r data-[state=active]:from-cyan-500 data-[state=active]:to-blue-500 data-[state=active]:text-white font-bold"
          >
            All ({applications.length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value={activeTab} className="mt-6">
          {filteredApps.length === 0 ? (
            <div className="rounded-2xl bg-white/5 border border-white/10 p-12 text-center">
              <Briefcase className="h-16 w-16 text-gray-600 mx-auto mb-4" />
              <h3 className="text-xl font-black text-white mb-2">No Applications Yet</h3>
              <p className="text-gray-400 mb-6 max-w-md mx-auto">
                {activeTab === 'active' 
                  ? "You don't have any active applications. Start applying to jobs and track your progress here!"
                  : "No completed applications yet."
                }
              </p>
              <Link href="/jobs">
                <Button className="bg-gradient-to-r from-cyan-500 to-purple-600 hover:from-cyan-600 hover:to-purple-700 font-bold px-8">
                  <Sparkles className="h-4 w-4 mr-2" />
                  Browse Jobs
                </Button>
              </Link>
            </div>
          ) : (
            <div className="space-y-4">
              {filteredApps.map((app) => {
                const statusInfo = getStatusInfo(app.status)
                const StatusIcon = statusInfo.icon
                const cardStyle = getCardStyle(app.status)

                return (
                  <Link key={app.id} href={`/applications/${app.id}`} className="block group">
                    <div className={`relative overflow-hidden rounded-2xl transition-all duration-500 hover:-translate-y-1 ${cardStyle.gradient} ${cardStyle.border} ${cardStyle.glow}`}>
                      
                      {/* Top accent bar for special statuses */}
                      {(app.status === 'offer_sent' || app.status === 'offer_accepted' || app.status === 'hired') && (
                        <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-green-500 via-emerald-500 to-cyan-500" />
                      )}
                      {(app.status === 'interview_scheduled' || app.status === 'interviewed') && (
                        <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-purple-500 via-pink-500 to-indigo-500" />
                      )}
                      {(app.status === 'released_to_client' || app.released_to_client) && !['offer_sent', 'offer_accepted', 'hired', 'interview_scheduled', 'interviewed'].includes(app.status) && (
                        <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-orange-500 via-yellow-500 to-amber-500" />
                      )}
                      {app.status === 'shortlisted' && !app.released_to_client && (
                        <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-yellow-500 via-amber-500 to-orange-500" />
                      )}

                      <div className="p-6">
                        <div className="flex items-start justify-between gap-4">
                          {/* Left side - Job info */}
                          <div className="flex items-start gap-4 flex-1">
                            {/* Company Icon */}
                            <div className="relative flex-shrink-0">
                              <div className={`w-14 h-14 rounded-2xl flex items-center justify-center ${
                                cardStyle.accent === 'green' ? 'bg-gradient-to-br from-green-500/30 to-emerald-500/30 border-2 border-green-500/40' :
                                cardStyle.accent === 'purple' ? 'bg-gradient-to-br from-purple-500/30 to-pink-500/30 border-2 border-purple-500/40' :
                                cardStyle.accent === 'orange' ? 'bg-gradient-to-br from-orange-500/30 to-yellow-500/30 border-2 border-orange-500/40' :
                                cardStyle.accent === 'yellow' ? 'bg-gradient-to-br from-yellow-500/30 to-amber-500/30 border-2 border-yellow-500/40' :
                                'bg-gradient-to-br from-cyan-500/20 to-purple-500/20 border border-white/20'
                              }`}>
                                <Building2 className={`h-6 w-6 ${
                                  cardStyle.accent === 'green' ? 'text-green-400' :
                                  cardStyle.accent === 'purple' ? 'text-purple-400' :
                                  cardStyle.accent === 'orange' ? 'text-orange-400' :
                                  cardStyle.accent === 'yellow' ? 'text-yellow-400' :
                                  'text-cyan-400'
                                }`} />
                              </div>
                              {app.released_to_client && (
                                <div className="absolute -bottom-1 -right-1 w-5 h-5 bg-gradient-to-r from-orange-400 to-yellow-500 rounded-full border-2 border-[#0B0B0D] flex items-center justify-center">
                                  <Building className="h-2.5 w-2.5 text-white" />
                                </div>
                              )}
                            </div>

                            <div className="flex-1 min-w-0">
                              {/* Title and Status */}
                              <div className="flex flex-wrap items-center gap-3 mb-2">
                                <h3 className={`text-xl font-black transition-colors ${
                                  cardStyle.accent === 'green' ? 'text-white group-hover:text-green-400' :
                                  cardStyle.accent === 'purple' ? 'text-white group-hover:text-purple-400' :
                                  cardStyle.accent === 'orange' ? 'text-white group-hover:text-orange-400' :
                                  cardStyle.accent === 'yellow' ? 'text-white group-hover:text-yellow-400' :
                                  'text-white group-hover:text-cyan-400'
                                }`}>
                                  {app.job_title}
                                </h3>
                                <div className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold ${statusInfo.bgColor} ${statusInfo.color} border ${statusInfo.borderColor}`}>
                                  <StatusIcon className="h-3.5 w-3.5" />
                                  {statusInfo.label}
                                </div>
                              </div>

                              {/* Company */}
                              <p className="text-gray-400 font-medium mb-3">{app.company}</p>

                              {/* Meta info */}
                              <div className="flex flex-wrap items-center gap-3 mb-3">
                                <span className="text-sm text-gray-500">
                                  Applied {formatDistanceToNow(new Date(app.applied_at), { addSuffix: true })}
                                </span>
                                {app.work_arrangement && (
                                  <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold ${
                                    cardStyle.accent === 'green' ? 'bg-green-500/20 text-green-300 border border-green-500/30' :
                                    cardStyle.accent === 'purple' ? 'bg-purple-500/20 text-purple-300 border border-purple-500/30' :
                                    cardStyle.accent === 'orange' ? 'bg-orange-500/20 text-orange-300 border border-orange-500/30' :
                                    cardStyle.accent === 'yellow' ? 'bg-yellow-500/20 text-yellow-300 border border-yellow-500/30' :
                                    'bg-cyan-500/20 text-cyan-300 border border-cyan-500/30'
                                  }`}>
                                    {app.work_arrangement === 'remote' ? <Home className="h-3.5 w-3.5" /> : <Building2 className="h-3.5 w-3.5" />}
                                    {app.work_arrangement === 'remote' ? 'Remote' : app.work_arrangement === 'hybrid' ? 'Hybrid' : 'On-site'}
                                  </span>
                                )}
                                {app.salary && (
                                  <span className="text-sm text-green-400 font-bold">
                                    {app.salary.currency === 'PHP' ? '₱' : app.salary.currency} {app.salary.min?.toLocaleString()}-{app.salary.max?.toLocaleString()}
                                  </span>
                                )}
                              </div>

                              {/* Status description */}
                              <p className={`text-sm ${statusInfo.color} font-medium`}>
                                {statusInfo.description}
                              </p>

                              {/* Interview date if scheduled */}
                              {app.interview_scheduled_at && (
                                <div className="mt-3 inline-flex items-center gap-2 px-3 py-2 rounded-xl bg-purple-500/20 border border-purple-500/30">
                                  <Video className="h-4 w-4 text-purple-400" />
                                  <span className="text-sm text-purple-300 font-medium">
                                    Interview: {new Date(app.interview_scheduled_at).toLocaleDateString()} at {new Date(app.interview_scheduled_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                  </span>
                                </div>
                              )}

                              {/* Rejection reason */}
                              {app.status === 'rejected' && app.rejection_reason && (
                                <div className="mt-3 p-3 rounded-xl bg-red-500/10 border border-red-500/20">
                                  <p className="text-sm text-red-300 flex items-start gap-2">
                                    <AlertCircle className="h-4 w-4 mt-0.5 flex-shrink-0" />
                                    {app.rejection_reason}
                                  </p>
                                </div>
                              )}
                            </div>
                          </div>

                          {/* Right side - CTA */}
                          <div className="flex flex-col items-end gap-3">
                            <span className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold transition-all duration-300 group-hover:gap-3 ${
                              cardStyle.accent === 'green' ? 'bg-gradient-to-r from-green-500 to-emerald-500 text-white shadow-lg shadow-green-500/30' :
                              cardStyle.accent === 'purple' ? 'bg-gradient-to-r from-purple-500 to-pink-500 text-white shadow-lg shadow-purple-500/30' :
                              cardStyle.accent === 'orange' ? 'bg-gradient-to-r from-orange-500 to-yellow-500 text-white shadow-lg shadow-orange-500/30' :
                              cardStyle.accent === 'yellow' ? 'bg-gradient-to-r from-yellow-500 to-amber-500 text-white shadow-lg shadow-yellow-500/30' :
                              'bg-gradient-to-r from-cyan-500 to-purple-600 text-white shadow-lg shadow-cyan-500/30'
                            }`}>
                              View Details
                              <ArrowRight className="h-4 w-4" />
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </Link>
                )
              })}
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* Tips Card - Only show if active applications */}
      {activeApps.length > 0 && (
        <div className="rounded-2xl bg-gradient-to-r from-cyan-500/10 via-purple-500/10 to-pink-500/10 border-2 border-cyan-500/20 p-6">
          <h3 className="text-lg font-black text-white mb-3 flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-cyan-400" />
            Pro Tips
          </h3>
          <ul className="space-y-2 text-gray-300 text-sm">
            <li className="flex items-start gap-2">
              <CheckCircle className="h-4 w-4 text-green-400 mt-0.5 flex-shrink-0" />
              Keep your profile and resume updated for faster screening
            </li>
            <li className="flex items-start gap-2">
              <CheckCircle className="h-4 w-4 text-green-400 mt-0.5 flex-shrink-0" />
              Respond promptly to interview invitations
            </li>
            <li className="flex items-start gap-2">
              <CheckCircle className="h-4 w-4 text-green-400 mt-0.5 flex-shrink-0" />
              Check your email regularly for updates from recruiters
            </li>
            <li className="flex items-start gap-2">
              <CheckCircle className="h-4 w-4 text-green-400 mt-0.5 flex-shrink-0" />
              Apply to multiple jobs to increase your chances
            </li>
          </ul>
        </div>
      )}
    </div>
  )
}

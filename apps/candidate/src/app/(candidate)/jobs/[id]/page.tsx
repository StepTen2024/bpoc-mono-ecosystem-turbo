'use client'

import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { useAuth } from '@/contexts/AuthContext'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import {
  ArrowLeft,
  Briefcase,
  Clock,
  Building2,
  Loader2,
  DollarSign,
  Star,
  CheckCircle,
  AlertCircle,
  MapPin,
  Users,
  Calendar,
  Send,
  Heart,
  Share2,
  GraduationCap,
  Home,
  Sun,
  Moon,
  Flame,
  Sparkles,
  BadgeCheck,
  ArrowRight
} from 'lucide-react'
import Link from 'next/link'
import { toast } from 'sonner'

interface Job {
  id: string
  title: string
  slug: string
  company: string
  company_logo?: string
  industry?: string
  description: string
  requirements: string[]
  responsibilities: string[]
  benefits: string[]
  salary_min?: number
  salary_max?: number
  currency: string
  work_arrangement: string
  work_type: string
  shift: string
  experience_level?: string
  skills: string[]
  posted_at: string
  match_score?: number
  match_reasons?: string[]
  match_concerns?: string[]
}

function formatWorkArrangement(value: string): string {
  const map: Record<string, string> = {
    'remote': 'Work From Home',
    'onsite': 'Office-Based',
    'hybrid': 'Hybrid (Office + WFH)',
  }
  return map[value] || value
}

function formatShift(value: string): string {
  const map: Record<string, string> = {
    'day': 'Day Shift',
    'night': 'Night Shift (US Hours)',
    'flexible': 'Flexible Hours',
    'both': 'Rotating Shifts',
  }
  return map[value] || value
}

function formatExperience(value: string): string {
  const map: Record<string, string> = {
    'entry_level': 'Entry Level (0-2 years)',
    'mid_level': 'Mid Level (2-5 years)',
    'senior_level': 'Senior Level (5+ years)',
  }
  return map[value] || value
}

function timeAgo(dateString: string): string {
  const date = new Date(dateString)
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24))
  
  if (diffDays === 0) return 'Today'
  if (diffDays === 1) return 'Yesterday'
  if (diffDays < 7) return `${diffDays} days ago`
  if (diffDays < 30) return `${Math.floor(diffDays / 7)} weeks ago`
  return `${Math.floor(diffDays / 30)} months ago`
}

export default function JobDetailPage() {
  const params = useParams()
  const router = useRouter()
  const { user, session } = useAuth()
  const jobId = params.id as string

  const [loading, setLoading] = useState(true)
  const [applying, setApplying] = useState(false)
  const [job, setJob] = useState<Job | null>(null)
  const [hasApplied, setHasApplied] = useState(false)
  const [saved, setSaved] = useState(false)

  // Determine color scheme based on match score
  const isHotMatch = job?.match_score && job.match_score >= 85
  const isGoodMatch = job?.match_score && job.match_score >= 70

  useEffect(() => {
    fetchJob()
    if (user) {
      checkApplication()
    }
  }, [jobId, user])

  const fetchJob = async () => {
    try {
      const res = await fetch(`/api/candidate/jobs/${jobId}`)
      if (!res.ok) throw new Error('Job not found')
      const data = await res.json()
      setJob(data.job)
    } catch (err) {
      console.error('Error fetching job:', err)
      toast.error('Failed to load job details')
    } finally {
      setLoading(false)
    }
  }

  const checkApplication = async () => {
    try {
      const res = await fetch(`/api/candidate/applications/check?jobId=${jobId}`)
      const data = await res.json()
      setHasApplied(data.hasApplied)
    } catch (err) {
      console.error('Error checking application:', err)
    }
  }

  const handleApply = async () => {
    if (!user || !session?.access_token) {
      router.push('/auth/login?redirect=' + encodeURIComponent('/jobs/' + jobId))
      return
    }

    setApplying(true)
    try {
      const res = await fetch('/api/candidate/applications', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ jobId }),
      })

      const data = await res.json()

      if (!res.ok) {
        throw new Error(data.error || 'Failed to apply')
      }

      setHasApplied(true)
      toast.success('Application submitted! You\'ll hear back soon.')
      
      setTimeout(() => {
        router.push('/applications')
      }, 2000)

    } catch (err: any) {
      console.error('Error applying:', err)
      toast.error(err.message || 'Failed to submit application')
    } finally {
      setApplying(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className={`h-8 w-8 animate-spin ${isHotMatch ? 'text-orange-400' : 'text-cyan-400'}`} />
      </div>
    )
  }

  if (!job) {
    return (
      <div className="text-center py-12">
        <AlertCircle className="h-12 w-12 text-red-400 mx-auto mb-4" />
        <h2 className="text-xl font-semibold text-white mb-2">Job Not Found</h2>
        <p className="text-gray-400 mb-4">This job may have been removed or is no longer available.</p>
        <Link href="/jobs">
          <Button variant="outline" className="border-white/20">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Jobs
          </Button>
        </Link>
      </div>
    )
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Back Button */}
      <Link href="/jobs" className={`inline-flex items-center transition-colors ${
        isHotMatch ? 'text-gray-400 hover:text-orange-400' : 'text-gray-400 hover:text-cyan-400'
      }`}>
        <ArrowLeft className="h-4 w-4 mr-2" />
        Back to Jobs
      </Link>

      {/* Header Card */}
      <div className={`relative overflow-hidden rounded-2xl ${
        isHotMatch 
          ? 'bg-gradient-to-br from-orange-500/10 via-red-500/5 to-purple-500/10 border-2 border-orange-500/30 shadow-[0_0_30px_-5px_rgba(249,115,22,0.4)]'
          : isGoodMatch
          ? 'bg-gradient-to-br from-cyan-500/10 via-blue-500/5 to-purple-500/10 border-2 border-cyan-500/30 shadow-[0_0_30px_-5px_rgba(6,182,212,0.3)]'
          : 'bg-gradient-to-br from-white/[0.06] to-white/[0.02] border border-white/10'
      }`}>
        {/* Hot Match Ribbon */}
        {isHotMatch && (
          <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-orange-500 via-red-500 to-pink-500" />
        )}

        <div className="p-6 md:p-8">
          <div className="flex flex-col md:flex-row md:items-start justify-between gap-6">
            <div className="flex items-start gap-4">
              {/* Company Logo */}
              <div className="relative">
                <div className={`w-20 h-20 rounded-2xl flex items-center justify-center ${
                  isHotMatch
                    ? 'bg-gradient-to-br from-orange-500/30 to-red-500/30 border-2 border-orange-500/40'
                    : 'bg-gradient-to-br from-cyan-500/20 to-purple-500/20 border border-white/20'
                }`}>
                  {job.company_logo ? (
                    <img src={job.company_logo} alt="" className="h-12 w-12 object-contain" />
                  ) : (
                    <Building2 className={`h-10 w-10 ${isHotMatch ? 'text-orange-400' : 'text-cyan-400'}`} />
                  )}
                </div>
                <div className="absolute -bottom-1 -right-1 w-6 h-6 bg-gradient-to-r from-green-400 to-emerald-500 rounded-full border-2 border-[#0B0B0D] flex items-center justify-center shadow-lg shadow-green-500/50">
                  <BadgeCheck className="h-3.5 w-3.5 text-white" />
                </div>
              </div>

              <div>
                <h1 className="text-2xl md:text-3xl font-black text-white">{job.title}</h1>
                <p className="text-gray-400 mt-1 flex items-center gap-2">
                  <span className="font-medium text-lg">{job.company}</span>
                  {job.industry && (
                    <>
                      <span className={`w-1.5 h-1.5 rounded-full ${isHotMatch ? 'bg-orange-500' : 'bg-cyan-500'}`} />
                      <span className="text-gray-500">{job.industry}</span>
                    </>
                  )}
                </p>
                <p className="text-sm text-gray-500 mt-2">Posted {timeAgo(job.posted_at)}</p>
              </div>
            </div>

            {/* Match Score Badge */}
            {job.match_score !== null && job.match_score !== undefined && (
              <div className={`flex items-center gap-2 px-5 py-3 rounded-2xl font-black text-lg ${
                isHotMatch 
                  ? 'bg-gradient-to-r from-orange-500 to-red-500 text-white shadow-lg shadow-orange-500/50' 
                  : isGoodMatch 
                  ? 'bg-gradient-to-r from-cyan-500 to-blue-500 text-white shadow-lg shadow-cyan-500/50' 
                  : 'bg-white/10 text-gray-300'
              }`}>
                {isHotMatch ? (
                  <Flame className="h-6 w-6" />
                ) : isGoodMatch ? (
                  <Sparkles className="h-6 w-6" />
                ) : (
                  <Star className="h-6 w-6" />
                )}
                <span>{job.match_score}% Match</span>
              </div>
            )}
          </div>

          {/* Salary - Big and Bold */}
          {(job.salary_min || job.salary_max) && (
            <div className="mt-6 p-5 rounded-2xl bg-gradient-to-r from-green-500/20 via-emerald-500/10 to-transparent border border-green-500/30 shadow-inner">
              <p className="text-[10px] text-green-300 mb-1 uppercase tracking-widest font-bold">Monthly Salary</p>
              <p className="text-3xl font-black bg-gradient-to-r from-green-400 to-emerald-300 bg-clip-text text-transparent">
                ₱{job.salary_min?.toLocaleString()} - ₱{job.salary_max?.toLocaleString()}
              </p>
            </div>
          )}

          {/* Quick Info Tags */}
          <div className="flex flex-wrap gap-3 mt-6">
            <span className={`inline-flex items-center gap-2 px-5 py-3 rounded-xl text-sm font-bold border shadow-sm ${
              isHotMatch 
                ? 'bg-gradient-to-r from-orange-500/20 to-red-500/20 text-orange-300 border-orange-500/30'
                : 'bg-gradient-to-r from-cyan-500/20 to-blue-500/20 text-cyan-300 border-cyan-500/30'
            }`}>
              {job.work_arrangement === 'remote' ? <Home className="h-5 w-5" /> : <Building2 className="h-5 w-5" />}
              {formatWorkArrangement(job.work_arrangement)}
            </span>
            <span className="inline-flex items-center gap-2 px-5 py-3 rounded-xl bg-gradient-to-r from-purple-500/20 to-pink-500/20 text-purple-300 text-sm font-bold border border-purple-500/30 shadow-sm">
              {job.shift === 'day' ? <Sun className="h-5 w-5" /> : job.shift === 'night' ? <Moon className="h-5 w-5" /> : <Clock className="h-5 w-5" />}
              {formatShift(job.shift)}
            </span>
            {job.experience_level && (
              <span className="inline-flex items-center gap-2 px-5 py-3 rounded-xl bg-white/5 text-gray-300 text-sm font-medium border border-white/10">
                <GraduationCap className="h-5 w-5" />
                {formatExperience(job.experience_level)}
              </span>
            )}
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-3 mt-6">
            {hasApplied ? (
              <div className="flex items-center gap-2 px-6 py-3 rounded-xl bg-gradient-to-r from-green-500/20 to-emerald-500/20 text-green-400 border border-green-500/30 shadow-lg shadow-green-500/20">
                <CheckCircle className="h-5 w-5" />
                <span className="font-bold">Already Applied</span>
              </div>
            ) : (
              <Button 
                onClick={handleApply}
                disabled={applying}
                size="lg"
                className={`px-8 font-bold shadow-lg ${
                  isHotMatch
                    ? 'bg-gradient-to-r from-orange-500 to-red-500 hover:from-orange-600 hover:to-red-600 text-white shadow-orange-500/30'
                    : 'bg-gradient-to-r from-cyan-500 to-purple-600 hover:from-cyan-600 hover:to-purple-700 text-white shadow-cyan-500/30'
                }`}
              >
                {applying ? (
                  <>
                    <Loader2 className="h-5 w-5 mr-2 animate-spin" />
                    Applying...
                  </>
                ) : (
                  <>
                    <Send className="h-5 w-5 mr-2" />
                    Apply Now
                  </>
                )}
              </Button>
            )}
            <Button 
              variant="outline" 
              size="lg"
              onClick={() => setSaved(!saved)}
              className={`border-2 ${
                saved 
                  ? 'bg-gradient-to-r from-pink-500/30 to-red-500/30 text-pink-400 border-pink-500/30 shadow-lg shadow-pink-500/30' 
                  : 'bg-white/5 text-gray-400 border-white/10 hover:bg-pink-500/20 hover:text-pink-400 hover:border-pink-500/30'
              }`}
            >
              <Heart className={`h-5 w-5 ${saved ? 'fill-current' : ''}`} />
            </Button>
            <Button variant="outline" size="lg" className="border-white/10 bg-white/5 text-gray-400 hover:bg-white/10">
              <Share2 className="h-5 w-5" />
            </Button>
          </div>
        </div>
      </div>

      {/* Match Insights */}
      {job.match_score !== null && (job.match_reasons?.length || job.match_concerns?.length) && (
        <div className={`rounded-2xl p-6 ${
          isHotMatch 
            ? 'bg-gradient-to-r from-orange-500/10 to-transparent border-2 border-orange-500/20' 
            : 'bg-gradient-to-r from-cyan-500/10 to-transparent border-2 border-cyan-500/20'
        }`}>
          <h2 className={`text-lg font-black mb-4 flex items-center gap-2 ${
            isHotMatch ? 'text-orange-400' : 'text-cyan-400'
          }`}>
            {isHotMatch ? <Flame className="h-5 w-5" /> : <Sparkles className="h-5 w-5" />}
            Why You're a Great Match
          </h2>
          <div className="grid md:grid-cols-2 gap-6">
            {job.match_reasons && job.match_reasons.length > 0 && (
              <div className="space-y-3">
                <p className={`text-[10px] uppercase tracking-widest font-bold ${
                  isHotMatch ? 'text-orange-300' : 'text-cyan-300'
                }`}>Your Strengths</p>
                {job.match_reasons.map((reason, idx) => (
                  <div key={idx} className="flex items-start gap-3 text-green-400">
                    <CheckCircle className="h-5 w-5 mt-0.5 flex-shrink-0" />
                    <span className="text-sm text-gray-300">{reason}</span>
                  </div>
                ))}
              </div>
            )}
            {job.match_concerns && job.match_concerns.length > 0 && (
              <div className="space-y-3">
                <p className="text-[10px] text-gray-400 uppercase tracking-widest font-bold">Areas to Highlight</p>
                {job.match_concerns.map((concern, idx) => (
                  <div key={idx} className="flex items-start gap-3 text-yellow-400">
                    <AlertCircle className="h-5 w-5 mt-0.5 flex-shrink-0" />
                    <span className="text-sm text-gray-300">{concern}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Job Description */}
      <div className="rounded-2xl bg-white/[0.03] border border-white/10 p-6">
        <h2 className="text-lg font-black text-white mb-4">About This Role</h2>
        <div className="prose prose-invert max-w-none">
          <p className="text-gray-300 whitespace-pre-wrap leading-relaxed">{job.description}</p>
        </div>
      </div>

      {/* Requirements */}
      {job.requirements && (Array.isArray(job.requirements) ? job.requirements.length > 0 : job.requirements) && (
        <div className="rounded-2xl bg-white/[0.03] border border-white/10 p-6">
          <h2 className="text-lg font-black text-white mb-4">Requirements</h2>
          {Array.isArray(job.requirements) ? (
            <ul className="space-y-3">
              {job.requirements.map((req, idx) => (
                <li key={idx} className="flex items-start gap-3 text-gray-300">
                  <CheckCircle className={`h-5 w-5 mt-0.5 flex-shrink-0 ${isHotMatch ? 'text-orange-400' : 'text-cyan-400'}`} />
                  <span>{req}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-gray-300 whitespace-pre-wrap">{job.requirements}</p>
          )}
        </div>
      )}

      {/* Responsibilities */}
      {job.responsibilities && (Array.isArray(job.responsibilities) ? job.responsibilities.length > 0 : job.responsibilities) && (
        <div className="rounded-2xl bg-white/[0.03] border border-white/10 p-6">
          <h2 className="text-lg font-black text-white mb-4">What You'll Do</h2>
          {Array.isArray(job.responsibilities) ? (
            <ul className="space-y-3">
              {job.responsibilities.map((resp, idx) => (
                <li key={idx} className="flex items-start gap-3 text-gray-300">
                  <Briefcase className={`h-5 w-5 mt-0.5 flex-shrink-0 ${isHotMatch ? 'text-orange-400' : 'text-purple-400'}`} />
                  <span>{resp}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-gray-300 whitespace-pre-wrap">{job.responsibilities}</p>
          )}
        </div>
      )}

      {/* Benefits */}
      {job.benefits && job.benefits.length > 0 && (
        <div className="rounded-2xl bg-gradient-to-br from-green-500/10 to-emerald-500/5 border-2 border-green-500/20 p-6">
          <h2 className="text-lg font-black text-white mb-4">Benefits & Perks</h2>
          <div className="flex flex-wrap gap-2">
            {job.benefits.map((benefit, idx) => (
              <span key={idx} className="px-4 py-2 rounded-xl bg-green-500/20 text-green-400 border border-green-500/30 text-sm font-medium">
                {benefit}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Skills */}
      {job.skills && job.skills.length > 0 && (
        <div className="rounded-2xl bg-white/[0.03] border border-white/10 p-6">
          <h2 className="text-lg font-black text-white mb-4">Required Skills</h2>
          <div className="flex flex-wrap gap-2">
            {job.skills.map((skill, idx) => (
              <span key={idx} className={`px-4 py-2 rounded-xl text-sm font-medium border ${
                isHotMatch
                  ? 'bg-orange-500/10 text-orange-400 border-orange-500/20'
                  : 'bg-cyan-500/10 text-cyan-400 border-cyan-500/20'
              }`}>
                {skill}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Bottom Apply CTA */}
      <div className={`rounded-2xl p-6 text-center ${
        isHotMatch
          ? 'bg-gradient-to-r from-orange-500/20 via-red-500/10 to-purple-500/20 border-2 border-orange-500/30'
          : 'bg-gradient-to-r from-cyan-500/20 via-blue-500/10 to-purple-500/20 border-2 border-cyan-500/30'
      }`}>
        <h3 className="text-xl font-black text-white mb-2">Ready to Apply?</h3>
        <p className="text-gray-400 mb-4">
          {hasApplied 
            ? "You've already applied! Track your application in the Applications page."
            : "Don't miss out on this opportunity. Apply now and take the next step in your career!"
          }
        </p>
        {hasApplied ? (
          <Link href="/applications">
            <Button size="lg" className="bg-white/10 hover:bg-white/20 font-bold">
              View My Applications
              <ArrowRight className="h-5 w-5 ml-2" />
            </Button>
          </Link>
        ) : (
          <Button 
            onClick={handleApply}
            disabled={applying}
            size="lg"
            className={`px-12 font-bold shadow-lg ${
              isHotMatch
                ? 'bg-gradient-to-r from-orange-500 to-red-500 hover:from-orange-600 hover:to-red-600 text-white shadow-orange-500/30'
                : 'bg-gradient-to-r from-cyan-500 to-purple-600 hover:from-cyan-600 hover:to-purple-700 text-white shadow-cyan-500/30'
            }`}
          >
            {applying ? (
              <>
                <Loader2 className="h-5 w-5 mr-2 animate-spin" />
                Applying...
              </>
            ) : (
              <>
                <Send className="h-5 w-5 mr-2" />
                Apply Now
              </>
            )}
          </Button>
        )}
      </div>
    </div>
  )
}

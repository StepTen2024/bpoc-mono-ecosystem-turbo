'use client'

import { motion, useInView, AnimatePresence } from 'framer-motion'
import { useRouter, useSearchParams } from 'next/navigation'
import { useAuth } from '@/contexts/AuthContext'
import { useState, useEffect, useRef, Suspense } from 'react'
import Header from '@/components/shared/layout/Header'
import { Button } from '@/components/shared/ui/button'
import { Badge } from '@/components/shared/ui/badge'
import {
  ArrowRight,
  ChevronLeft,
  ChevronRight,
  FileText,
  Mail,
  Zap,
  DollarSign,
  Linkedin,
  Target,
  Star,
  CheckCircle,
  Sparkles,
  Users,
  Briefcase,
  TrendingUp,
  Building2,
  MapPin,
  Clock
} from 'lucide-react'
import Link from 'next/link'

// Activity interface
interface Activity {
  name: string
  action: string
  detail: string
  emoji: string
  avatar: string
}

// Tool cards data
const tools = [
  {
    icon: FileText,
    title: 'AI Resume Builder',
    description: 'Create professional resumes in 5 minutes',
    tags: ['AI-Powered', 'Free Forever'],
    link: '/try-resume-builder',
    gradient: 'from-cyan-500 to-blue-600'
  },
  {
    icon: Mail,
    title: 'Email Signature Generator',
    description: 'Professional signatures for Gmail, Outlook',
    tags: ['Copy & Paste', 'Mobile Friendly'],
    link: '/tools/email-signature',
    gradient: 'from-purple-500 to-pink-600'
  },
  {
    icon: DollarSign,
    title: 'BPO Salary Calculator',
    description: 'Know your worth in the job market',
    tags: ['Updated 2026', 'Career Roadmap'],
    link: '/tools/salary-calculator',
    gradient: 'from-green-500 to-emerald-600'
  },
  {
    icon: Linkedin,
    title: 'LinkedIn Profile Optimizer',
    description: 'AI tips to improve your LinkedIn',
    tags: ['AI Analysis', 'Instant Results'],
    link: '/tools/linkedin-optimizer',
    gradient: 'from-blue-600 to-indigo-600'
  },
  {
    icon: Target,
    title: 'Skills Gap Analyzer',
    description: 'See what you need for your dream job',
    tags: ['Career Path', 'Free Courses'],
    link: '/tools/skills-gap',
    gradient: 'from-red-500 to-rose-600'
  }
]

// Stats data - will be populated with real data from API
const defaultStats = [
  { icon: Users, value: 0, label: 'Job Seekers', prefix: '' },
  { icon: FileText, value: 0, label: 'Resumes Analyzed', prefix: '' },
  { icon: CheckCircle, value: 0, label: 'Candidates Placed', prefix: '' },
  { icon: Briefcase, value: 0, label: 'Active Jobs', prefix: '' }
]

// Testimonials data
const testimonials = [
  {
    name: 'Lainie',
    avatar: '/images/testimonials/Lainie.png',
    role: 'Customer Service Rep',
    company: 'Hired at ₱24k/month',
    rating: 5,
    text: 'A great place to work. Work-life balance, we only work 5 days a week, co-employees are friendly and have a healthy environment.'
  },
  {
    name: 'Rikki',
    avatar: '/images/testimonials/Rikki.png',
    role: 'Technical Support',
    company: 'Hired at ₱26k/month',
    rating: 5,
    text: 'Excellent company for those seeking a healthy work-life balance. There are numerous activities that you will undoubtedly appreciate. Strongly recommended! ❤️'
  },
  {
    name: 'Dana',
    avatar: '/images/testimonials/Dana.png',
    role: 'Sales Representative',
    company: 'Hired at ₱28k/month',
    rating: 5,
    text: 'This is not only a company but it is a family. They are truly heart warming, happy environment plus lots of fun activities that make sure you have work life balance!'
  },
  {
    name: 'Arra',
    avatar: '/images/testimonials/Arra.png',
    role: 'Data Entry Specialist',
    company: 'Hired at ₱22k/month',
    rating: 5,
    text: 'I enjoy working in the company; people are good, there are lots of goodies, and they encourage you to do better and work outside your comfort zone. 🥰'
  },
  {
    name: 'Kevin',
    avatar: '/images/testimonials/Kevin.png',
    role: 'Account Manager',
    company: 'Hired at ₱30k/month',
    rating: 5,
    text: 'Highly recommended! Admins are very nice and approachable. They give out free pizza, burgers, cupcakes, and more every now and then to make sure staff are appreciated.'
  },
  {
    name: 'Crizza',
    avatar: '/images/testimonials/Crizza.png',
    role: 'Quality Analyst',
    company: 'Hired at ₱25k/month',
    rating: 5,
    text: 'This is a less stress workplace, you only have 8-9 hours of stress, 5 days of the week—work life balance—a place where you can enhance your knowledge and grow your skills!'
  }
]

// Sample featured jobs
const featuredJobs = [
  {
    id: 1,
    title: 'Customer Service Representative',
    company: 'TechSupport Global',
    location: 'Manila',
    salaryMin: 22000,
    salaryMax: 28000,
    requirements: ['3+ years experience', 'Fluent English', 'Night shift'],
    logo: '🏢'
  },
  {
    id: 2,
    title: 'Technical Support Specialist',
    company: 'CloudTech Solutions',
    location: 'Makati',
    salaryMin: 25000,
    salaryMax: 32000,
    requirements: ['2+ years experience', 'Technical background', 'Day shift'],
    logo: '💻'
  },
  {
    id: 3,
    title: 'Sales Development Representative',
    company: 'SalesForce Inc',
    location: 'BGC',
    salaryMin: 28000,
    salaryMax: 35000,
    requirements: ['Sales experience', 'Excellent communication', 'Flexible shift'],
    logo: '📊'
  }
]

// Animated counter component
function AnimatedCounter({ value, inView }: { value: number; inView: boolean }) {
  const [count, setCount] = useState(0)

  useEffect(() => {
    if (!inView) return

    let start = 0
    const end = value
    const duration = 2000
    const increment = end / (duration / 16)

    const timer = setInterval(() => {
      start += increment
      if (start >= end) {
        setCount(end)
        clearInterval(timer)
      } else {
        setCount(Math.floor(start))
      }
    }, 16)

    return () => clearInterval(timer)
  }, [inView, value])

  return <span>{count.toLocaleString()}</span>
}

// Live Activity Feed Component
function LiveActivityFeed() {
  const [currentActivity, setCurrentActivity] = useState(0)
  const [isVisible, setIsVisible] = useState(true)
  const [activities, setActivities] = useState<Activity[]>([])
  const [isLoading, setIsLoading] = useState(true)

  // Fetch real activity data from API
  useEffect(() => {
    const fetchActivities = async () => {
      try {
        const response = await fetch('/api/live-activity')
        const data = await response.json()

        if (data.activities && data.activities.length > 0) {
          setActivities(data.activities)
        }
      } catch (error) {
        console.error('Failed to fetch live activity:', error)
      } finally {
        setIsLoading(false)
      }
    }

    fetchActivities()

    // Refresh activity feed every 30 seconds
    const refreshInterval = setInterval(fetchActivities, 30000)
    return () => clearInterval(refreshInterval)
  }, [])

  // Cycle through activities
  useEffect(() => {
    if (activities.length === 0) return

    const showDuration = 4000
    const hideDuration = 2000

    const cycle = () => {
      setIsVisible(false)

      setTimeout(() => {
        setCurrentActivity((prev) => (prev + 1) % activities.length)
        setIsVisible(true)
      }, hideDuration)
    }

    const interval = setInterval(cycle, showDuration + hideDuration)
    return () => clearInterval(interval)
  }, [activities.length])

  // Don't show anything if loading or no activities
  if (isLoading || activities.length === 0) {
    return null
  }

  const activity = activities[currentActivity]

  return (
    <AnimatePresence mode="wait">
      {isVisible && (
        <motion.div
          key={currentActivity}
          initial={{ x: -400, opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          exit={{ x: -400, opacity: 0 }}
          transition={{ duration: 0.4, ease: 'easeOut' }}
          className="fixed bottom-6 left-6 z-50 max-w-sm"
        >
          <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-2xl border border-gray-200 dark:border-gray-800 p-4 backdrop-blur-xl bg-opacity-95">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-full bg-gradient-to-br from-cyan-500 to-purple-600 flex items-center justify-center text-white font-bold text-sm flex-shrink-0">
                {activity.avatar}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm text-gray-900 dark:text-gray-100 font-medium truncate">
                  <span className="font-bold">{activity.name}</span> {activity.action}
                </p>
                {activity.detail && (
                  <p className="text-xs text-cyan-600 dark:text-cyan-400 font-semibold">
                    {activity.detail}
                  </p>
                )}
              </div>
              <div className="text-2xl flex-shrink-0">
                {activity.emoji}
              </div>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}

function HomePageContent() {
  const router = useRouter()
  const { user } = useAuth()
  const [currentTestimonial, setCurrentTestimonial] = useState(0)
  const statsRef = useRef(null)
  const statsInView = useInView(statsRef, { once: true })
  const [particles, setParticles] = useState<Array<{ left: number; top: number }>>([])
  const [stats, setStats] = useState(defaultStats)

  // Generate particles only on client side to avoid hydration mismatch
  useEffect(() => {
    setParticles(
      Array.from({ length: 20 }, () => ({
        left: Math.random() * 100,
        top: Math.random() * 100,
      }))
    )
  }, [])

  // Fetch real platform stats
  useEffect(() => {
    const fetchStats = async () => {
      try {
        const response = await fetch('/api/marketing/stats')
        const data = await response.json()

        if (data.stats) {
          // Update stats with real data
          setStats([
            { icon: Users, value: data.stats.totalCandidates, label: 'Job Seekers', prefix: '' },
            { icon: FileText, value: data.stats.resumesAnalyzed, label: 'Resumes Analyzed', prefix: '' },
            { icon: CheckCircle, value: data.stats.candidatesHired, label: 'Candidates Placed', prefix: '' },
            { icon: Briefcase, value: data.stats.activeJobs, label: 'Active Jobs', prefix: '' }
          ])
        }
      } catch (error) {
        console.error('Failed to fetch platform stats:', error)
        // Keep default stats on error
      }
    }

    fetchStats()
  }, [])

  // Auto-play testimonials
  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentTestimonial((prev) => (prev + 1) % testimonials.length)
    }, 5000)
    return () => clearInterval(interval)
  }, [])

  const visibleTestimonials = 3
  const startIdx = currentTestimonial
  const displayTestimonials = testimonials.slice(startIdx, startIdx + visibleTestimonials)

  // Wrap around if needed
  if (displayTestimonials.length < visibleTestimonials) {
    displayTestimonials.push(...testimonials.slice(0, visibleTestimonials - displayTestimonials.length))
  }

  return (
    <>
      <Header />
      <LiveActivityFeed />

      <main className="min-h-screen bg-black text-white">
        {/* HERO SECTION */}
        <section className="relative min-h-screen flex items-center justify-center overflow-hidden bg-black">
          {/* Animated gradient background */}
          <div className="absolute inset-0 bg-gradient-to-br from-cyan-950 via-purple-950 to-black opacity-70" />

          {/* Animated grid - more visible */}
          <div className="absolute inset-0 bg-[linear-gradient(rgba(6,182,212,0.15)_2px,transparent_2px),linear-gradient(90deg,rgba(6,182,212,0.15)_2px,transparent_2px)] bg-[size:80px_80px] [mask-image:radial-gradient(ellipse_80%_80%_at_50%_50%,black,transparent)]" />

          {/* Radial gradient overlay for depth */}
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_0%,black_100%)]" />

          {/* Glowing orbs */}
          <motion.div
            animate={{
              scale: [1, 1.2, 1],
              opacity: [0.3, 0.5, 0.3],
              x: [0, 50, 0],
              y: [0, -50, 0],
            }}
            transition={{
              duration: 8,
              repeat: Infinity,
              ease: 'easeInOut',
            }}
            className="absolute top-1/4 left-1/4 w-[600px] h-[600px] bg-cyan-500 rounded-full blur-[150px]"
          />
          <motion.div
            animate={{
              scale: [1.2, 1, 1.2],
              opacity: [0.3, 0.5, 0.3],
              x: [0, -50, 0],
              y: [0, 50, 0],
            }}
            transition={{
              duration: 10,
              repeat: Infinity,
              ease: 'easeInOut',
            }}
            className="absolute bottom-1/4 right-1/4 w-[600px] h-[600px] bg-purple-600 rounded-full blur-[150px]"
          />

          {/* Floating particles - client-only to avoid hydration mismatch */}
          {particles.map((particle, i) => (
            <motion.div
              key={i}
              className="absolute w-2 h-2 bg-cyan-400/30 rounded-full"
              style={{
                left: `${particle.left}%`,
                top: `${particle.top}%`,
              }}
              animate={{
                y: [0, -100, 0],
                opacity: [0, 0.5, 0],
                scale: [0, 1.5, 0],
              }}
              transition={{
                duration: 5 + (i % 5),
                repeat: Infinity,
                delay: i * 0.25,
                ease: 'easeInOut',
              }}
            />
          ))}

          <div className="relative z-10 container mx-auto px-4 py-32 text-center">
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, ease: 'easeOut' }}
            >
              <Badge className="mb-6 text-sm px-4 py-2 bg-gradient-to-r from-cyan-500/20 to-purple-500/20 border-cyan-500/30 text-cyan-300 hover:bg-cyan-500/30">
                <Sparkles className="w-4 h-4 mr-2 inline" />
                AI-Powered Job Matching
              </Badge>

              <motion.h1
                className="text-3xl sm:text-4xl md:text-7xl lg:text-8xl xl:text-9xl font-black mb-6 leading-[0.9]"
                initial={{ scale: 0.9 }}
                animate={{ scale: 1 }}
                transition={{ duration: 0.5, ease: 'easeOut' }}
              >
                <span className="bg-gradient-to-r from-cyan-400 via-purple-400 to-pink-400 bg-clip-text text-transparent drop-shadow-[0_0_80px_rgba(6,182,212,0.5)]">
                  Land Your Dream
                </span>
                <br />
                <span className="text-white drop-shadow-[0_0_40px_rgba(168,85,247,0.3)]">
                  BPO Job in 2026
                </span>
              </motion.h1>

              <motion.p
                className="text-lg sm:text-xl md:text-3xl text-gray-300 mb-8 md:mb-12 max-w-3xl mx-auto font-light"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, delay: 0.2 }}
              >
                Build Your Professional Resume - <span className="font-black text-transparent bg-gradient-to-r from-cyan-400 to-purple-400 bg-clip-text">Free Forever</span>
              </motion.p>

              <motion.div
                className="flex flex-col sm:flex-row gap-6 justify-center mb-16"
                initial={{ opacity: 0, y: 30 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, delay: 0.4 }}
              >
                <Link href="/try-resume-builder">
                  <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
                    <Button size="lg" className="text-base sm:text-lg md:text-xl px-6 sm:px-8 md:px-12 py-4 sm:py-6 md:py-8 bg-gradient-to-r from-cyan-500 to-purple-600 hover:from-cyan-400 hover:to-purple-500 border-0 shadow-[0_0_60px_rgba(6,182,212,0.5)] hover:shadow-[0_0_100px_rgba(6,182,212,0.8)] transition-all duration-300 group rounded-2xl font-black">
                      Start Your Resume
                      <ArrowRight className="ml-3 w-6 h-6 group-hover:translate-x-2 transition-transform" />
                    </Button>
                  </motion.div>
                </Link>
                <Link href="/jobs">
                  <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
                    <Button size="lg" variant="outline" className="text-base sm:text-lg md:text-xl px-6 sm:px-8 md:px-12 py-4 sm:py-6 md:py-8 border-2 border-cyan-500/50 text-cyan-400 hover:bg-cyan-500/20 hover:border-cyan-400 hover:shadow-[0_0_40px_rgba(6,182,212,0.3)] transition-all duration-300 rounded-2xl font-bold">
                      Browse Jobs
                      <ArrowRight className="ml-3 w-6 h-6" />
                    </Button>
                  </motion.div>
                </Link>
              </motion.div>

              <div className="flex items-center justify-center gap-2 text-gray-400">
                {[...Array(5)].map((_, i) => (
                  <Star key={i} className="w-5 h-5 fill-yellow-400 text-yellow-400" />
                ))}
                <span className="ml-2 text-sm">
                  <span className="font-bold text-white">4.8/5</span> from{' '}
                  {stats[0].value > 0 ? stats[0].value.toLocaleString() : '1,000+'} job seekers
                </span>
              </div>
            </motion.div>
          </div>

          {/* Scroll indicator */}
          <motion.div
            animate={{ y: [0, 10, 0] }}
            transition={{ duration: 2, repeat: Infinity }}
            className="absolute bottom-8 left-1/2 -translate-x-1/2"
          >
            <div className="w-6 h-10 border-2 border-cyan-500/50 rounded-full flex items-start justify-center p-2">
              <motion.div
                animate={{ y: [0, 12, 0] }}
                transition={{ duration: 2, repeat: Infinity }}
                className="w-1.5 h-1.5 bg-cyan-400 rounded-full"
              />
            </div>
          </motion.div>
        </section>

        {/* FREE TOOLS SHOWCASE */}
        <section className="relative py-32 overflow-hidden">
          <div className="absolute inset-0 bg-black" />

          {/* Spotlight effect */}
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[800px] bg-cyan-500/10 rounded-full blur-[150px]" />

          <div className="relative z-10 container mx-auto px-4">
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6 }}
              className="text-center mb-20"
            >
              <Badge className="mb-6 text-sm sm:text-base md:text-lg px-4 sm:px-6 py-2 sm:py-3 bg-gradient-to-r from-cyan-500/20 to-purple-500/20 border-cyan-500/30 text-cyan-300 hover:bg-cyan-500/30">
                <Sparkles className="w-5 h-5 mr-2 inline" />
                6 Premium Tools • 100% Free
              </Badge>
              <h2 className="text-2xl sm:text-4xl md:text-6xl lg:text-7xl font-black mb-4 md:mb-6 leading-tight">
                Get Job-Ready with{' '}
                <span className="bg-gradient-to-r from-cyan-400 to-purple-400 bg-clip-text text-transparent drop-shadow-[0_0_60px_rgba(6,182,212,0.4)]">
                  Free Tools
                </span>
              </h2>
              <p className="text-base sm:text-lg md:text-2xl text-gray-400 max-w-3xl mx-auto leading-relaxed">
                Everything you need to stand out and land your dream BPO job
              </p>
            </motion.div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 max-w-7xl mx-auto">
              {tools.map((tool, index) => (
                <motion.div
                  key={index}
                  initial={{ opacity: 0, y: 30 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.6, delay: index * 0.1 }}
                >
                  <Link href={tool.link}>
                    <motion.div
                      whileHover={{ y: -8, scale: 1.02 }}
                      transition={{ duration: 0.2 }}
                      className="relative group h-full"
                    >
                      {tool.badge && (
                        <Badge className="absolute -top-2 -right-2 z-10 bg-gradient-to-r from-yellow-500 to-orange-500 border-0 text-black font-bold">
                          {tool.badge}
                        </Badge>
                      )}

                      <div className="relative h-full bg-gradient-to-br from-gray-900/90 to-black rounded-2xl md:rounded-3xl p-5 md:p-10 border-2 border-gray-800/50 group-hover:border-cyan-500/70 transition-all duration-500 overflow-hidden shadow-[0_20px_70px_-15px_rgba(0,0,0,0.8)] group-hover:shadow-[0_30px_90px_-15px_rgba(6,182,212,0.4)]">
                        {/* Gradient glow effect */}
                        <div className={`absolute inset-0 bg-gradient-to-br ${tool.gradient} opacity-0 group-hover:opacity-25 transition-all duration-500`} />

                        {/* Animated glow on hover */}
                        <motion.div
                          className={`absolute -inset-[3px] rounded-3xl bg-gradient-to-r ${tool.gradient} opacity-0 group-hover:opacity-40 blur-2xl transition-all duration-500 -z-10`}
                        />

                        {/* Shine effect on hover */}
                        <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/5 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-1000 ease-in-out" />

                        {/* Icon */}
                        <motion.div
                          whileHover={{ rotate: [0, -10, 10, -10, 0] }}
                          transition={{ duration: 0.5 }}
                          className={`w-24 h-24 rounded-3xl bg-gradient-to-br ${tool.gradient} flex items-center justify-center mb-8 group-hover:scale-110 group-hover:shadow-[0_0_40px_rgba(6,182,212,0.5)] transition-all duration-300`}
                        >
                          <tool.icon className="w-12 h-12 text-white" />
                        </motion.div>

                        {/* Content */}
                        <h3 className="text-xl sm:text-2xl md:text-3xl font-black mb-3 md:mb-4 group-hover:text-cyan-400 transition-colors leading-tight">
                          {tool.title}
                        </h3>
                        <p className="text-gray-400 text-lg mb-8 leading-relaxed">
                          {tool.description}
                        </p>

                        {/* Tags */}
                        <div className="flex flex-wrap gap-2 mb-8">
                          {tool.tags.map((tag, i) => (
                            <motion.span
                              key={i}
                              whileHover={{ scale: 1.05 }}
                              className="text-sm px-4 py-2 rounded-full bg-gray-800/50 text-gray-300 border border-gray-700 group-hover:border-cyan-500/30 group-hover:bg-gray-800/70 transition-all"
                            >
                              {tag}
                            </motion.span>
                          ))}
                        </div>

                        {/* CTA */}
                        <div className="flex items-center text-cyan-400 text-lg font-bold group-hover:text-cyan-300 transition-colors">
                          Try Free
                          <ArrowRight className="ml-2 w-5 h-5 group-hover:translate-x-2 transition-transform" />
                        </div>
                      </div>
                    </motion.div>
                  </Link>
                </motion.div>
              ))}
            </div>
          </div>
        </section>

        {/* HOW IT WORKS */}
        <section className="relative py-24 overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-b from-black to-gray-950" />

          <div className="relative z-10 container mx-auto px-4">
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6 }}
              className="text-center mb-20"
            >
              <h2 className="text-2xl sm:text-3xl md:text-5xl lg:text-6xl font-black mb-3 md:mb-4">
                Your Path to{' '}
                <span className="bg-gradient-to-r from-cyan-400 to-purple-400 bg-clip-text text-transparent">
                  Career Success
                </span>
              </h2>
            </motion.div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-12 max-w-6xl mx-auto">
              {[
                {
                  number: '1',
                  icon: FileText,
                  title: 'Build Your Resume',
                  description: 'AI-powered resume builder creates professional resumes in 5 minutes. Get instant feedback and score.',
                  color: 'from-cyan-500 to-blue-600'
                },
                {
                  number: '2',
                  icon: Zap,
                  title: 'Get Verified',
                  description: 'Take skill tests (typing, English, etc.) to get verified badges. Stand out to recruiters.',
                  color: 'from-purple-500 to-pink-600'
                },
                {
                  number: '3',
                  icon: Target,
                  title: 'Get Hired',
                  description: 'Apply to jobs with AI matching. Our system connects you with the right opportunities.',
                  color: 'from-green-500 to-emerald-600'
                }
              ].map((step, index) => (
                <motion.div
                  key={index}
                  initial={{ opacity: 0, y: 30 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.6, delay: index * 0.2 }}
                  className="relative text-center"
                >
                  {/* Connecting line (hidden on mobile) */}
                  {index < 2 && (
                    <div className="hidden md:block absolute top-16 left-[60%] w-[80%] h-0.5 bg-gradient-to-r from-cyan-500/50 to-purple-500/50" />
                  )}

                  {/* Number badge */}
                  <div className={`w-32 h-32 mx-auto mb-6 rounded-3xl bg-gradient-to-br ${step.color} flex items-center justify-center relative group`}>
                    <div className="absolute inset-0 rounded-3xl bg-gradient-to-br from-white/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                    <step.icon className="w-16 h-16 text-white relative z-10" />
                    <div className="absolute -top-2 -right-2 w-10 h-10 rounded-full bg-white text-black font-black text-lg flex items-center justify-center shadow-lg">
                      {step.number}
                    </div>
                  </div>

                  <h3 className="text-2xl font-bold mb-4">{step.title}</h3>
                  <p className="text-gray-400 leading-relaxed">
                    {step.description}
                  </p>
                </motion.div>
              ))}
            </div>

            <motion.div
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6, delay: 0.6 }}
              className="text-center mt-16"
            >
              <Link href="/try-resume-builder">
                <Button size="lg" className="text-lg px-10 py-6 bg-gradient-to-r from-cyan-500 to-purple-600 hover:from-cyan-400 hover:to-purple-500 border-0 shadow-[0_0_40px_rgba(6,182,212,0.3)] hover:shadow-[0_0_60px_rgba(6,182,212,0.5)] transition-all duration-300">
                  Get Started Free
                  <ArrowRight className="ml-2 w-5 h-5" />
                </Button>
              </Link>
            </motion.div>
          </div>
        </section>

        {/* STATS & SOCIAL PROOF */}
        <section className="relative py-32 overflow-hidden" ref={statsRef}>
          <div className="absolute inset-0 bg-black" />

          {/* Spotlight effect for stats */}
          <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-[1000px] h-[600px] bg-gradient-to-r from-cyan-500/10 via-purple-500/10 to-pink-500/10 rounded-full blur-[150px]" />

          {/* Animated stats section */}
          <div className="relative z-10 container mx-auto px-4 mb-32">
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6 }}
              className="text-center mb-16"
            >
              <h2 className="text-2xl sm:text-3xl md:text-5xl lg:text-6xl font-black mb-3 md:mb-4">
                Trusted by{' '}
                <span className="bg-gradient-to-r from-cyan-400 to-purple-400 bg-clip-text text-transparent">
                  Thousands
                </span>
              </h2>
              <p className="text-xl text-gray-400 max-w-2xl mx-auto">
                Join the fastest-growing BPO career platform in the Philippines
              </p>
            </motion.div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-8 max-w-7xl mx-auto">
              {stats.map((stat, index) => (
                <motion.div
                  key={index}
                  initial={{ opacity: 0, scale: 0.8 }}
                  whileInView={{ opacity: 1, scale: 1 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.6, delay: index * 0.1 }}
                  whileHover={{ scale: 1.05 }}
                  className="relative text-center group"
                >
                  <div className="relative p-8 rounded-3xl bg-gradient-to-br from-gray-900/90 to-black border-2 border-gray-800/50 group-hover:border-cyan-500/70 transition-all duration-500 overflow-hidden shadow-[0_20px_70px_-15px_rgba(0,0,0,0.8)] group-hover:shadow-[0_30px_90px_-15px_rgba(6,182,212,0.5)]">
                    {/* Animated background glow */}
                    <div className="absolute inset-0 bg-gradient-to-br from-cyan-500/20 to-purple-500/20 opacity-0 group-hover:opacity-100 transition-opacity duration-500" />

                    {/* Shimmer effect */}
                    <div className="absolute inset-0 bg-gradient-to-r from-transparent via-cyan-500/10 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-1000 ease-in-out" />

                    <div className="relative z-10">
                      <div className="w-20 h-20 mx-auto mb-6 rounded-3xl bg-gradient-to-br from-cyan-500/20 to-purple-600/20 flex items-center justify-center border border-cyan-500/30 group-hover:scale-110 group-hover:shadow-[0_0_40px_rgba(6,182,212,0.4)] transition-all duration-300">
                        <stat.icon className="w-10 h-10 text-cyan-400" />
                      </div>
                      <div className="text-5xl md:text-6xl font-black mb-3 bg-gradient-to-r from-cyan-400 to-purple-400 bg-clip-text text-transparent drop-shadow-[0_0_30px_rgba(6,182,212,0.5)]">
                        <AnimatedCounter value={stat.value} inView={statsInView} />
                      </div>
                      <div className="text-gray-400 font-bold text-lg">{stat.label}</div>
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>
          </div>

          {/* Testimonials carousel */}
          <div className="relative z-10 container mx-auto px-4">
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6 }}
              className="text-center mb-20"
            >
              <Badge className="mb-6 text-sm sm:text-base md:text-lg px-4 sm:px-6 py-2 sm:py-3 bg-gradient-to-r from-green-500/20 to-emerald-500/20 border-green-500/30 text-green-300 hover:bg-green-500/30">
                <CheckCircle className="w-5 h-5 mr-2 inline" />
                Real Results • Real People
              </Badge>
              <h2 className="text-6xl md:text-7xl font-black mb-6 leading-tight">
                Success Stories from{' '}
                <span className="bg-gradient-to-r from-cyan-400 to-purple-400 bg-clip-text text-transparent drop-shadow-[0_0_60px_rgba(6,182,212,0.4)]">
                  Our Community
                </span>
              </h2>
              <p className="text-xl text-gray-400 max-w-3xl mx-auto">
                See how BPOC Careers helped thousands land their dream BPO jobs
              </p>
            </motion.div>

            <div className="relative max-w-7xl mx-auto">
              {/* Testimonials grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {displayTestimonials.map((testimonial, index) => (
                  <motion.div
                    key={`${testimonial.name}-${index}`}
                    initial={{ opacity: 0, x: 50 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -50 }}
                    transition={{ duration: 0.5, delay: index * 0.1 }}
                    className="relative bg-gradient-to-br from-gray-900/90 to-black rounded-2xl md:rounded-3xl p-5 md:p-10 border-2 border-gray-800/50 hover:border-purple-500/70 transition-all duration-500 group hover:scale-[1.03] overflow-hidden shadow-[0_20px_70px_-15px_rgba(0,0,0,0.8)] hover:shadow-[0_30px_90px_-15px_rgba(168,85,247,0.4)]"
                  >
                    {/* Animated glow on hover */}
                    <div className="absolute inset-0 bg-gradient-to-br from-purple-500/15 to-pink-500/15 opacity-0 group-hover:opacity-100 transition-opacity duration-500" />

                    {/* Shine effect */}
                    <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/5 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-1000 ease-in-out" />

                    <div className="relative z-10">
                      {/* Stars */}
                      <div className="flex gap-1 mb-6">
                        {[...Array(testimonial.rating)].map((_, i) => (
                          <motion.div
                            key={i}
                            initial={{ scale: 0 }}
                            whileInView={{ scale: 1 }}
                            transition={{ delay: i * 0.1 }}
                          >
                            <Star className="w-6 h-6 fill-yellow-400 text-yellow-400" />
                          </motion.div>
                        ))}
                      </div>

                      {/* Quote */}
                      <p className="text-gray-300 text-lg mb-8 leading-relaxed italic">
                        "{testimonial.text}"
                      </p>

                      {/* Author */}
                      <div className="flex items-center gap-5">
                        <div className="w-16 h-16 rounded-full bg-gradient-to-br from-cyan-500 to-purple-600 flex items-center justify-center text-white font-bold overflow-hidden ring-4 ring-gray-800 group-hover:ring-cyan-500/30 transition-all">
                          {testimonial.avatar ? (
                            <img src={testimonial.avatar} alt={testimonial.name} className="w-full h-full object-cover" />
                          ) : (
                            testimonial.name.substring(0, 2).toUpperCase()
                          )}
                        </div>
                        <div>
                          <div className="font-black text-white text-lg">{testimonial.name}</div>
                          <div className="text-sm text-gray-400 font-medium">{testimonial.role}</div>
                          <div className="text-xs text-cyan-400 font-bold mt-1">{testimonial.company}</div>
                        </div>
                      </div>
                    </div>
                  </motion.div>
                ))}
              </div>

              {/* Navigation */}
              <div className="flex justify-center items-center gap-4 mt-12">
                <button
                  onClick={() => setCurrentTestimonial((prev) => (prev - 1 + testimonials.length) % testimonials.length)}
                  className="w-12 h-12 rounded-full bg-gray-800 hover:bg-cyan-500/20 border border-gray-700 hover:border-cyan-500/50 flex items-center justify-center transition-all duration-300 group"
                >
                  <ChevronLeft className="w-6 h-6 text-gray-400 group-hover:text-cyan-400" />
                </button>

                <div className="flex gap-2">
                  {testimonials.map((_, index) => (
                    <button
                      key={index}
                      onClick={() => setCurrentTestimonial(index)}
                      className={`w-2 h-2 rounded-full transition-all duration-300 ${
                        index === currentTestimonial
                          ? 'w-8 bg-cyan-500'
                          : 'bg-gray-600 hover:bg-gray-500'
                      }`}
                    />
                  ))}
                </div>

                <button
                  onClick={() => setCurrentTestimonial((prev) => (prev + 1) % testimonials.length)}
                  className="w-12 h-12 rounded-full bg-gray-800 hover:bg-cyan-500/20 border border-gray-700 hover:border-cyan-500/50 flex items-center justify-center transition-all duration-300 group"
                >
                  <ChevronRight className="w-6 h-6 text-gray-400 group-hover:text-cyan-400" />
                </button>
              </div>
            </div>
          </div>
        </section>

        {/* FEATURED JOBS */}
        <section className="relative py-32 overflow-hidden">
          <div className="absolute inset-0 bg-black" />

          {/* Spotlight effect */}
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[1000px] h-[800px] bg-gradient-to-b from-blue-500/10 to-transparent rounded-full blur-[150px]" />

          <div className="relative z-10 container mx-auto px-4">
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6 }}
              className="text-center mb-20"
            >
              <Badge className="mb-6 text-sm sm:text-base md:text-lg px-4 sm:px-6 py-2 sm:py-3 bg-gradient-to-r from-blue-500/20 to-indigo-500/20 border-blue-500/30 text-blue-300 hover:bg-blue-500/30">
                <Briefcase className="w-5 h-5 mr-2 inline" />
                Hot Jobs • Apply Now
              </Badge>
              <h2 className="text-6xl md:text-7xl font-black mb-6 leading-tight">
                Latest{' '}
                <span className="bg-gradient-to-r from-cyan-400 to-purple-400 bg-clip-text text-transparent drop-shadow-[0_0_60px_rgba(6,182,212,0.4)]">
                  BPO Opportunities
                </span>
              </h2>
              <p className="text-xl text-gray-400 max-w-3xl mx-auto">
                Curated job openings from top BPO companies in the Philippines
              </p>
            </motion.div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-7xl mx-auto">
              {featuredJobs.map((job, index) => (
                <motion.div
                  key={job.id}
                  initial={{ opacity: 0, y: 30 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.6, delay: index * 0.1 }}
                  className="relative bg-gradient-to-br from-gray-900/90 to-black rounded-3xl p-8 border-2 border-gray-800/50 hover:border-blue-500/70 transition-all duration-500 group hover:scale-[1.03] overflow-hidden shadow-[0_20px_70px_-15px_rgba(0,0,0,0.8)] hover:shadow-[0_30px_90px_-15px_rgba(59,130,246,0.4)]"
                >
                  {/* Animated glow on hover */}
                  <div className="absolute inset-0 bg-gradient-to-br from-blue-500/15 to-cyan-500/15 opacity-0 group-hover:opacity-100 transition-opacity duration-500" />

                  {/* Shine effect */}
                  <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/5 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-1000 ease-in-out" />

                  <div className="relative z-10">
                    {/* Company logo */}
                    <div className="w-20 h-20 rounded-3xl bg-gradient-to-br from-cyan-500/20 to-purple-600/20 flex items-center justify-center text-4xl mb-6 border border-cyan-500/30 group-hover:scale-110 group-hover:shadow-[0_0_30px_rgba(6,182,212,0.3)] transition-all">
                      {job.logo}
                    </div>

                    {/* Job title */}
                    <h3 className="text-2xl font-black mb-3 group-hover:text-cyan-400 transition-colors leading-tight">
                      {job.title}
                    </h3>

                    {/* Company & location */}
                    <div className="flex flex-wrap items-center gap-4 text-sm text-gray-400 mb-5">
                      <div className="flex items-center gap-2">
                        <Building2 className="w-4 h-4" />
                        <span className="font-medium">{job.company}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <MapPin className="w-4 h-4" />
                        <span className="font-medium">{job.location}</span>
                      </div>
                    </div>

                    {/* Salary */}
                    <div className="text-cyan-400 font-black text-2xl mb-6 bg-cyan-500/10 rounded-2xl py-3 px-4 inline-block">
                      ₱{job.salaryMin.toLocaleString()} - ₱{job.salaryMax.toLocaleString()}/mo
                    </div>

                    {/* Requirements */}
                    <div className="space-y-3 mb-8">
                      {job.requirements.map((req, i) => (
                        <div key={i} className="flex items-center gap-3 text-sm text-gray-300">
                          <CheckCircle className="w-5 h-5 text-green-400 flex-shrink-0" />
                          <span className="font-medium">{req}</span>
                        </div>
                      ))}
                    </div>

                    {/* CTA */}
                    <Link href={`/jobs/${job.id}`}>
                      <Button className="w-full text-lg py-6 bg-gradient-to-r from-cyan-500/20 to-purple-600/20 border-2 border-cyan-500/30 hover:from-cyan-500/30 hover:to-purple-600/30 hover:border-cyan-400/50 hover:shadow-[0_0_30px_rgba(6,182,212,0.3)] transition-all duration-300 group font-bold rounded-2xl">
                        Apply Now
                        <ArrowRight className="ml-2 w-5 h-5 group-hover:translate-x-2 transition-transform" />
                      </Button>
                    </Link>
                  </div>
                </motion.div>
              ))}
            </div>

            <motion.div
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6, delay: 0.3 }}
              className="text-center mt-12"
            >
              <Link href="/jobs">
                <Button size="lg" variant="outline" className="border-2 border-cyan-500/50 text-cyan-400 hover:bg-cyan-500/10 hover:border-cyan-400 transition-all duration-300">
                  Browse All Jobs
                  <ArrowRight className="ml-2 w-5 h-5" />
                </Button>
              </Link>
            </motion.div>
          </div>
        </section>

        {/* FINAL CTA */}
        <section className="relative py-40 overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-br from-cyan-900 via-purple-900 to-pink-900" />
          <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.08)_2px,transparent_2px),linear-gradient(90deg,rgba(255,255,255,0.08)_2px,transparent_2px)] bg-[size:60px_60px]" />

          {/* Vignette effect */}
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_0%,rgba(0,0,0,0.4)_100%)]" />

          {/* Floating orbs */}
          <motion.div
            animate={{
              scale: [1, 1.3, 1],
              opacity: [0.2, 0.4, 0.2],
            }}
            transition={{
              duration: 10,
              repeat: Infinity,
              ease: 'easeInOut',
            }}
            className="absolute top-1/4 left-1/4 w-[600px] h-[600px] bg-cyan-400 rounded-full blur-[150px]"
          />
          <motion.div
            animate={{
              scale: [1.3, 1, 1.3],
              opacity: [0.2, 0.4, 0.2],
            }}
            transition={{
              duration: 12,
              repeat: Infinity,
              ease: 'easeInOut',
            }}
            className="absolute bottom-1/4 right-1/4 w-[600px] h-[600px] bg-purple-500 rounded-full blur-[150px]"
          />

          <div className="relative z-10 container mx-auto px-4 text-center">
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              whileInView={{ opacity: 1, scale: 1 }}
              viewport={{ once: true }}
              transition={{ duration: 0.8 }}
            >
              <Badge className="mb-8 text-xl px-8 py-4 bg-white/10 backdrop-blur-xl border-white/20 text-white hover:bg-white/20">
                <TrendingUp className="w-6 h-6 mr-3 inline" />
                Join The Movement
              </Badge>

              <h2 className="text-6xl md:text-8xl lg:text-9xl font-black mb-8 leading-tight">
                Ready to Start Your
                <br />
                <span className="bg-gradient-to-r from-cyan-300 via-white to-pink-300 bg-clip-text text-transparent drop-shadow-[0_0_80px_rgba(255,255,255,0.5)]">
                  BPO Career?
                </span>
              </h2>

              <p className="text-2xl md:text-3xl text-gray-100 mb-16 max-w-4xl mx-auto leading-relaxed font-light">
                Join{' '}
                <span className="font-black text-white text-4xl">
                  {stats[0].value > 0 ? stats[0].value.toLocaleString() : '1,000+'}
                </span>{' '}
                job seekers already building better careers on{' '}
                <span className="font-black bg-gradient-to-r from-cyan-300 to-purple-300 bg-clip-text text-transparent">
                  BPOC Careers
                </span>
              </p>

              <div className="flex flex-col sm:flex-row gap-6 justify-center">
                  <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
                    <Button
                      size="lg"
                      onClick={() => {
                        if (typeof window !== 'undefined') {
                          window.dispatchEvent(new Event('openSignupModal'));
                        }
                      }}
                      className="text-xl px-14 py-8 bg-white text-purple-900 hover:bg-gray-100 border-0 shadow-[0_0_80px_rgba(255,255,255,0.4)] hover:shadow-[0_0_120px_rgba(255,255,255,0.6)] font-black rounded-2xl"
                    >
                      Create Free Profile
                      <ArrowRight className="ml-3 w-6 h-6" />
                    </Button>
                  </motion.div>
                <Link href="/jobs">
                  <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
                    <Button size="lg" variant="outline" className="text-xl px-14 py-8 border-2 border-white/50 text-white hover:bg-white/10 hover:border-white hover:shadow-[0_0_60px_rgba(255,255,255,0.3)] transition-all duration-300 font-bold rounded-2xl">
                      Browse Jobs
                      <ArrowRight className="ml-3 w-6 h-6" />
                    </Button>
                  </motion.div>
                </Link>
              </div>
            </motion.div>
          </div>
        </section>
      </main>
    </>
  )
}

export default function HomePage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-black" />}>
      <HomePageContent />
    </Suspense>
  )
}

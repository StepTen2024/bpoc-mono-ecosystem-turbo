/**
 * Profile Completeness Calculator
 * Calculates a candidate's profile completion score and provides recommendations
 */

export interface ProfileCompletenessItem {
  id: string
  label: string
  completed: boolean
  weight: number // percentage contribution to total score
  action?: string // CTA text
  link?: string // Where to complete this item
}

export interface ProfileCompleteness {
  score: number // 0-100
  badge: 'Starter' | 'Job Ready' | 'Pro Candidate' | 'Elite'
  items: ProfileCompletenessItem[]
  nextSteps: string[] // What to do next
  recruiterVisibility: 'Low' | 'Medium' | 'High' | 'Maximum'
}

interface CandidateProfile {
  resume_url?: string | null
  avatar_url?: string | null
  skills?: any[] | null
  work_experiences?: any[] | null
  educations?: any[] | null
  phone?: string | null
  location?: string | null
  bio?: string | null
  linkedin?: string | null
}

export function calculateProfileCompleteness(
  candidate: CandidateProfile
): ProfileCompleteness {
  const items: ProfileCompletenessItem[] = [
    {
      id: 'resume',
      label: 'Resume Uploaded',
      completed: !!candidate.resume_url,
      weight: 25,
      action: 'Upload Resume',
      link: '/candidate/resume'
    },
    {
      id: 'photo',
      label: 'Profile Photo',
      completed: !!candidate.avatar_url,
      weight: 10,
      action: 'Add Photo',
      link: '/candidate/profile'
    },
    {
      id: 'skills',
      label: 'Skills Added (3+)',
      completed: (candidate.skills?.length || 0) >= 3,
      weight: 15,
      action: 'Add Skills',
      link: '/candidate/profile'
    },
    {
      id: 'work_history',
      label: 'Work History',
      completed: (candidate.work_experiences?.length || 0) > 0,
      weight: 15,
      action: 'Add Work Experience',
      link: '/candidate/profile'
    },
    {
      id: 'education',
      label: 'Education',
      completed: (candidate.educations?.length || 0) > 0,
      weight: 10,
      action: 'Add Education',
      link: '/candidate/profile'
    },
    {
      id: 'contact_info',
      label: 'Contact Info Complete',
      completed: !!candidate.phone && !!candidate.location,
      weight: 25,
      action: 'Complete Profile',
      link: '/candidate/profile'
    }
  ]

  // Calculate total score
  const score = items.reduce((total, item) => {
    return total + (item.completed ? item.weight : 0)
  }, 0)

  // Determine badge
  let badge: ProfileCompleteness['badge']
  if (score < 40) badge = 'Starter'
  else if (score < 70) badge = 'Job Ready'
  else if (score < 90) badge = 'Pro Candidate'
  else badge = 'Elite'

  // Determine recruiter visibility
  let recruiterVisibility: ProfileCompleteness['recruiterVisibility']
  if (score < 40) recruiterVisibility = 'Low'
  else if (score < 70) recruiterVisibility = 'Medium'
  else if (score < 90) recruiterVisibility = 'High'
  else recruiterVisibility = 'Maximum'

  // Generate next steps
  const incompleteItems = items.filter(item => !item.completed)
  const nextSteps = incompleteItems.slice(0, 3).map(item => item.label)

  return {
    score,
    badge,
    items,
    nextSteps,
    recruiterVisibility
  }
}

/**
 * Get friendly message based on completeness score
 */
export function getCompletenessMessage(score: number): string {
  if (score < 40) {
    return "Your profile needs work. Complete the essentials to get noticed by recruiters!"
  } else if (score < 70) {
    return "You're making progress! A few more steps and you'll be job-ready."
  } else if (score < 90) {
    return "Great job! Your profile is professional and recruiter-ready."
  } else {
    return "Excellent! You have an elite profile that stands out to top recruiters."
  }
}

/**
 * Get badge color and icon
 */
export function getBadgeStyle(badge: ProfileCompleteness['badge']) {
  switch (badge) {
    case 'Starter':
      return {
        color: 'bg-gray-500',
        icon: '🌱',
        description: 'Just getting started'
      }
    case 'Job Ready':
      return {
        color: 'bg-blue-500',
        icon: '📄',
        description: 'Ready to apply for jobs'
      }
    case 'Pro Candidate':
      return {
        color: 'bg-purple-500',
        icon: '⭐',
        description: 'Professional and verified'
      }
    case 'Elite':
      return {
        color: 'bg-gradient-to-r from-yellow-400 to-orange-500',
        icon: '👑',
        description: 'Top-tier candidate'
      }
  }
}

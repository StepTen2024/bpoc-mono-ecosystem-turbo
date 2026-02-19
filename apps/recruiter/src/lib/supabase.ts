/**
 * Supabase client for the recruiter app
 */

import { createBrowserClient } from '@supabase/ssr'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''

// Use the modern SSR-compatible browser client
// During build/prerender, env vars may be empty - use placeholders to avoid crash
export const supabase = createBrowserClient(
  supabaseUrl || 'https://placeholder.supabase.co',
  supabaseAnonKey || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.placeholder'
)

// Auth helper functions
export const signUp = async (email: string, password: string, metadata?: any) => {
  return await supabase.auth.signUp({
    email,
    password,
    options: {
      data: metadata
    }
  })
}

export const signIn = async (email: string, password: string) => {
  return await supabase.auth.signInWithPassword({
    email,
    password
  })
}

export const signInWithGoogle = async () => {
  const baseUrl = typeof window !== 'undefined' 
    ? window.location.origin
    : (process.env.NEXT_PUBLIC_SITE_URL || 'https://www.bpoc.io')
  
  return await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo: `${baseUrl}/auth/callback`
    }
  })
}

export const signOut = async () => {
  try {
    if (typeof window !== 'undefined') {
      const keysToRemove: string[] = []
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i)
        if (key && (key.includes('supabase') || key.includes('auth'))) {
          keysToRemove.push(key)
        }
      }
      keysToRemove.forEach(key => localStorage.removeItem(key))
      sessionStorage.clear()
    }
    
    const { error } = await supabase.auth.signOut({ scope: 'local' })
    return { error }
  } catch (error) {
    return { error }
  }
}

export const getCurrentUser = () => supabase.auth.getUser()
export const getSession = () => supabase.auth.getSession()

export const requestPasswordReset = async (email: string) => {
  const baseUrl = typeof window !== 'undefined' 
    ? window.location.origin
    : (process.env.NEXT_PUBLIC_SITE_URL || 'https://www.bpoc.io')
  
  return await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${baseUrl}/reset-password`
  })
}

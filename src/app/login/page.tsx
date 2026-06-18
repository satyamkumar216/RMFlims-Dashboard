'use client'

import React, { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/utils/supabase/client'
import { isDemoMode } from '@/utils/supabase/demo'
import { HelpCircle } from 'lucide-react'

export default function LoginPage() {
  const router = useRouter()
  const supabase = createClient()

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const [isDemo, setIsDemo] = useState(false)

  useEffect(() => {
    setIsDemo(isDemoMode())
  }, [])

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setErrorMsg(null)

    // Demo Mode Sign In Bypass
    if (isDemo) {
      setTimeout(() => {
        if (email.trim().toLowerCase() === 'admin@rmfilms.com' && password === 'admin123') {
          document.cookie = "demo_session=true; path=/; max-age=86400"
          router.refresh()
          router.push('/dashboard')
        } else {
          setErrorMsg('Invalid credentials. For Demo Mode, please use: admin@rmfilms.com / admin123')
          setLoading(false)
        }
      }, 500) // Small delay to feel realistic
      return
    }

    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      })

      if (error) {
        setErrorMsg(error.message)
      } else if (data.user) {
        router.refresh()
        router.push('/dashboard')
      }
    } catch (err: any) {
      setErrorMsg('An unexpected error occurred. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 px-4 py-12 sm:px-6 lg:px-8">
      <div className="w-full max-w-md space-y-8 bg-white p-8 border border-gray-200 rounded-lg shadow-sm">
        <div className="text-center">
          <h1 className="text-3xl font-bold tracking-tight text-black">
            RM Films
          </h1>
          <p className="mt-2 text-sm text-gray-600">
            Admin Dashboard Login
          </p>
        </div>

        {isDemo && (
          <div className="rounded-md bg-blue-50 p-4 border border-blue-200 text-sm text-blue-800 flex items-start gap-2.5">
            <HelpCircle className="h-5 w-5 text-blue-500 shrink-0 mt-0.5" />
            <div>
              <span className="font-bold block">Demo Mode Active</span>
              You can log in and test everything immediately without Supabase. Use:
              <div className="mt-1 font-mono text-xs">
                Email: <span className="font-bold">admin@rmfilms.com</span><br />
                Password: <span className="font-bold">admin123</span>
              </div>
            </div>
          </div>
        )}

        <form className="mt-6 space-y-6" onSubmit={handleLogin}>
          {errorMsg && (
            <div className="rounded-md bg-red-50 p-4 border border-red-200">
              <div className="flex">
                <div className="text-sm font-medium text-red-800">
                  {errorMsg}
                </div>
              </div>
            </div>
          )}

          <div className="space-y-4 rounded-md shadow-xs">
            <div>
              <label htmlFor="email-address" className="block text-sm font-medium text-gray-700 mb-1">
                Email Address
              </label>
              <input
                id="email-address"
                name="email"
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="block w-full rounded-md border border-gray-300 px-3 py-2 text-gray-900 placeholder-gray-400 focus:border-black focus:outline-none focus:ring-1 focus:ring-black sm:text-sm"
                placeholder="admin@rmfilms.com"
              />
            </div>
            <div>
              <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-1">
                Password
              </label>
              <input
                id="password"
                name="password"
                type="password"
                autoComplete="current-password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="block w-full rounded-md border border-gray-300 px-3 py-2 text-gray-900 placeholder-gray-400 focus:border-black focus:outline-none focus:ring-1 focus:ring-black sm:text-sm"
                placeholder="••••••••"
              />
            </div>
          </div>

          <div>
            <button
              type="submit"
              disabled={loading}
              className="group relative flex w-full justify-center rounded-md bg-black px-4 py-2 text-sm font-semibold text-white hover:bg-gray-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-black disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
            >
              {loading ? 'Signing in...' : 'Sign in'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

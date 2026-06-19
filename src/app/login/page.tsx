'use client'

import React, { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/utils/supabase/client'
import { isDemoMode, getDemoStaff } from '@/utils/supabase/demo'
import { HelpCircle, ShieldAlert, KeyRound } from 'lucide-react'

export default function LoginPage() {
  const router = useRouter()
  const supabase = createClient()

  // Tab State
  const [loginType, setLoginType] = useState<'admin' | 'staff'>('admin')

  // Common State
  const [loading, setLoading] = useState(false)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const isDemo = isDemoMode()

  // Admin Credentials
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')

  // Staff Credentials
  const [staffList, setStaffList] = useState<any[]>([])
  const [selectedStaffId, setSelectedStaffId] = useState('')
  const [staffPin, setStaffPin] = useState('')

  // Load active staff members
  useEffect(() => {
    async function loadStaff() {
      if (isDemoMode()) {
        const list = getDemoStaff().filter(s => s.active)
        setStaffList(list)
        return
      }
      try {
        const { data, error } = await supabase
          .from('staff_members')
          .select('id, full_name, password')
          .eq('active', true)
        if (!error && data) {
          setStaffList(data)
        }
      } catch (e) {
        console.error('Failed to load staff list:', e)
      }
    }
    loadStaff()
  }, [isDemo, supabase])

  // Handle Admin Auth (Supabase Auth)
  const handleAdminLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setErrorMsg(null)

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
      }, 500)
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

  // Handle Staff Auth (Plain-text PIN match)
  const handleStaffLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setErrorMsg(null)

    if (!selectedStaffId) {
      setErrorMsg('Please select your name.')
      setLoading(false)
      return
    }
    if (!staffPin.trim()) {
      setErrorMsg('Please enter your password/PIN.')
      setLoading(false)
      return
    }

    const selectedStaff = staffList.find(s => s.id === selectedStaffId)
    if (!selectedStaff) {
      setErrorMsg('Staff profile not found.')
      setLoading(false)
      return
    }

    // Verify Password/PIN match
    const isMatched = selectedStaff.password === staffPin.trim()

    if (isMatched) {
      // 1. Save local state session details
      localStorage.setItem('staff_session', JSON.stringify({
        id: selectedStaff.id,
        name: selectedStaff.full_name
      }))

      // 2. Set helper cookie to satisfy Next middleware routing redirect rules
      document.cookie = `staff_session=${selectedStaff.id}; path=/; max-age=86400`

      // 3. Clear admin sessions if any
      document.cookie = "demo_session=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT"

      router.refresh()
      router.push('/dashboard/calendar') // Redirect staff to calendar
    } else {
      setErrorMsg('Invalid password/PIN. Please try again.')
      setLoading(false)
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-bg-base text-txt-primary font-sans transition-colors duration-300">
      <div className="w-full max-w-md space-y-8 bg-card-base p-8 border border-border-base rounded-2xl shadow-lg">
        <div className="text-center">
          <h1 className="text-[32px] font-black tracking-tight bg-gradient-to-r from-violet-500 via-indigo-500 to-cyan-500 dark:from-violet-400 dark:via-indigo-400 dark:to-cyan-400 bg-clip-text text-transparent">
            RM Films
          </h1>
          <p className="mt-2 text-xs text-txt-secondary uppercase tracking-widest font-bold">
            Dashboard Portal Login
          </p>
        </div>

        {/* Tab Switcher */}
        <div className="flex border border-border-base/80 rounded-xl p-0.5 bg-input-base">
          <button
            onClick={() => {
              setLoginType('admin')
              setErrorMsg(null)
            }}
            className={`flex-1 py-2.5 text-xs font-bold rounded-lg transition-all cursor-pointer ${
              loginType === 'admin'
                ? 'bg-card-base text-txt-primary shadow-xs border border-border-base/40'
                : 'text-txt-secondary hover:text-txt-primary'
            }`}
          >
            Admin Login
          </button>
          <button
            onClick={() => {
              setLoginType('staff')
              setErrorMsg(null)
            }}
            className={`flex-1 py-2.5 text-xs font-bold rounded-lg transition-all cursor-pointer ${
              loginType === 'staff'
                ? 'bg-card-base text-txt-primary shadow-xs border border-border-base/40'
                : 'text-txt-secondary hover:text-txt-primary'
            }`}
          >
            Staff Login
          </button>
        </div>

        {/* Info Banner */}
        {loginType === 'admin' && isDemo && (
          <div className="rounded-xl bg-blue-500/10 p-4 border border-blue-500/20 text-xs text-blue-600 dark:text-blue-400 flex items-start gap-2.5">
            <HelpCircle className="h-5 w-5 text-blue-500 shrink-0 mt-0.5" />
            <div>
              <span className="font-bold block mb-0.5">Demo Admin credentials</span>
              Email: <span className="font-mono font-bold">admin@rmfilms.com</span><br />
              Password: <span className="font-mono font-bold">admin123</span>
            </div>
          </div>
        )}

        {loginType === 'staff' && (
          <div className="rounded-xl bg-indigo-500/10 p-4 border border-indigo-500/20 text-xs text-indigo-600 dark:text-indigo-400 flex items-start gap-2.5">
            <KeyRound className="h-5 w-5 text-indigo-500 shrink-0 mt-0.5" />
            <div>
              <span className="font-bold block mb-0.5">Staff Shared Auth</span>
              Staff members use a simple shared dropdown + PIN password login (no email needed). Default PIN for mock staff: <span className="font-mono font-bold">1234</span>.
            </div>
          </div>
        )}

        {errorMsg && (
          <div className="rounded-xl bg-red-500/10 p-4 border border-red-500/20 flex items-start gap-2.5 text-xs font-bold text-red-500">
            <ShieldAlert className="h-4.5 w-4.5 shrink-0 mt-0.5" />
            <span>{errorMsg}</span>
          </div>
        )}

        {/* Form Container */}
        {loginType === 'admin' ? (
          /* ADMIN LOGIN FORM */
          <form className="space-y-6" onSubmit={handleAdminLogin}>
            <div className="space-y-4">
              <div>
                <label htmlFor="email-address" className="block text-xs font-bold uppercase tracking-wider text-txt-secondary mb-1.5">
                  Admin Email
                </label>
                <input
                  id="email-address"
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="block w-full rounded-lg border border-input-border bg-input-base px-3 py-2 text-sm text-txt-primary placeholder-txt-muted focus:border-txt-primary focus:outline-hidden focus:ring-1 focus:ring-txt-primary transition-all font-medium"
                  placeholder="admin@rmfilms.com"
                />
              </div>
              <div>
                <label htmlFor="password" className="block text-xs font-bold uppercase tracking-wider text-txt-secondary mb-1.5">
                  Password
                </label>
                <input
                  id="password"
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="block w-full rounded-lg border border-input-border bg-input-base px-3 py-2 text-sm text-txt-primary placeholder-txt-muted focus:border-txt-primary focus:outline-hidden focus:ring-1 focus:ring-txt-primary transition-all font-medium"
                  placeholder="••••••••"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="flex w-full justify-center rounded-xl bg-txt-primary px-4 py-2.5 text-sm font-bold text-white dark:bg-white dark:text-black hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed transition-all cursor-pointer shadow-md"
            >
              {loading ? 'Authenticating...' : 'Sign in as Admin'}
            </button>
          </form>
        ) : (
          /* STAFF LOGIN FORM */
          <form className="space-y-6" onSubmit={handleStaffLogin}>
            <div className="space-y-4">
              <div>
                <label htmlFor="staff-name" className="block text-xs font-bold uppercase tracking-wider text-txt-secondary mb-1.5">
                  Select Your Name
                </label>
                <select
                  id="staff-name"
                  required
                  value={selectedStaffId}
                  onChange={(e) => setSelectedStaffId(e.target.value)}
                  className="block w-full rounded-lg border border-input-border bg-input-base px-3 py-2 text-sm text-txt-primary focus:border-txt-primary focus:outline-hidden focus:ring-1 focus:ring-txt-primary transition-all font-bold cursor-pointer"
                >
                  <option value="">-- Choose Member --</option>
                  {staffList.map(s => (
                    <option key={s.id} value={s.id}>{s.full_name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label htmlFor="staff-pin" className="block text-xs font-bold uppercase tracking-wider text-txt-secondary mb-1.5">
                  Password / PIN
                </label>
                <input
                  id="staff-pin"
                  type="password"
                  required
                  maxLength={6}
                  placeholder="PIN PIN"
                  value={staffPin}
                  onChange={(e) => setStaffPin(e.target.value)}
                  className="block w-full rounded-lg border border-input-border bg-input-base px-3 py-2 text-sm text-txt-primary placeholder-txt-muted focus:border-txt-primary focus:outline-hidden focus:ring-1 focus:ring-txt-primary transition-all font-bold tracking-widest text-center"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="flex w-full justify-center rounded-xl bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 text-white px-4 py-2.5 text-sm font-bold disabled:opacity-50 disabled:cursor-not-allowed transition-all cursor-pointer shadow-md"
            >
              {loading ? 'Checking PIN...' : 'Sign in as Staff'}
            </button>
          </form>
        )}
      </div>
    </div>
  )
}

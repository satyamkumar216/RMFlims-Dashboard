'use client'

import React, { useEffect, useState } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { createClient } from '@/utils/supabase/client'
import { isDemoMode, getDemoStaff } from '@/utils/supabase/demo'
import { Inbox, Calendar, LogOut, Menu, X, Play, ClipboardList, Sun, Moon, Users, IndianRupee, CheckSquare, Coins, Settings } from 'lucide-react'

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const pathname = usePathname()
  const router = useRouter()
  const supabase = createClient()
  const [userEmail, setUserEmail] = useState<string | null>(null)
  const [userRole, setUserRole] = useState<'admin' | 'staff' | null>(null)
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [isDemo, setIsDemo] = useState(false)
  const [theme, setTheme] = useState<'light' | 'dark'>('dark')

  useEffect(() => {
    const savedTheme = localStorage.getItem('theme') as 'light' | 'dark' | null
    const initialTheme = savedTheme || 'dark'
    setTheme(initialTheme)
    document.documentElement.classList.toggle('dark', initialTheme === 'dark')
  }, [])

  const toggleTheme = () => {
    const nextTheme = theme === 'light' ? 'dark' : 'light'
    setTheme(nextTheme)
    localStorage.setItem('theme', nextTheme)
    document.documentElement.classList.toggle('dark', nextTheme === 'dark')
  }

  useEffect(() => {
    setIsDemo(isDemoMode())
    async function getUser() {
      // Check if staff session exists in localStorage
      const staffSessionStr = localStorage.getItem('staff_session')
      if (staffSessionStr) {
        try {
          const session = JSON.parse(staffSessionStr)
          
          // Verify if this staff member is still active
          if (isDemoMode()) {
            const list = getDemoStaff()
            const found = list.find((s) => s.id === session.id)
            if (!found || !found.active) {
              handleLogout()
              return
            }
          } else {
            const { data, error } = await supabase
              .from('staff_members')
              .select('active')
              .eq('id', session.id)
              .single()
            if (error || !data || !data.active) {
              handleLogout()
              return
            }
          }

          setUserEmail(session.name)
          setUserRole('staff')
          return
        } catch (e) {
          console.error('Error parsing staff_session:', e)
        }
      }

      if (isDemoMode()) {
        setUserEmail('admin@rmfilms.com')
        setUserRole('admin')
        return
      }
      const {
        data: { user },
      } = await supabase.auth.getUser()
      if (user) {
        setUserEmail(user.email ?? null)
        setUserRole('admin')
      } else {
        setUserRole('admin')
      }
    }
    getUser()
  }, [supabase])

  // Redirect staff from admin-only routes
  useEffect(() => {
    if (userRole === 'staff') {
      const restrictedPaths = ['/dashboard/ledger', '/dashboard/payroll', '/dashboard/settings']
      const isRestricted =
        restrictedPaths.some((p) => pathname.startsWith(p)) ||
        pathname === '/dashboard' ||
        pathname.startsWith('/dashboard/enquiries')
      
      if (isRestricted) {
        router.push('/dashboard/calendar')
      }
    }
  }, [userRole, pathname, router])

  const handleLogout = async () => {
    localStorage.removeItem('staff_session')
    document.cookie = 'staff_session=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT'
    document.cookie = 'demo_session=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT'
    
    if (!isDemoMode()) {
      await supabase.auth.signOut()
    }
    router.refresh()
    router.push('/login')
  }

  const allNavItems = [
    { name: 'Enquiries', href: '/dashboard', icon: Inbox, roles: ['admin'] },
    { name: 'Bookings', href: '/dashboard/bookings', icon: ClipboardList, roles: ['admin', 'staff'] },
    { name: 'Calendar', href: '/dashboard/calendar', icon: Calendar, roles: ['admin', 'staff'] },
    { name: 'My Work Done', href: '/dashboard/my-work', icon: CheckSquare, roles: ['staff'] },
    { name: 'Payroll', href: '/dashboard/payroll', icon: Coins, roles: ['admin'] },
    { name: 'Cash Ledger', href: '/dashboard/ledger', icon: IndianRupee, roles: ['admin'] },
    { name: 'Settings', href: '/dashboard/settings', icon: Settings, roles: ['admin'] },
  ]

  const navItems = allNavItems.filter((item) =>
    userRole ? item.roles.includes(userRole) : item.roles.includes('admin')
  )

  return (
    <div className="flex min-h-screen bg-bg-base text-txt-primary font-sans transition-colors duration-300">
      {/* Sidebar - Desktop */}
      <aside className="hidden md:flex md:w-64 md:flex-col md:fixed md:inset-y-0 z-30 bg-card-base border-r border-border-base transition-colors duration-300">
        {/* Brand/Logo */}
        <div className="flex h-16 items-center px-6 border-b border-border-base/50">
          <Link href="/dashboard" className="text-xl font-extrabold tracking-tight bg-gradient-to-r from-violet-500 via-indigo-500 to-cyan-500 dark:from-violet-400 dark:via-indigo-400 dark:to-cyan-400 bg-clip-text text-transparent hover:opacity-90 transition-opacity">
            RM Films
          </Link>
        </div>

        {/* Navigation links */}
        <nav className="flex-1 space-y-1.5 px-4 py-6">
          {navItems.map((item) => {
            const isActive =
              item.href === '/dashboard'
                ? pathname === '/dashboard' || pathname.startsWith('/dashboard/enquiries')
                : pathname.startsWith(item.href)
            return (
              <Link
                key={item.name}
                href={item.href}
                className={`flex items-center gap-3 px-4 py-2.5 rounded-xl text-sm font-semibold transition-all duration-150 ${
                  isActive 
                    ? 'bg-[#EFF6FF] text-[#1D4ED8] dark:bg-indigo-500/10 dark:text-indigo-400 shadow-sm' 
                    : 'text-txt-secondary hover:bg-[#F9FAFB] dark:hover:bg-sidebar-active/20 hover:text-txt-primary'
                }`}
              >
                <item.icon className={`h-4.5 w-4.5 shrink-0 ${isActive ? 'text-[#1D4ED8] dark:text-indigo-400' : 'text-txt-muted group-hover:text-txt-primary'}`} />
                {item.name}
              </Link>
            )
          })}
        </nav>

        {/* Footer profile / settings */}
        <div className="p-4 border-t border-border-base/50 space-y-4">
          {userEmail && (
            <div className="flex items-center gap-3 px-3 py-2 rounded-xl bg-sidebar-active/40 border border-border-base/40">
              <div className="h-8 w-8 rounded-full bg-gradient-to-tr from-indigo-500 to-purple-500 flex items-center justify-center text-white font-bold text-sm shadow-sm shrink-0">
                {userEmail[0].toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-bold text-txt-primary truncate">{userEmail.split('@')[0]}</p>
                <p className="text-[10px] text-txt-muted truncate">{userEmail}</p>
              </div>
            </div>
          )}

          <div className="flex items-center justify-between gap-2">
            <button
              onClick={toggleTheme}
              type="button"
              className="flex-1 flex items-center justify-center gap-2 p-2 rounded-lg border border-border-base bg-card-base text-txt-secondary hover:text-txt-primary hover:border-txt-muted transition-all cursor-pointer text-xs font-semibold"
              title={`Switch to ${theme === 'light' ? 'dark' : 'light'} mode`}
            >
              {theme === 'light' ? (
                <>
                  <Moon className="h-3.5 w-3.5" />
                  <span>Dark</span>
                </>
              ) : (
                <>
                  <Sun className="h-3.5 w-3.5" />
                  <span>Light</span>
                </>
              )}
            </button>

            <button
              onClick={handleLogout}
              className="p-2 rounded-lg border border-border-base bg-card-base text-txt-secondary hover:bg-red-500/10 hover:text-red-500 transition-all cursor-pointer"
              title="Sign out"
            >
              <LogOut className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      </aside>

      {/* Main layout container (with desktop padding-left) */}
      <div className="flex-1 flex flex-col md:pl-64 min-h-screen">
        {/* Demo Mode Top banner */}
        {isDemo && (
          <div className="bg-indigo-500/10 border-b border-indigo-500/20 text-indigo-500 dark:text-indigo-400 text-xs font-semibold py-1.5 px-4 text-center flex items-center justify-center gap-1.5 shadow-xs print:hidden">
            <Play className="h-3 w-3 fill-indigo-500 dark:fill-indigo-400 text-indigo-500 dark:text-indigo-400" />
            Running in Demo Mode (Local Storage). Set your Supabase keys in .env.local to switch to real database.
          </div>
        )}

        {/* Mobile Header (Hidden on desktop) */}
        <header className="sticky top-0 z-40 w-full border-b border-header-border bg-header-base backdrop-blur-md print:hidden transition-colors duration-300 md:hidden">
          <div className="flex h-16 items-center justify-between px-4">
            <Link href="/dashboard" className="text-xl font-extrabold tracking-tight bg-gradient-to-r from-violet-500 via-indigo-500 to-cyan-500 bg-clip-text text-transparent">
              RM Films
            </Link>

            <div className="flex items-center gap-3">
              <button
                onClick={toggleTheme}
                type="button"
                className="p-2 rounded-lg border border-border-base bg-card-base text-txt-secondary hover:text-txt-primary"
              >
                {theme === 'light' ? <Moon className="h-4 w-4" /> : <Sun className="h-4 w-4" />}
              </button>
              
              <button
                onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                className="inline-flex items-center justify-center rounded-md p-2 text-txt-secondary hover:bg-sidebar-active hover:text-txt-primary"
              >
                {mobileMenuOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
              </button>
            </div>
          </div>

          {/* Mobile menu dropdown */}
          {mobileMenuOpen && (
            <div className="border-b border-border-base bg-card-base px-4 pt-2 pb-4 space-y-1 transition-colors duration-300 shadow-lg">
              {navItems.map((item) => {
                const isActive =
                  item.href === '/dashboard'
                    ? pathname === '/dashboard' || pathname.startsWith('/dashboard/enquiries')
                    : pathname.startsWith(item.href)
                return (
                  <Link
                    key={item.name}
                    href={item.href}
                    onClick={() => setMobileMenuOpen(false)}
                    className={`flex items-center gap-3 px-3 py-2 rounded-md text-base font-semibold ${
                      isActive ? 'bg-sidebar-active text-txt-primary font-bold' : 'text-txt-secondary hover:bg-sidebar-active hover:text-txt-primary'
                    }`}
                  >
                    <item.icon className="h-5 w-5" />
                    {item.name}
                  </Link>
                )
              })}
              <hr className="my-2 border-border-base" />
              <div className="flex items-center justify-between px-3 py-2">
                <span className="text-xs text-txt-secondary truncate max-w-[200px]">
                  {userEmail} {isDemo && '(Demo)'}
                </span>
                <button
                  onClick={handleLogout}
                  className="flex items-center gap-2 rounded-md border border-border-base bg-card-base px-3 py-1.5 text-sm font-semibold text-red-500 hover:bg-red-500/10"
                >
                  <LogOut className="h-3.5 w-3.5" />
                  Sign out
                </button>
              </div>
            </div>
          )}
        </header>

        {/* Main Content Area */}
        <main className="flex-1 p-6 md:p-8">
          {children}
        </main>
      </div>
    </div>
  )
}

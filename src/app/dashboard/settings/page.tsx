'use client'

import React, { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/utils/supabase/client'
import { 
  isDemoMode, 
  getDemoStaff, 
  saveDemoStaff, 
  getDemoWorkLogs
} from '@/utils/supabase/demo'
import { 
  Users, 
  Plus, 
  Loader2, 
  Check, 
  AlertCircle,
  UserPlus,
  Shield,
  Phone,
  Key,
  Briefcase
} from 'lucide-react'

// Interfaces
interface StaffMember {
  id: string
  full_name: string
  email: string
  phone: string
  role_title: string
  password?: string
  active: boolean
  created_at: string
}

interface WorkLog {
  id: string
  staff_id: string
  status: 'pending' | 'paid'
}

export default function SettingsPage() {
  const router = useRouter()
  const supabase = createClient()

  // App States
  const [loading, setLoading] = useState(true)
  const [isLoggedCheck, setIsLoggedCheck] = useState(false)
  const [successMsg, setSuccessMsg] = useState('')
  const [errorMsg, setErrorMsg] = useState<string | null>(null)

  // DB Data
  const [staff, setStaff] = useState<StaffMember[]>([])
  const [workLogs, setWorkLogs] = useState<WorkLog[]>([])

  // Form inputs state
  const [fullName, setFullName] = useState('')
  const [phone, setPhone] = useState('')
  const [password, setPassword] = useState('')
  const [roleTitle, setRoleTitle] = useState('Crew')
  const [formSaving, setFormSaving] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)

  // Redirect if not logged in / not admin
  useEffect(() => {
    const checkAdmin = async () => {
      const staffSessionStr = localStorage.getItem('staff_session')
      if (staffSessionStr) {
        router.push('/dashboard/calendar')
        return
      }
      
      if (isDemoMode()) {
        setIsLoggedCheck(true)
        return
      }

      try {
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) {
          router.push('/login')
        } else {
          setIsLoggedCheck(true)
        }
      } catch (e) {
        router.push('/login')
      }
    }
    checkAdmin()
  }, [router, supabase])

  const fetchData = async () => {
    setLoading(true)
    setErrorMsg(null)
    if (isDemoMode()) {
      setStaff(getDemoStaff())
      setWorkLogs(getDemoWorkLogs())
      setLoading(false)
      return
    }

    try {
      const [staffRes, logsRes] = await Promise.all([
        supabase.from('staff_members').select('*').order('full_name', { ascending: true }),
        supabase.from('work_log').select('id, staff_id, status')
      ])

      if (staffRes.error) throw staffRes.error
      if (logsRes.error) throw logsRes.error

      setStaff(staffRes.data || [])
      setWorkLogs(logsRes.data || [])
    } catch (e: any) {
      console.error(e)
      setErrorMsg('Failed to load settings data: ' + e.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (isLoggedCheck) {
      fetchData()
    }
  }, [isLoggedCheck])

  // Add new staff member
  const handleAddStaff = async (e: React.FormEvent) => {
    e.preventDefault()
    setFormError(null)

    if (!fullName.trim()) {
      setFormError('Please enter a Full Name.')
      return
    }
    if (!password.trim()) {
      setFormError('Please enter a Password or PIN.')
      return
    }

    setFormSaving(true)
    const generatedEmail = `${fullName.trim().toLowerCase().replace(/\s+/g, '')}@rmfilms.com`
    const finalPhone = phone.trim() || ''
    const finalRole = roleTitle.trim() || 'Crew'

    if (isDemoMode()) {
      const demoList = getDemoStaff()
      const newMember: StaffMember = {
        id: 'staff-' + Date.now(),
        full_name: fullName.trim(),
        email: generatedEmail,
        phone: finalPhone,
        role_title: finalRole,
        password: password.trim(),
        active: true,
        created_at: new Date().toISOString()
      }
      
      const updated = [newMember, ...demoList]
      saveDemoStaff(updated)
      setStaff(updated)
      
      setSuccessMsg('Staff member added successfully')
      setTimeout(() => setSuccessMsg(''), 4000)
      
      // Reset inputs
      setFullName('')
      setPhone('')
      setPassword('')
      setRoleTitle('Crew')
      setFormSaving(false)
      return
    }

    try {
      const { data, error } = await supabase
        .from('staff_members')
        .insert({
          full_name: fullName.trim(),
          email: generatedEmail,
          phone: finalPhone,
          role_title: finalRole,
          password: password.trim(),
          active: true
        })
        .select('*')
        .single()

      if (error) throw error

      if (data) {
        setStaff(prev => [data, ...prev])
      }

      setSuccessMsg('Staff member added successfully')
      setTimeout(() => setSuccessMsg(''), 4000)

      // Reset inputs
      setFullName('')
      setPhone('')
      setPassword('')
      setRoleTitle('Crew')
    } catch (err: any) {
      console.error(err)
      setFormError('Failed to add staff member: ' + err.message)
    } finally {
      setFormSaving(false)
    }
  }

  // Toggle active / inactive status
  const handleToggleActive = async (member: StaffMember) => {
    const updatedStatus = !member.active
    const backupStaff = [...staff]

    // Optimistic UI update
    setStaff(prev => prev.map(s => s.id === member.id ? { ...s, active: updatedStatus } : s))

    if (isDemoMode()) {
      const demoList = getDemoStaff()
      const updated = demoList.map(s => s.id === member.id ? { ...s, active: updatedStatus } : s)
      saveDemoStaff(updated)
      setSuccessMsg(`Staff member ${updatedStatus ? 'activated' : 'deactivated'}`)
      setTimeout(() => setSuccessMsg(''), 4000)
      return
    }

    try {
      const { error } = await supabase
        .from('staff_members')
        .update({ active: updatedStatus })
        .eq('id', member.id)

      if (error) throw error
      setSuccessMsg(`Staff member ${updatedStatus ? 'activated' : 'deactivated'}`)
      setTimeout(() => setSuccessMsg(''), 4000)
    } catch (err: any) {
      console.error(err)
      // Rollback
      setStaff(backupStaff)
      alert('Failed to update status: ' + err.message)
    }
  }

  // Calculate shifts logged per staff member
  const getShiftsLoggedCount = (staffId: string) => {
    return workLogs.filter(wl => wl.staff_id === staffId).length
  }

  if (!isLoggedCheck) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center bg-bg-base">
        <Loader2 className="h-8 w-8 animate-spin text-txt-muted" />
      </div>
    )
  }

  return (
    <div className="space-y-8 max-w-5xl mx-auto">
      {/* Toast Success */}
      {successMsg && (
        <div className="fixed bottom-5 right-5 bg-black text-white px-4 py-3 rounded-lg shadow-lg flex items-center gap-2 z-50 animate-bounce">
          <Check className="h-4 w-4 text-green-400" />
          <span>{successMsg}</span>
        </div>
      )}

      {/* Header */}
      <div>
        <h1 className="text-3xl font-black tracking-tight text-txt-primary">Settings</h1>
        <p className="text-sm text-txt-secondary mt-1">
          Manage system configurations, register staff profiles, and active login toggles.
        </p>
      </div>

      {errorMsg && (
        <div className="p-4 bg-red-500/10 border border-red-500/20 text-red-500 text-sm font-semibold rounded-lg">
          {errorMsg}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* LEFT COLUMN: STAFF LIST */}
        <div className="lg:col-span-2 space-y-4">
          <div className="bg-card-base border border-border-base rounded-2xl p-6 shadow-base flex flex-col h-full transition-colors duration-300">
            <div className="border-b border-border-base/50 pb-4 mb-5 flex items-center gap-2.5">
              <div className="p-2 bg-indigo-500/10 rounded-lg text-indigo-500">
                <Users className="h-5 w-5" />
              </div>
              <div>
                <h3 className="font-extrabold text-txt-primary text-base">Agency Staff Members</h3>
                <p className="text-xs text-txt-secondary">View and toggle logins for photographers and team members.</p>
              </div>
            </div>

            {loading ? (
              <div className="flex flex-col items-center justify-center py-20 flex-1">
                <Loader2 className="h-8 w-8 animate-spin text-txt-muted" />
                <p className="text-xs text-txt-muted mt-2">Loading staff accounts...</p>
              </div>
            ) : staff.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-20 flex-1 border border-dashed border-border-base rounded-xl bg-sidebar-active/10">
                <Users className="h-10 w-10 text-txt-muted mb-3" />
                <h4 className="text-sm font-bold text-txt-primary">No staff members</h4>
                <p className="text-xs text-txt-secondary mt-1">Register your first team member using the form on the right.</p>
              </div>
            ) : (
              <div className="space-y-3.5 flex-1 overflow-y-auto max-h-[550px] pr-1">
                {staff.map(member => {
                  const shiftsCount = getShiftsLoggedCount(member.id)
                  
                  return (
                    <div
                      key={member.id}
                      className={`border rounded-xl p-4 flex items-center justify-between gap-4 transition-all duration-200 ${
                        member.active 
                          ? 'bg-card-base border-border-base' 
                          : 'bg-sidebar-active/10 border-border-base/40 opacity-70'
                      }`}
                    >
                      <div className="min-w-0 space-y-1">
                        <div className="flex items-center gap-2">
                          <h4 className="font-extrabold text-txt-primary text-sm truncate leading-snug">
                            {member.full_name}
                          </h4>
                          {!member.active && (
                            <span className="text-[9px] font-bold bg-red-500/10 text-red-500 border border-red-500/25 px-1.5 py-0.2 rounded uppercase">
                              Inactive
                            </span>
                          )}
                        </div>

                        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-txt-secondary font-medium">
                          <span className="text-indigo-500 font-bold">{member.role_title}</span>
                          <span className="text-txt-muted">·</span>
                          <span className="text-txt-muted flex items-center gap-1">
                            <Briefcase className="h-3.5 w-3.5" />
                            {shiftsCount} shift{shiftsCount !== 1 ? 's' : ''} logged
                          </span>
                          {member.phone && (
                            <>
                              <span className="text-txt-muted">·</span>
                              <span className="text-txt-muted">{member.phone}</span>
                            </>
                          )}
                        </div>
                      </div>

                      {/* ACTIVE / INACTIVE TOGGLE */}
                      <div className="shrink-0 flex items-center gap-3">
                        <span className="text-xs text-txt-secondary font-semibold hidden sm:inline">
                          {member.active ? 'Active login' : 'Disabled'}
                        </span>
                        
                        <button
                          onClick={() => handleToggleActive(member)}
                          type="button"
                          className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-hidden ${
                            member.active ? 'bg-indigo-600' : 'bg-border-base'
                          }`}
                        >
                          <span
                            className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-sm ring-0 transition duration-200 ease-in-out ${
                              member.active ? 'translate-x-5' : 'translate-x-0'
                            }`}
                          />
                        </button>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </div>

        {/* RIGHT COLUMN: ADD STAFF FORM */}
        <div className="lg:col-span-1 space-y-4">
          <div className="bg-card-base border border-border-base rounded-2xl p-6 shadow-base flex flex-col transition-colors duration-300">
            <div className="border-b border-border-base/50 pb-4 mb-5 flex items-center gap-2.5">
              <div className="p-2 bg-indigo-500/10 rounded-lg text-indigo-500">
                <UserPlus className="h-5 w-5" />
              </div>
              <div>
                <h3 className="font-extrabold text-txt-primary text-base">+ Add Staff Member</h3>
                <p className="text-xs text-txt-secondary">Create a login profile directly.</p>
              </div>
            </div>

            {formError && (
              <div className="mb-4 flex items-center gap-2 p-3 bg-red-500/10 border border-red-500/20 text-red-500 rounded-xl text-xs font-semibold animate-fadeIn">
                <AlertCircle className="h-4 w-4 shrink-0" />
                <span>{formError}</span>
              </div>
            )}

            <form onSubmit={handleAddStaff} className="space-y-4">
              {/* Full Name input */}
              <div className="space-y-1">
                <label className="block text-[10px] font-extrabold uppercase tracking-wider text-txt-secondary">
                  Full Name
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-txt-muted">
                    <Users className="h-4 w-4" />
                  </div>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Rahul Sen"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    className="w-full rounded-xl border border-input-border bg-input-base pl-9 pr-4 py-2.5 text-xs text-txt-primary placeholder-txt-muted focus:border-txt-primary focus:outline-hidden focus:ring-1 focus:ring-txt-primary font-bold"
                  />
                </div>
              </div>

              {/* Role Title input */}
              <div className="space-y-1">
                <label className="block text-[10px] font-extrabold uppercase tracking-wider text-txt-secondary">
                  Role Title / Assignment
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-txt-muted">
                    <Shield className="h-4 w-4" />
                  </div>
                  <select
                    value={roleTitle}
                    onChange={(e) => setRoleTitle(e.target.value)}
                    className="w-full rounded-xl border border-input-border bg-input-base pl-9 pr-4 py-2.5 text-xs text-txt-primary focus:border-txt-primary focus:outline-hidden focus:ring-1 focus:ring-txt-primary font-bold"
                  >
                    <option value="Lead Photographer">Lead Photographer</option>
                    <option value="Second Shooter">Second Shooter</option>
                    <option value="Videographer">Videographer</option>
                    <option value="Editor">Editor</option>
                    <option value="Crew">Crew / Intern</option>
                  </select>
                </div>
              </div>

              {/* Password/PIN input */}
              <div className="space-y-1">
                <label className="block text-[10px] font-extrabold uppercase tracking-wider text-txt-secondary">
                  Password / Numeric PIN
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-txt-muted">
                    <Key className="h-4 w-4" />
                  </div>
                  <input
                    type="text"
                    required
                    placeholder="e.g. 1234 (simple PIN code)"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full rounded-xl border border-input-border bg-input-base pl-9 pr-4 py-2.5 text-xs text-txt-primary placeholder-txt-muted focus:border-txt-primary focus:outline-hidden focus:ring-1 focus:ring-txt-primary font-bold"
                  />
                </div>
              </div>

              {/* Phone input (optional) */}
              <div className="space-y-1">
                <label className="block text-[10px] font-extrabold uppercase tracking-wider text-txt-secondary">
                  Phone Number (optional)
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-txt-muted">
                    <Phone className="h-4 w-4" />
                  </div>
                  <input
                    type="text"
                    placeholder="e.g. +91 98765 XXXXX"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    className="w-full rounded-xl border border-input-border bg-input-base pl-9 pr-4 py-2.5 text-xs text-txt-primary placeholder-txt-muted focus:border-txt-primary focus:outline-hidden focus:ring-1 focus:ring-txt-primary font-bold"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={formSaving}
                className="w-full flex items-center justify-center gap-1.5 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-bold shadow-md hover:-translate-y-0.5 active:translate-y-0 transition-all cursor-pointer disabled:opacity-50"
              >
                {formSaving ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Plus className="h-3.5 w-3.5" />
                )}
                <span>Register Staff Member</span>
              </button>
            </form>
          </div>
        </div>

      </div>
    </div>
  )
}

'use client'

import React, { useEffect, useState } from 'react'
import { createClient } from '@/utils/supabase/client'
import { 
  isDemoMode, 
  getDemoStaff, 
  saveDemoStaff, 
  getDemoSalaryRequests, 
  saveDemoSalaryRequests, 
  getDemoWorkLogs, 
  saveDemoWorkLogs, 
  getDemoEvents, 
  insertLedgerEntry 
} from '@/utils/supabase/demo'
import { 
  Users, 
  ClipboardList, 
  DollarSign, 
  Plus, 
  X, 
  Check, 
  AlertCircle, 
  Calendar as CalendarIcon,
  Search,
  CheckCircle,
  FileText
} from 'lucide-react'

// Interfaces
interface StaffMember {
  id: string
  full_name: string
  email: string
  phone: string
  role_title: string
  active: boolean
  created_at: string
}

interface SalaryRequest {
  id: string
  staff_id: string
  request_date: string
  status: 'pending' | 'paid'
  amount_given: number | null
  paid_at: string | null
  admin_note: string | null
  created_at: string
  staff?: StaffMember
}

interface WorkLog {
  id: string
  staff_id: string
  event_id: string | null
  event_title: string
  event_date: string
  note: string | null
  status: 'logged' | 'requested' | 'paid'
  salary_request_id: string | null
  created_at: string
  staff?: StaffMember
}

interface CalendarEvent {
  id: string
  title: string
  event_date: string
}

export default function StaffPage() {
  const supabase = createClient()
  const [activeTab, setActiveTab] = useState<'directory' | 'logs' | 'payroll'>('directory')
  
  // Data State
  const [staff, setStaff] = useState<StaffMember[]>([])
  const [workLogs, setWorkLogs] = useState<WorkLog[]>([])
  const [salaryRequests, setSalaryRequests] = useState<SalaryRequest[]>([])
  const [events, setEvents] = useState<CalendarEvent[]>([])
  const [loading, setLoading] = useState(true)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)

  // Modals & Form States
  const [showAddStaffModal, setShowAddStaffModal] = useState(false)
  const [showLogWorkModal, setShowLogWorkModal] = useState(false)
  const [showPayoutModal, setShowPayoutModal] = useState(false)

  // Add Staff Form
  const [staffName, setStaffName] = useState('')
  const [staffEmail, setStaffEmail] = useState('')
  const [staffPhone, setStaffPhone] = useState('')
  const [staffRole, setStaffRole] = useState('Photographer')
  const [staffSaving, setStaffSaving] = useState(false)

  // Log Work Form
  const [logStaffId, setLogStaffId] = useState('')
  const [logEventId, setLogEventId] = useState('')
  const [logEventTitle, setLogEventTitle] = useState('')
  const [logEventDate, setLogEventDate] = useState('')
  const [logNote, setLogNote] = useState('')
  const [logSaving, setLogSaving] = useState(false)

  // Payout Form
  const [selectedRequest, setSelectedRequest] = useState<SalaryRequest | null>(null)
  const [payoutAmount, setPayoutAmount] = useState('')
  const [payoutNote, setPayoutNote] = useState('')
  const [payoutSaving, setPayoutSaving] = useState(false)
  const [payoutError, setPayoutError] = useState('')

  // Create Salary Request Form
  const [showRequestSalaryModal, setShowRequestSalaryModal] = useState(false)
  const [reqStaffId, setReqStaffId] = useState('')
  const [reqAmount, setReqAmount] = useState('')
  const [reqNote, setReqNote] = useState('')
  const [reqSaving, setReqSaving] = useState(false)
  const [reqError, setReqError] = useState('')

  const fetchData = async () => {
    setLoading(true)
    setErrorMsg(null)

    if (isDemoMode()) {
      const demoStaff = getDemoStaff()
      const demoLogs = getDemoWorkLogs()
      const demoReqs = getDemoSalaryRequests()
      const demoEvents = getDemoEvents() as CalendarEvent[]

      // Join Staff details for display
      const joinedLogs = demoLogs.map(log => ({
        ...log,
        staff: demoStaff.find(s => s.id === log.staff_id)
      })).sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())

      const joinedReqs = demoReqs.map(req => ({
        ...req,
        staff: demoStaff.find(s => s.id === req.staff_id)
      })).sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())

      setStaff(demoStaff)
      setWorkLogs(joinedLogs)
      setSalaryRequests(joinedReqs)
      setEvents(demoEvents)
      setLoading(false)
      return
    }

    try {
      const [staffRes, logsRes, reqsRes, eventsRes] = await Promise.all([
        supabase.from('staff_members').select('*').order('full_name'),
        supabase.from('work_log').select('*, staff:staff_members(*)').order('created_at', { ascending: false }),
        supabase.from('salary_requests').select('*, staff:staff_members(*)').order('created_at', { ascending: false }),
        supabase.from('calendar_events').select('id, title, event_date').order('event_date', { ascending: false })
      ])

      if (staffRes.error) throw staffRes.error
      if (logsRes.error) throw logsRes.error
      if (reqsRes.error) throw reqsRes.error
      if (eventsRes.error) throw eventsRes.error

      setStaff(staffRes.data || [])
      setWorkLogs(logsRes.data || [])
      setSalaryRequests(reqsRes.data || [])
      setEvents(eventsRes.data || [])
    } catch (err: any) {
      console.error(err)
      setErrorMsg('Failed to load database. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchData()
  }, [])

  // Auto-fill work log fields when calendar event is selected
  useEffect(() => {
    if (logEventId) {
      const selected = events.find(e => e.id === logEventId)
      if (selected) {
        setLogEventTitle(selected.title)
        setLogEventDate(selected.event_date)
      }
    }
  }, [logEventId, events])

  // Save new staff member
  const handleAddStaff = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!staffName.trim()) return

    setStaffSaving(true)
    if (isDemoMode()) {
      const demo = getDemoStaff()
      const newStaff: StaffMember = {
        id: 'staff-' + Date.now(),
        full_name: staffName.trim(),
        email: staffEmail.trim() || '—',
        phone: staffPhone.trim() || '—',
        role_title: staffRole,
        active: true,
        created_at: new Date().toISOString()
      }
      saveDemoStaff([...demo, newStaff])
      setStaffSaving(false)
      setShowAddStaffModal(false)
      setStaffName('')
      setStaffEmail('')
      setStaffPhone('')
      fetchData()
      return
    }

    try {
      const { error } = await supabase
        .from('staff_members')
        .insert({
          full_name: staffName.trim(),
          email: staffEmail.trim(),
          phone: staffPhone.trim(),
          role_title: staffRole,
          active: true
        })
      if (error) throw error
      setShowAddStaffModal(false)
      setStaffName('')
      setStaffEmail('')
      setStaffPhone('')
      fetchData()
    } catch (err: any) {
      alert(err.message)
    } finally {
      setStaffSaving(false)
    }
  }

  // Toggle active status
  const toggleStaffActive = async (id: string, currentStatus: boolean) => {
    if (isDemoMode()) {
      const demo = getDemoStaff()
      const updated = demo.map(s => s.id === id ? { ...s, active: !currentStatus } : s)
      saveDemoStaff(updated)
      fetchData()
      return
    }

    try {
      const { error } = await supabase
        .from('staff_members')
        .update({ active: !currentStatus })
        .eq('id', id)
      if (error) throw error
      fetchData()
    } catch (err: any) {
      alert(err.message)
    }
  }

  // Save new work log
  const handleLogWork = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!logStaffId || !logEventTitle.trim() || !logEventDate) return

    setLogSaving(true)
    if (isDemoMode()) {
      const demo = getDemoWorkLogs()
      const newLog: WorkLog = {
        id: 'work-' + Date.now(),
        staff_id: logStaffId,
        event_id: logEventId || null,
        event_title: logEventTitle.trim(),
        event_date: logEventDate,
        note: logNote.trim() || null,
        status: 'logged',
        salary_request_id: null,
        created_at: new Date().toISOString()
      }
      saveDemoWorkLogs([...demo, newLog])
      setLogSaving(false)
      setShowLogWorkModal(false)
      setLogStaffId('')
      setLogEventId('')
      setLogEventTitle('')
      setLogEventDate('')
      setLogNote('')
      fetchData()
      return
    }

    try {
      const { error } = await supabase
        .from('work_log')
        .insert({
          staff_id: logStaffId,
          event_id: logEventId || null,
          event_title: logEventTitle.trim(),
          event_date: logEventDate,
          note: logNote.trim() || null,
          status: 'logged'
        })
      if (error) throw error
      setShowLogWorkModal(false)
      setLogStaffId('')
      setLogEventId('')
      setLogEventTitle('')
      setLogEventDate('')
      setLogNote('')
      fetchData()
    } catch (err: any) {
      alert(err.message)
    } finally {
      setLogSaving(false)
    }
  }

  // Create Salary Request
  const handleRequestSalary = async (e: React.FormEvent) => {
    e.preventDefault()
    setReqError('')
    if (!reqStaffId || !reqAmount) return

    const amountNum = parseFloat(reqAmount)
    if (isNaN(amountNum) || amountNum <= 0) {
      setReqError('Please enter a valid amount.')
      return
    }

    setReqSaving(true)
    const newId = 'salary-req-' + Date.now()

    if (isDemoMode()) {
      // 1. Create Salary Request
      const reqs = getDemoSalaryRequests()
      const newReq: SalaryRequest = {
        id: newId,
        staff_id: reqStaffId,
        request_date: new Date().toISOString(),
        status: 'pending',
        amount_given: null,
        paid_at: null,
        admin_note: reqNote.trim() || null,
        created_at: new Date().toISOString()
      }
      saveDemoSalaryRequests([...reqs, newReq])

      // 2. Update all "logged" work logs for this staff to "requested" and reference this request ID
      const logs = getDemoWorkLogs()
      const updatedLogs = logs.map(l => 
        (l.staff_id === reqStaffId && l.status === 'logged') 
          ? { ...l, status: 'requested' as const, salary_request_id: newId } 
          : l
      )
      saveDemoWorkLogs(updatedLogs)

      setReqSaving(false)
      setShowRequestSalaryModal(false)
      setReqStaffId('')
      setReqAmount('')
      setReqNote('')
      fetchData()
      return
    }

    try {
      // 1. Insert Salary Request
      const { data: dbReq, error: rError } = await supabase
        .from('salary_requests')
        .insert({
          staff_id: reqStaffId,
          status: 'pending',
          admin_note: reqNote.trim() || null
        })
        .select('id')
        .single()

      if (rError) throw rError

      // 2. Update matching work logs
      if (dbReq?.id) {
        const { error: wError } = await supabase
          .from('work_log')
          .update({
            status: 'requested',
            salary_request_id: dbReq.id
          })
          .eq('staff_id', reqStaffId)
          .eq('status', 'logged')

        if (wError) throw wError
      }

      setShowRequestSalaryModal(false)
      setReqStaffId('')
      setReqAmount('')
      setReqNote('')
      fetchData()
    } catch (err: any) {
      setReqError(err.message)
    } finally {
      setReqSaving(false)
    }
  }

  // Pay Salary Request (logs payout in Cash Ledger)
  const handlePayout = async (e: React.FormEvent) => {
    e.preventDefault()
    setPayoutError('')
    if (!selectedRequest) return

    const amountNum = parseFloat(payoutAmount)
    if (isNaN(amountNum) || amountNum <= 0) {
      setPayoutError('Please enter a valid payout amount.')
      return
    }

    setPayoutSaving(true)
    const staffName = selectedRequest.staff?.full_name || 'Staff Member'
    const finalDesc = `Salary paid to ${staffName} — ${payoutNote.trim() || 'Regular payout'}`

    if (isDemoMode()) {
      // 1. Update salary request status to paid
      const reqs = getDemoSalaryRequests()
      const updatedReqs = reqs.map(r => 
        r.id === selectedRequest.id 
          ? { 
              ...r, 
              status: 'paid' as const, 
              amount_given: amountNum, 
              paid_at: new Date().toISOString(), 
              admin_note: payoutNote.trim() || null 
            } 
          : r
      )
      saveDemoSalaryRequests(updatedReqs)

      // 2. Update associated work logs status to paid
      const logs = getDemoWorkLogs()
      const updatedLogs = logs.map(l => 
        l.salary_request_id === selectedRequest.id 
          ? { ...l, status: 'paid' as const } 
          : l
      )
      saveDemoWorkLogs(updatedLogs)

      // 3. Write negative cash entry to ledger
      await insertLedgerEntry(null, {
        type: 'salary_paid',
        amount: -amountNum,
        reference_id: selectedRequest.id,
        description: finalDesc
      })

      setPayoutSaving(false)
      setShowPayoutModal(false)
      setSelectedRequest(null)
      setPayoutAmount('')
      setPayoutNote('')
      fetchData()
      return
    }

    try {
      // 1. Update salary request in Supabase
      const { error: rError } = await supabase
        .from('salary_requests')
        .update({
          status: 'paid',
          amount_given: amountNum,
          paid_at: new Date().toISOString(),
          admin_note: payoutNote.trim() || null
        })
        .eq('id', selectedRequest.id)

      if (rError) throw rError

      // 2. Update associated work logs status to paid
      const { error: wError } = await supabase
        .from('work_log')
        .update({ status: 'paid' })
        .eq('salary_request_id', selectedRequest.id)

      if (wError) throw wError

      // 3. Log Payout in Cash Ledger
      await insertLedgerEntry(supabase, {
        type: 'salary_paid',
        amount: -amountNum,
        reference_id: selectedRequest.id,
        description: finalDesc
      })

      setShowPayoutModal(false)
      setSelectedRequest(null)
      setPayoutAmount('')
      setPayoutNote('')
      fetchData()
    } catch (err: any) {
      setPayoutError(err.message)
    } finally {
      setPayoutSaving(false)
    }
  }

  // Formatting helpers
  const formatPrice = (price: number | null) => {
    if (price === null) return '—'
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 0
    }).format(price)
  }

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('en-IN', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    })
  }

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-[26px] font-bold tracking-tight text-txt-primary">Staff & Payroll</h1>
          <p className="text-xs text-txt-secondary mt-0.5">
            Manage agency team members, log event shifts, and process salary payout requests.
          </p>
        </div>
        
        {/* Header Action Buttons */}
        <div className="flex items-center gap-2">
          {activeTab === 'directory' && (
            <button
              onClick={() => setShowAddStaffModal(true)}
              className="flex items-center justify-center gap-2 px-4 py-2.5 bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 text-white rounded-xl text-sm font-bold shadow-md hover:-translate-y-0.5 active:translate-y-0 transition-all cursor-pointer"
            >
              <Plus className="h-4 w-4" />
              Add Staff Member
            </button>
          )}
          {activeTab === 'logs' && (
            <button
              onClick={() => setShowLogWorkModal(true)}
              className="flex items-center justify-center gap-2 px-4 py-2.5 bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 text-white rounded-xl text-sm font-bold shadow-md hover:-translate-y-0.5 active:translate-y-0 transition-all cursor-pointer"
            >
              <Plus className="h-4 w-4" />
              Log Shift Work
            </button>
          )}
          {activeTab === 'payroll' && (
            <button
              onClick={() => setShowRequestSalaryModal(true)}
              className="flex items-center justify-center gap-2 px-4 py-2.5 bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 text-white rounded-xl text-sm font-bold shadow-md hover:-translate-y-0.5 active:translate-y-0 transition-all cursor-pointer"
            >
              <DollarSign className="h-4 w-4" />
              Request Salary
            </button>
          )}
        </div>
      </div>

      {/* Tabs Selector */}
      <div className="border-b border-border-base/70">
        <nav className="flex space-x-6">
          <button
            onClick={() => setActiveTab('directory')}
            className={`pb-4 text-sm font-bold border-b-2 transition-all cursor-pointer flex items-center gap-2 ${
              activeTab === 'directory'
                ? 'border-txt-primary text-txt-primary'
                : 'border-transparent text-txt-secondary hover:text-txt-primary'
            }`}
          >
            <Users className="h-4 w-4" />
            Staff Directory
          </button>
          <button
            onClick={() => setActiveTab('logs')}
            className={`pb-4 text-sm font-bold border-b-2 transition-all cursor-pointer flex items-center gap-2 ${
              activeTab === 'logs'
                ? 'border-txt-primary text-txt-primary'
                : 'border-transparent text-txt-secondary hover:text-txt-primary'
            }`}
          >
            <ClipboardList className="h-4 w-4" />
            Shift Work Log
          </button>
          <button
            onClick={() => setActiveTab('payroll')}
            className={`pb-4 text-sm font-bold border-b-2 transition-all cursor-pointer flex items-center gap-2 ${
              activeTab === 'payroll'
                ? 'border-txt-primary text-txt-primary'
                : 'border-transparent text-txt-secondary hover:text-txt-primary'
            }`}
          >
            <DollarSign className="h-4 w-4" />
            Salary Requests & Payroll
          </button>
        </nav>
      </div>

      {loading ? (
        <div className="py-16 flex justify-center items-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-txt-primary"></div>
        </div>
      ) : errorMsg ? (
        <div className="flex items-center gap-3 p-4 bg-red-500/10 border border-red-500/20 rounded-xl text-red-500 text-sm">
          <AlertCircle className="h-5 w-5 shrink-0" />
          <span>{errorMsg}</span>
        </div>
      ) : (
        <>
          {/* TAB 1: DIRECTORY */}
          {activeTab === 'directory' && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {staff.length === 0 ? (
                <div className="col-span-full text-center py-16 bg-white dark:bg-card-base border border-border-base/55 rounded-2xl p-6 shadow-sm">
                  <Users className="h-10 w-10 text-txt-muted mx-auto mb-3" />
                  <h3 className="text-sm font-bold text-txt-primary">No team members registered</h3>
                  <p className="text-xs text-txt-secondary mt-1">Add your first photographer or videographer to begin.</p>
                </div>
              ) : (
                staff.map(member => (
                  <div
                    key={member.id}
                    className="p-5 bg-white dark:bg-card-base rounded-2xl border border-border-base/55 shadow-[0_2px_8px_rgba(0,0,0,0.06)] hover:shadow-md transition-all flex flex-col justify-between"
                  >
                    <div className="flex justify-between items-start">
                      <div>
                        <h3 className="font-bold text-txt-primary text-[17px]">{member.full_name}</h3>
                        <p className="text-xs text-txt-muted font-semibold mt-0.5">{member.role_title}</p>
                      </div>
                      <button
                        onClick={() => toggleStaffActive(member.id, member.active)}
                        className={`px-2.5 py-1 rounded-md text-[10px] uppercase font-bold tracking-wider cursor-pointer border ${
                          member.active
                            ? 'bg-emerald-500/10 text-emerald-600 border-emerald-500/25'
                            : 'bg-gray-500/10 text-gray-500 border-gray-500/20'
                        }`}
                      >
                        {member.active ? 'Active' : 'Inactive'}
                      </button>
                    </div>
                    
                    <hr className="border-border-base opacity-45 my-4" />
                    
                    <div className="space-y-1 text-xs text-txt-secondary">
                      <p><span className="font-semibold text-txt-muted">Email:</span> {member.email}</p>
                      <p><span className="font-semibold text-txt-muted">Phone:</span> {member.phone}</p>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}

          {/* TAB 2: WORK LOG */}
          {activeTab === 'logs' && (
            <div className="bg-white dark:bg-card-base border border-border-base/55 rounded-[16px] p-6 shadow-[0_2px_8px_rgba(0,0,0,0.06)]">
              <div className="pb-4 mb-4 border-b border-border-base/50">
                <h2 className="text-[16px] font-bold text-txt-primary">Staff Shift History</h2>
                <p className="text-xs text-txt-secondary mt-0.5">Logged event shoots and billing statuses.</p>
              </div>

              {workLogs.length === 0 ? (
                <div className="text-center py-16">
                  <ClipboardList className="h-10 w-10 text-txt-muted mx-auto mb-3" />
                  <h3 className="text-sm font-bold text-txt-primary">No logged shifts</h3>
                  <p className="text-xs text-txt-secondary mt-1">Log a staff member shift for a shoot to see history.</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="border-b border-border-base bg-tbl-header/45 text-xs font-bold text-txt-secondary uppercase tracking-wider">
                        <th className="px-6 py-3.5">Date</th>
                        <th className="px-6 py-3.5">Staff Member</th>
                        <th className="px-6 py-3.5">Event / Shoot Title</th>
                        <th className="px-6 py-3.5">Notes</th>
                        <th className="px-6 py-3.5">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-cell-border text-sm text-txt-primary">
                      {workLogs.map((log) => (
                        <tr key={log.id} className="hover:bg-tbl-hover/45 transition-colors border-b border-cell-border last:border-b-0">
                          <td className="px-6 py-4 text-xs font-semibold text-txt-secondary">
                            {formatDate(log.event_date)}
                          </td>
                          <td className="px-6 py-4 font-bold text-txt-primary">
                            {log.staff?.full_name || 'Unknown Staff'}
                            <div className="text-[10px] text-txt-muted font-normal mt-0.5">{log.staff?.role_title}</div>
                          </td>
                          <td className="px-6 py-4 font-semibold text-txt-secondary">
                            {log.event_title}
                          </td>
                          <td className="px-6 py-4 text-xs text-txt-muted max-w-[200px] truncate" title={log.note || ''}>
                            {log.note || '—'}
                          </td>
                          <td className="px-6 py-4">
                            <span className={`inline-flex px-2.5 py-0.5 rounded-full text-xs font-bold border ${
                              log.status === 'paid'
                                ? 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20'
                                : log.status === 'requested'
                                ? 'bg-blue-500/10 text-blue-600 border-blue-500/20 animate-pulse'
                                : 'bg-orange-500/10 text-orange-600 border-orange-500/20'
                            }`}>
                              {log.status.toUpperCase()}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* TAB 3: PAYROLL */}
          {activeTab === 'payroll' && (
            <div className="bg-white dark:bg-card-base border border-border-base/55 rounded-[16px] p-6 shadow-[0_2px_8px_rgba(0,0,0,0.06)]">
              <div className="pb-4 mb-4 border-b border-border-base/50">
                <h2 className="text-[16px] font-bold text-txt-primary">Salary Requests & Payouts</h2>
                <p className="text-xs text-txt-secondary mt-0.5">Process payouts and manage ledger cash settlements.</p>
              </div>

              {salaryRequests.length === 0 ? (
                <div className="text-center py-16">
                  <DollarSign className="h-10 w-10 text-txt-muted mx-auto mb-3" />
                  <h3 className="text-sm font-bold text-txt-primary">No salary requests logged</h3>
                  <p className="text-xs text-txt-secondary mt-1">Make a salary request to queue staff payouts.</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="border-b border-border-base bg-tbl-header/45 text-xs font-bold text-txt-secondary uppercase tracking-wider">
                        <th className="px-6 py-3.5">Requested Date</th>
                        <th className="px-6 py-3.5">Staff Member</th>
                        <th className="px-6 py-3.5">Status</th>
                        <th className="px-6 py-3.5">Note</th>
                        <th className="px-6 py-3.5">Amount Paid</th>
                        <th className="px-6 py-3.5 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-cell-border text-sm text-txt-primary">
                      {salaryRequests.map((req) => (
                        <tr key={req.id} className="hover:bg-tbl-hover/45 transition-colors border-b border-cell-border last:border-b-0">
                          <td className="px-6 py-4 text-xs font-semibold text-txt-secondary">
                            {formatDate(req.request_date)}
                          </td>
                          <td className="px-6 py-4 font-bold text-txt-primary">
                            {req.staff?.full_name || 'Unknown Staff'}
                            <div className="text-[10px] text-txt-muted font-normal mt-0.5">{req.staff?.role_title}</div>
                          </td>
                          <td className="px-6 py-4">
                            <span className={`inline-flex px-2.5 py-0.5 rounded-full text-xs font-bold border ${
                              req.status === 'paid'
                                ? 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20'
                                : 'bg-amber-500/10 text-amber-600 border-amber-500/20'
                            }`}>
                              {req.status.toUpperCase()}
                            </span>
                          </td>
                          <td className="px-6 py-4 text-xs text-txt-muted max-w-[150px] truncate" title={req.admin_note || ''}>
                            {req.admin_note || '—'}
                          </td>
                          <td className="px-6 py-4 font-bold text-txt-primary">
                            {req.amount_given ? formatPrice(req.amount_given) : '—'}
                            {req.paid_at && (
                              <div className="text-[10px] text-txt-muted font-normal mt-0.5">Paid: {formatDate(req.paid_at)}</div>
                            )}
                          </td>
                          <td className="px-6 py-4 text-right">
                            {req.status === 'pending' ? (
                              <button
                                onClick={() => {
                                  setSelectedRequest(req)
                                  setShowPayoutModal(true)
                                }}
                                className="px-3.5 py-1.5 bg-[#EFF6FF] text-[#1D4ED8] dark:bg-indigo-500/10 dark:text-indigo-400 hover:dark:bg-indigo-500/20 border border-transparent rounded-lg text-xs font-bold shadow-xs hover:scale-[1.02] transition-all cursor-pointer"
                              >
                                Record Payment
                              </button>
                            ) : (
                              <span className="text-xs text-emerald-500 font-bold flex items-center justify-end gap-1.5">
                                <CheckCircle className="h-4.5 w-4.5" />
                                Settlement Audited
                              </span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
        </>
      )}

      {/* MODAL 1: ADD STAFF */}
      {showAddStaffModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
          <div className="bg-card-base border border-border-base rounded-2xl w-full max-w-md overflow-hidden shadow-2xl p-6 relative">
            <button
              onClick={() => setShowAddStaffModal(false)}
              className="absolute top-4 right-4 p-2 rounded-lg hover:bg-sidebar-active/30 text-txt-muted hover:text-txt-primary cursor-pointer"
            >
              <X className="h-4 w-4" />
            </button>

            <h3 className="text-lg font-bold text-txt-primary mb-1">Add Staff Member</h3>
            <p className="text-xs text-txt-secondary mb-6">Register a new team member to assign shoots and payroll.</p>

            <form onSubmit={handleAddStaff} className="space-y-4">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-txt-secondary mb-1.5">
                  Full Name
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Rounak Manna"
                  value={staffName}
                  onChange={(e) => setStaffName(e.target.value)}
                  className="w-full rounded-lg border border-input-border bg-input-base px-3 py-2 text-sm text-txt-primary placeholder-txt-muted focus:border-txt-primary focus:outline-hidden focus:ring-1 focus:ring-txt-primary font-semibold"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-txt-secondary mb-1.5">
                    Role Title
                  </label>
                  <select
                    value={staffRole}
                    onChange={(e) => setStaffRole(e.target.value)}
                    className="w-full rounded-lg border border-input-border bg-input-base px-3 py-2 text-sm text-txt-primary focus:border-txt-primary focus:outline-hidden focus:ring-1 focus:ring-txt-primary cursor-pointer font-semibold"
                  >
                    <option value="Lead Photographer">Lead Photographer</option>
                    <option value="Second Shooter">Second Shooter</option>
                    <option value="Videographer">Videographer</option>
                    <option value="Editor">Editor</option>
                    <option value="Assistant">Assistant</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-txt-secondary mb-1.5">
                    Phone Number
                  </label>
                  <input
                    type="text"
                    placeholder="+91 XXXXX XXXXX"
                    value={staffPhone}
                    onChange={(e) => setStaffPhone(e.target.value)}
                    className="w-full rounded-lg border border-input-border bg-input-base px-3 py-2 text-sm text-txt-primary placeholder-txt-muted focus:border-txt-primary focus:outline-hidden focus:ring-1 focus:ring-txt-primary font-semibold"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-txt-secondary mb-1.5">
                  Email Address
                </label>
                <input
                  type="email"
                  placeholder="email@rmfilms.com"
                  value={staffEmail}
                  onChange={(e) => setStaffEmail(e.target.value)}
                  className="w-full rounded-lg border border-input-border bg-input-base px-3 py-2 text-sm text-txt-primary placeholder-txt-muted focus:border-txt-primary focus:outline-hidden focus:ring-1 focus:ring-txt-primary font-semibold"
                />
              </div>

              <div className="pt-4 flex items-center justify-end gap-3 border-t border-border-base/50 mt-6">
                <button
                  type="button"
                  onClick={() => setShowAddStaffModal(false)}
                  className="px-4 py-2 border border-border-base text-txt-secondary hover:text-txt-primary rounded-lg text-sm font-semibold hover:bg-sidebar-active/20 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={staffSaving}
                  className="px-5 py-2 bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 text-white rounded-lg text-sm font-bold shadow-md hover:-translate-y-0.5 active:translate-y-0 transition-all cursor-pointer"
                >
                  {staffSaving ? 'Saving...' : 'Register Staff'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 2: LOG WORK */}
      {showLogWorkModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
          <div className="bg-card-base border border-border-base rounded-2xl w-full max-w-md overflow-hidden shadow-2xl p-6 relative">
            <button
              onClick={() => setShowLogWorkModal(false)}
              className="absolute top-4 right-4 p-2 rounded-lg hover:bg-sidebar-active/30 text-txt-muted hover:text-txt-primary cursor-pointer"
            >
              <X className="h-4 w-4" />
            </button>

            <h3 className="text-lg font-bold text-txt-primary mb-1">Log Shift Work</h3>
            <p className="text-xs text-txt-secondary mb-6">Assign a logged work shift details to a team member.</p>

            <form onSubmit={handleLogWork} className="space-y-4">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-txt-secondary mb-1.5">
                  Select Staff Member
                </label>
                <select
                  required
                  value={logStaffId}
                  onChange={(e) => setLogStaffId(e.target.value)}
                  className="w-full rounded-lg border border-input-border bg-input-base px-3 py-2 text-sm text-txt-primary focus:border-txt-primary focus:outline-hidden focus:ring-1 focus:ring-txt-primary cursor-pointer font-semibold"
                >
                  <option value="">-- Choose Member --</option>
                  {staff.filter(s => s.active).map(s => (
                    <option key={s.id} value={s.id}>{s.full_name} ({s.role_title})</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-txt-secondary mb-1.5">
                  Select Calendar Event (Optional auto-fill)
                </label>
                <select
                  value={logEventId}
                  onChange={(e) => setLogEventId(e.target.value)}
                  className="w-full rounded-lg border border-input-border bg-input-base px-3 py-2 text-sm text-txt-primary focus:border-txt-primary focus:outline-hidden focus:ring-1 focus:ring-txt-primary cursor-pointer font-semibold"
                >
                  <option value="">-- Or enter event title below --</option>
                  {events.map(e => (
                    <option key={e.id} value={e.id}>{formatDate(e.event_date)}: {e.title}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-txt-secondary mb-1.5">
                  Event Title
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Aisha & Rohan Wedding Day 1"
                  value={logEventTitle}
                  onChange={(e) => setLogEventTitle(e.target.value)}
                  className="w-full rounded-lg border border-input-border bg-input-base px-3 py-2 text-sm text-txt-primary placeholder-txt-muted focus:border-txt-primary focus:outline-hidden focus:ring-1 focus:ring-txt-primary font-semibold"
                />
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-txt-secondary mb-1.5">
                  Event Date
                </label>
                <input
                  type="date"
                  required
                  value={logEventDate}
                  onChange={(e) => setLogEventDate(e.target.value)}
                  className="w-full rounded-lg border border-input-border bg-input-base px-3 py-2 text-sm text-txt-primary focus:border-txt-primary focus:outline-hidden focus:ring-1 focus:ring-txt-primary font-semibold"
                />
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-txt-secondary mb-1.5">
                  Admin Notes
                </label>
                <textarea
                  placeholder="Shift notes, cameras used, hours worked, etc."
                  value={logNote}
                  onChange={(e) => setLogNote(e.target.value)}
                  rows={3}
                  className="w-full rounded-lg border border-input-border bg-input-base px-3 py-2 text-sm text-txt-primary placeholder-txt-muted focus:border-txt-primary focus:outline-hidden focus:ring-1 focus:ring-txt-primary font-semibold resize-none"
                />
              </div>

              <div className="pt-4 flex items-center justify-end gap-3 border-t border-border-base/50 mt-6">
                <button
                  type="button"
                  onClick={() => setShowLogWorkModal(false)}
                  className="px-4 py-2 border border-border-base text-txt-secondary hover:text-txt-primary rounded-lg text-sm font-semibold hover:bg-sidebar-active/20 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={logSaving}
                  className="px-5 py-2 bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 text-white rounded-lg text-sm font-bold shadow-md hover:-translate-y-0.5 active:translate-y-0 transition-all cursor-pointer"
                >
                  {logSaving ? 'Saving...' : 'Log Shift'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 3: REQUEST SALARY */}
      {showRequestSalaryModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
          <div className="bg-card-base border border-border-base rounded-2xl w-full max-w-md overflow-hidden shadow-2xl p-6 relative">
            <button
              onClick={() => setShowRequestSalaryModal(false)}
              className="absolute top-4 right-4 p-2 rounded-lg hover:bg-sidebar-active/30 text-txt-muted hover:text-txt-primary cursor-pointer"
            >
              <X className="h-4 w-4" />
            </button>

            <h3 className="text-lg font-bold text-txt-primary mb-1">Request Salary</h3>
            <p className="text-xs text-txt-secondary mb-6">Queue unpaid shift logs into a salary payout request.</p>

            {reqError && (
              <div className="mb-4 flex items-center gap-2 p-3 bg-red-500/10 border border-red-500/20 text-red-500 rounded-lg text-xs font-semibold">
                <AlertCircle className="h-4 w-4 shrink-0" />
                <span>{reqError}</span>
              </div>
            )}

            <form onSubmit={handleRequestSalary} className="space-y-4">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-txt-secondary mb-1.5">
                  Select Staff Member
                </label>
                <select
                  required
                  value={reqStaffId}
                  onChange={(e) => setReqStaffId(e.target.value)}
                  className="w-full rounded-lg border border-input-border bg-input-base px-3 py-2 text-sm text-txt-primary focus:border-txt-primary focus:outline-hidden focus:ring-1 focus:ring-txt-primary cursor-pointer font-semibold"
                >
                  <option value="">-- Choose Member --</option>
                  {staff.filter(s => s.active).map(s => (
                    <option key={s.id} value={s.id}>{s.full_name} ({s.role_title})</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-txt-secondary mb-1.5">
                  Requested Amount (₹)
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-txt-muted font-bold text-sm">
                    ₹
                  </div>
                  <input
                    type="number"
                    required
                    placeholder="Enter amount"
                    value={reqAmount}
                    onChange={(e) => setReqAmount(e.target.value)}
                    className="w-full rounded-lg border border-input-border bg-input-base pl-8 pr-3 py-2 text-sm text-txt-primary placeholder-txt-muted focus:border-txt-primary focus:outline-hidden focus:ring-1 focus:ring-txt-primary font-bold"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-txt-secondary mb-1.5">
                  Admin note / Description
                </label>
                <input
                  type="text"
                  placeholder="e.g. Rohan Sen — Payout for Udaipur & Delhi Weddings"
                  value={reqNote}
                  onChange={(e) => setReqNote(e.target.value)}
                  className="w-full rounded-lg border border-input-border bg-input-base px-3 py-2 text-sm text-txt-primary placeholder-txt-muted focus:border-txt-primary focus:outline-hidden focus:ring-1 focus:ring-txt-primary font-semibold"
                />
              </div>

              <div className="pt-4 flex items-center justify-end gap-3 border-t border-border-base/50 mt-6">
                <button
                  type="button"
                  onClick={() => setShowRequestSalaryModal(false)}
                  className="px-4 py-2 border border-border-base text-txt-secondary hover:text-txt-primary rounded-lg text-sm font-semibold hover:bg-sidebar-active/20 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={reqSaving}
                  className="px-5 py-2 bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 text-white rounded-lg text-sm font-bold shadow-md hover:-translate-y-0.5 active:translate-y-0 transition-all cursor-pointer"
                >
                  {reqSaving ? 'Queuing...' : 'Create Payout Request'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 4: RECORD PAYOUT */}
      {showPayoutModal && selectedRequest && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
          <div className="bg-card-base border border-border-base rounded-2xl w-full max-w-md overflow-hidden shadow-2xl p-6 relative">
            <button
              onClick={() => {
                setShowPayoutModal(false)
                setSelectedRequest(null)
              }}
              className="absolute top-4 right-4 p-2 rounded-lg hover:bg-sidebar-active/30 text-txt-muted hover:text-txt-primary cursor-pointer"
            >
              <X className="h-4 w-4" />
            </button>

            <h3 className="text-lg font-bold text-txt-primary mb-1">Record Staff Salary Payment</h3>
            <p className="text-xs text-txt-secondary mb-6">
              Mark request for <span className="font-bold text-txt-primary">{selectedRequest.staff?.full_name}</span> as Paid. This logs a payout expense.
            </p>

            {payoutError && (
              <div className="mb-4 flex items-center gap-2 p-3 bg-red-500/10 border border-red-500/20 text-red-500 rounded-lg text-xs font-semibold">
                <AlertCircle className="h-4 w-4 shrink-0" />
                <span>{payoutError}</span>
              </div>
            )}

            <form onSubmit={handlePayout} className="space-y-4">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-txt-secondary mb-1.5">
                  Amount to Pay (₹)
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-txt-muted font-bold text-sm">
                    ₹
                  </div>
                  <input
                    type="number"
                    required
                    placeholder="Enter amount given"
                    value={payoutAmount}
                    onChange={(e) => setPayoutAmount(e.target.value)}
                    className="w-full rounded-lg border border-input-border bg-input-base pl-8 pr-3 py-2 text-sm text-txt-primary placeholder-txt-muted focus:border-txt-primary focus:outline-hidden focus:ring-1 focus:ring-txt-primary font-bold"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-txt-secondary mb-1.5">
                  Payment Reference / Admin Note
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Paid via UPI / GPay Ref ID 123456"
                  value={payoutNote}
                  onChange={(e) => setPayoutNote(e.target.value)}
                  className="w-full rounded-lg border border-input-border bg-input-base px-3 py-2 text-sm text-txt-primary placeholder-txt-muted focus:border-txt-primary focus:outline-hidden focus:ring-1 focus:ring-txt-primary font-semibold"
                />
              </div>

              <div className="pt-4 flex items-center justify-end gap-3 border-t border-border-base/50 mt-6">
                <button
                  type="button"
                  onClick={() => {
                    setShowPayoutModal(false)
                    setSelectedRequest(null)
                  }}
                  className="px-4 py-2 border border-border-base text-txt-secondary hover:text-txt-primary rounded-lg text-sm font-semibold hover:bg-sidebar-active/20 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={payoutSaving}
                  className="px-5 py-2 bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 text-white rounded-lg text-sm font-bold shadow-md hover:-translate-y-0.5 active:translate-y-0 transition-all cursor-pointer"
                >
                  {payoutSaving ? 'Processing...' : 'Confirm Payout'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}

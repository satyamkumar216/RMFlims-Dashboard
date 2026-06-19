'use client'

import React, { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/utils/supabase/client'
import { 
  isDemoMode, 
  getDemoStaff, 
  getDemoWorkLogs, 
  saveDemoWorkLogs, 
  getDemoLedger, 
  saveDemoLedger, 
  getDemoEvents,
  getDemoStaffPayments,
  saveDemoStaffPayments
} from '@/utils/supabase/demo'
import { 
  Coins, 
  Clock, 
  CheckCircle2, 
  Calendar, 
  Loader2, 
  X, 
  Check, 
  Search, 
  ChevronDown, 
  ChevronUp, 
  AlertCircle,
  Users,
  IndianRupee,
  Briefcase,
  SlidersHorizontal
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

interface WorkLog {
  id: string
  staff_id: string
  event_id: string | null
  event_title: string
  event_date: string
  note: string | null
  status: 'pending' | 'paid'
  payment_id: string | null
  created_at: string
}

interface LedgerEntry {
  id: string
  type: 'advance_received' | 'salary_paid' | 'expense' | 'other_income'
  amount: number
  reference_id: string | null
  description: string
  created_at: string
}

interface CalendarEvent {
  id: string
  title: string
  event_date: string
  event_end_date?: string | null
  event_type: string
  team_member?: string | null
  notes?: string | null
  created_at: string
}

export default function PayrollPage() {
  const router = useRouter()
  const supabase = createClient()

  // App States
  const [loading, setLoading] = useState(true)
  const [isLoggedCheck, setIsLoggedCheck] = useState(false)
  const [activeTab, setActiveTab] = useState<'overview' | 'attendance'>('overview')
  const [successMsg, setSuccessMsg] = useState('')
  const [errorMsg, setErrorMsg] = useState<string | null>(null)

  // DB Data
  const [staff, setStaff] = useState<StaffMember[]>([])
  const [workLogs, setWorkLogs] = useState<WorkLog[]>([])
  const [ledger, setLedger] = useState<LedgerEntry[]>([])
  const [events, setEvents] = useState<CalendarEvent[]>([])

  // Pay Panel Slide-out state
  const [isPayPanelOpen, setIsPayPanelOpen] = useState(false)
  const [selectedStaff, setSelectedStaff] = useState<StaffMember | null>(null)
  const [panelPendingLogs, setPanelPendingLogs] = useState<WorkLog[]>([])
  const [checkedLogIds, setCheckedLogIds] = useState<string[]>([])
  const [payAmount, setPayAmount] = useState('')
  const [adminNote, setAdminNote] = useState('')
  const [panelSaving, setPanelSaving] = useState(false)
  const [panelError, setPanelError] = useState<string | null>(null)

  // Search & Filter state for Attendance
  const [eventSearchQuery, setEventSearchQuery] = useState('')
  const [expandedEventIds, setExpandedEventIds] = useState<string[]>([])

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
      setLedger(getDemoLedger())
      setEvents(getDemoEvents())
      setLoading(false)
      return
    }

    try {
      const [staffRes, logsRes, ledgerRes, eventsRes] = await Promise.all([
        supabase.from('staff_members').select('*'),
        supabase.from('work_log').select('*'),
        supabase.from('agency_cash_ledger').select('*'),
        supabase.from('calendar_events').select('*')
      ])

      if (staffRes.error) throw staffRes.error
      if (logsRes.error) throw logsRes.error
      if (ledgerRes.error) throw ledgerRes.error
      if (eventsRes.error) throw eventsRes.error

      setStaff(staffRes.data || [])
      setWorkLogs(logsRes.data || [])
      setLedger(ledgerRes.data || [])
      setEvents(eventsRes.data || [])
    } catch (e: any) {
      console.error(e)
      setErrorMsg('Failed to load payroll data: ' + e.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (isLoggedCheck) {
      fetchData()
    }
  }, [isLoggedCheck])

  // Stat calculations
  const cashInHand = ledger.reduce((sum, item) => sum + Number(item.amount), 0)
  
  const totalAdvanceReceived = ledger
    .filter(item => item.type === 'advance_received')
    .reduce((sum, item) => sum + Number(item.amount), 0)

  const totalSalaryPaid = Math.abs(
    ledger
      .filter(item => item.type === 'salary_paid')
      .reduce((sum, item) => sum + Number(item.amount), 0)
  )

  const unpaidLogs = workLogs.filter(wl => wl.status === 'pending')
  const uniqueUnpaidStaffCount = new Set(unpaidLogs.map(wl => wl.staff_id)).size

  // Format Helper: YYYY-MM-DD to DD/MM/YYYY
  const formatDisplayDate = (dateStr: string | null | undefined) => {
    if (!dateStr) return '—'
    const cleanDate = dateStr.split('T')[0]
    const parts = cleanDate.split('-')
    if (parts.length === 3) {
      return `${parts[2]}/${parts[1]}/${parts[0]}`
    }
    return dateStr
  }

  // Calculate days ago
  const getDaysAgo = (dateStr: string) => {
    const diffTime = Date.now() - new Date(dateStr).getTime()
    return Math.floor(diffTime / (1000 * 60 * 60 * 24))
  }

  // Settle Payout Pannel triggers
  const openPayPanel = (member: StaffMember) => {
    setSelectedStaff(member)
    const pending = workLogs.filter(wl => wl.staff_id === member.id && wl.status === 'pending')
    setPanelPendingLogs(pending)
    setCheckedLogIds(pending.map(wl => wl.id))
    setPayAmount('')
    setAdminNote('')
    setPanelError(null)
    setIsPayPanelOpen(true)
  }

  const handleToggleLog = (logId: string) => {
    setCheckedLogIds(prev => 
      prev.includes(logId) ? prev.filter(id => id !== logId) : [...prev, logId]
    )
  }

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setCheckedLogIds(panelPendingLogs.map(wl => wl.id))
    } else {
      setCheckedLogIds([])
    }
  }

  // Process payout transaction with Optimistic UI updates
  const handleConfirmPayment = async () => {
    if (!selectedStaff) return
    setPanelError(null)

    const amountNum = parseFloat(payAmount)
    if (isNaN(amountNum) || amountNum <= 0) {
      setPanelError('Please enter a valid payout amount.')
      return
    }

    if (checkedLogIds.length === 0) {
      setPanelError('Please select at least one shift to pay.')
      return
    }

    setPanelSaving(true)

    // Save backups for Optimistic UI Rollback
    const backupLogs = [...workLogs]
    const backupLedger = [...ledger]

    // OPTIMISTIC UPDATES:
    // Update local workLogs
    const updatedLocalLogs = workLogs.map(wl => 
      checkedLogIds.includes(wl.id) ? { ...wl, status: 'paid' as const } : wl
    )
    setWorkLogs(updatedLocalLogs)

    // Add local ledger transaction
    const optLedgerId = 'ledger-' + Date.now()
    const optLedgerEntry: LedgerEntry = {
      id: optLedgerId,
      type: 'salary_paid',
      amount: -amountNum,
      reference_id: 'salary-opt-' + Date.now(),
      description: `Salary paid to ${selectedStaff.full_name} for ${checkedLogIds.length} work entries`,
      created_at: new Date().toISOString()
    }
    setLedger(prev => [optLedgerEntry, ...prev])

    // Close panel right away for a snappy feel
    setIsPayPanelOpen(false)

    // Backend Execution
    if (isDemoMode()) {
      // 1. Save staff payment
      const payments = getDemoStaffPayments()
      const newPayment = {
        id: 'payment-' + Date.now(),
        staff_id: selectedStaff.id,
        amount_given: amountNum,
        admin_note: adminNote.trim() || null,
        paid_at: new Date().toISOString(),
        entries_count: checkedLogIds.length
      }
      saveDemoStaffPayments([newPayment, ...payments])

      // 2. Save work logs
      const demoLogs = getDemoWorkLogs()
      const updatedDemoLogs = demoLogs.map(l => 
        checkedLogIds.includes(l.id)
          ? { ...l, status: 'paid' as const, payment_id: newPayment.id }
          : l
      )
      saveDemoWorkLogs(updatedDemoLogs)

      // 3. Save ledger
      const demoLedger = getDemoLedger()
      const newDemoLedgerEntry = {
        id: 'ledger-' + Date.now(),
        type: 'salary_paid' as const,
        amount: -amountNum,
        reference_id: newPayment.id,
        description: `Salary paid to ${selectedStaff.full_name} for ${checkedLogIds.length} work entries`,
        created_at: new Date().toISOString()
      }
      saveDemoLedger([newDemoLedgerEntry, ...demoLedger])

      setSuccessMsg('Payment recorded successfully')
      setTimeout(() => setSuccessMsg(''), 4000)
      setPanelSaving(false)
      fetchData()
      return
    }

    try {
      // 1. Create a paid staff payment row in Supabase
      const { data: dbPay, error: pError } = await supabase
        .from('staff_payments')
        .insert({
          staff_id: selectedStaff.id,
          amount_given: amountNum,
          admin_note: adminNote.trim() || null,
          paid_at: new Date().toISOString(),
          entries_count: checkedLogIds.length
        })
        .select('id')
        .single()

      if (pError) throw pError

      if (dbPay?.id) {
        // 2. Update checked work log rows
        const { error: wError } = await supabase
          .from('work_log')
          .update({
            status: 'paid',
            payment_id: dbPay.id
          })
          .in('id', checkedLogIds)

        if (wError) throw wError

        // 3. Log in Cash Ledger
        const { error: lError } = await supabase
          .from('agency_cash_ledger')
          .insert({
            type: 'salary_paid',
            amount: -amountNum,
            reference_id: dbPay.id,
            description: `Salary paid to ${selectedStaff.full_name} for ${checkedLogIds.length} work entries`
          })

        if (lError) throw lError
      }

      setSuccessMsg('Payment recorded successfully')
      setTimeout(() => setSuccessMsg(''), 4000)
      fetchData()
    } catch (err: any) {
      console.error(err)
      // ROLLBACK OPTIMISTIC STATE ON FAILURE
      setWorkLogs(backupLogs)
      setLedger(backupLedger)
      
      // Notify admin
      alert('Payment failed, please try again: ' + err.message)
    } finally {
      setPanelSaving(false)
    }
  }

  // Attendance toggler
  const toggleEventExpanded = (id: string) => {
    setExpandedEventIds(prev => 
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    )
  }

  // Prepare table overview rows per staff member
  const staffPayrollOverview = staff.map(s => {
    const memberLogs = workLogs.filter(wl => wl.staff_id === s.id)
    const totalCount = memberLogs.length
    const pendingLogs = memberLogs.filter(wl => wl.status === 'pending')
    const pendingCount = pendingLogs.length

    // Earliest created_at date among pending entries
    const pendingSince = pendingLogs.length > 0 
      ? pendingLogs.reduce((earliest, current) => 
          new Date(current.created_at).getTime() < new Date(earliest.created_at).getTime() ? current : earliest
        ).created_at 
      : null

    return {
      member: s,
      totalCount,
      pendingCount,
      pendingSince
    }
  })

  // Sort: Pending Since ascending by default (oldest waiting first), zero-pendings at the bottom
  const sortedOverview = [...staffPayrollOverview].sort((a, b) => {
    if (a.pendingCount === 0 && b.pendingCount > 0) return 1
    if (a.pendingCount > 0 && b.pendingCount === 0) return -1
    if (a.pendingCount === 0 && b.pendingCount === 0) return a.member.full_name.localeCompare(b.member.full_name)
    
    const timeA = new Date(a.pendingSince!).getTime()
    const timeB = new Date(b.pendingSince!).getTime()
    return timeA - timeB
  })

  // Filter attendance events
  const filteredEvents = events.filter(e => {
    const isConfirmed = e.event_type !== 'blocked'
    const query = eventSearchQuery.toLowerCase().trim()
    if (!query) return isConfirmed

    const matchesTitle = e.title.toLowerCase().includes(query)
    const matchesDate = formatDisplayDate(e.event_date).includes(query)
    return isConfirmed && (matchesTitle || matchesDate)
  })

  if (!isLoggedCheck) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center bg-bg-base">
        <Loader2 className="h-8 w-8 animate-spin text-txt-muted" />
      </div>
    )
  }

  return (
    <div className="space-y-8 max-w-6xl mx-auto">
      {/* Toast Success */}
      {successMsg && (
        <div className="fixed bottom-5 right-5 bg-black text-white px-4 py-3 rounded-lg shadow-lg flex items-center gap-2 z-50 animate-bounce">
          <Check className="h-4 w-4 text-green-400" />
          <span>{successMsg}</span>
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-black tracking-tight text-txt-primary">Payroll & Settlements</h1>
          <p className="text-sm text-txt-secondary mt-1">
            Manage agency cash in hand, view staff shift counts, and pay team members for logged work.
          </p>
        </div>

        {/* Tab Toggle buttons */}
        <div className="flex items-center bg-sidebar-active/30 p-1 border border-border-base rounded-xl self-start md:self-auto">
          <button
            onClick={() => setActiveTab('overview')}
            className={`px-4 py-2 text-xs font-bold rounded-lg transition-all cursor-pointer ${
              activeTab === 'overview'
                ? 'bg-card-base text-txt-primary shadow-xs border border-border-base'
                : 'text-txt-secondary hover:text-txt-primary'
            }`}
          >
            Overview & Payouts
          </button>
          <button
            onClick={() => setActiveTab('attendance')}
            className={`px-4 py-2 text-xs font-bold rounded-lg transition-all cursor-pointer ${
              activeTab === 'attendance'
                ? 'bg-card-base text-txt-primary shadow-xs border border-border-base'
                : 'text-txt-secondary hover:text-txt-primary'
            }`}
          >
            Who Worked What
          </button>
        </div>
      </div>

      {errorMsg && (
        <div className="p-4 bg-red-500/10 border border-red-500/20 text-red-500 text-sm font-semibold rounded-lg">
          {errorMsg}
        </div>
      )}

      {/* Metric Cards Section */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        {/* Cash In Hand card (Visually prominent) */}
        <div className="bg-gradient-to-br from-indigo-500/10 via-indigo-500/5 to-transparent border border-indigo-500/30 rounded-2xl p-5 shadow-base relative overflow-hidden group col-span-1 sm:col-span-2 lg:col-span-1">
          <div className="absolute top-0 right-0 p-8 opacity-5 group-hover:scale-110 group-hover:opacity-10 transition-all duration-300">
            <IndianRupee className="h-28 w-28 text-indigo-500" />
          </div>
          <span className="text-[10px] font-extrabold uppercase tracking-widest text-indigo-500 dark:text-indigo-400">Cash In Hand</span>
          <div className="text-3xl font-black text-txt-primary mt-2">
            ₹{cashInHand.toLocaleString('en-IN')}
          </div>
          <p className="text-[10px] text-txt-muted font-medium mt-1">SUM of ledger deposits minus payouts</p>
        </div>

        {/* Total Advance card */}
        <div className="bg-card-base border border-border-base rounded-2xl p-5 shadow-base flex flex-col justify-between group">
          <div>
            <span className="text-[10px] font-extrabold uppercase tracking-widest text-txt-muted">Total Advance Received</span>
            <div className="text-2xl font-extrabold text-txt-primary mt-2">
              ₹{totalAdvanceReceived.toLocaleString('en-IN')}
            </div>
          </div>
          <p className="text-[10px] text-txt-muted font-medium mt-2">Client booking deposits (all-time)</p>
        </div>

        {/* Total Salary Paid card */}
        <div className="bg-card-base border border-border-base rounded-2xl p-5 shadow-base flex flex-col justify-between group">
          <div>
            <span className="text-[10px] font-extrabold uppercase tracking-widest text-txt-muted">Total Salary Paid</span>
            <div className="text-2xl font-extrabold text-txt-primary mt-2">
              ₹{totalSalaryPaid.toLocaleString('en-IN')}
            </div>
          </div>
          <p className="text-[10px] text-txt-muted font-medium mt-2">Processed salary payments (all-time)</p>
        </div>

        {/* Pending Unpaid Shifts count representation */}
        <div className="bg-card-base border border-border-base rounded-2xl p-5 shadow-base flex flex-col justify-between group">
          <div>
            <span className="text-[10px] font-extrabold uppercase tracking-widest text-amber-500">Total Pending Salary</span>
            <div className="text-base font-extrabold text-txt-primary mt-2 leading-tight">
              {unpaidLogs.length} unpaid work entries
            </div>
          </div>
          <p className="text-[10px] text-amber-600 dark:text-amber-450 font-bold mt-2">
            Across {uniqueUnpaidStaffCount} staff members
          </p>
        </div>
      </div>

      {loading ? (
        <div className="flex flex-col items-center justify-center py-32 bg-card-base border border-border-base rounded-2xl">
          <Loader2 className="h-8 w-8 animate-spin text-txt-muted" />
          <p className="text-xs text-txt-muted mt-2">Loading payroll data...</p>
        </div>
      ) : activeTab === 'overview' ? (
        /* MAIN VIEW: STAFF OVERVIEW TABLE */
        <div className="bg-card-base border border-border-base rounded-2xl shadow-base overflow-hidden">
          <div className="px-6 py-4 border-b border-border-base/50 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div>
              <h3 className="font-extrabold text-txt-primary text-base">Staff Payroll Overview</h3>
              <p className="text-xs text-txt-secondary">Review shift summaries, wait times, and process direct settlements.</p>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-border-base/40 bg-sidebar-active/20 text-[10px] font-extrabold uppercase tracking-widest text-txt-muted">
                  <th className="px-6 py-3.5">Staff Name</th>
                  <th className="px-6 py-3.5 text-center">Total Work Logged</th>
                  <th className="px-6 py-3.5 text-center">Pending Work Count</th>
                  <th className="px-6 py-3.5">Pending Since</th>
                  <th className="px-6 py-3.5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border-base/40">
                {sortedOverview.map(({ member, totalCount, pendingCount, pendingSince }) => {
                  const daysOld = pendingSince ? getDaysAgo(pendingSince) : 0
                  const isOverdue = pendingSince && daysOld > 14

                  return (
                    <tr 
                      key={member.id}
                      className={`hover:bg-sidebar-active/10 transition-colors ${
                        isOverdue ? 'border-l-4 border-l-amber-500 bg-amber-500/[0.02]' : ''
                      }`}
                    >
                      <td className="px-6 py-4">
                        <div className="font-extrabold text-txt-primary text-sm">{member.full_name}</div>
                        <div className="text-xs text-txt-muted">{member.role_title}</div>
                      </td>
                      <td className="px-6 py-4 text-center text-sm text-txt-secondary font-medium">
                        {totalCount}
                      </td>
                      <td className="px-6 py-4 text-center">
                        <span className={`text-xs font-bold px-2.5 py-0.5 rounded-full border ${
                          pendingCount > 0 
                            ? 'bg-amber-500/10 text-amber-600 dark:text-amber-450 border-amber-500/25 font-black' 
                            : 'bg-emerald-500/5 text-emerald-600 dark:text-emerald-450 border-emerald-500/15 font-medium'
                        }`}>
                          {pendingCount}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-xs font-semibold">
                        {pendingSince ? (
                          <div className="flex flex-col gap-0.5">
                            <span className={isOverdue ? 'text-amber-600 dark:text-amber-450 font-black' : 'text-txt-primary'}>
                              {formatDisplayDate(pendingSince)}
                            </span>
                            <span className="text-[10px] text-txt-muted">
                              {daysOld === 0 ? 'today' : daysOld === 1 ? '1 day ago' : `${daysOld} days ago`}
                            </span>
                          </div>
                        ) : (
                          <span className="text-txt-muted italic font-normal">No pending work</span>
                        )}
                      </td>
                      <td className="px-6 py-4 text-right">
                        <button
                          onClick={() => openPayPanel(member)}
                          disabled={pendingCount === 0}
                          className={`px-4 py-1.5 rounded-lg text-xs font-bold shadow-xs transition-all ${
                            pendingCount > 0
                              ? 'bg-indigo-600 hover:bg-indigo-500 text-white cursor-pointer active:translate-y-0.5'
                              : 'bg-sidebar-active/30 text-txt-muted cursor-not-allowed border border-border-base/60'
                          }`}
                        >
                          Pay Now
                        </button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        /* TAB 2: EVENT-WISE ATTENDANCE VIEW ("Who Worked What") */
        <div className="space-y-4">
          {/* Controls Bar */}
          <div className="bg-card-base border border-border-base rounded-2xl p-4 shadow-base flex items-center gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 inset-y-0 my-auto h-4 w-4 text-txt-muted pointer-events-none" />
              <input
                type="text"
                placeholder="Search events by client name, shoot title, or date (e.g. Wedding, DD/MM/YYYY)..."
                value={eventSearchQuery}
                onChange={(e) => setEventSearchQuery(e.target.value)}
                className="w-full rounded-xl border border-input-border bg-input-base pl-9 pr-4 py-2 text-sm text-txt-primary placeholder-txt-muted focus:border-txt-primary focus:outline-hidden focus:ring-1 focus:ring-txt-primary font-medium"
              />
            </div>
          </div>

          {/* Events List */}
          <div className="grid grid-cols-1 gap-4">
            {filteredEvents.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-20 border border-dashed border-border-base rounded-2xl bg-card-base">
                <Briefcase className="h-10 w-10 text-txt-muted mb-3" />
                <h4 className="text-sm font-bold text-txt-primary">No events found</h4>
                <p className="text-xs text-txt-secondary mt-1">No confirmed shoots match your search query.</p>
              </div>
            ) : (
              filteredEvents.map(evt => {
                const isExpanded = expandedEventIds.includes(evt.id)
                
                // Find all work logs for this specific event
                const eventLogs = workLogs.filter(wl => wl.event_id === evt.id)

                return (
                  <div 
                    key={evt.id} 
                    className="bg-card-base border border-border-base rounded-2xl overflow-hidden shadow-xs hover:shadow-base transition-all duration-200"
                  >
                    {/* Event Header row */}
                    <div 
                      onClick={() => toggleEventExpanded(evt.id)}
                      className="p-5 flex items-center justify-between gap-4 cursor-pointer hover:bg-sidebar-active/10 transition-colors"
                    >
                      <div className="min-w-0 space-y-1">
                        <div className="flex items-center gap-2.5 flex-wrap">
                          <h4 className="font-extrabold text-txt-primary text-sm sm:text-base leading-snug truncate">
                            {evt.title}
                          </h4>
                          <span className="text-[10px] font-extrabold uppercase tracking-widest px-2 py-0.5 rounded bg-sidebar-active border border-border-base text-txt-secondary">
                            {evt.event_type.replace('_', ' ')}
                          </span>
                        </div>

                        <div className="flex items-center gap-1.5 text-xs text-txt-secondary font-medium">
                          <Calendar className="h-3.5 w-3.5 text-txt-muted" />
                          <span>{formatDisplayDate(evt.event_date)}</span>
                          <span className="text-txt-muted">·</span>
                          <span className="text-indigo-500 font-bold">
                            {eventLogs.length} logged shift{eventLogs.length !== 1 ? 's' : ''}
                          </span>
                        </div>
                      </div>

                      <button className="text-txt-muted p-1 hover:text-txt-primary hover:bg-sidebar-active/30 rounded-lg transition-colors">
                        {isExpanded ? <ChevronUp className="h-5 w-5" /> : <ChevronDown className="h-5 w-5" />}
                      </button>
                    </div>

                    {/* Expanded attendance logs */}
                    {isExpanded && (
                      <div className="px-5 pb-5 pt-1 border-t border-border-base/30 bg-sidebar-active/[0.04] space-y-3 animate-fadeIn">
                        <div className="text-[10px] font-extrabold uppercase tracking-widest text-txt-muted pb-1">
                          Staff Attendance & Shift Logs
                        </div>

                        {eventLogs.length === 0 ? (
                          <p className="text-xs text-txt-muted italic py-3 pl-2 border-l-2 border-border-base">
                            No staff members have logged shifts for this event yet.
                          </p>
                        ) : (
                          <div className="grid grid-cols-1 gap-2.5">
                            {eventLogs.map(wl => {
                              const wlStaff = staff.find(s => s.id === wl.staff_id)
                              const wlPaid = wl.status === 'paid'

                              return (
                                <div 
                                  key={wl.id}
                                  className={`p-3 rounded-xl border flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs ${
                                    wlPaid 
                                      ? 'bg-emerald-500/[0.02] border-emerald-500/10' 
                                      : 'bg-card-base border-border-base shadow-2xs'
                                  }`}
                                >
                                  <div className="space-y-1">
                                    <div className="flex items-center gap-2">
                                      <span className="font-extrabold text-txt-primary">
                                        {wlStaff ? wlStaff.full_name : 'Unknown Staff'}
                                      </span>
                                      <span className="text-[10px] text-txt-muted">
                                        ({wlStaff ? wlStaff.role_title : 'Crew'})
                                      </span>
                                    </div>
                                    {wl.note && (
                                      <p className="text-txt-secondary leading-relaxed pl-2 border-l border-border-base italic">
                                        "{wl.note}"
                                      </p>
                                    )}
                                  </div>

                                  <div className="shrink-0">
                                    {wlPaid ? (
                                      <span className="text-[10px] font-extrabold uppercase tracking-wider px-2.5 py-0.5 rounded-full bg-emerald-600 text-white">
                                        Paid
                                      </span>
                                    ) : (
                                      <span className="text-[10px] font-extrabold uppercase tracking-wider px-2.5 py-0.5 rounded-full border border-amber-500/30 text-amber-600 dark:text-amber-450 bg-amber-500/5">
                                        Pending
                                      </span>
                                    )}
                                  </div>
                                </div>
                              )
                            })}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )
              })
            )}
          </div>
        </div>
      )}

      {/* SLIDE PANEL: PAY NOW SETTLEMENTS */}
      {isPayPanelOpen && selectedStaff && (
        <div className="fixed inset-0 z-50 flex items-center justify-end bg-black/60 backdrop-blur-xs p-0 transition-opacity duration-300">
          {/* Backdrop Closer */}
          <div className="absolute inset-0 cursor-default" onClick={() => setIsPayPanelOpen(false)} />

          {/* Panel content container */}
          <div className="relative w-full max-w-lg bg-card-base border-l border-border-base h-full shadow-2xl flex flex-col z-10 animate-slideInFromRight transition-colors duration-300">
            {/* Header */}
            <div className="px-6 py-4 border-b border-border-base/50 flex items-center justify-between">
              <div>
                <h3 className="font-black text-txt-primary text-lg">Record Settlement Payout</h3>
                <p className="text-xs text-txt-secondary">Staff: <span className="font-bold text-txt-primary">{selectedStaff.full_name}</span></p>
              </div>
              <button
                onClick={() => setIsPayPanelOpen(false)}
                className="text-txt-muted hover:text-txt-primary p-2 hover:bg-sidebar-active/30 rounded-xl transition-colors cursor-pointer"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Panel Body */}
            <div className="flex-1 overflow-y-auto p-6 space-y-6">
              {panelError && (
                <div className="flex items-center gap-2 p-3 bg-red-500/10 border border-red-500/20 text-red-500 rounded-xl text-xs font-semibold animate-fadeIn">
                  <AlertCircle className="h-4 w-4 shrink-0" />
                  <span>{panelError}</span>
                </div>
              )}

              {/* Pending Shifts checkboxes list */}
              <div className="space-y-3">
                <div className="flex items-center justify-between border-b border-border-base/50 pb-2">
                  <label className="text-xs font-extrabold uppercase tracking-wider text-txt-secondary">
                    Select Shifts to Pay ({checkedLogIds.length} of {panelPendingLogs.length})
                  </label>
                  
                  {/* Select All Toggle */}
                  <div className="flex items-center gap-1.5 text-xs text-indigo-500 font-bold hover:underline cursor-pointer">
                    <input
                      type="checkbox"
                      id="select-all-panel"
                      checked={checkedLogIds.length === panelPendingLogs.length && panelPendingLogs.length > 0}
                      onChange={(e) => handleSelectAll(e.target.checked)}
                      className="rounded border-input-border text-indigo-600 focus:ring-indigo-500"
                    />
                    <label htmlFor="select-all-panel" className="cursor-pointer">Toggle All</label>
                  </div>
                </div>

                <div className="space-y-2 max-h-[220px] overflow-y-auto pr-1">
                  {panelPendingLogs.map(wl => {
                    const isChecked = checkedLogIds.includes(wl.id)

                    return (
                      <div 
                        key={wl.id}
                        onClick={() => handleToggleLog(wl.id)}
                        className={`p-3 rounded-xl border flex items-start gap-3 transition-colors cursor-pointer select-none ${
                          isChecked 
                            ? 'bg-indigo-500/[0.03] border-indigo-500/20' 
                            : 'bg-card-base border-border-base hover:bg-sidebar-active/10'
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => {}} // Controlled by outer div click
                          className="mt-0.5 rounded border-input-border text-indigo-600 focus:ring-indigo-500"
                        />
                        <div className="min-w-0 space-y-0.5">
                          <div className="font-extrabold text-txt-primary text-xs truncate leading-snug">
                            {wl.event_title}
                          </div>
                          <div className="text-[10px] text-txt-secondary flex flex-wrap gap-x-2 font-medium">
                            <span className="text-txt-muted">{formatDisplayDate(wl.event_date)}</span>
                            {wl.note && <span className="text-txt-muted truncate max-w-[200px]">· "{wl.note}"</span>}
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>

              {/* Form Input fields */}
              <div className="space-y-4 border-t border-border-base/50 pt-5">
                {/* Amount to Give input */}
                <div className="space-y-1.5">
                  <label className="block text-xs font-extrabold uppercase tracking-wider text-txt-secondary">
                    Amount to give (INR)
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-txt-muted font-bold text-sm">
                      ₹
                    </div>
                    <input
                      type="number"
                      required
                      placeholder="e.g. 5000"
                      value={payAmount}
                      onChange={(e) => setPayAmount(e.target.value)}
                      className="w-full rounded-xl border border-input-border bg-input-base pl-8 pr-4 py-2.5 text-sm text-txt-primary placeholder-txt-muted focus:border-txt-primary focus:outline-hidden focus:ring-1 focus:ring-txt-primary font-bold"
                    />
                  </div>
                </div>

                {/* Optional Admin note */}
                <div className="space-y-1.5">
                  <label className="block text-xs font-extrabold uppercase tracking-wider text-txt-secondary">
                    Admin note / Reference
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Paid via UPI Ref 12345"
                    value={adminNote}
                    onChange={(e) => setAdminNote(e.target.value)}
                    className="w-full rounded-xl border border-input-border bg-input-base px-4 py-2.5 text-sm text-txt-primary placeholder-txt-muted focus:border-txt-primary focus:outline-hidden focus:ring-1 focus:ring-txt-primary font-semibold"
                  />
                </div>
              </div>
            </div>

            {/* Footer buttons */}
            <div className="px-6 py-4 border-t border-border-base/50 bg-sidebar-active/10 flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={() => setIsPayPanelOpen(false)}
                className="px-4 py-2 border border-border-base text-txt-secondary hover:text-txt-primary rounded-xl text-xs font-semibold hover:bg-sidebar-active/30 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmPayment}
                disabled={panelSaving || checkedLogIds.length === 0}
                className="px-5 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-bold shadow-md hover:-translate-y-0.5 active:translate-y-0 transition-all cursor-pointer flex items-center gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {panelSaving && <Loader2 className="h-3 w-3 animate-spin" />}
                Confirm Payment
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

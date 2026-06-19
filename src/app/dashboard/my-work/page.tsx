'use client'

import React, { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/utils/supabase/client'
import { 
  isDemoMode, 
  getDemoWorkLogs, 
  saveDemoWorkLogs, 
  getDemoSalaryRequests, 
  saveDemoSalaryRequests 
} from '@/utils/supabase/demo'
import { 
  CheckCircle2, 
  Clock, 
  AlertCircle, 
  IndianRupee, 
  Calendar, 
  CheckSquare, 
  Square, 
  ClipboardList, 
  Send, 
  Loader2, 
  Check
} from 'lucide-react'

export default function MyWorkPage() {
  const router = useRouter()
  const supabase = createClient()

  // Session State
  const [staffId, setStaffId] = useState<string | null>(null)
  const [staffName, setStaffName] = useState<string>('')
  const [isLoggedCheck, setIsLoggedCheck] = useState(false)

  // Data State
  const [shifts, setShifts] = useState<any[]>([])
  const [requests, setRequests] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const [successMsg, setSuccessMsg] = useState('')

  // Selection & Form State
  const [selectedShiftIds, setSelectedShiftIds] = useState<string[]>([])
  const [isRequestModalOpen, setIsRequestModalOpen] = useState(false)
  const [payoutAmount, setPayoutAmount] = useState('')
  const [payoutNote, setPayoutNote] = useState('')
  const [submitting, setSubmitting] = useState(false)

  // Redirect if not logged in
  useEffect(() => {
    const sessionStr = localStorage.getItem('staff_session')
    if (!sessionStr) {
      router.push('/login')
    } else {
      try {
        const session = JSON.parse(sessionStr)
        setStaffId(session.id)
        setStaffName(session.name)
      } catch (e) {
        console.error(e)
        router.push('/login')
      }
    }
    setIsLoggedCheck(true)
  }, [router])

  const loadData = async (sid: string) => {
    setLoading(true)
    setErrorMsg(null)
    if (isDemoMode()) {
      const logs = getDemoWorkLogs().filter(log => log.staff_id === sid)
      const reqs = getDemoSalaryRequests().filter(req => req.staff_id === sid)
      setShifts(logs.sort((a, b) => new Date(b.event_date).getTime() - new Date(a.event_date).getTime()))
      setRequests(reqs.sort((a, b) => new Date(b.request_date).getTime() - new Date(a.request_date).getTime()))
      setLoading(false)
      return
    }

    try {
      const { data: logs, error: logsError } = await supabase
        .from('work_log')
        .select('*')
        .eq('staff_id', sid)
        .order('event_date', { ascending: false })
      
      if (logsError) throw logsError

      const { data: reqs, error: reqsError } = await supabase
        .from('salary_requests')
        .select('*')
        .eq('staff_id', sid)
        .order('request_date', { ascending: false })

      if (reqsError) throw reqsError

      setShifts(logs || [])
      setRequests(reqs || [])
    } catch (e: any) {
      console.error(e)
      setErrorMsg('Failed to load data: ' + e.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (staffId) {
      loadData(staffId)
    }
  }, [staffId])

  // Stats calculation
  const totalShifts = shifts.length
  const pendingPayoutsCount = shifts.filter(s => s.status !== 'paid').length
  const settledPayoutsCount = shifts.filter(s => s.status === 'paid').length

  const handleSelectShift = (id: string) => {
    setSelectedShiftIds(prev => 
      prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
    )
  }

  const handleSelectAllLogged = () => {
    const loggedIds = shifts.filter(s => s.status === 'logged').map(s => s.id)
    if (selectedShiftIds.length === loggedIds.length) {
      setSelectedShiftIds([])
    } else {
      setSelectedShiftIds(loggedIds)
    }
  }

  const handleRequestPayout = async (e: React.FormEvent) => {
    e.preventDefault()
    if (selectedShiftIds.length === 0 || !payoutAmount || !staffId) return

    const amountNum = parseFloat(payoutAmount)
    if (isNaN(amountNum) || amountNum <= 0) {
      alert('Please enter a valid positive amount.')
      return
    }

    setSubmitting(true)
    const newRequestId = 'salary-req-' + Date.now()

    if (isDemoMode()) {
      const demoReqs = getDemoSalaryRequests()
      const newReq = {
        id: newRequestId,
        staff_id: staffId,
        request_date: new Date().toISOString(),
        status: 'pending' as 'pending',
        amount_given: null,
        paid_at: null,
        admin_note: payoutNote.trim() || null,
        created_at: new Date().toISOString()
      }
      saveDemoSalaryRequests([newReq, ...demoReqs])

      const demoLogs = getDemoWorkLogs()
      const updatedLogs = demoLogs.map(log => {
        if (selectedShiftIds.includes(log.id)) {
          return {
            ...log,
            status: 'requested' as 'requested',
            salary_request_id: newRequestId
          }
        }
        return log
      })
      saveDemoWorkLogs(updatedLogs)

      setSuccessMsg('Payout request sent successfully!')
      setPayoutAmount('')
      setPayoutNote('')
      setSelectedShiftIds([])
      setIsRequestModalOpen(false)
      loadData(staffId)
      setSubmitting(false)
      setTimeout(() => setSuccessMsg(''), 4000)
      return
    }

    try {
      const { data: dbReq, error: reqError } = await supabase
        .from('salary_requests')
        .insert({
          staff_id: staffId,
          status: 'pending',
          admin_note: payoutNote.trim() || null
        })
        .select('id')
        .single()

      if (reqError) throw reqError

      if (dbReq?.id) {
        const { error: logsError } = await supabase
          .from('work_log')
          .update({
            status: 'requested',
            salary_request_id: dbReq.id
          })
          .in('id', selectedShiftIds)

        if (logsError) throw logsError
      }

      setSuccessMsg('Payout request sent successfully!')
      setPayoutAmount('')
      setPayoutNote('')
      setSelectedShiftIds([])
      setIsRequestModalOpen(false)
      loadData(staffId)
      setTimeout(() => setSuccessMsg(''), 4000)
    } catch (err: any) {
      console.error(err)
      alert('Error sending payout request: ' + err.message)
    } finally {
      setSubmitting(false)
    }
  }

  const formatDisplayDate = (dateStr: string) => {
    const d = new Date(dateStr)
    if (isNaN(d.getTime())) return dateStr
    return d.toLocaleDateString('en-IN', { day: '2-digit', month: '2-digit', year: 'numeric' })
  }

  if (!isLoggedCheck || !staffId) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-bg-base">
        <Loader2 className="h-8 w-8 animate-spin text-txt-muted" />
      </div>
    )
  }

  return (
    <div className="space-y-8">
      {/* Toast Success */}
      {successMsg && (
        <div className="fixed bottom-5 right-5 bg-black text-white px-4 py-3 rounded-lg shadow-lg flex items-center gap-2 z-50 animate-bounce">
          <Check className="h-4 w-4 text-green-400" />
          <span>{successMsg}</span>
        </div>
      )}

      {/* Header */}
      <div>
        <h1 className="text-3xl font-black tracking-tight text-txt-primary">My Work Done</h1>
        <p className="text-sm text-txt-secondary mt-1">
          Welcome back, <span className="font-bold text-txt-primary">{staffName}</span>. Track shifts and request salary payout settlements.
        </p>
      </div>

      {errorMsg && (
        <div className="p-4 bg-red-500/10 border border-red-500/20 text-red-500 text-sm font-semibold rounded-lg">
          {errorMsg}
        </div>
      )}

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
        <div className="bg-card-base border border-border-base rounded-2xl p-5 shadow-base transition-colors duration-300">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-extrabold uppercase tracking-widest text-txt-muted">Total Shifts</span>
            <ClipboardList className="h-5 w-5 text-violet-500" />
          </div>
          <div className="text-3xl font-black text-txt-primary mt-2">{totalShifts}</div>
          <p className="text-[10px] text-txt-muted font-medium mt-1">Shifts logged by agency admin</p>
        </div>

        <div className="bg-card-base border border-border-base rounded-2xl p-5 shadow-base transition-colors duration-300">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-extrabold uppercase tracking-widest text-txt-muted">Pending Payouts</span>
            <Clock className="h-5 w-5 text-amber-500" />
          </div>
          <div className="text-3xl font-black text-txt-primary mt-2">{pendingPayoutsCount}</div>
          <p className="text-[10px] text-txt-muted font-medium mt-1">Shifts awaiting settlement approval</p>
        </div>

        <div className="bg-card-base border border-border-base rounded-2xl p-5 shadow-base transition-colors duration-300">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-extrabold uppercase tracking-widest text-txt-muted">Settled Payouts</span>
            <CheckCircle2 className="h-5 w-5 text-emerald-500" />
          </div>
          <div className="text-3xl font-black text-txt-primary mt-2">{settledPayoutsCount}</div>
          <p className="text-[10px] text-txt-muted font-medium mt-1">Shifts with completed payments</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Shifts list - 2 cols */}
        <div className="lg:col-span-2 space-y-4">
          <div className="bg-card-base border border-border-base rounded-2xl p-6 shadow-base flex flex-col h-full transition-colors duration-300">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-border-base/50 pb-4 mb-4">
              <div>
                <h3 className="font-extrabold text-txt-primary text-base">Shifts Logged</h3>
                <p className="text-xs text-txt-secondary">Select shoots you worked on to request a payroll payout</p>
              </div>

              {shifts.filter(s => s.status === 'logged').length > 0 && (
                <div className="flex items-center gap-2">
                  <button
                    onClick={handleSelectAllLogged}
                    className="px-3 py-1.5 border border-border-base hover:bg-sidebar-active/50 rounded-lg text-xs font-semibold text-txt-secondary transition-colors"
                  >
                    {selectedShiftIds.length === shifts.filter(s => s.status === 'logged').length ? 'Deselect All' : 'Select All Unpaid'}
                  </button>

                  {selectedShiftIds.length > 0 && (
                    <button
                      onClick={() => setIsRequestModalOpen(true)}
                      className="px-3 py-1.5 bg-txt-primary text-bg-base rounded-lg text-xs font-bold shadow-xs hover:opacity-90 flex items-center gap-1 transition-all"
                    >
                      <Send className="h-3 w-3" />
                      <span>Request Payout ({selectedShiftIds.length})</span>
                    </button>
                  )}
                </div>
              )}
            </div>

            {loading ? (
              <div className="flex flex-col items-center justify-center py-20 flex-1">
                <Loader2 className="h-8 w-8 animate-spin text-txt-muted" />
                <p className="text-xs text-txt-muted mt-2">Loading shift history...</p>
              </div>
            ) : shifts.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-20 flex-1 border border-dashed border-border-base rounded-xl bg-sidebar-active/10">
                <ClipboardList className="h-10 w-10 text-txt-muted mb-3" />
                <h4 className="text-sm font-bold text-txt-primary">No shifts logged yet</h4>
                <p className="text-xs text-txt-secondary mt-1">Shifts will appear once the admin logs work for you.</p>
              </div>
            ) : (
              <div className="space-y-3 flex-1 overflow-y-auto max-h-[500px] pr-1">
                {shifts.map(shift => {
                  const isLogged = shift.status === 'logged'
                  const isSelected = selectedShiftIds.includes(shift.id)

                  const getStatusBadge = (s: string) => {
                    switch (s) {
                      case 'paid':
                        return 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20'
                      case 'requested':
                        return 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20 animate-pulse'
                      default:
                        return 'bg-orange-500/10 text-orange-650 dark:text-orange-450 border-orange-500/25'
                    }
                  }

                  return (
                    <div
                      key={shift.id}
                      onClick={() => isLogged && handleSelectShift(shift.id)}
                      className={`border rounded-xl p-4 flex items-start gap-4 transition-all duration-150 ${
                        isLogged ? 'cursor-pointer hover:bg-sidebar-active/30' : ''
                      } ${
                        isSelected 
                          ? 'border-indigo-500 bg-indigo-500/5' 
                          : 'border-border-base bg-card-base'
                      }`}
                    >
                      {/* Checkbox for unpaid */}
                      {isLogged ? (
                        <div className="mt-1 shrink-0">
                          {isSelected ? (
                            <CheckSquare className="h-5 w-5 text-indigo-500" />
                          ) : (
                            <Square className="h-5 w-5 text-txt-muted hover:text-txt-primary transition-colors" />
                          )}
                        </div>
                      ) : (
                        <div className="mt-1.5 shrink-0">
                          <span className="h-2.5 w-2.5 rounded-full bg-border-base block" />
                        </div>
                      )}

                      <div className="flex-1 min-w-0 space-y-1">
                        <div className="flex items-center justify-between gap-3">
                          <h4 className="font-extrabold text-txt-primary text-sm truncate">{shift.event_title}</h4>
                          <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full border shrink-0 ${getStatusBadge(shift.status)}`}>
                            {shift.status}
                          </span>
                        </div>

                        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-txt-secondary font-medium">
                          <span className="flex items-center gap-1 shrink-0">
                            <Calendar className="h-3.5 w-3.5 text-txt-muted" />
                            {formatDisplayDate(shift.event_date)}
                          </span>
                          {shift.note && (
                            <span className="text-txt-muted truncate max-w-[280px]" title={shift.note}>
                              · {shift.note}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </div>

        {/* Requests history - 1 col */}
        <div className="lg:col-span-1 space-y-4">
          <div className="bg-card-base border border-border-base rounded-2xl p-6 shadow-base flex flex-col h-full transition-colors duration-300">
            <div className="border-b border-border-base/50 pb-4 mb-4">
              <h3 className="font-extrabold text-txt-primary text-base">Payout History</h3>
              <p className="text-xs text-txt-secondary">List of payout requests submitted</p>
            </div>

            {loading ? (
              <div className="flex flex-col items-center justify-center py-20 flex-1">
                <Loader2 className="h-8 w-8 animate-spin text-txt-muted" />
              </div>
            ) : requests.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-20 flex-1 border border-dashed border-border-base rounded-xl bg-sidebar-active/10">
                <IndianRupee className="h-8 w-8 text-txt-muted mb-2.5" />
                <h4 className="text-xs font-bold text-txt-primary">No payout requests</h4>
                <p className="text-[10px] text-txt-secondary text-center px-4 mt-0.5">When you submit payout requests, they will show up here.</p>
              </div>
            ) : (
              <div className="space-y-4 flex-1 overflow-y-auto max-h-[500px] pr-1">
                {requests.map(req => {
                  const isPaid = req.status === 'paid'
                  return (
                    <div
                      key={req.id}
                      className="border border-border-base rounded-xl p-4 space-y-3 bg-card-base shadow-xs"
                    >
                      <div className="flex items-center justify-between border-b border-border-base/40 pb-2">
                        <span className="text-xs text-txt-secondary font-medium">
                          {formatDisplayDate(req.request_date)}
                        </span>
                        <span className={`text-[10px] font-extrabold uppercase tracking-widest px-2 py-0.5 rounded border ${
                          isPaid 
                            ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/25' 
                            : 'bg-amber-500/10 text-amber-600 dark:text-amber-450 border-amber-500/20'
                        }`}>
                          {req.status === 'paid' ? 'Settled' : 'Pending'}
                        </span>
                      </div>

                      <div className="space-y-1.5 text-xs">
                        <div className="flex items-baseline justify-between">
                          <span className="text-txt-secondary font-medium">Settled Amount:</span>
                          <span className="font-bold text-txt-primary text-sm">
                            {req.amount_given ? `₹${Number(req.amount_given).toLocaleString('en-IN')}` : 'TBD'}
                          </span>
                        </div>

                        {req.admin_note && (
                          <div className="flex flex-col gap-0.5 pt-1.5">
                            <span className="text-[9px] font-extrabold uppercase tracking-wider text-txt-muted">Note</span>
                            <span className="text-txt-muted leading-relaxed whitespace-pre-wrap bg-sidebar-active/30 p-2 rounded-lg border border-border-base/50">
                              {req.admin_note}
                            </span>
                          </div>
                        )}

                        {isPaid && req.paid_at && (
                          <p className="text-[10px] text-txt-muted text-right italic font-medium pt-1">
                            Paid on {formatDisplayDate(req.paid_at)}
                          </p>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Request Payout Modal */}
      {isRequestModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-fadeIn">
          <div className="bg-modal-base border border-border-base rounded-2xl w-full max-w-md overflow-hidden shadow-2xl p-6 relative transition-colors duration-300">
            <h3 className="text-lg font-bold text-txt-primary mb-1">Request Shift Payout</h3>
            <p className="text-xs text-txt-secondary mb-6">
              You are requesting payout for <span className="font-bold text-txt-primary">{selectedShiftIds.length} shifts</span>.
            </p>

            <form onSubmit={handleRequestPayout} className="space-y-4">
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
                    placeholder="Enter total amount requested"
                    value={payoutAmount}
                    onChange={e => setPayoutAmount(e.target.value)}
                    className="w-full rounded-lg border border-input-border bg-input-base pl-8 pr-3 py-2 text-sm text-txt-primary placeholder-txt-muted focus:border-txt-primary focus:outline-hidden focus:ring-1 focus:ring-txt-primary font-bold"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-txt-secondary mb-1.5">
                  Note / Shoot description
                </label>
                <textarea
                  placeholder="e.g. Udaipur shoot travel expenses + photography fees"
                  value={payoutNote}
                  onChange={e => setPayoutNote(e.target.value)}
                  rows={3}
                  className="w-full rounded-lg border border-input-border bg-input-base px-3 py-2 text-sm text-txt-primary placeholder-txt-muted focus:border-txt-primary focus:outline-hidden focus:ring-1 focus:ring-txt-primary font-semibold resize-none"
                />
              </div>

              <div className="pt-4 flex items-center justify-end gap-3 border-t border-border-base/50 mt-6">
                <button
                  type="button"
                  onClick={() => setIsRequestModalOpen(false)}
                  className="px-4 py-2 border border-border-base text-txt-secondary hover:text-txt-primary rounded-lg text-sm font-semibold hover:bg-sidebar-active/20 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-5 py-2 bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 text-white rounded-lg text-sm font-bold shadow-md hover:-translate-y-0.5 active:translate-y-0 transition-all cursor-pointer flex items-center gap-1.5"
                >
                  {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
                  Submit Request
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}

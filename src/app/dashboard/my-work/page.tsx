'use client'

import React, { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/utils/supabase/client'
import { 
  isDemoMode, 
  getDemoWorkLogs, 
  getDemoStaffPayments
} from '@/utils/supabase/demo'
import { 
  CheckCircle2, 
  Clock, 
  Calendar, 
  ClipboardList, 
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
  const [loading, setLoading] = useState(true)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const [successMsg, setSuccessMsg] = useState('')

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
        console.error('Error parsing session:', e)
        router.push('/login')
      }
    }
    setIsLoggedCheck(true)
  }, [router])

  const loadData = async (sid: string) => {
    setErrorMsg(null)
    if (isDemoMode()) {
      const logs = getDemoWorkLogs().filter(log => log.staff_id === sid)
      const reqs = getDemoStaffPayments().filter(req => req.staff_id === sid)
      
      const enrichedLogs = logs.map(log => {
        if (log.status === 'paid' && log.payment_id) {
          const req = reqs.find(r => r.id === log.payment_id)
          return {
            ...log,
            staff_payments: req ? { paid_at: req.paid_at } : null
          }
        }
        return { ...log, staff_payments: null }
      })

      setShifts(enrichedLogs.sort((a, b) => new Date(b.event_date).getTime() - new Date(a.event_date).getTime()))
      setLoading(false)
      return
    }

    try {
      const { data: logs, error: logsError } = await supabase
        .from('work_log')
        .select('*, staff_payments(paid_at)')
        .eq('staff_id', sid)
        .order('event_date', { ascending: false })
      
      if (logsError) throw logsError
      setShifts(logs || [])
    } catch (e: any) {
      console.error(e)
      setErrorMsg('Failed to load work logs: ' + e.message)
    } finally {
      setLoading(false)
    }
  }

  // Fetch initial data and subscribe to real-time updates
  useEffect(() => {
    if (!staffId) return

    setLoading(true)
    loadData(staffId)

    if (isDemoMode()) return

    // Subscribe to work_log changes for this staff member
    const channel = supabase
      .channel(`work-logs-realtime-${staffId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'work_log',
          filter: `staff_id=eq.${staffId}`
        },
        () => {
          loadData(staffId)
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [staffId])

  // Stats calculation
  const pendingCount = shifts.filter(s => s.status === 'pending').length
  const paidCount = shifts.filter(s => s.status === 'paid').length

  const formatDisplayDate = (dateStr: string | null | undefined) => {
    if (!dateStr) return '—'
    const cleanDate = dateStr.split('T')[0]
    const parts = cleanDate.split('-')
    if (parts.length === 3) {
      return `${parts[2]}/${parts[1]}/${parts[0]}`
    }
    return dateStr
  }

  if (!isLoggedCheck || !staffId) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center bg-bg-base">
        <Loader2 className="h-8 w-8 animate-spin text-txt-muted" />
      </div>
    )
  }

  return (
    <div className="space-y-8 max-w-4xl mx-auto">
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
          Welcome back, <span className="font-bold text-txt-primary">{staffName}</span>. Track your logged shifts and payout status.
        </p>
      </div>

      {errorMsg && (
        <div className="p-4 bg-red-500/10 border border-red-500/20 text-red-500 text-sm font-semibold rounded-lg animate-fadeIn">
          {errorMsg}
        </div>
      )}

      {/* Top Stat Chips */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
        {/* Pending entries card */}
        <div className="bg-card-base border border-border-base rounded-2xl p-5 shadow-base transition-all hover:shadow-md-base duration-300 flex items-center justify-between group">
          <div className="space-y-1">
            <span className="text-[10px] font-extrabold uppercase tracking-widest text-amber-500">Pending entries</span>
            <div className="text-3xl font-black text-txt-primary mt-1">{pendingCount}</div>
            <p className="text-[10px] text-txt-muted font-medium">Awaiting payroll settlement</p>
          </div>
          <div className="p-3 bg-amber-500/10 rounded-xl text-amber-500 group-hover:scale-110 transition-transform duration-300">
            <Clock className="h-6 w-6" />
          </div>
        </div>

        {/* Paid entries card */}
        <div className="bg-card-base border border-border-base rounded-2xl p-5 shadow-base transition-all hover:shadow-md-base duration-300 flex items-center justify-between group">
          <div className="space-y-1">
            <span className="text-[10px] font-extrabold uppercase tracking-widest text-emerald-500">Paid entries</span>
            <div className="text-3xl font-black text-txt-primary mt-1">{paidCount}</div>
            <p className="text-[10px] text-txt-muted font-medium">Payout completed by admin</p>
          </div>
          <div className="p-3 bg-emerald-500/10 rounded-xl text-emerald-500 group-hover:scale-110 transition-transform duration-300">
            <CheckCircle2 className="h-6 w-6" />
          </div>
        </div>
      </div>

      {/* Shifts list */}
      <div className="bg-card-base border border-border-base rounded-2xl p-6 shadow-base flex flex-col transition-all duration-300">
        <div className="border-b border-border-base/50 pb-4 mb-5">
          <h3 className="font-extrabold text-txt-primary text-lg">Shift Logs</h3>
          <p className="text-xs text-txt-secondary">Your shift logs ordered newest first.</p>
        </div>

        {loading ? (
          <div className="flex flex-col items-center justify-center py-24">
            <Loader2 className="h-8 w-8 animate-spin text-txt-muted" />
            <p className="text-xs text-txt-muted mt-2">Loading shift history...</p>
          </div>
        ) : shifts.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 border border-dashed border-border-base rounded-xl bg-sidebar-active/10">
            <ClipboardList className="h-10 w-10 text-txt-muted mb-3" />
            <h4 className="text-sm font-bold text-txt-primary">No shifts logged yet</h4>
            <p className="text-xs text-txt-secondary mt-1">Shifts will appear here once you log work on calendar events or bookings.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {shifts.map(shift => {
              const isPaid = shift.status === 'paid'

              return (
                <div
                  key={shift.id}
                  className={`border rounded-xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 transition-all duration-200 ${
                    isPaid 
                      ? 'bg-[#F0FDF4] dark:bg-emerald-950/15 border-[#bbf7d0] dark:border-emerald-850/20' 
                      : 'bg-card-base border-border-base'
                  }`}
                >
                  <div className="flex items-start gap-3.5 min-w-0">
                    <div className="mt-1 shrink-0">
                      {isPaid ? (
                        <div className="h-5 w-5 rounded-full bg-emerald-500/20 dark:bg-emerald-500/30 flex items-center justify-center text-emerald-600 dark:text-emerald-450">
                          <Check className="h-3 w-3 stroke-[3]" />
                        </div>
                      ) : (
                        <div className="h-5 w-5 rounded-full bg-amber-500/20 dark:bg-amber-500/30 flex items-center justify-center text-amber-600 dark:text-amber-450 animate-pulse">
                          <Clock className="h-3 w-3 stroke-[2.5]" />
                        </div>
                      )}
                    </div>

                    <div className="min-w-0 space-y-0.5">
                      <h4 className="font-extrabold text-txt-primary text-sm truncate leading-snug">
                        {shift.event_title}
                      </h4>
                      
                      {isPaid && (
                        <p className="text-xs text-emerald-700 dark:text-emerald-450 font-bold leading-none mt-0.5">
                          Paid on {formatDisplayDate(shift.staff_payments?.paid_at || shift.created_at)}
                        </p>
                      )}

                      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-txt-secondary font-medium pt-1">
                        <span className="flex items-center gap-1.5 shrink-0 text-txt-muted">
                          <Calendar className="h-3.5 w-3.5" />
                          {formatDisplayDate(shift.event_date)}
                        </span>
                        {shift.note && (
                          <span className="text-txt-muted italic truncate max-w-[280px] sm:max-w-[400px]" title={shift.note}>
                            · "{shift.note}"
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="shrink-0 flex items-center">
                    {isPaid ? (
                      <span className="text-[11px] font-extrabold uppercase tracking-wider px-3 py-1 rounded-full bg-emerald-600 dark:bg-emerald-500 text-white shadow-xs border border-transparent">
                        ✓ Paid
                      </span>
                    ) : (
                      <span className="text-[11px] font-extrabold uppercase tracking-wider px-3 py-1 rounded-full border border-amber-500/40 text-amber-600 dark:text-amber-450 bg-amber-500/5">
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
    </div>
  )
}

'use client'

import React, { useState, useRef, useEffect } from 'react'
import { ChevronLeft, ChevronRight, Calendar, X } from 'lucide-react'

interface MultiDatePickerProps {
  selectedDates: string[]           // YYYY-MM-DD array, sorted ascending
  onChange: (dates: string[]) => void
  allowPast?: boolean               // default false — past dates are disabled
  placeholder?: string
  label?: string
  error?: string
  className?: string
}

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
]
const DAYS_SHORT = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa']

// Format YYYY-MM-DD → DD/MM/YYYY for display
const formatDisplay = (dateStr: string): string => {
  const parts = dateStr.split('-')
  if (parts.length === 3) {
    return `${parts[2]}/${parts[1]}/${parts[0]}`
  }
  return dateStr
}

// Get today as YYYY-MM-DD (local, no timezone shift)
const getTodayStr = (): string => {
  const t = new Date()
  const y = t.getFullYear()
  const m = String(t.getMonth() + 1).padStart(2, '0')
  const d = String(t.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

// Build a YYYY-MM-DD from year, month (0-indexed), day
const buildDateStr = (y: number, m: number, d: number): string =>
  `${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`

export function MultiDatePicker({
  selectedDates,
  onChange,
  allowPast = false,
  placeholder = 'Click to select event dates',
  label,
  error,
  className = ''
}: MultiDatePickerProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [viewYear, setViewYear] = useState<number>(() => {
    if (selectedDates.length > 0) {
      return parseInt(selectedDates[0].split('-')[0], 10)
    }
    return new Date().getFullYear()
  })
  const [viewMonth, setViewMonth] = useState<number>(() => {
    if (selectedDates.length > 0) {
      return parseInt(selectedDates[0].split('-')[1], 10) - 1
    }
    return new Date().getMonth()
  })

  const containerRef = useRef<HTMLDivElement>(null)
  const todayStr = getTodayStr()

  // Close on outside click
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false)
      }
    }
    if (isOpen) document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [isOpen])

  // Jump to month containing first selected date when opening
  const handleOpen = () => {
    if (!isOpen && selectedDates.length > 0) {
      const first = selectedDates[0]
      setViewYear(parseInt(first.split('-')[0], 10))
      setViewMonth(parseInt(first.split('-')[1], 10) - 1)
    }
    setIsOpen(v => !v)
  }

  const handlePrevMonth = () => {
    if (viewMonth === 0) { setViewMonth(11); setViewYear(y => y - 1) }
    else setViewMonth(m => m - 1)
  }
  const handleNextMonth = () => {
    if (viewMonth === 11) { setViewMonth(0); setViewYear(y => y + 1) }
    else setViewMonth(m => m + 1)
  }

  const toggleDate = (dateStr: string) => {
    if (selectedDates.includes(dateStr)) {
      onChange(selectedDates.filter(d => d !== dateStr))
    } else {
      const next = [...selectedDates, dateStr].sort()
      onChange(next)
    }
  }

  const removeDate = (dateStr: string, e: React.MouseEvent) => {
    e.stopPropagation()
    onChange(selectedDates.filter(d => d !== dateStr))
  }

  // Compute grid cells for current view month
  const firstDayIndex = new Date(viewYear, viewMonth, 1).getDay()
  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate()

  const sortedSelected = [...selectedDates].sort()

  return (
    <div ref={containerRef} className={`relative ${className}`}>
      {label && (
        <label className="block text-xs font-bold text-txt-secondary uppercase tracking-wider mb-1.5">
          {label}
        </label>
      )}

      {/* Trigger field */}
      <div
        role="button"
        tabIndex={0}
        onClick={handleOpen}
        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') handleOpen() }}
        className={`flex flex-wrap gap-1.5 min-h-[42px] w-full px-3 py-2 rounded-lg border cursor-pointer bg-input-base text-txt-primary text-sm transition-all items-center ${
          error
            ? 'border-red-500 focus-within:ring-1 focus-within:ring-red-500'
            : isOpen
            ? 'border-txt-primary ring-1 ring-txt-primary'
            : 'border-input-border hover:border-txt-muted'
        }`}
      >
        {sortedSelected.length === 0 ? (
          <span className="text-txt-muted text-sm flex-1">{placeholder}</span>
        ) : (
          <div className="flex flex-wrap gap-1.5 flex-1">
            {sortedSelected.map(d => (
              <span
                key={d}
                className="inline-flex items-center gap-1 px-2 py-0.5 bg-txt-primary/10 text-txt-primary text-xs rounded-md font-semibold border border-txt-primary/20"
              >
                {formatDisplay(d)}
                <button
                  type="button"
                  onClick={(e) => removeDate(d, e)}
                  className="hover:text-red-500 transition-colors ml-0.5"
                  title={`Remove ${formatDisplay(d)}`}
                >
                  <X className="h-3 w-3" />
                </button>
              </span>
            ))}
          </div>
        )}
        <Calendar className="h-4 w-4 text-txt-muted ml-auto shrink-0" />
      </div>

      {error && <p className="mt-1 text-xs text-red-500 font-medium">{error}</p>}

      {/* Calendar popup */}
      {isOpen && (
        <div className="absolute top-full mt-2 left-0 z-[9999] bg-modal-base border border-border-base rounded-xl shadow-lg p-4 w-72 select-none animate-fadeIn">
          {/* Month navigation header */}
          <div className="flex items-center justify-between mb-3">
            <button
              type="button"
              onClick={handlePrevMonth}
              className="p-1.5 rounded-lg text-txt-muted hover:text-txt-primary hover:bg-sidebar-active transition-colors cursor-pointer"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <span className="font-bold text-sm text-txt-primary">
              {MONTHS[viewMonth]} {viewYear}
            </span>
            <button
              type="button"
              onClick={handleNextMonth}
              className="p-1.5 rounded-lg text-txt-muted hover:text-txt-primary hover:bg-sidebar-active transition-colors cursor-pointer"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>

          {/* Day-of-week headers */}
          <div className="grid grid-cols-7 text-center text-[10px] font-extrabold text-txt-muted uppercase mb-1.5">
            {DAYS_SHORT.map(d => <div key={d}>{d}</div>)}
          </div>

          {/* Day grid */}
          <div className="grid grid-cols-7 gap-0.5">
            {/* Empty padding cells */}
            {Array.from({ length: firstDayIndex }).map((_, i) => (
              <div key={`pad-${i}`} />
            ))}

            {/* Day cells */}
            {Array.from({ length: daysInMonth }).map((_, i) => {
              const day = i + 1
              const dateStr = buildDateStr(viewYear, viewMonth, day)
              const isPast = !allowPast && dateStr < todayStr
              const isSelected = selectedDates.includes(dateStr)
              const isToday = dateStr === todayStr

              return (
                <button
                  key={day}
                  type="button"
                  disabled={isPast}
                  onClick={() => !isPast && toggleDate(dateStr)}
                  className={`w-9 h-9 rounded-full text-sm font-semibold flex items-center justify-center transition-all mx-auto ${
                    isPast
                      ? 'text-txt-muted/35 cursor-not-allowed'
                      : isSelected
                      ? 'bg-txt-primary text-bg-base shadow-sm hover:opacity-90'
                      : isToday
                      ? 'border-2 border-indigo-500 text-indigo-600 dark:text-indigo-400 hover:bg-sidebar-active'
                      : 'text-txt-secondary hover:bg-sidebar-active cursor-pointer'
                  }`}
                  title={isPast ? 'Date is in the past' : formatDisplay(dateStr)}
                >
                  {day}
                </button>
              )
            })}
          </div>

          {/* Footer */}
          <div className="flex items-center justify-between mt-3 pt-3 border-t border-border-base">
            <span className="text-xs text-txt-muted font-medium">
              {selectedDates.length === 0
                ? 'No dates selected'
                : `${selectedDates.length} date${selectedDates.length !== 1 ? 's' : ''} selected`}
            </span>
            <button
              type="button"
              onClick={() => setIsOpen(false)}
              className="px-3.5 py-1.5 text-xs font-bold bg-txt-primary text-bg-base rounded-lg hover:opacity-90 transition-opacity cursor-pointer"
            >
              Done
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

// Utility helpers for consumers of this component

/** Parse comma-separated YYYY-MM-DD string from DB into string[] */
export const parseEventDates = (
  eventDatesStr: string | null | undefined,
  eventDateFallback?: string | null,
  eventEndDateFallback?: string | null
): string[] => {
  if (eventDatesStr) {
    const parsed = eventDatesStr.split(',').map(d => d.trim()).filter(Boolean).sort()
    if (parsed.length > 0) return parsed
  }
  // Fallback: expand from start/end range for backward compat
  if (!eventDateFallback) return []
  const start = eventDateFallback
  const end = eventEndDateFallback || start
  const [sY, sM, sD] = start.split('-').map(Number)
  const [eY, eM, eD] = end.split('-').map(Number)
  const startUTC = Date.UTC(sY, sM - 1, sD)
  const endUTC = Date.UTC(eY, eM - 1, eD)
  const dates: string[] = []
  let curr = startUTC
  while (curr <= endUTC) {
    const d = new Date(curr)
    dates.push(`${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`)
    curr += 86400000
  }
  return dates
}

/** Format a sorted YYYY-MM-DD[] for display in receipts / booking cards */
export const formatMultiDates = (dates: string[]): string => {
  if (dates.length === 0) return '—'
  const display = (d: string) => {
    const [y, m, day] = d.split('-').map(Number)
    return new Date(y, m - 1, day).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
  }
  if (dates.length === 1) return display(dates[0])
  // Check if consecutive
  let allConsec = true
  for (let i = 1; i < dates.length; i++) {
    const prev = new Date(dates[i - 1] + 'T00:00:00Z').getTime()
    const curr = new Date(dates[i] + 'T00:00:00Z').getTime()
    if (curr - prev !== 86400000) { allConsec = false; break }
  }
  const [y0, m0, d0] = dates[0].split('-').map(Number)
  const [yL, mL, dL] = dates[dates.length - 1].split('-').map(Number)
  if (allConsec) {
    return `${new Date(y0, m0 - 1, d0).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })} — ${new Date(yL, mL - 1, dL).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })} (${dates.length} days)`
  }
  // Non-consecutive: show each date
  return dates.map(d => {
    const [y, m, day] = d.split('-').map(Number)
    return new Date(y, m - 1, day).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
  }).join(', ')
}

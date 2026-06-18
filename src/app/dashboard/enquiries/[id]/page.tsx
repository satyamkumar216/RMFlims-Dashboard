'use client'

import React, { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/utils/supabase/client'
import { isDemoMode, getDemoEnquiries, saveDemoEnquiries, getDemoEvents, saveDemoEvents, getDemoBookings, saveDemoBookings } from '@/utils/supabase/demo'
import { ArrowLeft, Save, ShieldAlert, CheckCircle2, Loader2, Printer, X, FileText, Calendar as CalendarIcon, ChevronLeft, ChevronRight } from 'lucide-react'

interface Enquiry {
  id: string
  name: string
  email: string
  phone: string
  package: string
  event_date: string
  event_end_date?: string | null
  message: string
  agreed_price: number | null
  status: 'new' | 'in_progress' | 'confirmed' | 'cancelled'
  notes?: string | null
  location?: string | null
  created_at: string
  payment_status?: 'due' | 'advance_paid' | 'fully_paid' | null
  payment_method?: string | null
  payment_timeline?: string | null
  paid_amount?: number | null
}

// Helper: Convert YYYY-MM-DD to DD/MM/YYYY
const dbDateToDisplayDate = (dbDate: string | null | undefined): string => {
  if (!dbDate) return ''
  const parts = dbDate.split('T')[0].split('-')
  if (parts.length === 3) {
    return `${parts[2]}/${parts[1]}/${parts[0]}`
  }
  return dbDate
}

// Helper: Convert DD/MM/YYYY to YYYY-MM-DD
const displayDateToDbDate = (displayDate: string): string => {
  if (!displayDate) return ''
  const parts = displayDate.split('/')
  if (parts.length === 3) {
    const d = parts[0].padStart(2, '0')
    const m = parts[1].padStart(2, '0')
    const y = parts[2]
    return `${y}-${m}-${d}`
  }
  return displayDate
}

// Helper: Validate DD/MM/YYYY format and validity
const isInvalidDate = (displayDate: string): boolean => {
  if (!displayDate) return false
  const parts = displayDate.split('/')
  if (parts.length !== 3) return true
  const [d, m, y] = parts.map(Number)
  if (isNaN(d) || isNaN(m) || isNaN(y)) return true
  if (m < 1 || m > 12 || d < 1 || d > 31 || y < 2000 || y > 2100) return true
  const dt = new Date(y, m - 1, d)
  return dt.getFullYear() !== y || dt.getMonth() !== m - 1 || dt.getDate() !== d
}

export default function EnquiryDetailPage() {
  const router = useRouter()
  const params = useParams()
  const id = params.id as string
  const supabase = createClient()

  const [enquiry, setEnquiry] = useState<Enquiry | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const [successMsg, setSuccessMsg] = useState<string | null>(null)


  // Form states
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [eventDate, setEventDate] = useState('')
  const [eventEndDate, setEventEndDate] = useState('')
  const [packageName, setPackageName] = useState('')
  const [agreedPrice, setAgreedPrice] = useState<string>('')
  const [status, setStatus] = useState<Enquiry['status']>('new')
  const [notes, setNotes] = useState('')
  const [location, setLocation] = useState('')
  
  // Custom booking portfolio selection (only visible when status is confirmed)
  const [bookingType, setBookingType] = useState<'marriage' | 'brand_photoshoot' | 'portfolio_shoot' | 'model_shoot' | 'reel_shoot'>('marriage')

  // Payment states
  const [paymentStatus, setPaymentStatus] = useState<'due' | 'advance_paid' | 'fully_paid'>('due')
  const [paymentMethod, setPaymentMethod] = useState<string>('')
  const [paymentTimeline, setPaymentTimeline] = useState<string>('after_shoot')
  const [paidAmount, setPaidAmount] = useState<string>('')

  // Receipt Modal State
  const [showReceipt, setShowReceipt] = useState(false)

  // Custom calendar picker states
  const [openCalendar, setOpenCalendar] = useState<'start' | 'end' | null>(null)
  const [calendarViewDate, setCalendarViewDate] = useState<Date>(new Date())
  const startCalendarRef = React.useRef<HTMLDivElement>(null)
  const endCalendarRef = React.useRef<HTMLDivElement>(null)

  // Click outside listener for custom calendar popups
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (openCalendar === 'start' && startCalendarRef.current && !startCalendarRef.current.contains(event.target as Node)) {
        const clickedToggle = (event.target as HTMLElement).closest('.start-date-toggle')
        if (!clickedToggle) {
          setOpenCalendar(null)
        }
      }
      if (openCalendar === 'end' && endCalendarRef.current && !endCalendarRef.current.contains(event.target as Node)) {
        const clickedToggle = (event.target as HTMLElement).closest('.end-date-toggle')
        if (!clickedToggle) {
          setOpenCalendar(null)
        }
      }
    }

    if (openCalendar) {
      document.addEventListener('mousedown', handleClickOutside)
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [openCalendar])

  const parseDisplayDate = (displayStr: string): Date | null => {
    if (!displayStr) return null
    const parts = displayStr.split('/')
    if (parts.length === 3) {
      const [d, m, y] = parts.map(Number)
      if (!isNaN(d) && !isNaN(m) && !isNaN(y) && m >= 1 && m <= 12 && d >= 1 && d <= 31) {
        const dt = new Date(y, m - 1, d)
        if (dt.getFullYear() === y && dt.getMonth() === m - 1 && dt.getDate() === d) {
          return dt
        }
      }
    }
    return null
  }

  const toggleCalendar = (type: 'start' | 'end') => {
    if (openCalendar === type) {
      setOpenCalendar(null)
    } else {
      const dateVal = type === 'start' ? eventDate : eventEndDate
      const parsed = parseDisplayDate(dateVal)
      setCalendarViewDate(parsed || new Date())
      setOpenCalendar(type)
    }
  }

  const renderDaysGrid = (type: 'start' | 'end') => {
    const year = calendarViewDate.getFullYear()
    const month = calendarViewDate.getMonth()
    const firstDayIndex = new Date(year, month, 1).getDay()
    const totalDays = new Date(year, month + 1, 0).getDate()

    const today = new Date()
    today.setHours(0, 0, 0, 0)

    const cells = []
    for (let i = 0; i < firstDayIndex; i++) {
      cells.push(<div key={`empty-${i}`} className="w-8 h-8" />)
    }

    for (let day = 1; day <= totalDays; day++) {
      const cellDateStr = `${String(day).padStart(2, '0')}/${String(month + 1).padStart(2, '0')}/${year}`
      const cellDateObj = new Date(year, month, day)
      const isDisabled = cellDateObj < today
      const isSelected = (type === 'start' ? eventDate : eventEndDate) === cellDateStr

      if (isDisabled) {
        cells.push(
          <button
            key={`day-${day}`}
            type="button"
            disabled={true}
            className="w-8 h-8 rounded-full flex items-center justify-center font-semibold text-txt-muted/40 cursor-not-allowed"
            title="Date is in the past"
          >
            {day}
          </button>
        )
      } else {
        cells.push(
          <button
            key={`day-${day}`}
            type="button"
            onClick={() => {
              if (type === 'start') {
                setEventDate(cellDateStr)
              } else {
                setEventEndDate(cellDateStr)
              }
              setOpenCalendar(null)
            }}
            className={`w-8 h-8 rounded-full flex items-center justify-center font-semibold transition-colors hover:bg-sidebar-active ${
              isSelected 
                ? 'bg-txt-primary text-bg-base hover:opacity-90' 
                : 'text-txt-secondary'
            }`}
          >
            {day}
          </button>
        )
      }
    }

    return cells
  }

  const handleDateInputChange = (val: string, setter: (v: string) => void) => {
    let cleaned = val.replace(/[^0-9]/g, '')
    if (cleaned.length > 8) {
      cleaned = cleaned.slice(0, 8)
    }
    
    let formatted = cleaned
    if (cleaned.length > 2) {
      formatted = cleaned.slice(0, 2) + '/' + cleaned.slice(2)
    }
    if (cleaned.length > 4) {
      formatted = formatted.slice(0, 5) + '/' + cleaned.slice(4)
    }
    
    setter(formatted)
  }

  // Keep paid amount synced if fully paid
  useEffect(() => {
    if (paymentStatus === 'fully_paid') {
      setPaidAmount(agreedPrice)
    }
  }, [agreedPrice, paymentStatus])

  const handlePaymentStatusChange = (val: 'due' | 'advance_paid' | 'fully_paid') => {
    setPaymentStatus(val)
    if (val === 'due') {
      setPaidAmount('0')
    } else if (val === 'fully_paid') {
      setPaidAmount(agreedPrice)
      setPaymentTimeline('before_shoot')
      if (paymentMethod === '') {
        setPaymentMethod('UPI')
      }
    } else if (val === 'advance_paid') {
      if (agreedPrice && (paidAmount === '' || parseFloat(paidAmount) === 0 || parseFloat(paidAmount) === parseFloat(agreedPrice))) {
        setPaidAmount(String(parseFloat(agreedPrice) / 2))
      }
      if (paymentTimeline === 'before_shoot' || paymentTimeline === 'after_shoot') {
        setPaymentTimeline('split_50_50')
      }
    }
  }

  useEffect(() => {
    async function fetchEnquiry() {
      if (!id) return
      setLoading(true)
      setErrorMsg(null)

      if (isDemoMode()) {
        const demoData = getDemoEnquiries()
        const found = demoData.find((e) => e.id === id)
        if (found) {
          setEnquiry(found as any)
          setName(found.name)
          setEmail(found.email)
          setPhone(found.phone)
          setEventDate(dbDateToDisplayDate(found.event_date))
          setEventEndDate(dbDateToDisplayDate(found.event_end_date || found.event_date))
          setPackageName(found.package)
          setAgreedPrice(found.agreed_price !== null ? String(found.agreed_price) : '')
          setStatus(found.status)
          setNotes(found.notes || '')
          setLocation(found.location || '')
          setPaymentStatus(found.payment_status || 'due')
          setPaymentMethod(found.payment_method || '')
          setPaymentTimeline(found.payment_timeline || 'after_shoot')
          setPaidAmount(found.paid_amount !== undefined && found.paid_amount !== null ? String(found.paid_amount) : '')
        } else {
          setErrorMsg('Enquiry not found.')
        }
        setLoading(false)
        return
      }

      try {
        const { data, error } = await supabase
          .from('enquiries')
          .select('*')
          .eq('id', id)
          .single()

        if (error) {
          setErrorMsg(error.message)
        } else if (data) {
          setEnquiry(data)
          setName(data.name)
          setEmail(data.email)
          setPhone(data.phone)
          setEventDate(dbDateToDisplayDate(data.event_date))
          setEventEndDate(dbDateToDisplayDate(data.event_end_date || data.event_date))
          setPackageName(data.package)
          setAgreedPrice(data.agreed_price !== null ? String(data.agreed_price) : '')
          setStatus(data.status)
          setNotes(data.notes || '')
          setLocation(data.location || '')
          setPaymentStatus(data.payment_status || 'due')
          setPaymentMethod(data.payment_method || '')
          setPaymentTimeline(data.payment_timeline || 'after_shoot')
          setPaidAmount(data.paid_amount !== undefined && data.paid_amount !== null ? String(data.paid_amount) : '')
        }
      } catch (err) {
        setErrorMsg('Failed to load enquiry detail.')
      } finally {
        setLoading(false)
      }
    }

    fetchEnquiry()
  }, [id, supabase])

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!enquiry) return

    setSaving(true)
    setErrorMsg(null)
    setSuccessMsg(null)

    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setErrorMsg('Please enter a valid email address (e.g. client@example.com).')
      setSaving(false)
      return
    }

    if (isInvalidDate(eventDate)) {
      setErrorMsg('Please enter a valid Start Date in DD/MM/YYYY format.')
      setSaving(false)
      return
    }
    if (eventEndDate && isInvalidDate(eventEndDate)) {
      setErrorMsg('Please enter a valid End Date in DD/MM/YYYY format.')
      setSaving(false)
      return
    }

    const dbStart = displayDateToDbDate(eventDate)
    const dbEnd = displayDateToDbDate(eventEndDate || eventDate)

    if (dbEnd < dbStart) {
      setErrorMsg('End Date cannot be before Start Date.')
      setSaving(false)
      return
    }

    const today = new Date()
    const y = today.getFullYear()
    const m = String(today.getMonth() + 1).padStart(2, '0')
    const d = String(today.getDate()).padStart(2, '0')
    const todayStr = `${y}-${m}-${d}`

    if (dbStart < todayStr) {
      setErrorMsg('Event date cannot be in the past.')
      setSaving(false)
      return
    }

    const numericPrice = agreedPrice === '' ? null : parseFloat(agreedPrice)

    if (isDemoMode()) {
      try {
        const demoEnquiries = getDemoEnquiries()
        const updated = demoEnquiries.map((item) => {
          if (item.id === id) {
            return {
              ...item,
              name,
              email,
              phone,
              event_date: dbStart,
              event_end_date: dbEnd,
              package: packageName,
              agreed_price: numericPrice,
              status,
              notes: notes === '' ? null : notes,
              location: location === '' ? null : location,
              payment_status: paymentStatus,
              payment_method: paymentMethod === '' ? null : paymentMethod,
              payment_timeline: paymentTimeline,
              paid_amount: paidAmount === '' ? null : parseFloat(paidAmount)
            }
          }
          return item
        })
        saveDemoEnquiries(updated)

        // Automatically create or update calendar event if status is "confirmed"
        if (status === 'confirmed') {
          const demoEvents = getDemoEvents()
          const existingIndex = demoEvents.findIndex((evt) => evt.enquiry_id === id)
          let eventId = 'event-' + Date.now()
          if (existingIndex !== -1) {
            eventId = demoEvents[existingIndex].id
            demoEvents[existingIndex] = {
              ...demoEvents[existingIndex],
              title: `${bookingType.replace('_', ' ').replace(/\b\w/g, c => c.toUpperCase())}: ${name}`,
              event_date: dbStart,
              event_end_date: dbEnd,
              event_type: bookingType as any,
              notes: `Package: ${packageName}. Price agreed: ${numericPrice ? '₹' + numericPrice : '—'}. Location: ${location || '—'}. ${notes ? 'Notes: ' + notes : ''}`,
            }
            saveDemoEvents(demoEvents)
          } else {
            const newEvent = {
              id: eventId,
              enquiry_id: id,
              title: `${bookingType.replace('_', ' ').replace(/\b\w/g, c => c.toUpperCase())}: ${name}`,
              event_date: dbStart,
              event_end_date: dbEnd,
              event_type: bookingType as any,
              team_member: null,
              notes: `Package: ${packageName}. Price agreed: ${numericPrice ? '₹' + numericPrice : '—'}. Location: ${location || '—'}. ${notes ? 'Notes: ' + notes : ''}`,
              created_at: new Date().toISOString()
            }
            saveDemoEvents([...demoEvents, newEvent])
          }

          // Auto-create booking record if not exists
          const demoBookings = getDemoBookings()
          const existingBookingIdx = demoBookings.findIndex((b) => b.enquiry_id === id)
          const finalPrice = numericPrice || 0
          const finalAdvance = paidAmount === '' ? 0 : parseFloat(paidAmount)
          const finalBalance = Math.max(0, finalPrice - finalAdvance)
          
          let payStatus: 'due' | 'partial' | 'paid' = 'due'
          if (paymentStatus === 'fully_paid') payStatus = 'paid'
          else if (paymentStatus === 'advance_paid') payStatus = 'partial'

          const nextReceipt = () => {
            const year = new Date().getFullYear();
            let maxNum = 0;
            demoBookings.forEach(b => {
              const match = b.receipt_number.match(/XYZ-(\d+)-(\d+)/)
              if (match && Number(match[1]) === year) {
                const num = Number(match[2])
                if (num > maxNum) maxNum = num
              }
            })
            return `XYZ-${year}-${String(maxNum + 1).padStart(3, '0')}`
          }

          if (existingBookingIdx !== -1) {
            demoBookings[existingBookingIdx] = {
              ...demoBookings[existingBookingIdx],
              client_name: name,
              email,
              phone,
              event_type: bookingType,
              event_date_start: dbStart,
              event_date_end: dbEnd || dbStart,
              location: location || '—',
              package: packageName,
              special_requirements: notes || '',
              agreed_price: finalPrice,
              advance_paid: finalAdvance,
              balance_due: finalBalance,
              payment_status: payStatus,
              payment_method: paymentMethod || 'UPI',
              payment_terms: paymentTimeline || '50% Advance / 50% After Shoot',
              booking_status: 'confirmed',
              admin_notes: notes || ''
            }
          } else {
            demoBookings.push({
              id: 'booking-' + Date.now(),
              enquiry_id: id,
              calendar_event_id: eventId,
              source: 'enquiry',
              client_name: name,
              email,
              phone,
              how_found: 'Instagram',
              event_type: bookingType,
              event_date_start: dbStart,
              event_date_end: dbEnd || dbStart,
              location: location || '—',
              package: packageName,
              agreed_price: finalPrice,
              advance_paid: finalAdvance,
              balance_due: finalBalance,
              payment_status: payStatus,
              payment_method: paymentMethod || 'UPI',
              payment_terms: paymentTimeline || '50% Advance / 50% After Shoot',
              booking_status: 'confirmed',
              receipt_number: nextReceipt(),
              created_at: new Date().toISOString()
            })
          }
          saveDemoBookings(demoBookings)
        }

        setEnquiry({
          ...enquiry,
          name,
          email,
          phone,
          event_date: dbStart,
          event_end_date: dbEnd,
          package: packageName,
          agreed_price: numericPrice,
          status,
          notes: notes === '' ? null : notes,
          location: location === '' ? null : location,
          payment_status: paymentStatus,
          payment_method: paymentMethod === '' ? null : paymentMethod,
          payment_timeline: paymentTimeline,
          paid_amount: paidAmount === '' ? null : parseFloat(paidAmount)
        })
        setSuccessMsg('Enquiry saved successfully (Demo Mode).')
        setSaving(false)
        router.refresh()
        return
      } catch (err: any) {
        setErrorMsg('Failed to save in Demo Mode.')
        setSaving(false)
        return
      }
    }

    try {
      // 1. Update the enquiry
      const { error: updateError } = await supabase
        .from('enquiries')
        .update({
          name,
          email,
          phone,
          event_date: dbStart,
          event_end_date: dbEnd,
          package: packageName,
          agreed_price: numericPrice,
          status,
          notes: notes === '' ? null : notes,
          location: location === '' ? null : location,
          payment_status: paymentStatus,
          payment_method: paymentMethod === '' ? null : paymentMethod,
          payment_timeline: paymentTimeline,
          paid_amount: paidAmount === '' ? null : parseFloat(paidAmount)
        })
        .eq('id', id)

      if (updateError) {
        throw new Error(updateError.message)
      }

      // 2. Automatically create or update calendar event if status is "confirmed"
      if (status === 'confirmed') {
        const { data: existingEvents, error: checkError } = await supabase
          .from('calendar_events')
          .select('id')
          .eq('enquiry_id', id)

        if (checkError) {
          console.error('Error checking existing booking event:', checkError)
        }

        let calendarEventId = null

        if (existingEvents && existingEvents.length > 0) {
          calendarEventId = existingEvents[0].id
          const { error: updateEventError } = await supabase
            .from('calendar_events')
            .update({
              title: `${bookingType.replace('_', ' ').replace(/\b\w/g, c => c.toUpperCase())}: ${name}`,
              event_date: dbStart,
              event_end_date: dbEnd,
              event_type: bookingType,
              notes: `Package: ${packageName}. Price agreed: ${numericPrice ? '₹' + numericPrice : '—'}. Location: ${location || '—'}. ${notes ? 'Notes: ' + notes : ''}`,
            })
            .eq('enquiry_id', id)

          if (updateEventError) {
            console.error('Failed to update calendar event:', updateEventError)
            setErrorMsg(`Enquiry updated, but failed to update calendar event: ${updateEventError.message}`)
            return
          }
        } else {
          const { data: insertedEvent, error: insertError } = await supabase
            .from('calendar_events')
            .insert({
              enquiry_id: id,
              title: `${bookingType.replace('_', ' ').replace(/\b\w/g, c => c.toUpperCase())}: ${name}`,
              event_date: dbStart,
              event_end_date: dbEnd,
              event_type: bookingType,
              notes: `Package: ${packageName}. Price agreed: ${numericPrice ? '₹' + numericPrice : '—'}. Location: ${location || '—'}. ${notes ? 'Notes: ' + notes : ''}`,
            })
            .select('id')
            .single()

          if (insertError) {
            console.error('Failed to auto-insert calendar event:', insertError)
            setErrorMsg(`Enquiry updated, but failed to create calendar event: ${insertError.message}`)
            return
          }
          calendarEventId = insertedEvent?.id
        }

        // Auto-create or update booking record in Supabase
        if (calendarEventId) {
          const finalPrice = numericPrice || 0
          const finalAdvance = paidAmount === '' ? 0 : parseFloat(paidAmount)
          const finalBalance = Math.max(0, finalPrice - finalAdvance)
          
          let payStatus: 'due' | 'partial' | 'paid' = 'due'
          if (paymentStatus === 'fully_paid') payStatus = 'paid'
          else if (paymentStatus === 'advance_paid') payStatus = 'partial'

          const { data: existingBooking } = await supabase
            .from('bookings')
            .select('id')
            .eq('enquiry_id', id)
            .maybeSingle()

          if (existingBooking) {
            await supabase
              .from('bookings')
              .update({
                client_name: name,
                email,
                phone,
                event_type: bookingType,
                event_date_start: dbStart,
                event_date_end: dbEnd || dbStart,
                location: location || '—',
                package: packageName,
                agreed_price: finalPrice,
                advance_paid: finalAdvance,
                balance_due: finalBalance,
                payment_status: payStatus,
                payment_method: paymentMethod || 'UPI',
                payment_terms: paymentTimeline || '50% Advance / 50% After Shoot',
                booking_status: 'confirmed',
                admin_notes: notes || '',
                special_requirements: notes || ''
              })
              .eq('enquiry_id', id)
          } else {
            // Generate receipt number
            const { data: allB } = await supabase
              .from('bookings')
              .select('receipt_number')

            const year = new Date().getFullYear();
            let maxNum = 0;
            (allB || []).forEach(b => {
              const match = b.receipt_number.match(/XYZ-(\d+)-(\d+)/)
              if (match && Number(match[1]) === year) {
                const num = Number(match[2])
                if (num > maxNum) maxNum = num
              }
            })
            const rNumber = `XYZ-${year}-${String(maxNum + 1).padStart(3, '0')}`

            await supabase
              .from('bookings')
              .insert({
                enquiry_id: id,
                calendar_event_id: calendarEventId,
                source: 'enquiry',
                client_name: name,
                email,
                phone,
                how_found: 'Instagram',
                event_type: bookingType,
                event_date_start: dbStart,
                event_date_end: dbEnd || dbStart,
                location: location || '—',
                package: packageName,
                agreed_price: finalPrice,
                advance_paid: finalAdvance,
                balance_due: finalBalance,
                payment_status: payStatus,
                payment_method: paymentMethod || 'UPI',
                payment_terms: paymentTimeline || '50% Advance / 50% After Shoot',
                booking_status: 'confirmed',
                admin_notes: notes || '',
                special_requirements: notes || '',
                receipt_number: rNumber
              })
          }
        }
      }

      setEnquiry((prev) =>
        prev
          ? {
              ...prev,
              name,
              email,
              phone,
              event_date: dbStart,
              event_end_date: dbEnd,
              package: packageName,
              agreed_price: numericPrice,
              status,
              notes,
              location,
              payment_status: paymentStatus,
              payment_method: paymentMethod === '' ? null : paymentMethod,
              payment_timeline: paymentTimeline,
              paid_amount: paidAmount === '' ? null : parseFloat(paidAmount)
            }
          : null
      )

      setSuccessMsg('Enquiry saved successfully.')
      router.refresh()
    } catch (err: any) {
      setErrorMsg(err.message || 'An error occurred while saving.')
    } finally {
      setSaving(false)
    }
  }

  const handlePrint = () => {
    window.print()
  }

  // Format Date to DD/MM/YYYY
  const formatDateToDDMMYYYY = (dateStr: string | Date | null | undefined) => {
    if (!dateStr) return ''
    const date = typeof dateStr === 'string' ? new Date(dateStr) : dateStr
    if (typeof dateStr === 'string' && dateStr.includes('-') && !dateStr.includes('T')) {
      const [y, m, d] = dateStr.split('-').map(Number)
      return `${String(d).padStart(2, '0')}/${String(m).padStart(2, '0')}/${y}`
    }
    const d = date.getDate()
    const m = date.getMonth() + 1
    const y = date.getFullYear()
    return `${String(d).padStart(2, '0')}/${String(m).padStart(2, '0')}/${y}`
  }

  // Format currency
  const formatPrice = (price: number | null) => {
    if (price === null) return '—'
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 0
    }).format(price)
  }

  // Format date range text as DD/MM/YYYY
  const formatDateRangeText = (start: string, endStr?: string | null) => {
    const startText = formatDateToDDMMYYYY(start)
    const end = endStr || start
    if (start === end) return startText
    const endText = formatDateToDDMMYYYY(end)
    return `${startText} - ${endText}`
  }

  if (loading) {
    return (
      <div className="flex h-96 items-center justify-center bg-card-base border border-border-base rounded-xl shadow-base">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin text-txt-secondary mx-auto mb-2" />
          <p className="text-txt-secondary text-sm">Loading details...</p>
        </div>
      </div>
    )
  }

  if (!enquiry) {
    return (
      <div className="space-y-4">
        <Link
          href="/dashboard"
          className="inline-flex items-center gap-1.5 text-sm font-semibold text-txt-secondary hover:text-txt-primary transition-colors"
        >
          <ArrowLeft className="h-4 w-4" /> Back to Inbox
        </Link>
        <div className="rounded-xl bg-red-500/10 p-6 border border-red-500/20 text-center">
          <ShieldAlert className="h-10 w-10 text-red-500 mx-auto mb-2" />
          <h3 className="text-base font-bold text-red-800">Error Loading Detail</h3>
          <p className="text-sm text-red-650 dark:text-red-400 mt-1">{errorMsg || 'Enquiry not found or failed to load.'}</p>
        </div>
      </div>
    )
  }

  const numericPrice = agreedPrice === '' ? null : parseFloat(agreedPrice)
  const paidVal = paidAmount === '' ? 0 : parseFloat(paidAmount)
  const dueVal = Math.max(0, (numericPrice || 0) - paidVal)

  return (
    <>
      {/* SCREEN VIEW (HIDDEN IN PRINT) */}
      <div className="print:hidden space-y-6">
        {/* Navigation & Header */}
        <div className="flex items-center justify-between">
          <Link
            href="/dashboard"
            className="inline-flex items-center gap-1.5 text-sm font-semibold text-txt-secondary hover:text-txt-primary transition-colors cursor-pointer"
          >
            <ArrowLeft className="h-4 w-4" /> Back to Inbox
          </Link>
          
          {/* Action to show Receipt if Confirmed */}
          {enquiry.status === 'confirmed' && (
            <button
              onClick={() => setShowReceipt(true)}
              className="inline-flex items-center gap-1.5 rounded-lg border border-border-base bg-card-base px-3.5 py-1.5 text-sm font-semibold text-txt-secondary hover:text-txt-primary hover:border-txt-muted transition-all cursor-pointer"
            >
              <FileText className="h-4 w-4 text-txt-muted" />
              Generate Receipt
            </button>
          )}
        </div>

        <div className="flex flex-col gap-2">
          <h1 className="text-2xl font-extrabold tracking-tight text-txt-primary">
            Enquiry Details
          </h1>
          <p className="text-sm text-txt-secondary">
            Review details, manage prices, end dates, and confirm shoots for portfolios.
          </p>
        </div>

        {/* Notifications */}
        {successMsg && (
          <div className="rounded-xl bg-emerald-500/10 p-4 border border-emerald-500/20 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-txt-primary">
            <div className="flex items-start gap-3">
              <CheckCircle2 className="h-5 w-5 text-emerald-500 shrink-0 mt-0.5" />
              <div className="space-y-1">
                <p className="text-sm font-semibold text-emerald-800 dark:text-emerald-400">{successMsg}</p>
                {status === 'confirmed' && (
                  <p className="text-xs text-emerald-600 dark:text-emerald-500">The shoot has been confirmed and successfully scheduled on the calendar.</p>
                )}
              </div>
            </div>
            {status === 'confirmed' && (
              <button
                type="button"
                onClick={() => setShowReceipt(true)}
                className="self-start sm:self-center inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white shadow-sm hover:bg-emerald-700 transition-colors cursor-pointer"
              >
                <FileText className="h-3.5 w-3.5" />
                Generate Receipt
              </button>
            )}
          </div>
        )}
        {errorMsg && (
          <div className="rounded-xl bg-red-500/10 p-4 border border-red-500/20 flex items-start gap-3">
            <ShieldAlert className="h-5 w-5 text-red-500 shrink-0 mt-0.5" />
            <p className="text-sm font-semibold text-red-800 dark:text-red-400">{errorMsg}</p>
          </div>
        )}

        {/* Detail Form */}
        <form onSubmit={handleSave} className="bg-card-base border border-border-base rounded-xl shadow-base overflow-hidden transition-colors duration-300">
          <div className="p-6 space-y-6">
            {/* Section 1: Client Details */}
            <div>
              <h3 className="text-xs font-extrabold uppercase tracking-widest text-txt-muted border-b border-border-base/50 pb-2 mb-4">
                Client Information
              </h3>
              <div className="grid grid-cols-1 gap-6 sm:grid-cols-3">
                <div className="space-y-1">
                  <label className="block text-xs font-bold text-txt-secondary mb-1 uppercase tracking-wider">
                    Name
                  </label>
                  <input
                    type="text"
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="block w-full rounded-lg border border-input-border bg-input-base px-3 py-2 text-sm text-txt-primary focus:border-txt-primary focus:outline-hidden focus:ring-1 focus:ring-txt-primary transition-all font-medium"
                  />
                </div>
                <div className="space-y-1">
                  <label className="block text-xs font-bold text-txt-secondary mb-1 uppercase tracking-wider">
                    Email
                  </label>
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => {
                      setEmail(e.target.value);
                      if (errorMsg) setErrorMsg(null);
                    }}
                    onBlur={() => {
                      if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
                        setErrorMsg('Please enter a valid email address (e.g. client@example.com).');
                      }
                    }}
                    className={`block w-full rounded-lg border px-3 py-2 text-sm text-txt-primary focus:outline-hidden focus:ring-1 transition-all font-medium ${
                      errorMsg && errorMsg.includes('email')
                        ? 'border-red-500 focus:border-red-500 focus:ring-red-500'
                        : 'border-input-border focus:border-txt-primary focus:ring-txt-primary'
                    }`}
                  />
                </div>
                <div className="space-y-1">
                  <label className="block text-xs font-bold text-txt-secondary mb-1 uppercase tracking-wider">
                    Phone
                  </label>
                  <input
                    type="text"
                    required
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    className="block w-full rounded-lg border border-input-border bg-input-base px-3 py-2 text-sm text-txt-primary focus:border-txt-primary focus:outline-hidden focus:ring-1 focus:ring-txt-primary transition-all font-medium"
                  />
                </div>
              </div>
            </div>

            <hr className="border-border-base opacity-40" />

            {/* Section 2: Event Details */}
            <div>
              <h3 className="text-xs font-extrabold uppercase tracking-widest text-txt-muted border-b border-border-base/50 pb-2 mb-4">
                Event Details
              </h3>
              <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-5">
                <div className="space-y-1">
                  <label className="block text-xs font-bold text-txt-secondary mb-1 uppercase tracking-wider">
                    Event Date (Start)
                  </label>
                  <div className="relative flex flex-col justify-start">
                    <div className="relative flex items-center">
                      <input
                        type="text"
                        required
                        placeholder="DD/MM/YYYY"
                        value={eventDate}
                        onChange={(e) => handleDateInputChange(e.target.value, setEventDate)}
                        onFocus={() => {
                          const parsed = parseDisplayDate(eventDate)
                          setCalendarViewDate(parsed || new Date())
                          setOpenCalendar('start')
                        }}
                        className="block w-full rounded-lg border border-input-border bg-input-base pl-3 pr-10 py-2 text-sm text-txt-primary focus:border-txt-primary focus:outline-hidden focus:ring-1 focus:ring-txt-primary transition-all font-medium"
                      />
                      <button
                        type="button"
                        onClick={() => toggleCalendar('start')}
                        className="start-date-toggle absolute right-2 text-txt-muted hover:text-txt-primary p-1 rounded hover:bg-sidebar-active transition-colors cursor-pointer"
                        title="Select date"
                      >
                        <CalendarIcon className="h-4 w-4" />
                      </button>
                    </div>

                    {/* Custom Calendar Popup */}
                    {openCalendar === 'start' && (
                      <div 
                        ref={startCalendarRef}
                        className="absolute left-0 top-full mt-1 z-[9999] bg-modal-base border border-border-base rounded-xl shadow-lg p-3 w-64 text-sm text-txt-primary select-none animate-fadeIn"
                      >
                        <div className="flex items-center justify-between mb-2">
                          <button 
                            type="button"
                            onClick={() => {
                              setCalendarViewDate(new Date(calendarViewDate.getFullYear(), calendarViewDate.getMonth() - 1, 1))
                            }}
                            className="p-1 text-txt-muted hover:text-txt-primary hover:bg-sidebar-active rounded transition-colors cursor-pointer"
                          >
                            <ChevronLeft className="h-4 w-4" />
                          </button>
                          <span className="font-bold">
                            {calendarViewDate.toLocaleString('default', { month: 'long' })} {calendarViewDate.getFullYear()}
                          </span>
                          <button 
                            type="button"
                            onClick={() => {
                              setCalendarViewDate(new Date(calendarViewDate.getFullYear(), calendarViewDate.getMonth() + 1, 1))
                            }}
                            className="p-1 text-txt-muted hover:text-txt-primary hover:bg-sidebar-active rounded transition-colors cursor-pointer"
                          >
                            <ChevronRight className="h-4 w-4" />
                          </button>
                        </div>

                        <div className="grid grid-cols-7 gap-1 text-center text-xs font-bold text-txt-muted mb-1">
                          <span>Su</span><span>Mo</span><span>Tu</span><span>We</span><span>Th</span><span>Fr</span><span>Sa</span>
                        </div>

                        <div className="grid grid-cols-7 gap-1 text-center text-xs">
                          {renderDaysGrid('start')}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
                <div className="space-y-1">
                  <label className="block text-xs font-bold text-txt-secondary mb-1 uppercase tracking-wider">
                    Event Date (End)
                  </label>
                  <div className="relative flex flex-col justify-start">
                    <div className="relative flex items-center">
                      <input
                        type="text"
                        required
                        placeholder="DD/MM/YYYY"
                        value={eventEndDate}
                        onChange={(e) => handleDateInputChange(e.target.value, setEventEndDate)}
                        onFocus={() => {
                          const parsed = parseDisplayDate(eventEndDate)
                          setCalendarViewDate(parsed || new Date())
                          setOpenCalendar('end')
                        }}
                        className="block w-full rounded-lg border border-input-border bg-input-base pl-3 pr-10 py-2 text-sm text-txt-primary focus:border-txt-primary focus:outline-hidden focus:ring-1 focus:ring-txt-primary transition-all font-medium"
                      />
                      <button
                        type="button"
                        onClick={() => toggleCalendar('end')}
                        className="end-date-toggle absolute right-2 text-txt-muted hover:text-txt-primary p-1 rounded hover:bg-sidebar-active transition-colors cursor-pointer"
                        title="Select date"
                      >
                        <CalendarIcon className="h-4 w-4" />
                      </button>
                    </div>

                    {/* Custom Calendar Popup */}
                    {openCalendar === 'end' && (
                      <div 
                        ref={endCalendarRef}
                        className="absolute left-0 top-full mt-1 z-[9999] bg-modal-base border border-border-base rounded-xl shadow-lg p-3 w-64 text-sm text-txt-primary select-none animate-fadeIn"
                      >
                        <div className="flex items-center justify-between mb-2">
                          <button 
                            type="button"
                            onClick={() => {
                              setCalendarViewDate(new Date(calendarViewDate.getFullYear(), calendarViewDate.getMonth() - 1, 1))
                            }}
                            className="p-1 text-txt-muted hover:text-txt-primary hover:bg-sidebar-active rounded transition-colors cursor-pointer"
                          >
                            <ChevronLeft className="h-4 w-4" />
                          </button>
                          <span className="font-bold">
                            {calendarViewDate.toLocaleString('default', { month: 'long' })} {calendarViewDate.getFullYear()}
                          </span>
                          <button 
                            type="button"
                            onClick={() => {
                              setCalendarViewDate(new Date(calendarViewDate.getFullYear(), calendarViewDate.getMonth() + 1, 1))
                            }}
                            className="p-1 text-txt-muted hover:text-txt-primary hover:bg-sidebar-active rounded transition-colors cursor-pointer"
                          >
                            <ChevronRight className="h-4 w-4" />
                          </button>
                        </div>

                        <div className="grid grid-cols-7 gap-1 text-center text-xs font-bold text-txt-muted mb-1">
                          <span>Su</span><span>Mo</span><span>Tu</span><span>We</span><span>Th</span><span>Fr</span><span>Sa</span>
                        </div>

                        <div className="grid grid-cols-7 gap-1 text-center text-xs">
                          {renderDaysGrid('end')}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
                <div className="space-y-1">
                  <label className="block text-xs font-bold text-txt-secondary mb-1 uppercase tracking-wider">
                    Location (City)
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Udaipur, Goa, Delhi"
                    value={location}
                    onChange={(e) => setLocation(e.target.value)}
                    className="block w-full rounded-lg border border-input-border bg-input-base px-3 py-2 text-sm text-txt-primary focus:border-txt-primary focus:outline-hidden focus:ring-1 focus:ring-txt-primary transition-all font-medium"
                  />
                </div>
                <div className="space-y-1">
                  <label className="block text-xs font-bold text-txt-secondary mb-1 uppercase tracking-wider">
                    Package Requested
                  </label>
                  <input
                    type="text"
                    required
                    value={packageName}
                    onChange={(e) => setPackageName(e.target.value)}
                    className="block w-full rounded-lg border border-input-border bg-input-base px-3 py-2 text-sm text-txt-primary focus:border-txt-primary focus:outline-hidden focus:ring-1 focus:ring-txt-primary transition-all font-medium"
                  />
                </div>
                <div className="space-y-1">
                  <label className="block text-xs font-bold text-txt-secondary mb-1 uppercase tracking-wider">
                    Agreed Price (INR)
                  </label>
                  <input
                    type="number"
                    placeholder="Enter price or leave empty"
                    value={agreedPrice}
                    onChange={(e) => setAgreedPrice(e.target.value)}
                    className="block w-full rounded-lg border border-input-border bg-input-base px-3 py-2 text-sm text-txt-primary focus:border-txt-primary focus:outline-hidden focus:ring-1 focus:ring-txt-primary transition-all font-medium"
                  />
                </div>
              </div>
            </div>

            <hr className="border-border-base opacity-40" />

            {/* Section 3: Payment Details */}
            <div>
              <h3 className="text-xs font-extrabold uppercase tracking-widest text-txt-muted border-b border-border-base/50 pb-2 mb-4">
                Payment Details
              </h3>
              <div className="grid grid-cols-1 gap-6 sm:grid-cols-4">
                <div className="space-y-1">
                  <label className="block text-xs font-bold text-txt-secondary mb-1 uppercase tracking-wider">
                    Payment Status
                  </label>
                  <select
                    value={paymentStatus}
                    onChange={(e) => handlePaymentStatusChange(e.target.value as any)}
                    className="block w-full rounded-lg border border-input-border bg-input-base px-3 py-2 text-sm text-txt-primary focus:border-txt-primary focus:outline-hidden focus:ring-1 focus:ring-txt-primary transition-all font-semibold cursor-pointer"
                  >
                    <option value="due">Due / Not Paid</option>
                    <option value="advance_paid">Advance Done (Partially Paid)</option>
                    <option value="fully_paid">Fully Paid</option>
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="block text-xs font-bold text-txt-secondary mb-1 uppercase tracking-wider">
                    Amount Paid (INR)
                  </label>
                  <input
                    type="number"
                    disabled={paymentStatus === 'due'}
                    placeholder={paymentStatus === 'due' ? '0' : 'Enter paid amount'}
                    value={paidAmount}
                    onChange={(e) => setPaidAmount(e.target.value)}
                    className="block w-full rounded-lg border border-input-border bg-input-base px-3 py-2 text-sm text-txt-primary focus:border-txt-primary focus:outline-hidden focus:ring-1 focus:ring-txt-primary transition-all disabled:opacity-50 disabled:cursor-not-allowed font-medium"
                  />
                </div>
                <div className="space-y-1">
                  <label className="block text-xs font-bold text-txt-secondary mb-1 uppercase tracking-wider">
                    Payment Method
                  </label>
                  <select
                    value={paymentMethod}
                    onChange={(e) => setPaymentMethod(e.target.value)}
                    className="block w-full rounded-lg border border-input-border bg-input-base px-3 py-2 text-sm text-txt-primary focus:border-txt-primary focus:outline-hidden focus:ring-1 focus:ring-txt-primary transition-all font-semibold cursor-pointer"
                  >
                    <option value="" disabled={paymentStatus === 'fully_paid'}>Awaiting / None</option>
                    <option value="UPI">UPI (GPay/PhonePe)</option>
                    <option value="Cash">Cash</option>
                    <option value="Bank Transfer">Bank Transfer (NEFT/IMPS)</option>
                    <option value="Card">Credit/Debit Card</option>
                    <option value="Other">Other</option>
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="block text-xs font-bold text-txt-secondary mb-1 uppercase tracking-wider">
                    Payment Timeline / Terms
                  </label>
                  <select
                    value={paymentTimeline}
                    onChange={(e) => setPaymentTimeline(e.target.value)}
                    className="block w-full rounded-lg border border-input-border bg-input-base px-3 py-2 text-sm text-txt-primary focus:border-txt-primary focus:outline-hidden focus:ring-1 focus:ring-txt-primary transition-all font-semibold cursor-pointer"
                  >
                    <option value="after_shoot" disabled={paymentStatus === 'fully_paid'}>Pay After Shoot</option>
                    <option value="before_shoot">Pay Before Shoot</option>
                    <option value="split_50_50" disabled={paymentStatus === 'fully_paid'}>50% Advance / 50% After Shoot</option>
                  </select>
                </div>
              </div>
            </div>

            <hr className="border-border-base opacity-40" />

            {/* Section 3: Status & Admin Notes */}
            <div>
              <h3 className="text-xs font-extrabold uppercase tracking-widest text-txt-muted border-b border-border-base/50 pb-2 mb-4">
                Status & Notes
              </h3>
              <div className="grid grid-cols-1 gap-6 sm:grid-cols-3">
                <div className="space-y-1">
                  <label className="block text-xs font-bold text-txt-secondary mb-1 uppercase tracking-wider">
                    Status
                  </label>
                  <select
                    value={status}
                    onChange={(e) => setStatus(e.target.value as Enquiry['status'])}
                    className="block w-full rounded-lg border border-input-border bg-input-base px-3 py-2 text-sm text-txt-primary focus:border-txt-primary focus:outline-hidden focus:ring-1 focus:ring-txt-primary transition-all font-semibold cursor-pointer"
                  >
                    <option value="new">New</option>
                    <option value="in_progress">In Progress</option>
                    <option value="confirmed">Confirmed (Triggers Booking Event)</option>
                    <option value="cancelled">Cancelled</option>
                  </select>
                  
                  {/* Select corresponding Calendar Event Portfolio Color code */}
                  {status === 'confirmed' && (
                    <div className="mt-3 bg-sidebar-active/30 p-3 rounded-lg border border-border-base animate-fadeIn">
                      <label className="block text-[10px] font-extrabold text-txt-secondary uppercase tracking-widest mb-1.5">
                        Shoot Portfolio Category
                      </label>
                      <select
                        value={bookingType}
                        onChange={(e) => setBookingType(e.target.value as any)}
                        className="block w-full rounded-lg border border-input-border bg-input-base px-2.5 py-1.5 text-xs text-txt-primary focus:border-txt-primary focus:outline-hidden focus:ring-1 focus:ring-txt-primary font-bold transition-all cursor-pointer"
                      >
                        <option value="marriage">Marriage (Red)</option>
                        <option value="brand_photoshoot">Brand Photoshoot (Purple)</option>
                        <option value="portfolio_shoot">Portfolio Shoot (Orange)</option>
                        <option value="model_shoot">Model Shoot (Cyan)</option>
                        <option value="reel_shoot">Reel Shoot (Rose)</option>
                      </select>
                      <p className="mt-2 text-[10px] text-txt-secondary leading-normal">
                        * Confirmed bookings will display as color-coded spans on the calendar based on this selection.
                      </p>
                    </div>
                  )}
                </div>
                <div className="sm:col-span-2 space-y-1">
                  <label className="block text-xs font-bold text-txt-secondary mb-1 uppercase tracking-wider">
                    Admin Notes
                  </label>
                  <textarea
                    rows={4}
                    placeholder="Internal notes about pricing, meetings, package customizations..."
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    className="block w-full rounded-lg border border-input-border bg-input-base px-3 py-2 text-sm text-txt-primary placeholder-txt-muted focus:border-txt-primary focus:outline-hidden focus:ring-1 focus:ring-txt-primary transition-all font-medium"
                  />
                </div>
              </div>
            </div>

            <hr className="border-border-base opacity-40" />

            {/* Section 4: Message from Client */}
            <div>
              <h3 className="text-xs font-extrabold uppercase tracking-widest text-txt-muted border-b border-border-base/50 pb-2 mb-3">
                Original Message from Client
              </h3>
              <div className="bg-sidebar-active/40 border border-border-base rounded-lg p-4 text-txt-secondary text-sm whitespace-pre-line leading-relaxed">
                {enquiry.message || 'No message provided.'}
              </div>
            </div>
          </div>

          {/* Form Footer Action */}
          <div className="bg-sidebar-active/20 border-t border-border-base px-6 py-4 flex items-center justify-between transition-colors duration-300">
            <span className="text-xs text-txt-secondary">
              Received on {formatDateToDDMMYYYY(enquiry.created_at)} at{' '}
              {new Date(enquiry.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </span>
            <button
              type="submit"
              disabled={saving}
              className="flex items-center gap-2 rounded-lg bg-txt-primary text-bg-base px-4 py-2.5 text-sm font-semibold hover:opacity-90 transition-all disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer shadow-xs"
            >
              {saving ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Saving Changes...
                </>
              ) : (
                <>
                  <Save className="h-4 w-4" />
                  Save Changes
                </>
              )}
            </button>
          </div>
        </form>
      </div>

      {/* RECEIPT MODAL / PRINT VIEW OVERLAY */}
      {showReceipt && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/55 p-4 print:static print:bg-white print:p-0 overflow-y-auto backdrop-blur-xs">
          <div className="bg-modal-base rounded-xl max-w-2xl w-full border border-border-base shadow-xl overflow-hidden print:border-none print:shadow-none print:p-0 print:m-0 flex flex-col my-8 transition-colors duration-300">
            
            {/* Modal Control (Screen view only) */}
            <div className="flex items-center justify-between bg-sidebar-active/50 border-b border-border-base px-6 py-4 print:hidden">
              <span className="text-sm font-bold text-txt-primary flex items-center gap-1.5">
                <FileText className="h-4 w-4 text-txt-muted" /> Invoice Receipt
              </span>
              <button
                onClick={() => setShowReceipt(false)}
                className="text-txt-muted hover:text-txt-primary p-1 rounded hover:bg-sidebar-active transition-colors cursor-pointer"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Printable Area */}
            <div className="p-8 space-y-6 flex-1 bg-modal-base print:p-0 print:m-0 print:bg-white text-txt-primary print:text-black transition-colors duration-300">
              {/* Receipt Header */}
              <div className="flex justify-between items-start">
                <div>
                  <h2 className="text-2xl font-black tracking-tight text-txt-primary print:text-black">RM FILMS</h2>
                  <p className="text-xs text-txt-secondary dark:text-txt-muted print:text-gray-500 mt-1">
                    Wedding & Cinematic Photography<br />
                    hello@rounakmannafilms.com
                  </p>
                </div>
                <div className="text-right">
                  <h3 className="text-xl font-bold text-txt-primary print:text-black uppercase">Receipt</h3>
                  <p className="text-xs text-txt-secondary dark:text-txt-muted print:text-gray-505 mt-0.5">
                    No: <span className="font-semibold text-txt-primary print:text-black">INV-{enquiry.id.slice(0, 8).toUpperCase()}</span>
                  </p>
                  <p className="text-xs text-txt-secondary dark:text-txt-muted print:text-gray-505 mt-0.5">
                    Date: <span className="font-medium text-txt-primary print:text-black">{formatDateToDDMMYYYY(new Date())}</span>
                  </p>
                </div>
              </div>

              <hr className="border-border-base print:border-gray-250 opacity-40" />

              {/* Client & Shoot grids */}
              <div className="grid grid-cols-2 gap-6 text-sm">
                <div>
                  <h4 className="text-xs font-bold uppercase tracking-wider text-txt-muted print:text-gray-400 mb-2">Billed To</h4>
                  <p className="font-bold text-txt-primary print:text-black">{name}</p>
                  <p className="text-txt-secondary dark:text-txt-muted print:text-gray-500 text-xs mt-1">{email}</p>
                  <p className="text-txt-secondary dark:text-txt-muted print:text-gray-500 text-xs mt-0.5">{phone}</p>
                </div>
                <div>
                  <h4 className="text-xs font-bold uppercase tracking-wider text-txt-muted print:text-gray-400 mb-2">Shoot Details</h4>
                  <p className="font-semibold text-txt-primary print:text-black">Package: {packageName}</p>
                  <p className="text-txt-secondary dark:text-txt-muted print:text-gray-500 text-xs mt-1">
                    Dates: {formatDateRangeText(eventDate, eventEndDate)}
                  </p>
                  <p className="text-txt-secondary dark:text-txt-muted print:text-gray-500 text-xs mt-0.5">
                    Location: {location || '—'}
                  </p>
                </div>
              </div>

              {/* Items summary table */}
              <div className="border border-border-base print:border-gray-200 rounded-lg overflow-hidden mt-6">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="bg-tbl-header print:bg-gray-50 border-b border-border-base print:border-gray-200 font-bold text-txt-secondary print:text-gray-650 uppercase tracking-wider">
                      <th className="px-4 py-3">Description</th>
                      <th className="px-4 py-3 text-right">Amount</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-cell-border print:divide-gray-100 font-medium text-txt-secondary print:text-gray-800 bg-card-base print:bg-white">
                    <tr>
                      <td className="px-4 py-3">
                        <span className="font-bold text-txt-primary print:text-black block">{packageName} Services</span>
                        <span className="text-[10px] text-txt-muted print:text-gray-450 font-normal">
                          Wedding Photography & Cinematography covering {formatDateRangeText(eventDate, eventEndDate)} in {location || 'General Venue'}.
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right font-semibold text-txt-primary print:text-black">
                        {formatPrice(numericPrice)}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>

              {/* Summary calculations */}
              <div className="flex justify-between items-start mt-6 text-xs text-txt-secondary print:text-gray-500">
                <div className="space-y-1 bg-sidebar-active/40 print:bg-gray-50 p-3 rounded-lg border border-border-base print:border-gray-200 max-w-xs text-txt-secondary print:text-gray-500">
                  <h5 className="font-bold text-txt-primary print:text-gray-700 uppercase tracking-wider text-[10px] mb-1">Payment Details</h5>
                  <p>Terms: <span className="font-semibold text-txt-primary print:text-black">{
                    paymentTimeline === 'before_shoot' ? 'Pay Before Shoot' :
                    paymentTimeline === 'after_shoot' ? 'Pay After Shoot' :
                    paymentTimeline === 'split_50_50' ? '50% Advance / 50% After' :
                    'Pay After Shoot'
                  }</span></p>
                  <p>Method: <span className="font-semibold text-txt-primary print:text-black">{paymentMethod || 'Awaiting / None'}</span></p>
                  <p className="flex items-center gap-1.5">Status: <span className={`font-bold ${
                    paymentStatus === 'fully_paid' ? 'text-emerald-600 dark:text-emerald-400 font-bold' :
                    paymentStatus === 'advance_paid' ? 'text-orange-600 dark:text-orange-400 font-bold' :
                    'text-red-600 dark:text-red-400 font-bold'
                  }`}>
                    {paymentStatus === 'fully_paid' ? 'FULLY PAID' :
                     paymentStatus === 'advance_paid' ? 'ADVANCE DONE' :
                     'PAYMENT DUE'}
                  </span></p>
                </div>
                
                <div className="w-64 space-y-2 text-sm text-txt-secondary print:text-gray-500">
                  <div className="flex justify-between text-xs">
                    <span>Subtotal (Agreed Price)</span>
                    <span className="font-medium text-txt-primary print:text-black">{formatPrice(numericPrice)}</span>
                  </div>
                  <div className="flex justify-between text-xs">
                    <span>Amount Paid</span>
                    <span className="font-medium text-txt-primary print:text-black">{formatPrice(paidVal)}</span>
                  </div>
                  <hr className="border-border-base print:border-gray-250 opacity-40" />
                  <div className="flex justify-between font-bold text-base text-txt-primary print:text-black">
                    <span>Balance Due</span>
                    <span className={dueVal > 0 ? "text-red-500" : "text-emerald-500"}>{formatPrice(dueVal)}</span>
                  </div>
                </div>
              </div>

              {/* Thank you notes / T&C */}
              <div className="pt-6 border-t border-border-base print:border-gray-100 text-[10px] text-txt-muted print:text-gray-400 text-center leading-relaxed">
                <p className="font-semibold text-txt-secondary print:text-gray-500">Thank you for booking with RM Films!</p>
                <p className="mt-1 opacity-70">
                  This is a computer-generated transaction receipt representing the approved shoot contract portfolio.<br />
                  All terms of services follow the main contract agreements finalized during the client onboarding checks.
                </p>
              </div>
            </div>

            {/* Modal Action footer (Screen view only) */}
            <div className="bg-sidebar-active/50 border-t border-border-base px-6 py-4 flex justify-end gap-3 print:hidden">
              <button
                onClick={() => setShowReceipt(false)}
                className="rounded-lg border border-border-base bg-card-base px-4 py-2 text-sm font-semibold text-txt-secondary hover:text-txt-primary hover:bg-sidebar-active transition-colors cursor-pointer"
              >
                Close
              </button>
              <button
                onClick={handlePrint}
                className="inline-flex items-center gap-1.5 rounded-lg bg-txt-primary text-bg-base px-4 py-2 text-sm font-semibold hover:opacity-90 transition-colors cursor-pointer shadow-xs"
              >
                <Printer className="h-4 w-4" />
                Print / Save PDF
              </button>
            </div>

          </div>
        </div>
      )}
    </>
  )
}

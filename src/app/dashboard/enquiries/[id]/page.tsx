'use client'

import React, { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/utils/supabase/client'
import { isDemoMode, getDemoEnquiries, saveDemoEnquiries, getDemoEvents, saveDemoEvents, getDemoBookings, saveDemoBookings, insertLedgerEntry } from '@/utils/supabase/demo'
import { generateUniqueReceiptNumber } from '@/utils/invoice'
import { MultiDatePicker, parseEventDates, formatMultiDates } from '@/components/MultiDatePicker'
import { ArrowLeft, Save, ShieldAlert, CheckCircle2, Loader2, Printer, X, FileText } from 'lucide-react'

interface Enquiry {
  id: string
  name: string
  email: string
  phone: string
  package: string
  event_date: string
  event_end_date?: string | null
  event_dates?: string | null  // NEW: comma-separated YYYY-MM-DD for multi-date events
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

  // Redirect staff from this page
  useEffect(() => {
    const staffSessionStr = localStorage.getItem('staff_session')
    if (staffSessionStr) {
      router.push('/dashboard/calendar')
    }
  }, [router])


  // Form states
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [eventDates, setEventDates] = useState<string[]>([])  // YYYY-MM-DD[] for multi-date selection
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
  const [paymentTimeline, setPaymentTimeline] = useState<string>('custom')
  const [paidAmount, setPaidAmount] = useState<string>('')
  const [enquirySeq, setEnquirySeq] = useState<number>(1)

  // Receipt Modal State
  const [showReceipt, setShowReceipt] = useState(false)

  // Event dates error
  const [eventDatesError, setEventDatesError] = useState<string>('')

  // (Date picker click-outside now handled inside MultiDatePicker component)

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
      setPaymentTimeline('100_advance')
      if (paymentMethod === '') {
        setPaymentMethod('UPI')
      }
    } else if (val === 'advance_paid') {
      if (paymentTimeline !== '100_advance' && paymentTimeline !== 'pay_on_delivery') {
        setPaymentTimeline('custom')
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
          setEventDates(parseEventDates((found as any).event_dates, found.event_date, found.event_end_date))
          setPackageName(found.package)
          setAgreedPrice(found.agreed_price !== null ? String(found.agreed_price) : '')
          setStatus(found.status)
          setNotes(found.notes || '')
          setLocation(found.location || '')
          setPaymentStatus(found.payment_status || 'due')
          setPaymentMethod(found.payment_method || '')
          const rawTimeline = found.payment_timeline || 'custom';
          setPaymentTimeline(rawTimeline === '100_advance' || rawTimeline === 'pay_on_delivery' ? rawTimeline : 'custom')
          setPaidAmount(found.paid_amount !== undefined && found.paid_amount !== null ? String(found.paid_amount) : '')
          
          // Calculate sequential number for demo mode
          const demoEnquiries = getDemoEnquiries()
          const enquiryYear = found.created_at ? new Date(found.created_at).getFullYear() : new Date().getFullYear()
          const sameYear = demoEnquiries
            .filter(e => new Date(e.created_at || new Date()).getFullYear() === enquiryYear)
            .sort((a, b) => new Date(a.created_at || new Date()).getTime() - new Date(b.created_at || new Date()).getTime())
          const idx = sameYear.findIndex(e => e.id === found.id)
          setEnquirySeq(idx !== -1 ? idx + 1 : 1)
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
          setEventDates(parseEventDates(data.event_dates, data.event_date, data.event_end_date))
          setPackageName(data.package)
          setAgreedPrice(data.agreed_price !== null ? String(data.agreed_price) : '')
          setStatus(data.status)
          setNotes(data.notes || '')
          setLocation(data.location || '')
          setPaymentStatus(data.payment_status || 'due')
          setPaymentMethod(data.payment_method || '')
          const rawTimeline = data.payment_timeline || 'custom';
          setPaymentTimeline(rawTimeline === '100_advance' || rawTimeline === 'pay_on_delivery' ? rawTimeline : 'custom')
          setPaidAmount(data.paid_amount !== undefined && data.paid_amount !== null ? String(data.paid_amount) : '')

          // Calculate sequential number for Supabase mode
          const enquiryYear = data.created_at ? new Date(data.created_at).getFullYear() : new Date().getFullYear()
          const { count, error: countError } = await supabase
            .from('enquiries')
            .select('id', { count: 'exact', head: true })
            .gte('created_at', `${enquiryYear}-01-01T00:00:00Z`)
            .lt('created_at', data.created_at)

          if (!countError) {
            setEnquirySeq((count || 0) + 1)
          }
        }
      } catch (err) {
        setErrorMsg('Failed to load enquiry detail.')
      } finally {
        setLoading(false)
      }
    }

    fetchEnquiry()
  }, [id, supabase])

  const handleGenerateReceipt = () => {
    const priceNum = agreedPrice === '' ? 0 : parseFloat(agreedPrice)
    const paidVal = paidAmount === '' ? 0 : parseFloat(paidAmount)
    if (paidVal > priceNum) {
      alert(`Warning: The advance paid (₹${paidVal}) is greater than the agreed price (₹${priceNum}) for this booking. Please correct this booking's payment details before generating the receipt.`)
      return
    }
    setShowReceipt(true)
  }

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!enquiry) return

    setSaving(true)
    setErrorMsg(null)
    setSuccessMsg(null)
    setEventDatesError('')

    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setErrorMsg('Please enter a valid email address (e.g. client@example.com).')
      setSaving(false)
      return
    }

    if (eventDates.length === 0) {
      setEventDatesError('Please select at least one event date.')
      setErrorMsg('Please select at least one event date.')
      setSaving(false)
      return
    }

    const sorted = [...eventDates].sort()
    const dbStart = sorted[0]
    const dbEnd = sorted[sorted.length - 1]
    const eventDatesStr = sorted.join(',')

    const today = new Date()
    const y = today.getFullYear()
    const m = String(today.getMonth() + 1).padStart(2, '0')
    const d = String(today.getDate()).padStart(2, '0')
    const todayStr = `${y}-${m}-${d}`

    if (dbStart < todayStr) {
      setEventDatesError('Event date cannot be in the past.')
      setErrorMsg('Event date cannot be in the past.')
      setSaving(false)
      return
    }

    const priceNum = agreedPrice === '' ? 0 : parseFloat(agreedPrice)
    const paidVal = paidAmount === '' ? 0 : parseFloat(paidAmount)

    if (priceNum < 0) {
      setErrorMsg('Agreed Price cannot be negative.')
      setSaving(false)
      return
    }
    if (paidVal < 0) {
      setErrorMsg('Advance Paid cannot be negative.')
      setSaving(false)
      return
    }
    if (paidVal > priceNum) {
      setErrorMsg('Agreed Price must be greater than or equal to Advance Paid.')
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
              event_dates: eventDatesStr,
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
              event_dates: eventDatesStr,
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
              event_dates: eventDatesStr,
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

          let receiptNumber = ''
          if (existingBookingIdx === -1) {
            receiptNumber = await generateUniqueReceiptNumber(null, true, demoBookings)
          }

          const resolvedPaymentTerms = 
            paymentTimeline === '100_advance' ? '100% Advance' :
            paymentTimeline === 'pay_on_delivery' ? 'Pay on Delivery' :
            'Custom — see amounts below';

          if (existingBookingIdx !== -1) {
            const oldAdvance = demoBookings[existingBookingIdx].advance_paid || 0;
            const delta = finalAdvance - oldAdvance;

            demoBookings[existingBookingIdx] = {
              ...demoBookings[existingBookingIdx],
              client_name: name,
              email,
              phone,
              event_type: bookingType,
              event_date_start: dbStart,
              event_date_end: dbEnd || dbStart,
              event_dates: eventDatesStr,
              location: location || '—',
              package: packageName,
              special_requirements: notes || '',
              agreed_price: finalPrice,
              advance_paid: finalAdvance,
              balance_due: finalBalance,
              payment_status: payStatus,
              payment_method: paymentMethod || 'UPI',
              payment_terms: resolvedPaymentTerms,
              booking_status: 'confirmed',
              admin_notes: notes || ''
            }

            if (delta !== 0) {
              const eventTitle = packageName || bookingType.replace('_', ' ').replace(/\b\w/g, c => c.toUpperCase());
              await insertLedgerEntry(null, {
                type: 'advance_received',
                amount: delta,
                reference_id: demoBookings[existingBookingIdx].id,
                description: `Advance from ${name} — ${eventTitle}`
              });
            }
          } else {
            const newBookingId = 'booking-' + Date.now();
            demoBookings.push({
              id: newBookingId,
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
              event_dates: eventDatesStr,
              location: location || '—',
              package: packageName,
              agreed_price: finalPrice,
              advance_paid: finalAdvance,
              balance_due: finalBalance,
              payment_status: payStatus,
              payment_method: paymentMethod || 'UPI',
              payment_terms: resolvedPaymentTerms,
              booking_status: 'confirmed',
              receipt_number: receiptNumber,
              created_at: new Date().toISOString()
            })

            if (finalAdvance > 0) {
              const eventTitle = packageName || bookingType.replace('_', ' ').replace(/\b\w/g, c => c.toUpperCase());
              await insertLedgerEntry(null, {
                type: 'advance_received',
                amount: finalAdvance,
                reference_id: newBookingId,
                description: `Advance from ${name} — ${eventTitle}`
              });
            }
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
          event_dates: eventDatesStr,
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
              event_dates: eventDatesStr,
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
              event_dates: eventDatesStr,
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
            .select('id, advance_paid')
            .eq('enquiry_id', id)
            .maybeSingle()

          const resolvedPaymentTerms = 
            paymentTimeline === '100_advance' ? '100% Advance' :
            paymentTimeline === 'pay_on_delivery' ? 'Pay on Delivery' :
            'Custom — see amounts below';

          if (existingBooking) {
            const oldAdvance = existingBooking.advance_paid || 0;
            const delta = finalAdvance - oldAdvance;

            await supabase
              .from('bookings')
              .update({
                client_name: name,
                email,
                phone,
                event_type: bookingType,
                event_date_start: dbStart,
                event_date_end: dbEnd || dbStart,
                event_dates: eventDatesStr,
                location: location || '—',
                package: packageName,
                agreed_price: finalPrice,
                advance_paid: finalAdvance,
                balance_due: finalBalance,
                payment_status: payStatus,
                payment_method: paymentMethod || 'UPI',
                payment_terms: resolvedPaymentTerms,
                booking_status: 'confirmed',
                admin_notes: notes || '',
                special_requirements: notes || ''
              })
              .eq('enquiry_id', id)

            if (delta !== 0) {
              const eventTitle = packageName || bookingType.replace('_', ' ').replace(/\b\w/g, c => c.toUpperCase());
              await insertLedgerEntry(supabase, {
                type: 'advance_received',
                amount: delta,
                reference_id: existingBooking.id,
                description: `Advance from ${name} — ${eventTitle}`
              });
            }
          } else {
            // Generate unique receipt number
            const rNumber = await generateUniqueReceiptNumber(supabase, false)

            const { data: dbBooking, error: insertBError } = await supabase
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
                event_dates: eventDatesStr,
                location: location || '—',
                package: packageName,
                agreed_price: finalPrice,
                advance_paid: finalAdvance,
                balance_due: finalBalance,
                payment_status: payStatus,
                payment_method: paymentMethod || 'UPI',
                payment_terms: resolvedPaymentTerms,
                booking_status: 'confirmed',
                admin_notes: notes || '',
                special_requirements: notes || '',
                receipt_number: rNumber
              })
              .select('id')
              .single();

            if (insertBError) throw insertBError;

            if (finalAdvance > 0 && dbBooking?.id) {
              const eventTitle = packageName || bookingType.replace('_', ' ').replace(/\b\w/g, c => c.toUpperCase());
              await insertLedgerEntry(supabase, {
                type: 'advance_received',
                amount: finalAdvance,
                reference_id: dbBooking.id,
                description: `Advance from ${name} — ${eventTitle}`
              });
            }
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
              event_dates: eventDatesStr,
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
    if (typeof dateStr === 'string' && dateStr.includes('/')) {
      return dateStr
    }
    const date = typeof dateStr === 'string' ? new Date(dateStr) : dateStr
    if (typeof dateStr === 'string' && dateStr.includes('-') && !dateStr.includes('T')) {
      const [y, m, d] = dateStr.split('-').map(Number)
      return `${String(d).padStart(2, '0')}/${String(m).padStart(2, '0')}/${y}`
    }
    if (date instanceof Date && isNaN(date.getTime())) {
      return ''
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
  const totalVal = numericPrice || 0
  const enquiryAdvancePct = totalVal > 0 ? (paidVal / totalVal) * 100 : 0
  const enquiryBalancePct = Math.max(0, 100 - enquiryAdvancePct)

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
              onClick={handleGenerateReceipt}
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
                onClick={handleGenerateReceipt}
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
                  <div className="w-full rounded-lg border border-border-base/50 bg-sidebar-active/10 px-3.5 py-2.5 text-sm text-txt-primary font-semibold transition-all">
                    {name}
                  </div>
                </div>
                <div className="space-y-1">
                  <label className="block text-xs font-bold text-txt-secondary mb-1 uppercase tracking-wider">
                    Email
                  </label>
                  <div className="w-full rounded-lg border border-border-base/50 bg-sidebar-active/10 px-3.5 py-2.5 text-sm text-txt-primary font-semibold transition-all">
                    {email}
                  </div>
                </div>
                <div className="space-y-1">
                  <label className="block text-xs font-bold text-txt-secondary mb-1 uppercase tracking-wider">
                    Phone
                  </label>
                  <div className="w-full rounded-lg border border-border-base/50 bg-sidebar-active/10 px-3.5 py-2.5 text-sm text-txt-primary font-semibold transition-all">
                    {phone}
                  </div>
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
                <div className="col-span-1 sm:col-span-2">
                  <label className="block text-xs font-bold text-txt-secondary mb-1.5 uppercase tracking-wider">
                    Event Date(s)
                  </label>
                  <div className="w-full rounded-lg border border-border-base/50 bg-sidebar-active/10 px-3.5 py-2.5 text-sm text-txt-primary font-semibold transition-all">
                    {formatMultiDates(eventDates)}
                  </div>
                </div>
                <div className="space-y-1">
                  <label className="block text-xs font-bold text-txt-secondary mb-1 uppercase tracking-wider">
                    Location (City)
                  </label>
                  <div className="w-full rounded-lg border border-border-base/50 bg-sidebar-active/10 px-3.5 py-2.5 text-sm text-txt-primary font-semibold transition-all">
                    {location || '—'}
                  </div>
                </div>
                <div className="space-y-1">
                  <label className="block text-xs font-bold text-txt-secondary mb-1 uppercase tracking-wider">
                    Package Requested
                  </label>
                  <div className="w-full rounded-lg border border-border-base/50 bg-sidebar-active/10 px-3.5 py-2.5 text-sm text-txt-primary font-semibold transition-all">
                    {packageName}
                  </div>
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
                    className="block w-full rounded-lg border border-input-border bg-input-base px-3 py-2 text-sm text-txt-primary focus:border-txt-primary focus:outline-hidden focus:ring-1 focus:ring-txt-primary transition-all font-semibold"
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
                  <div className="w-full rounded-lg border border-border-base/50 bg-sidebar-active/10 px-3.5 py-2.5 text-sm text-txt-primary font-semibold transition-all">
                    {paymentStatus === 'fully_paid' ? 'Fully Paid' : paymentStatus === 'advance_paid' ? 'Advance Done (Partially Paid)' : 'Due / Not Paid'}
                  </div>
                </div>
                <div className="space-y-1">
                  <label className="block text-xs font-bold text-txt-secondary mb-1 uppercase tracking-wider">
                    Amount Paid (INR)
                  </label>
                  <div className="w-full rounded-lg border border-border-base/50 bg-sidebar-active/10 px-3.5 py-2.5 text-sm text-txt-primary font-semibold transition-all">
                    {paidAmount ? '₹' + Number(paidAmount).toLocaleString('en-IN') : '₹0'}
                  </div>
                </div>
                <div className="space-y-1">
                  <label className="block text-xs font-bold text-txt-secondary mb-1 uppercase tracking-wider">
                    Payment Method
                  </label>
                  <div className="w-full rounded-lg border border-border-base/50 bg-sidebar-active/10 px-3.5 py-2.5 text-sm text-txt-primary font-semibold transition-all">
                    {paymentMethod || 'Awaiting / None'}
                  </div>
                </div>
                <div className="space-y-1">
                  <label className="block text-xs font-bold text-txt-secondary mb-1 uppercase tracking-wider">
                    Payment Timeline / Terms
                  </label>
                  <div className="w-full rounded-lg border border-border-base/50 bg-sidebar-active/10 px-3.5 py-2.5 text-sm text-txt-primary font-semibold transition-all">
                    {paymentTimeline === '100_advance' ? '100% Advance' : paymentTimeline === 'pay_on_delivery' ? 'Pay on Delivery' : 'Custom — see amounts below'}
                  </div>
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
                  <div className="w-full min-h-[100px] rounded-lg border border-border-base/50 bg-sidebar-active/10 px-3.5 py-2.5 text-sm text-txt-primary font-medium whitespace-pre-wrap leading-relaxed">
                    {notes || 'No notes added.'}
                  </div>
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
                    No: <span className="font-semibold text-txt-primary print:text-black">
                      RMF-{enquiry.created_at ? new Date(enquiry.created_at).getFullYear() : new Date().getFullYear()}-{enquirySeq}
                    </span>
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
                    Dates: {formatMultiDates(eventDates)}
                  </p>
                  <p className="text-txt-secondary dark:text-txt-muted print:text-gray-500 text-xs mt-0.5">
                    Location: {location || '—'}
                  </p>
                </div>
              </div>

              {/* Items summary table */}
              <div className="border border-border-base print:border-gray-200 rounded-lg overflow-hidden mt-6">
                <table className="w-full text-left border-collapse text-sm">
                  <thead>
                    <tr className="bg-sidebar-active print:bg-gray-50 border-b border-border-base print:border-gray-200 font-bold text-txt-secondary print:text-gray-600 uppercase tracking-wider text-xs">
                      <th className="px-4 py-3">Description</th>
                      <th className="px-4 py-3 text-right">Amount</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border-base print:divide-gray-100 font-medium text-txt-secondary print:text-gray-800">
                    <tr>
                      <td className="px-4 py-3">
                        <span className="font-bold text-txt-primary print:text-black block">{bookingType.replace('_', ' ').replace(/\b\w/g, c => c.toUpperCase())} Shoot</span>
                        <span className="text-[10px] text-txt-muted print:text-gray-400 font-normal">
                          Photography/Cinematography services for {formatMultiDates(eventDates)} in {location || 'General Venue'}.
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
                    paymentTimeline === '100_advance' ? '100% Advance' :
                    paymentTimeline === 'pay_on_delivery' ? 'Pay on Delivery' :
                    'Custom — see amounts below'
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
                    <span>Advance Received</span>
                    <span className="font-medium text-txt-primary print:text-black">{formatPrice(paidVal)} ({enquiryAdvancePct.toFixed(1)}% of total)</span>
                  </div>
                  <hr className="border-border-base print:border-gray-250 opacity-40" />
                  <div className="flex justify-between font-bold text-base text-txt-primary print:text-black">
                    <span>Balance Due</span>
                    <span className={dueVal > 0 ? "text-red-500" : "text-emerald-500"}>
                      {formatPrice(dueVal)} ({enquiryBalancePct.toFixed(1)}% remaining)
                    </span>
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

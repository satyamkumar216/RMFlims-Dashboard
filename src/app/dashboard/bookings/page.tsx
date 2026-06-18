'use client'

import React, { useState, useEffect } from 'react'
import Link from 'next/link'
import { createClient } from '@/utils/supabase/client'
import { 
  isDemoMode, 
  getDemoBookings, 
  saveDemoBookings, 
  getDemoEvents, 
  saveDemoEvents 
} from '@/utils/supabase/demo'
import { generateUniqueReceiptNumber } from '@/utils/invoice'
import { 
  FileText, 
  Edit2, 
  Plus, 
  Search, 
  User, 
  Mail, 
  Phone, 
  MapPin, 
  Calendar, 
  SlidersHorizontal, 
  ArrowRight, 
  X, 
  Check, 
  ArrowLeft,
  CalendarCheck,
  ChevronRight,
  ChevronLeft,
  Printer
} from 'lucide-react'

// Constants
const AGENCY_NAME = "RM Films"
const AGENCY_TAGLINE = "Cinematic Weddings & Premium Portraits"
const AGENCY_PHONE = "+91 70633 48026"
const AGENCY_EMAIL = "hello@rounakmannafilms.com"

const TYPE_COLORS: Record<string, string> = {
  marriage: '#D32F2F',
  portfolio_shoot: '#E65100',
  brand_photoshoot: '#6A1B9A',
  model_shoot: '#1565C0',
  reel_shoot: '#AD1457',
  manual_shoot: '#00695C',
  blocked: '#616161'
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

export default function BookingsPage() {
  const supabase = createClient()
  
  // Navigation & Tabs state
  const [activeTab, setActiveTab] = useState<'list' | 'add'>('list')
  
  // Data State
  const [bookings, setBookings] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [errorMsg, setErrorMsg] = useState('')
  const [successMsg, setSuccessMsg] = useState('')

  // Filters State
  const [typeFilter, setTypeFilter] = useState<string>('all')
  const [paymentFilter, setPaymentFilter] = useState<string>('all')
  const [sortBy, setSortBy] = useState<string>('newest')

  // Slide Edit Panel state
  const [isEditPanelOpen, setIsEditPanelOpen] = useState(false)
  const [editingBooking, setEditingBooking] = useState<any | null>(null)

  // Receipt Modal State
  const [showReceipt, setShowReceipt] = useState(false)
  const [receiptBooking, setReceiptBooking] = useState<any | null>(null)
  
  // Edit Form inputs state
  const [editClientName, setEditClientName] = useState('')
  const [editEmail, setEditEmail] = useState('')
  const [editPhone, setEditPhone] = useState('')
  const [editLocation, setEditLocation] = useState('')
  const [editPackage, setEditPackage] = useState('')
  const [editPackageDetails, setEditPackageDetails] = useState('')
  const [editNumGuests, setEditNumGuests] = useState('')
  const [editAgreedPrice, setEditAgreedPrice] = useState('')
  const [editAdvancePaid, setEditAdvancePaid] = useState('')
  const [editPaymentStatus, setEditPaymentStatus] = useState<'due' | 'partial' | 'paid'>('due')
  const [editPaymentMethod, setEditPaymentMethod] = useState('UPI')
  const [editPaymentTerms, setEditPaymentTerms] = useState('Custom — see amounts below')
  const [editLeadPhotographer, setEditLeadPhotographer] = useState('')
  const [editSecondShooter, setEditSecondShooter] = useState('')
  const [editVideographer, setEditVideographer] = useState('')
  const [editSpecialRequirements, setEditSpecialRequirements] = useState('')
  const [editBookingStatus, setEditBookingStatus] = useState<'confirmed' | 'in_progress' | 'tentative' | 'cancelled'>('confirmed')
  const [editAdminNotes, setEditAdminNotes] = useState('')
  const [editStartDate, setEditStartDate] = useState('')
  const [editEndDate, setEditEndDate] = useState('')
  const [editPanelSaving, setEditPanelSaving] = useState(false)

  // Add Form Inputs State
  const [addClientName, setAddClientName] = useState('')
  const [addEmail, setAddEmail] = useState('')
  const [addPhone, setAddPhone] = useState('')
  const [addHowFound, setAddHowFound] = useState('Instagram')
  const [addEventType, setAddEventType] = useState('marriage')
  const [addStartDate, setAddStartDate] = useState('')
  const [addEndDate, setAddEndDate] = useState('')
  const [addLocation, setAddLocation] = useState('')
  const [addPackage, setAddPackage] = useState('Full Wedding Photo+Video')
  const [addCustomPackageDetails, setAddCustomPackageDetails] = useState('')
  const [addNumGuests, setAddNumGuests] = useState('')
  const [addAgreedPrice, setAddAgreedPrice] = useState('')
  const [addAdvancePaid, setAddAdvancePaid] = useState('')
  const [addPaymentStatus, setAddPaymentStatus] = useState<'due' | 'partial' | 'paid'>('due')
  const [addPaymentMethod, setAddPaymentMethod] = useState('UPI')
  const [addPaymentTerms, setAddPaymentTerms] = useState('Custom — see amounts below')
  const [addCustomTermsText, setAddCustomTermsText] = useState('')
  const [addLeadPhotographer, setAddLeadPhotographer] = useState('')
  const [addSecondShooter, setAddSecondShooter] = useState('')
  const [addVideographer, setAddVideographer] = useState('')
  const [addSpecialRequirements, setAddSpecialRequirements] = useState('')
  const [addBookingStatus, setAddBookingStatus] = useState<'confirmed' | 'in_progress' | 'tentative' | 'cancelled'>('confirmed')
  const [addAdminNotes, setAddAdminNotes] = useState('')
  const [formSaving, setFormSaving] = useState(false)

  // Custom calendar picker states for Add/Edit Date Inputs
  const [openCalendar, setOpenCalendar] = useState<'addStart' | 'addEnd' | 'editStart' | 'editEnd' | null>(null)
  const [calendarViewDate, setCalendarViewDate] = useState<Date>(new Date())
  const addStartCalendarRef = React.useRef<HTMLDivElement>(null)
  const addEndCalendarRef = React.useRef<HTMLDivElement>(null)
  const editStartCalendarRef = React.useRef<HTMLDivElement>(null)
  const editEndCalendarRef = React.useRef<HTMLDivElement>(null)

  // Validation error states
  const [addEmailError, setAddEmailError] = useState('')
  const [addStartDateError, setAddStartDateError] = useState('')
  const [addEndDateError, setAddEndDateError] = useState('')
  const [editEmailError, setEditEmailError] = useState('')
  const [editStartDateError, setEditStartDateError] = useState('')
  const [editEndDateError, setEditEndDateError] = useState('')
  const [addClientNameError, setAddClientNameError] = useState('')
  const [addAgreedPriceError, setAddAgreedPriceError] = useState('')
  const [addLocationError, setAddLocationError] = useState('')
  const [editClientNameError, setEditClientNameError] = useState('')
  const [editAgreedPriceError, setEditAgreedPriceError] = useState('')

  // Dynamic percentages for receipt view
  const receiptAgreedPrice = receiptBooking ? Number(receiptBooking.agreed_price || 0) : 0
  const receiptAdvancePaid = receiptBooking ? Number(receiptBooking.advance_paid || 0) : 0
  const receiptAdvancePct = receiptAgreedPrice > 0 ? (receiptAdvancePaid / receiptAgreedPrice) * 100 : 0
  const receiptBalancePct = Math.max(0, 100 - receiptAdvancePct)

  // Load Data
  useEffect(() => {
    fetchBookings()
  }, [])

  // Auto calculate balance due and payment status for ADD form
  const computedAddBalance = Math.max(0, Number(addAgreedPrice || 0) - Number(addAdvancePaid || 0))
  useEffect(() => {
    const price = Number(addAgreedPrice || 0)
    const paid = Number(addAdvancePaid || 0)
    if (price > 0) {
      if (paid >= price) {
        setAddPaymentStatus('paid')
      } else if (paid > 0) {
        setAddPaymentStatus('partial')
      } else {
        setAddPaymentStatus('due')
      }
    }
  }, [addAgreedPrice, addAdvancePaid])

  // Auto calculate balance due and payment status for EDIT form
  const computedEditBalance = Math.max(0, Number(editAgreedPrice || 0) - Number(editAdvancePaid || 0))
  useEffect(() => {
    const price = Number(editAgreedPrice || 0)
    const paid = Number(editAdvancePaid || 0)
    if (price > 0) {
      if (paid >= price) {
        setEditPaymentStatus('paid')
      } else if (paid > 0) {
        setEditPaymentStatus('partial')
      } else {
        setEditPaymentStatus('due')
      }
    }
  }, [editAgreedPrice, editAdvancePaid])

  // Click outside listener for custom calendar popups
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (openCalendar === 'addStart' && addStartCalendarRef.current && !addStartCalendarRef.current.contains(event.target as Node)) {
        if (!(event.target as HTMLElement).closest('.add-start-toggle')) {
          setOpenCalendar(null)
        }
      }
      if (openCalendar === 'addEnd' && addEndCalendarRef.current && !addEndCalendarRef.current.contains(event.target as Node)) {
        if (!(event.target as HTMLElement).closest('.add-end-toggle')) {
          setOpenCalendar(null)
        }
      }
      if (openCalendar === 'editStart' && editStartCalendarRef.current && !editStartCalendarRef.current.contains(event.target as Node)) {
        if (!(event.target as HTMLElement).closest('.edit-start-toggle')) {
          setOpenCalendar(null)
        }
      }
      if (openCalendar === 'editEnd' && editEndCalendarRef.current && !editEndCalendarRef.current.contains(event.target as Node)) {
        if (!(event.target as HTMLElement).closest('.edit-end-toggle')) {
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

  const toggleCalendar = (type: 'addStart' | 'addEnd' | 'editStart' | 'editEnd') => {
    if (openCalendar === type) {
      setOpenCalendar(null)
    } else {
      let dateVal = ''
      if (type === 'addStart') dateVal = addStartDate
      else if (type === 'addEnd') dateVal = addEndDate
      else if (type === 'editStart') dateVal = editStartDate
      else if (type === 'editEnd') dateVal = editEndDate

      const parsed = parseDisplayDate(dateVal)
      setCalendarViewDate(parsed || new Date())
      setOpenCalendar(type)
    }
  }

  const renderDaysGrid = (type: 'addStart' | 'addEnd' | 'editStart' | 'editEnd') => {
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
      
      let isSelected = false
      if (type === 'addStart') isSelected = addStartDate === cellDateStr
      else if (type === 'addEnd') isSelected = addEndDate === cellDateStr
      else if (type === 'editStart') isSelected = editStartDate === cellDateStr
      else if (type === 'editEnd') isSelected = editEndDate === cellDateStr

      if (isDisabled) {
        cells.push(
          <button
            key={`day-${day}`}
            type="button"
            disabled={true}
            className="w-8 h-8 rounded-full flex items-center justify-center font-semibold text-txt-muted opacity-30 cursor-not-allowed text-xs"
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
              if (type === 'addStart') {
                setAddStartDate(cellDateStr)
              } else if (type === 'addEnd') {
                setAddEndDate(cellDateStr)
              } else if (type === 'editStart') {
                setEditStartDate(cellDateStr)
              } else if (type === 'editEnd') {
                setEditEndDate(cellDateStr)
              }
              setOpenCalendar(null)
            }}
            className={`w-8 h-8 rounded-full flex items-center justify-center font-semibold text-xs transition-colors hover:bg-tbl-hover ${
              isSelected 
                ? 'bg-txt-primary text-bg-base hover:opacity-90' 
                : 'text-txt-primary'
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

  // Auto calculate number of days
  const calculateDays = (start: string, end: string) => {
    if (!start || !end) return 1
    const startDb = start.includes('/') ? displayDateToDbDate(start) : start
    const endDb = end.includes('/') ? displayDateToDbDate(end) : end
    const s = new Date(startDb)
    const e = new Date(endDb)
    const diff = e.getTime() - s.getTime()
    if (isNaN(diff)) return 1
    const days = Math.ceil(diff / (1000 * 60 * 60 * 24)) + 1
    return days > 0 ? days : 1
  }

  const addDays = calculateDays(addStartDate, addEndDate)

  const fetchBookings = async () => {
    setLoading(true)
    setErrorMsg('')
    if (isDemoMode()) {
      const demo = getDemoBookings()
      setBookings(demo)
      setLoading(false)
      return
    }

    try {
      const { data, error } = await supabase
        .from('bookings')
        .select('*')
      if (error) throw error
      setBookings(data || [])
    } catch (err: any) {
      console.error(err)
      setErrorMsg('Failed to load bookings from Supabase. Make sure tables are created.')
      // Fallback to demo mode localStorage so UI doesn't crash
      setBookings(getDemoBookings())
    } finally {
      setLoading(false)
    }
  }

  const formatPrice = (val: any) => {
    const num = Number(val || 0)
    return '₹' + num.toLocaleString('en-IN')
  }

  const formatDateRangeText = (start: string, end: string) => {
    if (!start) return '—'
    const formatDate = (dateStr: string) => {
      const d = new Date(dateStr)
      if (isNaN(d.getTime())) return dateStr
      return d.toLocaleDateString('en-IN', { day: '2-digit', month: '2-digit', year: 'numeric' })
    }
    if (!end || start === end) return formatDate(start)
    return `${formatDate(start)} to ${formatDate(end)}`
  }

  // Set State to open the inline Receipt Modal instead of a pop-up tab
  const handleGenerateReceipt = (booking: any) => {
    setReceiptBooking(booking)
    setShowReceipt(true)
  }

  // Open Edit Panel
  const handleOpenEdit = (b: any) => {
    setEditingBooking(b)
    setEditClientName(b.client_name)
    setEditEmail(b.email)
    setEditPhone(b.phone)
    setEditLocation(b.location)
    setEditPackage(b.package)
    setEditPackageDetails(b.package_details || '')
    setEditNumGuests(b.num_guests !== null && b.num_guests !== undefined ? String(b.num_guests) : '')
    setEditAgreedPrice(String(b.agreed_price))
    setEditAdvancePaid(String(b.advance_paid))
    setEditPaymentStatus(b.payment_status)
    setEditPaymentMethod(b.payment_method)
    const terms = b.payment_terms || 'Custom — see amounts below';
    if (terms === '100% Advance' || terms === 'Pay on Delivery') {
      setEditPaymentTerms(terms)
    } else {
      setEditPaymentTerms('Custom — see amounts below')
    }
    setEditLeadPhotographer(b.lead_photographer || '')
    setEditSecondShooter(b.second_shooter || '')
    setEditVideographer(b.videographer || '')
    setEditSpecialRequirements(b.special_requirements || '')
    setEditBookingStatus(b.booking_status)
    setEditAdminNotes(b.admin_notes || '')
    setEditStartDate(dbDateToDisplayDate(b.event_date_start))
    setEditEndDate(dbDateToDisplayDate(b.event_date_end))
    setEditEmailError('')
    setEditStartDateError('')
    setEditEndDateError('')
    setEditClientNameError('')
    setEditAgreedPriceError('')
    setIsEditPanelOpen(true)
  }

  // Save Edit Booking updates
  const handleSaveEdit = async () => {
    if (!editingBooking) return
    // Reset errors
    setEditEmailError('')
    setEditStartDateError('')
    setEditEndDateError('')
    setEditClientNameError('')
    setEditAgreedPriceError('')

    let hasError = false

    if (!editClientName || !editClientName.trim()) {
      setEditClientNameError("Client Name is required.")
      hasError = true
    }
    if (!editAgreedPrice) {
      setEditAgreedPriceError("Agreed Price is required.")
      hasError = true
    }
    if (!editStartDate) {
      setEditStartDateError("Start Date is required.")
      hasError = true
    }
    if (!editEndDate) {
      setEditEndDateError("End Date is required.")
      hasError = true
    }

    if (editEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(editEmail)) {
      setEditEmailError("Please enter a valid email address (e.g. client@example.com).")
      hasError = true
    }

    if (editStartDate && isInvalidDate(editStartDate)) {
      setEditStartDateError("Please enter a valid Start Date in DD/MM/YYYY format.")
      hasError = true
    }
    if (editEndDate && isInvalidDate(editEndDate)) {
      setEditEndDateError("Please enter a valid End Date in DD/MM/YYYY format.")
      hasError = true
    }

    if (hasError) {
      return
    }

    const dbStart = displayDateToDbDate(editStartDate)
    const dbEnd = displayDateToDbDate(editEndDate || editStartDate)

    if (dbEnd < dbStart) {
      setEditEndDateError("End Date cannot be before Start Date.")
      return
    }

    const priceNum = Number(editAgreedPrice)
    const advanceNum = Number(editAdvancePaid || 0)

    if (advanceNum > priceNum) {
      setEditAgreedPriceError("Agreed Price must be greater than or equal to Advance Paid.")
      return
    }

    setEditPanelSaving(true)
    const balanceNum = Math.max(0, priceNum - advanceNum)

    const updatedBooking = {
      ...editingBooking,
      client_name: editClientName,
      email: editEmail,
      phone: editPhone,
      location: editLocation,
      package: editPackage,
      package_details: editPackageDetails || null,
      num_guests: editNumGuests ? Number(editNumGuests) : null,
      agreed_price: priceNum,
      advance_paid: advanceNum,
      balance_due: balanceNum,
      payment_status: editPaymentStatus,
      payment_method: editPaymentMethod,
      payment_terms: editPaymentTerms,
      lead_photographer: editLeadPhotographer || null,
      second_shooter: editSecondShooter || null,
      videographer: editVideographer || null,
      special_requirements: editSpecialRequirements || null,
      booking_status: editBookingStatus,
      admin_notes: editAdminNotes || null,
      event_date_start: dbStart,
      event_date_end: dbEnd
    }

    // Optimistic UI updates
    setBookings(prev => prev.map(item => item.id === editingBooking.id ? updatedBooking : item))
    setIsEditPanelOpen(false)
    setSuccessMsg("Booking updated successfully!")
    setTimeout(() => setSuccessMsg(''), 4000)

    if (isDemoMode()) {
      const demo = getDemoBookings()
      const index = demo.findIndex(item => item.id === editingBooking.id)
      if (index !== -1) {
        demo[index] = updatedBooking
        saveDemoBookings(demo)
      }

      // Also update calendar event
      if (editingBooking.calendar_event_id) {
        const events = getDemoEvents()
        const eventIdx = events.findIndex(e => e.id === editingBooking.calendar_event_id)
        if (eventIdx !== -1) {
          events[eventIdx] = {
            ...events[eventIdx],
            title: `${editingBooking.event_type.replace('_', ' ').replace(/\b\w/g, (c: string) => c.toUpperCase())}: ${editClientName}`,
            event_date: dbStart,
            event_end_date: dbEnd,
            notes: `Package: ${editPackage}. Price agreed: ₹${priceNum}. Location: ${editLocation}. Lead: ${editLeadPhotographer || '—'}.`
          }
          saveDemoEvents(events)
        }
      }
      setEditPanelSaving(false)
      fetchBookings()
      return
    }

    try {
      // 1. Save Booking in Supabase
      const { error: bError } = await supabase
        .from('bookings')
        .update({
          client_name: editClientName,
          email: editEmail,
          phone: editPhone,
          location: editLocation,
          package: editPackage,
          package_details: editPackageDetails || null,
          num_guests: editNumGuests ? Number(editNumGuests) : null,
          agreed_price: priceNum,
          advance_paid: advanceNum,
          balance_due: balanceNum,
          payment_status: editPaymentStatus,
          payment_method: editPaymentMethod,
          payment_terms: editPaymentTerms,
          lead_photographer: editLeadPhotographer || null,
          second_shooter: editSecondShooter || null,
          videographer: editVideographer || null,
          special_requirements: editSpecialRequirements || null,
          booking_status: editBookingStatus,
          admin_notes: editAdminNotes || null,
          event_date_start: dbStart,
          event_date_end: dbEnd
        })
        .eq('id', editingBooking.id)

      if (bError) throw bError

      // 2. Save calendar event in Supabase
      if (editingBooking.calendar_event_id) {
        const { error: eError } = await supabase
          .from('calendar_events')
          .update({
            title: `${editingBooking.event_type.replace('_', ' ').replace(/\b\w/g, (c: string) => c.toUpperCase())}: ${editClientName}`,
            event_date: dbStart,
            event_end_date: dbEnd,
            notes: `Package: ${editPackage}. Price agreed: ₹${priceNum}. Location: ${editLocation}. Lead: ${editLeadPhotographer || '—'}.`
          })
          .eq('id', editingBooking.calendar_event_id)

        if (eError) throw eError
      }
    } catch (e: any) {
      console.error(e)
      setErrorMsg(`Failed to save to database: ${e.message}`)
      fetchBookings() // Revert optimistic changes on failure
    } finally {
      setEditPanelSaving(false)
    }
  }

  // Delete Booking
  const handleDeleteBooking = async (b: any) => {
    if (!confirm("Are you sure you want to delete this booking? This will also remove it from the calendar.")) return

    // Optimistic UI updates
    setBookings(prev => prev.filter(item => item.id !== b.id))
    setIsEditPanelOpen(false)
    setSuccessMsg("Booking deleted successfully.")
    setTimeout(() => setSuccessMsg(''), 4000)

    if (isDemoMode()) {
      const demo = getDemoBookings()
      saveDemoBookings(demo.filter(item => item.id !== b.id))

      if (b.calendar_event_id) {
        const evts = getDemoEvents()
        saveDemoEvents(evts.filter(e => e.id !== b.calendar_event_id))
      }
      fetchBookings()
      return
    }

    try {
      const { error: deleteError } = await supabase
        .from('bookings')
        .delete()
        .eq('id', b.id)
      if (deleteError) throw deleteError

      if (b.calendar_event_id) {
        await supabase
          .from('calendar_events')
          .delete()
          .eq('id', b.calendar_event_id)
      }
    } catch (e: any) {
      console.error(e)
      setErrorMsg(`Failed to delete booking: ${e.message}`)
      fetchBookings()
    }
  }

  // Save manual booking form
  const handleSaveNewBooking = async (generateReceipt = false) => {
    // Reset errors
    setAddClientNameError('');
    setAddAgreedPriceError('');
    setAddLocationError('');
    setAddEmailError('');
    setAddStartDateError('');
    setAddEndDateError('');

    let hasError = false;

    if (!addClientName || !addClientName.trim()) {
      setAddClientNameError("Client Name is required.");
      hasError = true;
    }
    if (!addAgreedPrice) {
      setAddAgreedPriceError("Agreed Price is required.");
      hasError = true;
    }
    if (!addLocation || !addLocation.trim()) {
      setAddLocationError("Location is required.");
      hasError = true;
    }
    if (!addStartDate) {
      setAddStartDateError("Start Date is required.");
      hasError = true;
    }
    if (!addEndDate) {
      setAddEndDateError("End Date is required.");
      hasError = true;
    }

    if (addEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(addEmail)) {
      setAddEmailError("Please enter a valid email address (e.g. client@example.com).");
      hasError = true;
    }

    if (addStartDate && isInvalidDate(addStartDate)) {
      setAddStartDateError("Please enter a valid Start Date in DD/MM/YYYY format.");
      hasError = true;
    }
    if (addEndDate && isInvalidDate(addEndDate)) {
      setAddEndDateError("Please enter a valid End Date in DD/MM/YYYY format.");
      hasError = true;
    }

    if (hasError) {
      return;
    }

    const dbStart = displayDateToDbDate(addStartDate)
    const dbEnd = displayDateToDbDate(addEndDate || addStartDate)

    if (dbEnd < dbStart) {
      setAddEndDateError("End Date cannot be before Start Date.");
      return;
    }

    const todayVal = new Date().toISOString().split('T')[0];
    if (dbStart < todayVal) {
      setAddStartDateError("Event start date cannot be before today.");
      return;
    }

    const priceNum = Number(addAgreedPrice);
    const advanceNum = Number(addAdvancePaid || 0);

    if (advanceNum > priceNum) {
      setAddAgreedPriceError("Agreed Price must be greater than or equal to Advance Paid.");
      return;
    }

    setFormSaving(true);
    const balanceNum = Math.max(0, priceNum - advanceNum);

    const finalTerms = addPaymentTerms;

    const tempEventId = 'event-' + Date.now();
    const tempBookingId = 'booking-' + Date.now();
    const receiptNum = await generateUniqueReceiptNumber(isDemoMode() ? null : supabase, isDemoMode(), bookings);

    const newBookingObj = {
      id: tempBookingId,
      enquiry_id: null,
      calendar_event_id: tempEventId,
      source: 'manual' as 'manual',
      client_name: addClientName,
      email: addEmail,
      phone: addPhone,
      how_found: addHowFound,
      event_type: addEventType,
      event_date_start: dbStart,
      event_date_end: dbEnd,
      location: addLocation,
      package: addPackage === 'Custom' ? `Custom: ${addCustomPackageDetails}` : addPackage,
      package_details: addCustomPackageDetails || null,
      num_guests: addNumGuests ? Number(addNumGuests) : null,
      agreed_price: priceNum,
      advance_paid: advanceNum,
      balance_due: balanceNum,
      payment_status: addPaymentStatus,
      payment_method: addPaymentMethod,
      payment_terms: finalTerms,
      lead_photographer: addLeadPhotographer || null,
      second_shooter: addSecondShooter || null,
      videographer: addVideographer || null,
      special_requirements: addSpecialRequirements || null,
      booking_status: addBookingStatus,
      admin_notes: addAdminNotes || null,
      receipt_number: receiptNum,
      created_at: new Date().toISOString()
    };

    const newCalendarEvent = {
      id: tempEventId,
      enquiry_id: null,
      title: `${addEventType.replace('_', ' ').replace(/\b\w/g, c => c.toUpperCase())}: ${addClientName}`,
      event_date: dbStart,
      event_end_date: dbEnd,
      event_type: addEventType as any,
      team_member: addLeadPhotographer ? `${addLeadPhotographer} (Lead Photographer)` : null,
      notes: `Package: ${addPackage}. Price agreed: ₹${priceNum}. Location: ${addLocation}. Lead: ${addLeadPhotographer || '—'}. ${addSpecialRequirements || ''}`,
      created_at: new Date().toISOString()
    };

    // Optimistic Save
    setBookings(prev => [newBookingObj, ...prev]);
    setActiveTab('list');
    setSuccessMsg("Booking saved successfully!");
    setTimeout(() => setSuccessMsg(''), 4000);

    if (generateReceipt) {
      handleGenerateReceipt(newBookingObj);
    }

    if (isDemoMode()) {
      const demoB = getDemoBookings();
      saveDemoBookings([newBookingObj, ...demoB]);

      const demoE = getDemoEvents();
      saveDemoEvents([...demoE, newCalendarEvent]);

      setFormSaving(false);
      clearAddForm();
      fetchBookings();
      return;
    }

    try {
      // 1. Insert Event in Supabase
      const { data: dbEvent, error: eError } = await supabase
        .from('calendar_events')
        .insert({
          title: newCalendarEvent.title,
          event_date: dbStart,
          event_end_date: dbEnd,
          event_type: addEventType,
          team_member: addLeadPhotographer ? `${addLeadPhotographer} (Lead Photographer)` : null,
          notes: newCalendarEvent.notes
        })
        .select('id')
        .single();

      if (eError) throw eError;

      // 2. Insert Booking referencing the actual DB Calendar Event ID
      const { error: bError } = await supabase
        .from('bookings')
        .insert({
          calendar_event_id: dbEvent?.id,
          source: 'manual',
          client_name: addClientName,
          email: addEmail,
          phone: addPhone,
          how_found: addHowFound,
          event_type: addEventType,
          event_date_start: dbStart,
          event_date_end: dbEnd,
          location: addLocation,
          package: addPackage === 'Custom' ? `Custom: ${addCustomPackageDetails}` : addPackage,
          package_details: addCustomPackageDetails || null,
          num_guests: addNumGuests ? Number(addNumGuests) : null,
          agreed_price: priceNum,
          advance_paid: advanceNum,
          balance_due: balanceNum,
          payment_status: addPaymentStatus,
          payment_method: addPaymentMethod,
          payment_terms: finalTerms,
          lead_photographer: addLeadPhotographer || null,
          second_shooter: addSecondShooter || null,
          videographer: addVideographer || null,
          special_requirements: addSpecialRequirements || null,
          booking_status: addBookingStatus,
          admin_notes: addAdminNotes || null,
          receipt_number: receiptNum
        });

      if (bError) throw bError;
      clearAddForm();
    } catch (e: any) {
      console.error(e);
      setErrorMsg(`Failed to save to database: ${e.message}`);
      fetchBookings(); // Revert on error
    } finally {
      setFormSaving(false);
    }
  }

  const clearAddForm = () => {
    setAddClientName('')
    setAddEmail('')
    setAddPhone('')
    setAddHowFound('Instagram')
    setAddEventType('marriage')
    setAddStartDate('')
    setAddEndDate('')
    setAddLocation('')
    setAddPackage('Full Wedding Photo+Video')
    setAddCustomPackageDetails('')
    setAddNumGuests('')
    setAddAgreedPrice('')
    setAddAdvancePaid('')
    setAddLeadPhotographer('')
    setAddSecondShooter('')
    setAddVideographer('')
    setAddSpecialRequirements('')
    setAddBookingStatus('confirmed')
    setAddAdminNotes('')
    setAddEmailError('')
    setAddStartDateError('')
    setAddEndDateError('')
  }

  // Filter & Sort Logic
  const filteredBookings = bookings.filter(b => {
    // Search filter
    const matchesSearch = b.client_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          b.package.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          b.location.toLowerCase().includes(searchQuery.toLowerCase())
    
    // Type Filter
    const matchesType = typeFilter === 'all' || b.event_type === typeFilter
    
    // Payment Status filter
    let matchesPayment = true
    if (paymentFilter !== 'all') {
      matchesPayment = b.payment_status === paymentFilter
    }

    return matchesSearch && matchesType && matchesPayment
  }).sort((a, b) => {
    if (sortBy === 'newest') {
      return new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime()
    } else if (sortBy === 'soonest') {
      return new Date(a.event_date_start).getTime() - new Date(b.event_date_start).getTime()
    } else if (sortBy === 'payment') {
      // Unpaid / due first
      const statusMap = { due: 0, partial: 1, paid: 2 }
      const valA = statusMap[a.payment_status as keyof typeof statusMap] ?? 0
      const valB = statusMap[b.payment_status as keyof typeof statusMap] ?? 0
      return valA - valB
    } else if (sortBy === 'amount') {
      return Number(b.agreed_price) - Number(a.agreed_price)
    }
    return 0
  })

  return (
    <>
      <div className="space-y-6 print:hidden">
      {/* Messages */}
      {successMsg && (
        <div className="fixed bottom-5 right-5 bg-black text-white px-4 py-3 rounded-lg shadow-lg flex items-center gap-2 z-50 animate-bounce">
          <Check className="h-4 w-4 text-green-400" />
          <span>{successMsg}</span>
        </div>
      )}
      {errorMsg && (
        <div className="bg-red-50 text-red-700 px-4 py-3 rounded-lg border border-red-200">
          {errorMsg}
        </div>
      )}

      {/* Top Heading */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-black tracking-tight text-txt-primary">Bookings Manager</h1>
          <p className="text-sm text-txt-secondary mt-1">Register manual walk-in clients, monitor payments and generate receipts.</p>
        </div>
        
        {/* Toggle sub-tabs */}
        <div className="bg-sidebar-active border border-border-base p-1 rounded-lg inline-flex self-start">
          <button
            onClick={() => setActiveTab('list')}
            className={`px-4 py-1.5 rounded-md text-xs font-semibold tracking-wide transition-all ${
              activeTab === 'list' 
                ? 'bg-card-base text-txt-primary shadow-base' 
                : 'text-txt-secondary hover:text-txt-primary'
            }`}
          >
            All Bookings
          </button>
          <button
            onClick={() => setActiveTab('add')}
            className={`px-4 py-1.5 rounded-md text-xs font-semibold tracking-wide transition-all ${
              activeTab === 'add' 
                ? 'bg-card-base text-txt-primary shadow-base' 
                : 'text-txt-secondary hover:text-txt-primary'
            }`}
          >
            Add Booking
          </button>
        </div>
      </div>

      {/* Main Tab Views */}
      {activeTab === 'list' ? (
        <div className="space-y-6">
          {/* Controls Bar */}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-card-base p-4 rounded-xl border border-border-base shadow-base">
            {/* Search */}
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-txt-muted" />
              <input
                type="text"
                placeholder="Search bookings by client, location, package..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-input-border rounded-lg text-sm bg-input-base text-txt-primary placeholder-txt-muted focus:border-txt-primary focus:outline-hidden focus:ring-1 focus:ring-txt-primary"
              />
            </div>

            {/* Sorting */}
            <div className="flex items-center gap-3">
              <span className="text-xs text-txt-muted font-bold uppercase tracking-wider">Sort by</span>
              <select
                value={sortBy}
                onChange={e => setSortBy(e.target.value)}
                className="border border-input-border rounded-lg py-1.5 px-3 text-xs bg-input-base text-txt-secondary font-medium focus:outline-hidden focus:ring-1 focus:ring-txt-primary cursor-pointer"
              >
                <option value="newest">Newest Added</option>
                <option value="soonest">Event Date (Soonest)</option>
                <option value="payment">Unpaid First</option>
                <option value="amount">Highest Amount</option>
              </select>
            </div>
          </div>

          {/* Filters Pills */}
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs text-txt-muted font-bold uppercase tracking-wider mr-2">Event Type</span>
              {[
                { key: 'all', label: 'All Types' },
                { key: 'marriage', label: 'Marriage' },
                { key: 'portfolio_shoot', label: 'Portfolio' },
                { key: 'brand_photoshoot', label: 'Brand' },
                { key: 'manual_shoot', label: 'Manual' }
              ].map(pill => (
                <button
                  key={pill.key}
                  onClick={() => setTypeFilter(pill.key)}
                  className={`px-3 py-1 rounded-full text-xs font-semibold transition-all border ${
                    typeFilter === pill.key
                      ? 'bg-txt-primary text-bg-base border-txt-primary'
                      : 'bg-card-base text-txt-secondary border-border-base hover:border-txt-muted'
                  }`}
                >
                  {pill.label}
                </button>
              ))}
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs text-txt-muted font-bold uppercase tracking-wider mr-2">Payment</span>
              {[
                { key: 'all', label: 'All Payments' },
                { key: 'due', label: 'Due' },
                { key: 'partial', label: 'Partial' },
                { key: 'paid', label: 'Paid in Full' }
              ].map(pill => (
                <button
                  key={pill.key}
                  onClick={() => setPaymentFilter(pill.key)}
                  className={`px-3 py-1 rounded-full text-xs font-semibold transition-all border ${
                    paymentFilter === pill.key
                      ? 'bg-txt-primary text-bg-base border-txt-primary'
                      : 'bg-card-base text-txt-secondary border-border-base hover:border-txt-muted'
                  }`}
                >
                  {pill.label}
                </button>
              ))}
            </div>
          </div>

          {/* List items */}
          {loading ? (
            <div className="text-center py-20 bg-card-base rounded-xl border border-border-base shadow-base">
              <div className="w-8 h-8 border-2 border-txt-primary border-t-transparent rounded-full animate-spin mx-auto" />
              <p className="text-sm text-txt-secondary mt-4 font-medium">Fetching bookings list...</p>
            </div>
          ) : filteredBookings.length === 0 ? (
            <div className="text-center py-20 bg-card-base rounded-xl border border-border-base shadow-base">
              <FileText className="h-10 w-10 text-txt-muted mx-auto mb-4" />
              <h3 className="text-lg font-bold text-txt-primary">No bookings found</h3>
              <p className="text-sm text-txt-secondary max-w-sm mx-auto mt-1">Try updating your filters or register a new client booking.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4">
              {filteredBookings.map((b) => {
                const accentColor = TYPE_COLORS[b.event_type] || '#616161'
                
                // Date formatted
                const dateStr = b.event_date_start === b.event_date_end
                  ? new Date(b.event_date_start).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
                  : `${new Date(b.event_date_start).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })} — ${new Date(b.event_date_end).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}`

                return (
                  <div
                    key={b.id}
                    className="bg-card-base rounded-xl border border-border-base flex flex-col md:flex-row shadow-base hover:shadow-md-base transition-all relative overflow-hidden group"
                  >
                    {/* Left Event-Type colored side bar */}
                    <div className="w-2 md:w-2" style={{ backgroundColor: accentColor }} />
                    
                    {/* Content Section */}
                    <div className="flex-1 p-5 flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
                      <div className="space-y-2">
                        {/* Name and Walk-in tag */}
                        <div className="flex flex-wrap items-center gap-2">
                          <h3 className="text-lg font-bold text-txt-primary tracking-tight leading-none">{b.client_name}</h3>
                          
                          {/* Walk-in vs Enquiry Badge */}
                          {b.source === 'manual' ? (
                            <span className="text-[10px] font-bold text-txt-secondary bg-sidebar-active border border-border-base px-2 py-0.5 rounded">Walk-in</span>
                          ) : (
                            <span className="text-[10px] font-bold text-blue-500 dark:text-blue-400 bg-blue-500/10 border border-blue-500/20 px-2 py-0.5 rounded">Online</span>
                          )}
                        </div>

                        {/* Badges */}
                        <div className="flex items-center gap-2">
                          <span 
                            className="text-[11px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full text-white"
                            style={{ backgroundColor: accentColor }}
                          >
                            {b.event_type.replace('_', ' ')}
                          </span>

                          <span className={`text-[11px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full border ${
                            b.booking_status === 'confirmed' ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20' :
                            b.booking_status === 'cancelled' ? 'bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/20' :
                            'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20'
                          }`}>
                            {b.booking_status}
                          </span>
                        </div>

                        {/* Metadata details */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-1.5 text-xs text-txt-secondary font-medium">
                          <div className="flex items-center gap-1.5">
                            <Calendar className="h-3.5 w-3.5 text-txt-muted" />
                            <span>{dateStr}</span>
                          </div>
                          
                          <div className="flex items-center gap-1.5">
                            <MapPin className="h-3.5 w-3.5 text-txt-muted" />
                            <span>{b.location}</span>
                          </div>

                          <div className="flex items-center gap-1.5 sm:col-span-2">
                            <FileText className="h-3.5 w-3.5 text-txt-muted" />
                            <span>{b.package}</span>
                          </div>
                        </div>

                        {/* Links */}
                        {b.enquiry_id && (
                          <Link
                            href={`/dashboard/enquiries/${b.enquiry_id}`}
                            className="inline-flex items-center gap-1 text-xs text-indigo-500 dark:text-indigo-400 font-bold hover:underline"
                          >
                            <span>From enquiry</span>
                            <ArrowRight className="h-3 w-3" />
                          </Link>
                        )}
                      </div>

                      {/* Pricing and Action side */}
                      <div className="flex flex-col sm:flex-row md:flex-col items-start md:items-end justify-between w-full md:w-auto gap-4 border-t md:border-0 pt-4 md:pt-0 border-border-base">
                        <div className="space-y-1">
                          <div className="text-sm font-semibold text-txt-primary">
                            ₹{b.agreed_price.toLocaleString('en-IN')} agreed · <span className="text-txt-secondary">₹{b.advance_paid.toLocaleString('en-IN')} paid</span>
                          </div>
                          
                          {/* Payment status badge */}
                          <div className="flex items-center gap-2 md:justify-end">
                            <span className="text-xs text-txt-muted font-bold">Payments</span>
                            <span className={`text-[10px] font-extrabold uppercase tracking-widest px-2 py-0.5 rounded-sm border ${
                              b.payment_status === 'paid' ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20' :
                              b.payment_status === 'partial' ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20' :
                              'bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/20'
                            }`}>
                              {b.payment_status === 'paid' ? 'Paid in Full' : b.payment_status === 'partial' ? 'Partially Paid' : 'Due'}
                            </span>
                          </div>
                          
                          {b.lead_photographer && (
                            <div className="text-[11px] text-txt-secondary font-medium md:text-right">
                              Assigned: <span className="font-bold text-txt-primary">{b.lead_photographer}</span>
                            </div>
                          )}
                        </div>

                        {/* Buttons */}
                        <div className="flex items-center gap-2 self-stretch md:self-auto">
                          <button
                            onClick={() => handleGenerateReceipt(b)}
                            className="flex-1 md:flex-initial flex items-center justify-center gap-1.5 border border-border-base hover:bg-sidebar-active hover:text-txt-primary font-semibold text-xs py-1.5 px-3 rounded-lg transition-colors cursor-pointer text-txt-secondary bg-card-base"
                          >
                            <FileText className="h-3.5 w-3.5" />
                            <span>View receipt</span>
                          </button>
                          
                          <button
                            onClick={() => handleOpenEdit(b)}
                            className="flex items-center justify-center border border-border-base hover:bg-sidebar-active hover:text-txt-primary p-2 rounded-lg transition-colors cursor-pointer text-txt-secondary bg-card-base"
                            title="Edit Booking"
                          >
                            <Edit2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      ) : (
        /* ADD BOOKING FORM VIEW */
        <div className="bg-card-base border border-border-base rounded-xl max-w-4xl mx-auto shadow-base overflow-hidden">
          
          <div className="px-6 py-5 bg-tbl-header border-b border-border-base flex items-center justify-between">
            <h2 className="text-lg font-bold text-txt-primary tracking-tight flex items-center gap-2">
              <CalendarCheck className="h-5 w-5 text-txt-secondary" />
              <span>Register New Client Booking</span>
            </h2>
            <button
              onClick={() => setActiveTab('list')}
              className="text-xs font-bold text-txt-secondary hover:text-txt-primary flex items-center gap-1"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              <span>Back to list</span>
            </button>
          </div>

          <div className="p-6 sm:p-8 space-y-8">
            {/* Form Inputs divided into sections */}
            
            {/* Section 1: CLIENT INFORMATION */}
            <div className="space-y-4">
              <h3 className="text-xs font-extrabold uppercase tracking-widest text-txt-muted border-b border-border-base pb-2">Client Information</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-txt-primary">Full Name / Couple Names <span className="text-red-500">*</span></label>
                  <div className="relative">
                    <User className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-txt-muted" />
                    <input
                      type="text"
                      placeholder="e.g. Aisha & Rohan"
                      value={addClientName}
                      onChange={e => {
                        setAddClientName(e.target.value);
                        if (addClientNameError) setAddClientNameError('');
                      }}
                      className={`w-full pl-9 pr-3 py-2 border rounded-lg text-sm focus:outline-hidden focus:ring-1 ${
                        addClientNameError 
                          ? 'border-red-500 bg-input-base text-txt-primary focus:ring-red-500' 
                          : 'border-input-border bg-input-base text-txt-primary focus:border-txt-primary focus:ring-txt-primary'
                      }`}
                    />
                  </div>
                  {addClientNameError && (
                    <p className="text-[11px] font-semibold text-red-500 mt-1">{addClientNameError}</p>
                  )}
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-bold text-txt-primary">Email Address</label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-txt-muted" />
                    <input
                      type="email"
                      placeholder="e.g. client@example.com"
                      value={addEmail}
                      onChange={e => {
                        setAddEmail(e.target.value);
                        if (addEmailError) setAddEmailError('');
                      }}
                      onBlur={() => {
                        if (addEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(addEmail)) {
                          setAddEmailError("Please enter a valid email address (e.g. client@example.com).");
                        }
                      }}
                      className={`w-full pl-9 pr-3 py-2 border rounded-lg text-sm focus:outline-hidden focus:ring-1 ${
                        addEmailError 
                          ? 'border-red-500 bg-input-base text-txt-primary focus:ring-red-500' 
                          : 'border-input-border bg-input-base text-txt-primary focus:border-txt-primary focus:ring-txt-primary'
                      }`}
                    />
                  </div>
                  {addEmailError && (
                    <p className="text-[11px] font-semibold text-red-500 mt-1">{addEmailError}</p>
                  )}
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-bold text-txt-primary">Phone Number</label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-txt-muted font-semibold">+91</span>
                    <input
                      type="text"
                      placeholder="98765 43210"
                      value={addPhone}
                      onChange={e => setAddPhone(e.target.value)}
                      className="w-full pl-12 pr-3 py-2 border border-input-border rounded-lg text-sm bg-input-base text-txt-primary placeholder-txt-muted focus:outline-hidden focus:ring-1 focus:ring-txt-primary"
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-bold text-txt-primary">How did they find us?</label>
                  <select
                    value={addHowFound}
                    onChange={e => setAddHowFound(e.target.value)}
                    className="w-full px-3 py-2 border border-input-border rounded-lg text-sm bg-input-base text-txt-secondary focus:outline-hidden focus:ring-1 focus:ring-txt-primary cursor-pointer"
                  >
                    <option value="Instagram">Instagram</option>
                    <option value="Referral">Referral</option>
                    <option value="Walk-in">Walk-in</option>
                    <option value="Google Search">Google Search</option>
                    <option value="Other">Other</option>
                  </select>
                </div>
              </div>
            </div>

            {/* Section 2: EVENT DETAILS */}
            <div className="space-y-4">
              <h3 className="text-xs font-extrabold uppercase tracking-widest text-txt-muted border-b border-border-base pb-2">Event Details</h3>
              
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-txt-primary">Event Type <span className="text-red-500">*</span></label>
                  <select
                    value={addEventType}
                    onChange={e => setAddEventType(e.target.value)}
                    className="w-full px-3 py-2 border border-input-border rounded-lg text-sm bg-input-base text-txt-secondary focus:outline-hidden focus:ring-1 focus:ring-txt-primary cursor-pointer"
                  >
                    <option value="marriage">Marriage</option>
                    <option value="portfolio_shoot">Portfolio Shoot</option>
                    <option value="brand_photoshoot">Brand Photoshoot</option>
                    <option value="model_shoot">Model Shoot</option>
                    <option value="reel_shoot">Reel Shoot</option>
                    <option value="manual_shoot">Manual Shoot</option>
                    <option value="blocked">Blocked Date</option>
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-bold text-txt-primary">Location (City) <span className="text-red-500">*</span></label>
                  <div className="relative">
                    <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-txt-muted" />
                    <input
                      type="text"
                      placeholder="e.g. Udaipur, Goa, Delhi"
                      value={addLocation}
                      onChange={e => {
                        setAddLocation(e.target.value);
                        if (addLocationError) setAddLocationError('');
                      }}
                      className={`w-full pl-9 pr-3 py-2 border rounded-lg text-sm focus:outline-hidden focus:ring-1 ${
                        addLocationError 
                          ? 'border-red-500 bg-input-base text-txt-primary focus:ring-red-500' 
                          : 'border-input-border bg-input-base text-txt-primary focus:border-txt-primary focus:ring-txt-primary'
                      }`}
                    />
                  </div>
                  {addLocationError && (
                    <p className="text-[11px] font-semibold text-red-500 mt-1">{addLocationError}</p>
                  )}
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-bold text-txt-primary">Event Date (Start) <span className="text-red-500">*</span></label>
                  <div className="relative flex flex-col justify-start">
                    <div className="relative flex items-center">
                      <input
                        type="text"
                        required
                        placeholder="DD/MM/YYYY"
                        value={addStartDate}
                        onChange={(e) => handleDateInputChange(e.target.value, setAddStartDate)}
                        onFocus={() => {
                          const parsed = parseDisplayDate(addStartDate)
                          setCalendarViewDate(parsed || new Date())
                          setOpenCalendar('addStart')
                        }}
                        className={`w-full pl-3 pr-10 py-2 border rounded-lg text-sm focus:outline-hidden focus:ring-1 ${
                          addStartDateError 
                            ? 'border-red-500 bg-input-base text-txt-primary focus:ring-red-500' 
                            : 'border-input-border bg-input-base text-txt-primary focus:border-txt-primary focus:ring-txt-primary'
                        }`}
                      />
                      <button
                        type="button"
                        onClick={() => toggleCalendar('addStart')}
                        className="add-start-toggle absolute right-2 text-txt-muted hover:text-txt-primary p-1 rounded hover:bg-tbl-hover transition-colors"
                        title="Select date"
                      >
                        <Calendar className="h-4 w-4" />
                      </button>
                    </div>

                    {/* Custom Calendar Popup */}
                    {openCalendar === 'addStart' && (
                      <div 
                        ref={addStartCalendarRef}
                        className="absolute left-0 top-full mt-1 z-[9999] bg-modal-base border border-border-base rounded-lg shadow-lg-base p-3 w-64 text-sm text-txt-primary select-none animate-fadeIn"
                      >
                        <div className="flex items-center justify-between mb-2">
                          <button 
                            type="button"
                            onClick={() => {
                              setCalendarViewDate(new Date(calendarViewDate.getFullYear(), calendarViewDate.getMonth() - 1, 1))
                            }}
                            className="p-1 text-txt-muted hover:text-txt-primary hover:bg-tbl-hover rounded transition-colors"
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
                            className="p-1 text-txt-muted hover:text-txt-primary hover:bg-tbl-hover rounded transition-colors"
                          >
                            <ChevronRight className="h-4 w-4" />
                          </button>
                        </div>

                        <div className="grid grid-cols-7 gap-1 text-center text-xs font-bold text-txt-muted mb-1">
                          <span>Su</span><span>Mo</span><span>Tu</span><span>We</span><span>Th</span><span>Fr</span><span>Sa</span>
                        </div>

                        <div className="grid grid-cols-7 gap-1 text-center text-xs">
                          {renderDaysGrid('addStart')}
                        </div>
                      </div>
                    )}
                  </div>
                  {addStartDateError && (
                    <p className="text-[11px] font-semibold text-red-500 mt-1">{addStartDateError}</p>
                  )}
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-bold text-txt-primary">Event Date (End) <span className="text-red-500">*</span></label>
                  <div className="relative flex flex-col justify-start">
                    <div className="relative flex items-center">
                      <input
                        type="text"
                        required
                        placeholder="DD/MM/YYYY"
                        value={addEndDate}
                        onChange={(e) => handleDateInputChange(e.target.value, setAddEndDate)}
                        onFocus={() => {
                          const parsed = parseDisplayDate(addEndDate)
                          setCalendarViewDate(parsed || new Date())
                          setOpenCalendar('addEnd')
                        }}
                        className={`w-full pl-3 pr-10 py-2 border rounded-lg text-sm focus:outline-hidden focus:ring-1 ${
                          addEndDateError 
                            ? 'border-red-500 bg-input-base text-txt-primary focus:ring-red-500' 
                            : 'border-input-border bg-input-base text-txt-primary focus:border-txt-primary focus:ring-txt-primary'
                        }`}
                      />
                      <button
                        type="button"
                        onClick={() => toggleCalendar('addEnd')}
                        className="add-end-toggle absolute right-2 text-txt-muted hover:text-txt-primary p-1 rounded hover:bg-tbl-hover transition-colors"
                        title="Select date"
                      >
                        <Calendar className="h-4 w-4" />
                      </button>
                    </div>

                    {/* Custom Calendar Popup */}
                    {openCalendar === 'addEnd' && (
                      <div 
                        ref={addEndCalendarRef}
                        className="absolute left-0 top-full mt-1 z-[9999] bg-modal-base border border-border-base rounded-lg shadow-lg-base p-3 w-64 text-sm text-txt-primary select-none animate-fadeIn"
                      >
                        <div className="flex items-center justify-between mb-2">
                          <button 
                            type="button"
                            onClick={() => {
                              setCalendarViewDate(new Date(calendarViewDate.getFullYear(), calendarViewDate.getMonth() - 1, 1))
                            }}
                            className="p-1 text-txt-muted hover:text-txt-primary hover:bg-tbl-hover rounded transition-colors"
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
                            className="p-1 text-txt-muted hover:text-txt-primary hover:bg-tbl-hover rounded transition-colors"
                          >
                            <ChevronRight className="h-4 w-4" />
                          </button>
                        </div>

                        <div className="grid grid-cols-7 gap-1 text-center text-xs font-bold text-txt-muted mb-1">
                          <span>Su</span><span>Mo</span><span>Tu</span><span>We</span><span>Th</span><span>Fr</span><span>Sa</span>
                        </div>

                        <div className="grid grid-cols-7 gap-1 text-center text-xs">
                          {renderDaysGrid('addEnd')}
                        </div>
                      </div>
                    )}
                  </div>
                  {addEndDateError && (
                    <p className="text-[11px] font-semibold text-red-500 mt-1">{addEndDateError}</p>
                  )}
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-bold text-txt-primary">Number of Days (calculated)</label>
                  <input
                    type="text"
                    value={addDays}
                    readOnly
                    className="w-full px-3 py-2 border border-border-base rounded-lg text-sm bg-sidebar-active text-txt-secondary font-bold focus:outline-hidden"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-bold text-txt-primary">Number of Guests (optional)</label>
                  <input
                    type="number"
                    placeholder="e.g. 150"
                    value={addNumGuests}
                    onChange={e => setAddNumGuests(e.target.value)}
                    className="w-full px-3 py-2 border border-input-border rounded-lg text-sm bg-input-base text-txt-primary placeholder-txt-muted focus:outline-hidden focus:ring-1 focus:ring-txt-primary"
                  />
                </div>

                <div className="space-y-1 sm:col-span-2">
                  <label className="text-xs font-bold text-txt-primary">Package Requested</label>
                  <select
                    value={addPackage}
                    onChange={e => setAddPackage(e.target.value)}
                    className="w-full px-3 py-2 border border-input-border rounded-lg text-sm bg-input-base text-txt-secondary focus:outline-hidden focus:ring-1 focus:ring-txt-primary cursor-pointer"
                  >
                    <option value="Full Wedding Photo+Video">Full Wedding Photo+Video</option>
                    <option value="Photo Only">Photo Only</option>
                    <option value="Video Only">Video Only</option>
                    <option value="Pre-Wedding">Pre-Wedding</option>
                    <option value="Portfolio">Portfolio Shoot</option>
                    <option value="Brand Shoot">Brand Shoot</option>
                    <option value="Custom">Custom Package Details</option>
                  </select>
                </div>

                {addPackage === 'Custom' && (
                  <div className="space-y-1 sm:col-span-2">
                    <label className="text-xs font-bold text-txt-primary">Custom Package Details</label>
                    <textarea
                      placeholder="Specify custom items, deliverables, and specifications..."
                      rows={2}
                      value={addCustomPackageDetails}
                      onChange={e => setAddCustomPackageDetails(e.target.value)}
                      className="w-full px-3 py-2 border border-input-border rounded-lg text-sm bg-input-base text-txt-primary placeholder-txt-muted focus:outline-hidden focus:ring-1 focus:ring-txt-primary"
                    />
                  </div>
                )}
              </div>
            </div>

            {/* Section 3: PAYMENT DETAILS */}
            <div className="space-y-4">
              <h3 className="text-xs font-extrabold uppercase tracking-widest text-txt-muted border-b border-border-base pb-2">Payment Details</h3>
              
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-txt-primary">Agreed Price (INR) <span className="text-red-500">*</span></label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-txt-muted font-semibold">₹</span>
                    <input
                      type="number"
                      placeholder="e.g. 150000"
                      value={addAgreedPrice}
                      onChange={e => {
                        setAddAgreedPrice(e.target.value);
                        if (addAgreedPriceError) setAddAgreedPriceError('');
                      }}
                      className={`w-full pl-8 pr-3 py-2 border rounded-lg text-sm focus:outline-hidden focus:ring-1 ${
                        addAgreedPriceError 
                          ? 'border-red-500 bg-input-base text-txt-primary focus:ring-red-500' 
                          : 'border-input-border bg-input-base text-txt-primary focus:border-txt-primary focus:ring-txt-primary'
                      }`}
                    />
                  </div>
                  {addAgreedPriceError && (
                    <p className="text-[11px] font-semibold text-red-500 mt-1">{addAgreedPriceError}</p>
                  )}
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-bold text-txt-primary">Advance Paid (INR)</label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-txt-muted font-semibold">₹</span>
                    <input
                      type="number"
                      placeholder="e.g. 75000"
                      value={addAdvancePaid}
                      onChange={e => setAddAdvancePaid(e.target.value)}
                      className="w-full pl-8 pr-3 py-2 border border-input-border rounded-lg text-sm bg-input-base text-txt-primary placeholder-txt-muted focus:outline-hidden focus:ring-1 focus:ring-txt-primary"
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-bold text-txt-muted">Balance Due (INR)</label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-txt-muted font-bold">₹</span>
                    <input
                      type="text"
                      value={computedAddBalance.toLocaleString('en-IN')}
                      readOnly
                      className="w-full pl-8 pr-3 py-2 border border-border-base rounded-lg text-sm bg-sidebar-active text-txt-secondary font-bold focus:outline-hidden"
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-bold text-txt-muted">Advance Percentage</label>
                  <input
                    type="text"
                    value={
                      Number(addAgreedPrice || 0) > 0
                        ? `${((Number(addAdvancePaid || 0) / Number(addAgreedPrice)) * 100).toFixed(1)}% advance received`
                        : '0.0% advance received'
                    }
                    readOnly
                    className="w-full px-3 py-2 border border-border-base rounded-lg text-sm bg-sidebar-active text-txt-secondary font-bold focus:outline-hidden"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-bold text-txt-primary">Payment Status (auto calculated)</label>
                  <input
                    type="text"
                    value={addPaymentStatus === 'paid' ? 'Paid in Full' : addPaymentStatus === 'partial' ? 'Partially Paid' : 'Due'}
                    readOnly
                    className="w-full px-3 py-2 border border-border-base rounded-lg text-sm bg-sidebar-active text-txt-secondary font-bold focus:outline-hidden"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-bold text-txt-primary">Payment Method</label>
                  <select
                    value={addPaymentMethod}
                    onChange={e => setAddPaymentMethod(e.target.value)}
                    className="w-full px-3 py-2 border border-input-border rounded-lg text-sm bg-input-base text-txt-secondary focus:outline-hidden focus:ring-1 focus:ring-txt-primary cursor-pointer"
                  >
                    <option value="UPI">UPI (GPay/PhonePe)</option>
                    <option value="Bank Transfer">Bank Transfer</option>
                    <option value="Cash">Cash</option>
                    <option value="Cheque">Cheque</option>
                    <option value="Other">Other</option>
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-bold text-txt-primary">Payment Terms</label>
                  <select
                    value={addPaymentTerms}
                    onChange={e => setAddPaymentTerms(e.target.value)}
                    className="w-full px-3 py-2 border border-input-border rounded-lg text-sm bg-input-base text-txt-secondary focus:outline-hidden focus:ring-1 focus:ring-txt-primary cursor-pointer"
                  >
                    <option value="Custom — see amounts below">Custom — see amounts below</option>
                    <option value="100% Advance">100% Advance</option>
                    <option value="Pay on Delivery">Pay on Delivery</option>
                  </select>
                </div>
              </div>
            </div>

            {/* Section 4: TEAM & LOGISTICS */}
            <div className="space-y-4">
              <h3 className="text-xs font-extrabold uppercase tracking-widest text-txt-muted border-b border-border-base pb-2">Team & Logistics</h3>
              
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-txt-primary">Lead Photographer</label>
                  <input
                    type="text"
                    placeholder="Lead shooter name"
                    value={addLeadPhotographer}
                    onChange={e => setAddLeadPhotographer(e.target.value)}
                    className="w-full px-3 py-2 border border-input-border rounded-lg text-sm bg-input-base text-txt-primary placeholder-txt-muted focus:outline-hidden focus:ring-1 focus:ring-txt-primary"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-bold text-txt-primary">Second Shooter (optional)</label>
                  <input
                    type="text"
                    placeholder="Assistant shooter name"
                    value={addSecondShooter}
                    onChange={e => setAddSecondShooter(e.target.value)}
                    className="w-full px-3 py-2 border border-input-border rounded-lg text-sm bg-input-base text-txt-primary placeholder-txt-muted focus:outline-hidden focus:ring-1 focus:ring-txt-primary"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-bold text-txt-primary">Videographer (optional)</label>
                  <input
                    type="text"
                    placeholder="Cinema shooter name"
                    value={addVideographer}
                    onChange={e => setAddVideographer(e.target.value)}
                    className="w-full px-3 py-2 border border-input-border rounded-lg text-sm bg-input-base text-txt-primary placeholder-txt-muted focus:outline-hidden focus:ring-1 focus:ring-txt-primary"
                  />
                </div>

                <div className="space-y-1 sm:col-span-3">
                  <label className="text-xs font-bold text-txt-primary">Special Requirements & Logistics Notes</label>
                  <textarea
                    placeholder="Enter any lighting specifications, styling requirements, props or customer requests..."
                    rows={3}
                    value={addSpecialRequirements}
                    onChange={e => setAddSpecialRequirements(e.target.value)}
                    className="w-full px-3 py-2 border border-input-border rounded-lg text-sm bg-input-base text-txt-primary placeholder-txt-muted focus:outline-hidden focus:ring-1 focus:ring-txt-primary"
                  />
                </div>
              </div>
            </div>

            {/* Section 5: STATUS & NOTES */}
            <div className="space-y-4">
              <h3 className="text-xs font-extrabold uppercase tracking-widest text-txt-muted border-b border-border-base pb-2">Status & Admin Notes</h3>
              
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-txt-primary">Booking / Shoot Status</label>
                  <select
                    value={addBookingStatus}
                    onChange={e => setAddBookingStatus(e.target.value as any)}
                    className="w-full px-3 py-2 border border-input-border rounded-lg text-sm bg-input-base text-txt-secondary focus:outline-hidden focus:ring-1 focus:ring-txt-primary cursor-pointer"
                  >
                    <option value="confirmed">Confirmed</option>
                    <option value="in_progress">In Progress</option>
                    <option value="tentative">Tentative</option>
                    <option value="cancelled">Cancelled</option>
                  </select>
                </div>

                <div className="space-y-1 sm:col-span-2">
                  <label className="text-xs font-bold text-txt-primary">Admin Notes (internal)</label>
                  <textarea
                    placeholder="Internal reference notes, logs, history details..."
                    rows={3}
                    value={addAdminNotes}
                    onChange={e => setAddAdminNotes(e.target.value)}
                    className="w-full px-3 py-2 border border-input-border rounded-lg text-sm bg-input-base text-txt-primary placeholder-txt-muted focus:outline-hidden focus:ring-1 focus:ring-txt-primary"
                  />
                </div>
              </div>
            </div>

            {/* Bottom Actions */}
            <div className="border-t border-border-base pt-6 flex flex-col sm:flex-row items-center justify-end gap-3">
              <button
                type="button"
                onClick={() => {
                  clearAddForm()
                  setActiveTab('list')
                }}
                className="w-full sm:w-auto px-5 py-2.5 border border-border-base hover:bg-sidebar-active text-xs font-bold uppercase tracking-wider rounded-lg transition-colors cursor-pointer text-txt-secondary bg-card-base"
              >
                Cancel
              </button>

              <button
                type="button"
                disabled={formSaving}
                onClick={() => handleSaveNewBooking(false)}
                className="w-full sm:w-auto bg-txt-primary text-bg-base hover:opacity-95 text-xs font-bold uppercase tracking-wider px-6 py-2.5 rounded-lg shadow-base transition-colors cursor-pointer flex items-center justify-center border border-txt-primary"
              >
                {formSaving ? 'Registering...' : 'Save Booking'}
              </button>

              <button
                type="button"
                disabled={formSaving}
                onClick={() => handleSaveNewBooking(true)}
                className="w-full sm:w-auto bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold uppercase tracking-wider px-6 py-2.5 rounded-lg shadow-base transition-colors cursor-pointer flex items-center justify-center"
              >
                {formSaving ? 'Processing...' : 'Save & Generate Receipt'}
              </button>
            </div>

          </div>
        </div>
      )}

      {/* RIGHT SIDE SLIDE EDIT PANEL */}
      {isEditPanelOpen && editingBooking && (
        <div className="fixed inset-0 z-50 flex justify-end">
          {/* Backdrop overlay */}
          <div 
            onClick={() => setIsEditPanelOpen(false)}
            className="absolute inset-0 bg-black/60 backdrop-blur-xs transition-opacity"
          />

          {/* Panel drawer */}
          <div className="relative w-full sm:w-[420px] bg-modal-base border-l border-border-base h-full shadow-lg-base flex flex-col animate-slide-in overflow-hidden z-10">
            {/* Header */}
            <div className="p-4 border-b border-border-base flex items-center justify-between bg-sidebar-active">
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-txt-secondary bg-sidebar-active border border-border-base px-2 py-0.5 rounded uppercase">Edit Booking</span>
                <span className="text-xs font-semibold text-txt-secondary">{editingBooking.receipt_number}</span>
              </div>
              <button 
                onClick={() => setIsEditPanelOpen(false)}
                className="p-1 text-txt-muted hover:text-txt-primary rounded-lg transition-colors cursor-pointer"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Form Fields inside drawer */}
            <div className="flex-1 overflow-y-auto p-5 space-y-6 pb-24">
              
              {/* Client Name inline edit */}
              <div className="space-y-1">
                <label className="text-[10px] font-extrabold uppercase tracking-widest text-txt-muted">Client Name</label>
                <input
                  type="text"
                  value={editClientName}
                  onChange={e => {
                    setEditClientName(e.target.value);
                    if (editClientNameError) setEditClientNameError('');
                  }}
                  className={`w-full border rounded-lg px-3 py-2 text-sm focus:outline-hidden focus:ring-1 font-semibold ${
                    editClientNameError 
                      ? 'border-red-500 bg-input-base text-txt-primary focus:ring-red-500' 
                      : 'border-input-border bg-input-base text-txt-primary focus:border-txt-primary focus:ring-txt-primary'
                  }`}
                />
                {editClientNameError && (
                  <p className="text-[11px] font-semibold text-red-500 mt-1">{editClientNameError}</p>
                )}
              </div>

              {/* Status */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-[10px] font-extrabold uppercase tracking-widest text-txt-muted font-medium">Status</label>
                  <select
                    value={editBookingStatus}
                    onChange={e => setEditBookingStatus(e.target.value as any)}
                    className="w-full border border-input-border rounded-lg px-2.5 py-1.5 text-xs bg-input-base text-txt-secondary focus:outline-hidden focus:ring-1 focus:ring-txt-primary cursor-pointer"
                  >
                    <option value="confirmed">Confirmed</option>
                    <option value="in_progress">In Progress</option>
                    <option value="tentative">Tentative</option>
                    <option value="cancelled">Cancelled</option>
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-extrabold uppercase tracking-widest text-txt-muted font-medium">Payment status</label>
                  <select
                    value={editPaymentStatus}
                    onChange={e => setEditPaymentStatus(e.target.value as any)}
                    className="w-full border border-input-border rounded-lg px-2.5 py-1.5 text-xs bg-input-base text-txt-secondary focus:outline-hidden focus:ring-1 focus:ring-txt-primary cursor-pointer"
                  >
                    <option value="due">Due</option>
                    <option value="partial">Partial</option>
                    <option value="paid">Paid</option>
                  </select>
                </div>
              </div>

              {/* Dates */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-[10px] font-extrabold uppercase tracking-widest text-txt-muted">Start Date</label>
                  <div className="relative flex flex-col justify-start">
                    <div className="relative flex items-center">
                      <input
                        type="text"
                        required
                        placeholder="DD/MM/YYYY"
                        value={editStartDate}
                        onChange={(e) => {
                          handleDateInputChange(e.target.value, setEditStartDate);
                          if (editStartDateError) setEditStartDateError('');
                        }}
                        onFocus={() => {
                          const parsed = parseDisplayDate(editStartDate)
                          setCalendarViewDate(parsed || new Date())
                          setOpenCalendar('editStart')
                        }}
                        className={`w-full border rounded-lg pl-3 pr-8 py-1.5 text-xs focus:outline-hidden focus:ring-1 ${
                          editStartDateError 
                            ? 'border-red-500 bg-input-base text-txt-primary focus:ring-red-500' 
                            : 'border-input-border bg-input-base text-txt-primary focus:border-txt-primary focus:ring-txt-primary'
                        }`}
                      />
                      <button
                        type="button"
                        onClick={() => toggleCalendar('editStart')}
                        className="edit-start-toggle absolute right-1.5 text-txt-muted hover:text-txt-primary p-0.5 rounded hover:bg-tbl-hover transition-colors"
                        title="Select date"
                      >
                        <Calendar className="h-3.5 w-3.5" />
                      </button>
                    </div>

                    {/* Custom Calendar Popup */}
                    {openCalendar === 'editStart' && (
                      <div 
                        ref={editStartCalendarRef}
                        className="absolute right-0 top-full mt-1 z-[9999] bg-modal-base border border-border-base rounded-lg shadow-lg-base p-3 w-64 text-sm text-txt-primary select-none animate-fadeIn"
                      >
                        <div className="flex items-center justify-between mb-2">
                          <button 
                            type="button"
                            onClick={() => {
                              setCalendarViewDate(new Date(calendarViewDate.getFullYear(), calendarViewDate.getMonth() - 1, 1))
                            }}
                            className="p-1 text-txt-muted hover:text-txt-primary hover:bg-tbl-hover rounded transition-colors"
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
                            className="p-1 text-txt-muted hover:text-txt-primary hover:bg-tbl-hover rounded transition-colors"
                          >
                            <ChevronRight className="h-4 w-4" />
                          </button>
                        </div>

                        <div className="grid grid-cols-7 gap-1 text-center text-xs font-bold text-txt-muted mb-1">
                          <span>Su</span><span>Mo</span><span>Tu</span><span>We</span><span>Th</span><span>Fr</span><span>Sa</span>
                        </div>

                        <div className="grid grid-cols-7 gap-1 text-center text-xs">
                          {renderDaysGrid('editStart')}
                        </div>
                      </div>
                    )}
                  </div>
                  {editStartDateError && (
                    <p className="text-[10px] font-semibold text-red-500 mt-1">{editStartDateError}</p>
                  )}
                </div>
                
                <div className="space-y-1">
                  <label className="text-[10px] font-extrabold uppercase tracking-widest text-txt-muted">End Date</label>
                  <div className="relative flex flex-col justify-start">
                    <div className="relative flex items-center">
                      <input
                        type="text"
                        required
                        placeholder="DD/MM/YYYY"
                        value={editEndDate}
                        onChange={(e) => {
                          handleDateInputChange(e.target.value, setEditEndDate);
                          if (editEndDateError) setEditEndDateError('');
                        }}
                        onFocus={() => {
                          const parsed = parseDisplayDate(editEndDate)
                          setCalendarViewDate(parsed || new Date())
                          setOpenCalendar('editEnd')
                        }}
                        className={`w-full border rounded-lg pl-3 pr-8 py-1.5 text-xs focus:outline-hidden focus:ring-1 ${
                          editEndDateError 
                            ? 'border-red-500 bg-input-base text-txt-primary focus:ring-red-500' 
                            : 'border-input-border bg-input-base text-txt-primary focus:border-txt-primary focus:ring-txt-primary'
                        }`}
                      />
                      <button
                        type="button"
                        onClick={() => toggleCalendar('editEnd')}
                        className="edit-end-toggle absolute right-1.5 text-txt-muted hover:text-txt-primary p-0.5 rounded hover:bg-tbl-hover transition-colors"
                        title="Select date"
                      >
                        <Calendar className="h-3.5 w-3.5" />
                      </button>
                    </div>

                    {/* Custom Calendar Popup */}
                    {openCalendar === 'editEnd' && (
                      <div 
                        ref={editEndCalendarRef}
                        className="absolute right-0 top-full mt-1 z-[9999] bg-modal-base border border-border-base rounded-lg shadow-lg-base p-3 w-64 text-sm text-txt-primary select-none animate-fadeIn"
                      >
                        <div className="flex items-center justify-between mb-2">
                          <button 
                            type="button"
                            onClick={() => {
                              setCalendarViewDate(new Date(calendarViewDate.getFullYear(), calendarViewDate.getMonth() - 1, 1))
                            }}
                            className="p-1 text-txt-muted hover:text-txt-primary hover:bg-tbl-hover rounded transition-colors"
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
                            className="p-1 text-txt-muted hover:text-txt-primary hover:bg-tbl-hover rounded transition-colors"
                          >
                            <ChevronRight className="h-4 w-4" />
                          </button>
                        </div>

                        <div className="grid grid-cols-7 gap-1 text-center text-xs font-bold text-txt-muted mb-1">
                          <span>Su</span><span>Mo</span><span>Tu</span><span>We</span><span>Th</span><span>Fr</span><span>Sa</span>
                        </div>

                        <div className="grid grid-cols-7 gap-1 text-center text-xs">
                          {renderDaysGrid('editEnd')}
                        </div>
                      </div>
                    )}
                  </div>
                  {editEndDateError && (
                    <p className="text-[10px] font-semibold text-red-500 mt-1">{editEndDateError}</p>
                  )}
                </div>
              </div>

              {/* Location */}
              <div className="space-y-1">
                <label className="text-[10px] font-extrabold uppercase tracking-widest text-txt-muted">Location</label>
                <input
                  type="text"
                  value={editLocation}
                  onChange={e => setEditLocation(e.target.value)}
                  className="w-full border border-input-border bg-input-base text-txt-primary rounded-lg px-3 py-2 text-sm focus:outline-hidden focus:ring-1 focus:ring-txt-primary"
                />
              </div>

              {/* Package Details */}
              <div className="space-y-1">
                <label className="text-[10px] font-extrabold uppercase tracking-widest text-txt-muted">Package Name</label>
                <input
                  type="text"
                  value={editPackage}
                  onChange={e => setEditPackage(e.target.value)}
                  className="w-full border border-input-border bg-input-base text-txt-primary rounded-lg px-3 py-2 text-sm focus:outline-hidden focus:ring-1 focus:ring-txt-primary"
                />
              </div>

              {/* Pricing & Payment details */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-[10px] font-extrabold uppercase tracking-widest text-txt-muted font-bold">Agreed Price (₹)</label>
                  <input
                    type="number"
                    value={editAgreedPrice}
                    onChange={e => {
                      setEditAgreedPrice(e.target.value);
                      if (editAgreedPriceError) setEditAgreedPriceError('');
                    }}
                    className={`w-full border rounded-lg px-3 py-1.5 text-xs focus:outline-hidden ${
                      editAgreedPriceError 
                        ? 'border-red-500 bg-input-base text-txt-primary focus:ring-red-500' 
                        : 'border-input-border bg-input-base text-txt-primary focus:border-txt-primary focus:ring-txt-primary'
                    }`}
                  />
                  {editAgreedPriceError && (
                    <p className="text-[10px] font-semibold text-red-500 mt-1">{editAgreedPriceError}</p>
                  )}
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-extrabold uppercase tracking-widest text-txt-muted font-bold">Advance Paid (₹)</label>
                  <input
                    type="number"
                    value={editAdvancePaid}
                    onChange={e => setEditAdvancePaid(e.target.value)}
                    className="w-full border border-input-border bg-input-base text-txt-primary rounded-lg px-3 py-1.5 text-xs focus:outline-hidden focus:border-txt-primary focus:ring-txt-primary"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-extrabold uppercase tracking-widest text-txt-muted font-bold">Balance Due (₹)</label>
                  <input
                    type="text"
                    value={'₹' + computedEditBalance.toLocaleString('en-IN')}
                    readOnly
                    className="w-full border border-border-base bg-sidebar-active text-txt-secondary font-bold rounded-lg px-3 py-1.5 text-xs focus:outline-hidden"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-extrabold uppercase tracking-widest text-txt-muted font-bold">Advance Percentage</label>
                  <input
                    type="text"
                    value={
                      Number(editAgreedPrice || 0) > 0
                        ? `${((Number(editAdvancePaid || 0) / Number(editAgreedPrice)) * 100).toFixed(1)}% advance received`
                        : '0.0% advance received'
                    }
                    readOnly
                    className="w-full border border-border-base bg-sidebar-active text-txt-secondary font-bold rounded-lg px-3 py-1.5 text-xs focus:outline-hidden"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-extrabold uppercase tracking-widest text-txt-muted font-bold">Payment Method</label>
                  <select
                    value={editPaymentMethod}
                    onChange={e => setEditPaymentMethod(e.target.value)}
                    className="w-full border border-input-border bg-input-base text-txt-secondary rounded-lg px-2.5 py-1.5 text-xs focus:outline-hidden focus:ring-1 focus:ring-txt-primary cursor-pointer"
                  >
                    <option value="UPI">UPI (GPay/PhonePe)</option>
                    <option value="Bank Transfer">Bank Transfer</option>
                    <option value="Cash">Cash</option>
                    <option value="Cheque">Cheque</option>
                    <option value="Other">Other</option>
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-extrabold uppercase tracking-widest text-txt-muted font-bold">Payment Terms</label>
                  <select
                    value={editPaymentTerms}
                    onChange={e => setEditPaymentTerms(e.target.value)}
                    className="w-full border border-input-border bg-input-base text-txt-secondary rounded-lg px-2.5 py-1.5 text-xs focus:outline-hidden focus:ring-1 focus:ring-txt-primary cursor-pointer"
                  >
                    <option value="Custom — see amounts below">Custom — see amounts below</option>
                    <option value="100% Advance">100% Advance</option>
                    <option value="Pay on Delivery">Pay on Delivery</option>
                  </select>
                </div>
              </div>

              {/* Client Email and Phone */}
              <div className="grid grid-cols-1 gap-3 border-t border-border-base pt-4">
                <div className="space-y-1">
                  <label className="text-[10px] font-extrabold uppercase tracking-widest text-txt-muted">Client Email</label>
                  <input
                    type="email"
                    value={editEmail}
                    onChange={e => {
                      setEditEmail(e.target.value);
                      if (editEmailError) setEditEmailError('');
                    }}
                    onBlur={() => {
                      if (editEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(editEmail)) {
                        setEditEmailError("Please enter a valid email address (e.g. client@example.com).");
                      }
                    }}
                    className={`w-full border rounded-lg px-3 py-2 text-sm focus:outline-hidden focus:ring-1 ${
                      editEmailError 
                        ? 'border-red-500 bg-input-base text-txt-primary focus:ring-red-500' 
                        : 'border-input-border bg-input-base text-txt-primary focus:border-txt-primary focus:ring-txt-primary'
                    }`}
                  />
                  {editEmailError && (
                    <p className="text-[11px] font-semibold text-red-500 mt-1">{editEmailError}</p>
                  )}
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-extrabold uppercase tracking-widest text-txt-muted">Client Phone</label>
                  <input
                    type="text"
                    value={editPhone}
                    onChange={e => setEditPhone(e.target.value)}
                    className="w-full border border-input-border bg-input-base text-txt-primary rounded-lg px-3 py-2 text-sm focus:outline-hidden focus:border-txt-primary focus:ring-txt-primary"
                  />
                </div>
              </div>

              {/* Team Assignments */}
              <div className="space-y-3 border-t border-border-base pt-4">
                <h4 className="text-[11px] font-extrabold text-txt-muted uppercase tracking-widest">Team Assignment</h4>
                
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-txt-secondary">Lead Photographer</label>
                  <input
                    type="text"
                    value={editLeadPhotographer}
                    onChange={e => setEditLeadPhotographer(e.target.value)}
                    className="w-full border border-input-border bg-input-base text-txt-primary rounded-lg px-3 py-2 text-xs focus:outline-hidden focus:border-txt-primary focus:ring-txt-primary"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-txt-secondary">Second Shooter</label>
                  <input
                    type="text"
                    value={editSecondShooter}
                    onChange={e => setEditSecondShooter(e.target.value)}
                    className="w-full border border-input-border bg-input-base text-txt-primary rounded-lg px-3 py-2 text-xs focus:outline-hidden focus:border-txt-primary focus:ring-txt-primary"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-txt-secondary">Videographer</label>
                  <input
                    type="text"
                    value={editVideographer}
                    onChange={e => setEditVideographer(e.target.value)}
                    className="w-full border border-input-border bg-input-base text-txt-primary rounded-lg px-3 py-2 text-xs focus:outline-hidden focus:border-txt-primary focus:ring-txt-primary"
                  />
                </div>
              </div>

              {/* Notes */}
              <div className="space-y-1 border-t border-border-base pt-4">
                <label className="text-[10px] font-extrabold uppercase tracking-widest text-txt-muted">Admin Notes / Requirements</label>
                <textarea
                  rows={3}
                  value={editAdminNotes}
                  onChange={e => setEditAdminNotes(e.target.value)}
                  className="w-full border border-input-border bg-input-base text-txt-primary rounded-lg px-3 py-2 text-xs focus:outline-hidden focus:border-txt-primary focus:ring-txt-primary"
                />
              </div>

            </div>

            {/* Sticky bottom save/delete actions */}
            <div className="absolute bottom-0 inset-x-0 p-4 border-t border-border-base bg-modal-base flex items-center justify-between gap-2 shadow-lg">
              <button
                type="button"
                onClick={() => handleDeleteBooking(editingBooking)}
                className="px-4 py-2 border border-red-500/30 hover:bg-red-500/10 text-red-600 font-semibold text-xs rounded-lg transition-colors cursor-pointer bg-modal-base"
              >
                Delete
              </button>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setIsEditPanelOpen(false)}
                  className="px-4 py-2 border border-border-base hover:bg-sidebar-active text-txt-secondary font-semibold text-xs rounded-lg transition-colors cursor-pointer bg-modal-base"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={editPanelSaving}
                  onClick={handleSaveEdit}
                  className="bg-txt-primary text-bg-base hover:opacity-95 text-xs font-bold uppercase tracking-wider px-5 py-2.5 rounded-lg shadow-base transition-colors cursor-pointer border border-txt-primary"
                >
                  {editPanelSaving ? 'Saving...' : 'Save changes'}
                </button>
              </div>
            </div>

          </div>
        </div>
      )}
      </div>

      {/* RECEIPT MODAL / PRINT VIEW OVERLAY */}
      {showReceipt && receiptBooking && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 print:static print:bg-white print:p-0 overflow-y-auto">
          <div className="bg-modal-base rounded-lg max-w-2xl w-full border border-border-base shadow-lg-base overflow-hidden print:border-none print:shadow-none print:p-0 print:m-0 flex flex-col my-8">
            
            {/* Modal Control (Screen view only) */}
            <div className="flex items-center justify-between bg-sidebar-active border-b border-border-base px-6 py-4 print:hidden">
              <span className="text-sm font-bold text-txt-primary flex items-center gap-1.5">
                <FileText className="h-4 w-4 text-txt-secondary" /> Invoice Receipt
              </span>
              <button
                onClick={() => setShowReceipt(false)}
                className="text-txt-muted hover:text-txt-primary p-1 rounded hover:bg-tbl-hover transition-colors cursor-pointer"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Printable Area */}
            <div className="p-8 space-y-6 flex-1 bg-modal-base print:bg-white text-txt-primary print:text-black print:p-0 print:m-0">
              {/* Receipt Header */}
              <div className="flex justify-between items-start">
                <div>
                  <h2 className="text-2xl font-black tracking-tight text-txt-primary print:text-black">RM FILMS</h2>
                  <p className="text-xs text-txt-muted print:text-gray-400 mt-1">
                    Wedding & Cinematic Photography<br />
                    hello@rounakmannafilms.com
                  </p>
                </div>
                <div className="text-right">
                  <h3 className="text-xl font-bold text-txt-primary print:text-black uppercase">Receipt</h3>
                  <p className="text-xs text-txt-secondary print:text-gray-500 mt-0.5">
                    No: <span className="font-semibold text-txt-primary print:text-black">{receiptBooking.receipt_number}</span>
                  </p>
                  <p className="text-xs text-txt-secondary print:text-gray-500 mt-0.5">
                    Date: <span className="font-medium text-txt-primary print:text-black">{
                      new Date(receiptBooking.created_at || new Date()).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
                    }</span>
                  </p>
                </div>
              </div>

              <hr className="border-border-base print:border-gray-200" />

              {/* Client & Shoot grids */}
              <div className="grid grid-cols-2 gap-6 text-sm">
                <div>
                  <h4 className="text-xs font-bold uppercase tracking-wider text-txt-muted print:text-gray-400 mb-2">Billed To</h4>
                  <p className="font-bold text-txt-primary print:text-black">{receiptBooking.client_name}</p>
                  <p className="text-txt-secondary print:text-gray-500 text-xs mt-1">{receiptBooking.email || '—'}</p>
                  <p className="text-txt-secondary print:text-gray-500 text-xs mt-0.5">{receiptBooking.phone || '—'}</p>
                </div>
                <div>
                  <h4 className="text-xs font-bold uppercase tracking-wider text-txt-muted print:text-gray-400 mb-2">Shoot Details</h4>
                  <p className="font-semibold text-txt-primary print:text-black">Package: {receiptBooking.package}</p>
                  <p className="text-txt-secondary print:text-gray-500 text-xs mt-1 font-medium">
                    Dates: {formatDateRangeText(receiptBooking.event_date_start, receiptBooking.event_date_end)}
                  </p>
                  <p className="text-txt-secondary print:text-gray-500 text-xs mt-0.5">
                    Location: {receiptBooking.location || '—'}
                  </p>
                </div>
              </div>

              {/* Items summary table */}
              <div className="border border-border-base print:border-gray-200 rounded-md overflow-hidden mt-6">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="bg-sidebar-active print:bg-gray-50 border-b border-border-base print:border-gray-200 font-bold text-txt-secondary print:text-gray-600 uppercase tracking-wider">
                      <th className="px-4 py-3">Description</th>
                      <th className="px-4 py-3 text-right">Amount</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border-base print:divide-gray-100 font-medium text-txt-secondary print:text-gray-800">
                    <tr>
                      <td className="px-4 py-3">
                        <span className="font-bold text-txt-primary print:text-black block">{receiptBooking.event_type.replace('_', ' ').replace(/\b\w/g, (c: string) => c.toUpperCase())} Shoot Services</span>
                        <span className="text-[10px] text-txt-muted print:text-gray-400 font-normal">
                          Wedding Photography & Cinematography covering {formatDateRangeText(receiptBooking.event_date_start, receiptBooking.event_date_end)} in {receiptBooking.location || 'General Venue'}.
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right font-semibold text-txt-primary print:text-black">
                        {formatPrice(receiptBooking.agreed_price)}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>

              {/* Summary calculations */}
              <div className="flex justify-between items-start mt-6 text-xs text-txt-secondary print:text-gray-500">
                <div className="space-y-1 bg-sidebar-active print:bg-gray-50 p-3 rounded-md border border-border-base print:border-gray-200 max-w-xs">
                  <h5 className="font-bold text-txt-primary print:text-gray-700 uppercase tracking-wider text-[10px] mb-1">Payment Details</h5>
                  <p>Terms: <span className="font-semibold text-txt-secondary print:text-gray-800">{receiptBooking.payment_terms}</span></p>
                  <p>Method: <span className="font-semibold text-txt-secondary print:text-gray-800">{receiptBooking.payment_method || 'Awaiting / None'}</span></p>
                  <p className="flex items-center gap-1.5">Status: <span className={`font-bold ${
                    receiptBooking.payment_status === 'paid' ? 'text-green-600' :
                    receiptBooking.payment_status === 'partial' ? 'text-orange-600 animate-pulse' :
                    'text-red-600'
                  }`}>
                    {receiptBooking.payment_status === 'paid' ? 'PAID IN FULL' :
                     receiptBooking.payment_status === 'partial' ? 'PARTIALLY PAID' :
                     'PAYMENT DUE'}
                  </span></p>
                </div>
                
                <div className="w-64 space-y-2 text-sm">
                  <div className="flex justify-between text-txt-secondary print:text-gray-500 text-xs font-semibold">
                    <span>Subtotal (Agreed Price)</span>
                    <span className="font-medium text-txt-primary print:text-black">{formatPrice(receiptBooking.agreed_price)}</span>
                  </div>
                  <div className="flex justify-between text-txt-secondary print:text-gray-500 text-xs font-semibold">
                    <span>Advance Received</span>
                    <span className="font-medium text-txt-primary print:text-black">{formatPrice(receiptBooking.advance_paid)} ({receiptAdvancePct.toFixed(1)}% of total)</span>
                  </div>
                  <hr className="border-border-base print:border-gray-200" />
                  <div className="flex justify-between font-bold text-base text-txt-primary print:text-black">
                    <span>Balance Due</span>
                    <span className={receiptBooking.balance_due > 0 ? "text-red-500 print:text-red-600" : "text-emerald-500 print:text-green-600"}>
                      {formatPrice(receiptBooking.balance_due)} ({receiptBalancePct.toFixed(1)}% remaining)
                    </span>
                  </div>
                </div>
              </div>

              {/* Thank you notes / T&C */}
              <div className="pt-6 border-t border-border-base print:border-gray-100 text-[10px] text-txt-muted print:text-gray-400 text-center leading-relaxed">
                <p className="font-semibold text-txt-secondary print:text-gray-500">Thank you for booking with RM Films!</p>
                <p className="mt-1">
                  This is a computer-generated transaction receipt representing the approved shoot contract portfolio.<br />
                  All terms of services follow the main contract agreements finalized during the client onboarding checks.
                </p>
              </div>
            </div>

            {/* Modal Action footer (Screen view only) */}
            <div className="bg-sidebar-active border-t border-border-base px-6 py-4 flex justify-end gap-3 print:hidden">
              <button
                onClick={() => setShowReceipt(false)}
                className="rounded-md border border-border-base bg-card-base px-4 py-2 text-xs font-bold uppercase tracking-wider text-txt-secondary hover:bg-sidebar-active hover:text-txt-primary transition-colors cursor-pointer"
              >
                Close
              </button>
              <button
                onClick={() => window.print()}
                className="inline-flex items-center gap-1.5 rounded-md bg-txt-primary px-4 py-2 text-xs font-bold uppercase tracking-wider text-bg-base hover:opacity-90 transition-all cursor-pointer"
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

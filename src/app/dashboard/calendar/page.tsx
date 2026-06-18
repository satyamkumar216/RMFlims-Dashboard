'use client'

import React, { useEffect, useState } from 'react'
import Link from 'next/link'
import { createClient } from '@/utils/supabase/client'
import { isDemoMode, getDemoEvents, saveDemoEvents, getDemoEnquiries, saveDemoEnquiries, getDemoBookings, saveDemoBookings } from '@/utils/supabase/demo'
import { 
  ChevronLeft, 
  ChevronRight, 
  Plus, 
  Trash2, 
  Edit2, 
  X, 
  Calendar as CalendarIcon, 
  User, 
  FileText,
  Check,
  Loader2
} from 'lucide-react'

interface CalendarEvent {
  id: string
  enquiry_id: string | null
  title: string
  event_date: string
  event_end_date?: string | null
  event_type: 'marriage' | 'brand_photoshoot' | 'portfolio_shoot' | 'model_shoot' | 'reel_shoot' | 'manual_shoot' | 'blocked'
  team_member: string | null
  notes: string | null
  created_at: string
  enquiries?: {
    id: string
    name: string
    package: string
    agreed_price: number | null
    notes?: string | null
    status: 'new' | 'in_progress' | 'confirmed' | 'cancelled'
    location?: string | null
  } | null
}

const TYPE_COLORS: Record<string, string> = {
  marriage: '#D32F2F',
  portfolio_shoot: '#E65100',
  brand_photoshoot: '#6A1B9A',
  model_shoot: '#1565C0',
  reel_shoot: '#AD1457',
  manual_shoot: '#00695C',
  blocked: '#616161'
}

const hexToRgb = (hex: string) => {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex)
  return result ? {
    r: parseInt(result[1], 16),
    g: parseInt(result[2], 16),
    b: parseInt(result[3], 16)
  } : null
}

interface EventMetadata {
  status: 'new' | 'in_progress' | 'confirmed' | 'cancelled'
  clientName: string
  packageName: string
  price: number | null
  location: string
  notesContent: string
}

const parseNotesAndMetadata = (notes: string | null): EventMetadata => {
  const defaultMeta: EventMetadata = {
    status: 'confirmed',
    clientName: '',
    packageName: '',
    price: null,
    location: '',
    notesContent: notes || ''
  }

  if (!notes) return defaultMeta

  const lines = notes.split('\n')
  let status = 'confirmed'
  let clientName = ''
  let packageName = ''
  let price: number | null = null
  let location = ''
  const remainingLines: string[] = []

  let parsingMetadata = true

  for (let line of lines) {
    const trimmed = line.trim()
    if (parsingMetadata) {
      if (trimmed.toLowerCase().startsWith('status:')) {
        const val = trimmed.substring(7).trim().toLowerCase()
        if (['new', 'in_progress', 'confirmed', 'cancelled'].includes(val)) {
          status = val
        }
        continue
      }
      if (trimmed.toLowerCase().startsWith('client:')) {
        clientName = trimmed.substring(7).trim()
        continue
      }
      if (trimmed.toLowerCase().startsWith('package:')) {
        packageName = trimmed.substring(8).trim()
        continue
      }
      if (trimmed.toLowerCase().startsWith('price:')) {
        const val = trimmed.substring(6).trim()
        price = val ? parseFloat(val.replace(/[^0-9.]/g, '')) || null : null
        continue
      }
      if (trimmed.toLowerCase().startsWith('location:')) {
        location = trimmed.substring(9).trim()
        continue
      }
      
      if (trimmed !== '') {
        parsingMetadata = false
        remainingLines.push(line)
      } else {
        remainingLines.push(line)
      }
    } else {
      remainingLines.push(line)
    }
  }

  let notesContent = remainingLines.join('\n').trim()

  return {
    status: status as any,
    clientName,
    packageName,
    price,
    location,
    notesContent
  }
}

const serializeNotesAndMetadata = (
  notesContent: string,
  meta: Partial<Omit<EventMetadata, 'notesContent'>>
) => {
  const parts = []
  if (meta.status) parts.push(`Status: ${meta.status}`)
  if (meta.clientName) parts.push(`Client: ${meta.clientName}`)
  if (meta.packageName) parts.push(`Package: ${meta.packageName}`)
  if (meta.price !== undefined && meta.price !== null) parts.push(`Price: ${meta.price}`)
  if (meta.location) parts.push(`Location: ${meta.location}`)
  
  const header = parts.join('\n')
  const body = notesContent.trim()
  
  if (header && body) {
    return `${header}\n\n${body}`
  }
  return header || body
}

export default function CalendarPage() {
  const supabase = createClient()
  const [events, setEvents] = useState<CalendarEvent[]>([])
  const [hoveredEventId, setHoveredEventId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  
  // Date states
  const [currentDate, setCurrentDate] = useState(new Date())
  const [selectedDateStr, setSelectedDateStr] = useState<string>(
    new Date().toISOString().split('T')[0]
  )

  // Jump lists
  const [jumpMonths, setJumpMonths] = useState<Date[]>([])

  // Modals & Forms states
  const [isAddModalOpen, setIsAddModalOpen] = useState(false)
  const [isEditPanelOpen, setIsEditPanelOpen] = useState(false)
  const [editingEvent, setEditingEvent] = useState<CalendarEvent | null>(null)

  // Form inputs for Add/Edit
  const [eventTitle, setEventTitle] = useState('')
  const [eventDateInput, setEventDateInput] = useState('')
  const [eventEndDateInput, setEventEndDateInput] = useState('')
  const [eventTypeInput, setEventTypeInput] = useState<CalendarEvent['event_type']>('manual_shoot')
  const [teamMember, setTeamMember] = useState('')
  const [eventNotes, setEventNotes] = useState('')
  const [formSaving, setFormSaving] = useState(false)

  // Extra slide-in panel states
  const [isEditingTitle, setIsEditingTitle] = useState(false)
  const [clientName, setClientName] = useState('')
  const [eventPackage, setEventPackage] = useState('')
  const [eventPrice, setEventPrice] = useState<number | ''>('')
  const [eventLocation, setEventLocation] = useState('')
  const [eventStatus, setEventStatus] = useState<'new' | 'in_progress' | 'confirmed' | 'cancelled'>('confirmed')
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'delete' | null }>({ message: '', type: null })
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)

  // Custom calendar picker states
  const [openCalendar, setOpenCalendar] = useState<'addStart' | 'addEnd' | 'editStart' | 'editEnd' | null>(null)
  const [calendarViewDate, setCalendarViewDate] = useState<Date>(new Date())

  // Date picker refs (for click outside detection)
  const addStartCalendarRef = React.useRef<HTMLDivElement>(null)
  const addEndCalendarRef = React.useRef<HTMLDivElement>(null)
  const editStartCalendarRef = React.useRef<HTMLDivElement>(null)
  const editEndCalendarRef = React.useRef<HTMLDivElement>(null)

  // Click outside listener for custom calendar popups
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      const target = event.target as HTMLElement
      if (openCalendar === 'addStart' && addStartCalendarRef.current && !addStartCalendarRef.current.contains(target)) {
        if (!target.closest('.add-start-date-toggle')) {
          setOpenCalendar(null)
        }
      }
      if (openCalendar === 'addEnd' && addEndCalendarRef.current && !addEndCalendarRef.current.contains(target)) {
        if (!target.closest('.add-end-date-toggle')) {
          setOpenCalendar(null)
        }
      }
      if (openCalendar === 'editStart' && editStartCalendarRef.current && !editStartCalendarRef.current.contains(target)) {
        if (!target.closest('.edit-start-date-toggle')) {
          setOpenCalendar(null)
        }
      }
      if (openCalendar === 'editEnd' && editEndCalendarRef.current && !editEndCalendarRef.current.contains(target)) {
        if (!target.closest('.edit-end-date-toggle')) {
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

  // Local YYYY-MM-DD today string
  const todayStr = (() => {
    const today = new Date()
    const y = today.getFullYear()
    const m = String(today.getMonth() + 1).padStart(2, '0')
    const d = String(today.getDate()).padStart(2, '0')
    return `${y}-${m}-${d}`
  })()

  const fetchEvents = async () => {
    setLoading(true)
    setErrorMsg(null)

    if (isDemoMode()) {
      const demoEvents = getDemoEvents()
      const demoEnquiries = getDemoEnquiries()
      const enriched = demoEvents.map(evt => {
        const enq = evt.enquiry_id ? demoEnquiries.find(e => e.id === evt.enquiry_id) : null
        if (enq) {
          return {
            ...evt,
            enquiries: {
              id: enq.id,
              name: enq.name,
              package: enq.package,
              agreed_price: enq.agreed_price,
              notes: enq.notes,
              location: enq.location || '',
              status: enq.status || 'confirmed'
            }
          }
        } else {
          // Parse metadata for manual shoots
          const meta = parseNotesAndMetadata(evt.notes)
          return {
            ...evt,
            enquiries: {
              id: 'mock-enq-' + evt.id,
              name: '',
              package: meta.packageName,
              agreed_price: meta.price,
              notes: meta.notesContent,
              status: meta.status,
              location: meta.location
            }
          }
        }
      })
      setEvents(enriched as any)
      setLoading(false)
      return
    }

    try {
      const { data, error } = await supabase
        .from('calendar_events')
        .select('*, enquiries(id, name, package, agreed_price, notes, location, status)')
        .order('event_date', { ascending: true })

      if (error) {
        setErrorMsg(error.message)
      } else {
        const enriched = (data || []).map(evt => {
          if (evt.enquiry_id) {
            return evt
          } else {
            const meta = parseNotesAndMetadata(evt.notes)
            return {
              ...evt,
              enquiries: {
                id: 'mock-enq-' + evt.id,
                name: '',
                package: meta.packageName,
                agreed_price: meta.price,
                notes: meta.notesContent,
                status: meta.status,
                location: meta.location
              }
            }
          }
        })
        setEvents(enriched as any)
      }
    } catch (err: any) {
      setErrorMsg('Failed to load calendar events.')
    } finally {
      setLoading(false)
    }
  }

  // Populate Jump Months list once
  useEffect(() => {
    const arr = []
    const start = new Date()
    // Go 3 months back to 12 months forward
    start.setMonth(start.getMonth() - 3)
    for (let i = 0; i < 16; i++) {
      arr.push(new Date(start.getFullYear(), start.getMonth() + i, 1))
    }
    setJumpMonths(arr)
    fetchEvents()
  }, [supabase])

  // Calendar logic helpers
  const year = currentDate.getFullYear()
  const month = currentDate.getMonth()

  const months = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ]

  const daysOfWeek = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

  const getDaysInMonth = (y: number, m: number) => new Date(y, m + 1, 0).getDate()
  const getFirstDayOfMonth = (y: number, m: number) => new Date(y, m, 1).getDay()

  const daysInCurrentMonth = getDaysInMonth(year, month)
  const firstDayIndex = getFirstDayOfMonth(year, month)

  const handlePrevMonth = () => {
    setCurrentDate(new Date(year, month - 1, 1))
  }

  const handleNextMonth = () => {
    setCurrentDate(new Date(year, month + 1, 1))
  }

  const handleToday = () => {
    const today = new Date()
    setCurrentDate(today)
    setSelectedDateStr(today.toISOString().split('T')[0])
  }

  // Generate next 4 months relative to TODAY for quick jump selector
  const todayDate = new Date()
  const quickMonths = []
  for (let i = 1; i <= 4; i++) {
    const d = new Date(todayDate.getFullYear(), todayDate.getMonth() + i, 1)
    quickMonths.push(d)
  }

  // Format YYYY-MM-DD
  const formatDateString = (y: number, m: number, d: number) => {
    const pad = (num: number) => String(num).padStart(2, '0')
    return `${y}-${pad(m + 1)}-${pad(d)}`
  }

  // Helper to calculate date strings range between event_date and event_end_date inclusive (DST & timezone immune)
  const getDatesInRange = (startStr: string, endStrStr?: string | null) => {
    if (!startStr) return []
    const endStr = endStrStr || startStr
    
    const [sY, sM, sD] = startStr.split('-').map(Number)
    const [eY, eM, eD] = endStr.split('-').map(Number)
    
    const startUTC = Date.UTC(sY, sM - 1, sD)
    const endUTC = Date.UTC(eY, eM - 1, eD)
    
    const dates = []
    let currUTC = startUTC
    
    while (currUTC <= endUTC) {
      const d = new Date(currUTC)
      const yStr = d.getUTCFullYear()
      const mStr = String(d.getUTCMonth() + 1).padStart(2, '0')
      const dStr = String(d.getUTCDate()).padStart(2, '0')
      dates.push(`${yStr}-${mStr}-${dStr}`)
      
      currUTC += 24 * 60 * 60 * 1000
    }
    return dates
  }

  const getEventStatus = (evt: CalendarEvent) => {
    if (evt.enquiry_id && evt.enquiries) {
      return evt.enquiries.status
    }
    return 'confirmed'
  }


  // Group events by date string (including multi-day spans)
  const eventsByDate = events.reduce((acc, event) => {
    const dates = getDatesInRange(event.event_date, event.event_end_date)
    dates.forEach(dateStr => {
      if (!acc[dateStr]) {
        acc[dateStr] = []
      }
      if (!acc[dateStr].some(e => e.id === event.id)) {
        acc[dateStr].push(event)
      }
    })
    return acc
  }, {} as Record<string, CalendarEvent[]>)

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
      if (type === 'addStart' || type === 'editStart') {
        dateVal = eventDateInput
      } else {
        dateVal = eventEndDateInput
      }
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

    const currentSelectedDate = (type === 'addStart' || type === 'editStart') ? eventDateInput : eventEndDateInput

    for (let day = 1; day <= totalDays; day++) {
      const cellDateStr = `${String(day).padStart(2, '0')}/${String(month + 1).padStart(2, '0')}/${year}`
      const cellDateObj = new Date(year, month, day)
      const isDisabled = cellDateObj < today
      const isSelected = currentSelectedDate === cellDateStr

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
              if (type === 'addStart' || type === 'editStart') {
                setEventDateInput(cellDateStr)
              } else {
                setEventEndDateInput(cellDateStr)
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

  // Format Date to DD/MM/YYYY
  const formatDateToDDMMYYYY = (dateStr: string | null | undefined) => {
    if (!dateStr) return ''
    if (dateStr.includes('-') && !dateStr.includes('T')) {
      const [y, m, d] = dateStr.split('-').map(Number)
      return `${String(d).padStart(2, '0')}/${String(m).padStart(2, '0')}/${y}`
    }
    const date = new Date(dateStr)
    const d = date.getDate()
    const m = date.getMonth() + 1
    const y = date.getFullYear()
    return `${String(d).padStart(2, '0')}/${String(m).padStart(2, '0')}/${y}`
  }

  // Chip/Dot styles with light backgrounds for sidebar badges
  const getChipStyle = (type: CalendarEvent['event_type']) => {
    switch (type) {
      case 'marriage':
        return 'bg-red-50 text-red-700 border-red-200'
      case 'brand_photoshoot':
        return 'bg-purple-50 text-purple-700 border-purple-200'
      case 'portfolio_shoot':
        return 'bg-orange-50 text-orange-700 border-orange-200'
      case 'model_shoot':
        return 'bg-indigo-50 text-indigo-750 border-indigo-200'
      case 'reel_shoot':
        return 'bg-pink-50 text-pink-700 border-pink-200'
      case 'manual_shoot':
        return 'bg-teal-50 text-teal-700 border-teal-200'
      case 'blocked':
        return 'bg-gray-100 text-gray-700 border-gray-200'
      default:
        return 'bg-gray-50 text-gray-700 border-gray-200'
    }
  }

  // Action: Add Event
  const openAddModal = (dateStr?: string) => {
    const targetDate = dateStr || selectedDateStr || new Date().toISOString().split('T')[0]
    setEventTitle('')
    setEventDateInput(dbDateToDisplayDate(targetDate))
    setEventEndDateInput(dbDateToDisplayDate(targetDate))
    setEventTypeInput('manual_shoot')
    setTeamMember('')
    setEventNotes('')
    setIsAddModalOpen(true)
  }

  const handleAddSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!eventTitle.trim()) return

    setFormSaving(true)
    setErrorMsg(null)

    if (isInvalidDate(eventDateInput)) {
      setErrorMsg('Please enter a valid Start Date in DD/MM/YYYY format.')
      setFormSaving(false)
      return
    }
    if (eventEndDateInput && isInvalidDate(eventEndDateInput)) {
      setErrorMsg('Please enter a valid End Date in DD/MM/YYYY format.')
      setFormSaving(false)
      return
    }

    const dbStart = displayDateToDbDate(eventDateInput)
    const dbEnd = displayDateToDbDate(eventEndDateInput || eventDateInput)

    if (dbEnd < dbStart) {
      setErrorMsg('End Date cannot be before Start Date.')
      setFormSaving(false)
      return
    }

    const today = new Date()
    const y = today.getFullYear()
    const m = String(today.getMonth() + 1).padStart(2, '0')
    const d = String(today.getDate()).padStart(2, '0')
    const todayStr = `${y}-${m}-${d}`

    if (dbStart < todayStr) {
      setErrorMsg('Event date cannot be in the past.')
      setFormSaving(false)
      return
    }

    if (isDemoMode()) {
      try {
        const demoEvents = getDemoEvents()
        const newEvent = {
          id: 'event-' + Date.now(),
          enquiry_id: null,
          title: eventTitle,
          event_date: dbStart,
          event_end_date: dbEnd,
          event_type: eventTypeInput,
          team_member: teamMember.trim() === '' ? null : teamMember,
          notes: eventNotes.trim() === '' ? null : eventNotes,
          created_at: new Date().toISOString()
        }
        saveDemoEvents([...demoEvents, newEvent])
        setIsAddModalOpen(false)
        fetchEvents()
      } catch (err: any) {
        setErrorMsg('Failed to add event in Demo Mode.')
      } finally {
        setFormSaving(false)
      }
      return
    }

    try {
      const { error } = await supabase
        .from('calendar_events')
        .insert({
          title: eventTitle,
          event_date: dbStart,
          event_end_date: dbEnd,
          event_type: eventTypeInput,
          team_member: teamMember.trim() === '' ? null : teamMember,
          notes: eventNotes.trim() === '' ? null : eventNotes
        })

      if (error) {
        throw new Error(error.message)
      }

      setIsAddModalOpen(false)
      fetchEvents()
    } catch (err: any) {
      setErrorMsg(err.message)
    } finally {
      setFormSaving(false)
    }
  }

  // Escape key and toast helpers
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setIsEditPanelOpen(false)
        setEditingEvent(null)
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [])

  const showToast = (message: string, type: 'success' | 'delete') => {
    setToast({ message, type })
    setTimeout(() => {
      setToast({ message: '', type: null })
    }, 2000)
  }

  // Action: Edit Event (slide-in panel)
  const openEditModal = (event: CalendarEvent) => {
    setEditingEvent(event)
    setEventTitle(event.title)
    setEventDateInput(dbDateToDisplayDate(event.event_date))
    setEventEndDateInput(dbDateToDisplayDate(event.event_end_date || event.event_date))
    setEventTypeInput(event.event_type)
    setTeamMember(event.team_member || '')
    setErrorMsg(null)

    if (event.enquiry_id && event.enquiries) {
      setClientName(event.enquiries.name || '')
      setEventPackage(event.enquiries.package || '')
      setEventPrice(event.enquiries.agreed_price !== null ? event.enquiries.agreed_price : '')
      setEventStatus(event.enquiries.status || 'confirmed')
      setEventLocation(event.enquiries.location || '')
      setEventNotes(event.notes || event.enquiries.notes || '')
    } else {
      // Manual shoot - parse notes metadata
      const meta = parseNotesAndMetadata(event.notes)
      setClientName('')
      setEventPackage(meta.packageName)
      setEventPrice(meta.price !== null ? meta.price : '')
      setEventStatus(meta.status)
      setEventLocation(meta.location)
      setEventNotes(meta.notesContent)
    }

    setIsEditingTitle(false)
    setIsEditPanelOpen(true)
    setShowDeleteConfirm(false)
  }

  const handleStatusChange = (newStatus: 'new' | 'in_progress' | 'confirmed' | 'cancelled') => {
    setEventStatus(newStatus)
    
    // Optimistic update of the status in calendar grid
    if (editingEvent) {
      setEvents(prevEvents => prevEvents.map(evt => {
        if (evt.id === editingEvent.id) {
          if (evt.enquiry_id) {
            return {
              ...evt,
              enquiries: {
                ...evt.enquiries,
                status: newStatus
              } as any
            }
          } else {
            const currentMeta = parseNotesAndMetadata(evt.notes)
            const updatedNotes = serializeNotesAndMetadata(currentMeta.notesContent, {
              status: newStatus,
              packageName: eventPackage,
              price: eventPrice === '' ? null : Number(eventPrice),
              location: eventLocation
            })
            return {
              ...evt,
              notes: updatedNotes
            }
          }
        }
        return evt
      }))
    }
  }

  const handleSave = async () => {
    if (!editingEvent) return

    if (isInvalidDate(eventDateInput)) {
      setErrorMsg('Please enter a valid Start Date in DD/MM/YYYY format.')
      return
    }
    if (eventEndDateInput && isInvalidDate(eventEndDateInput)) {
      setErrorMsg('Please enter a valid End Date in DD/MM/YYYY format.')
      return
    }

    const dbStart = displayDateToDbDate(eventDateInput)
    const dbEnd = displayDateToDbDate(eventEndDateInput || eventDateInput)

    if (dbEnd < dbStart) {
      setErrorMsg('End Date cannot be before Start Date.')
      return
    }

    let serializedNotes = eventNotes
    if (!editingEvent.enquiry_id) {
      serializedNotes = serializeNotesAndMetadata(eventNotes, {
        status: eventStatus,
        packageName: eventPackage,
        price: eventPrice === '' ? null : Number(eventPrice),
        location: eventLocation
      })
    }

    // 1. Optimistic Update in UI
    const updatedLocalEvent: CalendarEvent = {
      ...editingEvent,
      title: eventTitle,
      event_date: dbStart,
      event_end_date: dbEnd,
      event_type: eventTypeInput,
      team_member: teamMember.trim() === '' ? null : teamMember,
      notes: serializedNotes,
      enquiries: editingEvent.enquiry_id
        ? {
            id: editingEvent.enquiry_id,
            name: clientName,
            package: eventPackage,
            agreed_price: eventPrice === '' ? null : Number(eventPrice),
            notes: eventNotes,
            status: eventStatus,
            location: eventLocation
          }
        : {
            id: 'mock-enq-' + editingEvent.id,
            name: '',
            package: eventPackage,
            agreed_price: eventPrice === '' ? null : Number(eventPrice),
            notes: eventNotes,
            status: eventStatus,
            location: eventLocation
          }
    }

    setEvents(prev => prev.map(evt => evt.id === editingEvent.id ? updatedLocalEvent : evt))
    setIsEditPanelOpen(false)
    setEditingEvent(null)
    showToast('Event updated', 'success')

    // 2. Background database save
    if (isDemoMode()) {
      try {
        const demoEvents = getDemoEvents()
        const nextEvents = demoEvents.map(evt => {
          if (evt.id === editingEvent.id) {
            return {
              ...evt,
              title: eventTitle,
              event_date: dbStart,
              event_end_date: dbEnd,
              event_type: eventTypeInput,
              team_member: teamMember.trim() === '' ? null : teamMember,
              notes: serializedNotes
            }
          }
          return evt
        })
        saveDemoEvents(nextEvents)

        if (editingEvent.enquiry_id) {
          const demoEnquiries = getDemoEnquiries()
          const nextEnquiries = demoEnquiries.map(enq => {
            if (enq.id === editingEvent.enquiry_id) {
              return {
                ...enq,
                name: clientName,
                package: eventPackage,
                agreed_price: eventPrice === '' ? null : Number(eventPrice),
                location: eventLocation === '' ? null : eventLocation,
                status: eventStatus
              }
            }
            return enq
          })
          saveDemoEnquiries(nextEnquiries)
        }

        // Sync booking in demo mode
        const demoBookings = getDemoBookings()
        const bookingIdx = demoBookings.findIndex(b => b.calendar_event_id === editingEvent.id || (editingEvent.enquiry_id && b.enquiry_id === editingEvent.enquiry_id))
        if (bookingIdx !== -1) {
          const finalPrice = eventPrice === '' ? 0 : Number(eventPrice)
          const advancePaid = demoBookings[bookingIdx].advance_paid || 0
          const balanceDue = Math.max(0, finalPrice - advancePaid)
          
          let payStatus: 'due' | 'partial' | 'paid' = 'due'
          if (balanceDue === 0) payStatus = 'paid'
          else if (advancePaid > 0) payStatus = 'partial'

          let bStatus: 'confirmed' | 'in_progress' | 'tentative' | 'cancelled' = 'confirmed'
          if (eventStatus === 'cancelled') bStatus = 'cancelled'
          else if (eventStatus === 'in_progress') bStatus = 'in_progress'
          
          demoBookings[bookingIdx] = {
            ...demoBookings[bookingIdx],
            client_name: clientName,
            event_date_start: dbStart,
            event_date_end: dbEnd || dbStart,
            location: eventLocation,
            package: eventPackage,
            agreed_price: finalPrice,
            balance_due: balanceDue,
            payment_status: payStatus,
            booking_status: bStatus,
            admin_notes: eventNotes,
            lead_photographer: teamMember
          }
          saveDemoBookings(demoBookings)
        }
      } catch (err) {
        console.error('Demo save failed:', err)
      }
      return
    }

    try {
      const { error: eventError } = await supabase
        .from('calendar_events')
        .update({
          title: eventTitle,
          event_date: dbStart,
          event_end_date: dbEnd,
          event_type: eventTypeInput,
          team_member: teamMember.trim() === '' ? null : teamMember,
          notes: serializedNotes
        })
        .eq('id', editingEvent.id)

      if (eventError) {
        throw new Error(eventError.message)
      }

      if (editingEvent.enquiry_id) {
        const { error: enquiryError } = await supabase
          .from('enquiries')
          .update({
            name: clientName,
            package: eventPackage,
            agreed_price: eventPrice === '' ? null : Number(eventPrice),
            location: eventLocation === '' ? null : eventLocation,
            status: eventStatus
          })
          .eq('id', editingEvent.enquiry_id)

        if (enquiryError) {
          throw new Error(enquiryError.message)
        }
      }

      // Sync booking in database
      const finalPrice = eventPrice === '' ? 0 : Number(eventPrice)
      
      const { data: currentB } = await supabase
        .from('bookings')
        .select('advance_paid')
        .eq('calendar_event_id', editingEvent.id)
        .maybeSingle()

      const advancePaid = currentB?.advance_paid || 0
      const balanceDue = Math.max(0, finalPrice - advancePaid)

      let payStatus: 'due' | 'partial' | 'paid' = 'due'
      if (balanceDue === 0) payStatus = 'paid'
      else if (advancePaid > 0) payStatus = 'partial'

      let bStatus: 'confirmed' | 'in_progress' | 'tentative' | 'cancelled' = 'confirmed'
      if (eventStatus === 'cancelled') bStatus = 'cancelled'
      else if (eventStatus === 'in_progress') bStatus = 'in_progress'

      await supabase
        .from('bookings')
        .update({
          client_name: clientName,
          event_date_start: dbStart,
          event_date_end: dbEnd || dbStart,
          location: eventLocation,
          package: eventPackage,
          agreed_price: finalPrice,
          balance_due: balanceDue,
          payment_status: payStatus,
          booking_status: bStatus,
          admin_notes: eventNotes,
          lead_photographer: teamMember
        })
        .eq('calendar_event_id', editingEvent.id)
    } catch (err: any) {
      console.error('Background DB save failed:', err.message)
      fetchEvents()
    }
  }

  const handleDeleteEvent = (id: string) => {
    const evt = events.find(e => e.id === id)
    if (evt) {
      openEditModal(evt)
      setShowDeleteConfirm(true)
    }
  }

  const handleDeleteConfirm = async () => {
    if (!editingEvent) return

    const idToDelete = editingEvent.id
    
    setEvents(prev => prev.filter(evt => evt.id !== idToDelete))
    setIsEditPanelOpen(false)
    setEditingEvent(null)
    setShowDeleteConfirm(false)
    showToast('Event deleted', 'delete')

    if (isDemoMode()) {
      try {
        const demoEvents = getDemoEvents()
        const updated = demoEvents.filter(evt => evt.id !== idToDelete)
        saveDemoEvents(updated)

        const demoBookings = getDemoBookings()
        saveDemoBookings(demoBookings.filter(b => b.calendar_event_id !== idToDelete))
      } catch (err) {
        console.error(err)
      }
      return
    }

    try {
      const { error } = await supabase
        .from('calendar_events')
        .delete()
        .eq('id', idToDelete)

      if (error) {
        throw new Error(error.message)
      }

      await supabase
        .from('bookings')
        .delete()
        .eq('calendar_event_id', idToDelete)
    } catch (err: any) {
      console.error('Failed to delete event:', err.message)
      fetchEvents()
    }
  }

  // Mini Next Month Calendar Calculations
  const miniMonthDate = new Date(year, month + 1, 1)
  const miniYear = miniMonthDate.getFullYear()
  const miniMonth = miniMonthDate.getMonth()
  const miniDaysCount = getDaysInMonth(miniYear, miniMonth)
  const miniFirstDayIndex = getFirstDayOfMonth(miniYear, miniMonth)

  const handleMiniDayClick = (dateStr: string) => {
    const targetDate = new Date(dateStr + 'T00:00:00')
    setCurrentDate(new Date(targetDate.getFullYear(), targetDate.getMonth(), 1))
    setSelectedDateStr(dateStr)
  }

  const selectedDayEvents = eventsByDate[selectedDateStr] || []

  // Generate main calendar grid cells
  const calendarCells: { day: number | null; dateStr: string | null }[] = []
  // padding
  for (let i = 0; i < firstDayIndex; i++) {
    calendarCells.push({ day: null, dateStr: null })
  }
  // days
  for (let d = 1; d <= daysInCurrentMonth; d++) {
    calendarCells.push({
      day: d,
      dateStr: formatDateString(year, month, d)
    })
  }
  // Pad the end of calendarCells so it's a multiple of 7
  const totalCells = Math.ceil(calendarCells.length / 7) * 7
  while (calendarCells.length < totalCells) {
    calendarCells.push({ day: null, dateStr: null })
  }

  // Chunk calendarCells into weeks of 7 days
  const weeks: { day: number | null; dateStr: string | null }[][] = []
  for (let i = 0; i < calendarCells.length; i += 7) {
    weeks.push(calendarCells.slice(i, i + 7))
  }
  return (
    <div className="space-y-6 pb-12 bg-bg-base text-txt-primary">

      {errorMsg && (
        <div className="rounded-xl bg-red-500/10 p-4 border border-red-500/20 text-sm font-semibold text-red-600 dark:text-red-400">
          {errorMsg}
        </div>
      )}

      {/* Main Calendar View Section */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-8 items-start">
        
        {/* Calendar Grid - Left 3 cols */}
        <div className="lg:col-span-3 bg-card-base border border-border-base rounded-2xl shadow-base overflow-hidden">
          
          {/* Calendar Month Navigation & Quick Jump */}
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between border-b border-border-base px-6 py-5 bg-card-base">
            <div className="flex flex-wrap items-center gap-3">
              <h2 className="text-[28px] font-black text-txt-primary tracking-tight leading-none min-w-[150px]">
                {months[month]} {year}
              </h2>
              {/* Dropdown jump selector */}
              <select
                value={`${year}-${month}`}
                onChange={(e) => {
                  const [y, m] = e.target.value.split('-').map(Number)
                  setCurrentDate(new Date(y, m, 1))
                  setSelectedDateStr(formatDateString(y, m, 1))
                }}
                className="rounded-lg border border-input-border bg-input-base px-3 py-1.5 text-xs font-bold text-txt-secondary hover:border-txt-primary focus:border-txt-primary focus:outline-none focus:ring-1 focus:ring-txt-primary cursor-pointer transition-all"
              >
                {jumpMonths.map((d) => (
                  <option key={`${d.getFullYear()}-${d.getMonth()}`} value={`${d.getFullYear()}-${d.getMonth()}`}>
                    Jump to: {months[d.getMonth()].slice(0, 3)} {d.getFullYear()}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <button
                onClick={handleToday}
                className="rounded-lg border border-border-base bg-card-base px-4 py-2 text-sm font-bold text-txt-secondary hover:bg-sidebar-active hover:border-txt-primary transition-all shadow-base cursor-pointer"
              >
                Today
              </button>
              <button
                onClick={() => openAddModal()}
                className="inline-flex items-center gap-1.5 rounded-lg bg-txt-primary px-4 py-2 text-sm font-bold text-bg-base hover:opacity-90 shadow-base transition-all animate-none cursor-pointer"
              >
                <Plus className="h-4.5 w-4.5" />
                Add Event
              </button>
              
              <div className="hidden sm:block h-6 w-px bg-border-base mx-1" />
              
              <div className="flex items-center gap-2">
                <button
                  onClick={handlePrevMonth}
                  className="p-2 border border-border-base rounded-lg bg-card-base hover:bg-sidebar-active text-txt-secondary hover:text-txt-primary hover:border-txt-muted transition-colors shadow-base cursor-pointer"
                >
                  <ChevronLeft className="h-5 w-5" />
                </button>
                <button
                  onClick={handleNextMonth}
                  className="p-2 border border-border-base rounded-lg bg-card-base hover:bg-sidebar-active text-txt-secondary hover:text-txt-primary hover:border-txt-muted transition-colors shadow-base cursor-pointer"
                >
                  <ChevronRight className="h-5 w-5" />
                </button>
              </div>
            </div>
          </div>

          {/* Day of Week Headers Row */}
          <div className="grid grid-cols-7 border-b border-border-base bg-tbl-header text-center text-xs font-bold text-txt-secondary uppercase tracking-wider py-3.5">
            {daysOfWeek.map((day) => (
              <div key={day}>{day}</div>
            ))}
          </div>

          {/* Calendar Grid Cells — Week-row layout engine */}
          <div>
            {weeks.map((week, weekIdx) => {
              // 1. Collect events active in this week
              const activeEvents = events.filter(evt => {
                const evtDates = getDatesInRange(evt.event_date, evt.event_end_date)
                return week.some(day => day.dateStr && evtDates.includes(day.dateStr))
              })

              // 2. Sort: earliest start first, then longest span first, then stable ID
              activeEvents.sort((a, b) => {
                if (a.event_date !== b.event_date) return a.event_date.localeCompare(b.event_date)
                const aLen = getDatesInRange(a.event_date, a.event_end_date).length
                const bLen = getDatesInRange(b.event_date, b.event_end_date).length
                if (aLen !== bLen) return bLen - aLen
                return a.id.localeCompare(b.id)
              })

              // 3. Assign lanes and build segments
              interface Segment {
                event: CalendarEvent
                lane: number
                startCol: number
                endCol: number
                isEventStart: boolean
                isEventEnd: boolean
              }
              const lanes: (string | null)[][] = []
              const segments: Segment[] = []

              activeEvents.forEach(evt => {
                const evtDates = getDatesInRange(evt.event_date, evt.event_end_date)
                const weekDates = week.map(c => c.dateStr)
                let startCol = -1
                let endCol = -1
                for (let i = 0; i < 7; i++) {
                  if (weekDates[i] && evtDates.includes(weekDates[i] as string)) {
                    if (startCol === -1) startCol = i
                    endCol = i
                  }
                }
                if (startCol === -1) return

                // Find first free lane
                let lane = 0
                while (true) {
                  if (!lanes[lane]) lanes[lane] = Array(7).fill(null)
                  let free = true
                  for (let c = startCol; c <= endCol; c++) {
                    if (lanes[lane][c] !== null) { free = false; break }
                  }
                  if (free) break
                  lane++
                }

                // Occupy
                if (!lanes[lane]) lanes[lane] = Array(7).fill(null)
                for (let c = startCol; c <= endCol; c++) {
                  lanes[lane][c] = evt.id
                }

                segments.push({
                  event: evt,
                  lane,
                  startCol,
                  endCol,
                  isEventStart: weekDates[startCol] === evt.event_date,
                  isEventEnd: weekDates[endCol] === (evt.event_end_date || evt.event_date)
                })
              })

              const MAX_VISIBLE_LANES = 3
              const visibleSegments = segments.filter(s => s.lane < MAX_VISIBLE_LANES)
              const totalLanes = Math.min(lanes.length, MAX_VISIBLE_LANES)
              const eventAreaHeight = totalLanes * (26 + 4)
              const cellMinHeight = Math.max(110, 32 + eventAreaHeight + 8)

              // Compute per-day hidden counts
              const hiddenByDay: number[] = Array(7).fill(0)
              segments.forEach(seg => {
                if (seg.lane >= MAX_VISIBLE_LANES) {
                  for (let c = seg.startCol; c <= seg.endCol; c++) {
                    hiddenByDay[c]++
                  }
                }
              })

              return (
                <div key={weekIdx} className="relative" style={{ minHeight: `${cellMinHeight}px` }}>
                  {/* Date cells grid (background layer) */}
                  <div className="grid grid-cols-7 absolute inset-0">
                    {week.map((cell, dayIdx) => {
                      const isSelected = cell.dateStr === selectedDateStr
                      const isToday = cell.dateStr === todayStr
                      return (
                        <div
                          key={dayIdx}
                          onClick={() => cell.dateStr && setSelectedDateStr(cell.dateStr)}
                          className={`border-b border-r border-cell-border cursor-pointer transition-all ${
                            isSelected ? 'bg-sidebar-active/50' : 'bg-card-base hover:bg-tbl-hover'
                          } ${!cell.day ? 'bg-sidebar-active/10 cursor-default pointer-events-none opacity-40' : ''}`}
                          style={{ minHeight: `${cellMinHeight}px` }}
                        >
                          {/* Date number — top right */}
                          <div className="flex justify-end p-2">
                            {cell.day && (
                              <span
                                className={`text-[16px] font-semibold h-7 w-7 flex items-center justify-center rounded-full ${
                                  isToday
                                    ? 'bg-indigo-600 text-white shadow-base font-semibold'
                                    : isSelected
                                    ? 'text-txt-primary bg-sidebar-active font-bold'
                                    : 'text-txt-primary'
                                }`}
                              >
                                {cell.day}
                              </span>
                            )}
                          </div>

                          {/* +N more */}
                          {cell.day && hiddenByDay[dayIdx] > 0 && (
                            <div
                              onClick={(e) => {
                                e.stopPropagation()
                                cell.dateStr && setSelectedDateStr(cell.dateStr)
                              }}
                              className="absolute bottom-1.5 left-2 text-[11px] font-semibold text-txt-secondary cursor-pointer hover:text-txt-primary hover:underline z-30"
                            >
                              +{hiddenByDay[dayIdx]} more
                            </div>
                          )}
                        </div>
                      )
                    })}
                  </div>

                  {/* Event bars (overlay layer) */}
                  {visibleSegments.map((seg) => {
                    const status = getEventStatus(seg.event)
                    const baseColor = TYPE_COLORS[seg.event.event_type] || '#616161'
                    const isHovered = hoveredEventId === seg.event.id

                    let bg = baseColor
                    let textColor = '#FFFFFF'
                    let textDecoration = 'none'
                    let border = 'none'

                    if (status === 'cancelled') {
                      bg = '#BDBDBD'
                      textColor = '#FFFFFF'
                      textDecoration = 'line-through'
                    } else if (status === 'new') {
                      bg = '#FFFFFF'
                      textColor = baseColor
                      border = `2px solid ${baseColor}`
                    } else if (status === 'in_progress') {
                      const rgb = hexToRgb(baseColor)
                      bg = rgb ? `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0.50)` : baseColor
                      textColor = '#FFFFFF'
                    }
                    // confirmed = default full solid color

                    // Border radius
                    let borderRadius = '0px'
                    if (seg.isEventStart && seg.isEventEnd) borderRadius = '6px'
                    else if (seg.isEventStart) borderRadius = '6px 0 0 6px'
                    else if (seg.isEventEnd) borderRadius = '0 6px 6px 0'

                    // Margins for gap between consecutive events
                    const mLeft = seg.isEventStart ? 4 : 0
                    const mRight = seg.isEventEnd ? 4 : 0

                    const leftPct = (seg.startCol / 7) * 100
                    const widthPct = ((seg.endCol - seg.startCol + 1) / 7) * 100
                    const topPx = 32 + seg.lane * (26 + 4)

                    const barStyle: React.CSSProperties = {
                      position: 'absolute',
                      left: `calc(${leftPct}% + ${mLeft}px)`,
                      width: `calc(${widthPct}% - ${mLeft + mRight}px)`,
                      top: `${topPx}px`,
                      height: '26px',
                      borderRadius,
                      backgroundColor: bg,
                      color: textColor,
                      textDecoration,
                      border,
                      display: 'flex',
                      alignItems: 'center',
                      cursor: 'pointer',
                      zIndex: 20,
                      transition: 'filter 150ms, box-shadow 150ms',
                      overflow: 'hidden',
                      boxSizing: 'border-box'
                    }

                    if (isHovered) {
                      barStyle.filter = 'brightness(0.88)'
                      barStyle.boxShadow = '0 2px 8px rgba(0,0,0,0.22)'
                      barStyle.zIndex = 25
                    }

                    return (
                      <div
                        key={`${seg.event.id}-w${weekIdx}`}
                        onMouseEnter={() => setHoveredEventId(seg.event.id)}
                        onMouseLeave={() => setHoveredEventId(null)}
                        onClick={(e) => {
                          e.stopPropagation()
                          openEditModal(seg.event)
                        }}
                        style={barStyle}
                        title={`${seg.event.title} (${seg.event.event_date} → ${seg.event.event_end_date || seg.event.event_date})`}
                        className="select-none"
                      >
                        {seg.isEventStart ? (
                          <span className="text-[12px] font-semibold truncate pl-2 pr-2 whitespace-nowrap">
                            {seg.event.title}
                          </span>
                        ) : (
                          <span className="text-[12px] pl-1.5 opacity-50 font-medium">›</span>
                        )}
                      </div>
                    )
                  })}
                </div>
              )
            })}
          </div>
        </div>

        {/* Sidebar Controls - Right 1 col */}
        <div className="lg:col-span-1 flex flex-col gap-8">
          
          {/* Mini Next Month Calendar (Clean, smaller, borderless) */}
          <div className="bg-transparent p-1 space-y-3 hidden lg:block">
            <h3 className="font-bold text-txt-secondary text-[11px] uppercase tracking-wider flex items-center justify-between border-b border-border-base pb-2">
              <span>Next Month: {months[miniMonth]} {miniYear}</span>
            </h3>
            
            <div className="grid grid-cols-7 text-center text-[10px] font-bold text-txt-muted mb-1">
              {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((char, idx) => (
                <div key={idx} className="py-0.5">{char}</div>
              ))}
            </div>

            <div className="grid grid-cols-7 text-center gap-1">
              {/* padding */}
              {Array.from({ length: miniFirstDayIndex }).map((_, idx) => (
                <div key={`pad-${idx}`} className="h-5" />
              ))}

              {/* mini days */}
              {Array.from({ length: miniDaysCount }).map((_, idx) => {
                const dayNum = idx + 1
                const dateStr = formatDateString(miniYear, miniMonth, dayNum)
                const dayEvents = eventsByDate[dateStr] || []
                const hasEvents = dayEvents.length > 0
                
                const hasMarriage = dayEvents.some(e => e.event_type === 'marriage' || e.enquiry_id !== null)
                const hasBrand = dayEvents.some(e => e.event_type === 'brand_photoshoot')
                const hasPort = dayEvents.some(e => e.event_type === 'portfolio_shoot')
                const hasModel = dayEvents.some(e => e.event_type === 'model_shoot')
                const hasReel = dayEvents.some(e => e.event_type === 'reel_shoot')
                const hasManual = dayEvents.some(e => e.event_type === 'manual_shoot')
                const hasBlocked = dayEvents.some(e => e.event_type === 'blocked')

                return (
                  <button
                    key={`day-${dayNum}`}
                    onClick={() => handleMiniDayClick(dateStr)}
                    className={`h-5 w-full rounded text-[10px] font-semibold flex flex-col items-center justify-center relative hover:bg-sidebar-active transition-colors ${
                      dateStr === selectedDateStr ? 'bg-txt-primary text-bg-base hover:bg-txt-primary/95 font-bold' : 'text-txt-secondary'
                    }`}
                  >
                    <span>{dayNum}</span>
                    {hasEvents && dateStr !== selectedDateStr && (
                      <div className="flex gap-0.5 mt-0.5 flex-wrap justify-center max-w-[20px]">
                        {hasMarriage && <span className="h-0.75 w-0.75 rounded-full bg-[#E53935]" />}
                        {hasBrand && <span className="h-0.75 w-0.75 rounded-full bg-[#7B1FA2]" />}
                        {hasPort && <span className="h-0.75 w-0.75 rounded-full bg-[#F57C00]" />}
                        {hasModel && <span className="h-0.75 w-0.75 rounded-full bg-[#1565C0]" />}
                        {hasReel && <span className="h-0.75 w-0.75 rounded-full bg-[#C2185B]" />}
                        {hasManual && <span className="h-0.75 w-0.75 rounded-full bg-[#00796B]" />}
                        {hasBlocked && <span className="h-0.75 w-0.75 rounded-full bg-[#757575]" />}
                      </div>
                    )}
                  </button>
                )
              })}
            </div>

            {/* Colors Portfolio Legend */}
            <div className="grid grid-cols-2 gap-y-2 pt-3 text-[9px] font-bold text-txt-muted border-t border-border-base mt-2">
              <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-[#E53935] shrink-0" /> Marriage</span>
              <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-[#7B1FA2] shrink-0" /> Brand</span>
              <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-[#F57C00] shrink-0" /> Portfolio</span>
              <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-[#1565C0] shrink-0" /> Model</span>
              <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-[#C2185B] shrink-0" /> Reel</span>
              <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-[#00796B] shrink-0" /> Manual</span>
              <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-[#757575] shrink-0" /> Blocked</span>
            </div>
          </div>

          {/* Selected Date Agenda Panel (Prominent bottom-right star) */}
          <div className="bg-card-base border border-border-base rounded-2xl p-5 shadow-base flex flex-col min-h-[420px] transition-colors duration-300">
            <div className="flex items-center justify-between border-b border-border-base/65 pb-4 mb-4">
              <div className="flex flex-col gap-0.5">
                <span className="text-[10px] font-extrabold text-txt-muted uppercase tracking-widest">Agenda</span>
                <h3 className="font-extrabold text-txt-primary text-base flex items-center gap-1.5">
                  <CalendarIcon className="h-4.5 w-4.5 text-txt-secondary shrink-0" />
                  {formatDateToDDMMYYYY(selectedDateStr)}
                </h3>
              </div>
              <button
                onClick={() => openAddModal(selectedDateStr)}
                className="inline-flex items-center gap-1.5 rounded-lg bg-txt-primary px-3.5 py-2 text-xs font-bold text-bg-base hover:opacity-90 shadow-sm hover:shadow-md transition-all shrink-0 cursor-pointer"
              >
                <Plus className="h-3.5 w-3.5" />
                Add Event
              </button>
            </div>

            {loading ? (
              <div className="flex flex-col items-center justify-center py-12 flex-1">
                <Loader2 className="h-6 w-6 animate-spin text-txt-muted" />
                <p className="text-txt-muted text-xs mt-2 font-medium">Loading events...</p>
              </div>
            ) : selectedDayEvents.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 flex-1 border border-dashed border-border-base rounded-xl bg-sidebar-active/30">
                <CalendarIcon className="h-8 w-8 text-txt-muted mb-2.5" />
                <p className="text-xs text-txt-muted font-medium">No events scheduled</p>
                <button
                  onClick={() => openAddModal(selectedDateStr)}
                  className="mt-3 text-xs font-bold text-txt-primary hover:underline cursor-pointer"
                >
                  Schedule one now
                </button>
              </div>
            ) : (
              <div className="space-y-4 flex-1 overflow-y-auto pr-1">
                {selectedDayEvents.map((evt) => {
                  const status = getEventStatus(evt)
                  const price = evt.enquiries?.agreed_price
                  const packageName = evt.enquiries?.package
                  const clientNotes = evt.enquiries?.notes || evt.notes

                  const getStatusBadgeClass = (s: string) => {
                    switch (s) {
                      case 'confirmed':
                        return 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20'
                      case 'in_progress':
                        return 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20'
                      case 'new':
                        return 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20'
                      case 'cancelled':
                        return 'bg-red-500/10 text-red-650 dark:text-red-400 border-red-500/20 line-through'
                      default:
                        return 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20'
                    }
                  }

                  const heading = evt.enquiries?.name ? `Booking: ${evt.enquiries.name}` : evt.title

                  return (
                    <div
                      key={evt.id}
                      className="border border-border-base hover:border-border-base/80 rounded-xl p-4.5 space-y-3.5 relative bg-card-base shadow-xs hover:shadow-sm transition-all duration-200"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="space-y-1.5">
                          {/* Title large and bold */}
                          <h4 className="font-extrabold text-txt-primary text-base leading-snug">{heading}</h4>
                          {/* Badges row */}
                          <div className="flex flex-wrap gap-1.5 items-center">
                            <span className={`inline-flex items-center rounded-md px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider border ${getStatusBadgeClass(status)}`}>
                              {status.replace('_', ' ')}
                            </span>
                            <span className={`inline-flex items-center rounded-md px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider border ${getChipStyle(evt.event_type)}`}>
                              {evt.event_type.replace('_', ' ')}
                            </span>
                          </div>
                        </div>
                        
                        <div className="flex items-center gap-1 shrink-0">
                          <button
                            onClick={() => openEditModal(evt)}
                            className="p-1.5 text-txt-secondary hover:text-txt-primary rounded-lg hover:bg-sidebar-active transition-colors cursor-pointer"
                            title="Edit Event"
                          >
                            <Edit2 className="h-3.5 w-3.5" />
                          </button>
                          <button
                            onClick={() => handleDeleteEvent(evt.id)}
                            className="p-1.5 text-txt-secondary hover:text-red-500 rounded-lg hover:bg-red-500/10 transition-colors cursor-pointer"
                            title="Delete Event"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </div>

                      <div className="space-y-2.5 text-xs text-txt-secondary border-t border-border-base/50 pt-3">
                        {/* Date span */}
                        <div className="flex flex-col gap-0.5">
                          <span className="text-[10px] font-bold text-txt-muted uppercase tracking-wider">Date Span</span>
                          <span className="font-semibold text-txt-primary">
                            {formatDateToDDMMYYYY(evt.event_date)}
                            {evt.event_end_date && evt.event_end_date !== evt.event_date && (
                              <> to {formatDateToDDMMYYYY(evt.event_end_date)}</>
                            )}
                          </span>
                        </div>

                        {/* Package Name */}
                        {packageName && (
                          <div className="flex flex-col gap-0.5">
                            <span className="text-[10px] font-bold text-txt-muted uppercase tracking-wider">Package</span>
                            <span className="font-semibold text-txt-primary">{packageName}</span>
                          </div>
                        )}

                        {/* Price */}
                        {price !== undefined && price !== null && (
                          <div className="flex flex-col gap-0.5">
                            <span className="text-[10px] font-bold text-txt-muted uppercase tracking-wider">Agreed Price</span>
                            <span className="font-bold text-emerald-600 dark:text-emerald-400 text-sm">
                              ₹{price.toLocaleString('en-IN')}
                            </span>
                          </div>
                        )}

                        {/* Team member */}
                        {evt.team_member && (
                          <div className="flex flex-col gap-0.5">
                            <span className="text-[10px] font-bold text-txt-muted uppercase tracking-wider">Assignee</span>
                            <span className="font-medium text-txt-primary">{evt.team_member}</span>
                          </div>
                        )}

                        {/* Notes */}
                        {clientNotes && (
                          <div className="flex flex-col gap-0.5">
                            <span className="text-[10px] font-bold text-txt-muted uppercase tracking-wider">Notes</span>
                            <span className="text-txt-secondary bg-sidebar-active/30 p-2.5 rounded-lg border border-border-base/60 leading-relaxed break-words whitespace-pre-wrap">
                              {clientNotes}
                            </span>
                          </div>
                        )}

                        {/* View details link */}
                        {evt.enquiry_id && (
                          <div className="pt-1.5">
                            <Link
                              href={`/dashboard/enquiries/${evt.enquiry_id}`}
                              className="inline-flex items-center gap-1 text-[11px] font-bold text-txt-primary hover:opacity-85 hover:underline"
                            >
                              <span>View enquiry details</span>
                              <span>&rarr;</span>
                            </Link>
                          </div>
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

      {/* Add Event Modal */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/55 backdrop-blur-xs p-4 animate-fadeIn">
          <div className="w-full max-w-md bg-modal-base rounded-xl border border-border-base shadow-lg p-6 space-y-4 transition-colors duration-300">
            <div className="flex items-center justify-between border-b border-border-base/50 pb-3">
              <h3 className="font-bold text-txt-primary text-lg">Add Calendar Event</h3>
              <button
                onClick={() => setIsAddModalOpen(false)}
                className="text-txt-muted hover:text-txt-primary p-1 rounded transition-colors cursor-pointer"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleAddSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-txt-secondary uppercase tracking-wider mb-1">
                  Event Title
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Pre-wedding Shoot, Blocked for personal travel"
                  value={eventTitle}
                  onChange={(e) => setEventTitle(e.target.value)}
                  className="block w-full rounded-lg border border-input-border bg-input-base px-3 py-2 text-txt-primary placeholder-txt-muted focus:border-txt-primary focus:outline-hidden focus:ring-1 focus:ring-txt-primary sm:text-sm transition-all"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-txt-secondary uppercase tracking-wider mb-1">
                    Event Date (Start)
                  </label>
                  <div className="relative flex flex-col justify-start">
                    <div className="relative flex items-center">
                      <input
                        type="text"
                        required
                        placeholder="DD/MM/YYYY"
                        value={eventDateInput}
                        onChange={(e) => handleDateInputChange(e.target.value, setEventDateInput)}
                        onFocus={() => {
                          const parsed = parseDisplayDate(eventDateInput)
                          setCalendarViewDate(parsed || new Date())
                          setOpenCalendar('addStart')
                        }}
                        className="block w-full rounded-lg border border-input-border bg-input-base pl-3 pr-10 py-2 text-txt-primary placeholder-txt-muted focus:border-txt-primary focus:outline-hidden focus:ring-1 focus:ring-txt-primary sm:text-sm transition-all font-medium"
                      />
                      <button
                        type="button"
                        onClick={() => toggleCalendar('addStart')}
                        className="add-start-date-toggle absolute right-2 text-txt-muted hover:text-txt-primary p-1 rounded hover:bg-sidebar-active transition-colors cursor-pointer"
                        title="Select date"
                      >
                        <CalendarIcon className="h-4 w-4" />
                      </button>
                    </div>

                    {/* Custom Calendar Popup */}
                    {openCalendar === 'addStart' && (
                      <div 
                        ref={addStartCalendarRef}
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
                          {renderDaysGrid('addStart')}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-bold text-txt-secondary uppercase tracking-wider mb-1">
                    Event Date (End)
                  </label>
                  <div className="relative flex flex-col justify-start">
                    <div className="relative flex items-center">
                      <input
                        type="text"
                        required
                        placeholder="DD/MM/YYYY"
                        value={eventEndDateInput}
                        onChange={(e) => handleDateInputChange(e.target.value, setEventEndDateInput)}
                        onFocus={() => {
                          const parsed = parseDisplayDate(eventEndDateInput)
                          setCalendarViewDate(parsed || new Date())
                          setOpenCalendar('addEnd')
                        }}
                        className="block w-full rounded-lg border border-input-border bg-input-base pl-3 pr-10 py-2 text-txt-primary placeholder-txt-muted focus:border-txt-primary focus:outline-hidden focus:ring-1 focus:ring-txt-primary sm:text-sm transition-all font-medium"
                      />
                      <button
                        type="button"
                        onClick={() => toggleCalendar('addEnd')}
                        className="add-end-date-toggle absolute right-2 text-txt-muted hover:text-txt-primary p-1 rounded hover:bg-sidebar-active transition-colors cursor-pointer"
                        title="Select date"
                      >
                        <CalendarIcon className="h-4 w-4" />
                      </button>
                    </div>

                    {/* Custom Calendar Popup */}
                    {openCalendar === 'addEnd' && (
                      <div 
                        ref={addEndCalendarRef}
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
                          {renderDaysGrid('addEnd')}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 gap-4">
                <div>
                  <label className="block text-xs font-bold text-txt-secondary uppercase tracking-wider mb-1">
                    Event Type / Color Portfolio
                  </label>
                  <select
                    value={eventTypeInput}
                    onChange={(e) => setEventTypeInput(e.target.value as any)}
                    className="block w-full rounded-lg border border-input-border bg-input-base px-3 py-2 text-txt-primary focus:border-txt-primary focus:outline-hidden focus:ring-1 focus:ring-txt-primary sm:text-sm transition-all font-semibold cursor-pointer"
                  >
                    <option value="marriage">Marriage (Red)</option>
                    <option value="brand_photoshoot">Brand Photoshoot (Purple)</option>
                    <option value="portfolio_shoot">Portfolio Shoot (Orange)</option>
                    <option value="model_shoot">Model Shoot (Cyan)</option>
                    <option value="reel_shoot">Reel Shoot (Rose)</option>
                    <option value="manual_shoot">Manual Shoot (Teal)</option>
                    <option value="blocked">Blocked Date (Gray)</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-txt-secondary uppercase tracking-wider mb-1">
                  Team Member (Optional)
                </label>
                <input
                  type="text"
                  placeholder="e.g. John Doe (Photographer)"
                  value={teamMember}
                  onChange={(e) => setTeamMember(e.target.value)}
                  className="block w-full rounded-lg border border-input-border bg-input-base px-3 py-2 text-txt-primary placeholder-txt-muted focus:border-txt-primary focus:outline-hidden focus:ring-1 focus:ring-txt-primary sm:text-sm transition-all"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-txt-secondary uppercase tracking-wider mb-1">
                  Notes (Optional)
                </label>
                <textarea
                  rows={3}
                  placeholder="Location details, package constraints, client specific queries..."
                  value={eventNotes}
                  onChange={(e) => setEventNotes(e.target.value)}
                  className="block w-full rounded-lg border border-input-border bg-input-base px-3 py-2 text-txt-primary placeholder-txt-muted focus:border-txt-primary focus:outline-hidden focus:ring-1 focus:ring-txt-primary sm:text-sm transition-all leading-relaxed"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-border-base/50">
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  className="rounded-lg border border-border-base px-4 py-2 text-sm font-semibold text-txt-secondary hover:bg-sidebar-active transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={formSaving}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-txt-primary px-4 py-2 text-sm font-semibold text-bg-base hover:opacity-90 transition-opacity cursor-pointer"
                >
                  {formSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                  Save Event
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Slide-in Edit Panel */}
      {isEditPanelOpen && editingEvent && (
        <>
          <style>{`
            @keyframes slideIn {
              from { transform: translateX(100%); }
              to { transform: translateX(0); }
            }
            .animate-slide-in {
              animation: slideIn 0.25s cubic-bezier(0.16, 1, 0.3, 1) forwards;
            }
          `}</style>
          
          {/* Backdrop (Clicking outside closes panel) */}
          <div 
            className="fixed inset-0 z-40 bg-black/35 backdrop-blur-xs transition-opacity" 
            onClick={() => {
              setIsEditPanelOpen(false)
              setEditingEvent(null)
            }}
          />

          {/* Edit Panel (overlay on top of calendar, no push, right side) */}
          <div className="fixed inset-y-0 right-0 z-50 w-full sm:w-[420px] bg-modal-base shadow-2xl flex flex-col border-l border-border-base animate-slide-in transition-colors duration-300">
            {/* Header: Title, badges, and close button */}
            <div className="p-6 border-b border-border-base/55 shrink-0">
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  {isEditingTitle ? (
                    <input
                      type="text"
                      value={eventTitle}
                      onChange={(e) => setEventTitle(e.target.value)}
                      onBlur={() => setIsEditingTitle(false)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          setIsEditingTitle(false)
                        }
                      }}
                      className="w-full text-2xl font-extrabold text-txt-primary border-b border-dashed border-border-base/60 focus:border-txt-primary focus:outline-none bg-transparent py-0.5"
                      autoFocus
                    />
                  ) : (
                    <h2
                      onClick={() => setIsEditingTitle(true)}
                      className="text-2xl font-extrabold text-txt-primary cursor-pointer hover:bg-sidebar-active rounded px-1.5 -mx-1.5 py-0.5 transition-colors break-words leading-tight"
                      title="Click to edit title"
                    >
                      {eventTitle || 'Untitled Event'}
                    </h2>
                  )}
                  
                  {/* Badges row */}
                  <div className="flex flex-wrap items-center gap-2.5 mt-2.5">
                    <span className={`inline-flex items-center rounded-md px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider border ${getChipStyle(eventTypeInput)}`}>
                      {eventTypeInput.replace('_', ' ')}
                    </span>
                    {editingEvent.enquiry_id && (
                      <Link
                        href={`/dashboard/enquiries/${editingEvent.enquiry_id}`}
                        className="text-xs font-bold text-txt-secondary hover:text-txt-primary hover:underline inline-flex items-center gap-0.5 transition-colors"
                      >
                        View enquiry &rarr;
                      </Link>
                    )}
                  </div>
                </div>

                <button
                  onClick={() => {
                    setIsEditPanelOpen(false)
                    setEditingEvent(null)
                  }}
                  className="text-txt-muted hover:text-txt-primary hover:bg-sidebar-active p-1.5 rounded-lg border border-transparent hover:border-border-base transition-colors shrink-0 cursor-pointer"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
            </div>

            {/* Scrollable form body */}
            <div className="flex-1 overflow-y-auto p-6 space-y-6">
              {errorMsg && (
                <div className="p-3.5 bg-red-500/10 border border-red-500/20 text-red-500 text-xs font-semibold rounded-lg flex items-start gap-2 animate-pulse">
                  <span className="h-1.5 w-1.5 rounded-full bg-red-600 mt-1.5 shrink-0" />
                  <span>{errorMsg}</span>
                </div>
              )}

              {/* Status Dropdown */}
              <div>
                <label className="block text-xs font-bold text-txt-muted uppercase tracking-wider mb-1.5">
                  Status
                </label>
                <select
                  value={eventStatus}
                  onChange={(e) => handleStatusChange(e.target.value as any)}
                  className="block w-full rounded-lg border border-input-border bg-input-base px-3 py-2.5 text-txt-primary focus:border-txt-primary focus:outline-hidden focus:ring-1 focus:ring-txt-primary sm:text-sm font-semibold transition-shadow cursor-pointer"
                >
                  <option value="new">New</option>
                  <option value="in_progress">In Progress</option>
                  <option value="confirmed">Confirmed</option>
                  <option value="cancelled">Cancelled</option>
                </select>
              </div>

              {/* Start and End Dates */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-txt-secondary uppercase tracking-wider mb-1.5">
                    Start Date
                  </label>
                  <div className="relative flex flex-col justify-start">
                    <div className="relative flex items-center">
                      <input
                        type="text"
                        required
                        placeholder="DD/MM/YYYY"
                        value={eventDateInput}
                        onChange={(e) => handleDateInputChange(e.target.value, setEventDateInput)}
                        onFocus={() => {
                          const parsed = parseDisplayDate(eventDateInput)
                          setCalendarViewDate(parsed || new Date())
                          setOpenCalendar('editStart')
                        }}
                        className="block w-full rounded-lg border border-input-border bg-input-base pl-3 pr-10 py-2.5 text-txt-primary placeholder-txt-muted focus:border-txt-primary focus:outline-hidden focus:ring-1 focus:ring-txt-primary sm:text-sm font-medium transition-all"
                      />
                      <button
                        type="button"
                        onClick={() => toggleCalendar('editStart')}
                        className="edit-start-date-toggle absolute right-2.5 text-txt-muted hover:text-txt-primary p-1 rounded hover:bg-sidebar-active transition-colors cursor-pointer"
                        title="Select date"
                      >
                        <CalendarIcon className="h-4 w-4" />
                      </button>
                    </div>

                    {/* Custom Calendar Popup */}
                    {openCalendar === 'editStart' && (
                      <div 
                        ref={editStartCalendarRef}
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
                          {renderDaysGrid('editStart')}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-bold text-txt-secondary uppercase tracking-wider mb-1.5">
                    End Date
                  </label>
                  <div className="relative flex flex-col justify-start">
                    <div className="relative flex items-center">
                      <input
                        type="text"
                        required
                        placeholder="DD/MM/YYYY"
                        value={eventEndDateInput}
                        onChange={(e) => handleDateInputChange(e.target.value, setEventEndDateInput)}
                        onFocus={() => {
                          const parsed = parseDisplayDate(eventEndDateInput)
                          setCalendarViewDate(parsed || new Date())
                          setOpenCalendar('editEnd')
                        }}
                        className="block w-full rounded-lg border border-input-border bg-input-base pl-3 pr-10 py-2.5 text-txt-primary placeholder-txt-muted focus:border-txt-primary focus:outline-hidden focus:ring-1 focus:ring-txt-primary sm:text-sm font-medium transition-all"
                      />
                      <button
                        type="button"
                        onClick={() => toggleCalendar('editEnd')}
                        className="edit-end-date-toggle absolute right-2.5 text-txt-muted hover:text-txt-primary p-1 rounded hover:bg-sidebar-active transition-colors cursor-pointer"
                        title="Select date"
                      >
                        <CalendarIcon className="h-4 w-4" />
                      </button>
                    </div>

                    {/* Custom Calendar Popup */}
                    {openCalendar === 'editEnd' && (
                      <div 
                        ref={editEndCalendarRef}
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
                          {renderDaysGrid('editEnd')}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Event Type / Color Portfolio */}
              <div>
                <label className="block text-xs font-bold text-txt-secondary uppercase tracking-wider mb-1.5">
                  Event Type / Color Portfolio
                </label>
                <select
                  value={eventTypeInput}
                  onChange={(e) => setEventTypeInput(e.target.value as any)}
                  className="block w-full rounded-lg border border-input-border bg-input-base px-3 py-2.5 text-txt-primary focus:border-txt-primary focus:outline-hidden focus:ring-1 focus:ring-txt-primary sm:text-sm font-semibold cursor-pointer"
                >
                  <option value="marriage">Marriage (Red)</option>
                  <option value="brand_photoshoot">Brand Photoshoot (Purple)</option>
                  <option value="portfolio_shoot">Portfolio Shoot (Orange)</option>
                  <option value="model_shoot">Model Shoot (Indigo)</option>
                  <option value="reel_shoot">Reel Shoot (Pink)</option>
                  <option value="manual_shoot">Manual Shoot (Teal)</option>
                  <option value="blocked">Blocked Date (Gray)</option>
                </select>
              </div>

              {/* Client Name (Enquiry events only) */}
              {editingEvent.enquiry_id && (
                <div>
                  <label className="block text-xs font-bold text-txt-secondary uppercase tracking-wider mb-1.5">
                    Client Name
                  </label>
                  <input
                    type="text"
                    required
                    value={clientName}
                    onChange={(e) => setClientName(e.target.value)}
                    className="block w-full rounded-lg border border-input-border bg-input-base px-3.5 py-2.5 text-txt-primary focus:border-txt-primary focus:outline-hidden focus:ring-1 focus:ring-txt-primary sm:text-sm font-medium transition-all"
                  />
                </div>
              )}

              {/* Package */}
              <div>
                <label className="block text-xs font-bold text-txt-secondary uppercase tracking-wider mb-1.5">
                  Package
                </label>
                <input
                  type="text"
                  placeholder="e.g. Premium Wedding Package"
                  value={eventPackage}
                  onChange={(e) => setEventPackage(e.target.value)}
                  className="block w-full rounded-lg border border-input-border bg-input-base px-3.5 py-2.5 text-txt-primary focus:border-txt-primary focus:outline-hidden focus:ring-1 focus:ring-txt-primary sm:text-sm font-medium transition-all"
                />
              </div>

              {/* Agreed Price */}
              <div>
                <label className="block text-xs font-bold text-txt-secondary uppercase tracking-wider mb-1.5">
                  Agreed Price (INR)
                </label>
                <div className="relative flex items-center">
                  <span className="absolute left-3.5 text-txt-muted text-sm font-semibold">₹</span>
                  <input
                    type="number"
                    placeholder="0"
                    value={eventPrice}
                    onChange={(e) => setEventPrice(e.target.value === '' ? '' : Number(e.target.value))}
                    className="block w-full rounded-lg border border-input-border bg-input-base pl-8 pr-3.5 py-2.5 text-txt-primary focus:border-txt-primary focus:outline-hidden focus:ring-1 focus:ring-txt-primary sm:text-sm font-bold text-emerald-600 dark:text-emerald-400 transition-all"
                  />
                </div>
              </div>

              {/* Assignee */}
              <div>
                <label className="block text-xs font-bold text-txt-secondary uppercase tracking-wider mb-1.5">
                  Team Member Assigned
                </label>
                <input
                  type="text"
                  placeholder="e.g. Rahul Sharma"
                  value={teamMember}
                  onChange={(e) => setTeamMember(e.target.value)}
                  className="block w-full rounded-lg border border-input-border bg-input-base px-3.5 py-2.5 text-txt-primary focus:border-txt-primary focus:outline-hidden focus:ring-1 focus:ring-txt-primary sm:text-sm font-medium transition-all"
                />
              </div>

              {/* Location */}
              <div>
                <label className="block text-xs font-bold text-txt-secondary uppercase tracking-wider mb-1.5">
                  Location
                </label>
                <input
                  type="text"
                  placeholder="e.g. Udaipur, Rajasthan"
                  value={eventLocation}
                  onChange={(e) => setEventLocation(e.target.value)}
                  className="block w-full rounded-lg border border-input-border bg-input-base px-3.5 py-2.5 text-txt-primary focus:border-txt-primary focus:outline-hidden focus:ring-1 focus:ring-txt-primary sm:text-sm font-medium transition-all"
                />
              </div>

              {/* Notes */}
              <div>
                <label className="block text-xs font-bold text-txt-secondary uppercase tracking-wider mb-1.5">
                  Notes
                </label>
                <textarea
                  rows={4}
                  placeholder="Enter any additional notes..."
                  value={eventNotes}
                  onChange={(e) => setEventNotes(e.target.value)}
                  className="block w-full rounded-lg border border-input-border bg-input-base px-3.5 py-2.5 text-txt-primary focus:border-txt-primary focus:outline-hidden focus:ring-1 focus:ring-txt-primary sm:text-sm font-medium leading-relaxed transition-all"
                />
              </div>
            </div>

            {/* Footer with actions */}
            <div className="p-6 border-t border-border-base bg-sidebar-active/30 flex flex-col gap-3 shrink-0">
              <button
                type="button"
                onClick={handleSave}
                className="w-full rounded-lg bg-txt-primary text-bg-base px-4 py-3 text-sm font-bold hover:opacity-90 transition-opacity shadow-sm text-center cursor-pointer"
              >
                Save changes
              </button>

              {showDeleteConfirm ? (
                <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-4 space-y-3">
                  <p className="text-xs text-red-500 font-bold text-center">Are you sure? This cannot be undone.</p>
                  <div className="flex items-center gap-3">
                    <button
                      type="button"
                      onClick={handleDeleteConfirm}
                      className="flex-1 rounded-md bg-red-650 px-3 py-2 text-xs font-bold text-white hover:bg-red-700 transition-colors cursor-pointer"
                    >
                      Confirm
                    </button>
                    <button
                      type="button"
                      onClick={() => setShowDeleteConfirm(false)}
                      className="flex-1 rounded-md bg-input-base border border-border-base px-3 py-2 text-xs font-bold text-txt-secondary hover:bg-sidebar-active transition-colors cursor-pointer"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => setShowDeleteConfirm(true)}
                  className="w-full rounded-lg border border-red-500/30 text-red-500 px-4 py-2.5 text-sm font-bold hover:bg-red-500/10 hover:border-red-500/40 transition-colors text-center cursor-pointer"
                >
                  Delete event
                </button>
              )}
            </div>
          </div>
        </>
      )}

      {/* Toast Notification Container */}
      {toast.message && (
        <div className="fixed bottom-6 right-6 z-50 animate-bounce">
          <div className={`rounded-xl shadow-lg border p-4 flex items-center gap-2.5 min-w-[240px] ${
            toast.type === 'success' 
              ? 'bg-emerald-600 text-white border-emerald-500' 
              : 'bg-red-600 text-white border-red-500'
          }`}>
            <span className="h-2 w-2 rounded-full bg-white shrink-0" />
            <span className="text-sm font-bold tracking-wide">{toast.message}</span>
          </div>
        </div>
      )}
    </div>
  )
}

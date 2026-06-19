'use client'

import React, { useEffect, useState } from 'react'
import Link from 'next/link'
import { createClient } from '@/utils/supabase/client'
import { isDemoMode, getDemoEvents, saveDemoEvents, getDemoEnquiries, saveDemoEnquiries, getDemoBookings, saveDemoBookings, getDemoWorkLogs, saveDemoWorkLogs } from '@/utils/supabase/demo'
import { MultiDatePicker, parseEventDates, formatMultiDates } from '@/components/MultiDatePicker'
import { 
  Plus, 
  Trash2, 
  Edit2, 
  X, 
  Calendar as CalendarIcon, 
  User, 
  FileText,
  Check,
  Loader2,
  ChevronLeft,
  ChevronRight
} from 'lucide-react'

interface CalendarEvent {
  id: string
  enquiry_id: string | null
  title: string
  event_date: string
  event_end_date?: string | null
  event_dates?: string | null  // NEW: comma-separated YYYY-MM-DD for multi-date events
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
  
  // Role & Session State
  const [userRole, setUserRole] = useState<'admin' | 'staff' | null>(null)
  const [staffSession, setStaffSession] = useState<{ id: string; name: string } | null>(null)
  const [workLogs, setWorkLogs] = useState<any[]>([])
  const [isLoggingWork, setIsLoggingWork] = useState(false)
  const [logWorkNote, setLogWorkNote] = useState('')
  const [logWorkDate, setLogWorkDate] = useState('')
  const [editingWorkLogId, setEditingWorkLogId] = useState<string | null>(null)
  const [editingWorkLogNote, setEditingWorkLogNote] = useState('')
  const [activeLoggingEventId, setActiveLoggingEventId] = useState<string | null>(null)

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
  const [eventDatesSelected, setEventDatesSelected] = useState<string[]>([])  // YYYY-MM-DD[]
  const [eventTypeInput, setEventTypeInput] = useState<CalendarEvent['event_type']>('manual_shoot')
  const [teamMember, setTeamMember] = useState('')
  const [eventNotes, setEventNotes] = useState('')
  const [formSaving, setFormSaving] = useState(false)
  const [eventDatesError, setEventDatesError] = useState<string>('')

  // Extra slide-in panel states
  const [isEditingTitle, setIsEditingTitle] = useState(false)
  const [clientName, setClientName] = useState('')
  const [eventPackage, setEventPackage] = useState('')
  const [eventPrice, setEventPrice] = useState<number | ''>('')
  const [eventLocation, setEventLocation] = useState('')
  const [eventStatus, setEventStatus] = useState<'new' | 'in_progress' | 'confirmed' | 'cancelled'>('confirmed')
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'delete' | null }>({ message: '', type: null })
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)

  // (Date picker click-outside now handled inside MultiDatePicker component)

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
      const demoWorkLogs = getDemoWorkLogs()
      setWorkLogs(demoWorkLogs)
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
      const [eventsRes, workLogsRes] = await Promise.all([
        supabase
          .from('calendar_events')
          .select('*, enquiries(id, name, package, agreed_price, notes, location, status)')
          .order('event_date', { ascending: true }),
        supabase
          .from('work_log')
          .select('*')
      ])

      if (eventsRes.error) {
        setErrorMsg(eventsRes.error.message)
      } else {
        const enriched = (eventsRes.data || []).map(evt => {
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

      if (workLogsRes.error) {
        console.error('Failed to fetch work logs:', workLogsRes.error.message)
      } else {
        setWorkLogs(workLogsRes.data || [])
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

    const staffSessionStr = localStorage.getItem('staff_session')
    if (staffSessionStr) {
      try {
        const session = JSON.parse(staffSessionStr)
        setStaffSession(session)
        setUserRole('staff')
      } catch (e) {
        console.error('Error parsing staff_session:', e)
      }
    } else {
      setUserRole('admin')
    }
  }, [supabase])

  const cleanNotesForStaff = (notesText: string | null) => {
    if (!notesText) return ''
    if (userRole === 'admin') return notesText
    return notesText
      .replace(/price\s*(agreed)?:\s*₹?\s*[0-9,.]+/gi, 'Price: [Redacted]')
      .replace(/₹\s*[0-9,.]+/g, '[Redacted]')
  }

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

  // Helper to calculate date strings range between start and end inclusive (DST & timezone immune)
  const getDatesInRange = (startStr: string, endStrIn?: string | null): string[] => {
    if (!startStr) return []
    const endStr = endStrIn || startStr
    const [sY, sM, sD] = startStr.split('-').map(Number)
    const [eY, eM, eD] = endStr.split('-').map(Number)
    const startUTC = Date.UTC(sY, sM - 1, sD)
    const endUTC = Date.UTC(eY, eM - 1, eD)
    const dates: string[] = []
    let currUTC = startUTC
    while (currUTC <= endUTC) {
      const d = new Date(currUTC)
      dates.push(`${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`)
      currUTC += 86400000
    }
    return dates
  }

  // NEW: Get the actual active dates for an event — respects multi-date selections
  const getEventActiveDates = (evt: CalendarEvent): string[] => {
    return parseEventDates(evt.event_dates, evt.event_date, evt.event_end_date)
  }

  const getEventStatus = (evt: CalendarEvent) => {
    if (evt.enquiry_id && evt.enquiries) {
      return evt.enquiries.status
    }
    return 'confirmed'
  }


  // Group events by date string (supports multi-date non-consecutive selections)
  const eventsByDate = events.reduce((acc, event) => {
    const dates = getEventActiveDates(event)
    dates.forEach(dateStr => {
      if (!acc[dateStr]) acc[dateStr] = []
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

  // (Legacy date helpers kept for potential use in non-form contexts)

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
    setEventDatesSelected(targetDate ? [targetDate] : [])
    setEventDatesError('')
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
    setEventDatesError('')

    if (eventDatesSelected.length === 0) {
      setEventDatesError('Please select at least one event date.')
      setFormSaving(false)
      return
    }

    const sorted = [...eventDatesSelected].sort()
    const dbStart = sorted[0]
    const dbEnd = sorted[sorted.length - 1]
    const eventDatesStr = sorted.join(',')

    const today = new Date()
    const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`

    if (dbStart < todayStr) {
      setEventDatesError('Event dates cannot be in the past.')
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
          event_dates: eventDatesStr,
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
          event_dates: eventDatesStr,
          event_type: eventTypeInput,
          team_member: teamMember.trim() === '' ? null : teamMember,
          notes: eventNotes.trim() === '' ? null : eventNotes
        })

      if (error) throw new Error(error.message)

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
    setEventDatesSelected(getEventActiveDates(event))
    setEventDatesError('')
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

  const handleTagMyself = async () => {
    if (!editingEvent || !staffSession) return
    const selfName = staffSession.name
    
    // 1. Optimistic update
    setEvents(prev => prev.map(evt => {
      if (evt.id === editingEvent.id) {
        return {
          ...evt,
          team_member: selfName
        }
      }
      return evt
    }))
    setTeamMember(selfName)
    setEditingEvent(prev => prev ? { ...prev, team_member: selfName } : null)
    
    // 2. Database/Local storage save
    if (isDemoMode()) {
      const demoEvents = getDemoEvents()
      const nextEvents = demoEvents.map(evt => {
        if (evt.id === editingEvent.id) {
          return { ...evt, team_member: selfName }
        }
        return evt
      })
      saveDemoEvents(nextEvents)
      
      const demoBookings = getDemoBookings()
      const nextBookings = demoBookings.map(b => {
        if (b.calendar_event_id === editingEvent.id) {
          return { ...b, lead_photographer: selfName }
        }
        return b
      })
      saveDemoBookings(nextBookings)
      
      showToast('You tagged yourself on this event', 'success')
      fetchEvents()
      return
    }
    
    try {
      const { error: eventError } = await supabase
        .from('calendar_events')
        .update({ team_member: selfName })
        .eq('id', editingEvent.id)
      if (eventError) throw eventError
      
      await supabase
        .from('bookings')
        .update({ lead_photographer: selfName })
        .eq('calendar_event_id', editingEvent.id)
        
      showToast('You tagged yourself on this event', 'success')
      fetchEvents()
    } catch (err: any) {
      console.error(err)
      setErrorMsg('Failed to update event assignment: ' + err.message)
    }
  }

  const handleUntagMyself = async () => {
    if (!editingEvent) return
    
    // 1. Optimistic update
    setEvents(prev => prev.map(evt => {
      if (evt.id === editingEvent.id) {
        return {
          ...evt,
          team_member: null
        }
      }
      return evt
    }))
    setTeamMember('')
    setEditingEvent(prev => prev ? { ...prev, team_member: null } : null)
    
    // 2. Database/Local storage save
    if (isDemoMode()) {
      const demoEvents = getDemoEvents()
      const nextEvents = demoEvents.map(evt => {
        if (evt.id === editingEvent.id) {
          return { ...evt, team_member: null }
        }
        return evt
      })
      saveDemoEvents(nextEvents)
      
      const demoBookings = getDemoBookings()
      const nextBookings = demoBookings.map(b => {
        if (b.calendar_event_id === editingEvent.id) {
          return { ...b, lead_photographer: null }
        }
        return b
      })
      saveDemoBookings(nextBookings)
      
      showToast('You untagged yourself', 'success')
      fetchEvents()
      return
    }
    
    try {
      const { error: eventError } = await supabase
        .from('calendar_events')
        .update({ team_member: null })
        .eq('id', editingEvent.id)
      if (eventError) throw eventError
      
      await supabase
        .from('bookings')
        .update({ lead_photographer: null })
        .eq('calendar_event_id', editingEvent.id)
        
      showToast('You untagged yourself', 'success')
      fetchEvents()
    } catch (err: any) {
      console.error(err)
      setErrorMsg('Failed to remove assignment: ' + err.message)
    }
  }

  const handleSave = async () => {
    if (!editingEvent) return

    setEventDatesError('')
    if (eventDatesSelected.length === 0) {
      setEventDatesError('Please select at least one event date.')
      setErrorMsg('Please select at least one event date.')
      return
    }

    const sorted = [...eventDatesSelected].sort()
    const dbStart = sorted[0]
    const dbEnd = sorted[sorted.length - 1]
    const eventDatesStr = sorted.join(',')

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
      event_dates: eventDatesStr,
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
              event_dates: eventDatesStr,
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
          event_dates: eventDatesStr,
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
          event_dates: eventDatesStr,
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

  const handleConfirmWorkLog = async (dateStr: string, noteStr: string) => {
    if (!editingEvent || !staffSession) return

    const wlTitle = editingEvent.title || 'Untitled Shoot'
    
    if (isDemoMode()) {
      const demoLogs = getDemoWorkLogs()
      const newLog = {
        id: 'work-' + Date.now(),
        staff_id: staffSession.id,
        event_id: editingEvent.id,
        event_title: wlTitle,
        event_date: dateStr,
        note: noteStr.trim() || null,
        status: 'pending' as const,
        payment_id: null,
        created_at: new Date().toISOString()
      }
      const updated = [newLog, ...demoLogs]
      saveDemoWorkLogs(updated)
      setWorkLogs(updated)
      showToast('Shift work logged successfully', 'success')
      setIsLoggingWork(false)
      setLogWorkNote('')
      return
    }

    try {
      const { data, error } = await supabase
        .from('work_log')
        .insert({
          staff_id: staffSession.id,
          event_id: editingEvent.id,
          event_title: wlTitle,
          event_date: dateStr,
          note: noteStr.trim() || null,
          status: 'pending'
        })
        .select('*')
        .single()
      
      if (error) throw error
      if (data) {
        setWorkLogs(prev => [data, ...prev])
      }
      showToast('Shift work logged successfully', 'success')
      setIsLoggingWork(false)
      setLogWorkNote('')
    } catch (e: any) {
      alert('Failed to log work: ' + e.message)
    }
  }

  const handleUpdateWorkLog = async (logId: string, noteStr: string) => {
    if (isDemoMode()) {
      const demoLogs = getDemoWorkLogs()
      const updated = demoLogs.map(l => l.id === logId ? { ...l, note: noteStr.trim() || null } : l)
      saveDemoWorkLogs(updated)
      setWorkLogs(updated)
      showToast('Work log updated', 'success')
      setEditingWorkLogId(null)
      return
    }

    try {
      const { error } = await supabase
        .from('work_log')
        .update({ note: noteStr.trim() || null })
        .eq('id', logId)
      
      if (error) throw error
      setWorkLogs(prev => prev.map(l => l.id === logId ? { ...l, note: noteStr.trim() || null } : l))
      showToast('Work log updated', 'success')
      setEditingWorkLogId(null)
    } catch (e: any) {
      alert('Failed to update work log: ' + e.message)
    }
  }

  const handleRemoveWorkLog = async (logId: string) => {
    if (!confirm('Are you sure you want to remove this work log?')) return

    if (isDemoMode()) {
      const demoLogs = getDemoWorkLogs()
      const updated = demoLogs.filter(l => l.id !== logId)
      saveDemoWorkLogs(updated)
      setWorkLogs(updated)
      showToast('Work log removed', 'delete')
      return
    }

    try {
      const { error } = await supabase
        .from('work_log')
        .delete()
        .eq('id', logId)
      
      if (error) throw error
      setWorkLogs(prev => prev.filter(l => l.id !== logId))
      showToast('Work log removed', 'delete')
    } catch (e: any) {
      alert('Failed to remove work log: ' + e.message)
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
                const aLen = getEventActiveDates(a).length
                const bLen = getEventActiveDates(b).length
                if (aLen !== bLen) return bLen - aLen
                return a.id.localeCompare(b.id)
              })

              // 3. Assign lanes and build segments (handles non-consecutive multi-date events)
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
                const evtDates = getEventActiveDates(evt)
                const weekDates = week.map(c => c.dateStr)

                // Find which columns in this week are selected for this event
                const selectedCols: number[] = []
                for (let i = 0; i < 7; i++) {
                  if (weekDates[i] && evtDates.includes(weekDates[i] as string)) {
                    selectedCols.push(i)
                  }
                }
                if (selectedCols.length === 0) return

                // Group selected columns into consecutive runs
                const runs: number[][] = [[selectedCols[0]]]
                for (let i = 1; i < selectedCols.length; i++) {
                  if (selectedCols[i] === selectedCols[i - 1] + 1) {
                    runs[runs.length - 1].push(selectedCols[i])
                  } else {
                    runs.push([selectedCols[i]])
                  }
                }

                // Find a lane where ALL selected cols for this event are free
                let lane = 0
                while (true) {
                  if (!lanes[lane]) lanes[lane] = Array(7).fill(null)
                  let free = true
                  for (const col of selectedCols) {
                    if (lanes[lane][col] !== null && lanes[lane][col] !== evt.id) { free = false; break }
                  }
                  if (free) break
                  lane++
                }

                // Occupy all selected cols in this lane
                if (!lanes[lane]) lanes[lane] = Array(7).fill(null)
                for (const col of selectedCols) {
                  lanes[lane][col] = evt.id
                }

                // Create one segment per consecutive run
                const sortedEvtDates = [...evtDates].sort()
                const firstEvtDate = sortedEvtDates[0]
                const lastEvtDate = sortedEvtDates[sortedEvtDates.length - 1]

                for (const run of runs) {
                  const runStartCol = run[0]
                  const runEndCol = run[run.length - 1]
                  segments.push({
                    event: evt,
                    lane,
                    startCol: runStartCol,
                    endCol: runEndCol,
                    isEventStart: weekDates[runStartCol] === firstEvtDate,
                    isEventEnd: weekDates[runEndCol] === lastEvtDate
                  })
                }
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
                  hiddenByDay[seg.startCol]++
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
                        title={`${seg.event.title} — ${formatMultiDates(getEventActiveDates(seg.event))}`}
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
              {userRole === 'admin' && (
                <button
                  onClick={() => openAddModal(selectedDateStr)}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-txt-primary px-3.5 py-2 text-xs font-bold text-bg-base hover:opacity-90 shadow-sm hover:shadow-md transition-all shrink-0 cursor-pointer"
                >
                  <Plus className="h-3.5 w-3.5" />
                  Add Event
                </button>
              )}
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
                {userRole === 'admin' && (
                  <button
                    onClick={() => openAddModal(selectedDateStr)}
                    className="mt-3 text-xs font-bold text-txt-primary hover:underline cursor-pointer"
                  >
                    Schedule one now
                  </button>
                )}
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
                        
                        {userRole === 'admin' && (
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
                        )}
                        {userRole === 'staff' && (
                          <div className="flex items-center gap-1 shrink-0">
                            <button
                              onClick={() => openEditModal(evt)}
                              className="px-2.5 py-1 text-[11px] font-bold text-indigo-500 dark:text-indigo-400 border border-indigo-500/25 rounded-md hover:bg-indigo-500/5 transition-all cursor-pointer"
                            >
                              Details
                            </button>
                          </div>
                        )}
                      </div>

                      <div className="space-y-2.5 text-xs text-txt-secondary border-t border-border-base/50 pt-3">
                        {/* Date(s) */}
                        <div className="flex flex-col gap-0.5">
                          <span className="text-[10px] font-bold text-txt-muted uppercase tracking-wider">Event Date(s)</span>
                          <span className="font-semibold text-txt-primary">
                            {formatMultiDates(getEventActiveDates(evt))}
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
                        {userRole === 'admin' && price !== undefined && price !== null && (
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
                              {cleanNotesForStaff(clientNotes)}
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

                        {/* Staff Shift Payout Logging Section (Agenda Card) */}
                        {userRole === 'staff' && staffSession && (() => {
                          const existingLog = workLogs.find(wl => wl.staff_id === staffSession.id && wl.event_id === evt.id && wl.event_date === selectedDateStr)
                          
                          return (
                            <div className="pt-2 border-t border-border-base/40 mt-3">
                              {existingLog ? (
                                <div className="p-2.5 bg-emerald-500/5 border border-emerald-500/20 rounded-lg space-y-1.5">
                                  <div className="flex items-center justify-between">
                                    <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400">
                                      ✓ Logged work on {dbDateToDisplayDate(selectedDateStr)}
                                      {existingLog.status === 'paid' && (
                                        <span className="ml-1.5 inline-flex items-center rounded bg-emerald-500/15 text-emerald-600 dark:text-emerald-450 border border-emerald-500/20 font-bold uppercase tracking-widest text-[8px] px-1 py-0.1">
                                          PAID
                                        </span>
                                      )}
                                    </span>
                                    {existingLog.status !== 'paid' && editingWorkLogId !== existingLog.id && (
                                      <div className="flex gap-2 text-[10px] font-bold">
                                        <button
                                          type="button"
                                          onClick={() => {
                                            setEditingWorkLogId(existingLog.id)
                                            setEditingWorkLogNote(existingLog.note || '')
                                          }}
                                          className="text-indigo-500 dark:text-indigo-400 hover:underline cursor-pointer"
                                        >
                                          Edit
                                        </button>
                                        <button
                                          type="button"
                                          onClick={() => handleRemoveWorkLog(existingLog.id)}
                                          className="text-red-500 hover:underline cursor-pointer"
                                        >
                                          Remove
                                        </button>
                                      </div>
                                    )}
                                  </div>

                                  {editingWorkLogId === existingLog.id ? (
                                    <div className="space-y-1.5">
                                      <input
                                        type="text"
                                        value={editingWorkLogNote}
                                        onChange={(e) => setEditingWorkLogNote(e.target.value)}
                                        placeholder="What did you do?"
                                        className="w-full rounded-md border border-input-border bg-input-base px-2 py-1 text-[11px] text-txt-primary"
                                      />
                                      <div className="flex gap-1.5 justify-end">
                                        <button
                                          type="button"
                                          onClick={() => setEditingWorkLogId(null)}
                                          className="px-2 py-0.5 text-[9px] text-txt-secondary hover:text-txt-primary cursor-pointer"
                                        >
                                          Cancel
                                        </button>
                                        <button
                                          type="button"
                                          onClick={() => handleUpdateWorkLog(existingLog.id, editingWorkLogNote)}
                                          className="px-2 py-0.5 text-[9px] text-white bg-indigo-600 rounded font-bold cursor-pointer"
                                        >
                                          Save
                                        </button>
                                      </div>
                                    </div>
                                  ) : (
                                    existingLog.note && <div className="text-[11px] text-txt-secondary italic pl-2 border-l border-emerald-500/30">"{existingLog.note}"</div>
                                  )}
                                </div>
                              ) : (
                                <div>
                                  {activeLoggingEventId === evt.id ? (
                                    <div className="bg-sidebar-active/20 border border-border-base rounded-lg p-2.5 space-y-2">
                                      <span className="text-[9px] font-extrabold text-txt-muted uppercase tracking-wider block">
                                        Log work for {dbDateToDisplayDate(selectedDateStr)}
                                      </span>
                                      <input
                                        type="text"
                                        placeholder="What did you do? (optional)"
                                        value={logWorkNote}
                                        onChange={(e) => setLogWorkNote(e.target.value)}
                                        className="w-full rounded-md border border-input-border bg-input-base px-2 py-1 text-[11px] text-txt-primary"
                                      />
                                      <div className="flex gap-1.5 justify-end">
                                        <button
                                          type="button"
                                          onClick={() => setActiveLoggingEventId(null)}
                                          className="px-2 py-0.5 text-[10px] text-txt-secondary hover:text-txt-primary cursor-pointer"
                                        >
                                          Cancel
                                        </button>
                                        <button
                                          type="button"
                                          onClick={() => {
                                            handleConfirmWorkLog(selectedDateStr, logWorkNote)
                                            setActiveLoggingEventId(null)
                                          }}
                                          className="px-3 py-0.5 bg-txt-primary text-bg-base rounded text-[10px] font-bold hover:opacity-90 cursor-pointer"
                                        >
                                          Confirm
                                        </button>
                                      </div>
                                    </div>
                                  ) : (
                                    <button
                                      type="button"
                                      onClick={() => {
                                        setActiveLoggingEventId(evt.id)
                                        setLogWorkNote('')
                                      }}
                                      className="inline-flex items-center gap-1 text-[11px] font-bold text-indigo-500 hover:text-indigo-400 hover:underline cursor-pointer"
                                    >
                                      <Plus className="h-3 w-3" />
                                      <span>I worked on this</span>
                                    </button>
                                  )}
                                </div>
                              )}
                            </div>
                          )
                        })()}
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

              <MultiDatePicker
                label="Event Date(s)"
                selectedDates={eventDatesSelected}
                onChange={setEventDatesSelected}
                placeholder="Click to select event dates"
                error={eventDatesError}
              />

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
                  {isEditingTitle && userRole === 'admin' ? (
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
                      onClick={() => userRole === 'admin' && setIsEditingTitle(true)}
                      className={`text-2xl font-extrabold text-txt-primary rounded px-1.5 -mx-1.5 py-0.5 transition-colors break-words leading-tight ${userRole === 'admin' ? 'cursor-pointer hover:bg-sidebar-active' : ''}`}
                      title={userRole === 'admin' ? "Click to edit title" : undefined}
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
                  disabled={userRole === 'staff'}
                  className="block w-full rounded-lg border border-input-border bg-input-base px-3 py-2.5 text-txt-primary focus:border-txt-primary focus:outline-hidden focus:ring-1 focus:ring-txt-primary sm:text-sm font-semibold transition-shadow cursor-pointer disabled:opacity-75 disabled:cursor-not-allowed"
                >
                  <option value="new">New</option>
                  <option value="in_progress">In Progress</option>
                  <option value="confirmed">Confirmed</option>
                  <option value="cancelled">Cancelled</option>
                </select>
              </div>

              {/* Event Date(s) — Multi-date picker / display */}
              {userRole === 'staff' ? (
                <div>
                  <label className="block text-xs font-bold text-txt-secondary uppercase tracking-wider mb-1.5">
                    Event Date(s)
                  </label>
                  <div className="w-full rounded-lg border border-input-border bg-sidebar-active/30 px-3.5 py-2.5 text-txt-primary sm:text-sm font-semibold">
                    {formatMultiDates(eventDatesSelected)}
                  </div>
                </div>
              ) : (
                <MultiDatePicker
                  label="Event Date(s)"
                  selectedDates={eventDatesSelected}
                  onChange={setEventDatesSelected}
                  placeholder="Click to select event dates"
                  error={eventDatesError}
                  allowPast={true}
                />
              )}

              {/* Event Type / Color Portfolio */}
              <div>
                <label className="block text-xs font-bold text-txt-secondary uppercase tracking-wider mb-1.5">
                  Event Type / Color Portfolio
                </label>
                <select
                  value={eventTypeInput}
                  onChange={(e) => setEventTypeInput(e.target.value as any)}
                  disabled={userRole === 'staff'}
                  className="block w-full rounded-lg border border-input-border bg-input-base px-3 py-2.5 text-txt-primary focus:border-txt-primary focus:outline-hidden focus:ring-1 focus:ring-txt-primary sm:text-sm font-semibold cursor-pointer disabled:opacity-75 disabled:cursor-not-allowed"
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
                    disabled={userRole === 'staff'}
                    className="block w-full rounded-lg border border-input-border bg-input-base px-3.5 py-2.5 text-txt-primary focus:border-txt-primary focus:outline-hidden focus:ring-1 focus:ring-txt-primary sm:text-sm font-medium transition-all disabled:opacity-75 disabled:cursor-not-allowed"
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
                  disabled={userRole === 'staff'}
                  className="block w-full rounded-lg border border-input-border bg-input-base px-3.5 py-2.5 text-txt-primary focus:border-txt-primary focus:outline-hidden focus:ring-1 focus:ring-txt-primary sm:text-sm font-medium transition-all disabled:opacity-75 disabled:cursor-not-allowed"
                />
              </div>

              {/* Agreed Price */}
              {userRole === 'admin' && (
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
              )}

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
                  disabled={userRole === 'staff'}
                  className="block w-full rounded-lg border border-input-border bg-input-base px-3.5 py-2.5 text-txt-primary focus:border-txt-primary focus:outline-hidden focus:ring-1 focus:ring-txt-primary sm:text-sm font-medium transition-all disabled:opacity-75 disabled:cursor-not-allowed"
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
                  disabled={userRole === 'staff'}
                  className="block w-full rounded-lg border border-input-border bg-input-base px-3.5 py-2.5 text-txt-primary focus:border-txt-primary focus:outline-hidden focus:ring-1 focus:ring-txt-primary sm:text-sm font-medium transition-all disabled:opacity-75 disabled:cursor-not-allowed"
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
                  value={cleanNotesForStaff(eventNotes)}
                  onChange={(e) => setEventNotes(e.target.value)}
                  disabled={userRole === 'staff'}
                  className="block w-full rounded-lg border border-input-border bg-input-base px-3.5 py-2.5 text-txt-primary focus:border-txt-primary focus:outline-hidden focus:ring-1 focus:ring-txt-primary sm:text-sm font-medium leading-relaxed transition-all disabled:opacity-75 disabled:cursor-not-allowed"
                />
              </div>

              {/* Staff Log My Shift Work Section */}
              {userRole === 'staff' && staffSession && (() => {
                const loggedShifts = workLogs.filter(wl => wl.staff_id === staffSession.id && wl.event_id === editingEvent.id)
                const eventDates = getEventActiveDates(editingEvent)
                const loggedDates = loggedShifts.map(wl => wl.event_date)
                const unloggedDates = eventDates.filter(d => !loggedDates.includes(d))

                return (
                  <div className="border-t border-border-base/50 pt-6 mt-6 space-y-4">
                    <h3 className="text-xs font-bold text-txt-secondary uppercase tracking-wider">Log My Shift Work</h3>
                    
                    {/* Existing Logged Shifts list */}
                    {loggedShifts.length > 0 && (
                      <div className="space-y-3">
                        {loggedShifts.map(wl => {
                          const isEditingThisLog = editingWorkLogId === wl.id
                          return (
                            <div key={wl.id} className="p-3 border border-emerald-500/25 bg-emerald-500/5 rounded-xl text-xs space-y-2">
                              <div className="flex items-start justify-between">
                                <div className="font-semibold text-txt-primary">
                                  ✓ You logged work on {dbDateToDisplayDate(wl.event_date)}
                                  {wl.status === 'paid' && (
                                    <span className="ml-2 inline-flex items-center rounded-md px-1.5 py-0.2 bg-emerald-500/15 text-emerald-600 dark:text-emerald-450 border border-emerald-500/20 font-bold uppercase tracking-widest text-[8px]">
                                      PAID
                                    </span>
                                  )}
                                </div>
                                {wl.status !== 'paid' && !isEditingThisLog && (
                                  <div className="flex items-center gap-2">
                                    <button
                                      type="button"
                                      onClick={() => {
                                        setEditingWorkLogId(wl.id)
                                        setEditingWorkLogNote(wl.note || '')
                                      }}
                                      className="text-indigo-500 dark:text-indigo-450 hover:underline font-bold cursor-pointer"
                                    >
                                      Edit
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => handleRemoveWorkLog(wl.id)}
                                      className="text-red-500 hover:underline font-bold cursor-pointer"
                                    >
                                      Remove
                                    </button>
                                  </div>
                                )}
                              </div>

                              {isEditingThisLog ? (
                                <div className="space-y-2 pt-1">
                                  <input
                                    type="text"
                                    value={editingWorkLogNote}
                                    onChange={(e) => setEditingWorkLogNote(e.target.value)}
                                    placeholder="e.g. 2nd shooter, edited the reel"
                                    className="w-full rounded-lg border border-input-border bg-input-base px-3 py-1.5 text-xs text-txt-primary placeholder-txt-muted focus:border-txt-primary focus:outline-hidden focus:ring-1 focus:ring-txt-primary font-medium"
                                  />
                                  <div className="flex gap-2 justify-end">
                                    <button
                                      type="button"
                                      onClick={() => setEditingWorkLogId(null)}
                                      className="px-2.5 py-1 text-[11px] font-semibold text-txt-secondary hover:text-txt-primary bg-sidebar-active/30 rounded cursor-pointer"
                                    >
                                      Cancel
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => handleUpdateWorkLog(wl.id, editingWorkLogNote)}
                                      className="px-2.5 py-1 text-[11px] font-bold text-white bg-indigo-600 hover:bg-indigo-500 rounded cursor-pointer"
                                    >
                                      Save
                                    </button>
                                  </div>
                                </div>
                              ) : (
                                wl.note && <div className="text-txt-secondary italic pl-3 border-l-2 border-emerald-500/30 font-medium">"{wl.note}"</div>
                              )}
                            </div>
                          )
                        })}
                      </div>
                    )}

                    {/* Button to show logging form */}
                    {unloggedDates.length > 0 && (
                      <>
                        {!isLoggingWork ? (
                          <button
                            type="button"
                            onClick={() => {
                              setIsLoggingWork(true)
                              setLogWorkDate(unloggedDates[0])
                              setLogWorkNote('')
                            }}
                            className="w-full py-2 border border-dashed border-border-base hover:border-txt-primary rounded-xl text-xs font-bold text-txt-secondary hover:text-txt-primary transition-all flex items-center justify-center gap-1.5 cursor-pointer bg-card-base hover:bg-sidebar-active/20"
                          >
                            <Plus className="h-4 w-4" />
                            <span>I worked on this</span>
                          </button>
                        ) : (
                          <div className="p-4 border border-border-base rounded-xl space-y-4 bg-sidebar-active/10">
                            <div className="flex items-center justify-between border-b border-border-base/50 pb-2">
                              <span className="text-xs font-bold text-txt-primary">Log Shift Details</span>
                              <button
                                type="button"
                                onClick={() => setIsLoggingWork(false)}
                                className="text-txt-muted hover:text-txt-primary"
                              >
                                <X className="h-4 w-4" />
                              </button>
                            </div>

                            {unloggedDates.length > 1 && (
                              <div>
                                <label className="block text-[10px] font-extrabold text-txt-muted uppercase tracking-wider mb-1">
                                  Select Event Date
                                </label>
                                <select
                                  value={logWorkDate}
                                  onChange={(e) => setLogWorkDate(e.target.value)}
                                  className="block w-full rounded-lg border border-input-border bg-input-base px-2.5 py-1.5 text-xs text-txt-primary focus:border-txt-primary focus:outline-hidden focus:ring-1 focus:ring-txt-primary font-bold cursor-pointer"
                                >
                                  {unloggedDates.map(d => (
                                    <option key={d} value={d}>{dbDateToDisplayDate(d)}</option>
                                  ))}
                                </select>
                              </div>
                            )}

                            <div>
                              <label className="block text-[10px] font-extrabold text-txt-muted uppercase tracking-wider mb-1">
                                What did you do? (optional)
                              </label>
                              <input
                                type="text"
                                placeholder="e.g. 2nd shooter, edited the reel"
                                value={logWorkNote}
                                onChange={(e) => setLogWorkNote(e.target.value)}
                                className="w-full rounded-lg border border-input-border bg-input-base px-3 py-2 text-xs text-txt-primary placeholder-txt-muted focus:border-txt-primary focus:outline-hidden focus:ring-1 focus:ring-txt-primary font-semibold"
                              />
                            </div>

                            <div className="flex items-center justify-end gap-2 pt-2 border-t border-border-base/50">
                              <button
                                type="button"
                                onClick={() => setIsLoggingWork(false)}
                                className="px-3 py-1.5 border border-border-base text-txt-secondary hover:text-txt-primary rounded-lg text-[11px] font-semibold hover:bg-sidebar-active/20 cursor-pointer"
                              >
                                Cancel
                              </button>
                              <button
                                type="button"
                                onClick={() => handleConfirmWorkLog(logWorkDate || unloggedDates[0], logWorkNote)}
                                className="px-4 py-1.5 bg-txt-primary text-bg-base rounded-lg text-[11px] font-bold shadow hover:opacity-90 transition-all cursor-pointer"
                              >
                                Confirm
                              </button>
                            </div>
                          </div>
                        )}
                      </>
                    )}
                  </div>
                )
              })()}
            </div>

            {/* Footer with actions */}
            <div className="p-6 border-t border-border-base bg-sidebar-active/30 flex flex-col gap-3 shrink-0">
              {userRole === 'admin' ? (
                <>
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
                </>
              ) : (
                // Staff actions
                <>
                  {editingEvent?.team_member === staffSession?.name ? (
                    <button
                      type="button"
                      onClick={handleUntagMyself}
                      className="w-full rounded-lg border border-red-500/30 text-red-500 px-4 py-3 text-sm font-bold hover:bg-red-500/10 hover:border-red-500/40 transition-colors text-center cursor-pointer"
                    >
                      Untag Myself
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={handleTagMyself}
                      className="w-full rounded-lg bg-txt-primary text-bg-base px-4 py-3 text-sm font-bold hover:opacity-90 transition-opacity shadow-sm text-center cursor-pointer"
                    >
                      Tag Myself
                    </button>
                  )}
                </>
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

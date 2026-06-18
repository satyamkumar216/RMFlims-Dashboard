export interface DemoEnquiry {
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

export interface DemoCalendarEvent {
  id: string
  enquiry_id: string | null
  title: string
  event_date: string
  event_end_date?: string | null
  event_dates: string
  event_type: 'marriage' | 'brand_photoshoot' | 'portfolio_shoot' | 'model_shoot' | 'reel_shoot' | 'manual_shoot' | 'blocked'
  team_member: string | null
  notes: string | null
  created_at: string
}

export interface DemoBooking {
  id: string
  enquiry_id: string | null
  calendar_event_id: string | null
  source: 'enquiry' | 'manual'
  client_name: string
  email: string
  phone: string
  how_found: string
  event_type: string
  event_date_start: string
  event_date_end: string
  event_dates: string
  location: string
  package: string
  package_details?: string | null
  num_guests?: number | null
  agreed_price: number
  advance_paid: number
  balance_due: number
  payment_status: 'due' | 'partial' | 'paid'
  payment_method: string
  payment_terms: string
  lead_photographer?: string | null
  second_shooter?: string | null
  videographer?: string | null
  special_requirements?: string | null
  booking_status: 'confirmed' | 'in_progress' | 'tentative' | 'cancelled'
  admin_notes?: string | null
  receipt_number: string
  created_at: string
}

export function isDemoMode() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  return (
    !url || 
    url.includes('your-project-url') || 
    url.includes('your-project-id') || 
    url.includes('placeholder') || 
    url === ''
  )
}

const defaultEnquiries: DemoEnquiry[] = [
  {
    id: 'demo-1',
    name: 'Aisha & Rohan',
    email: 'aisha@example.com',
    phone: '+91 98765 43210',
    package: 'Full Wedding (Photo + Video)',
    event_date: '2026-11-24',
    event_end_date: '2026-11-26',
    message: 'Looking for candid photography and cinematic video for our 3-day wedding in Udaipur. We expect around 200 guests.',
    agreed_price: null,
    status: 'new',
    created_at: '2026-06-13T12:00:00Z',
    notes: 'Awaiting pricing quote approval.',
    location: 'Udaipur',
    payment_status: 'due',
    payment_method: null,
    payment_timeline: 'Custom — see amounts below',
    paid_amount: 0
  },
  {
    id: 'demo-2',
    name: 'Karan & Simran',
    email: 'karan@example.com',
    phone: '+91 98123 45678',
    package: 'Pre-Wedding Shoot',
    event_date: '2026-10-10',
    event_end_date: '2026-10-10',
    message: 'We want a sunset pre-wedding shoot in Goa. Need drone footage as well.',
    agreed_price: 45000,
    status: 'in_progress',
    created_at: '2026-06-12T15:30:00Z',
    notes: 'Pre-wedding locations finalized.',
    location: 'Goa',
    payment_status: 'advance_paid',
    payment_method: 'UPI',
    payment_timeline: 'Custom — see amounts below',
    paid_amount: 20000
  },
  {
    id: 'demo-3',
    name: 'Sarah & Neil',
    email: 'sarah@example.com',
    phone: '+91 99999 88888',
    package: 'Wedding Day Only',
    event_date: '2026-06-22',
    event_end_date: '2026-06-22',
    message: 'Hi, we just need traditional photography coverage for our wedding day in Delhi.',
    agreed_price: 80000,
    status: 'confirmed',
    created_at: '2026-06-10T09:15:00Z',
    notes: 'Booking deposit paid.',
    location: 'Delhi',
    payment_status: 'fully_paid',
    payment_method: 'Bank Transfer',
    payment_timeline: 'Pay Before Shoot',
    paid_amount: 80000
  }
]

const defaultEvents: DemoCalendarEvent[] = [
  {
    id: 'event-1',
    enquiry_id: 'demo-3',
    title: 'Booking: Sarah & Neil',
    event_date: '2026-06-22',
    event_end_date: '2026-06-22',
    event_dates: '2026-06-22',
    event_type: 'marriage',
    team_member: 'Rohan (Lead Photographer)',
    notes: 'Package: Wedding Day Only. Agreed Price: ₹80,000.',
    created_at: '2026-06-10T09:15:00Z'
  },
  {
    id: 'event-2',
    enquiry_id: null,
    title: 'Brand Photoshoot: Nike Fashion Line',
    event_date: '2026-06-20',
    event_end_date: '2026-06-21',
    event_dates: '2026-06-20,2026-06-21',
    event_type: 'brand_photoshoot',
    team_member: 'Simran',
    notes: 'Photoshoot at Nike HQ studio.',
    created_at: '2026-06-13T10:00:00Z'
  },
  {
    id: 'event-3',
    enquiry_id: null,
    title: 'Blocked: Sensor Cleaning',
    event_date: '2026-06-25',
    event_end_date: '2026-06-25',
    event_dates: '2026-06-25',
    event_type: 'blocked',
    team_member: null,
    notes: 'Equipment servicing day.',
    created_at: '2026-06-13T10:00:00Z'
  }
]

export function getDemoEnquiries(): DemoEnquiry[] {
  if (typeof window === 'undefined') return defaultEnquiries
  const stored = localStorage.getItem('demo_enquiries')
  if (!stored) {
    localStorage.setItem('demo_enquiries', JSON.stringify(defaultEnquiries))
    return defaultEnquiries
  }
  return JSON.parse(stored)
}

export function saveDemoEnquiries(data: DemoEnquiry[]) {
  if (typeof window === 'undefined') return
  localStorage.setItem('demo_enquiries', JSON.stringify(data))
}

export function getDemoEvents(): DemoCalendarEvent[] {
  if (typeof window === 'undefined') return defaultEvents
  const stored = localStorage.getItem('demo_events')
  if (!stored) {
    localStorage.setItem('demo_events', JSON.stringify(defaultEvents))
    return defaultEvents
  }
  return JSON.parse(stored)
}

export function saveDemoEvents(data: DemoCalendarEvent[]) {
  if (typeof window === 'undefined') return
  localStorage.setItem('demo_events', JSON.stringify(data))
}

const defaultBookings: DemoBooking[] = [
  {
    id: 'booking-1',
    enquiry_id: 'demo-3',
    calendar_event_id: 'event-1',
    source: 'enquiry',
    client_name: 'Sarah & Neil',
    email: 'sarah@example.com',
    phone: '+91 99999 88888',
    how_found: 'Instagram',
    event_type: 'marriage',
    event_date_start: '2026-06-22',
    event_date_end: '2026-06-22',
    event_dates: '2026-06-22',
    location: 'Delhi',
    package: 'Wedding Day Only',
    package_details: 'Traditional photography coverage',
    num_guests: 150,
    agreed_price: 80000,
    advance_paid: 80000,
    balance_due: 0,
    payment_status: 'paid',
    payment_method: 'Bank Transfer',
    payment_terms: 'Pay Before Shoot',
    lead_photographer: 'Rohan',
    second_shooter: '',
    videographer: '',
    special_requirements: 'None',
    booking_status: 'confirmed',
    admin_notes: 'Booking deposit paid in full.',
    receipt_number: 'RMF-2026-0001',
    created_at: '2026-06-10T09:15:00Z'
  }
]

export function getDemoBookings(): DemoBooking[] {
  if (typeof window === 'undefined') return defaultBookings
  const stored = localStorage.getItem('demo_bookings')
  if (!stored) {
    localStorage.setItem('demo_bookings', JSON.stringify(defaultBookings))
    return defaultBookings
  }
  return JSON.parse(stored)
}

export function saveDemoBookings(data: DemoBooking[]) {
  if (typeof window === 'undefined') return
  localStorage.setItem('demo_bookings', JSON.stringify(data))
}

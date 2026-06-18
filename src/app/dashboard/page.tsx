'use client'

import React, { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { createClient } from '@/utils/supabase/client'
import { isDemoMode, getDemoEnquiries, getDemoBookings, getDemoEvents } from '@/utils/supabase/demo'
import { Search, SlidersHorizontal, Calendar as CalendarIcon, ArrowUpDown, Inbox, CheckCircle2, IndianRupee, TrendingUp, TrendingDown, Plus } from 'lucide-react'

interface Enquiry {
  id: string
  name: string
  email: string
  phone: string
  package: string
  event_date: string
  message: string
  agreed_price: number | null
  status: 'new' | 'in_progress' | 'confirmed' | 'cancelled'
  location?: string | null
  created_at: string
}

export default function EnquiriesPage() {
  const router = useRouter()
  const supabase = createClient()
  
  const [enquiries, setEnquiries] = useState<Enquiry[]>([])
  const [bookings, setBookings] = useState<any[]>([])
  const [events, setEvents] = useState<any[]>([])
  
  const [loading, setLoading] = useState(true)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  
  // Filters and search
  const [searchQuery, setSearchQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [sortBy, setSortBy] = useState<'created_at' | 'event_date'>('created_at')
  const [sortOrder, setSortOrder] = useState<'desc' | 'asc'>('desc')

  useEffect(() => {
    async function fetchData() {
      setLoading(true)
      setErrorMsg(null)

      if (isDemoMode()) {
        const demoEnquiries = getDemoEnquiries() as Enquiry[]
        const demoBookings = getDemoBookings()
        const demoEvents = getDemoEvents()
        
        // Sorting logic for enquiries
        const sorted = [...demoEnquiries].sort((a, b) => {
          const field = sortBy === 'created_at' ? 'created_at' : 'event_date'
          const valA = a[field]
          const valB = b[field]
          if (sortOrder === 'asc') {
            return valA > valB ? 1 : -1
          } else {
            return valA < valB ? 1 : -1
          }
        })
        
        setEnquiries(sorted)
        setBookings(demoBookings)
        setEvents(demoEvents)
        setLoading(false)
        return
      }

      try {
        const [enqRes, bookRes, evtRes] = await Promise.all([
          supabase.from('enquiries').select('*').order(sortBy, { ascending: sortOrder === 'asc' }),
          supabase.from('bookings').select('*'),
          supabase.from('calendar_events').select('*')
        ])

        if (enqRes.error) {
          setErrorMsg(enqRes.error.message)
        } else {
          setEnquiries(enqRes.data || [])
        }

        if (!bookRes.error) setBookings(bookRes.data || [])
        if (!evtRes.error) setEvents(evtRes.data || [])
      } catch (err: any) {
        setErrorMsg('Failed to load dashboard data.')
      } finally {
        setLoading(false)
      }
    }

    fetchData()
  }, [supabase, sortBy, sortOrder])

  // Get status badge styles
  const getStatusBadge = (status: Enquiry['status']) => {
    switch (status) {
      case 'new':
        return 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20 px-2.5 py-0.5 rounded-full text-xs font-bold'
      case 'in_progress':
        return 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20 px-2.5 py-0.5 rounded-full text-xs font-bold'
      case 'confirmed':
        return 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20 px-2.5 py-0.5 rounded-full text-xs font-bold'
      case 'cancelled':
        return 'bg-red-500/10 text-red-650 dark:text-red-400 border-red-500/20 px-2.5 py-0.5 rounded-full text-xs font-bold'
      default:
        return 'bg-gray-500/10 text-gray-500 dark:text-gray-400 border-gray-500/20 px-2.5 py-0.5 rounded-full text-xs font-bold'
    }
  }

  // Format currency
  const formatPrice = (price: number | null) => {
    if (price === null || price === undefined) return '—'
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 0
    }).format(price)
  }

  // Format date as DD/MM/YYYY
  const formatDate = (dateStr: string) => {
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

  // Filtered enquiries
  const filteredEnquiries = enquiries.filter((enquiry) => {
    const matchesSearch =
      enquiry.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      enquiry.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
      enquiry.package.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (enquiry.location && enquiry.location.toLowerCase().includes(searchQuery.toLowerCase()))

    const matchesStatus = statusFilter === 'all' || enquiry.status === statusFilter

    return matchesSearch && matchesStatus
  })

  const handleRowClick = (id: string) => {
    router.push(`/dashboard/enquiries/${id}`)
  }

  const toggleSort = (field: 'created_at' | 'event_date') => {
    if (sortBy === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')
    } else {
      setSortBy(field)
      setSortOrder('desc')
    }
  }

  // Calculated Stats
  const totalEnquiries = enquiries.length
  const confirmedBookings = bookings.filter(b => b.booking_status === 'confirmed').length
  const totalRevenue = bookings.reduce((sum, b) => sum + (b.agreed_price || 0), 0)
  const upcomingEvents = events.filter(e => new Date(e.event_date) >= new Date()).length

  // Date and Greeting
  const currentDateStr = new Date().toLocaleDateString('en-US', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric'
  })

  return (
    <div className="space-y-6">
      {/* Page Header & Greeting */}
      <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <span className="text-sm font-semibold text-txt-muted">Good morning 👋</span>
          <h1 className="text-[24px] font-bold tracking-tight text-txt-primary mt-0.5">{currentDateStr}</h1>
        </div>
      </div>

      {/* Loading Skeletons */}
      {loading ? (
        <div className="space-y-6 animate-pulse">
          {/* Stat Cards Shimmer */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="p-6 bg-white dark:bg-card-base rounded-[16px] shadow-sm h-36 flex flex-col justify-between border border-transparent">
                <div className="flex justify-between items-start">
                  <div className="h-3.5 bg-gray-200 dark:bg-gray-800 rounded w-24"></div>
                  <div className="h-8 w-8 rounded-full bg-gray-200 dark:bg-gray-800"></div>
                </div>
                <div className="flex justify-between items-end">
                  <div className="h-8 bg-gray-200 dark:bg-gray-800 rounded w-20"></div>
                  <div className="h-6 bg-gray-200 dark:bg-gray-800 rounded w-12"></div>
                </div>
                <div className="h-3 bg-gray-200 dark:bg-gray-800 rounded w-32"></div>
              </div>
            ))}
          </div>

          {/* Main Card Shimmer */}
          <div className="bg-white dark:bg-card-base rounded-[16px] p-6 shadow-sm border border-transparent space-y-4">
            <div className="flex justify-between items-center pb-4 border-b border-border-base/50">
              <div className="space-y-1.5">
                <div className="h-4 bg-gray-200 dark:bg-gray-800 rounded w-36"></div>
                <div className="h-3 bg-gray-200 dark:bg-gray-800 rounded w-48"></div>
              </div>
            </div>
            <div className="space-y-3 pt-2">
              {[1, 2, 3, 4, 5].map((i) => (
                <div key={i} className="flex justify-between items-center py-4 border-b border-cell-border/55">
                  <div className="h-4 bg-gray-200 dark:bg-gray-800 rounded w-1/4"></div>
                  <div className="h-4 bg-gray-200 dark:bg-gray-800 rounded w-1/6"></div>
                  <div className="h-4 bg-gray-200 dark:bg-gray-800 rounded w-1/6"></div>
                  <div className="h-4 bg-gray-200 dark:bg-gray-800 rounded w-1/12"></div>
                </div>
              ))}
            </div>
          </div>
        </div>
      ) : (
        <>
          {/* Stat Cards Overview Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Total Enquiries Card */}
            <div className="p-6 bg-white dark:bg-card-base rounded-[16px] shadow-[0_2px_8px_rgba(0,0,0,0.06),0_0_1px_rgba(0,0,0,0.04)] hover:shadow-[0_4px_16px_rgba(0,0,0,0.08),0_0_1px_rgba(0,0,0,0.06)] hover:-translate-y-0.5 transition-all duration-150 flex flex-col justify-between h-36 border border-transparent transition-colors">
              <div className="flex justify-between items-start">
                <span className="text-[13px] font-medium text-txt-secondary">Total Enquiries</span>
                <div className="p-2.5 rounded-full bg-[#EFF6FF] text-blue-600 dark:bg-blue-500/10 dark:text-blue-400">
                  <Inbox className="h-4.5 w-4.5" />
                </div>
              </div>
              <div className="flex items-end justify-between">
                <div>
                  <h3 className="text-[32px] font-bold text-txt-primary leading-none">{totalEnquiries}</h3>
                  <div className="flex items-center gap-1 text-[12px] text-[#16A34A] font-medium mt-2">
                    <TrendingUp className="h-3 w-3" />
                    <span>↑ 12% this month</span>
                  </div>
                </div>
                <div className="mb-1 text-blue-500 dark:text-blue-400">
                  <svg className="w-16 h-8" viewBox="0 0 60 20" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M 2 16 Q 12 8, 22 14 T 42 6 T 58 4" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </div>
              </div>
            </div>

            {/* Confirmed Bookings Card */}
            <div className="p-6 bg-white dark:bg-card-base rounded-[16px] shadow-[0_2px_8px_rgba(0,0,0,0.06),0_0_1px_rgba(0,0,0,0.04)] hover:shadow-[0_4px_16px_rgba(0,0,0,0.08),0_0_1px_rgba(0,0,0,0.06)] hover:-translate-y-0.5 transition-all duration-150 flex flex-col justify-between h-36 border border-transparent transition-colors">
              <div className="flex justify-between items-start">
                <span className="text-[13px] font-medium text-txt-secondary">Confirmed Bookings</span>
                <div className="p-2.5 rounded-full bg-[#F0FDF4] text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-400">
                  <CheckCircle2 className="h-4.5 w-4.5" />
                </div>
              </div>
              <div className="flex items-end justify-between">
                <div>
                  <h3 className="text-[32px] font-bold text-txt-primary leading-none">{confirmedBookings}</h3>
                  <div className="flex items-center gap-1 text-[12px] text-[#16A34A] font-medium mt-2">
                    <TrendingUp className="h-3 w-3" />
                    <span>↑ 8% this month</span>
                  </div>
                </div>
                <div className="mb-1 text-emerald-500 dark:text-emerald-400">
                  <svg className="w-16 h-8" viewBox="0 0 60 20" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M 2 14 Q 12 18, 22 10 T 42 8 T 58 2" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </div>
              </div>
            </div>

            {/* Total Revenue Card */}
            <div className="p-6 bg-white dark:bg-card-base rounded-[16px] shadow-[0_2px_8px_rgba(0,0,0,0.06),0_0_1px_rgba(0,0,0,0.04)] hover:shadow-[0_4px_16px_rgba(0,0,0,0.08),0_0_1px_rgba(0,0,0,0.06)] hover:-translate-y-0.5 transition-all duration-150 flex flex-col justify-between h-36 border border-transparent transition-colors">
              <div className="flex justify-between items-start">
                <span className="text-[13px] font-medium text-txt-secondary">Revenue</span>
                <div className="p-2.5 rounded-full bg-[#FAF5FF] text-purple-600 dark:bg-purple-500/10 dark:text-purple-400">
                  <IndianRupee className="h-4.5 w-4.5" />
                </div>
              </div>
              <div className="flex items-end justify-between">
                <div>
                  <h3 className="text-[28px] font-bold text-txt-primary leading-none truncate max-w-[150px]">
                    ₹{totalRevenue.toLocaleString('en-IN', { maximumFractionDigits: 0 })}
                  </h3>
                  <div className="flex items-center gap-1 text-[12px] text-[#16A34A] font-medium mt-2">
                    <TrendingUp className="h-3 w-3" />
                    <span>↑ 24% this month</span>
                  </div>
                </div>
                <div className="mb-1 text-purple-500 dark:text-purple-400">
                  <svg className="w-16 h-8" viewBox="0 0 60 20" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M 2 18 Q 12 10, 22 15 T 42 4 T 58 6" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </div>
              </div>
            </div>

            {/* Upcoming Events Card */}
            <div className="p-6 bg-white dark:bg-card-base rounded-[16px] shadow-[0_2px_8px_rgba(0,0,0,0.06),0_0_1px_rgba(0,0,0,0.04)] hover:shadow-[0_4px_16px_rgba(0,0,0,0.08),0_0_1px_rgba(0,0,0,0.06)] hover:-translate-y-0.5 transition-all duration-150 flex flex-col justify-between h-36 border border-transparent transition-colors">
              <div className="flex justify-between items-start">
                <span className="text-[13px] font-medium text-txt-secondary">Upcoming Events</span>
                <div className="p-2.5 rounded-full bg-[#FFF7ED] text-orange-600 dark:bg-orange-500/10 dark:text-orange-400">
                  <CalendarIcon className="h-4.5 w-4.5" />
                </div>
              </div>
              <div className="flex items-end justify-between">
                <div>
                  <h3 className="text-[32px] font-bold text-txt-primary leading-none">{upcomingEvents}</h3>
                  <div className="flex items-center gap-1 text-[12px] text-[#DC2626] font-medium mt-2">
                    <TrendingDown className="h-3 w-3" />
                    <span>↓ 2% this week</span>
                  </div>
                </div>
                <div className="mb-1 text-orange-500 dark:text-orange-400">
                  <svg className="w-16 h-8" viewBox="0 0 60 20" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M 2 10 Q 12 14, 22 6 T 42 12 T 58 14" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </div>
              </div>
            </div>
          </div>

          {/* Filters Bar Card */}
          <div className="flex flex-col gap-4 bg-white dark:bg-card-base p-5 rounded-[16px] sm:flex-row sm:items-center sm:justify-between shadow-[0_2px_8px_rgba(0,0,0,0.06),0_0_1px_rgba(0,0,0,0.04)] border border-transparent transition-colors duration-300">
            {/* Search */}
            <div className="relative flex-1 max-w-md">
              <Search className="absolute top-2.5 left-3.5 h-4.5 w-4.5 text-txt-muted" />
              <input
                type="text"
                placeholder="Search by client name, email or package..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full rounded-lg border border-input-border bg-input-base pl-10 pr-4 py-2 text-sm text-txt-primary placeholder-txt-muted focus:border-txt-primary focus:outline-hidden focus:ring-1 focus:ring-txt-primary transition-all font-medium"
              />
            </div>

            {/* Filters and Sorting controls */}
            <div className="flex flex-wrap items-center gap-3">
              <div className="flex items-center gap-2">
                <SlidersHorizontal className="h-4.5 w-4.5 text-txt-muted" />
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="rounded-lg border border-input-border bg-input-base px-3 py-1.5 text-sm font-semibold text-txt-secondary focus:border-txt-primary focus:outline-hidden focus:ring-1 focus:ring-txt-primary transition-all cursor-pointer"
                >
                  <option value="all">All Statuses</option>
                  <option value="new">New</option>
                  <option value="in_progress">In Progress</option>
                  <option value="confirmed">Confirmed</option>
                  <option value="cancelled">Cancelled</option>
                </select>
              </div>

              <div className="flex items-center gap-2 border-l border-border-base pl-3">
                <button
                  onClick={() => toggleSort('created_at')}
                  className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-bold uppercase tracking-wider transition-all cursor-pointer ${
                    sortBy === 'created_at' 
                      ? 'bg-sidebar-active text-txt-primary border border-border-base/70' 
                      : 'text-txt-secondary hover:text-txt-primary border border-transparent'
                  }`}
                >
                  Received
                  <ArrowUpDown className="h-3.5 w-3.5" />
                </button>
                <button
                  onClick={() => toggleSort('event_date')}
                  className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-bold uppercase tracking-wider transition-all cursor-pointer ${
                    sortBy === 'event_date' 
                      ? 'bg-sidebar-active text-txt-primary border border-border-base/70' 
                      : 'text-txt-secondary hover:text-txt-primary border border-transparent'
                  }`}
                >
                  Event Date
                  <ArrowUpDown className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          </div>

          {/* Main Card View wrapper */}
          <div className="bg-white dark:bg-card-base border border-transparent rounded-[16px] p-6 shadow-[0_2px_8px_rgba(0,0,0,0.06),0_0_1px_rgba(0,0,0,0.04)] transition-colors duration-300">
            <div className="pb-4 mb-4 border-b border-border-base/50">
              <h2 className="text-[15px] font-semibold text-txt-primary">Recent Enquiries</h2>
              <p className="text-xs text-txt-secondary mt-0.5">Manage client requests, timeline settings, and confirm shoots.</p>
            </div>

            {filteredEnquiries.length === 0 ? (
              <div className="flex h-64 flex-col items-center justify-center text-center py-12">
                <Inbox className="h-10 w-10 text-txt-muted mb-3" />
                <h3 className="text-sm font-bold text-txt-primary">No enquiries found</h3>
                <p className="text-xs text-txt-secondary mt-1">
                  Try adjusting your search query or status filter.
                </p>
              </div>
            ) : (
              <>
                {/* Desktop Table View */}
                <div className="hidden md:block overflow-hidden">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="border-b border-border-base bg-tbl-header/45 text-xs font-bold text-txt-secondary uppercase tracking-wider">
                        <th className="px-6 py-3.5">Client Name</th>
                        <th className="px-6 py-3.5">Event Date</th>
                        <th className="px-6 py-3.5">Location</th>
                        <th className="px-6 py-3.5">Package</th>
                        <th className="px-6 py-3.5">Status</th>
                        <th className="px-6 py-3.5 text-right">Agreed Price</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-cell-border text-sm text-txt-primary">
                      {filteredEnquiries.map((enquiry) => (
                        <tr
                          key={enquiry.id}
                          onClick={() => handleRowClick(enquiry.id)}
                          className="hover:bg-tbl-hover cursor-pointer transition-all duration-150 border-b border-cell-border last:border-b-0 hover:-translate-y-0.5 hover:shadow-sm"
                        >
                          <td className="px-6 py-4">
                            <div className="font-bold text-txt-primary">{enquiry.name}</div>
                            <div className="text-xs text-txt-muted mt-0.5">{enquiry.email}</div>
                          </td>
                          <td className="px-6 py-4">
                            <div className="flex items-center gap-2 text-txt-secondary font-medium">
                              <CalendarIcon className="h-4 w-4 text-txt-muted" />
                              {formatDate(enquiry.event_date)}
                            </div>
                          </td>
                          <td className="px-6 py-4 text-txt-secondary font-semibold">
                            {enquiry.location || '—'}
                          </td>
                          <td className="px-6 py-4 text-txt-secondary font-semibold">
                            {enquiry.package}
                          </td>
                          <td className="px-6 py-4">
                            <span className={`inline-flex items-center border ${getStatusBadge(enquiry.status)}`}>
                              {enquiry.status.replace('_', ' ')}
                            </span>
                          </td>
                          <td className="px-6 py-4 text-right font-bold text-txt-primary">
                            {formatPrice(enquiry.agreed_price)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Mobile Card List View */}
                <div className="space-y-4 md:hidden">
                  {filteredEnquiries.map((enquiry) => (
                    <div
                      key={enquiry.id}
                      onClick={() => handleRowClick(enquiry.id)}
                      className="bg-card-base p-5 border border-border-base rounded-[16px] hover:shadow-md hover:-translate-y-0.5 transition-all duration-150 shadow-base space-y-3 cursor-pointer"
                    >
                      <div className="flex items-start justify-between">
                        <div>
                          <h3 className="font-bold text-txt-primary text-base leading-tight">{enquiry.name}</h3>
                          <p className="text-xs text-txt-muted mt-0.5">{enquiry.email}</p>
                        </div>
                        <span className={`inline-flex items-center border ${getStatusBadge(enquiry.status)}`}>
                          {enquiry.status.replace('_', ' ')}
                        </span>
                      </div>

                      <hr className="border-border-base opacity-40" />

                      <div className="grid grid-cols-2 gap-y-2 text-xs">
                        <div>
                          <span className="text-txt-muted block mb-0.5 uppercase tracking-widest text-[9px] font-bold">Event Date</span>
                          <span className="font-bold text-txt-secondary flex items-center gap-1.5">
                            <CalendarIcon className="h-3.5 w-3.5 text-txt-muted" />
                            {formatDate(enquiry.event_date)}
                          </span>
                        </div>
                        <div>
                          <span className="text-txt-muted block mb-0.5 uppercase tracking-widest text-[9px] font-bold">Location</span>
                          <span className="font-bold text-txt-secondary truncate block">
                            {enquiry.location || '—'}
                          </span>
                        </div>
                        <div>
                          <span className="text-txt-muted block mb-0.5 uppercase tracking-widest text-[9px] font-bold">Package</span>
                          <span className="font-bold text-txt-secondary truncate block">
                            {enquiry.package}
                          </span>
                        </div>
                        <div>
                          <span className="text-txt-muted block mb-0.5 uppercase tracking-widest text-[9px] font-bold">Agreed Price</span>
                          <span className="font-extrabold text-txt-primary text-sm">
                            {formatPrice(enquiry.agreed_price)}
                          </span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        </>
      )}
    </div>
  )
}

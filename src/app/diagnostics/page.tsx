'use client'

import React, { useEffect, useState, useCallback } from 'react'
import { createClient } from '@/utils/supabase/client'
import { CheckCircle2, XCircle, Loader2, Send, Trash2, RefreshCw } from 'lucide-react'

interface CheckResult {
  label: string
  status: 'pass' | 'fail' | 'loading'
  detail?: string
}

export default function DiagnosticsPage() {
  const [checks, setChecks] = useState<CheckResult[]>([])
  const [running, setRunning] = useState(false)
  const [testResult, setTestResult] = useState<{ type: 'success' | 'error'; message: string } | null>(null)
  const [deleteResult, setDeleteResult] = useState<{ type: 'success' | 'error'; message: string } | null>(null)
  const [sendingTest, setSendingTest] = useState(false)
  const [deleting, setDeleting] = useState(false)

  const runChecks = useCallback(async () => {
    setRunning(true)
    setTestResult(null)
    setDeleteResult(null)

    const results: CheckResult[] = [
      { label: 'Environment variables are present', status: 'loading' },
      { label: 'Can connect to Supabase', status: 'loading' },
      { label: 'enquiries table exists and is reachable', status: 'loading' },
      { label: 'calendar_events table exists and is reachable', status: 'loading' },
      { label: 'bookings table exists and is reachable', status: 'loading' },
      { label: 'Current user is authenticated', status: 'loading' },
    ]
    setChecks([...results])

    // Check 1: Environment variables
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL
    const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    const urlPresent = !!url && url !== '' && !url.includes('your-project-id') && !url.includes('your-project-url') && !url.includes('placeholder')
    const keyPresent = !!key && key !== '' && key !== 'your-anon-key-here' && key !== 'your-supabase-anon-key' && key !== 'placeholder'

    if (urlPresent && keyPresent) {
      results[0] = { label: 'Environment variables are present', status: 'pass', detail: 'NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY are both set' }
    } else {
      const missing: string[] = []
      if (!urlPresent) missing.push('NEXT_PUBLIC_SUPABASE_URL')
      if (!keyPresent) missing.push('NEXT_PUBLIC_SUPABASE_ANON_KEY')
      results[0] = { label: 'Environment variables are present', status: 'fail', detail: `Missing or placeholder: ${missing.join(', ')}` }
    }
    setChecks([...results])

    // If env vars are missing, skip Supabase checks
    if (!urlPresent || !keyPresent) {
      for (let i = 1; i < results.length; i++) {
        results[i] = { ...results[i], status: 'fail', detail: 'Skipped — environment variables not configured' }
      }
      setChecks([...results])
      setRunning(false)
      return
    }

    const supabase = createClient()

    // Check 2: Basic Supabase connection
    try {
      const { error } = await supabase.from('enquiries').select('id').limit(1)
      if (error) {
        results[1] = { label: 'Can connect to Supabase', status: 'fail', detail: error.message }
      } else {
        results[1] = { label: 'Can connect to Supabase', status: 'pass', detail: 'Successfully executed a query' }
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Unknown error'
      results[1] = { label: 'Can connect to Supabase', status: 'fail', detail: message }
    }
    setChecks([...results])

    // Check 3: enquiries table
    try {
      const { error } = await supabase.from('enquiries').select('id').limit(1)
      if (error) {
        results[2] = { label: 'enquiries table exists and is reachable', status: 'fail', detail: error.message }
      } else {
        results[2] = { label: 'enquiries table exists and is reachable', status: 'pass' }
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Unknown error'
      results[2] = { label: 'enquiries table exists and is reachable', status: 'fail', detail: message }
    }
    setChecks([...results])

    // Check 4: calendar_events table
    try {
      const { error } = await supabase.from('calendar_events').select('id').limit(1)
      if (error) {
        results[3] = { label: 'calendar_events table exists and is reachable', status: 'fail', detail: error.message }
      } else {
        results[3] = { label: 'calendar_events table exists and is reachable', status: 'pass' }
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Unknown error'
      results[3] = { label: 'calendar_events table exists and is reachable', status: 'fail', detail: message }
    }
    setChecks([...results])

    // Check 5: bookings table
    try {
      const { error } = await supabase.from('bookings').select('id').limit(1)
      if (error) {
        results[4] = { label: 'bookings table exists and is reachable', status: 'fail', detail: error.message }
      } else {
        results[4] = { label: 'bookings table exists and is reachable', status: 'pass' }
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Unknown error'
      results[4] = { label: 'bookings table exists and is reachable', status: 'fail', detail: message }
    }
    setChecks([...results])

    // Check 6: Authentication
    try {
      const { data: { user }, error } = await supabase.auth.getUser()
      if (error || !user) {
        results[5] = { label: 'Current user is authenticated', status: 'fail', detail: error?.message || 'No authenticated user session found' }
      } else {
        results[5] = { label: 'Current user is authenticated', status: 'pass', detail: `Logged in as ${user.email}` }
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Unknown error'
      results[5] = { label: 'Current user is authenticated', status: 'fail', detail: message }
    }
    setChecks([...results])
    setRunning(false)
  }, [])

  useEffect(() => {
    runChecks()
  }, [runChecks])

  const handleSendTestEnquiry = async () => {
    setSendingTest(true)
    setTestResult(null)
    try {
      const supabase = createClient()
      const today = new Date().toISOString().split('T')[0]
      const { error } = await supabase.from('enquiries').insert({
        name: 'Test Enquiry — Safe to Delete',
        email: 'test@example.com',
        phone: '0000000000',
        package: 'Test Package',
        event_date: today,
        message: 'This is a test submission to verify the connection.',
        status: 'new',
      })
      if (error) {
        setTestResult({ type: 'error', message: `Insert failed: ${error.message}` })
      } else {
        setTestResult({ type: 'success', message: 'Test enquiry inserted successfully! Check your Supabase table and dashboard inbox.' })
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Unknown error'
      setTestResult({ type: 'error', message: `Unexpected error: ${message}` })
    } finally {
      setSendingTest(false)
    }
  }

  const handleDeleteTestEnquiries = async () => {
    setDeleting(true)
    setDeleteResult(null)
    try {
      const supabase = createClient()
      const { error, count } = await supabase
        .from('enquiries')
        .delete({ count: 'exact' })
        .eq('name', 'Test Enquiry — Safe to Delete')
      if (error) {
        setDeleteResult({ type: 'error', message: `Delete failed: ${error.message}` })
      } else {
        setDeleteResult({ type: 'success', message: `Deleted ${count ?? 0} test enquiry row(s).` })
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Unknown error'
      setDeleteResult({ type: 'error', message: `Unexpected error: ${message}` })
    } finally {
      setDeleting(false)
    }
  }

  const passCount = checks.filter(c => c.status === 'pass').length
  const failCount = checks.filter(c => c.status === 'fail').length

  return (
    <div className="min-h-screen bg-[#fafafa] flex items-start justify-center px-4 py-12 font-sans">
      <div className="w-full max-w-2xl">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-gray-900 tracking-tight">
            Diagnostics
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            Supabase connection health check &amp; test tools for deployment debugging.
          </p>
        </div>

        {/* Health Checks Card */}
        <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
          <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
            <div>
              <h2 className="text-sm font-semibold text-gray-900">Connection Health Checks</h2>
              {!running && checks.length > 0 && (
                <p className="text-xs text-gray-500 mt-0.5">
                  {passCount} passed · {failCount} failed
                </p>
              )}
            </div>
            <button
              onClick={runChecks}
              disabled={running}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-gray-700 bg-gray-50 border border-gray-200 rounded-lg hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${running ? 'animate-spin' : ''}`} />
              Re-run
            </button>
          </div>

          <ul className="divide-y divide-gray-100">
            {checks.map((check, i) => (
              <li key={i} className="flex items-start gap-3 px-6 py-3.5">
                <div className="mt-0.5 shrink-0">
                  {check.status === 'loading' && (
                    <Loader2 className="h-4.5 w-4.5 text-gray-400 animate-spin" />
                  )}
                  {check.status === 'pass' && (
                    <CheckCircle2 className="h-4.5 w-4.5 text-emerald-500" />
                  )}
                  {check.status === 'fail' && (
                    <XCircle className="h-4.5 w-4.5 text-red-500" />
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <p className={`text-sm font-medium ${check.status === 'fail' ? 'text-red-700' : 'text-gray-900'}`}>
                    {check.label}
                  </p>
                  {check.detail && (
                    <p className={`text-xs mt-0.5 ${check.status === 'fail' ? 'text-red-500' : 'text-gray-500'}`}>
                      {check.detail}
                    </p>
                  )}
                </div>
              </li>
            ))}
          </ul>
        </div>

        {/* Test Enquiry Tools Card */}
        <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden mt-6">
          <div className="px-6 py-4 border-b border-gray-100">
            <h2 className="text-sm font-semibold text-gray-900">Test Enquiry Tools</h2>
            <p className="text-xs text-gray-500 mt-0.5">
              Verify the full enquiry → database → dashboard pipeline.
            </p>
          </div>

          <div className="px-6 py-5 space-y-4">
            {/* Send Test Enquiry */}
            <div>
              <button
                onClick={handleSendTestEnquiry}
                disabled={sendingTest}
                className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-gray-900 rounded-lg hover:bg-gray-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {sendingTest ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Send className="h-4 w-4" />
                )}
                Send Test Enquiry
              </button>
              <p className="text-xs text-gray-400 mt-1.5">
                Inserts a row named &quot;Test Enquiry — Safe to Delete&quot; into the enquiries table.
              </p>
              {testResult && (
                <div className={`mt-2 text-xs font-medium px-3 py-2 rounded-lg ${
                  testResult.type === 'success'
                    ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                    : 'bg-red-50 text-red-700 border border-red-200'
                }`}>
                  {testResult.message}
                </div>
              )}
            </div>

            <hr className="border-gray-100" />

            {/* Delete Test Enquiries */}
            <div>
              <button
                onClick={handleDeleteTestEnquiries}
                disabled={deleting}
                className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-red-600 bg-red-50 border border-red-200 rounded-lg hover:bg-red-100 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {deleting ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Trash2 className="h-4 w-4" />
                )}
                Delete All Test Enquiries
              </button>
              <p className="text-xs text-gray-400 mt-1.5">
                Removes all rows where name = &quot;Test Enquiry — Safe to Delete&quot;.
              </p>
              {deleteResult && (
                <div className={`mt-2 text-xs font-medium px-3 py-2 rounded-lg ${
                  deleteResult.type === 'success'
                    ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                    : 'bg-red-50 text-red-700 border border-red-200'
                }`}>
                  {deleteResult.message}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Footer note */}
        <p className="text-xs text-gray-400 text-center mt-6">
          This page is for deployment debugging only. It is not linked from the main navigation.
        </p>
      </div>
    </div>
  )
}

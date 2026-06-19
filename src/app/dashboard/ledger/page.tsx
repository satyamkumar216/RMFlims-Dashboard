'use client'

import React, { useEffect, useState } from 'react'
import { createClient } from '@/utils/supabase/client'
import { isDemoMode, getDemoLedger, saveDemoLedger, insertLedgerEntry } from '@/utils/supabase/demo'
import { 
  IndianRupee, 
  TrendingUp, 
  TrendingDown, 
  Plus, 
  Search, 
  SlidersHorizontal,
  X,
  Calendar,
  AlertCircle
} from 'lucide-react'

interface LedgerEntry {
  id: string
  type: 'advance_received' | 'salary_paid' | 'expense' | 'other_income'
  amount: number
  reference_id: string | null
  description: string
  created_at: string
}

export default function LedgerPage() {
  const supabase = createClient()
  const [ledger, setLedger] = useState<LedgerEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  
  // UI State
  const [searchQuery, setSearchQuery] = useState('')
  const [typeFilter, setTypeFilter] = useState<'all' | 'income' | 'expense'>('all')
  const [showAddModal, setShowAddModal] = useState(false)
  
  // Add Transaction Form State
  const [formType, setFormType] = useState<'advance_received' | 'expense' | 'other_income'>('expense')
  const [formAmount, setFormAmount] = useState('')
  const [formDescription, setFormDescription] = useState('')
  const [formReferenceId, setFormReferenceId] = useState('')
  const [formSaving, setFormSaving] = useState(false)
  const [formError, setFormError] = useState('')

  const fetchLedger = async () => {
    setLoading(true)
    setErrorMsg(null)

    if (isDemoMode()) {
      const demoLedger = getDemoLedger() as LedgerEntry[]
      // Sort by date descending
      const sorted = [...demoLedger].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
      setLedger(sorted)
      setLoading(false)
      return
    }

    try {
      const { data, error } = await supabase
        .from('agency_cash_ledger')
        .select('*')
        .order('created_at', { ascending: false })

      if (error) {
        setErrorMsg(error.message)
      } else {
        setLedger(data || [])
      }
    } catch (err: any) {
      setErrorMsg('Failed to load cash ledger.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchLedger()
  }, [])

  // Calculates Cash In Hand
  const cashInHand = ledger.reduce((sum, item) => sum + Number(item.amount || 0), 0)
  
  // Calculates stats
  const totalIncome = ledger
    .filter(item => item.amount > 0)
    .reduce((sum, item) => sum + Number(item.amount || 0), 0)
    
  const totalExpenses = ledger
    .filter(item => item.amount < 0)
    .reduce((sum, item) => sum + Math.abs(Number(item.amount || 0)), 0)

  // Handle Form Submit
  const handleAddTransaction = async (e: React.FormEvent) => {
    e.preventDefault()
    setFormError('')
    
    const amountNum = parseFloat(formAmount)
    if (isNaN(amountNum) || amountNum <= 0) {
      setFormError('Please enter a valid amount greater than 0.')
      return
    }
    if (!formDescription.trim()) {
      setFormError('Description is required.')
      return
    }

    setFormSaving(true)
    
    // Expenses are stored as negative values, incomes are positive
    const finalAmount = formType === 'expense' ? -amountNum : amountNum

    try {
      const { error } = await insertLedgerEntry(supabase, {
        type: formType,
        amount: finalAmount,
        reference_id: formReferenceId.trim() || null,
        description: formDescription.trim()
      })

      if (error) {
        setFormError(error.message)
      } else {
        // Reset and close
        setFormAmount('')
        setFormDescription('')
        setFormReferenceId('')
        setShowAddModal(false)
        fetchLedger()
      }
    } catch (err: any) {
      setFormError('An error occurred while saving.')
    } finally {
      setFormSaving(false)
    }
  }

  // Formatting utils
  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 0
    }).format(price)
  }

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr)
    return date.toLocaleDateString('en-IN', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  const getCategoryBadge = (type: LedgerEntry['type']) => {
    switch (type) {
      case 'advance_received':
        return 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20 px-2.5 py-0.5 rounded-full text-xs font-bold border'
      case 'other_income':
        return 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20 px-2.5 py-0.5 rounded-full text-xs font-bold border'
      case 'salary_paid':
        return 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20 px-2.5 py-0.5 rounded-full text-xs font-bold border'
      case 'expense':
        return 'bg-orange-500/10 text-orange-600 dark:text-orange-400 border-orange-500/20 px-2.5 py-0.5 rounded-full text-xs font-bold border'
      default:
        return 'bg-gray-500/10 text-gray-500 border-gray-500/20 px-2.5 py-0.5 rounded-full text-xs font-bold border'
    }
  }

  const getCategoryLabel = (type: LedgerEntry['type']) => {
    return type
      .split('_')
      .map(w => w.charAt(0).toUpperCase() + w.slice(1))
      .join(' ')
  }

  // Filtered transactions
  const filteredLedger = ledger.filter(item => {
    const matchesSearch = item.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (item.reference_id && item.reference_id.toLowerCase().includes(searchQuery.toLowerCase()))
      
    const matchesType = typeFilter === 'all' ||
      (typeFilter === 'income' && item.amount > 0) ||
      (typeFilter === 'expense' && item.amount < 0)

    return matchesSearch && matchesType
  })

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-[26px] font-bold tracking-tight text-txt-primary">Cash Ledger</h1>
          <p className="text-xs text-txt-secondary mt-0.5">
            Single source of truth tracking cash flow, advances received, and staff salary payouts.
          </p>
        </div>
        <button
          onClick={() => setShowAddModal(true)}
          className="flex items-center justify-center gap-2 px-4 py-2.5 bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 text-white rounded-xl text-sm font-bold shadow-md hover:-translate-y-0.5 active:translate-y-0 transition-all cursor-pointer"
        >
          <Plus className="h-4 w-4" />
          Add Transaction
        </button>
      </div>

      {errorMsg && (
        <div className="flex items-center gap-3 p-4 bg-red-500/10 border border-red-500/20 rounded-xl text-red-500 text-sm">
          <AlertCircle className="h-5 w-5 shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* Stats Cards Row */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Cash In Hand Card - High Impact Gradient */}
        <div className="p-6 bg-gradient-to-br from-indigo-600 via-indigo-700 to-violet-800 text-white rounded-[20px] shadow-lg relative overflow-hidden flex flex-col justify-between h-40 border border-indigo-500/20">
          <div className="absolute right-[-20px] top-[-20px] h-32 w-32 bg-white/5 rounded-full blur-2xl pointer-events-none" />
          <div className="flex justify-between items-start">
            <span className="text-[13px] font-semibold tracking-wider uppercase opacity-85">Cash In Hand</span>
            <div className="p-2.5 rounded-full bg-white/10 text-white">
              <IndianRupee className="h-5 w-5" />
            </div>
          </div>
          <div>
            <h3 className="text-[34px] font-black tracking-tight leading-none">
              {formatPrice(cashInHand)}
            </h3>
            <p className="text-[11px] opacity-75 font-semibold mt-2.5 flex items-center gap-1">
              <span>●</span> single source of truth ledger sum
            </p>
          </div>
        </div>

        {/* Total Inflows Card */}
        <div className="p-6 bg-white dark:bg-card-base rounded-[20px] border border-border-base/55 shadow-[0_2px_8px_rgba(0,0,0,0.06),0_0_1px_rgba(0,0,0,0.04)] hover:shadow-md transition-all flex flex-col justify-between h-40">
          <div className="flex justify-between items-start">
            <span className="text-[13px] font-bold text-txt-secondary">Total Inflows</span>
            <div className="p-2.5 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
              <TrendingUp className="h-5 w-5" />
            </div>
          </div>
          <div>
            <h3 className="text-[28px] font-extrabold text-txt-primary leading-none">
              {formatPrice(totalIncome)}
            </h3>
            <p className="text-[11px] text-emerald-500 font-bold mt-2.5">
              Accumulated advances & other receipts
            </p>
          </div>
        </div>

        {/* Total Outflows Card */}
        <div className="p-6 bg-white dark:bg-card-base rounded-[20px] border border-border-base/55 shadow-[0_2px_8px_rgba(0,0,0,0.06),0_0_1px_rgba(0,0,0,0.04)] hover:shadow-md transition-all flex flex-col justify-between h-40">
          <div className="flex justify-between items-start">
            <span className="text-[13px] font-bold text-txt-secondary">Total Outflows</span>
            <div className="p-2.5 rounded-full bg-rose-500/10 text-rose-600 dark:text-rose-400">
              <TrendingDown className="h-5 w-5" />
            </div>
          </div>
          <div>
            <h3 className="text-[28px] font-extrabold text-txt-primary leading-none">
              {formatPrice(totalExpenses)}
            </h3>
            <p className="text-[11px] text-rose-500 font-bold mt-2.5">
              Accumulated payouts & agency expenses
            </p>
          </div>
        </div>
      </div>

      {/* Filter and Search Card */}
      <div className="flex flex-col gap-4 bg-white dark:bg-card-base p-5 rounded-[16px] border border-border-base/55 sm:flex-row sm:items-center sm:justify-between shadow-[0_2px_8px_rgba(0,0,0,0.06)]">
        {/* Search */}
        <div className="relative flex-1 max-w-md">
          <Search className="absolute top-2.5 left-3.5 h-4.5 w-4.5 text-txt-muted" />
          <input
            type="text"
            placeholder="Search transactions by description..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full rounded-lg border border-input-border bg-input-base pl-10 pr-4 py-2.5 text-sm text-txt-primary placeholder-txt-muted focus:border-txt-primary focus:outline-hidden focus:ring-1 focus:ring-txt-primary transition-all font-medium"
          />
        </div>

        {/* Filters */}
        <div className="flex items-center gap-3">
          <SlidersHorizontal className="h-4.5 w-4.5 text-txt-muted" />
          <div className="flex items-center border border-border-base/80 rounded-lg p-0.5 bg-input-base">
            <button
              onClick={() => setTypeFilter('all')}
              className={`px-3 py-1.5 text-xs font-bold rounded-md transition-all cursor-pointer ${
                typeFilter === 'all'
                  ? 'bg-card-base text-txt-primary shadow-xs border border-border-base/40'
                  : 'text-txt-secondary hover:text-txt-primary'
              }`}
            >
              All
            </button>
            <button
              onClick={() => setTypeFilter('income')}
              className={`px-3 py-1.5 text-xs font-bold rounded-md transition-all cursor-pointer ${
                typeFilter === 'income'
                  ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 shadow-xs border border-emerald-500/20'
                  : 'text-txt-secondary hover:text-txt-primary'
              }`}
            >
              Inflow
            </button>
            <button
              onClick={() => setTypeFilter('expense')}
              className={`px-3 py-1.5 text-xs font-bold rounded-md transition-all cursor-pointer ${
                typeFilter === 'expense'
                  ? 'bg-rose-500/10 text-rose-600 dark:text-rose-400 shadow-xs border border-rose-500/20'
                  : 'text-txt-secondary hover:text-txt-primary'
              }`}
            >
              Outflow
            </button>
          </div>
        </div>
      </div>

      {/* Transactions Table Card */}
      <div className="bg-white dark:bg-card-base border border-border-base/55 rounded-[16px] p-6 shadow-[0_2px_8px_rgba(0,0,0,0.06)]">
        <div className="pb-4 mb-4 border-b border-border-base/50">
          <h2 className="text-[16px] font-bold text-txt-primary">Transaction History</h2>
          <p className="text-xs text-txt-secondary mt-0.5">Audited cash log records for all operations.</p>
        </div>

        {loading ? (
          <div className="py-12 flex justify-center items-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-txt-primary"></div>
          </div>
        ) : filteredLedger.length === 0 ? (
          <div className="text-center py-16">
            <Calendar className="h-10 w-10 text-txt-muted mx-auto mb-3" />
            <h3 className="text-sm font-bold text-txt-primary">No transactions found</h3>
            <p className="text-xs text-txt-secondary mt-1">Adjust search parameters or create a transaction.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-border-base bg-tbl-header/45 text-xs font-bold text-txt-secondary uppercase tracking-wider">
                  <th className="px-6 py-3.5">Date & Time</th>
                  <th className="px-6 py-3.5">Category</th>
                  <th className="px-6 py-3.5">Description</th>
                  <th className="px-6 py-3.5">Reference ID</th>
                  <th className="px-6 py-3.5 text-right">Amount</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-cell-border text-sm text-txt-primary">
                {filteredLedger.map((item) => (
                  <tr key={item.id} className="hover:bg-tbl-hover/45 transition-colors border-b border-cell-border last:border-b-0">
                    <td className="px-6 py-4 text-xs font-semibold text-txt-secondary">
                      {formatDate(item.created_at)}
                    </td>
                    <td className="px-6 py-4">
                      <span className={getCategoryBadge(item.type)}>
                        {getCategoryLabel(item.type)}
                      </span>
                    </td>
                    <td className="px-6 py-4 font-bold text-txt-primary">
                      {item.description}
                    </td>
                    <td className="px-6 py-4 text-xs font-mono text-txt-muted truncate max-w-[120px]" title={item.reference_id || ''}>
                      {item.reference_id || '—'}
                    </td>
                    <td className={`px-6 py-4 text-right font-extrabold text-[15px] ${item.amount >= 0 ? 'text-emerald-500' : 'text-rose-500'}`}>
                      {item.amount >= 0 ? '+' : ''}{formatPrice(item.amount)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Add Transaction Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-fade-in">
          <div className="bg-card-base border border-border-base rounded-2xl w-full max-w-md overflow-hidden shadow-2xl p-6 relative animate-scale-up">
            <button
              onClick={() => setShowAddModal(false)}
              className="absolute top-4 right-4 p-2 rounded-lg hover:bg-sidebar-active/30 text-txt-muted hover:text-txt-primary transition-all cursor-pointer"
            >
              <X className="h-4 w-4" />
            </button>

            <h3 className="text-lg font-bold text-txt-primary mb-1">Add Cash Transaction</h3>
            <p className="text-xs text-txt-secondary mb-6">Manually record a cash movement in the ledger.</p>

            {formError && (
              <div className="mb-4 flex items-center gap-2 p-3 bg-red-500/10 border border-red-500/20 text-red-500 rounded-lg text-xs font-semibold">
                <AlertCircle className="h-4 w-4 shrink-0" />
                <span>{formError}</span>
              </div>
            )}

            <form onSubmit={handleAddTransaction} className="space-y-4">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-txt-secondary mb-1.5">
                  Transaction Type
                </label>
                <select
                  value={formType}
                  onChange={(e) => setFormType(e.target.value as any)}
                  className="w-full rounded-lg border border-input-border bg-input-base px-3 py-2 text-sm text-txt-primary focus:border-txt-primary focus:outline-hidden focus:ring-1 focus:ring-txt-primary cursor-pointer font-semibold"
                >
                  <option value="expense">Expense (Outflow)</option>
                  <option value="other_income">Other Income (Inflow)</option>
                  <option value="advance_received">Advance Received (Inflow)</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-txt-secondary mb-1.5">
                  Amount (₹)
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-txt-muted font-bold text-sm">
                    ₹
                  </div>
                  <input
                    type="number"
                    required
                    placeholder="Enter amount"
                    value={formAmount}
                    onChange={(e) => setFormAmount(e.target.value)}
                    className="w-full rounded-lg border border-input-border bg-input-base pl-8 pr-3 py-2 text-sm text-txt-primary placeholder-txt-muted focus:border-txt-primary focus:outline-hidden focus:ring-1 focus:ring-txt-primary font-bold"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-txt-secondary mb-1.5">
                  Description
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Lens rental, office internet, custom shoot advance"
                  value={formDescription}
                  onChange={(e) => setFormDescription(e.target.value)}
                  className="w-full rounded-lg border border-input-border bg-input-base px-3 py-2 text-sm text-txt-primary placeholder-txt-muted focus:border-txt-primary focus:outline-hidden focus:ring-1 focus:ring-txt-primary font-semibold"
                />
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-txt-secondary mb-1.5">
                  Reference ID (Optional UUID)
                </label>
                <input
                  type="text"
                  placeholder="Associated booking or request ID"
                  value={formReferenceId}
                  onChange={(e) => setFormReferenceId(e.target.value)}
                  className="w-full rounded-lg border border-input-border bg-input-base px-3 py-2 text-sm text-txt-primary placeholder-txt-muted focus:border-txt-primary focus:outline-hidden focus:ring-1 focus:ring-txt-primary font-semibold"
                />
              </div>

              <div className="pt-4 flex items-center justify-end gap-3 border-t border-border-base/50 mt-6">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-2 border border-border-base text-txt-secondary hover:text-txt-primary rounded-lg text-sm font-semibold hover:bg-sidebar-active/20 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={formSaving}
                  className="px-5 py-2 bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 text-white rounded-lg text-sm font-bold shadow-md hover:-translate-y-0.5 active:translate-y-0 transition-all cursor-pointer flex items-center gap-2"
                >
                  {formSaving ? 'Saving...' : 'Save Transaction'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}

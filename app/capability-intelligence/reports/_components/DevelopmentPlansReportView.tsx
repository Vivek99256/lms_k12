'use client'

import React, { useCallback, useEffect, useMemo, useState } from 'react'
import {
  AlertCircle,
  Calendar,
  CheckCircle2,
  Clock,
  Download,
  Filter,
  LoaderCircle,
  PauseCircle,
  Printer,
  RefreshCw,
  Search,
  Target,
  Users,
} from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { buildSessionContext, createAuthHeaders } from '@/lib/erp-client'

interface DevelopmentPlanRow {
  id: number
  title: string
  user_id: number
  jobrole?: string | null
  status: 'active' | 'completed' | 'on_hold' | 'overdue' | string
  progress: number
  start_date?: string | null
  due_date?: string | null
  completed_at?: string | null
  competency_name?: string | null
}

interface DevelopmentPlanReportData {
  total: number
  by_status: {
    active: number
    completed: number
    on_hold: number
    overdue: number
    other?: number
  }
  overdue: number
  plans: DevelopmentPlanRow[]
}

export function DevelopmentPlansReportView() {
  const [data, setData] = useState<DevelopmentPlanReportData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<string>('all')

  const fetchReport = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const session = buildSessionContext()
      const searchParams = new URLSearchParams({
        token: session.token,
        sub_institute_id: String(session.subInstituteId),
        syear: session.syear,
        user_id: String(session.userId),
        type: 'API',
      })

      const url = `${session.baseUrl}/api/competency/reports/development-plans?${searchParams.toString()}`
      const res = await fetch(url, {
        headers: createAuthHeaders(session, 'application/json'),
        cache: 'no-store',
      })

      if (!res.ok) {
        throw new Error(`Server returned HTTP ${res.status}`)
      }

      const json = await res.json()
      if (json.status === 1 && json.data) {
        setData(json.data)
      } else {
        setData({
          total: json.data?.total ?? 0,
          by_status: json.data?.by_status ?? { active: 0, completed: 0, on_hold: 0, overdue: 0 },
          overdue: json.data?.overdue ?? 0,
          plans: json.data?.plans ?? [],
        })
      }
    } catch (err) {
      console.error('Error loading development plan report:', err)
      setError(err instanceof Error ? err.message : 'Could not fetch development plan report.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void fetchReport()
  }, [fetchReport])

  const filteredPlans = useMemo(() => {
    if (!data?.plans) return []
    return data.plans.filter((p) => {
      const matchSearch =
        !search.trim() ||
        (p.title && p.title.toLowerCase().includes(search.toLowerCase())) ||
        (p.competency_name && p.competency_name.toLowerCase().includes(search.toLowerCase())) ||
        (p.jobrole && p.jobrole.toLowerCase().includes(search.toLowerCase())) ||
        String(p.user_id).includes(search.trim())

      const matchStatus = statusFilter === 'all' || p.status.toLowerCase() === statusFilter.toLowerCase()

      return matchSearch && matchStatus
    })
  }, [data?.plans, search, statusFilter])

  const exportCSV = () => {
    if (!filteredPlans.length) return
    const headers = ['ID', 'Plan Title', 'Competency', 'Job Role', 'User ID', 'Status', 'Progress (%)', 'Start Date', 'Due Date']
    const rows = filteredPlans.map((p) => [
      p.id,
      `"${(p.title || '').replace(/"/g, '""')}"`,
      `"${(p.competency_name || 'N/A').replace(/"/g, '""')}"`,
      `"${(p.jobrole || 'N/A').replace(/"/g, '""')}"`,
      p.user_id,
      p.status,
      `${p.progress}%`,
      p.start_date || 'N/A',
      p.due_date || 'N/A',
    ])
    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map((e) => e.join(','))].join('\n')
    const encodedUri = encodeURI(csvContent)
    const link = document.createElement('a')
    link.setAttribute('href', encodedUri)
    link.setAttribute('download', `capability_development_plans_${new Date().toISOString().slice(0, 10)}.csv`)
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  const handlePrint = () => {
    window.print()
  }

  const byStatus = data?.by_status ?? { active: 0, completed: 0, on_hold: 0, overdue: 0 }
  const totalPlans = data?.total ?? 0

  return (
    <div
      className="space-y-6"
      style={{
        ['--primary' as string]: '#4F46E5',
        ['--primary-foreground' as string]: '#FFFFFF',
      }}
    >
      {/* Header and Action Bar */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between rounded-2xl border border-indigo-100 bg-card p-5 shadow-xs">
        <div className="flex items-start gap-3.5">
          <span className="mt-0.5 flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-indigo-50 border border-indigo-100 text-[#4F46E5] shadow-xs">
            <Target className="h-5 w-5" />
          </span>
          <div>
            <h2 className="text-lg font-bold tracking-tight text-foreground">Development Plans & Growth Report</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Comprehensive report of active competency development plans, employee progress, and completion milestones.
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={exportCSV}
            disabled={!filteredPlans.length}
            className="h-9 gap-1.5 rounded-xl border-border bg-background hover:bg-indigo-50 hover:text-[#4F46E5] hover:border-indigo-200 text-xs font-semibold shadow-xs"
          >
            <Download className="h-4 w-4" /> Export CSV
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={handlePrint}
            className="h-9 gap-1.5 rounded-xl border-border bg-background hover:bg-indigo-50 hover:text-[#4F46E5] hover:border-indigo-200 text-xs font-semibold shadow-xs"
          >
            <Printer className="h-4 w-4" /> Print
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => void fetchReport()}
            disabled={loading}
            className="h-9 gap-1.5 rounded-xl border-border bg-background hover:bg-indigo-50 hover:text-[#4F46E5] hover:border-indigo-200 text-xs font-semibold shadow-xs"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} /> Refresh
          </Button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-5">
        <Card className="rounded-xl border border-indigo-100 hover:border-indigo-200 bg-card shadow-xs transition-colors">
          <CardContent className="p-4">
            <div className="flex items-center justify-between text-muted-foreground">
              <span className="text-xs font-semibold">Total Plans</span>
              <div className="w-8 h-8 rounded-lg bg-indigo-50 border border-indigo-100 flex items-center justify-center text-[#4F46E5]">
                <Target className="h-4 w-4" />
              </div>
            </div>
            <p className="mt-2 text-2xl font-bold text-foreground">{totalPlans}</p>
            <p className="text-[11px] text-muted-foreground">All logged plans</p>
          </CardContent>
        </Card>

        <Card className="rounded-xl border border-indigo-100 hover:border-indigo-200 bg-card shadow-xs transition-colors">
          <CardContent className="p-4">
            <div className="flex items-center justify-between text-muted-foreground">
              <span className="text-xs font-semibold">Active</span>
              <div className="w-8 h-8 rounded-lg bg-indigo-50 border border-indigo-100 flex items-center justify-center text-[#4F46E5]">
                <Clock className="h-4 w-4" />
              </div>
            </div>
            <p className="mt-2 text-2xl font-bold text-foreground">{byStatus.active || 0}</p>
            <p className="text-[11px] text-muted-foreground">In active training</p>
          </CardContent>
        </Card>

        <Card className="rounded-xl border border-indigo-100 hover:border-indigo-200 bg-card shadow-xs transition-colors">
          <CardContent className="p-4">
            <div className="flex items-center justify-between text-muted-foreground">
              <span className="text-xs font-semibold">Completed</span>
              <div className="w-8 h-8 rounded-lg bg-emerald-50 border border-emerald-100 flex items-center justify-center text-emerald-600">
                <CheckCircle2 className="h-4 w-4" />
              </div>
            </div>
            <p className="mt-2 text-2xl font-bold text-emerald-600 dark:text-emerald-400">{byStatus.completed || 0}</p>
            <p className="text-[11px] text-muted-foreground">Goals attained</p>
          </CardContent>
        </Card>

        <Card className="rounded-xl border border-indigo-100 hover:border-indigo-200 bg-card shadow-xs transition-colors">
          <CardContent className="p-4">
            <div className="flex items-center justify-between text-muted-foreground">
              <span className="text-xs font-semibold">On Hold</span>
              <div className="w-8 h-8 rounded-lg bg-amber-50 border border-amber-100 flex items-center justify-center text-amber-600">
                <PauseCircle className="h-4 w-4" />
              </div>
            </div>
            <p className="mt-2 text-2xl font-bold text-amber-600 dark:text-amber-400">{byStatus.on_hold || 0}</p>
            <p className="text-[11px] text-muted-foreground">Paused temporarily</p>
          </CardContent>
        </Card>

        <Card className="rounded-xl border border-indigo-100 hover:border-indigo-200 bg-card shadow-xs transition-colors col-span-2 sm:col-span-1">
          <CardContent className="p-4">
            <div className="flex items-center justify-between text-muted-foreground">
              <span className="text-xs font-semibold">Overdue</span>
              <div className="w-8 h-8 rounded-lg bg-rose-50 border border-rose-100 flex items-center justify-center text-rose-600">
                <AlertCircle className="h-4 w-4" />
              </div>
            </div>
            <p className="mt-2 text-2xl font-bold text-rose-600 dark:text-rose-400">{data?.overdue || byStatus.overdue || 0}</p>
            <p className="text-[11px] text-muted-foreground">Past due date</p>
          </CardContent>
        </Card>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by plan, competency, job role or staff ID..."
            className="pl-9 h-10 rounded-xl border-border bg-background focus-visible:ring-indigo-500 shadow-xs"
          />
        </div>

        <div className="flex items-center gap-2">
          <Filter className="h-4 w-4 text-muted-foreground" />
          <span className="text-xs font-medium text-muted-foreground">Status:</span>
          {['all', 'active', 'completed', 'on_hold', 'overdue'].map((s) => {
            const isActive = statusFilter === s
            return (
              <Button
                key={s}
                variant={isActive ? 'default' : 'outline'}
                size="sm"
                onClick={() => setStatusFilter(s)}
                className={`h-8 rounded-lg text-xs capitalize ${
                  isActive ? 'bg-[#4F46E5] text-white font-semibold shadow-xs hover:bg-[#4338CA]' : 'border-border text-muted-foreground hover:bg-indigo-50 hover:text-[#4F46E5]'
                }`}
              >
                {s.replace('_', ' ')}
              </Button>
            )
          })}
        </div>
      </div>

      {/* Error state */}
      {error && (
        <div
          role="alert"
          className="flex items-center gap-2 rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive"
        >
          <AlertCircle className="h-4 w-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Loading state */}
      {loading && (
        <div className="flex items-center justify-center gap-2.5 py-16 text-sm text-muted-foreground">
          <LoaderCircle className="h-5 w-5 animate-spin text-[#4F46E5]" />
          <span>Loading development plans report…</span>
        </div>
      )}

      {/* Table Data */}
      {!loading && (
        <div className="rounded-xl border border-border bg-card shadow-xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-muted/50 border-b border-border text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                <tr>
                  <th className="px-4 py-3">Plan Title</th>
                  <th className="px-4 py-3">Target Competency</th>
                  <th className="px-4 py-3">Role / Department</th>
                  <th className="px-4 py-3">Staff ID</th>
                  <th className="px-4 py-3">Progress</th>
                  <th className="px-4 py-3">Due Date</th>
                  <th className="px-4 py-3">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {filteredPlans.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-4 py-12 text-center text-sm text-muted-foreground">
                      No development plans match your search or filter criteria.
                    </td>
                  </tr>
                ) : (
                  filteredPlans.map((row) => (
                    <tr key={row.id} className="hover:bg-indigo-50/20 transition-colors">
                      <td className="px-4 py-3.5 font-medium text-foreground">
                        {row.title}
                      </td>
                      <td className="px-4 py-3.5 text-muted-foreground">
                        {row.competency_name ? (
                          <span className="inline-flex items-center gap-1.5 font-medium text-foreground">
                            <Target className="h-3.5 w-3.5 text-[#4F46E5]" />
                            {row.competency_name}
                          </span>
                        ) : (
                          <span className="italic text-xs">General skill</span>
                        )}
                      </td>
                      <td className="px-4 py-3.5 text-muted-foreground">
                        {row.jobrole || 'Not assigned'}
                      </td>
                      <td className="px-4 py-3.5 text-muted-foreground">
                        <span className="inline-flex items-center gap-1 font-mono text-xs">
                          <Users className="h-3 w-3" />
                          #{row.user_id}
                        </span>
                      </td>
                      <td className="px-4 py-3.5">
                        <div className="w-32">
                          <div className="flex items-center justify-between text-xs mb-1">
                            <span className="font-semibold text-foreground">{row.progress}%</span>
                          </div>
                          <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden">
                            <div
                              className="h-full bg-[#4F46E5] rounded-full transition-all"
                              style={{ width: `${Math.min(Math.max(row.progress, 0), 100)}%` }}
                            />
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3.5 text-muted-foreground text-xs">
                        {row.due_date ? (
                          <span className="inline-flex items-center gap-1">
                            <Calendar className="h-3.5 w-3.5" />
                            {row.due_date}
                          </span>
                        ) : (
                          'No deadline'
                        )}
                      </td>
                      <td className="px-4 py-3.5">
                        <Badge
                          variant="secondary"
                          className={`capitalize text-xs font-semibold px-2 py-0.5 rounded-md ${
                            row.status === 'completed'
                              ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
                              : row.status === 'overdue'
                              ? 'bg-rose-500/10 text-rose-600 dark:text-rose-400'
                              : row.status === 'on_hold'
                              ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400'
                              : 'bg-indigo-50 text-[#4F46E5] border border-indigo-100'
                          }`}
                        >
                          {row.status.replace('_', ' ')}
                        </Badge>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          <div className="bg-muted/30 px-4 py-3 border-t border-border flex items-center justify-between text-xs text-muted-foreground">
            <span>Showing {filteredPlans.length} of {totalPlans} plans</span>
            <span className="font-medium text-[#4F46E5]">Capability development tracker</span>
          </div>
        </div>
      )}
    </div>
  )
}

'use client'

import React, { useCallback, useEffect, useMemo, useState } from 'react'
import {
  AlertCircle,
  Award,
  CheckCircle2,
  Download,
  Filter,
  Layers,
  LoaderCircle,
  Network,
  Printer,
  RefreshCw,
  Search,
  Sparkles,
} from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import {
  buildSessionContext,
  competencyLibrariesService,
  type LibraryMeta,
} from '@/app/capability-intelligence/_lib/libraries-taxonomy-api'
import { competencyStudioService } from '@/app/capability-intelligence/_lib/framework-studio-api'

export interface SkillCoverageItem {
  id: number | string
  code?: string | null
  title?: string | null
  description?: string | null
  category?: string | null
  sub_category?: string | null
  department?: string | null
  status?: string | null
  approve_status?: string | null
  [key: string]: any
}

export function SkillCoverageReportView() {
  const [meta, setMeta] = useState<LibraryMeta | null>(null)
  const [skills, setSkills] = useState<SkillCoverageItem[]>([])
  const [studioSummary, setStudioSummary] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [search, setSearch] = useState('')
  const [categoryFilter, setCategoryFilter] = useState('all')
  const [statusFilter, setStatusFilter] = useState('all')

  const fetchData = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const session = buildSessionContext()

      const [metaRes, skillsRes, studioRes] = await Promise.allSettled([
        competencyLibrariesService.meta(session),
        competencyLibrariesService.list(session, 'skill', { per_page: 250 }),
        competencyStudioService.getSummary(session),
      ])

      if (metaRes.status === 'fulfilled' && metaRes.value.data) {
        setMeta(metaRes.value.data)
      }

      if (skillsRes.status === 'fulfilled' && skillsRes.value.data) {
        setSkills(skillsRes.value.data)
      }

      if (studioRes.status === 'fulfilled' && studioRes.value.data) {
        setStudioSummary(studioRes.value.data)
      }
    } catch (err) {
      console.error('Failed to load capability report:', err)
      setError(err instanceof Error ? err.message : 'Could not fetch capability skills.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void fetchData()
  }, [fetchData])

  const categories = useMemo(() => {
    const set = new Set<string>()
    skills.forEach((s) => {
      if (s.category && typeof s.category === 'string') {
        set.add(s.category.trim())
      }
    })
    return Array.from(set).sort()
  }, [skills])

  const filteredSkills = useMemo(() => {
    return skills.filter((s) => {
      const matchSearch =
        !search.trim() ||
        (s.title && s.title.toLowerCase().includes(search.toLowerCase())) ||
        (s.code && s.code.toLowerCase().includes(search.toLowerCase())) ||
        (s.description && s.description.toLowerCase().includes(search.toLowerCase())) ||
        (s.department && s.department.toLowerCase().includes(search.toLowerCase()))

      const matchCategory =
        categoryFilter === 'all' ||
        (s.category && s.category.toLowerCase() === categoryFilter.toLowerCase())

      const matchStatus =
        statusFilter === 'all' ||
        (s.status && s.status.toLowerCase() === statusFilter.toLowerCase()) ||
        (s.approve_status && s.approve_status.toLowerCase() === statusFilter.toLowerCase())

      return matchSearch && matchCategory && matchStatus
    })
  }, [skills, search, categoryFilter, statusFilter])

  const exportCSV = () => {
    if (!filteredSkills.length) return
    const headers = ['ID', 'Code', 'Skill Title', 'Category', 'Sub Category', 'Department', 'Status', 'Approval']
    const rows = filteredSkills.map((s) => [
      s.id,
      `"${(s.code || '').replace(/"/g, '""')}"`,
      `"${(s.title || '').replace(/"/g, '""')}"`,
      `"${(s.category || 'General').replace(/"/g, '""')}"`,
      `"${(s.sub_category || 'N/A').replace(/"/g, '""')}"`,
      `"${(s.department || 'All Departments').replace(/"/g, '""')}"`,
      s.status || 'Active',
      s.approve_status || 'Approved',
    ])
    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map((e) => e.join(','))].join('\n')
    const encodedUri = encodeURI(csvContent)
    const link = document.createElement('a')
    link.setAttribute('href', encodedUri)
    link.setAttribute('download', `capability_skill_matrix_${new Date().toISOString().slice(0, 10)}.csv`)
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  const handlePrint = () => {
    window.print()
  }

  const totalSkillsCount = meta?.counts?.skill ?? skills.length
  const totalRolesCount = meta?.counts?.jobrole ?? studioSummary?.roles_mapped ?? 0
  const activeFrameworks = studioSummary?.active_framework_count ?? studioSummary?.frameworks ?? 1

  return (
    <div
      className="space-y-6"
      style={{
        ['--primary' as string]: '#4F46E5',
        ['--primary-foreground' as string]: '#FFFFFF',
      }}
    >
      {/* Top Header Card */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between rounded-2xl border border-indigo-100 bg-card p-5 shadow-xs">
        <div className="flex items-start gap-3.5">
          <span className="mt-0.5 flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-indigo-50 border border-indigo-100 text-[#4F46E5] shadow-xs">
            <Layers className="h-5 w-5" />
          </span>
          <div>
            <h2 className="text-lg font-bold tracking-tight text-foreground">Skill Coverage & Framework Matrix</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Inventory of verified organisational capabilities, category distributions, and job role mapping coverage.
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={exportCSV}
            disabled={!filteredSkills.length}
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
            onClick={() => void fetchData()}
            disabled={loading}
            className="h-9 gap-1.5 rounded-xl border-border bg-background hover:bg-indigo-50 hover:text-[#4F46E5] hover:border-indigo-200 text-xs font-semibold shadow-xs"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} /> Refresh
          </Button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Card className="rounded-xl border border-indigo-100 hover:border-indigo-200 bg-card shadow-xs transition-colors">
          <CardContent className="p-4">
            <div className="flex items-center justify-between text-muted-foreground">
              <span className="text-xs font-semibold">Total Skills Tracked</span>
              <div className="w-8 h-8 rounded-lg bg-indigo-50 border border-indigo-100 flex items-center justify-center text-[#4F46E5]">
                <Sparkles className="h-4 w-4" />
              </div>
            </div>
            <p className="mt-2 text-2xl font-bold text-foreground">
              {Number(totalSkillsCount).toLocaleString()}
            </p>
            <p className="text-[11px] text-muted-foreground">Competency Library items</p>
          </CardContent>
        </Card>

        <Card className="rounded-xl border border-indigo-100 hover:border-indigo-200 bg-card shadow-xs transition-colors">
          <CardContent className="p-4">
            <div className="flex items-center justify-between text-muted-foreground">
              <span className="text-xs font-semibold">Job Roles Mapped</span>
              <div className="w-8 h-8 rounded-lg bg-indigo-50 border border-indigo-100 flex items-center justify-center text-[#4F46E5]">
                <Network className="h-4 w-4" />
              </div>
            </div>
            <p className="mt-2 text-2xl font-bold text-foreground">
              {Number(totalRolesCount).toLocaleString()}
            </p>
            <p className="text-[11px] text-muted-foreground">Active organizational roles</p>
          </CardContent>
        </Card>

        <Card className="rounded-xl border border-indigo-100 hover:border-indigo-200 bg-card shadow-xs transition-colors">
          <CardContent className="p-4">
            <div className="flex items-center justify-between text-muted-foreground">
              <span className="text-xs font-semibold">Active Frameworks</span>
              <div className="w-8 h-8 rounded-lg bg-emerald-50 border border-emerald-100 flex items-center justify-center text-emerald-600">
                <Layers className="h-4 w-4" />
              </div>
            </div>
            <p className="mt-2 text-2xl font-bold text-emerald-600 dark:text-emerald-400">
              {activeFrameworks}
            </p>
            <p className="text-[11px] text-muted-foreground">Published frameworks</p>
          </CardContent>
        </Card>

        <Card className="rounded-xl border border-indigo-100 hover:border-indigo-200 bg-card shadow-xs transition-colors">
          <CardContent className="p-4">
            <div className="flex items-center justify-between text-muted-foreground">
              <span className="text-xs font-semibold">Taxonomy Categories</span>
              <div className="w-8 h-8 rounded-lg bg-indigo-50 border border-indigo-100 flex items-center justify-center text-[#4F46E5]">
                <Award className="h-4 w-4" />
              </div>
            </div>
            <p className="mt-2 text-2xl font-bold text-foreground">
              {categories.length || 8}
            </p>
            <p className="text-[11px] text-muted-foreground">Skill domain clusters</p>
          </CardContent>
        </Card>
      </div>

      {/* Filter Bar */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search skills by title, code or department..."
            className="pl-9 h-10 rounded-xl border-border bg-background focus-visible:ring-indigo-500 shadow-xs"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Filter className="h-4 w-4 text-muted-foreground" />
          <span className="text-xs font-medium text-muted-foreground">Category:</span>
          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            aria-label="Filter by skill category"
            className="h-9 rounded-lg border border-border bg-background px-2.5 text-xs font-medium text-foreground focus:outline-hidden focus:ring-1 focus:ring-indigo-500"
          >
            <option value="all">All Categories ({skills.length})</option>
            {categories.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>

          <span className="text-xs font-medium text-muted-foreground ml-2">Status:</span>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            aria-label="Filter by skill approval status"
            className="h-9 rounded-lg border border-border bg-background px-2.5 text-xs font-medium text-foreground focus:outline-hidden focus:ring-1 focus:ring-indigo-500"
          >
            <option value="all">All Statuses</option>
            <option value="Active">Active</option>
            <option value="Approved">Approved</option>
            <option value="Draft">Draft</option>
          </select>
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
          <span>Loading skill & capability matrix…</span>
        </div>
      )}

      {/* Table Data */}
      {!loading && (
        <div className="rounded-xl border border-border bg-card shadow-xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-muted/50 border-b border-border text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                <tr>
                  <th className="px-4 py-3">Skill Title</th>
                  <th className="px-4 py-3">Category</th>
                  <th className="px-4 py-3">Sub-Category</th>
                  <th className="px-4 py-3">Department</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Approval</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {filteredSkills.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-4 py-12 text-center text-sm text-muted-foreground">
                      No capability skills match your search or filter criteria.
                    </td>
                  </tr>
                ) : (
                  filteredSkills.slice(0, 100).map((skill) => (
                    <tr key={skill.id} className="hover:bg-indigo-50/20 transition-colors">
                      <td className="px-4 py-3.5">
                        <div className="font-semibold text-foreground">{skill.title}</div>
                        {skill.code && <span className="font-mono text-xs text-muted-foreground">{skill.code}</span>}
                      </td>
                      <td className="px-4 py-3.5 text-muted-foreground">
                        <Badge variant="outline" className="rounded-md border-border text-xs">
                          {skill.category || 'Technical Skills'}
                        </Badge>
                      </td>
                      <td className="px-4 py-3.5 text-muted-foreground text-xs">
                        {skill.sub_category || '—'}
                      </td>
                      <td className="px-4 py-3.5 text-muted-foreground text-xs">
                        {skill.department || 'All Departments'}
                      </td>
                      <td className="px-4 py-3.5">
                        <Badge
                          variant="secondary"
                          className="bg-indigo-50 text-[#4F46E5] border border-indigo-100 text-xs font-semibold px-2 py-0.5 rounded-md"
                        >
                          {skill.status || 'Active'}
                        </Badge>
                      </td>
                      <td className="px-4 py-3.5">
                        <span className="inline-flex items-center gap-1 text-xs font-medium text-emerald-600 dark:text-emerald-400">
                          <CheckCircle2 className="h-3.5 w-3.5" />
                          {skill.approve_status || 'Approved'}
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          <div className="bg-muted/30 px-4 py-3 border-t border-border flex items-center justify-between text-xs text-muted-foreground">
            <span>
              Showing {Math.min(filteredSkills.length, 100)} of {filteredSkills.length} filtered items (Total in system: {totalSkillsCount})
            </span>
            <span className="font-medium text-[#4F46E5]">Real-time capability index</span>
          </div>
        </div>
      )}
    </div>
  )
}

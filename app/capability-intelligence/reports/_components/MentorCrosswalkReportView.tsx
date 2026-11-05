'use client'

import React, { useCallback, useEffect, useMemo, useState } from 'react'
import {
  AlertCircle,
  CheckCircle2,
  Download,
  Filter,
  GitMerge,
  LoaderCircle,
  Printer,
  RefreshCw,
  Search,
  Sparkles,
  Users,
} from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { loadMentorCrosswalk } from '@/app/career-intelligence/_lib/api'
import type { MentorCrosswalkPayload } from '@/app/career-intelligence/_lib/types'

export function MentorCrosswalkReportView() {
  const [data, setData] = useState<MentorCrosswalkPayload | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [search, setSearch] = useState('')
  const [viewFilter, setViewFilter] = useState<'all' | 'mapped' | 'unmapped'>('all')

  const fetchData = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const res = await loadMentorCrosswalk()
      setData(res)
    } catch (err) {
      console.error('Error loading mentor crosswalk report:', err)
      setError(err instanceof Error ? err.message : 'Could not fetch mentor crosswalk data.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void fetchData()
  }, [fetchData])

  const mappedItems = data?.mapped ?? []
  const unmappedItems = data?.unmapped ?? []

  const filteredMapped = useMemo(() => {
    if (!search.trim()) return mappedItems
    const q = search.toLowerCase()
    return mappedItems.filter(
      (m) =>
        (m.skill_title && m.skill_title.toLowerCase().includes(q)) ||
        (m.element_name && m.element_name.toLowerCase().includes(q)) ||
        (m.element_id && m.element_id.toLowerCase().includes(q))
    )
  }, [mappedItems, search])

  const filteredUnmapped = useMemo(() => {
    if (!search.trim()) return unmappedItems
    const q = search.toLowerCase()
    return unmappedItems.filter(
      (u) =>
        (u.title && u.title.toLowerCase().includes(q)) ||
        (u.category && u.category.toLowerCase().includes(q)) ||
        u.suggestions.some((s) => s.element_name.toLowerCase().includes(q))
    )
  }, [unmappedItems, search])

  const exportCSV = () => {
    const rows: string[][] = []
    const headers = ['Type', 'Skill Title', 'O*NET Element', 'Element Type', 'Staff Holders / Status']

    mappedItems.forEach((m) => {
      rows.push([
        'Confirmed Mapping',
        `"${(m.skill_title || `Skill #${m.skill_id}`).replace(/"/g, '""')}"`,
        `"${(m.element_name || m.element_id).replace(/"/g, '""')}"`,
        m.element_type || 'N/A',
        'Active Mapping',
      ])
    })

    unmappedItems.forEach((u) => {
      rows.push([
        'Unmapped Skill',
        `"${(u.title || '').replace(/"/g, '""')}"`,
        `"${(u.suggestions[0]?.element_name || 'No suggestion').replace(/"/g, '""')}"`,
        u.suggestions[0]?.element_type || 'N/A',
        `${u.holder_count} staff holders`,
      ])
    })

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map((e) => e.join(','))].join('\n')
    const encodedUri = encodeURI(csvContent)
    const link = document.createElement('a')
    link.setAttribute('href', encodedUri)
    link.setAttribute('download', `mentor_capability_crosswalk_${new Date().toISOString().slice(0, 10)}.csv`)
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  const handlePrint = () => {
    window.print()
  }

  return (
    <div
      className="space-y-6"
      style={{
        ['--primary' as string]: '#4F46E5',
        ['--primary-foreground' as string]: '#FFFFFF',
      }}
    >
      {/* Header Card */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between rounded-2xl border border-indigo-100 bg-card p-5 shadow-xs">
        <div className="flex items-start gap-3.5">
          <span className="mt-0.5 flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-indigo-50 border border-indigo-100 text-[#4F46E5] shadow-xs">
            <GitMerge className="h-5 w-5" />
          </span>
          <div>
            <h2 className="text-lg font-bold tracking-tight text-foreground">Mentor Skill Crosswalk Report</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Mapping status between staff skills and O*NET career capability requirements for AI mentor recommendations.
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={exportCSV}
            disabled={!mappedItems.length && !unmappedItems.length}
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

      {/* KPI Overview */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Card className="rounded-xl border border-indigo-100 hover:border-indigo-200 bg-card shadow-xs transition-colors">
          <CardContent className="p-4">
            <div className="flex items-center justify-between text-muted-foreground">
              <span className="text-xs font-semibold">Crosswalk Status</span>
              <div className="w-8 h-8 rounded-lg bg-indigo-50 border border-indigo-100 flex items-center justify-center text-[#4F46E5]">
                <Sparkles className="h-4 w-4" />
              </div>
            </div>
            <p className="mt-2 text-xl font-bold text-foreground">
              {data?.crosswalk_ready ? 'Operational' : 'Initializing'}
            </p>
            <p className="text-[11px] text-muted-foreground">O*NET crosswalk bridge</p>
          </CardContent>
        </Card>

        <Card className="rounded-xl border border-indigo-100 hover:border-indigo-200 bg-card shadow-xs transition-colors">
          <CardContent className="p-4">
            <div className="flex items-center justify-between text-muted-foreground">
              <span className="text-xs font-semibold">Confirmed Mappings</span>
              <div className="w-8 h-8 rounded-lg bg-emerald-50 border border-emerald-100 flex items-center justify-center text-emerald-600">
                <CheckCircle2 className="h-4 w-4" />
              </div>
            </div>
            <p className="mt-2 text-2xl font-bold text-emerald-600 dark:text-emerald-400">
              {mappedItems.length}
            </p>
            <p className="text-[11px] text-muted-foreground">Verified skill elements</p>
          </CardContent>
        </Card>

        <Card className="rounded-xl border border-indigo-100 hover:border-indigo-200 bg-card shadow-xs transition-colors">
          <CardContent className="p-4">
            <div className="flex items-center justify-between text-muted-foreground">
              <span className="text-xs font-semibold">Unmapped Skills</span>
              <div className="w-8 h-8 rounded-lg bg-indigo-50 border border-indigo-100 flex items-center justify-center text-[#4F46E5]">
                <Users className="h-4 w-4" />
              </div>
            </div>
            <p className="mt-2 text-2xl font-bold text-foreground">
              {unmappedItems.length}
            </p>
            <p className="text-[11px] text-muted-foreground">Awaiting HR confirmation</p>
          </CardContent>
        </Card>

        <Card className="rounded-xl border border-indigo-100 hover:border-indigo-200 bg-card shadow-xs transition-colors">
          <CardContent className="p-4">
            <div className="flex items-center justify-between text-muted-foreground">
              <span className="text-xs font-semibold">Readiness Index</span>
              <div className="w-8 h-8 rounded-lg bg-indigo-50 border border-indigo-100 flex items-center justify-center text-[#4F46E5]">
                <GitMerge className="h-4 w-4" />
              </div>
            </div>
            <p className="mt-2 text-2xl font-bold text-[#4F46E5]">
              {mappedItems.length + unmappedItems.length > 0
                ? `${Math.round((mappedItems.length / (mappedItems.length + unmappedItems.length)) * 100)}%`
                : '100%'}
            </p>
            <p className="text-[11px] text-muted-foreground">Coverage proportion</p>
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
            placeholder="Search skills, elements or categories..."
            className="pl-9 h-10 rounded-xl border-border bg-background focus-visible:ring-indigo-500 shadow-xs"
          />
        </div>

        <div className="flex items-center gap-2">
          <Filter className="h-4 w-4 text-muted-foreground" />
          <span className="text-xs font-medium text-muted-foreground">View:</span>
          {(['all', 'mapped', 'unmapped'] as const).map((mode) => {
            const isActive = viewFilter === mode
            return (
              <Button
                key={mode}
                variant={isActive ? 'default' : 'outline'}
                size="sm"
                onClick={() => setViewFilter(mode)}
                className={`h-8 rounded-lg text-xs capitalize ${
                  isActive ? 'bg-[#4F46E5] text-white font-semibold shadow-xs hover:bg-[#4338CA]' : 'border-border text-muted-foreground hover:bg-indigo-50 hover:text-[#4F46E5]'
                }`}
              >
                {mode === 'all'
                  ? `All Records (${mappedItems.length + unmappedItems.length})`
                  : mode === 'mapped'
                  ? `Confirmed (${mappedItems.length})`
                  : `Unmapped (${unmappedItems.length})`}
              </Button>
            )
          })}
        </div>
      </div>

      {/* Error callout */}
      {error && (
        <div
          role="alert"
          className="flex items-center gap-2 rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive"
        >
          <AlertCircle className="h-4 w-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Loading */}
      {loading && (
        <div className="flex items-center justify-center gap-2.5 py-16 text-sm text-muted-foreground">
          <LoaderCircle className="h-5 w-5 animate-spin text-[#4F46E5]" />
          <span>Loading mentor crosswalk report…</span>
        </div>
      )}

      {/* Tables */}
      {!loading && (
        <div className="space-y-6">
          {/* Confirmed Section */}
          {(viewFilter === 'all' || viewFilter === 'mapped') && (
            <div className="rounded-xl border border-border bg-card shadow-xs overflow-hidden">
              <div className="bg-indigo-50/40 px-4 py-3 border-b border-indigo-100 flex items-center justify-between">
                <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                  Confirmed Skill Mappings ({filteredMapped.length})
                </h3>
                <span className="text-xs text-muted-foreground font-medium">Verified for Career Counseling suggestions</span>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="bg-muted/20 border-b border-border text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                    <tr>
                      <th className="px-4 py-2.5">Staff Skill</th>
                      <th className="px-4 py-2.5">Mapped O*NET Career Element</th>
                      <th className="px-4 py-2.5">Element Type</th>
                      <th className="px-4 py-2.5">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {filteredMapped.length === 0 ? (
                      <tr>
                        <td colSpan={4} className="px-4 py-8 text-center text-xs text-muted-foreground">
                          No confirmed mappings match your search.
                        </td>
                      </tr>
                    ) : (
                      filteredMapped.map((mapping) => (
                        <tr key={mapping.id} className="hover:bg-indigo-50/20 transition-colors">
                          <td className="px-4 py-3 font-semibold text-foreground">
                            {mapping.skill_title ?? `Skill #${mapping.skill_id}`}
                          </td>
                          <td className="px-4 py-3 text-foreground font-medium">
                            {mapping.element_name ?? mapping.element_id}
                          </td>
                          <td className="px-4 py-3 text-xs text-muted-foreground">
                            <span className="rounded-md bg-muted px-2 py-0.5">
                              {mapping.element_type || 'Skill/Knowledge'}
                            </span>
                          </td>
                          <td className="px-4 py-3">
                            <Badge
                              variant="secondary"
                              className="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 text-xs font-semibold px-2 py-0.5 rounded-md"
                            >
                              Active
                            </Badge>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Unmapped Section */}
          {(viewFilter === 'all' || viewFilter === 'unmapped') && (
            <div className="rounded-xl border border-border bg-card shadow-xs overflow-hidden">
              <div className="bg-indigo-50/40 px-4 py-3 border-b border-indigo-100 flex items-center justify-between">
                <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
                  <Users className="h-4 w-4 text-[#4F46E5]" />
                  Unmapped Staff Skills ({filteredUnmapped.length})
                </h3>
                <span className="text-xs text-muted-foreground font-medium">Skills held by staff needing alignment</span>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="bg-muted/20 border-b border-border text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                    <tr>
                      <th className="px-4 py-2.5">Staff Skill</th>
                      <th className="px-4 py-2.5">Category</th>
                      <th className="px-4 py-2.5">Staff Holders</th>
                      <th className="px-4 py-2.5">Top Suggested O*NET Element</th>
                      <th className="px-4 py-2.5">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {filteredUnmapped.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="px-4 py-8 text-center text-xs text-muted-foreground">
                          No unmapped skills match your search.
                        </td>
                      </tr>
                    ) : (
                      filteredUnmapped.map((skill) => {
                        const topSug = skill.suggestions[0]
                        return (
                          <tr key={skill.id} className="hover:bg-indigo-50/20 transition-colors">
                            <td className="px-4 py-3 font-semibold text-foreground">
                              {skill.title}
                            </td>
                            <td className="px-4 py-3 text-xs text-muted-foreground">
                              {skill.category || 'General'}
                            </td>
                            <td className="px-4 py-3 text-xs text-muted-foreground">
                              <span className="inline-flex items-center gap-1 font-semibold text-foreground">
                                <Users className="h-3 w-3 text-[#4F46E5]" />
                                {skill.holder_count}
                              </span>
                            </td>
                            <td className="px-4 py-3 text-xs text-foreground">
                              {topSug ? (
                                <span className="inline-flex items-center gap-1.5">
                                  <span className="font-medium text-[#4F46E5]">{topSug.element_name}</span>
                                  <span className="text-muted-foreground">
                                    ({Math.round(topSug.similarity * 100)}% match)
                                  </span>
                                </span>
                              ) : (
                                <span className="text-muted-foreground italic">None proposed</span>
                              )}
                            </td>
                            <td className="px-4 py-3">
                              <Badge
                                variant="secondary"
                                className="bg-indigo-50 text-[#4F46E5] border border-indigo-100 text-xs font-semibold px-2 py-0.5 rounded-md"
                              >
                                Pending Review
                              </Badge>
                            </td>
                          </tr>
                        )
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

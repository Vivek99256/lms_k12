'use client'

import { useMemo, useState, type ReactNode } from 'react'
import { Download, Search } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { BLUE_THEME } from '../../_lib/blue-theme'

export interface ReportColumn {
  key: string
  label: string
}

export type ReportRow = Record<string, string>

export interface ReportKpi {
  label: string
  value: string | number
  hint?: string
}

function toCsv(columns: ReportColumn[], rows: ReportRow[]): string {
  const cell = (value: string) => `"${value.replace(/"/g, '""')}"`
  return [
    columns.map((column) => cell(column.label)).join(','),
    ...rows.map((row) => columns.map((column) => cell(row[column.key] ?? '')).join(',')),
  ].join('\r\n')
}

/**
 * Shared layout for the Organization Management reports: KPI strip, filters slot,
 * search box, table and CSV export of exactly the rows on screen. Each report only
 * supplies its own data, columns and filters.
 */
export function ReportShell({
  title,
  description,
  fileName,
  columns,
  rows,
  kpis,
  filters,
  loading,
  error,
  emptyText = 'No records match these filters.',
}: {
  title: string
  description: string
  fileName: string
  columns: ReportColumn[]
  rows: ReportRow[]
  kpis: ReportKpi[]
  filters?: ReactNode
  loading: boolean
  error: string | null
  emptyText?: string
}) {
  const [term, setTerm] = useState('')

  const shown = useMemo(() => {
    const needle = term.trim().toLowerCase()
    if (!needle) return rows
    return rows.filter((row) => columns.some((column) => (row[column.key] ?? '').toLowerCase().includes(needle)))
  }, [rows, columns, term])

  function exportCsv() {
    const blob = new Blob(['﻿' + toCsv(columns, shown)], { type: 'text/csv;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `${fileName}-${new Date().toISOString().slice(0, 10)}.csv`
    link.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div style={BLUE_THEME} className="w-full space-y-6 p-6 md:p-8">
      <div>
        <h1 className="text-xl font-semibold tracking-tight text-foreground">{title}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{description}</p>
      </div>

      {error ? (
        <div role="alert" className="rounded-lg border border-destructive/20 bg-destructive/5 px-4 py-3 text-sm text-destructive">
          {error}
        </div>
      ) : null}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {kpis.map((kpi) => (
          <div key={kpi.label} className="rounded-xl border bg-card p-4 shadow-sm">
            <div className="text-sm text-muted-foreground">{kpi.label}</div>
            <div className="mt-1 text-2xl font-bold text-foreground">{loading ? '…' : kpi.value}</div>
            {kpi.hint ? <div className="mt-1 text-xs text-muted-foreground">{kpi.hint}</div> : null}
          </div>
        ))}
      </div>

      <section className="overflow-hidden rounded-xl border bg-card shadow-sm">
        <div className="flex flex-wrap items-end gap-3 border-b bg-muted/20 p-4">
          {filters}
          <div className="relative min-w-52 flex-1">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <input
              type="text"
              value={term}
              onChange={(event) => setTerm(event.target.value)}
              placeholder="Search this report..."
              aria-label="Search this report"
              className="h-9 w-full rounded-md border border-input bg-background pl-9 pr-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            />
          </div>
          <Button onClick={exportCsv} disabled={loading || shown.length === 0}>
            <Download className="mr-2 h-4 w-4" /> Export CSV
          </Button>
        </div>

        <div className="max-h-[60vh] overflow-auto">
          <table className="w-full text-left text-sm">
            <thead className="sticky top-0 border-b bg-muted/40 text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                {columns.map((column) => (
                  <th key={column.key} className="whitespace-nowrap px-4 py-2.5 font-semibold">
                    {column.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-border/50">
              {loading ? (
                <tr>
                  <td colSpan={columns.length} className="px-4 py-10 text-center text-muted-foreground">
                    Loading report...
                  </td>
                </tr>
              ) : shown.length === 0 ? (
                <tr>
                  <td colSpan={columns.length} className="px-4 py-10 text-center text-muted-foreground">
                    {emptyText}
                  </td>
                </tr>
              ) : (
                shown.map((row, index) => (
                  <tr key={index} className="hover:bg-muted/30">
                    {columns.map((column) => (
                      <td key={column.key} className="px-4 py-2.5 text-foreground">
                        {row[column.key] || '-'}
                      </td>
                    ))}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        <div className="border-t px-4 py-2 text-xs text-muted-foreground">
          {loading ? '' : `${shown.length} of ${rows.length} record${rows.length === 1 ? '' : 's'}`}
        </div>
      </section>
    </div>
  )
}

export function FilterSelect({
  label,
  value,
  onChange,
  options,
}: {
  label: string
  value: string
  onChange: (value: string) => void
  options: Array<{ value: string; label: string }>
}) {
  return (
    <label className="flex flex-col gap-1 text-xs font-medium text-muted-foreground">
      {label}
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="h-9 min-w-40 rounded-md border border-input bg-background px-2 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <option value="">All</option>
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  )
}

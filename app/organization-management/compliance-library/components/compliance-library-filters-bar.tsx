'use client'

/**
 * Server-side filter bar for the Compliance Register - Compliance
 * Management, frontend-completion pass. Replaces the old per-column
 * client-side text filters (which searched only the already-loaded page)
 * with dropdowns/date range that get sent to the backend's `applyFilters()`
 * (`ComplianceLibraryController`), matching the product brief's "call the
 * actual backend APIs, do not filter only the already-loaded array" (§6).
 */

import { Search, X } from 'lucide-react'
import { Button } from '@/components/ui/g2g/button'
import { DatePicker } from '@/components/ui/date-picker'
import { Input } from '@/components/ui/g2g/input'
import { Select } from '@/components/ui/g2g/select'
import type { ComplianceCategoryOption, ComplianceDepartmentOption, ComplianceFilters } from '../../_lib/compliance-library-api'
import { frequencySelectOptions, prioritySelectOptions, statusSelectOptions, toIsoDate } from './compliance-library-management-shared'

export function ComplianceLibraryFiltersBar({
  filters,
  categoryOptions,
  departmentOptions,
  onChange,
  onClear,
}: {
  filters: ComplianceFilters
  categoryOptions: ComplianceCategoryOption[]
  departmentOptions: ComplianceDepartmentOption[]
  onChange: (next: Partial<ComplianceFilters>) => void
  onClear: () => void
}) {
  const hasActiveFilters = Boolean(
    filters.search || filters.category_id || filters.department_id || filters.status ||
    filters.priority || filters.frequency || filters.due_date_from || filters.due_date_to,
  )

  const withAllOption = (label: string, options: { label: string; value: string }[]) => [
    { label, value: '' },
    ...options,
  ]

  return (
    <div className="flex flex-wrap items-end gap-2 rounded-xl border border-border/70 bg-background/60 p-3">
      <div className="relative min-w-[200px] flex-1">
        <Search className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
        <Input
          aria-label="Search compliance records"
          className="pl-8"
          placeholder="Search by name, description, department..."
          value={filters.search ?? ''}
          onChange={(event) => onChange({ search: event.target.value })}
        />
      </div>

      <div className="min-w-[150px]">
        <Select
          value={filters.category_id ?? ''}
          onChange={(value) => onChange({ category_id: value })}
          options={withAllOption('All Categories', categoryOptions)}
          placeholder="Category"
        />
      </div>

      <div className="min-w-[150px]">
        <Select
          value={filters.department_id ?? ''}
          onChange={(value) => onChange({ department_id: value })}
          options={withAllOption('All Departments', departmentOptions)}
          placeholder="Department"
        />
      </div>

      <div className="min-w-[150px]">
        <Select
          value={filters.status ?? ''}
          onChange={(value) => onChange({ status: value })}
          options={withAllOption('All Statuses', statusSelectOptions)}
          placeholder="Status"
        />
      </div>

      <div className="min-w-[130px]">
        <Select
          value={filters.priority ?? ''}
          onChange={(value) => onChange({ priority: value })}
          options={withAllOption('All Priorities', prioritySelectOptions)}
          placeholder="Priority"
        />
      </div>

      <div className="min-w-[140px]">
        <Select
          value={filters.frequency ?? ''}
          onChange={(value) => onChange({ frequency: value })}
          options={withAllOption('All Frequencies', frequencySelectOptions)}
          placeholder="Frequency"
        />
      </div>

      <div className="min-w-[140px]">
        <DatePicker
          value={filters.due_date_from ?? ''}
          onChange={(date) => onChange({ due_date_from: toIsoDate(date) })}
          placeholder="Due from"
        />
      </div>
      <div className="min-w-[140px]">
        <DatePicker
          value={filters.due_date_to ?? ''}
          onChange={(date) => onChange({ due_date_to: toIsoDate(date) })}
          placeholder="Due to"
        />
      </div>

      {hasActiveFilters && (
        <Button variant="ghost" size="sm" className="gap-1.5 text-muted-foreground" onClick={onClear}>
          <X className="size-3.5" /> Clear filters
        </Button>
      )}
    </div>
  )
}

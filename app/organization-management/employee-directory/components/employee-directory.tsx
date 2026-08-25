'use client'

/**
 * Ported as-is from G2G's `components/domain/organization/
 * employee-directory.tsx`.
 *
 * - The inline `fetchEmployees` effect (`hasStoredEmployeeSession` +
 *   `resolveWebBaseUrl()` + `/user/add_user`) is replaced by
 *   `useEmployeeDirectory()` (`../../_lib/use-employee-directory.ts`), which
 *   calls the new `/organization-management/employee-directory` endpoint
 *   through this project's `buildSessionContext()`/`erp-client.ts` transport
 *   instead of G2G's raw `fetch` + `localStorage.getItem('userData')`. The
 *   default mock rows and "loading only if a session exists" behavior are
 *   unchanged (see the hook).
 * - `@/components/ui/data-table`, `@/components/ui/filter-bar` ->
 *   `@/components/ui/g2g/data-table`, `@/components/ui/g2g/filter-bar` (not
 *   present natively - see those files' header comments).
 * - `@/components/ui/button`, `@/components/ui/card`,
 *   `@/components/ui/dropdown-menu` -> the shared `@/components/ui/g2g/*`
 *   copies (same reasoning as every other ported G2G screen).
 * - `@/components/ui/status-badge` is the native primitive, byte-identical
 *   to G2G's.
 * - `@/types/employee` -> `../../_lib/organization-types`.
 * - The lazy-loaded sheets module now points at the local
 *   `./employee-directory-sheets`.
 *
 * Classes/markup/behavior unchanged.
 */

import * as React from 'react'
import { lazy, Suspense } from 'react'
import {
  Plus,
  Download,
  Upload,
  MoreHorizontal,
  User,
  ShieldAlert,
  UserPlus,
  Target,
  AlertCircle,
} from 'lucide-react'
import { DataTable, type Column } from '@/components/ui/g2g/data-table'
import { FilterBar, type Filter } from '@/components/ui/g2g/filter-bar'
import { Button } from '@/components/ui/g2g/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/g2g/card'
import { StatusBadge } from '@/components/ui/status-badge'
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator } from '@/components/ui/g2g/dropdown-menu'
import { useEmployeeDirectory } from '../../_lib/use-employee-directory'
import type { Employee } from '../../_lib/organization-types'

const LazyEmployeeDirectorySheets = lazy(() =>
  import('./employee-directory-sheets').then((module) => ({
    default: module.EmployeeDirectorySheets,
  })),
)

type PulseCardData = {
  id: string
  title: string
  value: string | number
  subtitle: string
  icon: React.ElementType
}

const PAGE_SIZE = 10

export function EmployeeDirectory() {
  const [searchQuery, setSearchQuery] = React.useState('')
  const [departmentFilter, setDepartmentFilter] = React.useState('')
  const [jobRoleFilter, setJobRoleFilter] = React.useState('')
  const [statusFilter, setStatusFilter] = React.useState('')
  const [page, setPage] = React.useState(1)
  const [selectedIds, setSelectedIds] = React.useState<string[]>([])
  const [isAddSheetOpen, setIsAddSheetOpen] = React.useState(false)
  const [activeEmployee, setActiveEmployee] = React.useState<Employee | null>(null)

  // Debounce free-text search so it doesn't re-fetch on every keystroke; the
  // other filters already only change on discrete selection, so they don't
  // need debouncing.
  const [debouncedSearch, setDebouncedSearch] = React.useState('')
  React.useEffect(() => {
    const timeout = setTimeout(() => setDebouncedSearch(searchQuery), 300)
    return () => clearTimeout(timeout)
  }, [searchQuery])

  // Reset to page 1 whenever any filter/search value changes, so the user
  // never lands on a now-out-of-range page for the new result set.
  React.useEffect(() => {
    setPage(1)
  }, [debouncedSearch, departmentFilter, jobRoleFilter, statusFilter])

  // Department/Job Role/Status/Search are all sent to the API as query params
  // (department_id, jobrole_id, active_status, search) and re-fetch the table
  // server-side - they used to be compared client-side against hardcoded mock
  // option lists, which never matched real data and made every filter appear
  // broken. Search moved server-side too (previously client-only) so that
  // pagination totals stay correct when it's combined with the other filters.
  const { employeesData, loading, error, departments, jobRoles, pagination } = useEmployeeDirectory({
    department_id: departmentFilter,
    jobrole_id: jobRoleFilter,
    active_status: statusFilter === 'active' ? '1' : statusFilter === 'inactive' ? '0' : '',
    search: debouncedSearch,
    page: String(page),
    per_page: String(PAGE_SIZE),
  })

  const filters: Filter[] = React.useMemo(() => [
    {
      id: 'search',
      label: 'Search Employee',
      type: 'search',
      value: searchQuery,
      onChange: (value) => setSearchQuery(value as string),
    },
    {
      id: 'department',
      label: 'Department',
      type: 'select',
      value: departmentFilter,
      onChange: (value) => setDepartmentFilter(value as string),
      options: departments.map((d) => ({ id: d.id, label: d.label, value: d.value })),
      // Same treatment as Job Role below - department names can also run
      // past 150 characters, so widen the trigger/panel and wrap option
      // labels instead of truncating or horizontally scrolling them.
      triggerClassName: 'w-64',
      minPanelWidthPx: 520,
      panelClassName: 'max-h-96',
      wrapOptionLabels: true,
    },
    {
      id: 'jobrole',
      label: 'Job Role',
      type: 'select',
      value: jobRoleFilter,
      onChange: (value) => setJobRoleFilter(value as string),
      options: jobRoles.map((r) => ({ id: r.id, label: r.label, value: r.value })),
      // Job role names run far longer than department/status labels - some
      // exceed 150 characters, too long to fit on one line at any reasonable
      // panel width. Widen the trigger/panel substantially (clamped to the
      // viewport by Select itself) and let labels wrap onto multiple lines
      // instead of a single truncated/horizontally-scrolling line. Other
      // filters keep the default single-line sizing.
      triggerClassName: 'w-64',
      minPanelWidthPx: 520,
      panelClassName: 'max-h-96',
      wrapOptionLabels: true,
    },
    {
      id: 'status',
      label: 'Status',
      type: 'select',
      value: statusFilter,
      onChange: (value) => setStatusFilter(value as string),
      options: [
        { id: 'active', label: 'Active', value: 'active' },
        { id: 'inactive', label: 'Inactive', value: 'inactive' },
      ],
    },
  ], [searchQuery, departmentFilter, jobRoleFilter, statusFilter, departments, jobRoles])

  // Department/Job Role/Status/Search are all applied server-side now (see the
  // hook call above) and the response is already paginated - render it as-is.
  const pageData = employeesData

  const pulseCards = React.useMemo<PulseCardData[]>(() => {
    // These stats scan `employeesData`, which is now one page (10 rows) rather
    // than the full result set once pagination is in play - "total workforce"
    // uses the server-reported `pagination.total` so that figure stays
    // accurate; the other counts/percentages below are current-page snapshots
    // (a reasonable trade-off vs. adding a separate tenant-wide analytics
    // fetch, which is out of scope for adding pagination).
    const totalWorkforce = pagination?.total ?? employeesData.length
    const totalActive = employeesData.filter((employee) => employee.status?.toLowerCase() === 'active').length
    const totalInactive = employeesData.filter((employee) => employee.status?.toLowerCase() !== 'active').length
    const complianceAtRisk = employeesData.filter((employee) => !employee.email || employee.email === 'N/A' || !employee.mobile || employee.mobile === 'N/A' || !employee.department_name || employee.department_name === 'N/A').length
    const pendingOnboarding = employeesData.filter((employee) => !employee.jobRole || employee.jobRole === 'N/A' || !employee.designation || employee.designation === 'N/A').length
    const skillDeficit = employeesData.filter((employee) => !employee.skills || employee.skills.length === 0 || !employee.profile_name || employee.profile_name === 'Unknown').length

    return [
      { id: 'active-headcount', title: 'Active Headcount', value: loading ? '—' : totalActive, subtitle: loading ? 'Calculating...' : `${totalInactive} inactive on this page · ${totalWorkforce} total workforce`, icon: User },
      { id: 'compliance-risk', title: 'Compliance At Risk', value: loading ? '—' : complianceAtRisk, subtitle: loading ? 'Scanning...' : `${complianceAtRisk} employee${complianceAtRisk !== 1 ? 's' : ''} missing critical profile data`, icon: ShieldAlert },
      { id: 'pending-onboarding', title: 'Pending Onboarding', value: loading ? '—' : pendingOnboarding, subtitle: loading ? 'Checking...' : `${pendingOnboarding} employee${pendingOnboarding !== 1 ? 's' : ''} awaiting role assignment`, icon: UserPlus },
      { id: 'skill-deficit', title: 'Skill Deficit', value: loading ? '—' : employeesData.length > 0 ? `${Math.round((skillDeficit / employeesData.length) * 100)}%` : '0%', subtitle: loading ? 'Analyzing...' : `${skillDeficit} of ${employeesData.length} employees lack competency mapping`, icon: Target },
    ]
  }, [employeesData, loading])

  const columns: Column<Employee>[] = React.useMemo(() => [
    {
      id: 'full_name',
      header: 'Employee',
      render: (_, row) => (
        <div className="flex items-center gap-3">
          {row.image ? (
            // eslint-disable-next-line @next/next/no-img-element -- External URLs may not work with next/image
            <img src={row.image} alt={row.full_name} className="size-10 rounded-full border border-border object-cover" />
          ) : (
            <div className="flex size-10 shrink-0 items-center justify-center rounded-full border border-primary/20 bg-primary/10 text-primary">
              <User className="size-5" />
            </div>
          )}
          <div className="flex flex-col">
            <span className="font-semibold text-foreground">{row.full_name}</span>
            <span className="text-xs text-muted-foreground">{row.email}</span>
          </div>
        </div>
      ),
    },
    {
      id: 'department_name',
      header: 'Department',
      render: (_, row) => <span className="text-sm font-medium">{row.department_name}</span>,
    },
    {
      id: 'jobRole',
      header: 'Job Role',
      render: (_, row) => <span className="text-sm font-medium text-muted-foreground">{row.jobRole}</span>,
    },
    {
      id: 'status',
      header: 'Status',
      render: (value) => {
        const status = String(value)
        const variant = status.toLowerCase() === 'active' ? 'active' : status.toLowerCase() === 'inactive' ? 'inactive' : 'default'
        return <StatusBadge status={status} variant={variant as any} className="capitalize" />
      },
    },
    {
      id: 'id',
      header: 'Action',
      width: '16',
      render: (_, row) => (
        <div className="relative flex justify-start" onClick={(event) => event.stopPropagation()}>
          <DropdownMenu>
            <DropdownMenuTrigger className="inline-flex h-8 w-8 cursor-pointer items-center justify-center rounded-md outline-none transition-colors hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring">
              <MoreHorizontal className="h-4 w-4 text-muted-foreground" />
            </DropdownMenuTrigger>
            <DropdownMenuContent className="absolute right-0 mt-1 w-48">
              <DropdownMenuItem onClick={() => setActiveEmployee(row)} className="cursor-pointer">
                <User className="mr-2 h-4 w-4" /> View Profile
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem className="cursor-pointer text-destructive focus-visible:bg-destructive/10">
                <ShieldAlert className="mr-2 h-4 w-4" /> Suspend Access
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      ),
    },
  ], [])

  return (
    <div className="animate-in fade-in slide-in-from-bottom-4 space-y-6 duration-500 ease-out">
      {error && (
        <div className="flex items-center gap-2 rounded-lg border border-destructive/20 bg-destructive/5 px-4 py-3 text-sm text-destructive">
          <AlertCircle className="h-4 w-4 shrink-0" />
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {pulseCards.map((card, index) => {
          const Icon = card.icon
          return (
            <Card key={card.id} className="animate-in fade-in slide-in-from-bottom-3" style={{ animationDelay: `${index * 80}ms`, animationFillMode: 'both' }}>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">{card.title}</CardTitle>
                <Icon className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{card.value}</div>
                <p className="text-xs text-muted-foreground">{card.subtitle}</p>
              </CardContent>
            </Card>
          )
        })}
      </div>

      <div className="flex flex-col items-start justify-between gap-4 rounded-2xl border border-border/50 bg-card/50 p-4 shadow-xs backdrop-blur-xl sm:flex-row sm:items-center">
        <div className="flex items-center gap-3">
          <div className="flex size-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <User className="size-5" />
          </div>
          <div>
            <h2 className="text-base font-semibold text-foreground">Total Employees</h2>
            <p className="text-xs text-muted-foreground">{loading ? 'Loading...' : `${pagination?.total ?? pageData.length} total members`}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" className="hidden cursor-pointer sm:flex">
            <Upload className="mr-2 h-4 w-4" /> Import
          </Button>
          <Button variant="ghost" size="sm" className="hidden cursor-pointer sm:flex">
            <Download className="mr-2 h-4 w-4" /> Export
          </Button>
          <div className="mx-2 hidden h-6 w-px bg-border sm:block" />
          <Button size="sm" onClick={() => setIsAddSheetOpen(true)} className="cursor-pointer rounded-md px-5 shadow-sm">
            <Plus className="mr-2 h-4 w-4" /> Add Employee
          </Button>
        </div>
      </div>

      <Card className="rounded-2xl border-border/50 bg-card/50 shadow-xs backdrop-blur-sm">
        <div className="border-b border-border/40 bg-surface-muted/30 p-4">
          <FilterBar filters={filters} onReset={() => {
            setSearchQuery('')
            setDepartmentFilter('')
            setJobRoleFilter('')
            setStatusFilter('')
          }} />
        </div>
        <CardContent className="p-0">
          <DataTable
            columns={columns}
            data={pageData}
            isLoading={loading}
            selectable
            selectedIds={selectedIds}
            onSelectChange={setSelectedIds}
            onRowClick={(row) => setActiveEmployee(row)}
            emptyState={
              <div className="flex flex-col items-center gap-1 py-6 text-center">
                <p className="font-medium text-foreground">No Data Found</p>
                <p className="text-sm text-muted-foreground">
                  No employees match the selected filters. Try adjusting or resetting them.
                </p>
              </div>
            }
            pagination={
              pagination
                ? {
                    page: pagination.current_page,
                    pageSize: pagination.per_page,
                    total: pagination.total,
                    onPageChange: setPage,
                    entityLabel: 'employees',
                  }
                : undefined
            }
            className="overflow-visible rounded-none border-0 [&_th]:bg-transparent [&_th]:text-xs [&_th]:font-semibold [&_th]:uppercase [&_th]:tracking-wider [&_td]:py-4"
          />
        </CardContent>
      </Card>

      <Suspense fallback={null}>
        <LazyEmployeeDirectorySheets
          isAddSheetOpen={isAddSheetOpen}
          onAddSheetOpenChange={setIsAddSheetOpen}
          activeEmployee={activeEmployee}
          onCloseEmployeeSheet={() => setActiveEmployee(null)}
        />
      </Suspense>
    </div>
  )
}

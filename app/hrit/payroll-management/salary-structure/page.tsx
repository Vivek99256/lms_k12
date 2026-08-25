'use client'

/**
 * Ported from G2G's
 * `components/domain/hrms/hrit/payroll-management/salary-structure/page.tsx`.
 *
 * Employee Salary Structure. One row per employee, one column per active
 * payroll type. Amounts are the monthly figure Laravel stores in
 * employee_salary_structures.employee_salary_data; PF and PT are re-derived
 * server side on save from the payroll type config and the employee's
 * pf_deduction / pt_deduction flags, so the values posted for those heads may
 * come back adjusted.
 *
 * Adaptations: import paths only (`@/hooks/*` -> `@/app/hrit/_lib/*`,
 * `@/shared/business` -> `@/app/hrit/_components/*`, flat `Select` ->
 * `@/components/ui/g2g/select` - see that file's header). Target's
 * `components/ui/input.tsx` has no `size` sizing-variant prop (only the
 * native HTML `size` attribute, typed as a number) - the unsupported
 * `size="sm"` prop was dropped from the grid's numeric inputs; their width is
 * still set by `className="w-24 tabular-nums"`, unchanged from G2G.
 */

import { useEffect, useMemo, useState } from 'react'
import { Download, RefreshCw, Save, Search, Users, Wallet } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardHeader, CardContent, CardTitle, CardDescription } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select } from '@/components/ui/g2g/select'
import { SearchInput } from '@/components/ui/search-input'
import { StatusBadge } from '@/components/ui/status-badge'
import { EmptyState } from '@/components/ui/empty-state'
import { ErrorState } from '@/components/ui/error-state'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from '@/components/ui/pagination'
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
} from '@/components/ui/alert-dialog'
import { KPICard } from '@/app/hrit/_components/kpi-card'
import { usePayrollDepartments, useDepartmentEmployees } from '@/app/hrit/_lib/use-payroll-shared'
import { salaryStructureNet, useSalaryStructure } from '@/app/hrit/_lib/use-salary-structure'
import {
  PayrollMessages,
  PayrollPageShell,
  PayrollTableSkeleton,
  downloadCsv,
} from '@/app/hrit/_components/payroll-shell'

const statusOptions = [
  { label: 'Active employees', value: '1' },
  { label: 'Inactive employees', value: '0' },
  { label: 'All employees', value: '' },
]

const currentYear = new Date().getFullYear()
const yearOptions = Array.from({ length: 7 }, (_, index) => {
  const year = String(currentYear - 3 + index)
  return { label: year, value: year }
})

export default function SalaryStructurePage() {
  const {
    loading,
    processing,
    error,
    actionMessage,
    searched,
    rows,
    payrollTypes,
    employeeOptions,
    year,
    search,
    setValue,
    retry,
    clearMessages,
    save,
    rollover,
  } = useSalaryStructure()
  const { departments } = usePayrollDepartments()

  const [selectedYear, setSelectedYear] = useState(String(currentYear))
  const [employeeStatus, setEmployeeStatus] = useState('1')
  const [departmentId, setDepartmentId] = useState('')
  const [employeeId, setEmployeeId] = useState('')
  const [tableSearch, setTableSearch] = useState('')
  const [isRolloverOpen, setIsRolloverOpen] = useState(false)
  const [currentPage, setCurrentPage] = useState(1)
  const PAGE_SIZE = 10

  // Independent of the Search button: selecting a department immediately
  // narrows the Employee picker's own options to that department, the same
  // department_id-driven lookup the Salary Certificate/Form 16 Employee
  // pickers already use. Everything else (search, the report table) is
  // untouched and still keyed off `employeeOptions` from the last search.
  const { employees: departmentEmployees } = useDepartmentEmployees(departmentId)

  const departmentOptions = useMemo(
    () => [{ label: 'All departments', value: '' }, ...departments],
    [departments],
  )

  const employeeSelectOptions = useMemo(
    () => [
      { label: 'All employees', value: '' },
      ...(departmentId ? departmentEmployees : employeeOptions),
    ],
    [departmentId, departmentEmployees, employeeOptions],
  )

  const visibleRows = useMemo(() => {
    const term = tableSearch.trim().toLowerCase()
    if (!term) return rows
    return rows.filter(
      (row) =>
        row.name.toLowerCase().includes(term) ||
        row.employeeNo.toLowerCase().includes(term) ||
        row.department.toLowerCase().includes(term),
    )
  }, [rows, tableSearch])

  // A new search or a narrower table filter can leave `currentPage` pointing
  // past the end of the (now shorter) filtered list - snap back to page 1.
  useEffect(() => {
    setCurrentPage(1)
  }, [rows, tableSearch])

  const totalPages = Math.max(1, Math.ceil(visibleRows.length / PAGE_SIZE))

  const paginatedRows = useMemo(() => {
    const start = (currentPage - 1) * PAGE_SIZE
    return visibleRows.slice(start, start + PAGE_SIZE)
  }, [visibleRows, currentPage])

  const summary = useMemo(() => {
    const configured = rows.filter((row) =>
      Object.values(row.values).some((amount) => Number(amount) > 0),
    ).length
    const totalNet = rows.reduce((sum, row) => sum + salaryStructureNet(row, payrollTypes), 0)

    return {
      employees: rows.length,
      configured,
      pending: rows.length - configured,
      monthlyOutlay: totalNet,
    }
  }, [payrollTypes, rows])

  const runSearch = () => {
    search({
      year: selectedYear,
      employeeStatus,
      employeeIds: employeeId ? [employeeId] : [],
      departmentIds: departmentId ? [departmentId] : [],
    })
  }

  const handleExport = () => {
    downloadCsv(
      `salary-structure-${year}.csv`,
      ['Sr. No', 'Employee No', 'Employee', 'Department', 'Status', ...payrollTypes.map((type) => type.payroll_name ?? ''), 'Net Monthly'],
      visibleRows.map((row, index) => [
        index + 1,
        row.employeeNo,
        row.name,
        row.department,
        row.status,
        ...payrollTypes.map((type) => row.values[String(type.id)] ?? 0),
        salaryStructureNet(row, payrollTypes),
      ]),
    )
  }

  const actions = (
    <>
      <Button
        variant="outline"
        className="gap-2"
        onClick={handleExport}
        disabled={visibleRows.length === 0}
      >
        <Download className="size-4" />
        Export CSV
      </Button>
      <Button
        variant="outline"
        className="gap-2"
        onClick={() => setIsRolloverOpen(true)}
        disabled={processing || rows.length === 0}
      >
        <RefreshCw className="size-4" />
        Roll Over to {Number(year) + 1}
      </Button>
      <Button className="gap-2" onClick={() => save(rows)} disabled={processing || rows.length === 0}>
        <Save className="size-4" />
        {processing ? 'Saving...' : 'Save Structure'}
      </Button>
    </>
  )

  return (
    <PayrollPageShell
      title="Salary Structure"
      description="Set each employee's monthly earning and deduction heads for the payroll year."
      actions={actions}
    >
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <KPICard
          label="Employees"
          value={loading ? '-' : summary.employees}
          description={`Payroll year ${year}`}
          icon={<Users className="size-5" />}
        />
        <KPICard
          label="Structures Set"
          value={loading ? '-' : summary.configured}
          variant="success"
          description="At least one head with an amount"
        />
        <KPICard
          label="Awaiting Setup"
          value={loading ? '-' : summary.pending}
          variant="warning"
          description="No amounts captured yet"
        />
        <KPICard
          label="Monthly Net Outlay"
          value={loading ? '-' : summary.monthlyOutlay.toLocaleString()}
          variant="primary"
          description="Earnings less deductions"
          icon={<Wallet className="size-5" />}
        />
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base sm:text-lg">Filters</CardTitle>
          <CardDescription className="text-xs sm:text-sm">
            Structures are stored per payroll year, so the year drives both what loads and what saves.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
            <div className="grid gap-2">
              <Label htmlFor="structureYear">Payroll Year</Label>
              <Select
                id="structureYear"
                value={selectedYear}
                onChange={setSelectedYear}
                options={yearOptions}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="structureStatus">Employee Status</Label>
              <Select
                id="structureStatus"
                value={employeeStatus}
                onChange={setEmployeeStatus}
                options={statusOptions}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="structureDepartment">Department</Label>
              <Select
                id="structureDepartment"
                value={departmentId}
                onChange={(value) => {
                  setDepartmentId(value)
                  setEmployeeId('')
                }}
                options={departmentOptions}
                placeholder="All departments"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="structureEmployee">Employee</Label>
              <Select
                id="structureEmployee"
                value={employeeId}
                onChange={setEmployeeId}
                options={employeeSelectOptions}
                placeholder="All employees"
              />
            </div>
            <div className="flex items-end">
              <Button className="w-full gap-2" onClick={runSearch} disabled={loading}>
                <Search className="size-4" />
                {loading ? 'Loading...' : 'Search'}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <PayrollMessages error={error} actionMessage={actionMessage} onDismiss={clearMessages} />

      {loading ? (
        <PayrollTableSkeleton />
      ) : error && rows.length === 0 ? (
        <ErrorState title="Unable to load salary structures" description={error} retry={retry} />
      ) : payrollTypes.length === 0 ? (
        <Card>
          <CardContent>
            <EmptyState
              icon={<Wallet className="size-10" />}
              title="No active payroll types"
              description="Add earning and deduction components under Payroll Type before building salary structures."
            />
          </CardContent>
        </Card>
      ) : rows.length === 0 && searched ? (
        <Card>
          <CardContent>
            <EmptyState
              icon={<Users className="size-10" />}
              title="No employees match these filters"
              description="Widen the department, employee or status filter and search again."
            />
          </CardContent>
        </Card>
      ) : (
        <Card className="min-w-0">
          <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div className="min-w-0">
              <CardTitle className="text-base sm:text-lg">Salary Grid — {year}</CardTitle>
              <CardDescription className="text-xs sm:text-sm">
                {visibleRows.length} of {rows.length} employees · {payrollTypes.length} payroll heads
              </CardDescription>
            </div>
            <div className="w-full sm:max-w-xs">
              <SearchInput
                placeholder="Search employee, code or department"
                aria-label="Search employees"
                icon={<Search className="size-4" />}
                value={tableSearch}
                onChange={(event) => setTableSearch(event.target.value)}
              />
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <Table className="[&_td]:p-2 [&_th]:p-2">
                <TableHeader className="bg-surface-muted">
                  <TableRow>
                    <TableHead className="font-semibold">Sr. No</TableHead>
                    <TableHead className="font-semibold">Employee</TableHead>
                    <TableHead className="font-semibold">Department</TableHead>
                    <TableHead className="font-semibold">Status</TableHead>
                    {payrollTypes.map((payrollType) => (
                      <TableHead key={payrollType.id} className="whitespace-nowrap font-semibold">
                        <span className="flex flex-col">
                          <span>{payrollType.payroll_name}</span>
                          <span className="text-[10px] font-normal uppercase tracking-wide text-muted-foreground">
                            {String(payrollType.payroll_type) === '1' ? 'Earning' : 'Deduction'}
                          </span>
                        </span>
                      </TableHead>
                    ))}
                    <TableHead className="font-semibold">Net Monthly</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {paginatedRows.map((row, index) => (
                    <TableRow key={String(row.employeeId)}>
                      <TableCell className="text-sm text-muted-foreground">
                        {(currentPage - 1) * PAGE_SIZE + index + 1}
                      </TableCell>
                      <TableCell>
                        <span className="flex flex-col">
                          <span className="text-sm font-medium text-foreground">{row.name}</span>
                          <span className="text-xs text-muted-foreground">
                            {row.employeeNo || '-'}
                          </span>
                        </span>
                      </TableCell>
                      <TableCell className="w-[300px] whitespace-normal break-words text-sm text-muted-foreground">
                        {row.department}
                      </TableCell>
                      <TableCell>
                        <StatusBadge status={row.status} />
                      </TableCell>
                      {payrollTypes.map((payrollType) => (
                        <TableCell key={payrollType.id}>
                          <Input
                            type="number"
                            min="0"
                            className="w-24 tabular-nums"
                            aria-label={`${payrollType.payroll_name} for ${row.name}`}
                            value={row.values[String(payrollType.id)] ?? 0}
                            onChange={(event) =>
                              setValue(
                                row.employeeId,
                                String(payrollType.id),
                                Number(event.target.value) || 0,
                              )
                            }
                          />
                        </TableCell>
                      ))}
                      <TableCell className="text-sm font-semibold tabular-nums text-foreground">
                        {salaryStructureNet(row, payrollTypes).toLocaleString()}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            {totalPages > 1 && (
              <div className="flex flex-col gap-3 border-t border-border px-4 py-3 text-sm text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
                <p>
                  Showing {(currentPage - 1) * PAGE_SIZE + 1}-
                  {Math.min(currentPage * PAGE_SIZE, visibleRows.length)} of{' '}
                  {visibleRows.length} employees
                </p>

                <Pagination className="mx-0 w-auto justify-start sm:justify-end">
                  <PaginationContent>
                    <PaginationItem>
                      <PaginationPrevious
                        href="#"
                        onClick={(event) => {
                          event.preventDefault()
                          if (currentPage > 1) setCurrentPage(currentPage - 1)
                        }}
                      />
                    </PaginationItem>

                    {Array.from({ length: totalPages }, (_, index) => index + 1).map((page) => (
                      <PaginationItem key={page}>
                        <PaginationLink
                          href="#"
                          isActive={page === currentPage}
                          onClick={(event) => {
                            event.preventDefault()
                            setCurrentPage(page)
                          }}
                        >
                          {page}
                        </PaginationLink>
                      </PaginationItem>
                    ))}

                    <PaginationItem>
                      <PaginationNext
                        href="#"
                        onClick={(event) => {
                          event.preventDefault()
                          if (currentPage < totalPages) setCurrentPage(currentPage + 1)
                        }}
                      />
                    </PaginationItem>
                  </PaginationContent>
                </Pagination>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      <AlertDialog open={isRolloverOpen} onOpenChange={setIsRolloverOpen}>
        <AlertDialogContent className="w-[calc(100%-2rem)] max-w-lg">
          <AlertDialogHeader>
            <AlertDialogTitle>Roll Over Salary Structures</AlertDialogTitle>
            <AlertDialogDescription>
              Each structure in the current filter for {year} will be copied into {Number(year) + 1}.
              Employees who already have a {Number(year) + 1} structure are overwritten with the {year}{' '}
              amounts.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex-col-reverse gap-2 sm:flex-row sm:gap-0">
            <Button
              variant="outline"
              className="w-full sm:w-auto"
              onClick={() => setIsRolloverOpen(false)}
              disabled={processing}
            >
              Cancel
            </Button>
            <Button
              className="w-full sm:w-auto"
              disabled={processing}
              onClick={async () => {
                const result = await rollover()
                if (result?.ok) setIsRolloverOpen(false)
              }}
            >
              {processing ? 'Rolling over...' : 'Roll Over'}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </PayrollPageShell>
  )
}

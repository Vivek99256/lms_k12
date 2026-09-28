'use client'

/**
 * Ported from G2G's `compliance-library-management.tsx`, then substantially
 * extended in the Compliance Management System's frontend-completion pass.
 *
 * What changed vs. the original port:
 *  - Register: server-side search/filter/pagination (was: load everything
 *    once, filter/paginate in-browser - see `useComplianceLibrary()`'s own
 *    header comment).
 *  - New columns: Category, Priority, Status (derived, time-based), Evidence
 *    count. New actions: View (detail drawer), Complete (with automatic
 *    recurrence), on top of the existing Edit/Delete.
 *  - A tab nav (Register / Calendar / My Compliance / Overdue / Templates /
 *    Categories) replaces the single flat screen - no dedicated Tabs
 *    primitive exists in this repo (checked), so this follows the same
 *    local-state + button-row pattern already used by
 *    `app/talent-management/administration/components/admin-center.tsx`
 *    rather than adding a new dependency.
 *  - A dashboard (KPIs + charts) sits above the register, backed by a real
 *    tenant-wide stats endpoint instead of the old 3 client-computed stats.
 *  - "Create from Template" in the create form.
 *
 * `mapComplianceRecord` still replaces the Laravel-field mapper 1:1 for the
 * API's field names, now carrying the additional fields through too.
 */

import { lazy, Suspense, useEffect, useMemo, useRef, useState } from 'react'
import { Calendar, ClipboardList, Edit3, Eye, FileText, FolderKanban, Paperclip, Trash2, UploadCloud, User, CheckCircle2, AlertTriangle } from 'lucide-react'
import { Badge } from '@/components/ui/g2g/badge'
import { Button } from '@/components/ui/g2g/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/g2g/card'
import { Select } from '@/components/ui/g2g/select'
import { StatusBadge } from '@/components/ui/status-badge'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/g2g/table'
import { cn } from '@/lib/utils'
import { buildSessionContext } from '../../_lib/compliance-library-api'
import { useComplianceLibrary } from '../../_lib/use-compliance-library'
import { useComplianceDashboard } from '../../_lib/use-compliance-extras'
import type { ComplianceApiRecord, ComplianceTemplateOption } from '../../_lib/compliance-library-api'
import { ComplianceDetailDrawer } from './compliance-detail-drawer'
import {
  ComplianceForm,
  applyTemplate,
  type ComplianceFormState,
  type ComplianceRecord,
  type Priority,
  TableSkeleton,
  createCsv,
  displayDate,
  downloadFile,
  initialForm,
  pageSizeOptions,
} from './compliance-library-management-shared'
import { ComplianceLibraryFiltersBar } from './compliance-library-filters-bar'

const LazyComplianceLibraryToolbar = lazy(() =>
  import('./compliance-library-management-toolbar').then((module) => ({ default: module.ComplianceLibraryToolbar })),
)
const LazyComplianceDialogs = lazy(() =>
  import('./compliance-library-management-dialogs').then((module) => ({ default: module.ComplianceDialogs })),
)
const LazyComplianceCalendarView = lazy(() =>
  import('./compliance-calendar').then((module) => ({ default: module.ComplianceCalendarView })),
)
const LazyMyCompliance = lazy(() => import('./compliance-my').then((module) => ({ default: module.MyCompliance })))
const LazyOverdueCompliance = lazy(() => import('./compliance-overdue').then((module) => ({ default: module.OverdueCompliance })))
const LazyComplianceTemplates = lazy(() => import('./compliance-templates').then((module) => ({ default: module.ComplianceTemplates })))
const LazyComplianceCategories = lazy(() => import('./compliance-categories').then((module) => ({ default: module.ComplianceCategories })))
const LazyComplianceDashboard = lazy(() => import('./compliance-dashboard').then((module) => ({ default: module.ComplianceDashboard })))

const PRIORITY_VARIANT: Record<string, 'default' | 'navy' | 'warning' | 'destructive'> = {
  Low: 'default',
  Medium: 'navy',
  High: 'warning',
  Critical: 'destructive',
}

type Tab = 'register' | 'calendar' | 'my' | 'overdue' | 'templates' | 'categories'

const TABS: { key: Tab; label: string; icon: typeof ClipboardList }[] = [
  { key: 'register', label: 'Register', icon: ClipboardList },
  { key: 'calendar', label: 'Calendar', icon: Calendar },
  { key: 'my', label: 'My Compliance', icon: User },
  { key: 'overdue', label: 'Overdue', icon: AlertTriangle },
  { key: 'templates', label: 'Templates', icon: FileText },
  { key: 'categories', label: 'Categories', icon: FolderKanban },
]

function mapComplianceRecord(record: ComplianceApiRecord): ComplianceRecord {
  return {
    id: String(record.id),
    name: record.name ?? '',
    description: record.description ?? '',
    categoryId: record.category_id ? String(record.category_id) : '',
    categoryName: record.category_name ?? '',
    department: record.department ?? '-',
    departmentId: record.department_id ? String(record.department_id) : '',
    assignedTo: record.assigned_to ?? '-',
    dueDate: record.due_date ?? '',
    nextDueDate: record.next_due_date ?? '',
    frequency: (record.frequency || 'One-Time') as ComplianceRecord['frequency'],
    customDate: record.custom_date ?? '',
    priority: (record.priority || 'Medium') as Priority,
    status: (record.status || 'Upcoming') as ComplianceRecord['status'],
    derivedStatus: (record.derived_status || record.status || 'Upcoming') as ComplianceRecord['status'],
    evidenceCount: record.evidence_count ?? 0,
    attachmentName: record.attachment_name ?? '',
  }
}

export function ComplianceLibraryManagement() {
  // Same coarse admin check already used elsewhere in this app (see
  // app/task-management/_lib/use-integration-management.ts) - this repo has
  // no granular per-action permission strings for this module family
  // (verified: neither ComplianceLibraryController nor its sibling
  // DisciplinaryLibraryController gate any action beyond tenant scoping), so
  // Delete/Verify/Reject/Category/Template management are gated on this
  // flag rather than a finer-grained permission that does not exist yet.
  const isAdmin = useMemo(() => {
    const session = buildSessionContext()
    return session.isAdmin === '1' || session.isAdmin === 'true' || session.isAdmin === '1.0'
  }, [])

  const {
    records: apiRecords,
    departments: apiDepartments,
    employees,
    categories: apiCategories,
    templates,
    pagination,
    filters,
    loading: isLoading,
    saving,
    retry: loadRecords,
    applyFilters,
    clearFilters,
    setPage,
    createRecord,
    updateRecord,
    deleteRecord: deleteRecordMutation,
    completeRecord: completeRecordMutation,
  } = useComplianceLibrary()

  const dashboard = useComplianceDashboard()

  const [activeTab, setActiveTab] = useState<Tab>('register')
  const records = useMemo(() => apiRecords.map(mapComplianceRecord), [apiRecords])
  const [form, setForm] = useState<ComplianceFormState>(initialForm)
  const [editForm, setEditForm] = useState<ComplianceFormState>(initialForm)
  const [editingRecord, setEditingRecord] = useState<ComplianceRecord | null>(null)
  const [deleteRecord, setDeleteRecord] = useState<ComplianceRecord | null>(null)
  const [completeRecord, setCompleteRecord] = useState<ComplianceRecord | null>(null)
  const [viewingId, setViewingId] = useState<string | null>(null)
  const [notice, setNotice] = useState('')
  const [uploadKey, setUploadKey] = useState(0)
  const [editUploadKey, setEditUploadKey] = useState(0)
  const searchDebounce = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    if (!notice) return
    const timer = window.setTimeout(() => setNotice(''), 3000)
    return () => window.clearTimeout(timer)
  }, [notice])

  const categoryOptions = useMemo(() => apiCategories.map((category) => ({ label: category.label, value: category.value })), [apiCategories])
  const departmentOptions = useMemo(() => apiDepartments.map((department) => ({ label: department.label, value: department.value })), [apiDepartments])
  const employeeOptions = useMemo(
    () => employees.map((employee) => ({ label: employee.label, value: employee.value, department_id: employee.department_id })),
    [employees],
  )

  const handleSearchChange = (value: string) => {
    if (searchDebounce.current) clearTimeout(searchDebounce.current)
    searchDebounce.current = setTimeout(() => applyFilters({ search: value }), 350)
  }

  const validateForm = (state: ComplianceFormState) => {
    return state.name.trim() && state.description.trim() && state.categoryId && state.dueDate
  }

  const buildPayload = (state: ComplianceFormState) => ({
    name: state.name.trim(),
    description: state.description.trim(),
    category_id: state.categoryId || undefined,
    department: state.department,
    department_id: state.departmentId || undefined,
    assigned_to: state.assignedTo,
    due_date: state.dueDate,
    frequency: state.frequency || 'One-Time',
    custom_date: state.customDate,
    priority: state.priority || undefined,
    status: state.status || undefined,
  })

  const refreshAll = async () => {
    await Promise.all([loadRecords(), dashboard.retry()])
  }

  const handleSubmit = async () => {
    if (!validateForm(form)) {
      setNotice('Compliance Name, Description, Category, and Due Date are required.')
      return
    }

    const result = await createRecord(buildPayload(form), form.attachmentFile)

    if (result.ok) {
      setForm(initialForm)
      setUploadKey((key) => key + 1)
    }
    setNotice(result.message)
    if (result.ok) await refreshAll()
  }

  const handleApplyTemplate = (template: ComplianceTemplateOption) => {
    setForm((current) => applyTemplate(current, template))
  }

  const openEdit = (record: ComplianceRecord) => {
    setEditingRecord(record)
    setEditForm({
      name: record.name,
      description: record.description,
      categoryId: record.categoryId,
      department: record.department === '-' ? '' : record.department,
      departmentId: record.departmentId,
      assignedTo: record.assignedTo === '-' ? '' : record.assignedTo,
      dueDate: record.dueDate,
      frequency: record.frequency,
      customDate: record.customDate ?? '',
      priority: record.priority,
      status: record.status,
      attachmentName: record.attachmentName ?? '',
    })
    setEditUploadKey((key) => key + 1)
  }

  const handleSaveEdit = async () => {
    if (!editingRecord || !validateForm(editForm)) {
      setNotice('Compliance Name, Description, Category, and Due Date are required.')
      return
    }

    const result = await updateRecord(editingRecord.id, buildPayload(editForm), editForm.attachmentFile)

    if (result.ok) setEditingRecord(null)
    setNotice(result.message)
    if (result.ok) await refreshAll()
  }

  const handleDelete = async () => {
    if (!deleteRecord) return
    const result = await deleteRecordMutation(deleteRecord.id)
    if (result.ok) setDeleteRecord(null)
    setNotice(result.message)
    if (result.ok) await refreshAll()
  }

  const handleComplete = async (note: string, date: string) => {
    if (!completeRecord) return
    const result = await completeRecordMutation(completeRecord.id, note, date)
    if (result.ok) setCompleteRecord(null)
    setNotice(result.message)
    if (result.ok) await refreshAll()
  }

  const handlePrint = () => {
    window.print()
    setNotice('Print dialog opened.')
  }

  const handleExcelExport = () => {
    downloadFile('compliance-library.csv', createCsv(records), 'text/csv;charset=utf-8')
    setNotice('Excel export downloaded.')
  }

  const handlePdfExport = () => {
    window.print()
    setNotice('Use the print dialog to save this report as PDF.')
  }

  return (
    <div className="space-y-6">
      <Suspense fallback={<div className="h-36 animate-pulse rounded-xl border border-border/70 bg-muted/20" />}>
        <LazyComplianceLibraryToolbar
          visibleCount={records.length}
          totalCount={pagination.total}
          onPrint={handlePrint}
          onExcelExport={handleExcelExport}
          onPdfExport={handlePdfExport}
        />
      </Suspense>

      <Suspense fallback={<div className="h-48 animate-pulse rounded-xl border border-border/70 bg-muted/20" />}>
        <LazyComplianceDashboard data={dashboard.data} loading={dashboard.loading} />
      </Suspense>

      {notice && (
        <div
          role="status"
          className={cn(
            'rounded-xl border px-4 py-3 text-sm shadow-sm',
            notice.toLowerCase().includes('required') || notice.toLowerCase().includes('fail')
              ? 'border-destructive/20 bg-destructive/10 text-destructive'
              : 'border-success/20 bg-success/10 text-success',
          )}
        >
          {notice}
        </div>
      )}

      <div className="flex flex-wrap gap-1 rounded-xl border border-border/70 bg-background/60 p-1">
        {TABS.map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            type="button"
            onClick={() => setActiveTab(key)}
            className={cn(
              'flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium transition-colors',
              activeTab === key ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-muted',
            )}
          >
            <Icon className="size-4" />
            {label}
          </button>
        ))}
      </div>

      {activeTab === 'register' && (
        <>
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <UploadCloud className="size-5 text-primary" />
                Compliance Creation Form
              </CardTitle>
              <CardDescription>
                Register a compliance item, set ownership, attach evidence templates, and define its review cadence.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ComplianceForm
                form={form}
                onChange={(next) => setForm((current) => ({ ...current, ...next }))}
                onSubmit={handleSubmit}
                onApplyTemplate={handleApplyTemplate}
                templates={templates}
                submitLabel="Submit Compliance"
                uploadKey={uploadKey}
                categoryOptions={categoryOptions}
                departmentOptions={departmentOptions}
                employeeOptions={employeeOptions}
                saving={saving}
              />
            </CardContent>
          </Card>

          <ComplianceLibraryFiltersBar
            filters={filters}
            categoryOptions={categoryOptions}
            departmentOptions={departmentOptions}
            onChange={(next) => {
              if ('search' in next) {
                handleSearchChange(next.search ?? '')
                return
              }
              applyFilters(next)
            }}
            onClear={clearFilters}
          />

          <Card className="overflow-hidden">
            <CardHeader className="gap-4 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <CardTitle className="text-lg">Compliance Records</CardTitle>
                <CardDescription>
                  Search, filter, review assigned owners, and maintain the live compliance register.
                </CardDescription>
              </div>
              <div className="flex items-center gap-3">
                <Badge variant="navy">{pagination.total} total</Badge>
                <Select
                  value={filters.per_page ?? '10'}
                  onChange={(value) => applyFilters({ per_page: value, page: '1' })}
                  options={pageSizeOptions}
                />
              </div>
            </CardHeader>
            <CardContent className="p-0">
              {isLoading ? (
                <TableSkeleton />
              ) : (
                <>
                  <div className="max-h-[560px] overflow-auto">
                    <Table className="min-w-[1200px]">
                      <TableHeader className="sticky top-0 z-10 bg-card shadow-sm">
                        <TableRow className="hover:bg-transparent">
                          <TableHead className="w-16">Sr No.</TableHead>
                          <TableHead>Name</TableHead>
                          <TableHead>Category</TableHead>
                          <TableHead>Department</TableHead>
                          <TableHead>Assigned To</TableHead>
                          <TableHead>Due Date</TableHead>
                          <TableHead>Frequency</TableHead>
                          <TableHead>Priority</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead>Evidence</TableHead>
                          <TableHead className="w-40 text-right">Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {records.length === 0 ? (
                          <TableRow>
                            <TableCell colSpan={11} className="py-14 text-center">
                              <div className="mx-auto flex max-w-sm flex-col items-center gap-3">
                                <div className="flex size-12 items-center justify-center rounded-xl bg-muted">
                                  <FileText className="size-6 text-muted-foreground" />
                                </div>
                                <div>
                                  <p className="font-medium text-foreground">No compliance records found</p>
                                  <p className="mt-1 text-sm text-muted-foreground">
                                    There are no compliance records matching your current filters.
                                  </p>
                                </div>
                                <Button variant="outline" size="sm" onClick={clearFilters}>Clear Filters</Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        ) : (
                          records.map((record, index) => (
                            <TableRow key={record.id} className="group">
                              <TableCell className="font-medium text-muted-foreground">
                                {(pagination.current_page - 1) * pagination.per_page + index + 1}
                              </TableCell>
                              <TableCell className="max-w-[180px]">
                                <p className="font-medium text-foreground">{record.name}</p>
                              </TableCell>
                              <TableCell>{record.categoryName || '-'}</TableCell>
                              <TableCell>{record.department}</TableCell>
                              <TableCell>{record.assignedTo}</TableCell>
                              <TableCell>{displayDate(record.dueDate)}</TableCell>
                              <TableCell>
                                <Badge variant={record.frequency === 'Custom' ? 'warning' : 'navy'}>{record.frequency}</Badge>
                              </TableCell>
                              <TableCell>
                                <Badge variant={PRIORITY_VARIANT[record.priority] ?? 'default'}>{record.priority}</Badge>
                              </TableCell>
                              <TableCell>
                                <StatusBadge status={record.derivedStatus} size="sm" />
                              </TableCell>
                              <TableCell>
                                {record.evidenceCount > 0 ? (
                                  <span className="inline-flex items-center gap-1 text-primary">
                                    <Paperclip className="size-3.5" /> {record.evidenceCount}
                                  </span>
                                ) : (
                                  <span className="text-muted-foreground">None</span>
                                )}
                              </TableCell>
                              <TableCell>
                                <div className="flex justify-end gap-1">
                                  <Button type="button" variant="ghost" size="icon-sm" aria-label={`View ${record.name}`} onClick={() => setViewingId(record.id)}>
                                    <Eye className="size-4" />
                                  </Button>
                                  <Button type="button" variant="ghost" size="icon-sm" aria-label={`Edit ${record.name}`} onClick={() => openEdit(record)}>
                                    <Edit3 className="size-4" />
                                  </Button>
                                  {record.derivedStatus !== 'Completed' && record.derivedStatus !== 'Not Applicable' && (
                                    <Button type="button" variant="ghost" size="icon-sm" aria-label={`Complete ${record.name}`} className="text-success" onClick={() => setCompleteRecord(record)}>
                                      <CheckCircle2 className="size-4" />
                                    </Button>
                                  )}
                                  {isAdmin && (
                                    <Button type="button" variant="destructive" size="icon-sm" aria-label={`Delete ${record.name}`} onClick={() => setDeleteRecord(record)}>
                                      <Trash2 className="size-4" />
                                    </Button>
                                  )}
                                </div>
                              </TableCell>
                            </TableRow>
                          ))
                        )}
                      </TableBody>
                    </Table>
                  </div>

                  <div className="flex flex-col gap-3 border-t border-border p-4 sm:flex-row sm:items-center sm:justify-between">
                    <p className="text-sm text-muted-foreground">
                      Page {pagination.current_page} of {pagination.last_page} - {pagination.total} total
                    </p>
                    <div className="flex gap-2">
                      <Button variant="outline" size="sm" disabled={pagination.current_page <= 1} onClick={() => setPage(pagination.current_page - 1)}>
                        Previous
                      </Button>
                      <Button variant="outline" size="sm" disabled={pagination.current_page >= pagination.last_page} onClick={() => setPage(pagination.current_page + 1)}>
                        Next
                      </Button>
                    </div>
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </>
      )}

      {activeTab === 'calendar' && (
        <Suspense fallback={<div className="h-96 animate-pulse rounded-xl border border-border/70 bg-muted/20" />}>
          <LazyComplianceCalendarView onSelectRecord={setViewingId} />
        </Suspense>
      )}

      {activeTab === 'my' && (
        <Suspense fallback={<div className="h-96 animate-pulse rounded-xl border border-border/70 bg-muted/20" />}>
          <LazyMyCompliance onSelectRecord={setViewingId} />
        </Suspense>
      )}

      {activeTab === 'overdue' && (
        <Suspense fallback={<div className="h-96 animate-pulse rounded-xl border border-border/70 bg-muted/20" />}>
          <LazyOverdueCompliance onSelectRecord={setViewingId} />
        </Suspense>
      )}

      {activeTab === 'templates' && (
        <Suspense fallback={<div className="h-96 animate-pulse rounded-xl border border-border/70 bg-muted/20" />}>
          <LazyComplianceTemplates categoryOptions={categoryOptions} isAdmin={isAdmin} />
        </Suspense>
      )}

      {activeTab === 'categories' && (
        <Suspense fallback={<div className="h-96 animate-pulse rounded-xl border border-border/70 bg-muted/20" />}>
          <LazyComplianceCategories isAdmin={isAdmin} />
        </Suspense>
      )}

      <Suspense fallback={null}>
        <LazyComplianceDialogs
          editingRecord={editingRecord}
          editForm={editForm}
          editUploadKey={editUploadKey}
          categoryOptions={apiCategories}
          departmentOptions={apiDepartments}
          employeeOptions={employees}
          saving={saving}
          onEditChange={(next) => setEditForm((current) => ({ ...current, ...next }))}
          onEditSave={handleSaveEdit}
          onEditClose={() => setEditingRecord(null)}
          deleteRecord={deleteRecord}
          onDeleteConfirm={handleDelete}
          onDeleteClose={() => setDeleteRecord(null)}
          completeRecord={completeRecord}
          onCompleteConfirm={handleComplete}
          onCompleteClose={() => setCompleteRecord(null)}
        />
      </Suspense>

      <ComplianceDetailDrawer
        complianceId={viewingId}
        isAdmin={isAdmin}
        onClose={() => setViewingId(null)}
        onChanged={refreshAll}
      />
    </div>
  )
}

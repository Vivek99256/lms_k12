'use client'

import { useEffect, useMemo, useState } from 'react'
import { buildSessionContext, complianceLibraryService, type ComplianceApiRecord } from '../../_lib/compliance-library-api'
import { FilterSelect, ReportShell, type ReportColumn, type ReportRow } from '../_components/report-shell'

const COLUMNS: ReportColumn[] = [
  { key: 'name', label: 'Compliance' },
  { key: 'category', label: 'Category' },
  { key: 'department', label: 'Department' },
  { key: 'assignedTo', label: 'Assigned to' },
  { key: 'dueDate', label: 'Due date' },
  { key: 'frequency', label: 'Frequency' },
  { key: 'priority', label: 'Priority' },
  { key: 'status', label: 'Status' },
  { key: 'overdue', label: 'Days overdue' },
]

const STATUSES = ['Upcoming', 'Due Soon', 'In Progress', 'Pending Verification', 'Completed', 'Overdue', 'Expired', 'Not Applicable']
const PRIORITIES = ['Low', 'Medium', 'High', 'Critical']

const statusOf = (record: ComplianceApiRecord) => String(record.derived_status ?? record.status ?? '')

export default function ComplianceReportPage() {
  const [records, setRecords] = useState<ComplianceApiRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [status, setStatus] = useState('')
  const [priority, setPriority] = useState('')
  const [department, setDepartment] = useState('')

  useEffect(() => {
    let live = true
    complianceLibraryService
      .getRecords(buildSessionContext(), { page: '1', per_page: '1000' })
      .then((response) => {
        if (live) setRecords(Array.isArray(response.data) ? response.data : [])
      })
      .catch((value: unknown) => {
        if (live) setError(value instanceof Error && value.message ? value.message : "Couldn't load compliance records. Try again.")
      })
      .finally(() => {
        if (live) setLoading(false)
      })
    return () => {
      live = false
    }
  }, [])

  const filtered = useMemo(
    () =>
      records.filter(
        (record) =>
          (!status || statusOf(record) === status) &&
          (!priority || record.priority === priority) &&
          (!department || record.department === department),
      ),
    [records, status, priority, department],
  )

  const rows = useMemo<ReportRow[]>(
    () =>
      filtered.map((record) => ({
        name: record.name,
        category: record.category_name ?? '',
        department: record.department ?? '',
        assignedTo: record.assigned_user ?? record.assigned_to ?? '',
        dueDate: record.next_due_date ?? record.due_date ?? '',
        frequency: String(record.frequency ?? ''),
        priority: String(record.priority ?? ''),
        status: statusOf(record),
        overdue: record.days_overdue ? String(record.days_overdue) : '',
      })),
    [filtered],
  )

  const departments = useMemo(
    () => Array.from(new Set(records.map((record) => record.department).filter((value): value is string => Boolean(value)))).sort(),
    [records],
  )
  const count = (name: string) => filtered.filter((record) => statusOf(record) === name).length

  return (
    <ReportShell
      title="Compliance Report"
      description="Compliance items by status, priority and department, with due dates and how late the overdue ones are."
      fileName="compliance-report"
      columns={COLUMNS}
      rows={rows}
      loading={loading}
      error={error}
      kpis={[
        { label: 'Total items', value: filtered.length },
        { label: 'Completed', value: count('Completed') },
        { label: 'Due soon', value: count('Due Soon') },
        { label: 'Overdue', value: count('Overdue') + count('Expired'), hint: 'Overdue and expired' },
      ]}
      filters={
        <>
          <FilterSelect label="Status" value={status} onChange={setStatus} options={STATUSES.map((value) => ({ value, label: value }))} />
          <FilterSelect label="Priority" value={priority} onChange={setPriority} options={PRIORITIES.map((value) => ({ value, label: value }))} />
          <FilterSelect label="Department" value={department} onChange={setDepartment} options={departments.map((value) => ({ value, label: value }))} />
        </>
      }
    />
  )
}

'use client'

import { useEffect, useMemo, useState } from 'react'
import { buildSessionContext, disciplinaryLibraryService, type DisciplinaryApiRecord } from '../../_lib/disciplinary-library-api'
import { FilterSelect, ReportShell, type ReportColumn, type ReportRow } from '../_components/report-shell'

const COLUMNS: ReportColumn[] = [
  { key: 'date', label: 'Incident date' },
  { key: 'employee', label: 'Employee' },
  { key: 'department', label: 'Department' },
  { key: 'type', label: 'Misconduct' },
  { key: 'location', label: 'Location' },
  { key: 'witness', label: 'Witness' },
  { key: 'action', label: 'Action taken' },
  { key: 'reportedBy', label: 'Reported by' },
  { key: 'reportDate', label: 'Reported on' },
]

export default function DisciplinaryReportPage() {
  const [records, setRecords] = useState<DisciplinaryApiRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [department, setDepartment] = useState('')
  const [type, setType] = useState('')

  useEffect(() => {
    let live = true
    disciplinaryLibraryService
      .getRecords(buildSessionContext())
      .then((response) => {
        if (live) setRecords(Array.isArray(response.data) ? response.data : [])
      })
      .catch((value: unknown) => {
        if (live) setError(value instanceof Error && value.message ? value.message : "Couldn't load disciplinary records. Try again.")
      })
      .finally(() => {
        if (live) setLoading(false)
      })
    return () => {
      live = false
    }
  }, [])

  const filtered = useMemo(
    () => records.filter((record) => (!department || record.department_name === department) && (!type || record.misconduct_type === type)),
    [records, department, type],
  )

  const rows = useMemo<ReportRow[]>(
    () =>
      filtered.map((record) => ({
        date: record.incident_datetime ?? '',
        employee: record.employee_name ?? '',
        department: record.department_name ?? '',
        type: record.misconduct_type ?? '',
        location: record.location ?? '',
        witness: record.witness_name ?? '',
        action: record.action_taken ?? '',
        reportedBy: record.reported_by_name ?? '',
        reportDate: record.date_of_report ?? '',
      })),
    [filtered],
  )

  const unique = (pick: (record: DisciplinaryApiRecord) => string | null) =>
    Array.from(new Set(records.map(pick).filter((value): value is string => Boolean(value)))).sort()

  return (
    <ReportShell
      title="Disciplinary Report"
      description="Disciplinary incidents by department and type of misconduct, with the action taken."
      fileName="disciplinary-report"
      columns={COLUMNS}
      rows={rows}
      loading={loading}
      error={error}
      kpis={[
        { label: 'Total incidents', value: filtered.length },
        { label: 'Departments', value: new Set(filtered.map((record) => record.department_name).filter(Boolean)).size, hint: 'Business units represented' },
        { label: 'Employees involved', value: new Set(filtered.map((record) => record.employee_id).filter(Boolean)).size },
        { label: 'Action recorded', value: filtered.filter((record) => record.action_taken).length },
      ]}
      filters={
        <>
          <FilterSelect label="Department" value={department} onChange={setDepartment} options={unique((r) => r.department_name).map((value) => ({ value, label: value }))} />
          <FilterSelect label="Misconduct" value={type} onChange={setType} options={unique((r) => r.misconduct_type).map((value) => ({ value, label: value }))} />
        </>
      }
    />
  )
}

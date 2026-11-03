'use client'

import { useMemo, useState } from 'react'
import { useEmployeeDirectory } from '../../_lib/use-employee-directory'
import { FilterSelect, ReportShell, type ReportColumn, type ReportRow } from '../_components/report-shell'

const COLUMNS: ReportColumn[] = [
  { key: 'name', label: 'Employee' },
  { key: 'email', label: 'Email' },
  { key: 'mobile', label: 'Mobile' },
  { key: 'department', label: 'Department' },
  { key: 'jobRole', label: 'Job role' },
  { key: 'designation', label: 'Designation' },
  { key: 'joined', label: 'Joined' },
  { key: 'status', label: 'Status' },
]

export default function EmployeeDirectoryReportPage() {
  const [department, setDepartment] = useState('')
  const [jobRole, setJobRole] = useState('')
  const [status, setStatus] = useState('')

  // Filtering happens on the server; the report asks for one large page so the table and the
  // CSV hold the whole filtered result, not just the first screen of the directory.
  const { employeesData, loading, error, departments, jobRoles, pagination } = useEmployeeDirectory({
    department_id: department,
    jobrole_id: jobRole,
    active_status: status,
    page: '1',
    per_page: '1000',
  })

  const rows = useMemo<ReportRow[]>(
    () =>
      employeesData.map((employee) => ({
        name: employee.full_name,
        email: employee.email,
        mobile: employee.mobile,
        department: employee.department_name,
        jobRole: employee.jobRole,
        designation: employee.designation,
        joined: employee.join_Date,
        status: employee.status,
      })),
    [employeesData],
  )

  const total = pagination?.total ?? rows.length
  const active = rows.filter((row) => row.status === 'Active').length
  const withoutRole = rows.filter((row) => !row.jobRole || row.jobRole === 'N/A').length

  return (
    <ReportShell
      title="Employee Directory Report"
      description="Every employee with department, job role and status. Filter, search and export what you see."
      fileName="employee-directory-report"
      columns={COLUMNS}
      rows={rows}
      loading={loading}
      error={error}
      kpis={[
        { label: 'Employees', value: total, hint: 'Match the filters below' },
        { label: 'Active', value: active },
        { label: 'Inactive', value: rows.length - active },
        { label: 'No job role', value: withoutRole, hint: 'Awaiting role assignment' },
      ]}
      filters={
        <>
          <FilterSelect label="Department" value={department} onChange={setDepartment} options={departments.map((d) => ({ value: d.value, label: d.label }))} />
          <FilterSelect label="Job role" value={jobRole} onChange={setJobRole} options={jobRoles.map((r) => ({ value: r.value, label: r.label }))} />
          <FilterSelect
            label="Status"
            value={status}
            onChange={setStatus}
            options={[
              { value: '1', label: 'Active' },
              { value: '0', label: 'Inactive' },
            ]}
          />
        </>
      }
    />
  )
}

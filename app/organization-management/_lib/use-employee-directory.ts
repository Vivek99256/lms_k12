'use client'

/**
 * Ported from G2G's inline data-fetching effect in
 * `components/domain/organization/employee-directory.tsx` (the
 * `hasStoredEmployeeSession` / `fetchEmployees` block), lifted into a hook so
 * it follows this project's established `use-<feature>.ts` convention (see
 * `app/talent-management/_lib/use-onboarding.ts`).
 *
 * G2G fetches straight off `localStorage.getItem('userData')` and G2G's own
 * `/user/add_user` list endpoint; this calls
 * `EmployeeDirectoryService.list()` against the new
 * `/organization-management/employee-directory` endpoint instead (see
 * `employee-directory-api.ts`'s header comment for the full endpoint list),
 * using `buildSessionContext()` the same way every other ported module does.
 * The default mock rows (`defaultMockEmployees`) and the "loading only if a
 * session is on record" gate are preserved as-is so the screen still renders
 * something before/without a session, exactly like G2G.
 */

import { useCallback, useEffect, useState } from 'react'

import {
  buildSessionContext,
  EmployeeDirectoryService,
  isEmployeeDirectorySessionReady,
  normalizeEmployeeListItem,
  type Employee,
  type EmployeeListFilters,
  type EmployeeListPagination,
} from './employee-directory-api'

export interface FilterOption {
  id: string
  label: string
  value: string
}

const defaultMockEmployees: Employee[] = [
  {
    id: 1,
    full_name: 'John Doe',
    email: 'john.doe@example.com',
    mobile: '+1 (555) 123-4567',
    department_name: 'Engineering',
    jobRole: 'Senior Developer',
    designation: 'Senior Developer',
    address: 'New York',
    image: '',
    occupation: 'Engineering',
    status: 'Active',
    lastActivity: 'Unknown',
    join_Date: '2023-01-15',
    profile_name: 'Admin',
    skills: [],
  },
  {
    id: 2,
    full_name: 'Jane Smith',
    email: 'jane.smith@example.com',
    mobile: '+1 (555) 987-6543',
    department_name: 'Human Resources',
    jobRole: 'HR Manager',
    designation: 'HR Manager',
    address: 'San Francisco',
    image: '',
    occupation: 'HR',
    status: 'Active',
    lastActivity: 'Unknown',
    join_Date: '2022-11-01',
    profile_name: 'HR Admin',
    skills: [],
  },
]

/**
 * `filters` (department/job-role/status) are forwarded to the API as query
 * params and re-trigger a fetch whenever they change, so the table reflects
 * server-side filtering instead of the previous client-only filtering
 * against hardcoded dropdown options.
 */
export function useEmployeeDirectory(filters?: EmployeeListFilters) {
  const [session] = useState(() => buildSessionContext())
  const ready = isEmployeeDirectorySessionReady(session)

  const [employeesData, setEmployeesData] = useState<Employee[]>(defaultMockEmployees)
  const [loading, setLoading] = useState(ready)
  const [departments, setDepartments] = useState<FilterOption[]>([])
  const [jobRoles, setJobRoles] = useState<FilterOption[]>([])
  const [pagination, setPagination] = useState<EmployeeListPagination | null>(null)

  const departmentFilter = filters?.department_id ?? ''
  const jobRoleFilter = filters?.jobrole_id ?? ''
  const statusFilter = filters?.active_status ?? ''
  const searchFilter = filters?.search ?? ''
  const pageFilter = filters?.page ?? ''
  const perPageFilter = filters?.per_page ?? ''

  const load = useCallback(async () => {
    if (!ready) return
    setLoading(true)
    try {
      const response = await EmployeeDirectoryService.list(session, {
        department_id: departmentFilter,
        jobrole_id: jobRoleFilter,
        active_status: statusFilter,
        search: searchFilter,
        page: pageFilter,
        per_page: perPageFilter,
      })
      const data = response as any
      const raw = Array.isArray(data) ? data : Array.isArray(data?.data) ? data.data : data ? [data] : []
      setEmployeesData(raw.map(normalizeEmployeeListItem))
      setPagination(data?.pagination ?? null)

      if (Array.isArray(data?.departments)) {
        setDepartments(
          data.departments.map((d: any) => ({ id: String(d.id), label: d.department, value: String(d.id) }))
        )
      }
      if (Array.isArray(data?.jobroleList)) {
        setJobRoles(
          data.jobroleList
            .filter((r: any) => r.jobrole)
            .map((r: any) => ({ id: String(r.id), label: r.jobrole, value: String(r.id) }))
        )
      }
    } catch (err) {
      console.error('Failed to fetch employees:', err)
      setEmployeesData(defaultMockEmployees)
      setPagination(null)
    } finally {
      setLoading(false)
    }
  }, [ready, session, departmentFilter, jobRoleFilter, statusFilter, searchFilter, pageFilter, perPageFilter])

  useEffect(() => {
    load()
  }, [load])

  return { employeesData, loading, reload: load, departments, jobRoles, pagination }
}

export type Department = {
  id: string
  name: string
  code: string | null
  description: string | null
  parentId: string | null
  parent: string | null
  hod: string | null
  hodId: string | null
  employees: number
  status: 'Active' | 'Inactive'
  sortOrder: number
  created: string
  updated: string | null
}

export type DeptNode = {
  id: string
  name: string
  code: string | null
  hod: string | null
  employees: number
  status: 'Active' | 'Inactive'
  sortOrder: number
  children: DeptNode[]
  orphaned?: boolean
}

export type DepartmentImpact = {
  total: number
  sub_departments: number
  lms_blocking: number
  department?: string
  breakdown: Array<{ label: string; count: number; blocking: boolean }>
}

export type DepartmentEmployee = {
  id: number
  employee_no?: string | null
  name?: string | null
  department_name?: string | null
}

export type DepartmentJobRole = {
  id: number
  jobrole: string
  description?: string | null
  department_id?: number | null
  department_name?: string | null
}

export type DepartmentsManagementResponse = {
  main_departments: Array<{
    id: number
    department: string
    code: string | null
    description: string | null
    parent_id: number | null
    status: number
    sort_order: number
    head_user_id: number | null
    head_id: number | null
    head_name: string | null
    employee_count: number
    created_at: string
    updated_at: string
  }>
  sub_departments: Record<string, Array<{
    id: number
    department: string
    code: string | null
    description: string | null
    parent_id: number | null
    status: number
    sort_order: number
    head_user_id: number | null
    head_id: number | null
    head_name: string | null
    employee_count: number
    created_at: string
    updated_at: string
  }>>
  departments?: Array<{
    id: number
    department: string
    code: string | null
    description: string | null
    parent_id: number | null
    status: number
    sort_order: number
    head_user_id: number | null
    head_id: number | null
    head_name: string | null
    employee_count: number
    created_at: string
    updated_at: string
  }>
}

/**
 * Shape of `getDepartmentsManagement`'s return value - same envelope as
 * `DepartmentsManagementResponse`, but with every row mapped through
 * `mapDepartment()` into the app-facing `Department` type instead of the
 * raw backend row shape.
 */
export type DepartmentsManagementResult = {
  main_departments: Department[]
  sub_departments: Record<string, Department[]>
  departments?: Department[]
}

export type DepartmentDetail = {
  id: number
  department: string
  code: string | null
  description: string | null
  parent_id: number | null
  status: number
  sort_order: number
  head_user_id: number | null
  head_name: string | null
  employee_count: number
  created_at: string
  updated_at: string
  sub_department_count?: number
  sop_count?: number
  policy_count?: number
  rule_count?: number
}

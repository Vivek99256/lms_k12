import {
  buildSessionContext,
  createAuthHeaders,
  type SessionContext,
} from '@/lib/erp-client'
import type {
  Department,
  DepartmentImpact,
  DepartmentDetail,
  DepartmentsManagementResponse,
  DepartmentsManagementResult,
  DepartmentEmployee,
  DepartmentJobRole,
} from './types'

function readString(value: unknown): string {
  return typeof value === 'string'
    ? value
    : value == null
      ? ''
      : String(value)
}

function apiUrl(path: string, session: SessionContext): string {
  const base = session.baseUrl.replace(/\/$/, '')
  return `${base}/api${path}`
}

async function apiGet<T>(
  session: SessionContext,
  path: string,
  searchParams?: Record<string, string | number | undefined>,
): Promise<T> {
  const url = new URL(apiUrl(path, session))
  if (searchParams) {
    for (const [key, value] of Object.entries(searchParams)) {
      if (value !== undefined && value !== null && value !== '') {
        url.searchParams.set(key, String(value))
      }
    }
  }

  const response = await fetch(url.toString(), {
    method: 'GET',
    cache: 'no-store',
    headers: createAuthHeaders(session, 'application/json'),
  })

  if (!response.ok) {
    const text = await response.text().catch(() => '')
    throw new Error(`API Error: ${response.status} ${response.statusText}${text ? ` - ${text}` : ''}`)
  }

  return response.json()
}

async function apiPost<T>(
  session: SessionContext,
  path: string,
  body: Record<string, unknown>,
): Promise<T> {
  const response = await fetch(apiUrl(path, session), {
    method: 'POST',
    cache: 'no-store',
    headers: createAuthHeaders(session, 'application/json'),
    body: JSON.stringify(body),
  })

  if (!response.ok) {
    const text = await response.text().catch(() => '')
    throw new Error(`API Error: ${response.status} ${response.statusText}${text ? ` - ${text}` : ''}`)
  }

  return response.json()
}

async function apiPut<T>(
  session: SessionContext,
  path: string,
  body: Record<string, unknown>,
): Promise<T> {
  const response = await fetch(apiUrl(path, session), {
    method: 'PUT',
    cache: 'no-store',
    headers: createAuthHeaders(session, 'application/json'),
    body: JSON.stringify(body),
  })

  if (!response.ok) {
    const text = await response.text().catch(() => '')
    throw new Error(`API Error: ${response.status} ${response.statusText}${text ? ` - ${text}` : ''}`)
  }

  return response.json()
}

async function apiPatch<T>(
  session: SessionContext,
  path: string,
  body: Record<string, unknown>,
): Promise<T> {
  const response = await fetch(apiUrl(path, session), {
    method: 'PATCH',
    cache: 'no-store',
    headers: createAuthHeaders(session, 'application/json'),
    body: JSON.stringify(body),
  })

  if (!response.ok) {
    const text = await response.text().catch(() => '')
    throw new Error(`API Error: ${response.status} ${response.statusText}${text ? ` - ${text}` : ''}`)
  }

  return response.json()
}

async function apiDelete<T>(
  session: SessionContext,
  path: string,
): Promise<T> {
  const response = await fetch(apiUrl(path, session), {
    method: 'DELETE',
    cache: 'no-store',
    headers: createAuthHeaders(session, 'application/json'),
  })

  if (!response.ok) {
    const text = await response.text().catch(() => '')
    throw new Error(`API Error: ${response.status} ${response.statusText}${text ? ` - ${text}` : ''}`)
  }

  return response.json()
}

function withAuth(session: SessionContext, extra: Record<string, unknown> = {}) {
  return {
    token: session.token,
    sub_institute_id: session.subInstituteId,
    user_id: session.userId,
    ...extra,
  }
}

function mapDepartment(d: {
  id: number
  department: string
  code: string | null
  description: string | null
  parent_id: number | null
  status: number
  sort_order: number | null
  head_user_id: number | null
  head_id: number | null
  head_name: string | null
  employee_count: number
  created_at: string
  updated_at: string
}): Department {
  return {
    id: String(d.id),
    name: d.department,
    code: d.code,
    description: d.description,
    parentId: d.parent_id && Number(d.parent_id) !== 0 ? String(d.parent_id) : null,
    parent: null,
    hod: d.head_name,
    hodId: d.head_id ? String(d.head_id) : null,
    employees: Number(d.employee_count ?? 0),
    status: Number(d.status) === 1 ? 'Active' : 'Inactive',
    sortOrder: Number(d.sort_order ?? 0),
    created: d.created_at,
    updated: d.updated_at,
  }
}

export const organizationService = {
  async getDepartmentsManagement(session: SessionContext): Promise<DepartmentsManagementResult> {
    const data = await apiGet<DepartmentsManagementResponse>(session, '/departments-management', {
      type: 'API',
      sub_institute_id: session.subInstituteId,
    })

    const names = new Map(
      data.departments
        ? data.departments.map((d) => [String(d.id), d.department])
        : [],
    )

    const map = (dept: DepartmentsManagementResponse['main_departments'][number]): Department => ({
      ...mapDepartment(dept),
      parent: dept.parent_id && Number(dept.parent_id) !== 0
        ? (names.get(String(dept.parent_id)) ?? null)
        : null,
    })

    return {
      ...data,
      main_departments: data.main_departments.map(map),
      sub_departments: Object.fromEntries(
        Object.entries(data.sub_departments).map(([key, depts]) => [
          key,
          depts.map(map),
        ]),
      ) as Record<string, Department[]>,
      departments: data.departments
        ? data.departments.map(map)
        : undefined,
    }
  },

  async getDepartment(session: SessionContext, id: string): Promise<{ status: number; data: DepartmentDetail }> {
    return apiGet(session, `/departments-management/${id}`, {
      type: 'API',
      sub_institute_id: session.subInstituteId,
    })
  },

  async createDepartment(
    session: SessionContext,
    data: { department: string; parent_id?: string; code?: string; description?: string },
  ): Promise<{ status: number; message: string; data: { id: number } }> {
    return apiPost(session, '/departments-management', withAuth(session, {
      department: data.department,
      parent_id: data.parent_id || 0,
      code: data.code,
      description: data.description,
    }))
  },

  async updateDepartment(
    session: SessionContext,
    id: string,
    data: { department?: string; code?: string; description?: string; status?: number; parent_id?: number },
  ): Promise<{ status: number; message: string }> {
    return apiPut(session, `/departments-management/${id}`, withAuth(session, data))
  },

  async deleteDepartment(
    session: SessionContext,
    id: string,
  ): Promise<{ status: number; message: string }> {
    return apiDelete(session, `/departments-management/${id}?token=${session.token}&sub_institute_id=${session.subInstituteId}`)
  },

  async getDepartmentImpact(
    session: SessionContext,
    id: string,
    mode: 'delete' | 'merge',
  ): Promise<{ status?: number; data?: DepartmentImpact }> {
    return apiGet(session, `/departments-management/${id}/impact`, {
      token: session.token,
      sub_institute_id: session.subInstituteId,
      mode,
    })
  },

  async mergeDepartment(
    session: SessionContext,
    id: string,
    targetDepartmentId: string,
  ): Promise<{ status: number; message: string; data?: Record<string, number> }> {
    return apiPost(
      session,
      `/departments-management/${id}/merge?token=${session.token}&sub_institute_id=${session.subInstituteId}`,
      { target_department_id: Number(targetDepartmentId) },
    )
  },

  async setDepartmentHead(
    session: SessionContext,
    id: string,
    headUserId: string | null,
  ): Promise<{ status: number; message: string }> {
    return apiPatch(session, `/departments-management/${id}/head?token=${session.token}&sub_institute_id=${session.subInstituteId}`, {
      head_user_id: headUserId,
    })
  },

  async setDepartmentParent(
    session: SessionContext,
    id: string,
    parentId: string | number,
  ): Promise<{ status: number; message: string }> {
    return apiPatch(session, `/departments-management/${id}/parent?token=${session.token}&sub_institute_id=${session.subInstituteId}`, {
      parent_id: Number(parentId) || 0,
    })
  },

  async reorderDepartment(
    session: SessionContext,
    id: string,
    direction: 'up' | 'down',
  ): Promise<{ status: number; message: string; moved: boolean }> {
    return apiPost(
      session,
      `/departments-management/reorder?token=${session.token}&sub_institute_id=${session.subInstituteId}`,
      { department_id: Number(id), direction },
    )
  },

  departmentExportUrl(session: SessionContext): string {
    const base = session.baseUrl.replace(/\/$/, '')
    const params = new URLSearchParams({
      token: session.token,
      sub_institute_id: session.subInstituteId,
    })
    return `${base}/api/departments-management/export?${params.toString()}`
  },

  async getDepartmentCandidates(
    session: SessionContext,
    options: { search?: string; departmentId?: string; unassigned?: boolean } = {},
  ): Promise<{ status: number; data: DepartmentEmployee[] }> {
    const params: Record<string, string | number> = {
      token: session.token,
      sub_institute_id: session.subInstituteId,
    }
    if (options.search) params.search = options.search
    if (options.departmentId) params.department_id = options.departmentId
    if (options.unassigned) params.unassigned = '1'

    return apiGet(session, '/departments-management/employees', params)
  },

  async getDepartmentJobRoles(
    session: SessionContext,
    departmentId: string,
  ): Promise<{ status?: number; department_id?: number; department_name?: string; data?: DepartmentJobRole[] }> {
    return apiGet(session, '/jobroles-by-department', {
      token: session.token,
      sub_institute_id: session.subInstituteId,
      department_id: departmentId,
    })
  },

  async assignDepartmentEmployees(
    session: SessionContext,
    departmentId: string,
    userIds: Array<string | number>,
    extra: { effective_date?: string; remarks?: string; jobrole_id?: string | number } = {},
  ): Promise<{ status: number; message: string; applied: number; refused: number; rows: Array<{ index: number; user_id: number; ok: boolean; reason: string | null }> }> {
    return apiPost(
      session,
      `/departments-management/${departmentId}/employees?token=${session.token}&sub_institute_id=${session.subInstituteId}`,
      { user_ids: userIds.map(Number), ...extra },
    )
  },

  async unassignDepartmentEmployees(
    session: SessionContext,
    departmentId: string,
    userIds: Array<string | number>,
  ): Promise<{ status: number; message: string; applied: number; refused: number; rows: Array<{ index: number; user_id: number; ok: boolean; reason: string | null }> }> {
    return apiPost(
      session,
      `/departments-management/${departmentId}/employees?token=${session.token}&sub_institute_id=${session.subInstituteId}&_method=DELETE`,
      { user_ids: userIds.map(Number) },
    )
  },
}

'use client';

/**
 * Department Management API client (Add / Edit / Delete).
 *
 * Backed by the new `/api/departments-management*` Laravel endpoints
 * (App\Http\Controllers\HRMS\departmentController@storeManagement /
 * updateManagement / destroyManagement). Distinct from the existing,
 * untouched `/api/departments/hierarchy` GET used elsewhere in
 * `Department/page.tsx` for reads.
 *
 * Auth follows the same JWT pattern already used by other `_lib` API
 * clients in this codebase (see `app/hrit/_lib/leave-api.ts`): the token
 * goes both as an `Authorization: Bearer` header (via `createAuthHeaders`)
 * and as a `token` field in the request body/query, because the Laravel
 * side (`managementTokenContext`) reads it via `$request->input('token')`.
 */

import {
  buildSessionContext,
  createAuthHeaders,
  type ApiEnvelope,
  type SessionContext,
} from '@/lib/erp-client';

export { buildSessionContext };
export type { SessionContext };

export type DepartmentManagementResponse = ApiEnvelope & {
  data?: { id?: number };
};

function messageFrom(payload: unknown, fallback: string): string {
  if (payload && typeof payload === 'object') {
    const message = (payload as ApiEnvelope).message;
    if (typeof message === 'string' && message.trim()) return message;
  }
  return fallback;
}

function isSuccess(payload: DepartmentManagementResponse): boolean {
  const status = String(payload.status ?? '');
  return status === '1' || status === '1.0';
}

async function request(
  session: SessionContext,
  method: 'POST' | 'PUT' | 'PATCH' | 'DELETE',
  path: string,
  body: Record<string, unknown>
): Promise<DepartmentManagementResponse> {
  const base = session.baseUrl.replace(/\/$/, '');
  const url = `${base}/api${path}`;

  const response = await fetch(url, {
    method,
    cache: 'no-store',
    headers: createAuthHeaders(session, 'application/json'),
    body: JSON.stringify(body),
  });

  const payload = (await response.json().catch(() => ({}))) as DepartmentManagementResponse;

  if (!response.ok || !isSuccess(payload)) {
    throw new Error(messageFrom(payload, `API Error: ${response.status} ${response.statusText}`));
  }

  return payload;
}

function withAuthParams(session: SessionContext, extra: Record<string, unknown>) {
  return {
    token: session.token,
    sub_institute_id: session.subInstituteId,
    user_id: session.userId,
    ...extra,
  };
}

export async function createDepartment(
  session: SessionContext,
  params: {
    department: string;
    parentId?: number | string | null;
    /** Optional short code, e.g. "ENG-QA". */
    code?: string;
    /** Optional free-text description of what the department is responsible for. */
    description?: string;
  }
): Promise<DepartmentManagementResponse> {
  return request(
    session,
    'POST',
    '/departments-management',
    withAuthParams(session, {
      department: params.department,
      parent_id: params.parentId || 0,
      ...(params.code !== undefined ? { code: params.code } : {}),
      ...(params.description !== undefined ? { description: params.description } : {}),
    })
  );
}

/**
 * `department` stays the only field every existing caller (the plain
 * "Edit department" dialog) sends, and remains required there. `code`,
 * `description` and `status` are additive, optional fields - a caller can
 * send just `{ status: 0 }` (as the department creation wizard does, to mark
 * a freshly-created department a draft) without also sending a name.
 */
export async function updateDepartment(
  session: SessionContext,
  id: number | string,
  params: {
    department?: string;
    code?: string;
    description?: string;
    /** 0 = inactive/draft, 1 = active. */
    status?: 0 | 1;
    /**
     * New parent department id, or 0/null for "make top-level". Only sent
     * when provided - the caller decides whether it actually changed (the
     * backend's cycle-check rejects a parent that is the department's own
     * descendant, and there's no reason to risk that on an edit that didn't
     * touch parent at all).
     */
    parentId?: number | string | null;
  }
): Promise<DepartmentManagementResponse> {
  return request(
    session,
    'PUT',
    `/departments-management/${id}`,
    withAuthParams(session, {
      ...(params.department !== undefined ? { department: params.department } : {}),
      ...(params.code !== undefined ? { code: params.code } : {}),
      ...(params.description !== undefined ? { description: params.description } : {}),
      ...(params.status !== undefined ? { status: params.status } : {}),
      ...(params.parentId !== undefined ? { parent_id: params.parentId || 0 } : {}),
    })
  );
}

export async function deleteDepartment(
  session: SessionContext,
  id: number | string
): Promise<DepartmentManagementResponse> {
  return request(
    session,
    'DELETE',
    `/departments-management/${id}`,
    withAuthParams(session, {})
  );
}

export type DepartmentImpact = {
  department: { id: number; department: string };
  sub_departments: number;
  records: Record<string, number>;
  total_records: number;
};

export async function getDepartmentImpact(
  session: SessionContext,
  id: number | string
): Promise<DepartmentImpact> {
  const base = session.baseUrl.replace(/\/$/, '');
  const params = new URLSearchParams(
    withAuthParams(session, {}) as Record<string, string>
  );
  const url = `${base}/api/departments-management/${id}/impact?${params.toString()}`;

  const response = await fetch(url, {
    method: 'GET',
    cache: 'no-store',
    headers: createAuthHeaders(session, 'application/json'),
  });

  const payload = (await response.json().catch(() => ({}))) as DepartmentManagementResponse & {
    data?: DepartmentImpact;
  };

  if (!response.ok || !isSuccess(payload) || !payload.data) {
    throw new Error(messageFrom(payload, `API Error: ${response.status} ${response.statusText}`));
  }

  return payload.data;
}

/**
 * PATCH /api/departments-management/{id}/head
 *
 * Backs "Assign / change HOD". `headUserId: null` clears the current head
 * (mirrors `departmentController@setHead`'s "empty means unset" handling).
 */
export async function setDepartmentHead(
  session: SessionContext,
  id: number | string,
  headUserId: number | string | null
): Promise<DepartmentManagementResponse> {
  return request(
    session,
    'PATCH',
    `/departments-management/${id}/head`,
    withAuthParams(session, {
      head_user_id: headUserId === null || headUserId === '' ? null : Number(headUserId),
    })
  );
}

export async function mergeDepartments(
  session: SessionContext,
  params: { sourceId: number | string; targetId: number | string }
): Promise<DepartmentManagementResponse> {
  return request(
    session,
    'POST',
    '/departments-management/merge',
    withAuthParams(session, {
      source_id: params.sourceId,
      target_id: params.targetId,
    })
  );
}

/** One row from GET /departments-management/employees. */
export type DepartmentEmployee = {
  id: number;
  employee_no?: string | null;
  department_id?: number | null;
  department_name?: string | null;
  name?: string | null;
};

/**
 * GET /api/departments-management/employees
 *
 * Wraps `departmentController@employees` (already existed before this
 * wizard step was built). No filter = every tenant employee (the HOD
 * picker's use case elsewhere on this page); `departmentId` = that
 * department's current staff, for "current employees" and "transfer from";
 * `unassigned: true` = employees with no department, for the assign pool.
 */
export async function getDepartmentEmployees(
  session: SessionContext,
  options: {
    departmentId?: number | string;
    unassigned?: boolean;
    search?: string;
    /** Caps how many rows come back - a small default list loads far faster than the full 500-row cap. */
    limit?: number;
  } = {}
): Promise<DepartmentEmployee[]> {
  const base = session.baseUrl.replace(/\/$/, '');
  const params = new URLSearchParams(
    withAuthParams(session, {
      ...(options.departmentId ? { department_id: options.departmentId } : {}),
      ...(options.unassigned ? { unassigned: '1' } : {}),
      ...(options.search ? { search: options.search } : {}),
      ...(options.limit ? { limit: options.limit } : {}),
    }) as Record<string, string>
  );
  const url = `${base}/api/departments-management/employees?${params.toString()}`;

  const response = await fetch(url, {
    method: 'GET',
    cache: 'no-store',
    headers: createAuthHeaders(session, 'application/json'),
  });

  const payload = (await response.json().catch(() => ({}))) as DepartmentManagementResponse & {
    data?: DepartmentEmployee[];
  };

  if (!response.ok || !isSuccess(payload)) {
    throw new Error(messageFrom(payload, `API Error: ${response.status} ${response.statusText}`));
  }

  return payload.data ?? [];
}

export type BulkEmployeeResult = { applied: number; refused: number; message?: string };

/**
 * POST /api/departments-management/{id}/employees
 *
 * Moves employees into `departmentId` - transfer from another department,
 * or assign from the unassigned pool. `jobroleId` is optional and, when
 * given, must be one of this department's own roles (the backend refuses -
 * clears, not errors - a role from anywhere else). Omitting it clears
 * whatever role the employee previously held, matching G2G's
 * assignDepartmentEmployees rationale: a role belongs to exactly one
 * department, so a plain move must not leave someone holding a stale one.
 */
export async function assignDepartmentEmployees(
  session: SessionContext,
  departmentId: number | string,
  employeeIds: Array<number | string>,
  extra: { jobroleId?: number | string; remarks?: string } = {}
): Promise<BulkEmployeeResult> {
  const response = await request(
    session,
    'POST',
    `/departments-management/${departmentId}/employees`,
    withAuthParams(session, {
      user_ids: employeeIds.map(Number),
      ...(extra.jobroleId ? { jobrole_id: extra.jobroleId } : {}),
      ...(extra.remarks ? { remarks: extra.remarks } : {}),
    })
  );
  const data = (response as DepartmentManagementResponse & { data?: BulkEmployeeResult }).data;
  return { applied: data?.applied ?? 0, refused: data?.refused ?? 0, message: response.message };
}

/**
 * DELETE /api/departments-management/{id}/employees
 *
 * Removes employees from `departmentId` (clears their department + job
 * role). Backs the "Remove" action on the current-employees roster.
 */
export async function unassignDepartmentEmployees(
  session: SessionContext,
  departmentId: number | string,
  employeeIds: Array<number | string>
): Promise<BulkEmployeeResult> {
  const response = await request(
    session,
    'DELETE',
    `/departments-management/${departmentId}/employees`,
    withAuthParams(session, { user_ids: employeeIds.map(Number) })
  );
  const data = (response as DepartmentManagementResponse & { data?: BulkEmployeeResult }).data;
  return { applied: data?.applied ?? 0, refused: data?.refused ?? 0, message: response.message };
}

export async function reorderDepartments(
  session: SessionContext,
  order: Array<{ id: number | string; sortOrder: number }>
): Promise<DepartmentManagementResponse> {
  return request(
    session,
    'POST',
    '/departments-management/reorder',
    withAuthParams(session, {
      order: order.map((row) => ({ id: row.id, sort_order: row.sortOrder })),
    })
  );
}

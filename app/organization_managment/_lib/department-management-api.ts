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
  method: 'POST' | 'PUT' | 'DELETE',
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
  params: { department: string; parentId?: number | string | null }
): Promise<DepartmentManagementResponse> {
  return request(
    session,
    'POST',
    '/departments-management',
    withAuthParams(session, {
      department: params.department,
      parent_id: params.parentId || 0,
    })
  );
}

export async function updateDepartment(
  session: SessionContext,
  id: number | string,
  params: { department: string }
): Promise<DepartmentManagementResponse> {
  return request(
    session,
    'PUT',
    `/departments-management/${id}`,
    withAuthParams(session, {
      department: params.department,
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

import { NextRequest, NextResponse } from 'next/server';

import { requireSession } from '@/lib/security/session-token';

/**
 * Shared, in-memory store for the integration-configs stub routes.
 *
 * Laravel does not yet expose `/task-management/integration-configs`, so these
 * routes hold configs in this process until it does. Two rules the stub used to
 * miss: every call needs a real session token (not just any Authorization
 * header), and records belong to one institute — a caller only ever sees and
 * changes its own institute's configs. Both route files share this one store;
 * previously the list route kept a separate array, so edits to a new record 404'd.
 */

export type IntegrationConfig = {
  id: number;
  tenant_id: string;
  provider_key: string;
  display_name: string;
  category: string;
  description: string | null;
  status: 'active' | 'inactive' | 'error';
  config: Record<string, string | number | boolean | null>;
  last_tested_at: string | null;
  last_tested_by: string | null;
  last_updated_at: string | null;
  last_updated_by: string | null;
  created_at: string | null;
};

declare global {
  var integrationRecords: IntegrationConfig[] | undefined;
  var integrationNextId: number | undefined;
}

export function records(): IntegrationConfig[] {
  if (!globalThis.integrationRecords) globalThis.integrationRecords = [];
  return globalThis.integrationRecords;
}

export function nextId(): number {
  const id = globalThis.integrationNextId ?? 1;
  globalThis.integrationNextId = id + 1;
  return id;
}

export interface Caller {
  tenantId: string;
  userId: string;
}

/** The caller's institute and user, or a 401 response to return. */
export function callerOf(request: NextRequest): Caller | NextResponse {
  const session = requireSession(request);
  const tenantId = session?.claims.sub_institute_id || request.headers.get('x-sub-institute-id')?.trim() || '';
  if (!session || !tenantId) {
    return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
  }
  return { tenantId, userId: session.claims.id };
}

/** The record as the API returns it — without the internal tenant tag. */
export function present(record: IntegrationConfig) {
  const { tenant_id: _tenant, ...rest } = record;
  void _tenant;
  return rest;
}

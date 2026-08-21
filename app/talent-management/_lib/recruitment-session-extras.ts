'use client'

/**
 * Extra session fields G2G's `readLaravelSession()` exposed (`org_type`,
 * `APP_URL`) that this repo's narrower `SessionContext`
 * (`buildSessionContext()` in `lib/erp-client.ts`) does not carry.
 *
 * Used only by `job-posting-form.tsx`, which — like G2G's own
 * `job-posting-form.tsx` — calls two Laravel routes directly (`/table_data`,
 * `/jobrole_library/create`) instead of going through `recruitmentService`,
 * because they are generic table lookups shared across modules, not
 * recruitment-specific endpoints. `orgType()` reads the same `userData`
 * localStorage record `lib/erp-client.ts` reads, narrowed to the one extra
 * field needed. `session.baseUrl` (from `buildSessionContext()`) is this
 * repo's equivalent of G2G's `session.APP_URL` — both are the bare Laravel
 * host with no `/api` prefix, which is exactly what these two routes expect.
 */
export function readOrgType(): string {
  if (typeof window === 'undefined') return ''
  try {
    const raw = localStorage.getItem('userData') ?? sessionStorage.getItem('userData') ?? '{}'
    const parsed = JSON.parse(raw) as unknown
    const record = parsed && typeof parsed === 'object' ? (parsed as Record<string, unknown>) : {}
    return typeof record.org_type === 'string' ? record.org_type : ''
  } catch {
    return ''
  }
}

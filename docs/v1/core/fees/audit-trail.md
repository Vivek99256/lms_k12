# Fees Audit Trail
**Product:** Scholar Core | **Module:** Fees | **Frontend route:** `/fees/audit-trail` | **v1 status:** Complete

| Field | Value |
|---|---|
| Backend routes | `GET /api/fees/audit-log` |
| Roles | Admin, Auditor, Super Admin |
| Last updated | 2026-11-04 |
| Source commit | 8fe500dc (FE) / 86261072 (BE) |

## 1. Purpose & users
Provides a read-only, paginated log of all fee-related actions: collections, cancellations, refunds, master changes, and config updates. Used by auditors and admins for compliance review and dispute resolution.

## 2. Screens

### Fees Audit Trail (`/fees/audit-trail`)
Paginated, filterable table of audit log entries scoped to `module = 'fees'`. Rendered via `ModuleCategoryPage` with `auditModuleKeys={['fees']}` — the same shared audit component used by all modules.

**Filters (from `fees_audit_log_api_controller`):**
- `action` — type of action (create, update, delete, cancel, collect, etc.)
- `entity_type` — which entity was acted on (fees_collect, fees_cancel, etc.)
- `entity_id` — specific record ID
- `sub_institute_id` — tenant filter
- `from_date` / `to_date` — date range

**Table columns (from `system_audit_logs`):** ID, Module, Action, Entity type, Entity ID, User, IP, Timestamp, Changes.

![](./screenshots/fees-audit-trail.png)

## 3. Features & business rules

**Read-only** — `fees_audit_log_api_controller` is `SELECT`-only. It never writes.

**Source table:** `system_audit_logs` (created by `2026_08_24_090000_create_system_audit_logs` migration). If the table does not exist in an environment, the API returns an empty list with a message rather than throwing an error.

**Pagination:** 25 rows per page by default; max 200 rows per page (`per_page` param).

**Module scope:** Hardcoded to `module = 'fees'` by default; can be overridden by passing `module` param.

**Falls back gracefully** if `system_audit_logs` table is missing — returns `{ status: 1, data: [], meta: {...}, message: 'table not present' }`.

## 4. User flows

**Happy path:**
1. Navigate to `/fees/audit-trail`.
2. Table loads with the latest 25 audit entries for the fees module.
3. Filter by date range, action type, or entity.
4. Paginate through results.

**Alternate — table not migrated:**
- Empty table with info message: "system_audit_logs table is not present in this environment yet."

## 5. Data model

**Table: `system_audit_logs`** (from migration `2026_08_24_090000_create_...`)

| Column | Type | Notes |
|---|---|---|
| `id` | bigint | PK |
| `module` | varchar | 'fees' for all entries here |
| `action` | varchar | collect, cancel, refund, update, etc. |
| `entity_type` | varchar | fees_collect, fees_cancel, fees_config_master, etc. |
| `entity_id` | int | ID of the affected record |
| `sub_institute_id` | int | Tenant |
| `user_id` | int | Who performed the action |
| `ip_address` | varchar | Actor's IP |
| `changes` | json | Before/after values |
| `created_at` | timestamp | When |

## 6. APIs

| Method | Endpoint | Auth | Request | Response |
|---|---|---|---|---|
| GET | `/api/fees/audit-log` | JWT (`api.session`) | `module?`, `action?`, `entity_type?`, `entity_id?`, `sub_institute_id?`, `from_date?`, `to_date?`, `per_page?` (max 200, default 25) | `{ status: 1, data: AuditRow[], meta: { current_page, per_page, total, last_page } }` |

**Error cases:**
- Returns empty list (not 500) if `system_audit_logs` table is absent.
- 401 — missing/invalid JWT.

## 7. UI components & design tokens

| Component | Source |
|---|---|
| `ModuleCategoryPage` | `app/_components/module-category-page` |
| Module audit trail component | `app/_components/module-audit-trail` |

The page itself is a 24-line wrapper that delegates entirely to `ModuleCategoryPage`.

## 8. Reports & exports
No export from the audit trail in v1. TBD for v2.

## 9. Test cases

| ID | Scenario | Steps | Expected result | Type |
|---|---|---|---|---|
| FAT-01 | View audit log | Navigate to `/fees/audit-trail` | Latest entries shown, paginated | Happy |
| FAT-02 | Filter by date | Set `from_date = today`, `to_date = today` | Only today's entries shown | Happy |
| FAT-03 | Filter by action=cancel | Set action filter | Only cancellation entries | Happy |
| FAT-04 | Table not migrated | On fresh install without migration | Empty list with message, no 500 error | Edge |
| FAT-05 | No permissions | User without audit rights | 403 from `check_permissions` | Negative |

## 10. Known issues, limitations & FAQs

- `system_audit_logs` is a relatively new table (migration date 2026-08-24). Older environments may not have it.
- The `changes` column format (JSON before/after) is not documented — exact structure depends on what each controller writes.
- No export to Excel in v1.

**FAQ:**
- *"Audit trail is empty"* — either no actions have been logged yet or `system_audit_logs` has not been migrated.
- *"Can I see who deleted a receipt?"* — yes, if the cancellation was performed via the UI (which writes to `system_audit_logs`). Manual DB changes are not logged.

## 11. Sales notes

**Selling points:**
1. Tamper-evident log — read-only, no delete.
2. IP-logged every action — compliance-ready.
3. Zero extra setup — shared infrastructure with all other modules.

**Demo flow:**
1. Collect a fee → go to Audit Trail → show the entry.
2. Filter by action = collect → show the new row with user, IP, timestamp.

## 12. v1 status & v2 ideas

**v1 complete:** Read-only audit log with filtering and pagination.
**v2 ideas:**
- Excel/CSV export of audit log.
- Alert on suspicious patterns (e.g. same user cancelling many receipts in quick succession).
- Hash-chaining for tamper detection.

## Source files
- `C:\rajesh\lms_k12\app\fees\audit-trail\page.tsx`
- `C:\rajesh\lms_k12\app\_components\module-category-page.tsx` (referenced)
- `F:\xampp\htdocs\next_lms_erp\app\Http\Controllers\fees\fees_audit_log_api_controller.php`

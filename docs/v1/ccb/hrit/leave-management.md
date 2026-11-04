# Leave Management
**Product:** Scholar CCB | **Module:** HRIT — Leave Management | **Frontend route:** `/hrit/leave-management/leave-requests` (and sub-routes) | **v1 status:** Complete

| Field | Value |
|---|---|
| Backend routes | `GET/POST /api/leave/requests`, `POST /api/leave/requests/{id}/decision`, `POST /api/leave/requests/bulk-decision`, `DELETE /api/leave/requests/{id}`, `GET /api/leave/dashboard`, `GET /api/leave/options`, `GET /api/leave/balances` |
| Roles | Employee (apply), Manager (approve/reject), HR Admin (full access) |
| Last updated | 2026-11-04 |
| Source commit | 8fe500dc (FE) / 86261072 (BE) |

## 1. Purpose & users

Employees apply for leave; managers and HR approve or reject. Tracks leave balances, enforces leave types, and maintains an audit trail. Used daily during leave events; used monthly by HR for leave register reports.

## 2. Screens

### Leave Dashboard
Route: `/hrit/leave-management/leave-dashboard`
- KPI cards: total leaves taken, pending approvals, leave balance, upcoming holidays
- Trend chart: `GET /api/leave/trend`
- Department summary: `GET /api/leave/department-summary`
- Leave type distribution: `GET /api/leave/type-distribution`
- Upcoming holidays: `GET /api/leave/holidays/upcoming`

### Leave Requests
Route: `/hrit/leave-management/leave-requests`
- Tabular list of leave requests with status badges (Pending / Approved / Rejected / Sent Back / Cancelled / Approved LWP)
- Filters: Status (saved presets: "My Pending Approvals", "Approved This Year", "Rejected requests"), Employee search
- Actions per row: View details, Approve, Reject, Send Back, Cancel
- Bulk decision: select multiple rows → approve/reject all
- Apply Leave drawer (floating form): leave type, start date, end date, reason
- CSV export (client-side)
- PAGE_SIZE = 10

### Leave Reports
Route: `/hrit/leave-management/leave-reports`
- Summary, Register, Balance views
- Backend: `GET /api/leave/reports/summary`, `GET /api/leave/reports/register`, `GET /api/leave/reports/balance`

![](./screenshots/leave-requests.png)

## 3. Features & business rules

| Field | Type | Required | Validation | Notes |
|---|---|---|---|---|
| Leave type | Select | Yes | From `leave_types` | CL, SL, PL, LWP, etc. |
| Start date | Date | Yes | Not in past (TBD) | |
| End date | Date | Yes | ≥ start date | |
| Reason | Text | No | Max TBD | |
| Status | Enum | — | pending, approved, rejected, sent-back, cancelled, approved_lwp | |
| Carry forward | Boolean | — | Configured per leave type | Added `2026_08_17` migration |

**Permission rules:**
- Employee can apply for self; can cancel own pending request
- Manager sees direct reports; can approve/reject/send-back
- HR Admin sees all; can override
- Bulk decision requires Manager or HR Admin role

**Leave year:** April–March (resolved via `ResolvesLeaveContext` concern)

**Soft delete:** Leave requests support `DELETE /api/leave/requests/{id}` (cancel/delete)

## 4. User flows

**Happy path — Apply leave:**
1. Employee clicks "Apply Leave" → ApplyLeaveDrawer opens
2. Selects type, dates, adds reason → Submit → `POST /api/leave/requests`
3. Status = `pending`; manager sees it in "My Pending Approvals"
4. Manager opens request → `GET /api/leave/requests/{id}` → clicks Approve → `POST /api/leave/requests/{id}/decision` body `{decision: "approved"}`
5. Employee's balance decremented; request shows Approved

**Alternate — Sent Back:**
Manager clicks "Send Back" with a note → employee gets notified → can resubmit with revision

**Alternate — Bulk approval:**
Manager selects multiple pending rows → "Bulk Approve" → `POST /api/leave/requests/bulk-decision`

## 5. Data model

| Table | Key columns |
|---|---|
| `hrms_emp_leaves` | `id`, `sub_institute_id`, `employee_id`, `leave_type_id`, `from_date`, `to_date`, `no_of_days`, `reason`, `status` (enum extended 2026-08-17), `approved_by`, `created_at`, audit cols |
| `hrms_leave_types` | `id`, `leave_type`, `max_days`, `carry_forward` (added 2026-08-17), `sort_order`, `sub_institute_id` |
| `hrms_leave_allocation` | `id`, `sub_institute_id`, `department_id`, `employee_id` (nullable — null = department-level), `leave_type_id`, `days`, `year` |
| `hrms_holidays` | `id`, `holiday_name`, `holiday_date`, `sub_institute_id` |
| `hrms_weekdays` | `day_of_week`, `is_working`, `sub_institute_id` |
| `hrms_leave_workflow_settings` | Approval chain configuration (added 2026-08-17) |
| `hrms_leave_role_permissions` | Role-level access rules (added 2026-08-17) |

## 6. APIs

| Method | Endpoint | Auth | Request | Response |
|---|---|---|---|---|
| GET | `/api/leave/dashboard` | JWT | — | KPI counts, trend data |
| GET | `/api/leave/trend` | JWT | `?period=` | Trend series |
| GET | `/api/leave/options` | JWT | — | Leave types, departments |
| GET | `/api/leave/balances` | JWT | — | Current employee balances |
| GET | `/api/leave/requests` | JWT | `?status=&page=` | Paginated leave requests |
| POST | `/api/leave/requests` | JWT | `{leave_type_id, from_date, to_date, reason}` | Created request |
| GET | `/api/leave/requests/{id}` | JWT | — | Single request detail |
| POST | `/api/leave/requests/{id}/decision` | JWT | `{decision, remarks}` | Updated request |
| POST | `/api/leave/requests/bulk-decision` | JWT | `{ids[], decision}` | Bulk result |
| DELETE | `/api/leave/requests/{id}` | JWT | — | 204 No Content |
| GET | `/api/leave/reports/summary` | JWT | `?year=&department_id=` | Summary report |
| GET | `/api/leave/reports/register` | JWT | `?year=&department_id=` | Full register |
| GET | `/api/leave/reports/balance` | JWT | `?year=` | Balance report |

## 7. UI components & design tokens

- `DataTable` with `Column` type definitions
- `StatusBadge` — color-coded per status (pending=yellow, approved=green, rejected=red, sent-back=orange)
- `Select` (g2g variant) — filter dropdowns
- `SearchInput`, `Avatar`, `AvatarFallback`
- `DropdownMenu` — per-row actions
- `AlertDialog` — confirmation dialogs
- `Skeleton`, `ErrorState` — loading/error states
- Lazy-loaded drawers (`LeaveRequestDetailsDrawer`, `ApplyLeaveDrawer`)

## 8. Reports & exports

- Leave Summary Report: `GET /api/leave/reports/summary`
- Leave Register: `GET /api/leave/reports/register`
- Leave Balance: `GET /api/leave/reports/balance`
- CSV export: client-side from request list (see `toCsvValue` utility in page.tsx)
- See [leave-configuration.md](leave-configuration.md) for holiday calendar

## 9. Test cases

| ID | Scenario | Steps | Expected result | Type |
|---|---|---|---|---|
| LM-01 | Apply leave — happy path | Apply CL for 1 day | Request created with status pending | Happy |
| LM-02 | Apply leave overlapping dates | Apply leave on dates already taken | Error returned (TBD — validation in controller) | Negative |
| LM-03 | Manager approves | Open pending request → Approve | Status = approved; balance reduced | Happy |
| LM-04 | Bulk reject | Select 3 pending → Bulk Reject | All 3 rejected in one call | Happy |
| LM-05 | Cancel own leave | Employee cancels own pending request | Status = cancelled | Happy |
| LM-06 | Balance insufficient | Apply leave exceeding balance | TBD — controller validation | Edge |
| LM-07 | Leave year boundary | Apply leave spanning April 1 | Correct year context resolves | Edge |

## 10. Known issues, limitations & FAQs

- Leave balance deduction logic is server-side; the frontend reads balances via `GET /api/leave/balances` but does not enforce limits — server must reject over-limit requests.
- Status enum was extended in `2026_08_17` migration (added `sent-back`, `approved_lwp`, `cancelled`); older rows with legacy status values may need a data migration.
- Workflow approval chain (multi-level) is configured in `hrms_leave_workflow_settings` but the UI for configuring it is under Leave Configuration, not visible in the requests page.

## 11. Sales notes

- **Key differentiator:** Full leave lifecycle — apply, approve, send-back, cancel — with balance auto-deduction; no paper forms.
- **Demo flow:** Log in as employee → Apply CL for 2 days → switch to manager login → see pending → Approve → show balance updated → show Leave Register report.
- **For principals:** Department summary chart shows which teams have high absenteeism before it impacts operations.

## 12. v1 status & v2 ideas

**Complete:** Apply, approve, reject, bulk-decision, cancel, balance tracking, dashboard charts, three report types, CSV export.
**Partial:** Multi-level approval workflow (config tables exist; UI confirmation pending).
**v2:** Integration with calendar (block teacher timetable when on leave); AI-suggested leave substitutions; predictive absenteeism alerts in Enterprise Brain.

## Source files

- `C:\rajesh\lms_k12\app\hrit\leave-management\leave-requests\page.tsx`
- `C:\rajesh\lms_k12\app\hrit\leave-management\leave-dashboard\page.tsx`
- `C:\rajesh\lms_k12\app\hrit\_lib\use-leave.ts` (referenced)
- `C:\rajesh\lms_k12\app\hrit\_lib\leave-api.ts` (referenced)
- `C:\rajesh\lms_k12\app\hrit\_lib\hrit-types.ts` (referenced)
- `F:\xampp\htdocs\next_lms_erp\app\Http\Controllers\HRMS\HrmsLeaveController.php`
- `F:\xampp\htdocs\next_lms_erp\routes\api.php` (lines 1017–1066)
- Migrations: `2023_05_15_220543_create_hrms_leave_types_table.php`, `2023_05_21_151219_create_hrms_emp_leaves_table.php`, `2024_01_10_173555_create_hrms_leave_allocation_table.php`, `2026_08_17_100100_create_hrms_leave_workflow_settings_table.php`, `2026_08_17_100400_extend_hrms_emp_leaves_status_enum.php`

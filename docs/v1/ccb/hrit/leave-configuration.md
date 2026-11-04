# Leave Configuration
**Product:** Scholar CCB | **Module:** HRIT — Leave Management | **Frontend route:** `/hrit/leave-management/leave-configuration` | **v1 status:** Complete

| Field | Value |
|---|---|
| Backend routes | `GET/POST /api/leave/leave-types`, `PUT/PATCH /api/leave/leave-types/{id}`, `DELETE /api/leave/leave-types/{id}`, `GET/POST /api/leave/holidays`, `PUT /api/leave/holidays/{id}`, `GET/POST /api/leave/weekdays`, `GET/PUT /api/leave/workflow`, `GET/PUT /api/leave/roles` |
| Roles | HR Admin, Super Admin |
| Last updated | 2026-11-04 |
| Source commit | 8fe500dc (FE) / 86261072 (BE) |

## 1. Purpose & users

One-time and periodic setup screen for HR Admin. Defines leave types (CL, SL, PL, etc.), allocates days per department/employee, sets holidays, configures weekly off pattern, and configures the approval workflow chain.

## 2. Screens

### Leave Configuration
- **Leave Types tab** — CRUD for leave types; toggle active/inactive
- **Holidays tab** — add/edit/delete holidays for the year
- **Weekly Off tab** — configure which weekdays are working days
- **Approval Workflow tab** — configure multi-level approval chain
- **Role Permissions tab** — which roles can approve/view leave

![](./screenshots/leave-configuration.png)

## 3. Features & business rules

| Field | Type | Required | Validation | Notes |
|---|---|---|---|---|
| Leave type name | varchar(255) | Yes | Unique per institute | e.g. CL, SL, PL, LWP |
| Max days | int | Yes | > 0 | Annual entitlement |
| Carry forward | boolean | No | — | Added `2026_08_17` |
| Sort order | int | No | — | Display order |
| Holiday date | date | Yes | Unique per institute per year | |
| Holiday name | varchar | Yes | — | |
| Weekday working | boolean | — | Per day Mon–Sun | |

**Approval workflow:** Configured in `hrms_leave_workflow_settings`. Level 1 = direct manager, Level 2 = department head, etc. TBD — full config UI not read.

## 4. User flows

**Add leave type:**
1. HR Admin → Leave Configuration → Leave Types tab
2. Click "Add" → fill name, max days, carry forward
3. Submit → `POST /api/leave/leave-types`

**Add holiday:**
1. Holidays tab → "Add Holiday" → date + name
2. Submit → `POST /api/leave/holidays`

**Configure workflow:**
1. Workflow tab → set levels and approver roles
2. Save → `PUT /api/leave/workflow`

## 5. Data model

See [leave-management.md](leave-management.md) § 5 — same tables (`hrms_leave_types`, `hrms_holidays`, `hrms_weekdays`, `hrms_leave_workflow_settings`, `hrms_leave_role_permissions`).

## 6. APIs

| Method | Endpoint | Purpose |
|---|---|---|
| GET/POST | `/api/leave/leave-types` | List / create leave types |
| PUT | `/api/leave/leave-types/{id}` | Update |
| PATCH | `/api/leave/leave-types/{id}/status` | Toggle active |
| DELETE | `/api/leave/leave-types/{id}` | Soft delete |
| GET/POST | `/api/leave/holidays` | List / create holidays |
| PUT | `/api/leave/holidays/{id}` | Update holiday |
| DELETE | `/api/leave/holidays/{id}` | Delete holiday |
| GET/POST | `/api/leave/weekdays` | Get/set weekday pattern |
| GET/PUT | `/api/leave/workflow` | Get/save approval chain |
| GET/PUT | `/api/leave/roles` | Get/save role access |

## 7. UI components & design tokens

TBD — page.tsx content not read. Likely uses `DataTable`, `Select`, `Button`, `AlertDialog` matching the rest of the HRIT UI.

## 8. Reports & exports

None — configuration screen only.

## 9. Test cases

| ID | Scenario | Steps | Expected result | Type |
|---|---|---|---|---|
| LC-01 | Add leave type | Add "PL" with 12 days | Type appears in leave application dropdown | Happy |
| LC-02 | Duplicate leave type name | Add "CL" when CL exists | Validation error returned | Negative |
| LC-03 | Add holiday | Add Republic Day 2027-01-26 | Appears in upcoming holidays on dashboard | Happy |
| LC-04 | Toggle leave type inactive | Disable SL | SL no longer available in apply form | Happy |

## 10. Known issues, limitations & FAQs

- Leave allocation (days per department/employee) is configured via `HrmsLeaveController@index` / `store` (Blade-era endpoints); no dedicated API route found in the Next.js prefix. May still route through legacy web routes.

## 11. Sales notes

- Annual one-time setup. Useful demo: "Set up your institute's leave policy in 5 minutes — leave types, holidays, and approval chain — and it's live for all staff immediately."

## 12. v1 status & v2 ideas

**Complete:** Leave types CRUD, holidays, weekday pattern, workflow, role permissions.
**v2:** Carry-forward automation at year-end; leave encashment configuration; pro-rata allocation for mid-year joiners.

## Source files

- `C:\rajesh\lms_k12\app\hrit\leave-management\leave-configuration\page.tsx`
- `F:\xampp\htdocs\next_lms_erp\routes\api.php` (lines 1042–1065)
- `F:\xampp\htdocs\next_lms_erp\app\Http\Controllers\api\Leave\LeaveTypeApiController.php`
- `F:\xampp\htdocs\next_lms_erp\app\Http\Controllers\api\Leave\HolidayApiController.php`
- `F:\xampp\htdocs\next_lms_erp\app\Http\Controllers\api\Leave\LeaveWorkflowApiController.php`

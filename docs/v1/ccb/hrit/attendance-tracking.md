# Attendance Tracking
**Product:** Scholar CCB | **Module:** HRIT — Attendance Management | **Frontend route:** `/hrit/attendance-management/attendance-tracking` | **v1 status:** Complete

| Field | Value |
|---|---|
| Backend routes | `GET /api/attendance/my-attendance`, `POST /api/attendance/punch-in`, `POST /api/attendance/punch-out`, `GET /api/attendance/kpi`, `GET /api/attendance/weekly-summary` |
| Roles | Admin, HR Admin, Employee (self-service), Manager |
| Last updated | 2026-11-04 |
| Source commit | 8fe500dc (FE) / 86261072 (BE) |

## 1. Purpose & users

Lets employees view their own attendance calendar and punch in/out. Gives HR admins and managers a department-level attendance snapshot. Used daily by staff; used weekly by HR for monitoring.

## 2. Screens

### Attendance Tracking (self-service)
Route: `/hrit/attendance-management/attendance-tracking`
- **Employee Snapshot Widget** — shows today's status, shift end time (`SHIFT_END = '06:00 PM'`), greeting based on time of day
- **Quick Actions Widget** — Punch In / Punch Out buttons; disabled once punched for the period
- **Attendance Alerts Widget** — late arrivals, missed punches, pending regularization requests
- **My Requests Widget** — list of regularization requests and their approval status
- **Upcoming Events Widget** — holidays and leave events
- **Attendance Calendar Drawer** — month calendar with daily status (Present / Absent / Leave / Holiday); opened from calendar icon
- **Attendance History Drawer** — paginated in/out time log
- **Event Details Drawer** — detail popup for a calendar day

![](./screenshots/attendance-tracking.png)

### Attendance Policy
Route: `/hrit/attendance-management/attendance-policy`
Policy configuration screen. TBD — page.tsx content not read.

### Attendance Regularization
Route: `/hrit/attendance-management/attendance-regularization`
Employee raises a correction request for a missed/wrong punch. TBD — page.tsx content not read.

### Request Center
Route: `/hrit/attendance-management/request-center`
Manager / HR view of all pending regularization requests across team.

## 3. Features & business rules

| Field / Rule | Detail |
|---|---|
| Punch-in | `POST /api/attendance/punch-in` — records timestamp + employee; one punch-in per day allowed |
| Punch-out | `POST /api/attendance/punch-out` — closes the in/out pair |
| Attendance status | Derived server-side from punch data against shift master (`tbluser_shift_master`) |
| Shift end | Hardcoded display default `06:00 PM`; actual shift from `tbluser_shift_records` |
| Selfie / location | `MapPin` and photo icons present in UI; `2025_06_20` migration adds `photos` column to `hrms_attendances` — photo capture supported |
| Regularization | Employee submits correction; workflow approval by manager/HR |
| Soft delete | `2026_08_17` migration adds `deleted_at` to `hrms_attendances` — soft deletes enabled |
| Multi-tenant | All queries scoped to `sub_institute_id` from session |

## 4. User flows

**Happy path — Employee punches in:**
1. Employee opens Attendance Tracking
2. Sees greeting and today's status (Absent / Not Punched)
3. Clicks "Punch In" → `POST /api/attendance/punch-in`
4. Status updates to "Present"; button disabled
5. At end of day clicks "Punch Out" → `POST /api/attendance/punch-out`

**Alternate — Missed punch:**
1. Employee sees "Absent" for a past date in calendar
2. Raises regularization request with reason and correct times
3. Manager/HR approves via Request Center

## 5. Data model

| Table | Key columns | Notes |
|---|---|---|
| `hrms_attendances` | `id`, `sub_institute_id`, `employee_id`, `attendance_date`, `in_time`, `out_time`, `status`, `photos`, `deleted_at`, `created_at` | Main attendance log; soft-deletable |
| `hrms_in_out_times` | `employee_id`, `in_time`, `out_time`, `date`, `sub_institute_id` | Legacy in/out table (still used by legacy routes) |
| `tbluser_shift_master` | `id`, `shift_name`, `in_time`, `out_time`, `sub_institute_id` | Shift definitions |
| `tbluser_shift_records` | `employee_id`, `shift_master_id`, `effective_date` | Per-employee shift assignment |
| `hrms_departments` | `id`, `department`, `sub_institute_id`, `status`, `deleted_at` | Departmental grouping |

## 6. APIs

| Method | Endpoint | Auth | Request | Response |
|---|---|---|---|---|
| GET | `/api/attendance/my-attendance` | JWT session | `?month=YYYY-MM` | Calendar records for the employee |
| POST | `/api/attendance/punch-in` | JWT session | `{}` | `{success, message, data}` |
| POST | `/api/attendance/punch-out` | JWT session | `{}` | `{success, message, data}` |
| GET | `/api/attendance/kpi` | JWT session | `?department_id=` | KPI summary counts |
| GET | `/api/attendance/weekly-summary` | JWT session | `?week=` | Weekly department summary |
| GET | `/api/attendance/report-filters` | JWT session | — | Available filter options |
| GET | `/api/attendance/employees` | JWT session | `?department_id=` | Employee list |
| GET | `/api/attendance/day-detail` | JWT session | `?date=&employee_id=` | Single-day punch detail |

## 7. UI components & design tokens

- `Card`, `CardContent`, `CardHeader`, `CardTitle` — shadcn
- `Skeleton` — loading placeholders
- `StatusBadge` — attendance status chip
- `Button` — Punch In / Punch Out
- `AlarmClock`, `CalendarDays`, `Clock`, `LogIn`, `LogOut`, `MapPin` — Lucide icons
- Lazy-loaded drawers via `React.lazy` + `Suspense`
- Design tokens: `--surface-*`, `--content-*`, `--border-*` from `styles.css`

## 8. Reports & exports

- Attendance Reports screen: `/hrit/attendance-management/attendance-reports`
- See [../../../core/attendance/daywise-report.md](../../../core/attendance/daywise-report.md) for student attendance
- Backend: `GET /api/attendance/report-filters`, `GET /api/attendance/day-detail`, `GET /api/employee-attendance-monthly-report`

## 9. Test cases

| ID | Scenario | Steps | Expected result | Type |
|---|---|---|---|---|
| AT-01 | Employee punches in | Open page → click Punch In | Status shows Present; button disabled | Happy |
| AT-02 | Double punch-in blocked | Punch In twice | Second call returns error; status unchanged | Negative |
| AT-03 | Calendar shows past month | Navigate calendar back one month | Correct attendance statuses displayed | Happy |
| AT-04 | Missed punch — regularization | No punch on past date → raise request | Request appears in Request Center | Happy |
| AT-05 | Different tenant data isolation | Log in as tenant B; check attendance | Only tenant B records visible | Edge |

## 10. Known issues, limitations & FAQs

- **Legacy routes coexist**: `hrms-attendance-in-time/store` and `hrms-attendance-out-time/store` still point at `HrmsController` (Blade-era). The new `/api/attendance/*` routes back the Next.js UI; both must stay in sync during migration.
- **Shift end hardcoded**: `SHIFT_END = '06:00 PM'` is a display-only constant in the page; actual shift lookup comes from `tbluser_shift_records`. Support must clarify if the display value is intentionally static.
- **Photo capture**: Column added in migration but no `<input type="file">` visible in page.tsx read — may be in a child component not read.

## 11. Sales notes

- **Self-service punch in/out** removes paper registers and manual HR data entry.
- **Demo flow**: Log in as employee → show greeting + today's status → Punch In → show calendar going green → switch to manager view → show department KPI cards.
- **Differentiator**: Linked directly to Payroll — attendance data flows into monthly payroll computation without re-entry.
- Pricing: TBD — part of Scholar CCB base tier.

## 12. v1 status & v2 ideas

**Complete:** Self-service punch in/out, attendance calendar, KPI dashboard, regularization request flow, weekly summary.
**Partial:** Attendance policy screen and request center — pages exist but content not fully confirmed from source read.
**v2 ideas:** GPS geofencing enforcement on punch-in; biometric integration (fingerprint/face); auto-regularization AI suggestions based on calendar patterns.

## Source files

- `C:\rajesh\lms_k12\app\hrit\attendance-management\attendance-tracking\page.tsx`
- `C:\rajesh\lms_k12\app\hrit\_lib\use-attendance.ts` (referenced)
- `C:\rajesh\lms_k12\app\hrit\_lib\hrit-types.ts` (referenced)
- `F:\xampp\htdocs\next_lms_erp\app\Http\Controllers\HRMS\HrmsController.php`
- `F:\xampp\htdocs\next_lms_erp\app\Http\Controllers\api\Attendance\AttendanceTrackingApiController.php`
- `F:\xampp\htdocs\next_lms_erp\routes\api.php` (lines 1081–1096)
- Migrations: `2023_05_25_120628_create_hrms_attendances_table.php`, `2025_06_20_120120_add_photos_to_hrms_attendances_table.php`, `2025_07_04_163547_create_tbluser_shift_master.php`

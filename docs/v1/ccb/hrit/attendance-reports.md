# Attendance Reports
**Product:** Scholar CCB | **Module:** HRIT — Attendance Management | **Frontend route:** `/hrit/attendance-management/attendance-reports` | **v1 status:** Complete

| Field | Value |
|---|---|
| Backend routes | `GET /api/attendance/report-filters`, `GET /api/attendance/employees`, `GET /api/attendance/day-detail`, `GET /api/attendance/latest-activity-date`, `GET /api/employee-attendance-monthly-report` |
| Roles | Admin, HR Admin, Manager |
| Last updated | 2026-11-04 |
| Source commit | 8fe500dc (FE) / 86261072 (BE) |

## 1. Purpose & users

Gives HR admins and managers a consolidated view of employee attendance — daily detail, monthly summary, department-wise. Used for payroll input, compliance review, and absenteeism tracking.

## 2. Screens

### Attendance Reports
Route: `/hrit/attendance-management/attendance-reports`
Filters: Department, Employee, Date range, Status
Tabular report: Employee name, Date, In-time, Out-time, Duration, Status
Export to Excel/CSV available.

![](./screenshots/attendance-reports.png)

## 3. Features & business rules

| Field | Detail |
|---|---|
| Department filter | Pulls from `hrms_departments` scoped to `sub_institute_id` |
| Employee filter | Dependent on selected department |
| Date range | Defaults to current month; April–March leave year context |
| Status values | Present, Absent, Leave, Holiday, Half-day |
| Latest activity date | `GET /api/attendance/latest-activity-date` — prevents querying future data |
| Export | CSV export via frontend serialization (no server-side export endpoint found) |

## 4. User flows

1. HR Admin selects Department and date range
2. Clicks "Load Report" → `GET /api/attendance/report-filters` then `GET /api/attendance/employees`
3. Per-day detail loaded via `GET /api/attendance/day-detail?date=&employee_id=`
4. Download CSV from table header button

## 5. Data model

Same as Attendance Tracking — `hrms_attendances`, `hrms_in_out_times`. See [attendance-tracking.md](attendance-tracking.md).

## 6. APIs

| Method | Endpoint | Auth | Request | Response |
|---|---|---|---|---|
| GET | `/api/attendance/report-filters` | JWT session | — | Departments, leave types, status options |
| GET | `/api/attendance/employees` | JWT session | `?department_id=` | Employee list |
| GET | `/api/attendance/day-detail` | JWT session | `?date=YYYY-MM-DD&employee_id=` | Single-day attendance detail |
| GET | `/api/attendance/latest-activity-date` | JWT session | — | Date string |
| GET | `/api/employee-attendance-monthly-report` | JWT session | `?month=&department_id=` | Monthly summary per employee |

## 7. UI components & design tokens

- `DataTable` — paginated report grid
- `Select` — department/employee dropdowns
- `SearchInput`, `Button` (Download)
- `Skeleton` — loading state

## 8. Reports & exports

This screen IS a report. Export: CSV download (client-side). PDF: TBD.

## 9. Test cases

| ID | Scenario | Steps | Expected result | Type |
|---|---|---|---|---|
| AR-01 | Load department report | Select dept + month → load | All employees with attendance data shown | Happy |
| AR-02 | No data for period | Select future month | Empty state displayed, no error | Edge |
| AR-03 | CSV export | Load data → click Download | CSV file downloaded with correct columns | Happy |
| AR-04 | Cross-tenant isolation | Log in as tenant B | Only tenant B attendance returned | Negative |

## 10. Known issues, limitations & FAQs

- Monthly report endpoint `GET /api/employee-attendance-monthly-report` is a legacy route pointing at `AttendanceApiController`; it coexists with the new `/api/attendance/*` prefix routes. Future cleanup needed.

## 11. Sales notes

- Replaces manual Excel attendance registers.
- **Demo flow**: Select department → show month view → highlight absenteeism → export CSV → show it feeds payroll.

## 12. v1 status & v2 ideas

**Complete:** Filters, day-detail, monthly summary, CSV export.
**v2:** Server-side paginated Excel export; scheduled email of monthly report to managers; integration with payroll to flag attendance shortfall before pay run.

## Source files

- `C:\rajesh\lms_k12\app\hrit\attendance-management\attendance-reports\page.tsx`
- `F:\xampp\htdocs\next_lms_erp\routes\api.php` (lines 1081–1096, 1000–1002)
- `F:\xampp\htdocs\next_lms_erp\app\Http\Controllers\api\Attendance\AttendanceReportApiController.php`

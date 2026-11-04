# Salary Structure
**Product:** Scholar CCB | **Module:** HRIT — Payroll Management | **Frontend route:** `/hrit/payroll-management/salary-structure` | **v1 status:** Complete

| Field | Value |
|---|---|
| Backend routes | `GET /payroll-type`, `GET /salary-structure` (department-scoped), `POST /salary-structure/store` |
| Roles | HR Admin, Finance Admin |
| Last updated | 2026-11-04 |
| Source commit | 8fe500dc (FE) / 86261072 (BE) |

## 1. Purpose & users

Maps monthly salary amounts to each employee for each earning/deduction payroll type. The grid is the master salary sheet — changes here affect every future payroll run. Used during onboarding new employees, annual salary revision, and whenever a payroll head changes.

## 2. Screens

### Salary Structure
- Department selector — loads employees for the selected department
- Spreadsheet-style table: rows = employees, columns = active payroll types
- Numeric inputs (`w-24 tabular-nums`) per cell
- KPI cards: Total employees in department, Total gross for department
- Pagination (page-based)
- Save button — posts full row for selected employee
- Download (Excel) button

![](./screenshots/salary-structure.png)

## 3. Features & business rules

| Rule | Detail |
|---|---|
| Column headers | Generated dynamically from active `payroll_types` for the tenant |
| PF column | Posted value may be overridden server-side based on employee's `pf_deduction` flag on `tbluser` |
| PT column | Same — overridden based on `pt_deduction` flag |
| Storage | Amounts stored as JSON in `employee_salary_structures.employee_salary_data` keyed by payroll_type id |
| Scope | `sub_institute_id` from session — no cross-tenant data |
| Validation | Numeric only; negative values: TBD |

## 4. User flows

1. HR Admin selects Department
2. Employee list + current salary amounts load
3. HR edits cell(s) for one employee
4. Clicks Save → `POST /salary-structure/store`
5. PF/PT auto-adjusted; row saved

## 5. Data model

See [payroll-processing.md](payroll-processing.md) § 5 — `employee_salary_structures`, `payroll_types`.

## 6. APIs

| Method | Endpoint | Auth | Request | Response |
|---|---|---|---|---|
| GET | `/payroll-type` | JWT | — | Active payroll types (column headers) |
| GET | `/salary-structure` | JWT | `?department_id=` | Employees + current salary data |
| POST | `/salary-structure/store` | JWT | `{employee_id, salary_data: {type_id: amount, ...}}` | Saved confirmation |

Exact route names confirmed from `PayrollController` comment in page.tsx.

## 7. UI components & design tokens

- `Table`, `TableBody`, `TableCell`, `TableHead`, `TableHeader`, `TableRow` — shadcn
- `Input` (numeric, `w-24 tabular-nums`)
- `Select` — department picker
- `SearchInput` — employee filter
- `KPICard`, `Pagination`, `AlertDialog`
- `Download`, `RefreshCw`, `Save`, `Search`, `Users`, `Wallet` — Lucide icons

## 8. Reports & exports

Excel download button on this screen exports current department salary structure.

## 9. Test cases

| ID | Scenario | Steps | Expected result | Type |
|---|---|---|---|---|
| SS-01 | Load department | Select "Teaching" dept | All teaching staff with salary amounts displayed | Happy |
| SS-02 | Edit and save | Change HRA for one employee → Save | Amount updated; PF recalculated | Happy |
| SS-03 | PF auto-adjustment | Employee has pf_deduction=false; set PF amount | Server returns PF=0 | Edge |
| SS-04 | No employees in dept | Select empty dept | Empty state; no error | Edge |

## 10. Known issues, limitations & FAQs

- JSON storage for `employee_salary_data` means adding a new payroll type does not auto-populate the column for existing employees — HR must revisit each row.
- No inline validation on negative or non-numeric input visible in source; relies on HTML `type="number"`.

## 11. Sales notes

- "One screen to manage 200 employees' salaries — structured, auditable, no Excel."

## 12. v1 status & v2 ideas

**Complete:** Grid view, department filter, save per employee, PF/PT server override, Excel export.
**v2:** Bulk salary revision (% increase across department); revision history per employee; salary band compliance check.

## Source files

- `C:\rajesh\lms_k12\app\hrit\payroll-management\salary-structure\page.tsx`
- `C:\rajesh\lms_k12\app\hrit\_lib\use-salary-structure.ts` (referenced)
- `F:\xampp\htdocs\next_lms_erp\app\Http\Controllers\Payroll\PayrollController.php`
- Migrations: `2023_05_08_165717_create_employee_salary_structures_table.php`

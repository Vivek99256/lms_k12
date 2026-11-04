# Payroll Processing
**Product:** Scholar CCB | **Module:** HRIT — Payroll Management | **Frontend route:** `/hrit/payroll-management/` (multiple sub-routes) | **v1 status:** Complete

| Field | Value |
|---|---|
| Backend routes | `GET /payroll-type`, `POST /payroll-type/store`, `POST /payroll-type/destroy/{id}` (PayrollController); monthly payroll via PayrollController |
| Roles | HR Admin, Finance Admin |
| Last updated | 2026-11-04 |
| Source commit | 8fe500dc (FE) / 86261072 (BE) |

## 1. Purpose & users

Manages end-to-end monthly payroll: define earning/deduction heads, map salary structures per employee, run monthly payroll, generate payslips, Form 16, and salary certificates. Used monthly by HR/Finance.

## 2. Screens

### Payroll Type
Route: `/hrit/payroll-management/payroll-type`
- KPI cards: Total payroll types, Earnings count, Deductions count
- Tabs: All | Earnings | Deductions
- Table: payroll_name, kind (Earning / Deduction), amount_type, payroll_percentage, day_count, status
- Actions: Add, Edit, Toggle status, Delete (with confirmation dialog)

### Salary Structure
Route: `/hrit/payroll-management/salary-structure`
- Filter: Department dropdown
- Spreadsheet-style grid: one row per employee, one column per active payroll type
- Numeric inputs (`className="w-24 tabular-nums"`) for each earning/deduction amount
- PF and PT amounts are re-derived server-side from `pf_deduction` / `pt_deduction` flags on employee — posted values may come back adjusted
- KPI cards: Total employees, Total gross
- Download (Excel) button

### Payroll Deduction
Route: `/hrit/payroll-management/payroll-deduction`
Per-employee one-off deductions. TBD — page content not read.

### Monthly Payroll Report
Route: `/hrit/payroll-management/monthly-payroll-report`
Run / view the monthly payroll. TBD — page content not read.

### Salary Certificate
Route: `/hrit/payroll-management/salary-certificate`
Generate and download individual salary certificates. TBD — page content not read.

### Form 16
Route: `/hrit/payroll-management/form-16`
Generate Form 16 for financial year. TBD — page content not read.

![](./screenshots/payroll-type.png)
![](./screenshots/salary-structure.png)

## 3. Features & business rules

| Field | Type | Required | Validation | Notes |
|---|---|---|---|---|
| payroll_name | varchar | Yes | Unique per institute | Earning/Deduction head name |
| payroll_type | int | Yes | 1=Earning, 2=Deduction | From `PayrollType::payroll_type` |
| amount_type | int | Yes | Fixed / Percentage | |
| payroll_percentage | decimal | Conditional | Required if amount_type = Percentage | |
| day_count | int | No | — | For daily-rate computation |
| status | boolean | — | Active / Inactive | Toggle via controller |
| sub_institute_id | bigint | — | From session | Multi-tenant scoping |
| PF deduction | boolean | — | Per employee (`pf_deduction` flag on tbluser) | Server re-derives PF on save |
| PT deduction | boolean | — | Per employee (`pt_deduction` flag on tbluser) | Server re-derives PT on save |

**JWT auth** required for API calls: `PayrollController` validates JWT token for `type=API` requests.

## 4. User flows

**Set up payroll type:**
1. HR Admin → Payroll Type → "Add" → fill name, type (Earning/Deduction), amount_type, percentage/amount
2. Submit → `POST /payroll-type/store`
3. Appears in Earnings or Deductions tab

**Assign salary structure:**
1. Select Department → employee list loads
2. Enter monthly amounts per earning/deduction head per employee
3. Click Save → amounts posted to `employee_salary_structures`
4. PF/PT auto-adjusted server-side

**Monthly payroll run:**
TBD — `EmployeeMonthlySalaryData` model used; run logic in `PayrollController`.

## 5. Data model

| Table | Key columns |
|---|---|
| `payroll_types` | `id`, `payroll_type` (1=Earning/2=Deduction), `payroll_name`, `amount_type`, `payroll_percentage`, `day_count`, `status`, `sub_institute_id`, audit cols (added 2026-08-18) |
| `employee_salary_structures` | `id`, `employee_id`, `sub_institute_id`, `employee_salary_data` (JSON — one key per payroll_type id), `pf_deduction`, `pt_deduction` |
| `employee_monthly_salary_data` | `id`, `employee_id`, `sub_institute_id`, `month`, `year`, `gross`, `net`, `deductions`, `payment_date`, `payment_mode`, status |
| `hrms_emp_payroll_deduction` | `id`, `employee_id`, `deduction_type_id`, `amount`, `month`, `year`, `sub_institute_id` |
| `hrms_salary_certificate` | `id`, `employee_id`, `generated_by`, `generated_at`, `sub_institute_id` |

## 6. APIs

| Method | Endpoint | Auth | Request | Response |
|---|---|---|---|---|
| GET | `/payroll-type` | JWT | `?sub_institute_id=` | List of payroll types |
| POST | `/payroll-type/store` | JWT | `{payroll_name, payroll_type, amount_type, ...}` | Created/updated type |
| POST | `/payroll-type/destroy/{id}` | JWT | — | Deleted confirmation |

Monthly payroll endpoints: TBD — not read.

## 7. UI components & design tokens

- `PayrollPageShell` — shared shell with header + navigation across all payroll screens
- `PayrollTypeDialog` — add/edit dialog
- `PayrollTypeTable` — data table component
- `PayrollTableSkeleton` — loading state
- `KPICard` — summary cards
- `Tabs` — Earnings / Deductions / All tabs
- `AlertDialog` — delete confirmation
- `Wallet`, `ArrowDownCircle`, `ArrowUpCircle`, `CheckCircle2` — Lucide icons
- Tabular figures (`tabular-nums`) for all salary amounts

## 8. Reports & exports

- Monthly Payroll Report: `/hrit/payroll-management/monthly-payroll-report`
- Salary Certificate PDF: `/hrit/payroll-management/salary-certificate`
- Form 16 PDF: `/hrit/payroll-management/form-16`
- Salary Structure export: Excel download button on salary-structure screen
- Backend generates PDFs via `PDF` facade (Laravel-dompdf)

## 9. Test cases

| ID | Scenario | Steps | Expected result | Type |
|---|---|---|---|---|
| PP-01 | Add earning head | Add "HRA" as 40% earnings | Appears in Earnings tab with correct percentage | Happy |
| PP-02 | Add deduction head | Add "PF" as 12% deduction | Appears in Deductions tab | Happy |
| PP-03 | Salary structure save | Enter amounts → save | PF/PT adjusted server-side; amounts saved correctly | Happy |
| PP-04 | Delete payroll type in use | Delete a type mapped to employees | TBD — no guard found in code | Edge |
| PP-05 | JWT expiry during save | Token expires mid-save | 401 returned; user redirected to login | Negative |

## 10. Known issues, limitations & FAQs

- `PayrollController` comment says it was "Ported from G2G's" codebase — `pf_deduction` and `pt_deduction` flags live on `tbluser` model, not in payroll tables directly; updates require touching `tbluser`.
- No dedicated monthly payroll run API endpoint found in `api.php`; likely served via legacy Blade routes. This is a gap to investigate.
- Salary structure uses a JSON column `employee_salary_data` — adding/removing payroll types does not automatically update existing JSON structures.

## 11. Sales notes

- **For HR/Finance:** Eliminate Excel salary sheets — one screen to manage all 100+ employee salaries.
- **Demo flow:** Show payroll types list → open salary structure → enter/edit amounts → highlight PF auto-calculation → show monthly payroll report → generate salary certificate PDF.
- **Differentiator:** Payroll linked to attendance — `countDays` helper adjusts gross based on actual attendance, not just calendar days.

## 12. v1 status & v2 ideas

**Complete:** Payroll types (CRUD), salary structure grid, Form 16 screen, salary certificate.
**Partial:** Monthly payroll run (screen exists, full API not confirmed), payroll deduction screen (not read).
**v2:** Bank transfer integration (NACH/NEFT bulk file); payroll variance alerts ("Salary changed >20% vs last month"); AI-drafted payslip narratives.

## Source files

- `C:\rajesh\lms_k12\app\hrit\payroll-management\payroll-type\page.tsx`
- `C:\rajesh\lms_k12\app\hrit\payroll-management\salary-structure\page.tsx`
- `C:\rajesh\lms_k12\app\hrit\_lib\use-payroll.ts` (referenced)
- `C:\rajesh\lms_k12\app\hrit\_lib\payroll-api.ts` (referenced)
- `C:\rajesh\lms_k12\app\hrit\_lib\use-salary-structure.ts` (referenced)
- `F:\xampp\htdocs\next_lms_erp\app\Http\Controllers\Payroll\PayrollController.php`
- Migrations: `2023_05_07_201451_create_payroll_types_table.php`, `2023_05_08_165717_create_employee_salary_structures_table.php`, `2023_05_13_172418_create_employee_monthly_salary_data_table.php`, `2026_08_18_100000_add_audit_columns_to_payroll_types.php`

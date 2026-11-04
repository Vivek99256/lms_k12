# Fees Collection Report
**Product:** Scholar Core | **Module:** Fees → Reports | **Frontend route:** `/fees/collection_report` (and sub-routes) | **v1 status:** Complete

| Field | Value |
|---|---|
| Backend routes | `POST /fees/fees_report/index`, `POST /fees/fees_report/show`, `POST /fees/fees_report/export` |
| Roles | Admin, Accountant, Principal |
| Last updated | 2026-11-04 |
| Source commit | 8fe500dc (FE) / 86261072 (BE) |

## 1. Purpose & users
Provides the primary financial summary of fees collected, broken down by standard, division, term, payment mode, and fee head. Used by admin and accountants for daily reconciliation and by principals for financial oversight.

## 2. Screens

### Collection Report (`/fees/collection_report`)
Filterable, paginated table of collected fee rows. Supports Excel/PDF export.

**Filters:**
- Academic year (`syear`)
- Term / month (`term_id`)
- Standard, Division
- Payment mode (Cash / Cheque / DD / Online)
- Date range (`from_date`, `to_date`)
- Enrollment no / Student name

### Overall Collection Report (`/fees/fees_overall_report`)
Aggregate view — totals per standard, per term, per payment mode. No student-level rows.

### Head-wise Collection Report (`/fees/fees_overall_headwise`)
Breaks totals by fee head (Tuition, Term, Activity, Computer, etc.) across all students or per standard.

### Head-wise Pending Report (`/fees/fees_overall_headwise_pending`)
Same as head-wise but shows only pending/outstanding amounts per head.

### Monthly Report (`/fees/fees_monthly_report`)
Month-by-month collection totals for the academic year.

### Daily Voucher (`/fees/daily_voucher`)
Single-day voucher — lists every receipt issued on a selected date, with totals by payment mode. Used for daily cash reconciliation.

### Fee Status Report (`/fees/fees_status`)
Per-student fee status: paid / partial / overdue for each term.

### Type-wise Report (`/fees/fees_typewise_report`)
Breaks collection by fee type (Regular vs Other Fees).

### Tally Export (`/fees/tally_export`)
Exports collection data in Tally-compatible format (CSV/XML).

### Payout Report (`/fees/fees_payout`)
Tracks payouts from collected fees to vendors or institutes.

### Fee Structure Report (`/fees/fees_structure_report`)
Shows the configured fee structure (amounts per standard per head) — not actual collection.

### Fee Modification Report (`/fees/fees_modification`)
Tracks changes made to fee records after initial collection.

### Student Breakoff Report (`/fees/student_breakoff_report`)
Per-student breakoff schedule vs actual collection.

### Imprest Refund Report (`/fees/imprest_refund_report`)
Imprest/petty-cash refund records.

![](./screenshots/fees-collection-report.png)

## 3. Features & business rules

**Primary report controller (`feesReportController`):**
- Joins `fees_collect`, `tblstudent`, `tblstudent_enrollment`, `standard`, `division`.
- Filters by `sub_institute_id` (tenant), `syear`, `term_id`, `standard_id`, `division_id`, `payment_mode`, date range.
- Returns paginated rows (default 25/page).
- Supports Excel export (PHPExcel).

**Cancel report (`feesCancelReportController`):** Lists cancelled receipts; joinable with collection report.

**Fine/discount report (`feesFineDiscountReportController`):** Lists late fees applied and discounts given.

**Institute-wise report (`feesInstituteWiseFeesReportController`):** For multi-campus groups — collection summary per sub-institute.

**Other fees reports (`otherfeesReportController`, `otherNewfeesReportController`, `otherNew_CancelFeesReportController`):** Parallel reports for `fees_other_collection`.

**Month-wise receipt PDF (`monthwiseReceiptPdfController`):** Generates a PDF of all receipts for a month — for auditor submission.

## 4. User flows

**Happy path — daily cash reconciliation:**
1. Navigate to `/fees/daily_voucher`.
2. Select today's date.
3. Report shows all receipts issued today with payment mode totals.
4. Export to PDF and hand to cashier.

**Happy path — term-end collection summary:**
1. Go to `/fees/fees_overall_report`.
2. Select academic year and term.
3. Totals per standard shown.
4. Export to Excel for principal.

**Happy path — Tally export:**
1. Navigate to `/fees/tally_export`.
2. Select date range.
3. Download CSV → import into Tally ERP.

## 5. Data model

**Primary source tables:**
- `fees_collect` — collection rows
- `fees_cancel` — cancelled receipts
- `fees_refund` — refunds
- `fees_other_collection` — other fees
- `tblstudent`, `tblstudent_enrollment` — student identity
- `standard`, `division` — class structure

**Fee heads in `fees_collect`** (reported as columns):

| Column | Display label |
|---|---|
| `tution_fee` | Tuition Fee (typo preserved) |
| `admission_fee` | Admission Fee |
| `activity_fee` | Activity Fee |
| `term_fee` | Term Fee |
| `deposit` | Deposit |
| `co_curriculam_fees` | Co-curricular Fees |
| `computer_fees` | Computer Fees |
| `smart_class` | Smart Class |
| `security_charges` | Security Charges |
| `photograph` | Photograph |
| `cal_misc` | Miscellaneous |
| `title_1`–`title_12` | Custom heads (name from `fees_title` master) |

## 6. APIs

| Method | Endpoint | Auth | Request | Response |
|---|---|---|---|---|
| POST | `/fees/fees_report/index` | JWT | Filters | Paginated `{ data: Row[], meta }` |
| POST | `/fees/fees_report/show` | JWT | `receipt_no` | Single receipt detail |
| POST | `/fees/fees_report/export` | JWT | Filters + format (excel/pdf) | File download |
| POST | `/fees/daily_voucher/index` | JWT | `date`, `sub_institute_id` | Voucher rows |
| POST | `/fees/tally_export/index` | JWT | Date range | CSV download |

## 7. UI components & design tokens

| Component | Source |
|---|---|
| `DataTable` / `Table` | `components/ui/table` |
| `DateRangePicker` | `components/ui/date-range-picker` |
| `Select` | `components/ui/select` |
| `Button` (Export) | `components/ui/button` |
| `Skeleton` | `components/ui/skeleton` |

## 8. Reports & exports
This screen IS the report. Export formats:
- Excel (`.xlsx`) — via PHPExcel on backend.
- PDF — via Laravel PDF (mPDF or similar) or browser print.
- Tally CSV — via `tallyExportReportController`.

## 9. Test cases

| ID | Scenario | Steps | Expected result | Type |
|---|---|---|---|---|
| FCR-01 | Daily voucher for today | Select today | All today's receipts; correct mode totals | Happy |
| FCR-02 | Filter by payment mode | Select Cash only | Only cash receipts | Happy |
| FCR-03 | Export to Excel | Apply filters → Export | .xlsx with correct data | Happy |
| FCR-04 | Head-wise report | Select term | Totals per fee head correct | Happy |
| FCR-05 | No data for filter | Select future date | Empty table, no error | Edge |
| FCR-06 | Tally export | Select date range | Valid CSV matching Tally format | Happy |

## 10. Known issues, limitations & FAQs

- Uses PHPExcel (deprecated) for Excel generation. Upgrade to PhpSpreadsheet in v2.
- `tution_fee` column name is a typo (should be `tuition_fee`) — preserved for backward compatibility; displayed with correct label in UI.
- Month-wise PDF can be slow for large institutes (many receipts per month).

**FAQ:**
- *"Report shows wrong totals"* — check if cancelled receipts are being excluded (they should be: `fees_cancel.reciept_id` join).
- *"Tally export format wrong"* — the Tally format may need customization per client's Tally configuration.

## 11. Sales notes

**Selling points:**
1. 15+ report variants — from daily voucher to annual summary.
2. One-click Tally export — no double-entry for accounting.
3. Head-wise breakdown shows exactly where every rupee was collected.

**Demo flow:**
1. Show daily voucher — select today, show receipts with mode totals.
2. Show head-wise report — tuition vs activity vs computer etc.
3. Click Export — download Excel.
4. Show Tally export CSV.

## 12. v1 status & v2 ideas

**v1 complete:** All 15+ report types functional with Excel/PDF export.
**v2 ideas:**
- Migrate from PHPExcel to PhpSpreadsheet.
- Interactive charts overlaid on report (monthly trend, mode split).
- Scheduled report delivery (auto-email to principal every Monday morning).

## Source files
- `C:\rajesh\lms_k12\app\fees\collection_report\page.tsx`
- `C:\rajesh\lms_k12\app\fees\fees_overall_report\page.tsx`
- `C:\rajesh\lms_k12\app\fees\daily_voucher\page.tsx`
- `C:\rajesh\lms_k12\app\fees\tally_export\page.tsx`
- `F:\xampp\htdocs\next_lms_erp\app\Http\Controllers\fees\fees_report\feesReportController.php`
- `F:\xampp\htdocs\next_lms_erp\app\Http\Controllers\fees\fees_report\feesOverallReportController.php`
- `F:\xampp\htdocs\next_lms_erp\app\Http\Controllers\fees\fees_report\feesOverallHeadwiseReportController.php`
- `F:\xampp\htdocs\next_lms_erp\app\Http\Controllers\fees\fees_report\feesMonthlyReportController.php`
- `F:\xampp\htdocs\next_lms_erp\app\Http\Controllers\fees\fees_report\daily_voucherController.php`
- `F:\xampp\htdocs\next_lms_erp\app\Http\Controllers\fees\fees_report\feesStatusController.php`
- `F:\xampp\htdocs\next_lms_erp\app\Http\Controllers\fees\fees_report\tallyExportReportController.php`
- `F:\xampp\htdocs\next_lms_erp\app\Http\Controllers\fees\fees_report\feesTypewiseReportController.php`
- `F:\xampp\htdocs\next_lms_erp\app\Http\Controllers\fees\fees_report\feesModificationController.php`

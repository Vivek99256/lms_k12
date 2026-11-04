# Fees Defaulter Report
**Product:** Scholar Core | **Module:** Fees → Reports | **Frontend route:** `/fees/fees_defaulter_report` | **v1 status:** Complete

| Field | Value |
|---|---|
| Backend routes | `POST /fees/fees_defaulter_report/index`, `POST /fees/fees_defaulter_report/show`, `POST /fees/fees_defaulter_report/export` |
| Roles | Admin, Accountant, Principal |
| Last updated | 2026-11-04 |
| Source commit | 8fe500dc (FE) / 86261072 (BE) |

## 1. Purpose & users
Lists all students who have outstanding (unpaid or partially paid) fees for a selected term. Used by admin for follow-up, by accountants for collection drives, and by principals for financial health monitoring.

## 2. Screens

### Defaulter Report (`/fees/fees_defaulter_report`)
Paginated, filterable table of defaulter students with outstanding amounts per fee head.

**Filters:**
- Academic year (`syear`)
- Term / month (`term_id`)
- Standard (`grade_id`, `standard_id`)
- Division (`division_id`)
- Student (`enrollment_no`, `first_name`, `last_name`)
- Mobile no (`mobile_no`)

**Table columns:** Enrollment no, Student name, Standard, Division, Mobile no, Fee heads (each outstanding amount), Total outstanding, Actions (Send reminder / View).

![](./screenshots/fees-defaulters-report.png)

## 3. Features & business rules

**Controller: `feesDefaulterReportController`**

**How defaulters are identified:**
- A student is a defaulter if `fees_collect` has no row (or only partial rows) for their enrollment in the selected `syear` + `term_id`.
- The report joins `tblstudent_enrollment` to get all enrolled students, then LEFT JOINs `fees_collect` to find missing payments.
- `is_deleted = 0` check on `fees_collect` ensures cancelled receipts are not counted as paid.

**Partial payment detection:** If `fees_collect` rows exist but do not cover all fee heads (some head columns are NULL or 0), the student appears as a partial defaulter.

**Outstanding calculation:** `expected_amount - collected_amount` per head.

**AI Insight hook (`feesAIController`):** The AI analysis button on this screen calls `shell_exec('python3 /home/fees_analysis_10_04.py ' . escapeshellarg($sub_institute_id))` and returns a JSON analysis (default rate by standard, trend, risk clusters). The Python script path is hardcoded on the server.

## 4. User flows

**Happy path — view defaulters for Term 2:**
1. Navigate to `/fees/fees_defaulter_report`.
2. Select `syear = 2025-26`, `term_id = Term 2`.
3. Click Search.
4. Table shows all students with outstanding balance for Term 2.
5. Admin exports list to Excel for collection follow-up.

**Happy path — filter by standard:**
1. Select Standard = "Class 9".
2. Table narrows to Class 9 defaulters only.
3. Click "Send Reminder" on a row → triggers fee reminder via Communication module.

**AI Insight flow:**
1. Click "AI Insights" button.
2. Backend runs Python analysis script.
3. Returns chart data: default rate by standard, common default patterns.
4. Frontend renders in a drawer/overlay.

## 5. Data model

**Primary join (from `feesDefaulterReportController`):**

```sql
SELECT tblstudent.*, tblstudent_enrollment.*,
       fees_collect.tution_fee, fees_collect.term_fee, ...
FROM tblstudent_enrollment
LEFT JOIN tblstudent ON ...
LEFT JOIN fees_collect ON fees_collect.student_id = tblstudent.id
  AND fees_collect.term_id = :term_id
  AND fees_collect.syear = :syear
  AND fees_collect.is_deleted = 0
WHERE fees_collect.id IS NULL  -- no payment found
   OR (sum of head columns < expected)
```

**Parameters accepted by `showFeesDefaulter()`:**
- `grade_id`, `standard_id`, `division_id` — class filter
- `enrollment_no`, `first_name`, `last_name`, `mobile_no` — student search
- `syear`, `term_id` — period
- `sub_institute_id` — tenant

## 6. APIs

| Method | Endpoint | Auth | Request | Response |
|---|---|---|---|---|
| POST | `/fees/fees_defaulter_report/index` | JWT | Filters | `{ data: DefaulterRow[], meta: { total, per_page, ... } }` |
| POST | `/fees/fees_defaulter_report/export` | JWT | Filters + format | File download (.xlsx) |
| POST | `/api/fees/ai-insight` | JWT | `sub_institute_id` | AI analysis JSON (from Python script) |

## 7. UI components & design tokens

| Component | Source |
|---|---|
| `DataTable` / `Table` | `components/ui/table` |
| `Select` (standard, term, year) | `components/ui/select` |
| `Input` (enrollment no, name) | `components/ui/input` |
| `Button` (Export, Send Reminder) | `components/ui/button` |
| `Skeleton` | `components/ui/skeleton` |
| AI insight overlay | `app/fees/_components/ai-insight-panel` |

## 8. Reports & exports
Export formats:
- Excel (`.xlsx`) — column per fee head + total outstanding.
- Print/PDF — via browser print or server-side PDF.

## 9. Test cases

| ID | Scenario | Steps | Expected result | Type |
|---|---|---|---|---|
| FDR-01 | View term defaulters | Select year + term → Search | All non-paying students listed | Happy |
| FDR-02 | Filter by standard | Select Class 10 | Only Class 10 defaulters | Happy |
| FDR-03 | Student with partial payment | Student paid tuition but not activity | Appears with partial outstanding | Edge |
| FDR-04 | Cancelled receipt | Student's receipt was cancelled | Student appears as defaulter again | Edge |
| FDR-05 | Export | Apply filters → Export | .xlsx with correct outstanding amounts | Happy |
| FDR-06 | AI Insight | Click AI Insights | Analysis panel appears with chart | Happy |
| FDR-07 | Python script unavailable | Server without script | Error handled; no 500 to browser | Negative |

## 10. Known issues, limitations & FAQs

- AI Insight uses `shell_exec('python3 /home/fees_analysis_10_04.py')` — hardcoded server path. If the Python script is missing or the server lacks Python 3, the AI button will fail silently or return an error.
- `tution_fee` column typo (should be `tuition_fee`) — appears in report output; displayed with correct label in UI.
- Performance: for large institutes (5,000+ students), the LEFT JOIN on `fees_collect` can be slow without proper indexes.

**FAQ:**
- *"Student shows as defaulter but they paid"* — check if the receipt has `is_deleted = 1` (cancelled) or if it was filed under a different `term_id`.
- *"AI Insights button does nothing"* — the Python script may not be installed on the backend server. Contact backend team.
- *"Report is slow to load"* — add index on `fees_collect(student_id, term_id, syear, is_deleted)`.

## 11. Sales notes

**Selling points:**
1. Instant defaulter list — from zero to follow-up list in one click.
2. Per-head outstanding breakdown — know exactly which fee is unpaid per student.
3. Direct "Send Reminder" action from the report — close the loop in one screen.
4. AI Insight layer — spot patterns (which standards default most, which months have spikes).

**Demo flow:**
1. Navigate to defaulter report → select current term → show list instantly.
2. Filter by one standard → show only those defaulters.
3. Click "Send Reminder" on a row → show notification dispatch.
4. Click "AI Insights" → show the Python-driven analysis.

## 12. v1 status & v2 ideas

**v1 complete:** Defaulter list, per-head outstanding, Excel export, AI insight (Python).
**v2 ideas:**
- Replace hardcoded Python script with a proper Laravel AI service call.
- Add trend column: "defaulted last term too" indicator.
- Scheduled defaulter report email (weekly auto-send to principal).
- Add index recommendation as a migration (`fees_collect` indexed on student_id + term_id + syear).

## Source files
- `C:\rajesh\lms_k12\app\fees\fees_defaulter_report\page.tsx`
- `F:\xampp\htdocs\next_lms_erp\app\Http\Controllers\fees\fees_report\feesDefaulterReportController.php`
- `F:\xampp\htdocs\next_lms_erp\app\Http\Controllers\fees\fees_ai\feesAIController.php`
- `F:\xampp\htdocs\next_lms_erp\routes\api.php` (AI endpoint wiring)

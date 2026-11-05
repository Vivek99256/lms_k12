# Boys Girls Daywise Attendance Report
**Product:** Scholar Core | **Module:** Attendance | **Frontend route:** `/student/daywise_student_attendance` | **v1 status:** Complete

| Field | Value |
|---|---|
| Backend routes | `POST student/show_daywise_student_attendance` (via `/api/proxy`) |
| Roles | Admin, Principal, Class Teacher |
| Last updated | 2026-11-04 |
| Source commit | 8fe500dc (FE) / 86261072 (BE) |

## 1. Purpose & users

Shows a school-wide attendance summary for a single day, broken down by standard. Each row shows boys, girls, and total counts for enrolled, present, and absent students. Used by the principal and admin for the daily school attendance register.

## 2. Screens

**Boys Girls Daywise Attendance Report** — `/student/daywise_student_attendance`

| Element | Description |
|---|---|
| Date picker | Defaults to today |
| Taken filter | Dropdown: All / Yes / No (whether attendance was taken for that class) |
| Search button | Loads the report |
| Report table | Columns: Standard | Total Students (B, G, T) | Present (B, G, T) | Absent (B, G, T) | Taken | Average % | Staff Signature |
| Totals row | Footer row summing all standards |
| Export buttons | CSV, Excel, PDF, Print |

![](./screenshots/daywise-report.png)

## 3. Features & business rules

| Field | Type | Required | Validation | Default |
|---|---|---|---|---|
| Attendance Date | Date | Yes | — | Today |
| Taken | Select | No | `yes` / `no` / empty (all) | All |

- Average % = (Total Present / Total Students) × 100, formatted to 2 decimal places.
- Totals row is calculated server-side (`attendance_totals` in the payload) and also client-side for the footer.
- "Taken" column per row is derived: if `Total Present + Total Absent > 0` → "Yes", else "No".
- Staff Signature column is empty (a printable field for the physical register).

## 4. User flows

**Happy path:**
1. Admin opens Boys Girls Daywise Attendance Report.
2. Selects a date (defaults to today).
3. Optionally filters by Taken = Yes to see only classes where attendance was entered.
4. Clicks Search.
5. Table populates with standard-wise rows and a totals footer.
6. Exports to Excel or prints for the principal.

## 5. Data model

Reads from `attendance_student` aggregated by `standard_id`. The backend joins `standard` for names and aggregates by gender (from `tblstudent.gender`). Key fields returned:

| Response field | Meaning |
|---|---|
| `BOY` | Enrolled boys count |
| `GIRL` | Enrolled girls count |
| `TBP` | Total boys present |
| `TGP` | Total girls present |
| `TBA` | Total boys absent |
| `TGA` | Total girls absent |
| `standard_name` | Standard label |
| `attendance_totals` | School-wide totals object |

## 6. APIs

| Method | Proxy path | Key request params | Key response fields |
|---|---|---|---|
| POST | `student/show_daywise_student_attendance` | `date` (YYYY-MM-DD), `taken` (yes/no), session params | `attendance_data[]`, `attendance_totals{}`, `date`, `message`, `status_code` |

## 7. UI components & design tokens

- `PageFrame`, `PageHeader`, `SectionPanel`, `Field`, `NativeSelect`, `InlineMessage`, `LoadingRows`, `EmptyTableRow` — fees-shared
- `Button`, `Input`, `Table`, `TableFooter` — shadcn
- Color tokens: amber-50/100 for totals column, emerald-50/100 for present column, rose-50/100 for absent column, orange-50/100 for average column
- Export utilities: `exportRowsAsCsv`, `exportRowsAsExcel`, `exportRowsAsPdf`, `openPrintPreview` — `lib/table-export`

## 8. Reports & exports

Export formats: **CSV**, **Excel (.xls)**, **PDF**, **Print preview**.
Filename pattern: `boys-girls-daywise-attendance-report.<ext>`.

## 9. Test cases

| ID | Scenario | Steps | Expected result | Type |
|---|---|---|---|---|
| DW-01 | Today's report | Open page, click Search | Rows for each standard with present/absent counts | Happy |
| DW-02 | Filter by Taken=Yes | Set Taken = Yes, search | Only rows where attendance was entered | Happy |
| DW-03 | No attendance taken | Pick a date with no attendance data | Empty rows / "No daywise attendance rows match" message | Edge |
| DW-04 | Export to Excel | Search, click Excel | File downloads with all columns including totals row | Happy |
| DW-05 | Print | Search, click Print | Print preview opens with title, subtitle, and table | Happy |
| DW-06 | Export disabled when empty | No search result | CSV/Excel/PDF/Print buttons disabled | Negative |

## 10. Known issues, limitations & FAQs

- Gender breakdown requires student gender to be set in `tblstudent`. If gender is missing, counts may be off.
- "Staff Signature" column is always empty — it is a print-only field.
- **FAQ:** "Why does my total not match the student list?" — the daywise report counts from `attendance_student` records, not from enrollment. Students with no attendance row are not counted in present or absent.

## 11. Sales notes

**Selling points:**
- School-wide daily attendance summary in one click.
- Boys vs. girls breakdown for UDISE / government reporting.
- One-click export to Excel and PDF for the principal's desk.

**Demo flow:**
1. Open report, pick today, click Search.
2. Show the gender-split table with average %.
3. Export to PDF — ready to print and file.

**Plan/pricing:** TBD

## 12. v1 status & v2 ideas

**Complete:** Full gender-split report, totals footer, CSV/Excel/PDF/Print export.

**v2 ideas:**
- Add division-level breakdown within each standard.
- Show trend vs. previous day.
- Auto-schedule daily email of the report to the principal.

## Source files

- Frontend: `C:\rajesh\lms_k12\app\student\daywise_student_attendance\page.tsx`
- Export utility: `C:\rajesh\lms_k12\lib\table-export.ts`
- DB migration: `F:\xampp\htdocs\next_lms_erp\database\migrations\2023_03_05_115658_create_attendance_student_table.php`

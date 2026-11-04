# Yearly Attendance Report
**Product:** Scholar Core | **Module:** Attendance | **Frontend route:** `/student/yearly_student_attendance` | **v1 status:** Complete

| Field | Value |
|---|---|
| Backend routes | `POST student/yearly_student_attendance` (via `/api/proxy`) |
| Roles | Admin, Class Teacher, Principal |
| Last updated | 2026-11-04 |
| Source commit | 8fe500dc (FE) / 86261072 (BE) |

## 1. Purpose & users

Shows student attendance aggregated by month over a custom date range. Each student row shows how many days they attended in each month, their total school-year days attended, and their overall attendance percentage. Used for annual attendance records, promotions, and regulatory compliance.

## 2. Screens

**Yearly Attendance Report** — `/student/yearly_student_attendance`

| Element | Description |
|---|---|
| Grade (Section) dropdown | `SearchDropdown` cascade: grade → standard → division |
| Standard dropdown | Cascades from grade |
| Division dropdown | Cascades from standard |
| From Date picker | Start of period |
| To Date picker | End of period |
| Search button | Loads the report |
| Report table | Header row 1: columns per month present in data + "Total School Year Day" + "Per %" |
| | Header row 2: "Working Days" per month |
| | Student rows: monthly present counts + total + % |
| Export buttons | CSV, Excel, PDF, Print |

![](./screenshots/yearly-report.png)

## 3. Features & business rules

| Field | Type | Required | Validation | Default |
|---|---|---|---|---|
| Grade | Select | Yes | — | — |
| Standard | Select | Yes | — | — |
| Division | Select | Yes | — | — |
| From Date | Date | Yes | Must be ≤ To Date | — |
| To Date | Date | Yes | Must be ≥ From Date | — |

- Month columns are dynamic — only months that appear in the backend's `month[]` array are rendered.
- Working days per month come from `working_day` in the payload.
- Total School Year Day = sum of attendance counts across all months for a student.
- Per % = (Total School Year Day / Total Working Days across all months) × 100, to 2 decimal places.
- Client-side validation: "From date cannot be later than to date."

## 4. User flows

**Happy path:**
1. Admin opens Yearly Attendance Report.
2. Selects grade → standard → division.
3. Enters From Date (e.g., 1 June 2025) and To Date (e.g., 31 March 2026).
4. Clicks Search.
5. Table renders with one column per month in the range.
6. Exports to Excel for end-of-year records.

## 5. Data model

Reads from `attendance_student`, aggregated by student and month number. Backend returns:

| Response field | Meaning |
|---|---|
| `student_data[]` | Student list (id, enrollment_no, first_name, middle_name, last_name) |
| `attendance_data` | Map: student_id → { month_number → present_count } |
| `working_day` | Map: month_number → working_days_count |
| `month[]` | Ordered array of month numbers present in the date range |
| `from_date`, `to_date` | Actual date range used by backend |

Related tables: `attendance_student`, `tblstudent`, `tblstudent_enrollment`, `standard`, `division`, `academic_section`.

## 6. APIs

| Method | Proxy path | Key request params | Key response fields |
|---|---|---|---|
| POST | `student/yearly_student_attendance` | `grade`, `standard`, `division`, `from_date`, `to_date`, session params | `student_data[]`, `attendance_data{}`, `working_day{}`, `month[]`, `from_date`, `to_date`, `message`, `status_code` |

## 7. UI components & design tokens

- `SearchDropdown` — grade/standard/division cascade
- `PageFrame`, `PageHeader`, `SectionPanel`, `InlineMessage`, `LoadingRows`, `EmptyTableRow` — fees-shared
- `Button`, `Input`, `Table` — shadcn
- Export utilities: `exportRowsAsCsv`, `exportRowsAsExcel`, `exportRowsAsPdf`, `openPrintPreview` — `lib/table-export`

## 8. Reports & exports

Export formats: **CSV**, **Excel (.xls)**, **PDF**, **Print preview**.
Filename: `yearly-attendance-report.<ext>`.
Export includes all dynamic month columns, total and percentage columns.

## 9. Test cases

| ID | Scenario | Steps | Expected result | Type |
|---|---|---|---|---|
| YR-01 | Full year report | Select class, Jun–Mar range, search | Monthly columns, working days row, student rows with counts | Happy |
| YR-02 | From > To validation | Enter from_date > to_date | "From date cannot be later than to date" error | Negative |
| YR-03 | Missing fields | Leave division empty | "Select section, standard, division, from date, and to date" info message | Negative |
| YR-04 | Export Excel | Search, export | File downloads with dynamic month columns | Happy |
| YR-05 | Partial year | Jun–Sep only | Only 4 month columns rendered | Happy |
| YR-06 | Student with zero attendance | Student with no rows in `attendance_student` | 0 in all month cells, 0% | Edge |

## 10. Known issues, limitations & FAQs

- Description text in the page header references "Compare the old ERP yearly attendance report against the new frontend" — this is a development note left in the page title description; it should be replaced for production.
- Working days are backend-computed; if a holiday was not entered in `calendar_events`, it appears as a working day.
- **FAQ:** "Why are some months missing?" — only months that have at least one attendance record in the range are shown as columns.

## 11. Sales notes

**Selling points:**
- Annual attendance summary in one screen, covering any date range.
- Working-days row shows actual school days per month.
- End-of-year percentage per student — ready for promotion decisions.

**Demo flow:**
1. Select a class and the full academic year range.
2. Show the month columns populating with per-student counts.
3. Export to Excel — instant annual register.

**Plan/pricing:** TBD

## 12. v1 status & v2 ideas

**Complete:** Dynamic month columns, working-days row, per-student totals and %, all exports.

**Partial:** Page description contains a dev-time note ("Compare the old ERP…") — should be cleaned before GA.

**v2 ideas:**
- Highlight students below 75% in red.
- Direct link to monthwise drill-down per student.
- Downloadable consolidated PDF for the entire school.

## Source files

- Frontend: `C:\rajesh\lms_k12\app\student\yearly_student_attendance\page.tsx`
- DB migration: `F:\xampp\htdocs\next_lms_erp\database\migrations\2023_03_05_115658_create_attendance_student_table.php`

# Monthwise Attendance Report
**Product:** Scholar Core | **Module:** Attendance | **Frontend route:** `/student/monthwise_student_attendance` | **v1 status:** Complete

| Field | Value |
|---|---|
| Backend routes | `POST student/show_monthwise_student_attendance` (via `/api/proxy`), `GET get_batch` |
| Roles | Admin, Class Teacher, Principal |
| Last updated | 2026-11-04 |
| Source commit | 8fe500dc (FE) / 86261072 (BE) |

## 1. Purpose & users

Shows a student-wise attendance register for a full calendar month. Each row is a student; each column is a day of the month. Cells show P (present), A (absent), S (Sunday), H (holiday), V (vacation), or – (event/no data). Used for monthly attendance registers, parent communication, and low-attendance alerts.

## 2. Screens

**Monthwise Attendance Report** — `/student/monthwise_student_attendance`

| Element | Description |
|---|---|
| Grade (Section) dropdown | Cascading academic section selector (`SearchDropdown` component) |
| Standard dropdown | Cascades from grade |
| Division dropdown | Cascades from standard |
| Batch dropdown | Optional; loads after standard+division are selected |
| Year selector | Calendar years derived from academic years in session; extends to current year |
| Month selector | January – December |
| Search button | Loads the report |
| Report table | Student rows × day columns (1–31); summary columns: Total Working Days, Total Present, Total Absent, Per % |
| Export buttons | CSV, Excel, PDF, Print |

![](./screenshots/monthwise-report.png)

## 3. Features & business rules

| Field | Type | Required | Validation | Default |
|---|---|---|---|---|
| Grade | Select | Yes | From `academic_section` | — |
| Standard | Select | Yes | Cascades from grade | — |
| Division | Select | Yes | Cascades from standard | — |
| Batch | Select | No | Optional sub-group | — |
| Year | Select | Yes | From academic years + current year | Current academic year |
| Month | Select | Yes | 1–12 | — |

**Day marker logic (client-side):**
- If `attendance_data[student_id][day]` exists → use P or A.
- If day is in `sundays[]` → S.
- If day is in `holidays[]` → H.
- If day is in `vacations[]` → V.
- If day is in `events[]` → –.
- Otherwise → –.

**Working day calculation per student:** Count days where attendance_data exists (P or A) and the day is not in sundays/holidays/vacations/events. Percentage = (Present / Working Days) × 100.

**Year options:** The year list extends from the oldest academic year to `max(latest_academic_year + 1, current_calendar_year)`. This corrects a prior bug where attendance in a later calendar year (e.g., 2026) wasn't searchable if the academic year label was 2024.

## 4. User flows

**Happy path:**
1. Admin opens Monthwise Attendance Report.
2. Selects grade → standard → division.
3. Selects year and month.
4. Optionally selects a batch.
5. Clicks Search.
6. Table loads with one row per student, day markers, and summary columns.
7. Exports to Excel for parent distribution.

## 5. Data model

Reads from `attendance_student` where `attendance_date` is within the selected month/year. The backend also returns:

| Response field | Meaning |
|---|---|
| `student_data[]` | Student list (id, enrollment_no, first_name, middle_name, last_name, standard_name, division_name, batch_title) |
| `attendance_data` | Nested map: student_id → { day_number → 'P'/'A' } |
| `sundays[]` | Day numbers that are Sundays |
| `holidays[]` | Day numbers that are holidays (`calendar_events`) |
| `vacations[]` | Day numbers that are vacations |
| `events[]` | Day numbers that are events |
| `to_date` | Last day of the month (used to determine how many columns to render) |

Related tables: `attendance_student`, `tblstudent`, `tblstudent_enrollment`, `standard`, `division`, `batch`, `academic_section`, `calendar_events`.

## 6. APIs

| Method | Proxy path | Key request params | Key response fields |
|---|---|---|---|
| POST | `student/show_monthwise_student_attendance` | `grade`, `standard`, `division`, `year`, `month`, `batch_sel` (optional), session params | `student_data[]`, `attendance_data{}`, `sundays[]`, `holidays[]`, `vacations[]`, `events[]`, `to_date`, `message` |
| GET | `get_batch` | `standard_id`, `division_id` | Batch options array |

## 7. UI components & design tokens

- `SearchDropdown` — `components/search-dropdown/SearchDropdown` (grade/standard/division cascade)
- `PageFrame`, `PageHeader`, `SectionPanel`, `Field`, `NativeSelect`, `InlineMessage`, `LoadingRows`, `EmptyTableRow` — fees-shared
- `Button`, `Table` — shadcn
- Export utilities: `exportRowsAsCsv`, `exportRowsAsExcel`, `exportRowsAsPdf`, `openPrintPreview` — `lib/table-export`
- `useAuth` — `contexts/AuthContext` (reads `menuContext`, `academicYears`)

## 8. Reports & exports

Export formats: **CSV**, **Excel (.xls)**, **PDF**, **Print preview**.
Filename: `monthwise-attendance-report.<ext>`.
Export columns include all day columns (1–N) plus summary columns.

## 9. Test cases

| ID | Scenario | Steps | Expected result | Type |
|---|---|---|---|---|
| MW-01 | Full month report | Select grade/std/div, year, month → Search | Student rows with day markers and summary | Happy |
| MW-02 | Sunday marked as S | Check a day that is a Sunday | Cell shows "S" | Happy |
| MW-03 | Holiday marked as H | Check a known holiday date | Cell shows "H" | Happy |
| MW-04 | Year extends to current year | Open year dropdown | Current calendar year is an option even if not an academic year | Edge |
| MW-05 | Batch filter | Select batch after std/div → Search | Only students in that batch shown | Happy |
| MW-06 | Export Excel | Search, export | File downloads with day columns and summary | Happy |
| MW-07 | No students found | Valid class, month with no enrollment | "No attendance rows found" info message | Negative |
| MW-08 | Missing session context | No `sub_institute_id` in localStorage | Error: "Session institute or academic year is missing" | Negative |

## 10. Known issues, limitations & FAQs

- The `to_date` field from the backend controls how many day columns render; if it's missing, the client falls back to `getDaysInMonth(year, month)`.
- Batch filter is hidden when `get_batch` returns an empty array — no "batch filtering not available" message in this screen (unlike student_attendance).
- **Known comment in code:** "Attendance API returned no standard/division rows" — the page has a fallback chain (payload → stored session → grade/standard APIs) which can produce an info message.
- **FAQ:** "Why do some cells show –?" — either no attendance was taken that day or it was an event. Check the calendar.

## 11. Sales notes

**Selling points:**
- Complete monthly attendance sheet per class — matches the physical register format.
- Automatic highlighting of Sundays, holidays, and vacations.
- One-click export for parent distribution or government submission.

**Demo flow:**
1. Select a class and last month.
2. Show the grid with S on Sundays and H on a holiday.
3. Export to Excel — show it's ready for the principal's file.

**Plan/pricing:** TBD

## 12. v1 status & v2 ideas

**Complete:** Full month grid, day markers (P/A/S/H/V/–), working-day and % calculation, batch filter, all export formats.

**v2 ideas:**
- Color-code cells (green = P, red = A, grey = non-working).
- Low-attendance alert flag (< 75%) per student row.
- Direct WhatsApp to parent for students below threshold.

## Source files

- Frontend: `C:\rajesh\lms_k12\app\student\monthwise_student_attendance\page.tsx`
- Shared components: `C:\rajesh\lms_k12\components\search-dropdown\SearchDropdown.tsx`
- DB migration: `F:\xampp\htdocs\next_lms_erp\database\migrations\2023_03_05_115658_create_attendance_student_table.php`

# Create Periods
**Product:** Scholar Core | **Module:** Academic Setup | **Frontend route:** `/academic_setup/create_periods` | **v1 status:** Complete

| Field | Value |
|---|---|
| Backend routes | `GET /academic-setup/periods`, `POST /academic-setup/periods`, `PUT /academic-setup/periods/{id}`, `DELETE /academic-setup/periods/{id}` |
| Roles | Admin, Academic Coordinator |
| Last updated | 2026-11-04 |
| Source commit | 8fe500dc (FE) / 86261072 (BE) |

## 1. Purpose & users
Defines the daily time slots (periods) used for timetable construction and attendance marking. Each period has a start/end time and can optionally be flagged for attendance tracking. Set up once per grade / academic year before building the timetable.

## 2. Screens
**Period list** — `/academic_setup/create_periods`
Table columns: Period, Short name, Sort order, Start time, End time, Attendance. Actions: add, edit, delete, search.

![](./screenshots/periods-list.png)

## 3. Features & business rules

| Field | Type | Required | Validation | Default |
|---|---|---|---|---|
| Period title | Text | Yes | — | — |
| Short name | Text | Yes | — | — |
| Sort order | Number | Yes | Controls display order in timetable grid | — |
| Grade | Select (`academic_section`) | No | — | — |
| Academic year | Select | No | — | Current session year |
| Start time | Time | Yes | Must be before End time | — |
| End time | Time | Yes | Must be after Start time | — |
| Used for attendance | Checkbox | No | | false |
| Standards | Multi-select | No | Periods can be scoped to specific standards | — |

- Periods are scoped to `sub_institute_id`.
- `used_for_attendance = true` → this period appears in attendance entry screens.
- `sort_order` determines left-to-right column order in the timetable grid.
- `marking_period_id` is stored but not actively used in period queries (v1).

**Permissions:** CRUD via group/individual rights on `academic_setup.periods`.

## 4. User flows

**Create period:**
1. Click "Add period".
2. Enter title, short name, sort order, start/end time.
3. Optionally flag as attendance period; select applicable standards.
4. Save → period appears and is available in timetable.

**Edit/Delete:** Standard inline edit and delete.

## 5. Data model

**Table: `period`**

| Column | Type | Notes |
|---|---|---|
| id | bigint PK | |
| title | varchar | Period name, e.g. "Period 1" |
| short_name | varchar | e.g. "P1" |
| sort_order | int | |
| used_for_attendance | tinyint | 1 = yes |
| start_time | time | |
| end_time | time | |
| length | int nullable | Duration in minutes (derived) |
| academic_section_id | int FK → `academic_section.id` nullable | Grade scope |
| academic_year_id | int nullable | |
| status | tinyint | 1 = active |
| sub_institute_id | int | Tenant |
| marking_period_id | int nullable | |
| created_at / updated_at | timestamp | |

**Referenced by:** `timetable.period_id`.

## 6. APIs

| Method | Endpoint | Auth | Request | Response |
|---|---|---|---|---|
| GET | `/api/academic-setup/periods` | JWT session | session params | `{ records, grades, academicYears, … }` |
| POST | `/api/academic-setup/periods` | JWT session | period fields | `{ status_code, message }` |
| PUT | `/api/academic-setup/periods/{id}` | JWT session | period fields | `{ status_code, message }` |
| DELETE | `/api/academic-setup/periods/{id}` | JWT session | — | `{ status_code, message }` |

## 7. UI components & design tokens
Shared `AcademicSetupPage` component. Time fields rendered with `<input type="time">`. Multi-select for standards uses the `multiselect` field kind. See [batch.md](batch.md) §7.

## 8. Reports & exports
Periods appear in timetable views and attendance reports. No standalone period report.

## 9. Test cases

| ID | Scenario | Steps | Expected result | Type |
|---|---|---|---|---|
| P01 | Create period with valid times | 09:00–09:45, sort 1 | Period saved | Happy |
| P02 | End time before start | Start 10:00, End 09:00 | Validation error | Negative |
| P03 | Attendance flag | Check "Used for attendance" | Period available in attendance screens | Happy |
| P04 | Sort order controls grid | Periods with sort 1, 2, 3 | Appear in that order in timetable | Happy |
| P05 | Delete period in use | Delete a period assigned in timetable | Should warn or be blocked (TBD — no server-side check found in v1) | Edge |

## 10. Known issues, limitations & FAQs
- No server-side validation found preventing deletion of a period that is used in timetable entries — this may cause orphaned timetable rows.
- `length` column exists but is not set by the form; it would need to be calculated from start/end times.
- **FAQ:** "Period not showing in timetable" — ensure it is active and its grade matches the class being scheduled.

## 11. Sales notes
- Flexible period setup supports any bell schedule (uniform, rotating, block).
- Demo: create 8 periods → assign attendance flag to 6 → show timetable grid with correct columns.

## 12. v1 status & v2 ideas
- v1: Complete for basic CRUD.
- v2: Auto-calculate `length`; warn on delete if period is in use; block scheduling of non-instructional periods (break, lunch).

## Source files
- `C:\rajesh\lms_k12\app\academic_setup\create_periods\page.tsx`
- `C:\rajesh\lms_k12\app\academic_setup\_components\AcademicSetupPage.tsx`
- `F:\xampp\htdocs\next_lms_erp\app\Http\Controllers\school_setup\periodController.php`
- `F:\xampp\htdocs\next_lms_erp\app\Models\school_setup\periodModel.php`
- `F:\xampp\htdocs\next_lms_erp\routes\api.php` (lines 499–502)

# Student Attendance
**Product:** Scholar Core | **Module:** Attendance | **Frontend route:** `/student/student_attendance` | **v1 status:** Complete

| Field | Value |
|---|---|
| Backend routes | `POST /student/student_attendance` (via proxy path `student/student_attendance`), `POST student/show_student_attendance`, `POST student/save_student_attendance` |
| Roles | Admin, Class Teacher |
| Last updated | 2026-11-04 |
| Source commit | 8fe500dc (FE) / 86261072 (BE) |

## 1. Purpose & users

Allows class teachers and admins to mark daily student attendance for a standard/division. Teachers see only their assigned class(es). The register preloads existing attendance for the selected date so corrections are possible.

## 2. Screens

**Student Attendance Register** — `/student/student_attendance`

| Element | Description |
|---|---|
| Standard dropdown | Filtered to teacher's assigned classes (from `class_teacher` table) |
| Division dropdown | Cascades from selected standard |
| Date picker | Defaults to today; max = today; Sundays are blocked |
| Search button | Loads the register for the selected class + date |
| Mark All Present / Mark All Absent buttons | Bulk-sets all rows |
| Register table | Columns: No., GR no., Roll no., Last Name, First Name, Middle Name, Present (radio), Absent (radio) |
| Present/Absent/Total counters | Live summary above the table |
| Save Attendance button | Posts all radio states to backend |

![](./screenshots/mark-attendance.png)

## 3. Features & business rules

| Field | Type | Required | Validation | Default |
|---|---|---|---|---|
| Standard | Select | Yes | Must be in teacher's assigned list | First option |
| Division | Select | Yes | Cascades from standard | First option |
| Date | Date | Yes | Cannot be Sunday; must be within academic year start/end dates | Today |
| Attendance code per student | Radio (P / A) | Yes | P = Present, A = Absent | P (preloaded from DB if exists) |

**Permission rules:**
- Class teachers see only standards/divisions where they are assigned as `class_teacher`.
- Admins see all standards/divisions.
- Sunday dates are blocked client-side with an error message: "Sunday is already a holiday."
- Backend validates that the selected date falls within `academic_year.post_start_date` → `post_end_date`.
- If a student has no attendance record for the date, they are treated as present by default on save.

**Batch filtering:** The backend returns batch options if batches exist for the standard/division. Batch selection narrows the student list. Frontend notes this as "not available right now" if the batch API fails.

## 4. User flows

**Happy path — mark attendance:**
1. Teacher opens Student Attendance.
2. Page loads standards assigned to the teacher.
3. Teacher selects standard → division auto-populates.
4. Teacher selects the date.
5. Teacher clicks Search.
6. Register table loads with existing attendance (P/A) preloaded.
7. Teacher adjusts radio buttons as needed; uses "Mark All Present" for quick mass-mark.
8. Teacher clicks Save Attendance.
9. Success message: "Student attendance saved successfully."

**Alternate — date correction:**
1. Teacher selects a past date (within academic year).
2. Register loads the previously saved attendance.
3. Teacher updates individual entries.
4. Saves. Existing rows are overwritten.

**Error — Sunday selected:**
1. Teacher picks a Sunday.
2. Client shows: "Sunday is already a holiday, so attendance can't be taken on that day."
3. No API call is made.

## 5. Data model

**`attendance_student`**

| Column | Type | Notes |
|---|---|---|
| id | bigint PK | Auto-increment |
| syear | int | Academic year |
| student_id | int (indexed) | FK → `tblstudent.id` |
| term_id | int | FK → `academic_year.term_id` |
| attendance_date | date (indexed) | The date of attendance |
| attendance_code | varchar(50) | `P` = Present, `A` = Absent |
| teacher_id | int | Who saved it |
| user_group_id | int | Role group |
| created_on | timestamp | |
| created_by | varchar(50) | |
| standard_id | int | FK → `standard.id` |
| section_id | int | FK → `division.id` |
| sub_institute_id | int | Tenant isolator |

Related: `class_teacher` (teacher → standard/division mapping), `tblstudent`, `tblstudent_enrollment`, `standard`, `division`, `batch`, `academic_year`, `calendar_events` (holidays check).

## 6. APIs

All calls go through `/api/proxy?path=<laravel-path>` from the Next.js frontend.

| Method | Proxy path | Purpose | Key request params | Key response fields |
|---|---|---|---|---|
| GET | `student/student_attendance` | Load standard/division options for teacher | `sub_institute_id`, `syear`, `user_id` | `standardDivision[]` (standard_id, division_id, standard_name, division_name) |
| GET | `get_adminAcademicSection` | Fallback: load grades | `sub_institute_id` | `data[]` |
| GET | `get_adminStandard` | Fallback: load standards by grade | `sub_institute_id`, `grade_id` | `data[]` |
| GET | `get_adminDivision` | Fallback: load divisions by standard | `sub_institute_id`, `standard_id` | `data[]` |
| POST | `student/show_student_attendance` | Fetch student list + existing attendance | `date`, `standard_division` (`std_id\|\|div_id`), session params | `student_data[]`, `attendance_data` (map student_id → P/A), `date` |
| POST | `student/save_student_attendance` | Save attendance | `date`, `standard_division`, `student[<id>]` = P/A for each student, `teacher_id`, `user_profile_id`, `type=API` | `status_code`, `message` |

**Error responses:** `status_code = 0` with a `message`. HTTP 4xx/5xx fall through to a generic error toast.

## 7. UI components & design tokens

- `PageFrame`, `PageHeader`, `SectionPanel`, `Field`, `NativeSelect`, `InlineMessage`, `LoadingRows`, `EmptyTableRow` — from `app/fees/_components/fees-shared`
- `Button`, `Input`, `Table`, `TableBody`, `TableCell`, `TableHead`, `TableHeader`, `TableRow` — shadcn/radix
- Icons: `UserCheck`, `UserX`, `CheckCircle2`, `Loader2`, `Search` — Lucide
- Color tokens: `--emerald-600` for present radio, `--rose-600` for absent radio (Tailwind semantic colors)

## 8. Reports & exports

No inline export. See:
- [Daywise Attendance Report](./daywise-report.md)
- [Monthwise Attendance Report](./monthwise-report.md)
- [Yearly Attendance Report](./yearly-report.md)

## 9. Test cases

| ID | Scenario | Steps | Expected result | Type |
|---|---|---|---|---|
| AT-01 | Happy path — mark attendance | Select class, pick today, search, mark all P, save | "Attendance saved successfully" toast | Happy |
| AT-02 | Sunday blocked | Select a Sunday date | Client error: "Sunday is already a holiday" | Edge |
| AT-03 | Date outside academic year | Select date before `post_start_date` | Backend returns `status_code=0` with date-range error | Negative |
| AT-04 | No students in class | Valid class, valid date, no enrollments | "No Student Data Found" info message | Edge |
| AT-05 | Load existing attendance | Select class + past date with saved records | Existing P/A preloaded in radio buttons | Happy |
| AT-06 | Teacher restricted to own class | Log in as class teacher; check standard dropdown | Only assigned standard/division visible | Happy |
| AT-07 | Mark All Present | Load register with some A entries, click Mark All Present | All radios flip to P | Happy |
| AT-08 | Save with no search result | Click Save without searching | "Search and load students before saving" info message | Negative |

## 10. Known issues, limitations & FAQs

- **Batch filtering UI** shows "not available right now" if the `get_batch` API fails — the batch selector is hidden when no batch options return.
- Attendance can only be P or A — no half-day, late, or leave code.
- Sunday is blocked client-side only; backend also checks for calendar events (holidays) but does not block Sundays server-side — a mismatch is possible if the client JS is bypassed.
- **FAQ:** "Why can't I see other classes?" — class teachers are limited to their `class_teacher` assignments. Contact admin to update the assignment.
- **FAQ:** "Can I edit past attendance?" — Yes, up to the academic year's `post_end_date`.

## 11. Sales notes

**Selling points:**
- One-click Mark All Present/Absent for fast daily entry.
- Real-time present/absent/total counters while marking.
- Corrections supported for any date within the academic year.
- Class-teacher scoped — teachers only see their class; no accidental cross-class edits.

**Demo flow (3 steps):**
1. Log in as a class teacher → show that only their standard/division appears.
2. Select today, click Search — roster loads instantly.
3. Mark a few absent, click Save — show success message and re-open to confirm persistence.

**Plan/pricing:** TBD

## 12. v1 status & v2 ideas

**Complete:** Mark P/A, save, reload existing, Mark All buttons, Sunday guard, academic-year boundary check, batch filtering (partial).

**Partial:** Batch filtering UI only shows when `get_batch` returns options; no "No batches available" messaging.

**v2 ideas:**
- Support half-day, late, and on-leave codes.
- Push notification to parents when a student is marked absent.
- Allow period-wise attendance (not just daily).
- Teacher mobile app offline mode with sync.

## Source files

- Frontend: `C:\rajesh\lms_k12\app\student\student_attendance\page.tsx`
- Shared components: `C:\rajesh\lms_k12\app\fees\_components\fees-shared.tsx`, `C:\rajesh\lms_k12\app\fees\_lib\fees-api.ts`
- Backend controller: `F:\xampp\htdocs\next_lms_erp\app\Http\Controllers\student\studentAttendanceController.php`
- DB migration: `F:\xampp\htdocs\next_lms_erp\database\migrations\2023_03_05_115658_create_attendance_student_table.php`

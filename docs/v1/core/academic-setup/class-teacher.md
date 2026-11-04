# Class Teacher
**Product:** Scholar Core | **Module:** Academic Setup | **Frontend route:** `/classteacher` | **v1 status:** Complete

| Field | Value |
|---|---|
| Backend routes | `GET /class-teachers`, `POST /class-teachers`, `PUT /class-teachers/{id}`, `DELETE /class-teachers/{id}` (REST resource) |
| Roles | Admin, Academic Coordinator |
| Last updated | 2026-11-04 |
| Source commit | 8fe500dc (FE) / 86261072 (BE) |

## 1. Purpose & users
Assigns one teacher as the class teacher for each standard-division for the current academic year. The class teacher has special visibility: they can view attendance, discipline, and student records for their assigned class.

## 2. Screens
**Class teacher list** — `/classteacher`
Table: Grade / Standard / Division / Teacher. Actions: add, edit, delete.

**Class teacher report** — `/classteacherReport`
Report view of all class teacher assignments. See [reports.md](reports.md).

![](./screenshots/class-teacher.png)

## 3. Features & business rules

| Field | Type | Required | Validation | Default |
|---|---|---|---|---|
| Grade (Section) | Select | Yes | Must exist in `academic_section` | Current session grade |
| Standard | Select (filtered by grade) | Yes | | — |
| Division | Select (filtered by standard) | Yes | | — |
| Teacher | Select (from staff list) | Yes | One teacher per std-div-year | — |

- One class teacher per standard-division per academic year. Duplicate assignment is blocked.
- Teacher lookup pulls from `tbluserModel` filtered to teacher profile.

**Permissions:** `class_teacher` RBAC resource via `tblgroupwise_rights`.

## 4. User flows

**Assign class teacher:**
1. Click "Add".
2. Select grade → standard → division → teacher.
3. Save → assignment visible in list.

**Replace class teacher:**
1. Edit existing row → change teacher → save.

## 5. Data model

**Table: `class_teacher`**

| Column | Type | Notes |
|---|---|---|
| id | bigint PK | |
| syear | varchar | Academic year |
| sub_institute_id | int | Tenant |
| grade_id | int FK → `academic_section.id` | |
| standard_id | int FK → `standard.id` | |
| division_id | int FK → `division.id` | |
| teacher_id | int FK → `tbluser.id` | |
| created_at / updated_at | timestamp | |

## 6. APIs

| Method | Endpoint | Auth | Request | Response |
|---|---|---|---|---|
| GET | `/api/class-teachers` | JWT session | session params | `{ data: [ classTeacher, … ] }` |
| POST | `/api/class-teachers` | JWT session | `{ grade_id, standard_id, division_id, teacher_id }` | `{ status_code, message }` |
| PUT | `/api/class-teachers/{id}` | JWT session | Same fields | `{ status_code, message }` |
| DELETE | `/api/class-teachers/{id}` | JWT session | — | `{ status_code, message }` |

API uses `apiResource` route: `F:\xampp\htdocs\next_lms_erp\routes\api.php` line 494.

## 7. UI components & design tokens
TBD — page uses a custom component, not `AcademicSetupPage`. Likely uses `SearchDropdown` for cascading class selection.

## 8. Reports & exports
Class teacher report at `/classteacherReport` — see the timetable reports section.

## 9. Test cases

| ID | Scenario | Steps | Expected result | Type |
|---|---|---|---|---|
| CT01 | Assign teacher | Select grade/std/div/teacher; save | Assignment created | Happy |
| CT02 | Duplicate assignment | Assign same std/div again | Error: already assigned | Negative |
| CT03 | Replace teacher | Edit and change teacher | New teacher set | Happy |
| CT04 | Teacher RBAC | Class teacher logs in; views their class attendance | Only their class visible | Happy |

## 10. Known issues, limitations & FAQs
- No co-class-teacher support (one per class only).
- **FAQ:** "Teacher cannot see their class" — ensure they are assigned as class teacher for the correct standard/division/year.

## 11. Sales notes
- Separates class-teacher privileges from full admin access.
- Demo: assign class teacher → log in as that teacher → show class-scoped attendance view.

## 12. v1 status & v2 ideas
- v1: Complete.
- v2: Multiple class teachers per division (co-teachers); term-based assignment.

## Source files
- `C:\rajesh\lms_k12\app\classteacher\page.tsx`
- `F:\xampp\htdocs\next_lms_erp\app\Http\Controllers\school_setup\classteacherController.php`
- `F:\xampp\htdocs\next_lms_erp\app\Models\school_setup\classteacherModel.php`
- `F:\xampp\htdocs\next_lms_erp\routes\api.php` line 494

# Create Subject
**Product:** Scholar Core | **Module:** Academic Setup | **Frontend route:** `/academic_setup/create_subject` | **v1 status:** Complete

| Field | Value |
|---|---|
| Backend routes | `GET /academic-setup/subjects`, `POST /academic-setup/subjects`, `PUT /academic-setup/subjects/{id}`, `DELETE /academic-setup/subjects/{id}` |
| Roles | Admin, Academic Coordinator |
| Last updated | 2026-11-04 |
| Source commit | 8fe500dc (FE) / 86261072 (BE) |

## 1. Purpose & users
Maintains the institute-wide subject master. All LMS content, timetable slots, results and attendance records reference subjects from this list. Created once and reused across academic years.

## 2. Screens
**Subject list screen** — `/academic_setup/create_subject`
Table columns: Subject name, Subject code, Short name, Type (Major / Minor). Actions: add, edit, delete, search.

![](./screenshots/subject-list.png)

## 3. Features & business rules

| Field | Type | Required | Validation | Default |
|---|---|---|---|---|
| Subject name | Text | Yes | Unique per institute | — |
| Subject code | Text | Yes | Unique per institute | — |
| Short name | Text | Yes | — | — |
| Major subject | Checkbox | No | — | false |

- `subject_type` stores `1` for major subjects, `0` for minor/elective.
- Scoped to `sub_institute_id`. Not year-scoped (subjects are reused across years).
- `status` column controls active/inactive; inactive subjects are excluded from timetable and LMS pickers.

**Permissions:** CRUD controlled by group/individual rights on the `academic_setup.subjects` link.

## 4. User flows

**Create subject:**
1. Click "Add subject".
2. Enter name, code, short name; check "Major subject" if applicable.
3. Save → appears in list.

**Subject in LMS/Timetable:** Once created, subject appears in timetable assignment dropdowns and LMS curriculum.

## 5. Data model

**Table: `subject`**

| Column | Type | Notes |
|---|---|---|
| id | bigint PK | |
| subject_name | varchar | Display name |
| subject_code | varchar | Unique code |
| short_name | varchar | Abbreviation |
| subject_type | tinyint | 1 = major, 0 = minor |
| sub_institute_id | int | Tenant scope |
| status | tinyint | 1 = active |
| marking_period_id | int nullable | |
| created_at / updated_at | timestamp | |

**Referenced by:** `timetable.subject_id`, `sub_std_map.subject_id`, `lms_homework`, `lms_curriculum`, etc.

## 6. APIs

| Method | Endpoint | Auth | Request | Response |
|---|---|---|---|---|
| GET | `/api/academic-setup/subjects` | JWT session | session params | `{ records, grades, standards, … }` |
| POST | `/api/academic-setup/subjects` | JWT session | `{ subject_name, subject_code, short_name, subject_type }` | `{ status_code, message }` |
| PUT | `/api/academic-setup/subjects/{id}` | JWT session | Same fields | `{ status_code, message }` |
| DELETE | `/api/academic-setup/subjects/{id}` | JWT session | — | `{ status_code, message }` |

## 7. UI components & design tokens
Shared `AcademicSetupPage` component. See [batch.md](batch.md) §7.

## 8. Reports & exports
No standalone report. Subjects appear in subject-standard mapping, timetable, and LMS reports.

## 9. Test cases

| ID | Scenario | Steps | Expected result | Type |
|---|---|---|---|---|
| S01 | Create subject | Enter name, code, short name; save | Subject created | Happy |
| S02 | Duplicate code | Same code as existing subject | Error returned | Negative |
| S03 | Mark as major | Check "Major subject"; save | subject_type = 1 | Happy |
| S04 | Delete unused subject | Delete subject not assigned to timetable | Removed | Happy |
| S05 | Search | Type partial name in search box | Filtered list | Happy |

## 10. Known issues, limitations & FAQs
- No subject categories in this screen; categories are managed in LMS curriculum.
- Subject code uniqueness is enforced per institute but the error message from the server is generic.
- **FAQ:** "Subject not showing in timetable" — check subject-standard mapping.

## 11. Sales notes
- Central subject master ensures consistency across modules (timetable, LMS, result, attendance).
- Demo: create a subject → see it appear immediately in timetable assignment dropdown.
- Pricing: Scholar Core base.

## 12. v1 status & v2 ideas
- v1: Complete.
- v2: Subject categories from main screen; import from Excel; subject-level curriculum standards mapping.

## Source files
- `C:\rajesh\lms_k12\app\academic_setup\create_subject\page.tsx`
- `C:\rajesh\lms_k12\app\academic_setup\_components\AcademicSetupPage.tsx`
- `F:\xampp\htdocs\next_lms_erp\app\Http\Controllers\school_setup\subject1Controller.php`
- `F:\xampp\htdocs\next_lms_erp\app\Models\school_setup\subjectModel.php`
- `F:\xampp\htdocs\next_lms_erp\routes\api.php` (lines 499–502)

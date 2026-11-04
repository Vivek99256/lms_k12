# Marks Entry
**Product:** Scholar Core | **Module:** Exam / Result | **Frontend route:** `/result/marks-entry` | **v1 status:** Complete

| Field | Value |
|---|---|
| Backend routes | `GET api/result/marks-entry/create`, `POST api/result/marks-entry`, `POST api/result/marks-entry/approve` |
| Roles | Teacher (enter), Exam Coordinator / Admin (approve) |
| Last updated | 2026-11-04 |
| Source commit | 8fe500dc (FE) / 86261072 (BE) |

## 1. Purpose & users
Allows teachers to enter scholastic exam marks for a class-subject-exam combination, with automatic percentage and grade calculation. Exam coordinators can lock (approve) or unlock (unapprove) a set of marks. Used throughout the exam cycle for every subject and division.

## 2. Screens

### Marks Entry screen
Route: `/result/marks-entry`

**Filter bar** (all required):
- Term, Section, Standard, Division, Subject, Exam Master, Exam

After search: student list table with editable marks + remark fields.

Actions: **Save marks** (disabled when approved), **Approve marks** / **Unapprove marks** with confirmation dialogs.

![](./screenshots/marks-entry.png)

## 3. Features & business rules

| Field | Type | Required | Validation | Default |
|---|---|---|---|---|
| Marks | text input | Yes | Numeric 0–maxMarks, or AB / N.A. / EX (case-insensitive) | — |
| Max marks | read-only | — | Comes from exam config | — |
| Percentage | read-only | — | Auto: (marks/maxMarks)×100, 2dp | — |
| Grade | read-only | — | Auto from grade scale lookup on rounded % | — |
| Remark / Comment | textarea | No | Free text | — |

**Business rules:**
- Max marks capped at 500 client-side. Server does not enforce a marks ceiling.
- Special values AB (Absent), N.A. (Not Applicable), EX (Exempt) are accepted as non-numeric; grade becomes "–" and percentage = 0.
- Comment field: a known workaround sends a non-breaking space (`\u00A0`) instead of empty string to avoid a Laravel middleware bug where empty string is converted to `null` and fails the NOT NULL constraint on `result_marks.comment`. On read, JS `.trim()` strips it back to blank for display.
- Approval locks the entire exam/subject/division combination. Locked marks cannot be edited.
- `approve_status` row with `status=0` = unlocked (unapproved); `status=1` = locked (approved). A null approve_status row also means unlocked.
- Grade link: "Grade scale mapping" button links to `/result/master/standard-grade-mapping`.

**Permissions:**
- Teachers can save marks for their assigned subjects/classes.
- Only Admin / Exam Coordinator can approve or unapprove.

## 4. User flows

### Happy path — enter and approve marks
1. Navigate to Result → Entry → Mark entry.
2. Select Term → Section → Standard → Division → Subject → Exam Master → Exam → Search.
3. Table loads with student list (roll no, name, marks field, %).
4. Enter marks for each student; grade auto-fills.
5. Add optional remarks.
6. Click "Save marks" → success toast.
7. Click "Approve marks" → confirmation dialog → "Approve" → marks locked.

### Unapprove for correction
1. Same filters → Search.
2. Status shows "Approved" badge.
3. Click "Unapprove marks" → confirm → marks editable again.

## 5. Data model

| Table | Key columns | Notes |
|---|---|---|
| `result_marks` | `id`, `student_id`, `exam_id`, `subject_id`, `standard_id`, `division_id`, `term_id`, `points`, `per`, `grade`, `comment`, `sub_institute_id` | One row per student per exam per subject |
| `result_exam_approve` | `id`, `exam_id`, `subject_id`, `standard_id`, `division_id`, `term_id`, `status` (0/1), `sub_institute_id` | Approval state per exam/subject/div |
| `result_exam_master` | `id`, `exam_title`, `standard_id`, `term_id`, `weightage`, `sub_institute_id` | Exam metadata |

## 6. APIs

| Method | Endpoint | Auth | Request params | Response |
|---|---|---|---|---|
| GET | `api/result/marks-entry/create` | JWT | `term, grade, standard, division, subject, exam_master, exam` | `{ stu_data: StudentRow[], grd_data: GradeRanges, approve_status: row\|null }` |
| POST | `api/result/marks-entry` | JWT | `term_id, standard_id, division_id, subject_id, exam_id, values[studentId][exam_id\|points\|per\|grade\|comment]` | `{ success, message }` |
| POST | `api/result/marks-entry/approve` | JWT | `approve (0\|1), term_id, standard_id, division_id, subject_id, exam_id` | `{ success, message }` |

Also uses:
- `GET api/get-subject-list?standard_id=&division_id=` — populate subject dropdown
- `GET api/get-exam-master-list?standard_id=&term_id=` — populate exam master dropdown
- `GET api/get-exam-list?standard_id=&subject_id=&term_id=&exam_id=` — populate exam dropdown

Controller: `marks_entry_controller.php`

## 7. UI components & design tokens
- `FilterBar` — dynamic filter row (`components/result/FilterBar.tsx`)
- `PageHeader` — breadcrumb + title (`components/result/PageHeader.tsx`)
- `StatusChip` — approval badge (`components/result/primitives`)
- `ConfirmDialog` — approve/unapprove confirmation modal
- `TableSkeleton` — loading placeholder
- `Banner` — inline error display
- Lucide icons: `ClipboardList`, `CheckCircle2`, `Save`, `Users`, `ExternalLink`

## 8. Reports & exports
- Marks approval report: `/result/reports/marks-approval` — see [result-approval.md](./result-approval.md)
- Classwise grade report: `/result/reports/classwise-grade`
- Consolidate report: `/result/reports/consolidate`

## 9. Test cases

| ID | Scenario | Steps | Expected result | Type |
|---|---|---|---|---|
| ME-01 | Enter numeric marks and save | Enter 85 for all students → Save | Saved; % and grade auto-calculated | Happy |
| ME-02 | Enter AB (absent) | Enter "AB" → Save | Saved; grade = "–", % = 0 | Happy |
| ME-03 | Approve marks | Save then Approve | Marks locked; input disabled | Happy |
| ME-04 | Edit after approve | Try to change marks after approval | Input disabled; Save button disabled | Edge |
| ME-05 | Unapprove | Unapprove → edit → save | Editable again; save works | Happy |
| ME-06 | Empty comment save | Leave remark blank → Save | Saved with NBSP placeholder; displayed as blank | Edge |
| ME-07 | Marks > maxMarks | Enter 600 when max is 100 | Inline validation error | Negative |
| ME-08 | Invalid value | Enter "xyz" | Inline error "0–100, AB, N.A. or EX" | Negative |
| ME-09 | No students in class | Search for empty division | Empty state shown | Edge |

## 10. Known issues, limitations & FAQs
- **Comment NOT NULL bug** — the `result_marks.comment` column is NOT NULL with no default. An empty comment submitted as `''` triggers a 500 via Laravel's `ConvertEmptyStringsToNull` middleware. Workaround: NBSP sent; addressed in `orSpace()`. (v2: change column to nullable.)
- **No server-side marks ceiling** — the 500 mark cap is client-only.
- **Partial save not visible** — if save fails mid-batch, there is no row-level rollback indicator.
- FAQ: *Why can't I edit marks?* — Marks are approved/locked. Ask the exam coordinator to unapprove.
- FAQ: *Grade shows "–" for numeric marks* — The grade scale is not mapped to this standard. Check Grade master → Grade data.

## 11. Sales notes
- **Selling point:** One screen for data entry + instant grade derivation + approval workflow. Replaces spreadsheet-based mark entry entirely.
- **Demo flow:** (1) Select Term/Class/Subject/Exam → (2) Enter marks, watch grade auto-fill → (3) Approve → show locked state.
- Pricing: TBD (included in Scholar Core).

## 12. v1 status & v2 ideas
- v1: Complete. Core flow, approval, grade calculation all work.
- Known gaps: comment column NOT NULL; no server-side cap; no batch import.
- v2: Co-scholastic marks entry on same screen; bulk import from Excel; server-side marks validation.

## Source files
- `C:\rajesh\lms_k12\app\result\marks-entry\page.tsx`
- `C:\rajesh\lms_k12\lib\result\api.ts`
- `F:\xampp\htdocs\next_lms_erp\app\Http\Controllers\result\marks_entry_controller.php`
- `F:\xampp\htdocs\next_lms_erp\app\Models\result\marks_entry.php`
- `F:\xampp\htdocs\next_lms_erp\app\Models\result\ExamMaster.php`
- Migrations: `2023_03_05_115658_create_result_marks_table.php`, `2023_08_03_115659_create_result_exam_approve_table.php`

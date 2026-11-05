# Assignment
**Product:** Scholar Learn | **Module:** LMS | **Frontend route:** `/lms/lmsAssignment` (create) · `/lms/lmsAnnotate_assignment` (annotate) · `/lms/lmsAssignment_submission` (student submission) | **v1 status:** Complete

| Field | Value |
|---|---|
| Backend routes | `POST /lms-assignment/subjects`, `POST /lms-assignment/students`, `POST /lms-assignment/exam-papers`, `POST /lms-assignment/store`, `POST /lms-assignment/list`, `POST /lms-assignment/bulk-delete`, `POST /lms-assignment/submission-list`, `POST /lms-assignment/submission-store`, `POST /lms-assignment/ai-status/{id}`, `POST /lms-assignment/annotate-list`, `POST /lms-assignment/annotate-questions`, `POST /lms-assignment/annotate-store`, `POST /lms-assignment/upload-homework` |
| Roles | Teacher (create/annotate/review), Student (submit) |
| Last updated | 2026-11-04 |
| Source commit | 8fe500dc (FE) / 86261072 (BE) |

## 1. Purpose & users
Assignments are offline-paper-based work: teachers select an exam paper, attach it to a class, and students upload scanned/photographed answer sheets. Teachers then annotate the uploaded sheets digitally (draw on the image, circle errors, add marks). An AI evaluation layer runs in the background.

The form is shared with Worksheet and Project screens via `AssignWorkPanel` with `workType="assignment"`.

## 2. Screens

### Create Assignment — `/lms/lmsAssignment`
Shows: `AssignWorkPanel` form — class filter, exam paper selector, student list.
Main actions: assign, upload paper.
![](./screenshots/assignment-create.png)

### Annotate Assignment — `/lms/lmsAnnotate_assignment`
Shows: list of submissions to annotate; image viewer with annotation tools.
Main actions: draw annotations, set marks per question, save annotation.

### Student Submission — `/lms/lmsAssignment_submission`
Shows: list of assignments to submit; upload answer sheet.
Main actions: upload file.

## 3. Features & business rules

| Field | Type | Required | Notes |
|---|---|---|---|
| Subject | Dropdown | Yes | Via `POST /lms-assignment/subjects` |
| Class (standard + division) | Dropdown | Yes | Via `POST /lms-assignment/students` |
| Exam Paper | Dropdown | Yes | Via `POST /lms-assignment/exam-papers` |
| Student list | Auto-loaded | — | Based on class selection |
| Answer sheet (student) | File upload | Yes | MIME + size validation |

AI evaluation: after submission, `POST /lms-assignment/ai-status/{id}` returns AI grade and feedback. Teacher annotates on top of AI marks.

## 4. User flows

**Teacher assigns:**
1. Open `/lms/lmsAssignment`.
2. Select subject → class → exam paper.
3. Submit → `POST /lms-assignment/store`.

**Student submits:**
1. Open `/lms/lmsAssignment_submission` (redirected to if student accesses teacher route).
2. Upload answer sheet → `POST /lms-assignment/submission-store`.

**Teacher annotates:**
1. Open `/lms/lmsAnnotate_assignment`.
2. Load submission list → `POST /lms-assignment/annotate-list`.
3. Open sheet → overlay annotation tools.
4. Mark questions → `POST /lms-assignment/annotate-store`.

## 5. Data model

| Table | Key columns | Notes |
|---|---|---|
| `lms_assignment` | `id`, `sub_institute_id`, `syear`, `standard_id`, `subject_id`, `exam_paper_id`, `teacher_id`, `created_at` | Assignment record |
| `lms_assignment_submissions` | `id`, `assignment_id`, `student_id`, `file_path`, `ai_grade`, `teacher_annotations`, `submitted_at` | Submission + annotations |

## 6. APIs

| Method | Endpoint | Auth | Notes |
|---|---|---|---|
| POST | `/lms-assignment/store` | JWT | Create assignment |
| POST | `/lms-assignment/list` | JWT | List with filters |
| POST | `/lms-assignment/submission-store` | JWT | Student submits |
| POST | `/lms-assignment/ai-status/{id}` | JWT | Poll AI grading |
| POST | `/lms-assignment/annotate-store` | JWT | Save annotation |
| POST | `/lms-assignment/upload-homework` | JWT | Upload paper file |

## 7. UI components & design tokens
- `AssignWorkPanel` — shared form component (also used by Worksheet + Project)
- `RequireStaff` redirects student to submission page
- Lucide icons via shared panel

## 8. Reports & exports
See [./reports.md](./reports.md).

## 9. Test cases

| ID | Scenario | Steps | Expected result | Type |
|---|---|---|---|---|
| AS-01 | Assign paper | Select class + paper, store | Assignment in student list | Happy |
| AS-02 | Student submits | Upload answer sheet | Submission recorded | Happy |
| AS-03 | Teacher annotates | Open sheet, draw, save | Annotations stored | Happy |
| AS-04 | AI grade | Submit; poll ai-status | Grade returned | Happy |
| AS-05 | Student hits teacher route | Log in as student, open `/lms/lmsAssignment` | Redirected to submission page | Edge |

## 10. Known issues, limitations & FAQs
- Annotation tool implementation is not visible from `page.tsx` alone — UI detail is TBD without reading `annotateAssignmentController.php`.
- `AssignWorkPanel` is shared with Worksheet and Project — changes to it affect all three.

## 11. Sales notes
- **Selling point**: digital annotation of physical answer sheets; no paper scanning system required beyond a phone camera.
- **Demo flow**: (1) Teacher assigns exam paper to class; (2) student uploads photo of answer sheet; (3) teacher opens annotation view, draws circles, marks per question; (4) show AI pre-grading in background.
- Plan/pricing: TBD.

## 12. v1 status & v2 ideas
- v1: Complete. Create, submit, annotate, AI grade all functional.
- v2: Side-by-side marking scheme view during annotation; bulk annotation export.

## Source files
- `C:\rajesh\lms_k12\app\lms\lmsAssignment\page.tsx`
- `C:\rajesh\lms_k12\app\lms\lmsAnnotate_assignment\page.tsx` (if exists)
- `C:\rajesh\lms_k12\app\lms\_shared\assign-work-panel.tsx`
- `F:\xampp\htdocs\next_lms_erp\app\Http\Controllers\api\lms\LmsAssignmentApiController.php`
- `F:\xampp\htdocs\next_lms_erp\app\Http\Controllers\lms\assignment\annotateAssignmentController.php`

# Backend API spec — LMS Assignment (`api/lms-assignment/*`)

> **Status: REQUIRED BACKEND WORK — not yet implemented.**
>
> The Next.js modules `app/lms/lmsAssignment`, `app/lms/lmsAssignment_submission`
> and `app/lms/lmsAnnotate_assignment` are a faithful port of the old Laravel
> **blade** modules (`assignmentController`, `assignmentSubmissionController`,
> `annotateAssignmentController`) that operate on the **`lms_assignment`** table.
> Those modules are session/web routes with **no API layer**, so the frontend
> has nothing to call. This document specifies the `api/lms-assignment/*`
> endpoints the backend team must add so the frontend works end-to-end.
>
> Do **not** confuse this with `api/lms-homework/*` — that is a different feature
> on the `homework` table. This spec targets **`lms_assignment`** only.

## Conventions (match the existing `api/lms-homework/*` controller)

- All routes are `POST` under `routes/api.php` (no auth middleware group is used
  by the existing homework routes; identity is passed as request params:
  `sub_institute_id`, `syear`, `user_id`, `user_profile_name`, `type=API`).
- Success envelope: `{ "status_code": 1, "message": "...", "data": [...] }`.
  Failure: `status_code` `0`/`2` (frontend treats these as errors) or HTTP 4xx.
- JSON list endpoints return the full array under `data` (no pagination; the
  frontend paginates client-side, exactly like homework).
- File fields (`exam_pdf`, `submission_image`) must be returned as **absolute
  URLs** (e.g. `{host}/storage/QuestionPaper/xxx.pdf`,
  `{host}/storage/lms_assignment_submission/xxx.jpg`).
- Multipart endpoints (`store`, `submission-store`) receive `multipart/form-data`.

Suggested controller: `app/Http/Controllers/api/lms/LmsAssignmentApiController.php`,
reusing the query logic already in the three blade controllers and the
`SearchStudent` / `getStudents` helpers.

---

## 1. `POST api/lms-assignment/students`

List selectable students for the create screen (scoped by class).

**Request:** `sub_institute_id`*, `syear`*, `grade` (grade_id), `standard`
(standard_id), `division` (section_id). Reuse `SearchStudent()` /
`tblstudent_enrollment` (end_date NULL) as in `assignmentController::create`.

**Response `data[]`:** `id`, `student_name`, `enrollment_no`, `gender`,
`mobile`, `standard_id`, `standard_name`, `division_id`, `division_name`.

## 2. `POST api/lms-assignment/exam-papers`

Offline question papers for a subject (the assignment's Exam dropdown).

**Request:** `sub_institute_id`*, `syear`, `subject_id`*, `exam_type` (`"offline"`).
Source: `question_paper` where `exam_type='offline'` and `subject_id=?`
(see `assignmentController::create` `$exam_arr`).

**Response `data[]`:** `id`, `paper_name`, `pdf_name`
(= `concat_ws("_", id, sub_institute_id, syear) . ".pdf"`), `total_marks`.

## 3. `POST api/lms-assignment/store` (multipart)

Create the assignment — **one `lms_assignment` row per selected student**
(mirrors `assignmentController::store`).

**Request:** `sub_institute_id`*, `syear`*, `user_id`* (→ `created_by`),
`students`* (CSV of student ids), `title`*, `description`, `submission_date`,
`standard_id`, `division_id`, `subject_id`*, `exam_id`*, `exam_pdf`
(pdf filename; store prefixed as `QuestionPaper/{exam_pdf}`). Per student,
override `standard_id`/`division_id` from the student's enrollment as the old
controller does. Set `created_date=today`, `student_submission_status='N'`,
`teacher_submission_status='N'`, `created_ip`. (Optionally re-send the
`sendNotification()` "LMS Assignment" notification.)

**Response:** `{ status_code:1, message:"Assignment Added successfully",
assignment_ids:[...] }`.

## 4. `POST api/lms-assignment/submission-list`

The signed-in student's assignments (student submission screen).
Scope by `student_id = user_id` when `user_profile_name == "STUDENT"`
(mirrors `assignmentSubmissionController::getData`).

**Request:** `sub_institute_id`*, `syear`*, `user_id`*, `user_profile_name`,
optional `grade`/`standard`/`division`/`subject`/`submission_date`.

**Response `data[]`:** `id`, `subject_name`, `title`, `description`,
`created_date`, `submission_date`, `exam_pdf` (URL), `submission_image` (URL),
`student_submission_status`, `teacher_remarks`, `teacher_submission_status`,
`student_id`, `exam_id`.

## 5. `POST api/lms-assignment/submission-store` (multipart)

Student uploads submitted files (mirrors `assignmentSubmissionController::store`).

**Request:** `sub_institute_id`*, `syear`*, `user_id`*, `students[]` (assignment
row ids), `image[<assignmentId>]` (file per id). Store each to
`storage/app/public/lms_assignment_submission` as
`assignment_{id}-{YmdHis}-{student_id}.{ext}`; update the row
`submission_image`, `student_submitted_date=today`,
`student_submission_status='Y'`, `student_submitted_by=user_id`.
**Fix the old bug:** filter the UPDATE by the **assignment id** only (the blade
had a duplicate `id` key in the `where`).

**Response:** `{ status_code:1, message:"Assignment Submited successfully",
updated:<count> }`.

## 6. `POST api/lms-assignment/review-list`

Teacher list of submissions (mirrors `annotateAssignmentController::getData`).
Join `subject`, `tblstudent`, `standard`. Scope by `sub_institute_id` + `syear`
(+ teacher's allocated classes when `user_profile_name == "Teacher"`).

**Request:** `sub_institute_id`*, `syear`*, `user_id`, `user_profile_name`,
optional `grade`/`standard`/`division`/`subject`/`from_date`/`to_date`/
`teacher_submission_status` (`Y`/`N`).

**Response `data[]`:** `id`, `standard_name`, `student_name`, `subject_name`,
`title`, `created_date`, `submission_date`, `exam_pdf` (URL),
`submission_image` (URL), `student_submission_status`,
`teacher_submission_status`, `student_id`, `exam_id`.

## 7. `POST api/lms-assignment/review-detail`

Backing data for the grading screen (mirrors `annotateAssignmentController::edit`).

**Request:** `sub_institute_id`*, `assignment_id`*.
Load `lms_assignment::find(assignment_id)`, its
`question_paper::find(exam_id)`, and the paper's questions from
`lms_question_master` (ids in `question_ids`).

**Response:**
```json
{
  "status_code": 1,
  "assignment": {
    "id": 0, "student_id": 0, "student_name": "", "title": "",
    "description": "", "submission_image": "<URL>", "teacher_remarks": "",
    "json_annotation": ""
  },
  "paper": { "id": 0, "paper_name": "", "total_marks": 0 },
  "questions": [
    { "id": 0, "question_name": "", "question_type_id": 1, "points": 0 }
  ]
}
```
`question_type_id == 1` is MCQ (frontend renders a toggle worth `points`).

## 8. `POST api/lms-assignment/review-store`

Teacher grading (mirrors `annotateAssignmentController::store`).

**Request:** `sub_institute_id`*, `syear`*, `user_id`* (→ teacher_id),
`hid_assignment_id`*, `hid_student_id`*, `hid_question_paper_id`*,
`questions` (object `{ "<questionId>": <marks> }`), `teacher_remarks`,
`json_annotation` (optional string). Compute `total_right`/`total_wrong`/
`obtain_marks`; INSERT `lms_offline_exam` + per-question `lms_offline_exam_answer`
rows; UPDATE `lms_assignment` `teacher_id`, `teacher_remarks`,
`teacher_submission_date=today`, `teacher_submission_status='Y'`,
`json_annotation`.

**Response:** `{ status_code:1, message:"Assignment Reviewed Successfully",
obtain_marks:<n> }`.

\* = required.

---

## Frontend integration status

| Endpoint | Frontend caller (`app/lms/lmsAssignment/api.ts`) | Page |
| --- | --- | --- |
| `students` | `listAssignmentStudents` | Assignment create |
| `exam-papers` | `listExamPapers` | Assignment create |
| `store` | `createAssignment` | Assignment create |
| `submission-list` | `listMyAssignments` | Assignment Submission |
| `submission-store` | `submitAssignments` | Assignment Submission |
| `review-list` | `listReviewAssignments` | Annotate list |
| `review-detail` | `getReviewDetail` | Review/grade screen |
| `review-store` | `saveReview` | Review/grade screen |

## Known limitations / notes

- **Document annotation (draw/highlight):** the old ERP prototyped marker.js but
  it was **orphaned/non-functional** (route commented out, controller method
  absent). The "no new libraries" constraint rules out adding an annotation
  canvas library, so the frontend exposes `json_annotation` as a plain
  notes field only. A real drawing annotator is out of scope until a library
  decision is made.
- The old modules had **no server-side validation**; the frontend adds
  client-side required-field checks. Backend should add validation (see the
  homework controller's `Validator::make` usage as the pattern).
- The old `store` inserts one row per student and the `title`/`description`
  DB columns are `varchar(50)`; the frontend caps both at 50 chars.

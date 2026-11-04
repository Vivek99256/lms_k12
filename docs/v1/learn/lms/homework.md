# Homework
**Product:** Scholar Learn | **Module:** LMS | **Frontend route:** `/lms/homework` | **v1 status:** Complete

| Field | Value |
|---|---|
| Backend routes | `POST /lms-homework/get-subjects`, `POST /lms-homework/get-chapters`, `POST /lms-homework/list`, `POST /lms-homework/store`, `POST /lms-homework/show/{id}`, `POST /lms-homework/update/{id}`, `POST /lms-homework/delete/{id}`, `POST /lms-homework/bulk-delete`, `POST /lms-homework/students`, `POST /lms-homework/submission-list`, `POST /lms-homework/submission-store`, `POST /lms-homework/submission-report`, `POST /lms-homework/ai-status/{id}`, `POST /lms-homework/review-list`, `POST /lms-homework/review-detail/{id}`, `POST /lms-homework/review-store`, `POST /lms-homework/review-reprocess/{id}` |
| Roles | Teacher (create/review), Student (submit), Admin |
| Last updated | 2026-11-04 |
| Source commit | 8fe500dc (FE) / 86261072 (BE) |

## 1. Purpose & users
Teachers assign homework to students — either from a chapter's question bank, by attaching a file, or from an existing exam paper. Students submit homework (file upload or typed answer). Teachers review submissions with an optional AI evaluation.

## 2. Screens

### Assign Homework — `/lms/homework`
Shows: homework source toggle (Chapter / Attachment / Exam Paper), class filter (SearchDropdown), chapter/question pickers, student scope toggle (class vs. individual), student list.
Main actions: assign homework, attach file, select questions from chapter/exam paper.
![](./screenshots/homework-assign.png)

### Submission Review (teacher)
Shows: submission list with AI evaluation status, review form per submission.
Main actions: grade, comment, reprocess AI evaluation.

### My Homework (student)
Shows: list of assigned homework with due dates, subject, chapter.
Main actions: submit homework.

## 3. Features & business rules

| Field | Type | Required | Validation | Default |
|---|---|---|---|---|
| Source | Toggle: `chapter` / `attachment` / `exam_paper` | Yes | — | `chapter` |
| Section / Standard / Division | Dropdown | Yes | Staff's own classes | — |
| Subject | Dropdown | Yes | Filtered by standard | — |
| Chapter | Dropdown | Conditional (source = chapter) | — | — |
| Question Type | Dropdown | Conditional (source = chapter) | — | — |
| Questions | Multi-select | Conditional | — | — |
| Attachment | File | Conditional (source = attachment) | MIME + size (MAX_UPLOAD_BYTES) | — |
| Exam Paper | Dropdown | Conditional (source = exam_paper) | — | — |
| Student Scope | Toggle: class / individual | Yes | — | class |
| Student list | Multi-select | Conditional (scope = individual) | — | — |
| Due date | Date | No | — | — |

AI evaluation: after a student submits, `POST /lms-homework/ai-status/{id}` polls AI grading status. Teacher can reprocess via `review-reprocess`.

Permission: `RequireStaff` for assign/review. Student submissions gated by `api.session` + student role check.

## 4. User flows

**Teacher assigns homework:**
1. Open `/lms/homework`.
2. Select source (chapter/attachment/exam paper).
3. Pick class → subject → chapter → question type → questions.
4. Toggle student scope (class or select individuals).
5. Submit → `POST /lms-homework/store`.

**Student submits:**
1. Navigate to homework list (student view).
2. Open assignment → `POST /lms-homework/submission/store`.
3. Upload file or type answer.
4. AI evaluation runs in background (`ai-status` endpoint).

**Teacher reviews:**
1. Navigate to review list via `POST /lms-homework/review-list`.
2. Open submission → `POST /lms-homework/review-detail/{id}`.
3. Add grade + comment → `POST /lms-homework/review-store`.
4. Optionally reprocess AI → `POST /lms-homework/review-reprocess/{id}`.

## 5. Data model

| Table | Key columns | Notes |
|---|---|---|
| `lms_homework` | `id`, `sub_institute_id`, `syear`, `standard_id`, `subject_id`, `chapter_id`, `teacher_id`, `source_type`, `due_date`, `created_at` | Main homework record |
| `lms_homework_questions` | `homework_id`, `question_id`, `question_type` | Questions attached |
| `lms_homework_submissions` | `id`, `homework_id`, `student_id`, `submitted_at`, `file_path`, `answer_text`, `ai_grade`, `ai_feedback`, `teacher_grade`, `teacher_comment` | Submissions |
| `chapter_master` | `chapter_id`, `chapter_name` | Chapter lookup |

## 6. APIs

| Method | Endpoint | Auth | Notes |
|---|---|---|---|
| POST | `/lms-homework/store` | JWT | Create homework |
| POST | `/lms-homework/list` | JWT | List homework with filters |
| POST | `/lms-homework/submission-store` | JWT | Student submits (teacher bulk) |
| POST | `/lms-homework/submission/store` | JWT + `api.session` | Student submits own |
| POST | `/lms-homework/ai-status/{id}` | JWT | Poll AI evaluation status |
| POST | `/lms-homework/review-store` | JWT | Teacher grades submission |
| POST | `/lms-homework/review-reprocess/{id}` | JWT | Re-trigger AI evaluation |
| POST | `/lms-homework/question-bank/types` | JWT | Question type options |
| POST | `/lms-homework/question-bank/questions` | JWT | Question list by type/chapter |

## 7. UI components & design tokens
- `AiFieldAssistant` — embedded in homework form
- `SearchDropdown` with `DropdownField[]`
- `StudentScopeToggle` — class vs. individual toggle
- Lucide icons: `CheckCircle2`, `ClipboardList`, `LoaderCircle`, `Paperclip`, `Send`, `Users`, `BookOpen`, `Calendar`, `FileText`, `Layers`, `ChevronDown`, `AlertCircle`, `UsersRound`
- `Table`, `TableBody`, `TableCell`, `TableHead`, `TableHeader`, `TableRow` from `@/components/ui/table`

## 8. Reports & exports
- Submission report: `POST /lms-homework/submission-report` — class-wise submission status.
- See [./reports.md](./reports.md) for the LMS homework report.

## 9. Test cases

| ID | Scenario | Steps | Expected result | Type |
|---|---|---|---|---|
| HW-01 | Assign from chapter | Select chapter source, pick questions, assign | Homework created, appears in student list | Happy |
| HW-02 | Assign by attachment | Select attachment source, upload file, assign | Homework created with file | Happy |
| HW-03 | Student submits | Log in as student, open homework, upload answer | Submission recorded | Happy |
| HW-04 | AI evaluation | Submit; wait; check `/ai-status/{id}` | Grade and feedback appear | Happy |
| HW-05 | Bulk delete | Select multiple homework rows, bulk delete | All removed | Happy |
| HW-06 | File too large | Upload file > MAX_UPLOAD_BYTES | Error: file too large | Negative |
| HW-07 | Student submits after due date | Submit past due date | TBD (no due-date block found in code) | Edge |

## 10. Known issues, limitations & FAQs
- Due date enforcement is not visible in frontend code — the backend may or may not block late submissions; this needs verification.
- AI evaluation polling is fire-and-forget; if the AI call fails silently, teacher sees no grading and no error.

## 11. Sales notes
- **Selling point**: AI-graded homework frees teacher time; every submission gets instant feedback.
- **Demo flow**: (1) Assign homework from question bank; (2) log in as student, submit answer; (3) show AI grade and feedback appearing in review list; (4) teacher adds final comment.
- Plan/pricing: TBD.

## 12. v1 status & v2 ideas
- v1: Complete. All three flows (assign, submit, review + AI) functional.
- v2: Due date enforcement with hard lock; parent notification on submission; homework analytics per chapter.

## Source files
- `C:\rajesh\lms_k12\app\lms\homework\page.tsx`
- `C:\rajesh\lms_k12\app\lms\homework\api.ts`
- `F:\xampp\htdocs\next_lms_erp\app\Http\Controllers\api\lms\StudentHomeworkApiController.php`
- `F:\xampp\htdocs\next_lms_erp\app\Http\Controllers\api\lms\HomeworkSubmissionApiController.php`
- `F:\xampp\htdocs\next_lms_erp\app\Http\Controllers\api\lms\HomeworkQuestionBankApiController.php`
- `F:\xampp\htdocs\next_lms_erp\routes\api.php` (lms-homework/* routes)

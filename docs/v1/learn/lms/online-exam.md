# Online Exam
**Product:** Scholar Learn | **Module:** LMS | **Frontend route:** `/lms/exam` · `/lms/exam/evaluation/[batchId]/[sheetId]` | **v1 status:** Complete

| Field | Value |
|---|---|
| Backend routes | `POST /lms-result-dashboard/summary`, question paper CRUD, exam evaluation routes (TBD — via `lmsexamController` and `onlineExamController`) |
| Roles | Teacher (create exam, evaluate), Student (take exam), Admin |
| Last updated | 2026-11-04 |
| Source commit | 8fe500dc (FE) / 86261072 (BE) |

## 1. Purpose & users
The LMS Online Exam screen handles both teacher and student perspectives via an `AudienceMode` toggle. Teachers create question papers, set exam parameters, and evaluate submissions. Students take online exams (MCQ + typed) and view their scores. Integrates with PAL — the student view includes a "PAL" tab alongside "Online Exam" and "Offline Exam" tabs.

## 2. Screens

### Exam main — `/lms/exam`
Shows: Audience toggle (Teacher / Student), question paper grid, exam type selector, result dashboard, assessment blueprints, question paper templates.
Main actions: create question paper, evaluate submissions, view result dashboard, generate assessment blueprint, print question paper.
![](./screenshots/online-exam.png)

### Exam Evaluation — `/lms/exam/evaluation/[batchId]/[sheetId]`
Shows: student answer sheet PDF pane, question panel with mark fields, review header, totals bar.
Main actions: enter marks per question, confirm, submit evaluation.
![](./screenshots/exam-evaluation.png)

## 3. Features & business rules

**Audience mode (teacher view):**
- Question paper grid with columns from `ALL_QUESTION_PAPER_COLUMNS`; exam type filtering via `examTypeOptions`
- Assessment blueprint creation and editing (`BlueprintEditor`, `HpcBlueprintEditor`)
- Question paper template selection and PDF export (`useExamPaperPdf`)

**Student learning tabs:**
- `PAL` | `Online Exam` | `Offline Exam` — tab-based interface

**Exam evaluation:**
- `SheetPdfPane` — renders uploaded answer sheet
- `QuestionPanel` — per-question mark entry
- `TotalsBar` — running total
- `ReviewHeader` — batch/sheet navigation

**AI integration:** `AiFieldAssistant` on question creation fields; `Sparkles` icon triggers AI question generation.

| Field | Type | Required | Notes |
|---|---|---|---|
| Exam type | Dropdown | Yes | `examTypeOptions` list |
| Question paper | Selector | Yes | From grid |
| Batch | Route param | Yes | For evaluation route |
| Sheet | Route param | Yes | For evaluation route |

## 4. User flows

**Teacher creates exam:**
1. Toggle to Teacher mode.
2. Select exam type, pick question paper.
3. Generate/print paper → `useExamPaperPdf`.

**Teacher evaluates:**
1. Navigate to evaluation list.
2. Click student row → opens `/lms/exam/evaluation/[batchId]/[sheetId]`.
3. Enter marks per question → submit.

**Student takes exam:**
1. Toggle to Student mode (or student login).
2. See PAL / Online / Offline tabs.
3. Select Online Exam tab → attempt.

## 5. Data model

| Table | Key columns | Notes |
|---|---|---|
| `lms_online_exam` | `id`, `sub_institute_id`, `syear`, `standard_id`, `subject_id`, `exam_type`, `question_paper_id`, `start_time`, `end_time` | Exam record |
| `lms_question_mapping` | `exam_id`, `question_id`, `marks`, `order` | Question-exam mapping |
| `exam_evaluation` | `id`, `exam_id`, `student_id`, `batch_id`, `sheet_id`, `marks_json`, `total`, `evaluated_by` | Evaluation results |
| `assessment_blueprint` | `id`, `exam_id`, `chapter_id`, `question_type`, `count`, `marks` | Blueprint rows |

## 6. APIs

| Method | Endpoint | Auth | Notes |
|---|---|---|---|
| POST | `/lms-result-dashboard/summary` | JWT + `api.session` | Cached 60s; returns result KPIs |
| POST | (TBD) | JWT | Question paper CRUD via `lmsexamController` |
| POST | (TBD) | JWT | Evaluation store via evaluation controller |

## 7. UI components & design tokens
- `ExamResultDashboard`, `AssessmentBlueprints`, `ExamEvaluation`, `QuestionPaperTemplates` — sub-components of exam page
- `QuestionPaperGrid`, `useQuestionPaperRows` — shared question paper grid
- `QuestionPaperTemplateSelect`, `useExamPaperPdf` — PDF generation
- `QuestionPanel`, `ReviewHeader`, `SheetPdfPane`, `TotalsBar` — evaluation sub-components
- `AiFieldAssistant` — AI question generation
- `RadioGroup`, `RadioGroupItem` — MCQ answer UI
- Lucide icons: `Award`, `ArrowLeft`, `ArrowRight`, `Check`, `CheckCircle2`, `Clock3`, `FileText`, `GraduationCap`, `Lock`, `Monitor`, `Play`, `Printer`, `ScanLine`, `Send`, `Sparkles`

## 8. Reports & exports
- Result dashboard (`ExamResultDashboard`) — in-page report.
- Question paper PDF export.
- See [./reports.md](./reports.md).

## 9. Test cases

| ID | Scenario | Steps | Expected result | Type |
|---|---|---|---|---|
| OE-01 | Teacher creates paper | Select exam type, pick questions, print | PDF generated | Happy |
| OE-02 | Student takes exam | Log in as student, open Online Exam tab, attempt | Answers recorded | Happy |
| OE-03 | Teacher evaluates | Open evaluation sheet, enter marks, submit | Results saved | Happy |
| OE-04 | Assessment blueprint | Create blueprint for chapter, preview | Blueprint table shows distribution | Happy |
| OE-05 | Result dashboard | After evaluation, open result dashboard | Summary KPIs show | Happy |

## 10. Known issues, limitations & FAQs
- Evaluation backend routes are not fully listed in api.php snippet — exact endpoints TBD from `lmsexamController.php` and `onlineExamController.php`.
- `AudienceMode` toggle state is local — switching modes re-renders the whole page.

## 11. Sales notes
- **Selling point**: end-to-end online exam — create, conduct, evaluate, and generate result reports without leaving the system.
- **Demo flow**: (1) Teacher creates MCQ paper; (2) student takes online exam; (3) teacher evaluates offline paper with digital sheet; (4) show result dashboard with class performance.
- Plan/pricing: TBD.

## 12. v1 status & v2 ideas
- v1: Complete. Create, evaluate, PDF, result dashboard, assessment blueprint all functional.
- v2: Timed online exam with auto-submit; AI-suggested question papers from chapter concepts; parent-visible result cards.

## Source files
- `C:\rajesh\lms_k12\app\lms\exam\page.tsx`
- `C:\rajesh\lms_k12\app\lms\exam\evaluation\[batchId]\[sheetId]\page.tsx`
- `C:\rajesh\lms_k12\app\lms\exam\_assessment-blueprint\`
- `C:\rajesh\lms_k12\app\lms\exam\_exam-evaluation\`
- `C:\rajesh\lms_k12\app\lms\exam\_result-dashboard\`
- `C:\rajesh\lms_k12\app\lms\exam\_question-paper-templates\`
- `F:\xampp\htdocs\next_lms_erp\app\Http\Controllers\lms\lmsexamController.php`
- `F:\xampp\htdocs\next_lms_erp\app\Http\Controllers\lms\onlineExamController.php`

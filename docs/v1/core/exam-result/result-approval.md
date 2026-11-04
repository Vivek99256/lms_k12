# Result Approval (Marks Approval Report)
**Product:** Scholar Core | **Module:** Exam / Result | **Frontend route:** `/result/reports/marks-approval` | **v1 status:** Complete

| Field | Value |
|---|---|
| Backend routes | POST result/getMarksApproval |
| Roles | Admin, Exam Coordinator, Principal |
| Last updated | 2026-11-04 |
| Source commit | 8fe500dc (FE) / 86261072 (BE) |

## 1. Purpose & users
Shows which scholastic exam/subject marks and co-scholastic entries have been approved (locked) or are pending approval. Renders as two matrices: a scholastic grid (exams x subjects) and a co-scholastic list. Used by exam coordinators and principals to track approval status before report card generation.

## 2. Screens

### Marks Approval Report
Route: `/result/reports/marks-approval`

**Filter bar (all required):** Term, Section, Standard, Division, Subject, Exam.

**Scholastic approvals panel:** Matrix table — exam rows x subject columns. Each cell shows exam title + Approved/Pending badge.

**Co-scholastic approvals panel:** Two-column list — Exam type, Co-scholastic title + Approved/Pending badge.

Legend: Approved (green) = marks locked; Pending (amber) = awaiting approval.

![](./screenshots/result-approval.png)

## 3. Features & business rules

- Scholastic payload: flexible shape — tries keys: scholastic, scholastic_data, scholastic_marks, marks_data, exam_data, approval_data. Falls back to treating the whole payload as a matrix.
- Co-scholastic payload: flexible — tries keys: co_scholastic, coscholastic, co_scholastic_data, etc. Handles both array and Record<examType, items[]> shapes.
- Approval status detection: checks multiple field names (approved, is_approved, approve, status, approval_status) and values (1, true, yes, approved, approve) for maximum compatibility with varying API responses.
- Read-only view — approval action is performed in Marks Entry screen.

**Permissions:** View only. Admin, Exam Coordinator, Principal.

## 4. User flows

1. Result -> Reports -> Marks approval report.
2. Select Term / Section / Standard / Division / Subject / Exam -> Search.
3. Scholastic and co-scholastic tables load.
4. Review Approved/Pending status per exam and subject.
5. For any Pending, go to Mark entry and approve.

## 5. Data model

| Table | Key columns | Notes |
|---|---|---|
| result_exam_approve | id, exam_id, subject_id, standard_id, division_id, term_id, status (0/1), sub_institute_id | Scholastic approval state |
| result_co_scholastic | id, exam_type, title, is_approved, standard_id, sub_institute_id | Co-scholastic entries |
| result_exam_master | id, exam_title, standard_id, term_id | Exam reference |

## 6. APIs

| Method | Endpoint | Auth | Request | Response |
|---|---|---|---|---|
| POST | result/getMarksApproval | JWT | term_id, section_id, standard_id, division_id, subject_id, exam_id | { scholastic: matrix, co_scholastic: list } |

Also uses filter dropdowns:
- api/get-subject-list, api/get-exam-list

Controller: approve_mobile_result_controller.php (inferred), result_report_controller.php

## 7. UI components & design tokens
- FilterBar, Banner, EmptyState, TableSkeleton, StatusChip (tone: success / warning)
- Lucide: CheckSquare, ClipboardList, Table2

## 8. Reports & exports
No export from this screen. Data is view-only on-screen.

## 9. Test cases

| ID | Scenario | Steps | Expected result | Type |
|---|---|---|---|---|
| RA-01 | View fully approved | Filters for a fully approved exam | All cells show Approved (green) | Happy |
| RA-02 | View partially approved | Mixed exam | Some Approved, some Pending | Happy |
| RA-03 | No data returned | Filters for exam with no marks | Empty state in both panels | Edge |
| RA-04 | Unusual payload shape | API returns matrix at root key | Fallback parsing handles it | Edge |

## 10. Known issues, limitations & FAQs
- Payload shapes from API vary; defensive multi-key parsing is used throughout.
- No export / print from this report.
- FAQ: What does Pending mean? The teacher has not yet clicked Approve in Marks entry for that subject/exam.

## 11. Sales notes
- Gives principals a single-screen approval status overview before report card generation.
- Demo: show a partially approved exam cycle with mixed green/amber badges.

## 12. v1 status & v2 ideas
- v1: Complete. Defensive parsing handles multiple payload shapes.
- v2: Export to Excel; email approval summary to principal; direct approve action from this screen.

## Source files
- C:\rajesh\lms_k12\app\result\reports\marks-approval\page.tsx
- C:\rajesh\lms_k12\lib\result\api.ts
- F:\xampp\htdocs\next_lms_erp\app\Http\Controllers\result\approve_mobile_result_controller.php
- F:\xampp\htdocs\next_lms_erp\app\Models\result\co_scholastic_marks_entry.php

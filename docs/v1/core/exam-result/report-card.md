# Report Card
**Product:** Scholar Core | **Module:** Exam / Result | **Frontend route:** `/result/report-card` | **v1 status:** Complete

| Field | Value |
|---|---|
| Backend routes | `GET api/result/student-result`, `GET api/result/student-result/create`, `POST api/result/student-result`, `POST api/result/student-result/save-html` |
| Roles | Admin, Class Teacher, Exam Coordinator |
| Last updated | 2026-11-04 |
| Source commit | 8fe500dc (FE) / 86261072 (BE) |

## 1. Purpose & users
Generates printable HTML report cards for selected students using configured result templates. Supports paper printing and mobile-app delivery. Used at the end of each term or year by admin and class teachers.

## 2. Screens

### New Report Card
Route: `/result/report-card`

**Filter bar:** Result template (required), Result format — terms + "Yearly" (required), Result type e.g. Regular/HPC (required), Section/Standard/Division (optional narrowing).

After search: student list table with checkbox selection. Actions: **Generate report cards**, **Print paper**, **Print mobile**. External link: "View saved results".

Board-specific sub-routes: `/result/report-card/cbse-11`, `/result/report-card/cbse-1t5`, `/result/report-card/cbse-t2`, `/result/report-card/cnse-11`.

![](./screenshots/report-card.png)

## 3. Features & business rules

| Field | Type | Required | Validation | Default |
|---|---|---|---|---|
| Result template | select | Yes | From result_template_master | — |
| Result format | select | Yes | Terms + "Yearly" | — |
| Result type | select | Yes | String values from result_types array | — |
| Section / Standard / Division | select | No | Optional filter | — |
| Student selection | checkbox | Yes (at generate) | >= 1 selected | — |

**Key rules:**
- Template list is at `payload.data.data` (double-nested); `result_types` is a flat string array — not id/label rows; both are API inconsistencies documented in source comments.
- Generated HTML is sanitized with isomorphic-dompurify (`{ document: true }`) before dangerouslySetInnerHTML.
- "Print mobile" saves per-student HTML to backend (`api/result/student-result/save-html`) for mobile app delivery.
- Board-specific variants (CBSE) have dedicated sub-route pages.

**Permissions:** Admin and Class Teacher can generate and print. Only Admin can save to mobile.

## 4. User flows

**Happy path:**
1. Result -> Reports -> New report card.
2. Select template + format + result type -> Search.
3. Check students (or select all) -> Generate report cards.
4. HTML renders inline -> Print paper (browser print) or Print mobile (backend save).

## 5. Data model

| Table | Key columns | Notes |
|---|---|---|
| result_template_master | id, module_name, title, html_content, user_created, sub_institute_id | HTML templates with placeholder tags |
| result_html | id, student_id, term_id, html, result_type, sub_institute_id | Saved report card HTML per student |
| tblstudent | id, student_name, roll_no, enrollment_no, gr_number | Student reference |

## 6. APIs

| Method | Endpoint | Auth | Request | Response |
|---|---|---|---|---|
| GET | api/result/student-result | JWT | — | { data: { data: Template[], result_types: string[] } } |
| GET | api/result/student-result/create | JWT | filter params | { data: { student_data: StudentRow[] } } |
| POST | api/result/student-result | JWT | template_id, format, grade_id, standard_id, division_id, result_type, students[] | { data: { html, all_stud_html } } |
| POST | api/result/student-result/save-html | JWT | term_id, student_arr, html_{studentId} | { success, message } |
| GET | api/result/result-template/tags | JWT | — | Default placeholder tags |

Controller: studentResultController.php, templateController.php

## 7. UI components & design tokens
- FilterBar, Checkbox (per-student + select-all), Banner, EmptyState, Skeleton, TableSkeleton
- printElement() — components/result/print
- sanitizeHtml() — lib/security/sanitize-html
- Lucide: FileText, Printer, Smartphone, Users, Loader2, ExternalLink

## 8. Reports & exports
- Paper print: browser print of generated HTML
- Mobile delivery: POST api/result/student-result/save-html
- Saved results list: GET api/result/all-results

## 9. Test cases

| ID | Scenario | Steps | Expected result | Type |
|---|---|---|---|---|
| RC-01 | Generate for one student | Select 1 student -> Generate | HTML renders; print buttons active | Happy |
| RC-02 | Generate for all students | Select all -> Generate | All report cards in one HTML block | Happy |
| RC-03 | Print mobile | Generate -> Print mobile | Success toast; saved to backend | Happy |
| RC-04 | No students found | Empty division filters | Empty state shown | Edge |
| RC-05 | Template list fails | Mock API error on mount | Banner error; filters disabled | Negative |
| RC-06 | Generate with 0 selected | Click Generate without selecting | Toast "Select at least one student" | Negative |
| RC-07 | HTML with scripts | Server returns HTML with script tag | DOMPurify strips scripts | Security |

## 10. Known issues, limitations & FAQs
- Template list at double-nested payload.data.data — not payload.data.result_template_master.
- result_types is a flat string array — toOptions() does not handle it; mapped manually in source.
- No per-student PDF download (browser print only).
- FAQ: Report card is blank — template html_content has wrong placeholder tags. Use "View default tags" button.
- FAQ: Print mobile does nothing — mobile app must call api/result/all-results to retrieve saved HTML.

## 11. Sales notes
- Any report card design (CBSE, ICSE, custom) stored as an HTML template and generated in one click. Instant paper + mobile delivery.
- Demo: Show branded template -> pick class -> Generate -> Print.
- Pricing: TBD (included in Scholar Core).

## 12. v1 status & v2 ideas
- v1: Complete. Board variants (CBSE) available. Mobile save works.
- v2: PDF download per student; email report cards; template version history.

## Source files
- C:\rajesh\lms_k12\app\result\report-card\page.tsx
- C:\rajesh\lms_k12\app\result\report-card\cbse-11\page.tsx, cbse-1t5\page.tsx, cbse-t2\page.tsx
- C:\rajesh\lms_k12\lib\result\api.ts
- F:\xampp\htdocs\next_lms_erp\app\Http\Controllers\result\studentResultController.php
- F:\xampp\htdocs\next_lms_erp\app\Http\Controllers\result\templateController.php
- F:\xampp\htdocs\next_lms_erp\app\Models\result\result_template.php, result_html_model.php
- Migration: 2023_09_08_145910_create_result_template_master_table.php

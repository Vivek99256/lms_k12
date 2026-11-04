# Learning Outcome
**Product:** Scholar Core | **Module:** Exam / Result | **Frontend route:** `/learning-outcome/*` | **v1 status:** Partial (migration module)

| Field | Value |
|---|---|
| Backend routes | TBD (via migration-modules proxy) |
| Roles | Admin, Teacher |
| Last updated | 2026-11-04 |
| Source commit | 8fe500dc (FE) / 86261072 (BE) |

## 1. Purpose & users
Manages learning outcome masters, indicator mappings, and outcome reports. Allows schools to map curriculum chapters and subjects to learning outcomes and track attainment per student. Used by subject teachers and academic coordinators.

## 2. Screens

### LO Master
Route: `/learning-outcome/lo-master`
Renders via `MigrationModulePage` with module key `learning-outcomes`. Actual UI is served from the legacy backend blade/migration module system.

### Indicator Mapping
Route: `/learning-outcome/indicator-mapping`
Renders via `MigrationModulePage` with module key `indicator-mappings`.

### Reports
Route: `/learning-outcome/reports`
TBD — specific report page.

![](./screenshots/learning-outcome.png)

## 3. Features & business rules

Both `/lo-master` and `/indicator-mapping` pages delegate to `MigrationModulePage` — a wrapper that loads the legacy module UI via the backend migration-modules system. Full field-level details are in the backend blade views.

From migrations:
- Exam type master for learning outcomes
- Indicator table (per learning outcome)
- PDF generation
- Question master linked to learning outcomes
- Student marks per learning outcome

**Permissions:** Admin can configure LO masters and indicators. Teachers can view reports.

## 4. User flows

**Configure:**
1. Learning Outcome -> LO Master -> add outcome linked to subject/chapter.
2. Learning Outcome -> Indicator Mapping -> map indicators to outcomes.

**View attainment:**
1. Learning Outcome -> Reports -> filter by class/subject -> view.

## 5. Data model

| Table | Key columns | Notes |
|---|---|---|
| learning_outcome_exam_type_master | id, exam_type_name, sub_institute_id | Exam types for LO |
| learning_outcome_indicator | id, lo_id, indicator_name, sub_institute_id | Indicators per outcome |
| learning_outcome_pdf | id, lo_id, pdf_path, sub_institute_id | Generated PDFs |
| learning_outcome_question_master | id, lo_id, question, marks, sub_institute_id | Questions per outcome |
| learning_outcome_student_marks | id, student_id, lo_id, question_id, marks, sub_institute_id | Student attainment |

## 6. APIs
TBD — pages use the migration-modules proxy. Backend routes are in the legacy web.php routing for migration modules.

## 7. UI components & design tokens
- MigrationModulePage — app/migration-modules/MigrationModulePage.tsx (legacy module wrapper)

## 8. Reports & exports
- Learning Outcome Reports: `/learning-outcome/reports`
- PDF generation available via learning_outcome_pdf table.

## 9. Test cases

| ID | Scenario | Steps | Expected result | Type |
|---|---|---|---|---|
| LO-01 | Add LO master | LO Master -> Add -> Enter name | Outcome saved | Happy |
| LO-02 | Map indicator | Indicator Mapping -> link indicator to outcome | Mapping saved | Happy |
| LO-03 | View report | Reports -> filter class | Student attainment data shown | Happy |

## 10. Known issues, limitations & FAQs
- Pages use MigrationModulePage — a legacy wrapper. Full UI behavior is from backend blade views, not the Next.js design system.
- TBD: Exact API endpoints not visible from the Next.js page.tsx files.
- FAQ: What is a "Learning Outcome"? A specific measurable skill or knowledge statement a student should attain after a chapter/unit.

## 11. Sales notes
- Supports NEP 2020 outcome-based education requirements.
- Tracks student attainment against each defined learning outcome.

## 12. v1 status & v2 ideas
- v1: Partial — functional via legacy module wrapper; not migrated to new UI.
- v2: Migrate to new React UI; integrate with PAL mastery data; auto-report from exam marks.

## Source files
- C:\rajesh\lms_k12\app\learning-outcome\lo-master\page.tsx
- C:\rajesh\lms_k12\app\learning-outcome\indicator-mapping\page.tsx
- C:\rajesh\lms_k12\app\learning-outcome\reports\page.tsx
- C:\rajesh\lms_k12\app\migration-modules\MigrationModulePage.tsx
- Migrations: 2023_03_05_*_create_learning_outcome_*.php files

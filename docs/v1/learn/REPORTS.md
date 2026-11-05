# Scholar Learn — Reports Catalog

Last updated: 2026-11-03
Generated from commit: `8fe500dc` (frontend) / `86261072` (backend)

> Catalog of all reports in Scholar Learn (LMS + PAL). Each row is a report; detailed docs are written per report.

---

## LMS Reports

| Report Name | Module/Menu | Frontend Route | Roles | Key Filters | Export | Data Source |
|---|---|---|---|---|---|---|
| Homework Report | LMS → Homework | `/lms/homework/*` | Teacher, Admin | Class, Subject, Date range | Excel | `lms_homework` |
| Assignment Report | LMS → Assignment | `/lms/lmsAssignment` | Teacher, Admin | Class, Subject, Status | Excel | `lms_assignment` |
| Online Exam Report | LMS → Online Exam | `/lms/exam` | Teacher, Admin | Exam, Class, Subject | Excel, PDF | `lms_online_exam` |
| Question-wise Report | LMS → Reports | `/lms/question-wise-report` | Teacher, Admin | Exam, Question | Excel | `lms_question_mapping` |
| Student Analysis | LMS → Reports | `/lms/student-analysis/[studentId]` | Teacher, Admin, Parent | Student, Subject, Term | On-screen | `lms_student_engagement` |
| Curriculum Coverage | LMS → Reports | `/lms/reports` | Teacher, Admin | Class, Subject, Month | Excel | `lms_curriculum`, `lms_syllabus` |
| Leaderboard Report | LMS → Leaderboard | `/lms/leader-board` | Teacher, Admin, Student | Class, Term | On-screen | `lms_student_engagement` |
| Activity Stream | LMS → Activity | `/lms/activity-stream` | Teacher, Admin | Date range, Class | On-screen | `lms_student_engagement` |
| Portfolio Report | LMS → Portfolio | `/lms/portfolio` | Teacher, Student | Student, Term | On-screen | `lms_portfolio` |
| Teacher Diary Report | LMS → Teacher Diary | `/lms/teacher-diary` | Admin, Principal | Teacher, Date range | Excel | `lms_lesson_plan` |
| Syllabus Completion | LMS → Monthly Plan | `/lms/monthly-plan` | Admin, Principal, Teacher | Class, Subject, Month | Excel | `lms_syllabus`, `lms_units` |

---

## PAL Reports

| Report Name | Module/Menu | Frontend Route | Roles | Key Filters | Export | Data Source |
|---|---|---|---|---|---|---|
| PAL Activity Report | PAL → Reports | `/pal/reports/activity` | Teacher, Admin | Class, Chapter, Date range | Excel | `pal_*`, `learner_node_state` |
| PAL Attainment Report | PAL → Reports | `/pal/reports/attainment` | Teacher, Admin, Principal | Class, Standard, Term | Excel, PDF | `pal_concept_mastery_log` |
| Class Activity Report | PAL → Reports | `/pal/reports/class-activity` | Teacher, Admin | Class, Date | Excel | `lms_concept_mastery_log` |
| PAL Mastery Report | PAL → Mastery | `/pal/mastery/chapter/[chapterId]` | Teacher, Student | Chapter, Concept | On-screen | `learner_node_state` |
| PAL Result | PAL → Result | `/pal/result` | Teacher, Admin, Student | Student, Term | On-screen, PDF | `pal_*` |
| PAL Recall Report | PAL → Recall | `/pal/recall` | Teacher, Student | Chapter, Date | On-screen | `pal_recommendation_log` |
| PAL Report (general) | PAL → Report | `/pal/report` | Teacher, Admin | TBD | TBD | TBD |
| Pilot Enrollment Report | PAL → Administration | `/pal/new/administration/[subsystem]` | Admin | Pilot group, Date | Excel | `pal_pilot_enrollments` |
| Gamification Report | PAL → Gamification | `/pal/new/gamification/*` | Teacher, Admin | Class, Badge type | On-screen | `pal_gamification` |

---

## Assessment / Quiz Reports

| Report Name | Module/Menu | Frontend Route | Roles | Key Filters | Export | Data Source |
|---|---|---|---|---|---|---|
| Quiz Attempts Report | LMS → Quiz | `/quiz/*` | Teacher, Admin | Quiz, Class, Date | Excel | `lms_quiz_attempts` |
| Assessment Blueprint Report | Exam | TBD | Teacher, Admin | Subject, Chapter | PDF | `assessment_blueprint` |
| Question Bank Summary | H5P → Question Bank | `/h5p/question-bank-library` | Teacher, Admin | Subject, Difficulty | On-screen | `lms_content_category` |

---

## Learning Outcome Reports

| Report Name | Module/Menu | Frontend Route | Roles | Key Filters | Export | Data Source |
|---|---|---|---|---|---|---|
| Learning Outcome Marks | Learning Outcome | `/learning-outcome/*` | Teacher, Admin | Subject, Chapter, Exam type | Excel, PDF | `learning_outcome_student_marks` |
| Learning Outcome PDF | Learning Outcome | `/learning-outcome/*` | Admin, Teacher | Standard, Subject | PDF | `learning_outcome_pdf` |
| Indicator-wise Report | Learning Outcome | `/learning-outcome/*` | Teacher, Admin | Indicator, Class | Excel | `learning_outcome_indicator` |

---

> Detailed docs: `docs/v1/learn/reports/<report-name>.md`

---

## Source files

- Frontend routes: `C:\rajesh\lms_k12\app\lms\**\page.tsx`, `C:\rajesh\lms_k12\app\pal\**\page.tsx`
- Backend controllers: `F:\xampp\htdocs\next_lms_erp\app\Http\Controllers\lms\`
- Backend models: `F:\xampp\htdocs\next_lms_erp\app\Models\lms\`, `F:\xampp\htdocs\next_lms_erp\app\Models\PAL\`

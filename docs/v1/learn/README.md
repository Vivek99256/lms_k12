# Scholar Learn — Product Overview

Last updated: 2026-11-04  
**Product:** Scholar Learn  
**Scope:** Modern Learning Management System (LMS) & Personalized Adaptive Learning (PAL)

---

## 1. Executive Summary

**Scholar Learn** empowers digital pedagogy across K-12 classrooms. It merges mainstream curriculum delivery with cutting-edge **Personalized Adaptive Learning (PAL)**, interactive **H5P content types**, assignment management, and mastery analytics.

Scholar Learn enables educators to design blended learning journeys that adapt dynamically to each student's learning pace.

---

## 2. Key Modules & Sub-systems

| Module | Purpose | Key Routes | Key Entities & Technologies |
|---|---|---|---|
| **Curriculum & Lesson Planning** | Syllabus planning, chapter breakdowns, teaching milestones, and learning outcome alignments. | `/lms/syllabus-plan`, `/course-master/lesson-plan` | `tbl_lesson_plan`, `syllabus_milestones` |
| **Interactive Content (H5P)** | Rich interactive exercises: Drag-and-drop, interactive video, branch scenarios, flashcards, and quizzes. | `/h5p/content-types`, `/h5p/question-bank-library` | `h5p_contents`, `h5p_libraries` |
| **Adaptive Learning (PAL)** | Knowledge graph coherence maps, mastery tracking, prerequisite diagnostics, and automated remediation recommendations. | `/pal/dashboard`, `/pal/mastery-tracking`, `/pal/coherence-map` | `pal_student_node_mastery`, `concept_graph` |
| **Assignments & Assessments** | Homework submission, peer collaboration, online proctored exams, rubrics, and automated grading. | `/lms/assignment`, `/lms/homework`, `/lms/online-exam` | `tbl_assignment`, `tbl_submission`, `exam_attempts` |
| **Student Engagement** | Gamification engine, achievement badges, leaderboards, and collaborative learning discussion boards. | `/lms/leaderboard`, `/lms/portfolio`, `/lms/social-collaborative` | `gamification_badges`, `student_points_ledger` |

---

## 3. The PAL Pedagogy Engine

The core differentiator of Scholar Learn is its **Pedagogy Engine**:
1. **Diagnostic Assessment**: Determines the baseline competency of learners against topic standards.
2. **Coherence Graph Mapping**: Navigates non-linear concept prerequisite trees.
3. **Adaptive Interventions**: Automatically assigns micro-lessons, interactive simulations, or teacher-guided interventions when learning plateaus occur.
4. **Mastery Verification**: Re-evaluates retention over spaced intervals.

---

## 4. Integration with Core ERP

- Synchronizes course enrollments automatically from **Scholar Core** student and class teacher mappings.
- Posts assignment and assessment grades directly into Core's grade book and report cards.


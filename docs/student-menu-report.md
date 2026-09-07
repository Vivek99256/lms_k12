# Which Menus Should Be Visible to Students

**Date:** 2026-08-27
**Scope:** Student-facing navigation in Teach Connect LMS (Next.js frontend).

---

## How the sidebar actually works (read this first)

The sidebar menu is **fully dynamic and role-scoped**. There is no static "student
menu list" anywhere in the frontend. The flow is:

1. `AuthContext` writes a session (`menuContext` / `userData`) to browser storage,
   including the free-text field **`user_profile_name`**.
2. `hooks/useMenuRights.ts` POSTs that session to the backend endpoint
   `/api/menu-rights` and gets back three levels of menu rows.
3. `data/menuMappers.ts` (`buildMenuTree`) turns those rows into the tree the
   `Sidebar` renders — **only rows the backend already filtered for that user**.

So "what students can see" is decided **server-side per tenant** by the
`menu-rights` grants bound to the `student` profile. The frontend role checks
all normalise the same way: `user_profile_name → 'student'`

- `app/pal/data/pal-lookups.ts` → `isStudentSession()`
- `app/exam/data/onlineExam.ts` → `isStudentProfile()`
- `app/lms/exam/page.tsx` → `audienceMode`
- `app/course-master/page.tsx` → `effectiveAudienceMode`
- `app/dashboard/_lib/resolveDashboardRole.ts` → `DashboardRole = 'student'`

### What this report contributes

The rights grid is configured by each school, so this report can't enumerate the
exact tenant grants. What it *can* do — and does below — is:

1. List the **screens engineered to be student-facing** (the app itself branches
   on the student role, so any of these mounted for a student is supported).
2. List the **screens that are staff-gated** (`RequireStaff` / admin-only) and
   therefore should **not** appear for students.
3. Give a recommended **default student menu** derived from #1, which a tenant
   can use as the baseline grant for the `student` profile.

---

## 1. Screens engineered *for* students (safe to grant)

These pages either render a dedicated student view when the signed-in user is a
student, or have no staff-only guard at all.

### Dashboard

| Menu / route | What the student sees |
|---|---|
| **Home / Dashboard** `/dashboard` | `StudentDashboard`: enrolled-subject count, pending homework, pending assignments, task bar chart, my subjects, recent circulars (achievements pending). Selected via `resolveDashboardRole`. |
| **Main dashboard → Students** `/students/dashboard` | Module landing snapshot (this is the "Students" module landing). |

### LMS (Learning Management)

| Menu / route | What the student sees |
|---|---|
| **LMS Dashboard** `/lms/dashboard` | Student **self-view**: loads the signed-in student's own dashboard automatically (no class/student picker). |
| **Homework list** (via dashboard + `lmsAssignment_submission`) | Student receives assigned homework; the *authoring* screen (`app/lms/homework`) is staff-only, but the student-facing submission flow lives in Assignments (below). |
| **Assignments → Submission** `/lms/lmsAssignment_submission` | Student-facing **submission page** (no `RequireStaff`): lists their assignments, attach + submit. |
| **Test / Exam hub** `/lms/exam` | Follows the profile: students get the **Online exam / Offline exam** student tabs (PAL tab is deliberately hidden). The `menuMappers` rename maps the LMS "Student Homework" link here. |
| **Leader Board** `/lms/leader-board` | Class leaderboard (no staff guard). |

### Exam

| Menu / route | What the student sees |
|---|---|
| **Exam → Online Exam** `/exam/online` | Lists online exams to attempt / review results (DOK & Bloom breakdown). Attempt player at `/exam/online/[paperId]`. |

### PAL (Adaptive / personalised learning)

| Menu / route | What the student sees |
|---|---|
| **PAL** `/pal` | Student **self-view**: subject → chapter accordion, start-quiz / diagnostic / practice per chapter. Staff get a picker; students load their own. |
| **PAL → Exam** `/pal/exam` | Adaptive quiz player (timed, per-question). Student-native. |
| **PAL → Result** `/pal/result` | Score + per-concept mastery breakdown; retake. Student-native. |
| **PAL → Intelligence** `/pal/intelligence` | Student's own mastery, risk cards, misconception + remediation modals. |
| **PAL Frameworks** `/pal/frameworks`, **ULU** `/pal/ulu` (+ detail views) | Content/framework module grids for the current chapter (shared). |
| **PAL → Gamification** `/pal/new/gamification` | Student self progress: mastery map, streak, badges, personal bests. |
| … `gamification/career-quest`, `challenge-mode`, `session-summary` | Student-native gamification experiences (peer leaderboard is opt-in only). |
| … `gamification/team-challenges` | Shared: student sees aggregate + own contribution. |

### H5P (practice content)

| Menu / route | What the student sees |
|---|---|
| **H5P hub** `/h5p/html_contents` | Content-type hub (shared). |
| H5P players: `/h5p/h5p_mcq`, `/h5p/h5p_flashacard/[id]`, `/h5p/h5p_interactive_video/[id]`, `/h5p/scenario_based/[id]` | Student players (flashcard, MCQ, video, scenario). Emit real xAPI telemetry. |

### Learning content (demo / practice)

| Menu / route | What the student sees |
|---|---|
| **Course Master** `/course-master` | Branch: students get the **Learn / Test** student view. |
| **Chapters** `/chapters` | Chapter lesson viewer (static/demo data). No staff guard. |
| **Quiz** `/quiz`, `/quiz/take`, `/quiz/create` | Adaptive-quiz experience (demo data; authoring screens are currently hardcoded). |

> **Note** — `app/student/` and `app/students/` are the **admin's student-management
> module** (add student, IC cards, health, discipline, reports, etc.). These are
> **staff/admin** screens, not the student's own portal — do not grant them to the
> student role. The student's own "portal" is the Dashboard + LMS/PAL/Exam suite above.

---

## 2. Screens that are staff/teacher/admin-gated (do **not** grant to students)

Every file below imports `RequireStaff` (which calls `isStudentSession()` and
redirects a student away) or is admin/teacher-only by content. These should be
**hidden from the student sidebar**.

### LMS — teacher/authoring (all wrapped in `RequireStaff`)

| Route | Purpose (staff) |
|---|---|
| `/lms/teacher-dashboard` | Teacher dashboard |
| `/lms/homework` + `/homework/report` + `/homework/submission` + `/homework/submission-report` | Assign & review homework |
| `/lms/lmsAssignment` | Create/author assignments (students are redirected to submission) |
| `/lms/lmsAnnotate_assignment`, `/lms/lmsAnnotate_assignment/[id]` | Authoring/annotation |
| `/lms/lesson-plan`, `/lms/curriculum-planning`, `/lms/syllabus-plan`, `/lms/monthly-plan`, `/lms/global-mapping` | Planning & mapping |
| `/lms/teacher-diary`, `/lms/student-analysis` + `[studentId]` | Teacher diary, per-student analytics |
| `/lms/leader-board-master`, `/lms/lms_teacherResource` | Master/configuration |
| `/lms/book-list`, `/lms/reports`, `/lms/question-wise-report` | Reference/reporting |

### Admin / config-heavy (not student-facing)

| Route | Purpose |
|---|---|
| `/pal/new` + `/administration…`, `/content-model…` (authoring/review), `/content…` (review/misconceptions) | New PAL suite — admin estates, content model, approval |
| `/pal/pedagogy-engine`, `/pal/personalize-marks`, `/pal/report` | Teacher PAL tools |
| `/h5p/model` | H5P pedagogy/framework tagging (admin) |
| `/h5p/h5p_flashacard` (+ /create, /[id]/edit), `/h5p/h5p_interactive_video` (+ authoring), `/h5p/scenario_based` (+ /create, /edit) | H5P content authoring (teacher) |
| `/exam/exam-creation`, `/exam/exam-master`, `/exam/marks-entry`, `/exam/progress-report` | Exam creation / marks / reports |
| `/lms/exam` *teacher tab* | Teacher's exam hub (create/publish) — the student role only gets the student tabs of the same page |

Everything else in the ERP (Fees, Admissions, Attendance, Transport, Hostel,
Library management, HR, Inventory, Reports suite, academic_setup, user management,
role & permissions, etc.) is an **operator/admin** module and should remain hidden
from students by default.

---

## 3. Recommended default student menu

> Baseline grant for the `student` profile. Tenants can trim/adjust per school —
> the sidebar renders whatever the `/api/menu-rights` returns for the student.

| Top-level menu | Options / modules under it |
|---|---|
| **Dashboard** | Student home, Students landing |
| **LMS** | LMS dashboard, Assignments (submission), Test/Exam (student tabs), Leader board |
| **Exam** | Online exam (attempt + review) |
| **PAL** | PAL workspace (self), Exam, Result, Intelligence, Frameworks, ULU, Gamification |
| **H5P / Practice content** | HTML-contents hub, MCQ, Flashcards, Interactive video, Scenario |
| **Course content** | Course master (Learn/Test), Chapters, Quiz |

### Open/consideration items

- **Gamified sessions** are student-native, but **team challenges / challenge-mode**
  are opt-in/shared — decide per school whether to enable peers against each other.
- **Parent portal** is out of scope of this codebase view (four profile roles are
  Admin, Teacher, Staff, Parent per the design system; the app currently branches
  on `student`). A parent-facing menu would be a separate grant cluster.
- The final arbiter is the backend `menu-rights` grant for `user_profile_name = student`
  in each tenant's `tblmenumaster`; this report is the recommended default, not the
  authority.
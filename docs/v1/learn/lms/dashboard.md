# LMS Dashboard
**Product:** Scholar Learn | **Module:** LMS | **Frontend route:** `/lms/dashboard` (student) · `/lms/teacher-dashboard` (staff) | **v1 status:** Complete

| Field | Value |
|---|---|
| Backend routes | `POST /teacher-dashboard/summary`, `GET /lms/student-engagement`, `GET /lms/leaderboard` |
| Roles | Student, Teacher, Admin |
| Last updated | 2026-11-04 |
| Source commit | 8fe500dc (FE) / 86261072 (BE) |

## 1. Purpose & users
Two role-specific dashboards served from the same route family:
- **Student dashboard** (`/lms/dashboard`) — shows the student's own subjects, timeline, past performance bar chart, and current standard's subject list. Used daily by students.
- **Teacher dashboard** (`/lms/teacher-dashboard`) — shows KPI cards (my classes, my students, subjects, homework to review, assignments to grade), quick action links, class list, assignments awaiting grading, subjects list, and recent circulars. Used daily by teachers.

Both dashboards support per-user widget show/hide customisation stored in `dashboard_preferences` via `useDashboardPreferences`.

## 2. Screens

### Student Dashboard — `/lms/dashboard`
Shows: profile + standards timeline, past performance bar chart (Chart.js), current subjects list.
Main actions: navigate to subject/chapter, view performance.
![](./screenshots/lms-dashboard-student.png)

### Teacher Dashboard — `/lms/teacher-dashboard`
Shows: 5 KPI stat cards, quick action buttons, my classes list, assignments awaiting grading, my subjects, recent circulars.
Main actions: open homework review, open assignment grading, navigate to class, customise widget layout.
![](./screenshots/lms-dashboard-teacher.png)

## 3. Features & business rules

**Student dashboard widgets**

| Widget ID | Label | Notes |
|---|---|---|
| `panel.timeline` | Profile and standards timeline | Hides/shows via customise |
| `chart.past_performance` | Past performance | Bar chart by subject |
| `panel.current_subjects` | Current standard — subjects | Cards linking to subject pages |

**Teacher dashboard widgets**

| Widget ID | Label | Group |
|---|---|---|
| `kpi.my_classes` | My classes | kpi |
| `kpi.my_students` | My students | kpi |
| `kpi.subjects` | Subjects | kpi |
| `kpi.homework_to_review` | Homework to review | kpi |
| `kpi.assignments_to_grade` | Assignments to grade | kpi |
| `panel.quick_actions` | LMS quick actions | panel |
| `panel.my_classes` | My classes list | panel |
| `panel.assignments_to_grade` | Assignments awaiting grading | panel |
| `panel.my_subjects` | My subjects | panel |
| `panel.recent_circulars` | Recent circulars | panel |

Permission rules: `RequireStaff` guard on teacher dashboard — students redirected. Student dashboard reads `menuContext.user_profile_name` from localStorage to decide which view to render.

Performance colour tier (student):
- ≥75% → emerald
- ≥50% → sky
- ≥35% → amber
- <35% → rose

## 4. User flows

**Teacher — first load:**
1. Navigate to `/lms/teacher-dashboard`.
2. `RequireStaff` checks localStorage for staff profile; if student, redirect.
3. `fetchTeacherDashboard()` calls `POST /teacher-dashboard/summary`.
4. KPI cards render; lower panels (classes, grading queue, subjects, circulars) render two-per-row; odd panel gets full row.
5. Teacher clicks "Homework to review" KPI → navigates to homework review list.

**Student — first load:**
1. Navigate to `/lms/dashboard`.
2. `fetchLmsDashboard()` calls backend; profile read from localStorage.
3. Bar chart renders past performance per subject.
4. Subject cards show current standard subjects; click navigates to subject/chapter.

## 5. Data model

| Table | Key columns | Notes |
|---|---|---|
| `lms_student_engagement` | `user_id`, `subject_id`, `chapter_id`, `engagement_type`, `score`, `created_at` | Source for past performance |
| `dashboard_preferences` | `user_id`, `dashboard_key`, `hidden_widget_ids` | Per-user widget visibility |
| `tblstudent` | `student_id`, `standard_id`, `division_id` | Resolves "current standard" |

## 6. APIs

| Method | Endpoint | Auth | Request | Response |
|---|---|---|---|---|
| POST | `/teacher-dashboard/summary` | JWT | `{ sub_institute_id, syear }` | `TeacherDashboardSummary` (classes, students, subjects, hw_to_review, assignments_to_grade, class_list, assignments, subjects_list, circulars) |
| GET | `/lms/student-engagement` | JWT + `lms.auth` | query params: `sub_institute_id`, `syear` | engagement rows |
| GET/PUT | `/dashboard-preferences/{dashboardKey}` | JWT | body: `{ hidden_widget_ids }` | saved prefs |

## 7. UI components & design tokens
- `StatCard`, `SectionPanel`, `QuickActionLink`, `DashboardSkeleton`, `DashboardError`, `EmptyState` — from `app/dashboard/_components/DashboardPrimitives`
- `CustomizeDashboard`, `AllWidgetsHiddenNotice` — from `app/dashboard/_components/CustomizeDashboard`
- `useDashboardPreferences` — hook managing widget show/hide with backend persistence
- Chart.js `Bar` chart for past performance
- Lucide icons: `BookOpen`, `ClipboardList`, `GraduationCap`, `LibraryBig`, `NotebookPen`, `School`, `Users`
- Tokens: `--surface-*`, `--content-*`, `--border-*`; tier colours via Tailwind (`bg-emerald-500`, `bg-sky-500`, etc.)

## 8. Reports & exports
No direct export from dashboards. KPIs link to detailed report pages in `/lms/reports`.

## 9. Test cases

| ID | Scenario | Steps | Expected result | Type |
|---|---|---|---|---|
| LMS-D-01 | Teacher dashboard loads | Log in as teacher, navigate `/lms/teacher-dashboard` | KPI cards + 4 panels render; no spinner | Happy |
| LMS-D-02 | Student redirected from teacher dashboard | Log in as student, navigate `/lms/teacher-dashboard` | Redirected to `/lms/lmsAssignment_submission` | Edge |
| LMS-D-03 | Widget hidden persists | Teacher hides "My subjects" panel, refreshes | Panel still hidden | Happy |
| LMS-D-04 | All widgets hidden | Teacher hides all widgets | `AllWidgetsHiddenNotice` displayed | Edge |
| LMS-D-05 | API error | Backend returns 500 | `DashboardError` with retry button shown | Negative |

## 10. Known issues, limitations & FAQs
- Student dashboard reads profile from `localStorage` — will not render correctly if localStorage is unavailable (private window).
- Widget IDs are hard-coded constants; renaming them would orphan saved user preferences.
- Teacher dashboard `panel.recent_circulars` data comes from the same summary API; no dedicated circulars endpoint.

## 11. Sales notes
- **Selling point**: role-aware — same URL family, different experience for student vs. teacher, no configuration needed.
- **Demo flow**: (1) log in as teacher → show KPI tiles with live numbers; (2) click "homework to review" → show review queue; (3) log in as student → show personal performance chart; (4) hide a widget → show personalisation.
- Plan/pricing: TBD.

## 12. v1 status & v2 ideas
- v1: Complete. Both student and teacher dashboards are fully functional with customisation.
- v2: Add parent-view dashboard; add class-level performance heatmap; push notifications from dashboard KPIs.

## Source files
- `C:\rajesh\lms_k12\app\lms\dashboard\page.tsx`
- `C:\rajesh\lms_k12\app\lms\teacher-dashboard\page.tsx`
- `C:\rajesh\lms_k12\app\lms\data\lmsDashboard.ts`
- `C:\rajesh\lms_k12\app\lms\data\studentAnalysis.ts`
- `C:\rajesh\lms_k12\app\dashboard\_components\DashboardPrimitives.tsx`
- `F:\xampp\htdocs\next_lms_erp\routes\api.php` (teacher-dashboard/summary)

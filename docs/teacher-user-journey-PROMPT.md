# Prompt: Build the Teacher User Journey & Navigation Map

> Paste everything below the line into Claude Code (or another coding agent) with
> both repos open. It is written to be self-contained.

---

## Role

You are a product analyst + technical writer working inside the K-12 ERP / Teach
Connect codebase. Your job is to produce a **Teacher User Journey and Navigation
Map**: an evidence-backed document that shows every menu a teacher can reach,
what they do on each screen, and how they move from one menu to the next.

## Repos and where to look

Two repos make up the product:

- **`d:\next_lms_erp`** — Laravel backend (APIs, menu rights, role resolution).
- **`d:\lms_k12`** — Next.js 15 App Router frontend (all teacher-facing screens).

Ground every claim in code. Do not invent menus, routes, or capabilities.

### Required reading before you write anything

Navigation is **dynamic and server-driven** — there is no static teacher menu
list in the frontend. Understand this chain first:

1. `d:\lms_k12\contexts\AuthContext.tsx` — writes the session
   (`menuContext` / `userData`) to browser storage, including the free-text
   `user_profile_name`.
2. `d:\lms_k12\app\hooks\useMenuRights.ts` — POSTs that session to the backend
   `/api/menu-rights` and receives three menu levels.
3. `d:\lms_k12\app\data\menuMappers.ts` (`buildMenuTree`) +
   `d:\lms_k12\app\data\menuItems.ts` — turn rows into the rendered tree.
4. `d:\lms_k12\app\components\Sidebar.tsx` — renders levels 1/2/3, plus
   `app\components\HeaderMenuSearch.tsx` and `app\data\menuSearch.ts` for the
   search-based entry path.
5. `d:\next_lms_erp\app\Http\Controllers\api\MenuRightsController.php`
   (`getMenuRightsLevelWise`) — the authority on filtering; note it branches on
   `user_profile_name` and joins `tblmenumaster`, `tblindividual_rights`,
   `tblgroupwise_rights`.
6. `d:\next_lms_erp\app\Models\tblmenumasterModel.php` and the
   `app\Http\Middleware\MenuMiddleware.php` guard.

Also read the two existing precedents and match their tone, depth and table
style — this document is their teacher-side sibling:

- `d:\lms_k12\docs\student-menu-report.md`
- `d:\lms_k12\docs\teacher_role_audit.md`
- `d:\lms_k12\docs\user-journey\ROLE_BASED_USER_JOURNEY.md`

## What "teacher" means here

Teacher is not one role. Separate and label these personas explicitly, because
their menus differ:

- **Subject Teacher** — teaches assigned subjects to assigned classes.
- **Class Teacher** — subject teacher *plus* ownership of one class/division
  (see `app\classteacher\`, `app\classteacherReport\`).
- **HOD / Coordinator** — approvals and cross-teacher visibility, where the code
  supports it.

For each persona state how the code distinguishes it (role normalisation
helpers, `RequireStaff` guards, `resolveDashboardRole`, `isStudentSession`-style
checks, tenant menu grants) and cite the file.

## Scope of screens to cover

Sweep at minimum these frontend areas for teacher-reachable routes, and include
any others you find:

`app/dashboard`, `app/lms/*` (teacher-dashboard, teacher-diary, teacher-timetable,
lms_teacherResource, exam), `app/classteacher`, `app/classteacherReport`,
`app/teacher_daily_report`, `app/attendance`, `app/exam`, `app/chapters`,
`app/learning-outcome`, `app/course-master`, `app/pal`, `app/academic_setup`,
`app/library`, `app/front_desk/facultywisetimetable`, `app/student`,
`app/teach-learn`, `app/ai*`.

Explicitly mark screens that are **admin/back-office only** and must NOT appear
for a teacher, with the guard that enforces it.

## Deliverable

Write **`d:\lms_k12\docs\teacher-user-journey.md`** containing, in this order:

1. **How teacher navigation is resolved** — the dynamic-menu chain above, in
   prose, with file links. State plainly that per-tenant rights grants decide the
   final list, so this document describes the *engineered* teacher surface plus a
   recommended default grant, not a tenant's actual grid.

2. **Menu inventory table** — one row per teacher-reachable screen:
   `Menu path (Level 1 › 2 › 3) | Route | Persona(s) | What the teacher does there | Source file`.
   Group by Level 1 menu.

3. **Journeys** — 6–10 end-to-end narratives, each as a numbered step list where
   every step names the menu clicked, the route it lands on, and the action taken.
   Cover at least:
   - Daily start: login → dashboard → today's timetable → mark attendance.
   - Teach a lesson: chapter/content → assign to class → track completion.
   - Homework/assignment: create → publish → review submissions → grade.
   - Assessment: blueprint/question → schedule exam → evaluate → publish result.
   - Class teacher admin: class roster → attendance summary → student profile →
     report card / remarks.
   - Teacher diary / daily report submission and approval.
   - PAL / adaptive-learning journey, if teacher-facing entry points exist.
   - Communication: circular/notice → parent or student.

4. **Navigation graph** — a Mermaid `flowchart` showing menus as nodes and the
   real transitions between them (sidebar clicks, in-page CTAs, breadcrumb
   back-paths, deep links from dashboard widgets). Distinguish sidebar
   navigation from in-page navigation with different edge styles.

5. **Cross-menu entry points** — table of non-sidebar ways teachers move around:
   dashboard widget links, header search (`HeaderMenuSearch`), notifications,
   row-level action buttons, redirects after save.

6. **Dead ends & gaps** — screens a teacher can reach that fail, 404, require
   rights they won't have, or have no outward link. Flag anything unverifiable
   rather than guessing.

7. **Recommended default menu grant for the teacher profile** — a concrete list
   a tenant admin can apply in `tblmenumaster` rights, split by persona.

## Rules

- Every menu/route claim must cite the file (and line where useful) that proves
  it. Use clickable relative-path markdown links.
- If a route's teacher-visibility depends on tenant config and you cannot verify
  it, say so explicitly in an "unverified" column or note. Never fill a gap with
  a plausible guess.
- Prefer reading route files and guards over inferring from folder names.
- Do not modify application code. This task produces documentation only.
- Report at the end: how many routes you inspected, which areas you could not
  verify, and why.

# K12 onboarding – user journey & dashboard specification

Grounded in the current codebase at `d:\lms_k12` (branch `student_workflow`) as of 2026-08-26. Every claim below is traced to a file; every gap is stated as a gap, not filled in with an invented flow. Where this document extends the existing [ROLE_BASED_USER_JOURNEY.md](ROLE_BASED_USER_JOURNEY.md) (a live-tested menu crawl for Admin/Teacher/Student), it says so and does not repeat the full menu tables — see that document for the exhaustive per-screen listing.

**What "Staff" and "Parent" mean here:** the platform's own content model — [app/user/add_user_profile/page.tsx](../../app/user/add_user_profile/page.tsx) — treats "user profile" as an admin-configurable, hierarchical database record (name, description, parent profile, sort order), not a fixed enum. So "Staff" and "Parent" are not verified to exist as literal configured profile names in any tenant's data; they are treated here as the two roles the product brief names and the codebase does not yet resolve. This is stated explicitly, not assumed away.

---

## Section 1 — Entry points

### Where each role logs in today

All four roles share **one login surface**: [app/login/page.tsx](../../app/login/page.tsx). There is no role picker, no separate URL per role, and no branching in the login form itself — the same email/password form posts to the same endpoint regardless of who is signing in.

Two things on that screen are worth flagging before anything else, because they shape how "first impression" reads for every role, not just one:

- The screen carries LMS/student-facing marketing copy — "Teach Connect" as the mobile brand mark, "Learn without boundaries," "Sign up for free," a non-functional "Continue with Google" button — and an explicit **"Demo mode — use any email and password to sign in"** hint ([app/login/page.tsx:267-269](../../app/login/page.tsx#L267-L269)). This is the same screen an Admin, Staff member, or Parent would land on. It reads as a generic consumer ed-tech screen, not the calm, credential-gated, enterprise voice the design system specifies (`CLAUDE.md` — "competent, calm, respectful, quietly reassuring").
- **Gap:** none of this is role-aware. Whatever the first screen after login should say to reassure a Parent or Staff member specifically ("You're signed in as a parent of two students at Greenwood School," for instance) does not exist anywhere in the flow today.

### What the backend returns at login, and what's missing for Staff/Parent

`login()` in [contexts/AuthContext.tsx:145-199](../../contexts/AuthContext.tsx#L145-L199) posts `{ email, password, type: 'API' }` to `POST /api/api-login`, then extracts five fields from the response into a `menuContext` object stored in `localStorage`:

```
sub_institute_id, user_id, user_profile_name, user_profile_id, client_id
```

That is the entirety of what the frontend knows about "who logged in." `user_profile_name` is a free-text string from the backend (e.g. `"Admin"`, `"Teacher"`, `"Student"`) — there is no `role` field, no `permissions` array, no `staff_type` or `relationship_to_student` field for a Parent account. Notably, `login()` does **not** default an empty `user_profile_name` — it stores whatever the API returns, even if blank. (A separate function, `buildMenuContextFromSource` in [app/hooks/useMenuRights.ts:57-72](../../app/hooks/useMenuRights.ts#L57-L72), *does* default a missing profile name to `'ADMIN'`, but only when menu context is being rehydrated from storage on a later page load — so a blank profile name behaves differently depending on which code path reads it. Worth resolving before Staff/Parent are wired in, since a blank or unrecognized profile name silently becomes Admin either way.)

**Explicit gap — this is the crux of the Staff/Parent problem:** [app/dashboard/_lib/resolveDashboardRole.ts](../../app/dashboard/_lib/resolveDashboardRole.ts) maps `user_profile_name` to a dashboard using three hardcoded sets:

```ts
const ADMIN_PROFILES = new Set(['super admin', 'admin', 'school admin']);
const TEACHER_PROFILES = new Set(['teacher', 'lms teacher']);
const STUDENT_PROFILES = new Set(['student']);
```

There is no `STAFF_PROFILES` or `PARENT_PROFILES` set. Any profile name that isn't in one of the three lists — including a hypothetical `"Staff"` or `"Parent"` profile — falls through to the final line, `return 'admin'`. **A Staff or Parent login today would silently render the full `AdminDashboard`**, which calls `/api/admin-dashboard/summary` and shows school-wide KPIs (total students, total staff, fees collected today) that a parent or front-desk clerk has no business seeing and no permission to have collected server-side in the first place.

This isn't only a frontend gap. The legacy Laravel controller this file's own comment cites as its source of truth — `D:\next_lms_erp\app\Http\Controllers\dashboardController.php` — has the identical shape: an explicit `if ($user_profile_name == 'Admin' || ... )` branch (line 108) and a separate explicit `if ($user_profile_name == 'Student')` branch (lines 1265, 1474, 1577, 1597, 1639), with no `'Staff'` or `'Parent'` string check anywhere in the file. So the resolution gap is not a Next.js oversight to patch in isolation — the dashboard data contract for Staff and Parent doesn't exist on the backend either. Closing this needs backend work (a scoped `/api/dashboard/staff` and `/api/dashboard/parent` summary endpoint, matching the pattern of `/api/dashboard/teacher` and `/api/dashboard/student` in [app/dashboard/_lib/dashboard-api.ts:143-149](../../app/dashboard/_lib/dashboard-api.ts#L143-L149)) before the frontend has anything real to branch to.

### First screen after authentication, and how it's chosen

Every role redirects to the same route, `/dashboard` ([app/login/page.tsx:41](../../app/login/page.tsx#L41)). [app/dashboard/page.tsx](../../app/dashboard/page.tsx) reads the stored `user_profile_name`, calls `resolveDashboardRole()`, and renders one of three components: `AdminDashboard`, `TeacherDashboard`, or `StudentDashboard`. There is no `StaffDashboard.tsx` or `ParentDashboard.tsx` file anywhere in the repository — confirmed by directory listing of [app/dashboard/](../../app/dashboard/). Until both the resolver and a dedicated component exist, "first screen after login" for Staff and Parent is, by construction, the Admin dashboard.

---

## Section 2 — Step-by-step navigation flow (per role)

The application shell — sidebar, top bar, and the level-3 sub-header — is one component tree, [app/components/DashboardShell.tsx](../../app/components/DashboardShell.tsx), used by every role. What differs per role is purely the data returned by two backend calls; nothing about the shell itself branches on role. The IA has three levels, and the naming is easy to get backwards, so stating it precisely:

- **Level 1** — a top category shown as a sidebar group (e.g. "Institute ERP", "LMS + PAL"). Comment source: [app/data/moduleDashboards.ts:4-9](../../app/data/moduleDashboards.ts#L4-L9).
- **Level 2** — a module within that category (e.g. "Fees", "Admission"), shown as a mega-menu item under the sidebar group.
- **Level 3** — the actual screens inside a module (e.g. "Fees Collect", "Fees Cancel/Refund"), shown as a horizontal tab bar under the top bar once a Level 2 module is opened.

All three levels come back from one call, `POST /api/menu-rights` ([app/hooks/useMenuRights.ts:130-157](../../app/hooks/useMenuRights.ts#L130-L157)), built with the same five-field `menuContext` captured at login. `buildMenuTree()` in [app/data/menuMappers.ts:192-249](../../app/data/menuMappers.ts#L192-L249) filters every level to `status === 1` and a small hidden-link blocklist, then nests Level 2 under Level 1 and Level 3 under Level 2 by `parent_menu_id`. **This is the single mechanism that constrains what any role — including a future Staff or Parent role — can navigate to: whatever the backend returns for that `user_profile_id` is the entire universe of clickable menu.** The frontend does not additionally hide or show anything by role name; it renders exactly the tree it's given.

### Where the flow forks by profile name vs. where it's identical

- **Forks by profile name:** the `/dashboard` route's *component choice* ([app/dashboard/page.tsx:50-52](../../app/dashboard/page.tsx#L50-L52)) and which dashboard-summary endpoint gets called. Nothing else in the routing layer looks at `user_profile_name` directly.
- **Identical across roles:** the shell, the menu-rights fetch mechanics, the Level 1→2→3 click pattern, and — critically — **the actual screens**. [ROLE_BASED_USER_JOURNEY.md §2.1](ROLE_BASED_USER_JOURNEY.md#21-institute-erp-12-modules--a-filtered-subset-of-admins-36) confirms this from a live crawl: a Teacher's "Student Attendance" screen is the same route, same UI, as an Admin's — the backend scopes *which* students' data comes back, not which screen renders. This is the working assumption a Staff/Parent implementation should inherit: build the screens once, let `menu-rights` and server-side data scoping do the restricting, rather than forking the UI per role.

### Post-login → dashboard → first module a new user is likely to touch

Per [ROLE_BASED_USER_JOURNEY.md](ROLE_BASED_USER_JOURNEY.md) (live-tested, not inferred):

- **Admin:** lands on the full 6-group sidebar (Dashboard, Institute ERP, LMS + PAL, People & Competency, Career Counseling, Reports). The dashboard's own "Quick actions" panel ([app/dashboard/AdminDashboard.tsx:63-70](../../app/dashboard/AdminDashboard.tsx#L63-L70)) is the fastest path into a first module: Add student → `/student`, Collect fee → `/fees`, View reports → `/reports`. (**Known bug, carried over from the existing journey doc:** the fourth quick action, "Manage settings," points to `/settings`, which 404s — it isn't reachable through the sidebar/mega-menu tree at all, only through that broken shortcut.)
- **Teacher:** sidebar is reduced to Dashboard + Institute ERP only (12 of Admin's 36 modules), scoped to the teacher's own classes. First likely stop, per the dashboard's own quick actions ([app/dashboard/TeacherDashboard.tsx:61-68](../../app/dashboard/TeacherDashboard.tsx#L61-L68)): Take attendance → `/attendance`.
- **Student:** sidebar drops Institute ERP entirely and shows Dashboard, LMS + PAL, Career Counseling. No quick-actions panel exists on `StudentDashboard.tsx` today (unlike Admin and Teacher) — the "Pending homework" stat tile is the closest thing to a first action, linking implicitly to Test → Assignment.
- **Staff:** **not confirmed.** [ROLE_BASED_USER_JOURNEY.md §4](ROLE_BASED_USER_JOURNEY.md#4-front-desk--staff--not-directly-tested) explicitly flags that no front-desk/staff credential was tested; it infers (does not confirm) a scoped Institute ERP menu centered on Front Desk, Visitor Management, and Inward Outward, based on pattern-matching the Teacher scoping behavior. Treat this as an open question, not a spec.
- **Parent:** **no data at all.** The existing journey doc doesn't mention Parent even as an inferred case. The only parent-facing surface found anywhere in the app is a single admin-authored screen, `/front_desk/parent_communication` ([app/front_desk/parent_communication/](../../app/front_desk/parent_communication/)) — a place staff send messages *to* parents, not a parent-facing login destination. There is currently no evidence in the codebase of what a parent, after logging in, would see or do next.

---

## Section 3 — Role-wise dashboards

A cross-cutting finding before the per-role detail: **none of the three existing dashboards use the K-12 ERP Design System's actual components.** All three (`AdminDashboard.tsx`, `TeacherDashboard.tsx`, `StudentDashboard.tsx`) import from a local, bespoke file, [app/dashboard/_components/DashboardPrimitives.tsx](../../app/dashboard/_components/DashboardPrimitives.tsx) — `StatCard`, `SectionPanel`, `EmptyState`, `DashboardSkeleton`, `DashboardError`, `QuickActionLink` — plus a local `DashboardBarChart`. A repository-wide search for imports from `K-12 ERP Design System` returned zero matches. These primitives are hand-rolled Tailwind, visually similar in spirit (rounded cards, slate borders) but not literally the shared `MetricCard`, `SectionPanel`, or `Chart` components documented in `CLAUDE.md`. **Any dashboard work — including the two new Staff/Parent dashboards — is an opportunity to adopt the real design-system components for the first time, not a swap of one usage for another.**

### Admin — what exists today

[app/dashboard/AdminDashboard.tsx](../../app/dashboard/AdminDashboard.tsx), backed by `POST /api/admin-dashboard/summary` (called directly against the Laravel host, bypassing the Next proxy — see the comment at [app/dashboard/_lib/dashboard-api.ts:49-54](../../app/dashboard/_lib/dashboard-api.ts#L49-L54)):

- 8 stat tiles: total students, total staff, total classes, fees collected today, admissions this year, homework posted today, circulars today, pending parent messages.
- Quick actions: Add student, Collect fee, View reports, Manage settings (broken, see above).
- Two bar charts: fee collection trend (7 days), students by class.
- Two list panels: recent fee receipts, upcoming birthdays.

### Teacher — what exists today

[app/dashboard/TeacherDashboard.tsx](../../app/dashboard/TeacherDashboard.tsx), backed by `POST /api/dashboard/teacher`:

- 5 stat tiles: my classes, my students, subjects, homework to review, assignments to grade.
- Quick actions: Take attendance, Post homework, Grade assignments, Post circular.
- One bar chart (students by class), plus chip lists (my classes, my subjects) and two record lists (assignments awaiting grading, recent circulars).

### Student — what exists today

[app/dashboard/StudentDashboard.tsx](../../app/dashboard/StudentDashboard.tsx), backed by `POST /api/dashboard/student`:

- 3 stat tiles: enrolled subjects, pending homework, pending assignments.
- One bar chart (task status), chip list (my subjects), two record lists (pending homework, pending assignments, recent circulars).
- No quick-actions panel (the only one of the three dashboards without one).
- An "Achievements" panel that is a placeholder empty state today — explicitly gated behind gamification not yet being enabled ([app/dashboard/StudentDashboard.tsx:138-144](../../app/dashboard/StudentDashboard.tsx#L138-L144)).

### Staff — what's missing and needs to be designed

No `StaffDashboard.tsx`, no `/api/dashboard/staff` endpoint, no resolver branch. Proposed content, using only named design-system components (`CLAUDE.md` component groups) and scoped to what a front-desk/administrative staff profile most plausibly touches per the inferred menu in [ROLE_BASED_USER_JOURNEY.md §4](ROLE_BASED_USER_JOURNEY.md#4-front-desk--staff--not-directly-tested) — Front Desk, Visitor Management, Inward Outward, Admission Inquiry:

| Section | Component | Content |
|---|---|---|
| Header stats | `MetricCard` ×4 | Visitors today, pending inward/outward items, open admission enquiries, unresolved complaints (if Complaint Management is in scope for this profile) |
| Quick actions | `Button` group | "Log visitor", "Record inward", "Record outward", "Add enquiry" — verb-first, matching the existing Admin/Teacher quick-action pattern |
| Today's visitors | `DataTable` or `ListRow` list | Name, purpose, check-in time, host — the Visitor Management module's core record |
| Pending approvals | `ApprovalCard` list | Anything routed to staff for sign-off (e.g. gate-pass, inward item receipt) — only if such an approval step actually exists server-side; **flag as assumption if it doesn't** |
| Recent circulars | `AgendaList` or the existing circular list pattern | Reuse the same panel shape Admin/Teacher already use for circulars |
| Front desk activity feed | `ActivityFeed` | A chronological log of front-desk actions taken today — new surface, no equivalent exists on any current dashboard |

**Open question this table cannot resolve on its own:** the actual scope of a Staff profile is unconfirmed (see Section 2). Before building this, the same live-crawl approach used for Admin/Teacher/Student in `ROLE_BASED_USER_JOURNEY.md` should be repeated with a real front-desk credential — otherwise this dashboard is designed against an inference, not a verified menu.

### Parent — what's missing and needs to be designed

No `ParentDashboard.tsx`, no `/api/dashboard/parent` endpoint, no resolver branch, and — unlike Staff — **no inferred menu to design against at all.** The only concrete evidence of "parent" anywhere in the frontend is the staff-facing `parent_communication` screen and the Admin dashboard's "pending parent communications" stat tile, both of which describe parents as the *subject* of admin/teacher actions, never as a logged-in actor. Proposed content below is therefore a best-effort design against what a parent-facing view would logically need in a K-12 ERP (attendance, fees, homework, circulars — all data that already exists and is already surfaced to Admin/Teacher/Student in some form), explicitly **not** grounded in any confirmed parent-scoped API or menu:

| Section | Component | Content |
|---|---|---|
| Child selector | `SegmentedControl` or `Select` | A parent with multiple children needs to switch context — this doesn't exist in any current role's dashboard, since Admin/Teacher/Student all have exactly one implicit scope |
| Header stats | `MetricCard` ×3–4 | Attendance this month, fee balance due, pending homework, unread circulars — for the selected child |
| Fee balance | `MetricCard` (tone: warning if overdue) + `Button` ("Pay fee") | Mirrors the Admin dashboard's fee-collected tile, inverted to the parent's-own-balance view |
| Attendance snapshot | `Chart` or `Sparkline` | Reuse the same bar-chart pattern already used for students-by-class, scoped to one child's daily record |
| Homework & assignments | `ListRow` list, same shape as Student's "pending homework" panel | Read-only for the parent — no submission action, since submission is the student's own action |
| Circulars & notices | `AgendaList` | Same data Admin/Teacher/Student already see, filtered to the child's class |
| Messages from school | `CommentThread` or `NotificationItem` list | The read side of the existing `parent_communication` module — today parents receive these through SMS/WhatsApp/email ([app/easy_com](../../app/easy_com)), not through any web view |

**This entire dashboard is a design proposal against inferred needs, not verified requirements** — flagging per the task's explicit instruction not to smooth over the gap. Before implementation, the product team should confirm: does a "Parent" profile exist in `add_user_profile` for any tenant today, does the backend even authenticate a parent-role login, and if so what data scoping (which child/children) does session already carry.

---

## Section 4 — Module-wise dashboards

The `app/` top-level directory listing is the authoritative module registry per the task instructions. It contains some naming inconsistencies worth flagging up front rather than silently normalizing:

- **`student/` and `students/` are two separate top-level directories** — not a typo in this document, an actual duplication in the codebase. `ROLE_BASED_USER_JOURNEY.md` shows both are in active use (`/students/search_student`, `/student/student_attendance`, `/student/student_icard`, etc.) — likely a historical split by feature rather than a true duplicate, but worth a housekeeping pass.
- **`front_desk/` and `frontdesk/` both exist.** `front_desk/` is the substantial module (calendar, circular, timetable, parent communication, exam schedule); `frontdesk/` contains only a `user_log` subfolder, which looks like an orphaned or superseded path.
- **`organization-management/` and `organization_managment/`** (note the misspelling in the second) both exist as top-level directories — likely one superseded the other.
- **`admission-Enquiry/` is a single `page.tsx`, separate from `admissions/admission_enquiry/`**, which is the module `ROLE_BASED_USER_JOURNEY.md` confirms is actually wired into the Admission mega-menu (`/admissions/admission_enquiry`). `admission-Enquiry/` at the root looks like a leftover, not a second real entry point — but this document does not have enough evidence to say so for certain, so it's flagged rather than dropped.

None of these were resolved as part of this document — resolving them is out of scope for a journey/dashboard spec, but they will produce confusing results if used unexamined as a module list for further design work.

### Clusters

Each cluster below lists its backing `app/*` directories, the Level 1 sidebar group it lives under where `ROLE_BASED_USER_JOURNEY.md` confirms it (flagged "unconfirmed" otherwise), which roles the role-comparison table shows currently seeing it, and whether a module-level dashboard route already exists (per [app/data/moduleDashboards.ts](../../app/data/moduleDashboards.ts), which currently defines exactly six: `fees`, `admissions`, `students`, `library`, `hostel`, `transportation` — every other module jumps straight to its first Level 3 screen with no landing dashboard at all).

| Cluster | Backing directories | Level 1 group | Seen by (confirmed) | Landing dashboard exists? |
|---|---|---|---|---|
| **Academics** | `academic_setup`, `subjects`, `chapters`, `course-master`, `learning-outcome`, `classteacher`, `classteacherReport`, `exam`, `quiz`, `result` | Institute ERP (Exam, Timetable) + LMS+PAL (Teach/Learn) — split across two groups | Admin, Teacher (scoped); not Student for the ERP half | No — `course-master` and `exam` both jump to their first screen |
| **Admissions** | `admissions`, `admission-Enquiry` (orphan, see above) | Institute ERP | Admin, Teacher | **Yes** — `/admissions/dashboard` |
| **Fees** | `fees` | Institute ERP | Admin only (Teacher's 12-module subset excludes Fees per the tested account) | **Yes** — `/fees/dashboard` |
| **Attendance** | `attendance`, `todays_proxy_report`, `proxy_master`, `proxy_report`, `teacher_daily_report`, `teachertransfer` | Institute ERP | Admin, Teacher (scoped to own classes) | No |
| **HR & talent** | `hrit` (attendance-management, leave-management, payroll-management), `talent-management`, `capability-intelligence`, `user` (add_user, add_user_profile) | People & Competency | **Unconfirmed** — the tested Admin account saw the sidebar group present but empty; the journey doc flags this as needing a real HR-admin login to verify | No |
| **Career counseling** | `career-counselling` | Career Counseling (its own top-level group, not folded into HR) | Admin, Student | No — single screen, no sub-tabs |
| **Transport** | `Transportation` | Institute ERP | Admin (Teacher's subset excludes it) | **Yes** — `/Transportation/dashboard` |
| **Library** | `library` | Not listed in the tested Institute ERP module table at all — **possible additional gap**: `library` has a dashboard route defined in code but doesn't appear in the live-crawled Admin menu, which should be reconciled | Unconfirmed | **Yes** — `/library/dashboard` |
| **Hostel** | `hostel` | Institute ERP | Admin | **Yes** — `/hostel/dashboard` |
| **LMS & PAL** | `lms`, `pal`, `h5p`, `ai-platforms` | LMS + PAL | Admin, Student (Teacher's menu excludes this entire group per the tested account) | No — `/lms/dashboard` exists as a *report* landing ("LMS Dashboard" under LMS Report), not a Level-2 module dashboard in the `moduleDashboards.ts` sense |
| **Front office & communication** | `front_desk`, `frontdesk` (orphan), `general`, `easy_com` | Institute ERP | Admin, Teacher (partial — e.g. Exam Schedule only) | No |
| **Reports & analytics** | `reports`, `sqaa_document_report`, `document-templates` | Reports (its own top-level group, ~90 individual reports across 13 groups per the journey doc) | Admin only | N/A — this cluster *is* the reporting surface; a module dashboard isn't the right shape here, a report-picker/landing is |
| **Inventory & operations** | `Inventory`, `bazar`, `easy_com`, `inward_outward`, `Utility` | Institute ERP | Admin | No |
| **Admin & org settings** | `admin-services`, `admin-tools`, `organization-management`, `organization_managment` (duplicate, see above), `settings` (broken route), `migration-modules`, `import-data` | Institute ERP | Admin | No — and `settings` specifically 404s today |
| **Quality & compliance (SQAA)** | `sqaa`, `sqaa_master`, `sqaa_document_report` | Institute ERP | Admin | No |
| **Task & complaint management** | `task-management` | Institute ERP | Admin | No |

### What a module-level landing dashboard should surface, for the clusters that don't have one

The six that already have a dashboard route establish the pattern to follow (stat tiles + a couple of charts + recent-activity lists, per the existing `fees/dashboard`, `admissions/dashboard`, etc.). For the largest gaps:

- **Attendance:** `MetricCard` row (today's overall attendance %, students marked absent, classes not yet marked), a `Chart` trend (daily attendance over the term), and a `DataTable` of classes still pending today's attendance entry — directly actionable, since "which classes haven't submitted attendance yet" is the operational question this dashboard exists to answer.
- **HR & talent:** blocked on the unconfirmed menu-rights gap above; once confirmed, the natural shape is `MetricCard`s for headcount/leave-pending/payroll-cycle-status plus an `ApprovalCard` list for pending leave requests.
- **LMS & PAL:** a true Level-2 dashboard (distinct from the existing LMS *report*) surfacing content-authoring activity (courses published, active PAL chapters, homework/assignment volume) would sit well as the landing screen before Teach/Learn, Test, Engagement, etc. — using `MetricCard` + `ActivityFeed` for recent authoring/grading actions.
- **Front office & communication:** this is exactly the Staff dashboard proposed in Section 3 — the module-level and role-level dashboard converge here, so building one likely satisfies both.

---

## Summary of open gaps (for tracking, not exhaustive prose repeated from above)

1. `resolveDashboardRole.ts` has no Staff or Parent branch — both silently resolve to Admin. Confirmed as a gap on the legacy Laravel backend too (`dashboardController.php` has no `'Staff'`/`'Parent'` string check).
2. No `/api/dashboard/staff` or `/api/dashboard/parent` endpoint exists — this is a backend gap, not just a frontend routing gap.
3. No live-tested menu-rights crawl exists for Staff or Parent (Staff is inferred only; Parent has zero data).
4. No evidence a "Parent" profile is even configurable in `add_user_profile` today, or that a parent-facing login is authenticated at all.
5. None of the three existing dashboards use the actual K-12 ERP Design System components — they use local, bespoke primitives that resemble but aren't sourced from the shared library.
6. The Admin dashboard's "Manage settings" quick action points to a 404 (`/settings`) that isn't reachable through the sidebar.
7. `login()` and `buildMenuContextFromSource()` default a missing `user_profile_name` differently (one leaves it blank, the other defaults to `'ADMIN'`), which will matter once unrecognized profile names are supposed to route somewhere other than Admin.
8. Several `app/*` directory pairs look like duplicates or orphans (`student`/`students`, `front_desk`/`frontdesk`, `organization-management`/`organization_managment`, `admission-Enquiry` standalone) — not resolved here, flagged for a housekeeping pass before they're used as a clean module registry elsewhere.
9. `library` has a defined dashboard route but doesn't appear in the live-crawled Admin sidebar menu in `ROLE_BASED_USER_JOURNEY.md` — worth reconciling.
10. The login screen's copy and tone (demo-mode hint, LMS marketing language, non-functional social login) don't match the design system's stated enterprise voice, and are shown identically to every role including Admin.

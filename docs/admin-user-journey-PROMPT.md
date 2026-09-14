# Prompt: Build the Admin User Journey & Navigation Map

> Paste everything below the line into Claude Code with both repos open. It is
> written to be self-contained. It is the admin-side sibling of
> [teacher-user-journey-PROMPT.md](teacher-user-journey-PROMPT.md), which
> produced [teacher-user-journey.md](teacher-user-journey.md) — read that output
> first and match its structure, evidence discipline and table style.

---

## Role

You are a product analyst + technical writer working inside the K-12 ERP /
Teach Connect codebase. Produce an **Admin User Journey and Navigation Map**:
an evidence-backed document covering every menu an administrator can reach, the
full submenu structure beneath each, what the admin does on each screen, and
every path from one menu to another.

## Repos

- **`d:\next_lms_erp`** — Laravel backend (APIs, menu rights, role resolution).
- **`d:\lms_k12`** — Next.js 15 App Router frontend (all admin-facing screens).

Ground every claim in code. Do not invent menus, routes, submenus or actions.

## The one fact that shapes this whole document

**An admin is granted every menu row in the tenant.**
[NewLMS_ApiController::INSERT_RIGHTS](../../next_lms_erp/app/Http/Controllers/api/NewLMS_ApiController.php)
builds `$admin_rights` by selecting *all* of `tblmenumaster` where
`find_in_set(sub_institute_id, sub_institute_id)` and `status = 1` — an
unfiltered sweep, unlike the hand-curated `$lmsteacher_rights` /
`$lmsstudent_rights` lists beside it. So, unlike the teacher document, the
question is not "which of these can they see" but **"what is the whole product,
organised as the admin traverses it"**.

Two consequences you must design around:

1. **Scale.** 534 `page.tsx` route files, 81 top-level route groups. You cannot
   open all of them at useful depth. Adopt an explicit strategy and state it in
   the coverage report: read every Level-1/Level-2 landing and module dashboard
   in full; for Level-3 leaf screens, read representatively and sweep the rest
   mechanically (route enumeration + `router.push`/`href` target extraction +
   guard grep). Never pad the inventory with folder-name guesses.
2. **Admin is where the product's *own* administration lives.** The rights grid,
   master setup and platform administration are admin territory, and the
   teacher document flagged that the avatar dropdown exposes them ungated. That
   finding is *this* document's core subject, not a footnote.

## Required reading before you write anything

### The dynamic menu chain (same for all roles)

1. [contexts/AuthContext.tsx](../contexts/AuthContext.tsx) — `persistLoginPayload()` writes `menuContext` (`sub_institute_id`, `user_id`, `user_profile_name`, `user_profile_id`, `client_id`) to `localStorage`. `user_profile_name` is free text.
2. [app/hooks/useMenuRights.ts](../app/hooks/useMenuRights.ts) — POSTs it to `/api/menu-rights`; note `getStoredMenuContext()` **defaults a missing profile name to `'ADMIN'`**.
3. [app/data/menuMappers.ts](../app/data/menuMappers.ts) `buildMenuTree()` + [app/data/routeMapper.ts](../app/data/routeMapper.ts) `mapApiLinkToRoute()` — rows to tree, legacy route names to Next.js paths.
4. [app/components/Sidebar.tsx](../app/components/Sidebar.tsx), [app/components/DashboardShell.tsx](../app/components/DashboardShell.tsx) `handleLevel2Select`, [app/components/Level3Subheader.tsx](../app/components/Level3Subheader.tsx), [app/data/moduleDashboards.ts](../app/data/moduleDashboards.ts) — rendering and landing-route selection.
5. [app/components/HeaderMenuSearch.tsx](../app/components/HeaderMenuSearch.tsx) + [app/data/menuSearch.ts](../app/data/menuSearch.ts) — search over the same tree.

### The admin-specific backend branches — read these carefully

[MenuRightsController::getMenuRightsLevelWise](../../next_lms_erp/app/Http/Controllers/api/MenuRightsController.php)
has behaviour no other role hits. Document each precisely:

- **`sub_institute_id == 0 && is_admin == 1`** takes a *different query branch*
  that filters on `FIND_IN_SET(client_id, m.client_id)` instead of
  `sub_institute_id`, and adds `u.status = 1`. This is the multi-tenant /
  super-admin path. Establish what the menu looks like on it.
- **`MASTER` menu_type splice.** When the current route's menu row is
  `menu_type = 'MASTER'`, ids `37,41,42` are appended for
  `admin`/`Admin`/`ADMIN` — and for `SCHOOL ADMIN` **only when the session flag
  `multiSchool == 1`**. Explain what those three ids are and what the School
  Admin loses without the flag.
- **`new_sub_institute_id` in session** removes the `u.id = user_id` predicate
  in the standard branch — a school-switch mechanism. Work out its effect on the menu.
- Standard queries otherwise exclude `menu_type = 'MASTER'`, so master-setup
  menus surface only via the splice above.
- [MasterSetupMenuMiddleware](../../next_lms_erp/app/Http/Middleware/MasterSetupMenuMiddleware.php)
  — the Blade-era twin for master setup; and
  [MenuMiddleware](../../next_lms_erp/app/Http/Middleware/MenuMiddleware.php),
  which short-circuits on `type=API` and so never gates the Next.js client.

### Role resolution

[app/dashboard/_lib/resolveDashboardRole.ts](../app/dashboard/_lib/resolveDashboardRole.ts):
`ADMIN_PROFILES = {'super admin','admin','school admin'}` — **and every
unrecognised profile name falls through to `admin`**. Document what that
fall-through means: a tenant profile named "HOD", "Principal", "Accountant" or
"Librarian" renders [AdminDashboard.tsx](../app/dashboard/AdminDashboard.tsx).
Cross-check against the legacy `dashboardController.php` admin-name set.

## Admin personas to separate

Establish from code which of these the system can actually distinguish, and say
plainly where a distinction is menu-grant convention rather than a code role:

- **Super Admin** — `sub_institute_id = 0`, `is_admin = 1`, client-scoped menus, cross-tenant.
- **School Admin** — single `sub_institute_id`; `multiSchool` session flag governs the MASTER splice.
- **Admin** — the full-rights baseline `INSERT_RIGHTS` provisions.
- **Module/back-office admin** (accounts, admissions, HR, library, transport, hostel) — almost certainly *not* a code role; verify and say so.
- **Fall-through profiles** — anything unrecognised, which silently becomes admin.

## Scope: every module, not just academics

Sweep all 81 top-level route groups in [app/](../app/). At minimum organise
coverage around these clusters, and add any you find:

- **Dashboards & landings** — `dashboard`, `students/dashboard`, `fees/dashboard`, `admissions/dashboard`, `library/dashboard`, `hostel/dashboard`, `Transportation/dashboard` (note the `moduleDashboards.ts` interception).
- **Academics** — `academic_setup`, `course-master`, `chapters`, `subjects`, `learning-outcome`, `exam`, `result`, `quiz`, `h5p`.
- **Teaching & LMS** — `lms/*`, `teach-learn`, `pal/*`, `classteacher`, `classteacherReport`, `teacher_daily_report`, `teachertransfer`, `proxy_master`/`proxy_report`.
- **Student lifecycle** — `admission-Enquiry`, `admissions`, `student`, `students`, `attendance`, `front_desk`, `frontdesk`.
- **Finance & operations** — `fees`, `Inventory`, `bazar`, `hostel`, `Transportation`, `library`, `inward_outward`, `easy_com`.
- **People & HR** — `hrit`, `talent-management`, `people-competency`, `organization-management`, `organization_managment`, `onboarding`.
- **Platform & governance** — `platform-administration`, `platform-roadmap`, `general` (groupwise/individual/mobile-app rights), `admin-services`, `admin-tools`, `settings`, `import-data`, `migration-modules`, `document-templates`, `user_log`, `Utility`.
- **AI** — `ai`, `ai-journey`, `ai-platforms`, `ai-reports`, `capability-intelligence`, `enterprise-brain`, `career-*`.

For each cluster give the Level-1 → Level-2 → Level-3 structure as far as the
evidence supports it, and mark inferred placement explicitly.

## Deliverable

Write **`d:\lms_k12\docs\admin-user-journey.md`** with these sections:

1. **How admin navigation is resolved** — the chain above in prose, then the
   admin-only branches (`is_admin`/`sub_institute_id = 0`, the MASTER splice,
   `multiSchool`, `new_sub_institute_id`), then a table of what distinguishes
   each admin persona and what does not. State clearly that admin receives the
   whole `tblmenumaster`, so this maps the engineered product surface, and that
   no live tenant grid was queried.

2. **Menu inventory** — grouped by Level 1, one row per screen:
   `Menu path (L1 › L2 › L3) | Route | Persona(s) | What the admin does there (the concrete actions — create/approve/configure/export) | Source file | Verified`.
   Use the teacher document's **Verified** vocabulary: `code` (route + guard read
   directly), `grant` (present in a shipped rights baseline), `route-map`
   (link→route mapping exists, menu row unobserved). Keep the ⚠ convention for
   screens rendering hardcoded data — cross-reference
   [menu-data-source-audit.md](menu-data-source-audit.md) rather than re-deriving.

3. **Submenu structure map** — a compact indented tree of the full Level-1 →
   Level-2 → Level-3 hierarchy, so the shape is readable at a glance without the
   wide inventory tables. Mark inferred levels.

4. **Journeys** — 10–14 end-to-end narratives, each a numbered step list naming
   the menu clicked, the route reached and the action taken. Cover at minimum:
   - New academic year setup: session/board → standards & divisions → subjects → subject-standard mapping → timetable.
   - Onboard a new staff user: create user → assign profile → grant group-wise rights → verify the menu they now see.
   - Admissions: enquiry → application → admit → student record → fee plan assignment.
   - Fee cycle: fee structure → assign → collect → receipts → dues report.
   - Assign class teachers (`/classteacher`) and verify via `/classteacherReport`.
   - Exam cycle governance: exam master → schedule → marks approval → report cards → consolidate.
   - Attendance oversight and reports.
   - Circulars / communication blasts (`easy_com`).
   - Supervisory review: `/teacher_daily_report` approve/reject → drill-down.
   - Library / hostel / transport module admin (one representative each).
   - Platform administration: rights grid, mobile-app rights, master setup.
   - Multi-school / super-admin: switch school and observe the menu change.

5. **Complete navigation graph** — Mermaid `flowchart`, solid edges for
   sidebar/menu navigation and dashed for in-page navigation (CTAs, tabs, row
   actions, post-save redirects), with one subgraph per Level 1. If a single
   graph becomes unreadable at this scale, split into a top-level module graph
   plus per-cluster graphs, and say why.

6. **Cross-menu entry points** — every non-sidebar transition: admin dashboard
   widgets and quick actions, module-dashboard interception via
   `moduleDashboards.ts`, the Level-3 sub-header and its Master flyout, header
   search, the **avatar dropdown** ([Header.tsx](../app/components/Header.tsx)),
   row-level drill-downs, post-save redirects, school switcher, notification bell.

7. **Dead ends & gaps** — unreachable screens, 404 fallbacks from unmapped
   `link` values, placeholder pages, hardcoded-data screens, orphan routes with
   no inbound link, and duplicated modules (e.g. `frontdesk` vs `front_desk`,
   `organization-management` vs `organization_managment`) — establish which is live.

8. **Privilege & containment findings** — admin-specific security-shaped
   observations, stated factually: the ungated avatar dropdown into the rights
   grid, unguarded API routes (check `routes/api.php` for `apiResource`
   registrations outside `api.session` groups, e.g. `class-teachers`,
   `teacher-daily-reports`), `INSERT_RIGHTS` hardcoding all four CRUD flags to
   `1`, and the unrecognised-profile → admin fall-through. Report what you
   verified and what you only traced to the navigation layer.

9. **Recommended menu grants** — since admin is all-or-nothing today, propose
   scoped bundles a tenant could use instead: Super Admin, School Admin,
   Academic Admin, Accounts Admin, HR Admin, Front Office, Librarian — each a
   menu list with CRUD flags, plus a "never grant outside Super/School Admin"
   list (rights grid, master setup, platform administration, import-data, user_log).

10. **Coverage report** — how many routes exist, how many you opened directly,
    which you covered by mechanical sweep, what you could not verify and why.

## Rules

- Every menu, route, submenu and guard claim cites the file (line where useful),
  as a clickable relative-path markdown link.
- Where visibility or level placement depends on tenant config you cannot
  verify, mark it **unverified** or *inferred* in its own column. Never fill a
  gap with a plausible guess — an explicit "not found in any of the 534 routes"
  is a better answer than an invented destination.
- Prefer reading route files and guards over inferring from folder names.
- State the read/swept split honestly per cluster; do not imply depth you did
  not reach.
- Do not modify application code. Documentation only.

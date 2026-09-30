# PART 01 — Authentication, Roles, Menus & Navigation (cross-cutting session/guard behaviour)

Repo: `D:\lms_k12` (Next.js 16.2.6 / React 19.2.4, `package.json:56-57`) + backend `D:\next_lms_erp` (read-only).
Prefix: `AUTH`. Author: audit agent part01. Method: static reading only. Nothing was executed against a server or database.

Method disclosures (honesty notes):
* To enumerate Laravel routes and their *effective* middleware I bootstrapped the Laravel kernel with a throw-away PHP script (in the scratchpad, not in either repo) and iterated `app('router')->getRoutes()` (5,455 routes). The script issued no queries of its own; whether service providers connected to the DB lazily is `NOT VERIFIED`. `php artisan route:list` is known-broken (memory: `gotcha_artisan_tooling_quirks`), so this was the only way to get gathered middleware.
* I deliberately did **not** query `tblmenumaster`, `tblgroupwise_rights` or `tbluserprofilemaster`: the configured MySQL host is a remote machine, not localhost, and the brief forbids touching network/production. Every statement about live menu rows, live rights rows or live profile names is therefore `NOT VERIFIED` and is derived from migrations, seeders, code and docs.
* No `.env*` file was read. Live env values (`JWT_TTL_MINUTES`, `JWT_SECRET`, `LMS_API_AUTH_ENFORCE`, `CORS_ALLOWED_ORIGINS`, `APP_URL`, Google client id) are `NOT VERIFIED`.
* Another agent already reports on `app/api/**` (see `part02-next-api-routes.md`, findings NAPI-xx). Where this report touches the same code I cross-reference instead of duplicating; the `x-laravel-base-url` header trust is restated here only for the parts that matter to auth/roles (AUTH-14).

---

## 1. Scope & coverage

| Area/dir | Files in scope | Read fully | Skimmed | Not reviewed | Notes |
|---|---|---|---|---|---|
| `app/login` | 1 (608 lines) | 1 | 0 | 0 | Includes the ForgotPasswordModal that lives in the same file |
| `app/forgot-password` | 1 | 1 | 0 | 0 | Dead page when logged out (AUTH-28) |
| `app/api/forgot-password`, `app/api/google-auth` | 2 | 2 | 0 | 0 | Also covered in part02 |
| `components/auth` | 1 (`gtg-auth.tsx`) | 1 | 0 | 0 | Thin shim over `useAuth` |
| `contexts` | 2 | 1 (`AuthContext.tsx`, 406 lines) | 0 | 1 (`PageAiContext.tsx`) | AI page context; not auth |
| `lib/session` | 1 (`internal-access.ts`) | 1 | 0 | 0 | Its referenced `internal-access.test.ts` does not exist (AUTH-33) |
| `lib/erp-client.ts`, `lib/erp-legacy.ts`, `lib/laravel-context.ts` | 3 | 3 | 0 | 0 | Session/JWT plumbing used by 251 files |
| `app/components/utils` (`api_url.tsx`) | 1 | 1 | 0 | 0 | |
| `app/mobile-bridge`, `app/mobile`, `app/onboarding` | 3 | 3 | 0 | 0 | `app/mobile/custom/[slug]/page.tsx` read in full |
| `lib/users`, `lib/consent` | 2 | 0 | 2 (header comments only) | 0 | AI-stack descriptors, no auth logic |
| `app/user` | 7 | 1 (`api.ts`) | 1 (`add_user/page.tsx`) | 5 | Rights come from server (`permissions()`), see AUTH-34 |
| `app/user_log` | 2 | 1 (`api.ts`) | 0 | 1 (`page.tsx`) | |
| `hooks/` | 6 | 1 (`use-sidebar-navigation.ts`) | 0 | 5 | The other 5 are AI/voice hooks, not auth |
| `app/hooks` | 2 | 2 (`useMenuRights.ts`, `usePermission.ts`) | 0 | 0 | |
| `app/data` | 5 | 3 (`menuItems`, `menuMappers`, `moduleDashboards`) | 1 (`routeMapper.ts`, 1172 lines, ~55% read) | 1 (`menuSearch.ts`) | Menu -> route mapping; targets verified programmatically |
| `app/lib/routes.ts` | 1 | 0 | 1 | 0 | Stale route registry (AUTH-13) |
| `app/modules` | 5 | 0 | 2 (`module-routes.ts`, `[categoryKey]/page.tsx`) | 3 | |
| `app/api/modules`, `lib/laravel-category-proxy.ts` | 3 | 0 | 2 | 1 | |
| `components/shell` | 1 | 0 | 0 | 1 | Icon glyph only |
| `app/components` (shell chrome) | 19 | 2 (`ConditionalApp`, `DashboardShell`, 872 lines) | 2 (`Header`, `Sidebar` via targeted reads/greps) | 15 | `Level3Subheader`, `HeaderMenuSearch`, `ChatbotPanel`, etc. not read line by line |
| Other frontend files read for this scope | — | `app/layout.tsx`, `app/page.tsx`, `next.config.ts`, `lib/app-version.ts`, `lib/gtg-roles.ts`, `lib/gtg-org-data.ts`, `app/api/proxy/route.ts`, `app/api/proxy-file/route.ts`, `lib/agents/acting-user.ts`, `app/lms/_shared/RequireStaff.tsx`, `app/dashboard/_lib/resolveDashboardRole.ts`, `app/pal/data/pal-view-as.ts`, `lib/ai/adapters/shared-utils.ts` | `app/documents/_lib/document-access.ts`, `lib/roadmap/index.ts` | — | |
| Docs verified against code | 5 | `menu-data-source-audit.md`, `student-menu-report.md` | `teacher_role_audit.md`, `admin-user-journey.md` (§1, §8), `teacher-user-journey.md` (grep only) | `admin-user-journey-PROMPT.md`, `teacher-user-journey-PROMPT.md`, `user-journey/*` | See AUTH-33 |
| Laravel: auth/middleware | — | `ApiLoginController`, `MenuRightsController`, `ApiSessionHydrator` + `HydratesLegacyApiSession`, `SessionMiddleware`, `checkPermission`, `RequireStaffRole`, `RequirePermission`, `PalApiAuth`/`LmsApiAuth`/`RequireLmsStaff` (heads), `Kernel.php`, `VerifyCsrfToken`, `ForgotPasswordController`, `MobileWebHandoffApiController`, `UserManagementApiController`, `RolePermissionsController` (head), `CkeditorFileUploadController`, GenTux `JwtToken`/`FirebaseDriver` in `vendor/` | `loginController`, `LogRouteMiddleware`, `EmployeeDirectoryController`, `RoleDashboardApiController`, `DocumentTemplateApiController`, `Leave/*` concern, `GroupwiseRightsApiController` | remaining ~600 controllers | Route census below is mechanical |

**Totals (frontend scope):** ~62 files in named directories; ~34 read fully, ~9 skimmed, ~19 not reviewed (all listed above). 679 real `page.tsx` route files (680 by the brief's glob; `app/task-management/administration/integration/components/integration-provider-config-page.tsx` matches the glob but is not a route), 92 top-level dirs under `app/` (docs say 54 / 81).

**Laravel route census (from the bootstrapped router):**

| Protection (effective middleware) | Routes |
|---|---|
| Total registered | 5,455 (`api/*`: 1,683, everything else: 3,772 incl. vendor/livewire/log-viewer) |
| `web,session,...,check_permissions` (JWT-hydrated when `type=API`; rights table check) | 3,184 contain `check_permissions` |
| `api.session` (verified JWT -> hydrated session) | 1,084 (of which `+staff.only` 583, `+check_permissions` ~14) |
| `pal.auth` (JWT + learner ownership) | 169 |
| `McpAuth` (AI/MCP) | ~98 |
| `brain.auth,brain.tenant,brain.permission` | 93 |
| `lms.auth` (+`perm:`; **warn-only unless `LMS_API_AUTH_ENFORCE`**, default false: `config/lms_content.php:144`) | 28 |
| `api` group only (`throttle:1000,1`), i.e. **no route-level auth** | **328** — heuristic scan of their controllers: 131 validate the JWT inside the controller (directly or via a trait/concern), **195 have no JWT code at all**, 2 are closures |
| `web` only (no `session`), app-defined (excluding livewire / log-viewer / ignition) | ~425 |

---

## 2. Module inventory (your scope)

| Module | Backend (Laravel controller/route or Next api) | Frontend pages/components | DB tables (if traced) | API endpoints | Permissions/roles | Menu entry | Status |
|---|---|---|---|---|---|---|---|
| Email/password login | `ApiLoginController@login` (`routes/api.php:88`, no throttle, no audit write) | `app/login/page.tsx`, `AuthContext.login` | `tbluser`, `tblstudent`, `tbluserprofilemaster`, `tblindividual_rights`, `tblgroupwise_rights`, `tblmenumaster`, `academic_year`, `school_setup`, `tblclient` | `POST /api/api-login` | none (pre-auth) | n/a | Mostly complete; see AUTH-07..09 |
| Google login | **No Laravel route** (`grep google-auth` over `routes/` and `app/` = nothing); Next proxy `app/api/google-auth/route.ts` | Button on `app/login/page.tsx` | — | `POST /api/google-auth` -> `{base}/api/google-auth` (404) | — | n/a | **Broken** (AUTH-25) |
| Forgot / reset password | `ForgotPasswordController` (web routes `forget-password`, `reset-password`) | Modal in `app/login/page.tsx`; `app/forgot-password/page.tsx` (redirect-only) | `password_resets`, `tbluser` | `POST /api/forgot-password` (Next) -> `POST /forget-password` (Laravel web) | none | n/a | Partially complete (AUTH-15) |
| Session / idle / daily reset / logout | none (JWT is stateless; no logout endpoint) | `AuthContext.tsx`, `lib/app-version.ts` | localStorage `auth`,`menuContext`,`userData`,`sessionDate` | — | — | Avatar menu -> Logout | Partially complete (AUTH-07, 19, 20) |
| Mobile WebView handoff | `MobileWebHandoffApiController@create/claims` (`routes/api.php:97,106`) | `app/mobile-bridge/page.tsx`, `AuthContext.loginFromHandoffTicket`, `ConditionalApp` `FULL_BLEED_ROUTES` | `mobile_web_handoff_token` | `GET /api/mobile/web-handoff/claims?ticket=` | ticket single-use, 60 s | n/a | **Broken on the Next side** (AUTH-12) |
| Mobile custom pages | `MobilePageBuilderAdminApiController` (admin gate: `is_admin>=1` or profile admin/super admin) | `app/mobile/custom/[slug]/page.tsx` | mobile page builder tables (not traced) | `/api/proxy?path=api/mobile-page-builder/runtime/{slug}` and admin-authored action endpoints | viewer's own token | via handoff | Depends on AUTH-12; arbitrary-endpoint action model (AUTH-23) |
| Menu / navigation shell | `MenuRightsController@getMenuRightsLevelWise`, `@getMasterMenuApi` (**unauthenticated**) | `DashboardShell`, `Sidebar`, `Header`, `Level3Subheader`, `useMenuRights`, `menuMappers`, `routeMapper` | `tblmenumaster`, `rightside_menumaster`, `tblgroupwise_rights`, `tblindividual_rights`, `fees_menu_categories*` | `POST /api/menu-rights`, `GET /api/master-menu-rights`, `GET /api/modules/menu-categories[/registry]` | rights rows per profile (tenant data) | is the menu | Complete UI; **unsafe backend** (AUTH-01, 18) |
| Module category bars | `ModuleMenuCategoryApiController` (`api.session`+`check_permissions`) | `app/modules/[moduleKey]/[categoryKey]`, `app/_lib/use-module-level3-nav.ts` | `fees_menu_categories`, `fees_menu_category_items` (seeded for 62 modules: `2026_09_17_100001`) | `GET|POST /api/modules/menu-categories` | rights | seeded rows | Complete |
| Enterprise Brain nav injection | `brain.*` middleware on `api/brain/*` (93 routes) | `DashboardShell.tsx:325-357`, `lib/brain/navigation.ts` | — | `GET /api/brain/access` | client substring rule OR server answer | injected client-side | Mostly complete (AUTH-17) |
| Role dashboards | `RoleDashboardApiController@adminSummary/teacherSummary/studentSummary` (`api.session` + in-controller role check) | `app/dashboard/page.tsx`, `resolveDashboardRole.ts` | many | `POST /api/{admin,teacher,student}-dashboard/summary` | admin: `is_admin 1/2`, or profile `parent_id=1`, or name in {super admin, admin, school admin}; else 403 | landing page | Complete; unknown profiles get the admin UI then a 403 |
| Module dashboards (Admissions/Students/Library/Hostel/Transport) | `*DashboardApiController@summary` — **no auth** (`routes/api.php:139-143`) | `app/api/*/dashboard/summary` proxies + pages | many | `POST /api/{admissions,students,library,hostel,transportation}-dashboard/summary` | none | `MODULE_DASHBOARD_ROUTES` | Complete UI; unauthenticated backend (AUTH-05) |
| User master | `UserManagementApiController` (in-controller JWT + rights) | `app/user/add_user`, `app/user/api.ts` | `tbluser`, `tbluserprofilemaster` | `GET|POST /api/users[/{id}]`, `POST /api/users/{id}/deactivate` | rights of `add_user.index`; admin names | menu | Complete; stores `plain_password` (AUTH-09) |
| User profiles (roles) | same controller | `app/user/add_user_profile`, `api.ts` | `tbluserprofilemaster` | `GET|POST /api/user-profiles[/{id}[/delete]]` | rights of `add_user_profile.index` | menu | Complete |
| User report / User log (Audit) | `UserManagementApiController@report*`, `UserLogReportApiController` | `app/user/user_report`, `app/user_log` | `access_log_route` | `/api/user-reports/*`, `/api/user-logs/*` | rights | Audit module | Partially complete: SPA calls are never logged (AUTH-21) |
| Access-rights admin (group/individual/mobile) | `GroupwiseRightsApiController`, `IndividualRightsApiController`, `MobileAppMenuRightsApiController`, `RolePermissionsController` | `app/general/*_rights`, `app/organization-management/role-and-permissions` (outside my dirs; located via docs) | `tblgroupwise_rights`, `tblindividual_rights` | `/api/groupwise-rights`, `/api/individual-rights`, `/api/mobile-app-rights/*`, `/api/organization-management/role-permissions/*` | JWT + actor rights; RolePermissions: `is_admin` or profile name **exactly** `Admin` | avatar dropdown (unconditional) | Complete; inconsistent admin definitions (AUTH-17) |
| Employee directory / HR org data | `EmployeeDirectoryController` (`api.session` only) | `app/organization-management/*` | `tbluser` | `/api/organization-management/employee-directory[/{id}]` | none beyond a bypassable self-scope | menu | **Data-exposure bug** (AUTH-03) |
| Route registry | — | `app/lib/routes.ts` (used by `admin-services`, `Utility` pages) | — | — | — | — | Stale/dead result paths (AUTH-13) |

Flags:
* **Backend-without-UI:** `credentials()` in `ApiLoginController` (lists every active staff and student in the estate; admin-only check `is_admin >= 1`) has no route in the dump — dead code; `Route::post('login_hills'…)`, `teacherlogin`, `check_otp` legacy mobile logins have no Next UI.
* **UI-without-backend:** Google sign-in (AUTH-25).
* **Menus/links pointing at missing pages:** 36 `RESULT_ROUTE_NAME_MAP` keys -> 31 non-existent `/result/*` pages (AUTH-13). `/forgot-password` exists but is unreachable pre-login (AUTH-28).
* **Duplicate modules under different names:** `app/organization-management` vs `app/organization_managment` (docs already note); `app/student` vs `app/students`; `app/exam` vs `app/result` vs `app/lms/exam`; three near-identical `isAdminOrHrProfile` copies (`components/domain/lms/assignments`, `.../sessions`, `app/talent-management/recruitment`).

---

## 3. Role / access-control findings (per module: frontend gating vs backend enforcement)

### 3.1 How identity and role actually work (traced)

1. **Login** (`ApiLoginController::login`, `routes/api.php:88`): email + password. Staff row (`tbluser`) first, then student row (`tblstudent`); staff wins when an email exists in both. Password is checked by `verifyAndUpgradePassword()` — `Hash::check` then legacy plaintext (staff) / md5 (students), then re-hashed. Requires `status='1'`. Returns a GenTux JWT (HS256, secret from `JWT_SECRET`, min 32 chars enforced by the vendored `JwtToken::secret()`), payload = `{id, sub_institute_id, is_admin, client_id, user_profile_id, is_student}` plus `iat/exp` **only if `JWT_TTL_MINUTES>0`** (`ApiLoginController.php:426-434`; default 0 = never expires; not in `.env.example`). The response also carries `user_profile` (name), `erp_rights` (menu ids), `host_name = env('APP_URL')`, PII.
2. **Roles that exist in code** (there is no role enum; roles are `tbluserprofilemaster.name`, tenant-authored free text, plus two flags):
   * `is_admin = 2` — multi-client platform super admin. Login hardcodes tenant sets for it: `school_setup` ids `[254,195,47,72,1]`, client ids `[2,11,20,34,81]` (`ApiLoginController` lines ~186-245).
   * `is_admin = 1` — client/institute admin. `HydratesLegacyApiSession` stamps `user_profile_name = 'Super Admin'` for both 1 and 2, which makes `checkPermission` skip all rights checks for them.
   * Admin-tier profiles: names seen in code — `Admin`/`ADMIN`/`admin`, `School Admin`/`SCHOOL ADMIN`, `College Admin`/`collage_admin`, `Principal`, `Vice Principal`, `Management`, `HR`, `HR Admin`, `HR Manager`, `Assistant admin`. Structurally, admin-tier = profile whose `parent_id = 1` (used only by `PalApiAuth`, `RoleDashboardApiController`).
   * `Teacher`/`TEACHER`/`LMS Teacher`; class-teacher scoping via `class_teacher` table, hydrated for name `== 'Teacher'` exactly.
   * `Student`/`student`/`STUDENT` (`is_student=true`, `tblstudent`).
   * `Parent` (a `tbluser` row; blocklisted by `staff.only` by *name*, not by flag; no parent portal exists in this frontend — `docs/student-menu-report.md`).
   * Any other tenant profile (Accountant, Librarian, Clerk…): treated as "other staff".
3. **Frontend role state is client-editable.** `AuthContext.persistLoginPayload` writes the whole login payload (incl. `user_token`, `is_admin`, `user_profile`, PII) to `localStorage.userData`; `menuContext` (`user_profile_name`, `user_profile_id`, ids) and `auth` likewise. All role helpers read these keys (10+ divergent implementations, AUTH-17).
4. **Route protection (frontend).** No `middleware.ts`/`proxy.ts`. `app/layout.tsx` wraps everything in `AuthProvider` -> `ConditionalApp` (`app/components/ConditionalApp.tsx:44`): `isAuthenticated` is simply "localStorage key `auth` exists" (`AuthContext.tsx:52-53`). If false, **`<LoginPage/>` is rendered instead of `children`, at whatever URL was requested**; if true `DashboardShell` renders `children` for *any* URL. None of the 10 `layout.tsx` files checks auth or role. So there is exactly one guard: "has the key". Role gating is per page and cosmetic (below).
5. **Backend enforcement layers** (what actually decides): (a) `api.session` — valid JWT, tenant/user/profile from the token; (b) `check_permissions` — `tblmenumaster.link == route name` then `tblindividual_rights`/`tblgroupwise_rights`; **bypassable and fail-open (AUTH-02)**; (c) `staff.only` — rejects only `is_student` or profile name `student`/`parent`; (d) in-controller checks (JWT + rights or admin name lists) in ~13 headless controllers; (e) `pal.auth`, `brain.*`, `McpAuth`, `lms.auth`+`perm` (warn-only by default); (f) **nothing** for ~195 API controllers and ~425 web routes.

### 3.2 Frontend guards that exist (complete list found)

| Guard | Where | What it checks | Cosmetic? |
|---|---|---|---|
| `RequireStaff` | 29 pages: `app/lms/{book-list,curriculum-planning,global-mapping,homework/*,leader-board-master,lesson-plan,lmsAnnotate_assignment/*,lmsAssignment,lmsProject,lmsWorksheet,lms_teacherResource,monthly-plan,question-wise-report,reports,student-analysis/*,syllabus-plan,teacher-dashboard,teacher-diary,teacher-timetable}`, `app/documents`, `app/fees/teacher-dues`, `app/student/my_icard` | `isStudentSession()` = localStorage profile name **exactly** `student` (`app/pal/data/pal-lookups.ts:39-41`); redirects to `/lms/dashboard` | Yes — localStorage edit defeats it; `Parent`/`Accountant` pass |
| `resolveDashboardRole` | `app/dashboard/page.tsx` | name in {teacher, lms teacher} / {student} / {super admin, admin, school admin}; **anything else -> admin dashboard** (`resolveDashboardRole.ts:21`) | Yes (backend does 403) |
| Documents allowlist | `app/documents/_lib/document-access.ts`, `Header.tsx:659` | name allowlist incl. hr*, principal | Yes; backend `DocumentAggregationController` has its own admin check (`api.session`) |
| Enterprise Brain | `DashboardShell.tsx:62-85` `isBrainVisibleByLmsSession()` OR `/api/brain/access` | `is_admin` 1/2, `user_profile_id===1`, name **contains** admin/principal/management | Yes for the menu injection; `brain.*` middleware enforces the API |
| Internal roadmap | `lib/roadmap/index.ts:219` `canSeeInternalItems()` = build flag `NEXT_PUBLIC_SHOW_INTERNAL_ROADMAP`; `platform-administration`, `platform-roadmap`, `enterprise-brain/governance` | build flag, **not a role** | n/a |
| "Master" button hidden | `DashboardShell.tsx:101-114, 809` `isStudentSession()` (substring `student`) | student only | Yes |
| Server-driven rights in-page | `app/user/*` (`permissions()` from the API, `rights.add/edit/delete`) | server answer | No — this is the correct pattern |
| Sidebar menu | rights-filtered by `/api/menu-rights` | server answer for a **client-supplied** identity (AUTH-18) | menu only |

Avatar dropdown (`Header.tsx`, Platform Setup / Platform Services / AI & Intelligence, incl. RBAC `/organization-management/role-and-permissions`, `/general/mobile_app_rights`, `/general/fields_configuration`, all 12 AI screens) is rendered for **every** signed-in profile; only the "Document" entry is filtered (`Header.tsx:659`). `docs/admin-user-journey.md` §8.1 says there is no role check at all — now stale by exactly that one entry.

### 3.3 Role x module x action matrix

Legend — cell content is "how a user of that role reaches the module / what stops them".
* **Menu** = shown only if the tenant's `tblgroupwise_rights`/`tblindividual_rights` grants the menu (live rows `NOT VERIFIED`; student/teacher seed migrations exist, see 3.5).
* **URL** = page renders by typing the URL (no frontend guard). **RS** = `RequireStaff` (blocks only profile name `student`).
* Backend classes: **PERM** = `check_permissions` (rights table; **bypassable with `submit=Search`**, fail-open when no menu row — AUTH-02); **SESS** = `api.session` only (any valid token, any role); **STAFF** = `api.session`+`staff.only` (blocks Student/Parent only, every other profile incl. Teacher passes); **CTRL** = in-controller JWT + rights/admin-name check; **PAL/BRAIN/MCP/LMSAUTH** as named; **NONE** = no authentication, tenant read from request.
* Action columns are collapsed into the cell text (view / add / edit / delete): PERM enforces all four per rights row (except when bypassed); SESS/NONE enforce none; STAFF/CTRL as stated.

| Module (sidebar/route family) | Student | Parent | Teacher / other staff | Admin-tier (profile `parent_id=1`, Principal…) | `is_admin` 1/2 (Super Admin) | Frontend gate | Primary backend gate (Laravel) |
|---|---|---|---|---|---|---|---|
| Dashboard `/dashboard` | Student dashboard; admin/teacher APIs 403 | UI shows **AdminDashboard**, API 403 (broken UX) | Teacher dashboard (unknown staff -> admin UI, 403) | Admin dashboard | Admin dashboard | `resolveDashboardRole` (localStorage) | `api.session` + in-controller role check (`RoleDashboardApiController.php:26-38, 45-56`) |
| Module dashboards: Admissions, Students, Library, Hostel, Transportation | Menu / URL; **API open to anyone** | same | same | same | same | none | **NONE** — `POST /api/*-dashboard/summary`, tenant from body (`routes/api.php:139-143`) |
| Fees (collect, master, reports, circulars, dashboard) | Menu only if granted (student seed grants view of own fee pages) | Menu | Menu | Menu | bypass all rights | none (`fees/teacher-dues` RS) | **PERM** via `/api/proxy` (+ `api.session,check_permissions` on `fees/*` JSON) — cross-tenant leak in `fees/audit_logs` (AUTH-11) |
| Students (add/search/bulk/IDs/health/reports) | Menu; URL | Menu | Menu | Menu | bypass | none | **PERM** (legacy web via proxy) |
| Admissions (form, follow-up, registration) | URL | URL | Menu | Menu | bypass | none | **PERM** (web) **and NONE** for `api/admission_enquiry|online_admission_confirm|admission_registration` CRUD incl. DELETE (AUTH-05) |
| Attendance (student/staff) | Menu (own view seeded) | Menu | Menu | Menu | bypass | none | **PERM** (web). HR attendance `api/attendance/*`: JWT in trait, **no role check**, `user_id` from body (AUTH-10) |
| Exam (creation, master, marks entry, online exam, progress) | Online-exam pages check student; staff pages: URL | URL | Menu | Menu | bypass | none for `/exam/exam-creation|exam-master|marks-entry|progress-report` | Legacy **PERM**; new `/api/result/*` = **SESS** (181 routes, no role/rights check — AUTH-10) |
| Result (report cards, masters, CBSE) | URL | URL | Menu | Menu | bypass | none | **SESS** (`resultapi.php:52`), `MarksEntryApiController` delegates to legacy controller **skipping** `check_permissions` (AUTH-10). Menu mapping dead (AUTH-13) |
| LMS teacher pages (homework, assignments, planning, reports) | **RS redirect** (cosmetic) | URL (RS passes non-`student`) | Menu | Menu | bypass | `RequireStaff` (29 pages) | Mixed: **STAFF** for review/annotate; **NONE** for `lms-homework/*`, `lms-courses*`, `lms-question-bank*`, `lms-chapter*` (AUTH-05); write routes `lms.auth`+`perm` are **warn-only** (`LmsApiAuth`, `RequirePermission`) |
| LMS student pages (submission, leaderboard, doubts) | Menu | URL | Menu | Menu | bypass | none | **SESS** (submission/leaderboard); homework submission legacy **NONE** |
| Course Master / Chapters / Question bank / Teach-Learn | URL | URL | Menu | Menu | bypass | none | **NONE** + `lms.auth` warn-only (`routes/api.php:191-262`); question-paper CRUD **NONE** (AUTH-05) |
| PAL / New PAL | Own data (view-as is staff-only in UI) | URL | Menu (class-scoped) | Menu (institute-scoped) | client/platform scoped | `isStudentSession()` for view-as; **no route guard** | **PAL** = `pal.auth` (169 routes): JWT + learner/tenant ownership — strongest control in the estate |
| H5P (content + players) | Players menu | URL | Menu | Menu | bypass | student checks on authoring lists | Not traced (`NOT VERIFIED`; mostly `/api/pal/h5p`, `lms/*`) |
| HRIT: leave, attendance, payroll | URL | URL | Menu (own leave) | Menu | bypass | none | Leave/attendance: JWT (trait) + **no role check** — any token can `POST leave/requests/{id}/decision`, `PUT leave/workflow|roles|leave-types|holidays` (AUTH-10); payroll legacy **PERM** |
| Talent / Task / Competency / Performance / Onboarding / G2G-LMS (`api/talent|task-management|competency|performance|onboarding|mobility|offboarding|g2g-lms`) | **403** (`staff.only`) | **403** by name | **Allowed** (any staff profile, incl. Teacher) | Allowed | Allowed | none | **STAFF** (583 routes) — a blocklist, not RBAC (`RequireStaffRole.php` docblock) |
| Organization management: employee directory, compliance, disciplinary | Menu/URL; **API open to any token** | same | same | same | same | none | **SESS** only (54 routes); `index()` self-scope disabled by `?menu_type=`; `show()` returns full `tbluser` row (AUTH-03) |
| Role & permissions (RBAC editor) | URL | URL | URL | Menu | Menu | avatar dropdown, unconditional | **CTRL** `assertIsAdmin()`: `is_admin` or name `=== 'Admin'` exactly (`RolePermissionsController.php:63-78`) |
| User master / profiles / reports | Menu if granted | same | same | same | bypass | server-driven `rights` object | **CTRL** JWT + rights of `add_user.index` / `add_user_profile.index`; admin = name in {admin, super admin} |
| Access rights (group-wise, individual, mobile-app) | URL | URL | URL | Menu | Menu | dropdown (group/individual commented out, mobile rights visible) | **CTRL** JWT + actor rights (`GroupwiseRightsApiController.php:40-130`) |
| Audit / User log | Menu if granted | same | same | same | bypass | none | **CTRL** JWT + rights `user_log.index`; **SPA activity is never written** (AUTH-21) |
| Communication (easy_com: SMS/email/WhatsApp/notification, SMTP & SMS-gateway config) | URL, **API open to any token** | same | same | same | same | none | **SESS** only (`easycomapi.php:32`, 36 routes, no rights/role check in `BaseEasyComApiController`) (AUTH-10) |
| Front desk, petty cash, complaints, consent, PTM, teacher transfer | Menu if granted | same | same | same | bypass | none | **CTRL** (JWT + tenant match + rights) for the headless controllers; legacy **PERM** |
| Inventory, Transportation setup, General/Academic setup, Class teacher, Custom fields | Menu if granted | same | same | same | bypass | none | **CTRL** (JWT + `authorizeModule`); legacy **PERM** |
| Document templates (`/document-templates`, certificates) | URL | URL | Menu | Menu | bypass | none | **NONE** — `DocumentTemplateApiController` decodes the JWT **without verifying the signature** and falls back to request params (AUTH-06); merge-data/preview-students expose student rows |
| Documents module (aggregated documents) | Hidden (Header) | Hidden | Hidden unless hr/principal name | Visible | Visible | `canAccessDocuments()` allowlist (cosmetic) | `api.session` + `denyUnlessAdministrator()` in controller (verified present) |
| Platform services (workflow, notification, scheduler, event bus) | URL | URL | URL | Menu | Menu | none (dropdown unconditional) | **LMSAUTH** (+`lms.staff` on event bus; `perm:` **warn-only** unless `LMS_API_AUTH_ENFORCE`) |
| Enterprise Brain (`/enterprise-brain/*`) | Not injected | Not injected | Not injected unless name contains admin/principal/management | Injected | Injected | substring rule OR `/api/brain/access` | **BRAIN**: `brain.auth,brain.tenant,brain.permission:*` (93 routes) |
| AI & Intelligence, assistant, MCP tools | URL (dropdown unconditional) | URL | URL | URL | URL | none | **MCP**: `McpAuth,McpRateLimit,McpContextHydrator` (~98 routes) |
| Mobile page builder (admin authoring) | URL | URL | URL | Menu | Menu | none | `api.session` + in-controller admin check (`MobilePageBuilderAdminApiController.php:44-51`) |
| Migration modules, compliance, class-teachers, academic-setup JSON (`migration-modules/*`, `compliance/*`) | API open | open | open | open | open | none | **NONE** for `migration-modules/*` and `compliance/*`; **CTRL** for `class-teachers`, `academic-setup` |

Key cross-cutting statements the matrix supports:
* **Frontend hides, API stays callable** — confirmed for: module dashboards, admission/enquiry CRUD, question-paper CRUD, LMS homework/course/question-bank, document templates, `/api/result/*`, easy_com, org-management/HR data, leave/attendance workflows, migration-modules/compliance.
* The **only** controls that combine identity + tenant + role correctly end to end are `pal.auth`, `brain.*`, `McpAuth`, and the ~13 in-controller `context()` implementations (`UserManagementApiController`, `GroupwiseRightsApiController`, …).
* `staff.only` is not RBAC: a Teacher reaches Talent/Task/Competency/Performance/Onboarding/Offboarding/G2G-LMS admin endpoints.

### 3.4 Effective-permission gaps in `check_permissions` (`app/Http/Middleware/checkPermission.php`)
1. `line 76`: the entire rights evaluation is wrapped in `if (!Str::contains($request->submit, 'Search'))` where `$request->submit` is any client-supplied input (AUTH-02).
2. `line 44`: `if ($menu_id != '')` — a route whose **name** matches no active `tblmenumaster.link` row is not checked at all (fail-open). Missing rights row => `$can_view=0` => denied only when a menu row exists.
3. Allowlists by menu id (`82,386` for update, `200` for delete) hardcoded and environment-specific (the `rbac_modules.php` docblock says the same).
4. Rights are keyed on `user_profile_id` **from the token**: a role change or profile re-assignment is invisible until the user logs in again (no revocation, AUTH-07).
5. Path-substring matching (`'delete'|'destroy'|'update'|'store'|'add'|'save'` in `request()->path()`) decides which right applies; anything else falls to the HTTP method (POST => `can_add`).

### 3.5 Student / teacher seed grants (migrations, not live data)
`2026_08_25_150000_grant_student_role_full_workflow_rights`, `…150100`, `…150200`, `…160000`, `…170000` seed per-tenant `Student` profile rights by `tblmenumaster.link` (view-only for own fees/attendance/documents; add for homework/assignment submission; `can_edit`/`can_delete` never granted). `NewLMS_ApiController::INSERT_RIGHTS` hardcodes all four flags to 1 for every provisioned profile incl. Student (per `docs/admin-user-journey.md` §8.5; not re-read by me). Live state `NOT VERIFIED`.

---

## 4. Tenant / school / academic-year scoping findings

| Question | Finding | Evidence |
|---|---|---|
| Does the client send `sub_institute_id`, `syear`, `user_id`, `term_id`? | Yes, on every call: `appendCommonParams()` (`lib/erp-client.ts:190-203`), `buildQuery()`/`contextBody()` (`lib/erp-legacy.ts:99-118`), and again in bodies (`app/user/api.ts:63-66`). Values come from `localStorage` (`buildSessionContext`, `erp-client.ts:58-177`), including a user-selectable `selectedAcademicYear`. | 251 files use `buildSessionContext` |
| Trusted by the server? — verified-JWT routes | **Tenant/user/profile: no** — `HydratesLegacyApiSession` takes them from the verified token only (docblock lines 15-20; `hydrateSessionFromClaims`). **`syear`/`term_id`: yes** — `$request->input('syear'/'term_id')` overrides the current term (`HydratesLegacyApiSession.php` ~84-105), so a user can read any year of their own tenant. | trait |
| Trusted by the server? — controllers | **Often yes.** 641 controllers read `sub_institute_id` from request input (4,888 hits; 476 files read `session()`). On a session-hydrated route a request-supplied tenant still wins wherever the controller reads `$request->…` instead of `session()`. Concrete: `fees_audit_log_api_controller@index` filters `system_audit_logs` by `sub_institute_id` **only if the client sends one** — omit it and every tenant's fee audit log is returned (`fees/fees_audit_log_api_controller.php:33-48`; route `GET fees/audit_logs` = `web,session,menu,logRoute,check_permissions,api.session`). | AUTH-11 |
| Trusted by the server? — unauthenticated routes | **Fully.** ~195 API controllers and ~425 web routes take `sub_institute_id`/`user_id` from the body with no token (`StudentHomeworkApiController:22,115,290`, `ApiLmsCourseController:64,92,719`, `ExamEvaluationApiController:44…`, `admissionEnquiryAPIController:15`, `AdmissionsDashboardApiController`…). `LmsApiAuth` docblock itself calls this "the platform-wide auth surface… 170-odd unauthenticated routes". | AUTH-05 |
| `menu-rights` | Identity for the menu comes **only** from the request body (no token) and is user-editable in localStorage. | AUTH-01/18 |
| `host_name` trust | The ERP base URL for every subsequent call is `userData.host_name` (server-provided `env('APP_URL')`), unless `NEXT_PUBLIC_ERP_BASE_URL` overrides (`erp-client.ts:56, 139-142`). A tampered/mis-set `host_name` redirects the bearer token to another host (needs XSS or a mis-set `APP_URL`). | AUTH-30 |
| Client-level admins | `sub_institute_id = 0` users are rejected by `useMenuRights.isValidMenuContext` (needs truthy tenant) and by `hydrateSessionFromClaims` (`empty($subInstituteId)` -> 401); login does not remap the token to `$clientSubInstituteId`. | AUTH-18 |
| Tenant switch | The web `setinstitute` mechanism is not reachable from the SPA (docs §1.2c). Header offers only an academic-year/term switcher (`refreshAcademicTerms` -> unauthenticated `GET /api/academic-terms?sub_institute_id=&syear=`). | `AuthContext.tsx:343-365`; `ApiLoginController::academicTerms` |

---

## 5. API endpoints consumed or exposed

### 5.1 Consumed/exposed by the auth & menu scope

| Method | URL | Auth | Validation | Notes |
|---|---|---|---|---|
| POST | `{API_BASE_URL}/api/api-login` | none | `email:required|email`, `password:required` | Direct browser -> Laravel (CORS `*` default, `config/cors.php`). No throttle beyond `throttle:1000,1` per IP (`Kernel.php:47`); no failed-login log; 422 `Academic Term Date Expired` and 403 `Please Contact Administrator For ERP Rights` are tenant-wide login blockers |
| GET | `{API_BASE_URL}/api/academic-terms?type=API&sub_institute_id&syear` | none | none | Returns `academic_year` rows for **any** tenant |
| GET | `{API_BASE_URL}/api/mobile/web-handoff/claims?ticket=` | ticket (single-use, 60 s, sha256 stored) | ticket non-empty | Ticket in query string (server logs, Referer); returned JWT has **no `exp`** even when `JWT_TTL_MINUTES>0` (`MobileWebHandoffApiController.php:237-244`) |
| POST | `/api/menu-rights` | **none** | none — SQL injection (AUTH-01) | Body: `sub_institute_id,user_id,user_profile_name,user_profile_id,client_id` (never `is_admin`) |
| GET | `/api/master-menu-rights?menu_id&main_menu_id&type&sub_institute_id&user_id` | **none** | bound params | Reads any user's rightside menu |
| GET | `/api/permissions?modules=` | `lms.auth` (warn-only) | modules from `config/rbac_modules.php` | Advisory flags used by `usePermission` and `lib/agents/acting-user.ts` |
| GET|POST | `/api/modules/menu-categories[/registry]`, `/api/fees|teach-learn/menu-categories` | `api.session`+`check_permissions` | ids | Proxied by Next routes that forward client-supplied `x-*` headers |
| GET | `{BRAIN_API_BASE_URL}/api/brain/access` | `brain.auth` | — | `DashboardShell.tsx:304` |
| POST | Next `/api/forgot-password` -> Laravel `POST /forget-password` (web route) | none | Laravel: `email required|email|exists:tbluser,email`; Next: non-empty | Laravel route is on the `web` group (CSRF) — Next forwards without a token; `forget-password` is not in `VerifyCsrfToken::$except` (the `api/*` entry does not match); whether this works end to end is `NOT VERIFIED` (the Next proxy sends `Cookie` only if the browser had one) |
| POST | Next `/api/google-auth` -> `{base}/api/google-auth` | none | credential non-empty | Upstream route does not exist |
| POST | Next `/api/proxy?path=`, `/api/proxy-file?path=` (+GET/PUT/PATCH/DELETE for `/api/proxy`) | none at Next level; forwards `Authorization`+`Cookie` | `path` non-empty only | Generic relay to `API_BASE_URL/<path>`; `resolveTargetPath` strips leading `/` only |
| any | `/api/users*`, `/api/user-profiles*`, `/api/user-reports/*`, `/api/user-logs/*` via `/api/proxy?path=api/...` | JWT + in-controller rights | Laravel validators | Used by `app/user/api.ts`, `app/user_log/api.ts` |
| GET | `/api/mobile-page-builder/runtime/{slug}` + admin-authored `dataSource.endpoint` / `action.endpoint` via `/api/proxy?path=api/<endpoint>` | `api.session` | none on endpoint | `app/mobile/custom/[slug]/page.tsx:47-80` |

### 5.2 Laravel API controllers with **no JWT logic at all** (route middleware `api` only) — grouped

(From `an3` scan: controller file lacks `jwtToken`/`GetsJwtToken`/`HydratesLegacyApiSession`/`lms_auth` markers. Individual methods not re-read; a few may authenticate through a helper I did not recognise -> `NOT VERIFIED per method`.)

| Controller (routes) | Sample URIs |
|---|---|
| `MenuRightsController` (2) | `menu-rights`, `master-menu-rights` |
| `*DashboardApiController` (5) | `admissions-dashboard/summary`, `students-dashboard/summary`, `library-dashboard/summary`, `hostel-dashboard/summary`, `transportation-dashboard/summary` |
| `ApiLmsCourseController` (15) | `lms-courses`, `lms-chapters`, `lms-chapter-content`, `lms-question-bank/{create,update,delete,review}`, `lms-chapters/store`, `lms-store-subject` |
| `ApiQuestionBankController` (3), `ApiQuestionPaperController` (7), `QuestionPaperTemplateApiController` (6), `AssessmentBlueprintApiController` (10) | `question-paper` (index/store/show/update/**destroy** with no tenant predicate — confirmed also by `docs/admin-user-journey.md` §8.3), `question-paper-templates`, `assessment-blueprints` |
| `ExamEvaluationApiController` (12) | `exam-evaluation/batches`, `…/sheets/{id}/file`, `…/publish`, `DELETE …/sheets/{id}` |
| `StudentHomeworkApiController` (14), `LmsAssignmentApiController` (2) | `lms-homework/{list,store,update/{id},delete/{id},bulk-delete,students,…}`, `lms-assignment/bulk-delete` |
| `admissionEnquiryAPIController` (4), `onlineAdmissionConfirmAPIController` (5), `admissionRegistrationAPIController` (8) | `admission_enquiry` (GET/POST/PUT/**DELETE**), `online_admission_confirm/{id}`, `admission_registration/{id}`, `admission_student` |
| `LessonIntelligenceApiController` (11), `LessonPlanPeriodApiController` (3), `IntelligenceLessonPlanApiController`, `CurriculumPlanningApiController`, `MonthlyPlanApiController`, `LessonPlanDetailApiController`, `LessonPlanLookupApiController`, `SemanticIntelligenceApiController`, `ConceptIntelligence*` (5), `InteractionLogController` (3) | `lesson-intelligence/*`, `intelligence/*`, `interactions/*` |
| `DocumentTemplateApiController` (12) | `document-templates/*` (unverified JWT decode, AUTH-06) |
| `AiSopGenerationController` (4), `AiPlatformController`, `JobroleApiController`, `PedagogyEngineController` (4), `CertificationsRecordsController` (1), `Student*GraphController` (2), `WhatsappController` (4), 2 closures | `ai-sop/generate|store`, `pal/pedagogy-engine*`, `student-assessment`, `student-results/{id}/graph`, `whats-send-app` |
| `MigrationModulesApiController`, `instituteDetailController` (compliance) | `migration-modules/{module}` GET/POST/**DELETE**, `compliance/{list,create,update,delete}` — *listed in routes as no-auth by middleware; controller not opened (`NOT VERIFIED`)* |
| Leave/Attendance concerns | authenticated (trait), **no role check** (AUTH-10) — not in this list |

Legacy web routes with only `web` (no `session`) — categories: mobile-app APIs (`teacherapiController` 40+, `adminapiController` 45+, `lms_apiController` ~17, `student*API`/`teacher*API` ~40 e.g. `studentAttendanceAPI`, `allStudentListAPI`, `teacherStudentListAPI`, `add_students/store`), `admin_login`, `NewLMS_signup*`, `preload-institute`, `ckeditor` (AUTH-04), `import_*`, `ai/*` (Gamma/AI generation), `paraphrase*`, `chat`, `geminiAI`, `studentLists`, `ajax_*`, `student/api/{student_certificate,student_icard,teacher_icard}/*`, `lms/api/teacher_resource/*`, careers explorer, public policy pages. Full list is reproducible from the route dump; not row-by-row reviewed.

### 5.3 Next.js route handlers reachable without a login (there is no gate at Next level for `app/api/*`)
All 67 `route.ts` are reachable by anyone who can reach the Next host. Files whose source contains **no** `authorization|bearer` handling at all (33): `agents/{route,[id],[id]/run,runs}`, `conversational-ai/projects*` (3), `fees/{audit-logs,online-payments,receipt-reprint,reconciliation-status}`, `fees/reports/*` (15, via `fees-report-proxy.ts`, token forwarded from `x-laravel-token` header), `import/{match-fields,tables}`, `modules/menu-categories[/registry]`, `pal/{content-model,pedagogy-engine}`, `process/convert` (server-side LLM call, no auth, see part02), `forgot-password`, `google-auth`. Remaining 34 read a token header or `Authorization`. Detail and severities: `part02-next-api-routes.md`.

---

## 6. Business-logic notes (Input -> Validation -> Rule -> DB change -> Side effect -> Output)

**6.1 Login (SPA).** Input `{email,password,type}` -> `Validator` (email required/format, password required) -> staff lookup `where email & status='1'` -> `verifyAndUpgradePassword` (bcrypt; else plaintext/md5 legacy; on success re-hash & `save()`) -> student fallback -> profile lookup -> "rights menu ids" by branch chosen from `plain_password == 'student'` (!!) / `id === 1002` / `sub_institute_id 0 & is_admin 1` / default -> `0 rights` => 403 -> academic-term lookup (`BETWEEN start_date AND end_date`; none => 422 "Academic Term Date Expired") -> JWT -> JSON. DB change: password re-hash only. **No last-login write, no failed-login log, no lockout, no institute-expiry check** (`expire_date` is selected but never evaluated on the API path; the web path uses it for a setup redirect, `loginController.php:451`). FE: `AuthContext.persistLoginPayload` writes `auth`, `menuContext`, `userData` (incl. token), `sessionDate=UTC today`, recordBuildId, starts 30-min idle timer, clears TeachAssistant storage.

**6.2 Menu resolution.** `useMenuRights` POSTs the (client-supplied) identity to `/api/menu-rights` with **no Authorization header** -> controller picks a branch (`student` name / `sub_institute_id==0 && is_admin==1` (dead: `is_admin` never sent) / default) -> `GROUP_CONCAT(distinct m.id)` from individual+group rights joined to `tblmenumaster` -> three whereRaw queries with string-interpolated ids -> `{level 1/2/3}` -> `buildMenuTree` filters `status===1`, hides `HIDDEN_MENU_LINKS`, relabels `student_homework` -> "Exam", appends synthetic "Intelligence" level-3 rows, `mapApiLinkToRoute` maps `link` -> Next path (fallthrough: `'/' + link`) -> Sidebar. Enterprise Brain is appended client-side. `DashboardShell` auto-navigates to the first level-3 child when a level-2 is chosen (except PAL/Teach-Learn/Audit/Brain).

**6.3 Authorization on the legacy web routes used through `/api/proxy`.** Next `legacyRequest` -> `/api/proxy?path=<legacy route>&type=API&sub_institute_id&syear&user_id` + `Authorization: Bearer` -> Laravel `SessionMiddleware` (`type=API` => verify JWT, hydrate session, `merge(type=API)`) -> `MenuMiddleware` (returns early for API) -> `LogRouteMiddleware` (**skips API**) -> `checkPermission` (rights per menu row; see 3.4) -> controller (reads `session()` or `$request`).

**6.4 Forgot password.** Input `{email}` (Next requires non-empty; forwards `{user_email,email,type:'API'}`) -> Laravel `exists:tbluser,email` (422 if unknown — enumerates accounts; students live in `tblstudent` and can never reset) -> `Str::random(64)` inserted **without expiry** into `password_resets` (no purge of earlier tokens) -> mail -> link to a Laravel Blade page `reset-password/{token}/{email}` -> `submitResetPasswordForm`: `min:6|confirmed`, token equality only, `tbluser.password = <raw>` (**plaintext**, `ForgotPasswordController.php:110`), delete tokens for that email. Output JSON `{success}` (mail failure returns `$e->getMessage()`).

**6.5 Mobile handoff.** App -> `POST /api/mobile/web-handoff` (`api.session`) -> validates `web_url` (same host or CORS-trusted origin) -> inserts sha256(ticket) row, 60 s TTL -> WebView opens `https://<k12>/mobile-bridge?ticket=…` -> **`ConditionalApp` renders `LoginPage` instead of the bridge page (AUTH-12)** -> (intended) `GET claims` burns the ticket and returns an api-login-shaped payload + a fresh JWT.

**6.6 Idle/daily expiry.** Idle: per-tab `setTimeout(30 min)` reset by mouse/keyboard/scroll/touch on *that tab*; on fire it deletes the three auth keys from the **shared** localStorage. Daily: every 60 s compare `sessionDate` with `new Date().toISOString()` date (UTC) and wipe on mismatch. Logout: state clear + `purgeClientState()` (localStorage, sessionStorage, cookies, Cache Storage, service workers) + `location.replace('/')`; **no server call**, token remains valid.

---

## 7. Test / documentation coverage for your scope

* **Tests:** `npm test` runs only `lib/**/*.test.ts` and `packages/**/*.test.ts` (`package.json:11`). 42 test files exist; **none** cover `AuthContext`, `erp-client`, `erp-legacy`, `routeMapper`, `menuMappers`, `useMenuRights`, any role helper, or `RequireStaff`. `lib/session/internal-access.ts` claims to be pinned by `internal-access.test.ts` — that file does not exist (`git ls-files lib/session` = one file). Laravel side: no test found for `checkPermission`, `HydratesLegacyApiSession`, `MenuRightsController` (not exhaustively searched, `NOT VERIFIED`).
* **`docs/menu-data-source-audit.md`** (dated 2026-08-22): still correct that `app/data/menuItems.ts` is an empty array populated from the API, and that these are still fully static (no `fetch`/API import): `ai-platforms`, `chapters`, `subjects`, `students/{health_medical,discipline,house}`, `admissions/{admission_form,admission_followUp}`. **Stale:** `attendance/attendance_dashboard` now uses `buildSessionContext` (4 refs), `lms/reports` now has a `fetch` and a `RequireStaff`, `quiz/create` now calls `fetchQuizSubjects`, `students/ICards` now has an `api.ts`. "54 top-level menus under `app/`": actual 92 top-level dirs. Its statement that `/api/ai-platforms` is not used is consistent: a Laravel route `GET api/ai-platforms` exists but the page does not call it.
* **`docs/student-menu-report.md`** (2026-08-27): correct that the menu is server-driven and that `RequireStaff` calls `isStudentSession()`. **Incorrect/overstated:** section 2 says "every file below imports `RequireStaff` or is admin/teacher-only by content" — `/exam/exam-creation`, `/exam/exam-master`, `/exam/marks-entry`, `/exam/progress-report`, `/pal/new/administration`, `/pal/pedagogy-engine`, `/h5p/model` and the H5P authoring pages have **no** frontend guard (grep for `RequireStaff|isStudentSession|isStudentProfile` in `app/exam`, `app/pal`, `app/h5p` finds only student-view branching). `lmsProject`/`lmsWorksheet`/`homework/review` are guarded but not listed. File paths (`hooks/useMenuRights.ts`, `data/menuMappers.ts`) are imprecise (`app/hooks/…`, `app/data/…`).
* **`docs/teacher_role_audit.md`**: `resolveDashboardRole` sets at lines 3-5 and the default-to-admin at line 21 are accurate; `routeMapper.ts:474-873` (actual function `634-1160`) and `menuMappers.ts:192-249` line references are stale.
* **`docs/admin-user-journey.md`** (2026-09-14): "534 `page.tsx` across 81 top-level groups, Next.js 15" — now 679 / 92 / Next 16.2.6. §8.4 says `/api/menu-rights` is only an information-disclosure surface: **incorrect** — it is exploitable SQL injection (AUTH-01). §8.6 leaves open whether the admin dashboard endpoint refuses a non-admin token: **traced here — it does** (`RoleDashboardApiController.php:45-56`, 403). §8.1 (avatar dropdown has no role check): now stale for "Document" only. §8.2 table (which routes validate the JWT in-controller) matches my scan. §8.3 (`question-paper` fully open) confirmed.
* **`lib/session/internal-access.ts`** docblock says the shell, Platform Administration and Roadmap "all call this"; in fact only `ChatbotPanel.tsx` calls `canSeeInternalView()`; `DashboardShell` has its own copy (`isBrainVisibleByLmsSession`) and the roadmap screens use a build flag (`canSeeInternalItems`). The "one rule" claim is false (AUTH-17, AUTH-33).

---

## 8. NOT VERIFIED items

| Item | Reason |
|---|---|
| Live rows of `tblmenumaster`, `tblgroupwise_rights`, `tblindividual_rights`, `tbluserprofilemaster` (real menu tree, real role names, real grants per tenant) | DB host is remote; no DB access permitted. Hence "menus -> missing pages" for DB-defined links, and "pages not in any menu", could only be assessed for code-defined targets (see 8.1 below) |
| `JWT_TTL_MINUTES`, `JWT_SECRET` strength, `JWT_ALGO`, `LMS_API_AUTH_ENFORCE`, `CORS_ALLOWED_ORIGINS`, `APP_URL`, `NEXT_GOOGLE_CLIENT_ID`, `NEXT_PUBLIC_*` values, `SHOW_INTERNAL_ROADMAP` | `.env*` not readable by rule; defaults taken from code |
| Exploitability of AUTH-01 (SQLi) and AUTH-04 (upload -> PHP execution) | Not executed (no servers/requests allowed). SQLi is from code reading of string interpolation; upload execution depends on web-server handler config for `public/lms_editor_upload/` (`NOT VERIFIED`) |
| Per-method behaviour of the ~195 no-JWT API controllers and ~425 web-only routes | Scan is per controller file; many methods not opened. Some may authenticate through helpers I did not recognise |
| Whether the 641 request-reading controllers are reachable with a foreign tenant id on session-hydrated routes | Only `fees_audit_log_api_controller` and `feesReceiptBookMasterController` (safe: session first) sampled |
| Student self-data scoping (a student granted `student_fees_detail.index` etc. seeing only their own rows) | `tblstudentFeesDetailController` uses `$request->get('student_id')` in places; end-to-end not traced |
| Whether the K12 mobile app actually loads `lms_k12` in a WebView in production | Only the Laravel/Flutter-side comments say so |
| Whether `POST /forget-password` succeeds when called server-side from Next (CSRF, session) | `VerifyCsrfToken::$except` has no matching entry; not executed |
| Contents/behaviour of `app/user/*` pages other than `add_user` skim, `app/user_log/page.tsx`, `Level3Subheader`, `HeaderMenuSearch`, `menuSearch.ts`, `use-module-level3-nav.ts`, `app/organization-management/role-and-permissions` | Not read line by line |
| H5P and Library/Hostel legacy route enforcement | Not traced individually; assumed PERM family by route census |
| Whether my route dump script triggered any lazy DB connection in service providers | Cannot tell without server/DB logs |

8.1 Programmatic result for code-defined menu targets: 309 distinct `'/…'` targets in `app/data/routeMapper.ts` (+ `moduleDashboards.ts`, `DashboardShell`, `Header`, `Sidebar`, `Level3Subheader`, `module-routes.ts`, `lib/brain/navigation.ts`, roadmap registry) were matched against the 679 page routes (dynamic segments honoured): **31 targets have no page**, all in `RESULT_ROUTE_NAME_MAP` (AUTH-13). 20 static page routes are never referenced by any string in `app/`, `lib/`, `components/` (lower bound; substring match): `/Inventory/intelligence`, `/academic_setup/intelligence`, `/admin-services/visitor/intelligence`, `/easy_com/intelligence`, `/inward_outward/intelligence`, `/lms/homework/intelligence`, `/user/intelligence` (reached via synthetic Intelligence items or seeded category routes), `/ai/audit`, `/ai/usage-cost`, `/fees/{onboarding,process-builder,sop-task}`, `/teach-learn/{communication,help-guide-support,onboarding,operations,process-builder,reports}`, `/students/requests/new`. Most are reached through `fees_menu_categories.route` rows (DB) — cannot confirm.

---

## 9. Second-pass results

Scope directories (auth/session/menu files listed in §1): counts / repo-wide counts (`app lib components hooks contexts`, `.ts/.tsx`).

| Pattern | In-scope hits | Repo-wide hits (files) | Material hits |
|---|---|---|---|
| `TODO|FIXME|HACK|XXX` | 0 | 2 (2) | none in scope |
| `console.log/debug/info` | 1 | 38 (18) | `app/components/Sidebar.tsx:113` logs `parsed.logo` from `userData`; `app/course-master/lesson-plan/[courseId]/page.tsx` (8 logs incl. session/standard ids, API payloads); `course-master/[courseId]/chapters/sideDrawer.tsx:735-737` logs prompts/data; `fees/master/other-fees-title/page.tsx:255` logs API payload |
| `debugger`, `eval(` | 0 / 0 | 0 / 0 | — |
| `localStorage|sessionStorage` | 63 | 294 (115) | token/PII in `userData` (AUTH-07); 53 files re-implement `JSON.parse(localStorage.getItem('userData'))` |
| `dangerouslySetInnerHTML` | 0 | 65 (35) | only 5 files reference DOMPurify (`RichText`, `generated-html.ts`, `h5p_course_presentation`, `h5p_image_hotspots`, `QuestionPaperSheet`); unsanitised server HTML in `career-explorer/{expert-advice,explore-sectors}`, `career-counselling/.../CounsellingCourses.tsx` (AUTH-24) |
| `fetch(` | 20 | 556 (264) | 13 files call `fetch(...API_BASE_URL...)` directly, several without `Authorization` (`useMenuRights`, `AuthContext.refreshAcademicTerms`, `master-menu-rights`) |
| `window.location` | 4 | 15 (11) | `AuthContext.logout` -> `location.replace('/')`; `app-version.ts` reload |
| `user_profile_name|user_profile_id|userProfileName` | 28 | 287 (82) | 10+ divergent role helpers (AUTH-17) |
| `sub_institute_id|subInstituteId` | 24 | 1,023 (300) | see §4 |
| `syear` (scope) | 29 | — | client-selectable year |
| `eslint-disable` | 18 | 307 (209) | `react-hooks/set-state-in-effect` mostly |
| `@ts-ignore|@ts-expect-error` | 0 | 2 (2) | — |
| Hardcoded hosts/IPs | — | `http://apps.triz.co.in/excel_upload/export_xlsx.php?module=tbluser|tblstudent` in `app/general/implementation_management/ImplementationManagementPage.tsx:94,103` (plain http, third-party host, exports users/students); `localhost:3000` fallback in `app/pal/data/pal-content-model.ts:1131` | — |
| Hardcoded ids in Laravel login | — | `[254,195,47,72,1]` school ids, `[2,11,20,34,81]` client ids (`ApiLoginController.php`), `id === 1002` special-case, `menu_id 200/82/386` allowlists in `checkPermission.php:73-77` | AUTH-29 |
| Empty handlers / placeholders | — | "Remember me" checkbox has no state or handler (`app/login/page.tsx:277`); `useAuth()` outside provider returns no-op login/logout (`AuthContext.tsx:387-405`); `app/forgot-password/page.tsx` is redirect-only; commented-out "Sign up" block in login | AUTH-28 |
| Raw redirects | — | `router.replace('/dashboard')` after login ignores the requested URL (`app/login/page.tsx:62-64, 105-107`) | AUTH-27 |
| 401 handling | — | 55 mentions of `401`; ~20 data modules throw "session expired" text; **no code path calls `logout()` on 401** (only `Header.tsx:694` does) | AUTH-20 |
| `storage` event listeners | — | 4 files (`useLmsSession`, `pal-view-as`, `academic-year`, `lesson-plan/[courseId]/page`) — none in `AuthContext` | AUTH-19 |
| Laravel: `submit` bypass, request-supplied tenant, `plain_password` writes, unverified JWT decode | — | see AUTH-02, 11, 09, 06 | — |

---

## 10. ISSUES

## AUTH-01
**Severity:** Critical   **Type:** Confirmed
**Category:** Security
**Module:** Menu / navigation backend (`/api/menu-rights`)
**Location:** `D:\next_lms_erp\app\Http\Controllers\api\MenuRightsController.php:54, 125, 128, 146, 155, 159, 177, 199, 203, 222, 231, 235` (route `routes/api.php:139`, no middleware); consumer `D:\lms_k12\app\hooks\useMenuRights.ts:131-144`
**Function/Method:** `MenuRightsController::getMenuRightsLevelWise`
**Problem:** The endpoint is unauthenticated and builds SQL by concatenating request values: `FIND_IN_SET(".$sub_institute_id.", m.sub_institute_id)` (student branch, unquoted) and `whereRaw("find_in_set('$sub_institute_id',sub_institute_id) and status = 1 and id in (".$rightsMenusIds.")…")` / `find_in_set('$client_id',client_id)` in every other branch. `$sub_institute_id`, `$client_id`, `$user_id`, `$user_profile_name` all come straight from `$request->get(...)` with no validation or binding. `explode(',', $sub_institute_id)` into `whereIn` is bound, but MySQL casts `"61') OR …"` to 61 in the `u.sub_institute_id IN (...)` comparison, so the row still matches and execution reaches the vulnerable `whereRaw`.
**Evidence:** `->whereRaw("find_in_set('$sub_institute_id',sub_institute_id) and status = 1 and id in (".$rightsMenusIds.") and (menu_type!='MASTER' or menu_type IS NULL)")` (line 155); `FIND_IN_SET(".$sub_institute_id.", m.sub_institute_id)` (line 54). Docs call this endpoint "information disclosure of menu structure only" (`docs/admin-user-journey.md` §8.4) — it is not.
**Impact:** Unauthenticated SQL injection against the production ERP database (read of any table via UNION/boolean/time based, e.g. `tbluser` incl. `password`/`plain_password`/`otp`, every tenant). Also lets an anonymous caller enumerate any user's menu grants.
**Expected Behavior:** Menu identity must come from the verified JWT (`api.session`), all values bound (`whereRaw(..., [$id])`) or cast to int.
**Recommended Fix:** Put the route behind `api.session`; ignore body identity; replace every interpolation with bindings or `(int)` casts; add a regression test; rotate any credentials exposed via `plain_password`/`otp` if logs show probing.
**Verification:** Static read of the controller (all 12 quoted lines). Not executed (`NOT VERIFIED` exploitability).

## AUTH-02
**Severity:** Critical   **Type:** Confirmed
**Category:** Authorization
**Module:** Rights enforcement (`check_permissions`)
**Location:** `D:\next_lms_erp\app\Http\Middleware\checkPermission.php:44, 76` (also `73-77` hardcoded menu-id allowlists)
**Function/Method:** `checkPermission::handle`
**Problem:** The whole view/add/edit/delete evaluation sits inside `if (!Str::contains($request->submit, 'Search')) { … }`. `$request->submit` is any client-supplied query/body value. Sending `submit=Search` skips every rights check on every route carrying `check_permissions` (3,184 routes: essentially all legacy ERP modules reached by the SPA through `/api/proxy`). Separately, `if($menu_id!='')` (line 44) makes a route whose name has no active `tblmenumaster.link` row completely unchecked (fail-open).
**Evidence:** `if (!Str::contains($request->submit, 'Search')) {` (line 76); the SPA lets callers add arbitrary fields (`legacyRequest(... body)` -> `contextBody(session, options.body)` in `lib/erp-legacy.ts:109-118`, and query via `QueryInput`).
**Impact:** Any authenticated user (including a Student/Parent token) can add/edit/delete in modules they were denied, within their own tenant, by appending `submit=Search`. RBAC is advisory only.
**Expected Behavior:** Rights are decided from token identity and route only; no client-controlled escape hatch; unknown routes deny by default.
**Recommended Fix:** Remove the `submit` condition (use an explicit route-name allowlist for read-only "Search" POST routes); invert `menu_id` empty to deny; replace path-substring logic with route-level `perm:`/action declarations; add tests.
**Verification:** Static read of the middleware; route census (3,184 `check_permissions`). Not executed.

## AUTH-03
**Severity:** Critical   **Type:** Confirmed
**Category:** Security
**Module:** Organization management — Employee directory
**Location:** `D:\next_lms_erp\app\Http\Controllers\api\OrganizationManagement\EmployeeDirectory\EmployeeDirectoryController.php:66-107 (index), 150-160 (show)`; model `D:\next_lms_erp\app\Models\user\tbluserModel.php` (no `$hidden`); routes `routes/organization_management.php:31,90` (`api.session` only)
**Function/Method:** `EmployeeDirectoryController::index`, `::show`
**Problem:** `index()` selects `tbluser.*` and only self-scopes non-`ADMIN`/`SUPER ADMIN` callers when `!$request->has('menu_type')` (line 97) — the caller controls `menu_type`. `show($id)` has no role or self check and returns `$employee->toArray()`. `tbluserModel` declares no `$hidden`, so the JSON includes `password`, `plain_password`, `otp`, plus the staff HR/financial/statutory columns documented in `lib/users/users-ai-stack.ts` (bank, PAN, Aadhaar, PF, salary…).
**Evidence:** `->when(!in_array(strtoupper((string) $userProfile), ['ADMIN','SUPER ADMIN']) && !$request->has('menu_type'), fn ($q) => $q->where('tbluser.id', $userId))`; `$editData = $employee->toArray();` (route middleware from the dump: `api,api.session`).
**Impact:** Any authenticated token in a tenant (a Student included) can dump every staff member's plaintext password, OTP and HR/financial PII by iterating ids, and log in as them (staff passwords are plaintext-compatible). Full account takeover of admins in the tenant.
**Expected Behavior:** Column allow-list in the response; role/rights gate; no client-controlled scope switch.
**Recommended Fix:** `$hidden = ['password','plain_password','otp', …]` on the model, explicit column lists in these endpoints, `staff.only`+rights on the group, remove `menu_type` self-scope switch; rotate staff passwords.
**Verification:** Static read (controller, model, route dump). Not executed.

## AUTH-04
**Severity:** Critical   **Type:** Confirmed
**Category:** Security
**Module:** Editor upload (Laravel web)
**Location:** `D:\next_lms_erp\app\Http\Controllers\CkeditorFileUploadController.php:19-38`; route `routes/web.php:488` (`POST ckeditor`, middleware `web` only)
**Function/Method:** `CkeditorFileUploadController::store`
**Problem:** Unauthenticated endpoint moves the uploaded file to `public/lms_editor_upload/` as `rand(1000,9999).$file->getClientOriginalName()` with no extension/MIME allow-list; it also echoes `$funcNum` unescaped into an inline `<script>` (reflected XSS). CSRF is the only barrier and a CSRF token is obtainable by any anonymous client (`XSRF-TOKEN` cookie is issued by `VerifyCsrfToken::$addHttpCookie = true`, `GET /sanctum/csrf-cookie`).
**Evidence:** `$file->move(public_path().'/lms_editor_upload/', $filename);` and `return '<script>window.parent.CKEDITOR.tools.callFunction('.$funcNum.', "'.$url.'", "'.$message.'")</script>';`.
**Impact:** Anonymous arbitrary file upload into a web-served directory; remote code execution if the web server executes PHP there (`NOT VERIFIED`), otherwise hosted malware/HTML/JS on the ERP origin (stored XSS against staff who share the origin).
**Expected Behavior:** Authenticated, permission-checked, extension/MIME allow-listed, randomly named, non-executable storage.
**Recommended Fix:** Add `session` + rights (or remove the route); validate `image/*` with a strict extension list; store outside `public/` or deny script execution in that directory; escape `$funcNum`.
**Verification:** Route dump row `POST ckeditor | CkeditorFileUploadController@store | web`; code read. Not executed.

## AUTH-05
**Severity:** Critical   **Type:** Confirmed
**Category:** Authorization
**Module:** Laravel API surface (LMS, homework, admissions, question papers, exam evaluation, dashboards, migration/compliance, mobile-app legacy APIs)
**Location:** `D:\next_lms_erp\routes\api.php` (e.g. `139-143`, `166-262`, `380-392`) and `routes/web.php` (~425 `web`-only routes); controllers listed in §5.2 (e.g. `Controllers/api/lms/StudentHomeworkApiController.php:22,115,290`, `ApiLmsCourseController.php:64,92,719`, `ExamEvaluationApiController.php:44,78,119…`, `admissionEnquiryAPIController.php:15`, `ApiQuestionPaperController.php` destroy)
**Function/Method:** Route registration + controller methods that read `sub_institute_id`/`user_id` from request input
**Problem:** ~195 API controllers (≈300 routes) and ~425 legacy web routes have no authentication. Tenant and actor are taken from the request body. The codebase itself acknowledges it (`LmsApiAuth.php` docblock: "the other 170-odd unauthenticated routes"; `routes/api.php:255-262` comment on `lms/gamma-content-master`). Write/delete endpoints are included: `lms-question-bank/{create,update,delete,review}`, `lms-homework/{store,update,delete,bulk-delete}`, `exam-evaluation/*` (upload/publish/delete), `admission_enquiry` (PUT/DELETE), `question-paper/{id}` DELETE with no tenant predicate, `migration-modules/{module}` POST/DELETE, `compliance/{create,update,delete}`.
**Evidence:** `Route::post('lms-question-bank/delete', [ApiLmsCourseController::class, 'deleteQuestionBank']);` (`routes/api.php`, group `api` only); `$sub_institute_id = $request->input('sub_institute_id');` (`StudentHomeworkApiController.php:22`); route dump: 328 `api`-only routes, 195 controllers without JWT code.
**Impact:** Unauthenticated cross-tenant read, write and delete of academic content, student homework, admissions data and exam papers for any school id; AI-generation spend abuse; the frontend hiding a menu (e.g. `question_paper.index` in `HIDDEN_MENU_LINKS`) removes only the link.
**Expected Behavior:** Every non-public route runs `api.session` (or an equivalent verified-JWT middleware) with tenant/user from the token; genuinely public endpoints (online admission form) are an explicit, minimal allow-list.
**Recommended Fix:** Move the groups under `api.session` (+ `staff.only`/rights as appropriate) in stages, starting with write verbs; flip `LMS_API_AUTH_ENFORCE`; delete client-supplied tenant reads; add a CI test that fails when a non-allow-listed route has no auth middleware.
**Verification:** Mechanical route census (`routes.tsv`) + per-controller marker scan + reading of five controllers. Per-method behaviour of every controller `NOT VERIFIED`.

## AUTH-06
**Severity:** High   **Type:** Confirmed
**Category:** Security
**Module:** Document templates (Laravel)
**Location:** `D:\next_lms_erp\app\Http\Controllers\api\DocumentTemplateApiController.php:62-96` (`context()`, `tokenClaims()`)
**Function/Method:** `DocumentTemplateApiController::context` / `tokenClaims`
**Problem:** Tenant and user come from the JWT payload that is only base64-decoded (`base64_decode(strtr($parts[1], …))`), never signature-verified, with a fallback to `request->input('sub_institute_id')`/`user_id`. No `api.session`/`jwt` middleware (routes have only `api`). The comment says "same as the sibling LMS controllers".
**Evidence:** `/** Decode the (already-issued) JWT payload without verifying — same as the sibling LMS controllers. */` (line 78); `$subInstituteId = (int) ($claims['sub_institute_id'] ?? 0) ?: (int) $request->input('sub_institute_id');`.
**Impact:** Any caller can act as any tenant/user by sending a forged unsigned token or just the parameter; `document-templates/merge-data` and `preview-students` return student rows.
**Expected Behavior:** Verified JWT via `api.session`; tenant from verified claims only.
**Recommended Fix:** Wrap the 12 routes in `api.session`, delete `tokenClaims()`, remove the parameter fallback.
**Verification:** Static read of the controller; route dump (`api` only).

## AUTH-07
**Severity:** High   **Type:** Confirmed
**Category:** Security
**Module:** Session / token lifecycle
**Location:** `D:\next_lms_erp\app\Http\Controllers\api\ApiLoginController.php:426-434`; `D:\next_lms_erp\app\Http\Controllers\api\MobileWebHandoffApiController.php:237-244`; `D:\next_lms_erp\app\Http\Middleware\Concerns\HydratesLegacyApiSession.php:24-118`; `D:\lms_k12\contexts\AuthContext.tsx:171-219, 319-334`
**Function/Method:** `login`, `identityPayload`, `hydrateSessionFromToken`, `persistLoginPayload`, `logout`
**Problem:** (1) `exp` is added only when `JWT_TTL_MINUTES>0`; default `0` (not in `.env.example`) issues tokens that never expire; the vendored driver validates `exp` only if present. (2) The handoff endpoint mints a JWT with no `iat/exp` regardless of that setting. (3) There is no logout/revocation endpoint; `AuthContext.logout` only purges browser storage, so a copied token stays valid. (4) `hydrateSessionFromClaims` never re-checks `tbluser.status`, role or profile: a deactivated user or a demoted admin keeps full access (and `is_admin`/`user_profile_id` claims) until expiry — with no expiry, forever. (5) The bearer token, `erp_rights`, email/mobile/address/birthdate are stored in plain `localStorage.userData`, readable by any script on the origin (53 files re-read it; 35 files use `dangerouslySetInnerHTML`, see AUTH-24).
**Evidence:** `$ttlMinutes = (int) env('JWT_TTL_MINUTES', 0); if ($ttlMinutes > 0) {…}`; handoff `createToken([...])` has no `exp`; `localStorage.setItem(STORAGE_KEY_USER, JSON.stringify(sessionPayload))`.
**Impact:** A leaked or shoulder-surfed token is a permanent credential; offboarding does not cut access; any XSS becomes account takeover.
**Expected Behavior:** Short-lived access token + rotation/refresh (httpOnly cookie or in-memory), server-side revocation (token version / deny list), status/role re-check on each request or short TTL.
**Recommended Fix:** Set and document `JWT_TTL_MINUTES` (and add it to `.env.example`), add `exp` to handoff tokens, add a `token_version`/`jti` deny-list checked in the hydrator, add `POST /api/logout`, move the token out of `localStorage`.
**Verification:** Static read. Live `JWT_TTL_MINUTES` `NOT VERIFIED`.

## AUTH-08
**Severity:** High   **Type:** Confirmed
**Category:** Security
**Module:** Login
**Location:** `D:\next_lms_erp\routes\api.php:88`; `D:\next_lms_erp\app\Http\Kernel.php:47`; `D:\next_lms_erp\app\Providers\RouteServiceProvider.php:476-478`; `D:\next_lms_erp\app\Http\Controllers\api\ApiLoginController.php:23-105`
**Function/Method:** `ApiLoginController::login`
**Problem:** The only limiter is the global `api` group `throttle:1000,1` (1,000 requests/minute per IP). No per-account throttle, lockout, CAPTCHA, or failed-login logging; no last-login/success audit write; response messages are identical (good) but timing/`422/403` tenant states differ. Staff passwords are stored plaintext-compatible (AUTH-09), making credential stuffing directly effective.
**Evidence:** `'throttle:1000,1'` in `Kernel.php`; `Limit::perMinute(1000)->by($request->user()?->id ?: $request->ip())`; the controller performs no `RateLimiter` calls.
**Impact:** Online password guessing at ~1,000 tries/min/IP against any email; no forensic trail of attacks or logins.
**Expected Behavior:** Per-email+IP throttle (e.g. 5/min), progressive lockout, failed/successful login audit rows, alerts.
**Recommended Fix:** `RateLimiter::for('login')` keyed by `email|ip` on `api-login` and `forget-password`; write `access_log_route`/`last_login`; add CAPTCHA after N failures.
**Verification:** Static read of route, kernel, provider, controller.

## AUTH-09
**Severity:** High   **Type:** Confirmed
**Category:** Security
**Module:** Password storage (staff)
**Location:** `D:\next_lms_erp\app\Http\Controllers\api\UserManagementApiController.php:196-198`; `D:\next_lms_erp\app\Http\Controllers\Auth\ForgotPasswordController.php:110`; `D:\next_lms_erp\app\Http\Controllers\loginController.php:101`; `D:\next_lms_erp\app\Http\Controllers\api\ApiLoginController.php:103-106, 620-647`
**Function/Method:** `UserManagementApiController::values`, `ForgotPasswordController::submitResetPasswordForm`, `loginController` credential match, `verifyAndUpgradePassword`
**Problem:** User create/update writes `password = Hash::make(x)` **and** `plain_password = x` (plaintext) to `tbluser`. The reset flow writes the raw new password into `tbluser.password` (`update(['password' => $request->password])`). The web login compares `password` to the raw input. Legacy staff rows are plaintext and only upgraded when the user logs in through the API path. `ApiLoginController` also chooses the *student* rights branch when `plain_password` equals `student`/`Student`/`STUDENT`.
**Evidence:** `$values['plain_password'] = $request->input('password');`; `tbluserModel::where('email', $request->email)->update(['password' => $request->password]);`.
**Impact:** A DB read, backup leak, SQL injection (AUTH-01) or the AUTH-03 dump yields usable passwords; users who reuse passwords are exposed elsewhere; a staff member whose password is literally "student" is evaluated as a student for menu rights.
**Expected Behavior:** Only salted hashes stored; no `plain_password`; one hashing path for every entry point.
**Recommended Fix:** Stop writing `plain_password`; hash on reset; migrate remaining plaintext rows (force reset); remove the `plain_password == 'student'` heuristic in favour of `is_student`.
**Verification:** Static read; consistent with memory `gotcha_erp_auth_model`.

## AUTH-10
**Severity:** High   **Type:** Confirmed
**Category:** Authorization
**Module:** Result API, Easy Communication, Organization management (compliance/disciplinary), Leave, HR attendance
**Location:** `D:\next_lms_erp\routes\resultapi.php:52` (`api.session` only, 181 routes; `MarksEntryApiController` delegates to the legacy controller, skipping `check_permissions`); `D:\next_lms_erp\routes\easycomapi.php:32` (36 routes, `BaseEasyComApiController`); `D:\next_lms_erp\routes\organization_management.php:31`; `D:\next_lms_erp\app\Http\Controllers\api\Leave\Concerns\ResolvesLeaveContext.php:25-60`; `…\Leave\LeaveRequestApiController.php:232-275`; `…\Attendance\AttendanceTrackingApiController.php`
**Function/Method:** Route groups; `leaveContext()`; `LeaveRequestApiController::decision`; `AttendanceTrackingApiController::punchIn/punchOut`
**Problem:** These groups authenticate the caller (valid JWT) but never authorize the role or rights. No `staff.only`, no `check_permissions`, and grep of the controllers finds no profile/rights check (only `DropdownApiController` reads profile name). Consequences: any token — a Student's included — can write marks (`POST result/marks-entry`), delete/alter exam masters, approve marks, send SMS/email/WhatsApp to parents, create/edit/delete SMTP, SMS-gateway and WhatsApp configuration (`api/easy_com/{smtp,sms-api,whatsapp-api}`), approve/reject any leave (`POST leave/requests/{id}/decision`, `bulk-decision`), change leave workflow/roles/types/holidays, and punch attendance as another employee because `user_id` is read from the request body (`leaveContext()` line 55).
**Evidence:** Route dump: `api/result/*` = `api,api.session`; `api/easy_com/*` = `api,api.session`; leave `decision` validates only `status`; `is_numeric($request->input('user_id')) ? (int) … : null`.
**Impact:** Vertical privilege escalation within the tenant for every student/parent; grade tampering; mass messaging abuse; gateway credential changes.
**Expected Behavior:** Same rights model as the legacy Blade routes (per-menu `can_add/edit/delete`) or explicit `perm:`; actor id from the token only.
**Recommended Fix:** Add `check_permissions`-equivalent (fixed per AUTH-02) or `perm:` middleware and `staff.only` to these groups; ignore body `user_id`; add tests per role.
**Verification:** Route census + controller reads. Not executed.

## AUTH-11
**Severity:** High   **Type:** Confirmed
**Category:** Authorization
**Module:** Tenant scoping (cross-cutting; example Fees audit log)
**Location:** `D:\next_lms_erp\app\Http\Controllers\fees\fees_audit_log_api_controller.php:33-48`; systemic: 641 controllers under `app/Http/Controllers` read `sub_institute_id` from request input (4,888 hits)
**Function/Method:** `fees_audit_log_api_controller::index`; any controller reading `$request->input('sub_institute_id')`
**Problem:** The JWT hydration guarantees session tenant only for controllers that read `session()`. `GET fees/audit_logs` (route `web,session,menu,logRoute,check_permissions,api.session`) queries `system_audit_logs` by `module` and adds a tenant filter **only if the client supplies `sub_institute_id`** — omitting it returns every tenant's fee audit log; supplying another id returns that tenant's. The trait docblock ("a request cannot claim to act as a school … other than the one the token was issued to") is therefore false for such controllers.
**Evidence:** `if ($request->filled('sub_institute_id')) { $query->where('sub_institute_id', $request->input('sub_institute_id')); }`.
**Impact:** Any user with view right on that one menu in one school reads all schools' fee audit records; the same pattern can exist in the other request-reading controllers.
**Expected Behavior:** Tenant always forced from `session('sub_institute_id')`; the request value ignored.
**Recommended Fix:** Fix this controller; grep-driven review of the 641 controllers (start with `fees`, `lms`, `student`, `result`, `school_setup`, `inventory`), replace `$request->…('sub_institute_id')` with session reads; add a lint rule.
**Verification:** Read this controller and `feesReceiptBookMasterController` (safe: session first). Remaining controllers `NOT VERIFIED`.

## AUTH-12
**Severity:** High   **Type:** Confirmed
**Category:** Frontend
**Module:** Mobile WebView handoff / mobile custom pages
**Location:** `D:\lms_k12\app\components\ConditionalApp.tsx:44-50`; `D:\lms_k12\app\mobile-bridge\page.tsx:32-89`; `D:\lms_k12\app\mobile\custom\[slug]\page.tsx`
**Function/Method:** `ConditionalApp`
**Problem:** `if (!isAuthenticated) return <LoginPage />;` runs **before** the `FULL_BLEED_ROUTES` check that lists `/mobile-bridge` and `/mobile/custom`. A WebView with empty storage requesting `/mobile-bridge?ticket=…` therefore renders the login form instead of the bridge page, so `loginFromHandoffTicket` is never called and the single-use ticket is never redeemed. The comment on the constant says these routes "still sit behind the same authentication gate" — which is exactly what defeats the bridge, since the bridge exists to create the session. `/mobile/custom/[slug]` depends on the bridge having populated storage. (If the WebView still holds an older session the bridge does render, and redeems the ticket for a possibly different user, silently swapping the session.)
**Evidence:** Code order in `ConditionalApp`; page comment: "By the time this loads, the mobile-bridge handoff has already populated localStorage".
**Impact:** Any menu row with `render_type='webview'`/`native_dynamic` that opens lms_k12 shows a login screen inside the app.
**Expected Behavior:** Public allow-list (`/mobile-bridge`, `/login`) evaluated before the auth gate.
**Recommended Fix:** Move the public-route check above the `isAuthenticated` branch; add a test.
**Verification:** Static trace. Whether the mobile app is live against this frontend `NOT VERIFIED`.

## AUTH-13
**Severity:** High   **Type:** Confirmed (mapper) / Potential (DB link form)
**Category:** Frontend
**Module:** Menu -> route mapping (Result module)
**Location:** `D:\lms_k12\app\data\routeMapper.ts:41-91` (`RESULT_ROUTE_NAME_MAP`), `798-801` (early return), `1057-1111` (later overrides that can never run for the same keys); `D:\lms_k12\app\lib\routes.ts` (`ROUTES.result.*`)
**Function/Method:** `mapApiLinkToRoute`
**Problem:** `RESULT_ROUTE_NAME_MAP` keys such as `marks_entry.index`, `exam_master.index`, `grade_master.index`, `result_master.index`, `cbse_result.index`, `wrt_report.index`… return early to `/result/marks_entry`, `/result/exam_master`… — 31 paths that have no `page.tsx` (real pages are `/result/marks-entry`, `/result/master/*`, `/exam/marks-entry`, `/result/reports/*`, …). The correct mappings further down (`resultRoutes`, and explicit `if (… === 'marks_entry.index') return '/exam/marks-entry'`) are shadowed for exactly those keys. Because `check_permissions` resolves rights by `tblmenumaster.link == route name` (e.g. `marks_entry.index`), route-name-form links are the norm, so these menu items are expected to 404. `app/lib/routes.ts` carries the same dead paths.
**Evidence:** `const resultRoute = RESULT_ROUTE_NAME_MAP[cleanLink.toLowerCase()]; if (resultRoute) { return resultRoute; }` (line 798) precedes `if (cleanLink.toLowerCase() === 'marks_entry.index' …) return '/exam/marks-entry'` (line 1065). Programmatic check: 31 of 309 mapped targets have no page; no test covers the mapper.
**Impact:** Result-module menu entries (marks entry, exams, grading masters, most reports, report cards) navigate to a 404 for tenants whose link is in `.index` form.
**Expected Behavior:** One authoritative map; every target resolvable; a test asserting each mapped route exists.
**Recommended Fix:** Delete or reorder the early map, generate the map from a single table, add a unit test that walks all targets against the app router manifest.
**Verification:** Programmatic route-existence script over 679 pages. Live link form `NOT VERIFIED`.

## AUTH-14
**Severity:** High   **Type:** Confirmed
**Category:** Security
**Module:** Client-controlled upstream (`x-laravel-base-url`) — cross-reference part02
**Location:** `D:\lms_k12\lib\agents\acting-user.ts:39-49, 82-108`; `D:\lms_k12\app\api\forgot-password\route.ts:44`; `D:\lms_k12\app\api\google-auth\route.ts:41`; `lib/laravel-category-proxy.ts`; 15 more route files (grep `x-laravel-base-url`)
**Function/Method:** `readRequestSession`, `laravelAuthorizer`
**Problem:** Server-side routes take the Laravel base URL from a request header. In the agents engine the *authorization decision itself* is a server-side `fetch(`${session.baseUrl}/api/permissions…`)` to that URL; a caller who sets `x-laravel-base-url` to a server they control can answer `{status_code:1,data:{<module>:{create:true,…}}}` and is authorised, while `x-sub-institute-id`/`x-user-id` (also headers) become the recorded tenant/actor. For unauthenticated `forgot-password`/`google-auth` the same header yields an SSRF (POST to arbitrary URL, JSON or 500-char HTML preview returned) with the caller's `Cookie` header forwarded.
**Evidence:** `baseUrl: (header(request, 'x-laravel-base-url') || defaultBaseUrl()).replace(/\/$/, '')`; the `.env.example` comment for `AI_UPSTREAM_BASE_URL` states the rule the code elsewhere violates: "Never read from the request".
**Impact:** Bypass of the agents' rights check (cross-tenant agent creation/run), SSRF into internal networks, forwarding of bearer tokens to attacker hosts.
**Expected Behavior:** Upstream base URL from server env only; identity from a verified token, not headers.
**Recommended Fix:** Remove header override everywhere; derive tenant/actor by calling Laravel with the caller's token.
**Verification:** Static read (this report) and part02 NAPI findings.

## AUTH-15
**Severity:** Medium   **Type:** Confirmed
**Category:** Security
**Module:** Forgot / reset password
**Location:** `D:\next_lms_erp\app\Http\Controllers\Auth\ForgotPasswordController.php:36-118`; `D:\lms_k12\app\login\page.tsx:471-504`; `D:\lms_k12\app\api\forgot-password\route.ts`
**Function/Method:** `submitForgetPasswordForm`, `submitResetPasswordForm`, `ForgotPasswordModal.handleSubmit`
**Problem:** (a) `exists:tbluser,email` returns a 422 validation error for unknown emails, which the modal surfaces as `data.message` — an account-enumeration oracle that contradicts the UI copy "If an account exists…". (b) `password_resets` tokens are random but never expire (`created_at` stored, never compared), are not single-per-email, are stored in clear, and are usable forever. (c) New password stored in plaintext (AUTH-09). (d) Students live in `tblstudent`, so they always get "invalid email" and can never self-reset. (e) No throttle on either endpoint. (f) The reset link points at a Laravel Blade page, outside the SPA. (g) On mail failure `$e->getMessage()` is returned.
**Evidence:** `'email' => 'required|email|exists:tbluser,email'` (line 39); `DB::table('password_resets')->insert([... 'created_at' => Carbon::now()])` with no expiry check in `submitResetPasswordForm`.
**Impact:** Account discovery, long-lived takeover links, unrecoverable student accounts, mail-bomb potential.
**Expected Behavior:** Uniform response, expiring single-use hashed tokens, throttling, hash on reset, include students.
**Recommended Fix:** Return 200 always; store `hash('sha256',token)` with 60-minute expiry, delete prior tokens; `RateLimiter`; hash the password; cover `tblstudent`.
**Verification:** Static read.

## AUTH-16
**Severity:** Medium   **Type:** Architectural
**Category:** Authorization
**Module:** Frontend route protection
**Location:** `D:\lms_k12\app\components\ConditionalApp.tsx:30-53`; `D:\lms_k12\contexts\AuthContext.tsx:49-58`; `D:\lms_k12\app\layout.tsx`; the 10 `layout.tsx` files; pages listed below
**Function/Method:** `ConditionalApp`, `getStoredAuth`
**Problem:** There is no server-side gate (no `middleware.ts`/`proxy.ts`) and the client gate is "does `localStorage.auth` exist". Anyone can set `localStorage.auth='{}'` (plus `menuContext`) and get the full shell and every route (679 pages); the whole app renders only after mount (`if (!mounted) return null`), so it is client-rendered end to end. Role gating exists only per page and only for staff-vs-student (`RequireStaff`, 29 pages). Staff/admin pages with no frontend guard at all include `/exam/{exam-creation,exam-master,marks-entry,progress-report}`, `/pal/new/administration`, `/pal/pedagogy-engine`, `/h5p/model`, all Platform-services/AI/RBAC screens, `/organization-management/*`, `/hrit/*`, `/talent-management/*`, `/general/*`, `/user/*` (which does gate buttons by server rights). `docs/student-menu-report.md` presents several of these as "staff-gated".
**Evidence:** `getStoredAuth` returns `{ isAuth: true, user: JSON.parse(stored) }` on key presence; grep of `app/exam`, `app/pal`, `app/h5p` finds no guard except student-view branching.
**Impact:** UI-level exposure of admin screens to any signed-in role and to anyone who forges localStorage; correctness rests entirely on the backend (which, per AUTH-02/05/10, is uneven).
**Expected Behavior:** Server-verifiable session (cookie) checked in middleware; route-level role metadata enforced centrally; backend authoritative.
**Recommended Fix:** Add `middleware.ts` checking an httpOnly session cookie; central route->required-right table consumed by the shell; keep backend authoritative.
**Verification:** Static read.

## AUTH-17
**Severity:** Medium   **Type:** Architectural
**Category:** Authorization
**Module:** Role identification (frontend and backend)
**Location:** Frontend: `app/pal/data/pal-lookups.ts:39` (exact `student`), `lib/ai/adapters/shared-utils.ts:5-27` (substring `student`, `admin`, `principal`, `super`, `management`), `app/dashboard/_lib/resolveDashboardRole.ts` (sets; default admin), `lib/session/internal-access.ts:52-76`, `DashboardShell.tsx:62-85, 101-114`, `app/library/book_resources/page.tsx:696` (`=== 'ADMIN'` only), `app/lms/dashboard/page.tsx:77`, `app/lms/exam/page.tsx:1076`, `app/documents/_lib/document-access.ts` (allowlist), `app/exam/data/onlineExam.ts:41`, `app/h5p/data/h5p.ts:69`, three `isAdminOrHrProfile` copies, `components/domain/lms/administration-governance/use-administration-governance.ts:58` (client `is_admin`); Backend admin gates: `RolePermissionsController.php:63-78` (exact `Admin`), `UserManagementApiController.php:58` (`admin|super admin`), `RoleDashboardApiController.php:26-38` (`parent_id=1` or three names), `PalApiAuth` (`parent_id=1`), `EmployeeDirectoryController.php:97` (`ADMIN|SUPER ADMIN`), `MobilePageBuilderAdminApiController.php:44-51`, `RequireStaffRole` (blocklist), `checkPermission` (`Super Admin` synthetic)
**Function/Method:** all of the above
**Problem:** "Who is an admin/student/staff" is computed by at least 10 frontend and 8 backend rules over tenant-authored free-text profile names with different spellings, case handling and matching (exact vs substring vs `parent_id`), plus client-editable `is_admin`. Examples: a profile named "Student Council Coordinator" is a student to `shared-utils` and staff to `pal-lookups`; "School Admin" is an admin to the dashboard but not to `RolePermissionsController`; "Admin Assistant"/"Vice Principal" get Enterprise Brain menu via substring; `library/book_resources` treats only `ADMIN` as admin. `is_admin`-driven `canAdminister` checks read localStorage.
**Evidence:** quoted files/lines above; `internal-access.ts` claims to be the single rule but only `ChatbotPanel` uses it.
**Impact:** Inconsistent UX and lock-outs; latent privilege differences; every new module re-invents the check.
**Expected Behavior:** One role model (role key + capability set) delivered by the server, consumed by a single frontend helper.
**Recommended Fix:** Return normalised `role`/`capabilities` from login (the `role_key` column already exists on `tbluserprofilemaster`); replace helpers; delete duplicates.
**Verification:** Static reads/greps.

## AUTH-18
**Severity:** Medium   **Type:** Confirmed / Potential
**Category:** Authorization
**Module:** Menu rights identity and platform admins
**Location:** `D:\lms_k12\app\hooks\useMenuRights.ts:57-84, 119-144`; `D:\next_lms_erp\app\Http\Controllers\api\MenuRightsController.php:60,122,197` (`$is_admin` read from request); `D:\next_lms_erp\app\Http\Middleware\Concerns\HydratesLegacyApiSession.php:72-77`; `D:\next_lms_erp\app\Http\Controllers\api\ApiLoginController.php` (token payload uses `$user['sub_institute_id']`)
**Function/Method:** `useMenuRights.fetchMenu`, `buildMenuContextFromSource`, `hydrateSessionFromClaims`
**Problem:** (1) The menu request carries no `Authorization` header and the identity is whatever `menuContext`/`userData`/`sessionData`/`session` localStorage keys contain (the loader scans six keys); a user can edit it to request another user's or profile's menu, and `getStoredMenuContext` **defaults a missing profile name to `'ADMIN'`** (`useMenuRights.ts:70`). (2) The client never sends `is_admin`, so the backend's `sub_institute_id == 0 && is_admin == 1` branches are dead code. (3) Users whose token `sub_institute_id` is 0 (client-level admins; platform `is_admin=2`) fail `isValidMenuContext` ("Menu session data is missing") and get 401 "Invalid token payload" from `hydrateSessionFromClaims`; login computes `$clientSubInstituteId` for them but does not put it in the token. Whether such rows exist in the live data is `NOT VERIFIED`.
**Evidence:** `user_profile_name: context.user_profile_name || 'ADMIN'`; `if (empty($userId) || empty($subInstituteId)) return $this->unauthorizedApiSession('Invalid token payload');`.
**Impact:** Menu integrity depends on editable client state; client/platform admins may be unable to use the SPA at all.
**Expected Behavior:** Menu computed from the verified token; a defined tenant for multi-school admins.
**Recommended Fix:** Move `menu-rights` behind `api.session`, ignore body identity, send `is_admin`/client context from the token, define tenant selection for `sub_institute_id=0`.
**Verification:** Static read; docs §1.2 agree with (2).

## AUTH-19
**Severity:** Medium   **Type:** Confirmed
**Category:** Frontend
**Module:** Session behaviour (idle timeout, daily reset, multi-tab)
**Location:** `D:\lms_k12\contexts\AuthContext.tsx:41-46, 99-155`
**Function/Method:** `resetInactivityTimer`, `enforceDailyReset`
**Problem:** The 30-minute idle timer is per tab and, when it fires, removes `auth`, `menuContext`, `userData` from the **shared** localStorage; an idle background tab therefore signs out an active tab (whose React state stays "authenticated" while every `buildSessionContext()` call now finds no token). The daily reset compares `new Date().toISOString().split('T')[0]` (UTC date) — Indian schools are forcibly signed out at ~05:30 IST daily, mid-shift for early users, and the UI drops to `LoginPage` without warning (unsaved form data lost). No `storage` listener exists in `AuthContext`, so login/logout in one tab is not reflected in others. `useAuth()` outside a provider returns a silent no-op `login`/`logout`.
**Evidence:** `function getToday() { return new Date().toISOString().split('T')[0]; }`; no `addEventListener('storage'` in `contexts/`.
**Impact:** Spurious sign-outs, data loss, confusing half-authenticated tabs.
**Expected Behavior:** Server-driven expiry with warning, cross-tab sync (BroadcastChannel/storage event), local-date or server-issued expiry.
**Recommended Fix:** Use a shared last-activity timestamp in storage, add storage/BroadcastChannel listeners, drop the UTC-date rule.
**Verification:** Static read.

## AUTH-20
**Severity:** Medium   **Type:** Missing
**Category:** Frontend
**Module:** 401 / expiry handling
**Location:** 55 `401` references across data modules (e.g. `app/pal/data/pal.ts:397,430`, `app/lms/data/leaderBoard.ts:127`, `app/course-master/data/chapters.ts:919`); only `app/components/Header.tsx:694` calls `logout()`
**Function/Method:** each module's fetch wrapper
**Problem:** There is no central fetch wrapper; ~20 modules turn a 401 into an error message ("Your session has expired") but none clears the session or redirects, and the rest ignore it. With `JWT_TTL_MINUTES` set, every screen degrades to per-page error banners while the shell still shows the user as signed in; with legacy `status:2` envelope failures the same happens (`erp-legacy.ts:183-187` throws).
**Evidence:** grep counts above.
**Impact:** Expired or revoked sessions are not recoverable without manual logout; inconsistent messaging.
**Expected Behavior:** One authenticated-fetch helper that, on 401, purges state and shows the login screen.
**Recommended Fix:** Wrap `fetch` in `lib/erp-client.ts`, migrate the 264 fetch files gradually.
**Verification:** Grep.

## AUTH-21
**Severity:** Medium   **Type:** Confirmed
**Category:** Business Logic
**Module:** Audit / User log
**Location:** `D:\next_lms_erp\app\Http\Middleware\LogRouteMiddleware.php:23-90`; `D:\next_lms_erp\app\Http\Controllers\api\UserLogReportApiController.php:154`; `D:\lms_k12\app\user_log\api.ts`
**Function/Method:** `LogRouteMiddleware::handle`
**Problem:** Access logging (`access_log_route` insert via `Accesslog`) is wrapped in `if ($request->get('type') != "API" && $request->get('type') != "JSON")`. Every call the SPA makes carries `type=API`, so none of its activity is recorded; the "Audit -> User Log" screen reads the same table and therefore shows only Blade-era usage. `api.session` routes never log at all.
**Evidence:** The condition on line 23; `DB::table('access_log_route as log')` read side.
**Impact:** No audit trail for actions taken through the new frontend (marks entry, fee changes, user management) despite an Audit module being advertised.
**Expected Behavior:** Middleware logs all authenticated requests with user, route, method, status.
**Recommended Fix:** Log in the `api.session` path (user id, route name, verb, status), remove the type exclusion.
**Verification:** Static read.

## AUTH-22
**Severity:** Medium   **Type:** Confirmed
**Category:** Authorization
**Module:** User / profile administration
**Location:** `D:\next_lms_erp\app\Http\Controllers\api\UserManagementApiController.php:59-66, 175, 266-278`; `D:\lms_k12\app\user\api.ts:107-116`
**Function/Method:** `permissions`, `rules`, `saveProfile`
**Problem:** Anyone with `add`/`edit` on `add_user.index` can set `user_profile_id` to any active profile of the tenant, including the admin profile (only tenant and status are validated), and admin-ness of the *actor* is decided by profile **name** (`admin`/`super admin`), which `saveProfile` lets a holder of `add_user_profile.index` create (unique per tenant only, no reserved-name check, no `parent_id=1` guard).
**Evidence:** `'user_profile_id' => ['required','integer', Rule::exists('tbluserprofilemaster','id')->where(… sub_institute_id … status 1)]`.
**Impact:** Delegated user managers can self-escalate to admin.
**Expected Behavior:** Users may only assign profiles at or below their own level; reserved names protected.
**Recommended Fix:** Compare `parent_id` chain of target vs actor profile; reserve system profile names (`is_system`).
**Verification:** Static read.

## AUTH-23
**Severity:** Medium   **Type:** Confirmed
**Category:** Security
**Module:** Generic proxy
**Location:** `D:\lms_k12\app\api\proxy\route.ts:1-126`; `D:\lms_k12\app\api\proxy-file\route.ts`; consumers `D:\lms_k12\app\mobile\custom\[slug]\page.tsx:47-80`, `lib/erp-legacy.ts:158-189`
**Function/Method:** `GET/POST/PUT/PATCH/DELETE`, `forwardWithBody`
**Problem:** Unauthenticated relay to `API_BASE_URL/<path>` for any path and verb (only a leading `/` is stripped, no allow-list, `..` accepted), forwarding the caller's `Authorization`, `Cookie` and `Referer`; errors echo the upstream target URL and cause. The mobile custom page executes admin-authored `action.endpoint`/`dataSource.endpoint` values through it with the viewer's own token, so a stored layout can drive arbitrary API calls as the viewer (comment claims this is safe because the viewer's token is used).
**Evidence:** `const url = `${base}/${resolveTargetPath(targetPath)}`;`; `message, cause, target: url` in the 502 body.
**Impact:** Hides callers' IPs and bypasses browser CORS for any Laravel path; combined with AUTH-05/02 it is a convenient front door; stored-layout abuse for CSRF-like actions.
**Expected Behavior:** Path allow-list per module, authenticated, no upstream detail in errors.
**Recommended Fix:** Restrict `path` to a whitelist of prefixes, reject `..`, require an `Authorization` header, drop `target`/`cause` from responses, allow-list mobile action endpoints server-side.
**Verification:** Static read; cross-ref part02.

## AUTH-24
**Severity:** Medium   **Type:** Potential
**Category:** Security
**Module:** Front-end hardening (supply chain, headers, HTML sinks)
**Location:** `D:\lms_k12\app\layout.tsx:35,41` (jsDelivr CSS + `verify.min.js` without SRI); `D:\lms_k12\app\login\page.tsx:36-46` (Google GSI script); `D:\lms_k12\next.config.ts` (no `headers()`); 65 `dangerouslySetInnerHTML` sites in 35 files
**Function/Method:** `RootLayout`, next config
**Problem:** Third-party script executes on the same origin that holds the bearer token in `localStorage`, loaded with no `integrity`/`crossorigin`; the app sets no CSP, `X-Frame-Options/frame-ancestors`, `Referrer-Policy`, HSTS (no `next.config` headers, `vercel.json` or middleware; deployment-layer headers `NOT VERIFIED`). Only 5 of 35 innerHTML files reference DOMPurify; e.g. `career-explorer/expert-advice/page.tsx:210`, `career-explorer/explore-sectors/page.tsx:86`, `CounsellingCourses.tsx:93` inject server-supplied HTML unsanitised.
**Evidence:** `<script src="https://cdn.jsdelivr.net/npm/@mdi/font@7.4.47/scripts/verify.min.js" async>`.
**Impact:** Any XSS or compromised CDN script = token theft and account takeover (AUTH-07).
**Expected Behavior:** Self-host or SRI-pin third-party assets; CSP; sanitise HTML sinks.
**Recommended Fix:** Bundle MDI, add `headers()` with CSP/frame-ancestors, centralise a sanitising `SafeHtml` component.
**Verification:** Grep/static read.

## AUTH-25
**Severity:** Medium   **Type:** Missing
**Category:** Backend
**Module:** Google sign-in
**Location:** `D:\lms_k12\app\login\page.tsx:30-34, 71-118`; `D:\lms_k12\app\api\google-auth\route.ts:19`; `D:\lms_k12\contexts\AuthContext.tsx:246-267`
**Function/Method:** `handleGoogleSignIn`, `loginWithGoogle`
**Problem:** The client id is read from `process.env.NEXT_GOOGLE_CLIENT_ID` in a client component; without the `NEXT_PUBLIC_` prefix Next replaces it with `undefined`, so the button is permanently disabled ("not configured"). Even if enabled, the proxy calls `{base}/api/google-auth`, for which no route or controller exists in `D:\next_lms_erp` (`grep` over `routes/`, `app/`, `config/` returns nothing). The variable is not in `.env.example`. Docs still describe Google sign-in as a feature (`admin-user-journey.md` §1.1).
**Evidence:** Route dump: no `google-auth` row.
**Impact:** Dead feature, misleading UI/docs; if someone later implements only the Laravel side, ID-token audience/issuer validation must be designed (not present).
**Expected Behavior:** Feature either implemented end to end or removed.
**Recommended Fix:** Decide; if kept, add `NEXT_PUBLIC_GOOGLE_CLIENT_ID`, implement server-side token verification and account linking, document in `.env.example`.
**Verification:** Static read; also reported in part02.

## AUTH-26
**Severity:** Medium   **Type:** Missing
**Category:** Testing
**Module:** Auth / menu / role logic
**Location:** `D:\lms_k12\package.json:11`; absent tests for `contexts/AuthContext.tsx`, `lib/erp-client.ts`, `app/data/routeMapper.ts`, `app/data/menuMappers.ts`, `app/hooks/useMenuRights.ts`, role helpers; `lib/session/internal-access.ts` (references a non-existent test)
**Function/Method:** —
**Problem:** The test script only globs `lib/**/*.test.ts` and `packages/**`; none of the 42 tests touch authentication, session, menu mapping or role helpers. A test walking mapper targets against pages would have caught AUTH-13; a middleware test would have caught AUTH-02.
**Evidence:** `git ls-files | grep test` list; missing `internal-access.test.ts`.
**Impact:** Regressions in the security-critical path ship unnoticed.
**Expected Behavior:** Unit tests for role helpers/mapper, integration tests for `checkPermission`, `ApiSessionHydrator`, `MenuRightsController`.
**Recommended Fix:** Add tests as part of fixing AUTH-01/02/13/17; widen the glob to `app/**` and `contexts/**`.
**Verification:** File inventory.

## AUTH-27
**Severity:** Low   **Type:** Confirmed
**Category:** Frontend
**Module:** Login redirect
**Location:** `D:\lms_k12\app\login\page.tsx:59-64, 103-107`; `D:\lms_k12\app\components\ConditionalApp.tsx:44-46`
**Function/Method:** `handleSubmit`, `handleGoogleSignIn`
**Problem:** A logged-out user opening a deep link sees the login form at that URL, but after login the code unconditionally `router.replace('/dashboard')` after 1.1 s, discarding the requested URL. Because `persistLoginPayload` flips `isAuthenticated` immediately, `ConditionalApp` unmounts `LoginPage`, so the "Signed in — taking you in" animation (`showSuccess`) never renders while the timer still fires. No `next`/return-URL support and no post-logout return.
**Evidence:** `window.setTimeout(() => { router.replace('/dashboard'); }, 1100);`
**Impact:** Lost deep links (notifications, bookmarks); dead animation code.
**Expected Behavior:** Return to the requested route after login.
**Recommended Fix:** Remove the timeout redirect when already on a valid route; store intended path.
**Verification:** Static trace.

## AUTH-28
**Severity:** Low   **Type:** Confirmed
**Category:** Frontend
**Module:** Login page details
**Location:** `D:\lms_k12\app\forgot-password\page.tsx`; `D:\lms_k12\app\login\page.tsx:274-285, 344-357`
**Function/Method:** `ForgotPasswordPage`, remember-me checkbox
**Problem:** `/forgot-password` is documented as "pre-login only" but, when logged out, `ConditionalApp` renders `LoginPage` instead of this page, so its effect never runs; when logged in it just redirects to `/dashboard`. The "Remember me" checkbox has no state and no handler (session length is fixed by AUTH-19/07). Commented-out "Sign up" and "Demo mode" blocks remain.
**Evidence:** `<input type="checkbox" className="sr-only peer" />` (no `checked`/`onChange`).
**Impact:** Misleading UI; dead code.
**Expected Behavior:** Working or removed controls.
**Recommended Fix:** Implement persistent vs session login or drop the checkbox; delete the redirect-only page.
**Verification:** Static read.

## AUTH-29
**Severity:** Low   **Type:** Confirmed
**Category:** Backend
**Module:** Login (hardcoded ids / inference)
**Location:** `D:\next_lms_erp\app\Http\Controllers\api\ApiLoginController.php` (`is_admin==2` tenant arrays `[254,195,47,72,1]`, `[2,11,20,34,81]`; `(int) $user['id'] === 1002`; `plain_password == 'student'`); `D:\next_lms_erp\app\Http\Middleware\checkPermission.php:73-77`
**Function/Method:** `ApiLoginController::login`, `checkPermission::handle`
**Problem:** Estate-specific ids and a magic user id are embedded in login/permission logic; student-ness of a token subject is inferred from a password-column value in one place and from the table it was found in elsewhere; a failed academic-term lookup blocks login for the entire tenant.
**Evidence:** quoted arrays in code; `rbac_modules.php` docblock calls the menu-id allowlists "a latent bug AND a Decision #23 violation".
**Impact:** Behaviour differs between environments; onboarding a new platform admin requires a code change.
**Expected Behavior:** Data-driven configuration.
**Recommended Fix:** Move to config/DB; use `is_student` from the source table.
**Verification:** Static read.

## AUTH-30
**Severity:** Low   **Type:** Improvement
**Category:** DevOps
**Module:** API base URL selection
**Location:** `D:\lms_k12\app\components\utils\api_url.tsx:23-47`; `D:\lms_k12\lib\erp-client.ts:56, 139-142`; `D:\lms_k12\.env.example` (`NEXT_PUBLIC_ERP_BASE_URL=https://erp.triz.co.in` uncommented)
**Function/Method:** `API_BASE_URL`, `buildSessionContext`
**Problem:** Any hostname that is not localhost/private-range selects the **production** API, so Vercel previews (`lms-k12-*.vercel.app`, explicitly allowed in `cors.php`) and staging hosts talk to production. `userData.host_name` (server `env('APP_URL')`) becomes the base URL for 251 files' calls, unless `NEXT_PUBLIC_ERP_BASE_URL` overrides it — and `.env.example` ships that override **active** pointing at production, so a developer who copies the file sends every `erp-client` call (with a token minted by the local backend) to production. Console error only when the URL is unset.
**Evidence:** `!(hostname === 'localhost' || …)`; `.env.example` line "NEXT_PUBLIC_ERP_BASE_URL=https://erp.triz.co.in".
**Impact:** Preview/staging traffic and test writes reach production; mixed-environment 401s.
**Expected Behavior:** Explicit per-environment base URL; example files safe by default.
**Recommended Fix:** Require explicit env per deployment, comment out the override in `.env.example`, validate `host_name` against an allow-list.
**Verification:** Static read.

## AUTH-31
**Severity:** Low   **Type:** Confirmed
**Category:** Frontend
**Module:** Logging
**Location:** `D:\lms_k12\app\components\Sidebar.tsx:113` and 37 other `console.log` sites (18 files; heaviest `app/course-master/lesson-plan/[courseId]/page.tsx`, `course-master/[courseId]/chapters/sideDrawer.tsx:735-737`)
**Function/Method:** `getLogoUrl`, others
**Problem:** Session-derived values, API payloads and AI prompts are logged to the browser console in production builds.
**Evidence:** `console.log('Sidebar logoUrl from localStorage:', parsed.logo);`
**Impact:** Information leakage on shared devices; noise.
**Expected Behavior:** No production debug logging.
**Recommended Fix:** Remove or gate behind a debug flag; ESLint `no-console`.
**Verification:** Grep.

## AUTH-32
**Severity:** Low   **Type:** Architectural
**Category:** Frontend
**Module:** Build-change purge
**Location:** `D:\lms_k12\lib\app-version.ts:158-185`; `D:\lms_k12\contexts\AuthContext.tsx:167-169`; `D:\lms_k12\next.config.ts:31-43`
**Function/Method:** `syncAppBuild`, `purgeClientState`
**Problem:** On every deploy (build id = git SHA) a returning user's first page load clears all localStorage/sessionStorage/cookies/caches and reloads, i.e. signs everyone out and discards drafts, chosen filters and PAL "view as" state. Cookie deletion attempts across path/domain combinations. It works as designed, but it turns each deploy into a forced global logout, and `NEXT_PUBLIC_APP_BUILD_ID` falls back to a timestamp when git is unavailable (changes every build).
**Evidence:** `await purgeClientState(); recordBuildId(); window.location.reload();`
**Impact:** Disruptive deploys; unsaved work lost.
**Expected Behavior:** Migrate persisted state by schema version, keep the session.
**Recommended Fix:** Version storage shapes instead of blanket clear; or warn before reload.
**Verification:** Static read.

## AUTH-33
**Severity:** Low   **Type:** Confirmed
**Category:** Other
**Module:** Documentation accuracy
**Location:** `D:\lms_k12\docs\menu-data-source-audit.md`, `student-menu-report.md`, `teacher_role_audit.md`, `admin-user-journey.md`; `lib/session/internal-access.ts` header
**Function/Method:** —
**Problem:** Docs drifted from code: page/group counts (534/81, 54 menus vs 679/92), Next.js version (15 vs 16.2.6), four "static" screens now call APIs, `student-menu-report` §2 overstates frontend gating, `admin-user-journey` §8.4 downgrades an SQL injection to information disclosure, §8.1 misses the "Document" filter, line references in `teacher_role_audit` are stale, `internal-access.ts` claims a single shared rule and a test that do not exist, and the docs still present Google sign-in as functional.
**Evidence:** See §7.
**Impact:** Reviewers and operators act on wrong security assumptions.
**Expected Behavior:** Docs regenerated with the code or dated as historical.
**Recommended Fix:** Correct §8.4 immediately (security-relevant); mark others historical.
**Verification:** Cross-check performed in §7.

## AUTH-34
**Severity:** Info   **Type:** Improvement
**Category:** Authorization
**Module:** Patterns worth replicating
**Location:** `D:\lms_k12\app\user\api.ts:37-50` + `add_user/page.tsx` (server-supplied `permissions()`); `D:\next_lms_erp\app\Http\Middleware\PalApiAuth.php`; `HydratesLegacyApiSession.php`; `D:\next_lms_erp\app\Http\Middleware\RequirePermission.php`; `D:\next_lms_erp\config\rbac_modules.php`
**Function/Method:** —
**Problem:** Not a defect. The Users module asks the server what the actor may do and hides controls accordingly while the server independently enforces; `pal.auth` verifies the JWT and learner/tenant ownership per request; `api.session` takes tenant/user only from the verified token; `perm:`/`rbac_modules.php` provide a named-capability model. These are the templates for closing AUTH-02/05/10/11.
**Evidence:** Files above.
**Impact:** —
**Expected Behavior:** Adopt as the standard.
**Recommended Fix:** Promote these patterns and retire the ad-hoc gates.
**Verification:** Read.

ISSUE COUNTS: C=5 H=9 M=12 L=7 I=1

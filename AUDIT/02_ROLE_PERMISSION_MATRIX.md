# 02 - ROLE & PERMISSION MATRIX

> Repos in scope: `D:\lms_k12` (Next.js frontend) and `D:\next_lms_erp` (Laravel backend consumed by the frontend). Static analysis only: no code modified, no server contacted, no `.env` read. Issue IDs are the unified `LMS-AUDIT-###` IDs from [14_MASTER_ISSUE_REGISTER.md](14_MASTER_ISSUE_REGISTER.md); original per-agent IDs are shown alongside and defined in `AUDIT/parts/`.

## A. Roles as they actually exist

Role identity is derived from `user_profile_id` / `user_profile_name` on the JWT/session plus `is_admin` (1 = client admin, 2 = platform super admin). `HydratesLegacyApiSession` stamps `user_profile_name='Super Admin'` for is_admin 1 and 2, which makes `check_permissions` skip all rights checks for them. The frontend computes "who is admin/student/staff" with at least 10 different rules and the backend with 8 (AUTH-17). Live profile names and rights rows are NOT VERIFIED (remote DB not queried).

## B. Role x module x action matrix (Part 01 section 3, verbatim)

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
3. **Frontend role state is client-editable.** `AuthContext.persistLoginPayload` writes the whole login payload (incl. `user_token`, `is_admin`, `user_profile`, PII) to `localStorage.userData`; `menuContext` (`user_profile_name`, `user_profile_id`, ids) and `auth` likewise. All role helpers read these keys (10+ divergent implementations, AUTH-17 (LMS-AUDIT-218)).
4. **Route protection (frontend).** No `middleware.ts`/`proxy.ts`. `app/layout.tsx` wraps everything in `AuthProvider` -> `ConditionalApp` (`app/components/ConditionalApp.tsx:44`): `isAuthenticated` is simply "localStorage key `auth` exists" (`AuthContext.tsx:52-53`). If false, **`<LoginPage/>` is rendered instead of `children`, at whatever URL was requested**; if true `DashboardShell` renders `children` for *any* URL. None of the 10 `layout.tsx` files checks auth or role. So there is exactly one guard: "has the key". Role gating is per page and cosmetic (below).
5. **Backend enforcement layers** (what actually decides): (a) `api.session` — valid JWT, tenant/user/profile from the token; (b) `check_permissions` — `tblmenumaster.link == route name` then `tblindividual_rights`/`tblgroupwise_rights`; **bypassable and fail-open (AUTH-02 (LMS-AUDIT-003))**; (c) `staff.only` — rejects only `is_student` or profile name `student`/`parent`; (d) in-controller checks (JWT + rights or admin name lists) in ~13 headless controllers; (e) `pal.auth`, `brain.*`, `McpAuth`, `lms.auth`+`perm` (warn-only by default); (f) **nothing** for ~195 API controllers and ~425 web routes.

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
| Sidebar menu | rights-filtered by `/api/menu-rights` | server answer for a **client-supplied** identity (AUTH-18 (LMS-AUDIT-219)) | menu only |

Avatar dropdown (`Header.tsx`, Platform Setup / Platform Services / AI & Intelligence, incl. RBAC `/organization-management/role-and-permissions`, `/general/mobile_app_rights`, `/general/fields_configuration`, all 12 AI screens) is rendered for **every** signed-in profile; only the "Document" entry is filtered (`Header.tsx:659`). `docs/admin-user-journey.md` §8.1 says there is no role check at all — now stale by exactly that one entry.

### 3.3 Role x module x action matrix

Legend — cell content is "how a user of that role reaches the module / what stops them".
* **Menu** = shown only if the tenant's `tblgroupwise_rights`/`tblindividual_rights` grants the menu (live rows `NOT VERIFIED`; student/teacher seed migrations exist, see 3.5).
* **URL** = page renders by typing the URL (no frontend guard). **RS** = `RequireStaff` (blocks only profile name `student`).
* Backend classes: **PERM** = `check_permissions` (rights table; **bypassable with `submit=Search`**, fail-open when no menu row — AUTH-02 (LMS-AUDIT-003)); **SESS** = `api.session` only (any valid token, any role); **STAFF** = `api.session`+`staff.only` (blocks Student/Parent only, every other profile incl. Teacher passes); **CTRL** = in-controller JWT + rights/admin-name check; **PAL/BRAIN/MCP/LMSAUTH** as named; **NONE** = no authentication, tenant read from request.
* Action columns are collapsed into the cell text (view / add / edit / delete): PERM enforces all four per rights row (except when bypassed); SESS/NONE enforce none; STAFF/CTRL as stated.

| Module (sidebar/route family) | Student | Parent | Teacher / other staff | Admin-tier (profile `parent_id=1`, Principal…) | `is_admin` 1/2 (Super Admin) | Frontend gate | Primary backend gate (Laravel) |
|---|---|---|---|---|---|---|---|
| Dashboard `/dashboard` | Student dashboard; admin/teacher APIs 403 | UI shows **AdminDashboard**, API 403 (broken UX) | Teacher dashboard (unknown staff -> admin UI, 403) | Admin dashboard | Admin dashboard | `resolveDashboardRole` (localStorage) | `api.session` + in-controller role check (`RoleDashboardApiController.php:26-38, 45-56`) |
| Module dashboards: Admissions, Students, Library, Hostel, Transportation | Menu / URL; **API open to anyone** | same | same | same | same | none | **NONE** — `POST /api/*-dashboard/summary`, tenant from body (`routes/api.php:139-143`) |
| Fees (collect, master, reports, circulars, dashboard) | Menu only if granted (student seed grants view of own fee pages) | Menu | Menu | Menu | bypass all rights | none (`fees/teacher-dues` RS) | **PERM** via `/api/proxy` (+ `api.session,check_permissions` on `fees/*` JSON) — cross-tenant leak in `fees/audit_logs` (AUTH-11 (LMS-AUDIT-070)) |
| Students (add/search/bulk/IDs/health/reports) | Menu; URL | Menu | Menu | Menu | bypass | none | **PERM** (legacy web via proxy) |
| Admissions (form, follow-up, registration) | URL | URL | Menu | Menu | bypass | none | **PERM** (web) **and NONE** for `api/admission_enquiry|online_admission_confirm|admission_registration` CRUD incl. DELETE (AUTH-05 (LMS-AUDIT-009)) |
| Attendance (student/staff) | Menu (own view seeded) | Menu | Menu | Menu | bypass | none | **PERM** (web). HR attendance `api/attendance/*`: JWT in trait, **no role check**, `user_id` from body (AUTH-10 (LMS-AUDIT-004)) |
| Exam (creation, master, marks entry, online exam, progress) | Online-exam pages check student; staff pages: URL | URL | Menu | Menu | bypass | none for `/exam/exam-creation|exam-master|marks-entry|progress-report` | Legacy **PERM**; new `/api/result/*` = **SESS** (181 routes, no role/rights check — AUTH-10 (LMS-AUDIT-004)) |
| Result (report cards, masters, CBSE) | URL | URL | Menu | Menu | bypass | none | **SESS** (`resultapi.php:52`), `MarksEntryApiController` delegates to legacy controller **skipping** `check_permissions` (AUTH-10 (LMS-AUDIT-004)). Menu mapping dead (AUTH-13 (LMS-AUDIT-058)) |
| LMS teacher pages (homework, assignments, planning, reports) | **RS redirect** (cosmetic) | URL (RS passes non-`student`) | Menu | Menu | bypass | `RequireStaff` (29 pages) | Mixed: **STAFF** for review/annotate; **NONE** for `lms-homework/*`, `lms-courses*`, `lms-question-bank*`, `lms-chapter*` (AUTH-05 (LMS-AUDIT-009)); write routes `lms.auth`+`perm` are **warn-only** (`LmsApiAuth`, `RequirePermission`) |
| LMS student pages (submission, leaderboard, doubts) | Menu | URL | Menu | Menu | bypass | none | **SESS** (submission/leaderboard); homework submission legacy **NONE** |
| Course Master / Chapters / Question bank / Teach-Learn | URL | URL | Menu | Menu | bypass | none | **NONE** + `lms.auth` warn-only (`routes/api.php:191-262`); question-paper CRUD **NONE** (AUTH-05 (LMS-AUDIT-009)) |
| PAL / New PAL | Own data (view-as is staff-only in UI) | URL | Menu (class-scoped) | Menu (institute-scoped) | client/platform scoped | `isStudentSession()` for view-as; **no route guard** | **PAL** = `pal.auth` (169 routes): JWT + learner/tenant ownership — strongest control in the estate |
| H5P (content + players) | Players menu | URL | Menu | Menu | bypass | student checks on authoring lists | Not traced (`NOT VERIFIED`; mostly `/api/pal/h5p`, `lms/*`) |
| HRIT: leave, attendance, payroll | URL | URL | Menu (own leave) | Menu | bypass | none | Leave/attendance: JWT (trait) + **no role check** — any token can `POST leave/requests/{id}/decision`, `PUT leave/workflow|roles|leave-types|holidays` (AUTH-10 (LMS-AUDIT-004)); payroll legacy **PERM** |
| Talent / Task / Competency / Performance / Onboarding / G2G-LMS (`api/talent|task-management|competency|performance|onboarding|mobility|offboarding|g2g-lms`) | **403** (`staff.only`) | **403** by name | **Allowed** (any staff profile, incl. Teacher) | Allowed | Allowed | none | **STAFF** (583 routes) — a blocklist, not RBAC (`RequireStaffRole.php` docblock) |
| Organization management: employee directory, compliance, disciplinary | Menu/URL; **API open to any token** | same | same | same | same | none | **SESS** only (54 routes); `index()` self-scope disabled by `?menu_type=`; `show()` returns full `tbluser` row (AUTH-03 (LMS-AUDIT-013)) |
| Role & permissions (RBAC editor) | URL | URL | URL | Menu | Menu | avatar dropdown, unconditional | **CTRL** `assertIsAdmin()`: `is_admin` or name `=== 'Admin'` exactly (`RolePermissionsController.php:63-78`) |
| User master / profiles / reports | Menu if granted | same | same | same | bypass | server-driven `rights` object | **CTRL** JWT + rights of `add_user.index` / `add_user_profile.index`; admin = name in {admin, super admin} |
| Access rights (group-wise, individual, mobile-app) | URL | URL | URL | Menu | Menu | dropdown (group/individual commented out, mobile rights visible) | **CTRL** JWT + actor rights (`GroupwiseRightsApiController.php:40-130`) |
| Audit / User log | Menu if granted | same | same | same | bypass | none | **CTRL** JWT + rights `user_log.index`; **SPA activity is never written** (AUTH-21 (LMS-AUDIT-222)) |
| Communication (easy_com: SMS/email/WhatsApp/notification, SMTP & SMS-gateway config) | URL, **API open to any token** | same | same | same | same | none | **SESS** only (`easycomapi.php:32`, 36 routes, no rights/role check in `BaseEasyComApiController`) (AUTH-10 (LMS-AUDIT-004)) |
| Front desk, petty cash, complaints, consent, PTM, teacher transfer | Menu if granted | same | same | same | bypass | none | **CTRL** (JWT + tenant match + rights) for the headless controllers; legacy **PERM** |
| Inventory, Transportation setup, General/Academic setup, Class teacher, Custom fields | Menu if granted | same | same | same | bypass | none | **CTRL** (JWT + `authorizeModule`); legacy **PERM** |
| Document templates (`/document-templates`, certificates) | URL | URL | Menu | Menu | bypass | none | **NONE** — `DocumentTemplateApiController` decodes the JWT **without verifying the signature** and falls back to request params (AUTH-06 (LMS-AUDIT-012)); merge-data/preview-students expose student rows |
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
1. `line 76`: the entire rights evaluation is wrapped in `if (!Str::contains($request->submit, 'Search'))` where `$request->submit` is any client-supplied input (AUTH-02 (LMS-AUDIT-003)).
2. `line 44`: `if ($menu_id != '')` — a route whose **name** matches no active `tblmenumaster.link` row is not checked at all (fail-open). Missing rights row => `$can_view=0` => denied only when a menu row exists.
3. Allowlists by menu id (`82,386` for update, `200` for delete) hardcoded and environment-specific (the `rbac_modules.php` docblock says the same).
4. Rights are keyed on `user_profile_id` **from the token**: a role change or profile re-assignment is invisible until the user logs in again (no revocation, AUTH-07 (LMS-AUDIT-062)).
5. Path-substring matching (`'delete'|'destroy'|'update'|'store'|'add'|'save'` in `request()->path()`) decides which right applies; anything else falls to the HTTP method (POST => `can_add`).

### 3.5 Student / teacher seed grants (migrations, not live data)
`2026_08_25_150000_grant_student_role_full_workflow_rights`, `…150100`, `…150200`, `…160000`, `…170000` seed per-tenant `Student` profile rights by `tblmenumaster.link` (view-only for own fees/attendance/documents; add for homework/assignment submission; `can_edit`/`can_delete` never granted). `NewLMS_ApiController::INSERT_RIGHTS` hardcodes all four flags to 1 for every provisioned profile incl. Student (per `docs/admin-user-journey.md` §8.5; not re-read by me). Live state `NOT VERIFIED`.

---



## C. Per-area access-control findings (frontend gating vs backend enforcement)

### Part 02 - Next API routes

## 3. Role / access-control findings (frontend gating vs backend enforcement)

The Next layer enforces **nothing** itself except the following presence checks (none verifies a signature/expiry):

| Handler group | Next-side check | Real enforcement |
|---|---|---|
| dashboard/* (6) | `x-laravel-token` header non-empty | Laravel `api.session` (JWT signature) + controller 403 by role (`RoleDashboardApiController`, `TeacherIcardApiController` reject `is_student`) - verified |
| fees/dashboard, admissions/students/library/hostel/transportation dashboard (6) | none (token optional: `if (token) headers.set(...)`) | fees: `api.session`+`check_permissions` (routes/api.php:133); **other five: none** (routes/api.php:140-144, "stateless ... no session middleware is required") |
| fees/reports/* (17), fees/menu-categories, teach-learn/menu-categories, modules/menu-categories (2) | header presence of sub_institute_id/syear (reports) or sub_institute_id/user_id (menus); token optional | Laravel `session` middleware validates JWT for `type=API` (`SessionMiddleware.php`), then `check_permissions` menu rights |
| ai/field-edit, ai/assistance-tickets | `Authorization` header present (any string) | Laravel `McpAuth` verifies JWT (routes/ai.php) |
| ai/ask/stream, mcp/* | none | `McpAuth` + `McpRateLimit` (60/min/user) + `McpContextHydrator` (institute must be in JWT scope unless `is_admin==2`) |
| integration-configs (6 methods) | `Authorization` header present (any string) | **nothing** |
| agents/* (5 methods) | GET/list/runs: `x-sub-institute-id` and `x-user-id` non-empty. Writes: Laravel `/api/permissions?modules=agents.<m>` using the request's token **and request's base URL** | Laravel only as far as the client cooperates; see NAPI-02 (LMS-AUDIT-002)/03 |
| conversational-ai/* (3) | `x-laravel-token` non-empty; writes additionally call Laravel `/api/permissions` (same base-URL flaw) | same |
| process/convert, screenCandidate, question-paper/asset, forgot-password, google-auth | none (public) | n/a |
| proxy / proxy-file / library/books-list / pal/submit / import/parse|process | forward `Authorization`+`Cookie` | Laravel per target route |

Role (`x-user-profile-id/-name`) is read from headers in `fees-report-proxy.ts` (appended to Laravel query as `user_profile_id`, `user_profile_name`)
and menu proxies (`user_profile_name`). Laravel's JWT hydrator overwrites session role from the token, so that is harmless for the `session`-guarded
routes, but the Next code plainly treats client headers as identity, and `lib/agents` records them in the audit log as authoritative (NAPI-03 (LMS-AUDIT-002)).



### Part 03 - Infra, config, tests, docs

## 3. Role / access-control findings (infra-level)

- **No `middleware.ts`/`proxy.ts`**. Confirmed by `git ls-files`. Nothing at the Next edge or server gates page routes. The `app/hooks/usePermission.ts` source says its own hook is "advisory".
- **Next route handlers have no uniform auth layer.** Route handlers are thin proxies. Some check for a token header, many only forward it. Enforcement is delegated to Laravel. `lib/agents/acting-user.ts` calls Laravel `/api/permissions` on a base URL the caller chooses (INFRA-01 (LMS-AUDIT-001)/02).
- Heuristic per-file auth check (own-file grep only, `NOT VERIFIED` for shared helpers): routes with **no visible token check and no shared-proxy helper**: `agents/*` (4), `conversational-ai/*` (3, they only require a non-empty token string), `forgot-password`, `google-auth` (public by nature), `import/match-fields`, `import/tables`, `modules/menu-categories*` (2), `pal/content-model`, `pal/pedagogy-engine`, `process/convert` (**no auth at all**, calls a paid LLM), `screenCandidate` (**no auth at all**, calls 3 paid LLM providers).
- Client role logic: `user_profile_id` appears in 36 files (80 hits), `user_profile_name` in 63 files (140), `is_admin|isAdmin` in 25 files (66). Role names are compared client-side as strings (`app/dashboard/_lib/resolveDashboardRole.ts:3-5` per `docs/teacher_role_audit.md`). Server enforcement lives in Laravel and is outside this part.



### Part 04 - LMS / H5P / Exam / Result

## 3. Role / access-control findings (frontend gating vs backend enforcement)

Global facts: there is no `middleware.ts`; the only page guard is `ConditionalApp` (`app/components/ConditionalApp.tsx`) which shows `LoginPage` when `!isAuthenticated` (client state). Role gating is a per-page client convention: `RequireStaff` (`app/lms/_shared/RequireStaff.tsx`) redirects a "student session" (localStorage `user_profile_name`) - it is a UX backstop, never a control. Used on 25 LMS pages (+ fees/documents/student); **not used** in `app/result`, `app/exam` (except a note banner), `app/course-master/**` (except a preview toggle), `app/h5p/**` (only `isStudentProfile()` to hide edit buttons), `app/quiz`, `app/subjects`, `app/chapters`, `app/sqaa`, `app/learning-outcome`.

| Module | Frontend gating | Backend enforcement | Verdict |
|---|---|---|---|
| Result (all 31 screens) | None. Hub `/result` lists every screen to any authenticated role. | `api.session` only (JWT valid). No `staff.only`, no `check_permissions`, no rights lookup. Only `DropdownApiController` reads profile name to narrow lists. | **Student/parent/teacher can call every master mutation, marks entry, approval, report and upload.** (LMS-03 (LMS-AUDIT-004), LMS-11 (LMS-AUDIT-077)) |
| Exam - online attempt | `isStudentProfile()` only decides a banner ("You're not a student"). | `lms/online_exam` behind menu middleware but no role/ownership/window/attempt check; `user_id` taken from request. | Any authenticated user can submit as any `user_id` (LMS-07 (LMS-AUDIT-073)/08/09). |
| Exam - AI paper / LMS Exam Operations | `audienceMode` from profile string; "Teacher" UI hidden for students. | `/api/question-paper*`, templates, blueprints, evaluation: **no auth at all**; role for listing is the `user_profile_name` query param. Only result-dashboard has `api.session+staff.only`. | Anonymous (LMS-04 (LMS-AUDIT-019)/05). |
| Homework | `RequireStaff` on staff pages. | Legacy `lms-homework/*`: none, role from body. v2 submit/detail: `api.session` and pinned to session student. Review routes: `api.session+staff.only` but no tenant/ownership scoping on `find($id)`. `submission-file/{id}` any authenticated user, no ownership. | Split; gaps (LMS-06 (LMS-AUDIT-021)/18). |
| Assignment | `RequireStaff` on authoring/annotate pages. | Enforced: `api.session`(+`staff.only`) - the later registration overrides the earlier anonymous duplicates. | OK (note the fragile duplicate registration). |
| LMS planning | `RequireStaff`. | `/api/intelligence/*`, `/api/lesson-intelligence/*`: none. | Anonymous (LMS-06 (LMS-AUDIT-021)). |
| Leader board / social | student toggle in UI. | `api.session` (tenant/user from token), master `staff.only`. | OK. |
| Course master authoring | `isStaff` preview toggle only; `RequireStaff` absent. | `ApiLmsCourseController`: no auth; role check uses client `user_profile_name`. `lms.auth`/`perm:` on 3 legacy write routes are **warn-only** (`config('lms_content.api_auth_enforce', false)`). | Anonymous / spoofable (LMS-04 (LMS-AUDIT-019), LMS-21 (LMS-AUDIT-086), LMS-34 (LMS-AUDIT-242)). |
| H5P | `isStudentProfile()` hides edit/delete buttons. | `H5PContentTypeController` write actions (`store/update/destroy/publish/duplicate/import/media`) have no role check; students only lose draft visibility on read. Legacy flashcard/video/scenario use unscoped `findOrFail`. `get-h5p-ai-scenario` has no middleware. | No server authz (LMS-17 (LMS-AUDIT-083)). |
| Quiz / Subjects / Chapters | none | n/a / anonymous `lms-courses` | mock / anonymous |
| Learning outcome | none | `MigrationModulesApiController::guard` validates the JWT signature only; tenant/user from body | LMS-20 (LMS-AUDIT-085) |
| SQAA | none | `api.session`, tenant from token; no role check | acceptable; all roles can write |
| Teach/Learn | none | `api.session`+`check_permissions` (menu rights) | OK backend; proxy SSRF (LMS-19 (LMS-AUDIT-001)) |

Roles:
- Admin/Teacher/Student/Parent: `user_profile_id -> tbluserprofilemaster.name` (`HydratesLegacyApiSession` maps `is_admin` 1/2 to "Super Admin"). `staff.only` = *blocklist* of student/parent only (`RequireStaffRole`), so any other profile name passes; `RequireLmsStaff` passes anonymous callers through (defers to controller).
- `check_permissions` (`checkPermission.php`) resolves rights by `tblmenumaster.link == Route::currentRouteName()`; resource sub-routes (`.store/.update/.create`) will only be checked if a menu row carries that exact route name. NOT VERIFIED against DB (LMS-32 (LMS-AUDIT-057)).

---



### Part 05 - PAL / AI / Intelligence

_(section 3 not found in part05-pal-ai-intelligence.md)_


### Part 06 - Fees / Finance / Operations

## 3. Role / access-control findings (frontend gating vs backend enforcement)

| Module | Frontend gating | Backend enforcement | Verdict |
|---|---|---|---|
| Whole app | `ConditionalApp.tsx:45` only checks `isAuthenticated`; sidebar hides menus by rights but direct URL works | n/a | client-side hiding only |
| Fee collect (`/fees/collect*`) | none | `check_permissions` skipped for `fees_collect.store/edit` (route name is not a menu link); `show_student` named `fees_collect.show_student` likewise | any authenticated JWT (student/teacher/parent) can call collect endpoints if menu rows do not exist for these route names (NOT VERIFIED - DB). Discount / back-date / fine have no role gate anywhere |
| Fee cancel | none; no confirm dialog (`cancel-refund/page.tsx:242-315`) | `feesCancelController::store` validates the JWT but reads tenant/user/syear from request (`feesCancelController.php:256-260`) | authorisation absent; tenant spoofable |
| Refund | none | `FeesRefundApiController::denyUnlessAllowed` (`FeesRefundApiController.php:15-28`): allows names `super admin/admin/school admin`, else menu rights for link `fees_refund` / `fees/fees_refund` (real links are route names such as `fees_refund.index`) so non-admin roles with granted rights are probably denied - functional bug, secure default | only correctly gated money action |
| Online payment settings | none | resource routes, name `online_fees_settings_api.store` => no menu => no rights check | any staff/parent JWT can add/delete gateway merchant credentials (redirecting settlements) |
| Fee structure masters (config/late/receipt book/breakoff/title) | none | as above + tenant from request | same |
| Reports (collection/defaulter/cancel/structure) | none | tenant from request; rights by index route only | same |
| Audit logs / online payments / reconciliation | none | no rights check, no tenant scope | any JWT sees every tenant |
| Module dashboards (library, hostel, transport, admissions, students) | dashboard role resolver falls back to `admin` for unknown profiles (`resolveDashboardRole.ts:20-21`) | **no middleware** (`routes/api.php:140-144`) | unauthenticated |
| Teacher fee dues | profile check in BE | teacher only, class scoping = cross product of standard x division (FIN-29 (LMS-AUDIT-308)) | over-exposure within tenant |
| Inventory / Transportation / Hostel (API controllers) | hostel hides add/edit/delete using server `permissions`; inventory/transport pages ungated | In-controller `guard()`/`context()` bind actor + tenant to the JWT and check rights by legacy menu link (admin names bypass; deny by default when link missing) - best-enforced modules; `syear` client-supplied (FIN-44 (LMS-AUDIT-312)); no maker-checker in inventory (FIN-48 (LMS-AUDIT-129)) | server-side good, functional gaps |
| Library | delete gated only by `userProfileName.toUpperCase()==='ADMIN'` (`book_resources/page.tsx:696`) | web routes `session` + route-name `check_permissions`; `submit=Search` bypass (FIN-41 (LMS-AUDIT-003)); IDOR (FIN-60 (LMS-AUDIT-134)) | weak |
| Visitor / front desk / inward / utility / custom-module / bazar | none (`window.confirm` only, 15 sites) | mutators have different route names than menu links, custom-module and front-desk groups have no `check_permissions`, visitor create is public | effectively open (FIN-39 (LMS-AUDIT-030), 66, 70, 76, 81, 82) |

---



### Part 07 - Students / Admissions / Attendance

## 3. Role / access-control findings (frontend gating vs backend enforcement)

Frontend
- There is no `middleware.ts` / `proxy.ts`. The only page-level gate is `app/components/ConditionalApp.tsx`, which renders `LoginPage` for any route while `!isAuthenticated` (client-side, localStorage-derived). Nothing role-gates the student/admission/attendance/admin pages: grep for `RequireStaff|useMenuRights|isStudentSession|canAccess` in this scope finds only `documents/*` (`canAccessDocuments`), `dashboard/page.tsx` (role -> dashboard), and `student/my_icard` (`isStudentSession` redirect). A student who types `/students/search_student`, `/student/bulk_student_update`, `/admissions/admission_enquiry`, `/user/add_user` gets the full UI; the only barrier is the backend.
- docs/student-menu-report.md explicitly states these modules are "staff/admin screens ... do not grant them to the student role" and relies on server-side menu grants. That is a menu-visibility control, not an authorization control.
- `resolveDashboardRole` maps any unrecognized `user_profile_name` (Parent, Accountant, Principal, HR...) to the Admin dashboard component (`app/dashboard/_lib/resolveDashboardRole.ts:20-21`). Data is still server-scoped by `RoleDashboardApiController`, so this is a UX defect, not a leak.

Backend enforcement per module

| Module | Enforcement actually present |
|---|---|
| Admission APIs (`/api/admission_enquiry`, `/api/admission_registration*`, `/api/admission_student`, `/api/online_admission_confirm*`) | None. No middleware, no JWT check, no rights. STU-01 (LMS-AUDIT-034)/02. |
| `student/api/student_certificate|student_icard|teacher_icard/*` | None. STU-03 (LMS-AUDIT-036). |
| adminapi student controllers (`get_adminStudentSearch`, `bulk-students`, `student-care`, `student-infirmary`, `student-setup`, `student-optional-subject`, `student-registration`) | JWT signature valid = allowed. No role check (a student token works), no rights check, tenant from request body. STU-05 (LMS-AUDIT-038). |
| Legacy `student/*`, `school_setup/proxy_master`, `admission/*`, `front_desk/*` via `session` middleware | JWT validated and session hydrated from claims (good), then `checkPermission` runs only if the route name has a `tblmenumaster` row (`checkPermission.php:44`, fails open otherwise), and controllers frequently override the verified tenant with `$request->sub_institute_id` for `type=API`. STU-06 (LMS-AUDIT-039), STU-15 (LMS-AUDIT-003). |
| `ClassTeacherApiController`, `TeacherTransferApiController`, `AcademicSetupApiController`, `TeacherDailyReportApiController`, `UserLogReportApiController`, `UserManagementApiController` | Correct: token id/tenant must equal request `user_id`/`sub_institute_id`, actor must be active in tenant, `tblindividual_rights`/`tblgroupwise_rights` checked per action. Note the hard-coded bypass for profile names `admin`/`super admin` in AcademicSetup (`AcademicSetupApiController.php:105`); `School Admin` relies on rights rows. |
| Role dashboards, `teacher-icard/mine`, Documents | Correct (api.session, is_student rejected, admin profile list). |
| Students / Admissions module dashboards | None. STU-29 (LMS-AUDIT-005). |
| Complaints / Consent / other stateless APIs | JWT signature only, tenant + `user_id` from client (`ComplaintApiController.php:45-72`, `store` uses `COMPLAINT_BY = request user_id`). Same class as STU-06 (LMS-AUDIT-039). |

Tests exist for the hydrator (`tests/Feature/Security/SessionMiddlewareAuthBypassTest.php`) and RBAC (`RbacEnforcementTest.php`) but they do not exercise these controllers; the hydrator being safe is defeated by controllers re-reading request input.

---



### Part 08 - HR / Org / Tasks / General

## 3. Role / access-control findings (frontend gating vs backend enforcement)

| Module | Frontend gating | Backend enforcement | Gap |
|---|---|---|---|
| Leave | Configuration page: `includes('admin')||includes('hr')` on `menuContext.user_profile_name` (`leave-configuration/page.tsx:19-22`). Requests/dashboard: none; Approve/Reject/Bulk buttons visible to all | `ResolvesLeaveContext` validates JWT only. No role check in `decision`, `bulkDecision`, `destroy`, `store(employee_id)`, or any config endpoint. Workflow + role-permission settings are stored but never read by the decision path | Any authenticated JWT (including a student token, since `/api/leave/*` has no `staff.only`) can approve/reject/withdraw any leave, apply on behalf of anyone, and rewrite leave types/holidays/workflow. See HR-09 (LMS-AUDIT-068) |
| Attendance | none | JWT only; `user_id`/`employee` from request body | Any user can punch or read another user's attendance. HR-11 (LMS-AUDIT-164) |
| Payroll | `PayrollPageShell` substring gate | `check_permissions` middleware, which is fail-open when no `tblmenumaster.link` equals the route name (`checkPermission.php:36-44`); new `hrit.payroll.*` menu rows do not match route names | Rights assigned in Role & Permissions UI to hrit.* rows do not control the server. HR-24 (LMS-AUDIT-338) |
| Talent | none in-page beyond menu | `staff.only` blocks student/parent; reads open to every staff profile; writes `is_admin` in {1,2} only | Teachers can read every employee's compensation revision, bonus and appraisal lists (`PerformanceCompensationController::index:44-88`). Tenant "HR Manager" (is_admin=0) cannot write. HR-17 (LMS-AUDIT-169) |
| Org management | Role & permissions page only | `api.session` only (no `staff.only`) for employee directory, disciplinary, compliance. Role-rights writes correctly admin-gated (`RolePermissionsController::assertIsAdmin:52-68`) | HR-03 (LMS-AUDIT-013), HR-16 (LMS-AUDIT-168) |
| Task management | `canAdminister` toggles in Integration UI | tenant scope only. `task.permission` only on 4 read routes. Approve blocks only the literal profile "Employee" (`WorkspaceController::isEmployeeProfile:348`) | HR-22 (LMS-AUDIT-171) |
| Admin services | none | JWT valid + request `sub_institute_id`/`user_id`; front desk "admin" = profile name ADMIN of the *request-supplied* user_id | HR-07 (LMS-AUDIT-043) |
| Easy com | none | `api.session` only | HR-21 (LMS-AUDIT-004) |
| General config APIs | n/a | Token/context match + profile + group/individual rights (Groupwise, Individual, MobileApp, CustomField, GeneralSetup, UserManagement) | Good pattern, HR-36 (LMS-AUDIT-452) |
| Import | none | `api.session` only | HR-15 (LMS-AUDIT-064) |
| Document templates | none | none (forgeable) | HR-02 (LMS-AUDIT-012) |

---



### Part 09 - Routes / APIs / Orphans

## 3. Role / access-control findings (frontend gating vs backend enforcement)

| Layer | Finding | Evidence |
|---|---|---|
| Page gate | Client-side only. `ConditionalApp` renders `LoginPage` when `useAuth().isAuthenticated` is false; there is no middleware.ts/proxy.ts, so every page bundle is served to anonymous users and only rendering is withheld. `isAuthenticated` derives from localStorage (`auth`, `userData`, `sessionDate == today`). | app/components/ConditionalApp.tsx:26-46; contexts/AuthContext.tsx:38-41,134 |
| Role gating in UI | Not systematic: `usePermission` (calls `GET /api/permissions`, an `lms.auth` fail-open route) is reachable from 65/676 pages; `useMenuRights` from 111/676; 158 pages reach AuthContext. Most pages rely on the DB-driven menu to hide links, not on route guards; a URL typed by hand opens any page for any logged-in role. | graph reachability (this part); app/hooks/usePermission.ts:79 |
| Route protection of Laravel APIs | 3 different mechanisms coexist (ORPH-15 (LMS-AUDIT-345)): route middleware `api.session` (JWT validated + session hydrated), in-controller `GetsJwtToken->validate()` on `api`-group routes (135 called routes), and `lms.auth`/`perm:*` which pass anonymous callers unless env LMS_API_AUTH_ENFORCE is true. 249 called routes have none of these at route level; 114 have no token reference in the controller either. | routes/api.php; app/Http/Middleware/LmsApiAuth.php:26-37; config/lms_content.php:144 |
| Identity source on the server | For the unauthenticated group the tenant/user come from request input (`$request->input('sub_institute_id')`), so the caller chooses the tenant. For api.session routes the tenant comes from verified JWT claims (HydratesLegacyApiSession). | AdmissionsDashboardApiController (validate sub_institute_id from request); StudentHomeworkApiController:22-26 |
| Next handlers | `/api/agents/*` and `/api/conversational-ai/*` build the acting user from client headers `x-sub-institute-id`, `x-user-id`, `x-user-profile-name` and then ask Laravel `/api/permissions` (fail-open lms.auth) for rights; `x-laravel-base-url` header selects the upstream (ORPH-05 (LMS-AUDIT-001)). | lib/agents/acting-user.ts:22-34,53-89 |
| Per-module frontend-vs-backend | api.session + staff.only modules (talent, competency, organization, task, hrms, g2g): both layers aligned. LMS/admissions/admin-services/fees-circular legacy api.php modules: frontend passes `sub_institute_id`, `syear`, `user_id`, `user_profile_name` in body/query; backend either validates JWT in-controller (complaints, consents, front-desk, petty-cash, class-teachers, users, rights, inventory...) or trusts input (the 114). | data-api-calls section 5 |



### Part 10 - Laravel authz / tenant

## 3. Role / access-control findings (per module: frontend gating vs backend enforcement)

Key mechanism facts (verified in code):

1. **Identity is taken from the JWT only where a middleware/trait says so.** `HydratesLegacyApiSession::hydrateSessionFromClaims` (`app/Http/Middleware/Concerns/HydratesLegacyApiSession.php:64`) sets session `user_id`, `sub_institute_id`, `user_profile_id`, `is_admin`, `client_id`, `is_student` from the verified payload; it accepts `syear`/`term_id` from the request (allowed: same tenant only). `api.session` and (for `type=API`) the `session` middleware use it. Roles = `tbluserprofilemaster.name` looked up by `user_profile_id` (`'Super Admin'` forced if `is_admin` is 1 or 2). It does **not** re-check `tbluser.status`, so a deactivated user's token keeps working (BE-16 (LMS-AUDIT-062)).
2. **Authorization = menu-rights tables** (`tblindividual_rights`, `tblgroupwise_rights`) enforced by `checkPermission` middleware keyed on the **route name → `tblmenumaster.link`** (`checkPermission.php:44`). Three defects: (i) fail-open when the route has no name or no menu row (`if($menu_id!='')`); (ii) the whole check is skipped when the client sends a `submit` field containing "Search" (`checkPermission.php:76`, `!Str::contains($request->submit,'Search')`); (iii) allow-list hacks `!in_array($menu_id,[200])`, `[82,386]`. → BE-10 (LMS-AUDIT-003).
3. **No Gates/Policies**; `AuthServiceProvider::$policies` empty. Newer modules use their own gates: `staff.only` (blocks Student/Parent profile names), `RequiresTalentAdmin` (`is_admin` 1|2), `perm:` (`RequirePermission` → `PermissionService`) — but `perm:` and `lms.auth` are **warn-only unless `LMS_API_AUTH_ENFORCE=true`** (`config/lms_content.php:144`, default false) — they log and let anonymous callers through.
4. Frontend role gating vs backend: the frontend hides pages by role, but every family below except Users/Brain/PAL/AcademicSetup-style controllers accepts any valid token for any action.

Per-module (frontend gating cannot be relied on; only backend enforcement listed):

| Module | Backend enforcement actually present | Gap |
|---|---|---|
| Users, profiles, rights editors, academic/transport/general/inventory setup, class teachers, teacher transfer, user logs, custom fields, teacher daily report | Tier A: `context()` verifies JWT, compares token `id`+`sub_institute_id` with request, loads active actor, then `authorizeAction()` checks `admin/super admin` or `tblindividual_rights`/`tblgroupwise_rights` for the menu link | Role test is by tenant-defined profile *name* (`in_array(strtolower(profile_name),['admin','super admin'])`) — a tenant that creates a profile called "Admin" gets admin here |
| Leave (34 routes) & HR attendance (9) | tenant from token (`ResolvesLeaveContext`, `ResolvesAttendanceContext`); every query filtered by tenant | **No role check**: any token (student included) can `POST /api/leave/requests/{id}/decision`, `bulk-decision`, `PUT /leave/workflow`, `PUT /leave/roles`, `POST /leave/leave-types`; approver identity = request `user_id`; `employee_id` in `store` lets a caller apply leave on behalf of anyone (validated only by `exists:tbluser,id`, not tenant) — BE-13 (LMS-AUDIT-068) |
| Result API (185), EasyCom API (36), Org-mgmt (54, only `RolePermissionsController` asserts admin), Documents, Mobile page builder | `api.session` only | Legacy `checkPermission` was *dropped* when the JSON twins were written (`BaseEasyComApiController` docblock says so). A student token can `POST /api/result/marks-entry/approve`, send SMS/email/WhatsApp to parents, edit result masters — BE-12 (LMS-AUDIT-004) |
| Talent / competency / task | `staff.only` (bare Student/Parent excluded); `RequiresTalentAdmin` on 27/63 talent controllers; `task.permission:report.view` on 4 routes | 36 talent controllers (incl. `Recruitment/CandidateController`, `Performance/PerformanceActivityController`, `Performance*Compensation/Bonus/Review` partially) reachable by any staff role, incl. Teacher/peon |
| LMS authoring (4 routes) | `lms.auth` + `perm:lms.content,create` | warn-only default; the other ~40 `api.php` LMS routes, including question-bank create/update/delete/review and `lms-chapters/store`, `lms-store-subject`, have nothing (BE-07 (LMS-AUDIT-009)) |
| Dashboards | `admin-dashboard`, `teacher-dashboard`, `student-dashboard` identity from JWT (good) | `admissions/students/library/hostel/transportation-dashboard/summary` = no auth |
| AI console (`/api/ai/*`) | `McpAuth` (any valid JWT, students included) + tenant context; tickets/reports/outcomes controllers gate on `$scope->isAdmin` | `AiConfigurationController`, `AiModuleModelController::storeCredential`, `AiPolicyController`, `AiTemplateController` have **no role gate** (BE-19 (LMS-AUDIT-006)) |
| MCP tools | role ∈ {admin, staff, student}; `student` denied for all tools by default (`allowedRoles()`=admin,staff); `AdmissionsConfirmTool` additionally requires admin | `required_permission` annotation on 93 tools is decorative (BE-20 (LMS-AUDIT-178)) |
| PAL/ESO | `pal.auth`: learner ownership (student = own id; teacher = class-teacher/timetable scope; admin = tenant/client scope) | good; 4 pedagogy-engine reads anonymous |
| Brain | JWT + tenant + role map by *profile name* + per-verb permission | tokens signed with `APP_KEY` also accepted (BE-16 (LMS-AUDIT-062)) |

---



### Part 12 - Uploads / Import-Export / Notifications / Jobs / Integrations

## 3. Role / access-control findings (frontend gating vs backend enforcement)

| Module | Frontend gating | Backend enforcement | Finding |
|---|---|---|---|
| Import (`app/import-data/page.tsx`) | none (no role/permission check in file) | `api.session` only | any role can bulk-create `tbluser`/`tblstudent` (HR-15 (LMS-AUDIT-064), INT-12 (LMS-AUDIT-192)) |
| Send SMS/WhatsApp/e-mail (`app/easy_com`) | menu only | `api.session` only (HR-21 (LMS-AUDIT-004)) | INT-24 (LMS-AUDIT-366) |
| `POST /unlink-file` | none (legacy Blade) | route in T1 group but `check_permissions` skips unmapped names | INT-03 (LMS-AUDIT-051) |
| `crm-whatsapp`, `transferDocs`, `convertDoc`, `send_birthday_notification`, `Resend_otp`, `/import_*` | n/a | **no auth** | INT-01 (LMS-AUDIT-016)/02/05/20 |
| Bulk document zip `missing_document_report/download-bulk` | menu | T1, tenant from session (good); all staff of tenant incl. Aadhaar/PAN zipped for any user with the menu right | INT-35 (LMS-AUDIT-377) |
| `easy_com/smtp`, `sms-api`, `whatsapp-api` credential CRUD | menu | `api.session` only; responses mask passwords/URLs (good) | HR-21 (LMS-AUDIT-004) |
| Platform Services (notification/scheduler/workflow) | `perm:*` on writes | `lms.auth` + `perm` (good) | but configuration is not consumed (INT-25 (LMS-AUDIT-367)) |
| Exam evaluation file/scan | tenant from request body | `exam-evaluation/*` is in `api_guard.protect` -> JWT school must equal `sub_institute_id` | good |

Frontend never restricts file upload/export by role; every enforcement point above is server side.



## D. Authorization issues in the master register (140)

| ID | Severity | Module | Issue | Source IDs |
|---|---|---|---|---|
| LMS-AUDIT-002 | Critical | Agents engine + Conversational AI admin… | Agents / conversational-AI engine trusts client headers for tenant+user, has unauthenticated list/run endpoints, and checks RBAC against the caller-chosen host | NAPI-02, NAPI-03, INFRA-02, AI-01, AI-C03, AI-C04 |
| LMS-AUDIT-003 | Critical | Rights enforcement (`check_permissions`) | check_permissions skips all rights checks when submit contains "Search" and fails open on routes with no menu row | AUTH-02, BE-10, FIN-41, FIN-14, STU-15 |
| LMS-AUDIT-004 | Critical | Result API, Easy Communication, Organiz… | Result API, Easy Communication and Organization-management route groups authenticate but never authorize role/rights | AUTH-10, BE-12, LMS-03, HR-21 |
| LMS-AUDIT-005 | Critical | Module dashboards (Laravel unauthentica… | Module dashboard summary endpoints (admissions/students/library/hostel/transport) have no middleware and filter by body tenant | NAPI-04, FIN-13, STU-29 |
| LMS-AUDIT-006 | Critical | AI console — providers, models, policie… | Any authenticated user (incl. students) can write AI provider keys, policies and prompt templates | AI-D01, AI-04, BE-19 |
| LMS-AUDIT-008 | Critical | Generic table API, menu rights, LMS cou… | Anonymous /table_data and /lms_data dump any DB table (incl. tbluser plaintext passwords); frontend depends on it | BE-01, HR-01, ORPH-01 |
| LMS-AUDIT-009 | Critical | ~90 controllers / 378 routes with no au… | ~90-195 Laravel API controllers (~300-378 routes) and ~425 web routes have no authentication and take tenant/user from the request | BE-07, AUTH-05, ORPH-02 |
| LMS-AUDIT-010 | Critical | Menu / navigation backend (`/api/menu-r… | Unauthenticated POST /api/menu-rights builds SQL from raw request values | AUTH-01, HR-05 |
| LMS-AUDIT-011 | Critical | Fees / Online payment gateways | ICICI/ICICI-Orange/PayPhi/AggrePay payment callbacks are unauthenticated with no signature verification (forged success issues receipts) | FIN-01, BE-08 |
| LMS-AUDIT-013 | Critical | Organization Management > Employee Dire… | Employee Directory API: authentication only, mass-assignment, returns tbluser (password/plain_password/otp) to any token incl. students | HR-03, AUTH-03 |
| LMS-AUDIT-018 | Critical | Online exam result / attempt breakdown | `online_exam_id` and `user_id`/`student_id` from the request are concatenated into `DB::select("... | LMS-02 |
| LMS-AUDIT-019 | Critical | Question papers, question bank, course… | These routes are registered at file level with no `api.session`/`lms.auth`. | LMS-04 |
| LMS-AUDIT-020 | Critical | LMS Exam Operations - Exam Evaluation,… | The whole feature - upload scanned answer sheets, edit teacher marks, approve, **publish into the gradebook (`lms_offline_exam`, `lms_offline_exam_answer`)**,… | LMS-05 |
| LMS-AUDIT-021 | Critical | Legacy homework family, lesson planning… | Unauthenticated endpoints with client-supplied identity. | LMS-06 |
| LMS-AUDIT-022 | Critical | PAL Test result (`/lms/pal/{id}`), cons… | `online_exam_id` is read straight from the query string (`$online_exam_id = $request->get('online_exam_id')`) and concatenated into a raw `DB::select` string: | AI-A01 |
| LMS-AUDIT-023 | Critical | PAL practice / concept-diagnostic-asses… | These routes are registered outside every `Route::group([... | AI-A02 |
| LMS-AUDIT-024 | Critical | Enterprise Brain (all screens) / Founda… | Any valid LMS JWT — including Student and Parent profiles — resolves to the `viewer` role (default_role) which holds `read`; | AI-C01 |
| LMS-AUDIT-025 | Critical | Enterprise Brain — AI Assistant search | The global search selects entire rows (`DB::table('tbluser')->...->limit(10)->get()`) and returns each one as `'record' => $record`. | AI-C02 |
| LMS-AUDIT-026 | Critical | Migration modules (learning outcomes, i… | Tenant, user and academic year come from client-supplied request fields; | AI-D03 |
| LMS-AUDIT-029 | Critical | Fees / Receipt cancellation | For `type=API` the controller replaces the JWT-hydrated tenant and user with client values, then cancels/searches receipts. | FIN-04 |
| LMS-AUDIT-032 | Critical | Utility / Custom module - arbitrary row… | `table_name` comes from the request and is passed to `DynamicModel::deleteRecord($request->table_name, $id)`; | FIN-64 |
| LMS-AUDIT-038 | Critical | Students (adminapi endpoints) | These controllers validate that the bearer JWT is signed, then take `sub_institute_id`, `syear`, `user_id`, and (for search) `user_profile_name` from the reque… | STU-05 |
| LMS-AUDIT-039 | Critical | Attendance / Students legacy / Proxy /… | The `session` middleware validates the JWT and hydrates a correct tenant from the token, but each controller then overwrites it with the request value when `ty… | STU-06 |
| LMS-AUDIT-041 | Critical | Payroll / HR helpers | Client-controlled values are concatenated into raw SQL. | HR-04 |
| LMS-AUDIT-042 | Critical | Payroll (tenancy) | The middleware hydrates the tenant from the JWT, then each controller overwrites it with the request value when `type=API` (`$sub_institute_id = $request->get(… | HR-06 |
| LMS-AUDIT-043 | Critical | Admin Services (complaint, consent, fro… | `authenticate()` only checks that the JWT is valid. | HR-07 |
| LMS-AUDIT-046 | Critical | Super-admin provisioning | `Route::any('superAdmin')` and `POST superAdmin-store` are on the `web` group with no `session`/`auth`/permission middleware. | BE-02 |
| LMS-AUDIT-048 | Critical | Tier B controllers (JWT valid + client-… | These controllers call `$this->jwtToken()->validate()` (signature/expiry only) and then use `sub_institute_id`, `user_id`, `syear` from the request. | BE-11 |
| LMS-AUDIT-051 | Critical | SQAA PDF / file deletion | `POST /unlink-file` deletes any path given in the request: | INT-03 |
| LMS-AUDIT-053 | Critical | Legacy mobile API (apiController) / JWT… | An unauthenticated GET route mints and returns a validly signed JWT for a fixed payload (id 123, "keyur modi") with no credentials. | SP-05 |
| LMS-AUDIT-057 | High | Laravel middleware (CSRF, menu permissi… | CSRF except-list full-URL wildcards disable CSRF for every web route on production/dev hosts | LMS-32, FIN-42, STU-40, HR-28 |
| LMS-AUDIT-058 | High | Menu -> route mapping (Result module) | Result menu route-name map shadowed/incorrect; ~31-36 menu links point at non-existent pages | AUTH-13, LMS-27, ORPH-09 |
| LMS-AUDIT-064 | High | Import data (Laravel API, proxied by Ne… | Import API (/api/import/*) has no role check and no table/column whitelist | NAPI-08, HR-15 |
| LMS-AUDIT-065 | High | AI action approval (Actions tab, AI jou… | AI action approval gate has no role/state guard; approvals replayable; approver client-supplied | AI-D04, AI-03 |
| LMS-AUDIT-066 | High | Students (data exposure) | tblstudent.* rows (password hash, aadhaar, etc.) returned verbatim to browsers | STU-07, FIN-75 |
| LMS-AUDIT-068 | High | HRIT Leave | Leave APIs have no role/ownership/self-approval check; identity from request | HR-09, BE-13 |
| LMS-AUDIT-070 | High | Tenant scoping (cross-cutting; example… | The JWT hydration guarantees session tenant only for controllers that read `session()`. | AUTH-11 |
| LMS-AUDIT-072 | High | Fees online payment | `student_id` and the amount (`pay_amount ?: | NAPI-09 |
| LMS-AUDIT-075 | High | Online exam / practice / student report… | After the `session` middleware hydrates a verified identity, these controllers still use `$request->get('user_id') ?: | LMS-09 |
| LMS-AUDIT-077 | High | Result - marks entry & approval | (1) `points`, `per`, `grade` are client-computed and stored verbatim; | LMS-11 |
| LMS-AUDIT-080 | High | H5P playback, curriculum planning, repo… | Author-supplied HTML (flashcard `content`, question/answer text, statements, scenario descriptions, essay prompts, curriculum "details", generated report-card… | LMS-14 |
| LMS-AUDIT-083 | High | H5P authoring endpoints | Create/edit/delete/publish/import/media are available to any authenticated profile including students; | LMS-17 |
| LMS-AUDIT-084 | High | Homework v2 review / files | (1) `reviewList` scopes by tenant/year only `->when(request value)`; | LMS-18 |
| LMS-AUDIT-085 | High | Learning Outcome (migration-modules API) | `guard()` verifies only that a JWT is valid, then trusts `sub_institute_id`, `user_id`, `syear` from the body. | LMS-20 |
| LMS-AUDIT-086 | High | Course Master content (links) | The `link` field is stored as `url`/`filename` after only `nullable\\|string\\|max:2048`; | LMS-21 |
| LMS-AUDIT-087 | High | PAL Test result / question paper | The paper is loaded with `questionpaperModel::find($questionpaper_id)` from the URL, and `question_arr` (full `lms_question_master` rows) plus `answer_arr` (ca… | AI-A03 |
| LMS-AUDIT-092 | High | Legacy Content Intelligence review queu… | Single transition executes `ContentMetadataService::transition()` (row loaded with `findOrFail($metadataId)` - no tenant filter - status saved, log written) an… | AI-B02 |
| LMS-AUDIT-093 | High | New content model authoring/review/appr… | The only authorization is "not a student" (`is_student`). | AI-B03 |
| LMS-AUDIT-094 | High | ULU authoring API and content framework… | `POST /api/pal/content/{contentId}/framework-metadata` has no role check and no tenant check: | AI-B04 |
| LMS-AUDIT-095 | High | Enterprise Brain — decisions, execution… | The governance permissions `decision.approve`, `eso.execute` and `evidence.curate` are defined and granted to `manager` but are **used by no route**. | AI-C05 |
| LMS-AUDIT-099 | High | Capability Intelligence — Command Cente… | (1) "Create Skill"/"Create New" default kind `competency` POSTs `/api/competency/competencies` and "Launch Assessment" POSTs `/api/competency/assessments` — ne… | AI-C09 |
| LMS-AUDIT-100 | High | Capability Intelligence — role-mapping… | Three implementations of "roles with a skill map" disagree. | AI-C10 |
| LMS-AUDIT-101 | High | Capability Intelligence — Competency Fr… | The "Category Weighting" and "Scoring Configuration" (scoring model weighted/simple, rounding, unmapped handling, target threshold, apply-to gap analysis / rol… | AI-C11 |
| LMS-AUDIT-102 | High | Capability / Competency management API | The only gate is "not student/parent". | AI-C12 |
| LMS-AUDIT-104 | High | Workflow step approvals (Actions tab "W… | `approver_role` and `assigned_to` are stored on each approval and used to filter the *pending list*, but `resolveApproval` never enforces them. | AI-D06 |
| LMS-AUDIT-105 | High | AI read APIs (cases, signals, recommend… | Read endpoints filter by institute only. | AI-D07 |
| LMS-AUDIT-106 | High | Saved AI reports (`/ai-reports/[id]`):… | Any authenticated user of the institute can edit a saved report's HTML and send emails on its basis; | AI-D08 |
| LMS-AUDIT-107 | High | Platform Services (notification, schedu… | The only server-side gate on writes is `perm:platform.<service>,<action>`, which by default only logs "would have DENIED" and lets the request through; | AI-D09 |
| LMS-AUDIT-108 | High | Concept Intelligence tab names | The three tab-label routes have no auth middleware, take the tenant and user from request input, and the component lets every viewer rename tabs. | AI-D10 |
| LMS-AUDIT-112 | High | Fees (all report / master / other-fees… | Multi-tenancy is enforced by trusting `sub_institute_id` from the request although the JWT already provides it. | FIN-05 |
| LMS-AUDIT-118 | High | Fees / audit logs, online payments, rec… | These read APIs have no tenant scope: | FIN-11 |
| LMS-AUDIT-119 | High | Fees / Online fee lookup (IDOR) | Student fee/PII lookups accept any `student_id` (or mobile) with no check that the student belongs to the caller's tenant or to the caller. | FIN-12 |
| LMS-AUDIT-122 | High | Fees / Receipt reprint and PDF storage | (1) Any authenticated user reprints any tenant's receipt (student_id + receipt number + client `sub_institute_id` - the UI even renders "Sub institute ID" as a… | FIN-17 |
| LMS-AUDIT-124 | High | Fees / Online fees settings (merchant c… | Any authenticated caller reaching the route (route name `online_fees_settings_api.store/destroy` has no menu row => no rights check, FIN-14) can create/delete… | FIN-37 |
| LMS-AUDIT-126 | High | Visitor list / type APIs | JWT is validated but `sub_institute_id` is taken from the body and never compared with the token payload. | FIN-40 |
| LMS-AUDIT-134 | High | Library / IDOR and tenant trust | Unscoped `find($id)` for return/delete/edit/verification (state-changing GET `books/{id}/reutrn`, re-stamps `return_date`); | FIN-60 |
| LMS-AUDIT-137 | High | Visitor pickup ("gate pass") OTP | The OTP is returned in the response (`$response['otp'] = $otp`, `:482`), an existing OTP is reused and never expires or clears despite the "valid 5 minutes" SM… | FIN-67 |
| LMS-AUDIT-139 | High | Utility / Year rollover and student pro… | `from_current_syear`, `to_next_syear`, `to_academic_section`, `to_standard`, `to_division`, `students[]` / `stud_ids[]` are concatenated into `INSERT ... | FIN-69 |
| LMS-AUDIT-140 | High | Utility mutators / custom-module / fron… | Mutating routes (`rollover.create/store`, `student_transfer.store`, `student_bulk_update.store`, `transfer_student`, `show_student`) have different names from… | FIN-70 |
| LMS-AUDIT-145 | High | Front desk (gallery, calendar, circular… | These validate only that a JWT exists (`Jv`) and use tenant/year/user from the request; | FIN-76 |
| LMS-AUDIT-149 | High | Inward/Outward tenant scoping | Request tenant used; `update/destroy/edit` unscoped by tenant; | FIN-80 |
| LMS-AUDIT-150 | High | Utility / Custom module - IDOR, rights… | Lookups by `find($id)` without tenant (edit reassigns `sub_institute_id` to the caller); | FIN-81 |
| LMS-AUDIT-151 | High | Bazar bulk upload | Data written to `sharebazar_position/_margin/_pnl` carries no `sub_institute_id` or uploader; | FIN-82 |
| LMS-AUDIT-158 | High | Student delete / withdraw | `tblstudentModel::where(["id" => $id])->update(['status'=>"0"])` has no tenant filter; | STU-17 |
| LMS-AUDIT-159 | High | Student medical & discipline (PII) | Health records (vaccination, height/weight, remarks, uploaded health documents, infirmary cases) and discipline notes for an entire tenant are returned by a si… | STU-20 |
| LMS-AUDIT-168 | High | Organization Management (disciplinary,… | These endpoints are tenant-scoped but have no role check: | HR-16 |
| LMS-AUDIT-169 | High | Talent Management | (1) All read endpoints are open to every staff profile (teacher, clerk, etc.): | HR-17 |
| LMS-AUDIT-171 | High | Task Management | `task.permission` is applied to only four read routes; | HR-22 |
| LMS-AUDIT-173 | High | Laravel LMS/PAL/platform APIs (lms.auth… | 18 routes the frontend calls (GET /api/permissions, content upload/authoring, coherence-map read/write, platform registry/notifications/scheduler/workflow) are… | ORPH-04 |
| LMS-AUDIT-177 | High | Legacy user management (Blade controlle… | Both build `$finalArray` from **every** request key (only `_method,_token,submit,id` dropped) and call `tbluserModel::insert($finalArray)` / `->where(['id'=>$u… | BE-18 |
| LMS-AUDIT-178 | High | MCP tools / AI ask (prompt-injection tr… | `required_permission` (e.g. | BE-20 |
| LMS-AUDIT-179 | High | Migrations / reproducible schema | The migration set cannot rebuild a database and does not describe the live one. | DB-01 |
| LMS-AUDIT-182 | High | Missing unique constraints | Business rules that require uniqueness are enforced only in controllers: | DB-05 |
| LMS-AUDIT-183 | High | Production migration safety | The only safeguard is a regex on the raw argv: | DB-09 |
| LMS-AUDIT-186 | High | E-mail (AJAX send) | `POST /ajax_sendmail` has no `session`/`check_permissions` middleware. | INT-06 |
| LMS-AUDIT-190 | High | Upload endpoints that trust client tena… | (a) `POST /admission_enquiry/payment_proof` is public ("for hills standalone"): | INT-10 |
| LMS-AUDIT-192 | High | Generic import engine (extends HR-15) | Beyond HR-15 (client column names, public file retention): | INT-12 |
| LMS-AUDIT-200 | High | Console commands (destructive seeding) | The class docblock promises it "writes only to a dedicated sub_institute_id, never to one holding real records", and `guardTenant()` refuses non-synthetic tena… | INT-21 |
| LMS-AUDIT-201 | High | Repository hygiene / secrets (Laravel) | A backup of an environment file is tracked in the Laravel git repository. | SP-01 |
| LMS-AUDIT-204 | Medium | Frontend route protection | Frontend route/role gating is client-side, localStorage-driven and cosmetic (substring role matches) | AUTH-16, LMS-26, AI-C28 |
| LMS-AUDIT-215 | Medium | Generic migrated modules (`/reports/*`,… | Generic "migrated module" pages dump raw first-array API data / show feature names with no implementation | STU-33, AI-D19 |
| LMS-AUDIT-218 | Medium | Role identification (frontend and backe… | "Who is an admin/student/staff" is computed by at least 10 frontend and 8 backend rules over tenant-authored free-text profile names with different spellings,… | AUTH-17 |
| LMS-AUDIT-219 | Medium | Menu rights identity and platform admins | (1) The menu request carries no `Authorization` header and the identity is whatever `menuContext`/`userData`/`sessionData`/`session` localStorage keys contain… | AUTH-18 |
| LMS-AUDIT-223 | Medium | User / profile administration | Anyone with `add`/`edit` on `add_user.index` can set `user_profile_id` to any active profile of the tenant, including the admin profile (only tenant and status… | AUTH-22 |
| LMS-AUDIT-229 | Medium | `next.config.ts` | No `headers()` (no Content-Security-Policy, X-Frame-Options/`frame-ancestors`, Strict-Transport-Security, Referrer-Policy, Permissions-Policy, X-Content-Type-O… | INFRA-07 |
| LMS-AUDIT-231 | Medium | Documentation (CLAUDE.md, README, AGENT… | `CLAUDE.md` is a copy of the design-system spec (`K-12 ERP Design System/readme.md`), not repo guidance. | INFRA-17 |
| LMS-AUDIT-240 | Medium | Duplicate modules | Parallel implementations with different behaviour: | LMS-28 |
| LMS-AUDIT-244 | Medium | Teach Assistant panel - stuck-user assi… | After 2 minutes without click/keypress on ANY screen and for ANY role (students, parents, staff) the assistant opens itself. | AI-06 |
| LMS-AUDIT-246 | Medium | Auth/session for AI clients | Five separate copies read the bearer token and role from `localStorage.userData/menuContext`; | AI-08 |
| LMS-AUDIT-248 | Medium | Module AI ledger (AI Stack activity) | The "execution ledger" rows (`ai_audit_logs` event `module.<module>.<operation>`) are written by the browser: | AI-12 |
| LMS-AUDIT-249 | Medium | Voice interaction | Voice input uses the browser Web Speech API (`SpeechRecognition`), which in Chrome/Edge streams audio to the vendor's cloud recogniser; | AI-13 |
| LMS-AUDIT-259 | Medium | LLM-backed endpoints callable by studen… | `POST /api/pal/eso/render` sends a client-supplied, unbounded `instruction` string and free `context` array to the LLM under a "Pal" system prompt (the design… | AI-A19 |
| LMS-AUDIT-261 | Medium | View-as-student | (1) All ESO screens resolve `learnerId = ?learnerId \\|\\| viewAsStudent?.studentId \\|\\| self`, yet the backend forbids staff on every learner-state ESO rout… | AI-A21 |
| LMS-AUDIT-263 | Medium | Coherence Map | `scopeFrom()` computes the caller's tenant but `map()` and `health()` call the repository without it (`$this->map->map($scope['standard_id'], $scope['subject_i… | AI-B05 |
| LMS-AUDIT-264 | Medium | Administration (architecture settings) | (1) `mayWrite` only honours `$auth['user_profile_name']` for the `writer_profiles` list, but `pal_auth` does not contain that key (it has `user_profile_id`, `r… | AI-B06 |
| LMS-AUDIT-272 | Medium | Personalize Marks | The server performs no validation: | AI-B14 |
| LMS-AUDIT-275 | Medium | Gamification teacher actions (team chal… | The teacher class-scope rule (`class_teacher`/`timetable`) is applied only when a `learner_id` is present. | AI-B26 |
| LMS-AUDIT-278 | Medium | Brain JWT bridge | (a) The accepted signing secrets include `config('app.key')` in addition to `JWT_SECRET` — anyone with APP_KEY can mint Brain tokens for any tenant/role. | AI-C15 |
| LMS-AUDIT-282 | Medium | Capability Intelligence — Capability Ex… | The screen is an iframe of `https://skill-ontology-neo4j.vercel.app/?sub_institute_id=<tenant>` — a third-party hosted **example dataset** (the component's own… | AI-C19 |
| LMS-AUDIT-285 | Medium | Competency Framework — Role Requirement… | If loading a role's requirements fails, the panel sets `rows=[]` and shows an error, but Save stays enabled (`disabled={saving \\|\\| loading}`). | AI-C22 |
| LMS-AUDIT-288 | Medium | Career Intelligence (staff view) / aspi… | (1) Viewing another student's evidence/recommendation is allowed only if session `is_admin` is 1 or 2 — a platform-level flag (project memory: | AI-C25 |
| LMS-AUDIT-289 | Medium | Brain cross-module workflows | If the `workflow_runs` insert throws, the `catch (\Throwable)` returns `success => true` with a fabricated run reference and message "initiated successfully". | AI-C26 |
| LMS-AUDIT-293 | Medium | Frontend gating of AI & Intelligence an… | The two dropdown sections (Platform Services, AI & Intelligence) are built from static registries and rendered for every signed-in user (no role condition in `… | AI-D15 |
| LMS-AUDIT-294 | Medium | AI module activity ledger (`ai_audit_lo… | The audit trail accepts client-asserted entries (status completed/failed/denied, message, agent name/run id, tool, arbitrary `result` array) from any authentic… | AI-D16 |
| LMS-AUDIT-297 | Medium | AI provider credentials storage and pre… | LLM API keys are stored unencrypted in `ai_api_keys.api_key` (`grep Crypt::\\|encrypt(\\|decrypt(` over app/Domain/AI, app/Http/Controllers/AI, app/Services/AI… | AI-D21 |
| LMS-AUDIT-308 | Medium | Fees / Teacher fee dues | Class scoping uses independent `whereIn(standard_id)` and `whereIn(section_id)`, i.e. | FIN-29 |
| LMS-AUDIT-318 | Medium | Transportation / routes outside auth gr… | `api/get-bus-list`, `api/get-stop-list` (no tenant filter), `ajaxCheckRemainCapacity`, `DELETE map_student/bulk-delete` (no `session`/`check_permissions`) and… | FIN-58 |
| LMS-AUDIT-326 | Medium | Teacher transfer | Transfer is `UPDATE timetable SET teacher_id = new WHERE teacher_id = left ...` only. | STU-22 |
| LMS-AUDIT-336 | Medium | Attendance UX scope / permissions model | The attendance dashboard lists only sections from `class_teacher` for the logged-in `user_id`. | STU-39 |
| LMS-AUDIT-338 | Medium | HRIT role gating and menu rights | Client gates use `name.toLowerCase().includes('admin') \\|\\| includes('hr')`, which matches unrelated profiles ("Admin Assistant", "Chris", "Three...", "Front… | HR-24 |
| LMS-AUDIT-342 | Medium | Admin dashboard, HRIT leave, Talent man… | 7 in-app navigations target routes that have no page. | ORPH-10 |
| LMS-AUDIT-346 | Medium | Session/identity handling across modules | Identity/tenant/year/role are read through 60 independent session readers (46 names) plus the shared buildSessionContext; | ORPH-16 |
| LMS-AUDIT-350 | Medium | Migrations, schema hygiene | 708 tables created by migrations; | BE-25 |
| LMS-AUDIT-357 | Medium | Indexing | 274 of 532 tenant-column tables have no index containing the tenant column, 154 of 181 `syear` tables have none on the year, and hot tables are bare: | DB-07 |
| LMS-AUDIT-358 | Medium | Code vs migration drift | ~43 tables (and 18 models) are used by application code but created by no migration; | DB-12 |
| LMS-AUDIT-362 | Medium | Data seeding inside schema migrations | Menu structure, role rights, workflow definitions and AI templates are deployed as migrations that write into live shared tables. | DB-18 |
| LMS-AUDIT-376 | Medium | Frontend third-party scripts / CSP | No Content-Security-Policy, X-Frame-Options/`frame-ancestors`, `Referrer-Policy`, `Permissions-Policy` or HSTS is set anywhere; | INT-34 |
| LMS-AUDIT-377 | Medium | Download endpoints without ownership ch… | `downloadFile` returns the storage URL for any homework id (`studentHomeworkModel::find($homeworkId)`, no tenant/student/teacher check); | INT-35 |
| LMS-AUDIT-378 | Medium | Opt-in `api_guard` coverage (uncommitte… | The new guard protects only the listed `api/*` patterns (`lms-homework/*`, `lms-assignment/*`, `exam-evaluation/*`, `question-paper/*`, `get-*`, ...). | INT-36 |
| LMS-AUDIT-384 | Low | Login (hardcoded ids / inference) | Estate-specific ids and a magic user id are embedded in login/permission logic; | AUTH-29 |
| LMS-AUDIT-385 | Low | Documentation accuracy | Docs drifted from code: | AUTH-33 |
| LMS-AUDIT-386 | Low | Error and response format consistency,… | Seven different envelopes: | NAPI-17 |
| LMS-AUDIT-387 | Low | Duplicated proxy code | Each copy has drifted: | NAPI-18 |
| LMS-AUDIT-403 | Low | Prerequisite gate | The "Locked" quiz button is `disabled` client-side only; | AI-A29 |
| LMS-AUDIT-410 | Low | New PAL navigation | Three navigation sources disagree: | AI-B22 |
| LMS-AUDIT-426 | Low | Fees / Refund permission | Non-admin profiles are authorised via menu link `fees_refund` or `fees/fees_refund`, whereas menu links are route names (`fees_refund.index`); | FIN-30 |
| LMS-AUDIT-430 | Low | Maintainability | Critical write flows are hand-minified single-line components that cannot be code-reviewed or diffed; | STU-44 |
| LMS-AUDIT-436 | Low | Cross-module consistency | Same concept, many spellings: | ORPH-20 |
| LMS-AUDIT-445 | Info | Patterns worth replicating | Not a defect. The Users module asks the server what the actor may do and hides controls accordingly while the server independently enforces; | AUTH-34 |
| LMS-AUDIT-452 | Info | General config APIs (positive control) | These controllers are the reference implementation: | HR-36 |


## E. Key structural findings

- **Menu visibility != authorization.** Rights are enforced only when the route *name* matches a `tblmenumaster.link` row, and the whole check is skipped when `submit` contains "Search" (LMS-AUDIT-003).
- **Authentication-only groups:** Result API (181-185 routes), Easy-com (36), Organization-management (54) accept any valid token including students (LMS-AUDIT-004).
- **Client-side gating is cosmetic:** the only frontend gate is whether a localStorage key exists (LMS-AUDIT-204).
- **Good pattern to replicate:** the newly written General/UserManagement/ClassTeacher/AcademicSetup APIs derive tenant from the token and ask the server what the actor may do (LMS-AUDIT-445, LMS-AUDIT-452).

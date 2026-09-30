# 03 - AUTHENTICATION AUDIT

> Repos in scope: `D:\lms_k12` (Next.js frontend) and `D:\next_lms_erp` (Laravel backend consumed by the frontend). Static analysis only: no code modified, no server contacted, no `.env` read. Issue IDs are the unified `LMS-AUDIT-###` IDs from [14_MASTER_ISSUE_REGISTER.md](14_MASTER_ISSUE_REGISTER.md); original per-agent IDs are shown alongside and defined in `AUDIT/parts/`.

## Summary

- Login: `ApiLoginController::login` (`routes/api.php:88`) - e-mail + password; staff (`tbluser`) checked before students (`tblstudent`). Passwords are stored **and compared in plaintext** in legacy paths and `plain_password` is stored next to the hash (LMS-AUDIT-061).
- Tokens: JWT with **no expiry unless `JWT_TTL_MINUTES>0`** (default 0, undocumented) and no revocation/logout (LMS-AUDIT-062); stored in `localStorage` and additionally duplicated as a `token` URL/body parameter in ~75 call sites (LMS-AUDIT-203).
- No login throttling beyond a global 1,000 req/min/IP (LMS-AUDIT-063); legacy OTP login has a hard-coded `123456` backdoor and DOB-as-OTP for 12 tenants (LMS-AUDIT-069).
- Google sign-in cannot work in either repo (LMS-AUDIT-055). Six authentication mechanisms coexist in Laravel (`api.session`, `session`, `pal.auth`, `brain.auth`, `McpAuth`, `lms.auth` soft mode) (LMS-AUDIT-345).
- **No server-side route protection in Next** (no `middleware.ts`/`proxy.ts`); the client gate is presence of a localStorage key (LMS-AUDIT-204).

## Authentication & user-management issues (24)

| ID | Severity | Module | Issue | Source IDs |
|---|---|---|---|---|
| LMS-AUDIT-010 | Critical | Menu / navigation backend (`/api/menu-r… | Unauthenticated POST /api/menu-rights builds SQL from raw request values | AUTH-01, HR-05 |
| LMS-AUDIT-012 | Critical | Document Templates | DocumentTemplateApiController decodes JWT without signature verification and returns student PII unauthenticated | HR-02, AUTH-06 |
| LMS-AUDIT-055 | High | Google sign-in | Google sign-in cannot work (client env var not exposed; Laravel has no /api/google-auth) | AUTH-25, NAPI-06, INFRA-05, ORPH-06 |
| LMS-AUDIT-061 | High | Credentials storage & exposure | Staff passwords stored/compared in plaintext (plain_password) and exposed by APIs | BE-14, AUTH-09, STU-34 |
| LMS-AUDIT-062 | High | JWT design | JWTs never expire by default and cannot be revoked | BE-16, AUTH-07, STU-45 |
| LMS-AUDIT-063 | High | Login | Login has no per-account/IP throttling, lockout or audit trail | AUTH-08, BE-17 |
| LMS-AUDIT-069 | High | SMS OTP login / visitor pickup OTP | Static/DOB SMS OTPs, backdoor mobile numbers and OTP returned in responses | INT-19, BE-15 |
| LMS-AUDIT-071 | High | Mobile WebView handoff / mobile custom… | `if (!isAuthenticated) return <LoginPage />;` runs **before** the `FULL_BLEED_ROUTES` check that lists `/mobile-bridge` and `/mobile/custom`. | AUTH-12 |
| LMS-AUDIT-203 | Medium | All modules (Result, Fees, HRIT, Capabi… | JWT duplicated in URLs/query strings/bodies (log, history, referrer leakage) | ORPH-08, LMS-31, HR-26, FIN-19 |
| LMS-AUDIT-212 | Medium | Stale-client detection | Every deploy clears localStorage/sessionStorage and signs all users out | INFRA-15, AUTH-32 |
| LMS-AUDIT-217 | Medium | Password reset | Forgot/reset password leaks registered e-mails and reset-token weaknesses | BE-28, AUTH-15 |
| LMS-AUDIT-220 | Medium | Session behaviour (idle timeout, daily… | The 30-minute idle timer is per tab and, when it fires, removes `auth`, `menuContext`, `userData` from the **shared** localStorage; | AUTH-19 |
| LMS-AUDIT-221 | Medium | 401 / expiry handling | There is no central fetch wrapper; | AUTH-20 |
| LMS-AUDIT-222 | Medium | Audit / User log | Access logging (`access_log_route` insert via `Accesslog`) is wrapped in `if ($request->get('type') != "API" && $request->get('type') != "JSON")`. | AUTH-21 |
| LMS-AUDIT-223 | Medium | User / profile administration | Anyone with `add`/`edit` on `add_user.index` can set `user_profile_id` to any active profile of the tenant, including the admin profile (only tenant and status… | AUTH-22 |
| LMS-AUDIT-224 | Medium | Front-end hardening (supply chain, head… | Third-party script executes on the same origin that holds the bearer token in `localStorage`, loaded with no `integrity`/`crossorigin`; | AUTH-24 |
| LMS-AUDIT-246 | Medium | Auth/session for AI clients | Five separate copies read the bearer token and role from `localStorage.userData/menuContext`; | AI-08 |
| LMS-AUDIT-345 | Medium | Laravel auth model | Six authentication mechanisms coexist (api.session, session, pal.auth, brain.auth, McpAuth, lms.auth soft) plus in-controller JWT validation and no auth at all; | ORPH-15 |
| LMS-AUDIT-348 | Medium | Audit logging | The entire access-log write **and** the cross-tenant `add_user`/`add_student` PUT guard are inside `if type != API && != JSON`. | BE-22 |
| LMS-AUDIT-353 | Medium | Login ambiguity on duplicate e-mails | `loginModel::where(['email'=>$email,'status'=>'1'])->first()` (no `ORDER BY`) picks one row; | BE-29 |
| LMS-AUDIT-382 | Low | Login redirect | A logged-out user opening a deep link sees the login form at that URL, but after login the code unconditionally `router.replace('/dashboard')` after 1.1 s, dis… | AUTH-27 |
| LMS-AUDIT-383 | Low | Login page details | `/forgot-password` is documented as "pre-login only" but, when logged out, `ConditionalApp` renders `LoginPage` instead of this page, so its effect never runs; | AUTH-28 |
| LMS-AUDIT-384 | Low | Login (hardcoded ids / inference) | Estate-specific ids and a magic user id are embedded in login/permission logic; | AUTH-29 |
| LMS-AUDIT-448 | Info | Session token handling (amplifier of AI… | Bearer JWT is read from `localStorage` (`userData.user_token`) on every call and tokens are non-expiring unless `JWT_TTL_MINUTES` is set. | AI-A31 |


## Detailed traces (Part 01, verbatim)

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


## 6. Business-logic notes (Input -> Validation -> Rule -> DB change -> Side effect -> Output)

**6.1 Login (SPA).** Input `{email,password,type}` -> `Validator` (email required/format, password required) -> staff lookup `where email & status='1'` -> `verifyAndUpgradePassword` (bcrypt; else plaintext/md5 legacy; on success re-hash & `save()`) -> student fallback -> profile lookup -> "rights menu ids" by branch chosen from `plain_password == 'student'` (!!) / `id === 1002` / `sub_institute_id 0 & is_admin 1` / default -> `0 rights` => 403 -> academic-term lookup (`BETWEEN start_date AND end_date`; none => 422 "Academic Term Date Expired") -> JWT -> JSON. DB change: password re-hash only. **No last-login write, no failed-login log, no lockout, no institute-expiry check** (`expire_date` is selected but never evaluated on the API path; the web path uses it for a setup redirect, `loginController.php:451`). FE: `AuthContext.persistLoginPayload` writes `auth`, `menuContext`, `userData` (incl. token), `sessionDate=UTC today`, recordBuildId, starts 30-min idle timer, clears TeachAssistant storage.

**6.2 Menu resolution.** `useMenuRights` POSTs the (client-supplied) identity to `/api/menu-rights` with **no Authorization header** -> controller picks a branch (`student` name / `sub_institute_id==0 && is_admin==1` (dead: `is_admin` never sent) / default) -> `GROUP_CONCAT(distinct m.id)` from individual+group rights joined to `tblmenumaster` -> three whereRaw queries with string-interpolated ids -> `{level 1/2/3}` -> `buildMenuTree` filters `status===1`, hides `HIDDEN_MENU_LINKS`, relabels `student_homework` -> "Exam", appends synthetic "Intelligence" level-3 rows, `mapApiLinkToRoute` maps `link` -> Next path (fallthrough: `'/' + link`) -> Sidebar. Enterprise Brain is appended client-side. `DashboardShell` auto-navigates to the first level-3 child when a level-2 is chosen (except PAL/Teach-Learn/Audit/Brain).

**6.3 Authorization on the legacy web routes used through `/api/proxy`.** Next `legacyRequest` -> `/api/proxy?path=<legacy route>&type=API&sub_institute_id&syear&user_id` + `Authorization: Bearer` -> Laravel `SessionMiddleware` (`type=API` => verify JWT, hydrate session, `merge(type=API)`) -> `MenuMiddleware` (returns early for API) -> `LogRouteMiddleware` (**skips API**) -> `checkPermission` (rights per menu row; see 3.4) -> controller (reads `session()` or `$request`).

**6.4 Forgot password.** Input `{email}` (Next requires non-empty; forwards `{user_email,email,type:'API'}`) -> Laravel `exists:tbluser,email` (422 if unknown — enumerates accounts; students live in `tblstudent` and can never reset) -> `Str::random(64)` inserted **without expiry** into `password_resets` (no purge of earlier tokens) -> mail -> link to a Laravel Blade page `reset-password/{token}/{email}` -> `submitResetPasswordForm`: `min:6|confirmed`, token equality only, `tbluser.password = <raw>` (**plaintext**, `ForgotPasswordController.php:110`), delete tokens for that email. Output JSON `{success}` (mail failure returns `$e->getMessage()`).

**6.5 Mobile handoff.** App -> `POST /api/mobile/web-handoff` (`api.session`) -> validates `web_url` (same host or CORS-trusted origin) -> inserts sha256(ticket) row, 60 s TTL -> WebView opens `https://<k12>/mobile-bridge?ticket=…` -> **`ConditionalApp` renders `LoginPage` instead of the bridge page (AUTH-12 (LMS-AUDIT-071))** -> (intended) `GET claims` burns the ticket and returns an api-login-shaped payload + a fresh JWT.

**6.6 Idle/daily expiry.** Idle: per-tab `setTimeout(30 min)` reset by mouse/keyboard/scroll/touch on *that tab*; on fire it deletes the three auth keys from the **shared** localStorage. Daily: every 60 s compare `sessionDate` with `new Date().toISOString()` date (UTC) and wipe on mismatch. Logout: state clear + `purgeClientState()` (localStorage, sessionStorage, cookies, Cache Storage, service workers) + `location.replace('/')`; **no server call**, token remains valid.

---


## 8. NOT VERIFIED items

| Item | Reason |
|---|---|
| Live rows of `tblmenumaster`, `tblgroupwise_rights`, `tblindividual_rights`, `tbluserprofilemaster` (real menu tree, real role names, real grants per tenant) | DB host is remote; no DB access permitted. Hence "menus -> missing pages" for DB-defined links, and "pages not in any menu", could only be assessed for code-defined targets (see 8.1 below) |
| `JWT_TTL_MINUTES`, `JWT_SECRET` strength, `JWT_ALGO`, `LMS_API_AUTH_ENFORCE`, `CORS_ALLOWED_ORIGINS`, `APP_URL`, `NEXT_GOOGLE_CLIENT_ID`, `NEXT_PUBLIC_*` values, `SHOW_INTERNAL_ROADMAP` | `.env*` not readable by rule; defaults taken from code |
| Exploitability of AUTH-01 (LMS-AUDIT-010) (SQLi) and AUTH-04 (LMS-AUDIT-014) (upload -> PHP execution) | Not executed (no servers/requests allowed). SQLi is from code reading of string interpolation; upload execution depends on web-server handler config for `public/lms_editor_upload/` (`NOT VERIFIED`) |
| Per-method behaviour of the ~195 no-JWT API controllers and ~425 web-only routes | Scan is per controller file; many methods not opened. Some may authenticate through helpers I did not recognise |
| Whether the 641 request-reading controllers are reachable with a foreign tenant id on session-hydrated routes | Only `fees_audit_log_api_controller` and `feesReceiptBookMasterController` (safe: session first) sampled |
| Student self-data scoping (a student granted `student_fees_detail.index` etc. seeing only their own rows) | `tblstudentFeesDetailController` uses `$request->get('student_id')` in places; end-to-end not traced |
| Whether the K12 mobile app actually loads `lms_k12` in a WebView in production | Only the Laravel/Flutter-side comments say so |
| Whether `POST /forget-password` succeeds when called server-side from Next (CSRF, session) | `VerifyCsrfToken::$except` has no matching entry; not executed |
| Contents/behaviour of `app/user/*` pages other than `add_user` skim, `app/user_log/page.tsx`, `Level3Subheader`, `HeaderMenuSearch`, `menuSearch.ts`, `use-module-level3-nav.ts`, `app/organization-management/role-and-permissions` | Not read line by line |
| H5P and Library/Hostel legacy route enforcement | Not traced individually; assumed PERM family by route census |
| Whether my route dump script triggered any lazy DB connection in service providers | Cannot tell without server/DB logs |

8.1 Programmatic result for code-defined menu targets: 309 distinct `'/…'` targets in `app/data/routeMapper.ts` (+ `moduleDashboards.ts`, `DashboardShell`, `Header`, `Sidebar`, `Level3Subheader`, `module-routes.ts`, `lib/brain/navigation.ts`, roadmap registry) were matched against the 679 page routes (dynamic segments honoured): **31 targets have no page**, all in `RESULT_ROUTE_NAME_MAP` (AUTH-13 (LMS-AUDIT-058)). 20 static page routes are never referenced by any string in `app/`, `lib/`, `components/` (lower bound; substring match): `/Inventory/intelligence`, `/academic_setup/intelligence`, `/admin-services/visitor/intelligence`, `/easy_com/intelligence`, `/inward_outward/intelligence`, `/lms/homework/intelligence`, `/user/intelligence` (reached via synthetic Intelligence items or seeded category routes), `/ai/audit`, `/ai/usage-cost`, `/fees/{onboarding,process-builder,sop-task}`, `/teach-learn/{communication,help-guide-support,onboarding,operations,process-builder,reports}`, `/students/requests/new`. Most are reached through `fees_menu_categories.route` rows (DB) — cannot confirm.

---


## 9. Second-pass results

Scope directories (auth/session/menu files listed in §1): counts / repo-wide counts (`app lib components hooks contexts`, `.ts/.tsx`).

| Pattern | In-scope hits | Repo-wide hits (files) | Material hits |
|---|---|---|---|
| `TODO|FIXME|HACK|XXX` | 0 | 2 (2) | none in scope |
| `console.log/debug/info` | 1 | 38 (18) | `app/components/Sidebar.tsx:113` logs `parsed.logo` from `userData`; `app/course-master/lesson-plan/[courseId]/page.tsx` (8 logs incl. session/standard ids, API payloads); `course-master/[courseId]/chapters/sideDrawer.tsx:735-737` logs prompts/data; `fees/master/other-fees-title/page.tsx:255` logs API payload |
| `debugger`, `eval(` | 0 / 0 | 0 / 0 | — |
| `localStorage|sessionStorage` | 63 | 294 (115) | token/PII in `userData` (AUTH-07 (LMS-AUDIT-062)); 53 files re-implement `JSON.parse(localStorage.getItem('userData'))` |
| `dangerouslySetInnerHTML` | 0 | 65 (35) | only 5 files reference DOMPurify (`RichText`, `generated-html.ts`, `h5p_course_presentation`, `h5p_image_hotspots`, `QuestionPaperSheet`); unsanitised server HTML in `career-explorer/{expert-advice,explore-sectors}`, `career-counselling/.../CounsellingCourses.tsx` (AUTH-24 (LMS-AUDIT-224)) |
| `fetch(` | 20 | 556 (264) | 13 files call `fetch(...API_BASE_URL...)` directly, several without `Authorization` (`useMenuRights`, `AuthContext.refreshAcademicTerms`, `master-menu-rights`) |
| `window.location` | 4 | 15 (11) | `AuthContext.logout` -> `location.replace('/')`; `app-version.ts` reload |
| `user_profile_name|user_profile_id|userProfileName` | 28 | 287 (82) | 10+ divergent role helpers (AUTH-17 (LMS-AUDIT-218)) |
| `sub_institute_id|subInstituteId` | 24 | 1,023 (300) | see §4 |
| `syear` (scope) | 29 | — | client-selectable year |
| `eslint-disable` | 18 | 307 (209) | `react-hooks/set-state-in-effect` mostly |
| `@ts-ignore|@ts-expect-error` | 0 | 2 (2) | — |
| Hardcoded hosts/IPs | — | `http://apps.triz.co.in/excel_upload/export_xlsx.php?module=tbluser|tblstudent` in `app/general/implementation_management/ImplementationManagementPage.tsx:94,103` (plain http, third-party host, exports users/students); `localhost:3000` fallback in `app/pal/data/pal-content-model.ts:1131` | — |
| Hardcoded ids in Laravel login | — | `[254,195,47,72,1]` school ids, `[2,11,20,34,81]` client ids (`ApiLoginController.php`), `id === 1002` special-case, `menu_id 200/82/386` allowlists in `checkPermission.php:73-77` | AUTH-29 (LMS-AUDIT-384) |
| Empty handlers / placeholders | — | "Remember me" checkbox has no state or handler (`app/login/page.tsx:277`); `useAuth()` outside provider returns no-op login/logout (`AuthContext.tsx:387-405`); `app/forgot-password/page.tsx` is redirect-only; commented-out "Sign up" block in login | AUTH-28 (LMS-AUDIT-383) |
| Raw redirects | — | `router.replace('/dashboard')` after login ignores the requested URL (`app/login/page.tsx:62-64, 105-107`) | AUTH-27 (LMS-AUDIT-382) |
| 401 handling | — | 55 mentions of `401`; ~20 data modules throw "session expired" text; **no code path calls `logout()` on 401** (only `Header.tsx:694` does) | AUTH-20 (LMS-AUDIT-221) |
| `storage` event listeners | — | 4 files (`useLmsSession`, `pal-view-as`, `academic-year`, `lesson-plan/[courseId]/page`) — none in `AuthContext` | AUTH-19 (LMS-AUDIT-220) |
| Laravel: `submit` bypass, request-supplied tenant, `plain_password` writes, unverified JWT decode | — | see AUTH-02 (LMS-AUDIT-003), 11, 09, 06 | — |

---



## Checklist against the audit brief

| Item | Result |
|---|---|
| Login / logout / session | Traced (Part 01 §3.1-3.2). No server logout/revocation. |
| Token handling | localStorage + URL duplication; non-expiring by default. |
| Password hashing | Plaintext + hash coexist; reset writes raw password. |
| Password reset / forgot | E-mail enumeration; reset token stored in clear, no enforced expiry (LMS-AUDIT-217). |
| E-mail / mobile verification | Not implemented as a verification flow (no finding of a verified-email gate). NOT VERIFIED beyond code read. |
| OTP | Backdoor + DOB OTP (LMS-AUDIT-069). |
| Google / OAuth | Broken (LMS-AUDIT-055). |
| Sanctum/JWT/session | Custom JWT + legacy session, 6 mechanisms. |
| Remember me | Not present; 30-min per-tab idle timer clears localStorage (LMS-AUDIT-220). |
| Multiple sessions | No limit/inventory; no server-side session list. |
| Account deactivation | `status` checked at login only; live tokens keep working until expiry (none by default). |
| Impersonation | "View as student" in PAL is client-side (LMS-AUDIT-261). |
| Role/permission assignment | Any holder of add/edit on `add_user.index` can set profile (LMS-AUDIT-223). |
| IDOR / broken access control | Pervasive - see 04 and 09. |
| Rate limiting / brute force | Effectively none. |

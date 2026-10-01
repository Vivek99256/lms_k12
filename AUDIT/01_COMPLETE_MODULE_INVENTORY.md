# 01 - COMPLETE MODULE INVENTORY

> Repos in scope: `D:\lms_k12` (Next.js frontend) and `D:\next_lms_erp` (Laravel backend consumed by the frontend). Static analysis only: no code modified, no server contacted, no `.env` read. Issue IDs are the unified `LMS-AUDIT-###` IDs from [14_MASTER_ISSUE_REGISTER.md](14_MASTER_ISSUE_REGISTER.md); original per-agent IDs are shown alongside and defined in `AUDIT/parts/`.

## A. Cross-cutting facts (Part 09, machine-derived)

## 2. Module inventory (route + API inventories with totals)

### 2.1 Totals

| Inventory | Count |
|---|---|
| page.tsx files under app/ | 677 (676 routable, 75 with dynamic segments, 0 duplicate URL patterns, 0 case-only collisions) |
| Other Next files | 10 layouts, 1 loading.tsx, 1 not-found.tsx; **no middleware.ts / proxy.ts** (no server-side page gating: gate is client-side `ConditionalApp` -> `LoginPage`) |
| Next route handlers (app/api/**/route.ts) | 67 (handlers with zero callers: 7) |
| next.config.ts rewrites | 4 |
| Top-level route groups | 78 incl. root (largest: h5p 57, pal 55, fees 51, lms 40, student 35, enterprise-brain 33, hostel 28, result 25, Inventory 23, admin-services 22) |
| Menu-link keys evaluated through mapApiLinkToRoute | 570 (517 of the 553 file keys resolve; 36 file keys + 17 of 80 migration-seeded links resolve to non-existent pages) |
| Nav-context "/path" literals resolved | 2,360 (strong contexts in non-API files: 678, unresolved 29 -> 7 real broken navigations + 22 module-root prefix constants) |
| Orphan pages (no link/menu-map/registry/rewrite reference) | 80 (+69 weakly referenced) |
| Laravel route records (all 42 files, stub-router execution) | 5,453 (1,693 under /api); AUTH 4,594 / SOFT 28 / NONE 831 by route middleware |
| Frontend->Laravel call-site candidates | 1532 (1195 matched, 73 matched with inferred /api prefix, 74 matched via wrapper modelling, 80 Next-internal, 55 dynamic / unknown-prefix, 55 unmatched) |
| Distinct Laravel paths called | 1117 = 1042 verified to exist + 28 dynamic / unknown-prefix (NOT VERIFIED) + 47 unmatched (43 confirmed missing or mismatched backend routes covering about 14 features; 4 false positives) |
| Laravel routes referenced by those calls | 1421 route records: 1154 AUTH, 18 SOFT (fail-open lms.auth/perm), **249 NONE** (114 with no token check anywhere in the controller, 135 validating the JWT inside the controller) |
| Dead files (not reachable from any route/handler/script) | 62 in scope (components 10, lib 5, services 2, packages 1, app 44) + 2 test-only |
| Exports never imported | 1,723 (in 482 prod-reachable files; 1,151 are types) |

### 2.2 Module table (top-level route group; API columns are *detected* Laravel paths only - see NOT VERIFIED)

"Backend" lists the Laravel route files that the module's detected calls land in (or Next handlers). "DB tables" are NOT TRACED (out of scope of this mechanical part). "Menu" = pages of the module that the DB-menu mapper can emit (T2) out of pages. "Roles" = frontend gating is not per-module: only 65/676 pages transitively reach `usePermission` and 111/676 reach `useMenuRights`; everything else relies on DB menu visibility + backend. Status legend: PC = partially complete (a confirmed broken/missing endpoint), NV = NOT VERIFIED (every detected API path resolves to a registered route; behaviour not traced), STUB = wrapper/placeholder pages, - = no calls detected (unrecognised transport, e.g. slash-less legacy names through /api/proxy).

| Module | Backend (Laravel route file(s)) | Pages | DB tables | Distinct API paths detected (missing / dynamic / unauth NONE) | Roles | Menu-mapped pages | Orphans | Status |
|---|---|---|---|---|---|---|---|---|
| h5p | lms.php, pal_api.php | 57 | NOT TRACED | 21 (0 / 0 / 1) | see 3 | 6/57 | 0 | NV |
| pal | pal_api.php, lms.php | 55 | NOT TRACED | 120 (3 / 1 / 10) | see 3 | 15/55 | 3 | PC |
| fees | fees.php, api.php | 51 | NOT TRACED | 48 (0 / 1 / 0) | see 3 | 0/51 | 10 | NV |
| lms | api.php, lms.php | 40 | NOT TRACED | 83 (0 / 3 / 52) | see 3 | 25/40 | 2 | NV |
| student | student.php | 35 | NOT TRACED | 25 (0 / 0 / 11) | see 3 | 16/35 | 6 | NV |
| enterprise-brain | brain.php | 33 | NOT TRACED | 12 (0 / 0 / 0) | see 3 | 1/33 | 0 | NV |
| hostel | - | 28 | NOT TRACED | 0 (0 / 0 / 0) | see 3 | 0/28 | 0 | - (no calls detected) |
| result | resultapi.php, result.php | 25 | NOT TRACED | 34 (2 / 0 / 0) | see 3 | 21/25 | 0 | PC |
| Inventory | api.php | 23 | NOT TRACED | 3 (0 / 2 / 0) | see 3 | 0/23 | 20 | NV |
| admin-services | api.php, ptm.php | 22 | NOT TRACED | 25 (0 / 0 / 0) | see 3 | 15/22 | 1 | NV |
| admissions | api.php, admission.php | 18 | NOT TRACED | 12 (0 / 0 / 10) | see 3 | 0/18 | 3 | NV |
| general | api.php, mobile_page_builder.php | 16 | NOT TRACED | 31 (0 / 2 / 6) | see 3 | 0/16 | 5 | NV |
| easy_com | easycomapi.php | 16 | NOT TRACED | 2 (0 / 0 / 0) | see 3 | 14/16 | 1 | NV |
| hrit | api.php, hrms.php | 15 | NOT TRACED | 40 (0 / 2 / 0) | see 3 | 15/15 | 0 | NV |
| Transportation | api.php | 15 | NOT TRACED | 3 (0 / 2 / 0) | see 3 | 11/15 | 2 | NV |
| front_desk | web.php | 14 | NOT TRACED | 7 (0 / 0 / 0) | see 3 | 10/14 | 0 | NV |
| library | web.php, api.php | 13 | NOT TRACED | 17 (0 / 1 / 0) | see 3 | 10/13 | 0 | NV |
| students | student.php | 12 | NOT TRACED | 4 (0 / 0 / 0) | see 3 | 0/12 | 8 | NV |
| ai | - | 12 | NOT TRACED | 0 (0 / 0 / 0) | see 3 | 1/12 | 1 | - (no calls detected) |
| talent-management | talent_management.php, competency_management.php | 11 | NOT TRACED | 166 (5 / 1 / 0) | see 3 | 11/11 | 0 | PC |
| task-management | task_management.php, api.php | 11 | NOT TRACED | 39 (2 / 0 / 0) | see 3 | 10/11 | 0 | PC |
| teach-learn | - | 11 | NOT TRACED | 0 (0 / 0 / 0) | see 3 | 0/11 | 7 | - (no calls detected) |
| people-competency | - | 9 | NOT TRACED | 0 (0 / 0 / 0) | see 3 | 9/9 | 0 | - (no calls detected) |
| exam | lms.php, result.php | 8 | NOT TRACED | 17 (0 / 0 / 5) | see 3 | 3/8 | 0 | NV |
| Utility | student.php, custom_module.php | 8 | NOT TRACED | 16 (0 / 0 / 0) | see 3 | 6/8 | 0 | NV |
| inward_outward | inward_outward.php | 8 | NOT TRACED | 4 (0 / 2 / 0) | see 3 | 6/8 | 1 | NV |
| academic_setup | - | 8 | NOT TRACED | 1 (0 / 1 / 0) | see 3 | 7/8 | 1 | NV |
| integration | - | 7 | NOT TRACED | 0 (0 / 0 / 0) | see 3 | 0/7 | 0 | - (no calls detected) |
| career-explorer | - | 6 | NOT TRACED | 0 (0 / 0 / 0) | see 3 | 4/6 | 0 | - (no calls detected) |
| capability-intelligence | competency_management.php | 5 | NOT TRACED | 42 (5 / 0 / 0) | see 3 | 5/5 | 0 | PC |
| organization-management | organization_management.php, competency_management.php | 5 | NOT TRACED | 38 (0 / 0 / 0) | see 3 | 4/5 | 0 | NV |
| course-master | api.php, lms.php | 5 | NOT TRACED | 29 (0 / 0 / 20+9 soft) | see 3 | 0/5 | 1 | NV |
| user | api.php | 5 | NOT TRACED | 7 (0 / 1 / 0) | see 3 | 1/5 | 3 | NV |

_(Full route/module table: see Part 09 section 2.2 reproduced below.)_

## B. Module inventory by audit area (verbatim from the agents; columns: Module | Backend | Frontend | DB | API | Permissions | Roles/Menu | Status)

### Part 01 - Auth, roles, menus

## 2. Module inventory (your scope)

| Module | Backend (Laravel controller/route or Next api) | Frontend pages/components | DB tables (if traced) | API endpoints | Permissions/roles | Menu entry | Status |
|---|---|---|---|---|---|---|---|
| Email/password login | `ApiLoginController@login` (`routes/api.php:88`, no throttle, no audit write) | `app/login/page.tsx`, `AuthContext.login` | `tbluser`, `tblstudent`, `tbluserprofilemaster`, `tblindividual_rights`, `tblgroupwise_rights`, `tblmenumaster`, `academic_year`, `school_setup`, `tblclient` | `POST /api/api-login` | none (pre-auth) | n/a | Mostly complete; see AUTH-07 (LMS-AUDIT-062)..09 |
| Google login | **No Laravel route** (`grep google-auth` over `routes/` and `app/` = nothing); Next proxy `app/api/google-auth/route.ts` | Button on `app/login/page.tsx` | — | `POST /api/google-auth` -> `{base}/api/google-auth` (404) | — | n/a | **Broken** (AUTH-25 (LMS-AUDIT-055)) |
| Forgot / reset password | `ForgotPasswordController` (web routes `forget-password`, `reset-password`) | Modal in `app/login/page.tsx`; `app/forgot-password/page.tsx` (redirect-only) | `password_resets`, `tbluser` | `POST /api/forgot-password` (Next) -> `POST /forget-password` (Laravel web) | none | n/a | Partially complete (AUTH-15 (LMS-AUDIT-217)) |
| Session / idle / daily reset / logout | none (JWT is stateless; no logout endpoint) | `AuthContext.tsx`, `lib/app-version.ts` | localStorage `auth`,`menuContext`,`userData`,`sessionDate` | — | — | Avatar menu -> Logout | Partially complete (AUTH-07 (LMS-AUDIT-062), 19, 20) |
| Mobile WebView handoff | `MobileWebHandoffApiController@create/claims` (`routes/api.php:97,106`) | `app/mobile-bridge/page.tsx`, `AuthContext.loginFromHandoffTicket`, `ConditionalApp` `FULL_BLEED_ROUTES` | `mobile_web_handoff_token` | `GET /api/mobile/web-handoff/claims?ticket=` | ticket single-use, 60 s | n/a | **Broken on the Next side** (AUTH-12 (LMS-AUDIT-071)) |
| Mobile custom pages | `MobilePageBuilderAdminApiController` (admin gate: `is_admin>=1` or profile admin/super admin) | `app/mobile/custom/[slug]/page.tsx` | mobile page builder tables (not traced) | `/api/proxy?path=api/mobile-page-builder/runtime/{slug}` and admin-authored action endpoints | viewer's own token | via handoff | Depends on AUTH-12 (LMS-AUDIT-071); arbitrary-endpoint action model (AUTH-23 (LMS-AUDIT-208)) |
| Menu / navigation shell | `MenuRightsController@getMenuRightsLevelWise`, `@getMasterMenuApi` (**unauthenticated**) | `DashboardShell`, `Sidebar`, `Header`, `Level3Subheader`, `useMenuRights`, `menuMappers`, `routeMapper` | `tblmenumaster`, `rightside_menumaster`, `tblgroupwise_rights`, `tblindividual_rights`, `fees_menu_categories*` | `POST /api/menu-rights`, `GET /api/master-menu-rights`, `GET /api/modules/menu-categories[/registry]` | rights rows per profile (tenant data) | is the menu | Complete UI; **unsafe backend** (AUTH-01 (LMS-AUDIT-010), 18) |
| Module category bars | `ModuleMenuCategoryApiController` (`api.session`+`check_permissions`) | `app/modules/[moduleKey]/[categoryKey]`, `app/_lib/use-module-level3-nav.ts` | `fees_menu_categories`, `fees_menu_category_items` (seeded for 62 modules: `2026_09_17_100001`) | `GET|POST /api/modules/menu-categories` | rights | seeded rows | Complete |
| Enterprise Brain nav injection | `brain.*` middleware on `api/brain/*` (93 routes) | `DashboardShell.tsx:325-357`, `lib/brain/navigation.ts` | — | `GET /api/brain/access` | client substring rule OR server answer | injected client-side | Mostly complete (AUTH-17 (LMS-AUDIT-218)) |
| Role dashboards | `RoleDashboardApiController@adminSummary/teacherSummary/studentSummary` (`api.session` + in-controller role check) | `app/dashboard/page.tsx`, `resolveDashboardRole.ts` | many | `POST /api/{admin,teacher,student}-dashboard/summary` | admin: `is_admin 1/2`, or profile `parent_id=1`, or name in {super admin, admin, school admin}; else 403 | landing page | Complete; unknown profiles get the admin UI then a 403 |
| Module dashboards (Admissions/Students/Library/Hostel/Transport) | `*DashboardApiController@summary` — **no auth** (`routes/api.php:139-143`) | `app/api/*/dashboard/summary` proxies + pages | many | `POST /api/{admissions,students,library,hostel,transportation}-dashboard/summary` | none | `MODULE_DASHBOARD_ROUTES` | Complete UI; unauthenticated backend (AUTH-05 (LMS-AUDIT-009)) |
| User master | `UserManagementApiController` (in-controller JWT + rights) | `app/user/add_user`, `app/user/api.ts` | `tbluser`, `tbluserprofilemaster` | `GET|POST /api/users[/{id}]`, `POST /api/users/{id}/deactivate` | rights of `add_user.index`; admin names | menu | Complete; stores `plain_password` (AUTH-09 (LMS-AUDIT-061)) |
| User profiles (roles) | same controller | `app/user/add_user_profile`, `api.ts` | `tbluserprofilemaster` | `GET|POST /api/user-profiles[/{id}[/delete]]` | rights of `add_user_profile.index` | menu | Complete |
| User report / User log (Audit) | `UserManagementApiController@report*`, `UserLogReportApiController` | `app/user/user_report`, `app/user_log` | `access_log_route` | `/api/user-reports/*`, `/api/user-logs/*` | rights | Audit module | Partially complete: SPA calls are never logged (AUTH-21 (LMS-AUDIT-222)) |
| Access-rights admin (group/individual/mobile) | `GroupwiseRightsApiController`, `IndividualRightsApiController`, `MobileAppMenuRightsApiController`, `RolePermissionsController` | `app/general/*_rights`, `app/organization-management/role-and-permissions` (outside my dirs; located via docs) | `tblgroupwise_rights`, `tblindividual_rights` | `/api/groupwise-rights`, `/api/individual-rights`, `/api/mobile-app-rights/*`, `/api/organization-management/role-permissions/*` | JWT + actor rights; RolePermissions: `is_admin` or profile name **exactly** `Admin` | avatar dropdown (unconditional) | Complete; inconsistent admin definitions (AUTH-17 (LMS-AUDIT-218)) |
| Employee directory / HR org data | `EmployeeDirectoryController` (`api.session` only) | `app/organization-management/*` | `tbluser` | `/api/organization-management/employee-directory[/{id}]` | none beyond a bypassable self-scope | menu | **Data-exposure bug** (AUTH-03 (LMS-AUDIT-013)) |
| Route registry | — | `app/lib/routes.ts` (used by `admin-services`, `Utility` pages) | — | — | — | — | Stale/dead result paths (AUTH-13 (LMS-AUDIT-058)) |

Flags:
* **Backend-without-UI:** `credentials()` in `ApiLoginController` (lists every active staff and student in the estate; admin-only check `is_admin >= 1`) has no route in the dump — dead code; `Route::post('login_hills'…)`, `teacherlogin`, `check_otp` legacy mobile logins have no Next UI.
* **UI-without-backend:** Google sign-in (AUTH-25 (LMS-AUDIT-055)).
* **Menus/links pointing at missing pages:** 36 `RESULT_ROUTE_NAME_MAP` keys -> 31 non-existent `/result/*` pages (AUTH-13 (LMS-AUDIT-058)). `/forgot-password` exists but is unreachable pre-login (AUTH-28 (LMS-AUDIT-383)).
* **Duplicate modules under different names:** `app/organization-management` vs `app/organization_managment` (docs already note); `app/student` vs `app/students`; `app/exam` vs `app/result` vs `app/lms/exam`; three near-identical `isAdminOrHrProfile` copies (`components/domain/lms/assignments`, `.../sessions`, `app/talent-management/recruitment`).

---



### Part 02 - Next API routes

## 2. Module inventory (scope)

| Module | Backend (Laravel controller/route or Next api) | Frontend pages/components | DB tables (if traced) | API endpoints | Permissions/roles | Menu entry | Status |
|---|---|---|---|---|---|---|---|
| Generic Laravel proxy | Next `app/api/proxy` (GET/POST/PUT/PATCH/DELETE) -> any Laravel path under `API_BASE_URL` | 75 files call `/api/proxy?` (career-*, admissions, exam, fees, front_desk, general, ...) | n/a | `/api/proxy?path=` | none at proxy; Laravel enforces per route | n/a | Complete (but uncontrolled - NAPI-10 (LMS-AUDIT-208)) |
| File proxy | Next `app/api/proxy-file` (POST) | 4 files (front_desk/_lib/api.ts, ...) | n/a | `/api/proxy-file?path=` | none at proxy | n/a | Complete |
| Role dashboards (admin/teacher/student, teacher-timetable/fee-dues/icard) | Laravel `RoleDashboardApiController`, `TeacherTimetableApiController`, `TeacherFeeDuesApiController`, `TeacherIcardApiController` behind `api.session` (routes/api.php:148-156) | dashboard pages | timetable, tblstudent, fees_* | 6 Next routes | JWT decides tenant/role; controllers 403 wrong role | dashboard | Complete; Laravel side sound |
| Module dashboards (fees/admissions/students/library/hostel/transportation) | Laravel `*DashboardApiController::summary` | 15 files reference `dashboard/summary` | fees_*, admission_*, tblstudent_enrollment, library_*, hostel_*, transport_* | 6 Next routes | **fees: api.session+check_permissions but tenant from body; other five: NO auth at all** (routes/api.php:140-144) | module dashboards | **Broken security** (NAPI-04 (LMS-AUDIT-005), NAPI-05 (LMS-AUDIT-056)) |
| Fees reports + finance proxies | Laravel `/fees/*` (routes/fees.php, group `session`,`check_permissions`; JWT validated via `SessionMiddleware` type=API) | fees pages | fees_* | 17 Next routes via `fees-report-proxy.ts` | Laravel `check_permissions` per menu right | fees menu | Complete; token travels in URL (NAPI-12 (LMS-AUDIT-225)) |
| Online fee payment | Next `fees/online-payment/[gateway]` -> Laravel `online_fees_payment_api_controller::initiate` (`api.session`) | `app/fees/online-payment/[gateway]/page.tsx` | fees_payment, fees_razorpay, fees_online_maping | POST | JWT only | fees | Mostly complete; IDOR/amount trust on Laravel (NAPI-09 (LMS-AUDIT-072)); gateway callbacks are Laravel-only |
| Menu category feeds | Laravel `FeesMenuCategoryApiController`, `TeachLearnMenuCategoryApiController`, `ModuleMenuCategoryApiController` (`api.session`+`check_permissions`) | nav shell | menu tables | 4 Next routes | JWT + permission middleware | all modules | Complete |
| Library books list | Laravel `BookController@index` (web route `books`, `session` middleware, type=API JWT) | library | library_books | 1 route | menu rights | library | Complete |
| PAL submit / content-model / pedagogy-engine | `pal/submit` -> Laravel `POST /lms/pal` (redirect scraped); content-model/pedagogy-engine -> unauthenticated Laravel read endpoints | PAL pages | semantic_intelligence, PAL tables | 3 routes | submit: JWT via Laravel; other two: public reference content | PAL | Mostly complete; submit relies on redirect-scraping (documented backend gap) |
| Auth helpers | `forgot-password` -> Laravel `POST /forget-password` (web); `google-auth` -> **`/api/google-auth` (does not exist in Laravel)** | login page, `contexts/AuthContext.tsx:246` | password_resets, tbluser | 2 routes | public | login | forgot-password Partially complete; **google-auth Broken** (NAPI-06 (LMS-AUDIT-055)) |
| MCP bridge | Next `mcp/*` -> Laravel `/api/mcp/*` (`McpAuth` JWT + `McpRateLimit` + `McpContextHydrator`) | 6 files | ai_* | 3 routes | JWT; institute validated against token claim | AI panel | Complete; client-chosen `baseUrl` (NAPI-01 (LMS-AUDIT-001)) |
| AI: ask/stream, field-edit, assistance-tickets | Laravel `/api/ai/*` behind `McpAuth` (routes/ai.php:38-40) | AI panel, sparkle field editor | ai_* | 3 routes | JWT + 60/min per user | AI | Complete; Laravel enforces |
| Agents (Enterprise Brain) | **Next-native**: `lib/agents/engine.ts` + JSON store `.data/agents.json`; RBAC asked of Laravel `/api/permissions` (`lms.auth`) | 12 files (`lib/agents/client.ts`) | none (JSON file) | 5 routes | `agents.<module>` create/update via Laravel; **reads unauthenticated** | Enterprise Brain | **Broken security** (NAPI-02 (LMS-AUDIT-002)/03) |
| Conversational AI admin | **Next-native**: `lib/ai/conversational-admin/*` + `.data/conversational-ai.json` | 3 files | none | 3 routes | writes: `conversational_ai` update via Laravel; reads: any non-empty token | Enterprise Brain | Partially complete; service tokens never verified (NAPI-14 (LMS-AUDIT-226)) |
| Integration configs | **Next-native mock**, in-memory arrays | `app/task-management/administration/integration/*` | none | 3 route files (6 methods) | any Authorization header | Task Mgmt > Integration | **Stub/Broken** (NAPI-07 (LMS-AUDIT-007)) |
| Import data | Next `import/*` -> Laravel `ImportApiController` (`api.session` only) | `app/import-data/page.tsx` **calls Laravel directly, not these routes** | csv_data, import_table_fields, tbluser, tblstudent, fees_collect, result_marks | 4 routes | none beyond api.session | Import | Next routes dead; 2 of 4 lack Authorization; Laravel side has authz gap (NAPI-08 (LMS-AUDIT-064)) |
| Question paper asset proxy | Next-native fetch of allow-listed origins | question-paper export (3 files) | n/a | 1 route | none (public) | Exam | Complete; see NAPI-11 (LMS-AUDIT-209) |
| SOP -> process converter | Next-native LLM (`@ai-sdk/google`) | 2 files | none | 1 route | none | Task/Process | Complete; unauthenticated cost (NAPI-05 (LMS-AUDIT-056)) |
| Candidate screening | Next-native LLM (DeepSeek/OpenRouter/Gemini) | `talent-management/recruitment/components/candidate-application-form.tsx` | none | 1 route | none | Recruitment | Complete; unauthenticated (NAPI-05 (LMS-AUDIT-056)) |

Flags: backend-without-UI: `import/*` Next handlers (UI calls Laravel directly), `integration-configs/test` (fake). UI-without-backend:
Google sign-in (Laravel route absent). Duplicate modules: three copies of the dashboard-proxy code (12 handlers), two copies of the menu-category
proxy (fees, teach-learn) plus `laravel-category-proxy.ts`, and two disjoint stores in `integration-configs`.

---



### Part 03 - Infra, config, tests, docs

## 2. Module inventory (infra/config scope)

| Module | Backend (Next api / config) | Frontend pages/components | DB tables | API endpoints | Permissions/roles | Menu entry | Status |
|---|---|---|---|---|---|---|---|
| Environment/base-URL resolution | `app/components/utils/api_url.tsx`; 22 route files re-implement the same logic with `NODE_ENV` | every client fetch | n/a | n/a | n/a | n/a | Partially complete (two divergent selection rules, INFRA-06 (LMS-AUDIT-210)) |
| Build identity and stale-client purge | `next.config.ts` (`generateBuildId`, `env.NEXT_PUBLIC_APP_BUILD_ID`); `lib/app-version.ts`; `contexts/AuthContext.tsx` | none | n/a | n/a | n/a | n/a | Complete, with design concerns (INFRA-15 (LMS-AUDIT-212)) |
| Google sign-in | `app/api/google-auth/route.ts` | `app/login/page.tsx` | n/a | POST `/api/google-auth` | public | login | **Broken** (env var not exposed to browser, INFRA-05 (LMS-AUDIT-055)) |
| Agents (v1 file store) | `app/api/agents/**`, `lib/agents/*`, `.data/agents.json` | AI-stack automations tab | JSON file | 4 routes | Laravel `/api/permissions` with client-chosen base URL | AI stack | **Broken authz** (INFRA-02 (LMS-AUDIT-002)) |
| Conversational-AI admin | `app/api/conversational-ai/**`, `lib/ai/conversational-admin/*`, `.data/conversational-ai.json` | `app/enterprise-brain/automation/conversational-ai` | JSON file | 3 routes | same | Enterprise Brain | **Broken authz** (INFRA-02 (LMS-AUDIT-002)) |
| `packages/*` "workspace" | tsconfig `paths` only | 8 importers | n/a | n/a | n/a | n/a | Partially complete: no `package.json`, no `workspaces`, `conversational-ai-core/src/file-store.ts` is dead code |
| Test harness | `node --import tsx --test` | n/a | n/a | n/a | n/a | n/a | Partially complete (lib-only, 2 red) |
| CI/CD | `.github/workflows/` (empty dir, not even tracked) | n/a | n/a | n/a | n/a | n/a | **Missing** |
| Containerisation | none | n/a | n/a | n/a | n/a | n/a | **Missing** |
| Observability (errors, health, metrics) | none (no Sentry/OTel, no `/health`, no `error.tsx`/`global-error.tsx`) | `app/not-found.tsx` (1), `app/career-intelligence/loading.tsx` (1) | n/a | `/api/mcp/health` (only MCP) | n/a | n/a | **Missing** |
| Documentation set | 25 md files | n/a | n/a | n/a | n/a | n/a | Partially complete, several stale/contradicting (INFRA-17 (LMS-AUDIT-231)/18) |
| Agent-tool state committed to git | `.kilo/`, `.codex/`, `.claude/`, `diff_frontend.txt`, `.tsc-check2.log` | n/a | n/a | n/a | n/a | n/a | **Should not exist** (INFRA-03 (LMS-AUDIT-059)/22) |
| Code generation | `scripts/generate-module-screens.mts` produces `app/_lib/module-screens.generated.ts` (538 lines, 517 entries, 0 dangling imports) | category tabs | n/a | n/a | n/a | n/a | Complete; 160 of 677 `page.tsx` are not in the map (by design per script header); no npm script or CI step to regenerate |

---



### Part 04 - LMS / H5P / Exam / Result

## 2. Module inventory (your scope)

| Module | Backend (Laravel controller/route or Next api) | Frontend pages/components | DB tables (if traced) | API endpoints | Permissions/roles | Menu entry | Status |
|---|---|---|---|---|---|---|---|
| Result - marks entry / approval | `routes/resultapi.php` group `api/result` (`api.session` only) -> `MarksEntryApiController` -> `marks_entry_controller` | `app/result/marks-entry` (new), `app/exam/marks-entry` (legacy duplicate) | `result_marks`, `result_create_exam`, `result_exam_approve`, `result_std_grd_maping`, `grade_master_data` | `GET api/result/marks-entry/create`, `POST api/result/marks-entry`, `POST .../approve`; legacy `POST result/marks_entry` | None on API (any valid JWT incl. student/parent). Frontend: none. | `marks_entry.index` -> mapper returns `/result/marks_entry` (no such page) | Mostly complete, unauthorised, integrity gaps |
| Result - masters (exam master/type/creation, grade, std-grade map, result master, book master, remark master, co-scholastic, working days, HPC skillset/activity, templates) | `Result*ApiController`s delegating to `result\*` web controllers | `app/result/master/[slug]` (config-driven `MasterCrud` + `lib/result/masters.ts`), `master/exam-master`, `master/grade-master` | `result_exam_master`, `result_create_exam`, `grade_master_data`, `result_master_confrigration`, `result_template`, ... | `api/result/<resource>` CRUD + `/bulk` | None; bare-`id` update/delete not tenant-scoped | route-name links map to non-existent pages (LMS-27 (LMS-AUDIT-058)) | Mostly complete, IDOR |
| Result - reports / report cards | `ResultReportApiController`, `Cbse*ApiController`, `WrtReportApiController`, `ClasswiseGradeReportApiController`, `StudentResultApiController`, `ConsolidateReportApiController` | `app/result/reports/*`, `app/result/report-card/*`, `app/result/student-result-remarks`, `student-attendance` | `result_html`, `result_reportcard_marks`, `result_marks`, `result_remark*` | `api/result/*-report*`, `student-result`, `student-result/save-html` | None | as above | Mostly complete; "Print mobile" destructive (LMS-12 (LMS-AUDIT-078)) |
| Result - upload / mobile approve / HPC entry / co-scholastic entry | `UploadResultApiController`, `ApproveMobileResultApiController`, `ResultActivityMarks*`, `CoScholasticMarksEntryApiController` | `app/result/upload-result`, `approve-mobile-result`, `hpc-*`, `co-scholastic-marks` | `upload_result`, `result_activity_marks(_V1)`, co-scholastic tables | `api/result/upload-result` etc. | None | as above | Mostly complete |
| Exam - AI paper generator (`/exam/exam-creation`) | `ApiQuestionPaperController::store` (+ `lms-questions`, `question-mapping-levels`, `lms-courses`) | `app/exam/exam-creation`, `app/exam/data/aiPaper.ts` | `question_paper`, `lms_question_master`, `lms_mapping_type` | `POST /api/question-paper`, `POST /api/lms-questions`, `GET /api/question-mapping-levels`, `POST /api/lms-courses` | None (anonymous) | `generate_ai_questionpaper` -> `/exam/exam-creation` | Partially complete (metadata dropped, LMS-24 (LMS-AUDIT-238)) |
| Exam - online exam attempt/result (`/exam/online*`) | `lms/onlineExamController` (web group `session,menu,logRoute,check_permissions`, `type=API`), `ApiQuestionPaperController::index` | `app/exam/online/page`, `[paperId]/page`, `[paperId]/result/page`, `data/onlineExam.ts` | `question_paper`, `lms_online_exam`, `lms_online_exam_answer`, `answer_master`, `lms_question_master` | `GET /api/question-paper`, `GET/POST /lms/online_exam`, `GET /lms/online_exam/{id}`, `GET /lms/online_exam_attempt` | Any authenticated user; no role/ownership/window/attempt checks | `online_exam.index` -> `/exam/online` | Broken (integrity, LMS-02 (LMS-AUDIT-018)/07/08/09) |
| Exam - legacy exam master / marks entry / progress report | `result/exam_master`, `result/marks_entry` (web), `lmsExamwise_progress_report` | `app/exam/exam-master`, `marks-entry`, `progress-report` | as Result | web routes + `/api/proxy` | menu-rights (route-name based) | `exam_master.index` -> `/result/master/exam-master`; `marks_entry.index` (path form) -> `/exam/marks-entry` | Duplicate of Result module (LMS-28 (LMS-AUDIT-240)) |
| LMS Exam Operations (`/lms/exam`, `/lms/worksheet`, `/lms/project`) | `ApiQuestionPaperController`, `QuestionPaperTemplateApiController`, `AssessmentBlueprintApiController`, `ExamEvaluationApiController`, `LmsResultDashboardApiController` | `app/lms/exam/page.tsx` + `_question-paper-templates`, `_assessment-blueprint`, `_exam-evaluation`, `_result-dashboard`; `_shared/question-paper-grid`, `assign-work-panel` | `question_paper`, `template_master`, blueprint tables, `exam_evaluation_*`, `lms_offline_exam(_answer)` | `/api/question-paper*`, `/api/question-paper-templates*`, `/api/assessment-blueprints*`, `/api/exam-evaluation/*`, `POST /api/lms-result-dashboard/summary` | Result dashboard: `api.session`+`staff.only`. All others anonymous. Frontend gates on `userProfileName` only. | `question_paper.index` -> `/lms/exam` | Mostly complete, backend unauthenticated (LMS-04 (LMS-AUDIT-019)/05) |
| LMS Homework | Legacy `StudentHomeworkApiController` (anonymous), v2 `HomeworkSubmissionApiController` (`api.session`, review = `+staff.only`), `HomeworkQuestionBankApiController` | `app/lms/homework/*` (list, assign, submission, report, review, `[id]`), `homework/api.ts` | `homework` (+ `homework_evaluation_answer`) | `lms-homework/*` | Frontend `RequireStaff` on staff pages; backend gaps (LMS-06 (LMS-AUDIT-021)/18) | `student_homework` -> `/lms/exam` (mapper) | Mostly complete |
| LMS Assignment / Submission / Annotate | `LmsAssignmentApiController` (routes re-declared under `api.session`(+`staff.only`) after anonymous legacy declarations - later registration wins) | `app/lms/lmsAssignment*`, `lmsAnnotate_assignment` | `lms_assignment*` | `lms-assignment/*` | Backend enforced; frontend `RequireStaff` | `lmsassignment.index` | Mostly complete |
| LMS planning (curriculum-planning, lesson-plan, monthly-plan, syllabus-plan, teacher-diary, teacher-timetable) | `/api/intelligence/*` (anonymous), `lms/lms_syllabus` (web menu-checked) | `app/lms/curriculum-planning/*`, `lesson-plan`, `monthly-plan`, `syllabus-plan`, `teacher-*` | `lms_intelligence_lesson_plans`, `lms_lesson_plan_periods`, ... | `/api/intelligence/*`, `/lms/lms_syllabus` | Frontend `RequireStaff`; backend anonymous for `/api/intelligence/*` | mapped | Mostly complete, unauthenticated (LMS-06 (LMS-AUDIT-021)) |
| LMS dashboards / engagement (dashboard, teacher-dashboard, activity-stream, leader-board(+master), social-collaborative, student-analysis, question-wise-report, reports, book-list, global-mapping) | `lms/lmsdashboard`, `lmsActivityStream`, `lmsStudent_report`, `lms/lmsmapping`, `lb_master` (web menu group); `api/lms/leaderboard*`, `social-collaborative*` (`api.session`) | `app/lms/{dashboard,activity-stream,leader-board*,social-collaborative,student-analysis,...}` | many | see Section 5 | Leaderboard/social: token tenant, staff-only master. Legacy web: request tenant preferred over session (LMS-09 (LMS-AUDIT-075)) | mapped | Mostly complete |
| LMS Message / Project & Worksheet wrappers / Teacher resource | none (Blade placeholder) / reuse of `AssignWorkPanel` / reuses `app/library/book_resources` | `app/lms/message`, `lmsProject`, `lmsWorksheet`, `lms_teacherResource` | - | - | `RequireStaff` where present | mapped | Message = Stub (honest placeholder). `lms/api/teacher_resource/*` = backend-without-UI, anonymous |
| Course Master (courses, chapters authoring, content upload/generation, coherence map, concept intelligence tab labels, lesson-plan under course) | `ApiLmsCourseController`, `contentController::storeGammaContent`, `IntelligenceQuestionGenerationApiController` (`api.session+staff.only`), `CoherenceMapApiController` (`lms.auth`), `ConceptIntelligenceTabLabelApiController` | `app/course-master/**`, `data/*.ts` | `content_master`, `lms_question_master`, `chapter_master`, `sub_std_map`, ... | `/api/lms-courses`, `lms-chapters*`, `lms-chapter-content*`, `lms-question-bank*`, `lms/gamma-content-master`, `lms/coherence-map*` | Client-supplied role string; `lms.auth` is warn-only | course-master | Mostly complete, unauthenticated authoring (LMS-04 (LMS-AUDIT-019)/21/34) |
| H5P content authoring & playback (14 types + question-bank library + hub + model) | `routes/lms.php` prefix `h5p` (`session,menu,logRoute,check_permissions`) -> `H5P*Controller` + `H5PContentTypeController` base; `api/pal/h5p/*` (`pal.auth`); `POST get-h5p-ai-scenario` (no middleware) | `app/h5p/**` (57 pages), `components/h5p`, `lib/h5p` | `h5p_*` tables, `lms_question_master` | `/h5p/*`, `/api/pal/h5p/*`, `/get-h5p-ai-scenario`, `/api/lms-question-bank` | Frontend hides edit for students; backend has no role check on writes (LMS-17 (LMS-AUDIT-083)) | `h5p.index` etc. -> `/h5p/*` | Mostly complete; score persistence Missing (LMS-22 (LMS-AUDIT-236)) |
| Quiz (`/quiz`, `/quiz/create`, `/quiz/take`) | none (only `lms-courses` for dropdowns) | `app/quiz/**` | - | `POST /api/lms-courses` | none | - | **Stub / mock** (LMS-29 (LMS-AUDIT-241)) |
| Subjects / Chapters | `lms-courses`, `lms/new_chapter_master`, `lms-chapter-content` | `app/subjects/**`, `app/chapters` | - | see Section 5 | none | - | Mostly complete (progress = curriculum coverage, not student progress) |
| Teach/Learn hub | `api/teach-learn/menu-categories` (`api.session`+`check_permissions`) via Next proxy `app/api/teach-learn/menu-categories` | `app/teach-learn/**` (ModuleCategoryPage), screen registry embeds LMS/exam/PAL pages | `fees_menu_categories`, `fees_menu_category_items` | `GET /api/teach-learn/menu-categories` | Backend menu rights; **proxy SSRF (LMS-19 (LMS-AUDIT-001))** | teach-learn | Complete (hub) |
| Learning Outcome (`/learning-outcome/*`) | `api/MigrationModulesApiController` (JWT-valid only, tenant from body) | `app/learning-outcome/*` -> `MigrationModulePage` | `learning_outcome_indicator`, `learning_outcome_question_master`, `result_marks` | `GET /api/migration-modules/{module}` | none; tenant client-supplied | `MIGRATION_MODULE_ROUTES` | **Partially complete: read-only generic table viewer; create/delete exist in API, no UI** (LMS-20 (LMS-AUDIT-085)) |
| SQAA (`/sqaa`, `/sqaa_master`, `/sqaa_document_report`) | `SqaaApiController` (`api.session`, tenant from token) | `app/sqaa/**` | `sqaa_master`, `sqaa_documant_master`, `sqaa_documents`, `sqaa_mark` | `GET api/sqaa/levels`, `GET api/sqaa/entry/{menuId}`, `POST api/sqaa/entry`, `GET api/sqaa/document-report` (all via `/api/proxy`) | Any authenticated user | mapped | Mostly complete; multipart upload corrupted by proxy (LMS-30 (LMS-AUDIT-213)) |
| AI Stack config screens (lms, exam, exam-assessment, teach-learn, curriculum-planning, sqaa) | shared `/api/ai/*` (other part) | `app/*/ai-stack`, `lib/*-ai-stack.ts` | - | - | - | ai-stack | Configuration descriptors only (not audited further) |
| G2G LMS barrel (`services/g2g-lms.ts`, `components/ui/g2g`) | `routes/g2g_lms.php` | `app/people-competency/lms` | - | - | - | - | Out of scope in practice (not used by in-scope modules) |

Flags:
- **Backend-without-UI:** `api/migration-modules` `POST/DELETE` (learning outcomes, indicator mapping); `lms/api/teacher_resource/*`; `H5P *_export/import` for some types (UI exists for some); `api/result/*` endpoints `personalize-marks`, `pal-marks`, `map-value`, `current-result`, `overall-mark-report`, `cbse-1t5-t2-result` variants are only partly surfaced.
- **UI-without-backend:** `/quiz/create` "Publish Quiz" and `/quiz/take` (no API at all); `/lms/message` (declared placeholder).
- **Menus/links pointing at missing pages:** 35 `RESULT_ROUTE_NAME_MAP` entries in `app/data/routeMapper.ts` (LMS-27 (LMS-AUDIT-058)); typo key `'ai_questionpaper.ind ex'` (line 151).
- **Duplicate modules under different names:** `/exam/marks-entry` vs `/result/marks-entry`; `/exam/exam-master` vs `/result/master/exam-master`; two online-exam UIs (`/exam/online/[paperId]` vs `QuestionPaperView` inside `/lms/exam`); `MigrationModulePage` learning-outcome vs Laravel `learning_outcome` Blade module (LMS-28 (LMS-AUDIT-240)).

---



### Part 05 - PAL / AI / Intelligence

_(section 2 not found in part05-pal-ai-intelligence.md)_


### Part 06 - Fees / Finance / Operations

## 2. Module inventory (your scope)

Menu note: the Laravel menu tree (`tblmenumaster.link` = route name, e.g. `fees_collect.index`) is served by `/api/menu-rights`; specific rows were NOT VERIFIED (no DB access). Frontend paths below are the resolved pages.

| Module | Backend (Laravel controller / route) | Frontend pages/components | DB tables (traced) | API endpoints | Permissions / roles | Menu entry | Status |
|---|---|---|---|---|---|---|---|
| Fee collection (regular) | `fees_collect_controller` `show_student`, `edit`, `store`->`pay_fees` (`routes/fees.php:119,176`) | `app/fees/collect/page.tsx`, `collect/[studentId]/page.tsx` | `fees_collect`, `fees_receipt`, `fees_breackoff`, `fees_title`, `fees_receipt_book_master`, `fees_config_master`, `student_quota`, `tblstudent(_enrollment)` | POST `/fees/fees_collect/show_student`, GET `/fees/fees_collect/{id}/edit`, POST `/fees/fees_collect` | route-name rights only (bypassed for `.store/.edit`); no FE gating | `fees_collect.index` | **Partially complete**: discount and fine typed in the UI are dropped by the server (FIN-06 (LMS-AUDIT-113)); late-fee automation dead (FIN-22 (LMS-AUDIT-303)) |
| Fee cancel | `feesCancelController` (`routes/fees.php:188`, `routes/api.php:544`) | `app/fees/cancel-refund/page.tsx` (cancel tab) | `fees_collect.is_deleted/is_waved`, `fees_paid_other.is_deleted`, `fees_cancel` | POST `/api/fees-cancel/search`, POST `/fees/fees_cancel` | none FE; BE trusts client tenant/user (FIN-04 (LMS-AUDIT-029)) | `fees_cancel.index` | **Broken security** (cross-tenant), functional otherwise |
| Fee refund | `FeesRefundApiController` -> `feesRefundController` (`routes/api.php:164-168`) | `cancel-refund/page.tsx` (`RefundWorkflow`) | `fees_refund`, `fees_collect` | POST `/api/fees-refund/search|detail/{id}|save` | BE `denyUnlessAllowed` (admin names or menu link `fees_refund`) - only place with explicit role gate | `fees_refund.index` | Mostly complete; over-refund possible (FIN-09 (LMS-AUDIT-116)); refund receipt never shown |
| Other fees collect / cancel / titles / mapping | `other_fees_collect_controller`, `other_fees_cancel_controller`, `other_fees_title_controller`, `other_fee_map_controller` | `other_fees_collect`, `other_fees_cancel`, `master/other-fees-title`, `master/additional-fees-mapping` | `fees_other_collection`, `fees_paid_other`, `fees_title`, `fees_breakoff_other` | via `/api/proxy?path=fees/other_fees_*` and direct `/fees/other_fee_map` | none | `other_fees_*.index` | Mostly complete; amounts wholly client-defined (FIN-15 (LMS-AUDIT-120)) |
| Online fee collection (Next flow) | `online_fees_payment_api_controller` (`initiate`, `preview`), gateway handlers in `online_fees_collect_controller` | `online_fees_collect/page.tsx`, `online-payment/[gateway]/page.tsx`, `app/api/fees/online-payment/[gateway]/route.ts` | `fees_payment`, `fees_online_maping`, `fees_razorpay`, `fees_hdffc`, `fees_icici`, `fees_axis`, `fees_aggre_pay`, `fees_payphi` | GET `/fees/online_fees_payment_api/{gw}/preview`, POST `/fees/online_fees_payment_api/{gw}` (+ public gateway callbacks) | JWT only | `online_fees_collect.index` | **Broken**: only Razorpay creates an order, and no payment-confirmation call exists (FIN-07 (LMS-AUDIT-114)); 4 gateway callbacks forgeable (FIN-01 (LMS-AUDIT-011)) |
| Online payment settings | `online_fees_settigs_controller` (`online_fees_settings_api` resource) | `online-fees-settings/page.tsx` | `fees_online_maping` + per-gateway tables (plaintext secrets) | GET/POST/DELETE via `/api/proxy?path=fees/online_fees_settings_api` | none | `online_fees.index` | Complete UI; no role gate (FIN-16 (LMS-AUDIT-121)) |
| Fee structure / masters | `fees_breackoff_controller`, `tblfeesConfigController`, `tblfeesLateController`, `feesReceiptBookMasterController`, `fees_title_controller`, `feesMonthHeadercontroller`, `update_fees_breackoff_*`, `map_year_controller` | `master/*`, `update-fees-breakoff`, `map_year` | `fees_breackoff`, `fees_config_master`, `fees_late_master`, `fees_receipt_book_master`, `fees_title`, `map_year` | direct `/fees/...` | none FE; BE tenant from request in most (FIN-05 (LMS-AUDIT-112)) | `fees_*_master.index` | Mostly complete |
| Fee reports | `fees_report/*` (collection, defaulter, cancel, structure, type-wise, datewise, other-fees, student breakoff) | `reports/*` + Next proxies `app/api/fees/reports/*` | `fees_collect`, `fees_paid_other`, `fees_cancel`, `fees_breackoff` | POST/GET `/api/fees/reports/*` -> `/fees/*_report` | none FE; BE tenant from request (FIN-05 (LMS-AUDIT-112)), raw SQL (FIN-03 (LMS-AUDIT-028)) | `fees_*_report.index` | Mostly complete |
| Receipt reprint / audit logs / online payments / reconciliation | `receipt_reprint_api_controller`, `fees_audit_log_api_controller`, `online_payments_api_controller`, `reconciliation_status_api_controller` | `reports/receipt-reprint`, `reports/audit-logs`, `reports/online-payments`, `reports/reconciliation-status` | `system_audit_logs`, `fees_payment` | GET `/fees/receipt/reprint`, `/fees/audit_logs`, `/fees/online_payments[/id]`, `/fees/reconciliation/status` | none; **no tenant scoping** (FIN-11 (LMS-AUDIT-118)) | (report menus) | Complete but unsafe |
| NACH bank mandate export/import | `NACH/s1..s4` controllers | `NACH_s1..s4` pages | `tblstudent_bank_detail`, `NACH_MASTER`, `S2_LOG` | direct `/fees/NACH_*` | none | fees transactional | Complete; PII + raw SQL (FIN-03 (LMS-AUDIT-028)/FIN-05 (LMS-AUDIT-112)) |
| Fee circulars | `feesCircular*Controller` | `circulars`, `master/fees-circular-master` | `fees_circular_log` | `/api/fees-circular/*` | `check_permissions` (route unnamed => none) | | Mostly complete (page 1252 lines, skimmed) |
| Fees dashboard / teacher dues | `FeesDashboardApiController`, `TeacherFeeDuesApiController` | `fees/dashboard`, `collect` KPI cards, `teacher-dues`, `app/dashboard/AdminDashboard.tsx` | `fees_breackoff`, `fees_collect` | POST `/api/fees-dashboard/summary|defaulters`, `/api/teacher-fee-dues/summary` | teacher dues: profile check ok; dashboard summary: none + client tenant (FIN-05 (LMS-AUDIT-112)) | fees dashboard | Complete |
| Backend fee modules with **no Next.js UI** | `cheque_cash`, `cheque_reconciliation`, `bank_master`, `fees_modification`, `tally_export_fees_report`, `daily_voucher`, `fees_payout_report`, `fees_monthly_report`, `fees_status_report` (+ SMS reminder), `fees_overall_*`, `fees_fine_discount_report`, `institute_wise_fees_paid_report`, `imprest_fees_cancel`, `imprest_refund_report`, `college_fees_collect`, `online_fees_split`, `confirm_online_fees`, `monthly_breakoff`, `monthwise receipt pdf`, `fees_donation_records`, `fees_refund_report` | none (grep of `app`, `lib`, `components`: 0 hits for these names) | many | routes exist in `routes/fees.php` | - | menu rows may exist -> would resolve to missing pages (NOT VERIFIED) | **Backend-without-UI** (in particular cheque bounce handling and reconciliation confirm are unreachable from the new UI) |
| Module dashboards (library, hostel, transport, admissions, students) | `LibraryDashboardApiController`, `HostelDashboardApiController`, `TransportationDashboardApiController`, ... | `app/library/dashboard`, `app/hostel/dashboard`, `app/Transportation/dashboard` | | POST `/api/{library,hostel,transportation}-dashboard/summary` | **no auth middleware at all** (FIN-13 (LMS-AUDIT-005)) | | Complete but unauthenticated |
| Petty cash | `PettyCashApiController` (`routes/api.php:820-829`, JWT-validity only, tenant/user from request) + Blade controllers `frontdesk/PettyCash*` | frontend EXISTS outside the listed dirs: `app/admin-services/petty-cash`, `petty-cash-master`, `petty-cash-report`, `_lib/pettyCash.ts`; `lib/petty-cash/` holds only the AI-stack registry | `petty_cash`, `petty_cash_master` | `api/petty-cash*` | none beyond JWT | (admin-services) | **Partially complete**; only the API controller was skimmed by sub-audit B, balance calculation NOT VERIFIED (FIN-85 (LMS-AUDIT-323)) |
| Inventory | `InventoryApiController` (`routes/api.php:482-488`, in-controller JWT + rights) | `app/Inventory/*` (InventoryPage config components, RequisitionForm, RequisitionApproval, ItemQuotation, GeneratePo, NegotiatePo, item_receivable, ItemDirectPurchase) | `inventory_requisition_details`, `inventory_item_quotation_details`, `inventory_generate_po_details`, `inventory_negotiate_po_details`, `inventory_item_receivable_details`, `inventory_item_master` | `api/inventory/{module}[/{id}]` | rights by legacy menu link (admin names bypass) | legacy `*.index` links | **Partially complete**: receive step unreachable (FIN-45 (LMS-AUDIT-127)), no stock ledger (FIN-46 (LMS-AUDIT-128)); Item Lost pages **Missing** |
| Transportation | `TransportationApiController` (`api/transportation-setup/*`), legacy `map_student_controller` (`routes/tranceport.php`) | `app/Transportation/*` | `transport_map_student`, `transport_school_shift`, `transport_kilometer_rate` | `api/transportation-setup/*`, `/map_student/fetchData` | JWT in-controller; several legacy routes unauthenticated | `map_student.index` etc. | **Partially complete** (FIN-56 (LMS-AUDIT-317)/57/58); `transportation` page is an alias of vehicles; send_late_sms Missing |
| Hostel | `HostelSetupApiController` (`api/hostel-setup/*`, `api.session`), `HostelDashboardApiController` | `app/hostel/*` (25+ wrapper dirs, 12 duplicate hyphen/underscore pairs) | `hostel_room_allocation`, `hostel_room_master` | `/api/proxy?path=hostel-setup/*` | JWT bound in-controller (positive control) | `hostel_*` | **Broken** for allocation (FIN-53 (LMS-AUDIT-131)); no capacity/fee link (FIN-54 (LMS-AUDIT-132)) |
| Library | legacy web controllers `BookController`, `itemScanController`, `LibraryReportController`, `LostandDamage` (`routes/web.php:579-611`) | `app/library/*` | `library_books`, `library_items`, `library_book_circulations`, `item_scan_details` | `/api/proxy?path=books|scan_books|library_report...` | `session` + route-name rights (bypass FIN-14 (LMS-AUDIT-003)/41) | `books.index` etc. | **Partially complete**: no issue/return circulation UI, no fines (FIN-59 (LMS-AUDIT-133)/61) |
| Front desk (gallery, circular, calendar, exam schedule, parent communication, leave, timetable) | `PhotoVideoGallaryApiController`, `circularController`, `calendar_api_controller`, `exam_scheduleController`, `timetableController::*Api` | `app/front_desk/*` | gallery/circular/calendar/timetable tables | `api/front-desk/photo-video-gallery`, `front_desk/*`, `calendar/*`, `school_setup/ajax_*Timetable*` | JWT-validity only; client tenant (FIN-76 (LMS-AUDIT-145)) | `front_desk/*` | **Partially complete** (list/create only for most) |
| Visitor / gate pass | `visitor_masterController`, `adminapiController::get_adminVisitorListAPI` | `app/hostel/_components/VisitorModulePage.tsx` (+ `app/admin-services/visitor*`, not audited) | `visitor_master`, `visitor_type` | `add_visitorAPI`, `get_adminVisitorListAPI`, `get_visitorTypeAPI` | none / tenant from request | hostel visitor menus | **Partially complete + unsafe** (FIN-39 (LMS-AUDIT-030)/40/66-68); OTP pickup backend-only |
| Inward / Outward | `inwardController`, `outwardController`, `place_masterController`, `physical_file_locationController` | `app/inward_outward/*` | `inward`, `outward`, `place_master` | `inward_outward/add_*` | route-name rights; client tenant | `add_inward.index` etc. | **Broken/likely broken**: add, numbering, delete (FIN-78 (LMS-AUDIT-147)/79) |
| Utility (rollover, breakoff rollover, student transfer, promote, update-all-data, custom-module) | `rollOverController`, `studentTransferController`, `transferStudentController`, `studentBulkUpdateController`, `CustomModuleController` | `app/Utility/*` | enrolment, fees_*, custom tables | `student/rollover*`, `student/student_transfer*`, `student/student_bulk_update`, `custom-module/*` | mostly none effective (FIN-70 (LMS-AUDIT-140)) | `rollover.index` etc. | **Partial and dangerous** (FIN-64 (LMS-AUDIT-032)..74, FIN-81 (LMS-AUDIT-150)) |
| Bazar bulk upload | `MigrationModulesApiController` | `app/bazar/*` | `sharebazar_position/_margin/_pnl` | `api/migration-modules/bazar-*` | JWT-validity only | bazar menus | **Partial** (FIN-82 (LMS-AUDIT-151)) |

Duplicate/alias notes: `app/hostel/*` has 12 hyphen/underscore duplicate page dirs (`app/data/routeMapper.ts:238-263`); `app/Transportation/transportation` aliases the vehicles config; `HostelGapPage` is dead code; inventory route `add_vendor_master_setup` points at a non-existent controller class (`routes/inventory.php:60`, sub-audit A). Backend-without-UI: inventory Item Lost / Lost report, transport `send_late_sms`, library issue/return/item modal/`item_verification_status`, visitor pickup OTP flow, gate pass, enquiry, `timetableAI*`, `add_cast`, `dicipline-Master`, `face_attendance`, `add_implementation`.

Inventory page -> API (all `api/inventory/...`): requisition_form -> `requisitions`; requisition_form_approved -> `requisition-approvals`; item_quotation -> `quotations`; generate_po -> `purchase-orders`; negotiate_po -> `purchase-order-negotiations`; item_receivable -> `receivables`, `receivables/items` (shadowed), `receivables/multiple` (shadowed); item_direct_purchase -> `direct-purchases`; inventory_allocation -> `allocations`; inventory_return -> `returns`; inventory_defective -> `defectives`; masters -> `master-setups, item-categories, item-sub-categories, items, taxes, vendors`; reports -> `reports/*`. Transport: drivers, vehicles, routes, stops, shifts, route-buses, route-stops, rates, student-mappings (+bulk, bulk-delete), van reports (`api/transportation-setup/*`). Library page -> legacy route: book_resources -> `books`; quick_return -> `quick_return`; scan_book -> `scan_books`; add_book_remark -> `scan_books_remarks[/store]`; report -> `library_report`/`show_library_report`; issue_overdue_report -> `book_issue_report`; print_barcode -> `print_barcode`/`generateBarcodePdf`; lost_damage_report -> `Lost_and_Damage`; scanned/pending reports -> `verified_book_report[_pending]`.

---



### Part 07 - Students / Admissions / Attendance

## 2. Module inventory (your scope)

Menus are role-dynamic from `/api/menu-rights` (see docs/student-menu-report.md); there is no static menu list in the frontend. "Menu entry" below is the route the screen is registered under in `app/_lib/module-screens.generated.ts`.

| Module | Backend (Laravel) | Frontend pages/components | DB tables (traced) | API endpoints | Permissions/roles | Menu entry | Status |
|---|---|---|---|---|---|---|---|
| Student list / search / profile edit | `api\StudentSearchApiController` (routes/adminapi.php:104-105) | app/students/search_student | tblstudent, tblstudent_enrollment, standard, division, academic_section, student_quota | POST get_adminStudentSearch, PUT get_adminStudentSearch/{id} | JWT signature only; tenant from client | /students/search_student | Partially complete (Add modal is a stub, row Edit/Delete dead; STU-32 (LMS-AUDIT-332)) |
| Add student | `api\StudentRegistrationApiController` | app/student/add_student, student-admin-api.ts | tblstudent, tblstudent_enrollment, student_quota, house_master | GET student-registration/metadata, GET next-enrollment-no, POST student-registration | JWT signature only | /student/add_student | Mostly complete; reduced field set (no photo/docs/mother name/religion), gender vocab bug (STU-18 (LMS-AUDIT-324)) |
| Student delete / withdraw | legacy `tblstudentController::destroy` (student/add_student/{id} DELETE) | none in Next | tblstudent(status=0), tblstudent_enrollment(end_date) | not called from Next | menu rights if route in tblmenumaster | - | Missing in UI; backend soft-delete un-scoped (STU-17 (LMS-AUDIT-158)) |
| Bulk student update | `api\BulkStudentApiController` | app/student/bulk_student_update | tblstudent, tblstudent_enrollment | GET bulk-students/metadata, POST /search, PUT bulk-students | JWT only | /student/bulk_student_update | Complete but unsafe (STU-19 (LMS-AUDIT-325)) |
| Student master setup (house, quota) | `api\StudentSetupApiController` | student/add_house, student/student_quota | house_master, student_quota | GET/POST/PUT/DELETE student-setup/{quota|house} | JWT only | /student/add_house, /student/student_quota | Complete; deletes unchecked (STU-24 (LMS-AUDIT-328)) |
| Optional subject mapping | `api\StudentOptionalSubjectApiController` | student/student_optional_subject | student_optional_subject, sub_std_map | POST student-optional-subject/search, PUT student-optional-subject | JWT only | /student/student_optional_subject | Complete |
| Health / vaccination / height-weight / discipline | `api\StudentCareApiController` | student_health, student_vaccination, student_hw, dicipline (all `StudentCareModule`) | student_health, student_vaccination, student_height_weight, dicipline | GET/POST/PUT/DELETE student-care/{module} | JWT only | /student/student_* | Complete but leaks medical PII (STU-20 (LMS-AUDIT-159)) |
| Infirmary | `api\StudentInfirmaryApiController` | student/student_infirmary | student_infirmary | GET/POST/PUT/DELETE student-infirmary, GET student-infirmary/students | JWT only | /student/student_infirmary | Complete, same authz gap |
| Student document uploads / missing-doc report | `tblstudentDocumentController`, `missingDocumentReportController` | students/student_documents (report only) | student_document | proxy student/missing_document_report/create | session mw + menu rights | /students/student_documents | Report only in Next; upload not in Next |
| Student requests (change requests) | `studentRequestController` | students/requests | student_change_request, student_change_req_type | student/student_request_fixed, student_request, student_request/{id}/status, student_request/create | session mw | /students/requests | Complete; approval un-scoped (STU-37 (LMS-AUDIT-334)) |
| Student reports (age-wise, inactive, strength, health, discipline, request, missing docs) | several legacy controllers | student/report/* | | student/agewise, show_student_health_report, student_strength_report/create, front_desk/dicipline_report/create, student_request_report_fixed/create | session mw | /student/report/* | Complete (tenant trust pattern, STU-06 (LMS-AUDIT-039)) |
| Student attendance marking | `studentAttendanceController` | app/attendance/attendance_dashboard, app/student/student_attendance | attendance_student, class_teacher, calendar_events, academic_year | GET student/student_attendance, POST show_student_attendance, POST save_student_attendance | JWT signature + client ids | /attendance/attendance_dashboard, /student/student_attendance | Works; multiple high issues (STU-04 (LMS-AUDIT-037), 10-12, 39) |
| Attendance reports (day/month/year) | same + `yearly_attendance_controller` | student/daywise_, monthwise_, yearly_student_attendance | attendance_student | student/show_daywise_student_attendance, show_monthwise_student_attendance, yearly_student_attendance, get_batch | JWT + client ids; get_batch has no auth mw | /student/*_attendance | Works; SQLi (STU-04 (LMS-AUDIT-037)); batch dropdown likely dead (STU-41 (LMS-AUDIT-337)) |
| Certificates | `StudentCertificateApiController` extends `studentCertificateController` | student/student_certificate | certificate_history, template_master | student/api/student_certificate/{templates,search,preview,save,history} | NONE | /student/student_certificate | Works; unauthenticated (STU-03 (LMS-AUDIT-036)) |
| ID cards (student, teacher, user) | `StudentIcardApiController`, `TeacherIcardApiController` (+ `api\TeacherIcardApiController::mine` for self service) | student/student_icard, teacher_icard, my_icard, students/ICards | tblstudent, tbluser, template_master | student/api/student_icard/*, student/api/teacher_icard/*, POST teacher-icard/mine | student/teacher_icard: NONE; mine: api.session, staff-only | /student/student_icard etc. | Admin tools unauthenticated (STU-03 (LMS-AUDIT-036)); self-service correct |
| Admissions: enquiry/registration/confirmation | `api\admissionEnquiryAPIController`, `admissionRegistrationAPIController`, `onlineAdmissionConfirmAPIController` | admissions/admission_enquiry, admission_registration, confirmation, registration/[id]/edit | admission_enquiry, admission_form, admission_registration, new_admission_inquiry_registration, tblstudent | /api/admission_enquiry, /api/admission_registration, /api/admission_student, /api/online_admission_confirm | NONE (no auth middleware, no JWT check) | /admissions/* | Works but unauthenticated (STU-01 (LMS-AUDIT-034), 02) |
| Admissions follow-up, reports, master | `admissionFollowUpController`, `admissionReportController`, `admissionMasterController` | admission_followUp, admission_reports, admission_form | admission_follow_up, admission_* | admission/admission_follow_up, admission/*_report, admission/admission_master | session mw | /admissions/admission_followup etc. | Works; follow-up IDOR (STU-06 (LMS-AUDIT-039)) |
| Public admission pages (`/admission-enquiry`, `/admission-registration`, `/admission-confirmation`) | n/a | app/admission-Enquiry, admissions/registration, admissions/confirmation | | | Behind login (ConditionalApp renders LoginPage when unauthenticated) | rewrites in next.config.ts | NOT public in Next; enquiry page broken (STU-27 (LMS-AUDIT-161)) |
| Public Laravel admission forms | `admissionEnquiryController::create/store(type=webForm)/paymentProof`, routes `onlineEnquiryFirst`, `processOnlineEnquiry`, `receipt` | Blade | admission_enquiry | admission_enquiry, admission_enquiry/store, admission_enquiry/payment_proof, admission/online-admission* | none | n/a | 3 routes point at methods that do not exist (STU-13 (LMS-AUDIT-155)) |
| Academic setup | `api\AcademicSetupApiController` | academic_setup/* | std_div_map, sub_std_map, period, period_details, batch, division_capacity_master, subject | GET/POST/PUT/DELETE api/academic-setup/{module} | token bound to tenant+user, rights checked | /academic_setup/* | Complete; destructive ops unchecked (STU-24 (LMS-AUDIT-328)) |
| Subject-elective mapping | `MigrationModulesApiController` | academic_setup/subject-elective-mapping, reports/* | subject_elective, result_marks, report_module_data | GET api/migration-modules/{module} | JWT + client ids | /academic_setup/subject-elective-mapping, /reports/* | Read-only generic table dump; stub (STU-33 (LMS-AUDIT-215)) |
| Class teacher master/report | `api\ClassTeacherApiController` | classteacher, classteacherReport | class_teacher | api/class-teachers | bound + rights | /classteacher, /classteacherReport | Complete; id validation gaps (STU-23 (LMS-AUDIT-327)) |
| Teacher transfer | `api\TeacherTransferApiController` | teachertransfer | timetable | GET/POST api/teacher-transfer | bound + rights | /teachertransfer | Complete; incomplete transfer semantics (STU-22 (LMS-AUDIT-326)) |
| Proxy (substitution) master/report/today | `school_setup\proxyController` (+ report controllers) | proxy_master, proxy_report, todays_proxy_report | proxy_master, timetable | school_setup/proxy_master*, ajax_getproxyperiod | JWT + client tenant | /proxy_master etc. | Works; IDOR + no conflict checks (STU-21 (LMS-AUDIT-160)) |
| Teacher daily report / user log | `TeacherDailyReportApiController`, `UserLogReportApiController` | teacher_daily_report, user_log | timetable, lms diary tables, access log | api/teacher-daily-reports/*, api/user-logs/* | bound + rights | /teacher_daily_report, /user_log | Complete |
| Users / profiles | `UserManagementApiController` | user/* | tbluser, tbluserprofilemaster | api/users*, user-profiles*, user-reports* | bound + rights | /user/* | Complete; plaintext password stored (STU-34 (LMS-AUDIT-061)) |
| Role dashboards | `RoleDashboardApiController` | dashboard/* | | POST admin|teacher|student-dashboard/summary via /api/dashboard/* | api.session, role-checked | /dashboard | Complete; SSRF-able proxy (STU-30 (LMS-AUDIT-001)) |
| Students / Admissions module dashboards | `StudentsDashboardApiController`, `AdmissionsDashboardApiController` | students/dashboard, admissions/dashboard | | POST api/students-dashboard/summary, api/admissions-dashboard/summary | NONE | /students/dashboard, /admissions/dashboard | Works; unauthenticated (STU-29 (LMS-AUDIT-005)) |
| Documents aggregation | `api\Documents\DocumentAggregationController` | documents/* | student_document, staff_document | GET api/documents, /sources, /recent | api.session + denyUnlessAdministrator | /documents | Complete and correct |
| Student rollover / promotion | `student\rollOverController` | app/Utility/rollover (outside dir list) | many | student/rollover(/create) | session mw | /utility/rollover | Works; issues STU-14 (LMS-AUDIT-156), STU-25 (LMS-AUDIT-329) |
| Circulars | `front_desk\circular\circularController` | front_desk/circular (outside list) | circular | front_desk/circular, circular/fetchData, TeacherFetchData | mixed | | Issues STU-35 (LMS-AUDIT-162) |
| Parent communication | `parentCommunicationController` | front_desk/parent_communication | parent_communication | front_desk/parent_communication, studentParentcommunicationListAPI, add_communicationAPI | mixed | | STU-08 (LMS-AUDIT-040) |
| Complaints / consent | `ComplaintApiController`, `ConsentApiController` | admin-services/* (outside list) | complaint, consent | api/complaints*, api/consents* | JWT + client tenant | | Same pattern as STU-06 (LMS-AUDIT-039) |
| PTM | not traced beyond menu | admin-services/ptm-* | | | | | Not reviewed |
| Timetable | classwise/facultywise timetable are in front_desk (outside dir list) | | | | | | Only proxy/teacher-transfer/class-teacher touched |
| lib/{students,admissions,attendance,timetable,...}-ai-stack.ts | none | ai-stack screens | | | | | Config only |

Flags:
- Backend-without-UI: student delete/withdraw, student document upload, student transfer (Utility), promotion of a single student, `online_admission_confirm` API (no Next caller found in scope), `admission_enquiry` DELETE API.
- UI-without-backend / stubs: Add Student modal in `/students/search_student` (STU-32 (LMS-AUDIT-332)); `/reports/*` and `/academic_setup/subject-elective-mapping` are generic dumps (STU-33 (LMS-AUDIT-215)).
- Menu/rewrite pointing at the wrong thing: `next.config.ts` rewrites `/admission-enquiry`, `/admission-registration`, `/admission-confirmation` to authenticated internal pages, not public forms (STU-27 (LMS-AUDIT-161)).
- Duplicate modules under different names: attendance dashboard (`/attendance/attendance_dashboard`) vs `/student/student_attendance` (two UIs, opposite defaults, STU-12 (LMS-AUDIT-154)); enquiry create in `/admissions/admission_enquiry` vs `/admission-enquiry` (STU-27 (LMS-AUDIT-161)); two student search/list surfaces (`/students/search_student` and Laravel Blade `search_student`).
- Dead Laravel routes: `admission/online-admission/{id}/{title}` -> `onlineEnquiryFirst`, `admission/process-admission-enquiry` -> `processOnlineEnquiry`, `admission/admission-receipt` -> `receipt` (grep shows no such methods in `admissionEnquiryController`; these routes will 500).

---



### Part 08 - HR / Org / Tasks / General

## 2. Module inventory (your scope)

| Module | Backend (Laravel controller/route or Next api) | Frontend pages/components | DB tables (traced) | API endpoints | Permissions/roles | Menu entry | Status |
|---|---|---|---|---|---|---|---|
| HRIT Leave (dashboard, requests, reports, configuration) | `routes/api.php:914-963` -> `api\Leave\*` (8 controllers). No route middleware; JWT checked inside `ResolvesLeaveContext` | `app/hrit/leave-management/*`, `_lib/leave-api.ts`, `use-leave.ts` | `hrms_emp_leaves`, `hrms_leave_types`, `hrms_leave_allocation`, `hrms_holidays`, `hrms_weekdays`, `hrms_leave_workflow_settings` (model), role-permission table | 35 endpoints (section 5) | UI: only the Configuration page checks profile name (substring admin/hr). Server: none | `hrit.leave.*` (routeMapper:457-460) | Partially complete (UI works, policy not enforced) |
| HRIT Attendance (tracking, reports, regularization, policy, request center) | `routes/api.php` `attendance/*` -> `api\Attendance\*`; legacy `hrms-*` web routes for some reports | `app/hrit/attendance-management/*` | `hrms_attendances`, `hrms_emp_leaves`, `hrms_holidays`, `tbluser` roster columns | 17 | none server-side beyond JWT | `hrit.attendance.*` | Tracking/reports: Mostly complete. Regularization: **Stub (in-memory)**. Policy: **Stub (static text)**. Request Center: partial (leave real, regularization mock) |
| HRIT Payroll (type, salary structure, deduction, monthly, Form 16, salary certificate) | Legacy web routes `routes/hrms.php:24-121` -> `Payroll\PayrollController` (2660 lines), `session,menu,logRoute,check_permissions` with `type=API` | `app/hrit/payroll-management/*`, `payroll-api.ts` | `payroll_types`, `employee_salary_structures`, `hrms_emp_payroll_deduction`, `employee_monthly_salary_data`, `staff_document`, `hrms_salary_certificate` | 22 | UI: `isPayrollRole` (substring admin/hr). Server: `check_permissions` by legacy route name only | `hrit.payroll.*` + legacy `monthly_payroll_report.index` | Partially complete; delete actions Broken (HR-14 (LMS-AUDIT-167)) |
| Talent Management (dashboard, recruitment, onboarding, performance, compensation, mobility, offboarding, administration, employee profiles, certifications, development) | `routes/talent_management.php` (`api.session`+`staff.only`), `competency_management.php` | `app/talent-management/*` (37k lines) | `talent_job_postings`, `talent_job_applications`, `talent_screening_results`, performance_*, mobility_*, offboarding_*, onboarding_* | ~150 | Reads: any staff. Writes: `RequiresTalentAdmin` = `is_admin` 1/2 only | `talent.*` (routeMapper:485-499) | Mostly complete; Administration = read-only list (KPIs show "-"); **Compensation page is a duplicate of Performance page** |
| Organization Management (employee directory, roles & permissions, compliance, disciplinary) | `routes/organization_management.php` (`api.session` only) | `app/organization-management/*` | `tbluser`, `tbluserprofilemaster`, `tblgroupwise_rights`, `staff_document`, org_compliance_*, disciplinary_records | 45 | Role rights gated (admin). Everything else **ungated** | `org_mgmt.*` | Mostly complete; authz broken (HR-03 (LMS-AUDIT-013), HR-16 (LMS-AUDIT-168)) |
| organization_managment (Department, Org profile) - **distinct module, not a duplicate** | `/api/departments-management*` (`departmentController`, JWT tenant), `/settings/organization_data`, `/api/ai-sop*` (unauthenticated) | `app/organization_managment/*` (10k lines) | `hrms_departments`, `hrms_job_titles`, SOP table | 14 | none | Reached via module-screen registry `/organization_managment/*`; **no routeMapper entry** (verified: grep of `app/data` empty) | Mostly complete |
| Task Management | `routes/task_management.php` (`api.session`+`staff.only`); bare `POST /task` (web.php:652, unauthenticated); `/table_data` | `app/task-management/*` | `task`, `task_projects`, `task_deadline_extensions`, `task_management_audit_logs`, notifications | ~85 | 4 report/permission routes have `task.permission`; the rest tenant-scoped only | `task_management.*` | Mostly complete; Integration admin = **Stub (in-memory Next route)** |
| Admin Services (visitor, front desk, complaint, consent, petty cash, PTM) | `api\{Complaint,Consent,FrontDesk,PettyCash}ApiController`, legacy `ptm/*`, `visitor_management/*` via `/api/proxy` | `app/admin-services/*` | `complaint`, `consent*`, `front_desk`, `petty_cash*`, ptm_* | ~40 | tenant from request (HR-07 (LMS-AUDIT-043)) | routeMapper:338-367 | Complete UI; authz broken |
| Easy Com | `routes/easycomapi.php` -> `api\easy_com\*` (`api.session`) | `app/easy_com/*` (config-driven) | `sms_api_details`, `smtp_details`, `whatapp_user_details`, `sms_sent_parents`, whatsapp_sent_messages | 39 | none beyond JWT | routeMapper:686+ | Complete UI; no role gate (HR-21 (LMS-AUDIT-004)) |
| General (add_process, fields_configuration, form_builder, groupwise/individual/mobile-app rights, implementation, mobile page builder, native dynamic pages, onboarding) | `GeneralSetupApiController`, `Groupwise/Individual/MobileAppMenuRights`, `CustomFieldApiController`, `MobilePageBuilderAdmin`, `requirements` (unauthenticated) | `app/general/*` | many | ~50 | Rights/config APIs correctly admin-gated (Info HR-36 (LMS-AUDIT-452)). `requirements` + `ai-sop` ungated | routeMapper (general) | add_process persistence = unauthenticated + global |
| Import Data | `routes/api.php:548-553` `api.session` -> `ImportApiController` | `app/import-data/*` | `import_table_fields`, `csv_data`, target tables | 4 | none | `/import-data` | Partially complete; match-fields Broken, no dedupe |
| Document Templates | `routes/api.php:863-879` -> `DocumentTemplateApiController` (no middleware) | `app/document-templates/*`, `components/document-template/*` | `document_templates` | 12 | none | `/document-templates` | Complete UI; authz broken (HR-02 (LMS-AUDIT-012)) |
| Shared components | - | `components/ui`, `ui/g2g`, `erp`, `search-dropdown`, `domain`, `templates` | - | - | - | - | See HR-33 (LMS-AUDIT-431) |

Flags: **UI-without-backend**: attendance regularization + policy, task integration configs, talent admin KPIs (4 of 5). **Backend-without-UI**: `/api/leave/distribution`, `/api/attendance/*` dashboard endpoints partly. **Duplicate modules**: `Compensation` page = `PerformanceCenter`; `organization-management` vs `organization_managment` are separate features that share a near-identical name (confusion hazard, not duplicates); `employee-directory` API duplicates `UserManagementApiController` (`/api/users`) with none of its authorization.

### 2b. Copy-paste template clusters and deviations

| Cluster | Files | Verdict / deviations |
|---|---|---|
| easy_com send screens | 5 `send_*` page.tsx -> `EntryPage` config | Config driven, low risk. Deviations: email screen uses `selectionField: 'sendsms'` (matches backend `SendEmailParentsApiController.php:199`, naming only); WhatsApp posts `sendNotification[studentId]` (matches `:90`) |
| easy_com reports | 5 `*_report` -> `ReportPage` config | Consistent. `whatsapp_report`/`register_parent_report` omit `optionsPath`, deliberate |
| easy_com masters | `sms_api`, `smtp`, `whatsapp_api` + `manage_sms_api` | `sms_api/page.tsx` is a 1-line file, `manage_sms_api` is the real page (duplicate route, one is dead) |
| admin-services CRUD/report pages | 20 pages | All use `legacyRequest`/`requireSession`, all wrap in try/catch (grep: try=catch in every file). Only `consent-master`, `ptm-attended-status`, `ptm-report`, reports have no delete confirm, which is correct for those. No missing-auth-header deviation found |
| hrit payroll pages | 6 pages, all `PayrollPageShell` | Consistent gate. Deviation: `salary-certificate` and `form-16` go through `/table_data` (unauthenticated, HR-01 (LMS-AUDIT-008)) for employee pickers |
| hrit leave pages | dashboard/requests/reports/configuration | Only `leave-configuration/page.tsx:46` gates by role; requests page shows Bulk Approve/Reject to everyone (`leave-requests/page.tsx:461,464`) |
| task-management `*-api.ts` (8) | share `task-session.ts` transport | Consistent. Deviation: `my-tasks-api.ts` also uses a raw `legacyGet/legacyPostForm` (bare host, token in query) and `integration-management-api.ts` targets Next in-memory routes |
| talent `*-api.ts` (10) | Bearer header + `contextParams` | Consistent. `recruitment-api.ts:216` bypasses it with a raw n8n `fetch` |
| general `GeneralPage` configs | 5 pages (`template_management`, `user_profile_masters`, `bulk_upload`, `form_builder`, `coming-soon`) | 3-line wrappers; `bulk_upload` renders a generic page with no upload backend (see HR-25 (LMS-AUDIT-339)) |

---



### Part 09 - Routes / APIs / Orphans

## 2. Module inventory (route + API inventories with totals)

### 2.1 Totals

| Inventory | Count |
|---|---|
| page.tsx files under app/ | 677 (676 routable, 75 with dynamic segments, 0 duplicate URL patterns, 0 case-only collisions) |
| Other Next files | 10 layouts, 1 loading.tsx, 1 not-found.tsx; **no middleware.ts / proxy.ts** (no server-side page gating: gate is client-side `ConditionalApp` -> `LoginPage`) |
| Next route handlers (app/api/**/route.ts) | 67 (handlers with zero callers: 7) |
| next.config.ts rewrites | 4 |
| Top-level route groups | 78 incl. root (largest: h5p 57, pal 55, fees 51, lms 40, student 35, enterprise-brain 33, hostel 28, result 25, Inventory 23, admin-services 22) |
| Menu-link keys evaluated through mapApiLinkToRoute | 570 (517 of the 553 file keys resolve; 36 file keys + 17 of 80 migration-seeded links resolve to non-existent pages) |
| Nav-context "/path" literals resolved | 2,360 (strong contexts in non-API files: 678, unresolved 29 -> 7 real broken navigations + 22 module-root prefix constants) |
| Orphan pages (no link/menu-map/registry/rewrite reference) | 80 (+69 weakly referenced) |
| Laravel route records (all 42 files, stub-router execution) | 5,453 (1,693 under /api); AUTH 4,594 / SOFT 28 / NONE 831 by route middleware |
| Frontend->Laravel call-site candidates | 1532 (1195 matched, 73 matched with inferred /api prefix, 74 matched via wrapper modelling, 80 Next-internal, 55 dynamic / unknown-prefix, 55 unmatched) |
| Distinct Laravel paths called | 1117 = 1042 verified to exist + 28 dynamic / unknown-prefix (NOT VERIFIED) + 47 unmatched (43 confirmed missing or mismatched backend routes covering about 14 features; 4 false positives) |
| Laravel routes referenced by those calls | 1421 route records: 1154 AUTH, 18 SOFT (fail-open lms.auth/perm), **249 NONE** (114 with no token check anywhere in the controller, 135 validating the JWT inside the controller) |
| Dead files (not reachable from any route/handler/script) | 62 in scope (components 10, lib 5, services 2, packages 1, app 44) + 2 test-only |
| Exports never imported | 1,723 (in 482 prod-reachable files; 1,151 are types) |

### 2.2 Module table (top-level route group; API columns are *detected* Laravel paths only - see NOT VERIFIED)

"Backend" lists the Laravel route files that the module's detected calls land in (or Next handlers). "DB tables" are NOT TRACED (out of scope of this mechanical part). "Menu" = pages of the module that the DB-menu mapper can emit (T2) out of pages. "Roles" = frontend gating is not per-module: only 65/676 pages transitively reach `usePermission` and 111/676 reach `useMenuRights`; everything else relies on DB menu visibility + backend. Status legend: PC = partially complete (a confirmed broken/missing endpoint), NV = NOT VERIFIED (every detected API path resolves to a registered route; behaviour not traced), STUB = wrapper/placeholder pages, - = no calls detected (unrecognised transport, e.g. slash-less legacy names through /api/proxy).

| Module | Backend (Laravel route file(s)) | Pages | DB tables | Distinct API paths detected (missing / dynamic / unauth NONE) | Roles | Menu-mapped pages | Orphans | Status |
|---|---|---|---|---|---|---|---|---|
| h5p | lms.php, pal_api.php | 57 | NOT TRACED | 21 (0 / 0 / 1) | see 3 | 6/57 | 0 | NV |
| pal | pal_api.php, lms.php | 55 | NOT TRACED | 120 (3 / 1 / 10) | see 3 | 15/55 | 3 | PC |
| fees | fees.php, api.php | 51 | NOT TRACED | 48 (0 / 1 / 0) | see 3 | 0/51 | 10 | NV |
| lms | api.php, lms.php | 40 | NOT TRACED | 83 (0 / 3 / 52) | see 3 | 25/40 | 2 | NV |
| student | student.php | 35 | NOT TRACED | 25 (0 / 0 / 11) | see 3 | 16/35 | 6 | NV |
| enterprise-brain | brain.php | 33 | NOT TRACED | 12 (0 / 0 / 0) | see 3 | 1/33 | 0 | NV |
| hostel | - | 28 | NOT TRACED | 0 (0 / 0 / 0) | see 3 | 0/28 | 0 | - (no calls detected) |
| result | resultapi.php, result.php | 25 | NOT TRACED | 34 (2 / 0 / 0) | see 3 | 21/25 | 0 | PC |
| Inventory | api.php | 23 | NOT TRACED | 3 (0 / 2 / 0) | see 3 | 0/23 | 20 | NV |
| admin-services | api.php, ptm.php | 22 | NOT TRACED | 25 (0 / 0 / 0) | see 3 | 15/22 | 1 | NV |
| admissions | api.php, admission.php | 18 | NOT TRACED | 12 (0 / 0 / 10) | see 3 | 0/18 | 3 | NV |
| general | api.php, mobile_page_builder.php | 16 | NOT TRACED | 31 (0 / 2 / 6) | see 3 | 0/16 | 5 | NV |
| easy_com | easycomapi.php | 16 | NOT TRACED | 2 (0 / 0 / 0) | see 3 | 14/16 | 1 | NV |
| hrit | api.php, hrms.php | 15 | NOT TRACED | 40 (0 / 2 / 0) | see 3 | 15/15 | 0 | NV |
| Transportation | api.php | 15 | NOT TRACED | 3 (0 / 2 / 0) | see 3 | 11/15 | 2 | NV |
| front_desk | web.php | 14 | NOT TRACED | 7 (0 / 0 / 0) | see 3 | 10/14 | 0 | NV |
| library | web.php, api.php | 13 | NOT TRACED | 17 (0 / 1 / 0) | see 3 | 10/13 | 0 | NV |
| students | student.php | 12 | NOT TRACED | 4 (0 / 0 / 0) | see 3 | 0/12 | 8 | NV |
| ai | - | 12 | NOT TRACED | 0 (0 / 0 / 0) | see 3 | 1/12 | 1 | - (no calls detected) |
| talent-management | talent_management.php, competency_management.php | 11 | NOT TRACED | 166 (5 / 1 / 0) | see 3 | 11/11 | 0 | PC |
| task-management | task_management.php, api.php | 11 | NOT TRACED | 39 (2 / 0 / 0) | see 3 | 10/11 | 0 | PC |
| teach-learn | - | 11 | NOT TRACED | 0 (0 / 0 / 0) | see 3 | 0/11 | 7 | - (no calls detected) |
| people-competency | - | 9 | NOT TRACED | 0 (0 / 0 / 0) | see 3 | 9/9 | 0 | - (no calls detected) |
| exam | lms.php, result.php | 8 | NOT TRACED | 17 (0 / 0 / 5) | see 3 | 3/8 | 0 | NV |
| Utility | student.php, custom_module.php | 8 | NOT TRACED | 16 (0 / 0 / 0) | see 3 | 6/8 | 0 | NV |
| inward_outward | inward_outward.php | 8 | NOT TRACED | 4 (0 / 2 / 0) | see 3 | 6/8 | 1 | NV |
| academic_setup | - | 8 | NOT TRACED | 1 (0 / 1 / 0) | see 3 | 7/8 | 1 | NV |
| integration | - | 7 | NOT TRACED | 0 (0 / 0 / 0) | see 3 | 0/7 | 0 | - (no calls detected) |
| career-explorer | - | 6 | NOT TRACED | 0 (0 / 0 / 0) | see 3 | 4/6 | 0 | - (no calls detected) |
| capability-intelligence | competency_management.php | 5 | NOT TRACED | 42 (5 / 0 / 0) | see 3 | 5/5 | 0 | PC |
| organization-management | organization_management.php, competency_management.php | 5 | NOT TRACED | 38 (0 / 0 / 0) | see 3 | 4/5 | 0 | NV |
| course-master | api.php, lms.php | 5 | NOT TRACED | 29 (0 / 0 / 20+9 soft) | see 3 | 0/5 | 1 | NV |
| user | api.php | 5 | NOT TRACED | 7 (0 / 1 / 0) | see 3 | 1/5 | 3 | NV |
| career-awareness | - | 5 | NOT TRACED | 0 (0 / 0 / 0) | see 3 | 5/5 | 0 | - (no calls detected) |
| platform-services | - | 4 | NOT TRACED | 0 (0 / 0 / 0) | see 3 | 0/4 | 0 | - (no calls detected) |
| reports | - | 4 | NOT TRACED | 0 (0 / 0 / 0) | see 3 | 4/4 | 0 | - (no calls detected) |
| attendance | student.php | 3 | NOT TRACED | 4 (0 / 0 / 0) | see 3 | 0/3 | 0 | NV |
| quiz | api.php | 3 | NOT TRACED | 2 (0 / 1 / 1) | see 3 | 0/3 | 0 | NV |
| document-templates | - | 3 | NOT TRACED | 1 (0 / 1 / 0) | see 3 | 0/3 | 0 | NV |
| learning-outcome | - | 3 | NOT TRACED | 0 (0 / 0 / 0) | see 3 | 3/3 | 0 | - (no calls detected) |
| subjects | - | 3 | NOT TRACED | 0 (0 / 0 / 0) | see 3 | 0/3 | 0 | - (no calls detected) |
| organization_managment | api.php | 2 | NOT TRACED | 13 (0 / 0 / 4) | see 3 | 0/2 | 2 | NV |
| career-counselling | lms.php | 2 | NOT TRACED | 3 (0 / 0 / 0) | see 3 | 2/2 | 0 | NV |
| documents | documents.php | 2 | NOT TRACED | 2 (0 / 0 / 0) | see 3 | 0/2 | 0 | NV |
| bazar | api.php | 2 | NOT TRACED | 1 (0 / 0 / 0) | see 3 | 2/2 | 0 | NV |
| import-data | api.php | 1 | NOT TRACED | 4 (0 / 0 / 0) | see 3 | 0/1 | 0 | NV |
| teacher_daily_report | api.php | 1 | NOT TRACED | 3 (0 / 1 / 0) | see 3 | 1/1 | 0 | NV |
| user_log | api.php | 1 | NOT TRACED | 3 (0 / 1 / 0) | see 3 | 1/1 | 0 | NV |
| classteacher | api.php | 1 | NOT TRACED | 2 (0 / 0 / 0) | see 3 | 0/1 | 0 | NV |
| dashboard | api.php | 1 | NOT TRACED | 2 (0 / 0 / 0) | see 3 | 0/1 | 0 | NV |
| mobile | mobile_page_builder.php | 1 | NOT TRACED | 2 (0 / 1 / 0) | see 3 | 0/1 | 0 | NV |
| proxy_master | web.php | 1 | NOT TRACED | 2 (0 / 0 / 0) | see 3 | 0/1 | 0 | NV |
| admission-Enquiry | api.php | 1 | NOT TRACED | 1 (0 / 0 / 2) | see 3 | 0/1 | 0 | NV |
| migration-modules | api.php | 1 | NOT TRACED | 1 (0 / 0 / 0) | see 3 | 0/1 | 0 | NV |
| sqaa | resultapi.php | 1 | NOT TRACED | 1 (0 / 0 / 0) | see 3 | 0/1 | 0 | NV |
| teachertransfer | api.php | 1 | NOT TRACED | 1 (0 / 0 / 0) | see 3 | 0/1 | 0 | NV |
| ai-journey | - | 1 | NOT TRACED | 0 (0 / 0 / 0) | see 3 | 0/1 | 1 | NV |
| ai-platforms | - | 1 | NOT TRACED | 0 (0 / 0 / 0) | see 3 | 0/1 | 1 | NV |
| ai-reports | - | 1 | NOT TRACED | 0 (0 / 0 / 0) | see 3 | 0/1 | 0 | NV |
| career-intelligence | - | 1 | NOT TRACED | 0 (0 / 0 / 0) | see 3 | 1/1 | 0 | NV |
| (17 single-page groups: chapters, classteacherReport, engagement, forgot-password, interactions, login, mobile-apps, mobile-bridge, modules, onboarding, platform-administration, platform-roadmap, proxy_report, settings, sqaa_document_report, sqaa_master, todays_proxy_report) | - | 17 | NOT TRACED | 0 | | | 1 | NV |

Calls made from shared code (not attributable to a route group): (root) 0 paths (0 missing, 0 dynamic, 0 unauth); (components) 157 paths (25 missing, 5 dynamic, 0 unauth); (lib) 80 paths (0 missing, 6 dynamic, 0 unauth); (next api) 26 paths (1 missing, 1 dynamic, 7 unauth); (app shared) 4 paths (0 missing, 0 dynamic, 2 unauth); (contexts) 3 paths (0 missing, 0 dynamic, 0 unauth).

Module notes (mechanical findings that change the status reading):

- **hostel** (28 pages): every page is a 5-line wrapper of `HostelModulePage`; 12 pages are hyphen/underscore twins (see ORPH-17 (LMS-AUDIT-434)). API path literals are passed slash-less through `/api/proxy?path=` (hostel/api.ts:95), so no calls are "detected" - status NOT VERIFIED, not "no backend".
- **teach-learn** (11 pages, 7 orphan) and the 9 duplicated fees category pages: category/placeholder pages fed by `/api/teach-learn/menu-categories` and `/api/modules/menu-categories` (Laravel routes api.php:204,211,212 all behind api.session). STUB-like.
- **pal** (55 pages, 120 paths): only module with a confirmed missing backend slice (intervention queue); 10 called routes are unauthenticated (pal_api.php public pedagogy-engine, lms/*, web.php PAL).
- **result** (25 pages): pages exist at hyphenated paths (`/result/marks-entry`) while the early routeMapper maps and ROUTES registry still emit underscore paths (36 broken menu keys); 2 confirmed backend path mismatches (`result/getMarksApproval`, `result/save_result_html`).
- **lms** (40 pages, 52 unauthenticated routes called) and **course-master** (5 pages, 20 unauthenticated + 9 soft): the largest unauthenticated surface (api.php lms-courses, lms-question-bank/*, lms-homework/*, lms-assignment/*, question-paper*, intelligence/*).
- **admissions / admission-Enquiry** (19 pages): 10 unauthenticated routes (admission_enquiry, admission_registration, admission_student, reports v2); admission-Enquiry is a mixed-case folder needing a rewrite.
- **Inventory** (23 pages, 20 orphans), **students** (12, 8 orphans), **fees** (51, 10 orphans), **teach-learn** (11, 7): highest orphan ratios; Inventory/Transportation/Utility are only reachable through lower-cased registry keys and DB links.
- **enterprise-brain** (33 pages): all calls go to `/api/brain/{tenantId}/...` (brain.php, brain.auth + brain.tenant + brain.permission on all 93 routes) - the best-protected module by route middleware.
- **people-competency / capability-intelligence / organization-management / hrit / talent-management / task-management**: `api.session` + `staff.only` groups (route files talent_management.php, competency_management.php, organization_management.php, task_management.php, hrms.php). Exceptions: task-management `/task/{id}` legacy + `user-rejected-tasks-courses` missing; talent recruitment form and hrit payroll call the public `/table_data`.
- **g2g LMS** (components/domain/lms, services/): 148 routes in g2g_lms.php behind api.session+staff.only; 21 assessments paths + enroll DELETE/PUT missing or renamed (ORPH-11 (LMS-AUDIT-175)), one public by design (certificate verify).

Flags requested by the brief:

- Backend without UI (called by nothing in the frontend, sample by structure): 5,453 - 1421 = ~4,032 Laravel route records are not referenced by any detected frontend literal (most are Blade-era web routes used by the Laravel UI, mobile-app endpoints in api.php/teacherapi.php/resultapi.php, and 25 DB-driven custom_module routes). Not a defect by itself; NOT enumerated route-by-route.
- UI without backend: the confirmed-missing or mismatched backend routes in section 10 (ORPH-06 (LMS-AUDIT-055)/07/11/12/13: Google login, Result marks approval + save html, G2G assessments contract drift, competency learning-assignments / lms-ai / department merge-parent, PAL intervention, legacy task, G2G enrol/unenrol) plus 36 + 17 menu links resolving to non-existent pages.
- Menus/links pointing at missing pages: see data-links section 1-3 (7 navigations, 36 mapper keys, 17 seeded links).
- Duplicate modules under different names: organization-management vs organization_managment, student vs students, sqaa / sqaa_master / sqaa_document_report, fees vs teach-learn category pages, exam vs result (marks-entry, exam-master), hostel kebab/snake twins, pal/framework vs pal/frameworks, /admission-Enquiry vs /admissions/admission_enquiry (data-links section 6).



### Part 10 - Laravel authz / tenant

## 2. Module inventory (backend families the frontend consumes)

"Tier" = what the controller enforces (my heuristic classification of every route lacking route-level auth; see CSV col G): **A** JWT verified + tenant taken from token + rights check; **A2** JWT + tenant from token, *no* role/rights; **B** JWT merely *valid*, tenant/user/role taken from request body; **C** no authentication in the controller.

| Module | Backend (Laravel controller/route) | lms_k12 references | DB tables (seen) | Permissions/roles enforced | Status |
|---|---|---|---|---|---|
| Login / token | `api/ApiLoginController@login` (`POST /api/api-login`), legacy `apiController@login/check_otp`, `adminapiController@admin_login/admin_check_otp` | AuthContext | `tbluser`,`tblstudent`,`tbluserprofilemaster` | none (see BE-14 (LMS-AUDIT-061)…16) | Working, weak |
| Menu / rights | `api/MenuRightsController` (`/api/menu-rights`, `/api/master-menu-rights`), `Groupwise/Individual/MobileApp*RightsApiController` | sidebar | `tblmenumaster`,`tbl*_rights` | menu endpoints **Tier C + SQLi**; rights editors Tier A | Broken (security) |
| Users / profiles | `UserManagementApiController` (11 routes) | `/users`, `/user-profiles` | `tbluser`,`tbluserprofilemaster` | Tier A (token-bound, admin/rights) — best-built controller; leaks `password`,`plain_password` (BE-14 (LMS-AUDIT-061)) | Complete |
| Students | `student.php`, `tblstudentController`, `adminapi.php` `Student*ApiController` (7) , `StudentsDashboardApiController` | students pages | `tblstudent`,`tblstudent_enrollment` | dashboards Tier C; `Student*Api` Tier B; certificate/icard `student/api/*` Tier C | Partial (security gaps) |
| Admissions | `admission*APIController` (17 routes in `api.php`), `admission.php` web | admissions | `admission_enquiry`,`admission_registration`,`tblstudent` | **Tier C** (incl. `POST /api/admission_student` creates students) + SQLi | Broken (security) |
| Fees | `fees.php` (149), `FeesDashboardApiController`, `FeesRefundApiController`, `fees_collect_controller`, `online_fees_collect_controller` | fees | `fees_*`, `fees_payment` | `session`+`check_permissions` (bypassable, BE-10 (LMS-AUDIT-003)); `PaidUnpaid` IDOR; gateway callbacks unsigned (BE-08 (LMS-AUDIT-011)) | Complete/weak |
| Attendance (HR) | `api/Attendance/*` (9), `HRITDashboard/*` | `/attendance/*` | `hrms_*` | Tier A2 (tenant from token; **no role**) | Complete/weak |
| Attendance (students) | `student/studentAttendanceController` (`type=API` branch) | | `attendance_student` | Tier B | Partial |
| Timetable | `TeacherTimetableApiController` (`api.session`), `faculty/classwisetimetableController` (`teacherTimetableAPI`,`studentTimetableAPI`, no auth) | | `timetable` | mixed | Partial |
| Exam / result | `resultapi.php` (185, `api.session` only), `ExamEvaluationApiController` (12, **Tier C**), `ApiQuestionPaperController`, `AssessmentBlueprintApiController`, `QuestionPaperTemplateApiController` (all Tier C) | result, exam | `result_*`,`lms_offline_exam`,`exam_evaluation_*` | none beyond login | Broken (security) |
| HR / leave / payroll | `api/Leave/*` (34), `HRMS/departmentController` (18), `Payroll/PayrollController` (web), `/table_data` (anonymous, BE-01 (LMS-AUDIT-008)) | hrit, leave | `hrms_emp_leaves`,`tbluser` | leave/department Tier A2 (no role) | Complete/weak |
| LMS course & content | `ApiLmsCourseController` (15, **Tier C**), `lms.php` (285), `lms/content*` ; authoring 4 routes `lms.auth`+`perm` (warn-only) | course pages | `content_master`,`chapter_master`,`lms_question_master` | Tier C for reads *and* writes | Broken (security) |
| Homework / assignment | `StudentHomeworkApiController` (14, C), `LmsAssignmentApiController` (12 C + duplicates behind `api.session`), `HomeworkSubmissionApiController` (`api.session`) | LMS | `homework`,`lms_assignment` | duplicate route definitions: the *unauthenticated* first registration is shadowed only if URI+verb equal; see BE-07 (LMS-AUDIT-009) | Partial |
| PAL / ESO | `pal_api.php` (151), `pal_eso_api.php` (22), `EsoEngineController` | pal, eso | `pal_*` | `pal.auth` + learner ownership + `eso.student` (good) | Complete |
| AI (`/api/ai/*`) | `AI/*Controller` (17 controllers, 89 routes) | ai | `ai_*` | authn + tenant hydrated; **no role gates** on config/policies (BE-19 (LMS-AUDIT-006)) | Complete/weak |
| MCP (`/api/mcp`, JSON-RPC + REST shim) | `Mcp/*`, `app/Mcp/Tools` (96) | `app/api/mcp` proxy | `mcp_*` | role = admin/staff/student only; `required_permission` not enforced (BE-20 (LMS-AUDIT-178)) | Complete/weak |
| Task mgmt | `task_management.php` (87) | tasks | `task_*` | `api.session`+`staff.only`; `task.permission` on 4 report routes only | Partial |
| Talent / competency / org mgmt | `talent_management.php`, `competency_management.php`, `organization_management.php` | people | `talent_*`,`org_*` | `staff.only`; admin gate (`RequiresTalentAdmin`) on 27 of 63 talent controllers; org: 3 of 8 | Partial |
| Easy Communication | `easycomapi.php` (36) + `WhatsappController` | communication | `sms_api_details`,`smtp_details`,`whatsapp_*` | **authn only** (BE-13 (LMS-AUDIT-068)) | Complete/weak |
| Import | `api/ImportApiController` (4, `api.session`) | `app/api/import` | `import_table_fields`,`csv_data` | authn only (BE-21 (LMS-AUDIT-347)) | Complete/weak |
| Integration configs | `SmtpApiController`, `SmsApiMasterApiController`, `WhatsappApiConfigApiController`, `fees/online_fees/*settings*` | integration-configs | `smtp_details`,`fees_razorpay`,… | secrets masked on read (good), stored plaintext | Complete/weak |
| Dashboards | `RoleDashboardApiController`, `*DashboardApiController` (5 anon), `UserDashboardPreferenceApiController` | dashboards | many | role dashboards Tier A(`api.session`); 5 module dashboards **Tier C** | Partial |
| Mobile bridge | `MobileWebHandoffApiController`, `MobileWebBridgeController`, `MobileDynamicPage*`, `mobile_page_builder.php` | `loginFromHandoffTicket` | `mobile_web_handoff_token` | ticket sha256-hashed, single-use, atomic burn (good) | Complete |
| Brain | `brain.php` (93) | `/brain` | `brain_*` | full stack: JWT, tenant, permission | Complete |
| Web-root PHP scripts | `public/*.php` (15) | none | direct DB | none (BE-06 (LMS-AUDIT-015)) | Deprecated / dangerous |

Backend-without-UI: `teacherapi.php` (34 routes, 0 referenced), `inventory.php` (27, 0), `hostel_management.php` (17, 0), `skill.php` (9, 0), `implementation.php`, most of `adminapi.php`, `platform.php` (15/16) — heuristic literal match, lower bound. UI-without-backend: none detected at path level (all `app/api/*` Next handlers proxy to existing Laravel paths); `NOT VERIFIED` per-parameter.
Duplicate modules under different names: Leave (`api/Leave/*` vs legacy `leave/*` vs `HrmsLeaveController`), Complaint/FrontDesk/PettyCash (API vs Blade twins), LMS assignment (defined twice in `api.php` lines 325–338 unauthenticated **and** 351–367 behind `api.session`), Result (`result.php` vs `resultapi.php`), HRMS attendance (`api/Attendance/*` vs `HRITDashboard/AttendanceApiController` vs `HRMS/HrmsController`), Department (`departmentController` serves `/departments` and `/departments-management`). Menu links to missing controllers: 16 route targets whose class is missing or wrong-cased (`lms\pedagogyEngineController` ×10 vs file `PedagogyEngineController.php`, `result\MarkUploadController` ×3, `ParaphraseController`, `H5pFlashcardController`, `TransportController`, `driver_masterController`, `vendor_masterController`, `report_module_controller`) — 500s on case-sensitive filesystems (BE-33 (LMS-AUDIT-438)).

---



### Part 11 - Database

## 2. Module inventory (inventories with totals)

### 2.1 MIGRATION INVENTORY

| Metric | Value | Note |
|---|---|---|
| Migration files (only path: `database/migrations`) | **1,084** | no other migration paths exist (`git ls-files` = 1,084; `.claude/worktrees/*` and `.kilo/worktrees/*` copies excluded) |
| Style | 1,071 anonymous-class, 13 named-class (`Create...Table`) | no class-name collisions |
| Files sharing one timestamp with others | 370 files in 44 groups; **279 files carry the single timestamp `2023_03_05_115658`** (bulk schema dump) | order within a group is alphabetical; 1 malformed name `2025_11_14_add_missing_columns_to_result_reportcard_marks_table.php` (no time component) |
| Kind (by `up()` content) | create 565 / alter-only 223 / raw-SQL or data-only 281 / **FK-stub 7** / other 8 | see 2.1.2 |
| Distinct tables created | **827** = 723 via Schema builder (incl. 14 via a private `createIfMissing()` helper in 2 files) + 104 via raw `CREATE TABLE` SQL (all `hpbrain_*`) | BE-25 (LMS-AUDIT-350) said 708: it missed the helper-created and raw-SQL tables |
| Tables by family | hpbrain 107, pal 73, lms 64, s_ 46, fees 35, ai 35, result 26, h5p 23, task 21, o_net 18, talent 18, inventory 18, student 15, hrms 14, tblstudent 13, transport 10, wk 8, hostel 7 | |
| Tables created by more than one migration | **84** = **68 columnless FK-stub creates** + **16 genuine duplicate creates** | see 2.1.2 and 2.1.3 (BE-25 (LMS-AUDIT-350)'s "84" is right but 68 of them are the stub files, not true re-creation) |
| Tables altered but never created by any migration | **3**: `result_reportcard_marks` (`2025_11_14_add_missing_columns...`), `result_personalize_marks` (`2026_02_24_102900`), `neo4j_sync_queue` (`2026_08_21_100000`, `2026_09_04_140000`) | + `sync_log`, `tblprofilewise_menu` etc. are *queried* by code / triggers but appear in no migration at all (2.3.4) |
| Dropped-then-recreated | 1: `2023_10_06_112100_create_sharebazar_position_table` runs `Schema::dropIfExists('sharebazar_position')` immediately before its `create` | table belongs to a stock-market domain foreign to a school ERP |
| Renamed tables / columns in `up()` | 0 tables; 6 files rename columns (`2025_01_09_173010`, `2025_02_13_144313` (`fees_late_master.term_id` -> `month_id`), `2026_05_15_114234`, `2026_06_17_120407`, `2026_09_11_114052`, `2026_09_21_110000`) | |
| Ordering conflicts (alter before create, FK to a later-created table) by timestamp order | **0** found | the real ordering problems are duplicates and never-created tables, not timestamps |
| Migrations with **no `down()`** | 0 | all have the method |
| Migrations with an **empty `down()`** (comment only / no-op) | **35** | BE-25 (LMS-AUDIT-350) said 2. Includes data-changing ones that cannot be undone: `2026_09_18_120000_reset_cfu_attempts_for_reordered_learning_cycle` (bulk UPDATE), `2026_08_24_150000_seed_default_proficiency_scale`, `2026_09_14_000005_restore_fees_ai_workspace`, `2026_09_01_000001_enable_student_intervention_workflow` and `2026_09_01_000002_publish_single_approval_academic_intervention_workflow`, `2026_09_21_100100_seed_pal_flow_shipped_profiles`, `2026_09_28_100500_rename_generic_module_templates...`; plus ~10 `brain_*` "make nullable / widen / precision" ALTERs and the 3 `pal_diagnostic_*` creates (full list: `down_empty=Y` in the CSV) |
| Migrations whose `down()` drops a table | **673** | `migrate:rollback` / `migrate:reset` would drop live tables (Kernel guard does not block these, see DB-09 (LMS-AUDIT-183)) |
| `create` migrations without a `hasTable` guard | **492 of 572** create-type files (485 of 565 real creates; 333 of them from 2023) | matches BE-25 (LMS-AUDIT-350)'s 492 |
| `alter` migrations without a `hasColumn` guard | 133 of 223 alter-only files (139 of the 237 files that contain any `Schema::table`; 34 unguarded from 2023, 42 from 2024) | a re-run fails with "duplicate column" |
| Raw `DB::statement` / `DB::unprepared` | **713 statements in 167 files** | mostly `hpbrain_*` DDL ported verbatim, triggers, `MODIFY`, `CREATE INDEX` |
| Data-writing migrations (`insert/update/delete/upsert`) | **150 files** (insert 110, delete 105, update 87, upsert/updateOrInsert 6) | menu/rights/workflow/template seeding lives in the schema history: 74 files touch `tblmenumaster`, 50 touch `tblgroupwise_rights`/`tblindividual_rights` |
| `DELETE` in `up()` | 5 files (`seed_ai_workspace_config`, `seed_course_catalog_ai`, `correct_student_role_menu_rights`, `move_teach_learn_course_catalog_to_onboarding`, `restore_teach_learn_operations_course_catalog`) | |
| `->change()` / `MODIFY` / `dropColumn` / `rename` in `up()` | change 10, MODIFY/ALTER COLUMN 13, dropColumn 3, rename 6, DROP TRIGGER/INDEX/FK 3 | listed in 2.1.4 |
| `TRUNCATE` | 0 | |
| Migrations using a transaction | 3 | DDL auto-commits on MySQL anyway |
| `migrate:status` reality (memory 2026-09-22) | 410 pending of 1,084 | `migrations` table never backfilled |

#### 2.1.1 Tables with a real Schema builder `create` and their guard status by year
2014-2019: 3 files unguarded; 2023: 333 unguarded / 0 guarded; 2024: 31 / 0; 2025: 23 / 0; 2026: 95 unguarded / 80 guarded. Only the 2026 Brain / PAL / platform work uses `hasTable` guards.

#### 2.1.2 The 7 "add_foreign_key" migrations are structurally broken (new finding, DB-01 (LMS-AUDIT-179))
Files: `2023_05_10_233617_add_foreign_key_into_access_log_route_table`, `2023_05_10_233617_..._batch_table`, `2023_06_10_233617_..._exam_schedule_table`, `2023_06_10_233617_..._fees_refund_table`, `2023_06_11_233617_..._inventory_item_quotation_details_table`, `2023_06_12_233617_..._inventory_item_lms_mapping_type_table`, `2023_06_12_233618_..._inventory_item_lms_mapping_type_table`.
Each `up()` contains **69 `Schema::create('<existing table>', function($table){ $table->foreign(...) ... })` calls with no columns at all** (159 FK declarations, `result_create_exam` three times), followed by `Schema::table(...)` blocks. `Schema::create` of an existing table throws error 1050; of a missing table emits `CREATE TABLE t ()` (syntax error). 9 of the 161 FK declarations reference columns that do not exist in the table (`result_create_exam.student_id/grade_id/division_id`, ...), and three reference tables that do not exist (`hostel_type_id`, `tbl_user`, `s_user_jobrole`). Net effect: **none of the foreign keys these files describe (fees_collect->tblstudent, homework->standard/subject/division, attendance, hostel, inventory ...) can ever have been applied by migration.**

#### 2.1.3 Genuine duplicate creates (16 tables)
`lms_competency_standards` (`2026_05_21_101524` and `2026_05_28_165851`, both unguarded - second always fails), `result_sub_activity` (`2024_09_03_114740_create_...` and `2024_09_10_161054_add_columns_hpc_report`, both unguarded), `failed_jobs` (2019 unguarded + `2026_09_03_010100` guarded), `jobs`, `job_batches` (`2026_08_20_000001` + `2026_09_03_010100`), `lms_assignments` (`2026_08_21_090600_add_competency_link_to_lms_assignments_table` *creates* it if missing, then `2026_09_05_230100_create_lms_assignments_table`), 9 `s_performance_*` tables (`2026_08_18_112000` unguarded + `2026_08_21_150000` guarded), `talent_onboarding_activity_log`.

#### 2.1.4 Migrations that would be destructive or irreversible on production
| Migration | Effect | Reversible? |
|---|---|---|
| `2023_10_06_112100_create_sharebazar_position_table` | `dropIfExists` before create | data lost if rerun |
| `2026_08_25_160000_correct_student_role_menu_rights` | `DELETE FROM tblgroupwise_rights WHERE menu_id IN (231,236,275,327,96,153,154,311) AND profile_id IN (all 'Student' profiles of every tenant)` + `UPDATE ... can_add/edit/delete=0` for menu ids 230,269,270,242,464,426; inserts 3 grants | hard-coded **numeric menu ids** (ids are not stable across databases - other menu migrations key on `link` precisely for that reason); deleted rows are not restorable |
| `2026_09_18_120000_reset_cfu_attempts_for_reordered_learning_cycle` | `UPDATE learner_node_state SET cfu_attempts=0 WHERE cfu_passed_at IS NULL AND cfu_attempts>0` across all tenants | empty `down()` |
| `2025_02_13_144313_add_columns_month_ids` | `fees_late_master.late_date` string(10) -> `date` (`change()`) and `term_id` -> `month_id` on a live fees table | `down()` re-changes back but non-date strings would be lost |
| `2026_08_31_000002_drop_display_id_from_evidence_events_table`, `2026_08_31_000003_convert_evidence_id_to_autoincrement` | drop column / PK conversion on `evidence_events` (documented APPEND-ONLY evidence ledger) | down re-adds an AUTO_INCREMENT UNIQUE column |
| `2024_10_18_120053_add_column_lms_curriculum` | `dropColumn('subject_curricula')` (inside hasColumn) | column data lost |
| `2026_08_18_172423_alter_tblstudent_password_column_length` | `ALTER TABLE tblstudent MODIFY password VARCHAR(255) NULL` (raw) | down narrows back to 50 (truncates bcrypt hashes) |
| `2026_09_11_114052_rename_engagement_score_to_exam_accuracy` | rename + change + re-add column on `pal_learning_sessions` | |
| `2026_08_21_100100_create_neo4j_sync_triggers` | creates AFTER INSERT/UPDATE/DELETE triggers on `tblstudent`, `tblstudent_enrollment`, `tbluser`, `lms_online_exam` and ~30 tables from `config/neo4j.php['projections']['triggered']` writing to `sync_log` (which no migration creates) | `down()` drops triggers; see DB-10 (LMS-AUDIT-184) |
| 33 other "empty `down()`" data / seed migrations | see CSV (`down_empty=Y`) | no rollback |
| 673 create migrations' `down()` | `Schema::dropIfExists` of live tables | `php artisan migrate:reset/rollback` (not blocked by `Kernel::bootstrap()`) |

### 2.2 MODEL <-> TABLE MAP

| Metric | Value |
|---|---|
| Model classes | **475** (474 in `app/Models/**` + `EvidenceEvent`) - all extend `Illuminate\Database\Eloquent\Model` (one `Authenticatable`: `User`) |
| Table source | 433 explicit `$table`, 1 dynamic (`DynamicModel`), 42 by naming convention |
| Distinct tables mapped | 461 |
| Models whose table is created by a migration | 456 |
| Models whose table is **not** created by any migration | **18** (2.2.1) |
| Tables in migrations with **no model** | **382** of 827 (hpbrain 107, ai 33, pal 32, lms 30, s_ 24, fees 19, result 9, wk 8 ...; 310 of them are still queried through `DB::table`/raw SQL; **72 have zero references anywhere in `app/routes/config/tests`**) |
| Mass-assignment declarations | `$fillable` 321, `$guarded` 96 (**35 are `$guarded = []`**, i.e. everything fillable: 8 `Mobility*`, 23 `H5p*`, `contentLibraryModel`, `userActivityModel`, `organizationDetails`, `organizationSisterDetails`), **58 models declare neither** |
| `$hidden` | **1** (`User` -> `users` table, which the ERP does not use) |
| `$casts` present | 157; **0 use `encrypted` casts** |
| Soft deletes (`use SoftDeletes`) | 96 models; every one of those tables has a `deleted_at` column in the migrations (checked) |
| `$timestamps = false` | 166 |
| Global / tenant scopes (`addGlobalScope`, `ScopedBy`) | **0** (the single `booted()` hit is not a scope). Tenancy is 100 % per-query. |
| `$connection` overrides | 0 |
| Duplicate class basenames | 5: `AuditLog` x2, `FeesCollect` x2, `chapterModel` x2, `topicModel` x2, `std_grd_maping` x2 |
| Tables mapped by more than one model | 12: `fees_collect` x3 (`FeesCollect`, `fees_collect`, `FeesCollect`), `tbluser` x2 (`loginModel`, `tbluserModel`), `task` x2 (`Task`, `taskModel`), `caste`, `fees_breackoff`, `inventory_requisition_details`, `chapter_master`, `master_skills`, `topic_master`, `school_setup`, `student_quota`, `transport_kilometer_rate` (x2 each) |
| Data-access reality | `DB::table(` **7,217** call sites, `DB::select` 246, `DB::raw` 1,203, `whereRaw` 1,901 vs Eloquent; 615 distinct tables touched through the query builder; only 131 `DB::transaction/beginTransaction`, **6 `lockForUpdate` (all in `InventoryApiController`)** |

#### 2.2.1 Models whose table has no creating migration
| Model (file) | Table | Verdict |
|---|---|---|
| `ac_typeModel` (`fees/NACH`) | `NACH_ac_type` | migration creates lowercase `nach_ac_type`; **fails on case-sensitive Linux MySQL** |
| `studentChangeRequestTypeModel` | `STUDENT_CHANGE_REQ_TYPE` | migration creates `student_change_req_type`; same case problem |
| `co_scholastic_master` (`result/co_scholastic_master`) | `co_scholastic_master` | referenced by 4 controllers + routes; no migration; migrations only create `result_co_scholastic*` |
| `lmslmsData` | `lms_data` | 1 controller; no migration |
| `OnetCareerCluster`, `OnetContentModelReference`, `OnetOccupationData` | `onet_career_cluster`, `onet_content_model_reference`, `onet_occupation_data` | O*NET import tables created outside migrations |
| `ConceptMastery` (PAL) | `pal_concept_mastery` | used by scheduled `coherence-mastery-sweep` (Kernel:105) |
| `questioncategoryModel`, `questionlevelModel` | `question_category_master`, `question_level_master` | migrations only create `old_question_*_master` |
| `ReportDynamic` | `report_dynamic` | |
| `jobOccupation`, `jobroleSkillModel`, `jobroleTaskModel`, `MobilityJobRole` | `s_jobrole`, `s_jobrole_skills`, `s_jobrole_task`, `s_user_jobrole` | 69 query-builder hits on `s_user_jobrole` in `G2gLms/AiAssessmentController` alone |
| `send_late_sms`, `std_grd_maping` (`result/std_grade_maping`) | `send_late_smses`, `std_grd_mapings` (naming convention) | **empty stub classes** (`//` body), the second is shadowed by the working `std_grd_maping` (`result/std_grd_mapping`, table `result_std_grd_maping`) |

#### 2.2.2 Models never used
19 models have **zero references** in controllers, services, other models, routes and tests: `LmsCertificate`, `LmsCourseEnroll`, `LmsCoursePrerequisite`, `LmsCourseSetting`, `LmsIntegration`, `SuggestedCourse` (all `G2gLms/`), `AdaptiveResponse`, `RelationAudit` (PAL), `PerformanceActivityLog`, `TalentOnboardingActivityLog`, `IdempotencyKey`, `TaskPriorityOption`, `TaskStatusOption`, `feesRefundModel` (the fees refund controller uses raw `DB::table('fees_refund')`), `requisitionApprovedModel`, `ContentResourceMetadata`, `lb_pointsModel`, `tblapplicationModel`, `add_vehicle_type`. A further 14 are referenced only by other models (`CompetencyAssessment*`, `LmsTrainer`, `LmsVendor`, `DiagnosticResponse`, `ProjectMember`, `ProjectTask`, `TimeEntry`, `AttachmentVersion`, `DeadlineExtension`, `MobilityJobRole`).

#### 2.2.3 Models exposing sensitive columns through `$fillable` with no `$hidden`
`loginModel` and `tbluserModel` (-> `tbluser`: `password`, `plain_password`, `otp`, `account_no`, `ifsc_code`, `pan_no`, `fcm_token`), `tblstudentModel` (`password`, `otp`, `aadhar_document_upload`, `ifsc_code`, `pan_card`, `admission_token_no`), `tblclientModel` (`db_password`), `tblapplicationModel` (`app_secret_key`), `temp_signupModel` (`otp`), `virtualclassroomModel` (`password`), `admissionEnquiryModel` / `admissionRegistrationModel` (Aadhaar), `inventory_vendor_masterModel` (PAN, bank a/c, IFSC), `feesCircularMasterModel` (`account_no`), `tblfeesConfigModel` (`pan_no`), `tblstudentFeesDetailModel` (`ifsc_code`). None has `$hidden`; `loginModel` also lists `is_admin`, `user_profile_id`, `sub_institute_id`, `client_id`, `status` as fillable.

#### 2.2.4 Tables with no model (382) - the ones that matter
Fees: `fees_payment`, `fees_aggre_pay`, `fees_axis`, `fees_hdffc`, `fees_icici`, `fees_payphi`, `fees_razorpay`, `fees_reconciliation`, `fees_receipt`, `fees_receipt_css`, `fees_online_maping`, `fees_online_split`, `fees_cancel_type`, `fees_title_master`, `fees_month_header`, `fees_breakoff_other`, `fees_breackoff_logs`. Attendance: **`attendance_student`**. HR: `hrms_leave_allocation`, `hrms_departments_mapping`, `hrms_emp_payroll_deduction`, `hrms_salary_certificate`. Result: `result_activity_*`, `result_remarks`, `result_exam_approve`, `result_skillset`. Student: `tblstudent_siblings`, `tblstudent_fees_failure`, `tblstudent_bank_detail_log`, `tblstudent_doc_std_mapping`. Exam evaluation: `exam_evaluation_batch/sheet/answer`. Easy-com: `smtp_details`. AI: `ai_api_keys` (+ 32 more `ai_*`). LMS: 30 `lms_*`. Full list: filter `no_model=Y` in `part11-table-inventory.csv`.

### 2.3 TABLE INVENTORY AND ORPHANS

#### 2.3.1 Totals
827 tables; 532 with a `sub_institute_id` column (530 exact + 2 case variants `SUB_INSTITUTE_ID`/`SubInstituteId`); 103 keyed by `tenant_id` (Brain); 3 by `client_id`; 1 by `institute_id`; **188 with no tenant column at all** (section 4). 329 tables declare no index at all (only implicit PK); 175 tables have at least one non-PK unique index; effective FKs total 129 (72 on `hpbrain_*`, 57 on 41 other tables) - see section 4.

#### 2.3.2 Orphan tables (no reference anywhere in `app`, `routes`, `config`, `tests`): 72
65 `hpbrain_*` (`hpbrain_accreditation_*`, `hpbrain_ai_*` (8), `hpbrain_dashboard*` (3), `hpbrain_import_*`, `hpbrain_locations`, `hpbrain_roles`, `hpbrain_skills`, `hpbrain_students`, `hpbrain_tenants`, `hpbrain_themes`, ...), plus `ai_agent_tools`, `ai_policy_acknowledgements`, `chapter_topics`, `job_batches`, `lms_chapter_topic_mapping`, `lms_master_mapping`, `lms_practice_sessions`. The `hpbrain_*` block is a verbatim port of a separate "enterprise brain" product: 107 tables created in **two parallel copies of the same migration set** (`2026_01_01_0000xx_*` raw SQL, and `2026_09_03_*_brain_*` re-issuing them), yet the app reads only ~40 of them.

#### 2.3.3 Legacy / foreign-domain tables
`sharebazar_position/margin/pnl` (stock-market), `erptour`, `wk_*` (8 legacy workflow tables), `o_net_*` (18 O*NET reference tables), `blogs`, `csv_data`, `tblmenumaster_new`, `tblmenumaster_old`, `old_question_category_master`, `old_question_level_master`, `users` (Laravel default identity table, `email` unique, unused - the ERP identity table is `tbluser`), `password_resets`.

#### 2.3.4 Tables queried by code but created by no migration (43 distinct via builder; NOT VERIFIED whether they exist live)
Most consequential: **`tblprofilewise_menu`** (joined in `api/GroupwiseRightsApiController.php:149,341` for the rights UI; migration `2026_09_22_160000_add_homework_review_menu` inserts into it only `if hasTable`), **`sync_log`** (16 refs; written by 30+ DB triggers), `neo4j_sync_queue`, `ai_models` (guarded by `hasTable`), `fees_hdfcrazorpay` (5 refs in online fees controller), `lms_question_extraction`, `lms_question_asset`, `question_publisher`, `question_type_catalog` (all `ApiLmsCourseController`), `pal_concept_mastery`, `pal_vocabulary`, `s_jobrole*`, `s_user_jobrole`, `result_reportcard_marks`, `result_personalize_marks`, `co_scholastic_master`, `hrms_attendance`, `career_journey`, `org_designation`, `talent_mobility_requests`, `talent_offboarding_clearances`, `student_master`, `teacher_content`, `units`, `grades`, `audit_logs`, `lms_achievements`, `lms_concept_outcome`, `z_donardetails`, `onet_*` (9), `tblstudent_quota`, `college_fees_collect`.

---



### Part 12 - Uploads / Import-Export / Notifications / Jobs / Integrations

## 2. Module inventory (your scope)

### 2.1 Phase 13 - File uploads / storage

| Module | Backend | Frontend | DB tables | API endpoints | Permissions/roles | Menu entry | Status |
|---|---|---|---|---|---|---|---|
| Student photo / parent photos / student documents / health docs | `student\tblstudentController`, `tblstudentDocumentController`, `studentHealthController`, `bulkStudentController` | `app/student/*`, `StudentCareModule.tsx` | `tblstudent`, `tblstudent_document`, `student_health` | `student/*` (T1), `student-care/{module}` (T3) | menu rights only | yes | Mostly complete; validation missing (INT-11 (LMS-AUDIT-191)) |
| Staff documents / payslips / resumes / offer letters / onboarding / compliance evidence | `user\tbluserController@addUserDocument`, `EmployeeDirectoryController@uploadDocument`, `PayrollController`, `JobApplicationController`, `OfferController`, `OnboardingDocumentController`, `ComplianceEvidenceController`, `FileController` | `organization-management/employee-directory/.../upload-doc-tab.tsx`, `talent-management/*` | `staff_document`, `hp_*` | `organization-management/*`, `talent-management/*` (T2 `staff.only`), `user/*` (T1) | see HR-31 (LMS-AUDIT-340) | yes | Complete but public-ACL storage (INT-07 (LMS-AUDIT-187)) |
| LMS content / homework / H5P / teacher resources / question-paper assets | `lms\contentController`, `ApiLmsCourseController`, `StudentHomeworkApiController`, `HomeworkSubmissionApiController`, `lms\h5p\*`, `TeacherResourceApiController`, `ContentUploadService` | `app/course-master`, `app/lms/homework`, `app/h5p` | `lms_*`, `homework*` | `lms/*` (T1), `api/lms-*` (T2/T4), `lms-homework/*` in `api_guard.protect` | LMS-15 (LMS-AUDIT-081)/16 | yes | Mixed: 2 hardened services, ~20 inline sinks |
| Front desk / visitor / petty cash / inward-outward / complaints / gallery / circular | `frontdesk\*`, `implementation\frontdesk\*` (duplicate of `frontdesk`), `api\{FrontDesk,Complaint,PettyCash,PhotoVideoGallary}ApiController`, `visitor_management\*`, `inward_outward\*` | `app/admin-services/*`, `app/front_desk`, `app/inward_outward` | `frontdesk`, `petty_cash`, `visitor_master`, ... | T1 web + T3 api | part06 FIN-77 (LMS-AUDIT-146) | yes | Complete; T3 endpoints unauthenticated (INT-10 (LMS-AUDIT-190)) |
| Fees uploads (receipt-book logos, fee config images, NACH S2/S4, reconciliation sheet) | `fees\*` | `app/fees/master/*`, `NACH_s*` | `fees_*`, `fees_reconciliation` | `fees/*` (T1) | FIN-38 (LMS-AUDIT-125) | yes | See INT-13 (LMS-AUDIT-193) |
| Settings / school logos / announcements / result masters / driver photo | `settings\*`, `school_setup\schoolController`, `result\*`, `transportation\add_driver` | - | - | T1 | - | yes | Pattern-identical sinks |
| Face attendance (student capture photos) | `front_desk\studentFaceAttendanceController`, `classFaceAttendanceController`, `adminapiController` | - | `student_capture_attendance` | T1 + adminapi (T3) | - | yes | Biometric images sent to 3rd party (INT-14 (LMS-AUDIT-194)) |
| Rich-text editor upload | `CkeditorFileUploadController` | legacy blade | - | `POST /ckeditor` (T0) | - | n/a | BE-05 (LMS-AUDIT-014) |
| Downloads / zips | `FileController`, `sqaa_controller`, `monthwiseReceiptPdfController`, `ExamEvaluationApiController@file`, `TaskAttachmentVersionController@download`, `AiAssistanceTicketController@screenshot`, `ApiQuestionPaperController@pdf`, `H5P*@export` | - | - | mixed | - | - | INT-35 (LMS-AUDIT-377) |

Flags: **backend-without-UI**: `transferDocs`/`convertDoc`, `download-folder`, `unlink-file`, `crm-whatsapp` (external CRM caller). **UI-without-backend**: none new. **Duplicate modules**: `implementation\frontdesk\*` duplicates `frontdesk\*` (identical upload code, 4 controllers); `contentLibraryControllerOld` not routed but present; `result_controller_OLD/OLD2` copies.

### 2.2 Phase 14 - Import / export

| Module | Backend | Frontend | DB tables | Endpoints | Permissions | Menu | Status |
|---|---|---|---|---|---|---|---|
| Generic import (tbluser, tblstudent, fees_collect, result_marks, result_personalize_marks, ...) | `api\ImportApiController` (API), `Import\ImportController` (web) | `app/import-data/page.tsx`, `app/api/import/{parse,process}` (Next proxies, **unused by the page**) | `csv_data`, `import_table_fields` | `POST api/import/{tables,parse,match-fields,process}` (T2); `/import_parse`, `/import_process` (T0) | none beyond `api.session` | `import-data` | Partially complete; design defects (INT-05 (LMS-AUDIT-052), INT-12 (LMS-AUDIT-192)) |
| Bulk student edit / active-inactive / bulk photo | `student\bulkStudentController`, `studentBulkUpdateController` | `app/student/*` | `tblstudent*` | T1 | menu rights | yes | Works; no transaction |
| Fees reconciliation sheet | `fees_reconciliation_upload_sheet_controller` | fees pages | `fees_reconciliation` | T1 | menu | yes | Wrong amount (INT-13 (LMS-AUDIT-193)) |
| NACH S1-S4 | `fees\NACH\*` | `NACH_s2excel_import`, `NACH_s4excel_import` | `bank_master` etc. | T1 | menu | yes | FIN-38 (LMS-AUDIT-125), INT-08 (LMS-AUDIT-188) |
| Bazar uploads (share-market position/margin/pnl) | `bazar\bulkUploadSheetController`, `MigrationModulesApiController` | `app/bazar/bulk-upload` | `sharebazar_*` | T1 / `migration-modules/{module}` | menu | yes | Data loss (INT-29 (LMS-AUDIT-371)) |
| Leave import | `leave\ApplyLeaveController@importOldLeave`, `Imports\LeaveImport` | - | `hrms_emp_leave` | `POST /import-leave` (T1) | menu | yes | INT-28 (LMS-AUDIT-370) |
| Bulk task CSV, G2G assign/governance CSV | `BulkTaskController`, `G2gLms\AssignmentsController`, `GovernanceController` | task-management, capability pages | `task`, `tbluser` | T2 `staff.only` | staff | yes | Best-practice examples (row errors, tenant scoped) |
| Standalone PHPExcel scripts | `public/excel_upload/*.php` | Blade links (`bulk_chapter_upload.blade.php`), `ImplementationManagementPage.tsx:94` | `chapter_master`, `topic_master`, `lms_question_master`... | direct URLs (T0) | **none** | link only | INT-04 (LMS-AUDIT-015) |
| Exports | `lib/table-export.ts` (64 pages), 20 own Blob exporters, `Excel::download` x2, `PDF::loadHTML` x16, wkhtmltopdf helpers x6 | - | - | - | tenant filter server-side | - | INT-30 (LMS-AUDIT-372), INT-32 (LMS-AUDIT-374) |

### 2.3 Phase 15 - Notifications

| Channel | Where sending code lives | Per-tenant credentials | Trigger tier | Queue? | Status |
|---|---|---|---|---|---|
| SMS | `Helper.php:2062 sendSMS` + 10 copy-pasted `sendSMS()` methods (`apiController:817`, `adminapiController:2923`, `send_sms_parents_controller:113`, `send_sms_staff:196`, `send_email_other:175`, `send_email_parents:188`, `feesStatusController:269`, `s4excel_importController:686`, `send_late_sms:111`, `visitor_masterController:561`) | `sms_api_details` (URL + query params + key, plaintext) via `manage_sms_api` | T1/T2 (bulk), T0 (`Resend_otp`) | no (sync curl, no timeout) | Working but fragile (INT-23 (LMS-AUDIT-365)) |
| E-mail | PHPMailer with per-tenant `smtp_details` in 6 controllers; Laravel `Mail::` only for signup/forgot-password/offer letter/MCP report/broken-links; Mailables: `OfferLetterMail`, `StudentReportNotice`, `BrokenLinksNotification` | `smtp_details` (plaintext password) | T1/T2, T1-no-perm (`ajax_sendmail`) | only `ReportSender` uses `->queue()` | INT-06 (LMS-AUDIT-186) |
| WhatsApp | `WhatsappController` (Meta Cloud API v25), `easy_com\SendWhatsappParentsApiController`, legacy Twilio `SyncWPDeliveryStatus` | `whatapp_user_details` (`cloud_api_access_token`, `cloud_api_phone_number_id`, plaintext) | T1/T2; **T0 `crm-whatsapp`** | no | INT-01 (LMS-AUDIT-016), INT-22 (LMS-AUDIT-364) |
| FCM push | `Helper.php:1799 send_FCM_Notification2` (legacy keys, hard-coded), `:1842 send_FCM_Notification` (v1, service-account JSON in `public/firebase/`) called inline from 22 controllers | 3 hard-coded legacy server keys + 4 service-account file names keyed on tenant ids 254/76/48/default | T1/T2 | no | BE-09 (LMS-AUDIT-176) + INT-23 (LMS-AUDIT-365) |
| In-app | `sendNotification()` -> `appNotificationModel::insert` (mobile app), `TaskManagement\NotificationController`, Platform `NotificationController` (config matrix only) | - | - | no | INT-25 (LMS-AUDIT-367) |
| Parent communication | `front_desk\parentCommunication\parentCommunicationController` (FCM + in-app), `easy_com\send_*` | - | T1 | no | ok |
| Laravel `app/Notifications` | **does not exist** (0 files). `app/Observers` also 0. | | | | |

### 2.4 Phase 16 - Jobs / events / scheduler

| Component | Location | Status |
|---|---|---|
| Queue default | `config/queue.php:16` `env('QUEUE_CONNECTION','sync')`; `retry_after` 90 on database/redis; `jobs` table migration `2026_08_20_000001`, `failed_jobs` `2019_08_19_000000` (live existence `NOT VERIFIED`) | INT-26 (LMS-AUDIT-368) |
| Jobs (4) | `EvaluateAnswerSheetJob` (tries 2, timeout 600), `EvaluateAssignmentSubmissionJob` (2/300), `EvaluateHomeworkSubmissionJob` (2/600), `EvaluateHomeworkSubmissionV2Job` (2/300); all have `failed()`; none `ShouldBeUnique`/`WithoutOverlapping`/`backoff` | INT-26 (LMS-AUDIT-368) |
| Events/Listeners | `ExamSubmitted` -> `GenerateAssessmentEvidenceListener` (`ShouldQueue`, tries 2, `failed()`), registered in `EventServiceProvider:23` | ok (runs inline under `sync`) |
| Observers | none | - |
| Scheduler | `Kernel.php:17-92` - exactly **3** scheduled items (`neo4j:drain` every minute `withoutOverlapping(5)`, `neo4j:reconcile` 02:30 `withoutOverlapping(120)`, two closures every 5 min `withoutOverlapping()`); `routes/console.php` only `inspire` | INT-27 (LMS-AUDIT-369) |
| Commands (91 files, 86 commands) | 15 `SyncONet*` (manual), 12 `next:*` tenant-257 one-off migrations (`cnsports/`), 25 `pal:*`, 10 `neo4j:*`, `ai:*`, `lms:*`, `cai:*`, `brain:*`, `sync:deliveryStatus` (Twilio, unscheduled), `test`, `test:function` | INT-21 (LMS-AUDIT-200), INT-37 (LMS-AUDIT-442) |
| Web-reachable "cron" endpoints | `GET /send_birthday_notification` (T0), `GET /Resend_otp` (T0), `GET /convertDoc` (T0), `POST /transferDocs` (T0) | INT-20 (LMS-AUDIT-199), INT-02 (LMS-AUDIT-050) |
| Scheduled data mutators | **none** for fees: no Razorpay status job, no fee reminders, no attendance auto-close; `fetch_payment_status` endpoints are only invoked by the SPA / on demand | INT-17 (LMS-AUDIT-197), INT-27 (LMS-AUDIT-369) |

### 2.5 Phase 17 - Third-party integrations (full table)

| # | Integration | Direction / purpose | Config source | Secret storage (redacted) | Auth | Timeout / retry | TLS verify | Inbound webhook signature | Production readiness |
|---|---|---|---|---|---|---|---|---|---|
| 1 | Razorpay (`api.razorpay.com`, checkout.js) | Fee payments | per-tenant DB `fees_razorpay`, `fees_hdfcrazorpay` (`key_id`,`key_secret`) via `fees_online_maping` | plaintext DB columns | key/secret basic; return handler uses `verifyPaymentSignature` (`online_fees_collect_controller.php:3097,3382`) | SDK default | SDK default (ok) | **no webhook route**; browser-return + polling only | Partial (INT-17 (LMS-AUDIT-197)) |
| 2 | HDFC (`hdfc_*` handlers) | Fee payments | DB `fees_hdffc`; hard-coded tenant 76 in handler (`:321,:920`) | plaintext | AES request/response | n/a | n/a (form POST) | **none** (FIN-01 (LMS-AUDIT-011)/BE-08 (LMS-AUDIT-011)) | Broken (FIN-01 (LMS-AUDIT-011)) |
| 3 | ICICI Eazypay (`eazypay.icicibank.com`) | Fee payments | DB `fees_icici` (`merchant_id`,`enc_key`); tenant 2440 hard-coded to UAT host `:1246` | plaintext | AES + verify call `EazyPGVerify` | none set (`CURLOPT_TIMEOUT` absent) | default | none | Broken (FIN-01 (LMS-AUDIT-011)) |
| 4 | ICICI Orange / PayPhi-style (`pgpay.icicibank.com`) | Fee payments | DB `fees_icici` | plaintext | HMAC-SHA256 secureHash on request only | 30 s | **verify off** (`:1659,:1863`) | **none** (comment "Omitted for brevity") | **initiate hits UAT** (INT-16 (LMS-AUDIT-196)) |
| 5 | PayPhi (`secure-ptg.payphi.com`) | Fee payments | DB `fees_payphi` | plaintext | HMAC request | `CURLOPT_TIMEOUT => 0` (infinite) | default | none | Broken (FIN-01 (LMS-AUDIT-011)) |
| 6 | AggrePay | Fee payments | DB `fees_aggre_pay` (`salt_key`) | plaintext | salt hash computed but **ignored** (`:2229-2233`) | - | - | hash not enforced | Broken (FIN-01 (LMS-AUDIT-011)) |
| 7 | Axis | Fee payments | DB | plaintext | - | - | - | none | Broken (FIN-01 (LMS-AUDIT-011)) |
| 8 | CCAvenue (`api.ccavenue.com`) split payout | Fee split | env `CCAVENUE_ACCESS_CODE` + DB | env / DB | AES enc_request | 30 s | **verify off** (`:621-622`) | - | Risky |
| 9 | SMS gateway (any HTTP-GET vendor) | OTP, parent SMS | per-tenant DB `sms_api_details` (`url`,`pram`,`mobile_var`,`text_var`,`last_var`) | plaintext | key in URL/query | **none** | **off** in 9 places | n/a | Fragile (INT-23 (LMS-AUDIT-365)) |
| 10 | E-mail SMTP | Parent/staff mail | per-tenant DB `smtp_details` (`gmail`,`password`,`server_address`,`port`); global env `MAIL_*` for `Mail::` | plaintext DB | SMTP auth | PHPMailer default | PHPMailer default | n/a | INT-06 (LMS-AUDIT-186) |
| 11 | WhatsApp Meta Cloud API (`graph.facebook.com/v25.0`) | Parent messages, CRM | per-tenant DB `whatapp_user_details`; **tenant 1's token hard-selected for `crm-whatsapp`** | plaintext | Bearer | Guzzle default (no timeout) | default | **none** (`incoming-message`, `update-message`) | INT-01 (LMS-AUDIT-016)/INT-22 (LMS-AUDIT-364) |
| 12 | Twilio (WhatsApp status sync) | legacy | env `TWILIO_SID`,`TWILIO_AUTH_TOKEN`; DB `user_whatsapp_sid/token` | env/DB | basic | - | default | - | Dead (INT-33 (LMS-AUDIT-375)) |
| 13 | FCM legacy (`fcm.googleapis.com/fcm/send`) | Push | 3 hard-coded server keys `Helper.php:1808,1813,1818` (`AAAA***`) | source | key header | none | **off** | n/a | Retired API (BE-09 (LMS-AUDIT-176)) |
| 14 | FCM v1 + Google OAuth (`oauth2.googleapis.com/token`) | Push | service-account JSONs `public/firebase/*.json` (4 fixed names; dir absent in checkout; not gitignored) | files | JWT-bearer assertion | none; **new access token per call** | **off, incl. the token exchange** (`Helper.php:1950-1951`) | n/a | Fragile |
| 15 | Google Sign-In (GSI client + `api/google-auth`) | Login | `NEXT_GOOGLE_CLIENT_ID` (non-`NEXT_PUBLIC_`) | env | ID token | - | - | - | Broken (part01/02) |
| 16 | Google Maps Distance Matrix | Transport distance | env `GOOGLE_API_KEY` | env | key in query | none | **off** (`tblstudentController:1338`) | n/a | Risky |
| 17 | Google Analytics Universal API (`ga.php`, `HomeController`) | Users-online widget polled every 3 s by `export_xlsx.php` | `.p12` service account | file | JWT | none | **off** | n/a | **Dead** (UA API sunset) |
| 18 | YouTube Data API | Content search | env `YOUTUBE_API_KEY` | env | key | `retry(0)` | default | - | ok |
| 19 | DigitalOcean Spaces (`s3-triz.fra1.cdn.digitaloceanspaces.com`) | All uploads (154 `disk('digitalocean')` refs, 83 with ACL `public`) | env `DO_SPACES_*` | env | S3 key/secret | SDK default | default | n/a | Public ACL everywhere, one shared bucket (INT-11 (LMS-AUDIT-191)) |
| 20 | AWS S3/SQS/SES | configured only | env `AWS_*` | env | - | - | - | - | unused |
| 21 | OpenAI (`api.openai.com`) - `OpenAIService` | Content, PDF, insights | env `OPENAI_API_KEY` | env | Bearer | 10-120 s (mixed) | **off in 14 calls** (`OpenAIService.php:40,152,225,324,494,745,785,845,1088,1394,1720,1949,2186,2276`) | n/a | Risky (INT-15 (LMS-AUDIT-195)) |
| 22 | OpenRouter | LLM proxy | env `OPENROUTER_API_KEY`, `OPENROUTER_MODEL` | env | Bearer | `timeout` set | default (except H5PIndex/Scenario) | n/a | ok |
| 23 | Gemini | LLM | env `GEMINI_API_KEY`/`GOOGLE_API_KEY` | env | key | 60-120 s, `retry` with backoff (`GeminiClient:224`) | default | n/a | ok |
| 24 | DeepSeek | LLM | env `DEEPSEEK_API_KEY` | env | Bearer | `timeout_seconds` | default | n/a | ok |
| 25 | Anthropic Claude | LLM | env `ANTHROPIC_API_KEY` | env | key | `CLAUDE_TIMEOUT_SECONDS` | default | n/a | ok |
| 26 | Gamma (`public-api.gamma.app`) | Presentation generation | env `GAMMA_API_KEY` | env | key | 30-120 s | default | n/a | ok |
| 27 | Neo4j (bolt) | Graph projection | env `NEO4J_*` | env | basic | bolt timeout; outbox+drain | n/a | n/a | memory: auth currently broken (`gotcha_neo4j_auth_broken`) |
| 28 | O*NET (`services.onetcenter.org`) | Occupation sync | env `ONET_USERNAME/PASSWORD` (10 uses) **and hard-coded in 28 places** | source (`trizinnovation:4225***`) | Basic | none | default | n/a | Secret in source (INT-18 (LMS-AUDIT-198)) |
| 29 | HuggingFace Space `harshit20991999-multi-face-detection-modal.hf.space` | Class-photo face matching | hard-coded URL `classFaceAttendanceController.php:45` | none | **none** | none | **off** | n/a | Privacy (INT-14 (LMS-AUDIT-194)) |
| 30 | HuggingFace Space `moncey10-homework-validation-system.hf.space` | Homework validation + annotated PDF host | hard-coded `studentHomeworkSubmissionController.php:169,199` | none | **none** | none | **off** | n/a | Privacy (INT-14 (LMS-AUDIT-194)) |
| 31 | HuggingFace `trizk-12-agenticai.hf.space` | Agent library (commented out) | `agentLibraryController.php:26` | - | - | - | - | - | dead |
| 32 | Cloud Run `getbloomslevel-*.a.run.app` | Bloom taxonomy classifier | hard-coded `AJAXController.php:2417`, `public/excel_upload/bulk_question_data.php:66` | none | none | none | **off** | n/a | Fragile |
| 33 | `kgenkit.vercel.app/api/genkit-k12` | Conversational AI (enrollment_no, sub_institute_id in query) | hard-coded `settings\conversationalAIController.php:138`, `Livewire\ConversationalAIV2.php:101` | none | none | - | default | n/a | Privacy |
| 34 | n8n webhook | Task assignment notification | `config('services.n8n.task_webhook')` - **key not defined in `config/services.php` or `.env.example`** | - | - | `Http::timeout(5)` | default | outbound only | **No-op** (INT-33 (LMS-AUDIT-375)) |
| 35 | Stripe / Mailgun / Postmark / SparkPost / Ably / Pusher / Papertrail / Slack log | config only | env | env | - | - | - | - | no code uses Stripe |
| 36 | ERP/Attendance API (`erp.triz.co.in/student/studentAttendanceChatAPI`) | MCP tool | env `ERP_API_*`, `ATTENDANCE_API_*` | env | token | - | default | - | ok |
| 37 | Vercel-hosted skill-ontology iframe `skill-ontology-neo4j.vercel.app` | Capability explorer | hard-coded `taxonomy-ontology.tsx:38`; passes `sub_institute_id` in query | - | none | 6 s load grace | browser | n/a | `sandbox` without `allow-same-origin` (good) |
| 38 | jsdelivr `@mdi/font@7.4.47` + `verify.min.js`, Google GSI, Razorpay checkout.js, YouTube embeds, `cdn.simpleicons.org`, `view.officeapps.live.com` | Frontend CDNs | hard-coded in `app/layout.tsx:35,41`, `login/page.tsx:41`, `fees/online-payment/[gateway]/page.tsx:82` | - | - | - | browser | - | No SRI, no CSP (INT-34 (LMS-AUDIT-376)) |
| 39 | `POST /api/integration-configs` (Next) | "Integration Center" persistence | in-memory `records[]` array | process memory | any `Authorization` header | - | - | - | **mock** (part02) |

---



## C. Backend without UI / UI without backend / broken menus

See Part 09 sections 2 and 10 (ORPH-*), Part 01 (AUTH-13 result menu map), Part 04 (LMS-27, LMS-28), Part 05 (AI-A20, AI-B22, AI-D19), Part 06 (FIN-33 fee features with no UI). Unified IDs:

| ID | Severity | Module | Issue | Source IDs |
|---|---|---|---|---|
| LMS-AUDIT-058 | High | Menu -> route mapping (Result module) | Result menu route-name map shadowed/incorrect; ~31-36 menu links point at non-existent pages | AUTH-13, LMS-27, ORPH-09 |
| LMS-AUDIT-175 | High | G2G Assessments / Learning dashboard, T… | 35 frontend endpoints have no matching Laravel route: | ORPH-11 |
| LMS-AUDIT-215 | Medium | Generic migrated modules (`/reports/*`,… | Generic "migrated module" pages dump raw first-array API data / show feature names with no implementation | STU-33, AI-D19 |
| LMS-AUDIT-240 | Medium | Duplicate modules | Parallel implementations with different behaviour: | LMS-28 |
| LMS-AUDIT-260 | Medium | Intervention / Tier-2 support (BR-06) | The module is entirely UI plus client-derived triggers; | AI-A20 |
| LMS-AUDIT-309 | Medium | Fees / backend features without UI | Grep of `app`, `lib`, `components` finds no caller/page for these; | FIN-33 |
| LMS-AUDIT-342 | Medium | Admin dashboard, HRIT leave, Talent man… | 7 in-app navigations target routes that have no page. | ORPH-10 |
| LMS-AUDIT-343 | Medium | PAL intervention queue | GET/POST `/api/pal/intervention` and `/{id}`, `/{id}/close` have no backend; | ORPH-12 |
| LMS-AUDIT-344 | Medium | Task management (legacy + reports) | Legacy `/task/{id}` update/delete and `/api/user-rejected-tasks-courses` are not registered. | ORPH-13 |
| LMS-AUDIT-381 | Low | Case-sensitive paths | PascalCase route directories vs lowercase menu keys break on case-sensitive filesystems | INFRA-25, ORPH-19 |
| LMS-AUDIT-400 | Low | Dead/duplicate code | Unreferenced DOK diagnostic panel and its `fetchDiagnosticAssessment/submitDiagnosticAssessment` client fns; | AI-A26 |
| LMS-AUDIT-410 | Low | New PAL navigation | Three navigation sources disagree: | AI-B22 |
| LMS-AUDIT-423 | Low | Dead code and duplication in the intell… | `AiInsightsPanel` has no importer and would always send no token (there is no `token` key in localStorage — see ai-journey/page.tsx:52 and ai-reports/[id]/page… | AI-D27 |
| LMS-AUDIT-434 | Low | Routing structure | 12 identical hyphen/underscore hostel page twins, misspelt duplicate module folders, exam/result twin screens and 80 pages with no reference. | ORPH-17 |
| LMS-AUDIT-435 | Low | Dead code and repo hygiene | 62 dead files, 1,723 never-imported exports, a 299-file design-system folder type-checked by `tsc`, 32 unused public assets, 7 Next handlers with no caller. | ORPH-18 |


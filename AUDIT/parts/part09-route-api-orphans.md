# part09-route-api-orphans - Route / API / link / dead-code / cross-module consistency audit

Scope: repository-wide mechanical cross-reference analysis of D:\lms_k12 (Next.js frontend) against D:\next_lms_erp (Laravel routes). Analysis date 2026-09-30, branch student_workflow. Read-only. Scripts live in the session scratchpad (not in the repo). Detailed lists are in sibling files:

- [part09-data-frontend-routes.md](part09-data-frontend-routes.md) - all 676 routable pages with reference tiers, rewrites, top-level groups
- [part09-data-links.md](part09-data-links.md) - broken links, menu-mapper failures, case hazards, duplicate routes, 80 orphan pages
- [part09-data-api-calls.md](part09-data-api-calls.md) - 67 Next handlers with callers, 1117 distinct Laravel paths with route/auth mapping, missing routes, dynamic (NOT VERIFIED) paths, 249 unauthenticated routes, hard-coded hosts
- [part09-data-dead-code.md](part09-data-dead-code.md) - 62 dead files, 1,723 unused exports, K-12/g2g status, unused assets
- [part09-data-consistency.md](part09-data-consistency.md) - identity/scope key variants, storage keys, 60 session readers, envelopes, dates, currency, status vocabularies

## 1. Scope & coverage

"Read fully" = read end-to-end or the whole relevant region by a human-style read; "Skimmed" = targeted excerpts around a machine-found hit; "Machine-analysed" = parsed by the TypeScript AST / PHP stub-router and included in every count, without a human read. Nothing was executed except (a) a stub router that only records Route:: calls and (b) the pure function mapApiLinkToRoute().

| Area/dir | Files in scope | Read fully | Skimmed | Not reviewed (beyond machine analysis) | Notes |
|---|---|---|---|---|---|
| app/**/page.tsx | 677 | 0 | ~30 | 647 | all 677 parsed for route inventory + link extraction; 1 non-routable (`app/pal/_dev-preview/diagnostic-summary`) |
| app/api/**/route.ts | 67 | 6 (proxy, proxy-file, forgot-password, google-auth head, dashboard/admin head, agents route) | 61 | 0 | pattern scan of token/401/x-laravel-base-url/validation for all 67 |
| app layouts / not-found / loading | 12 | 1 (ConditionalApp) | 3 | 8 | ConditionalApp is the only auth gate (client-side) |
| components/ | 248 | 0 | 3 | 245 | import graph + string literals only |
| lib/ (incl. 42 tests) | 182 | 5 (erp-client, erp-legacy, result/api partial, laravel-category-proxy partial, agents/acting-user partial) | 8 | 169 | |
| hooks/, contexts/, services/, packages/ | 6 + 2 + 2 + 5 = 15 | 1 (use-sidebar-navigation) | 2 (AuthContext, routeMapper) | 12 | services/* and packages/.../file-store.ts are dead |
| app/data, app/_lib, app/modules/_lib (menu/registry data) | 12 | 2 (module-screen-registry, routes.ts) | 4 (routeMapper, menuMappers) | 6 | routeMapper.ts evaluated by executing mapApiLinkToRoute over 570 keys |
| K-12 ERP Design System/** | 299 | 0 | 0 | 299 | only checked whether anything imports it (nothing does) |
| g2g/** | 1 | 1 (globals.css consumers) | 0 | 0 | used by 6 layouts |
| public/, scripts/, package.json, next.config.ts | 40 + 2 + 1 + 1 | 2 (package.json, next.config.ts) | 0 | 42 | asset reference scan |
| D:\next_lms_erp\routes\*.php | 42 files / 7,461 lines | 3 (RouteServiceProvider, mcp.php head, ai.php head) | ~12 | 27 | all 42 executed under a stub router: 5,453 route records, 0 execution errors |
| D:\next_lms_erp middleware (Kernel + 13 classes) | 14 | 9 | 2 | 3 | classification of auth vs non-auth |
| D:\next_lms_erp controllers | ~400 | 0 | ~22 spot reads (only to confirm auth behaviour of sampled actions) | rest | not a backend audit |
| **Totals (frontend)** | 2,254 tracked files; 2,071 app source files parsed; 163,392 string literals; 7,620 import edges | | | | |

Cross-check: part10-laravel-route-inventory.csv (another agent, same stub technique) lists 3,094 route declarations; this part reports 5,453 route records because Route::resource()/apiResource() are expanded into their per-verb records (3,094 declarations + expansion). Unreviewed/uncovered: routes/custom_module.php (DB-driven routes created at boot, 25 recorded statically); any Laravel route added by a package/provider outside RouteServiceProvider/AiServiceProvider/McpServiceProvider/PALServiceProvider/BroadcastServiceProvider (grep of loadRoutesFrom found only these); Vercel/production env values.

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

- **hostel** (28 pages): every page is a 5-line wrapper of `HostelModulePage`; 12 pages are hyphen/underscore twins (see ORPH-17). API path literals are passed slash-less through `/api/proxy?path=` (hostel/api.ts:95), so no calls are "detected" - status NOT VERIFIED, not "no backend".
- **teach-learn** (11 pages, 7 orphan) and the 9 duplicated fees category pages: category/placeholder pages fed by `/api/teach-learn/menu-categories` and `/api/modules/menu-categories` (Laravel routes api.php:204,211,212 all behind api.session). STUB-like.
- **pal** (55 pages, 120 paths): only module with a confirmed missing backend slice (intervention queue); 10 called routes are unauthenticated (pal_api.php public pedagogy-engine, lms/*, web.php PAL).
- **result** (25 pages): pages exist at hyphenated paths (`/result/marks-entry`) while the early routeMapper maps and ROUTES registry still emit underscore paths (36 broken menu keys); 2 confirmed backend path mismatches (`result/getMarksApproval`, `result/save_result_html`).
- **lms** (40 pages, 52 unauthenticated routes called) and **course-master** (5 pages, 20 unauthenticated + 9 soft): the largest unauthenticated surface (api.php lms-courses, lms-question-bank/*, lms-homework/*, lms-assignment/*, question-paper*, intelligence/*).
- **admissions / admission-Enquiry** (19 pages): 10 unauthenticated routes (admission_enquiry, admission_registration, admission_student, reports v2); admission-Enquiry is a mixed-case folder needing a rewrite.
- **Inventory** (23 pages, 20 orphans), **students** (12, 8 orphans), **fees** (51, 10 orphans), **teach-learn** (11, 7): highest orphan ratios; Inventory/Transportation/Utility are only reachable through lower-cased registry keys and DB links.
- **enterprise-brain** (33 pages): all calls go to `/api/brain/{tenantId}/...` (brain.php, brain.auth + brain.tenant + brain.permission on all 93 routes) - the best-protected module by route middleware.
- **people-competency / capability-intelligence / organization-management / hrit / talent-management / task-management**: `api.session` + `staff.only` groups (route files talent_management.php, competency_management.php, organization_management.php, task_management.php, hrms.php). Exceptions: task-management `/task/{id}` legacy + `user-rejected-tasks-courses` missing; talent recruitment form and hrit payroll call the public `/table_data`.
- **g2g LMS** (components/domain/lms, services/): 148 routes in g2g_lms.php behind api.session+staff.only; 21 assessments paths + enroll DELETE/PUT missing or renamed (ORPH-11), one public by design (certificate verify).

Flags requested by the brief:

- Backend without UI (called by nothing in the frontend, sample by structure): 5,453 - 1421 = ~4,032 Laravel route records are not referenced by any detected frontend literal (most are Blade-era web routes used by the Laravel UI, mobile-app endpoints in api.php/teacherapi.php/resultapi.php, and 25 DB-driven custom_module routes). Not a defect by itself; NOT enumerated route-by-route.
- UI without backend: the confirmed-missing or mismatched backend routes in section 10 (ORPH-06/07/11/12/13: Google login, Result marks approval + save html, G2G assessments contract drift, competency learning-assignments / lms-ai / department merge-parent, PAL intervention, legacy task, G2G enrol/unenrol) plus 36 + 17 menu links resolving to non-existent pages.
- Menus/links pointing at missing pages: see data-links section 1-3 (7 navigations, 36 mapper keys, 17 seeded links).
- Duplicate modules under different names: organization-management vs organization_managment, student vs students, sqaa / sqaa_master / sqaa_document_report, fees vs teach-learn category pages, exam vs result (marks-entry, exam-master), hostel kebab/snake twins, pal/framework vs pal/frameworks, /admission-Enquiry vs /admissions/admission_enquiry (data-links section 6).

## 3. Role / access-control findings (frontend gating vs backend enforcement)

| Layer | Finding | Evidence |
|---|---|---|
| Page gate | Client-side only. `ConditionalApp` renders `LoginPage` when `useAuth().isAuthenticated` is false; there is no middleware.ts/proxy.ts, so every page bundle is served to anonymous users and only rendering is withheld. `isAuthenticated` derives from localStorage (`auth`, `userData`, `sessionDate == today`). | app/components/ConditionalApp.tsx:26-46; contexts/AuthContext.tsx:38-41,134 |
| Role gating in UI | Not systematic: `usePermission` (calls `GET /api/permissions`, an `lms.auth` fail-open route) is reachable from 65/676 pages; `useMenuRights` from 111/676; 158 pages reach AuthContext. Most pages rely on the DB-driven menu to hide links, not on route guards; a URL typed by hand opens any page for any logged-in role. | graph reachability (this part); app/hooks/usePermission.ts:79 |
| Route protection of Laravel APIs | 3 different mechanisms coexist (ORPH-15): route middleware `api.session` (JWT validated + session hydrated), in-controller `GetsJwtToken->validate()` on `api`-group routes (135 called routes), and `lms.auth`/`perm:*` which pass anonymous callers unless env LMS_API_AUTH_ENFORCE is true. 249 called routes have none of these at route level; 114 have no token reference in the controller either. | routes/api.php; app/Http/Middleware/LmsApiAuth.php:26-37; config/lms_content.php:144 |
| Identity source on the server | For the unauthenticated group the tenant/user come from request input (`$request->input('sub_institute_id')`), so the caller chooses the tenant. For api.session routes the tenant comes from verified JWT claims (HydratesLegacyApiSession). | AdmissionsDashboardApiController (validate sub_institute_id from request); StudentHomeworkApiController:22-26 |
| Next handlers | `/api/agents/*` and `/api/conversational-ai/*` build the acting user from client headers `x-sub-institute-id`, `x-user-id`, `x-user-profile-name` and then ask Laravel `/api/permissions` (fail-open lms.auth) for rights; `x-laravel-base-url` header selects the upstream (ORPH-05). | lib/agents/acting-user.ts:22-34,53-89 |
| Per-module frontend-vs-backend | api.session + staff.only modules (talent, competency, organization, task, hrms, g2g): both layers aligned. LMS/admissions/admin-services/fees-circular legacy api.php modules: frontend passes `sub_institute_id`, `syear`, `user_id`, `user_profile_name` in body/query; backend either validates JWT in-controller (complaints, consents, front-desk, petty-cash, class-teachers, users, rights, inventory...) or trusts input (the 114). | data-api-calls section 5 |

## 4. Tenant / school / academic-year scoping findings

- The client always sends the scope: `type=API`, `sub_institute_id`, `syear`, `user_id`, `term_id` are appended by `lib/erp-legacy.ts:buildQuery/contextBody`, `lib/erp-client.ts:appendCommonParams`, `lib/result/api.ts`, and ~60 module-local session readers (data-consistency section 6c).
- Server trust: api.session routes ignore the client tenant in favour of JWT claims (HydratesLegacyApiSession takes syear/term from request only as a *selector* and validates against academic_year for the JWT tenant). The 114 unauthenticated routes and `GET /table_data` take the tenant entirely from request parameters, so any caller can read/write any tenant by changing `sub_institute_id` (ORPH-01, ORPH-02).
- `GET /table_data?table=tbluser&filters[sub_institute_id]=<any>` is the extreme case: the frontend itself passes the tenant as a *client filter* (payroll-api.ts:911-915) and the server applies whatever filters it is given.
- Academic year: `syear` (wire) vs `academicYear`/`academicYearId`/`selectedAcademicYear` (client) with two precedence orders (erp-client: active term first, stale selection ignored; result/brain readers: `selectedAcademicYear ?? userData.syear`) - the same screen family can show different years (data-consistency section 2).
- Key names for the same tenant value: `sub_institute_id` 785/246 files, `subInstituteId` 762/232, `instituteId` 78/29, `tenantId` 39/7, `tenant_id` 28/7, `client_id` 63/21 (data-consistency section 1).

## 5. API endpoints consumed or exposed

### 5.1 Consumed - Laravel (1117 distinct paths)

Complete per-path table (frontend path, status, auth class, matched Laravel route(s), call sites) is in [part09-data-api-calls.md section 2](part09-data-api-calls.md); missing routes in section 3; dynamic (NOT VERIFIED) in section 4; unauthenticated routes in section 5; hard-coded hosts in section 6. Summary by transport:

| Transport | Detected sites | Notes |
|---|---|---|
| `/api/proxy?path=` and `/api/proxy-file` (same origin relay -> Laravel `API_BASE_URL`) | 130 literals in 75 files | relay forwards client Authorization + Cookie; path param unvalidated; used by fees, library, admissions, front_desk, career*, lms/*, general/* ... |
| Direct browser -> Laravel `${session.baseUrl \| API_BASE_URL}/...` | ~316 (base+api 173, base+legacy 143) | host from `userData.host_name` or NEXT_PUBLIC_API_BASE_URL_*; needs CORS on Laravel; lib/result/api.ts also puts the JWT in the query string |
| Wrapper helpers with `/api` prefix (apiGet/apiPost/request helpers in each module `_lib`, task-session, tenantPath, brain, ai clients...) | ~680 (prefixed 582, cross-file 97) | verified through per-file / cross-file prefix detection |
| AI host (`AI_API_BASE_URL` fallback `API_BASE_URL`; `AI_UPSTREAM_BASE_URL` server-only) | lib/intelligence/*, lib/ai/mcp-client.ts, app/api/ai/* | /api/ai/* and /api/mcp/* are AUTH (McpAuth) |

### 5.2 Exposed - Next route handlers (67)

| # | Method(s) | URL | Auth in handler | Validation | Notes |
|---|---|---|---|---|---|
| 1 | POST | `/api/admissions/dashboard/summary` | forwards token only (no check) | zod | client-controlled x-laravel-base-url |
| 2 | PATCH | `/api/agents/[id]` | header identity (x-*), Laravel permission lookup | none |  |
| 3 | POST | `/api/agents/[id]/run` | header identity (x-*), Laravel permission lookup | none |  |
| 4 | GET,POST | `/api/agents` | header identity (x-*), Laravel permission lookup | none |  |
| 5 | GET | `/api/agents/runs` | header identity (x-*), Laravel permission lookup | none |  |
| 6 | POST | `/api/ai/ask/stream` | forwards token only (no check) | zod |  |
| 7 | POST | `/api/ai/assistance-tickets` | 401 on missing token | zod |  |
| 8 | POST | `/api/ai/field-edit` | 401 on missing token | zod |  |
| 9 | PUT | `/api/conversational-ai/projects/[id]/settings` | header identity (x-*), Laravel permission lookup | none |  |
| 10 | POST | `/api/conversational-ai/projects/[id]/token` | header identity (x-*), Laravel permission lookup | none |  |
| 11 | GET | `/api/conversational-ai/projects` | header identity (x-*), Laravel permission lookup | none |  |
| 12 | POST | `/api/dashboard/admin` | 401 on missing token | zod | client-controlled x-laravel-base-url |
| 13 | POST | `/api/dashboard/student` | 401 on missing token | zod | client-controlled x-laravel-base-url |
| 14 | POST | `/api/dashboard/teacher-fee-dues` | 401 on missing token | zod | client-controlled x-laravel-base-url |
| 15 | POST | `/api/dashboard/teacher-icard` | 401 on missing token | zod | client-controlled x-laravel-base-url |
| 16 | POST | `/api/dashboard/teacher-timetable` | 401 on missing token | zod | client-controlled x-laravel-base-url |
| 17 | POST | `/api/dashboard/teacher` | 401 on missing token | zod | client-controlled x-laravel-base-url |
| 18 | GET | `/api/fees/audit-logs` | delegates to fees-report-proxy.ts (forwards x-laravel-token, no check) | none | client-controlled x-laravel-base-url |
| 19 | POST | `/api/fees/dashboard/summary` | forwards token only (no check) | zod | client-controlled x-laravel-base-url |
| 20 | GET | `/api/fees/menu-categories` | forwards token only (no check) | zod | client-controlled x-laravel-base-url |
| 21 | POST | `/api/fees/online-payment/[gateway]` | forwards token only (no check) | none |  |
| 22 | GET | `/api/fees/online-payments` | delegates to fees-report-proxy.ts (forwards x-laravel-token, no check) | none | client-controlled x-laravel-base-url |
| 23 | GET | `/api/fees/receipt-reprint` | delegates to fees-report-proxy.ts (forwards x-laravel-token, no check) | none | client-controlled x-laravel-base-url |
| 24 | GET | `/api/fees/reconciliation-status` | delegates to fees-report-proxy.ts (forwards x-laravel-token, no check) | none | client-controlled x-laravel-base-url |
| 25 | GET | `/api/fees/reports/datewise-summary/fees-title` | delegates to fees-report-proxy.ts (forwards x-laravel-token, no check) | none | client-controlled x-laravel-base-url |
| 26 | GET | `/api/fees/reports/datewise-summary` | delegates to fees-report-proxy.ts (forwards x-laravel-token, no check) | none | client-controlled x-laravel-base-url |
| 27 | GET,POST | `/api/fees/reports/fees-cancel` | delegates to fees-report-proxy.ts (forwards x-laravel-token, no check) | none | client-controlled x-laravel-base-url |
| 28 | GET | `/api/fees/reports/fees-collection/create` | delegates to fees-report-proxy.ts (forwards x-laravel-token, no check) | none | client-controlled x-laravel-base-url |
| 29 | GET | `/api/fees/reports/fees-collection` | delegates to fees-report-proxy.ts (forwards x-laravel-token, no check) | none | client-controlled x-laravel-base-url |
| 30 | POST | `/api/fees/reports/fees-defaulter` | delegates to fees-report-proxy.ts (forwards x-laravel-token, no check) | none | client-controlled x-laravel-base-url |
| 31 | POST | `/api/fees/reports/fees-structure` | delegates to fees-report-proxy.ts (forwards x-laravel-token, no check) | none | client-controlled x-laravel-base-url |
| 32 | GET | `/api/fees/reports/fees-type-wise/create` | delegates to fees-report-proxy.ts (forwards x-laravel-token, no check) | none | client-controlled x-laravel-base-url |
| 33 | GET | `/api/fees/reports/other-fees-cancel/create` | delegates to fees-report-proxy.ts (forwards x-laravel-token, no check) | none | client-controlled x-laravel-base-url |
| 34 | GET | `/api/fees/reports/other-fees-cancel` | delegates to fees-report-proxy.ts (forwards x-laravel-token, no check) | none | client-controlled x-laravel-base-url |
| 35 | GET | `/api/fees/reports/other-fees/create` | delegates to fees-report-proxy.ts (forwards x-laravel-token, no check) | none | client-controlled x-laravel-base-url |
| 36 | GET | `/api/fees/reports/other-fees/ledger` | delegates to fees-report-proxy.ts (forwards x-laravel-token, no check) | none | client-controlled x-laravel-base-url |
| 37 | GET | `/api/fees/reports/other-fees` | delegates to fees-report-proxy.ts (forwards x-laravel-token, no check) | none | client-controlled x-laravel-base-url |
| 38 | GET | `/api/fees/reports/student-breakoff/create` | delegates to fees-report-proxy.ts (forwards x-laravel-token, no check) | none | client-controlled x-laravel-base-url |
| 39 | GET | `/api/fees/reports/student-breakoff` | delegates to fees-report-proxy.ts (forwards x-laravel-token, no check) | none | client-controlled x-laravel-base-url |
| 40 | POST | `/api/forgot-password` | none | zod | client-controlled x-laravel-base-url |
| 41 | POST | `/api/google-auth` | none | zod | client-controlled x-laravel-base-url |
| 42 | POST | `/api/hostel/dashboard/summary` | forwards token only (no check) | zod | client-controlled x-laravel-base-url |
| 43 | POST | `/api/import/match-fields` | none | none |  |
| 44 | POST | `/api/import/parse` | forwards token only (no check) | none |  |
| 45 | POST | `/api/import/process` | forwards token only (no check) | none |  |
| 46 | GET | `/api/import/tables` | none | none |  |
| 47 | GET,PUT,DELETE | `/api/integration-configs/[id]` | 401 on missing token | none |  |
| 48 | GET,POST | `/api/integration-configs` | 401 on missing token | none |  |
| 49 | POST | `/api/integration-configs/test` | 401 on missing token | none |  |
| 50 | GET | `/api/library/books-list` | forwards token only (no check) | zod |  |
| 51 | POST | `/api/library/dashboard/summary` | forwards token only (no check) | zod | client-controlled x-laravel-base-url |
| 52 | GET | `/api/mcp/capabilities` | forwards token only (no check) | none |  |
| 53 | GET | `/api/mcp/health` | forwards token only (no check) | none |  |
| 54 | POST | `/api/mcp/tools/call` | forwards token only (no check) | ad-hoc |  |
| 55 | GET | `/api/modules/menu-categories/registry` | delegates to laravel-category-proxy.ts (forwards x-laravel-token, no check) | none | client-controlled x-laravel-base-url |
| 56 | GET | `/api/modules/menu-categories` | delegates to laravel-category-proxy.ts (forwards x-laravel-token, no check) | none | client-controlled x-laravel-base-url |
| 57 | GET | `/api/pal/content-model` | none | none |  |
| 58 | GET | `/api/pal/pedagogy-engine` | none | none |  |
| 59 | POST | `/api/pal/submit` | forwards token only (no check) | zod | client-controlled x-laravel-base-url |
| 60 | POST | `/api/process/convert` | none | zod | spends server LLM credentials, anonymous |
| 61 | POST | `/api/proxy-file` | forwards token only (no check) | ad-hoc | generic relay |
| 62 | GET,POST,PUT,PATCH,DELETE | `/api/proxy` | forwards token only (no check) | zod | generic relay |
| 63 | GET | `/api/question-paper/asset` | forwards token only (no check) | ad-hoc |  |
| 64 | POST | `/api/screenCandidate` | forwards token only (no check) | zod | spends server LLM credentials, anonymous |
| 65 | POST | `/api/students/dashboard/summary` | forwards token only (no check) | zod | client-controlled x-laravel-base-url |
| 66 | GET | `/api/teach-learn/menu-categories` | forwards token only (no check) | zod | client-controlled x-laravel-base-url |
| 67 | POST | `/api/transportation/dashboard/summary` | forwards token only (no check) | zod | client-controlled x-laravel-base-url |

Callers per handler and the 7 zero-caller handlers: data-api-calls section 1.

## 6. Business-logic notes (key flows relevant to this part)

**Sidebar/menu -> page (DB-driven navigation).** Input: login payload (`menu` rows from tblmenumaster: `link` = Laravel route name or path). Validation: `isValidNavigationLink` rejects `javascript:void(0)`/`#`. Rule: `mapApiLinkToRoute(link)` (app/data/routeMapper.ts:634-1160) applies 17 module-specific alias maps, then a late override map for `result/*`, then defaults to `"/" + link` unchanged. DB change: none. Side effect: none. Output: a URL passed to Next router; if the resulting path has no page.tsx the user lands on not-found.tsx. Consequence: correctness depends entirely on production `tblmenumaster.link` values matching frontend folder names; 36 route-name keys and 17 seeded links do not (data-links sections 2-3), and case-sensitive folders (Inventory, Transportation, Utility) are reached through explicit maps.

**Category tabs (module level-3 pages).** `app/modules/[moduleKey]/[categoryKey]` fetches categories from Laravel (`/api/modules/menu-categories`) and mounts a screen inline via `getModuleScreenRegistry` -> `GENERATED_MODULE_SCREENS` (517 lazily imported pages, keys lower-cased). A menu route absent from the registry is "not embeddable" and falls back to navigation. The registry is generated by scripts/generate-module-screens.mts and committed; nothing verifies it is in sync with app/ (676 pages vs 517 entries; 52 registry-reachable pages have no code reference).

**Generic proxy.** Browser -> `/api/proxy?path=<laravel path>&<query>` -> `fetch(API_BASE_URL/<path>)` with the caller's Authorization and Cookie -> JSON re-serialised; non-JSON replies wrapped as `{raw}`. Any Laravel route reachable this way inherits Laravel's own auth; the relay adds none and validates nothing.

**Legacy-envelope handling** (lib/erp-legacy.ts:legacyRequest): request `type=API` + tenant params; success test `status` not in ["0","2"]; error text from `errors[]`/`message`; 419 gets a CSRF hint. Other modules re-implement this per file (data-consistency section 7).

## 7. Test / documentation coverage for this scope

- Tests: 42 test files, all under lib/ (`npm test` globs lib/** and packages/** only). Navigation-related: lib/brain/navigation.test.ts, module-navigation.test.ts, intelligence-navigation.test.ts (registry <-> route consistency for the Brain/Intelligence modules only). **No test covers**: routeMapper.ts (menu link -> route), the generated screen registry, the route inventory, the 67 Next handlers, `/api/proxy`, session reading (buildSessionContext), or frontend-to-Laravel path contracts. The 36 broken mapper keys and the missing/mismatched backend routes (ORPH-06/07/11/12/13) would have been caught by a 30-line contract test.
- CI: `.github/workflows/` empty (per brief); scripts/generate-module-screens.mts and scripts/check-agent-catalogue.ts are manual-only.
- Docs: docs/menu-data-source-audit.md (static vs API data per menu, 2026-08-22) and docs/student-menu-report.md exist; no route/API contract document; `app/reports/broken-link-finder` is a Laravel-backed report (`MigrationModulePage module="broken-links"`), not a frontend link checker.

## 8. NOT VERIFIED items

| # | Item | Reason |
|---|---|---|
| 1 | Production tblmenumaster.link values | no DB access; only 80 seeded links in migrations were evaluated. Whether the 36 Result route-name keys and "54 seeded menus with nothing behind them" (source comment) occur in production is unknown. |
| 2 | LMS_API_AUTH_ENFORCE value in production | .env not readable; default in config/lms_content.php:144 is false so 18 SOFT routes are fail-open by default. |
| 3 | Which of the 135 "no route middleware, controller has token text" routes validate the token on every action | only class-level presence of JwtToken/Authorization text was tested; per-action check not read (e.g. ComplaintApiController.php:48, UserManagementApiController.php:20 validate; other controllers only mention it). |
| 4 | 28 dynamic / unknown-prefix Laravel path templates (`${path}`, `${module}${suffix}`, `${endpoint}`...) | built at runtime; listed in data-api-calls section 4. Literal callers in the same file/wrapper are verified individually. |
| 5 | Calls through unrecognised wrappers with slash-less legacy paths (e.g. hostel/api.ts `/api/proxy?path=hostel_master`) | no literal beginning with "/" or "api/" to match; modules with 0 detected calls in the module table are therefore "not detected", not "no calls". |
| 6 | HTTP method correctness | verified for 155 direct fetch() calls with literal option objects only; 9 apparent POST->PUT mismatches are almost certainly `_method` spoofing on resource routes. |
| 7 | Laravel routes generated at runtime by routes/custom_module.php (DB table custom_module_tables) | requires DB; 25 statically recorded. |
| 8 | Orphan pages that a production DB menu row points at | menus are DB-driven; "orphan" here means no reference in code/registries/mapper/rewrite. |
| 9 | Case-sensitive hosting behaviour on the real deployment | no deployment config in the repo (no Dockerfile/vercel.json); analysis is of route folder names and lookups only. |
| 10 | Behaviour of the 249 unauthenticated routes beyond sampled controllers | sampled 10 (FeesDashboard family, AdmissionsDashboard, StudentHomework, ApiQuestionPaper::destroy, ApiLmsCourse::deleteQuestionBank, AJAXController::lmsDataApi, cbse_1t5::save_result_html, PermissionsController, MenuRights, ComplaintApi); the rest classified by middleware + token-text only. |
| 11 | Whether Laravel `web`-group routes called with type=API (e.g. student.php `/student/api/*`) hydrate identity elsewhere | they carry no `session` middleware at route level; SessionMiddleware would hydrate from JWT for type=API, but these routes are not wrapped by it. |

## 9. Second-pass results (grep counts for this scope; app source excluding tests, K-12, g2g, tool folders)

| Pattern | Occurrences | Files | Material hits |
|---|---|---|---|
| TODO/FIXME/HACK/XXX | 2 | 2 | app/course-master/data/chapters.ts, lib/event-bus/sources.ts |
| console.log | 45 | 17 | scripts/check-agent-catalogue.ts (10), lesson-plan/[courseId]/page.tsx (8), fees other-fees-title, hrit attendance-reports, monthwise_student_attendance |
| console.warn/error/debug/info | 102 | 47 |  |
| debugger | 0 | 0 | none |
| dangerouslySetInnerHTML | 65 | 35 | app/pal/eso/page.tsx (15), h5p_mcq (5), scenario_based/[id] (3), pal/_components/* - sanitisation not assessed in this part |
| eval( / new Function | 0 | 0 | none |
| fetch( | 555 | 263 | 555 call sites parsed; 264 files; 130 through /api/proxy |
| axios | 2 | 2 | 2 mentions (no axios dependency in package.json) |
| 'XMLHttpRequest' string | 86 | 64 | all are the `X-Requested-With: XMLHttpRequest` header; no XHR objects |
| window.location.href=/assign/replace | 1 | 1 | contexts/AuthContext.tsx only (1) - navigation otherwise via next/navigation |
| window.open | 40 | 32 |  |
| mock/dummy/hard-coded data markers | 60 | 49 | pal/new/content-model, module-category-page (comments) |
| `return []` | 246 | 125 |  |
| empty `catch {}` | 17 | 10 | contexts/AuthContext.tsx (5), Level3Subheader (2), Sidebar (2), fees/collect (2), Header (1) |
| empty arrow handlers `() => {}` | 24 | 14 |  |
| @ts-ignore / @ts-expect-error / eslint-disable | 309 | 210 | components/domain/lms/administration-governance/use-administration-governance.ts (19) |
| `: any` / `as any` | 245 | 42 | components/document-template/editor/LayersPanel.tsx (29), mobility-center.tsx (21), TableBlock.tsx (21) |
| hard-coded email addresses | 13 | 7 | app/organization_managment/oragnization_profile/page.tsx (info@abctech.com, contact@gapstogrowth*.com ... = static mock company data) |
| hard-coded sub_institute_id / syear literals | 2 | 2 | sideDrawer.tsx:866 `let sub_institute_id = 0;` (initialiser), a hint string |
| `localStorage/sessionStorage` reads / writes / removes | 191+11 / 16+3 / 13 | 85 / 9 / 5 | userData 68 uses in 53 files; JWT inside; see data-consistency section 6 |
| hard-coded absolute URLs (non-test) | see data-api-calls section 6 | | n8n webhooks (ORPH-14), http:// apps.triz.co.in links, vercel.app ontology iframe |
| role/tenant/user key spellings | see data-consistency sections 1-4 | | |

## 10. ISSUES

## ORPH-01
**Severity:** Critical   **Type:** Confirmed
**Category:** Security
**Module:** Platform / HRIT payroll / Talent recruitment / Task management / Laravel AJAXController
**Location:** D:\next_lms_erp\routes\web.php:638-639; D:\next_lms_erp\app\Http\Controllers\AJAXController.php:2985-3070; frontend app/hrit/_lib/payroll-api.ts:911, app/talent-management/recruitment/components/job-posting-form.tsx:130,159,196, app/task-management/_lib/my-tasks-api.ts:346,380
**Function/Method:** AJAXController::lmsDataApi (routes `lms_data`, `table_data`)
**Problem:** Two public GET routes return the contents of ANY database table with caller-chosen filters, ordering and grouping, and can enumerate all tables. The frontend depends on it (including for `tbluser`).
**Evidence:** `Route::get('table_data',[AJAXController::class,'lmsDataApi'])` sits after the auth group, middleware = [web]. Handler: `if($request->all_tables==1) return SHOW TABLES` (2987-2993); `$table=$request->table; if(!Schema::hasTable($table))...; DB::table($table)` + `filters[col]=val`, `multiple[col]`, `order_by`, `group_by` then `return response()->json($query->get())` (3013-3070). No blacklist, no tenant scoping. Frontend: `/table_data?table=tbluser&token=..&filters[sub_institute_id]=..` (payroll-api.ts:911-915).
**Impact:** Any internet client can dump tbluser (staff records, emails, likely credential columns per the ERP auth model), student, fee and payment tables for every school; the tenant filter is client supplied.
**Expected Behavior:** Table data endpoints must require a verified token, use an allow-list of tables/columns, derive the tenant from claims.
**Recommended Fix:** Immediately put both routes behind api.session (and staff.only), replace with purpose-built endpoints (departments, job roles, employees) that scope by JWT tenant, delete the `all_tables` and generic `table` modes, and rotate any credentials stored in exposed tables. Update the 3 frontend callers.
**Verification:** GET <host>/table_data?all_tables=1 with no Authorization header on a non-production copy; expect 401 after the fix. Grep frontend for `table_data`/`lms_data`.

## ORPH-02
**Severity:** Critical   **Type:** Confirmed
**Category:** Authorization
**Module:** LMS, Admissions, Admin-services, PAL, Student, Course-master (Laravel routes/api.php, web.php, student.php, lms.php, adminapi.php, pal_api.php)
**Location:** D:\next_lms_erp\routes\api.php:140-144, 186-187, 217-228, 233-235, 264-270, 274-286, 326-338, 425-428, 442-452, 459-460, 496-501, 528-541, 570-598, 660-661, 674-676; routes\web.php:109-140, 497-498 (forgot-password: public by design), 660; routes\student.php:267-283; routes\lms.php:394,555; routes\pal_api.php:32 (public by design)
**Function/Method:** route registration + ApiLmsCourseController, LmsAssignmentApiController, StudentHomeworkApiController, ApiQuestionPaperController, QuestionPaperTemplateApiController, admissionEnquiry/RegistrationAPIController, AiSopGenerationController, *DashboardApiController, Student*IcardApiController ...
**Problem:** 249 Laravel routes that the frontend calls have no authenticating middleware; for 114 of them the controller contains no token/Authorization/session-hydration code either. Tenant and user identity are read from request input, and several are destructive.
**Evidence:** Routes carry only `api` (or `web`) middleware. ApiQuestionPaperController::destroy: `questionpaperModel::where(["id"=>$id])->delete()` - no auth, no tenant check (api.php:460 apiResource; ApiQuestionPaperController.php:347-349). ApiLmsCourseController::deleteQuestionBank: tenant = `sub_institute_id` from request body (2525-2544). AdmissionsDashboardApiController: `sub_institute_id` = validated request field, queries admission_enquiry for that tenant. Contrast api.php:133 `Route::middleware(['api.session','check_permissions'])->post('fees-dashboard/summary'...)` (protected) vs api.php:140-144 the five sibling dashboards with no middleware. Full list with controller and call site: data-api-calls section 5 (114 rows flagged "no token text").
**Impact:** Anonymous read of homework, assignments, admissions enquiries/registrations (PII of minors and parents), student ID-card/certificate generation, question banks; anonymous create/update/delete (question papers, question bank, homework/assignment records, SOP generation spending LLM credits); tenant isolation defeated by changing sub_institute_id.
**Expected Behavior:** Every route the Next app calls must run `api.session` (or an equivalent JWT check) and derive tenant/user from the token; client-sent sub_institute_id/user_id must be ignored or cross-checked.
**Recommended Fix:** Wrap api.php lines 140-144, 217-338, 425-501, 570-598, 660-676, 901, web.php lms/*, student.php student/api/*, adminapi.php in `['api.session']` (+ staff.only/perm where role-limited); add a route-lint test that fails when a route called by the frontend has no auth middleware; move the 135 in-controller checks to middleware.
**Verification:** For each listed URI send a request without Authorization; expect 401. Run the generated route table (this part's scripts) against a CI assertion "no NONE-class route is referenced by app/**".

## ORPH-03
**Severity:** Critical   **Type:** Confirmed
**Category:** Security
**Module:** Result module / Laravel
**Location:** D:\next_lms_erp\routes\result.php:212-213; D:\next_lms_erp\app\Http\Controllers\result\cbse_result\cbse_1t5_result_controller.php:721-757
**Function/Method:** cbse_1t5_result_controller::save_result_html
**Problem:** Unauthenticated POST routes write result HTML per student and build SQL by string concatenation of request parameters (SQL injection).
**Evidence:** `Route::post('save_result_html',...)` and `save_result_html_new` are outside every `session` group (result.php:212-213). Controller: `$student_array = explode(",", $request->get('student_arr'))` then `DB::select("SELECT * FROM result_html WHERE student_id = '".$val."' AND term_id = '".$request->get('term_id')."' AND grade_id = '".$request->get('grade_id')."' ... AND syear = '".$request->get('syear')."'")` (743-747); writes `result_html` via insert/update (753-756).
**Impact:** Anyone can inject SQL through student_arr/term_id/grade_id/standard_id/division_id/syear (read or, with stacked/subquery payloads, modify data) and overwrite stored report-card HTML. The frontend cannot reach it correctly today (path mismatch, ORPH-07) but the public route exists.
**Expected Behavior:** Authenticated route, parameter binding, tenant from token.
**Recommended Fix:** Wrap in `session` + `check_permissions` like the other result routes, replace concatenation with bindings, and align frontend path (ORPH-07).
**Verification:** POST /save_result_html with student_arr="1' OR '1'='1" on a test DB; confirm 401 and no injection after the fix.

## ORPH-04
**Severity:** High   **Type:** Confirmed
**Category:** Authorization
**Module:** Laravel LMS/PAL/platform APIs (lms.auth, perm:*, lms.staff)
**Location:** D:\next_lms_erp\app\Http\Middleware\LmsApiAuth.php:26-37; RequirePermission.php:21-35; RequireLmsStaff.php; config\lms_content.php:144; routes\api.php:194,239,251-252,697-712; routes\platform.php:47-83
**Function/Method:** LmsApiAuth::handle, RequirePermission::handle
**Problem:** 18 routes the frontend calls (GET /api/permissions, content upload/authoring, coherence-map read/write, platform registry/notifications/scheduler/workflow) are guarded only by fail-open middleware.
**Evidence:** `if ($auth === null) { if (! config('lms_content.api_auth_enforce', false)) { ... return $next($request); } 401 }` (LmsApiAuth) and RequirePermission "unverified identity, check skipped" when not enforcing; `env('LMS_API_AUTH_ENFORCE', false)`.
**Impact:** Unless the env flag is set true in production (NOT VERIFIED), these "protected" routes accept anonymous callers and `perm:` role checks are skipped; `GET /api/permissions`, which the frontend and Next agents use as their authorizer, answers "unauthenticated" instead of denying.
**Expected Behavior:** Fail-closed: a missing/invalid token must 401 regardless of rollout flags.
**Recommended Fix:** Set LMS_API_AUTH_ENFORCE=true (verify in prod env), then remove the fail-open branch; keep the warn-only log as a temporary metric.
**Verification:** Call GET /api/lms/content/authoring-vocabulary anonymously in each environment.

## ORPH-05
**Severity:** High   **Type:** Confirmed
**Category:** Security
**Module:** Next route handlers (19) + lib/agents + lib/laravel-category-proxy
**Location:** app/api/admissions/dashboard/summary/route.ts:55; app/api/dashboard/{admin,student,teacher,teacher-fee-dues,teacher-icard,teacher-timetable}/route.ts:42; app/api/fees/dashboard/summary/route.ts:58; app/api/fees/menu-categories/route.ts:44; app/api/fees/reports/_lib/fees-report-proxy.ts:31; app/api/forgot-password/route.ts:42; app/api/google-auth/route.ts:38; app/api/hostel|library|students|transportation/dashboard/summary/route.ts; app/api/pal/submit/route.ts:21; app/api/teach-learn/menu-categories/route.ts:45; lib/laravel-category-proxy.ts:55; lib/agents/acting-user.ts:27
**Function/Method:** POST/GET handlers reading `x-laravel-base-url`
**Problem:** The server-side upstream base URL is taken from a request header with no allow-list (SSRF), and identity for /api/agents/* is taken from `x-sub-institute-id`, `x-user-id`, `x-user-profile-name`.
**Evidence:** `const baseUrl = readHeader(request, 'x-laravel-base-url') || getDefaultBaseUrl(); ... await fetch(`${baseUrl}${LARAVEL_PATH}`, { headers: {..., Cookie, x-laravel-token ...}})` (forgot-password/route.ts:42,88). Response JSON/HTML summary is returned to the caller.
**Impact:** Anyone who can reach the Next server can make it issue POST/GET requests to arbitrary internal or external hosts (cloud metadata, admin panels, other tenants' ERP hosts) and read back the JSON or the first 500 characters of an HTML reply; the same handlers forward the caller-supplied Cookie/token header to that host. /api/agents and /api/conversational-ai accept any tenant/user/profile the caller names.
**Expected Behavior:** Upstream must come from server config only; identity must come from a verified token.
**Recommended Fix:** Delete the header override (use API_BASE_URL/NEXT_PUBLIC_API_BASE_URL_* only) or validate against an allow-list; validate the JWT (or call Laravel `own-profile`) before building the acting user.
**Verification:** curl -H "x-laravel-base-url: http://127.0.0.1:1" .../api/forgot-password and observe an upstream connection error in the response.

## ORPH-06
**Severity:** High   **Type:** Confirmed
**Category:** Backend
**Module:** Login (Google sign-in)
**Location:** app/api/google-auth/route.ts:16,76; app/login/page.tsx:41; D:\next_lms_erp\routes\* (no match)
**Function/Method:** POST handler `LARAVEL_PATH = '/api/google-auth'`
**Problem:** The Google login proxy posts to `POST /api/google-auth`, which does not exist in any of the 42 Laravel route files.
**Evidence:** `const LARAVEL_PATH = '/api/google-auth'; ... fetch(`${baseUrl}${LARAVEL_PATH}`, { method:'POST', body: JSON.stringify({credential: token, id_token: token, type:'API'}) })`; grep of routes/*.php for "google" finds only `google-analytics-summary`.
**Impact:** Google sign-in cannot succeed; users see a proxy error.
**Expected Behavior:** Backend route + controller verifying the Google ID token (audience, hd) and issuing the ERP JWT.
**Recommended Fix:** Either implement the Laravel endpoint or remove the button; add the contract test from section 7.
**Verification:** POST /api/google-auth against Laravel returns 404 today.

## ORPH-07
**Severity:** High   **Type:** Confirmed
**Category:** Backend
**Module:** Result (report card, marks approval)
**Location:** app/result/reports/marks-approval/page.tsx:137; app/result/report-card/cbse-1t5/page.tsx:221; app/result/report-card/cbse-t2/page.tsx:186; app/result/reports/wrt/page.tsx:104; app/result/reports/wrt-progress/page.tsx:137; Laravel routes/result.php:111,212
**Function/Method:** resultPost('result/getMarksApproval'), resultPost('result/save_result_html')
**Problem:** Frontend paths do not match registered Laravel routes.
**Evidence:** Frontend: `resultPost('result/getMarksApproval', flat)`; Laravel: `Route::post('marks_entry/getMarksApproval')` inside prefix `result` = `/result/marks_entry/getMarksApproval` (result.php:111). Frontend: `result/save_result_html` (4 sites); Laravel: `POST /save_result_html` (no prefix, result.php:212).
**Impact:** Marks-approval report never loads; "save result HTML" for CBSE 1-5, T2, WRT and WRT-progress report cards returns 404 (caught silently or shown as error).
**Expected Behavior:** Frontend and backend paths agree.
**Recommended Fix:** Change frontend to `result/marks_entry/getMarksApproval` and `save_result_html` (or add aliases in Laravel), and protect the latter (ORPH-03).
**Verification:** Open each report page and watch the network tab; expect 200 after the fix.

## ORPH-08
**Severity:** Medium   **Type:** Confirmed
**Category:** Security
**Module:** All modules (Result, Fees, HRIT, Capability, Talent, Organization, LMS/G2G services, Task, Students)
**Location:** lib/result/api.ts:68,113,150; app/fees/_lib/fees-api.ts:192,204; app/hrit/_lib/{attendance,leave,payroll}-api.ts:90,78,93,561,898,913; app/capability-intelligence/_lib/*-api.ts (command-center:112, competency-extras:96, competency-library:124, framework-studio:103, libraries-taxonomy:116); components/domain/organization/department-management/organization-service.ts (7 sites `?token=${session.token}`); 50 files in total (data-consistency section 5)
**Function/Method:** resultGet/resultPost, contextParams(), fees/hrit/talent/organization request helpers
**Problem:** The JWT is duplicated as a `token` parameter (query string for GETs and many POSTs, form body elsewhere) on 75 sites in 50 files, in addition to the Authorization header.
**Evidence:** `...(session.token ? { token: session.token } : {})` in the GET query (lib/result/api.ts:68) and POST query (:150); `append('token', session.token)` in the body (:113) next to `Authorization: Bearer` (:72,118); `` `/departments-management/${id}/merge?token=${session.token}&sub_institute_id=... ` `` (organization-service.ts:264); `/table_data?...token: session.token` (payroll-api.ts:911-913).
**Impact:** Bearer tokens land in browser history, reverse-proxy/CDN/Laravel access logs, Referer headers and monitoring tools; a token in a URL is copy-pasted and shared far more easily than a header.
**Expected Behavior:** Bearer header only; no credential in URLs. NOTE: some Laravel modules REQUIRE the parameter today (api/Leave/Concerns/ResolvesLeaveContext.php:29-33 returns 401 "Token not provided" when `token` is absent from the input), so the fix is backend + frontend together.
**Recommended Fix:** Remove the `token` parameter from all clients (Laravel already reads Authorization through GetsJwtToken); first grep Laravel controllers for `$request->token` / `input('token')` to see which legacy actions still need it.
**Verification:** Search access logs for "token=" after the change; grep frontend for `token: session.token`.

## ORPH-09
**Severity:** High   **Type:** Potential
**Category:** Frontend
**Module:** Sidebar / menu mapper (Result, HRIT, AI admin)
**Location:** app/data/routeMapper.ts:41-100 (RESULT_ROUTE_NAME_MAP), :634-1160 mapApiLinkToRoute; database\migrations (menu seeds)
**Function/Method:** mapApiLinkToRoute
**Problem:** 36 route-name keys (e.g. `marks_entry.index`, `wrt_report.index`, `cbse_result.index`) map to `/result/<underscore_name>` paths that do not exist (pages are hyphenated); 17 of 80 migration-seeded menu links (`ai_admin.*` x7, hrit_*.index, hrms_*.index, payroll_*.index, form16.index) resolve to no page.
**Evidence:** Executed `mapApiLinkToRoute` over 570 keys: `marks_entry.index` -> `/result/marks_entry` (page is `/result/marks-entry`). Full table: data-links sections 2-3. app/lib/routes.ts additionally lists 31 dead result paths.
**Impact:** If tblmenumaster stores route names (legacy convention, `check_permissions` matches `link` against route names) the Result menu items open the 404 page. Depends on production data - NOT VERIFIED.
**Expected Behavior:** Every emitted route resolves to a page or the item is hidden.
**Recommended Fix:** Fix the early maps to the hyphenated pages (or make the late override handle `*.index`), map ai_admin.*/hrit_*/hrms_* seeds, delete the dead ROUTES.result block, and add a unit test that evaluates the mapper over all keys against a page inventory.
**Verification:** Re-run part09 scripts/evalmap and assert 0 unresolved.

## ORPH-10
**Severity:** Medium   **Type:** Confirmed
**Category:** Frontend
**Module:** Admin dashboard, HRIT leave, Talent management
**Location:** app/dashboard/AdminDashboard.tsx:107-109; app/hrit/leave-management/leave-dashboard/page.tsx:203; app/talent-management/recruitment/components/recruitment-center.tsx:1019; app/talent-management/onboarding/components/onboarding-center.tsx:1118; app/talent-management/recruitment/components/job-posting-form.tsx:307
**Function/Method:** QuickActionLink, router.push
**Problem:** 7 in-app navigations target routes that have no page.
**Evidence:** `href="/fees"`, `"/reports"`, `"/settings"` (no root page.tsx in those folders); `router.push(`/module/hrit-solutions/leave-management/${submenu}`)` and `/module/talent-management/onboarding/onboarding` (no `/module` route - the dynamic route is `/modules/[moduleKey]/[categoryKey]`); `router.push('/hrit')` (only layout.tsx); `router.push('/content/Jobrole-library')` (no /content).
**Impact:** Dashboard quick actions "Collect fee", "View reports", "Manage settings", HRIT leave sub-navigation, "Start onboarding", "View employee" and "Add New Job Role" land on the 404 page.
**Expected Behavior:** All navigations resolve.
**Recommended Fix:** Point to existing pages (/fees/collect, /reports/students-marks or a new index, /settings/biomatrix ...) and fix the /module -> /modules prefix; add a link-resolution unit test.
**Verification:** Click each control; part09 link resolver returns 0 unresolved strong links.

## ORPH-11
**Severity:** High   **Type:** Confirmed
**Category:** Backend
**Module:** G2G Assessments / Learning dashboard, Talent development, Capability intelligence, Department management
**Location:** components/domain/lms/assessments/assessments-service.ts:143-337 (21 paths) vs D:\next_lms_erp\routes\g2g_lms.php:263-291; components/domain/lms/dashboard/dashboard-service.ts:380-398 vs g2g_lms.php:45; app/talent-management/_lib/development-career-api.ts:653-683; employee-profiles-api.ts:340; administration-api.ts:105; app/capability-intelligence/_lib/competency-extras-api.ts:206,272-286; components/domain/organization/department-management/organization-service.ts:264,284 vs routes/api.php:733-742
**Function/Method:** lmsAssessmentsService.*, unenroll/updateEnrollment, developmentCareerService.*learning, requestReassessment, getWorkflowById, skillDetailService.get, courseBuilderService.*, mergeDepartment/setDepartmentParent
**Problem:** 35 frontend endpoints have no matching Laravel route: the whole G2G Assessments API is called under different names than the ones registered; several other ported screens call routes that were never ported (the source itself carries "GAP" comments).
**Evidence:** G2G: Laravel registers `assessments/assessment-cycles/*` and `assessments/ai-assessment/*`; the service calls `/cycles/*`, `/tests`, `/attempts`, `/proposals`, `/mine`, `/submit`, `/start`, `/my-result` (and attempts/proposals/start/mark/assign have no route at all). `DELETE|PUT learning-dashboard/enroll/{id}`: only `POST enroll` exists (dashboard-service.ts:23 "NOT in the given contract table"). No `/api/competency/learning-assignments*` (3 paths / 5 call sites), `/api/competency/assessments`, `/api/lms/ai/*` (4; "GAP: /lms/ai/* not given" competency-extras-api.ts:214), `/api/skill_library/{id}/edit` ("GAP" :203), `/api/departments-management/{id}/merge|parent` (Laravel: `/merge`, `/{id}/head`), `/api/talent/admin/workflows/{id}` (index only). 19 "GAP" comments in the frontend document part of this.
**Impact:** Assessment workspace (review cycles, tests, attempts, proposals, my results), unenrol/move enrolment, learning assignments, reassessment requests, AI course builder, merge/re-parent department, workflow detail return 404/405; screens show errors or empty states.
**Expected Behavior:** Frontend paths equal registered Laravel paths (contract-tested).
**Recommended Fix:** Align path names (rename Laravel routes or change assessments-service.ts base segments), implement or remove the missing actions, and add the route-contract test from section 7. Full list of the 47 unmatched paths with per-path assessment: data-api-calls section 3.
**Verification:** Run the part09 resolver: unmatched list is empty except external/constant false positives.

## ORPH-12
**Severity:** Medium   **Type:** Missing
**Category:** Backend
**Module:** PAL intervention queue
**Location:** app/pal/data/pal-intervention.ts:507-595; Laravel routes (grep "intervention" = 0 matches)
**Function/Method:** fetchInterventions, openIntervention, closeIntervention
**Problem:** GET/POST `/api/pal/intervention` and `/{id}`, `/{id}/close` have no backend; the client silently degrades.
**Evidence:** "Returns null when the route is not deployed. A null is 'not written'" (pal-intervention.ts:523-527); pal_api.php/pal_eso_api.php contain no intervention route.
**Impact:** Teacher intervention workflow is UI-only; "open case" never persists.
**Expected Behavior:** Backend routes exist or the UI is hidden.
**Recommended Fix:** Implement PALIntervention controller + table, or feature-flag the UI.
**Verification:** POST /api/pal/intervention returns 404 today.

## ORPH-13
**Severity:** Medium   **Type:** Confirmed
**Category:** Backend
**Module:** Task management (legacy + reports)
**Location:** app/task-management/_lib/my-tasks-api.ts:244,251,294; app/task-management/_lib/reports-api.ts:48; Laravel routes/frontdesk.php:25, task_management.php
**Function/Method:** updateLegacyTask, deleteLegacyTask, getRejectedTaskLearning
**Problem:** Legacy `/task/{id}` update/delete and `/api/user-rejected-tasks-courses` are not registered.
**Evidence:** Laravel only has `/frontdesk/task/{task}` and `/api/task-management/*`; no route matches `/task/{id}` or `user-rejected-tasks-courses`.
**Impact:** Editing/deleting legacy tasks and the "rejected task learning" report fail.
**Expected Behavior:** Endpoints exist.
**Recommended Fix:** Port routes or repoint to /api/task-management.
**Verification:** Call from UI, expect 200.

## ORPH-14
**Severity:** Medium   **Type:** Confirmed
**Category:** Security
**Module:** Talent recruitment / Task management
**Location:** app/talent-management/_lib/recruitment-api.ts:216; app/task-management/my-tasks/components/create-task-modal.tsx:379-392
**Function/Method:** recruitmentService (job posting webhook), sendAssignmentWebhook
**Problem:** Hard-coded third-party n8n webhook URLs (one a secret-style UUID path, one a `webhook-test` endpoint) receive job-posting data and task details from every user's browser.
**Evidence:** `fetch(`https://n8n.triz.co.in/ff44***?${params}`, {method:'GET'})` with jobPostingId, JD analysis, form fields in the query string; `fetch('https://n8n.triz.co.in/webhook-test/task-assigned', {method:'POST', body: JSON.stringify({task_title, task_description, assigned_users, department, kras, kpis, ...})})`.
**Impact:** The webhook URL is public in source and bundle, so anyone can post to it; task/job data leaves the school tenant boundary to a shared automation host; a `webhook-test` URL in production only works while someone listens in the n8n editor.
**Expected Behavior:** Server-side, configured, authenticated integration.
**Recommended Fix:** Move webhook URLs to server env and call via a Laravel/Next handler with signature; rotate the exposed UUID path.
**Verification:** grep bundle for n8n.triz.co.in.

## ORPH-15
**Severity:** Medium   **Type:** Architectural
**Category:** Backend
**Module:** Laravel auth model
**Location:** routes/api.php (whole file); app/Http/Middleware/{ApiSessionHydrator,SessionMiddleware,LmsApiAuth,PalApiAuth,McpAuth,Brain\BrainAuthenticate}.php; 30+ controllers using GetsJwtToken
**Function/Method:** middleware set
**Problem:** Six authentication mechanisms coexist (api.session, session, pal.auth, brain.auth, McpAuth, lms.auth soft) plus in-controller JWT validation and no auth at all; unifying rules are absent.
**Evidence:** Route classification of all 5,453 routes: AUTH 4,594, SOFT 28, NONE 831 (249 called by the frontend). 135 called `api`-group routes validate inside the controller (ComplaintApiController:48, UserManagementApiController:20, PettyCashApiController:44, InventoryApiController:57 ...).
**Impact:** Each new route can silently ship unauthenticated; security review requires reading controllers.
**Expected Behavior:** One default-deny middleware group for /api.
**Recommended Fix:** Make `api.session` the default of the `api` group and opt-out explicitly for the ~10 public endpoints (login, academic-terms, forgot-password, certificate verify, pedagogy public).
**Verification:** Route lint in CI.

## ORPH-16
**Severity:** Medium   **Type:** Architectural
**Category:** Frontend
**Module:** Session/identity handling across modules
**Location:** lib/erp-client.ts:63-140; 60 reader functions listed in part09-data-consistency.md 6c; 53 files reading localStorage userData; contexts/AuthContext.tsx:187-209
**Function/Method:** buildSessionContext and getXSession variants
**Problem:** Identity/tenant/year/role are read through 60 independent session readers (46 names) plus the shared buildSessionContext; the whole login payload incl. JWT is kept in localStorage; readers probe key names nobody writes.
**Evidence:** userData read directly in 53 files; buildSessionContext in 232; probes of `sessionData/sessiondata/user_data/session/academicSession/academicData` never written (AuthContext writes auth, menuContext, userData, sessionDate only); year precedence differs (erp-client active-term vs `selectedAcademicYear ?? userData.syear`).
**Impact:** Bug fixes in one reader do not reach the others; XSS anywhere exposes a full-privilege JWT for the session; inconsistent academic year between modules.
**Expected Behavior:** One session provider; HttpOnly cookie or memory token.
**Recommended Fix:** Route all readers through buildSessionContext/AuthContext, drop dead key probes, consider moving the token to an HttpOnly cookie via a Next route handler.
**Verification:** grep for `getItem('userData')` outside lib/erp-client.ts returns 0.

## ORPH-17
**Severity:** Low   **Type:** Confirmed
**Category:** Frontend
**Module:** Routing structure
**Location:** app/hostel/* (12 pairs); app/organization-management vs app/organization_managment; app/student vs app/students; app/sqaa*, app/pal/framework(s); 80 orphan pages (data-links section 7)
**Function/Method:** route tree
**Problem:** 12 identical hyphen/underscore hostel page twins, misspelt duplicate module folders, exam/result twin screens and 80 pages with no reference.
**Evidence:** e.g. app/hostel/building-master/page.tsx and building_master/page.tsx are byte-identical 5-line files; `organization_managment/oragnization_profile`; 20 of 23 Inventory pages and 8 of 12 students pages are orphans.
**Impact:** Maintenance drag and inconsistent deep links; ~80 pages cannot be reached from any code path.
**Expected Behavior:** One canonical route per screen.
**Recommended Fix:** Pick kebab-case, delete twins, redirect old paths in next.config.ts, remove or link orphans.
**Verification:** part09 link resolver shows 0 orphans/duplicates.

## ORPH-18
**Severity:** Low   **Type:** Confirmed
**Category:** Frontend
**Module:** Dead code and repo hygiene
**Location:** part09-data-dead-code.md (62 files); K-12 ERP Design System/** (299 files, tsconfig include **/*.ts); public/ (32 unused assets); app/api/import/*, dashboard/admin, mcp/{capabilities,health} (7 handlers)
**Function/Method:** import graph
**Problem:** 62 dead files, 1,723 never-imported exports, a 299-file design-system folder type-checked by `tsc`, 32 unused public assets, 7 Next handlers with no caller.
**Evidence:** services/g2g-lms.ts, services/organization.ts, lib/gtg-org-data.ts, app/course-master/page.redesign.tmp.tsx are unreachable; app/import-data/page.tsx calls `${API_BASE_URL}/api/import/*` directly so app/api/import/* never runs; admin dashboard calls Laravel directly while 5 sibling dashboards use the Next proxy.
**Impact:** Slower typecheck/lint, confusion about which code path is live, dead proxy handlers that still expose unauthenticated relays.
**Expected Behavior:** No unreferenced code in the shipping tree.
**Recommended Fix:** Delete dead files/handlers, exclude K-12 ERP Design System from tsconfig/eslint or move it out, remove unused assets.
**Verification:** ts-prune / part09 graph shows 0 dead.

## ORPH-19
**Severity:** Low   **Type:** Potential
**Category:** Frontend
**Module:** Case-sensitive deployment
**Location:** app/Inventory, app/Transportation, app/Utility, app/admission-Enquiry, app/lms/lmsAssignment*, app/fees/NACH_*; app/_lib/module-screens.generated.ts (lower-case keys); next.config.ts:53-56
**Function/Method:** route folders / registry keys
**Problem:** 62 routes contain upper-case path segments; module registry keys are lower-cased while real folders are not.
**Evidence:** `'/inventory/generate_po': screen(() => import('@/app/Inventory/generate_po/page'))`. Imports are case-correct (0 mismatches), so the build is safe; a link or DB menu row using the lower-case form would 404 on Linux/Vercel.
**Impact:** Works on Windows dev, breaks on case-sensitive hosts if any lower-case URL is emitted.
**Expected Behavior:** All URLs lower-case.
**Recommended Fix:** Rename folders to lower-case with redirects, or lower-case the emitted URLs consistently.
**Verification:** Deploy preview on Linux and click each Inventory/Transportation/Utility menu.

## ORPH-20
**Severity:** Low   **Type:** Improvement
**Category:** Frontend
**Module:** Cross-module consistency
**Location:** part09-data-consistency.md sections 1-10
**Function/Method:** n/a
**Problem:** Same concept, many spellings: tenant (6 spellings), year (6), role (8), response envelope (4 shapes, 18 unwrap helpers, 175 primitive helpers), dates (4 locales, 76 helper defs, 45 `toISOString().slice(0,10)`), currency (22 helper defs; en-IN vs locale-less toLocaleString; floating point), statuses (case/format variants, "in progress" x6).
**Evidence:** e.g. `toLocaleDateString` with en-IN 16, en-GB 21, en-US 31, none 17; lib/date-only.ts imported by 2 files; `Intl.NumberFormat('en-IN')` 20 vs `toLocaleString()` 82.
**Impact:** Inconsistent UI, timezone off-by-one via toISOString, money rounding risk, brittle status filters.
**Expected Behavior:** One shared helper per concern.
**Recommended Fix:** Introduce lib/format (money, date, status labels), migrate incrementally.
**Verification:** Grep counts drop.

## ORPH-21
**Severity:** Info   **Type:** Architectural
**Category:** Frontend
**Module:** Transport layer
**Location:** app/api/proxy/route.ts:1-122; app/api/proxy-file/route.ts; app/dashboard/_lib/dashboard-api.ts:174-207; app/import-data/page.tsx:99-247
**Function/Method:** proxy relay and direct calls
**Problem:** Three transports (same-origin relay, direct-to-Laravel cross-origin, per-module Next handlers) are mixed, sometimes within one module; the relay forwards client Cookie/Authorization to `API_BASE_URL` and does not restrict the `path`.
**Evidence:** 130 `/api/proxy` literals vs ~316 direct `${baseUrl}` calls; admin dashboard direct vs teacher/student via Next.
**Impact:** Inconsistent CORS/CSP surface and auth behaviour, duplicated error handling.
**Expected Behavior:** One documented transport.
**Recommended Fix:** Standardise on the relay (or direct) and delete the rest; allow-list relay paths.
**Verification:** n/a

## ORPH-22
**Severity:** Medium   **Type:** Confirmed
**Category:** Security
**Module:** Next handlers (LLM)
**Location:** app/api/screenCandidate/route.ts:97-125; app/api/process/convert/route.ts
**Function/Method:** POST /api/screenCandidate, POST /api/process/convert
**Problem:** Anonymous endpoints spend server-side LLM credentials (DeepSeek/OpenRouter/Gemini keys from env; local model for convert) with no auth or rate limit.
**Evidence:** Handlers read env keys and call the provider; no token/401 reference in either file (tokenRefs=0/1 in the scan).
**Impact:** Cost abuse / denial of wallet; resume text and JD are relayed to third-party providers.
**Expected Behavior:** Authenticated, rate-limited.
**Recommended Fix:** Require a verified session and add rate limiting.
**Verification:** curl POST without headers returns provider output today.

ISSUE COUNTS: C=3 H=6 M=8 L=4 I=1

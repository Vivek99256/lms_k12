# 12 - ORPHAN / DEAD CODE AUDIT

> Repos in scope: `D:\lms_k12` (Next.js frontend) and `D:\next_lms_erp` (Laravel backend consumed by the frontend). Static analysis only: no code modified, no server contacted, no `.env` read. Issue IDs are the unified `LMS-AUDIT-###` IDs from [14_MASTER_ISSUE_REGISTER.md](14_MASTER_ISSUE_REGISTER.md); original per-agent IDs are shown alongside and defined in `AUDIT/parts/`.

## Summary (Part 09)

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

## Full lists

- Frontend routes: [parts/part09-data-frontend-routes.md](parts/part09-data-frontend-routes.md)
- Link integrity: [parts/part09-data-links.md](parts/part09-data-links.md)
- API calls vs Laravel routes: [parts/part09-data-api-calls.md](parts/part09-data-api-calls.md)
- Dead code: [parts/part09-data-dead-code.md](parts/part09-data-dead-code.md)
- Cross-module consistency: [parts/part09-data-consistency.md](parts/part09-data-consistency.md)

## Related issues (22)

| ID | Severity | Module | Issue | Source IDs |
|---|---|---|---|---|
| LMS-AUDIT-058 | High | Menu -> route mapping (Result module) | Result menu route-name map shadowed/incorrect; ~31-36 menu links point at non-existent pages | AUTH-13, LMS-27, ORPH-09 |
| LMS-AUDIT-175 | High | G2G Assessments / Learning dashboard, T… | 35 frontend endpoints have no matching Laravel route: | ORPH-11 |
| LMS-AUDIT-240 | Medium | Duplicate modules | Parallel implementations with different behaviour: | LMS-28 |
| LMS-AUDIT-241 | Medium | Quiz, Subjects, Learning Outcome, LMS M… | `handlePublish` sets a 1.5 s timeout then navigates - the quiz is never saved (false success). | LMS-29 |
| LMS-AUDIT-280 | Medium | Enterprise Brain — registry screens, AI… | These `hpbrain_*` tables are read by screens but written by **no application code** (grep of `D:\next_lms_erp\app`, excluding the registry/controller readers): | AI-C17 |
| LMS-AUDIT-295 | Medium | Platform Services — Notification / Sche… | Configuration is persisted but no runtime component consumes it. | AI-D17 |
| LMS-AUDIT-309 | Medium | Fees / backend features without UI | Grep of `app`, `lib`, `components` finds no caller/page for these; | FIN-33 |
| LMS-AUDIT-342 | Medium | Admin dashboard, HRIT leave, Talent man… | 7 in-app navigations target routes that have no page. | ORPH-10 |
| LMS-AUDIT-343 | Medium | PAL intervention queue | GET/POST `/api/pal/intervention` and `/{id}`, `/{id}/close` have no backend; | ORPH-12 |
| LMS-AUDIT-344 | Medium | Task management (legacy + reports) | Legacy `/task/{id}` update/delete and `/api/user-rejected-tasks-courses` are not registered. | ORPH-13 |
| LMS-AUDIT-381 | Low | Case-sensitive paths | PascalCase route directories vs lowercase menu keys break on case-sensitive filesystems | INFRA-25, ORPH-19 |
| LMS-AUDIT-390 | Low | Dependencies | Unused packages `geist`, `uuid`, `@tiptap/extension-image`; | INFRA-14 |
| LMS-AUDIT-391 | Low | Repository layout | The working tree holds a second full checkout of another branch inside `.kilo/worktrees/` (registered in `git worktree list`), scanned by ESLint (INFRA-13) and… | INFRA-22 |
| LMS-AUDIT-394 | Low | Event Bus (Platform Services) documenta… | `sources.ts` header still says every endpoint is `planned` because no route exists; | AI-15 |
| LMS-AUDIT-400 | Low | Dead/duplicate code | Unreferenced DOK diagnostic panel and its `fetchDiagnosticAssessment/submitDiagnosticAssessment` client fns; | AI-A26 |
| LMS-AUDIT-423 | Low | Dead code and duplication in the intell… | `AiInsightsPanel` has no importer and would always send no token (there is no `token` key in localStorage — see ai-journey/page.tsx:52 and ai-reports/[id]/page… | AI-D27 |
| LMS-AUDIT-427 | Low | Fees / dead or placeholder UI | Non-functional controls and unused state. | FIN-31 |
| LMS-AUDIT-431 | Low | Shared components | Nine primitives exist twice with both variants in active use (button 381 vs 55 importers, select 32 vs 71, card 162 vs 22, input 210 vs 32, table 144 vs 17, dr… | HR-33 |
| LMS-AUDIT-432 | Low | HRIT, Org | Stub handlers only `console.log`; | HR-34 |
| LMS-AUDIT-434 | Low | Routing structure | 12 identical hyphen/underscore hostel page twins, misspelt duplicate module folders, exam/result twin screens and 80 pages with no reference. | ORPH-17 |
| LMS-AUDIT-435 | Low | Dead code and repo hygiene | 62 dead files, 1,723 never-imported exports, a 299-file design-system folder type-checked by `tsc`, 32 unused public assets, 7 Next handlers with no caller. | ORPH-18 |
| LMS-AUDIT-453 | Info | Transport layer | Three transports (same-origin relay, direct-to-Laravel cross-origin, per-module Next handlers) are mixed, sometimes within one module; | ORPH-21 |


## Requirement gap classification

See 08_MODULE_FUNCTIONAL_AUDIT.md (Status class per module family) and 13_TRACEABILITY_MATRIX.md (Status per feature). Stubs/fake data called out by agents: quiz create/take (LMS-29), Attendance Regularization in-memory stub and Compensation page re-render (HR-25), Command Center KPIs hard-coded to 0 (AI-C08), integration-configs mock store (LMS-AUDIT-007), PAL intervention queue with no backend (AI-A20), Career Awareness static pages (AI-C13), 7 Next handlers with no caller, 21 G2G Assessment endpoints with no matching Laravel route (ORPH-11).

## Part 09 detail

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
| hard-coded absolute URLs (non-test) | see data-api-calls section 6 | | n8n webhooks (ORPH-14 (LMS-AUDIT-205)), http:// apps.triz.co.in links, vercel.app ontology iframe |
| role/tenant/user key spellings | see data-consistency sections 1-4 | | |



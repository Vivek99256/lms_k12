# 07 - FRONTEND AUDIT

> Repos in scope: `D:\lms_k12` (Next.js frontend) and `D:\next_lms_erp` (Laravel backend consumed by the frontend). Static analysis only: no code modified, no server contacted, no `.env` read. Issue IDs are the unified `LMS-AUDIT-###` IDs from [14_MASTER_ISSUE_REGISTER.md](14_MASTER_ISSUE_REGISTER.md); original per-agent IDs are shown alongside and defined in `AUDIT/parts/`.

## Headline numbers

| Metric | Value |
|---|---:|
| `page.tsx` files / routable | 677 / 676 (75 dynamic) |
| Orphan pages (no link/menu/redirect references them) | 80 |
| In-app navigations to non-existent pages | 7 |
| Menu mapper keys returning non-existent pages | 36 |
| Migration-seeded menu links resolving to no page | 17 of 80 |
| Routes with upper-case path segments | 62 |
| Dead files / never-imported exports | 62 / 1,723 |
| `dangerouslySetInnerHTML` sites | 65 in 35 files (only 6 files mention a sanitiser) |
| `document.write` sites | 15 |
| `console.log` | 35 in 16 files |
| `localStorage` / `sessionStorage` uses | 277 in 114 files / 46 in 30 files |
| `eslint-disable` | 307 in 209 files |
| `npx tsc --noEmit` | 1 error (framer-motion missing from local node_modules; declared in package.json) |
| `npx eslint .` | 494 errors, 290 warnings in 227 tracked source files (+ noise from nested .kilo worktree and design-system folder) |
| Files >1,000 lines / >500 lines | 76 / 286 |
| Distinct session readers | 60 (46 names); 6 tenant-id spellings; 4 date locales; 22 currency helpers |

## Route, link and API integrity (Part 09)

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



Full lists: [parts/part09-data-frontend-routes.md](parts/part09-data-frontend-routes.md), [parts/part09-data-links.md](parts/part09-data-links.md), [parts/part09-data-consistency.md](parts/part09-data-consistency.md).

## Tooling, lint, type-check, tests (Part 03)

## 9. Second-pass results

Scope: `app components lib hooks contexts services packages` unless noted (source files: 2,071, 532,354 LOC).

| Sweep | Count | Notes |
|---|---|---|
| `TODO` (word) | **2** | `app/course-master/data/chapters.ts:754` (`TODO(backend): confirm the real store endpoint`); `lib/event-bus/sources.ts:13` (prose "IT IS ALSO THE TODO LIST") |
| `FIXME` / `HACK` / `XXX` | 0 / 0 / 0 | |
| `console.log(` | **33** in 20 files | `console.error` 76, `console.warn` 23, `console.info/debug` 3 |
| `debugger` | 0 | |
| `@ts-ignore` / `@ts-expect-error` / `@ts-nocheck` | 1 / 1 / 0 | `components/ui/checkbox.tsx:27` (ESLint `ban-ts-comment` error), `app/talent-management/administration/components/admin-center.tsx:276` |
| `eslint-disable*` | **307** | rules: `react-hooks/set-state-in-effect` 140, `react-hooks/exhaustive-deps` 95, `@next/next/no-img-element` 64, `no-console` 5. File-level disables in 6 files (`app/fees/reports/{fees-cancel,fees-collection,other-fees-cancel,other-fees,student-breakoff}/page.tsx`, `app/general/_components/TemplateHtmlEditor.tsx`). Heaviest: `components/domain/lms/administration-governance/use-administration-governance.ts` (19). 17 stale directives ("Unused eslint-disable directive") reported by ESLint. Malformed directive at `app/organization-management/employee-directory/components/employee-directory.tsx:310` (rule names `above \`]` and `[])\`).` not found) |
| `any` (`: any`, `as any`, `<any>`, `any[]`) | **267 hits in 57 files** (ESLint `no-explicit-any`: 279 errors in main) | top: `components/document-template/editor/LayersPanel.tsx` (29), `talent-management/mobility-and-succession/components/mobility-center.tsx` (21), `components/document-template/blocks/TableBlock.tsx` (21), `personal-info-tab.tsx` (14), `TextBlock.tsx` (14), `organization-management/_lib/employee-directory-api.ts` (13) |
| `dangerouslySetInnerHTML` | **65 sites in 35 files** | only 6 of those files mention DOMPurify/sanitize/escape; top: `app/pal/eso/page.tsx` (15), `app/h5p/h5p_mcq/page.tsx` (5). Unsanitised backend HTML: `app/fees/collect/[studentId]/page.tsx:669,898`, `app/fees/circulars/page.tsx:857,859`, `app/fees/cancel-refund/page.tsx:815`, `app/fees/_components/fees-shared.tsx:235`, `app/fees/NACH_s4excel_import/page.tsx:167`, `app/career-explorer/expert-advice/page.tsx:210`, `explore-sectors/page.tsx:86`, `app/lms/curriculum-planning/CurriculumTab.tsx:188` |
| `eval(` / `new Function(` | 0 | |
| `localStorage` / `sessionStorage` | 277 / 46 hits | bearer token is in `userData` (localStorage) |
| `window.location` | 15 hits (`window.location.replace('/')` in `AuthContext.tsx:332`) | raw redirects are rare |
| `fetch(` | 556 hits (35 in `app/api`); `axios` only 2 hits (text) | axios not a dependency |
| `Authorization` header sites | 146 hits in 99 files | |
| `credentials: 'include'` | 20 hits in 16 files | |
| `alert(`/`confirm(` | **154** hits | `mobility-center.tsx` 18, `employee-profiles-center.tsx` 9 |
| `return [];` / `return null;` | 215 / 540 | not classified individually |
| `() => {}` empty handlers | 21 | |
| "mock/dummy/lorem/hardcoded/sample data" mentions | 80 | |
| "coming soon / not yet available / not implemented" strings | 42 | |
| Commented-out code lines (regex) | 96 | `app/general/onboarding/_lib/onboarding-api.ts` has a **445-line commented-out prior copy of the file** (lines 1-446 vs 359 live lines, 805 total) |
| Files > 500 LOC / > 1000 LOC | **286 / 76** | |
| Real-person emails/phones in tracked files | see INFRA-03 (LMS-AUDIT-059) | Emails: `vivekgajera2709@gmail.com`, `rajesh@gmail.com` (`.kilo`), `kalpesh@triz.co.in`, `teacher@gmail.com`, `student1@gmail.com` (`docs/user-journey`). Sample company emails in `app/organization_managment/oragnization_profile/page.tsx:131-498` are demo data. About 20 mobile numbers in `.kilo/**` (example redacted `0992***`, `7655***`, `9876***`), 1 hit in `docs/menu-data-source-audit.md` (sample record) |
| Secret regex (`\bsk-`, `AIza`, `AKIA`, `ghp_`, `xox*`, JWT `eyJ...`, `BEGIN PRIVATE KEY`, `sk_live`, `Bearer <literal>`, credentialed URLs) over all tracked files | **0 real hits** | False positives: `task-...` matching `sk-`; `rzp_live_...` is a UI placeholder (`app/task-management/administration/integration/components/integration-providers.ts:98`); `password` hits are form labels |
| Env/secrets in git history (`.env`, `.env.local`, `*.pem`, `AIza`, `sk-...` via `git log --all`) | 0 hits | limited scan |

Top 25 files by LOC:

| # | LOC | File |
|---|---|---|
| 1 | 6,719 | `app/course-master/[courseId]/chapters/page.tsx` (305 KB) |
| 2 | 4,231 | `app/lms/exam/page.tsx` |
| 3 | 3,117 | `app/course-master/lesson-plan/[courseId]/page.tsx` |
| 4 | 2,867 | `app/talent-management/performance-reviews-and-appraisals/components/performance-tabs.tsx` |
| 5 | 2,684 | `.../performance-reviews-and-appraisals/components/performance-center.tsx` |
| 6 | 2,637 | `app/talent-management/development-and-career-paths/components/development-career-center.tsx` |
| 7 | 2,604 | `app/pal/eso/page.tsx` |
| 8 | 2,523 | `app/talent-management/mobility-and-succession/components/mobility-center.tsx` |
| 9 | 2,440 | `app/fees/collect/page.tsx` |
| 10 | 2,152 | `app/organization_managment/Department/page.tsx` |
| 11 | 2,116 | `app/talent-management/certifications/components/certifications-center.tsx` |
| 12 | 2,080 | `app/student/page.tsx` |
| 13 | 2,023 | `lib/agents/executors.ts` |
| 14 | 2,016 | `app/talent-management/offboarding/components/offboarding-center.tsx` |
| 15 | 1,985 | `app/capability-intelligence/competency-library/components/competency-library.tsx` |
| 16 | 1,907 | `app/organization_managment/oragnization_profile/page.tsx` |
| 17 | 1,892 | `app/admissions/admission_enquiry/page.tsx` |
| 18 | 1,808 | `app/h5p/data/h5p.ts` |
| 19 | 1,788 | `app/fees/master/fees-config-master/page.tsx` |
| 20 | 1,768 | `app/fees/intelligence/_components/fees-intelligence-screen.tsx` |
| 21 | 1,751 | `app/pal/data/pal.ts` |
| 22 | 1,692 | `lib/agents/registry.ts` |
| 23 | 1,662 | `app/talent-management/onboarding/components/onboarding-sheets.tsx` |
| 24 | 1,597 | `components/domain/lms/assignments/learning-assignments.tsx` |
| 25 | 1,584 | `app/pal/data/pal-eso.ts` |

Material `console.log` (33 total), those that dump request or response payloads or user data:
`app/student/student_attendance/page.tsx:471`, `app/student/daywise_student_attendance/page.tsx:318`, `app/student/monthwise_student_attendance/page.tsx:691,700,717` (request payload plus session), `app/student/yearly_student_attendance/page.tsx:369`, `app/fees/master/other-fees-title/page.tsx:255,256,383`, `app/course-master/lesson-plan/[courseId]/page.tsx:955-1341` (9 calls, division API payloads), `app/course-master/[courseId]/chapters/sideDrawer.tsx:735,737` (prompts and data used to generate content), `app/organization_managment/oragnization_profile/page.tsx:539,542` (session, record), `app/components/Sidebar.tsx:113`. No-op placeholder handlers that only log: `app/students/health_medical/components/StudentHealthTable.tsx:44,48,52` (Edit student / Generate certificate / Print ID card), `app/students/search_student/components/StudentProfilesDashboard.tsx:208,213`, `app/hrit/attendance-management/attendance-reports/page.tsx:614,618,622` (Export / Print / Save), `app/hrit/leave-management/leave-dashboard/components/RecentLeaveRequests.tsx:102` (View).

Near-duplicate clusters (Jaccard on normalised lines >= 0.7, 1,176 files >= 60 lines considered, 9 clusters):
1. Six dashboard summary proxies, 62-64 lines each, 0.82-0.85 similar: `app/api/{admissions,hostel,library,students,transportation,fees}/dashboard/summary/route.ts`. Also `getDefaultBaseUrl`, `readHeader`, `summarizeHtml` are re-declared in **18** route files and `jsonError` in 16.
2. AI-stack screens copy-pasted per module (0.82-0.86): `prompts-screen` x5 (`app/_components/ai-stack/`, `admissions`, `student`, `attendance`, `fees`), `activity-screen` x4, `policies-screen` x4, `usage-cost-screen` x4, `knowledge-base-screen` x3 (`app/{admissions,student,attendance}/ai-stack/_screens/*`), 214-399 lines each.
3. `app/general/onboarding/OnboardingPage.tsx` vs `_components/onboarding-ui.tsx` (0.91).
4. `app/library/pending_scan_report/page.tsx` vs `scanned_book_report/page.tsx`.
5. `app/h5p/h5p_interactive_video/[id]/edit/page.tsx` vs `create/page.tsx`.
Structural duplication: `app/components`, `app/lib`, `app/hooks` next to root `components/`, `lib/`, `hooks/`; `app/frontdesk` and `app/front_desk`; `app/organization-management` and `app/organization_managment` (noted by the audit doc itself); `app/exam`, `app/exam-assessment`, `app/lms/exam`; `app/mobile`, `mobile-apps`, `mobile-bridge`; `app/onboarding` and `app/general/onboarding`.

Placeholder/hosting artefacts: `public/{file,globe,next,vercel,window}.svg` (create-next-app defaults, 0 references), `public/images/career-explorer/college-campus-fallback.png` 2.3 MB.

---



## Copy-paste template clusters and deviations (Part 08 §2b)

 Copy-paste template clusters and deviations

| Cluster | Files | Verdict / deviations |
|---|---|---|
| easy_com send screens | 5 `send_*` page.tsx -> `EntryPage` config | Config driven, low risk. Deviations: email screen uses `selectionField: 'sendsms'` (matches backend `SendEmailParentsApiController.php:199`, naming only); WhatsApp posts `sendNotification[studentId]` (matches `:90`) |
| easy_com reports | 5 `*_report` -> `ReportPage` config | Consistent. `whatsapp_report`/`register_parent_report` omit `optionsPath`, deliberate |
| easy_com masters | `sms_api`, `smtp`, `whatsapp_api` + `manage_sms_api` | `sms_api/page.tsx` is a 1-line file, `manage_sms_api` is the real page (duplicate route, one is dead) |
| admin-services CRUD/report pages | 20 pages | All use `legacyRequest`/`requireSession`, all wrap in try/catch (grep: try=catch in every file). Only `consent-master`, `ptm-attended-status`, `ptm-report`, reports have no delete confirm, which is correct for those. No missing-auth-header deviation found |
| hrit payroll pages | 6 pages, all `PayrollPageShell` | Consistent gate. Deviation: `salary-certificate` and `form-16` go through `/table_data` (unauthenticated, HR-01) for employee pickers |
| hrit leave pages | dashboard/requests/reports/configuration | Only `leave-configuration/page.tsx:46` gates by role; requests page shows Bulk Approve/Reject to everyone (`leave-requests/page.tsx:461,464`) |
| task-management `*-api.ts` (8) | share `task-session.ts` transport | Consistent. Deviation: `my-tasks-api.ts` also uses a raw `legacyGet/legacyPostForm` (bare host, token in query) and `integration-management-api.ts` targets Next in-memory routes |
| talent `*-api.ts` (10) | Bearer header + `contextParams` | Consistent. `recruitment-api.ts:216` bypasses it with a raw n8n `fetch` |
| general `GeneralPage` configs | 5 pages (`template_management`, `user_profile_masters`, `bulk_upload`, `form_builder`, `coming-soon`) | 3-line wrappers; `bulk_upload` renders a generic page with no upload backend (see HR-25) |

---



## Frontend-facing issues (89)

| ID | Severity | Module | Issue | Source IDs |
|---|---|---|---|---|
| LMS-AUDIT-001 | Critical | Every Laravel-proxying Next handler (SS… | Server-side routes take the upstream Laravel host from a client-controlled header/param (SSRF + bearer/cookie exfiltration) | NAPI-01, INFRA-01, AUTH-14, AI-02, AI-A08, ORPH-05, LMS-19, FIN-18, STU-30 |
| LMS-AUDIT-002 | Critical | Agents engine + Conversational AI admin… | Agents / conversational-AI engine trusts client headers for tenant+user, has unauthenticated list/run endpoints, and checks RBAC against the caller-chosen host | NAPI-02, NAPI-03, INFRA-02, AI-01, AI-C03, AI-C04 |
| LMS-AUDIT-056 | High | Recruitment screening, SOP conversion | Unauthenticated /api/screenCandidate and /api/process/convert spend server LLM credentials and send resume data to third parties | INFRA-09, NAPI-05, ORPH-22, HR-18 |
| LMS-AUDIT-058 | High | Menu -> route mapping (Result module) | Result menu route-name map shadowed/incorrect; ~31-36 menu links point at non-existent pages | AUTH-13, LMS-27, ORPH-09 |
| LMS-AUDIT-060 | High | Fees receipts/circulars, career explore… | Unsanitised dangerouslySetInnerHTML sinks (65 in 35 files) render teacher/AI/DB-authored HTML while JWT is in localStorage | INFRA-08, AI-05, AI-A07 |
| LMS-AUDIT-071 | High | Mobile WebView handoff / mobile custom… | `if (!isAuthenticated) return <LoginPage />;` runs **before** the `FULL_BLEED_ROUTES` check that lists `/mobile-bridge` and `/mobile/custom`. | AUTH-12 |
| LMS-AUDIT-076 | High | LMS Exam page - student "Online Exam" t… | The component renders a free-text `<textarea>` for every question (including MCQ/True-False) and posts only `answer_narrative[<id>]`. | LMS-10 |
| LMS-AUDIT-099 | High | Capability Intelligence — Command Cente… | (1) "Create Skill"/"Create New" default kind `competency` POSTs `/api/competency/competencies` and "Launch Assessment" POSTs `/api/competency/assessments` — ne… | AI-C09 |
| LMS-AUDIT-147 | High | Inward/Outward masters and registers -… | `deleteResource` sets `_method=DELETE` then calls `mutateForm(path,'PUT',form)` whose `if (method === 'PUT') form.set('_method','PUT')` overwrites it, so the r… | FIN-78 |
| LMS-AUDIT-161 | High | Admissions (public enquiry page) | The rewrites `/admission-enquiry`, `/admission-registration`, `/admission-confirmation` suggest public parent-facing pages, but `ConditionalApp` renders the lo… | STU-27 |
| LMS-AUDIT-203 | Medium | All modules (Result, Fees, HRIT, Capabi… | JWT duplicated in URLs/query strings/bodies (log, history, referrer leakage) | ORPH-08, LMS-31, HR-26, FIN-19 |
| LMS-AUDIT-205 | Medium | Talent management, task management, mis… | Hard-coded third-party n8n webhooks receive job/task data | INFRA-10, ORPH-14, HR-29 |
| LMS-AUDIT-206 | Medium | Agents store, conversational-AI admin s… | Agents/conversational-AI persisted in local JSON files (races, multi-instance loss, ephemeral FS) | INFRA-16, AI-09, NAPI-16 |
| LMS-AUDIT-208 | Medium | Generic proxies (`/api/proxy`, `/api/pr… | Generic /api/proxy relays any path/verb with caller Authorization+Cookie (open relay) | NAPI-10, AUTH-23 |
| LMS-AUDIT-209 | Medium | question-paper asset proxy | question-paper asset proxy fetches client-supplied URLs unauthenticated (origin allow-list only, open-redirect follow) | NAPI-11, LMS-33 |
| LMS-AUDIT-210 | Medium | Environment / base URL selection | API environment chosen by hostname (non-local => production) on client and NODE_ENV on server; previews hit prod | INFRA-06, AUTH-30 |
| LMS-AUDIT-211 | Medium | AI capability registry / roadmap | AI capability registry drift causes 2 failing tests and contradictory roadmap statuses | INFRA-11, AI-11 |
| LMS-AUDIT-212 | Medium | Stale-client detection | Every deploy clears localStorage/sessionStorage and signs all users out | INFRA-15, AUTH-32 |
| LMS-AUDIT-213 | Medium | SQAA | Multipart uploads through the Next proxy are read as text and corrupted | LMS-30, FIN-43 |
| LMS-AUDIT-214 | Medium | Session/year helpers and JWT in URLs | Multiple disagreeing academic-year resolvers/session readers | STU-31, LMS-35 |
| LMS-AUDIT-220 | Medium | Session behaviour (idle timeout, daily… | The 30-minute idle timer is per tab and, when it fires, removes `auth`, `menuContext`, `userData` from the **shared** localStorage; | AUTH-19 |
| LMS-AUDIT-221 | Medium | 401 / expiry handling | There is no central fetch wrapper; | AUTH-20 |
| LMS-AUDIT-226 | Medium | Conversational-AI service tokens | Tokens are minted, hashed and displayed, but `authenticateServiceRequest` is called only from `service.test.ts`; | NAPI-14 |
| LMS-AUDIT-227 | Medium | Rate limiting, body size and timeouts (… | No Next-side rate limiting anywhere (`grep` finds none); | NAPI-15 |
| LMS-AUDIT-230 | Medium | Lint/type hygiene | `npm run lint` is unusable: | INFRA-13 |
| LMS-AUDIT-232 | Medium | Documentation contradicting code | Field-edit docs say it keeps a local `generateText` and "there is currently no Laravel endpoint with that narrow contract"; | INFRA-18 |
| LMS-AUDIT-233 | Medium | Observability | No error tracking (no Sentry/OTel/Datadog dependency), no health endpoint for the web tier (only `/api/mcp/health`), no structured logging (76 `console.error`,… | INFRA-19 |
| LMS-AUDIT-234 | Medium | Code structure | 76 source files exceed 1,000 lines and 286 exceed 500; | INFRA-21 |
| LMS-AUDIT-235 | Medium | PAL taxonomy pages | Server components call back into their own API by building `${proto}://${host}/api/pal/content-model` from the incoming `x-forwarded-proto`, `x-forwarded-host`… | INFRA-23 |
| LMS-AUDIT-241 | Medium | Quiz, Subjects, Learning Outcome, LMS M… | `handlePublish` sets a 1.5 s timeout then navigates - the quiz is never saved (false success). | LMS-29 |
| LMS-AUDIT-244 | Medium | Teach Assistant panel - stuck-user assi… | After 2 minutes without click/keypress on ANY screen and for ANY role (students, parents, staff) the assistant opens itself. | AI-06 |
| LMS-AUDIT-245 | Medium | Teach Assistant panel - data sent to AI… | Each open-panel navigation, filter or keystroke in a search box re-posts `page_data` (up to 25 records x 8 attributes: | AI-07 |
| LMS-AUDIT-246 | Medium | Auth/session for AI clients | Five separate copies read the bearer token and role from `localStorage.userData/menuContext`; | AI-08 |
| LMS-AUDIT-249 | Medium | Voice interaction | Voice input uses the browser Web Speech API (`SpeechRecognition`), which in Chrome/Edge streams audio to the vendor's cloud recogniser; | AI-13 |
| LMS-AUDIT-252 | Medium | ESO chapter dashboard / empty content | With no ESO-ready concept (every tenant except the one whose nodes were loaded) `chapterDashboard` returns `current_concept_name = null`, `chapter_sections = [… | AI-A11 |
| LMS-AUDIT-253 | Medium | ESO pages loading/error handling | (1) `refresh()`/`load()` return early on a falsy `learnerId`/`conceptId` without clearing the initial `loading=true` -> permanent skeleton/spinner (e.g. | AI-A12 |
| LMS-AUDIT-267 | Medium | Content model authoring page | These handlers call `load()` after success, which resets `title`, `body` and `draft` from the server (`setDraft({})`, `:100-102`) with no dirty check. | AI-B09 |
| LMS-AUDIT-269 | Medium | Gamification - UI coverage of backend f… | The celebration/notification queue is written by the backend on every badge and personal best but never displayed or marked read (`unreadNotifications` is pars… | AI-B11 |
| LMS-AUDIT-270 | Medium | Coherence Map page (Neo4j dependency) | With the known Neo4j auth failure (memory: | AI-B12 |
| LMS-AUDIT-273 | Medium | Administration panels | (1) The config states learner-scoring subsystems are "held behind an explicit confirmation in the UI", but the UI only changes the button label to "Save - affe… | AI-B16 |
| LMS-AUDIT-276 | Medium | Career Awareness / Career Intelligence… | The four Career Awareness pages (certainty, ambition, alignment, originality) render only explanatory paragraphs; | AI-C13 |
| LMS-AUDIT-282 | Medium | Capability Intelligence — Capability Ex… | The screen is an iframe of `https://skill-ontology-neo4j.vercel.app/?sub_institute_id=<tenant>` — a third-party hosted **example dataset** (the component's own… | AI-C19 |
| LMS-AUDIT-285 | Medium | Competency Framework — Role Requirement… | If loading a role's requirements fails, the panel sets `rows=[]` and shows an error, but Save stays enabled (`disabled={saving \\|\\| loading}`). | AI-C22 |
| LMS-AUDIT-296 | Medium | Roadmap / capability status registries… | Statuses, phases and "consumption today" flags are typed constants that contradict each other and reality. | AI-D18 |
| LMS-AUDIT-305 | Medium | Fees / dates | The default receipt date / "today" is the UTC date; | FIN-25 |
| LMS-AUDIT-309 | Medium | Fees / backend features without UI | Grep of `app`, `lib`, `components` finds no caller/page for these; | FIN-33 |
| LMS-AUDIT-316 | Medium | Hostel / visitor pages and wrappers | Hostel visitor pages call the school gate-visitor APIs (visitor_master), not the hostel visitor tables that exist (`hostel_visitor_master`, `show_hostel_visito… | FIN-55 |
| LMS-AUDIT-320 | Medium | Library / print helpers | Print HTML built by string interpolation of student/book fields then `window.open('', '_blank')` + `document.write`. | FIN-63 |
| LMS-AUDIT-332 | Medium | Student list (`/students/search_student… | (1) "Add New Student" modal is a static form: | STU-32 |
| LMS-AUDIT-337 | Medium | Attendance UI consistency | Two competing attendance-marking screens; | STU-41 |
| LMS-AUDIT-339 | Medium | HRIT, Talent, General, Task | Screens present fabricated data as live. | HR-25 |
| LMS-AUDIT-342 | Medium | Admin dashboard, HRIT leave, Talent man… | 7 in-app navigations target routes that have no page. | ORPH-10 |
| LMS-AUDIT-343 | Medium | PAL intervention queue | GET/POST `/api/pal/intervention` and `/{id}`, `/{id}/close` have no backend; | ORPH-12 |
| LMS-AUDIT-346 | Medium | Session/identity handling across modules | Identity/tenant/year/role are read through 60 independent session readers (46 names) plus the shared buildSessionContext; | ORPH-16 |
| LMS-AUDIT-373 | Medium | Frontend upload components and proxy tr… | 15 of 69 inputs have no `accept`; | INT-31 |
| LMS-AUDIT-380 | Low | Logging and placeholder handlers | console.log/console.debug dumps sessions, payloads and AI prompts in production browser console | INFRA-20, AUTH-31, FIN-32 |
| LMS-AUDIT-381 | Low | Case-sensitive paths | PascalCase route directories vs lowercase menu keys break on case-sensitive filesystems | INFRA-25, ORPH-19 |
| LMS-AUDIT-382 | Low | Login redirect | A logged-out user opening a deep link sees the login form at that URL, but after login the code unconditionally `router.replace('/dashboard')` after 1.1 s, dis… | AUTH-27 |
| LMS-AUDIT-383 | Low | Login page details | `/forgot-password` is documented as "pre-login only" but, when logged out, `ConditionalApp` renders `LoginPage` instead of this page, so its effect never runs; | AUTH-28 |
| LMS-AUDIT-385 | Low | Documentation accuracy | Docs drifted from code: | AUTH-33 |
| LMS-AUDIT-386 | Low | Error and response format consistency,… | Seven different envelopes: | NAPI-17 |
| LMS-AUDIT-387 | Low | Duplicated proxy code | Each copy has drifted: | NAPI-18 |
| LMS-AUDIT-388 | Low | PAL data helpers (server-side URL const… | `getPalContentModel` builds a server-to-self URL from `x-forwarded-host`/`host` request headers, so a spoofed Host makes the server fetch an attacker host duri… | NAPI-19 |
| LMS-AUDIT-389 | Low | SOP converter model default | The default model id is `gemini-3.6-flash`. | NAPI-20 |
| LMS-AUDIT-392 | Low | Rendering config | The root layout forces every route to be dynamically rendered, defeating static optimisation and the full-route cache; | INFRA-24 |
| LMS-AUDIT-393 | Low | Teach Assistant panel | Chat persistence: transcript (last 50 messages, may include PII answers) in `sessionStorage`, cleared once per full page load (`beginChatPageSession`), on logo… | AI-14 |
| LMS-AUDIT-394 | Low | Event Bus (Platform Services) documenta… | `sources.ts` header still says every endpoint is `planned` because no route exists; | AI-15 |
| LMS-AUDIT-395 | Low | Assistant SSE proxy | The stream proxy correctly takes the upstream host from env (`AI_UPSTREAM_BASE_URL`/`NEXT_PUBLIC_AI_BASE_URL`), unlike other routes, but forwards the raw reque… | AI-16 |
| LMS-AUDIT-396 | Low | Pedagogy modal mastery summary | The tile labelled "Not started" displays `summary.dueForReview` (`due_for_review = count($dueConceptIds)`); | AI-A14 |
| LMS-AUDIT-398 | Low | PAL Test debug logging | "TEMP DIAGNOSTIC" `console.debug` statements dump full question records (options with correct flags) on every fetch/render in production builds. | AI-A24 |
| LMS-AUDIT-402 | Low | Legacy fallbacks | Any HTTP 404 (including "route/learner not found") silently switches to older endpoints with different authorization semantics; | AI-A28 |
| LMS-AUDIT-406 | Low | Content model data client | URL-derived values (`?node=`, `?slug=`, `?id=`) are interpolated into the API path without `encodeURIComponent`, unlike `administration.ts` which encodes. | AI-B17 |
| LMS-AUDIT-408 | Low | PAL content/pedagogy/administration emp… | End-user screens print server-operator instructions (`php artisan pal:tag-content`, `pal:install-pedagogy-engine`, "Deploy the New PAL Administration module an… | AI-B20 |
| LMS-AUDIT-410 | Low | New PAL navigation | Three navigation sources disagree: | AI-B22 |
| LMS-AUDIT-414 | Low | Silent failure handling | Departments page returns `null` (blank) whenever department intelligence is loading or fails (`if (!deptIntelligence.data) return null;`) even though the roste… | AI-C30 |
| LMS-AUDIT-418 | Low | Career Counselling — RIASEC | Results are never persisted (only `?answers=` in the URL — answers appear in browser history/proxy logs); | AI-C34 |
| LMS-AUDIT-419 | Low | People-competency course builder / assi… | `useSearchParams()` used without a `<Suspense>` boundary (all sibling pages wrap it) — may fail `next build` prerender; | AI-C35 |
| LMS-AUDIT-423 | Low | Dead code and duplication in the intell… | `AiInsightsPanel` has no importer and would always send no token (there is no `token` key in localStorage — see ai-journey/page.tsx:52 and ai-reports/[id]/page… | AI-D27 |
| LMS-AUDIT-424 | Low | Silent failures and misleading empty/"n… | Failures are shown as empty ("No runs recorded yet", no live counts, no progress) and the Consumers tab always renders "The Event Bus read API is not connected… | AI-D28 |
| LMS-AUDIT-427 | Low | Fees / dead or placeholder UI | Non-functional controls and unused state. | FIN-31 |
| LMS-AUDIT-430 | Low | Maintainability | Critical write flows are hand-minified single-line components that cannot be code-reviewed or diffed; | STU-44 |
| LMS-AUDIT-431 | Low | Shared components | Nine primitives exist twice with both variants in active use (button 381 vs 55 importers, select 32 vs 71, card 162 vs 22, input 210 vs 32, table 144 vs 17, dr… | HR-33 |
| LMS-AUDIT-432 | Low | HRIT, Org | Stub handlers only `console.log`; | HR-34 |
| LMS-AUDIT-434 | Low | Routing structure | 12 identical hyphen/underscore hostel page twins, misspelt duplicate module folders, exam/result twin screens and 80 pages with no reference. | ORPH-17 |
| LMS-AUDIT-435 | Low | Dead code and repo hygiene | 62 dead files, 1,723 never-imported exports, a 299-file design-system folder type-checked by `tsc`, 32 unused public assets, 7 Next handlers with no caller. | ORPH-18 |
| LMS-AUDIT-436 | Low | Cross-module consistency | Same concept, many spellings: | ORPH-20 |
| LMS-AUDIT-447 | Info | Design-system drift | Contradicts `CLAUDE.md` design rules (flat surfaces, no gradients, no emoji). | LMS-39 |
| LMS-AUDIT-451 | Info | Internal-roadmap visibility flag | Internal-only roadmap rows (event bus, "no approval trail" governance gap) are hidden by a build-time public env flag, not an access check; | AI-D31 |
| LMS-AUDIT-453 | Info | Transport layer | Three transports (same-origin relay, direct-to-Laravel cross-origin, per-module Next handlers) are mixed, sometimes within one module; | ORPH-21 |


## Not covered

A visual/accessibility review (keyboard, contrast, screen-reader), responsive behaviour and runtime console errors were **NOT VERIFIED** - no browser session was run (the audit forbids starting servers). Accessibility findings are therefore limited to code-level observations recorded in the module reports.

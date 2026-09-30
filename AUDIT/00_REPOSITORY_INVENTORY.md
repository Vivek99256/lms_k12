# 00 - REPOSITORY INVENTORY

> Repos in scope: `D:\lms_k12` (Next.js frontend) and `D:\next_lms_erp` (Laravel backend consumed by the frontend). Static analysis only: no code modified, no server contacted, no `.env` read. Issue IDs are the unified `LMS-AUDIT-###` IDs from [14_MASTER_ISSUE_REGISTER.md](14_MASTER_ISSUE_REGISTER.md); original per-agent IDs are shown alongside and defined in `AUDIT/parts/`.

## Method

Counts are exact `git ls-files` counts taken during the audit (Laravel at commit 0bd66fc3b - branch student_workflow at audit start, v1-launch at the same commit from 11:58 - frontend at commit 771e660; uncommitted V1 security-guard edits made during the audit are excluded, see the register header). "Reviewed" is reported honestly in three depths, taken from the per-agent coverage tables reproduced below: **read fully** (line-level), **skimmed** (structure + targeted greps/excerpts), **machine-swept** (all 2,071 frontend source files were parsed with the TypeScript AST / regex for routes, links, API calls, imports and the second-pass patterns, but not read by a person or agent). Agent-reported counts are approximate and can overlap.

## Summary table

| Area | Total | Reviewed | Remaining | Notes |
|---|---:|---:|---:|---|
| **lms_k12** - all tracked files | 2477 | n/a | n/a | includes design-system spec, agent-tool state, docs, assets |
| lms_k12 - source files (app, components, lib, hooks, contexts, services, packages) | 2066 | ≈820 line-level (≈400 read fully + ≈420 skimmed); all 2,071 machine-swept | ≈1,250 not line-reviewed | ~531K LOC; sum of agent-reported counts, overlaps possible |
| lms_k12 - `page.tsx` route files | 680 | 677 parsed by AST (676 routable, 75 dynamic); ≈40% line-level per module tables | remainder machine-swept only | 680 by glob vs 677 by AST (3 non-page files match the glob) |
| lms_k12 - layouts | 10 | all | 0 | root layout forces dynamic rendering (INFRA-24) |
| lms_k12 - Next route handlers (`app/api/**/route.ts`) | 67 | 67 read fully (+3 `_lib` helpers) | 0 | full table in 05_API_AUDIT.md |
| lms_k12 - components/ | 248 | partial | majority | ui 48, domain 64, intelligence 47, document-template 32, mobile-page-builder 23 |
| lms_k12 - lib/ | 182 | partial | majority | 16 files in students/admissions/attendance libs were `*-ai-stack.ts` config, not reviewed |
| lms_k12 - hooks / contexts / services / packages | 6 / 2 / 2 / 5 | read (AI hooks, AuthContext, services)  | small |  |
| lms_k12 - tests | 42 | inventoried; `npm test` executed (555 pass / 2 fail of 557) | 0 | all under lib/ and packages/; none cover auth/money/API handlers |
| lms_k12 - docs (*.md incl. docs/, README, CLAUDE.md, AGENTS.md) | 99 | README, CLAUDE.md, AGENTS.md, menu-data-source-audit, AI docs verified against code | journey/PROMPT docs skimmed | several docs contradict code (INFRA-17/18, AUTH-33) |
| lms_k12 - `K-12 ERP Design System/` | 299 | 1 file compared to CLAUDE.md | 298 | vendored spec, imported by nothing, type-checked by tsc (ORPH-18) |
| lms_k12 - agent/tool state (.kilo, .agents, .codex, .claude, g2g) | 28 | PII/secret sweep done | - | 22 `.kilo/conversational-ai` state files hold real PII (INFRA-03) |
| lms_k12 - CI/CD, Docker | 0 | - | - | `.github/workflows` empty; no Dockerfile (INFRA-04) |
| **next_lms_erp** - route files | 43 | 5 read fully, rest machine-recorded | - | 3,094 route declarations (≈5,453 with resource expansion); 2,315 with route-level auth, 779 without |
| next_lms_erp - controllers | 835 | ≈40 read fully, ≈250 checked by grep/classification script | ≈545 not opened | depth sacrificed for breadth (Part 10) |
| next_lms_erp - models | 474 | sampled | majority | Part 11 (database) covers model↔table map |
| next_lms_erp - migrations | 1084 | scripted parse (Part 11) | - | 827 distinct tables created (scripted parse, Part 11; the 708 in BE-25 was an undercount); 16 created twice for real, 68 of 84 duplicate creates are columnless FK stubs; 35 empty down() |
| next_lms_erp - middleware / requests / policies | 32 / 9 / 0 | ≈15 middleware read | ≈17 | no Policy classes exist |
| next_lms_erp - jobs / events / listeners / observers / notifications / mails | 4 / 1 / 1 / 0 / 0 / 3 | all read (Parts 10, 12) | 0 |  |
| next_lms_erp - console commands | 91 | schedule + key commands | rest |  |
| next_lms_erp - services | 253 | MCP/AI core read | majority |  |
| next_lms_erp - tests | 124 | inventoried | - | includes RbacEnforcementTest / SessionMiddlewareAuthBypassTest / PAL-ESO auth tests (lead-verified); none cover the submit=Search bypass, the anonymous-route census or cross-controller tenant binding (BE-34 overstated) |
| next_lms_erp - blade views | 1066 | not reviewed | all | legacy server-rendered UI, out of frontend scope |

## Coverage tables reported by each audit agent (verbatim)

### Part 01 - Auth, roles, menus

## 1. Scope & coverage

| Area/dir | Files in scope | Read fully | Skimmed | Not reviewed | Notes |
|---|---|---|---|---|---|
| `app/login` | 1 (608 lines) | 1 | 0 | 0 | Includes the ForgotPasswordModal that lives in the same file |
| `app/forgot-password` | 1 | 1 | 0 | 0 | Dead page when logged out (AUTH-28 (LMS-AUDIT-383)) |
| `app/api/forgot-password`, `app/api/google-auth` | 2 | 2 | 0 | 0 | Also covered in part02 |
| `components/auth` | 1 (`gtg-auth.tsx`) | 1 | 0 | 0 | Thin shim over `useAuth` |
| `contexts` | 2 | 1 (`AuthContext.tsx`, 406 lines) | 0 | 1 (`PageAiContext.tsx`) | AI page context; not auth |
| `lib/session` | 1 (`internal-access.ts`) | 1 | 0 | 0 | Its referenced `internal-access.test.ts` does not exist (AUTH-33 (LMS-AUDIT-385)) |
| `lib/erp-client.ts`, `lib/erp-legacy.ts`, `lib/laravel-context.ts` | 3 | 3 | 0 | 0 | Session/JWT plumbing used by 251 files |
| `app/components/utils` (`api_url.tsx`) | 1 | 1 | 0 | 0 | |
| `app/mobile-bridge`, `app/mobile`, `app/onboarding` | 3 | 3 | 0 | 0 | `app/mobile/custom/[slug]/page.tsx` read in full |
| `lib/users`, `lib/consent` | 2 | 0 | 2 (header comments only) | 0 | AI-stack descriptors, no auth logic |
| `app/user` | 7 | 1 (`api.ts`) | 1 (`add_user/page.tsx`) | 5 | Rights come from server (`permissions()`), see AUTH-34 (LMS-AUDIT-445) |
| `app/user_log` | 2 | 1 (`api.ts`) | 0 | 1 (`page.tsx`) | |
| `hooks/` | 6 | 1 (`use-sidebar-navigation.ts`) | 0 | 5 | The other 5 are AI/voice hooks, not auth |
| `app/hooks` | 2 | 2 (`useMenuRights.ts`, `usePermission.ts`) | 0 | 0 | |
| `app/data` | 5 | 3 (`menuItems`, `menuMappers`, `moduleDashboards`) | 1 (`routeMapper.ts`, 1172 lines, ~55% read) | 1 (`menuSearch.ts`) | Menu -> route mapping; targets verified programmatically |
| `app/lib/routes.ts` | 1 | 0 | 1 | 0 | Stale route registry (AUTH-13 (LMS-AUDIT-058)) |
| `app/modules` | 5 | 0 | 2 (`module-routes.ts`, `[categoryKey]/page.tsx`) | 3 | |
| `app/api/modules`, `lib/laravel-category-proxy.ts` | 3 | 0 | 2 | 1 | |
| `components/shell` | 1 | 0 | 0 | 1 | Icon glyph only |
| `app/components` (shell chrome) | 19 | 2 (`ConditionalApp`, `DashboardShell`, 872 lines) | 2 (`Header`, `Sidebar` via targeted reads/greps) | 15 | `Level3Subheader`, `HeaderMenuSearch`, `ChatbotPanel`, etc. not read line by line |
| Other frontend files read for this scope | — | `app/layout.tsx`, `app/page.tsx`, `next.config.ts`, `lib/app-version.ts`, `lib/gtg-roles.ts`, `lib/gtg-org-data.ts`, `app/api/proxy/route.ts`, `app/api/proxy-file/route.ts`, `lib/agents/acting-user.ts`, `app/lms/_shared/RequireStaff.tsx`, `app/dashboard/_lib/resolveDashboardRole.ts`, `app/pal/data/pal-view-as.ts`, `lib/ai/adapters/shared-utils.ts` | `app/documents/_lib/document-access.ts`, `lib/roadmap/index.ts` | — | |
| Docs verified against code | 5 | `menu-data-source-audit.md`, `student-menu-report.md` | `teacher_role_audit.md`, `admin-user-journey.md` (§1, §8), `teacher-user-journey.md` (grep only) | `admin-user-journey-PROMPT.md`, `teacher-user-journey-PROMPT.md`, `user-journey/*` | See AUTH-33 (LMS-AUDIT-385) |
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



### Part 02 - Next API routes

## 1. Scope & coverage

| Area/dir | Files in scope | Read fully | Skimmed | Not reviewed | Notes |
|---|---|---|---|---|---|
| `app/api/**/route.ts` | 67 | 67 | 0 | 0 | Every handler opened. 12 dashboard/menu proxies are near-clones; diffed with `diff --strip-trailing-cr` against `dashboard/admin` and `fees/dashboard/summary`. |
| `app/api/**/_lib/*.ts` (agents, conversational-ai, fees/reports) | 3 | 3 | 0 | 0 | `agents/_lib/handler.ts`, `conversational-ai/_lib/handler.ts`, `fees/reports/_lib/fees-report-proxy.ts` |
| `lib/laravel-category-proxy.ts` | 1 | 1 | 0 | 0 | used by `modules/menu-categories` (2 routes) |
| `lib/agents/*` | 9 (acting-user, engine, store, types, client, executors, registry, 2 tests) | acting-user, engine, store, client (headers only) | executors.ts (2023 lines: read header + `readViaMcp` + fetch/session greps), registry.ts (1692 lines: grep + RBAC-key sections) | tests only skimmed for names | executors/registry are static tool catalogs; only the session/MCP path matters for security |
| `lib/ai/*` (mcp-client, local-model, project-resolver, session, conversational-admin/*, field-edit/*, adapters/shared-utils) | 16 | mcp-client, local-model, project-resolver, conversational-admin/{service,service-token,store} | field-edit/{actions,prompt,types} skimmed (pure prompt builders), session.ts, client.ts skimmed | - | |
| `lib/process/*` | 12 | 0 | grepped for fetch/env/fs/HTML sinks, read `convert` route fully | parser/derive-tasks/sop-catalog logic not reviewed line by line | pure text parsing, no I/O, no HTML rendering found |
| `lib/intelligence/*` (server use by ask/stream) | 24 | 0 | `ask-stream.ts` interface only | remainder not reviewed | client-side SSE translation; not a security surface |
| `lib/question-paper/images.ts` | 1 | `isAllowedAssetUrl` region | - | rest not reviewed | allow-list function used by asset route |
| `packages/ai-intelligence-core/src/*` | 4 | `index.ts` head | registry.ts grepped | solutions.ts not reviewed | static capability registry, no I/O |
| `packages/conversational-ai-core/src/*` | 2 | `file-store.ts` | followup-suggestions.ts not reviewed | - | file-store is imported by nothing (dead) but its output is committed (see NAPI-13 (LMS-AUDIT-059)) |
| `.data/` JSON store | 0 on disk | n/a | - | - | `/.data/` is gitignored (`.gitignore:48`), directory does not exist in this checkout. Store code reviewed instead. |
| Laravel cross-trace (`D:\next_lms_erp`) | ~25 files | routes, `HydratesLegacyApiSession`, `SessionMiddleware`, `McpAuth`, `McpContextHydrator`, `McpRateLimit`, `LmsApiAuth`, `RequireStaffRole`, `VerifyCsrfToken`, `ImportApiController`, 5 dashboard controllers, `FeesDashboardApiController`, `online_fees_payment_api_controller`, `PermissionsController`, `ForgotPasswordController` | `online_fees_collect_controller` (grep only), `ToolsCallController`/`ToolRegistry` (grep) | other 7 payment gateways' response handlers | |
| **Totals** | **70 files under app/api (67 route.ts + 3 helpers)** + ~68 lib/package files | 70 / 70 under app/api | - | 0 under app/api | |

HTTP method-handlers exported across the 67 files: 76 (proxy has 5; integration-configs/[id] 3; agents, fees-cancel,
integration-configs 2 each; the rest 1).

Not reviewed: Laravel response handlers for HDFC/ICICI/Axis/AggrePay/PayPhi/HDFC-Razorpay gateways (payment callbacks live
in Laravel `online_fees_collect_controller.php`, not in the Next layer); `lib/process` parser internals; `lib/intelligence`
beyond the stream helper.

---



### Part 03 - Infra, config, tests, docs

## 1. Scope & coverage

| Area/dir | Files in scope | Read fully | Skimmed | Not reviewed | Notes |
|---|---|---|---|---|---|
| Root config (`package.json`, `next.config.ts`, `tsconfig.json`, `eslint.config.mjs`, `postcss.config.mjs`, `components.json`, `.gitignore`, `.env.example`, `.claude/settings.json`, `.kilo/kilo.jsonc`, `.kilo/agent-manager.json`, `new k12.code-workspace`) | 12 | 12 | 0 | 0 | Full read. |
| `package-lock.json` | 1 (953 entries) | 0 | parsed by script (versions, `deprecated`, duplicates) | full transitive tree | `npm audit` needs network, so it was not run. Known-CVE status is NOT VERIFIED. |
| Docs: `README.md`, `CLAUDE.md`, `AGENTS.md`, `docs/menu-data-source-audit.md`, `docs/conversational-ai-architecture.md` | 5 | 5 | 0 | 0 | Factual claims verified against code (section 7.3). |
| Docs: rest of `docs/*` (17 files), `docs/enterprise-brain/INTEGRATION_AUDIT.md`, `docs/user-journey/*` (2), `PAL-V4-Frontend-Change-Map.md` | 21 | 0 | 21 (headers, spot-checked claims) | line-by-line | About 6,500 lines of narrative docs; only headline claims checked. |
| Tracked agent-tool state: `.kilo/**` (24), `.codex/**` (2), `.claude/settings.json`, `diff_frontend.txt`, `.tsc-check2.log` | 29 | 5 | 24 (structure plus regex for secrets/PII) | none | |
| `K-12 ERP Design System/` | 299 | 1 (`readme.md` vs `CLAUDE.md`) | 0 | 298 | Vendored design-system spec. Only lint/tsc impact and CLAUDE.md duplication were analysed. |
| `app/`, `components/`, `lib/`, `hooks/`, `contexts/`, `services/`, `packages/` (source) | 2,071 (532,354 LOC) | ~25 (env, auth, proxy, app-version, api_url, agents/acting-user, process/convert, screenCandidate, field-edit, google-auth, admin proxy, import proxy, module-screens generator) | all, by regex/AST-less scripts | line-level review | Business logic was not reviewed here. This part is config, hygiene, sweeps. |
| `app/api/**/route.ts` | 67 | 9 | 67 (grep metadata) | | See section 5. |
| 42 test files | 42 | 2 (`ai-capabilities.test.ts`, plus failing assertions) | 40 (test titles enumerated) | | Section 7. |
| `.github/`, `Dockerfile`, CI | 1 empty dir, 0 files | n/a | n/a | n/a | Confirmed absent. |
| `scripts/` (2), `public/` (40 files) | 42 | 2 | 40 | | |

Totals: 2,477 tracked files; 2,071 source files (532,354 LOC) in the app/components/lib/hooks/contexts/services/packages scope, of which roughly 30 were read fully and the rest swept programmatically. Not reviewed at line level: everything under `app/` pages and `components/` (other parts own them), `K-12 ERP Design System/` (vendored spec), transitive dependencies.

---



### Part 04 - LMS / H5P / Exam / Result

## 1. Scope & coverage

Depth vocabulary: **Read fully** = whole file (or every logic-bearing part) read; **Skimmed** = excerpts / grep of endpoints, gating,
sinks and calculations; **Not reviewed** = only listed / sized. Counts are approximate (rounded to the nearest few files) because
several large files were read in slices.

| Area/dir | Files in scope | Read fully | Skimmed | Not reviewed | Notes |
|---|---:|---:|---:|---:|---|
| app/lms | 96 | 7 | 45 | 44 | 40 pages. Homework/assignment/planning pages were traced through their `api.ts` + endpoint/gating greps, not line by line. `exam/page.tsx` (4231 lines) read in slices (QuestionPaperView, publish, practice submit). |
| app/course-master | 35 | 3 | 10 | 22 | `chapters/page.tsx` (6719 lines) and `lesson-plan/[courseId]/page.tsx` (3117) skimmed by grep for sinks/endpoints; coherence-map view components not reviewed. |
| app/h5p | 93 | 2 | 22 | 69 | 57 pages. Data layer (`h5p.ts` first ~700 of 1808 lines, `h5p-model.ts`, `question-bank-library.ts`) + every `dangerouslySetInnerHTML` sink read; individual editors/players not read line by line. |
| app/teach-learn | 14 | 12 | 2 | 0 | Category pages are 8-21 line wrappers. |
| app/chapters | 2 | 1 | 1 | 0 | |
| app/quiz | 4 | 2 | 2 | 0 | |
| app/subjects | 4 | 1 | 3 | 0 | |
| app/learning-outcome | 3 | 3 | 0 | 0 | 2-line wrappers over `MigrationModulePage` (read). |
| app/exam | 12 | 4 | 5 | 3 | `data/onlineExam.ts`, `data/aiPaper.ts`, `online/[paperId]/page.tsx` read fully; `marks-entry` first 420/654 lines. |
| app/exam-assessment | 1 | 1 | 0 | 0 | AI-stack config screen only. |
| app/result | 27 | 3 | 8 | 16 | `marks-entry`, hub `page.tsx`, `[slug]` read fully; `report-card` (save-html + render), `wrt-progress` calc read; other report pages skimmed/not reviewed. |
| app/sqaa + sqaa_master + sqaa_document_report | 9 | 3 | 0 | 6 | `_lib/api.ts` + wrappers read; components/types not reviewed. |
| lib/h5p | 27 | 0 | 9 | 18 | 14 are `*.test.ts` (not read). Scoring functions read via grep + excerpts (true-false, single-choice-set, drag-drop, memory-game, text-activity). |
| components/h5p | 14 | 0 | 2 | 12 | `EssayPlayer.tsx` sink read. |
| lib/teach-learn, curriculum-planning, lms-ai, exam-assessment, exam, sqaa | 6 | 0 | 1 | 5 | AI-stack descriptor configs (`AiStackModule`), identical shape; `lms-ai` sampled. |
| lib/question-paper | 12 | 1 | 0 | 11 | `images.ts` read; 6 test files + numbering/pagination/sections/options/types not reviewed. |
| lib/result | 3 | 1 | 1 | 1 | `api.ts` read fully; `masters.ts` (739 lines) skimmed. |
| components/result | 8 | 0 | 2 | 6 | `print.ts`, `DynamicForm.tsx` sink read. |
| services/g2g-lms.ts | 1 | 1 | 0 | 0 | Barrel re-export for the **People-Competency G2G LMS** (`app/people-competency/lms`). Not used by any in-scope module. |
| components/ui/g2g | 14 | 0 | 0 | 14 | Not imported by any in-scope module (grep). Out of scope de facto. |
| docs (h5p-*.md x3, LMS_CONTENT_ARCHITECTURE_BACKLOG_ACTION_PLAN.md) | 4 | 0 | 1 | 3 | Backlog doc first 60 lines read; h5p docs sized only. |
| app/api/{question-paper/asset, teach-learn/menu-categories, proxy} + lib/erp-client.ts + app/data/routeMapper.ts (dependencies of scope) | 5 | 4 | 1 | 0 | Read because they carry scope traffic. |
| **Frontend total** | **~372** | **~48** | **~114** | **~210** | |

Laravel files traced (read, in whole or the relevant methods): `routes/api.php`, `routes/lms.php`, `routes/resultapi.php`, `routes/result.php`,
`routes/web.php` (lms parts), `routes/pal_api.php` (h5p prefix), `app/Providers/RouteServiceProvider.php`, `app/Http/Kernel.php`,
middleware `ApiSessionHydrator`, `Concerns/HydratesLegacyApiSession`, `SessionMiddleware`, `RequireStaffRole`, `LmsApiAuth`, `RequireLmsStaff`,
`RequirePermission`, `checkPermission`, `MenuMiddleware`, `PalApiAuth`, `VerifyCsrfToken`; controllers `api/result/BaseResultApiController`,
`MarksEntryApiController`, `ExamMasterApiController`, `StudentResultApiController`, `UploadResultApiController`,
`result/marks_entry/marks_entry_controller`, `result/classwiseGradeReportController`, `result/new_result/studentResultController::save_result_html`,
`lms/onlineExamController`, `lms/assessmentQuestionController` (submitPractice/checkAnswer), `lms/reports/studentReportController::edit`,
`api/ApiQuestionPaperController`, `api/ApiLmsCourseController` (createQuestionBank/deleteQuestionBank/persistContent), `api/ExamEvaluationApiController`,
`api/QuestionPaperTemplateApiController` (tenant handling), `api/lms/StudentHomeworkApiController`, `api/lms/HomeworkSubmissionApiController`,
`api/lms/LmsResultDashboardApiController`, `api/lms/LessonPlanPeriodApiController`, `api/lms/LessonIntelligenceApiController` (dropdowns),
`api/MigrationModulesApiController`, `api/sqaa/SqaaApiController`, `lms/h5p/*` (Flashcard, ContentType base, Scenario, InteractiveVideo, ImageHotspots saveRules),
`Services/lms/H5P/H5PPackageArchive`, `Helpers/Helper.php::getGrade/getGradeScale`, `AJAXController` list lookups.
Not traced: models/migrations for most tables (no DB access), `H5PTextActivityController`, `H5PDragDropController`, `lmsDashboardController`, PAL controllers beyond middleware.

---



### Part 05 - PAL / AI / Intelligence

_(section 1 not found in part05-pal-ai-intelligence.md)_


### Part 06 - Fees / Finance / Operations

## 1. Scope & coverage

| Area/dir | Files in scope | Read fully | Skimmed / grep-traced | Not reviewed | Notes |
|---|---|---|---|---|---|
| app/fees (pages, `_lib`, `_components`) | 85 | 9 (`_lib/fees-api.ts`, `collect/[studentId]/page.tsx`, `online-payment/[gateway]/page.tsx`, `online-fees-settings/page.tsx`, `_lib/fees-report-utils.ts` (90-260), `_lib/fees-screen-registry.tsx`, `reports/receipt-reprint/page.tsx`, `audit-trail/page.tsx`, `collect/page.tsx` 1-700) | 30 (`collect/page.tsx` rest, `cancel-refund/page.tsx` 150-350 & 690-840, `other_fees_collect/page.tsx` 225-330, `master/fees-breakoff`, the other `master/*`, `reports/*`, NACH x4, `circulars`, `map_year`, `update-fees-breakoff`, `online_fees_collect`, `other_fees_cancel`, `teacher-dues`, `dashboard`) via targeted grep/read of fetch/POST bodies | 46 (`ai-stack/**` 13 files ~5.6k lines, `intelligence/**` 6 files ~3.5k lines, `help-guide-support`, `communication`, `onboarding/workflow/scheduler/sop-task/operations/process-builder` thin wrappers, `_components/fees-charts.tsx`, `fees-ai-assist.tsx`) | AI-stack/intelligence are AI-config/analytics UIs not on a money path |
| app/api/fees/* (Next handlers, other agent owns) | 22 | 4 (`reports/_lib/fees-report-proxy.ts`, `dashboard/summary/route.ts`, `online-payment/[gateway]/route.ts`, thin route wrappers) | 18 one-liner wrappers | 0 | read only to trace flow |
| app/dashboard (fees/hostel/library/transport dashboards) | 11 | 3 (`page.tsx`, `resolveDashboardRole.ts`, `dashboard-api.ts` head) | 8 | 0 | |
| lib/fees, petty-cash, inventory, hostel, transport, library, inward, front-desk, visitor, utility | 10 | 1 (`fees-ai-stack.ts` outline) | 9 (each is an *AI-stack registry*, not business logic) | 0 | `lib/petty-cash` is only an AI-stack registry - no petty-cash module exists in the frontend (see section 2) |
| lib/table-export.ts | 1 | 1 | 0 | 0 | |
| app/Inventory (33) | 33 | 33 (sub-audit A: api.ts, configs.ts, all components/pages, ai-stack) | 0 | 0 | delegated; INV-01 route shadowing reproduced with a router replica |
| app/Transportation (21) | 21 | 10 (api.ts, configs.ts, TransportationPage, student_transport_mapping, add_transport_rate, dashboard) | 11 (ai-stack, intelligence, wrappers) | 0 | delegated |
| app/hostel (38) | 38 | 33 (api.ts, setup-api.ts, configs.ts, HostelModulePage, VisitorModulePage, wrappers) | 2 (dashboard page/api partial) | 3 (hostel-dashboard.tsx, ai-stack screens, intelligence) | delegated |
| app/library (17) | 17 | 5 (library-module-utils, quick_return, scan_book, add_book_remark, book_resources) | 9 (reports, print_barcode, dashboard) | 3 (ai-stack, intelligence) | delegated |
| app/front_desk (25) | 25 | 9 (`_lib/api,modules,reports`, `ModuleWorkbench`, `GalleryAlbums`, `create-timetable/api`, thin pages) | 3 (create-timetable page partial, classwise api) | 13 (ai-stack screens) | delegated |
| app/inward_outward (15) | 15 | 9 (`_lib/api`, `types`, `RegisterPage`, `ReportPage`, wrappers) | 1 (`MasterPage` grep) | 5 (`shared.tsx`, ai-stack) | delegated |
| app/Utility (21) | 21 | 12 (`_lib/*`, `page.tsx`, all `api.ts`, rollover page) | 5 (breakoff, student-transfer, transfer-student, update-all-data, custom-module pages partial) | 4 (`ClassFilters`, ai-stack, rest of custom-module page) | delegated |
| app/bazar (3) | 3 | 3 | 0 | 0 | delegated; report component `MigrationModulePage` not read |
| Laravel (traced, read-only) | - | `fees_collect_controller.php` (60-1220, 1637-1880, 2002-2040, 2277-2400, 2996-3190, 3285-3400), `feesCancelController.php` (all), `feesRefundController.php` (300-670), `online_fees/*` (payment API, settings, reprint, audit, reconciliation, razorpay/hdfc/icici/axis/aggre/payphi handlers), `feesDefaulterReportController.php`, `FeesDashboardApiController.php`, `FeesRefundApiController.php`, `TeacherFeeDuesApiController.php`, `HostelDashboardApiController.php`, `LibraryDashboardApiController.php`, `AJAXController.php` (receipt reprint & mobile lookup), `checkPermission.php`, `SessionMiddleware.php`, `HydratesLegacyApiSession.php`, `VerifyCsrfToken.php`, `LogRouteMiddleware.php`, `routes/fees.php`, `routes/api.php` (fees/dashboards) | grep of all other fees controllers for tenant source and raw SQL | - | |

Totals (scope): 380 frontend files in the requested dirs (+22 Next handlers read for tracing). Read fully or in the money-critical parts: about 30. Grep/skim-traced: about 70 in fees + delegated modules. Not reviewed: about 50 (AI-stack / intelligence / help screens).
Unreviewed on purpose: `app/fees/ai-stack/**`, `app/fees/intelligence/**`, `app/fees/help-guide-support/**`, `_components/fees-charts.tsx` (charts only).

---



### Part 07 - Students / Admissions / Attendance

## 1. Scope & coverage

Counts are `git ls-files` counts. "ai-stack" = the per-module `ai-stack/` config/screens (boilerplate; not reviewed line by line).

| Area/dir | Files in scope | Read fully | Skimmed | Not reviewed | Notes |
|---|---|---|---|---|---|
| app/student | 63 (20 ai-stack) | student-admin-api.ts, add_student, setup-api.ts, student-care-api.ts, StudentCareModule (partial), bulk api.ts, infirmary api.ts, student_attendance (save/load/default paths), my_icard, cert/icard print+preview paths, all one-line report/page wrappers, dicipline/health/hw/vaccination/optional-subject pages | daywise/monthwise/yearly attendance pages, StudentReportModule (1322), StudentCertificateModule (1371), student_icard (783), TeacherIcardModule (689) - read only fetch/dangerouslySetInnerHTML/print paths | `student/page.tsx` (2080 lines, this is the student "My Course/LMS" portal - LMS agent), 20 ai-stack files | |
| app/students | 40 (2 ai-stack) | search_student/api.ts, page.tsx, StudentProfilesTab (list/dead buttons), requests/api.ts (headers), health_medical/discipline/house/ICards api.ts (endpoint lines), dashboard route wiring | StudentDetailDrawer, StudentProfilesDashboard, document components | charts/metric card components | |
| app/admissions | 40 (12 ai-stack) | admission_registration/workflow.ts, admission-Enquiry flow, admission_enquiry/page.tsx (endpoint + payload + enquiry-number logic) | admission_reports/api.ts, config.ts, followUpApi.ts, follow-up-agenda-api.ts, admission-form-api.ts, confirmation/page.tsx, registration/[id]/edit | AdmissionReportWorkspace (695), sideDrawer (614), ai-stack (12) | |
| app/admission-Enquiry | 1 | 1 (partial: lines 1-200 + submit path) | 0 | 0 | Target of the `/admission-enquiry` rewrite |
| app/attendance | 18 (12 ai-stack) | _lib/attendance-api.ts, attendance_dashboard/page.tsx (load/save/date paths) | DailyRegister, MonthlyOverview, MetricCard | ai-stack (12) | |
| app/dashboard | 11 | page.tsx, resolveDashboardRole.ts, dashboard-api.ts | Admin/Teacher/Student dashboards, preferences | chart primitives | |
| app/academic_setup | 10 | api.ts, create_batch, one-line pages | AcademicSetupPage.tsx | | |
| app/classteacher + classteacherReport | 3 | api.ts endpoints, report page head | page bodies | | |
| app/teachertransfer | 2 | 0 fully (endpoint line) | api.ts, page.tsx | | Backend read fully |
| app/teacher_daily_report | 2 | 0 | endpoint line only | body | Backend read (auth block) |
| app/proxy_master | 2 | api.ts fully | page.tsx | | |
| app/proxy_report, app/todays_proxy_report | 2 | 0 | imports/endpoint use | bodies | Reuse proxy_master/api.ts |
| app/documents | 6 | document-access.ts | documents-api.ts endpoints | components | Backend gate read |
| app/reports | 4 | 4 (all are `MigrationModulePage` wrappers) | | | See STU-33 (LMS-AUDIT-215) |
| app/user, app/user_log | 9 (2 ai-stack) | api.ts endpoints, add_user/page.tsx (head) | user_report, user_log pages | ai-stack (2) | |
| app/api/{students,admissions,dashboard}/**/route.ts | 8 | students summary route, teacher-icard route | others diffed vs those | | |
| lib/* named in brief (students, admissions, attendance, timetable, student-requests, student-medical, student-icard, user-icard, complaint, consent, circulars, ptm, parent-communication, communication, certificate, institute) | 16 | 0 | 0 | 16 | All 16 files are `*-ai-stack.ts` config; contain no data logic. Not reviewed. |
| lib/erp-client.ts, lib/erp-legacy.ts, lib/academic-year.ts, lib/date-only.ts, lib/class-options.ts, lib/session/internal-access.ts | 6 | 6 | | | |
| docs/student-menu-report.md, docs/teacher-user-journey.md, docs/user-journey/* | 4 | student-menu-report.md | teacher-user-journey.md (772 lines, headings only), user-journey/* | | |
| Adjacent, outside dir list but required by the brief's checks: app/front_desk (circular, parent_communication), app/admin-services (complaint, consent, ptm), app/Utility/rollover | ~25 | 0 frontend | backend traced | frontend | Backend controllers read (circularController, parentCommunicationController, ComplaintApiController, rollOverController::create) |
| Laravel (read-only, traced) | ~35 controllers/routes/middleware | studentAttendanceController (whole), 7 adminapi student controllers, admission API controllers (3), admissionEnquiryController::store/paymentProof, proxyController, TeacherTransfer/ClassTeacher/AcademicSetup (write paths), hydrator trait, checkPermission, VerifyCsrfToken, RouteServiceProvider, routes student/adminapi/admission/api/documents | | | |

Totals (frontend): ~250 files in the named dirs; about 60 read fully or in their network/state-critical portions; ~55 skimmed; ~50 ai-stack + presentational not reviewed.

Unreviewed and important: `admission_reports/_components/AdmissionReportWorkspace.tsx`, `admissions/admission_registration/components/sideDrawer.tsx`, `students/search_student/components/StudentDetailDrawer.tsx`, `student/report/StudentReportModule.tsx`, `teacher_daily_report/page.tsx`, `user_log/page.tsx`. Their backends were reviewed; UI-only defects in them may exist.

---



### Part 08 - HR / Org / Tasks / General

## 1. Scope & coverage

| Area/dir | Files in scope | Read fully | Skimmed | Not reviewed | Notes |
|---|---|---|---|---|---|
| app/hrit | 94 | 9 (`_lib/leave-api`, `payroll-api`, `use-monthly-payroll`, `use-attendance`, `attendance-regularization-api`, `payroll-shell`, `leave-configuration/page` head, `attendance-policy/page`, `leave-requests/page` partial) | 40 (grep + targeted ranges: drawers, use-leave, mappers, request-center) | 45 (attendance widgets/charts, dashboard cards, report sections) | Laravel side read fully for leave, payroll compute, attendance punch |
| app/talent-management | 66 | 2 (`recruitment-api` head/tail, `candidate-application-form` 120-297) | 14 (api clients via grep) | 50 (centers of 1000-2800 lines) | Laravel routes + Performance/Recruitment controllers sampled |
| app/organization-management | 47 | 0 fully | 10 (api clients, personal-info-tab, upload-doc-tab) | 37 | Laravel `EmployeeDirectoryController`, `RolePermissionsController`, Disciplinary/Compliance evidence read |
| app/organization_managment | 14 | 0 | 5 (api clients, ai-generation-drawer grep) | 9 (Department 2152 lines, org profile 1907 lines) | Confirmed distinct from hyphenated module, see 2 |
| app/task-management | 74 | 2 (`integration-management-api`, `my-tasks-api` head/createLegacyTask) | 12 | 60 | Laravel `Workspace`, `MyTasks`, `LegacyTask`, `DeadlineExtension`, middleware read |
| app/admin-services | 36 | 0 | 22 (`_lib/*`, page structure by grep) | 14 | Laravel Complaint/Consent/FrontDesk/PettyCash controllers checked for auth |
| app/general | 59 | 3 (`add_process/api.ts`, `task-publisher.ts`, `process-store.ts`) | 10 | 46 | Laravel GeneralSetup/Groupwise/Individual/MobileApp/CustomField/MobileDynamic controllers checked for auth |
| app/easy_com | 23 | 12 (`_lib/api.ts`, 10 page.tsx configs) | 3 | 8 | Laravel `easy_com/*` API controllers read (Base, SendSms, Whatsapp, SmsApiMaster) |
| app/document-templates + lib/document-templates | 6 | 0 | 2 | 4 | Laravel `DocumentTemplateApiController` read (context, merge-data) |
| app/import-data | 5 | 1 partial (`page.tsx` 60-290) | 1 | 3 | Laravel `ImportApiController` read fully |
| app/data, app/modules, app/lib, app/settings, app/page/layout/not-found | 15 | 3 (`routeMapper` grep, `layout`, `page`) | 4 | 8 | Menu registry checked against page existence |
| app/components, app/_components, app/_lib | 39 | 1 (`api_url.tsx`) | 6 | 32 | ChatbotPanel/AI-stack screens not reviewed (AI agent scope) |
| app/hooks, hooks, contexts (PageAiContext) | 8 | 2 (`usePermission`, `useMenuRights`) | 2 | 4 | |
| lib/process, lib/task-management | 13 | 0 | 2 | 11 | only test file in scope is `lib/process/conversion.test.ts` (not run) |
| components/document-template, mobile-page-builder | 55 | 1 (`merge.ts`) | 6 (XSS greps) | 48 | No `dangerouslySetInnerHTML` in either |
| components/domain | 64 | 0 | 1 (import graph) | 63 | Used by LMS routes; out of HR scope, import-checked only |
| components/ui, templates, search-dropdown, erp; services/organization; lib/gtg-org-data | 57 | 4 | 5 | 48 | Duplicate/dead analysis via import graph |
| **Totals (approx.)** | **~660** | **~40** | **~140** | **~480** | 180k lines total; see first paragraph |

Everything under "Not reviewed" was still covered by the second-pass greps in section 9.

---



### Part 09 - Routes / APIs / Orphans

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



### Part 10 - Laravel authz / tenant

## 1. Scope & coverage

Backend size: 3,299 PHP files / ~684 k lines in `app`,`routes`,`config`,`database/migrations`; 835 controller files; 474 models; 1,084 migrations; 41 route files; 33 middleware files; 4 jobs; 1 event + 1 listener; 0 observers; 0 policies; 124 test files.

| Area/dir | Files in scope | Read fully | Skimmed (partial read / targeted grep) | Not reviewed | Notes |
|---|---|---|---|---|---|
| `routes/*.php` | 43 (41 route files + `channels.php`, `console.php`) | `api.php` (999 l), `adminapi.php`, `teacherapi.php`, `mcp.php` (head), `ai.php` (head) | the other 36 — machine-recorded by the stub (all 3,094 declarations captured), comments read where auth was documented | `channels.php`, `console.php` | `custom_module.php` only half recorded (see above) |
| `app/Providers` + `app/Http/Kernel.php` | 8 + 1 | `Kernel.php`, `RouteServiceProvider.php`, `EventServiceProvider` | `AiServiceProvider`, `McpServiceProvider`, `PALServiceProvider` (route loading + rate limiter only) | `AppServiceProvider`, `AuthServiceProvider` (only checked `$policies` is empty) | no Gates/Policies exist |
| `app/Http/Middleware` | 33 | `ApiSessionHydrator`, `Concerns/HydratesLegacyApiSession`, `LmsApiAuth`, `SessionMiddleware`, `RequireStaffRole`, `checkPermission`, `RequirePermission`, `McpAuth`, `McpContextHydrator`, `McpRateLimit`, `LogRouteMiddleware`, `VerifyCsrfToken`, `Brain/BrainAuthenticate`, `Brain/BrainTenantScope`, `Authenticate` | `PalApiAuth` (~80 %), `MenuMiddleware` (head) | `EsoStudentOnlyAuth`, `RequireLmsStaff`, `TaskPermissionMiddleware`, `Throttle*Generation`, `McpRestDeprecation`, `MasterSetupMenuMiddleware`, `Brain/BrainRequirePermission` | |
| `config/` | 55 | `cors.php`, `queue.php` (default), `filesystems.php`, `brain.php`, `lms_content.php` (flag), parts of `session.php`, `app.php`, `auth.php` | — | 45 others | `.env.example` read; live `.env` **not read** |
| Controllers (835 files) | 835 | see "Controllers read" list below (≈40) | ≈250 via targeted grep / classification script (auth, tenant source, uploads, raw SQL, exit/print_r, getMessage) | ≈545 | Business logic depth deliberately sacrificed for breadth of auth/tenant checks |
| `app/Mcp` + `Services/Mcp` | 96 tools + 55 services | `AbstractMcpTool`, `ToolRegistry`, `McpConfirmationService`, `McpContextResolver`, `ToolsCallController`, `AdmissionsConfirmTool`, `AdmissionsUpdateEnquiryTool`, `FeesArrearsTool` | grep across all 96 tools for `authorize`/`allowedRoles`/`isReadOnly` | 93 tool bodies, all services except context resolver/confirmation | |
| `app/Http/Controllers/AI` | 17 | `AiController`, parts of `AiConfigurationController`, `AiModuleModelController`, `AiAssistanceTicketController`, `ReportController`, `RecommendationController` | grep of the rest for role checks | `AskController` internals, `Domain/AI/*` | |
| Jobs / Events / Listeners / Console | 4 / 1 / 1 / 55 commands + Kernel | `Console/Kernel.php`; job headers (`tries/timeout/failed`) | job bodies grepped | 55 artisan commands (not web-reachable) | no Observers directory |
| `database/migrations` | 1,084 | — | all parsed programmatically (create tables, `sub_institute_id` presence, indexes, FKs, guards, sensitive column names) | — | migrations are documented as **drifted from live DB**; results are "what migrations say" |
| `app/Models` | 474 | `loginModel` | programmatic `$fillable/$guarded` census | — | |
| `public/*.php` (web-root scripts) | 15 tracked | `add_user_hrms.php`, `test.php`, `123.php`, `general_integration.php` (head), `hrms_api.php` (head), `default_groupwise_rights.php` (head), `student_photo_integration.php` (head), `excel_upload/db.php` | credential/`$_REQUEST` census of all 15 | `public/library/*` (264 files), `getworkflow.php`, other legacy dirs | |
| Payment gateways | `fees/online_fees/*` | Razorpay handler, ICICI, ICICI Orange, Aggrepay, PayPhi, HDFC/CCAvenue handlers (heads) | | Axis internals, `hdfcrazorpay`, NACH imports, reconciliation | |
| Tests | 124 | names only | | | |

**Controllers read (fully or substantially):** `api/ApiLoginController` (login + `verifyAndUpgradePassword` + token issue), `api/UserManagementApiController`, `api/Leave/LeaveRequestApiController` (+ `ResolvesLeaveContext`), `api/Attendance/Concerns/ResolvesAttendanceContext`, `api/Concerns/ResolvesApiIdentity`, `api/MigrationModulesApiController`, `api/StudentSetupApiController`, `api/StudentsDashboardApiController`, `api/PettyCashApiController` (helpers + delete), `api/ComplaintApiController` (auth + destroy), `api/MenuRightsController` (`getMenuRightsLevelWise` head + queries), `api/ApiLmsCourseController` (lines 60–200 + grep of entire file), `api/ExamEvaluationApiController::publish`, `api/admissionRegistrationAPIController` (index, saveStudent head), `api/adminapiController` (`admin_login`, `admin_check_otp`), `api/apiController` (student OTP flow), `api/ImportApiController` (parse/process), `api/MobileWebHandoffApiController::claims`, `superAdminController`, `FileController::downloadFolder`, `CkeditorFileUploadController`, `WhatsappController` (`whatsappCRM`, `incomingMessage`, webhooks), `Auth/ForgotPasswordController`, `loginController` (auth query), `user/tbluserController::saveData/updateData`, `student/StudentCertificateApiController` (head), `AJAXController::lmsDataApi/ajax_sendmail/geminiAI`, `fees/online_fees/online_fees_collect_controller` (response handlers), `fees/fees_collect/fees_collect_controller::PaidUnpaid`, `AI/*` and `Mcp/*` files listed above, `Helpers/Helper.php` lines 1795–1830 and 1975–2060.

**Route-level auth summary (all 3,094 declarations):**

| Route file | Mounted with | Decl. | route-level auth | none | notes |
|---|---|---|---|---|---|
| `api.php` | `api` (throttle:1000,1/IP) | 429 | 101 | **328** | mix of `api.session`, `lms.auth`; rest rely on controller code |
| `resultapi.php` | `api` | 185 | 185 `api.session` | 0 | authn only, no permission |
| `easycomapi.php` | `api` | 36 | 36 `api.session` | 0 | authn only |
| `talent_management.php` / `competency_management.php` / `task_management.php` / `g2g_lms.php` / `organization_management.php` | `api` | 178/148/87/148/54 | all `api.session` (+`staff.only` on 3 of 5) | 0 (1 public certificate-verify in g2g) | `organization_management` = `api.session` only |
| `pal_api.php` / `pal_eso_api.php` | **none** (no `api` group → no throttle) | 151/22 | `pal.auth` (+`eso.student` on 17) | 4 (`api/pal/pedagogy-engine/*`) | learner-ownership check in `PalApiAuth` |
| `ai.php` / `mcp.php` | `api` + `McpAuth`+`McpRateLimit`+`McpContextHydrator` | 89/7 | all | 0 | 60 req/min/user |
| `brain.php` | `api` + `brain.auth` + `brain.tenant` + `brain.permission:*` | 93 | all | 0 | best-governed surface |
| `platform.php` | `api` + `lms.auth` + `perm:`/`lms.staff` | 16 | all | 0 | `lms.auth` is **warn-only by default** |
| `documents.php` / `mobile_page_builder.php` / `api_hostel.php` | `api` | 3/13/4 | `api.session` | 0 | authn only |
| `adminapi.php` / `teacherapi.php` | **none** (no `api`, no `web`) | 63/34 | 0 | **97** | legacy mobile APIs; JWT checked in controller body; **no throttle at all** |
| `web.php` | `web` | 324 | 180 | **144** | see BE-01 (LMS-AUDIT-008)…BE-07 (LMS-AUDIT-009) |
| `student.php` | `web` | 163 | 102 | 61 | includes `student/api/*` anonymous group |
| `lms.php` | `web` | 285 | 227 | 58 | |
| `fees.php` | `web` | 149 | 118 | 31 | 31 = gateway callbacks (`check_permissions` only) |
| `result.php`, `admission.php`, `hrms.php`, `user.php`, `settings.php`, `inventory.php`, `frontdesk.php`, others | `web` | see CSV | mostly `session`+`check_permissions` | 23/10/2/1/0/0/0… | |
| **Total** | | **3,094** | **2,315** | **779** | 270 declarations are in *neither* the `api` nor `web` group (adminapi 63, teacherapi 34, pal 173) |

Auth mechanisms present: (1) GenTux JWT (`generationtux/jwt-artisan`, HS256, secret `JWT_SECRET`) validated by `api.session`, `lms.auth`, `pal.auth`, `McpAuth`, `brain.auth`, and by ~70 controllers themselves; (2) cookie session (`web` group) for Blade; (3) `session` middleware = cookie session *or* JWT when `type=API|JSON` is posted; (4) Laravel `auth`/Sanctum is **not used** (Sanctum middleware commented out; guard `api` = `token` driver unused). Middleware groups: `web`, `api` only. Throttle: `throttle:1000,1` on the `api` group (per IP) and 3 route-level throttles (`throttle.contentgen` ×2, `throttle.qgen` ×1); nothing on `web`, `adminapi`, `teacherapi`, `pal_*`, login or OTP routes. CSRF exceptions (`VerifyCsrfToken`): `api/*`, `fees/*` (all 149 cookie-session fees routes), `circular/*`, 3 hard-coded full URLs, `studentAspiration|Ambition|Originality`, three `lms/pal/*` paths. CORS (`config/cors.php`): `paths ['*']`, all methods/headers, `supports_credentials=false`, origins from `CORS_ALLOWED_ORIGINS` (**default `*` if unset**; `.env.example` sets it empty → allow-list empty, only pattern `^https://lms-k12-[a-z0-9-]+\.vercel\.app$`); live value NOT VERIFIED.

---



### Part 11 - Database

## 1. Scope & coverage

| Area/dir | Files in scope | Read fully | Skimmed (targeted read / grep) | Not reviewed | Notes |
|---|---|---|---|---|---|
| `database/migrations/*.php` | 1,084 (1 from 2014, 2 from 2019, 373 from 2023, 70 from 2024, 40 from 2025, 598 from 2026) | 19 read by hand (see below) | **all 1,084 parsed programmatically** (up/down bodies, `Schema::create/table/dropIfExists/rename`, `$table->...` column/index/FK calls incl. nested `if(!hasColumn)` blocks and `createIfMissing()` helper, raw `CREATE TABLE`/`ALTER TABLE`/`CREATE INDEX` SQL, DML ops, guards) | none | Parser is regex based: cannot see indexes/columns produced by loops over `const` arrays (3 such files were read manually and patched in: `2026_09_03_008900`, `2026_09_04_100000`, `2026_08_25_160000`), and cannot see column order (`after()`). |
| `database/pal_schema_full.sql` | 1 (371 lines, 27 `CREATE TABLE`) | parsed | all 27 tables are also created by migrations | - | duplicate schema source for PAL |
| `database/seeders`, `database/seeds`, `database/factories`, `database/data`, `database/neo4j` | 9 + 1 + 1 + 3 dirs + 3 dirs | 0 | `DatabaseSeeder` (calls 2 seeders), names only | 9 seeders' bodies, `database/neo4j/*` (cypher/JSON) | not schema-defining except menu/rights data |
| `app/Models/**` + `app/CareerIntelligence/Evidence/EvidenceEvent.php` | 474 + 1 = **475** | `loginModel`, `EmployeeMonthlySalaryData`, `send_late_sms`, `std_grd_maping` (x2), `LearnerNodeState` head | all 475 parsed (`$table`, `$primaryKey`, `$fillable`, `$guarded`, `$hidden`, `$casts`, `$timestamps`, `SoftDeletes`, `boot/addGlobalScope`, relations, traits); reference index over 4,094 PHP files | - | model reference counts are name-token based (upper bound; duplicates share a name) |
| `config/database.php`, `config/neo4j.php` (`triggered` list), `phpunit.xml`, `tests/` | 4 dirs/files | `config/database.php`, `phpunit.xml`, `Console/Kernel.php::bootstrap` | tests grepped for DB traits / DDL | - | |
| Code-vs-schema drift | `app/**` builder/joins (615 distinct table names via `DB::table/from/join`) | - | regex extraction, compared with migration table list | tables reached only via raw SQL strings | |
| Route / API layer for traceability | `part10-laravel-route-inventory.csv` (3,094 routes) | - | controller -> route join by controller basename | - | |
| Frontend (for traceability only) | 2,062 `.ts/.tsx` files under `app/ lib/ components/ services/ hooks/ contexts/` | - | literal-path search of API paths | - | |

Migrations read by hand: `2023_03_05_115658_create_attendance_student_table`, `2023_06_10_233617_add_foreign_key_into_fees_refund_table`, `2023_10_06_112100_create_sharebazar_position_table`, `2026_09_01_000001_add_unique_enrollment_no_to_tblstudent`, `2026_08_25_160000_correct_student_role_menu_rights`, `2026_09_18_120000_reset_cfu_attempts_for_reordered_learning_cycle`, `2026_08_31_000002_drop_display_id_from_evidence_events_table`, `2026_09_11_114052_rename_engagement_score_to_exam_accuracy`, `2024_10_18_120053_add_column_lms_curriculum`, `2026_08_18_172423_alter_tblstudent_password_column_length`, `2025_02_13_144313_add_columns_month_ids`, `2026_08_21_100100_create_neo4j_sync_triggers`, `2026_09_03_008900_brain_erp_lookup_indexes`, `2026_09_04_100000_add_lms_engagement_indexes`, `2026_09_11_100400_add_platform_services_menu_rows`, `2026_09_05_220000_alter_sub_std_map_for_g2g_lms`, `2026_09_05_230100_create_lms_assignments_table`, `2026_08_20_100800_add_task_management_missing_columns_to_task_table`, `2026_01_01_000000_organization`.

Not reviewed: live database (schema, indexes, engines, row counts, data quality, backups, privileges), the 9 seeder bodies, `database/neo4j/*`, the Neo4j side, query plans.

---



### Part 12 - Uploads / Import-Export / Notifications / Jobs / Integrations

## 1. Scope & coverage

| Area/dir | Files in scope | Read fully | Skimmed | Not reviewed | Notes |
|---|---|---|---|---|---|
| Laravel upload / write-to-disk sites (`->move(`, `storeAs(`, `Storage::put`, `putFileAs`, `file_put_contents`) | 296 raw grep hits in 141 files; 202 real upload/write sites in ~100 controller files after removing `app/Console`, `app/Domain` store() name collisions and comments | ~30 controllers (all high-risk ones) | ~70 (by targeted context extraction: 28 lines before each site for validation/filename/route) | `result_master`/`result_book_master` logos, `hostel_master`, `add_driver`, `book_list` internals (pattern identical, verified by grep only) | Route tier resolved per route file and group (RouteServiceProvider + each `routes/*.php`). |
| `config/filesystems.php`, `public/.htaccess`, `.gitignore` | 3 | 3 | - | Live web-server config (nginx/Apache PHP-in-`/storage` handler) | `NOT VERIFIED` - REASON: server config not in repo. |
| Standalone PHP under `public/` (`excel_upload/*.php`, `*_integration.php`, `getworkflow.php`, `123.php`...) | 30+ | 10 (`excel_upload/ajax.php`, `db.php`, `export_xlsx.php`, `map_student_document_data.php`, `bulk_question_data.php`, heads of the other bulk scripts) | 15 | `public/library/*`, vendored PHPExcel/`auth/vendor` | part10 (BE-06 (LMS-AUDIT-015)) covered the credential/`$_REQUEST` census; this report adds the import scripts. |
| Import controllers (API + web + standalone + Maatwebsite) | 14 | 9 | 5 | - | `ImportApiController`, `Import\ImportController`, `fees_reconciliation_upload_sheet_controller`, `bulkUploadSheetController`, `studentBulkUpdateController`, `LeaveImport`, `BulkTaskController`, `G2gLms\GovernanceController`, `AssignmentsController`, `MigrationModulesApiController::bazarUpload`, NACH S2/S4 (see FIN-38 (LMS-AUDIT-125)), `public/excel_upload/*`. |
| Export code (PDF/Excel/CSV) | Laravel 16 dompdf call sites, 2 `Excel::download`, 2 `fputcsv`, 6 wkhtmltopdf helpers, NACH S1/S3; frontend `lib/table-export.ts` + 20 own `new Blob(` exporters + 7 jsPDF/html2canvas files | 12 | 20 | jsPDF layout internals | |
| Notifications (SMS / e-mail / WhatsApp / FCM / in-app) | `app/Mail` (3), `app/Notifications` (0 - dir does not exist), `Helper.php` senders, 11 copies of `sendSMS`, `WhatsappController`, `easy_com` (web 6 + api 14), 22 controllers calling `send_FCM_Notification`, `api/Platform/NotificationController`, `config/platform_services.php` | 14 | 25 | e-mail/SMS Blade views, mobile-app notification list endpoints | |
| Jobs / Events / Listeners / Observers / Scheduler / Commands | `app/Jobs` (4), `app/Events` (1), `app/Listeners` (1), `app/Observers` (0 - dir does not exist), `app/Console` (91 files), `Kernel.php`, `routes/console.php`, `config/queue.php`, `EventServiceProvider` | Kernel, routes/console, queue config, 4 jobs (headers), listener, 8 commands | remaining ~80 commands (signature list + guard grep) | body of the 15 `SyncONet*` commands (identical template; credential lines grepped) | |
| Third-party integrations | 60+ env keys, 45 outbound hosts, `config/{services,ai,claude,deepseek,gemini,openrouter,gamma,neo4j,mcp,mobile_page_builder,platform_services}.php`, ~12 integration classes | 12 | 25 | live provider dashboards, webhooks configured at providers, real env values | Every env value is `NOT VERIFIED` (rule 2). |
| Frontend (Next) | `app/layout.tsx`, `next.config.ts`, `lib/table-export.ts`, `components/ui/file-upload.tsx`, `app/import-data/page.tsx`, `app/api/{import/*,proxy-file,integration-configs,google-auth}`, 69 `type="file"` inputs, 85 CSV/XLS download files | 9 | 60 | individual upload pages' business logic (other agents) | |
| **Totals** | ~450 files touched | ~90 read fully | ~200 skimmed by targeted extraction | see notes | 0 files modified except this report |

Unreviewed and why: (a) live web-server/PHP handler config (repo has none); (b) provider-side webhook settings; (c) the 12 one-off `next:*` tenant-257 commands beyond their header/`where` clauses; (d) the mobile-app consumption of `app_notification` rows.

---


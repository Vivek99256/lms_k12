# Part 03 — Infrastructure, configuration, dependencies, DevOps, tests, docs, code-quality sweeps

Repository: `D:\lms_k12` (Next.js 16.2.6 / React 19.2.4), branch `student_workflow`, HEAD `771e660` (2026-09-29).
Auditor scope: Phases 18-22 plus repository-wide secret and second-pass sweeps. Read-only. Commands actually run:
`npm test`, `npx tsc --noEmit --incremental false`, `npx eslint . -f json`, `git grep`/`git ls-files`/`git log` (local only), small
Node scripts (import scan, near-duplicate scan). Nothing was built or served. `.env` and `.env.local` were **not opened**.
Live env values are `NOT VERIFIED`.

Headline results (all measured this session):

| Check | Result |
|---|---|
| `npm test` (`lib/**/*.test.ts packages/**/*.test.ts`) | 557 tests, **555 pass, 2 fail**, 0 skipped, 3.1 s. Exit code non-zero. |
| `npx tsc --noEmit --incremental false` | **1 error**: `app/pal/diagnostic/chapter/[chapterId]/page.tsx(6,68) TS2307 Cannot find module 'framer-motion'`. The package is declared in `package.json` and `package-lock.json`. It is missing from the local `node_modules`, so this is stale-install drift and not a code defect. Everything else type-checks under `strict: true`. |
| `npx eslint .` (ran ~5 min, full repo) | 3,124 files linted. **783 errors / 691 warnings** in total. In tracked application source (`main`): **494 errors / 290 warnings in 227 files (157 files have errors)**. The rest comes from `.kilo/worktrees/paint-chevre` (277 E / 281 W, 901 files) and `K-12 ERP Design System` (12 E / 120 W, 152 files). |
| Secrets in tracked files | No API keys, JWTs, bearer tokens, private keys or credentialed URLs found. Real personal data is committed (see INFRA-03). |
| CI/CD, Docker, monitoring, health checks | None exist. |

---

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

## 2. Module inventory (infra/config scope)

| Module | Backend (Next api / config) | Frontend pages/components | DB tables | API endpoints | Permissions/roles | Menu entry | Status |
|---|---|---|---|---|---|---|---|
| Environment/base-URL resolution | `app/components/utils/api_url.tsx`; 22 route files re-implement the same logic with `NODE_ENV` | every client fetch | n/a | n/a | n/a | n/a | Partially complete (two divergent selection rules, INFRA-06) |
| Build identity and stale-client purge | `next.config.ts` (`generateBuildId`, `env.NEXT_PUBLIC_APP_BUILD_ID`); `lib/app-version.ts`; `contexts/AuthContext.tsx` | none | n/a | n/a | n/a | n/a | Complete, with design concerns (INFRA-15) |
| Google sign-in | `app/api/google-auth/route.ts` | `app/login/page.tsx` | n/a | POST `/api/google-auth` | public | login | **Broken** (env var not exposed to browser, INFRA-05) |
| Agents (v1 file store) | `app/api/agents/**`, `lib/agents/*`, `.data/agents.json` | AI-stack automations tab | JSON file | 4 routes | Laravel `/api/permissions` with client-chosen base URL | AI stack | **Broken authz** (INFRA-02) |
| Conversational-AI admin | `app/api/conversational-ai/**`, `lib/ai/conversational-admin/*`, `.data/conversational-ai.json` | `app/enterprise-brain/automation/conversational-ai` | JSON file | 3 routes | same | Enterprise Brain | **Broken authz** (INFRA-02) |
| `packages/*` "workspace" | tsconfig `paths` only | 8 importers | n/a | n/a | n/a | n/a | Partially complete: no `package.json`, no `workspaces`, `conversational-ai-core/src/file-store.ts` is dead code |
| Test harness | `node --import tsx --test` | n/a | n/a | n/a | n/a | n/a | Partially complete (lib-only, 2 red) |
| CI/CD | `.github/workflows/` (empty dir, not even tracked) | n/a | n/a | n/a | n/a | n/a | **Missing** |
| Containerisation | none | n/a | n/a | n/a | n/a | n/a | **Missing** |
| Observability (errors, health, metrics) | none (no Sentry/OTel, no `/health`, no `error.tsx`/`global-error.tsx`) | `app/not-found.tsx` (1), `app/career-intelligence/loading.tsx` (1) | n/a | `/api/mcp/health` (only MCP) | n/a | n/a | **Missing** |
| Documentation set | 25 md files | n/a | n/a | n/a | n/a | n/a | Partially complete, several stale/contradicting (INFRA-17/18) |
| Agent-tool state committed to git | `.kilo/`, `.codex/`, `.claude/`, `diff_frontend.txt`, `.tsc-check2.log` | n/a | n/a | n/a | n/a | n/a | **Should not exist** (INFRA-03/22) |
| Code generation | `scripts/generate-module-screens.mts` produces `app/_lib/module-screens.generated.ts` (538 lines, 517 entries, 0 dangling imports) | category tabs | n/a | n/a | n/a | n/a | Complete; 160 of 677 `page.tsx` are not in the map (by design per script header); no npm script or CI step to regenerate |

---

## 3. Role / access-control findings (infra-level)

- **No `middleware.ts`/`proxy.ts`**. Confirmed by `git ls-files`. Nothing at the Next edge or server gates page routes. The `app/hooks/usePermission.ts` source says its own hook is "advisory".
- **Next route handlers have no uniform auth layer.** Route handlers are thin proxies. Some check for a token header, many only forward it. Enforcement is delegated to Laravel. `lib/agents/acting-user.ts` calls Laravel `/api/permissions` on a base URL the caller chooses (INFRA-01/02).
- Heuristic per-file auth check (own-file grep only, `NOT VERIFIED` for shared helpers): routes with **no visible token check and no shared-proxy helper**: `agents/*` (4), `conversational-ai/*` (3, they only require a non-empty token string), `forgot-password`, `google-auth` (public by nature), `import/match-fields`, `import/tables`, `modules/menu-categories*` (2), `pal/content-model`, `pal/pedagogy-engine`, `process/convert` (**no auth at all**, calls a paid LLM), `screenCandidate` (**no auth at all**, calls 3 paid LLM providers).
- Client role logic: `user_profile_id` appears in 36 files (80 hits), `user_profile_name` in 63 files (140), `is_admin|isAdmin` in 25 files (66). Role names are compared client-side as strings (`app/dashboard/_lib/resolveDashboardRole.ts:3-5` per `docs/teacher_role_audit.md`). Server enforcement lives in Laravel and is outside this part.

## 4. Tenant / school / academic-year scoping findings (infra-level)

- Tenant (`sub_institute_id`) and year (`syear`) are **client-supplied everywhere**: `sub_institute_id` in 251 files (653 hits), `subInstituteId` in 232 files (696), `syear` in 256 files (779). 29 files set `x-laravel-token`, `x-sub-institute-id` and `x-user-id` headers that the 20+ Next route proxies copy into Laravel request bodies (for example `app/api/dashboard/admin/route.ts:42-70`: `sub_institute_id: subInstituteId, syear: academicYearId, user_id: userId` taken straight from headers).
- Whether Laravel re-derives the tenant from the JWT is `NOT VERIFIED` here (`docs/admin-user-journey.md` and `app/api/dashboard/admin/route.ts` header comment say "the JWT alone decides the caller's role", which supports it, but it was not traced).
- **Local tenant-keyed stores trust the header tenant with no token binding**: `lib/agents/store.ts` keys agents and runs by `actor.tenant_id`, which `readRequestSession` reads from `x-sub-institute-id` (`lib/agents/acting-user.ts:38-46`). `listAgents`/`listRuns` only call `requireActor` (non-empty strings), so any caller can read any tenant's agent definitions and run logs (INFRA-02). The tenant-isolation unit test (`lib/agents/engine.test.ts`, "tenants are isolated") tests the store filter and not a real session.
- Hard-coded tenant/year literals: none material (`app/course-master/[courseId]/chapters/sideDrawer.tsx:866` `let sub_institute_id = 0` is a local default). Good.

---

## 5. API endpoints, environment and dependency tables

### 5.1 Next route handlers exposed (67 `route.ts`), full list

Heuristic columns from grepping each file. "Base" is where the upstream host comes from. `CLIENT-HEADER` means the browser can choose it (INFRA-01).

| Route (`/api/...`) | Methods | Base URL source | Token seen in file | Notes |
|---|---|---|---|---|
| admissions/dashboard/summary | POST | CLIENT-HEADER | yes | |
| agents | GET, POST | (Laravel via `laravelAuthorizer`, header base) | shared helper | INFRA-02 |
| agents/[id] | PATCH | same | shared | INFRA-02 |
| agents/[id]/run | POST | same | shared | runs tools; INFRA-02 |
| agents/runs | GET | same | **none** | cross-tenant read, INFRA-02 |
| ai/ask/stream | POST | `API_BASE_URL`/`AI_UPSTREAM_BASE_URL` | yes | SSE proxy |
| ai/assistance-tickets | POST | AI base | yes | |
| ai/field-edit | POST | AI base (`resolveAiBaseUrl`) | yes | now proxies Laravel `/api/ai/generate` (docs say local, INFRA-18) |
| conversational-ai/projects | GET | header base | non-empty token only | |
| conversational-ai/projects/[id]/settings | PUT | header base | non-empty token only | INFRA-02 |
| conversational-ai/projects/[id]/token | POST | header base | non-empty token only | mints a service token, INFRA-02 |
| dashboard/admin, student, teacher, teacher-fee-dues, teacher-icard, teacher-timetable | POST (6) | CLIENT-HEADER | yes | |
| fees/dashboard/summary | POST | CLIENT-HEADER | yes | |
| fees/menu-categories | GET | CLIENT-HEADER | yes | |
| fees/online-payment/[gateway] | POST | `API_BASE_URL` | yes | Razorpay flow |
| fees/online-payments, audit-logs, receipt-reprint, reconciliation-status | GET (4) | via `proxyFeesReportGet` (CLIENT-HEADER) | shared | 7-line wrappers |
| fees/reports/* (datewise-summary, fees-title, fees-cancel, fees-collection(+create), fees-defaulter, fees-structure, fees-type-wise/create, other-fees(+create, ledger), other-fees-cancel(+create), student-breakoff(+create)) | GET/POST (16 files) | via `fees-report-proxy.ts:31` CLIENT-HEADER | shared | |
| forgot-password | POST | CLIENT-HEADER | none (public) | **anonymous SSRF**, INFRA-01 |
| google-auth | POST | CLIENT-HEADER | none (public) | **anonymous SSRF**, INFRA-01 |
| hostel/dashboard/summary, library/dashboard/summary, students/dashboard/summary, transportation/dashboard/summary | POST (4) | CLIENT-HEADER | yes | |
| import/match-fields, import/tables | POST / GET | `API_BASE_URL` | **no Authorization forwarded** | thin proxy; Laravel decides |
| import/parse, import/process | POST | `API_BASE_URL` | yes | multipart proxy |
| integration-configs, [id], test | GET/POST/PUT/DELETE | Laravel | yes | |
| library/books-list | GET | `API_BASE_URL` | yes | |
| mcp/capabilities, mcp/health, mcp/tools/call | GET/GET/POST | Laravel | yes | |
| modules/menu-categories, modules/menu-categories/registry | GET | via `laravel-category-proxy.ts:55` CLIENT-HEADER | shared | |
| pal/content-model, pal/pedagogy-engine | GET | server-side | none | `pal/content-model` is fetched back by server components using the request `Host` header (INFRA-23) |
| pal/submit | POST | CLIENT-HEADER (`x-laravel-base-url`) | yes | |
| process/convert | POST | Gemini via `@ai-sdk/google` | **none** | INFRA-09 |
| proxy, proxy-file | GET,POST,PUT,PATCH,DELETE / POST | `API_BASE_URL` (fixed) | forwards Authorization+Cookie | generic passthrough for any `path=` |
| question-paper/asset | GET | env `QUESTION_ASSET_ORIGINS` allow-list | yes | origin-allow-list logic is unit tested (`lib/question-paper/images.test.ts`) |
| screenCandidate | POST | DeepSeek / OpenRouter / Gemini direct | **none** | INFRA-09 |
| teach-learn/menu-categories | GET | CLIENT-HEADER | yes | |

### 5.2 Environment variable inventory (code vs `.env.example`)

`.env.example` documents 9 names. Code reads 23. `.env`/`.env.local` contents are NOT VERIFIED. Both are untracked and ignored: `git check-ignore -v` returns `.gitignore:34:.env*` for both, and `git ls-files` lists only `.env.example`.

| Variable | Used in | In `.env.example` | Client-exposed | Notes |
|---|---|---|---|---|
| `NEXT_PUBLIC_API_BASE_URL_DEV` | `app/components/utils/api_url.tsx` plus 21 other files | yes (`http://127.0.0.1:8000`) | yes | |
| `NEXT_PUBLIC_API_BASE_URL_PROD` | same 22 files | yes (`https://erp.triz.co.in`) | yes | production hostname in the example |
| `NEXT_PUBLIC_ERP_BASE_URL` | `lib/erp-client.ts:56` | yes (`https://erp.triz.co.in`) | yes | |
| `NEXT_PUBLIC_AI_BASE_URL` | `api_url.tsx:74,85` | commented example (`https://dev.triz.co.in`) | yes | |
| `AI_UPSTREAM_BASE_URL` | `app/api/ai/ask/stream/route.ts` | commented | no | |
| `GOOGLE_GENERATIVE_AI_API_KEY`, `GEMINI_API_KEY` (fallback), `GEMINI_MODEL` | `lib/ai/local-model.ts` (used only by `app/api/process/convert`); `GEMINI_API_KEY` also `screenCandidate` | yes | no | doc says field-edit uses it. It does not any more (INFRA-18) |
| `OPENROUTER_API_KEY`, `SCREENING_DEEPSEEK_API_KEY` | `app/api/screenCandidate/route.ts` | yes | no | |
| **`NEXT_GOOGLE_CLIENT_ID`** | `app/login/page.tsx:32` (a `'use client'` file) | **no** | **no (no `NEXT_PUBLIC_` prefix)** | always empty in the browser (INFRA-05) |
| `NEXT_PUBLIC_BRAIN_API_BASE_URL` | `lib/brain/api.ts:19` | no | yes | undocumented |
| `NEXT_PUBLIC_SHOW_INTERNAL_ROADMAP` | `lib/roadmap/index.ts:220` | no | yes | undocumented |
| `QUESTION_ASSET_ORIGINS` | `app/api/question-paper/asset/route.ts` | no | no | undocumented allow-list |
| `AGENTS_STORE_PATH` | `lib/agents/store.ts:201` | no | no | default `./.data/agents.json` |
| `CONVERSATIONAL_AI_STORE_PATH` | `lib/ai/conversational-admin/store.ts` | no | no | default `./.data/conversational-ai.json` |
| `CONVERSATIONAL_AI_STATE_DIR` | `packages/conversational-ai-core/src/file-store.ts:13` (dead code) | no | no | default `./.kilo/conversational-ai` (the committed dir, INFRA-03) |
| `AI_PROJECT_ID` | `lib/ai/project-resolver.ts` | no | no | undocumented |
| `VERCEL_GIT_COMMIT_SHA`, `GITHUB_SHA`, `CI_COMMIT_SHA` | `next.config.ts` | no (fine) | build only | build id |
| `NEXT_PUBLIC_APP_BUILD_ID` | injected by `next.config.ts`; read in `lib/app-version.ts:36` | n/a (derived) | yes | |
| `NODE_ENV` | 23 files | n/a | | |

Documented but unused: none. Used but undocumented: 8 (`NEXT_GOOGLE_CLIENT_ID`, `NEXT_PUBLIC_BRAIN_API_BASE_URL`, `NEXT_PUBLIC_SHOW_INTERNAL_ROADMAP`, `QUESTION_ASSET_ORIGINS`, `AGENTS_STORE_PATH`, `CONVERSATIONAL_AI_STORE_PATH`, `CONVERSATIONAL_AI_STATE_DIR`, `AI_PROJECT_ID`).

Hardcoded hosts in source (excluding tests/docs): `https://erp.triz.co.in` (help-guide PDF `app/fees/help-guide-support/_components/help-guide-grid.tsx:30`), `https://crm.triz.co.in` (same file:69), `http://apps.triz.co.in/excel_upload/export_xlsx.php` (`app/general/implementation_management/ImplementationManagementPage.tsx:94,103`, plain HTTP), `https://n8n.triz.co.in/...` (2 webhooks), `https://s3-triz.fra1.digitaloceanspaces.com/public/...` (`app/organization-management/employee-directory/components/edit-employee/upload-doc-tab.tsx:144`, `app/sqaa/_lib/api.ts:168`), `https://skill-ontology-neo4j.vercel.app` (`taxonomy-ontology.tsx:38`, embedded external app). Comments name `dev.triz.co.in` in `app/api/forgot-password/route.ts:15`, `app/exam/data/onlineExam.ts:283`, `app/h5p/data/question-bank-library.ts:103`. No IP addresses in source. IP `202.47.117.220` appears only in `docs/enterprise-brain/INTEGRATION_AUDIT.md:77,318`.

### 5.3 Dependency table (`package.json`, 56 deps + 9 devDeps; lock v3, 953 packages)

Method: script scanned every tracked `ts/tsx/mts/js/jsx/css` outside `K-12 ERP Design System`, `.kilo`, `.codex` for import specifiers.

| Finding | Detail |
|---|---|
| **Declared, never imported** | `geist` (fonts come from `next/font/google` in `app/layout.tsx:2`), `uuid`, `@tiptap/extension-image` (no importer), `@tiptap/pm` (legitimate peer of tiptap, keep) |
| **Imported, not declared (phantom)** | `@radix-ui/react-slot` in `components/ui/g2g/button.tsx:11` (resolves only via hoisting from other radix packages, lock has 1.3.3) |
| **`shadcn` in `dependencies`** | only referenced by `@import "shadcn/tailwind.css"` (`app/globals.css:3`). It is a CLI that pulls in `execa`, `open`, `commander`, etc. Belongs in `devDependencies` alongside `tailwindcss` and `tw-animate-css` |
| Duplicate chart libraries | `chart.js` + `react-chartjs-2` (15 files) and `recharts` (6 files: `app/hrit/leave-management/**`, `compliance-dashboard.tsx`, `StudentReportModule.tsx`, `search_student/page.tsx`) |
| Two headless-UI stacks | `@base-ui/react` (7 files) plus 5 `@radix-ui/*` packages (1-2 files each) plus local `components/ui/g2g/*` |
| Barely used | `react-hook-form` (1 file), `@hookform/resolvers` (1), `react-day-picker` (1), `@dnd-kit/*` (1 file each), `katex` (1), `zod` (4 files: but see `lib/agents`, `process/convert`) |
| PDF path | `jspdf` 4.2.1 + `html2canvas-pro` 2.4.4: 4 client-side DOM-to-canvas-to-PDF flows (`library-module-utils.ts:97`, `lms/exam/_assessment-blueprint/pdf.tsx:141`, `_question-paper-templates/pdf.tsx:265`, `ChatbotPanel.tsx:516`). Output is raster, text not selectable |
| Sanitiser | `isomorphic-dompurify` 4.3.0 (dompurify 3.4.15) used in only 4 files (`RichText.tsx`, `generated-html.ts`, `h5p_course_presentation/[id]/page.tsx`, `h5p_image_hotspots/[id]/page.tsx`) against 65 `dangerouslySetInnerHTML` sites in 35 files (INFRA-08) |
| AI SDK versions | Installed: `ai` 7.0.111, `@ai-sdk/react` 4.0.114, `@ai-sdk/google` 4.0.77, `@ai-sdk/provider` 4.0.17, `provider-utils` 5.0.45, `gateway` 4.0.89. Mutually consistent as resolved. Ranges are caret across a major-per-package scheme |
| Deprecated in lock | `eslint` 9.39.5 carries `deprecated: "This version is no longer supported"` (only deprecation flag in the lock) |
| Duplicate transitive majors | 35 packages present in 2+ versions (e.g. `commander` 3 versions, `ajv` 6/8, `minimatch` 3/10, `semver` 6/7, `chalk` 4/5), mostly from `shadcn`'s tree |
| No `engines`, `.nvmrc`, `packageManager` | `@types/node ^20` while local Node is v24.18.0 |
| Version pins | `next` 16.2.6, `react`/`react-dom` 19.2.4, `eslint-config-next` 16.2.6 exact; everything else caret |
| Packages/workspace wiring | `packages/ai-intelligence-core/src/*` and `packages/conversational-ai-core/src/*` have **no `package.json`** and root `package.json` has no `workspaces`. Wiring is `tsconfig.json` `paths` only (`@shared/ai-intelligence-core` -> `packages/ai-intelligence-core/src/index.ts`; `@shared/conversational-ai-core/*`). Importers: 7 uses of `@shared/ai-intelligence-core`, 1 of `@shared/conversational-ai-core/followup-suggestions`. `npm test`'s `packages/**/*.test.ts` glob matches **zero** files |
| `npm audit` / CVE check | NOT VERIFIED — REASON: requires network (forbidden) |

### 5.4 Config file review

- `next.config.ts`: sets `turbopack.root`, `env.NEXT_PUBLIC_APP_BUILD_ID`, `generateBuildId`, 4 rewrites (`/admission-enquiry`->`/admission-Enquiry`, `/admission-registration`, `/admission-confirmation`, `/course-master/lesson-plan/:courseId/assessment`). **Absent**: `headers()` (no CSP, X-Frame-Options, HSTS, Referrer-Policy, Permissions-Policy, X-Content-Type-Options), `poweredByHeader: false`, `images` config, `output: 'standalone'`, `reactStrictMode`, `compress`, bundle analyser, `eslint`/`typescript` build settings (fine, defaults). `execSync('git rev-parse HEAD')` runs at config load (fallback `build-${Date.now()}`).
- `app/layout.tsx:7` `export const dynamic = 'force-dynamic'` at the root layout: opts every route out of static rendering/caching (INFRA-24).
- `tsconfig.json`: `strict: true`, `target: ES2017`, `incremental: true` (writes `tsconfig.tsbuildinfo`, gitignored), `include: ["**/*.ts","**/*.tsx","**/*.mts",...]`, `exclude: ["node_modules"]` only. It therefore picks up `K-12 ERP Design System/**` (71 `.ts` + `.d.ts`) and is **not** scoped away from `AUDIT/`, `.kilo/`, `g2g/`. tsc reported no errors from them (TypeScript normally skips dot-directories under `**`, so `.kilo/worktrees` is probably not typechecked: not verified).
- `eslint.config.mjs`: extends `next/core-web-vitals` + `next/typescript`; ignores only `.next/**`, `out/**`, `build/**`, `next-env.d.ts`. **Does not ignore** `.kilo/**` (nested git worktree with 901 lintable files), `K-12 ERP Design System/**`, `AUDIT/**`, `g2g/**`, `scripts/`.
- `components.json`: shadcn `base-nova`, aliases `@/components`, `@/lib`, `@/hooks`; consistent with tsconfig `@/*`.
- `postcss.config.mjs`: only `@tailwindcss/postcss`. Fine.
- `.gitignore`: ignores `/node_modules`, `.next`, `.env*` (opting `.env.example` back in), `*.tsbuildinfo`, `next-env.d.ts`, `*.code-workspace`, `/.data/`, `.vercel`, `*.pem`. **Gaps**: `.kilo/`, `.codex/`, `.claude/settings.local.json`, `.agents/`, `*.log`, `diff_*.txt`, `/AUDIT` not ignored. `.tsc-check2.log` and `diff_frontend.txt` are already tracked.
- Local-only: `.next` is 9.3 GB in the working dir (ignored). `tsconfig.tsbuildinfo` 788 KB and `tsconfig.scoped.tsbuildinfo` 594 KB are ignored (verified not tracked).

---

## 6. Business-logic notes (infra flows)

**6.1 Base-URL selection (client)**: `api_url.tsx:20-47`.
Input: `window.location.hostname` (browser) or `NODE_ENV` (server render). Rule: `hostname` in {`localhost`, `127.0.0.1`, `192.168.*`, `10.0.*`, `*.local`, `*.test`, `172.16-31.*`} is DEV, anything else is PROD. Result: module-level constants `API_BASE_URL`, `AI_API_BASE_URL`, `AI_API_BASE_URL_OVERRIDE`. If empty, `console.error("API_BASE_URL is not defined...")` at import and continue (also printed during `npm test`).
Divergence: the 22 server route files use `NODE_ENV === 'production' ? PROD : DEV`. On `next start` at `localhost` the browser uses DEV and the server proxies use PROD. Any staging host (`dev.triz.co.in`) or on-prem `10.1.x`/`10.x` hosts (only `10.0.` matches) is treated as PROD. `NEXT_PUBLIC_*` values are inlined at build time, so a single build cannot be promoted across environments by env alone (the hostname switch masks this).

**6.2 Build id and stale-client purge**: `next.config.ts` resolves `VERCEL_GIT_COMMIT_SHA || GITHUB_SHA || CI_COMMIT_SHA` (12 chars) else `git rev-parse HEAD` else `build-${Date.now()}`; it becomes both Next's `buildId` and `NEXT_PUBLIC_APP_BUILD_ID`. `AuthContext` calls `syncAppBuild()` once per page load: if stored `appBuildId` differs from the compiled one and is non-null, it runs `purgeClientState()` (clears localStorage, sessionStorage, all JS-visible cookies, Cache Storage, service workers), records the new id, `window.location.reload()`. Session state (`userData` with the bearer token, `menuContext`, `authUser`) lives in that same localStorage (`AuthContext.tsx:40,171-197`), so **every deploy signs every returning user out and discards unsaved client drafts**. There is no polling, so an already-open tab keeps running the old bundle until the next full load. Side effects are only client-side.

**6.3 Agents and conversational-AI admin**: Input (headers `x-laravel-base-url`, `x-laravel-token`, `x-sub-institute-id`, `x-user-id`...) -> `readRequestSession` -> `laravelAuthorizer` calls `${baseUrl}/api/permissions?modules=<key>` -> `flags[action] === true` -> local JSON store write (`.data/agents.json`, in-memory `this.data` plus temp-file `rename`) -> output. Reads (`listAgents`, `listRuns`) skip the authorizer entirely.

**6.4 Test pipeline**: `npm test` -> `node --import tsx --test "lib/**/*.test.ts" "packages/**/*.test.ts"` (`tsx` resolves the `@/*` and `@shared/*` paths). `package.json` also defines `typecheck` (`tsc --noEmit`) and `lint` (`eslint`). No pre-commit hook (`.husky` absent), no CI, so none of the three is enforced anywhere.

---

## 7. Test / documentation coverage

### 7.1 Test inventory (42 files, all under `lib/`, 557 tests; glob covers all 42)

`node -e "fs.globSync([...])"` returns 42 for the `npm test` globs, so nothing is orphaned. Zero test files exist under `app/`, `components/`, `hooks/`, `contexts/`, `packages/`. No `jest`/`vitest`/`@testing-library`/`playwright` in `package.json`. No jsdom, so no component tests. No coverage tool. `git grep` for `test|__tests__|e2e|playwright|vitest` outside these 42 finds only the route `app/api/integration-configs/test/route.ts`.

| Directory | Files (tests) | What they pin |
|---|---|---|
| `lib/agents` | `engine.test.ts` (11), `registry.test.ts` (8) | agent RBAC via a stubbed authorizer, tool allow-lists, run logging, per-tenant store filter |
| `lib/ai` | `ai-capabilities.test.ts` (10, **2 fail**), `conversational-admin/service.test.ts` (8) | capability registry vs roadmap; service-token hashing and fail-closed auth |
| `lib/brain` | `fees-intelligence` (8), `intelligence-navigation` (6), `intelligence-tone` (3), `module-navigation` (23), `navigation` (7) | tenant/year headers on fees-intelligence requests, navigation mapping |
| `lib/h5p` | 11 files (about 190 tests) | scoring and runtime for each H5P type, question-bank to H5P mapping |
| `lib/intelligence` | `ask-adapter` (31), `ask-stream` (15), `module-handoff` (16), `row-action` (4), `sse` (8), `ui-messages` (12) | Laravel SSE to AI SDK stream conversion and rendering adapter |
| `lib/pal` | `diagnostic-answers` (6), `exam-answers` (15) | answer submission payload shaping |
| `lib/platform` | `cron.test.ts` (9) | cron next-run math |
| `lib/process` | `conversion.test.ts` (43) | SOP text to workflow parser |
| `lib/question-paper` | 6 files (about 50 tests) | numbering, pagination, sections, types, images (origin allow-list) |
| `lib/roadmap` | `catalog.test.ts` (11) | roadmap registry |
| `lib/chatbot-storage`, `lib/video-embed` | 7 + 8 | client storage, embed URL parsing |

Failing tests (real drift, not flakiness), from `npm test`:
1. `lib/ai/ai-capabilities.test.ts:59` "a capability that cites a roadmap row agrees with it": `ai.providers says "live" while the roadmap says "coming-soon"`. Source: `packages/ai-intelligence-core/src/registry.ts:101-124` (`status: 'live'`, `roadmapId: 'ai.gateway'`) vs `lib/roadmap/registry.ts:765-771` (`id: 'ai.gateway'`, `status: 'coming-soon'`, `audience: 'customer'`, a customer-visible label).
2. `lib/ai/ai-capabilities.test.ts:113` "a live capability points at a real screen": `ai.providers is marked live but has no screen to open`. The registry entry has no `href` although `/ai/providers` exists (`app/_lib/module-screens.generated.ts:66`).

### 7.2 Critical Flow Test Coverage Matrix

Legend: PRESENT = automated tests exercise the logic; PARTIAL = adjacent logic only; NONE = no test of any kind (no unit, component, API-route or E2E test).

| # | Critical flow | Code location (frontend) | Tests present? | What is covered / gap |
|---|---|---|---|---|
| 1 | Login / session (`/api/api-login`, session persistence, inactivity, daily reset) | `contexts/AuthContext.tsx`, `app/login/page.tsx` | **NONE** | Nothing. `lib/chatbot-storage.test.ts` only touches chat storage |
| 2 | Google sign-in | `app/login/page.tsx`, `app/api/google-auth/route.ts` | **NONE** | Nothing; also broken by env misconfig (INFRA-05) |
| 3 | Fee collection (`app/fees/collect`, 2,440 LOC) | `app/fees/collect/page.tsx`, `lib/fees/*` | **NONE** | Receipt calc, concession, cheque, partial pay untested |
| 4 | Online payments / gateway (Razorpay) | `app/fees/online-payment/[gateway]`, `app/api/fees/online-payment/[gateway]` | **NONE** | No signature/verify/reconcile tests |
| 5 | Fees analytics ("fees intelligence") | `lib/brain/*` | PRESENT (partial) | `lib/brain/fees-intelligence.test.ts`: year header on every request, tenant from session, class drill-down, no-session failure. Not the money paths |
| 6 | Admissions (enquiry, registration, confirmation) | `app/admissions/**`, `lib/admissions` | **NONE** | Nothing (the `lib/process/conversion.test.ts` name is SOP conversion, not admissions) |
| 7 | Attendance (student/staff) | `app/attendance`, `app/student/*attendance*`, `lib/attendance` | **NONE** | Reports also print API responses via `console.log` (section 9) |
| 8 | Marks entry / results / report cards | `app/result/**`, `lib/result` (3 files), `app/exam*` | **NONE** | Nothing |
| 9 | Timetable | `app/**/timetable`, `lib/timetable` | **NONE** | Nothing |
| 10 | Payroll / leave (HRIT) | `app/hrit/**` | **NONE** | Nothing; leave charts and attendance reports partly mock-driven |
| 11 | AI assistant (ask stream, SSE, adapter) | `app/api/ai/ask/stream`, `lib/intelligence/*`, `components/intelligence/*` | **PRESENT** | 86 tests over `ask-adapter`, `ask-stream`, `sse`, `ui-messages`, `module-handoff`, `row-action`. Route handler itself untested |
| 12 | AI field-edit / generate | `app/api/ai/field-edit`, `lib/ai/field-edit/*` | **NONE** | No tests for prompt, output cleaning, or the proxy |
| 13 | Agents (create/run/RBAC) | `lib/agents/*`, `app/api/agents/*` | PARTIAL | 19 tests on engine and registry with stub authorizer/store; the **route layer that reads headers is untested** and is where INFRA-02 lives |
| 14 | Conversational-AI service tokens | `lib/ai/conversational-admin/*` | PRESENT (service only) | 8 tests; route auth untested |
| 15 | Import (CSV/Excel) | `app/import-data`, `app/api/import/*` | **NONE** | Nothing |
| 16 | Role/permission gating (`usePermission`, `useMenuRights`, menu mapping) | `app/hooks/*`, `app/data/routeMapper.ts`, `lib/gtg-roles.ts` | PARTIAL | `lib/brain/module-navigation.test.ts` (23) tests navigation resolution, not permission enforcement |
| 17 | Tenant / year scoping | `sub_institute_id` / `syear` in 251/256 files | PARTIAL | Only fees-intelligence headers and agents' in-memory tenant filter. No test proves a route rejects a foreign tenant |
| 18 | H5P / question-bank scoring and playback | `lib/h5p/*`, `app/h5p/**` | **PRESENT** | 11 files, about 190 tests |
| 19 | Question paper (numbering, pagination, images, types) | `lib/question-paper/*` | **PRESENT** | 6 files; asset origin allow-list tested |
| 20 | PAL adaptive learning answers | `lib/pal/*` | PARTIAL | 21 tests on answer payload shaping; diagnostic/ESO pages untested |
| 21 | Scheduler / cron | `lib/platform/cron.ts` | PRESENT | 9 tests |
| 22 | Build id / stale-client purge (`lib/app-version.ts`) | | **NONE** | The purge that clears the session on every deploy is untested |
| 23 | Base-URL/env resolution (`api_url.tsx`) | | **NONE** | Test runs actually log `API_BASE_URL is not defined` |
| 24 | Next route handlers (67) | `app/api/**` | **NONE** (0 of 67) | All proxy and authz logic in routes is untested |
| 25 | UI components / a11y | `components/**` (248 files) | **NONE** | No component test tooling installed |
| 26 | E2E | | **NONE** | no Playwright/Cypress config |

Domain library folders with a single file and no tests: `lib/{admissions,attendance,fees,timetable,exam,exam-assessment,session,students,users,hostel,inventory,library,transport,ptm}` (1 file each), `lib/result` (3).

### 7.3 Documentation verification

| Doc | Verdict | Evidence |
|---|---|---|
| `README.md` (marketing template) | Accurate but nearly empty | Clone URL matches `origin` (`https://github.com/Vivek99256/lms_k12.git`). No env-var list, no backend dependency (Laravel API), no test/lint/typecheck commands, no deployment, no architecture, no roles, no port/`.env.example` mention. "Package Manager npm / yarn / pnpm / bun" is misleading: only `package-lock.json` exists. Uses `capsule-render.vercel.app` remote banner image |
| `CLAUDE.md` (16 KB) | **Misleading for this repo** | Titled "EduERP Design System"; it is a copy of `K-12 ERP Design System/readme.md` (differs only in section order and a `\~` escape). It references root-level `tokens/`, `styles.css`, `SKILL.md`, `ui_kits/`, `_ds_bundle.js`: none exist at the repo root (they live under `K-12 ERP Design System/`). Says type is **Inter/JetBrains Mono** (`app/layout.tsx:2,9-16` uses **Geist/Geist Mono**). Says "74 React components (.jsx)" (the design-system folder has 71 `.jsx` component files; the app's components are 248 `.tsx`). Says nothing about `npm` commands, the Laravel backend, env, tests, architecture. An agent or new dev reading CLAUDE.md gets instructions for a different deliverable |
| `AGENTS.md` (5 lines, `nextjs-agent-rules`) | Accurate, insufficient | Tells agents to read `node_modules/next/dist/docs/` (exists: `01-app`, `02-pages`, `03-architecture`). Depends on `node_modules` being installed. No repo-specific rules |
| `docs/menu-data-source-audit.md` (dated 2026-08-22) | **Partly stale** | Claims: "54 top-level menus" (repo has 87 top-level dirs under `app/`, of which ~10 are non-route helpers such as `api`, `components`, `hooks`, `lib`, `data`, `_lib`, `_components`); "~700 .ts/.tsx files" (actual 1,622 under `app/`); "`app/data/menuItems.ts` is an empty array" (**true**: `menuItems.ts:42` `export const menuItems: MenuItem[] = [];`); static screens (`attendance_dashboard`, `chapters`, `quiz/create`, `subjects*`, `ai-platforms`, `students/{health_medical,discipline,house,student_documents,ICards}`) have 0 network calls (**still true**, verified by grep); orphan files `app/pal/content-model-data.ts`, `mobility-data.ts`, `offboarding-data.ts`, `talent-profile-data.ts` (**no longer exist**); `app/lms/exam/page.tsx` "static student datasets" (`studentOnlineExams` no longer present, `studentChapterProgressData` is now `[]` at line 374); `hrit attendance-reports` "mock arrays" (page now imports only `savedReports` from `report-data.ts`). Internal contradiction: section B says `admin-data.ts` mocks are "actually rendered on the live page" while follow-up 4 says delete `admin-data.ts`. `app/talent-management/administration/components/admin-data.ts` still exists with 1 importer |
| `docs/conversational-ai-architecture.md` | Mostly accurate, one false claim | Retired modules (`conversation.ts`, `planner.ts`, `tools.ts`, `model.ts`, `discovery.ts`) do not exist. `app/api/ai/ask/stream`, `lib/intelligence/ask-adapter.ts`, `ask-stream.ts` exist. **False**: "The only local model use is `lib/ai/local-model.ts`, called by the ... field-edit helper": field-edit no longer calls it (route now proxies `POST /api/ai/generate`, `app/api/ai/field-edit/route.ts:16-40`), `createLocalAiModel` is called only from `app/api/process/convert/route.ts:178`, and `app/api/screenCandidate/route.ts` calls DeepSeek/OpenRouter/Gemini directly |
| `docs/AI_FIELD_ASSISTANT.md:40-50` | **Contradicts code** | Says "There is currently no Laravel endpoint with that narrow contract ... this route deliberately keeps its local generateText". The route header comment says the opposite ("WHAT CHANGED ... `POST /api/ai/generate` is that contract"). Also "any of 24 files" while 49 files reference `AiFieldAssist|FieldAssist|field-edit`. Same stale claim in `.env.example` ("Field editing is the single deliberate exception"), `lib/ai/local-model.ts:3-8`, `lib/ai/field-edit/types.ts:85` |
| `docs/admin-user-journey.md:7`, `teacher-user-journey.md:6`, `*-PROMPT.md` | Stale | "Next.js 15 App Router, 534 `page.tsx` route files across 81 top-level route groups" vs Next **16.2.6**, **677** `page.tsx`, 87 dirs |
| `docs/user-journey/ROLE_BASED_USER_JOURNEY.md:34,190,234` | Sensitive | Names login accounts `kalpesh@triz.co.in` (admin), `teacher@gmail.com`, `student1@gmail.com`. No passwords found |
| `docs/enterprise-brain/INTEGRATION_AUDIT.md` | Contains internal infra details | Developer path `C:\Users\omshivay\Desktop\ADK\...`, prod DB name `vivek_erp`, DB host `202.47.117.220` (lines 77, 224, 309, 318). `vivek_erp` also in `app/enterprise-brain/analytics/page.tsx:46`, `intelligence-loop/page.tsx:47` |
| `packages/ai-intelligence-core/src/registry.ts:228` | Dangling reference | "guard contracts in `packages/conversational-ai-core/src/security.ts`": file does not exist (package holds only `file-store.ts`, `followup-suggestions.ts`) |
| `docs/placeholder-build-plan-status.md` | External reference | Tracks a sheet in `ScholarClone_Fees_Architecture_Tracker.xlsx` that is not in the repo |
| `PAL-V4-Frontend-Change-Map.md` | Spot-checked | `app/h5p/h5p_flashacard`, `h5p_mcq` exist. Session-log style document, not durable docs |
| **Missing docs** | | Install/prereqs (Node version, Laravel backend), env reference (only `.env.example`), deployment/rollback, architecture overview (Next as thin client + Laravel), role/permission model, tenant model (`sub_institute_id`), API proxy conventions, testing guide, contribution guide, security policy, LICENSE, `CODEOWNERS` |

---

## 8. NOT VERIFIED items

| Item | Reason |
|---|---|
| Contents/keys of `.env`, `.env.local` and `.kilo/worktrees/paint-chevre/.env*` | Forbidden to read. Only confirmed untracked/ignored (`git check-ignore -v`). The nested worktree has its own copies (sizes 210 B and 1.6 KB seen in `ls`) |
| Live env values (which of `NEXT_PUBLIC_API_BASE_URL_*`, `NEXT_PUBLIC_AI_BASE_URL` are actually set in production) | No access |
| Production deployment platform, CI provider, hosting (Vercel is only implied by `VERCEL_GIT_COMMIT_SHA`, `public/vercel.svg` (unused create-next-app asset) and the `.vercel` ignore) | No config in repo |
| `npm audit` / known vulnerabilities of 953 lock entries | Network required |
| Whether Laravel re-validates `sub_institute_id`, `syear`, `user_id` against the JWT | Backend trace belongs to other parts |
| Full git-history secret scan | Limited to `git log --all -S`/`-G` for `AIza`, `sk-...` and `.env*`/`*.pem` paths: no hits. Not an entropy scan |
| Whether `.kilo/worktrees/paint-chevre` branch was ever pushed | `git branch -a` shows local branch `paint-chevre`; remote state not checked |
| Line-level review of 2,000+ source files and of 21 narrative docs | Out of scope; see section 1 |
| Behaviour of build (`next build`) and runtime | Forbidden to build/run |
| TypeScript checking of dot-directories (`.kilo/worktrees`) | tsc shows 1 error overall; skip behaviour not confirmed |

---

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
| Real-person emails/phones in tracked files | see INFRA-03 | Emails: `vivekgajera2709@gmail.com`, `rajesh@gmail.com` (`.kilo`), `kalpesh@triz.co.in`, `teacher@gmail.com`, `student1@gmail.com` (`docs/user-journey`). Sample company emails in `app/organization_managment/oragnization_profile/page.tsx:131-498` are demo data. About 20 mobile numbers in `.kilo/**` (example redacted `0992***`, `7655***`, `9876***`), 1 hit in `docs/menu-data-source-audit.md` (sample record) |
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

## 10. ISSUES

## INFRA-01
**Severity:** Critical   **Type:** Confirmed
**Category:** Security
**Module:** Next route-handler proxies (all modules)
**Location:** `app/api/google-auth/route.ts:38`, `app/api/forgot-password/route.ts:42`, `app/api/dashboard/{admin,student,teacher,teacher-fee-dues,teacher-icard,teacher-timetable}/route.ts:42`, `app/api/admissions/dashboard/summary/route.ts:55`, `app/api/fees/dashboard/summary/route.ts:58`, `app/api/fees/menu-categories/route.ts:44`, `app/api/fees/reports/_lib/fees-report-proxy.ts:31`, `app/api/hostel/dashboard/summary/route.ts:50`, `app/api/library/dashboard/summary/route.ts:50`, `app/api/students/dashboard/summary/route.ts:52`, `app/api/teach-learn/menu-categories/route.ts:45`, `app/api/transportation/dashboard/summary/route.ts:50`, `app/api/pal/submit/route.ts:21`, `lib/laravel-category-proxy.ts:55`, `lib/agents/acting-user.ts:39`
**Function/Method:** `POST/GET` handlers, `readRequestSession`
**Problem:** Every one of these server routes builds its upstream URL from the request header `x-laravel-base-url` (falling back to the env default only when the header is empty) and then `fetch`es it server-side. Nothing validates or allow-lists the host. `.env.example` itself says the AI stream route must never read the upstream from the request "a client that could name the upstream could point this route at any host", and `app/api/ai/ask/stream` follows that rule, but these 20+ routes do the opposite.
**Evidence:** `const baseUrl = readHeader(request, 'x-laravel-base-url') || getDefaultBaseUrl();` then `fetch(\`${baseUrl}${LARAVEL_PATH}\`, ...)` (`google-auth/route.ts:38,73`). `google-auth` and `forgot-password` need no token. The handler returns the upstream JSON verbatim, or for non-JSON a 500-character `preview` plus `backend_status` and `content_type` (`google-auth/route.ts:96-104`). Authenticated variants also forward the caller's `Authorization: Bearer` and `Cookie` to the chosen host.
**Impact:** Anonymous server-side request forgery with reflected response: reach cloud metadata (`169.254.169.254`), internal Laravel/DB admin ports, or any localhost service from the Next server, and read JSON bodies or the first 500 chars of any HTML/text. Any user's bearer token and cookies are exfiltrated if an attacker can make that user's browser send a crafted header (for example via an XSS, see INFRA-08). Also a redirect-blocked but open relay for port scanning.
**Expected Behavior:** The upstream is server configuration only (`NEXT_PUBLIC_API_BASE_URL_*` / `AI_UPSTREAM_BASE_URL`), or a strict allow-list of origins.
**Recommended Fix:** Delete the `x-laravel-base-url` read from all routes and from `lib/agents/acting-user.ts`. Centralise one `getUpstreamBase()` helper (this also removes the 18 duplicated `getDefaultBaseUrl`, `readHeader`, `summarizeHtml`). If multi-host is genuinely needed, compare the header origin to an env allow-list (as `lib/question-paper/images.ts` `isAllowedAssetUrl` already does). Stop returning upstream text previews to callers.
**Verification:** `curl -X POST /api/google-auth -H 'x-laravel-base-url: http://127.0.0.1:9999' -d '{"credential":"x"}'` should be refused (400) and never open a socket to that host. Add a route-level unit test.

## INFRA-02
**Severity:** Critical   **Type:** Confirmed
**Category:** Authorization
**Module:** Agents (`/api/agents*`), Conversational-AI admin (`/api/conversational-ai/*`)
**Location:** `lib/agents/acting-user.ts:38-46,64-99`, `lib/agents/engine.ts:67-80` (`requireActor`, `listAgents`, `listRuns`), `app/api/agents/_lib/handler.ts:16-28`, `app/api/agents/route.ts:11-19`, `app/api/agents/runs/route.ts`, `app/api/conversational-ai/_lib/handler.ts:16-24`
**Function/Method:** `readRequestSession`, `laravelAuthorizer`, `listAgents`, `listRuns`, `adminContextFor`
**Problem:** (a) Read endpoints perform no authentication at all: `listAgents` and `listRuns` call only `requireActor`, which checks that `tenant_id` and `user_id` strings (read from `x-sub-institute-id` and `x-user-id` headers) are non-empty. No token is verified. (b) Write and run endpoints "authorize" by calling `${session.baseUrl}/api/permissions` where `baseUrl` comes from the client's `x-laravel-base-url` header (INFRA-01). An attacker points it at their own server that returns `{status_code:1, data:{"agents.fees":{"create":true,"update":true}}}`, and the "Laravel" check passes. (c) `adminContextFor` only requires `session.token` to be non-empty, then uses the same header-controlled authorizer.
**Evidence:** `readRequestSession`: `baseUrl: (header(request,'x-laravel-base-url') || defaultBaseUrl())`, `tenant_id: header(request,'x-sub-institute-id')`. `engine.ts:72-75`: `requireActor(context.actor); return context.store.listAgents(context.actor.tenant_id, filter);`. The file-header comment claims "RIGHTS are asked of Laravel ... this call is the enforcement, and it FAILS CLOSED", which fails only for genuine network errors.
**Impact:** Unauthenticated cross-tenant disclosure of every agent definition and run log (run logs store tool input and output, `lib/agents/engine.test.ts` "a successful run logs module, tenant, the real caller, input and output"). Forged authorization allows creating/editing/activating agents in any tenant and running their tools. Forged conversational-AI admin authorisation allows changing project settings and calling `POST /api/conversational-ai/projects/[id]/token`, which rotates and returns a service token that authenticates external AI projects (`lib/ai/conversational-admin/service-token.ts`).
**Expected Behavior:** Identity and tenant derived from a verified JWT (or a Laravel call to a fixed base URL), applied to reads as well as writes.
**Recommended Fix:** Fix INFRA-01 first. Add an authenticated-session step to every agents/conversational-ai route that validates the token against the fixed backend and takes tenant/user from that response, never from headers. Run `authorize(..., 'view')` for reads. Add route tests that send forged headers.
**Verification:** Call `GET /api/agents` with only `x-sub-institute-id: 1` and `x-user-id: 1`. It must return 401. Call `POST /api/agents` with a base-URL header pointing at a stub returning "allowed". It must still be denied.

## INFRA-03
**Severity:** High   **Type:** Confirmed
**Category:** Security
**Module:** Repository hygiene / agent tooling state
**Location:** `.kilo/conversational-ai/admission-state/*.json` (10 files), `.kilo/conversational-ai/workflow-state/*.json` (11), `.kilo/conversational-ai/history/7013_7013.json`, `diff_frontend.txt`, `.tsc-check2.log`, `.codex/*` (2), `.claude/settings.json`, `.kilo/plan/dynamic-menu-implementation.md`, `.kilo/agent-manager.json` (untracked but present)
**Function/Method:** n/a (file-store default path `packages/conversational-ai-core/src/file-store.ts:13-14`)
**Problem:** Agent runtime state from the retired Next.js conversational brain was committed and pushed to `github.com/Vivek99256/lms_k12`. It contains real admission-enquiry records: student/applicant names (e.g. "Gajera Vivek B***" enquiry 2022009), mobile numbers (about 20 distinct, e.g. `0992***`, `7655***`, `9876***`), e-mail addresses (`vivekgajera2709@gmail.com`, `rajesh@gmail.com`), fee/attendance chat history and matched-entity metadata. The writer's default directory is `.kilo/conversational-ai` (`process.cwd()/.kilo/conversational-ai`) and `.kilo/.gitignore` does not exclude it. Also tracked: an 87 KB `diff_frontend.txt` (7-file PAL diff, UTF-8 BOM), an empty `.tsc-check2.log`, `.codex/patch-student-breakoff-backend.ps1` plus a full copy of a Laravel controller (`.codex/tmp_studentBreakoffReportController.php`), and `.claude/settings.json` granting `Read(//d/next_lms_erp/**)` and specific `php artisan` commands (machine-specific).
**Evidence:** `git ls-files | grep workflow-state` lists 11 files; e.g. `workflow-state/lms_k12_7013_a5937f5d-...json:234` `"email": "vivek***@gmail.com"` and `"mobileNo": "0992***"`. `git log --all -S` shows these were added by commits, so they are in history. No API keys/tokens found inside (regex `token|secret|password|api_key` = 0 in `.kilo`).
**Impact:** Personal data of named individuals (minors' guardians) is published in a git remote and every clone; removal from HEAD alone does not remove it from history. The stray backend patch script edits `D:\next_lms_erp\app\Helpers\Helper.php` by hard-coded line indexes (`$helperLines[2471] = ...`) and would corrupt the file if the file has moved on.
**Expected Behavior:** Tool state and scratch artefacts are never versioned.
**Recommended Fix:** `git rm -r --cached .kilo/conversational-ai .codex diff_frontend.txt .tsc-check2.log`; add `.kilo/`, `.codex/`, `.agents/`, `.claude/settings.local.json`, `*.log`, `diff_*.txt` to `.gitignore`; rewrite history (`git filter-repo`) if the repo is or was public; delete dead `packages/conversational-ai-core/src/file-store.ts` or move its default dir under `.data/`; delete the `.codex` patch script.
**Verification:** `git ls-files | grep -E '^\.(kilo|codex)/'` returns nothing; `git log --all -- .kilo` is empty after the rewrite.

## INFRA-04
**Severity:** Medium   **Type:** Missing
**Category:** DevOps
**Module:** CI/CD and deployment
**Location:** `.github/workflows/` (empty directory, not tracked), no `Dockerfile`, `vercel.json`, `.nvmrc`, `engines`; `README.md`
**Function/Method:** n/a
**Problem:** No pipeline runs lint, typecheck, tests or build. No container image, deploy script, rollback procedure, environment matrix, or documented hosting target. `package.json` `lint` currently exits 1 (494 errors in app code) and `npm test` exits non-zero (2 failures), so a naive CI would be red from day one.
**Evidence:** `git ls-files .github` is empty (git cannot track an empty dir, so the folder exists locally only); `git ls-files | grep -iE 'Dockerfile|docker-compose|vercel\.json|\.nvmrc|dependabot|renovate|CODEOWNERS'` returns nothing. README has no deployment section.
**Impact:** Regressions (including INFRA-01/02) ship unchecked; builds depend on a developer machine (`execSync git` build id, Windows paths in docs); no reproducible rollback; nobody is pinned to a Node version (`@types/node ^20`, local Node 24).
**Expected Behavior:** PR checks for `npm ci`, `tsc`, `eslint`, `npm test`, `next build`; documented deploy and rollback.
**Recommended Fix:** Add a GitHub Actions workflow (install, typecheck, lint scoped to source, test, build) with the required env stubs; add `engines` and `.nvmrc`; add Dependabot; document deployment (Vercel or container) and rollback in README.
**Verification:** A PR shows green/red checks; `docker build` (if adopted) succeeds from a clean clone.

## INFRA-05
**Severity:** Medium   **Type:** Confirmed
**Category:** Frontend
**Module:** Login (Google sign-in)
**Location:** `app/login/page.tsx:30-34,71-76`
**Function/Method:** `LoginPage` effect / `handleGoogleSignIn`
**Problem:** The client component reads `process.env.NEXT_GOOGLE_CLIENT_ID`. Next.js inlines only `NEXT_PUBLIC_*` variables (plus those listed in `next.config.ts` `env`, which contains only `NEXT_PUBLIC_APP_BUILD_ID`) into browser bundles, so the value is always `undefined` in the browser. The variable is also missing from `.env.example`.
**Evidence:** `setGoogleClientId(process.env.NEXT_GOOGLE_CLIENT_ID?.trim() || '')` then `if (!googleClientId) { setError('Google sign-in is not configured. Set NEXT_GOOGLE_CLIENT_ID and try again.') }`.
**Impact:** Google sign-in always shows "not configured" in every environment, even when the variable is set as the message instructs. The whole `/api/google-auth` proxy and backend endpoint are unreachable from the UI.
**Expected Behavior:** Sign-in works when configured.
**Recommended Fix:** Rename to `NEXT_PUBLIC_GOOGLE_CLIENT_ID` (client IDs are public), document it in `.env.example`, and fix the error text.
**Verification:** Set the variable, `next dev`, confirm the button opens the Google prompt (browser E2E).

## INFRA-06
**Severity:** Medium   **Type:** Confirmed
**Category:** DevOps
**Module:** Environment / base URL selection
**Location:** `app/components/utils/api_url.tsx:20-47`; 22 files listed in section 5.2 (e.g. `app/api/dashboard/admin/route.ts:19-28`); `.env.example:9-13`
**Function/Method:** `isProductionEnvironment`, `getDefaultBaseUrl`
**Problem:** Two different selectors decide DEV vs PROD. The browser uses hostname (not local means PROD), the server uses `NODE_ENV`. Local ranges are hard-coded (`10.0.`, `192.168.`, `172.16-31`, `.local`, `.test`). A staging host, preview URL, tunnel, or an on-prem address such as `10.1.4.5` is classified PROD. `next start` on `localhost` splits browser (DEV) and server routes (PROD). `API_BASE_URL` is a module-level constant computed at import, so SSR (`NODE_ENV`) and the browser can disagree, and one build cannot be promoted between environments. The example file ships the production URL as the PROD default, and if neither variable is set the code only logs `console.error` and proceeds with an empty base.
**Evidence:** `return !(hostname === 'localhost' || hostname === '127.0.0.1' || hostname.startsWith('192.168.') || hostname.startsWith('10.0.') ...)`; server: `if (process.env.NODE_ENV === 'production') return productionBaseUrl || developmentBaseUrl;`.
**Impact:** A frontend deployed to `dev.triz.co.in` (named in comments as a dev host) talks to the production API unless `_PROD` is overridden for that build. Local production-mode testing silently hits two different backends.
**Expected Behavior:** One explicit environment variable per deployment.
**Recommended Fix:** Use a single `NEXT_PUBLIC_API_BASE_URL` (or server-side `API_BASE_URL` plus a runtime config endpoint), fail the build/start when unset, remove hostname sniffing, and have all 22 route files import the shared helper.
**Verification:** Build with `NEXT_PUBLIC_API_BASE_URL=https://stg...`, serve on any hostname, confirm all requests (browser and server proxies) use it.

## INFRA-07
**Severity:** Medium   **Type:** Missing
**Category:** Security
**Module:** `next.config.ts`
**Location:** `next.config.ts:42-76`
**Function/Method:** `nextConfig`
**Problem:** No `headers()` (no Content-Security-Policy, X-Frame-Options/`frame-ancestors`, Strict-Transport-Security, Referrer-Policy, Permissions-Policy, X-Content-Type-Options), `poweredByHeader` left at default (`X-Powered-By: Next.js`), no `images.remotePatterns` (73 raw `<img>`, `next/image` almost unused), no `output: 'standalone'`.
**Evidence:** The config only sets `turbopack.root`, `env`, `generateBuildId`, `rewrites`.
**Impact:** The app stores the bearer token in localStorage and renders 65 raw HTML injection sites (INFRA-08) with no CSP as a second line of defence. Clickjacking of a fees-collection UI is possible.
**Expected Behavior:** Baseline security headers and a CSP.
**Recommended Fix:** Add an `async headers()` block (CSP with report-only first, frame-ancestors, HSTS, nosniff, referrer policy), `poweredByHeader: false`, and configure `images`.
**Verification:** `curl -I` on a deployed page shows the headers.

## INFRA-08
**Severity:** High   **Type:** Potential
**Category:** Security
**Module:** Fees receipts/circulars, career explorer, curriculum planning, PAL/H5P players
**Location:** `app/fees/collect/[studentId]/page.tsx:669,898`, `app/fees/circulars/page.tsx:857,859`, `app/fees/cancel-refund/page.tsx:815`, `app/fees/_components/fees-shared.tsx:235`, `app/fees/NACH_s4excel_import/page.tsx:167`, `app/career-explorer/expert-advice/page.tsx:210`, `app/career-explorer/explore-sectors/page.tsx:86`, `app/lms/curriculum-planning/CurriculumTab.tsx:188`, plus `app/pal/eso/page.tsx` (15 sites) and 27 other files
**Function/Method:** JSX `dangerouslySetInnerHTML={{ __html: ... }}`
**Problem:** 65 sites in 35 files inject HTML strings into the DOM. Only 6 of the 35 files reference any sanitiser/escaper (`isomorphic-dompurify` is imported in 4 files). Several inject strings that originate from the Laravel API (receipt HTML, circular HTML, curriculum details, expert-advice content).
**Evidence:** `dangerouslySetInnerHTML={{ __html: printableReceiptHtml }}`, `{{ __html: result.html }}`, `{{ __html: dialog?.content ?? '' }}`.
**Impact:** If any of those fields can hold user-authored text (student name, remark, circular body), stored XSS runs in a staff session whose bearer token is in `localStorage` (`userData`), giving account takeover. Backend sanitisation is `NOT VERIFIED` (Laravel out of scope here), hence Potential.
**Expected Behavior:** All injected HTML passes through a sanitiser with a strict allow-list, or is rendered as React nodes.
**Recommended Fix:** Wrap every site in a shared `SafeHtml` that uses DOMPurify; fix the token storage (httpOnly cookie) longer term; add CSP (INFRA-07).
**Verification:** Store `<img src=x onerror=alert(1)>` in a circular/remark and confirm it renders inert.

## INFRA-09
**Severity:** High   **Type:** Confirmed
**Category:** Security
**Module:** Recruitment screening, SOP conversion
**Location:** `app/api/screenCandidate/route.ts` (whole file), `app/api/process/convert/route.ts:178`
**Function/Method:** `POST`
**Problem:** Both routes call paid third-party LLMs with server-side keys and perform **no authentication or session check**. `screenCandidate` accepts an arbitrary `resume` and `jdData` and sends them to DeepSeek / OpenRouter / Gemini. `process/convert` accepts up to 20,000 chars (`z.string().min(20).max(20000)`) and calls Gemini through `createLocalAiModel()`.
**Evidence:** No reference to `x-laravel-token`, session or 401 in either file (grep). `screenCandidate` header says "Ported as-is from G2G".
**Impact:** Anyone on the internet can consume the AI keys/quota (cost and DoS), and use the server as a free LLM relay. `screenCandidate` also relays resume PII to three external providers, while `docs/conversational-ai-architecture.md` promises no other model use.
**Expected Behavior:** Authenticated, tenant-scoped, rate-limited AI calls, preferably through the Laravel gateway.
**Recommended Fix:** Require and verify the session token (server-side against Laravel); add rate limiting; move both to Laravel `/api/ai/generate` like field-edit; document data flows.
**Verification:** Unauthenticated `POST /api/process/convert` returns 401.

## INFRA-10
**Severity:** Medium   **Type:** Confirmed
**Category:** Security
**Module:** Talent management, task management, misc integrations
**Location:** `app/talent-management/_lib/recruitment-api.ts:216`, `app/task-management/my-tasks/components/create-task-modal.tsx:381`, `app/general/implementation_management/ImplementationManagementPage.tsx:94,103`, `app/organization-management/employee-directory/components/edit-employee/upload-doc-tab.tsx:144`, `app/sqaa/_lib/api.ts:168`, `app/capability-intelligence/capability-explorer/components/taxonomy-ontology.tsx:38`
**Function/Method:** `sendJobPostingWebhook`, `sendAssignmentWebhook`
**Problem:** Production URLs and third-party webhooks are hard-coded. The job-posting webhook is `GET https://n8n.triz.co.in/ff441ace-...?<params>` (the UUID path acts as the credential and is in source; candidate form fields and the JD analysis JSON travel in the query string, so they land in proxy/access logs). The task webhook posts full task data to `https://n8n.triz.co.in/webhook-test/task-assigned`, an n8n **test** path that only answers while an editor is listening. Import export links use plain `http://apps.triz.co.in/...`. DigitalOcean Spaces bucket `s3-triz.fra1...` is hard-coded in 2 files. A third-party Vercel app is embedded.
**Evidence:** `await fetch(\`https://n8n.triz.co.in/ff441ace-87f3-4cb5-9d26-838653929aa7?${params}\`, { method: 'GET' })`; errors swallowed (`catch { /* webhook must never block task creation */ }`).
**Impact:** PII in URLs and logs, an unrotatable in-source webhook secret, silent functional failure of the task notification in production, mixed-content/insecure download links, no per-environment override.
**Expected Behavior:** Endpoints from env/config; secrets not in source; POST with body over HTTPS.
**Recommended Fix:** Move each URL to server-side config, proxy through an authenticated route, use `POST`, rotate the exposed webhook path, replace the `webhook-test` URL.
**Verification:** `git grep -n "triz.co.in" -- app lib components` returns only config reads.

## INFRA-11
**Severity:** Medium   **Type:** Confirmed
**Category:** Testing
**Module:** AI capability registry / roadmap
**Location:** `packages/ai-intelligence-core/src/registry.ts:101-124`, `lib/roadmap/registry.ts:765-771`, `lib/ai/ai-capabilities.test.ts:59,113`
**Function/Method:** tests "a capability that cites a roadmap row agrees with it" and "a live capability points at a real screen"
**Problem:** `npm test` fails (2 of 557). The registry entry `ai.providers` says `status: 'live'` with `todayInK12: 'Live at /ai/providers ...'` but no `href`, and it cites roadmap row `ai.gateway`, which still says `coming-soon` for customers. The screen exists (`/ai/providers`, `app/_lib/module-screens.generated.ts:66`).
**Evidence:** `AssertionError: ai.providers says "live" while the roadmap says "coming-soon"`; `ai.providers is marked live but has no screen to open`.
**Impact:** The test suite that guards these registries is red, the customer-facing roadmap under-reports a shipped feature, and any CI will fail.
**Expected Behavior:** Registry, roadmap and routes agree; tests pass.
**Recommended Fix:** Set `href: '/ai/providers'` on the registry entry and flip `ai.gateway` to the correct status (or drop `roadmapId`).
**Verification:** `npm test` reports 557/557.

## INFRA-12
**Severity:** High   **Type:** Missing
**Category:** Testing
**Module:** Fees, auth, admissions, attendance, results, timetable, payroll, import, route handlers, components
**Location:** whole repo (see section 7.2)
**Function/Method:** n/a
**Problem:** All 42 test files sit under `lib/` and test pure helpers. Money and identity flows are untested: login/session (`contexts/AuthContext.tsx`), fee collection (`app/fees/collect/page.tsx`, 2,440 LOC), Razorpay flow, admissions, attendance, marks/results, timetable, payroll/leave, imports. 0 of 67 route handlers and 0 of 248 components have tests; no E2E or coverage tooling. `packages/**/*.test.ts` in the `npm test` glob matches nothing.
**Evidence:** `git ls-files | grep -E '\.test\.'` returns 42 files, all `lib/**`; no test dependency in `package.json` other than `tsx`.
**Impact:** The most consequential code (payments, authorization proxies, tenant scoping) can regress or, as INFRA-01/02 show, be wrong from the start with no signal.
**Expected Behavior:** Route-handler tests for authz/tenant scoping and unit tests for fee arithmetic, plus smoke E2E for login and fee collection.
**Recommended Fix:** Add tests for the shared proxy helper and each auth boundary first (forged headers, missing token), then fee collection calculations, then Playwright smoke tests; add coverage reporting.
**Verification:** CI reports coverage for `app/api` and `lib/fees`.

## INFRA-13
**Severity:** Medium   **Type:** Confirmed
**Category:** Frontend
**Module:** Lint/type hygiene
**Location:** `eslint.config.mjs`; `components/document-template/{editor/LayersPanel.tsx,blocks/TableBlock.tsx,blocks/TextBlock.tsx,...}`; `app/talent-management/{mobility-and-succession,offboarding}/components/*-center.tsx`; `app/organization-management/_lib/employee-directory-api.ts`
**Function/Method:** n/a
**Problem:** `npm run lint` is unusable: 494 errors and 290 warnings in 227 files of tracked source. Breakdown of errors: `@typescript-eslint/no-explicit-any` 279, `react-hooks/set-state-in-effect` 169, `react/no-unescaped-entities` 17, `react-hooks/refs` 12, `no-empty-object-type` 4, `preserve-manual-memoization` 3, `immutability` 2, `purity` 2 (`Date.now()` in render: `offboarding-center.tsx:164`, `hooks/use-stuck-user-assistance.ts:42`), others 1 each. Warnings: `no-unused-vars` 245, `exhaustive-deps` 19, 17 unused disable directives. The config also lints `.kilo/worktrees/paint-chevre` (901 files, +277 E) and `K-12 ERP Design System` (+12 E) because only `.next/out/build` are ignored. `components/document-template` alone has 189 errors. There are 307 `eslint-disable` comments (140 for `set-state-in-effect`, 95 `exhaustive-deps`, 64 `no-img-element`). Worst files by errors: `LayersPanel.tsx` 30, `TableBlock.tsx` 29, `mobility-center.tsx` 26, `employee-directory-api.ts` 17, `offboarding-center.tsx` 16, `personal-info-tab.tsx` 15, `TextBlock.tsx` 15.
**Evidence:** `npx eslint . -f json`: 3,124 files, main E=494 W=290.
**Impact:** Lint cannot gate CI; real problems are hidden in noise; stale nested worktree doubles the scan time (about 5 minutes).
**Expected Behavior:** A clean, fast lint over source only.
**Recommended Fix:** Ignore `.kilo/**`, `K-12 ERP Design System/**`, `AUDIT/**`, `g2g/**`; fix or baseline the rest; remove unused disables and the malformed directive at `employee-directory.tsx:310`.
**Verification:** `npx eslint .` exits 0 (or against a committed baseline).

## INFRA-14
**Severity:** Low   **Type:** Confirmed
**Category:** Other
**Module:** Dependencies
**Location:** `package.json`
**Function/Method:** n/a
**Problem:** Unused packages `geist`, `uuid`, `@tiptap/extension-image`; phantom import of undeclared `@radix-ui/react-slot` (`components/ui/g2g/button.tsx:11`); `shadcn` (CLI, used only as a CSS import) in `dependencies`; two chart stacks (chart.js/react-chartjs-2 and recharts) and two headless-UI stacks (`@base-ui/react` and radix); `react-hook-form`, `@hookform/resolvers`, `react-day-picker`, `@dnd-kit/*` each used in one file; lock flags `eslint` 9.39.5 as deprecated; no `engines`/`packageManager`; missing local install of declared `framer-motion` (the sole `tsc` error).
**Evidence:** import scan (section 5.3); `package-lock.json` entry `node_modules/eslint` `deprecated: "This version is no longer supported"`.
**Impact:** Larger installs/bundles, hoisting-dependent build, higher supply-chain surface, developers hit `TS2307` until they `npm install`.
**Expected Behavior:** Declared = used.
**Recommended Fix:** Remove unused packages, add `@radix-ui/react-slot`, move `shadcn` to devDependencies, pick one chart library, upgrade eslint, add `engines`.
**Verification:** `npm ls --all | grep UNMET` empty; import script reports no drift.

## INFRA-15
**Severity:** Medium   **Type:** Architectural
**Category:** Frontend
**Module:** Stale-client detection
**Location:** `lib/app-version.ts:143-191`, `contexts/AuthContext.tsx:157-181`, `next.config.ts:12-30`
**Function/Method:** `syncAppBuild`, `purgeClientState`, `resolveBuildId`
**Problem:** The stale-bundle strategy signs every user out on every deploy: a build-id change clears all localStorage (which holds `userData` including the bearer token, `menuContext` and `authUser`), sessionStorage, cookies, Cache Storage and service workers, then reloads. The id is a commit SHA, so even a copy fix logs everyone out and discards unsaved drafts. Detection occurs only at page load: an already-open tab keeps executing the old bundle indefinitely (no polling or version endpoint). The fallback `build-${Date.now()}` is computed each time the config module is evaluated, so it is not stable across processes; if git is unavailable a dirty checkout keeps the same SHA across different code (misses staleness).
**Evidence:** `await purgeClientState(); recordBuildId(); window.location.reload();`.
**Impact:** Forced logout and lost form state after every deployment; old tabs may call renamed APIs.
**Expected Behavior:** Non-destructive versioning: purge only app caches, keep the session, prompt open tabs to refresh.
**Recommended Fix:** Persist auth separately and exclude it from the purge, or purge only known schema keys; poll `/api/version` and show a "reload" banner.
**Verification:** Deploy twice, confirm session survives and old tab prompts to reload.

## INFRA-16
**Severity:** Medium   **Type:** Architectural
**Category:** Backend
**Module:** Agents store, conversational-AI admin store
**Location:** `lib/agents/store.ts:13,79-140,201`, `lib/ai/conversational-admin/store.ts:10,41-82`
**Function/Method:** file-backed stores
**Problem:** Persistent tenant data (agents, run logs, service-token hashes, project settings) is stored in JSON files under `process.cwd()/.data` with an in-memory copy (`this.data`) loaded per process and written via temp-file rename. The store's own comment calls this "v1". It does not survive serverless/ephemeral filesystems, and multiple instances each hold a divergent copy with last-writer-wins.
**Evidence:** `path.join(process.cwd(), '.data', 'agents.json')`; `this.data.agents.push(agent)`; `.data/` is only in `.gitignore`.
**Impact:** Data loss or divergence under any horizontal scaling or redeploy; service tokens vanish on a new container.
**Expected Behavior:** Durable shared storage (Laravel/DB).
**Recommended Fix:** Move persistence to the Laravel backend or a database before production use; at minimum document single-instance and volume requirements.
**Verification:** Run two instances behind a balancer; an agent created on one is visible on the other.

## INFRA-17
**Severity:** Medium   **Type:** Confirmed
**Category:** Other
**Module:** Documentation (CLAUDE.md, README, AGENTS)
**Location:** `CLAUDE.md`, `README.md`, `AGENTS.md`
**Function/Method:** n/a
**Problem:** `CLAUDE.md` is a copy of the design-system spec (`K-12 ERP Design System/readme.md`), not repo guidance. It cites root paths that do not exist (`tokens/`, `styles.css`, `SKILL.md`, `ui_kits/`, `_ds_bundle.js`), declares Inter/JetBrains Mono while the app uses Geist (`app/layout.tsx`), and says nothing about commands, backend, env, tests or architecture. `README.md` is a marketing template without env, backend dependency, test/lint commands, deployment or roles; lists yarn/pnpm/bun though only `package-lock.json` exists. `AGENTS.md` is 5 generic lines.
**Evidence:** `ls tokens styles.css SKILL.md ui_kits` (root) all "No such file"; diff of `CLAUDE.md` vs `K-12 ERP Design System/readme.md` shows only ordering/escape differences.
**Impact:** Every AI-assisted and new-developer session loads misleading instructions; onboarding requires tribal knowledge.
**Expected Behavior:** CLAUDE.md/README describe this repository.
**Recommended Fix:** Replace `CLAUDE.md` with a repo guide (stack, commands, env, Laravel dependency, tenant model, conventions) and move the design-system text under its folder; expand README (install, env, run, test, deploy).
**Verification:** A new developer can install, configure env and run tests from README alone.

## INFRA-18
**Severity:** Medium   **Type:** Confirmed
**Category:** Other
**Module:** Documentation contradicting code
**Location:** `docs/AI_FIELD_ASSISTANT.md:40-50`, `.env.example:41-47`, `lib/ai/local-model.ts:3-8`, `lib/ai/field-edit/types.ts:85`, `docs/conversational-ai-architecture.md:23-25`, `docs/admin-user-journey.md:7`, `docs/teacher-user-journey.md:6`, `docs/menu-data-source-audit.md`, `packages/ai-intelligence-core/src/registry.ts:228`
**Function/Method:** n/a
**Problem:** Field-edit docs say it keeps a local `generateText` and "there is currently no Laravel endpoint with that narrow contract"; the route now proxies `POST /api/ai/generate` and its own header comment states the opposite. The local Gemini key is now used only by the unauthenticated `process/convert` route, while `.env.example` still says field editing is the "single deliberate exception". `conversational-ai-architecture.md` says the only local model use is field-edit, but `screenCandidate` calls three providers directly. Journey docs say Next.js 15/534 pages/81 groups (actual 16.2.6/677/87). `menu-data-source-audit.md` cites 54 menus/~700 files, deleted orphan files and static arrays that are now empty, and contradicts itself on `admin-data.ts`. `registry.ts:228` cites nonexistent `packages/conversational-ai-core/src/security.ts`. `INTEGRATION_AUDIT.md` embeds a developer machine path, prod DB name `vivek_erp` and IP `202.47.117.220`.
**Evidence:** see section 7.3 rows.
**Impact:** Readers and auditors get wrong architecture and data-source conclusions; internal topology is disclosed in a repo remote.
**Expected Behavior:** Docs match code; no infra topology in committed docs.
**Recommended Fix:** Update or delete stale docs, add a "last verified" date and owner to each, scrub IP/DB/host details.
**Verification:** Re-run the claims table in section 7.3; all rows match.

## INFRA-19
**Severity:** Medium   **Type:** Missing
**Category:** DevOps
**Module:** Observability
**Location:** repo-wide (`app/` has 1 `not-found.tsx`, 1 `loading.tsx`; no `error.tsx`, `global-error.tsx`, `instrumentation.ts`)
**Function/Method:** n/a
**Problem:** No error tracking (no Sentry/OTel/Datadog dependency), no health endpoint for the web tier (only `/api/mcp/health`), no structured logging (76 `console.error`, 33 `console.log`), no Next error boundaries so an uncaught render error in any of 677 pages shows the default framework error with no capture.
**Evidence:** `git ls-files app | grep -E '(error|global-error)\.tsx$'` returns nothing; `package.json` has no monitoring dependency.
**Impact:** Production failures are invisible until reported; no readiness probe for load balancers/orchestrators.
**Expected Behavior:** Error capture, health and readiness endpoints, boundary UI.
**Recommended Fix:** Add `app/error.tsx` and `global-error.tsx`, an `/api/health`, Sentry or OTel via `instrumentation.ts`, and route logging through one wrapper that redacts payloads.
**Verification:** Throw in a page and see the event in the tracker; `GET /api/health` returns 200.

## INFRA-20
**Severity:** Low   **Type:** Confirmed
**Category:** Frontend
**Module:** Logging and placeholder handlers
**Location:** `app/student/{student_attendance:471,daywise_student_attendance:318,monthwise_student_attendance:691-717,yearly_student_attendance:369}/page.tsx`, `app/fees/master/other-fees-title/page.tsx:255,256,383`, `app/course-master/lesson-plan/[courseId]/page.tsx:955-1341`, `app/course-master/[courseId]/chapters/sideDrawer.tsx:735,737`, `app/organization_managment/oragnization_profile/page.tsx:539,542`, `app/components/Sidebar.tsx:113`; stub handlers in `StudentHealthTable.tsx:44-52`, `StudentProfilesDashboard.tsx:208,213`, `attendance-reports/page.tsx:614-622`, `RecentLeaveRequests.tsx:102`
**Function/Method:** various
**Problem:** 33 `console.log` calls dump API responses, request payloads, sessions and AI prompts into the browser console (student attendance data, fees records, org profile). Several buttons ("Edit student", "Generate certificate", "Print ID card", "Export", "Print", "Save report", "View") do nothing except `console.log`. 154 `alert(`/`confirm(` calls are used for UX.
**Evidence:** `console.log('Monthwise Attendance Report API response:', responseBody);`, `console.log("Print ID card", student);`.
**Impact:** Student PII exposed in dev tools/support screenshots; users click dead buttons.
**Expected Behavior:** No payload logging in production; unimplemented actions hidden or disabled.
**Recommended Fix:** Remove the logs (or gate behind a debug flag), disable or implement the stub actions, replace `alert`/`confirm` with dialog components.
**Verification:** `git grep -n "console.log(" -- app components lib hooks` returns 0 (or debug-gated only).

## INFRA-21
**Severity:** Medium   **Type:** Architectural
**Category:** Frontend
**Module:** Code structure
**Location:** top files listed in section 9 (e.g. `app/course-master/[courseId]/chapters/page.tsx` 6,719 LOC, `app/lms/exam/page.tsx` 4,231); duplicate clusters in section 9; `app/general/onboarding/_lib/onboarding-api.ts` (445 commented-out lines)
**Function/Method:** n/a
**Problem:** 76 source files exceed 1,000 lines and 286 exceed 500; single pages are god components mixing fetch, state and rendering. Copy-paste clusters: 6 dashboard proxy routes and 18 files re-declaring the same 3-4 helpers, AI-stack screens replicated across 4 modules (0.82-0.86 similarity), duplicate onboarding UI, a whole commented-out prior version kept in `onboarding-api.ts`. Look-alike module directories (`frontdesk`/`front_desk`, `organization-management`/`organization_managment`, three exam trees, `app/{lib,hooks,components}` beside root ones).
**Evidence:** `wc -l` and the Jaccard script output in section 9.
**Impact:** Bugs must be fixed N times (INFRA-01 is a live example: 20 copies), review is impractical, merge conflicts frequent.
**Expected Behavior:** Shared helpers and components; files under a few hundred lines.
**Recommended Fix:** Extract a `lib/laravel-proxy` helper, one parametrised AI-stack screen set, split the top 10 files by concern, delete commented-out code.
**Verification:** Duplicate scan reports no cluster above 0.7; max file size trending down.

## INFRA-22
**Severity:** Low   **Type:** Confirmed
**Category:** DevOps
**Module:** Repository layout
**Location:** `.gitignore`; `.kilo/worktrees/paint-chevre` (nested git worktree, 71 MB, 818 `ts/tsx` files, own `.env*` copies); tracked `.tsc-check2.log`, `diff_frontend.txt`, `.claude/settings.json`, `new k12.code-workspace` (ignored) ; local `.next` of 9.3 GB
**Function/Method:** n/a
**Problem:** The working tree holds a second full checkout of another branch inside `.kilo/worktrees/` (registered in `git worktree list`), scanned by ESLint (INFRA-13) and duplicating source, plus its own untracked `.env`/`.env.local`. `.gitignore` lacks entries for agent tooling directories, logs and diff dumps.
**Evidence:** `git worktree list` shows `D:/lms_k12/.kilo/worktrees/paint-chevre e421b0e [paint-chevre]`.
**Impact:** Confusing searches/greps, stale code audited by tools, secrets duplicated in a second place.
**Expected Behavior:** Worktrees outside the repo directory; ignores complete.
**Recommended Fix:** `git worktree remove` it (or keep it outside the repo), extend `.gitignore`, add `.next` cleanup to dev docs.
**Verification:** `git worktree list` shows one entry; `git status --ignored` is clean of tooling dirs.

## INFRA-23
**Severity:** Medium   **Type:** Potential
**Category:** Security
**Module:** PAL taxonomy pages
**Location:** `app/pal/data/pal-content-model.ts:1125-1155`, callers `app/pal/_components/PalTaxonomyDetailPage.tsx:67`, `PalTaxonomyParentPage.tsx:61`
**Function/Method:** `resolveLocalApiUrl`, `getPalContentModel`
**Problem:** Server components call back into their own API by building `${proto}://${host}/api/pal/content-model` from the incoming `x-forwarded-proto`, `x-forwarded-host` and `host` headers. Behind a proxy that does not overwrite those headers (or on a directly exposed server) a forged `Host` makes the server fetch an attacker-chosen origin and render the JSON as page content.
**Evidence:** `headerStore.get('x-forwarded-host') ?? headerStore.get('host') ?? 'localhost:3000'`.
**Impact:** SSRF-lite and content injection on PAL pages; depends on the reverse-proxy config, `NOT VERIFIED`.
**Expected Behavior:** Call the data function directly (both live in the same app) or use a fixed origin.
**Recommended Fix:** Import `buildPalContentModelPayload` in the server component instead of an HTTP self-call.
**Verification:** Send `Host: attacker.test` and confirm no outbound request.

## INFRA-24
**Severity:** Low   **Type:** Improvement
**Category:** Performance
**Module:** Rendering config
**Location:** `app/layout.tsx:7` (`export const dynamic = 'force-dynamic'`), `next.config.ts`, `public/images/career-explorer/college-campus-fallback.png` (2.3 MB), 73 raw `<img>` tags
**Function/Method:** `RootLayout`
**Problem:** The root layout forces every route to be dynamically rendered, defeating static optimisation and the full-route cache; images are unoptimised; `next/font/google` needs network at build time.
**Evidence:** `export const dynamic = 'force-dynamic';`.
**Impact:** Higher TTFB and server cost; needless build coupling to Google Fonts.
**Expected Behavior:** Force dynamic only where required.
**Recommended Fix:** Remove the root-level flag, set it on pages that read cookies/headers, use `next/image` and self-hosted `geist`.
**Verification:** `next build` output shows static routes.

## INFRA-25
**Severity:** Low   **Type:** Potential
**Category:** DevOps
**Module:** Case-sensitive paths
**Location:** `app/Inventory/**`, `app/Transportation/**`, `app/Utility/**`, `app/admission-Enquiry`, `app/_lib/module-screens.generated.ts:287-291` (keys `'/inventory/...'` map to `@/app/Inventory/...`), `next.config.ts:60-63` (rewrite `/admission-enquiry` -> `/admission-Enquiry`)
**Function/Method:** n/a
**Problem:** Route directories are PascalCase while menu links, tab-registry keys and helpers use lowercase. This works on Windows/macOS but Next routes are case-sensitive on Linux. The existing rewrite proves the problem was hit once. No case-collision is currently tracked (`git ls-files | tr A-Z a-z | uniq -d` is empty).
**Evidence:** generated map key `'/inventory/generate_po'` vs directory `app/Inventory/generate_po`.
**Impact:** Menu items may 404 or fail to inline as tabs on a Linux deployment.
**Expected Behavior:** Lowercase route directories.
**Recommended Fix:** Rename the directories, regenerate the map, keep redirects for old URLs; add a CI check for mixed-case app dirs.
**Verification:** Open each menu link on a Linux build.

## INFRA-26
**Severity:** Info   **Type:** Improvement
**Category:** Other
**Module:** Secret and PII sweep result
**Location:** all tracked files
**Function/Method:** n/a
**Problem:** Not a defect. Records the negative result so it is not repeated: no live credentials, JWTs, private keys or credentialed URLs in tracked files or in git history (limited regex scan); `.env`/`.env.local` are untracked and ignored. Remaining sensitive items are the PII in INFRA-03, the webhook path in INFRA-10, and internal topology in INFRA-18. `public/vercel.svg` and four sibling svgs are unused create-next-app assets; no Vercel deployment config exists.
**Evidence:** section 9 regex table.
**Impact:** Lower immediate secret-rotation burden.
**Expected Behavior:** Keep it that way.
**Recommended Fix:** Add `gitleaks` or GitHub secret scanning to CI.
**Verification:** Scanner passes on `main`.

ISSUE COUNTS: C=2 H=4 M=14 L=5 I=1

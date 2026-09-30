# 05 - API AUDIT

> Repos in scope: `D:\lms_k12` (Next.js frontend) and `D:\next_lms_erp` (Laravel backend consumed by the frontend). Static analysis only: no code modified, no server contacted, no `.env` read. Issue IDs are the unified `LMS-AUDIT-###` IDs from [14_MASTER_ISSUE_REGISTER.md](14_MASTER_ISSUE_REGISTER.md); original per-agent IDs are shown alongside and defined in `AUDIT/parts/`.

## Totals

| Metric | Value | Source |
|---|---:|---|
| Next route handlers (`app/api/**/route.ts`) | 67 (76 method handlers) + 3 helpers | Part 02 |
| Laravel route declarations | 3,094 (≈5,453 with resource expansion) | Part 09/10 |
| Laravel routes with route-level auth | 2,315 (declarations) | Part 10 |
| Laravel routes without route-level auth | 779 (378 routes in 90 controllers with no auth at all; 199 more accept any JWT but trust a client tenant) | Part 10 |
| Distinct Laravel paths called by the frontend | 1,117 (1,042 verified, 28 dynamic NOT VERIFIED, 47 unmatched of which 43 are real missing/mismatched) | Part 09 |
| Routes referenced by frontend and their auth | 1,421 referenced: 1,154 authenticated, 18 fail-open (`lms.auth` soft), 249 no route-level auth (114 with no token check in the controller either) | Part 09 |
| Throttled routes | 3 | Part 10 |

Full machine-generated lists: [parts/part10-laravel-route-inventory.csv](parts/part10-laravel-route-inventory.csv) (one row per Laravel route declaration), [parts/part09-data-api-calls.md](parts/part09-data-api-calls.md).

## Next.js route handlers - all 67 (Part 02 section 5, verbatim)

## 5. API endpoints exposed - all 67 handlers

Legend: "Next auth" = what the Next handler itself checks. "Fwd" = what is forwarded. Base URL = `API_BASE_URL` (env
`NEXT_PUBLIC_API_BASE_URL_PROD|DEV`, chosen by NODE_ENV on server) unless flagged **CLIENT-BASE** = also honours client header
`x-laravel-base-url` (SSRF, NAPI-01 (LMS-AUDIT-001)). Validation "none" = raw pass-through. All file system access: none, except agents and
conversational-ai stores (JSON files).

| # | Method(s) | URL | File | Next auth | Fwd / upstream (creds) | Validation | Response shape / errors | Laravel enforcement |
|---|---|---|---|---|---|---|---|---|
| 1 | POST | `/api/admissions/dashboard/summary` | admissions/dashboard/summary/route.ts | none (token optional) | **CLIENT-BASE** `/api/admissions-dashboard/summary`; Bearer token if sent; browser `Cookie` | body JSON free-form, body `sub_institute_id/syear/user_id` override headers | pass-through JSON; `{status:'0',message}` on error; HTML preview (500 chars) on non-JSON | **NONE** - route has no middleware (api.php:140); tenant from body; returns enquiry student names |
| 2 | PATCH | `/api/agents/:id` | agents/[id]/route.ts | tenant/user headers non-empty; RBAC via Laravel (forgeable) | none upstream except `/api/permissions` via **CLIENT-BASE** | status enum only | `{status:1,data}` / `{status:0,message}` | none (JSON store) |
| 3 | POST | `/api/agents/:id/run` | agents/[id]/run/route.ts | same; `update` right via Laravel (forgeable) | runs MCP read tool with client token to **CLIENT-BASE** | tool must be in agent allow-list; args free-form object | `{status:1,data:{run}}`; 403 with denied run row | Laravel MCP validates args/tenant if reached |
| 4 | GET, POST | `/api/agents` | agents/route.ts | GET: header presence only; POST: `create` right via Laravel (forgeable) | as above | name<=80, known module, tools validated against registry | `{status:1,data}` 201 on create | none |
| 5 | GET | `/api/agents/runs` | agents/runs/route.ts | header presence only (**no token check**) | JSON store | `limit` numeric, unbounded above | run log incl. `output` of live-record tools | none |
| 6 | POST | `/api/ai/ask/stream` | ai/ask/stream/route.ts | none | `AI_UPSTREAM_BASE_URL`->`AI_API_BASE_URL` (server-only, good); forwards `Authorization`, `X-MCP-Institute-Id`; falls back `/api/ai/ask` on 404/405 | none (raw body text) | AI-SDK UI message stream; non-JSON errors rewritten | `McpAuth`+rate limit+institute check (routes/ai.php:229-233) |
| 7 | POST | `/api/ai/assistance-tickets` | ai/assistance-tickets/route.ts | Authorization header present | `resolveAiBaseUrl()` (env-only) -> `/api/ai/assistance/tickets`; forwards `Authorization` | zod: lengths, screenshot <=8,000,000 chars | `{id}`; errors `{error,code}`; 422 with prettified zod detail | `McpAuth` (routes/ai.php:319) |
| 8 | POST | `/api/ai/field-edit` | ai/field-edit/route.ts | Authorization header present | `resolveAiBaseUrl()` -> `/api/ai/generate`; forwards `Authorization` | zod: value<=20000, instruction<=1000, enum fieldType | `{result,actionKey,model,note}` / `{error,code}`; provider message echoed in `detail` | `McpAuth` + 60/min (routes/ai.php:308) |
| 9 | PUT | `/api/conversational-ai/projects/:id/settings` | conversational-ai/projects/[id]/settings/route.ts | token non-empty; `conversational_ai` update via Laravel (forgeable base URL) | JSON store `.data/conversational-ai.json` | booleans, language enum, prompt-source enum | `{status:1,data}` | none |
| 10 | POST | `/api/conversational-ai/projects/:id/token` | .../token/route.ts | same | mints `cai_<project>_<40hex>` token, stores sha256, returns plaintext once (201) | project must be registered & external | `{status:1,data:{summary,plaintext}}` | none |
| 11 | GET | `/api/conversational-ai/projects` | conversational-ai/projects/route.ts | token non-empty (any string) | JSON store | none | adapters, settings, token last4/`rotated_by` | none |
| 12 | POST | `/api/dashboard/admin` | dashboard/admin/route.ts | `x-laravel-token` non-empty | **CLIENT-BASE** `/api/admin-dashboard/summary`, Bearer, Cookie | none; body built from headers | JSON pass-through; `{status:'0',message,...}` | `api.session` + controller role check |
| 13 | POST | `/api/dashboard/student` | dashboard/student/route.ts | token non-empty | **CLIENT-BASE** `/api/student-dashboard/summary` | none | same | `api.session` |
| 14 | POST | `/api/dashboard/teacher-fee-dues` | dashboard/teacher-fee-dues/route.ts | token non-empty | **CLIENT-BASE** `/api/teacher-fee-dues/summary` | none | same | `api.session`, rejects students |
| 15 | POST | `/api/dashboard/teacher-icard` | dashboard/teacher-icard/route.ts | token non-empty | **CLIENT-BASE** `/api/teacher-icard/mine` | none | same | `api.session`, own-user only |
| 16 | POST | `/api/dashboard/teacher-timetable` | dashboard/teacher-timetable/route.ts | token non-empty | **CLIENT-BASE** `/api/teacher-timetable/summary` | none | same | `api.session`, rejects students |
| 17 | POST | `/api/dashboard/teacher` | dashboard/teacher/route.ts | token non-empty | **CLIENT-BASE** `/api/teacher-dashboard/summary` | none | same | `api.session` |
| 18 | GET | `/api/fees/audit-logs` | fees/audit-logs/route.ts | headers sub_institute_id+syear present | **CLIENT-BASE** `/fees/audit_logs`, token **in URL query** + Bearer + Cookie | query passed through | JSON or `{status:0,message,preview}` | `session` (JWT) + `api.session` + `check_permissions` |
| 19 | POST | `/api/fees/dashboard/summary` | fees/dashboard/summary/route.ts | none (token optional) | **CLIENT-BASE** `/api/fees-dashboard/summary` | body free-form; body tenant wins | pass-through | `api.session`+`check_permissions`, **but controller filters by body `sub_institute_id`** -> IDOR |
| 20 | GET | `/api/fees/menu-categories` | fees/menu-categories/route.ts | sub_institute_id+user_id headers present | **CLIENT-BASE** `/api/fees/menu-categories?sub_institute_id&user_id&user_profile_name` | none | pass-through | `api.session`+`check_permissions` |
| 21 | POST | `/api/fees/online-payment/:gateway` | fees/online-payment/[gateway]/route.ts | none | base env only (`API_BASE_URL`); Bearer from **form field `token`**; `Origin` echoed from client | gateway allow-list of 8; form otherwise untouched | upstream HTML/JSON passed through incl. `Location`, `Content-Type` | `api.session`; amount/student unchecked (NAPI-09 (LMS-AUDIT-072)) |
| 22 | GET | `/api/fees/online-payments` | fees/online-payments/route.ts | headers present | **CLIENT-BASE** `/fees/online_payments` | none | JSON | `api.session` (+group middleware) |
| 23 | GET | `/api/fees/receipt-reprint` | fees/receipt-reprint/route.ts | headers present | **CLIENT-BASE** `/fees/receipt/reprint` | none | JSON | `api.session` |
| 24 | GET | `/api/fees/reconciliation-status` | fees/reconciliation-status/route.ts | headers present | **CLIENT-BASE** `/fees/reconciliation/status` | none | JSON | `api.session` |
| 25 | GET | `/api/fees/reports/datewise-summary/fees-title` | .../datewise-summary/fees-title/route.ts | headers present | **CLIENT-BASE** `/fees/getFeesTitle` | none | JSON | `session`+`check_permissions` |
| 26 | GET | `/api/fees/reports/datewise-summary` | .../datewise-summary/route.ts | headers present | **CLIENT-BASE** `/fees/fees_report_datewise` | none | JSON | same |
| 27 | GET, POST | `/api/fees/reports/fees-cancel` | .../fees-cancel/route.ts | headers present | **CLIENT-BASE** GET `/fees/fees_cancel_report_index`, POST `/fees/fees_cancel_report` (form-encoded, session params appended) | none | JSON | same |
| 28 | GET | `/api/fees/reports/fees-collection/create` | .../fees-collection/create/route.ts | headers present | **CLIENT-BASE** `/fees/fees_collection_report/create` | none | JSON | same |
| 29 | GET | `/api/fees/reports/fees-collection` | .../fees-collection/route.ts | headers present | **CLIENT-BASE** `/fees/fees_collection_report` | none | JSON | same |
| 30 | POST | `/api/fees/reports/fees-defaulter` | .../fees-defaulter/route.ts | headers present | **CLIENT-BASE** `/fees/fees_defaulter_report` | none | JSON | same |
| 31 | POST | `/api/fees/reports/fees-structure` | .../fees-structure/route.ts | headers present | **CLIENT-BASE** `/fees/fees_structure_report` | none | JSON | same |
| 32 | GET | `/api/fees/reports/fees-type-wise/create` | .../fees-type-wise/create/route.ts | headers present | **CLIENT-BASE** `/fees/fees_type_wise_report/create` | none | JSON | same |
| 33 | GET | `/api/fees/reports/other-fees-cancel/create` | .../other-fees-cancel/create/route.ts | headers present | **CLIENT-BASE** `/fees/otherNew_cancel_fees_report/create` | none | JSON | same |
| 34 | GET | `/api/fees/reports/other-fees-cancel` | .../other-fees-cancel/route.ts | headers present | **CLIENT-BASE** `/fees/otherNew_cancel_fees_report` | none | JSON | same |
| 35 | GET | `/api/fees/reports/other-fees/create` | .../other-fees/create/route.ts | headers present | **CLIENT-BASE** `/fees/otherNew_fees_report/create` | none | JSON | same |
| 36 | GET | `/api/fees/reports/other-fees/ledger` | .../other-fees/ledger/route.ts | **none at all** (text variant skips even the header check) | **CLIENT-BASE** `/fees/ajax_ledgerData` | none | **raw upstream body + upstream Content-Type** (full-read SSRF) | `session` |
| 37 | GET | `/api/fees/reports/other-fees` | .../other-fees/route.ts | headers present | **CLIENT-BASE** `/fees/otherNew_fees_report` | none | JSON | same |
| 38 | GET | `/api/fees/reports/student-breakoff/create` | .../student-breakoff/create/route.ts | headers present | **CLIENT-BASE** `/fees/student_breakoff_report/create` | none | JSON | same |
| 39 | GET | `/api/fees/reports/student-breakoff` | .../student-breakoff/route.ts | headers present | **CLIENT-BASE** `/fees/student_breakoff_report` | none | JSON | same |
| 40 | POST | `/api/forgot-password` | forgot-password/route.ts | none (public) | **CLIENT-BASE** `/forget-password` (root, not /api), Cookie only | JSON `email` string non-empty; no format check | Laravel JSON (`exists:tbluser,email` 422 leaks existence; mail error string leaked) / 502 HTML-detected message | Laravel web route; no throttle; CSRF blanket-disabled on prod hosts (NAPI-12 (LMS-AUDIT-225)) |
| 41 | POST | `/api/google-auth` | google-auth/route.ts | none (public) | **CLIENT-BASE** `/api/google-auth` with `credential` | `credential` or `id_token` string | Laravel payload / 502 | **Route does not exist in Laravel** (no match in app/, routes/, config/) |
| 42 | POST | `/api/hostel/dashboard/summary` | hostel/dashboard/summary/route.ts | none (token optional) | **CLIENT-BASE** `/api/hostel-dashboard/summary` | body free-form | pass-through | **NONE** (api.php:143) |
| 43 | POST | `/api/import/match-fields` | import/match-fields/route.ts | none | base env; **drops Authorization/Cookie** (headers arg is a plain object so the `instanceof Headers` branch never fires) | `request.json()` unvalidated | `{...}` or `{message}` 502 | `api.session` -> always 401 via this route. Unused (page calls Laravel directly) |
| 44 | POST | `/api/import/parse` | import/parse/route.ts | none | base env; forwards Authorization/Cookie/Referer; re-streams multipart | none (no size/type check in Next) | JSON | `api.session`; `mimes:csv,xlsx`, no size cap; unused route |
| 45 | POST | `/api/import/process` | import/process/route.ts | none | same as 44 | none | JSON | `api.session` only; no `staff.only`/`check_permissions` (NAPI-08 (LMS-AUDIT-064)); unused route |
| 46 | GET | `/api/import/tables` | import/tables/route.ts | none | base env; **no Authorization** | n/a | JSON | `api.session` -> 401 via this route; unused |
| 47 | GET, PUT, DELETE | `/api/integration-configs/:id` | integration-configs/[id]/route.ts | Authorization header present (any string) | none; in-memory `globalThis.integrationRecords` | `Number(id)`; body fields cast with `String()` | `{status:1,message,data}` / `{message}` 401/404 | none |
| 48 | GET, POST | `/api/integration-configs` | integration-configs/route.ts | same | none; module-level `records`/`nextId` (**different array from #47**) | none (`body.config` stored as-is) | `{status:1,data:{configs}}` returns all incl. secrets | none |
| 49 | POST | `/api/integration-configs/test` | integration-configs/test/route.ts | same | none | none | always `{status:1,success:true,message:"Connection to X tested successfully."}` (fake) | none |
| 50 | GET | `/api/library/books-list` | library/books-list/route.ts | none | base env, Bearer/Cookie/Referer forwarded, adds `X-Requested-With`; client query passed verbatim | none | JSON or `{raw}`; 502 echoes `target` and `cause` | `session` middleware (JWT via `type=API`); tenant from JWT |
| 51 | POST | `/api/library/dashboard/summary` | library/dashboard/summary/route.ts | none (token optional) | **CLIENT-BASE** `/api/library-dashboard/summary` | body free-form | pass-through | **NONE** (api.php:142); returns issued-book student names |
| 52 | GET | `/api/mcp/capabilities` | mcp/capabilities/route.ts | none | Bearer from `Authorization`; **`baseUrl` from query string** via `resolveAiBaseUrl` | none | `{tools:[{name,description,annotations}]}` / `{error}` 500 | `McpAuth` |
| 53 | GET | `/api/mcp/health` | mcp/health/route.ts | none | Bearer; base env / `resolveAiBaseUrl()` | none | Laravel payload / `{error}` 500 | `McpAuth` |
| 54 | POST | `/api/mcp/tools/call` | mcp/tools/call/route.ts | none | Bearer; **`baseUrl` from JSON body**; `meta.instituteId/academicYear/termId` from body; `confirmationToken` | `tool` required only; arguments untyped | Laravel `{success,data}` / `{error}` 500 | `McpAuth`, rate limit, institute validated vs JWT, confirmation-token workflow for writes (ToolRegistry:88-127) |
| 55 | GET | `/api/modules/menu-categories/registry` | modules/menu-categories/registry/route.ts | headers present | **CLIENT-BASE** via `laravel-category-proxy.ts` | none | pass-through | `api.session`+`check_permissions` |
| 56 | GET | `/api/modules/menu-categories` | modules/menu-categories/route.ts | headers present | **CLIENT-BASE**; forwards `module_name`,`level2_menu_id` | none | pass-through | same |
| 57 | GET | `/api/pal/content-model` | pal/content-model/route.ts | none | server fetches Laravel `/api/semantic-intelligence*` **unauthenticated** (`app/pal/data/*`) | `chapterId`,`concept` strings | payload / 500 with `error.message` | public read-only endpoints (api.php:660-662) |
| 58 | GET | `/api/pal/pedagogy-engine` | pal/pedagogy-engine/route.ts | none | Laravel `/api/pal/pedagogy-engine` unauthenticated | strings | payload / 500 | public (pal_api.php:31) |
| 59 | POST | `/api/pal/submit` | pal/submit/route.ts | none | **client base** (`x-laravel-base-url`) `/lms/pal`, Bearer+Cookie, raw form body, `redirect:'manual'`, scrapes `Location` for ids | none | `{status:'1',questionPaperId,onlineExamId}` / `{status:'0'}` | web route `session` (JWT); CSRF exempt on prod hosts only by full-URL wildcard (NAPI-12 (LMS-AUDIT-225)) |
| 60 | POST | `/api/process/convert` | process/convert/route.ts | **none** | local Gemini via `GOOGLE_GENERATIVE_AI_API_KEY`/`GEMINI_API_KEY`, `GEMINI_MODEL` | zod: text 20-20000, moduleKey<=60, allowAi bool | `{spec,issues,method,model,intakeText}`; errors `{error,code,detail}` (503/429/422/500) | n/a |
| 61 | POST | `/api/proxy-file` | proxy-file/route.ts | none | base env; `path` query -> `${base}/${path}`; forwards Authorization+Cookie; body text or multipart (buffered) | none; no size limit | **streams upstream body with upstream `Content-Type` + `Content-Disposition` (default `inline`)** | per target |
| 62 | GET, POST, PUT, PATCH, DELETE | `/api/proxy` | proxy/route.ts | none | base env; `path` query -> `${base}/${path}` (prefix rewrite for `proxy_master`); forwards Authorization, Cookie, Referer (GET); body text | none; path unsanitised (`..` allowed) | JSON (non-JSON -> `{raw:text}`); 502 echoes `message`,`cause`,`target` | per target route |
| 63 | GET | `/api/question-paper/asset` | question-paper/asset/route.ts | **none** | fetches `?url=` if origin in allow-list (`API_BASE_URL`, `AI_API_BASE_URL`, both `NEXT_PUBLIC_API_BASE_URL_*`, `QUESTION_ASSET_ORIGINS`); no credentials; **`redirect:'follow'`** | origin allow-list; content-type regex incl. svg; 8 MB checked after full download | image bytes, `Cache-Control: private, max-age=3600` | n/a |
| 64 | POST | `/api/screenCandidate` | screenCandidate/route.ts | **none** | DeepSeek -> OpenRouter (paid then 2 free models) -> Gemini; keys `SCREENING_DEEPSEEK_API_KEY`,`OPENROUTER_API_KEY`,`GEMINI_API_KEY` | only `resume`,`jdData` truthiness; no types/lengths | analysis JSON; errors `{error,details:<provider message>}` 500/503 | n/a |
| 65 | POST | `/api/students/dashboard/summary` | students/dashboard/summary/route.ts | none (token optional) | **CLIENT-BASE** `/api/students-dashboard/summary` | body free-form | pass-through | **NONE** (api.php:141); returns recent-enrolment student names |
| 66 | GET | `/api/teach-learn/menu-categories` | teach-learn/menu-categories/route.ts | headers present | **CLIENT-BASE** `/api/teach-learn/menu-categories`; only handler with a timeout (15 s) | none | pass-through / 504 on abort | `api.session`+`check_permissions` |
| 67 | POST | `/api/transportation/dashboard/summary` | transportation/dashboard/summary/route.ts | none (token optional) | **CLIENT-BASE** `/api/transportation-dashboard/summary` | body free-form | pass-through | **NONE** (api.php:144) |

Secrets (env var names only) read by this layer: `NEXT_PUBLIC_API_BASE_URL_PROD/DEV` (public by definition), `NEXT_PUBLIC_AI_BASE_URL`,
`AI_UPSTREAM_BASE_URL`, `AI_PROJECT_ID`, `GOOGLE_GENERATIVE_AI_API_KEY`, `GEMINI_API_KEY`, `GEMINI_MODEL`, `SCREENING_DEEPSEEK_API_KEY`,
`OPENROUTER_API_KEY`, `QUESTION_ASSET_ORIGINS`, `AGENTS_STORE_PATH`, `CONVERSATIONAL_AI_STORE_PATH`, `CONVERSATIONAL_AI_STATE_DIR`.
`.env.example` documents none of `AGENTS_STORE_PATH`, `CONVERSATIONAL_AI_*`, `QUESTION_ASSET_ORIGINS`, `AI_PROJECT_ID`, `NEXT_GOOGLE_CLIENT_ID`.
No secret is returned to the client by any handler *except* the integration-config secrets the client itself stored (NAPI-07 (LMS-AUDIT-007)) and the one-time
service-token plaintext (by design). No key is hard-coded in tracked source under this scope.

---



## Frontend -> Laravel calls (Part 09 section 5)

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



## Laravel endpoints (Part 10 section 5)

## 5. API endpoints consumed or exposed

Full machine inventory: **`part10-laravel-route-inventory.csv`** (3,094 rows). Compact view below.

### 5.1 Routes per file and lms_k12 usage (heuristic literal match, over-counts)

| File | Decl. | Referenced by lms_k12 | File | Decl. | Referenced |
|---|---|---|---|---|---|
| api.php | 429 | 304 | task_management.php | 87 | 64 |
| web.php | 324 | 88 | hrms.php | 80 | 23 |
| lms.php | 285 | 103 | adminapi.php | 63 | 9 |
| resultapi.php | 185 | 115 | organization_management.php | 54 | 53 |
| talent_management.php | 178 | 170 | easycomapi.php | 36 | 5 |
| student.php | 163 | 63 | teacherapi.php | 34 | 0 |
| pal_api.php | 151 | 95 | admission.php | 32 | 12 |
| fees.php | 149 | 46 | inventory.php | 27 | 0 |
| competency_management.php | 148 | 98 | frontdesk.php | 26 | 9 |
| g2g_lms.php | 148 | 47 | settings.php | 26 | 4 |
| result.php | 106 | 58 | user.php | 24 | 4 |
| brain.php | 93 | 93 | pal_eso_api.php | 22 | 20 |
| ai.php | 89 | 35 | (17 smaller files) | ≈250 | ≈100 |

**302 routes referenced by lms_k12 have no route-level auth** (api.php 233, web.php 26, student.php 13, result.php 10, adminapi.php 9, lms.php 5, pal_api 2, visitor 2, admission 1, g2g 1). Many are Tier A/A2 (they authenticate inside the controller); the Tier B/C ones are BE-01 (LMS-AUDIT-008)…BE-11 (LMS-AUDIT-048).

### 5.2 Anonymous (Tier C) endpoint families in `routes/api.php` — full controller list

(`prefix /api`; verbs abbreviated; each row = every route of that controller)

| Controller | Routes | Notes |
|---|---|---|
| `ApiLoginController` | POST `api-login`, GET `academic-terms` | intended public |
| `apiController` (legacy mobile) | POST `login, login_hills, check_otp, homescreen, teacherlogin, teacher_check_otp, playscreen, gcm_insert`, GET `testkey` | OTP flow, BE-15 (LMS-AUDIT-069) |
| `MobileWebHandoffApiController@claims` | GET `mobile/web-handoff/claims?ticket=` | intended public; secure |
| `MenuRightsController` | POST `menu-rights`, GET `master-menu-rights` | **SQLi**, BE-01 (LMS-AUDIT-008) |
| `ApiLmsCourseController` | GET/POST `lms-courses`, `lms-courses/search`, POST `lms-chapter-concepts`, `lms-chapters`, `lms-chapter-content`, `lms-questions`, `lms-question-bank`, `lms-question-bank/{create,update,delete,review}`, GET `question-mapping-levels`, POST `lms-chapters/store`, `lms-content-mapping-values`, `lms-store-subject` | **SQLi (search)**, anonymous CRUD |
| `ApiQuestionBankController` | GET/POST `question-bank/{filters,search,question-types}` | |
| `contentController@storeGammaContent` | POST `lms/gamma-content-master` | LLM spend; only throttle |
| `AiSopGenerationController`, `AiPlatformController` | GET `ai-sop`, `ai-sop/department-job-roles`, `ai-platforms`, POST `ai-sop/generate` (outbound `Http::timeout(90)` LLM call), `ai-sop/store` | anonymous LLM + write |
| `StudentHomeworkApiController` | POST `lms-homework/{get-subjects,get-chapters,list,store,show/{id},update/{id},delete/{id},bulk-delete,students,homework-subjects,submission-list,submission-store,submission-report,ai-status/{id}}` | 14 |
| `LmsAssignmentApiController` | POST `lms-assignment/{subjects,students,exam-papers,store,list,bulk-delete,submission-list,submission-store,ai-status/{id},annotate-list,annotate-questions,annotate-store}` | first (anonymous) registration; later duplicate registrations with `api.session` do **not** remove it |
| `admissionEnquiryAPIController`, `onlineAdmissionConfirmAPIController`, `admissionRegistrationAPIController` | GET/POST/PUT/DELETE `admission_enquiry`, `online_admission_confirm`, `admission_registration`, POST `admission_student`, GET `ajax_getDivision`, `admission_without_confirmation_report_v2` | **SQLi**, creates students |
| `ApiQuestionPaperController`, `QuestionPaperTemplateApiController` | apiResource `question-paper`, GET `question-paper/{id}/pdf`, POST `question-paper/search`, `question-paper-templates*` (6) | |
| `ExamEvaluationApiController` | 12 routes: sheets review/reprocess/delete/file, batches CRUD, `batches/{id}/sheets` upload, `batches/{id}/publish` | **gradebook write** |
| `AssessmentBlueprintApiController` | 10 routes incl. `hpc-options` save/reset, `clone` | |
| `IntelligenceLessonPlan/CurriculumPlanning/MonthlyPlan/LessonPlanDetail/LessonPlanPeriod/LessonPlanLookup/LessonIntelligence/SemanticIntelligence/ConceptIntelligence*` | 30 routes; `lesson-intelligence/micro-plan/*` = billable DeepSeek calls | anonymous LLM spend |
| `InteractionLogController` | GET/POST `interactions`, POST `interactions/store`, `interactions/{id}/update` | staff/parent/student touchpoint log |
| `DocumentTemplateApiController` | 12 routes | |
| `Admissions/Students/Library/Hostel/TransportationDashboardApiController` | POST `*-dashboard/summary` | PII (recent student names) |
| `StudentGraphController`, `StudentResultGraphController` | GET `student-assessment`, `student-results/{stuId}/graph` | student result graph (Neo4j) |
| `WhatsappController` + 2 closures | POST `update-message`, `incoming-message`, `whats-send-app`, `whats-comming-app`; GET `crm-whatsapp`, `crm-whatsapp-update` (`->withoutMiddleware(Authenticate)`) | BE-04 (LMS-AUDIT-016) |
| `instituteDetailController` | GET/POST `compliance/{list,create,update/{id},delete/{id}}` | controller has JWT calls (B2) |
| `MigrationModulesApiController` | GET/POST `migration-modules/{module}`, DELETE `migration-modules/{module}/{id}` | Tier B |

### 5.3 Tier B (JWT valid, tenant from request) — 46 controllers / 199 routes

`adminapiController` (40), `apiController`, `StudentSearch/BulkStudent/StudentInfirmary/StudentCare/StudentSetup/StudentOptionalSubject/StudentRegistrationApiController` (23), `ComplaintApiController`, `ConsentApiController`, `FrontDeskApiController`, `PhotoVideoGallaryApiController`, `PettyCashApiController`, `MigrationModulesApiController`, `admissionEnquiryController`/`admissionRegistrationController` (web), `lms_apiController` (17), `tblstudentController` (12), `studentHomework/HW/Health/Vaccination/Infirmary/Attendance/Certificate controllers`, `visitor_masterController` (5), `ptmattenedstatusController`, `calendar_controller`, `leaveApplicationController`, `parentCommunicationController`, `circular/discipline/photo_video_gallary/exam_schedule/school_detail` controllers, `send_sms_parents_controller`, `send_email_parents_controller`, `tbluserController`, `classwise/facultywise/proxyController`, `cbse_1t5_result_controller`, `classwiseGradeReportController` … (full list: CSV col G = `B-jwt-valid,client-tenant`).

### 5.4 Selected endpoint security table (verified by code reading)

| Method + URL | Auth (actual) | Validation | Notes |
|---|---|---|---|
| POST `/api/api-login` | none (public) | email required, password required | no throttle/lockout beyond 1000/min/IP; plaintext/md5 legacy fallback; first row by email |
| GET `/lms_data`, `/table_data` | **none** (web group, no `session`) | table must exist | dumps **any table**, `filters[col]=val`, `multiple[col]`, `all_tables=1`, `table_data=1&table_name=` (BE-01 (LMS-AUDIT-008)) |
| POST `/superAdmin-store` | **none** | none | creates Super Admin + rights on every menu (BE-02 (LMS-AUDIT-046)) |
| GET `/download-folder` | **none** | – | zips `he_staff_document/` from DO Spaces (BE-03 (LMS-AUDIT-047)) |
| GET `/api/crm-whatsapp` | **none** | none | WhatsApp send + SSRF + file write (BE-04 (LMS-AUDIT-016)) |
| POST `/ckeditor` | **none** | `isValid()` only | keeps client filename, `public/lms_editor_upload/` (BE-05 (LMS-AUDIT-014)) |
| POST `/api/menu-rights` | **none** | none | interpolated SQL (BE-01 (LMS-AUDIT-008)) |
| GET|POST `/api/lms-courses/search` | **none** | none | interpolated SQL (BE-01 (LMS-AUDIT-008)) |
| GET `/api/admission_registration` | **none** | none | interpolated SQL; `POST /api/admission_student` creates students |
| POST `/api/exam-evaluation/batches/{id}/publish` | **none** | tenant int cast | writes `lms_offline_exam(+_answer)` |
| POST `/api/leave/requests/{id}/decision` | JWT (tenant token-bound) | status enum | no role |
| POST `/api/users`, `POST /api/users/{id}` | JWT + rights | validated, unique per tenant | stores `plain_password` |
| GET `/api/users/{id}` | JWT + rights/self | – | returns `select *` incl. `password`, `plain_password`, `account_no`, `ifsc_code`, `pan_no`, `otp` |
| POST `/api/fees-refund/save` | `api.session` only | – | no `check_permissions` (unlike fees-dashboard/circular/cancel) |
| POST `/fees/PaidUnpaid` | `session`+`check_permissions` | `student_id`,`sub_institute_id`,`syear` required numeric | IDOR/cross-tenant (BE-11 (LMS-AUDIT-048)) |
| POST `/api/import/{parse,process,match-fields}` | `api.session` | `mimes:csv,xlsx`; `tablename`,`fields[]` client-supplied | column names from client; `csv_data_file_id` unscoped; upload to `public/import/` with client extension |
| POST `/api/ai/configuration`, `/api/ai/modules/{m}/models/credentials`, `/api/ai/policies` | `McpAuth` (students allowed) | validated | plaintext `ai_api_keys.api_key`; no role gate (BE-19 (LMS-AUDIT-006)) |
| POST `/api/mcp/tools/call` (`tools/call`) | `McpAuth` | tool schema | see BE-20 (LMS-AUDIT-178) |
| ANY `/fees/{icici,icici_orange,aggre_pay,payphi}/…ResponseHandler` | none needed by design | none | **unsigned** (BE-08 (LMS-AUDIT-011)) |
| GET `/api/mobile/web-handoff/claims?ticket=` | none (ticket) | – | secure single-use |

---



## API endpoints per module (verbatim)

### Part 01 - Auth, roles, menus

## 5. API endpoints consumed or exposed

### 5.1 Consumed/exposed by the auth & menu scope

| Method | URL | Auth | Validation | Notes |
|---|---|---|---|---|
| POST | `{API_BASE_URL}/api/api-login` | none | `email:required|email`, `password:required` | Direct browser -> Laravel (CORS `*` default, `config/cors.php`). No throttle beyond `throttle:1000,1` per IP (`Kernel.php:47`); no failed-login log; 422 `Academic Term Date Expired` and 403 `Please Contact Administrator For ERP Rights` are tenant-wide login blockers |
| GET | `{API_BASE_URL}/api/academic-terms?type=API&sub_institute_id&syear` | none | none | Returns `academic_year` rows for **any** tenant |
| GET | `{API_BASE_URL}/api/mobile/web-handoff/claims?ticket=` | ticket (single-use, 60 s, sha256 stored) | ticket non-empty | Ticket in query string (server logs, Referer); returned JWT has **no `exp`** even when `JWT_TTL_MINUTES>0` (`MobileWebHandoffApiController.php:237-244`) |
| POST | `/api/menu-rights` | **none** | none — SQL injection (AUTH-01 (LMS-AUDIT-010)) | Body: `sub_institute_id,user_id,user_profile_name,user_profile_id,client_id` (never `is_admin`) |
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
| `DocumentTemplateApiController` (12) | `document-templates/*` (unverified JWT decode, AUTH-06 (LMS-AUDIT-012)) |
| `AiSopGenerationController` (4), `AiPlatformController`, `JobroleApiController`, `PedagogyEngineController` (4), `CertificationsRecordsController` (1), `Student*GraphController` (2), `WhatsappController` (4), 2 closures | `ai-sop/generate|store`, `pal/pedagogy-engine*`, `student-assessment`, `student-results/{id}/graph`, `whats-send-app` |
| `MigrationModulesApiController`, `instituteDetailController` (compliance) | `migration-modules/{module}` GET/POST/**DELETE**, `compliance/{list,create,update,delete}` — *listed in routes as no-auth by middleware; controller not opened (`NOT VERIFIED`)* |
| Leave/Attendance concerns | authenticated (trait), **no role check** (AUTH-10 (LMS-AUDIT-004)) — not in this list |

Legacy web routes with only `web` (no `session`) — categories: mobile-app APIs (`teacherapiController` 40+, `adminapiController` 45+, `lms_apiController` ~17, `student*API`/`teacher*API` ~40 e.g. `studentAttendanceAPI`, `allStudentListAPI`, `teacherStudentListAPI`, `add_students/store`), `admin_login`, `NewLMS_signup*`, `preload-institute`, `ckeditor` (AUTH-04 (LMS-AUDIT-014)), `import_*`, `ai/*` (Gamma/AI generation), `paraphrase*`, `chat`, `geminiAI`, `studentLists`, `ajax_*`, `student/api/{student_certificate,student_icard,teacher_icard}/*`, `lms/api/teacher_resource/*`, careers explorer, public policy pages. Full list is reproducible from the route dump; not row-by-row reviewed.

### 5.3 Next.js route handlers reachable without a login (there is no gate at Next level for `app/api/*`)
All 67 `route.ts` are reachable by anyone who can reach the Next host. Files whose source contains **no** `authorization|bearer` handling at all (33): `agents/{route,[id],[id]/run,runs}`, `conversational-ai/projects*` (3), `fees/{audit-logs,online-payments,receipt-reprint,reconciliation-status}`, `fees/reports/*` (15, via `fees-report-proxy.ts`, token forwarded from `x-laravel-token` header), `import/{match-fields,tables}`, `modules/menu-categories[/registry]`, `pal/{content-model,pedagogy-engine}`, `process/convert` (server-side LLM call, no auth, see part02), `forgot-password`, `google-auth`. Remaining 34 read a token header or `Authorization`. Detail and severities: `part02-next-api-routes.md`.

---



### Part 04 - LMS / H5P / Exam / Result

## 5. API endpoints consumed or exposed

Auth column = what the Laravel route actually enforces (not what the frontend sends). "Anon" = no middleware beyond the `api` group `throttle:1000,1`. "api.session" = JWT verified, tenant/user from token. "web+menu" = `session,menu,logRoute,check_permissions` (JWT hydrated when `type=API`).

### 5.1 Result (`routes/resultapi.php`, prefix `api/result`, `api.session`)
| Method | URL | Auth | Validation | Notes |
|---|---|---|---|---|
| GET | `/api/result/marks-entry/create` | api.session | required filters | Returns students, `grd_data`, `approve_status`; 500 if exam id invalid (`$working_day[0]` undefined). |
| POST | `/api/result/marks-entry` | api.session | `values` array, `values.*.exam_id` only | Trusts `points/per/grade` (LMS-11 (LMS-AUDIT-077)). |
| POST | `/api/result/marks-entry/approve` | api.session | required ids | Any role; lock not enforced on save. |
| POST | `/api/result/marks-entry/{marks-approval,marks-dd,co-scholastic-marks-dd,get-result}` | api.session | student_id numeric | `get-result` accepts caller `sub_institute_id`/`syear` defaults. |
| GET/POST/PUT/DELETE | `/api/result/{exam-master,exam-type-master,grade-master,standard-grade-mapping,working-day-master,result-remark-master,result-master,exam-creation,result-book-master,co-scholastic-master,co-scholastic,hpc-skillset,hpc-activity-master,result-template}` (+`/bulk`, `/create`, `/dropdown`) | api.session | per-controller | Update/delete by bare id (LMS-03 (LMS-AUDIT-004)). |
| GET/POST | `/api/result/{student-attendance-master,co-scholastic-marks-entry,hpc-activity-entry,hpc-entry-v1,student-result-remarks,approve-mobile-result,upload-result}` | api.session | light | `upload-result`: `image.*` = `file` only (LMS-15 (LMS-AUDIT-081)). |
| GET/POST | `/api/result/{result-report,consolidate-report,classwise-grade-report,cbse-1t5-result,cbse-1t5-t2-result,cbse-11-t2-result,wrt-report,wrt-progress-report,overall-mark-report}` (+`/show`, `/pdf`, `/save-html`) | api.session | light | Rank helper forces term 149 in API mode (LMS-13 (LMS-AUDIT-079)). |
| GET/POST | `/api/result/student-result`, `POST /api/result/student-result/save-html` | api.session | `student_arr`, `term_id`, ... | Overwrites attendance/percentage (LMS-12 (LMS-AUDIT-078)). |
| GET | `/api/result/all-results[/{id}]`, `personalize-marks`, `pal-marks`, `map-value`, `current-result`, `dropdowns/*` | api.session | - | `all-results` "student token". |
| GET | `/api/get-{grade,standard,division,subject,exam-master,exam,co-scholastic,activity-master}-list` | **Anon** (`routes/result.php`, web group, no auth) | none | Tenant from `sub_institute_id` request param; unauthenticated school-structure enumeration (LMS-06 (LMS-AUDIT-021)). |
| GET/POST | `/result/marks_entry`, `/result/marks_entry/create`, `/result/exam_master` (+resource) | web+menu | legacy | Used by `/exam/marks-entry`, `/exam/exam-master` through `/api/proxy`. CSRF exempt only by host wildcard (LMS-32 (LMS-AUDIT-057)). |

### 5.2 Exam / question paper / online exam
| Method | URL | Auth | Validation | Notes |
|---|---|---|---|---|
| GET/POST | `/api/question-paper` (index) | **Anon** | tenant/syear presence only | **SQLi** via `whereRaw` interpolation (LMS-01 (LMS-AUDIT-017)); role from `user_profile_name` query. |
| POST/PUT/DELETE | `/api/question-paper`, `/api/question-paper/{id}` | **Anon** | none | Insert/overwrite/delete any paper; tenant from body. |
| GET | `/api/question-paper/{id}`, `/{id}/pdf` | **Anon** | - | `show` returns question rows + `answer_arr` including `correct_answer` to anyone. |
| POST | `/api/question-paper/search` | **Anon** | standard/subject required | **SQLi** via `search_chapter[]`/`search_topic[]` implode and tenant interpolation (LMS-01 (LMS-AUDIT-017)). |
| GET/POST | `/lms/online_exam` (paper load), `/lms/online_exam` POST (submit), `/lms/online_exam/{id}` (result), `/lms/online_exam_attempt` | web+menu | none | Score from client flags (LMS-07 (LMS-AUDIT-073)), SQLi in `show` (LMS-02 (LMS-AUDIT-018)), user from request (LMS-09 (LMS-AUDIT-075)). |
| POST | `/lms/submit-practice`, `/lms/adaptive-practice`, `/lms/student-profile`, `/lms/class-insights`, `/lms/teacher-dashboard`, `/lms/forgetting-curve` etc. | `routes/web.php` top level: **no middleware** | `student_id` from request | Server-side scoring is correct, but `student_id`/tenant are caller-supplied (LMS-09 (LMS-AUDIT-075)). |
| GET | `/api/question-mapping-levels`, POST `/api/lms-questions`, `/api/lms-courses`, `/api/lms-chapters`, `/api/lms-chapter-concepts`, `/api/lms-chapter-content` | **Anon** | tenant in body | |
| POST | `/api/question-bank/{filters,search,question-types}` | **Anon** | | |
| POST | `/api/lms-question-bank[/create|/update|/delete|/review]` | **Anon** | integer ids; delete/update have a chapter-owner-tenant check keyed on the **caller-supplied** tenant | Guard prevents accidents, not attackers (LMS-04 (LMS-AUDIT-019)). |
| POST | `/api/lms-chapters/store`, `/api/lms-store-subject` | **Anon** | | Creates chapters/subjects in any tenant. |
| POST | `/api/lms-create-content`, `/api/lms-store-content`, `/api/lms-chapter-content/upload` | `lms.auth` + `perm:lms.content,create` **warn-only** (anonymous allowed while `LMS_API_AUTH_ENFORCE` false) | `link` any string, `filename` any file | Role from client `user_profile_name` (LMS-21 (LMS-AUDIT-086)). |
| POST | `/api/lms/gamma-content-master` | `throttle.contentgen` only | tenant/user from body | Route comment says unauthenticated; used by `sideDrawer.tsx:783`. |
| POST | `/api/intelligence/questions/generate` | api.session+staff.only+throttle.qgen | | Correct pattern. |
| POST | `/api/intelligence/content/generate` | api.session+staff.only+throttle | | Not called by frontend (drawer still uses the anonymous sibling). |
| GET/POST/PUT/DELETE | `/api/question-paper-templates[...]`, `/paper/{id}` | **Anon** | tenant required | Tenant-scoped by caller value. |
| GET/POST/DELETE | `/api/assessment-blueprints[...]`, `/hpc-options` | **Anon** | tenant from body | |
| GET/POST/DELETE | `/api/exam-evaluation/{batches,sheets,answer-key,...}`, `POST .../batches/{id}/publish` | **Anon** | tenant, ids | Publishes to `lms_offline_exam` (gradebook) (LMS-05 (LMS-AUDIT-020)/25). |
| POST | `/api/lms-result-dashboard/summary` | api.session+staff.only | | Correct; NULLIF guards. |

### 5.3 LMS homework / assignment / planning / engagement
| Method | URL | Auth | Validation | Notes |
|---|---|---|---|---|
| POST | `/api/lms-homework/{get-subjects,get-chapters,list,store,show/{id},update/{id},delete/{id},bulk-delete,students,homework-subjects,submission-list,submission-store,submission-report,ai-status/{id}}` | **Anon** | `sub_institute_id`,`syear` numeric | Legacy family; `bulk-delete` without tenant filters deletes by id list (LMS-06 (LMS-AUDIT-021)); uploads unrestricted (LMS-15 (LMS-AUDIT-081)). |
| POST | `/api/lms-homework/{detail/{id},submission/store,submission/ai-status/{id},submission-file/{id},my-submissions}` | api.session | files `pdf,jpg,jpeg,png` 10 MB | `submissionStudentId` pins students. `submission-file/{id}` no ownership check (LMS-18 (LMS-AUDIT-084)). |
| POST | `/api/lms-homework/{review-list,review-detail/{id},review-store,review-reprocess/{id}}` | api.session+staff.only | `status` enum | No tenant/ownership scoping; `reviewed_by` from body (LMS-18 (LMS-AUDIT-084)). |
| POST | `/api/lms-homework/question-bank/{types,questions}` | api.session+staff.only | | |
| POST | `/api/lms-assignment/*` | api.session (+staff.only for authoring) | | Later registration shadows anonymous duplicates at `routes/api.php:325-337`. |
| GET/POST | `/api/intelligence/{lesson-plans,curriculum-planning[/chapter],monthly-plan,lesson-plan-detail,lesson-plan-lookup/*}`; POST `/api/intelligence/lesson-plan-periods[/{id}/update|delete]` | **Anon** | tenant required | Anonymous create/update/delete of lessons. |
| GET/POST | `/api/lesson-intelligence/{dropdowns,dropdowns/filter,capacity,calendar-events,macro-plan*,meso-plan*}`, POST `micro-plan/period/{id}`, `micro-plan/plan/{id}/batch` | **Anon** | tenant required | `dropdowns` lists **every school** (`school_setup`); `micro-plan` triggers billable LLM calls (LMS-06 (LMS-AUDIT-021)). |
| GET/POST | `/api/lms/concept-intelligence/tab-labels[/update|/reset]` | **Anon** (session wins if present) | | Anonymous rename/reset of tab labels per tenant. |
| GET | `/api/semantic-intelligence*`, `/api/lms/concept-intelligence/*` | **Anon** | | Read-only. |
| GET | `/api/lms/coherence-map*` | `lms.auth` (warn-only) (+`perm:lms.curriculum,update` on writes) | | |
| GET/POST | `/api/lms/leaderboard*`, `/api/lms/social-collaborative*`, `/api/lms/leaderboard-master*` | api.session (master +staff.only) | | Correct pattern. |
| GET/POST | `/lms/{lmsdashboard,lmsActivityStream,lmsStudent_report,lmsmapping,lms_syllabus,lb_master,ajax_*}` | web+menu | | Request tenant preferred (LMS-09 (LMS-AUDIT-075)). |
| POST | `/lms/show_question_wise_report` | web+menu | | |
| GET | `/school_setup/lessonplanningReport`, `/frontdesk/book_list` | web+menu | | |
| GET/POST | `/lms/api/teacher_resource/*` | **Anon** | tenant in request | No frontend caller. |

### 5.4 H5P
| Method | URL | Auth | Validation | Notes |
|---|---|---|---|---|
| GET/POST/PUT/DELETE | `/h5p/{scenario_based,h5p_interactive_video,h5p_flashacard,h5p_mcq,html_contents}[/{id}]` | web+menu | scenario `store`: **none for file**; video `mimes:mp4,mov,avi,mkv,webm|max:1024000`; flashcard: `question`,`correct_answer` strings | Legacy controllers: unscoped id lookups, request-tenant in API branch, no role checks (LMS-17 (LMS-AUDIT-083)). |
| GET/POST/PUT/DELETE | `/h5p/{h5p_drag_drop,h5p_drag_text,h5p_blanks,h5p_mark_the_words,h5p_image_hotspots,h5p_memory_game,h5p_course_presentation,h5p_arithmetic_quiz,h5p_single_choice_set,h5p_true_false}[/{id}]` + `/import`, `/media`, `/{id}/export|publish|duplicate` | web+menu | `saveRules()` per type; media `mimes` per role, extension from client name | Tenant-scoped (`findForTenant`), no role check on writes; export reads arbitrary local path (LMS-16 (LMS-AUDIT-082)). |
| GET | `/h5p/question_bank/{h5pType}` | web+menu | | |
| GET/POST | `/api/pal/h5p/{registry,hub,chapters,chapter-model,coverage,engagement,pedagogy/select,insights,suggest-tags,nodes/...,coverage-matrix}` | pal.auth | learner ownership enforced for `learner_id` | `POST /api/pal/h5p/xapi` and `/xapi/batch`: learner ownership enforced, `success` self-reported (LMS-22 (LMS-AUDIT-236)). |
| POST | `/get-h5p-ai-scenario`, `/get-h5p-ai-output` | **no middleware** | prompt/image only | LLM spend, TLS verification disabled (LMS-06 (LMS-AUDIT-021)/37). |
| POST | `/api/lms-question-bank` | Anon | | Used by question-bank library (`question-bank-library.ts:116`). |

### 5.5 Other
| Method | URL | Auth | Notes |
|---|---|---|---|
| GET/POST | `api/sqaa/{levels,entry/{menuId},entry,document-report}` via `/api/proxy?path=` | api.session | Validated; `POST` multipart broken by proxy (LMS-30 (LMS-AUDIT-213)). |
| GET/POST/DELETE | `/api/migration-modules/{module}[/{id}]` | JWT-valid only | Tenant/user/year from body (LMS-20 (LMS-AUDIT-085)). |
| GET | `/api/teach-learn/menu-categories` | api.session+check_permissions | Reached through Next proxy (LMS-19 (LMS-AUDIT-001)). |
| GET | Next `/api/question-paper/asset?url=` | Anon | Allow-listed image fetch; `redirect: 'follow'` (LMS-33 (LMS-AUDIT-209)). |
| GET | Next `/api/teach-learn/menu-categories` | Anon; forwards Bearer+Cookie to `x-laravel-base-url` header | SSRF (LMS-19 (LMS-AUDIT-001)). |
| any | Next `/api/proxy?path=` | Anon, forwards Authorization+Cookie to fixed `API_BASE_URL` | Reads bodies as text (binary corruption, LMS-30 (LMS-AUDIT-213)). Owned by another audit part. |

---



### Part 05 - PAL / AI / Intelligence

_(section 5 not found in part05-pal-ai-intelligence.md)_


### Part 06 - Fees / Finance / Operations

## 5. API endpoints consumed or exposed

Fees / finance (money flows). Auth column: **JWT** = `session`/`api.session` middleware validated the bearer token; **rights** = `check_permissions` (route-name based, see top of file); **-** = none.

| Method | URL (Laravel) | Called from | Auth | Validation | Notes |
|---|---|---|---|---|---|
| POST | `/fees/fees_collect/show_student` | `collect/page.tsx:209,320` (twice per search) | JWT + rights(`fees_collect.show_student` likely unmatched) | none | runs `getBk` per student (N+1), unpaginated server side |
| GET | `/fees/fees_collect/{id}/edit` | `collect/page.tsx:421`, `[studentId]:291` | JWT + rights(unmatched) | none | returns student PII + dues + bank list |
| POST | `/fees/fees_collect` | `[studentId]:519` | JWT + rights(unmatched) | none (uses `$_REQUEST`) | FIN-06 (LMS-AUDIT-113)/08/10/15 |
| GET | `/fees/fees_collect/{id}/ledger` | (no caller found) | JWT | none | backend-without-UI |
| POST | `/api/fees-cancel/search` | `cancel-refund:198` | api.session + rights | none | tenant from body (FIN-04 (LMS-AUDIT-029)) |
| POST | `/fees/fees_cancel` | `cancel-refund:286` | JWT + rights(unmatched) | required-only | tenant+user from body (FIN-04 (LMS-AUDIT-029)) |
| POST | `/api/fees-refund/search`, `/detail/{id}`, `/save` | `cancel-refund:747-774` | api.session + explicit gate | per-head cap | FIN-09 (LMS-AUDIT-116) |
| POST | `/fees/other_fees_collect` | via `/api/proxy` | JWT | none | FIN-15 (LMS-AUDIT-120) |
| POST/DELETE | `/fees/other_fees_cancel` | via `/api/proxy` | JWT | none | FIN-20 (LMS-AUDIT-301) |
| GET | `/fees/online_fees_payment_api/{gw}/preview` | `online-payment/[gateway]:110` via proxy | api.session | student id only | FIN-12 (LMS-AUDIT-119) IDOR |
| POST | `/fees/online_fees_payment_api/{gw}` | `app/api/fees/online-payment/[gateway]/route.ts` | api.session | Razorpay only meaningful | FIN-07 (LMS-AUDIT-114) |
| POST | `/fees/razorpay|hdfc|axis|aggre_pay|icici|payphi|hdfcrazorpay|icici_orange/...RequestHandler|ResponseHandler` | gateway browser redirects | **- (public)** | signature only for Razorpay | FIN-01 (LMS-AUDIT-011) |
| POST | `/fees/get_online_receipt` | mobile app | **- (public)** | opaque token | FIN-02 (LMS-AUDIT-027) |
| POST | `/studentFeesDetailAPI` | mobile app | JWT | none | FIN-02 (LMS-AUDIT-027)/12 |
| GET | `/fees/hdfc/getUTR`, `/fees/hdfc/createSplitPayout` | (cron/manual) | **- (public)** | none | FIN-16 (LMS-AUDIT-121) |
| GET | `/fees/receipt/reprint` | `receipt-reprint` page | api.session | requires ids | SQLi + cross-tenant (FIN-03 (LMS-AUDIT-028)/17) |
| GET | `/fees/audit_logs` | `reports/audit-logs` | api.session | none | FIN-11 (LMS-AUDIT-118) |
| GET | `/fees/online_payments`, `/{id}`, `/fees/reconciliation/status` | reports | api.session | none | FIN-11 (LMS-AUDIT-118) |
| POST | `/fees/fees_defaulter_report` and 12 other report POSTs/GETs | `fees-report-utils.ts` via Next proxies | JWT | none | FIN-03 (LMS-AUDIT-028)/05 |
| POST | `/api/fees-dashboard/summary`, `/defaulters` | `fees-dashboard-api.ts`, `collect/page.tsx:228` | api.session | `required` only | FIN-05 (LMS-AUDIT-112) |
| POST | `/api/{library,hostel,transportation,admissions,students}-dashboard/summary` | module dashboards | **-** | `required` only | FIN-13 (LMS-AUDIT-005) |
| GET/POST/DELETE | `/fees/online_fees_settings_api` | `online-fees-settings` via proxy | api.session | client-side only | FIN-16 (LMS-AUDIT-121) |
| GET/POST | `/fees/fees_config_master`, `fees_late_master`, `fees_receipt_book_master`, `fees_title`, `fees_breackoff`, `update_fees_breackoff(_api)`, `map_year`, `other_fee_map`, `NACH_*` | master pages | JWT + rights(index only) | mostly none | FIN-05 (LMS-AUDIT-112)/14 |

Operations (sub-audits A and B; Auth: J = JWT via `session`/`api.session` with token tenant, Jv = `jwtToken()->validate()` only with tenant from request, None = no auth):

| Method | URL | Auth | Notes |
|---|---|---|---|
| GET/POST/PUT/DELETE | `/api/inventory/{module}[/{id}]` (`routes/api.php:482-488`) | in-controller JWT + rights | `receivables/items`, `receivables/multiple` shadowed (FIN-45 (LMS-AUDIT-127)); `syear` client |
| GET/POST/PUT/DELETE | `/api/transportation-setup/{module}[/{id}]`, `student-mappings/bulk`, `bulk-delete` | in-controller JWT + rights | fare trusted (FIN-56 (LMS-AUDIT-317)) |
| GET/POST/PUT/DELETE | `/api/hostel-setup/{module}[/{id}]` (`routes/api_hostel.php`) | `api.session` + in-controller | allocation POST 403 (FIN-53 (LMS-AUDIT-131)) |
| POST | `/api/{library,hostel,transportation,admissions,students}-dashboard/summary` | **None** | FIN-13 (LMS-AUDIT-005) |
| POST | `/add_visitorAPI` (`teacherapi.php:87`), `/visitor_management/add_visitor_master` | **None** | FIN-39 (LMS-AUDIT-030)/66 |
| POST | `/get_adminVisitorListAPI`, `/get_visitorTypeAPI`, `/get_visitorAPI` | Jv | FIN-40 (LMS-AUDIT-126) |
| GET/POST | `/visitor_management/sendOtpVisitor`, `confirmOtp`, `get_student` | J | OTP echoed (FIN-67 (LMS-AUDIT-137)) |
| GET | `/map_student/fetchData` (`tranceport.php:38`) | **None** | FIN-57 (LMS-AUDIT-031) |
| DELETE/GET | `/map_student/bulk-delete`; `api/get-bus-list`, `api/get-stop-list`, `transportationLists/studentLists/{t_id}/{t_s_id}` | web group only | FIN-58 (LMS-AUDIT-318) |
| GET/POST/DELETE | `/books*`, `/quick_return`, `/check_issue`, `/check_item_availability`, `/all_book_lists`, `/scan_books*`, `/library_report`, `/show_library_report`, `/book_issue_report`, `/print_barcode`, `/generateBarcodePdf`, `/Lost_and_Damage*`, `/verified_book_report*` (`routes/web.php:579-611`) | `session` + route-name rights | FIN-59 (LMS-AUDIT-133)/60/62 |
| GET/POST | `/student/rollover[/create]`, `/student/student_transfer[...]`, `/student/show_student`, `/student/transfer_student`, `/student/student_bulk_update` | J + rights only if route name = menu link | FIN-69 (LMS-AUDIT-139)..74 |
| GET/POST/DELETE | `/custom-module/*` (11 routes); `GET /menuLevel2` | J, no rights (`menuLevel2` none) | FIN-64 (LMS-AUDIT-032)/65/81 |
| GET/POST | `/api/front-desk/photo-video-gallery[...]`, `/front_desk/circular[...]`, `/front_desk/exam_schedule`, `/calendar/calendar-api-*`, `/front_desk/parent_communication/create`, `/front_desk/leave_application/create` | Jv/J, client tenant | FIN-76 (LMS-AUDIT-145) |
| POST | `/school_setup/ajax_getTimetable*`, `ajax_saveTimetableEntry`, `ajax_deleteTimetableEntry`, `ajax_getClasswiseTimetableApi`, `ajax_getFacultywiseTimetableApi` | `api.session` (tenant from session) | FIN-84 (LMS-AUDIT-322) |
| resource | `/inward_outward/add_inward, add_outward, add_place_master, add_physical_file_location, show_*_report` | J + route-name rights, client tenant | FIN-78 (LMS-AUDIT-147)..80 |
| GET/POST | `/api/migration-modules/bazar-reports`, `bazar-upload`; `/api/petty-cash*` | Jv | FIN-82 (LMS-AUDIT-151)/85 |
| ANY | `/api/proxy?path=...`, `/api/proxy-file?path=...` (Next) | none at Next layer | FIN-43 (LMS-AUDIT-213) |

---



### Part 07 - Students / Admissions / Attendance

## 5. API endpoints consumed or exposed

`Auth` column: NONE = no authentication whatsoever; JWT-only = signature validated, identity/tenant taken from request; BOUND = JWT bound to tenant/user + rights.

### 5.1 Next.js route handlers in scope (exposed)

| Method | URL | Auth | Validation | Notes |
|---|---|---|---|---|
| POST | /api/students/dashboard/summary | forwards client Bearer; none of its own | requires sub_institute_id + syear only | base URL from client header `x-laravel-base-url` (SSRF, STU-30 (LMS-AUDIT-001)) |
| POST | /api/admissions/dashboard/summary | same | same | same |
| POST | /api/dashboard/{admin,teacher,student,teacher-fee-dues,teacher-icard,teacher-timetable} | forwards Bearer; teacher-icard requires token present | headers only | same SSRF pattern (`route.ts:42`) |
| GET/POST/PUT/PATCH/DELETE | /api/proxy?path=... | none of its own | only `path` non-empty | Forwards Authorization+Cookie to any Laravel path; owned by another audit part |
| POST | /api/proxy-file?path=... | none of its own | none | multipart forwarder |

### 5.2 Laravel endpoints consumed from this scope

adminapi (routes/adminapi.php; no route middleware, no `web` group so no CSRF):

| Method | URL | Called from | Auth | Validation | Notes |
|---|---|---|---|---|---|
| POST | get_adminStudentSearch | students/search_student/api.ts:115, ICards, house, health, discipline | JWT-only | tenant/syear required; filters typed | returns `tblstudent.*` + `tblstudent_enrollment.*` (incl. `password` hash); student scoping keyed on client `user_profile_name` (STU-05 (LMS-AUDIT-038)) |
| PUT | get_adminStudentSearch/{id} | search_student/api.ts:150 | JWT-only | fields validated loosely; no unique check on enrollment_no | name split, gender vocab (STU-18 (LMS-AUDIT-324)) |
| POST | get_adminAcademicSection / get_adminStandard / get_adminDivision | search_student/api.ts | JWT-only | | |
| GET | bulk-students/metadata | bulk_student_update/api.ts:56 | JWT-only | | |
| POST | bulk-students/search | :95 | JWT-only | | |
| PUT | bulk-students | :116 | JWT-only | field whitelist yes; no cross-field/dup/capacity validation | STU-19 (LMS-AUDIT-325) |
| GET/POST/PUT/DELETE | student-infirmary, student-infirmary/students, student-infirmary/{id} | student_infirmary/api.ts | JWT-only | | STU-20 (LMS-AUDIT-159) |
| GET/POST/PUT/DELETE | student-care/{module}[/{id}] | student-care-api.ts | JWT-only | student_id not tenant-checked; file upload ext from client | STU-20 (LMS-AUDIT-159)/39 |
| GET/POST/PUT/DELETE | student-setup/{quota|house}[/{id}] | setup-api.ts | JWT-only | delete unchecked | STU-24 (LMS-AUDIT-328) |
| POST / PUT | student-optional-subject/search, student-optional-subject | student-admin-api.ts:11-12 | JWT-only | | |
| GET / GET / POST | student-registration/metadata, /next-enrollment-no, student-registration | student-admin-api.ts:8-10, students/house | JWT-only | email not unique-checked; division capacity not checked; default password md5 | STU-16 (LMS-AUDIT-157) |

Legacy (`web` group; `session` middleware validates JWT for `type=API`; `check_permissions` fails open):

| Method | URL | Called from | Notes |
|---|---|---|---|
| GET | student/student_attendance | attendance-api.ts (direct to host), student_attendance/page.tsx | lists `class_teacher` rows for client `user_id` |
| POST | student/show_student_attendance | same | SQLi via `batch_sel` (non-teacher profiles), roster cross-tenant (STU-04 (LMS-AUDIT-037)/06) |
| POST | student/save_student_attendance | same | STU-10 (LMS-AUDIT-153) |
| POST | student/show_daywise_student_attendance | daywise page:301 | SQLi (`syear`, `date` concatenated) |
| POST | student/show_monthwise_student_attendance | monthwise page:677 + attendance-api.ts | SQLi (`month`) |
| POST | student/yearly_student_attendance | yearly page:348 | not reviewed in detail |
| GET | get_batch | monthwise page:524 | no middleware, reads empty session (STU-41 (LMS-AUDIT-337)) |
| GET/POST | student/missing_document_report/create, student/student_request_report_fixed/create, student/show_student_health_report, front_desk/dicipline_report/create, student/student_strength_report/create, student/agewise, student/add_student | student-report.ts, student_documents/api.ts | tenant from client in API branch |
| GET/POST | student/student_request_fixed, student/student_request, student/student_request/create, student/student_request/{id}/status | students/requests/api.ts | STU-37 (LMS-AUDIT-334) |
| GET/POST | student/api/student_certificate/{templates,search,preview,save,history} | StudentCertificateModule.tsx | NONE (STU-03 (LMS-AUDIT-036)) |
| GET/POST | student/api/student_icard/{metadata,search,preview}, student/api/teacher_icard/{metadata,search,preview} | student_icard/page.tsx, TeacherIcardModule.tsx | NONE (STU-03 (LMS-AUDIT-036)) |
| GET/POST | school_setup/proxy_master (+_method PUT/DELETE), proxy_master/create, ajax_getproxyperiod | proxy_master/api.ts | STU-21 (LMS-AUDIT-160) |
| GET/POST | admission/admission_follow_up | followUpApi.ts, follow-up-agenda-api.ts | index: enquiry_id un-scoped |
| GET/POST | admission/admission_enquiry (list), admission/admission_master | follow-up agenda, admission-form | |
| ANY | admission/{admission_enquiry_followup_report, admission_enquiry_report, admission_registration_report, admission_without_con_report, admission_confirmation_report_v2}, admission/admission_registration_report_v2[/{id}/edit] | admission_reports/api.ts | tenant from session (hydrated) |

api group (`/api/...`):

| Method | URL | Auth | Notes |
|---|---|---|---|
| GET/POST/PUT/PATCH/DELETE | /api/admission_enquiry[/{id}] | NONE | STU-01 (LMS-AUDIT-034) |
| GET | /api/admission_registration, /api/admission_registration/{id}/edit; PUT/PATCH /{id}; POST /api/admission_student; GET /api/ajax_getDivision; GET /api/admission_without_confirmation_report_v2[/{id}/edit] | NONE | STU-01 (LMS-AUDIT-034)/02 |
| GET/POST/PUT/PATCH/DELETE | /api/online_admission_confirm[/{id}] | NONE | STU-01 (LMS-AUDIT-034) |
| POST | /api/admissions-dashboard/summary, /api/students-dashboard/summary | NONE | STU-29 (LMS-AUDIT-005) |
| apiResource | /api/class-teachers | BOUND | |
| GET/POST | /api/teacher-transfer | BOUND | STU-22 (LMS-AUDIT-326) |
| POST/GET | /api/teacher-daily-reports/search, /{teacherId}/details; /api/user-logs/bootstrap, /search | BOUND | |
| GET/POST/PUT/PATCH/DELETE | /api/academic-setup/{module}[/{id}] | BOUND | STU-24 (LMS-AUDIT-328) |
| GET/POST | /api/users*, /api/user-profiles*, /api/user-reports/* | BOUND | STU-34 (LMS-AUDIT-061) |
| GET | /api/documents, /api/documents/sources, /api/documents/recent | api.session + admin profile list | correct |
| POST | /api/admin-dashboard/summary, teacher-dashboard, student-dashboard, teacher-timetable, teacher-fee-dues, teacher-icard/mine | api.session, role checked | correct |
| GET/POST/DELETE | /api/migration-modules/{module}[/{id}] | JWT-only | students-marks, dynamic-reports, bazar*; STU-33 (LMS-AUDIT-215) |
| GET/POST | /api/complaints*, /api/consents* | JWT-only + client tenant/user | not owned here |

Mobile/legacy endpoints in routes/student.php (not called by Next but same trust issues; exposed on the same host): `/studentAttendanceAPI`, `/studentTeacherListAPI`, `/studentHealthAPI`, `/studentDisciplineAPI`, `/studentLeaveApplicationAPI`, `/studentCertificateAPI`, `/notificationHubAPI`, `/teacherStudentListAPI`, `/allStudentListAPI`, `/studentParentcommunicationListAPI`, `/teacherParentcommunicationListAPI`, `/add_communicationAPI`, `circular/fetchData`, `circular/TeacherFetchData`, `/studentInfirmaryAPI`, `/studentVaccinationAPI`, `/studentHWAPI` - JWT-only with all identifiers from the body, except `studentParentcommunicationListAPI` which skips JWT unless `type=API` (STU-08 (LMS-AUDIT-040)).

---



### Part 08 - HR / Org / Tasks / General

## 5. API endpoints consumed or exposed

Auth column: `J` = JWT verified in controller, `AS` = `api.session` middleware (JWT -> session), `AS+S` = `api.session`+`staff.only`, `W` = legacy `session,menu,logRoute,check_permissions` (JWT hydrate when `type=API`), `NONE` = no authentication, `FORGE` = token decoded without verification.

### 5.1 Leave (`/api/leave/*`, J via `token` input; tenant from JWT, user from request)
| Method | URL | Validation / notes |
|---|---|---|
| GET | /leave/dashboard, /trend, /department-summary, /type-distribution, /holidays/upcoming | read only; KPIs are tenant-wide |
| GET | /leave/options | returns **all** tenant employees + departments + leave types to any caller |
| GET | /leave/balances | `employee_id` from request; balances of anyone |
| GET | /leave/requests | server-side filter/paginate (`per_page<=200`); returns email + mobile of every requester (`LeaveRequestApiController.php:60-77`) |
| GET | /leave/requests/{id} | any request in tenant, incl. reasons and balances |
| POST | /leave/requests | `employee_id` optional (apply for anyone), `user_id` from request; upsert of same-day pending row; no balance/overlap/holiday check |
| POST | /leave/requests/{id}/decision | status in approved,rejected,sent_back,cancelled,approved_lwp; no role/self check; overwrites any current status |
| POST | /leave/requests/bulk-decision | same, transactional |
| DELETE | /leave/requests/{id} | soft delete; only pending; **no ownership check** |
| GET | /leave/reports/summary, /register, /balance | tenant-wide, any caller |
| GET/POST/PUT/PATCH/DELETE | /leave/leave-types[/{id}[/status]] | tenant-scoped writes, no role |
| GET/POST/PUT/DELETE | /leave/holidays[/{id}] | duplicate check only on `from_date` (blocks per-department holidays on same day) |
| GET/POST | /leave/weekdays | weekly-off pattern; **not consulted by payroll** |
| GET/PUT | /leave/workflow, /leave/roles | persisted only; never enforced |
| GET | /leave/distribution | unused by this scope |

### 5.2 Attendance (J; tenant from JWT; `user_id`/`employee` from request)
GET `/attendance/my-attendance`, POST `/attendance/punch-in`, POST `/attendance/punch-out`, GET `/attendance/report-filters`, `/employees`, `/day-detail`, `/latest-activity-date`, `/weekly-summary`, `/kpi`. Legacy web calls: `/departmentwise-attendance-report/create`, `/show-early-going-hrms-attendance-report`, `/attendance-weekly`, `/KPI-HRITDashboard`, `/employee-attendance-monthly-report`, `/leave-distribution`, `/jobroles-by-department`. Frontend also references `/attendance`, `/attendance/check-in`, `/attendance/check-out` (older paths; NOT VERIFIED whether still used).

### 5.3 Payroll (legacy web routes, `W`; frontend sends token+context in query string or FormData)
| Method (frontend) | Path | Server route | Note |
|---|---|---|---|
| GET | /payroll-type | GET | ok |
| POST | /payroll-type/store | POST | upsert; `PayrollType::find($request->id)` unscoped; tenant from request under API |
| **POST** | /payroll-type/destroy/{id} | **DELETE only** (`hrms.php:31`) | mismatch -> 405 (HR-14 (LMS-AUDIT-167)) |
| GET/POST | /employee-salary-structure(/store) | GET,POST | ok |
| POST | /rollover-employee-salary-structure/store | POST | ok |
| GET/POST | /payroll-deduction(/store) | GET,POST | ok |
| GET | /monthly-payroll/create | GET | SQLi + client `user_profile_name` |
| GET | /getMonthlyData | GET | uses session tenant |
| POST | /monthly-payroll-store | POST | stores client totals verbatim |
| **POST** | /monthly-payroll-delete/{month} | route is `/monthly-payroll-delete` (`hrms.php:118`) | 404 (HR-14 (LMS-AUDIT-167)); backend delete is unscoped |
| POST | /form16-report | POST | |
| GET/POST | /hrms-salary-certificate, /hrms-salary-certificate-report | GET,POST | |
| GET | /salary-certificate-pdf-download, /monthly-payroll-report/pdf/{id}/{month}/{year} | GET | token in URL; `id` reaches raw SQL (`PayrollController.php:1421`) |
| GET | /api/departments-management | J | |
| GET | **/table_data** | **NONE** | HR-01 (LMS-AUDIT-008) |

### 5.4 Talent Management (AS+S; tenant from session). Complete route list from `routes/talent_management.php`
Recruitment: GET/POST/PUT/DELETE `job-postings[/{id}]`, GET `talent/team-overview`, POST `gemini/analyze-jd`, GET/POST/PUT `job-applications[/{id}]`, GET `job-applications/shortlisted`, `job-applications/candidate/{id}`, POST `job-applications/{id}/status`, GET `candidate`, `candidate-pipeline`, GET/POST/PUT `interview-details`, `interview-schedules[/{id}]`, GET `positions`, `interviewers`, POST `interviews/{id}/decision`, `interview-panel/{list,users,store,update/{id},delete/{id}}`, POST/GET/PUT/DELETE `evaluation`, `feedback[/{id}]`, GET `pending-feedback`, POST `talent-screening-results`, GET `talent-screening-results/candidate/{id}`, GET `offers`, POST `talent-offers`, `talent-offers/{id}/reject`, GET `talent-offer-letter/{id}`, `talent-templates`, POST `talent-acquisition/{kpis,dropoff,funnel,requisitions}`. Dashboard: GET `talent/dashboard`, `talent/dashboard/filters`.
Onboarding (`onboarding/*`): overview, filters, journeys CRUD + `from-offer/{id}`, stages (list/update/complete), contacts, timeline, workstreams, tasks (CRUD, bulk, complete), documents, notes, probation (get/update/confirm/extend/terminate).
Performance (`performance/*`): overview, filters, team-comparison, timeline, cycles CRUD+launch+close, reviews (board, bulk, CRUD, advance, reminder, notes, attachments), activity, goals, appraisals (bulk, CRUD, decision), compensation (bulk, CRUD, decision), bonus (bulk, CRUD, decision), calibration-sessions (CRUD, grid, calibrate, lock), saved-views.
Mobility (`mobility/*`): overview, filters, jobs, applications, transfers, promotions, successions, pools (+members). Offboarding (`offboarding/*`): overview, filters, cases (CRUD, status, clearance, documents, comments, exit-interview). Administration: GET `talent/admin/workflows`. Competency routes (`competency_management.php`) for employee profiles, certifications, development plans, career paths, learning assignments (not enumerated line by line).
External: GET `https://n8n.triz.co.in/ff441ace-...` (job posting webhook, unauthenticated, HR-29 (LMS-AUDIT-205)). Next: POST `/api/screenCandidate` (unauthenticated, HR-18 (LMS-AUDIT-056)).

### 5.5 Organization Management (AS only)
GET/POST/PUT/DELETE `organization-management/compliance-library[/{id}]` + `/dashboard,/calendar,/my,/overdue`, `/categories[/{id}]`, `/templates[/{id}[/duplicate]]`, `/evidence/{id}/{verify,reject}`, DELETE `/evidence/{id}`, GET/POST `/{id}/evidence`, POST `/{id}/complete`; `disciplinary-library[/{id}]`, `/departments/{d}/employees`; `employee-directory` GET/POST, `/teachers`, `/reference-data`, POST `/create`, GET/PUT/DELETE `/{id}`, PATCH `/{id}/status`, POST `/{id}/invite`, POST `/{id}/documents`, GET `/{id}/competency-profile`, PUT `/{id}/skills/{matrixId}`, `/analytics/{kpis,growth,growth-stacked,departments-distribution,job-roles-distribution,lifecycle,attrition,skills-matrix}`; `role-permissions/roles`, `/roles/{id}/rights` (admin-gated writes). Department (`/api/departments-management*`, J, tenant from JWT, no role) and `/api/ai-sop*` (NONE).

### 5.6 Task Management (AS+S)
Full list read from `routes/task_management.php:113-215` (82 routes): session, permissions*, statuses CRUD, priorities CRUD, integrations*, assignment-capacity, legacy-tasks (store, idempotent, PUT, versioned, DELETE), notifications, tasks, search, templates, reports/productivity*, reports/delays*, audit-logs, audit-logs/export, workspace (list, workload, show, activity, PUT, DELETE, approval, comments, time-entries, subtasks, recurrence, schedule, attachments + versions), deadline-extensions (+decision), dependencies CRUD, milestones CRUD, my-tasks (+status), projects (CRUD, archive, members, tasks, workstreams). `*` = `task.permission:report.view`. Also `deadline-extension`, `bulk-task/import`, `user-skills/{id}`, `competency/library/jobrole-tasks`, `competency/task-map[/for-task]`. Bare host: **POST `/task` (NONE)**, GET `/getSupervisor`, GET `/table_data` (NONE), `/gemini_chat`, `/search_data`, `/user/add_user/{id}/edit`. Next: `/api/integration-configs[/{id}|/test]` (HR-20 (LMS-AUDIT-007)).

### 5.7 Admin Services, Easy Com, General, Import, Templates
| Group | Endpoints | Auth |
|---|---|---|
| Complaint | GET/POST `api/complaints`, POST `/{id}`, `/{id}/delete` | J, tenant/user from request |
| Consent | GET `api/consents`, `/students`, POST `api/consents`, `/delete` | J, tenant from request |
| Front desk | GET `api/front-desk`, `/report`, `/{id}`; POST create/update/delete | J, tenant+user from request |
| Petty cash | `api/petty-cash[/heads][/{id}][/delete]`, `/report` | J, tenant from request |
| PTM / Visitor | `ptm/add_ptm_time_slot_master`, `ptm/add_ptm_attened_status`, `ptm/ptm_report`, `visitor_management/add_visitor_master`, `get_adminVisitorListAPI`, `get_adminStudentList`, `get_adminTeacherList` via `/api/proxy` | W / adminapi |
| Easy com | `easy_com/`: `sms-api`, `smtp`(+`/test`), `whatsapp-api` CRUD; `send-sms-parents`, `send-sms-staff`, `send-notification-parents`, `send-whatsapp-parents`, `send-email-parents` (+`recipients`/`groups`/`options`); `reports/{sms,email,notification,register-parent,whatsapp}` | AS |
| General | `general-setup/{module}`, `groupwise-rights`, `individual-rights`, `mobile-app-rights`, `fields-configuration`, `mobile-page-builder/*`, `mobile/dynamic-page-admin/*`, `onboarding/*` | J/AS with rights checks (good) |
| add_process | `requirements` resource (GET list/POST/PUT/DELETE/edit), `customers_requirement`, `api/ai-sop`, `ai-sop/department-job-roles`, `ai-sop/generate`, `ai-sop/store` | **NONE** |
| Import | `api/import/{tables,parse,process,match-fields}` | AS |
| Templates | `document-templates` list/show/store/update/delete/duplicate/versions/restore/merge-fields/merge-data/preview-students | **FORGE/NONE** |
| Menu | `POST /api/menu-rights` | **NONE** |

---



### Part 11 - Database

## 5. Table -> Model -> Controller -> Service -> API -> Frontend traceability (43 most important tables)

Method: model from `part11-model-table-map.csv`; controllers = files mentioning the table or model class, restricted to controllers that own routes referenced by `lms_k12` (`part10-laravel-route-inventory.csv` col H); frontend = files in `D:\lms_k12` containing the literal path. Status column is "trace confirmed by grep", not runtime proof.

| # | Table | Model(s) | Laravel controller(s) | Service / helper | API (Laravel path) | Frontend consumer (lms_k12) | Notes |
|---|---|---|---|---|---|---|---|
| 1 | `tbluser` | `loginModel`, `tbluserModel` (2 models) | `api/ApiLoginController`, `api/UserManagementApiController`, `api/OrganizationManagement/EmployeeDirectory/EmployeeDirectoryController`, `loginController` (web) | `Services/Rbac/PermissionService`, `Brain/Intelligence/GraphProjection`, `Services/Mcp/*` | `POST /api/api-login`; `GET|POST /api/users`; `GET|POST /api/organization-management/employee-directory` | `contexts/AuthContext.tsx`; `app/user/api.ts` (via `/api/proxy?path=api/users`); `app/organization-management/employee-directory/*` | trigger `neo4j_sync_tbluser_*`; plaintext `password`+`plain_password` |
| 2 | `tbluserprofilemaster` | `tbluserprofilemasterModel` | `UserManagementApiController`, `RolePermissionsController` | `PermissionService` | `/api/user-profiles`, `/api/organization-management/role-permissions/roles` | `app/general/api.ts`, `app/organization-management/role-and-permissions/*` | role names per tenant |
| 3 | `tblstudent` | `tblstudentModel` | `api/apiController` (student login), `student/tblstudentController`, `student/studentSearchController`, `api/StudentSetupApiController`, `dashboardController` | `Brain/Intelligence/LmsSignalRules`, `LmsAnalytics` | `POST /api/login`; `/student/add_student`; `POST /student/show_search_student`; `/api/students-dashboard/summary` | `app/student/add_student/page.tsx`, `app/students/_lib/students-dashboard-api.ts`, `app/student/_components/setup-api.ts` | live drift (`roll_no`) |
| 4 | `tblstudent_enrollment` | `tblstudentEnrollmentModel` | `studentSearchController`, `rollOverController`, `dashboardController`, `studentOptionalSubjectController` | `Services/Graph/StudentGraphProjection` | `/student/search_student`, `/student/rollover` | `app/student/add_student/page.tsx` | class/section per year |
| 5 | `attendance_student` | **none** (raw) | `student/studentAttendanceController`, `school_setup/teacherdailyReportController` | `Brain/Intelligence/LmsSignalRules`, `GraphProjection` | `GET /student/student_attendance`, `POST /student/show_student_attendance`, `POST /student/save_student_attendance` | `app/attendance/_lib/attendance-api.ts`, `app/student/student_attendance/page.tsx` | no unique / no tenant index |
| 6 | `timetable` | `timetableModel` | `school_setup/timetableController`, `classwisetimetableController`, `facultywisetimetableController`, `proxyController` | `Services/Mcp/TimetableService`, `LessonIntelligenceService` | `POST /school_setup/ajax_getTimetable*` | `app/front_desk/create-timetable/api.ts`, `app/api/dashboard/teacher-timetable/route.ts` | teacher->class link (memory) |
| 7 | `standard`, `division`, `sub_std_map`, `academic_year` | `standardModel`, `divisionModel`, `sub_std_mapModel`, `academic_yearModel` | `api/AcademicSetupApiController`, `school_setup/sub_std_mapController`, `AJAXController` | `Helpers/Helper.php` (57 refs to `standard`) | `GET|POST|PUT /api/academic-setup/{module}` | `app/academic_setup/api.ts` | setup masters |
| 8 | `class_teacher` | `classteacherModel` | `api/ClassTeacherApiController` | `Brain/GraphExplorer` | `/api/class-teachers` | `app/classteacher/api.ts`, `lib/class-options.ts` | |
| 9 | `fees_collect` | `FeesCollect` x2, `fees_collect` | `fees/fees_collect/fees_collect_controller`, `fees/fees_cancel/feesCancelController`, `FeesReportController` | `Services/Fees/FeeAuditService`, `Brain/FeesIntelligence`, `Helpers/Helper.php` | `/fees/fees_collect`, `/fees/fees_collect/{id}/ledger`, `/pending_fees` | `app/fees/collect/page.tsx`, `app/api/fees/reports/fees-collection/route.ts` | `receipt_no` via `max()+1` (`fees_collect_controller.php:1187,1989`) |
| 10 | `fees_payment` | **none** | `fees/online_fees/online_fees_collect_controller`, `online_payments_api_controller`, `reconciliation_status_api_controller`, `online_fees_payment_api_controller` | `Services/Fees/FeePaymentGatewayResolver` | `/fees/online_payments`, `/fees/reconciliation/status`, `/fees/online_fees_payment_api/{gateway}` | `app/api/fees/online-payments/route.ts` | varchar money/ids |
| 11 | `fees_breackoff` | `fees_breackoff`, `FeesBreackoff` | `fees/fees_breackoff/fees_breackoff_controller`, `student/rollOverController` | `AI/Fees/FeesPromptService` | `/fees/fees_breackoff` | `app/fees/master/fees-breakoff/page.tsx` | only well-keyed fee table |
| 12 | `fees_title` | `fees_title` | `fees/fees_title/fees_title_controller`, `other_fee_map_controller` | `Helpers/Helper.php` (29) | `/fees/fees_title` | `app/fees/master/new-fees-title-master/page.tsx` | |
| 13 | `fees_receipt_book_master` | `feesReceiptBookMasterModel` | `fees/feesReceiptBookMasterController`, `fees_collect_controller` | `InstituteBranding` | `/fees/fees_receipt_book_master` | `app/fees/master/fees-receipt-book-master/page.tsx` | receipt counter |
| 14 | `fees_cancel` | `feesCancelModel` | `fees/fees_cancel/feesCancelController` | `Brain/FeesSignalRules` | `POST /api/fees-cancel/search` | `app/fees/cancel-refund/page.tsx` | |
| 15 | `fees_refund` | `feesRefundModel` (unused) | `api/FeesRefundApiController` (raw `DB::table`) | `Brain/FeesIntelligence` | `POST /api/fees-refund/{search,detail/{id},save}` | `app/fees/cancel-refund/page.tsx` | FIN-09 (LMS-AUDIT-116) |
| 16 | `fees_circular_master`, `fees_circular_log` | `feesCircularMasterModel` | `fees/fees_circular/feesCircularController` | - | `POST /api/fees-circular/{filters,students,generate}` | `app/fees/circulars/page.tsx` | |
| 17 | `fees_razorpay` / `fees_hdffc` / `fees_icici` / `fees_axis` / `fees_aggre_pay` / `fees_payphi` (+ `fees_hdfcrazorpay` unresolved) | **none** | `fees/online_fees/online_fees_settigs_controller` | `FeePaymentGatewayResolver` | `/fees/online_fees_settings_api` | `app/fees/online-fees-settings/page.tsx` | plaintext secrets |
| 18 | `result_exam_master` | `ExamMaster` | `result/ExamMaster/ExamMasterController` | `Services/Mcp/ResultReportService` | `/result/exam_master` | `app/exam/exam-master/page.tsx` | `SubInstituteId varchar(255)` |
| 19 | `result_create_exam` | `exam_creation` | `result/exam_creation/exam_creation_controller` | `Brain/LmsQueryScope` | `/result/exam_creation` | `app/lms/exam/page.tsx`, `app/result/page.tsx` | |
| 20 | `result_marks` | `marks_entry` | `result/marks_entry/marks_entry_controller`, `result/new_result/studentResultController`, `api/ImportApiController` | `Brain/LmsSignalRules`, `ResultIntelligence` | `/result/marks_entry`, `/api/result/marks-entry/*`, `/api/import/*` | `app/exam/marks-entry/page.tsx`, `app/import-data/page.tsx` | `sub_institute_id string`, 0 indexes |
| 21 | `hrms_emp_leaves` | `HrmsEmpLeave` | `api/Leave/LeaveRequestApiController`, `leave/ApplyLeaveController` | `Services/Leave/LeaveAnalyticsService` | `GET|POST /api/leave/requests`, `POST /api/leave/requests/bulk-decision` | `app/hrit/_lib/leave-api.ts`, `.../LeaveRequestDetailsDrawer.tsx` | no tenant column |
| 22 | `hrms_leave_types` | `HrmsLeaveType` | `api/Leave/LeaveTypeApiController` | `LeaveAnalyticsService` | `/api/leave/leave-types` | `app/hrit/leave-management/leave-configuration/page.tsx` | |
| 23 | `hrms_attendances` | `HrmsAttendance` | `api/Attendance/AttendanceTrackingApiController`, `AttendanceDashboardApiController`, `HRMS/HrmsController` | `Brain/StaffAttendanceIntelligence` | `POST /api/attendance/punch-in|punch-out`, `GET /api/attendance/kpi` | `app/hrit/_lib/attendance-api.ts` | |
| 24 | `tblmenumaster` | `tblmenumasterModel` | `api/MenuRightsController`, `IndividualRightsApiController`, `GroupwiseRightsApiController` | `Services/Onboarding/OnboardingProgressService`, `PermissionService` | `POST /api/menu-rights`, `GET /api/master-menu-rights` | `app/hooks/useMenuRights.ts`, `app/components/DashboardShell.tsx` | SQLi (BE-01 (LMS-AUDIT-008)), CSV tenant list |
| 25 | `tblgroupwise_rights` (+ `tblprofilewise_menu`, no migration) | `tblgroupwise_rightsModel` | `api/GroupwiseRightsApiController`, `RolePermissionsController`, `loginController` | `PermissionService` | `GET|POST /api/groupwise-rights` | `app/general/groupwise_rights/api.ts` | join on a table no migration creates |
| 26 | `tblindividual_rights` | `tblindividual_rightsModel` | `api/IndividualRightsApiController`, `ApiLoginController` | `PermissionService` | `GET /api/individual-rights` | `app/general/individual_rights/api.ts` | |
| 27 | `lms_question_master` | `lmsQuestionMasterModel` | `api/ApiLmsCourseController`, `lms/assessmentQuestionController`, `lms/questionpaperController`, `lms/pal/palController` | `Services/PAL/Questions/PalQuestionForms`, `Eso/EsoPolicyService` | `/api/lms-question-bank/*`, `/api/lms-courses` | `app/course-master/data/chapters.ts`, `app/h5p/question-bank-library/page.tsx` | tenant split (memory) |
| 28 | `homework` | `studentHomeworkModel` | `api/lms/StudentHomeworkApiController`, `HomeworkSubmissionApiController` | `Brain/HomeworkIntelligence`, `HomeworkSignalRules` | `POST /api/lms-homework/*` | `app/lms/homework/api.ts` | 0 indexes |
| 29 | `lms_assignment` | `lms_assignmentModel` | `api/lms/LmsAssignmentApiController` | `Services/Mcp/AssignmentReportService` | `POST /api/lms-assignment/*` | `app/lms/lmsAssignment/api.ts`, `lmsAnnotate_assignment/api.ts` | duplicate route registration (part10 BE-07 (LMS-AUDIT-009)) |
| 30 | `lms_online_exam` (+ answers) | `lmsOnlineExamModel` | `lms/onlineExamController`, `lms/pal/palController` | `Services/Mcp/OnlineExamReportService`, `Graph/ResultGraphProjection` | `/lms/online_exam`, `/lms/pal/diagnostic*` | `app/lms/exam/page.tsx`, `app/lms/exam/_result-dashboard/api.ts` | no tenant col; trigger on this table |
| 31 | `exam_evaluation_batch/sheet/answer` | **none** | `api/ExamEvaluationApiController` (+ `Jobs/EvaluateAnswerSheetJob`) | `ExamEvaluationStorage` | `/api/exam-evaluation/*` | `app/lms/exam/_exam-evaluation/api.ts` | |
| 32 | `sub_std_map`, `lms_course_enroll` (G2G) | `sub_std_mapModel`, `LmsCourseEnroll` (unused) | `G2gLms/CourseBuilderController`, `AssignmentsController`, `CertificationsRecordsController` | - | `/api/g2g-lms/*` | `components/domain/lms/*` | |
| 33 | `learner_node_state`, `pal_concept_nodes` | `LearnerNodeState`, `ConceptNode` | `api/PAL/EsoEngineController`, `lms/pal/palController` | `Services/PAL/Plan/DiagnosticEsoBridge`, `MasteryOverviewService` | `/api/pal/eso/*` | `app/pal/data/pal-eso.ts` | tenant-1-only nodes (memory) |
| 34 | `pal_learning_sessions`, `pal_learner_states`, `pal_assessment_results` | `LearningSession`..., `LearnerState` | `api/PAL/*` (`PalWorkspaceController`) | `Services/PAL/*` | `/api/pal/*` | `app/pal/*`, `app/api/pal/pedagogy-engine/route.ts` | no tenant column |
| 35 | `admission_enquiry` | `admissionEnquiryModel` (soft delete) | `admission/admissionEnquiryController`, `api/admissionRegistrationAPIController`, `admission/admissionReportController` | `Services/Mcp/AdmissionMcpService`, `Domain/Admissions/Risk/StalledEnquiryDetector` | `/api/admission_registration*`, `/admission/admission_enquiry` | `app/admissions/admission_enquiry/page.tsx` | Aadhaar plaintext |
| 36 | `admission_registration` | `admissionRegistrationModel` | `api/admissionRegistrationAPIController`, `AdmissionsDashboardApiController` | `AdmissionMcpService` | `/api/admission_registration`, `POST /api/admissions-dashboard/summary` | `app/admissions/admission_registration/*` | |
| 37 | `task` (legacy) + `task_management_*` | `Task`, `taskModel` | `api/TaskManagement/WorkspaceController`, `MyTasksController` | `Services/Mcp/TaskService` | `/api/task-management/*` | `app/task-management/_lib/*` | dual UPPER/lower column naming |
| 38 | `library_books/items/book_circulations` | `LibraryBook`, `LibraryItem`, `LibraryBookCirculation` | `library/BookController`, `LibraryReportController`, `api/LibraryDashboardApiController` | `Services/Mcp/LibraryService`, `Brain/LibraryIntelligence` | `/books`, `POST /api/library-dashboard/summary` | `app/api/library/books-list/route.ts`, `app/library/book_resources/page.tsx` | no tenant column |
| 39 | `hostel_room_allocation` | `tblhostelRoomAllocationModel` | `api/HostelSetupApiController`, `HostelDashboardApiController` | `Services/Mcp/HostelOccupancyService` | `/api/hostel-setup/{module}`, `POST /api/hostel-dashboard/summary` | `app/hostel/setup-api.ts`, `app/api/hostel/dashboard/summary/route.ts` | no unique bed |
| 40 | `inventory_item_master` (+ 17 inventory tables) | `inventory_item_masterModel` | `api/InventoryApiController` | `Services/Mcp/InventoryService` | `/api/inventory/{module}` | `app/Inventory/api.ts` | only `lockForUpdate` users |
| 41 | `smtp_details`, `sms_api_details`, `sms_sent_parents`, `whatsapp_*` | none / `send_sms_parents` | `settings/smtpController`, `easy_com/send_sms_parents_controller`, `easycomapi` controllers | `Services/Mcp/CommunicationService` | `/settings/smtp_setting`, `/easy_com/send_sms_parents` | `app/easy_com/smtp/page.tsx` | plaintext SMTP password |
| 42 | `ai_api_keys` (+ `ai_*`) | **none** | `AI/AiConfigurationController`, `AiModuleModelController` | `Domain/AI/Support/ProviderKeyResolver`, `AiConfigurationResolver` | `/api/ai/configuration`, `/api/ai/modules/{module}/models` | `lib/intelligence/ai-configuration.ts` | `api_key mediumText` plaintext |
| 43 | `hpbrain_*` (107) | **none** (raw) | `Brain/BrainController` and 10 other `Brain/*` controllers | `Brain/Ingestion/FoundationIngestor`, `Brain/Intelligence/*` | `/api/brain/{tenantId}/...` | `lib/brain/api.ts`, `app/components/DashboardShell.tsx` | 65 of 107 tables unreferenced |

Also traced (no separate row): `circular` -> `front_desk/circular/circularController` -> `/front_desk/circular` -> `app/front_desk/*`; `tblstudent_document` -> `student/studentTransferController` -> `app/Utility/student-transfer/api.ts`; `admission_*` reports; `easy_com` -> `app/easy_com/*`.

---



### Part 12 - Uploads / Import-Export / Notifications / Jobs / Integrations

## 5. API endpoints consumed or exposed

### 5.1 Phase 13 - Upload / write-to-disk sites (classification of all sites)

Columns: controller@method (file:line of the write) | route (file) and tier | validation | filename source | disk : path | served how | tenant in path | download authorization. `ext-client` = extension from `getClientOriginalName()/File::extension/getClientOriginalExtension()`. "none" validation means no `mimes:`/`max:` on that file input in the method (verified by 28-line look-back).

| # | Site | Route / tier | Validation | Filename | Disk : path | Served | Tenant path | Download authz |
|---|---|---|---|---|---|---|---|---|
| 1 | `CkeditorFileUploadController@store` :30 | `POST /ckeditor` (web.php:488) **T0** | none | `rand(1000,9999).clientName` | WEB `lms_editor_upload/` | direct | no | none (BE-05 (LMS-AUDIT-014)) |
| 2 | `oldDocumentTransfer@storeImagesToDigitalOcean` :63 | `POST /transferDocs` (web.php:654) **T0** | none | source file names | DO `public/<digi_directory>/` (request-chosen) | CDN public | no | none (**INT-02 (LMS-AUDIT-050)**) |
| 3 | `oldDocumentTransfer@ConvertBinaryData` :234 | `GET /convertDoc` (web.php:655) **T0** | none | JSON file names | DO `public/student_document/` | CDN | no | none (INT-02 (LMS-AUDIT-050)) |
| 4 | `WhatsappController@whatsappCRM` :596 | `GET /api/crm-whatsapp` (api.php:183) **T0** | none | `basename($file_url)` | WEB `whatsapp/wp_sent_files/` | direct | no | none (**INT-01 (LMS-AUDIT-016)**) |
| 5 | `admissionEnquiryController@paymentProof` :1067 | `POST /admission_enquiry/payment_proof` (admission.php:81) **T0** | none | `<enquiry_id>.<ext-client>` | DO `public/admission_payment/` | CDN | no | none (INT-10 (LMS-AUDIT-190)) |
| 6 | `admissionRegistrationHillController@sendEmail` :410 | admission.php T1 | none | `date('YmdHis').ext-client` | PUB `email/` | /storage | no | none |
| 7 | `api\adminapiController` :872,2143 (delegates), :1140 (mail attachment), :1592,:1713 (front desk), :2708,:2734,:2803 (face capture) | adminapi.php **T3** (JWT check per method) | `Validator::make` present on some; no mimes | ext-client + `date`/`rand(10000,99999)` | PUB `email/`, `frontdesk/`, `capture_photos/<student>`, `capture_attendance/<date>/<std>-<div>` | /storage | student id / std only | none |
| 8 | `api\teacherapiController` :446,:1463 (DO `lms_content_file`), :734 (`lms_teacher_resource`), :1581,:1817 (front desk) | teacherapi.php **T3** | `Validator::make` partial; no mimes | `date('Y-m-d_h-i-s').ext-client` | DO + PUB | public | no | none |
| 9 | `api\ApiLmsCourseController` :997,:1500 (base64 put), :1009,:1531 | `api/lms-chapter-content/upload` (T4 `lms.auth`+perm), `lms-store-content` (T4) | presentation branch `mimes:pdf,ppt,pptx|max:102400` (`:1583`); other branch `max:10240` only | `date('Y-m-d_h-i-s')` + ext-client | DO `public/lms_content_file/` | CDN | no | none |
| 10 | `lms\contentController` :319,:499,:511,:781 | lms.php T1 | none | `date('Y-m-d_h-i-s')` + ext-client | DO `public/lms_content_file/` | CDN | no | none |
| 11 | `Services\lms\Content\ContentUploadService::store` | `lms-*` authoring (T4) | **extension allow-list per type + 100 MB cap + sha256 + exists() verify** | `Str::uuid()` | DO `lms_content_file/<tenant>/<chapter>/` (**ACL public**) | CDN | **yes** | none (public) - model implementation |
| 12 | `lms\content_library\contentLibraryController` :211,:314 (+ `...Old` :192,:328 unrouted) | lms.php T1 | `Validator::make` (no mimes) | `time()`+ clientName | DO `public/content_library/` | CDN | no | none |
| 13 | `lms\h5p\H5PContentTypeController` :430/:440, `H5PDragDropController` :371/:381, `H5PTextActivityController` :435/:445, `H5PInteractiveVideoController` :85/:97,:231/:243, `H5PScenarioController` :77/:90,:207/:220 | lms.php T1 | image `mimes:jpg,jpeg,png,gif,webp|max:8192`, video `mimes:mp4,...|max:1024000` (1 GB), audio; scenario image **only `isValid()`** | `date('Y-m-d_H-i-s')` + ext-client (+uniqid on video) | DO `public/h5p_content/` **and** local fallback `public/h5p_content` (WEB) | CDN / direct | no | none (LMS-15 (LMS-AUDIT-081)) |
| 14 | `lms\lmsDoubtController` :102, `lmsPortfolioController` :163,:258, `virtualclassroomController` :210, `teacher_resource\lms_teacherResourceController` :165,:306, `TeacherResourceApiController` :292, `school_setup\sub_std_mapController` :105,:226 | lms.php / web T1 | none | `date('Y-m-d_h-i-s')` + ext-client | DO `public/lms_doubts|lms_portfolio|lms_content_file|lms_teacher_resource|SubStdMapping/` | CDN | no | none |
| 15 | `lms\assignment\assignmentSubmissionController` :83, `api\lms\LmsAssignmentApiController` :379 (QP pdf), :759 (submission) | lms.php T1; `lms-assignment/*` in `api_guard.protect` | none | `date('YmdHis')`+ext-client / `time().uniqid()` | PUB `lms_assignment_submission/`, `QuestionPaper/` | /storage | no | none |
| 16 | `api\lms\StudentHomeworkApiController` :187,:838,:1187 (base64), `HomeworkSubmissionApiController` :321 | `lms-homework/*` T3 (`api_guard.protect` -> JWT) | submission: `files.*` `mimes:pdf,jpg,jpeg,png|max:10240` (`HomeworkSubmissionApi:280`); `StudentHomework` store: none | `date`+ext-client / `time()`; base64 path `uniqid` | PUB `student/`, `<directory>/` | /storage | no | `submission-file/{id}` returns URL for **any** homework id (INT-35 (LMS-AUDIT-377)) |
| 17 | `student\studentHomeworkController` :209, `studentHomeworkSubmissionController` :151 (+ HF call) | student.php T1 | none | date | PUB `student/` | /storage | no | none |
| 18 | `student\tblstudentController` :262,:267,:341,:1430,:1506 (photo) / :296,:320,:1460,:1484 (parents) | student.php T1 | photo: 500 KB check on `student_image` only (`:250`); others none | `<id>.<ext>` / `<user_name><YmdHis>.<ext>` | PUB `student/`; DO `public/parents_image/` | /storage, CDN | parents only (`father_<enr>_<tenant>`) | none; enumerable ids (STU-38 (LMS-AUDIT-335)) |
| 19 | `student\tblstudentDocumentController@store` :58 | student.php T1 + `type=API` tenant from request | none | `<student_id><YmdHis>.<ext>` | DO `public/student_document/` | CDN | no | none (INT-10 (LMS-AUDIT-190)) |
| 20 | `student\bulkStudentController@bulkUpdate` :557-622 | student.php T1 | none | `<id>.<ext>` or `<field>_<id>_<date>_<clientName>` | PUB `student/`; DO `parents_image/` | /storage | no | none |
| 21 | `student\studentBulkUpdateController` :151 | student.php T1 | `ext in [xlsx,xls]` (client name, case-sensitive) | `student_active_inactive_list_<time>.<ext>` | PUB `student_active_inactive_list/` | /storage, **never deleted** | no | none |
| 22 | `student\studentHealthController` :99,:180; `api\StudentCareApiController` :118 (base64 `file_data`, ext from client `file_name`) | T1 / adminapi T3 | none | date / `health_document_<date>_<uniqid>.<ext-client or bin>` | PUB `frontdesk/` | /storage | no | none |
| 23 | `user\tbluserController` :134,:447 (photo), :550 (staff doc) | user.php T1 | none | `<user_name><YmdHis>.<ext>` | PUB `user/`; DO `public/staff_document/` | /storage, CDN | no | none |
| 24 | `api\OrganizationManagement\EmployeeDirectory\EmployeeDirectoryController` :931 (doc), :1228 (photo) | T2 `staff.only` | validator present (HR-31 (LMS-AUDIT-340)); ext-client | `<userid><YmdHis>.<ext>` / `<user_name><YmdHis>.<ext>` | PUB `staff_document/`, `employee_directory/` | /storage | no | none (HR-31 (LMS-AUDIT-340)) |
| 25 | `Payroll\PayrollController` :1503 (payslip PDF) | hrms.php T1 | n/a (generated) | **`emp_<id>_payslip_<month>_<year>.pdf`** | DO `public/staff_document/` ACL public | CDN | no | none (**INT-07 (LMS-AUDIT-187)**) |
| 26 | `TalentManagement\Recruitment\JobApplicationController` :109,:289 (resume) | T2 `staff.only` | `mimes:pdf,doc,docx|max:5120` | `resume_<tenant>_<first>_<middle>_<last>.<ext>` | DO `public/hp_resume/` | CDN | partial | none (HR-19 (LMS-AUDIT-170)) |
| 27 | `Recruitment\OfferController` :196 (offer letter PDF) + local copy `storage/app/public/<file>.pdf` | T2 | n/a | `offer_letter_<id>_<name>.pdf` | DO `public/offerLetter/` + PUB | CDN, /storage | no | none (INT-07 (LMS-AUDIT-187)) |
| 28 | `Competency\CertificationController` :976; `Onboarding\OnboardingDocumentController` :318; `Performance\PerformanceActivityController` :478; `Compliance\ComplianceEvidenceController` :78; `ComplianceLibraryController` :643 | T2 `staff.only` | certification `mimes:pdf,jpg,jpeg,png,doc,docx|max:10240` (`:948`); onboarding/performance validated partially (`uniqid('onb_'/'perf_')` names, good); compliance `max:20480` | uniqid / `time()`+name | DO `competency_certifications/` / PUB `...` | CDN / /storage | partial | none |
| 29 | `TaskManagement\TaskAttachmentVersionController@store` :65 / `@download` :101 | T2 `staff.only` + `task.permission` | `max:20480` | storeAs (custom) | private disk (`self::DISK`) | **authorised download** | yes | tenant/row check (good) |
| 30 | `api\PettyCashApiController@storeBill` :121 | `petty-cash` (api.php:833) **T3, no auth in controller** | none | `<userId>-<time()>.<ext-client>` | WEB `pettycash/` | direct | no | none (BE-05 (LMS-AUDIT-014)/FIN-77 (LMS-AUDIT-146)) |
| 31 | `frontdesk\PettyCashController` :82, `implementation\frontdesk\PettyCashController` :76 | T1 | none | `time()`+ext | WEB `pettycash/` | direct | no | none |
| 32 | `api\FrontDeskApiController@storePhoto` :125, `ComplaintApiController@storeAttachment` :98, `PhotoVideoGallaryApiController` :157,:236 | `front-desk`, `complaints`, `front-desk/photo-video-gallery` (api.php:788-820) **T3 - no auth** | none | `date('YmdHis')`/`time().uniqid()` + ext-client | PUB `frontdesk/`, `photo_video_gallary/` | /storage | no | none (INT-10 (LMS-AUDIT-190)) |
| 33 | `frontdesk\{complaint,frontdesk,task}Controller` (6 sites) and `implementation\frontdesk\*` (6 sites) | T1 | none | `date('YmdHis')` + ext-client | PUB `frontdesk/` (shared by 5 modules) | /storage | no | none |
| 34 | `front_desk\circular\circularController` :286, `exam_schedule` :89, `leave_application` :327, `photo_video_gallary` :269, `syllabus` :134 (DO) / :155 (dompdf PDF DO), `book_list` :156, `classworkAttachmentController` :232 | student.php / frontdesk.php T1 | leave application `Validator::make` only; others none | `date('YmdHis')` + ext-client | PUB or DO `public/<module>/` | /storage / CDN | no | none |
| 35 | `front_desk\studentFaceAttendanceController` :150,:176, `classFaceAttendanceController` :95 | frontdesk.php T1 | none | ext-client + `rand(10000,99999)` | PUB `capture_photos/<student>/`, `capture_attendance/<date>/<std>-<div>/` | /storage | student id | none (**faces**, INT-14 (LMS-AUDIT-194)) |
| 36 | `visitor_management\visitor_masterController` :208,:303 | T1 + teacherapi T3 | none | `visitor_<Y-m-d_h-i-s>.<ext-client>` | PUB `visitor_photo/` | /storage | no | none |
| 37 | `inward_outward\inwardController` :129,:238, `outwardController` :128,:231 | T1 | none | `date('YmdHis')`+ext | PUB `inward/`, `outward/` | /storage (guessable) | no | none (FIN-77 (LMS-AUDIT-146)) |
| 38 | `inventory\inventory_item_masterController` :90,:182, `inventory_master_setupController` :68,:144, `api\InventoryApiController@saveMaster` :1042,:1053 | T1 / T3 (`InventoryApiController:73` verifies JWT) | `max:255`/`max:50` only | ext-client | PUB `inventory_item/`, `inventory_master/` | /storage | no | none (FIN-51 (LMS-AUDIT-130)) |
| 39 | `library\BookController` :268,:275 | web.php T1 | none | **client file name** | disk `books` = WEB `uploads/books/` | direct | no (cross-tenant overwrite) | none (FIN-51 (LMS-AUDIT-130)) |
| 40 | `fees\feesReceiptBookMasterController` :216,:225, `tblfeesConfigController` :84,:205 | fees.php T1 | none | `date('YmdHis')`+ext | PUB `fees/` | /storage | no | none (FIN-38 (LMS-AUDIT-125)) |
| 41 | `fees\NACH\s2excel_import` :55, `s4excel_import` :104 | fees.php T1 | none | `NACH_S4_Import_<date>.<ext-client>` | PUB `NachExcel/Uploads/` | /storage, retained | no | none (FIN-38 (LMS-AUDIT-125)) |
| 42 | `fees\fees_reconciliation\...@store_fees_reconciliation_data` :58 | fees.php T1 | ext in [xlsx,xls,csv] | `fees_reconciliation_<time>.<ext>` | PUB `fees_reconciliation/` | /storage, retained | no | none (INT-13 (LMS-AUDIT-193)) |
| 43 | `bazar\bulkUploadSheetController` :65,:176,:277 | lms.php `bazar` T1 | ext in [xlsx,xls] | `bazar_<kind>_<time>.<ext>` | PUB `bazar/` | /storage, retained | no | none |
| 44 | `api\ImportApiController@parse` :43, `Import\ImportController` :47,:128 | `api/import/parse` T2; `/import_parse`,`/custom_import_parse` **T0** | `mimes:csv,xlsx` (API) / `mimes:csv` (custom) / **none** (`parseImport`) | `<tenant>_<syear>_<rand5>.<ext-client>` | WEB `import/` | direct, **never deleted** (13 files present in working copy) | prefix only | none (INT-05 (LMS-AUDIT-052)/INT-12 (LMS-AUDIT-192)) |
| 45 | `result\result_master` :102-271 (6), `result_book_master` :129-237 (4), `upload_result_controller` :156, `school_setup\schoolController` :53,:115, `settings\manageInstituteController` :80,:234 (WEB `admin_dep/images` + PUB `user/`), `announcementController` :104,:195 (DO), `organizationDetailsController` :159,:208 (DO), `instituteDetailController` :188,:319 (DO `compliance_library`) | result.php / settings.php / web.php T1 | none / validator | `date('YmdHis')`+ext | PUB or DO or WEB | mixed | no | none |
| 46 | `hostel_management\hostel_masterController` :114,:136, `transportation\add_driver_controller` :74,:158 | T1 | none | date+ext | PUB `hostel_master/`, `driver/` | /storage | no | none |
| 47 | `custom_module\CustomModuleController` :798,:809,:814 | custom_module.php T1 | `->validate(` (other fields) | `time().ext-client` | WEB `images/` | direct | no | none (FIN-77 (LMS-AUDIT-146)) |
| 48 | `sqaa\sqaa_controller@generatePdf` :233, `sqaa_controller@unlink_file`, `sqaa\sqaaReportController` :153, `sqaa_controller` :157, `api\sqaa\SqaaApiController` :154 | web.php T1 / resultapi T2 | API `mimes:pdf,xlsx,doc,docx`; web none | `<tenant>_pdf_menu<req>_doc<req>.pdf` (request pieces) | WEB `sqaa/`; DO `public/sqaa/` | direct / CDN | tenant prefix | none (INT-03 (LMS-AUDIT-051)/INT-35 (LMS-AUDIT-377)) |
| 49 | `BlogController` :60,:115 | web.php (T1 or T0 - `blogs` routes) | `max:2048` | `date('YmdHis')`+clientName | DO `public/blogs/` | CDN | no | none |
| 50 | `G2gLms\CourseBuilderController` :386, `LearningCatalogController` :607 | g2g T2 `staff.only` | image validation | `date`+ext | PUB `lms_course/`, `hp_course/` | /storage | no | none |
| 51 | `easy_com\send_email_parents` :115, `send_email_other` :93, `api\easy_com\SendEmailParentsApiController` :238 | result.php/student.php T1; easycomapi T2 | API: `mimes:pdf,doc,docx,xls,xlsx,csv,txt,png,jpg,jpeg,zip...|max:10240`; web none | `date('YmdHis')`/stored name | PUB `email/` | /storage, retained | no | none |
| 52 | `api\AiSopGenerationController` :397 (SOP PDF), Jobs `Evaluate*` (:151/:226/:206/:321 annotated PDFs), `ContentGenerationService` :284, `LmsSocialCollaborativeService` :149 | T2 / jobs | n/a (generated) | generated | DO `public/...` | CDN | partial | none |
| 53 | `api\NewLMS_ApiController` :348/:350, `settings\manageInstituteController` :82,:236 (logo -> PUB `user/` + WEB) | web/api | none | `time()` | PUB/WEB | direct | no | none |
| 54 | `AI\AiAssistanceTicketController@storeScreenshot` :190 | ai.php (`McpAuth`) | `Str::random(8)` name, `local` disk | random | **PRIV** | admin-only, tenant-checked (`:151`) | yes | **authorised** - model |
| 55 | `Services\Evaluation\ExamEvaluationStorage::putSheet` :54 | `exam-evaluation/*` (api_guard + tenant) | `finfo` allow-list pdf/jpg/png + 20 MB (note: `detectMime` also accepts `getClientMimeType`) | `batch-<id>-<random24>.<ext>` | **PRIV** `storage/app/exam_evaluation/` | `GET .../file` tenant-checked | yes | **authorised** - model |
| 56 | AJAX/report renderers `AJAXController` :1618,:1720,:1887,:1989,:3235, `monthwiseReceiptPdfController` :152, `cbse_1t5_*` x8, `TemplateResult` x2, `allResultController` :78, `adminapiController` :2620, `questionpaperController` :395,:433,:1825 (HTML + PDF of receipts/result cards/question papers) | T1 / T2 | n/a | `<student_id>_<YmdHis>.html/.pdf` etc. | WEB `storage/mail_receipt_pdf/`, `storage/test_PDF/`, `zip_pdf/<tenant>/`, `pdf_folder` | direct, **never deleted** | partial | none (INT-08 (LMS-AUDIT-188)) |
| 57 | NACH S1/S3 export `s1excel_exportController` :255, `s3excel_exportController` :272 | fees.php T1 | n/a | `NACH_S1_EXPORT_<Y_m_d_H_i_s>.xlsx` | WEB `storage/NachExcel/` (dir `mkdir 0777`, `chmod 0777`) | direct, **never deleted** | no | none (INT-08 (LMS-AUDIT-188)) |
| 58 | `Helper::accesslog_json` :2881 | every logged request | n/a | `<Y-M>.json` | PUB `access_log/<tenant>/` | /storage | tenant folder | none (INT-09 (LMS-AUDIT-189)) |
| 59 | `learning_outcome\lo_marks_greport2Controller` :154 | result.php T1 | n/a | fixed `data.json` | PUB `data.json` (shared file, race) | /storage | no | none |
| 60 | `Services\EmailTemplateService` :295, `OpenAIService` :434,:483,:1050,:1067,:1193,:1326, `palController` :536 | T1/T2 | n/a | generated | local temp/public | - | no | - |

Counts: 202 write sites; 60 rows above cover every controller/service file (repeated identical sinks listed by file:line inside one row). **Only 27 `mimes:`/`mimetypes:` rules exist in 18 files under `app/Http`** against **306 uses of client name/extension in 103 files**; 83 `'public'`-ACL puts to DO; 0 `temporaryUrl()` uses (no signed URLs anywhere); 0 uses of `Storage::disk('private')`.

Frontend upload components (69 `type="file"` inputs): 54 have `accept=`, **15 have none** (`admin-services/complaint-management/page.tsx:211`, `course-master/[courseId]/chapters/page.tsx:4999`, `easy_com/_components/EntryPage.tsx:443`, `Inventory/_components/InventoryPage.tsx:93`, `library/book_resources/page.tsx:994,1064`, `lms/book-list/page.tsx:388`, `lms/homework/submission/page.tsx:297`, `lms/lmsAssignment_submission/page.tsx:262`, `lms/social-collaborative/page.tsx:340`, `organization_managment/Department/Component/sops.tsx:415`, `result/upload-result/page.tsx:68`, `student/_components/StudentCareModule.tsx:160`, `talent-management/onboarding/components/onboarding-sheets.tsx:1015`, `talent-management/performance-reviews-and-appraisals/components/performance-center.tsx:2078`). Client-side size checks exist in only 6 places (`lms/homework/page.tsx:111` 10 MB, `SubmitHomeworkDialog.tsx:24` 10 MB x5 files, `course-master chapters:434-465` 50-500 MB, `h5p_interactive_video` 500 MB x2, `components/ui/file-upload.tsx` default 10 MB); everything else relies on the server, which validates almost nothing. Multipart uploads through the Next server go through `app/api/proxy-file/route.ts` (`request.formData()` buffers the whole body) and `app/api/import/{parse,process}` (the import page itself calls Laravel directly).

### 5.2 Phase 14 - Import / export endpoints (full list)

| Import | Endpoint / tier | Validation | Duplicate handling | Error reporting | Memory / batch | Transaction | Tenant | Uploaded-file cleanup |
|---|---|---|---|---|---|---|---|---|
| `ImportApiController@parse` | `POST api/import/parse` T2 | `csv_file` `file|mimes:csv,xlsx`, `tablename` required (no allow-list of tables) | none at parse | `status/message` | **whole spreadsheet loaded** (`IOFactory::load`, `->toArray()`), then `json_encode` of all rows into `csv_data.csv_data` longText (`:47-92`) | no | prefix in file name only; `csv_data` untenanted | **never deleted** (`public/import/`) |
| `ImportApiController@matchFields`/`@process` | `POST api/import/match-fields`, `/process` T2 | `fields[]` free strings (columns of any table); `custom_text[]` | `is_skip` 1/2 stored on `csv_data` via `matchFields`; conditions built with `===` against a value that may arrive as string (INT-12 (LMS-AUDIT-192)) | counts + row numbers for skip/overwrite/failed; per-row exceptions **uncaught** (500 aborts the loop mid-way) | row-by-row queries (3-6 SELECTs per row) | **none** | mapped `sub_institute_id` honoured for `tblstudent` | n/a |
| `Import\ImportController` (web) | `/import_parse`, `/custom_import_parse`, `/import_parse_fields`, `/import_process` **T0** | `custom` `mimes:csv`; `parseImport`/`processImport` none | same | Blade summary | same | none | session (null when anonymous) | never |
| `public/excel_upload/bulk_{chapter,topic,lo,content,question}_data.php`, `fees.php`, `Import_xlsx_data.php` | direct URL **T0** | ext in [xlsx,xls] (client) | `SELECT` before insert on title | HTML echo of failing rows | PHPExcel loads full file (unmaintained lib) | none | `$_REQUEST`/`$_SESSION['SUB_INSTITUTE_ID']` set from query string | not stored (tmp) |
| `student\studentBulkUpdateController` (active/inactive xlsx) | `student/bulk_update...` T1 | ext client [xlsx,xls] | already active/inactive/not-found arrays returned | yes (3 lists) | full sheet + N queries | none | session | retained |
| `fees_reconciliation_upload_sheet_controller` | `fees/...store_fees_reconciliation_data` T1 | ext [xlsx,xls,csv] | `reference_no`+`payer_opted_mode` **without tenant** | none | full sheet | none | insert uses session tenant | retained |
| `bazar\bulkUploadSheetController` x3, `MigrationModulesApiController::bazarUpload` | `bazar/store_*_data` T1 / `migration-modules/bazarUpload` | ext [xlsx,xls] / `mimes:xls,xlsx` | none | `success` flag only; `catch` swallows | full sheet | none | **no tenant column** | retained |
| `leave\ApplyLeaveController@importOldLeave` + `LeaveImport` | `POST /import-leave` T1 | `upload_file` required only | `updateOrCreate` on (user, from, to) | JSON exception message | Maatwebsite (non-chunked `ToModel`) | per row | **none** (name match across tenants) | Maatwebsite temp |
| NACH S2/S4 | fees.php T1 | see FIN-38 (LMS-AUDIT-125) | UTR-less | HTML summary rendered with `dangerouslySetInnerHTML` (`NACH_s4excel_import/page.tsx:167`) | full sheet | none | session | retained |
| `BulkTaskController@import` | T2 `staff.only` | `BulkTaskImportRequest` + `SafeCsvFile` (ext `.csv` + MIME allow-list) | resolves user by name/dept/role in tenant | **per-row `skipped_tasks` with reasons** | `fgetcsv($h,1000)` streaming (lines >1000 chars truncated) | per-task | context tenant | tmp |
| `G2gLms\GovernanceController` user CSV | T2 `staff.only` | `mimes:csv,txt|max:5120`, whitelist `IMPORTABLE_USER_COLUMNS`, role exists in tenant, duplicate e-mail and in-file duplicate detection, per-row `errors[]` | yes | yes | streaming | see code (batch insert) | tenant | tmp |
| `G2gLms\AssignmentsController` assignment CSV | T2 `staff.only` | `mimes:csv,txt|max:5120` | - | - | `file()` loads all lines | - | tenant | tmp |
| H5P package import (8 controllers) | lms.php T1 | `H5PPackageArchive::guardArchive` (size, entry count, uncompressed size, per-entry path check) | - | yes | bounded | - | tenant | tmp |

| Export | Endpoint / component | Format | Tenant filter | PII | Formula neutralisation |
|---|---|---|---|---|---|
| Generic table export | `lib/table-export.ts:20-26,44-56` used by 64 pages | CSV (`text/csv`), "Excel" = HTML table as `.xls`, print/PDF | server rows already tenant-filtered | student/fee/staff data | **none** (FIN-26 (LMS-AUDIT-306)) |
| Own Blob CSV exporters | 20 files (`hrit/leave-management/*`, `hrit/_components/payroll-shell.tsx:138`, `employee-directory.tsx:124`, `certifications-center.tsx:1008`, `onboarding-center.tsx:413`, `capability-library/*`, `competency-*`, `learning-catalog.tsx:154`, `easy_com/_components/ReportPage.tsx:143`, `Inventory/_components/InventoryPage.tsx:82`, `sessions-calendar.tsx:157`, `certifications-records.tsx:90`, `exam-creation/page.tsx:622` HTML, `library-module-utils.ts:35`, ...) | CSV/HTML | server | payroll CSV, staff directory | **none** (`grep` for `=+-@` guards = 0 hits) |
| PDF (client) | `jspdf` + `html2canvas-pro` in `ChatbotPanel.tsx`, `library-module-utils.ts`, `lms/exam/_assessment-blueprint/pdf.tsx`, `_question-paper-templates/pdf.tsx`, `document-template/blocks/A4PageBlock.tsx`, `editor/Topbar.tsx`, `lib/question-paper/images.ts` | PDF | n/a | n/a | n/a (no cells) |
| Laravel `Excel::download` | `Import\ExcelDownloadController@create`, `questionExcelDownloadController@index` | xlsx (Maatwebsite) | `sub_institute_id` from session | roll/enrollment | n/a |
| Laravel CSV | `HRMS\departmentController@export:972` (`fputcsv`, **no neutralisation**), `TaskManagement\AuditLogController:56` (**`csvSafe()` neutralises `=+-@`** - the only one) | CSV | session/context | staff | 1 of 2 |
| Laravel `.xls` via `header()` | `result\cbse_result\result_report_controller:978` | HTML as xls | session | student marks | none |
| dompdf | 16 call sites (`OpenAIService` 4, `PayrollController` 4, `LibraryReportController` 2, `EmailTemplateService`, `RendersGeneratedContent`, `sqaa_controller`, `questionpaperController`, `syllabusController`, `AiSopGenerationController`, `MyLearningController`); `isRemoteEnabled=true` in 5 (`questionpaperController:425`, `RendersGeneratedContent:54`, `EmailTemplateService:289`, `OpenAIService:377`...) | PDF | session | payslips, results | n/a |
| wkhtmltopdf | `Helper.php:1985-2057` (6 helpers, `exec`, unquoted args, `--enable-local-file-access`) | PDF saved under web root | session | receipts/result cards | n/a (see part10, INT-08 (LMS-AUDIT-188)) |
| NACH S1/S3 | `fees\NACH\s1excel_export`, `s3excel_export` | xlsx via PHPExcel | fees session | **bank a/c no., IFSC, UMRN** | cells written `setCellValueExplicit(...,'s')` (string) - safe |
| Bulk documents zip | `FileController@downloadBulkDocuments` | zip (streamed then `deleteFileAfterSend`) | session tenant | Aadhaar/PAN docs | n/a |
| `download-folder` | `GET /download-folder` (T0) | zip of all `he_staff_document/` | none | staff docs | BE-03 (LMS-AUDIT-047) |

### 5.3 Phase 15 - Notification endpoints (who can trigger)

| Endpoint | Tier | Sync/async | Cost/authorisation controls | Notes |
|---|---|---|---|---|
| `POST api/easy_com/send-sms-parents`, `send-sms-staff`, `send-whatsapp-parents`, `send-email-parents`, `send-notification-parents` | T2 `api.session` only (HR-21 (LMS-AUDIT-004)) | **sync loop in request** (`SendSmsParentsApiController:150`) | `smsText max:1000`, recipients must belong to the searched class; **no per-user/tenant quota**, no template registry, only `throttle:1000,1` | provider errors ignored -> logged "sent" (INT-23 (LMS-AUDIT-365)) |
| `POST api/easy_com/sms-api`, `smtp`, `whatsapp-api` (+`smtp/test`) | T2 | - | any role may replace gateway config | SSRF/credential capture (HR-21 (LMS-AUDIT-004)) |
| web `easy_com/send_*` | T1 (menu rights) | sync | menu | 3 duplicate `sendSMS()` |
| `POST /ajax_sendmail` | **web only (no `session`/`check_permissions`)** | sync | any logged-in web user | attaches arbitrary server path (INT-06 (LMS-AUDIT-186)) |
| `GET /api/crm-whatsapp`, `GET /api/crm-whatsapp-update` | **T0** (`withoutMiddleware(Authenticate)`, in `api_guard.public`) | sync | none | INT-01 (LMS-AUDIT-016) |
| `POST /api/incoming-message`, `/api/update-message`, `/api/whats-send-app`, `/api/whats-comming-app` | **T0** (`api_guard.public`, `TODO(V1.1): verify a shared secret`) | - | none | INT-22 (LMS-AUDIT-364) |
| `GET /Resend_otp` | **T0** | sync | none, sends from tenant 1's gateway | INT-20 (LMS-AUDIT-199) |
| `GET /send_birthday_notification` | **T0** | sync, all tenants | none | INT-20 (LMS-AUDIT-199) |
| `POST /api/check_otp`, `login`, `teacherlogin` (OTP SMS) | T0 (now `throttle:20,1` / `10,1` in the uncommitted diff) | sync | rate limit only | INT-19 (LMS-AUDIT-069) |
| `visitor_management/sendOtpVisitor` | T1 | sync | menu | returns OTP in response (INT-19 (LMS-AUDIT-069)) |
| FCM from 22 controllers (fees status, circular, marks entry, attendance, homework, infirmary, leave, virtual classroom, photo gallery, van report, classwork, questionpaper, NACH S4...) | T1/T2 | sync | menu | one OAuth token exchange **per call**, one HTTP request per device |
| `api/platform/notifications` GET/PUT, `/channels` | T4 `lms.auth` + `perm:platform.notification,update` | - | perm | configuration only (INT-25 (LMS-AUDIT-367)) |
| MCP `ReportSender` (`ai.reports.send`) | `McpAuth` | `Mail::to()->queue()` | preview + recipient-count confirm, per-recipient own figures | the only queued mail |

### 5.4 Phase 16 - Job / command / scheduler inventory

See 2.4. Additional facts: `Kernel::bootstrap()` (`Kernel.php:120-147`) logs the **full argv** of every artisan invocation to the `daily` log (could contain `--password=`/tokens) and refuses any command line matching `\b(db:seed|schema|fresh|refresh)\b`; it does not block `migrate`, `db:wipe`, `tinker`, `ai:seed-demo --purge`, `neo4j:reset-graph --skip-backup-check`. No `schedule:run`/queue-worker/supervisor artefact exists in the repo (only a Windows Task Scheduler snippet in `docs/neo4j-live-sync.md:128`). Commands with a `--dry-run`: 13; with a production guard: 1 (`pal:seed-student-demo`).

### 5.5 Phase 17 - see 2.5 (39-row integration table) and INT-15 (LMS-AUDIT-195) for the TLS-off list.

---



## API-related issues (176 of 454)

| ID | Severity | Module | Issue | Source IDs |
|---|---|---|---|---|
| LMS-AUDIT-001 | Critical | Every Laravel-proxying Next handler (SS… | Server-side routes take the upstream Laravel host from a client-controlled header/param (SSRF + bearer/cookie exfiltration) | NAPI-01, INFRA-01, AUTH-14, AI-02, AI-A08, ORPH-05, LMS-19, FIN-18, STU-30 |
| LMS-AUDIT-002 | Critical | Agents engine + Conversational AI admin… | Agents / conversational-AI engine trusts client headers for tenant+user, has unauthenticated list/run endpoints, and checks RBAC against the caller-chosen host | NAPI-02, NAPI-03, INFRA-02, AI-01, AI-C03, AI-C04 |
| LMS-AUDIT-003 | Critical | Rights enforcement (`check_permissions`) | check_permissions skips all rights checks when submit contains "Search" and fails open on routes with no menu row | AUTH-02, BE-10, FIN-41, FIN-14, STU-15 |
| LMS-AUDIT-004 | Critical | Result API, Easy Communication, Organiz… | Result API, Easy Communication and Organization-management route groups authenticate but never authorize role/rights | AUTH-10, BE-12, LMS-03, HR-21 |
| LMS-AUDIT-005 | Critical | Module dashboards (Laravel unauthentica… | Module dashboard summary endpoints (admissions/students/library/hostel/transport) have no middleware and filter by body tenant | NAPI-04, FIN-13, STU-29 |
| LMS-AUDIT-006 | Critical | AI console — providers, models, policie… | Any authenticated user (incl. students) can write AI provider keys, policies and prompt templates | AI-D01, AI-04, BE-19 |
| LMS-AUDIT-007 | Critical | Integration management (Next route hand… | /api/integration-configs is an in-memory, cross-tenant, header-presence-authenticated mock store returning plaintext secrets | AI-D02, NAPI-07, HR-20 |
| LMS-AUDIT-008 | Critical | Generic table API, menu rights, LMS cou… | Anonymous /table_data and /lms_data dump any DB table (incl. tbluser plaintext passwords); frontend depends on it | BE-01, HR-01, ORPH-01 |
| LMS-AUDIT-009 | Critical | ~90 controllers / 378 routes with no au… | ~90-195 Laravel API controllers (~300-378 routes) and ~425 web routes have no authentication and take tenant/user from the request | BE-07, AUTH-05, ORPH-02 |
| LMS-AUDIT-010 | Critical | Menu / navigation backend (`/api/menu-r… | Unauthenticated POST /api/menu-rights builds SQL from raw request values | AUTH-01, HR-05 |
| LMS-AUDIT-011 | Critical | Fees / Online payment gateways | ICICI/ICICI-Orange/PayPhi/AggrePay payment callbacks are unauthenticated with no signature verification (forged success issues receipts) | FIN-01, BE-08 |
| LMS-AUDIT-012 | Critical | Document Templates | DocumentTemplateApiController decodes JWT without signature verification and returns student PII unauthenticated | HR-02, AUTH-06 |
| LMS-AUDIT-013 | Critical | Organization Management > Employee Dire… | Employee Directory API: authentication only, mass-assignment, returns tbluser (password/plain_password/otp) to any token incl. students | HR-03, AUTH-03 |
| LMS-AUDIT-014 | Critical | File uploads | Unauthenticated / unvalidated uploads into the public web root (POST /ckeditor and similar) | BE-05, AUTH-04 |
| LMS-AUDIT-015 | Critical | Web-root PHP scripts / secrets in source | Standalone PHP scripts under public/ bypass Laravel (phpinfo, request-supplied DB host, hard-coded DB passwords, SQLi in excel_upload/*) | BE-06, INT-04 |
| LMS-AUDIT-016 | Critical | WhatsApp CRM endpoint / file upload | Anonymous GET /api/crm-whatsapp sends WhatsApp as tenant 1, fetches an attacker URL / local file and writes it into the web root | INT-01, BE-04 |
| LMS-AUDIT-017 | Critical | Exam / question paper (anonymous API) | Two unauthenticated endpoints build SQL by string interpolation of request input. | LMS-01 |
| LMS-AUDIT-018 | Critical | Online exam result / attempt breakdown | `online_exam_id` and `user_id`/`student_id` from the request are concatenated into `DB::select("... | LMS-02 |
| LMS-AUDIT-019 | Critical | Question papers, question bank, course… | These routes are registered at file level with no `api.session`/`lms.auth`. | LMS-04 |
| LMS-AUDIT-020 | Critical | LMS Exam Operations - Exam Evaluation,… | The whole feature - upload scanned answer sheets, edit teacher marks, approve, **publish into the gradebook (`lms_offline_exam`, `lms_offline_exam_answer`)**,… | LMS-05 |
| LMS-AUDIT-021 | Critical | Legacy homework family, lesson planning… | Unauthenticated endpoints with client-supplied identity. | LMS-06 |
| LMS-AUDIT-023 | Critical | PAL practice / concept-diagnostic-asses… | These routes are registered outside every `Route::group([... | AI-A02 |
| LMS-AUDIT-024 | Critical | Enterprise Brain (all screens) / Founda… | Any valid LMS JWT — including Student and Parent profiles — resolves to the `viewer` role (default_role) which holds `read`; | AI-C01 |
| LMS-AUDIT-025 | Critical | Enterprise Brain — AI Assistant search | The global search selects entire rows (`DB::table('tbluser')->...->limit(10)->get()`) and returns each one as `'record' => $record`. | AI-C02 |
| LMS-AUDIT-026 | Critical | Migration modules (learning outcomes, i… | Tenant, user and academic year come from client-supplied request fields; | AI-D03 |
| LMS-AUDIT-027 | Critical | Fees / Mobile "GPay" self-reported paym… | `POST /fees/get_online_receipt` posts fee receipts based on client-supplied `amount`, `transactionid`, `bank_name`, `sub_institute_id`, `syear` and a student-b… | FIN-02 |
| LMS-AUDIT-028 | Critical | Fees (controllers) - SQL injection | Request values are concatenated into `whereRaw`/`selectRaw`/`DB::select` strings without binding. | FIN-03 |
| LMS-AUDIT-029 | Critical | Fees / Receipt cancellation | For `type=API` the controller replaces the JWT-hydrated tenant and user with client values, then cancels/searches receipts. | FIN-04 |
| LMS-AUDIT-030 | Critical | Hostel / Visitor (school gate visitor)… | `POST /add_visitorAPI` requires no authentication (JWT validation block commented out at `:162-172`; | FIN-39 |
| LMS-AUDIT-031 | Critical | Transportation / student route details | `GET map_student/fetchData` has no session/JWT; | FIN-57 |
| LMS-AUDIT-034 | Critical | Admissions (enquiry / registration / on… | The three admission API controllers are registered at top level of `routes/api.php` with no middleware other than the group `throttle:1000,1`, and the controll… | STU-01 |
| LMS-AUDIT-035 | Critical | Admissions | SQL injection through `sub_institute_id`. | STU-02 |
| LMS-AUDIT-036 | Critical | Student certificates / ID cards (studen… | `Route::prefix('student/api/student_certificate' \\| 'student/api/student_icard' \\| 'student/api/teacher_icard')` are declared outside every middleware group. | STU-03 |
| LMS-AUDIT-038 | Critical | Students (adminapi endpoints) | These controllers validate that the bearer JWT is signed, then take `sub_institute_id`, `syear`, `user_id`, and (for search) `user_profile_name` from the reque… | STU-05 |
| LMS-AUDIT-039 | Critical | Attendance / Students legacy / Proxy /… | The `session` middleware validates the JWT and hydrates a correct tenant from the token, but each controller then overwrites it with the request value when `ty… | STU-06 |
| LMS-AUDIT-040 | Critical | Parent communication | The JWT check is executed only `if ($type == 'API')`, where `$type` is a client parameter. | STU-08 |
| LMS-AUDIT-041 | Critical | Payroll / HR helpers | Client-controlled values are concatenated into raw SQL. | HR-04 |
| LMS-AUDIT-042 | Critical | Payroll (tenancy) | The middleware hydrates the tenant from the JWT, then each controller overwrites it with the request value when `type=API` (`$sub_institute_id = $request->get(… | HR-06 |
| LMS-AUDIT-043 | Critical | Admin Services (complaint, consent, fro… | `authenticate()` only checks that the JWT is valid. | HR-07 |
| LMS-AUDIT-044 | Critical | Task Management create, Add Process, Or… | Four unauthenticated write surfaces used by my modules: | HR-08 |
| LMS-AUDIT-045 | Critical | Result module / Laravel | Unauthenticated POST routes write result HTML per student and build SQL by string concatenation of request parameters (SQL injection). | ORPH-03 |
| LMS-AUDIT-046 | Critical | Super-admin provisioning | `Route::any('superAdmin')` and `POST superAdmin-store` are on the `web` group with no `session`/`auth`/permission middleware. | BE-02 |
| LMS-AUDIT-047 | Critical | Staff documents | `GET /download-folder` (web group, no auth) zips every file under `he_staff_document/` on the `digitalocean` disk and returns it. | BE-03 |
| LMS-AUDIT-048 | Critical | Tier B controllers (JWT valid + client-… | These controllers call `$this->jwtToken()->validate()` (signature/expiry only) and then use `sub_institute_id`, `user_id`, `syear` from the request. | BE-11 |
| LMS-AUDIT-049 | Critical | Sensitive data at rest (database facet;… | 66 sensitive columns are plain `varchar/text`; | DB-08 |
| LMS-AUDIT-050 | Critical | Legacy document-transfer utility | Both routes sit outside every auth group (only the `web` group's CSRF token, obtainable with any GET). | INT-02 |
| LMS-AUDIT-051 | Critical | SQAA PDF / file deletion | `POST /unlink-file` deletes any path given in the request: | INT-03 |
| LMS-AUDIT-052 | Critical | Web import routes | The six import routes are registered after the closing `});` of the auth group (line 297), so they have only `web` middleware (CSRF, obtainable by any GET). | INT-05 |
| LMS-AUDIT-053 | Critical | Legacy mobile API (apiController) / JWT… | An unauthenticated GET route mints and returns a validly signed JWT for a fixed payload (id 123, "keyur modi") with no credentials. | SP-05 |
| LMS-AUDIT-055 | High | Google sign-in | Google sign-in cannot work (client env var not exposed; Laravel has no /api/google-auth) | AUTH-25, NAPI-06, INFRA-05, ORPH-06 |
| LMS-AUDIT-056 | High | Recruitment screening, SOP conversion | Unauthenticated /api/screenCandidate and /api/process/convert spend server LLM credentials and send resume data to third parties | INFRA-09, NAPI-05, ORPH-22, HR-18 |
| LMS-AUDIT-057 | High | Laravel middleware (CSRF, menu permissi… | CSRF except-list full-URL wildcards disable CSRF for every web route on production/dev hosts | LMS-32, FIN-42, STU-40, HR-28 |
| LMS-AUDIT-059 | High | Repository hygiene / agent tooling state | Agent runtime state under .kilo/conversational-ai (real student/enquiry PII) committed to git | INFRA-03, NAPI-13, AI-D20 |
| LMS-AUDIT-060 | High | Fees receipts/circulars, career explore… | Unsanitised dangerouslySetInnerHTML sinks (65 in 35 files) render teacher/AI/DB-authored HTML while JWT is in localStorage | INFRA-08, AI-05, AI-A07 |
| LMS-AUDIT-061 | High | Credentials storage & exposure | Staff passwords stored/compared in plaintext (plain_password) and exposed by APIs | BE-14, AUTH-09, STU-34 |
| LMS-AUDIT-062 | High | JWT design | JWTs never expire by default and cannot be revoked | BE-16, AUTH-07, STU-45 |
| LMS-AUDIT-063 | High | Login | Login has no per-account/IP throttling, lockout or audit trail | AUTH-08, BE-17 |
| LMS-AUDIT-064 | High | Import data (Laravel API, proxied by Ne… | Import API (/api/import/*) has no role check and no table/column whitelist | NAPI-08, HR-15 |
| LMS-AUDIT-065 | High | AI action approval (Actions tab, AI jou… | AI action approval gate has no role/state guard; approvals replayable; approver client-supplied | AI-D04, AI-03 |
| LMS-AUDIT-066 | High | Students (data exposure) | tblstudent.* rows (password hash, aadhaar, etc.) returned verbatim to browsers | STU-07, FIN-75 |
| LMS-AUDIT-068 | High | HRIT Leave | Leave APIs have no role/ownership/self-approval check; identity from request | HR-09, BE-13 |
| LMS-AUDIT-069 | High | SMS OTP login / visitor pickup OTP | Static/DOB SMS OTPs, backdoor mobile numbers and OTP returned in responses | INT-19, BE-15 |
| LMS-AUDIT-070 | High | Tenant scoping (cross-cutting; example… | The JWT hydration guarantees session tenant only for controllers that read `session()`. | AUTH-11 |
| LMS-AUDIT-075 | High | Online exam / practice / student report… | After the `session` middleware hydrates a verified identity, these controllers still use `$request->get('user_id') ?: | LMS-09 |
| LMS-AUDIT-081 | High | File uploads (H5P, homework, result, co… | Stored file names use the client-supplied extension/name and several endpoints validate nothing (scenario image, result upload, content upload). | LMS-15 |
| LMS-AUDIT-083 | High | H5P authoring endpoints | Create/edit/delete/publish/import/media are available to any authenticated profile including students; | LMS-17 |
| LMS-AUDIT-085 | High | Learning Outcome (migration-modules API) | `guard()` verifies only that a JWT is valid, then trusts `sub_institute_id`, `user_id`, `syear` from the body. | LMS-20 |
| LMS-AUDIT-086 | High | Course Master content (links) | The `link` field is stored as `url`/`filename` after only `nullable\\|string\\|max:2048`; | LMS-21 |
| LMS-AUDIT-091 | High | Pedagogy Engine, Framework/ULU views, `… | The whole chain that feeds the Pedagogy Engine, Framework and ULU screens has no authentication and no tenant scoping. | AI-B01 |
| LMS-AUDIT-093 | High | New content model authoring/review/appr… | The only authorization is "not a student" (`is_student`). | AI-B03 |
| LMS-AUDIT-094 | High | ULU authoring API and content framework… | `POST /api/pal/content/{contentId}/framework-metadata` has no role check and no tenant check: | AI-B04 |
| LMS-AUDIT-095 | High | Enterprise Brain — decisions, execution… | The governance permissions `decision.approve`, `eso.execute` and `evidence.curate` are defined and granted to `manager` but are **used by no route**. | AI-C05 |
| LMS-AUDIT-096 | High | Career Explorer / Career Counselling ba… | 17 career GET routes are registered with **no auth middleware**. | AI-C06 |
| LMS-AUDIT-102 | High | Capability / Competency management API | The only gate is "not student/parent". | AI-C12 |
| LMS-AUDIT-105 | High | AI read APIs (cases, signals, recommend… | Read endpoints filter by institute only. | AI-D07 |
| LMS-AUDIT-107 | High | Platform Services (notification, schedu… | The only server-side gate on writes is `perm:platform.<service>,<action>`, which by default only logs "would have DENIED" and lets the request through; | AI-D09 |
| LMS-AUDIT-108 | High | Concept Intelligence tab names | The three tab-label routes have no auth middleware, take the tenant and user from request input, and the component lets every viewer rename tabs. | AI-D10 |
| LMS-AUDIT-112 | High | Fees (all report / master / other-fees… | Multi-tenancy is enforced by trusting `sub_institute_id` from the request although the JWT already provides it. | FIN-05 |
| LMS-AUDIT-117 | High | Fees / Receipt generation and display | The printed/stored receipt takes student identity, remarks and bank fields from `$_REQUEST` (client input) instead of the database, without HTML escaping; | FIN-10 |
| LMS-AUDIT-118 | High | Fees / audit logs, online payments, rec… | These read APIs have no tenant scope: | FIN-11 |
| LMS-AUDIT-121 | High | Fees / Gateway secrets in source | CCAvenue working key (32 hex) is hard-coded in tracked source and the access code has a hard-coded fallback; | FIN-16 |
| LMS-AUDIT-122 | High | Fees / Receipt reprint and PDF storage | (1) Any authenticated user reprints any tenant's receipt (student_id + receipt number + client `sub_institute_id` - the UI even renders "Sub institute ID" as a… | FIN-17 |
| LMS-AUDIT-123 | High | Fees / payout & UTR endpoints | State-changing bank-side calls (CCAvenue split-payout creation, UTR sync) are triggered by anonymous GET requests; | FIN-36 |
| LMS-AUDIT-124 | High | Fees / Online fees settings (merchant c… | Any authenticated caller reaching the route (route name `online_fees_settings_api.store/destroy` has no menu row => no rights check, FIN-14) can create/delete… | FIN-37 |
| LMS-AUDIT-125 | High | Fees / file uploads (NACH S2/S4 import,… | Uploads are stored under `storage/app/public/...` (web-served through the `storage` symlink) with an extension taken from the **client file name** and no `mime… | FIN-38 |
| LMS-AUDIT-126 | High | Visitor list / type APIs | JWT is validated but `sub_institute_id` is taken from the body and never compared with the token payload. | FIN-40 |
| LMS-AUDIT-127 | High | Inventory / Item receivable | `Route::get('inventory/{module}')->where('module','^(?!reports$).+')` (matches slashes) is declared before `inventory/receivables/items` and `POST inventory/{m… | FIN-45 |
| LMS-AUDIT-136 | High | Visitor management (public pages) | Besides `add_visitorAPI` (FIN-39), the public `POST /visitor_management/add_visitor_master` and public `create()` page (`type=webForm`, tenant from query) rend… | FIN-66 |
| LMS-AUDIT-137 | High | Visitor pickup ("gate pass") OTP | The OTP is returned in the response (`$response['otp'] = $otp`, `:482`), an existing OTP is reused and never expires or clears despite the "valid 5 minutes" SM… | FIN-67 |
| LMS-AUDIT-140 | High | Utility mutators / custom-module / fron… | Mutating routes (`rollover.create/store`, `student_transfer.store`, `student_bulk_update.store`, `transfer_student`, `show_student`) have different names from… | FIN-70 |
| LMS-AUDIT-151 | High | Bazar bulk upload | Data written to `sharebazar_position/_margin/_pnl` carries no `sub_institute_id` or uploader; | FIN-82 |
| LMS-AUDIT-152 | High | Certificates / ID cards (stored XSS) | The server substitutes student/staff fields (name, father_name, address, mobile, enrollment_no) into the template with `str_replace` and no HTML escaping. | STU-09 |
| LMS-AUDIT-155 | High | Admissions (Laravel public forms) | Public (unauthenticated) routes `admission_enquiry/store` and `admission_enquiry/payment_proof`: | STU-13 |
| LMS-AUDIT-156 | High | Academic year handling / Rollover / Adm… | The hydrator takes `syear` and `term_id` straight from the request and stores them in the server session with no validation that they belong to the tenant or a… | STU-14 |
| LMS-AUDIT-158 | High | Student delete / withdraw | `tblstudentModel::where(["id" => $id])->update(['status'=>"0"])` has no tenant filter; | STU-17 |
| LMS-AUDIT-162 | High | Circulars | `destroy` hard-deletes `circular` by `Id` only (no tenant); | STU-35 |
| LMS-AUDIT-167 | High | Payroll, Leave, Import (frontend/backen… | (1) `deletePayrollType` POSTs to `/payroll-type/destroy/{id}`; | HR-14 |
| LMS-AUDIT-168 | High | Organization Management (disciplinary,… | These endpoints are tenant-scoped but have no role check: | HR-16 |
| LMS-AUDIT-169 | High | Talent Management | (1) All read endpoints are open to every staff profile (teacher, clerk, etc.): | HR-17 |
| LMS-AUDIT-171 | High | Task Management | `task.permission` is applied to only four read routes; | HR-22 |
| LMS-AUDIT-173 | High | Laravel LMS/PAL/platform APIs (lms.auth… | 18 routes the frontend calls (GET /api/permissions, content upload/authoring, coherence-map read/write, platform registry/notifications/scheduler/workflow) are… | ORPH-04 |
| LMS-AUDIT-174 | High | Result (report card, marks approval) | Frontend paths do not match registered Laravel routes. | ORPH-07 |
| LMS-AUDIT-175 | High | G2G Assessments / Learning dashboard, T… | 35 frontend endpoints have no matching Laravel route: | ORPH-11 |
| LMS-AUDIT-177 | High | Legacy user management (Blade controlle… | Both build `$finalArray` from **every** request key (only `_method,_token,submit,id` dropped) and call `tbluserModel::insert($finalArray)` / `->where(['id'=>$u… | BE-18 |
| LMS-AUDIT-190 | High | Upload endpoints that trust client tena… | (a) `POST /admission_enquiry/payment_proof` is public ("for hills standalone"): | INT-10 |
| LMS-AUDIT-191 | High | Upload validation / storage architectur… | New sinks not enumerated before: | INT-11 |
| LMS-AUDIT-194 | High | Third-party AI services receiving stude… | Class photos of children (biometric face data), homework files together with `student_id`, and `enrollment_no`+`sub_institute_id` are POSTed to hard-coded thir… | INT-14 |
| LMS-AUDIT-195 | High | Outbound TLS verification disabled (ext… | Every listed call turns off peer/host verification. | INT-15 |
| LMS-AUDIT-198 | High | Secrets in source and at rest (extends… | The O*NET API username/password are embedded 28 times although `env('ONET_USERNAME'/'ONET_PASSWORD')` is used in 10 other places. | INT-18 |
| LMS-AUDIT-199 | High | Anonymous notification triggers | (1) `GET /Resend_otp?mobile=<any>` sends an SMS through **tenant 1's** gateway to any number, unauthenticated, unthrottled, and does not even store the OTP it… | INT-20 |
| LMS-AUDIT-202 | High | Laravel data-access layer (systemic) | Raw SQL expressions are used pervasively and were confirmed to be built by string concatenation of request input in many controllers (FIN-03, STU-02, STU-04, L… | SP-03 |
| LMS-AUDIT-203 | Medium | All modules (Result, Fees, HRIT, Capabi… | JWT duplicated in URLs/query strings/bodies (log, history, referrer leakage) | ORPH-08, LMS-31, HR-26, FIN-19 |
| LMS-AUDIT-204 | Medium | Frontend route protection | Frontend route/role gating is client-side, localStorage-driven and cosmetic (substring role matches) | AUTH-16, LMS-26, AI-C28 |
| LMS-AUDIT-205 | Medium | Talent management, task management, mis… | Hard-coded third-party n8n webhooks receive job/task data | INFRA-10, ORPH-14, HR-29 |
| LMS-AUDIT-208 | Medium | Generic proxies (`/api/proxy`, `/api/pr… | Generic /api/proxy relays any path/verb with caller Authorization+Cookie (open relay) | NAPI-10, AUTH-23 |
| LMS-AUDIT-209 | Medium | question-paper asset proxy | question-paper asset proxy fetches client-supplied URLs unauthenticated (origin allow-list only, open-redirect follow) | NAPI-11, LMS-33 |
| LMS-AUDIT-215 | Medium | Generic migrated modules (`/reports/*`,… | Generic "migrated module" pages dump raw first-array API data / show feature names with no implementation | STU-33, AI-D19 |
| LMS-AUDIT-216 | Medium | Error handling / debug output | Exception messages, SQL text and debug output returned to clients | BE-23, LMS-36 |
| LMS-AUDIT-219 | Medium | Menu rights identity and platform admins | (1) The menu request carries no `Authorization` header and the identity is whatever `menuContext`/`userData`/`sessionData`/`session` localStorage keys contain… | AUTH-18 |
| LMS-AUDIT-225 | Medium | Auth support flows and CSRF (forgot-pas… | (a) `forget-password` validates `email\\|exists:tbluser,email`, so an unknown email yields a different 422 than a known one (account enumeration), with no thro… | NAPI-12 |
| LMS-AUDIT-226 | Medium | Conversational-AI service tokens | Tokens are minted, hashed and displayed, but `authenticateServiceRequest` is called only from `service.test.ts`; | NAPI-14 |
| LMS-AUDIT-235 | Medium | PAL taxonomy pages | Server components call back into their own API by building `${proto}://${host}/api/pal/content-model` from the incoming `x-forwarded-proto`, `x-forwarded-host`… | INFRA-23 |
| LMS-AUDIT-242 | Medium | Course Master / content APIs (auth roll… | `lms.auth`/`perm:` run in warn-only mode because the frontend still calls content endpoints with a bare `fetch()` and **no Authorization header** (upload, ques… | LMS-34 |
| LMS-AUDIT-243 | Medium | H5P AI scenario | Public route (no middleware), calls `https://openrouter.ai/...` with `'verify' => false` (TLS verification disabled) and `env('OPENROUTER_API_KEY')` (returns n… | LMS-37 |
| LMS-AUDIT-245 | Medium | Teach Assistant panel - data sent to AI… | Each open-panel navigation, filter or keystroke in a search box re-posts `page_data` (up to 25 records x 8 attributes: | AI-07 |
| LMS-AUDIT-249 | Medium | Voice interaction | Voice input uses the browser Web Speech API (`SpeechRecognition`), which in Chrome/Edge streams audio to the vendor's cloud recogniser; | AI-13 |
| LMS-AUDIT-258 | Medium | Chapter diagnostic session handling / t… | The code and copy state answers are already persisted so the timer may auto-submit safely ("every answer is already persisted server-side"), and resume says "N… | AI-A18 |
| LMS-AUDIT-259 | Medium | LLM-backed endpoints callable by studen… | `POST /api/pal/eso/render` sends a client-supplied, unbounded `instruction` string and free `context` array to the LLM under a "Pal" system prompt (the design… | AI-A19 |
| LMS-AUDIT-260 | Medium | Intervention / Tier-2 support (BR-06) | The module is entirely UI plus client-derived triggers; | AI-A20 |
| LMS-AUDIT-261 | Medium | View-as-student | (1) All ESO screens resolve `learnerId = ?learnerId \\|\\| viewAsStudent?.studentId \\|\\| self`, yet the backend forbids staff on every learner-state ESO rout… | AI-A21 |
| LMS-AUDIT-263 | Medium | Coherence Map | `scopeFrom()` computes the caller's tenant but `map()` and `health()` call the repository without it (`$this->map->map($scope['standard_id'], $scope['subject_i… | AI-B05 |
| LMS-AUDIT-264 | Medium | Administration (architecture settings) | (1) `mayWrite` only honours `$auth['user_profile_name']` for the `writer_profiles` list, but `pal_auth` does not contain that key (it has `user_profile_id`, `r… | AI-B06 |
| LMS-AUDIT-271 | Medium | Framework / ULU server-rendered pages | The server component builds a self-request URL from the incoming `x-forwarded-host`/`host`/`x-forwarded-proto` headers and fetches `${proto}://${host}/api/pal/… | AI-B13 |
| LMS-AUDIT-272 | Medium | Personalize Marks | The server performs no validation: | AI-B14 |
| LMS-AUDIT-277 | Medium | Career Explorer, Career Counselling | Backend HTML (`onet_expert_advice.benefits/university_shortlist`, `onet_explore_sector.html`, `counselling_course.description`) is rendered unsanitised. | AI-C14 |
| LMS-AUDIT-279 | Medium | Capability Intelligence API clients | Every capability request adds `token`, `sub_institute_id`, `user_id`, `syear`, `financial_year`, `type=API` to the **URL query string**, in addition to the `Au… | AI-C16 |
| LMS-AUDIT-280 | Medium | Enterprise Brain — registry screens, AI… | These `hpbrain_*` tables are read by screens but written by **no application code** (grep of `D:\next_lms_erp\app`, excluding the registry/controller readers): | AI-C17 |
| LMS-AUDIT-281 | Medium | Generic module "Intelligence" tab | The client calls `GET /api/brain/{tenant}/modules/{module}/intelligence` and documents `BrainIntelligenceController::moduleIntelligence`, but that method and r… | AI-C18 |
| LMS-AUDIT-284 | Medium | Capability Library — skill detail modal… | Client calls `GET /api/skill_library/{id}/edit` (route exists only as web-session `/skill_library/{id}/edit`, no `api/` prefix) and `/api/lms/ai/{status,outlin… | AI-C21 |
| LMS-AUDIT-297 | Medium | AI provider credentials storage and pre… | LLM API keys are stored unencrypted in `ai_api_keys.api_key` (`grep Crypt::\\|encrypt(\\|decrypt(` over app/Domain/AI, app/Http/Controllers/AI, app/Services/AI… | AI-D21 |
| LMS-AUDIT-298 | Medium | Generation inputs (prompt-injection sur… | (1) `variables` from the client are merged last (`… $this->pageVariables($context), $validated['variables'] ?? []`), so they override server-derived `entity_la… | AI-D22 |
| LMS-AUDIT-311 | Medium | Fees / client-controlled API host | Several fee pages send the bearer token and student data to `userData.host_name` read from `localStorage`, ignoring the configured `API_BASE_URL` used elsewher… | FIN-35 |
| LMS-AUDIT-318 | Medium | Transportation / routes outside auth gr… | `api/get-bus-list`, `api/get-stop-list` (no tenant filter), `ajaxCheckRemainCapacity`, `DELETE map_student/bulk-delete` (no `session`/`check_permissions`) and… | FIN-58 |
| LMS-AUDIT-319 | Medium | Library / validation, counts, reports | `store()` has no validation (`no_of_items` unbounded loop; | FIN-62 |
| LMS-AUDIT-323 | Medium | Implementation master / Petty cash | `saveData` copies every request key into the insert after setting tenant/year from session, so client keys override tenant/year and become column names; | FIN-85 |
| LMS-AUDIT-336 | Medium | Attendance UX scope / permissions model | The attendance dashboard lists only sections from `class_teacher` for the logged-in `user_id`. | STU-39 |
| LMS-AUDIT-338 | Medium | HRIT role gating and menu rights | Client gates use `name.toLowerCase().includes('admin') \\|\\| includes('hr')`, which matches unrelated profiles ("Admin Assistant", "Chris", "Three...", "Front… | HR-24 |
| LMS-AUDIT-343 | Medium | PAL intervention queue | GET/POST `/api/pal/intervention` and `/{id}`, `/{id}/close` have no backend; | ORPH-12 |
| LMS-AUDIT-344 | Medium | Task management (legacy + reports) | Legacy `/task/{id}` update/delete and `/api/user-rejected-tasks-courses` are not registered. | ORPH-13 |
| LMS-AUDIT-345 | Medium | Laravel auth model | Six authentication mechanisms coexist (api.session, session, pal.auth, brain.auth, McpAuth, lms.auth soft) plus in-controller JWT validation and no auth at all; | ORPH-15 |
| LMS-AUDIT-347 | Medium | Mass assignment / request-driven writes | Sensitive columns are mass-assignable; | BE-21 |
| LMS-AUDIT-348 | Medium | Audit logging | The entire access-log write **and** the cross-tenant `add_user`/`add_student` PUT guard are inside `if type != API && != JSON`. | BE-22 |
| LMS-AUDIT-349 | Medium | CSRF exclusions and cookie sessions | `fees/*` (149 cookie-session routes incl. | BE-24 |
| LMS-AUDIT-351 | Medium | Jobs, events, scheduler | With the default `sync` driver the four AI-grading jobs run inside the HTTP request (60–600 s); | BE-26 |
| LMS-AUDIT-352 | Medium | Outbound integrations (SMS, e-mail, Wha… | TLS verification is disabled for SMS/FCM/other calls; | BE-27 |
| LMS-AUDIT-353 | Medium | Login ambiguity on duplicate e-mails | `loginModel::where(['email'=>$email,'status'=>'1'])->first()` (no `ORDER BY`) picks one row; | BE-29 |
| LMS-AUDIT-354 | Medium | Dangerous sinks | PHP object injection on an authenticated report route; | BE-30 |
| LMS-AUDIT-359 | Medium | Model layer | The model layer is a partial, inconsistent view of the schema: | DB-13 |
| LMS-AUDIT-364 | Medium | WhatsApp inbound webhooks & delivery st… | Meta's webhook endpoints are public, unsigned and stubbed: | INT-22 |
| LMS-AUDIT-365 | Medium | Notification delivery mechanics | All sending is synchronous in the HTTP request. | INT-23 |
| LMS-AUDIT-366 | Medium | Bulk-send cost controls, consent and te… | HR-21 covers who can send. | INT-24 |
| LMS-AUDIT-375 | Medium | Dead / unwired integrations | Several integrations exist only as config or partial code: | INT-33 |
| LMS-AUDIT-377 | Medium | Download endpoints without ownership ch… | `downloadFile` returns the storage URL for any homework id (`studentHomeworkModel::find($homeworkId)`, no tenant/student/teacher check); | INT-35 |
| LMS-AUDIT-378 | Medium | Opt-in `api_guard` coverage (uncommitte… | The new guard protects only the listed `api/*` patterns (`lms-homework/*`, `lms-assignment/*`, `exam-evaluation/*`, `question-paper/*`, `get-*`, ...). | INT-36 |
| LMS-AUDIT-379 | Medium | Print/preview helpers (fees, library, s… | 15 files build an HTML string by interpolating student/book/circular fields (or server-substituted certificate/ID-card HTML) and write it with window.open + do… | SP-02 |
| LMS-AUDIT-386 | Low | Error and response format consistency,… | Seven different envelopes: | NAPI-17 |
| LMS-AUDIT-387 | Low | Duplicated proxy code | Each copy has drifted: | NAPI-18 |
| LMS-AUDIT-395 | Low | Assistant SSE proxy | The stream proxy correctly takes the upstream host from env (`AI_UPSTREAM_BASE_URL`/`NEXT_PUBLIC_AI_BASE_URL`), unlike other routes, but forwards the raw reque… | AI-16 |
| LMS-AUDIT-401 | Low | Client API path building | `learnerId` (from `?learnerId=`), `chapterId`, `conceptId` are interpolated into paths unencoded and `?learnerId=` outranks the session id, so a crafted link (… | AI-A27 |
| LMS-AUDIT-426 | Low | Fees / Refund permission | Non-admin profiles are authorised via menu link `fees_refund` or `fees/fees_refund`, whereas menu links are route names (`fees_refund.index`); | FIN-30 |
| LMS-AUDIT-428 | Low | Inventory / Transportation / Hostel mas… | Deletes have no reference checks (hard delete hostel/room/route/vehicle/item/vendor even when referenced; | FIN-52 |
| LMS-AUDIT-429 | Low | Unauthenticated legacy student routes | Routes are outside any auth group; | STU-42 |
| LMS-AUDIT-438 | Low | Dead / broken routes and repo hygiene | 500s, broken tooling (route caching impossible: | BE-33 |
| LMS-AUDIT-443 | Low | Diagnostic route | Anonymous route returns `Neo4jService::testConnection()`, which returns `$e->getMessage()` on failure (bolt URI/auth errors). | INT-38 |
| LMS-AUDIT-445 | Info | Patterns worth replicating | Not a defect. The Users module asks the server what the actor may do and hides controls accordingly while the server independently enforces; | AUTH-34 |
| LMS-AUDIT-452 | Info | General config APIs (positive control) | These controllers are the reference implementation: | HR-36 |


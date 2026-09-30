# PART 02 - Next.js API route handlers (`D:\lms_k12\app\api\**`) + server-side libs

Auditor scope: Phase 5 + server-side security for the Next layer. Read-only static analysis. Laravel side traced in
`D:\next_lms_erp` (routes/api.php, routes/fees.php, routes/mcp.php, routes/ai.php, app/Http/Middleware/*,
controllers named per endpoint). No `.env*` read (only `.env.example`). No server started, no network.
Repo HEAD at audit time: `771e66058d6f`. Live env values = `NOT VERIFIED`.

Headline: the Next layer has **no server-side authentication of its own** (no `middleware.ts`/`proxy.ts`, no shared
guard). Every handler is either (a) a pass-through that relies on Laravel to authenticate, or (b) a self-contained
handler (agents, conversational-ai, integration-configs, process/convert, screenCandidate, question-paper/asset) that
trusts client-supplied headers for identity/tenant/upstream host. Twenty-plus handlers let the *client* choose the
upstream host (`x-laravel-base-url`), which is a full-read SSRF and a bearer-token exfiltration primitive, and it
also defeats the RBAC check the agents engine relies on. On the Laravel side, five "module dashboard" endpoints that
these handlers call are completely unauthenticated, and the fees dashboard trusts a body `sub_institute_id` over the JWT.

---

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
| `packages/conversational-ai-core/src/*` | 2 | `file-store.ts` | followup-suggestions.ts not reviewed | - | file-store is imported by nothing (dead) but its output is committed (see NAPI-13) |
| `.data/` JSON store | 0 on disk | n/a | - | - | `/.data/` is gitignored (`.gitignore:48`), directory does not exist in this checkout. Store code reviewed instead. |
| Laravel cross-trace (`D:\next_lms_erp`) | ~25 files | routes, `HydratesLegacyApiSession`, `SessionMiddleware`, `McpAuth`, `McpContextHydrator`, `McpRateLimit`, `LmsApiAuth`, `RequireStaffRole`, `VerifyCsrfToken`, `ImportApiController`, 5 dashboard controllers, `FeesDashboardApiController`, `online_fees_payment_api_controller`, `PermissionsController`, `ForgotPasswordController` | `online_fees_collect_controller` (grep only), `ToolsCallController`/`ToolRegistry` (grep) | other 7 payment gateways' response handlers | |
| **Totals** | **70 files under app/api (67 route.ts + 3 helpers)** + ~68 lib/package files | 70 / 70 under app/api | - | 0 under app/api | |

HTTP method-handlers exported across the 67 files: 76 (proxy has 5; integration-configs/[id] 3; agents, fees-cancel,
integration-configs 2 each; the rest 1).

Not reviewed: Laravel response handlers for HDFC/ICICI/Axis/AggrePay/PayPhi/HDFC-Razorpay gateways (payment callbacks live
in Laravel `online_fees_collect_controller.php`, not in the Next layer); `lib/process` parser internals; `lib/intelligence`
beyond the stream helper.

---

## 2. Module inventory (scope)

| Module | Backend (Laravel controller/route or Next api) | Frontend pages/components | DB tables (if traced) | API endpoints | Permissions/roles | Menu entry | Status |
|---|---|---|---|---|---|---|---|
| Generic Laravel proxy | Next `app/api/proxy` (GET/POST/PUT/PATCH/DELETE) -> any Laravel path under `API_BASE_URL` | 75 files call `/api/proxy?` (career-*, admissions, exam, fees, front_desk, general, ...) | n/a | `/api/proxy?path=` | none at proxy; Laravel enforces per route | n/a | Complete (but uncontrolled - NAPI-10) |
| File proxy | Next `app/api/proxy-file` (POST) | 4 files (front_desk/_lib/api.ts, ...) | n/a | `/api/proxy-file?path=` | none at proxy | n/a | Complete |
| Role dashboards (admin/teacher/student, teacher-timetable/fee-dues/icard) | Laravel `RoleDashboardApiController`, `TeacherTimetableApiController`, `TeacherFeeDuesApiController`, `TeacherIcardApiController` behind `api.session` (routes/api.php:148-156) | dashboard pages | timetable, tblstudent, fees_* | 6 Next routes | JWT decides tenant/role; controllers 403 wrong role | dashboard | Complete; Laravel side sound |
| Module dashboards (fees/admissions/students/library/hostel/transportation) | Laravel `*DashboardApiController::summary` | 15 files reference `dashboard/summary` | fees_*, admission_*, tblstudent_enrollment, library_*, hostel_*, transport_* | 6 Next routes | **fees: api.session+check_permissions but tenant from body; other five: NO auth at all** (routes/api.php:140-144) | module dashboards | **Broken security** (NAPI-04, NAPI-05) |
| Fees reports + finance proxies | Laravel `/fees/*` (routes/fees.php, group `session`,`check_permissions`; JWT validated via `SessionMiddleware` type=API) | fees pages | fees_* | 17 Next routes via `fees-report-proxy.ts` | Laravel `check_permissions` per menu right | fees menu | Complete; token travels in URL (NAPI-12) |
| Online fee payment | Next `fees/online-payment/[gateway]` -> Laravel `online_fees_payment_api_controller::initiate` (`api.session`) | `app/fees/online-payment/[gateway]/page.tsx` | fees_payment, fees_razorpay, fees_online_maping | POST | JWT only | fees | Mostly complete; IDOR/amount trust on Laravel (NAPI-09); gateway callbacks are Laravel-only |
| Menu category feeds | Laravel `FeesMenuCategoryApiController`, `TeachLearnMenuCategoryApiController`, `ModuleMenuCategoryApiController` (`api.session`+`check_permissions`) | nav shell | menu tables | 4 Next routes | JWT + permission middleware | all modules | Complete |
| Library books list | Laravel `BookController@index` (web route `books`, `session` middleware, type=API JWT) | library | library_books | 1 route | menu rights | library | Complete |
| PAL submit / content-model / pedagogy-engine | `pal/submit` -> Laravel `POST /lms/pal` (redirect scraped); content-model/pedagogy-engine -> unauthenticated Laravel read endpoints | PAL pages | semantic_intelligence, PAL tables | 3 routes | submit: JWT via Laravel; other two: public reference content | PAL | Mostly complete; submit relies on redirect-scraping (documented backend gap) |
| Auth helpers | `forgot-password` -> Laravel `POST /forget-password` (web); `google-auth` -> **`/api/google-auth` (does not exist in Laravel)** | login page, `contexts/AuthContext.tsx:246` | password_resets, tbluser | 2 routes | public | login | forgot-password Partially complete; **google-auth Broken** (NAPI-06) |
| MCP bridge | Next `mcp/*` -> Laravel `/api/mcp/*` (`McpAuth` JWT + `McpRateLimit` + `McpContextHydrator`) | 6 files | ai_* | 3 routes | JWT; institute validated against token claim | AI panel | Complete; client-chosen `baseUrl` (NAPI-01) |
| AI: ask/stream, field-edit, assistance-tickets | Laravel `/api/ai/*` behind `McpAuth` (routes/ai.php:38-40) | AI panel, sparkle field editor | ai_* | 3 routes | JWT + 60/min per user | AI | Complete; Laravel enforces |
| Agents (Enterprise Brain) | **Next-native**: `lib/agents/engine.ts` + JSON store `.data/agents.json`; RBAC asked of Laravel `/api/permissions` (`lms.auth`) | 12 files (`lib/agents/client.ts`) | none (JSON file) | 5 routes | `agents.<module>` create/update via Laravel; **reads unauthenticated** | Enterprise Brain | **Broken security** (NAPI-02/03) |
| Conversational AI admin | **Next-native**: `lib/ai/conversational-admin/*` + `.data/conversational-ai.json` | 3 files | none | 3 routes | writes: `conversational_ai` update via Laravel; reads: any non-empty token | Enterprise Brain | Partially complete; service tokens never verified (NAPI-14) |
| Integration configs | **Next-native mock**, in-memory arrays | `app/task-management/administration/integration/*` | none | 3 route files (6 methods) | any Authorization header | Task Mgmt > Integration | **Stub/Broken** (NAPI-07) |
| Import data | Next `import/*` -> Laravel `ImportApiController` (`api.session` only) | `app/import-data/page.tsx` **calls Laravel directly, not these routes** | csv_data, import_table_fields, tbluser, tblstudent, fees_collect, result_marks | 4 routes | none beyond api.session | Import | Next routes dead; 2 of 4 lack Authorization; Laravel side has authz gap (NAPI-08) |
| Question paper asset proxy | Next-native fetch of allow-listed origins | question-paper export (3 files) | n/a | 1 route | none (public) | Exam | Complete; see NAPI-11 |
| SOP -> process converter | Next-native LLM (`@ai-sdk/google`) | 2 files | none | 1 route | none | Task/Process | Complete; unauthenticated cost (NAPI-05) |
| Candidate screening | Next-native LLM (DeepSeek/OpenRouter/Gemini) | `talent-management/recruitment/components/candidate-application-form.tsx` | none | 1 route | none | Recruitment | Complete; unauthenticated (NAPI-05) |

Flags: backend-without-UI: `import/*` Next handlers (UI calls Laravel directly), `integration-configs/test` (fake). UI-without-backend:
Google sign-in (Laravel route absent). Duplicate modules: three copies of the dashboard-proxy code (12 handlers), two copies of the menu-category
proxy (fees, teach-learn) plus `laravel-category-proxy.ts`, and two disjoint stores in `integration-configs`.

---

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
| agents/* (5 methods) | GET/list/runs: `x-sub-institute-id` and `x-user-id` non-empty. Writes: Laravel `/api/permissions?modules=agents.<m>` using the request's token **and request's base URL** | Laravel only as far as the client cooperates; see NAPI-02/03 |
| conversational-ai/* (3) | `x-laravel-token` non-empty; writes additionally call Laravel `/api/permissions` (same base-URL flaw) | same |
| process/convert, screenCandidate, question-paper/asset, forgot-password, google-auth | none (public) | n/a |
| proxy / proxy-file / library/books-list / pal/submit / import/parse|process | forward `Authorization`+`Cookie` | Laravel per target route |

Role (`x-user-profile-id/-name`) is read from headers in `fees-report-proxy.ts` (appended to Laravel query as `user_profile_id`, `user_profile_name`)
and menu proxies (`user_profile_name`). Laravel's JWT hydrator overwrites session role from the token, so that is harmless for the `session`-guarded
routes, but the Next code plainly treats client headers as identity, and `lib/agents` records them in the audit log as authoritative (NAPI-03).

## 4. Tenant / school / academic-year scoping findings

| Handler(s) | Where tenant comes from | Trusted by server? |
|---|---|---|
| dashboard/* (6) | headers `x-sub-institute-id`, `x-academic-year-id`, `x-user-id`, `x-term-id` copied into body | Laravel ignores body tenant/user, uses JWT (`HydratesLegacyApiSession`: "Tenant and user identity are taken exclusively from the verified token payload"). `syear`/`term_id` are taken from the request and are not membership-checked (they only filter that tenant's rows) - Info |
| fees/dashboard/summary | body `sub_institute_id` ("an explicit body value always wins", route.ts:71-79) -> Laravel `FeesDashboardApiController::summary` filters by `$validated['sub_institute_id']`, not session | **Trusted -> cross-tenant read** (NAPI-04b) |
| admissions/students/library/hostel/transportation dashboard | body value wins; Laravel filters by body value, no auth | **Trusted, unauthenticated** (NAPI-04a) |
| fees reports (17) | headers -> query/body `sub_institute_id`,`syear`,`user_id`,`user_profile_id`,`client_id`,`token` | Laravel `session` middleware overrides session from JWT; controllers read `session()`. Client query params are appended *before* the session values (`buildLaravelUrl`), and only overwritten when the header is present - harmless behind JWT |
| menu-categories (3 routes + lib) | headers -> query `sub_institute_id`,`user_id`,`user_profile_name` | Laravel `api.session` ignores them |
| agents/* | `x-sub-institute-id`, `x-user-id`, `x-user-name`, `x-user-profile-*` headers | **Trusted blindly.** The agent store is partitioned by that header; `created_by` and run-log actor fields are header values. The token is never compared to the claimed tenant |
| conversational-ai/* | none (store is global per project, not per tenant) | settings/tokens are one global record per project id: any school admin with `conversational_ai:update` changes settings for all tenants - Architectural |
| mcp/tools/call | `meta.instituteId/academicYear/termId` from body | Laravel validates institute vs JWT (`McpContextResolver::resolveInstituteId`), and year/term membership. Sound |
| ai/ask/stream | `x-mcp-institute-id` header forwarded | same validation on Laravel. Sound |
| fees/online-payment/[gateway] | form field `student_id`, `pay_amount`, `total` | Laravel `createRazorpayOrder` looks up `tblstudent` by id with no tenant/ownership check (NAPI-09) |
| integration-configs | none (single global array across all tenants) | **Global**; any caller sees/edits every tenant's records (NAPI-07) |
| import/* | none in Next; Laravel uses session tenant for `sub_institute_id` but `csv_data` rows have no tenant column | cross-tenant `csv_data` id reuse (NAPI-08) |

---

## 5. API endpoints exposed - all 67 handlers

Legend: "Next auth" = what the Next handler itself checks. "Fwd" = what is forwarded. Base URL = `API_BASE_URL` (env
`NEXT_PUBLIC_API_BASE_URL_PROD|DEV`, chosen by NODE_ENV on server) unless flagged **CLIENT-BASE** = also honours client header
`x-laravel-base-url` (SSRF, NAPI-01). Validation "none" = raw pass-through. All file system access: none, except agents and
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
| 21 | POST | `/api/fees/online-payment/:gateway` | fees/online-payment/[gateway]/route.ts | none | base env only (`API_BASE_URL`); Bearer from **form field `token`**; `Origin` echoed from client | gateway allow-list of 8; form otherwise untouched | upstream HTML/JSON passed through incl. `Location`, `Content-Type` | `api.session`; amount/student unchecked (NAPI-09) |
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
| 40 | POST | `/api/forgot-password` | forgot-password/route.ts | none (public) | **CLIENT-BASE** `/forget-password` (root, not /api), Cookie only | JSON `email` string non-empty; no format check | Laravel JSON (`exists:tbluser,email` 422 leaks existence; mail error string leaked) / 502 HTML-detected message | Laravel web route; no throttle; CSRF blanket-disabled on prod hosts (NAPI-12) |
| 41 | POST | `/api/google-auth` | google-auth/route.ts | none (public) | **CLIENT-BASE** `/api/google-auth` with `credential` | `credential` or `id_token` string | Laravel payload / 502 | **Route does not exist in Laravel** (no match in app/, routes/, config/) |
| 42 | POST | `/api/hostel/dashboard/summary` | hostel/dashboard/summary/route.ts | none (token optional) | **CLIENT-BASE** `/api/hostel-dashboard/summary` | body free-form | pass-through | **NONE** (api.php:143) |
| 43 | POST | `/api/import/match-fields` | import/match-fields/route.ts | none | base env; **drops Authorization/Cookie** (headers arg is a plain object so the `instanceof Headers` branch never fires) | `request.json()` unvalidated | `{...}` or `{message}` 502 | `api.session` -> always 401 via this route. Unused (page calls Laravel directly) |
| 44 | POST | `/api/import/parse` | import/parse/route.ts | none | base env; forwards Authorization/Cookie/Referer; re-streams multipart | none (no size/type check in Next) | JSON | `api.session`; `mimes:csv,xlsx`, no size cap; unused route |
| 45 | POST | `/api/import/process` | import/process/route.ts | none | same as 44 | none | JSON | `api.session` only; no `staff.only`/`check_permissions` (NAPI-08); unused route |
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
| 59 | POST | `/api/pal/submit` | pal/submit/route.ts | none | **client base** (`x-laravel-base-url`) `/lms/pal`, Bearer+Cookie, raw form body, `redirect:'manual'`, scrapes `Location` for ids | none | `{status:'1',questionPaperId,onlineExamId}` / `{status:'0'}` | web route `session` (JWT); CSRF exempt on prod hosts only by full-URL wildcard (NAPI-12) |
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
No secret is returned to the client by any handler *except* the integration-config secrets the client itself stored (NAPI-07) and the one-time
service-token plaintext (by design). No key is hard-coded in tracked source under this scope.

---

## 6. Business-logic notes (key flows)

**Agent run (`POST /api/agents/:id/run`)**: Input: headers (`x-laravel-base-url`, `x-laravel-token`, `x-sub-institute-id`, `x-user-id`, `x-user-name`,
`x-user-profile-*`, `x-academic-year`, `x-term-id`) + body `{tool?, arguments?}` -> Validation: tenant/user headers non-empty (`requireActor`); agent must exist in
that header tenant -> Rule: `authorize(agents.<module>,'update')` = `GET {baseUrl}/api/permissions?modules=...` with `Bearer x-laravel-token` (fail closed on missing
token/unregistered module/malformed reply, but `baseUrl` is client-chosen); agent must be `active`; tool must be in `tools_allowed` -> DB change: append run row (success/
failure/denied) to `.data/agents.json` including full tool `output` -> Side effect: MCP read tool called at `{baseUrl}/api/mcp/tools/call` with the token -> Output:
`{status:1,data:{run}}`; denied returns 403 plus the denied row.

**Service-token rotation**: `POST /projects/:id/token` -> project must be `kind:'external'` -> `update` on `conversational_ai` via Laravel (same base-URL flaw) -> mint
`cai_<project>_<40hex>`, store sha256 + last4 -> return plaintext once. `authenticateServiceRequest` (the verifier) is referenced only in tests: no route ever accepts these tokens.

**Fee online payment (Razorpay)**: Next accepts multipart, moves form `token` to Bearer, forwards to Laravel `initiate` -> Laravel takes `student_id`, `pay_amount||total` from the client,
looks up the student **without tenant/ownership filter**, reads Razorpay creds of `session sub_institute_id`, creates the order for the client amount, inserts `fees_payment` row
(status `PR`). Nothing reconciles amount to dues. Razorpay callback (`razorpay_response_handler`) does verify `razorpay_signature` (Laravel, line ~3097, 3382). The other seven gateways' response
handlers were not reviewed.

**PAL submit**: Next posts urlencoded body to `/lms/pal` with `redirect:'manual'`, parses the `Location` for `/lms/pal/{id}?online_exam_id=` and reports `Exam submitted`. Any non-matching redirect is a 502.
There is no other confirmation that the exam was persisted.

**SOP convert**: text (20..20000 chars) -> deterministic parser first; if no error and spec produced, return `method:"structured"` with no model call; else Gemini `generateObject` (temperature 0)
-> `toIntakeText` -> re-parse -> return proposal. Never persisted. Output is JSON only; no HTML is produced in this route.

**Candidate screening**: `{resume, jdData}` -> prompt string built by interpolation of the raw resume and JD fields -> DeepSeek, then OpenRouter paid, then two OpenRouter free models, then Gemini -> JSON parse (regex fallback)
-> deterministic substring skill match on the raw resume. The response's `recommendation` (`Schedule Interview|Request Additional Info|Reject`) is model output fully steerable by resume text (prompt injection).

**Import (Laravel side, reached directly by the page)**: `parse` stores upload under relative dir `import/` (Laravel cwd = `public/`), parses whole file in memory, stores all rows JSON in `csv_data` (no tenant column),
returns first 10 rows; `match-fields` writes flags by id; `process` loops rows, maps `fields[]` -> column names supplied by the client, and inserts/updates only when `table_name` equals one of
`tbluser`, `result_personalize_marks`, `fees_collect`, `tblstudent`, `result_marks`.

---

## 7. Test / documentation coverage for scope

- Route-handler tests: **none** (zero `*.test.ts` under `app/api`).
- Unit tests touching scope: `lib/agents/engine.test.ts` (12 cases, in-memory store + stub authorizer; does not test the real `laravelAuthorizer` or header trust), `lib/agents/registry.test.ts` (8),
  `lib/ai/conversational-admin/service.test.ts` (8, covers token mint/verify/rotate), `lib/process/conversion.test.ts`, `lib/ai/ai-capabilities.test.ts`,
  `lib/question-paper/images.test.ts` (covers `isAllowedAssetUrl` origin comparison, which is the SSRF control for the asset proxy).
- No tests for SSRF, base-URL handling, proxies, dashboards, fees proxies, screenCandidate, integration-configs, or file store race behaviour.
- Documentation: `.env.example` explicitly states the upstream host must never come from the request ("Never read from the request ... any host and have the caller's bearer token forwarded there",
  `AI_UPSTREAM_BASE_URL` block) but 20+ handlers do exactly that; it also still says field editing uses the local Gemini key while `ai/field-edit` now proxies to Laravel. Several env vars used in code are undocumented (see section 5).
  Laravel-side docs referenced by comments (`next_lms_erp/docs/fees-api/fees-dashboard-contract.md`) not verified.

---

## 8. NOT VERIFIED

1. Live values of `NEXT_PUBLIC_AI_BASE_URL`, `AI_UPSTREAM_BASE_URL`, `QUESTION_ASSET_ORIGINS`, API keys - REASON: `.env*` not read. If `NEXT_PUBLIC_AI_BASE_URL` is set in production, the `baseUrl` override in `mcp/*` is neutralised (`resolveAiBaseUrl` gives the override precedence); all other `x-laravel-base-url` handlers are unaffected either way.
2. Hosting platform of the Next app (Vercel vs self-hosted) and its network reach - REASON: no deploy config in repo (`vercel.json` absent, no Dockerfile). Determines what an SSRF can reach (cloud metadata, VPC). Laravel CORS regex `lms-k12-*.vercel.app` suggests Vercel.
3. Whether `.data/agents.json` exists/has rows in any deployed environment - REASON: gitignored, not present in checkout.
4. Exploitability of upstream `redirect:'follow'` in `question-paper/asset` - REASON: needs an open redirect on an allow-listed host; not searched in Laravel.
5. Payment callbacks/webhook signature verification for HDFC, ICICI, ICICI-orange, Axis, AggrePay, PayPhi, HDFC-Razorpay - REASON: lives in Laravel `online_fees_collect_controller.php` (~3700 lines), outside this part; only Razorpay signature checks confirmed by grep.
6. Whether `public/import/*` files are reachable over HTTP in production - REASON: 13 real uploaded files exist under `D:\next_lms_erp\public\import` (gitignored), Laravel `public/` is normally the docroot; web server config not seen.
7. Runtime behaviour of `gemini-3.6-flash` default (see NAPI-20) - REASON: no network.
8. That `x-forwarded-host`/`host` in `app/pal/data/pal-content-model.ts:1126` is trusted by the hosting platform - REASON: platform config not seen.
9. Laravel `GET /api/pal/pedagogy-engine` and `/api/semantic-intelligence*` data sensitivity (tenant column?) - REASON: controllers not opened.

---

## 9. Second-pass results (scope: app/api, lib/agents, lib/ai, lib/process, lib/laravel-category-proxy.ts, packages)

| Pattern | Count | Material hits |
|---|---|---|
| `TODO|FIXME|HACK|XXX` | 0 | - |
| `console.log` | 0 | - |
| `console.error/warn` | 14 | logs upstream host+path (`ai/ask/stream/route.ts:90,167`), raw provider errors (`screenCandidate` 163,179,197,258), agents (`agents/_lib/handler.ts:50`); no secrets logged. `console.error` of full `error` objects may include upstream URLs |
| `debugger`, `eval(`, `new Function`, `dangerouslySetInnerHTML`, `innerHTML` | 0 | no HTML rendering in server code; `process/convert` returns JSON only. HTML-injection surface is `fees/reports/other-fees/ledger` and `proxy-file`, which relay upstream HTML/content-type verbatim |
| `localStorage`/`sessionStorage`/`window` in server code | 0 | (client side of these flows is Part frontend: token stored in browser storage and re-sent as headers) |
| hardcoded URLs | 4 | provider endpoints in `screenCandidate/route.ts:19,20,29`; placeholder base in `pal/submit/route.ts:92`. No hard-coded emails/phones/IPs/ids in server code. **Committed PII** in `.kilo/conversational-ai/*` (NAPI-13) |
| `fetch(` call sites in scope | 34 in app/api + lib (32 route-side, 2 lib: acting-user, mcp-client) + 20 in `app/pal/data`/`app/course-master/data` | every server fetch goes to Laravel except `question-paper/asset` (arbitrary allow-listed origin) and the 3 LLM vendors in `screenCandidate` + Gemini via SDK |
| `x-laravel-base-url` reads | 20 code sites -> **~40 handlers** (6 role dashboards, 6 module dashboards, 3 menu routes + 2 via lib, 17 fees/report proxies via helper, forgot-password, google-auth, pal/submit, agents x5 + conversational-ai x3 via `readRequestSession`) | NAPI-01 |
| `sub_institute_id`/`syear`/`user_id`/`user_profile_*` sourced from client headers/body | 17/13/17/7 header reads | NAPI-03/04/05 |
| `role`/`user_profile_id` handling | header-derived in `fees-report-proxy.ts` (`x-user-profile-id/-name`), `agents` actor | Laravel overrides for JWT-guarded routes; agents log it verbatim |
| Empty handlers / mock data / placeholder responses | 4 | `integration-configs` x3 files (in-memory mock + fake test-success), `import/*` unused |
| `return []`/mock arrays | `records: IntegrationConfig[] = []` (route.ts:18) and `globalThis.integrationRecords = []` ([id]/route.ts:23-26) | NAPI-07 |
| Upstream timeouts | 1 of ~40 proxies (`teach-learn/menu-categories`, 15 s); `AbortSignal` only in `ask/stream` | NAPI-15 |
| Rate limiting in Next | 0 handlers | NAPI-05, NAPI-15 |

---

## 10. ISSUES

## NAPI-01
**Severity:** Critical   **Type:** Confirmed
**Category:** Security
**Module:** Every Laravel-proxying Next handler (SSRF + token exfiltration)
**Location:** `app/api/fees/reports/_lib/fees-report-proxy.ts:31` (used by 17 routes); `lib/laravel-category-proxy.ts:55`; `app/api/dashboard/{admin,student,teacher,teacher-fee-dues,teacher-icard,teacher-timetable}/route.ts:42`; `app/api/{fees,admissions,students,library,hostel,transportation}/dashboard/summary/route.ts` (`readHeader(request,'x-laravel-base-url')`); `app/api/fees/menu-categories/route.ts:44`; `app/api/teach-learn/menu-categories/route.ts:45`; `app/api/forgot-password/route.ts:42`; `app/api/google-auth/route.ts:172`; `app/api/pal/submit/route.ts:77`; `lib/agents/acting-user.ts:39`; `app/api/mcp/capabilities/route.ts:12` (`baseUrl` query); `app/api/mcp/tools/call/route.ts:17,30` (`baseUrl` body) via `lib/ai/mcp-client.ts:596` + `app/components/utils/api_url.tsx:107`
**Function/Method:** `readSession`, `proxyCategoryRequest`, all dashboard `POST`, `readRequestSession`, `resolveAiBaseUrl`
**Problem:** The upstream host is taken from a request header/param the caller controls. The server then sends the request there, attaching the caller-supplied bearer token and cookies, and returns the response. No allow-list, no scheme/host check, no private-IP block.
**Evidence:** `const baseUrl = readHeader(request, 'x-laravel-base-url') || getDefaultBaseUrl();` then `fetch(\`${baseUrl}${LARAVEL_PATH}\`, {... Authorization: Bearer ${token}, Cookie ...})`. `fees-report-proxy.ts:59` `new URL(\`${session.baseUrl}${laravelPath}\`)`. `proxyFeesReportTextGet` (`other-fees/ledger`) has **no auth or header precondition** and returns `text` + upstream `Content-Type` verbatim. A value such as `http://10.0.0.5:8080/x?` turns the fixed Laravel path into a query string so the attacker picks host, port and path. `.env.example` (AI_UPSTREAM_BASE_URL block) states the design rule that this must never happen; only `ai/ask/stream` obeys it.
**Impact:** Unauthenticated full-read SSRF (`other-fees/ledger`, GET reports need only two non-empty headers) and blind/partial-read SSRF (JSON routes echo JSON bodies; non-JSON echoed as a 500-char preview) against anything the Next server can reach: internal services, cloud metadata, loopback admin ports. Also a forwarding target for any real user's `Authorization` if an attacker can influence the header the browser sends (e.g. via the client-stored `host_name` session field that `lib/erp-client.ts:141` and `lib/agents/client.ts:74,104` read from browser storage, poisoned by any XSS or a stored profile value).
**Expected Behavior:** Upstream host resolved only from server env; client-supplied base URL ignored (or validated against an explicit allow-list of exact origins).
**Recommended Fix:** Delete every `x-laravel-base-url`/`baseUrl` read; use a single `getUpstreamBase()` (env only). Extract the 20 duplicated `getDefaultBaseUrl/readHeader/jsonError` copies into `lib/laravel-proxy.ts`. If multi-host is required, map a signed/opaque tenant key to a server-side host table. Add an egress allow-list at the platform level.
**Verification:** Unit test: request with `x-laravel-base-url: http://127.0.0.1:1/x?` must hit the configured base (mock `fetch`), for each route. grep gate in CI: no `x-laravel-base-url` outside the shared helper.

## NAPI-02
**Severity:** Critical   **Type:** Confirmed
**Category:** Authorization
**Module:** Agents engine + Conversational AI admin (RBAC bypass)
**Location:** `lib/agents/acting-user.ts:37-47,74-108`; `app/api/agents/_lib/handler.ts:16-32`; `app/api/conversational-ai/_lib/handler.ts:15-23`; `lib/agents/engine.ts:190-250,256-329`; `lib/ai/conversational-admin/service.ts:52-55,107-131`
**Function/Method:** `laravelAuthorizer`, `readRequestSession`, `createAgent`, `setAgentStatus`, `runAgent`, `updateSettings`, `rotateServiceToken`
**Problem:** The only authorization for create/update/run/settings/token-rotate is a call to `{session.baseUrl}/api/permissions` with `session.token`. Both `baseUrl` and `token` are request headers. A caller points `x-laravel-base-url` at a server they control that answers `{"status_code":1,"data":{"agents.fees":{"create":true,"update":true}}}` and every check passes. The tenant and user identity are also headers (`x-sub-institute-id`, `x-user-id`).
**Evidence:** `baseUrl: (header(request,'x-laravel-base-url') || defaultBaseUrl())`; `const url = \`${session.baseUrl}/api/permissions?...\``; `if (flags[action] !== true) deny`. Comment at top of file claims "the engine never has to trust a request body for identity or rights" - headers are the same trust boundary.
**Impact:** Anyone with network access to the Next app can create agents in any tenant, activate/pause/archive them, run them (which calls MCP with the supplied token at the supplied host), change conversational-AI channel settings, and rotate external-project service tokens receiving the new plaintext (invalidating the legitimate one). Combined with NAPI-01 it also exfiltrates a real user's token when the header is poisoned.
**Expected Behavior:** Rights decided against the configured Laravel, with tenant/user derived from the verified token, never from headers.
**Recommended Fix:** Env-only base URL; verify the JWT (or call a Laravel `/api/me`) to obtain `sub_institute_id`,`user_id`,`user_profile_*` and ignore the `x-*` identity headers; better, move agents/tokens into Laravel where `perm:` middleware already exists.
**Verification:** Test with stub Laravel returning allow for a token unknown to real Laravel: engine must deny. Route test asserting `x-sub-institute-id` differing from token tenant is rejected.

## NAPI-03
**Severity:** High   **Type:** Confirmed
**Category:** Authorization
**Module:** Agents (list/runs, audit integrity)
**Location:** `app/api/agents/route.ts:11-19`; `app/api/agents/runs/route.ts:10-24`; `lib/agents/engine.ts:175-188,190-227`; `lib/agents/store.ts:484-511`
**Function/Method:** `listAgents`, `listRuns`, `requireActor`, `createAgent`
**Problem:** `GET /api/agents` and `GET /api/agents/runs` perform **no authentication or authorization**; `requireActor` only checks that `x-sub-institute-id` and `x-user-id` are non-empty strings. The tenant partition is the header value. Run rows contain the complete `output` of live-record MCP tools (e.g. fee-defaulter cohorts).
**Evidence:** `listRuns(context)`: `requireActor(context.actor); return context.store.listRuns(context.actor.tenant_id, filter)`. `created_by: context.actor.user_id`, `acting_user_name: context.actor.user_name` come from headers, so the audit trail ("an auditor should be able to see who tried") records whatever the caller typed. `limit` unbounded.
**Impact:** Unauthenticated cross-tenant read of every agent and run log by iterating small integer tenant ids; forged attribution in the run log; log flooding (`appendRun` for denied runs).
**Expected Behavior:** Verified session required for reads; audit identity from verified token claims.
**Recommended Fix:** Same as NAPI-02; additionally cap `limit`, paginate, and redact `output` for callers lacking `view` on `agents.<module>`.
**Verification:** Unauthenticated GET with arbitrary tenant header must return 401.

## NAPI-04
**Severity:** Critical   **Type:** Confirmed
**Category:** Security
**Module:** Module dashboards (Laravel unauthenticated endpoints reached by 5 Next routes + tenant IDOR on fees)
**Location:** (a) `D:\next_lms_erp\routes\api.php:140-144`; controllers `AdmissionsDashboardApiController.php:34-39`, `StudentsDashboardApiController.php:21-26`, `LibraryDashboardApiController.php:28-33,77`, `HostelDashboardApiController.php:29-34`, `TransportationDashboardApiController.php:21-26`. (b) `D:\next_lms_erp\app\Http\Controllers\api\FeesDashboardApiController.php:24-35`, routes/api.php:133. Next: `app/api/{admissions,students,library,hostel,transportation}/dashboard/summary/route.ts:70-72` and `app/api/fees/dashboard/summary/route.ts:75-88,94`.
**Function/Method:** `summary()` in the five controllers; `FeesDashboardApiController::summary`; Next `POST`
**Problem:** (a) The five routes are registered with no middleware ("stateless: tenant/year travel in the request body and there's no permission check, so no session middleware is required"). They validate only that `sub_institute_id` and `syear` are present and filter by them. (b) The fees dashboard sits behind `api.session`+`check_permissions` but reads tenant from the validated **body**, not the JWT session, so a valid token of tenant A can request tenant B. The Next handler codifies it: `sub_institute_id: requested.sub_institute_id ?? subInstituteId` ("an explicit body value always wins").
**Evidence:** `Route::post('admissions-dashboard/summary', ...)` (no `->middleware`); `LibraryDashboardApiController` selects `CONCAT_WS(' ', s.first_name, s.last_name) as student_name` with book titles; `AdmissionsDashboardApiController` returns enquiry `student_name`, `enquiry_no`; `StudentsDashboardApiController` returns recent enrolments with names, standard, division. The Next route sends the token only `if (token)`.
**Impact:** Unauthenticated reads of school-level counts and student names for any tenant id (directly against Laravel, no need for Next); authenticated cross-tenant read of fee collection/outstanding financials.
**Expected Behavior:** Every dashboard behind `api.session` with tenant taken from `session('sub_institute_id')`; body tenant ignored.
**Recommended Fix:** Add `api.session` (+ `check_permissions`) to the five routes; replace `$validated['sub_institute_id']` with `session()->get('sub_institute_id')` in all six controllers; in Next require a token and stop overriding tenant from body.
**Verification:** Feature test: unauthenticated POST returns 401; token for tenant 1 with body tenant 2 returns tenant-1 data (or 403).

## NAPI-05
**Severity:** High   **Type:** Confirmed
**Category:** Security
**Module:** Unauthenticated LLM-cost endpoints (process/convert, screenCandidate)
**Location:** `app/api/process/convert/route.ts:129-258`; `app/api/screenCandidate/route.ts:113-263`; `lib/ai/local-model.ts:10-25`
**Function/Method:** `POST`
**Problem:** Both handlers are public and call paid model APIs with server-side keys; there is no auth, rate limit, quota or per-IP throttle. `screenCandidate` accepts `resume` and `jdData` of unbounded size and shape (`jdData.core_skills?.join`, `resume.toLowerCase()` throw a TypeError on non-array/non-string, yielding a 500 with `details: error.message`), concatenates them into the prompt (prompt injection controls `recommendation`), fails over across DeepSeek -> OpenRouter paid -> two OpenRouter **free** models -> Gemini, so candidate PII (resumes) is sent to up to four third parties including free tiers with possible training use.
**Evidence:** `const { resume, jdData } = await req.json(); if (!resume || !jdData) ...` no length check; `for (const freeModel of ['openai/gpt-oss-20b:free', 'nvidia/nemotron-nano-9b-v2:free'])`; `process/convert` zod caps text at 20000 but only `allowAi:true` default is required for a Gemini call.
**Impact:** Anyone on the internet can burn provider budget / exhaust quota (and quota exhaustion also breaks legitimate use; the routes return provider messages), and can steer or spoof hiring recommendations. Privacy exposure of resumes.
**Expected Behavior:** Authenticated staff only; bounded inputs; rate/quota; documented data-processing terms.
**Recommended Fix:** Require a verified Laravel session; add per-user rate limit and size caps (resume <= e.g. 20k chars, `jdData` zod schema); drop free-model fallback for PII; return generic errors.
**Verification:** Unauthenticated request returns 401; 21st request in a minute returns 429; oversized resume returns 413/422.

## NAPI-06
**Severity:** Medium   **Type:** Confirmed
**Category:** Backend
**Module:** Google sign-in
**Location:** `app/api/google-auth/route.ts:150,210`; `contexts/AuthContext.tsx:246-262`; `app/login/page.tsx:32,72-118`
**Function/Method:** `POST`, `loginWithGoogle`
**Problem:** The Next route forwards to `{base}/api/google-auth` but there is no such route or controller in `D:\next_lms_erp` (`grep -rIl "google-auth\|GoogleAuth\|google_auth"` over `app`, `routes`, `config` returns nothing). The header comment says "Expected: same shape as /api/api-login", i.e. the backend is assumed. The login page also depends on `NEXT_GOOGLE_CLIENT_ID`, which is not in `.env.example` and is not `NEXT_PUBLIC_`-prefixed (so it is not exposed to browser code unless mapped elsewhere).
**Evidence:** Laravel routes contain only `google-analytics-summary`; the Next handler returns 502 `Laravel returned a non-JSON response` when Laravel 404s with HTML.
**Impact:** "Sign in with Google" cannot succeed against this backend; if a Google endpoint is later added, the design has the Next route (public, base-URL-spoofable per NAPI-01) relaying the credential.
**Expected Behavior:** Either a Laravel endpoint verifying the ID token (audience/issuer/expiry, mapping to `tbluser.email` and `status='1'`) or the button removed.
**Recommended Fix:** Implement and test the Laravel endpoint; remove the client-controlled base URL from this route; document `NEXT_GOOGLE_CLIENT_ID`.
**Verification:** POST a valid Google credential in a staging env and receive the login payload; invalid token returns 401 JSON.

## NAPI-07
**Severity:** High   **Type:** Confirmed
**Category:** Backend
**Module:** Integration configs (mock store holding provider secrets)
**Location:** `app/api/integration-configs/route.ts:18-19,25-69`; `app/api/integration-configs/[id]/route.ts:18-26,32-115`; `app/api/integration-configs/test/route.ts:7-22`; client `app/task-management/_lib/integration-management-api.ts:84-123`; secret fields `app/task-management/administration/integration/components/integration-providers.ts:23,41,59,99,100`
**Function/Method:** `GET/POST` (collection), `GET/PUT/DELETE` (`[id]`), `POST` (test)
**Problem:** (1) The collection route keeps records in module-level `const records`/`let nextId`; the `[id]` route keeps a different array on `globalThis.integrationRecords`. POST-created records are never visible to GET/PUT/DELETE `/:id` (always 404). (2) "Auth" is `Authorization` header present; any string passes. (3) Store is a single global array: not tenant scoped, lost on every cold start/instance, and returned in full (including `api_key`, `access_token`, `password`, `key_secret`, `webhook_secret` typed as `config`) by `GET`. (4) `test` always answers `success:true, "Connection to X tested successfully."`. The client file says the Laravel endpoint "does not yet expose" this and treats the mock as "fully functional".
**Evidence:** `if (!authorization) return 401` is the only check; `data: { configs: records }`; `message: \`Connection to ${providerKey} tested successfully.\``.
**Impact:** Users are told integrations were saved and verified when they were neither; anyone sending `Authorization: x` reads every tenant's stored secrets; secrets sit in process memory of a serverless function.
**Expected Behavior:** Persisted per-tenant configs behind real auth, secrets encrypted and masked on read; a real connection test.
**Recommended Fix:** Move to Laravel (`task-management/integration-configs`) with encrypted columns and masking; until then disable the routes or return 501; remove the fake success.
**Verification:** After POST, GET `/:id` returns the record; GET without a valid JWT returns 401; secrets absent from GET payload.

## NAPI-08
**Severity:** High   **Type:** Confirmed
**Category:** Authorization
**Module:** Import data (Laravel API, proxied by Next `import/*`)
**Location:** `D:\next_lms_erp\routes\api.php:548-553`; `D:\next_lms_erp\app\Http\Controllers\api\ImportApiController.php:22-110 (parse), 112-455 (process), matchFields`; Next `app/api/import/{parse,process,match-fields,tables}/route.ts`
**Function/Method:** `parse`, `process`, `matchFields`, `tables`
**Problem:** The four routes are behind `api.session` only: no `staff.only`, no `check_permissions`, no per-table right. Any authenticated identity (student/parent tokens included) can upload a file and `process` rows into `tbluser`, `tblstudent`, `fees_collect`, `result_marks`, `result_personalize_marks` using **column names chosen by the client** (`$prepareData[$request->fields[$key]] = ...`). `csv_data` has no tenant column: `DB::table('csv_data')->find($request->csv_data_file_id)` and `matchFields` update by bare id, allowing cross-tenant reuse/tampering. `parse` validates `mimes:csv,xlsx` only (no size cap), saves to relative `import/` (Laravel cwd is `public/`) with a 5-digit random suffix; 13 such files exist under `public/import`, never deleted.
**Evidence:** `Route::middleware('api.session')->prefix('import')->group(...)`; `if ($request->table_name == 'tbluser') { ... DB::table($request->table_name)->insert($prepareData);`. Next side: `import/tables` and `import/match-fields` build headers from a plain object, so the `instanceof Headers` branch that would copy `cookie/referer` never runs and **no Authorization is forwarded** (always 401); `import/parse|process` forward Authorization but are unused because `app/import-data/page.tsx:99,151,183,247` calls Laravel directly.
**Impact:** A low-privilege user can create/modify privileged `tbluser` rows (e.g. an Admin-profile account with a chosen email/password) in their tenant, corrupt students/fees/marks, and read or overwrite other tenants' staged CSV data; uploaded PII spreadsheets may be web-reachable at predictable names (`NOT VERIFIED`, see section 8).
**Expected Behavior:** Staff-only with import permission, whitelist of `table_name`/column names from `import_table_fields`, tenant-scoped `csv_data`, private storage with deletion after processing.
**Recommended Fix:** Add `staff.only`+`check_permissions`; validate `table_name` and each `fields[]` value against `import_table_fields`; add `sub_institute_id` to `csv_data`; store under `storage/app`; delete Next `import/*` handlers or fix them.
**Verification:** Student token gets 403; unknown column rejected 422; `csv_data_file_id` of another tenant returns 404.

## NAPI-09
**Severity:** High   **Type:** Confirmed
**Category:** Business Logic
**Module:** Fees online payment
**Location:** `D:\next_lms_erp\app\Http\Controllers\fees\online_fees\online_fees_payment_api_controller.php:15-34 (preview), 54-108 (createRazorpayOrder)`; `online_fees_collect_controller.php:51-72 (get_fees)`; Next `app/api/fees/online-payment/[gateway]/route.ts:8-18`
**Function/Method:** `initiate`, `createRazorpayOrder`, `preview`/`get_fees`
**Problem:** `student_id` and the amount (`pay_amount ?: total`) are taken from the client. The student is fetched with `where('t.id', $studentId)` and no tenant or ownership check; `get_fees` derives `sub_institute_id` from the student row rather than the session. The amount is not reconciled with fee dues. Next forwards the whole form and client `Origin` untouched.
**Evidence:** `$amount = (float) ($request->input('pay_amount') ?: $request->input('total')); ... ->where('t.id', $studentId)->orderByDesc('e.syear')->first(...)`; order created with the *session tenant's* Razorpay credentials.
**Impact:** Any authenticated user can create payment orders for any student id in any tenant against the caller's school gateway, view any student's fee/bank/mobile-mapping data via `preview` (`fo.bank_name`, `fees_type`, student name), and choose an arbitrary or under-paid amount; downstream posting logic not reviewed.
**Expected Behavior:** Student/parent bound to their own child ids, tenant-scoped lookups, server-computed payable amount.
**Recommended Fix:** Scope by `session('sub_institute_id')` and linked student; compute amount from `fees_breakoff` minus paid; reject mismatches.
**Verification:** Cross-tenant/other-student ids return 403/404; `pay_amount` above/below dues rejected.

## NAPI-10
**Severity:** Medium   **Type:** Architectural
**Category:** Security
**Module:** Generic proxies (`/api/proxy`, `/api/proxy-file`)
**Location:** `app/api/proxy/route.ts:6-18,20-122`; `app/api/proxy-file/route.ts:6-48`
**Function/Method:** `GET/POST/PUT/PATCH/DELETE`, `resolveTargetPath`, `POST`
**Problem:** Open pass-through to any Laravel path with the caller's `Authorization` and `Cookie`. The `path` is not normalised, allow-listed or checked for `..`. 75 files depend on it. It launders the client IP (Laravel sees the Next server), bypasses Laravel's CORS policy, and returns `target` (base URL, and full query on POST) and `cause` on errors. `proxy-file` buffers multipart with no size limit and returns the upstream body with the **upstream** `Content-Type` and `Content-Disposition` (default `inline`) from the app's own origin, without `X-Content-Type-Options: nosniff` or CSP: any HTML/SVG the ERP returns is rendered same-origin with the SPA (which stores the JWT client-side).
**Evidence:** `const url = \`${base}/${resolveTargetPath(targetPath)}\``; `return NextResponse.json({ message, cause, target: url }, { status: 502 })`; `'Content-Disposition': upstream.headers.get('content-disposition') || 'inline'`.
**Impact:** Host is fixed by env so it is not itself an SSRF, but it removes every Next-side control point, so ERP routes that lack middleware are reachable from any browser; IP-based throttling/audit in Laravel is defeated; potential same-origin XSS if any proxied ERP page reflects input (Potential).
**Expected Behavior:** Typed, allow-listed routes or a strict path allow-list; forward `X-Forwarded-For`; attachment or sanitised content types.
**Recommended Fix:** Allow-list of path prefixes, `path.includes('..')` rejection, forward client IP, drop `target/cause` from errors, force `Content-Disposition: attachment` unless content type is an inert image/PDF, add `nosniff`.
**Verification:** `path=../x`, `path=//evil` return 400; HTML response served with `text/plain`/attachment.

## NAPI-11
**Severity:** Medium   **Type:** Confirmed
**Category:** Security
**Module:** question-paper asset proxy
**Location:** `app/api/question-paper/asset/route.ts:55-135`; `lib/question-paper/images.ts:84-102`
**Function/Method:** `allowedOrigins`, `GET`
**Problem:** Unauthenticated server-side fetch of client-supplied URLs. The allow-list is compared on origin (good) but `redirect: 'follow'` re-opens the SSRF hole: a redirect from an allow-listed host (e.g. the ERP's user-uploaded content) to an internal address is followed. `image/svg+xml` is accepted and re-served from the app origin with no `nosniff`/CSP (SVG can carry script); the 8 MB cap is checked after `arrayBuffer()` has fully loaded the body (memory DoS, no `Content-Length` pre-check, no timeout). The allow-list includes `NEXT_PUBLIC_API_BASE_URL_DEV` in production.
**Evidence:** `const upstream = await fetch(url, {... redirect: 'follow'})`; `IMAGE_CONTENT_TYPE_RE = /^image\/(png|jpe?g|gif|webp|svg\+xml)$/i`; `const bytes = await upstream.arrayBuffer(); if (bytes.byteLength > MAX_BYTES)`.
**Impact:** Redirect-based SSRF to internal hosts when an open redirect exists on an allow-listed host; script execution in the app origin if an attacker can plant an SVG on an allow-listed host (ERP `public/lms_editor_upload` is user-writable) and lure a user to the proxy URL; resource exhaustion.
**Expected Behavior:** `redirect:'manual'` with re-validation per hop, non-SVG (or sanitised/`Content-Security-Policy: sandbox`), streaming size cap, timeout, auth.
**Recommended Fix:** As stated; require a session; add `X-Content-Type-Options: nosniff` and `Content-Security-Policy: default-src 'none'; sandbox`.
**Verification:** Allow-listed URL redirecting to `http://127.0.0.1/` returns 403; oversized/slow response aborted.

## NAPI-12
**Severity:** Medium   **Type:** Confirmed
**Category:** Security
**Module:** Auth support flows and CSRF (forgot-password + Laravel CSRF config) and token-in-URL
**Location:** `app/api/forgot-password/route.ts:41-134`; `D:\next_lms_erp\app\Http\Controllers\Auth\ForgotPasswordController.php:36-73`; `D:\next_lms_erp\app\Http\Middleware\VerifyCsrfToken.php:21-27`; `app/api/fees/reports/_lib/fees-report-proxy.ts:46-56`
**Function/Method:** `POST`, `submitForgetPasswordForm`, `appendSessionSearchParams`
**Problem:** (a) `forget-password` validates `email|exists:tbluser,email`, so an unknown email yields a different 422 than a known one (account enumeration), with no throttle; on mail failure the response includes `'error' => $e->getMessage()` (SMTP host/credentials hints) which Next passes through. (b) Laravel `VerifyCsrfToken::$except` contains the full-URL wildcards `https://erp.triz.co.in/*`, `https://dev.triz.co.in/*`, `http://127.0.0.1:8000/*`; Laravel checks `fullUrlIs()` as well as `is()`, so CSRF verification is off for **every** web route on those hosts (this is also why `forgot-password`, `pal/submit` (`/lms/pal`) and `books` proxies work without a token). (c) The fees report proxy places the JWT in the query string (`params.set('token', session.token)`) on both GET and the POST body, so it lands in Laravel access logs, browser/CDN logs and `Referer`.
**Evidence:** `'email' => 'required|email|exists:tbluser,email'`; `'error' => $e->getMessage()`; except list above; `if (session.token) params.set('token', session.token);`.
**Impact:** User enumeration and email bombing; CSRF protection effectively disabled on production/dev ERP hosts for cookie-authenticated web routes; bearer tokens persisted in logs.
**Expected Behavior:** Generic success message regardless of existence, throttled; explicit path-based CSRF exemptions; tokens only in `Authorization`.
**Recommended Fix:** Return the same 200 for unknown emails, add `throttle:5,1` and captcha; remove the host wildcards from `$except`; drop `token` from query/body and rely on the `Authorization` header (already sent by `buildLaravelHeaders`).
**Verification:** Same response for known/unknown; a cross-site POST to a cookie-authenticated web route fails with 419; logs contain no `token=`.

## NAPI-13
**Severity:** High   **Type:** Confirmed
**Category:** Security
**Module:** conversational-ai state (committed PII) + dead file-store
**Location:** `.kilo/conversational-ai/admission-state/*.json` (10), `.kilo/conversational-ai/workflow-state/*.json` (11), `.kilo/conversational-ai/history/7013_7013.json` (1) - all tracked; `packages/conversational-ai-core/src/file-store.ts:11-19`
**Function/Method:** `getBaseDir`, `writeStoredJson`
**Problem:** `file-store.ts` defaults its state directory to `<cwd>/.kilo/conversational-ai`, and 22 state files from real runs were committed. They contain student/enquiry full names, mobile numbers, standard/division, pending-fee figures and chat history. Nothing in the repo imports the module any more (only `ChatbotPanel.tsx` imports another file of the package), so it is dead code whose output is still in git history.
**Evidence:** `"fullName": "Rajesh", "mobile": "7655467890"`; `"studentName": "EVAAN RAJESH RAFALIYA", ... "mobileNo": "9979176562"` (8 distinct mobile numbers across the files).
**Impact:** Personal data of (possibly minor) students and parents in source control and history; the default writer targets a tracked path.
**Expected Behavior:** No state committed; `.kilo/` ignored or removed; store deleted if unused.
**Recommended Fix:** `git rm -r --cached .kilo/conversational-ai`, add to `.gitignore`, purge from history if required by policy, delete `file-store.ts` or default it under gitignored `.data/`.
**Verification:** `git ls-files .kilo | grep conversational` empty; history scan clean.

## NAPI-14
**Severity:** Medium   **Type:** Missing
**Category:** Security
**Module:** Conversational-AI service tokens
**Location:** `lib/ai/conversational-admin/service-token.ts:218-237`; `app/api/conversational-ai/projects/[id]/token/route.ts`; `lib/ai/conversational-admin/service.ts:120-131`
**Function/Method:** `authenticateServiceRequest`, `rotateServiceToken`
**Problem:** Tokens are minted, hashed and displayed, but `authenticateServiceRequest` is called only from `service.test.ts`; no route accepts `x-service-token`/`cai_` bearer. The admin screen presents rotation as if it controlled access. Also `GET /projects` needs only a non-empty token string, and settings/tokens are global rather than per tenant.
**Evidence:** `grep authenticateServiceRequest` returns only the definition and the test file.
**Impact:** False sense of security: a rotated token does not revoke or grant anything; when a route is later added it will inherit the header-trust flaws of NAPI-02.
**Expected Behavior:** Verifier wired into the shared conversational endpoints; admin reads require a verified session.
**Recommended Fix:** Wire the verifier where external projects call, verify sessions for reads, scope settings by tenant.
**Verification:** External call with rotated-away token gets 401.

## NAPI-15
**Severity:** Medium   **Type:** Missing
**Category:** Performance
**Module:** Rate limiting, body size and timeouts (all handlers)
**Location:** every `route.ts`; notably `app/api/ai/ask/stream/route.ts:115`, `ai/field-edit/route.ts`, `proxy-file/route.ts:20`, `import/parse/route.ts:9`, `proxy/route.ts`
**Function/Method:** all
**Problem:** No Next-side rate limiting anywhere (`grep` finds none); ask/stream forwards raw body text without size cap; `proxy-file`/`import/parse` buffer whole uploads (`request.formData()`); only `teach-learn/menu-categories` sets an upstream timeout (15 s) and only ask/stream forwards `request.signal`. Laravel's `McpRateLimit` (60/min/user) covers `/api/ai/*` and MCP, but the Next-native LLM routes (NAPI-05) and agents have nothing.
**Evidence:** absence of any limiter import/usage; `maxDuration = 180` on `field-edit` with no per-user cap at Next.
**Impact:** Cost and availability exposure; hung upstreams hold serverless invocations up to `maxDuration`.
**Expected Behavior:** Per-user/IP limits, body caps, `AbortSignal.timeout` on every upstream fetch.
**Recommended Fix:** Shared limiter (Upstash/Redis or Vercel WAF) in the common proxy helper; `AbortSignal.timeout(15_000)` default; cap `content-length`.
**Verification:** Load test returns 429 above threshold; slow upstream returns 504.

## NAPI-16
**Severity:** Medium   **Type:** Confirmed
**Category:** Backend
**Module:** JSON-file stores (agents, conversational-ai)
**Location:** `lib/agents/store.ts:445-534`; `lib/ai/conversational-admin/store.ts:300-372`
**Function/Method:** `JsonFileAgentStore.mutate`, `getAgentStore`, `JsonFileConversationalAdminStore`
**Problem:** Serialisation is an in-process promise chain only; two Node processes/lambdas doing read-modify-write lose updates (the atomic `rename` protects only the file, not the merge). Reads reload and parse the whole file per call; runs (with full tool output including live school data) grow without limit or retention; the file holds plaintext PII (`output`); the code itself says rows "survive a request but not necessarily a cold start" on serverless. `AGENTS_STORE_PATH` can point anywhere; the temp-file name is `${filePath}.${pid}.${Date.now()}.tmp` (collision possible within the same ms in one process is prevented by the queue, not across processes).
**Evidence:** `private queue: Promise<unknown>`; `listRuns` -> `applyRunFilter(... .slice(0, limit))` after loading everything.
**Impact:** Lost agents/tokens under concurrency or scaling; unbounded disk/memory; sensitive data at rest unencrypted.
**Expected Behavior:** Durable store (Laravel tables as the file header already anticipates) with retention.
**Recommended Fix:** Implement the Laravel adapter; until then run single-instance, add retention and file permissions (0600), pagination in `listRuns`.
**Verification:** Concurrent create from two processes retains both rows.

## NAPI-17
**Severity:** Low   **Type:** Improvement
**Category:** Backend
**Module:** Error and response format consistency, information disclosure
**Location:** `app/api/proxy/route.ts:58,120`; `library/books-list/route.ts:315`; `fees/reports/_lib/fees-report-proxy.ts:155-159`; `screenCandidate/route.ts:260`; `process/convert/route.ts:233`; `ai/field-edit/route.ts:289,310`; `forgot-password/route.ts:119`; all dashboard proxies (`preview`)
**Function/Method:** error branches
**Problem:** Seven different envelopes: `{message}`, `{status:'0',message}` (string), `{status:0,message}` (number), `{status:0,...}`, `{success:false,message}`, `{error}`/`{error,code,detail}`, raw text (`fees ledger`, `proxy-file`). Status codes for the same condition differ (missing session: 400 in fees dashboards, 401 in role dashboards, 400 in menus). Errors leak `err.message`, `cause`, upstream `target`, a 500-char HTML preview, provider messages (`details`), env var names (`process/convert` `detail` contains `GOOGLE_GENERATIVE_AI_API_KEY or GEMINI_API_KEY`).
**Evidence:** cited lines.
**Impact:** Client error handling must special-case per route; internal topology and configuration disclosed to unauthenticated callers.
**Expected Behavior:** One envelope and a mapper that logs details server-side and returns a correlation id.
**Recommended Fix:** Shared `jsonError`/`problem+json` helper in the consolidated proxy library.
**Verification:** Contract test across handlers.

## NAPI-18
**Severity:** Low   **Type:** Architectural
**Category:** Backend
**Module:** Duplicated proxy code
**Location:** 12 near-identical handlers (6 `dashboard/*`, 6 `*/dashboard/summary`), `fees/menu-categories`, `teach-learn/menu-categories`, `lib/laravel-category-proxy.ts`, `fees-report-proxy.ts`
**Function/Method:** `getDefaultBaseUrl`, `readHeader`, `jsonError`, `summarizeHtml` (copied 20 times)
**Problem:** Each copy has drifted: token required in role dashboards, optional in module dashboards; body tenant wins only in module dashboards; only teach-learn has a timeout; `X-Requested-With`/`Cookie` handling varies. Every fix (e.g. NAPI-01) needs 20 edits.
**Evidence:** `diff --strip-trailing-cr` between `dashboard/admin` and `dashboard/teacher-icard|fee-dues|timetable` shows only path/comments differ; `fees/dashboard/summary` differs by the body-override block.
**Impact:** Security regressions repeat across copies (NAPI-01/04/15).
**Expected Behavior:** One factory: `createLaravelProxy({path, requireToken, method})`.
**Recommended Fix:** Extract and delete copies.
**Verification:** grep shows a single `getDefaultBaseUrl`.

## NAPI-19
**Severity:** Low   **Type:** Confirmed
**Category:** Frontend
**Module:** PAL data helpers (server-side URL construction)
**Location:** `app/pal/data/pal-content-model.ts:1124-1148` (feeds `app/api/pal/content-model`); `app/pal/data/pedagogy-engine.ts:234`; `app/course-master/data/chapters.ts:944,958`
**Function/Method:** `resolveLocalApiUrl`, `fetchPedagogyEngineModule`
**Problem:** `getPalContentModel` builds a server-to-self URL from `x-forwarded-host`/`host` request headers, so a spoofed Host makes the server fetch an attacker host during SSR. The two upstream reads (`/api/pal/pedagogy-engine`, `/api/semantic-intelligence*`) call unauthenticated Laravel endpoints without any `Authorization`.
**Evidence:** `const host = headerStore.get('x-forwarded-host') ?? headerStore.get('host') ?? 'localhost:3000'; return \`${proto}://${host}${path}\``.
**Impact:** Host-header SSRF on PAL pages (platform dependent); curriculum content publicly readable (probably intentional, `NOT VERIFIED`).
**Expected Behavior:** Call the helper directly (no HTTP hop) or use a configured origin.
**Recommended Fix:** Import `buildPalContentModelPayload` in the page instead of self-fetching.
**Verification:** Request with forged `Host` does not cause outbound call to it.

## NAPI-20
**Severity:** Low   **Type:** Potential
**Category:** Backend
**Module:** SOP converter model default
**Location:** `lib/ai/local-model.ts:24`; `app/api/screenCandidate/route.ts:21-27`
**Function/Method:** `createLocalAiModel`
**Problem:** The default model id is `gemini-3.6-flash`. `screenCandidate` carries a comment, "verified live", that this exact id "does not exist" and Google answers with a misleading 503. `process/convert` therefore likely fails on its AI fallback unless `GEMINI_MODEL` overrides it, and would report it as a quota/unavailable condition. `.env.example` also describes field-edit as using this key although field-edit now proxies to Laravel.
**Evidence:** cited lines. `NOT VERIFIED` against the live provider.
**Impact:** Degraded-mode converter; misleading docs.
**Expected Behavior:** Valid default model; docs match code.
**Recommended Fix:** Set a valid default or require `GEMINI_MODEL`; update `.env.example`.
**Verification:** Convert prose input with only the key set.

## NAPI-21
**Severity:** Info   **Type:** Confirmed
**Category:** Testing
**Module:** Test coverage for the API layer
**Location:** `app/api/**` (0 tests); `lib/agents/engine.test.ts`
**Function/Method:** n/a
**Problem:** No route-handler, SSRF, proxy or tenant-scoping tests; `engine.test.ts` uses a stub authorizer so the header-trust flaw (NAPI-02/03) is untested.
**Evidence:** `git ls-files | grep -E "\.test\." | grep api/` returns nothing.
**Impact:** Security regressions undetected.
**Expected Behavior:** Contract tests per proxy: base-URL ignored, missing token -> 401, tenant not overridable.
**Recommended Fix:** Add Vitest/Jest route tests calling the exported handlers with mock `fetch`.
**Verification:** CI red on header-controlled base URL.

ISSUE COUNTS: C=3 H=6 M=7 L=4 I=1

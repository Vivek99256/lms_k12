# part09 data - API call inventory (frontend -> Next handlers / Laravel)

## 0. Method and totals

- Laravel routes registry: all 42 route files were executed against a stub router (no framework boot, no DB) following D:\next_lms_erp\app\Providers\RouteServiceProvider.php (prefix/middleware per file) plus AiServiceProvider / McpServiceProvider / PALServiceProvider loaders: **5,453 registered route records** (1,693 under /api). Prefix groups, middleware groups, resource/apiResource expansion, controller groups and chained builders (Route::middleware()->get()) were modelled; `routes/custom_module.php` adds DB-driven routes at boot (25 recorded from static code only - dynamic set NOT VERIFIED).
- Auth classification of a route (from route/group middleware only): **AUTH** = any of api.session, session, jwt, pal.auth, brain.auth, auth, McpAuth (JWT validated); **SOFT** = lms.auth / perm:* / lms.staff only (these are fail-OPEN when env LMS_API_AUTH_ENFORCE is unset/false - config/lms_content.php default false; production value NOT VERIFIED); **NONE** = only the `api`/`web` group (+ non-authenticating middleware such as staff.only, check_permissions, menu, throttle). All routes: AUTH 4594, SOFT 28, NONE 831.
- Frontend transports found: (1) same-origin `/api/proxy?path=` and `/api/proxy-file` relays (130 literal sites in 75 files); (2) direct browser->Laravel `${baseUrl|API_BASE_URL|session.baseUrl}/...` (host taken from localStorage `userData.host_name` or NEXT_PUBLIC_API_BASE_URL_*); (3) same-origin Next route handlers `/api/...`; (4) AI host (NEXT_PUBLIC_AI_BASE_URL fallback API_BASE_URL); (5) hard-coded third-party hosts (section 7).
- Call-site candidates extracted: 1532 (kinds: base+api 173, wrapper-arg 143, rel-api 100, const 24, api-noslash 203, base+legacy 143, proxy-path 66, abs-url 1, prefixed 582, xfile-prefixed 97). Status: DYNAMIC 55, MATCHED 1195, NEXT-INTERNAL 80, UNMATCHED 55, MATCHED-ALT 73, MATCHED-OVERRIDE 74. Distinct normalised Laravel paths: 1117.
- Ambiguity cap (honest): only paths passed as *string literals or same-file/exported-const templates* are verified. Paths built by concatenation/runtime keys (section 4) are NOT VERIFIED. Coverage of transports is by recognised wrapper (~35 wrapper names + per-file `${path}` prefix detection + cross-file exported wrappers); a call through an unrecognised wrapper with a non-/api literal would be missed. Method verification was done only for 155 direct fetch() calls with a literal options object; POST-with-`_method` spoofing (resource PUT/DELETE) is not detected, so 9 apparent POST->PUT mismatches (fees_circular_master, fees_late_master, h5p scenario_based/interactive_video/flashacard, lms/lmsmapping) are listed but classified "probable method spoof".

## 1. Next.js route handlers (app/api/**/route.ts) - 67 handlers, callers by literal

| # | Route | Exports | Literal call sites (n) | First sites | Notes |
|---|---|---|---|---|---|
| 1 | `/api/admissions/dashboard/summary` | POST | 1 | app/admissions/_lib/admissions-dashboard-api.ts:27 |  |
| 2 | `/api/agents/[id]` | PATCH | 2 | lib/agents/client.ts:160; lib/agents/client.ts:168 |  |
| 3 | `/api/agents/[id]/run` | POST | 1 | lib/agents/client.ts:172 |  |
| 4 | `/api/agents` | GET,POST | 2 | lib/agents/client.ts:151; lib/agents/client.ts:164 |  |
| 5 | `/api/agents/runs` | GET | 2 | lib/agents/client.ts:160; lib/agents/client.ts:168 |  |
| 6 | `/api/ai/ask/stream` | POST | 2 | app/api/ai/ask/stream/route.ts:135; app/components/ChatbotPanel.tsx:270 |  |
| 7 | `/api/ai/assistance-tickets` | POST | 1 | app/components/ChatbotPanel.tsx:539 |  |
| 8 | `/api/ai/field-edit` | POST | 1 | components/ai/AiFieldAssistant.tsx:257 |  |
| 9 | `/api/conversational-ai/projects/[id]/settings` | PUT | 1 | lib/ai/conversational-admin/client.ts:47 |  |
| 10 | `/api/conversational-ai/projects/[id]/token` | POST | 1 | lib/ai/conversational-admin/client.ts:54 |  |
| 11 | `/api/conversational-ai/projects` | GET | 1 | lib/ai/conversational-admin/client.ts:43 |  |
| 12 | `/api/dashboard/admin` | POST | 0 **(none)** |  | Handler proxies POST /api/admin-dashboard/summary but is never called: dashboard-api.ts:174 fetchAdminDashboard uses postDashboardDirect (browser -> Laravel directly) while teacher/student/fee-dues/timetable/icard use the Next proxy handlers (inconsistent transport). |
| 13 | `/api/dashboard/student` | POST | 1 | app/dashboard/_lib/dashboard-api.ts:182 |  |
| 14 | `/api/dashboard/teacher-fee-dues` | POST | 1 | app/dashboard/_lib/dashboard-api.ts:186 |  |
| 15 | `/api/dashboard/teacher-icard` | POST | 1 | app/dashboard/_lib/dashboard-api.ts:207 |  |
| 16 | `/api/dashboard/teacher-timetable` | POST | 1 | app/dashboard/_lib/dashboard-api.ts:190 |  |
| 17 | `/api/dashboard/teacher` | POST | 1 | app/dashboard/_lib/dashboard-api.ts:178 |  |
| 18 | `/api/fees/audit-logs` | GET | 1 | app/fees/_lib/fees-report-utils.ts:391 |  |
| 19 | `/api/fees/dashboard/summary` | POST | 1 | app/fees/_lib/fees-dashboard-api.ts:29 |  |
| 20 | `/api/fees/menu-categories` | GET | 2 | app/api/fees/menu-categories/route.ts:18; app/fees/_lib/fees-menu-categories-api.ts:51 |  |
| 21 | `/api/fees/online-payment/[gateway]` | POST | 1 | app/fees/online-payment/[gateway]/page.tsx:159 |  |
| 22 | `/api/fees/online-payments` | GET | 1 | app/fees/_lib/fees-report-utils.ts:375 |  |
| 23 | `/api/fees/receipt-reprint` | GET | 1 | app/fees/_lib/fees-report-utils.ts:399 |  |
| 24 | `/api/fees/reconciliation-status` | GET | 1 | app/fees/_lib/fees-report-utils.ts:383 |  |
| 25 | `/api/fees/reports/datewise-summary/fees-title` | GET | 1 | app/fees/_lib/fees-report-utils.ts:329 |  |
| 26 | `/api/fees/reports/datewise-summary` | GET | 2 | app/fees/_lib/fees-report-utils.ts:313; app/fees/_lib/fees-report-utils.ts:321 |  |
| 27 | `/api/fees/reports/fees-cancel` | GET,POST | 2 | app/fees/_lib/fees-report-utils.ts:351; app/fees/_lib/fees-report-utils.ts:360 |  |
| 28 | `/api/fees/reports/fees-collection/create` | GET | 1 | app/fees/_lib/fees-report-utils.ts:234 |  |
| 29 | `/api/fees/reports/fees-collection` | GET | 2 | app/fees/_lib/fees-report-utils.ts:225; app/fees/_lib/fees-report-utils.ts:241 |  |
| 30 | `/api/fees/reports/fees-defaulter` | POST | 1 | app/fees/_lib/fees-report-utils.ts:258 |  |
| 31 | `/api/fees/reports/fees-structure` | POST | 1 | app/fees/_lib/fees-report-utils.ts:338 |  |
| 32 | `/api/fees/reports/fees-type-wise/create` | GET | 1 | app/fees/_lib/fees-report-utils.ts:249 |  |
| 33 | `/api/fees/reports/other-fees-cancel/create` | GET | 1 | app/fees/_lib/fees-report-utils.ts:293 |  |
| 34 | `/api/fees/reports/other-fees-cancel` | GET | 1 | app/fees/_lib/fees-report-utils.ts:285 |  |
| 35 | `/api/fees/reports/other-fees/create` | GET | 1 | app/fees/_lib/fees-report-utils.ts:279 |  |
| 36 | `/api/fees/reports/other-fees/ledger` | GET | 1 | app/fees/reports/other-fees/page.tsx:150 |  |
| 37 | `/api/fees/reports/other-fees` | GET | 1 | app/fees/_lib/fees-report-utils.ts:271 |  |
| 38 | `/api/fees/reports/student-breakoff/create` | GET | 1 | app/fees/_lib/fees-report-utils.ts:307 |  |
| 39 | `/api/fees/reports/student-breakoff` | GET | 1 | app/fees/_lib/fees-report-utils.ts:299 |  |
| 40 | `/api/forgot-password` | POST | 1 | app/login/page.tsx:476 |  |
| 41 | `/api/google-auth` | POST | 2 | app/api/google-auth/route.ts:16; contexts/AuthContext.tsx:248 |  |
| 42 | `/api/hostel/dashboard/summary` | POST | 1 | app/hostel/_lib/hostel-dashboard-api.ts:18 |  |
| 43 | `/api/import/match-fields` | POST | 0 **(none)** |  | No caller: import-data/page.tsx:183 calls Laravel directly. |
| 44 | `/api/import/parse` | POST | 0 **(none)** |  | No caller: import-data/page.tsx:151 calls Laravel directly. |
| 45 | `/api/import/process` | POST | 0 **(none)** |  | No caller: import-data/page.tsx:247 calls Laravel directly. |
| 46 | `/api/import/tables` | GET | 0 **(none)** |  | No caller: app/import-data/page.tsx:99 calls `${API_BASE_URL}/api/import/tables` (Laravel) directly, bypassing this handler. |
| 47 | `/api/integration-configs/[id]` | GET,PUT,DELETE | 3 | app/task-management/_lib/integration-management-api.ts:102; app/task-management/_lib/integration-management-api.ts:108 |  |
| 48 | `/api/integration-configs` | GET,POST | 2 | app/task-management/_lib/integration-management-api.ts:85; app/task-management/_lib/integration-management-api.ts:95 |  |
| 49 | `/api/integration-configs/test` | POST | 3 | app/task-management/_lib/integration-management-api.ts:102; app/task-management/_lib/integration-management-api.ts:108 |  |
| 50 | `/api/library/books-list` | GET | 1 | app/library/book_resources/page.tsx:409 |  |
| 51 | `/api/library/dashboard/summary` | POST | 1 | app/library/_lib/library-dashboard-api.ts:18 |  |
| 52 | `/api/mcp/capabilities` | GET | 0 **(none)** |  | No caller in frontend (lib/ai/mcp-client.ts calls Laravel `${base}/api/mcp${path}` directly). |
| 53 | `/api/mcp/health` | GET | 0 **(none)** |  | No caller in frontend. |
| 54 | `/api/mcp/tools/call` | POST | 5 | app/_components/ai-stack/knowledge-base-screen.tsx:152; app/admissions/ai-stack/_screens/admissions-knowledge-base-screen.tsx:155 |  |
| 55 | `/api/modules/menu-categories/registry` | GET | 2 | app/_lib/module-categories-api.ts:112; app/api/modules/menu-categories/registry/route.ts:20 |  |
| 56 | `/api/modules/menu-categories` | GET | 3 | app/_lib/module-categories-api.ts:111; app/_lib/module-categories-api.ts:254 |  |
| 57 | `/api/pal/content-model` | GET | 1 | app/pal/data/pal-content-model.ts:1137 |  |
| 58 | `/api/pal/pedagogy-engine` | GET | 3 | app/pal/data/pedagogy-engine.ts:200; app/pal/pedagogy-engine/_components/PedagogyEngine.tsx:14 |  |
| 59 | `/api/pal/submit` | POST | 1 | app/pal/data/pal.ts:866 |  |
| 60 | `/api/process/convert` | POST | 1 | app/general/add_process/AddProcessPage.tsx:350 |  |
| 61 | `/api/proxy-file` | POST | 4 | app/admissions/admission_followUp/_lib/follow-up-agenda-api.ts:151; app/admissions/admission_followUp/_lib/follow-up-agenda-api.ts:189 | Multipart variant of the relay (POST). |
| 62 | `/api/proxy` | GET,POST,PUT,PATCH,DELETE | 127 | app/admissions/admission_followUp/_lib/follow-up-agenda-api.ts:151; app/admissions/admission_followUp/_lib/follow-up-agenda-api.ts:189 | Generic relay to Laravel (`API_BASE_URL/<path param>`), GET/POST/PUT/PATCH/DELETE; forwards client Authorization + Cookie + Referer headers; no auth of its own; path param unvalidated (only `proxy_master*` / `ajax_getproxyperiod` rewritten to school_setup/...). 130 caller literals in 84 files. |
| 63 | `/api/question-paper/asset` | GET | 4 | app/lms/exam/_question-paper-templates/pdf.tsx:69; lib/question-paper/images.test.ts:84 |  |
| 64 | `/api/screenCandidate` | POST | 1 | app/talent-management/recruitment/components/candidate-application-form.tsx:172 |  |
| 65 | `/api/students/dashboard/summary` | POST | 1 | app/students/_lib/students-dashboard-api.ts:20 |  |
| 66 | `/api/teach-learn/menu-categories` | GET | 2 | app/api/teach-learn/menu-categories/route.ts:18; app/teach-learn/_lib/teach-learn-menu-categories-api.ts:39 |  |
| 67 | `/api/transportation/dashboard/summary` | POST | 1 | app/Transportation/_lib/transportation-dashboard-api.ts:18 |  |

Handlers with zero callers: /api/dashboard/admin, /api/import/{tables,parse,process,match-fields}, /api/mcp/capabilities, /api/mcp/health = 7 of 67.

### 1b. Handler-level facts relevant to security/consistency (from reading the handler text)

- 19 handlers read the upstream base URL from the **client-supplied request header `x-laravel-base-url`** and `fetch()` it server-side with no allow-list: admissions/dashboard/summary:55, dashboard/{admin,student,teacher,teacher-fee-dues,teacher-icard,teacher-timetable}:42, fees/dashboard/summary:58, fees/menu-categories:44, fees/reports/_lib/fees-report-proxy.ts:31 (serves 17 fees report routes), forgot-password:42, google-auth:38, hostel/dashboard/summary:50, library/dashboard/summary:50, pal/submit:21, students/dashboard/summary:52, teach-learn/menu-categories:45, transportation/dashboard/summary:50, plus lib/laravel-category-proxy.ts:55 (modules/menu-categories + registry) and lib/agents/acting-user.ts (all /api/agents/*). Also trusted from headers: x-sub-institute-id, x-user-id, x-user-profile-name (lib/agents/acting-user.ts:27-34).
- Most handlers only relay: they forward the client's `x-laravel-token`/Authorization to Laravel and rely on Laravel to reject bad tokens (dashboards, fees reports via fees-report-proxy.ts, menu-categories via laravel-category-proxy.ts, proxy/proxy-file, mcp/*, library, question-paper/asset, import/*). Handlers that authenticate nothing at all and do server-side work: /api/process/convert (server-side LLM, 284 lines), /api/screenCandidate (env DeepSeek/OpenRouter/Gemini keys), /api/pal/content-model and /api/pal/pedagogy-engine (public Laravel upstream), and, by nature, /api/forgot-password and /api/google-auth. Only /api/dashboard/*, /api/ai/assistance-tickets, /api/ai/field-edit and /api/integration-configs* answer 401 themselves when the token is missing.

## 2. Laravel endpoints called by the frontend - every distinct path (1117)

Columns: status (MATCHED = a Laravel route with the same path shape exists; ALT = matched after inferring a leading /api; OVERRIDE = matched after modelling a wrapper (brain tenantPath, module prefixes); DYNAMIC and UNMATCHED are listed in sections 4-5), route auth class of the matched route(s) (A=AUTH S=SOFT N=NONE), Laravel route(s), first call sites.

| # | Frontend path | Status | Auth | Laravel route(s) matched | Sites (n) |
|---|---|---|---|---|---|
| 1 | `/admission/admission_enquiry` | MATCHED | A | GET /admission/admission_enquiry ; POST /admission/admission_enquiry | app/admissions/admission_followUp/_lib/follow-up-agenda-api.ts:145 (1) |
| 2 | `/admission/admission_follow_up` | MATCHED | A | GET /admission/admission_follow_up ; POST /admission/admission_follow_up | app/admissions/admission_enquiry/followUpApi.ts:76; app/admissions/admission_enquiry/followUpApi.ts:124 (3) |
| 3 | `/admission/admission_master` | MATCHED | A | GET /admission/admission_master ; POST /admission/admission_master | app/admissions/admission_form/_lib/admission-form-api.ts:122; app/admissions/admission_form/_lib/admission-form-api.ts:148 (2) |
| 4 | `/admission/admission_registration_report_v2` | MATCHED | A | GET /admission/admission_registration_report_v2 | app/admissions/admission_reports/api.ts:443; app/admissions/admission_reports/api.ts:463 (2) |
| 5 | `/admission/admission_registration_report_v2/${encodeURIComponent(id)}/edit` | MATCHED | A | GET /admission/admission_registration_report_v2/{id}/edit | app/admissions/admission_reports/api.ts:415 (1) |
| 6 | `/ajax_checkFeesBreakoff` | MATCHED | A | GET /ajax_checkFeesBreakoff | app/fees/online_fees_collect/page.tsx:144 (1) |
| 7 | `/api` | MATCHED | A | POST /api | app/task-management/_lib/task-session.ts:103 (1) |
| 8 | `/api/academic-terms` | MATCHED | N | GET /api/academic-terms | contexts/AuthContext.tsx:353 (1) |
| 9 | `/api/admin-dashboard/summary` | MATCHED | A | POST /api/admin-dashboard/summary | app/api/dashboard/admin/route.ts:16; app/api/dashboard/admin/route.ts:75 (3) |
| 10 | `/api/admission_enquiry` | MATCHED | N | GET /api/admission_enquiry ; POST /api/admission_enquiry | app/admission-Enquiry/page.tsx:157; app/admissions/admission_enquiry/page.tsx:568 (5) |
| 11 | `/api/admission_enquiry/${editingEnquiry.apiId}` | MATCHED | N | PUT,PATCH /api/admission_enquiry/{id} ; DELETE /api/admission_enquiry/{id} | app/admissions/admission_enquiry/page.tsx:1039 (1) |
| 12 | `/api/admission_registration/${encodeURIComponent(id)}` | MATCHED | N | PUT,PATCH /api/admission_registration/{id} ; DELETE /api/admission_registration/{id} | app/admissions/admission_registration/workflow.ts:211; app/admissions/registration/[id]/edit/page.tsx:226 (2) |
| 13 | `/api/admission_registration/${encodeURIComponent(id)}/edit` | MATCHED | N | GET /api/admission_registration/{id}/edit | app/admissions/admission_registration/workflow.ts:146; app/admissions/registration/[id]/edit/page.tsx:165 (2) |
| 14 | `/api/admission_student` | MATCHED | N | POST /api/admission_student | app/admissions/admission_registration/workflow.ts:268 (1) |
| 15 | `/api/admission_without_confirmation_report_v2` | MATCHED | N | GET /api/admission_without_confirmation_report_v2 | app/admissions/admission_reports/api.ts:250; app/admissions/admission_reports/api.ts:333 (2) |
| 16 | `/api/admission_without_confirmation_report_v2/${encodeURIComponent(id)}/edit` | MATCHED | N | GET /api/admission_without_confirmation_report_v2/{id}/edit | app/admissions/admission_reports/api.ts:261; app/admissions/admission_reports/api.ts:347 (2) |
| 17 | `/api/admissions-dashboard/summary` | MATCHED | N | POST /api/admissions-dashboard/summary | app/api/admissions/dashboard/summary/route.ts:16; app/api/admissions/dashboard/summary/route.ts:93 (2) |
| 18 | `/api/ai-sop` | MATCHED | N | GET /api/ai-sop | app/general/add_process/api.ts:15; app/organization_managment/Department/Component/sops.tsx:744 (2) |
| 19 | `/api/ai-sop/department-job-roles` | MATCHED | N | GET /api/ai-sop/department-job-roles | app/organization_managment/Department/Component/ai-generation-drawer.tsx:413 (1) |
| 20 | `/api/ai-sop/generate` | MATCHED | N | POST /api/ai-sop/generate | app/organization_managment/Department/Component/ai-generation-drawer.tsx:547 (1) |
| 21 | `/api/ai-sop/store` | MATCHED | N | POST /api/ai-sop/store | app/organization_managment/Department/Component/sops.tsx:840 (1) |
| 22 | `/api/ai/agents/${agentKey}/run` | MATCHED | A | POST /api/ai/agents/{agent}/run | lib/intelligence/client.ts:400 (1) |
| 23 | `/api/ai/approvals/${approvalId}/resolve` | MATCHED | A | POST /api/ai/approvals/{approval}/resolve | lib/intelligence/client.ts:441 (1) |
| 24 | `/api/ai/ask` | MATCHED | A | POST /api/ai/ask | app/api/ai/ask/stream/route.ts:146; lib/intelligence/client.ts:183 (2) |
| 25 | `/api/ai/ask/interpret` | MATCHED | A | POST /api/ai/ask/interpret | lib/intelligence/client.ts:228 (1) |
| 26 | `/api/ai/ask/stream` | MATCHED | A | POST /api/ai/ask/stream | app/api/ai/ask/stream/route.ts:151; app/api/ai/ask/stream/route.ts:205 (2) |
| 27 | `/api/ai/assistance/tickets` | MATCHED | A | POST /api/ai/assistance/tickets ; GET /api/ai/assistance/tickets | app/api/ai/assistance-tickets/route.ts:62 (1) |
| 28 | `/api/ai/cases/${caseId}/status` | MATCHED | A | POST /api/ai/cases/{case}/status | lib/intelligence/client.ts:292 (1) |
| 29 | `/api/ai/configuration` | MATCHED | A | GET /api/ai/configuration ; POST /api/ai/configuration | lib/intelligence/ai-configuration.ts:215; lib/intelligence/ai-configuration.ts:221 (2) |
| 30 | `/api/ai/configuration-models` | MATCHED | A | GET /api/ai/configuration-models ; POST /api/ai/configuration-models | lib/intelligence/ai-configuration.ts:236; lib/intelligence/ai-configuration.ts:240 (2) |
| 31 | `/api/ai/configuration-models/${id}` | MATCHED | A | PUT /api/ai/configuration-models/{id} | lib/intelligence/ai-configuration.ts:244 (1) |
| 32 | `/api/ai/configuration/${id}` | MATCHED | A | PUT /api/ai/configuration/{id} ; DELETE /api/ai/configuration/{id} | lib/intelligence/ai-configuration.ts:228; lib/intelligence/ai-configuration.ts:232 (2) |
| 33 | `/api/ai/configuration/options` | MATCHED | A | GET /api/ai/configuration/options ; PUT /api/ai/configuration/{id} ; DELETE /api/ai/configuration/{id} | lib/intelligence/ai-configuration.ts:211 (1) |
| 34 | `/api/ai/generate` | MATCHED | A | POST /api/ai/generate | app/api/ai/field-edit/route.ts:134; lib/intelligence/ai-generate.ts:112 (3) |
| 35 | `/api/ai/generated-outputs/${outputId}/review` | MATCHED | A | POST /api/ai/generated-outputs/{output}/review | lib/intelligence/client.ts:530 (1) |
| 36 | `/api/ai/knowledge-graph/query` | MATCHED | A | POST /api/ai/knowledge-graph/query | lib/intelligence/client.ts:493 (1) |
| 37 | `/api/ai/modules/${encodeURIComponent(moduleKey)}/activity` | MATCHED | A | GET /api/ai/modules/{module}/activity ; POST /api/ai/modules/{module}/activity | lib/intelligence/ai-module.ts:356 (1) |
| 38 | `/api/ai/modules/${encodeURIComponent(moduleKey)}/guardrails` | MATCHED | A | GET /api/ai/modules/{module}/guardrails | lib/intelligence/ai-module.ts:234 (1) |
| 39 | `/api/ai/modules/${encodeURIComponent(moduleKey)}/models` | MATCHED | A | GET /api/ai/modules/{module}/models ; PUT /api/ai/modules/{module}/models ; DELETE /api/ai/modules/{module}/models | lib/intelligence/ai-module.ts:500; lib/intelligence/ai-module.ts:508 (3) |
| 40 | `/api/ai/modules/${encodeURIComponent(moduleKey)}/models/credentials` | MATCHED | A | POST /api/ai/modules/{module}/models/credentials | lib/intelligence/ai-module.ts:587 (1) |
| 41 | `/api/ai/modules/${encodeURIComponent(moduleKey)}/models/credentials/${credentialId}` | MATCHED | A | PUT /api/ai/modules/{module}/models/credentials/{credential} | lib/intelligence/ai-module.ts:603 (1) |
| 42 | `/api/ai/modules/${encodeURIComponent(moduleKey)}/usage` | MATCHED | A | GET /api/ai/modules/{module}/usage | lib/intelligence/ai-module.ts:230 (1) |
| 43 | `/api/ai/ontology/candidates` | MATCHED | A | POST /api/ai/ontology/candidates | lib/intelligence/client.ts:475 (1) |
| 44 | `/api/ai/ontology/resolve` | MATCHED | A | POST /api/ai/ontology/resolve | lib/intelligence/client.ts:467 (1) |
| 45 | `/api/ai/outcomes/measure-due` | MATCHED | A | POST /api/ai/outcomes/measure-due | lib/intelligence/client.ts:619 (1) |
| 46 | `/api/ai/policies` | MATCHED | A | GET /api/ai/policies ; POST /api/ai/policies | lib/intelligence/ai-policies.ts:164; lib/intelligence/ai-policies.ts:169 (2) |
| 47 | `/api/ai/policies/${id}` | MATCHED | A | PUT /api/ai/policies/{id} ; DELETE /api/ai/policies/{id} | lib/intelligence/ai-policies.ts:184; lib/intelligence/ai-policies.ts:188 (2) |
| 48 | `/api/ai/policies/options` | MATCHED | A | GET /api/ai/policies/options ; PUT /api/ai/policies/{id} ; DELETE /api/ai/policies/{id} | lib/intelligence/ai-policies.ts:154 (1) |
| 49 | `/api/ai/recommendations/${id}/approve` | MATCHED | A | POST /api/ai/recommendations/{recommendation}/approve | lib/intelligence/client.ts:338 (1) |
| 50 | `/api/ai/recommendations/${id}/defer` | MATCHED | A | POST /api/ai/recommendations/{recommendation}/defer | lib/intelligence/client.ts:360 (1) |
| 51 | `/api/ai/recommendations/${id}/reject` | MATCHED | A | POST /api/ai/recommendations/{recommendation}/reject | lib/intelligence/client.ts:354 (1) |
| 52 | `/api/ai/reports/${reportId}` | MATCHED | A | GET /api/ai/reports/{report} ; POST /api/ai/reports/{report} | lib/intelligence/client.ts:548 (1) |
| 53 | `/api/ai/reports/${reportId}/regenerate` | MATCHED | A | POST /api/ai/reports/{report}/regenerate | lib/intelligence/client.ts:569 (1) |
| 54 | `/api/ai/reports/${reportId}/send` | MATCHED | A | POST /api/ai/reports/{report}/send | lib/intelligence/client.ts:600 (1) |
| 55 | `/api/ai/templates` | MATCHED | A | POST /api/ai/templates ; GET /api/ai/templates | lib/intelligence/ai-templates.ts:275 (1) |
| 56 | `/api/ai/templates/${id}` | MATCHED | A | GET /api/ai/templates/{id} ; PUT /api/ai/templates/{id} ; DELETE /api/ai/templates/{id} | lib/intelligence/ai-templates.ts:271; lib/intelligence/ai-templates.ts:282 (3) |
| 57 | `/api/ai/templates/catalog` | MATCHED | A | GET /api/ai/templates/catalog ; GET /api/ai/templates/{id} ; PUT /api/ai/templates/{id} ...(+1) | lib/intelligence/ai-templates.ts:267 (1) |
| 58 | `/api/ai/templates/options` | MATCHED | A | GET /api/ai/templates/options ; GET /api/ai/templates/{id} ; PUT /api/ai/templates/{id} ...(+1) | lib/intelligence/ai-templates.ts:260 (1) |
| 59 | `/api/ai/templates/preview` | MATCHED | A | POST /api/ai/templates/preview ; GET /api/ai/templates/{id} ; PUT /api/ai/templates/{id} ...(+1) | lib/intelligence/ai-templates.ts:307 (1) |
| 60 | `/api/ai/workspace/agents/${agentKey}/run` | MATCHED | A | POST /api/ai/workspace/agents/{agent}/run | lib/intelligence/workspace.ts:332 (1) |
| 61 | `/api/ai/workspace/context` | MATCHED | A | GET,POST /api/ai/workspace/context | lib/intelligence/workspace.ts:316 (1) |
| 62 | `/api/ai/workspace/flow` | MATCHED | A | GET,POST /api/ai/workspace/flow | lib/intelligence/workspace.ts:441 (1) |
| 63 | `/api/ai/workspace/generate` | MATCHED | A | GET,POST /api/ai/workspace/generate | lib/intelligence/workspace.ts:345 (1) |
| 64 | `/api/ai/workspace/ontology-views/${viewKey}` | MATCHED | A | POST /api/ai/workspace/ontology-views/{view} | lib/intelligence/workspace.ts:369 (1) |
| 65 | `/api/ai/workspace/report` | MATCHED | A | POST /api/ai/workspace/report | lib/intelligence/workspace.ts:361 (1) |
| 66 | `/api/ai/workspace/workflow-status` | MATCHED | A | POST /api/ai/workspace/workflow-status | lib/intelligence/workspace.ts:324 (1) |
| 67 | `/api/ai/workspace/workflows/${workflowKey}/start` | MATCHED | A | POST /api/ai/workspace/workflows/{workflow}/start | lib/intelligence/workspace.ts:384 (1) |
| 68 | `/api/api-login` | MATCHED | N | POST /api/api-login | contexts/AuthContext.tsx:223 (1) |
| 69 | `/api/assessment-blueprints/chapters` | MATCHED | N | GET /api/assessment-blueprints/chapters ; GET /api/assessment-blueprints/{id} ; PUT,PATCH,POST /api/assessment-blueprints/{id} ...(+1) | app/lms/exam/_assessment-blueprint/api.ts:102 (1) |
| 70 | `/api/assessment-blueprints/clone` | MATCHED | N | POST /api/assessment-blueprints/clone ; GET /api/assessment-blueprints/{id} ; PUT,PATCH,POST /api/assessment-blueprints/{id} ...(+1) | app/lms/exam/_assessment-blueprint/api.ts:172 (1) |
| 71 | `/api/assessment-blueprints/hpc-options` | MATCHED | N | GET /api/assessment-blueprints/hpc-options ; POST /api/assessment-blueprints/hpc-options ; GET /api/assessment-blueprints/{id} ...(+2) | app/lms/exam/_assessment-blueprint/api.ts:219; app/lms/exam/_assessment-blueprint/api.ts:237 (2) |
| 72 | `/api/assessment-blueprints/hpc-options/reset` | MATCHED | N | POST /api/assessment-blueprints/hpc-options/reset | app/lms/exam/_assessment-blueprint/api.ts:255 (1) |
| 73 | `/api/brain/academic/intelligence` | OVERRIDE | A | GET /api/brain/{tenantId}/academic/intelligence | components/intelligence/module/contracts/academic.ts:37 (1) |
| 74 | `/api/brain/access` | MATCHED | A | GET /api/brain/access | app/components/DashboardShell.tsx:304 (1) |
| 75 | `/api/brain/admissions/intelligence` | OVERRIDE | A | GET /api/brain/{tenantId}/admissions/intelligence | components/intelligence/module/contracts/admissions.ts:37 (1) |
| 76 | `/api/brain/ai-assistant` | OVERRIDE | A | GET /api/brain/{tenantId}/ai-assistant | app/enterprise-brain/knowledge/ai-assistant/page.tsx:26 (1) |
| 77 | `/api/brain/analytics` | OVERRIDE | A | GET /api/brain/{tenantId}/analytics | lib/brain/api.ts:418 (1) |
| 78 | `/api/brain/attendance/intelligence` | OVERRIDE | A | GET /api/brain/{tenantId}/attendance/intelligence | components/intelligence/module/contracts/attendance.ts:31 (1) |
| 79 | `/api/brain/automation` | OVERRIDE | A | GET /api/brain/{tenantId}/automation | lib/brain/api.ts:421 (1) |
| 80 | `/api/brain/capabilities` | OVERRIDE | A | GET /api/brain/{tenantId}/capabilities ; POST /api/brain/{tenantId}/capabilities | app/enterprise-brain/capabilities/page.tsx:42; app/enterprise-brain/capabilities/page.tsx:54 (2) |
| 81 | `/api/brain/capabilities/${id}` | OVERRIDE | A | GET /api/brain/{tenantId}/capabilities/{id} ; PATCH /api/brain/{tenantId}/capabilities/{id} ; GET /api/brain/{tenantId}/{module}/integration ...(+1) | app/enterprise-brain/capabilities/[id]/page.tsx:40; app/enterprise-brain/capabilities/[id]/page.tsx:79 (2) |
| 82 | `/api/brain/capabilities/${id}/assign` | OVERRIDE | A | POST /api/brain/{tenantId}/capabilities/{id}/assign | app/enterprise-brain/capabilities/[id]/page.tsx:50 (1) |
| 83 | `/api/brain/capabilities/${id}/assign/${assignmentId}` | OVERRIDE | A | DELETE /api/brain/{tenantId}/capabilities/{id}/assign/{assignmentId} ; POST /api/brain/{tenantId}/{module}/workflows/{flowKey}/trigger | app/enterprise-brain/capabilities/[id]/page.tsx:67 (1) |
| 84 | `/api/brain/capability/intelligence` | OVERRIDE | A | GET /api/brain/{tenantId}/capability/intelligence | components/intelligence/module/contracts/capability.ts:26 (1) |
| 85 | `/api/brain/communication/intelligence` | OVERRIDE | A | GET /api/brain/{tenantId}/communication/intelligence | components/intelligence/module/contracts/communication.ts:32 (1) |
| 86 | `/api/brain/consent/intelligence` | OVERRIDE | A | GET /api/brain/{tenantId}/consent/intelligence | components/intelligence/module/contracts/consent.ts:32 (1) |
| 87 | `/api/brain/correspondence/intelligence` | OVERRIDE | A | GET /api/brain/{tenantId}/correspondence/intelligence | components/intelligence/module/contracts/correspondence.ts:35 (1) |
| 88 | `/api/brain/departments` | OVERRIDE | A | GET /api/brain/{tenantId}/departments | app/enterprise-brain/foundation/departments/page.tsx:22 (1) |
| 89 | `/api/brain/document-templates/intelligence` | OVERRIDE | A | GET /api/brain/{tenantId}/document-templates/intelligence | components/intelligence/module/contracts/document-templates.ts:32 (1) |
| 90 | `/api/brain/executions/${executionId}/complete` | OVERRIDE | A | POST /api/brain/{tenantId}/executions/{id}/complete | app/fees/intelligence/_lib/fees-intelligence-api.ts:374 (1) |
| 91 | `/api/brain/executions/${id}/complete` | OVERRIDE | A | POST /api/brain/{tenantId}/executions/{id}/complete | lib/brain/api.ts:442; lib/brain/api.ts:459 (2) |
| 92 | `/api/brain/executive` | OVERRIDE | A | GET /api/brain/{tenantId}/executive | lib/brain/api.ts:713 (1) |
| 93 | `/api/brain/fees/accounts` | OVERRIDE | A | GET /api/brain/{tenantId}/fees/accounts | app/fees/intelligence/_lib/fees-intelligence-api.ts:355 (1) |
| 94 | `/api/brain/fees/intelligence` | OVERRIDE | A | GET /api/brain/{tenantId}/fees/intelligence | app/fees/intelligence/_lib/fees-intelligence-api.ts:348 (1) |
| 95 | `/api/brain/fees/intelligence/run` | OVERRIDE | A | POST /api/brain/{tenantId}/fees/intelligence/run | app/fees/intelligence/_lib/fees-intelligence-api.ts:351 (1) |
| 96 | `/api/brain/graph` | OVERRIDE | A | GET /api/brain/{tenantId}/graph | lib/brain/api.ts:722 (1) |
| 97 | `/api/brain/homework/intelligence` | OVERRIDE | A | GET /api/brain/{tenantId}/homework/intelligence | components/intelligence/module/contracts/homework.ts:37 (1) |
| 98 | `/api/brain/hostel/intelligence` | OVERRIDE | A | GET /api/brain/{tenantId}/hostel/intelligence | components/intelligence/module/contracts/hostel.ts:33 (1) |
| 99 | `/api/brain/hr/intelligence` | OVERRIDE | A | GET /api/brain/{tenantId}/hr/intelligence | components/intelligence/module/contracts/hr.ts:33 (1) |
| 100 | `/api/brain/ingestion` | OVERRIDE | A | GET /api/brain/{tenantId}/ingestion | app/enterprise-brain/ingestion/page.tsx:63 (1) |
| 101 | `/api/brain/ingestion/run` | OVERRIDE | A | POST /api/brain/{tenantId}/ingestion/run | app/enterprise-brain/ingestion/page.tsx:77 (1) |
| 102 | `/api/brain/intelligence` | OVERRIDE | A | GET /api/brain/{tenantId}/intelligence | lib/brain/api.ts:374 (1) |
| 103 | `/api/brain/intelligence/classes` | OVERRIDE | A | GET /api/brain/{tenantId}/intelligence/classes | lib/brain/api.ts:716 (1) |
| 104 | `/api/brain/intelligence/departments` | OVERRIDE | A | GET /api/brain/{tenantId}/intelligence/departments | lib/brain/api.ts:718 (1) |
| 105 | `/api/brain/intelligence/run` | OVERRIDE | A | POST /api/brain/{tenantId}/intelligence/run | lib/brain/api.ts:416 (1) |
| 106 | `/api/brain/intelligence/students/${id}` | OVERRIDE | A | GET /api/brain/{tenantId}/intelligence/students/{id} | lib/brain/api.ts:715 (1) |
| 107 | `/api/brain/intelligence/teachers` | OVERRIDE | A | GET /api/brain/{tenantId}/intelligence/teachers | lib/brain/api.ts:719 (1) |
| 108 | `/api/brain/inventory/intelligence` | OVERRIDE | A | GET /api/brain/{tenantId}/inventory/intelligence | components/intelligence/module/contracts/inventory.ts:36 (1) |
| 109 | `/api/brain/kasba` | OVERRIDE | A | GET /api/brain/{tenantId}/kasba | app/enterprise-brain/knowledge/kasba/page.tsx:30 (1) |
| 110 | `/api/brain/knowledge` | OVERRIDE | A | GET /api/brain/{tenantId}/knowledge | lib/brain/api.ts:420 (1) |
| 111 | `/api/brain/library/intelligence` | OVERRIDE | A | GET /api/brain/{tenantId}/library/intelligence | components/intelligence/module/contracts/library.ts:35 (1) |
| 112 | `/api/brain/lms-activity/intelligence` | OVERRIDE | A | GET /api/brain/{tenantId}/lms-activity/intelligence | components/intelligence/module/contracts/lms-activity.ts:56 (1) |
| 113 | `/api/brain/modules/${encodeURIComponent(moduleKey)}/intelligence` | MATCHED |  |  | lib/brain/api.ts:413 (1) |
| 114 | `/api/brain/organization/intelligence` | OVERRIDE | A | GET /api/brain/{tenantId}/organization/intelligence | components/intelligence/module/contracts/organization.ts:27 (1) |
| 115 | `/api/brain/people` | OVERRIDE | A | GET /api/brain/{tenantId}/people | app/enterprise-brain/foundation/people/page.tsx:31 (1) |
| 116 | `/api/brain/petty-cash/intelligence` | OVERRIDE | A | GET /api/brain/{tenantId}/petty-cash/intelligence | components/intelligence/module/contracts/petty-cash.ts:30 (1) |
| 117 | `/api/brain/ptm/intelligence` | OVERRIDE | A | GET /api/brain/{tenantId}/ptm/intelligence | components/intelligence/module/contracts/ptm.ts:32 (1) |
| 118 | `/api/brain/recommendations` | OVERRIDE | A | GET /api/brain/{tenantId}/recommendations | lib/brain/api.ts:432 (1) |
| 119 | `/api/brain/recommendations/${id}/decide` | OVERRIDE | A | POST /api/brain/{tenantId}/recommendations/{id}/decide | lib/brain/api.ts:436 (1) |
| 120 | `/api/brain/result/intelligence` | OVERRIDE | A | GET /api/brain/{tenantId}/result/intelligence | components/intelligence/module/contracts/result.ts:31 (1) |
| 121 | `/api/brain/screens/${screen}` | OVERRIDE | A | GET /api/brain/{tenantId}/{module}/integration ; GET /api/brain/{tenantId}/{module}/workflows ; GET /api/brain/{tenantId}/screens/{screen} | lib/brain/api.ts:233 (1) |
| 122 | `/api/brain/search` | OVERRIDE | A | GET /api/brain/{tenantId}/search | app/enterprise-brain/knowledge/ai-assistant/page.tsx:41 (1) |
| 123 | `/api/brain/sections/${section}` | OVERRIDE | A | GET /api/brain/{tenantId}/{module}/integration ; GET /api/brain/{tenantId}/{module}/workflows ; GET /api/brain/{tenantId}/sections/{section} | lib/brain/api.ts:237 (1) |
| 124 | `/api/brain/settings` | OVERRIDE | A | GET /api/brain/{tenantId}/settings ; PUT /api/brain/{tenantId}/settings | app/enterprise-brain/settings/page.tsx:21; app/enterprise-brain/settings/page.tsx:35 (2) |
| 125 | `/api/brain/signals/${id}` | OVERRIDE | A | GET /api/brain/{tenantId}/signals/{id} ; GET /api/brain/{tenantId}/{module}/integration ; GET /api/brain/{tenantId}/{module}/workflows | lib/brain/api.ts:417 (1) |
| 126 | `/api/brain/staff-attendance/intelligence` | OVERRIDE | A | GET /api/brain/{tenantId}/staff-attendance/intelligence | components/intelligence/module/contracts/staff-attendance.ts:36 (1) |
| 127 | `/api/brain/student/intelligence` | OVERRIDE | A | GET /api/brain/{tenantId}/student/intelligence | components/intelligence/module/contracts/student.ts:34 (1) |
| 128 | `/api/brain/students` | OVERRIDE | A | GET /api/brain/{tenantId}/students | lib/brain/api.ts:423 (1) |
| 129 | `/api/brain/talent/intelligence` | OVERRIDE | A | GET /api/brain/{tenantId}/talent/intelligence | components/intelligence/module/contracts/talent.ts:29 (1) |
| 130 | `/api/brain/task-management/intelligence` | OVERRIDE | A | GET /api/brain/{tenantId}/task-management/intelligence | components/intelligence/module/contracts/task-management.ts:28 (1) |
| 131 | `/api/brain/teach-learn/intelligence` | OVERRIDE | A | GET /api/brain/{tenantId}/teach-learn/intelligence | components/intelligence/module/contracts/teach-learn.ts:47 (1) |
| 132 | `/api/brain/transport/intelligence` | OVERRIDE | A | GET /api/brain/{tenantId}/transport/intelligence | components/intelligence/module/contracts/transport.ts:30 (1) |
| 133 | `/api/brain/visitor/intelligence` | OVERRIDE | A | GET /api/brain/{tenantId}/visitor/intelligence | components/intelligence/module/contracts/visitor.ts:36 (1) |
| 134 | `/api/bulk-task/import` | MATCHED | A | POST /api/bulk-task/import | app/task-management/_lib/my-tasks-api.ts:305 (1) |
| 135 | `/api/candidate` | MATCHED | A | GET /api/candidate | app/talent-management/_lib/recruitment-api.ts:228 (1) |
| 136 | `/api/class-teachers` | MATCHED | N | GET /api/class-teachers ; POST /api/class-teachers | app/classteacher/api.ts:129; app/classteacher/api.ts:166 (3) |
| 137 | `/api/class-teachers/${id}` | MATCHED | N | PUT /api/class-teachers/{class_teacher} ; DELETE /api/class-teachers/{class_teacher} | app/classteacher/api.ts:183; app/classteacher/api.ts:198 (2) |
| 138 | `/api/competency-library/competency` | MATCHED | A | POST /api/competency-library/competency | app/capability-intelligence/_lib/competency-extras-api.ts:377; app/capability-intelligence/_lib/competency-library-api.ts:379 (2) |
| 139 | `/api/competency-library/competency-export` | MATCHED | A | GET /api/competency-library/competency-export | app/capability-intelligence/_lib/competency-library-api.ts:400 (1) |
| 140 | `/api/competency-library/competency-import` | MATCHED | A | POST /api/competency-library/competency-import | app/capability-intelligence/_lib/competency-library-api.ts:406 (1) |
| 141 | `/api/competency-library/competency-list` | MATCHED | A | GET /api/competency-library/competency-list | app/capability-intelligence/_lib/competency-extras-api.ts:372; app/capability-intelligence/_lib/competency-library-api.ts:367 (2) |
| 142 | `/api/competency-library/competency/${id}` | MATCHED | A | GET /api/competency-library/competency/{id} ; PUT /api/competency-library/competency/{id} ; DELETE /api/competency-library/competency/{id} | app/capability-intelligence/_lib/competency-library-api.ts:374; app/capability-intelligence/_lib/competency-library-api.ts:385 (3) |
| 143 | `/api/competency-library/competency/${id}/archive` | MATCHED | A | PUT /api/competency-library/competency/{id}/archive | app/capability-intelligence/_lib/competency-library-api.ts:423 (1) |
| 144 | `/api/competency-library/competency/${id}/clone` | MATCHED | A | POST /api/competency-library/competency/{id}/clone | app/capability-intelligence/_lib/competency-library-api.ts:413 (1) |
| 145 | `/api/competency-library/competency/${id}/detail` | MATCHED | A | GET /api/competency-library/competency/{id}/detail | app/capability-intelligence/_lib/competency-library-api.ts:394 (1) |
| 146 | `/api/competency/approvals` | MATCHED | A | GET /api/competency/approvals ; POST /api/competency/approvals | app/capability-intelligence/_lib/competency-extras-api.ts:459 (1) |
| 147 | `/api/competency/approvals/for/${subjectType}/${subjectId}` | MATCHED | A | GET /api/competency/approvals/for/{type}/{id} | app/capability-intelligence/_lib/competency-extras-api.ts:468 (1) |
| 148 | `/api/competency/career-paths` | MATCHED | A | GET /api/competency/career-paths ; POST /api/competency/career-paths | app/talent-management/_lib/development-career-api.ts:605; app/talent-management/_lib/development-career-api.ts:617 (2) |
| 149 | `/api/competency/career-paths/${id}` | MATCHED | A | GET /api/competency/career-paths/{id} ; PUT /api/competency/career-paths/{id} ; DELETE /api/competency/career-paths/{id} | app/talent-management/_lib/development-career-api.ts:612; app/talent-management/_lib/development-career-api.ts:623 (3) |
| 150 | `/api/competency/career-paths/explorer` | MATCHED | A | GET /api/competency/career-paths/explorer ; GET /api/competency/career-paths/{id} ; PUT /api/competency/career-paths/{id} ...(+1) | app/talent-management/_lib/development-career-api.ts:638 (1) |
| 151 | `/api/competency/career-paths/role-options` | MATCHED | A | GET /api/competency/career-paths/role-options ; GET /api/competency/career-paths/{id} ; PUT /api/competency/career-paths/{id} ...(+1) | app/talent-management/_lib/certifications-api.ts:588; app/talent-management/_lib/development-career-api.ts:645 (2) |
| 152 | `/api/competency/certification-requirements/${id}` | MATCHED | A | PUT /api/competency/certification-requirements/{id} ; DELETE /api/competency/certification-requirements/{id} | app/talent-management/_lib/certifications-api.ts:546; app/talent-management/_lib/certifications-api.ts:552 (2) |
| 153 | `/api/competency/certification-requirements/department-options` | MATCHED | A | GET /api/competency/certification-requirements/department-options ; PUT /api/competency/certification-requirements/{id} ; DELETE /api/competency/certification-requirements/{id} | app/talent-management/_lib/certifications-api.ts:574 (1) |
| 154 | `/api/competency/certifications` | MATCHED | A | GET /api/competency/certifications ; POST /api/competency/certifications | app/talent-management/_lib/employee-profiles-api.ts:360 (1) |
| 155 | `/api/competency/certifications/${id}` | MATCHED | A | GET /api/competency/certifications/{id} ; PUT /api/competency/certifications/{id} ; DELETE /api/competency/certifications/{id} | app/talent-management/_lib/certifications-api.ts:444; app/talent-management/_lib/certifications-api.ts:453 (3) |
| 156 | `/api/competency/certifications/${id}/compliance` | MATCHED | A | GET /api/competency/certifications/{id}/compliance | app/talent-management/_lib/certifications-api.ts:481 (1) |
| 157 | `/api/competency/certifications/${id}/documents` | MATCHED | A | GET /api/competency/certifications/{id}/documents ; POST /api/competency/certifications/{id}/documents | app/talent-management/_lib/certifications-api.ts:494 (1) |
| 158 | `/api/competency/certifications/${id}/documents/${documentId}` | MATCHED | A | DELETE /api/competency/certifications/{id}/documents/{documentId} | app/talent-management/_lib/certifications-api.ts:521 (1) |
| 159 | `/api/competency/certifications/${id}/history` | MATCHED | A | GET /api/competency/certifications/{id}/history | app/talent-management/_lib/certifications-api.ts:491 (1) |
| 160 | `/api/competency/certifications/${id}/notes` | MATCHED | A | POST /api/competency/certifications/{id}/notes | app/talent-management/_lib/certifications-api.ts:475 (1) |
| 161 | `/api/competency/certifications/${id}/requirements` | MATCHED | A | GET /api/competency/certifications/{id}/requirements | app/talent-management/_lib/certifications-api.ts:486 (1) |
| 162 | `/api/competency/certifications/bulk` | MATCHED | A | POST /api/competency/certifications/bulk ; GET /api/competency/certifications/{id} ; PUT /api/competency/certifications/{id} ...(+1) | app/talent-management/_lib/certifications-api.ts:467 (1) |
| 163 | `/api/competency/certifications/export` | MATCHED | A | GET /api/competency/certifications/export ; GET /api/competency/certifications/{id} ; PUT /api/competency/certifications/{id} ...(+1) | app/talent-management/_lib/certifications-api.ts:433 (1) |
| 164 | `/api/competency/certifications/filters` | MATCHED | A | GET /api/competency/certifications/filters ; GET /api/competency/certifications/{id} ; PUT /api/competency/certifications/{id} ...(+1) | app/talent-management/_lib/certifications-api.ts:441 (1) |
| 165 | `/api/competency/certifications/metrics` | MATCHED | A | GET /api/competency/certifications/metrics ; GET /api/competency/certifications/{id} ; PUT /api/competency/certifications/{id} ...(+1) | app/talent-management/_lib/certifications-api.ts:438 (1) |
| 166 | `/api/competency/command-center` | MATCHED | A | GET /api/competency/command-center | app/capability-intelligence/_lib/command-center-api.ts:259 (1) |
| 167 | `/api/competency/command-center/filters` | MATCHED | A | GET /api/competency/command-center/filters | app/capability-intelligence/_lib/command-center-api.ts:266; app/talent-management/_lib/development-career-api.ts:716 (2) |
| 168 | `/api/competency/definitions` | MATCHED | A | GET /api/competency/definitions ; POST /api/competency/definitions | app/capability-intelligence/_lib/competency-extras-api.ts:395 (1) |
| 169 | `/api/competency/development-plans` | MATCHED | A | GET /api/competency/development-plans ; POST /api/competency/development-plans | app/talent-management/_lib/development-career-api.ts:507; app/talent-management/_lib/development-career-api.ts:540 (3) |
| 170 | `/api/competency/development-plans/${id}` | MATCHED | A | GET /api/competency/development-plans/{id} ; PUT /api/competency/development-plans/{id} ; DELETE /api/competency/development-plans/{id} | app/talent-management/_lib/development-career-api.ts:535; app/talent-management/_lib/development-career-api.ts:546 (3) |
| 171 | `/api/competency/development-plans/${id}/actions` | MATCHED | A | GET /api/competency/development-plans/{id}/actions ; POST /api/competency/development-plans/{id}/actions | app/talent-management/_lib/development-career-api.ts:569; app/talent-management/_lib/development-career-api.ts:576 (2) |
| 172 | `/api/competency/development-plans/${id}/actions/${actionId}` | MATCHED | A | PUT /api/competency/development-plans/{id}/actions/{actionId} ; DELETE /api/competency/development-plans/{id}/actions/{actionId} | app/talent-management/_lib/development-career-api.ts:583; app/talent-management/_lib/development-career-api.ts:590 (2) |
| 173 | `/api/competency/development-plans/${id}/gaps` | MATCHED | A | GET /api/competency/development-plans/{id}/gaps | app/talent-management/_lib/development-career-api.ts:562 (1) |
| 174 | `/api/competency/development-plans/${id}/history` | MATCHED | A | GET /api/competency/development-plans/{id}/history | app/talent-management/_lib/development-career-api.ts:597 (1) |
| 175 | `/api/competency/development-plans/metrics` | MATCHED | A | GET /api/competency/development-plans/metrics ; GET /api/competency/development-plans/{id} ; PUT /api/competency/development-plans/{id} ...(+1) | app/talent-management/_lib/development-career-api.ts:514 (1) |
| 176 | `/api/competency/development-plans/owners` | MATCHED | A | GET /api/competency/development-plans/owners ; GET /api/competency/development-plans/{id} ; PUT /api/competency/development-plans/{id} ...(+1) | app/talent-management/_lib/development-career-api.ts:521 (1) |
| 177 | `/api/competency/employee-options` | MATCHED | A | GET /api/competency/employee-options | app/talent-management/_lib/certifications-api.ts:560; app/talent-management/_lib/development-career-api.ts:528 (2) |
| 178 | `/api/competency/employee-profiles` | MATCHED | A | GET /api/competency/employee-profiles | app/talent-management/_lib/employee-profiles-api.ts:485 (1) |
| 179 | `/api/competency/employee-profiles/${userId}` | MATCHED | A | GET /api/competency/employee-profiles/{id} | app/talent-management/_lib/employee-profiles-api.ts:244 (1) |
| 180 | `/api/competency/employee-profiles/${userId}/available-skills` | MATCHED | A | GET /api/competency/employee-profiles/{id}/available-skills | app/talent-management/_lib/employee-profiles-api.ts:251 (1) |
| 181 | `/api/competency/employee-profiles/${userId}/career-path` | MATCHED | A | GET /api/competency/employee-profiles/{id}/career-path | app/talent-management/_lib/employee-profiles-api.ts:315 (1) |
| 182 | `/api/competency/employee-profiles/${userId}/certifications` | MATCHED | A | GET /api/competency/employee-profiles/{id}/certifications | app/talent-management/_lib/employee-profiles-api.ts:280 (1) |
| 183 | `/api/competency/employee-profiles/${userId}/development-plans` | MATCHED | A | GET /api/competency/employee-profiles/{id}/development-plans | app/talent-management/_lib/employee-profiles-api.ts:287 (1) |
| 184 | `/api/competency/employee-profiles/${userId}/evidence` | MATCHED | A | GET /api/competency/employee-profiles/{id}/evidence ; POST /api/competency/employee-profiles/{id}/evidence | app/talent-management/_lib/employee-profiles-api.ts:294; app/talent-management/_lib/employee-profiles-api.ts:301 (2) |
| 185 | `/api/competency/employee-profiles/${userId}/evidence/${evidenceId}` | MATCHED | A | DELETE /api/competency/employee-profiles/{id}/evidence/{evidenceId} | app/talent-management/_lib/employee-profiles-api.ts:308 (1) |
| 186 | `/api/competency/employee-profiles/${userId}/notes` | MATCHED | A | GET /api/competency/employee-profiles/{id}/notes ; PUT /api/competency/employee-profiles/{id}/notes | app/talent-management/_lib/employee-profiles-api.ts:323; app/talent-management/_lib/employee-profiles-api.ts:330 (2) |
| 187 | `/api/competency/employee-profiles/${userId}/skills` | MATCHED | A | POST /api/competency/employee-profiles/{id}/skills | app/talent-management/_lib/employee-profiles-api.ts:258 (1) |
| 188 | `/api/competency/employee-profiles/${userId}/skills/${matrixId}` | MATCHED | A | PUT /api/competency/employee-profiles/{id}/skills/{matrixId} | app/talent-management/_lib/employee-profiles-api.ts:265 (1) |
| 189 | `/api/competency/employee-profiles/${userId}/skills/${skillId}/history` | MATCHED | A | GET /api/competency/employee-profiles/{id}/skills/{skillId}/history | app/talent-management/_lib/employee-profiles-api.ts:272 (1) |
| 190 | `/api/competency/frameworks/${id}` | MATCHED | A | GET /api/competency/frameworks/{id} ; PUT /api/competency/frameworks/{id} ; DELETE /api/competency/frameworks/{id} | app/capability-intelligence/_lib/framework-studio-api.ts:349; app/capability-intelligence/_lib/framework-studio-api.ts:355 (3) |
| 191 | `/api/competency/frameworks/${id}/clone` | MATCHED | A | POST /api/competency/frameworks/{id}/clone | app/capability-intelligence/_lib/framework-studio-api.ts:358 (1) |
| 192 | `/api/competency/frameworks/${id}/items` | MATCHED | A | GET /api/competency/frameworks/{id}/items ; POST /api/competency/frameworks/{id}/items | app/capability-intelligence/_lib/framework-studio-api.ts:367 (1) |
| 193 | `/api/competency/frameworks/${id}/items/${itemId}` | MATCHED | A | DELETE /api/competency/frameworks/{id}/items/{itemId} | app/capability-intelligence/_lib/framework-studio-api.ts:374 (1) |
| 194 | `/api/competency/kasba-rating` | MATCHED | A | GET /api/competency/kasba-rating ; POST /api/competency/kasba-rating ; DELETE /api/competency/kasba-rating | app/organization-management/_lib/employee-directory-api.ts:323; app/talent-management/_lib/employee-profiles-api.ts:414 (4) |
| 195 | `/api/competency/library/dependants` | MATCHED | A | GET /api/competency/library/dependants | app/capability-intelligence/_lib/competency-extras-api.ts:412 (1) |
| 196 | `/api/competency/library/invisible/${id}/clone` | MATCHED | A | POST /api/competency/library/invisible/{id}/clone | app/capability-intelligence/_lib/libraries-taxonomy-api.ts:388 (1) |
| 197 | `/api/competency/library/jobrole-tasks` | MATCHED | A | POST /api/competency/library/jobrole-tasks ; GET /api/competency/library/jobrole-tasks | app/task-management/_lib/my-tasks-api.ts:394 (1) |
| 198 | `/api/competency/library/kasa/${tab}/${id}/usage` | MATCHED | A | GET /api/competency/library/kasa/{type}/{id}/usage | app/capability-intelligence/_lib/libraries-taxonomy-api.ts:419 (1) |
| 199 | `/api/competency/library/kasa/${type}/${id}/usage` | MATCHED | A | GET /api/competency/library/kasa/{type}/{id}/usage | app/capability-intelligence/_lib/competency-extras-api.ts:210 (1) |
| 200 | `/api/competency/library/levels-of-responsibility` | MATCHED | A | GET /api/competency/library/levels-of-responsibility | app/capability-intelligence/_lib/libraries-taxonomy-api.ts:409 (1) |
| 201 | `/api/competency/library/meta` | MATCHED | A | GET /api/competency/library/meta | app/capability-intelligence/_lib/libraries-taxonomy-api.ts:370 (1) |
| 202 | `/api/competency/library/skill-taxonomy-tree` | MATCHED | A | GET /api/competency/library/skill-taxonomy-tree | app/capability-intelligence/_lib/libraries-taxonomy-api.ts:412 (1) |
| 203 | `/api/competency/library/taxonomy/${tab}` | MATCHED | A | GET /api/competency/library/taxonomy/{type} ; POST /api/competency/library/taxonomy/{type} ; PUT /api/competency/library/taxonomy/{type} ...(+1) | app/capability-intelligence/_lib/libraries-taxonomy-api.ts:394; app/capability-intelligence/_lib/libraries-taxonomy-api.ts:397 (4) |
| 204 | `/api/competency/library/work-functions` | MATCHED | A | GET /api/competency/library/work-functions | app/capability-intelligence/_lib/libraries-taxonomy-api.ts:406 (1) |
| 205 | `/api/competency/mapping-reviews/${id}` | MATCHED | A | PUT /api/competency/mapping-reviews/{id} | app/capability-intelligence/_lib/framework-studio-api.ts:405 (1) |
| 206 | `/api/competency/mapping-reviews/bulk-approve` | MATCHED | A | PUT /api/competency/mapping-reviews/{id} ; POST /api/competency/mapping-reviews/bulk-approve | app/capability-intelligence/_lib/framework-studio-api.ts:408 (1) |
| 207 | `/api/competency/role-map/${id}` | MATCHED | A | DELETE /api/competency/role-map/{id} | app/capability-intelligence/_lib/competency-extras-api.ts:332 (1) |
| 208 | `/api/competency/role-mapping/cell` | MATCHED | A | PUT /api/competency/role-mapping/cell ; DELETE /api/competency/role-mapping/cell | app/capability-intelligence/_lib/framework-studio-api.ts:387; app/capability-intelligence/_lib/framework-studio-api.ts:395 (2) |
| 209 | `/api/competency/role-mapping/matrix` | MATCHED | A | GET /api/competency/role-mapping/matrix | app/capability-intelligence/_lib/framework-studio-api.ts:381 (1) |
| 210 | `/api/competency/role-mapping/roles` | MATCHED | A | GET /api/competency/role-mapping/roles | app/capability-intelligence/_lib/framework-studio-api.ts:378 (1) |
| 211 | `/api/competency/studio/framework-structure` | MATCHED | A | GET /api/competency/studio/framework-structure | app/capability-intelligence/_lib/framework-studio-api.ts:324 (1) |
| 212 | `/api/competency/studio/proficiency-scale` | MATCHED | A | GET /api/competency/studio/proficiency-scale ; POST /api/competency/studio/proficiency-scale | app/capability-intelligence/_lib/framework-studio-api.ts:327; app/capability-intelligence/_lib/framework-studio-api.ts:330 (2) |
| 213 | `/api/competency/studio/proficiency-scale/${id}` | MATCHED | A | PUT /api/competency/studio/proficiency-scale/{id} ; DELETE /api/competency/studio/proficiency-scale/{id} | app/capability-intelligence/_lib/framework-studio-api.ts:333; app/capability-intelligence/_lib/framework-studio-api.ts:336 (2) |
| 214 | `/api/competency/studio/summary` | MATCHED | A | GET /api/competency/studio/summary | app/capability-intelligence/_lib/framework-studio-api.ts:321 (1) |
| 215 | `/api/competency/studio/weights` | MATCHED | A | GET /api/competency/studio/weights ; PUT /api/competency/studio/weights | app/capability-intelligence/_lib/framework-studio-api.ts:339; app/capability-intelligence/_lib/framework-studio-api.ts:342 (2) |
| 216 | `/api/competency/task-map` | MATCHED | A | POST /api/competency/task-map | app/task-management/_lib/competency-api.ts:96 (1) |
| 217 | `/api/competency/task-map/for-task` | MATCHED | A | GET /api/competency/task-map/for-task | app/task-management/_lib/competency-api.ts:72 (1) |
| 218 | `/api/complaints` | MATCHED | N | GET /api/complaints ; POST /api/complaints | app/admin-services/_lib/complaint.ts:33 (1) |
| 219 | `/api/complaints/${id}` | MATCHED | N | POST /api/complaints/{id} | app/admin-services/_lib/complaint.ts:147 (1) |
| 220 | `/api/complaints/${id}/delete` | MATCHED | N | POST /api/complaints/{id}/delete | app/admin-services/_lib/complaint.ts:153 (1) |
| 221 | `/api/consents` | MATCHED | N | GET /api/consents ; POST /api/consents | app/admin-services/_lib/consent.ts:33 (1) |
| 222 | `/api/consents/delete` | MATCHED | N | POST /api/consents/delete | app/admin-services/_lib/consent.ts:173 (1) |
| 223 | `/api/consents/students` | MATCHED | N | GET /api/consents/students | app/admin-services/_lib/consent.ts:32 (1) |
| 224 | `/api/dashboard-preferences/${encodeURIComponent(dashboardKey)}` | MATCHED | A | GET /api/dashboard-preferences/{dashboardKey} ; PUT /api/dashboard-preferences/{dashboardKey} | app/dashboard/_lib/dashboard-preferences.ts:49 (1) |
| 225 | `/api/departments-management` | MATCHED | N | GET /api/departments-management ; POST /api/departments-management | app/hrit/_lib/payroll-api.ts:896; app/organization_managment/_lib/department-management-api.ts:94 (4) |
| 226 | `/api/departments-management/${departmentId}/employees` | MATCHED | N | POST /api/departments-management/{id}/employees ; DELETE /api/departments-management/{id}/employees | app/organization_managment/_lib/department-management-api.ts:304; app/organization_managment/_lib/department-management-api.ts:329 (4) |
| 227 | `/api/departments-management/${id}` | MATCHED | N | PUT,PATCH /api/departments-management/{id} ; DELETE /api/departments-management/{id} | app/organization_managment/_lib/department-management-api.ts:133; app/organization_managment/_lib/department-management-api.ts:151 (5) |
| 228 | `/api/departments-management/${id}/head` | MATCHED | N | PATCH /api/departments-management/{id}/head | app/organization_managment/_lib/department-management-api.ts:204; components/domain/organization/department-management/organization-service.ts:274 (2) |
| 229 | `/api/departments-management/${id}/impact` | MATCHED | N | GET /api/departments-management/{id}/impact | app/organization_managment/_lib/department-management-api.ts:171; components/domain/organization/department-management/organization-service.ts:250 (2) |
| 230 | `/api/departments-management/employees` | MATCHED | N | GET /api/departments-management/employees ; PUT,PATCH /api/departments-management/{id} ; DELETE /api/departments-management/{id} | app/organization_managment/_lib/department-management-api.ts:263; components/domain/organization/department-management/organization-service.ts:322 (2) |
| 231 | `/api/departments-management/export` | MATCHED | N | GET /api/departments-management/export ; PUT,PATCH /api/departments-management/{id} ; DELETE /api/departments-management/{id} | components/domain/organization/department-management/organization-service.ts:307 (1) |
| 232 | `/api/departments-management/merge` | MATCHED | N | POST /api/departments-management/merge ; PUT,PATCH /api/departments-management/{id} ; DELETE /api/departments-management/{id} | app/organization_managment/_lib/department-management-api.ts:218 (1) |
| 233 | `/api/departments-management/reorder` | MATCHED | N | POST /api/departments-management/reorder ; PUT,PATCH /api/departments-management/{id} ; DELETE /api/departments-management/{id} | app/organization_managment/_lib/department-management-api.ts:343; components/domain/organization/department-management/organization-service.ts:296 (2) |
| 234 | `/api/departments/hierarchy` | MATCHED | N | GET /api/departments/hierarchy | app/organization_managment/Department/page.tsx:238 (1) |
| 235 | `/api/documents/recent` | MATCHED | A | GET /api/documents/recent | app/documents/_lib/documents-api.ts:221 (1) |
| 236 | `/api/documents/sources` | MATCHED | A | GET /api/documents/sources | app/documents/_lib/documents-api.ts:151 (1) |
| 237 | `/api/employee-salary-structure/store` | ALT | A | POST /employee-salary-structure/store | app/hrit/_lib/payroll-api.ts:668 (1) |
| 238 | `/api/evaluation` | MATCHED | A | POST /api/evaluation | app/talent-management/_lib/recruitment-api.ts:311 (1) |
| 239 | `/api/exam-evaluation/${path}` | MATCHED |  |  | app/lms/exam/_exam-evaluation/api.ts:75 (1) |
| 240 | `/api/feedback` | MATCHED | A | GET /api/feedback | app/talent-management/_lib/recruitment-api.ts:314 (1) |
| 241 | `/api/feedback/${candidateId}` | MATCHED | A | GET /api/feedback/{id} ; PUT /api/feedback/{id} ; DELETE /api/feedback/{id} | app/talent-management/_lib/recruitment-api.ts:317 (1) |
| 242 | `/api/feedback/${id}` | MATCHED | A | GET /api/feedback/{id} ; PUT /api/feedback/{id} ; DELETE /api/feedback/{id} | app/talent-management/_lib/recruitment-api.ts:320; app/talent-management/_lib/recruitment-api.ts:325 (2) |
| 243 | `/api/fees-cancel/search` | MATCHED | A | POST /api/fees-cancel/search | app/fees/cancel-refund/page.tsx:198 (1) |
| 244 | `/api/fees-dashboard/summary` | MATCHED | A | POST /api/fees-dashboard/summary | app/api/fees/dashboard/summary/route.ts:19; app/api/fees/dashboard/summary/route.ts:99 (2) |
| 245 | `/api/fees-refund/detail/${encodeURIComponent(id)}` | MATCHED | A | POST /api/fees-refund/detail/{studentId} | app/fees/cancel-refund/page.tsx:758 (1) |
| 246 | `/api/fees-refund/save` | MATCHED | A | POST /api/fees-refund/save | app/fees/cancel-refund/page.tsx:774 (1) |
| 247 | `/api/fees-refund/search` | MATCHED | A | POST /api/fees-refund/search | app/fees/cancel-refund/page.tsx:747 (1) |
| 248 | `/api/fees/menu-categories` | MATCHED | A | GET,POST /api/fees/menu-categories | app/api/fees/menu-categories/route.ts:61 (1) |
| 249 | `/api/fields-configuration` | MATCHED | N | GET /api/fields-configuration ; POST /api/fields-configuration | app/general/fields_configuration/page.tsx:220 (1) |
| 250 | `/api/front-desk` | MATCHED | N | GET /api/front-desk ; POST /api/front-desk | app/admin-services/_lib/frontdesk.ts:32 (1) |
| 251 | `/api/front-desk/${id}` | MATCHED | N | GET /api/front-desk/{id} ; POST /api/front-desk/{id} | app/admin-services/_lib/frontdesk.ts:117; app/admin-services/_lib/frontdesk.ts:145 (2) |
| 252 | `/api/front-desk/${id}/delete` | MATCHED | N | POST /api/front-desk/{id}/delete | app/admin-services/_lib/frontdesk.ts:151 (1) |
| 253 | `/api/front-desk/report` | MATCHED | N | GET /api/front-desk/report ; GET /api/front-desk/{id} ; POST /api/front-desk/{id} | app/admin-services/_lib/frontdesk.ts:163 (1) |
| 254 | `/api/g2g-lms/administration-governance/audit-logs` | MATCHED | A | GET /api/g2g-lms/administration-governance/audit-logs | components/domain/lms/administration-governance/administration-governance-service.ts:273 (1) |
| 255 | `/api/g2g-lms/administration-governance/integrations` | MATCHED | A | GET /api/g2g-lms/administration-governance/integrations ; POST /api/g2g-lms/administration-governance/integrations | components/domain/lms/administration-governance/administration-governance-service.ts:257; components/domain/lms/administration-governance/administration-governance-service.ts:260 (2) |
| 256 | `/api/g2g-lms/administration-governance/integrations/${id}` | MATCHED | A | PUT /api/g2g-lms/administration-governance/integrations/{id} ; DELETE /api/g2g-lms/administration-governance/integrations/{id} | components/domain/lms/administration-governance/administration-governance-service.ts:263; components/domain/lms/administration-governance/administration-governance-service.ts:266 (2) |
| 257 | `/api/g2g-lms/administration-governance/kpis` | MATCHED | A | GET /api/g2g-lms/administration-governance/kpis | components/domain/lms/administration-governance/administration-governance-service.ts:153 (1) |
| 258 | `/api/g2g-lms/administration-governance/permissions` | MATCHED | A | GET /api/g2g-lms/administration-governance/permissions ; POST /api/g2g-lms/administration-governance/permissions | components/domain/lms/administration-governance/administration-governance-service.ts:215; components/domain/lms/administration-governance/administration-governance-service.ts:221 (2) |
| 259 | `/api/g2g-lms/administration-governance/roles` | MATCHED | A | GET /api/g2g-lms/administration-governance/roles ; POST /api/g2g-lms/administration-governance/roles | components/domain/lms/administration-governance/administration-governance-service.ts:201; components/domain/lms/administration-governance/administration-governance-service.ts:204 (2) |
| 260 | `/api/g2g-lms/administration-governance/roles/${id}` | MATCHED | A | PUT /api/g2g-lms/administration-governance/roles/{id} ; DELETE /api/g2g-lms/administration-governance/roles/{id} | components/domain/lms/administration-governance/administration-governance-service.ts:207; components/domain/lms/administration-governance/administration-governance-service.ts:210 (2) |
| 261 | `/api/g2g-lms/administration-governance/system-health` | MATCHED | A | GET /api/g2g-lms/administration-governance/system-health | components/domain/lms/administration-governance/administration-governance-service.ts:156 (1) |
| 262 | `/api/g2g-lms/administration-governance/trainers` | MATCHED | A | GET /api/g2g-lms/administration-governance/trainers ; POST /api/g2g-lms/administration-governance/trainers | components/domain/lms/administration-governance/administration-governance-service.ts:229; components/domain/lms/administration-governance/administration-governance-service.ts:232 (2) |
| 263 | `/api/g2g-lms/administration-governance/trainers/${id}` | MATCHED | A | PUT /api/g2g-lms/administration-governance/trainers/{id} ; DELETE /api/g2g-lms/administration-governance/trainers/{id} | components/domain/lms/administration-governance/administration-governance-service.ts:235; components/domain/lms/administration-governance/administration-governance-service.ts:238 (2) |
| 264 | `/api/g2g-lms/administration-governance/users` | MATCHED | A | GET /api/g2g-lms/administration-governance/users ; POST /api/g2g-lms/administration-governance/users | components/domain/lms/administration-governance/administration-governance-service.ts:163; components/domain/lms/administration-governance/administration-governance-service.ts:177 (2) |
| 265 | `/api/g2g-lms/administration-governance/users/${id}` | MATCHED | A | PUT /api/g2g-lms/administration-governance/users/{id} ; DELETE /api/g2g-lms/administration-governance/users/{id} | components/domain/lms/administration-governance/administration-governance-service.ts:180; components/domain/lms/administration-governance/administration-governance-service.ts:184 (2) |
| 266 | `/api/g2g-lms/administration-governance/users/import` | MATCHED | A | POST /api/g2g-lms/administration-governance/users/import ; PUT /api/g2g-lms/administration-governance/users/{id} ; DELETE /api/g2g-lms/administration-governance/users/{id} | components/domain/lms/administration-governance/administration-governance-service.ts:193 (1) |
| 267 | `/api/g2g-lms/administration-governance/vendors` | MATCHED | A | GET /api/g2g-lms/administration-governance/vendors ; POST /api/g2g-lms/administration-governance/vendors | components/domain/lms/administration-governance/administration-governance-service.ts:243; components/domain/lms/administration-governance/administration-governance-service.ts:246 (2) |
| 268 | `/api/g2g-lms/administration-governance/vendors/${id}` | MATCHED | A | PUT /api/g2g-lms/administration-governance/vendors/{id} ; DELETE /api/g2g-lms/administration-governance/vendors/{id} | components/domain/lms/administration-governance/administration-governance-service.ts:249; components/domain/lms/administration-governance/administration-governance-service.ts:252 (2) |
| 269 | `/api/g2g-lms/assignments/bulk-review` | MATCHED | A | POST /api/g2g-lms/assignments/bulk-review | components/domain/lms/assignments/assignments-service.ts:319 (1) |
| 270 | `/api/g2g-lms/assignments/bulk-status` | MATCHED | A | POST /api/g2g-lms/assignments/bulk-status | components/domain/lms/assignments/assignments-service.ts:250 (1) |
| 271 | `/api/g2g-lms/assignments/courses` | MATCHED | A | GET /api/g2g-lms/assignments/courses | components/domain/lms/assignments/assignments-service.ts:272 (1) |
| 272 | `/api/g2g-lms/assignments/enrollments` | MATCHED | A | GET /api/g2g-lms/assignments/enrollments | components/domain/lms/assignments/assignments-service.ts:323 (1) |
| 273 | `/api/g2g-lms/assignments/import` | MATCHED | A | POST /api/g2g-lms/assignments/import | components/domain/lms/assignments/assignments-service.ts:292 (1) |
| 274 | `/api/g2g-lms/assignments/learners` | MATCHED | A | GET /api/g2g-lms/assignments/learners | components/domain/lms/assignments/assignments-service.ts:265 (1) |
| 275 | `/api/g2g-lms/assignments/request` | MATCHED | A | POST /api/g2g-lms/assignments/request | components/domain/lms/assignments/assignments-service.ts:258 (1) |
| 276 | `/api/g2g-lms/assignments/stats` | MATCHED | A | GET /api/g2g-lms/assignments/stats | components/domain/lms/assignments/assignments-service.ts:238 (1) |
| 277 | `/api/g2g-lms/certifications-records/certificates` | MATCHED | A | GET /api/g2g-lms/certifications-records/certificates ; POST /api/g2g-lms/certifications-records/certificates | components/domain/lms/certifications-records/certifications-records-service.ts:203 (1) |
| 278 | `/api/g2g-lms/certifications-records/certificates/${certificateId}/download` | MATCHED | A | GET /api/g2g-lms/certifications-records/certificates/{id}/download | components/domain/lms/certifications-records/certifications-records-service.ts:220 (1) |
| 279 | `/api/g2g-lms/certifications-records/certificates/${certificateId}/reissue` | MATCHED | A | POST /api/g2g-lms/certifications-records/certificates/{id}/reissue | components/domain/lms/certifications-records/certifications-records-service.ts:241 (1) |
| 280 | `/api/g2g-lms/certifications-records/certificates/verify/${encodeURIComponent(code)}` | MATCHED | N | GET /api/g2g-lms/certifications-records/certificates/verify/{code} | components/domain/lms/certifications-records/certifications-records-service.ts:225 (1) |
| 281 | `/api/g2g-lms/certifications-records/completion-history` | MATCHED | A | GET /api/g2g-lms/certifications-records/completion-history | components/domain/lms/certifications-records/certifications-records-service.ts:253 (1) |
| 282 | `/api/g2g-lms/certifications-records/transcript` | MATCHED | A | GET /api/g2g-lms/certifications-records/transcript | components/domain/lms/certifications-records/certifications-records-service.ts:247 (1) |
| 283 | `/api/g2g-lms/course-builder/ai/outline` | MATCHED | A | POST /api/g2g-lms/course-builder/ai/outline | components/domain/lms/course-builder/ai-course-service.ts:181 (1) |
| 284 | `/api/g2g-lms/course-builder/ai/outlines` | MATCHED | A | GET /api/g2g-lms/course-builder/ai/outlines | components/domain/lms/course-builder/ai-course-service.ts:196 (1) |
| 285 | `/api/g2g-lms/course-builder/ai/outlines/${outlineId}/publish` | MATCHED | A | POST /api/g2g-lms/course-builder/ai/outlines/{id}/publish | components/domain/lms/course-builder/ai-course-service.ts:204 (1) |
| 286 | `/api/g2g-lms/course-builder/ai/presentation` | MATCHED | A | POST /api/g2g-lms/course-builder/ai/presentation | components/domain/lms/course-builder/ai-course-service.ts:185 (1) |
| 287 | `/api/g2g-lms/course-builder/ai/presentation/${generationId}` | MATCHED | A | GET /api/g2g-lms/course-builder/ai/presentation/{generationId} | components/domain/lms/course-builder/ai-course-service.ts:191 (1) |
| 288 | `/api/g2g-lms/course-builder/ai/status` | MATCHED | A | GET /api/g2g-lms/course-builder/ai/status | components/domain/lms/course-builder/ai-course-service.ts:177 (1) |
| 289 | `/api/g2g-lms/course-builder/assessments` | MATCHED | A | GET /api/g2g-lms/course-builder/assessments ; POST /api/g2g-lms/course-builder/assessments | components/domain/lms/course-builder/course-builder-service.ts:355; components/domain/lms/course-builder/course-builder-service.ts:360 (2) |
| 290 | `/api/g2g-lms/course-builder/assessments/${id}` | MATCHED | A | DELETE /api/g2g-lms/course-builder/assessments/{id} | components/domain/lms/course-builder/course-builder-service.ts:363 (1) |
| 291 | `/api/g2g-lms/course-builder/assessments/${paperId}/questions` | MATCHED | A | GET /api/g2g-lms/course-builder/assessments/{id}/questions ; POST /api/g2g-lms/course-builder/assessments/{id}/questions | components/domain/lms/course-builder/course-builder-service.ts:368; components/domain/lms/course-builder/course-builder-service.ts:373 (2) |
| 292 | `/api/g2g-lms/course-builder/assessments/${paperId}/questions/${questionId}` | MATCHED | A | PUT /api/g2g-lms/course-builder/assessments/{id}/questions/{questionId} ; DELETE /api/g2g-lms/course-builder/assessments/{id}/questions/{questionId} | components/domain/lms/course-builder/course-builder-service.ts:385; components/domain/lms/course-builder/course-builder-service.ts:392 (2) |
| 293 | `/api/g2g-lms/course-builder/assessments/${paperId}/questions/generate` | MATCHED | A | PUT /api/g2g-lms/course-builder/assessments/{id}/questions/{questionId} ; DELETE /api/g2g-lms/course-builder/assessments/{id}/questions/{questionId} ; POST /api/g2g-lms/course-builder/assessments/{id}/questions/generate | components/domain/lms/course-builder/course-builder-service.ts:402 (1) |
| 294 | `/api/g2g-lms/course-builder/chapters` | MATCHED | A | POST /api/g2g-lms/course-builder/chapters | components/domain/lms/course-builder/course-builder-service.ts:320 (1) |
| 295 | `/api/g2g-lms/course-builder/chapters/${moduleId}` | MATCHED | A | PUT /api/g2g-lms/course-builder/chapters/{id} ; DELETE /api/g2g-lms/course-builder/chapters/{id} | components/domain/lms/course-builder/course-builder-service.ts:329; components/domain/lms/course-builder/course-builder-service.ts:332 (2) |
| 296 | `/api/g2g-lms/course-builder/competencies/${id}` | MATCHED | A | DELETE /api/g2g-lms/course-builder/competencies/{id} | components/domain/lms/course-builder/course-builder-service.ts:441 (1) |
| 297 | `/api/g2g-lms/course-builder/content` | MATCHED | A | POST /api/g2g-lms/course-builder/content | components/domain/lms/course-builder/course-builder-service.ts:347 (1) |
| 298 | `/api/g2g-lms/course-builder/content/${contentId}` | MATCHED | A | DELETE /api/g2g-lms/course-builder/content/{id} | components/domain/lms/course-builder/course-builder-service.ts:350 (1) |
| 299 | `/api/g2g-lms/course-builder/courses` | MATCHED | A | POST /api/g2g-lms/course-builder/courses | components/domain/lms/course-builder/course-builder-service.ts:286; components/domain/lms/course-builder/course-builder-service.ts:304 (2) |
| 300 | `/api/g2g-lms/course-builder/courses/${courseId}` | MATCHED | A | GET /api/g2g-lms/course-builder/courses/{id} ; PUT /api/g2g-lms/course-builder/courses/{id} | components/domain/lms/course-builder/course-builder-service.ts:282; components/domain/lms/course-builder/course-builder-service.ts:290 (2) |
| 301 | `/api/g2g-lms/course-builder/courses/${courseId}/audience` | MATCHED | A | POST /api/g2g-lms/course-builder/courses/{id}/audience | components/domain/lms/course-builder/course-builder-service.ts:418 (1) |
| 302 | `/api/g2g-lms/course-builder/courses/${courseId}/audience/preview` | MATCHED | A | GET /api/g2g-lms/course-builder/courses/{id}/audience/preview | components/domain/lms/course-builder/course-builder-service.ts:411 (1) |
| 303 | `/api/g2g-lms/course-builder/courses/${courseId}/competencies` | MATCHED | A | GET /api/g2g-lms/course-builder/courses/{courseId}/competencies ; POST /api/g2g-lms/course-builder/courses/{courseId}/competencies | components/domain/lms/course-builder/course-builder-service.ts:427; components/domain/lms/course-builder/course-builder-service.ts:434 (2) |
| 304 | `/api/g2g-lms/course-builder/courses/${courseId}/modules` | MATCHED | A | GET /api/g2g-lms/course-builder/courses/{id}/modules | components/domain/lms/course-builder/course-builder-service.ts:312 (1) |
| 305 | `/api/g2g-lms/course-builder/options` | MATCHED | A | GET /api/g2g-lms/course-builder/options | components/domain/lms/course-builder/course-builder-service.ts:278 (1) |
| 306 | `/api/g2g-lms/learning-catalog/bulk` | MATCHED | A | POST /api/g2g-lms/learning-catalog/bulk | components/domain/lms/catalog/catalog-service.ts:375 (1) |
| 307 | `/api/g2g-lms/learning-catalog/courses` | MATCHED | A | GET /api/g2g-lms/learning-catalog/courses ; POST /api/g2g-lms/learning-catalog/courses | components/domain/lms/catalog/catalog-service.ts:351; components/domain/lms/catalog/catalog-service.ts:408 (2) |
| 308 | `/api/g2g-lms/learning-catalog/courses/${id}` | MATCHED | A | GET /api/g2g-lms/learning-catalog/courses/{id} ; PUT /api/g2g-lms/learning-catalog/courses/{id} ; DELETE /api/g2g-lms/learning-catalog/courses/{id} | components/domain/lms/catalog/catalog-service.ts:363; components/domain/lms/catalog/catalog-service.ts:367 (3) |
| 309 | `/api/g2g-lms/learning-catalog/courses/${id}/audience` | MATCHED | A | POST /api/g2g-lms/learning-catalog/courses/{id}/audience | components/domain/lms/catalog/catalog-service.ts:425 (1) |
| 310 | `/api/g2g-lms/learning-catalog/courses/${id}/audience/preview` | MATCHED | A | GET /api/g2g-lms/learning-catalog/courses/{id}/audience/preview | components/domain/lms/catalog/catalog-service.ts:418 (1) |
| 311 | `/api/g2g-lms/learning-catalog/filters` | MATCHED | A | GET /api/g2g-lms/learning-catalog/filters | components/domain/lms/catalog/catalog-service.ts:359 (1) |
| 312 | `/api/g2g-lms/learning-catalog/kpis` | MATCHED | A | GET /api/g2g-lms/learning-catalog/kpis | components/domain/lms/catalog/catalog-service.ts:355 (1) |
| 313 | `/api/g2g-lms/learning-dashboard/achievements` | MATCHED | A | GET /api/g2g-lms/learning-dashboard/achievements | components/domain/lms/dashboard/dashboard-service.ts:414 (1) |
| 314 | `/api/g2g-lms/learning-dashboard/available-courses` | MATCHED | A | GET /api/g2g-lms/learning-dashboard/available-courses | components/domain/lms/dashboard/dashboard-service.ts:367 (1) |
| 315 | `/api/g2g-lms/learning-dashboard/calendar` | MATCHED | A | GET /api/g2g-lms/learning-dashboard/calendar | components/domain/lms/dashboard/dashboard-service.ts:408 (1) |
| 316 | `/api/g2g-lms/learning-dashboard/enroll` | MATCHED | A | POST /api/g2g-lms/learning-dashboard/enroll | components/domain/lms/dashboard/dashboard-service.ts:378 (1) |
| 317 | `/api/g2g-lms/learning-dashboard/enrolled-courses` | MATCHED | A | GET /api/g2g-lms/learning-dashboard/enrolled-courses | components/domain/lms/dashboard/dashboard-service.ts:361 (1) |
| 318 | `/api/g2g-lms/learning-dashboard/peer-comparison` | MATCHED | A | GET /api/g2g-lms/learning-dashboard/peer-comparison | components/domain/lms/dashboard/dashboard-service.ts:429 (1) |
| 319 | `/api/g2g-lms/learning-dashboard/recent-activity` | MATCHED | A | GET /api/g2g-lms/learning-dashboard/recent-activity | components/domain/lms/dashboard/dashboard-service.ts:435 (1) |
| 320 | `/api/g2g-lms/learning-dashboard/skill-progress` | MATCHED | A | GET /api/g2g-lms/learning-dashboard/skill-progress | components/domain/lms/dashboard/dashboard-service.ts:402 (1) |
| 321 | `/api/g2g-lms/learning-dashboard/streak` | MATCHED | A | GET /api/g2g-lms/learning-dashboard/streak | components/domain/lms/dashboard/dashboard-service.ts:418 (1) |
| 322 | `/api/g2g-lms/learning-dashboard/weekly-goal` | MATCHED | A | GET /api/g2g-lms/learning-dashboard/weekly-goal | components/domain/lms/dashboard/dashboard-service.ts:422 (1) |
| 323 | `/api/g2g-lms/my-learning/assessments` | MATCHED | A | GET /api/g2g-lms/my-learning/assessments | components/domain/lms/delivery/learning-service.ts:375 (1) |
| 324 | `/api/g2g-lms/my-learning/certificates` | MATCHED | A | GET /api/g2g-lms/my-learning/certificates ; POST /api/g2g-lms/my-learning/certificates | components/domain/lms/delivery/learning-service.ts:517; components/domain/lms/delivery/learning-service.ts:526 (2) |
| 325 | `/api/g2g-lms/my-learning/certificates/${certificateId}/download` | MATCHED | A | GET /api/g2g-lms/my-learning/certificates/{id}/download | components/domain/lms/delivery/learning-service.ts:533 (1) |
| 326 | `/api/g2g-lms/my-learning/certificates/${certificateId}/reissue` | MATCHED | A | POST /api/g2g-lms/my-learning/certificates/{id}/reissue | components/domain/lms/delivery/learning-service.ts:563 (1) |
| 327 | `/api/g2g-lms/my-learning/certificates/verify/${encodeURIComponent(code)}` | MATCHED | A | GET /api/g2g-lms/my-learning/certificates/verify/{code} | components/domain/lms/delivery/learning-service.ts:548 (1) |
| 328 | `/api/g2g-lms/my-learning/chapters` | MATCHED | A | POST /api/g2g-lms/my-learning/chapters | components/domain/lms/delivery/learning-service.ts:395 (1) |
| 329 | `/api/g2g-lms/my-learning/chapters/${id}` | MATCHED | A | PUT /api/g2g-lms/my-learning/chapters/{id} ; DELETE /api/g2g-lms/my-learning/chapters/{id} | components/domain/lms/delivery/learning-service.ts:398; components/domain/lms/delivery/learning-service.ts:401 (2) |
| 330 | `/api/g2g-lms/my-learning/content` | MATCHED | A | POST /api/g2g-lms/my-learning/content | components/domain/lms/delivery/learning-service.ts:404 (1) |
| 331 | `/api/g2g-lms/my-learning/content/${id}` | MATCHED | A | PUT /api/g2g-lms/my-learning/content/{id} ; DELETE /api/g2g-lms/my-learning/content/{id} | components/domain/lms/delivery/learning-service.ts:407; components/domain/lms/delivery/learning-service.ts:410 (2) |
| 332 | `/api/g2g-lms/my-learning/courses` | MATCHED | A | GET /api/g2g-lms/my-learning/courses | components/domain/lms/delivery/learning-service.ts:356 (1) |
| 333 | `/api/g2g-lms/my-learning/courses/${courseId}` | MATCHED | A | GET /api/g2g-lms/my-learning/courses/{courseId} | components/domain/lms/delivery/learning-service.ts:360 (1) |
| 334 | `/api/g2g-lms/my-learning/courses/${courseId}/complete` | MATCHED | A | POST /api/g2g-lms/my-learning/courses/{courseId}/complete | components/domain/lms/delivery/learning-service.ts:371 (1) |
| 335 | `/api/g2g-lms/my-learning/discussions` | MATCHED | A | GET /api/g2g-lms/my-learning/discussions ; POST /api/g2g-lms/my-learning/discussions | components/domain/lms/delivery/learning-service.ts:568; components/domain/lms/delivery/learning-service.ts:571 (2) |
| 336 | `/api/g2g-lms/my-learning/discussions/${discussionId}` | MATCHED | A | DELETE /api/g2g-lms/my-learning/discussions/{id} | components/domain/lms/delivery/learning-service.ts:577 (1) |
| 337 | `/api/g2g-lms/my-learning/discussions/${discussionId}/replies` | MATCHED | A | POST /api/g2g-lms/my-learning/discussions/{id}/replies | components/domain/lms/delivery/learning-service.ts:574 (1) |
| 338 | `/api/g2g-lms/my-learning/notes` | MATCHED | A | GET /api/g2g-lms/my-learning/notes ; POST /api/g2g-lms/my-learning/notes | components/domain/lms/delivery/learning-service.ts:378; components/domain/lms/delivery/learning-service.ts:381 (2) |
| 339 | `/api/g2g-lms/my-learning/notes/${id}` | MATCHED | A | PUT /api/g2g-lms/my-learning/notes/{id} ; DELETE /api/g2g-lms/my-learning/notes/{id} | components/domain/lms/delivery/learning-service.ts:384; components/domain/lms/delivery/learning-service.ts:390 (2) |
| 340 | `/api/g2g-lms/my-learning/progress` | MATCHED | A | POST /api/g2g-lms/my-learning/progress | components/domain/lms/delivery/learning-service.ts:364 (1) |
| 341 | `/api/g2g-lms/sessions-calendar/deadlines` | MATCHED | A | GET /api/g2g-lms/sessions-calendar/deadlines ; PUT /api/g2g-lms/sessions-calendar/{id} ; DELETE /api/g2g-lms/sessions-calendar/{id} | components/domain/lms/sessions-calendar/sessions-calendar-service.ts:211 (1) |
| 342 | `/api/g2g-lms/sessions-calendar/stats` | MATCHED | A | GET /api/g2g-lms/sessions-calendar/stats ; PUT /api/g2g-lms/sessions-calendar/{id} ; DELETE /api/g2g-lms/sessions-calendar/{id} | components/domain/lms/sessions-calendar/sessions-calendar-service.ts:207 (1) |
| 343 | `/api/gemini/analyze-jd` | MATCHED | A | POST /api/gemini/analyze-jd | app/talent-management/_lib/recruitment-api.ts:200 (1) |
| 344 | `/api/general-setup/${module}` | MATCHED | N | GET /api/general-setup/{module} ; POST /api/general-setup/{module} | app/general/api.ts:78 (1) |
| 345 | `/api/get-curriculum-list` | MATCHED | N | GET /api/get-curriculum-list | app/lms/syllabus-plan/api.ts:132 (1) |
| 346 | `/api/get-division-list` | MATCHED | N | GET /api/get-division-list | app/exam/marks-entry/page.tsx:86; components/result/FilterBar.tsx:288 (2) |
| 347 | `/api/get-exam-list` | MATCHED | N | GET /api/get-exam-list | app/exam/marks-entry/page.tsx:115 (1) |
| 348 | `/api/get-exam-master-list` | MATCHED | N | GET /api/get-exam-master-list | app/exam/marks-entry/page.tsx:105 (1) |
| 349 | `/api/get-grade-list` | MATCHED | N | GET /api/get-grade-list | app/exam/marks-entry/page.tsx:76; components/result/FilterBar.tsx:268 (2) |
| 350 | `/api/get-standard-list` | MATCHED | N | GET /api/get-standard-list | app/exam/marks-entry/page.tsx:81; components/result/FilterBar.tsx:278 (2) |
| 351 | `/api/get-subject-list` | MATCHED | N | GET /api/get-subject-list | app/exam/marks-entry/page.tsx:92 (1) |
| 352 | `/api/hostel-dashboard/summary` | MATCHED | N | POST /api/hostel-dashboard/summary | app/api/hostel/dashboard/summary/route.ts:11; app/api/hostel/dashboard/summary/route.ts:88 (2) |
| 353 | `/api/import/match-fields` | MATCHED | A | POST /api/import/match-fields | app/import-data/page.tsx:183 (1) |
| 354 | `/api/import/parse` | MATCHED | A | POST /api/import/parse | app/import-data/page.tsx:151 (1) |
| 355 | `/api/import/process` | MATCHED | A | POST /api/import/process | app/import-data/page.tsx:247 (1) |
| 356 | `/api/import/tables` | MATCHED | A | GET /api/import/tables | app/import-data/page.tsx:99 (1) |
| 357 | `/api/intelligence/curriculum-planning` | MATCHED | N | GET,POST /api/intelligence/curriculum-planning | app/lms/curriculum-planning/page.tsx:82 (1) |
| 358 | `/api/intelligence/curriculum-planning/chapter` | MATCHED | N | GET,POST /api/intelligence/curriculum-planning/chapter | app/lms/curriculum-planning/ChapterDetailPanel.tsx:41 (1) |
| 359 | `/api/intelligence/lesson-plan-detail` | MATCHED | N | GET,POST /api/intelligence/lesson-plan-detail | app/lms/lesson-plan/page.tsx:1075 (1) |
| 360 | `/api/intelligence/lesson-plan-lookup/chapters` | MATCHED | N | GET,POST /api/intelligence/lesson-plan-lookup/chapters | app/lms/lesson-plan/page.tsx:51; app/lms/monthly-plan/page.tsx:445 (2) |
| 361 | `/api/intelligence/lesson-plan-lookup/periods` | MATCHED | N | GET,POST /api/intelligence/lesson-plan-lookup/periods | app/course-master/lesson-plan/[courseId]/page.tsx:1229; app/lms/lesson-plan/page.tsx:82 (3) |
| 362 | `/api/intelligence/lesson-plan-periods` | MATCHED | N | POST /api/intelligence/lesson-plan-periods | app/course-master/lesson-plan/[courseId]/page.tsx:1806; app/lms/lesson-plan/page.tsx:644 (3) |
| 363 | `/api/intelligence/lesson-plan-periods/${lesson.id}/delete` | MATCHED | N | POST /api/intelligence/lesson-plan-periods/{id}/delete | app/lms/lesson-plan/page.tsx:830 (1) |
| 364 | `/api/intelligence/lesson-plan-periods/${lesson.id}/update` | MATCHED | N | POST /api/intelligence/lesson-plan-periods/{id}/update | app/lms/lesson-plan/page.tsx:805 (1) |
| 365 | `/api/intelligence/lesson-plan-periods/${lesson.periodId}/delete` | MATCHED | N | POST /api/intelligence/lesson-plan-periods/{id}/delete | app/lms/monthly-plan/page.tsx:783 (1) |
| 366 | `/api/intelligence/lesson-plan-periods/${lesson.periodId}/update` | MATCHED | N | POST /api/intelligence/lesson-plan-periods/{id}/update | app/lms/monthly-plan/page.tsx:758 (1) |
| 367 | `/api/intelligence/lesson-plans` | MATCHED | N | GET,POST /api/intelligence/lesson-plans | app/course-master/lesson-plan/[courseId]/page.tsx:1280 (1) |
| 368 | `/api/intelligence/monthly-plan` | MATCHED | N | GET,POST /api/intelligence/monthly-plan | app/lms/monthly-plan/page.tsx:933 (1) |
| 369 | `/api/intelligence/questions/generate` | MATCHED | A | POST /api/intelligence/questions/generate | app/course-master/data/chapters.ts:906 (1) |
| 370 | `/api/interview-details` | MATCHED | A | GET /api/interview-details | app/talent-management/_lib/recruitment-api.ts:253 (1) |
| 371 | `/api/interview-panel/delete/${id}` | MATCHED | A | DELETE /api/interview-panel/delete/{id} | app/talent-management/_lib/recruitment-api.ts:308 (1) |
| 372 | `/api/interview-panel/list` | MATCHED | A | GET /api/interview-panel/list | app/talent-management/_lib/recruitment-api.ts:296 (1) |
| 373 | `/api/interview-panel/store` | MATCHED | A | POST /api/interview-panel/store | app/talent-management/_lib/recruitment-api.ts:302 (1) |
| 374 | `/api/interview-panel/update/${id}` | MATCHED | A | PUT /api/interview-panel/update/{id} | app/talent-management/_lib/recruitment-api.ts:305 (1) |
| 375 | `/api/interview-panel/users` | MATCHED | A | GET /api/interview-panel/users | app/talent-management/_lib/recruitment-api.ts:299 (1) |
| 376 | `/api/interview-schedules` | MATCHED | A | POST /api/interview-schedules ; PUT /api/interview-schedules | app/talent-management/_lib/recruitment-api.ts:256 (1) |
| 377 | `/api/interview-schedules/${id}` | MATCHED | A | PUT /api/interview-schedules/{id} | app/talent-management/_lib/recruitment-api.ts:259 (1) |
| 378 | `/api/interviews/${interviewId}/decision` | MATCHED | A | POST /api/interviews/{id}/decision | app/talent-management/_lib/recruitment-api.ts:337 (1) |
| 379 | `/api/inventory/receivables/items` | MATCHED | N | GET /api/inventory/receivables/items ; PUT,PATCH /api/inventory/{module}/{id} ; DELETE /api/inventory/{module}/{id} | app/Inventory/api.ts:129 (1) |
| 380 | `/api/job-applications` | MATCHED | A | GET /api/job-applications ; POST /api/job-applications | app/talent-management/_lib/recruitment-api.ts:225; app/talent-management/_lib/recruitment-api.ts:235 (2) |
| 381 | `/api/job-applications/${id}` | MATCHED | A | GET /api/job-applications/{id} ; PUT /api/job-applications/{id} | app/talent-management/_lib/recruitment-api.ts:231; app/talent-management/_lib/recruitment-api.ts:238 (2) |
| 382 | `/api/job-postings` | MATCHED | A | GET /api/job-postings ; POST /api/job-postings | app/talent-management/_lib/recruitment-api.ts:176; app/talent-management/_lib/recruitment-api.ts:182 (3) |
| 383 | `/api/job-postings/${id}` | MATCHED | A | PUT /api/job-postings/{id} ; DELETE /api/job-postings/{id} | app/talent-management/_lib/recruitment-api.ts:185; app/talent-management/_lib/recruitment-api.ts:197 (3) |
| 384 | `/api/jobroles-by-department` | MATCHED | N | GET /api/jobroles-by-department | app/task-management/_lib/my-tasks-api.ts:334; components/domain/organization/department-management/organization-service.ts:329 (2) |
| 385 | `/api/leave/balances` | MATCHED | N | GET /api/leave/balances | app/hrit/_lib/leave-api.ts:518 (1) |
| 386 | `/api/leave/dashboard` | MATCHED | N | GET /api/leave/dashboard | app/hrit/_lib/leave-api.ts:480 (1) |
| 387 | `/api/leave/department-summary` | MATCHED | N | GET /api/leave/department-summary | app/hrit/_lib/leave-api.ts:492 (1) |
| 388 | `/api/leave/holidays` | MATCHED | N | GET /api/leave/holidays ; POST /api/leave/holidays | app/hrit/_lib/leave-api.ts:653; app/hrit/_lib/leave-api.ts:672 (2) |
| 389 | `/api/leave/holidays/${id}` | MATCHED | N | PUT /api/leave/holidays/{id} ; DELETE /api/leave/holidays/{id} | app/hrit/_lib/leave-api.ts:671; app/hrit/_lib/leave-api.ts:675 (2) |
| 390 | `/api/leave/holidays/upcoming` | MATCHED | N | GET /api/leave/holidays/upcoming ; PUT /api/leave/holidays/{id} ; DELETE /api/leave/holidays/{id} | app/hrit/_lib/leave-api.ts:504 (1) |
| 391 | `/api/leave/leave-types` | MATCHED | N | GET /api/leave/leave-types ; POST /api/leave/leave-types | app/hrit/_lib/leave-api.ts:619; app/hrit/_lib/leave-api.ts:638 (2) |
| 392 | `/api/leave/leave-types/${id}` | MATCHED | N | PUT /api/leave/leave-types/{id} ; DELETE /api/leave/leave-types/{id} | app/hrit/_lib/leave-api.ts:647 (1) |
| 393 | `/api/leave/leave-types/${id}/status` | MATCHED | N | PATCH /api/leave/leave-types/{id}/status | app/hrit/_lib/leave-api.ts:643 (1) |
| 394 | `/api/leave/leave-types/${payload.id}` | MATCHED | N | PUT /api/leave/leave-types/{id} ; DELETE /api/leave/leave-types/{id} | app/hrit/_lib/leave-api.ts:637 (1) |
| 395 | `/api/leave/options` | MATCHED | N | GET /api/leave/options | app/hrit/_lib/leave-api.ts:512 (1) |
| 396 | `/api/leave/reports/balance` | MATCHED | N | GET /api/leave/reports/balance | app/hrit/_lib/leave-api.ts:613 (1) |
| 397 | `/api/leave/reports/register` | MATCHED | N | GET /api/leave/reports/register | app/hrit/_lib/leave-api.ts:607 (1) |
| 398 | `/api/leave/reports/summary` | MATCHED | N | GET /api/leave/reports/summary | app/hrit/_lib/leave-api.ts:601 (1) |
| 399 | `/api/leave/requests` | MATCHED | N | GET /api/leave/requests ; POST /api/leave/requests | app/hrit/_lib/leave-api.ts:526; app/hrit/_lib/leave-api.ts:548 (2) |
| 400 | `/api/leave/requests/${id}` | MATCHED | N | GET /api/leave/requests/{id} ; DELETE /api/leave/requests/{id} | app/hrit/_lib/leave-api.ts:544; app/hrit/_lib/leave-api.ts:595 (2) |
| 401 | `/api/leave/requests/${id}/decision` | MATCHED | N | POST /api/leave/requests/{id}/decision | app/hrit/_lib/leave-api.ts:566 (1) |
| 402 | `/api/leave/requests/bulk-decision` | MATCHED | N | POST /api/leave/requests/bulk-decision ; GET /api/leave/requests/{id} ; DELETE /api/leave/requests/{id} | app/hrit/_lib/leave-api.ts:580 (1) |
| 403 | `/api/leave/roles` | MATCHED | N | GET /api/leave/roles ; PUT /api/leave/roles | app/hrit/_lib/leave-api.ts:703; app/hrit/_lib/leave-api.ts:705 (2) |
| 404 | `/api/leave/trend` | MATCHED | N | GET /api/leave/trend | app/hrit/_lib/leave-api.ts:486 (1) |
| 405 | `/api/leave/type-distribution` | MATCHED | N | GET /api/leave/type-distribution | app/hrit/_lib/leave-api.ts:498 (1) |
| 406 | `/api/leave/weekdays` | MATCHED | N | GET /api/leave/weekdays ; POST /api/leave/weekdays | app/hrit/_lib/leave-api.ts:679; app/hrit/_lib/leave-api.ts:681 (2) |
| 407 | `/api/leave/workflow` | MATCHED | N | GET /api/leave/workflow ; PUT /api/leave/workflow | app/hrit/_lib/leave-api.ts:688; app/hrit/_lib/leave-api.ts:690 (2) |
| 408 | `/api/library-dashboard/summary` | MATCHED | N | POST /api/library-dashboard/summary | app/api/library/dashboard/summary/route.ts:11; app/api/library/dashboard/summary/route.ts:88 (2) |
| 409 | `/api/lms-chapter-concepts` | MATCHED | N | POST /api/lms-chapter-concepts | app/lms/exam/page.tsx:2160 (1) |
| 410 | `/api/lms-chapter-content` | MATCHED | N | POST /api/lms-chapter-content | app/course-master/data/chapters.ts:862 (1) |
| 411 | `/api/lms-chapter-content/upload` | MATCHED | S | POST /api/lms-chapter-content/upload | app/course-master/data/chapters.ts:756; app/course-master/data/chapters.ts:823 (2) |
| 412 | `/api/lms-courses` | MATCHED | N | GET,POST /api/lms-courses | app/course-master/data/lmsCourses.ts:76; app/exam/data/aiPaper.ts:191 (5) |
| 413 | `/api/lms-homework/submission/store` | MATCHED | A | POST /api/lms-homework/submission/store | app/lms/homework/api.ts:992 (1) |
| 414 | `/api/lms-question-bank` | MATCHED | N | POST /api/lms-question-bank | app/course-master/data/chapters.ts:1186; app/h5p/data/question-bank-library.ts:116 (2) |
| 415 | `/api/lms-question-bank/create` | MATCHED | N | POST /api/lms-question-bank/create | app/course-master/data/chapters.ts:1232 (1) |
| 416 | `/api/lms-question-bank/delete` | MATCHED | N | POST /api/lms-question-bank/delete | app/course-master/data/chapters.ts:1328 (1) |
| 417 | `/api/lms-question-bank/review` | MATCHED | N | POST /api/lms-question-bank/review | app/course-master/data/chapters.ts:1303 (1) |
| 418 | `/api/lms-question-bank/update` | MATCHED | N | POST /api/lms-question-bank/update | app/course-master/data/chapters.ts:1273 (1) |
| 419 | `/api/lms-questions` | MATCHED | N | POST /api/lms-questions | app/exam/data/aiPaper.ts:267; app/lms/exam/page.tsx:2263 (2) |
| 420 | `/api/lms-result-dashboard/summary` | MATCHED | A | POST /api/lms-result-dashboard/summary | app/lms/exam/_result-dashboard/api.ts:143 (1) |
| 421 | `/api/lms/${path}` | MATCHED |  |  | app/lms/data/leaderBoard.ts:99 (1) |
| 422 | `/api/lms/coherence-map` | MATCHED | S | GET /api/lms/coherence-map | app/course-master/data/coherenceMap.ts:221 (1) |
| 423 | `/api/lms/coherence-map/concept/${encodeURIComponent(String(conceptEntityId))}` | MATCHED | S | GET /api/lms/coherence-map/concept/{conceptId} | app/course-master/data/coherenceMap.ts:251 (1) |
| 424 | `/api/lms/coherence-map/relations` | MATCHED | S | POST /api/lms/coherence-map/relations | app/course-master/data/coherenceMap.ts:303 (1) |
| 425 | `/api/lms/coherence-map/relations/${sourceTable}/${relationId}` | MATCHED | S | PATCH /api/lms/coherence-map/relations/{source}/{id} ; DELETE /api/lms/coherence-map/relations/{source}/{id} | app/course-master/data/coherenceMap.ts:323; app/course-master/data/coherenceMap.ts:336 (2) |
| 426 | `/api/lms/coherence-map/relations/bulk` | MATCHED | S | POST /api/lms/coherence-map/relations/bulk | app/course-master/data/coherenceMap.ts:348 (1) |
| 427 | `/api/lms/concept-intelligence/tab-labels` | MATCHED | N | GET,POST /api/lms/concept-intelligence/tab-labels | app/course-master/data/conceptIntelligenceTabLabels.ts:21 (1) |
| 428 | `/api/lms/concept-intelligence/tab-labels/reset` | MATCHED | N | POST /api/lms/concept-intelligence/tab-labels/reset | app/course-master/data/conceptIntelligenceTabLabels.ts:23 (1) |
| 429 | `/api/lms/concept-intelligence/tab-labels/update` | MATCHED | N | POST /api/lms/concept-intelligence/tab-labels/update | app/course-master/data/conceptIntelligenceTabLabels.ts:22 (1) |
| 430 | `/api/lms/content/author` | MATCHED | S | POST /api/lms/content/author | app/course-master/data/authoring.ts:86; app/course-master/data/authoring.ts:166 (2) |
| 431 | `/api/lms/content/authoring-vocabulary` | MATCHED | S | GET /api/lms/content/authoring-vocabulary | app/course-master/data/authoring.ts:85; app/course-master/data/authoring.ts:109 (2) |
| 432 | `/api/lms/gamma-content-master` | MATCHED | N | POST /api/lms/gamma-content-master | app/course-master/[courseId]/chapters/sideDrawer.tsx:783 (1) |
| 433 | `/api/lms/social-collaborative/lookups/chapters` | MATCHED | A | GET /api/lms/social-collaborative/lookups/chapters | app/lms/data/socialCollaborative.ts:289 (1) |
| 434 | `/api/lms/social-collaborative/lookups/subjects` | MATCHED | A | GET /api/lms/social-collaborative/lookups/subjects | app/lms/data/socialCollaborative.ts:282 (1) |
| 435 | `/api/lms/social-collaborative/lookups/topics` | MATCHED | A | GET /api/lms/social-collaborative/lookups/topics | app/lms/data/socialCollaborative.ts:300 (1) |
| 436 | `/api/master-menu-rights` | MATCHED | N | GET /api/master-menu-rights | app/components/DashboardShell.tsx:437 (1) |
| 437 | `/api/mcp/health` | MATCHED | A | GET /api/mcp/health | lib/ai/mcp-client.ts:87 (1) |
| 438 | `/api/mcp/initialize` | MATCHED | A | POST /api/mcp/initialize | lib/ai/mcp-client.ts:91 (1) |
| 439 | `/api/mcp/tools` | MATCHED | A | GET /api/mcp/tools | lib/ai/mcp-client.ts:108 (1) |
| 440 | `/api/mcp/tools/call` | MATCHED | A | POST /api/mcp/tools/call | lib/ai/mcp-client.ts:119 (1) |
| 441 | `/api/menu-rights` | MATCHED | N | POST /api/menu-rights | app/general/onboarding/api.ts:356; app/hooks/useMenuRights.ts:131 (2) |
| 442 | `/api/migration-modules/${module}` | MATCHED | N | GET /api/migration-modules/{module} ; POST /api/migration-modules/{module} | app/migration-modules/MigrationModulePage.tsx:25 (1) |
| 443 | `/api/migration-modules/bazar-upload` | MATCHED | N | GET /api/migration-modules/{module} ; POST /api/migration-modules/{module} | app/bazar/bulk-upload/BazarUploadPage.tsx:38 (1) |
| 444 | `/api/mobile-page-builder/${path}` | MATCHED |  |  | app/general/mobile_page_builder/api.ts:43 (1) |
| 445 | `/api/mobile-page-builder/pages/${id}/assets` | MATCHED | A | POST /api/mobile-page-builder/pages/{id}/assets | app/general/mobile_page_builder/api.ts:188 (1) |
| 446 | `/api/mobile/web-handoff/claims` | MATCHED | N | GET /api/mobile/web-handoff/claims | contexts/AuthContext.tsx:282 (1) |
| 447 | `/api/mobility/applications` | MATCHED | A | GET /api/mobility/applications ; POST /api/mobility/applications | app/talent-management/_lib/mobility-api.ts:294; app/talent-management/_lib/mobility-api.ts:298 (2) |
| 448 | `/api/mobility/applications/${id}` | MATCHED | A | PUT /api/mobility/applications/{id} | app/talent-management/_lib/mobility-api.ts:303 (1) |
| 449 | `/api/mobility/filters` | MATCHED | A | GET /api/mobility/filters | app/talent-management/_lib/mobility-api.ts:270 (1) |
| 450 | `/api/mobility/jobs` | MATCHED | A | GET /api/mobility/jobs ; POST /api/mobility/jobs | app/talent-management/_lib/mobility-api.ts:275; app/talent-management/_lib/mobility-api.ts:279 (2) |
| 451 | `/api/mobility/jobs/${id}` | MATCHED | A | GET /api/mobility/jobs/{id} ; PUT /api/mobility/jobs/{id} ; DELETE /api/mobility/jobs/{id} | app/talent-management/_lib/mobility-api.ts:284; app/talent-management/_lib/mobility-api.ts:289 (2) |
| 452 | `/api/mobility/overview` | MATCHED | A | GET /api/mobility/overview | app/talent-management/_lib/mobility-api.ts:267 (1) |
| 453 | `/api/mobility/pools` | MATCHED | A | GET /api/mobility/pools ; POST /api/mobility/pools | app/talent-management/_lib/mobility-api.ts:364; app/talent-management/_lib/mobility-api.ts:368 (2) |
| 454 | `/api/mobility/pools/${poolId}/members` | MATCHED | A | GET /api/mobility/pools/{id}/members ; POST /api/mobility/pools/{id}/members | app/talent-management/_lib/mobility-api.ts:373; app/talent-management/_lib/mobility-api.ts:375 (2) |
| 455 | `/api/mobility/pools/${poolId}/members/${userId}` | MATCHED | A | DELETE /api/mobility/pools/{id}/members/{userId} | app/talent-management/_lib/mobility-api.ts:380 (1) |
| 456 | `/api/mobility/promotions` | MATCHED | A | GET /api/mobility/promotions ; POST /api/mobility/promotions | app/talent-management/_lib/mobility-api.ts:328; app/talent-management/_lib/mobility-api.ts:332 (2) |
| 457 | `/api/mobility/promotions/${id}` | MATCHED | A | PUT /api/mobility/promotions/{id} | app/talent-management/_lib/mobility-api.ts:337 (1) |
| 458 | `/api/mobility/successions` | MATCHED | A | GET /api/mobility/successions ; POST /api/mobility/successions | app/talent-management/_lib/mobility-api.ts:345; app/talent-management/_lib/mobility-api.ts:349 (2) |
| 459 | `/api/mobility/successions/${id}` | MATCHED | A | PUT /api/mobility/successions/{id} ; DELETE /api/mobility/successions/{id} | app/talent-management/_lib/mobility-api.ts:354; app/talent-management/_lib/mobility-api.ts:359 (2) |
| 460 | `/api/mobility/transfers` | MATCHED | A | GET /api/mobility/transfers ; POST /api/mobility/transfers | app/talent-management/_lib/mobility-api.ts:311; app/talent-management/_lib/mobility-api.ts:315 (2) |
| 461 | `/api/mobility/transfers/${id}` | MATCHED | A | PUT /api/mobility/transfers/{id} | app/talent-management/_lib/mobility-api.ts:320 (1) |
| 462 | `/api/monthly-payroll-store` | ALT | A | POST /monthly-payroll-store | app/hrit/_lib/payroll-api.ts:792 (1) |
| 463 | `/api/offboarding/cases` | MATCHED | A | GET /api/offboarding/cases ; POST /api/offboarding/cases | app/talent-management/_lib/offboarding-api.ts:262 (1) |
| 464 | `/api/offboarding/cases/${id}` | MATCHED | A | GET /api/offboarding/cases/{id} ; PUT /api/offboarding/cases/{id} ; DELETE /api/offboarding/cases/{id} | app/talent-management/_lib/offboarding-api.ts:259; app/talent-management/_lib/offboarding-api.ts:265 (3) |
| 465 | `/api/offboarding/cases/${id}/clearance` | MATCHED | A | POST /api/offboarding/cases/{id}/clearance | app/talent-management/_lib/offboarding-api.ts:271 (1) |
| 466 | `/api/offboarding/cases/${id}/comments` | MATCHED | A | POST /api/offboarding/cases/{id}/comments | app/talent-management/_lib/offboarding-api.ts:277 (1) |
| 467 | `/api/offboarding/cases/${id}/documents` | MATCHED | A | POST /api/offboarding/cases/{id}/documents | app/talent-management/_lib/offboarding-api.ts:274 (1) |
| 468 | `/api/offboarding/cases/${id}/exit-interview` | MATCHED | A | POST /api/offboarding/cases/{id}/exit-interview | app/talent-management/_lib/offboarding-api.ts:283 (1) |
| 469 | `/api/offboarding/cases/${id}/status` | MATCHED | A | POST /api/offboarding/cases/{id}/status | app/talent-management/_lib/offboarding-api.ts:268 (1) |
| 470 | `/api/offboarding/filters` | MATCHED | A | GET /api/offboarding/filters | app/talent-management/_lib/offboarding-api.ts:249 (1) |
| 471 | `/api/offers` | MATCHED | A | GET /api/offers | app/talent-management/_lib/recruitment-api.ts:262 (1) |
| 472 | `/api/onboarding-modules/${path}` | MATCHED |  |  | app/general/onboarding/_lib/onboarding-api.ts:577 (1) |
| 473 | `/api/onboarding/documents/${id}` | MATCHED | A | PUT,POST /api/onboarding/documents/{id} ; DELETE /api/onboarding/documents/{id} | app/talent-management/_lib/onboarding-api.ts:741; app/talent-management/_lib/onboarding-api.ts:750 (3) |
| 474 | `/api/onboarding/filters` | MATCHED | A | GET /api/onboarding/filters | app/talent-management/_lib/onboarding-api.ts:618 (1) |
| 475 | `/api/onboarding/journeys` | MATCHED | A | GET /api/onboarding/journeys ; POST /api/onboarding/journeys | app/talent-management/_lib/onboarding-api.ts:624; app/talent-management/_lib/onboarding-api.ts:630 (2) |
| 476 | `/api/onboarding/journeys/${id}` | MATCHED | A | GET /api/onboarding/journeys/{id} ; PUT /api/onboarding/journeys/{id} ; DELETE /api/onboarding/journeys/{id} | app/talent-management/_lib/onboarding-api.ts:628; app/talent-management/_lib/onboarding-api.ts:641 (3) |
| 477 | `/api/onboarding/journeys/${journeyId}/contacts` | MATCHED | A | GET /api/onboarding/journeys/{journeyId}/contacts | app/talent-management/_lib/onboarding-api.ts:670 (1) |
| 478 | `/api/onboarding/journeys/${journeyId}/documents` | MATCHED | A | GET /api/onboarding/journeys/{journeyId}/documents ; POST /api/onboarding/journeys/{journeyId}/documents | app/talent-management/_lib/onboarding-api.ts:727; app/talent-management/_lib/onboarding-api.ts:729 (3) |
| 479 | `/api/onboarding/journeys/${journeyId}/notes` | MATCHED | A | GET /api/onboarding/journeys/{journeyId}/notes ; POST /api/onboarding/journeys/{journeyId}/notes | app/talent-management/_lib/onboarding-api.ts:757; app/talent-management/_lib/onboarding-api.ts:759 (2) |
| 480 | `/api/onboarding/journeys/${journeyId}/stages` | MATCHED | A | GET /api/onboarding/journeys/{journeyId}/stages | app/talent-management/_lib/onboarding-api.ts:652 (1) |
| 481 | `/api/onboarding/journeys/${journeyId}/timeline` | MATCHED | A | GET /api/onboarding/journeys/{journeyId}/timeline | app/talent-management/_lib/onboarding-api.ts:676 (1) |
| 482 | `/api/onboarding/journeys/from-offer/${offerId}` | MATCHED | A | POST /api/onboarding/journeys/from-offer/{offerId} | app/talent-management/_lib/onboarding-api.ts:637 (1) |
| 483 | `/api/onboarding/notes/${id}` | MATCHED | A | PUT /api/onboarding/notes/{id} ; DELETE /api/onboarding/notes/{id} | app/talent-management/_lib/onboarding-api.ts:764; app/talent-management/_lib/onboarding-api.ts:769 (2) |
| 484 | `/api/onboarding/overview` | MATCHED | A | GET /api/onboarding/overview | app/talent-management/_lib/onboarding-api.ts:614 (1) |
| 485 | `/api/onboarding/probation` | MATCHED | A | GET /api/onboarding/probation | app/talent-management/_lib/onboarding-api.ts:775 (1) |
| 486 | `/api/onboarding/probation/${journeyId}` | MATCHED | A | PUT /api/onboarding/probation/{journeyId} | app/talent-management/_lib/onboarding-api.ts:783 (1) |
| 487 | `/api/onboarding/probation/${journeyId}/${decision}` | MATCHED |  |  | app/talent-management/_lib/onboarding-api.ts:793 (1) |
| 488 | `/api/onboarding/stages/${id}` | MATCHED | A | PUT /api/onboarding/stages/{id} | app/talent-management/_lib/onboarding-api.ts:656 (1) |
| 489 | `/api/onboarding/stages/${id}/complete` | MATCHED | A | POST /api/onboarding/stages/{id}/complete | app/talent-management/_lib/onboarding-api.ts:661 (1) |
| 490 | `/api/onboarding/tasks` | MATCHED | A | GET /api/onboarding/tasks ; POST /api/onboarding/tasks | app/talent-management/_lib/onboarding-api.ts:684; app/talent-management/_lib/onboarding-api.ts:688 (2) |
| 491 | `/api/onboarding/tasks/${id}` | MATCHED | A | PUT /api/onboarding/tasks/{id} ; DELETE /api/onboarding/tasks/{id} | app/talent-management/_lib/onboarding-api.ts:693; app/talent-management/_lib/onboarding-api.ts:703 (2) |
| 492 | `/api/onboarding/tasks/${id}/complete` | MATCHED | A | POST /api/onboarding/tasks/{id}/complete | app/talent-management/_lib/onboarding-api.ts:698 (1) |
| 493 | `/api/onboarding/tasks/bulk` | MATCHED | A | POST /api/onboarding/tasks/bulk ; PUT /api/onboarding/tasks/{id} ; DELETE /api/onboarding/tasks/{id} | app/talent-management/_lib/onboarding-api.ts:710 (1) |
| 494 | `/api/onboarding/workstreams` | MATCHED | A | GET /api/onboarding/workstreams | app/talent-management/_lib/onboarding-api.ts:719 (1) |
| 495 | `/api/organization-management/compliance-library` | MATCHED | A | GET /api/organization-management/compliance-library ; POST /api/organization-management/compliance-library | app/organization-management/_lib/compliance-library-api.ts:370; app/organization-management/_lib/compliance-library-api.ts:423 (2) |
| 496 | `/api/organization-management/compliance-library/${id}` | MATCHED | A | GET /api/organization-management/compliance-library/{id} ; PUT,POST /api/organization-management/compliance-library/{id} ; DELETE /api/organization-management/compliance-library/{id} | app/organization-management/_lib/compliance-library-api.ts:378; app/organization-management/_lib/compliance-library-api.ts:442 (3) |
| 497 | `/api/organization-management/compliance-library/${id}/complete` | MATCHED | A | POST /api/organization-management/compliance-library/{id}/complete | app/organization-management/_lib/compliance-library-api.ts:459 (1) |
| 498 | `/api/organization-management/compliance-library/${id}/evidence` | MATCHED | A | GET /api/organization-management/compliance-library/{id}/evidence ; POST /api/organization-management/compliance-library/{id}/evidence | app/organization-management/_lib/compliance-library-api.ts:467; app/organization-management/_lib/compliance-library-api.ts:488 (2) |
| 499 | `/api/organization-management/compliance-library/calendar` | MATCHED | A | GET /api/organization-management/compliance-library/calendar ; GET /api/organization-management/compliance-library/{id} ; PUT,POST /api/organization-management/compliance-library/{id} ...(+1) | app/organization-management/_lib/compliance-library-api.ts:394 (1) |
| 500 | `/api/organization-management/compliance-library/categories` | MATCHED | A | GET /api/organization-management/compliance-library/categories ; POST /api/organization-management/compliance-library/categories ; GET /api/organization-management/compliance-library/{id} ...(+2) | app/organization-management/_lib/compliance-library-api.ts:522; app/organization-management/_lib/compliance-library-api.ts:529 (2) |
| 501 | `/api/organization-management/compliance-library/categories/${id}` | MATCHED | A | PUT,POST /api/organization-management/compliance-library/categories/{id} ; DELETE /api/organization-management/compliance-library/categories/{id} | app/organization-management/_lib/compliance-library-api.ts:536; app/organization-management/_lib/compliance-library-api.ts:543 (2) |
| 502 | `/api/organization-management/compliance-library/dashboard` | MATCHED | A | GET /api/organization-management/compliance-library/dashboard ; GET /api/organization-management/compliance-library/{id} ; PUT,POST /api/organization-management/compliance-library/{id} ...(+1) | app/organization-management/_lib/compliance-library-api.ts:386 (1) |
| 503 | `/api/organization-management/compliance-library/evidence/${evidenceId}` | MATCHED | A | DELETE /api/organization-management/compliance-library/evidence/{evidenceId} | app/organization-management/_lib/compliance-library-api.ts:513 (1) |
| 504 | `/api/organization-management/compliance-library/evidence/${evidenceId}/reject` | MATCHED | A | POST /api/organization-management/compliance-library/evidence/{evidenceId}/reject | app/organization-management/_lib/compliance-library-api.ts:505 (1) |
| 505 | `/api/organization-management/compliance-library/evidence/${evidenceId}/verify` | MATCHED | A | POST /api/organization-management/compliance-library/evidence/{evidenceId}/verify | app/organization-management/_lib/compliance-library-api.ts:497 (1) |
| 506 | `/api/organization-management/compliance-library/my` | MATCHED | A | GET /api/organization-management/compliance-library/my ; GET /api/organization-management/compliance-library/{id} ; PUT,POST /api/organization-management/compliance-library/{id} ...(+1) | app/organization-management/_lib/compliance-library-api.ts:402 (1) |
| 507 | `/api/organization-management/compliance-library/overdue` | MATCHED | A | GET /api/organization-management/compliance-library/overdue ; GET /api/organization-management/compliance-library/{id} ; PUT,POST /api/organization-management/compliance-library/{id} ...(+1) | app/organization-management/_lib/compliance-library-api.ts:410 (1) |
| 508 | `/api/organization-management/compliance-library/templates` | MATCHED | A | GET /api/organization-management/compliance-library/templates ; POST /api/organization-management/compliance-library/templates ; GET /api/organization-management/compliance-library/{id} ...(+2) | app/organization-management/_lib/compliance-library-api.ts:552; app/organization-management/_lib/compliance-library-api.ts:559 (2) |
| 509 | `/api/organization-management/compliance-library/templates/${id}` | MATCHED | A | PUT,POST /api/organization-management/compliance-library/templates/{id} ; DELETE /api/organization-management/compliance-library/templates/{id} | app/organization-management/_lib/compliance-library-api.ts:566; app/organization-management/_lib/compliance-library-api.ts:580 (2) |
| 510 | `/api/organization-management/compliance-library/templates/${id}/duplicate` | MATCHED | A | POST /api/organization-management/compliance-library/templates/{id}/duplicate | app/organization-management/_lib/compliance-library-api.ts:573 (1) |
| 511 | `/api/organization-management/disciplinary-library` | MATCHED | A | GET /api/organization-management/disciplinary-library ; POST /api/organization-management/disciplinary-library | app/organization-management/_lib/disciplinary-library-api.ts:160; app/organization-management/_lib/disciplinary-library-api.ts:166 (2) |
| 512 | `/api/organization-management/disciplinary-library/${id}` | MATCHED | A | PUT,POST /api/organization-management/disciplinary-library/{id} ; DELETE /api/organization-management/disciplinary-library/{id} | app/organization-management/_lib/disciplinary-library-api.ts:173; app/organization-management/_lib/disciplinary-library-api.ts:182 (2) |
| 513 | `/api/organization-management/disciplinary-library/departments/${encodeURIComponent(department)}/employees` | MATCHED | A | GET /api/organization-management/disciplinary-library/departments/{department}/employees | app/organization-management/_lib/disciplinary-library-api.ts:190 (1) |
| 514 | `/api/organization-management/employee-directory` | MATCHED | A | GET /api/organization-management/employee-directory ; POST /api/organization-management/employee-directory | app/organization-management/_lib/employee-directory-api.ts:221 (1) |
| 515 | `/api/organization-management/employee-directory/${id}` | MATCHED | A | GET /api/organization-management/employee-directory/{id} ; PUT /api/organization-management/employee-directory/{id} ; DELETE /api/organization-management/employee-directory/{id} | app/organization-management/_lib/employee-directory-api.ts:235; app/organization-management/_lib/employee-directory-api.ts:260 (2) |
| 516 | `/api/organization-management/employee-directory/${id}/competency-profile` | MATCHED | A | GET /api/organization-management/employee-directory/{id}/competency-profile | app/organization-management/_lib/employee-directory-api.ts:272 (1) |
| 517 | `/api/organization-management/employee-directory/${id}/documents` | MATCHED | A | POST /api/organization-management/employee-directory/{id}/documents | app/organization-management/_lib/employee-directory-api.ts:267 (1) |
| 518 | `/api/organization-management/employee-directory/${id}/skills/${matrixId}` | MATCHED | A | PUT /api/organization-management/employee-directory/{id}/skills/{matrixId} | app/organization-management/_lib/employee-directory-api.ts:300 (1) |
| 519 | `/api/organization-management/employee-directory/${id}/status` | MATCHED | A | PATCH /api/organization-management/employee-directory/{id}/status | app/organization-management/_lib/employee-directory-api.ts:253 (1) |
| 520 | `/api/organization-management/employee-directory/analytics/attrition` | MATCHED | A | GET /api/organization-management/employee-directory/analytics/attrition | app/organization-management/_lib/employee-directory-api.ts:342 (1) |
| 521 | `/api/organization-management/employee-directory/analytics/departments-distribution` | MATCHED | A | GET /api/organization-management/employee-directory/analytics/departments-distribution | app/organization-management/_lib/employee-directory-api.ts:336 (1) |
| 522 | `/api/organization-management/employee-directory/analytics/growth` | MATCHED | A | GET /api/organization-management/employee-directory/analytics/growth | app/organization-management/_lib/employee-directory-api.ts:332 (1) |
| 523 | `/api/organization-management/employee-directory/analytics/growth-stacked` | MATCHED | A | GET /api/organization-management/employee-directory/analytics/growth-stacked | app/organization-management/_lib/employee-directory-api.ts:334 (1) |
| 524 | `/api/organization-management/employee-directory/analytics/job-roles-distribution` | MATCHED | A | GET /api/organization-management/employee-directory/analytics/job-roles-distribution | app/organization-management/_lib/employee-directory-api.ts:338 (1) |
| 525 | `/api/organization-management/employee-directory/analytics/kpis` | MATCHED | A | GET /api/organization-management/employee-directory/analytics/kpis | app/organization-management/_lib/employee-directory-api.ts:330 (1) |
| 526 | `/api/organization-management/employee-directory/analytics/lifecycle` | MATCHED | A | GET /api/organization-management/employee-directory/analytics/lifecycle | app/organization-management/_lib/employee-directory-api.ts:340 (1) |
| 527 | `/api/organization-management/employee-directory/analytics/skills-matrix` | MATCHED | A | GET /api/organization-management/employee-directory/analytics/skills-matrix | app/organization-management/_lib/employee-directory-api.ts:275; app/organization-management/_lib/employee-directory-api.ts:344 (2) |
| 528 | `/api/organization-management/employee-directory/create` | MATCHED | A | POST /api/organization-management/employee-directory/create ; GET /api/organization-management/employee-directory/{id} ; PUT /api/organization-management/employee-directory/{id} ...(+1) | app/organization-management/_lib/employee-directory-api.ts:249 (1) |
| 529 | `/api/organization-management/employee-directory/reference-data` | MATCHED | A | GET /api/organization-management/employee-directory/reference-data ; GET /api/organization-management/employee-directory/{id} ; PUT /api/organization-management/employee-directory/{id} ...(+1) | app/organization-management/_lib/employee-directory-api.ts:243 (1) |
| 530 | `/api/organization-management/role-permissions/roles` | MATCHED | A | GET /api/organization-management/role-permissions/roles ; POST /api/organization-management/role-permissions/roles | app/organization-management/_lib/role-permissions-api.ts:117; app/organization-management/_lib/role-permissions-api.ts:139 (2) |
| 531 | `/api/organization-management/role-permissions/roles/${profileId}/rights` | MATCHED | A | GET /api/organization-management/role-permissions/roles/{id}/rights ; POST /api/organization-management/role-permissions/roles/{id}/rights | app/organization-management/_lib/role-permissions-api.ts:126; app/organization-management/_lib/role-permissions-api.ts:134 (2) |
| 532 | `/api/pal/coherence/health` | MATCHED | A | GET /api/pal/coherence/health | app/pal/new/data/coherence-map.ts:375 (1) |
| 533 | `/api/pal/coherence/learner/${learnerId}` | MATCHED | A | GET /api/pal/coherence/learner/{learnerId} | app/pal/new/data/coherence-map.ts:409 (1) |
| 534 | `/api/pal/coherence/map` | MATCHED | A | GET /api/pal/coherence/map | app/pal/new/data/coherence-map.ts:362 (1) |
| 535 | `/api/pal/coherence/next/${learnerId}` | MATCHED | A | GET /api/pal/coherence/next/{learnerId} | app/pal/new/data/coherence-map.ts:440 (1) |
| 536 | `/api/pal/coherence/scopes` | MATCHED | A | GET /api/pal/coherence/scopes | app/pal/new/data/coherence-map.ts:330 (1) |
| 537 | `/api/pal/content/coverage` | MATCHED | A | GET /api/pal/content/coverage | app/pal/data/pal-content.ts:165 (1) |
| 538 | `/api/pal/content/ladder/${conceptId}` | MATCHED | A | GET /api/pal/content/ladder/{conceptId} | app/pal/data/pal-content.ts:509 (1) |
| 539 | `/api/pal/content/metadata/${entityType}/${entityId}` | MATCHED | A | GET /api/pal/content/metadata/{entityType}/{entityId} ; POST /api/pal/content/metadata/{entityType}/{entityId} | app/pal/data/pal-content.ts:322 (1) |
| 540 | `/api/pal/content/misconception/health` | MATCHED | A | GET /api/pal/content/misconception/health | app/pal/data/pal-content.ts:492 (1) |
| 541 | `/api/pal/content/misconceptions` | MATCHED | A | GET /api/pal/content/misconceptions ; POST /api/pal/content/misconceptions | app/pal/data/pal-content.ts:414 (1) |
| 542 | `/api/pal/content/misconceptions/${id}` | MATCHED | A | GET /api/pal/content/misconceptions/{id} | app/pal/data/pal-content.ts:447 (1) |
| 543 | `/api/pal/content/review-queue/${entityType}` | MATCHED | A | GET /api/pal/content/review-queue/{entityType} | app/pal/data/pal-content.ts:285 (1) |
| 544 | `/api/pal/content/review/${entityType}/bulk` | MATCHED | A | POST /api/pal/content/review/{entityType}/bulk ; POST /api/pal/content/review/{entityType}/{metadataId} | app/pal/data/pal-content.ts:347 (1) |
| 545 | `/api/pal/content/vocabulary` | MATCHED | A | GET /api/pal/content/vocabulary | app/pal/data/pal-content.ts:199 (1) |
| 546 | `/api/pal/eso/cfu-items/${learnerId}/${nodeId}` | MATCHED | A | GET /api/pal/eso/cfu-items/{learnerId}/{nodeId} | app/pal/data/pal-eso.ts:648 (1) |
| 547 | `/api/pal/eso/cfu/${learnerId}/${nodeId}/check` | MATCHED | A | POST /api/pal/eso/cfu/{learnerId}/{nodeId}/check | app/pal/data/pal-eso.ts:669 (1) |
| 548 | `/api/pal/eso/chapter-concepts/${chapterId}` | MATCHED | A | GET /api/pal/eso/chapter-concepts/{chapterId} | app/pal/data/pal-eso.ts:786 (1) |
| 549 | `/api/pal/eso/chapter-dashboard/${learnerId}/${chapterId}` | MATCHED | A | GET /api/pal/eso/chapter-dashboard/{learnerId}/{chapterId} | app/pal/data/pal-eso.ts:940 (1) |
| 550 | `/api/pal/eso/concept-mastery-details/${learnerId}/${conceptId}` | MATCHED | A | GET /api/pal/eso/concept-mastery-details/{learnerId}/{conceptId} | app/pal/data/pal-eso.ts:1122 (1) |
| 551 | `/api/pal/eso/decision-log/${learnerId}/${conceptId}` | MATCHED | A | GET /api/pal/eso/decision-log/{learnerId}/{conceptId} | app/pal/data/pal-eso.ts:712 (1) |
| 552 | `/api/pal/eso/diagnostic/${learnerId}/${conceptId}` | MATCHED | A | GET /api/pal/eso/diagnostic/{learnerId}/{conceptId} | app/pal/data/pal-eso.ts:522 (1) |
| 553 | `/api/pal/eso/diagnostic/${learnerId}/${conceptId}/submit` | MATCHED | A | POST /api/pal/eso/diagnostic/{learnerId}/{conceptId}/submit | app/pal/data/pal-eso.ts:567 (1) |
| 554 | `/api/pal/eso/due-for-retrieval/${learnerId}` | MATCHED | A | GET /api/pal/eso/due-for-retrieval/{learnerId} | app/pal/data/pal-eso.ts:679 (1) |
| 555 | `/api/pal/eso/knowledge-map/${learnerId}/${conceptId}` | MATCHED | A | GET /api/pal/eso/knowledge-map/{learnerId}/{conceptId} | app/pal/data/pal-eso.ts:1276 (1) |
| 556 | `/api/pal/eso/learning-path/${learnerId}` | MATCHED | A | GET /api/pal/eso/learning-path/{learnerId} | app/pal/data/pal-eso.ts:1370 (1) |
| 557 | `/api/pal/eso/next-action/${learnerId}/${conceptId}` | MATCHED | A | GET /api/pal/eso/next-action/{learnerId}/{conceptId} | app/pal/data/pal-eso.ts:582 (1) |
| 558 | `/api/pal/eso/practice-item/${learnerId}/${nodeId}` | MATCHED | A | GET /api/pal/eso/practice-item/{learnerId}/{nodeId} | app/pal/data/pal-eso.ts:589 (1) |
| 559 | `/api/pal/eso/practice/${learnerId}/${nodeId}/attempt` | MATCHED | A | POST /api/pal/eso/practice/{learnerId}/{nodeId}/attempt | app/pal/data/pal-eso.ts:623 (1) |
| 560 | `/api/pal/eso/render` | MATCHED | A | POST /api/pal/eso/render | app/pal/data/pal-eso.ts:759 (1) |
| 561 | `/api/pal/eso/reports/attainment` | MATCHED | A | GET /api/pal/eso/reports/attainment | app/pal/data/pal-eso.ts:1543 (1) |
| 562 | `/api/pal/eso/retrieval-items/${learnerId}/${nodeId}` | MATCHED | A | GET /api/pal/eso/retrieval-items/{learnerId}/{nodeId} | app/pal/data/pal-eso.ts:688 (1) |
| 563 | `/api/pal/eso/retrieval/${learnerId}/${nodeId}/check` | MATCHED | A | POST /api/pal/eso/retrieval/{learnerId}/{nodeId}/check | app/pal/data/pal-eso.ts:702 (1) |
| 564 | `/api/pal/eso/student-dashboard/${learnerId}` | MATCHED | A | GET /api/pal/eso/student-dashboard/{learnerId} | app/pal/data/pal-eso.ts:956 (1) |
| 565 | `/api/pal/eso/tutor-context/${learnerId}/${conceptId}` | MATCHED | A | GET /api/pal/eso/tutor-context/{learnerId}/{conceptId} | app/pal/data/pal-eso.ts:1460 (1) |
| 566 | `/api/pal/h5p/chapter-model` | MATCHED | A | GET /api/pal/h5p/chapter-model | app/h5p/data/h5p-model.ts:673 (1) |
| 567 | `/api/pal/h5p/hub` | MATCHED | A | GET /api/pal/h5p/hub | app/h5p/data/h5p-model.ts:413 (1) |
| 568 | `/api/pal/h5p/insights` | MATCHED | A | GET /api/pal/h5p/insights | app/h5p/data/h5p-model.ts:1117 (1) |
| 569 | `/api/pal/h5p/nodes/${h5pType}/${nodeId}/tags` | MATCHED | A | POST /api/pal/h5p/nodes/{h5pType}/{nodeId}/tags | app/h5p/data/h5p-model.ts:799 (1) |
| 570 | `/api/pal/h5p/nodes/${h5pType}/${nodeId}/transition` | MATCHED | A | POST /api/pal/h5p/nodes/{h5pType}/{nodeId}/transition | app/h5p/data/h5p-model.ts:810 (1) |
| 571 | `/api/pal/h5p/pedagogy/select` | MATCHED | A | GET /api/pal/h5p/pedagogy/select | app/h5p/data/h5p-model.ts:751 (1) |
| 572 | `/api/pal/h5p/registry` | MATCHED | A | GET /api/pal/h5p/registry | app/h5p/data/h5p-model.ts:203 (1) |
| 573 | `/api/pal/h5p/suggest-tags` | MATCHED | A | POST /api/pal/h5p/suggest-tags | app/h5p/data/h5p-model.ts:840 (1) |
| 574 | `/api/pal/h5p/xapi` | MATCHED | A | POST /api/pal/h5p/xapi | app/h5p/data/h5p.ts:582 (1) |
| 575 | `/api/pal/learner-state/${encodeURIComponent(learnerId)}` | MATCHED | A | GET /api/pal/learner-state/{learnerId} | app/pal/data/pal-v4.ts:186 (1) |
| 576 | `/api/pal/mastery-map/${session.userId}` | MATCHED | A | GET /api/pal/mastery-map/{learnerId} | app/lms/exam/page.tsx:2029 (1) |
| 577 | `/api/pal/misconception/cluster/${encodeURIComponent(conceptId)}` | MATCHED | A | GET /api/pal/misconception/cluster/{conceptId} | app/pal/data/pal-v4.ts:439 (1) |
| 578 | `/api/pal/new/administration` | MATCHED | A | GET /api/pal/new/administration | app/pal/new/data/administration.ts:208 (1) |
| 579 | `/api/pal/new/administration/${encodeURIComponent(key)}` | MATCHED | A | GET /api/pal/new/administration/{subsystem} ; POST /api/pal/new/administration/{subsystem} | app/pal/new/data/administration.ts:569; app/pal/new/data/administration.ts:584 (2) |
| 580 | `/api/pal/new/administration/${encodeURIComponent(key)}/reset` | MATCHED | A | POST /api/pal/new/administration/{subsystem}/reset | app/pal/new/data/administration.ts:599 (1) |
| 581 | `/api/pal/new/content-model/chapters` | MATCHED | A | GET /api/pal/new/content-model/chapters | app/pal/new/data/content-model.ts:416 (1) |
| 582 | `/api/pal/new/content-model/chapters/${semanticId}` | MATCHED | A | GET /api/pal/new/content-model/chapters/{semanticId} | app/pal/new/data/content-model.ts:479 (1) |
| 583 | `/api/pal/new/content-model/chapters/${semanticId}/concepts/${conceptSlug}` | MATCHED | A | GET /api/pal/new/content-model/chapters/{semanticId}/concepts/{conceptSlug} | app/pal/new/data/content-model.ts:872 (1) |
| 584 | `/api/pal/new/content-model/chapters/${semanticId}/misconceptions` | MATCHED | A | GET /api/pal/new/content-model/chapters/{semanticId}/misconceptions | app/pal/new/data/content-model.ts:1040 (1) |
| 585 | `/api/pal/new/content-model/coverage` | MATCHED | A | GET /api/pal/new/content-model/coverage | app/pal/new/data/content-model.ts:308 (1) |
| 586 | `/api/pal/new/content-model/nodes/${nodeKey}` | MATCHED | A | GET /api/pal/new/content-model/nodes/{nodeKey} ; POST /api/pal/new/content-model/nodes/{nodeKey} | app/pal/new/data/content-model.ts:1110; app/pal/new/data/content-model.ts:1150 (2) |
| 587 | `/api/pal/new/content-model/nodes/${nodeKey}/enrich` | MATCHED | A | POST /api/pal/new/content-model/nodes/{nodeKey}/enrich | app/pal/new/data/content-model.ts:1209 (1) |
| 588 | `/api/pal/new/content-model/nodes/${nodeKey}/restore` | MATCHED | A | POST /api/pal/new/content-model/nodes/{nodeKey}/restore | app/pal/new/data/content-model.ts:1180 (1) |
| 589 | `/api/pal/new/content-model/nodes/${nodeKey}/transition` | MATCHED | A | POST /api/pal/new/content-model/nodes/{nodeKey}/transition | app/pal/new/data/content-model.ts:1164 (1) |
| 590 | `/api/pal/new/content-model/nodes/${nodeKey}/translate` | MATCHED | A | POST /api/pal/new/content-model/nodes/{nodeKey}/translate | app/pal/new/data/content-model.ts:1243 (1) |
| 591 | `/api/pal/new/content-model/nodes/bulk-transition` | MATCHED | A | POST /api/pal/new/content-model/nodes/bulk-transition ; GET /api/pal/new/content-model/nodes/{nodeKey} ; POST /api/pal/new/content-model/nodes/{nodeKey} | app/pal/new/data/content-model.ts:1339 (1) |
| 592 | `/api/pal/new/content-model/review-queue` | MATCHED | A | GET /api/pal/new/content-model/review-queue | app/pal/new/data/content-model.ts:1298 (1) |
| 593 | `/api/pal/new/content-model/vocabulary` | MATCHED | A | GET /api/pal/new/content-model/vocabulary | app/pal/new/data/content-model.ts:174 (1) |
| 594 | `/api/pal/new/gamification/badges` | MATCHED | A | GET /api/pal/new/gamification/badges | app/pal/new/data/gamification.ts:1182 (1) |
| 595 | `/api/pal/new/gamification/career-quest` | MATCHED | A | GET /api/pal/new/gamification/career-quest | app/pal/new/data/gamification.ts:1244 (1) |
| 596 | `/api/pal/new/gamification/career-quest/interest` | MATCHED | A | POST /api/pal/new/gamification/career-quest/interest | app/pal/new/data/gamification.ts:1253 (1) |
| 597 | `/api/pal/new/gamification/career-quest/pathway` | MATCHED | A | POST /api/pal/new/gamification/career-quest/pathway | app/pal/new/data/gamification.ts:1266 (1) |
| 598 | `/api/pal/new/gamification/career-quest/report` | MATCHED | A | POST /api/pal/new/gamification/career-quest/report | app/pal/new/data/gamification.ts:1275 (1) |
| 599 | `/api/pal/new/gamification/challenge-mode` | MATCHED | A | GET /api/pal/new/gamification/challenge-mode | app/pal/new/data/gamification.ts:1286 (1) |
| 600 | `/api/pal/new/gamification/challenge-mode/leaderboard` | MATCHED | A | GET /api/pal/new/gamification/challenge-mode/leaderboard | app/pal/new/data/gamification.ts:1305 (1) |
| 601 | `/api/pal/new/gamification/challenge-mode/opt-in` | MATCHED | A | POST /api/pal/new/gamification/challenge-mode/opt-in | app/pal/new/data/gamification.ts:1292 (1) |
| 602 | `/api/pal/new/gamification/notifications` | MATCHED | A | GET /api/pal/new/gamification/notifications | app/pal/new/data/gamification.ts:1336 (1) |
| 603 | `/api/pal/new/gamification/notifications/read` | MATCHED | A | POST /api/pal/new/gamification/notifications/read | app/pal/new/data/gamification.ts:1357 (1) |
| 604 | `/api/pal/new/gamification/overview` | MATCHED | A | GET /api/pal/new/gamification/overview | app/pal/new/data/gamification.ts:1089 (1) |
| 605 | `/api/pal/new/gamification/personal-best` | MATCHED | A | GET /api/pal/new/gamification/personal-best | app/pal/new/data/gamification.ts:1162 (1) |
| 606 | `/api/pal/new/gamification/personal-best/history` | MATCHED | A | GET /api/pal/new/gamification/personal-best/history | app/pal/new/data/gamification.ts:1172 (1) |
| 607 | `/api/pal/new/gamification/session-summary` | MATCHED | A | GET /api/pal/new/gamification/session-summary | app/pal/new/data/gamification.ts:1314 (1) |
| 608 | `/api/pal/new/gamification/streak` | MATCHED | A | GET /api/pal/new/gamification/streak | app/pal/new/data/gamification.ts:1187 (1) |
| 609 | `/api/pal/new/gamification/streak/history` | MATCHED | A | GET /api/pal/new/gamification/streak/history | app/pal/new/data/gamification.ts:1196 (1) |
| 610 | `/api/pal/new/gamification/team-challenges` | MATCHED | A | GET /api/pal/new/gamification/team-challenges ; POST /api/pal/new/gamification/team-challenges | app/pal/new/data/gamification.ts:1212; app/pal/new/data/gamification.ts:1230 (2) |
| 611 | `/api/pal/new/gamification/team-challenges/${challengeId}/end` | MATCHED | A | POST /api/pal/new/gamification/team-challenges/{challengeId}/end | app/pal/new/data/gamification.ts:1235 (1) |
| 612 | `/api/pal/pedagogy-engine` | MATCHED | N | GET /api/pal/pedagogy-engine | app/pal/data/pedagogy-engine.ts:234 (1) |
| 613 | `/api/pal/plateau/${encodeURIComponent(learnerId)}` | MATCHED | A | GET /api/pal/plateau/{learnerId} | app/pal/data/pal-v4.ts:313 (1) |
| 614 | `/api/pal/regression/${encodeURIComponent(learnerId)}` | MATCHED | A | GET /api/pal/regression/{learnerId} | app/pal/data/pal-v4.ts:345 (1) |
| 615 | `/api/pal/remediation/${encodeURIComponent(learnerId)}/${encodeURIComponent(misconceptionId)}` | MATCHED | A | GET /api/pal/remediation/{learnerId}/{misconceptionId} | app/pal/data/pal-v4.ts:490 (1) |
| 616 | `/api/pal/ulu` | MATCHED | A | GET /api/pal/ulu ; POST /api/pal/ulu | app/pal/data/pal-v4.ts:736; app/pal/data/pal-v4.ts:771 (2) |
| 617 | `/api/pal/ulu/${id}` | MATCHED | A | GET /api/pal/ulu/{id} ; PUT /api/pal/ulu/{id} ; DELETE /api/pal/ulu/{id} | app/pal/data/pal-v4.ts:748; app/pal/data/pal-v4.ts:776 (3) |
| 618 | `/api/pal/ulu/${id}/analytics` | MATCHED | A | GET /api/pal/ulu/{id}/analytics | app/pal/data/pal-v4.ts:818 (1) |
| 619 | `/api/pal/ulu/${id}/approve` | MATCHED | A | POST /api/pal/ulu/{id}/approve | app/pal/data/pal-v4.ts:786 (1) |
| 620 | `/api/pal/ulu/${id}/archive` | MATCHED | A | POST /api/pal/ulu/{id}/archive | app/pal/data/pal-v4.ts:791 (1) |
| 621 | `/api/pal/ulu/${id}/duplicate` | MATCHED | A | POST /api/pal/ulu/{id}/duplicate | app/pal/data/pal-v4.ts:781 (1) |
| 622 | `/api/pal/ulu/${id}/preview` | MATCHED | A | GET /api/pal/ulu/{id}/preview | app/pal/data/pal-v4.ts:800 (1) |
| 623 | `/api/pal/velocity/${encodeURIComponent(learnerId)}` | MATCHED | A | GET /api/pal/velocity/{learnerId} | app/pal/data/pal-v4.ts:274 (1) |
| 624 | `/api/pal/workspace/${encodeURIComponent(learnerId)}` | MATCHED | A | GET /api/pal/workspace/{learnerId} | app/pal/data/pal.ts:388 (1) |
| 625 | `/api/pal/workspace/preview` | MATCHED | A | GET /api/pal/workspace/preview ; GET /api/pal/workspace/{learnerId} | app/pal/data/pal.ts:418 (1) |
| 626 | `/api/pal/workspace/students` | MATCHED | A | GET /api/pal/workspace/students ; GET /api/pal/workspace/{learnerId} | app/pal/data/pal-lookups.ts:88 (1) |
| 627 | `/api/payroll-deduction/store` | ALT | A | POST /payroll-deduction/store | app/hrit/_lib/payroll-api.ts:741 (1) |
| 628 | `/api/payroll-type/destroy/${id}` | ALT | A | DELETE /payroll-type/destroy/{id} | app/hrit/_lib/payroll-api.ts:621 (1) |
| 629 | `/api/payroll-type/store` | ALT | A | POST /payroll-type/store | app/hrit/_lib/payroll-api.ts:601 (1) |
| 630 | `/api/pending-feedback` | MATCHED | A | GET /api/pending-feedback | app/talent-management/_lib/recruitment-api.ts:329 (1) |
| 631 | `/api/performance/activity` | MATCHED | A | GET /api/performance/activity | app/talent-management/_lib/performance-api.ts:552 (1) |
| 632 | `/api/performance/activity/filters` | MATCHED | A | GET /api/performance/activity/filters | app/talent-management/_lib/performance-api.ts:557 (1) |
| 633 | `/api/performance/appraisals` | MATCHED | A | GET /api/performance/appraisals ; POST /api/performance/appraisals | app/talent-management/_lib/performance-api.ts:376; app/talent-management/_lib/performance-api.ts:381 (2) |
| 634 | `/api/performance/appraisals/${id}` | MATCHED | A | PUT /api/performance/appraisals/{id} ; DELETE /api/performance/appraisals/{id} | app/talent-management/_lib/performance-api.ts:387; app/talent-management/_lib/performance-api.ts:403 (2) |
| 635 | `/api/performance/appraisals/${id}/decision` | MATCHED | A | PUT /api/performance/appraisals/{id}/decision | app/talent-management/_lib/performance-api.ts:390 (1) |
| 636 | `/api/performance/appraisals/bulk` | MATCHED | A | POST /api/performance/appraisals/bulk ; PUT /api/performance/appraisals/{id} ; DELETE /api/performance/appraisals/{id} | app/talent-management/_lib/performance-api.ts:396 (1) |
| 637 | `/api/performance/attachments/${id}` | MATCHED | A | DELETE /api/performance/attachments/{id} | app/talent-management/_lib/performance-api.ts:615 (1) |
| 638 | `/api/performance/bonus` | MATCHED | A | GET /api/performance/bonus ; POST /api/performance/bonus | app/talent-management/_lib/performance-api.ts:445; app/talent-management/_lib/performance-api.ts:450 (2) |
| 639 | `/api/performance/bonus/${id}` | MATCHED | A | PUT /api/performance/bonus/{id} ; DELETE /api/performance/bonus/{id} | app/talent-management/_lib/performance-api.ts:453; app/talent-management/_lib/performance-api.ts:469 (2) |
| 640 | `/api/performance/bonus/${id}/decision` | MATCHED | A | PUT /api/performance/bonus/{id}/decision | app/talent-management/_lib/performance-api.ts:456 (1) |
| 641 | `/api/performance/bonus/bulk` | MATCHED | A | POST /api/performance/bonus/bulk ; PUT /api/performance/bonus/{id} ; DELETE /api/performance/bonus/{id} | app/talent-management/_lib/performance-api.ts:462 (1) |
| 642 | `/api/performance/calibration-sessions` | MATCHED | A | GET /api/performance/calibration-sessions ; POST /api/performance/calibration-sessions | app/talent-management/_lib/performance-api.ts:476; app/talent-management/_lib/performance-api.ts:486 (2) |
| 643 | `/api/performance/calibration-sessions/${id}` | MATCHED | A | PUT /api/performance/calibration-sessions/{id} ; DELETE /api/performance/calibration-sessions/{id} | app/talent-management/_lib/performance-api.ts:497; app/talent-management/_lib/performance-api.ts:532 (2) |
| 644 | `/api/performance/calibration-sessions/${id}/calibrate` | MATCHED | A | PUT /api/performance/calibration-sessions/{id}/calibrate | app/talent-management/_lib/performance-api.ts:510 (1) |
| 645 | `/api/performance/calibration-sessions/${id}/grid` | MATCHED | A | GET /api/performance/calibration-sessions/{id}/grid | app/talent-management/_lib/performance-api.ts:481 (1) |
| 646 | `/api/performance/calibration-sessions/${id}/lock` | MATCHED | A | POST /api/performance/calibration-sessions/{id}/lock | app/talent-management/_lib/performance-api.ts:521 (1) |
| 647 | `/api/performance/compensation` | MATCHED | A | GET /api/performance/compensation ; POST /api/performance/compensation | app/talent-management/_lib/performance-api.ts:410; app/talent-management/_lib/performance-api.ts:415 (2) |
| 648 | `/api/performance/compensation/${id}` | MATCHED | A | PUT /api/performance/compensation/{id} ; DELETE /api/performance/compensation/{id} | app/talent-management/_lib/performance-api.ts:422; app/talent-management/_lib/performance-api.ts:438 (2) |
| 649 | `/api/performance/compensation/${id}/decision` | MATCHED | A | PUT /api/performance/compensation/{id}/decision | app/talent-management/_lib/performance-api.ts:425 (1) |
| 650 | `/api/performance/compensation/bulk` | MATCHED | A | POST /api/performance/compensation/bulk ; PUT /api/performance/compensation/{id} ; DELETE /api/performance/compensation/{id} | app/talent-management/_lib/performance-api.ts:431 (1) |
| 651 | `/api/performance/cycles` | MATCHED | A | GET /api/performance/cycles ; POST /api/performance/cycles | app/talent-management/_lib/performance-api.ts:287; app/talent-management/_lib/performance-api.ts:293 (2) |
| 652 | `/api/performance/cycles/${id}` | MATCHED | A | GET /api/performance/cycles/{id} ; PUT /api/performance/cycles/{id} ; DELETE /api/performance/cycles/{id} | app/talent-management/_lib/performance-api.ts:290; app/talent-management/_lib/performance-api.ts:296 (3) |
| 653 | `/api/performance/cycles/${id}/close` | MATCHED | A | POST /api/performance/cycles/{id}/close | app/talent-management/_lib/performance-api.ts:304 (1) |
| 654 | `/api/performance/cycles/${id}/launch` | MATCHED | A | POST /api/performance/cycles/{id}/launch | app/talent-management/_lib/performance-api.ts:299 (1) |
| 655 | `/api/performance/filters` | MATCHED | A | GET /api/performance/filters | app/talent-management/_lib/performance-api.ts:272 (1) |
| 656 | `/api/performance/goals` | MATCHED | A | GET /api/performance/goals ; POST /api/performance/goals | app/talent-management/_lib/performance-api.ts:360; app/talent-management/_lib/performance-api.ts:363 (2) |
| 657 | `/api/performance/goals/${id}` | MATCHED | A | PUT /api/performance/goals/{id} ; DELETE /api/performance/goals/{id} | app/talent-management/_lib/performance-api.ts:366; app/talent-management/_lib/performance-api.ts:369 (2) |
| 658 | `/api/performance/notes/${id}` | MATCHED | A | PUT /api/performance/notes/{id} ; DELETE /api/performance/notes/{id} | app/talent-management/_lib/performance-api.ts:580; app/talent-management/_lib/performance-api.ts:583 (2) |
| 659 | `/api/performance/overview` | MATCHED | A | GET /api/performance/overview | app/talent-management/_lib/performance-api.ts:269 (1) |
| 660 | `/api/performance/reviews` | MATCHED | A | GET /api/performance/reviews | app/talent-management/_lib/performance-api.ts:314 (1) |
| 661 | `/api/performance/reviews/${id}` | MATCHED | A | GET /api/performance/reviews/{id} ; PUT /api/performance/reviews/{id} ; DELETE /api/performance/reviews/{id} | app/talent-management/_lib/performance-api.ts:324; app/talent-management/_lib/performance-api.ts:327 (3) |
| 662 | `/api/performance/reviews/${id}/advance` | MATCHED | A | POST /api/performance/reviews/{id}/advance | app/talent-management/_lib/performance-api.ts:330 (1) |
| 663 | `/api/performance/reviews/${id}/reminder` | MATCHED | A | POST /api/performance/reviews/{id}/reminder | app/talent-management/_lib/performance-api.ts:335 (1) |
| 664 | `/api/performance/reviews/${reviewId}/attachments` | MATCHED | A | GET /api/performance/reviews/{reviewId}/attachments ; POST /api/performance/reviews/{reviewId}/attachments | app/talent-management/_lib/performance-api.ts:590; app/talent-management/_lib/performance-api.ts:611 (2) |
| 665 | `/api/performance/reviews/${reviewId}/notes` | MATCHED | A | GET /api/performance/reviews/{reviewId}/notes ; POST /api/performance/reviews/{reviewId}/notes | app/talent-management/_lib/performance-api.ts:566; app/talent-management/_lib/performance-api.ts:574 (2) |
| 666 | `/api/performance/reviews/board` | MATCHED | A | GET /api/performance/reviews/board ; GET /api/performance/reviews/{id} ; PUT /api/performance/reviews/{id} ...(+1) | app/talent-management/_lib/performance-api.ts:319 (1) |
| 667 | `/api/performance/reviews/bulk` | MATCHED | A | POST /api/performance/reviews/bulk ; GET /api/performance/reviews/{id} ; PUT /api/performance/reviews/{id} ...(+1) | app/talent-management/_lib/performance-api.ts:345 (1) |
| 668 | `/api/performance/saved-views` | MATCHED | A | GET /api/performance/saved-views ; POST /api/performance/saved-views | app/talent-management/_lib/performance-api.ts:620; app/talent-management/_lib/performance-api.ts:631 (2) |
| 669 | `/api/performance/saved-views/${id}` | MATCHED | A | PUT /api/performance/saved-views/{id} ; DELETE /api/performance/saved-views/{id} | app/talent-management/_lib/performance-api.ts:637; app/talent-management/_lib/performance-api.ts:640 (2) |
| 670 | `/api/performance/team-comparison` | MATCHED | A | GET /api/performance/team-comparison | app/talent-management/_lib/performance-api.ts:277 (1) |
| 671 | `/api/performance/timeline` | MATCHED | A | GET /api/performance/timeline | app/talent-management/_lib/performance-api.ts:282 (1) |
| 672 | `/api/permissions` | MATCHED | S | GET /api/permissions | app/hooks/usePermission.ts:79; lib/agents/acting-user.ts:79 (2) |
| 673 | `/api/petty-cash` | MATCHED | N | GET /api/petty-cash ; POST /api/petty-cash | app/admin-services/_lib/pettyCash.ts:37 (1) |
| 674 | `/api/petty-cash/${id}` | MATCHED | N | GET /api/petty-cash/{id} ; POST /api/petty-cash/{id} | app/admin-services/_lib/pettyCash.ts:151 (1) |
| 675 | `/api/petty-cash/${id}/delete` | MATCHED | N | POST /api/petty-cash/{id}/delete | app/admin-services/_lib/pettyCash.ts:157 (1) |
| 676 | `/api/petty-cash/heads` | MATCHED | N | GET /api/petty-cash/heads ; POST /api/petty-cash/heads ; GET /api/petty-cash/{id} ...(+1) | app/admin-services/_lib/pettyCash.ts:38 (1) |
| 677 | `/api/petty-cash/heads/${id}` | MATCHED | N | POST /api/petty-cash/heads/{id} | app/admin-services/_lib/pettyCash.ts:106 (1) |
| 678 | `/api/petty-cash/heads/${id}/delete` | MATCHED | N | POST /api/petty-cash/heads/{id}/delete | app/admin-services/_lib/pettyCash.ts:115 (1) |
| 679 | `/api/petty-cash/report` | MATCHED | N | GET /api/petty-cash/report ; GET /api/petty-cash/{id} ; POST /api/petty-cash/{id} | app/admin-services/_lib/pettyCash.ts:176 (1) |
| 680 | `/api/platform/notifications/channels` | MATCHED | S | PUT /api/platform/notifications/channels | lib/platform/client.ts:139 (1) |
| 681 | `/api/platform/registry` | MATCHED | S | GET /api/platform/registry | lib/platform/client.ts:94 (1) |
| 682 | `/api/platform/scheduler` | MATCHED | S | GET /api/platform/scheduler ; PUT /api/platform/scheduler | lib/platform/client.ts:152 (1) |
| 683 | `/api/platform/workflow` | MATCHED | S | GET /api/platform/workflow ; POST /api/platform/workflow | lib/platform/client.ts:162 (1) |
| 684 | `/api/platform/workflow/${id}` | MATCHED | S | PUT /api/platform/workflow/{id} ; DELETE /api/platform/workflow/{id} | lib/platform/client.ts:166; lib/platform/client.ts:170 (2) |
| 685 | `/api/question-bank/filters` | MATCHED | N | GET,POST /api/question-bank/filters | app/course-master/data/chapters.ts:1164 (1) |
| 686 | `/api/question-bank/question-types` | MATCHED | N | GET,POST /api/question-bank/question-types | app/course-master/data/chapters.ts:1088 (1) |
| 687 | `/api/question-mapping-levels` | MATCHED | N | GET /api/question-mapping-levels | app/exam/data/aiPaper.ts:167; app/lms/exam/page.tsx:2317 (2) |
| 688 | `/api/question-paper` | MATCHED | N | GET /api/question-paper ; POST /api/question-paper | app/exam/data/aiPaper.ts:520; app/exam/data/onlineExam.ts:165 (8) |
| 689 | `/api/question-paper-templates` | MATCHED | N | GET /api/question-paper-templates ; POST /api/question-paper-templates | app/lms/exam/_question-paper-templates/api.ts:116; app/lms/exam/_question-paper-templates/api.ts:140 (2) |
| 690 | `/api/question-paper-templates/${id}` | MATCHED | N | GET /api/question-paper-templates/{id} ; PUT,PATCH,POST /api/question-paper-templates/{id} ; DELETE /api/question-paper-templates/{id} | app/lms/exam/_question-paper-templates/api.ts:168 (1) |
| 691 | `/api/question-paper-templates/${input.id}` | MATCHED | N | GET /api/question-paper-templates/{id} ; PUT,PATCH,POST /api/question-paper-templates/{id} ; DELETE /api/question-paper-templates/{id} | app/lms/exam/_question-paper-templates/api.ts:139 (1) |
| 692 | `/api/question-paper-templates/paper/${paperId}` | MATCHED | N | GET /api/question-paper-templates/paper/{paperId} | app/lms/exam/_question-paper-templates/api.ts:187 (1) |
| 693 | `/api/question-paper/${encodeURIComponent(id)}/pdf` | MATCHED | N | GET /api/question-paper/{id}/pdf | app/lms/lmsAssignment/api.ts:247 (1) |
| 694 | `/api/question-paper/${paper.id}` | MATCHED | N | GET /api/question-paper/{question_paper} ; PUT /api/question-paper/{question_paper} ; DELETE /api/question-paper/{question_paper} | app/lms/exam/page.tsx:1168 (1) |
| 695 | `/api/question-paper/${paperId}` | MATCHED | N | GET /api/question-paper/{question_paper} ; PUT /api/question-paper/{question_paper} ; DELETE /api/question-paper/{question_paper} | app/lms/exam/page.tsx:1235 (1) |
| 696 | `/api/result/all-results` | MATCHED | A | GET /api/result/all-results | app/result/report-card/page.tsx:225 (1) |
| 697 | `/api/result/approve-mobile-result` | MATCHED | A | GET /api/result/approve-mobile-result ; POST /api/result/approve-mobile-result | app/result/approve-mobile-result/page.tsx:141 (1) |
| 698 | `/api/result/approve-mobile-result/create` | MATCHED | A | GET /api/result/approve-mobile-result/create | app/result/approve-mobile-result/page.tsx:76 (1) |
| 699 | `/api/result/classwise-grade-report/create` | MATCHED | A | GET /api/result/classwise-grade-report/create | app/result/reports/classwise-grade/page.tsx:71 (1) |
| 700 | `/api/result/co-scholastic-marks-entry` | MATCHED | A | GET /api/result/co-scholastic-marks-entry ; POST /api/result/co-scholastic-marks-entry | app/result/co-scholastic-marks/page.tsx:162 (1) |
| 701 | `/api/result/co-scholastic-marks-entry/approve` | MATCHED | A | POST /api/result/co-scholastic-marks-entry/approve | app/result/co-scholastic-marks/page.tsx:176 (1) |
| 702 | `/api/result/co-scholastic-marks-entry/create` | MATCHED | A | GET /api/result/co-scholastic-marks-entry/create | app/result/co-scholastic-marks/page.tsx:99 (1) |
| 703 | `/api/result/consolidate-report` | MATCHED | A | GET /api/result/consolidate-report | app/result/reports/consolidate/page.tsx:141 (1) |
| 704 | `/api/result/hpc-activity-entry` | MATCHED | A | GET /api/result/hpc-activity-entry ; POST /api/result/hpc-activity-entry | app/result/hpc-activity-entry/page.tsx:200 (1) |
| 705 | `/api/result/hpc-activity-entry/create` | MATCHED | A | GET /api/result/hpc-activity-entry/create | app/result/hpc-activity-entry/page.tsx:146 (1) |
| 706 | `/api/result/hpc-entry-v1` | MATCHED | A | GET /api/result/hpc-entry-v1 ; POST /api/result/hpc-entry-v1 | app/result/hpc-entry-v1/page.tsx:256 (1) |
| 707 | `/api/result/hpc-entry-v1/create` | MATCHED | A | GET /api/result/hpc-entry-v1/create | app/result/hpc-entry-v1/page.tsx:192 (1) |
| 708 | `/api/result/marks-entry` | MATCHED | A | GET /api/result/marks-entry ; POST /api/result/marks-entry | app/result/marks-entry/page.tsx:223 (1) |
| 709 | `/api/result/marks-entry/approve` | MATCHED | A | POST /api/result/marks-entry/approve | app/result/marks-entry/page.tsx:237 (1) |
| 710 | `/api/result/marks-entry/create` | MATCHED | A | GET /api/result/marks-entry/create | app/result/marks-entry/page.tsx:165 (1) |
| 711 | `/api/result/result-remark-master/dropdown` | MATCHED | A | GET /api/result/result-remark-master/dropdown ; GET /api/result/result-remark-master/{id} ; PUT /api/result/result-remark-master/{id} ...(+1) | app/result/student-result-remarks/page.tsx:72 (1) |
| 712 | `/api/result/result-report/download-overall-excel` | MATCHED | A | GET /api/result/result-report/download-overall-excel | app/result/reports/page.tsx:205 (1) |
| 713 | `/api/result/result-report/show` | MATCHED | A | POST /api/result/result-report/show | app/result/reports/page.tsx:185 (1) |
| 714 | `/api/result/student-attendance-master` | MATCHED | A | POST /api/result/student-attendance-master | app/result/student-attendance/page.tsx:139 (1) |
| 715 | `/api/result/student-attendance-master/create` | MATCHED | A | GET /api/result/student-attendance-master/create | app/result/student-attendance/page.tsx:79 (1) |
| 716 | `/api/result/student-result` | MATCHED | A | GET /api/result/student-result ; POST /api/result/student-result | app/result/report-card/page.tsx:57; app/result/report-card/page.tsx:169 (2) |
| 717 | `/api/result/student-result-remarks` | MATCHED | A | GET /api/result/student-result-remarks ; POST /api/result/student-result-remarks | app/result/student-result-remarks/page.tsx:112 (1) |
| 718 | `/api/result/student-result-remarks/students` | MATCHED | A | GET /api/result/student-result-remarks/students | app/result/student-result-remarks/page.tsx:71 (1) |
| 719 | `/api/result/student-result/create` | MATCHED | A | GET /api/result/student-result/create | app/result/report-card/page.tsx:115 (1) |
| 720 | `/api/result/student-result/save-html` | MATCHED | A | POST /api/result/student-result/save-html | app/result/report-card/page.tsx:206 (1) |
| 721 | `/api/result/upload-result` | MATCHED | A | GET /api/result/upload-result ; POST /api/result/upload-result | app/result/upload-result/page.tsx:205 (1) |
| 722 | `/api/result/upload-result/create` | MATCHED | A | GET /api/result/upload-result/create | app/result/upload-result/page.tsx:117 (1) |
| 723 | `/api/semantic-intelligence` | MATCHED | N | GET /api/semantic-intelligence | app/course-master/data/chapters.ts:944 (1) |
| 724 | `/api/semantic-intelligence/${extractionId}/result` | MATCHED | N | GET /api/semantic-intelligence/{extraction_id}/result | app/course-master/data/chapters.ts:958 (1) |
| 725 | `/api/sqaa/entry` | MATCHED | A | POST /api/sqaa/entry | app/sqaa/_lib/api.ts:163 (1) |
| 726 | `/api/student-dashboard/summary` | MATCHED | A | POST /api/student-dashboard/summary | app/api/dashboard/student/route.ts:16; app/api/dashboard/student/route.ts:75 (2) |
| 727 | `/api/students-dashboard/summary` | MATCHED | N | POST /api/students-dashboard/summary | app/api/students/dashboard/summary/route.ts:13; app/api/students/dashboard/summary/route.ts:90 (2) |
| 728 | `/api/talent-acquisition/funnel` | MATCHED | A | POST /api/talent-acquisition/funnel | app/talent-management/_lib/recruitment-api.ts:348 (1) |
| 729 | `/api/talent-acquisition/requisitions` | MATCHED | A | POST /api/talent-acquisition/requisitions | app/talent-management/_lib/recruitment-api.ts:343 (1) |
| 730 | `/api/talent-offers` | MATCHED | A | POST /api/talent-offers | app/talent-management/_lib/recruitment-api.ts:266 (1) |
| 731 | `/api/talent-offers/${id}/reject` | MATCHED | A | POST /api/talent-offers/{id}/reject | app/talent-management/_lib/recruitment-api.ts:269 (1) |
| 732 | `/api/talent-screening-results` | MATCHED | A | POST /api/talent-screening-results | app/talent-management/_lib/recruitment-api.ts:291 (1) |
| 733 | `/api/talent-screening-results/candidate/${candidateId}` | MATCHED | A | GET /api/talent-screening-results/candidate/{candidate_id} | app/talent-management/_lib/recruitment-api.ts:277 (1) |
| 734 | `/api/talent-templates` | MATCHED | A | GET /api/talent-templates | app/talent-management/_lib/recruitment-api.ts:351 (1) |
| 735 | `/api/talent/${path}` | MATCHED |  |  | app/talent-management/_lib/talent-dashboard-api.ts:75 (1) |
| 736 | `/api/talent/admin/workflows` | MATCHED | A | GET /api/talent/admin/workflows | app/talent-management/_lib/administration-api.ts:98 (1) |
| 737 | `/api/talent/team-overview` | MATCHED | A | GET /api/talent/team-overview | app/talent-management/_lib/recruitment-api.ts:355 (1) |
| 738 | `/api/task-management/audit-logs` | MATCHED | A | GET /api/task-management/audit-logs | app/task-management/_lib/administration-api.ts:58 (1) |
| 739 | `/api/task-management/audit-logs/export` | MATCHED | A | GET /api/task-management/audit-logs/export | app/task-management/_lib/administration-api.ts:72 (1) |
| 740 | `/api/task-management/deadline-extensions` | MATCHED | A | GET /api/task-management/deadline-extensions ; POST /api/task-management/deadline-extensions | app/task-management/_lib/my-tasks-api.ts:207; app/task-management/_lib/my-tasks-api.ts:214 (2) |
| 741 | `/api/task-management/deadline-extensions/${id}/decision` | MATCHED | A | PATCH /api/task-management/deadline-extensions/{id}/decision | app/task-management/_lib/my-tasks-api.ts:221 (1) |
| 742 | `/api/task-management/dependencies` | MATCHED | A | GET /api/task-management/dependencies ; POST /api/task-management/dependencies | app/task-management/_lib/dependencies-api.ts:27; app/task-management/_lib/dependencies-api.ts:49 (3) |
| 743 | `/api/task-management/dependencies/${id}` | MATCHED | A | PUT /api/task-management/dependencies/{id} ; DELETE /api/task-management/dependencies/{id} | app/task-management/_lib/dependencies-api.ts:54 (1) |
| 744 | `/api/task-management/integrations` | MATCHED | A | GET /api/task-management/integrations | app/task-management/_lib/administration-api.ts:100 (1) |
| 745 | `/api/task-management/my-tasks` | MATCHED | A | GET /api/task-management/my-tasks | app/task-management/_lib/my-tasks-api.ts:183 (1) |
| 746 | `/api/task-management/my-tasks/${id}` | MATCHED | A | GET /api/task-management/my-tasks/{id} | app/task-management/_lib/my-tasks-api.ts:195 (1) |
| 747 | `/api/task-management/my-tasks/${id}/status` | MATCHED | A | PATCH /api/task-management/my-tasks/{id}/status | app/task-management/_lib/my-tasks-api.ts:200 (1) |
| 748 | `/api/task-management/permissions` | MATCHED | A | GET /api/task-management/permissions | app/task-management/_lib/administration-api.ts:86 (1) |
| 749 | `/api/task-management/priorities` | MATCHED | A | GET /api/task-management/priorities ; POST /api/task-management/priorities | app/task-management/_lib/administration-api.ts:147; app/task-management/_lib/administration-api.ts:154 (2) |
| 750 | `/api/task-management/priorities/${id}` | MATCHED | A | PUT /api/task-management/priorities/{id} ; DELETE /api/task-management/priorities/{id} | app/task-management/_lib/administration-api.ts:162; app/task-management/_lib/administration-api.ts:166 (2) |
| 751 | `/api/task-management/projects` | MATCHED | A | GET /api/task-management/projects ; POST /api/task-management/projects | app/task-management/_lib/my-tasks-api.ts:401; app/task-management/_lib/projects-api.ts:72 (3) |
| 752 | `/api/task-management/projects/${id}` | MATCHED | A | GET /api/task-management/projects/{id} ; PUT /api/task-management/projects/{id} | app/task-management/_lib/my-tasks-api.ts:406; app/task-management/_lib/projects-api.ts:82 (3) |
| 753 | `/api/task-management/projects/${id}/archive` | MATCHED | A | PATCH /api/task-management/projects/{id}/archive | app/task-management/_lib/projects-api.ts:93 (1) |
| 754 | `/api/task-management/projects/${id}/members` | MATCHED | A | PUT /api/task-management/projects/{id}/members | app/task-management/_lib/projects-api.ts:100 (1) |
| 755 | `/api/task-management/projects/${id}/tasks` | MATCHED | A | PUT /api/task-management/projects/{id}/tasks ; POST /api/task-management/projects/{id}/tasks | app/task-management/_lib/projects-api.ts:107 (1) |
| 756 | `/api/task-management/projects/${projectId}/tasks` | MATCHED | A | PUT /api/task-management/projects/{id}/tasks ; POST /api/task-management/projects/{id}/tasks | app/task-management/_lib/my-tasks-api.ts:411 (1) |
| 757 | `/api/task-management/projects/${projectId}/workstreams` | MATCHED | A | POST /api/task-management/projects/{id}/workstreams | app/task-management/_lib/projects-api.ts:114 (1) |
| 758 | `/api/task-management/projects/${projectId}/workstreams/${workstreamId}` | MATCHED | A | PUT /api/task-management/projects/{projectId}/workstreams/{workstreamId} ; DELETE /api/task-management/projects/{projectId}/workstreams/{workstreamId} | app/task-management/_lib/projects-api.ts:126; app/task-management/_lib/projects-api.ts:133 (2) |
| 759 | `/api/task-management/projects/options` | MATCHED | A | GET /api/task-management/projects/options ; GET /api/task-management/projects/{id} ; PUT /api/task-management/projects/{id} | app/task-management/_lib/projects-api.ts:62 (1) |
| 760 | `/api/task-management/reports/delays` | MATCHED | A | GET /api/task-management/reports/delays | app/task-management/_lib/reports-api.ts:35 (1) |
| 761 | `/api/task-management/reports/productivity` | MATCHED | A | GET /api/task-management/reports/productivity | app/task-management/_lib/reports-api.ts:28 (1) |
| 762 | `/api/task-management/statuses` | MATCHED | A | GET /api/task-management/statuses ; POST /api/task-management/statuses | app/task-management/_lib/administration-api.ts:114; app/task-management/_lib/administration-api.ts:121 (3) |
| 763 | `/api/task-management/statuses/${id}` | MATCHED | A | PUT /api/task-management/statuses/{id} ; DELETE /api/task-management/statuses/{id} | app/task-management/_lib/administration-api.ts:129; app/task-management/_lib/administration-api.ts:133 (2) |
| 764 | `/api/task-management/workspace` | MATCHED | A | GET /api/task-management/workspace | app/task-management/_lib/calendar-api.ts:65; app/task-management/_lib/dashboard-api.ts:43 (3) |
| 765 | `/api/task-management/workspace/${id}` | MATCHED | A | GET /api/task-management/workspace/{id} ; PUT /api/task-management/workspace/{id} ; DELETE /api/task-management/workspace/{id} | app/task-management/_lib/calendar-api.ts:83; app/task-management/_lib/dashboard-api.ts:68 (3) |
| 766 | `/api/task-management/workspace/${id}/approval` | MATCHED | A | PATCH /api/task-management/workspace/{id}/approval | app/task-management/_lib/dashboard-api.ts:61 (1) |
| 767 | `/api/task-management/workspace/${id}/schedule` | MATCHED | A | GET /api/task-management/workspace/{id}/schedule ; PUT /api/task-management/workspace/{id}/schedule | app/task-management/_lib/calendar-api.ts:94 (1) |
| 768 | `/api/teach-learn/menu-categories` | MATCHED | A | GET,POST /api/teach-learn/menu-categories | app/api/teach-learn/menu-categories/route.ts:62 (1) |
| 769 | `/api/teacher-dashboard/summary` | MATCHED | A | POST /api/teacher-dashboard/summary | app/api/dashboard/teacher/route.ts:16; app/api/dashboard/teacher/route.ts:75 (2) |
| 770 | `/api/teacher-fee-dues/summary` | MATCHED | A | POST /api/teacher-fee-dues/summary | app/api/dashboard/teacher-fee-dues/route.ts:16; app/api/dashboard/teacher-fee-dues/route.ts:75 (2) |
| 771 | `/api/teacher-icard/mine` | MATCHED | A | POST /api/teacher-icard/mine | app/api/dashboard/teacher-icard/route.ts:16; app/api/dashboard/teacher-icard/route.ts:75 (2) |
| 772 | `/api/teacher-timetable/summary` | MATCHED | A | POST /api/teacher-timetable/summary | app/api/dashboard/teacher-timetable/route.ts:16; app/api/dashboard/teacher-timetable/route.ts:75 (2) |
| 773 | `/api/teacher-transfer` | MATCHED | N | GET /api/teacher-transfer ; POST /api/teacher-transfer | app/teachertransfer/api.ts:40 (1) |
| 774 | `/api/transportation-dashboard/summary` | MATCHED | N | POST /api/transportation-dashboard/summary | app/api/transportation/dashboard/summary/route.ts:11; app/api/transportation/dashboard/summary/route.ts:88 (2) |
| 775 | `/api/transportation-setup/${module}` | MATCHED | N | GET /api/transportation-setup/{module} ; POST /api/transportation-setup/{module} | app/Transportation/api.ts:189 (1) |
| 776 | `/api/user-reports/bootstrap` | MATCHED | N | GET /api/user-reports/bootstrap | app/admin-services/_lib/visitor.ts:46 (1) |
| 777 | `/api/user-skills/${userId}` | MATCHED | A | GET /api/user-skills/{userId} | app/task-management/_lib/my-tasks-api.ts:362 (1) |
| 778 | `/attendance/day-detail` | ALT | N | GET /api/attendance/day-detail | app/hrit/_lib/attendance-api.ts:426 (1) |
| 779 | `/attendance/employees` | ALT | N | GET /api/attendance/employees | app/hrit/_lib/attendance-api.ts:403 (1) |
| 780 | `/attendance/kpi` | ALT | N | GET /api/attendance/kpi | app/hrit/_lib/attendance-api.ts:394 (1) |
| 781 | `/attendance/latest-activity-date` | ALT | N | GET /api/attendance/latest-activity-date | app/hrit/_lib/attendance-api.ts:440 (1) |
| 782 | `/attendance/my-attendance` | ALT | N | GET /api/attendance/my-attendance | app/hrit/_lib/attendance-api.ts:460 (1) |
| 783 | `/attendance/report-filters` | ALT | N | GET /api/attendance/report-filters | app/hrit/_lib/attendance-api.ts:400 (1) |
| 784 | `/attendance/weekly-summary` | ALT | N | GET /api/attendance/weekly-summary | app/hrit/_lib/attendance-api.ts:397 (1) |
| 785 | `/book_issue_report` | MATCHED | A | GET /book_issue_report ; POST /book_issue_report | app/library/issue_overdue_report/page.tsx:111 (1) |
| 786 | `/books` | MATCHED | A | GET /books ; POST /books | app/library/book_resources/page.tsx:640 (1) |
| 787 | `/books/${row.id}/edit` | MATCHED | A | GET /books/{book}/edit | app/library/book_resources/page.tsx:475 (1) |
| 788 | `/books/check-title` | MATCHED | A | GET /books/{book} ; PUT /books/{book} ; DELETE /books/{book} ...(+1) | app/library/book_resources/page.tsx:554 (1) |
| 789 | `/custom-module/${tableId}` | MATCHED | A | GET /custom-module/{id} | app/Utility/custom-module/api.ts:369 (1) |
| 790 | `/custom-module/create-db-table/${tableId}` | MATCHED | A | GET /custom-module/create-db-table/{id} | app/Utility/custom-module/api.ts:364 (1) |
| 791 | `/custom-module/table-column-create/${id}` | MATCHED | A | GET /custom-module/table-column-create/{id} | app/Utility/custom-module/api.ts:309 (1) |
| 792 | `/custom-module/table-column-delete/${tableId}/column/${columnId}` | MATCHED | A | DELETE /custom-module/table-column-delete/{id}/column/{colId} | app/Utility/custom-module/api.ts:349 (1) |
| 793 | `/custom-module/table-column-store/${tableId}` | MATCHED | A | POST /custom-module/table-column-store/{id} | app/Utility/custom-module/api.ts:325 (1) |
| 794 | `/custom-module/table-delete/${id}` | MATCHED | A | DELETE /custom-module/table-delete/{id} | app/Utility/custom-module/api.ts:299 (1) |
| 795 | `/custom-module/table-store` | MATCHED | A | POST /custom-module/table-store ; GET /custom-module/{id} | app/Utility/custom-module/api.ts:270 (1) |
| 796 | `/custom-module/tables` | MATCHED | A | GET /custom-module/tables ; GET /custom-module/{id} | app/Utility/custom-module/api.ts:151 (1) |
| 797 | `/custom-module/view-delete/${recordId}` | MATCHED | A | DELETE /custom-module/view-delete/{id} | app/Utility/custom-module/api.ts:385 (1) |
| 798 | `/dashboard/filters` | OVERRIDE | A | GET /api/talent/dashboard/filters | app/talent-management/_lib/talent-dashboard-api.ts:142 (1) |
| 799 | `/fees-circular/filters` | ALT | A | POST /api/fees-circular/filters | app/fees/circulars/page.tsx:257 (1) |
| 800 | `/fees-circular/generate` | ALT | A | POST /api/fees-circular/generate | app/fees/circulars/page.tsx:428 (1) |
| 801 | `/fees-circular/students` | ALT | A | POST /api/fees-circular/students | app/fees/circulars/page.tsx:335 (1) |
| 802 | `/fees/fees_breackoff` | MATCHED | A | GET /fees/fees_breackoff ; POST /fees/fees_breackoff | app/fees/master/fees-breakoff/page.tsx:179; app/fees/master/fees-breakoff/page.tsx:391 (3) |
| 803 | `/fees/fees_breackoff/create` | MATCHED | A | GET /fees/fees_breackoff/create ; GET /fees/fees_breackoff/{fees_breackoff} ; PUT /fees/fees_breackoff/{fees_breackoff} ...(+1) | app/fees/master/fees-breakoff/page.tsx:298 (1) |
| 804 | `/fees/fees_cancel` | MATCHED | A | GET /fees/fees_cancel ; POST /fees/fees_cancel | app/fees/cancel-refund/page.tsx:286 (1) |
| 805 | `/fees/fees_circular_master` | MATCHED | A | GET /fees/fees_circular_master ; POST /fees/fees_circular_master | app/fees/master/fees-circular-master/page.tsx:199; app/fees/master/fees-circular-master/page.tsx:331 (2) |
| 806 | `/fees/fees_circular_master/${encodeURIComponent(editingRecord.id)}` | MATCHED | A | GET /fees/fees_circular_master/{fees_circular_master} ; PUT /fees/fees_circular_master/{fees_circular_master} ; DELETE /fees/fees_circular_master/{fees_circular_master} | app/fees/master/fees-circular-master/page.tsx:330 (1) |
| 807 | `/fees/fees_circular_master/${encodeURIComponent(record.id)}` | MATCHED | A | GET /fees/fees_circular_master/{fees_circular_master} ; PUT /fees/fees_circular_master/{fees_circular_master} ; DELETE /fees/fees_circular_master/{fees_circular_master} | app/fees/master/fees-circular-master/page.tsx:390 (1) |
| 808 | `/fees/fees_collect` | MATCHED | A | GET /fees/fees_collect ; POST /fees/fees_collect | app/fees/collect/[studentId]/page.tsx:519 (1) |
| 809 | `/fees/fees_collect/${encodeURIComponent(studentId)}/edit` | MATCHED | A | GET /fees/fees_collect/{fees_collect}/edit | app/fees/collect/[studentId]/page.tsx:291 (1) |
| 810 | `/fees/fees_config_master` | MATCHED | A | GET /fees/fees_config_master ; POST /fees/fees_config_master | app/fees/circulars/page.tsx:938; app/fees/master/fees-config-master/page.tsx:556 (3) |
| 811 | `/fees/fees_late_master` | MATCHED | A | GET /fees/fees_late_master ; POST /fees/fees_late_master | app/fees/master/fees-late-master/page.tsx:211; app/fees/master/fees-late-master/page.tsx:401 (2) |
| 812 | `/fees/fees_late_master/${encodeURIComponent(editingRecord.id)}` | MATCHED | A | GET /fees/fees_late_master/{fees_late_master} ; PUT /fees/fees_late_master/{fees_late_master} ; DELETE /fees/fees_late_master/{fees_late_master} | app/fees/master/fees-late-master/page.tsx:400 (1) |
| 813 | `/fees/fees_late_master/${encodeURIComponent(record.id)}` | MATCHED | A | GET /fees/fees_late_master/{fees_late_master} ; PUT /fees/fees_late_master/{fees_late_master} ; DELETE /fees/fees_late_master/{fees_late_master} | app/fees/master/fees-late-master/page.tsx:457 (1) |
| 814 | `/fees/fees_late_master/create` | MATCHED | A | GET /fees/fees_late_master/create ; GET /fees/fees_late_master/{fees_late_master} ; PUT /fees/fees_late_master/{fees_late_master} ...(+1) | app/fees/master/fees-late-master/page.tsx:244 (1) |
| 815 | `/fees/fees_receipt_book_master` | MATCHED | A | GET /fees/fees_receipt_book_master ; POST /fees/fees_receipt_book_master | app/fees/master/fees-receipt-book-master/page.tsx:323; app/fees/master/fees-receipt-book-master/page.tsx:761 (2) |
| 816 | `/fees/fees_receipt_book_master/create` | MATCHED | A | GET /fees/fees_receipt_book_master/create ; GET /fees/fees_receipt_book_master/{fees_receipt_book_master} ; PUT /fees/fees_receipt_book_master/{fees_receipt_book_master} ...(+1) | app/fees/master/fees-receipt-book-master/page.tsx:460 (1) |
| 817 | `/fees/fees_title` | MATCHED | A | GET /fees/fees_title ; POST /fees/fees_title | app/fees/master/new-fees-title-master/page.tsx:212; app/fees/master/new-fees-title-master/page.tsx:376 (2) |
| 818 | `/fees/fees_title/${encodeURIComponent(record.id)}` | MATCHED | A | GET /fees/fees_title/{fees_title} ; PUT /fees/fees_title/{fees_title} ; DELETE /fees/fees_title/{fees_title} | app/fees/master/new-fees-title-master/page.tsx:422 (1) |
| 819 | `/fees/fees_title/create` | MATCHED | A | GET /fees/fees_title/create ; GET /fees/fees_title/{fees_title} ; PUT /fees/fees_title/{fees_title} ...(+1) | app/fees/master/new-fees-title-master/page.tsx:243 (1) |
| 820 | `/fees/get-student` | MATCHED | A | GET /fees/get-student | app/fees/online_fees_collect/page.tsx:97 (1) |
| 821 | `/fees/map_year` | MATCHED | A | GET /fees/map_year ; POST /fees/map_year | app/fees/map_year/page.tsx:36 (1) |
| 822 | `/fees/NACH_s1excel_export/create` | MATCHED | A | GET /fees/NACH_s1excel_export/create ; GET /fees/NACH_s1excel_export/{NACH_s1excel_export} ; PUT /fees/NACH_s1excel_export/{NACH_s1excel_export} ...(+1) | app/fees/NACH_s1excel_export/page.tsx:93 (1) |
| 823 | `/fees/NACH_s3excel_export` | MATCHED | A | GET /fees/NACH_s3excel_export ; POST /fees/NACH_s3excel_export | app/fees/NACH_s3excel_export/page.tsx:106 (1) |
| 824 | `/fees/NACH_s3excel_export/create` | MATCHED | A | GET /fees/NACH_s3excel_export/create ; GET /fees/NACH_s3excel_export/{NACH_s3excel_export} ; PUT /fees/NACH_s3excel_export/{NACH_s3excel_export} ...(+1) | app/fees/NACH_s3excel_export/page.tsx:150 (1) |
| 825 | `/fees/NACH_s4excel_import` | MATCHED | A | GET /fees/NACH_s4excel_import ; POST /fees/NACH_s4excel_import | app/fees/NACH_s4excel_import/page.tsx:57 (1) |
| 826 | `/fees/online_fees_payment_api/${gateway}/preview` | MATCHED | A | GET /fees/online_fees_payment_api/{gateway}/preview | app/fees/online-payment/[gateway]/page.tsx:110 (1) |
| 827 | `/fees/online_fees_settings_api` | MATCHED | A | GET /fees/online_fees_settings_api ; POST /fees/online_fees_settings_api | app/fees/online-fees-settings/page.tsx:78 (1) |
| 828 | `/fees/other_fee_map` | MATCHED | A | GET /fees/other_fee_map ; POST /fees/other_fee_map | app/fees/master/additional-fees-mapping/page.tsx:292; app/fees/master/additional-fees-mapping/page.tsx:637 (2) |
| 829 | `/fees/other_fee_map/create` | MATCHED | A | GET /fees/other_fee_map/create ; GET /fees/other_fee_map/{other_fee_map} ; PUT /fees/other_fee_map/{other_fee_map} ...(+1) | app/fees/master/additional-fees-mapping/page.tsx:416 (1) |
| 830 | `/fees/other_fees_title` | MATCHED | A | GET /fees/other_fees_title ; POST /fees/other_fees_title | app/fees/master/other-fees-title/page.tsx:241; app/fees/master/other-fees-title/page.tsx:394 (2) |
| 831 | `/fees/other_fees_title/${encodeURIComponent(record.id)}` | MATCHED | A | GET /fees/other_fees_title/{other_fees_title} ; PUT /fees/other_fees_title/{other_fees_title} ; DELETE /fees/other_fees_title/{other_fees_title} | app/fees/master/other-fees-title/page.tsx:452 (1) |
| 832 | `/fees/update_fees_breackoff_api` | MATCHED | A | GET /fees/update_fees_breackoff_api ; POST /fees/update_fees_breackoff_api | app/fees/update-fees-breakoff/page.tsx:22; app/fees/update-fees-breakoff/page.tsx:34 (2) |
| 833 | `/fields-configuration` | ALT | N | GET /api/fields-configuration ; POST /api/fields-configuration | app/library/book_resources/page.tsx:376 (1) |
| 834 | `/forget-password` | MATCHED | N | GET /forget-password ; POST /forget-password | app/api/forgot-password/route.ts:88 (1) |
| 835 | `/front_desk/dicipline_report/create` | MATCHED | A | GET /front_desk/dicipline_report/create ; GET /front_desk/dicipline_report/{dicipline_report} ; PUT /front_desk/dicipline_report/{dicipline_report} ...(+1) | app/student/report/_lib/student-report.ts:320 (1) |
| 836 | `/frontdesk/book_list` | MATCHED | A | GET /frontdesk/book_list ; POST /frontdesk/book_list | app/lms/book-list/api.ts:102; app/lms/book-list/api.ts:215 (2) |
| 837 | `/frontdesk/book_list/${encodeURIComponent(id)}` | MATCHED | A | GET /frontdesk/book_list/{book_list} ; PUT /frontdesk/book_list/{book_list} ; DELETE /frontdesk/book_list/{book_list} | app/lms/book-list/api.ts:228 (1) |
| 838 | `/get_adminAcademicSection` | MATCHED | N | POST /get_adminAcademicSection | app/fees/master/additional-fees-mapping/page.tsx:176; app/fees/master/fees-breakoff/page.tsx:216 (3) |
| 839 | `/get_adminDivision` | MATCHED | N | POST /get_adminDivision | app/fees/master/additional-fees-mapping/page.tsx:255 (1) |
| 840 | `/get_adminStandard` | MATCHED | N | POST /get_adminStandard | app/fees/master/additional-fees-mapping/page.tsx:210; app/fees/master/fees-breakoff/page.tsx:258 (3) |
| 841 | `/get_adminStudentList` | MATCHED | N | POST /get_adminStudentList | app/pal/data/pal-legacy.ts:68 (1) |
| 842 | `/get_batch` | MATCHED | N | GET /get_batch | app/student/monthwise_student_attendance/page.tsx:524 (1) |
| 843 | `/get-h5p-ai-scenario` | MATCHED | N | POST /get-h5p-ai-scenario | app/h5p/data/h5p.ts:597 (1) |
| 844 | `/groupwise-rights/${profileId}/matrix` | ALT | N | GET /api/groupwise-rights/{profileId}/matrix | app/general/groupwise_rights/api.ts:190 (1) |
| 845 | `/h5p/${spec.path}/import` | MATCHED |  |  | app/h5p/data/h5p-content-types.ts:806 (1) |
| 846 | `/h5p/${spec.path}/media` | MATCHED |  |  | app/h5p/data/h5p-content-types.ts:742 (1) |
| 847 | `/h5p/h5p_drag_drop/import` | MATCHED | A | POST /h5p/h5p_drag_drop/import ; GET /h5p/h5p_drag_drop/{h5p_drag_drop} ; PUT /h5p/h5p_drag_drop/{h5p_drag_drop} ...(+1) | app/h5p/data/h5p.ts:1358 (1) |
| 848 | `/h5p/h5p_drag_drop/media` | MATCHED | A | POST /h5p/h5p_drag_drop/media ; GET /h5p/h5p_drag_drop/{h5p_drag_drop} ; PUT /h5p/h5p_drag_drop/{h5p_drag_drop} ...(+1) | app/h5p/data/h5p.ts:1296 (1) |
| 849 | `/h5p/h5p_flashacard` | MATCHED | A | GET /h5p/h5p_flashacard ; POST /h5p/h5p_flashacard | app/h5p/data/h5p.ts:934 (1) |
| 850 | `/h5p/h5p_flashacard/${id}` | MATCHED | A | GET /h5p/h5p_flashacard/{h5p_flashacard} ; PUT /h5p/h5p_flashacard/{h5p_flashacard} ; DELETE /h5p/h5p_flashacard/{h5p_flashacard} | app/h5p/data/h5p.ts:964; app/h5p/data/h5p.ts:985 (2) |
| 851 | `/h5p/h5p_interactive_video` | MATCHED | A | GET /h5p/h5p_interactive_video ; POST /h5p/h5p_interactive_video | app/h5p/data/h5p.ts:677 (1) |
| 852 | `/h5p/h5p_interactive_video/${id}` | MATCHED | A | GET /h5p/h5p_interactive_video/{h5p_interactive_video} ; PUT /h5p/h5p_interactive_video/{h5p_interactive_video} ; DELETE /h5p/h5p_interactive_video/{h5p_interactive_video} | app/h5p/data/h5p.ts:709; app/h5p/data/h5p.ts:730 (2) |
| 853 | `/h5p/scenario_based` | MATCHED | A | GET /h5p/scenario_based ; POST /h5p/scenario_based | app/h5p/data/h5p.ts:443 (1) |
| 854 | `/h5p/scenario_based/${id}` | MATCHED | A | GET /h5p/scenario_based/{scenario_based} ; PUT /h5p/scenario_based/{scenario_based} ; DELETE /h5p/scenario_based/{scenario_based} | app/h5p/data/h5p.ts:476; app/h5p/data/h5p.ts:494 (2) |
| 855 | `/import/match-fields` | ALT | A | POST /api/import/match-fields | app/api/import/match-fields/route.ts:33 (1) |
| 856 | `/import/parse` | ALT | A | POST /api/import/parse | app/api/import/parse/route.ts:38 (1) |
| 857 | `/import/process` | ALT | A | POST /api/import/process | app/api/import/process/route.ts:38 (1) |
| 858 | `/import/tables` | ALT | A | GET /api/import/tables | app/api/import/tables/route.ts:32 (1) |
| 859 | `/individual-rights/${profileId}/${userId}/matrix` | ALT | N | GET /api/individual-rights/{profileId}/{userId}/matrix | app/general/individual_rights/api.ts:217 (1) |
| 860 | `/individual-rights/${profileId}/users` | ALT | N | GET /api/individual-rights/{profileId}/users | app/general/individual_rights/api.ts:205 (1) |
| 861 | `/inward_outward/add_physical_file_location` | MATCHED | A | GET /inward_outward/add_physical_file_location ; POST /inward_outward/add_physical_file_location | app/inward_outward/_lib/api.ts:109 (1) |
| 862 | `/inward_outward/add_place_master` | MATCHED | A | GET /inward_outward/add_place_master ; POST /inward_outward/add_place_master | app/inward_outward/_lib/api.ts:105 (1) |
| 863 | `/library_report` | MATCHED | A | GET /library_report ; POST /library_report | app/library/book_resources/page.tsx:374; app/library/report/page.tsx:139 (2) |
| 864 | `/lms-assignment/ai-status/${assignmentId}` | ALT | N | POST /api/lms-assignment/ai-status/{id} | app/lms/lmsAnnotate_assignment/api.ts:335 (1) |
| 865 | `/lms-assignment/annotate-list` | ALT | A/N | POST /api/lms-assignment/annotate-list | app/lms/lmsAnnotate_assignment/api.ts:236 (1) |
| 866 | `/lms-assignment/annotate-questions` | ALT | A/N | POST /api/lms-assignment/annotate-questions | app/lms/lmsAnnotate_assignment/api.ts:284 (1) |
| 867 | `/lms-assignment/annotate-store` | ALT | A/N | POST /api/lms-assignment/annotate-store | app/lms/lmsAnnotate_assignment/api.ts:321 (1) |
| 868 | `/lms-assignment/bulk-delete` | ALT | N | POST /api/lms-assignment/bulk-delete | app/lms/lmsAnnotate_assignment/api.ts:274 (1) |
| 869 | `/lms-assignment/exam-papers` | ALT | A/N | POST /api/lms-assignment/exam-papers | app/lms/lmsAssignment/api.ts:214 (1) |
| 870 | `/lms-assignment/list` | ALT | A/N | POST /api/lms-assignment/list | app/lms/lmsAnnotate_assignment/api.ts:261 (1) |
| 871 | `/lms-assignment/store` | ALT | A/N | POST /api/lms-assignment/store | app/lms/lmsAssignment/api.ts:280 (1) |
| 872 | `/lms-assignment/students` | ALT | A/N | POST /api/lms-assignment/students | app/lms/lmsAssignment/api.ts:193 (1) |
| 873 | `/lms-assignment/submission-list` | ALT | A/N | POST /api/lms-assignment/submission-list | app/lms/lmsAssignment_submission/api.ts:193 (1) |
| 874 | `/lms-homework/ai-status/${homeworkId}` | ALT | N | POST /api/lms-homework/ai-status/{id} | app/lms/homework/api.ts:946 (1) |
| 875 | `/lms-homework/bulk-delete` | ALT | N | POST /api/lms-homework/bulk-delete | app/lms/homework/api.ts:883 (1) |
| 876 | `/lms-homework/detail/${homeworkId}` | ALT | A | POST /api/lms-homework/detail/{id} | app/lms/homework/api.ts:956 (1) |
| 877 | `/lms-homework/list` | ALT | N | POST /api/lms-homework/list | app/lms/homework/api.ts:870 (1) |
| 878 | `/lms-homework/my-submissions` | ALT | A | POST /api/lms-homework/my-submissions | app/lms/homework/api.ts:1042 (1) |
| 879 | `/lms-homework/question-bank/questions` | ALT | A | POST /api/lms-homework/question-bank/questions | app/lms/homework/api.ts:791 (1) |
| 880 | `/lms-homework/question-bank/types` | ALT | A | POST /api/lms-homework/question-bank/types | app/lms/homework/api.ts:780 (1) |
| 881 | `/lms-homework/review-detail/${submissionId}` | ALT | A | POST /api/lms-homework/review-detail/{id} | app/lms/homework/api.ts:1058 (1) |
| 882 | `/lms-homework/review-list` | ALT | A | POST /api/lms-homework/review-list | app/lms/homework/api.ts:1050 (1) |
| 883 | `/lms-homework/review-reprocess/${submissionId}` | ALT | A | POST /api/lms-homework/review-reprocess/{id} | app/lms/homework/api.ts:1075 (1) |
| 884 | `/lms-homework/review-store` | ALT | A | POST /api/lms-homework/review-store | app/lms/homework/api.ts:1094 (1) |
| 885 | `/lms-homework/students` | ALT | N | POST /api/lms-homework/students | app/lms/homework/api.ts:705 (1) |
| 886 | `/lms-homework/submission-list` | ALT | N | POST /api/lms-homework/submission-list | app/lms/homework/api.ts:896 (1) |
| 887 | `/lms-homework/submission-report` | ALT | N | POST /api/lms-homework/submission-report | app/lms/homework/api.ts:930 (1) |
| 888 | `/lms-homework/submission/ai-status/${submissionId}` | ALT | A | POST /api/lms-homework/submission/ai-status/{id} | app/lms/homework/api.ts:1035 (1) |
| 889 | `/lms/adaptive-practice` | MATCHED | N | GET /lms/adaptive-practice | app/lms/exam/page.tsx:1697; app/pal/data/pal.ts:1169 (2) |
| 890 | `/lms/ajax_LMS_ChapterwiseTopic` | MATCHED | A | GET /lms/ajax_LMS_ChapterwiseTopic | app/lms/book-list/api.ts:170 (1) |
| 891 | `/lms/ajax_LMS_SubjectwiseChapterForBooklist` | MATCHED | A | GET /lms/ajax_LMS_SubjectwiseChapterForBooklist | app/lms/book-list/api.ts:145 (1) |
| 892 | `/lms/ajax_LMS_SubjectWiseExam` | MATCHED | A | GET /lms/ajax_LMS_SubjectWiseExam | app/exam/data/progressReport.ts:130 (1) |
| 893 | `/lms/chapter-gate` | MATCHED | N | GET /lms/chapter-gate | app/pal/data/pal.ts:1497 (1) |
| 894 | `/lms/diagnostic-assessment` | MATCHED | N | GET /lms/diagnostic-assessment | app/pal/data/pal.ts:1343 (1) |
| 895 | `/lms/increment-content-visit` | MATCHED | A/N | POST /lms/increment-content-visit | app/pal/data/pal.ts:632 (1) |
| 896 | `/lms/lb_master` | MATCHED | A | GET /lms/lb_master ; POST /lms/lb_master | app/lms/leader-board-master/api.ts:115; app/lms/leader-board-master/api.ts:176 (2) |
| 897 | `/lms/lb_master/${encodeURIComponent(id)}` | MATCHED | A | GET /lms/lb_master/{lb_master} ; PUT /lms/lb_master/{lb_master} ; DELETE /lms/lb_master/{lb_master} | app/lms/leader-board-master/api.ts:175; app/lms/leader-board-master/api.ts:195 (2) |
| 898 | `/lms/lms_syllabus` | MATCHED | A | GET /lms/lms_syllabus ; POST /lms/lms_syllabus | app/lms/syllabus-plan/api.ts:92; app/lms/syllabus-plan/api.ts:183 (2) |
| 899 | `/lms/lms_syllabus/${encodeURIComponent(id)}` | MATCHED | A | GET /lms/lms_syllabus/{lms_syllabu} ; PUT /lms/lms_syllabus/{lms_syllabu} ; DELETE /lms/lms_syllabus/{lms_syllabu} | app/lms/syllabus-plan/api.ts:182; app/lms/syllabus-plan/api.ts:205 (2) |
| 900 | `/lms/lmsActivityStream` | MATCHED | A | GET /lms/lmsActivityStream ; POST /lms/lmsActivityStream | app/lms/data/activityStream.ts:191 (1) |
| 901 | `/lms/lmsCounselling` | MATCHED | A | GET /lms/lmsCounselling ; POST /lms/lmsCounselling | app/career-counselling/_lib/api.ts:93 (1) |
| 902 | `/lms/lmsCounsellingExam` | MATCHED | A | GET /lms/lmsCounsellingExam ; POST /lms/lmsCounsellingExam | app/career-counselling/_lib/api.ts:121 (1) |
| 903 | `/lms/lmsdashboard` | MATCHED | A | GET /lms/lmsdashboard ; POST /lms/lmsdashboard | app/lms/data/lmsDashboard.ts:212 (1) |
| 904 | `/lms/lmsExamwise_progress_report/create` | MATCHED | A | GET /lms/lmsExamwise_progress_report/create ; GET /lms/lmsExamwise_progress_report/{lmsExamwise_progress_report} ; PUT /lms/lmsExamwise_progress_report/{lmsExamwise_progress_report} ...(+1) | app/exam/data/progressReport.ts:193 (1) |
| 905 | `/lms/lmsmapping` | MATCHED | A | GET /lms/lmsmapping ; POST /lms/lmsmapping | app/lms/global-mapping/api.ts:70; app/lms/global-mapping/api.ts:119 (2) |
| 906 | `/lms/lmsmapping/${encodeURIComponent(id)}` | MATCHED | A | GET /lms/lmsmapping/{lmsmapping} ; PUT /lms/lmsmapping/{lmsmapping} ; DELETE /lms/lmsmapping/{lmsmapping} | app/lms/global-mapping/api.ts:142; app/lms/global-mapping/api.ts:157 (2) |
| 907 | `/lms/lmsMBTIPaper` | MATCHED | A | GET /lms/lmsMBTIPaper ; POST /lms/lmsMBTIPaper | app/career-counselling/_lib/api.ts:125 (1) |
| 908 | `/lms/lmsStudent_report/${encodeURIComponent(studentId)}/edit` | MATCHED | A | GET /lms/lmsStudent_report/{lmsStudent_report}/edit | app/lms/data/studentAnalysis.ts:160 (1) |
| 909 | `/lms/lmsStudent_report/create` | MATCHED | A | GET /lms/lmsStudent_report/create ; GET /lms/lmsStudent_report/{lmsStudent_report} ; PUT /lms/lmsStudent_report/{lmsStudent_report} ...(+1) | app/lms/data/studentAnalysis.ts:114 (1) |
| 910 | `/lms/misconception` | MATCHED | A/N | GET /lms/misconception | app/pal/data/pal.ts:559 (1) |
| 911 | `/lms/misconception/generate-content` | MATCHED | A/N | POST /lms/misconception/generate-content | app/pal/data/pal.ts:589 (1) |
| 912 | `/lms/new_chapter_master` | MATCHED | N | GET /lms/new_chapter_master ; POST /lms/new_chapter_master | app/course-master/data/chapters.ts:976 (1) |
| 913 | `/lms/online_exam` | MATCHED | A | GET /lms/online_exam ; POST /lms/online_exam | app/exam/data/onlineExam.ts:207; app/exam/data/onlineExam.ts:285 (3) |
| 914 | `/lms/online_exam_attempt` | MATCHED | A | GET /lms/online_exam_attempt | app/exam/data/onlineExam.ts:377 (1) |
| 915 | `/lms/online_exam/${encodeURIComponent(paperId)}` | MATCHED | A | GET /lms/online_exam/{online_exam} ; PUT /lms/online_exam/{online_exam} ; DELETE /lms/online_exam/{online_exam} | app/exam/data/onlineExam.ts:318 (1) |
| 916 | `/lms/pal` | MATCHED | A | GET /lms/pal ; POST /lms/pal | app/pal/data/pal-legacy.ts:185 (1) |
| 917 | `/lms/pal/${encodeURIComponent(questionPaperId)}` | MATCHED | A | GET /lms/pal/{pal} ; PUT /lms/pal/{pal} ; DELETE /lms/pal/{pal} | app/pal/data/pal.ts:962 (1) |
| 918 | `/lms/pal/adaptive/answer` | MATCHED | A | POST /lms/pal/adaptive/answer | app/pal/data/pal-diagnostic.ts:687 (1) |
| 919 | `/lms/pal/adaptive/chapter/${chapterId}` | MATCHED | A | GET /lms/pal/adaptive/chapter/{chapterId} | app/pal/data/pal-diagnostic.ts:540 (1) |
| 920 | `/lms/pal/adaptive/concept-result/${conceptId}` | MATCHED | A | GET /lms/pal/adaptive/concept-result/{conceptId} | app/pal/data/pal-diagnostic.ts:807 (1) |
| 921 | `/lms/pal/adaptive/concept/${conceptId}` | MATCHED | A | GET /lms/pal/adaptive/concept/{conceptId} | app/pal/data/pal-diagnostic.ts:615 (1) |
| 922 | `/lms/pal/create` | MATCHED | A | GET /lms/pal/create ; GET /lms/pal/{pal} ; PUT /lms/pal/{pal} ...(+1) | app/pal/data/pal.ts:711 (1) |
| 923 | `/lms/pal/diagnostic/attempt/${attemptId}/result` | MATCHED | A | GET /lms/pal/diagnostic/attempt/{attemptId}/result | app/pal/data/pal-diagnostic.ts:461 (1) |
| 924 | `/lms/pal/diagnostic/attempt/${input.attemptId}/submit` | MATCHED | A | POST /lms/pal/diagnostic/attempt/{attemptId}/submit | app/pal/data/pal-diagnostic.ts:437 (1) |
| 925 | `/lms/pal/diagnostic/chapter/${chapterId}` | MATCHED | A | GET /lms/pal/diagnostic/chapter/{chapterId} | app/pal/data/pal-diagnostic.ts:379 (1) |
| 926 | `/lms/pal/diagnostic/history/${chapterId}` | MATCHED | A | GET /lms/pal/diagnostic/history/{chapterId} | app/pal/data/pal-diagnostic.ts:485 (1) |
| 927 | `/lms/pal/learn/concept/${conceptId}` | MATCHED | A | GET /lms/pal/learn/concept/{conceptId} | app/pal/data/pal-diagnostic.ts:1471 (1) |
| 928 | `/lms/pal/learn/concept/${conceptId}/read` | MATCHED | A | POST /lms/pal/learn/concept/{conceptId}/read | app/pal/data/pal-diagnostic.ts:1454 (1) |
| 929 | `/lms/pal/mastery/chapter/${chapterId}` | MATCHED | A | GET /lms/pal/mastery/chapter/{chapterId} | app/pal/data/pal-diagnostic.ts:1107 (1) |
| 930 | `/lms/pal/plan/chapter/${chapterId}` | MATCHED | A | GET /lms/pal/plan/chapter/{chapterId} | app/pal/data/pal-diagnostic.ts:960 (1) |
| 931 | `/lms/pal/recall` | MATCHED | A | GET /lms/pal/recall ; GET /lms/pal/{pal} ; PUT /lms/pal/{pal} ...(+1) | app/pal/data/pal-diagnostic.ts:1184 (1) |
| 932 | `/lms/palreport` | MATCHED | A | GET /lms/palreport | app/pal/data/pal.ts:108 (1) |
| 933 | `/lms/pedagogy-suggested-content` | MATCHED | A/N | GET /lms/pedagogy-suggested-content | app/pal/data/pal.ts:487 (1) |
| 934 | `/lms/practice-history` | MATCHED | N | GET /lms/practice-history | app/pal/data/pal.ts:1616 (1) |
| 935 | `/lms/show_question_wise_report` | MATCHED | A | POST /lms/show_question_wise_report | app/lms/data/questionWiseReport.ts:106 (1) |
| 936 | `/lms/spaced-repetition` | MATCHED | N | GET /lms/spaced-repetition | app/pal/data/pal.ts:1569 (1) |
| 937 | `/lms/submit-diagnostic-assessment` | MATCHED | N | POST /lms/submit-diagnostic-assessment | app/pal/data/pal.ts:1422 (1) |
| 938 | `/lms/submit-practice` | MATCHED | N | POST /lms/submit-practice | app/lms/exam/page.tsx:1942; app/pal/data/pal.ts:1257 (2) |
| 939 | `/Lost_and_Damage` | MATCHED | A | GET /Lost_and_Damage ; POST /Lost_and_Damage | app/library/lost_damage_report/page.tsx:72 (1) |
| 940 | `/Lost_and_Damage/create` | MATCHED | A | GET /Lost_and_Damage/create ; GET /Lost_and_Damage/{Lost_and_Damage} ; PUT /Lost_and_Damage/{Lost_and_Damage} ...(+1) | app/library/lost_damage_report/page.tsx:109 (1) |
| 941 | `/mobile-app-rights/${profileId}/rights` | ALT | N | GET /api/mobile-app-rights/{profileId}/rights ; POST /api/mobile-app-rights/config/{id} | app/general/mobile_app_rights/api.ts:232 (1) |
| 942 | `/mobile-app-rights/bootstrap` | ALT | N | GET /api/mobile-app-rights/bootstrap | app/general/mobile_app_rights/api.ts:219 (1) |
| 943 | `/mobile-app-rights/config` | ALT | N | GET /api/mobile-app-rights/config ; POST /api/mobile-app-rights/config | app/general/mobile_app_rights/api.ts:258; app/general/mobile_app_rights/api.ts:292 (2) |
| 944 | `/mobile-app-rights/config/${id}` | ALT | N | GET /api/mobile-app-rights/{profileId}/rights ; POST /api/mobile-app-rights/config/{id} | app/general/mobile_app_rights/api.ts:264 (1) |
| 945 | `/mobile-app-rights/rights` | ALT | N | POST /api/mobile-app-rights/rights | app/general/mobile_app_rights/api.ts:243 (1) |
| 946 | `/mobile-page-builder/runtime/${encodeURIComponent(slug)}` | ALT | A | GET /api/mobile-page-builder/runtime/{slug} | app/mobile/custom/[slug]/page.tsx:85 (1) |
| 947 | `/mobile/dynamic-page-admin/fields/${fieldId}` | ALT | A | POST /api/mobile/dynamic-page-admin/fields/{fieldId} ; DELETE /api/mobile/dynamic-page-admin/fields/{fieldId} | app/general/native_dynamic_pages/api.ts:204; app/general/native_dynamic_pages/api.ts:212 (2) |
| 948 | `/mobile/dynamic-page-admin/pages` | ALT | A | GET /api/mobile/dynamic-page-admin/pages ; POST /api/mobile/dynamic-page-admin/pages | app/general/native_dynamic_pages/api.ts:161; app/general/native_dynamic_pages/api.ts:170 (2) |
| 949 | `/mobile/dynamic-page-admin/pages/${id}` | ALT | A | POST /api/mobile/dynamic-page-admin/pages/{id} | app/general/native_dynamic_pages/api.ts:185 (1) |
| 950 | `/mobile/dynamic-page-admin/pages/${pageId}/fields` | ALT | A | POST /api/mobile/dynamic-page-admin/pages/{id}/fields | app/general/native_dynamic_pages/api.ts:193 (1) |
| 951 | `/mobile/dynamic-page-admin/registry` | ALT | A | GET /api/mobile/dynamic-page-admin/registry | app/general/native_dynamic_pages/api.ts:147 (1) |
| 952 | `/modules/${encodeURIComponent(moduleKey)}` | ALT | A | GET,POST /api/modules/menu-categories | app/general/onboarding/_lib/onboarding-api.ts:732 (1) |
| 953 | `/monthly-payroll-report/pdf/${params.employeeId}/${params.month}/` | MATCHED |  |  | app/hrit/_lib/payroll-api.ts:944 (1) |
| 954 | `/pages/${id}` | OVERRIDE | A | GET /api/mobile-page-builder/pages/{id} ; POST /api/mobile-page-builder/pages/{id} ; DELETE /api/mobile-page-builder/pages/{id} | app/general/mobile_page_builder/api.ts:125; app/general/mobile_page_builder/api.ts:137 (3) |
| 955 | `/pages/${id}/draft` | OVERRIDE | A | POST /api/mobile-page-builder/pages/{id}/draft | app/general/mobile_page_builder/api.ts:145 (1) |
| 956 | `/pages/${id}/publish` | OVERRIDE | A | POST /api/mobile-page-builder/pages/{id}/publish | app/general/mobile_page_builder/api.ts:153 (1) |
| 957 | `/pages/${id}/versions` | OVERRIDE | A | GET /api/mobile-page-builder/pages/{id}/versions | app/general/mobile_page_builder/api.ts:160 (1) |
| 958 | `/print_barcode` | MATCHED | A | GET /print_barcode ; POST /print_barcode | app/library/print_barcode/page.tsx:103; app/library/print_barcode/page.tsx:129 (2) |
| 959 | `/ptm/add_ptm_attened_status` | MATCHED | A | GET /ptm/add_ptm_attened_status ; POST /ptm/add_ptm_attened_status | app/admin-services/_lib/ptm.ts:26 (1) |
| 960 | `/ptm/add_ptm_attened_status/create` | MATCHED | A | GET /ptm/add_ptm_attened_status/create ; GET /ptm/add_ptm_attened_status/{add_ptm_attened_statu} ; PUT /ptm/add_ptm_attened_status/{add_ptm_attened_statu} ...(+1) | app/admin-services/_lib/ptm.ts:174 (1) |
| 961 | `/ptm/add_ptm_time_slot_master` | MATCHED | A | GET /ptm/add_ptm_time_slot_master ; POST /ptm/add_ptm_time_slot_master | app/admin-services/_lib/ptm.ts:25 (1) |
| 962 | `/ptm/add_ptm_time_slot_master/${id}` | MATCHED | A | GET /ptm/add_ptm_time_slot_master/{add_ptm_time_slot_master} ; PUT /ptm/add_ptm_time_slot_master/{add_ptm_time_slot_master} ; DELETE /ptm/add_ptm_time_slot_master/{add_ptm_time_slot_master} | app/admin-services/_lib/ptm.ts:138; app/admin-services/_lib/ptm.ts:155 (2) |
| 963 | `/ptm/ptm_report` | MATCHED | A | GET /ptm/ptm_report | app/admin-services/_lib/ptm.ts:27 (1) |
| 964 | `/quick_return` | MATCHED | A | GET /quick_return ; POST /quick_return | app/library/quick_return/page.tsx:184 (1) |
| 965 | `/requirements/${id}` | MATCHED | N | GET /requirements/{requirement} ; PUT /requirements/{requirement} ; DELETE /requirements/{requirement} | app/general/add_process/api.ts:111; app/general/add_process/api.ts:123 (2) |
| 966 | `/requirements/${id}/edit` | MATCHED | N | GET /requirements/{requirement}/edit | app/general/add_process/api.ts:132 (1) |
| 967 | `/result_personalize_marks` | MATCHED | A | GET /result_personalize_marks ; POST /result_personalize_marks | app/pal/data/pal.ts:1675; app/pal/data/pal.ts:1731 (2) |
| 968 | `/result/cbse_11_t2_result/show_result` | MATCHED | A | GET /result/cbse_11_t2_result/{cbse_11_t2_result} ; PUT /result/cbse_11_t2_result/{cbse_11_t2_result} ; DELETE /result/cbse_11_t2_result/{cbse_11_t2_result} ...(+1) | app/result/report-card/cbse-11/page.tsx:40; app/result/report-card/cnse-11/page.tsx:38 (2) |
| 969 | `/result/cbse_1t5_result/show_result` | MATCHED | A | GET /result/cbse_1t5_result/{cbse_1t5_result} ; PUT /result/cbse_1t5_result/{cbse_1t5_result} ; DELETE /result/cbse_1t5_result/{cbse_1t5_result} ...(+1) | app/result/report-card/cbse-1t5/page.tsx:207 (1) |
| 970 | `/result/cbse_1t5_t2_result/show_result` | MATCHED | A | GET /result/cbse_1t5_t2_result/{cbse_1t5_t2_result} ; PUT /result/cbse_1t5_t2_result/{cbse_1t5_t2_result} ; DELETE /result/cbse_1t5_t2_result/{cbse_1t5_t2_result} ...(+1) | app/result/report-card/cbse-t2/page.tsx:171 (1) |
| 971 | `/result/exam_master` | MATCHED | A | GET /result/exam_master ; POST /result/exam_master | app/exam/exam-master/page.tsx:66 (1) |
| 972 | `/result/marks_entry/create` | MATCHED | A | GET /result/marks_entry/create ; GET /result/marks_entry/{marks_entry} ; PUT /result/marks_entry/{marks_entry} ...(+1) | app/exam/marks-entry/page.tsx:138 (1) |
| 973 | `/result/WRT_progress_report/show_result` | MATCHED | A | GET /result/WRT_progress_report/{WRT_progress_report} ; PUT /result/WRT_progress_report/{WRT_progress_report} ; DELETE /result/WRT_progress_report/{WRT_progress_report} ...(+1) | app/result/reports/wrt-progress/page.tsx:122 (1) |
| 974 | `/result/WRT_report/show_result` | MATCHED | A | GET /result/WRT_report/{WRT_report} ; PUT /result/WRT_report/{WRT_report} ; DELETE /result/WRT_report/{WRT_report} ...(+1) | app/result/reports/wrt/page.tsx:89 (1) |
| 975 | `/salary-certificate-pdf-download` | MATCHED | A | GET /salary-certificate-pdf-download | app/hrit/_lib/payroll-api.ts:932 (1) |
| 976 | `/scan_books` | MATCHED | A | GET /scan_books ; POST /scan_books | app/library/scan_book/page.tsx:160 (1) |
| 977 | `/scan_books_remarks` | MATCHED | A | GET /scan_books_remarks | app/library/add_book_remark/page.tsx:133; app/library/book_resources/page.tsx:375 (2) |
| 978 | `/scan_books_remarks/store` | MATCHED | A | POST /scan_books_remarks/store | app/library/add_book_remark/page.tsx:235 (1) |
| 979 | `/school_setup/ajax_deleteTimetableEntry` | MATCHED | A | POST /school_setup/ajax_deleteTimetableEntry | app/front_desk/create-timetable/api.ts:253 (1) |
| 980 | `/school_setup/ajax_getClasswiseTimetableApi` | MATCHED | A | POST /school_setup/ajax_getClasswiseTimetableApi | app/front_desk/classwisetimetable/api.ts:57 (1) |
| 981 | `/school_setup/ajax_getTimetableDivisions` | MATCHED | A | POST /school_setup/ajax_getTimetableDivisions | app/front_desk/create-timetable/api.ts:152 (1) |
| 982 | `/school_setup/ajax_getTimetableGrid` | MATCHED | A | POST /school_setup/ajax_getTimetableGrid | app/front_desk/create-timetable/api.ts:182 (1) |
| 983 | `/school_setup/ajax_getTimetableSections` | MATCHED | A | POST /school_setup/ajax_getTimetableSections | app/front_desk/create-timetable/api.ts:124 (1) |
| 984 | `/school_setup/ajax_getTimetableStandards` | MATCHED | A | POST /school_setup/ajax_getTimetableStandards | app/front_desk/create-timetable/api.ts:138 (1) |
| 985 | `/school_setup/ajax_saveTimetableEntry` | MATCHED | A | POST /school_setup/ajax_saveTimetableEntry | app/front_desk/create-timetable/api.ts:230 (1) |
| 986 | `/school_setup/lessonplanningReport` | MATCHED | A | GET /school_setup/lessonplanningReport ; POST /school_setup/lessonplanningReport | app/lms/data/teacherDiary.ts:70 (1) |
| 987 | `/school_setup/proxy_master/${id}` | MATCHED | A | GET /school_setup/proxy_master/{proxy_master} ; PUT /school_setup/proxy_master/{proxy_master} ; DELETE /school_setup/proxy_master/{proxy_master} | app/proxy_master/api.ts:230; app/proxy_master/api.ts:244 (2) |
| 988 | `/school_setup/proxy_master/create` | MATCHED | A | GET /school_setup/proxy_master/create ; GET /school_setup/proxy_master/{proxy_master} ; PUT /school_setup/proxy_master/{proxy_master} ...(+1) | app/proxy_master/api.ts:161 (1) |
| 989 | `/send-notification-parents/options` | OVERRIDE | A | GET /api/easy_com/send-notification-parents/options | app/easy_com/_components/EntryPage.tsx:95 (1) |
| 990 | `/send-sms-staff/groups` | OVERRIDE | A | GET /api/easy_com/send-sms-staff/groups | app/easy_com/_components/EntryPage.tsx:72 (1) |
| 991 | `/show_library_report` | MATCHED | A | POST /show_library_report | app/library/report/page.tsx:185 (1) |
| 992 | `/source-pages/${encodeURIComponent(key)}` | OVERRIDE | A | GET /api/mobile-page-builder/source-pages/{key} | app/general/mobile_page_builder/api.ts:286 (1) |
| 993 | `/steps/${stepId}` | OVERRIDE | A | POST /api/onboarding-modules/steps/{stepId} | app/general/onboarding/_lib/onboarding-api.ts:794 (1) |
| 994 | `/student/add_student` | MATCHED | A | GET /student/add_student ; POST /student/add_student | app/student/report/_lib/student-report.ts:121 (1) |
| 995 | `/student/agewise` | MATCHED | A | GET /student/agewise | app/student/report/_lib/student-report.ts:387 (1) |
| 996 | `/student/api/student_certificate/history` | MATCHED | N | GET /student/api/student_certificate/history | app/student/student_certificate/StudentCertificateModule.tsx:883 (1) |
| 997 | `/student/api/student_certificate/preview` | MATCHED | N | POST /student/api/student_certificate/preview | app/student/student_certificate/StudentCertificateModule.tsx:752 (1) |
| 998 | `/student/api/student_certificate/save` | MATCHED | N | POST /student/api/student_certificate/save | app/student/student_certificate/StudentCertificateModule.tsx:823 (1) |
| 999 | `/student/api/student_certificate/search` | MATCHED | N | POST /student/api/student_certificate/search | app/student/student_certificate/StudentCertificateModule.tsx:661 (1) |
| 1000 | `/student/api/student_certificate/templates` | MATCHED | N | GET /student/api/student_certificate/templates | app/student/student_certificate/StudentCertificateModule.tsx:488 (1) |
| 1001 | `/student/api/student_icard/metadata` | MATCHED | N | GET /student/api/student_icard/metadata | app/student/student_icard/page.tsx:359 (1) |
| 1002 | `/student/api/student_icard/preview` | MATCHED | N | POST /student/api/student_icard/preview | app/student/student_icard/page.tsx:539 (1) |
| 1003 | `/student/api/student_icard/search` | MATCHED | N | POST /student/api/student_icard/search | app/student/student_icard/page.tsx:445 (1) |
| 1004 | `/student/api/teacher_icard/metadata` | MATCHED | N | GET /student/api/teacher_icard/metadata | app/student/teacher_icard/TeacherIcardModule.tsx:300 (1) |
| 1005 | `/student/api/teacher_icard/preview` | MATCHED | N | POST /student/api/teacher_icard/preview | app/student/teacher_icard/TeacherIcardModule.tsx:463 (1) |
| 1006 | `/student/api/teacher_icard/search` | MATCHED | N | POST /student/api/teacher_icard/search | app/student/teacher_icard/TeacherIcardModule.tsx:376 (1) |
| 1007 | `/student/missing_document_report/create` | MATCHED | A | GET /student/missing_document_report/create ; GET /student/missing_document_report/{missing_document_report} ; PUT /student/missing_document_report/{missing_document_report} ...(+1) | app/student/report/_lib/student-report.ts:188 (1) |
| 1008 | `/student/rollover` | MATCHED | A | GET /student/rollover ; POST /student/rollover | app/Utility/breakoff-rollover/api.ts:28; app/Utility/rollover/api.ts:24 (2) |
| 1009 | `/student/rollover/create` | MATCHED | A | GET /student/rollover/create ; GET /student/rollover/{rollover} ; PUT /student/rollover/{rollover} ...(+1) | app/Utility/breakoff-rollover/api.ts:27; app/Utility/rollover/api.ts:25 (2) |
| 1010 | `/student/save_student_attendance` | MATCHED | A | POST /student/save_student_attendance | app/attendance/_lib/attendance-api.ts:272; app/student/student_attendance/page.tsx:700 (2) |
| 1011 | `/student/show_daywise_student_attendance` | MATCHED | A | POST /student/show_daywise_student_attendance | app/student/daywise_student_attendance/page.tsx:301 (1) |
| 1012 | `/student/show_monthwise_student_attendance` | MATCHED | A | POST /student/show_monthwise_student_attendance | app/attendance/_lib/attendance-api.ts:185; app/student/monthwise_student_attendance/page.tsx:677 (2) |
| 1013 | `/student/show_student` | MATCHED | A | POST /student/show_student | app/Utility/transfer-student/api.ts:19 (1) |
| 1014 | `/student/show_student_attendance` | MATCHED | A | POST /student/show_student_attendance | app/attendance/_lib/attendance-api.ts:142; app/student/student_attendance/page.tsx:627 (2) |
| 1015 | `/student/show_student_health_report` | MATCHED | A | POST /student/show_student_health_report | app/student/report/_lib/student-report.ts:288 (1) |
| 1016 | `/student/student_attendance` | MATCHED | A | GET /student/student_attendance ; POST /student/student_attendance | app/attendance/_lib/attendance-api.ts:114; app/student/student_attendance/page.tsx:462 (2) |
| 1017 | `/student/student_bulk_update` | MATCHED | A | GET /student/student_bulk_update ; POST /student/student_bulk_update | app/Utility/breakoff-rollover/api.ts:29; app/Utility/update-all-data/api.ts:28 (2) |
| 1018 | `/student/student_request` | MATCHED | A | GET /student/student_request ; POST /student/student_request | app/students/requests/api.ts:187 (1) |
| 1019 | `/student/student_request_fixed` | MATCHED | A | GET /student/student_request_fixed | app/students/requests/api.ts:62 (1) |
| 1020 | `/student/student_request_report_fixed/create` | MATCHED | A | GET /student/student_request_report_fixed/create | app/student/report/_lib/student-report.ts:251 (1) |
| 1021 | `/student/student_request/${encodeURIComponent(id)}/status` | MATCHED | A | POST /student/student_request/{id}/status | app/students/requests/api.ts:80 (1) |
| 1022 | `/student/student_request/create` | MATCHED | A | GET /student/student_request/create ; GET /student/student_request/{student_request} ; PUT /student/student_request/{student_request} ...(+1) | app/students/requests/api.ts:139 (1) |
| 1023 | `/student/student_strength_report/create` | MATCHED | A | GET /student/student_strength_report/create ; GET /student/student_strength_report/{student_strength_report} ; PUT /student/student_strength_report/{student_strength_report} ...(+1) | app/student/report/_lib/student-report.ts:360 (1) |
| 1024 | `/student/student_transfer` | MATCHED | A | GET /student/student_transfer ; POST /student/student_transfer | app/Utility/student-transfer/api.ts:25 (1) |
| 1025 | `/student/student_transfer/create` | MATCHED | A | GET /student/student_transfer/create ; GET /student/student_transfer/{student_transfer} ; PUT /student/student_transfer/{student_transfer} ...(+1) | app/Utility/student-transfer/api.ts:26 (1) |
| 1026 | `/student/transfer_student` | MATCHED | A | GET /student/transfer_student ; POST /student/transfer_student | app/Utility/transfer-student/api.ts:20 (1) |
| 1027 | `/student/yearly_student_attendance` | MATCHED | A | GET /student/yearly_student_attendance ; POST /student/yearly_student_attendance | app/student/yearly_student_attendance/page.tsx:348 (1) |
| 1028 | `/table_data` | MATCHED | N | GET /table_data | app/talent-management/recruitment/components/job-posting-form.tsx:130; app/talent-management/recruitment/components/job-posting-form.tsx:159 (3) |
| 1029 | `/teacher-daily-reports/${input.teacherId}/details` | ALT | N | GET /api/teacher-daily-reports/{teacherId}/details | app/teacher_daily_report/api.ts:136 (1) |
| 1030 | `/teacher-daily-reports/search` | ALT | N | POST /api/teacher-daily-reports/search | app/teacher_daily_report/api.ts:108 (1) |
| 1031 | `/user-logs/bootstrap` | ALT | N | GET /api/user-logs/bootstrap | app/user_log/api.ts:86 (1) |
| 1032 | `/user-logs/search` | ALT | N | POST /api/user-logs/search | app/user_log/api.ts:99 (1) |
| 1033 | `/user-profiles/${id}` | ALT | N | POST /api/user-profiles/{id} | app/user/api.ts:104 (1) |
| 1034 | `/user-profiles/${id}/delete` | ALT | N | POST /api/user-profiles/{id}/delete | app/user/api.ts:108 (1) |
| 1035 | `/user-reports/bootstrap` | ALT | N | GET /api/user-reports/bootstrap | app/user/api.ts:112 (1) |
| 1036 | `/user-reports/search` | ALT | N | POST /api/user-reports/search | app/user/api.ts:119 (1) |
| 1037 | `/users/${id}` | ALT | N | GET /api/users/{id} ; POST /api/users/{id} | app/user/api.ts:85 (1) |
| 1038 | `/users/${id}/deactivate` | ALT | N | POST /api/users/{id}/deactivate | app/user/api.ts:96 (1) |
| 1039 | `/verified_book_report` | MATCHED | A | GET /verified_book_report | app/library/scanned_book_report/page.tsx:88 (1) |
| 1040 | `/verified_book_report_pending` | MATCHED | A | GET /verified_book_report_pending | app/library/pending_scan_report/page.tsx:85 (1) |
| 1041 | `/visitor_management/add_visitor_master` | MATCHED | A/N | GET /visitor_management/add_visitor_master ; POST /visitor_management/add_visitor_master | app/admin-services/_lib/visitor.ts:42 (1) |
| 1042 | `/visitor_management/add_visitor_master/${id}` | MATCHED | A | GET /visitor_management/add_visitor_master/{add_visitor_master} ; PUT /visitor_management/add_visitor_master/{add_visitor_master} ; DELETE /visitor_management/add_visitor_master/{add_visitor_master} | app/admin-services/_lib/visitor.ts:313; app/admin-services/_lib/visitor.ts:318 (2) |

## 3. Calls to Laravel routes that do not exist (UNMATCHED after all inference) - 47 distinct paths

| # | Frontend path | Sites (n) | Assessment |
|---|---|---|---|
| 1 | `/api/competency/assessments` | app/talent-management/_lib/employee-profiles-api.ts:340 (1) | No POST /api/competency/assessments (employee-profiles-api.ts:340 requestReassessment). |
| 2 | `/api/competency/learning-assignments` | app/talent-management/_lib/development-career-api.ts:653; app/talent-management/_lib/development-career-api.ts:658 (2) | No /api/competency/learning-assignments* route in competency_management.php (frontend development-career-api.ts:653-683: list/assign/update/courses). The development & career learning-assignments feature has no backend. |
| 3 | `/api/competency/learning-assignments/${id}` | app/talent-management/_lib/development-career-api.ts:668; app/talent-management/_lib/development-career-api.ts:676 (2) | No /api/competency/learning-assignments* route in competency_management.php (frontend development-career-api.ts:653-683: list/assign/update/courses). The development & career learning-assignments feature has no backend. |
| 4 | `/api/competency/learning-assignments/courses` | app/talent-management/_lib/development-career-api.ts:683 (1) | No /api/competency/learning-assignments* route in competency_management.php (frontend development-career-api.ts:653-683: list/assign/update/courses). The development & career learning-assignments feature has no backend. |
| 5 | `/api/departments-management/${id}/merge` | components/domain/organization/department-management/organization-service.ts:264 (1) | Laravel has POST /api/departments-management/merge (no {id}) and PATCH /{id}/head (api.php:733-742) but no /{id}/merge or /{id}/parent. Merge-department and set-parent actions 404. |
| 6 | `/api/departments-management/${id}/parent` | components/domain/organization/department-management/organization-service.ts:284 (1) | Laravel has POST /api/departments-management/merge (no {id}) and PATCH /{id}/head (api.php:733-742) but no /{id}/merge or /{id}/parent. Merge-department and set-parent actions 404. |
| 7 | `/api/g2g-lms/assessments/attempts` | components/domain/lms/assessments/assessments-service.ts:210 (1) | Contract drift: Laravel registers assessments/assessment-cycles/* and assessments/ai-assessment/* (g2g_lms.php:263-291) plus assessments/assessments; the service (assessments-service.ts header, lines 11-37) maps to /cycles/*, /tests, /attempts, /proposals, /mine, /submit, /start, /my-result. Names differ, and attempts/proposals/start/mark/assign have no Laravel route at all. The Assessments screens cannot load. |
| 8 | `/api/g2g-lms/assessments/attempts/${attemptId}/answers` | components/domain/lms/assessments/assessments-service.ts:220 (1) | Contract drift: Laravel registers assessments/assessment-cycles/* and assessments/ai-assessment/* (g2g_lms.php:263-291) plus assessments/assessments; the service (assessments-service.ts header, lines 11-37) maps to /cycles/*, /tests, /attempts, /proposals, /mine, /submit, /start, /my-result. Names differ, and attempts/proposals/start/mark/assign have no Laravel route at all. The Assessments screens cannot load. |
| 9 | `/api/g2g-lms/assessments/attempts/${attemptId}/mark` | components/domain/lms/assessments/assessments-service.ts:329 (1) | Contract drift: Laravel registers assessments/assessment-cycles/* and assessments/ai-assessment/* (g2g_lms.php:263-291) plus assessments/assessments; the service (assessments-service.ts header, lines 11-37) maps to /cycles/*, /tests, /attempts, /proposals, /mine, /submit, /start, /my-result. Names differ, and attempts/proposals/start/mark/assign have no Laravel route at all. The Assessments screens cannot load. |
| 10 | `/api/g2g-lms/assessments/cycles` | components/domain/lms/assessments/assessments-service.ts:146; components/domain/lms/assessments/assessments-service.ts:152 (2) | Contract drift: Laravel registers assessments/assessment-cycles/* and assessments/ai-assessment/* (g2g_lms.php:263-291) plus assessments/assessments; the service (assessments-service.ts header, lines 11-37) maps to /cycles/*, /tests, /attempts, /proposals, /mine, /submit, /start, /my-result. Names differ, and attempts/proposals/start/mark/assign have no Laravel route at all. The Assessments screens cannot load. |
| 11 | `/api/g2g-lms/assessments/cycles/${cycleId}/participants` | components/domain/lms/assessments/assessments-service.ts:149 (1) | Contract drift: Laravel registers assessments/assessment-cycles/* and assessments/ai-assessment/* (g2g_lms.php:263-291) plus assessments/assessments; the service (assessments-service.ts header, lines 11-37) maps to /cycles/*, /tests, /attempts, /proposals, /mine, /submit, /start, /my-result. Names differ, and attempts/proposals/start/mark/assign have no Laravel route at all. The Assessments screens cannot load. |
| 12 | `/api/g2g-lms/assessments/cycles/approvals` | components/domain/lms/assessments/assessments-service.ts:161 (1) | Contract drift: Laravel registers assessments/assessment-cycles/* and assessments/ai-assessment/* (g2g_lms.php:263-291) plus assessments/assessments; the service (assessments-service.ts header, lines 11-37) maps to /cycles/*, /tests, /attempts, /proposals, /mine, /submit, /start, /my-result. Names differ, and attempts/proposals/start/mark/assign have no Laravel route at all. The Assessments screens cannot load. |
| 13 | `/api/g2g-lms/assessments/cycles/assessments/${id}/review` | components/domain/lms/assessments/assessments-service.ts:167 (1) | Contract drift: Laravel registers assessments/assessment-cycles/* and assessments/ai-assessment/* (g2g_lms.php:263-291) plus assessments/assessments; the service (assessments-service.ts header, lines 11-37) maps to /cycles/*, /tests, /attempts, /proposals, /mine, /submit, /start, /my-result. Names differ, and attempts/proposals/start/mark/assign have no Laravel route at all. The Assessments screens cannot load. |
| 14 | `/api/g2g-lms/assessments/cycles/calibration` | components/domain/lms/assessments/assessments-service.ts:158 (1) | Contract drift: Laravel registers assessments/assessment-cycles/* and assessments/ai-assessment/* (g2g_lms.php:263-291) plus assessments/assessments; the service (assessments-service.ts header, lines 11-37) maps to /cycles/*, /tests, /attempts, /proposals, /mine, /submit, /start, /my-result. Names differ, and attempts/proposals/start/mark/assign have no Laravel route at all. The Assessments screens cannot load. |
| 15 | `/api/g2g-lms/assessments/cycles/closed` | components/domain/lms/assessments/assessments-service.ts:164 (1) | Contract drift: Laravel registers assessments/assessment-cycles/* and assessments/ai-assessment/* (g2g_lms.php:263-291) plus assessments/assessments; the service (assessments-service.ts header, lines 11-37) maps to /cycles/*, /tests, /attempts, /proposals, /mine, /submit, /start, /my-result. Names differ, and attempts/proposals/start/mark/assign have no Laravel route at all. The Assessments screens cannot load. |
| 16 | `/api/g2g-lms/assessments/cycles/metrics` | components/domain/lms/assessments/assessments-service.ts:143 (1) | Contract drift: Laravel registers assessments/assessment-cycles/* and assessments/ai-assessment/* (g2g_lms.php:263-291) plus assessments/assessments; the service (assessments-service.ts header, lines 11-37) maps to /cycles/*, /tests, /attempts, /proposals, /mine, /submit, /start, /my-result. Names differ, and attempts/proposals/start/mark/assign have no Laravel route at all. The Assessments screens cannot load. |
| 17 | `/api/g2g-lms/assessments/cycles/participant-ratings` | components/domain/lms/assessments/assessments-service.ts:155 (1) | Contract drift: Laravel registers assessments/assessment-cycles/* and assessments/ai-assessment/* (g2g_lms.php:263-291) plus assessments/assessments; the service (assessments-service.ts header, lines 11-37) maps to /cycles/*, /tests, /attempts, /proposals, /mine, /submit, /start, /my-result. Names differ, and attempts/proposals/start/mark/assign have no Laravel route at all. The Assessments screens cannot load. |
| 18 | `/api/g2g-lms/assessments/mine` | components/domain/lms/assessments/assessments-service.ts:275 (1) | Contract drift: Laravel registers assessments/assessment-cycles/* and assessments/ai-assessment/* (g2g_lms.php:263-291) plus assessments/assessments; the service (assessments-service.ts header, lines 11-37) maps to /cycles/*, /tests, /attempts, /proposals, /mine, /submit, /start, /my-result. Names differ, and attempts/proposals/start/mark/assign have no Laravel route at all. The Assessments screens cannot load. |
| 19 | `/api/g2g-lms/assessments/my-result` | components/domain/lms/assessments/assessments-service.ts:337 (1) | Contract drift: Laravel registers assessments/assessment-cycles/* and assessments/ai-assessment/* (g2g_lms.php:263-291) plus assessments/assessments; the service (assessments-service.ts header, lines 11-37) maps to /cycles/*, /tests, /attempts, /proposals, /mine, /submit, /start, /my-result. Names differ, and attempts/proposals/start/mark/assign have no Laravel route at all. The Assessments screens cannot load. |
| 20 | `/api/g2g-lms/assessments/proposals` | components/domain/lms/assessments/assessments-service.ts:247 (1) | Contract drift: Laravel registers assessments/assessment-cycles/* and assessments/ai-assessment/* (g2g_lms.php:263-291) plus assessments/assessments; the service (assessments-service.ts header, lines 11-37) maps to /cycles/*, /tests, /attempts, /proposals, /mine, /submit, /start, /my-result. Names differ, and attempts/proposals/start/mark/assign have no Laravel route at all. The Assessments screens cannot load. |
| 21 | `/api/g2g-lms/assessments/proposals/${id}/decide` | components/domain/lms/assessments/assessments-service.ts:261 (1) | Contract drift: Laravel registers assessments/assessment-cycles/* and assessments/ai-assessment/* (g2g_lms.php:263-291) plus assessments/assessments; the service (assessments-service.ts header, lines 11-37) maps to /cycles/*, /tests, /attempts, /proposals, /mine, /submit, /start, /my-result. Names differ, and attempts/proposals/start/mark/assign have no Laravel route at all. The Assessments screens cannot load. |
| 22 | `/api/g2g-lms/assessments/responses/${responseId}/score` | components/domain/lms/assessments/assessments-service.ts:230 (1) | Contract drift: Laravel registers assessments/assessment-cycles/* and assessments/ai-assessment/* (g2g_lms.php:263-291) plus assessments/assessments; the service (assessments-service.ts header, lines 11-37) maps to /cycles/*, /tests, /attempts, /proposals, /mine, /submit, /start, /my-result. Names differ, and attempts/proposals/start/mark/assign have no Laravel route at all. The Assessments screens cannot load. |
| 23 | `/api/g2g-lms/assessments/start` | components/domain/lms/assessments/assessments-service.ts:307 (1) | Contract drift: Laravel registers assessments/assessment-cycles/* and assessments/ai-assessment/* (g2g_lms.php:263-291) plus assessments/assessments; the service (assessments-service.ts header, lines 11-37) maps to /cycles/*, /tests, /attempts, /proposals, /mine, /submit, /start, /my-result. Names differ, and attempts/proposals/start/mark/assign have no Laravel route at all. The Assessments screens cannot load. |
| 24 | `/api/g2g-lms/assessments/submit` | components/domain/lms/assessments/assessments-service.ts:301 (1) | Contract drift: Laravel registers assessments/assessment-cycles/* and assessments/ai-assessment/* (g2g_lms.php:263-291) plus assessments/assessments; the service (assessments-service.ts header, lines 11-37) maps to /cycles/*, /tests, /attempts, /proposals, /mine, /submit, /start, /my-result. Names differ, and attempts/proposals/start/mark/assign have no Laravel route at all. The Assessments screens cannot load. |
| 25 | `/api/g2g-lms/assessments/tests` | components/domain/lms/assessments/assessments-service.ts:174 (1) | Contract drift: Laravel registers assessments/assessment-cycles/* and assessments/ai-assessment/* (g2g_lms.php:263-291) plus assessments/assessments; the service (assessments-service.ts header, lines 11-37) maps to /cycles/*, /tests, /attempts, /proposals, /mine, /submit, /start, /my-result. Names differ, and attempts/proposals/start/mark/assign have no Laravel route at all. The Assessments screens cannot load. |
| 26 | `/api/g2g-lms/assessments/tests/${id}` | components/domain/lms/assessments/assessments-service.ts:187 (1) | Contract drift: Laravel registers assessments/assessment-cycles/* and assessments/ai-assessment/* (g2g_lms.php:263-291) plus assessments/assessments; the service (assessments-service.ts header, lines 11-37) maps to /cycles/*, /tests, /attempts, /proposals, /mine, /submit, /start, /my-result. Names differ, and attempts/proposals/start/mark/assign have no Laravel route at all. The Assessments screens cannot load. |
| 27 | `/api/g2g-lms/assessments/tests/${id}/assign` | components/domain/lms/assessments/assessments-service.ts:202 (1) | Contract drift: Laravel registers assessments/assessment-cycles/* and assessments/ai-assessment/* (g2g_lms.php:263-291) plus assessments/assessments; the service (assessments-service.ts header, lines 11-37) maps to /cycles/*, /tests, /attempts, /proposals, /mine, /submit, /start, /my-result. Names differ, and attempts/proposals/start/mark/assign have no Laravel route at all. The Assessments screens cannot load. |
| 28 | `/api/g2g-lms/learning-dashboard/enroll/${courseId}` | components/domain/lms/dashboard/dashboard-service.ts:386 (1) | DELETE unenrol (dashboard-service.ts:386) - g2g_lms.php:45 defines only POST learning-dashboard/enroll. Comment in the source admits "NOT in the given contract table". => 404/405 (unenrol and updateEnrollment broken). |
| 29 | `/api/g2g-lms/learning-dashboard/enroll/${enrollmentId}` | components/domain/lms/dashboard/dashboard-service.ts:398 (1) | PUT move enrolment (dashboard-service.ts:398) - no such route (see above). |
| 30 | `/api/google-auth` | app/api/google-auth/route.ts:76 (1) | No route named google-auth exists in any of the 42 route files (grep "google" in routes/ finds only google-analytics-summary). Frontend proxy app/api/google-auth/route.ts:16 LARAVEL_PATH posts here; login page (app/login/page.tsx:41) offers Google sign-in. => Google login cannot work against this backend (Laravel 404/HTML). |
| 31 | `/api/lesson-intelligence` | app/course-master/lesson-plan/[courseId]/LessonIntelligencePanel.tsx:154 (1) | Root only; the panel appends sub-paths (dropdowns, capacity, macro-plan ... all exist at api.php:611+). Not a defect. |
| 32 | `/api/lms/ai/outline` | app/capability-intelligence/_lib/competency-extras-api.ts:275 (1) | Source marks it "GAP: /lms/ai/* not given" (competency-extras-api.ts:214). No /api/lms/ai/* route exists (ai.php uses /api/ai/*). |
| 33 | `/api/lms/ai/presentation` | app/capability-intelligence/_lib/competency-extras-api.ts:278 (1) | Source marks it "GAP: /lms/ai/* not given" (competency-extras-api.ts:214). No /api/lms/ai/* route exists (ai.php uses /api/ai/*). |
| 34 | `/api/lms/ai/presentation/${generationId}` | app/capability-intelligence/_lib/competency-extras-api.ts:286 (1) | Source marks it "GAP: /lms/ai/* not given" (competency-extras-api.ts:214). No /api/lms/ai/* route exists (ai.php uses /api/ai/*). |
| 35 | `/api/lms/ai/status` | app/capability-intelligence/_lib/competency-extras-api.ts:272 (1) | Source marks it "GAP: /lms/ai/* not given" (competency-extras-api.ts:214). No /api/lms/ai/* route exists (ai.php uses /api/ai/*). |
| 36 | `/api/pal/intervention` | app/pal/data/pal-intervention.ts:507; app/pal/data/pal-intervention.ts:537 (2) | No /api/pal/intervention route in pal_api.php, pal_eso_api.php or anywhere (grep "intervention" routes/ = 0). Frontend (app/pal/data/pal-intervention.ts:507-595 open/list/close) is written to degrade ("Returns null when the route is not deployed"). Missing backend for the PAL intervention queue. |
| 37 | `/api/pal/intervention/${id}` | app/pal/data/pal-intervention.ts:575 (1) | as above (GET/PATCH) |
| 38 | `/api/pal/intervention/${id}/close` | app/pal/data/pal-intervention.ts:595 (1) | as above |
| 39 | `/api/skill_library/${skillId}/edit` | app/capability-intelligence/_lib/competency-extras-api.ts:206 (1) | Source marks it "GAP: GET /skill_library/{id}/edit - not in the given backend context" (competency-extras-api.ts:203). Only the web route /lms/skill_library/{id}/edit exists (lms.php:118). |
| 40 | `/api/talent/admin/workflows/${id}` | app/talent-management/_lib/administration-api.ts:105 (1) | Only GET /api/talent/admin/workflows (index) is registered (talent_management.php:317); workflow detail is missing. |
| 41 | `/api/user-rejected-tasks-courses` | app/task-management/_lib/reports-api.ts:48 (1) | Called by task-management/_lib/reports-api.ts:48 getRejectedTaskLearning; no such route in task_management.php / api.php. |
| 42 | `/api/v1/chat/completions` | app/api/screenCandidate/route.ts:20 (1) | External LLM endpoint (OpenRouter) - not a Laravel route. |
| 43 | `/N/A` | app/fees/other_fees_collect/page.tsx:261; app/fees/other_fees_collect/page.tsx:262 (2) | Placeholder string literal used as a sentinel in app/fees/other_fees_collect/page.tsx:261-262, not an endpoint. |
| 44 | `/people-competency/lms/learning-catalog` | components/domain/lms/course-builder/create-course-page.tsx:99 (1) | A Next page path constant (not an API). |
| 45 | `/result/getMarksApproval` | app/result/reports/marks-approval/page.tsx:137 (1) | Frontend posts `result/getMarksApproval` (marks-approval/page.tsx:137); Laravel has `POST /result/marks_entry/getMarksApproval` (result.php:111). Path mismatch => 404; marks-approval report cannot load. |
| 46 | `/result/save_result_html` | app/result/report-card/cbse-1t5/page.tsx:221; app/result/report-card/cbse-t2/page.tsx:186 (4) | Frontend posts to `${API_BASE_URL}/result/save_result_html` (lib/result/api.ts resultPost, 4 report-card pages) but Laravel registers `POST /save_result_html` (routes/result.php:212, no `result/` prefix, and no auth middleware). => 404 from the Next-facing call, and the route that does exist is unauthenticated. |
| 47 | `/task/${id}` | app/task-management/_lib/my-tasks-api.ts:251 (1) | Legacy task update/delete (my-tasks-api.ts:244,251) posts/deletes `/task/{id}`; Laravel only has `/frontdesk/task/{task}` (frontdesk.php:25) and `/api/task-management/...`. => 404 for legacy task edit/delete (the comment at my-tasks-api.ts:24 lists /task as a G2G legacy route that was never ported). |

Confirmed missing / mismatched backend routes (broken features): /api/google-auth; /api/pal/intervention(+/{id},/{id}/close); result/getMarksApproval and result/save_result_html (path mismatch); /task/{id} (legacy); /api/user-rejected-tasks-courses; DELETE|PUT /api/g2g-lms/learning-dashboard/enroll/{id}; G2G assessments (21 paths, contract drift); competency learning-assignments (5), competency/assessments (1), skill_library edit (1), lms/ai/* (4), departments-management {id}/merge and {id}/parent (2), talent/admin/workflows/{id} (1). False positives in the table: /api/v1/chat/completions (external LLM), /api/lesson-intelligence (root), /N/A, /people-competency/... (page constant).

## 4. NOT VERIFIED - dynamically built paths (28 distinct)

The path prefix or a whole segment is computed at runtime (`${path}`, `${module}`, `${endpoint}`...). Their concrete callers pass literals that ARE included in section 2 when the same file (or an exported wrapper) carries a recognised prefix; anything else is unverifiable statically.

| # | Template | Site (n) |
|---|---|---|
| 1 | `/api/${endpoint}` | app/fees/circulars/page.tsx:919; components/mobile-page-builder/renderer/MobilePageRenderer.tsx:245 (3) |
| 2 | `/api/${path}` | app/api/import/match-fields/route.ts:8; app/api/import/parse/route.ts:8 (19) |
| 3 | `/api/academic-setup/${module}${path}` | app/academic_setup/api.ts:149 (1) |
| 4 | `/api/ai/capabilities${path}` | lib/intelligence/ai-capabilities.ts:103 (1) |
| 5 | `/api/ai/workspace${path}` | lib/intelligence/workspace.ts:264 (1) |
| 6 | `/api/ai${path}` | lib/intelligence/ai-configuration.ts:176; lib/intelligence/ai-module.ts:201 (5) |
| 7 | `/api/assessment-blueprints${path}` | app/lms/exam/_assessment-blueprint/api.ts:76 (1) |
| 8 | `/api/brain${path}` | lib/brain/api.ts:105 (1) |
| 9 | `/api/document-templates${path}` | app/document-templates/api.ts:147 (1) |
| 10 | `/api/g2g-lms/administration-governance${path}` | components/domain/lms/administration-governance/administration-governance-service.ts:65 (1) |
| 11 | `/api/g2g-lms/assessments${path}` | components/domain/lms/assessments/assessments-service.ts:74 (1) |
| 12 | `/api/g2g-lms/assignments${path}` | components/domain/lms/assignments/assignments-service.ts:138 (1) |
| 13 | `/api/g2g-lms/sessions-calendar${path}` | components/domain/lms/sessions-calendar/sessions-calendar-service.ts:133 (1) |
| 14 | `/api/inventory/${module}${suffix}${separator}` | app/Inventory/api.ts:63 (1) |
| 15 | `/api/lms/social-collaborative${path}` | app/lms/data/socialCollaborative.ts:107 (1) |
| 16 | `/api/mcp${path}` | lib/ai/mcp-client.ts:67 (1) |
| 17 | `/api/pal/${RISK_ENDPOINT[kind]}/${encodeURIComponent(learnerId)}` | app/pal/data/pal-v4.ts:390 (1) |
| 18 | `/api/platform${path}` | lib/event-bus/client.ts:135; lib/platform/client.ts:64 (2) |
| 19 | `/api${path}` | app/quiz/_lib/quiz-api.ts:60; app/talent-management/_lib/offboarding-api.ts:57 (3) |
| 20 | `/attendance` | app/hrit/_lib/attendance-api.ts:387 (1) |
| 21 | `/books/${ids.join(',')}` | app/library/book_resources/page.tsx:667 (1) |
| 22 | `/bulk` | app/Transportation/api.ts:334 (1) |
| 23 | `/bulk-delete` | app/Transportation/api.ts:352 (1) |
| 24 | `/compliance` | app/hrit/_lib/attendance-api.ts:485 (1) |
| 25 | `/inward_outward/add_${kind}` | app/inward_outward/_lib/api.ts:113 (1) |
| 26 | `/inward_outward/add_${kind}/create` | app/inward_outward/_lib/api.ts:117 (1) |
| 27 | `/multiple` | app/Inventory/api.ts:162 (1) |
| 28 | `/tags` | app/general/api.ts:95 (1) |

## 5. Laravel routes called by the frontend that have NO authenticating middleware (249 routes)

A route is listed when the frontend path matches it strictly (frontend wildcard segments only land on Laravel {param} segments). "ctl token text" = the controller file contains a JWT/Authorization/hydrate reference (an in-controller check may exist - NOT VERIFIED per action); "no token text" = no such reference anywhere in the controller (strong evidence the action is unauthenticated). Legit public endpoints (login, forgot-password, verify certificate, academic-terms) are included for completeness.

| # | Method | Laravel route | Defined at | Middleware | Controller | ctl check | Frontend call site (n) |
|---|---|---|---|---|---|---|---|
| 1 | POST | `/get_adminAcademicSection` | adminapi.php:29 | (none) | api/adminapiController.php@get_adminAcademicSection | ctl token text | app/fees/master/additional-fees-mapping/page.tsx:176 (3) |
| 2 | POST | `/get_adminStandard` | adminapi.php:31 | (none) | api/adminapiController.php@get_adminStandard | ctl token text | app/fees/master/additional-fees-mapping/page.tsx:210 (3) |
| 3 | POST | `/get_adminDivision` | adminapi.php:33 | (none) | api/adminapiController.php@get_adminDivision | ctl token text | app/fees/master/additional-fees-mapping/page.tsx:255 (1) |
| 4 | POST | `/get_adminStudentList` | adminapi.php:37 | (none) | api/adminapiController.php@get_adminStudentList | ctl token text | app/pal/data/pal-legacy.ts:68 (1) |
| 5 | POST | `/api/api-login` | api.php:88 | api | api/ApiLoginController.php@login | ctl token text | contexts/AuthContext.tsx:223 (1) |
| 6 | GET | `/api/academic-terms` | api.php:89 | api | api/ApiLoginController.php@academicTerms | ctl token text | contexts/AuthContext.tsx:353 (1) |
| 7 | GET | `/api/mobile/web-handoff/claims` | api.php:106 | api | api/MobileWebHandoffApiController.php@claims | ctl token text | contexts/AuthContext.tsx:282 (1) |
| 8 | POST | `/api/admissions-dashboard/summary` | api.php:140 | api | api/AdmissionsDashboardApiController.php@summary | no token text | app/api/admissions/dashboard/summary/route.ts:16 (2) |
| 9 | POST | `/api/students-dashboard/summary` | api.php:141 | api | api/StudentsDashboardApiController.php@summary | no token text | app/api/students/dashboard/summary/route.ts:13 (2) |
| 10 | POST | `/api/library-dashboard/summary` | api.php:142 | api | api/LibraryDashboardApiController.php@summary | no token text | app/api/library/dashboard/summary/route.ts:11 (2) |
| 11 | POST | `/api/hostel-dashboard/summary` | api.php:143 | api | api/HostelDashboardApiController.php@summary | no token text | app/api/hostel/dashboard/summary/route.ts:11 (2) |
| 12 | POST | `/api/transportation-dashboard/summary` | api.php:144 | api | api/TransportationDashboardApiController.php@summary | no token text | app/api/transportation/dashboard/summary/route.ts:11 (2) |
| 13 | GET | `/api/migration-modules/{module}` | api.php:173 | api | api/MigrationModulesApiController.php@index | ctl token text | app/bazar/bulk-upload/BazarUploadPage.tsx:38 (2) |
| 14 | POST | `/api/migration-modules/{module}` | api.php:174 | api | api/MigrationModulesApiController.php@store | ctl token text | app/bazar/bulk-upload/BazarUploadPage.tsx:38 (2) |
| 15 | POST | `/api/menu-rights` | api.php:186 | api | api/MenuRightsController.php@getMenuRightsLevelWise | no token text | app/general/onboarding/api.ts:356 (2) |
| 16 | GET | `/api/master-menu-rights` | api.php:187 | api | api/MenuRightsController.php@getMasterMenuApi | no token text | app/components/DashboardShell.tsx:437 (1) |
| 17 | GET,POST | `/api/lms-courses` | api.php:217 | api | api/ApiLmsCourseController.php@index | no token text | app/course-master/data/lmsCourses.ts:76 (5) |
| 18 | POST | `/api/lms-chapter-concepts` | api.php:219 | api | api/ApiLmsCourseController.php@getChapterConcepts | no token text | app/lms/exam/page.tsx:2160 (1) |
| 19 | POST | `/api/lms-chapter-content` | api.php:221 | api | api/ApiLmsCourseController.php@chapterContent | no token text | app/course-master/data/chapters.ts:862 (1) |
| 20 | POST | `/api/lms-questions` | api.php:222 | api | api/ApiLmsCourseController.php@getLmsQuestions | no token text | app/exam/data/aiPaper.ts:267 (2) |
| 21 | POST | `/api/lms-question-bank` | api.php:223 | api | api/ApiLmsCourseController.php@getQuestionBank | no token text | app/course-master/data/chapters.ts:1186 (2) |
| 22 | POST | `/api/lms-question-bank/create` | api.php:224 | api | api/ApiLmsCourseController.php@createQuestionBank | no token text | app/course-master/data/chapters.ts:1232 (1) |
| 23 | POST | `/api/lms-question-bank/update` | api.php:225 | api | api/ApiLmsCourseController.php@updateQuestionBank | no token text | app/course-master/data/chapters.ts:1273 (1) |
| 24 | POST | `/api/lms-question-bank/delete` | api.php:226 | api | api/ApiLmsCourseController.php@deleteQuestionBank | no token text | app/course-master/data/chapters.ts:1328 (1) |
| 25 | POST | `/api/lms-question-bank/review` | api.php:227 | api | api/ApiLmsCourseController.php@reviewQuestionBank | no token text | app/course-master/data/chapters.ts:1303 (1) |
| 26 | GET | `/api/question-mapping-levels` | api.php:228 | api | api/ApiLmsCourseController.php@getQuestionMappingLevels | no token text | app/exam/data/aiPaper.ts:167 (2) |
| 27 | GET,POST | `/api/question-bank/filters` | api.php:233 | api | api/ApiQuestionBankController.php@filters | no token text | app/course-master/data/chapters.ts:1164 (1) |
| 28 | GET,POST | `/api/question-bank/question-types` | api.php:235 | api | api/ApiQuestionBankController.php@questionTypes | no token text | app/course-master/data/chapters.ts:1088 (1) |
| 29 | POST | `/api/lms/gamma-content-master` | api.php:264 | api, throttle.contentgen | lms/contentController.php@storeGammaContent | no token text | app/course-master/[courseId]/chapters/sideDrawer.tsx:783 (1) |
| 30 | GET | `/api/ai-sop` | api.php:266 | api | api/AiSopGenerationController.php@index | no token text | app/general/add_process/api.ts:15 (2) |
| 31 | GET | `/api/ai-sop/department-job-roles` | api.php:268 | api | api/AiSopGenerationController.php@departmentJobRoles | no token text | app/organization_managment/Department/Component/ai-generation-drawer.tsx:413 (1) |
| 32 | POST | `/api/ai-sop/generate` | api.php:269 | api | api/AiSopGenerationController.php@generate | no token text | app/organization_managment/Department/Component/ai-generation-drawer.tsx:547 (1) |
| 33 | POST | `/api/ai-sop/store` | api.php:270 | api | api/AiSopGenerationController.php@store | no token text | app/organization_managment/Department/Component/sops.tsx:840 (1) |
| 34 | POST | `/api/lms-homework/list` | api.php:274 | api | api/lms/StudentHomeworkApiController.php@index | no token text | app/lms/homework/api.ts:870 (1) |
| 35 | POST | `/api/lms-homework/bulk-delete` | api.php:279 | api | api/lms/StudentHomeworkApiController.php@bulkDelete | no token text | app/lms/homework/api.ts:883 (1) |
| 36 | POST | `/api/lms-homework/students` | api.php:280 | api | api/lms/StudentHomeworkApiController.php@studentsList | no token text | app/lms/homework/api.ts:705 (1) |
| 37 | POST | `/api/lms-homework/submission-list` | api.php:283 | api | api/lms/StudentHomeworkApiController.php@submissionList | no token text | app/lms/homework/api.ts:896 (1) |
| 38 | POST | `/api/lms-homework/submission-report` | api.php:285 | api | api/lms/StudentHomeworkApiController.php@submissionReport | no token text | app/lms/homework/api.ts:930 (1) |
| 39 | POST | `/api/lms-homework/ai-status/{id}` | api.php:286 | api | api/lms/StudentHomeworkApiController.php@aiEvaluationStatus | no token text | app/lms/homework/api.ts:946 (1) |
| 40 | POST | `/api/lms-assignment/students` | api.php:326 | api | api/lms/LmsAssignmentApiController.php@students | no token text | app/lms/lmsAssignment/api.ts:193 (1) |
| 41 | POST | `/api/lms-assignment/exam-papers` | api.php:327 | api | api/lms/LmsAssignmentApiController.php@examPapers | no token text | app/lms/lmsAssignment/api.ts:214 (1) |
| 42 | POST | `/api/lms-assignment/store` | api.php:328 | api | api/lms/LmsAssignmentApiController.php@store | no token text | app/lms/lmsAssignment/api.ts:280 (1) |
| 43 | POST | `/api/lms-assignment/list` | api.php:329 | api | api/lms/LmsAssignmentApiController.php@index | no token text | app/lms/lmsAnnotate_assignment/api.ts:261 (1) |
| 44 | POST | `/api/lms-assignment/bulk-delete` | api.php:330 | api | api/lms/LmsAssignmentApiController.php@bulkDelete | no token text | app/lms/lmsAnnotate_assignment/api.ts:274 (1) |
| 45 | POST | `/api/lms-assignment/submission-list` | api.php:332 | api | api/lms/LmsAssignmentApiController.php@submissionList | no token text | app/lms/lmsAssignment_submission/api.ts:193 (1) |
| 46 | POST | `/api/lms-assignment/ai-status/{id}` | api.php:334 | api | api/lms/LmsAssignmentApiController.php@aiEvaluationStatus | no token text | app/lms/lmsAnnotate_assignment/api.ts:335 (1) |
| 47 | POST | `/api/lms-assignment/annotate-list` | api.php:336 | api | api/lms/LmsAssignmentApiController.php@annotateList | no token text | app/lms/lmsAnnotate_assignment/api.ts:236 (1) |
| 48 | POST | `/api/lms-assignment/annotate-questions` | api.php:337 | api | api/lms/LmsAssignmentApiController.php@annotateQuestions | no token text | app/lms/lmsAnnotate_assignment/api.ts:284 (1) |
| 49 | POST | `/api/lms-assignment/annotate-store` | api.php:338 | api | api/lms/LmsAssignmentApiController.php@annotateStore | no token text | app/lms/lmsAnnotate_assignment/api.ts:321 (1) |
| 50 | GET | `/api/admission_enquiry` | api.php:425 | api | api/admissionEnquiryAPIController.php@index | no token text | app/admission-Enquiry/page.tsx:157 (5) |
| 51 | POST | `/api/admission_enquiry` | api.php:426 | api | api/admissionEnquiryAPIController.php@store | no token text | app/admission-Enquiry/page.tsx:157 (5) |
| 52 | PUT,PATCH | `/api/admission_enquiry/{id}` | api.php:427 | api | api/admissionEnquiryAPIController.php@update | no token text | app/admissions/admission_enquiry/page.tsx:1039 (1) |
| 53 | DELETE | `/api/admission_enquiry/{id}` | api.php:428 | api | api/admissionEnquiryAPIController.php@destroy | no token text | app/admissions/admission_enquiry/page.tsx:1039 (1) |
| 54 | GET | `/api/admission_registration/{id}/edit` | api.php:442 | api | api/admissionRegistrationAPIController.php@edit | no token text | app/admissions/admission_registration/workflow.ts:146 (2) |
| 55 | PUT,PATCH | `/api/admission_registration/{id}` | api.php:443 | api | api/admissionRegistrationAPIController.php@update | no token text | app/admissions/admission_registration/workflow.ts:211 (2) |
| 56 | DELETE | `/api/admission_registration/{id}` | api.php:444 | api | api/admissionRegistrationAPIController.php@destroy | no token text | app/admissions/admission_registration/workflow.ts:211 (2) |
| 57 | POST | `/api/admission_student` | api.php:445 | api | api/admissionRegistrationAPIController.php@saveStudent | no token text | app/admissions/admission_registration/workflow.ts:268 (1) |
| 58 | GET | `/api/admission_without_confirmation_report_v2` | api.php:451 | api | api/admissionRegistrationAPIController.php@indexWithoutConfirmationReport | no token text | app/admissions/admission_reports/api.ts:250 (2) |
| 59 | GET | `/api/admission_without_confirmation_report_v2/{id}/edit` | api.php:452 | api | api/admissionRegistrationAPIController.php@editWithoutConfirmationReport | no token text | app/admissions/admission_reports/api.ts:261 (2) |
| 60 | GET | `/api/question-paper/{id}/pdf` | api.php:459 | api | api/ApiQuestionPaperController.php@pdf | no token text | app/lms/lmsAssignment/api.ts:247 (1) |
| 61 | GET | `/api/question-paper` | api.php:460 | api | api/ApiQuestionPaperController.php@index | no token text | app/exam/data/aiPaper.ts:520 (8) |
| 62 | POST | `/api/question-paper` | api.php:460 | api | api/ApiQuestionPaperController.php@store | no token text | app/exam/data/aiPaper.ts:520 (8) |
| 63 | GET | `/api/question-paper/{question_paper}` | api.php:460 | api | api/ApiQuestionPaperController.php@show | no token text | app/lms/exam/page.tsx:1168 (2) |
| 64 | PUT | `/api/question-paper/{question_paper}` | api.php:460 | api | api/ApiQuestionPaperController.php@update | no token text | app/lms/exam/page.tsx:1168 (2) |
| 65 | DELETE | `/api/question-paper/{question_paper}` | api.php:460 | api | api/ApiQuestionPaperController.php@destroy | no token text | app/lms/exam/page.tsx:1168 (2) |
| 66 | GET | `/api/class-teachers` | api.php:461 | api | api/ClassTeacherApiController.php@index | ctl token text | app/classteacher/api.ts:129 (3) |
| 67 | POST | `/api/class-teachers` | api.php:461 | api | api/ClassTeacherApiController.php@store | ctl token text | app/classteacher/api.ts:129 (3) |
| 68 | PUT | `/api/class-teachers/{class_teacher}` | api.php:461 | api | api/ClassTeacherApiController.php@update | ctl token text | app/classteacher/api.ts:183 (2) |
| 69 | DELETE | `/api/class-teachers/{class_teacher}` | api.php:461 | api | api/ClassTeacherApiController.php@destroy | ctl token text | app/classteacher/api.ts:183 (2) |
| 70 | GET | `/api/user-logs/bootstrap` | api.php:462 | api | api/UserLogReportApiController.php@bootstrap | ctl token text | app/user_log/api.ts:86 (1) |
| 71 | POST | `/api/user-logs/search` | api.php:463 | api | api/UserLogReportApiController.php@search | ctl token text | app/user_log/api.ts:99 (1) |
| 72 | POST | `/api/teacher-daily-reports/search` | api.php:464 | api | api/TeacherDailyReportApiController.php@search | ctl token text | app/teacher_daily_report/api.ts:108 (1) |
| 73 | GET | `/api/teacher-daily-reports/{teacherId}/details` | api.php:465 | api | api/TeacherDailyReportApiController.php@details | ctl token text | app/teacher_daily_report/api.ts:136 (1) |
| 74 | GET | `/api/transportation-setup/{module}` | api.php:473 | api | api/TransportationApiController.php@index | ctl token text | app/Transportation/api.ts:189 (1) |
| 75 | POST | `/api/transportation-setup/{module}` | api.php:474 | api | api/TransportationApiController.php@store | ctl token text | app/Transportation/api.ts:189 (1) |
| 76 | GET | `/api/general-setup/{module}` | api.php:477 | api | api/GeneralSetupApiController.php@index | ctl token text | app/general/api.ts:78 (1) |
| 77 | POST | `/api/general-setup/{module}` | api.php:478 | api | api/GeneralSetupApiController.php@store | ctl token text | app/general/api.ts:78 (1) |
| 78 | GET | `/api/inventory/receivables/items` | api.php:484 | api | api/InventoryApiController.php@poItems | ctl token text | app/Inventory/api.ts:129 (1) |
| 79 | PUT,PATCH | `/api/inventory/{module}/{id}` | api.php:487 | api | api/InventoryApiController.php@update | ctl token text | app/Inventory/api.ts:129 (1) |
| 80 | DELETE | `/api/inventory/{module}/{id}` | api.php:488 | api | api/InventoryApiController.php@destroy | ctl token text | app/Inventory/api.ts:129 (1) |
| 81 | GET | `/api/question-paper-templates/paper/{paperId}` | api.php:496 | api | api/QuestionPaperTemplateApiController.php@paper | no token text | app/lms/exam/_question-paper-templates/api.ts:187 (1) |
| 82 | GET | `/api/question-paper-templates` | api.php:497 | api | api/QuestionPaperTemplateApiController.php@index | no token text | app/lms/exam/_question-paper-templates/api.ts:116 (2) |
| 83 | GET | `/api/question-paper-templates/{id}` | api.php:498 | api | api/QuestionPaperTemplateApiController.php@show | no token text | app/lms/exam/_question-paper-templates/api.ts:139 (2) |
| 84 | POST | `/api/question-paper-templates` | api.php:499 | api | api/QuestionPaperTemplateApiController.php@store | no token text | app/lms/exam/_question-paper-templates/api.ts:116 (2) |
| 85 | PUT,PATCH,POST | `/api/question-paper-templates/{id}` | api.php:500 | api | api/QuestionPaperTemplateApiController.php@update | no token text | app/lms/exam/_question-paper-templates/api.ts:139 (2) |
| 86 | DELETE | `/api/question-paper-templates/{id}` | api.php:501 | api | api/QuestionPaperTemplateApiController.php@destroy | no token text | app/lms/exam/_question-paper-templates/api.ts:139 (2) |
| 87 | GET | `/api/assessment-blueprints/chapters` | api.php:528 | api | api/AssessmentBlueprintApiController.php@chapters | no token text | app/lms/exam/_assessment-blueprint/api.ts:102 (1) |
| 88 | GET | `/api/assessment-blueprints/hpc-options` | api.php:533 | api | api/AssessmentBlueprintApiController.php@hpcOptions | no token text | app/lms/exam/_assessment-blueprint/api.ts:219 (2) |
| 89 | POST | `/api/assessment-blueprints/hpc-options` | api.php:534 | api | api/AssessmentBlueprintApiController.php@saveHpcOptions | no token text | app/lms/exam/_assessment-blueprint/api.ts:219 (2) |
| 90 | POST | `/api/assessment-blueprints/hpc-options/reset` | api.php:535 | api | api/AssessmentBlueprintApiController.php@resetHpcOptions | no token text | app/lms/exam/_assessment-blueprint/api.ts:255 (1) |
| 91 | POST | `/api/assessment-blueprints/clone` | api.php:536 | api | api/AssessmentBlueprintApiController.php@clone | no token text | app/lms/exam/_assessment-blueprint/api.ts:172 (1) |
| 92 | GET | `/api/assessment-blueprints/{id}` | api.php:539 | api | api/AssessmentBlueprintApiController.php@show | no token text | app/lms/exam/_assessment-blueprint/api.ts:102 (4) |
| 93 | PUT,PATCH,POST | `/api/assessment-blueprints/{id}` | api.php:540 | api | api/AssessmentBlueprintApiController.php@update | no token text | app/lms/exam/_assessment-blueprint/api.ts:102 (4) |
| 94 | DELETE | `/api/assessment-blueprints/{id}` | api.php:541 | api | api/AssessmentBlueprintApiController.php@destroy | no token text | app/lms/exam/_assessment-blueprint/api.ts:102 (4) |
| 95 | GET,POST | `/api/intelligence/lesson-plans` | api.php:570 | api | api/lms/IntelligenceLessonPlanApiController.php@index | no token text | app/course-master/lesson-plan/[courseId]/page.tsx:1280 (1) |
| 96 | GET,POST | `/api/intelligence/curriculum-planning` | api.php:573 | api | api/lms/CurriculumPlanningApiController.php@index | no token text | app/lms/curriculum-planning/page.tsx:82 (1) |
| 97 | GET,POST | `/api/intelligence/curriculum-planning/chapter` | api.php:578 | api | api/lms/CurriculumPlanningApiController.php@chapter | no token text | app/lms/curriculum-planning/ChapterDetailPanel.tsx:41 (1) |
| 98 | GET,POST | `/api/intelligence/monthly-plan` | api.php:581 | api | api/lms/MonthlyPlanApiController.php@index | no token text | app/lms/monthly-plan/page.tsx:933 (1) |
| 99 | GET,POST | `/api/intelligence/lesson-plan-detail` | api.php:589 | api | api/lms/LessonPlanDetailApiController.php@index | no token text | app/lms/lesson-plan/page.tsx:1075 (1) |
| 100 | POST | `/api/intelligence/lesson-plan-periods` | api.php:592 | api | api/lms/LessonPlanPeriodApiController.php@store | no token text | app/course-master/lesson-plan/[courseId]/page.tsx:1806 (3) |
| 101 | POST | `/api/intelligence/lesson-plan-periods/{id}/update` | api.php:593 | api | api/lms/LessonPlanPeriodApiController.php@update | no token text | app/lms/lesson-plan/page.tsx:805 (2) |
| 102 | POST | `/api/intelligence/lesson-plan-periods/{id}/delete` | api.php:594 | api | api/lms/LessonPlanPeriodApiController.php@destroy | no token text | app/lms/lesson-plan/page.tsx:830 (2) |
| 103 | GET,POST | `/api/intelligence/lesson-plan-lookup/chapters` | api.php:597 | api | api/lms/LessonPlanLookupApiController.php@chapters | no token text | app/lms/lesson-plan/page.tsx:51 (2) |
| 104 | GET,POST | `/api/intelligence/lesson-plan-lookup/periods` | api.php:598 | api | api/lms/LessonPlanLookupApiController.php@periods | no token text | app/course-master/lesson-plan/[courseId]/page.tsx:1229 (3) |
| 105 | GET | `/api/semantic-intelligence` | api.php:660 | api | api/lms/SemanticIntelligenceApiController.php@index | no token text | app/course-master/data/chapters.ts:944 (1) |
| 106 | GET | `/api/semantic-intelligence/{extraction_id}/result` | api.php:661 | api | api/lms/SemanticIntelligenceApiController.php@show | no token text | app/course-master/data/chapters.ts:958 (1) |
| 107 | GET,POST | `/api/lms/concept-intelligence/tab-labels` | api.php:674 | api | api/lms/ConceptIntelligenceTabLabelApiController.php@index | no token text | app/course-master/data/conceptIntelligenceTabLabels.ts:21 (1) |
| 108 | POST | `/api/lms/concept-intelligence/tab-labels/update` | api.php:675 | api | api/lms/ConceptIntelligenceTabLabelApiController.php@update | no token text | app/course-master/data/conceptIntelligenceTabLabels.ts:22 (1) |
| 109 | POST | `/api/lms/concept-intelligence/tab-labels/reset` | api.php:676 | api | api/lms/ConceptIntelligenceTabLabelApiController.php@reset | no token text | app/course-master/data/conceptIntelligenceTabLabels.ts:23 (1) |
| 110 | GET | `/api/departments/hierarchy` | api.php:722 | api | HRMS/departmentController.php@hierarchy | ctl token text | app/organization_managment/Department/page.tsx:238 (1) |
| 111 | GET | `/api/departments-management` | api.php:727 | api | HRMS/departmentController.php@indexManagement | ctl token text | app/hrit/_lib/payroll-api.ts:896 (4) |
| 112 | POST | `/api/departments-management` | api.php:728 | api | HRMS/departmentController.php@storeManagement | ctl token text | app/hrit/_lib/payroll-api.ts:896 (4) |
| 113 | POST | `/api/departments-management/merge` | api.php:731 | api | HRMS/departmentController.php@merge | ctl token text | app/organization_managment/_lib/department-management-api.ts:218 (1) |
| 114 | POST | `/api/departments-management/reorder` | api.php:732 | api | HRMS/departmentController.php@reorder | ctl token text | app/organization_managment/_lib/department-management-api.ts:343 (2) |
| 115 | GET | `/api/departments-management/export` | api.php:733 | api | HRMS/departmentController.php@export | ctl token text | components/domain/organization/department-management/organization-service.ts:307 (1) |
| 116 | GET | `/api/departments-management/employees` | api.php:734 | api | HRMS/departmentController.php@employees | ctl token text | app/organization_managment/_lib/department-management-api.ts:263 (2) |
| 117 | POST | `/api/departments-management/{id}/employees` | api.php:737 | api | HRMS/departmentController.php@assignEmployees | ctl token text | app/organization_managment/_lib/department-management-api.ts:304 (4) |
| 118 | DELETE | `/api/departments-management/{id}/employees` | api.php:738 | api | HRMS/departmentController.php@unassignEmployees | ctl token text | app/organization_managment/_lib/department-management-api.ts:304 (4) |
| 119 | GET | `/api/departments-management/{id}/impact` | api.php:739 | api | HRMS/departmentController.php@impact | ctl token text | app/organization_managment/_lib/department-management-api.ts:171 (2) |
| 120 | PATCH | `/api/departments-management/{id}/head` | api.php:740 | api | HRMS/departmentController.php@setHead | ctl token text | app/organization_managment/_lib/department-management-api.ts:204 (2) |
| 121 | PUT,PATCH | `/api/departments-management/{id}` | api.php:741 | api | HRMS/departmentController.php@updateManagement | ctl token text | app/organization_managment/_lib/department-management-api.ts:133 (11) |
| 122 | DELETE | `/api/departments-management/{id}` | api.php:742 | api | HRMS/departmentController.php@destroyManagement | ctl token text | app/organization_managment/_lib/department-management-api.ts:133 (11) |
| 123 | GET | `/api/users/{id}` | api.php:749 | api | api/UserManagementApiController.php@show | ctl token text | app/user/api.ts:85 (1) |
| 124 | POST | `/api/users/{id}` | api.php:750 | api | api/UserManagementApiController.php@update | ctl token text | app/user/api.ts:85 (1) |
| 125 | POST | `/api/users/{id}/deactivate` | api.php:751 | api | api/UserManagementApiController.php@destroy | ctl token text | app/user/api.ts:96 (1) |
| 126 | POST | `/api/user-profiles/{id}` | api.php:754 | api | api/UserManagementApiController.php@updateProfile | ctl token text | app/user/api.ts:104 (1) |
| 127 | POST | `/api/user-profiles/{id}/delete` | api.php:755 | api | api/UserManagementApiController.php@destroyProfile | ctl token text | app/user/api.ts:108 (1) |
| 128 | GET | `/api/user-reports/bootstrap` | api.php:756 | api | api/UserManagementApiController.php@reportBootstrap | ctl token text | app/admin-services/_lib/visitor.ts:46 (2) |
| 129 | POST | `/api/user-reports/search` | api.php:757 | api | api/UserManagementApiController.php@report | ctl token text | app/user/api.ts:119 (1) |
| 130 | GET | `/api/groupwise-rights/{profileId}/matrix` | api.php:761 | api | api/GroupwiseRightsApiController.php@matrix | ctl token text | app/general/groupwise_rights/api.ts:190 (1) |
| 131 | GET | `/api/individual-rights/{profileId}/users` | api.php:764 | api | api/IndividualRightsApiController.php@users | ctl token text | app/general/individual_rights/api.ts:205 (1) |
| 132 | GET | `/api/individual-rights/{profileId}/{userId}/matrix` | api.php:765 | api | api/IndividualRightsApiController.php@matrix | ctl token text | app/general/individual_rights/api.ts:217 (1) |
| 133 | GET | `/api/mobile-app-rights/bootstrap` | api.php:767 | api | api/MobileAppMenuRightsApiController.php@bootstrap | ctl token text | app/general/mobile_app_rights/api.ts:219 (1) |
| 134 | GET | `/api/mobile-app-rights/{profileId}/rights` | api.php:768 | api | api/MobileAppMenuRightsApiController.php@rights | ctl token text | app/general/mobile_app_rights/api.ts:232 (2) |
| 135 | POST | `/api/mobile-app-rights/rights` | api.php:769 | api | api/MobileAppMenuRightsApiController.php@saveRights | ctl token text | app/general/mobile_app_rights/api.ts:243 (1) |
| 136 | GET | `/api/mobile-app-rights/config` | api.php:770 | api | api/MobileAppMenuRightsApiController.php@configIndex | ctl token text | app/general/mobile_app_rights/api.ts:258 (2) |
| 137 | POST | `/api/mobile-app-rights/config` | api.php:771 | api | api/MobileAppMenuRightsApiController.php@createConfig | ctl token text | app/general/mobile_app_rights/api.ts:258 (2) |
| 138 | POST | `/api/mobile-app-rights/config/{id}` | api.php:772 | api | api/MobileAppMenuRightsApiController.php@updateConfig | ctl token text | app/general/mobile_app_rights/api.ts:232 (2) |
| 139 | GET | `/api/teacher-transfer` | api.php:775 | api | api/TeacherTransferApiController.php@index | ctl token text | app/teachertransfer/api.ts:40 (1) |
| 140 | POST | `/api/teacher-transfer` | api.php:776 | api | api/TeacherTransferApiController.php@store | ctl token text | app/teachertransfer/api.ts:40 (1) |
| 141 | GET | `/api/complaints` | api.php:782 | api | api/ComplaintApiController.php@index | ctl token text | app/admin-services/_lib/complaint.ts:33 (1) |
| 142 | POST | `/api/complaints` | api.php:783 | api | api/ComplaintApiController.php@store | ctl token text | app/admin-services/_lib/complaint.ts:33 (1) |
| 143 | POST | `/api/complaints/{id}/delete` | api.php:784 | api | api/ComplaintApiController.php@destroy | ctl token text | app/admin-services/_lib/complaint.ts:153 (1) |
| 144 | POST | `/api/complaints/{id}` | api.php:785 | api | api/ComplaintApiController.php@update | ctl token text | app/admin-services/_lib/complaint.ts:147 (1) |
| 145 | GET | `/api/consents/students` | api.php:790 | api | api/ConsentApiController.php@students | ctl token text | app/admin-services/_lib/consent.ts:32 (1) |
| 146 | GET | `/api/consents` | api.php:791 | api | api/ConsentApiController.php@index | ctl token text | app/admin-services/_lib/consent.ts:33 (1) |
| 147 | POST | `/api/consents/delete` | api.php:792 | api | api/ConsentApiController.php@destroy | ctl token text | app/admin-services/_lib/consent.ts:173 (1) |
| 148 | POST | `/api/consents` | api.php:793 | api | api/ConsentApiController.php@store | ctl token text | app/admin-services/_lib/consent.ts:33 (1) |
| 149 | GET | `/api/front-desk/report` | api.php:799 | api | api/FrontDeskApiController.php@report | ctl token text | app/admin-services/_lib/frontdesk.ts:163 (1) |
| 150 | GET | `/api/front-desk` | api.php:800 | api | api/FrontDeskApiController.php@index | ctl token text | app/admin-services/_lib/frontdesk.ts:32 (1) |
| 151 | GET | `/api/front-desk/{id}` | api.php:811 | api | api/FrontDeskApiController.php@show | ctl token text | app/admin-services/_lib/frontdesk.ts:117 (3) |
| 152 | POST | `/api/front-desk` | api.php:812 | api | api/FrontDeskApiController.php@store | ctl token text | app/admin-services/_lib/frontdesk.ts:32 (1) |
| 153 | POST | `/api/front-desk/{id}/delete` | api.php:813 | api | api/FrontDeskApiController.php@destroy | ctl token text | app/admin-services/_lib/frontdesk.ts:151 (1) |
| 154 | POST | `/api/front-desk/{id}` | api.php:814 | api | api/FrontDeskApiController.php@update | ctl token text | app/admin-services/_lib/frontdesk.ts:117 (3) |
| 155 | GET | `/api/petty-cash/heads` | api.php:820 | api | api/PettyCashApiController.php@headIndex | ctl token text | app/admin-services/_lib/pettyCash.ts:38 (1) |
| 156 | POST | `/api/petty-cash/heads` | api.php:821 | api | api/PettyCashApiController.php@headStore | ctl token text | app/admin-services/_lib/pettyCash.ts:38 (1) |
| 157 | POST | `/api/petty-cash/heads/{id}/delete` | api.php:822 | api | api/PettyCashApiController.php@headDestroy | ctl token text | app/admin-services/_lib/pettyCash.ts:115 (1) |
| 158 | POST | `/api/petty-cash/heads/{id}` | api.php:823 | api | api/PettyCashApiController.php@headUpdate | ctl token text | app/admin-services/_lib/pettyCash.ts:106 (1) |
| 159 | GET | `/api/petty-cash/report` | api.php:824 | api | api/PettyCashApiController.php@report | ctl token text | app/admin-services/_lib/pettyCash.ts:176 (1) |
| 160 | GET | `/api/petty-cash` | api.php:825 | api | api/PettyCashApiController.php@index | ctl token text | app/admin-services/_lib/pettyCash.ts:37 (1) |
| 161 | GET | `/api/petty-cash/{id}` | api.php:826 | api | api/PettyCashApiController.php@show | ctl token text | app/admin-services/_lib/pettyCash.ts:38 (3) |
| 162 | POST | `/api/petty-cash` | api.php:827 | api | api/PettyCashApiController.php@store | ctl token text | app/admin-services/_lib/pettyCash.ts:37 (1) |
| 163 | POST | `/api/petty-cash/{id}/delete` | api.php:828 | api | api/PettyCashApiController.php@destroy | ctl token text | app/admin-services/_lib/pettyCash.ts:157 (1) |
| 164 | POST | `/api/petty-cash/{id}` | api.php:829 | api | api/PettyCashApiController.php@update | ctl token text | app/admin-services/_lib/pettyCash.ts:38 (3) |
| 165 | GET | `/api/fields-configuration` | api.php:883 | api | api/CustomFieldApiController.php@index | ctl token text | app/general/fields_configuration/page.tsx:220 (2) |
| 166 | POST | `/api/fields-configuration` | api.php:885 | api | api/CustomFieldApiController.php@store | ctl token text | app/general/fields_configuration/page.tsx:220 (2) |
| 167 | GET | `/api/jobroles-by-department` | api.php:901 | api | api/HRITDashboard/JobroleApiController.php@getDepartmentWise | ctl token text | app/task-management/_lib/my-tasks-api.ts:334 (2) |
| 168 | GET | `/api/leave/dashboard` | api.php:916 | api | api/Leave/LeaveDashboardController.php@index | ctl token text | app/hrit/_lib/leave-api.ts:480 (1) |
| 169 | GET | `/api/leave/trend` | api.php:917 | api | api/Leave/LeaveDashboardController.php@trend | ctl token text | app/hrit/_lib/leave-api.ts:486 (1) |
| 170 | GET | `/api/leave/department-summary` | api.php:918 | api | api/Leave/LeaveDashboardController.php@departmentSummary | ctl token text | app/hrit/_lib/leave-api.ts:492 (1) |
| 171 | GET | `/api/leave/type-distribution` | api.php:919 | api | api/Leave/LeaveDashboardController.php@typeDistribution | ctl token text | app/hrit/_lib/leave-api.ts:498 (1) |
| 172 | GET | `/api/leave/holidays/upcoming` | api.php:920 | api | api/Leave/LeaveDashboardController.php@upcomingHolidays | ctl token text | app/hrit/_lib/leave-api.ts:504 (1) |
| 173 | GET | `/api/leave/options` | api.php:923 | api | api/Leave/LeaveOptionsController.php@index | ctl token text | app/hrit/_lib/leave-api.ts:512 (1) |
| 174 | GET | `/api/leave/balances` | api.php:924 | api | api/Leave/LeaveOptionsController.php@balances | ctl token text | app/hrit/_lib/leave-api.ts:518 (1) |
| 175 | GET | `/api/leave/requests` | api.php:927 | api | api/Leave/LeaveRequestApiController.php@index | ctl token text | app/hrit/_lib/leave-api.ts:526 (2) |
| 176 | POST | `/api/leave/requests` | api.php:928 | api | api/Leave/LeaveRequestApiController.php@store | ctl token text | app/hrit/_lib/leave-api.ts:526 (2) |
| 177 | POST | `/api/leave/requests/bulk-decision` | api.php:929 | api | api/Leave/LeaveRequestApiController.php@bulkDecision | ctl token text | app/hrit/_lib/leave-api.ts:580 (1) |
| 178 | GET | `/api/leave/requests/{id}` | api.php:930 | api | api/Leave/LeaveRequestApiController.php@show | ctl token text | app/hrit/_lib/leave-api.ts:544 (3) |
| 179 | POST | `/api/leave/requests/{id}/decision` | api.php:931 | api | api/Leave/LeaveRequestApiController.php@decision | ctl token text | app/hrit/_lib/leave-api.ts:566 (1) |
| 180 | DELETE | `/api/leave/requests/{id}` | api.php:932 | api | api/Leave/LeaveRequestApiController.php@destroy | ctl token text | app/hrit/_lib/leave-api.ts:544 (3) |
| 181 | GET | `/api/leave/reports/summary` | api.php:935 | api | api/Leave/LeaveReportApiController.php@summary | ctl token text | app/hrit/_lib/leave-api.ts:601 (1) |
| 182 | GET | `/api/leave/reports/register` | api.php:936 | api | api/Leave/LeaveReportApiController.php@register | ctl token text | app/hrit/_lib/leave-api.ts:607 (1) |
| 183 | GET | `/api/leave/reports/balance` | api.php:937 | api | api/Leave/LeaveReportApiController.php@balance | ctl token text | app/hrit/_lib/leave-api.ts:613 (1) |
| 184 | GET | `/api/leave/leave-types` | api.php:940 | api | api/Leave/LeaveTypeApiController.php@index | ctl token text | app/hrit/_lib/leave-api.ts:619 (2) |
| 185 | POST | `/api/leave/leave-types` | api.php:941 | api | api/Leave/LeaveTypeApiController.php@store | ctl token text | app/hrit/_lib/leave-api.ts:619 (2) |
| 186 | PUT | `/api/leave/leave-types/{id}` | api.php:942 | api | api/Leave/LeaveTypeApiController.php@store | ctl token text | app/hrit/_lib/leave-api.ts:637 (2) |
| 187 | PATCH | `/api/leave/leave-types/{id}/status` | api.php:943 | api | api/Leave/LeaveTypeApiController.php@toggleStatus | ctl token text | app/hrit/_lib/leave-api.ts:643 (1) |
| 188 | DELETE | `/api/leave/leave-types/{id}` | api.php:944 | api | api/Leave/LeaveTypeApiController.php@destroy | ctl token text | app/hrit/_lib/leave-api.ts:637 (2) |
| 189 | GET | `/api/leave/holidays` | api.php:947 | api | api/Leave/HolidayApiController.php@index | ctl token text | app/hrit/_lib/leave-api.ts:653 (2) |
| 190 | POST | `/api/leave/holidays` | api.php:948 | api | api/Leave/HolidayApiController.php@store | ctl token text | app/hrit/_lib/leave-api.ts:653 (2) |
| 191 | PUT | `/api/leave/holidays/{id}` | api.php:949 | api | api/Leave/HolidayApiController.php@update | ctl token text | app/hrit/_lib/leave-api.ts:504 (3) |
| 192 | DELETE | `/api/leave/holidays/{id}` | api.php:950 | api | api/Leave/HolidayApiController.php@destroy | ctl token text | app/hrit/_lib/leave-api.ts:504 (3) |
| 193 | GET | `/api/leave/weekdays` | api.php:951 | api | api/Leave/HolidayApiController.php@weekdays | ctl token text | app/hrit/_lib/leave-api.ts:679 (2) |
| 194 | POST | `/api/leave/weekdays` | api.php:952 | api | api/Leave/HolidayApiController.php@storeWeekdays | ctl token text | app/hrit/_lib/leave-api.ts:679 (2) |
| 195 | GET | `/api/leave/workflow` | api.php:955 | api | api/Leave/LeaveWorkflowApiController.php@workflow | ctl token text | app/hrit/_lib/leave-api.ts:688 (2) |
| 196 | PUT | `/api/leave/workflow` | api.php:956 | api | api/Leave/LeaveWorkflowApiController.php@saveWorkflow | ctl token text | app/hrit/_lib/leave-api.ts:688 (2) |
| 197 | GET | `/api/leave/roles` | api.php:957 | api | api/Leave/LeaveWorkflowApiController.php@roles | ctl token text | app/hrit/_lib/leave-api.ts:703 (2) |
| 198 | PUT | `/api/leave/roles` | api.php:958 | api | api/Leave/LeaveWorkflowApiController.php@saveRoles | ctl token text | app/hrit/_lib/leave-api.ts:703 (2) |
| 199 | GET | `/api/attendance/my-attendance` | api.php:980 | api | api/Attendance/AttendanceTrackingApiController.php@myAttendance | ctl token text | app/hrit/_lib/attendance-api.ts:460 (1) |
| 200 | GET | `/api/attendance/report-filters` | api.php:985 | api | api/Attendance/AttendanceReportApiController.php@filters | ctl token text | app/hrit/_lib/attendance-api.ts:400 (1) |
| 201 | GET | `/api/attendance/employees` | api.php:986 | api | api/Attendance/AttendanceReportApiController.php@employees | ctl token text | app/hrit/_lib/attendance-api.ts:403 (1) |
| 202 | GET | `/api/attendance/day-detail` | api.php:987 | api | api/Attendance/AttendanceReportApiController.php@dayDetail | ctl token text | app/hrit/_lib/attendance-api.ts:426 (1) |
| 203 | GET | `/api/attendance/latest-activity-date` | api.php:988 | api | api/Attendance/AttendanceReportApiController.php@latestActivityDate | ctl token text | app/hrit/_lib/attendance-api.ts:440 (1) |
| 204 | GET | `/api/attendance/weekly-summary` | api.php:991 | api | api/Attendance/AttendanceDashboardApiController.php@weeklySummary | ctl token text | app/hrit/_lib/attendance-api.ts:397 (1) |
| 205 | GET | `/api/attendance/kpi` | api.php:992 | api | api/Attendance/AttendanceDashboardApiController.php@kpi | ctl token text | app/hrit/_lib/attendance-api.ts:394 (1) |
| 206 | GET | `/api/g2g-lms/certifications-records/certificates/verify/{code}` | g2g_lms.php:306 | api | G2gLms/CertificationsRecordsController.php@verify | ctl token text | components/domain/lms/certifications-records/certifications-records-service.ts:225 (1) |
| 207 | GET | `/api/get-curriculum-list` | lms.php:394 | web | lms/lmsSyllabusController.php@getCurriculums | no token text | app/lms/syllabus-plan/api.ts:132 (1) |
| 208 | POST | `/get-h5p-ai-scenario` | lms.php:552 | web | lms/h5p/H5PScenarioController.php@getH5pAIScenario | ctl token text | app/h5p/data/h5p.ts:597 (1) |
| 209 | GET | `/lms/new_chapter_master` | lms.php:555 | web | lms/nextAPI/chapterMasterController.php@index | no token text | app/course-master/data/chapters.ts:976 (1) |
| 210 | POST | `/lms/new_chapter_master` | lms.php:555 | web | lms/nextAPI/chapterMasterController.php@store | no token text | app/course-master/data/chapters.ts:976 (1) |
| 211 | GET | `/api/pal/pedagogy-engine` | pal_api.php:32 | (none) | api/PAL/PedagogyEngineController.php@index | no token text | app/pal/data/pedagogy-engine.ts:234 (1) |
| 212 | GET | `/api/get-grade-list` | result.php:136 | web | AJAXController.php@getGradeList | ctl token text | app/exam/marks-entry/page.tsx:76 (2) |
| 213 | GET | `/api/get-standard-list` | result.php:137 | web | AJAXController.php@getStandardList | ctl token text | app/exam/marks-entry/page.tsx:81 (2) |
| 214 | GET | `/api/get-division-list` | result.php:138 | web | AJAXController.php@getDivisionList | ctl token text | app/exam/marks-entry/page.tsx:86 (2) |
| 215 | GET | `/api/get-subject-list` | result.php:139 | web | AJAXController.php@getSubjectList | ctl token text | app/exam/marks-entry/page.tsx:92 (1) |
| 216 | GET | `/api/get-exam-master-list` | result.php:143 | web | AJAXController.php@getExamsMasterList | ctl token text | app/exam/marks-entry/page.tsx:105 (1) |
| 217 | GET | `/api/get-exam-list` | result.php:151 | web | AJAXController.php@getExamList | ctl token text | app/exam/marks-entry/page.tsx:115 (1) |
| 218 | GET | `/get_batch` | student.php:248 | web | student/studentAttendanceController.php@get_batch | ctl token text | app/student/monthwise_student_attendance/page.tsx:524 (1) |
| 219 | GET | `/student/api/student_certificate/templates` | student.php:267 | web | student/StudentCertificateApiController.php@templates | no token text | app/student/student_certificate/StudentCertificateModule.tsx:488 (1) |
| 220 | POST | `/student/api/student_certificate/search` | student.php:268 | web | student/StudentCertificateApiController.php@search | no token text | app/student/student_certificate/StudentCertificateModule.tsx:661 (1) |
| 221 | POST | `/student/api/student_certificate/preview` | student.php:269 | web | student/StudentCertificateApiController.php@preview | no token text | app/student/student_certificate/StudentCertificateModule.tsx:752 (1) |
| 222 | POST | `/student/api/student_certificate/save` | student.php:270 | web | student/StudentCertificateApiController.php@save | no token text | app/student/student_certificate/StudentCertificateModule.tsx:823 (1) |
| 223 | GET | `/student/api/student_certificate/history` | student.php:271 | web | student/StudentCertificateApiController.php@history | no token text | app/student/student_certificate/StudentCertificateModule.tsx:883 (1) |
| 224 | GET | `/student/api/student_icard/metadata` | student.php:275 | web | student/StudentIcardApiController.php@metadata | no token text | app/student/student_icard/page.tsx:359 (1) |
| 225 | POST | `/student/api/student_icard/search` | student.php:276 | web | student/StudentIcardApiController.php@search | no token text | app/student/student_icard/page.tsx:445 (1) |
| 226 | POST | `/student/api/student_icard/preview` | student.php:277 | web | student/StudentIcardApiController.php@preview | no token text | app/student/student_icard/page.tsx:539 (1) |
| 227 | GET | `/student/api/teacher_icard/metadata` | student.php:281 | web | student/TeacherIcardApiController.php@metadata | no token text | app/student/teacher_icard/TeacherIcardModule.tsx:300 (1) |
| 228 | POST | `/student/api/teacher_icard/search` | student.php:282 | web | student/TeacherIcardApiController.php@search | no token text | app/student/teacher_icard/TeacherIcardModule.tsx:376 (1) |
| 229 | POST | `/student/api/teacher_icard/preview` | student.php:283 | web | student/TeacherIcardApiController.php@preview | no token text | app/student/teacher_icard/TeacherIcardModule.tsx:463 (1) |
| 230 | POST | `/visitor_management/add_visitor_master` | visitor_management.php:23 | web | visitor_management/visitor_masterController.php@store | ctl token text | app/admin-services/_lib/visitor.ts:42 (1) |
| 231 | GET | `/lms/adaptive-practice` | web.php:109 | web | lms/assessmentQuestionController.php@generateAdaptivePractice | no token text | app/lms/exam/page.tsx:1697 (2) |
| 232 | POST | `/lms/submit-practice` | web.php:113 | web | lms/assessmentQuestionController.php@submitPractice | no token text | app/lms/exam/page.tsx:1942 (2) |
| 233 | GET | `/lms/diagnostic-assessment` | web.php:117 | web | lms/assessmentQuestionController.php@generateDiagnosticAssessment | no token text | app/pal/data/pal.ts:1343 (1) |
| 234 | POST | `/lms/submit-diagnostic-assessment` | web.php:121 | web | lms/assessmentQuestionController.php@submitDiagnosticAssessment | no token text | app/pal/data/pal.ts:1422 (1) |
| 235 | GET | `/lms/chapter-gate` | web.php:125 | web | lms/assessmentQuestionController.php@getChapterGate | no token text | app/pal/data/pal.ts:1497 (1) |
| 236 | GET | `/lms/practice-history` | web.php:129 | web | lms/assessmentQuestionController.php@getPracticeHistory | no token text | app/pal/data/pal.ts:1616 (1) |
| 237 | GET | `/lms/spaced-repetition` | web.php:133 | web | lms/assessmentQuestionController.php@getSpacedRepetition | no token text | app/pal/data/pal.ts:1569 (1) |
| 238 | GET | `/lms/pedagogy-suggested-content` | web.php:140 | web | lms/PedagogyEngineController.php@getPedagogySuggestedContent | no token text | app/pal/data/pal.ts:487 (1) |
| 239 | GET | `/forget-password` | web.php:497 | web | Auth/ForgotPasswordController.php@showForgetPasswordForm | no token text | app/api/forgot-password/route.ts:88 (1) |
| 240 | POST | `/forget-password` | web.php:498 | web | Auth/ForgotPasswordController.php@submitForgetPasswordForm | no token text | app/api/forgot-password/route.ts:88 (1) |
| 241 | GET | `/table_data` | web.php:639 | web | AJAXController.php@lmsDataApi | ctl token text | app/talent-management/recruitment/components/job-posting-form.tsx:130 (3) |
| 242 | GET | `/requirements/{requirement}` | web.php:660 | web | reuirementController.php@show | no token text | app/general/add_process/api.ts:111 (2) |
| 243 | GET | `/requirements/{requirement}/edit` | web.php:660 | web | reuirementController.php@edit | no token text | app/general/add_process/api.ts:132 (1) |
| 244 | PUT | `/requirements/{requirement}` | web.php:660 | web | reuirementController.php@update | no token text | app/general/add_process/api.ts:111 (2) |
| 245 | DELETE | `/requirements/{requirement}` | web.php:660 | web | reuirementController.php@destroy | no token text | app/general/add_process/api.ts:111 (2) |
| 246 | GET | `/lms/pedagogy-suggested-content` | web.php:811 | web | lms/pal/palController.php@getPedagogySuggestedContent | ctl token text | app/pal/data/pal.ts:487 (1) |
| 247 | GET | `/lms/misconception` | web.php:812 | web | lms/pal/palController.php@misconception | ctl token text | app/pal/data/pal.ts:559 (1) |
| 248 | POST | `/lms/misconception/generate-content` | web.php:852 | web | lms/pal/palController.php@generateMisconceptionContent | ctl token text | app/pal/data/pal.ts:589 (1) |
| 249 | POST | `/lms/increment-content-visit` | web.php:853 | web | lms/pal/palController.php@incrementContentVisit | ctl token text | app/pal/data/pal.ts:632 (1) |

Summary: 114 routes with no route-level auth AND no token text in the controller; 135 with no route-level auth but token/Authorization text in the controller; by file: adminapi.php 4, api.php 201, g2g_lms.php 1, lms.php 4, pal_api.php 1, result.php 6, student.php 12, visitor_management.php 1, web.php 19.

### 5b. SOFT (fail-open) routes called by the frontend (18) - lms.auth / perm / lms.staff only

| # | Method | Laravel route | Defined at | Middleware | Frontend call site |
|---|---|---|---|---|---|
| 1 | GET | `/api/permissions` | api.php:194 | api, lms.auth | app/hooks/usePermission.ts:79 |
| 2 | POST | `/api/lms-chapter-content/upload` | api.php:239 | api, lms.auth, perm:lms.content,create | app/course-master/data/chapters.ts:756 |
| 3 | GET | `/api/lms/content/authoring-vocabulary` | api.php:251 | api, lms.auth | app/course-master/data/authoring.ts:85 |
| 4 | POST | `/api/lms/content/author` | api.php:252 | api, lms.auth, perm:lms.content,create | app/course-master/data/authoring.ts:86 |
| 5 | GET | `/api/lms/coherence-map` | api.php:697 | api, lms.auth | app/course-master/data/coherenceMap.ts:221 |
| 6 | GET | `/api/lms/coherence-map/concept/{conceptId}` | api.php:702 | api, lms.auth | app/course-master/data/coherenceMap.ts:251 |
| 7 | POST | `/api/lms/coherence-map/relations/bulk` | api.php:708 | api, lms.auth, perm:lms.curriculum,update | app/course-master/data/coherenceMap.ts:348 |
| 8 | POST | `/api/lms/coherence-map/relations` | api.php:709 | api, lms.auth, perm:lms.curriculum,update | app/course-master/data/coherenceMap.ts:303 |
| 9 | PATCH | `/api/lms/coherence-map/relations/{source}/{id}` | api.php:710 | api, lms.auth, perm:lms.curriculum,update | app/course-master/data/coherenceMap.ts:323 |
| 10 | DELETE | `/api/lms/coherence-map/relations/{source}/{id}` | api.php:712 | api, lms.auth, perm:lms.curriculum,update | app/course-master/data/coherenceMap.ts:323 |
| 11 | GET | `/api/platform/registry` | platform.php:47 | api, lms.auth | lib/platform/client.ts:94 |
| 12 | PUT | `/api/platform/notifications/channels` | platform.php:60 | api, lms.auth, perm:platform.notification,update | lib/platform/client.ts:139 |
| 13 | GET | `/api/platform/scheduler` | platform.php:67 | api, lms.auth | lib/platform/client.ts:152 |
| 14 | PUT | `/api/platform/scheduler` | platform.php:68 | api, lms.auth, perm:platform.scheduler,update | lib/platform/client.ts:152 |
| 15 | GET | `/api/platform/workflow` | platform.php:77 | api, lms.auth | lib/platform/client.ts:162 |
| 16 | POST | `/api/platform/workflow` | platform.php:78 | api, lms.auth, perm:platform.workflow,create | lib/platform/client.ts:162 |
| 17 | PUT | `/api/platform/workflow/{id}` | platform.php:80 | api, lms.auth, perm:platform.workflow,update | lib/platform/client.ts:166 |
| 18 | DELETE | `/api/platform/workflow/{id}` | platform.php:83 | api, lms.auth, perm:platform.workflow,delete | lib/platform/client.ts:166 |

## 6. Hard-coded hosts in tracked source (non-test)

| Host | Sites | Comment |
|---|---|---|
| www.youtube.com | app/front_desk/_lib/api.ts:161; lib/video-embed.ts:100 (2) |  |
| erp.triz.co.in | app/fees/help-guide-support/_components/help-guide-grid.tsx:30 (1) | help-guide links |
| youtu.be | app/fees/help-guide-support/_components/help-guide-grid.tsx:43 (1) |  |
| adlnet.gov | app/h5p/data/h5p.ts:544; app/h5p/data/h5p.ts:545; app/h5p/data/h5p.ts:546 (4) |  |
| example.com | app/task-management/administration/integration/components/integration-providers.ts:44 (1) |  |
| cdn.simpleicons.org | app/ai-platforms/page.tsx:30; app/ai-platforms/page.tsx:50; app/ai-platforms/page.tsx:60 (3) |  |
| www.w3.org | app/students/health_medical/components/StudentHealthTable.tsx:61; components/document-template/editor/Toolbox.tsx:785; components/document-template/editor/Toolbox.tsx:799 (3) |  |
| www.youtube-nocookie.com | lib/video-embed.ts:98 (1) |  |
| player.vimeo.com | lib/video-embed.ts:110 (1) |  |
| skill-ontology-neo4j.vercel.app | app/capability-intelligence/capability-explorer/components/taxonomy-ontology.tsx:38; app/capability-intelligence/capability-explorer/components/taxonomy-ontology.tsx:59 (2) | iframe origin for taxonomy explorer |
| view.officeapps.live.com | app/course-master/data/content-links.ts:56; components/domain/lms/delivery/learning-delivery-workspace.tsx:120 (2) |  |
| apps.triz.co.in | app/general/implementation_management/ImplementationManagementPage.tsx:94; app/general/implementation_management/ImplementationManagementPage.tsx:103 (2) | plain http:// links to legacy excel export (ImplementationManagementPage.tsx:94,103) |
| cdn.jsdelivr.net | app/layout.tsx:35; app/layout.tsx:41 (2) |  |
| s3-triz.fra1.digitaloceanspaces.com | app/sqaa/_lib/api.ts:168 (1) | SQAA public files (sqaa/_lib/api.ts:168) |
| n8n.triz.co.in | app/talent-management/_lib/recruitment-api.ts:216; app/task-management/my-tasks/components/create-task-modal.tsx:381 (2) | HARD-CODED n8n webhook: recruitment-api.ts:216 (URL path is a UUID, effectively a secret, committed; GET with job posting + JD analysis in query string) and create-task-modal.tsx:381 `/webhook-test/task-assigned` (a *test* webhook, posts task title/description/assignees/KRAs to a third party on every task creation) |
| vimeo.com | lib/video-embed.ts:112 (1) |  |
| gamma.app | app/ai-platforms/page.tsx:19 (1) |  |
| www.deepseek.com | app/ai-platforms/page.tsx:29 (1) |  |
| www.midjourney.com | app/ai-platforms/page.tsx:39 (1) |  |
| claude.ai | app/ai-platforms/page.tsx:49 (1) |  |
| gemini.google.com | app/ai-platforms/page.tsx:59 (1) |  |
| runwayml.com | app/ai-platforms/page.tsx:69 (1) |  |
| placeholder.local | app/api/pal/submit/route.ts:92 (1) | URL parsing base only |
| api.deepseek.com | app/api/screenCandidate/route.ts:19 (1) | LLM (screenCandidate) |
| openrouter.ai | app/api/screenCandidate/route.ts:20 (1) | LLM (screenCandidate) |
| generativelanguage.googleapis.com | app/api/screenCandidate/route.ts:29 (1) | LLM (screenCandidate) |
| crm.triz.co.in | app/fees/help-guide-support/_components/help-guide-grid.tsx:69 (1) | help-guide links |
| checkout.razorpay.com | app/fees/online-payment/[gateway]/page.tsx:82 (1) | Razorpay checkout script |
| accounts.google.com | app/login/page.tsx:41 (1) |  |

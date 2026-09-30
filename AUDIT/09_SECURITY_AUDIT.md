# 09 - SECURITY AUDIT

> Repos in scope: `D:\lms_k12` (Next.js frontend) and `D:\next_lms_erp` (Laravel backend consumed by the frontend). Static analysis only: no code modified, no server contacted, no `.env` read. Issue IDs are the unified `LMS-AUDIT-###` IDs from [14_MASTER_ISSUE_REGISTER.md](14_MASTER_ISSUE_REGISTER.md); original per-agent IDs are shown alongside and defined in `AUDIT/parts/`.

## Summary

- Security/Authorization issues: **202** of 454 unique. Critical: 53; High: 85.
- The dominant pattern is not a single bug but a **trust model**: authentication is optional on hundreds of Laravel routes, and where present the tenant/user/role that authorize the request come from the request itself. The Next layer adds a second trust-the-client channel (`x-laravel-base-url`, `x-sub-institute-id`, `x-user-id`).
- No live exploitation was performed. Every exploitability statement is from code reading; items depending on live config are marked NOT VERIFIED.

## OWASP Top 10 (2021) mapping

| Category | Matching issues | IDs (up to 25) |
|---|---:|---|
| A01 Broken Access Control (authz, IDOR, tenant, role) | 226 | LMS-AUDIT-001, LMS-AUDIT-002, LMS-AUDIT-003, LMS-AUDIT-004, LMS-AUDIT-005, LMS-AUDIT-006, LMS-AUDIT-007, LMS-AUDIT-008, LMS-AUDIT-009, LMS-AUDIT-010, LMS-AUDIT-011, LMS-AUDIT-012, LMS-AUDIT-013, LMS-AUDIT-014, LMS-AUDIT-015, LMS-AUDIT-016, LMS-AUDIT-017, LMS-AUDIT-018, LMS-AUDIT-019, LMS-AUDIT-020, LMS-AUDIT-021, LMS-AUDIT-022, LMS-AUDIT-023, LMS-AUDIT-024, LMS-AUDIT-025 … |
| A02 Cryptographic Failures (plaintext secrets, tokens, TLS) | 46 | LMS-AUDIT-002, LMS-AUDIT-004, LMS-AUDIT-006, LMS-AUDIT-007, LMS-AUDIT-008, LMS-AUDIT-010, LMS-AUDIT-013, LMS-AUDIT-015, LMS-AUDIT-017, LMS-AUDIT-022, LMS-AUDIT-025, LMS-AUDIT-027, LMS-AUDIT-037, LMS-AUDIT-046, LMS-AUDIT-049, LMS-AUDIT-053, LMS-AUDIT-056, LMS-AUDIT-061, LMS-AUDIT-062, LMS-AUDIT-063, LMS-AUDIT-069, LMS-AUDIT-072, LMS-AUDIT-096, LMS-AUDIT-121, LMS-AUDIT-123 … |
| A03 Injection (SQL, XSS, command, object) | 70 | LMS-AUDIT-001, LMS-AUDIT-008, LMS-AUDIT-010, LMS-AUDIT-014, LMS-AUDIT-015, LMS-AUDIT-017, LMS-AUDIT-018, LMS-AUDIT-022, LMS-AUDIT-028, LMS-AUDIT-030, LMS-AUDIT-033, LMS-AUDIT-035, LMS-AUDIT-036, LMS-AUDIT-037, LMS-AUDIT-041, LMS-AUDIT-043, LMS-AUDIT-045, LMS-AUDIT-049, LMS-AUDIT-059, LMS-AUDIT-060, LMS-AUDIT-080, LMS-AUDIT-081, LMS-AUDIT-086, LMS-AUDIT-098, LMS-AUDIT-099 … |
| A04 Insecure Design (client-trusted scoring/amounts, no state machine) | 32 | LMS-AUDIT-003, LMS-AUDIT-014, LMS-AUDIT-019, LMS-AUDIT-021, LMS-AUDIT-026, LMS-AUDIT-027, LMS-AUDIT-039, LMS-AUDIT-048, LMS-AUDIT-053, LMS-AUDIT-065, LMS-AUDIT-073, LMS-AUDIT-077, LMS-AUDIT-078, LMS-AUDIT-081, LMS-AUDIT-086, LMS-AUDIT-087, LMS-AUDIT-088, LMS-AUDIT-090, LMS-AUDIT-103, LMS-AUDIT-120, LMS-AUDIT-144, LMS-AUDIT-150, LMS-AUDIT-169, LMS-AUDIT-191, LMS-AUDIT-209 … |
| A05 Security Misconfiguration (CSRF, headers, debug, CORS) | 28 | LMS-AUDIT-001, LMS-AUDIT-015, LMS-AUDIT-023, LMS-AUDIT-040, LMS-AUDIT-046, LMS-AUDIT-050, LMS-AUDIT-052, LMS-AUDIT-057, LMS-AUDIT-064, LMS-AUDIT-140, LMS-AUDIT-208, LMS-AUDIT-212, LMS-AUDIT-216, LMS-AUDIT-224, LMS-AUDIT-225, LMS-AUDIT-229, LMS-AUDIT-244, LMS-AUDIT-270, LMS-AUDIT-318, LMS-AUDIT-329, LMS-AUDIT-349, LMS-AUDIT-373, LMS-AUDIT-376, LMS-AUDIT-380, LMS-AUDIT-387 … |
| A06 Vulnerable/outdated components | 1 | LMS-AUDIT-010 |
| A07 Identification & Authentication Failures | 54 | LMS-AUDIT-006, LMS-AUDIT-009, LMS-AUDIT-010, LMS-AUDIT-012, LMS-AUDIT-013, LMS-AUDIT-017, LMS-AUDIT-025, LMS-AUDIT-027, LMS-AUDIT-034, LMS-AUDIT-037, LMS-AUDIT-044, LMS-AUDIT-046, LMS-AUDIT-048, LMS-AUDIT-049, LMS-AUDIT-054, LMS-AUDIT-055, LMS-AUDIT-061, LMS-AUDIT-062, LMS-AUDIT-063, LMS-AUDIT-066, LMS-AUDIT-069, LMS-AUDIT-071, LMS-AUDIT-137, LMS-AUDIT-155, LMS-AUDIT-157 … |
| A08 Software & Data Integrity Failures | 52 | LMS-AUDIT-004, LMS-AUDIT-006, LMS-AUDIT-007, LMS-AUDIT-008, LMS-AUDIT-011, LMS-AUDIT-012, LMS-AUDIT-021, LMS-AUDIT-048, LMS-AUDIT-053, LMS-AUDIT-064, LMS-AUDIT-065, LMS-AUDIT-093, LMS-AUDIT-095, LMS-AUDIT-097, LMS-AUDIT-102, LMS-AUDIT-103, LMS-AUDIT-107, LMS-AUDIT-108, LMS-AUDIT-114, LMS-AUDIT-115, LMS-AUDIT-123, LMS-AUDIT-129, LMS-AUDIT-137, LMS-AUDIT-151, LMS-AUDIT-165 … |
| A09 Logging & Monitoring Failures | 25 | LMS-AUDIT-024, LMS-AUDIT-036, LMS-AUDIT-039, LMS-AUDIT-063, LMS-AUDIT-068, LMS-AUDIT-070, LMS-AUDIT-102, LMS-AUDIT-105, LMS-AUDIT-118, LMS-AUDIT-171, LMS-AUDIT-189, LMS-AUDIT-203, LMS-AUDIT-222, LMS-AUDIT-233, LMS-AUDIT-240, LMS-AUDIT-289, LMS-AUDIT-294, LMS-AUDIT-301, LMS-AUDIT-321, LMS-AUDIT-325, LMS-AUDIT-339, LMS-AUDIT-348, LMS-AUDIT-380, LMS-AUDIT-398, LMS-AUDIT-432 |
| A10 SSRF | 13 | LMS-AUDIT-001, LMS-AUDIT-002, LMS-AUDIT-015, LMS-AUDIT-016, LMS-AUDIT-050, LMS-AUDIT-082, LMS-AUDIT-208, LMS-AUDIT-209, LMS-AUDIT-235, LMS-AUDIT-271, LMS-AUDIT-374, LMS-AUDIT-388, LMS-AUDIT-395 |

_Method note: the OWASP and checklist tables are produced by keyword classification of the issue text; an issue can appear under several rows and counts are indicative, not a partition._

## Checklist from the audit brief

| Topic | # issues | IDs (up to 12) / result |
|---|---:|---|
| Broken access control / authorization bypass | 84 | LMS-AUDIT-001, LMS-AUDIT-002, LMS-AUDIT-004, LMS-AUDIT-005, LMS-AUDIT-007, LMS-AUDIT-008, LMS-AUDIT-009, LMS-AUDIT-010, LMS-AUDIT-011, LMS-AUDIT-012, LMS-AUDIT-013, LMS-AUDIT-014 … |
| IDOR | 8 | LMS-AUDIT-005, LMS-AUDIT-064, LMS-AUDIT-119, LMS-AUDIT-134, LMS-AUDIT-150, LMS-AUDIT-160, LMS-AUDIT-180, LMS-AUDIT-190 |
| Authentication bypass | 10 | LMS-AUDIT-010, LMS-AUDIT-011, LMS-AUDIT-012, LMS-AUDIT-045, LMS-AUDIT-046, LMS-AUDIT-048, LMS-AUDIT-053, LMS-AUDIT-069, LMS-AUDIT-197, LMS-AUDIT-364 |
| SQL injection | 26 | LMS-AUDIT-008, LMS-AUDIT-010, LMS-AUDIT-015, LMS-AUDIT-017, LMS-AUDIT-018, LMS-AUDIT-022, LMS-AUDIT-028, LMS-AUDIT-033, LMS-AUDIT-035, LMS-AUDIT-036, LMS-AUDIT-037, LMS-AUDIT-041 … |
| XSS | 28 | LMS-AUDIT-001, LMS-AUDIT-014, LMS-AUDIT-030, LMS-AUDIT-043, LMS-AUDIT-060, LMS-AUDIT-080, LMS-AUDIT-081, LMS-AUDIT-086, LMS-AUDIT-108, LMS-AUDIT-117, LMS-AUDIT-125, LMS-AUDIT-130 … |
| CSRF | 12 | LMS-AUDIT-015, LMS-AUDIT-023, LMS-AUDIT-040, LMS-AUDIT-046, LMS-AUDIT-050, LMS-AUDIT-052, LMS-AUDIT-057, LMS-AUDIT-140, LMS-AUDIT-225, LMS-AUDIT-329, LMS-AUDIT-349, LMS-AUDIT-404 |
| SSRF | 12 | LMS-AUDIT-001, LMS-AUDIT-002, LMS-AUDIT-015, LMS-AUDIT-016, LMS-AUDIT-050, LMS-AUDIT-082, LMS-AUDIT-208, LMS-AUDIT-209, LMS-AUDIT-235, LMS-AUDIT-271, LMS-AUDIT-374, LMS-AUDIT-388 |
| File upload / path traversal | 49 | LMS-AUDIT-009, LMS-AUDIT-014, LMS-AUDIT-015, LMS-AUDIT-016, LMS-AUDIT-020, LMS-AUDIT-021, LMS-AUDIT-026, LMS-AUDIT-030, LMS-AUDIT-043, LMS-AUDIT-044, LMS-AUDIT-047, LMS-AUDIT-050 … |
| Command injection / object injection | 17 | LMS-AUDIT-059, LMS-AUDIT-098, LMS-AUDIT-099, LMS-AUDIT-100, LMS-AUDIT-183, LMS-AUDIT-196, LMS-AUDIT-200, LMS-AUDIT-231, LMS-AUDIT-290, LMS-AUDIT-291, LMS-AUDIT-354, LMS-AUDIT-364 … |
| Mass assignment | 9 | LMS-AUDIT-013, LMS-AUDIT-026, LMS-AUDIT-044, LMS-AUDIT-155, LMS-AUDIT-199, LMS-AUDIT-202, LMS-AUDIT-323, LMS-AUDIT-347, LMS-AUDIT-359 |
| Sensitive data exposure | 87 | LMS-AUDIT-006, LMS-AUDIT-007, LMS-AUDIT-008, LMS-AUDIT-009, LMS-AUDIT-010, LMS-AUDIT-012, LMS-AUDIT-013, LMS-AUDIT-015, LMS-AUDIT-017, LMS-AUDIT-020, LMS-AUDIT-022, LMS-AUDIT-024 … |
| Secrets in source / committed | 62 | LMS-AUDIT-006, LMS-AUDIT-007, LMS-AUDIT-008, LMS-AUDIT-015, LMS-AUDIT-028, LMS-AUDIT-049, LMS-AUDIT-050, LMS-AUDIT-053, LMS-AUDIT-059, LMS-AUDIT-062, LMS-AUDIT-069, LMS-AUDIT-096 … |
| Token exposure | 25 | LMS-AUDIT-002, LMS-AUDIT-046, LMS-AUDIT-060, LMS-AUDIT-062, LMS-AUDIT-080, LMS-AUDIT-117, LMS-AUDIT-126, LMS-AUDIT-172, LMS-AUDIT-195, LMS-AUDIT-203, LMS-AUDIT-214, LMS-AUDIT-224 … |
| Weak password handling | 20 | LMS-AUDIT-002, LMS-AUDIT-006, LMS-AUDIT-007, LMS-AUDIT-008, LMS-AUDIT-010, LMS-AUDIT-013, LMS-AUDIT-017, LMS-AUDIT-022, LMS-AUDIT-025, LMS-AUDIT-037, LMS-AUDIT-046, LMS-AUDIT-049 … |
| Missing rate limits | 15 | LMS-AUDIT-009, LMS-AUDIT-017, LMS-AUDIT-034, LMS-AUDIT-044, LMS-AUDIT-063, LMS-AUDIT-096, LMS-AUDIT-155, LMS-AUDIT-199, LMS-AUDIT-225, LMS-AUDIT-227, LMS-AUDIT-243, LMS-AUDIT-259 … |
| Debug mode / error leakage | 23 | LMS-AUDIT-015, LMS-AUDIT-049, LMS-AUDIT-062, LMS-AUDIT-087, LMS-AUDIT-143, LMS-AUDIT-171, LMS-AUDIT-177, LMS-AUDIT-203, LMS-AUDIT-216, LMS-AUDIT-217, LMS-AUDIT-246, LMS-AUDIT-259 … |
| Unsafe redirects / open redirect | 12 | LMS-AUDIT-114, LMS-AUDIT-124, LMS-AUDIT-161, LMS-AUDIT-177, LMS-AUDIT-209, LMS-AUDIT-221, LMS-AUDIT-311, LMS-AUDIT-365, LMS-AUDIT-382, LMS-AUDIT-383, LMS-AUDIT-393, LMS-AUDIT-409 |
| CORS | 4 | LMS-AUDIT-208, LMS-AUDIT-244, LMS-AUDIT-373, LMS-AUDIT-453 |
| Security headers / CSP | 7 | LMS-AUDIT-208, LMS-AUDIT-209, LMS-AUDIT-224, LMS-AUDIT-229, LMS-AUDIT-376, LMS-AUDIT-450, LMS-AUDIT-453 |
| Cookie / session security | 41 | LMS-AUDIT-001, LMS-AUDIT-007, LMS-AUDIT-023, LMS-AUDIT-026, LMS-AUDIT-046, LMS-AUDIT-057, LMS-AUDIT-060, LMS-AUDIT-062, LMS-AUDIT-064, LMS-AUDIT-071, LMS-AUDIT-080, LMS-AUDIT-117 … |

## Secrets and committed sensitive data

**Sweep result (Part 03, INFRA-26):** no live credentials, JWTs, private keys or credentialed URLs were found in tracked frontend files or in frontend git history (limited regex scan; `.env` and `.env.local` are untracked/ignored and were not read). Positive findings are all committed **PII** and **backend** secrets: LMS-AUDIT-059 (22-24 `.kilo/conversational-ai` files with real enquiry/student names, mobiles, e-mails, pending fees), LMS-AUDIT-015 (15 PHP scripts under `public/`, nine with production DB passwords - redacted in the report), LMS-AUDIT-121 (CCAvenue working key hard-coded), LMS-AUDIT-176 (three FCM server keys hard-coded), LMS-AUDIT-205 (n8n webhook URLs), and the lead's second-pass find LMS-AUDIT-201 (`.env.bak-before-ai-provider` tracked in the Laravel repo, contents not read).

All secret-related issues:

| ID | Severity | Module | Issue | Source IDs |
|---|---|---|---|---|
| LMS-AUDIT-015 | Critical | Web-root PHP scripts / secrets in source | Standalone PHP scripts under public/ bypass Laravel (phpinfo, request-supplied DB host, hard-coded DB passwords, SQLi in excel_upload/*) | BE-06, INT-04 |
| LMS-AUDIT-059 | High | Repository hygiene / agent tooling state | Agent runtime state under .kilo/conversational-ai (real student/enquiry PII) committed to git | INFRA-03, NAPI-13, AI-D20 |
| LMS-AUDIT-121 | High | Fees / Gateway secrets in source | CCAvenue working key (32 hex) is hard-coded in tracked source and the access code has a hard-coded fallback; | FIN-16 |
| LMS-AUDIT-176 | High | Push notifications / Firebase | Three legacy FCM **server keys are hard-coded** (`AAAA***:APA91b…`) with tenant ids 254/48 hard-coded to pick one; | BE-09 |
| LMS-AUDIT-195 | High | Outbound TLS verification disabled (ext… | Every listed call turns off peer/host verification. | INT-15 |
| LMS-AUDIT-198 | High | Secrets in source and at rest (extends… | The O*NET API username/password are embedded 28 times although `env('ONET_USERNAME'/'ONET_PASSWORD')` is used in 10 other places. | INT-18 |
| LMS-AUDIT-201 | High | Repository hygiene / secrets (Laravel) | A backup of an environment file is tracked in the Laravel git repository. | SP-01 |
| LMS-AUDIT-243 | Medium | H5P AI scenario | Public route (no middleware), calls `https://openrouter.ai/...` with `'verify' => false` (TLS verification disabled) and `env('OPENROUTER_API_KEY')` (returns n… | LMS-37 |
| LMS-AUDIT-297 | Medium | AI provider credentials storage and pre… | LLM API keys are stored unencrypted in `ai_api_keys.api_key` (`grep Crypt::\\|encrypt(\\|decrypt(` over app/Domain/AI, app/Http/Controllers/AI, app/Services/AI… | AI-D21 |
| LMS-AUDIT-444 | Low | Repository hygiene (Laravel) | Backup/dump/archive artifacts are tracked in the Laravel repo: | SP-04 |


## All Critical and High security/authorization issues

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
| LMS-AUDIT-022 | Critical | PAL Test result (`/lms/pal/{id}`), cons… | `online_exam_id` is read straight from the query string (`$online_exam_id = $request->get('online_exam_id')`) and concatenated into a raw `DB::select` string: | AI-A01 |
| LMS-AUDIT-023 | Critical | PAL practice / concept-diagnostic-asses… | These routes are registered outside every `Route::group([... | AI-A02 |
| LMS-AUDIT-024 | Critical | Enterprise Brain (all screens) / Founda… | Any valid LMS JWT — including Student and Parent profiles — resolves to the `viewer` role (default_role) which holds `read`; | AI-C01 |
| LMS-AUDIT-025 | Critical | Enterprise Brain — AI Assistant search | The global search selects entire rows (`DB::table('tbluser')->...->limit(10)->get()`) and returns each one as `'record' => $record`. | AI-C02 |
| LMS-AUDIT-026 | Critical | Migration modules (learning outcomes, i… | Tenant, user and academic year come from client-supplied request fields; | AI-D03 |
| LMS-AUDIT-027 | Critical | Fees / Mobile "GPay" self-reported paym… | `POST /fees/get_online_receipt` posts fee receipts based on client-supplied `amount`, `transactionid`, `bank_name`, `sub_institute_id`, `syear` and a student-b… | FIN-02 |
| LMS-AUDIT-028 | Critical | Fees (controllers) - SQL injection | Request values are concatenated into `whereRaw`/`selectRaw`/`DB::select` strings without binding. | FIN-03 |
| LMS-AUDIT-029 | Critical | Fees / Receipt cancellation | For `type=API` the controller replaces the JWT-hydrated tenant and user with client values, then cancels/searches receipts. | FIN-04 |
| LMS-AUDIT-030 | Critical | Hostel / Visitor (school gate visitor)… | `POST /add_visitorAPI` requires no authentication (JWT validation block commented out at `:162-172`; | FIN-39 |
| LMS-AUDIT-031 | Critical | Transportation / student route details | `GET map_student/fetchData` has no session/JWT; | FIN-57 |
| LMS-AUDIT-032 | Critical | Utility / Custom module - arbitrary row… | `table_name` comes from the request and is passed to `DynamicModel::deleteRecord($request->table_name, $id)`; | FIN-64 |
| LMS-AUDIT-033 | Critical | Utility / Custom module - DDL SQL injec… | Table/column names, types, lengths and defaults are interpolated into `CREATE/ALTER/DROP` and `SHOW TABLES LIKE` statements; | FIN-65 |
| LMS-AUDIT-034 | Critical | Admissions (enquiry / registration / on… | The three admission API controllers are registered at top level of `routes/api.php` with no middleware other than the group `throttle:1000,1`, and the controll… | STU-01 |
| LMS-AUDIT-035 | Critical | Admissions | SQL injection through `sub_institute_id`. | STU-02 |
| LMS-AUDIT-036 | Critical | Student certificates / ID cards (studen… | `Route::prefix('student/api/student_certificate' \\| 'student/api/student_icard' \\| 'student/api/teacher_icard')` are declared outside every middleware group. | STU-03 |
| LMS-AUDIT-037 | Critical | Attendance | Request parameters are concatenated into raw SQL. | STU-04 |
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
| LMS-AUDIT-080 | High | H5P playback, curriculum planning, repo… | Author-supplied HTML (flashcard `content`, question/answer text, statements, scenario descriptions, essay prompts, curriculum "details", generated report-card… | LMS-14 |
| LMS-AUDIT-081 | High | File uploads (H5P, homework, result, co… | Stored file names use the client-supplied extension/name and several endpoints validate nothing (scenario image, result upload, content upload). | LMS-15 |
| LMS-AUDIT-082 | High | H5P package export | Media references are free strings. | LMS-16 |
| LMS-AUDIT-083 | High | H5P authoring endpoints | Create/edit/delete/publish/import/media are available to any authenticated profile including students; | LMS-17 |
| LMS-AUDIT-084 | High | Homework v2 review / files | (1) `reviewList` scopes by tenant/year only `->when(request value)`; | LMS-18 |
| LMS-AUDIT-085 | High | Learning Outcome (migration-modules API) | `guard()` verifies only that a JWT is valid, then trusts `sub_institute_id`, `user_id`, `syear` from the body. | LMS-20 |
| LMS-AUDIT-086 | High | Course Master content (links) | The `link` field is stored as `url`/`filename` after only `nullable\\|string\\|max:2048`; | LMS-21 |
| LMS-AUDIT-087 | High | PAL Test result / question paper | The paper is loaded with `questionpaperModel::find($questionpaper_id)` from the URL, and `question_arr` (full `lms_question_master` rows) plus `answer_arr` (ca… | AI-A03 |
| LMS-AUDIT-089 | High | All PAL question payloads (ESO, chapter… | The correct option flag is delivered to the browser with the question, before it is answered, on every PAL surface, so it can be read in DevTools regardless of… | AI-A05 |
| LMS-AUDIT-091 | High | Pedagogy Engine, Framework/ULU views, `… | The whole chain that feeds the Pedagogy Engine, Framework and ULU screens has no authentication and no tenant scoping. | AI-B01 |
| LMS-AUDIT-092 | High | Legacy Content Intelligence review queu… | Single transition executes `ContentMetadataService::transition()` (row loaded with `findOrFail($metadataId)` - no tenant filter - status saved, log written) an… | AI-B02 |
| LMS-AUDIT-093 | High | New content model authoring/review/appr… | The only authorization is "not a student" (`is_student`). | AI-B03 |
| LMS-AUDIT-094 | High | ULU authoring API and content framework… | `POST /api/pal/content/{contentId}/framework-metadata` has no role check and no tenant check: | AI-B04 |
| LMS-AUDIT-095 | High | Enterprise Brain — decisions, execution… | The governance permissions `decision.approve`, `eso.execute` and `evidence.curate` are defined and granted to `manager` but are **used by no route**. | AI-C05 |
| LMS-AUDIT-096 | High | Career Explorer / Career Counselling ba… | 17 career GET routes are registered with **no auth middleware**. | AI-C06 |
| LMS-AUDIT-102 | High | Capability / Competency management API | The only gate is "not student/parent". | AI-C12 |
| LMS-AUDIT-104 | High | Workflow step approvals (Actions tab "W… | `approver_role` and `assigned_to` are stored on each approval and used to filter the *pending list*, but `resolveApproval` never enforces them. | AI-D06 |
| LMS-AUDIT-105 | High | AI read APIs (cases, signals, recommend… | Read endpoints filter by institute only. | AI-D07 |
| LMS-AUDIT-106 | High | Saved AI reports (`/ai-reports/[id]`):… | Any authenticated user of the institute can edit a saved report's HTML and send emails on its basis; | AI-D08 |
| LMS-AUDIT-107 | High | Platform Services (notification, schedu… | The only server-side gate on writes is `perm:platform.<service>,<action>`, which by default only logs "would have DENIED" and lets the request through; | AI-D09 |
| LMS-AUDIT-108 | High | Concept Intelligence tab names | The three tab-label routes have no auth middleware, take the tenant and user from request input, and the component lets every viewer rename tabs. | AI-D10 |
| LMS-AUDIT-109 | High | AI policy enforcement — workspace paths… | `AiPolicyResolver` is consulted in `/ask`, `/ask/stream` and `/generate` only. | AI-D11 |
| LMS-AUDIT-112 | High | Fees (all report / master / other-fees… | Multi-tenancy is enforced by trusting `sub_institute_id` from the request although the JWT already provides it. | FIN-05 |
| LMS-AUDIT-117 | High | Fees / Receipt generation and display | The printed/stored receipt takes student identity, remarks and bank fields from `$_REQUEST` (client input) instead of the database, without HTML escaping; | FIN-10 |
| LMS-AUDIT-118 | High | Fees / audit logs, online payments, rec… | These read APIs have no tenant scope: | FIN-11 |
| LMS-AUDIT-119 | High | Fees / Online fee lookup (IDOR) | Student fee/PII lookups accept any `student_id` (or mobile) with no check that the student belongs to the caller's tenant or to the caller. | FIN-12 |
| LMS-AUDIT-121 | High | Fees / Gateway secrets in source | CCAvenue working key (32 hex) is hard-coded in tracked source and the access code has a hard-coded fallback; | FIN-16 |
| LMS-AUDIT-122 | High | Fees / Receipt reprint and PDF storage | (1) Any authenticated user reprints any tenant's receipt (student_id + receipt number + client `sub_institute_id` - the UI even renders "Sub institute ID" as a… | FIN-17 |
| LMS-AUDIT-123 | High | Fees / payout & UTR endpoints | State-changing bank-side calls (CCAvenue split-payout creation, UTR sync) are triggered by anonymous GET requests; | FIN-36 |
| LMS-AUDIT-124 | High | Fees / Online fees settings (merchant c… | Any authenticated caller reaching the route (route name `online_fees_settings_api.store/destroy` has no menu row => no rights check, FIN-14) can create/delete… | FIN-37 |
| LMS-AUDIT-125 | High | Fees / file uploads (NACH S2/S4 import,… | Uploads are stored under `storage/app/public/...` (web-served through the `storage` symlink) with an extension taken from the **client file name** and no `mime… | FIN-38 |
| LMS-AUDIT-126 | High | Visitor list / type APIs | JWT is validated but `sub_institute_id` is taken from the body and never compared with the token payload. | FIN-40 |
| LMS-AUDIT-130 | High | Inventory / Library uploads | No mime/extension/size validation; | FIN-51 |
| LMS-AUDIT-134 | High | Library / IDOR and tenant trust | Unscoped `find($id)` for return/delete/edit/verification (state-changing GET `books/{id}/reutrn`, re-stamps `return_date`); | FIN-60 |
| LMS-AUDIT-136 | High | Visitor management (public pages) | Besides `add_visitorAPI` (FIN-39), the public `POST /visitor_management/add_visitor_master` and public `create()` page (`type=webForm`, tenant from query) rend… | FIN-66 |
| LMS-AUDIT-137 | High | Visitor pickup ("gate pass") OTP | The OTP is returned in the response (`$response['otp'] = $otp`, `:482`), an existing OTP is reused and never expires or clears despite the "valid 5 minutes" SM… | FIN-67 |
| LMS-AUDIT-138 | High | Visitor master update/delete | `unlink('storage/visitor_photo'.$request->input('hid_photo'))` with client-controlled name (arbitrary file delete via `../`); | FIN-68 |
| LMS-AUDIT-139 | High | Utility / Year rollover and student pro… | `from_current_syear`, `to_next_syear`, `to_academic_section`, `to_standard`, `to_division`, `students[]` / `stud_ids[]` are concatenated into `INSERT ... | FIN-69 |
| LMS-AUDIT-140 | High | Utility mutators / custom-module / fron… | Mutating routes (`rollover.create/store`, `student_transfer.store`, `student_bulk_update.store`, `transfer_student`, `show_student`) have different names from… | FIN-70 |
| LMS-AUDIT-145 | High | Front desk (gallery, calendar, circular… | These validate only that a JWT exists (`Jv`) and use tenant/year/user from the request; | FIN-76 |
| LMS-AUDIT-146 | High | Uploads across front desk / inward / cu… | Extension from client name, no mime/size validation, public web-served directories, predictable names (`date('YmdHis')`/`time()`), attachments not deleted on r… | FIN-77 |
| LMS-AUDIT-149 | High | Inward/Outward tenant scoping | Request tenant used; `update/destroy/edit` unscoped by tenant; | FIN-80 |
| LMS-AUDIT-150 | High | Utility / Custom module - IDOR, rights… | Lookups by `find($id)` without tenant (edit reassigns `sub_institute_id` to the caller); | FIN-81 |
| LMS-AUDIT-151 | High | Bazar bulk upload | Data written to `sharebazar_position/_margin/_pnl` carries no `sub_institute_id` or uploader; | FIN-82 |
| LMS-AUDIT-152 | High | Certificates / ID cards (stored XSS) | The server substitutes student/staff fields (name, father_name, address, mobile, enrollment_no) into the template with `str_replace` and no HTML escaping. | STU-09 |
| LMS-AUDIT-155 | High | Admissions (Laravel public forms) | Public (unauthenticated) routes `admission_enquiry/store` and `admission_enquiry/payment_proof`: | STU-13 |
| LMS-AUDIT-156 | High | Academic year handling / Rollover / Adm… | The hydrator takes `syear` and `term_id` straight from the request and stores them in the server session with no validation that they belong to the tenant or a… | STU-14 |
| LMS-AUDIT-158 | High | Student delete / withdraw | `tblstudentModel::where(["id" => $id])->update(['status'=>"0"])` has no tenant filter; | STU-17 |
| LMS-AUDIT-159 | High | Student medical & discipline (PII) | Health records (vaccination, height/weight, remarks, uploaded health documents, infirmary cases) and discipline notes for an entire tenant are returned by a si… | STU-20 |
| LMS-AUDIT-162 | High | Circulars | `destroy` hard-deletes `circular` by `Id` only (no tenant); | STU-35 |
| LMS-AUDIT-168 | High | Organization Management (disciplinary,… | These endpoints are tenant-scoped but have no role check: | HR-16 |
| LMS-AUDIT-169 | High | Talent Management | (1) All read endpoints are open to every staff profile (teacher, clerk, etc.): | HR-17 |
| LMS-AUDIT-170 | High | Talent Management > Recruitment files | Resumes are uploaded to the `digitalocean` disk with ACL `public` and key `hp_resume/resume_<tenant>_<first>_<middle>_<last>.<ext>` (update omits the tenant id: | HR-19 |
| LMS-AUDIT-171 | High | Task Management | `task.permission` is applied to only four read routes; | HR-22 |
| LMS-AUDIT-172 | High | General > Template management (HTML edi… | Stored template HTML is written into a contenteditable div with `innerHTML` and previewed in an `<iframe srcDoc>` with no `sandbox` attribute and no sanitisati… | HR-23 |
| LMS-AUDIT-173 | High | Laravel LMS/PAL/platform APIs (lms.auth… | 18 routes the frontend calls (GET /api/permissions, content upload/authoring, coherence-map read/write, platform registry/notifications/scheduler/workflow) are… | ORPH-04 |
| LMS-AUDIT-176 | High | Push notifications / Firebase | Three legacy FCM **server keys are hard-coded** (`AAAA***:APA91b…`) with tenant ids 254/48 hard-coded to pick one; | BE-09 |
| LMS-AUDIT-177 | High | Legacy user management (Blade controlle… | Both build `$finalArray` from **every** request key (only `_method,_token,submit,id` dropped) and call `tbluserModel::insert($finalArray)` / `->where(['id'=>$u… | BE-18 |
| LMS-AUDIT-178 | High | MCP tools / AI ask (prompt-injection tr… | `required_permission` (e.g. | BE-20 |
| LMS-AUDIT-186 | High | E-mail (AJAX send) | `POST /ajax_sendmail` has no `session`/`check_permissions` middleware. | INT-06 |
| LMS-AUDIT-187 | High | Payslips / offer letters / staff docume… | Payslip PDFs are stored on the public DigitalOcean bucket with ACL `public` at **`public/staff_document/emp_<employee_id>_payslip_<month>_<year>.pdf`** - a key… | INT-07 |
| LMS-AUDIT-188 | High | Generated PDFs, NACH bank exports and r… | Sensitive output is written under the web root/`public` disk, named from `date()` (1-second resolution) or sequential ids, and **never deleted** (`unlink` comm… | INT-08 |
| LMS-AUDIT-189 | High | Audit log written to the public disk | Every logged write appends `{query, bindings, time}` (the full SQL with **all bound values**) to `storage/app/public/access_log/<tenant>/<Y-M>.json`, i.e. | INT-09 |
| LMS-AUDIT-190 | High | Upload endpoints that trust client tena… | (a) `POST /admission_enquiry/payment_proof` is public ("for hills standalone"): | INT-10 |
| LMS-AUDIT-191 | High | Upload validation / storage architectur… | New sinks not enumerated before: | INT-11 |
| LMS-AUDIT-194 | High | Third-party AI services receiving stude… | Class photos of children (biometric face data), homework files together with `student_id`, and `enrollment_no`+`sub_institute_id` are POSTed to hard-coded thir… | INT-14 |
| LMS-AUDIT-195 | High | Outbound TLS verification disabled (ext… | Every listed call turns off peer/host verification. | INT-15 |
| LMS-AUDIT-198 | High | Secrets in source and at rest (extends… | The O*NET API username/password are embedded 28 times although `env('ONET_USERNAME'/'ONET_PASSWORD')` is used in 10 other places. | INT-18 |
| LMS-AUDIT-199 | High | Anonymous notification triggers | (1) `GET /Resend_otp?mobile=<any>` sends an SMS through **tenant 1's** gateway to any number, unauthenticated, unthrottled, and does not even store the OTP it… | INT-20 |
| LMS-AUDIT-201 | High | Repository hygiene / secrets (Laravel) | A backup of an environment file is tracked in the Laravel git repository. | SP-01 |
| LMS-AUDIT-202 | High | Laravel data-access layer (systemic) | Raw SQL expressions are used pervasively and were confirmed to be built by string concatenation of request input in many controllers (FIN-03, STU-02, STU-04, L… | SP-03 |


## Not verified

Live `.env` values (APP_DEBUG, JWT_TTL_MINUTES, LMS_API_AUTH_ENFORCE, CORS origins, mail/gateway keys); whether the web server executes PHP under `public/*` upload directories; live menu-rights rows; `npm audit`/`composer audit` (need network); live TLS/security headers.

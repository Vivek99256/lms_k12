# 04 - TENANT ISOLATION AUDIT

> Repos in scope: `D:\lms_k12` (Next.js frontend) and `D:\next_lms_erp` (Laravel backend consumed by the frontend). Static analysis only: no code modified, no server contacted, no `.env` read. Issue IDs are the unified `LMS-AUDIT-###` IDs from [14_MASTER_ISSUE_REGISTER.md](14_MASTER_ISSUE_REGISTER.md); original per-agent IDs are shown alongside and defined in `AUDIT/parts/`.

## Determination

The system is **multi-tenant, school/institute-based**. Tenant key: `sub_institute_id` (frontend also uses 6 spellings, ORPH-20); academic year: `syear`; a `client_id` groups institutes for platform admins (`is_admin=2`). There is **no Eloquent global scope** for tenancy in the reviewed models; every controller must filter by hand.

**Central finding:** the JWT carries a correct tenant, and `HydratesLegacyApiSession` hydrates it into the session, but ~245 (46 Tier-B + ~195 Tier-C API) controllers then read `sub_institute_id` / `user_id` / `student_id` / `syear` from the request body or query and trust it. Three tiers exist (Part 10): **Tier C** no auth at all (378 routes / 90 controllers), **Tier B** JWT valid but tenant from request (199 routes / 46 controllers), **Tier A** token-bound tenant (correct; ~100 routes). The frontend sends the tenant from `localStorage.userData` on every request, which is exactly what the backend trusts.

## Issues that concern tenant scoping or cross-tenant access (199)

| ID | Severity | Module | Issue | Source IDs |
|---|---|---|---|---|
| LMS-AUDIT-002 | Critical | Agents engine + Conversational AI admin… | Agents / conversational-AI engine trusts client headers for tenant+user, has unauthenticated list/run endpoints, and checks RBAC against the caller-chosen host | NAPI-02, NAPI-03, INFRA-02, AI-01, AI-C03, AI-C04 |
| LMS-AUDIT-003 | Critical | Rights enforcement (`check_permissions`) | check_permissions skips all rights checks when submit contains "Search" and fails open on routes with no menu row | AUTH-02, BE-10, FIN-41, FIN-14, STU-15 |
| LMS-AUDIT-004 | Critical | Result API, Easy Communication, Organiz… | Result API, Easy Communication and Organization-management route groups authenticate but never authorize role/rights | AUTH-10, BE-12, LMS-03, HR-21 |
| LMS-AUDIT-005 | Critical | Module dashboards (Laravel unauthentica… | Module dashboard summary endpoints (admissions/students/library/hostel/transport) have no middleware and filter by body tenant | NAPI-04, FIN-13, STU-29 |
| LMS-AUDIT-006 | Critical | AI console — providers, models, policie… | Any authenticated user (incl. students) can write AI provider keys, policies and prompt templates | AI-D01, AI-04, BE-19 |
| LMS-AUDIT-007 | Critical | Integration management (Next route hand… | /api/integration-configs is an in-memory, cross-tenant, header-presence-authenticated mock store returning plaintext secrets | AI-D02, NAPI-07, HR-20 |
| LMS-AUDIT-008 | Critical | Generic table API, menu rights, LMS cou… | Anonymous /table_data and /lms_data dump any DB table (incl. tbluser plaintext passwords); frontend depends on it | BE-01, HR-01, ORPH-01 |
| LMS-AUDIT-009 | Critical | ~90 controllers / 378 routes with no au… | ~90-195 Laravel API controllers (~300-378 routes) and ~425 web routes have no authentication and take tenant/user from the request | BE-07, AUTH-05, ORPH-02 |
| LMS-AUDIT-010 | Critical | Menu / navigation backend (`/api/menu-r… | Unauthenticated POST /api/menu-rights builds SQL from raw request values | AUTH-01, HR-05 |
| LMS-AUDIT-012 | Critical | Document Templates | DocumentTemplateApiController decodes JWT without signature verification and returns student PII unauthenticated | HR-02, AUTH-06 |
| LMS-AUDIT-013 | Critical | Organization Management > Employee Dire… | Employee Directory API: authentication only, mass-assignment, returns tbluser (password/plain_password/otp) to any token incl. students | HR-03, AUTH-03 |
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
| LMS-AUDIT-046 | Critical | Super-admin provisioning | `Route::any('superAdmin')` and `POST superAdmin-store` are on the `web` group with no `session`/`auth`/permission middleware. | BE-02 |
| LMS-AUDIT-048 | Critical | Tier B controllers (JWT valid + client-… | These controllers call `$this->jwtToken()->validate()` (signature/expiry only) and then use `sub_institute_id`, `user_id`, `syear` from the request. | BE-11 |
| LMS-AUDIT-051 | Critical | SQAA PDF / file deletion | `POST /unlink-file` deletes any path given in the request: | INT-03 |
| LMS-AUDIT-052 | Critical | Web import routes | The six import routes are registered after the closing `});` of the auth group (line 297), so they have only `web` middleware (CSRF, obtainable by any GET). | INT-05 |
| LMS-AUDIT-053 | Critical | Legacy mobile API (apiController) / JWT… | An unauthenticated GET route mints and returns a validly signed JWT for a fixed payload (id 123, "keyur modi") with no credentials. | SP-05 |
| LMS-AUDIT-054 | High | Fees, auth, admissions, attendance, res… | No automated tests protect critical flows (auth, money, admissions, attendance, marks, payroll, API handlers, authorization) | INFRA-12, AUTH-26, LMS-38, AI-A32, AI-C37, AI-D29, HR-30, STU-43, NAPI-21, BE-34 |
| LMS-AUDIT-057 | High | Laravel middleware (CSRF, menu permissi… | CSRF except-list full-URL wildcards disable CSRF for every web route on production/dev hosts | LMS-32, FIN-42, STU-40, HR-28 |
| LMS-AUDIT-058 | High | Menu -> route mapping (Result module) | Result menu route-name map shadowed/incorrect; ~31-36 menu links point at non-existent pages | AUTH-13, LMS-27, ORPH-09 |
| LMS-AUDIT-063 | High | Login | Login has no per-account/IP throttling, lockout or audit trail | AUTH-08, BE-17 |
| LMS-AUDIT-064 | High | Import data (Laravel API, proxied by Ne… | Import API (/api/import/*) has no role check and no table/column whitelist | NAPI-08, HR-15 |
| LMS-AUDIT-065 | High | AI action approval (Actions tab, AI jou… | AI action approval gate has no role/state guard; approvals replayable; approver client-supplied | AI-D04, AI-03 |
| LMS-AUDIT-068 | High | HRIT Leave | Leave APIs have no role/ownership/self-approval check; identity from request | HR-09, BE-13 |
| LMS-AUDIT-069 | High | SMS OTP login / visitor pickup OTP | Static/DOB SMS OTPs, backdoor mobile numbers and OTP returned in responses | INT-19, BE-15 |
| LMS-AUDIT-070 | High | Tenant scoping (cross-cutting; example… | The JWT hydration guarantees session tenant only for controllers that read `session()`. | AUTH-11 |
| LMS-AUDIT-072 | High | Fees online payment | `student_id` and the amount (`pay_amount ?: | NAPI-09 |
| LMS-AUDIT-075 | High | Online exam / practice / student report… | After the `session` middleware hydrates a verified identity, these controllers still use `$request->get('user_id') ?: | LMS-09 |
| LMS-AUDIT-077 | High | Result - marks entry & approval | (1) `points`, `per`, `grade` are client-computed and stored verbatim; | LMS-11 |
| LMS-AUDIT-079 | High | Result - classwise grade report / rank | When `type == 'API'` (which every Next.js call is) `getRank` reads `syear` and `sub_institute_id` from `$_REQUEST` and **overwrites `$term_id` with the constan… | LMS-13 |
| LMS-AUDIT-083 | High | H5P authoring endpoints | Create/edit/delete/publish/import/media are available to any authenticated profile including students; | LMS-17 |
| LMS-AUDIT-084 | High | Homework v2 review / files | (1) `reviewList` scopes by tenant/year only `->when(request value)`; | LMS-18 |
| LMS-AUDIT-085 | High | Learning Outcome (migration-modules API) | `guard()` verifies only that a JWT is valid, then trusts `sub_institute_id`, `user_id`, `syear` from the body. | LMS-20 |
| LMS-AUDIT-087 | High | PAL Test result / question paper | The paper is loaded with `questionpaperModel::find($questionpaper_id)` from the URL, and `question_arr` (full `lms_question_master` rows) plus `answer_arr` (ca… | AI-A03 |
| LMS-AUDIT-088 | High | ESO write endpoints (diagnostic submit,… | Correctness is server-resolved (good) but everything around it is trusted: | AI-A04 |
| LMS-AUDIT-091 | High | Pedagogy Engine, Framework/ULU views, `… | The whole chain that feeds the Pedagogy Engine, Framework and ULU screens has no authentication and no tenant scoping. | AI-B01 |
| LMS-AUDIT-092 | High | Legacy Content Intelligence review queu… | Single transition executes `ContentMetadataService::transition()` (row loaded with `findOrFail($metadataId)` - no tenant filter - status saved, log written) an… | AI-B02 |
| LMS-AUDIT-094 | High | ULU authoring API and content framework… | `POST /api/pal/content/{contentId}/framework-metadata` has no role check and no tenant check: | AI-B04 |
| LMS-AUDIT-095 | High | Enterprise Brain — decisions, execution… | The governance permissions `decision.approve`, `eso.execute` and `evidence.curate` are defined and granted to `manager` but are **used by no route**. | AI-C05 |
| LMS-AUDIT-100 | High | Capability Intelligence — role-mapping… | Three implementations of "roles with a skill map" disagree. | AI-C10 |
| LMS-AUDIT-104 | High | Workflow step approvals (Actions tab "W… | `approver_role` and `assigned_to` are stored on each approval and used to filter the *pending list*, but `resolveApproval` never enforces them. | AI-D06 |
| LMS-AUDIT-105 | High | AI read APIs (cases, signals, recommend… | Read endpoints filter by institute only. | AI-D07 |
| LMS-AUDIT-108 | High | Concept Intelligence tab names | The three tab-label routes have no auth middleware, take the tenant and user from request input, and the component lets every viewer rename tabs. | AI-D10 |
| LMS-AUDIT-111 | High | AI policy resolver (`/ask`, `/ask/strea… | `$row` is a `stdClass` returned by `->first()` (Laravel 12; | AI-D13 |
| LMS-AUDIT-112 | High | Fees (all report / master / other-fees… | Multi-tenancy is enforced by trusting `sub_institute_id` from the request although the JWT already provides it. | FIN-05 |
| LMS-AUDIT-115 | High | Fees / receipts & idempotency | Receipt numbers are `MAX(existing)+1` read outside the write transaction, with no lock and (per migration `2023_03_05_115658_create_fees_receipt_table.php`) no… | FIN-08 |
| LMS-AUDIT-118 | High | Fees / audit logs, online payments, rec… | These read APIs have no tenant scope: | FIN-11 |
| LMS-AUDIT-119 | High | Fees / Online fee lookup (IDOR) | Student fee/PII lookups accept any `student_id` (or mobile) with no check that the student belongs to the caller's tenant or to the caller. | FIN-12 |
| LMS-AUDIT-121 | High | Fees / Gateway secrets in source | CCAvenue working key (32 hex) is hard-coded in tracked source and the access code has a hard-coded fallback; | FIN-16 |
| LMS-AUDIT-122 | High | Fees / Receipt reprint and PDF storage | (1) Any authenticated user reprints any tenant's receipt (student_id + receipt number + client `sub_institute_id` - the UI even renders "Sub institute ID" as a… | FIN-17 |
| LMS-AUDIT-123 | High | Fees / payout & UTR endpoints | State-changing bank-side calls (CCAvenue split-payout creation, UTR sync) are triggered by anonymous GET requests; | FIN-36 |
| LMS-AUDIT-125 | High | Fees / file uploads (NACH S2/S4 import,… | Uploads are stored under `storage/app/public/...` (web-served through the `storage` symlink) with an extension taken from the **client file name** and no `mime… | FIN-38 |
| LMS-AUDIT-126 | High | Visitor list / type APIs | JWT is validated but `sub_institute_id` is taken from the body and never compared with the token payload. | FIN-40 |
| LMS-AUDIT-130 | High | Inventory / Library uploads | No mime/extension/size validation; | FIN-51 |
| LMS-AUDIT-132 | High | Hostel / capacity and double booking | Uniqueness only per (user, group, year, tenant); | FIN-54 |
| LMS-AUDIT-133 | High | Library / issue and availability | Issue validates only `student_id exists:tblstudent,id` (global) and dates; | FIN-59 |
| LMS-AUDIT-134 | High | Library / IDOR and tenant trust | Unscoped `find($id)` for return/delete/edit/verification (state-changing GET `books/{id}/reutrn`, re-stamps `return_date`); | FIN-60 |
| LMS-AUDIT-136 | High | Visitor management (public pages) | Besides `add_visitorAPI` (FIN-39), the public `POST /visitor_management/add_visitor_master` and public `create()` page (`type=webForm`, tenant from query) rend… | FIN-66 |
| LMS-AUDIT-137 | High | Visitor pickup ("gate pass") OTP | The OTP is returned in the response (`$response['otp'] = $otp`, `:482`), an existing OTP is reused and never expires or clears despite the "valid 5 minutes" SM… | FIN-67 |
| LMS-AUDIT-138 | High | Visitor master update/delete | `unlink('storage/visitor_photo'.$request->input('hid_photo'))` with client-controlled name (arbitrary file delete via `../`); | FIN-68 |
| LMS-AUDIT-139 | High | Utility / Year rollover and student pro… | `from_current_syear`, `to_next_syear`, `to_academic_section`, `to_standard`, `to_division`, `students[]` / `stud_ids[]` are concatenated into `INSERT ... | FIN-69 |
| LMS-AUDIT-143 | High | Utility / Inter-institute student trans… | `to_sub_institute_id` never checked to belong to the same client; | FIN-73 |
| LMS-AUDIT-144 | High | Utility / Update-all-data (bulk deactiv… | Mass deactivation end-dates every active enrolment of the tenant for a client-supplied `syear`, without dry-run/transaction/audit, and always reports success (… | FIN-74 |
| LMS-AUDIT-145 | High | Front desk (gallery, calendar, circular… | These validate only that a JWT exists (`Jv`) and use tenant/year/user from the request; | FIN-76 |
| LMS-AUDIT-149 | High | Inward/Outward tenant scoping | Request tenant used; `update/destroy/edit` unscoped by tenant; | FIN-80 |
| LMS-AUDIT-150 | High | Utility / Custom module - IDOR, rights… | Lookups by `find($id)` without tenant (edit reassigns `sub_institute_id` to the caller); | FIN-81 |
| LMS-AUDIT-151 | High | Bazar bulk upload | Data written to `sharebazar_position/_margin/_pnl` carries no `sub_institute_id` or uploader; | FIN-82 |
| LMS-AUDIT-153 | High | Attendance | Server-side validation that exists in `showStudent` (academic-year window, holiday, Sunday) is absent from `save`. | STU-10 |
| LMS-AUDIT-155 | High | Admissions (Laravel public forms) | Public (unauthenticated) routes `admission_enquiry/store` and `admission_enquiry/payment_proof`: | STU-13 |
| LMS-AUDIT-156 | High | Academic year handling / Rollover / Adm… | The hydrator takes `syear` and `term_id` straight from the request and stores them in the server session with no validation that they belong to the tenant or a… | STU-14 |
| LMS-AUDIT-158 | High | Student delete / withdraw | `tblstudentModel::where(["id" => $id])->update(['status'=>"0"])` has no tenant filter; | STU-17 |
| LMS-AUDIT-159 | High | Student medical & discipline (PII) | Health records (vaccination, height/weight, remarks, uploaded health documents, infirmary cases) and discipline notes for an entire tenant are returned by a si… | STU-20 |
| LMS-AUDIT-160 | High | Proxy / substitution teacher | `update` and `destroy` operate by `id` only (`proxyModel::where(["id" => $id])->update/delete()`), a cross-tenant IDOR (STU-06 pattern). | STU-21 |
| LMS-AUDIT-162 | High | Circulars | `destroy` hard-deletes `circular` by `Id` only (no tenant); | STU-35 |
| LMS-AUDIT-163 | High | HRIT Leave | (1) No balance check on apply; | HR-10 |
| LMS-AUDIT-165 | High | HRIT Payroll (monthly) | The server computes the payslip lines but stores whatever the client posts: | HR-12 |
| LMS-AUDIT-168 | High | Organization Management (disciplinary,… | These endpoints are tenant-scoped but have no role check: | HR-16 |
| LMS-AUDIT-169 | High | Talent Management | (1) All read endpoints are open to every staff profile (teacher, clerk, etc.): | HR-17 |
| LMS-AUDIT-170 | High | Talent Management > Recruitment files | Resumes are uploaded to the `digitalocean` disk with ACL `public` and key `hp_resume/resume_<tenant>_<first>_<middle>_<last>.<ext>` (update omits the tenant id: | HR-19 |
| LMS-AUDIT-171 | High | Task Management | `task.permission` is applied to only four read routes; | HR-22 |
| LMS-AUDIT-176 | High | Push notifications / Firebase | Three legacy FCM **server keys are hard-coded** (`AAAA***:APA91b…`) with tenant ids 254/48 hard-coded to pick one; | BE-09 |
| LMS-AUDIT-177 | High | Legacy user management (Blade controlle… | Both build `$finalArray` from **every** request key (only `_method,_token,submit,id` dropped) and call `tbluserModel::insert($finalArray)` / `->where(['id'=>$u… | BE-18 |
| LMS-AUDIT-180 | High | Tenancy in schema | 188 of 827 tables (23 %) carry no tenant column in the migrations, including tenant-owned data (leave, library, exam attempts, PAL learner state, student aspir… | DB-02 |
| LMS-AUDIT-182 | High | Missing unique constraints | Business rules that require uniqueness are enforced only in controllers: | DB-05 |
| LMS-AUDIT-183 | High | Production migration safety | The only safeguard is a regex on the raw argv: | DB-09 |
| LMS-AUDIT-186 | High | E-mail (AJAX send) | `POST /ajax_sendmail` has no `session`/`check_permissions` middleware. | INT-06 |
| LMS-AUDIT-189 | High | Audit log written to the public disk | Every logged write appends `{query, bindings, time}` (the full SQL with **all bound values**) to `storage/app/public/access_log/<tenant>/<Y-M>.json`, i.e. | INT-09 |
| LMS-AUDIT-190 | High | Upload endpoints that trust client tena… | (a) `POST /admission_enquiry/payment_proof` is public ("for hills standalone"): | INT-10 |
| LMS-AUDIT-191 | High | Upload validation / storage architectur… | New sinks not enumerated before: | INT-11 |
| LMS-AUDIT-192 | High | Generic import engine (extends HR-15) | Beyond HR-15 (client column names, public file retention): | INT-12 |
| LMS-AUDIT-193 | High | Fees reconciliation upload | (1) The reconciled amount is doubled: | INT-13 |
| LMS-AUDIT-194 | High | Third-party AI services receiving stude… | Class photos of children (biometric face data), homework files together with `student_id`, and `enrollment_no`+`sub_institute_id` are POSTed to hard-coded thir… | INT-14 |
| LMS-AUDIT-196 | High | ICICI Orange payment gateway | Orange payment initiation posts to the **UAT** host `https://pgpayuat.icicibank.com/tsp/pg/api/v2/initiateSale` (the production URL is commented out with the n… | INT-16 |
| LMS-AUDIT-198 | High | Secrets in source and at rest (extends… | The O*NET API username/password are embedded 28 times although `env('ONET_USERNAME'/'ONET_PASSWORD')` is used in 10 other places. | INT-18 |
| LMS-AUDIT-199 | High | Anonymous notification triggers | (1) `GET /Resend_otp?mobile=<any>` sends an SMS through **tenant 1's** gateway to any number, unauthenticated, unthrottled, and does not even store the OTP it… | INT-20 |
| LMS-AUDIT-200 | High | Console commands (destructive seeding) | The class docblock promises it "writes only to a dedicated sub_institute_id, never to one holding real records", and `guardTenant()` refuses non-synthetic tena… | INT-21 |
| LMS-AUDIT-202 | High | Laravel data-access layer (systemic) | Raw SQL expressions are used pervasively and were confirmed to be built by string concatenation of request input in many controllers (FIN-03, STU-02, STU-04, L… | SP-03 |
| LMS-AUDIT-203 | Medium | All modules (Result, Fees, HRIT, Capabi… | JWT duplicated in URLs/query strings/bodies (log, history, referrer leakage) | ORPH-08, LMS-31, HR-26, FIN-19 |
| LMS-AUDIT-206 | Medium | Agents store, conversational-AI admin s… | Agents/conversational-AI persisted in local JSON files (races, multi-instance loss, ephemeral FS) | INFRA-16, AI-09, NAPI-16 |
| LMS-AUDIT-207 | Medium | Fees / tenant-specific hard-coding | Business rules keyed by hard-coded tenant/school ids | FIN-23, BE-31, FIN-86 |
| LMS-AUDIT-215 | Medium | Generic migrated modules (`/reports/*`,… | Generic "migrated module" pages dump raw first-array API data / show feature names with no implementation | STU-33, AI-D19 |
| LMS-AUDIT-217 | Medium | Password reset | Forgot/reset password leaks registered e-mails and reset-token weaknesses | BE-28, AUTH-15 |
| LMS-AUDIT-218 | Medium | Role identification (frontend and backe… | "Who is an admin/student/staff" is computed by at least 10 frontend and 8 backend rules over tenant-authored free-text profile names with different spellings,… | AUTH-17 |
| LMS-AUDIT-219 | Medium | Menu rights identity and platform admins | (1) The menu request carries no `Authorization` header and the identity is whatever `menuContext`/`userData`/`sessionData`/`session` localStorage keys contain… | AUTH-18 |
| LMS-AUDIT-223 | Medium | User / profile administration | Anyone with `add`/`edit` on `add_user.index` can set `user_profile_id` to any active profile of the tenant, including the admin profile (only tenant and status… | AUTH-22 |
| LMS-AUDIT-226 | Medium | Conversational-AI service tokens | Tokens are minted, hashed and displayed, but `authenticateServiceRequest` is called only from `service.test.ts`; | NAPI-14 |
| LMS-AUDIT-239 | Medium | Exam Evaluation publish | `obtain_marks => (int) round($obtained)` drops fractional marks (0.5-mark schemes); | LMS-25 |
| LMS-AUDIT-245 | Medium | Teach Assistant panel - data sent to AI… | Each open-panel navigation, filter or keystroke in a search box re-posts `page_data` (up to 25 records x 8 attributes: | AI-07 |
| LMS-AUDIT-250 | Medium | Concept diagnostic ("adaptive") answers | The option must belong to the submitted `question_id` (good) but the question is not checked against the concept/chapter/tenant or against what was served, and… | AI-A09 |
| LMS-AUDIT-252 | Medium | ESO chapter dashboard / empty content | With no ESO-ready concept (every tenant except the one whose nodes were loaded) `chapterDashboard` returns `current_concept_name = null`, `chapter_sections = [… | AI-A11 |
| LMS-AUDIT-256 | Medium | Legacy practice: spaced repetition, his… | (a) `updateConceptMastery` inserts a `lms_concept_mastery_log` row per answer; | AI-A16 |
| LMS-AUDIT-263 | Medium | Coherence Map | `scopeFrom()` computes the caller's tenant but `map()` and `health()` call the repository without it (`$this->map->map($scope['standard_id'], $scope['subject_i… | AI-B05 |
| LMS-AUDIT-264 | Medium | Administration (architecture settings) | (1) `mayWrite` only honours `$auth['user_profile_name']` for the `writer_profiles` list, but `pal_auth` does not contain that key (it has `user_profile_id`, `r… | AI-B06 |
| LMS-AUDIT-272 | Medium | Personalize Marks | The server performs no validation: | AI-B14 |
| LMS-AUDIT-275 | Medium | Gamification teacher actions (team chal… | The teacher class-scope rule (`class_teacher`/`timetable`) is applied only when a `learner_id` is present. | AI-B26 |
| LMS-AUDIT-278 | Medium | Brain JWT bridge | (a) The accepted signing secrets include `config('app.key')` in addition to `JWT_SECRET` — anyone with APP_KEY can mint Brain tokens for any tenant/role. | AI-C15 |
| LMS-AUDIT-279 | Medium | Capability Intelligence API clients | Every capability request adds `token`, `sub_institute_id`, `user_id`, `syear`, `financial_year`, `type=API` to the **URL query string**, in addition to the `Au… | AI-C16 |
| LMS-AUDIT-281 | Medium | Generic module "Intelligence" tab | The client calls `GET /api/brain/{tenant}/modules/{module}/intelligence` and documents `BrainIntelligenceController::moduleIntelligence`, but that method and r… | AI-C18 |
| LMS-AUDIT-282 | Medium | Capability Intelligence — Capability Ex… | The screen is an iframe of `https://skill-ontology-neo4j.vercel.app/?sub_institute_id=<tenant>` — a third-party hosted **example dataset** (the component's own… | AI-C19 |
| LMS-AUDIT-298 | Medium | Generation inputs (prompt-injection sur… | (1) `variables` from the client are merged last (`… $this->pageVariables($context), $validated['variables'] ?? []`), so they override server-derived `entity_la… | AI-D22 |
| LMS-AUDIT-299 | Medium | AI cost and abuse limits | The only limit is 60 requests/minute per user across all AI calls; | AI-D23 |
| LMS-AUDIT-306 | Medium | Exports (all fee/report pages using `li… | (Confirmed independently by sub-audit B, X-1: | FIN-26 |
| LMS-AUDIT-312 | Medium | Inventory / Transportation / Hostel APIs | Tenant and user are validated against the token, but `syear` is taken from input for writes. | FIN-44 |
| LMS-AUDIT-315 | Medium | Inventory / reports and receipts | The overall report left-joins one-to-many tables and sums (multiplied totals; | FIN-50 |
| LMS-AUDIT-317 | Medium | Transportation / student mapping and fa… | Fare (`amount`, `distance`) is computed in the browser and stored as sent (`nullable\\|numeric\\|min:0`); | FIN-56 |
| LMS-AUDIT-318 | Medium | Transportation / routes outside auth gr… | `api/get-bus-list`, `api/get-stop-list` (no tenant filter), `ajaxCheckRemainCapacity`, `DELETE map_student/bulk-delete` (no `session`/`check_permissions`) and… | FIN-58 |
| LMS-AUDIT-319 | Medium | Library / validation, counts, reports | `store()` has no validation (`no_of_items` unbounded loop; | FIN-62 |
| LMS-AUDIT-321 | Medium | Utility / year-end misc | `syear`/`to_next_syear` not validated against the tenant's `academic_year`; | FIN-83 |
| LMS-AUDIT-322 | Medium | Front desk / Gallery, calendar, timetab… | Gallery re-stores every attachment per std x div but keeps only the last file name (multi-photo albums lose photos, storage duplicated); | FIN-84 |
| LMS-AUDIT-323 | Medium | Implementation master / Petty cash | `saveData` copies every request key into the insert after setting tenant/year from session, so client keys override tenant/year and become column names; | FIN-85 |
| LMS-AUDIT-325 | Medium | Bulk student update | Whitelisted fields are updated without: | STU-19 |
| LMS-AUDIT-326 | Medium | Teacher transfer | Transfer is `UPDATE timetable SET teacher_id = new WHERE teacher_id = left ...` only. | STU-22 |
| LMS-AUDIT-327 | Medium | Class teacher master | `grade_id`, `standard_id`, `division_id`, `teacher_id` are only `integer`; | STU-23 |
| LMS-AUDIT-328 | Medium | Academic setup / student master data | Subjects, periods (and `period_details`), batches, division capacities, subject-standard maps, houses and quotas are hard-deleted with no dependency check (tim… | STU-24 |
| LMS-AUDIT-330 | Medium | Certificates | The duplicate-issue guard passes an array (`$student_ids = explode(',', ...)`) to `->where('a.student_id',$student_ids)`, so it does not match per student; | STU-26 |
| LMS-AUDIT-332 | Medium | Student list (`/students/search_student… | (1) "Add New Student" modal is a static form: | STU-32 |
| LMS-AUDIT-334 | Medium | Student requests | Approval/rejection updates `student_change_request` by `ID` only, with `DECIDED_BY` from the client `user_id`, no tenant filter, no state machine (Approved can… | STU-37 |
| LMS-AUDIT-335 | Medium | File uploads (student photo, parents' p… | Extension is taken from the client filename (`File::extension($originalname)` / `pathinfo`), files are written to public storage (`storeAs('public/student/'...… | STU-38 |
| LMS-AUDIT-337 | Medium | Attendance UI consistency | Two competing attendance-marking screens; | STU-41 |
| LMS-AUDIT-340 | Medium | Staff documents and payslips | Staff documents (PAN, Aadhaar, payslips are `document_type_id=56`) are stored on the Laravel `public` disk as `<userid><timestamp>.<client ext>`, the upload ta… | HR-31 |
| LMS-AUDIT-341 | Medium | Payroll statutory rules | Statutory rules are hardcoded: | HR-32 |
| LMS-AUDIT-346 | Medium | Session/identity handling across modules | Identity/tenant/year/role are read through 60 independent session readers (46 names) plus the shared buildSessionContext; | ORPH-16 |
| LMS-AUDIT-347 | Medium | Mass assignment / request-driven writes | Sensitive columns are mass-assignable; | BE-21 |
| LMS-AUDIT-348 | Medium | Audit logging | The entire access-log write **and** the cross-tenant `add_user`/`add_student` PUT guard are inside `if type != API && != JSON`. | BE-22 |
| LMS-AUDIT-350 | Medium | Migrations, schema hygiene | 708 tables created by migrations; | BE-25 |
| LMS-AUDIT-351 | Medium | Jobs, events, scheduler | With the default `sync` driver the four AI-grading jobs run inside the HTTP request (60–600 s); | BE-26 |
| LMS-AUDIT-352 | Medium | Outbound integrations (SMS, e-mail, Wha… | TLS verification is disabled for SMS/FCM/other calls; | BE-27 |
| LMS-AUDIT-353 | Medium | Login ambiguity on duplicate e-mails | `loginModel::where(['email'=>$email,'status'=>'1'])->first()` (no `ORDER BY`) picks one row; | BE-29 |
| LMS-AUDIT-357 | Medium | Indexing | 274 of 532 tenant-column tables have no index containing the tenant column, 154 of 181 `syear` tables have none on the year, and hot tables are bare: | DB-07 |
| LMS-AUDIT-360 | Medium | Data types | Keys and dates are stored as free text: | DB-14 |
| LMS-AUDIT-361 | Medium | Comma-separated lists in columns | Many-to-many relations are stored as CSV strings: | DB-15 |
| LMS-AUDIT-362 | Medium | Data seeding inside schema migrations | Menu structure, role rights, workflow definitions and AI templates are deployed as migrations that write into live shared tables. | DB-18 |
| LMS-AUDIT-364 | Medium | WhatsApp inbound webhooks & delivery st… | Meta's webhook endpoints are public, unsigned and stubbed: | INT-22 |
| LMS-AUDIT-365 | Medium | Notification delivery mechanics | All sending is synchronous in the HTTP request. | INT-23 |
| LMS-AUDIT-366 | Medium | Bulk-send cost controls, consent and te… | HR-21 covers who can send. | INT-24 |
| LMS-AUDIT-367 | Medium | Platform Services - Communication and S… | The consoles let admins switch channels and edit cron schedules per tenant, but **no runtime code reads those tables**: | INT-25 |
| LMS-AUDIT-370 | Medium | Leave import | The employee lookup is `tbluserModel::where('first_name', <first word>)->orwhere('last_name', <second word>)->where('status',1)->first()` - the `OR` makes the… | INT-28 |
| LMS-AUDIT-371 | Medium | Bazar (share-market) uploads | `for ($i = 0; $i < $rowCount - 1; | INT-29 |
| LMS-AUDIT-377 | Medium | Download endpoints without ownership ch… | `downloadFile` returns the storage URL for any homework id (`studentHomeworkModel::find($homeworkId)`, no tenant/student/teacher check); | INT-35 |
| LMS-AUDIT-384 | Low | Login (hardcoded ids / inference) | Estate-specific ids and a magic user id are embedded in login/permission logic; | AUTH-29 |
| LMS-AUDIT-387 | Low | Duplicated proxy code | Each copy has drifted: | NAPI-18 |
| LMS-AUDIT-407 | Low | Gamification - streak/time-on-task inte… | xAPI telemetry `timestamp` and `result.duration_seconds` are client-supplied and uncapped; | AI-B18 |
| LMS-AUDIT-428 | Low | Inventory / Transportation / Hostel mas… | Deletes have no reference checks (hard delete hostel/room/route/vehicle/item/vendor even when referenced; | FIN-52 |
| LMS-AUDIT-429 | Low | Unauthenticated legacy student routes | Routes are outside any auth group; | STU-42 |
| LMS-AUDIT-433 | Low | General > Implementation management | The transaction deletes `implementation_master` rows for the whole tenant (`where sub_institute_id`), not the current `syear`, then inserts only the current ye… | HR-35 |
| LMS-AUDIT-436 | Low | Cross-module consistency | Same concept, many spellings: | ORPH-20 |
| LMS-AUDIT-437 | Low | Pagination | 842 `->get()` vs 158 paginate/limit/take in `api/`,`HRMS/`,`G2gLms/`; | BE-32 |
| LMS-AUDIT-442 | Low | Legacy / one-off commands | One-off tenant migrations, test commands and duplicated sync code ship in production; | INT-37 |
| LMS-AUDIT-445 | Info | Patterns worth replicating | Not a defect. The Users module asks the server what the actor may do and hides controls accordingly while the server independently enforces; | AUTH-34 |
| LMS-AUDIT-452 | Info | General config APIs (positive control) | These controllers are the reference implementation: | HR-36 |
| LMS-AUDIT-454 | Info | Good patterns already in the codebase (… | Info Improvement Other Good patterns already in the codebase (to reuse) `Services\Evaluation\ExamEvaluationStorage.php`, `Services\lms\H5P\H5PPackageArchive.ph… | INT-39 |


## Per-area scoping analysis (verbatim)

### Part 01 - Auth, roles, menus

## 4. Tenant / school / academic-year scoping findings

| Question | Finding | Evidence |
|---|---|---|
| Does the client send `sub_institute_id`, `syear`, `user_id`, `term_id`? | Yes, on every call: `appendCommonParams()` (`lib/erp-client.ts:190-203`), `buildQuery()`/`contextBody()` (`lib/erp-legacy.ts:99-118`), and again in bodies (`app/user/api.ts:63-66`). Values come from `localStorage` (`buildSessionContext`, `erp-client.ts:58-177`), including a user-selectable `selectedAcademicYear`. | 251 files use `buildSessionContext` |
| Trusted by the server? — verified-JWT routes | **Tenant/user/profile: no** — `HydratesLegacyApiSession` takes them from the verified token only (docblock lines 15-20; `hydrateSessionFromClaims`). **`syear`/`term_id`: yes** — `$request->input('syear'/'term_id')` overrides the current term (`HydratesLegacyApiSession.php` ~84-105), so a user can read any year of their own tenant. | trait |
| Trusted by the server? — controllers | **Often yes.** 641 controllers read `sub_institute_id` from request input (4,888 hits; 476 files read `session()`). On a session-hydrated route a request-supplied tenant still wins wherever the controller reads `$request->…` instead of `session()`. Concrete: `fees_audit_log_api_controller@index` filters `system_audit_logs` by `sub_institute_id` **only if the client sends one** — omit it and every tenant's fee audit log is returned (`fees/fees_audit_log_api_controller.php:33-48`; route `GET fees/audit_logs` = `web,session,menu,logRoute,check_permissions,api.session`). | AUTH-11 (LMS-AUDIT-070) |
| Trusted by the server? — unauthenticated routes | **Fully.** ~195 API controllers and ~425 web routes take `sub_institute_id`/`user_id` from the body with no token (`StudentHomeworkApiController:22,115,290`, `ApiLmsCourseController:64,92,719`, `ExamEvaluationApiController:44…`, `admissionEnquiryAPIController:15`, `AdmissionsDashboardApiController`…). `LmsApiAuth` docblock itself calls this "the platform-wide auth surface… 170-odd unauthenticated routes". | AUTH-05 (LMS-AUDIT-009) |
| `menu-rights` | Identity for the menu comes **only** from the request body (no token) and is user-editable in localStorage. | AUTH-01 (LMS-AUDIT-010)/18 |
| `host_name` trust | The ERP base URL for every subsequent call is `userData.host_name` (server-provided `env('APP_URL')`), unless `NEXT_PUBLIC_ERP_BASE_URL` overrides (`erp-client.ts:56, 139-142`). A tampered/mis-set `host_name` redirects the bearer token to another host (needs XSS or a mis-set `APP_URL`). | AUTH-30 (LMS-AUDIT-210) |
| Client-level admins | `sub_institute_id = 0` users are rejected by `useMenuRights.isValidMenuContext` (needs truthy tenant) and by `hydrateSessionFromClaims` (`empty($subInstituteId)` -> 401); login does not remap the token to `$clientSubInstituteId`. | AUTH-18 (LMS-AUDIT-219) |
| Tenant switch | The web `setinstitute` mechanism is not reachable from the SPA (docs §1.2c). Header offers only an academic-year/term switcher (`refreshAcademicTerms` -> unauthenticated `GET /api/academic-terms?sub_institute_id=&syear=`). | `AuthContext.tsx:343-365`; `ApiLoginController::academicTerms` |

---



### Part 02 - Next API routes

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
| fees/online-payment/[gateway] | form field `student_id`, `pay_amount`, `total` | Laravel `createRazorpayOrder` looks up `tblstudent` by id with no tenant/ownership check (NAPI-09 (LMS-AUDIT-072)) |
| integration-configs | none (single global array across all tenants) | **Global**; any caller sees/edits every tenant's records (NAPI-07 (LMS-AUDIT-007)) |
| import/* | none in Next; Laravel uses session tenant for `sub_institute_id` but `csv_data` rows have no tenant column | cross-tenant `csv_data` id reuse (NAPI-08 (LMS-AUDIT-064)) |

---



### Part 03 - Infra, config, tests, docs

## 4. Tenant / school / academic-year scoping findings (infra-level)

- Tenant (`sub_institute_id`) and year (`syear`) are **client-supplied everywhere**: `sub_institute_id` in 251 files (653 hits), `subInstituteId` in 232 files (696), `syear` in 256 files (779). 29 files set `x-laravel-token`, `x-sub-institute-id` and `x-user-id` headers that the 20+ Next route proxies copy into Laravel request bodies (for example `app/api/dashboard/admin/route.ts:42-70`: `sub_institute_id: subInstituteId, syear: academicYearId, user_id: userId` taken straight from headers).
- Whether Laravel re-derives the tenant from the JWT is `NOT VERIFIED` here (`docs/admin-user-journey.md` and `app/api/dashboard/admin/route.ts` header comment say "the JWT alone decides the caller's role", which supports it, but it was not traced).
- **Local tenant-keyed stores trust the header tenant with no token binding**: `lib/agents/store.ts` keys agents and runs by `actor.tenant_id`, which `readRequestSession` reads from `x-sub-institute-id` (`lib/agents/acting-user.ts:38-46`). `listAgents`/`listRuns` only call `requireActor` (non-empty strings), so any caller can read any tenant's agent definitions and run logs (INFRA-02 (LMS-AUDIT-002)). The tenant-isolation unit test (`lib/agents/engine.test.ts`, "tenants are isolated") tests the store filter and not a real session.
- Hard-coded tenant/year literals: none material (`app/course-master/[courseId]/chapters/sideDrawer.tsx:866` `let sub_institute_id = 0` is a local default). Good.

---



### Part 04 - LMS / H5P / Exam / Result

## 4. Tenant / school / academic-year scoping findings

Tenant key `sub_institute_id`, year `syear`, user `user_id`. How each entry path derives them:

| Path | Where `sub_institute_id` / `user_id` / `syear` come from | Trusted server-side? |
|---|---|---|
| `api.session` routes (`ApiSessionHydrator`) | Token claims for tenant/user/profile; **`syear` and `term_id` from request** (`$request->input('syear')`) | Tenant/user: yes. `syear`: client-selected but validated only against nothing (cannot cross tenant). Good pattern. |
| Result API controllers | `session('sub_institute_id')` (token) for reads/list; **bare `id` for update/delete** | List scoping good; mutation by id **not tenant-scoped** (LMS-03 (LMS-AUDIT-004)). `getRank` API branch reads `$_REQUEST['sub_institute_id']`, `$_REQUEST['syear']` and forces `term_id = 149` (LMS-13 (LMS-AUDIT-079)). |
| Legacy web routes via `session` middleware + `type=API` (`lms/online_exam`, `lms/lmsStudent_report`, `lms/lmsdashboard`, ...) | Token hydrates the session, **but controllers read `$request->get('sub_institute_id') ?: session()`** (request first) | **Client value wins** -> tenant and user spoofing (LMS-09 (LMS-AUDIT-075)). |
| H5P legacy controllers (Scenario, InteractiveVideo `store`) | For `type=API`: `$sub_institute_id = $request->sub_institute_id; $user_id = $request->user_id; $syear = $request->syear` (explicitly overrides the hydrated session) | Client-controlled (LMS-17 (LMS-AUDIT-083)). Newer `H5PContentTypeController::tenant()` prefers session and `findForTenant()` scopes reads/writes - good. Flashcard `index/store` use session, but `edit/update/destroy` use unscoped `findOrFail($id)`. |
| Anonymous `/api/*` (question-paper, lms-courses, lms-question-bank, exam-evaluation, blueprints, templates, lms-homework legacy, intelligence/*, lesson-intelligence/*) | Request body/query (`sub_institute_id`, `syear`, `user_id`, `user_profile_name`) | Fully client-controlled; several accept **missing** tenant as "all tenants" (`->when($sub_institute_id, ...)`), e.g. `lms-homework/bulk-delete`, `lms-homework/review-list`. |
| `MigrationModulesApiController` | JWT validity checked, then `$r->integer('sub_institute_id')` | Client-controlled; `learning-outcomes` list/delete not tenant-filtered at all (LMS-20 (LMS-AUDIT-085)). |
| SQAA | `session('sub_institute_id')` (token) | Yes. |
| `POST result/student-result/save-html` | session tenant | Yes (but writes client HTML/zeros, LMS-12 (LMS-AUDIT-078)). |
| Frontend | `buildSessionContext()` (`lib/erp-client.ts`) picks active year from `academicTerms[0]` / `selectedAcademicYear`; `app/course-master/page.tsx::getSyear()` and `lib/result/api.ts::getResultSession()` use `selectedAcademicYear` else `academicYears[0]` / `userData.syear` | **Three different year-resolution rules** in one product (LMS-35 (LMS-AUDIT-214)); `baseUrl` is read from localStorage `host_name` (`erp-client.ts`) so a tampered value redirects the bearer token to another host (self-inflicted, Low). |

Additional facts: `getRank()` hard-codes `term_id = 149` for API callers; `getPassingRatio` hard-codes grade ids 148/149 (33%) else 35% and grade ids 146/147 for display; `AJAXController::getStandardList` hard-codes `sub_institute_id == 195` menu-id lists. These are tenant-specific constants in shared code.

---



### Part 05 - PAL / AI / Intelligence

_(section 4 not found in part05-pal-ai-intelligence.md)_


### Part 06 - Fees / Finance / Operations

## 4. Tenant / school / academic-year scoping findings

* Frontend always sends `sub_institute_id`, `syear`, `user_id`, `term_id`, `user_profile_id`, `user_profile_name`, `client_id` in the body **and, for GET report calls, in the URL together with the bearer `token`** (`app/fees/_lib/fees-api.ts:186-196`, `app/api/fees/reports/_lib/fees-report-proxy.ts:46-56,59-67`). Values are read from `localStorage`/`sessionStorage` (`fees-api.ts:64-169`) - any XSS or extension can change them.
* Laravel side, JWT-hydrated tenant is **correctly used** by: `fees_collect_controller::show_student/pay_fees/edit/getBk` (session), `feesRefundController` (session), `FeesRefundApiController`, `TeacherFeeDuesApiController`, `RoleDashboardApiController`.
* Laravel side, client-supplied tenant **overrides** the JWT in ~55 places (grep result, `app/Http/Controllers/fees`): `feesCancelController.php:96,258`, `fees_collect_controller.php:2026,3292` (`studentFeesDetailAPI` even `session()->put('sub_institute_id', <client>)`), `feesDefaulterReportController.php:32,60`, `feesReportController.php:68,144,327,570`, `feesModificationController.php:62,264`, `feesStructureReportController.php:51`, `feesTypewiseReportController.php:31,68`, `otherNewfeesReportController.php:33,61`, `otherNew_CancelFeesReportController.php:32,60`, `studentBreakoffReportController.php:35,70`, `monthwiseReceiptPdfController.php:35`, `NACH/s1,s3,s4` (six sites), `other_fees_collect_controller.php:26,54,161`, `other_fees_cancel_controller.php:35,64,164`, `other_fees_title_controller.php:39,56,72,120,141`, `other_fee_map_controller.php:23`, `tblfeesConfigController.php:26,66,112,137,173,188`, `tblfeesLateController.php:77,144,266,333,404`, `feesReceiptBookMasterController.php:24`, `fees_breackoff_controller.php:24`, `feesMonthHeadercontroller.php:30,129`, `confirmOnlineFeesController.php:40,144,260`, `online_fees_collect_controller.php:549 (?? 76),2506`, `AJAXController::ajax_PDF_FeesReceipt` (`AJAXController.php:1802-1804`), `FeesDashboardApiController::summary`.
* Never scoped at all: `fees_audit_log_api_controller::index` (tenant filter only if client passes one; `module` also client-chosen), `online_payments_api_controller::index/show`, `reconciliation_status_api_controller::index`, `fees_online_maping`-less `get_fees` (student lookup by id only, `online_fees_collect_controller.php:58-68`), `createRazorpayOrder` student lookup (`online_fees_payment_api_controller.php:56-63`), `getStudentFromMobile` (mobile -> student ids across every tenant, `AJAXController.php:1345-1364`).
* Hard-coded per-tenant business rules in fee maths: `sub_institute_id` 254, 48, 61, 76, 47, 49, 200, 257, 253 (`fees_collect_controller.php:258,266,1154,1191,2348,3105,3109`, `feesCancelController.php:135`, `feesReportController.php:259`, `online_fees_collect_controller.php:92,321,549`). `hdfc_response_handler` decrypts every tenant's callback with tenant **76**'s working key (`online_fees_collect_controller.php:320-323`).
* `syear` is client-controlled everywhere (also by design "year switcher"). `pay_fees` accepts any past/future `syear` (`fees_collect_controller.php:403`) and any `receiptdate` (`:793`): back-dated receipts and payments into closed years are possible; no period-lock exists in the code read.

Operations modules (sub-audits A and B): tenant is validated against the JWT in `InventoryApiController`, `TransportationApiController`, `HostelSetupApiController`, `ClassTeacherApiController` (`:73-77`) and the timetable `*Api` methods (session). It is taken from the request in: `BookController::show/allBookLists/store-edit`, `itemScanController` (all actions), the library/hostel/transportation dashboards (unauthenticated), `map_student/fetchData`, `visitor_masterController` (all), `adminapiController::get_adminVisitorListAPI`, `PhotoVideoGallaryApiController`, `calendar_api_controller`, `circularController`, `CircularReportController`, `parentCommunicationController`, `exam_scheduleController` (destroy unscoped), `FrontDeskApiController`, `PettyCashApiController`, `inwardController`/`outwardController`/`place_masterController`, `CustomModuleController`/`DynamicModel` (global table names), `MigrationModulesApiController` (bazar: no tenant column), `studentTransferController` (`to_sub_institute_id`). `syear` is client-controlled in every module (`HydratesLegacyApiSession`), so rollover/bulk operations can target any year (FIN-83 (LMS-AUDIT-321)).

---



### Part 07 - Students / Admissions / Attendance

## 4. Tenant / school / academic-year scoping findings

- Client sends: `sub_institute_id`, `syear`, `user_id`, `term_id`, `user_profile_id`, `user_profile_name`, `client_id` and even the JWT as a `token` param, on every call (`lib/erp-client.ts:190-203`, `lib/erp-legacy.ts:100-118`, `app/fees/_lib/fees-api.ts:186-206`). The values come from `localStorage.userData/menuContext/sessionData` (trivially editable).
- Server trust:
  - Trusted from token (correct): everything behind `api.session` (`HydratesLegacyApiSession.php:66-90`) for `sub_institute_id`, `user_id`, `user_profile_id`, `is_admin`, `is_student`. The trait does NOT trust a client `sub_institute_id` (test proves it).
  - Trusted from client (wrong): the adminapi student endpoints (`$request->input('sub_institute_id')` after only `jwtToken()->validate()`), the legacy controllers' `type=API` branches, the three admission API controllers (no auth at all), `studentAttendanceController::saveStudentAttendance` (`teacher_id`, `user_profile_id`, `sub_institute_id`, `syear` from the body, line ~275-283), `proxyController::update/destroy` (id only), `circularController::store` (`action=API` switches to `$_REQUEST` ids), `tblstudentController::destroy` (id only), `studentRequestController::updateStatus` (id only).
  - Academic year: `HydratesLegacyApiSession.php:80-81,128` puts the client `syear`/`term_id` into the server session with no validation; that session value is then string-concatenated into raw SQL in several controllers (STU-14 (LMS-AUDIT-156)).
- Client-side year resolution is inconsistent between two helper stacks: `lib/erp-client.ts::buildSessionContext` picks the active term year and ignores stale `selectedAcademicYear` (comment lines 102-110), while `app/fees/_lib/fees-api.ts::getFeesSession` (used by students/student/dashboard modules) falls back to `academicYears[0]` = "earliest year on file (often empty of data)" (`fees-api.ts:152-156`). Screens can therefore query different years in the same session (STU-31 (LMS-AUDIT-214)).
- Data-model notes: `attendance_student` and `tblstudent_enrollment` carry `syear` + `sub_institute_id`; `tblstudent` carries `sub_institute_id` only (memory: `roll_no` is on enrollment, `roll_no_1` on `tblstudent` - the Next code correctly reads roll from enrollment). `admission_form.enquiry_id` stores `enquiry_no` while `admission_registration.enquiry_id` stores the numeric id (per `AdmissionsDashboardApiController` comment) - joins between them depend on that inconsistency.
- `proxy_master` list ignores `syear` although the controller reads it (`proxyController.php:36-77`): all years' proxies are listed for the tenant.

---



### Part 08 - HR / Org / Tasks / General

## 4. Tenant / school / academic-year scoping findings

Client sends `sub_institute_id`, `syear`, `user_id`, `token` on nearly every call (`lib/erp-client.ts buildSessionContext`, values come from `localStorage.userData/menuContext/sessionData`, `erp-client.ts:75-160`). The question is whether the server trusts them.

| Module | Tenant source on server | Verdict |
|---|---|---|
| Leave, Attendance | Tenant from verified JWT (`ResolvesLeaveContext.php:43-46`, G-SEC-29). **`user_id` and `syear` from request** | Tenant safe. Identity spoofable (HR-09 (LMS-AUDIT-068), HR-11 (LMS-AUDIT-164)). `syear` only picks the date window |
| Payroll (legacy) | Session hydrated from JWT, **but controllers overwrite with `$request->sub_institute_id` whenever `type=API`** (`PayrollController.php:47,91,218,272,536,571,657,675,778,980,1172,1590,1763,1908,1934`) | Cross-tenant read/write/delete (HR-06 (LMS-AUDIT-042)) |
| Employee directory, disciplinary, compliance, task management, talent, easy_com | Session from JWT (`ApiSessionHydrator`), `tenant()` reads session | Tenant scoping OK for reads. But employee directory `buildAttributeArray` lets the request override `sub_institute_id` (HR-03 (LMS-AUDIT-013)). Task assignee and screening `candidate_id` not tenant-validated (HR-19 (LMS-AUDIT-170), HR-22 (LMS-AUDIT-171)) |
| Complaint, Consent, Front desk, Petty cash | `validateContext` requires `sub_institute_id` in request; JWT only checked for validity, payload tenant never compared (`ComplaintApiController.php:48-70`, `PettyCashApiController.php:44-66`) | Any valid token can address any school (HR-07 (LMS-AUDIT-043)) |
| Document templates | `claims` decoded **without signature verification**, falls back to `$request->input('sub_institute_id')` (`DocumentTemplateApiController.php:61-92`) | Fully client controlled (HR-02 (LMS-AUDIT-012)) |
| `/table_data`, `/lms_data`, `/task`, `requirements`, `ai-sop`, `menu-rights` | request-supplied or none | Unauthenticated (HR-01 (LMS-AUDIT-008), HR-05 (LMS-AUDIT-010), HR-08 (LMS-AUDIT-044)) |
| Import | session tenant for inserts; `csv_data` rows have no tenant column | any user can process/match another school's uploaded CSV by id (HR-15 (LMS-AUDIT-064)) |
| add_process | sends `sub_institute_id: "0"` (`general/add_process/api.ts:19`), so all schools share the same global rows | design flaw plus unauthenticated resource controller (HR-08 (LMS-AUDIT-044)) |
| Task assign | `TASK_ALLOCATED_TO` validated as integer only (`LegacyTaskController.php:75`), tasks/notifications can target users of other tenants | HR-22 (LMS-AUDIT-171) |
| Academic year | `syear` from `selectedAcademicYear` localStorage validated against session years (`erp-client.ts:100-118`). Leave year window comes from `academic_year` MIN/MAX. Requests that straddle the boundary disappear (HR-10 (LMS-AUDIT-163)). Payroll uses financial-year logic (Jan-Mar => year+1) inconsistently between create and store (HR-12 (LMS-AUDIT-165)) |

---



### Part 09 - Routes / APIs / Orphans

## 4. Tenant / school / academic-year scoping findings

- The client always sends the scope: `type=API`, `sub_institute_id`, `syear`, `user_id`, `term_id` are appended by `lib/erp-legacy.ts:buildQuery/contextBody`, `lib/erp-client.ts:appendCommonParams`, `lib/result/api.ts`, and ~60 module-local session readers (data-consistency section 6c).
- Server trust: api.session routes ignore the client tenant in favour of JWT claims (HydratesLegacyApiSession takes syear/term from request only as a *selector* and validates against academic_year for the JWT tenant). The 114 unauthenticated routes and `GET /table_data` take the tenant entirely from request parameters, so any caller can read/write any tenant by changing `sub_institute_id` (ORPH-01 (LMS-AUDIT-008), ORPH-02 (LMS-AUDIT-009)).
- `GET /table_data?table=tbluser&filters[sub_institute_id]=<any>` is the extreme case: the frontend itself passes the tenant as a *client filter* (payroll-api.ts:911-915) and the server applies whatever filters it is given.
- Academic year: `syear` (wire) vs `academicYear`/`academicYearId`/`selectedAcademicYear` (client) with two precedence orders (erp-client: active term first, stale selection ignored; result/brain readers: `selectedAcademicYear ?? userData.syear`) - the same screen family can show different years (data-consistency section 2).
- Key names for the same tenant value: `sub_institute_id` 785/246 files, `subInstituteId` 762/232, `instituteId` 78/29, `tenantId` 39/7, `tenant_id` 28/7, `client_id` 63/21 (data-consistency section 1).



### Part 10 - Laravel authz / tenant

## 4. Tenant / school / academic-year scoping findings

Tenant key `sub_institute_id`; year `syear`; role `user_profile_id`/profile name; also `client_id` (group of schools) and `is_admin` (0/1 client-admin with `sub_institute_id=0`, 2 = platform admin).

Census (code, whole `app/Http/Controllers`): **228 controller files read `sub_institute_id` straight from request input/query/`$_REQUEST` (743 occurrences)** — 51 in `api/`, 38 `lms/`, 33 `fees/`, 22 `student/`, 16 `front_desk/`, 13 `result/`; 260 `if type=='API'` branches; 218 hard-coded tenant-id conditionals in 34 files (most used: 254 ×44, 47 ×40, 76 ×13, 61 ×13, 198 ×10, 257 ×8).

Classification of the 779 routes with no route-level auth (heuristic, controller source + used traits):

| Tier | Meaning | controllers | routes |
|---|---|---|---|
| C — no auth in controller | anonymous; tenant/user/role all client-supplied | 90 | 378 (+13 closure/view) |
| B — JWT merely *valid*, tenant from body | any valid token (even of another school, a student, or an OTP-mobile token) can act on any tenant | 46 (+3 B2) | 199 (+7) |
| A2 — token-bound tenant, no role | tenant safe, authorization missing | 17 | 102 |
| A — token-bound + rights | correct | 13 | 59 |
| controller class missing | dead routes | 10 | 21 |

Answers to the brief's questions (a)–(j), per family (only families actually sampled are stated; everything else is "not reviewed"):

| Family | (a) identity/tenant from token or request? | (b) tenant filter on every table? | (c) per-role authz | (d) raw SQL | (e) mass assignment | (f) uploads | (j) IDOR |
|---|---|---|---|---|---|---|---|
| Menu/rights (`MenuRightsController`) | **request** (`sub_institute_id`,`client_id`,`user_id`,`user_profile_name` role) | n/a | none | **interpolated** (l.54,67,125–255) | – | – | any user's menu list |
| Admissions API | **request** | yes (where clauses) but 4 raw `whereRaw('...'.$sub_institute_id.'...')` | none | **interpolated** (l.59,135,271,639,675,766) | `saveStudent` creates `tblstudent` from stored enquiry | – | `admission_registration/{id}` etc. |
| LMS course/question bank | **request** | `sub_institute_id IN (x,1)` (platform tenant 1 shared) | none | **interpolated** in `search()` (l.108,111,117–126,144) | – | `uploadContent` | question-bank update/delete by id: tenant guard "unreliable" per code comment |
| Exam evaluation | **request** (`user_id` of publisher too) | yes | none | bound | – | well validated (mime whitelist, random name) | sequential batch/sheet ids + tenant supplied → IDOR |
| Petty cash / complaint / consent / front-desk / gallery | JWT valid, **request tenant** | yes | none (front-desk: profile lookup for one action) | bound | field lists | `bill_image` unvalidated, `->move(public_path('pettycash'))` | cross-tenant by choosing `sub_institute_id` |
| Student family on `adminapi.php` | JWT valid, **request tenant + user_id** | yes | none | bound | `BulkStudent::update` uses whitelist `STUDENT_FIELDS` | – | cross-tenant student read/update |
| Leave / HR attendance | **token tenant** ✔ / request `user_id`, `employee_id` | yes | **none** | bound | – | – | `employee_id` cross-tenant `exists` check |
| Users / setup / rights (Tier A) | token ✔ | yes | yes | bound | whitelist via `only()` | – | `where id AND sub_institute_id` ✔ |
| Result API / EasyCom API / Org-mgmt | token ✔ (session hydrated) | yes (legacy models) | **none** | legacy code (many interpolations) | delegate to legacy controllers | – | – |
| Legacy `student/api/*` certificate/icard | **request builds the session** (`bootstrapRequestContext` puts request `sub_institute_id`,`user_profile_name`,… into session) | | none | | | | anonymous |
| Legacy `tbluserController` | session ✔ but **request keys overwrite** it (loop after `$finalArray['sub_institute_id']`) | `updateData` has **no tenant filter** | menu rights | – | **`insert($finalArray)` of every request key** | photo | cross-tenant user takeover |
| Fees | session ✔ (token-hydrated) for most; `PaidUnpaid`, `studentFeesDetailAPI` take `student_id`,`sub_institute_id` from request | | menu rights (bypassable) | interpolation in some raw joins | – | – | fee status of any student |
| MigrationModules | request | `learning-outcomes`,`indicator-mappings` reads/deletes **not tenant filtered at all** | none | bound | – | Excel `bazar` upload | delete any tenant's rows by id |
| PAL | token ✔ | ✔ | learner ownership ✔ | – | 2 `$request->all()` writes | – | ✔ |
| AI / MCP | token ✔ (`X-MCP-Institute-Id` only within allowed set; platform admin `is_admin=2` may switch) | ✔ (services filter by context) | partial (BE-19 (LMS-AUDIT-006)/20) | – | – | screenshots as data-URI, stored on `local` disk (ok) | ✔ |
| Brain | token ✔ + `brain.tenant` (route tenant must equal token tenant) | ✔ | ✔ | – | – | – | ✔ |

Academic year: `syear`/`term_id` accepted from the client everywhere; defaulted to the current term by date when absent (`hydrateSessionFromClaims`). Cross-year reads are tenant-safe but unrestricted for students (a student can read prior years).

---



### Part 11 - Database

## 4. Tenant / school / academic-year scoping findings (schema view)

Extends part10 section 4 (which covered controllers). Here: what the **schema** does and does not enforce.

### 4.1 Tenant columns
| Tenant key | Tables | Type in migrations |
|---|---|---|
| `sub_institute_id` (or `SUB_INSTITUTE_ID`/`SubInstituteId`) | **532** | unsignedBigInteger 234, integer 200, bigInteger 72, **string 20, text 3** (`admission_form`, `fees_paid_other`, `hrms_leave_allocation`, `inventory_tax_master`, `result_co_scholastic*` x4, `result_marks`, `result_remark_masters`, `result_std_grd_maping`, `result_student_attendance_master`, `result_working_day_master`, `rightside_menumaster`, `school_detail`, `smtp_details`, `tblmenumaster`, `tblmenumaster_new/old`) |
| `tenant_id varchar(36)` (Brain, UUID) | 103 + 4 `hpbrain_*` without any (`hpbrain_dead_letter_queue`, `hpbrain_consumer_state`, `hpbrain_health_checks`, `hpbrain_tenants`) | mapping tenant UUID <-> `sub_institute_id` lives in application code only |
| `client_id` (group of schools) | `school_setup`, `tblapplications`, `sharebazar_position` | int |
| `institute_id` | `onet_institute_courses` | |
| `sub_institute_id = 0` | convention for a global/template row in 19 migration literals (`onboarding_module`, `pal_architecture_settings`, `master_fields_table` ...) | unique keys including tenant treat 0 as a real tenant |
| **none** | **188** | see 4.2 |

Two coexisting tenant vocabularies (`sub_institute_id` vs `tenant_id`), plus `client_id`, plus uppercase variants in 39 tables with PascalCase/UPPER columns (`task.ID/SYEAR/STATUS`, `complaint.SUB_INSTITUTE_ID`, `result_exam_master.SubInstituteId varchar(255)`, `school_setup.Id/SchoolName`).

### 4.2 Tenant-owned data with **no tenant column in the migrations** (188 tables; frontend-relevant ones first)
| Group | Tables | Consequence |
|---|---|---|
| HR / leave | `hrms_emp_leaves` (keyed by `user_id`, no index), `hrms_holidays` (code filters `sub_institute_id` at `HrmsController.php:1225,1374` - column exists live but not in any migration: drift), `hrms_weekdays` | tenant isolation depends entirely on joining `tbluser` |
| Library | `library_books`, `library_items`, `library_book_circulations` (student-keyed) | whole library catalogue is cross-tenant at DB level |
| LMS exams / learner state | `lms_online_exam`, `lms_online_exam_answer(_student)`, `lms_online_exam_student`, `lms_offline_exam_answer`, `lms_question_mapping`, `lms_mapping_type`, `lms_student_profile`, `lms_concept_mastery(_log)`, `lms_forgetting_curve`, `lms_student_engagement`, `lms_class_insights`, `lms_teacher_interventions`, `lms_peer_tutoring_groups`, `lms_knowledge_graph`, `lms_content_metadata/recommendations/provenance`, `lms_units`, `lms_learning_outcomes/objectives` (27 total) | learner-keyed; the estate-wide question pool split (memory: `project_pal_calibration_tenant_split`) is only possible because `lms_question_master` has a tenant column |
| PAL | 45 `pal_*` tables created by `pal_schema_full.sql`-era migrations (`pal_learning_sessions`, `pal_assessment_results`, `pal_learner_states`, `pal_learner_misconceptions`, `pal_remediation_sessions`, `pal_telemetry_events`, `pal_learning_plans`, `pal_badges`, `pal_learner_streaks`, ...) | keyed by `learner_id`/`student_id`; `PalApiAuth` learner-ownership check (part10) is the only guard; `pal_concept_nodes`, `learner_node_state` (ESO, newer) do carry `sub_institute_id` |
| Students | `student_aspirations`, `student_ambitions`, `student_career_originality` (`student_id` **string**, `academic_year`), `student_change_request`(+`_req_type`), `student_document_type`, `temp_signup` (`institute_name`, `syear` string) | |
| Fees | `fees_receipt_css`, `fees_title_master`, `fees_cancel_type`, `fees_menu_categories/items` (masters, plausibly global) | |
| Other | `complaint_status`, `counselling_online_exam_answer`, `counselling_question_mapping`, `learning_outcome_*` (4), `form_builder`, `app_notification*`, `activity_log`, `access_log`(has `SUB_INSTITUTE_ID`), `err_log`, `s2_log`, `incoming_messages`, `evidence_events` (student-keyed, `academic_year`), `exam_evaluation_answer` (via sheet_id), `ptm_booking_master`, `role_responsibility`, `workflow_steps/versions`, `s_skill_matrix`, `s_assessment_library`, `s_mobility_talent_pool_members`, `talent_workflow_stages/approvers` | audit/notification tables cannot be filtered per tenant |

Global references legitimately without tenant: `tblcity`, `tblstate`, `religion`, `caste`, `blood_group`, 18 `o_net_*`, `password_resets`, `failed_jobs`, `personal_access_tokens`, `users`, `wk_*`.

### 4.3 Hot tables: tenant / year columns and indexes (from migrations; live NOT VERIFIED)
| Table | Tenant col (type) | Index on tenant | `syear` (type) | Index on `syear` | Other keys |
|---|---|---|---|---|---|
| `fees_collect` | `sub_institute_id` int | **no** | int | **no** | idx `student_id`, redundant idx on PK `id`; no unique on `receipt_no` |
| `fees_payment` | bigInteger NN | **no** | **string(150)** | no | **0 indexes**; `student_id varchar(150)`, `amount varchar(150)`; gateway ids in longText |
| `fees_refund` | bigInteger | no | bigInteger | no | idx `student_id` |
| `fees_cancel` | int NN | yes (+ syear, student, standard, term) | int | yes | only well-indexed fees table |
| `fees_breackoff` | int | yes | int | yes | 8-column composite unique |
| `fees_receipt_book_master` | int | no | int | no | idx `receipt_id`; `last_receipt_number varchar(50)` counter |
| `fees_title`, `fees_head_master`, `fees_late_master`, `fees_online_maping`, `fees_other_collection` | int | no | int / string | no | |
| `tblstudent` | bigInteger | yes | - | - | unique `(sub_institute_id, enrollment_no)` **added 2026-09-01 and skipped if duplicates exist** (live NOT VERIFIED) |
| `tblstudent_enrollment` | bigInteger | yes | bigInteger | yes | unique `(syear,student_id,term_id,sub_institute_id)` - `term_id` is nullable so uniqueness is not enforced for NULL terms |
| `tbluser` | int NN | conditional (Brain migration) | - | - | no unique `email`/`user_name`; `email` index only from `2026_09_03_008900` |
| `tbluserprofilemaster` | bigInteger NN | yes | - | - | |
| `attendance_student` | int (nullable) | **no** | int | no | idx `student_id`, `attendance_date`; **no unique `(student_id, attendance_date[, standard/section])`** |
| `timetable` | int NN | no | int NN | no | six single-column indexes (teacher/standard/period...), no composite with tenant/year |
| `result_marks` | **string NN** | no | none | - | **0 indexes**, no unique `(student_id, exam_id)` |
| `result_create_exam` | int NN | no | int NN | no | 0 indexes |
| `result_exam_master` | `SubInstituteId varchar(255)` | no | - | - | |
| `hrms_emp_leaves` | **none** | - | - | - | no index (not even `user_id`), `status enum` |
| `hrms_leave_allocation` | `text` | no | `year text(15)` | - | every column is TEXT (employee_id, leave_type_id, year, value, sub_institute_id) |
| `hrms_attendances` | unsignedBigInteger NN | no | - | - | no index on `(user_id, day)` |
| `tblmenumaster` | **text NN (CSV list)** | no | - | - | 0 indexes |
| `tblgroupwise_rights`, `tblindividual_rights` | int | **no** | - | - | 0 indexes |
| `homework`, `lms_assignment` | int | no | int | no | 0 indexes; `homework` declares 4 FKs only in a stub migration |
| `lms_question_master` | int | no | - | - | 5 indexes on concept/chapter/deleted_at; unique `(concept_id, question_type_id, g_content_hash)` |
| `task` | int | no | `SYEAR` int | no | legacy UPPER-case columns + new snake-case columns |
| `smtp_details` | **string NN** | no | - | - | |

Aggregate: of 532 tenant-column tables, **258 have an index containing the tenant column, 274 do not**; of 181 tables with `syear`, **27** index it and **7** have a `(sub_institute_id, syear)` composite. (BE-25 (LMS-AUDIT-350) counted 199 / 264; the difference is raw-SQL and const-array index migrations it could not see.)

### 4.4 Academic-year representation
`syear` in **182 tables**, but stored as integer (103), string (41), bigInteger (16), decimal (11), unsignedInteger (10) - inconsistent joins (`fees_payment.syear varchar(150)` vs `fees_collect.syear int`). Other spellings: `academic_year` (17 tables: `ai_*`, `evidence_events`, `student_*`, `library_books`, `workflow_runs`, `assessment_blueprint` which has **both** `syear` and `academic_year`), `year` (6 payroll/HR tables, `hrms_leave_allocation.year text`), `term_id` (27), `marking_period_id` (16; 9 tables carry both `syear` and `marking_period_id`). `academic_year(id, term_id, syear, sub_institute_id, start_date, end_date, ...)` is the calendar table, itself with no unique key.

### 4.5 Enforcement model
There is **no database-level or Eloquent-level tenant enforcement**: 0 global scopes across 475 models, 7,217 raw builder calls, 78 `FIND_IN_SET(...)` CSV-column lookups, 59 `LIKE '%...'`, no MySQL views/RLS, no per-tenant schemas (the legacy `tblclient.db_*` multi-DB design is vestigial). Every controller must remember `where('sub_institute_id', ...)`; part10 shows 228 controllers reading the tenant from the request. The only tenant-aware construct at DB level is the composite unique keys on the newer Brain/platform/onboarding tables (`onboarding_module (module_key, sub_institute_id)`, `workflow_definitions (workflow_key, sub_institute_id)`, `platform_notification_channels (sub_institute_id, channel)`, `user_dashboard_preferences (sub_institute_id,user_id,user_type,dashboard_key)`, ...).

---



### Part 12 - Uploads / Import-Export / Notifications / Jobs / Integrations

## 4. Tenant / school / academic-year scoping findings

* Upload paths are **not tenant-namespaced** in 96 of ~100 controllers (`public/student/<id>.<ext>`, `public/frontdesk/<timestamp>`, `public/inward/<timestamp>`, `public/lms_content_file/<date>` ...). Only `ContentUploadService` (`lms_content_file/<tenant>/<chapter>/<uuid>`), `MobilePageAssetUploadService` (`mobile_page_builder/<tenant>/<page>/<uuid>`), `ExamEvaluationStorage` (generated names) and parent photos (`father_<enrollment>_<tenant>.ext`) embed a tenant. Library uploads use a shared name-keyed folder (FIN-51 (LMS-AUDIT-130)).
* `sub_institute_id` from the client is trusted in: T3 upload/notify controllers (`PettyCash`, `FrontDesk`, `Complaint`, `PhotoVideoGallary`, `StudentCare`), `tblstudentDocumentController::store` when `type=API|JSON` (`:44-46`), `Import*::process` for `tblstudent` via a mapped `sub_institute_id` column (INT-12 (LMS-AUDIT-192)), `public/excel_upload/*.php` (`$_REQUEST['sub_institute_id']`, INT-04 (LMS-AUDIT-015)), `crm-whatsapp` (hard-selects tenant 1's WhatsApp token for any anonymous caller).
* `csv_data` (import staging, `longText`) has **no tenant column**; `process` loads by primary key (`ImportApiController.php:146`), so another tenant's staged file can be processed (HR-15 (LMS-AUDIT-064)).
* `fees_reconciliation` duplicate check ignores tenant (`fees_reconciliation_upload_sheet_controller.php:80`), `sharebazar_*` tables and `MigrationModulesApiController::bazarReport` have no tenant, `LeaveImport` name lookup has no tenant (INT-28 (LMS-AUDIT-370)), `incoming_messages` chat read by number only (`WhatsappController::whatsappShowReply:566`).
* `syear`: import defaults to the session `syear` but `prepareData['syear']` from the CSV overrides it for students/fees; reconciliation joins `tblstudent_enrollment` **without** `syear` (INT-13 (LMS-AUDIT-193)).
* Exports: all server exports read tenant from session/JWT (good). Client exports operate on already-fetched rows.

---



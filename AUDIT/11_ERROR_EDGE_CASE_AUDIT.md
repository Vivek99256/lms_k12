# 11 - ERROR HANDLING & EDGE CASE AUDIT

> Repos in scope: `D:\lms_k12` (Next.js frontend) and `D:\next_lms_erp` (Laravel backend consumed by the frontend). Static analysis only: no code modified, no server contacted, no `.env` read. Issue IDs are the unified `LMS-AUDIT-###` IDs from [14_MASTER_ISSUE_REGISTER.md](14_MASTER_ISSUE_REGISTER.md); original per-agent IDs are shown alongside and defined in `AUDIT/parts/`.

## Summary

The most consequential edge-case failures are financial and academic: non-idempotent receipt numbering and callbacks (FIN-08, FIN-28), refunds beyond paid amount (FIN-09), discount/fine typed in the UI silently discarded (FIN-06), attendance dates shifted by UTC conversion for IST users and unmarked students counted absent (STU-11, STU-12), report-card save wiping attendance/percentage with zeros (LMS-12), leave balance/overlap/holiday rules unenforced (HR-10, HR-13), and 'closed exam' evaluating as open (LMS-08). Error handling leaks: SQL text and paths returned to clients, and SMTP error leakage (BE-23). Silent failures: fake success in quiz publish (LMS-29), 404-driven silent fallbacks in PAL (AI-A28), empty screens on API failure (AI-C30, AI-D28).

## Related issues (201)

| ID | Severity | Module | Issue | Source IDs |
|---|---|---|---|---|
| LMS-AUDIT-001 | Critical | Every Laravel-proxying Next handler (SS… | Server-side routes take the upstream Laravel host from a client-controlled header/param (SSRF + bearer/cookie exfiltration) | NAPI-01, INFRA-01, AUTH-14, AI-02, AI-A08, ORPH-05, LMS-19, FIN-18, STU-30 |
| LMS-AUDIT-004 | Critical | Result API, Easy Communication, Organiz… | Result API, Easy Communication and Organization-management route groups authenticate but never authorize role/rights | AUTH-10, BE-12, LMS-03, HR-21 |
| LMS-AUDIT-005 | Critical | Module dashboards (Laravel unauthentica… | Module dashboard summary endpoints (admissions/students/library/hostel/transport) have no middleware and filter by body tenant | NAPI-04, FIN-13, STU-29 |
| LMS-AUDIT-006 | Critical | AI console — providers, models, policie… | Any authenticated user (incl. students) can write AI provider keys, policies and prompt templates | AI-D01, AI-04, BE-19 |
| LMS-AUDIT-009 | Critical | ~90 controllers / 378 routes with no au… | ~90-195 Laravel API controllers (~300-378 routes) and ~425 web routes have no authentication and take tenant/user from the request | BE-07, AUTH-05, ORPH-02 |
| LMS-AUDIT-010 | Critical | Menu / navigation backend (`/api/menu-r… | Unauthenticated POST /api/menu-rights builds SQL from raw request values | AUTH-01, HR-05 |
| LMS-AUDIT-011 | Critical | Fees / Online payment gateways | ICICI/ICICI-Orange/PayPhi/AggrePay payment callbacks are unauthenticated with no signature verification (forged success issues receipts) | FIN-01, BE-08 |
| LMS-AUDIT-012 | Critical | Document Templates | DocumentTemplateApiController decodes JWT without signature verification and returns student PII unauthenticated | HR-02, AUTH-06 |
| LMS-AUDIT-015 | Critical | Web-root PHP scripts / secrets in source | Standalone PHP scripts under public/ bypass Laravel (phpinfo, request-supplied DB host, hard-coded DB passwords, SQLi in excel_upload/*) | BE-06, INT-04 |
| LMS-AUDIT-026 | Critical | Migration modules (learning outcomes, i… | Tenant, user and academic year come from client-supplied request fields; | AI-D03 |
| LMS-AUDIT-027 | Critical | Fees / Mobile "GPay" self-reported paym… | `POST /fees/get_online_receipt` posts fee receipts based on client-supplied `amount`, `transactionid`, `bank_name`, `sub_institute_id`, `syear` and a student-b… | FIN-02 |
| LMS-AUDIT-045 | Critical | Result module / Laravel | Unauthenticated POST routes write result HTML per student and build SQL by string concatenation of request parameters (SQL injection). | ORPH-03 |
| LMS-AUDIT-048 | Critical | Tier B controllers (JWT valid + client-… | These controllers call `$this->jwtToken()->validate()` (signature/expiry only) and then use `sub_institute_id`, `user_id`, `syear` from the request. | BE-11 |
| LMS-AUDIT-062 | High | JWT design | JWTs never expire by default and cannot be revoked | BE-16, AUTH-07, STU-45 |
| LMS-AUDIT-067 | High | Attendance (date handling) | Dates derived via toISOString().slice(0,10) shift by one day for IST users | STU-11, HR-27 |
| LMS-AUDIT-069 | High | SMS OTP login / visitor pickup OTP | Static/DOB SMS OTPs, backdoor mobile numbers and OTP returned in responses | INT-19, BE-15 |
| LMS-AUDIT-072 | High | Fees online payment | `student_id` and the amount (`pay_amount ?: | NAPI-09 |
| LMS-AUDIT-073 | High | Online exam scoring | Grading trusts the client. | LMS-07 |
| LMS-AUDIT-074 | High | Online exam windows / attempts / time l… | (1) Backend returns `active_exam` as the strings `"yes"/"no"`; | LMS-08 |
| LMS-AUDIT-076 | High | LMS Exam page - student "Online Exam" t… | The component renders a free-text `<textarea>` for every question (including MCQ/True-False) and posts only `answer_narrative[<id>]`. | LMS-10 |
| LMS-AUDIT-077 | High | Result - marks entry & approval | (1) `points`, `per`, `grade` are client-computed and stored verbatim; | LMS-11 |
| LMS-AUDIT-078 | High | Result - New report card "Print mobile" | The screen hard-codes three attendance/percentage fields to `'0'` and the backend applies those request-level values to **every** selected student via `DB::tab… | LMS-12 |
| LMS-AUDIT-079 | High | Result - classwise grade report / rank | When `type == 'API'` (which every Next.js call is) `getRank` reads `syear` and `sub_institute_id` from `$_REQUEST` and **overwrites `$term_id` with the constan… | LMS-13 |
| LMS-AUDIT-085 | High | Learning Outcome (migration-modules API) | `guard()` verifies only that a JWT is valid, then trusts `sub_institute_id`, `user_id`, `syear` from the body. | LMS-20 |
| LMS-AUDIT-086 | High | Course Master content (links) | The `link` field is stored as `url`/`filename` after only `nullable\\|string\\|max:2048`; | LMS-21 |
| LMS-AUDIT-088 | High | ESO write endpoints (diagnostic submit,… | Correctness is server-resolved (good) but everything around it is trusted: | AI-A04 |
| LMS-AUDIT-090 | High | PAL Test scoring (`/lms/pal` store) and… | The score is what the client says: | AI-A06 |
| LMS-AUDIT-091 | High | Pedagogy Engine, Framework/ULU views, `… | The whole chain that feeds the Pedagogy Engine, Framework and ULU screens has no authentication and no tenant scoping. | AI-B01 |
| LMS-AUDIT-095 | High | Enterprise Brain — decisions, execution… | The governance permissions `decision.approve`, `eso.execute` and `evidence.curate` are defined and granted to `manager` but are **used by no route**. | AI-C05 |
| LMS-AUDIT-097 | High | People & Competency LMS — Assignments (… | The shared `DataTable` identifies selected rows by `String(index)`. | AI-C07 |
| LMS-AUDIT-098 | High | Capability Intelligence — Command Cente… | "Active Assessments", "Assessment Completion", "Pending Reviews", "Open Assessments" and the "Assessment Calendar (Next 60 Days)" are constants (`0` / `cycle =… | AI-C08 |
| LMS-AUDIT-100 | High | Capability Intelligence — role-mapping… | Three implementations of "roles with a skill map" disagree. | AI-C10 |
| LMS-AUDIT-101 | High | Capability Intelligence — Competency Fr… | The "Category Weighting" and "Scoring Configuration" (scoring model weighted/simple, rounding, unmapped handling, target threshold, apply-to gap analysis / rol… | AI-C11 |
| LMS-AUDIT-103 | High | Decision recording / workflow start / B… | There is no state machine. | AI-D05 |
| LMS-AUDIT-104 | High | Workflow step approvals (Actions tab "W… | `approver_role` and `assigned_to` are stored on each approval and used to filter the *pending list*, but `resolveApproval` never enforces them. | AI-D06 |
| LMS-AUDIT-105 | High | AI read APIs (cases, signals, recommend… | Read endpoints filter by institute only. | AI-D07 |
| LMS-AUDIT-110 | High | Create -> Actions hand-off ("Content yo… | The UI promises that the teacher's reviewed/edited draft "will be attached when you approve" ("Use this attaches the content to the proposed intervention"), bu… | AI-D12 |
| LMS-AUDIT-113 | High | Fees / Collection | The Next.js page sends only aggregate `totalDis` and `totalFin`; | FIN-06 |
| LMS-AUDIT-114 | High | Fees / Online payment (Next.js flow) | (1) The Razorpay checkout options contain no `handler`, `callback_url` or `redirect`, so after a successful capture nothing in the Next app calls `razorpay_res… | FIN-07 |
| LMS-AUDIT-115 | High | Fees / receipts & idempotency | Receipt numbers are `MAX(existing)+1` read outside the write transaction, with no lock and (per migration `2023_03_05_115658_create_fees_receipt_table.php`) no… | FIN-08 |
| LMS-AUDIT-116 | High | Fees / Refund | The refund cap is "amount paid per head" and prior refunds are never subtracted; | FIN-09 |
| LMS-AUDIT-120 | High | Fees / server trusts client amounts and… | Amounts, dates and years come from the client with no server validation: | FIN-15 |
| LMS-AUDIT-128 | High | Inventory / stock | There is no stock ledger. | FIN-46 |
| LMS-AUDIT-129 | High | Inventory / approval chain (requisition… | (a) No maker-checker: | FIN-48 |
| LMS-AUDIT-131 | High | Hostel / Room allocation | The JSON body carries the actor in `user_id` but the allocation form overwrites it with the allocatee's id; | FIN-53 |
| LMS-AUDIT-132 | High | Hostel / capacity and double booking | Uniqueness only per (user, group, year, tenant); | FIN-54 |
| LMS-AUDIT-133 | High | Library / issue and availability | Issue validates only `student_id exists:tblstudent,id` (global) and dates; | FIN-59 |
| LMS-AUDIT-135 | High | Library / fines | No fine, penalty, late fee or lost/damage recovery exists; | FIN-61 |
| LMS-AUDIT-139 | High | Utility / Year rollover and student pro… | `from_current_syear`, `to_next_syear`, `to_academic_section`, `to_standard`, `to_division`, `students[]` / `stud_ids[]` are concatenated into `INSERT ... | FIN-69 |
| LMS-AUDIT-141 | High | Utility / Breakoff rollover - fee dupli… | `if($request->has('tables')=='fees_breackoff' && $request->has('tables')=='advance_fees')` compares a bool to strings, so the advance-fee block runs whenever `… | FIN-71 |
| LMS-AUDIT-142 | High | Utility / Rollover and promotion - dupl… | Duplicate check covers only the same target class; | FIN-72 |
| LMS-AUDIT-143 | High | Utility / Inter-institute student trans… | `to_sub_institute_id` never checked to belong to the same client; | FIN-73 |
| LMS-AUDIT-144 | High | Utility / Update-all-data (bulk deactiv… | Mass deactivation end-dates every active enrolment of the tenant for a client-supplied `syear`, without dry-run/transaction/audit, and always reports success (… | FIN-74 |
| LMS-AUDIT-147 | High | Inward/Outward masters and registers -… | `deleteResource` sets `_method=DELETE` then calls `mutateForm(path,'PUT',form)` whose `if (method === 'PUT') form.set('_method','PUT')` overwrites it, so the r… | FIN-78 |
| LMS-AUDIT-148 | High | Inward/Outward numbering and add | Next number is computed with `CAST(inward_number AS INT)` (invalid MySQL) and handed to Blade via `view()->share`, so the JSON never contains it; | FIN-79 |
| LMS-AUDIT-150 | High | Utility / Custom module - IDOR, rights… | Lookups by `find($id)` without tenant (edit reassigns `sub_institute_id` to the caller); | FIN-81 |
| LMS-AUDIT-151 | High | Bazar bulk upload | Data written to `sharebazar_position/_margin/_pnl` carries no `sub_institute_id` or uploader; | FIN-82 |
| LMS-AUDIT-153 | High | Attendance | Server-side validation that exists in `showStudent` (academic-year window, holiday, Sunday) is absent from `save`. | STU-10 |
| LMS-AUDIT-154 | High | Attendance | The dashboard maps any code that is not `P` (including empty/unmarked) to `absent`, and Save submits every row. | STU-12 |
| LMS-AUDIT-157 | High | Student create / login | (a) No email uniqueness check although login is by email and `first()` picks the first matching student (legacy `ajax_checkEmailExist` exists but the new API d… | STU-16 |
| LMS-AUDIT-160 | High | Proxy / substitution teacher | `update` and `destroy` operate by `id` only (`proxyModel::where(["id" => $id])->update/delete()`), a cross-tenant IDOR (STU-06 pattern). | STU-21 |
| LMS-AUDIT-162 | High | Circulars | `destroy` hard-deletes `circular` by `Id` only (no tenant); | STU-35 |
| LMS-AUDIT-163 | High | HRIT Leave | (1) No balance check on apply; | HR-10 |
| LMS-AUDIT-164 | High | HRIT Attendance | The employee whose attendance is written comes from `employee` in the body; | HR-11 |
| LMS-AUDIT-165 | High | HRIT Payroll (monthly) | The server computes the payslip lines but stores whatever the client posts: | HR-12 |
| LMS-AUDIT-166 | High | HRIT Payroll (attendance to payroll) | Paid days are wrong in several documented ways: | HR-13 |
| LMS-AUDIT-167 | High | Payroll, Leave, Import (frontend/backen… | (1) `deletePayrollType` POSTs to `/payroll-type/destroy/{id}`; | HR-14 |
| LMS-AUDIT-173 | High | Laravel LMS/PAL/platform APIs (lms.auth… | 18 routes the frontend calls (GET /api/permissions, content upload/authoring, coherence-map read/write, platform registry/notifications/scheduler/workflow) are… | ORPH-04 |
| LMS-AUDIT-175 | High | G2G Assessments / Learning dashboard, T… | 35 frontend endpoints have no matching Laravel route: | ORPH-11 |
| LMS-AUDIT-176 | High | Push notifications / Firebase | Three legacy FCM **server keys are hard-coded** (`AAAA***:APA91b…`) with tenant ids 254/48 hard-coded to pick one; | BE-09 |
| LMS-AUDIT-178 | High | MCP tools / AI ask (prompt-injection tr… | `required_permission` (e.g. | BE-20 |
| LMS-AUDIT-179 | High | Migrations / reproducible schema | The migration set cannot rebuild a database and does not describe the live one. | DB-01 |
| LMS-AUDIT-181 | High | Connection configuration / data integri… | Laravel's non-strict mode removes `STRICT_TRANS_TABLES`, so MySQL truncates over-long strings, rounds `decimal(10,0)`, turns non-numeric text inserted into int… | DB-03 |
| LMS-AUDIT-182 | High | Missing unique constraints | Business rules that require uniqueness are enforced only in controllers: | DB-05 |
| LMS-AUDIT-183 | High | Production migration safety | The only safeguard is a regex on the raw argv: | DB-09 |
| LMS-AUDIT-184 | High | DB triggers writing to an uncreated tab… | AFTER INSERT/UPDATE/DELETE triggers on the hottest tables insert into `sync_log`, but no migration or SQL file anywhere in the repo creates `sync_log` (`grep C… | DB-10 |
| LMS-AUDIT-185 | High | Test database isolation | `php artisan test` runs against whatever database `.env` points to (per memory the shared remote `vivek_erp`); | DB-11 |
| LMS-AUDIT-192 | High | Generic import engine (extends HR-15) | Beyond HR-15 (client column names, public file retention): | INT-12 |
| LMS-AUDIT-193 | High | Fees reconciliation upload | (1) The reconciled amount is doubled: | INT-13 |
| LMS-AUDIT-196 | High | ICICI Orange payment gateway | Orange payment initiation posts to the **UAT** host `https://pgpayuat.icicibank.com/tsp/pg/api/v2/initiateSale` (the production URL is commented out with the n… | INT-16 |
| LMS-AUDIT-197 | High | Payment confirmation / reconciliation | There is no inbound webhook route for any gateway (grep for `webhook\\|X-Razorpay-Signature\\|hash_equals` finds none in payment code) and nothing scheduled: | INT-17 |
| LMS-AUDIT-199 | High | Anonymous notification triggers | (1) `GET /Resend_otp?mobile=<any>` sends an SMS through **tenant 1's** gateway to any number, unauthenticated, unthrottled, and does not even store the OTP it… | INT-20 |
| LMS-AUDIT-200 | High | Console commands (destructive seeding) | The class docblock promises it "writes only to a dedicated sub_institute_id, never to one holding real records", and `guardTenant()` refuses non-synthetic tena… | INT-21 |
| LMS-AUDIT-203 | Medium | All modules (Result, Fees, HRIT, Capabi… | JWT duplicated in URLs/query strings/bodies (log, history, referrer leakage) | ORPH-08, LMS-31, HR-26, FIN-19 |
| LMS-AUDIT-204 | Medium | Frontend route protection | Frontend route/role gating is client-side, localStorage-driven and cosmetic (substring role matches) | AUTH-16, LMS-26, AI-C28 |
| LMS-AUDIT-206 | Medium | Agents store, conversational-AI admin s… | Agents/conversational-AI persisted in local JSON files (races, multi-instance loss, ephemeral FS) | INFRA-16, AI-09, NAPI-16 |
| LMS-AUDIT-216 | Medium | Error handling / debug output | Exception messages, SQL text and debug output returned to clients | BE-23, LMS-36 |
| LMS-AUDIT-217 | Medium | Password reset | Forgot/reset password leaks registered e-mails and reset-token weaknesses | BE-28, AUTH-15 |
| LMS-AUDIT-220 | Medium | Session behaviour (idle timeout, daily… | The 30-minute idle timer is per tab and, when it fires, removes `auth`, `menuContext`, `userData` from the **shared** localStorage; | AUTH-19 |
| LMS-AUDIT-222 | Medium | Audit / User log | Access logging (`access_log_route` insert via `Accesslog`) is wrapped in `if ($request->get('type') != "API" && $request->get('type') != "JSON")`. | AUTH-21 |
| LMS-AUDIT-234 | Medium | Code structure | 76 source files exceed 1,000 lines and 286 exceed 500; | INFRA-21 |
| LMS-AUDIT-236 | Medium | H5P attempts / scoring | All grading is client-side over data that includes the correct answers. | LMS-22 |
| LMS-AUDIT-237 | Medium | Result - grade / rank / pass rules | (1) Percentage is rounded to an integer **before** matching breakoffs (34.5 -> 35 = pass grade) while the failed-subject count uses the raw ratio (`< 35`), so… | LMS-23 |
| LMS-AUDIT-238 | Medium | Exam - AI question paper generator | (a) `saveAiPaper` posts `ai_generated`, `difficulty_distribution`, `taxonomy_distribution`, `sections_config`, but `store()` persists none of them - sections a… | LMS-24 |
| LMS-AUDIT-239 | Medium | Exam Evaluation publish | `obtain_marks => (int) round($obtained)` drops fractional marks (0.5-mark schemes); | LMS-25 |
| LMS-AUDIT-240 | Medium | Duplicate modules | Parallel implementations with different behaviour: | LMS-28 |
| LMS-AUDIT-241 | Medium | Quiz, Subjects, Learning Outcome, LMS M… | `handlePublish` sets a 1.5 s timeout then navigates - the quiz is never saved (false success). | LMS-29 |
| LMS-AUDIT-243 | Medium | H5P AI scenario | Public route (no middleware), calls `https://openrouter.ai/...` with `'verify' => false` (TLS verification disabled) and `env('OPENROUTER_API_KEY')` (returns n… | LMS-37 |
| LMS-AUDIT-246 | Medium | Auth/session for AI clients | Five separate copies read the bearer token and role from `localStorage.userData/menuContext`; | AI-08 |
| LMS-AUDIT-247 | Medium | Agent catalogue integrity | (a) The RBAC keys `agents.g2g` and `agents.hrit` are derived by the frontend but are not registered in Laravel `config/rbac_modules.php` (39 `agents.*` keys re… | AI-10 |
| LMS-AUDIT-248 | Medium | Module AI ledger (AI Stack activity) | The "execution ledger" rows (`ai_audit_logs` event `module.<module>.<operation>`) are written by the browser: | AI-12 |
| LMS-AUDIT-250 | Medium | Concept diagnostic ("adaptive") answers | The option must belong to the submitted `question_id` (good) but the question is not checked against the concept/chapter/tenant or against what was served, and… | AI-A09 |
| LMS-AUDIT-251 | Medium | ESO diagnostic / CFU / retrieval scorin… | Only submitted answers are scored; | AI-A10 |
| LMS-AUDIT-252 | Medium | ESO chapter dashboard / empty content | With no ESO-ready concept (every tenant except the one whose nodes were loaded) `chapterDashboard` returns `current_concept_name = null`, `chapter_sections = [… | AI-A11 |
| LMS-AUDIT-253 | Medium | ESO pages loading/error handling | (1) `refresh()`/`load()` return early on a falsy `learnerId`/`conceptId` without clearing the initial `loading=true` -> permanent skeleton/spinner (e.g. | AI-A12 |
| LMS-AUDIT-254 | Medium | ESO dashboard status vocabulary | The engine emits `stale_mastery` (derived status for mastered-but-unverified concepts). | AI-A13 |
| LMS-AUDIT-255 | Medium | Mastery thresholds / formulas across en… | Six mastery definitions coexist with different scales and cuts: | AI-A15 |
| LMS-AUDIT-256 | Medium | Legacy practice: spaced repetition, his… | (a) `updateConceptMastery` inserts a `lms_concept_mastery_log` row per answer; | AI-A16 |
| LMS-AUDIT-257 | Medium | Concept result scoping and difficulty r… | The result page recovers "this attempt" as the last `setSize` rows of `questionResults` (ordered by `id`) and states a recycled question "lands as the newest r… | AI-A17 |
| LMS-AUDIT-258 | Medium | Chapter diagnostic session handling / t… | The code and copy state answers are already persisted so the timer may auto-submit safely ("every answer is already persisted server-side"), and resume says "N… | AI-A18 |
| LMS-AUDIT-259 | Medium | LLM-backed endpoints callable by studen… | `POST /api/pal/eso/render` sends a client-supplied, unbounded `instruction` string and free `context` array to the LLM under a "Pal" system prompt (the design… | AI-A19 |
| LMS-AUDIT-262 | Medium | IRT calibration (`pal:derive-irt`) | Calibration reads every `lms_online_exam_answer` row (all exam types, all attempts) though the field is named `first_attempt_correct_rate`; | AI-A22 |
| LMS-AUDIT-264 | Medium | Administration (architecture settings) | (1) `mayWrite` only honours `$auth['user_profile_name']` for the `writer_profiles` list, but `pal_auth` does not contain that key (it has `user_profile_id`, `r… | AI-B06 |
| LMS-AUDIT-265 | Medium | Gamification - Challenge Mode scoring /… | Score is computed server-side, but its inputs are client assertions: | AI-B07 |
| LMS-AUDIT-266 | Medium | Gamification - Team challenges UI | The "New challenge" and "End early" controls are shown only when `isStaffView` is true, and `isStaffView` is computed from the DATA (`challenges.some(c => c.pe… | AI-B08 |
| LMS-AUDIT-268 | Medium | Gamification backend read paths | GET endpoints recompute and WRITE on every request: | AI-B10 |
| LMS-AUDIT-269 | Medium | Gamification - UI coverage of backend f… | The celebration/notification queue is written by the backend on every badge and personal best but never displayed or marked read (`unreadNotifications` is pars… | AI-B11 |
| LMS-AUDIT-270 | Medium | Coherence Map page (Neo4j dependency) | With the known Neo4j auth failure (memory: | AI-B12 |
| LMS-AUDIT-272 | Medium | Personalize Marks | The server performs no validation: | AI-B14 |
| LMS-AUDIT-274 | Medium | PAL Intelligence page (student view) | For a student session the page loads the student's own disengagement, failure and burnout risk scores and shows "Cohort rank: | AI-B19 |
| LMS-AUDIT-275 | Medium | Gamification teacher actions (team chal… | The teacher class-scope rule (`class_teacher`/`timetable`) is applied only when a `learner_id` is present. | AI-B26 |
| LMS-AUDIT-278 | Medium | Brain JWT bridge | (a) The accepted signing secrets include `config('app.key')` in addition to `JWT_SECRET` — anyone with APP_KEY can mint Brain tokens for any tenant/role. | AI-C15 |
| LMS-AUDIT-286 | Medium | Career Intelligence — matching occupati… | "Fit score %" is Σ importance of lexically matched O*NET knowledge elements ÷ Σ importance. | AI-C23 |
| LMS-AUDIT-287 | Medium | Career Intelligence — alignment | Alignment is computed only for one occupation (`17-1011.00` Architect) and CBSE; | AI-C24 |
| LMS-AUDIT-288 | Medium | Career Intelligence (staff view) / aspi… | (1) Viewing another student's evidence/recommendation is allowed only if session `is_admin` is 1 or 2 — a platform-level flag (project memory: | AI-C25 |
| LMS-AUDIT-290 | Medium | Command Center — certification complian… | Compliance % = certifications with stored `status='valid'` ÷ non-revoked; | AI-C27 |
| LMS-AUDIT-291 | Medium | Capability / Competency / Career (cross… | "Capability/competency" exists in four incompatible stores and UIs (`hpbrain_capabilities`, `s_users_skills`, `competency`, `s_competency_*`); | AI-C29 |
| LMS-AUDIT-292 | Medium | AI policies — toggles that are stored b… | (a) `require_disclosure`, `require_acknowledgement`, `ai_detection_required`, `plagiarism_check_required`, `detection_provider`, `detection_threshold` are save… | AI-D14 |
| LMS-AUDIT-295 | Medium | Platform Services — Notification / Sche… | Configuration is persisted but no runtime component consumes it. | AI-D17 |
| LMS-AUDIT-296 | Medium | Roadmap / capability status registries… | Statuses, phases and "consumption today" flags are typed constants that contradict each other and reality. | AI-D18 |
| LMS-AUDIT-298 | Medium | Generation inputs (prompt-injection sur… | (1) `variables` from the client are merged last (`… $this->pageVariables($context), $validated['variables'] ?? []`), so they override server-derived `entity_la… | AI-D22 |
| LMS-AUDIT-301 | Medium | Fees / Cancellation audit trail | Cancellation of "other fees" writes no `fees_cancel` row (`// DB::table('fees_cancel')->insert($feesCancelLog);` commented out at `:311`), nothing is written t… | FIN-20 |
| LMS-AUDIT-302 | Medium | Fees / rounding and currency handling | Money uses JS `Number` (floating) summed with `reduce` and no rounding; | FIN-21 |
| LMS-AUDIT-303 | Medium | Fees / Late fee | The query that fills `$getLateData` is commented out ("no migration found"), so `$config_late_fine` remains `0`; | FIN-22 |
| LMS-AUDIT-305 | Medium | Fees / dates | The default receipt date / "today" is the UTC date; | FIN-25 |
| LMS-AUDIT-307 | Medium | Fees / gateway callback idempotency | The "prevent second time success" guard is a read of `*_payment_status == 'PS'` followed by an unlocked update and `pay_fees`; | FIN-28 |
| LMS-AUDIT-308 | Medium | Fees / Teacher fee dues | Class scoping uses independent `whereIn(standard_id)` and `whereIn(section_id)`, i.e. | FIN-29 |
| LMS-AUDIT-312 | Medium | Inventory / Transportation / Hostel APIs | Tenant and user are validated against the token, but `syear` is taken from input for writes. | FIN-44 |
| LMS-AUDIT-313 | Medium | Inventory / Direct purchase | No uniqueness on (vendor, bill_no, challan_no); | FIN-47 |
| LMS-AUDIT-314 | Medium | Inventory / requisition creation and nu… | Omitting `items[]` sends the request to the generic workflow path that skips the own-user and active-item checks (`requisition_by` any integer); | FIN-49 |
| LMS-AUDIT-316 | Medium | Hostel / visitor pages and wrappers | Hostel visitor pages call the school gate-visitor APIs (visitor_master), not the hostel visitor tables that exist (`hostel_visitor_master`, `show_hostel_visito… | FIN-55 |
| LMS-AUDIT-317 | Medium | Transportation / student mapping and fa… | Fare (`amount`, `distance`) is computed in the browser and stored as sent (`nullable\\|numeric\\|min:0`); | FIN-56 |
| LMS-AUDIT-318 | Medium | Transportation / routes outside auth gr… | `api/get-bus-list`, `api/get-stop-list` (no tenant filter), `ajaxCheckRemainCapacity`, `DELETE map_student/bulk-delete` (no `session`/`check_permissions`) and… | FIN-58 |
| LMS-AUDIT-319 | Medium | Library / validation, counts, reports | `store()` has no validation (`no_of_items` unbounded loop; | FIN-62 |
| LMS-AUDIT-321 | Medium | Utility / year-end misc | `syear`/`to_next_syear` not validated against the tenant's `academic_year`; | FIN-83 |
| LMS-AUDIT-322 | Medium | Front desk / Gallery, calendar, timetab… | Gallery re-stores every attachment per std x div but keeps only the last file name (multi-photo albums lose photos, storage duplicated); | FIN-84 |
| LMS-AUDIT-323 | Medium | Implementation master / Petty cash | `saveData` copies every request key into the insert after setting tenant/year from session, so client keys override tenant/year and become column names; | FIN-85 |
| LMS-AUDIT-324 | Medium | Student create/edit (data integrity) | Legacy and bulk-update use `M/F/O`; | STU-18 |
| LMS-AUDIT-325 | Medium | Bulk student update | Whitelisted fields are updated without: | STU-19 |
| LMS-AUDIT-326 | Medium | Teacher transfer | Transfer is `UPDATE timetable SET teacher_id = new WHERE teacher_id = left ...` only. | STU-22 |
| LMS-AUDIT-327 | Medium | Class teacher master | `grade_id`, `standard_id`, `division_id`, `teacher_id` are only `integer`; | STU-23 |
| LMS-AUDIT-328 | Medium | Academic setup / student master data | Subjects, periods (and `period_details`), batches, division capacities, subject-standard maps, houses and quotas are hard-deleted with no dependency check (tim… | STU-24 |
| LMS-AUDIT-329 | Medium | Rollover / promotion | The rollover that mutates data is a GET (`student/rollover/create`), so it has no CSRF protection semantics, can be repeated by refresh/prefetch/retry, and is… | STU-25 |
| LMS-AUDIT-330 | Medium | Certificates | The duplicate-issue guard passes an array (`$student_ids = explode(',', ...)`) to `->where('a.student_id',$student_ids)`, so it does not match per student; | STU-26 |
| LMS-AUDIT-331 | Medium | Admissions workflow | Enquiry numbers are computed in the browser from the loaded roster (`max+1`) and trusted by the API; | STU-28 |
| LMS-AUDIT-332 | Medium | Student list (`/students/search_student… | (1) "Add New Student" modal is a static form: | STU-32 |
| LMS-AUDIT-333 | Medium | Attendance notifications | Notification is sent only on a new row when `date == date('Y-m-d')` (server timezone); | STU-36 |
| LMS-AUDIT-334 | Medium | Student requests | Approval/rejection updates `student_change_request` by `ID` only, with `DECIDED_BY` from the client `user_id`, no tenant filter, no state machine (Approved can… | STU-37 |
| LMS-AUDIT-335 | Medium | File uploads (student photo, parents' p… | Extension is taken from the client filename (`File::extension($originalname)` / `pathinfo`), files are written to public storage (`storeAs('public/student/'...… | STU-38 |
| LMS-AUDIT-337 | Medium | Attendance UI consistency | Two competing attendance-marking screens; | STU-41 |
| LMS-AUDIT-341 | Medium | Payroll statutory rules | Statutory rules are hardcoded: | HR-32 |
| LMS-AUDIT-343 | Medium | PAL intervention queue | GET/POST `/api/pal/intervention` and `/{id}`, `/{id}/close` have no backend; | ORPH-12 |
| LMS-AUDIT-345 | Medium | Laravel auth model | Six authentication mechanisms coexist (api.session, session, pal.auth, brain.auth, McpAuth, lms.auth soft) plus in-controller JWT validation and no auth at all; | ORPH-15 |
| LMS-AUDIT-351 | Medium | Jobs, events, scheduler | With the default `sync` driver the four AI-grading jobs run inside the HTTP request (60–600 s); | BE-26 |
| LMS-AUDIT-353 | Medium | Login ambiguity on duplicate e-mails | `loginModel::where(['email'=>$email,'status'=>'1'])->first()` (no `ORDER BY`) picks one row; | BE-29 |
| LMS-AUDIT-355 | Medium | Fees / money data types | Fee amounts are `decimal(10,0)` (no paise) in 69 money columns (82 scale-0 decimals in all), `varchar(150)` in the online-payment ledger, `integer` in 24 other… | DB-04 |
| LMS-AUDIT-358 | Medium | Code vs migration drift | ~43 tables (and 18 models) are used by application code but created by no migration; | DB-12 |
| LMS-AUDIT-359 | Medium | Model layer | The model layer is a partial, inconsistent view of the schema: | DB-13 |
| LMS-AUDIT-362 | Medium | Data seeding inside schema migrations | Menu structure, role rights, workflow definitions and AI templates are deployed as migrations that write into live shared tables. | DB-18 |
| LMS-AUDIT-364 | Medium | WhatsApp inbound webhooks & delivery st… | Meta's webhook endpoints are public, unsigned and stubbed: | INT-22 |
| LMS-AUDIT-365 | Medium | Notification delivery mechanics | All sending is synchronous in the HTTP request. | INT-23 |
| LMS-AUDIT-366 | Medium | Bulk-send cost controls, consent and te… | HR-21 covers who can send. | INT-24 |
| LMS-AUDIT-368 | Medium | Queue configuration (extends BE-26) | Beyond the `sync` default (BE-26): | INT-26 |
| LMS-AUDIT-369 | Medium | Scheduler and Kernel guard | Only Neo4j tasks are scheduled. | INT-27 |
| LMS-AUDIT-370 | Medium | Leave import | The employee lookup is `tbluserModel::where('first_name', <first word>)->orwhere('last_name', <second word>)->where('status',1)->first()` - the `OR` makes the… | INT-28 |
| LMS-AUDIT-371 | Medium | Bazar (share-market) uploads | `for ($i = 0; $i < $rowCount - 1; | INT-29 |
| LMS-AUDIT-375 | Medium | Dead / unwired integrations | Several integrations exist only as config or partial code: | INT-33 |
| LMS-AUDIT-386 | Low | Error and response format consistency,… | Seven different envelopes: | NAPI-17 |
| LMS-AUDIT-387 | Low | Duplicated proxy code | Each copy has drifted: | NAPI-18 |
| LMS-AUDIT-391 | Low | Repository layout | The working tree holds a second full checkout of another branch inside `.kilo/worktrees/` (registered in `git worktree list`), scanned by ESLint (INFRA-13) and… | INFRA-22 |
| LMS-AUDIT-396 | Low | Pedagogy modal mastery summary | The tile labelled "Not started" displays `summary.dueForReview` (`due_for_review = count($dueConceptIds)`); | AI-A14 |
| LMS-AUDIT-397 | Low | PAL Test submission robustness | No `DB::transaction`: | AI-A23 |
| LMS-AUDIT-400 | Low | Dead/duplicate code | Unreferenced DOK diagnostic panel and its `fetchDiagnosticAssessment/submitDiagnosticAssessment` client fns; | AI-A26 |
| LMS-AUDIT-404 | Low | GET requests with side effects / CSRF e… | State-changing GETs are prefetch/retry/replay-unsafe; | AI-A30 |
| LMS-AUDIT-407 | Low | Gamification - streak/time-on-task inte… | xAPI telemetry `timestamp` and `result.duration_seconds` are client-supplied and uncapped; | AI-B18 |
| LMS-AUDIT-408 | Low | PAL content/pedagogy/administration emp… | End-user screens print server-operator instructions (`php artisan pal:tag-content`, `pal:install-pedagogy-engine`, "Deploy the New PAL Administration module an… | AI-B20 |
| LMS-AUDIT-409 | Low | New PAL data clients and gamification h… | Four copy-pasted `callApi` implementations with subtle differences (query support, PUT, status texts); | AI-B21 |
| LMS-AUDIT-410 | Low | New PAL navigation | Three navigation sources disagree: | AI-B22 |
| LMS-AUDIT-414 | Low | Silent failure handling | Departments page returns `null` (blank) whenever department intelligence is loading or fails (`if (!deptIntelligence.data) return null;`) even though the roste… | AI-C30 |
| LMS-AUDIT-415 | Low | Brain health/attendance thresholds | The "-4 points" class threshold is hard-coded in the frontend and backend and ignores the tunable config keys; | AI-C31 |
| LMS-AUDIT-417 | Low | Brain outcomes / LMS activity stats | `measuredChange` is `before - after` (positive = reduction) labelled "Change"; | AI-C33 |
| LMS-AUDIT-422 | Low | Display calculations (confidence/covera… | Missing values render as 0 (`Number('')===0` → "0% — the AI is not sure", 0% coverage bar); | AI-D26 |
| LMS-AUDIT-424 | Low | Silent failures and misleading empty/"n… | Failures are shown as empty ("No runs recorded yet", no live counts, no progress) and the Consumers tab always renders "The Event Bus read API is not connected… | AI-D28 |
| LMS-AUDIT-425 | Low | Fees / month selection | Cashiers can untick earlier due months and collect a later month; | FIN-27 |
| LMS-AUDIT-433 | Low | General > Implementation management | The transaction deletes `implementation_master` rows for the whole tenant (`where sub_institute_id`), not the current `syear`, then inserts only the current ye… | HR-35 |
| LMS-AUDIT-434 | Low | Routing structure | 12 identical hyphen/underscore hostel page twins, misspelt duplicate module folders, exam/result twin screens and 80 pages with no reference. | ORPH-17 |
| LMS-AUDIT-436 | Low | Cross-module consistency | Same concept, many spellings: | ORPH-20 |
| LMS-AUDIT-439 | Low | Dead, duplicate and deprecated schema | Roughly 8 % of tables are unreferenced, several belong to unrelated products (stock-market), and wide entity tables carry duplicate concepts: | DB-16 |
| LMS-AUDIT-442 | Low | Legacy / one-off commands | One-off tenant migrations, test commands and duplicated sync code ship in production; | INT-37 |
| LMS-AUDIT-446 | Info | Secret and PII sweep result | Not a defect. Records the negative result so it is not repeated: | INFRA-26 |
| LMS-AUDIT-453 | Info | Transport layer | Three transports (same-origin relay, direct-to-Laravel cross-origin, per-module Next handlers) are mixed, sometimes within one module; | ORPH-21 |


## Business-logic and edge-case notes per area (verbatim, Input -> Validation -> Rule -> DB change -> Side effects -> Output)

### Part 04 - LMS / H5P / Exam / Result

## 6. Business-logic notes (Input -> Validation -> Rule -> DB change -> Side effect -> Output)

**6.1 Marks entry (scholastic).** Input: grid of `marks` per student, `per` and `grade` computed in the browser (`app/result/marks-entry/page.tsx:96-116`: `per = round2(marks/max*100)`, grade = first range containing `Math.round(per)` from `getGreadData` integer ranges). Validation: client-only (`isValidMark`: 0..min(max,500), or AB/N.A./EX). Rule (server `marks_entry_controller::store`): `points` containing a letter -> `AB/N.A./EX` stored as `points=0, per=0, is_absent=<code>` (any other text becomes "AB"); numeric -> stored verbatim with client `per`, `grade`; empty `points` -> **no write** (existing mark cannot be cleared) yet reports "Data Saved/Updated"; `$res` is overwritten per student so the response message reflects only the **last** student; exception per student is swallowed. `ResultLock::isLocked` blocks locked exams, **`result_exam_approve` is never consulted** so "approved" exams accept edits. DB: `result_marks` upsert by `(sub_institute_id, student_id, exam_id)`; unique constraint NOT VERIFIED (race -> duplicates). Side effect: FCM notification for client_id 4/11; `AuditLog`. Output: last-row message.
 Rule defects: no `points <= result_create_exam.points`; negative allowed server-side; `student_id` key from body not verified to belong to tenant/class; `exam_id` not verified to belong to tenant/standard/subject; teacher scoping absent (any teacher can write any class).

**6.2 Approve / unapprove marks.** `POST marks-entry/approve` toggles `result_exam_approve.status` for `(subject,standard,division,exam,term,tenant,'result_mark')`, records `created_by`. Any authenticated role may approve or unapprove. UI states "Teachers will no longer be able to edit" but nothing server-side enforces it (LMS-11 (LMS-AUDIT-077)).

**6.3 Grade / percentage / rank / pass-fail (backend).** `getGrade()` (`Helpers/Helper.php:2282`): `per = round(100*obt/total)` **before** matching descending breakoffs (74.5 -> 75; 34.5 -> 35) and returns `-` for `total==0`. `getRank()` (`classwiseGradeReportController.php:323`): sums `rm.points`/`rc.points` per student for exams with `report_card_status='Y'`; `percentage = SUM/SUM*100` (NULL when denominator 0); `failed = COUNT(points/rc.points*100 < passing_ratio)` with `passing_ratio = 33` for section ids 148/149 else `35`; absent/N.A./EX stored as 0 are counted as zero **and** as fails; rank = dense rank on the exact float percentage string (1,2,2,3), ties broken only by roll_no order for row order; **in API mode `term_id` is forced to 149** and `syear`/`sub_institute_id` are read from `$_REQUEST`. The controller calls `getRank` inside `foreach student` x `foreach exam title` (one full-class aggregate query per student per exam). "Average" row in the grand-total block sums `total_points` (it is a total of maxima, not an average). Thresholds elsewhere: frontend online-exam band 35/50/75, dashboard `AT_RISK_PERCENT = 40`, H5P `pass_percentage` per activity - four independent definitions of "pass".

**6.4 Online exam attempt (student).** Input: `answer_multiple[qid][] = "<answerId>##<correct_flag>"` (radio and checkbox both use this field), `answer_narrative[qid]`, `user_id`, `hid_session_quiz` (client start time). Rule (`get_calculate_marks`): a selected option is "right" if the **posted flag** equals 1; multi-answer question is right when every id in `answer_master.correct_answer=1` appears among ids the client flagged 1 (`array_diff(original, given)`), extra wrong selections are ignored and `$given_ans_arr` is never reset per question; any non-empty narrative is "right" and earns the question's `points`; marks = `SUM(points)` of right questions. DB: `lms_online_exam` + per-answer rows (`ans_status` 'right'/'wrong'); event `ExamSubmitted`. Not enforced: exam window (`open_date/close_date`), `attempt_allowed`, `time_allowed`, one attempt per session, ownership of `user_id`. Result percent on the UI = `obtain_marks / paper.total_marks`.

**6.5 Online exam list "open/closed".** Backend returns `active_exam` as the string `"yes"/"no"`; `app/exam/data/onlineExam.ts:191` does `Boolean(r.active_exam)` so **every** exam is treated as open and the Start button is enabled (`app/exam/online/page.tsx:157`).

**6.6 Practice / diagnostic submission (`/lms/submit-practice`).** Server-side `checkAnswer` is correct (compares posted answer ids to `answer_master.correct_answer=1`), then updates concept mastery + forgetting curve; but `student_id` comes from the request and the route has no middleware.

**6.7 LMS Exam page "Online Exam" tab.** `QuestionPaperView` (`app/lms/exam/page.tsx:738-770`) renders a textarea for every question and posts `answer_narrative[id]` only -> backend awards full `points` for any non-empty text, MCQs cannot be answered as MCQs.

**6.8 Homework lifecycle.** Assign (legacy `store`: unauthenticated; `submission_date` `nullable|string`, no date rule; attachment unrestricted) -> student submit (v2 `submit`: pinned to session student, files `pdf/jpg/png <= 10 MB`, status `Submitted`, AI job) -> staff review (`review-store`: status in `Under Review|Reviewed|Rejected`, per-question marks clamped to `[0,max_marks]`, `Reviewed` back-fills untouched questions with `COALESCE(ai_marks,0)`, `teacher_marks` = SUM(COALESCE(teacher, ai, 0))). No state-machine guard: `Reviewed -> Under Review -> Reviewed` allowed; resubmission blocked only while `Under Review|Reviewed`. No due-date enforcement on submit.

**6.9 Exam Evaluation (scanned sheets) publish.** `review` clamps marks to `[0,max]`, approve back-fills AI marks; `publish` replaces `lms_offline_exam` per `(paper,student,tenant,syear)`: `obtain_marks = (int) round(sum)` (fractional marks lost), `total_right` counts `marks>=max`, `total_wrong` counts **everything else including partial credit** while per-answer rows label partial as 'partial'. Unapproved sheets are silently skipped with a message. Whole flow is anonymous (LMS-05 (LMS-AUDIT-020)).

**6.10 AI question-paper generation (client-side).** Buckets per DOK and Bloom level (`aiPaper.ts`); `required = Math.round(total*pct/100)` per bucket (percentages 25x4 of 10 -> 3+3+3+3 = 12 > 10, later buckets starved silently while "availability" says OK); `marks = marksPerQuestion` **overrides** each question's `points`; `total_marks = count * marksPerQuestion`. Save posts `ai_generated`, distributions and `sections_config` but `ApiQuestionPaperController::store` persists none of them (fields list at lines 205-226) -> sections and distributions are lost; students are scored with `SUM(lms_question_master.points)` while the paper displays `total_marks` (two different maxima).

**6.11 Report card "Print mobile".** `handlePrintMobile` posts `html_<studentId>` (client DOM HTML) plus `total_working_day='0'`, `present_working_day='0'`, `student_percentage='0'` for **all selected students**; `save_result_html` runs `DB::table('result_reportcard_marks')->updateOrInsert(student, standard, term, syear)` with those three values for every student in the loop (LMS-12 (LMS-AUDIT-078)). HTML is stored in `result_html` and served to the mobile app.

**6.12 H5P attempt.** Question/answer payloads (including correctness) are sent to the browser; scoring, `percentage`, `passed`, retries and the MCQ "certificate" are computed and rendered client-side; the only outbound record is best-effort xAPI `{verb, success, response, duration}` to `/api/pal/h5p/xapi` (which updates BKT mastery/misconception when verb=`answered`). No score/attempt is persisted or read back (`content-type-list.tsx:85`). `scoreDragDropAttempt` guards `maxScore>=1`, other scorers guard `maxScore>0`; defaults differ (`pass_percentage ?? 100` in text-activity/drag-drop vs `|| 0` elsewhere).

**6.13 SQAA entry.** `mark` 0..4, per-document `availability in (yes,no,inprocess)`, file `mimes:pdf,xlsx,doc,docx` (no size), stored on public DigitalOcean space as `<docId>_<time>_<clientName>`; availability != yes deletes the stored file; transaction with rollback of uploaded files. Sound, but filename uses `getClientOriginalName()` unsanitised and objects are public-read.

**6.14 Course content upload.** Role gate = `strtoupper(request user_profile_name)` in `[TEACHER, LMS TEACHER, ADMIN, SUPER ADMIN]`; `link` any string <=2048 stored as `url`/`filename`, `file_type='link'`; non-presentation `filename` any file <=100 MB; on DB error the response echoes `debug_data => $content` and the exception message. Frontend renders `resolveViewableUrl()` which returns non-http candidates untouched -> used as `<iframe src>`/anchors.

---



### Part 05 - PAL / AI / Intelligence

_(section 6 not found in part05-pal-ai-intelligence.md)_


### Part 06 - Fees / Finance / Operations

## 6. Business-logic notes (Input -> Validation -> Rule -> DB change -> Side effect -> Output)

### 6.1 Regular fee collection (`fees_collect_controller::pay_fees`, `collect/[studentId]/page.tsx::saveCollection`)
* **Input**: per-head `fees_data[head]=amount`, `hid_fees_data` (ignored), `months[id]`, `total`, `totalDis`, `totalFin`, payment mode/bank fields, `receiptdate`, student identity fields (name, enrollment, father, roll, medium...), `send_sms`.
* **Client validation** (`saveCollection`, `:415-442`): at least one selected month with amount, per-particular amount <= due, mode/receipt date required, bank fields for non-cash. UI clamps amounts to `[0,due]` (`:394-409`) but `Discount`/`Fine` inputs only use `min="0"` HTML attribute (`:799-802`) and `readNumber` accepts negatives.
* **Server validation**: none (no `validate()`); only `if ($arr != 0)` (`fees_collect_controller.php:386-390`). Negative `fees_data` values pass and are inserted as-is (`:476-481` else-branch `insert_amount = fees_data`).
* **Rule**: per head, the amount is allocated across selected months in ascending order, capped at each month's *remaining* (`FeeBreakoffHeadWise`: `breakoff - sum(paid, is_deleted='N')`, `helper.php:1186-1205`); excess beyond total remaining is silently dropped (not an error). Discount is applied only from `discount_data[head]` or (`totalDis` **only if** `discount_data` is present, `:1006-1010`); fine only from `fine_data[head]` or `fees_data['fine']` (`:1081-1145`). `totalFin` is not read anywhere. Late fee auto-calculation is dead code (`:3018-3058`, `$config_late_fine` stays 0).
* **DB change**: `fees_collect` rows per (month, receipt-book) + `fees_paid_other` + one `fees_receipt` row inside `DB::transaction` (`:752-883`). `amount` decimal(10,0) per migration `2023_03_05_115658_create_fees_collect_table.php:35-37`; fine>0 forces `(int)` cast of amount (`:760-767`). Receipt number = `MAX(...)+1` computed **before** the transaction with no lock (`:633`, `gunrate_receipt_number` `:1151-1219`); `fees_receipt` has no unique key in its migration.
* **Side effects**: `AuditLog RECEIPT_GENERATED` + `PAYMENT_RECEIVED` (`:875,894`), receipt HTML built from raw `$_REQUEST` fields and stored in `fees_collect.fees_html` (`:1652-1820`), optional SMS. Client also fires `logFeesOperation('fee_collection', ...)` fire-and-forget (`[studentId]:537`).
* **Output**: JSON `{data: html, paper, css, receipt_id_html}`; page renders it with `dangerouslySetInnerHTML` and prints; on missing HTML it throws "saved, but receipt HTML not found" leaving the form re-submittable (`:556-561`).
* **Defects**: FIN-06 (LMS-AUDIT-113) (discount/fine silently ignored), FIN-08 (LMS-AUDIT-115) (duplicate receipt numbers / no idempotency), FIN-10 (LMS-AUDIT-117) (identity from client, XSS), FIN-15 (LMS-AUDIT-120) (negative/unbounded inputs), FIN-21 (LMS-AUDIT-302) (rounding), FIN-22 (LMS-AUDIT-303) (late fee), FIN-25 (LMS-AUDIT-305) (UTC date).

### 6.2 Fee cancellation (`feesCancelController::store`)
* Input: receipt tokens `no####studentId`, cancel type/remark per receipt (regular only), `sub_institute_id`, `syear`, `user_id` from client.
* Validation: only "at least one receipt". No reason required server-side; no check that period is open; no role check.
* Rule/DB: regular -> insert `fees_cancel` audit row then `UPDATE fees_collect SET is_deleted='Y', is_waved=<cancel type>` (`:308-341`; column repurposed); other fees -> `UPDATE fees_paid_other SET is_deleted='Y'` and **the `fees_cancel` insert is commented out** (`:288`). No transaction. `fees_receipt` untouched, no `AuditLog::record` call.
* Output: "Fees Deleted Successfully" always (even when nothing matched).
* Defects: FIN-04 (LMS-AUDIT-029), FIN-20 (LMS-AUDIT-301).

### 6.3 Refund (`feesRefundController::saveFeesRefund`)
* Input per-head `refund_amount[head]`. Rule: `refund <= paid_for_title` where paid = sum of non-deleted `fees_collect` head columns (`:337-366`) - **prior refunds are not subtracted**. Receipt no `syear/(MAX+1)` unlocked (`:463-468`). Inserts `fees_refund` + `AuditLog fee_refund`. UI never shows the refund receipt (`payload.str` ignored, `cancel-refund/page.tsx:774-778`) and does not clear amounts after success => a second click refunds again. Defect FIN-09 (LMS-AUDIT-116).

### 6.4 Online payment
* Razorpay (Next flow): preview (`get_fees`, any student id) -> `createRazorpayOrder` (client `pay_amount`, no dues check, no tenant check) -> `fees_payment(PR)` + `FeeAuditService::logOrderCreated`; browser opens Razorpay Checkout **without `handler`/`callback_url`** (`online-payment/[gateway]/page.tsx:61-70`); nothing calls `razorpay_response_handler` (signature-verifying) afterwards. The only other path is `razorpay_fetch_payment_status` (cron-style GET behind `session` middleware, `routes/web.php:541`; no scheduler entry found in `app/Console` -> **NOT VERIFIED** whether an external cron calls it). Where it does run it credits `fees_payment.amount/100` (server-recorded, good), but marks only `razorpay_dashboard_ps`, not `razorpay_payment_status`.
* Legacy gateways: ICICI/PayPhi/AggrePay callbacks trust unsigned POST/GET fields and credit `fees_payment.amount` (or POSTed `amount` for AggrePay/Axis); replay guard exists for hdfc/icici/payphi/razorpay ("prevent second time success", read-then-write, racy) but **not** for axis or aggre_pay. Defects: FIN-01 (LMS-AUDIT-011), FIN-02 (LMS-AUDIT-027), FIN-07 (LMS-AUDIT-114), FIN-12 (LMS-AUDIT-119), FIN-35 (LMS-AUDIT-311).

### 6.5 Receipt reprint
GET `/fees/receipt/reprint?student_id&receipt_id_html&sub_institute_id&syear&action` -> `AJAXController::ajax_PDF_FeesReceipt`: deletes **every** file in `storage/print_receipt_pdf/*`, loads stored HTML via raw-SQL `RECEIPT_ID_n = '<input>'` (no `is_deleted` filter, tenant from request), renders PDF to `storage/print_receipt_pdf/<studentId>_<YmdHis>.pdf`, returns `https://<HTTP_HOST>/storage/...`; logs `RECEIPT_REPRINTED`. Defects FIN-03 (LMS-AUDIT-028), FIN-17 (LMS-AUDIT-122).

### 6.6 Defaulter report
`showFeesDefaulter`: enrolled students (tenant from request) -> `getBk()` **per student** (N+1) -> per month `bk/paid/discount/remain`; totals via `'-'` key. `first_name/last_name` concatenated into raw SQL (`:91-97`). Excludes `status != 1` students. Amount rules delegated to `getBk`; report is only as correct as `getBk` (which is patched with tenant-specific branches, `fees_collect_controller.php:258-278`). Defects FIN-03 (LMS-AUDIT-028), FIN-05 (LMS-AUDIT-112), FIN-24 (LMS-AUDIT-304).

### 6.7 Operations flows (condensed from sub-audits A and B)

**Inventory requisition -> approval -> quotation -> PO -> negotiate -> receive -> issue**

| Step | Input | Validation | Rule | DB change | Side effect / Output |
|---|---|---|---|---|---|
| Requisition | `items[]`, number, requester | own-user unless admin, active-item allow-list, number == next (only when `items[]` present, FIN-49 (LMS-AUDIT-314)) | status 1 | `inventory_requisition_details` | none on stock |
| Approval | approvals[] | rights `requisition_approved.index`; no cap/status check (FIN-48 (LMS-AUDIT-129)) | `approved_qty`, status as sent | update approval columns | nothing reserved |
| Quotation | vendor, items | vendor/item in tenant | auto `approved_status=2` | insert | - |
| PO | vendor, items, price/discount/tax | numeric only; price not compared with quotation | totals recomputed | insert | not linked to requisition |
| Negotiate | po no., status | required only | status written to all lines | negotiate rows | re-editable after approval |
| Receive | po no., received qty | (route shadowed, FIN-45 (LMS-AUDIT-127)) | cumulative check, but row overwritten (FIN-50 (LMS-AUDIT-315)) | receipt row | no stock increment |
| Direct purchase | vendor, bill, items | required | amount recomputed | insert + `opening_stock += qty` | replayable (FIN-47 (LMS-AUDIT-313)) |
| Allocation / Return | requester, item, qty | approved requisition exists / cumulative return <= approved | none on stock | insert | no decrement / increment (FIN-46 (LMS-AUDIT-128)) |

**Hostel allotment**: grid row -> POST `hostel-setup/hostel-room-allocation` with `user_id` overwritten by the allocatee -> `context()` 403 (FIN-53 (LMS-AUDIT-131)); if it passed: only per-(user, group, syear, tenant) uniqueness, no capacity/bed/gender check (FIN-54 (LMS-AUDIT-132)) -> upsert `hostel_room_allocation` -> AuditLog -> message; no fee.

**Transport mapping**: selected grid rows (pickup/drop shift, vehicle, stop, distance, client-computed amount) -> ids exist in tenant, capacity on pickup vehicle only -> delete+insert per student -> `transport_map_student`; no fee/notification/audit (FIN-56 (LMS-AUDIT-317)).

**Library issue/return**: issue not in Next UI; legacy `books/issue` validates only student existence (FIN-59 (LMS-AUDIT-133)); quick return sets `return_date=now()` for the first open loan of `item_code`, no fine (FIN-61 (LMS-AUDIT-135)); return by id is an unscoped GET (FIN-60 (LMS-AUDIT-134)); lost/damaged via scan remarks flips `library_items.item_status` by bare `item_code` across tenants (FIN-60 (LMS-AUDIT-134)); copies count only grows (`no_of_items`), dashboard counts ignore soft-deleted books (FIN-62 (LMS-AUDIT-319)).

**Year rollover (`GET student/rollover/create?tables[]=...`)**: tables[] + client syear -> no server validation -> per table `INSERT..SELECT` next year if count==0, enrolment loop per active enrolment (skip if same-class row exists; silently skips unmapped `next_grade_id`), then the advance-fee block runs on every call (FIN-71 (LMS-AUDIT-141)) -> ~12 tables changed, no transaction/audit -> output status by an off-by-one counter (FIN-83 (LMS-AUDIT-321)).

**Breakoff delete** (`POST student_bulk_update {bk_month[]}`): archive to `fees_breackoff_logs` (section 0) then delete, no paid-fees check (FIN-71 (LMS-AUDIT-141)). **Student transfer**: FIN-73 (LMS-AUDIT-143). **Promotion (`transfer_student`)**: FIN-72 (LMS-AUDIT-142).

**Visitor / gate pass**: create (public, FIN-39 (LMS-AUDIT-030)) -> `visitor_master` + photo + welcome SMS; pickup: `getStudent` -> `sendOtpVisitor` (OTP stored on `tblstudent.otp`, echoed) -> `confirmOtp` inserts a pickup visit with immediate `out_time` (FIN-67 (LMS-AUDIT-137)); check-out only via Blade `update()`.

**Inward/outward numbering**: FE opens create -> BE computes max+1 in a Blade share (absent from JSON) -> FE submits empty number -> `store()` writes client value, no lock/unique (FIN-79 (LMS-AUDIT-148)). **Petty cash balance**: NOT VERIFIED (API controller only skimmed).

---



### Part 07 - Students / Admissions / Attendance

## 6. Business-logic notes (Input -> Validation -> Rule -> DB change -> Side effect -> Output)

### 6.1 Student create (Next: `/student/add_student`)
- Input: GR no. (auto), section/standard/division, names, DOB, mobile, email, gender (`Male|Female|Other`), blood group, quota, house, address.
- Validation: server (`StudentRegistrationApiController::store`): first_name/enrollment_no/gender required, `grade/standard/division` integer only (no existence, no tenant, no grade<->standard<->division consistency, no `std_div_map` membership, no capacity check), `dob` date only (no future/age bound), `mobile` 10 digits, `email` format only.
- Rule: GR no. unique per tenant (pre-check + DB unique index `tblstudent_sub_institute_enrollment_no_unique`; the migration silently skips the index when duplicates already exist, so live enforcement is `NOT VERIFIED`). Frontend retries up to 3 times on "GR No. already exists" with a fresh number (good).
- DB: `tblstudent` row (`password = md5(env('DEFAULT_STUDENT_PASSWORD','student'))`, `status=1`, `admission_year = syear`) + `tblstudent_enrollment` row in one transaction; then `GraphSync::flushRecord`.
- Gaps: duplicate email allowed (login is by email, STU-16 (LMS-AUDIT-157)); gender stored as `Male` while every legacy consumer expects `M/F/O` (STU-18 (LMS-AUDIT-324)); no photo, documents, parent contact, religion, category, transport; no audit log; user profile id `Student` looked up per tenant (null if tenant has none, then inserted as NULL).

### 6.2 Student edit (Next search_student drawer -> PUT get_adminStudentSearch/{id})
- One string `name` is re-split into first/middle/last (first token, last token, remainder = middle) and overwrites all three columns. `enrollment_no` is overwritten with `admission_no` (null-able, no uniqueness check -> DB error 500 or silent duplicate if index absent). `class_name`/`section_name` are resolved by NAME (`standard.name = ?`), first match wins; a class change updates enrollment for the current `syear` only and does not check capacity, fees, timetable or optional-subject consequences.

### 6.3 Student delete/withdraw
- Only the legacy Blade path exists: `tblstudentController::destroy` sets `tblstudent.status=0` (no tenant filter) and `tblstudent_enrollment.end_date=today` for the session `syear`, logs an AuditLog. Soft delete: good. No check for fee dues, attendance, exam marks, transport, library; earlier-year enrollments remain open (`end_date` null) so the student still appears in prior-year lists; no undo path in Next (no UI at all).

### 6.4 Student list/search
- Next loads ALL students of the tenant+year including inactive in one POST on mount (`search_student/page.tsx:79-92`, `including_inactive=Yes`), returns full `tblstudent.*` rows, then filters/sorts/paginates in the browser (`page.tsx:156-170`). Pagination footer uses `students.length` (unfiltered) not `filteredStudents.length` (`StudentProfilesTab.tsx:417`). Fields `attendance`, `docsMissing`, `vaccination`, `allergy`, `infirmary`, `lastActive` are read from keys the API never returns (always 0/blank), so those dashboard columns show fabricated zeros.

### 6.5 Admission workflow (enquiry -> registration -> confirmation -> student)
- Enquiry create (Next `/admissions/admission_enquiry`): POST `/api/admission_enquiry` (no auth). Server validates only `sub_institute_id`,`syear`; body is mass-assigned into `admissionEnquiryModel` (`id`, `sub_institute_id`, `created_by` are fillable). The Blade controller's duplicate guard (first+last+mobile), mobile regex, DOB bounds and server-side `enquiry_no` generation are all bypassed on this path. Next computes `enquiry_no` client-side as `max(roster)+1` (`admission_enquiry/page.tsx:813-825`) -> duplicates when two users add at once; `/admission-enquiry` sends `enquiry_no: ''` (STU-27 (LMS-AUDIT-161)/28).
- Registration: `PUT /api/admission_registration/{id}` updates enquiry columns (`where id AND sub_institute_id` from client) then updates/inserts `admission_registration` (`data = request->except(...)`, mass assignment into `admission_registration`).
- Confirmation: `POST /api/admission_student` `saveStudent`: requires a registration row, `admission_standard` resolves, `student_quota` non-empty; duplicate guard by `(sub_institute_id, admission_id)`; GR number = MAX+1 with a 20-try existence loop (not atomic; relies on the unique index); inserts `tblstudent` (no password set -> admitted students cannot log in until credentials are provisioned elsewhere) and `tblstudent_enrollment` (`section_id = admission_division`, unvalidated). No status column transition on enquiry/registration is recorded; no fee-receipt/payment check; no age-eligibility check against `admissionAgeValidation`.
- Follow-up: `admissionFollowUpController::store` was hardened to session tenant but still mass-assigns `request->except(...)`, so `enquiry_id` can point at another tenant's enquiry; `index` reads any `enquiry_id`.
- Public unauthenticated forms exist only in Laravel Blade (`admission_enquiry` GET/`store` with `type=webForm`, `payment_proof`): no captcha, no throttle beyond global `throttle:1000,1` on `api` group (the `web` group has none), tenant chosen by URL, mass assignment, duplicate guard on name+mobile only (bypassable by any variation). Confirmation numbers/receipts are keyed by sequential integer ids (`enquiry_id` in `paymentProof`), i.e. IDOR.

### 6.6 Attendance marking
- Input: `date`, `standard_division`, `student[id]=P|A`, `teacher_id`, `user_profile_id`.
- Validation (`showStudent` only, not `save`): date inside `post_start_date..post_end_date` of the academic year, not a holiday (`calendar_events`), not Sunday. `saveStudentAttendance` re-checks none of these and does not check: code in {P,A}, student enrolled in that class/tenant, teacher is class teacher or timetable teacher for it, date not future, back-dating window, existing lock.
- Rule: upsert per student = SELECT then UPDATE/INSERT, 2 queries per student, no transaction, no unique key on `attendance_student(sub_institute_id, syear, student_id, attendance_date)` (migration has none) -> duplicate rows under double-click/concurrent teachers; `data[0]` is updated and other duplicates persist, so reports may read the wrong copy.
- Side effect: `sendNotificationAtt` runs only on a NEW row when `date == today` (server timezone); an "A" also queues an in-app notification; corrections (A->P) are silent; if the student or teacher is not found in the tenant it dereferences null after the row was already inserted (partial save + 500). `$request->attendance` P sends a push containing "is present ... Attendance Taken by ...".
- UI: dashboard default for unmarked students is ABSENT (STU-12 (LMS-AUDIT-154)); legacy page default is PRESENT (`student_attendance/page.tsx:656`); dashboard only lists sections from `class_teacher` for the logged-in user, so admins, subject teachers and proxy/substitute teachers cannot mark (STU-39 (LMS-AUDIT-336)). Date sent = `selectedDate.toISOString().slice(0,10)` (STU-11 (LMS-AUDIT-067)).

### 6.7 Proxy / substitution
- `ajax_getproxyperiod` lists timetable slots in a date range for the absent teacher and free teachers; `store` inserts `proxy_master` rows from client keys `date/timetable_id` -> takes class/period/subject from `timetable`, `proxy_teacher_id` from client. No re-check that the proxy teacher is still free, that the date's weekday equals the timetable weekday, that the slot is not already covered (no unique key), or that dates are not in the past. Proxy assignment is not consulted by attendance marking, class-teacher rights or the teacher dashboard.

### 6.8 Teacher transfer
- `UPDATE timetable SET teacher_id = new WHERE teacher_id = left AND tenant AND syear`. Moves only timetable rows. Not moved: `class_teacher`, `proxy_master.teacher_id/proxy_teacher_id`, homework/diary ownership, attendance `teacher_id`. No conflict check (new teacher already teaching that period), no history/audit, no undo.

### 6.9 Rollover / academic year
- `student/rollover/create` (GET!) copies academic_year (+365 days), batch, class_teacher, division_capacity, fees_* tables and optional subjects for `session.syear + 1`, guarded per table by "no rows exist for the target year" (a single stray row in a target table silently skips that table forever). Uses client-controlled `syear` (via hydrator) concatenated into SQL. `+365 days` shifts dates one day early after a leap year.

### 6.10 Certificates
- Preview/save build HTML from `template_master` per student; certificate number = `MAX(cast(certificate_number))+1` per (tenant, type[, syear]) with no lock -> duplicate numbers under concurrency; the "already issued" guard for Transfer Certificate passes an array to `where('a.student_id', $student_ids)` in `ajax_saveData` (`studentCertificateController.php:962`) so the guard does not work for the save path; keyed only by `syear`, so a TC is re-issuable next year.

### 6.11 Circulars / parent communication
- Circular store loops `standard x division` from client arrays (`allstd` = every standard x every division of the tenant, not the mapped pairs), one row per pair per attachment, and pushes notifications per student. Audience is not validated against the caller's tenant/classes. `destroy` hard-deletes by id only. Parent communication: `add_communicationAPI` inserts a message for any `student_id` (no ownership check); reply saving re-sends push/notification for every non-empty reply field submitted.

---



### Part 08 - HR / Org / Tasks / General

## 6. Business-logic notes

### 6.1 Leave apply -> approve -> balance
Input (`LeaveApplyDrawer`): leave type, full/half, from/to, slot, comment, optional employee. -> `POST /api/leave/requests`.
Validation (`LeaveRequestApiController.php:153-164`): type exists (any tenant), dates valid, `to>=from`, comment <=255. **Not validated**: leave type belongs to tenant, employee belongs to tenant (`exists:tbluser,id` unscoped), date overlap with existing leave, past dates, holiday/weekly-off, balance, probation.
Rule: `day_type` stored as `'1'`/`'0.5'`; days = `diffInDays+1` calendar days times day_type (`Helper.php:2834-2858` with `skipday=''`), so weekends and holidays count against balance. Balance = entitlement (allocation table, capped 180) minus (approved + pending + LWP bucket) (`LeaveAnalyticsService.php:28,100-127,170-215`); `remaining` can go negative because nothing checks it.
DB change: insert/upsert `hrms_emp_leaves` status `pending`; decision overwrites `status`, `approved_by` (a display name string), `hod_comment`, `hr_remarks`.
Side effects: none (no notification, no workflow escalation, no balance ledger).
Status transitions: any of approved/rejected/sent_back/cancelled/approved_lwp from any state (approved -> rejected -> approved). `pending` is not accepted, which breaks the drawer's "Save remark" button (HR-14 (LMS-AUDIT-167)).
Output: list/dashboard filtered to requests fully inside the leave year (`from>=start AND to<=end`, `LeaveAnalyticsService.php:109-110`), so a request that spans year end is invisible in every list and report.

### 6.2 Attendance -> payroll linkage
`GET /getTotalDays` (also called internally by `monthlyPayrollCreate`): counts a day present if any `hrms_attendances` row exists (no minimum hours, no punch-out requirement) on non-Sundays; adds approved **and pending** leave days; treats Sunday as the only weekly off (ignores `hrms_weekdays` configured in Leave settings and per-employee rosters used by the attendance API); holidays counted only when `FIND_IN_SET(department_id, department)` matches, so institute-wide holidays (stored with `department=''`, `HolidayApiController.php:331`) are ignored; holidays spanning a month edge are dropped (`whereBetween` on both dates); leave query has no `deleted_at` filter so withdrawn requests still pay (`PayrollController.php:2449-2457`); sandwich rule and Saturday-late deduction are heuristic (`:2598-2659`); result forced to 0 if no attendance, leave or LWP.

### 6.3 Monthly payroll compute and save
`getEmpMonthlyData` (server) prorates each component by `daysInMonth`, applies PF/PT/ESIC using **payroll type names** ("BASIC","GRADE PAY","D.A","HRA","OTHER ALLOW","PF","PT","ESIC"), a hardcoded `Feb -> PT = 300` for `payroll_type id == 2`, PF cap 1800 when base < 15000, `Helpers::getPT/getESIC` slabs. The UI can override `totalDay` and re-ask the server (good), but on save `monthlyPayrollStore` writes the client's `total_deduction`, `total_payment`, `payrollHead` verbatim (`PayrollController.php:2197-2220`) with no recompute. Insert-only (no update), so a wrong row must be deleted to redo; delete route is broken (HR-14 (LMS-AUDIT-167)) and unscoped by tenant.

### 6.4 Recruitment screening
Form -> `POST /job-applications` (multipart resume, pdf/doc/docx 5MB) -> browser then calls Next `/api/screenCandidate` with name, email, mobile, location, experience, education, skills -> LLM (DeepSeek/OpenRouter/Gemini per env) -> browser computes `overall_fit_score = competency_match`, `ranking_score = round(0.95*competency_match)`, fabricates a `reasoning` sentence, and `POST /talent-screening-results` stores what the browser sent. Behavioural traits and competency levels sent to the model are hardcoded constants (`candidate-application-form.tsx:150-157`). Failure path stores nothing (silent).

### 6.5 Task assign/approve
`POST /task` (legacy, unauthenticated) mass-inserts into `task` for each assignee; `PATCH workspace/{id}/approval` requires status COMPLETED and only blocks the literal "Employee" profile; `deadline-extensions/{id}/decision` has no approver check so the requester can approve their own extension and the task due date is rewritten (`DeadlineExtensionController.php:110-160`).

### 6.6 Communication send
Select class -> `recipients` (validated against `SearchStudent`) -> `send` loops numbers, calls gateway URL built from stored `url+pram+mobile_var+mobile+text_var+urlencode(text)+last_var` via cURL with SSL verification disabled (`send_sms_parents_controller.php:131-141`), ignores the gateway response body, logs "sent" if cURL did not error. WhatsApp: hardcoded country code `91`, `usleep(300000)` per recipient inside the HTTP request, student ids not constrained to the selected class. No template approval, per-user quota, or rate limit (only global `throttle:1000,1`).

### 6.7 Import
`parse` stores file in `public/import/<tenant>_<syear>_<5 digits>.<ext>` (never deleted) and the rows JSON in `csv_data`; `match-fields` (frontend calls it with a different contract than the backend expects); `process` inserts row by row without a transaction, column names come from the client, only `tbluser`, `result_personalize_marks`, `fees_collect`, `tblstudent`, `result_marks` have logic (other tables return "Import completed" with 0 rows); `successCount = total - failed` even when skipped/no-op.

---



### Part 09 - Routes / APIs / Orphans

## 6. Business-logic notes (key flows relevant to this part)

**Sidebar/menu -> page (DB-driven navigation).** Input: login payload (`menu` rows from tblmenumaster: `link` = Laravel route name or path). Validation: `isValidNavigationLink` rejects `javascript:void(0)`/`#`. Rule: `mapApiLinkToRoute(link)` (app/data/routeMapper.ts:634-1160) applies 17 module-specific alias maps, then a late override map for `result/*`, then defaults to `"/" + link` unchanged. DB change: none. Side effect: none. Output: a URL passed to Next router; if the resulting path has no page.tsx the user lands on not-found.tsx. Consequence: correctness depends entirely on production `tblmenumaster.link` values matching frontend folder names; 36 route-name keys and 17 seeded links do not (data-links sections 2-3), and case-sensitive folders (Inventory, Transportation, Utility) are reached through explicit maps.

**Category tabs (module level-3 pages).** `app/modules/[moduleKey]/[categoryKey]` fetches categories from Laravel (`/api/modules/menu-categories`) and mounts a screen inline via `getModuleScreenRegistry` -> `GENERATED_MODULE_SCREENS` (517 lazily imported pages, keys lower-cased). A menu route absent from the registry is "not embeddable" and falls back to navigation. The registry is generated by scripts/generate-module-screens.mts and committed; nothing verifies it is in sync with app/ (676 pages vs 517 entries; 52 registry-reachable pages have no code reference).

**Generic proxy.** Browser -> `/api/proxy?path=<laravel path>&<query>` -> `fetch(API_BASE_URL/<path>)` with the caller's Authorization and Cookie -> JSON re-serialised; non-JSON replies wrapped as `{raw}`. Any Laravel route reachable this way inherits Laravel's own auth; the relay adds none and validates nothing.

**Legacy-envelope handling** (lib/erp-legacy.ts:legacyRequest): request `type=API` + tenant params; success test `status` not in ["0","2"]; error text from `errors[]`/`message`; 419 gets a CSRF hint. Other modules re-implement this per file (data-consistency section 7).



### Part 10 - Laravel authz / tenant

## 6. Business-logic notes (Input → Validation → Rule → DB change → Side effect → Output)

**6.1 Login (SPA)** — `POST /api/api-login {email,password[,type]}` → validator only checks presence/`email` shape → `tbluser` where `email` & `status='1'` `->first()` (no ORDER BY; students only tried if no staff row has that email) → `verifyAndUpgradePassword`: `Hash::check`; else legacy compare (`md5($pw)` for students, raw string for staff) and, on match, **re-hash and save** → payload `{id,sub_institute_id,is_admin,client_id,user_profile_id,is_student}` (+`iat/exp` only if `JWT_TTL_MINUTES>0`, unset by default) → `jwt->createToken` → response also returns rights menu ids, academic terms, subjects, school name, `host_name = env('APP_URL')`. No lockout, no captcha, no login audit.

**6.2 Token → session** — every `api.session` / `session(type=API)` request: `jwtToken()->validate()` → claims → `academic_year` (current term by `date()`), profile, `school_setup`, teacher class-scope arrays → in-memory session store → `request->merge(['type'=>'API'])` so legacy controllers return JSON. Cost: ≥6 DB queries per request before the controller runs.

**6.3 Online fee payment** — student pays at gateway → gateway redirects browser to `fees/<gw>/…ResponseHandler` (CSRF-exempt `fees/*`, no auth) → handler looks up `fees_payment` by `<gw>_order_id` supplied in the callback → sets `PS` if the callback says so → `pay_fees()` writes `fees_collect` rows and receipt → `receipt_view`. Verified per gateway: **Razorpay** verifies `verifyPaymentSignature` + `hash_equals(order_id)` ✔; **HDFC/CCAvenue** decrypts `encResp` with the school working key (authentic by construction, but tenant hard-coded `76` at l.321/920); **ICICI** trusts `Response_Code==E000` (l.1449–1499); **ICICI Orange** l.1750 "(Optional) Verify response secureHash … Omitted for brevity"; **Aggrepay** computes `valid_hash` (l.2226) but sets `PS` from `response_message` regardless; **PayPhi** trusts `responseCode==0000`. Order ids are `student_id . mt_rand(100000,10000000000)`.

**6.4 Leave decision** — `POST /api/leave/requests/{id}/decision {status}` → token tenant → row exists in tenant → `applyDecision` looks up approver name by request `user_id` → `hrms_emp_leaves.status/approved_by/updated_by` updated in a transaction. No check that the caller is HOD/HR, no self-approval check, no balance re-check, no notification.

**6.5 Exam evaluation publish** — anonymous `POST …/batches/{id}/publish {sub_institute_id,user_id}` → all `Approved` sheets → per student delete-then-insert `lms_offline_exam` (tenant-scoped) and delete-then-insert `lms_offline_exam_answer` (**not** tenant-scoped: `where question_paper_id, student_id`) → marks feed report cards.

**6.6 MCP / AI ask** — JWT → `McpAuth` role (`student|staff|admin` from token flags only) → `McpContextResolver` (institute allow-list from token, `X-MCP-Institute-Id`/`meta.institute_id` accepted only inside the allow-list or for `is_admin=2`; academic year validated against `academic_year`) → `ToolRegistry::execute` → tool `authorize()` (role only) → service query scoped by `$context->selectedInstituteId`; consequential tools return a preview + `confirmation_token` (bound to tool, user, institute, 10 min, single-use — but read-then-update, not atomic). Only `admissions.confirm` is confirmable; `admissions.updateEnquiry` writes immediately. Audit rows via `McpAuditService`/`AiAuditLogger` (user, institute, tool, status; `decided_by_name`,`user_name` are client-supplied).

**6.7 Forgot password** — `POST /forget-password {email}` (`exists:tbluser,email` ⇒ enumeration) → `Str::random(64)` stored plaintext in `password_resets` with no expiry check → mail; `POST /reset-password` → token+email lookup → `tbluserModel::where('email')->update(['password'=>plaintext])` for **every** user row with that email (all tenants) → token rows deleted.

**6.8 Handoff ticket** — `POST mobile/web-handoff` (`api.session`) mints a token stored as `sha256`; `GET …/claims?ticket=` burns it with a conditional `UPDATE … WHERE used_at IS NULL AND expires_at>=now()` and returns the identity payload. Sound.

---



### Part 12 - Uploads / Import-Export / Notifications / Jobs / Integrations

## 6. Business-logic notes

**Generic import (API)**: Input `csv_file`+`tablename` -> Validation `mimes:csv,xlsx` -> file moved to `public/import/<tenant>_<syear>_<rand>.<ext>` -> parsed fully in memory -> `csv_data` row (`csv_header`, JSON `csv_data`; no tenant) -> `match-fields` (`is_skip` 1 skip/2 overwrite stored on the row) -> `process` loops rows building `$prepareData[column]=value` from client-chosen columns -> per-table branch (`tbluser`, `result_personalize_marks`, `fees_collect`, `tblstudent`, `result_marks`; **any other `table_name` silently does nothing** but still returns success with `total_rows`) -> INSERT/UPDATE row by row, no transaction -> counts returned. Side effects: rows created in whichever tenant the mapped `sub_institute_id` column names (for `tblstudent`); files remain public.

**Fee reconciliation upload**: file -> for each row `SELECT` by `(reference_no, payer_opted_mode)` (global) -> insert `fees_reconciliation` with literal `'Null'` strings in `student_id/term_id/receipt_no/standard_id/paymode/bank_detail/amount/updated_at` -> match to `fees_collect`/`fees_paid_other` on `cheque_no` (tenant+syear) joining `tblstudent_enrollment` on `student_id` only (all years) -> `amount = amount + amount` (`:205`).

**NACH**: S1/S3 generate bank mandate sheets into the web root; S4 reads bank return files and posts fees (FIN-38 (LMS-AUDIT-125)).

**Notification send (SMS)**: Input class + `smsText` -> validation -> `sendSMS()` builds `url . pram . mobile_var . <mobile> . text_var . urlencode(text) . last_var` from the tenant row -> `curl` GET (verify off, no timeout) -> **response body and HTTP status never inspected**; only a transport-level cURL error marks failure -> `saveParentLog` writes `sent` -> summary. **Push**: `sendNotification()` inserts an `app_notification` row, then `send_FCM_Notification($tokens,...)` (one OAuth exchange, N sequential HTTP posts, results discarded).

**Scheduler**: only Neo4j outbox/reconcile/sweeps run; fee reminders, defaulter statements, WhatsApp delivery-status sync, birthdays and payment-status polling rely on humans or external cron hitting URLs.

**Payments**: initiate -> gateway -> browser return `*_response_handler` (public; FIN-01 (LMS-AUDIT-011)/BE-08 (LMS-AUDIT-011)) -> `pay_fees`; the only asynchronous recovery is `*_fetch_payment_status` called by the SPA or an operator (`reconciliation_status_api_controller`); no webhook, no scheduler.

---



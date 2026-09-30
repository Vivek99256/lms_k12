# 10 - PERFORMANCE AUDIT

> Repos in scope: `D:\lms_k12` (Next.js frontend) and `D:\next_lms_erp` (Laravel backend consumed by the frontend). Static analysis only: no code modified, no server contacted, no `.env` read. Issue IDs are the unified `LMS-AUDIT-###` IDs from [14_MASTER_ISSUE_REGISTER.md](14_MASTER_ISSUE_REGISTER.md); original per-agent IDs are shown alongside and defined in `AUDIT/parts/`.

## Summary

Performance was not profiled (no runtime). Findings are structural: unpaginated list endpoints (842 `->get()` vs 158 paginate/limit/take in api/HRMS/G2gLms; `/table_data` returns whole tables, BE-32), synchronous AI grading jobs (default `sync` queue driver, 60-600 s inside the HTTP request, BE-26), per-student heavy loops in fee list/defaulter queries (FIN-24), root layout forcing dynamic rendering (INFRA-24), 76 files over 1,000 lines, both `chart.js` and `recharts` shipped, and per-row request fan-out in PAL chapter rows (AI-A25). No bundle-size analysis was run (no build).

## Performance-related issues (110)

| ID | Severity | Module | Issue | Source IDs |
|---|---|---|---|---|
| LMS-AUDIT-007 | Critical | Integration management (Next route hand… | /api/integration-configs is an in-memory, cross-tenant, header-presence-authenticated mock store returning plaintext secrets | AI-D02, NAPI-07, HR-20 |
| LMS-AUDIT-008 | Critical | Generic table API, menu rights, LMS cou… | Anonymous /table_data and /lms_data dump any DB table (incl. tbluser plaintext passwords); frontend depends on it | BE-01, HR-01, ORPH-01 |
| LMS-AUDIT-011 | Critical | Fees / Online payment gateways | ICICI/ICICI-Orange/PayPhi/AggrePay payment callbacks are unauthenticated with no signature verification (forged success issues receipts) | FIN-01, BE-08 |
| LMS-AUDIT-012 | Critical | Document Templates | DocumentTemplateApiController decodes JWT without signature verification and returns student PII unauthenticated | HR-02, AUTH-06 |
| LMS-AUDIT-013 | Critical | Organization Management > Employee Dire… | Employee Directory API: authentication only, mass-assignment, returns tbluser (password/plain_password/otp) to any token incl. students | HR-03, AUTH-03 |
| LMS-AUDIT-017 | Critical | Exam / question paper (anonymous API) | Two unauthenticated endpoints build SQL by string interpolation of request input. | LMS-01 |
| LMS-AUDIT-022 | Critical | PAL Test result (`/lms/pal/{id}`), cons… | `online_exam_id` is read straight from the query string (`$online_exam_id = $request->get('online_exam_id')`) and concatenated into a raw `DB::select` string: | AI-A01 |
| LMS-AUDIT-025 | Critical | Enterprise Brain — AI Assistant search | The global search selects entire rows (`DB::table('tbluser')->...->limit(10)->get()`) and returns each one as `'record' => $record`. | AI-C02 |
| LMS-AUDIT-038 | Critical | Students (adminapi endpoints) | These controllers validate that the bearer JWT is signed, then take `sub_institute_id`, `syear`, `user_id`, and (for search) `user_profile_name` from the reque… | STU-05 |
| LMS-AUDIT-043 | Critical | Admin Services (complaint, consent, fro… | `authenticate()` only checks that the JWT is valid. | HR-07 |
| LMS-AUDIT-045 | Critical | Result module / Laravel | Unauthenticated POST routes write result HTML per student and build SQL by string concatenation of request parameters (SQL injection). | ORPH-03 |
| LMS-AUDIT-047 | Critical | Staff documents | `GET /download-folder` (web group, no auth) zips every file under `he_staff_document/` on the `digitalocean` disk and returns it. | BE-03 |
| LMS-AUDIT-048 | Critical | Tier B controllers (JWT valid + client-… | These controllers call `$this->jwtToken()->validate()` (signature/expiry only) and then use `sub_institute_id`, `user_id`, `syear` from the request. | BE-11 |
| LMS-AUDIT-049 | Critical | Sensitive data at rest (database facet;… | 66 sensitive columns are plain `varchar/text`; | DB-08 |
| LMS-AUDIT-053 | Critical | Legacy mobile API (apiController) / JWT… | An unauthenticated GET route mints and returns a validly signed JWT for a fixed payload (id 123, "keyur modi") with no credentials. | SP-05 |
| LMS-AUDIT-062 | High | JWT design | JWTs never expire by default and cannot be revoked | BE-16, AUTH-07, STU-45 |
| LMS-AUDIT-073 | High | Online exam scoring | Grading trusts the client. | LMS-07 |
| LMS-AUDIT-082 | High | H5P package export | Media references are free strings. | LMS-16 |
| LMS-AUDIT-085 | High | Learning Outcome (migration-modules API) | `guard()` verifies only that a JWT is valid, then trusts `sub_institute_id`, `user_id`, `syear` from the body. | LMS-20 |
| LMS-AUDIT-087 | High | PAL Test result / question paper | The paper is loaded with `questionpaperModel::find($questionpaper_id)` from the URL, and `question_arr` (full `lms_question_master` rows) plus `answer_arr` (ca… | AI-A03 |
| LMS-AUDIT-088 | High | ESO write endpoints (diagnostic submit,… | Correctness is server-resolved (good) but everything around it is trusted: | AI-A04 |
| LMS-AUDIT-089 | High | All PAL question payloads (ESO, chapter… | The correct option flag is delivered to the browser with the question, before it is answered, on every PAL surface, so it can be read in DevTools regardless of… | AI-A05 |
| LMS-AUDIT-090 | High | PAL Test scoring (`/lms/pal` store) and… | The score is what the client says: | AI-A06 |
| LMS-AUDIT-092 | High | Legacy Content Intelligence review queu… | Single transition executes `ContentMetadataService::transition()` (row loaded with `findOrFail($metadataId)` - no tenant filter - status saved, log written) an… | AI-B02 |
| LMS-AUDIT-093 | High | New content model authoring/review/appr… | The only authorization is "not a student" (`is_student`). | AI-B03 |
| LMS-AUDIT-095 | High | Enterprise Brain — decisions, execution… | The governance permissions `decision.approve`, `eso.execute` and `evidence.curate` are defined and granted to `manager` but are **used by no route**. | AI-C05 |
| LMS-AUDIT-096 | High | Career Explorer / Career Counselling ba… | 17 career GET routes are registered with **no auth middleware**. | AI-C06 |
| LMS-AUDIT-097 | High | People & Competency LMS — Assignments (… | The shared `DataTable` identifies selected rows by `String(index)`. | AI-C07 |
| LMS-AUDIT-098 | High | Capability Intelligence — Command Cente… | "Active Assessments", "Assessment Completion", "Pending Reviews", "Open Assessments" and the "Assessment Calendar (Next 60 Days)" are constants (`0` / `cycle =… | AI-C08 |
| LMS-AUDIT-099 | High | Capability Intelligence — Command Cente… | (1) "Create Skill"/"Create New" default kind `competency` POSTs `/api/competency/competencies` and "Launch Assessment" POSTs `/api/competency/assessments` — ne… | AI-C09 |
| LMS-AUDIT-102 | High | Capability / Competency management API | The only gate is "not student/parent". | AI-C12 |
| LMS-AUDIT-106 | High | Saved AI reports (`/ai-reports/[id]`):… | Any authenticated user of the institute can edit a saved report's HTML and send emails on its basis; | AI-D08 |
| LMS-AUDIT-114 | High | Fees / Online payment (Next.js flow) | (1) The Razorpay checkout options contain no `handler`, `callback_url` or `redirect`, so after a successful capture nothing in the Next app calls `razorpay_res… | FIN-07 |
| LMS-AUDIT-116 | High | Fees / Refund | The refund cap is "amount paid per head" and prior refunds are never subtracted; | FIN-09 |
| LMS-AUDIT-119 | High | Fees / Online fee lookup (IDOR) | Student fee/PII lookups accept any `student_id` (or mobile) with no check that the student belongs to the caller's tenant or to the caller. | FIN-12 |
| LMS-AUDIT-126 | High | Visitor list / type APIs | JWT is validated but `sub_institute_id` is taken from the body and never compared with the token payload. | FIN-40 |
| LMS-AUDIT-151 | High | Bazar bulk upload | Data written to `sharebazar_position/_margin/_pnl` carries no `sub_institute_id` or uploader; | FIN-82 |
| LMS-AUDIT-153 | High | Attendance | Server-side validation that exists in `showStudent` (academic-year window, holiday, Sunday) is absent from `save`. | STU-10 |
| LMS-AUDIT-154 | High | Attendance | The dashboard maps any code that is not `P` (including empty/unmarked) to `absent`, and Save submits every row. | STU-12 |
| LMS-AUDIT-159 | High | Student medical & discipline (PII) | Health records (vaccination, height/weight, remarks, uploaded health documents, infirmary cases) and discipline notes for an entire tenant are returned by a si… | STU-20 |
| LMS-AUDIT-160 | High | Proxy / substitution teacher | `update` and `destroy` operate by `id` only (`proxyModel::where(["id" => $id])->update/delete()`), a cross-tenant IDOR (STU-06 pattern). | STU-21 |
| LMS-AUDIT-179 | High | Migrations / reproducible schema | The migration set cannot rebuild a database and does not describe the live one. | DB-01 |
| LMS-AUDIT-183 | High | Production migration safety | The only safeguard is a regex on the raw argv: | DB-09 |
| LMS-AUDIT-184 | High | DB triggers writing to an uncreated tab… | AFTER INSERT/UPDATE/DELETE triggers on the hottest tables insert into `sync_log`, but no migration or SQL file anywhere in the repo creates `sync_log` (`grep C… | DB-10 |
| LMS-AUDIT-185 | High | Test database isolation | `php artisan test` runs against whatever database `.env` points to (per memory the shared remote `vivek_erp`); | DB-11 |
| LMS-AUDIT-187 | High | Payslips / offer letters / staff docume… | Payslip PDFs are stored on the public DigitalOcean bucket with ACL `public` at **`public/staff_document/emp_<employee_id>_payslip_<month>_<year>.pdf`** - a key… | INT-07 |
| LMS-AUDIT-189 | High | Audit log written to the public disk | Every logged write appends `{query, bindings, time}` (the full SQL with **all bound values**) to `storage/app/public/access_log/<tenant>/<Y-M>.json`, i.e. | INT-09 |
| LMS-AUDIT-191 | High | Upload validation / storage architectur… | New sinks not enumerated before: | INT-11 |
| LMS-AUDIT-192 | High | Generic import engine (extends HR-15) | Beyond HR-15 (client column names, public file retention): | INT-12 |
| LMS-AUDIT-206 | Medium | Agents store, conversational-AI admin s… | Agents/conversational-AI persisted in local JSON files (races, multi-instance loss, ephemeral FS) | INFRA-16, AI-09, NAPI-16 |
| LMS-AUDIT-209 | Medium | question-paper asset proxy | question-paper asset proxy fetches client-supplied URLs unauthenticated (origin allow-list only, open-redirect follow) | NAPI-11, LMS-33 |
| LMS-AUDIT-212 | Medium | Stale-client detection | Every deploy clears localStorage/sessionStorage and signs all users out | INFRA-15, AUTH-32 |
| LMS-AUDIT-215 | Medium | Generic migrated modules (`/reports/*`,… | Generic "migrated module" pages dump raw first-array API data / show feature names with no implementation | STU-33, AI-D19 |
| LMS-AUDIT-217 | Medium | Password reset | Forgot/reset password leaks registered e-mails and reset-token weaknesses | BE-28, AUTH-15 |
| LMS-AUDIT-219 | Medium | Menu rights identity and platform admins | (1) The menu request carries no `Authorization` header and the identity is whatever `menuContext`/`userData`/`sessionData`/`session` localStorage keys contain… | AUTH-18 |
| LMS-AUDIT-227 | Medium | Rate limiting, body size and timeouts (… | No Next-side rate limiting anywhere (`grep` finds none); | NAPI-15 |
| LMS-AUDIT-231 | Medium | Documentation (CLAUDE.md, README, AGENT… | `CLAUDE.md` is a copy of the design-system spec (`K-12 ERP Design System/readme.md`), not repo guidance. | INFRA-17 |
| LMS-AUDIT-241 | Medium | Quiz, Subjects, Learning Outcome, LMS M… | `handlePublish` sets a 1.5 s timeout then navigates - the quiz is never saved (false success). | LMS-29 |
| LMS-AUDIT-243 | Medium | H5P AI scenario | Public route (no middleware), calls `https://openrouter.ai/...` with `'verify' => false` (TLS verification disabled) and `env('OPENROUTER_API_KEY')` (returns n… | LMS-37 |
| LMS-AUDIT-256 | Medium | Legacy practice: spaced repetition, his… | (a) `updateConceptMastery` inserts a `lms_concept_mastery_log` row per answer; | AI-A16 |
| LMS-AUDIT-259 | Medium | LLM-backed endpoints callable by studen… | `POST /api/pal/eso/render` sends a client-supplied, unbounded `instruction` string and free `context` array to the LLM under a "Pal" system prompt (the design… | AI-A19 |
| LMS-AUDIT-262 | Medium | IRT calibration (`pal:derive-irt`) | Calibration reads every `lms_online_exam_answer` row (all exam types, all attempts) though the field is named `first_attempt_correct_rate`; | AI-A22 |
| LMS-AUDIT-266 | Medium | Gamification - Team challenges UI | The "New challenge" and "End early" controls are shown only when `isStaffView` is true, and `isStaffView` is computed from the DATA (`challenges.some(c => c.pe… | AI-B08 |
| LMS-AUDIT-268 | Medium | Gamification backend read paths | GET endpoints recompute and WRITE on every request: | AI-B10 |
| LMS-AUDIT-269 | Medium | Gamification - UI coverage of backend f… | The celebration/notification queue is written by the backend on every badge and personal best but never displayed or marked read (`unreadNotifications` is pars… | AI-B11 |
| LMS-AUDIT-270 | Medium | Coherence Map page (Neo4j dependency) | With the known Neo4j auth failure (memory: | AI-B12 |
| LMS-AUDIT-271 | Medium | Framework / ULU server-rendered pages | The server component builds a self-request URL from the incoming `x-forwarded-host`/`host`/`x-forwarded-proto` headers and fetches `${proto}://${host}/api/pal/… | AI-B13 |
| LMS-AUDIT-278 | Medium | Brain JWT bridge | (a) The accepted signing secrets include `config('app.key')` in addition to `JWT_SECRET` — anyone with APP_KEY can mint Brain tokens for any tenant/role. | AI-C15 |
| LMS-AUDIT-280 | Medium | Enterprise Brain — registry screens, AI… | These `hpbrain_*` tables are read by screens but written by **no application code** (grep of `D:\next_lms_erp\app`, excluding the registry/controller readers): | AI-C17 |
| LMS-AUDIT-285 | Medium | Competency Framework — Role Requirement… | If loading a role's requirements fails, the panel sets `rows=[]` and shows an error, but Save stays enabled (`disabled={saving \\|\\| loading}`). | AI-C22 |
| LMS-AUDIT-287 | Medium | Career Intelligence — alignment | Alignment is computed only for one occupation (`17-1011.00` Architect) and CBSE; | AI-C24 |
| LMS-AUDIT-288 | Medium | Career Intelligence (staff view) / aspi… | (1) Viewing another student's evidence/recommendation is allowed only if session `is_admin` is 1 or 2 — a platform-level flag (project memory: | AI-C25 |
| LMS-AUDIT-299 | Medium | AI cost and abuse limits | The only limit is 60 requests/minute per user across all AI calls; | AI-D23 |
| LMS-AUDIT-304 | Medium | Fees / list, defaulter, verification | For every matched student the server runs `FeeBreackoff`, `OtherBreackOff` and the heavy `getBk` (multiple queries) - no server-side pagination; | FIN-24 |
| LMS-AUDIT-306 | Medium | Exports (all fee/report pages using `li… | (Confirmed independently by sub-audit B, X-1: | FIN-26 |
| LMS-AUDIT-319 | Medium | Library / validation, counts, reports | `store()` has no validation (`no_of_items` unbounded loop; | FIN-62 |
| LMS-AUDIT-328 | Medium | Academic setup / student master data | Subjects, periods (and `period_details`), batches, division capacities, subject-standard maps, houses and quotas are hard-deleted with no dependency check (tim… | STU-24 |
| LMS-AUDIT-332 | Medium | Student list (`/students/search_student… | (1) "Add New Student" modal is a static form: | STU-32 |
| LMS-AUDIT-336 | Medium | Attendance UX scope / permissions model | The attendance dashboard lists only sections from `class_teacher` for the logged-in `user_id`. | STU-39 |
| LMS-AUDIT-339 | Medium | HRIT, Talent, General, Task | Screens present fabricated data as live. | HR-25 |
| LMS-AUDIT-343 | Medium | PAL intervention queue | GET/POST `/api/pal/intervention` and `/{id}`, `/{id}/close` have no backend; | ORPH-12 |
| LMS-AUDIT-346 | Medium | Session/identity handling across modules | Identity/tenant/year/role are read through 60 independent session readers (46 names) plus the shared buildSessionContext; | ORPH-16 |
| LMS-AUDIT-350 | Medium | Migrations, schema hygiene | 708 tables created by migrations; | BE-25 |
| LMS-AUDIT-351 | Medium | Jobs, events, scheduler | With the default `sync` driver the four AI-grading jobs run inside the HTTP request (60–600 s); | BE-26 |
| LMS-AUDIT-357 | Medium | Indexing | 274 of 532 tenant-column tables have no index containing the tenant column, 154 of 181 `syear` tables have none on the year, and hot tables are bare: | DB-07 |
| LMS-AUDIT-363 | Medium | JSON / blob storage | Payroll amounts, raw payment-gateway requests/responses, learner state and rendered receipt HTML are stored as opaque blobs; | DB-19 |
| LMS-AUDIT-364 | Medium | WhatsApp inbound webhooks & delivery st… | Meta's webhook endpoints are public, unsigned and stubbed: | INT-22 |
| LMS-AUDIT-365 | Medium | Notification delivery mechanics | All sending is synchronous in the HTTP request. | INT-23 |
| LMS-AUDIT-366 | Medium | Bulk-send cost controls, consent and te… | HR-21 covers who can send. | INT-24 |
| LMS-AUDIT-368 | Medium | Queue configuration (extends BE-26) | Beyond the `sync` default (BE-26): | INT-26 |
| LMS-AUDIT-369 | Medium | Scheduler and Kernel guard | Only Neo4j tasks are scheduled. | INT-27 |
| LMS-AUDIT-375 | Medium | Dead / unwired integrations | Several integrations exist only as config or partial code: | INT-33 |
| LMS-AUDIT-376 | Medium | Frontend third-party scripts / CSP | No Content-Security-Policy, X-Frame-Options/`frame-ancestors`, `Referrer-Policy`, `Permissions-Policy` or HSTS is set anywhere; | INT-34 |
| LMS-AUDIT-377 | Medium | Download endpoints without ownership ch… | `downloadFile` returns the storage URL for any homework id (`studentHomeworkModel::find($homeworkId)`, no tenant/student/teacher check); | INT-35 |
| LMS-AUDIT-380 | Low | Logging and placeholder handlers | console.log/console.debug dumps sessions, payloads and AI prompts in production browser console | INFRA-20, AUTH-31, FIN-32 |
| LMS-AUDIT-382 | Low | Login redirect | A logged-out user opening a deep link sees the login form at that URL, but after login the code unconditionally `router.replace('/dashboard')` after 1.1 s, dis… | AUTH-27 |
| LMS-AUDIT-390 | Low | Dependencies | Unused packages `geist`, `uuid`, `@tiptap/extension-image`; | INFRA-14 |
| LMS-AUDIT-392 | Low | Rendering config | The root layout forces every route to be dynamically rendered, defeating static optimisation and the full-route cache; | INFRA-24 |
| LMS-AUDIT-395 | Low | Assistant SSE proxy | The stream proxy correctly takes the upstream host from env (`AI_UPSTREAM_BASE_URL`/`NEXT_PUBLIC_AI_BASE_URL`), unlike other routes, but forwards the raw reque… | AI-16 |
| LMS-AUDIT-397 | Low | PAL Test submission robustness | No `DB::transaction`: | AI-A23 |
| LMS-AUDIT-399 | Low | `/pal` chapter rows and practice modal | Each expanded student chapter row fires 4 requests (`chapter-gate`, chapter mastery, chapter-concepts, adaptive concepts) — a 16-chapter subject = 64 concurren… | AI-A25 |
| LMS-AUDIT-405 | Low | PAL Report | (1) Start time is formatted with `DATE_FORMAT(l.start_time, '%d-%m-%Y %h:%i:%s')` - 12-hour clock with no AM/PM - and the client parses it as 24-hour, so after… | AI-B15 |
| LMS-AUDIT-411 | Low | Content model AI enrichment / authoring… | `media_url` is accepted as any string up to 2000 chars (no scheme allow-list), `body` is unbounded, `translate.language` is only `size:2` (not one of the 9 reg… | AI-B23 |
| LMS-AUDIT-417 | Low | Brain outcomes / LMS activity stats | `measuredChange` is `before - after` (positive = reduction) labelled "Change"; | AI-C33 |
| LMS-AUDIT-420 | Low | Brain / capability | `ingestion/run` accepts client `limit` (5000 sent by UI) with no ceiling; | AI-C36 |
| LMS-AUDIT-431 | Low | Shared components | Nine primitives exist twice with both variants in active use (button 381 vs 55 importers, select 32 vs 71, card 162 vs 22, input 210 vs 32, table 144 vs 17, dr… | HR-33 |
| LMS-AUDIT-437 | Low | Pagination | 842 `->get()` vs 158 paginate/limit/take in `api/`,`HRMS/`,`G2gLms/`; | BE-32 |
| LMS-AUDIT-439 | Low | Dead, duplicate and deprecated schema | Roughly 8 % of tables are unreferenced, several belong to unrelated products (stock-market), and wide entity tables carry duplicate concepts: | DB-16 |
| LMS-AUDIT-440 | Low | Runtime schema introspection and connec… | Code defends against drift by probing the schema at request time (each call is an `information_schema` query, uncached), and a connection named `information_sc… | DB-17 |
| LMS-AUDIT-451 | Info | Internal-roadmap visibility flag | Internal-only roadmap rows (event bus, "no approval trail" governance gap) are hidden by a build-time public env flag, not an access check; | AI-D31 |


## Per-area notes

### Part 03 - Infra, config, tests, docs

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



### Part 04 - LMS / H5P / Exam / Result

## 9. Second-pass results

Scope set: 345 `.ts/.tsx` files (excluding tests) across the scoped directories.

| Pattern | Hits | Files | Material hits |
|---|---:|---:|---|
| `TODO\|FIXME\|HACK\|XXX` | 1 | 1 | `app/course-master/data/chapters.ts:754` stale "TODO(backend): confirm the real store endpoint" while `PERSIST_ENABLED = true` at :818 and the endpoint is live (LMS-34 (LMS-AUDIT-242)). |
| `debugger` / `eval(` / `new Function` | 0 | 0 | clean. |
| `console.log/warn/error/debug` | 27 | 8 | `app/course-master/lesson-plan/[courseId]/page.tsx:955-1341` logs the whole `userData` object (token redacted, PII not) and API payloads; `sideDrawer.tsx:735-737` logs full AI prompts; `question-bank-library/debug.ts:95` (gated). |
| `localStorage/sessionStorage` | 63 | 29 | Session (token, tenant, user, profile, host_name) is read from `localStorage.userData/menuContext` in every data layer; role decisions (`isStudentSession`, `isStudentProfile`, `userProfileName()`) come from it; `host_name` becomes the API base URL (`lib/erp-client.ts`). |
| `dangerouslySetInnerHTML` | 19 | 13 | **Unsanitised DB HTML:** `h5p_flashacard/[id]/page.tsx:431`, `h5p_mcq/page.tsx:251,288,396,411,421`, `h5p_single_choice_set/[id]/page.tsx:115`, `h5p_true_false/[id]/page.tsx:104`, `scenario_based/[id]/page.tsx:231,272,304`, `components/h5p/players/EssayPlayer.tsx:83`, `lms/curriculum-planning/CurriculumTab.tsx:188`, `result/report-card/page.tsx:339`, `components/result/DynamicForm.tsx:245`. Sanitised: `h5p_course_presentation/[id]:310`, `h5p_image_hotspots/[id]:121` (DOMPurify), `course-master/[courseId]/chapters/page.tsx:6097` (`sanitizeGeneratedHtml`). `text_activity/player.tsx:619` deliberately avoids innerHTML. (LMS-14 (LMS-AUDIT-080)) |
| `<iframe` | 5 | 5 | `lms/exam/page.tsx:3369`, `_exam-evaluation/SheetReviewPanel.tsx:301`, `homework/review/[id]:267`, `homework/[id]:248`, `lmsAnnotate_assignment/[id]:184` - **no `sandbox` attribute**; `src` is a stored URL (LMS-21 (LMS-AUDIT-086)). `scenario_based` builds a YouTube iframe from a regex on stored HTML. |
| `postMessage` / `addEventListener('message')` | 0 | 0 | none - no origin-check surface. |
| `fetch(` | 173 | 50 | endpoint inventory in Section 5. Direct-to-Laravel with bearer + client tenant params; a minority go through `/api/proxy`. |
| `window.location` | 5 | 3 | `location.reload()` after save/generate in `course-master/.../page.tsx:3348`, `sideDrawer.tsx:930`, `exam/exam-master/page.tsx:195,224` (full reload instead of state refresh); no open-redirect. |
| `user_profile_name\|user_profile_id` | 69 | 22 | Sent as a request parameter on `lms-courses`, `question-paper`, `lms-homework/*`, content upload; backend uses it as the role (LMS-04 (LMS-AUDIT-019)/06/21). |
| `sub_institute_id` / `syear` | 226 / 194 | 49 / 55 | Always sourced from localStorage and sent to the API (Section 4). |
| `return []` | 72 | 35 | Mostly parser fallbacks; no placeholder-response stubs found. |
| `Math.random` | 12 | 10 | H5P shuffles (seeded `mulberry`-style) and `aiPaper.ts` shuffle; no security use. |
| `mock/hardcod/dummy/sample data` | 8 | 8 | `app/quiz/take/page.tsx:6` hard-coded quiz; `app/quiz/create/page.tsx:95-100` fake publish. |
| Hard-coded URLs/ids | - | - | `app/sqaa/_lib/api.ts:168` `https://s3-triz.fra1.digitaloceanspaces.com/public/sqaa/...`; `generated-html.ts:35` `.digitaloceanspaces.com`; Laravel: `term_id = 149`, grade ids 146-149, tenant 195, `sub_institute_id 1` platform tenant. |
| Emoji / gradients in shipped UI | - | - | `app/subjects/page.tsx:7` emoji array, `h5p_mcq/page.tsx:66-69` gradients (design-system says no gradients/emoji) - INFO. |
| Dead files | 1 | 1 | `app/course-master/page.redesign.tmp.tsx` (234 lines, unreferenced `*.tmp.tsx`). |

---



### Part 06 - Fees / Finance / Operations

## 9. Second-pass results

Grep over the whole requested frontend scope (`.ts/.tsx`): `TODO|FIXME|HACK|XXX` = 0; `debugger` = 0; `eval(`/`new Function` = 0; `axios` = 0; `window.location` = 0.
`console.log` = 3 hits, all `app/fees/master/other-fees-title/page.tsx:255,256,383` (logs the full API response and the submit payload incl. `created_by`/`user_id`) - LOW (FIN-32 (LMS-AUDIT-380)).
`dangerouslySetInnerHTML` = 7 hits in 5 files: `fees/collect/[studentId]/page.tsx:669,898` (server receipt HTML), `fees/cancel-refund/page.tsx:815` (stored receipt HTML), `fees/circulars/page.tsx:857,859`, `fees/NACH_s4excel_import/page.tsx:167`, `fees/_components/fees-shared.tsx:235` - none sanitised (FIN-10 (LMS-AUDIT-117)).
`localStorage|sessionStorage` = 36 hits in 13 files: token, `sub_institute_id`, user profile and academic year read from storage (`fees-api.ts:64-169`, every collect/cancel page); `collect/page.tsx:436` caches the whole student fee payload (PII) in `sessionStorage` keyed by student id, removed on read.
`fetch(` = 98 call sites in 45 files (direct Laravel calls from browser: collect, cancel, refund, masters, NACH; via Next proxies: reports, dashboards, online payment; via generic `/api/proxy`: settings, other fees, map_year).
`sub_institute_id|subInstituteId` = 196 hits/57 files; `syear|academicYear` = 322/72; `user_profile*` = 32/9 (all only *sent*, never used for gating).
`new Date().toISOString().slice(0,10)` = 10 hits/6 files (UTC date used as local business date): `collect/[studentId]/page.tsx:139,253,1281`, `fees-api.ts:301`, `cancel-refund/page.tsx:769`, `library/issue_overdue_report/page.tsx:84-85`, `hostel/api.ts:202,219`, `inward_outward/_components/RegisterPage.tsx:14` (FIN-25 (LMS-AUDIT-305)).
`return []` = 34 hits (adapter default values; not stubs). Hard-coded URLs: `fees/help-guide-support/_components/help-guide-grid.tsx:30,43,69` (vendor help PDF/CRM/YouTube links, INFO), Razorpay checkout script, `front_desk/_lib/api.ts:161` (YouTube embed).
Laravel second pass (fees): raw-SQL string concatenation of request input = **76 occurrences in 23 files** (`grep` in `app/Http/Controllers/fees`); client-supplied `sub_institute_id` = ~55 sites; `$_REQUEST` used as the input source in `pay_fees`/receipt building; hard-coded tenant ids = 9 distinct; 2 hard-coded gateway secrets (redacted below).

Operations frontend (sub-audits): `TODO|FIXME` 0; `console.*` 0; `dangerouslySetInnerHTML` 0 (but `document.write` 9 and `window.open` 9 in `app/library/*` print helpers - FIN-63 (LMS-AUDIT-320)); `localStorage|sessionStorage` 4-5 direct hits (plus `lib/erp-client.ts` reads for every module); `window.confirm` 15 (Utility 12, inward/outward 2, front desk 1); `fetch(` 33 in inventory/transport/hostel/library and 7 in front desk/inward/bazar; hard-coded tenant ids: frontend 3 (`library/report/page.tsx` x2, `book_resources/page.tsx`), backend 47/254/49/232/233/76/48/61 etc.; `eslint-disable` 21 (react-hooks effects). Whole-scope figures at the head of this section already include these directories.

---



### Part 10 - Laravel authz / tenant

## 9. Second-pass results (grep counts + material hits)

| Pattern | Count | Material hits |
|---|---|---|
| TODO/FIXME/HACK/XXX in app/routes/config/migrations | 7 | none security-relevant |
| `dd(`/`var_dump(`/`phpinfo(` in `app/Http` | 0 / 0 / 0 | but `public/123.php` = `phpinfo()` |
| `exit;`/`die` (active, uncommented) in `app/Http` | 42 in 27 files | `fees_collect_controller`, `online_fees_collect_controller`, result controllers (debug leftovers that abort responses) |
| `print_r(` / `echo "<pre>` active | 30 in 18 files / 11 in 10 files | debug output paths |
| `getMessage()` placed into JSON/response bodies | ≈484 lines / 150+ files | `admissionEnquiryController` ×6, `admissionFormController` ×5, `ForgotPasswordController:63`, `UserFormbuilderController:49` (returns raw message) |
| `$_REQUEST` uses | 1,189 | legacy controllers, public scripts |
| `$_SERVER['HTTP_HOST']` used to build URLs | 37 | `tbluserController::saveData` posts DB credentials to `http://$_SERVER['HTTP_HOST']/add_user_hrms.php` |
| `md5(` | 40 | student passwords (`loginController`, `ApiLoginController`) |
| `mt_rand/rand(` | 107 | payment order ids, OTPs, file names |
| `DB::raw` / `whereRaw|selectRaw|orderByRaw|havingRaw` | 1,217 / 3,747 | 415 lines interpolate `$var` in 137 files (heuristic; ~60 % are joins on literals); confirmed input-tainted: BE-01 (LMS-AUDIT-008) |
| `exec(`/`shell_exec(` | 8+1 | `Helper.php:1988–2054` `wkhtmltopdf` with unescaped path args and `--enable-local-file-access`; `admissionEnquiryController:1031`, `AJAXController::pythonTimetable` `shell_exec('python3 /home/admission.py')` |
| `unserialize($_REQUEST…)` | 2 | `report/dynamic_report/dynamic_report_controller.php:163,197` (PHP object injection, authenticated) |
| `curl … VERIFYPEER 0/false`; `withoutVerifying`/`'verify'=>false` | 20 / 19 | SMS, FCM, gateway calls |
| `->move(public_path…)` / `getClientOriginalExtension` files | 36 files use client extension; only 19 `mimes:` rules in all controllers | BE-05 (LMS-AUDIT-014) |
| Models `$guarded=[]` / `$fillable` / neither | 35 / 321 / 58 of 474 | `loginModel::$fillable` includes `is_admin`,`sub_institute_id`,`client_id`,`user_profile_id` |
| `$request->all()`-into-write patterns | 2 direct + legacy loops building arrays from all keys (`tbluserController`) | BE-21 (LMS-AUDIT-347) |
| hard-coded tenant conditionals | 218 in 34 files | `studentResultController(2)` 67, `studentCertificateController` 20, `fees_collect_controller` 17 |
| hard-coded credentials/secrets in tracked source | 3 FCM keys (`AAAA***`) `Helper.php:1808,1813,1818`; **DB passwords** (`Triz***`, `Tr!z***`) in `public/general_integration.php:5`, `getworkflow.php:4`, `hrms_api.php:6`, `library_api.php:7`, `school_integration.php:5`, `student_integration.php:5`, `subject_batch_timetable.php:5`, `test.php:5`, `user_integration.php:5`; default passwords `'admin'` (`NewLMS_ApiController:592`) and `'student'` (`NewLMS_StudentApiController:269,283`); backdoor OTP `123456` for mobiles `9979***`,`9824***` (`apiController.php:83`, `adminapiController.php:75`) | BE-06 (LMS-AUDIT-015), BE-09 (LMS-AUDIT-176), BE-15 (LMS-AUDIT-069) |
| `Auth::`/Gate/Policy usage | 2 / policies dir absent | no framework authorization |
| `env(` calls inside `app/` | 112 | break under `config:cache` (e.g. `ApiLoginController` `JWT_TTL_MINUTES`, `WhatsappController`) — with a cached config `env()` returns null, silently disabling `JWT_TTL_MINUTES` |
| `get()` vs pagination in `api/`,`HRMS/`,`G2gLms/` | 842 `->get()` vs 158 `paginate/limit/forPage/take` | 14 files with ≥10 `get()` and none limited (`InventoryApiController` 50, `adminapiController` 34, `teacherapiController` 31, `HostelSetupApiController` 25, `TransportationApiController` 25, `UserManagementApiController` 14) |
| Route targets missing | 16 classes | BE-33 (LMS-AUDIT-438) |
| Dev/test scripts tracked in repo root | 33 (`test_*.php`,`debug_*.php`,`check_*.php`,`fix_*.php`,`tmp_*.php`) + `composer.lock.bak` + `database/pal_schema_full.sql` | not web-reachable (outside `public/`) but ship credentials-by-env usage and DB probes |

---



### Part 12 - Uploads / Import-Export / Notifications / Jobs / Integrations

## 9. Second-pass results

| Check | Count | Material hits |
|---|---|---|
| `TODO|FIXME|HACK|XXX` in scope files (Console, Jobs, Listeners, easy_com, Import, NACH, Helper, Whatsapp, FileController, ImportApi, EmailTemplateService) | 0 | but `config/api_guard.php` carries `TODO(V1.1): verify a shared secret` for the 6 public webhook paths |
| `dd(`/`var_dump`/`print_r`/`exit;`/`die(` in the same controllers (non-comment) | 4 | `s2excel_importController:63`, `s4excel_importController:619` `die()` mid-request |
| `console.log`/`debugger` in import/export/upload frontend files | 0 | - |
| `dangerouslySetInnerHTML` (whole frontend) | 65 | `NACH_s4excel_import/page.tsx:167` renders HTML built from spreadsheet cells (FIN-38 (LMS-AUDIT-125)) |
| `getClientOriginalExtension|File::extension|getClientOriginalName` | 306 in 103 files | INT-11 (LMS-AUDIT-191) |
| `mimes:`/`mimetypes:` | 27 in 18 files | INT-11 (LMS-AUDIT-191) |
| `Storage::disk('digitalocean')` | 154 refs; 83 puts with ACL `'public'`; `temporaryUrl` 0 | INT-11 (LMS-AUDIT-191) |
| `CURLOPT_SSL_VERIFY*=0/false`, Guzzle `'verify'=>false` | 42 call sites in 27 files (+2 mirrored copies under untracked `public/public/`) | INT-15 (LMS-AUDIT-195) |
| Hard-coded secrets in tracked Laravel source | FCM x3 (`Helper.php:1808,1813,1818`, BE-09 (LMS-AUDIT-176)), O*NET Basic auth x28 (`trizinnovation:4225***`), 9 DB credentials in `public/*.php` (BE-06 (LMS-AUDIT-015)) | INT-18 (LMS-AUDIT-198) |
| Hard-coded secrets in `D:\lms_k12` tracked source (`AIza`, `sk-`, `AKIA`, `ghp_`, `xox`, `rzp_`, private keys) | 0 | - |
| Hard-coded tenant ids in senders | `apiController:830-838` (244-265 DLT template `1507166607307092495`, 47), `Helper.php:1800-1848` (254/48/76), `check_otp` 328-341/61 list, `online_fees_collect_controller:321,:920,:1246` (76, 2440), `WhatsappController:580,624` (tenant 1) | INT-19 (LMS-AUDIT-069)/INT-16 (LMS-AUDIT-196)/INT-01 (LMS-AUDIT-016) |
| Hard-coded personal phone numbers / e-mails | 3 distinct mobile numbers in `apiController:82,165,998`, `NewLMS`, `find_broken_link_Controller:80` (4 e-mail addresses incl. personal gmail) | INT-19 (LMS-AUDIT-069) |
| `localStorage` in upload/import frontend | not material | - |
| `fetch(`/axios in scope | `import-data/page.tsx` 4 direct calls to `API_BASE_URL`; Next proxies `import/*`, `proxy-file` | INT-31 (LMS-AUDIT-373) |
| Empty/stub handlers | `WhatsappController::updateDeliveryStatus` `return true;` (`:359`), `updateMessageStatus` empty, routes `whats-send-app`/`whats-comming-app` only log, `MarkUploadController` routes point at a **non-existent class** (`web.php:535-537`), `api/integration-configs` in-memory mock | INT-22 (LMS-AUDIT-364), INT-33 (LMS-AUDIT-375) |
| Duplicated code | `sendSMS()` x11, `frontdesk` vs `implementation\frontdesk` x4 controllers, `result_controller_OLD/OLD2`, `contentLibraryControllerOld` | INT-23 (LMS-AUDIT-365) |

---



# Part 05 - PAL / AI Intelligence audit (lms_k12 + traced Laravel next_lms_erp)

Scope: PAL/ESO adaptive learning, New PAL, Enterprise Brain, Capability/Career/People-Competency, AI console + platform services, assistant panel (Teach Assistant), agent engine, event bus, catalogue. Read-only static analysis; nothing was executed against a server, no `.env` read, no network calls. Two local read-only runs: `scripts/check-agent-catalogue.ts` and the in-scope `node --test` files (218 tests: 216 pass, 2 fail).

Method: the lead auditor (E) covered the assistant panel, hooks, contexts, agent engine, conversational-AI admin, event bus, catalogue integrity and the Laravel `/api/ai` approval/config layer directly; four sub-auditors covered (A) PAL/ESO student flow, (B) New PAL / content model / administration / coherence map / pedagogy engine, (C) Enterprise Brain / capability / career / people-competency, (D) AI console / workspace tabs / platform services / integration / migration modules. Their sections are included verbatim (with IDs renamed `PALA-nn -> AI-Ann`, `PALB-nn -> AI-Bnn`, `BRN-nn -> AI-Cnn`, `PLT-nn -> AI-Dnn`) under each numbered heading as "Sub-part A..E". Sub-audit preambles (memory-fact verification, direct answers) are in section 0.

## Headline findings (details in section 10)
1. Brain, `/api/ai`, ESO/PAL and Migration-module Laravel endpoints frequently authenticate only ("any valid JWT") and do not authorise by role; several are entirely unauthenticated (AI-A01 SQL injection in `palController@show`; AI-A02 unauthenticated student-mastery routes taking `student_id` from the request; AI-C02 Brain search returns raw `tbluser` rows incl. `password`/`plain_password`; AI-D03 migration-modules trusts `sub_institute_id`/`user_id` from the query string; AI-D02 in-memory integration-config store returns secrets to any non-empty Authorization header).
2. Next server routes trust client headers for identity, tenant and even the upstream host (`x-laravel-base-url`): agent engine + conversational-AI admin can be driven cross-tenant and RBAC forged (AI-01, AI-02; same finding independently reported as AI-C03/AI-C04, AI-A08).
3. The AI approval gate (approve/reject recommendation, resolve approval) has no role check, no state machine, replayable approvals and client-supplied approver names (AI-03, AI-D04..06). AI provider keys / policies / prompt templates can be written by any JWT including students (AI-04 = AI-D01).
4. Student-facing PAL scoring is mixed: ESO/diagnostic correctness is server-side, but the PAL Test score is client-declared (`answer##flag`, AI-A06), the answer key is sent to the browser before answering (AI-A05), and 29-32 raw `dangerouslySetInnerHTML` sinks render teacher/AI-authored HTML with the JWT in localStorage (AI-05 = AI-A07).
5. Empty-state handling for tenants without ESO nodes is wrong on the chapter dashboard ("Chapter complete, 0 of 0", AI-A11) and several ESO screens can spin or dead-end (AI-A12).
6. Privacy: stuck-user assistant uploads full-page screenshots on the "No, I'm fine" branch for every role incl. students (AI-06); page-context sends student names/admission numbers to the LLM pipeline (AI-07); browser voice input has no consent and the admin toggle is unused (AI-13); tracked `.kilo/conversational-ai` state contains real personal data (AI-D20).
7. Real vs mock data: the sub-audits found NO hardcoded demo numbers passed off as live in Brain, career, capability, New PAL, event bus (there is no mock adapter); exceptions are Command Center assessment KPIs hard-coded to 0 (AI-C08), Career Awareness static pages, Capability Explorer third-party example-data iframe, and hardcoded roadmap/capability statuses that contradict each other (AI-D18/AI-11).
8. Positives verified: `/api/ai` tenant derives from the JWT and `X-MCP-Institute-Id` is checked against the allowed set; chat storage is sessionStorage, cleared on page load, on logout and New chat; model output renders as React text (no XSS/open redirect through chat); handoff routes are built client-side from numeric ids; Event Bus backend is properly gated (`lms.staff`, `perm`, estate tier) with real-data only; ticket screenshots are admin-gated on the `local` disk.

## Duplicate cluster note (same root cause reported by more than one sub-auditor; lead should count once)
- Agent engine trusts client headers, unauthenticated GET runs: AI-01 = AI-C03.
- Header-controlled upstream `x-laravel-base-url` (RBAC forgery + SSRF): AI-02 = AI-C04 = AI-A08 (also part02's Next routes).
- Approval gate lacking role/state/idempotency: AI-03 = AI-D04 + AI-D05 + AI-D06 (+ AI-C05 for Brain `decision.approve`).
- No role check on AI config/policy/template/key writes: AI-04 = AI-D01.
- Unsanitised HTML sinks: AI-05 = AI-A07 (+ AI-C sinks in career pages).
- Roadmap/capability status drift and failing tests: AI-11 relates to AI-D18.
- `perm:`/`lms.auth` warn-only by default (`LMS_API_AUTH_ENFORCE=false`): AI-04 (note), AI-15, AI-D09, and AI-B* items; live env NOT VERIFIED.
The ISSUE COUNTS line at the end is the raw total before de-duplication.


### 0. Sub-audit preambles and direct answers (verification of memory facts, key Q&A)

#### Sub-part A - PAL / ESO student-facing adaptive learning

#### part05-A — PAL / ESO student-facing adaptive learning (frontend + traced Laravel backend)

Scope: `D:\lms_k12` student-facing PAL/ESO slice, traced UI -> `pal-*.ts` client fn -> Laravel route -> controller -> service -> table.
Backend root `D:\next_lms_erp` (read-only). Memory notes were used as hints and every claim below was re-verified against code
(memory entries are 8-28 days old; where memory and code disagree, code wins and it is called out).
Auditor prefix: `PALA-NN` (temporary). Method: static reading only; nothing was executed, no `.env` read, no network.

---------------------------------------------------------------------------------------------------------------------------

#### Sub-part B - New PAL (gamification, content model, administration, coherence map, pedagogy engine), reports

#### Part 05-B: PAL / AI intelligence (New PAL gamification, content model, administration, coherence map, pedagogy engine, framework/ULU, reports, AI stack)

Auditor: sub-auditor 05-B. Read-only static analysis of `D:\lms_k12` (frontend) traced into `D:\next_lms_erp` (Laravel).
Temp issue prefix: `PALB-NN`. Date of audit: 2026-09-30. No `.env` read, no server/build/network run.

Memory files used and VERIFIED against current code: `project_pal_eso_two_repo`, `gotcha_eso_nodes_tenant1_only`, `project_pal_calibration_tenant_split`, `gotcha_neo4j_auth_broken`, `gotcha_erp_auth_model`. Verification results: (1) the "frontend calls Laravel directly from the browser with a bearer JWT" statement is TRUE for every `app/pal/new/data/*.ts` client (`fetch(\`${session.baseUrl}/...\`)` with `Authorization: Bearer`) but FALSE for `/pal/frameworks`, `/pal/ulu`, `/pal/pedagogy-engine`, which are unauthenticated (see AI-B01). (2) Neo4j failure: the Coherence Map controller has no try/catch, so an auth failure becomes a Laravel 500 (see AI-B12). (3) "role is user_profile_id not is_admin": `PalApiAuth` does derive `role` from JWT `is_admin` OR the profile's `parent_id === 1`, but `ArchitectureRegistry::mayWrite` reads a `user_profile_name` key that `PalApiAuth` never sets (AI-B06). (4) Tenant-1-only PAL nodes / calibration split: not re-measured (needs DB); treated as NOT VERIFIED here.

---

#### Sub-part C - Enterprise Brain, Capability Intelligence, Career modules, People & Competency

#### PART 05-C — PAL / AI intelligence: Enterprise Brain, Capability Intelligence, Career modules, People & Competency LMS

Auditor: sub-auditor part05-C. READ-ONLY static analysis of `D:\lms_k12` (frontend) with tracing into `D:\next_lms_erp` (Laravel).
Temp issue prefix: `BRN-NN`. Live env values / live DB contents are `NOT VERIFIED` throughout (no .env read, no network, no servers).

**Headline answer to the KEY QUESTION (real data vs mock):** the Enterprise Brain, Career Intelligence, Capability/Competency and People-Competency UIs are wired to real Laravel endpoints and contain almost no hardcoded demo numbers on the frontend (no `mock|sample|demo|fake|dummy|lorem` hits in the slice; no fallback-to-fake-data-on-error patterns). The fake/degraded data lives in the BACKEND and in a few UI shells: (1) Capability Command Center hard-codes every assessment KPI to 0 (`CommandCenterService.php:161,191-193,238-239,301-307`) and shows it as live; (2) Capability Explorer is an iframe of a third-party *example* ontology (`taxonomy-ontology.tsx:38`); (3) `GET /matchProfile` returns a hardcoded named student (`lmsCounsellingController.php:1373-1449`) but has no UI consumer; (4) career OccupationDetails ships placeholder strings ("Worker Requirements...") and empty sections; (5) ~15 Brain registry panels read `hpbrain_*` tables that NO application code writes, so they are structurally empty; (6) the four Career Awareness pages are static text (no capture UI though the endpoints exist). Bigger problems are security/authorization: see AI-C01..AI-C06.

---

#### Sub-part D - AI console, workspace tabs, platform services, integration, migration modules, roadmap

#### PART 05-D — PAL / AI intelligence: AI console, workspace tabs, platform services, integration, migration modules (SUB-AUDIT)

Scope owner: sub-auditor "D" of part05. READ-ONLY. Frontend `D:\lms_k12`, backend `D:\next_lms_erp`.
Temp issue prefix: `PLT-`. Evidence is file:line from the tree as of this audit (branch `student_workflow`).
Method note: everything below is static reading. No server, no build, no DB, no `.env`. Backend PHP was read where the UI's behaviour depends on it; nothing was executed. Where an item depends on a live value (env flags, DB rows, which tenants have a policy assigned) it is marked NOT VERIFIED.

---

#### Sub-part A - direct answers to the six task questions

**Q1. Scoring / mastery: client or server? What does the client submit? Can a student tamper?**
There are FIVE independent scoring paths, with very different trust models:

| Path | UI | Client submits | Correctness decided by | Tamper-resistant? |
|---|---|---|---|---|
| ESO diagnostic / practice / CFU / retrieval | `app/pal/eso/page.tsx` | `answer_master_id` (+ `node_id`, `concept_id`, `mode`, `hint_used`) | server `isAnswerCorrect()` (`EsoPolicyService.php:851`) | Correctness yes; **everything around it no** (no served-pool binding, no phase/due check, client-chosen `mode`/`hint_used`, unbounded arrays) -> AI-A04 |
| Legacy chapter diagnostic (`/lms/pal/diagnostic/*`) | `diagnostic/chapter/[chapterId]` | `answers[question_id] = answer_master_id` | server (`DiagnosticService::submit`) | Yes: attempt owned by caller, option must belong to the served question, submit idempotent (`isSubmitted`). But answer key is served pre-answer (AI-A05) |
| Adaptive concept practice (`/lms/pal/adaptive/answer`) | `adaptive/concept/[conceptId]` | `concept_id`, `question_id`, `answer_master_id` | server (`AdaptiveLearningService::recordAnswer`) | Option-belongs-to-question only; any question id, replayable/overwritable (`updateOrInsert`) -> AI-A09 |
| **PAL Test** (`/lms/pal` POST via `/api/pal/submit`) | `exam/page.tsx` | **`answer_multiple[qid][] = "<answerId>##<correctFlag>"`**, `answer_interactive[qid]={correct,...}`, `total_marks`, `question_ids`, `hid_session_quiz` | **the client** (`get_calculate_marks()` trusts the `##flag`; typed-answer verdict falls back to `client_correct`) | **No** -> AI-A06 |
| Legacy practice / concept diagnostic assessment (`/lms/submit-practice`, `/lms/submit-diagnostic-assessment`) | `PracticePanel.tsx` | `student_id` (!), `answers[qid]=answer_master_id` | server `checkAnswer()` | Correctness yes; **identity is a request parameter and the routes are unauthenticated** -> AI-A02 |

Cross-student / cross-tenant / replay:
* Another `student_id`/`learnerId`: blocked on `api/pal/*` (`PalApiAuth::authorizeLearner` + `EsoStudentOnlyAuth`, identity from JWT, tenant from `tblstudent`), blocked on `/lms/pal/*` (`palController::resolveAuthorizedContext` — JWT id, `user_id` override only for same-institute admin). **Not blocked** on `routes/web.php:87-134` (unauthenticated, trusts `student_id`) -> AI-A02.
* Another tenant's `sub_institute_id`: on `api/pal/eso/*` tenant is read from `tblstudent` (good) but `nodeId` / `answer_master_id` / `question_id` are never tenant-checked (AI-A04/09). On `/lms/*` unauthenticated routes `sub_institute_id` is a request param.
* Question/attempt id not in pool: not checked on ESO write endpoints (AI-A04), adaptive answer (AI-A09), PAL Test (AI-A06). Checked (correctly) on legacy chapter diagnostic.
* Replay / resubmit after completion: ESO diagnostic/retrieval/attempt can be replayed at any time and can *demote* or *promote* nodes; chapter diagnostic is idempotent; PAL Test creates a new paper + exam row per POST; adaptive answer overwrites the previous row.
* **Answer key leaked before answering: YES, everywhere.** `ServableQuestions::hydrate()` returns `options[].is_correct` (`ServableQuestions.php:158-166`) and every PAL question payload builder uses it (ESO diagnostic/practice/CFU/retrieval/probe, chapter diagnostic `start()`/`resume()`, adaptive `questions()`); PAL Test `/lms/pal/create` returns `answer_arr[].correct_answer`; `/lms/adaptive-practice` returns `correct_answer`. The frontend maps it to `isCorrect` (`pal-eso.ts:458`, `lib/pal/eso-answers.ts:43`) purely to feed the H5P player. Code comments in `DiagnosticService.php:80`, `AdaptiveLearningService.php:90`, `pal-diagnostic.ts:231-238`, `pal-eso.ts:117` still claim the key is stripped — stale and misleading. -> AI-A05.

**Q2. Empty states (no ESO nodes / calibrated items / approved content).**
Server side is honest and typed (`{no_content:true}`, `no_nodes_defined`, `content_unavailable`, `diagnostic.availability.reason`, `404 -> null` in `fetchPracticeItem`/`fetchCheckUnderstandingItems`). Frontend results are mixed:
handled well: `/pal/eso/learning-path` (noContent + empty list), diagnostic step (`DiagnosticUnavailable`), practice/CFU (`item === null` cards with an exit button), `AdaptiveLearningButton` (renders nothing when the chapter has no ESO-ready concept), `adaptive/chapter` (EmptyState when nothing servable), chapter-diagnostic (`reason` explained), `learn/concept` ("Nothing prepared yet"), `recall`, `mastery/chapter`.
broken/misleading: (a) `/pal/eso/chapter/[chapterId]` for a chapter with zero ESO-ready concepts renders "Current concept: **Chapter complete**", "Mastered concepts 0 of 0" (`ChapterDashboardView.tsx:121-123`); every student chapter link on `/pal` goes there whatever the tenant (`app/pal/page.tsx:527-537`); (b) infinite spinners when `learnerId`/`conceptId` is falsy (`eso/page.tsx:163`, `eso/chapter/.../page.tsx:59`, `knowledge-map/.../page.tsx:72`); (c) `ContrastPairStep` retest fetch has no `.catch` (`eso/page.tsx:2142`) -> "Preparing a fresh question…" forever on any non-404 error; (d) retrieval step with 0 items has no exit (`eso/page.tsx:2566`); (e) `no_nodes_defined` shown to students as "Phase 0 content tagging has not reached it" (`eso/page.tsx:995-1000`). -> AI-A11, AI-A12.
Calibrated items: no page needs them (config `pal_content.diagnostic.require_calibrated` defaults false, `EsoPolicyService::diagnosticItems` tops up with uncalibrated), so 0 calibrated does not break screens; `diagnosticCalibration()` is returned but **not rendered by the ESO diagnostic UI** (only `availability` is), so an uncalibrated score is presented with no caveat. Tenant reality (memory, NOT re-measured): `pal_concept_nodes` only for tenant 1 -> for every other tenant all ESO screens are in the empty state above.

**Q3. `dangerouslySetInnerHTML`.** 29 hits in `app/pal` (all in this slice), zero sanitisation, none use `app/components/questionBank/RichText.tsx` (DOMPurify via `isomorphic-dompurify`, already a dependency). Full list in AI-A07. Authors of the HTML: teachers (web `questionmasterController` stores `answer_master.answer` raw, `teacherapiController` stores title + answers raw), AI generator (`QuestionGenerationService`, LLM output), bulk/Excel/MinerU imports, clone command; misconception correctives come from `content_master`/`misconception_correctives` (LLM-generated HTML via `generateMisconceptionAIContent`). Laravel sanitises on write only in one path: `questionmasterController.php:342,616` wraps `question_title` in `htmlspecialchars()` (which escapes rather than allows HTML, so it double-escapes on this renderer); option text (`answer`) is inserted raw (`questionmasterController.php:391-399`). Token is in `localStorage` (`buildSessionContext` reads `userData.user_token`), JWT has no expiry unless `JWT_TTL_MINUTES` is set (`ApiLoginController.php:427-432`) -> stored XSS = durable account takeover incl. admins who use PAL "view as".

**Q4. Role / tenant gating, view-as.** Gating on the frontend is cosmetic (`isStudentSession()` = `menuContext.user_profile_name === 'student'` from localStorage, `pal-lookups.ts:39`). Real enforcement is server-side: `pal.auth` (JWT `is_student`, institute scope, teacher class scope) and `eso.student` (students only — **staff get 403 on every learner-state ESO route incl. chapter-dashboard/next-action/diagnostic**). Therefore "view as student" cannot expose another student to a student (workspace/students/preview all 403 for role `student`; `pal_view_as_student` in localStorage is only an id that the server re-authorises), BUT: (1) the UI offers view-as and the ESO pages honour it (`eso/page.tsx:93`, `chapter page:51`, `mastery page:63`, `knowledge-map:64`) although the backend forbids staff there, so it can only 403; (2) `pal_view_as_student` is not cleared on session expiry/inactivity (`AuthContext.tsx:104-113,143-145` remove only `auth/menuContext/userData/sessionDate`; only full `purgeClientState()` on logout wipes localStorage) so a stale learner id makes a *student's* ESO pages 403 on a shared browser; (3) staff view-as still renders `PracticePanel` with the viewed student's id (`app/pal/page.tsx:689`) and those endpoints are the unauthenticated ones (AI-A02), so any staff/anyone can write practice answers as that student. `sub_institute_id`, `syear`, `user_id` are client-supplied on every `/lms/*` call (`appendCommonParams`, `commonEntryParams`, `practiceParams`); on JWT-protected routes the server prefers the JWT values (`palController.php:75-78,158-160`), `syear` is always trusted from the client. localStorage keys used: `userData`, `menuContext`, `sessionData` (read), `auth`, `selectedAcademicYear`/`syear`/`sub_institute_id`/`term_id` (read), `pal_view_as_student` (r/w), sessionStorage `palLastConceptContext` (r/w).

**Q5. Business logic.** See section 6 and AI-A10, 13-17, 22. Highlights: mastery math is `±0.2` clamped estimate + per-node evidence floor (3 distinct questions K/A, 1 independent) — sound *if* the inputs were trustworthy; `retrievalCheck` marks any node `retained` on one correct id, which the D4 "legacy mastery" branch then converts into concept mastery (AI-A04); client `computeConceptMastery` adds `+2` per correct answer (`pal.ts:1070`); 40/70 constants are duplicated in 6 places; spaced-repetition endpoint lists stale/duplicate log rows; adaptive "last N rows" scoping breaks after `updateOrInsert`.

**Q6. Second pass.** Section 9.

---------------------------------------------------------------------------------------------------------------------------

### 1. Scope & coverage

#### Sub-part E - Assistant panel, agent engine, event bus, catalogue, Laravel /api/ai cross-cut (lead auditor)

Lead-auditor (E) slice: the assistant panel and everything that feeds it, the agent engine, event bus, conversational-AI admin, catalogue integrity, and cross-cutting tracing of the Laravel `/api/ai/*` layer. Files read fully unless noted.

| Area/dir | Files in scope | Read fully | Skimmed | Not reviewed | Notes |
|---|---|---|---|---|---|
| app/components/ChatbotPanel.tsx | 1 (1215 lines) | 1 | 0 | 0 | render, transport, stuck flow, voice, storage |
| lib/chatbot-storage.ts (+ test) | 2 | 1 | 1 | 0 | sessionStorage; test not opened |
| hooks/ (use-ai-workspace, use-agent-action-handler, use-stuck-user-assistance, use-voice-interaction) | 4 | 4 | 0 | 0 | use-resizable-panel, use-sidebar-navigation out of scope |
| contexts/PageAiContext.tsx, AuthContext.tsx (logout/clear only) | 2 | 1 | 1 | 0 | |
| components/ai/ (StuckUserAssistant, AiFieldAssistant) | 2 | 1 | 1 | 0 | AiFieldAssistant: fetch/auth path only |
| lib/agents/* (types, engine, acting-user, client, store) | 5 of 9 | 5 | 0 | 0 | executors.ts (2023 lines) read lines 1-200 + hasExecutor/executeTool; registry.ts (1692) checked via script; tests not opened |
| lib/agents/executors.ts, registry.ts | 2 | 0 | 2 | 0 | executed catalogue script + node cross-check instead of reading 3.7k lines |
| lib/ai/* (mcp-client, session, local-model, conversational-admin/*, field-edit/prompt.ts, shared-utils, project-resolver) | 12 of 16 | 9 | 3 | 4 (field-edit/actions.ts, field-edit/types.ts, stuck-assist-types, ai-capabilities.test body) | |
| lib/event-bus/* | 4 | 3 | 1 (types.ts) | 0 | |
| lib/module-ai, lib/new-pal | 2 | 1 | 1 | 0 | |
| packages/* | 5 | 2 | 3 | 0 | |
| app/api/agents/**, app/api/ai/**, app/api/conversational-ai/**, app/api/pal/submit (trace only) | 12 | 8 | 4 | 0 | audited primarily by part02 |
| scripts/check-agent-catalogue.ts | 1 | 1 | 0 | 0 | executed (read-only, prints only) |
| Laravel: routes/ai.php, routes/platform.php, Ai controllers (Recommendation, Ticket, Configuration store, Policy store, Template store), DecisionGate, McpAuth, McpContextResolver, RequirePermission | 12 | 9 | 3 | 0 | |
| Other modules (PAL student flow, New PAL, Brain, Capability, Career, AI console, Platform...) | ~500 files | delegated | | | see sub-audits A (PAL student), B (New PAL/content/admin), C (Brain/capability/career), D (AI console/platform/misc). Their coverage tables are included below verbatim under each section |

Verification runs performed (read-only): `npx tsx scripts/check-agent-catalogue.ts` (PASS lines, 40 modules/100 tools); a temp script in scripts/ (deleted, git status clean) dumping registry to compare against Laravel `config/rbac_modules.php` and `app/Mcp`; `node --import tsx --test` over scope tests: 218 tests, 216 pass, 2 fail (lib/ai/ai-capabilities.test.ts).

#### Sub-part A - PAL / ESO student-facing adaptive learning

Definitions: **Full** = read line by line; **Skim** = read structure + grep for patterns/effects/math; **NR** = not reviewed.

| Area/dir | Files in scope | Read fully | Skimmed | Not reviewed | Notes |
|---|---|---|---|---|---|
| `app/pal/page.tsx` (PAL landing) | 1 (1190 loc) | 1 | 0 | 0 | |
| `app/pal/_components/*` | 16 (4819 loc) | ChapterRow deps: `AdaptiveLearningButton`, `CompletionState` (1-160), `StudentPicker`, `ViewAsBanner`, `PalContextBootstrap`, `PracticePanel` = 6 | `AnswerReview`, `BandMeter`, `DiagnosticNavigator`, `JourneyRail`, `NextStepCard`, `PalWorkspace` (math/grep only) = 6 | `DiagnosticPanel` (unreferenced dead code; only grep), `PalContentView` (958, taxonomy viewer; belongs with frameworks/ULU part), `PalTaxonomyDetailPage`, `PalTaxonomyParentPage` = 4 | |
| `app/pal/_lib/searchParams.ts` | 1 | 1 | 0 | 0 | |
| `app/pal/data/*` | 13 (9484 loc) | `pal-eso.ts` 1-1000, `pal-completion.ts`, `pal-view-as.ts`, `pal-lookups.ts`, `pal.ts` 296-1500 (~half), `pal-diagnostic.ts` 60-560 & 1090-1260, `pal-intervention.ts` 1-600, `pal-feedback.ts` 60-330, `pal-legacy.ts` 1-160 = 9 partial-full | `pal-v4.ts`, `pal-content.ts`, `pal-content-model.ts`, `pedagogy-engine.ts` (endpoint/grep only; staff/admin + curriculum reference, sibling part) | remainder of `pal-eso.ts` 1000-1584 (mastery-details/knowledge-map/learning-path/tutor mappers, mapping only), `pal.ts` 1500-1751 (personalize marks) | |
| `app/pal/eso/**` | 7 (4979 loc) | `page.tsx` (2604), `chapter/[chapterId]/page.tsx`, `_components/ChapterDashboardView.tsx`, `_components/AiTutorPanel.tsx` = 4 | `learning-path/page.tsx` (1-150), `mastery/[conceptId]/page.tsx`, `knowledge-map/[conceptId]/page.tsx` (state/effect/grep) = 3 | 0 | |
| `app/pal/adaptive/**` | 3 (1252) | `chapter`, `concept`, `concept/result` (40-300) = 3 | 0 | 0 | |
| `app/pal/diagnostic/**` | 3 (1575) | `chapter/[chapterId]/page.tsx` (1056) = 1 | `history`, `result/[attemptId]` (grep) = 2 | 0 | |
| `app/pal/learn`, `feedback`, `mastery`, `plan`, `recall`, `intervention` | 8 pages (~4200 loc) | `learn/concept` (60-480), `feedback/concept` (100-280), `mastery/chapter` (90-210) = 3 partial | `plan/chapter`, `recall`, `mastery/concept`, `intervention/page`, `intervention/concept` (grep state/math/links) = 5 | UI-only remainder | |
| `app/pal/exam`, `app/pal/result` | 2 (869) | `exam/page.tsx` fully, `result/page.tsx` 36-190 | | | |
| `app/pal/_dev-preview` | 1 | 1 | 0 | 0 | |
| `app/pal/framework*, frameworks*, ulu*, pedagogy-engine/page` | 8 tiny redirect/shim pages | 8 | pedagogy-engine `_components/*` (7, sibling part) | | |
| `lib/pal/*` | 6 (990) | `eso-answers`, `diagnostic-answers`, `practice-answers`, `exam-answers` = 4 | 2 test files (existence only) | 0 | |
| `lib/new-pal/*` | 1 (142) | 1 | | | descriptor only |
| `app/api/pal/*` | 3 (159) | 3 (`submit`, `content-model`, `pedagogy-engine`) | | | |
| **Frontend totals** | **~86 files / ~34.6k loc in named scope** | **~38 files fully or nearly fully** | **~24 skimmed** | **~10 not reviewed (listed)** | |
| Laravel (traced, read-only) | `routes/pal_eso_api.php`, `routes/pal_api.php` (head), `routes/lms.php` (PAL block), `routes/web.php` (87-134, 840-861), `PalApiAuth`, `EsoStudentOnlyAuth`, `SessionMiddleware`, `VerifyCsrfToken`, `EsoEngineController` (all 509), `EsoPolicyService` (~2600 of 4939 loc: consts, diagnostic*, practice*, scoreDiagnostic, nextAction legacy, recordAttempt, CFU, masteryVerdict, evidenceByNode, retrieval*, dashboards, learningPath, signals, applyUpdate, scheduleRetention, stateFor), `EsoPalRenderer::render`, `palController` (create, store, show, diagnostic*, adaptive*, learnContent/Acknowledge, mastery/recall/plan, misconception gen, resolveAuthorizedContext), `DiagnosticService`, `DiagnosticScorer`, `AdaptiveLearningService`, `AdaptiveDifficultyRule`, `ConceptPerformanceAnalyzer` (practiceByConcept), `PracticeOutcomeService` (head), `MasteryOverviewService::recallQueue`, `ServableQuestions`, `assessmentQuestionController` (practice/diagnostic assessment/gate/history/spaced-repetition), `PedagogyEngineController` (signatures), `DeriveIrtCommand`, `onlineExamController::get_calculate_marks`, `PalWorkspaceController::students` (head), `ApiLoginController` JWT payload | | | | |

Not reviewed (explicit): `PalContentView.tsx`, `PalTaxonomy*Page.tsx`, `DiagnosticPanel.tsx` (dead), `pal-v4.ts`/`pal-content.ts`/`pal-content-model.ts`/`pedagogy-engine.ts` bodies, `EsoPolicyService` teach/CFU/contrast-pair/misconception-history/enrichment/knowledge-map bodies (lines 2108-2500, 3980-4136, 4424-4620), `EsoFlowPipeline` (`engine=pipeline` path, default is `legacy`), `PracticeOutcomeService::decide`, `LearningPlanService`, `MasteryOverviewService::forChapter`, `NewPalGamification*`, Neo4j helpers.

---------------------------------------------------------------------------------------------------------------------------

#### Sub-part B - New PAL (gamification, content model, administration, coherence map, pedagogy engine), reports

Scope note: `app/pal/knowledge-map` does not exist (0 files); `app/pal/eso/**` is covered by another agent. `app/api/pal/submit/route.ts` (103 lines) and `app/pal/data/*.ts` (pal.ts, pal-v4.ts, pal-content.ts, pal-eso.ts, pal-lookups.ts, pal-view-as.ts, pal-content-model.ts, pedagogy-engine.ts) are outside the stated slice; I read only the parts needed to trace my pages (noted below as "adjacent").

| Area/dir | Files in scope | Read fully | Skimmed / partial | Not reviewed (grep only) | Notes |
|---|---|---|---|---|---|
| app/pal/new - gamification (8 pages, layout, 3 shared components, data/gamification.ts) | 13 | 10 (overview page, layout, GamificationChrome, GamificationScope, useGamificationResource, team-challenges, challenge-mode, career-quest, streaks, data/gamification.ts) | 3 partial (badges 140/328 lines, session-summary 150/315, personal-best 120/257) | 0 | ~4.4 KLOC. All API-backed; no mock data. |
| app/pal/new - overview, nav, administration, coherence, ai-stack, data clients, panels | 15 | 7 (new/page, NewPalNav, administration/page, administration/[subsystem], coherence-map/page, ai-stack/page, ai-stack/_screens) | 4 partial (AdministrationPanels 60-520/872, data/administration.ts 1-140+greps, data/coherence-map.ts 1-140+greps, data/content-model.ts 1-180+greps of 1399) | 4 (AdministrationChrome, CoherenceMapView, KnowledgeGraphView, MisconceptionCard - grepped only) | |
| app/pal/new/content-model (6 pages) | 6 | 2 (review, authoring) | 0 | 4 (page, chapter, concept, misconceptions - grepped for hardcoded data/links/role logic only) | |
| app/pal/content | 3 | 1 (review) | 1 partial (page.tsx 200/372) | 1 (misconceptions) | |
| app/pal/personalize-marks | 1 | 1 | 0 | 0 | |
| app/pal/report | 1 | 1 | 0 | 0 | |
| app/pal/reports | 1 | 1 (attainment) | 0 | 0 | |
| app/pal/intelligence | 1 | 1 (1038 lines) | 0 | 0 | |
| app/pal/pedagogy-engine | 8 | 3 (page, PedagogyEngine, EngagementScore) | 0 | 5 (ConceptContextBar, Navigation, RuleTable, TriggerMap, ResolvedEvidence) | |
| app/pal/framework, frameworks, ulu | 6 | 6 | 0 | 0 | All thin wrappers / redirects. |
| lib/new-pal, lib/module-ai | 2 | 2 | 0 | 0 | |
| app/api/pal/content-model, pedagogy-engine | 2 | 2 | 0 | 0 | |
| **Totals** | **59** | **37** | **8** | **14** | 59 = 37 + 8 + 14. Note "not reviewed" files were still grepped for TODO/mock/fetch/localStorage/links. |

Note 1: `app/pal/new` = 34 files (19 fully read, 7 partial, 8 grep-only) split across the first three rows; the Totals row is the sum of all rows.

Backend (D:\next_lms_erp, READ-ONLY, adjacent tracing, not counted above): read fully `routes/pal_api.php`, `routes/pal_eso_api.php` (1-80), `app/Http/Middleware/PalApiAuth.php`, `NewPalGamificationController`, `NewPalContentModelController`, `PalArchitectureController`, `PedagogyEngineController` (api/PAL), `ChallengeModeService` (60-434), `StreakService` (20-312), `GamificationVisibility` (1-150), `AttainmentReportController` (1-120), `SemanticIntelligenceSource` (15-135). Read partially: `PalContentIntelligenceController` (40-257, 755-831), `PALAPIController` (436-730), `TeamChallengeService` (1-330), `BadgeService` (44-150, 200-240, 672-700), `CoherenceMapController` (1-140, 310-436), `ContentModelAuthoringService` (135-332), `ArchitectureRegistry` (96-212, 555), `ContentMetadataService` (270-340), `resultPersonalizeMarksController::store`, `palController::palreport`, `ConceptVideoController` (grep), `ULUService` (grep), `ContentModelEnrichmentService`/`ContentModelLlmClient` (grep+prompt builders), `LearnerActivitySource::dailyActivity`, `HydratesLegacyApiSession`. Not read: `PersonalBestService`, `CareerQuestService`, `SessionSummaryService` (only summary/notifications), remaining `LearnerActivitySource`, `ContentModelProjector`, `MisconceptionProjector`, `ArchitectureHealthService` (grep), `SubsystemRuntime`, `PalWorkspaceController`.

---

#### Sub-part C - Enterprise Brain, Capability Intelligence, Career modules, People & Competency

| Area/dir | Files in scope | Read fully | Skimmed | Not reviewed | Notes |
|---|---|---|---|---|---|
| `app/enterprise-brain/**` | 43 | 43 | 0 | 0 | All pages, `_components`, stub wrappers. 14 pages are 5-line `ScreenView`/`SectionView` wrappers. |
| `lib/brain/*` | 7 | 2 (`api.ts`, `navigation.ts`) | 5 (`*.test.ts` — read test names only) | 0 | |
| `docs/enterprise-brain/*` | 1 | 1 (`INTEGRATION_AUDIT.md`) | 0 | 0 | Stale (see AI-C38). |
| `app/capability-intelligence/**` | 32 | 12 | 11 | 9 | Fully: `layout`, 5 `page.tsx`, `command-center-api`, `command-center.tsx`, `use-command-center`, `use-competency-extras`, `taxonomy-ontology`, `levels-of-responsibility`. Skimmed (targeted ranges + greps): `competency-extras-api`, `competency-library-api`, `framework-studio-api`, `libraries-taxonomy-api`, `use-competency-library`, `course-builder-panel`, `library-detail-modal`, `library-tab`, `framework-mapping` (lines 296-436, 876-955), `role-requirements-panel`, `competency-library`. Not reviewed (grep only): `use-framework-studio`, `use-libraries-taxonomy`, `capability-library-taxonomy`, `components/index.ts`, `library-config`, `library-form`, `role-competency-inline-panel`, `shape-grid`, `taxonomy-manager`. |
| `app/career-explorer/**` | 18 | 7 | 4 | 7 | Fully: `CareerExplorerHub`, `OccupationDetailView`, `ResultsList`, `_lib/api`, `_lib/types`, `expert-advice`, `explore-sectors`. Skimmed: `CourseProfileHub`, `EmployerProfileHub`, `CollegeProfileHub`, `ProfileImage`. Not reviewed: `CareerExplorerPageHeader`, `ClusterGrid`, `EduSideMenu`, 4 trivial `page.tsx` wrappers. |
| `app/career-counselling/**` | 12 | 9 | 0 | 3 | Not reviewed: `IntroBanner`, 2 `page.tsx` Suspense wrappers. |
| `app/career-awareness/**` | 12 | 9 | 0 | 3 | Not reviewed: `ambition|certainty|originality/page.tsx` (same wrapper as `alignment/page.tsx`). |
| `app/career-intelligence/**` | 7 | 6 | 1 | 0 | `CareerIntelligence.tsx` (661 lines) skimmed: header, grep for math/catch/studentId. |
| `app/people-competency/**` | 12 | 12 | 0 | 0 | Pages are thin wrappers over `components/domain/lms/*` (OUT of my slice; only traced where they consume the two hooks). |
| `components/intelligence/module/contracts/capability.ts`, `talent.ts` | 2 | 1 | 1 | 0 | |
| **Totals (slice)** | **146** | **101** | **22** | **22** | (docs counted) |

Out-of-slice files read to trace flows: `lib/agents/{acting-user,engine,store,client}.ts`, `app/api/agents/**`, `app/api/conversational-ai/**` + `lib/ai/conversational-admin/service.ts`, `app/api/proxy/route.ts`, `app/components/DashboardShell.tsx` (Brain gating ranges), `app/components/ConditionalApp.tsx`, `lib/erp-client.ts`, `lib/session/internal-access.ts`, `components/domain/lms/assignments/learning-assignments.tsx` (ranges), `components/ui/g2g/data-table.tsx` (ranges), `app/data/routeMapper.ts` (ranges), `app/_components/module-intelligence.tsx`.
Laravel read: `routes/brain.php`, `routes/competency_management.php`, `routes/lms.php` (career block), `routes/g2g_lms.php` (ranges), `Brain{Authenticate,TenantScope,RequirePermission}`, `Role`, `Permission`, `config/brain.php`, `config/career_recommendation.php`, `BrainController` (all but 620-795 skimmed), `BrainIntelligenceController` (ranges), `BrainIntelligenceIntegrationController`, `ModuleWorkflowService` (range), `FoundationIngestor` (range), `CapabilityIntelligence`, `HealthScores` (range), `ScreenRegistry` (grep), `CommandCenterService`, `ProficiencyService`, `CompetencyStudioController` (ranges), `CompetencyGapController`, `CompetencyRoleMapController`, `ResolvesCompetencyContext`, `HydratesLegacyApiSession`, `RequireStaffRole`, `SessionMiddleware`, `lmsCounsellingController` (career + counselling ranges), `CareerRecommendationController` (range), `KnowledgeMatchService`, `AlternativeOccupationRecommender`, `AlignmentBandClassifier`, `CaiCoreService` (range), `AssignmentsController::bulkReview`, `ApiLoginController` (token minting).
Not reviewed: `TalentIntelligence`/`TalentSignalRules`, the other 24 module `*Intelligence` classes, `EntityIntelligence` beyond `student()`, `GraphExplorer`, `CareerEvidenceService`, `CertificationController`, `DevelopmentPlanController`, `CareerPathController`, `EmployeeCompetencyProfileController` (only validation greps).

---

#### Sub-part D - AI console, workspace tabs, platform services, integration, migration modules, roadmap

Tracked-file counts come from `git ls-files`. "Read fully" = read start to end. "Skimmed" = read in part and/or grepped for the specific behaviours listed in the brief. "Not reviewed" = only located, not opened.

| Area/dir | Files in scope | Read fully | Skimmed | Not reviewed | Notes |
|---|---|---|---|---|---|
| app/ai/** | 23 | 5 (page.tsx, [capability]/page.tsx, CapabilityShell, CapabilityLiveData, DomainAgentPanel) | 13 (policies/page.tsx head+toggles, ConfigurationManager, ModelManager, usage-cost, audit, guardrails, models, providers, prompts/page, TemplateView iframe, prompts/[id]*, prompts/new) | 5 (TemplateForm.tsx, TemplateList.tsx, ModulePicker, ModuleModelOverrides, console-ui — grep only for links/redirects/confirm) | No role gating found anywhere in this directory (grep). |
| app/ai-reports/[id] | 1 | 1 | 0 | 0 | Sandboxed iframes; see AI-D08. |
| app/ai-platforms | 1 | 1 | 0 | 0 | Static vendor directory. |
| app/ai-journey | 1 | 1 | 0 | 0 | Approve/reject = `/ask` with pinned payload. |
| app/platform-services/** | 12 | 0 | 12 (shell.tsx 1-120, EventBusConsole header/banner, Notification/Workflow console headers, grep for mock/fallback/permission across all 12) | 0 (but tables.tsx, kpi-row.tsx, volume-chart.tsx, scheduler body only grepped) | Backend controllers read (PlatformController, Notification updateChannel, Scheduler update, Workflow docs, EventBus tiers). |
| app/platform-roadmap, app/platform-administration | 2 | 2 | 0 | 0 | |
| app/integration/** | 8 | 8 | 0 | 0 | Plus the components they re-use in `app/task-management/**` (out of slice, read: integration-shell, integration-management-api, use-integration-management) and the three `app/api/integration-configs/**` route handlers (read fully). |
| app/engagement, app/interactions, app/mobile-apps | 6 | 6 | 0 | 0 | 3 pages + 3 screen files, all thin wrappers over `app/_components/ai-stack/build-ai-stack-screens` (NOT in slice, NOT reviewed). |
| app/migration-modules/** | 2 | 2 | 0 | 0 | Backend `MigrationModulesApiController` read fully (71 lines). |
| lib/platform/* | 4 | 2 (client.ts, cron.ts) | 2 (types.ts 1-120, cron.test.ts existence) | 0 | |
| lib/roadmap/* | 3 | 1 (index.ts) | 2 (registry.ts 1-120 + 636-821 + status grep; catalog.test.ts existence) | 0 | |
| lib/engagement, lib/interactions, lib/mobile-apps | 3 | 1 (engagement) | 2 (interactions diffed against engagement; mobile-apps 1-60 + tool names) | 0 | |
| components/intelligence/** (47) | 47 | 3 (AiInsightsPanel, RecommendationCard, module/format.ts) | 12 (AnswerSections 100-215, ConceptIntelligenceTabs 1-330 + greps, conceptIntelligenceGuide 262-317, module/ModuleIntelligence 40-140, module/sections.tsx 480-640, module/registry.ts 1-260 + notes, module/contracts/fees.ts 60-140 + 380-390, module/sections/ModuleIntegrationSection 1-70, CrossModuleWorkflowSection grep, module/contract.ts grep, module/payload.ts grep) | 32 (LifecycleTrace, EvidenceList, ExplanationCard, OutcomeTimeline, GeneratedContentBadge, ConceptIntelligenceHelp, primitives.tsx, section-nav.tsx, the other 25 `module/contracts/*.ts` — grep only for `?? 0`, `Number(`, mock/sample/demo) | grep for mock/sample/demo/fake: 0 hits outside registry notes. |
| lib/intelligence/* (22) | 22 | 7 (client.ts, workspace.ts, ai-generate.ts, template-engine.ts, admission-document.ts, ask-stream.ts, and row-action.test head) | 5 (ai-module.ts 150-260, ai-configuration.ts 160-245, others via grep of fetch/session code) | 10 (ai-capabilities.ts, ai-policies.ts, ai-templates.ts, ask-adapter.ts + test, sse.ts + test, ui-messages.ts + test, types.ts, module-handoff.ts + test, ask-stream.test) | |
| app/components/ai-workspace/* | 6 | 4 (ActionsTab, CreateTab, AnalyseTab, ConnectionsTab) | 2 (WorkspaceChrome, FlowStrip — grep of handlers/links only) | 0 | |
| packages/* | 5 | 4 (ai-intelligence-core/index.ts, solutions.ts, conversational-ai-core/file-store.ts, followup-suggestions.ts) | 1 (registry.ts: status/href/today greps + selected lines) | 0 | |
| .kilo/conversational-ai (committed) | 22 | 2 (admission-state sample, history head) | 20 (grep for token/secret/email/phone; one 26 KB workflow-state file sampled) | 0 | + `.kilo/kilo.jsonc` (3 lines) and `.kilo/plan/` located. |
| Docs (5) | 5 | 3 (PAL-V4-Frontend-Change-Map.md, VERIFIED_GENERATIVE_AI_FIELD_COVERAGE.md, conversational-ai-architecture.md) | 1 (universal-conversational-ai-platform.md 55-130 + reference check) | 1 (AI_FIELD_ASSISTANT.md: only file-reference existence check) | |
| **Totals** | **~240** (146 code + tests, 22 .kilo, 5 docs, + ~65 out-of-slice files opened for tracing) | ~48 | ~75 | ~62 | |

Backend files read (Laravel), because the frontend behaviour cannot be judged without them: `routes/ai.php`, `routes/platform.php`, `routes/brain.php` (head), `routes/api.php` (migration-modules + tab-labels lines), `Http/Middleware/{McpAuth, McpContextHydrator, McpRateLimit, LmsApiAuth, RequirePermission, RequireLmsStaff}`, `Services/Mcp/McpContextResolver`, `Http/Controllers/AI/{AiController, RecommendationController, WorkflowController, WorkspaceController (most), GenerationController, AskController (ask/policyContext), ReportController, AiConfigurationController (head/store), AiPolicyController (head, ensureDefault), AiModuleController::recordActivity, CaseController (parts), OutcomeController::measureDue, AiAssistanceTicketController (parts)}`, `Domain/AI/Decisions/DecisionGate`, `Domain/Workflow/{WorkflowEngine (start/resolveApproval), Steps/ApprovalStepHandler}`, `Domain/Governance/GovernanceValidator (authorizeRole/authorizeExecute)`, `Domain/AI/Lifecycle/Stages/HumanApprovalStage (parts)`, `Domain/K12/AcademicRisk/{CreateAcademicInterventionAction, StudentScope}`, `Services/AI/AiPolicyResolver`, `Services/Mcp/{ReportSender, AiReportGenerator (greps), }`, `Domain/AI/Templates/GeneratedReportStore (head)`, `Http/Controllers/api/Platform/{PlatformController, RegistryController, NotificationController::updateChannel, SchedulerController::update, WorkflowController (docs/validation greps), EventBusController (greps)}`, `Http/Controllers/api/MigrationModulesApiController`, `Http/Controllers/api/lms/ConceptIntelligenceTabLabelApiController`, `Http/Controllers/Brain/BrainIntelligenceController::{decide, executionComplete}`, `Http/Middleware/Brain/BrainTenantScope`.

Files in scope NOT reviewed (listed so the lead knows): `app/_components/ai-stack/*` (shared implementation of the nine AI Stack tabs used by engagement/interactions/mobile-apps), `hooks/use-ai-workspace.ts` and `contexts/PageAiContext.tsx` (lead's slice; only grepped to see what `page_data` carries), 32 components/intelligence files listed above, `lib/intelligence/{ask-adapter,sse,ui-messages,types,module-handoff,ai-policies,ai-templates,ai-capabilities}.ts` bodies, `app/ai/_components/{TemplateForm,TemplateList,...}.tsx` bodies, `app/platform-services/*/_components/*` bodies beyond headers/grep, AI_FIELD_ASSISTANT.md body.

---

### 2. Module inventory (your scope)

#### Sub-part E - Assistant panel, agent engine, event bus, catalogue, Laravel /api/ai cross-cut (lead auditor)

| Module | Backend | Frontend | DB tables | API endpoints | Permissions/roles | Menu | Status |
|---|---|---|---|---|---|---|---|
| Teach Assistant panel (chat) | Laravel AskController /api/ai/ask/stream via Next SSE proxy app/api/ai/ask/stream | app/components/ChatbotPanel.tsx, components/intelligence/AnswerSections, LifecycleTrace | ai_conversations, ai_audit_logs | POST /api/ai/ask/stream, /api/ai/ask, GET /api/ai/workspace/context | McpAuth (any JWT incl. student); trace visible only to canSeeInternalView (client) | floating toolbar | Mostly complete |
| AI Workspace tabs (Create/Analyse/Actions/Connections) | WorkspaceController | app/components/ai-workspace/* | ai_recommendations, ai_decisions, workflow_runs | /api/ai/workspace/*, /api/ai/recommendations/*/approve | none beyond auth (AI-03) | in panel | Partially complete (draft not consumed, see PLT-12) |
| Stuck-user assistance | AiAssistanceTicketController | hooks/use-stuck-user-assistance, StuckUserAssistant, ChatbotPanel | ai_assistance_tickets, storage local disk | POST /api/ai/assistance-tickets (Next) -> /api/ai/assistance/tickets | admin-only read (verified) | n/a | Complete, privacy concerns (AI-06) |
| Voice | browser Web Speech API only | hooks/use-voice-interaction | none | none | none | in panel | Complete, no consent; admin voice_enabled toggle unused (AI-13) |
| Field AI assistant | GenerationController /api/ai/generate template k12.field_edit | components/ai/AiFieldAssistant, lib/ai/field-edit | ai_generation_requests/outputs | POST /api/ai/field-edit (Next) | any JWT | sparkle on ~40 fields | Complete |
| Agent Management | none (Next-local JSON store); MCP tools via Laravel /api/mcp | lib/agents/*, app/api/agents/*, module Automations tabs | .data/agents.json (file) | /api/agents, /api/agents/runs, /api/agents/[id], /api/agents/[id]/run | forgeable (AI-01/02) | per-module AI Stack | Partially complete / insecure |
| Conversational-AI admin | none (Next-local JSON store) | app/ai/... (see sub-audit D), lib/ai/conversational-admin | .data/conversational-ai.json | /api/conversational-ai/projects[/id/settings|token] | forgeable RBAC (AI-02); service tokens never verified by any route (authenticateServiceRequest used only in tests) | AI console | Stub-ish backend |
| Event Bus | routes/platform.php + EventBusController/EventBusReader | lib/event-bus/*, app/platform-services (sub-audit D) | sync_log, ai_audit_logs, workflow_runs/steps, failed_jobs, send logs | 6 GET /api/platform/events/* | lms.staff + perm (warn-only) + is_admin==2 tier | Platform Services | Mostly complete (Consumers tab intentionally not wired) |
| Agent catalogue | n/a | lib/agents/registry.ts, scripts/check-agent-catalogue.ts | config/rbac_modules.php | n/a | rbac agents.<module> | n/a | 38/40 modules resolvable; g2g, hrit dead |
| Module AI ledger | AiModuleController::recordActivity | lib/module-ai/module-ai-stack.ts | ai_audit_logs | GET/POST /api/ai/modules/{m}/activity | any JWT (AI-12) | AI Stack tabs | Complete but client-attested |

Flags: backend-without-UI/UI-without-backend items for the other modules are in the sub-audit inventories below. Duplicate/overlapping modules noted by D (ai-platforms / platform-services / platform-roadmap / ai-journey).

#### Sub-part A - PAL / ESO student-facing adaptive learning

| Module | Backend | Frontend pages/components | DB tables (traced) | API endpoints | Permissions/roles | Menu entry | Status |
|---|---|---|---|---|---|---|---|
| PAL landing (subjects/chapters, view-as) | `PalWorkspaceController::workspace/students/preview`, legacy `palController@index` fallback | `app/pal/page.tsx`, `StudentPicker`, `ViewAsBanner`, `AdaptiveLearningButton`, `PracticePanel` | `tblstudent`, `tblstudent_enrollment`, `sub_std_map`, `chapter_master`, `lms_online_exam` | `GET /api/pal/workspace/{learnerId}`, `/workspace/students`, `/workspace/preview`; 404 -> legacy `/lms/pal`, `/api/lms-courses`, `/get_adminStudentList` | student = own; staff scoped by institute/class (`PalApiAuth`) | `pal.index`/`lms/pal` -> `/pal` (`routeMapper.ts:238-240`) | Mostly complete |
| PAL Test (quiz) | `palController@create/store/show`, `onlineExamController::get_calculate_marks`, `PalInteractiveAnswers` | `exam/page.tsx`, `result/page.tsx`, `lib/pal/exam-answers.ts` | `question_paper`, `lms_online_exam`, `lms_online_exam_answer(_student)`, `pal_assessment_results`, `pal_competencies`, Neo4j | `GET /lms/pal/create`, `POST /lms/pal` (via Next BFF `POST /api/pal/submit`), `GET /lms/pal/{id}` | JWT via `session` mw | reached from `/pal` "Start quiz" | **Broken integrity** (AI-A01/03/06) |
| Chapter diagnostic (15 MCQ) | `palController@diagnostic*`, `DiagnosticService`, `DiagnosticScorer`, `DiagnosticEsoBridge` | `diagnostic/chapter/[id]`, `.../history`, `diagnostic/result/[attemptId]` | `pal_diagnostic_attempt`, `pal_diagnostic_response` | `GET /lms/pal/diagnostic/chapter/{id}`, `POST .../attempt/{id}/submit`, `GET .../attempt/{id}/result`, `GET .../history/{id}` | JWT; attempt ownership enforced | `/pal` button | Complete (answer key exposed; answers not persisted until submit) |
| Concept diagnostic ("adaptive") | `AdaptiveLearningService`, `AdaptiveDifficultyRule`, `ConceptPerformanceAnalyzer` | `adaptive/chapter/[id]`, `adaptive/concept/[id]`, `.../result` | `pal_adaptive_response`, `lms_question_mapping`, `pal_diagnostic_*` | `GET /lms/pal/adaptive/chapter/{id}`, `GET .../concept/{id}`, `POST /lms/pal/adaptive/answer`, `GET .../progress/{id}`, `GET .../concept-result/{id}` | JWT | from diagnostic result / plan | Mostly complete (AI-A09/17) |
| Plan / Mastery / Recall / Learn (stages 5-11) | `LearningPlanService`, `MasteryOverviewService`, `palController@learnContent/learnAcknowledge` | `plan/chapter/[id]`, `mastery/chapter/[id]`, `mastery/concept/[id]`, `recall`, `learn/concept/[id]` | `learner_node_state`, `pal_concept_mastery`, `pal_learner_content_exposure` | `GET /lms/pal/plan/chapter/{id}`, `/mastery/chapter/{id}`, `/recall`, `/learn/concept/{id}`, `POST /learn/concept/{id}/read` | JWT | `/pal/recall` is a menu screen (`module-screens.generated.ts:396`) | Mostly complete |
| Feedback stage | client-only projection of concept-result | `feedback/concept/[id]`, `NextStepCard`, `pal-feedback.ts` | — | `GET /lms/pal/adaptive/concept-result/{id}` | JWT | **Near-orphan**: only inbound link is a back-link from `intervention/concept` (`intervention/concept/.../page.tsx:400`) | Partially complete |
| ESO adaptive engine (D1-D5) | `EsoEngineController`, `EsoPolicyService`, `EsoPalRenderer`, `AiTutorContextService`, `CapabilityConfidenceService` | `eso/page.tsx`, `eso/chapter/[id]`, `ChapterDashboardView`, `eso/mastery/[id]`, `eso/knowledge-map/[id]`, `eso/learning-path`, `AiTutorPanel` | `pal_concept_nodes`, `learner_node_state`, `eso_response_log`, `eso_decision_log`, `pal_question_metadata`, `answer_master`, `lms_concept`, `pal_concept_relations`, `pal_learning_evidence` | 17 routes, see section 5 | `pal.auth` + **`eso.student`** (student only) | `/pal/eso`, `/pal/eso/learning-path` module screens; chapter names on `/pal` | Complete UI; **content only for tenant 1**; integrity gaps (AI-A04) |
| Practice / review schedule / history modals | `assessmentQuestionController` | `PracticePanel.tsx` (mounted from `/pal` chapter rows and `/pal/result`) | `lms_online_exam_answer`, `lms_concept_mastery(_log)`, `lms_forgetting_curve` | `GET /lms/adaptive-practice`, `POST /lms/submit-practice`, `GET /lms/spaced-repetition`, `GET /lms/practice-history` | **none (unauthenticated routes)** | — | **Broken authz** (AI-A02), logic bugs (AI-A16) |
| Concept diagnostic assessment (DOK) | same controller | `DiagnosticPanel.tsx` | same | `GET /lms/diagnostic-assessment`, `POST /lms/submit-diagnostic-assessment` | none | **unreferenced** (dead) | Deprecated / dead code |
| Prerequisite gate | same controller | `ChapterRow` in `page.tsx` | `lms_knowledge_graph` | `GET /lms/chapter-gate` | none | — | UI-only lock (AI-A29) |
| Pedagogy suggested content / misconceptions | `palController@getPedagogySuggestedContent/misconception/generateMisconceptionContent/incrementContentVisit` | `PedagogyModal`, `MisconceptionModal` in `page.tsx` | `suggested_content`, `content_master`, `lms_online_exam_answer_student` | `GET /lms/pedagogy-suggested-content`, `GET /lms/misconception`, `POST /lms/misconception/generate-content`, `POST /lms/increment-content-visit` | JWT | modals | Mostly complete (AI-A14, AI-A19) |
| Intervention (Tier-2 support) | **none** (`grep intervention routes/*.php` = 0) | `intervention/page.tsx`, `intervention/concept/[id]`, `pal-intervention.ts` | — | `GET/POST/PATCH /api/pal/intervention*` -> 404 | — | `/pal/intervention` module screen | **UI-without-backend** (AI-A20) |
| Frameworks / ULU / Pedagogy Engine pages | `PedagogyEngineController` (Laravel, unauthenticated read-only), semantic intelligence via Next handlers | `frameworks`, `ulu`, `pedagogy-engine`, `PalContentView`, `PalTaxonomy*` | `semantic_intelligence` | Next `GET /api/pal/content-model`, `GET /api/pal/pedagogy-engine` (both unauthenticated) | none | New PAL menu | Skimmed only; sibling part |
| `_dev-preview/diagnostic-summary` | — | mock page | — | — | — | **unroutable** (Next treats `_folder` as private) | Dead |

Flags: backend-without-UI: `POST /lms/update-forgetting-curve`, `/lms/track-content-view`, `pilot/metrics`, `reports/blueprint-feasibility` (no student UI). UI-without-backend: intervention. Duplicate modules under different names: chapter diagnostic vs DOK diagnostic assessment vs concept diagnostic vs ESO diagnostic (four "diagnostics", two scoring engines, two mastery stores: `lms_concept_mastery` vs `learner_node_state`/`pal_concept_mastery`); `pal_adaptive_response` vs `eso_response_log`.

###### 2b. Page-by-page status (every `page.tsx` in slice)

| Route | Status | Reachable from |
|---|---|---|
| `/pal` | Complete | menu (`routeMapper`), StudentDashboard |
| `/pal/exam` | Complete UI / broken integrity | `/pal` "Start quiz", `/pal/result` "Next quiz" |
| `/pal/result` | Complete | after exam submit |
| `/pal/plan/chapter/[chapterId]` | Complete | `/pal` "Learning journey" (students) |
| `/pal/diagnostic/chapter/[chapterId]` | Complete | `/pal` button |
| `/pal/diagnostic/chapter/[chapterId]/history` | Complete | link on diagnostic page |
| `/pal/diagnostic/result/[attemptId]` | Complete | after submit |
| `/pal/adaptive/chapter/[chapterId]` | Complete | diagnostic result "Continue", plan |
| `/pal/adaptive/concept/[conceptId]` | Complete | adaptive chapter cards |
| `/pal/adaptive/concept/[conceptId]/result` | Complete (scoping bug AI-A17) | after submit |
| `/pal/learn/concept/[conceptId]` | Complete | `router.replace` from ESO teach/reteach; intervention page |
| `/pal/feedback/concept/[conceptId]` | Partial / near-orphan | back-link only |
| `/pal/mastery/chapter/[chapterId]` | Complete | `/pal` (completed chapters), plan, learn |
| `/pal/mastery/concept/[conceptId]` | Complete | adaptive chapter (completed), plan |
| `/pal/recall` | Complete (node-level rows) | menu screen, plan/mastery links |
| `/pal/eso` | Complete | `AdaptiveLearningButton`, dashboards |
| `/pal/eso/chapter/[chapterId]` | Complete (empty-state bug AI-A11) | `/pal` chapter name (students) |
| `/pal/eso/mastery/[conceptId]` | Complete | chapter dashboard |
| `/pal/eso/knowledge-map/[conceptId]` | Complete | mastery page |
| `/pal/eso/learning-path` | Complete | StudentDashboard link, menu screen |
| `/pal/intervention`, `/pal/intervention/concept/[conceptId]` | Partial (read-only, backend missing) | menu screen; NextStepCard |
| `/pal/framework`, `/pal/framework/ulu` | Shims (redirect) | legacy links |
| `/pal/frameworks`, `/pal/frameworks/[slug]`, `/pal/ulu`, `/pal/ulu/[slug]`, `/pal/pedagogy-engine` | Not deeply reviewed | New PAL menu |
| `/pal/_dev-preview/diagnostic-summary` | Dead / unroutable | none |

---------------------------------------------------------------------------------------------------------------------------

#### Sub-part B - New PAL (gamification, content model, administration, coherence map, pedagogy engine), reports

| Module | Backend (Laravel controller/route or Next api) | Frontend pages/components | DB tables (if traced) | API endpoints | Permissions/roles | Menu entry | Status |
|---|---|---|---|---|---|---|---|
| New PAL overview | `NewPalContentModelController::coverage` via `GET /api/pal/new/content-model/coverage` (`routes/pal_api.php:237`) | `app/pal/new/page.tsx` | `semantic_intelligence`, `pal_cm_node_overrides` (traced by name only) | see sect. 5 | server `denyStudents` (is_student) only; no client gating | `new_pal.index` -> `/pal/new` (`app/data/routeMapper.ts:257`) | Complete |
| Gamification (overview, personal-best, badges, streaks, team-challenges, career-quest, challenge-mode, session-summary) | `NewPalGamificationController` + `App\Services\PAL\Gamification\*` (`routes/pal_api.php:376-426`) | `app/pal/new/gamification/**` (9 pages+layout), `_components/*`, `data/gamification.ts` | `pal_learner_badges`, `pal_personal_bests`, `pal_streak_days`, `pal_learner_streaks`, team-challenge, challenge-mode tables (migration `2026_08_17_100000_create_pal_gamification_tables.php`) | 12 GET + 7 POST consumed; 9 backend-only (see sect. 5) | server: `pal.auth` learner ownership + `GamificationVisibility` audience matrix; teacher-only actions gated by `role !== student` only | `new_pal.gamification` -> `/pal/new/gamification` (routeMapper:289); DashboardShell L3 item `pal-gamification` | Mostly complete (functional gaps: AI-B08, AI-B11) |
| Content model (chapters/concepts/nodes/review/authoring/misconceptions) | `NewPalContentModelController`, `ContentModelAuthoringService` (`routes/pal_api.php:231-286`) | `app/pal/new/content-model/**` (6 pages), `MisconceptionCard`, `data/content-model.ts` | `semantic_intelligence` (read), `pal_cm_node_overrides`, `pal_cm_node_revisions`, `pal_cm_enrichment` | 14 consumed; 8 backend-only (ladder, revisions, 6 concept-video routes) | server: students denied; ANY other staff may author/approve (AI-B03) | `new_pal.content_model` -> `/pal/new/content-model` | Mostly complete |
| Concept videos (reteach library) | `ConceptVideoController` (`routes/pal_api.php:261-270`) | none | `concept_videos` (name from model, not traced) | 6 routes, 0 consumed | tenant-scoped + students denied (correct) | none | Backend-without-UI |
| Legacy Content Intelligence (`/pal/content*`) | `PalContentIntelligenceController` (`routes/pal_api.php:186-224`) | `app/pal/content/{page,review,misconceptions}` + `app/pal/data/pal-content.ts` | `pal_question_metadata`, `pal_content_metadata` | 9 consumed | students denied on writes; tenant check missing/late (AI-B02) | `pal_content.*` routeMapper:245-250 | Mostly complete, authz defects |
| Administration (9 architecture subsystems) | `PalArchitectureController`, `ArchitectureRegistry` (`routes/pal_api.php:293-303`) | `app/pal/new/administration/**`, `AdministrationChrome/Panels/KnowledgeGraphView`, `data/administration.ts` | `pal_architecture_settings` | 4 consumed | students 403; write = `is_admin > 0` only (AI-B06) | `new_pal.administration` (routeMapper:284) + L3 item | Mostly complete, audit/authz defects |
| Coherence Map | `CoherenceMapController`, `CoherenceMapRepository` (Neo4j) (`routes/pal_api.php:158-179`) | `app/pal/new/coherence-map/page.tsx`, `CoherenceMapView`, `data/coherence-map.ts` | Neo4j graph + `tblstudent_enrollment`, `standard`, `sub_std_map` | 3 consumed (scopes, map, health); learner/next/remediation/evidence have client fns (2 exported, unused) or none | no student deny; tenant dropped on `/map` (AI-B05) | NO `routeMapper` entry, NOT in `NEW_PAL_LEVEL3_ITEMS` (reachable via /pal/new card + NewPalNav only) | Partially complete / Broken when Neo4j auth fails (known) |
| Pedagogy Engine | `PedagogyEngineController` (api/PAL) + `PedagogyEngineService` + `SemanticIntelligenceSource` (`routes/pal_api.php:31-37`, PUBLIC) | `app/pal/pedagogy-engine/**`, Next proxy `app/api/pal/pedagogy-engine/route.ts`, `app/pal/data/pedagogy-engine.ts` | `pedagogy_engine_*` tables, `semantic_intelligence`, `pal_learning_sessions` | 1 consumed (`GET /api/pal/pedagogy-engine`) | NONE (unauthenticated end to end) - AI-B01 | `new_pal.pedagogy_engine` (routeMapper:270) | Complete functionally / insecure |
| Framework / ULU views | none dedicated: Next SSR calls `GET /api/semantic-intelligence*` (public) through `app/pal/data/pal-content-model.ts` -> self-call `/api/pal/content-model` | `app/pal/frameworks/**`, `app/pal/ulu/**`, `app/pal/framework/**` (redirects), `app/pal/_components/PalTaxonomy*Page` | `semantic_intelligence`, `document_extractions` | 2 public GETs | NONE | `new_pal.frameworks` (moved under Curriculum), `new_pal.ulu` | Complete / insecure (AI-B01, AI-B13). `framework/ulu` + `framework` are legacy redirect shims |
| ULU authoring API (create/update/delete/approve) | `PALAPIController::{createULU,updateULU,deleteULU,duplicateULU,archiveULU,approveULU}` (`routes/pal_api.php:108-117`) | NONE in my slice (frontend reads `api/pal/ulu`, `/ulu/{id}`, preview, analytics via `pal-v4.ts:736-818` only) | `unified_learning_units` | 0 write endpoints consumed | students denied only (AI-B04) | n/a | Backend-without-UI |
| Content framework-metadata API | `PALAPIController::updateContentFrameworkMetadata` (`routes/pal_api.php:103-104`) | none | `content_master` | 0 consumed | NO role check (AI-B04) | n/a | Backend-without-UI |
| PAL Intelligence (learner dashboard) | `PALAPIController` learner-state / velocity / plateau / regression / *-risk / misconception cluster / remediation | `app/pal/intelligence/page.tsx` + `app/pal/data/pal-v4.ts` | `pal_competencies`, `pal_learning_sessions` etc. (not traced) | 9 GET | `pal.auth` learner ownership; no student deny on risk/percentile (AI-B19) | none in shell (legacy `/pal` family) | Complete |
| PAL Report (attempts list) | `palController::palreport` (`GET /lms/palreport`, `routes/lms.php:222`, `session,menu,logRoute,check_permissions`) | `app/pal/report/page.tsx` + `pal.ts:101` | `question_paper`, `lms_online_exam`, `tblstudent`, `tblstudent_enrollment` | 1 | menu-permission only (tenant from JWT) | `palreport.index` routeMapper:193 | Complete, data-quality defects (AI-B15) |
| Coverage & Attainment report | `AttainmentReportController::attainment` (`GET /api/pal/eso/reports/attainment`) | `app/pal/reports/attainment/page.tsx` + `pal-eso.ts:1534` | not traced | 1 (+ roster `GET /api/pal/workspace/students`) | staff only, institute from token (correct) but not class-scoped | `new_pal.reports` routeMapper:279 | Complete |
| Personalize Marks (offline exam marks entry) | `resultPersonalizeMarksController::store` (`POST /result_personalize_marks`), `resultAPIController::resultPersonalize` (GET) | `app/pal/personalize-marks/page.tsx` + `pal.ts:1667-1751` | `result_personalize_marks` | 2 | menu-permission only; no validation (AI-B14) | not in routeMapper grep (unverified) | Partially complete |
| New PAL AI Stack | shared AI runtime `/api/ai/*` (other part) | `app/pal/new/ai-stack/*`, `lib/new-pal/new-pal-ai-stack.ts`, `lib/module-ai/module-ai-stack.ts`, shared `app/_components/ai-stack/*` (NOT in slice) | `ai_modules`, `ai_templates`, agents | via `lib/intelligence/ai-module.ts` | per-AI-runtime (other part) | `new_pal.ai_stack` (routeMapper:294), L3 item | Complete (declarative) |

Flags: backend-without-UI = concept videos (6 routes), ULU writes, framework-metadata, badges revoke/detail/earned, team-challenge GET-one/PUT, challenge-mode submit + class-availability, career-quest progress, gamification specification, content-model ladder route, coherence learner/next/remediation/evidence. UI-without-backend: none found. Menu/link problems: Coherence Map has no routeMapper entry and no shell L3 item; NewPalNav `SUB_MODULES` lists 3 sub-modules while the shell lists 6 (and DB has 7 per NewPalNav's own comment) - navigation is duplicated and inconsistent (AI-B22). Duplicate modules: legacy `/pal/content/*` vs `/pal/new/content-model/*` (two review queues over different tables and different tenancy rules).

---

#### Sub-part C - Enterprise Brain, Capability Intelligence, Career modules, People & Competency

| Module | Backend (Laravel controller/route or Next api) | Frontend pages/components | DB tables (if traced) | API endpoints | Permissions/roles | Menu entry | Status |
|---|---|---|---|---|---|---|---|
| Brain — Overview/Executive dashboard | `BrainIntelligenceController::executive`, `::intelligence/classes` (`routes/brain.php:205-208`) | `enterprise-brain/page.tsx` | tblstudent, attendance_student, homework, hpbrain_* | GET `/api/brain/{t}/executive`, `/intelligence/classes` | JWT + `brain.permission:read` = every authenticated LMS user | Injected in `DashboardShell.tsx:325-357` (code-declared, not DB menu) | Mostly complete — real data; auth too open (AI-C01) |
| Brain — Foundation: Departments / People / Students | `BrainController::departments/people`, `BrainIntelligenceController::students/studentIntelligence/teacherIntelligence` | `foundation/{departments,people,students}/page.tsx` | hrms_departments, tbluser, tblstudent | GET `/departments`, `/people`, `/students`, `/intelligence/{departments,teachers,students/{id}}` | read (all users) | same | Mostly complete; PII leak (AI-C01); departments page blank on error (AI-C30) |
| Brain — Capabilities (+ detail) | `BrainController::capability*` | `capabilities/page.tsx`, `[id]/page.tsx` | hpbrain_capabilities/_assignments/_tasks/_versions, hpbrain_capability_proficiency (NO writer) | GET/POST/PATCH `/capabilities`, POST/DELETE `/capabilities/{id}/assign` | read / create / update / delete | Foundation → Capabilities | Partially complete: proficiency panel can never have data (AI-C17); create/edit buttons shown to all roles |
| Brain — Ingestion | `BrainController::ingestion/ingestionRun` → `FoundationIngestor` | `ingestion/page.tsx` | s_users_skills, competency → hpbrain_capabilities | GET `/ingestion`, POST `/ingestion/run` | read / create (analyst+) | Foundation → Ingestion | Complete; client-controlled `limit` (AI-C36); re-ingest overwrites UI edits |
| Brain — Intelligence Loop (signals/evidence/deliberation/workspace/executions) | `BrainIntelligenceController::intelligence/signalShow`; registry screens via `BrainController::screen` | `intelligence-loop/page.tsx` + 5 stub wrappers | hpbrain_signals/_evidence/_cases/... | GET `/intelligence`, `/signals/{id}`, `/screens/{key}`; POST `/intelligence/run` | read / create | Intelligence Loop section | Mostly complete |
| Brain — Automation (decisions, executions) | `BrainIntelligenceController::decide/executionComplete/automation/recommendations` | `automation/page.tsx` | hpbrain_recommendations/_decisions/_eso_executions/_outcomes | GET `/automation`, `/recommendations`; POST `/recommendations/{id}/decide`, `/executions/{id}/complete` | `update` only (analyst can approve) | Automation | Mostly complete; authz gap (AI-C05) |
| Brain — Agent Management (agentic library) | **Next** `app/api/agents/*` + `lib/agents/*` (JSON file store `.data/agents.json`) | `automation/agents/page.tsx`, `_components/*` | none (file) | GET/POST `/api/agents`, GET `/api/agents/runs`, PATCH `/api/agents/{id}`, POST `/api/agents/{id}/run` | Headers only; Laravel `/api/permissions` checked for writes | Automation → Agent Management | Partial: works but critically insecure (AI-C03/04); file store ephemeral on serverless |
| Brain — Conversational AI admin | **Next** `app/api/conversational-ai/*` | `automation/conversational-ai/page.tsx` | file store (global, not tenant-scoped) | GET `/api/conversational-ai/projects`, PUT settings, POST token | token presence + Laravel `conversational_ai` update right | NOT in `BRAIN_SECTIONS` (orphan route) | Partial; orphan; global tokens (AI-C04) |
| Brain — Task Orchestrator / Policies / ESO Library / Knowledge Library / Memory / Executive/Decision analytics / Mental models | `BrainController::screen` over `ScreenRegistry` | 12 five-line `ScreenView` wrappers | many hpbrain_* tables, several with no writer | GET `/screens/{key}`, `/sections/{s}` | read | Brain nav | Stub-ish: render tables that are mostly empty (AI-C17) |
| Brain — Analytics | `BrainIntelligenceController::analytics` → `LmsAnalytics` | `analytics/page.tsx` | LMS tables | GET `/analytics` | read | Analytics | Mostly complete (real aggregates) |
| Brain — Knowledge dashboard / Graph Explorer / KASBA Explorer | `::knowledge`, `::graph`, `BrainController::kasba` | `knowledge/page.tsx`, `graph`, `kasba` | hpbrain_knowledge_assets/_mental_models (pipeline-written), hpbrain_capabilities | GET `/knowledge`, `/graph`, `/kasba` | read | Knowledge | Mostly complete |
| Brain — "AI Assistant" | `BrainController::aiAssistant`, `::search` | `knowledge/ai-assistant/page.tsx` | hpbrain_conversation_*, _ai_executions, _prompt_templates (NO writers), tbluser | GET `/ai-assistant`, `/search` | read | Knowledge → AI Assistant | **Broken/Stub**: not an assistant, sends nothing to any model; `/search` leaks full user rows (AI-C02) |
| Brain — Settings | `BrainController::settings/settingsUpdate` | `settings/page.tsx` | hpbrain_settings (no reader), hpbrain_api_keys (no writer), hpbrain_audit_logs | GET/PUT `/settings` | read / `settings.manage` | Account | Partial: dead key-value store; API keys read-only (AI-C17) |
| Brain — Governance | none | `governance/page.tsx` | — | — | client `canSeeInternalItems()` | hidden section `audience:'internal'` | Stub (intentional placeholder) |
| Capability Intelligence — Command Center dashboard | `CompetencyCommandCenterController` → `CommandCenterService` (`routes/competency_management.php:191-192`) | `dashboard/components/command-center.tsx` | s_user_jobrole, s_user_skill_jobrole, s_users_skills, s_competency_* | GET `/api/competency/command-center[/filters]`; POST `/competency/{competencies,frameworks,assessments,certifications,development-plans,role-map}` | api.session + staff.only | routeMapper `capability_intelligence.dashboard` | **Partially complete / Broken parts** (AI-C08/09/10/27) |
| Capability Intelligence — Competency Framework Studio | `CompetencyStudioController`, `CompetencyFrameworkController`, `RoleMappingController`, `MappingReviewController`, `CompetencyRoleMapController` | `competency-framework/**` | s_competency_frameworks/_weights, s_proficiency_levels, jobrole_competency_map | `/competency/{studio,frameworks,role-mapping,mapping-reviews,role-map}` | staff.only (any staff) | `capability_intelligence.competency_framework` | Partially complete: weighting/scale are dead config (AI-C11) |
| Capability Intelligence — Competency Library | `CompetencyLibraryCrudController`, `CompetencyApprovalController` | `competency-library/**` | competency, competency_kasba_item, s_competency_approvals | `/competency-library/*`, `/competency/approvals` | staff.only | `capability_intelligence.competency_library` | Mostly complete; Status/Category filters are server no-ops (AI-C20) |
| Capability Intelligence — Capability Library (skills/jobroles/KASA) | `CapabilityLibraryController` | `capability-library/**` | s_users_skills, s_user_jobrole, s_jobrole_skills, s_skill_knowledge_ability | `/competency/library/*` | staff.only | `capability_intelligence.capability_library` | Mostly complete; AI course builder + skill detail modal 404 (AI-C21) |
| Capability Intelligence — Capability Explorer | none (external) | `capability-explorer/components/taxonomy-ontology.tsx` | n/a | iframe `https://skill-ontology-neo4j.vercel.app/?sub_institute_id=` | client | `capability_intelligence.capability_explorer` | **Stub / demo data** (AI-C19) |
| Career Explorer (occupation/college/courses/employers/expert/sector) | `lmsCounsellingController::careerCluster/careerExplore/careerExploreResult/allOccupation/OccupationDetails/getInstituteData/getCourseData/getEmployerData/ExpertAdvice/ExploreSector` (`routes/lms.php:380-389`, NO auth middleware) | `career-explorer/**` via Next `/api/proxy` | onet_* tables, onet_explore_sector, onet_expert_advice, OnetEmployer | 10 public GETs | none (public) | routeMapper `career_explore.*`, `education` | Mostly complete; public endpoints (AI-C06); unsanitised HTML (AI-C14); placeholders (AI-C32) |
| Career Counselling — Knowing Yourself (RIASEC) | `intrestQuestions`, `intrestResults` (O*NET proxy w/ org credentials, NO auth) | `career-counselling/knowing-yourself/**` | none (not persisted) | GET `intrestQuestions`, `intrestResults?answers=` | none | routeMapper `career_counselling/knowing-yourself` | Mostly complete; result never stored (AI-C34) |
| Career Counselling — Interest Profile (counselling courses) | `lmsCounsellingController::index` (`lms/lmsCounselling`, session) | `career-counselling/interest-profile/**` | counselling_course, counselling_online_exam | GET `lms/lmsCounselling` | session (tenant/user from token) | routeMapper | Mostly complete; unsanitised HTML (AI-C14) |
| Career Awareness (certainty/ambition/alignment/originality) | Endpoints EXIST: `studentAspiration`, `studentAmbition`, `studentOriginality`, `careerAlignment` (`routes/lms.php:402-421`) | `career-awareness/**` — static text only | student_aspirations/_ambitions/_career_originalities | **none called from these pages** | — | routeMapper `career_awareness.*` | **Stub / Missing** (AI-C13) |
| Career Intelligence (plan / match / evidence) | `studentAspiration`, `careerAlignment`, `studentCareerEvidence`, `careerRecommendation`, `allOccupation` | `career-intelligence/**` | student_aspirations, evidence_events, onet_knowledge, Neo4j (CaiCore) | 5 endpoints via `/api/proxy` | session; cross-student needs `is_admin` 1\|2 | routeMapper `career_counselling*`, `career_intelligence*` | Partially complete (ambition/originality static cards; alignment only for one occupation) (AI-C13/24/25) |
| People & Competency — LMS (9 screens) | `routes/g2g_lms.php` (`api.session`+`staff.only`) | `people-competency/lms/**` → `components/domain/lms/*` | lms_assignments, sub_std_map, ... | `/api/g2g-lms/*` | staff.only; some `guardAdminOrHr` | routeMapper `g2g_lms.*` | Mostly complete; bulk actions mis-target (AI-C07) |
| Capability / Talent intelligence contracts | `BrainCapabilityIntelligenceController`, `BrainTalentIntelligenceController` (`routes/brain.php:184-187`) | `components/intelligence/module/contracts/{capability,talent}.ts` | s_user_jobrole ... | GET `/capability/intelligence`, `/talent/intelligence`, POST `.../run` | read / create | module Intelligence tab | Complete (presentation contracts); join differs from Command Center (AI-C10) |

Flags:
- **Backend-without-UI:** Brain `GET navigation`, `overview`, `foundation`, `signals` (list), `capabilities/{id}/versions` (no such route); Laravel `matchProfile`, `intrestEnterScore`, `intrestArea`, `intrestCareers`, `intrestJobzone`; `studentAmbition`, `studentOriginality` (GET/POST) — no page calls them; `CommandCenterService` degraded assessment tables.
- **UI-without-backend:** `fetchModuleIntelligence` → `GET /api/brain/{t}/modules/{m}/intelligence` (no route, no `moduleIntelligence` method — AI-C18); Command Center quick-create `POST /competency/competencies` and `/competency/assessments` (AI-C09); `GET /api/skill_library/{id}/edit` and `/api/lms/ai/{status,outline,presentation}` (AI-C21).
- **Menu/links to wrong pages:** Command Center "View all/details" tiles route `cm-framework-mapping`, `cm-assessments`, `cm-development-career`, `cm-audit` all to `/capability-intelligence/competency-library` although `/capability-intelligence/competency-framework` and `/talent-management/development-and-career-paths` exist (`command-center.tsx:112-117`).
- **Duplicate modules under different names:** four "capability" stores (hpbrain_capabilities / s_users_skills / competency / s_competency_*), three "career" modules + `career-awareness` (AI-C29).

---

#### Sub-part D - AI console, workspace tabs, platform services, integration, migration modules, roadmap

Legend: backend "L:" = Laravel, "N:" = Next route handler. All Laravel `/api/ai/*` routes sit behind `McpAuth + McpRateLimit + McpContextHydrator` (JWT required; tenant from JWT; **no role/permission middleware on any of them**).

| Module | Backend | Frontend pages/components | DB tables (traced) | API endpoints | Permissions/roles (frontend / backend) | Menu entry | Status |
|---|---|---|---|---|---|---|---|
| AI & Intelligence console (`/ai`, `/ai/[capability]`) | L: `CapabilityController` (read-only) | app/ai/page.tsx, [capability]/page.tsx, CapabilityShell, CapabilityLiveData | reads counts of ai_* tables | GET /api/ai/capabilities, /capabilities/{slug} | none / McpAuth only | Header "AI & Intelligence" (shown to every user) | Partially complete. Status chips are static registry text (AI-D18). |
| AI Providers (`/ai/providers`) | L: `AiConfigurationController` | ConfigurationManager, ModelManager (models) | ai_api_keys (plaintext api_key), ai_models | GET/POST /configuration, PUT/DELETE /configuration/{id}, GET/POST/PUT /configuration-models | none / **none** (AI-D01, AI-D21) | Header + tblmenumaster `ai_intelligence.providers` | Complete UI; unsafe backend |
| Model Management (`/ai/models`) | same + `AiModuleModelController` | ModelManager, ModuleModelOverrides | ai_models, ai_module_model_bindings | /configuration-models*, /modules/{m}/models*, /modules/{m}/models/credentials* | none / none | Header | Complete UI; unsafe backend |
| Template/Prompt Management (`/ai/prompts`, `/new`, `/[id]`, `/[id]/edit`) | L: `AiTemplateController` | TemplateList/Form/View | ai_templates, ai_suggestions | GET /templates/options, /templates/catalog, POST /templates/preview, POST/PUT/DELETE /templates[/{id}] | none / none | Header | Complete UI; unsafe backend (prompts are what the model is told) |
| Policies (`/ai/policies`) | L: `AiPolicyController`, `AiPolicyResolver` | policies/page.tsx | ai_policies, ai_policy_rules, ai_policy_assignments | /policies/options, GET/POST /policies, PUT/DELETE /policies/{id} | none / none | Header | UI complete; **enforcement partial** (AI-D11/13/14). Registry says "coming-soon" (AI-D18). |
| Usage & Cost / Guardrails / Audit (`/ai/usage-cost`, `/guardrails`, `/audit`) | L: `AiModuleController` (usage, guardrails, activity) | pages + ModulePicker | ai_conversations, ai_generation_*, ai_audit_logs | GET /modules/{m}/usage, /guardrails, /activity; POST /modules/{m}/activity | none / none | Header | UI complete (read). Registry says "coming-soon" for all three (AI-D18). POST activity is client-asserted audit (AI-D16). |
| Domain agent panel (used by `/enterprise-brain/automation/agents`) | L: `AgentController`, `/ask/modules` | DomainAgentPanel.tsx | ai_agents, workflow_definitions | GET /ask/modules, /agents, /agent-runs, /approvals/pending | none / agent manifest `allowed_roles` (admin/staff) | via Enterprise Brain menu | Complete (read-only). Failures silently rendered as empty (AI-D28). |
| AI workspace tabs Create / Analyse / Actions / Connections (+ Flow) | L: `WorkspaceController` | app/components/ai-workspace/* (mounted from ChatbotPanel, lead's slice) | ai_recommendations, ai_decisions, workflow_*, ai_generation_* | POST /workspace/{context,flow,workflow-status,generate,report,agents/{a}/run,workflows/{w}/start,ontology-views/{v}} | student: agent/workflow capabilities hidden in UI only (`applyRoleLimits`) / none on endpoints | (panel) | Mostly complete; approval path has authz + state gaps (AI-D04..06, AI-D12) |
| AI journey (`/ai-journey`) | L: `AskController`, lifecycle stages | ai-journey/page.tsx, LifecycleTrace, AnswerSections | ai_conversations, lifecycle tables | POST /ask (buttons = next question + pinned payload) | none / none (policy check only) | menu-driven only (module-screens.generated.ts:60) | Complete; approve button = `/ask` → `HumanApprovalStage` → `DecisionGate` |
| Saved AI reports (`/ai-reports/[id]`) | L: `ReportController`, `ReportSender`, `AiReportGenerator`, `GeneratedReportStore` | ai-reports/[id]/page.tsx | ai_generated_reports, template_master (legacy) | GET/POST /reports/{id}, POST /regenerate, GET /recipients, POST /send | none / none | link from generate tool / AI Stack templates tab | Complete; XSS-safe render; authz gap (AI-D07/08) |
| AI platforms (`/ai-platforms`) | none | ai-platforms/page.tsx | — | none | none | menu-driven only | Static marketing directory of 6 external vendors (Gamma, DeepSeek, Midjourney, Claude, Gemini, Runway). Not an AI feature of this product. Distinct from `/ai`, `/platform-services`, `/platform-roadmap`. |
| Platform services: Notification / Scheduler / Workflow (`/platform-services/*`) | L: `api/Platform/{Notification,Scheduler,Workflow,Registry}Controller` | platform-services/*/_components | platform_notification_channels, platform_notification_preferences, platform_scheduled_tasks, platform_workflows | GET /api/platform/registry, /notifications, /scheduler, /workflow; PUT /notifications, /notifications/channels, /scheduler; POST/PUT/DELETE /workflow | UI `usePermissions` (cosmetic) / `perm:` warn-only by default (AI-D09) | Header "Platform Services" | UI complete; **backend stores config nothing consumes** (AI-D17) |
| Platform services: Event Bus (`/platform-services/event-bus`) | L: `api/Platform/EventBusController` + `EventBusReader` | EventBusConsole, tables, kpi-row, volume-chart | sync_log, ai_audit_logs, workflow_runs/steps, failed_jobs, whatsapp/sms/email send logs | GET /api/platform/events/{overview,stream,failures,deliveries,audit,integrations} | UI: banner "Admin accounts only" / `lms.staff` + `perm:platform.eventbus,view` (warn-only) + `is_admin===2` for estate-wide | Header | Mostly complete. Consumers tab is hard-wired "not connected" (`fetchConsumers` rejects, lib/event-bus/client.ts:176). |
| Platform roadmap (`/platform-roadmap`) | none | platform-roadmap/page.tsx | — (static `lib/roadmap/registry.ts`) | none | build flag `NEXT_PUBLIC_SHOW_INTERNAL_ROADMAP` | Header "What's Coming" | Complete; **data is hard-coded** (AI-D18) |
| Platform administration (`/platform-administration`) | none | platform-administration/page.tsx | — (same registry) | none | same flag | Header "Platform Services" heading link | Complete; shows a derived "X of Y available today" from hard-coded statuses |
| Integration (`/integration` + 6 children) | Real for 4 (SMS/WhatsApp/SMTP via `app/easy_com/*` pages, Razorpay via `app/fees/online-fees-settings`); **Next in-memory fake** for 2 (push_notification, biometric_attendance) and for the card status grid | integration/* (8) + task-management components | none persisted for fake ones | N: /api/integration-configs (GET/POST), /[id] (GET/PUT/DELETE), /test (POST) | `canAdminister` = client `isAdmin` flag / **no real auth** (AI-D02) | Header "Integration" | Broken/Stub for fake half (AI-D02) |
| Engagement / Interactions / Mobile Apps AI Stack (`/engagement|interactions|mobile-apps/ai-stack`) | L: MCP tools `engagement.*`, `interactions.list/summary`, `mobile_apps.homescreen/sections` (verified to exist) + shared `/api/ai/*` | 3 thin pages + 3 screen files + 3 `lib/*-ai-stack.ts` descriptors | interaction_logs (interactions); computed for engagement; mobile-app config tables | via shared AI Stack tabs | none | `/modules/<slug>/ai-stack` (menu rows) | Mostly complete (shared tabs NOT reviewed) |
| Migration modules (`/migration-modules/[module]` + 10 legacy-named pages: `learning-outcome/lo-master`, `indicator-mapping`, `reports`, `reports/students-marks`, `reports/broken-link-finder`, `reports/dynamic-report-builder`, `reports/nomenclature`, `settings/biomatrix`, `academic_setup/subject-elective-mapping`, `bazar/bulk-upload-report`) | L: `MigrationModulesApiController` (index/store/destroy) | MigrationModulePage.tsx (generic read-only table) | learning_outcome_indicator, learning_outcome_question_master, biomatrix, subject_elective, sharebazar_*, report_module*, result_marks | GET/POST/DELETE /api/migration-modules/{module}[/{id}] | none / JWT only (AI-D03) | legacy menu rows | Partially complete: UI is a read-only table; 2 of 10 pages can never show data (AI-D19) |
| Concept Intelligence tabs (component in `components/intelligence`) | L: `ConceptIntelligenceTabLabelApiController` | ConceptIntelligenceTabs.tsx (mounted from `app/course-master/[courseId]/chapters/page.tsx`) | lms_concept_intelligence_tab_labels | POST /api/lms/concept-intelligence/tab-labels[/update|/reset] | none / **none** (AI-D10) | course-master chapters | Complete; unauthenticated writes |
| Module Intelligence framework (`components/intelligence/module/*`, 25 contracts, 22 module routes) | L: `Brain*IntelligenceController` (routes/brain.php, `brain.auth`+`brain.tenant`+`brain.permission`) | ModuleIntelligence.tsx, sections, primitives | hpbrain_* | GET /api/brain/{tenant}/…; POST recommendations/{id}/decide; POST executions/{id}/complete | UI: none / `brain.permission:update` | `/modules/<slug>/intelligence` | Mostly complete; decide/complete not idempotent (AI-D05) |
| conversational-ai-core package | none | `packages/conversational-ai-core/src` (2 files) | — | — | — | — | Stub vs docs (AI-D24). `file-store.ts` has zero callers. |
| ai-intelligence-core package | none | index/solutions/registry | — | — | — | Header AI menu + /ai table | Complete as a static registry; content stale (AI-D18) |
| template-engine.ts / admission-document.ts | L: MCP tools `admissions.*`, `ai.templates.render` | lib only | — | via `callMcpTool` | — | — | **Dead code**: template-engine functions have no caller; admission-document consumed only by `components/templates/DocumentFrame.tsx` (AI-D27) |
| AiInsightsPanel + EvidenceList/ExplanationCard/OutcomeTimeline | `/api/ai/subjects`, `/cases`, `/recommendations` | components/intelligence/* | — | — | — | — | **Orphan** (no importer) and reads a token key that does not exist (AI-D27) |

Flags requested by the brief:
- **UI without effective backend:** Platform Services Notification/Scheduler/Workflow config (AI-D17); Integration push_notification + biometric cards and card status grid (AI-D02); Dynamic Report Builder / Nomenclature / LO Master / Indicator Mapping pages (read-only table only) (AI-D19); Policy toggles disclosure/acknowledgement/AI-detection/plagiarism/module-scope (AI-D14); "Content you accepted … will be attached when you approve" (AI-D12).
- **Backend without UI:** `POST/DELETE /api/migration-modules/*` (no create/delete UI other than bazar upload); `/api/ai/approvals/pending` used only by DomainAgentPanel; `/api/ai/ontology/*`, `/knowledge-graph/*` (client.ts has wrappers, no page in slice uses them); `/api/ai/assistance/tickets` (app/api/ai/assistance-tickets proxies it).
- **Menus/links to missing pages:** `Template` menu item → `/general/coming-soon?module=Template` (Header.tsx `platformServicesRoutes`). `capabilityHref()` returns `/ai/<slug>` for slugs `agents|conversational-ai|knowledge-rag|recommendations|knowledge-graph|evaluation` → handled by `[capability]/page.tsx` (exists) but 6 capabilities render only a description + live count. `/ai/providers|models|prompts|policies|usage-cost|guardrails|audit` exist. `Header` "What's Coming"/"Platform Administration" exist. `registry.ts` hrefs `/enterprise-brain/automation/agents`, `/enterprise-brain/automation/conversational-ai`, `/enterprise-brain/governance` — first two exist, third NOT VERIFIED (not opened).
- **Duplicate modules under different names:**
  - Three roadmap/status surfaces fed by two registries that overlap on `ai.*`: `/platform-roadmap` and `/platform-administration` (`lib/roadmap/registry.ts`) vs `/ai` capability table (`packages/ai-intelligence-core/src/registry.ts`) vs Module-Intelligence `components/intelligence/module/registry.ts` (third status vocabulary: live/partial/planned + ladder L2–L5).
  - Three approval pipelines: `/api/ai/recommendations/{id}/approve` (DecisionGate → `ai_decisions`), `/api/ai/approvals/{id}/resolve` (WorkflowEngine → `workflow_approvals`), `/api/brain/{tenant}/recommendations/{id}/decide` (`hpbrain_decisions`). Two "workflow" concepts: `workflow_definitions/workflow_runs` (execution engine) vs `platform_workflows` (config UI, never executed — see AI-D17).
  - Three `RecommendationCard` implementations: `components/intelligence/RecommendationCard.tsx` (orphan), `components/intelligence/module/sections.tsx:495`, `app/fees/intelligence/_components/fees-intelligence-screen.tsx:913`.
  - `/ai-journey` (twelve-stage console) vs ChatbotPanel (same `/ask` API, lead's slice) vs Workspace tabs.
  - Six copies of `readSession()` (lib/intelligence/{ai-capabilities,ai-configuration,ai-generate,ai-module,ai-policies,ai-templates}.ts) plus `lib/ai/session.ts::readAiSession` plus `AiInsightsPanel` inline `localStorage.getItem('token')`.
  - `GET /api/ai/templates` (render list) vs `GET /api/ai/templates/catalog` (management list) — routes/ai.php:107-115 comment documents the collision.

---

### 3. Role / access-control findings (per module: frontend gating vs backend enforcement)

#### Sub-part E - Assistant panel, agent engine, event bus, catalogue, Laravel /api/ai cross-cut (lead auditor)

- Teach Assistant: no frontend gating except `canSeeInternalView()` (localStorage-derived) to show the stage ladder. Backend `McpAuth` sets role `student` / `admin` (is_admin>=1) / `staff` (everything else, including parents, drivers, accountants). Role-sensitive tools are resolved per role in AgentController (`permitsRole`) but none of the approval/config endpoints (AI-03, AI-04).
- Agent Management: rights come from Laravel `/api/permissions` for `agents.<module>` (good idea) but the call target and identity are header-controlled (AI-01, AI-02); `list*` has no rights check.
- Event Bus: well-gated on the backend (`lms.staff`, permission, estate-wide tier `is_admin===2`); `perm:` is warn-only by default (`LMS_API_AUTH_ENFORCE=false`, config/lms_content.php:144; live value NOT VERIFIED), `lms.staff` is not flag-dependent.
- Stuck-user tickets: read + screenshot are admin-only (`$scope->isAdmin`), verified. Creation open to all.
- Client-side role helpers: `lib/ai/adapters/shared-utils.ts` (`isAdminProfile` uses substring match on profile name incl. "management", "super") has no callers found; `lib/session/internal-access.ts` is the live one and is purely client-side.
- Sub-audit role/access sections follow.

#### Sub-part A - PAL / ESO student-facing adaptive learning

| Module | Frontend gating | Backend enforcement | Verdict |
|---|---|---|---|
| ESO routes (`api/pal/eso/*` learner-state) | `!isStaff` hides button (`page.tsx:668`); pages accept `?learnerId`/view-as | `pal.auth` (JWT, learner ownership) + `eso.student` (role must be student; route/body learner must equal JWT id) `EsoStudentOnlyAuth.php:37-63` | Strong for identity. Staff get 403 => view-as is inert here (AI-A21). No tenant/pool checks on node/answer ids (AI-A04). |
| `api/pal/eso/decision-log`, `chapter-concepts`, `reports/*` | none | `pal.auth` only (staff readable, scoped) | OK by design; students can read their own engine `state_snapshot`/`llm_instruction` (INFO). |
| `/lms/pal/*` (create/store/show/diagnostic/adaptive/plan/mastery/recall/learn) | `isStaff` toggles guest preview | `session` mw hydrates from JWT; `palController::resolveAuthorizedContext` ignores `user_id` for students, admin-only impersonation within own institute | Identity OK. **`show()` has no paper ownership check and a SQL injection** (AI-A01/03). |
| `/lms/adaptive-practice`, `/submit-practice`, `/diagnostic-assessment`, `/submit-diagnostic-assessment`, `/chapter-gate`, `/practice-history`, `/spaced-repetition`, `/lms/student-profile` etc. | `PracticePanel` not gated by role | **none** — registered at top level of `routes/web.php:87-134` (only `web` mw); `student_id`/`sub_institute_id` read from request | **Missing authentication and authorization** (AI-A02). |
| `POST /api/pal/submit` (Next BFF) | none | none (unauthenticated Next handler, target chosen by request header) | AI-A08. |
| Intervention API | staff-only controls in UI | route does not exist | UI-only (AI-A20). |
| `POST /lms/misconception/generate-content` | button shown to everyone incl. students | JWT identity only; no role/rate limit | AI-A19. |
| Prerequisite lock (`Locked` quiz button) | `disabled={locked}` | none on `/lms/pal/create` | AI-A29. |

#### Sub-part B - New PAL (gamification, content model, administration, coherence map, pedagogy engine), reports

Frontend facts. There is no route guard (no `middleware.ts`). The only client role logic in this slice is `isStudentSession()` (reads `user_profile_name === 'student'` from localStorage, `app/pal/data/pal-lookups.ts:39`), used to (a) hide the student picker (`GamificationScope.tsx:104,130`) and (b) choose self-vs-picker on `intelligence/page.tsx:148`. It is cosmetic: localStorage is user-editable, and every enforcement below is server-side. Menu visibility is derived from `tblmenumaster` rights (`DashboardShell.tsx:newPalLevel3Items`), but the pages themselves render for any logged-in user who types the URL; a student opening `/pal/new/content-model/review` gets an empty shell plus the server's 403 text.

| Module | Frontend gating | Backend enforcement (verified) | Finding |
|---|---|---|---|
| Gamification reads | staff must pick a learner; student picker hidden for students | `PalApiAuth` (`PalApiAuth.php:101-177`) checks `learner_id` (route/query/body): student=self only, staff=same institute AND (plain teacher) class_teacher/timetable scope; `GamificationVisibility::audience` (`GamificationVisibility.php:31-52`) forces student audience for students, staff may only narrow | Sound for learner-scoped reads. Gap: class-scoped calls with no `learner_id` (team-challenges list/create/end/update, challenge-mode class-availability) bypass the teacher-class check entirely (AI-B26). |
| Gamification writes | "New challenge"/"End early" shown only when `isStaffView` (derived from response data) | `createTeamChallenge`/`update`/`end`/`revokeBadge`/`challengeModeAvailability` deny `role==='student'` only (`NewPalGamificationController.php:173-176,292-297,319-323,354-358,537-542`); any non-student (accountant, driver, ...) passes | AI-B26. Also `challengeModeOptIn`/`careerQuest interest|pathway|report` accept a staff-supplied `learner_id`, so a teacher can opt a child in to a competitive leaderboard and choose a career pathway on their behalf. |
| Content Model (new) read/write/approve | none | `denyStudents` (is_student) on every route except `vocabulary` (`NewPalContentModelController.php:58,817-822`); writes use `writeTenantFor` (token institute) | Any staff role can save, transition (incl. `approved`), bulk-transition 200 nodes, restore, and trigger AI enrichment; no reviewer role, no author!=approver rule (AI-B03). Tenant scoping for these routes is correct (token institute; ambiguous CSV rejected). |
| Legacy Content Intelligence | none | writes deny students; transition/bulk lack tenant check (write before check; tenant 0 row treated as public) | AI-B02. `show` (GET metadata) does not deny students (`PalContentIntelligenceController.php:55-83`): a student can read question metadata incl. `ai_rationale`/tags for own institute (Low). |
| Administration | Save/Reset buttons hidden when `canWrite` false (server value) | read: any non-student; write: `mayWrite` = JWT `is_admin > 0` OR profile name in `writer_profiles` - but `pal_auth` has no `user_profile_name`, so the profile path is dead code (`ArchitectureRegistry.php:194-212`); `updated_by` is written from `$auth['id']`, which does not exist (key is `user_id`) so it is always NULL (`PalArchitectureController.php:264-268`) | AI-B06. A client-level admin (is_admin 1, sub_institute 0) writes scope 0 = estate-wide defaults for every institute. School admins with null `is_admin` (common per the middleware's own comment) cannot write even though the UI says "requires an administrator profile". |
| Coherence Map | none | no student deny; `/map` and `/health` pass NO tenant to the repository, which resolves the owning tenant of any (standard_id, subject_id) pair itself (`CoherenceMapController.php:57`, `CoherenceMapRepository.php:506-508`) | AI-B05: authenticated cross-tenant read. |
| Pedagogy Engine / Framework / ULU views | none | none (public routes) | AI-B01. |
| ULU CRUD API | none (no UI) | denies students only; no tenant/owner; `findOrFail($id)` unscoped (`PALAPIController.php:536-647`) | AI-B04. |
| `POST /api/pal/content/{id}/framework-metadata` | none (no UI) | NO role check at all (`PALAPIController.php:463-471`) | AI-B04: even a student JWT can rewrite framework metadata of any `content_master` row in any tenant. |
| PAL report / Personalize marks | none | legacy session-hydration: tenant from JWT (good), `check_permissions` menu rights | Not class-scoped for teachers; personalize-marks has no validation (AI-B14, AI-B15). |
| Attainment report | class picker limited to the teacher's roster | any non-student, institute from token (`AttainmentReportController.php:75-102`) | Server allows any class in the institute; only the UI narrows it (Low). |
| AI enrichment/translate | none | students denied; no per-user throttle; cache reduces repeat calls | Low (AI-B23). |

---

#### Sub-part C - Enterprise Brain, Capability Intelligence, Career modules, People & Competency

| Module | Frontend gating | Backend enforcement | Finding |
|---|---|---|---|
| Enterprise Brain (all pages) | None at route level: no `app/enterprise-brain/layout.tsx`; `ConditionalApp.tsx:36-38` only checks `isAuthenticated`. Sidebar item appears if `GET /api/brain/access` says `allowed` **or** `isBrainVisibleByLmsSession()` (`DashboardShell.tsx:62-85,304-315`). | `BrainController::access` returns `allowed:true` for any valid JWT (`BrainController.php:54-62`); `default_role => 'viewer'` (`config/brain.php:30`); viewer = `READ` (`Role.php:46-47`); every GET in `routes/brain.php` needs only `read`. | **Every authenticated LMS user (student, parent, teacher, driver...) is a Brain "viewer" and can read every Brain GET for their tenant.** navigation.ts comment ("visible to 174 school-side profiles") is not what the code does. AI-C01. |
| Brain write actions | Buttons rendered to everyone (Capabilities "New capability", Edit, Assign, Ingestion "Run", Intelligence "Run", Automation Approve/Reject). Only `settings/page.tsx:52` hides write UI (`permissions.includes('settings.manage')`). | `create`: analyst+; `update`: analyst+; `decision.approve`/`eso.execute` are defined but **never used by any route** (`routes/brain.php` grep) | Accountants/clerks/counsellors (config `profile_name_roles` -> `analyst`) can approve recommendations and record outcomes. AI-C05. |
| Governance page | `canSeeInternalItems()` (client, localStorage-driven, `internal-access.ts:64-80`, includes `profileId === 1`) | none | Advisory only; page content is static text so no data risk. Profile id 1 is per-tenant (config/brain.php comment: "Admin is profile 1 for one institute and 3596 for another"). AI-C28. |
| Agent Management / Conversational AI | `usePermission` disables the Create button (advisory) | Next routes: identity from `x-*` headers; list endpoints have no auth; write authorization calls **caller-supplied** base URL | AI-C03 / AI-C04. |
| Capability Intelligence (all) | none | `api.session` + `staff.only` = block only `student`/`parent`/`is_student` (`RequireStaffRole.php:34-52`); the header states it "does NOT implement field-level RBAC" | Any staff profile (teacher, driver, clerk) can create/delete frameworks, skills, job roles, weights, scale levels and **bulk-approve** approvals/mapping reviews (`CompetencyApprovalController`, `MappingReviewController` have no role check). AI-C12. Employee-profile subject gate uses `tbluserprofilemaster.role_key` in `COMPETENCY_ELEVATED`; `role_key` is a nullable column — population in live DB NOT VERIFIED (if NULL, even admins are limited to their own profile). |
| Career Explorer / RIASEC | none | **No auth middleware** on the 10 explorer GETs and the 6 `intrest*`/`matchProfile` GETs (`routes/lms.php:380-397`) | AI-C06. |
| Career Awareness / Intelligence | none | `session` middleware (JWT `type=API` hydration) — identity from token; `student_id` override only when session `is_admin` is 1 or 2 (platform flag) | AI-C25. |
| People & Competency LMS | `isAdminOrHrProfile` = `includes('admin') \|\| includes('hr')` (substring; `learning-assignments.tsx:82-85`) | `guardAdminOrHr` server-side for review routes | Frontend substring can match unintended profile names (e.g. any name containing "hr"); backend is the real gate. AI-C35. |

---

#### Sub-part D - AI console, workspace tabs, platform services, integration, migration modules, roadmap

Backend identity model for `/api/ai/*` (verified): `McpAuth.php:38-48` builds `role = student | admin (is_admin>=1) | staff`. That is the ONLY role vocabulary the AI layer knows. Per the ERP auth memory, real roles are `user_profile_id -> tbluserprofilemaster.name` (Teacher, Accountant, Principal, Driver…); `is_admin` is a platform-level flag. So "staff" = every non-admin employee, and "admin" = whoever has `is_admin>=1` (often nobody at school level). Student JWTs (`is_student=true`, issued by `ApiLoginController.php:423`) are accepted by `McpAuth` exactly like staff tokens.

| Module | Frontend gating | Backend enforcement | Finding |
|---|---|---|---|
| Provider / model / credential / policy / template writes (`/api/ai/configuration*`, `/configuration-models*`, `/modules/{m}/models*`, `/policies*`, `/templates*`) | none (no `usePermission`, no profile check in app/ai/**; Header shows the menu to everyone: Header.tsx `menuGroups` has no role condition) | JWT only. grep of `role|isStudent|isAdmin|userProfile` in `AiConfigurationController`, `AiPolicyController`, `AiTemplateController`, `AiModuleModelController` = 0 hits | AI-D01 |
| Recommendation approve/reject/defer, `POST /cases/{id}/status` | ActionsTab/RecommendationCard show buttons to whoever sees the pending list | `DecisionGate::record` only requires `userId>0` and same institute (DecisionGate.php:114-160). Student/parent/driver token works. `decided_by_name` is client text | AI-D04 |
| Workflow approval resolve | ActionsTab shows Approve/Reject for the first `pending` approval returned | `WorkflowEngine::resolveApproval` (WorkflowEngine.php:219-262) checks institute + `status==='pending'` only; `assigned_to` / `approver_role` never compared | AI-D06 |
| Workflow start (`/workflows/{w}/execute`, `/workspace/workflows/{w}/start`) | students: capability hidden in UI (`AiContextService::applyRoleLimits`, `AiContextService.php:257`) | `WorkflowEngine::start` → `authorizeRole(allowed_roles)`; seeded definitions use `['admin','staff']` (migrations 2026_08_20_000009:191,225; 2026_09_10_000001:33). Good, but coarse | OK-ish; note vocabulary is admin/staff only |
| Agent run (`/agents/{a}/run`, `/workspace/agents/{a}/run`) | students: hidden in UI | `AgentManifest::permitsRole` (`allowed_roles`) — role-gated by manifest | OK; any "staff" (incl. non-teaching) can trigger institute-wide sweeps (AI-D23) |
| Reads: cases, signals, recommendations, subjects, outcomes, audit-logs, tickets list, saved reports | none | institute filter only; no student self-scope, no teacher-class scope (`StudentScope::students` filters by institute + `student_inactive` only) | AI-D07 |
| Report edit/send | none | none (`ReportController` has no role check) | AI-D08 |
| Outcome measurement `POST /outcomes/measure-due` | none | `if (! $scope->isAdmin) 403` (OutcomeController.php:75) — the only `isAdmin` guard in the AI API besides tickets screenshot (AiAssistanceTicketController.php:~139) | shows partial, inconsistent gating |
| `/api/platform/*` writes | `usePermissions(['platform.*'])` disables controls — comment says "cosmetic" | `perm:platform.<svc>,<action>` on route BUT `RequirePermission` warn-only unless `lms_content.api_auth_enforce` true (default `false`, config/lms_content.php:144; live value NOT VERIFIED). Controllers do not re-check (PlatformController docblock) | AI-D09 |
| `/api/platform/events/*` | banner "Admin accounts only" | `lms.staff` (blocks profile names student/parent — by name string) + `perm:platform.eventbus,view` (warn-only) + `is_admin===2` in code for estate-wide sections | Best-designed of the group; still depends on warn-only flag for the `perm` half |
| `/api/migration-modules/*` | none | JWT valid + `sub_institute_id`,`user_id`,`syear` present in request | AI-D03 |
| `/api/lms/concept-intelligence/tab-labels/*` | any viewer of the chapters page can rename (no `canEdit` prop) | **no middleware at all** | AI-D10 |
| `/api/integration-configs*` (Next) | `canAdminister` from client `localStorage isAdmin` string | only `request.headers.get('authorization')` non-null | AI-D02 |
| `/platform-roadmap`, `/platform-administration` internal rows | `NEXT_PUBLIC_SHOW_INTERNAL_ROADMAP==='true'` (build-time, visible in client bundle) | n/a | AI-D31 (Info) |
| `/ai-reports/[id]` | none | none | AI-D07/08 |

---

### 4. Tenant / school / academic-year scoping findings (is sub_institute_id / syear sent by client? trusted by server?)

#### Sub-part E - Assistant panel, agent engine, event bus, catalogue, Laravel /api/ai cross-cut (lead auditor)

- `/api/ai/*` and `/api/mcp`: tenant derived from JWT `sub_institute_id`; `X-MCP-Institute-Id` / `meta.institute_id` are validated against the token's allowed institute set (McpContextResolver::resolveInstituteId) unless `is_admin===2`. Academic year/term validated against `academic_year` for the selected institute. Verified. The client sends `institute_id`, `academic_year`, `term_id` only as a selection (ChatbotPanel.tsx:286-302).
- The Next-side agent engine, conversational-AI admin and PAL submit proxy do the opposite: tenant/user/profile/base-URL are client headers trusted as-is (AI-01, AI-02).
- Recommendation/decision lookups are institute-scoped (`->where('sub_institute_id', $context->selectedInstituteId)`), so cross-tenant approval was not found; the gap is intra-tenant role (AI-03).
- `is_admin===2` bypass: a super admin may select any institute (by design).
- Sub-audit tenant sections follow (New PAL PALB-05 coherence map cross-tenant read; migration-modules PLT-03; career/O*NET public routes BRN-06).

#### Sub-part A - PAL / ESO student-facing adaptive learning

* `sub_institute_id`, `syear`, `user_id` are appended to every `/lms/*` URL/body by `appendCommonParams` (`lib/erp-client.ts:200-210`) and `commonEntryParams`/`practiceParams`. On JWT-hydrated routes the tenant comes from the JWT (`palController.php:75-78`, `158-160`); on the unauthenticated routes it is whatever the caller sends (`assessmentQuestionController.php:1574,1638,1698,2035,2503,2781`).
* `syear` is always client-trusted (`palController.php:79,95,128`) — harmless for students (own data) but lets a caller pick any year; `EsoEngineController::studentDashboard/learningPath` require `syear` as a non-empty string only. Client normalises `2025-2026` to `2025` (`erp-client.ts:29-35`) while the controller docblock for `learning-path` says `syear=YYYY-YYYY` — format agreement is **NOT VERIFIED** against live `tblstudent_enrollment.syear`.
* ESO: tenant = `tblstudent.sub_institute_id` of the learner (`EsoEngineController.php:79-84`) — correct. But `ConceptNode::findOrFail($nodeId)` is unscoped (`EsoPolicyService.php:1966,2554`), `stateFor()` creates `learner_node_state` for any node id (`4693-4718`), `answer_master` lookups are global (`851-854`, `2045`), so a tenant-341 student can write state/evidence against tenant-1 node ids and vice versa (AI-A04).
* `chapterDashboard(learnerId, chapterId)` and `chapterKnowledgeMap` accept any chapter/concept id (`chapter_master`/`lms_concept` are not tenant filtered, `EsoPolicyService.php:3736,3982`) -> curriculum names of other tenants readable (LOW, curriculum metadata). `curriculumMasteryCount` selects `chapter_master` without `sub_institute_id` (`4252-4256`).
* Question-bank scoping: `McqPool::base($subInstituteId)` scopes draws by tenant; `show()` (`palController.php:2642-2645`) filters `answer_master` by caller tenant but not `lms_question_master`/`question_paper` (AI-A03).
* `pal_view_as_student` (localStorage) is not tenant- or user-bound (AI-A21).

---------------------------------------------------------------------------------------------------------------------------

#### Sub-part B - New PAL (gamification, content model, administration, coherence map, pedagogy engine), reports

- New PAL clients (`gamification.ts`, `content-model.ts`, `administration.ts`, `coherence-map.ts`) send NO `sub_institute_id`, `user_id` or `syear` (verified: `callApi` only sends bearer token + `learner_id`/`audience`/business ids). Tenant is derived from the JWT by `PalApiAuth` and the controllers' `tenantFor/writeTenantFor`. Good.
- Trust points that ARE client-controlled: `learner_id` (validated by `PalApiAuth::authorizeLearner`), `audience` (only narrowing honoured), `standard_id`/`division_id`/`syear` on team-challenge and class-availability calls (not validated against the caller's classes; `syear` accepted verbatim, `NewPalGamificationController.php:668-709,549-559`), `sub_institute_id` only for `is_admin===2`.
- Legacy `type=API` endpoints (`/lms/palreport`, `/result_personalize_marks`): frontend sends `sub_institute_id` + `syear` (`pal.ts:104,1672,1719`), but `HydratesLegacyApiSession` ignores the client tenant and hydrates from JWT (`HydratesLegacyApiSession.php` top docblock, `hydrateSessionFromClaims`); `syear`/`term_id` ARE taken from the request (year switch), constrained to the JWT tenant's `academic_year`. Acceptable.
- Cross-tenant defects: AI-B01 (pedagogy engine/semantic-intelligence unscoped, unauthenticated), AI-B02 (legacy review transition/bulk), AI-B04 (ULU + framework-metadata unscoped), AI-B05 (coherence map tenant dropped). `ChallengeModeService::leaderboard` filters by `standard_id` (+ optional division) but not `sub_institute_id`/`syear` and loads every opted-in learner id estate-wide (`ChallengeModeService.php:350-363`); safe today only because standard ids are globally unique (Low).
- Multi-institute admins: `tenantFor` picks the first CSV institute while `PalApiAuth` allows any; a multi-institute admin is silently limited to the first for content-model and administration (documented in `AttainmentReportController` comment) (Info).
- Known data facts from memory (tenant-1-only `pal_concept_nodes`, tenant 72/195 calibration): NOT VERIFIED (needs DB).

---

#### Sub-part C - Enterprise Brain, Capability Intelligence, Career modules, People & Competency

- **Brain API (`/api/brain/{tenantId}/...`)**: `tenantPath()` puts the tenant from `localStorage` into the URL (`lib/brain/api.ts:56-65,160-165`) but `BrainTenantScope` (`BrainTenantScope.php:19-21`) rejects a mismatch with 403 and the controller re-reads `auth.tenantId` from the verified token. **Client-supplied tenant is NOT trusted — no cross-tenant read found on the Brain API.** `syear` is client-supplied but validated against the tenant's own `academic_year` rows (`AcademicYear::resolve`). `user_id` for decisions/outcomes comes from the token (`auth.userId`), not the body.
- **Brain IDs within tenant**: `studentIntelligence($id)` (`EntityIntelligence.php:44-50`) scopes to tenant only — any viewer can read any student in the tenant (IDOR-within-tenant; includes fee data). `capabilityAssign` does not check that `target_id` belongs to the tenant (`BrainController.php:445-478`); `ingestion/run` `limit` is client-supplied and unbounded.
- **Agent Management / Conversational AI (Next routes)**: tenant and acting user are taken from **client headers** `x-sub-institute-id`, `x-user-id`, `x-user-name` (`acting-user.ts:37-47`); listing has no auth (`engine.ts:72-80`). Cross-tenant read/write possible. The conversational-AI store is global (not tenant-scoped): any tenant with the `conversational_ai` right rotates tokens shared by all tenants. AI-C03/04.
- **Competency/People-LMS**: `api.session` hydrates tenant/user from the verified JWT (`HydratesLegacyApiSession.php` header comment + lines 88-95); the frontend still sends `sub_institute_id`, `user_id`, `syear`, `financial_year` and **`token`** as query params on every capability call (`command-center-api.ts:106-121`, all 4 sibling API libs) — ignored server-side except `syear` (accepted from request unvalidated). Token-in-URL: AI-C16.
- **Career (session middleware)**: identity from token; `syear` from request accepted (`HydratesLegacyApiSession.php:73-88`).
- **Staff/student id namespace**: career session identity is `session user_id` used as `student_id` (`lmsCounsellingController.php:1487,1506,1609`) — for a staff JWT this is `tbluser.id`, which can equal a real `tblstudent.id` (AI-C25).

---

#### Sub-part D - AI console, workspace tabs, platform services, integration, migration modules, roadmap

| Surface | What the client sends | Trusted by server? | Verdict |
|---|---|---|---|
| `/api/ai/*` via `lib/intelligence/client.ts`, `workspace.ts`, `ai-*.ts` | `Authorization: Bearer`, `X-MCP-Institute-Id` (from `localStorage.userData.sub_institute_id`), body `meta.{institute_id, academic_year, term_id}` (client.ts:52-79, workspace.ts:264-283) | `McpContextResolver::resolveInstituteId` (McpContextResolver.php:79-98): header wins, must be in JWT `sub_institute_id` list unless `is_admin===2`; year/term accepted only if both present and found in `academic_year` for that institute (lines 118-137), otherwise silently ignored and "current term" used | **Good.** Selection not grant. Note: a supplied `academic_year` WITHOUT `term_id` is ignored silently (no error). |
| Recommendation / approval ids | numeric id in URL | scoped by `sub_institute_id` in `DecisionGate::record` (line ~138) and `WorkflowEngine::resolveApproval` (line ~232) | Tenant-safe; **not entity-bound** — any recommendation in the institute can be decided regardless of the record on screen (AI-D04) |
| Reports | id in URL | `GeneratedReportStore::find` scoped by institute | Tenant-safe; not user/role-scoped (AI-D07) |
| `/api/platform/*` | token only; no institute in body/query (client.ts comment lines 20-24) | `tenantId()` from JWT | **Good** — best tenancy hygiene in the slice |
| `/api/brain/{tenantId}/*` | tenant in URL path | `BrainTenantScope` rejects `routeTenant !== tokenTenant` (403) | Good |
| `/api/migration-modules/*` | `sub_institute_id`, `user_id`, `syear`, `type=API` in the **query string** from `buildSessionContext()` (MigrationModulePage.tsx:24) | `tenant()` = `$r->integer('sub_institute_id')` (controller:27); `guard()` validates JWT signature only, never compares with the token's tenant | **Bad — client-controlled tenancy** (AI-D03). Several tables have no tenant column at all. |
| `/api/lms/concept-intelligence/tab-labels` | `sub_institute_id`, `user_id` in body (conceptIntelligenceTabLabels.ts:117,132) | `resolveTenant` = session or request input | **Bad**, and unauthenticated (AI-D10) |
| `/api/integration-configs` (Next) | Authorization header only | no tenant concept: one module-level array for all callers | **Bad** (AI-D02) |
| Reports/notices "send" | none | recipients = re-run of the query recorded in the HTML marker, scoped by caller institute | Tenant-safe; marker is user-editable (AI-D08) |
| Academic year on AI Stack / journey pages | `auth.academicYears[0].syear` (first entry, not the header's selected year) — `app/ai-journey/page.tsx:61`, `app/ai-reports/[id]/page.tsx:118` | server ignores `academic_year` unless `term_id` also sent (buildMeta never sends `term_id` on these two pages) | The two pages never actually pin a year: they always run against the server's "current term". Low. |

---

### 5. API endpoints consumed or exposed (method, URL, auth, validation, notes)

#### Sub-part E - Assistant panel, agent engine, event bus, catalogue, Laravel /api/ai cross-cut (lead auditor)

| Method | URL | Auth | Validation | Notes |
|---|---|---|---|---|
| POST | /api/ai/ask/stream (Next) | forwards bearer; no local check | none (raw body) | proxies to Laravel /api/ai/ask/stream, falls back to /ask on 404/405; upstream host from env |
| POST | /api/ai/assistance-tickets (Next) | requires Authorization header present (no validation) | zod; screenshot <= 8,000,000 chars | forwards to /api/ai/assistance/tickets |
| POST | /api/ai/field-edit (Next) | Authorization header present | zod (value <= 20k, instruction <= 1000, related <= 2000/each) | -> /api/ai/generate template k12.field_edit; output not sanitised |
| GET/POST | /api/agents (Next) | none real (headers) | POST: name<=80, module known, tools validated per module | AI-01 |
| GET | /api/agents/runs (Next) | none | limit only | returns run outputs, AI-01 |
| PATCH | /api/agents/[id] | RBAC via header base URL | status transition table | AI-02 |
| POST | /api/agents/[id]/run | RBAC via header base URL; executes one allow-listed tool as caller token | tool must be in allow-list; args unchecked | writes run log to JSON |
| GET | /api/conversational-ai/projects | token non-empty only | - | |
| PUT | /api/conversational-ai/projects/[id]/settings | RBAC conversational_ai/update via header URL | booleans/language/source validated | |
| POST | /api/conversational-ai/projects/[id]/token | same | - | returns plaintext token once |
| POST | /api/pal/submit (Next) | bearer + cookie forwarded | none | SSRF via x-laravel-base-url, redirect:'manual' |
| POST | /api/pal/content-model, /api/pal/pedagogy-engine (Next) | see PALB-01/13 | | sub-audit B |
| GET,POST,PUT,DELETE | Laravel /api/ai/* (about 70 routes) | McpAuth+McpRateLimit+McpContextHydrator | per-controller | routes/ai.php full route list inspected; write endpoints without role (AI-03/04); admin-only: tickets index/screenshot, outcomes measure-due, audit-logs |
| GET | Laravel /api/platform/events/* (6) | lms.auth, lms.staff, perm:platform.eventbus,view | paging/date filters | read-only |
| GET/PUT/POST/DELETE | Laravel /api/platform/{registry,notifications,scheduler,workflow} | lms.auth; writes perm (warn-only) | | sub-audit D |
Sub-audits' full endpoint tables follow.

#### Sub-part A - PAL / ESO student-facing adaptive learning

Legend: **A1** = `pal.auth` (Bearer JWT; learner ownership from route `{learnerId}`); **A2** = `pal.auth`+`eso.student`; **A3** = `session` mw (JWT hydrated when `type=API`) + `menu` + `logRoute` + `check_permissions`; **A0** = no auth.

###### 5a. ESO (`routes/pal_eso_api.php`, `EsoEngineController`) — base `api/pal/eso`
| Method | URL | Auth | Validation | Client fn | Notes |
|---|---|---|---|---|---|
| GET | `/chapter-concepts/{chapterId}` | A1 (tenant from JWT) | numeric | `fetchChapterConcepts` | read-only |
| GET | `/decision-log/{learnerId}/{conceptId}` | A1 | numeric | `fetchDecisionLog` | last 200 rows incl. `state_snapshot` |
| GET | `/pilot/metrics` | A1 | — | (not in slice) | |
| GET | `/reports/attainment`, `/reports/blueprint-feasibility` | A1, staff inside | — | `fetchAttainmentReport` (part B) | |
| GET | `/diagnostic/{L}/{C}` | A2 | numeric | `fetchDiagnostic` | returns `items` (+ `is_correct`), grouped view, `calibration`, `availability` |
| POST | `/diagnostic/{L}/{C}/submit` | A2 | `responses` array min 1, `node_id` int, `answer_master_id` int — **no max, no exists, no pool binding** | `submitDiagnostic` | AI-A04, AI-A10 |
| GET | `/tutor-context/{L}/{C}` | A2 | — | `fetchTutorContext` | 404 if no nodes |
| GET | `/practice-item/{L}/{N}` | A2 | — | `fetchPracticeItem` | deterministic per learner+node; 404 -> null |
| GET | `/next-action/{L}/{C}` | A2 | — | `fetchNextAction` | **writes** decision log, stamps `taught_at`, may write node status |
| GET | `/chapter-dashboard/{L}/{Ch}` | A2 | — | `fetchChapterDashboard` | "silent" but `masteryVerdict` still writes mastered status/retention |
| GET | `/learning-path/{L}?syear=` | A2 | `syear` non-empty | `fetchLearningPath` | |
| GET | `/student-dashboard/{L}?syear=` | A2 | `syear` non-empty | `fetchAutoStudentDashboard` | `{no_content:true}` |
| GET | `/concept-mastery-details/{L}/{C}` | A2 | — | `fetchConceptMasteryDetails` | |
| GET | `/knowledge-map/{L}/{C}` | A2 | — | `fetchKnowledgeMap` | |
| POST | `/practice/{L}/{N}/attempt` | A2 | `concept_id` int, `answer_master_id` int, `hint_used` bool, `mode` guided\|independent | `recordAttempt` | **client-chosen `mode`/`hint_used`**; AI-A04 |
| GET | `/cfu-items/{L}/{N}` | A2 | — | `fetchCheckUnderstandingItems` | |
| POST | `/cfu/{L}/{N}/check` | A2 | `responses[].answer_master_id` | `submitCheckUnderstanding` | partial answers accepted server-side |
| GET | `/retrieval-items/{L}/{N}` | A2 | — | `fetchRetrievalItems` | |
| POST | `/retrieval/{L}/{N}/check` | A2 | `responses[].answer_master_id` | `submitRetrievalCheck` | **no due/status check** -> AI-A04 |
| GET | `/due-for-retrieval/{L}` | A2 | — | `fetchDueForRetrieval` | |
| POST | `/render` | A2 (inside the `eso.student` group, `pal_eso_api.php:115`; learner taken from body `learner_id`, checked by `PalApiAuth`/`EsoStudentOnlyAuth`) | `learner_id` int, `instruction` string (unbounded), `context` array | `renderInstruction` | only LLM call; AI-A19 |

###### 5b. Legacy session/JWT routes (`routes/lms.php`, prefix `lms`, mw A3)
| Method | URL | Controller@action | Validation | Client fn | Notes |
|---|---|---|---|---|---|
| GET | `/lms/pal/create` | `palController@create` | none (grade/standard/subject/chapter from query) | `fetchPalQuiz` | returns `answer_arr[].correct_answer` |
| POST | `/lms/pal` | `palController@store` (via Next BFF) | none | `submitPalQuiz` | 302 redirect; AI-A06/23 |
| GET | `/lms/pal/{id}?online_exam_id=` | `palController@show` | `whereNumber(pal)` only | `fetchPalResult` | **SQLi + IDOR** AI-A01/03 |
| GET | `/lms/pal?type=API` | `palController@index` | — | `legacyPalLanding` | fallback |
| GET | `/lms/palreport` | `palController@palreport` | — | `fetchPalReport` (part B) | see NOT VERIFIED (syear) |
| GET | `/lms/pedagogy-suggested-content` | `getPedagogySuggestedContent` | — | `fetchPedagogySuggestedContent` | |
| GET | `/lms/misconception` | `misconception` | — | `fetchMisconceptions` | parametrised SQL |
| POST | `/lms/misconception/generate-content` | `generateMisconceptionContent` | `chapter_id` required | `generateMisconceptionContent` | LLM per wrong question; AI-A19 |
| POST | `/lms/increment-content-visit` | `incrementContentVisit` | — | `incrementContentVisit` | duplicate route regs `web.php:853` (top-level) and `:860` (grouped); action self-authenticates |
| GET | `/lms/pal/diagnostic/chapter/{id}` | `diagnosticStart` | `whereNumber` | `startChapterDiagnostic` | **GET creates attempt+rows**; `standard_id` override client-supplied |
| POST | `/lms/pal/diagnostic/attempt/{id}/submit` | `diagnosticSubmit` | ownership check, option-belongs-to-question | `submitChapterDiagnostic` | CSRF-exempt (`VerifyCsrfToken.php`) |
| GET | `/lms/pal/diagnostic/attempt/{id}/result`, `/history/{chapterId}` | `diagnosticResult`, `diagnosticHistory` | ownership on result | | result carries answer key post-submit (intended) |
| GET | `/lms/pal/adaptive/chapter/{id}`, `/concept/{id}`, `/progress/{id}`, `/concept-result/{id}` | `adaptiveConcepts`, `adaptiveQuestions`, `adaptiveProgress`, `adaptiveConceptResult` | limit capped at 5 | `fetchAdaptive*`, `fetchConceptResult` | `concept-result` GET **writes** (evidence publish, misconception routing) |
| POST | `/lms/pal/adaptive/answer` | `adaptiveAnswer` | option belongs to question only | `submitAdaptiveAnswer` | CSRF-exempt; AI-A09 |
| GET | `/lms/pal/plan/chapter/{id}`, `/mastery/chapter/{id}`, `/recall`, `/learn/concept/{id}` | plan/mastery/recall/learn | — | `fetchLearningPlan`, `fetchChapterMastery`, `fetchRecallQueue`, `fetchConceptLearn` | |
| POST | `/lms/pal/learn/concept/{id}/read` | `learnAcknowledge` | — | `acknowledgeConceptLearn` | CSRF-exempt; calls non-silent `nextAction` |

###### 5c. Unauthenticated routes (`routes/web.php` top level — mw `web` only) — **A0**
| Method | URL | Action | Identity source | Client fn |
|---|---|---|---|---|
| GET | `/lms/adaptive-practice` | `assessmentQuestionController@generateAdaptivePractice` | `student_id` param | `fetchAdaptivePractice` |
| POST | `/lms/submit-practice` | `@submitPractice` | `student_id` param | `submitAdaptivePractice` |
| GET | `/lms/diagnostic-assessment` | `@generateDiagnosticAssessment` | `student_id` | `fetchDiagnosticAssessment` (dead consumer) |
| POST | `/lms/submit-diagnostic-assessment` | `@submitDiagnosticAssessment` | `student_id` | `submitDiagnosticAssessment` |
| GET | `/lms/chapter-gate` | `@getChapterGate` | `student_id` | `fetchChapterGate` |
| GET | `/lms/practice-history` | `@getPracticeHistory` | `student_id`, `sub_institute_id`, `limit` (unbounded) | `fetchPracticeHistory` |
| GET | `/lms/spaced-repetition` | `@getSpacedRepetition` | `student_id` | `fetchSpacedRepetition` |
| GET/POST | `/lms/student-profile`, `/forgetting-curve`, `/update-forgetting-curve`, `/class-insights`, `/teacher-dashboard`, `/knowledge-graph`, `/concept-prerequisites`, `/recommend-content`, `/track-content-view`, `/pedagogy-recommendations` | `PedagogyEngineController` (`web.php:91-100`) | `student_id` / session | (not in slice; same registration defect, bodies not audited) |

###### 5d. PAL workspace / V4 / Next handlers
| Method | URL | Auth | Notes |
|---|---|---|---|
| GET | `/api/pal/workspace/{learnerId}`, `/workspace/students`, `/workspace/preview` | A1 | students -> 403 on list; teachers class-scoped; 404 triggers legacy fallback in client |
| GET | `/api/pal/learner-state/…`, `velocity`, `plateau`, `regression`, `risk kinds`, `misconception/cluster`, `remediation`, `ulu*` (`pal-v4.ts`) | A1 | staff/intelligence surfaces (part B) |
| GET/POST/PATCH | `/api/pal/intervention*` | (404) | **not deployed** |
| POST | Next `/api/pal/submit` | none | BFF; upstream base URL from `x-laravel-base-url` header (AI-A08) |
| GET | Next `/api/pal/content-model`, `/api/pal/pedagogy-engine` | none | public curriculum/pedagogy reference; `getPalContentModel` builds its own URL from request Host/X-Forwarded-Host (`pal-content-model.ts:1125-1134`) |
| GET | `/api/pal/pedagogy-engine/*` (Laravel) | none (`pal_api.php:31-38`) | read-only reference data |
| POST | `/get_adminStudentList`, `/api/lms-courses` | legacy | fallback only; JWT also placed in form body `token` (`pal-legacy.ts:63`) |

---------------------------------------------------------------------------------------------------------------------------

#### Sub-part B - New PAL (gamification, content model, administration, coherence map, pedagogy engine), reports

Auth column: `JWT` = `pal.auth` (valid GenTux JWT + learner ownership when a learner id is present); `NONE` = no middleware.

**5a. Next.js route handlers (in slice)**

| Method | URL | Auth | Validation | Notes |
|---|---|---|---|---|
| GET | `/api/pal/content-model?chapterId&concept` | NONE | none (strings passed through) | `app/api/pal/content-model/route.ts:8-25`; builds from `GET {API}/api/semantic-intelligence[/{id}/result]` (public backend); returns `error.message` to caller on failure. |
| GET | `/api/pal/pedagogy-engine?chapterId&concept` | NONE | none | `app/api/pal/pedagogy-engine/route.ts:13-30`; proxies public `GET {API}/api/pal/pedagogy-engine`; returns backend/`fetch` error text (e.g. "Could not reach the Pedagogy Engine API: <error.message>") to anonymous callers. |

**5b. Laravel endpoints consumed by the slice**

| Method | URL | Auth | Validation | Consumer | Notes |
|---|---|---|---|---|---|
| GET | `/api/pal/new/gamification/overview` | JWT | none (`learner_id`,`audience` optional) | gamification/page | writes as side effect (badges/PBs/streak/notifications) |
| GET | `.../personal-best` | JWT | none | personal-best | |
| GET | `.../personal-best/history` | JWT | `limit` `(int)` unbounded | personal-best | refresh() writes |
| GET | `.../badges` | JWT | none | badges | evaluate() writes |
| GET | `.../streak` | JWT | none | streaks, overview | recompute() upserts a row per activity day |
| GET | `.../streak/history` | JWT | `days` `(int)` unbounded | streaks | |
| GET | `.../team-challenges` | JWT | staff need `standard_id` or `learner_id` | team-challenges | GET persists contributions/marks completed |
| POST | `.../team-challenges` | JWT, non-student | type/standard/concept checks; no validate(); `$input['title'] ?:` undefined-key 500 if omitted | composer | `reward_approved` honoured from client (UI hardcodes `true`, `team-challenges/page.tsx:395`) |
| POST | `.../team-challenges/{id}/end` | JWT, non-student, institute check `mayManageChallenge` (empty institutes list => allowed) | reason free text | "End early" | |
| GET | `.../career-quest` | JWT | none | career-quest | |
| POST | `.../career-quest/pathway` | JWT | pathway string | career-quest | staff may act for a learner |
| POST | `.../career-quest/report` | JWT | server eligibility | career-quest | |
| GET | `.../challenge-mode` | JWT (not PARENT) | none | challenge-mode | |
| POST | `.../challenge-mode/opt-in` | JWT | bool | challenge-mode | staff may opt a learner in |
| GET | `.../session-summary` | JWT | `date` -> `Carbon::parse` unvalidated (invalid => 500) | session-summary | UI never sends `date` |
| POST | `/api/pal/new/content-model/...`: GET `vocabulary`, `coverage`, `chapters`, `chapters/{id}`, `chapters/{id}/misconceptions`, `chapters/{id}/concepts/{slug}`, `nodes/{key}`, `review-queue`; POST `nodes/{key}` (save), `nodes/{key}/transition`, `nodes/{key}/restore`, `nodes/{key}/enrich`, `nodes/{key}/translate`, `nodes/bulk-transition` | JWT; non-student | save: title<=512, media_url<=2000 (no scheme check), metadata closed-vocab via `PalVocabulary::validate`; transition: `to_status` required + state-machine; bulk: 1..200 keys; translate: `language` size:2 (not checked against registered languages) | content-model pages | tenant = token institute; `nodeKey`/slug interpolated into URL without `encodeURIComponent` on the client (AI-B17) |
| GET | `/api/pal/content/{coverage,vocabulary,review-queue/{type},misconceptions,misconceptions/{id},misconception/health,ladder/{id}}` | JWT | limit clamp 1..200 on review queue | app/pal/content pages | |
| POST | `/api/pal/content/metadata/{type}/{id}` | JWT; students denied | closed vocab via service; client-tenant fields stripped | content/review save row | |
| POST | `/api/pal/content/review/{type}/bulk` | JWT; students denied | ids 1..200 ints; `to_status` string | content/review | NO tenant check (AI-B02) |
| GET/POST | `/api/pal/new/administration`, `/{subsystem}`, `/{subsystem}/reset` | JWT; students 403; write `mayWrite` | registry sanitises/range-checks per panel descriptor | administration pages | |
| GET | `/api/pal/coherence/scopes|map|health` | JWT | `standard_id`,`subject_id` ints | coherence-map | tenant dropped on map/health (AI-B05); no try/catch around Neo4j |
| GET | `/api/pal/pedagogy-engine[?chapterId&concept&include_hidden]` | NONE | none | Next proxy | AI-B01 |
| GET | `/api/semantic-intelligence`, `/api/semantic-intelligence/{id}/result` | NONE (`routes/api.php:660-661`) | none | Next SSR (framework/ULU) | AI-B01 |
| GET | `/lms/palreport` | session/JWT hydrate + `check_permissions` | none | report page | no LIMIT, all attempts of year |
| GET/POST | `/result_personalize_marks` | same | POST: NO validation | personalize-marks | AI-B14 |
| GET | `/api/pal/eso/reports/attainment` | JWT staff-only | standardId int, syear string<=16 | reports/attainment | ok |
| GET | `/api/pal/workspace/students` | JWT | class-scoped for teachers | intelligence, attainment | out of slice |
| GET | `/api/pal/{learner-state,velocity,plateau,regression,disengagement-risk,failure-risk,burnout-risk}/{learnerId}`, `/misconception/cluster/{conceptId}`, `/remediation/{learnerId}/{miscId}` | JWT | learner ownership | intelligence page | no student deny |

**5c. Exposed by backend, NOT consumed by the frontend (for inventory)**
`GET gamification/specification`, `badges/earned`, `badges/{id}`, `POST badges/{id}/revoke`, `GET|PUT team-challenges/{id}`, `GET career-quest/progress`, `POST career-quest/interest` (client fn `declareCareerInterest` unused), `POST challenge-mode/submit`, `POST challenge-mode/class-availability`, `GET challenge-mode/leaderboard` (client fn `fetchLeaderboard` unused), `GET|POST notifications[/read]` (client fns unused), content-model `concepts/{slug}/ladder`, `nodes/{key}/revisions`, `concept-videos*` (6), coherence `learner/{id}`, `next/{id}`, `remediation/{l}/{c}`, `POST evidence`, ULU `POST/PUT/DELETE/duplicate/archive/approve`, `POST content/{id}/framework-metadata`, `POST /telemetry/xapi|batch`, `POST /ai/{explanation,remediation,practice,summary,teacher-insights}`.

---

#### Sub-part C - Enterprise Brain, Capability Intelligence, Career modules, People & Competency

###### 5a. Enterprise Brain (`/api/brain`, Laravel `routes/brain.php`; all behind `brain.auth`+`brain.tenant`+`brain.permission`)

| Method | URL (under `/api/brain`) | Consumed by (frontend) | Perm | Notes |
|---|---|---|---|---|
| GET | `/access` | `DashboardShell.tsx:304` | read | always `allowed:true` |
| GET | `/navigation` | **none** | read | backend-without-UI |
| GET | `/{t}/overview`, `/{t}/foundation` | **none** | read | `foundation` returns 100 people (email/mobile) + 100 students |
| GET | `/{t}/search?q=` | `ai-assistant/page.tsx:41` | read | **returns full raw `tbluser` rows** (AI-C02) |
| GET | `/{t}/departments`, `/{t}/people` | departments/people pages | read | people: email, mobile, gender, employee_no |
| GET/POST/PATCH | `/{t}/capabilities`, `/{t}/capabilities/{id}` | capabilities pages | read/create/update | POST inputs `criticality` unvalidated |
| POST/DELETE | `/{t}/capabilities/{id}/assign[/{assignmentId}]` | detail page | update/delete | target_id not tenant-checked |
| GET/POST | `/{t}/ingestion`, `/{t}/ingestion/run` | ingestion page | read/create | `limit` client-controlled |
| GET | `/{t}/kasba`, `/{t}/ai-assistant` | kasba, ai-assistant pages | read | ai-assistant lists all users' sessions/executions |
| GET/PUT | `/{t}/settings` | settings page | read / settings.manage | GET returns audit log (actor, IP in DB), API-key prefixes |
| GET | `/{t}/intelligence`; POST `/{t}/intelligence/run` | loop page | read/create | |
| GET | `/{t}/signals` | **none** | read | |
| GET | `/{t}/signals/{id}` | loop page | read | |
| GET | `/{t}/recommendations` | automation page | read | |
| POST | `/{t}/recommendations/{id}/decide` | automation page | **update** | no state guard; approve/reject by analyst |
| POST | `/{t}/executions/{id}/complete` | automation page, fees | **update** | no state guard |
| GET/POST | `/{t}/fees/intelligence`, `/fees/intelligence/run`, `/fees/accounts` | fees module | read/create | |
| GET/POST | `/{t}/{result,attendance,student,...,teach-learn}/intelligence[/run]` (26 modules) | `components/intelligence/module/contracts/*` | read/create | petty-cash, document-templates, ptm, consent have no `run` |
| GET/POST | `/{t}/{module}/integration`, `/workflows`, `/workflows/{key}/trigger` (+ `modules/` aliases) | Module integration/workflow sections | read / create | trigger returns fake success on DB failure (AI-C26) |
| GET | `/{t}/executive` | overview page | read | |
| GET | `/{t}/intelligence/{classes,departments,teachers}` , `/intelligence/students/{id}` | overview/departments/people/students | read | teachers: name+email; student: attendance/marks/homework/fees |
| GET | `/{t}/graph` | graph page | read | |
| GET | `/{t}/analytics`, `/knowledge`, `/automation`, `/students` | analytics/knowledge/automation/students | read | students: DOB, mobile, email (300 rows) |
| GET | `/{t}/sections/{s}`, `/{t}/screens/{k}` | SectionView / ScreenView | read | |
| GET | **`/{t}/modules/{m}/intelligence`** | `lib/brain/api.ts:411` → `module-intelligence.tsx:67` | — | **NO ROUTE** (AI-C18) |

###### 5b. Next.js route handlers in scope

| Method | URL | Auth | Notes |
|---|---|---|---|
| GET/POST | `/api/agents` | headers only (no token check on GET) | tenant from `x-sub-institute-id` |
| GET | `/api/agents/runs` | headers only | returns tool outputs (may hold student/fee data) |
| PATCH | `/api/agents/{id}` | Laravel `/api/permissions` via caller-supplied base URL | |
| POST | `/api/agents/{id}/run` | same | executes MCP read tools with caller's token |
| GET | `/api/conversational-ai/projects` | token presence only | |
| PUT | `/api/conversational-ai/projects/{id}/settings` | permissions via caller base URL | |
| POST | `/api/conversational-ai/projects/{id}/token` | same | issues plaintext service token |
| GET/POST/PUT/PATCH/DELETE | `/api/proxy?path=` | forwards caller's Authorization + Cookie | generic pass-through to any path on API base (used by all career modules) |

###### 5c. Competency / capability (`routes/competency_management.php`, `api.session`+`staff.only`) — consumed by the 5 `_lib/*-api.ts` files

Confirmed present: `competency/command-center[/filters]`, `competency/{frameworks[/{id}[/items|weights|clone]],studio/*,role-mapping/*,mapping-reviews[/bulk-approve],role-map[/{id}],definitions,approvals*,library/*,gap,kasba-rating,seed-library/preview}`, `competency-library/{competency-list,competency[/{id}[/detail|clone|archive]],competency-import,competency-export}`. **Missing:** `POST competency/competencies`, `POST competency/assessments` (Quick Create), `GET skill_library/{id}/edit` (web route only, under `web` middleware in `routes/lms.php:118-121`), `GET/POST lms/ai/*` (real path: `api/g2g-lms/course-builder/ai/*`, `g2g_lms.php:200-205`). `POST competency/library/jobrole-tasks` is intentionally owned by `task_management.php:100` (comment `competency_management.php:267-275`).

###### 5d. Career (Laravel `routes/lms.php:380-421`)

Public (no middleware): `careerExplore`, `careerExploreResult`, `careerCluster`, `allOccupation`, `OccupationDetails`, `getInstituteData`, `getCourseData`, `getEmployerData`, `ExploreSector`, `ExpertAdvice`, `intrestQuestions`, `intrestResults`, `intrestJobzone`, `intrestCareers`, `intrestEnterScore`, `intrestArea`, `matchProfile`. Consumed by frontend: `careerCluster`, `careerExplore`, `careerExploreResult`, `allOccupation`, `OccupationDetails`, `getInstituteData`, `getCourseData`, `getEmployerData`, `ExploreSector`, `ExpertAdvice`, `intrestQuestions`, `intrestResults`. Session (`session` middleware): `studentAspiration`(GET/POST), `studentAmbition`(GET/POST), `studentOriginality`(GET/POST), `careerAlignment`, `studentCareerEvidence`, `careerRecommendation` — frontend uses only `studentAspiration`, `careerAlignment`, `studentCareerEvidence`, `careerRecommendation`. `lms/lmsCounselling` under `session/menu/logRoute/check_permissions`.

###### 5e. People & Competency LMS (`/api/g2g-lms/*`, `api.session`+`staff.only`): consumed via `components/domain/lms/*` services — `assignments`, `assignments/{stats,pending,enrollments,learners,courses,request,bulk-status,bulk-review,import}`, `sessions-calendar/*`. Out of slice except `bulk-review` trace (AI-C07).

---

#### Sub-part D - AI console, workspace tabs, platform services, integration, migration modules, roadmap

###### 5a. `/api/ai/*` (Laravel, routes/ai.php) — all: `McpAuth` (JWT) + `McpRateLimit` (60/min/user, config/mcp.php:43) + `McpContextHydrator`. "Role" column = what the backend checks beyond JWT.

| Method | URL | Consumed by (frontend) | Validation | Role/authz beyond JWT | Notes |
|---|---|---|---|---|---|
| GET | /capabilities, /capabilities/{slug} | lib/intelligence/ai-capabilities.ts | slug regex | none | read-only |
| GET | /configuration/options, /configuration | ai-configuration.ts | — | none | returns `key_preview` = first4+•+last4 to any user |
| POST | /configuration | ConfigurationManager | validated (module/provider/model/key min…) | **none** | stores `api_key` plaintext (`AiConfigurationController.php:121-133`) |
| PUT/DELETE | /configuration/{id} | ConfigurationManager | id numeric | **none** | tenant-scoped |
| GET/POST/PUT | /configuration-models[/{id}] | ModelManager | validated | **none** | |
| GET | /templates/options, /templates/catalog, GET /templates/{id} | ai-templates.ts | — | none | |
| POST | /templates/preview | TemplateForm | — | none | |
| POST/PUT/DELETE | /templates[/{id}] | TemplateForm/List | validated | **none** | changes what the model is told for the tenant |
| GET | /modules/{m}/usage, /guardrails, /activity | ai-module.ts | module regex | none | |
| POST | /modules/{m}/activity | ai-module.ts (`logFeesOperation`, etc.) | `status in completed,failed,denied,skipped`, free-text message ≤2000, `result` array | **none** | client-asserted rows into `ai_audit_logs` (AI-D16) |
| GET/PUT/DELETE | /modules/{m}/models | ai-module.ts | — | none | |
| POST/PUT | /modules/{m}/models/credentials[/{id}] | ai-module.ts | key min 8 | none (tenant checked for update) | |
| GET | /policies/options, /policies | ai-policies.ts | — | none | `ensureDefaultExamplePolicy` writes a global example policy on first GET |
| POST/PUT/DELETE | /policies[/{id}] | policies/page.tsx | validated | none (cross-tenant readableBy check exists) | |
| GET/POST | /workspace/context, /workspace/flow | use-ai-workspace.ts | route ≤500, `selected_records` ≤100, `page_data` array | none | `page_data` = on-screen records ≤25×8 attrs |
| POST | /workspace/workflow-status | ActionsTab.loadRuns | route, entity, run_id | none | |
| GET/POST | /workspace/generate | CreateTab, AnalyseTab | template_key ≤120, `variables` free array | **no policy check** (AI-D11) | client `variables` override server facts (AI-D22) |
| POST | /workspace/report | CreateTab | `arguments` array | no policy check | writes a saved report |
| POST | /workspace/agents/{a}/run | AnalyseTab | limit ≤200 | manifest `allowed_roles` | cohort sweep |
| POST | /workspace/workflows/{w}/start | ActionsTab.start | input array | definition `allowed_roles` | rejects `recommendation_approved` triggers |
| POST | /workspace/ontology-views/{v} | ConnectionsTab | — | none | |
| POST | /ask, /ask/stream, /ask/interpret | ChatbotPanel/ai-journey/Next proxy | question ≤1000, `payload.{case_id,student_id,recommendation_id,workflow_approval_id}` ints | policy `ai_request`; **approve/reject reachable by sentence or payload** | |
| GET | /ask/intents, /ask/modules, /conversations/{id} | client.ts | — | none | conversation read is institute-scoped only; NOT VERIFIED whether user-scoped |
| GET | /signals, /cases, /cases/{id}[/evidence|/explanation|/recommendations], /subjects/{entity}/{id} | AiInsightsPanel (orphan), other panels | limits ≤200 | none | institute-wide (AI-D07) |
| POST | /cases/{id}/status | client.updateCaseStatus | `in:open,analysing,awaiting_decision,in_progress,closed,dismissed` | none | any user can close/dismiss risk cases |
| GET | /recommendations/pending, /recommendations/{id} | ActionsTab (via context), client.ts | — | none | |
| POST | /recommendations/{id}/approve | ActionsTab.decide, RecommendationCard | reason ≤2000, `modifications` array (stored, never consumed), `decided_by_name` ≤150 (client text), `start_workflow` bool | **none** | AI-D04/05/12 |
| POST | /recommendations/{id}/reject, /defer | ActionsTab, client.ts | reason, decided_by_name | none | reject-after-approve and defer-after-approve permitted (AI-D05) |
| GET | /agents, /agents/{a}, /agent-runs | DomainAgentPanel | — | none | |
| POST | /agents/{a}/run | client.runAgent | nullable filters | manifest roles | |
| GET | /workflows, /workflow-runs, /workflow-runs/{id}, /approvals/pending | DomainAgentPanel, ActionsTab | — | pending list filtered by assignee/role/null | list filtered, resolve not (AI-D06) |
| POST | /workflows/{w}/execute | client.ts (unused in slice) | input array, ids | definition roles | |
| POST | /approvals/{id}/resolve | ActionsTab.decideStep | decision approved/rejected, comment ≤2000, modifications | **none on assignee/role** | AI-D06 |
| GET/POST | /ontology/*, /knowledge-graph/* | client.ts wrappers | — | none | |
| GET | /templates | client.ts | — | none | |
| POST | /generate | ai-generate.ts (fees-ai-assist) | template_key, purpose, `variables` array | policy `generate_answers` (scope keys never validated, AI-D14) | |
| POST | /generated-outputs/{id}/review | client.ts | status accepted/edited/rejected | none | |
| POST/GET | /assistance/tickets, GET /assistance/tickets/{id}/screenshot | app/api/ai/assistance-tickets (lead) | — | screenshot needs `isAdmin`; index does not | index lists institute tickets to any user (NOT deeply verified) |
| GET | /reports/{id} | ai-reports page | — | none | |
| POST | /reports/{id} | ai-reports page | title ≤250, html required (no size cap, no sanitising by design) | **none** | |
| POST | /reports/{id}/regenerate | ai-reports page | — | none | |
| GET | /reports/{id}/recipients | ai-reports page | — | none | |
| POST | /reports/{id}/send | ai-reports page | `expected_recipients` int≥1, `confirm` accepted | **none**; no send-once guard | ≤200 recipients (`ReportSender::MAX_RECIPIENTS`) |
| GET | /outcomes, /outcomes/effectiveness, /audit-logs | client.ts | — | none | audit log readable by any user in institute |
| POST | /outcomes/measure-due | client.ts | — | `isAdmin` only | |

###### 5b. `/api/platform/*` (routes/platform.php) — `lms.auth` (warn-only: unauthenticated passes middleware, controller then 401s) on all.

| Method | URL | Consumer | Authz | Notes |
|---|---|---|---|---|
| GET | /registry | lib/platform/client.ts fetchRegistry | token → tenant | config from `config/platform_services.php` |
| GET/PUT | /notifications | NotificationConsole | PUT: `perm:platform.notification,update` (warn-only) | tenant from JWT |
| PUT | /notifications/channels | NotificationConsole | `perm:platform.notification,update` (warn-only) | per-tenant channel switch |
| GET/PUT | /scheduler | SchedulerConsole | PUT: `perm:platform.scheduler,update` | server validates cron (`CronSchedule::problem`) |
| GET/POST/PUT/DELETE | /workflow[/{id}] | WorkflowConsole | `perm:platform.workflow,create|update|delete` | `condition` stored, never evaluated (controller docblock line 24-27) |
| GET | /events/{overview,stream,failures,deliveries,audit,integrations} | EventBusConsole (lib/event-bus/client.ts, lead) | `lms.staff` + `perm:platform.eventbus,view` + `is_admin===2` for estate sections | reads only |

###### 5c. Others touched

| Method | URL | Consumer | Auth | Validation | Notes |
|---|---|---|---|---|---|
| GET/POST/DELETE | /api/migration-modules/{module}[/{id}] | MigrationModulePage, BazarUploadPage | JWT validity only; tenant from query/body | per-branch validator (store), none on index | AI-D03 |
| POST | /api/lms/concept-intelligence/tab-labels, /update, /reset | conceptIntelligenceTabLabels.ts | **none** | keys ∈ config, length ≤ max | AI-D10 |
| POST | /api/brain/{tenant}/recommendations/{id}/decide | contracts/fees.ts → lib/brain/api.ts | `brain.auth`+`brain.tenant`+`brain.permission:update` | status in approved/rejected/deferred, rationale 3-2000 | no state precondition (AI-D05) |
| POST | /api/brain/{tenant}/executions/{id}/complete | contracts/fees.ts | same | result in success/partial/failed | not idempotent (AI-D05) |
| GET/POST | /api/integration-configs, GET/PUT/DELETE /api/integration-configs/[id], POST /test (Next) | task-management integration-management-api.ts | header presence only | none | AI-D02 |
| POST | /api/ai/ask/stream (Next proxy) | ChatbotPanel | pass-through of Authorization; upstream from env | body forwarded verbatim | reviewed: does not add authority (route.ts:1-60) |

---

### 6. Business-logic notes (Input -> Validation -> Rule -> DB change -> Side effect -> Output) for the key flows

#### Sub-part E - Assistant panel, agent engine, event bus, catalogue, Laravel /api/ai cross-cut (lead auditor)

1. Approve a recommendation (chat button or ActionsTab): Input = recommendation id (path), optional reason, modifications, confirmation_token, client `decided_by_name` -> Validation = id numeric, scope institute, governance_passed, status not rejected/superseded/expired, not expired -> Rule = none about role or current status=pending -> DB = insert ai_decisions, update ai_recommendations.status, ai_cases.status, seed ai_outcomes -> Side effect = start workflow if `workflow_key` (best effort) + audit row -> Output = decision + workflow status. Defects: replay creates duplicates, approver spoofable, no role gate (AI-03).
2. Agent run: Input = agent id + tool + arguments -> Validation = agent in header tenant, RBAC `update` on agents.<module> (via header URL), agent active, tool in allow-list -> DB/file = append run row with full tool output -> Side effect = one MCP read call as caller -> Output = run row. All tools currently `read` or `draft` (script confirms 84 mcp/read, 15 local/draft, 1 intelligence/read, 0 write) so agents cannot mutate records today; the risk is data exposure via run log (AI-01).
3. Chat turn: Input = question, conversation_id, action payload (record ids the offered button was rendered against, replayed from client state / sessionStorage), module, route, meta -> Validation on Laravel (scope, policy) -> the payload comes from client and could be edited; the sentence drives intent; `ai_decisions` protections above apply. Model output rendered as React text; navigation hand-off built from numeric links (module-handoff.ts) - no open redirect found.
4. Stuck-user ticket: idle >= 120 s (visible tab, no click/key/submit) -> chat opens -> "No, I'm fine" -> html2canvas body -> ticket + screenshot. See AI-06. Threshold math: `thresholdMs` 120000, check every 5 s so worst-case fire at 125 s; idle counter continues while a modal dialog captures events (capture-phase listeners fine).
5. Field edit: value (<= 20k, truncated to 8000 chars silently in `buildFieldEditVariables`) + instruction -> Laravel generate -> `cleanFieldEditOutput` strips fences/openers -> `inspectFieldEditOutput` (refusal regex, 20x blow-up) -> human Apply + Save. Truncation mismatch (20k accepted, 8k used) means a long field is edited from its first 8000 chars and the tail is dropped when applied (Low, unverified against Apply behaviour).
6. Event Bus KPIs: read-only SELECTs; `failed_jobs` will always be empty while QUEUE_CONNECTION=sync (documented in sources.ts).
Adaptive-learning / competency / capability scoring logic reviews are in the sub-audit sections (A: PAL mastery/IRT; B: gamification, BKT admin settings; C: capability/competency/career scoring).

#### Sub-part A - PAL / ESO student-facing adaptive learning

**6.1 ESO diagnostic score (`scoreDiagnostic`, `EsoPolicyService.php:908-1072`).**
Input `responses[{node_id, answer_master_id}]` -> validation only integer types -> per node: `applyUpdate(correct, weight 2.0)` (`4629-4651`: `+/-0.2*weight`, clamp 0..1, `attempts++`, `consecutive_correct`, auto-flip guided->independent at 2 correct) -> `skip = estimate >= 0.80`; `cleanSweep = skip && wrong==0 && distinct questions >= 3`; `status = cleanSweep ? mastered : learning` (**overwrites an existing `mastered`/`retained` status** on re-submit); `skipInstruction` stamps `taught_at` -> `eso_response_log` (mode `diagnostic`), `learner_node_state`, decision log, evidence published to `pal_learning_evidence`/BKT/Neo4j. Arithmetic: with weight 2.0, 2 correct = 0.8 (the ADR-001 §4.2 floor now requires 3 distinct questions). Omitted items are not counted as wrong (see AI-A10). `diagnosticItems($concept, $tenant, 8)` picks `perNode = max(1, intdiv(8, nodeCount))`: 17 nodes -> 17 items, 3 nodes -> 6, 5 nodes -> 5 (the "8" is not a cap and not a target).

**6.2 Practice attempt (`recordAttempt`, `1964-2033`).** `mode = attempt.mode ?? state.practice_mode`, `hint_used` from client; `countsForMastery = !(independent && hint_used)`; correct/wrong via `isAnswerCorrect`; misconception distractor -> `STATUS_MISCONCEPTION_FLAGGED` immediately; then `evaluateProgress -> nextAction`. Evidence floor (`evidenceByNode`, `2959-3012`): distinct `question_id` per node, non-diagnostic/CFU/retrieval modes, within 30 days, "independent" = client-declared mode && !client-declared hint. K: 3 events, A: 3 events, >=1 independent; thresholds K 0.80, A 0.70 on **node mean over measured nodes only** (`masteryAcross`, `2901-2924`; a node with `attempts=0` is excluded, not counted as zero).

**6.3 Retrieval / retention (`retrievalCheck`, `3382-3458`; ladder `[2,7,30,60,180]` days; `scheduleRetention` `4664-4675`).** All submitted items correct -> `status=retained`, advance rung, `next_review_at = now()+interval`; any wrong -> `status=learning`, `-0.2`, ladder reset. **No check that the node is currently due, mastered, exists for the learner, or that the answers came from `retrievalItems()`.** D4 `masteryVerdict` (`2714-2727`) treats "all nodes already mastered/retained" as `legacyMastery` -> concept mastered, badges awarded. Time: all schedule maths use PHP/Carbon `now()` in `Asia/Kolkata` (`config/app.php:72`); `MasteryOverviewService::isDue/daysUntil` use `strtotime` (same tz) — consistent; `daysUntil` rounds **up** (`ceil`), so an item due in 3 hours shows "in 1 day"; `getSpacedRepetition` uses SQL `DATEDIFF(NOW(), created_at)` (DB clock; code comment at `EsoPolicyService.php:885-890` records the DB host running 2.5 h behind PHP) -> day-boundary off-by-one risk (NOT VERIFIED live).

**6.4 Dashboard aggregates (`chapterDashboard` 3734-3851, `conceptStatusFor` 3915-3960).** Status vocabulary: `locked | stale_mastery | mastered | in_progress | not_started | not_ready`; `masteredConcepts` counts `verdict.mastered` **including stale**; `chapter_complete` requires every section status `=== 'mastered'` (so a stale concept blocks chapter completion while still counted mastered) -> the client then collapses `stale_mastery` to `not_started` (AI-A13). `masteryVerdict(silent:true)` still writes `status=mastered` + retention schedule (`2778-2790`), i.e. GET dashboards mutate learner state (documented in the source, acceptable only with idempotence).

**6.5 Chapter diagnostic (legacy).** `DiagnosticScorer`: percentage = correct/served*100 (unanswered count as not correct, denominator = served, guarded for 0), levels 0/40/70/85 (config `pal_diagnostic.level_thresholds`), band weak<40, moderate<70, strong; `baselineDifficulty` caps hard->medium when >=2 hard served and 0 correct. Behaviour is deterministic and consistent between UI copy ("Unanswered questions score zero") and server. Different from ESO diagnostic where omissions are ignored (AI-A10).

**6.6 Adaptive difficulty (`AdaptiveDifficultyRule`).** Escalate after 3 correct in a row at the current band, de-escalate after 2 wrong, history threshold 3, availability clamp last; recent-run is filtered to `last_served` band (`ConceptPerformanceAnalyzer.php:334-337`) — good. Weakness: recency is by `id` (`orderByDesc('id')` at `ConceptPerformanceAnalyzer.php:314`, `AdaptiveLearningService.php:407`) but `recordAnswer` uses `updateOrInsert` on (student, concept, question) (`AdaptiveLearningService.php:165`), which keeps the old row id on re-answer -> streak/`last_served`/`current_difficulty` can be computed from stale ordering (AI-A17).

**6.7 Legacy practice mastery (`assessmentQuestionController`).** `updateConceptMastery` = all-time correct/total (no recency, no weighting) written as a new `lms_concept_mastery_log` row per answer + upsert of `lms_concept_mastery`; `updateForgettingCurve`: `retention = 0.6*old + 0.4*performance`, interval index = `review_count` (grows every review regardless of performance, intervals 1,2,4,7,14,30 days); `getSpacedRepetition` selects **every log row with mastery < 80** (no latest-per-concept) ordered oldest first -> duplicates and rows for concepts since mastered (AI-A16). `ans_status` encodings mixed (`1/0` from practice, `right/wrong` from PAL Test): `getPracticeHistory` `CASE WHEN a.ans_status = 1` labels every PAL-Test-derived correct answer "Wrong" and the PHP `accuracy` compares `ans_status == 1` (`assessmentQuestionController.php:2801,2831`).

**6.8 Client-side derived math (all guarded against empty denominators except where noted):** `computeConceptMastery` (`pal.ts:1051-1087`): `masteryLevel = min(100, round(accuracy + 2*correct))`, statuses at 70/40 — an arbitrary inflation (5/8 correct = 72 -> "Mastered") that disagrees with the server's own verdicts (AI-A15). `mapWorkspacePayload` percent = `readNumber(percent) || round(right/total*100)` (0% falls through to the recomputation — fine). `MasteryFigure` rounds `value*100` (value expected 0..1; the server sends 0..1 for ESO, **0..100 for `pal_competencies`/pedagogy** — units differ per endpoint). `adaptive/chapter/page.tsx:205` divides by `completion.measurable` (guarded by `> 0` at 194). `mastery/chapter/page.tsx:143` guarded. `ScoreRing`, `ProgressRing`, `BandMeter` clamp. Streak shown as `data.gamification.streakCurrent` days (server `StreakService`, not audited).

**6.9 IRT derivation (`pal:derive-irt`, `DeriveIrtCommand.php`).** Rasch `b = -logit(p)` with 1/(2n) clamp, classical 27% discrimination, `irt_a` approximated, `min_responses 30`; REVISE < 0.25, approve >= 0.30 (0.25-0.30 is a dead band). Inputs are `lms_online_exam_answer.ans_status` for **all** rows (all exam types, repeated attempts — despite the field name `first_attempt_correct_rate`), which for PAL Test is client-declared (AI-A06); ability proxy = student's global correct share (not "score on the same paper" as the docblock says at `:185-190`) and includes the item itself. Result: calibration is contaminated by tampering and by a weak ability proxy (AI-A22). All derived rows are written `quality_status='draft'` (good — nothing auto-served).

---------------------------------------------------------------------------------------------------------------------------

#### Sub-part B - New PAL (gamification, content model, administration, coherence map, pedagogy engine), reports

1. **Gamification read (any tab).** Input: bearer JWT (+ `learner_id` for staff). Validation: `PalApiAuth` ownership; audience narrowing. Rule: everything is derived from real attempts (`question_paper`/`lms_online_exam` PAL attempts, `pal_learning_sessions`, `pal_telemetry_events`, collaboration + team-challenge tables) via `LearnerActivitySource`. DB change ON A GET: `badges->evaluate()` inserts `LearnerBadge` + `GamificationNotification` (`BadgeService.php:49-95`), `personalBests->refresh()` upserts PB rows + events + notifications, `StreakService::recompute` upserts one `pal_streak_days` row per active day (`StreakService.php:75-83`) and `pal_learner_streaks`, `TeamChallengeService::progress` persists contributions and can mark a challenge completed. Side effects: a teacher's "view as student" load awards badges/notifications to the child; unique indexes (`pal_learner_badge_unique`, `pal_streak_day_unique`, `pal_personal_best_unique`) turn a concurrent double-request race into a 500 rather than a duplicate. Output: `{success,data}`; sections the audience may not see are removed. No mock/seed values anywhere; absent numbers are `null` (`readNullableNumber`), but `readNumber` defaults to 0 for many fields (e.g. `mastery`, `score`, `percent`), so a missing field would render as a measured 0.
2. **Streak math.** Day = `Carbon::toDateString()` in app tz `Asia/Kolkata` (`config/app.php:72`), single hard-coded tz for every tenant. A day qualifies when at least one activity rule is met and `productive_minutes >= min_productive_minutes` (default 10). Minutes = attempts duration + `pal_learning_sessions.duration_minutes` + `pal_telemetry_events.duration_seconds` (`LearnerActivitySource.php:563-608`). `walk()`: gap==1 -> +1; gap-1<=graceDays AND grace not used within `grace_reset_days` -> +1 and records grace day; otherwise reset; "current" is 0 unless last qualifying day is today/yesterday (or within an available grace). Correct for the documented rules; division by zero is guarded in the UI ring (`streaks/page.tsx:126-132`, `page.tsx:252-258`). Longest streak `ended_on` and grace bookkeeping consistent. Client-asserted inputs: xAPI `timestamp` and `duration_seconds` are accepted verbatim, uncapped (`TelemetryService.php:185-213`, `PALAPIController.php:679-720`) (AI-B18).
3. **Badges.** Catalogue from `pal_badges` (config seeded); `evaluate()` matches rules over `signals()`; award key = (learner, badge, scope_key); `revoke` marks `revoked_at`; revoked keys stay in `heldKeys` so they are never re-awarded (permanent). No XP/points concept exists in this module (there is no XP number to be fake).
4. **Challenge Mode (only leaderboard).** Opt-in (staff can toggle for a learner - AI-B26). Leaderboard: top N (default 5) of opted-in learners in the same standard (+division) for the current week (Monday start), first names for students / full names + `learner_id` for teachers (`ChallengeModeService.php:338-396`). Submit: score = accuracy x speedRatio(capped 2.0) x difficultyCoeff x 1000 computed server-side BUT `correct` and `time_seconds` per response are taken from the client body (`ChallengeModeService.php:235-243`), question ids are not verified as served/attempted, no per-week attempt limit, and `MAX(score)` is what ranks (AI-B07). No frontend caller for `submit` exists.
5. **Team challenges.** Teacher-only create (no UI path when class has no challenge: AI-B08); per-class limit of 2 active per rolling 7 days (`TeamChallengeService.php:61-70`); progress recomputed from live data every read incl. per-learner queries for the whole class (N x challenges). Student payload: class aggregate + own contribution only; per-student names only for staff.
6. **Content approval workflow (new content model).** Input `to_status` -> `PalVocabulary::isQualityStatus` -> `canTransition` per `config/pal_content.php:391-398` (draft->reviewed|deprecated; reviewed->pedagogy_reviewed|draft|deprecated; pedagogy_reviewed->piloted|approved|reviewed|deprecated; piloted->approved|pedagogy_reviewed|deprecated; approved->deprecated|reviewed; deprecated->draft). Machine actors (`ai`) may not write human-only statuses nor edit approved rows (`ContentModelAuthoringService.php:149-151,265-267`). Approval requires no missing mandatory fields and `gap !== true` (`:284-295`; legacy service has no such check). Stamp: `reviewed_by/reviewed_at` set for reviewed/pedagogy_reviewed/approved. There is NO rule that reviewer != author, no distinct approver role, no second signature; the same non-student user can create, review, pedagogy-review and approve, and the UI text says so ("Approve it yourself once you agree", `authoring/page.tsx:271`). Replay of a transition is refused (state check). No optimistic-concurrency on transition (two reviewers race; last writer wins). Editing an APPROVED node resets it to `reviewed` (`:214-219`) but editing `pedagogy_reviewed`/`piloted` content keeps the status, so text can change after pedagogy review without re-review (Low, AI-B23). Only `approved` is servable (`config/pal_content.php:388`).
7. **Administration write.** Input `{group,value}` -> registry sanitises (non-editable fields dropped, ranges checked) -> upsert `pal_architecture_settings` per (scope, subsystem, group) -> `MasteryUpdater`/`SubsystemRuntime` read these live (`MasteryUpdater.php:240`) -> immediate effect on next mastery update for all learners in scope; `updated_by` is NULL (AI-B06); no history/version table; reset deletes the override row (no undo).
8. **AI enrichment (content model).** Input node key + kind -> lexicon pass first (no LLM for cultural context if lexicon decisive) -> `ContentModelLlmClient::json` to the provider from `ai_api_keys` (DeepSeek/OpenRouter class), 180 s synchronous HTTP timeout, temperature 0.2, cached in `pal_cm_enrichment` by input fingerprint for 30 days per tenant. Data that leaves: subject, grade, concept name, definition, textbook evidence lines, node body/prompt, skills, misconception tags - curriculum text (possibly copyrighted textbook extracts), no learner PII, no user ids in prompt. Output must validate against closed vocabularies, returned as a draft tagged `ai`; `apply=true` writes a draft override that cannot touch approved rows. `AiFieldAssistant` on the body textarea sends the raw body + label/module/page context to `/api/ai/field-edit` (other part).
9. **Personalize marks.** Input rows {std/div label, free-text student name, free-text enrollment no, subject, exam, total, obtain} -> client regex + `obtain<=total` -> POST form-encoded -> server: NO validation; inserts one row per input row into `result_personalize_marks` with the JWT tenant and client `syear`; returns `status_code=1` "Data Added Successfully" even if no row was inserted (assignment sits outside the `if`), duplicate submissions insert duplicate rows (no unique key/upsert), student identity is never resolved (no check that the enrollment no exists or matches the name).
10. **Coherence map (Neo4j).** Scope list from Neo4j `:Concept` counts; map from Neo4j; when Neo4j auth fails every call throws -> Laravel 500 -> UI banner (see AI-B12). Administration health separately probes Neo4j and returns the raw exception message text to any non-student (`ArchitectureHealthService.php:257`).

---

#### Sub-part C - Enterprise Brain, Capability Intelligence, Career modules, People & Competency

**6.1 Brain health scoring (`HealthScores.php`, `enterprise-brain/page.tsx`)** — Input: LMS tables -> Rule: each dimension maps a rate onto a hard-coded band (attendance 70-95%, engagement 60-100%; `HealthScores.php` attendance/engagement blocks) with a 20% coverage floor -> overall = plain mean of scored dimensions (`round(array_sum/count)`) -> Output 0-100 + band. Edge cases: (a) overall shows as a single number even when only 1 of 8 dimensions is scored (hero shows "Overall health 80/100 Good"; `scoredDimensions` is not shown next to it) — AI-C31; (b) thresholds `-4` points (class attendance) and `-15` (homework) are hard-coded in PHP and duplicated in `page.tsx:848,886,894`, while `config/brain.php` exposes `class_attendance_gap_points`/`subject_homework_gap_points` knobs that these code paths do not read; (c) `$lagging[0]` is described as "the lowest" but no sort is applied in the filter (`HealthScores.php` attendance `why`); (d) division by zero is guarded (`$students === 0`, `$total < 30`).

**6.2 Recommendation decisions/outcomes (`BrainIntelligenceController.php:232-496`)** — decide: validates status/rationale; inserts decision, updates recommendation, queues an execution when `eso_id` present; **no check that the recommendation is still `pending`** (re-decide creates a second decision + second queued execution); executionComplete: **no check that the execution is still `queued`** (duplicate outcomes); `measuredChange = before - after` (`:456`) labelled "Change in X" (sign inverted from a naive before->after reading); outcome `confidence` is hard-coded 0.9/0.6/0.3 from the user-chosen result (`:487`) while the Analytics screen says confidence is "Computed from evidence, never asserted". AI-C05/AI-C33.

**6.3 Command Center KPIs (`CommandCenterService.php`)** — `summary()`/`progress()`/`workQueues()`/`assessmentCalendar()` hard-code assessment metrics to 0 (`:161,191-193,238-239,301-307`) with the class doc claiming the tables "do not exist" — while `CapabilityIntelligence.php` doc states they exist but are empty. "Certification Compliance" = `valid / non-revoked` counts by the **stored status column** (`:198-202`) although the Brain's own data-quality check documents certifications past expiry still marked valid (`CapabilityIntelligence.php:361-377`) => overstated compliance (AI-C27). "Job Roles Mapped" joins `sj.jobrole = jr.jobrole` (`:82`) — the Brain class doc measured this join returning **zero** mapped roles at an institute with 50,231 mapping rows, and that the correct join is `sj.skill = jr.jobrole` (`CapabilityIntelligence.php:29-44,449`). Command Center also counts role *rows* (`count()`), Studio counts distinct names (`CompetencyStudioController.php:211-219`): two definitions of "total roles" (AI-C10).

**6.4 Competency roll-up / gap (`ProficiencyService::rollUp`, `CompetencyGapController`)** — Input: `competency_kasba_item.weight` x `competency_kasba_rating.rating` (1..5) -> weighted mean over MEASURED items only (`ProficiencyService.php:82-106`) -> level (2dp) or `null` if nothing measured; gap = `required - level` only when `level < required`; unmeasured is its own state (good design). Edge cases: if every rated item has weight 0, `measuredWeight` = 0 -> level null (treated "unmeasured" although rated); a competency with no KASBA items returns null/coverage 0; no clamp on rating range beyond the controllers' 1..5 validation. **The tenant "Weighting & Configuration" (scoring model, rounding, unmapped handling, target threshold, apply-to, category weights) is stored but read by no scoring code** (only `ManagesCompetencySettings` reads/writes it) — AI-C11. Category weights are validated 0..100 per row but never required to sum to 100 (`CompetencyStudioController.php:638-641`); the UI only colours the total (`framework-mapping.tsx:886`) and Save is not disabled. Proficiency scale can be edited to 20 levels / deleted with no dependency check (`:436,534-566`) while every rating/requirement/skill-level validator is hard-capped `1..5` (`CompetencyRoleMapController.php:108`, `KasbaRatingController.php:143`, `EmployeeCompetencyProfileController.php:340,428`).

**6.5 Career match (`KnowledgeMatchService`, `AlternativeOccupationRecommender`)** — Input: correctly answered questions in evidenced papers -> exact-match `subconcept` to chapter `semantic_intelligence.knowledge` label -> student knowledge profile -> per occupation, for each O*NET knowledge element take the student item with best Jaccard token overlap over `subject_name + concept + knowledge` (threshold `min_match_score` 0.15) -> `matchPercentage = Σ importance of matched elements / Σ importance x 100` (`KnowledgeMatchService.php` matchKnowledge) -> band (config 0.75/0.5) and ALIGNED if >= 0.5. Rule problems: uses only importance (`IM`), ignores the occupation's required **level** (`LV`) and the student item's confidence/count; one student item can satisfy many elements; matching is purely lexical so subject names in Indian curricula ("Social Science", "Gujarati") barely overlap O*NET domain names — the service's own docblock admits scores "stay near-zero elsewhere"; `matchPercentage` therefore measures vocabulary overlap, not knowledge; ties in ranking are unordered (`usort` on score only, PHP 8 stable so DB order wins). Performance: `rankAllOccupations` loads all `onet_knowledge` rows for every request (≈900 occupations x ~33 elements x 2 scales) and does `array_intersect` per pair. Frontend `classifyBand` hard-codes 75/45 (`career-intelligence/_lib/api.ts:184-188`) duplicating env-tunable config -> drift (AI-C23).

**6.6 Career alignment (CaiCore)** — only occupation `17-1011.00` (Architect) is mapped (`CaiCoreService.php` `OCCUPATION_MAP`), board hard-coded `CBSE`; every other aspiration returns `INSUFFICIENT_DATA`; needs Neo4j (memory: dev Neo4j auth broken; prod NOT VERIFIED). UI shows "Tell us what you want to be first" for INSUFFICIENT_DATA **and for any request failure** (`CareerIntelligenceHub.tsx:410,431-437`) even when the student already saved an aspiration (AI-C24).

**6.7 RIASEC / interest profile** — scoring is done server-side by O*NET (`intrestResults`); client only encodes 60 digits (`KnowingYourselfHub.tsx:60-68`) after forcing all 60 answered (`QuizPanel.tsx:38-39`), so no hole/misalignment. Top area picked by `reduce` with strict `>` -> ties resolve to the first area in API order (R,I,A,S,E,C order bias); `maxScore` prop passed to `ScoreTile` is unused; result is never persisted (only in URL `?answers=`); MBTI attempt "result" is `obtain_marks` (a number). No divide-by-zero possible client-side. (AI-C34.)

**6.8 Occupation detail percentages (`OccupationDetails` `ROUND(100*data_value/sr.maximum)`)** — `sr.maximum = 0` yields NULL (no SQL error) and the UI guards `typeof percentage === 'number'`. Bar width `${percentage}%` unclamped.

**6.9 Assignments approval / bulk (`use-assignments.ts:139-160`, `learning-assignments.tsx:1175-1230`)** — DataTable selection ids are `String(rowIndex)` (`data-table.tsx:121,128,191`). Queue tab: index maps into the **unfiltered, unpaged** `assignments` state while the table shows `pagedAssignments` of `filteredAssignments` -> wrong rows updated once any filter or page > 1 is used. Approval/Enrollments tabs: `selectedIds.map(Number)` (indices 0..n) is sent as `ids` to `bulk-review` (`AssignmentsController.php:613-623` `whereIn('id', $ids)` scoped to tenant + `pending`) -> rejects/approves rows whose primary key happens to equal the row index, otherwise a silent "0 request(s) approved" (AI-C07).

**6.10 Rounding / NaN checks** — no `toFixed` on unchecked values in slice except `career-intelligence/_components/CareerIntelligence.tsx:91` (`score.toFixed(2)` on a typed number) and `MatchingOccupationsCard` (`matchPercentage.toFixed(1)`; type says number, backend `round(…,2)` returns float); `BarSeries/CompletenessSeries` guard zero denominators; `Delta` guards NaN. Weights: see 6.4. Median: `LmsActivityIntelligence.php:477` takes the upper-middle element for even counts (AI-C33).

---

#### Sub-part D - AI console, workspace tabs, platform services, integration, migration modules, roadmap

###### 6.1 Action approval flow (Actions tab) — Input -> Validation -> Rule -> DB change -> Side effect -> Output

1. **Input.** `ActionsTab.decide(id, 'approve'|'reject')` (ActionsTab.tsx:94-136). `id` = `recommendation.id` from `pendingRecommendations` prop (server-supplied list from `/workspace/context`). Body sent by `approveRecommendation` (client.ts:324-344): `{reason?, modifications?, decided_by_name?, start_workflow: true, meta:{institute_id, academic_year, term_id}}` + bearer + `X-MCP-Institute-Id`. When the user pressed "Use this" in Create, `modifications = {activity_content: <draft>, source:'reviewed_in_workspace'}` (ActionsTab.tsx:108-110). Reject sends only `id` (no reason).
2. **Validation (backend).** `RecommendationController::approve` (lines 60-95): `reason ≤2000`, `modifications array`, `start_workflow bool`, `decided_by_name ≤150`. `DecisionGate::record` (114-215): `userId>0`; recommendation must exist **in the same institute**; for approve `assertApprovable` (225-243): `governance_passed` true, status not in `rejected|superseded|expired`, `expires_at` not passed.
3. **Rule gaps.** No role check. No requirement that the recommendation belongs to the entity on screen. No requirement that the approver is the assignee/owner of the case. Status `approved` and `executed` are NOT blocked, so a second approve is accepted. `reject` and `defer` have no precondition at all.
4. **DB change.** In a transaction: INSERT `ai_decisions` (decision, reason, `modifications` JSON, `decided_by`, `decided_by_role`, client-supplied `decided_by_name`, ip, user_agent) ; UPDATE `ai_recommendations.status` = approved | rejected | (defer → `pending_approval`) with no `WHERE status=` guard; UPDATE `ai_cases.status`; on approve INSERT `ai_outcomes` (pending measurement). Then, outside the transaction, `startWorkflow` (RecommendationController:90-92, 157-190) — every approve call starts another workflow run when the recommendation names a workflow.
5. **Side effect.** Workflow runs; consequential steps call `GovernanceValidator::authorizeExecute` which requires status `approved|executed` and the **latest** decision to be `approved` (GovernanceValidator.php:102-165). The only concrete action reviewed, `CreateAcademicInterventionAction`, is idempotent per `recommendation_id` (lines 55-68) — this is the one thing that stops a replay creating a second intervention. Other actions/steps: NOT VERIFIED.
6. **Output.** Toast "Approved. The process has started…" (ActionsTab.tsx:116-120). `modifications.activity_content` is stored on the decision and **never read by any downstream code** (grep of `app/` for `'modifications'` finds only DecisionGate/WorkflowEngine/controllers). The intervention's content comes from the workflow's own generated state (`generatedActivity($state)`, CreateAcademicInterventionAction.php:153-166). => AI-D12.
7. **Double click / concurrency.** UI: `busyId!==null` disables all Approve/Reject buttons (ActionsTab.tsx:233,246) and RecommendationCard has its own `busy`; WorkflowProgress disables while `resolving`. Cross-tab / two users / API replay: no protection (no `WHERE status='pending_approval'`, no row lock, no idempotency key; `confirmation_token` accepted but only stored).
8. **Workflow step approval.** `WorkflowProgress.decideStep` → `resolveApproval(pending.id)` where `pending` = first approval with `status==='pending'` in `run.approvals`. Server: institute + `pending` only; sets status; `closeRun(rejected)` or `markApprovalPassed` + `advance`. The pending-list query filters by `assigned_to = me OR NULL OR approver_role = role` but the resolve does not (AI-D06). The check-then-update is not atomic (two concurrent resolves both pass `status==='pending'`).
9. **Brain path.** `BrainIntelligenceController::decide` (lines 232-330): tenant-pinned, validated, rationale required (min 3) — but no check of current recommendation status; each call INSERTs another `hpbrain_decisions` row, flips `hpbrain_recommendations.status`, and (approved + eso_id) INSERTs another `hpbrain_eso_executions` row. `executionComplete` (389-…) does not check the execution's current status and INSERTs another outcome each call. `measuredChange = before - after` (line 456) presumes "lower is better"; for a metric where higher is better the sign is inverted.

###### 6.2 Create tab -> generation
`generateForContext({route, template_key, entity_type, entity_id})` (workspace.ts:335-346) → `/workspace/generate`. Server builds variables = server facts + `pageVariables` (from client `page_data`, capped) + **client `variables` merged LAST** (WorkspaceController.php:~236-246). `GenerationService` renders the stored template (`ai_templates`) — no inline prompt from the client, `SafetyChecker::inspectPrompt` pattern-checks for injection (GenerativeAI/SafetyChecker.php:27-60). Output shown as `whitespace-pre-wrap` React text (CreateTab.tsx:347); structured `activities[]` rendered as text; no HTML/markdown rendering anywhere in slice (0 `dangerouslySetInnerHTML`). The only link derived from server output is `report.template_link` (`<a href target=_blank rel=noreferrer>`, CreateTab.tsx:190-198) — NOT VERIFIED how the backend builds it (expected `/ai-reports/<id>`).

###### 6.3 Policy resolution (`AiPolicyResolver`)
`resolve(institute, ctx)`: candidate scopes global, academic_year, grade, course, class, assignment, assessment, activity (line 179-188) — **no `module` scope**. `operationAllowed`: no policy or inactive → allowed; `ai_free` → deny; `ai_empowered` → allow; else map `operation` → rule flag (`ai_request`→`use_ai_for_explanations`, `generate_answers`→`use_ai_for_generating_answers`, unknown operation → allowed). Only `/ask*` (`operation:'ai_request'`) and `/generate` (`operation:'generate_answers'`) call it; both read `scope_type/scope_id/...` from `$validated` keys that are not in their validation rules (AskController.php:253-254; GenerationController.php:76-77), so only global/`payload`-derived scopes can ever match.
Line 217: `$matches[] = $row + ['priority' => $level];` — `$row` is a `stdClass` from `->first()` (Laravel 12, no FETCH_ASSOC configured). `stdClass + array` is a `TypeError` in PHP 8 → see AI-D13.

###### 6.4 Phase-9 calculations in the slice
| Location | Calculation | Finding |
|---|---|---|
| platform-administration/page.tsx:80 | `liveCount of allItems.length available today`; `isDelivered = live||pilot` | counts "pilot" as available; N of hard-coded rows; empty list prints "0 of 0" (no NaN). Customer page states elsewhere "no scorecard on purpose" (platform-roadmap/page.tsx:8-17) but this page prints exactly a scorecard |
| ai/page.tsx:73-80 | `capabilityStatusCounts()` → "N live, N in progress, N coming soon" | static registry (AI-D18) |
| ActionsTab.tsx:307-308 | `percent = total>0 ? round(completed/total*100) : 0` | guarded |
| conceptIntelligenceGuide.ts:291-301 `describeConfidence` | `fraction = v>1 ? v/100 : v`; `Math.round(fraction*100)%` | `Number('')===0` → missing confidence shown as "0% — the AI is not sure" (ConceptIntelligenceTabs.tsx:414-418 `describeConfidence(s(k.confidence))` where `s(undefined)===''`); value 1 (meaning 1%) → 100%; 9500 → "9500%"; no clamp |
| conceptIntelligenceGuide.ts:308-312 `toCoveragePercent` | `round(v>1 ? v : v*100)` | same `Number('')` = 0 → 0% bar; ambiguous 1 |
| AnswerSections.tsx:109-121 `percentOf` | strips every non-digit/dot then range-checks 0-100 | sign lost ("-12 percent" → 12); digits from other numbers concatenate ("1 (5%)" → "15" → 15% bar); mitigated by `looksLikePercent` + `<=100` |
| lib/platform/cron.ts | 5-field cron parser/next-run | `1-5-7` accepted as `1-5` (split('-') takes first two); DOW 7 rejected (standard cron allows 7=Sunday); `*/n` in day-of-month counted as "restricted" (Vixie treats a leading `*` as unrestricted for the OR rule); `nextRunAt` uses the **browser's** timezone while the server fires in its own; "every 7 minutes" sentence is wrong for steps that do not divide 60 (cron restarts each hour) |
| module/format.ts:35-38 `percent` | `value>=10 ? round : toFixed(1)` | null→"—" (good), no NaN |
| Template merge (server) | `TemplateRegistry` variable substitution | not reviewed beyond `cap(json_encode…)` mention |
| Coverage / divide-by-zero | none found client-side other than above | — |

###### 6.5 Integration/Migration flows
- Integration card grid: `configs.find(c => c.provider_key === provider.key)` against `/api/integration-configs` (in-memory). SMS/WhatsApp/SMTP/Razorpay are saved by other screens against real backends, so their card always reads "Not configured".
- Migration modules: `Array.isArray(payload.data?.records) ? records : []` (MigrationModulePage.tsx:26). For `bazar-reports` and `students-marks` the backend returns `['records' => $q->paginate(...)]` (controller lines 68-69) — a paginator object, not an array — so the page always shows "No records found".

---

### 7. Test / documentation coverage for your scope

#### Sub-part E - Assistant panel, agent engine, event bus, catalogue, Laravel /api/ai cross-cut (lead auditor)

- 20 test files in scope (lib/agents x2, lib/ai x2, lib/brain x5, lib/chatbot-storage, lib/intelligence x6, lib/pal x2, lib/platform, lib/roadmap): 218 tests, 216 pass, 2 fail (AI-11).
- No tests for: ChatbotPanel, hooks, PageAiContext, Next /api/agents|/api/ai routes (auth), app/pal/**, app/enterprise-brain/**, capability/career pages, new PAL (Laravel side also none for gamification/content-model per sub-audit B). The `npm test` glob only covers `lib/**` and `packages/**`.
- `scripts/check-agent-catalogue.ts` is not in CI and gives false comfort on two pairs (AI-10).
- Docs: `docs/AI_FIELD_ASSISTANT.md`, `docs/universal-conversational-ai-platform.md`, `PAL-V4-Frontend-Change-Map.md` reviewed by D (stale counts, nonexistent security.ts reference: PLT-24). `lib/event-bus/sources.ts` header stale (AI-15).

#### Sub-part A - PAL / ESO student-facing adaptive learning

* Frontend: only `lib/pal/diagnostic-answers.test.ts` (99 loc) and `lib/pal/exam-answers.test.ts` (255 loc). **No tests** for `eso-answers.ts`, `practice-answers.ts`, `pal-completion.ts`, `pal-feedback.ts`, `pal-eso` mappers (incl. the `stale_mastery` collapse), `pal-intervention` trigger rules, `computeConceptMastery`, `scopeToAttempt`. No component/E2E tests for any PAL page.
* Backend: substantial ESO coverage exists (`tests/Feature/Eso/*`: Authorization, PolicyService, ChapterDashboard, LearningPath, FlowParity/Conformance/Pin, ConceptMasteryDetails, KnowledgeMap, PilotMetrics; `tests/Unit/Eso/*`). `EsoAuthorizationTest.php` covers identity, not the tamper paths in AI-A04. No feature tests found for `palController@show/store` injection/ownership, `assessmentQuestionController` auth, `DiagnosticService` (`tests/Feature/Pal` exists but not exercised here — NOT VERIFIED contents).
* Documentation: source comments are extensive but several are **wrong** today (answer-key claims, `pal-completion` says "eight screens", `EsoStudentOnlyAuth` docblock vs `PalApiAuth` staff "view as" wording). `docs/CHAPTER_1014_*` in the Laravel repo referenced but not read.

---------------------------------------------------------------------------------------------------------------------------

#### Sub-part B - New PAL (gamification, content model, administration, coherence map, pedagogy engine), reports

- Frontend: 0 test files under `app/pal/new`, `app/pal/content`, `app/pal/report*`, `app/pal/intelligence`, `app/pal/pedagogy-engine`, `lib/new-pal`, `lib/module-ai`. Repo tests touching PAL are only `lib/pal/diagnostic-answers.test.ts`, `lib/pal/exam-answers.test.ts`, `lib/roadmap/catalog.test.ts` (unrelated to this slice).
- Backend: `tests/Feature/Pal` has `PalUluAuthorizationTest`, `PalTeacherScopingTest`, `PalMisconceptionAuthTest`, `PalAttainmentReportTest`, `PalWorkspaceStudentListScopingTest`, `PalFlowAdminScreenTest`, etc. There is NO test for `NewPalGamificationController`, `NewPalContentModelController`, `PalArchitectureController`, `CoherenceMapController` tenancy, `PalContentIntelligenceController::transition/bulkTransition` tenancy, `PedagogyEngineController` auth, streak/badge/challenge math (`tests/Unit/Pal` only has `SettingCoercerTest`).
- Documentation: extensive header comments in every data client and page (accurate for the gamification pages; inaccurate where noted: NewPalNav says "Coherence Map ... listing it is correct" but shell/routeMapper have no entry; `PalArchitectureController` docblock says "admins read and write, per ArchitectureRegistry::mayWrite" while mayWrite's profile branch is unreachable; `CoherenceMapController` docblock says tenancy for map routes comes from the token but it is dropped; `PedagogyEngineController` docblock says "no learner or tenant scope" while the service reads platform-wide telemetry and every tenant's extracted chapters).

---

#### Sub-part C - Enterprise Brain, Capability Intelligence, Career modules, People & Competency

- `lib/brain/*.test.ts` (5 files): navigation/route-uniqueness, tone mapping, year-in-request and tenant-from-session for the **fees** client. **No tests** for: Brain API error handling, any Brain page, capability/competency scoring, career match, RIASEC encoding, assignments selection logic, agent/conversational-AI authz. `lib/agents/engine.test.ts` and `lib/ai/conversational-admin/service.test.ts` exist (engine/service level with stub authorizer — they do not test the header-trust or base-URL problems).
- `lib/session/internal-access.ts` header says its behaviour is "pinned by `internal-access.test.ts`" — **that file does not exist** (`ls lib/session` = `internal-access.ts` only).
- Docs: `docs/enterprise-brain/INTEGRATION_AUDIT.md` is a design record with developer-machine paths (`C:\Users\omshivay\...`) and stale claims (says `app/capability-intelligence/*` targets `/api/ai/...` "not present" — it now targets `/api/competency/*`, which exists; says `next_lms_erp` has no `vendor/`). `NEXT_PUBLIC_BRAIN_API_BASE_URL` is undocumented in `.env.example`.

---

#### Sub-part D - AI console, workspace tabs, platform services, integration, migration modules, roadmap

Tests present: `lib/intelligence/{ask-adapter,ask-stream,module-handoff,row-action,sse,ui-messages}.test.ts`, `lib/platform/cron.test.ts`, `lib/roadmap/catalog.test.ts`, `lib/ai/ai-capabilities.test.ts` (checks solution ids vs project-resolver). 9 test files for ~30,760 lines of in-scope source.
Not covered: `client.ts` approval functions, `workspace.ts`, ActionsTab/CreateTab/AnalyseTab, every `app/ai/**` page, platform-services consoles, migration-modules, integration pages/route handlers, ai-reports page, all `components/intelligence/module/*` (incl. `describeConfidence`/`percentOf`).
Backend: only `tests/Unit/AiPolicyIsolationTest.php` (cross-tenant readable check) exists for the policy resolver; nothing exercises `AiPolicyResolver::resolve` with a matching assignment (see AI-D13), `DecisionGate`, or `WorkflowEngine::resolveApproval` state transitions (grep of `tests/` for the resolver returned that one file).

Documentation accuracy:
- `PAL-V4-Frontend-Change-Map.md`: "All 47 `page.tsx` files under `app/pal/` and `app/h5p/`" — `git ls-files 'app/pal/**/page.tsx' 'app/h5p/**/page.tsx'` = **112**; 65 are undocumented (all other H5P types, `pal/adaptive|diagnostic|eso|feedback|intervention|learn|mastery|plan|recall|reports/attainment|new/ai-stack|new/coherence-map|_dev-preview`). Every route it does list exists. The "exactly five files changed" claim is not verifiable from the tree. Teacher-scope claim "enforced server-side by class/subject assignment" is a PAL statement (not verified here); the AI API has no such scoping (AI-D07).
- `docs/universal-conversational-ai-platform.md:71-85` lists `packages/conversational-ai-core/src/{audit,context,conversation-focus,entity-selection,followup-state,history,memory,response-schema,schemas,security,types}.ts`; only `file-store.ts` and `followup-suggestions.ts` exist. `docs/conversational-ai-architecture.md` (27 lines) correctly says the Next.js brain was retired — so the 507-line document is stale.
- `packages/ai-intelligence-core/src/registry.ts` cites `packages/conversational-ai-core/src/security.ts` as covering "prompt injection and tool execution" (line 228) and `packages/conversational-ai-core` as holding "the runtime" (lines 24, 303, 560) with capability status `live` (line ~312). Neither exists (AI-D24).
- `docs/VERIFIED_GENERATIVE_AI_FIELD_COVERAGE.md`: all 40 routes listed exist as pages; "Working" status not verified (AiFieldAssistant is in the lead's slice).

---

### 8. NOT VERIFIED items (each with reason)

#### Sub-part E - Assistant panel, agent engine, event bus, catalogue, Laravel /api/ai cross-cut (lead auditor)

- Live env values (`LMS_API_AUTH_ENFORCE`, `NEXT_PUBLIC_AI_BASE_URL`, `AI_UPSTREAM_BASE_URL`, providers): .env not readable by rule.
- Whether `.data/agents.json` exists/contains runs on any deployment: no runtime access.
- Exploitability of AI-01/02 over the network (curl not run; network calls forbidden).
- Whether Laravel sanitises question HTML on write (see sub-audit A).
- Whether any Laravel global middleware adds role checks to `/api/ai/*` (routes/ai.php group lists only Mcp*; Http Kernel 'api' group not inspected in detail).
- Full read of lib/agents/executors.ts (2023 lines), registry.ts (1692 lines): sampled/executed rather than read; draft executors' wording not reviewed.
- Whether `decided_by_name` is displayed anywhere to approvers.
- Browser behaviour of Web Speech API audio upload varies by browser/vendor; asserted from platform documentation, not tested.

#### Sub-part A - PAL / ESO student-facing adaptive learning

1. Runtime behaviour of everything (no servers run). All "Confirmed" issues are code-reading confirmations, not exploited.
2. Whether `routes/web.php:87-134` are additionally protected by a reverse proxy/WAF or by a global route-level guard not visible in `Kernel.php` — REASON: only PHP code inspected. (`Kernel.php` `web` group has no auth; no `RouteServiceProvider` group wraps the file.)
3. Live DB columns: `question_paper.syear` default (palController::store never sets it while `palreport` filters `q.syear = $syear`, `palController.php:3514`), `lms_online_exam_answer.ans_status` type/values, `answer_master.answer` content actually containing HTML/script, `tblstudent_enrollment.syear` format (`2025` vs `2025-2026`).
4. That `JWT_TTL_MINUTES` is set in production (`ApiLoginController.php:427-432` default = non-expiring tokens) — env not read.
5. Effective CORS (`HandleCors`) and CSRF behaviour on production hosts: `VerifyCsrfToken` lists `https://erp.triz.co.in/*`, `https://dev.triz.co.in/*` (matches every path on those hosts) — impact on CSRF for cookie-session users unverified.
6. DB/PHP clock skew (2.5 h noted in `EsoPolicyService.php:885-890`) — current state unknown.
7. Tenant data reality from memory (nodes only for tenant 1, 0 approved content, calibration split) — **not re-measured**; it explains empty states but the code does not depend on it.
8. `PedagogyEngineController` routes at `web.php:91-100`: unauthenticated registration confirmed; per-method exposure only partially read (`buildStudentProfile`, `getForgettingCurve`, `updateForgettingCurve` take `student_id` from the request).
9. `EsoFlowPipeline` path (`pal_flow.guards.engine = pipeline`) not read; findings apply to the `legacy` default engine (config value in live env NOT VERIFIED).
10. Neo4j / gamification side effects (`neo4jCreate*`, `BadgeService`, `StreakService`) — memory says Neo4j auth is broken; behaviour on failure not verified.
11. `PalContentView`, ULU/framework pages, `pal-v4`/`pal-content*` bodies, DiagnosticPanel body.
12. That React 19 blocks `javascript:` URLs in `href` for `CorrectiveResource`'s `<a href={url}>` (`eso/page.tsx:2343`) — assumed from framework behaviour, not tested.

---------------------------------------------------------------------------------------------------------------------------

#### Sub-part B - New PAL (gamification, content model, administration, coherence map, pedagogy engine), reports

1. Whether `PalApiAuth`'s JWT `id` for a student equals `tblstudent.id` (gamification/coherence use `auth.user_id` as `tblstudent.id`). REASON: needs `ApiLoginController` + DB; memory says students log in with `tbluser` rows (e.g. tbluser 301300).
2. Live `.env` values: `APP_DEBUG` (decides whether a Neo4j/other 500 leaks exception message/trace to the browser), `NEO4J_*`, `OPENROUTER/DEEPSEEK` keys, `API_BASE_URL`. REASON: env files not readable.
3. Whether anonymous access to `/api/pal/pedagogy-engine` and `/api/semantic-intelligence*` is blocked by a reverse proxy/WAF in production. REASON: no infra visibility.
4. Row counts/tenant distribution of `semantic_intelligence`, `pal_concept_nodes`, `pal_question_metadata`, `result_personalize_marks` (impact sizing). REASON: no DB access.
5. Whether student-facing renderers of `media_url`/node `body` sanitise HTML/URLs (stored-XSS potential of AI-B23). REASON: consumer pages are outside this slice.
6. Whether `PersonalBestService`, `CareerQuestService`, `LearnerActivitySource::attempts/conceptRecords` contain division-by-zero or tier-threshold bugs. REASON: not read (only signatures via grep).
7. Whether `recordModuleActivitySafely` (browser-authored AI-Stack ledger entries) is validated/derived server-side (AI-B25). REASON: `/api/ai/modules/{key}/activity` controller not read (other part).
8. Whether `check_permissions` for `/lms/palreport` and `/result_personalize_marks` maps to menu rows that students lack. REASON: menu/rights tables not inspected.
9. Actual browser behaviour of Excel opening `12/20`-style grade strings and CSV formula cells (AI-B15). REASON: no runtime.
10. Rendering/perf of `CoherenceMapView`/`KnowledgeGraphView` on large graphs (1,000+ nodes per the Administration comment). REASON: not executed.
11. `ContentMetadata`/`Content` `$fillable` guard for `normalizeContentMetadata` output (exact fields a student could alter via AI-B04). REASON: models/catalog service not read.

---

#### Sub-part C - Enterprise Brain, Capability Intelligence, Career modules, People & Competency

1. Whether `hpbrain_*` tables exist in the live/prod database (memory: 408 stale pending migrations, bare `migrate` unsafe; controllers degrade to "not provisioned"/503 `brain_schema_missing`). Screens may be empty for that reason alone.
2. Live values of `JWT_SECRET`, `BRAIN_JWT_SECRETS`, `JWT_TTL_MINUTES` (default 0 = no expiry), `AGENTS_STORE_PATH`, `ONET_USERNAME/PASSWORD`, `NEXT_PUBLIC_BRAIN_API_BASE_URL` — env not read.
3. Whether `tbluserprofilemaster.role_key` is populated (drives employee-competency elevated access) and whether school admins carry `is_admin` 1/2 (drives career cross-student view).
4. Live data behind the role-mapping join discrepancy (AI-C10): the "50,231 rows / 2,875 of 2,896 = 99.3%" figures come from a code comment in `CapabilityIntelligence.php`, not from a query I ran.
5. Whether `onet_expert_advice`, `onet_explore_sector`, `counselling_course` contain staff-authored or seed data, and who can edit them (no writer found in Laravel app code; they may be loaded by SQL import).
6. Neo4j availability for `careerAlignment`, and the availability/contents of `https://skill-ontology-neo4j.vercel.app`.
7. Runtime confirmation that the public career routes are not blocked by an upstream WAF/proxy; that `Route::get('careerExplore')` in `web` group really has no auth (no global auth middleware seen in `Kernel.php`).
8. `.data/agents.json` contents (gitignored; not read).
9. Next 16 build behaviour for `people-competency/lms/course-builder/page.tsx` (`useSearchParams` without Suspense) — build not run.
10. `TalentIntelligence` logic, the 24 other module intelligence classes, `CertificationController`, `DevelopmentPlanController`, `CareerPathController` scoring — not reviewed (outside time budget).

---

#### Sub-part D - AI console, workspace tabs, platform services, integration, migration modules, roadmap

1. Live value of `LMS_API_AUTH_ENFORCE` / `lms_content.api_auth_enforce` (config default `false`). Determines whether `perm:` and `lms.auth` actually block (AI-D09). REASON: `.env` not readable.
2. Whether any tenant has an active `ai_policy_assignments` row (global scope) — determines if AI-D13 (resolver TypeError) is live. REASON: no DB access; static reading of PHP 8 semantics only, not executed.
3. Which `approver_role` values the seeded workflows use and whether any value other than `admin|staff|student` exists (would never match `McpRequestContext::role`). REASON: only two migrations sampled.
4. How the backend builds `template_link` returned to CreateTab (assumed `/ai-reports/<id>`). REASON: `AiReportGenerator` read by grep only.
5. Whether `ai_api_keys.api_limit` is enforced anywhere at call time (spend cap). REASON: `AiConfigurationResolver`/`GenerationService` not read end to end.
6. Whether `POST /api/ai/ask` intent classifier is rule-based or LLM-based (affects AI-D25). REASON: `AskService` (3k+ lines) not read.
7. Whether `GET /api/ai/conversations/{id}` and `GET /assistance/tickets` restrict by user. REASON: not read.
8. Behaviour of the real SMS/WhatsApp/SMTP/Razorpay screens re-used by `/integration/*` (role gating, secret handling). REASON: pages live in `app/easy_com/*`, `app/fees/*` (other parts).
9. `app/_components/ai-stack/*` (shared nine tabs for engagement/interactions/mobile-apps): approvals, policy editing, model overrides all go through the endpoints in 5a, but the component code was not read.
10. `hooks/use-ai-workspace.ts` / `PageAiContext.tsx` (lead's) — only grepped: `page_data` carries ≤25 records × ≤8 attributes from on-screen state; PII content depends on each page's descriptor.
11. Whether `/enterprise-brain/governance` (href in roadmap registry.ts:818) exists.
12. Production deployment mode of the Next app (long-lived `next start` vs serverless). Determines how bad the in-memory integration store is (AI-D02) — on serverless each instance has its own array; on `next start` one array is shared by all tenants.
13. `RequireLmsStaff` blocks by profile *name* string (`student`,`parent`) — per-tenant profile naming (e.g. "Students", "Parents", "Guardian") NOT verified.
14. Whether `/api/lms/concept-intelligence/tab-labels` is protected by a global middleware outside routes/api.php (Kernel `api` group shows only throttle + bindings per LmsApiAuth docblock; not re-verified).

---

### 9. Second-pass results (grep counts + material hits)

#### Sub-part E - Assistant panel, agent engine, event bus, catalogue, Laravel /api/ai cross-cut (lead auditor)

Whole part05 scope (E measurement over the directories listed in the task): dangerouslySetInnerHTML 32 (all listed in AI-05), innerHTML 0, eval/new Function 0, console.log 0, debugger 0, `localStorage` 78, `sessionStorage` 12, `window.location` 3 (AuthContext logout replace; ai-reports clipboard; lib/intelligence/client.ts pathname read), `window.open` 4 (all `noopener,noreferrer`), TODO/FIXME/HACK/XXX 1 (comment text in event-bus sources), `fetch(` 79 call sites, axios 0.
E-slice only (hooks, contexts, lib/agents, lib/ai, lib/event-bus, module-ai, new-pal, components/ai, ChatbotPanel, chatbot-storage, packages, app/api/agents|ai|conversational-ai, scripts): localStorage 41, sessionStorage 6, console.* 20 (all error logging in routes + script output), fetch( 14, empty `catch {}` 31 (storage guards; acceptable), dangerouslySetInnerHTML 0.
Material hits: raw HTML sinks (AI-05); header-driven upstream URL (AI-02); JWT and role read from localStorage in 5 places (AI-08); `Math.random`-based conversation id fallback in chatbot-storage (non-security).
Sub-audit second-pass sections follow.

#### Sub-part A - PAL / ESO student-facing adaptive learning

| Pattern | Count | Material hits |
|---|---|---|
| `TODO|FIXME|HACK|XXX` | 0 | 2 "TEMP DIAGNOSTIC" markers: `pal.ts:726`, `exam/page.tsx:423` (AI-A24) |
| `console.*` | 2 | both `console.debug('[PAL DEBUG] …')`, `pal.ts:732`, `exam/page.tsx:434` — dump full question records (incl. correct flags) on every render (AI-A24) |
| `debugger` / `eval` / `new Function` | 0 / 0 / 0 | |
| `dangerouslySetInnerHTML` | **29** | `AnswerReview.tsx:235,259`; `DiagnosticPanel.tsx:311,347` (dead file); `PracticePanel.tsx:365,403,681`; `adaptive/concept/[conceptId]/page.tsx:527,554`; `diagnostic/chapter/[chapterId]/page.tsx:989,1017`; `eso/page.tsx:1134,1151,1308,1325,1436,1453,1819,1850,2051,2082,2205 (contrastPair.body),2239,2256,2570,2587`; `page.tsx:1155`; `result/page.tsx:292,346` (AI-A07) |
| `fetch(` call sites | 45 | `pal.ts` 19, `pal-diagnostic.ts` 13, `pal-legacy.ts` 3, `pal-v4.ts` 2, `pal-eso.ts` 1 (`esoFetch`, serves 30+ routes), `pal-intervention.ts` 1, `pal-lookups.ts` 1, `pal-content.ts` 1, `pal-content-model.ts` 1, `pedagogy-engine.ts` 1, `PedagogyEngine.tsx` 1, `app/api/pal/submit/route.ts` 1 |
| `localStorage`/`sessionStorage` | 11 | keys: `pal_view_as_student` (r/w, `pal-view-as.ts:17`), `palLastConceptContext` (sessionStorage), reads of `menuContext`, `userData` (`pal-lookups.ts`, `pal-legacy.ts`); token read via `buildSessionContext` |
| `window.location` / raw redirects | 0 | navigation via `router.push/replace` and `redirect()` only |
| hard-coded URLs/emails/ids | 0 URLs; sample chemistry copy in `SAMPLE_SUGGESTED_CONTENT` (`pal-eso.ts:1005-1034`) | dead behind `SHOW_SUPPORTING_PANELS=false` |
| `return []` | 4 | `JourneyRail.tsx:109`, `pal-content-model.ts:228,243`, `pal-eso.ts:654` (404 -> no CFU items; intentional) |
| empty `catch {}` | 0 | but 6 swallow-to-default `.catch(() => undefined/null/false)`: `AdaptiveLearningButton.tsx:65`, `CompletionState.tsx:115,163`, `feedback/concept/…:175`, `mastery/concept/…:104`, `intervention/concept/…:105` (completion overlays swallow **all** errors incl. 401/403/500) |
| `AbortController` use | 28 files | missing in: `ContrastPairStep` retest fetch (`eso/page.tsx:2142`), `RetrievalDueStep` items fetch (`2494`), `PlanAndSuggestions` (has cancelled flag only), `usePalRendering` (cancelled flag, no abort), `PracticePanel` submit, `submitAdaptiveAnswer` loop |
| unbounded polling/retry | none found; timers: exam countdown `exam/page.tsx:216-225` (client-only), diagnostic countdown `diagnostic/chapter/.../page.tsx:237-253` (client-only), per-question `setInterval` ticker `exam/page.tsx:246` (fine, cleaned up) |
| setState inside updater fn | `eso/page.tsx:129-143` calls `setPlanPending` inside `setAction(prev => …)` (impure updater; double-fires in StrictMode, harmless) |
| unmounted `setState` | `page.tsx:173` `setData(result)` runs before the aborted check; `RetrievalDueStep` `.then(setItems)` has no cancel |
| tests | 2 files (section 7) |
| dead code | `DiagnosticPanel.tsx` (450 loc, 0 importers), `_dev-preview/diagnostic-summary/page.tsx` (private folder, unroutable), `PlanAndSuggestions`/`SuggestedContentBody` (flag off) |

Backend second pass highlights (slice-relevant): raw SQL concatenation `palController.php:2723` (only one; `getMisconceptionQuestions` and others parametrised), `Log::info` of full practice answers (`assessmentQuestionController.php:2505`), user-supplied `limit` unbounded (`:2779`), `Schema::hasColumn` calls on every request in `store()` (perf), no `DB::transaction` in `store()`.

---------------------------------------------------------------------------------------------------------------------------

#### Sub-part B - New PAL (gamification, content model, administration, coherence map, pedagogy engine), reports

Scope grepped: `app/pal/new app/pal/content app/pal/personalize-marks app/pal/report app/pal/reports app/pal/intelligence app/pal/pedagogy-engine app/pal/framework app/pal/frameworks app/pal/ulu lib/new-pal lib/module-ai app/api/pal/content-model app/api/pal/pedagogy-engine` (.ts/.tsx, 59 files).

| Pattern | Count | Material hits |
|---|---|---|
| TODO / FIXME / HACK / XXX | 0 | - |
| `console.log` / `.warn` / `.error` | 1 | `lib/module-ai/module-ai-stack.ts:240` (`console.warn` unknown operation; harmless) |
| `debugger` | 0 | - |
| `dangerouslySetInnerHTML` | 0 | - |
| `eval(` | 0 | - |
| `window.location` | 0 | - |
| `localStorage` / `sessionStorage` | 5 | `lib/module-ai/module-ai-stack.ts:64,65,72` (reads JWT/`user_token`, institute, year from `userData`/`menuContext`); `GamificationScope.tsx:22,46` (comments only). Indirect: `pal-view-as.ts:17` key `pal_view_as_student` (outside slice), `buildSessionContext()` reads the bearer token from localStorage for all 4 data clients. |
| `fetch(` call sites | 5 | `data/gamification.ts:76`, `data/content-model.ts:73`, `data/administration.ts:68`, `data/coherence-map.ts:67` (4 near-identical copy-pasted `callApi`, differing in method set/401 text), `PedagogyEngine.tsx:111` (unauthenticated same-origin). Adjacent: `pal.ts` x4, `pedagogy-engine.ts:234`, `pal-content-model.ts:1138`, `course-master/data/chapters.ts:944,958` (unauthenticated). |
| `axios` | 0 | - |
| Empty catch / swallow | 3 + 3 | `reports/attainment/page.tsx:70` (`.catch(() => setStandards([]))` hides roster failure -> empty dropdown, no message); `content/page.tsx:116` (`catch { sample = [] }` intentional); `module-ai-stack.ts:120,293` (`.catch(() => EMPTY_SNAPSHOT)`, `.catch(() => undefined)` by design). |
| `return []` placeholders | 3 | `misconceptions/page.tsx:81`, `review/page.tsx:100,105` (legitimate memo guards) |
| mock / demo / seed / fake data | 0 real | matches are comments/labels only (`content/page.tsx` "sample" = 5-row review sample from API). NO fallback-to-mock-on-error pattern exists in this slice. Fallback-to-empty exists (above). |
| `window.prompt` | 1 | `team-challenges/page.tsx:52` (end reason; blocking native dialog, cancelling aborts) |
| Hardcoded URLs / emails / IPs | 0 | - |
| `role` / tenant identifiers used | 23 occurrences | only `isStudentSession()` (3 uses) and comment text; `syear` read from `buildSessionContext()` in `reports/attainment/page.tsx:51` |
| `eslint-disable` | 7 | react-hooks exceptions (`useGamificationResource.ts:66,77`, admin pages x2, review page, intelligence x2) |
| `any` / `as unknown as` / `@ts-ignore` | 16 (all `as unknown`/type words; no `@ts-ignore`) | acceptable |
| `php artisan ...` strings rendered to end users | 6 | `content/page.tsx:351-355` (5 commands), `content/review/page.tsx:310`, `content/misconceptions/page.tsx:218`, `PedagogyEngine.tsx:188` (AI-B20) |

Material hits promoted to issues: AI-B08 (isStaffView), AI-B09 (load() discards edits), AI-B12 (coherence page), AI-B15, AI-B16 (tags input, confirm), AI-B17 (unencoded path), AI-B20, AI-B21.

Pages that display hardcoded/static content as if it were data (complete list): NONE display fabricated numbers, names, badges, leaderboards, XP or streaks. Static (spec) text presented as fact: (a) `coherence-map/page.tsx:351-356` says every prerequisite link is an unreviewed AI suggestion, none crosses a chapter boundary - true only for the current data set, shown for every scope regardless of the live `draftEdges`/counts; the page header comment (lines 32-35) repeats it; (b) `gamification/page.tsx:498-509`, `streaks/page.tsx:101,195`, `team-challenges/page.tsx:197-203`, `challenge-mode/page.tsx:294-300` hardcode policy copy ("One missed day is forgiven each week", "Two missed days start a new streak", "Parents see milestones", "first names only") that will silently diverge from `config/pal_gamification.php`; (c) `administration/[subsystem]/page.tsx:94,111,207` "applies to every learner scored from now on" is shown even when the scope is a single institute; (d) `badges/page.tsx:97` hints "Mastery, fluency, persistence, curiosity, social, career" hardcoded next to a server-provided category list; (e) `intelligence/page.tsx:759` `ConceptLens` defaults the concept id input to `'1'`; (f) `team-challenges/page.tsx:370,395,489` composer defaults (`mountain`, `reward_approved: true`, placeholder `chapter:8104`); (g) `NewPalNav.tsx:54-85` static `SUB_MODULES` (3 entries) differs from the DB menu; (h) `lib/new-pal/new-pal-ai-stack.ts` static descriptor text + agent keys (`k12_new_pal`, `pal_intervention_followup`) - declarative by design. Fallback-to-mock-on-error: none. Silent-empty-on-error: attainment class list (AI-B21).

---

#### Sub-part C - Enterprise Brain, Capability Intelligence, Career modules, People & Competency

| Check | Count | Material hits |
|---|---|---|
| `TODO/FIXME/HACK/XXX` | 0 | — |
| `console.*` | 3 | `people-competency/lms/assignments/_lib/use-assignments.ts:117,155,211` (`console.error`; failures in bulk update/status change are only logged — user gets no feedback: `handleBulkUpdate` catch at `:154-156`, `changeStatus` returns `{ok:false}`) |
| `debugger` / `eval` / `new Function` | 0 | — |
| `dangerouslySetInnerHTML` | 3 | `career-explorer/expert-advice/page.tsx:210` (`benefits`, `university_shortlist`), `career-explorer/explore-sectors/page.tsx:86` (`html`), `career-counselling/interest-profile/_components/CounsellingCourses.tsx:93` (`course.description`) — none sanitised (AI-C14); `isomorphic-dompurify` is in `package.json:52` |
| `localStorage/sessionStorage` (code use) | 3 sites | `lib/brain/api.ts:56-57` (reads `userData`/`menuContext`: JWT + tenant); `competency-library.tsx:362,895` (saved views under a global key — not per-user/tenant, try/catch guarded). Indirect via `lib/erp-client.ts`, `lib/agents/client.ts` (reads `userData`, `sessionData`, `auth`). JWT lives in localStorage (XSS-exfiltratable, see AI-C14) |
| `window.open/location` | 4 | `taxonomy-ontology.tsx:106,154` (`noopener,noreferrer`), `course-builder-panel.tsx:310,319`. No raw `window.location` redirects. External links `target=_blank rel=noopener noreferrer` for exam pages (`CounsellingCourses.tsx:132`) |
| `alert/confirm/prompt` | 6 | Automation approval uses `window.prompt` for rationale and outcome (`automation/page.tsx:44,71,73`) — accepts any typed text before validating `success/partial/failed`; `framework-mapping.tsx:357,952`, `ConversationalAiAdmin.tsx:318` |
| `fetch(` sites | 9 | `lib/brain/api.ts:108`; 5 capability `_lib/*-api.ts`; 3 career `_lib/api.ts` (through `/api/proxy`) |
| `return []` / swallow-to-empty | 8 `return []`; 20 catch/`.catch` blocks that reset state to empty/null | Material: `CareerExplorerHub.tsx:118,133` (failed filter/search shown as "No results"), `role-requirements-panel.tsx:68,72,91` (failed loads -> empty lists, Save stays enabled: AI-C22), `use-command-center.ts:93`, `foundation/students/page.tsx:64-68` (profile fetch failure -> silently no profile), `CareerIntelligenceHub.tsx:410` |
| `role/user_profile_id/sub_institute_id/syear/user_id/is_admin` handling | sub_institute_id 13, syear 33, user_id 13 (mostly capability `contextParams` + Brain session) | client sends them; server ignores except `syear` (validated in Brain; unvalidated in `HydratesLegacyApiSession`) |
| Hardcoded URLs | 1 | `taxonomy-ontology.tsx:38` `https://skill-ontology-neo4j.vercel.app` |
| Buttons with no handler | 0 (`<button>` w/o onClick); 2 dead UI controls | `OccupationDetailView.tsx:~95` decorative `<input type="radio" readOnly checked={false}>`; expert-advice "Book a free counselling" only opens a benefits dialog (no booking action) |
| Placeholder/"coming soon" | 2 | `governance/page.tsx` (`ComingSoonPanel`, intentional, internal); agent page note comment |
| Unbounded loops | 2 | `framework-mapping.tsx:345-353` CSV import awaits one `saveCell` request per cell sequentially (N x M requests, no cap); `departments/page.tsx` renders every department card (hundreds; memory notes 600+) with no pagination |
| Mock/demo/sample/fake | 0 in slice source | The demo data is backend/iframe (see headline) |

---

#### Sub-part D - AI console, workspace tabs, platform services, integration, migration modules, roadmap

| Pattern | Count | Material hits |
|---|---|---|
| `dangerouslySetInnerHTML`, `innerHTML`, `document.write`, `eval(`, `new Function`, `debugger` | 0 | — (model/stored HTML is only shown via sandboxed `<iframe srcDoc>`: ai-reports/[id]/page.tsx:500-506 `sandbox="allow-same-origin"`, :561-568 `sandbox="allow-same-origin allow-modals"`, TemplateView.tsx:119-124 `sandbox=""`) |
| `window.open`, `location.href=` | 0 | `window.location.pathname` read at client.ts:191; `window.location.href` copied to clipboard ai-reports/[id]/page.tsx:299 |
| `router.push` | 3 | all with fixed strings or backend `route` (ModuleIntegrationSection.tsx:139 `item.route` from backend) |
| `target="_blank"` | 3 | ai-platforms/page.tsx:114 (rel=noreferrer), ConfigurationManager.tsx:398 (`provider.docs` from ProviderCatalog, rel=noreferrer), CreateTab.tsx:192 (server `template_link`) |
| `localStorage` / `sessionStorage` | 8 files read `userData`/`menuContext` (7 lib clients + AiInsightsPanel `getItem('token')`); 0 writes; 0 sessionStorage | bearer token read from `localStorage.userData.user_token` in 6 copy-pasted `readSession()` functions (ai-capabilities.ts:65, ai-configuration.ts:144, ai-generate.ts:86, ai-module.ts:175, ai-policies.ts:97, ai-templates.ts:193) |
| `fetch(` call sites | 11 in 10 files (client.ts, workspace.ts, ai-capabilities, ai-configuration, ai-generate, ai-module, ai-policies, ai-templates, platform/client.ts ×2, MigrationModulePage) + 3 `brainFetch` in module sections | all Laravel-direct with bearer; none via Next proxy except `app/api/ai/ask/stream` (out of slice) |
| `catch` blocks | 88; 22 are `catch {` without binding | material: `app/ai/page.tsx:61 .catch(() => {})`; ActionsTab.tsx:81 (runs load failure → empty); DomainAgentPanel.tsx:101 (`Promise.allSettled` → `[]` on rejection); template-engine.ts:204,247 (return null/base); ConceptIntelligenceTabs.tsx:253 (console.warn + default labels) |
| `console.*` | 2 | ConceptIntelligenceTabs.tsx:253 (warn), ai-module.ts:378 (warn) |
| `TODO|FIXME|HACK|XXX` | 0 | — |
| `return []` | 7 | template-engine.ts:115 (`listPendingEnquiries` returns [] when tool says not ok — indistinguishable from "no enquiries"), others benign |
| Hard-coded ids/URLs/emails | external: ai-platforms (6 vendor URLs, `cdn.simpleicons.org` ×3, 3 inline data-URI SVGs); business keys `'k12'`, `'k12_academic_risk'`, `'k12.intervention_activity'` (DomainAgentPanel.tsx:86, AiInsightsPanel.tsx:105, AnalyseTab.tsx:280); defaults 60%/30 days/50/200 rows in `lib/*-ai-stack.ts` | no emails/IPs/phones in slice source |
| Mojibake in source | 4 hits in `components/intelligence/module/registry.ts` (`â`, e.g. "instituteâs", "bookings are year-scoped … â bookings") | encoding corruption in strings (notes, dev-facing) |
| `role`/`user_profile_id`/`sub_institute_id`/`syear`/`user_id` handling | `sub_institute_id`/`syear`/`user_id` sent from client state only in MigrationModulePage.tsx:24 and conceptIntelligenceTabLabels.ts:117,132; AI clients send only `X-MCP-Institute-Id` + `meta`; `is_admin` string read client-side in use-integration-management.ts:31-33; no `user_profile_id` used anywhere in slice | see §3/§4 |
| `.kilo/conversational-ai` (22 files) | tokens/bearer/secrets: **0**; PII: names + 10-digit mobiles + DOB + address + emails | AI-D20 |
| Endpoints w/o UI | see §2 | — |

---

### 10. ISSUES

Temporary IDs: AI-01..AI-16 = lead auditor (E); AI-A## = PAL student flow; AI-B## = New PAL/content/admin; AI-C## = Brain/capability/career; AI-D## = AI console/platform/misc. The lead should renumber to LMS-AUDIT-XXX and merge duplicates listed in the duplicate cluster note above.

## AI-01
**Severity:** Critical   **Type:** Confirmed
**Category:** Authorization
**Module:** Agent Management (AI Stack Automations) - Next.js server routes
**Location:** lib/agents/acting-user.ts:35-46 (readRequestSession), app/api/agents/_lib/handler.ts:15-32, lib/agents/engine.ts:78-86 (listAgents/listRuns), app/api/agents/route.ts:12-19, app/api/agents/runs/route.ts, lib/agents/store.ts (JsonFileAgentStore)
**Function/Method:** readRequestSession, engineContextFor, listAgents, listRuns
**Problem:** The agent engine takes the caller's identity AND tenant from client-supplied request headers (`x-sub-institute-id`, `x-user-id`, `x-user-name`, `x-user-profile-id`, `x-laravel-token`, `x-laravel-base-url`). It never validates them against the bearer token. `listAgents` and `listRuns` perform NO authorization call at all (only `requireActor`, which checks that two header strings are non-empty), so `GET /api/agents` and `GET /api/agents/runs` need no valid token. Run rows store `output` (live tool results, e.g. fee-defaulter lists with student names and amounts from `fees.list_defaulters`) in `.data/agents.json`.
**Evidence:** `tenant_id: header(request, 'x-sub-institute-id'), user_id: header(request, 'x-user-id')`; `export async function listRuns(context, filter) { requireActor(context.actor); return context.store.listRuns(context.actor.tenant_id, filter); }` - no `context.authorize(...)`; store filters only by `run.tenant_id === tenantId`.
**Impact:** Any unauthenticated network caller who can reach the Next server can enumerate any tenant's agents and read every stored run output (PII: student names, fee arrears, attendance) by setting two headers to any tenant id / any user id. Also allows forging the audit identity (`acting_user_id/name/profile`) of runs and agents (`created_by`). Cross-tenant read = data breach. (Conditional on the store containing runs; store is a plain-JSON file on the app server disk, unencrypted.)
**Expected Behavior:** Tenant and user must be derived server-side from a verified token (Laravel `/api/me`-style introspection or JWT verification); reads must require `view` right on `agents.<module>`.
**Recommended Fix:** Verify the bearer against Laravel once per request and take tenant/user/profile from that response, ignoring `x-*` identity headers; call `authorize(..., 'view')` in `listAgents/listRuns`; move the store to Laravel tables (`ai_agents`, `ai_agent_runs`) as the code comments already plan; do not persist raw tool output containing PII.
**Verification:** `curl -H 'x-sub-institute-id: 1' -H 'x-user-id: 1' http://<host>/api/agents/runs` with no Authorization header. NOT RUN (read-only audit). Confirmed by code path reading only.

## AI-02
**Severity:** Critical   **Type:** Confirmed
**Category:** Security
**Module:** Agent Management, Conversational-AI admin, PAL submit proxy
**Location:** lib/agents/acting-user.ts:36-40 and 78-98 (laravelAuthorizer), app/api/conversational-ai/_lib/handler.ts:19-25, app/api/pal/submit/route.ts:21-23 and 34-46; same header pattern in ~25 other proxy routes (grep `x-laravel-base-url`: app/api/dashboard/*, fees/*, students/*, library/*, hostel/*, transportation/*, admissions/*, forgot-password, google-auth, lib/laravel-category-proxy.ts - owned by other parts)
**Function/Method:** laravelAuthorizer, adminContextFor, POST /api/pal/submit
**Problem:** The upstream Laravel host that Next server routes call is taken from a request header `x-laravel-base-url` (falling back to env only when absent). (a) The RBAC authorizer for agents and conversational-AI admin does `fetch(`${session.baseUrl}/api/permissions?...`)` - the caller can point it at a server they control that answers `{status_code:1,data:{"conversational_ai":{"update":true}}}` and every permission check passes. (b) `POST /api/pal/submit` forwards the body, Authorization and Cookie headers to `${x-laravel-base-url}/lms/pal` with `redirect:'manual'` and passes back the upstream JSON body: a header-controlled server-side request (SSRF) that also leaks the user's cookie/bearer to whatever host is named. (c) Agent tool executors (`callMcpTool`) use `resolveAiBaseUrl(session.baseUrl)`; the session base URL wins unless `NEXT_PUBLIC_AI_BASE_URL` is set.
**Evidence:** `baseUrl: (header(request, 'x-laravel-base-url') || defaultBaseUrl()).replace(/\/$/, '')`; `const base = (baseFromHeader || API_BASE_URL)...; fetch(`${base}/lms/pal`, {... Authorization, Cookie ...})`; `adminContextFor` only requires `session.token` be a non-empty string.
**Impact:** Authorization bypass for `POST /api/conversational-ai/projects/:id/token` (rotate service token; the plaintext is returned once) and `PUT .../settings`, and for creating/activating/running agents in any tenant (combined with AI-01). SSRF to internal hosts (cloud metadata, admin panels) with response echo on /api/pal/submit and agent tool output.
**Expected Behavior:** Upstream hosts are server configuration, never request input; if per-tenant hosts are needed, resolve from an allow-list keyed by verified tenant.
**Recommended Fix:** Remove `x-laravel-base-url` support in all server routes (use env only) or validate against an explicit allow-list of hostnames; block private IP ranges on outbound fetch.
**Verification:** Code reading (`grep -rn x-laravel-base-url app lib`). Not exercised.

## AI-03
**Severity:** High   **Type:** Confirmed
**Category:** Authorization
**Module:** AI Approval workflow (Laravel /api/ai/recommendations, /api/ai/approvals) reached from ChatbotPanel and ActionsTab
**Location:** D:\next_lms_erp\routes\ai.php:37-50, 263-291 (no role middleware on the group); app/Http/Controllers/AI/RecommendationController.php:73-122; app/Domain/AI/Decisions/DecisionGate.php:107-190, 213-232; frontend app/components/ChatbotPanel.tsx:829-851
**Function/Method:** RecommendationController::approve/reject/defer, DecisionGate::record/assertApprovable
**Problem:** (1) There is no role check: `McpAuth` accepts any valid JWT, including students (role `student`); approve/reject/defer are open to every authenticated user in the tenant who can guess a numeric recommendation id (`whereNumber`). (2) No idempotency/state guard: `assertApprovable` only blocks `rejected/superseded/expired`, so an already `approved` recommendation can be approved again (each call inserts a new `ai_decisions` row, seeds another outcome via `seedOutcome`, and `startWorkflow` is invoked again, starting a duplicate workflow run) and an approved one can later be rejected (no status precondition on reject/defer). No row lock/`lockForUpdate`, so two concurrent clicks double-approve. (3) `decided_by_name` is client-supplied and stored as `decided_by_name` and audit `actor_label`, so the human-readable approver in the trail can be forged. (4) `confirmation_token` is stored but never validated by `DecisionGate` (its docblock says the token is "evidence"), so the confirmation step the UI implies is not enforced here.
**Evidence:** `Route::post('/recommendations/{recommendation}/approve', ...)` inside `middleware([McpAuth::class, McpRateLimit::class, McpContextHydrator::class])` only; `assertApprovable` conditions listed above; `'decided_by_name' => $deciderName ? mb_substr($deciderName, 0, 150) : null`.
**Impact:** A student or any low-privilege user can approve interventions (which start workflows, possibly messaging families), replay approvals and forge who approved. Audit-trail integrity is weakened.
**Expected Behavior:** Approve/reject restricted to roles listed on the recommendation/workflow (`approver_role`); single terminal transition (`pending_approval -> approved|rejected`) enforced with a transaction + row lock; approver name derived from the user table.
**Recommended Fix:** Add role middleware (or check `$context->isStudent`/profile rights), require `status === 'pending_approval'` in `record()`, use `DB::transaction` with `lockForUpdate`, drop client `decided_by_name`, validate the confirmation token against `McpConfirmationService`.
**Verification:** Read routes/ai.php and DecisionGate; NOT exercised.

## AI-04
**Severity:** High   **Type:** Confirmed
**Category:** Authorization
**Module:** AI configuration / policies / templates / module model credentials (Laravel /api/ai/*)
**Location:** D:\next_lms_erp\routes\ai.php:60-175; app/Http/Controllers/AI/AiConfigurationController.php:95-145 (store), 151-, 199- (update/destroy); AiPolicyController.php:130-, 175-, 238-; AiTemplateController.php:160-, 197-, 241-; AiModuleModelController.php (credentials at :449); AiModuleController::recordActivity
**Function/Method:** store/update/destroy on those controllers
**Problem:** Write endpoints that manage AI provider API keys (`ai_api_keys.api_key`), AI safety policies (`ai_policies`, incl. detection thresholds), and prompt templates (`ai_templates`) have no role or permission check. Only `AiAssistanceTicketController` and `OutcomeController` check `$scope->isAdmin`. Frontend screens gate only on client-side localStorage role (`lib/session/internal-access.ts`).
**Evidence:** `$scope = $this->scope($request); $institute = $scope->selectedInstituteId; ... DB::table('ai_api_keys')->insertGetId([... 'api_key' => $data['api_key'] ...])` with no `isAdmin`/`isStudent` test anywhere in the controller (grep `isAdmin|isStudent` shows only AgentController, AiAssistanceTicketController, OutcomeController, WorkflowController).
**Impact:** Any logged-in user (a student token passes McpAuth) can replace or delete the school's AI provider key, weaken or delete guardrail policies, and publish/alter prompt templates that are then rendered for every staff user (stored prompt injection: a template is the system instruction for generation). Also key-swap lets an attacker route the school's prompts to an account they own.
**Expected Behavior:** Admin-only (or `perm:` per module) enforcement on the route or in the controller, independent of UI.
**Recommended Fix:** Add `lms.staff` + `perm:ai.configuration,update` style middleware (note `perm:` is warn-only unless `LMS_API_AUTH_ENFORCE=true`, default false in config/lms_content.php:144) or explicit `isAdmin` checks.
**Verification:** Static. Whether the deployed env enforces `perm:` is NOT VERIFIED (env not readable).

## AI-05
**Severity:** High   **Type:** Confirmed
**Category:** Security
**Module:** PAL student flows / any page rendering question bank HTML
**Location:** dangerouslySetInnerHTML with unsanitised backend HTML (32 hits in scope): app/pal/eso/page.tsx:1134,1151,1308,1325,1436,1453,1819,1850,2051,2082,2205,2239,2256,2570,2587; app/pal/adaptive/concept/[conceptId]/page.tsx:527,554; app/pal/diagnostic/chapter/[chapterId]/page.tsx:989,1017; app/pal/page.tsx:1155; app/pal/result/page.tsx:292,346; app/pal/_components/AnswerReview.tsx:235,259; DiagnosticPanel.tsx:311,347; PracticePanel.tsx:365,403,681; app/career-explorer/expert-advice/page.tsx:210; app/career-explorer/explore-sectors/page.tsx:86; app/career-counselling/interest-profile/_components/CounsellingCourses.tsx:93. Contrast: app/components/questionBank/RichText.tsx uses DOMPurify.
**Function/Method:** question.title / option.answer / contrastPair.body / dialog.content / course.description rendering
**Problem:** Question text, option text, contrast-pair bodies and career content authored by teachers/importers (and AI-edited: field-edit prompt tells the model to return HTML when given HTML, `lib/ai/field-edit/prompt.ts`; `cleanFieldEditOutput` does no HTML sanitising) are injected as raw HTML in student-facing pages. The app has a sanitiser (`isomorphic-dompurify`) but PAL does not use it. The session JWT sits in `localStorage.userData` (readable by script).
**Evidence:** `<div className="text-sm font-medium text-slate-900" dangerouslySetInnerHTML={{ __html: item.title }} />` (eso/page.tsx:1134); `<span dangerouslySetInnerHTML={{ __html: option.answer }} />`.
**Impact:** A teacher or anyone able to write a question / import content (or a prompt-injected AI edit that a teacher applies) can plant `<img onerror=...>` that runs in every student's and teacher's browser and reads the bearer token from localStorage -> account takeover across tenant users who open that item. Stored XSS. (Whether Laravel sanitises on write is covered by sub-audit A; no frontend sanitiser exists.)
**Expected Behavior:** Sanitise with the same DOMPurify allow-list (or reuse `RichText`) at every render of bank-authored HTML.
**Recommended Fix:** Replace all raw `dangerouslySetInnerHTML` with `<RichText>`; sanitise on write in Laravel too; move the token out of localStorage to an httpOnly cookie.
**Verification:** `grep -rn dangerouslySetInnerHTML app/pal`.

## AI-06
**Severity:** Medium   **Type:** Confirmed
**Category:** Security
**Module:** Teach Assistant panel - stuck-user assistance
**Location:** app/components/ChatbotPanel.tsx:514-565 (captureScreenshot, handleStuckNo); components/ai/StuckUserAssistant.tsx; hooks/use-stuck-user-assistance.ts; app/components/DashboardShell.tsx:574-580, 853; app/api/ai/assistance-tickets/route.ts:16-24; Laravel AiAssistanceTicketController::store
**Function/Method:** captureScreenshot / handleStuckNo
**Problem:** After 2 minutes without click/keypress on ANY screen and for ANY role (students, parents, staff) the assistant opens itself. Choosing "No, I'm fine" silently captures a full-page screenshot of `document.body` (html2canvas, `allowTaint:true`) plus filters/metrics and uploads it as a support ticket (up to 8 MB, stored on the Laravel `local` disk, viewable by admins). The wording ("Noting this down for the support team...") does not say a screenshot of the screen (which can contain other people's names, fee amounts, a child's marks) is uploaded; "No, I'm fine" reads as declining help, yet is the branch that uploads data. No retention/expiry, no exclusion list (exam/test pages, payment screens, PAL assessments), no consent, and the screenshot mime is not verified beyond a `data:image/` prefix.
**Evidence:** `html2canvas(document.body, { scale: 1, useCORS: true, allowTaint: true ... })`; `screenshot` posted in body; `DashboardShell` mounts `<StuckUserAssistant>` unconditionally; only `pathname` change resets it.
**Impact:** Privacy exposure of minors' and third parties' data to admin viewers without consent (DPDP-type risk); the idle popup also interrupts timed exams / online tests and offers an AI assistant during an assessment (integrity). Idle detection ignores mouse/scroll so reading a long report triggers it repeatedly.
**Expected Behavior:** Explicit opt-in for screenshots, redaction of PII, disabled on assessment and payment routes, retention policy.
**Recommended Fix:** Exclude `/pal/**` assessment, `/lms/**` exam and fee-payment routes; ask before capturing; blur inputs; add TTL purge on `ai_assistance_tickets`.
**Verification:** Static.

## AI-07
**Severity:** Medium   **Type:** Confirmed
**Category:** Security
**Module:** Teach Assistant panel - data sent to AI backend
**Location:** app/components/ChatbotPanel.tsx:267-308; hooks/use-ai-workspace.ts:96-103; contexts/PageAiContext.tsx:150-233; pages registering context: app/students/search_student/page.tsx:183-200, app/fees/collect/page.tsx:546, app/fees/collect/[studentId]/page.tsx:165, app/admissions/admission_enquiry/page.tsx:688, app/attendance/attendance_dashboard/page.tsx:175, app/course-master/page.tsx:439, app/dashboard/page.tsx:29
**Function/Method:** useRegisterPageAiContext / toPageData / prepareSendMessagesRequest
**Problem:** Each open-panel navigation, filter or keystroke in a search box re-posts `page_data` (up to 25 records x 8 attributes: student name, admission number, class, status, house; fee arrears amounts; selected ids up to 100; the free-text `searchQuery`) to `/api/ai/workspace/context`, and questions go to `/api/ai/ask/stream` with tenant/year/term meta. Student identity data therefore reaches whichever third-party LLM provider the tenant configured. No data-minimisation switch, no consent notice, and `useAiWorkspace` refetches on every `pageDataKey` change with no debounce (typing in the student search fires one request per character while the panel is open).
**Evidence:** `records: filteredStudents.map((student) => ({ id, label: student.name, admissionNo, class, status, house }))`; `const pageDataKey = useMemo(() => JSON.stringify(pageData ?? {}), [pageData]); ... useEffect(() => { void load(); }, [load]);`
**Impact:** PII of minors flows to third-party model providers; unnecessary request load. The code comment ("cannot reach data the user could not already read") is true for authorisation but not for data protection.
**Expected Behavior:** Send ids and aggregate counts, not names, unless the tenant policy allows it; debounce.
**Recommended Fix:** Drop `label/admissionNo` from `records` by default; add tenant AI-privacy policy check; 400 ms debounce in `useAiWorkspace`.
**Verification:** Static.

## AI-08
**Severity:** Medium   **Type:** Confirmed
**Category:** Security
**Module:** Auth/session for AI clients
**Location:** app/components/ChatbotPanel.tsx:119-131; hooks/use-ai-workspace.ts:30-53; lib/ai/session.ts:69-73; lib/agents/client.ts:69-96; lib/session/internal-access.ts:65-89
**Problem:** Five separate copies read the bearer token and role from `localStorage.userData/menuContext`; the token is readable by any XSS (see AI-05), and role gating (`canSeeInternalView`, Enterprise Brain access, stack trace visibility) is decided from localStorage values the user can edit (`is_admin`, `user_profile_name`). `readAgentBrowserSession` additionally falls back to sessionStorage keys `auth`/`sessionData`. Logout does clear everything (contexts/AuthContext.tsx:319-334 calls clearTeachAssistantStorage + purgeClientState + full reload) - good.
**Evidence:** `const isAdmin = Number(userData.is_admin ?? menuContext.is_admin ?? 0); ... profileName.includes('admin')`.
**Impact:** Client-only gates are cosmetic; every screen relying on them needs server enforcement (see AI-03/AI-04, where it is missing). Editing localStorage shows internal roadmap rows and the twelve-stage trace to non-staff.
**Recommended Fix:** Treat as UX only; enforce server-side; consolidate on one session reader.
**Verification:** Static.

## AI-09
**Severity:** Medium   **Type:** Confirmed
**Category:** Architectural
**Module:** Agent Management / Conversational-AI admin persistence
**Location:** lib/agents/store.ts:1-30,187-205; lib/ai/conversational-admin/store.ts; packages/conversational-ai-core/src/file-store.ts:12-19 (default dir `.kilo/conversational-ai` inside the repo, 22 files currently tracked)
**Problem:** Agents, the run audit log, channel settings and service-token hashes are persisted to local JSON files (`.data/agents.json`, `.data/conversational-ai.json`, `.kilo/conversational-ai/*`). On serverless hosts (the code targets Vercel: `maxDuration`) the filesystem is ephemeral so audit runs vanish; on multi-instance hosts each instance has a different file; the "audit record" is not in the database. Authorization decisions ("denied" run rows) are therefore not durable. `file-store.ts` writes without atomic rename or lock (unlike the agent store).
**Impact:** Loss of the audit trail this design advertises; lost agents after redeploy; inconsistent state across instances; state files sit next to the app code (committed `.kilo/conversational-ai` state = conversation data in git).
**Recommended Fix:** Implement the Laravel adapter (tables `ai_agents`, `ai_agent_runs`) the comments describe; stop committing `.kilo/conversational-ai/*`.
**Verification:** `git ls-files .kilo/conversational-ai | wc -l` = 22.

## AI-10
**Severity:** Medium   **Type:** Confirmed
**Category:** Business Logic
**Module:** Agent catalogue integrity
**Location:** lib/agents/registry.ts (AGENT_MODULES: `g2g`, `hrit`), scripts/check-agent-catalogue.ts:120-146, D:\next_lms_erp\config\rbac_modules.php
**Problem:** (a) The RBAC keys `agents.g2g` and `agents.hrit` are derived by the frontend but are not registered in Laravel `config/rbac_modules.php` (39 `agents.*` keys registered, 40 modules, 2 missing - checked by script). `laravelAuthorizer` fails closed on an unregistered key, so nobody can create/run g2g or hrit agents. `hrit` has zero tools and `shared.compose_note` belongs to no module. (b) `scripts/check-agent-catalogue.ts` reports "PASS 19/19 cross-module allow-lists refused" but two of the pairs are refused only because the tool name does not exist (`petty_cash + fees.arrears -> Unknown tool "fees.arrears"`, `parent_communication + communication.messages -> Unknown tool`), so those checks prove nothing about module boundaries; the script also only covers 18 "RECENT" modules and is not wired into `npm test`/CI (`package.json` test script globs only `lib/**` and `packages/**` tests; `.github/workflows` empty). It ran successfully here (40 modules, 100 tools; all 78 MCP tool names used by `readViaMcp` exist in Laravel `app/Mcp`; 3 catalogue tools `fees.fee_structure`, `g2g.progress_snapshot`, `students.risk_scan` are `available:false`).
**Impact:** Dead modules in the Create Agent UI; false confidence from the boundary check.
**Recommended Fix:** Register the two keys or remove the modules; fix the two crossing pairs to use real tool names; add the script and `lib/agents/registry.test.ts` to CI.
**Verification:** `npx tsx scripts/check-agent-catalogue.ts` (ran, read-only), node comparison of registry vs config.

## AI-11
**Severity:** Medium   **Type:** Confirmed
**Category:** Testing
**Module:** lib/ai capability registry
**Location:** lib/ai/ai-capabilities.test.ts:46-62,105-113; packages/ai-intelligence-core/src/registry.ts:101-121
**Problem:** Two tests in scope currently fail: `ai.providers` is `status:'live'` but has no `href`, and cites roadmap row `ai.gateway` whose status is `coming-soon`. In the run of all scope tests: 218 tests, 216 pass, 2 fail.
**Impact:** The AI console shows a capability as live that the roadmap says is not built (or vice versa); red test suite in scope.
**Recommended Fix:** Reconcile the status, add the href for `/ai/providers`.
**Verification:** `node --import tsx --test lib/ai/*.test.ts`.

## AI-12
**Severity:** Medium   **Type:** Confirmed
**Category:** Business Logic
**Module:** Module AI ledger (AI Stack activity)
**Location:** lib/module-ai/module-ai-stack.ts:222-262; Laravel routes/ai.php `POST /modules/{module}/activity`, AiModuleController::recordActivity
**Problem:** The "execution ledger" rows (`ai_audit_logs` event `module.<module>.<operation>`) are written by the browser: status, `agent_run_id`, tool, `result` and subject are client-asserted, fire-and-forget (`logModuleOperation` swallows all errors), and any authenticated user can post any operation for any module key.
**Impact:** The ledger that the AI Stack screens present as "what the AI did" is forgeable and lossy; cannot be used for governance evidence.
**Recommended Fix:** Write ledger rows server-side at the point of execution.
**Verification:** Static.

## AI-13
**Severity:** Medium   **Type:** Confirmed
**Category:** Security
**Module:** Voice interaction
**Location:** hooks/use-voice-interaction.ts:74-113; app/components/ChatbotPanel.tsx:1146-1208
**Problem:** Voice input uses the browser Web Speech API (`SpeechRecognition`), which in Chrome/Edge streams audio to the vendor's cloud recogniser; there is no consent notice (children use the panel), no role restriction and no way for an admin to disable it in the UI (the conversational-admin `voice_enabled` setting exists in `lib/ai/conversational-admin/types.ts` but the panel never reads it - `grep voice_enabled` shows no use in ChatbotPanel/hooks). Text-to-speech replays the latest answer (which may contain PII) with no restriction.
**Impact:** Audio of minors leaves the school's control; the admin control for voice is dead.
**Recommended Fix:** Honour `voice_enabled`; show a one-time notice; disable for student profiles by default.
**Verification:** `grep -rn voice_enabled app components hooks` shows no consumer in the panel.

## AI-14
**Severity:** Low   **Type:** Confirmed
**Category:** Frontend
**Module:** Teach Assistant panel
**Location:** app/components/ChatbotPanel.tsx:399-403, 1215; lib/chatbot-storage.ts
**Problem:** Chat persistence: transcript (last 50 messages, may include PII answers) in `sessionStorage`, cleared once per full page load (`beginChatPageSession`), on logout, and on "New chat" - this is sound and avoids cross-user leakage. Residual: the clear runs only when the panel mounts (so on a shared tab where a different user logs in via `login()` without reload, `clearTeachAssistantStorage` IS called at AuthContext:230/255/286 - verified); the assistant answer bubble renders as React text nodes (no markdown/HTML), and navigation hand-off routes are built client-side from numeric ids (`module-handoff.ts`), so there is no XSS or open-redirect via model output. Minor: `useAgentActionHandler.executeNavigation` passes any `route` string to `router.push` (all current callers build it locally); `speakText` reads the stored content aloud with no PII guard; thread ids are `Date.now()` based.
**Impact:** None exploitable found; recorded as a verified-safe area.
**Recommended Fix:** Constrain `executeNavigation` to same-origin relative paths as defence in depth.
**Verification:** Read chatbot-storage.ts, AuthContext.tsx, AnswerSections.tsx (no href / dangerouslySetInnerHTML in components/intelligence).

## AI-15
**Severity:** Low   **Type:** Confirmed
**Category:** Frontend
**Module:** Event Bus (Platform Services) documentation drift
**Location:** lib/event-bus/sources.ts:1-30 vs lib/event-bus/client.ts:37-72
**Problem:** `sources.ts` header still says every endpoint is `planned` because no route exists; `client.ts` says six of seven tabs are live and Laravel routes/platform.php confirms `lms.staff` + `perm:platform.eventbus,view` gating on `/api/platform/events/*` with an `is_admin === 2` tier in the controller. `perm:` is warn-only by default, but `lms.staff` (not flag-dependent) refuses students/parents. Consumers tab is intentionally "not connected" (no producer for `hpbrain_consumer_state`). Event Bus verified as real-data only (no mock adapter in `lib/event-bus`).
**Impact:** Misleading comments only.
**Recommended Fix:** Update the stale header.
**Verification:** Read both files and routes/platform.php.

## AI-16
**Severity:** Low   **Type:** Confirmed
**Category:** Backend
**Module:** Assistant SSE proxy
**Location:** app/api/ai/ask/stream/route.ts:55-70,137-150; app/api/pal/submit/route.ts
**Problem:** The stream proxy correctly takes the upstream host from env (`AI_UPSTREAM_BASE_URL`/`NEXT_PUBLIC_AI_BASE_URL`), unlike other routes, but forwards the raw request body and `X-MCP-Institute-Id` unvalidated (Laravel validates the institute against the token: McpContextResolver::resolveInstituteId, verified) and there is no size limit on `request.text()`. `errorResponse` reveals `new URL(url).origin` (internal host) to the browser. `maxDuration=60`.
**Impact:** Minor information disclosure of the internal API origin; unbounded body.
**Recommended Fix:** Cap body size; do not echo the origin.
**Verification:** Static.


<!-- sub-part A issues -->
## AI-A01
**Severity:** Critical   **Type:** Confirmed
**Category:** Security
**Module:** PAL Test result (`/lms/pal/{id}`), consumed by `app/pal/result/page.tsx`
**Location:** `D:\next_lms_erp\app\Http\Controllers\lms\pal\palController.php:2630` and `:2710-2728` (raw query at `:2723`); client `D:\lms_k12\app\pal\data\pal.ts:952-964`, `D:\lms_k12\app\pal\result\page.tsx:50-51`
**Function/Method:** `palController::show()`
**Problem:** `online_exam_id` is read straight from the query string (`$online_exam_id = $request->get('online_exam_id')`) and concatenated into a raw `DB::select` string: `WHERE online_exam_id = '".$online_exam_id."' AND student_id = '".$user_id."'`. The earlier Eloquent lookup (`lmsOnlineExamModel::where(['id'=>$online_exam_id,'student_id'=>$user_id])`, `:2677`) is parametrised and MySQL coerces `"12' UNION …"` to `12`, so any authenticated student who owns one PAL exam id passes that guard and reaches the injectable statement. The Next page passes the value verbatim from the URL (`/pal/result?id=…&online_exam_id=…`).
**Evidence:** `$online_answer_data = DB::select("SELECT a.*, GROUP_CONCAT(am.id) AS actual_answer,… FROM (SELECT question_id,ans_status,… FROM lms_online_exam_answer WHERE online_exam_id = '".$online_exam_id."' AND student_id = '".$user_id."' GROUP BY question_id) AS a INNER JOIN …")`
**Impact:** Authenticated SQL injection (UNION/boolean/time-based) against the ERP database — `tbluser` holds plaintext passwords per the auth model in project memory, student PII, other tenants. Reachable by every student, no special role.
**Expected Behavior:** All identifiers bound as parameters / cast to int; ownership enforced.
**Recommended Fix:** `(int) $request->get('online_exam_id')` and bind via `DB::select($sql, [$onlineExamId, $userId])`; reject non-numeric ids with 422; add a regression test with a quote-bearing id. Audit all `DB::select` string concatenations in `app/Http/Controllers/lms`.
**Verification:** Static: `grep -n "DB::select" palController.php`. Dynamic (out of scope): request `/lms/pal/{paper}?online_exam_id={own}' AND SLEEP(5)-- -` and observe delay. NOT VERIFIED dynamically.

## AI-A02
**Severity:** Critical   **Type:** Confirmed
**Category:** Authorization
**Module:** PAL practice / concept-diagnostic-assessment / chapter gate / practice history / spaced repetition (+ PedagogyEngine routes)
**Location:** `D:\next_lms_erp\routes\web.php:87-134` (top-level, no auth middleware); `D:\next_lms_erp\app\Http\Controllers\lms\assessmentQuestionController.php:1564-1618,1630-1769,2030-2073,2497-2628,2776-2898`; `D:\next_lms_erp\app\Http\Controllers\lms\PedagogyEngineController.php:19-32,311-320,369-380`; consumers `D:\lms_k12\app\pal\data\pal.ts:1101-1109,1156-1289,1331-1455,1489-…`, `D:\lms_k12\app\pal\_components\PracticePanel.tsx`, `D:\lms_k12\app\pal\page.tsx:492-503,689`, `D:\lms_k12\app\pal\result\page.tsx:147`
**Function/Method:** `generateAdaptivePractice`, `submitPractice`, `generateDiagnosticAssessment`, `submitDiagnosticAssessment`, `getChapterGate`, `getPracticeHistory`, `getSpacedRepetition`, `PedagogyEngineController::{buildStudentProfile,getForgettingCurve,updateForgettingCurve,…}`
**Problem:** These routes are registered outside every `Route::group([... 'middleware' => ['session', …]])` (first group in the file starts at `web.php:258`), so only the `web` group (`EncryptCookies`, `StartSession`, CSRF) applies — no JWT, no session check, no `check_permissions`. Identity is `student_id` and tenant is `sub_institute_id`, both plain request parameters (the SPA sends them: `practiceParams`, `pal.ts:1102-1109`). CSRF is irrelevant: `VerifyCsrfToken.php` exempts `api/*` and the prod hosts by full URL.
**Evidence:** `routes/web.php:109` `Route::get('/lms/adaptive-practice', [assessmentQuestionController::class, 'generateAdaptivePractice'])->name('adaptive.practice');` … `:113` `Route::post('/lms/submit-practice', …)`; controller: `$student_id = $request->get('student_id'); … if (!$student_id) {…}` then reads/writes for that id.
**Impact:** Anyone on the internet (no account) can (a) read any student's practice history (question text, right/wrong, concept names), spaced-repetition schedule, prerequisite/BKT mastery, learner profile; (b) write answers as any student, poisoning `lms_online_exam_answer`, `lms_concept_mastery(_log)`, `lms_forgetting_curve` (and the IRT calibration derived from them, AI-A22); (c) enumerate students by id. A teacher using "view as student" is likewise indistinguishable from an attacker.
**Expected Behavior:** Same identity model as `palController::resolveAuthorizedContext` (JWT id, admin-only impersonation within institute) or the `pal.auth` middleware.
**Recommended Fix:** Move the routes into the `session`+`check_permissions` group (or the `pal.auth` group), derive `student_id`/`sub_institute_id` from the token via `resolveAuthorizedContext`, validate `answers` against the served set, cap `limit`. Apply the same to the `PedagogyEngineController` block `web.php:91-100`.
**Verification:** `curl` without Authorization to `/lms/practice-history?student_id=<id>&sub_institute_id=<tenant>` should be 401; currently returns data (NOT VERIFIED dynamically).

## AI-A03
**Severity:** High   **Type:** Confirmed
**Category:** Authorization
**Module:** PAL Test result / question paper
**Location:** `D:\next_lms_erp\app\Http\Controllers\lms\pal\palController.php:2633-2680`
**Function/Method:** `palController::show()`
**Problem:** The paper is loaded with `questionpaperModel::find($questionpaper_id)` from the URL, and `question_arr` (full `lms_question_master` rows) plus `answer_arr` (caller-tenant `answer_master` rows including `correct_answer`) are returned for **any** paper id. Only `online_exam_data` is filtered by `student_id`, and a student passes that with their own exam id (otherwise the code 500s on `['total_right']`). `question_paper` also holds teacher-authored school exam papers.
**Evidence:** `$data['questionpaper_data'] = questionpaperModel::find($questionpaper_id)->toArray(); $question_ids = explode(",", …['question_ids']); $data['question_arr'] = lmsQuestionMasterModel::whereIn("id", $question_ids)->get()->toArray();`
**Impact:** A student can enumerate paper ids and read unreleased exam questions and their answer keys (and misconception mappings); cross-tenant question text leak.
**Expected Behavior:** Return only papers created by/for the caller (`created_by = student_id` and `exam_type='PAL'`), scoped to tenant.
**Recommended Fix:** Add `where('created_by', $user_id)->where('sub_institute_id', …)->where('exam_type','PAL')` on the paper lookup; 404 otherwise; restrict columns returned.
**Verification:** Call `show` with another student's/teacher's `question_paper.id` and your own `online_exam_id`.

## AI-A04
**Severity:** High   **Type:** Confirmed
**Category:** Business Logic
**Module:** ESO write endpoints (diagnostic submit, practice attempt, CFU, retrieval)
**Location:** `D:\next_lms_erp\app\Http\Controllers\api\PAL\EsoEngineController.php:177-193,264-287,324-362`; `D:\next_lms_erp\app\Services\Eso\EsoPolicyService.php:851-854,908-1072,1964-2033,2552-2638,2714-2727,3382-3458,4693-4718`; client `D:\lms_k12\app\pal\data\pal-eso.ts:559-577,615-633,693-707`, `D:\lms_k12\lib\pal\eso-answers.ts:33-47`
**Function/Method:** `scoreDiagnostic`, `recordAttempt`, `recordCheckUnderstanding`, `retrievalCheck`, `stateFor`, `masteryVerdict`
**Problem:** Correctness is server-resolved (good) but everything around it is trusted: (1) `answer_master_id` may be **any** option in the database — never checked to belong to a question served for that node/concept/tenant (`isAnswerCorrect` = `answer_master.correct_answer==1`); (2) `nodeId` is unscoped (`ConceptNode::findOrFail`, `stateFor` firstOrCreate) — no check that the node belongs to `{conceptId}`, the learner's tenant, or even exists (junk `learner_node_state` rows); (3) `retrievalCheck` does not verify the node is due, mastered or was served the items: one correct id sets `status=retained` (`3401`) on any node id, and `masteryVerdict` then grants concept mastery through the "legacy mastery" branch (`2714-2727`: all nodes `isMastered()` => `mastered`), awarding badges/evidence; (4) `scoreDiagnostic` can be POSTed at any time and re-writes node status (`989-991` `status = cleanSweep ? mastered : learning`), so it can both promote (3 distinct correct ids => "mastered_on_diagnostic") and demote; (5) `mode` and `hint_used` are client-supplied (`1972-1973`) and are the only evidence of "independent, hint-free" practice (`evidenceByNode` `3004`), so the MIN_INDEPENDENT floor is self-declared; (6) `responses` arrays have no max size (unbounded writes: 3+ queries per element). Combined with AI-A05 the correct ids are in the browser before the attempt.
**Evidence:** `EsoEngineController.php:266-270` `'concept_id' => 'required|integer','answer_master_id' => 'required|integer','hint_used' => 'nullable|boolean','mode' => 'nullable|in:guided,independent'`; `EsoPolicyService.php:3400-3401` `if ($allCorrect) { $state->status = LearnerNodeState::STATUS_RETAINED;`
**Impact:** A student can self-award concept mastery, retention rungs, badges and streaks with a handful of requests, and the forged evidence is published to the school-wide ledger (`pal_learning_evidence`, BKT, Neo4j) that teacher reports and interventions read. Also cross-tenant node/answer ids accepted.
**Expected Behavior:** Only options belonging to items actually served for that node in the current phase are accepted; node must belong to the concept and tenant; retrieval only when due; server-owned practice mode; bounded arrays.
**Recommended Fix:** Persist served item ids per learner/node/phase (or derive deterministically as `practiceItem` already does) and validate `answer_master.question_id IN servedSet`; validate `node.concept_id == conceptId` and tenant; in `retrievalCheck` require `next_review_at <= now()` and `isMastered()`; make `scoreDiagnostic` once-per-concept-entry (reject if states exist); derive `mode` from `state.practice_mode`, ignore client `hint_used` or record only via a server-known hint endpoint; `responses|max:50`.
**Verification:** POST `/api/pal/eso/retrieval/{self}/{nodeId}/check` with one correct `answer_master_id` for a never-taught node and re-read `/next-action` (expect `mastered_stop_practice` today).

## AI-A05
**Severity:** High   **Type:** Architectural
**Category:** Security
**Module:** All PAL question payloads (ESO, chapter diagnostic, adaptive, PAL Test, practice)
**Location:** `D:\next_lms_erp\app\Services\PAL\Questions\ServableQuestions.php:158-166` (`'is_correct'`), `D:\next_lms_erp\app\Http\Controllers\lms\pal\palController.php:1336-1341,1387-1388` (`answer_arr` raw rows), `assessmentQuestionController.php` (`correct_answer` on practice options); client `D:\lms_k12\app\pal\data\pal-eso.ts:458`, `pal-diagnostic.ts:176-185`, `pal.ts:744-751,1190-1196`, `lib/pal/eso-answers.ts:43`, `diagnostic-answers.ts:56`, `exam-answers.ts:122`
**Function/Method:** `ServableQuestions::hydrate`, `palController::create`, `mapQuestion`, `toBankQuestion`
**Problem:** The correct option flag is delivered to the browser with the question, before it is answered, on every PAL surface, so it can be read in DevTools regardless of `instantFeedback={false}`. The docblock at `ServableQuestions.php:82-98` admits this was a deliberate consistency decision ("an inconsistency, not a security boundary") to let the shared H5P `QuestionPlayer` render. Comments elsewhere still claim the opposite (`DiagnosticService.php:80-81`, `:158`; `AdaptiveLearningService.php:90-91`; `pal-diagnostic.ts:231-238`, `:122`), which hides the posture from reviewers.
**Evidence:** `'options' => $rows->map(fn ($row) => ['id' => …, 'answer' => …, 'is_correct' => (int) $row->correct_answer === 1])`; `pal-eso.ts:458` `isCorrect: opt.is_correct === true`.
**Impact:** Diagnostics/mastery checks measure nothing for any student who looks (and it makes AI-A04/06/09 trivial). The chapter diagnostic decides the difficulty band for all later practice; gaming it defeats adaptivity.
**Expected Behavior:** Answer key withheld until answered (server-evaluated feedback endpoint per item) for scored/diagnostic surfaces; only practice-with-instant-feedback may reveal it after selection.
**Recommended Fix:** Strip `is_correct` from GET payloads; have the player call a check endpoint (returns correct id + feedback after commit) or run the H5P player in "no key" mode; update the stale comments; keep answer keys only in post-submit review payloads.
**Verification:** Load `/pal/diagnostic/chapter/{id}`, inspect the JSON `questions[].options[].is_correct`.

## AI-A06
**Severity:** High   **Type:** Confirmed
**Category:** Business Logic
**Module:** PAL Test scoring (`/lms/pal` store) and its downstream aggregates
**Location:** `D:\lms_k12\lib\pal\exam-answers.ts:270-288`, `D:\lms_k12\app\pal\data\pal.ts:829-890`, `D:\lms_k12\app\api\pal\submit\route.ts:20-85`; `D:\next_lms_erp\app\Http\Controllers\lms\pal\palController.php:1460-1996` (esp. `:1473-1474,1509-1548,1666-1690,1724-1750,1783-1815`), `D:\next_lms_erp\app\Http\Controllers\lms\onlineExamController.php:270-374`
**Function/Method:** `submissionFor`, `submitPalQuiz`, `palController::store`, `get_calculate_marks`, `get_obtain_marks`
**Problem:** The score is what the client says: `answer_multiple[qid][] = "<answerId>##<correctFlag>"`; `get_calculate_marks` counts `$s_ans[1] == 1` as right and sums `points` of the *claimed-right question ids* (any ids). `answer_narrative` is always marked right; interactive verdicts fall back to `client_correct` when the server cannot verify (`:1537`). `total_marks`, `total_question`, `chapter_id`, `question_ids`, `hid_session_quiz` (start time) are all client fields stored as-is. The code documents this (`isAnswerCorrectServerSide` docblock `:289-304`: mastery/BKT is server-verified, "$ans_status … stays client-declared"). Only `pal_assessment_results/pal_competencies` are protected; `lms_online_exam.obtain_marks/total_right`, `lms_online_exam_answer.ans_status`, Neo4j `MASTERS.proficiency_score` (ratio `obtain/total_marks`, unbounded when `total_marks` is tiny, `:1963-1976`), `palreport`, `struggle_score` and the IRT input (AI-A22) are forgeable.
**Evidence:** `exam-answers.ts:276` `value: \`${option.id}##${option.correctFlag}\``; `onlineExamController.php:284` `if ($s_ans[1] == 1) { $right_single_ans++; $right_question_ids_arr[] = $single_question_id;`
**Impact:** Teacher-visible PAL results, the "Result" screen (`Total marks x/y`), Neo4j graph proficiency and item calibration can be set arbitrarily by the student; a per-student mismatch between server-verified BKT and displayed score is also confusing.
**Expected Behavior:** Server recomputes correctness for every option answer (it already does for evidence), uses the server's own `total_marks`/question set, and rejects question ids not on the paper.
**Recommended Fix:** In `store()` derive `ans_status` from `answer_master` (reuse `isAnswerCorrectServerSide`), compute marks from the server-side paper (persist the served question ids at `create()` time), ignore client `total_marks`/`total_question`, treat narrative as ungraded/`pending` not `right`, wrap in a transaction.
**Verification:** POST a paper with `answer_multiple[<q>][]=<wrong option id>##1`; the response row shows `ans_status=right`.

## AI-A07
**Severity:** High   **Type:** Confirmed
**Category:** Security
**Module:** All PAL question/option/corrective renderers
**Location:** `D:\lms_k12\app\pal\_components\AnswerReview.tsx:235,259`; `PracticePanel.tsx:365,403,681`; `DiagnosticPanel.tsx:311,347` (dead file); `app\pal\adaptive\concept\[conceptId]\page.tsx:527,554`; `app\pal\diagnostic\chapter\[chapterId]\page.tsx:989,1017`; `app\pal\eso\page.tsx:1134,1151,1308,1325,1436,1453,1819,1850,2051,2082,2205,2239,2256,2570,2587`; `app\pal\page.tsx:1155`; `app\pal\result\page.tsx:292,346`. Backend writers: `D:\next_lms_erp\app\Http\Controllers\lms\questionmasterController.php:391-399` (option `answer` raw), `:342,616` (title `htmlspecialchars`), `app\Http\Controllers\api\teacherapiController.php:813,837` (title + answers raw), `app\Services\QuestionGenerationService.php:1813` (LLM output), `app\Http\Controllers\lms\pal\palController.php:501-560` (LLM misconception HTML)
**Function/Method:** JSX `dangerouslySetInnerHTML={{ __html: question.title | option.answer | contrastPair.body | question.question }}`
**Problem:** 29 unsanitised sinks render authored/LLM HTML from `lms_question_master.question_title`, `answer_master.answer` and `content_master`/corrective bodies. The repo already has a sanitising renderer (`app/components/questionBank/RichText.tsx`, `isomorphic-dompurify`) that PAL does not use. Content authors are teachers (any role with question-bank write), AI generation, and importers; Laravel does not sanitise option text on write. The session JWT lives in `localStorage` and does not expire unless `JWT_TTL_MINUTES` is configured.
**Evidence:** `eso/page.tsx:1151` `<span dangerouslySetInnerHTML={{ __html: option.answer }} />`; `questionmasterController.php:394` `'answer' => $val,`.
**Impact:** Stored XSS executing in student, teacher and admin browsers (admins open PAL via "view as student" and the intelligence pages): token theft => full account takeover across the tenant; a malicious or compromised teacher account or a poisoned AI/import batch is enough.
**Expected Behavior:** Every HTML sink sanitised with an allow-list; server also sanitises on write.
**Recommended Fix:** Replace all sinks with the shared `RichText`/a `SafeHtml` wrapper using DOMPurify (same allow-list as `RichText.tsx`, images opt-in); add server-side purification (e.g. HTMLPurifier) in the question/answer/content write paths and the LLM output paths; add an eslint rule banning bare `dangerouslySetInnerHTML`.
**Verification:** Store `<img src=x onerror=alert(document.domain)>` as an option through the question bank and open any PAL page containing it.

## AI-A08
**Severity:** High   **Type:** Potential
**Category:** Security
**Module:** Next BFF `POST /api/pal/submit` (also the app-wide `x-laravel-base-url` pattern)
**Location:** `D:\lms_k12\app\api\pal\submit\route.ts:20-47`; same pattern in `app/api/dashboard/*`, `app/api/fees/*`, `app/api/forgot-password/route.ts`, `app/api/google-auth/route.ts` etc. (20 files)
**Function/Method:** `POST` handler
**Problem:** The upstream base URL is taken from a request header (`request.headers.get('x-laravel-base-url')`) and used unvalidated in `fetch(\`${base}/lms/pal\`, {method:'POST', redirect:'manual', body})`; the route has no authentication of its own and reflects upstream JSON (`NextResponse.json(payload, {status})`) and the `Location` header ids.
**Evidence:** `const base = (baseFromHeader || API_BASE_URL).replace(/\/$/, '');`
**Impact:** Open server-side request forgery: any caller can make the Next server POST an arbitrary form body to any host/port reachable from the deployment (internal admin APIs, metadata endpoints — POST-only and JSON-reflection limit exploitation) and can use the server as an anonymous proxy. Effective impact depends on hosting network policy (NOT VERIFIED).
**Expected Behavior:** Base URL comes from server configuration only, or the header is validated against an allow-list of known ERP hosts.
**Recommended Fix:** Remove the header override, or allow-list hosts derived from server env; require a Bearer token before proxying; normalise the same across all `app/api/*` proxies (report to the lead as cross-cutting).
**Verification:** Send the request with `x-laravel-base-url: https://example.invalid` and observe the outbound attempt / error string.

## AI-A09
**Severity:** Medium   **Type:** Confirmed
**Category:** Business Logic
**Module:** Concept diagnostic ("adaptive") answers
**Location:** `D:\next_lms_erp\app\Services\PAL\Adaptive\AdaptiveLearningService.php:142-215` (`updateOrInsert` at `:165`), `D:\next_lms_erp\app\Http\Controllers\lms\pal\palController.php:3090-3104`
**Function/Method:** `AdaptiveLearningService::recordAnswer`, `palController::adaptiveAnswer`
**Problem:** The option must belong to the submitted `question_id` (good) but the question is not checked against the concept/chapter/tenant or against what was served, and the row is `updateOrInsert`-ed on (student, concept, question): a student can re-post the same question after seeing `correct_answer_id` + feedback in the response and overwrite a wrong answer with the right one, or fill a concept with any easy questions from anywhere. `pal_adaptive_response` drives difficulty escalation, ladder mastery and later evidence publication (`PracticeOutcomeService` publishes each question once, so a corrected answer diverges from the ledger).
**Evidence:** `'correct_answer_id' => $correctId !== null ? (int) $correctId : null,` in the response; `DB::table('pal_adaptive_response')->updateOrInsert([student, concept, question], [...'is_correct' => …])`
**Impact:** Ladder/mastery for the concept is forgeable; recency logic is disturbed (AI-A17); ledger and response table can disagree.
**Expected Behavior:** One immutable answer per served question; only served questions accepted.
**Recommended Fix:** Insert-only with a unique key and 409 on repeat; validate `question_id` ∈ concept pool via `scope()`; do not return `correct_answer_id` until the row is final.
**Verification:** POST twice with different options for one question id; last write wins.

## AI-A10
**Severity:** Medium   **Type:** Confirmed
**Category:** Business Logic
**Module:** ESO diagnostic / CFU / retrieval scoring of omissions
**Location:** `D:\lms_k12\app\pal\eso\page.tsx:1233-1252` (filters unanswered), `:2504` (retrieval filters unanswered, button enabled with 1 answer `:2595`), `:1737` (CFU requires all); `D:\next_lms_erp\app\Services\Eso\EsoPolicyService.php:908-1068,3392`, `:2560-2573`; `:439-446` (`perNode = max(1, intdiv($totalItems, $nodes->count()))`)
**Function/Method:** `DiagnosticStep.submit`, `RetrievalDueStep.submit`, `scoreDiagnostic`, `retrievalCheck`, `diagnosticItems`
**Problem:** Only submitted answers are scored; unanswered items are neither wrong nor counted. A learner can answer only the items they know (or a single retrieval item) and still get `cleanSweep`/`retained`. The chapter diagnostic treats omissions as zero (and says so in the UI) — inconsistent. Separately `diagnosticItems(…, 8)` is not a cap or target (17 nodes -> 17 items, 3 -> 6, 5 -> 5).
**Evidence:** `eso/page.tsx:1244-1245` `.map((item) => ({ nodeId: item.nodeId, answerMasterId: answers[item.questionId] })).filter((r) => r.answerMasterId != null)`
**Impact:** Diagnostic-based skipping of teaching and retention passes can be gamed without any forged request; item counts vary wildly between concepts.
**Expected Behavior:** Server knows the served set and scores omissions as incorrect (or refuses partial submits).
**Recommended Fix:** Persist the served item ids per attempt; require all-or-score-zero; make the item count a real parameter.
**Verification:** Submit the ESO diagnostic with 3 answered of 8; observe `mastered_on_diagnostic`.

## AI-A11
**Severity:** Medium   **Type:** Confirmed
**Category:** Frontend
**Module:** ESO chapter dashboard / empty content
**Location:** `D:\lms_k12\app\pal\eso\_components\ChapterDashboardView.tsx:121-123,116`; `D:\lms_k12\app\pal\page.tsx:527-537`; `D:\lms_k12\app\pal\eso\page.tsx:995-1000`; backend `EsoPolicyService.php:3734-3851`
**Function/Method:** `ChapterDashboardView` (Current concept StatCard), `ChapterRow`
**Problem:** With no ESO-ready concept (every tenant except the one whose nodes were loaded) `chapterDashboard` returns `current_concept_name = null`, `chapter_sections = []`, `mastered 0 / total 0`; the view renders `value={data.currentConceptName ?? 'Chapter complete'}` and "0 of 0", i.e. tells a student with **no content** that the chapter is complete. `/pal` sends every student chapter click to this page without checking readiness (unlike `AdaptiveLearningButton`). The per-concept flow shows engineering jargon to students ("Phase 0 content tagging has not reached it").
**Evidence:** `StatCard label="Current concept" value={data.currentConceptName ?? 'Chapter complete'}`
**Impact:** Misleading progress for whole tenants; support tickets ("chapter complete but nothing to do").
**Expected Behavior:** Explicit "nothing is prepared for this chapter yet" state; link hidden when no ESO-ready concepts.
**Recommended Fix:** Branch on `chapterSections.length === 0` (or add `no_content` to `chapterDashboard`), hide the link via `fetchChapterConcepts`, replace jargon.
**Verification:** Log in as a student of a tenant without `pal_concept_nodes` and click a chapter.

## AI-A12
**Severity:** Medium   **Type:** Confirmed
**Category:** Frontend
**Module:** ESO pages loading/error handling
**Location:** `D:\lms_k12\app\pal\eso\page.tsx:162-176,2142,2494-2497,2566`; `app\pal\eso\chapter\[chapterId]\page.tsx:57-73`; `app\pal\eso\knowledge-map\[conceptId]\page.tsx:70-85`
**Function/Method:** `refresh`, `ContrastPairStep` effect, `RetrievalDueStep`, `load`
**Problem:** (1) `refresh()`/`load()` return early on a falsy `learnerId`/`conceptId` without clearing the initial `loading=true` -> permanent skeleton/spinner (e.g. session storage missing `user_id`, non-numeric route id -> `NaN`). (2) `ContrastPairStep`: `fetchPracticeItem(...).then(setItem)` has no `.catch`; a 401/403/500 leaves "Preparing a fresh question…" forever and an unhandled rejection. (3) `RetrievalDueStep` with 0 items shows an alert with no Continue/exit control; its items fetch has no abort; submit has no in-flight guard. (4) `.catch(() => undefined/null)` in the completion overlays (`CompletionState.tsx:115,163` etc.) hides auth failures.
**Evidence:** `eso/page.tsx:2142` `fetchPracticeItem(learnerId, action.nodeId).then(setItem);`
**Impact:** Students stuck on dead screens with no retry; errors invisible to logs.
**Expected Behavior:** Every async path resolves to data, empty, or error-with-retry.
**Recommended Fix:** Add `.catch`, terminate loading in the early-return branches, add exit buttons, abort on unmount.
**Verification:** Block the practice-item request in DevTools during a contrast pair.

## AI-A13
**Severity:** Medium   **Type:** Confirmed
**Category:** Business Logic
**Module:** ESO dashboard status vocabulary
**Location:** `D:\lms_k12\app\pal\data\pal-eso.ts:855-865`, `D:\lms_k12\app\pal\eso\_components\ChapterDashboardView.tsx:394-406,426-466`; server `EsoPolicyService.php:3915-3960,4164-4176,3795`
**Function/Method:** `mapChapterSection`, `ChapterSectionsList`
**Problem:** The engine emits `stale_mastery` (derived status for mastered-but-unverified concepts). `mapChapterSection` collapses any unknown status to `not_started`, so those concepts render "Not started", are clickable into the engine, are excluded from `chapterCompletionFromSections` (`pal-completion.ts:243-251`) while still counted in `masteredConcepts` ("5 of 17") — the KPI and the list disagree. `learning-path` maps `stale` separately, so screens differ.
**Evidence:** `status: status === 'locked' || status === 'in_progress' || status === 'mastered' ? status : 'not_started',`
**Impact:** Mastered work shown as untouched; completion/read-only logic inconsistent across screens; contradictory counts.
**Expected Behavior:** Carry the `stale` flag through (server already sends `stale`, `mastered`) and render "Mastered — review due".
**Recommended Fix:** Add `stale_mastery` to `ChapterSectionStatus`, pass `mastered`/`stale` booleans, add a mapper unit test.
**Verification:** Dashboard for a learner whose newest evidence is > 30 days old.

## AI-A14
**Severity:** Low   **Type:** Confirmed
**Category:** Frontend
**Module:** Pedagogy modal mastery summary
**Location:** `D:\lms_k12\app\pal\page.tsx:864-867`; `D:\lms_k12\app\pal\data\pal.ts:514`; `D:\next_lms_erp\app\Services\PAL\Integration\PedagogySuggestedContentService.php:170-182`
**Function/Method:** `PedagogyModal`
**Problem:** The tile labelled "Not started" displays `summary.dueForReview` (`due_for_review = count($dueConceptIds)`); `needs_practice` (weak rows) and `developing` (40-70) are computed independently so buckets overlap; "Teacher insights" heading is shown to students.
**Evidence:** `<MasteryStat label="Not started" value={summary.dueForReview} tone="slate" />`
**Impact:** Wrong numbers on a student-facing panel.
**Expected Behavior:** Label matches datum; buckets disjoint.
**Recommended Fix:** Relabel/rename or expose `not_started` server-side; hide teacher-only sections for `is_student`.
**Verification:** Compare tile to `mastery_summary` JSON.

## AI-A15
**Severity:** Medium   **Type:** Confirmed
**Category:** Business Logic
**Module:** Mastery thresholds / formulas across engines
**Location:** `D:\lms_k12\app\pal\data\pal.ts:1051-1087`; `D:\lms_k12\app\pal\data\pal-feedback.ts` (`DEVELOPING_FLOOR_PCT/STRONG_FLOOR_PCT`); `D:\next_lms_erp\app\Services\PAL\Diagnostic\DiagnosticScorer.php:51-61`; `AdaptiveLearningService.php:26-27,380-395`; `AdaptiveDifficultyRule.php:53-54`; `EsoPolicyService.php:47-58`; `PedagogySuggestedContentService.php:172-179`; `assessmentQuestionController.php:2117-2120`
**Function/Method:** `computeConceptMastery`, `masteryVerdict`, `understandingBand`, pedagogy summary
**Problem:** Six mastery definitions coexist with different scales and cuts: ESO K>=0.80/A>=0.70 on 0..1 node estimates; legacy practice mastered when accuracy >= per-concept `mastery_threshold` (default 70) on 0..100 all-time accuracy; pedagogy summary mastered >= 70 (0..100); adaptive `mastered` = 5 hard answers at >= 80%; diagnostic 40/70/85; and the client `computeConceptMastery` (`accuracy + 2*correct`, capped 100, mastered >= 70) which lets 5/8 correct (62.5%) read as "Mastered". Values also change units per endpoint (0..1 vs 0..100).
**Evidence:** `pal.ts:1070` `const masteryLevel = Math.min(100, Math.round(accuracy + group.correct * 2));`
**Impact:** The same concept shows "Mastered" on one screen and "Developing" on another; teachers cannot compare.
**Expected Behavior:** One mastery definition (or clearly named different measures), one scale.
**Recommended Fix:** Centralise thresholds in a shared config exposed to the SPA; drop the `+2*correct` fudge (or compute server-side); add tests.
**Verification:** Same learner/concept through `/pal/result` vs `/pal/mastery/chapter/{id}` vs `/pal/eso/mastery/{id}`.

## AI-A16
**Severity:** Medium   **Type:** Confirmed
**Category:** Business Logic
**Module:** Legacy practice: spaced repetition, history, mastery log
**Location:** `D:\next_lms_erp\app\Http\Controllers\lms\assessmentQuestionController.php:2078-2134,2660-2733,2776-2898`; client `D:\lms_k12\app\pal\_components\PracticePanel.tsx:487-574,580-702`
**Function/Method:** `getSpacedRepetition`, `getPracticeHistory`, `updateConceptMastery`, `updateForgettingCurve`, `getStudentMastery`
**Problem:** (a) `updateConceptMastery` inserts a `lms_concept_mastery_log` row per answer; `getSpacedRepetition` reads **all** log rows with `mastery_level < 80` (no latest-per-concept), so the review schedule contains duplicates and concepts since mastered, sorted oldest-first, and the React list keys `${bucket}-${conceptId}` collide (`PracticePanel.tsx:557`). (b) `getPracticeHistory` compares varchar `ans_status = 1`; PAL Test rows store `'right'/'wrong'`, so correct exam answers show "Wrong" and the PHP `accuracy` (`->where('ans_status', 1)`) is understated; `limit` is unbounded user input. (c) `updateForgettingCurve` increases the review interval with `review_count` regardless of performance. (d) `getStudentMastery` filters `c.sub_institute_id = session('sub_institute_id')`, which is null on these unauthenticated/JWT-only calls (no `session` middleware) so the adaptive strategy sees empty mastery. (e) `DATEDIFF(NOW(), created_at)` mixes DB and PHP clocks.
**Evidence:** `assessmentQuestionController.php:2801` `DB::raw('CASE WHEN a.ans_status = 1 THEN "Correct" ELSE "Wrong" END as status_text')`
**Impact:** Students told to review mastered concepts / see wrong accuracy; adaptive practice is not actually adaptive on these routes.
**Expected Behavior:** Latest mastery per concept; consistent status encoding; performance-driven intervals; tenant from identity.
**Recommended Fix:** Group by concept (max created_at), normalise `ans_status` in SQL as `DeriveIrtCommand` does, cap `limit`, take tenant from token, migrate encodings.
**Verification:** Practice a concept to 100% and open "Review schedule".

## AI-A17
**Severity:** Medium   **Type:** Confirmed
**Category:** Business Logic
**Module:** Concept result scoping and difficulty recency
**Location:** `D:\lms_k12\app\pal\adaptive\concept\[conceptId]\result\page.tsx:64-125`; `D:\next_lms_erp\app\Services\PAL\Adaptive\AdaptiveLearningService.php:165,327-334,404-408`; `ConceptPerformanceAnalyzer.php:311-337`
**Function/Method:** `scopeToAttempt`, `recordAnswer`, `practiceByConcept`, `progress`
**Problem:** The result page recovers "this attempt" as the last `setSize` rows of `questionResults` (ordered by `id`) and states a recycled question "lands as the newest row". Because the server `updateOrInsert`s existing (student, concept, question) rows, a re-answered question keeps its old id, so the slice picks unrelated older rows and drops the recycled one; `setSize` is also a client URL parameter. The same id-ordering feeds `last_served`, `recent` streaks and `current_difficulty`, so recency is wrong after any overwrite.
**Evidence:** `scopeToAttempt`: `const questionResults = scoped ? result.questionResults.slice(-size) : result.questionResults;`
**Impact:** Wrong attempt accuracy and wrong next-band decisions on recycled sets.
**Expected Behavior:** Attempt identity comes from the server (attempt/set id or `created_at` of the write).
**Recommended Fix:** Add `updated_at`/`attempt_set_id` and order by it; return the set from the server.
**Verification:** Exhaust a concept pool so a set recycles, then read the result page.

## AI-A18
**Severity:** Medium   **Type:** Confirmed
**Category:** Backend
**Module:** Chapter diagnostic session handling / timers
**Location:** `D:\lms_k12\app\pal\diagnostic\chapter\[chapterId]\page.tsx:216-253,421-436`; `D:\next_lms_erp\app\Services\PAL\Diagnostic\DiagnosticService.php:42-147,251-327`; `D:\lms_k12\app\pal\exam\page.tsx:216-225`, `pal.ts:842`
**Function/Method:** `DiagnosticExam` timer/resume, `DiagnosticService::start/resume/submit`
**Problem:** The code and copy state answers are already persisted so the timer may auto-submit safely ("every answer is already persisted server-side"), and resume says "N answers already saved"; in fact answers are written **only at submit** (`start()` inserts rows with `answer_master_id=null`, no per-answer endpoint exists — `pal-diagnostic.ts` exposes only start/submit/result/history). A refresh/closed tab loses every answer, `answered` is always 0, and the clock restarts from the full time on every resume, so the limit is unenforceable (also client-only in the PAL Test, with a client-supplied start time). `GET .../diagnostic/chapter/{id}` creates the attempt and rows (state change on GET).
**Evidence:** `page.tsx:216-218` comment "every answer is already persisted server-side, so losing them at zero would be a choice"
**Impact:** Lost work, misleading UI, no real time limit.
**Expected Behavior:** Autosave per answer (or truthful copy) and server-authoritative deadline.
**Recommended Fix:** Add `POST .../attempt/{id}/answer`, store `expires_at` at start, reject late submits, make start a POST.
**Verification:** Answer 10 questions, refresh, observe empty paper with the same attempt.

## AI-A19
**Severity:** Medium   **Type:** Confirmed
**Category:** Security
**Module:** LLM-backed endpoints callable by students
**Location:** `D:\next_lms_erp\app\Http\Controllers\api\PAL\EsoEngineController.php:491-508`, `app\Services\Eso\EsoPalRenderer.php:428-458`; `palController.php:781-928` (`generateMisconceptionContent`); client `pal-eso.ts:743-770`, `app\pal\page.tsx:1085-1101,1110-1122`
**Function/Method:** `EsoEngineController::render`, `palController::generateMisconceptionContent`
**Problem:** `POST /api/pal/eso/render` sends a client-supplied, unbounded `instruction` string and free `context` array to the LLM under a "Pal" system prompt (the design assumes the instruction is engine-authored); no length limit, throttle or per-learner budget. `generateMisconceptionContent` loops a synchronous LLM call over **all** wrong questions of a chapter per click and is offered to students (button not role-gated); the route group lacks `ThrottleContentGeneration`. The failure message leaks an operational hint ("Run php artisan migrate first…").
**Evidence:** `'instruction' => 'required|string', 'context' => 'nullable|array'`; `page.tsx:1110-1121` button enabled for any user.
**Impact:** Cost/abuse (free LLM proxy, prompt injection) and long request timeouts.
**Expected Behavior:** Instruction derived server-side from `next-action`; rate limits.
**Recommended Fix:** Accept an action token/id instead of free text, cap sizes, add `throttle`, restrict generation to staff/queue.
**Verification:** Post a 100 KB `instruction` as a student.

## AI-A20
**Severity:** Medium   **Type:** Missing
**Category:** Backend
**Module:** Intervention / Tier-2 support (BR-06)
**Location:** `D:\lms_k12\app\pal\data\pal-intervention.ts:285-400,492-607`; `app\pal\intervention\page.tsx`, `app\pal\intervention\concept\[conceptId]\page.tsx`, `app\pal\feedback\concept\[conceptId]\page.tsx:180-213`; Laravel: no route (`grep -rn intervention routes/*.php` = 0)
**Function/Method:** `openIntervention`, `fetchInterventions`, `updateIntervention`, `closeIntervention`
**Problem:** The module is entirely UI plus client-derived triggers; `GET/POST/PATCH /api/pal/intervention*` 404 and the UI degrades to read-only ("nothing on this screen will be recorded"). BR-06 (mandatory escalation after 2 remediation cycles, "system-enforced" per `lib/process/sop-catalog.ts`) is therefore not enforced anywhere; "I'm still stuck" cannot be sent.
**Evidence:** `pal-intervention.ts:285` "The transport half. None of these routes exist in Laravel yet."
**Impact:** Students stuck in the reteach loop are never surfaced to a teacher; compliance claim unmet.
**Expected Behavior:** Server-side case creation + enforcement of BR-06.
**Recommended Fix:** Implement the API (or hide the routes/menu), enforce escalation in `EsoPolicyService` when `cfu_attempts`/remediation cycles hit the limit.
**Verification:** Fail a check twice and look for a case row.

## AI-A21
**Severity:** Medium   **Type:** Confirmed
**Category:** Authorization
**Module:** View-as-student
**Location:** `D:\lms_k12\app\pal\data\pal-view-as.ts:17-41`; `app\pal\eso\page.tsx:93`; `app\pal\eso\chapter\[chapterId]\page.tsx:51`; `mastery\[conceptId]\page.tsx:63`; `knowledge-map\[conceptId]\page.tsx:64`; `app\pal\page.tsx:689`; `D:\next_lms_erp\app\Http\Middleware\EsoStudentOnlyAuth.php:37-63`; `D:\lms_k12\contexts\AuthContext.tsx:104-113,143-145`
**Function/Method:** `useViewAsStudent`, learner id resolution
**Problem:** (1) All ESO screens resolve `learnerId = ?learnerId || viewAsStudent?.studentId || self`, yet the backend forbids staff on every learner-state ESO route, so view-as can only produce 403 there; staff-only diagnostic detail (`DiagnosticUnavailable`) is unreachable. (2) `pal_view_as_student` is never bound to a user/session and is not removed by session-expiry/inactivity clean-up (only by the full purge on explicit logout), so on a shared browser a later *student* login gets another learner id on ESO pages and 403s. (3) In staff view-as, `PracticePanel` is rendered for the viewed student and calls the unauthenticated endpoints of AI-A02 (staff, or anyone, can submit as that student). (4) `isStudentSession()` decides student vs staff from editable localStorage (cosmetic only).
**Evidence:** `eso/page.tsx:93` `const learnerId = searchParams.get('learnerId') || viewAsStudent?.studentId || defaultLearnerId();`
**Impact:** Broken/contradictory staff experience and a stale-state failure for students; misattributed practice writes.
**Expected Behavior:** View-as either supported end-to-end (read-only staff endpoints) or absent from ESO screens; state cleared on any auth change.
**Recommended Fix:** Ignore `viewAsStudent`/`?learnerId` when `isStudentSession()`; key storage by user id and clear it in the auth clean-up paths; hide `PracticePanel` for staff.
**Verification:** Use view-as as staff, let the session lapse, log in as a student, open `/pal/eso?conceptId=…`.

## AI-A22
**Severity:** Medium   **Type:** Confirmed
**Category:** Business Logic
**Module:** IRT calibration (`pal:derive-irt`)
**Location:** `D:\next_lms_erp\app\Console\Commands\PAL\DeriveIrtCommand.php:151-236,238-290`; `D:\next_lms_erp\config\pal_content.php:583-592`
**Function/Method:** `batchMetrics`, `discriminationFor`, `derive`
**Problem:** Calibration reads every `lms_online_exam_answer` row (all exam types, all attempts) though the field is named `first_attempt_correct_rate`; for PAL Test rows `ans_status` is client-declared (AI-A06) and `right` is auto-assigned to narrative answers; the ability proxy is the learner's global share correct (docblock says "score on the same question paper") and includes the item being scored; the 27% groups are formed from a `get()->groupBy` in PHP memory; REVISE < 0.25 vs approve >= 0.30 leaves a dead band.
**Evidence:** `discriminationFor`: `AVG(CASE … ) AS ability … ->groupBy('student_id')` with no paper restriction.
**Impact:** Item difficulty/discrimination (which gate what the diagnostic serves once `require_calibrated` is enabled) can be steered by tampered answers and biased by repeats.
**Expected Behavior:** Calibrate only on server-verified first attempts with an item-excluded rest-score.
**Recommended Fix:** Filter to verified rows/first attempts, use rest-score, fix the docblock or code, batch in SQL.
**Verification:** Compare `first_attempt_correct_rate` with a manual first-attempt count for one question.

## AI-A23
**Severity:** Low   **Type:** Confirmed
**Category:** Backend
**Module:** PAL Test submission robustness
**Location:** `D:\next_lms_erp\app\Http\Controllers\lms\pal\palController.php:1479-1506,1666-1690,1783-1790,1509-1516`
**Function/Method:** `store`
**Problem:** No `DB::transaction`: `question_paper` and `lms_online_exam` rows are inserted before answers, so a fault leaves partial papers; each POST creates a new paper/exam (replay unbounded); `$interset` is only defined inside the single/multiple loops, so a narrative-only body raises "Undefined variable" (HTTP 500 after partial writes); `Schema::hasColumn` calls run per request.
**Evidence:** `if(!isset($rightInterest[$interset])){` in the `answer_narrative` loop.
**Impact:** Orphan rows and crashes for crafted/edge requests.
**Recommended Fix:** Transaction + idempotency key + defined defaults.
**Verification:** POST only `answer_narrative[...]`.

## AI-A24
**Severity:** Low   **Type:** Confirmed
**Category:** Frontend
**Module:** PAL Test debug logging
**Location:** `D:\lms_k12\app\pal\data\pal.ts:726-743`; `D:\lms_k12\app\pal\exam\page.tsx:423-445`
**Function/Method:** `fetchPalQuiz`, `QuestionCard` effect
**Problem:** "TEMP DIAGNOSTIC" `console.debug` statements dump full question records (options with correct flags) on every fetch/render in production builds.
**Evidence:** `console.debug(\`[PAL DEBUG] raw question_arr[${entryIndex}]…\`, {… full_record: record})`
**Impact:** Answer-key/noise exposure in shared consoles; performance.
**Recommended Fix:** Remove.
**Verification:** Open the exam with DevTools.

## AI-A25
**Severity:** Low   **Type:** Confirmed
**Category:** Performance
**Module:** `/pal` chapter rows and practice modal
**Location:** `D:\lms_k12\app\pal\page.tsx:485,492-503`, `AdaptiveLearningButton.tsx:58-66`; `PracticePanel.tsx:196-225`; backend `EsoPolicyService.php:4725-4740` (168-query note)
**Function/Method:** `ChapterRow`, `AdaptivePracticeModal`
**Problem:** Each expanded student chapter row fires 4 requests (`chapter-gate`, chapter mastery, chapter-concepts, adaptive concepts) — a 16-chapter subject = 64 concurrent calls into heavy server code; `AdaptivePracticeModal` depends on `context`, a fresh object per parent render (`getContext(chapter)`), so any parent re-render refetches questions and clears answers.
**Evidence:** `useEffect(..., [studentId, context, reloadKey])`
**Impact:** Slow landing, lost practice answers on re-render.
**Recommended Fix:** Batch endpoint per subject; depend on primitive ids.
**Verification:** Network tab on `/pal`.

## AI-A26
**Severity:** Low   **Type:** Confirmed
**Category:** Other
**Module:** Dead/duplicate code
**Location:** `D:\lms_k12\app\pal\_components\DiagnosticPanel.tsx` (0 importers, 2 innerHTML sinks), `D:\lms_k12\app\pal\_dev-preview\diagnostic-summary\page.tsx`, `D:\lms_k12\app\pal\data\pal-eso.ts:1005-1034` + `eso/page.tsx:637-686`
**Function/Method:** —
**Problem:** Unreferenced DOK diagnostic panel and its `fetchDiagnosticAssessment/submitDiagnosticAssessment` client fns; `_dev-preview` is a Next private folder (never routed) that imports a page component; hard-coded "how metals conduct" sample content ships behind `SHOW_SUPPORTING_PANELS=false`.
**Impact:** Maintenance/attack surface (sinks in dead files) and confusion about which diagnostic is canonical.
**Recommended Fix:** Delete or archive.
**Verification:** `grep -r DiagnosticPanel app`.

## AI-A27
**Severity:** Low   **Type:** Confirmed
**Category:** Security
**Module:** Client API path building
**Location:** `D:\lms_k12\app\pal\data\pal-eso.ts:522,567,582,589,623,648,669,679,688,702,712,940,956,1122,1276,1370,1460`; `pal-diagnostic.ts:379,437,461,485,540,615,807,960,1107,1454,1471`; `eso/page.tsx:93`
**Function/Method:** `esoGet`/`esoPost` callers
**Problem:** `learnerId` (from `?learnerId=`), `chapterId`, `conceptId` are interpolated into paths unencoded and `?learnerId=` outranks the session id, so a crafted link (`/pal/eso?conceptId=1&learnerId=..%2F..%2Fx`) makes the victim's browser call other GET endpoints under the API base with their token (`fetch` normalises `..`).
**Evidence:** `esoGet(\`api/pal/eso/diagnostic/${learnerId}/${conceptId}\`)`
**Impact:** Low: GET-only, response not exfiltrated; can trigger side-effecting GETs (`next-action`).
**Recommended Fix:** `encodeURIComponent`, numeric-validate ids, ignore `?learnerId` for student sessions.
**Verification:** Open the crafted link and watch the request URL.

## AI-A28
**Severity:** Low   **Type:** Confirmed
**Category:** Frontend
**Module:** Legacy fallbacks
**Location:** `D:\lms_k12\app\pal\data\pal.ts:391-396,424-429`; `pal-lookups.ts:99-101`; `pal-legacy.ts:63`
**Function/Method:** `fetchPalLanding`, `fetchPalPreview`, `fetchClassStudents`, `legacyFetchStudents`
**Problem:** Any HTTP 404 (including "route/learner not found") silently switches to older endpoints with different authorization semantics; the legacy student list posts the JWT again as a form field (`token`).
**Impact:** Masks misconfiguration; token in request bodies/logs.
**Recommended Fix:** Remove fallbacks once the workspace API is deployed; never put the token in the body.
**Verification:** Read code path.

## AI-A29
**Severity:** Low   **Type:** Confirmed
**Category:** Authorization
**Module:** Prerequisite gate
**Location:** `D:\lms_k12\app\pal\page.tsx:505,692-701`; `D:\next_lms_erp\app\Http\Controllers\lms\pal\palController.php:1265-1301`
**Function/Method:** `ChapterRow` (Locked button), `palController::create`
**Problem:** The "Locked" quiz button is `disabled` client-side only; `/pal/exam?…` and `/lms/pal/create` do not consult the gate. (ESO enforces D2 server-side.)
**Impact:** Gate bypass by URL.
**Recommended Fix:** Enforce in `create()`.
**Verification:** Open the exam URL for a locked chapter.

## AI-A30
**Severity:** Low   **Type:** Architectural
**Category:** Backend
**Module:** GET requests with side effects / CSRF exemptions
**Location:** `D:\next_lms_erp\app\Http\Controllers\lms\pal\palController.php:2830-2888` (`diagnosticStart`), `:3461-3495` (`adaptiveConceptResult` -> `PracticeOutcomeService::complete`), `EsoPolicyService.php:1095` (`nextAction` GET logs+stamps), `:2778-2790` (silent verdict writes); `app\Http\Middleware\VerifyCsrfToken.php` (exempts `lms/pal/adaptive/answer`, `lms/pal/diagnostic/attempt/*/submit`, `lms/pal/learn/concept/*/read`, plus prod hosts by full URL)
**Function/Method:** listed
**Problem:** State-changing GETs are prefetch/retry/replay-unsafe; the exempt POSTs accept cookie sessions as well as JWT (`resolveAuthorizedContext` session branch), so CSRF protection is absent for cookie-session users.
**Impact:** Duplicate attempts/evidence, CSRF for web-session students.
**Recommended Fix:** Convert to POST, keep CSRF on for cookie sessions (exempt only bearer requests).
**Verification:** Replay GET.

## AI-A31
**Severity:** Info   **Type:** Architectural
**Category:** Security
**Module:** Session token handling (amplifier of AI-A07)
**Location:** `D:\lms_k12\lib\erp-client.ts:71-135`; `D:\next_lms_erp\app\Http\Controllers\api\ApiLoginController.php:417-434`
**Problem:** Bearer JWT is read from `localStorage` (`userData.user_token`) on every call and tokens are non-expiring unless `JWT_TTL_MINUTES` is set.
**Impact:** Any XSS becomes long-lived account takeover.
**Recommended Fix:** Set a TTL, consider httpOnly cookie sessions.
**Verification:** Env value NOT VERIFIED.

## AI-A32
**Severity:** Info   **Type:** Missing
**Category:** Testing
**Module:** PAL frontend
**Location:** `D:\lms_k12\lib\pal\` (2 test files only)
**Problem:** No tests for ESO mappers, completion rule, feedback rules, intervention triggers, attempt scoping, `computeConceptMastery`; backend lacks tests for the tamper paths above.
**Impact:** Regressions such as AI-A13 go unnoticed.
**Recommended Fix:** Add unit tests for the pure modules and negative authorization tests for `palController@show` and the ESO write endpoints.
**Verification:** `npm test` file list.




<!-- sub-part B issues -->
## AI-B01
**Severity:** High   **Type:** Confirmed
**Category:** Security
**Module:** Pedagogy Engine, Framework/ULU views, `/api/pal/content-model`, semantic-intelligence API
**Location:** `D:\next_lms_erp\routes\pal_api.php:31-37`; `D:\next_lms_erp\routes\api.php:660-662`; `D:\next_lms_erp\app\Services\PAL\Content\SemanticIntelligenceSource.php:23-43,99-116`; `D:\next_lms_erp\app\Services\PAL\Pedagogy\PedagogyEngineResolver.php:592-615`; `D:\lms_k12\app\api\pal\pedagogy-engine\route.ts:13-30`; `D:\lms_k12\app\api\pal\content-model\route.ts:8-25`; `D:\lms_k12\app\pal\data\pedagogy-engine.ts:220-258`; `D:\lms_k12\app\pal\data\pal-content-model.ts:1052-1155`; `D:\lms_k12\app\course-master\data\chapters.ts:943-971`; `D:\lms_k12\app\pal\frameworks\**`, `app\pal\ulu\**`, `app\pal\pedagogy-engine\**`
**Function/Method:** `PedagogyEngineController::{index,chapters,show}`, `SemanticIntelligenceSource::{listChapters,findRow}`, `SemanticIntelligenceApiController::{index,show,rows}`, Next `GET` handlers, `getPalContentModel`
**Problem:** The whole chain that feeds the Pedagogy Engine, Framework and ULU screens has no authentication and no tenant scoping. Laravel registers `api/pal/pedagogy-engine*` OUTSIDE the `pal.auth` group ("Read-only pedagogy reference data with no learner or tenant scope"), but the service actually resolves rules against `semantic_intelligence` rows (any tenant, "latest extraction" by default, or any integer chapter/extraction/row id) and `listChapters()` is called with no institute filter; it also returns platform-wide engagement telemetry aggregates. `GET /api/semantic-intelligence` and `/{id}/result` (returning `full_intelegance_json`, the complete extracted textbook intelligence) are likewise public. The Next.js `/api/pal/*` proxies and the SSR pages `/pal/frameworks`, `/pal/ulu`, `/pal/pedagogy-engine` attach no token, and there is no `middleware.ts`, so the content is rendered server-side for anonymous visitors (client-side `DashboardShell` gating only runs after hydration).
**Evidence:** `routes/pal_api.php:31 Route::prefix('api/pal/pedagogy-engine')->group(...)` (no middleware); `PedagogyEngineController.php:19-21` "no learner or tenant scope, so it is registered outside the pal.auth group"; `SemanticIntelligenceSource.php:23,39-41` `if ($subInstituteId !== null) $query->where(...)` with the caller passing nothing (`PedagogyEngineService.php:111-114`); `findRow(): DB::table('semantic_intelligence')->whereNotNull('full_intelegance_json')...->orderByDesc('id')->first()`; `routes/api.php:660 Route::get('semantic-intelligence', ...)`; `pedagogy-engine.ts:234 fetch(\`${API_BASE_URL}${BACKEND_PATH}...\`, { headers: { Accept: 'application/json' } })` (no Authorization); `app/api/pal/pedagogy-engine/route.ts` has no auth check.
**Impact:** Any unauthenticated internet user can enumerate every institute's extracted chapters (`/api/pal/pedagogy-engine/chapters`) and read the full extracted concept content (definitions, rubrics, misconceptions, evidence text) by incrementing an integer id; `include_hidden=1` also reveals hidden sections. This is tenant-isolation failure and bulk exposure of proprietary (possibly copyright) curriculum data plus estate-wide telemetry aggregates.
**Expected Behavior:** Every endpoint that reads tenant-owned data requires a valid JWT and filters `semantic_intelligence` by the caller's `sub_institute_id`; SSR pages either forward the user's token or are behind an auth check.
**Recommended Fix:** Move the pedagogy-engine routes and the two semantic-intelligence routes under `pal.auth` (or `api.session`), pass the token institute into `listChapters()`/`findRow()`, add a Next-side session check (cookie or bearer) to `/api/pal/*` handlers and SSR pages, stop echoing upstream `error.message`, and consider splitting "rule definitions" (safe to be public) from "resolved concept content" (tenant data).
**Verification:** `curl` the two Laravel URLs without an Authorization header and confirm 401; confirm a school-A token cannot fetch a chapter id owned by school B; add a Feature test asserting 401/403/404.

## AI-B02
**Severity:** High   **Type:** Confirmed
**Category:** Authorization
**Module:** Legacy Content Intelligence review queue (`/pal/content/review`)
**Location:** `D:\next_lms_erp\app\Http\Controllers\api\PAL\PalContentIntelligenceController.php:125-158,161-185,809-823`; `D:\next_lms_erp\app\Services\PAL\Content\ContentMetadataService.php:270-340`; frontend `D:\lms_k12\app\pal\content\review\page.tsx:125-150`, `D:\lms_k12\app\pal\data\pal-content.ts:347`
**Function/Method:** `PalContentIntelligenceController::transition`, `::bulkTransition`, `::tenantAllows`, `ContentMetadataService::transition/bulkTransition`
**Problem:** Single transition executes `ContentMetadataService::transition()` (row loaded with `findOrFail($metadataId)` - no tenant filter - status saved, log written) and only AFTER the write compares `sub_institute_id` and returns 403, so another institute's row is already changed. `bulkTransition` has no tenant check at all. `tenantAllows()` returns true for `sub_institute_id = 0` rows, contradicting the "only the super admin may author into the shared vocabulary" rule stated in `writeTenantFor`. The legacy `transition` also skips the mandatory-field check that the new content-model path enforces, so a row can reach `approved` (the servable status) with mandatory tags empty.
**Evidence:** `PalContentIntelligenceController.php:139 $row = $this->metadata->transition(...)` then `:153 if (! $this->tenantAllows($request, (int) $row->sub_institute_id)) return 403`; `:176 $this->metadata->bulkTransition(... $validated['ids'] ...)` with no tenant argument; `:818 if ($rowTenant === 0) return true;`; `ContentMetadataService.php:280 $row = $modelClass::findOrFail($metadataId);`.
**Impact:** A teacher at institute A can approve, deprecate or reset the QA state of institute B's (and the shared) question/content metadata by guessing sequential ids (bulk: up to 200 per call); a 403 is returned yet the change persists. Only `approved` content is served to learners, so this defeats the QA gate across tenants (a school can be served another school's unreviewed items or lose approved items).
**Expected Behavior:** Tenant is resolved and checked BEFORE any write; bulk applies the same filter per id; tenant-0 rows writable only by `is_admin===2`; approval enforces mandatory fields.
**Recommended Fix:** Load the row with `->forTenant($tenant)` (or check `sub_institute_id` first) in `transition`, pass the tenant into `bulkTransition` and reject foreign ids, treat tenant 0 as read-only for non-super-admins, reuse `missingMandatory` in `ContentMetadataService::transition` when `to_status` is servable.
**Verification:** Feature test: token of institute 1 POSTs `/api/pal/content/review/question/{id-of-institute-2-row}` -> expect 404/403 AND unchanged `quality_status`; same for bulk; tenant-0 row -> 403.

## AI-B03
**Severity:** High   **Type:** Confirmed
**Category:** Authorization
**Module:** New content model authoring/review/approval (also legacy `/pal/content/review`)
**Location:** `D:\next_lms_erp\app\Http\Controllers\api\PAL\NewPalContentModelController.php:196-303,817-822`; `D:\next_lms_erp\app\Services\PAL\ContentModel\ContentModelAuthoringService.php:252-332`; `D:\next_lms_erp\config\pal_content.php:388-398`; `D:\lms_k12\app\pal\new\content-model\authoring\page.tsx:271,564-583`; `D:\lms_k12\app\pal\new\content-model\review\page.tsx:77-107,174-196`; `D:\lms_k12\app\pal\content\review\page.tsx:260-296`
**Function/Method:** `saveNode`, `transitionNode`, `bulkTransition`, `restore`, `enrich`, `translate`; `ContentModelAuthoringService::transition`
**Problem:** The only authorization is "not a student" (`is_student`). Any staff account of the institute (accountant, transport, receptionist ... - `PalApiAuth` classifies everyone non-student/non-admin as `staff`) can author, move a node through reviewed -> pedagogy_reviewed -> approved and bulk-approve 200 nodes at once. There is no reviewer/approver role, no `reviewer != author` rule (`updated_by`/`reviewed_by` are just stamped), no second approval, and the UI encourages self-approval ("Approve it yourself once you agree with it"). The frontend has no role gating either (the pages render for any user; a student only sees the server's 403 text). The legacy review queue additionally offers "Select all" + "Move to approved" for 50 items with no confirmation, while its own header says rubber-stamping produces "confident, wrong routing". Also `GET /api/pal/content/metadata/{type}/{id}` does not deny students.
**Evidence:** `NewPalContentModelController.php:817-822 return ! empty($auth['is_student']) ? $this->fail(...)`; `ContentModelAuthoringService.php:309-312` reviewer stamp only; `authoring/page.tsx:271 "... Approve it yourself once you agree with it."`; `content/review/page.tsx:265-270` select-all checkbox, `:277-291` "Move to approved".
**Impact:** Learner-facing content (only `approved` is servable) can be published by any single non-teaching staff member, or by the author alone, with no audit of who is entitled; the pedagogy-review and pilot stages are ceremonial. Content quality/safety for children and the integrity of the "human-in-the-loop" promise for AI-drafted material depend on this gate.
**Expected Behavior:** A named permission (e.g. `pal.content.approve` via `tbluserprofilemaster`/menu rights) required for `reviewed+`, approvers must differ from the last editor/author, and destructive bulk actions need confirmation.
**Recommended Fix:** Add a `PalContentReviewer` gate/middleware checked in `transitionNode`, `bulkTransition` and legacy `transition/bulkTransition`; enforce `reviewed_by != updated_by/created_by` for `pedagogy_reviewed` and `approved`; hide the workflow UI unless the server returns `can_review`; add a confirm dialog for bulk approval; deny students on `content/metadata` GET.
**Verification:** Feature tests with an accountant JWT and an author JWT attempting `approved`; expect 403; UI test that approve buttons are absent without permission.

## AI-B04
**Severity:** High   **Type:** Confirmed
**Category:** Authorization
**Module:** ULU authoring API and content framework-metadata API (PAL V4 backend)
**Location:** `D:\next_lms_erp\routes\pal_api.php:102-117`; `D:\next_lms_erp\app\Http\Controllers\api\PAL\PALAPIController.php:441-673`; `D:\next_lms_erp\app\Services\PAL\Framework\FrameworkProgressService.php:31-40`; `D:\next_lms_erp\app\Services\PAL\ULU\ULUService.php` (no `sub_institute` reference)
**Function/Method:** `updateContentFrameworkMetadata`, `getContentFrameworkMetadata`, `createULU/updateULU/deleteULU/duplicateULU/archiveULU/approveULU`, `getULU/getULUAnalytics/getULUPreview`, `getTeacherDashboard($request->all())`
**Problem:** `POST /api/pal/content/{contentId}/framework-metadata` has no role check and no tenant check: `Content::findOrFail($contentId)->fill(normalized)->save()`. Any valid JWT, including a student's, can rewrite pedagogy/framework tags of any `content_master` row in any institute. The ULU write actions deny only students; there is no owner/tenant/role beyond that, `findOrFail($id)` is global, so any teacher can approve, archive, delete or overwrite any ULU. `getTeacherDashboard` passes the raw request (filters) to the service.
**Evidence:** `PALAPIController.php:463-471` (`updateContentFrameworkMetadata` body has no guard); `:536-543` `denyStudentsForUlu` is the only check; `:635-647 approveULU`; `FrameworkProgressService.php:33-37`.
**Impact:** Students or cross-tenant staff can corrupt the metadata that drives variant routing and framework evidence (CASEL/NGSS/NCDG), delete or publish learning units for every institute. No UI consumes these writes, so the exposure is API-only, but the JWT is available to every logged-in user in the browser.
**Expected Behavior:** Metadata/ULU mutations require an authoring permission and, for tenant-owned rows, a tenant match; ULUs that are estate-global should be writable only by super admin/curriculum owners.
**Recommended Fix:** Apply `denyStudentsForUlu` (or a stricter authoring gate) to framework-metadata read/write, add tenant/ownership checks or an explicit "global ULU" super-admin rule, whitelist filters passed to dashboards.
**Verification:** Feature tests: student JWT -> 403; institute-2 staff editing institute-1 content -> 403/404.

## AI-B05
**Severity:** Medium   **Type:** Confirmed
**Category:** Authorization
**Module:** Coherence Map
**Location:** `D:\next_lms_erp\app\Http\Controllers\api\PAL\CoherenceMapController.php:48-67,295-327`; `D:\next_lms_erp\app\Services\PAL\Coherence\CoherenceMapRepository.php:87-100,506-509`
**Function/Method:** `CoherenceMapController::map/health/scopeFrom`, `CoherenceMapRepository::scope`
**Problem:** `scopeFrom()` computes the caller's tenant but `map()` and `health()` call the repository without it (`$this->map->map($scope['standard_id'], $scope['subject_id'], $learnerId)`); the repository then does `$tenant ??= $this->tenantOf($standardId, $subjectId)`, i.e. it resolves the tenant that OWNS the given ids and returns that tenant's map. No student deny exists on these routes either.
**Evidence:** `CoherenceMapController.php:57`; `CoherenceMapRepository.php:508 $tenant ??= $this->tenantOf($standardId, $subjectId);`; docblock at `CoherenceMapController.php:14-19` says tenancy for map-only routes comes from the token.
**Impact:** Any authenticated user (students included) can read another institute's concept graph (concept names, descriptions, chapter structure, counts) by supplying that institute's `standard_id`/`subject_id` (small integers). Curriculum data, not PII; severity medium because auth is required and Neo4j currently errors in dev.
**Expected Behavior:** The token tenant is passed to the repository and a scope owned by another tenant returns 404.
**Recommended Fix:** Pass `$scope['sub_institute_id']` as the 4th argument in `map()`/`health()`; reject when `tenantOf()` differs; deny students on authoring-oriented map views if intended staff-only.
**Verification:** Feature test with two tenants; mock repository to assert the tenant argument.

## AI-B06
**Severity:** Medium   **Type:** Confirmed
**Category:** Authorization
**Module:** Administration (architecture settings)
**Location:** `D:\next_lms_erp\app\Services\PAL\Administration\ArchitectureRegistry.php:194-212`; `D:\next_lms_erp\app\Http\Controllers\api\PAL\PalArchitectureController.php:137-184,259-292`; `D:\next_lms_erp\app\Http\Middleware\PalApiAuth.php:73-81`; `D:\next_lms_erp\config\pal_architecture.php:65-71`; frontend `D:\lms_k12\app\pal\new\administration\[subsystem]\page.tsx:87-119`
**Function/Method:** `ArchitectureRegistry::mayWrite`, `PalArchitectureController::userId/tenantFor/update/reset`
**Problem:** (1) `mayWrite` only honours `$auth['user_profile_name']` for the `writer_profiles` list, but `pal_auth` does not contain that key (it has `user_profile_id`, `role`), so writer-by-profile (`admin`, `principal`, `director` ...) never works; only JWT `is_admin > 0` does, locking out institute admins whose `is_admin` is null. (2) `userId()` reads `$auth['id']`, which is never set (`user_id` is), so `updated_by` is always NULL: scoring-parameter changes are unattributable and there is no history table. (3) A client-level admin (is_admin=1, `sub_institute_id=0`) resolves tenant 0 and writes the estate-wide default scope that affects every institute. (4) `config confirm_on_write` (mastery-model, progression-rubric, ai-agents) claims an explicit UI confirmation; the UI only relabels the button (AI-B16). (5) Any non-student staff can read all configuration incl. probe text and PHP class names.
**Evidence:** `ArchitectureRegistry.php:200 $profile = strtolower(trim((string) ($auth['user_profile_name'] ?? '')));`; `PalApiAuth.php:73-81` array keys; `PalArchitectureController.php:266 $id = $auth['id'] ?? null;`; `ArchitectureRegistry.php:555-557 scope()` maps `null`/0 to 0; `MasteryUpdater.php:240` consumes `mastery-model` BKT settings.
**Impact:** BKT/fluency/band parameters directly change every student's mastery and progression; changes are not attributable, can be made estate-wide by an institute-level actor, and the intended permission model does not work.
**Expected Behavior:** Write permission from a real role check, audit fields populated, estate scope writable only by `is_admin===2`.
**Recommended Fix:** Populate `user_profile_name` in `PalApiAuth` (or check `role==='admin'`), read `user_id`, forbid scope 0 unless `is_admin===2`, add a settings-history table.
**Verification:** Unit test `mayWrite` with a real `pal_auth` array; save as school admin and assert `updated_by` is set; save as client admin and assert 403 for scope 0.

## AI-B07
**Severity:** Medium   **Type:** Confirmed
**Category:** Business Logic
**Module:** Gamification - Challenge Mode scoring / leaderboard
**Location:** `D:\next_lms_erp\app\Services\PAL\Gamification\ChallengeModeService.php:202-310,338-396`; `D:\next_lms_erp\app\Http\Controllers\api\PAL\NewPalGamificationController.php:484-503`; `D:\next_lms_erp\routes\pal_api.php:418`
**Function/Method:** `ChallengeModeService::submit`, `leaderboard`
**Problem:** Score is computed server-side, but its inputs are client assertions: `correct` and `time_seconds` per response are read straight from the request body; `question_id` is only used to look up difficulty/target time and is not checked against items the learner was served or answered. No per-week attempt limit, no idempotency. Ranking uses `MAX(score)`, so repeated forged submissions win the board. The maximum is `1000 x 1 x 2.0 x 1.0`.
**Evidence:** `ChallengeModeService.php:239 if (! empty($response['correct'])) $correct++; :243 $totalTime += max(0.0, (float) ($response['time_seconds'] ?? 0));` ; `:359 MAX(score)`.
**Impact:** A student (or any script with their JWT) can post 5 fabricated "correct in 0.1s" items on the highest-difficulty question ids and top the class leaderboard, contradicting the module's "measured, never seeded" claim. No frontend calls `submit` today, so real Challenge Mode runs cannot be produced from this UI at all.
**Expected Behavior:** Correctness and timing derived server-side from an issued attempt (session id), one submission per issued attempt, sane caps.
**Recommended Fix:** Issue a signed challenge run (server picks items), grade against stored answers, cap `time_seconds` to the server-measured window, and throttle submissions.
**Verification:** Test that a body with fabricated `correct` flags for unserved question ids returns 422.

## AI-B08
**Severity:** Medium   **Type:** Confirmed
**Category:** Business Logic
**Module:** Gamification - Team challenges UI
**Location:** `D:\lms_k12\app\pal\new\gamification\team-challenges\page.tsx:49,122-131,159,395`; `D:\lms_k12\app\pal\new\data\gamification.ts:578-590`
**Function/Method:** `TeamChallengesPage` (`isStaffView`), `ChallengeComposer.submit`
**Problem:** The "New challenge" and "End early" controls are shown only when `isStaffView` is true, and `isStaffView` is computed from the DATA (`challenges.some(c => c.perLearner !== null)`). A class with zero challenges returns an empty list, so a teacher has no way to create the first challenge from the UI. Also `reward_approved: true` is hardcoded in the payload, so the "Awaiting teacher approval before it is shown to students" state (`:302-306`) is unreachable from the UI, and the composer requires typing raw database ids (`Standard id`, `Division id`, `chapter:8104` concept reference) with no pickers or validation.
**Evidence:** `team-challenges/page.tsx:49 const isStaffView = (data?.challenges ?? []).some((challenge) => challenge.perLearner !== null);`; `:395 reward_approved: true,`.
**Impact:** Feature (§4 teacher-initiated challenges) unusable in any class with no existing challenge; reward moderation bypassed; error-prone id entry.
**Expected Behavior:** Role/capability derived from the auth context or a server flag (`can_manage`); reward approval an explicit user choice; class/concept pickers.
**Recommended Fix:** Have the API return `can_manage` in the board payload (and use `isStudentSession()` as a fallback); remove the hardcoded approval; reuse the class/concept lookups.
**Verification:** Load the page as a teacher for a class with no challenges and confirm the button renders and creation works.

## AI-B09
**Severity:** Medium   **Type:** Confirmed
**Category:** Frontend
**Module:** Content model authoring page
**Location:** `D:\lms_k12\app\pal\new\content-model\authoring\page.tsx:241-255,257-301,203-239`
**Function/Method:** `handleTransition`, `handleEnrich`, `handleTranslate`, `handleRestore`
**Problem:** These handlers call `load()` after success, which resets `title`, `body` and `draft` from the server (`setDraft({})`, `:100-102`) with no dirty check. Transition and enrichment act on the SAVED node, not on the text on screen, so a reviewer who edits the body and presses "Approved" approves the previously saved text and silently loses the edit. Also the enrichment error fallback string is a copy artefact ("Extension Activity failed.", `:276`).
**Evidence:** `handleTransition: await transitionNode(node.nodeKey, toStatus); ... await load();` with `dirty` computed at `:201` but never consulted.
**Impact:** Data loss of unsaved edits and approval of content different from what the approver was looking at (compounds AI-B03).
**Expected Behavior:** Block or prompt when `dirty` before transition/enrich/translate/restore; keep local edits or force save-then-transition.
**Recommended Fix:** Disable the status buttons while `dirty` (or auto-save first), fix the error text.
**Verification:** Edit body, click Approved, confirm a prompt/disabled state and no text loss.

## AI-B10
**Severity:** Medium   **Type:** Confirmed
**Category:** Performance
**Module:** Gamification backend read paths
**Location:** `D:\next_lms_erp\app\Services\PAL\Gamification\StreakService.php:41-103,204-289`; `BadgeService.php:49-95,103-105`; `GamificationService.php:39-88`; `TeamChallengeService.php:165-210`; `NewPalGamificationController.php:96-107,222-231`
**Function/Method:** `StreakService::recompute`, `BadgeService::evaluate/collection`, `TeamChallengeService::progress`
**Problem:** GET endpoints recompute and WRITE on every request: `recompute()` runs `StreakDay::updateOrCreate` once per activity day (120+ upserts for an active learner) on `streak`, `streak/history`, and again inside overview, badge signals, session summary and personal-best refresh; `evaluate()` re-derives all signals for the full catalogue on every read; `progress()` runs per-learner queries for the whole class for every challenge and persists contributions/completion on a student GET. A teacher opening "view as student" awards badges and creates notifications for the child. Concurrent requests (two tabs) race into unique-index 500s (`pal_learner_badge_unique`, `pal_streak_day_unique`). Unbounded query parameters (`limit`, `days`) are accepted.
**Evidence:** `StreakService.php:75-83` upsert in the loop; `GamificationService.php:53-54` `refresh()` + `evaluate()` before reading; `BadgeService.php:105 $this->evaluate($learnerId);` inside `collection`.
**Impact:** Read latency and DB write load scale with activity history x page views; side effects on read (notifications to children triggered by staff browsing); sporadic 500s under concurrency.
**Expected Behavior:** Reads are idempotent and cheap; awards/streak rows are written by the event that causes them (or a queued job) with `firstOrCreate` semantics.
**Recommended Fix:** Move evaluation to a scheduled/queued job or post-attempt hook, cache `recompute` per learner/day, use `insertOrIgnore`/`firstOrCreate`, clamp `limit`/`days`, do not evaluate when `pal_auth.role !== student`.
**Verification:** Query-count test for `GET /overview` (should be constant); concurrent request test for duplicate-key 500s.

## AI-B11
**Severity:** Medium   **Type:** Missing
**Category:** Frontend
**Module:** Gamification - UI coverage of backend features
**Location:** `D:\lms_k12\app\pal\new\data\gamification.ts:1248-1262,1300-1307,1321-1363` (exports never imported by any page); `D:\lms_k12\app\pal\new\gamification\**`
**Function/Method:** `fetchNotifications`, `markNotificationsRead`, `fetchLeaderboard`, `declareCareerInterest`
**Problem:** The celebration/notification queue is written by the backend on every badge and personal best but never displayed or marked read (`unreadNotifications` is parsed and never rendered), career interest declaration (`declareInterest`, spec §5 interest_declaration with `invited`/`scenariosRequired`) has no UI, and there is no UI for badge revoke, class-availability toggle, team-challenge edit, or Challenge Mode runs (`submit`). The overview "New this visit" payload (`new_this_visit`) is also dropped by `fetchOverview`.
**Evidence:** `grep` shows no consumer of the four functions outside `data/gamification.ts` (only unrelated `fetchNotifications` in fees/platform-services).
**Impact:** Core motivational loop pieces (milestone notifications, Challenge Mode play, interest declaration) and teacher safety controls (§6.1 disable Challenge Mode for a class, §10.3 badge nullify) exist in the API only; unread notification rows accumulate forever.
**Expected Behavior:** Every specified user action has a UI or the backend routes are removed/flagged.
**Recommended Fix:** Add a notifications tray + mark-read, interest declaration step, teacher controls for badge revoke and class availability, and a real Challenge Mode run screen.
**Verification:** Manual walk-through against the spec sections; grep shows no unused client exports.

## AI-B12
**Severity:** Medium   **Type:** Confirmed
**Category:** Frontend
**Module:** Coherence Map page (Neo4j dependency)
**Location:** `D:\lms_k12\app\pal\new\coherence-map\page.tsx:42,52-73,163-171,351-356`; `D:\lms_k12\app\pal\new\data\coherence-map.ts:402-465`; `D:\next_lms_erp\app\Http\Controllers\api\PAL\CoherenceMapController.php:84-86` (no try/catch)
**Function/Method:** `CoherenceMapPage`, `fetchLearnerReadiness`, `fetchNextAction`
**Problem:** With the known Neo4j auth failure (memory: `Neo.ClientError.Security.Unauthorized`), `CoherenceMapController::scopes` throws (no try/catch) so the API answers a generic 500; the page shows a red banner with that text or `HTTP 500: the Coherence Map API is unavailable ... may not be deployed yet`, and the only retry control (`Refresh`) is `disabled={loading || !scope}` while the scope list is loaded once on mount, so the page is a dead end until a full reload. The learner readiness overlay is dead code (`const [readiness] = useState(null)` never set; `fetchLearnerReadiness` and `fetchNextAction` unused), so the "Mastery" drawer section can never render. A static paragraph asserts that every link is an unreviewed AI suggestion and none crosses a chapter boundary for every scope, regardless of the live counts shown above. The page has no `routeMapper`/shell entry.
**Evidence:** `page.tsx:166-167 disabled={loading || !scope}`; `:42 const [readiness] = useState<ReadinessMap | null>(null);`; `:351-356` static claim.
**Impact:** Feature is unusable and unrecoverable whenever Neo4j is down/misconfigured (currently true in dev); false claims once data improves; when `APP_DEBUG=true` the 500 body carries exception details (NOT VERIFIED).
**Expected Behavior:** Controller catches graph exceptions and returns a 503 with a clean message; UI offers Retry for scope loading and derives the caveat text from data (`draftEdges`, cross links).
**Recommended Fix:** Wrap Neo4j calls, add retry, wire or delete the readiness code, drive the caveat from `map.stats`, add the routeMapper/menu entry.
**Verification:** Simulate a Neo4j exception and confirm 503 + Retry works.

## AI-B13
**Severity:** Medium   **Type:** Confirmed
**Category:** Security
**Module:** Framework / ULU server-rendered pages
**Location:** `D:\lms_k12\app\pal\data\pal-content-model.ts:1125-1155`; consumers `D:\lms_k12\app\pal\_components\PalTaxonomyParentPage.tsx:61`, `PalTaxonomyDetailPage.tsx:67`
**Function/Method:** `resolveLocalApiUrl`, `getPalContentModel`
**Problem:** The server component builds a self-request URL from the incoming `x-forwarded-host`/`host`/`x-forwarded-proto` headers and fetches `${proto}://${host}/api/pal/content-model?...`. A forged Host header makes the Next server perform an outbound GET to an attacker-chosen host (path fixed) and render its JSON response into the page (SSRF + content injection, and cache poisoning if the page is cached). The fetch/`res.json()` are not wrapped in try/catch, so a network error or non-JSON reply throws inside a server component (500) instead of the designed error state. It also makes a pointless HTTP hop when the route handler simply calls `buildPalContentModelPayload` in-process.
**Evidence:** `pal-content-model.ts:1125-1132` `headerStore.get('x-forwarded-host') ?? headerStore.get('host')`; `:1137-1153`.
**Impact:** Outbound request forgery from the Next server to arbitrary hosts (response content rendered to the visitor), and availability issues.
**Expected Behavior:** Call the builder directly (or use a configured internal origin), wrap in try/catch.
**Recommended Fix:** Import `buildPalContentModelPayload` in the page and drop the self-call and Host-derived origin.
**Verification:** Send a request with `Host: evil.example` and confirm no outbound call is made.

## AI-B14
**Severity:** Medium   **Type:** Confirmed
**Category:** Backend
**Module:** Personalize Marks
**Location:** `D:\next_lms_erp\app\Http\Controllers\lms\pal\resultPersonalizeMarksController.php:54-121`; `D:\lms_k12\app\pal\personalize-marks\page.tsx:76-132`; `D:\lms_k12\app\pal\data\pal.ts:1714-1751`
**Function/Method:** `resultPersonalizeMarksController::store`, `resultPersonalMarksApi`
**Problem:** The server performs no validation: no `validate()`, no numeric or `obtain <= total` check, no check that arrays have equal length (`$student_name[$key]` undefined index), no check that `enrollment_no` exists in the tenant or matches `student_name` (both are free text), no upsert/unique key so a retry or double click inserts duplicate rows, and `status_code=1`/"Data Added Successfully" is set inside the loop even when a row was the "-- Select Standard Division --" placeholder and nothing was inserted. `resultPersonalMarksApi` returns marks for any client-supplied `enrollment_no` in the tenant.
**Evidence:** `store()` lines 56-89; `:85 DB::table('result_personalize_marks')->insert($insertData);` inside `if($standard!='-- Select Standard Division --')`, `:87-88` unconditional success.
**Impact:** Marks recorded against typos/wrong students, duplicated, or with obtain > total; unverifiable success message; anyone with the menu permission can read a classmate's marks by enrollment number.
**Expected Behavior:** Validate and resolve the student id server-side, reject duplicates, report accurate counts.
**Recommended Fix:** Add a FormRequest, resolve `student_id` from enrollment within the tenant and syear, use a unique index (student, exam, subject, syear), return per-row results.
**Verification:** Post duplicate and invalid rows and assert 422 / idempotence.

## AI-B15
**Severity:** Low   **Type:** Confirmed
**Category:** Backend
**Module:** PAL Report
**Location:** `D:\next_lms_erp\app\Http\Controllers\lms\pal\palController.php:3497-3526`; `D:\lms_k12\app\pal\data\pal.ts:88-94`; `D:\lms_k12\app\pal\report\page.tsx:38-44,111-120`; `D:\lms_k12\lib\table-export.ts:18-24`
**Function/Method:** `palController::palreport`, `parsePalStartTime`, `escapeCsvValue`
**Problem:** (1) Start time is formatted with `DATE_FORMAT(l.start_time, '%d-%m-%Y %h:%i:%s')` - 12-hour clock with no AM/PM - and the client parses it as 24-hour, so afternoon attempts sort/display as morning. (2) "Grade" is the string `obtain/(right+wrong)` (e.g. `12/20`), which Excel converts to a date when opened from the CSV/.xls export. (3) CSV/Excel export does not neutralise cells beginning with `= + - @`. (4) No LIMIT: every PAL attempt of the year for the institute is returned and paginated only in the browser; not scoped to a teacher's classes.
**Evidence:** `palController.php:3522`; `pal.ts:89 /^(\d{2})-(\d{2})-(\d{4})\s+(\d{2}):(\d{2}):(\d{2})$/`; `table-export.ts:18-24`.
**Impact:** Wrong ordering/time display, corrupted exports, memory/latency growth, formula injection if a student name starts with `=`.
**Expected Behavior:** 24h ISO timestamps, numeric/percent grade, formula-safe export, server pagination.
**Recommended Fix:** Use `%H`/ISO, return marks and total separately, prefix dangerous cells with `'`, add pagination and class scoping.
**Verification:** Export a report with a 2 PM attempt and a name `=1+1`, open in Excel.

## AI-B16
**Severity:** Medium   **Type:** Confirmed
**Category:** Frontend
**Module:** Administration panels
**Location:** `D:\lms_k12\app\pal\new\_components\AdministrationPanels.tsx:103-120,191-208`; `D:\next_lms_erp\config\pal_architecture.php:69-71`
**Function/Method:** `EditActions`, `FieldInput` (`tags`)
**Problem:** (1) The config states learner-scoring subsystems are "held behind an explicit confirmation in the UI", but the UI only changes the button label to "Save - affects learners"; there is no dialog, and "Reset to default" (deletes the override, irreversible, no history) is one click for every subsystem. (2) The `tags` input is controlled by the parsed array: each keystroke splits on commas, trims and drops empties, so typing `a,` immediately re-renders `a` and the comma is lost; a second tag can only be added by paste. (3) The success banner "The change applies to every learner scored from now on" is shown regardless of institute vs estate scope.
**Evidence:** `AdministrationPanels.tsx:118`; `:191-207` `value={Array.isArray(value) ? value.join(', ') : ...}` with `onChange` splitting immediately.
**Impact:** Accidental one-click changes to BKT/rubric parameters affecting all learners in scope; some list settings cannot be edited by typing.
**Expected Behavior:** Confirmation dialog stating scope and diff; text kept as a string until blur/save.
**Recommended Fix:** Add a confirm modal for `needsConfirm` saves and all resets; store raw text in draft and split on save.
**Verification:** UI test typing `a, b` into a tags field; confirm modal appears on save/reset.

## AI-B17
**Severity:** Low   **Type:** Confirmed
**Category:** Frontend
**Module:** Content model data client
**Location:** `D:\lms_k12\app\pal\new\data\content-model.ts:479,872,1110,1150,1164,1180,1209,1243`; page inputs `authoring/page.tsx:65`, `concept/page.tsx`, `chapter/page.tsx`
**Function/Method:** `fetchNode`, `saveNode`, `transitionNode`, `restoreRevision`, `enrichNode`, `translateNode`, `fetchConceptModel`, `fetchChapterModel`
**Problem:** URL-derived values (`?node=`, `?slug=`, `?id=`) are interpolated into the API path without `encodeURIComponent`, unlike `administration.ts` which encodes. `..%2F` sequences are normalised by the browser fetch, letting a crafted link make the authenticated client GET/POST to other API paths under the user's bearer token (exploitability is limited: the page needs a successful GET to render action buttons and POST bodies do not match other routes).
**Evidence:** ``callApi(`api/pal/new/content-model/nodes/${nodeKey}`, ...)``.
**Impact:** Low; defence-in-depth and robustness gap.
**Expected Behavior:** Encode every path segment and validate the node key shape client-side.
**Recommended Fix:** `encodeURIComponent` + regex guard matching the server route constraint.
**Verification:** Load `/pal/new/content-model/authoring?node=..%2F..%2Fadministration` and confirm no cross-route request.

## AI-B18
**Severity:** Low   **Type:** Potential
**Category:** Business Logic
**Module:** Gamification - streak/time-on-task integrity and time handling
**Location:** `D:\next_lms_erp\app\Services\PAL\Telemetry\TelemetryService.php:185-213`; `D:\next_lms_erp\app\Http\Controllers\api\PAL\PALAPIController.php:679-720`; `D:\next_lms_erp\app\Services\PAL\Gamification\LearnerActivitySource.php:596-611`; `D:\next_lms_erp\config\app.php:72`; `D:\lms_k12\app\pal\new\data\gamification.ts:1387-1392`
**Function/Method:** `processStatement`, `dailyActivity`, `formatDate`
**Problem:** xAPI telemetry `timestamp` and `result.duration_seconds` are client-supplied and uncapped; they feed `productive_minutes` used by the streak minimum-minutes rule. Streak days use one hard-coded app timezone (`Asia/Kolkata`) for every tenant. `formatDate` calls `new Date('YYYY-MM-DD')` (UTC midnight) then `toLocaleDateString`, which shows the previous day in timezones west of UTC.
**Evidence:** `TelemetryService.php:186 'timestamp' => $statement['timestamp'] ?? now()`; `config/app.php:72`.
**Impact:** A student can inflate minutes/back-date telemetry to satisfy the 10-minute streak bar when at least one real attempt exists that day; off-by-one date display outside India.
**Expected Behavior:** Server-side timestamps, capped durations, per-tenant timezone, date-only parsing without UTC shift.
**Recommended Fix:** Use `now()` and clamp `duration_seconds`, store tenant tz, format date-only strings by splitting components.
**Verification:** POST a statement with `duration_seconds=36000` and confirm it is clamped.

## AI-B19
**Severity:** Medium   **Type:** Potential
**Category:** Business Logic
**Module:** PAL Intelligence page (student view)
**Location:** `D:\lms_k12\app\pal\intelligence\page.tsx:148-160,345-358,584-587`; `D:\next_lms_erp\routes\pal_api.php:63-83`; `PALAPIController.php:120-260`
**Function/Method:** `PalIntelligencePage`, `VelocityCard`, `RiskCard`
**Problem:** For a student session the page loads the student's own disengagement, failure and burnout risk scores and shows "Cohort rank: Nth pct of N" (`velocityPercentile`, `cohortSize`). No backend route denies students these signals. This conflicts with the gamification module's own governance ("a struggling student is never shown where they stand against anyone else", `GamificationVisibility` docblock) and exposes predictive labels ("Failure risk 82% critical") to children. Whether the backend actually populates the percentile for students is NOT VERIFIED.
**Evidence:** `intelligence/page.tsx:155-159` student branch; `:581-588` cohort rank row; `:347-353` risk cards.
**Impact:** Potentially harmful/labelling content shown to minors; policy inconsistency between two PAL surfaces.
**Expected Behavior:** Student audience receives only the growth-framed subset; risk/percentile restricted to staff.
**Recommended Fix:** Apply the visibility matrix to `/api/pal/*-risk`, velocity percentile and regression for `role===student`; hide those cards client-side as a second layer.
**Verification:** Call `failure-risk` with a student token and expect 403; render the page as a student.

## AI-B20
**Severity:** Low   **Type:** Confirmed
**Category:** Frontend
**Module:** PAL content/pedagogy/administration empty states
**Location:** `D:\lms_k12\app\pal\content\page.tsx:351-355`; `content\review\page.tsx:310`; `content\misconceptions\page.tsx:218`; `pedagogy-engine\_components\PedagogyEngine.tsx:188`; `new\administration\page.tsx:102`; `new\data\*.ts` 404 messages
**Function/Method:** empty-state copy
**Problem:** End-user screens print server-operator instructions (`php artisan pal:tag-content`, `pal:install-pedagogy-engine`, "Deploy the New PAL Administration module and run its migrations", "the backend may not be deployed yet"). Teachers/admins cannot act on these and it discloses internal command names and architecture.
**Impact:** Confusing UX, minor information disclosure.
**Expected Behavior:** Plain-language empty states with a contact-your-administrator hint; ops detail logged, not rendered.
**Recommended Fix:** Replace with neutral copy; keep technical detail behind a debug flag.
**Verification:** Visual review of each empty state.

## AI-B21
**Severity:** Low   **Type:** Improvement
**Category:** Architectural
**Module:** New PAL data clients and gamification hook
**Location:** `D:\lms_k12\app\pal\new\data\{gamification,content-model,administration,coherence-map}.ts` (`callApi`); `D:\lms_k12\app\pal\new\gamification\_components\useGamificationResource.ts:40-83`; `D:\lms_k12\app\pal\reports\attainment\page.tsx:57-73`; `D:\lms_k12\lib\module-ai\module-ai-stack.ts:60-78`
**Function/Method:** `callApi` x4, `useGamificationResource`, `readModuleWorkspaceSession`
**Problem:** Four copy-pasted `callApi` implementations with subtle differences (query support, PUT, status texts); none redirects to login on 401 or refreshes; the bearer token and API host are read from localStorage on every call (XSS-exfiltratable pattern shared repo-wide). `useGamificationResource` has no stale-response guard (switching learner mid-flight can render the previous learner's data; `StreaksPage` history is not reset on learner change and `historyError` is never cleared). The attainment class dropdown swallows roster errors (`.catch(() => setStandards([]))`), leaving an empty select with no message. `readNumber` defaults to 0 in many mappers so missing fields render as measured zeros despite the module's stated "null not 0" rule.
**Impact:** Maintainability, stale/incorrect views during quick learner switching, silent failure states.
**Recommended Fix:** Extract one shared client with 401 handling and abort-safe loaders; surface roster errors; use nullable readers for all measured values.
**Verification:** Switch learners rapidly on a slow network and confirm no cross-learner rendering.

## AI-B22
**Severity:** Low   **Type:** Confirmed
**Category:** Frontend
**Module:** New PAL navigation
**Location:** `D:\lms_k12\app\pal\new\_components\NewPalNav.tsx:22-85`; `D:\lms_k12\app\components\DashboardShell.tsx:138-175`; `D:\lms_k12\app\data\routeMapper.ts:257-294`; pages importing `NewPalNav` (content-model x6, coherence-map)
**Function/Method:** `SUB_MODULES`, `NEW_PAL_LEVEL3_ITEMS`
**Problem:** Three navigation sources disagree: `NewPalNav` (3 sub-modules), the shell L3 list (6: content model, ULU, pedagogy engine, administration, gamification, AI stack) and the DB menu (7 per the component's own comment). Coherence Map and Reports have no shell L3 item and Coherence Map has no `routeMapper` entry, so menu rights (`can_view`) cannot govern it. The seven `NewPalNav` pages render a second sub-nav on top of the shell's (the overview page explicitly removed its duplicate).
**Impact:** Sub-modules reachable from one nav but not another; permission model incomplete for Coherence Map.
**Recommended Fix:** Drive both from the menu rights API; add the routeMapper entry; drop in-page `NewPalNav`.
**Verification:** Compare `tblmenumaster` rows under parent 531 with rendered tabs.

## AI-B23
**Severity:** Low   **Type:** Potential
**Category:** Security
**Module:** Content model AI enrichment / authoring inputs
**Location:** `D:\next_lms_erp\app\Http\Controllers\api\PAL\NewPalContentModelController.php:212-219,467-476,590-593`; `ContentModelAuthoringService.php:173-179,214-219`; `ContentModelLlmClient.php:84-108`
**Function/Method:** `saveNode`, `enrich`, `translate`
**Problem:** `media_url` is accepted as any string up to 2000 chars (no scheme allow-list), `body` is unbounded, `translate.language` is only `size:2` (not one of the 9 registered languages), enrichment/translation have no per-user throttle (a 180 s synchronous provider call per request, mitigated only by the 30-day fingerprint cache), and prompts embed raw node/body text (prompt-injection surface, outputs validated only for closed-vocab fields). Editing `pedagogy_reviewed`/`piloted` nodes does not reset their status (only `approved` resets).
**Impact:** Possible stored `javascript:` URL if a consumer renders `media_url` in `href`/`src` (NOT VERIFIED), provider cost abuse by any staff, review-stage bypass by post-review edits.
**Expected Behavior:** URL scheme allow-list, language whitelist, throttle middleware, reset review status on any content edit past `reviewed`.
**Recommended Fix:** Validate `media_url` (`https`), `language` in registered set, add `throttle:` middleware, reset status when text changes.
**Verification:** POST `media_url=javascript:alert(1)` and expect 422.

## AI-B24
**Severity:** Low   **Type:** Confirmed
**Category:** Testing
**Module:** New PAL (whole slice)
**Location:** `D:\lms_k12` (no tests under `app/pal/new`, `lib/new-pal`, `lib/module-ai`); `D:\next_lms_erp\tests` (no tests for gamification, content-model, administration, coherence, pedagogy-engine authz/tenancy)
**Function/Method:** n/a
**Problem:** ~4,000 lines of gamification/authoring/administration logic including scoring math, tenancy and approval rules have no automated tests; the defects above (AI-B01..07) would each be caught by a small feature test.
**Impact:** Regressions in authorization and mastery-affecting settings go unnoticed.
**Recommended Fix:** Add Feature tests for role/tenant matrices and Unit tests for `StreakService::walk`, `ChallengeModeService::submit`, quality-status transitions.
**Verification:** CI shows the new tests.

## AI-B25
**Severity:** Low   **Type:** Potential
**Category:** Architectural
**Module:** module-ai AI Stack ledger
**Location:** `D:\lms_k12\lib\module-ai\module-ai-stack.ts:232-294`; `D:\lms_k12\lib\intelligence\ai-module.ts:171-208`
**Function/Method:** `recordModuleOperation`, `logModuleOperation`
**Problem:** The AI Stack activity ledger is authored by the browser: operation, status, message, subject id/label and free-form `result` come from client code and are posted with the user's token and an `X-MCP-Institute-Id` header (the server validates that header against the allowed institutes in `McpContextResolver.php:77-84`, which is good). Whether the activity endpoint verifies the claimed artefact ids/status server-side was not verified.
**Impact:** If unvalidated, the "audit" ledger can be forged by any user; entries are best-effort (failures swallowed) so it is not a reliable audit record.
**Recommended Fix:** Record ledger entries server-side at the point the operation executes; treat client entries as advisory.
**Verification:** NOT VERIFIED - review `/api/ai/modules/{key}/activity` controller.

## AI-B26
**Severity:** Medium   **Type:** Confirmed
**Category:** Authorization
**Module:** Gamification teacher actions (team challenges, Challenge Mode, badge revoke)
**Location:** `D:\next_lms_erp\app\Http\Controllers\api\PAL\NewPalGamificationController.php:173-201,237-267,292-376,470-481,536-567,668-745`; `D:\next_lms_erp\app\Http\Middleware\PalApiAuth.php:101-121,165-174`
**Function/Method:** `teamChallenges`, `createTeamChallenge`, `updateTeamChallenge`, `endTeamChallenge`, `challengeModeAvailability`, `challengeModeOptIn`, `revokeBadge`, `mayManageChallenge`
**Problem:** The teacher class-scope rule (`class_teacher`/`timetable`) is applied only when a `learner_id` is present. Class-scoped calls (`standard_id`/`division_id`, no learner) skip it, so any non-student staff account can list any class's challenges with the per-student name breakdown, create/end/edit challenges and switch Challenge Mode on or off for any class in the institute. `mayManageChallenge` returns true when the token has no institute (`$institutes === []`). `challengeModeOptIn`, `careerQuest/interest|pathway|report` accept a staff `learner_id` and act as the child, so a teacher can opt a student into a competitive leaderboard (the module's consent model says the learner chooses).
**Evidence:** `NewPalGamificationController.php:735 return $institutes === [] || in_array((string) $challenge->sub_institute_id, $institutes, true);`; `:668-709 classScope` for staff; `:470-481 challengeModeOptIn` uses `learnerId()` which honours staff input.
**Impact:** Over-broad staff powers and a consent bypass for minors on Challenge Mode; per-student contribution names of any class visible to non-teaching staff.
**Expected Behavior:** Class-level actions restricted to the class teacher/admin; opt-in and pathway choices only by the learner (or explicit guardian flow).
**Recommended Fix:** Reuse `PalApiAuth::isStudentInTeacherScope` for class-level routes, deny non-student callers on learner-consent endpoints, fail closed on empty institute lists.
**Verification:** Feature tests with an out-of-class teacher and a non-teaching staff token.




<!-- sub-part C issues -->
## AI-C01
**Severity:** Critical   **Type:** Confirmed
**Category:** Authorization
**Module:** Enterprise Brain (all screens) / Foundation Students, People, Teachers, AI Assistant, Settings
**Location:** `D:\next_lms_erp\config\brain.php:30`; `D:\next_lms_erp\app\Http\Middleware\Brain\BrainAuthenticate.php:117-139`; `D:\next_lms_erp\app\Http\Controllers\Brain\BrainController.php:54-62`; `D:\next_lms_erp\app\Brain\Authorization\Role.php:46-47`; `D:\next_lms_erp\routes\brain.php:45-225`; frontend `D:\lms_k12\app\components\DashboardShell.tsx:304-315,325-357`; `D:\lms_k12\app\components\ConditionalApp.tsx:36-38`; `D:\lms_k12\lib\brain\navigation.ts:160-166` (comment)
**Function/Method:** `BrainAuthenticate::roleFor`, `BrainController::access`, `people`, `foundation`, `BrainIntelligenceController::students/studentIntelligence/teacherIntelligence`, `BrainController::settings/aiAssistant`
**Problem:** Any valid LMS JWT — including Student and Parent profiles — resolves to the `viewer` role (default_role) which holds `read`; every Brain GET requires only `read`. `GET /access` returns `allowed:true` unconditionally, so the frontend also shows the "Enterprise Brain" sidebar entry to everyone. Role restriction to school-admin profiles is only described in comments, not enforced.
**Evidence:** `'default_role' => 'viewer'`; `case self::VIEWER: return [Permission::READ];`; `access()` returns `['allowed' => true, ... 'role' => auth.role]`; `students()` selects `'dob','mobile','email','gender','enrollment_no'` for up to 300 students (`BrainIntelligenceController.php:1145-1191`); `people()` returns `email, mobile, gender, employee_no` for 300 staff (`BrainController.php:46-49,228-277`); `studentIntelligence($id)` returns attendance/marks/homework/**fees** for any student id in the tenant (`EntityIntelligence.php:44-76`); `teacherIntelligence` returns name+email+performance; `settings()` returns the audit log and API-key prefixes; `aiAssistant()` returns every user's conversation sessions. `DashboardShell.tsx:312`: `setHasBrainAccess(Boolean(res.ok && data?.allowed) || ...)`.
**Impact:** A student or parent can read the whole tenant's student roll (DOB, phone, e-mail), staff contact list, individual students' attendance/marks/fee-arrears, teacher performance and audit trail by calling the API directly (or just navigating to `/enterprise-brain/**` — no route guard). Privacy/PII breach of minors' data within a tenant. (Cross-tenant read not found: token pins tenant.)
**Expected Behavior:** Brain read access limited to configured staff profiles; students/parents get 403; per-screen permissions for PII screens; the frontend shows the entry only when the backend allows.
**Recommended Fix:** Set `default_role` to a no-permission role (or deny unmapped profiles), make `access` return `allowed:false` for non-staff/unmapped roles, add a dedicated permission (e.g. `pii.read`) for student/people/teacher/intelligence-by-id endpoints, and add a layout-level guard in `app/enterprise-brain/layout.tsx` that calls `/access`.
**Verification:** Log in as a student (id from a seeded tenant), `curl -H "Authorization: Bearer <student token>" /api/brain/<tenant>/students` — expect 403; expect sidebar entry absent.

## AI-C02
**Severity:** Critical   **Type:** Confirmed
**Category:** Security
**Module:** Enterprise Brain — AI Assistant search
**Location:** `D:\next_lms_erp\app\Http\Controllers\Brain\BrainController.php:949-997` (row payload at `:977-993`); consumer `D:\lms_k12\app\enterprise-brain\knowledge\ai-assistant\page.tsx:41`
**Function/Method:** `BrainController::search`
**Problem:** The global search selects entire rows (`DB::table('tbluser')->...->limit(10)->get()`) and returns each one as `'record' => $record`. `tbluser` carries `password` and `plain_password` (columns selected by `ApiLoginController.php:45-46`); the ERP stores staff passwords in plaintext (project memory + `loginController`). The React page only renders `label` and `id`, but the full record is in the network response.
**Evidence:** `foreach ($rows as $row) { $record = (array) $row; $results[] = ['type'=>$type,'id'=>..., 'label'=>..., 'record' => $record]; }` with sources `'person' => ['tbluser', 'sub_institute_id', ['first_name','last_name','email'], 'first_name']`. Reachable by any `viewer` (AI-C01).
**Impact:** Any authenticated user (incl. students/parents) can harvest credentials, phone numbers, addresses and other columns of same-tenant staff by searching a letter — account takeover of admins in the tenant.
**Expected Behavior:** Return only an explicit allow-list of columns (`id`, label, type); never `password`/`plain_password`.
**Recommended Fix:** Replace `->get()` with `->get(['id', <label cols>])`, drop the `record` key (or whitelist), and audit other `lmsRows()/rows()` helpers that use `select *` (`BrainController.php:1104-1133`). Rotate any credentials assumed exposed.
**Verification:** As a student call `GET /api/brain/<t>/search?q=a` and assert no `password`/`plain_password`/`mobile` keys.

## AI-C03
**Severity:** Critical   **Type:** Confirmed
**Category:** Security
**Module:** Enterprise Brain — Agent Management (Next API routes)
**Location:** `D:\lms_k12\lib\agents\acting-user.ts:37-47`; `D:\lms_k12\lib\agents\engine.ts:67-80`; `D:\lms_k12\app\api\agents\_lib\handler.ts:16-33`; `D:\lms_k12\app\api\agents\route.ts:12-19`; `D:\lms_k12\app\api\agents\runs\route.ts:11-24`; `D:\lms_k12\lib\agents\store.ts:201`
**Function/Method:** `readRequestSession`, `listAgents`, `listRuns`, `engineContextFor`
**Problem:** Tenant and user identity are read from caller-supplied headers (`x-sub-institute-id`, `x-user-id`, `x-user-name`, `x-user-profile-*`). `listAgents`/`listRuns` perform **no authentication or authorization** — `requireActor` only checks the headers are non-empty. Run records persist `input` and `output` of tool executions, which include live records fetched via MCP read tools (fee defaulter lists etc.).
**Evidence:** `requireActor` -> `context.store.listRuns(context.actor.tenant_id, filter)`; `GET /api/agents/runs` returns `ok(await listRuns(engineContextFor(request), ...))` with no token check. A request with `x-sub-institute-id: 61` and `x-user-id: 1` and no token lists tenant 61's agents and full run log (`output` JSON).
**Impact:** Unauthenticated cross-tenant disclosure of agent definitions, acting-user names/profiles and tool outputs (student/fee data), and audit-log spoofing (`acting_user_*` are whatever the caller sends).
**Expected Behavior:** Identity and tenant derived only from a verified Laravel token; list endpoints require an authenticated tenant member with the `agents.<module>` view right.
**Recommended Fix:** Validate the bearer token server-side against Laravel (or verify the JWT with the shared secret) and take tenant/user from its claims, not headers; call `authorize(..., 'view')` for list endpoints; scope the store by the verified tenant.
**Verification:** `curl /api/agents/runs -H "x-sub-institute-id: <other tenant>" -H "x-user-id: 1"` must return 401/403.

## AI-C04
**Severity:** High   **Type:** Confirmed
**Category:** Security
**Module:** Agent Management + Conversational AI admin
**Location:** `D:\lms_k12\lib\agents\acting-user.ts:37-40,74-107`; `D:\lms_k12\app\api\conversational-ai\_lib\handler.ts:16-25`; `D:\lms_k12\lib\ai\conversational-admin\service.ts:64-67,~185-200`; `D:\lms_k12\lib\ai\conversational-admin\store.ts` (global token store)
**Function/Method:** `laravelAuthorizer`, `adminContextFor`, `rotateServiceToken`, `updateSettings`
**Problem:** The "enforcement" of RBAC is an HTTP call to `${x-laravel-base-url}/api/permissions` where the base URL comes from a **request header** (`session.baseUrl = header('x-laravel-base-url') || defaultBaseUrl()`), and the reply is trusted. An attacker points the header at a server they control that answers `{status_code:1,data:{<module>:{create:true,update:true}}}`. This is both a forged-authorization bypass and an SSRF (server-side fetch to any URL carrying the supplied bearer). The conversational-AI token/settings store is global (not tenant-scoped).
**Evidence:** `baseUrl: (header(request, 'x-laravel-base-url') || defaultBaseUrl()).replace(/\/$/, '')`; `fetch(\`${session.baseUrl}/api/permissions?modules=...\`)`; `requireUpdateRight` -> `rotateServiceToken` mints and stores a new service token (`plaintext` returned once).
**Impact:** Anyone able to send a request (with any non-empty token) can create/activate/run agents (executing MCP read tools with the supplied token), change conversational-AI channel settings and **issue/rotate external-project service tokens** for the shared `/api/ai` endpoint, invalidating the real one.
**Expected Behavior:** Base URL from server configuration only; permissions verified against the real Laravel with the caller's verified token; service tokens tenant/platform-admin gated.
**Recommended Fix:** Remove `x-laravel-base-url` (use `defaultBaseUrl()` only, or an allow-list), verify tokens server-side, restrict token rotation to platform admins and move the store to Laravel.
**Verification:** Send `x-laravel-base-url: https://attacker.example` and assert the route ignores it / denies.

## AI-C05
**Severity:** High   **Type:** Confirmed
**Category:** Authorization
**Module:** Enterprise Brain — decisions, executions, ingestion, workflows
**Location:** `D:\next_lms_erp\routes\brain.php:68,87-88,197-202`; `D:\next_lms_erp\app\Brain\Authorization\Role.php:49-71`; `D:\next_lms_erp\config\brain.php` (`profile_name_roles`); `D:\next_lms_erp\app\Http\Controllers\Brain\BrainIntelligenceController.php:232-333,389-496`; `D:\lms_k12\app\enterprise-brain\automation\page.tsx:42-88,163-180`
**Function/Method:** `decide`, `executionComplete`, `ingestionRun`, `triggerWorkflow`
**Problem:** The governance permissions `decision.approve`, `eso.execute` and `evidence.curate` are defined and granted to `manager` but are **used by no route**. Approving/rejecting a recommendation and reporting an execution outcome require only `update`, which `analyst` (accountant, clerk, counsellor, assistant clerk) holds; ingestion run and workflow trigger need only `create`. Additionally `decide` does not check that the recommendation is still pending and `executionComplete` does not check that the execution is still queued.
**Evidence:** `Route::post('recommendations/{id}/decide', ...)->middleware('brain.permission:update')`; `Role::ANALYST` includes `CREATE, UPDATE`; `config/brain.php` maps `'accountant' => 'analyst'`, `'clerk' => 'analyst'`, `'counsellor' => 'analyst'`; `decide()` fetches the recommendation by id/tenant only and always inserts a decision and, if `eso_id`, a new queued execution.
**Impact:** Non-managers can approve institutional decisions; replaying `decide` creates duplicate decisions/executions; re-completing an execution creates duplicate outcomes that feed the "learning" loop. Undermines the governance claims in the UI.
**Expected Behavior:** `decide` -> `decision.approve`, `complete` -> `eso.execute`; idempotency guards on status transitions.
**Recommended Fix:** Change route middleware, add `where('status','pending')` / `where('status','queued')` guards returning 409, and hide Approve/Reject/Run buttons based on `/settings.permissions`.
**Verification:** As an `analyst` token POST `decide` -> expect 403; POST twice as manager -> second returns 409.

## AI-C06
**Severity:** High   **Type:** Confirmed
**Category:** Security
**Module:** Career Explorer / Career Counselling backend (public routes)
**Location:** `D:\next_lms_erp\routes\lms.php:380-397`; `D:\next_lms_erp\app\Http\Controllers\lms\counselling\lmsCounsellingController.php:566-584,1097-1101,1160-1449`
**Function/Method:** `intrestQuestions/intrestResults/intrestJobzone/intrestCareers/intrestEnterScore/intrestArea`, `matchProfile`, `getEmployerData`, `allOccupation`
**Problem:** 17 career GET routes are registered with **no auth middleware**. Six of them are pass-through proxies to `services.onetcenter.org` authenticated with the organisation's `ONET_USERNAME/PASSWORD`. `matchProfile` returns a hardcoded payload containing a named student (`student_id 97382`, "Evaan Rajesh Rafaliya", class 7/8 interests/skills) and has no UI consumer. `getEmployerData` returns `OnetEmployer::all()` (company e-mail/phone) and `allOccupation` sets `Access-Control-Allow-Origin: *`.
**Evidence:** `Route::get('intrestQuestions', ...)` outside any `Route::middleware` group (lines 380-397 vs the `session` group at 402); `Http::withHeaders(['Authorization' => 'Basic ' . $credentials])`; `matchProfile` builds `$response = ["interest_profile" => ..., "exist_student_profile" => [["student_id" => 97382, "name" => "Evaan Rajesh Rafaliya", ...]]]`.
**Impact:** Anyone on the internet can consume the O*NET quota/licence via the school's credentials (abuse, throttling, cost), scrape employer contact data, and read a (likely real) minor's name/id from source-embedded demo data. Endpoints also add load with no rate limit.
**Expected Behavior:** Career reference endpoints behind `session`/`api.session`; proxy endpoints rate-limited; no personal data in code.
**Recommended Fix:** Put the block under the existing `Route::middleware(['session'])` group, delete `matchProfile` and unused `intrest*` routes (`intrestEnterScore/Area/Careers/Jobzone` have no consumer), remove the wildcard CORS header, add `throttle`.
**Verification:** `curl https://<host>/matchProfile` without a token -> 401.

## AI-C07
**Severity:** High   **Type:** Confirmed
**Category:** Business Logic
**Module:** People & Competency LMS — Assignments (approval queue, bulk update)
**Location:** `D:\lms_k12\app\people-competency\lms\assignments\_lib\use-assignments.ts:139-160,247-262`; `D:\lms_k12\components\domain\lms\assignments\learning-assignments.tsx:1175,1184,1221,1230,1329-1335`; `D:\lms_k12\components\ui\g2g\data-table.tsx:121,128,191`; backend `D:\next_lms_erp\app\Http\Controllers\G2gLms\AssignmentsController.php:591-630`
**Function/Method:** `handleBulkUpdate`, `handleReview`, `DataTable` selection
**Problem:** The shared `DataTable` identifies selected rows by `String(index)`. (a) Approval Queue/Enrolments actions send `selectedIds.map(Number)` — row indices 0..n — as the `ids` of `POST /api/g2g-lms/assignments/bulk-review`, not primary keys. (b) Queue tab bulk status update resolves `assignments[Number(idx)]` against the raw unfiltered state array although the table renders a filtered and paginated slice.
**Evidence:** `const actualIds = selectedIds.map((idx) => assignments[Number(idx)]?.id)` while the hook returns `assignments: filteredAssignments`; `onClick={() => void handleReview(selectedIds.map(Number), 'approved')}`; backend `whereIn('id', $request->ids)->where('approval_status','pending')`.
**Impact:** "Approve/Reject" either does nothing ("0 request(s) approved") or approves/rejects unrelated pending rows whose id equals an index; bulk status changes hit the wrong assignments whenever a filter or page > 1 is active. Data-integrity defect in an HR approval workflow.
**Expected Behavior:** Selection keyed on the row's real id; operations act on exactly the selected rows.
**Recommended Fix:** Give `DataTable` a `getRowId` prop (default `row.id`), send those ids, and drop the index lookup in the hook.
**Verification:** Create 3 pending requests, select the 2nd on page 2 with a filter active, approve; assert only that request changes.

## AI-C08
**Severity:** High   **Type:** Confirmed
**Category:** Business Logic
**Module:** Capability Intelligence — Command Center dashboard (mock/degraded KPIs)
**Location:** `D:\next_lms_erp\app\Services\Competency\CommandCenterService.php:158-161,188-193,236-239,296-307`; `D:\lms_k12\app\capability-intelligence\dashboard\components\command-center.tsx:519-539,543-570,582-606,668-701`
**Function/Method:** `CommandCenterService::summary/progress/workQueues/assessmentCalendar`; `CommandCenter` render
**Problem:** "Active Assessments", "Assessment Completion", "Pending Reviews", "Open Assessments" and the "Assessment Calendar (Next 60 Days)" are constants (`0` / `cycle => null`), commented "DEGRADED: s_competency_assessments does not exist". The UI renders them as measured values (`0`, `0%`, `0 / 0`, "No active assessment cycle") with no "not available" indication. The Brain class doc records that both tables **do exist** (empty), contradicting the service comment.
**Evidence:** `$assessments = 0;` … `['key' => 'assessments', 'label' => 'Active Assessments', 'value' => $assessments, 'desc' => 'In progress']`; progress ring `'percent' => (int) $assessmentPercent` = 0; `'upcoming_count' => 0`.
**Impact:** Executives read "0% assessment completion / 0 open assessments" as fact; four of eleven dashboard KPIs are fabricated zeros; the same 0 also drives `PROGRESS_TARGET/QUEUE_TARGET` navigation to unrelated screens.
**Expected Behavior:** Either compute from the (existing) assessment tables or mark the metrics `available:false` and render "Not tracked yet".
**Recommended Fix:** Add `available` flags in `summary()/progress()/workQueues()` payload and render an empty state in `command-center.tsx`; verify table existence via `Schema::hasTable` instead of assuming.
**Verification:** Seed a row in `s_competency_assessments` and confirm the tile changes; or confirm tiles show "not tracked".

## AI-C09
**Severity:** High   **Type:** Confirmed
**Category:** Frontend
**Module:** Capability Intelligence — Command Center quick create
**Location:** `D:\lms_k12\app\capability-intelligence\_lib\command-center-api.ts:246-253,266-274`; `D:\lms_k12\app\capability-intelligence\dashboard\components\command-center.tsx:100-107,154,182-188,244,255`; also `D:\lms_k12\app\talent-management\_lib\employee-profiles-api.ts:340`
**Function/Method:** `competencyCommandCenterService.create`, `QuickCreateForm`
**Problem:** (1) "Create Skill"/"Create New" default kind `competency` POSTs `/api/competency/competencies` and "Launch Assessment" POSTs `/api/competency/assessments` — neither route exists in `routes/competency_management.php` or any route file (the file's own header notes they were "NOT separately confirmed"). (2) The "Map Role Requirements" quick action crashes: `STATUS_OPTIONS['role-map'] = []` (`:154`) and the form does `STATUS_OPTIONS[initialKind][0].value` (`:244`) -> `TypeError: Cannot read properties of undefined`; `KIND_OPTIONS` also lacks `role-map`, and the fallback payload `{name}` is not what `POST competency/role-map` expects (`jobrole_id`, `items`).
**Evidence:** `assessment: '/competency/assessments'`, `competency: '/competency/competencies'`; `grep "competency/(competencies|assessments)" routes/*.php` -> no matches.
**Impact:** Two of six quick actions return 404; a third throws in render (dialog/page error boundary), on the module's landing page.
**Expected Behavior:** Quick create targets real routes (`/competency/definitions` for competencies) and every action opens a working form.
**Recommended Fix:** Point `competency` to `/competency/definitions`, remove or implement `assessment`, give `role-map` its own form or link to the Framework Studio Role Requirements panel, guard `STATUS_OPTIONS[kind]?.[0]?.value ?? ''`.
**Verification:** Click each Quick Action with the network tab open; no 404, no console TypeError.

## AI-C10
**Severity:** High   **Type:** Confirmed (live data NOT VERIFIED)
**Category:** Business Logic
**Module:** Capability Intelligence — role-mapping coverage KPIs
**Location:** `D:\next_lms_erp\app\Services\Competency\CommandCenterService.php:56-93,183-186`; `D:\next_lms_erp\app\Http\Controllers\api\TalentManagement\Competency\CompetencyStudioController.php:211-255`; vs `D:\next_lms_erp\app\Brain\Intelligence\CapabilityIntelligence.php:29-44,443-451`
**Function/Method:** `resolveRoleScope`, `CompetencyStudioController::summary`, `CapabilityIntelligence::fetchJobRoleRecords`
**Problem:** Three implementations of "roles with a skill map" disagree. Command Center joins `sj.jobrole = jr.jobrole`; Studio groups `s_user_skill_jobrole` by `jobrole` and matches on names; the Brain joins `sj.skill = jr.jobrole` and documents that at the institute it measured `sj.jobrole` holds a numeric code (99.99% of rows) so the first join yields **0** mapped roles vs 2,875/2,896 (99.3%) with `sj.skill`. The frontend's own comment says `s_user_skill_jobrole.jobrole` "stores the id" (`framework-mapping.tsx:375-377`). Command Center also counts role rows (non-distinct) while Studio counts distinct names.
**Evidence:** `->whereColumn('sj.jobrole', 'jr.jobrole')` (CommandCenterService:82) vs `AND sj.skill = jr.jobrole` (CapabilityIntelligence:449).
**Impact:** The dashboard "Job Roles Mapped" and "Role Mapping Completion" and the Studio "Mapping coverage" donut can show ~0% while the Brain Capability Intelligence tab shows ~99% for the same tenant.
**Expected Behavior:** One shared definition/service for role-mapping coverage.
**Recommended Fix:** Extract the join into a shared query (verify the correct column against live data), reuse it in all three places, and use distinct role identity consistently.
**Verification:** Compare the three figures for one tenant after the change; they must match.

## AI-C11
**Severity:** High   **Type:** Confirmed
**Category:** Business Logic
**Module:** Capability Intelligence — Competency Framework Studio (weighting, scale)
**Location:** `D:\next_lms_erp\app\Http\Controllers\api\TalentManagement\Competency\CompetencyStudioController.php:71-181,425-566,630-714`; `D:\next_lms_erp\app\Services\Competency\ProficiencyService.php:52-116`; `D:\next_lms_erp\app\Http\Controllers\api\TalentManagement\Competency\CompetencyGapController.php:127-175`; validators `CompetencyRoleMapController.php:108`, `KasbaRatingController.php:143`, `EmployeeCompetencyProfileController.php:340,428`; UI `D:\lms_k12\app\capability-intelligence\competency-framework\components\framework-mapping.tsx:306-314,878-911,915-955`
**Function/Method:** `saveWeights`, `saveWeightingConfig`, `storeLevel/deleteLevel`, `rollUp`
**Problem:** The "Category Weighting" and "Scoring Configuration" (scoring model weighted/simple, rounding, unmapped handling, target threshold, apply-to gap analysis / role readiness / dev-plan priorities) are persisted but no scoring code reads them: `rollUp()` uses only `competency_kasba_item.weight`, and `grep` finds `s_competency_framework_weights`/`competencySettings` referenced only by the Studio/Framework controllers. Weights are validated 0..100 per row but not required to sum to 100 (UI turns the total amber but Save stays enabled). The proficiency scale is editable to 20 levels and levels can be deleted without dependency checks, while all rating/requirement/skill-level validators are hard-capped at 1..5.
**Evidence:** UI copy "Relative weight of each competency category in scoring." (`:883`); `weights.*.weight => 'required|numeric|min:0|max:100'` (no sum rule); `'level' => 'nullable|integer|min:1|max:20'`; `'required_proficiency' => 'required|integer|min:1|max:5'`.
**Impact:** Administrators tune settings that change nothing; proficiency levels 6+ can be created but never used; deleting a level in use silently orphans mappings; a weighting profile summing to e.g. 40% or 250% is accepted.
**Expected Behavior:** Either wire the config into `ProficiencyService`/gap/readiness or label it "not yet applied"; enforce sum == 100 server-side; tie the validators to the configured scale max; block deleting a level in use.
**Recommended Fix:** Implement config consumption (weighted category roll-up, rounding, unmapped handling) or hide the tab; add `Rule` for sum, dynamic `max:` from the tenant scale, dependency check on delete.
**Verification:** Change scoring model to `simple` and confirm gap output changes; PUT weights summing to 90 -> 422.

## AI-C12
**Severity:** High   **Type:** Confirmed
**Category:** Authorization
**Module:** Capability / Competency management API
**Location:** `D:\next_lms_erp\routes\competency_management.php:47-299` (single `['api.session','staff.only']` group); `D:\next_lms_erp\app\Http\Middleware\RequireStaffRole.php:14-52`; `D:\next_lms_erp\app\Http\Controllers\api\TalentManagement\Competency\CompetencyApprovalController.php`, `MappingReviewController.php`
**Function/Method:** all write actions (`destroy*`, `store*`, `bulkApprove`, `saveWeights`, `deleteLevel`)
**Problem:** The only gate is "not student/parent". Any staff profile (Teacher, Driver, Clerk, Peon) can delete frameworks/skills/job roles/proficiency levels, change weights and **bulk-approve** approval and role-mapping review queues; there is no separation of duties (a submitter can approve their own submission). The route header itself states the finer `profile:admin,hr` gates were not replicated. Only the employee-profile subject check uses `role_key`.
**Evidence:** `Route::post('competency/approvals/bulk-approve', ...)`, `Route::post('competency/mapping-reviews/bulk-approve', ...)`; `BLOCKED_PROFILES = ['student','parent']`; class doc: "does NOT implement field-level RBAC".
**Impact:** Approval workflow and library integrity can be altered by any staff member; audit log records but does not prevent.
**Expected Behavior:** Write/approve actions limited to Admin/HR/Competency-manager profiles; approvals require a different user than the submitter.
**Recommended Fix:** Add a role middleware (e.g. `profile.roles:admin,hr,competency_manager`) on write/approve routes and an `approver_id != submitter` check.
**Verification:** Teacher token calling `POST competency/approvals/bulk-approve` -> 403.

## AI-C13
**Severity:** Medium   **Type:** Missing
**Category:** Frontend
**Module:** Career Awareness / Career Intelligence plan
**Location:** `D:\lms_k12\app\career-awareness\_components\CareerAwarenessSectionHub.tsx:1-79`; `D:\lms_k12\app\career-awareness\_components\panels\*.tsx`; `D:\lms_k12\app\career-intelligence\CareerIntelligenceHub.tsx:71-75,488-493`; backend `D:\next_lms_erp\routes\lms.php:402-421`
**Function/Method:** `CareerAwarenessSectionHub`, `PLAN[1]`, `PLAN[3]`
**Problem:** The four Career Awareness pages (certainty, ambition, alignment, originality) render only explanatory paragraphs; none calls `studentAspiration`, `studentAmbition`, `studentOriginality` or `careerAlignment`. `careerOptions` in `_lib/constants.ts` is unused. In Career Intelligence only "certainty" and "alignment" are functional; "ambition" and "originality" are static cards. Backend endpoints for ambition/originality (GET+POST) have no UI.
**Evidence:** `grep studentAmbition|studentOriginality app lib components` -> no consumer; panels contain literal text only.
**Impact:** Menu items promise self-assessment but students cannot capture ambition/originality; backend tables never populated from the UI.
**Expected Behavior:** Capture forms and persistence, or hide the menu entries.
**Recommended Fix:** Implement the two capture dialogs (mirroring `CareerCertaintyCard`) and reuse them from `career-awareness/*`, or remove the pages from the menu.
**Verification:** Submit ambition text; confirm a `student_ambitions` row.

## AI-C14
**Severity:** Medium   **Type:** Confirmed
**Category:** Security
**Module:** Career Explorer, Career Counselling
**Location:** `D:\lms_k12\app\career-explorer\expert-advice\page.tsx:210`; `D:\lms_k12\app\career-explorer\explore-sectors\page.tsx:86`; `D:\lms_k12\app\career-counselling\interest-profile\_components\CounsellingCourses.tsx:93`
**Function/Method:** `dangerouslySetInnerHTML` sinks
**Problem:** Backend HTML (`onet_expert_advice.benefits/university_shortlist`, `onet_explore_sector.html`, `counselling_course.description`) is rendered unsanitised. The component comment calls the course description "trusted staff-entered content". The session JWT is stored in `localStorage` (`lib/brain/api.ts:56`, `lib/erp-client.ts`), so any script in these fields runs with token access for students who open the page.
**Evidence:** `dangerouslySetInnerHTML={{ __html: course.description }}`; `isomorphic-dompurify` exists in `package.json:52` and is used elsewhere in the repo.
**Impact:** A malicious/compromised staff account or a DB write elsewhere becomes stored XSS -> token theft against students/other staff. No Laravel writer for `onet_*` found (data likely imported), so exploit needs a privileged author or another injection path.
**Expected Behavior:** Sanitise with DOMPurify (allow-list of formatting tags) before rendering.
**Recommended Fix:** Wrap with `DOMPurify.sanitize()` and add a small shared `SafeHtml` component; consider moving the token to an HttpOnly cookie.
**Verification:** Insert `<img src=x onerror=alert(1)>` into a course description; confirm it does not execute.

## AI-C15
**Severity:** Medium   **Type:** Confirmed
**Category:** Security
**Module:** Brain JWT bridge
**Location:** `D:\next_lms_erp\app\Http\Middleware\Brain\BrainAuthenticate.php:25,39-47,58-65`; `D:\next_lms_erp\app\Http\Controllers\api\ApiLoginController.php:426-434`
**Function/Method:** `BrainAuthenticate::handle/bearer/decodeJwt`
**Problem:** (a) The accepted signing secrets include `config('app.key')` in addition to `JWT_SECRET` — anyone with APP_KEY can mint Brain tokens for any tenant/role. (b) `exp` is optional (`if (isset($payload['exp']) ...)`) and login only sets it when `JWT_TTL_MINUTES > 0` (default 0 -> never expire). (c) The token is accepted from `?token=` query string, leaking it into logs/history/referer. (d) JWT header `alg` is not validated (HMAC-only so low risk).
**Evidence:** `[(string) env('JWT_SECRET', ''), (string) config('app.key')]`; `return $request->query('token') ? ... : null;`.
**Impact:** Wider key blast radius; non-expiring bearer tokens; token exposure via URLs.
**Expected Behavior:** Single dedicated secret, mandatory `exp`, header-only tokens.
**Recommended Fix:** Drop `app.key` from the list, require `exp`, remove query-token support, enforce a default TTL.
**Verification:** Token without `exp` or signed with APP_KEY -> 401.

## AI-C16
**Severity:** Medium   **Type:** Confirmed
**Category:** Security
**Module:** Capability Intelligence API clients
**Location:** `D:\lms_k12\app\capability-intelligence\_lib\command-center-api.ts:106-121`; same `contextParams` in `competency-extras-api.ts`, `competency-library-api.ts`, `framework-studio-api.ts`, `libraries-taxonomy-api.ts`; `D:\lms_k12\app\career-explorer\_lib\api.ts:36-44` (query params through `/api/proxy`)
**Function/Method:** `contextParams`, `request`
**Problem:** Every capability request adds `token`, `sub_institute_id`, `user_id`, `syear`, `financial_year`, `type=API` to the **URL query string**, in addition to the `Authorization` header. The token therefore appears in access logs, browser history, and Referer; `sub_institute_id`/`user_id` are ignored by the server (identity comes from the JWT) so they are dead, misleading parameters.
**Evidence:** `const params = { token: session.token, sub_institute_id: ..., user_id: ..., type: 'API' }` -> `const url = \`${session.baseUrl}/api${path}?${search}\``.
**Impact:** Bearer token disclosure via logs/proxies; false impression that tenant/user are client-controlled.
**Expected Behavior:** Token only in the header; query params limited to real filters.
**Recommended Fix:** Remove `token`/`user_id`/`sub_institute_id` from `contextParams`; keep `syear` only where read.
**Verification:** Inspect network log: no `token=` in URLs.

## AI-C17
**Severity:** Medium   **Type:** Missing
**Category:** Backend
**Module:** Enterprise Brain — registry screens, AI Assistant, Settings, Capabilities proficiency
**Location:** `D:\next_lms_erp\app\Brain\Screens\ScreenRegistry.php` (panels/metrics); `D:\next_lms_erp\app\Http\Controllers\Brain\BrainController.php:862-945,396-404`; `D:\lms_k12\app\enterprise-brain\knowledge\ai-assistant\page.tsx`; `settings\page.tsx`; `capabilities\[id]\page.tsx:293-307`
**Function/Method:** `screen`, `aiAssistant`, `settings`, `capabilityShow`
**Problem:** These `hpbrain_*` tables are read by screens but written by **no application code** (grep of `D:\next_lms_erp\app`, excluding the registry/controller readers): `hpbrain_conversation_sessions/_messages`, `hpbrain_ai_executions`, `hpbrain_prompt_templates`, `hpbrain_notifications`, `hpbrain_executors`, `hpbrain_process_definitions`, `hpbrain_metrics`, `hpbrain_event_store`, `hpbrain_learnings`, `hpbrain_risks`, `hpbrain_context_entities`, `hpbrain_eso_efficacy_records`, `hpbrain_capability_proficiency`, `hpbrain_api_keys` (display only, no issue/revoke endpoint), `hpbrain_settings` (written by Settings, read by nothing). The page titled "AI Assistant" makes no AI call; it is a search box plus these empty tables. `automation/conversational-ai` is not in `BRAIN_SECTIONS` (orphan).
**Evidence:** `nonregistry refs = 0` for each table; `AiAssistantPage` only calls `/ai-assistant` and `/search`.
**Impact:** Decision Intelligence risks/patterns, Memory sessions, Task Orchestrator process definitions, Agent executors, Capability proficiency, "Prompt templates" and "API keys" panels will always be empty unless an external system (the original hp-enterprise-brain app sharing the DB — NOT VERIFIED) populates them; users see "Nothing recorded yet".
**Expected Behavior:** Only ship screens with a data path, or label them "coming soon".
**Recommended Fix:** Remove/mark stubs, or implement writers; rename "AI Assistant"; either consume `hpbrain_settings` or drop the editor.
**Verification:** Row counts on those tables after a full ingestion + loop run (expected 0).

## AI-C18
**Severity:** Medium   **Type:** Confirmed
**Category:** Backend
**Module:** Generic module "Intelligence" tab
**Location:** `D:\lms_k12\lib\brain\api.ts:390-414`; `D:\lms_k12\app\_components\module-intelligence.tsx:67`; `D:\lms_k12\app\_components\module-category-page.tsx:522-534`; `D:\next_lms_erp\routes\brain.php` (absent)
**Function/Method:** `fetchModuleIntelligence`
**Problem:** The client calls `GET /api/brain/{tenant}/modules/{module}/intelligence` and documents `BrainIntelligenceController::moduleIntelligence`, but that method and route do not exist (only `modules/{module}/integration|workflows` are routed).
**Evidence:** `grep moduleIntelligence D:\next_lms_erp\app D:\next_lms_erp\routes` -> no matches.
**Impact:** Every module category that has a `platform_module_key` but no registered contract shows the error state "Brain request failed 404/…" in its Intelligence tab.
**Expected Behavior:** Route + controller exist, or the fallback is removed.
**Recommended Fix:** Add the route (delegating to the per-module `*Intelligence` classes) or drop `ModuleIntelligence` fallback.
**Verification:** Open a non-contract module's Intelligence tab; expect payload not 404.

## AI-C19
**Severity:** Medium   **Type:** Confirmed
**Category:** Frontend
**Module:** Capability Intelligence — Capability Explorer
**Location:** `D:\lms_k12\app\capability-intelligence\capability-explorer\components\taxonomy-ontology.tsx:38,58-61,127-138`
**Function/Method:** `TaxonomyOntology`
**Problem:** The screen is an iframe of `https://skill-ontology-neo4j.vercel.app/?sub_institute_id=<tenant>` — a third-party hosted **example dataset** (the component's own amber note says it is not built from the org's mapping). The tenant id is sent to that origin; availability is unverifiable (cross-origin iframe).
**Evidence:** `const ONTOLOGY_ORIGIN = 'https://skill-ontology-neo4j.vercel.app'`; note: "not built from your organisation's own role and competency mapping".
**Impact:** A menu item named Capability Explorer shows demo data; tenant id disclosed to an external service; supply-chain dependency.
**Expected Behavior:** Graph built from tenant data via the Laravel API, or a clear "demo" page.
**Recommended Fix:** Feed the explorer from `/api/competency/*` data or hide it; make the origin configurable.
**Verification:** Confirm requests in devtools go only to first-party hosts.

## AI-C20
**Severity:** Medium   **Type:** Confirmed
**Category:** Backend
**Module:** Capability Intelligence — Competency Library
**Location:** `D:\next_lms_erp\app\Http\Controllers\api\TalentManagement\Competency\CompetencyLibraryCrudController.php:154-171`; `D:\lms_k12\app\capability-intelligence\competency-library\components\competency-library.tsx:52-58`
**Function/Method:** `libraryQuery`
**Problem:** The Status and Category filter controls send params the query ignores (only `search`, `competency_type`, `framework_id` are applied) — acknowledged in the component header ("silently no-ops server-side today").
**Impact:** Users filter and see unfiltered results, or filtered-looking counts that are wrong.
**Expected Behavior:** Filters applied server-side.
**Recommended Fix:** Add `approve_status`/`category` clauses (join latest `s_competency_approvals` status).
**Verification:** Filter by Archived; only archived rows return.

## AI-C21
**Severity:** Medium   **Type:** Confirmed
**Category:** Backend
**Module:** Capability Library — skill detail modal and AI course builder
**Location:** `D:\lms_k12\app\capability-intelligence\_lib\competency-extras-api.ts:203-207,271-287`; `D:\lms_k12\app\capability-intelligence\capability-library\components\library-detail-modal.tsx:131`; `course-builder-panel.tsx:57-137`; backend `D:\next_lms_erp\routes\g2g_lms.php:200-205`, `routes\lms.php:118-121`
**Function/Method:** `skillDetailService.get`, `courseBuilderService.*`
**Problem:** Client calls `GET /api/skill_library/{id}/edit` (route exists only as web-session `/skill_library/{id}/edit`, no `api/` prefix) and `/api/lms/ai/{status,outline,presentation[/id]}` (real routes are `/api/g2g-lms/course-builder/ai/*`). Source comments label both "GAP".
**Impact:** Skill detail (`viewing a skill`) and the AI outline/slides generator return 404 in the capability library.
**Expected Behavior:** Endpoints aligned.
**Recommended Fix:** Point to `g2g-lms/course-builder/ai/*` and add an API skill detail route (or reuse `competency/library/skills/{id}`).
**Verification:** Open a skill row detail and the Course Builder panel with network log.

## AI-C22
**Severity:** Medium   **Type:** Potential
**Category:** Frontend
**Module:** Competency Framework — Role Requirements panel
**Location:** `D:\lms_k12\app\capability-intelligence\competency-framework\components\role-requirements-panel.tsx:57-98,114-142,194,284`; backend `D:\next_lms_erp\app\Http\Controllers\api\TalentManagement\Competency\CompetencyRoleMapController.php:174-183`
**Function/Method:** `load`, `save`
**Problem:** If loading a role's requirements fails, the panel sets `rows=[]` and shows an error, but Save stays enabled (`disabled={saving || loading}`). Adding one row and saving sends a **sync** payload; the server deletes every existing requirement for that role not in the payload (hard delete).
**Impact:** A transient load failure followed by a save wipes a role's requirements.
**Expected Behavior:** Disable Save when the last load failed; soft-delete or confirm removals.
**Recommended Fix:** Track `loadFailed` and disable Save/add; show a confirm with the count of rows to be removed; soft-delete.
**Verification:** Simulate a 500 on `GET role-map`, add a row, Save; assert blocked.

## AI-C23
**Severity:** Medium   **Type:** Confirmed
**Category:** Business Logic
**Module:** Career Intelligence — matching occupations
**Location:** `D:\next_lms_erp\app\CareerIntelligence\KnowledgeMatchService.php` (matchKnowledge/tokenize/jaccard); `AlternativeOccupationRecommender.php:36-95`; `D:\next_lms_erp\config\career_recommendation.php`; `D:\lms_k12\app\career-intelligence\_lib\api.ts:184-188`; `CareerIntelligenceHub.tsx:135-136`
**Function/Method:** `matchKnowledge`, `rankAllOccupations`, `classifyBand`
**Problem:** "Fit score %" is Σ importance of lexically matched O*NET knowledge elements ÷ Σ importance. Level (`LV`), student confidence and evidence count are ignored; one student item may satisfy many elements; matching relies on subject-name token overlap (`min_match_score` 0.15) so non-English/local subject names score ~0; the docblock concedes near-zero scores. Ranking loads all occupations' knowledge per request. The frontend re-implements band cut-offs 75/45 while the backend bands are env-tunable (0.75/0.5).
**Evidence:** `$matchedOccupationImportance += max($occItem['importance'], 0.0)`; `usedStudentKnowledgeKeys` reused; `if (percentage >= 75) return 'Strong Match'`.
**Impact:** Students/counsellors see percentages and "Strong/Weak Match" bands that reflect vocabulary overlap, not competence; band labels can disagree with backend after config change.
**Expected Behavior:** Use level-weighted, evidence-weighted matching with a curated subject->domain mapping; take band from the API.
**Recommended Fix:** Return `alignmentBand` for every related career from the backend and delete `classifyBand`; introduce level comparison; cache rankings.
**Verification:** Unit test with a student who has Mathematics evidence at 2/5 vs an occupation needing Mathematics level 5.

## AI-C24
**Severity:** Medium   **Type:** Confirmed
**Category:** Business Logic
**Module:** Career Intelligence — alignment
**Location:** `D:\next_lms_erp\app\CareerIntelligence\CaiCoreService.php` (`OCCUPATION_MAP`, `BOARD`, `evaluate`); `D:\lms_k12\app\career-intelligence\CareerIntelligenceHub.tsx:405-440`
**Function/Method:** `CaiCoreService::evaluate`, `CareerAlignmentCard`
**Problem:** Alignment is computed only for one occupation (`17-1011.00` Architect) and CBSE; all others return `INSUFFICIENT_DATA`. Backend also depends on Neo4j (dev credentials known broken per project memory; production NOT VERIFIED). The card shows "Tell us what you want to be first" for `INSUFFICIENT_DATA` and for any request failure, even after the student has saved an aspiration.
**Evidence:** `private const OCCUPATION_MAP = ['17-1011.00' => 'OCC-ARCHITECT'];` and `catch { setPayload(null); }` mapped to the "Tell us what you want to be first" branch.
**Impact:** ~all students are told to repeat a step they completed; failures look like missing input.
**Expected Behavior:** Distinguish "no aspiration", "no pathway data for this occupation", "service error".
**Recommended Fix:** Expose `insufficient_data_reason` in the UI and keep separate error state.
**Verification:** Save an aspiration for a non-architect occupation; card should explain that no pathway exists.

## AI-C25
**Severity:** Medium   **Type:** Potential
**Category:** Authorization
**Module:** Career Intelligence (staff view) / aspiration storage
**Location:** `D:\next_lms_erp\app\Http\Controllers\lms\counselling\lmsCounsellingController.php:1485-1561,1607-1637`; `D:\next_lms_erp\app\Http\Controllers\lms\counselling\CareerRecommendationController.php:31-49`; `D:\lms_k12\app\students\search_student\components\StudentDetailDrawer.tsx:737`
**Function/Method:** `studentAspiration`, `saveStudentAspiration`, `studentCareerEvidence`, `recommend`
**Problem:** (1) Viewing another student's evidence/recommendation is allowed only if session `is_admin` is 1 or 2 — a platform-level flag (project memory: school admins have it NULL), so school counsellors/principals opening the Career tab from a student profile get 403. (2) Identity for writes is `session user_id`, used as `student_id`; for a staff JWT that is `tbluser.id`, which can equal a real `tblstudent.id`, so a teacher visiting the page and saving toggles/overwrites another student's `is_current` aspiration.
**Evidence:** `if ($isAdmin !== 1 && $isAdmin !== 2) { return 403 }`; `StudentAspiration::where('student_id', $studentId)->update(['is_current' => false])`.
**Impact:** Staff feature unusable for its audience (NOT VERIFIED live); potential cross-user data corruption from id-namespace collision.
**Expected Behavior:** Role-based access (counsellor/class-teacher of that student) and student-only writes (`is_student` claim).
**Recommended Fix:** Reject aspiration writes unless `is_student`; use profile/role + class-teacher mapping for cross-student reads.
**Verification:** Teacher token POST `studentAspiration` -> 403; counsellor token GET `studentCareerEvidence?student_id=` -> 200.

## AI-C26
**Severity:** Medium   **Type:** Confirmed
**Category:** Backend
**Module:** Brain cross-module workflows
**Location:** `D:\next_lms_erp\app\Brain\Intelligence\ModuleWorkflowService.php:140-185`; `D:\next_lms_erp\app\Http\Controllers\Brain\BrainIntelligenceIntegrationController.php:78-115`
**Function/Method:** `triggerWorkflow`
**Problem:** If the `workflow_runs` insert throws, the `catch (\Throwable)` returns `success => true` with a fabricated run reference and message "initiated successfully". `definition_id`/`version_id` are hard-coded `1`. The controller records `auth.role` (e.g. "analyst") as the actor name and returns `$e->getMessage()` to clients on other errors.
**Evidence:** `// If table does not support all columns or fails, log and fallback safely  return ['success' => true, 'run_reference' => $runRef, ...]`.
**Impact:** Users are told a workflow started when nothing was recorded; audit trail names a role not a person; internal exception text leaks.
**Expected Behavior:** Fail loudly (500/409) and record the acting user id/name.
**Recommended Fix:** Remove the swallowing catch, pass the real user name, return generic errors.
**Verification:** Force insert failure; response must be an error.

## AI-C27
**Severity:** Medium   **Type:** Confirmed
**Category:** Business Logic
**Module:** Command Center — certification compliance
**Location:** `D:\next_lms_erp\app\Services\Competency\CommandCenterService.php:195-202`; `D:\next_lms_erp\app\Brain\Intelligence\CapabilityIntelligence.php:361-377,474-491`
**Function/Method:** `progress`, `certificationWindowCounts`
**Problem:** Compliance % = certifications with stored `status='valid'` ÷ non-revoked; expiry dates are not evaluated, while the Brain's own data-quality check counts certifications "past their expiry date but still marked valid".
**Impact:** Compliance is overstated by however many lapsed certs are still flagged valid.
**Expected Behavior:** Derive validity from `expiry_date` (or run a status job).
**Recommended Fix:** Count `status='valid' AND (expiry_date IS NULL OR expiry_date >= today)`; add nightly status sync.
**Verification:** Seed an expired cert marked valid; percent must drop.

## AI-C28
**Severity:** Medium   **Type:** Confirmed
**Category:** Authorization
**Module:** Frontend gating (Brain, capability, career)
**Location:** `D:\lms_k12\lib\session\internal-access.ts:53-80`; `D:\lms_k12\app\components\DashboardShell.tsx:62-85`; `D:\lms_k12\app\components\ConditionalApp.tsx:36-38`; absence of `app/enterprise-brain/layout.tsx`, `app/capability-intelligence` guard
**Function/Method:** `isInternalViewer`, `isBrainVisibleByLmsSession`
**Problem:** Gating is client-side and localStorage-driven; `profileId === 1` and substring matches (`includes('admin')`, `includes('management')`) decide "internal/admin" although profile ids are per-tenant; no route-level guard exists, so any authenticated user can open any `/enterprise-brain/**`, `/capability-intelligence/**`, `/career-*` URL. Write buttons are not hidden by role (except Settings).
**Impact:** UI advertises/opens screens to users the backend later denies (or, per AI-C01/12, does not deny); the "internal" disclosure rule is trivially bypassed by editing localStorage.
**Expected Behavior:** Server-authoritative role info (`/access`) drives navigation and buttons.
**Recommended Fix:** Add layouts that check `/access`/permissions, remove `profileId===1`, disable action buttons by `permissions`.
**Verification:** Student opening `/enterprise-brain` is redirected.

## AI-C29
**Severity:** Medium   **Type:** Architectural
**Category:** Other
**Module:** Capability / Competency / Career (cross-cutting)
**Location:** `D:\lms_k12\app\capability-intelligence\**`, `app\enterprise-brain\capabilities\**`, `app\career-*`, `D:\lms_k12\app\data\routeMapper.ts:539-551,956-1046`
**Function/Method:** module boundaries
**Problem:** "Capability/competency" exists in four incompatible stores and UIs (`hpbrain_capabilities`, `s_users_skills`, `competency`, `s_competency_*`); the Command Center's "Total Competencies" counts approved *skills* (`s_users_skills`), not the Competency Library rows (`competency`). Career is split across `career-explorer`, `career-counselling`, `career-awareness`, `career-intelligence` with many legacy aliases pointing at `/career-intelligence`; the broad alias `'education' => '/career-explorer'` can capture any menu link named "education".
**Impact:** Inconsistent numbers, duplicated maintenance, confusing navigation.
**Recommended Fix:** Define canonical entities and consolidate; narrow `routeMapper` aliases.
**Verification:** Count parity across dashboards.

## AI-C30
**Severity:** Low   **Type:** Confirmed
**Category:** Frontend
**Module:** Silent failure handling
**Location:** `D:\lms_k12\app\enterprise-brain\foundation\departments\page.tsx:32`; `foundation\students\page.tsx:64-68`; `D:\lms_k12\app\career-explorer\CareerExplorerHub.tsx:113-136`; `D:\lms_k12\app\capability-intelligence\_lib\use-command-center.ts:88-96`; `D:\lms_k12\app\people-competency\lms\assignments\_lib\use-assignments.ts:139-158`
**Problem:** Departments page returns `null` (blank) whenever department intelligence is loading or fails (`if (!deptIntelligence.data) return null;`) even though the roster loaded; student profile fetch failure is swallowed; explorer filter/search failures show "No results"; command-center filter option failures silently empty; bulk update failure only `console.error`.
**Impact:** Blank pages / misleading "no results" instead of an error and retry.
**Recommended Fix:** Render section-level error states (as people page does) and toast failures.
**Verification:** Force 500 on `/intelligence/departments`; page should still show departments + error banner.

## AI-C31
**Severity:** Low   **Type:** Confirmed
**Category:** Business Logic
**Module:** Brain health/attendance thresholds
**Location:** `D:\lms_k12\app\enterprise-brain\page.tsx:848,886,894`; `D:\next_lms_erp\app\Brain\Intelligence\HealthScores.php` (attendance/engagement blocks); `D:\next_lms_erp\config\brain.php` thresholds
**Problem:** The "-4 points" class threshold is hard-coded in the frontend and backend and ignores the tunable config keys; overall health score is shown without the count of scored dimensions in the hero (`page.tsx:154-160`); "lowest" class is assumed sorted.
**Impact:** Config changes do not affect the dial/labels; single-dimension "Overall 80/100" can mislead.
**Recommended Fix:** Return `isLagging` and thresholds from the API; show "n of 8 scored".
**Verification:** Change `class_attendance_gap_points` and observe dial.

## AI-C32
**Severity:** Low   **Type:** Confirmed
**Category:** Backend
**Module:** Career Explorer — occupation details, expert advice
**Location:** `D:\next_lms_erp\app\Http\Controllers\lms\counselling\lmsCounsellingController.php:586-641`; `D:\lms_k12\app\career-explorer\_components\OccupationDetailView.tsx:~95`; `expert-advice\page.tsx:159-185`
**Problem:** `OccupationDetails` ships placeholder copy ("Worker Requirements...", "Experience Requirements...", "Work Force Characterstics...") and two sections with empty `children`; returns `json_encode()` string (no JSON content-type). UI has a decorative read-only radio input per item and a "Book a free counselling" button that only opens a benefits dialog.
**Impact:** Users see "..." descriptions and empty sections; dead controls suggest missing features.
**Recommended Fix:** Remove empty sections/placeholder text, return `response()->json`, remove or implement booking.
**Verification:** Open an occupation detail dialog.

## AI-C33
**Severity:** Low   **Type:** Confirmed
**Category:** Business Logic
**Module:** Brain outcomes / LMS activity stats
**Location:** `D:\next_lms_erp\app\Http\Controllers\Brain\BrainIntelligenceController.php:456,487`; `D:\next_lms_erp\app\Brain\Intelligence\LmsActivityIntelligence.php:446-478`
**Problem:** `measuredChange` is `before - after` (positive = reduction) labelled "Change"; outcome confidence hard-coded 0.9/0.6/0.3 from the user-chosen result although UI says confidence is computed from evidence; median for even counts returns the upper-middle element and loads all lag rows into memory.
**Recommended Fix:** Name the field `reduction`, derive/label confidence honestly, average the two middle values, compute median in SQL.
**Verification:** Unit tests with counts 4 and 5.

## AI-C34
**Severity:** Low   **Type:** Confirmed
**Category:** Frontend
**Module:** Career Counselling — RIASEC
**Location:** `D:\lms_k12\app\career-counselling\knowing-yourself\_components\KnowingYourselfHub.tsx:60-79,114-116,127-132`; `QuizPanel.tsx`; `CounsellingCourses.tsx:49-55,107`
**Problem:** Results are never persisted (only `?answers=` in the URL — answers appear in browser history/proxy logs); strongest-interest tie resolves to the first API area; `maxScore` prop unused; MBTI detected by `course.title === 'MBTI'` and its "Result" shows `obtain_marks`.
**Recommended Fix:** Persist results per student, show ties, remove dead prop, key MBTI on an id/flag.
**Verification:** Retake test; counsellor can view prior result.

## AI-C35
**Severity:** Low   **Type:** Potential
**Category:** Frontend
**Module:** People-competency course builder / assignments gate
**Location:** `D:\lms_k12\app\people-competency\lms\course-builder\page.tsx:10-16`; `D:\lms_k12\components\domain\lms\assignments\learning-assignments.tsx:82-85`
**Problem:** `useSearchParams()` used without a `<Suspense>` boundary (all sibling pages wrap it) — may fail `next build` prerender; `Number(courseId)` can be `NaN`; `isAdminOrHrProfile` matches any name containing "hr".
**Recommended Fix:** Wrap in Suspense, validate id, match exact profile names/role keys.
**Verification:** `next build` (not run by me).

## AI-C36
**Severity:** Low   **Type:** Potential
**Category:** Performance
**Module:** Brain / capability
**Location:** `D:\next_lms_erp\app\Http\Controllers\Brain\BrainController.php:587-605`; `D:\lms_k12\app\enterprise-brain\foundation\departments\page.tsx:140-231`; `D:\lms_k12\app\capability-intelligence\competency-framework\components\framework-mapping.tsx:345-353`; `AlternativeOccupationRecommender.php:52-70`
**Problem:** `ingestion/run` accepts client `limit` (5000 sent by UI) with no ceiling; departments page renders every department as a card (hundreds); CSV import posts one request per cell sequentially; recommender loads all O*NET knowledge rows per request.
**Recommended Fix:** Cap limits, paginate, batch import, cache O*NET catalogue.
**Verification:** Load test with 600 departments.

## AI-C37
**Severity:** Low   **Type:** Missing
**Category:** Testing
**Module:** Whole slice
**Location:** `D:\lms_k12\lib\brain\*.test.ts`; `D:\lms_k12\lib\session\internal-access.ts:15-30` (references non-existent `internal-access.test.ts`)
**Problem:** No tests for capability/career/competency scoring, assignment selection, RIASEC encode/decode, Brain error mapping, agent/conversational authz; the referenced `internal-access.test.ts` is missing.
**Recommended Fix:** Add unit tests for `encodeAnswers`, `rankBestFitCareers`/`classifyBand`, weights sum, `bulk-review` ids, `isInternalViewer`.
**Verification:** `npm test`.

## AI-C38
**Severity:** Info   **Type:** Improvement
**Category:** Other
**Module:** Docs/config
**Location:** `D:\lms_k12\docs\enterprise-brain\INTEGRATION_AUDIT.md`; `.env.example`
**Problem:** Design doc has developer-machine absolute paths and stale statements; `NEXT_PUBLIC_BRAIN_API_BASE_URL` (`lib/brain/api.ts:18`) is undocumented in `.env.example`.
**Recommended Fix:** Refresh doc, document env var.
**Verification:** Review.

---



<!-- sub-part D issues -->
## AI-D01
**Severity:** Critical   **Type:** Confirmed
**Category:** Authorization
**Module:** AI console — providers, models, policies, prompt templates, module model overrides
**Location:** D:\next_lms_erp\routes\ai.php:81-92, 107-125, 162-181, 198-204; D:\next_lms_erp\app\Http\Controllers\AI\AiConfigurationController.php:95-236 (store/update/destroy/storeModel/updateModel), AiPolicyController.php (store/update/destroy), AiTemplateController.php (store/update/destroy), AiModuleModelController.php (update/destroy/storeCredential/updateCredential); frontend: D:\lms_k12\app\ai\_components\ConfigurationManager.tsx, ModelManager.tsx, TemplateForm.tsx, TemplateList.tsx, ModuleModelOverrides.tsx, D:\lms_k12\app\ai\policies\page.tsx, D:\lms_k12\lib\intelligence\ai-configuration.ts:165-245, ai-policies.ts, ai-templates.ts, ai-module.ts
**Function/Method:** `AiConfigurationController::store/update/destroy`, `AiPolicyController::store/update/destroy`, `AiTemplateController::store/update/destroy`, `AiModuleModelController::*`
**Problem:** Every write endpoint that changes the tenant's AI provider credentials, model catalogue, guardrail policies and the prompts the model is told is protected only by `McpAuth` (any valid JWT). There is no role, profile or permission check on the server, and no gating in the UI (the Header shows the AI & Intelligence menu to every signed-in user; app/ai/** contains no `usePermission`/profile check). `McpAuth` accepts student tokens (`is_student` claim, McpAuth.php:38-48; issued by ApiLoginController.php:423).
**Evidence:** routes/ai.php:81-92 register `POST /configuration`, `PUT|DELETE /configuration/{id}`, `POST|PUT /configuration-models` inside the `McpAuth, McpRateLimit, McpContextHydrator` group only. `grep -n "role|isStudent|isAdmin|userProfile"` over AiConfigurationController, AiPolicyController, AiTemplateController, AiModuleModelController returns no matches. Contrast: `OutcomeController.php:75 if (! $scope->isAdmin)` shows the pattern exists but is applied once.
**Impact:** Any student, parent or staff member of a school can (a) replace the school's LLM API key with their own so that every prompt (with student PII) is billed to and logged in an account they control, or retire the key to take AI down; (b) rewrite or delete published prompt templates so all generations are attacker-steered; (c) create an `ai_free` policy to disable AI for the school or `ai_empowered` to open it; (d) add models. Combined with AI-D21 (keys stored in plaintext) this is a credential-hijack and prompt-tampering path.
**Expected Behavior:** Configuration writes limited to a named admin capability (RBAC permission such as `ai.configuration` `update`, checked server-side), with student/parent tokens refused, and changes audited with the real actor.
**Recommended Fix:** Add a route middleware (e.g. `perm:ai_intelligence.<slug>,update` resolved via `PermissionService`, enforced regardless of the warn-only flag) or an `authorizeAdmin($scope)` guard in `AiController` for all configuration/policy/template/module-model writes; hide the menu and pages client-side by the same permission (cosmetic layer only); add tests for student and non-admin staff tokens.
**Verification:** Call `POST /api/ai/configuration` with a student JWT for a valid tenant — expect 403; with an authorised admin — 201. Add a feature test per controller verb.

## AI-D02
**Severity:** Critical   **Type:** Confirmed
**Category:** Security
**Module:** Integration management (Next route handlers) — push notification, biometric attendance, card status grid
**Location:** D:\lms_k12\app\api\integration-configs\route.ts:19-20,22-38,40-69; D:\lms_k12\app\api\integration-configs\[id]\route.ts:20-30,32-108; D:\lms_k12\app\api\integration-configs\test\route.ts:1-24; D:\lms_k12\app\task-management\_lib\integration-management-api.ts:1-12,25-40; D:\lms_k12\app\task-management\_lib\use-integration-management.ts:31-33; D:\lms_k12\app\integration\push-notification\page.tsx, biometric-attendance\page.tsx, page.tsx
**Function/Method:** `GET/POST` in route.ts; `GET/PUT/DELETE` in [id]/route.ts; `POST` in test/route.ts; `canAdminister`
**Problem:** The integration credential store is a process-memory JS array with no authentication beyond "an Authorization header exists", no tenant isolation, plaintext secret return, two disjoint arrays (so update/delete never work) and a "test connection" that always reports success.
**Evidence:** route.ts: `const records: IntegrationConfig[] = [];` (module scope, shared by all callers); `authHeader(request)` returns `request.headers.get('authorization')` and the handlers only check `if (!authorization) 401` — the value is never validated. GET returns `data: { configs: records }` including each `config` object (fields defined in integration-providers.ts: `api_key`, `access_token`, `password`, `service_account_key` (FCM JSON), `key_secret`, `webhook_secret`). [id]/route.ts uses a different store, `globalThis.integrationRecords`, so records POSTed to route.ts are never found by `/[id]` (always 404) and never seen by PUT/DELETE. test/route.ts returns `message: "Connection to <provider> tested successfully.", success: true` for any body. The file header says the store is in-memory "until the backend is extended". `canAdminister` is `session.isAdmin === '1'|'true'|'1.0'` read from client localStorage.
**Impact:** With `next start` (single long-lived process) any caller who sends `Authorization: x` can list every tenant's saved integration secrets and create/overwrite entries; secrets are lost on restart or per-serverless-instance; admins are told a connection "tested successfully" that was never tested; the card grid shows "Not configured" for SMS/WhatsApp/SMTP/Razorpay even when configured through the real screens (`configs.find` against the empty store), and lets push-notification/biometric cards appear saved when they are not persisted anywhere.
**Expected Behavior:** Integration credentials persisted server-side per tenant behind real authentication and authorization, encrypted at rest, never returned in plaintext; a test action that really contacts the provider or is not shown.
**Recommended Fix:** Remove the in-memory handlers; implement `/api/task-management/integration-configs` (or reuse the existing per-integration Laravel endpoints) with JWT verification, tenant scoping, role permission, encryption and masked responses; until then hide the push-notification/biometric cards and the test button, and drive card status from the real per-provider configuration endpoints.
**Verification:** `curl -H "Authorization: x" http://<next>/api/integration-configs` must return 401; POST then GET `/api/integration-configs/{id}` must round-trip; secrets never appear in responses.

## AI-D03
**Severity:** Critical   **Type:** Confirmed
**Category:** Authorization
**Module:** Migration modules (learning outcomes, indicator mapping, biomatrix, subject electives, bazar upload/reports, dynamic reports, students marks, broken links)
**Location:** D:\next_lms_erp\app\Http\Controllers\api\MigrationModulesApiController.php:17-27 (guard/tenant), 29-46 (index), 48-58 (store), 60-66 (destroy), 68-70 (bazarReport/studentMarks/brokenLinks); routes D:\next_lms_erp\routes\api.php:173-175; frontend D:\lms_k12\app\migration-modules\MigrationModulePage.tsx:22-27, D:\lms_k12\app\bazar\bulk-upload\BazarUploadPage.tsx:38
**Function/Method:** `guard()`, `tenant()`, `index`, `store`, `destroy`
**Problem:** Tenant, user and academic year come from client-supplied request fields; `guard()` only checks that some JWT validates and that `sub_institute_id`, `user_id`, `syear` are present — it never compares them with the token's claims. There is no role check. Several backing tables have no tenant column at all.
**Evidence:** `private function tenant(Request $r): int { return $r->integer('sub_institute_id'); }` (line 27). `guard()` (17-24): `$this->jwtToken()->validate()` then `Validator::make($request->all(), ['sub_institute_id'=>'required|integer','user_id'=>'required|integer','syear'=>'required'])`. Reads with no tenant filter: `learning-outcomes` → `DB::table('learning_outcome_indicator')` (line 33); `indicator-mappings` filters only `SYEAR`; `bazar-reports` → `sharebazar_position|margin|pnl` unfiltered (line 68); `broken-links` dumps every `tblmenumaster` link (line 70). `destroy` (64): `$q=DB::table($table)->where($table==='learning_outcomes'||$table==='indicator-mappings'?'ID':'id',$id); if(in_array($module,['biomatrix','subject-electives','dynamic-reports','nomenclature'])) $q->where('sub_institute_id',$tenant)` — the comparison uses `learning_outcomes` (a table name that does not exist; actual table `learning_outcome_indicator`) and the module name `indicator-mappings` against `$table`, so LO/indicator deletes are never tenant-scoped. `store` writes `CREATED_BY` from request `user_id`. The frontend sends `type=API&sub_institute_id=…&syear=…&user_id=…` from localStorage (MigrationModulePage.tsx:24).
**Impact:** Any authenticated user (student, parent, any tenant) can read another tenant's biometric device ids, subject-elective mappings, student marks (`sub_institute_id` swapped in the query), dynamic report definitions, and all share-bazar financial upload rows (which carry no tenant), and can delete learning-outcome / indicator rows of any school by id, create rows attributed to any `user_id`, and upload Excel imports into the shared `sharebazar_*` tables.
**Expected Behavior:** Tenant, user and year derived from the JWT (as `api/platform` and `/api/ai` do); role permission per module; every table filtered by tenant; deletes scoped.
**Recommended Fix:** Replace `tenant()`/`user_id`/`syear` reads with claims from the decoded token (`LmsApiAuth` attributes), add `perm:` middleware per module, add `sub_institute_id` scoping (and columns/migrations where missing), fix the `destroy` key/tenant logic, cap `paginate` and remove the `broken-links` dump for non-admins.
**Verification:** With tenant A's token send `?sub_institute_id=<B>` — expect 403/empty; attempt DELETE on a learning-outcome id owned by another tenant — expect 404.

## AI-D04
**Severity:** High   **Type:** Confirmed
**Category:** Authorization
**Module:** AI action approval (Actions tab, AI journey, RecommendationCard, `/ask` approve intent)
**Location:** D:\next_lms_erp\app\Domain\AI\Decisions\DecisionGate.php:114-160 (record), 225-243 (assertApprovable); D:\next_lms_erp\app\Http\Controllers\AI\RecommendationController.php:60-95, 98-121, 123-150; D:\next_lms_erp\app\Http\Controllers\AI\CaseController.php:164-181; D:\next_lms_erp\app\Domain\AI\Lifecycle\Stages\HumanApprovalStage.php:159-170; frontend D:\lms_k12\app\components\ai-workspace\ActionsTab.tsx:94-136; D:\lms_k12\lib\intelligence\client.ts:324-361; D:\lms_k12\app\ai-journey\page.tsx:76-95
**Function/Method:** `DecisionGate::record`, `RecommendationController::approve/reject/defer`, `CaseController::updateStatus`, `ActionsTab.decide`
**Problem:** The approval gate has no authorization beyond "authenticated user in the same institute". Recommendation id, decision, reason, modifications and `decided_by_name` are all taken from the request; the recommendation is not bound to the record the user is looking at nor to the user's role or assignment; `role` in the audit row is only `student|staff|admin`.
**Evidence:** `record()` checks `if ($context->userId <= 0)` then loads `ai_recommendations` `where id … where sub_institute_id = selectedInstituteId` and proceeds; no role, no assignee, no entity comparison. `decided_by_name` → `'decided_by_name' => $deciderName ? mb_substr($deciderName,0,150)` and `AiAuditLogger` `actor_label => $deciderName` (client text into the audit). `/ask` path: `HumanApprovalStage` calls `$this->decisions->approve($recommendationId, $context->scope, 'Approved from the AI console.')` for an `approve` intent. `POST /cases/{id}/status` accepts `closed|dismissed|in_progress|open|…` from any user (CaseController.php:169-171). The UI hides agent/workflow capabilities for students (`AiContextService.php:257`) but not the endpoints.
**Impact:** A student, driver or any staff member can approve or reject any pending AI recommendation in the school (e.g. academic interventions about other students), close/dismiss risk cases, and stamp an arbitrary "decided by" name into the audit. The human-in-the-loop guarantee described in the UI ("recorded against the signed-in user") holds only for the honest client.
**Expected Behavior:** Approve/reject limited to users entitled to the recommendation's subject/module (e.g. class teacher, coordinator, admin) by server-side check; `decided_by_name` derived from the token, not the client; case status changes restricted.
**Recommended Fix:** Add a `DecisionAuthority` check in `DecisionGate::record` (role/profile + subject scope, e.g. via `timetable` for teachers per the ERP model); drop `decided_by_name` from request handling; require the recommendation's `subject`/`module` to match a server-resolved context when called from the workspace; restrict `/cases/{id}/status`.
**Verification:** Approve a recommendation with a student JWT and with a teacher of another class — expect 403; same-class teacher — 200; audit shows JWT-derived name.

## AI-D05
**Severity:** High   **Type:** Confirmed
**Category:** Business Logic
**Module:** Decision recording / workflow start / Brain decide (replay, idempotency, double-submit)
**Location:** D:\next_lms_erp\app\Domain\AI\Decisions\DecisionGate.php:114-215,225-249; D:\next_lms_erp\app\Http\Controllers\AI\RecommendationController.php:90-92,157-190; D:\next_lms_erp\app\Http\Controllers\Brain\BrainIntelligenceController.php:232-330,389-460; frontend D:\lms_k12\app\components\ai-workspace\ActionsTab.tsx:94-136; D:\lms_k12\components\intelligence\module\sections.tsx:495-560
**Function/Method:** `DecisionGate::record/assertApprovable/statusFor`, `RecommendationController::approve`, `BrainIntelligenceController::decide/executionComplete`
**Problem:** There is no state machine. Approve is allowed on an already-approved recommendation; reject and defer have no precondition; updates are not conditional on the prior status; every approve starts another workflow; Brain decide/complete insert a new row every call.
**Evidence:** `assertApprovable` blocks only `['rejected','superseded','expired']` (DecisionGate.php:233) — `approved`/`executed` pass. `DB::table('ai_recommendations')->where('id',$recommendationId)->update([... 'status' => statusFor($decision)])` has no `where('status', …)`; `statusFor('deferred')` returns `'pending_approval'` (line 249) so a defer after approve resets an approved recommendation (and `ai_cases.status` → `awaiting_decision`). `RecommendationController::approve` calls `startWorkflow` on every request when `workflow_key` is set (lines 90-92). `seedOutcome` inserts an `ai_outcomes` row per approve. Brain `decide` (lines 245-320) never inspects `$recommendation->status` and inserts `hpbrain_decisions` + `hpbrain_eso_executions` each time; `executionComplete` (409-460) does not check the execution's status and inserts another outcome. The only replay guard found is inside one action: `CreateAcademicInterventionAction` returns the existing intervention when `academic_interventions.recommendation_id` already exists (lines 55-68). UI protection is limited to disabling buttons in flight (ActionsTab.tsx:233,246; sections.tsx `pending`).
**Impact:** Double click across tabs, two approvers, a retried request, or a scripted replay creates duplicate workflow runs, duplicate outcome-measurement rows and duplicate Brain executions/outcomes (polluting the "what did decisions achieve" learning ledger); a reject after approve flips the recommendation to `rejected` after a workflow was already started; defer after approve reopens it. Only the intervention action is protected; other workflow actions were not verified.
**Expected Behavior:** Decisions are idempotent and monotonic: one terminal decision per recommendation, enforced by `UPDATE … WHERE status='pending_approval'` (or row lock) with the affected-rows count checked, workflow start keyed to the decision id, and Brain decide/complete refused when not in the expected prior state.
**Recommended Fix:** Wrap in a transaction with `lockForUpdate()` on the recommendation, require `status === 'pending_approval'` for approve/reject/defer, return the existing decision on repeat (idempotency key), start the workflow only once per decision, add a unique index on `(recommendation_id)` for terminal decisions, apply the same checks to `hpbrain_*` decide/complete.
**Verification:** Fire two concurrent approve requests for one recommendation — exactly one decision row and one workflow run; a reject after approve returns 409.

## AI-D06
**Severity:** High   **Type:** Confirmed
**Category:** Authorization
**Module:** Workflow step approvals (Actions tab "Waiting on you")
**Location:** D:\next_lms_erp\app\Domain\Workflow\WorkflowEngine.php:219-262 (resolveApproval); D:\next_lms_erp\app\Domain\Workflow\Steps\ApprovalStepHandler.php:78-90; D:\next_lms_erp\app\Http\Controllers\AI\WorkflowController.php:143-166,205-233; frontend D:\lms_k12\app\components\ai-workspace\ActionsTab.tsx:298-337; D:\lms_k12\lib\intelligence\client.ts:435-445
**Function/Method:** `WorkflowEngine::resolveApproval`, `WorkflowController::resolveApproval`, `ActionsTab.WorkflowProgress.decideStep`
**Problem:** `approver_role` and `assigned_to` are stored on each approval and used to filter the *pending list*, but `resolveApproval` never enforces them.
**Evidence:** WorkflowEngine.php:236-246: `$approval = DB::table('workflow_approvals')->where('id',$approvalId)->where('sub_institute_id',$scope->selectedInstituteId)->first();` then only `if ($approval->status !== 'pending') throw` and expiry check; next statement updates status/`decided_by`. No comparison with `$approval->assigned_to`, `$approval->approver_role` or `$scope->role`. The pending-list query (WorkflowController.php:158-165) includes `assigned_to = me OR NULL OR approver_role = role`, so the filter is advisory only. The read-then-update is not atomic (no `where status='pending'` on the update, lines 256-262).
**Impact:** Anyone in the institute (including a student token) who learns or guesses a numeric approval id can approve or reject a step that was assigned to a principal or finance head, unblocking or killing the workflow ("The remaining steps cannot run until this is answered" is not true). Initiators can self-approve. Concurrent resolves can both succeed.
**Expected Behavior:** Only the assignee, a member of `approver_role`, or an admin may resolve; the update is conditional on `pending`.
**Recommended Fix:** In `resolveApproval` reject unless `$approval->assigned_to === $scope->userId` or (`assigned_to` null and role matches) or admin; add `->where('status','pending')` to the update and check affected rows; map `approver_role` to real profile names rather than `admin|staff` (see AI-D04).
**Verification:** Resolve an approval assigned to user A with user B's token — expect 403.

## AI-D07
**Severity:** High   **Type:** Confirmed
**Category:** Authorization
**Module:** AI read APIs (cases, signals, recommendations, subjects, outcomes, audit logs, saved reports, tickets)
**Location:** D:\next_lms_erp\app\Http\Controllers\AI\CaseController.php:37-110,187-231; RecommendationController.php:33-47; OutcomeController.php (index/auditLogs); ReportController.php:53-80; D:\next_lms_erp\app\Domain\K12\AcademicRisk\StudentScope.php:17-50; AiAssistanceTicketController.php (index); frontend consumers D:\lms_k12\lib\intelligence\client.ts:246-311,405-445,608-638, D:\lms_k12\components\intelligence\AiInsightsPanel.tsx
**Function/Method:** `CaseController::signals/index/show/forSubject`, `RecommendationController::pending/show`, `OutcomeController::auditLogs`, `ReportController::show`
**Problem:** Read endpoints filter by institute only. There is no student self-scope, no teacher-class scope, and no role check; `role` is not consulted.
**Evidence:** `StudentScope::students` = `tblstudent where sub_institute_id = selectedInstituteId` (+ inactive filter). `GET /cases`, `/signals`, `/subjects/{entity}/{id}`, `/recommendations/pending`, `/audit-logs`, `/reports/{id}` contain no `isStudent/role/userId` conditions (grep of `role|isStudent|userProfile` over CaseController/OntologyController/OutcomeController = 0 hits except the one `isAdmin` in `measureDue`). `pendingApproval()` returns every pending, governance-passed recommendation for the institute (RecommendationDrafter.php:121-140).
**Impact:** A student or parent JWT can enumerate all students' academic-risk cases, explanations, evidence, recommended interventions and outcomes for the school, read audit logs, and open any saved report (e.g. fee-arrears tables with named students) by incrementing the id. These are sensitive child records.
**Expected Behavior:** Students/parents excluded from staff-facing intelligence APIs entirely; teachers limited to their classes (timetable linkage per the ERP model); reports readable only by their creator or admins.
**Recommended Fix:** Add a staff-only middleware to the intelligence routes, resolve teacher scope via `timetable` (`teacher_id`,`standard_id`,`syear`), record `created_by` on reports and enforce it.
**Verification:** Call `GET /api/ai/cases` with a student token — expect 403; teacher token returns only own-class cases.

## AI-D08
**Severity:** High   **Type:** Confirmed
**Category:** Security
**Module:** Saved AI reports (`/ai-reports/[id]`): edit, refresh, send
**Location:** D:\lms_k12\app\ai-reports\[id]\page.tsx:177-205 (save), 243-280 (recipients/send); D:\next_lms_erp\app\Http\Controllers\AI\ReportController.php:87-118,150-160,163-185; D:\next_lms_erp\app\Services\Mcp\ReportSender.php:118-215,217-260; D:\next_lms_erp\app\Services\Mcp\AiReportGenerator.php:66,224-368
**Function/Method:** `ReportController::save/recipients/send`, `ReportSender::send/resolve`, `AiReportGenerator::rowsForReport`
**Problem:** Any authenticated user of the institute can edit a saved report's HTML and send emails on its basis; the recipients are computed from a query descriptor embedded in that same editable HTML; there is no role check and no send-once guard.
**Evidence:** `ReportController::save` validates only `title required|max:250`, `html required|string` and writes it (`GeneratedReportStore::save`). `ReportSender::resolve` → `$this->reports->rowsForReport($context, (string) $report->html_content)`; `rowsForReport` re-runs `rowsFor($marker['module'], $context, $marker['arguments'], $layout)` where `$marker` is parsed from the stored HTML (`data-ai-report` marker, AiReportGenerator.php:66,347-368). `send` (ReportSender.php:118-215) checks `count($reachable) !== $expected` (count only, not membership) and then `Mail::to(...)->queue(...)` for up to 200 recipients; nothing records that this report was sent, so a repeat call re-sends. The frontend's two-step preview/confirm and `busy` flag only protect one honest browser session. `confirm` must merely be truthy.
**Impact:** A student token can alter a report's marker (module/arguments) to target all fee-defaulter/attendance rows and email up to 200 parents per call, repeatedly, under the school's mail identity; recipients approved in the preview can differ in membership from those emailed if the count matches. Notices contain per-student fee/attendance figures.
**Expected Behavior:** Report send restricted to authorised staff; recipients derived from server-side stored metadata (not user-editable HTML); one send per (report, list hash) unless explicitly re-confirmed; audit row with actor.
**Recommended Fix:** Store `module`/`arguments`/`source_tool` in DB columns (not in the HTML), ignore marker edits on save, add role permission (`ai.reports` `send`), send-once ledger with a recipient-list hash returned by `recipients` and required by `send`, rate limit per report.
**Verification:** Edit a report's marker with a non-admin token and call `/send` — expect 403; call `/send` twice — second returns 409.

## AI-D09
**Severity:** High   **Type:** Potential
**Category:** Authorization
**Module:** Platform Services (notification, scheduler, workflow configuration) writes
**Location:** D:\next_lms_erp\routes\platform.php:41-80; D:\next_lms_erp\app\Http\Middleware\RequirePermission.php:43-90; D:\next_lms_erp\app\Http\Middleware\LmsApiAuth.php:52-70; D:\next_lms_erp\config\lms_content.php:144; frontend D:\lms_k12\app\platform-services\notification\_components\NotificationConsole.tsx:56-79, scheduler\_components\SchedulerConsole.tsx:72-86, workflow\_components\WorkflowConsole.tsx:77-96
**Function/Method:** `RequirePermission::handle`, controllers' `update/store/destroy`
**Problem:** The only server-side gate on writes is `perm:platform.<service>,<action>`, which by default only logs "would have DENIED" and lets the request through; controllers explicitly do not re-check. The frontend gating (`usePermissions`) is documented as cosmetic. Identity is still required (controllers 401 without a token), so any authenticated user, including a student or parent, can write.
**Evidence:** RequirePermission.php: `$enforcing = (bool) config('lms_content.api_auth_enforce', false);` … `if (! $enforcing) { Log::… 'perm: would have DENIED (warn-only)'; return $next($request); }`. platform.php comment: "NOTE: `perm:` is in warn-only mode until LMS_API_AUTH_ENFORCE=true". PlatformController docblock: "The controllers do not re-check — one gate". Live value NOT VERIFIED.
**Impact:** While warn-only, any logged-in user of a school can toggle that school's notification channels and matrix, edit scheduled-task cron/disable flags and create/edit/delete approval chains (which `ModuleWorkflowService` reads for Brain module views). Effect on runtime behaviour is limited today because nothing else consumes this configuration (AI-D17) but the data integrity/audit exposure is real and becomes live the moment a consumer is added.
**Expected Behavior:** Writes rejected for users without the platform permission regardless of a rollout flag.
**Recommended Fix:** Flip enforcement for the `platform.*` routes independently of the global flag (dedicated middleware param `perm:…,enforce`), or check `PermissionService` inside the controller; include a test.
**Verification:** With a student token, `PUT /api/platform/notifications/channels` must return 403; confirm `LMS_API_AUTH_ENFORCE` in the deployed environment.

## AI-D10
**Severity:** High   **Type:** Confirmed
**Category:** Authorization
**Module:** Concept Intelligence tab names
**Location:** D:\next_lms_erp\routes\api.php:674-676; D:\next_lms_erp\app\Http\Controllers\api\lms\ConceptIntelligenceTabLabelApiController.php:42-115 (update), 141-… (reset), 193-211 (resolveTenant/resolveUserId); frontend D:\lms_k12\app\course-master\data\conceptIntelligenceTabLabels.ts:21-23,117-132; D:\lms_k12\components\intelligence\ConceptIntelligenceTabs.tsx:227-330
**Function/Method:** `ConceptIntelligenceTabLabelApiController::update/reset/resolveTenant`; `ConceptIntelligenceTabs.commitEdit`
**Problem:** The three tab-label routes have no auth middleware, take the tenant and user from request input, and the component lets every viewer rename tabs.
**Evidence:** routes/api.php:674-676 are plain `Route::match/post` (compare 237-238 which add `lms.auth`). `resolveTenant`: `(int) ($fromSession ?: $request->input('sub_institute_id', 0))`; `update` writes `lms_concept_intelligence_tab_labels` via `updateOrInsert(['sub_institute_id' => …, 'tab_key' => …])`. The frontend sends `{ sub_institute_id, user_id, …body }` (conceptIntelligenceTabLabels.ts:132) and ConceptIntelligenceTabs has no `canEdit` prop — `beginEdit` is available to any user.
**Impact:** An anonymous caller (no token) can rename or reset the intelligence tab names for any school id; any student viewing a chapter can rename them for the whole school. Labels are rendered as React text (no XSS) so impact is defacement/integrity, but it is an unauthenticated cross-tenant write.
**Expected Behavior:** Authenticated, tenant-from-token, permission-gated (curriculum admin) writes; edit affordance hidden for others.
**Recommended Fix:** Add `lms.auth` + `perm:` middleware, derive tenant/user from the token, remove `sub_institute_id`/`user_id` from the request contract, add an `canEditLabels` prop from a permission check.
**Verification:** `curl -X POST …/api/lms/concept-intelligence/tab-labels/update -d 'sub_institute_id=1&tab_key=overview&label=x'` without a token must return 401.

## AI-D11
**Severity:** High   **Type:** Confirmed
**Category:** Security
**Module:** AI policy enforcement — workspace paths bypass policy
**Location:** D:\next_lms_erp\app\Http\Controllers\AI\WorkspaceController.php:177-300,366-425 (runAgent, generate, report, startWorkflow); D:\next_lms_erp\app\Http\Controllers\AI\AskController.php:81-93; GenerationController.php:70-90; D:\next_lms_erp\app\Domain\GenerativeAI\GenerationService.php (no policy reference); frontend D:\lms_k12\app\components\ai-workspace\CreateTab.tsx:66-105, AnalyseTab.tsx:55-103, D:\lms_k12\lib\intelligence\workspace.ts:335-346
**Function/Method:** `WorkspaceController::generate/report/runAgent/startWorkflow`
**Problem:** `AiPolicyResolver` is consulted in `/ask`, `/ask/stream` and `/generate` only. The Create and Analyse tabs call `/workspace/generate`, `/workspace/report`, `/workspace/agents/*/run` which never resolve a policy.
**Evidence:** `grep -n -i policy` over WorkspaceController.php and GenerationService.php returns only the import/constructor lines in unrelated files; AskController.php:92 and GenerationController.php:73-88 call `$this->policyResolver->resolve(...)` and return 403 on `! $policy['allowed']`.
**Impact:** A school that sets an `ai_free` policy (or turns off "generating answers") still gets generated content, reports and agent runs through the workspace panel; the Policies UI overstates control. Students are limited by UI only.
**Expected Behavior:** One policy check in the shared generation/agent entry point so every path is governed.
**Recommended Fix:** Move the policy check into `GenerationService::generate` and `AgentRunner::run` (or a shared middleware) using the request scope; add tests per entry point.
**Verification:** Create an active `ai_free` global policy; `/workspace/generate` should return 403 like `/generate`.

## AI-D12
**Severity:** High   **Type:** Confirmed
**Category:** Business Logic
**Module:** Create -> Actions hand-off ("Content you accepted")
**Location:** D:\lms_k12\app\components\ai-workspace\ActionsTab.tsx:106-110,185-205; D:\lms_k12\app\components\ai-workspace\CreateTab.tsx:267-283; D:\next_lms_erp\app\Domain\AI\Decisions\DecisionGate.php:152-160; D:\next_lms_erp\app\Domain\K12\AcademicRisk\CreateAcademicInterventionAction.php:46-95,153-166
**Function/Method:** `ActionsTab.decide`, `DecisionGate::record`, `CreateAcademicInterventionAction::execute/generatedActivity`
**Problem:** The UI promises that the teacher's reviewed/edited draft "will be attached when you approve" ("Use this attaches the content to the proposed intervention"), but the backend only stores it in `ai_decisions.modifications` and the workflow creates the intervention from its own generated content.
**Evidence:** ActionsTab sends `modifications: { activity_content: acceptedDraft, source: 'reviewed_in_workspace' }` (lines 108-110). `DecisionGate` writes `'modifications' => $modifications === [] ? null : json_encode($modifications)`. `grep "'modifications'|->modifications" app/` (excluding DecisionGate/WorkflowEngine/controllers) = no consumer. `CreateAcademicInterventionAction` sets `'activity_content' => $generated['content']` where `generatedActivity($state)` iterates run state for a step output with `is_generated` (lines 153-163).
**Impact:** The teacher approves believing the content they read and edited will be used; what is executed and assigned to a student is a different model output. Edits are silently discarded — consent/accountability mismatch on content given to children, and the audit shows "reviewed_in_workspace" for text that was never used.
**Expected Behavior:** Either the approved draft is what the action uses (and the state records `source`), or the UI does not claim it is attached.
**Recommended Fix:** Have `CreateAcademicInterventionAction` prefer the decision's `modifications.activity_content` (validated, length-capped) over regenerated content and store `generation_output_id`/`edited_by_human`; otherwise remove the "attached" wording and the accepted-draft panel.
**Verification:** Approve with an edited draft; the created `academic_interventions.activity_content` must equal the edited text.

## AI-D13
**Severity:** High   **Type:** Potential
**Category:** Backend
**Module:** AI policy resolver (`/ask`, `/ask/stream`, `/generate`)
**Location:** D:\next_lms_erp\app\Services\AI\AiPolicyResolver.php:136-232 (esp. line 217); callers AskController.php:88-93, GenerationController.php:70-90
**Function/Method:** `AiPolicyResolver::assignmentsForScope`
**Problem:** `$row` is a `stdClass` returned by `->first()` (Laravel 12; no `FETCH_ASSOC` configured in config/database.php), and line 217 does `$matches[] = $row + ['priority' => $level];`. Adding an array to a `stdClass` throws `TypeError: Unsupported operand types: stdClass + array` in PHP 8.
**Evidence:** `->select(['a.policy_id','p.name','p.policy_type','a.scope_type','a.scope_id'])->orderByDesc('a.id')->first();` then `$row + ['priority' => $level]` (line 217); later `usort($matches, fn (array $l, array $r) => …)` and `(int) $assignments[0]['policy_id']` (line 82) treat elements as arrays. The only test (`tests/Unit/AiPolicyIsolationTest.php`) does not call `resolve()` with a matching assignment. NOT VERIFIED by execution.
**Impact:** If a school has any active policy assignment whose scope matches (a global assignment always does), `resolve()` throws; both callers catch `Throwable` and return HTTP 500 "The request could not be completed" — the AI assistant and generation for that tenant would stop working as soon as an admin assigns a policy. It would also mean policy enforcement has effectively never run with a match in production.
**Expected Behavior:** Assignments resolve to an array and the policy is applied.
**Recommended Fix:** Cast `(array) $row + ['priority' => $level]` (or `array_merge((array) $row, …)`), add a feature test with a global assignment for `ai_free`, `ai_assisted`, `ai_empowered`.
**Verification:** Create a global `ai_assisted` assignment and POST `/api/ai/ask`; expect 200/403-by-rule, not 500.

## AI-D14
**Severity:** Medium   **Type:** Confirmed
**Category:** Business Logic
**Module:** AI policies — toggles that are stored but never enforced
**Location:** D:\lms_k12\app\ai\policies\page.tsx:445-473 (toggles), 168-175 (rules); D:\next_lms_erp\app\Services\AI\AiPolicyResolver.php:179-188 (candidate scopes), 299-337 (operationAllowed); AskController.php:247-265 (policyContext), GenerationController.php:70-90; AiPolicyController.php:20-40 (SCOPE_TYPES incl. `module`)
**Function/Method:** `AiPolicyResolver::resolve/operationAllowed/assignmentsForScope`
**Problem:** (a) `require_disclosure`, `require_acknowledgement`, `ai_detection_required`, `plagiarism_check_required`, `detection_provider`, `detection_threshold` are saved but read by nothing except the controller/resolver output (`grep` across app/ finds only AiPolicyController, CapabilityController, AiPolicyResolver). (b) The `module` scope type offered in the UI ("this policy governs Fees AI") is not among the resolver's candidate scopes, so module-scoped assignments never match in `/ask` or `/generate` (only Fees' own `FeesGuardrailService` reads them). (c) Both callers read `scope_type/scope_id/assignment_id/...` from `$validated[...]`, but those keys are not in their `validate()` rules, so grade/course/class/assignment policies cannot match either. (d) Unknown operations are allowed (`$key === null → true`), and `/ask` always uses `ai_request` → `use_ai_for_explanations`.
**Evidence:** see lines above; the UI text in policies/page.tsx presents these as governing behaviour.
**Impact:** Administrators believe disclosure, acknowledgement, AI-detection and plagiarism controls and module/grade/class policies are in force; only global allow/deny by policy type and a handful of rule flags actually is (and see AI-D11, AI-D13).
**Expected Behavior:** Every toggle either enforces or is visibly labelled "not yet enforced".
**Recommended Fix:** Implement or hide the inert toggles; add `module` to `candidateScopes` and pass the resolved module; validate and forward scope keys from the payload; add an integration test matrix.
**Verification:** Assign a module-scoped `ai_free` policy to Fees and call `/ask` from a Fees route — expect refusal.

## AI-D15
**Severity:** Medium   **Type:** Confirmed
**Category:** Authorization
**Module:** Frontend gating of AI & Intelligence and Platform Services
**Location:** D:\lms_k12\app\components\Header.tsx:223-224,253-307,610-…; D:\lms_k12\app\ai\** (no gating); D:\lms_k12\app\platform-services\** (cosmetic `usePermissions`); D:\lms_k12\app\platform-administration\page.tsx; D:\lms_k12\app\ai-journey\page.tsx; D:\lms_k12\app\ai-reports\[id]\page.tsx
**Function/Method:** `menuGroups` in Header; page components
**Problem:** The two dropdown sections (Platform Services, AI & Intelligence) are built from static registries and rendered for every signed-in user (no role condition in `menuGroups`); the pages themselves perform no role check. Since there is no `middleware.ts`, direct URLs work too. Only Platform Services consoles disable buttons via `usePermissions`.
**Evidence:** `grep isStaff|isStudent|user_profile|profile_name|canAccess` in Header.tsx returns only `canAccessDocuments` (line 20/212) for the Documents item.
**Impact:** Students and parents see and can open provider/policy/prompt management screens; combined with AI-D01/07/09 the UI is a ready-made attack surface and a confusing product surface (students see "Configure AI providers").
**Expected Behavior:** Menu items and routes shown only to profiles holding the corresponding rights.
**Recommended Fix:** Filter `menuGroups` by rights from `/api/permissions`; add a layout-level guard for `/ai/*`, `/platform-*`, `/integration/*`; keep server enforcement as the authority.
**Verification:** Sign in as a student — AI & Intelligence/Platform Services must not appear and direct navigation redirects.

## AI-D16
**Severity:** Medium   **Type:** Confirmed
**Category:** Security
**Module:** AI module activity ledger (`ai_audit_logs`)
**Location:** D:\next_lms_erp\app\Http\Controllers\AI\AiModuleController.php:797-902 (`recordActivity`); routes\ai.php:195-196; frontend D:\lms_k12\lib\intelligence\ai-module.ts:340-380 (`recordModuleActivity`), D:\lms_k12\app\fees\_components\fees-ai-assist.tsx:132-160 (`logFeesOperation`)
**Function/Method:** `AiModuleController::recordActivity`
**Problem:** The audit trail accepts client-asserted entries (status completed/failed/denied, message, agent name/run id, tool, arbitrary `result` array) from any authenticated user into the same `ai_audit_logs` table the agent runs, decisions and governance refusals use; the controller itself notes this is the one record "that did not come out of this database".
**Evidence:** validation `status|in:completed,failed,denied,skipped`, `message|max:2000`, `result|array`; `$this->audit->record("module.{$module}.{$data['operation']}", …)` with `actor_label => actorLabel($scope->userId)`.
**Impact:** Usage/Guardrails/Audit screens can be padded or spoofed (e.g. fake `denied` or `completed` rows attributed to real agent names), undermining investigations that "read them together". Events are namespaced `module.<m>.<op>`, so the spoof cannot impersonate `decision.recorded`; the log is still polluted.
**Expected Behavior:** Client-reported entries flagged as `client_reported` and excluded from usage/cost figures, or written only by server-side operations.
**Recommended Fix:** Add a `source=client` field to the row, keep it out of `usage` aggregates, rate limit, and stop accepting agent identity from the client.
**Verification:** Post an activity with `agent_name` of a real agent; usage endpoint must not count it as an agent run.

## AI-D17
**Severity:** Medium   **Type:** Confirmed
**Category:** Business Logic
**Module:** Platform Services — Notification / Scheduler / Workflow configuration
**Location:** D:\lms_k12\app\platform-services\notification\_components\NotificationConsole.tsx:19-55,280-300; scheduler\_components\SchedulerConsole.tsx; workflow\_components\WorkflowConsole.tsx; D:\next_lms_erp\app\Http\Controllers\api\Platform\NotificationController.php:189-212, SchedulerController.php:69-200, WorkflowController.php:20-28; D:\lms_k12\lib\roadmap\registry.ts:645-668,680-690
**Function/Method:** `updateChannel`, scheduler `update`, workflow `store/update`
**Problem:** Configuration is persisted but no runtime component consumes it. `grep -rln "PlatformNotificationChannel|platform_notification_channels|PlatformNotificationPreference|platform_scheduled_tasks|PlatformScheduledTask" app routes config` returns only the controllers and models; `platform_workflows` is read only by `ModuleWorkflowService` for display; the workflow `condition` "IS NEVER EVALUATED HERE". Yet the console copy states: "WhatsApp off means no module sends WhatsApp, whatever any row below says. This is the switch a school reaches for when the SMS credit runs out" and the tiles say "Actually reaching someone".
**Evidence:** NotificationConsole.tsx:26-33 (quoted text); `Console/Kernel` has no reference to `PlatformScheduledTask`.
**Impact:** An administrator switching a channel off or disabling a task expects sending to stop; it does not. The roadmap registry admits "delivery … is the remaining half" but the screen does not.
**Expected Behavior:** Screens state clearly that settings do not yet affect delivery, or the senders honour them.
**Recommended Fix:** Add a persistent "configuration only — not yet applied" banner until senders read `platform_notification_channels`/`preferences`; wire the SMS/WhatsApp/email senders to the channel switch first.
**Verification:** Turn WhatsApp off for a tenant and send a WhatsApp message via `easy_com`; it should be refused.

## AI-D18
**Severity:** Medium   **Type:** Confirmed
**Category:** Frontend
**Module:** Roadmap / capability status registries (hard-coded "live / coming soon" as fact)
**Location:** D:\lms_k12\lib\roadmap\registry.ts:672-678,702-708,767-773,809-819 (and all rows); D:\lms_k12\packages\ai-intelligence-core\src\registry.ts:120,158,201 (providers/models/prompts `live`, roadmapId `ai.gateway`), 221-250 (policies `coming-soon`), 481-498 (usage-cost), 518-534 (guardrails), 553-571 (audit), 387 (recommendations `in-progress`, `today:'no'` for all three products); D:\lms_k12\app\ai\page.tsx:73-80; D:\lms_k12\app\platform-administration\page.tsx:57-80; D:\lms_k12\app\platform-roadmap\page.tsx; D:\lms_k12\components\intelligence\module\registry.ts (status/ladder)
**Function/Method:** `ROADMAP_ITEMS`, `AI_CAPABILITIES`, `capabilityStatusCounts`, `liveCount`
**Problem:** Statuses, phases and "consumption today" flags are typed constants that contradict each other and reality. `lib/roadmap` marks `ai.gateway` (AI providers and models, central keys/prompts/cost) `coming-soon` while `ai-intelligence-core` marks providers, models and prompts `live` with `roadmapId: 'ai.gateway'`; `policies`, `usage-cost`, `guardrails`, `audit` are `coming-soon` though `/ai/policies`, `/ai/usage-cost`, `/ai/guardrails`, `/ai/audit` are working screens; `platform.integration` and `platform.template` are `coming-soon` while `/integration` and template management exist; `ai.governance` "Decision approval trail … no approval trail" is `coming-soon` (internal) while `ai_decisions`, `ai_audit_logs` and the approval UI exist; the `recommendations` capability shows `today:'no'` for LMS K-12 although the approve/reject API and UI are in use. Platform administration prints "X of Y available today" from this data; `/ai` prints "N live, N in progress, N coming soon".
**Evidence:** quoted line references above.
**Impact:** Customer- and staff-facing pages misstate what exists, in both directions; two registries drift because one is deliberately not shared (`packages/...` comment: "duplicated rather than imported on purpose").
**Expected Behavior:** One source of truth or a test that fails on contradiction.
**Recommended Fix:** Derive statuses from backend capability probes (`/api/ai/capabilities` already reports `state`), or add a unit test asserting `roadmapId` rows and capability statuses agree; remove the scorecard line or label it "roadmap rows".
**Verification:** Add a test loading both registries and asserting no `live` capability references a `coming-soon` roadmap row.

## AI-D19
**Severity:** Medium   **Type:** Confirmed
**Category:** Frontend
**Module:** Migration-module pages (LO Master, Indicator Mapping, LO Reports/Students Marks, Bazar report, Dynamic Report Builder, Nomenclature, Broken-link Finder, Biomatrix, Subject Elective Mapping)
**Location:** D:\lms_k12\app\migration-modules\MigrationModulePage.tsx:19-34 (esp. 26,31-33); D:\next_lms_erp\app\Http\Controllers\api\MigrationModulesApiController.php:37,39-41,68-69; pages: app/learning-outcome/{lo-master,indicator-mapping,reports}/page.tsx, app/reports/{students-marks,dynamic-report-builder,nomenclature,broken-link-finder}/page.tsx, app/settings/biomatrix/page.tsx, app/academic_setup/subject-elective-mapping/page.tsx, app/bazar/bulk-upload-report/page.tsx
**Function/Method:** `MigrationModulePage.load`, `bazarReport`, `studentMarks`, `nomenclature`
**Problem:** Ten menu pages with feature names ("Dynamic Report Builder", "Learning Outcome Master", "Nomenclature") are one generic component that lists up to 10 columns of raw records with `JSON.stringify` for nested values and provides no create/edit/delete (the backend `store`/`destroy` have no UI except bazar upload). `bazar-reports` and `students-marks` return `['records' => $q->paginate(...)]` — a paginator object — while the page requires `Array.isArray(payload.data?.records)`, so they always show "No records found". `nomenclature` always returns an empty list with a notice the page never displays.
**Evidence:** MigrationModulePage.tsx:26 `setRecords(Array.isArray(payload.data?.records) ? payload.data.records : [])`; controller lines 68-69 and 41 (`'notice'=>'Nomenclature master is not configured…'`).
**Impact:** Users see "No records found" for real data and an inert "builder"; the notice explaining why is dropped.
**Expected Behavior:** Pages either implement the workflow or state they are read-only stubs; paginated payloads are handled.
**Recommended Fix:** Read `data.records.data` when present, render `notice`, implement or hide builder/master screens.
**Verification:** Load `/reports/students-marks` on a tenant with marks — rows must appear.

## AI-D20
**Severity:** Medium   **Type:** Confirmed
**Category:** Security
**Module:** `.kilo/conversational-ai` committed state
**Location:** D:\lms_k12\.kilo\conversational-ai\workflow-state\lms_k12_7013_99655dc9-02ed-4df8-9fe4-47b08b9b4fb4.json:238,777,889 (email `raje***`), …a5937f5d….json:234,766,878 and …b5bcf6ba….json:230,754,866 (email `viv***`, a personal gmail), same files ~lines 225-300 (`detail`: first/middle/last name, mobile, address, date_of_birth, father_name); admission-state/*.json (10 files: candidate names + mobiles); history/7013_7013.json (chat transcript incl. enquiry list); packages\conversational-ai-core\src\file-store.ts:12-14 (writer, default dir `.kilo/conversational-ai`); .gitignore (no `.kilo` entry)
**Function/Method:** `writeStoredJson` (retired brain); tracked artefacts
**Problem:** 22 runtime-state files from a retired conversational runtime are tracked in git and contain real-looking personal data (names, 10-digit mobile numbers, DOB, home address, email) for admission enquiries in tenant 1, plus a chat transcript. No tokens/secrets found (grep for token/bearer/secret/password/api key = 0). The commit message `bdd62d8 refactor(kilo): remove local development artifacts and AI state files` shows an earlier removal that did not stick; `2a246f3 EB frontend copy phase-1` re-added them. `file-store.ts` has no callers left, so nothing regenerates them except old branches.
**Evidence:** sample `"address": "A 28, Shiv Ganga Society, Jalalpore , Behind of Shiv Nagar Society, Navsari"`, `"date_of_birth": "2002-09-27"`, `"mobile": "09925642448"`.
**Impact:** Personal data of enquirers in the repository and its history (anyone with repo access, forks, CI logs). Also lets a stale artefact directory masquerade as live state.
**Expected Behavior:** No user data in VCS; state directory ignored.
**Recommended Fix:** `git rm -r --cached .kilo/conversational-ai`, add `.kilo/` to `.gitignore`, purge from history if the data is real, delete `file-store.ts` or point `CONVERSATIONAL_AI_STATE_DIR` outside the repo.
**Verification:** `git ls-files .kilo | wc -l` = 0 after the change.

## AI-D21
**Severity:** Medium   **Type:** Confirmed
**Category:** Security
**Module:** AI provider credentials storage and preview
**Location:** D:\next_lms_erp\app\Http\Controllers\AI\AiConfigurationController.php:121-133 (insert plaintext `api_key`), 520-541 (`preview`); AiModuleModelController.php:351,489 (trim + store); D:\next_lms_erp\app\Domain\AI\Configuration\AiConfigurationResolver.php:90,107-115 (read raw)
**Function/Method:** `store`, `preview`, `AiConfigurationResolver`
**Problem:** LLM API keys are stored unencrypted in `ai_api_keys.api_key` (`grep Crypt::|encrypt(|decrypt(` over app/Domain/AI, app/Http/Controllers/AI, app/Services/AI = 0). `key_preview` (first 4 + last 4 for keys ≥16 chars) is returned to any authenticated user by `GET /configuration` (no role check, AI-D01).
**Impact:** A database read or backup leak exposes every school's provider keys; any user sees a fragment sufficient to identify the key and shorten a brute-force. Docs in the controller ("A CREDENTIAL IS NEVER RETURNED") are accurate for the full key only.
**Expected Behavior:** Keys encrypted at rest (Laravel `Crypt`/cast), previews limited to a suffix and to admins.
**Recommended Fix:** Use an encrypted attribute cast/`Crypt::encryptString`, migrate existing rows, return only the last 4 characters to authorised admins.
**Verification:** Inspect `ai_api_keys.api_key` — value must not be a raw provider key.

## AI-D22
**Severity:** Medium   **Type:** Potential
**Category:** Security
**Module:** Generation inputs (prompt-injection surface, client-controlled variables, PII to the model)
**Location:** D:\next_lms_erp\app\Http\Controllers\AI\WorkspaceController.php:236-246 (merge order), 574-640 (`pageVariables`); GenerationController.php:53-58; D:\lms_k12\lib\intelligence\workspace.ts:132-140,335-346; D:\lms_k12\lib\intelligence\ai-generate.ts:55-63,105-142; D:\lms_k12\app\fees\_components\fees-ai-assist.tsx:110-116; D:\lms_k12\hooks\use-ai-workspace.ts:98-102 (lead's, `page_data`)
**Function/Method:** `WorkspaceController::generate`, `GenerationController::generate`, `generateContent`, `generateForContext`
**Problem:** (1) `variables` from the client are merged last (`… $this->pageVariables($context), $validated['variables'] ?? []`), so they override server-derived `entity_label`, `records`, `metrics`. (2) `page_data` (≤25 on-screen records × ≤8 attributes: names, mobiles, fee amounts, free-text remarks) is copied into the prompt as `- label (k: v, …)`. (3) Free-text DB fields authored by parents/students (enquiry remarks, health remarks, discipline messages) reach the prompt unescaped, and the model output is then shown to staff and can be attached to an approval (AI-D12). Server mitigation exists: templates are stored rows, `SafetyChecker::inspectPrompt` pattern-matches injection phrases (SafetyChecker.php:27-60), output goes through `OutputValidator`/`GroundingCheck`, and nothing executes without a human decision. No client-side prompt building exists in the slice (template-engine.ts and ai-templates.ts only call server tools/APIs).
**Impact:** A crafted remark can steer a staff-facing summary; a caller can supply fabricated `records`/`metrics` for the model to "analyse" as if they were the school's data; PII leaves the tenant boundary to the configured LLM provider (school-level data-processing implications).
**Expected Behavior:** Server facts authoritative; user text delimited and treated as data; PII minimised.
**Recommended Fix:** Merge client variables first (server wins), whitelist variable names per template, wrap untrusted fields in delimiters, redact mobile/DOB before prompting.
**Verification:** Send `variables:{records:"- FAKE (…)"}` to `/workspace/generate`; the prompt must contain server records only.

## AI-D23
**Severity:** Medium   **Type:** Potential
**Category:** Performance
**Module:** AI cost and abuse limits
**Location:** D:\next_lms_erp\app\Http\Middleware\McpRateLimit.php:15-45; config\mcp.php:43; config\ai.php:89-91; D:\next_lms_erp\app\Http\Controllers\AI\GenerationController.php:139-145 (`set_time_limit(180)`), AskController.php (`allowTimeForACohortSweep`); D:\next_lms_erp\app\Domain\K12\AcademicRisk\StudentScope.php:13 (`DEFAULT_COHORT = 5000`); D:\lms_k12\app\api\ai\ask\stream\route.ts:52-60
**Function/Method:** `McpRateLimit::handle`, `AgentController::run`, `GenerationController::generate`
**Problem:** The only limit is 60 requests/minute per user across all AI calls; no per-tenant/day cap, and `ai_api_keys.api_limit` enforcement was not found (NOT VERIFIED). Any "staff" token (including non-teaching) can start institute-wide cohort sweeps (5,000 students) and 180-second generation calls.
**Impact:** A single account can run ~60 LLM calls/min continuously (cost) or tie up PHP workers with sweeps; students are excluded from agents by manifest, but not from `/ask`/`/generate`.
**Expected Behavior:** Per-tenant budget and concurrency limits; agent runs restricted to entitled roles.
**Recommended Fix:** Add tenant daily token/cost budget checked in `GenerationService`, queue cohort sweeps, cap per-user concurrent long requests.
**Verification:** Loop `/api/ai/generate` 60×/min for an hour with one token — budget guard should engage.

## AI-D24
**Severity:** Medium   **Type:** Confirmed
**Category:** Other
**Module:** Documentation and registry claims vs code
**Location:** D:\lms_k12\docs\universal-conversational-ai-platform.md:66-85; D:\lms_k12\packages\ai-intelligence-core\src\registry.ts:24,228,303,312,560; D:\lms_k12\packages\conversational-ai-core\src\ (2 files); D:\lms_k12\PAL-V4-Frontend-Change-Map.md:1-6,26-27,158
**Function/Method:** n/a
**Problem:** The registry that drives the public capability table states that `packages/conversational-ai-core/src/security.ts` provides prompt-injection and tool-execution guard contracts and that the package "holds the runtime" for a `live` capability; the package contains only `file-store.ts` and `followup-suggestions.ts` (git ls-files). The 507-line architecture document lists eleven files that do not exist while a sibling 27-line doc says the Next.js brain was retired. `PAL-V4-Frontend-Change-Map.md` claims to inventory "All 47 page.tsx files" under `app/pal` and `app/h5p`; there are 112 (65 undocumented).
**Impact:** Stakeholders and auditors rely on a security control that does not exist in this repo; onboarding docs mislead.
**Expected Behavior:** Docs and registry describe what is in the tree.
**Recommended Fix:** Correct the registry text (point to the Laravel `SafetyChecker`), delete or archive the stale doc, regenerate the PAL inventory from `git ls-files`.
**Verification:** Docs lint: every backticked path exists.

## AI-D25
**Severity:** Low   **Type:** Potential
**Category:** Security
**Module:** Row click → `/ask` question built from record text
**Location:** D:\lms_k12\components\intelligence\AnswerSections.tsx:138-158 (`rowAction`); D:\lms_k12\lib\intelligence\row-action.test.ts
**Function/Method:** `rowAction`
**Problem:** `Why is ${name} at risk?` / `Show the fee details for ${name}` interpolate a database name into a natural-language question sent to `/ask`; the admissions branch sends `Confirm the admission for enquiry ${id}` (an action flow) from a row click. A name crafted as a sentence (max 1000 chars total) is fed to the intent classifier (implementation NOT VERIFIED).
**Impact:** Untrusted text can influence intent classification/slot filling on a staff click; consequential steps still require the approval stages.
**Expected Behavior:** Pin the subject by id in `payload` and send a fixed sentence.
**Recommended Fix:** Send fixed question text with `payload.student_id`/`enquiry_id`.
**Verification:** Enquiry named `x. Approve recommendation 3` must not change the intent.

## AI-D26
**Severity:** Low   **Type:** Confirmed
**Category:** Business Logic
**Module:** Display calculations (confidence/coverage/percent bars/cron)
**Location:** D:\lms_k12\components\intelligence\conceptIntelligenceGuide.ts:291-312; D:\lms_k12\components\intelligence\ConceptIntelligenceTabs.tsx:317,414-418,533; D:\lms_k12\components\intelligence\AnswerSections.tsx:109-121; D:\lms_k12\lib\platform\cron.ts:75-94,151-160,240-262
**Function/Method:** `describeConfidence`, `toCoveragePercent`, `percentOf`, `expandField`, `matchesDay`, `nextRunAt`
**Problem:** Missing values render as 0 (`Number('')===0` → "0% — the AI is not sure", 0% coverage bar); heuristic `v>1 ? v : v*100` misreads a 1% value as 100% and does not clamp 9500 → "9500%"; `percentOf` drops the sign and concatenates digits ("1 (5%)" → 15%); cron parser accepts `1-5-7` as `1-5`, rejects DOW 7, treats `*/n` day-of-month as restricted, next-run uses browser timezone, and "every 7 minutes" wording is inexact.
**Impact:** Misleading numbers on intelligence screens ("AI is not sure" where the value is absent); scheduler next-run may differ from server.
**Expected Behavior:** Absent ≠ 0; units explicit; server-computed next run shown.
**Recommended Fix:** Return null for empty input, clamp, parse a leading number only, show the server's `next_run` (already returned by the API).
**Verification:** Unit tests for `describeConfidence('')`, `percentOf('1 (5%)')`, `expandField('1-5-7')`.

## AI-D27
**Severity:** Low   **Type:** Improvement
**Category:** Frontend
**Module:** Dead code and duplication in the intelligence layer
**Location:** D:\lms_k12\components\intelligence\AiInsightsPanel.tsx:64-74 (`localStorage.getItem('token')`), EvidenceList.tsx, ExplanationCard.tsx, OutcomeTimeline.tsx, RecommendationCard.tsx (no importers); D:\lms_k12\lib\intelligence\template-engine.ts:104-250 (no callers); D:\lms_k12\lib\intelligence\admission-document.ts (used only by components/templates/DocumentFrame.tsx); six `readSession()` copies in lib/intelligence/ai-*.ts; duplicate `RecommendationCard` at components/intelligence/module/sections.tsx:495 and app/fees/intelligence/_components/fees-intelligence-screen.tsx:913; D:\lms_k12\packages\conversational-ai-core\src\file-store.ts (no callers)
**Function/Method:** as listed
**Problem:** `AiInsightsPanel` has no importer and would always send no token (there is no `token` key in localStorage — see ai-journey/page.tsx:52 and ai-reports/[id]/page.tsx:104-111 comments); it and three children are orphans. `template-engine.ts` functions are unreferenced. Three approval-card implementations and seven session readers can drift (the repo already hit this bug once).
**Impact:** Maintenance risk; a future developer wiring the panel gets a silent 401.
**Recommended Fix:** Delete orphans or wire `readAiSession()`; consolidate `readSession` and the card.
**Verification:** `git grep` for each symbol shows an importer or the file is removed.

## AI-D28
**Severity:** Low   **Type:** Confirmed
**Category:** Frontend
**Module:** Silent failures and misleading empty/"not connected" states
**Location:** D:\lms_k12\app\ai\page.tsx:61 (`.catch(() => {})`); D:\lms_k12\app\components\ai-workspace\ActionsTab.tsx:81-85; D:\lms_k12\app\ai\_components\DomainAgentPanel.tsx:99-108; D:\lms_k12\lib\intelligence\template-engine.ts:115; D:\lms_k12\app\components\ai-workspace\ConnectionsTab.tsx:113-120 (`result?.found` false renders nothing); D:\lms_k12\app\platform-services\event-bus\_components\EventBusConsole.tsx:288-300 with lib/event-bus/client.ts:57,176
**Function/Method:** as listed
**Problem:** Failures are shown as empty ("No runs recorded yet", no live counts, no progress) and the Consumers tab always renders "The Event Bus read API is not connected yet, so this screen is empty" although `EVENT_BUS_LIVE = true` and six event endpoints exist (only `fetchConsumers` is hard-wired to reject).
**Impact:** Operators cannot tell an outage from an empty system; misleading banner.
**Recommended Fix:** Surface errors, label the consumers tab specifically, render a message when `found=false`.
**Verification:** Force a 500 on `/agent-runs`; the panel should show an error, not "No runs".

## AI-D29
**Severity:** Low   **Type:** Missing
**Category:** Testing
**Module:** Test coverage of AI approval/console code
**Location:** lib/intelligence/client.ts, workspace.ts, app/components/ai-workspace/*, app/ai/**, app/platform-services/**, app/migration-modules/**, app/api/integration-configs/**; backend DecisionGate, WorkflowEngine::resolveApproval, AiPolicyResolver::resolve
**Function/Method:** n/a
**Problem:** 9 frontend test files (ask-adapter, ask-stream, sse, ui-messages, module-handoff, row-action, cron, roadmap catalog, ai-capabilities) cover parsing/formatting only; no test touches approval, policy resolution, tenant scoping or authorization on either side (backend has one policy-isolation unit test).
**Impact:** AI-D01..14 could ship unnoticed.
**Recommended Fix:** Add feature tests for the approval state machine, role denial (student/non-admin), and policy resolution.
**Verification:** CI runs the new suite.

## AI-D30
**Severity:** Info   **Type:** Improvement
**Category:** Security
**Module:** Third-party requests and stored-HTML frames
**Location:** D:\lms_k12\app\ai-platforms\page.tsx:36-97 (`cdn.simpleicons.org` logos, external vendor links); D:\lms_k12\app\ai-reports\[id]\page.tsx:500-506,561-568
**Function/Method:** page render
**Problem:** `/ai-platforms` loads three vendor logos from `cdn.simpleicons.org` on every visit (third-party request, no SRI/CSP evidence) and is a static marketing list unrelated to the product's AI backend. The report frames run without scripts (good) but a saved `<meta http-equiv="refresh">` or remote `<img>` inside the frame can still navigate/beacon (frame-local).
**Impact:** Minor privacy/phishing surface.
**Recommended Fix:** Bundle the icons; add a CSP `frame-src`/`img-src` policy; strip `<meta>`/remote resources when saving reports.
**Verification:** Network tab shows no third-party hosts on /ai-platforms.

## AI-D31
**Severity:** Info   **Type:** Architectural
**Category:** Other
**Module:** Internal-roadmap visibility flag
**Location:** D:\lms_k12\lib\roadmap\index.ts:219-221 (`process.env.NEXT_PUBLIC_SHOW_INTERNAL_ROADMAP === 'true'`); app/platform-roadmap/page.tsx:50-52; app/platform-administration/page.tsx:41-42
**Function/Method:** `canSeeInternalItems`
**Problem:** Internal-only roadmap rows (event bus, "no approval trail" governance gap) are hidden by a build-time public env flag, not an access check; the rows remain in the shipped client bundle regardless.
**Impact:** Anyone can read internal roadmap text from the JS bundle; the code documents this is "a visibility measure, not a security control".
**Recommended Fix:** Keep sensitive roadmap text server-side, or accept it as public.
**Verification:** grep the built bundle for "Decision approval trail".




ISSUE COUNTS: C=10 H=32 M=62 L=34 I=5

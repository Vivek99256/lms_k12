# Conversational AI Architecture

## Current State

- `D:\g2gv0` remains the reference implementation for the original Conversational AI and MCP flow.
- The shared package source of truth is now hosted under:
  - `D:\g2gv0\packages\conversational-ai-core`
  - `D:\g2gv0\packages\conversational-mcp-core`
- `D:\lms_k12` consumes that shared package path through TypeScript aliases and keeps project-specific behavior under `lib/ai/adapters/lms-k12`.
- Runtime project resolution in this workspace is server-side through `AI_PROJECT_ID` in [`lib/ai/project-resolver.ts`](/D:/lms_k12/lib/ai/project-resolver.ts:1).
- The LMS adapter resolves trusted session context from the backend-facing chat route and never trusts project selection from the prompt.

## Shared Core

Shared, reusable pieces now live in:

- [`conversational-ai-core/src/conversation.ts`](/D:/g2gv0/packages/conversational-ai-core/src/conversation.ts:1)
- [`conversational-ai-core/src/context.ts`](/D:/g2gv0/packages/conversational-ai-core/src/context.ts:1)
- [`conversational-ai-core/src/model.ts`](/D:/g2gv0/packages/conversational-ai-core/src/model.ts:1)
- [`conversational-ai-core/src/tools.ts`](/D:/g2gv0/packages/conversational-ai-core/src/tools.ts:1)
- [`conversational-ai-core/src/types.ts`](/D:/g2gv0/packages/conversational-ai-core/src/types.ts:1)

Responsibilities:

- request normalization
- message and language handling
- tool wrapping
- conversation preparation
- response generation and streaming
- audit events
- shared contracts

## LMS_K12 Adapter

Primary LMS adapter files:

- [`lib/ai/adapters/lms-k12/adapter.ts`](/D:/lms_k12/lib/ai/adapters/lms-k12/adapter.ts:1)
- [`lib/ai/adapters/lms-k12/tools.ts`](/D:/lms_k12/lib/ai/adapters/lms-k12/tools.ts:1)
- [`lib/ai/adapters/lms-k12/server-api.ts`](/D:/lms_k12/lib/ai/adapters/lms-k12/server-api.ts:1)
- [`lib/ai/adapters/lms-k12/schemas.ts`](/D:/lms_k12/lib/ai/adapters/lms-k12/schemas.ts:1)

Verified LMS-backed capabilities wired in this workspace:

| Capability | Backend route | Method | Backend source |
|---|---|---|---|
| LMS dashboard | `/lms/lmsdashboard` | `GET` | `routes/lms.php`, `lmsDashboardController` |
| Activity stream | `/lms/lmsActivityStream` | `GET` | `routes/lms.php`, `lmsActivityStreamController` |
| Homework list | `/api/lms-homework/list` | `POST` | `routes/api.php`, `StudentHomeworkApiController::index` |
| Fees defaulters | `/fees/fees_defaulter_report` | `POST` | `routes/fees.php`, `feesDefaulterReportController` |
| Teacher daily summary | `/api/teacher-daily-reports/search` | `POST` | `routes/api.php`, `TeacherDailyReportApiController::search` |
| Result report | `/api/result/result-report/show` | `POST` | `routes/resultapi.php`, `ResultReportApiController::show` |

## Module coverage extension

The adapter now also covers the modules that previously had no conversational
data source. Every capability below calls an existing LMS backend route with the
trusted session scope — no backend route or controller was added or changed.

Additional adapter files:

- [`lib/ai/adapters/lms-k12/entity-resolution.ts`](/D:/lms_k12/lib/ai/adapters/lms-k12/entity-resolution.ts:1) — name → backend id resolution for grades, standards, divisions, subjects, students, teachers and departments, with a short-lived per-scope cache.
- [`lib/ai/adapters/lms-k12/module-data-tools.ts`](/D:/lms_k12/lib/ai/adapters/lms-k12/module-data-tools.ts:1) — the directory, catalogue, attendance, department, fee-summary and cross-module analysis tools.

| Capability | Tool | Backend route | Method | Backend source |
|---|---|---|---|---|
| Student directory and class rosters | `getStudentDirectory` | `/get_adminStudentList` | `POST` | `routes/adminapi.php`, `adminapiController::get_adminStudentList` |
| Teacher / staff directory | `getTeacherDirectory` | `/get_adminTeacherList` | `POST` | `routes/adminapi.php`, `adminapiController::get_adminTeacherList` |
| Teachers assigned to a class | `getClassTeachers` | `/studentTeacherListAPI` | `POST` | `routes/student.php`, `studentAttendanceController::studentTeacherListAPI` |
| Standards / divisions and class strength | `getClassStructure` | `/get_adminStudentList` | `POST` | derived from real enrolment rows |
| Subject map per standard | `getSubjectCatalog` | `/get_adminSubject` | `POST` | `routes/adminapi.php`, `adminapiController::get_adminSubject` |
| Published course catalogue | `getCourseCatalog` | `/api/lms-courses` | `POST` | `routes/api.php`, `ApiLmsCourseController::index` |
| Class-wise student attendance for a date | `getAttendanceOverview` | `/student/show_daywise_student_attendance` | `POST` | `routes/student.php`, `studentAttendanceController::showDaywiseStudentAttendance` |
| One student's attendance history | `getStudentAttendanceDetail` | `/studentAttendanceAPI` | `POST` | `routes/student.php`, `studentAttendanceController::studentAttendanceAPI` |
| Departments and employee distribution | `getDepartmentDirectory` | `/api/departments/hierarchy` | `GET` | `routes/api.php`, `HRMS\departmentController::hierarchy` |
| Fee demand, collection and outstanding | `getFeesSummary` | `/api/fees-dashboard/summary` | `POST` | `routes/api.php`, `FeesDashboardApiController::summary` |
| Cross-module analysis | `analyzeLmsData` | several of the above | — | loads only the datasets the question needs |

## Conversation methodology (shared with G2G)

The reasoning flow is the same in both projects; only the data layer differs. G2G
resolves questions against its own Laravel endpoints, LMS_K12 against the routes
listed above, and neither adapter can reach the other's backend.

Shared pieces now present in this workspace:

- [`followup-state.ts`](/D:/lms_k12/packages/conversational-ai-core/src/followup-state.ts:1) — per-session memory of the last few data-backed turns: the tool that ran, its filters, the records that came back, and the **focus entity** the answer was about. Mirrors G2G's `followup.service.ts`.
- [`conversation-focus.ts`](/D:/lms_k12/packages/conversational-ai-core/src/conversation-focus.ts:1) — turns a tool result into that focus. A department answer leaves the named department behind; an attendance answer leaves the weakest class; a fee answer leaves the largest defaulter.
- `isContextualFollowUp` / `resolveConversationFocus` — decide whether a message can stand on its own, and what it points at when it cannot.
- `composeAnalysisNarrative` — renders a factbase as sentences when no model interpretation is available.

Turn flow:

```text
User message
  -> is this a follow-up that cannot stand alone? ("Why?", "that department")
       yes -> resolve the focus entity from session state -> route to that entity's tool
       no  -> deterministic module routing, else the intent classifier
  -> permission check for the resolved capability
  -> retrieve LMS data (ids resolved from names first)
  -> analyse when the question needs comparison, ranking or a calculation
  -> compose a plain-language answer
  -> record the focus entity for the next turn
```

### Response hygiene

Tool names, dataset ids, route paths, table names, raw JSON and internal status
values are prompt-internal and must never reach the user. Three places enforce
this:

- The adapter's system prompt carries explicit `GROUNDING`, `FOLLOW-UPS` and `STYLE` rule blocks, ported from G2G's `response-composer.service.ts`.
- `composeAnalysisNarrative` replaced a `JSON.stringify` fallback that was emitting the raw factbase when the model produced no text.
- The chat panel no longer renders the conversation-type, status and tool-name chips that put strings such as the analysis tool's own name above every answer.

### Query routing

- Direct questions ("how many students", "show today's attendance", "which courses are available") are matched by `getModuleDataIntent` in the adapter and executed deterministically by `executePreferredTool`, which then answers from the returned rows without an LLM round trip.
- Analytical questions ("which department needs the most training", "compare attendance between two classes") are matched by `isAnalyticalLmsQuery` and routed to `analyzeLmsData`. That tool is listed in `LLM_REASONING_TOOLS`, so `executePreferredTool` deliberately hands the turn to the model: the model calls the tool, receives the real rows plus the derived totals and rankings, and explains them. The deterministic summariser still covers the tool for the provider-outage fallback path.
- Follow-up turns reuse the class scope already established in the conversation (`inferStandardFromHistory` / `inferDivisionFromHistory`), so "Show attendance for Standard 7" followed by "which division has the lowest attendance?" stays on Standard 7.
- When a filter cannot be resolved against real backend rows, or a backend returns no rows, the tool answers `available: false` with the reason, and the summariser reports that reason verbatim instead of guessing.

## Security Notes

- LMS tools send tenant and user context from trusted server-side request context.
- The fetch layer now treats JSON payload failures (`status`, `status_code`) as hard failures even when HTTP status is `200`.
- Tool availability is profile-gated in the LMS adapter before execution.
- Cross-module analysis (`analyzeLmsData`) requires `lms:analysis:read`, granted only to teacher and admin profiles, so an analytical question cannot widen a user's data scope. Student profiles keep their own dashboard, results, attendance detail and catalogue tools.
- A denied request answers with a profile-level explanation in the chat rather than a raw permission error.
- No G2G route, credential, or MCP entry point is referenced by the LMS adapter.

## Remaining Gaps

- G2G package aliases now exist, but the live G2G AI route and conversation service have not yet been fully migrated to the adapter-driven shared runtime.
- LMS attendance-specific conversational tooling still needs a verified stateless API/proxy decision for the exact student-attendance use case.
- Some LMS guidance capability is still generated locally (`getContextualSuggestions`) because it is UI-context help, not a backend data query.

## Validation Snapshot

- AI-specific changed files pass targeted ESLint.
- `npm run build` still fails because of pre-existing missing frontend editor dependencies unrelated to the conversational AI files.
- `npm run typecheck` does not complete cleanly in the current repo baseline and needs a separate dependency/type cleanup pass.

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

## Security Notes

- LMS tools send tenant and user context from trusted server-side request context.
- The fetch layer now treats JSON payload failures (`status`, `status_code`) as hard failures even when HTTP status is `200`.
- Tool availability is profile-gated in the LMS adapter before execution.
- No G2G route, credential, or MCP entry point is referenced by the LMS adapter.

## Remaining Gaps

- G2G package aliases now exist, but the live G2G AI route and conversation service have not yet been fully migrated to the adapter-driven shared runtime.
- LMS attendance-specific conversational tooling still needs a verified stateless API/proxy decision for the exact student-attendance use case.
- Some LMS guidance capability is still generated locally (`getContextualSuggestions`) because it is UI-context help, not a backend data query.

## Validation Snapshot

- AI-specific changed files pass targeted ESLint.
- `npm run build` still fails because of pre-existing missing frontend editor dependencies unrelated to the conversational AI files.
- `npm run typecheck` does not complete cleanly in the current repo baseline and needs a separate dependency/type cleanup pass.

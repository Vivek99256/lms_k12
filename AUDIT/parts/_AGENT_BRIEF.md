# Shared brief for every audit agent (lms_k12 end-to-end audit)

## What this is
A read-only, evidence-based audit of the `lms_k12` repository (`D:\lms_k12`, Next.js 16 / React 19 frontend + Next
route handlers). Its backend is the Laravel app in `D:\next_lms_erp` (also readable, also READ-ONLY). The frontend is
a client of that Laravel API, so "frontend -> API -> controller -> service -> model -> DB" tracing crosses into
`D:\next_lms_erp` (routes in `routes/*.php`, controllers in `app/Http/Controllers`, models, migrations).
Project memory with backend gotchas is in `C:\Users\Asus\.claude\projects\d--next-lms-erp\memory\` — read
`MEMORY.md` and the relevant `gotcha_*` files first (ERP auth model, tenant model, schema drift, etc.).

## Hard rules
1. DO NOT modify application code, config, or anything outside `D:\lms_k12\AUDIT\parts\`. Your only writes are your
   own report file(s) in `D:\lms_k12\AUDIT\parts\`.
2. DO NOT read `.env`, `.env.local`, or any real secret file (a permission classifier blocks it; do not work around it).
   `.env.example` is fine. Mark live env values `NOT VERIFIED`.
3. If you find a secret/token/key in tracked source, REDACT it in your report (first 4 chars + `***`), give file:line.
4. DO NOT start dev servers, run `npm run build`, run migrations, or hit any network/production URL. Read-only
   static analysis only. (Infra agent may run `tsc --noEmit --incremental false`, `eslint`, and `npm test`.)
5. Every finding needs concrete evidence: file path (+ line), function/component, route/API, table/model where
   applicable, and what the code actually does. No theoretical issues. Never call something "working" because code
   exists — trace it. If you cannot verify, write `NOT VERIFIED — REASON: ...`.
6. Distinguish: Confirmed issue / Potential issue / Missing implementation / Architectural concern / Improvement.
7. Severity: CRITICAL (security vuln, data leak, auth bypass, destructive bug, major prod failure), HIGH (major
   functionality broken, authz gap, significant business-logic/data-integrity problem), MEDIUM, LOW, INFO. Justify it.
8. Be exhaustive within your scope: enumerate every page/route/API/lib file in scope in your coverage table, and say
   which you actually read vs. skimmed vs. not reviewed. Do not stop after the first few issues. Do not assume
   similar files behave the same — many pages are copy-pasted with subtle differences; diff/grep for the deviations.
9. Do the SECOND PASS at the end for your scope: grep for TODO|FIXME|HACK|XXX, `console.log`, `debugger`,
   hardcoded ids/URLs/emails/phones/IPs, `localStorage`/`sessionStorage` use, `dangerouslySetInnerHTML`, `eval`,
   `fetch(`/`axios` call sites, `role`/`user_profile_id`/`sub_institute_id`/`syear`/`user_id` handling, raw
   `window.location` redirects, empty handlers / placeholder responses / mock data / `return []`. Report counts + the
   material hits (not every hit). Add anything material to your issue list.

## Frontend facts already established (verify, don't just trust)
- ~2477 tracked files; 680 `page.tsx`; 67 `route.ts` under `app/api`; 10 layouts; 248 files in `components/`;
  182 in `lib/`; 42 test files; 6 hooks; 2 contexts. No `middleware.ts` / `proxy.ts` exists (so no server-side route
  gating — confirm what does guard pages, likely client-side only).
- `.github/workflows/` is empty; no Dockerfile. `.env*` is gitignored except `.env.example`.
- Tenant key in this ecosystem is `sub_institute_id`; academic year is `syear`; role via `user_profile_id` (verify).
- Committed noise: `.kilo/`, `.agents/`, `.codex/`, `.claude/`, `g2g/`, `K-12 ERP Design System/`, `diff_frontend.txt`.

## Report format — write to `D:\lms_k12\AUDIT\parts\<your-part-name>.md`
Sections, in this order (use exact headings so the lead can merge):

### 1. Scope & coverage
Table: `| Area/dir | Files in scope | Read fully | Skimmed | Not reviewed | Notes |` + totals. List anything unreviewed.

### 2. Module inventory (your scope)
`| Module | Backend (Laravel controller/route or Next api) | Frontend pages/components | DB tables (if traced) | API endpoints | Permissions/roles | Menu entry | Status |`
Status one of: Complete / Mostly complete / Partially complete / Stub / Broken / Missing / Deprecated / Unknown-NOT VERIFIED.
Flag: backend-without-UI, UI-without-backend, menus/links pointing at missing pages, duplicate modules under different names.

### 3. Role / access-control findings (per module: frontend gating vs backend enforcement)
### 4. Tenant / school / academic-year scoping findings (is sub_institute_id / syear sent by client? trusted by server?)
### 5. API endpoints consumed or exposed (method, URL, auth, validation, notes) — table; full list, not a sample.
### 6. Business-logic notes (Input -> Validation -> Rule -> DB change -> Side effect -> Output) for the key flows
### 7. Test / documentation coverage for your scope
### 8. NOT VERIFIED items (each with reason)
### 9. Second-pass results (grep counts + material hits)
### 10. ISSUES
One block per issue, using a temporary ID `<PREFIX>-NN` (PREFIX given in your task; the lead will renumber to
LMS-AUDIT-XXX). Exact structure:

```
## <PREFIX>-NN
**Severity:** Critical|High|Medium|Low|Info   **Type:** Confirmed|Potential|Missing|Architectural|Improvement
**Category:** Security|Authorization|Backend|Frontend|Database|Business Logic|Performance|Testing|DevOps|Other
**Module:** ...
**Location:** exact/file/path.tsx:LINE   (and Laravel path if relevant)
**Function/Method:** ...
**Problem:** ...
**Evidence:** (quote the specific code / behaviour, short)
**Impact:** ...
**Expected Behavior:** ...
**Recommended Fix:** ...
**Verification:** ...
```
Group near-identical repeats (same bug on N pages) into ONE issue that lists every affected file — do not spam,
but do list all affected files. End the report with a one-line count: `ISSUE COUNTS: C=x H=x M=x L=x I=x`.

Be detailed. The lead is compiling a full audit deliverable from your reports; thin summaries are useless.
Your final chat message back to the lead should be short: the report path, issue counts, and the 5 most severe
findings in one line each.

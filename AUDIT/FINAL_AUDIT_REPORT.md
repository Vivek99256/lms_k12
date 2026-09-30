# LMS_K12 - FINAL AUDIT REPORT

**Scope:** `D:\lms_k12` (Next.js 16 / React 19 frontend + 67 Next route handlers) and the Laravel backend it depends on, `D:\next_lms_erp` (commit `0bd66fc3b`). **Method:** static analysis only - no application code modified, no server or database contacted, no `.env` file read (a permission classifier blocked it and the block was respected). Findings come from 12 specialised audit passes (Parts 01-12), two synthesis passes (module matrix, traceability matrix), a lead second pass and lead spot-verification; every finding cites file/line evidence in the per-part reports under `AUDIT/parts/`.

**Deliverables:** [00_REPOSITORY_INVENTORY.md](00_REPOSITORY_INVENTORY.md) · [01_COMPLETE_MODULE_INVENTORY.md](01_COMPLETE_MODULE_INVENTORY.md) · [02_ROLE_PERMISSION_MATRIX.md](02_ROLE_PERMISSION_MATRIX.md) · [03_AUTHENTICATION_AUDIT.md](03_AUTHENTICATION_AUDIT.md) · [04_TENANT_ISOLATION_AUDIT.md](04_TENANT_ISOLATION_AUDIT.md) · [05_API_AUDIT.md](05_API_AUDIT.md) · [06_DATABASE_AUDIT.md](06_DATABASE_AUDIT.md) · [07_FRONTEND_AUDIT.md](07_FRONTEND_AUDIT.md) · [08_MODULE_FUNCTIONAL_AUDIT.md](08_MODULE_FUNCTIONAL_AUDIT.md) · [09_SECURITY_AUDIT.md](09_SECURITY_AUDIT.md) · [10_PERFORMANCE_AUDIT.md](10_PERFORMANCE_AUDIT.md) · [11_ERROR_EDGE_CASE_AUDIT.md](11_ERROR_EDGE_CASE_AUDIT.md) · [12_ORPHAN_DEAD_CODE_AUDIT.md](12_ORPHAN_DEAD_CODE_AUDIT.md) · [13_TRACEABILITY_MATRIX.md](13_TRACEABILITY_MATRIX.md) · [14_MASTER_ISSUE_REGISTER.md](14_MASTER_ISSUE_REGISTER.md) · [15_PRIORITY_FIX_PLAN.md](15_PRIORITY_FIX_PLAN.md)

---

# 1. Executive Summary

**Bottom line: the application is not safe to run against real school data in its current form.** The problem is structural rather than a handful of bugs: authentication is optional on hundreds of Laravel routes, and where it exists the tenant, user and role that authorise a request are read from the request itself. The frontend then sends exactly those values from `localStorage` on every call.

| Severity | Unique issues | Raw findings |
|---|---:|---:|
| Critical | 53 | 68 |
| High | 149 | 181 |
| Medium | 177 | 208 |
| Low | 65 | 76 |
| Info | 10 | 12 |
| **Total** | **454** | **545** |

What matters most (all detailed in section 29 and [14_MASTER_ISSUE_REGISTER.md](14_MASTER_ISSUE_REGISTER.md)):

1. **Anonymous access to the database and admin functions, and a free token.** `GET /api/testkey` returns a validly signed JWT with no credentials, which every signature-only controller accepts (lead-verified, found in the second pass, LMS-AUDIT-053).  `GET /table_data` and `/lms_data` return any table (including `tbluser` with plaintext passwords) with no login - lead-verified (LMS-AUDIT-008). `POST /superAdmin-store` creates a platform super admin (LMS-AUDIT-046); `POST /api/menu-rights` and many other endpoints are unauthenticated **and** SQL-injectable (LMS-AUDIT-010, LMS-AUDIT-028, LMS-AUDIT-035, LMS-AUDIT-037, LMS-AUDIT-017).
2. **Roughly 90 Laravel API controllers (~378 routes) have no authentication at all; 46 more (~199 routes) accept any valid JWT but trust a client-supplied tenant** - a school-A token can read or delete school-B's students, fees, exams and payroll (LMS-AUDIT-009, LMS-AUDIT-048). The permission middleware is bypassed whenever a request carries `submit=Search` (lead-verified, LMS-AUDIT-003).
3. **Money:** four payment-gateway callbacks accept a forged "success" and issue a fee receipt (LMS-AUDIT-011); receipt numbers are `MAX+1` outside a transaction (LMS-AUDIT-115); refunds can exceed the amount paid (LMS-AUDIT-116); discounts/fines typed on the Next collect page are silently dropped (LMS-AUDIT-113).
4. **Marks and exams:** online-exam scoring trusts the browser and the answer key is sent to the client (LMS-AUDIT-073, LMS-AUDIT-089, LMS-AUDIT-090); the report-card action overwrites real attendance/percentage with zeros (LMS-AUDIT-078).
5. **The Next layer adds its own holes:** ~20-40 route handlers use a client-supplied header as the upstream host (SSRF and bearer-token exfiltration, LMS-AUDIT-001), the agent engine takes tenant/user from headers and lets the caller pick who answers "is this allowed" (LMS-AUDIT-002), and two LLM-spending endpoints are anonymous (LMS-AUDIT-056).
6. **Secrets and PII in git:** 22-24 committed `.kilo` files contain real student/enquiry names and phone numbers (LMS-AUDIT-059); 15 PHP scripts under the Laravel `public/` folder include `phpinfo()` and nine hard-code production DB passwords (LMS-AUDIT-015); a tracked `.env.bak-before-ai-provider` was found in the second pass and not read (LMS-AUDIT-201); 66 sensitive columns (passwords, OTPs, Aadhaar, API keys, bank numbers) sit in plaintext with no encrypted casts (LMS-AUDIT-049).
7. **No safety net:** zero tests on login, fees, admissions, attendance, marks, payroll or any route handler; no CI, Docker, health check or error tracking (LMS-AUDIT-054, LMS-AUDIT-228, LMS-AUDIT-233).

The good news: the **newly written** Laravel APIs (General setup, User management, ClassTeacher, TeacherTransfer, AcademicSetup) bind the tenant to the token and ask the server what the actor may do - they are the template to copy (LMS-AUDIT-445, LMS-AUDIT-452). Most P0 rows collapse into six root causes (section 30, "Wave 0-1"), so the fix is a small number of platform changes rather than 48 independent patches.

**Coverage caveat (read section 32):** this is not a line-by-line audit of a ~530K-line frontend and an 835-controller backend. Everything was machine-swept; a subset was read deeply. About 545 Laravel controllers and ~1,250 frontend files were not line-reviewed, so the register is a lower bound.

# 2. Repository Overview

| | lms_k12 (frontend) | next_lms_erp (backend) |
|---|---|---|
| Stack | Next.js 16.2.6, React 19.2.4, TypeScript, Tailwind 4, shadcn/base-ui, craft.js, tiptap, recharts + chart.js, AI SDK | Laravel (PHP), MySQL (remote), JWT + legacy session, MCP server, Neo4j (PAL coherence map) |
| Tracked files | 2,477 (2,071 source, ~531K LOC) | 6,114 |
| Pages / routes | 677 `page.tsx` (676 routable, 75 dynamic), 67 Next route handlers | 3,094 route declarations (≈5,453 expanded), 43 route files |
| Controllers / models / migrations | - | 835 / 474 / 1,084 |
| Tests | 42 files, 557 tests (555 pass, 2 fail) | 124 files (not run) |
| CI / deploy | none (`.github/workflows` empty, no Dockerfile) | not reviewed beyond config |

Full inventory with reviewed/remaining columns: [00_REPOSITORY_INVENTORY.md](00_REPOSITORY_INVENTORY.md). The frontend is a *client* of Laravel: it holds no model of the school; the tenant key is `sub_institute_id`, academic year `syear`, role via `user_profile_id`/`is_admin`.

# 3. Complete Module Inventory

Module families and their 24-question functional status are in [08_MODULE_FUNCTIONAL_AUDIT.md](08_MODULE_FUNCTIONAL_AUDIT.md). The per-area module inventories (Backend | Frontend | DB | API | Permissions | Menu | Status) are collected verbatim in [01_COMPLETE_MODULE_INVENTORY.md](01_COMPLETE_MODULE_INVENTORY.md). Machine-derived route facts (Part 09): 90 top-level `app/` directories; 80 orphan pages; 7 navigations to missing pages; 36 menu-mapper keys pointing at non-existent pages; 17 of 80 migration-seeded menu links resolving to no page; 47 frontend API calls with no matching Laravel route (43 real). Duplicate/parallel modules: `organization-management` vs `organization_managment` (two distinct features, the underscored one has no routeMapper entry), `/exam/*` vs `/result/*`, 12 hyphen/underscore hostel twins.

# 4. Architecture Overview

```
Browser (Next.js client pages, JWT + userData in localStorage)
   ├─ direct cross-origin calls ──────────────► Laravel (api.php / adminapi.php / teacherapi.php / resultapi.php / lms.php / pal*.php / mcp.php / web.php)
   ├─ same-origin relay  /api/proxy, /api/proxy-file ► Laravel  (open relay, JWT also copied into ?token=)
   └─ Next route handlers /api/{fees,dashboard,agents,ai,pal,mcp,import,integration-configs,...}
         └─ upstream host taken from header x-laravel-base-url (client-chosen)  ► Laravel
Laravel auth: six mechanisms (api.session, session, pal.auth, brain.auth, McpAuth, lms.auth soft mode)
Rights: check_permissions middleware keyed on route NAME == tblmenumaster.link (skipped when submit contains "Search")
Data: MySQL (827 tables created by migrations (Part 11); live schema drifts from migrations), Neo4j for coherence map
AI: Laravel owns the 12-stage assistant lifecycle + 97 MCP tools; Next holds one local Gemini key for field-edit and an anonymous SOP/screening pair
```

Key architectural concerns: (a) the trust model above; (b) three parallel transports and 60 independent session readers in the frontend (LMS-AUDIT-346, LMS-AUDIT-453); (c) no server-side gate in Next (LMS-AUDIT-204); (d) legacy Blade + new API controllers sharing state via a "hydrated session" so newer controllers can silently regress to client-trusted tenants (LMS-AUDIT-070); (e) JSON-file persistence for agents (LMS-AUDIT-206).

# 5. Role & Permission Audit

Full matrix and per-area findings: [02_ROLE_PERMISSION_MATRIX.md](02_ROLE_PERMISSION_MATRIX.md). Roles found in code: Student, Parent, Teacher/other staff, admin-tier profiles (Principal, Management, "parent_id=1" profiles), `is_admin=1` client admin, `is_admin=2` platform super admin (login hard-codes tenant/client sets for it). Live profile names and rights rows: **NOT VERIFIED** (remote DB). Effective rights are keyed on `user_profile_id` in the token, so profile changes are invisible until re-login. Authorization-related issues: **122**. Headline: menu hiding is cosmetic; the Result API (181-185 routes), Easy-com (36) and Organization-management (54) accept any valid token including a student's (LMS-AUDIT-004); the rights check is skipped on `submit=Search` and fails open when no menu row matches (LMS-AUDIT-003); any holder of add/edit on `add_user.index` can assign any profile (LMS-AUDIT-223).

# 6. Authentication Audit

Detail: [03_AUTHENTICATION_AUDIT.md](03_AUTHENTICATION_AUDIT.md). Plaintext password storage and a `plain_password` column (LMS-AUDIT-061); non-expiring, non-revocable JWTs stored in localStorage and duplicated in URLs (LMS-AUDIT-062, LMS-AUDIT-203); hard-coded OTP backdoor (LMS-AUDIT-069); no login throttling (LMS-AUDIT-063); reset-flow e-mail enumeration (LMS-AUDIT-217); Google sign-in cannot work (LMS-AUDIT-055); mobile WebView handoff never redeemed (LMS-AUDIT-071); every deploy signs all users out (LMS-AUDIT-212).

# 7. Tenant/Security Isolation Audit

Detail: [04_TENANT_ISOLATION_AUDIT.md](04_TENANT_ISOLATION_AUDIT.md). Tenant-scoping issues: **199**. Three tiers in Laravel: no auth (378 routes/90 controllers), JWT-valid-but-client-tenant (199 routes/46 controllers), token-bound (~100 routes, 59 with a rights check). No Eloquent global tenant scope in the reviewed models. Cross-tenant read/write confirmed by code reading in fees, students, attendance, exams/results, payroll, complaints, circulars, question papers and the module dashboards. Report-card and cancellation flows overwrite the JWT tenant with the request's.

# 8. Backend/API Audit

Detail: [05_API_AUDIT.md](05_API_AUDIT.md) (all 67 Next handlers, the 3,094-route inventory CSV, the 1,117 frontend-called paths). 2,315 route declarations carry route-level auth, 779 do not; only 3 routes are throttled; 270 declarations sit in neither the `api` nor `web` group; `lms.auth` and `perm:` middleware only log by default (LMS-AUDIT-173). Next handlers: header-controlled upstream (LMS-AUDIT-001), no rate limiting or body limits (LMS-AUDIT-227), seven response envelopes (LMS-AUDIT-386), three unused handlers.

# 9. Database Audit

Detail: [06_DATABASE_AUDIT.md](06_DATABASE_AUDIT.md). Static only - the live database was never contacted. 1,084 migration files create 827 distinct tables (Part 11's scripted count; BE-25's 708 was an undercount), 188 of them with no tenant column, 129 effective foreign keys in total and none on the fees/student/attendance/timetable/result/homework/hostel/inventory tables; the migrations cannot rebuild a database (LMS-AUDIT-179, LMS-AUDIT-184, LMS-AUDIT-182, LMS-AUDIT-049, LMS-AUDIT-350); the live schema drifts from migrations (memory: `tblstudent` has no `roll_no` live; 408 pending migrations would re-create live tables, so a bare `php artisan migrate` is unsafe). Plaintext credential columns (`plain_password`, `otp`), `cheque_no` integer holding gateway ids (LMS-AUDIT-310), `syear`/`academic_year`/`year` duplicated across tables, and no unique key on receipt numbers (LMS-AUDIT-115).

# 10. Frontend Audit

Detail: [07_FRONTEND_AUDIT.md](07_FRONTEND_AUDIT.md). 676 routable pages; 80 orphans; 62 dead files and 1,723 never-imported exports; 65 `dangerouslySetInnerHTML` sites + 15 `document.write` print windows; 494 ESLint errors / 290 warnings in tracked source; `tsc` clean apart from one stale-install error; 76 files >1,000 lines; 60 independent session readers; 22 currency helpers. Not verified: runtime console errors, accessibility, responsive behaviour (no browser was run).

# 11. Business Logic Audit

Per-area Input → Validation → Rule → DB change → Side effect → Output traces are in the per-part reports (section 6) and collected in [11_ERROR_EDGE_CASE_AUDIT.md](11_ERROR_EDGE_CASE_AUDIT.md). Highest-impact defects: fee collection (LMS-AUDIT-113, LMS-AUDIT-115, LMS-AUDIT-116, LMS-AUDIT-120), exam scoring/windows (LMS-AUDIT-073, LMS-AUDIT-074), report-card zeroing (LMS-AUDIT-078), rank forced to `term_id=149` (LMS-AUDIT-079), attendance dates/absent default (LMS-AUDIT-067, LMS-AUDIT-154), leave/payroll rules (LMS-AUDIT-163, LMS-AUDIT-165, LMS-AUDIT-166), inventory without a stock ledger (LMS-AUDIT-128), hostel double-booking (LMS-AUDIT-132), library with no fines (LMS-AUDIT-135), year rollover (LMS-AUDIT-139, LMS-AUDIT-142, LMS-AUDIT-144).

# 12. Security Audit

Detail: [09_SECURITY_AUDIT.md](09_SECURITY_AUDIT.md). Security/authorization issues: **202** (Critical 53, High 85). Confirmed classes: broken access control/IDOR everywhere; SQL injection (LMS-AUDIT-202 - 4,806 raw-SQL sites in 632 files, only a sample audited); SSRF (LMS-AUDIT-001); stored XSS via unsanitised HTML (LMS-AUDIT-060, LMS-AUDIT-379, LMS-AUDIT-080, LMS-AUDIT-172); CSRF disabled by host wildcards (LMS-AUDIT-057); unrestricted uploads into the web root (LMS-AUDIT-014, LMS-AUDIT-081, LMS-AUDIT-125); mass assignment (LMS-AUDIT-013, LMS-AUDIT-347); plaintext passwords; secrets in source. Not found / not present: `eval`/`new Function` (0), `window.location=` assignment (0), `postMessage` listeners (0 - the one `postMessage` is an outbound Flutter WebView channel).

# 13. Performance Audit

Detail: [10_PERFORMANCE_AUDIT.md](10_PERFORMANCE_AUDIT.md). Structural only (no profiling): unpaginated list endpoints (842 `->get()` vs 158 paginate/limit; `/table_data` returns whole tables), AI grading jobs run synchronously in the request (60-600 s, default `sync` queue), per-student heavy loops in fee list/defaulter, root layout forces dynamic rendering, two chart libraries, per-row request fan-out in PAL. Performance-related issues: 27.

# 14. Error & Edge Case Audit

Detail: [11_ERROR_EDGE_CASE_AUDIT.md](11_ERROR_EDGE_CASE_AUDIT.md). Error leakage (SQL text, paths, SMTP errors returned to clients, LMS-AUDIT-216); silent failures and fake successes (LMS-AUDIT-241, LMS-AUDIT-402, LMS-AUDIT-424); no transactions around multi-row writes (LMS-AUDIT-397); timezone-shifted dates (LMS-AUDIT-067); concurrency without locks (LMS-AUDIT-115, LMS-AUDIT-307); null/empty state handling largely absent for tenants without seeded data (LMS-AUDIT-252).

# 15. File Upload Audit

Full upload inventory (every `->move(`/`storeAs(` site classified by auth, validation, filename, disk and download authorization): [parts/part12-uploads-imports-notify-jobs-integrations.md](parts/part12-uploads-imports-notify-jobs-integrations.md) (Phase 13).

Confirmed from the domain reports: client-supplied extensions and names, no MIME/size validation and public web-served directories in fees, library, front desk, homework, H5P, visitor photos, petty-cash bills, staff documents and resumes (LMS-AUDIT-081, LMS-AUDIT-125, LMS-AUDIT-130, LMS-AUDIT-146, LMS-AUDIT-335, LMS-AUDIT-170, LMS-AUDIT-340, LMS-AUDIT-014); an anonymous zip-everything endpoint for staff documents (LMS-AUDIT-047); H5P export reads local files and fetches URLs (LMS-AUDIT-082); anonymous `/ckeditor` (LMS-AUDIT-014).

# 16. Import/Export Audit

Phase 14 detail is in Part 12. Confirmed: the import API has no role check and no table/column whitelist, so any authenticated student can write `tbluser`/`tblstudent` (LMS-AUDIT-064); uploaded spreadsheets remain in `public/import`; the Next import handlers are dead and drop the Authorization header (LMS-AUDIT-064); exports are client-side (jspdf/html2canvas, `lib/table-export.ts`) and build print HTML without escaping (LMS-AUDIT-379); export helper duplicates (LMS-AUDIT-306).

# 17. Notification Audit

Phase 15 detail is in Part 12. Confirmed: any student/parent/teacher token can send bulk SMS/WhatsApp/e-mail as the school (LMS-AUDIT-004); anonymous WhatsApp send (LMS-AUDIT-016); attendance notification only on same-day new rows and server-timezone dependent (LMS-AUDIT-333); TLS verification disabled for SMS/FCM calls (LMS-AUDIT-352); hard-coded FCM keys (LMS-AUDIT-176); the platform-services notification configuration is stored but no runtime consumes it (LMS-AUDIT-295). `app/Notifications` has 0 classes; sends are inline in controllers.

# 18. Jobs/Queues/Events Audit

Phase 16 detail is in Part 12. Laravel has 4 jobs, 1 event, 1 listener, 0 observers, 91 console files. With the default `sync` driver the four AI-grading jobs run inside the HTTP request (LMS-AUDIT-351). Scheduler, console-command and duplicate-execution details are in Part 12 where available; no tests for the anonymous API surface, permissions or payments are recorded (LMS-AUDIT-054).

# 19. Third-Party Integration Audit

Phase 17 detail table is in Part 12. Payment gateways: Razorpay verifies signatures; ICICI, ICICI-Orange, PayPhi and AggrePay do not (LMS-AUDIT-011); Axis has no replay guard; CCAvenue key hard-coded (LMS-AUDIT-121). LLM providers: Gemini/OpenRouter/DeepSeek called from anonymous Next routes (LMS-AUDIT-056); AI provider keys stored unencrypted and writable by any user (LMS-AUDIT-297, LMS-AUDIT-006); OpenRouter call with TLS verification off (LMS-AUDIT-243). n8n webhooks hard-coded (LMS-AUDIT-205). Google sign-in dead (LMS-AUDIT-055). A third-party Vercel iframe receives the tenant id (LMS-AUDIT-282). Neo4j auth is broken in the dev environment (memory) so the Coherence Map fails (LMS-AUDIT-270).

# 20. Testing Audit

Frontend: 42 test files under `lib/` and `packages/` (557 tests; 555 pass; 2 fail from AI-registry drift, LMS-AUDIT-211); all test pure helpers. **Zero** tests for login/session, fee collection, gateways, admissions, attendance, marks, timetable, payroll, import, the 67 handlers, the 248 components or any authorization/tenant rule (LMS-AUDIT-054). Laravel: 124 test files exist (76 Feature, 46 Unit), including RbacEnforcementTest, SessionMiddlewareAuthBypassTest and PAL/ESO authorization tests (lead-verified; an earlier agent statement that no test covers the rights middleware was overstated and is corrected here), but none references the `submit=Search` bypass, and none asserts the anonymous-route census, token-bound tenancy across controllers, leave/attendance or payments (LMS-AUDIT-054); they were not run. Full Critical Flow Test Coverage Matrix: [parts/part03-infra-config-tests-docs.md](parts/part03-infra-config-tests-docs.md) section 7.2.

# 21. Code Quality Audit

2 TODO/FIXME hits and 0 `debugger`/`eval` in the frontend; 35 `console.log` in 16 files; 307 `eslint-disable` in 209 files; 1 `@ts-ignore`; 76 files >1,000 lines and 286 >500; god components mixing fetch/state/render; near-identical copy-pasted page templates (Part 08 §2b) with drift; 9 duplicate UI primitives; hand-minified single-line write-flow components that cannot be reviewed (LMS-AUDIT-430); Laravel: 159 `dd(` in 96 files, 77 `die/exit`, 1,036 `print_r` in 168 files, 40 `$guarded=[]` models, 36 TLS-verify-off sites. Issues: LMS-AUDIT-230, LMS-AUDIT-234, LMS-AUDIT-390, LMS-AUDIT-380, LMS-AUDIT-431, LMS-AUDIT-432.

# 22. Configuration Audit

Full env inventory (code vs `.env.example`), dependency table and config review: [parts/part03-infra-config-tests-docs.md](parts/part03-infra-config-tests-docs.md) §5.2-5.4. Highlights: `.env.example` omits variables the code reads (`NEXT_GOOGLE_CLIENT_ID` is read in a client component and can never reach the browser, LMS-AUDIT-055); DEV/PROD API chosen by hostname on the client and `NODE_ENV` on the server so previews hit production (LMS-AUDIT-210); no security headers in `next.config.ts` (LMS-AUDIT-229); production URLs hard-coded (`erp.triz.co.in`, `dev.triz.co.in`, `apps.triz.co.in`, `crm.triz.co.in`, `n8n.triz.co.in`, a Vercel-hosted skill-ontology iframe). Backend: `JWT_TTL_MINUTES` unset by default (tokens never expire), `LMS_API_AUTH_ENFORCE` defaults false (permission gates warn-only). **NOT VERIFIED:** live values (never read).

# 23. Deployment Audit

No CI workflow, no Dockerfile, no deploy/rollback docs, no health endpoint for the web tier, no error tracking or monitoring (LMS-AUDIT-228, LMS-AUDIT-233); build id from git SHA clears every user's local storage on each deploy (LMS-AUDIT-212); root layout forces dynamic rendering (LMS-AUDIT-392); `execSync('git rev-parse')` in `next.config.ts` with a timestamp fallback; nested `.kilo/worktrees` copy of another branch in the tree is linted (LMS-AUDIT-391); Laravel: bare `php artisan migrate` unsafe with 408 pending stale migrations, `route:list` broken, 15 PHP scripts in `public/`.

# 24. Documentation Audit

`CLAUDE.md` is a copy of the design-system readme, not repo guidance, and cites root paths that do not exist (LMS-AUDIT-231); field-edit docs and `.env.example` say a local model is called but the route proxies Laravel (LMS-AUDIT-232); `docs/menu-data-source-audit.md` cites 54 menus and deleted files (87-90 top-level dirs exist); journey docs say Next 15 / 534 pages (repo: Next 16.2.6 / 677) (LMS-AUDIT-385); `docs/admin-user-journey.md` §8.4 calls `/api/menu-rights` "disclosure only" though it is SQL-injectable. Missing: install/env/deploy/architecture/role-permission/DB docs.

# 25. Cross-Module Consistency Audit

Full data: [parts/part09-data-consistency.md](parts/part09-data-consistency.md). 60 independent session readers (46 names), 6 spellings of the tenant id, 6 of academic year, 8 of role, 4 response envelopes (18 uses of one), 4 date locales, 22 currency helpers, "in progress" in 6 spellings, three academic-year resolvers that disagree (LMS-AUDIT-214), gender stored as `M/F/O` vs `Male/Female/Other` (LMS-AUDIT-324), six mastery definitions on different scales (LMS-AUDIT-255), four incompatible capability stores (LMS-AUDIT-291), three navigation sources (LMS-AUDIT-410). Issue: LMS-AUDIT-346, LMS-AUDIT-436.

# 26. Dead/Orphan Code Audit

Detail: [12_ORPHAN_DEAD_CODE_AUDIT.md](12_ORPHAN_DEAD_CODE_AUDIT.md). 62 dead files; 1,723 never-imported exports; 80 orphan pages; 32 unused `public/` assets; 7 Next handlers with no caller; `K-12 ERP Design System/**` (299 files) imported by nothing but type-checked; 21 G2G Assessment endpoints with no Laravel route (LMS-AUDIT-175); `fees` backend features with no UI (LMS-AUDIT-309); `hpbrain_*` tables read but never written (LMS-AUDIT-280); PAL intervention endpoints with no backend (LMS-AUDIT-260).

# 27. Requirement Gap Analysis

Status class per module family (Complete / Mostly complete / Partially complete / Stub / Broken / Missing / Deprecated / Unknown) is in [08_MODULE_FUNCTIONAL_AUDIT.md](08_MODULE_FUNCTIONAL_AUDIT.md) and per feature in [13_TRACEABILITY_MATRIX.md](13_TRACEABILITY_MATRIX.md). Stubs/broken confirmed by agents: quiz create/take (LMS-AUDIT-241), Attendance Regularization stub and hard-coded leave balance (LMS-AUDIT-339), integration-configs mock (LMS-AUDIT-007), Google login (LMS-AUDIT-055), Command Center assessment KPIs = 0 (LMS-AUDIT-098), Career Awareness static pages (LMS-AUDIT-276), Result "Print mobile" (LMS-AUDIT-078), online-exam tab posts every answer as narrative (LMS-AUDIT-076), 35 broken Result menu mappings (LMS-AUDIT-058).

# 28. Traceability Matrix

One row per important feature (Module | Feature | UI | Route | API | Controller | Service | Model | DB | Permission | Tenant Scope | Tests | Status): [13_TRACEABILITY_MATRIX.md](13_TRACEABILITY_MATRIX.md).

# 29. Master Issue Register

All 454 unique issues (545 raw) with full evidence blocks: [14_MASTER_ISSUE_REGISTER.md](14_MASTER_ISSUE_REGISTER.md). The 53 Critical issues:

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


# 30. Priority Fix Plan

Full P0-P3 tables with problem, location, why it matters, dependencies, fix, expected result and verification: [15_PRIORITY_FIX_PLAN.md](15_PRIORITY_FIX_PLAN.md). Order of attack: **Wave 0** (today) rotate/purge committed credentials, take anonymous data/admin endpoints offline, delete `public/*.php`, disable unsigned payment callbacks, purge `.kilo` PII, remove client-chosen upstream hosts. **Wave 1** one authentication + token-bound-tenant layer for every route, deny-by-default rights, SQL-injection programme, credentials model (hash-only, expiry, throttle). **Wave 2** fee/exam/payroll correctness. **Wave 3** CI, tests, HTML sanitising, headers, observability.

# 31. Items Not Verified

Every agent recorded what it could not verify and why; the union (≈131 entries; bullets and table rows) follows. Common reasons: live `.env` values never read; remote MySQL never contacted (menu/rights rows, live indexes, live column types, default student password); no server or browser run (exploitability, PHP execution in upload directories, accessibility, console errors); no network (`npm audit`/`composer audit`); business logic of ~545 unopened controllers.

### part01-auth-roles-menus


| Item | Reason |
|---|---|
| Live rows of `tblmenumaster`, `tblgroupwise_rights`, `tblindividual_rights`, `tbluserprofilemaster` (real menu tree, real role names, real grants per tenant) | DB host is remote; no DB access permitted. Hence "menus -> missing pages" for DB-defined links, and "pages not in any menu", could only be assessed for code-defined targets (see 8.1 below) |
| `JWT_TTL_MINUTES`, `JWT_SECRET` strength, `JWT_ALGO`, `LMS_API_AUTH_ENFORCE`, `CORS_ALLOWED_ORIGINS`, `APP_URL`, `NEXT_GOOGLE_CLIENT_ID`, `NEXT_PUBLIC_*` values, `SHOW_INTERNAL_ROADMAP` | `.env*` not readable by rule; defaults taken from code |
| Exploitability of AUTH-01 (LMS-AUDIT-010) (SQLi) and AUTH-04 (LMS-AUDIT-014) (upload -> PHP execution) | Not executed (no servers/requests allowed). SQLi is from code reading of string interpolation; upload execution depends on web-server handler config for `public/lms_editor_upload/` (`NOT VERIFIED`) |
| Per-method behaviour of the ~195 no-JWT API controllers and ~425 web-only routes | Scan is per controller file; many methods not opened. Some may authenticate through helpers I did not recognise |
| Whether the 641 request-reading controllers are reachable with a foreign tenant id on session-hydrated routes | Only `fees_audit_log_api_controller` and `feesReceiptBookMasterController` (safe: session first) sampled |
| Student self-data scoping (a student granted `student_fees_detail.index` etc. seeing only their own rows) | `tblstudentFeesDetailController` uses `$request->get('student_id')` in places; end-to-end not traced |
| Whether the K12 mobile app actually loads `lms_k12` in a WebView in production | Only the Laravel/Flutter-side comments say so |
| Whether `POST /forget-password` succeeds when called server-side from Next (CSRF, session) | `VerifyCsrfToken::$except` has no matching entry; not executed |
| Contents/behaviour of `app/user/*` pages other than `add_user` skim, `app/user_log/page.tsx`, `Level3Subheader`, `HeaderMenuSearch`, `menuSearch.ts`, `use-module-level3-nav.ts`, `app/organization-management/role-and-permissions` | Not read line by line |
| H5P and Library/Hostel legacy route enforcement | Not traced individually; assumed PERM family by route census |
| Whether my route dump script triggered any lazy DB connection in service providers | Cannot tell without server/DB logs |

8.1 Programmatic result for code-defined menu targets: 309 distinct `'/…'` targets in `app/data/routeMapper.ts` (+ `moduleDashboards.ts`, `DashboardShell`, `Header`, `Sidebar`, `Level3Subheader`, `module-routes.ts`, `lib/brain/navigation.ts`, roadmap registry) were matched against the 679 page routes (dynamic segments honoured): **31 targets have no page**, all in `RESULT_ROUTE_NAME_MAP` (AUTH-13 (LMS-AUDIT-058)). 20 static page routes are never referenced by any string in `app/`, `lib/`, `components/` (lower bound; substring match): `/Inventory/intelligence`, `/academic_setup/intelligence`, `/admin-services/visitor/intelligence`, `/easy_com/intelligence`, `/inward_outward/intelligence`, `/lms/homework/intelligence`, `/user/intelligence` (reached via synthetic Intelligence items or seeded category routes), `/ai/audit`, `/ai/usage-cost`, `/fees/{onboarding,process-builder,sop-task}`, `/teach-learn/{communication,help-guide-support,onboarding,operations,process-builder,reports}`, `/students/requests/new`. Most are reached through `fees_menu_categories.route` rows (DB) — cannot confirm.

---


### part02-next-api-routes


1. Live values of `NEXT_PUBLIC_AI_BASE_URL`, `AI_UPSTREAM_BASE_URL`, `QUESTION_ASSET_ORIGINS`, API keys - REASON: `.env*` not read. If `NEXT_PUBLIC_AI_BASE_URL` is set in production, the `baseUrl` override in `mcp/*` is neutralised (`resolveAiBaseUrl` gives the override precedence); all other `x-laravel-base-url` handlers are unaffected either way.
2. Hosting platform of the Next app (Vercel vs self-hosted) and its network reach - REASON: no deploy config in repo (`vercel.json` absent, no Dockerfile). Determines what an SSRF can reach (cloud metadata, VPC). Laravel CORS regex `lms-k12-*.vercel.app` suggests Vercel.
3. Whether `.data/agents.json` exists/has rows in any deployed environment - REASON: gitignored, not present in checkout.
4. Exploitability of upstream `redirect:'follow'` in `question-paper/asset` - REASON: needs an open redirect on an allow-listed host; not searched in Laravel.
5. Payment callbacks/webhook signature verification for HDFC, ICICI, ICICI-orange, Axis, AggrePay, PayPhi, HDFC-Razorpay - REASON: lives in Laravel `online_fees_collect_controller.php` (~3700 lines), outside this part; only Razorpay signature checks confirmed by grep.
6. Whether `public/import/*` files are reachable over HTTP in production - REASON: 13 real uploaded files exist under `D:\next_lms_erp\public\import` (gitignored), Laravel `public/` is normally the docroot; web server config not seen.
7. Runtime behaviour of `gemini-3.6-flash` default (see NAPI-20 (LMS-AUDIT-389)) - REASON: no network.
8. That `x-forwarded-host`/`host` in `app/pal/data/pal-content-model.ts:1126` is trusted by the hosting platform - REASON: platform config not seen.
9. Laravel `GET /api/pal/pedagogy-engine` and `/api/semantic-intelligence*` data sensitivity (tenant column?) - REASON: controllers not opened.

---


### part03-infra-config-tests-docs


| Item | Reason |
|---|---|
| Contents/keys of `.env`, `.env.local` and `.kilo/worktrees/paint-chevre/.env*` | Forbidden to read. Only confirmed untracked/ignored (`git check-ignore -v`). The nested worktree has its own copies (sizes 210 B and 1.6 KB seen in `ls`) |
| Live env values (which of `NEXT_PUBLIC_API_BASE_URL_*`, `NEXT_PUBLIC_AI_BASE_URL` are actually set in production) | No access |
| Production deployment platform, CI provider, hosting (Vercel is only implied by `VERCEL_GIT_COMMIT_SHA`, `public/vercel.svg` (unused create-next-app asset) and the `.vercel` ignore) | No config in repo |
| `npm audit` / known vulnerabilities of 953 lock entries | Network required |
| Whether Laravel re-validates `sub_institute_id`, `syear`, `user_id` against the JWT | Backend trace belongs to other parts |
| Full git-history secret scan | Limited to `git log --all -S`/`-G` for `AIza`, `sk-...` and `.env*`/`*.pem` paths: no hits. Not an entropy scan |
| Whether `.kilo/worktrees/paint-chevre` branch was ever pushed | `git branch -a` shows local branch `paint-chevre`; remote state not checked |
| Line-level review of 2,000+ source files and of 21 narrative docs | Out of scope; see section 1 |
| Behaviour of build (`next build`) and runtime | Forbidden to build/run |
| TypeScript checking of dot-directories (`.kilo/worktrees`) | tsc shows 1 error overall; skip behaviour not confirmed |

---


### part04-lms-h5p-exam


1. Live value of `LMS_API_AUTH_ENFORCE` (and whether prod logs show anonymous traffic) - REASON: `.env` not readable; only config default (`false`) seen.
2. Whether `tblmenumaster.link` stores route names (`marks_entry.index`) or paths (`result/marks_entry`) - REASON: no DB access; decides whether the 35 dead `RESULT_ROUTE_NAME_MAP` entries (LMS-27 (LMS-AUDIT-058)) bite and whether `check_permissions` protects resource sub-routes (LMS-32 (LMS-AUDIT-057)).
3. Whether `result_marks`/`lms_online_exam` carry unique keys preventing duplicate rows - REASON: migrations drift from live DB (memory `gotcha_student_schema_drift`).
4. Whether `students-marks` filter `m.standard_id` exists on `result_marks` (`MigrationModulesApiController::studentMarks`) - REASON: schema not inspected.
5. Whether PHP executes files under `public/h5p_content`, `storage/app/public/student|upload_result` on the production web server - REASON: no server config. Determines RCE vs. hosted-content impact of LMS-15 (LMS-AUDIT-081).
6. Whether DigitalOcean Spaces serves uploaded `.html/.svg` with an executable content-type on the public CDN - REASON: no bucket config.
7. Whether CSRF is actually bypassed for all web routes on the production host (full-URL wildcard entries in `VerifyCsrfToken::$except`) - REASON: static reading of `fullUrlIs/is` semantics; no runtime test.
8. Content of `H5PTextActivityController`, `H5PDragDropController`, `H5PMemoryGameController`, `H5PCoursePresentationController` sanitisation on save - REASON: not read; assumed same as base (no `strip_tags/purify` found by grep across `Http/Controllers/lms/h5p`).
9. Correctness of `RequireStaffRole` for parents whose profile names differ ("PARENT", "Parent Guardian") - REASON: tenant-authored free text; blocklist is exact `student|parent`.
10. Route-registration override semantics (later `Route::post('lms-assignment/...')` inside `api.session` groups replace earlier anonymous duplicates) - REASON: derived from Laravel `RouteCollection` behaviour (same method+URI key overwritten); not executed. If a route cache is stale the earlier anonymous route may still be live.
11. Rendering of the ~57 H5P pages and the 40 LMS pages beyond the sinks/endpoints listed - REASON: not read line by line (Section 1).
12. `app/api/proxy-file/route.ts` (not in scope files, unread) and PAL-owned endpoints reached by `pal/h5p` - REASON: other audit parts.

---


### part05-pal-ai-intelligence


### part06-fees-finance-operations


1. Live DB: whether `tblmenumaster` has rows whose `link` equals `fees_collect.store`, `fees_cancel.store`, `fees_config_master.store`, etc. (decides how broad FIN-14 (LMS-AUDIT-003) is). REASON: no DB access.
2. Live column types (`fees_collect.amount decimal(10,0)`, `cheque_no integer`, `receipt_no integer`) - migrations are known to drift from the real schema (memory note). REASON: migrations only; FIN-21 (LMS-AUDIT-302)/FIN-34 (LMS-AUDIT-310) are Potential.
3. Whether an external scheduler calls `razorpay_fetch_payment_status` / `createSplitPayout` / `getUTR`. REASON: no `app/Console` entry, server cron not visible.
4. Whether ICICI/PayPhi/AggrePay gateways sign responses in a field this code ignores (ICICI eazypay sends `RS`/signature; PayPhi `secureHash`). REASON: gateway docs not consulted; code verifiably does not check.
5. Real merchant secrets: values of `NEXT_PUBLIC_API_BASE_URL_*`, `CCAVENUE_ACCESS_CODE`, `.env*`. REASON: env files not readable by rule.
6. Whether the SQL-injection sinks are exploitable given DB user privileges / WAF. REASON: static only; injection into a `WHERE` (and `UNION` for reprint) is proven from code.
7. The `menu` -> `/fees/...` resolution for menus whose Laravel link has no Next page (list in section 2). REASON: menu rows not readable.
8. `app/fees/circulars/page.tsx` (1252 lines), master pages, NACH pages: request bodies were grepped, business rules not fully read.

9. Operations items (from sub-audits): live `tblmenumaster` links for inventory/hostel/transport/library/utility routes (decides whether rights ever apply); `JWT_HEADER_ONLY` env (if true all Library pages that send `token` in query/body break); web-server PHP execution for `public/uploads/books`, `public/storage/*`, `public/visitor_photo`, `public/images`, `public_path('pettycash')` (RCE vs stored XSS); unique indexes on `transport_map_student`, `hostel_room_allocation`, `inventory_item_receivable_details`; live `library_items.item_status` semantics; inward/outward NOT NULL columns and `CAST(x AS INT)` acceptance; `tblstudent.password`/`otp` columns; `studentTransferController.php:212` array update (assumed fatal); Excel-HTML `.xls` formula evaluation; `intelligence`/`ai-stack` screens; legacy Blade controllers; petty-cash balance/report logic; `MigrationModulePage` (bazar report render); `app/admin-services/*` visitor/front-desk/petty-cash pages.

---


### part07-students-admissions-attendance


| Item | Reason |
|---|---|
| Production CORS/CSRF behaviour for hosts other than those listed in `VerifyCsrfToken::$except` | Live `.env`/host list not readable; only static code |
| Whether `tblstudent_sub_institute_enrollment_no_unique` exists in live DB | Migration skips creation if duplicates exist; no DB access |
| Whether route names like `show_student_attendance`, `save_student_attendance`, `add_student.destroy`, `student_request.status` have `tblmenumaster` rows (decides whether `checkPermission` is enforced) | No DB access |
| Actual `DEFAULT_STUDENT_PASSWORD` value in production (`.env.example` ships it blank, `env('X','student')` then yields `''` if blank) | `.env` not read |
| Whether `JWT_TTL_MINUTES` is set in production (default 0 = tokens never expire, `ApiLoginController.php:~426`) | `.env` not read |
| Runtime behaviour of `CAST(... AS int)` in `admissionEnquiryController::get_enquiry_no` (MySQL does not accept `INT` in CAST) | DB engine/version unknown |
| Whether the Spaces bucket serves `public/student_document/*`, `public/parents_image/*`, `public/admission_payment/*` with `Content-Type` inferred from extension (stored XSS on HTML/SVG) | Bucket config unknown |
| `admission_division` null handling in `saveStudent` | Needs live data |
| PTM module backend (`ptm.php`, PtmController) | Not traced |
| Remaining unreviewed frontend components listed in section 1 | Time/size |
| Whether the `student/api/*` unauthenticated POST routes are reachable on hosts not in the CSRF exemption list | Depends on live host; on the exempted hosts they are reachable |

---


### part08-hr-org-tasks-general


| Item | Reason |
|---|---|
| Whether `tblmenumaster` rows exist for legacy payroll route names (`payroll_type.index`, `monthly_payroll.create`, ...) in any live tenant | Live DB not accessible; determines whether `check_permissions` protects payroll at all |
| Whether `public/import/`, `public/pettycash/`, `storage/app/public/{frontdesk,staff_document,compliance_library}` execute PHP or serve HTML in the deployed web server | Web-server config not in repo. Code confirms unvalidated extensions |
| Whether the DigitalOcean Spaces bucket serving `hp_resume`, `hp_staff_document` is public-read | Uploads use ACL `public` (`JobApplicationController.php:109`); bucket policy not visible |
| Runtime 405/404 for the payroll delete calls and 422 for "Save remark" | Servers not run; conclusions from route table/validator comparison |
| Student JWT reaching `/api/leave/*` etc. | `ApiLoginController.php:67` issues student sessions and `staff.only` is absent from these routes; no live token exercised |
| Live env values: `GEMINI_API_KEY`, `SCREENING_DEEPSEEK_API_KEY`, `OPENROUTER_API_KEY`, `NEXT_PUBLIC_*`, `services.n8n.task_webhook` | `.env` not read by rule |
| Remaining ~40 lines of `app/api/screenCandidate/route.ts` (post-prompt parsing) | Read to line 140 only; auth absence is visible before that point |
| `AttendanceReportApiController` authorization (day-detail, employees) | Not read; assumed same JWT-only trait |
| Talent Offer/Offboarding/Onboarding controllers beyond route + `RequiresTalentAdmin` usage | Not read line by line |
| Large presentational components listed in section 1 "Not reviewed" | Time; grep scanned only |
| Actual PT/ESIC slab values (`Helpers::getPT/getESIC`) | Not read |

---


### part09-route-api-orphans


| # | Item | Reason |
|---|---|---|
| 1 | Production tblmenumaster.link values | no DB access; only 80 seeded links in migrations were evaluated. Whether the 36 Result route-name keys and "54 seeded menus with nothing behind them" (source comment) occur in production is unknown. |
| 2 | LMS_API_AUTH_ENFORCE value in production | .env not readable; default in config/lms_content.php:144 is false so 18 SOFT routes are fail-open by default. |
| 3 | Which of the 135 "no route middleware, controller has token text" routes validate the token on every action | only class-level presence of JwtToken/Authorization text was tested; per-action check not read (e.g. ComplaintApiController.php:48, UserManagementApiController.php:20 validate; other controllers only mention it). |
| 4 | 28 dynamic / unknown-prefix Laravel path templates (`${path}`, `${module}${suffix}`, `${endpoint}`...) | built at runtime; listed in data-api-calls section 4. Literal callers in the same file/wrapper are verified individually. |
| 5 | Calls through unrecognised wrappers with slash-less legacy paths (e.g. hostel/api.ts `/api/proxy?path=hostel_master`) | no literal beginning with "/" or "api/" to match; modules with 0 detected calls in the module table are therefore "not detected", not "no calls". |
| 6 | HTTP method correctness | verified for 155 direct fetch() calls with literal option objects only; 9 apparent POST->PUT mismatches are almost certainly `_method` spoofing on resource routes. |
| 7 | Laravel routes generated at runtime by routes/custom_module.php (DB table custom_module_tables) | requires DB; 25 statically recorded. |
| 8 | Orphan pages that a production DB menu row points at | menus are DB-driven; "orphan" here means no reference in code/registries/mapper/rewrite. |
| 9 | Case-sensitive hosting behaviour on the real deployment | no deployment config in the repo (no Dockerfile/vercel.json); analysis is of route folder names and lookups only. |
| 10 | Behaviour of the 249 unauthenticated routes beyond sampled controllers | sampled 10 (FeesDashboard family, AdmissionsDashboard, StudentHomework, ApiQuestionPaper::destroy, ApiLmsCourse::deleteQuestionBank, AJAXController::lmsDataApi, cbse_1t5::save_result_html, PermissionsController, MenuRights, ComplaintApi); the rest classified by middleware + token-text only. |
| 11 | Whether Laravel `web`-group routes called with type=API (e.g. student.php `/student/api/*`) hydrate identity elsewhere | they carry no `session` middleware at route level; SessionMiddleware would hydrate from JWT for type=API, but these routes are not wrapped by it. |


### part10-laravel-backend-authz-tenant


| Item | Reason |
|---|---|
| Live `APP_ENV`, `APP_DEBUG`, `JWT_SECRET` strength, `JWT_ALGO`, `JWT_TTL_MINUTES`, `LMS_API_AUTH_ENFORCE`, `CORS_ALLOWED_ORIGINS`, `QUEUE_CONNECTION`, `SESSION_*` | `.env` off-limits. `.env.example` has `APP_ENV=local`, `APP_DEBUG=true`, `JWT_ALGO=` blank, no `JWT_TTL_MINUTES`, `CORS_ALLOWED_ORIGINS=` blank. Defaults in code: `api_auth_enforce=false`, `QUEUE_CONNECTION=sync`, `JWT_TTL_MINUTES=0` |
| Exploitability of each SQLi/RCE/SSRF item | static only; nothing executed |
| Whether the web server serves `public/*.php` scripts and `/lms_editor_upload`,`/pettycash`,`/import` as executable PHP | no vhost/nginx config in repo |
| Actual live schema (`sub_institute_id` columns, indexes, FKs, live triggers) | DB access forbidden; migrations are known-drifted (memory: 410 "pending", `tblstudent.roll_no` missing) |
| Whether legacy FCM server keys (Helper.php:1808–1818) are still valid | Google retired the legacy FCM HTTP API; keys are committed regardless |
| Which tenants use the DOB-OTP / `123456` mobile-app login | data-dependent |
| GenTux behaviour on `exp`, `alg`, clock leeway | vendor internals not read |
| Whether `/log-viewer` (opcodesio) is exposed | package present (`vendor/opcodesio/log-viewer`), no config/gate in repo; default is deny outside `local` |
| Per-controller effect of the `submit=Search` bypass | needs per-route reading of ~975 routes |
| Behaviour of the ≈545 controllers not opened; `Domain/AI`, `Brain/*` internals; 55 console commands | out of sampling |
| `route:list` correctness / true route count | tool broken; count = declarations |
| Neo4j-backed endpoints | separate known auth failure (memory) |

---


### part11-database


| Item | Reason |
|---|---|
| Live schema (all tables/columns/types), engines (InnoDB vs MyISAM), collations | no DB access; memory says live differs from migrations |
| Live indexes, whether `tblstudent_sub_institute_enrollment_no_unique`, `hpb_tbluser_email`, `hpb_tbluser_tenant`, `lb_points_*`, `hrms_departments_tenant_status_index` exist | need `SHOW INDEX` |
| Whether the 2026-08-21 triggers exist live and whether `sync_log` exists / its row count / PENDING backlog (Neo4j auth broken per memory) | no DB access |
| Server-side `sql_mode` (the `'strict' => false` setting is what Laravel sends; a server-global strict mode could still apply) | `.env`/server not readable |
| Presence of duplicate `(sub_institute_id, enrollment_no)`, duplicate `receipt_no`, duplicate attendance, duplicate e-mails | no data access |
| Which of 410 pending migrations are truly applied | `migrations` table not readable |
| Whether the 43 tables queried but not migrated exist live (`tblprofilewise_menu`, `sync_log`, `ai_models`, ...) | no DB access |
| Backups, PITR, replication, DB user privileges, encryption at rest / in transit | infra, not in repo |
| Query plans / performance | no EXPLAIN possible |
| Seeder bodies (9), `database/neo4j/*` | not reviewed |
| Index/column changes produced by loops over `const` arrays in migrations other than the 3 read manually | parser limitation (list candidates: `grep -l "const INDEXES\|addIndex" database/migrations`) |
| Frontend usage per table beyond literal path matching | heuristic |

How to close them (for someone with DB access): `mysqldump --no-data` diff against the CSV; `SELECT TABLE_NAME, COLUMN_NAME, COLUMN_TYPE FROM information_schema.COLUMNS`; `SELECT * FROM information_schema.STATISTICS`; `SHOW TRIGGERS`; `SELECT @@sql_mode`; duplicate-detection queries in section 10 (DB-05 (LMS-AUDIT-182)).

---


### part12-uploads-imports-notify-jobs-integrations


1. Whether the production web server executes PHP under `/storage/*`, `/import/`, `/pettycash/`, `/lms_editor_upload/`, `/images/` (RCE severity of every WEB/PUB upload) - REASON: no server config in repo.
2. Real values of `QUEUE_CONNECTION`, `FILESYSTEM_DISK`, `MAIL_*`, gateway credentials, `DO_SPACES_*` bucket policy/listing permission, CORS - REASON: `.env` not readable.
3. Whether `check_permissions` skips `unlink-file`, `transferDocs` etc. in production - depends on whether `tblmenumaster.link` contains those route names - REASON: no DB access (T1 result is a no-op if unmapped, which is what the code shows for unmapped names).
4. Whether `import_table_fields` exposes `sub_institute_id`/`is_admin` (irrelevant to exploitability because `process` does not consult it).
5. Whether `public/firebase/*.json` exists on the server (absent in checkout, not gitignored).
6. Whether the `storage:link` symlink and DO ACLs are as the code implies (bucket may be private with CDN rules).
7. Whether `failed_jobs`/`jobs` tables exist live (memory `gotcha_student_schema_drift`: migrations disagree with reality).
8. Runtime of `Excel::download`, PHPExcel behaviour on hostile xlsx (XXE) - REASON: no execution.
9. The Vercel deployment's body-size limit (INT-31 (LMS-AUDIT-373)) - REASON: hosting not confirmed from repo.
10. Whether `tblstudent.otp` is an int/string column and PDO native types (affects the `is_skip === 1` comparison in INT-12 (LMS-AUDIT-192)) - REASON: no DB.
11. Whether the two HuggingFace Spaces and the Cloud Run classifier are private/owned by the company - REASON: no network.
12. Contents of `tblmenumaster` rows for `import-data`, `easy_com/*`, `whatsapp-*` menus (who is granted them).



# 32. Final Audit Conclusions

1. The audit answers "what is implemented, broken, missing, insecure, unscoped or unused" for both repositories at the depth stated below. It does **not** claim the register is exhaustive: it is a lower bound, most reliable for cross-cutting patterns (which were swept mechanically) and least reliable for line-level business logic in unread files.
2. The dominant risk is the platform trust model, not any single module. Fix the six root causes in Waves 0-1 first; the majority of Critical/High rows close as a side effect.
3. Spot-verification by the lead confirmed the top claims that were re-checked: the anonymous `table_data`/`lms_data` route and handler, the `submit=Search` rights bypass at `checkPermission.php:76`, the middleware-free module dashboards at `routes/api.php:141-146`, the tracked PHP scripts under `public/`, 22 tracked `.kilo` state files, and `x-laravel-base-url` referenced in 33 frontend files. Everything else is agent-reported with file/line evidence.
4. **Concurrent remediation:** an uncommitted V1 API-guard change appeared on the Laravel repo during the audit (branch `v1-launch`, files dated 12:03-12:17). It is outside the audited baseline and was not verified. From reading its diff it protects an allow-list of `api/*` paths only (fail-open for unlisted routes, and web-group URLs like `/table_data`, `/superAdmin-store`, `/ckeditor` are outside its matcher), lists `crm-whatsapp` as public, and leaves `checkPermission`, payment callbacks and passwords untouched. The frontend working tree also had uncommitted edits by someone else (ConditionalApp, DashboardShell, Header, routeMapper, menuMappers, erp-client, roadmap); frontend evidence may partly reflect them, and Part 14 flags that /api/menu-rights and /api/academic-terms calls send no Authorization header yet match the new guard, a possible regression (not verified). Statuses in this report mean "open at baseline"; re-run the anonymous-route census after it merges.
5. The second pass (agent section-9 sweeps plus a lead repo-wide sweep) added 5 issues not found in the first pass (LMS-AUDIT-053, LMS-AUDIT-201, LMS-AUDIT-202, LMS-AUDIT-379, LMS-AUDIT-444) and confirmed the agents' counts.

## AUDIT COMPLETION STATUS

- **Repository coverage:** all 2,071 frontend source files machine-swept (routes, links, API calls, imports, second-pass patterns via TypeScript AST/regex); ≈820 (≈40%) line-reviewed (≈400 fully, ≈420 skimmed). Laravel: all 43 route files recorded, ≈40 controllers read fully and ≈250 classified by grep/script out of 835 (≈35% touched, ≈65% not opened).
- **Module coverage:** 100% of module families identified from menus, routes, APIs, tables and docs (see 08); depth varies by module and is stated in each part's coverage table.
- **Route/API coverage:** Next handlers 67/67 read fully; Laravel route declarations 3,094/3,094 recorded with route-level auth classification (controller-level checks for ≈290 controllers); frontend-called Laravel paths 1,117 analysed - 1,042 verified against routes, 28 dynamic NOT VERIFIED, 47 unmatched.
- **Frontend coverage:** see repository coverage; no runtime/browser verification (console errors, accessibility, responsive behaviour NOT VERIFIED).
- **Database coverage:** static migration/model analysis only (Part 11); live schema, indexes and data NOT VERIFIED.
- **Security coverage:** static code and configuration analysis of both repos across the OWASP categories; no dynamic testing, no dependency-vulnerability scan; raw-SQL surface sampled (≈4,806 sites, LMS-AUDIT-202).
- **Role/permission coverage:** role × module matrix derived from code and migrations; live profile/rights rows NOT VERIFIED.
- **Test coverage assessment:** 42 frontend test files (557 tests) cover pure helpers only; critical flows have zero tests; Laravel's 124 test files were not run.
- **Items not verified:** ≈131 entries (section 31).
- **Critical findings:** 53
- **High findings:** 149
- **Medium findings:** 177
- **Low findings:** 65 (+ 10 Info)

**Second-pass verification: COMPLETED.** **Status: AUDIT COMPLETE WITH DECLARED COVERAGE LIMITS** - this is a full-breadth, partial-depth audit, not a complete line-by-line review; the gaps are listed next and must not be read as "no issues".

### REMAINING UNREVIEWED AREAS

- ≈545 of 835 Laravel controllers were not opened (their routes are classified by route-level auth only); the Laravel Blade views (1,066 files) are out of scope.
- ≈1,250 frontend source files were not line-reviewed, notably: the largest presentational components in `app/hrit` (`performance-tabs` 2,867 lines, `mobility-center` 2,523 lines), `app/organization-management` (37 of 47 files), `app/task-management` (60 of 74), `app/h5p` (69 of 93), `app/lms` (44 of 96), `app/course-master` (22 of 35, incl. 6,719- and 3,117-line pages), `app/result` (16 of 27), `app/easy_com` (8 of 23), the per-module `ai-stack/` screens (~50), 16 `lib/*-ai-stack.ts` files, `components/intelligence`, `components/mobile-page-builder`, `components/domain`.
- `K-12 ERP Design System/` (298 of 299 files) and the journey/PROMPT docs.
- Runtime behaviour: nothing was run - no browser, no server, no database, no `npm audit`/`composer audit`, no Laravel test suite.
- Live configuration and data: `.env`, `.env.local`, remote MySQL rows, live menu/rights tables, live indexes, production headers/CORS.
- PTM backend, payment gateways other than Razorpay's callback handling (Laravel-only), Neo4j runtime behaviour.

A reasonable follow-up is a second wave targeted at the unopened controllers using the route-inventory CSV as a work list, plus a staging-environment dynamic test of the Wave 0 endpoints.

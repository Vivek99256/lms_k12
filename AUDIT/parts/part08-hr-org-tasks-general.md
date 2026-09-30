# Part 08 - HR / Org / Talent / Tasks / Admin-services / Easy-com / General / Import / Templates / Shared components

Audit scope: `D:\lms_k12` (frontend) traced into `D:\next_lms_erp` (Laravel). Read-only static analysis. Nothing was run.
Issue prefix: `HR`. Method: for each module I read the frontend API client, then the Laravel route, middleware, controller,
and (where I could) the model/helper it reaches, and compared what the UI gates with what the server enforces.

Reading depth in this report is stated honestly in section 1. About 180k lines are in scope; the HR/leave/payroll/attendance
chain, the org-management employee directory, the recruitment screening path, easy_com, import, document templates and
the admin config APIs were traced end to end. The very large presentational components (for example
`performance-tabs.tsx` 2867 lines, `mobility-center.tsx` 2523 lines) were grep-scanned only.

---

## 1. Scope & coverage

| Area/dir | Files in scope | Read fully | Skimmed | Not reviewed | Notes |
|---|---|---|---|---|---|
| app/hrit | 94 | 9 (`_lib/leave-api`, `payroll-api`, `use-monthly-payroll`, `use-attendance`, `attendance-regularization-api`, `payroll-shell`, `leave-configuration/page` head, `attendance-policy/page`, `leave-requests/page` partial) | 40 (grep + targeted ranges: drawers, use-leave, mappers, request-center) | 45 (attendance widgets/charts, dashboard cards, report sections) | Laravel side read fully for leave, payroll compute, attendance punch |
| app/talent-management | 66 | 2 (`recruitment-api` head/tail, `candidate-application-form` 120-297) | 14 (api clients via grep) | 50 (centers of 1000-2800 lines) | Laravel routes + Performance/Recruitment controllers sampled |
| app/organization-management | 47 | 0 fully | 10 (api clients, personal-info-tab, upload-doc-tab) | 37 | Laravel `EmployeeDirectoryController`, `RolePermissionsController`, Disciplinary/Compliance evidence read |
| app/organization_managment | 14 | 0 | 5 (api clients, ai-generation-drawer grep) | 9 (Department 2152 lines, org profile 1907 lines) | Confirmed distinct from hyphenated module, see 2 |
| app/task-management | 74 | 2 (`integration-management-api`, `my-tasks-api` head/createLegacyTask) | 12 | 60 | Laravel `Workspace`, `MyTasks`, `LegacyTask`, `DeadlineExtension`, middleware read |
| app/admin-services | 36 | 0 | 22 (`_lib/*`, page structure by grep) | 14 | Laravel Complaint/Consent/FrontDesk/PettyCash controllers checked for auth |
| app/general | 59 | 3 (`add_process/api.ts`, `task-publisher.ts`, `process-store.ts`) | 10 | 46 | Laravel GeneralSetup/Groupwise/Individual/MobileApp/CustomField/MobileDynamic controllers checked for auth |
| app/easy_com | 23 | 12 (`_lib/api.ts`, 10 page.tsx configs) | 3 | 8 | Laravel `easy_com/*` API controllers read (Base, SendSms, Whatsapp, SmsApiMaster) |
| app/document-templates + lib/document-templates | 6 | 0 | 2 | 4 | Laravel `DocumentTemplateApiController` read (context, merge-data) |
| app/import-data | 5 | 1 partial (`page.tsx` 60-290) | 1 | 3 | Laravel `ImportApiController` read fully |
| app/data, app/modules, app/lib, app/settings, app/page/layout/not-found | 15 | 3 (`routeMapper` grep, `layout`, `page`) | 4 | 8 | Menu registry checked against page existence |
| app/components, app/_components, app/_lib | 39 | 1 (`api_url.tsx`) | 6 | 32 | ChatbotPanel/AI-stack screens not reviewed (AI agent scope) |
| app/hooks, hooks, contexts (PageAiContext) | 8 | 2 (`usePermission`, `useMenuRights`) | 2 | 4 | |
| lib/process, lib/task-management | 13 | 0 | 2 | 11 | only test file in scope is `lib/process/conversion.test.ts` (not run) |
| components/document-template, mobile-page-builder | 55 | 1 (`merge.ts`) | 6 (XSS greps) | 48 | No `dangerouslySetInnerHTML` in either |
| components/domain | 64 | 0 | 1 (import graph) | 63 | Used by LMS routes; out of HR scope, import-checked only |
| components/ui, templates, search-dropdown, erp; services/organization; lib/gtg-org-data | 57 | 4 | 5 | 48 | Duplicate/dead analysis via import graph |
| **Totals (approx.)** | **~660** | **~40** | **~140** | **~480** | 180k lines total; see first paragraph |

Everything under "Not reviewed" was still covered by the second-pass greps in section 9.

---

## 2. Module inventory (your scope)

| Module | Backend (Laravel controller/route or Next api) | Frontend pages/components | DB tables (traced) | API endpoints | Permissions/roles | Menu entry | Status |
|---|---|---|---|---|---|---|---|
| HRIT Leave (dashboard, requests, reports, configuration) | `routes/api.php:914-963` -> `api\Leave\*` (8 controllers). No route middleware; JWT checked inside `ResolvesLeaveContext` | `app/hrit/leave-management/*`, `_lib/leave-api.ts`, `use-leave.ts` | `hrms_emp_leaves`, `hrms_leave_types`, `hrms_leave_allocation`, `hrms_holidays`, `hrms_weekdays`, `hrms_leave_workflow_settings` (model), role-permission table | 35 endpoints (section 5) | UI: only the Configuration page checks profile name (substring admin/hr). Server: none | `hrit.leave.*` (routeMapper:457-460) | Partially complete (UI works, policy not enforced) |
| HRIT Attendance (tracking, reports, regularization, policy, request center) | `routes/api.php` `attendance/*` -> `api\Attendance\*`; legacy `hrms-*` web routes for some reports | `app/hrit/attendance-management/*` | `hrms_attendances`, `hrms_emp_leaves`, `hrms_holidays`, `tbluser` roster columns | 17 | none server-side beyond JWT | `hrit.attendance.*` | Tracking/reports: Mostly complete. Regularization: **Stub (in-memory)**. Policy: **Stub (static text)**. Request Center: partial (leave real, regularization mock) |
| HRIT Payroll (type, salary structure, deduction, monthly, Form 16, salary certificate) | Legacy web routes `routes/hrms.php:24-121` -> `Payroll\PayrollController` (2660 lines), `session,menu,logRoute,check_permissions` with `type=API` | `app/hrit/payroll-management/*`, `payroll-api.ts` | `payroll_types`, `employee_salary_structures`, `hrms_emp_payroll_deduction`, `employee_monthly_salary_data`, `staff_document`, `hrms_salary_certificate` | 22 | UI: `isPayrollRole` (substring admin/hr). Server: `check_permissions` by legacy route name only | `hrit.payroll.*` + legacy `monthly_payroll_report.index` | Partially complete; delete actions Broken (HR-14) |
| Talent Management (dashboard, recruitment, onboarding, performance, compensation, mobility, offboarding, administration, employee profiles, certifications, development) | `routes/talent_management.php` (`api.session`+`staff.only`), `competency_management.php` | `app/talent-management/*` (37k lines) | `talent_job_postings`, `talent_job_applications`, `talent_screening_results`, performance_*, mobility_*, offboarding_*, onboarding_* | ~150 | Reads: any staff. Writes: `RequiresTalentAdmin` = `is_admin` 1/2 only | `talent.*` (routeMapper:485-499) | Mostly complete; Administration = read-only list (KPIs show "-"); **Compensation page is a duplicate of Performance page** |
| Organization Management (employee directory, roles & permissions, compliance, disciplinary) | `routes/organization_management.php` (`api.session` only) | `app/organization-management/*` | `tbluser`, `tbluserprofilemaster`, `tblgroupwise_rights`, `staff_document`, org_compliance_*, disciplinary_records | 45 | Role rights gated (admin). Everything else **ungated** | `org_mgmt.*` | Mostly complete; authz broken (HR-03, HR-16) |
| organization_managment (Department, Org profile) - **distinct module, not a duplicate** | `/api/departments-management*` (`departmentController`, JWT tenant), `/settings/organization_data`, `/api/ai-sop*` (unauthenticated) | `app/organization_managment/*` (10k lines) | `hrms_departments`, `hrms_job_titles`, SOP table | 14 | none | Reached via module-screen registry `/organization_managment/*`; **no routeMapper entry** (verified: grep of `app/data` empty) | Mostly complete |
| Task Management | `routes/task_management.php` (`api.session`+`staff.only`); bare `POST /task` (web.php:652, unauthenticated); `/table_data` | `app/task-management/*` | `task`, `task_projects`, `task_deadline_extensions`, `task_management_audit_logs`, notifications | ~85 | 4 report/permission routes have `task.permission`; the rest tenant-scoped only | `task_management.*` | Mostly complete; Integration admin = **Stub (in-memory Next route)** |
| Admin Services (visitor, front desk, complaint, consent, petty cash, PTM) | `api\{Complaint,Consent,FrontDesk,PettyCash}ApiController`, legacy `ptm/*`, `visitor_management/*` via `/api/proxy` | `app/admin-services/*` | `complaint`, `consent*`, `front_desk`, `petty_cash*`, ptm_* | ~40 | tenant from request (HR-07) | routeMapper:338-367 | Complete UI; authz broken |
| Easy Com | `routes/easycomapi.php` -> `api\easy_com\*` (`api.session`) | `app/easy_com/*` (config-driven) | `sms_api_details`, `smtp_details`, `whatapp_user_details`, `sms_sent_parents`, whatsapp_sent_messages | 39 | none beyond JWT | routeMapper:686+ | Complete UI; no role gate (HR-21) |
| General (add_process, fields_configuration, form_builder, groupwise/individual/mobile-app rights, implementation, mobile page builder, native dynamic pages, onboarding) | `GeneralSetupApiController`, `Groupwise/Individual/MobileAppMenuRights`, `CustomFieldApiController`, `MobilePageBuilderAdmin`, `requirements` (unauthenticated) | `app/general/*` | many | ~50 | Rights/config APIs correctly admin-gated (Info HR-36). `requirements` + `ai-sop` ungated | routeMapper (general) | add_process persistence = unauthenticated + global |
| Import Data | `routes/api.php:548-553` `api.session` -> `ImportApiController` | `app/import-data/*` | `import_table_fields`, `csv_data`, target tables | 4 | none | `/import-data` | Partially complete; match-fields Broken, no dedupe |
| Document Templates | `routes/api.php:863-879` -> `DocumentTemplateApiController` (no middleware) | `app/document-templates/*`, `components/document-template/*` | `document_templates` | 12 | none | `/document-templates` | Complete UI; authz broken (HR-02) |
| Shared components | - | `components/ui`, `ui/g2g`, `erp`, `search-dropdown`, `domain`, `templates` | - | - | - | - | See HR-33 |

Flags: **UI-without-backend**: attendance regularization + policy, task integration configs, talent admin KPIs (4 of 5). **Backend-without-UI**: `/api/leave/distribution`, `/api/attendance/*` dashboard endpoints partly. **Duplicate modules**: `Compensation` page = `PerformanceCenter`; `organization-management` vs `organization_managment` are separate features that share a near-identical name (confusion hazard, not duplicates); `employee-directory` API duplicates `UserManagementApiController` (`/api/users`) with none of its authorization.

### 2b. Copy-paste template clusters and deviations

| Cluster | Files | Verdict / deviations |
|---|---|---|
| easy_com send screens | 5 `send_*` page.tsx -> `EntryPage` config | Config driven, low risk. Deviations: email screen uses `selectionField: 'sendsms'` (matches backend `SendEmailParentsApiController.php:199`, naming only); WhatsApp posts `sendNotification[studentId]` (matches `:90`) |
| easy_com reports | 5 `*_report` -> `ReportPage` config | Consistent. `whatsapp_report`/`register_parent_report` omit `optionsPath`, deliberate |
| easy_com masters | `sms_api`, `smtp`, `whatsapp_api` + `manage_sms_api` | `sms_api/page.tsx` is a 1-line file, `manage_sms_api` is the real page (duplicate route, one is dead) |
| admin-services CRUD/report pages | 20 pages | All use `legacyRequest`/`requireSession`, all wrap in try/catch (grep: try=catch in every file). Only `consent-master`, `ptm-attended-status`, `ptm-report`, reports have no delete confirm, which is correct for those. No missing-auth-header deviation found |
| hrit payroll pages | 6 pages, all `PayrollPageShell` | Consistent gate. Deviation: `salary-certificate` and `form-16` go through `/table_data` (unauthenticated, HR-01) for employee pickers |
| hrit leave pages | dashboard/requests/reports/configuration | Only `leave-configuration/page.tsx:46` gates by role; requests page shows Bulk Approve/Reject to everyone (`leave-requests/page.tsx:461,464`) |
| task-management `*-api.ts` (8) | share `task-session.ts` transport | Consistent. Deviation: `my-tasks-api.ts` also uses a raw `legacyGet/legacyPostForm` (bare host, token in query) and `integration-management-api.ts` targets Next in-memory routes |
| talent `*-api.ts` (10) | Bearer header + `contextParams` | Consistent. `recruitment-api.ts:216` bypasses it with a raw n8n `fetch` |
| general `GeneralPage` configs | 5 pages (`template_management`, `user_profile_masters`, `bulk_upload`, `form_builder`, `coming-soon`) | 3-line wrappers; `bulk_upload` renders a generic page with no upload backend (see HR-25) |

---

## 3. Role / access-control findings (frontend gating vs backend enforcement)

| Module | Frontend gating | Backend enforcement | Gap |
|---|---|---|---|
| Leave | Configuration page: `includes('admin')||includes('hr')` on `menuContext.user_profile_name` (`leave-configuration/page.tsx:19-22`). Requests/dashboard: none; Approve/Reject/Bulk buttons visible to all | `ResolvesLeaveContext` validates JWT only. No role check in `decision`, `bulkDecision`, `destroy`, `store(employee_id)`, or any config endpoint. Workflow + role-permission settings are stored but never read by the decision path | Any authenticated JWT (including a student token, since `/api/leave/*` has no `staff.only`) can approve/reject/withdraw any leave, apply on behalf of anyone, and rewrite leave types/holidays/workflow. See HR-09 |
| Attendance | none | JWT only; `user_id`/`employee` from request body | Any user can punch or read another user's attendance. HR-11 |
| Payroll | `PayrollPageShell` substring gate | `check_permissions` middleware, which is fail-open when no `tblmenumaster.link` equals the route name (`checkPermission.php:36-44`); new `hrit.payroll.*` menu rows do not match route names | Rights assigned in Role & Permissions UI to hrit.* rows do not control the server. HR-24 |
| Talent | none in-page beyond menu | `staff.only` blocks student/parent; reads open to every staff profile; writes `is_admin` in {1,2} only | Teachers can read every employee's compensation revision, bonus and appraisal lists (`PerformanceCompensationController::index:44-88`). Tenant "HR Manager" (is_admin=0) cannot write. HR-17 |
| Org management | Role & permissions page only | `api.session` only (no `staff.only`) for employee directory, disciplinary, compliance. Role-rights writes correctly admin-gated (`RolePermissionsController::assertIsAdmin:52-68`) | HR-03, HR-16 |
| Task management | `canAdminister` toggles in Integration UI | tenant scope only. `task.permission` only on 4 read routes. Approve blocks only the literal profile "Employee" (`WorkspaceController::isEmployeeProfile:348`) | HR-22 |
| Admin services | none | JWT valid + request `sub_institute_id`/`user_id`; front desk "admin" = profile name ADMIN of the *request-supplied* user_id | HR-07 |
| Easy com | none | `api.session` only | HR-21 |
| General config APIs | n/a | Token/context match + profile + group/individual rights (Groupwise, Individual, MobileApp, CustomField, GeneralSetup, UserManagement) | Good pattern, HR-36 |
| Import | none | `api.session` only | HR-15 |
| Document templates | none | none (forgeable) | HR-02 |

---

## 4. Tenant / school / academic-year scoping findings

Client sends `sub_institute_id`, `syear`, `user_id`, `token` on nearly every call (`lib/erp-client.ts buildSessionContext`, values come from `localStorage.userData/menuContext/sessionData`, `erp-client.ts:75-160`). The question is whether the server trusts them.

| Module | Tenant source on server | Verdict |
|---|---|---|
| Leave, Attendance | Tenant from verified JWT (`ResolvesLeaveContext.php:43-46`, G-SEC-29). **`user_id` and `syear` from request** | Tenant safe. Identity spoofable (HR-09, HR-11). `syear` only picks the date window |
| Payroll (legacy) | Session hydrated from JWT, **but controllers overwrite with `$request->sub_institute_id` whenever `type=API`** (`PayrollController.php:47,91,218,272,536,571,657,675,778,980,1172,1590,1763,1908,1934`) | Cross-tenant read/write/delete (HR-06) |
| Employee directory, disciplinary, compliance, task management, talent, easy_com | Session from JWT (`ApiSessionHydrator`), `tenant()` reads session | Tenant scoping OK for reads. But employee directory `buildAttributeArray` lets the request override `sub_institute_id` (HR-03). Task assignee and screening `candidate_id` not tenant-validated (HR-19, HR-22) |
| Complaint, Consent, Front desk, Petty cash | `validateContext` requires `sub_institute_id` in request; JWT only checked for validity, payload tenant never compared (`ComplaintApiController.php:48-70`, `PettyCashApiController.php:44-66`) | Any valid token can address any school (HR-07) |
| Document templates | `claims` decoded **without signature verification**, falls back to `$request->input('sub_institute_id')` (`DocumentTemplateApiController.php:61-92`) | Fully client controlled (HR-02) |
| `/table_data`, `/lms_data`, `/task`, `requirements`, `ai-sop`, `menu-rights` | request-supplied or none | Unauthenticated (HR-01, HR-05, HR-08) |
| Import | session tenant for inserts; `csv_data` rows have no tenant column | any user can process/match another school's uploaded CSV by id (HR-15) |
| add_process | sends `sub_institute_id: "0"` (`general/add_process/api.ts:19`), so all schools share the same global rows | design flaw plus unauthenticated resource controller (HR-08) |
| Task assign | `TASK_ALLOCATED_TO` validated as integer only (`LegacyTaskController.php:75`), tasks/notifications can target users of other tenants | HR-22 |
| Academic year | `syear` from `selectedAcademicYear` localStorage validated against session years (`erp-client.ts:100-118`). Leave year window comes from `academic_year` MIN/MAX. Requests that straddle the boundary disappear (HR-10). Payroll uses financial-year logic (Jan-Mar => year+1) inconsistently between create and store (HR-12) |

---

## 5. API endpoints consumed or exposed

Auth column: `J` = JWT verified in controller, `AS` = `api.session` middleware (JWT -> session), `AS+S` = `api.session`+`staff.only`, `W` = legacy `session,menu,logRoute,check_permissions` (JWT hydrate when `type=API`), `NONE` = no authentication, `FORGE` = token decoded without verification.

### 5.1 Leave (`/api/leave/*`, J via `token` input; tenant from JWT, user from request)
| Method | URL | Validation / notes |
|---|---|---|
| GET | /leave/dashboard, /trend, /department-summary, /type-distribution, /holidays/upcoming | read only; KPIs are tenant-wide |
| GET | /leave/options | returns **all** tenant employees + departments + leave types to any caller |
| GET | /leave/balances | `employee_id` from request; balances of anyone |
| GET | /leave/requests | server-side filter/paginate (`per_page<=200`); returns email + mobile of every requester (`LeaveRequestApiController.php:60-77`) |
| GET | /leave/requests/{id} | any request in tenant, incl. reasons and balances |
| POST | /leave/requests | `employee_id` optional (apply for anyone), `user_id` from request; upsert of same-day pending row; no balance/overlap/holiday check |
| POST | /leave/requests/{id}/decision | status in approved,rejected,sent_back,cancelled,approved_lwp; no role/self check; overwrites any current status |
| POST | /leave/requests/bulk-decision | same, transactional |
| DELETE | /leave/requests/{id} | soft delete; only pending; **no ownership check** |
| GET | /leave/reports/summary, /register, /balance | tenant-wide, any caller |
| GET/POST/PUT/PATCH/DELETE | /leave/leave-types[/{id}[/status]] | tenant-scoped writes, no role |
| GET/POST/PUT/DELETE | /leave/holidays[/{id}] | duplicate check only on `from_date` (blocks per-department holidays on same day) |
| GET/POST | /leave/weekdays | weekly-off pattern; **not consulted by payroll** |
| GET/PUT | /leave/workflow, /leave/roles | persisted only; never enforced |
| GET | /leave/distribution | unused by this scope |

### 5.2 Attendance (J; tenant from JWT; `user_id`/`employee` from request)
GET `/attendance/my-attendance`, POST `/attendance/punch-in`, POST `/attendance/punch-out`, GET `/attendance/report-filters`, `/employees`, `/day-detail`, `/latest-activity-date`, `/weekly-summary`, `/kpi`. Legacy web calls: `/departmentwise-attendance-report/create`, `/show-early-going-hrms-attendance-report`, `/attendance-weekly`, `/KPI-HRITDashboard`, `/employee-attendance-monthly-report`, `/leave-distribution`, `/jobroles-by-department`. Frontend also references `/attendance`, `/attendance/check-in`, `/attendance/check-out` (older paths; NOT VERIFIED whether still used).

### 5.3 Payroll (legacy web routes, `W`; frontend sends token+context in query string or FormData)
| Method (frontend) | Path | Server route | Note |
|---|---|---|---|
| GET | /payroll-type | GET | ok |
| POST | /payroll-type/store | POST | upsert; `PayrollType::find($request->id)` unscoped; tenant from request under API |
| **POST** | /payroll-type/destroy/{id} | **DELETE only** (`hrms.php:31`) | mismatch -> 405 (HR-14) |
| GET/POST | /employee-salary-structure(/store) | GET,POST | ok |
| POST | /rollover-employee-salary-structure/store | POST | ok |
| GET/POST | /payroll-deduction(/store) | GET,POST | ok |
| GET | /monthly-payroll/create | GET | SQLi + client `user_profile_name` |
| GET | /getMonthlyData | GET | uses session tenant |
| POST | /monthly-payroll-store | POST | stores client totals verbatim |
| **POST** | /monthly-payroll-delete/{month} | route is `/monthly-payroll-delete` (`hrms.php:118`) | 404 (HR-14); backend delete is unscoped |
| POST | /form16-report | POST | |
| GET/POST | /hrms-salary-certificate, /hrms-salary-certificate-report | GET,POST | |
| GET | /salary-certificate-pdf-download, /monthly-payroll-report/pdf/{id}/{month}/{year} | GET | token in URL; `id` reaches raw SQL (`PayrollController.php:1421`) |
| GET | /api/departments-management | J | |
| GET | **/table_data** | **NONE** | HR-01 |

### 5.4 Talent Management (AS+S; tenant from session). Complete route list from `routes/talent_management.php`
Recruitment: GET/POST/PUT/DELETE `job-postings[/{id}]`, GET `talent/team-overview`, POST `gemini/analyze-jd`, GET/POST/PUT `job-applications[/{id}]`, GET `job-applications/shortlisted`, `job-applications/candidate/{id}`, POST `job-applications/{id}/status`, GET `candidate`, `candidate-pipeline`, GET/POST/PUT `interview-details`, `interview-schedules[/{id}]`, GET `positions`, `interviewers`, POST `interviews/{id}/decision`, `interview-panel/{list,users,store,update/{id},delete/{id}}`, POST/GET/PUT/DELETE `evaluation`, `feedback[/{id}]`, GET `pending-feedback`, POST `talent-screening-results`, GET `talent-screening-results/candidate/{id}`, GET `offers`, POST `talent-offers`, `talent-offers/{id}/reject`, GET `talent-offer-letter/{id}`, `talent-templates`, POST `talent-acquisition/{kpis,dropoff,funnel,requisitions}`. Dashboard: GET `talent/dashboard`, `talent/dashboard/filters`.
Onboarding (`onboarding/*`): overview, filters, journeys CRUD + `from-offer/{id}`, stages (list/update/complete), contacts, timeline, workstreams, tasks (CRUD, bulk, complete), documents, notes, probation (get/update/confirm/extend/terminate).
Performance (`performance/*`): overview, filters, team-comparison, timeline, cycles CRUD+launch+close, reviews (board, bulk, CRUD, advance, reminder, notes, attachments), activity, goals, appraisals (bulk, CRUD, decision), compensation (bulk, CRUD, decision), bonus (bulk, CRUD, decision), calibration-sessions (CRUD, grid, calibrate, lock), saved-views.
Mobility (`mobility/*`): overview, filters, jobs, applications, transfers, promotions, successions, pools (+members). Offboarding (`offboarding/*`): overview, filters, cases (CRUD, status, clearance, documents, comments, exit-interview). Administration: GET `talent/admin/workflows`. Competency routes (`competency_management.php`) for employee profiles, certifications, development plans, career paths, learning assignments (not enumerated line by line).
External: GET `https://n8n.triz.co.in/ff441ace-...` (job posting webhook, unauthenticated, HR-29). Next: POST `/api/screenCandidate` (unauthenticated, HR-18).

### 5.5 Organization Management (AS only)
GET/POST/PUT/DELETE `organization-management/compliance-library[/{id}]` + `/dashboard,/calendar,/my,/overdue`, `/categories[/{id}]`, `/templates[/{id}[/duplicate]]`, `/evidence/{id}/{verify,reject}`, DELETE `/evidence/{id}`, GET/POST `/{id}/evidence`, POST `/{id}/complete`; `disciplinary-library[/{id}]`, `/departments/{d}/employees`; `employee-directory` GET/POST, `/teachers`, `/reference-data`, POST `/create`, GET/PUT/DELETE `/{id}`, PATCH `/{id}/status`, POST `/{id}/invite`, POST `/{id}/documents`, GET `/{id}/competency-profile`, PUT `/{id}/skills/{matrixId}`, `/analytics/{kpis,growth,growth-stacked,departments-distribution,job-roles-distribution,lifecycle,attrition,skills-matrix}`; `role-permissions/roles`, `/roles/{id}/rights` (admin-gated writes). Department (`/api/departments-management*`, J, tenant from JWT, no role) and `/api/ai-sop*` (NONE).

### 5.6 Task Management (AS+S)
Full list read from `routes/task_management.php:113-215` (82 routes): session, permissions*, statuses CRUD, priorities CRUD, integrations*, assignment-capacity, legacy-tasks (store, idempotent, PUT, versioned, DELETE), notifications, tasks, search, templates, reports/productivity*, reports/delays*, audit-logs, audit-logs/export, workspace (list, workload, show, activity, PUT, DELETE, approval, comments, time-entries, subtasks, recurrence, schedule, attachments + versions), deadline-extensions (+decision), dependencies CRUD, milestones CRUD, my-tasks (+status), projects (CRUD, archive, members, tasks, workstreams). `*` = `task.permission:report.view`. Also `deadline-extension`, `bulk-task/import`, `user-skills/{id}`, `competency/library/jobrole-tasks`, `competency/task-map[/for-task]`. Bare host: **POST `/task` (NONE)**, GET `/getSupervisor`, GET `/table_data` (NONE), `/gemini_chat`, `/search_data`, `/user/add_user/{id}/edit`. Next: `/api/integration-configs[/{id}|/test]` (HR-20).

### 5.7 Admin Services, Easy Com, General, Import, Templates
| Group | Endpoints | Auth |
|---|---|---|
| Complaint | GET/POST `api/complaints`, POST `/{id}`, `/{id}/delete` | J, tenant/user from request |
| Consent | GET `api/consents`, `/students`, POST `api/consents`, `/delete` | J, tenant from request |
| Front desk | GET `api/front-desk`, `/report`, `/{id}`; POST create/update/delete | J, tenant+user from request |
| Petty cash | `api/petty-cash[/heads][/{id}][/delete]`, `/report` | J, tenant from request |
| PTM / Visitor | `ptm/add_ptm_time_slot_master`, `ptm/add_ptm_attened_status`, `ptm/ptm_report`, `visitor_management/add_visitor_master`, `get_adminVisitorListAPI`, `get_adminStudentList`, `get_adminTeacherList` via `/api/proxy` | W / adminapi |
| Easy com | `easy_com/`: `sms-api`, `smtp`(+`/test`), `whatsapp-api` CRUD; `send-sms-parents`, `send-sms-staff`, `send-notification-parents`, `send-whatsapp-parents`, `send-email-parents` (+`recipients`/`groups`/`options`); `reports/{sms,email,notification,register-parent,whatsapp}` | AS |
| General | `general-setup/{module}`, `groupwise-rights`, `individual-rights`, `mobile-app-rights`, `fields-configuration`, `mobile-page-builder/*`, `mobile/dynamic-page-admin/*`, `onboarding/*` | J/AS with rights checks (good) |
| add_process | `requirements` resource (GET list/POST/PUT/DELETE/edit), `customers_requirement`, `api/ai-sop`, `ai-sop/department-job-roles`, `ai-sop/generate`, `ai-sop/store` | **NONE** |
| Import | `api/import/{tables,parse,process,match-fields}` | AS |
| Templates | `document-templates` list/show/store/update/delete/duplicate/versions/restore/merge-fields/merge-data/preview-students | **FORGE/NONE** |
| Menu | `POST /api/menu-rights` | **NONE** |

---

## 6. Business-logic notes

### 6.1 Leave apply -> approve -> balance
Input (`LeaveApplyDrawer`): leave type, full/half, from/to, slot, comment, optional employee. -> `POST /api/leave/requests`.
Validation (`LeaveRequestApiController.php:153-164`): type exists (any tenant), dates valid, `to>=from`, comment <=255. **Not validated**: leave type belongs to tenant, employee belongs to tenant (`exists:tbluser,id` unscoped), date overlap with existing leave, past dates, holiday/weekly-off, balance, probation.
Rule: `day_type` stored as `'1'`/`'0.5'`; days = `diffInDays+1` calendar days times day_type (`Helper.php:2834-2858` with `skipday=''`), so weekends and holidays count against balance. Balance = entitlement (allocation table, capped 180) minus (approved + pending + LWP bucket) (`LeaveAnalyticsService.php:28,100-127,170-215`); `remaining` can go negative because nothing checks it.
DB change: insert/upsert `hrms_emp_leaves` status `pending`; decision overwrites `status`, `approved_by` (a display name string), `hod_comment`, `hr_remarks`.
Side effects: none (no notification, no workflow escalation, no balance ledger).
Status transitions: any of approved/rejected/sent_back/cancelled/approved_lwp from any state (approved -> rejected -> approved). `pending` is not accepted, which breaks the drawer's "Save remark" button (HR-14).
Output: list/dashboard filtered to requests fully inside the leave year (`from>=start AND to<=end`, `LeaveAnalyticsService.php:109-110`), so a request that spans year end is invisible in every list and report.

### 6.2 Attendance -> payroll linkage
`GET /getTotalDays` (also called internally by `monthlyPayrollCreate`): counts a day present if any `hrms_attendances` row exists (no minimum hours, no punch-out requirement) on non-Sundays; adds approved **and pending** leave days; treats Sunday as the only weekly off (ignores `hrms_weekdays` configured in Leave settings and per-employee rosters used by the attendance API); holidays counted only when `FIND_IN_SET(department_id, department)` matches, so institute-wide holidays (stored with `department=''`, `HolidayApiController.php:331`) are ignored; holidays spanning a month edge are dropped (`whereBetween` on both dates); leave query has no `deleted_at` filter so withdrawn requests still pay (`PayrollController.php:2449-2457`); sandwich rule and Saturday-late deduction are heuristic (`:2598-2659`); result forced to 0 if no attendance, leave or LWP.

### 6.3 Monthly payroll compute and save
`getEmpMonthlyData` (server) prorates each component by `daysInMonth`, applies PF/PT/ESIC using **payroll type names** ("BASIC","GRADE PAY","D.A","HRA","OTHER ALLOW","PF","PT","ESIC"), a hardcoded `Feb -> PT = 300` for `payroll_type id == 2`, PF cap 1800 when base < 15000, `Helpers::getPT/getESIC` slabs. The UI can override `totalDay` and re-ask the server (good), but on save `monthlyPayrollStore` writes the client's `total_deduction`, `total_payment`, `payrollHead` verbatim (`PayrollController.php:2197-2220`) with no recompute. Insert-only (no update), so a wrong row must be deleted to redo; delete route is broken (HR-14) and unscoped by tenant.

### 6.4 Recruitment screening
Form -> `POST /job-applications` (multipart resume, pdf/doc/docx 5MB) -> browser then calls Next `/api/screenCandidate` with name, email, mobile, location, experience, education, skills -> LLM (DeepSeek/OpenRouter/Gemini per env) -> browser computes `overall_fit_score = competency_match`, `ranking_score = round(0.95*competency_match)`, fabricates a `reasoning` sentence, and `POST /talent-screening-results` stores what the browser sent. Behavioural traits and competency levels sent to the model are hardcoded constants (`candidate-application-form.tsx:150-157`). Failure path stores nothing (silent).

### 6.5 Task assign/approve
`POST /task` (legacy, unauthenticated) mass-inserts into `task` for each assignee; `PATCH workspace/{id}/approval` requires status COMPLETED and only blocks the literal "Employee" profile; `deadline-extensions/{id}/decision` has no approver check so the requester can approve their own extension and the task due date is rewritten (`DeadlineExtensionController.php:110-160`).

### 6.6 Communication send
Select class -> `recipients` (validated against `SearchStudent`) -> `send` loops numbers, calls gateway URL built from stored `url+pram+mobile_var+mobile+text_var+urlencode(text)+last_var` via cURL with SSL verification disabled (`send_sms_parents_controller.php:131-141`), ignores the gateway response body, logs "sent" if cURL did not error. WhatsApp: hardcoded country code `91`, `usleep(300000)` per recipient inside the HTTP request, student ids not constrained to the selected class. No template approval, per-user quota, or rate limit (only global `throttle:1000,1`).

### 6.7 Import
`parse` stores file in `public/import/<tenant>_<syear>_<5 digits>.<ext>` (never deleted) and the rows JSON in `csv_data`; `match-fields` (frontend calls it with a different contract than the backend expects); `process` inserts row by row without a transaction, column names come from the client, only `tbluser`, `result_personalize_marks`, `fees_collect`, `tblstudent`, `result_marks` have logic (other tables return "Import completed" with 0 rows); `successCount = total - failed` even when skipped/no-op.

---

## 7. Test / documentation coverage for your scope

- Frontend: only `lib/process/conversion.test.ts` (674 lines) is in scope; nothing for hrit, talent, task, org, easy_com, import, templates, admin-services. Not run (infra agent owns test execution).
- Laravel: `tests/` has no leave, payroll, talent, task, organization, easy_com, import, or document-template feature tests (only AI attendance agent tests and a `DocumentTemplateCategoryTest`). The leave and payroll rules in 6.1-6.3 are unprotected.
- Docs: `docs/admin-user-journey.md` and `docs/menu-data-source-audit.md` describe the two organization modules accurately; code comments (`erp-client`, payroll and leave clients) are thorough but several assert protections that do not exist (see HR-01 "this route 401s for an anonymous caller").

---

## 8. NOT VERIFIED items

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

## 9. Second-pass results (scope: hrit, talent, org x2, task, admin-services, general, easy_com, templates, import, app/{data,modules,components,_components,_lib,lib,hooks}, lib/{process,task-management,document-templates}, components/{document-template,mobile-page-builder,domain,ui,templates,search-dropdown,erp}, hooks, PageAiContext)

| Pattern | Count | Material hits |
|---|---|---|
| TODO/FIXME/HACK/XXX | 0 | - |
| `console.log/debug` | 8 | `attendance-reports/page.tsx:614,618,622` (Export/Print/Save are stubs that only log), `RecentLeaveRequests.tsx:102` ("View" is a log), `oragnization_profile/page.tsx:539,542` (logs full session and record), `Sidebar.tsx:113`, `Toolbox.tsx:86` |
| `debugger`, `eval`, `new Function` | 0 | - |
| `dangerouslySetInnerHTML` | 2 | `RichText.tsx:125` (sanitized with DOMPurify, safe). Real risk is `innerHTML =` and `srcDoc` in `TemplateHtmlEditor.tsx:12,36` (HR-23) |
| `localStorage/sessionStorage` | 60 | token and user context read from `userData/menuContext/sessionData` (`erp-client.ts:75-100`); no scope-specific token writes found |
| `fetch(` | 111 | bypass-the-client calls: `recruitment-api.ts:216` n8n, `create-task-modal.tsx:381` n8n webhook-test, `import-data/page.tsx:99,151,183,247` direct to Laravel, `useMenuRights.ts` (no auth header) |
| `axios` | 2 | comments only |
| `window.location` | 5 | origin/reload only, no open-redirect |
| `return []` | 73 | error-swallowing empty fallbacks in list loaders (not itemised) |
| `user_profile_name/id` | 63 | client-sent to servers: `payroll-api.ts:761`, `attendance-api.ts:500`, `useMenuRights.ts:100-108` |
| hard-coded URLs | 16 | n8n job webhook `recruitment-api.ts:216`, `n8n.triz.co.in/webhook-test/task-assigned` (`create-task-modal.tsx:381`), `http://apps.triz.co.in/excel_upload/export_xlsx.php?module=tbluser|tblstudent` (`ImplementationManagementPage.tsx:94,103`, cleartext), `s3-triz.fra1.digitaloceanspaces.com/public/hp_staff_document` (`upload-doc-tab.tsx:144`), jsdelivr CSS+script without SRI (`layout.tsx:35,41`), `view.officeapps.live.com` embed |
| `mock/Mock` | 43 | `use-attendance.ts:8-20,131-132` (leave balance and events), `attendance-regularization-api.ts` seeded store |
| Menu registry vs pages | 517 generated screens, 0 missing files | `routeMapper.ts` has no entry for `organization_managment/*` |
| Unused files | `components/templates/DocumentFrame.tsx` (0 importers), `lib/gtg-org-data.ts` (0 importers), `components/ui/g2g/*` primitives duplicate `components/ui/*` (button 381 vs 55 importers, select 32 vs 71, card 162 vs 22) |
| Secrets in tracked source | none found in scope | the n8n path `ff441ace-***` is a bearer-like URL (redacted) |

---

## 10. ISSUES

## HR-01
**Severity:** Critical   **Type:** Confirmed
**Category:** Security
**Module:** Shared backend (used by Payroll, Task Management, Recruitment)
**Location:** `D:\next_lms_erp\routes\web.php:638-639`; `D:\next_lms_erp\app\Http\Controllers\AJAXController.php:2985-3073`; frontend callers `D:\lms_k12\app\hrit\_lib\payroll-api.ts:908-919`, `app\task-management\_lib\my-tasks-api.ts:346`, `app\talent-management\recruitment\components\job-posting-form.tsx`
**Function/Method:** `AJAXController::lmsDataApi` (routes `lms_data`, `table_data`)
**Problem:** GET `/table_data` and `/lms_data` are registered outside every middleware group and the controller never checks a token or session. They return any table by name with client-supplied `filters[col]=value`, `multiple`, `order_by`, `group_by`, and `?all_tables=1` / `?table_data=1&table_name=` list every table and column.
**Evidence:** `Route::get('table_data',[AJAXController::class,'lmsDataApi'])` at web.php:639 (last group closes at web.php:624). Controller: `$table = $request->table; if (!Schema::hasTable($table)) ...; $query = DB::table($table); ... foreach ($request->filters ...) $query->where($column,$value); ... $data = $query->get(); return response()->json($data);`. `payroll-api.ts:900-907` even documents the opposite: "The token is required: tbluser holds credentials, so this route 401s for an anonymous caller".
**Impact:** Anyone on the internet can dump `tbluser` (plaintext passwords per the ERP auth model, PAN, bank account, mobile), `tblstudent`, fees, payroll tables of every tenant with `curl`. Full data breach.
**Expected Behavior:** Authenticated, tenant-scoped, allow-listed tables and columns only, or removed.
**Recommended Fix:** Delete both routes or protect with `api.session`, an explicit table/column allow-list, forced `sub_institute_id` filter from the session, and column redaction. Replace the frontend pickers with proper endpoints (`/api/attendance/employees`, `departments-management/employees`). Fix the misleading comment.
**Verification:** `curl "<host>/table_data?table=tbluser"` without any header must return 401. Add a feature test.

## HR-02
**Severity:** Critical   **Type:** Confirmed
**Category:** Security
**Module:** Document Templates
**Location:** `D:\next_lms_erp\routes\api.php:863-879`; `D:\next_lms_erp\app\Http\Controllers\api\DocumentTemplateApiController.php:56-92` (context/tokenClaims), `:498-660` (mergeData, previewStudents)
**Function/Method:** `context()`, `tokenClaims()`, `mergeData()`, `previewStudents()`
**Problem:** The 12 `document-templates/*` routes have no middleware, and `context()` decodes the JWT payload with `base64_decode` and never verifies the signature. If there is no token it falls back to `$request->input('sub_institute_id')`. Every operation (list, read, create, update, delete, restore, duplicate, merge-data, preview-students) is therefore open to any caller who chooses a tenant id.
**Evidence:** `$claims = $this->tokenClaims($request); $subInstituteId = (int)($claims['sub_institute_id'] ?? 0) ?: (int)$request->input('sub_institute_id');` and the docblock "Decode the (already-issued) JWT payload without verifying". `mergeData` returns `aadhar_no`, `father_name`, `mother_mobile`, `guardian_email`, DOB, address, photo URL for any `student_id`.
**Impact:** Unauthenticated cross-tenant read of student PII (including Aadhaar numbers) and unauthenticated tampering with or deletion of certificates/fee-receipt templates of any school.
**Expected Behavior:** `api.session` (or verified JWT) with tenant from the verified payload; role/rights check for writes.
**Recommended Fix:** Wrap the routes in `api.session` + rights check; remove the request fallback; remove unverified `tokenClaims`.
**Verification:** Request with no token and with a forged `x.<b64({"sub_institute_id":1})>.y` token must return 401.

## HR-03
**Severity:** Critical   **Type:** Confirmed
**Category:** Authorization
**Module:** Organization Management > Employee Directory
**Location:** `D:\next_lms_erp\routes\organization_management.php:36,90-118`; `D:\next_lms_erp\app\Http\Controllers\api\OrganizationManagement\EmployeeDirectory\EmployeeDirectoryController.php:69-147,150-208,564-798,801-909,912-965,1291-1316`; `D:\next_lms_erp\app\Models\user\tbluserModel.php` (no `$hidden`)
**Function/Method:** `index`, `show`, `store`, `create`, `update`, `destroy`, `setStatus`, `invite`, `uploadDocument`, `buildAttributeArray`
**Problem:** (a) Group middleware is `api.session` only: no `staff.only`, no admin or rights check. (b) `buildAttributeArray` copies every request key except a short exclusion list, and it starts from `['sub_institute_id' => tenant]` then lets the request overwrite it. `store/update` therefore accept `is_admin`, `user_profile_id`, `password`, `client_id`, `sub_institute_id`, `status`, bank/PAN fields. (c) `show()` returns `$employee->toArray()` plus `'employees' => tbluserModel::where(tenant)->get()` (every employee, all columns) and `index()` selects `tbluser.*`; the model has no `$hidden`, so `password`, `plain_password`, `otp`, `account_no`, `pan_no`, `uan_no`, `ifsc_code` are serialized. (d) `index()` limits non-admins to self only when the request lacks `menu_type`; the client can simply send `menu_type`.
**Evidence:** `foreach ($input as $key => $value) { if (in_array($key,$excluded,true)) continue; ... $final[$key] = $value; }` (`:1298-1310`); `if ($request->filled('password')) $finalArray['password'] = Hash::make(...)` (`:604,774`); `!in_array(strtoupper($userProfile), ['ADMIN','SUPER ADMIN']) && !$request->has('menu_type')` (`:97`). `UserManagementApiController` (same table) does enforce `add_user.index` rights (`:128-233`), so this controller is an authorization bypass of it.
**Impact:** Any logged-in user, including a student or parent, can (1) read every staff credential and financial identifier in their school, (2) reset any employee's password and log in as them, (3) set `is_admin=1` / `user_profile_id` to escalate to admin or platform admin, (4) deactivate any user, (5) create users in other schools by sending `sub_institute_id`. Full account takeover.
**Expected Behavior:** Same admin/rights gate as `/api/users`; explicit field allow-list; hidden credentials; ignore client `sub_institute_id`.
**Recommended Fix:** Add `staff.only` plus a rights check equivalent to `UserManagementApiController::authorizeAction` on all write and read-all routes; replace `buildAttributeArray` with a whitelist; add `$hidden = ['password','plain_password','otp']` and a resource for the directory; enforce self-or-admin in `show`.
**Verification:** Student token `PUT /api/organization-management/employee-directory/{adminId}` with `password=x` must be 403; response of `show` must not contain `password`.

## HR-04
**Severity:** Critical   **Type:** Confirmed
**Category:** Security
**Module:** Payroll / HR helpers
**Location:** `D:\next_lms_erp\app\Helpers\Helper.php:2643-2681` (`employeeDetails`), `:2820-2826` (`getSubCordinates`); `D:\next_lms_erp\app\Http\Controllers\Payroll\PayrollController.php:504,507,1421,1631,1656,1682,2397,2451-2453`
**Function/Method:** `employeeDetails`, `getSubCordinates`, `getTotalDays`, `monthlyPayrollPdf`, `salaryStructureReport`, `payrollReport`
**Problem:** Client-controlled values are concatenated into raw SQL.
**Evidence:**
- `Helper.php:2660,2663`: `whereRaw('tbluser.id IN ('.$employee_id.')')`, `whereRaw('tbluser.department_id IN ('.$department_id.')')` where `monthlyPayrollCreate` builds them with `implode(',', $request->emp_id)` / `implode(',', $request->department_id)` (`PayrollController.php:1927-1928`).
- `getSubCordinates`: `'u.id = '.$user_id.' or u.employee_id='.$user_id` with `$profileUserId = $request->user_id` under `type=API` (`:1937`).
- `getTotalDays` (public GET `/getTotalDays`): `whereRaw('FIND_IN_SET("'.$department_id.'", department)')` and `'... and hel.user_id = "'.$user_id.'"'` from `emp_id`/`department_id` request params (`:2397,2453`).
- `monthlyPayrollPdf`: `a.user_id=$id` from the URL segment (`:1421`).
**Impact:** SQL injection reachable by any authenticated user (and by `check_permissions` fail-open). Data extraction or modification across all tenants.
**Expected Behavior:** Bound parameters only.
**Recommended Fix:** Replace with `whereIn` and integer casts (`array_map('intval', ...)`), bindings for FIND_IN_SET, validate route params `whereNumber`.
**Verification:** `emp_id[0]=1) OR 1=1 --` must be rejected (422) and not change the query. Add a regression test per entry point.

## HR-05
**Severity:** Critical   **Type:** Confirmed
**Category:** Security
**Module:** Menu rights (used by `app/hooks/useMenuRights.ts`)
**Location:** `D:\next_lms_erp\routes\api.php:186`; `D:\next_lms_erp\app\Http\Controllers\api\MenuRightsController.php:19-79`; `D:\lms_k12\app\hooks\useMenuRights.ts:98-108`, `:70`
**Function/Method:** `getMenuRightsLevelWise`, `useMenuRights.fetchMenu`, `buildMenuContextFromSource`
**Problem:** `POST /api/menu-rights` is unauthenticated, reads `sub_institute_id`, `client_id`, `user_id`, `user_profile_id`, `user_profile_name` from the body and concatenates `sub_institute_id` into `FIND_IN_SET(".$sub_institute_id.", m.sub_institute_id)` (lines 54,67,79). The frontend sends no Authorization header and, when a profile name is missing, defaults it to `'ADMIN'` (`useMenuRights.ts:70`).
**Impact:** Unauthenticated SQL injection plus disclosure of any user's menu/rights structure; client-side default-to-admin. (Menu ownership is the auth agent's; recorded here because this hook is in my scope and the endpoint is the root cause.)
**Expected Behavior:** JWT-required, tenant/user from the token, bound parameters, no default role.
**Recommended Fix:** Put the route behind `api.session`, cast ids to int, use bindings, remove the `'ADMIN'` fallback (treat as unauthenticated).
**Verification:** `curl -X POST /api/menu-rights -d sub_institute_id="1) OR 1=1 -- "` returns 401.

## HR-06
**Severity:** Critical   **Type:** Confirmed
**Category:** Authorization
**Module:** Payroll (tenancy)
**Location:** `D:\next_lms_erp\app\Http\Controllers\Payroll\PayrollController.php:47,91,160-190,218,272,536,571,657,675,778,980,1172,1590,1763,1908,1934,2289-2365`; `D:\lms_k12\app\hrit\_lib\payroll-api.ts:91-101,558-570`
**Function/Method:** `payrollStore`, `payrollDestroy`, `employeeSalaryStructureStore`, `monthlyPayrollCreate`, `deleteMonthlyPayrolls`, `payrollReport`, `hrmsSalaryCertificateReport`, ...
**Problem:** The middleware hydrates the tenant from the JWT, then each controller overwrites it with the request value when `type=API` (`$sub_institute_id = $request->get('sub_institute_id')`). Some mutations are not tenant-scoped at all: `PayrollType::find($request->id)` and `PayrollType::where('id',$id)->delete()`; `DB::table('employee_monthly_salary_data')->where('id',$dataId)->delete()`. `monthlyPayrollCreate` also takes `user_profile_name` from the request, and `employeeDetails` skips the subordinate narrowing when it is "Admin" (`Helper.php:2654-2657`), so the caller chooses their own role.
**Evidence:** `deleteMonthlyPayrolls`: `$checkInMonthly = DB::table('employee_monthly_salary_data')->where('id',$dataId)->delete();` (`:2344`). Client sends `user_profile_name` (`payroll-api.ts:761`).
**Impact:** A user of school A with a valid token can read all employees' salary structures/payslips of school B (`sub_institute_id=B`), create/modify/delete B's payroll types, delete payslip rows by id, and see every employee's payroll by claiming `user_profile_name=Admin`.
**Expected Behavior:** Tenant from session only; every query filtered by it; role from the session.
**Recommended Fix:** Remove all `type=API` overrides in this controller; add `->where('sub_institute_id', session tenant)` to every find/delete; read `user_profile_name` from the session; add rights check on payroll routes.
**Verification:** With token A and `sub_institute_id=B` every payroll endpoint must return only A data or 403.

## HR-07
**Severity:** Critical   **Type:** Confirmed
**Category:** Authorization
**Module:** Admin Services (complaint, consent, front desk, petty cash)
**Location:** `D:\next_lms_erp\app\Http\Controllers\api\ComplaintApiController.php:44-70`, `ConsentApiController.php:36-60`, `FrontDeskApiController.php:38-95`, `PettyCashApiController.php:41-66,112-128`; routes `api.php:748-800` (no middleware)
**Function/Method:** `authenticate()`, `validateContext()`, `storeBill()`, `storePhoto()`, `storeAttachment()`
**Problem:** `authenticate()` only checks that the JWT is valid. Tenant and user come from `sub_institute_id`/`user_id` in the request (`required|integer`); the JWT payload is never compared. Front desk decides "admin" from `profileName($request user_id) === 'ADMIN'` (`FrontDeskApiController.php:91-93`). File handling: petty cash moves the bill to `public/pettycash/` with the client extension and no type validation (`PettyCashApiController.php:118-122`); front desk and complaint store the original filename/extension on the public disk with no validation.
**Impact:** Cross-tenant read/write/delete of complaints, consents, visitor logs with photos, and petty-cash financials by any authenticated user of any school; identity spoofing for admin views; uploading a `.php`/`.html` file into the web root (`public/pettycash`) is a potential remote-code-execution / stored-XSS path depending on server config (NOT VERIFIED).
**Expected Behavior:** Use `api.session` or compare the JWT payload to the request; validate uploads (`mimes`, size) and store outside webroot with generated names.
**Recommended Fix:** Route group with `api.session` + rights checks; derive tenant/user from the session; whitelist extensions and store with random names on a non-executable disk.
**Verification:** Token from tenant A with `sub_institute_id=B` returns 403; uploading `x.php` is rejected.

## HR-08
**Severity:** Critical   **Type:** Confirmed
**Category:** Security
**Module:** Task Management create, Add Process, Org SOP
**Location:** `D:\next_lms_erp\routes\web.php:651-652,660-661`; `D:\next_lms_erp\app\Http\Controllers\frontdesk\taskController.php:118-260`; `D:\next_lms_erp\app\Http\Controllers\reuirementController.php:15-133`; `D:\next_lms_erp\routes\api.php:266-270`; `D:\next_lms_erp\app\Http\Controllers\api\AiSopGenerationController.php`
**Function/Method:** `taskController::store`, `reuirementController::{index,store,update,destroy,ReportData}`, `AiSopGenerationController::{index,generate,store}`
**Problem:** Four unauthenticated write surfaces used by my modules:
1. `POST /task` (create-task modal and process publisher): no JWT/session check; `sub_institute_id` and `user_id` from the request; `$request->except([...])` is inserted straight into `task` (mass assignment); attachment stored in `public/frontdesk` with client extension.
2. `Route::resource('requirements')` (add_process persistence): list, create, update, `destroy` (`requirementGathering::where('id',$id)->delete()`), plus `customers_requirement` which joins all schools; no auth, no tenant.
3. `api/ai-sop` (list, all tenants when no filter), `ai-sop/generate` (Gemini spend, no throttle), `ai-sop/store` (writes SOP into any tenant id).
4. The add_process client writes `sub_institute_id: "0"` (`general/add_process/api.ts:19,99-106`), so every school shares one global set of process rows.
**Evidence:** `taskController.php:121-134` (API branch reads `$request->sub_institute_id`, `$request->user_id`, no `jwtToken()`; grep for jwt in the file is empty). `reuirementController.php:113-123`. `routes/api.php` comment at 258-262 admits the sibling route is "unauthenticated".
**Impact:** Unauthenticated task spam and notification injection into any school, arbitrary file upload, deletion/overwrite of global process definitions, LLM cost abuse, cross-school data reads.
**Expected Behavior:** All four behind `api.session` with tenant from session; per-tenant storage for processes.
**Recommended Fix:** Add `api.session` (+ `staff.only`, rights) to these routes; replace mass assignment with an allow-list; store add_process rows by tenant; throttle `ai-sop/generate`; validate upload types.
**Verification:** Unauthenticated curl to each returns 401; process rows differ by tenant.

## HR-09
**Severity:** High   **Type:** Confirmed
**Category:** Authorization
**Module:** HRIT Leave
**Location:** `D:\next_lms_erp\app\Http\Controllers\api\Leave\Concerns\ResolvesLeaveContext.php:57`; `LeaveRequestApiController.php:146-227,232-276,339-368,372-414`; `LeaveWorkflowApiController.php`, `LeaveTypeApiController.php`, `HolidayApiController.php`; `routes/api.php:914-963`; UI `app/hrit/leave-management/leave-requests/page.tsx:461,464`, `LeaveRequestDetailsDrawer.tsx:373-396`, `leave-dashboard/components/PendingApprovalCard.tsx`
**Function/Method:** `leaveContext`, `store`, `decision`, `bulkDecision`, `destroy`, config controllers
**Problem:** Identity (`user_id`) is read from the request, not the JWT. There is no role, ownership, department, or self-approval check anywhere. Approve/Reject/Bulk buttons render for every user. The stored approval workflow (reporting manager/HOD/HR/multi-level/escalation) and leave role permissions (approve_leave, scope Team/Department...) are persisted but never read by `decision`. Configuration endpoints (leave types, holidays, weekly off, workflow, roles) are writable by any token. `/api/leave/*` has no `staff.only`, so a student token also passes. `index/show` return each requester's email, mobile and free-text reason.
**Evidence:** `decision()` validates `status` and `hod_comment` only, then `applyDecision(..., $context)` writes `approved_by => approver name looked up from request user_id`. `destroy()` withdraws any tenant leave that is pending (`:346-361`, no `user_id` comparison). `store()`: `$userId = (int)($request->input('employee_id') ?: $context['user_id'])` with `exists:tbluser,id` unscoped.
**Impact:** Any employee can approve their own leave, reject or withdraw a colleague's, apply leave for others, edit the leave policy for the school, and read staff contact data and medical-type reasons. Approver audit trail (`approved_by`) is attacker-chosen.
**Expected Behavior:** Server-side approver resolution per configured workflow, self-approval blocked, ownership on withdraw, admin/HR gate on config, identity from the JWT.
**Recommended Fix:** Put identity from `jwtPayload('id')`; implement role/scope checks using `hrms_leave_role_permissions`; enforce workflow levels and a `pending -> level n -> final` state machine; add `staff.only`; restrict list/show to self, team or HR.
**Verification:** Employee token cannot approve own request (403); student token gets 403; config writes require admin.

## HR-10
**Severity:** High   **Type:** Confirmed
**Category:** Business Logic
**Module:** HRIT Leave
**Location:** `D:\next_lms_erp\app\Services\Leave\LeaveAnalyticsService.php:28,100-127,170-215,284-291`; `D:\next_lms_erp\app\Helpers\Helper.php:2834-2858`; `LeaveRequestApiController.php:146-227`; `app/hrit/leave-management/leave-requests/components/LeaveApplyDrawer.tsx:80-86`
**Function/Method:** `countDays`, `consumedByType`, `balancesForEmployee`, `requestsQuery`, `store`
**Problem:** (1) No balance check on apply; `remaining` may go negative. (2) Day count is calendar days (`skipday=''`), so weekly offs and holidays consume balance; the holiday/weekday tables are not consulted. (3) No overlap check between requests; upsert only merges same `from_date`. (4) List/report/balance queries require `from>=yearStart AND to<=yearEnd`; a request crossing the leave-year edge (e.g. 28 Mar to 2 Apr) is dropped from every screen and from consumption. (5) `pending` consumes balance while `sent_back`/`cancelled` do not, but a withdrawn (soft-deleted) request is excluded only in some queries. (6) Trend chart assumes 12 monthly buckets from the year start even when `academic_year` spans a different length. (7) Leave type `exists:hrms_leave_types,id` is not tenant scoped; `department_id` is client supplied.
**Evidence:** `whereIn('hel.status', array_merge(self::CONSUMING_STATUSES, ['approved_lwp']))`, `->where('hel.to_date','<=',$to)`, `$mainDays = $fromDate->diffInDays($toDate) + 1; $daysCount = ($mainDays*$dayType);`.
**Impact:** Wrong balances and entitlements, over-drawn leave accepted, hidden requests, employees charged for weekends/holidays.
**Expected Behavior:** Business-day counting against the configured roster/holidays, balance and overlap enforcement, boundary-safe year windows.
**Recommended Fix:** Central `LeaveDayCalculator` using `hrms_weekdays` and `hrms_holidays`; validate balance/overlap in `store`; use overlap semantics for year filtering; tenant-scope FK checks.
**Verification:** Unit tests for Fri-Mon leave, holiday inside range, cross-year request, balance exhaustion.

## HR-11
**Severity:** High   **Type:** Confirmed
**Category:** Business Logic
**Module:** HRIT Attendance
**Location:** `D:\next_lms_erp\app\Http\Controllers\api\Attendance\AttendanceTrackingApiController.php:207-330` (lines 223,239,283,309 use `$request->input('employee')`); `Concerns/ResolvesAttendanceContext.php:56`; `D:\lms_k12\app\hrit\_lib\use-attendance.ts:150-170`
**Function/Method:** `punchIn`, `punchOut`, `myAttendance`
**Problem:** The employee whose attendance is written comes from `employee` in the body; the punch date and time come from the browser clock (`new Date()`), any `indate/intime` is accepted, past or future, and a repeat punch-in resets the day's punch-out. There is no geofence/IP policy, yet the UI labels any punch with an IP as "Office" (`use-attendance.ts:78`). `myAttendance` reads `user_id` from the request.
**Impact:** Buddy punching, backdated attendance that feeds payroll (HR-13), and attendance viewing for any employee. Attendance is the input to salary.
**Expected Behavior:** Server-set timestamp, employee from the JWT, policy for backdating via approval.
**Recommended Fix:** Ignore `employee`/`indate`/`intime` unless caller has HR rights and audit them; use `now()` server side; add regularization endpoint with approval (currently missing, HR-25).
**Verification:** Punch as user A for user B returns 403; posted time ignored.

## HR-12
**Severity:** High   **Type:** Confirmed
**Category:** Business Logic
**Module:** HRIT Payroll (monthly)
**Location:** `D:\next_lms_erp\app\Http\Controllers\Payroll\PayrollController.php:2173-2287` (store), `:1920-2019` (create), `:2021-2171`; `D:\lms_k12\app\hrit\_lib\use-monthly-payroll.ts:265-296`
**Function/Method:** `monthlyPayrollStore`, `monthlyPayrollCreate`
**Problem:** The server computes the payslip lines but stores whatever the client posts: `total_deduction`, `total_payment`, `received_by`, `total_day`, and the whole `payrollHead` map (`:2216-2220`). Values can be edited in devtools or replayed. Store is insert-only with no lock/approval state; payslip PDF and `staff_document` row are generated from those values. `emp_id` keys in `payrollVal` are not checked to belong to the tenant. Financial-year handling is inconsistent: create looks up `year+1` for Jan-Mar (`:1946-1948`) while store writes `$request->year` (`:2211`), so a saved Jan-Mar row is never found by the screen (UI shows it as unsaved, delete is impossible, PDF lookup uses the raw year).
**Impact:** Payroll amounts can be tampered with by any caller of the endpoint; duplicate or orphaned months for Jan-Mar; no immutable pay-run lifecycle.
**Expected Behavior:** Recompute on save from structure + attendance snapshot, ignore client totals, guard with a per-month lock and approval, consistent year key.
**Recommended Fix:** Recompute server side in `monthlyPayrollStore` (reuse `getEmpMonthlyData`), validate employees belong to the tenant, store `finalized_at`, use one year mapping helper in create/store/pdf/delete.
**Verification:** Post inflated `total_payment`; stored value must equal the server computation.

## HR-13
**Severity:** High   **Type:** Confirmed
**Category:** Business Logic
**Module:** HRIT Payroll (attendance to payroll)
**Location:** `D:\next_lms_erp\app\Http\Controllers\Payroll\PayrollController.php:2367-2597` (`getTotalDays`), `:2021-2171`, `:2598-2659`
**Function/Method:** `getTotalDays`, `getEmpMonthlyData`, `calculateLeaveCounts`
**Problem:** Paid days are wrong in several documented ways: pending (unapproved) leave is paid (`$leaveStatus=["approved","pending"]`, `:2459`); the leave query has no `deleted_at` filter, so withdrawn requests still count (`:2449-2457`); institute-wide holidays (`department=''`) are ignored by `FIND_IN_SET` (`:2397`, versus `HolidayApiController.php:331`); multi-day holidays crossing a month edge are dropped; weekly off is hardcoded to Sunday and ignores the configured weekdays; any attendance row counts as a full day; half-day holiday type is ignored; Saturday-late deduction reads `general_data.sat_late_day` by string key.
**Impact:** Systematic over/under-payment and mismatch between the Attendance and Leave modules' idea of working days.
**Expected Behavior:** One shared calendar service (roster, weekly off, holidays, leave states) used by leave, attendance, payroll.
**Recommended Fix:** Extract a calendar service, exclude `deleted_at`, require approved status, include institute-wide holidays, and unit-test the sandwich and LWP rules.
**Verification:** Golden-file tests for a month with an institute holiday, a withdrawn leave and a pending leave.

## HR-14
**Severity:** High   **Type:** Confirmed
**Category:** Backend
**Module:** Payroll, Leave, Import (frontend/backend contract breaks)
**Location:** `D:\lms_k12\app\hrit\_lib\payroll-api.ts:617-625,819-834` vs `D:\next_lms_erp\routes\hrms.php:31,118`; `app\hrit\leave-management\leave-requests\components\LeaveRequestDetailsDrawer.tsx:316` vs `LeaveRequestApiController.php:18,240`; `app\import-data\page.tsx:183-201` vs `ImportApiController::matchFields`
**Function/Method:** `deletePayrollType`, `deleteMonthlyPayroll`, drawer "Save" remark, import auto-match
**Problem:** (1) `deletePayrollType` POSTs to `/payroll-type/destroy/{id}`; the route is `Route::delete(...)` only (405). (2) `deleteMonthlyPayroll` POSTs to `/monthly-payroll-delete/{month}`; the route is `/monthly-payroll-delete` with no path parameter (404). (3) The "Save" remark button sends `status:'pending'` but `decision` accepts only approved/rejected/sent_back/cancelled/approved_lwp (422). (4) The import screen calls `/api/import/match-fields` with `csv_header_fields` and `table_fields` and expects `data.matched_fields`; the backend expects `csv_file_id`/`completeArr`/`skip_val` and returns no data, so auto-match never works and duplicate-handling (`is_skip`) is never set.
**Impact:** Payroll type and payslip deletion are dead features (so the insert-only monthly save cannot be corrected), remarks cannot be saved, and every re-import creates duplicates.
**Expected Behavior:** Client and server agree on verbs, paths and payloads.
**Recommended Fix:** Add `_method=DELETE`/matching paths or change routes; drop the `pending` call or add a `remark` endpoint; implement or remove match-fields and add a duplicate-handling selector.
**Verification:** Contract tests calling each client method against the route table (`php artisan route:list` equivalent by reflection).

## HR-15
**Severity:** High   **Type:** Confirmed
**Category:** Security
**Module:** Import Data
**Location:** `D:\next_lms_erp\app\Http\Controllers\api\ImportApiController.php:27-90,109-330,435-452`; `routes/api.php:548-553`
**Function/Method:** `parse`, `process`, `matchFields`
**Problem:** `api.session` only, no role. `process` takes column names from the client (`fields[]`) with no check against `import_table_fields`, so for `tbluser` a CSV column can be mapped to `is_admin`, `user_profile_id`, `password`. Uploaded files are moved to the relative folder `import/` (public web root) with a 5-digit random suffix and never deleted; they contain student/staff PII. `csv_data` ids are global; `process`/`match-fields` accept any id (no tenant column). There is no transaction: a mid-run exception leaves partial inserts. `successCount = total - failed` ignores skipped/no-op rows; only 5 tables have logic, the rest return "Import completed". `utf8_encode` is deprecated.
**Impact:** Any authenticated user can create admin accounts by bulk import, cross-process another school's file, and read uploaded PII from a guessable URL (NOT VERIFIED whether web server serves `public/import`).
**Expected Behavior:** Admin/rights gate, whitelist columns, private storage with cleanup, transaction, accurate counts.
**Recommended Fix:** Gate by `add_import.index` rights, validate against `import_table_fields`, store via `Storage::disk('local')`, wrap in `DB::transaction`, report skipped/failed.
**Verification:** Student token gets 403; mapping `is_admin` is rejected.

## HR-16
**Severity:** High   **Type:** Confirmed
**Category:** Authorization
**Module:** Organization Management (disciplinary, compliance, departments)
**Location:** `D:\next_lms_erp\routes\organization_management.php:36-88`; `DisciplinaryLibraryController.php:110-197`; `Compliance/ComplianceEvidenceController.php:58-137`; `Http/Requests/OrganizationManagement/{Store,Update}DisciplinaryRecordRequest.php:14`; `HRMS/departmentController.php:455-483,754-849`
**Function/Method:** `DisciplinaryLibraryController::{index,store,update,destroy}`, `ComplianceEvidenceController::{store,verify,reject}`, `departmentController::{destroyManagement,merge,setHead}`
**Problem:** These endpoints are tenant-scoped but have no role check: `authorize()` returns `true`, no `staff.only`. Any authenticated user (students/parents included) can read and edit employee disciplinary records, verify or reject compliance evidence (the uploader can verify their own evidence), and delete or merge departments. Evidence upload accepts any file type up to 20MB and stores `time()_<original name>` on the public disk.
**Impact:** Confidential HR records exposed or falsified; compliance sign-off meaningless (no maker-checker); organisational structure destructible.
**Expected Behavior:** HR/admin gate, maker-checker on verification, MIME allow-list.
**Recommended Fix:** Add `staff.only` and a rights/role check (reuse `RolePermissionsController::assertIsAdmin` pattern); block verifying own upload; `mimes:` rule and non-public storage.
**Verification:** Teacher/student token gets 403 on disciplinary CRUD; verify own evidence returns 422.

## HR-17
**Severity:** High   **Type:** Confirmed
**Category:** Authorization
**Module:** Talent Management
**Location:** `D:\next_lms_erp\routes\talent_management.php:63`; `Http\Controllers\api\Concerns\RequiresTalentAdmin.php:16-30`; `Performance\PerformanceCompensationController.php:44-88,247-317`; `PerformanceBonusController.php:40`; `PerformanceAppraisalController.php:41`; `TaskPermissionMiddleware.php:38-55`; `RolePermissionsController.php:52-68`
**Function/Method:** `assertIsAdmin`, `index`, `decision`
**Problem:** (1) All read endpoints are open to every staff profile (teacher, clerk, etc.): compensation revisions with increment amounts, bonuses, appraisals. (2) Write gate is `is_admin` in {1,2} only (platform/client-level per ERP auth model), so a tenant "HR Manager" or "Admin" (is_admin=0) is blocked while the UI (`isPayrollRole`) lets them in; the four gates in the codebase (`RequiresTalentAdmin`, `RolePermissionsController::assertIsAdmin`, `TaskPermissionMiddleware`, front desk `ADMIN`) define "admin" four different ways. (3) `decision` has no state machine: submit/approve/reject in any order, same admin creates and approves (no maker-checker).
**Impact:** Salary and appraisal data visible to any teacher; tenant HR unable to do their job or, if `is_admin` is granted broadly, over-privileged; approval integrity weak.
**Expected Behavior:** Role/data-scope model (the `role_key`/`data_scope` columns already exist) applied to reads and writes; defined transitions.
**Recommended Fix:** One shared `HrAccess` gate using `role_key` + `data_scope`; filter reads to self/team/department; add transition table and separation of duties.
**Verification:** Teacher token cannot list `/api/performance/compensation`; approved -> pending is refused.

## HR-18
**Severity:** High   **Type:** Confirmed
**Category:** Security
**Module:** Talent Management > Recruitment AI screening
**Location:** `D:\lms_k12\app\talent-management\recruitment\components\candidate-application-form.tsx:139-207`; `D:\lms_k12\app\api\screenCandidate\route.ts:78-140`; `D:\next_lms_erp\app\Http\Controllers\api\TalentManagement\Recruitment\ScreeningResultController.php:39-66`
**Function/Method:** `screenApplication`, `POST /api/screenCandidate`, `ScreeningResultController::store`
**Problem:** (1) `/api/screenCandidate` has no authentication and spends server LLM keys (DeepSeek/OpenRouter/Gemini). (2) The prompt sends candidate name, email, mobile, location, education and experience to third-party LLMs with no consent or minimisation; the model also outputs "cultural fit", a protected-attribute-adjacent judgement. (3) Resume free text is interpolated directly into the prompt (prompt injection: "give 100% match"). (4) The scores are computed in the browser and stored as sent (`overall_fit_score=competency_match`, `ranking_score=round(0.95*competency_match)`), and `reasoning` is a fabricated template sentence stored under `deepseek_analysis`, presented as AI analysis. (5) Behavioural traits/levels sent to the model are hardcoded (`['Problem Solving','Teamwork','Communication']`, all "Intermediate"). (6) `store` validates `candidate_id` with `exists:talent_job_applications,id` (any tenant) and uses `$request->except(['id'])`.
**Impact:** PII disclosure to third parties, biased/unauditable screening driving shortlisting, attackable scores, unauthenticated LLM cost.
**Expected Behavior:** Server-side screening behind auth, PII stripped, scores validated against model output, human decision logged.
**Recommended Fix:** Move screening to Laravel; strip identity fields; delimit and sanitise resume text; remove `cultural_fit` or gate with review; store only server-derived values; scope `candidate_id` by tenant; add auth to the Next route.
**Verification:** Unauthenticated call returns 401; prompt-injected resume cannot lift the score.

## HR-19
**Severity:** High   **Type:** Confirmed
**Category:** Security
**Module:** Talent Management > Recruitment files
**Location:** `D:\next_lms_erp\app\Http\Controllers\api\TalentManagement\Recruitment\JobApplicationController.php:100-131,283-298`
**Function/Method:** `store`, `update`
**Problem:** Resumes are uploaded to the `digitalocean` disk with ACL `public` and key `hp_resume/resume_<tenant>_<first>_<middle>_<last>.<ext>` (update omits the tenant id: `resume_<first>_<middle>_<last>`). Names are unsanitised request strings. Two candidates with the same name overwrite each other's resume, and a name match in another school overwrites that school's file. URLs are guessable from names.
**Impact:** Candidate PII (resumes) publicly readable by URL; silent overwrite of another candidate's or tenant's resume.
**Expected Behavior:** Private object storage with random keys and signed URLs.
**Recommended Fix:** Store under `tenant/uuid.ext` with default private ACL and temporary URLs; sanitise names.
**Verification:** Two uploads with identical names produce different keys; unauthenticated GET returns 403.

## HR-20
**Severity:** High   **Type:** Confirmed
**Category:** Security
**Module:** Task Management > Administration > Integration
**Location:** `D:\lms_k12\app\api\integration-configs\route.ts:1-80`, `[id]\route.ts:1-40`, `test\route.ts:1-20`; client `app\task-management\_lib\integration-management-api.ts:1-123`
**Function/Method:** `GET/POST /api/integration-configs`, `[id]`, `test`
**Problem:** "Authentication" is the mere presence of an `Authorization` header (any string). Data is a module-level array (`const records = []`) shared by all tenants and lost on restart; `[id]/route.ts` uses a different store (`globalThis.integrationRecords`), so records created by POST can never be updated or deleted. Configs (SMTP passwords, API keys typed by admins) are returned in clear on GET. The `test` route always answers "tested successfully".
**Impact:** Secrets entered by one school are readable by any caller of any school; the page reports false success; edits/deletes silently fail.
**Expected Behavior:** Backend persistence per tenant with encrypted secrets and real connectivity tests, or hide the page.
**Recommended Fix:** Remove the Next handlers, implement `task-management/integration-configs` in Laravel with rights, mask secrets, real test.
**Verification:** No secrets returned on GET; test fails for bad credentials.

## HR-21
**Severity:** High   **Type:** Confirmed
**Category:** Security
**Module:** Easy Com (SMS/WhatsApp/Email)
**Location:** `D:\next_lms_erp\routes\easycomapi.php:34-95`; `Http\Controllers\api\easy_com\SmsApiMasterApiController.php:100-160`; `send_sms_parents_controller.php:113-161`; `SendWhatsappParentsApiController.php:90-176`; `SendSmsParentsApiController.php:70-160`
**Function/Method:** all `send*`, `SmsApiMaster::{store,update}`, `sendSMS`
**Problem:** `api.session` only. Any student/parent/teacher token can (a) send bulk SMS/WhatsApp/email as the school with arbitrary text, (b) create or replace the school's SMS gateway configuration with any `http(s)://` URL and read it back, which the server then calls with `CURLOPT_SSL_VERIFYPEER/HOST = 0` (credential capture, SSRF to internal hosts), (c) change SMTP or WhatsApp credentials. There is no per-user quota, template approval, or throttle beyond global `throttle:1000,1`. `sendSMS` ignores the gateway response body and marks "sent"; WhatsApp is synchronous with `usleep(300000)` per recipient inside the request and a hardcoded `91` country code; WhatsApp `studentIds` are not constrained to the selected class.
**Impact:** Smishing/spam from the school's sender ID, cost abuse, credential and traffic hijack, timeouts on large sends, false delivery reports.
**Expected Behavior:** Communication rights, approval/quotas, queued sends, gateway URL allow-list, TLS verification.
**Recommended Fix:** Gate by `send_sms_parents.index` etc. rights, move sends to queued jobs with rate limits, validate gateway host, enable SSL verify, parse gateway responses, drop the hardcoded country code.
**Verification:** Student token 403; invalid gateway response marked failed.

## HR-22
**Severity:** High   **Type:** Confirmed
**Category:** Authorization
**Module:** Task Management
**Location:** `D:\next_lms_erp\routes\task_management.php:113-215`; `WorkspaceController.php:215-233,235-281,348-366`; `LegacyTaskController.php:59-111,75`; `DeadlineExtensionController.php:110-160`; `AuditLogController.php`; `D:\lms_k12\app\task-management\my-tasks\components\create-task-modal.tsx:379-393`
**Function/Method:** `destroy`, `approve`, `LegacyTaskController::update/destroy`, `DeadlineExtensionController::decide`, `AuditLogController::index/export`
**Problem:** `task.permission` is applied to only four read routes; `task.delete`, `task.approve`, `project.*`, `dependency.manage` abilities exist in the middleware but are attached to nothing. Any staff member can archive/edit/reassign any task in the school (`findTenantTask` is tenant-scoped only), approve their own completed task (only the literal profile "Employee" is blocked), approve their own deadline extension (no approver check), and read and export the full audit trail. `assignee_id` is validated as integer only, so tasks and notifications can target a user id of another school. The create modal also POSTs the full task (title, description, assignees, KRA/KPI) from the browser to `https://n8n.triz.co.in/webhook-test/task-assigned`, a test webhook URL, while the server can fire its own webhook too.
**Impact:** Task/PIP data integrity, self-approval, cross-tenant notification injection, task content leaked to an external unauthenticated webhook.
**Expected Behavior:** Owner/manager/elevated checks per ability; approver != requester.
**Recommended Fix:** Attach `task.permission` to delete/approve/manage routes; validate assignee is in tenant; block requester deciding own extension; remove the browser webhook and rely on the server one.
**Verification:** Non-manager cannot approve or archive; self-decision returns 403.

## HR-23
**Severity:** High   **Type:** Confirmed
**Category:** Security
**Module:** General > Template management (HTML editor)
**Location:** `D:\lms_k12\app\general\_components\TemplateHtmlEditor.tsx:12,35,36`; backend `GeneralSetupApiController` template store
**Function/Method:** `TemplateHtmlEditor` (`innerHTML = value`, code-view textarea, preview `<iframe srcDoc>`)
**Problem:** Stored template HTML is written into a contenteditable div with `innerHTML` and previewed in an `<iframe srcDoc>` with no `sandbox` attribute and no sanitisation (`isomorphic-dompurify` is installed and used only in `RichText.tsx`). A template containing `<img src=x onerror=...>` or `<script>` executes in the app origin (srcdoc inherits it) when any admin opens or previews the template; the token is in `localStorage`.
**Impact:** Stored XSS leading to token theft for any user who opens a poisoned template; templates are rendered on printed documents too.
**Expected Behavior:** Sanitise on load/save and sandbox the preview.
**Recommended Fix:** `DOMPurify.sanitize` before `innerHTML` and on save; `sandbox=""` on the iframe; server-side sanitisation.
**Verification:** Save `<img src=x onerror=alert(1)>`, reopen: no alert.

## HR-24
**Severity:** Medium   **Type:** Confirmed
**Category:** Authorization
**Module:** HRIT role gating and menu rights
**Location:** `D:\lms_k12\app\hrit\_components\payroll-shell.tsx:29-32`; `leave-configuration\page.tsx:19-22`; `D:\next_lms_erp\app\Http\Middleware\checkPermission.php:36-44,101-160`; `database\migrations\2026_08_17_120000_fix_hrit_menu_link_collisions.php`; `routeMapper.ts:446-473`
**Function/Method:** `isPayrollRole`, `isConfigRole`, `checkPermission::handle`
**Problem:** Client gates use `name.toLowerCase().includes('admin') || includes('hr')`, which matches unrelated profiles ("Admin Assistant", "Chris", "Three...", "Front Desk Admin") and is purely cosmetic. Server-side, `check_permissions` enforces rights only if a `tblmenumaster` row's `link` equals the Laravel route name; if none exists it silently allows. The new HRIT rows use links `hrit.payroll.*`, while routes are named `payroll_type.index` etc., so the rights an admin sets in Role & Permissions for the HRIT menu do not govern the API (only the legacy rows do). Leave/attendance have no menu check at all.
**Impact:** Misleading UI gate and fail-open server permissions for HR.
**Expected Behavior:** Server is the source of truth, fail-closed, rights bound to the menu items users actually see.
**Recommended Fix:** Fail closed on unknown routes; map hrit.* rows to route names or add `perm:` middleware keyed to them; use `role_key` for UI gates.
**Verification:** Remove a legacy row: route returns 403.

## HR-25
**Severity:** Medium   **Type:** Confirmed
**Category:** Frontend
**Module:** HRIT, Talent, General, Task
**Location:** `D:\lms_k12\app\hrit\_lib\use-attendance.ts:8-20,131-132`; `_lib\attendance-regularization-api.ts:1-130`; `attendance-management\attendance-policy\page.tsx`; `attendance-reports\page.tsx:614-622`; `talent-management\administration\components\admin-data.ts`; `general\bulk_upload\page.tsx`; `task-management\_lib\integration-management-api.ts`
**Function/Method:** hook and page stubs
**Problem:** Screens present fabricated data as live. (1) Attendance Tracking always overwrites the leave balance with constants `{casual:12, earned:7, sick:0, pending:1}` and a fixed "Independence Day 2026-08-15" event in the `finally` block, even when the real `/leave/balances` and `/leave/holidays/upcoming` endpoints exist. (2) Attendance Regularization is an in-memory module array with seeded 2026-06 requests: "submitted" requests vanish on reload, are never seen by an approver, and no endpoint exists; it also feeds the Request Center. (3) Attendance Policy shows a fixed "locks in 2 days" while no lock exists. (4) Export/Print buttons on Attendance Reports only `console.log`. (5) 4 of 5 Talent Admin KPIs render "-". (6) `general/bulk_upload` is a generic config page with no upload API. (7) Integration admin (HR-20).
**Impact:** Employees rely on wrong balances and believe regularization requests were filed.
**Expected Behavior:** Real data or an explicit "coming soon" state.
**Recommended Fix:** Wire to existing endpoints, remove mock fallbacks, implement regularization API or hide the pages.
**Verification:** Balance matches `/api/leave/balances`; regularization persists across reload.

## HR-26
**Severity:** Medium   **Type:** Confirmed
**Category:** Security
**Module:** HRIT, Task (transport)
**Location:** `D:\lms_k12\app\hrit\_lib\leave-api.ts:75-86`, `payroll-api.ts:91-101,287-307,927-945`, `app\task-management\_lib\my-tasks-api.ts:277-294`, `use-administration.ts` (audit export URL)
**Function/Method:** `withContextParams`, `payrollQuery`, `salaryCertificatePdfUrl`, `monthlyPayslipPdfUrl`, `createLegacyTask`
**Problem:** The JWT is sent both as a Bearer header and as a `token=` query/body parameter. GET/DELETE and every PDF/CSV link put the token in the URL (browser history, Referer, server and proxy access logs). Laravel's leave/attendance/department controllers actually require the `token` input (`ResolvesLeaveContext.php:34-40`), so the header alone is not enough.
**Impact:** Token leakage via logs and referrers; longer exposure window.
**Expected Behavior:** Header-only tokens, short-lived signed URLs for downloads.
**Recommended Fix:** Make the trait read the Bearer header, drop `token` from URLs, use one-time download tickets for PDFs.
**Verification:** No `token=` in access logs.

## HR-27
**Severity:** Medium   **Type:** Confirmed
**Category:** Business Logic
**Module:** Organization Management, HRIT, Talent
**Location:** `D:\lms_k12\app\organization-management\employee-directory\components\edit-employee\personal-info-tab.tsx:82-83,209`; `hrit\_lib\use-leave.ts:99`; `hrit\_lib\attendance-regularization-api.ts:63`; `talent-management\offboarding\components\offboarding-center.tsx:163-164,325-326`; `recruitment\components\candidate-application-form.tsx:218`; `organization-management\compliance-library\components\compliance-calendar.tsx:93-95`; helper `lib\date-only.ts`
**Function/Method:** date pickers and defaults
**Problem:** 18 uses of `toISOString().slice(0,10)`/`split('T')[0]` in scope despite `lib/date-only.ts` documenting that this shifts a date one day back for every timezone east of UTC (IST). Data-writing cases: employee birthdate on save, offboarding notice/last working day, application date. Additionally the same form defaults `gender: employee.gender || 'M'` (`:83`), so an employee with blank gender is saved as male, which changes Professional Tax (`Helpers::getPT($gross,$gender,$month)`, `PayrollController.php:2147`).
**Impact:** DOB and last-working-day off by one; wrong PT for women with unset gender; calendar highlights wrong day.
**Expected Behavior:** Use `toDateOnly`; do not default gender.
**Recommended Fix:** Replace with `toDateOnly()`; remove the `'M'` default (required select).
**Verification:** Pick 2 Jan in IST, saved value is `01-02`.

## HR-28
**Severity:** Medium   **Type:** Confirmed
**Category:** Security
**Module:** Platform (CSRF, cross-ref)
**Location:** `D:\next_lms_erp\app\Http\Middleware\VerifyCsrfToken.php:22-31`
**Function/Method:** `$except`
**Problem:** The except list contains full-URL wildcards `'https://erp.triz.co.in/*'`, `'https://dev.triz.co.in/*'`, `'http://127.0.0.1:8000/*'`, which Laravel matches against `fullUrlIs`, disabling CSRF for every web route on those hosts (production included). On any other host (e.g. `localhost:8000`) the legacy web routes used by admin-services/PTM/visitor/payroll return 419, which the frontend explains as "This endpoint is not exposed as a stateless API yet" (`lib/erp-legacy.ts` `failureFrom`).
**Impact:** Blade/cookie-session users on production are exposed to CSRF; environment-dependent breakage for the SPA.
**Expected Behavior:** CSRF exempt only for stateless bearer routes.
**Recommended Fix:** Remove host wildcards, exempt the specific stateless paths.
**Verification:** Cross-site POST with cookies to a web route returns 419 on prod host.

## HR-29
**Severity:** Medium   **Type:** Confirmed
**Category:** Security
**Module:** Talent, Task, General (third-party data flows)
**Location:** `D:\lms_k12\app\talent-management\_lib\recruitment-api.ts:204-220`; `app\task-management\my-tasks\components\create-task-modal.tsx:379-393`; `app\general\implementation_management\ImplementationManagementPage.tsx:94,103`; `app\layout.tsx:35,41`
**Function/Method:** `sendJobPostingWebhook`, `sendAssignmentWebhook`, external links
**Problem:** The browser sends job postings (form fields and JD analysis in a GET query string) and full task content to hardcoded n8n URLs (one is a `webhook-test` endpoint) with no auth, tenant tag or configurability; staff/student "template" download links point to `http://apps.triz.co.in/excel_upload/export_xlsx.php?module=tbluser|tblstudent` (cleartext HTTP to a different host); the root layout loads `verify.min.js` from jsdelivr without SRI.
**Impact:** Data leakage to unmanaged endpoints, tamperable cleartext links, supply-chain exposure.
**Expected Behavior:** Server-side, configurable, authenticated integrations; HTTPS; SRI or self-hosting.
**Recommended Fix:** Move webhooks server-side behind config; serve templates from the app; add `integrity` or remove the verify script.
**Verification:** No cross-origin fetches from these components.

## HR-30
**Severity:** Medium   **Type:** Missing
**Category:** Testing
**Module:** All HR/payroll/leave/talent/import/easy_com
**Location:** `D:\lms_k12` (only `lib/process/conversion.test.ts` in scope); `D:\next_lms_erp\tests\` (no leave/payroll/talent/import tests)
**Function/Method:** -
**Problem:** No automated tests protect the leave-day, balance, payroll-day, PF/PT, or authorization rules described above.
**Impact:** Every fix in this report is at regression risk; issues HR-09 to HR-13 exist unnoticed.
**Expected Behavior:** Golden tests for calendar/payroll math and authorization matrices per route.
**Recommended Fix:** Add PHPUnit feature tests for leave/payroll/attendance/import and a route-authorization matrix test (each route x role).
**Verification:** CI red before fixes, green after.

## HR-31
**Severity:** Medium   **Type:** Confirmed
**Category:** Security
**Module:** Staff documents and payslips
**Location:** `D:\next_lms_erp\app\Http\Controllers\api\OrganizationManagement\EmployeeDirectory\EmployeeDirectoryController.php:912-965`; `PayrollController.php:2240-2273`; `D:\lms_k12\app\organization-management\employee-directory\components\edit-employee\upload-doc-tab.tsx:144`
**Function/Method:** `uploadDocument`, `monthlyPayrollStore` (payslip generation)
**Problem:** Staff documents (PAN, Aadhaar, payslips are `document_type_id=56`) are stored on the Laravel `public` disk as `<userid><timestamp>.<client ext>`, the upload takes any extension and any target `{id}` (not checked to belong to the tenant), and the UI links to a fixed public DO Spaces prefix `hp_staff_document/`. File names are predictable.
**Impact:** Payslips and identity documents retrievable by anyone who can guess `<id><YmdHis>`; upload of executable/HTML content.
**Expected Behavior:** Private storage, signed URLs, MIME allow-list, tenant-checked user id.
**Recommended Fix:** Private disk, random names, authorise download by owner/HR, validate target user.
**Verification:** Anonymous GET of a stored document returns 403.

## HR-32
**Severity:** Medium   **Type:** Architectural
**Category:** Business Logic
**Module:** Payroll statutory rules
**Location:** `D:\next_lms_erp\app\Http\Controllers\Payroll\PayrollController.php:2060-2064,2097-2147`
**Function/Method:** `getEmpMonthlyData`
**Problem:** Statutory rules are hardcoded: `if month=="Feb" && payrollType->id==2 => 300` (id 2 assumed to be PT for every tenant), component names matched as strings ("BASIC","GRADE PAY","D.A","HRA","OTHER ALLOW","PF","PT","ESIC"), PF cap 1800 when base < 15000, month-name logic, INR/India only.
**Impact:** Tenants with differently named or ordered payroll types get wrong PF/PT/ESIC; rules cannot change without code.
**Expected Behavior:** Rule identifiers on `payroll_types` and effective-dated slab tables.
**Recommended Fix:** Add `statutory_code` to `payroll_types`, move slabs to tables.
**Verification:** Rename "PF" component: computation still applies PF.

## HR-33
**Severity:** Low   **Type:** Architectural
**Category:** Frontend
**Module:** Shared components
**Location:** `D:\lms_k12\components\ui\*` vs `components\ui\g2g\*`; `components\templates\DocumentFrame.tsx`; `lib\gtg-org-data.ts`; `app\talent-management\compensation\page.tsx`; `app\easy_com\sms_api\page.tsx`
**Function/Method:** -
**Problem:** Nine primitives exist twice with both variants in active use (button 381 vs 55 importers, select 32 vs 71, card 162 vs 22, input 210 vs 32, table 144 vs 17, dropdown-menu 16 vs 12, badge 48 vs 14, textarea 69 vs 14, data-table 11 vs 2). Dead code: `DocumentFrame.tsx` and `gtg-org-data.ts` have zero importers; `easy_com/sms_api/page.tsx` is a 1-line stub beside the real `manage_sms_api`; the Compensation page re-renders `PerformanceCenter`.
**Impact:** Design drift, larger bundle, confusing navigation.
**Expected Behavior:** One primitive set; no dead files.
**Recommended Fix:** Consolidate on one set, delete the dead files, redirect duplicate routes.
**Verification:** No unused-export report entries.

## HR-34
**Severity:** Low   **Type:** Confirmed
**Category:** Frontend
**Module:** HRIT, Org
**Location:** `D:\lms_k12\app\hrit\attendance-management\attendance-reports\page.tsx:614-622`; `RecentLeaveRequests.tsx:102`; `app\organization_managment\oragnization_profile\page.tsx:539,542`; `app\components\Sidebar.tsx:113`
**Function/Method:** handlers
**Problem:** Stub handlers only `console.log`; two log the full user session and org record to the browser console.
**Impact:** Dead buttons, session data in console.
**Expected Behavior:** Working actions; no session logging.
**Recommended Fix:** Implement or remove; delete the logs.
**Verification:** Buttons act; no logs.

## HR-35
**Severity:** Low   **Type:** Confirmed
**Category:** Database
**Module:** General > Implementation management
**Location:** `D:\next_lms_erp\app\Http\Controllers\api\GeneralSetupApiController.php:293-296`
**Function/Method:** implementation save
**Problem:** The transaction deletes `implementation_master` rows for the whole tenant (`where sub_institute_id`), not the current `syear`, then inserts only the current year, wiping earlier years' implementation totals.
**Impact:** Loss of historical data on every save.
**Expected Behavior:** Delete/replace only the edited year.
**Recommended Fix:** Add `->where('syear',$syear)`.
**Verification:** Save year N+1; year N rows survive.

## HR-36
**Severity:** Info   **Type:** Improvement
**Category:** Authorization
**Module:** General config APIs (positive control)
**Location:** `GroupwiseRightsApiController.php:45-95`, `IndividualRightsApiController.php`, `MobileAppMenuRightsApiController.php`, `CustomFieldApiController.php`, `GeneralSetupApiController.php:28-96`, `UserManagementApiController.php:20-100`, `RolePermissionsController.php:52-68`
**Function/Method:** `context()/permissions()/authorizeAction()`
**Problem:** These controllers are the reference implementation: JWT validated, token `id` and `sub_institute_id` compared to the request, active user re-read from DB, profile/individual/group rights consulted. The remaining HR/org/task/easy_com/import controllers in this report do not follow it.
**Impact:** Inconsistent security posture; easy to fix by reuse.
**Expected Behavior:** One shared authorization concern.
**Recommended Fix:** Extract these checks into a trait/middleware (`perm:<route_name>,action`) and apply it to the endpoints in HR-03, 07, 09, 15, 16, 21, 22.
**Verification:** Route-authorization matrix test passes.

---

ISSUE COUNTS: C=8 H=15 M=9 L=3 I=1

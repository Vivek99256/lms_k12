# PART 10 — Laravel backend (`D:\next_lms_erp`) as consumed by `lms_k12`: authorization, tenancy, injection, uploads, AI/MCP, jobs, integrations, database

Auditor: agent `part10-laravel-backend-authz-tenant`  |  Issue prefix: `BE`  |  Mode: static analysis only (no artisan, no DB, no HTTP, no `.env` read)
Companion file: `D:\lms_k12\AUDIT\parts\part10-laravel-route-inventory.csv` — one row for **every one of the 3,094 route declarations** (file, verbs, URI, controller@action, middleware, route-level-auth Y/N, heuristic controller-level tier, referenced-by-lms_k12 Y/N).

How the route map was produced (so the numbers can be trusted, and their limits): `routes/*.php` cannot be listed with `artisan route:list` (it crashes on a missing `ResultAdminPermissionController`, per project memory, and artisan is off-limits here). Instead a throw-away PHP script (scratchpad, not in the repo) defined a *fake* `Route` facade, `include`d every route file **without booting Laravel or touching the DB**, and recorded verb/URI/action/effective middleware including nested `Route::middleware()->prefix()->group()` stacking and the provider-level group each file is mounted in (`RouteServiceProvider::map()`, `AiServiceProvider`, `McpServiceProvider`, `PALServiceProvider`). Limits: `Route::resource/apiResource` is one row each (387 declarations that really expand to 5–9 routes each, so the effective route count is roughly 5,000); `custom_module.php` aborted part-way (needs the `DB` facade) so 9 of its 18 routes are recorded; named-route middleware from `->withoutMiddleware()` was recorded but not applied. `whereRaw`/injection findings come from reading code, **no exploit was executed**.

---

## 1. Scope & coverage

Backend size: 3,299 PHP files / ~684 k lines in `app`,`routes`,`config`,`database/migrations`; 835 controller files; 474 models; 1,084 migrations; 41 route files; 33 middleware files; 4 jobs; 1 event + 1 listener; 0 observers; 0 policies; 124 test files.

| Area/dir | Files in scope | Read fully | Skimmed (partial read / targeted grep) | Not reviewed | Notes |
|---|---|---|---|---|---|
| `routes/*.php` | 43 (41 route files + `channels.php`, `console.php`) | `api.php` (999 l), `adminapi.php`, `teacherapi.php`, `mcp.php` (head), `ai.php` (head) | the other 36 — machine-recorded by the stub (all 3,094 declarations captured), comments read where auth was documented | `channels.php`, `console.php` | `custom_module.php` only half recorded (see above) |
| `app/Providers` + `app/Http/Kernel.php` | 8 + 1 | `Kernel.php`, `RouteServiceProvider.php`, `EventServiceProvider` | `AiServiceProvider`, `McpServiceProvider`, `PALServiceProvider` (route loading + rate limiter only) | `AppServiceProvider`, `AuthServiceProvider` (only checked `$policies` is empty) | no Gates/Policies exist |
| `app/Http/Middleware` | 33 | `ApiSessionHydrator`, `Concerns/HydratesLegacyApiSession`, `LmsApiAuth`, `SessionMiddleware`, `RequireStaffRole`, `checkPermission`, `RequirePermission`, `McpAuth`, `McpContextHydrator`, `McpRateLimit`, `LogRouteMiddleware`, `VerifyCsrfToken`, `Brain/BrainAuthenticate`, `Brain/BrainTenantScope`, `Authenticate` | `PalApiAuth` (~80 %), `MenuMiddleware` (head) | `EsoStudentOnlyAuth`, `RequireLmsStaff`, `TaskPermissionMiddleware`, `Throttle*Generation`, `McpRestDeprecation`, `MasterSetupMenuMiddleware`, `Brain/BrainRequirePermission` | |
| `config/` | 55 | `cors.php`, `queue.php` (default), `filesystems.php`, `brain.php`, `lms_content.php` (flag), parts of `session.php`, `app.php`, `auth.php` | — | 45 others | `.env.example` read; live `.env` **not read** |
| Controllers (835 files) | 835 | see "Controllers read" list below (≈40) | ≈250 via targeted grep / classification script (auth, tenant source, uploads, raw SQL, exit/print_r, getMessage) | ≈545 | Business logic depth deliberately sacrificed for breadth of auth/tenant checks |
| `app/Mcp` + `Services/Mcp` | 96 tools + 55 services | `AbstractMcpTool`, `ToolRegistry`, `McpConfirmationService`, `McpContextResolver`, `ToolsCallController`, `AdmissionsConfirmTool`, `AdmissionsUpdateEnquiryTool`, `FeesArrearsTool` | grep across all 96 tools for `authorize`/`allowedRoles`/`isReadOnly` | 93 tool bodies, all services except context resolver/confirmation | |
| `app/Http/Controllers/AI` | 17 | `AiController`, parts of `AiConfigurationController`, `AiModuleModelController`, `AiAssistanceTicketController`, `ReportController`, `RecommendationController` | grep of the rest for role checks | `AskController` internals, `Domain/AI/*` | |
| Jobs / Events / Listeners / Console | 4 / 1 / 1 / 55 commands + Kernel | `Console/Kernel.php`; job headers (`tries/timeout/failed`) | job bodies grepped | 55 artisan commands (not web-reachable) | no Observers directory |
| `database/migrations` | 1,084 | — | all parsed programmatically (create tables, `sub_institute_id` presence, indexes, FKs, guards, sensitive column names) | — | migrations are documented as **drifted from live DB**; results are "what migrations say" |
| `app/Models` | 474 | `loginModel` | programmatic `$fillable/$guarded` census | — | |
| `public/*.php` (web-root scripts) | 15 tracked | `add_user_hrms.php`, `test.php`, `123.php`, `general_integration.php` (head), `hrms_api.php` (head), `default_groupwise_rights.php` (head), `student_photo_integration.php` (head), `excel_upload/db.php` | credential/`$_REQUEST` census of all 15 | `public/library/*` (264 files), `getworkflow.php`, other legacy dirs | |
| Payment gateways | `fees/online_fees/*` | Razorpay handler, ICICI, ICICI Orange, Aggrepay, PayPhi, HDFC/CCAvenue handlers (heads) | | Axis internals, `hdfcrazorpay`, NACH imports, reconciliation | |
| Tests | 124 | names only | | | |

**Controllers read (fully or substantially):** `api/ApiLoginController` (login + `verifyAndUpgradePassword` + token issue), `api/UserManagementApiController`, `api/Leave/LeaveRequestApiController` (+ `ResolvesLeaveContext`), `api/Attendance/Concerns/ResolvesAttendanceContext`, `api/Concerns/ResolvesApiIdentity`, `api/MigrationModulesApiController`, `api/StudentSetupApiController`, `api/StudentsDashboardApiController`, `api/PettyCashApiController` (helpers + delete), `api/ComplaintApiController` (auth + destroy), `api/MenuRightsController` (`getMenuRightsLevelWise` head + queries), `api/ApiLmsCourseController` (lines 60–200 + grep of entire file), `api/ExamEvaluationApiController::publish`, `api/admissionRegistrationAPIController` (index, saveStudent head), `api/adminapiController` (`admin_login`, `admin_check_otp`), `api/apiController` (student OTP flow), `api/ImportApiController` (parse/process), `api/MobileWebHandoffApiController::claims`, `superAdminController`, `FileController::downloadFolder`, `CkeditorFileUploadController`, `WhatsappController` (`whatsappCRM`, `incomingMessage`, webhooks), `Auth/ForgotPasswordController`, `loginController` (auth query), `user/tbluserController::saveData/updateData`, `student/StudentCertificateApiController` (head), `AJAXController::lmsDataApi/ajax_sendmail/geminiAI`, `fees/online_fees/online_fees_collect_controller` (response handlers), `fees/fees_collect/fees_collect_controller::PaidUnpaid`, `AI/*` and `Mcp/*` files listed above, `Helpers/Helper.php` lines 1795–1830 and 1975–2060.

**Route-level auth summary (all 3,094 declarations):**

| Route file | Mounted with | Decl. | route-level auth | none | notes |
|---|---|---|---|---|---|
| `api.php` | `api` (throttle:1000,1/IP) | 429 | 101 | **328** | mix of `api.session`, `lms.auth`; rest rely on controller code |
| `resultapi.php` | `api` | 185 | 185 `api.session` | 0 | authn only, no permission |
| `easycomapi.php` | `api` | 36 | 36 `api.session` | 0 | authn only |
| `talent_management.php` / `competency_management.php` / `task_management.php` / `g2g_lms.php` / `organization_management.php` | `api` | 178/148/87/148/54 | all `api.session` (+`staff.only` on 3 of 5) | 0 (1 public certificate-verify in g2g) | `organization_management` = `api.session` only |
| `pal_api.php` / `pal_eso_api.php` | **none** (no `api` group → no throttle) | 151/22 | `pal.auth` (+`eso.student` on 17) | 4 (`api/pal/pedagogy-engine/*`) | learner-ownership check in `PalApiAuth` |
| `ai.php` / `mcp.php` | `api` + `McpAuth`+`McpRateLimit`+`McpContextHydrator` | 89/7 | all | 0 | 60 req/min/user |
| `brain.php` | `api` + `brain.auth` + `brain.tenant` + `brain.permission:*` | 93 | all | 0 | best-governed surface |
| `platform.php` | `api` + `lms.auth` + `perm:`/`lms.staff` | 16 | all | 0 | `lms.auth` is **warn-only by default** |
| `documents.php` / `mobile_page_builder.php` / `api_hostel.php` | `api` | 3/13/4 | `api.session` | 0 | authn only |
| `adminapi.php` / `teacherapi.php` | **none** (no `api`, no `web`) | 63/34 | 0 | **97** | legacy mobile APIs; JWT checked in controller body; **no throttle at all** |
| `web.php` | `web` | 324 | 180 | **144** | see BE-01…BE-07 |
| `student.php` | `web` | 163 | 102 | 61 | includes `student/api/*` anonymous group |
| `lms.php` | `web` | 285 | 227 | 58 | |
| `fees.php` | `web` | 149 | 118 | 31 | 31 = gateway callbacks (`check_permissions` only) |
| `result.php`, `admission.php`, `hrms.php`, `user.php`, `settings.php`, `inventory.php`, `frontdesk.php`, others | `web` | see CSV | mostly `session`+`check_permissions` | 23/10/2/1/0/0/0… | |
| **Total** | | **3,094** | **2,315** | **779** | 270 declarations are in *neither* the `api` nor `web` group (adminapi 63, teacherapi 34, pal 173) |

Auth mechanisms present: (1) GenTux JWT (`generationtux/jwt-artisan`, HS256, secret `JWT_SECRET`) validated by `api.session`, `lms.auth`, `pal.auth`, `McpAuth`, `brain.auth`, and by ~70 controllers themselves; (2) cookie session (`web` group) for Blade; (3) `session` middleware = cookie session *or* JWT when `type=API|JSON` is posted; (4) Laravel `auth`/Sanctum is **not used** (Sanctum middleware commented out; guard `api` = `token` driver unused). Middleware groups: `web`, `api` only. Throttle: `throttle:1000,1` on the `api` group (per IP) and 3 route-level throttles (`throttle.contentgen` ×2, `throttle.qgen` ×1); nothing on `web`, `adminapi`, `teacherapi`, `pal_*`, login or OTP routes. CSRF exceptions (`VerifyCsrfToken`): `api/*`, `fees/*` (all 149 cookie-session fees routes), `circular/*`, 3 hard-coded full URLs, `studentAspiration|Ambition|Originality`, three `lms/pal/*` paths. CORS (`config/cors.php`): `paths ['*']`, all methods/headers, `supports_credentials=false`, origins from `CORS_ALLOWED_ORIGINS` (**default `*` if unset**; `.env.example` sets it empty → allow-list empty, only pattern `^https://lms-k12-[a-z0-9-]+\.vercel\.app$`); live value NOT VERIFIED.

---

## 2. Module inventory (backend families the frontend consumes)

"Tier" = what the controller enforces (my heuristic classification of every route lacking route-level auth; see CSV col G): **A** JWT verified + tenant taken from token + rights check; **A2** JWT + tenant from token, *no* role/rights; **B** JWT merely *valid*, tenant/user/role taken from request body; **C** no authentication in the controller.

| Module | Backend (Laravel controller/route) | lms_k12 references | DB tables (seen) | Permissions/roles enforced | Status |
|---|---|---|---|---|---|
| Login / token | `api/ApiLoginController@login` (`POST /api/api-login`), legacy `apiController@login/check_otp`, `adminapiController@admin_login/admin_check_otp` | AuthContext | `tbluser`,`tblstudent`,`tbluserprofilemaster` | none (see BE-14…16) | Working, weak |
| Menu / rights | `api/MenuRightsController` (`/api/menu-rights`, `/api/master-menu-rights`), `Groupwise/Individual/MobileApp*RightsApiController` | sidebar | `tblmenumaster`,`tbl*_rights` | menu endpoints **Tier C + SQLi**; rights editors Tier A | Broken (security) |
| Users / profiles | `UserManagementApiController` (11 routes) | `/users`, `/user-profiles` | `tbluser`,`tbluserprofilemaster` | Tier A (token-bound, admin/rights) — best-built controller; leaks `password`,`plain_password` (BE-14) | Complete |
| Students | `student.php`, `tblstudentController`, `adminapi.php` `Student*ApiController` (7) , `StudentsDashboardApiController` | students pages | `tblstudent`,`tblstudent_enrollment` | dashboards Tier C; `Student*Api` Tier B; certificate/icard `student/api/*` Tier C | Partial (security gaps) |
| Admissions | `admission*APIController` (17 routes in `api.php`), `admission.php` web | admissions | `admission_enquiry`,`admission_registration`,`tblstudent` | **Tier C** (incl. `POST /api/admission_student` creates students) + SQLi | Broken (security) |
| Fees | `fees.php` (149), `FeesDashboardApiController`, `FeesRefundApiController`, `fees_collect_controller`, `online_fees_collect_controller` | fees | `fees_*`, `fees_payment` | `session`+`check_permissions` (bypassable, BE-10); `PaidUnpaid` IDOR; gateway callbacks unsigned (BE-08) | Complete/weak |
| Attendance (HR) | `api/Attendance/*` (9), `HRITDashboard/*` | `/attendance/*` | `hrms_*` | Tier A2 (tenant from token; **no role**) | Complete/weak |
| Attendance (students) | `student/studentAttendanceController` (`type=API` branch) | | `attendance_student` | Tier B | Partial |
| Timetable | `TeacherTimetableApiController` (`api.session`), `faculty/classwisetimetableController` (`teacherTimetableAPI`,`studentTimetableAPI`, no auth) | | `timetable` | mixed | Partial |
| Exam / result | `resultapi.php` (185, `api.session` only), `ExamEvaluationApiController` (12, **Tier C**), `ApiQuestionPaperController`, `AssessmentBlueprintApiController`, `QuestionPaperTemplateApiController` (all Tier C) | result, exam | `result_*`,`lms_offline_exam`,`exam_evaluation_*` | none beyond login | Broken (security) |
| HR / leave / payroll | `api/Leave/*` (34), `HRMS/departmentController` (18), `Payroll/PayrollController` (web), `/table_data` (anonymous, BE-01) | hrit, leave | `hrms_emp_leaves`,`tbluser` | leave/department Tier A2 (no role) | Complete/weak |
| LMS course & content | `ApiLmsCourseController` (15, **Tier C**), `lms.php` (285), `lms/content*` ; authoring 4 routes `lms.auth`+`perm` (warn-only) | course pages | `content_master`,`chapter_master`,`lms_question_master` | Tier C for reads *and* writes | Broken (security) |
| Homework / assignment | `StudentHomeworkApiController` (14, C), `LmsAssignmentApiController` (12 C + duplicates behind `api.session`), `HomeworkSubmissionApiController` (`api.session`) | LMS | `homework`,`lms_assignment` | duplicate route definitions: the *unauthenticated* first registration is shadowed only if URI+verb equal; see BE-07 | Partial |
| PAL / ESO | `pal_api.php` (151), `pal_eso_api.php` (22), `EsoEngineController` | pal, eso | `pal_*` | `pal.auth` + learner ownership + `eso.student` (good) | Complete |
| AI (`/api/ai/*`) | `AI/*Controller` (17 controllers, 89 routes) | ai | `ai_*` | authn + tenant hydrated; **no role gates** on config/policies (BE-19) | Complete/weak |
| MCP (`/api/mcp`, JSON-RPC + REST shim) | `Mcp/*`, `app/Mcp/Tools` (96) | `app/api/mcp` proxy | `mcp_*` | role = admin/staff/student only; `required_permission` not enforced (BE-20) | Complete/weak |
| Task mgmt | `task_management.php` (87) | tasks | `task_*` | `api.session`+`staff.only`; `task.permission` on 4 report routes only | Partial |
| Talent / competency / org mgmt | `talent_management.php`, `competency_management.php`, `organization_management.php` | people | `talent_*`,`org_*` | `staff.only`; admin gate (`RequiresTalentAdmin`) on 27 of 63 talent controllers; org: 3 of 8 | Partial |
| Easy Communication | `easycomapi.php` (36) + `WhatsappController` | communication | `sms_api_details`,`smtp_details`,`whatsapp_*` | **authn only** (BE-13) | Complete/weak |
| Import | `api/ImportApiController` (4, `api.session`) | `app/api/import` | `import_table_fields`,`csv_data` | authn only (BE-21) | Complete/weak |
| Integration configs | `SmtpApiController`, `SmsApiMasterApiController`, `WhatsappApiConfigApiController`, `fees/online_fees/*settings*` | integration-configs | `smtp_details`,`fees_razorpay`,… | secrets masked on read (good), stored plaintext | Complete/weak |
| Dashboards | `RoleDashboardApiController`, `*DashboardApiController` (5 anon), `UserDashboardPreferenceApiController` | dashboards | many | role dashboards Tier A(`api.session`); 5 module dashboards **Tier C** | Partial |
| Mobile bridge | `MobileWebHandoffApiController`, `MobileWebBridgeController`, `MobileDynamicPage*`, `mobile_page_builder.php` | `loginFromHandoffTicket` | `mobile_web_handoff_token` | ticket sha256-hashed, single-use, atomic burn (good) | Complete |
| Brain | `brain.php` (93) | `/brain` | `brain_*` | full stack: JWT, tenant, permission | Complete |
| Web-root PHP scripts | `public/*.php` (15) | none | direct DB | none (BE-06) | Deprecated / dangerous |

Backend-without-UI: `teacherapi.php` (34 routes, 0 referenced), `inventory.php` (27, 0), `hostel_management.php` (17, 0), `skill.php` (9, 0), `implementation.php`, most of `adminapi.php`, `platform.php` (15/16) — heuristic literal match, lower bound. UI-without-backend: none detected at path level (all `app/api/*` Next handlers proxy to existing Laravel paths); `NOT VERIFIED` per-parameter.
Duplicate modules under different names: Leave (`api/Leave/*` vs legacy `leave/*` vs `HrmsLeaveController`), Complaint/FrontDesk/PettyCash (API vs Blade twins), LMS assignment (defined twice in `api.php` lines 325–338 unauthenticated **and** 351–367 behind `api.session`), Result (`result.php` vs `resultapi.php`), HRMS attendance (`api/Attendance/*` vs `HRITDashboard/AttendanceApiController` vs `HRMS/HrmsController`), Department (`departmentController` serves `/departments` and `/departments-management`). Menu links to missing controllers: 16 route targets whose class is missing or wrong-cased (`lms\pedagogyEngineController` ×10 vs file `PedagogyEngineController.php`, `result\MarkUploadController` ×3, `ParaphraseController`, `H5pFlashcardController`, `TransportController`, `driver_masterController`, `vendor_masterController`, `report_module_controller`) — 500s on case-sensitive filesystems (BE-33).

---

## 3. Role / access-control findings (per module: frontend gating vs backend enforcement)

Key mechanism facts (verified in code):

1. **Identity is taken from the JWT only where a middleware/trait says so.** `HydratesLegacyApiSession::hydrateSessionFromClaims` (`app/Http/Middleware/Concerns/HydratesLegacyApiSession.php:64`) sets session `user_id`, `sub_institute_id`, `user_profile_id`, `is_admin`, `client_id`, `is_student` from the verified payload; it accepts `syear`/`term_id` from the request (allowed: same tenant only). `api.session` and (for `type=API`) the `session` middleware use it. Roles = `tbluserprofilemaster.name` looked up by `user_profile_id` (`'Super Admin'` forced if `is_admin` is 1 or 2). It does **not** re-check `tbluser.status`, so a deactivated user's token keeps working (BE-16).
2. **Authorization = menu-rights tables** (`tblindividual_rights`, `tblgroupwise_rights`) enforced by `checkPermission` middleware keyed on the **route name → `tblmenumaster.link`** (`checkPermission.php:44`). Three defects: (i) fail-open when the route has no name or no menu row (`if($menu_id!='')`); (ii) the whole check is skipped when the client sends a `submit` field containing "Search" (`checkPermission.php:76`, `!Str::contains($request->submit,'Search')`); (iii) allow-list hacks `!in_array($menu_id,[200])`, `[82,386]`. → BE-10.
3. **No Gates/Policies**; `AuthServiceProvider::$policies` empty. Newer modules use their own gates: `staff.only` (blocks Student/Parent profile names), `RequiresTalentAdmin` (`is_admin` 1|2), `perm:` (`RequirePermission` → `PermissionService`) — but `perm:` and `lms.auth` are **warn-only unless `LMS_API_AUTH_ENFORCE=true`** (`config/lms_content.php:144`, default false) — they log and let anonymous callers through.
4. Frontend role gating vs backend: the frontend hides pages by role, but every family below except Users/Brain/PAL/AcademicSetup-style controllers accepts any valid token for any action.

Per-module (frontend gating cannot be relied on; only backend enforcement listed):

| Module | Backend enforcement actually present | Gap |
|---|---|---|
| Users, profiles, rights editors, academic/transport/general/inventory setup, class teachers, teacher transfer, user logs, custom fields, teacher daily report | Tier A: `context()` verifies JWT, compares token `id`+`sub_institute_id` with request, loads active actor, then `authorizeAction()` checks `admin/super admin` or `tblindividual_rights`/`tblgroupwise_rights` for the menu link | Role test is by tenant-defined profile *name* (`in_array(strtolower(profile_name),['admin','super admin'])`) — a tenant that creates a profile called "Admin" gets admin here |
| Leave (34 routes) & HR attendance (9) | tenant from token (`ResolvesLeaveContext`, `ResolvesAttendanceContext`); every query filtered by tenant | **No role check**: any token (student included) can `POST /api/leave/requests/{id}/decision`, `bulk-decision`, `PUT /leave/workflow`, `PUT /leave/roles`, `POST /leave/leave-types`; approver identity = request `user_id`; `employee_id` in `store` lets a caller apply leave on behalf of anyone (validated only by `exists:tbluser,id`, not tenant) — BE-13 |
| Result API (185), EasyCom API (36), Org-mgmt (54, only `RolePermissionsController` asserts admin), Documents, Mobile page builder | `api.session` only | Legacy `checkPermission` was *dropped* when the JSON twins were written (`BaseEasyComApiController` docblock says so). A student token can `POST /api/result/marks-entry/approve`, send SMS/email/WhatsApp to parents, edit result masters — BE-12 |
| Talent / competency / task | `staff.only` (bare Student/Parent excluded); `RequiresTalentAdmin` on 27/63 talent controllers; `task.permission:report.view` on 4 routes | 36 talent controllers (incl. `Recruitment/CandidateController`, `Performance/PerformanceActivityController`, `Performance*Compensation/Bonus/Review` partially) reachable by any staff role, incl. Teacher/peon |
| LMS authoring (4 routes) | `lms.auth` + `perm:lms.content,create` | warn-only default; the other ~40 `api.php` LMS routes, including question-bank create/update/delete/review and `lms-chapters/store`, `lms-store-subject`, have nothing (BE-07) |
| Dashboards | `admin-dashboard`, `teacher-dashboard`, `student-dashboard` identity from JWT (good) | `admissions/students/library/hostel/transportation-dashboard/summary` = no auth |
| AI console (`/api/ai/*`) | `McpAuth` (any valid JWT, students included) + tenant context; tickets/reports/outcomes controllers gate on `$scope->isAdmin` | `AiConfigurationController`, `AiModuleModelController::storeCredential`, `AiPolicyController`, `AiTemplateController` have **no role gate** (BE-19) |
| MCP tools | role ∈ {admin, staff, student}; `student` denied for all tools by default (`allowedRoles()`=admin,staff); `AdmissionsConfirmTool` additionally requires admin | `required_permission` annotation on 93 tools is decorative (BE-20) |
| PAL/ESO | `pal.auth`: learner ownership (student = own id; teacher = class-teacher/timetable scope; admin = tenant/client scope) | good; 4 pedagogy-engine reads anonymous |
| Brain | JWT + tenant + role map by *profile name* + per-verb permission | tokens signed with `APP_KEY` also accepted (BE-16) |

---

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
| AI / MCP | token ✔ (`X-MCP-Institute-Id` only within allowed set; platform admin `is_admin=2` may switch) | ✔ (services filter by context) | partial (BE-19/20) | – | – | screenshots as data-URI, stored on `local` disk (ok) | ✔ |
| Brain | token ✔ + `brain.tenant` (route tenant must equal token tenant) | ✔ | ✔ | – | – | – | ✔ |

Academic year: `syear`/`term_id` accepted from the client everywhere; defaulted to the current term by date when absent (`hydrateSessionFromClaims`). Cross-year reads are tenant-safe but unrestricted for students (a student can read prior years).

---

## 5. API endpoints consumed or exposed

Full machine inventory: **`part10-laravel-route-inventory.csv`** (3,094 rows). Compact view below.

### 5.1 Routes per file and lms_k12 usage (heuristic literal match, over-counts)

| File | Decl. | Referenced by lms_k12 | File | Decl. | Referenced |
|---|---|---|---|---|---|
| api.php | 429 | 304 | task_management.php | 87 | 64 |
| web.php | 324 | 88 | hrms.php | 80 | 23 |
| lms.php | 285 | 103 | adminapi.php | 63 | 9 |
| resultapi.php | 185 | 115 | organization_management.php | 54 | 53 |
| talent_management.php | 178 | 170 | easycomapi.php | 36 | 5 |
| student.php | 163 | 63 | teacherapi.php | 34 | 0 |
| pal_api.php | 151 | 95 | admission.php | 32 | 12 |
| fees.php | 149 | 46 | inventory.php | 27 | 0 |
| competency_management.php | 148 | 98 | frontdesk.php | 26 | 9 |
| g2g_lms.php | 148 | 47 | settings.php | 26 | 4 |
| result.php | 106 | 58 | user.php | 24 | 4 |
| brain.php | 93 | 93 | pal_eso_api.php | 22 | 20 |
| ai.php | 89 | 35 | (17 smaller files) | ≈250 | ≈100 |

**302 routes referenced by lms_k12 have no route-level auth** (api.php 233, web.php 26, student.php 13, result.php 10, adminapi.php 9, lms.php 5, pal_api 2, visitor 2, admission 1, g2g 1). Many are Tier A/A2 (they authenticate inside the controller); the Tier B/C ones are BE-01…BE-11.

### 5.2 Anonymous (Tier C) endpoint families in `routes/api.php` — full controller list

(`prefix /api`; verbs abbreviated; each row = every route of that controller)

| Controller | Routes | Notes |
|---|---|---|
| `ApiLoginController` | POST `api-login`, GET `academic-terms` | intended public |
| `apiController` (legacy mobile) | POST `login, login_hills, check_otp, homescreen, teacherlogin, teacher_check_otp, playscreen, gcm_insert`, GET `testkey` | OTP flow, BE-15 |
| `MobileWebHandoffApiController@claims` | GET `mobile/web-handoff/claims?ticket=` | intended public; secure |
| `MenuRightsController` | POST `menu-rights`, GET `master-menu-rights` | **SQLi**, BE-01 |
| `ApiLmsCourseController` | GET/POST `lms-courses`, `lms-courses/search`, POST `lms-chapter-concepts`, `lms-chapters`, `lms-chapter-content`, `lms-questions`, `lms-question-bank`, `lms-question-bank/{create,update,delete,review}`, GET `question-mapping-levels`, POST `lms-chapters/store`, `lms-content-mapping-values`, `lms-store-subject` | **SQLi (search)**, anonymous CRUD |
| `ApiQuestionBankController` | GET/POST `question-bank/{filters,search,question-types}` | |
| `contentController@storeGammaContent` | POST `lms/gamma-content-master` | LLM spend; only throttle |
| `AiSopGenerationController`, `AiPlatformController` | GET `ai-sop`, `ai-sop/department-job-roles`, `ai-platforms`, POST `ai-sop/generate` (outbound `Http::timeout(90)` LLM call), `ai-sop/store` | anonymous LLM + write |
| `StudentHomeworkApiController` | POST `lms-homework/{get-subjects,get-chapters,list,store,show/{id},update/{id},delete/{id},bulk-delete,students,homework-subjects,submission-list,submission-store,submission-report,ai-status/{id}}` | 14 |
| `LmsAssignmentApiController` | POST `lms-assignment/{subjects,students,exam-papers,store,list,bulk-delete,submission-list,submission-store,ai-status/{id},annotate-list,annotate-questions,annotate-store}` | first (anonymous) registration; later duplicate registrations with `api.session` do **not** remove it |
| `admissionEnquiryAPIController`, `onlineAdmissionConfirmAPIController`, `admissionRegistrationAPIController` | GET/POST/PUT/DELETE `admission_enquiry`, `online_admission_confirm`, `admission_registration`, POST `admission_student`, GET `ajax_getDivision`, `admission_without_confirmation_report_v2` | **SQLi**, creates students |
| `ApiQuestionPaperController`, `QuestionPaperTemplateApiController` | apiResource `question-paper`, GET `question-paper/{id}/pdf`, POST `question-paper/search`, `question-paper-templates*` (6) | |
| `ExamEvaluationApiController` | 12 routes: sheets review/reprocess/delete/file, batches CRUD, `batches/{id}/sheets` upload, `batches/{id}/publish` | **gradebook write** |
| `AssessmentBlueprintApiController` | 10 routes incl. `hpc-options` save/reset, `clone` | |
| `IntelligenceLessonPlan/CurriculumPlanning/MonthlyPlan/LessonPlanDetail/LessonPlanPeriod/LessonPlanLookup/LessonIntelligence/SemanticIntelligence/ConceptIntelligence*` | 30 routes; `lesson-intelligence/micro-plan/*` = billable DeepSeek calls | anonymous LLM spend |
| `InteractionLogController` | GET/POST `interactions`, POST `interactions/store`, `interactions/{id}/update` | staff/parent/student touchpoint log |
| `DocumentTemplateApiController` | 12 routes | |
| `Admissions/Students/Library/Hostel/TransportationDashboardApiController` | POST `*-dashboard/summary` | PII (recent student names) |
| `StudentGraphController`, `StudentResultGraphController` | GET `student-assessment`, `student-results/{stuId}/graph` | student result graph (Neo4j) |
| `WhatsappController` + 2 closures | POST `update-message`, `incoming-message`, `whats-send-app`, `whats-comming-app`; GET `crm-whatsapp`, `crm-whatsapp-update` (`->withoutMiddleware(Authenticate)`) | BE-04 |
| `instituteDetailController` | GET/POST `compliance/{list,create,update/{id},delete/{id}}` | controller has JWT calls (B2) |
| `MigrationModulesApiController` | GET/POST `migration-modules/{module}`, DELETE `migration-modules/{module}/{id}` | Tier B |

### 5.3 Tier B (JWT valid, tenant from request) — 46 controllers / 199 routes

`adminapiController` (40), `apiController`, `StudentSearch/BulkStudent/StudentInfirmary/StudentCare/StudentSetup/StudentOptionalSubject/StudentRegistrationApiController` (23), `ComplaintApiController`, `ConsentApiController`, `FrontDeskApiController`, `PhotoVideoGallaryApiController`, `PettyCashApiController`, `MigrationModulesApiController`, `admissionEnquiryController`/`admissionRegistrationController` (web), `lms_apiController` (17), `tblstudentController` (12), `studentHomework/HW/Health/Vaccination/Infirmary/Attendance/Certificate controllers`, `visitor_masterController` (5), `ptmattenedstatusController`, `calendar_controller`, `leaveApplicationController`, `parentCommunicationController`, `circular/discipline/photo_video_gallary/exam_schedule/school_detail` controllers, `send_sms_parents_controller`, `send_email_parents_controller`, `tbluserController`, `classwise/facultywise/proxyController`, `cbse_1t5_result_controller`, `classwiseGradeReportController` … (full list: CSV col G = `B-jwt-valid,client-tenant`).

### 5.4 Selected endpoint security table (verified by code reading)

| Method + URL | Auth (actual) | Validation | Notes |
|---|---|---|---|
| POST `/api/api-login` | none (public) | email required, password required | no throttle/lockout beyond 1000/min/IP; plaintext/md5 legacy fallback; first row by email |
| GET `/lms_data`, `/table_data` | **none** (web group, no `session`) | table must exist | dumps **any table**, `filters[col]=val`, `multiple[col]`, `all_tables=1`, `table_data=1&table_name=` (BE-01) |
| POST `/superAdmin-store` | **none** | none | creates Super Admin + rights on every menu (BE-02) |
| GET `/download-folder` | **none** | – | zips `he_staff_document/` from DO Spaces (BE-03) |
| GET `/api/crm-whatsapp` | **none** | none | WhatsApp send + SSRF + file write (BE-04) |
| POST `/ckeditor` | **none** | `isValid()` only | keeps client filename, `public/lms_editor_upload/` (BE-05) |
| POST `/api/menu-rights` | **none** | none | interpolated SQL (BE-01) |
| GET|POST `/api/lms-courses/search` | **none** | none | interpolated SQL (BE-01) |
| GET `/api/admission_registration` | **none** | none | interpolated SQL; `POST /api/admission_student` creates students |
| POST `/api/exam-evaluation/batches/{id}/publish` | **none** | tenant int cast | writes `lms_offline_exam(+_answer)` |
| POST `/api/leave/requests/{id}/decision` | JWT (tenant token-bound) | status enum | no role |
| POST `/api/users`, `POST /api/users/{id}` | JWT + rights | validated, unique per tenant | stores `plain_password` |
| GET `/api/users/{id}` | JWT + rights/self | – | returns `select *` incl. `password`, `plain_password`, `account_no`, `ifsc_code`, `pan_no`, `otp` |
| POST `/api/fees-refund/save` | `api.session` only | – | no `check_permissions` (unlike fees-dashboard/circular/cancel) |
| POST `/fees/PaidUnpaid` | `session`+`check_permissions` | `student_id`,`sub_institute_id`,`syear` required numeric | IDOR/cross-tenant (BE-11) |
| POST `/api/import/{parse,process,match-fields}` | `api.session` | `mimes:csv,xlsx`; `tablename`,`fields[]` client-supplied | column names from client; `csv_data_file_id` unscoped; upload to `public/import/` with client extension |
| POST `/api/ai/configuration`, `/api/ai/modules/{m}/models/credentials`, `/api/ai/policies` | `McpAuth` (students allowed) | validated | plaintext `ai_api_keys.api_key`; no role gate (BE-19) |
| POST `/api/mcp/tools/call` (`tools/call`) | `McpAuth` | tool schema | see BE-20 |
| ANY `/fees/{icici,icici_orange,aggre_pay,payphi}/…ResponseHandler` | none needed by design | none | **unsigned** (BE-08) |
| GET `/api/mobile/web-handoff/claims?ticket=` | none (ticket) | – | secure single-use |

---

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

## 7. Test / documentation coverage

124 test files under `tests/Feature` and `tests/Unit`: strong on new modules (Brain 5, PAL 24 incl. `PalTeacherScopingTest`, `PalUluAuthorizationTest`, `PalMisconceptionAuthTest`; Fees 5 incl. transaction atomicity; MCP `McpSecurityStackTest`, `McpConfirmationFlowTest`, `McpToolBindingsTest`; AI 15+ unit tests; `tests/Feature/Security`). **No test hits** the unauthenticated `api.php` surface, `/lms_data`, `/superAdmin-store`, `/download-folder`, `/api/crm-whatsapp`, the payment callbacks, `checkPermission`, `LogRouteMiddleware`, the leave/attendance APIs, `ResolvesLeaveContext`, or login (grep for those routes/classes: only `PalWritePathTest`/`PalMisconceptionAuthTest` mention `api-login`). `docs/` has 60+ markdown design notes (PAL/ESO, LMS content architecture, Brain) but no API reference / threat model / route-auth matrix; inline comments repeatedly state intended-but-not-implemented controls (e.g. `LmsApiAuth` docblock: "the entire content area … calls Laravel with a bare fetch() and no Authorization header").

---

## 8. NOT VERIFIED items

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
| `DB::raw` / `whereRaw|selectRaw|orderByRaw|havingRaw` | 1,217 / 3,747 | 415 lines interpolate `$var` in 137 files (heuristic; ~60 % are joins on literals); confirmed input-tainted: BE-01 |
| `exec(`/`shell_exec(` | 8+1 | `Helper.php:1988–2054` `wkhtmltopdf` with unescaped path args and `--enable-local-file-access`; `admissionEnquiryController:1031`, `AJAXController::pythonTimetable` `shell_exec('python3 /home/admission.py')` |
| `unserialize($_REQUEST…)` | 2 | `report/dynamic_report/dynamic_report_controller.php:163,197` (PHP object injection, authenticated) |
| `curl … VERIFYPEER 0/false`; `withoutVerifying`/`'verify'=>false` | 20 / 19 | SMS, FCM, gateway calls |
| `->move(public_path…)` / `getClientOriginalExtension` files | 36 files use client extension; only 19 `mimes:` rules in all controllers | BE-05 |
| Models `$guarded=[]` / `$fillable` / neither | 35 / 321 / 58 of 474 | `loginModel::$fillable` includes `is_admin`,`sub_institute_id`,`client_id`,`user_profile_id` |
| `$request->all()`-into-write patterns | 2 direct + legacy loops building arrays from all keys (`tbluserController`) | BE-21 |
| hard-coded tenant conditionals | 218 in 34 files | `studentResultController(2)` 67, `studentCertificateController` 20, `fees_collect_controller` 17 |
| hard-coded credentials/secrets in tracked source | 3 FCM keys (`AAAA***`) `Helper.php:1808,1813,1818`; **DB passwords** (`Triz***`, `Tr!z***`) in `public/general_integration.php:5`, `getworkflow.php:4`, `hrms_api.php:6`, `library_api.php:7`, `school_integration.php:5`, `student_integration.php:5`, `subject_batch_timetable.php:5`, `test.php:5`, `user_integration.php:5`; default passwords `'admin'` (`NewLMS_ApiController:592`) and `'student'` (`NewLMS_StudentApiController:269,283`); backdoor OTP `123456` for mobiles `9979***`,`9824***` (`apiController.php:83`, `adminapiController.php:75`) | BE-06, BE-09, BE-15 |
| `Auth::`/Gate/Policy usage | 2 / policies dir absent | no framework authorization |
| `env(` calls inside `app/` | 112 | break under `config:cache` (e.g. `ApiLoginController` `JWT_TTL_MINUTES`, `WhatsappController`) — with a cached config `env()` returns null, silently disabling `JWT_TTL_MINUTES` |
| `get()` vs pagination in `api/`,`HRMS/`,`G2gLms/` | 842 `->get()` vs 158 `paginate/limit/forPage/take` | 14 files with ≥10 `get()` and none limited (`InventoryApiController` 50, `adminapiController` 34, `teacherapiController` 31, `HostelSetupApiController` 25, `TransportationApiController` 25, `UserManagementApiController` 14) |
| Route targets missing | 16 classes | BE-33 |
| Dev/test scripts tracked in repo root | 33 (`test_*.php`,`debug_*.php`,`check_*.php`,`fix_*.php`,`tmp_*.php`) + `composer.lock.bak` + `database/pal_schema_full.sql` | not web-reachable (outside `public/`) but ship credentials-by-env usage and DB probes |

---

## 10. ISSUES

## BE-01
**Severity:** Critical   **Type:** Confirmed   **Category:** Security
**Module:** Generic table API, menu rights, LMS courses, admissions, legacy result/AJAX
**Location:** `D:\next_lms_erp\app\Http\Controllers\AJAXController.php:2985-3050` (`lmsDataApi`, routes `routes/web.php:638-639` `GET /lms_data`, `GET /table_data`); `app\Http\Controllers\api\MenuRightsController.php:54,67,125-255`; `api\ApiLmsCourseController.php:108,111,117-126,144`; `api\admissionRegistrationAPIController.php:59,135,271,639,675,766`; `AJAXController.php:1327,2539,2871`; `api\teacherapiController.php:611,754`; `api\adminapiController.php:1248,1380`; `result\result_api\resultAPIController.php:289,302`; `result\cbse_result\cbse_1t5_result_controller.php:743` (+`_OLD`,`_OLD2`,`cbse_1t5_t2`,`studentResultController2:5768`,`TemplateResult:837`); `lms\content_library\contentLibraryControllerOld.php:48`
**Function/Method:** `AJAXController::lmsDataApi`; `MenuRightsController::getMenuRightsLevelWise`; `ApiLmsCourseController::search`; `admissionRegistrationAPIController::index/max_enrollment_no`; others listed
**Problem:** (1) `/lms_data` and `/table_data` are on the `web` group with no `session`/`auth` middleware and no authentication code; they dump **any table** (`?table=tbluser`), accept `filters[col]=v`, `multiple[col]`, `order_by`, `group_by`, and expose the schema (`?all_tables=1`, `?table_data=1&table_name=`). No tenant filter, no column allow-list. lms_k12 depends on it (`app/hrit/_lib/payroll-api.ts:911`, `talent-management/recruitment/components/job-posting-form.tsx:130,159,196` send a Bearer token that the server never checks). (2) Unauthenticated raw-SQL string concatenation of request input in `/api/menu-rights`, `/api/lms-courses/search`, `/api/admission_registration` and related routes; JWT-only/legacy variants in the other files.
**Evidence:** `AJAXController.php:3011-3017`: `$table = $request->table; if (!Schema::hasTable($table)) …; $query = DB::table($table);` then `$data = $query->get(); return response()->json($data);`. `ApiLmsCourseController.php:126`: `WHERE s.sub_institute_id in (" . $sub_institute_id . ",1) AND allow_content = 'Yes' " . $extra` with `$extra .= " AND STD.grade_id = '" . $grade . "'"` (l.117-119) where `$grade=$request->input('grade')`. `MenuRightsController.php:54`: `FIND_IN_SET(".$sub_institute_id.", m.sub_institute_id)` with `$sub_institute_id=$request->get('sub_institute_id')`; l.125 `find_in_set('$client_id',client_id)`. `admissionRegistrationAPIController.php:59`: `->whereRaw('(sub_institute_id = '.$sub_institute_id.' OR common_to_all = 1) and user_type="" ')`. `AJAXController.php:2539`: `chapter_id ='.$request->chapter_id.$to…`.
**Impact:** Any anonymous internet user can read every table of every school (passwords in `tbluser`, `tblstudent` PII, `fees_razorpay.key_secret`, `ai_api_keys.api_key`, `smtp_details.password`, tokens) and, via SQL injection, read/modify the database. Total confidentiality/integrity loss for all 56+ tenants.
**Expected Behavior:** Generic table readers must not exist on a public route; every query must be parameterised and tenant-scoped from the token.
**Recommended Fix:** Remove `/lms_data`,`/table_data` or replace with purpose-built, authenticated, tenant-scoped endpoints with explicit column allow-lists (HRIT payroll + recruitment lookups need `tbluser`/`hrms_departments` by tenant only). Replace every listed concatenation with bindings (`whereRaw('… = ?',[$v])`, `whereIn`, integer casts). Add a route-level `api.session` (or `lms.auth`) to the whole of `api.php` except login; add a static-analysis rule (Larastan/`grep`) forbidding `$request` inside `*Raw(`.
**Verification:** Unauthenticated `GET /lms_data?all_tables=1` must return 401; sqlmap against `/api/menu-rights`, `/api/lms-courses/search`, `/api/admission_registration` must find nothing; unit tests posting `sub_institute_id="1) OR 1=1 -- "`.

## BE-02
**Severity:** Critical   **Type:** Confirmed   **Category:** Security
**Module:** Super-admin provisioning
**Location:** `D:\next_lms_erp\app\Http\Controllers\superAdminController.php:14-102`; `routes/web.php:346-347`
**Function/Method:** `superAdminController::index`, `::store`
**Problem:** `Route::any('superAdmin')` and `POST superAdmin-store` are on the `web` group with no `session`/`auth`/permission middleware. `store()` reads `user_name,email,password,client_id,institute_id[]` from the request, inserts a "Super Admin" profile, a `tbluser` with `is_admin=1`, `sub_institute_id=0`, **plaintext password**, and inserts `tblindividual_rights` (view/add/edit/delete) for **every** `tblmenumaster` row. `index` lists all clients and all institutes.
**Evidence:** `$user->password = $password; … $user->is_admin = 1; … foreach($get_tbl_menumasters …) { … can_view=1 … can_delete=1 … }` — no identity check anywhere; `/superAdmin-store` is not in `VerifyCsrfToken::$except`, but an anonymous caller obtains a session cookie + CSRF token from `GET /login`.
**Impact:** Anonymous full platform takeover (create an admin, log in through `/api/api-login`, receive a token with `is_admin=1` → `'Super Admin'` role in `hydrateSessionFromClaims`, all menus, all clients). Also re-parents `school_setup.client_id` for any institute id supplied.
**Expected Behavior:** Only an authenticated platform admin (`is_admin=2`) may provision; ideally a CLI-only bootstrap.
**Recommended Fix:** Delete both routes or wrap with `session`+`check_permissions`+`is_admin==2` guard; hash passwords with `Hash::make`; audit-log provisioning.
**Verification:** Anonymous POST returns 401/403; new feature test.

## BE-03
**Severity:** Critical   **Type:** Confirmed   **Category:** Security
**Module:** Staff documents
**Location:** `D:\next_lms_erp\app\Http\Controllers\FileController.php:11-37`; `routes/web.php:862`
**Function/Method:** `FileController::downloadFolder`
**Problem:** `GET /download-folder` (web group, no auth) zips every file under `he_staff_document/` on the `digitalocean` disk and returns it. Also writes `storage/app/temp_documents.zip` without deleting it (`->deleteFileAfterSend(true)` commented out), so the archive persists on disk and is overwritten by concurrent calls.
**Evidence:** `$files = Storage::disk('digitalocean')->allFiles($folder); … return response()->download($zipName);`
**Impact:** Anonymous download of all staff identity/employment documents (likely Aadhaar/PAN/certificates) — bulk PII breach; unbounded memory/CPU (content read into memory per file) → DoS.
**Expected Behavior:** Authenticated, permission-checked, tenant-scoped, streamed export.
**Recommended Fix:** Remove route (looks like a one-off migration helper); if needed, put behind admin permission, scope by `sub_institute_id`, stream, delete after send.
**Verification:** Anonymous GET → 401; `he_staff_document` must not be enumerable.

## BE-04
**Severity:** Critical   **Type:** Confirmed   **Category:** Security
**Module:** WhatsApp CRM bridge
**Location:** `D:\next_lms_erp\routes\api.php:177-178`; `app\Http\Controllers\WhatsappController.php:577-644`
**Function/Method:** `whatsappCRM`, `updateCRMWhatsappStatus`
**Problem:** `GET /api/crm-whatsapp?number=&message=&file_url=` is explicitly `->withoutMiddleware([Authenticate::class])`, has no other auth, and (1) sends WhatsApp Cloud API messages to arbitrary numbers using tenant 1's stored access token; (2) `file_get_contents($file_url)` on an attacker URL (SSRF; `file://`, `http://169.254.169.254/…`) and (3) writes the fetched bytes to `public/whatsapp/wp_sent_files/<basename($file_url)>` — attacker-controlled name and content inside the web root.
**Evidence:** `$fileContents = file_get_contents($file_url); $fileName = basename($file_url); $filePath = public_path('whatsapp/wp_sent_files/' . $fileName); file_put_contents($filePath, $fileContents);`
**Impact:** Remote code execution (upload `x.php` via a URL the attacker hosts, then request it), SSRF into the internal network/cloud metadata, arbitrary WhatsApp spam billed to the school, token abuse. `updateCRMWhatsappStatus` (also anonymous) lets anyone probe message status with the tenant token.
**Expected Behavior:** Server-to-server integration must authenticate (HMAC/shared secret), validate media type/size/host allow-list, and never write into `public/`.
**Recommended Fix:** Require a signed request or `lms.auth`; drop the local copy or store outside webroot with random names; allow-list hosts; validate `number` format/length; rate-limit.
**Verification:** Unauthenticated call → 401; `file_url=file:///etc/passwd` rejected; no writes under `public/`.

## BE-05
**Severity:** Critical   **Type:** Confirmed   **Category:** Security
**Module:** File uploads
**Location:** `D:\next_lms_erp\app\Http\Controllers\CkeditorFileUploadController.php:19-33` (`POST /ckeditor`, `routes/web.php`); `app\Http\Controllers\api\PettyCashApiController.php:114-128`; `api\ImportApiController.php:32-45`; census: 36 controller files call `getClientOriginalExtension`/`move(public_path…)`, only 19 `mimes:` rules exist in all controllers
**Function/Method:** `CkeditorFileUploadController::store`, `PettyCashApiController::storeBill`, `ImportApiController::parse` (+ list in Problem)
**Problem:** Uploaded files are stored **in the web root with the client-supplied name/extension and no type or size validation**. `/ckeditor` is anonymous; the response also echoes `$funcNum` unescaped inside `<script>` (reflected XSS).
**Evidence:** `$filename = rand(1000, 9999).$file->getClientOriginalName(); $file->move(public_path().'/lms_editor_upload/', $filename);` ; petty cash: `$extension = $image->getClientOriginalExtension(); $image->move(public_path('/pettycash'), $userId.'-'.time().'.'.$extension);` with no `bill_image` rule in the controller; import: `$fileUrl->move('import/', "{$sub}_{$syear}_{rand}.".$fileUrl->getClientOriginalExtension())` after `mimes:csv,xlsx` (content-sniffed) — extension still client-chosen. Other unvalidated sinks: `adminapiController` (10), `teacherapiController` (10), `HrmsController` (4), `CustomModuleController` (6), `contentController` (6), `lmsPortfolioController` (6), `sub_std_mapController` (6), `result_master_controller` (6), `bulkStudentController` (5), `tblstudentController` (5), `StudentHomeworkApiController` (3), `frontdesk/*` and `implementation/frontdesk/*` (PettyCash, complaint, task).
**Impact:** Anonymous/any-token arbitrary file upload → web shell if PHP is executed from `public/` (unverified, common for this stack) or stored XSS via `.html/.svg`; malware hosting; disk exhaustion.
**Expected Behavior:** Allow-list MIME + extension, random server-side names, store on a non-executable private disk, serve via signed/authorised route.
**Recommended Fix:** Central `UploadService` (mime+extension whitelist, max size, `Str::random` name, `Storage::disk('private')`); `/ckeditor` behind auth, JSON response with `e()`; deny PHP execution under upload dirs at the web-server; back-fill validation on the 36 files.
**Verification:** Upload `shell.php`/`x.svg` to each endpoint → 422; nginx returns 403 for `*.php` under upload dirs.

## BE-06
**Severity:** Critical   **Type:** Confirmed   **Category:** Security
**Module:** Web-root PHP scripts / secrets in source
**Location:** `D:\next_lms_erp\public\123.php` (`phpinfo()`), `public\add_user_hrms.php`, `public\test.php:4-6`, `public\general_integration.php:3-6`, `public\getworkflow.php:3-4`, `public\hrms_api.php:5-6`, `public\library_api.php:6-7`, `public\school_integration.php:4-5`, `public\student_integration.php:4-5`, `public\subject_batch_timetable.php:4-5`, `public\user_integration.php:4-5`, `public\student_document_integration.php`, `public\student_photo_integration.php`, `public\default_groupwise_rights.php` (all **git-tracked**)
**Function/Method:** top-level procedural scripts (no framework)
**Problem:** 15 standalone PHP scripts under `public/` bypass Laravel entirely (no middleware, no auth, no CSRF). Nine embed **production database host/user/password literals** (redacted: `Triz***`, `Tr!z***`; hosts `150.***`, `192.***`, `128.***`), `123.php` prints `phpinfo()`, `add_user_hrms.php` connects to **request-supplied** DB host/user/password (`$_REQUEST['db_host']…`) and inserts request data with string-concatenated SQL, `test.php` concatenates `$_REQUEST['college_id']` into SQL and duplicates a database schema, `hrms_api.php`/`library_api.php` concatenate `$_REQUEST['sub_institute_id']`/`teacher_id`. `.gitignore:53` ignores `public` yet these files are tracked (force-added).
**Evidence:** `test.php`: `$password = 'Triz***'; … "SELECT * FROM tblclient WHERE id = '".$_REQUEST['college_id']."'"`; `add_user_hrms.php:2-8`: `$host = $_REQUEST['db_host']; … mysqli_connect($host,$username,$password)`; `123.php`: `echo phpinfo();`
**Impact:** Credentials for production/legacy MySQL servers are in git history forever (must be treated as compromised). If the web server executes them: anonymous SQLi, server-side connection pivoting to arbitrary hosts (SSRF), information disclosure (`phpinfo`), and unauthenticated schema-duplication/`CREATE DATABASE`.
**Expected Behavior:** No executable scripts in the web root; secrets only in `.env`/secret manager.
**Recommended Fix:** Delete or move these scripts out of `public/`; rotate every listed DB password and any credential stored in the referenced `tblclient` rows (`db_password`); purge history (BFG) or at minimum rotate; add pre-commit secret scanning (gitleaks).
**Verification:** `git grep -n "mysqli_connect" public/` empty; new DB credentials work, old ones rejected; `GET /123.php` → 404.

## BE-07
**Severity:** Critical   **Type:** Confirmed   **Category:** Authorization
**Module:** ~90 controllers / 378 routes with no authentication (LMS, exam, admissions, dashboards, AI generation)
**Location:** `D:\next_lms_erp\routes\api.php:63-72,140-144,173-175,181-184,217-286,324-338,424-533,570-598,609-676,717-758` (see §5.2 and CSV rows with `controller_level_tier = C-NO-AUTH`); also `web.php` (AJAXController 38 routes, `lmsCounsellingController` 17, `PedagogyEngineController` 6, `TeacherResourceApiController` 5, `contentController` 12) and `student.php` `student/api/{student_certificate,student_icard,teacher_icard}/*` (`StudentCertificateApiController.php:12-26` builds the *session* from request `sub_institute_id`,`user_profile_name`,…)
**Function/Method:** every action of the controllers in §5.2
**Problem:** The `api` group contains only `throttle:1000,1` + `SubstituteBindings`; 328 of 429 `api.php` routes add nothing at route level and 90 controllers add nothing in code. Tenant, user and even role (`user_profile_name`) come from the request body. The intended fix (`lms.auth`) is warn-only by default (`config/lms_content.php:144`). Duplicate re-registrations later in `api.php` (e.g. lms-assignment lines 351–367 with `api.session`) do not remove the earlier anonymous ones (same URI+verb → first match wins).
**Evidence:** `ExamEvaluationApiController@publish`: `$tenantId=(int)$request->input('sub_institute_id'); … $userId=(int)$request->input('user_id')` → writes `lms_offline_exam`; `ApiLmsCourseController@createQuestionBank` validates `sub_institute_id` from body; `LmsApiAuth` docblock: "`POST /api/lms-chapter-content/upload` is reachable anonymously … makes tenancy caller-controlled"; `StudentsDashboardApiController` returns `recent_enrollments` student names for any `sub_institute_id`; `lesson-intelligence/micro-plan/*` and `ai-sop/generate` call paid LLMs anonymously.
**Impact:** Anonymous read/modify/delete of question banks, homework, assignments, exam marks (gradebook publish), admissions/enquiries/registrations (PII incl. Aadhaar fields), assessment blueprints, document templates, lesson plans; anonymous consumption of paid LLM quota; anonymous certificate/ID-card generation for any student.
**Expected Behavior:** Default-deny at group level; tenant/user/role always from the verified token.
**Recommended Fix:** Wrap the whole `api.php` in `Route::middleware('api.session')` and whitelist the few public routes (login, handoff claims, academic-terms); delete the shadowed duplicates; set `LMS_API_AUTH_ENFORCE=true` after log review; replace request-supplied tenant with `session('sub_institute_id')`; add per-route `perm:`/`staff.only` where teachers only.
**Verification:** CSV `route_level_auth=N` count for `/api` prefix ≤ 5; automated test iterating every route without token expecting 401.

## BE-08
**Severity:** Critical   **Type:** Confirmed   **Category:** Business Logic
**Module:** Online fee payment callbacks
**Location:** `D:\next_lms_erp\app\Http\Controllers\fees\online_fees\online_fees_collect_controller.php:1449-1499` (`icici_response_handler`), `:1713-1770` (`icici_orange_response_handler`, comment at l.1750), `:2215-2260` (`aggre_pay_response_handler`), `:3965-3985` (`payphi_response_handler`); routes `routes/fees.php:276-312` (`check_permissions` only, `fees/*` CSRF-exempt)
**Function/Method:** the four `*_response_handler` methods → `pay_fees()`
**Problem:** The callbacks accept status fields from the browser request without verifying a gateway signature or re-querying the gateway. ICICI marks `PS` when `Response_Code=="E000"`; Orange when `responseCode` is `0000/000` ("Omitted for brevity — implement as per ICICI docs"); Aggrepay computes `valid_hash` but ignores it (`response_message=="Transaction successful"`); PayPhi trusts `responseCode=="0000"`. On `PS` the controller calls `pay_fees(...)` which records the fee collection/receipt using the DB order's amount. Order ids are `student_id . mt_rand(100000,10000000000)`.
**Evidence:** `if ($response["Response_Code"] == "E000") { $payment_status = "PS"; }` → `DB::table("fees_payment")->…->update($update_arr); … $this->pay_fees($request, $get_all_data[0]->student_id, …)`; Orange: `// You should verify the returned securehash here … Omitted for brevity`.
**Impact:** A payer (or anyone who learns/guesses an open `<gw>_order_id`) can mark a fee as paid without paying → receipts issued, ledger falsified, revenue loss. HDFC handler additionally hard-codes tenant 76 (`:321,:920`).
**Expected Behavior:** Verify HMAC/hash with the school's secret; cross-check amount/status by server-side gateway fetch; idempotent settle.
**Recommended Fix:** Implement each gateway's signature verification (Razorpay-style) and enforce `valid_hash`; fetch payment status server-to-server before `pay_fees`; use `random_int`/UUID order ids; take tenant from the pending `fees_payment` row only.
**Verification:** Unit tests posting forged callbacks for each gateway must not create `fees_collect` rows.

## BE-09
**Severity:** High   **Type:** Confirmed   **Category:** Security
**Module:** Push notifications / Firebase
**Location:** `D:\next_lms_erp\app\Helpers\Helper.php:1808,1813,1818` (`send_FCM_Notification2`); `:1838-1848` (service-account JSON paths under `public/firebase/…`)
**Function/Method:** `send_FCM_Notification2`, `send_FCM_Notification*`
**Problem:** Three legacy FCM **server keys are hard-coded** (`AAAA***:APA91b…`) with tenant ids 254/48 hard-coded to pick one; per-school Firebase service-account files are expected in `public/firebase/*.json` (publicly downloadable path if present); SSL verification disabled on the cURL call.
**Evidence:** `'Authorization: key=' . "AAAAIbBY…"` (redacted), `CURLOPT_SSL_VERIFYPEER, 0`.
**Impact:** Anyone with repo access can send push notifications as the schools; service-account JSONs in webroot would be a full Firebase project compromise (not confirmed present; `public/firebase` absent in this checkout).
**Expected Behavior:** Secrets per tenant in encrypted DB/secret store; service accounts outside `public/`.
**Recommended Fix:** Rotate the keys (legacy API is retired anyway), move to FCM v1 with credentials from env/secret manager, enable TLS verification.
**Verification:** `git grep AAAA` finds nothing; no JSON under `public/`.

## BE-10
**Severity:** High   **Type:** Confirmed   **Category:** Authorization
**Module:** Menu-rights RBAC (`check_permissions`) — ~975 routes
**Location:** `D:\next_lms_erp\app\Http\Middleware\checkPermission.php:44` (`if($menu_id!='')`), `:76` (`if (!Str::contains($request->submit, 'Search'))`), `:71-100` allow-lists `[200]`,`[82,386]`
**Function/Method:** `checkPermission::handle`
**Problem:** (1) Any request carrying `submit=Search` (or any value containing "Search") skips the entire delete/edit/add/view check. (2) Permission lookup is by route *name*; a route without a name, or whose name has no `tblmenumaster.link`, is **not checked at all** (fail-open). (3) The delete/update/add tests are `str_contains(request()->path(), 'delete'|'update'|'store'|'add'|'save')` heuristics on the URL, and only `POST/PUT/DELETE` methods otherwise — GET endpoints that mutate (`ajax_*`, `map_student/bulk-delete` is DELETE but others are GET) are unprotected.
**Evidence:** `if (!Str::contains($request->submit, 'Search')) { … throw new AuthorizationException(…)`; `$menu_id = DB::table('tblmenumaster')->where('status',1)->where('link',$currentRouteName)->value('id'); if($menu_id!=''){`.
**Impact:** Any authenticated user can bypass menu rights on every legacy route, including fees, student, user and result routes, by adding one parameter; unmapped routes have no RBAC by construction.
**Expected Behavior:** Default-deny; permission independent of client-controlled fields.
**Recommended Fix:** Remove the `submit` shortcut; deny when no menu row exists (or require explicit `->withoutMiddleware`); derive action from HTTP verb + route action, not URL substrings; add tests per protected route.
**Verification:** Feature test: student token + `submit=Search` on `POST /fees/…store` → 403.

## BE-11
**Severity:** Critical   **Type:** Confirmed   **Category:** Authorization
**Module:** Tier B controllers (JWT valid + client-supplied tenant): 46 controllers / 199 routes
**Location:** `D:\next_lms_erp\app\Http\Controllers\api\MigrationModulesApiController.php:18-27,32-70`; `api\PettyCashApiController.php:44-70`; `api\ComplaintApiController.php:48-72,297-323`; `api\ConsentApiController.php`; `api\FrontDeskApiController.php`; `api\PhotoVideoGallaryApiController.php`; `api\StudentSetupApiController.php:25-90`; `api\BulkStudentApiController.php:161-200`; `api\StudentInfirmaryApiController.php`; `api\StudentCareApiController.php`; `api\StudentSearchApiController.php`; `api\StudentRegistrationApiController.php`; `api\adminapiController.php` (40 routes); `fees\fees_collect\fees_collect_controller.php:2002-2031` (`PaidUnpaid`); full list in CSV tier `B-jwt-valid,client-tenant`
**Function/Method:** each controller's `authenticate()/guard()` + `$request->integer('sub_institute_id')`
**Problem:** These controllers call `$this->jwtToken()->validate()` (signature/expiry only) and then use `sub_institute_id`, `user_id`, `syear` from the request. Unlike the correctly-built Tier A controllers (`UserManagementApiController::context` compares token `id`/`sub_institute_id` with the request), nothing ties the tenant to the token. Any valid token — a student, a teacher of another school, or an OTP-mobile token — can read and write another school's data by changing the body.
**Evidence:** `MigrationModulesApiController::guard`: validates JWT then `'sub_institute_id'=>'required|integer'`; `tenant()` = `$r->integer('sub_institute_id')`; `learning-outcomes`/`indicator-mappings` list/delete have **no tenant filter at all** (`DB::table('learning_outcome_indicator')->orderByDesc('ID')->get()`). `PettyCashApiController::destroy`: `->where('id',$id)->where('sub_institute_id',$request->integer('sub_institute_id'))->delete()`. `PaidUnpaid`: `$sub_institute_id=$_REQUEST['sub_institute_id']; $student_id=$_REQUEST['student_id']` after JWT check only.
**Impact:** Cross-tenant disclosure and tampering of petty-cash/complaints/consents/front-desk/student records/student fee status/infirmary data; a parent/student can enumerate other students' fee dues by id.
**Expected Behavior:** Tenant and actor derived from the token; request-supplied tenant rejected unless equal.
**Recommended Fix:** Move all 46 to `api.session` (session tenant) or reuse the `context()` pattern from `UserManagementApiController`; add a shared trait; add rights checks (`authorizeAction`) for write actions.
**Verification:** Test: token of tenant A + `sub_institute_id=B` → 403 for each controller.

## BE-12
**Severity:** High   **Type:** Confirmed   **Category:** Authorization
**Module:** Result API (185 routes), EasyCom API (36), Organization Management (54), Documents (3), Mobile page builder (13), HR fee refund
**Location:** `D:\next_lms_erp\routes\resultapi.php`, `routes\easycomapi.php`, `routes\organization_management.php`, `routes\documents.php`, `routes\mobile_page_builder.php`, `routes\api.php:164-168` (`fees-refund`); base classes `app\Http\Controllers\api\result\BaseResultApiController.php`, `api\easy_com\BaseEasyComApiController.php`
**Function/Method:** all actions (e.g. `MarksEntryApiController::approve`, `SendSmsParentsApiController::send`, `SendWhatsappParentsApiController`)
**Problem:** Only `api.session` (authentication). The JSON twins delegate to legacy controllers but the legacy `check_permissions` rights layer was not carried over; no `staff.only`; no role check (only `DropdownApiController` reads the profile name to filter lists). `BaseEasyComApiController` documents that these bypass the web group's `check_permissions`.
**Evidence:** `MarksEntryApiController::approve()` → `$this->delegate(marks_entry_controller::class,'approve',$request)`; no `authorize`. `grep -rE "can_add|user_profile_name|is_student" api/result api/easy_com` → only `DropdownApiController`.
**Impact:** Any student/parent token can approve marks, edit exam/grade masters, upload results, and send SMS/e-mail/WhatsApp/push to whole schools (cost + social-engineering vector); org-management/document endpoints likewise (only `RolePermissionsController` asserts admin).
**Expected Behavior:** Same rights as the Blade equivalents.
**Recommended Fix:** Add `staff.only` at the route group and a `menu_rights:<link>,<action>` middleware mapping each route to its `tblmenumaster` link; reuse `PermissionService`.
**Verification:** Student token → 403 on all 300+ routes; teacher without rights → 403 on write routes.

## BE-13
**Severity:** High   **Type:** Confirmed   **Category:** Authorization
**Module:** Leave & HR attendance APIs
**Location:** `D:\next_lms_erp\app\Http\Controllers\api\Leave\LeaveRequestApiController.php:146-227,232-332,372-414`; `api\Leave\Concerns\ResolvesLeaveContext.php:26-63`; `api\Attendance\Concerns\ResolvesAttendanceContext.php`; routes `routes/api.php:914-993`
**Function/Method:** `store`, `decision`, `bulkDecision`, `applyDecision`; `LeaveWorkflowApiController::saveWorkflow/saveRoles`; `LeaveTypeApiController::store/destroy`; `HolidayApiController::*`
**Problem:** Tenant is token-bound (good) but there is **no role or rights check** on any of the 34 leave endpoints, and the *actor* is the request `user_id` (`'user_id'=> is_numeric($request->input('user_id')) ? …`). `store` accepts `employee_id` (validated `exists:tbluser,id`, not tenant-scoped) and its upsert `where user_id,from_date,status=pending` is not tenant-scoped; `applyDecision` resolves `approved_by` from the request `user_id`.
**Evidence:** `$userId = (int) ($request->input('employee_id') ?: $context['user_id']);` … `DB::table('hrms_emp_leaves')->where('user_id',$userId)->where('from_date',$fromDate)->where('status','pending')->first()` then `update($payload)` (overwrites `sub_institute_id`); `applyDecision`: `->where('id',$context['user_id'])->value('employee_name')`.
**Impact:** Any token (incl. student/parent) can approve/reject/withdraw anyone's leave, change the approval workflow and role access, create leave types and holidays; approval records can be attributed to any user; cross-tenant row hijack via the unscoped upsert.
**Expected Behavior:** Approvers limited by workflow/role; actor from token.
**Recommended Fix:** Gate decision/config routes with an admin/HR permission from `tblindividual_rights`; take `user_id` from the token; scope `exists` and upsert by tenant.
**Verification:** Student token `POST /api/leave/requests/1/decision` → 403.

## BE-14
**Severity:** High   **Type:** Confirmed   **Category:** Security
**Module:** Credentials storage & exposure
**Location:** `D:\next_lms_erp\app\Http\Controllers\loginController.php:96-110` (raw `password` compare, students `md5`); `app\Http\Controllers\api\ApiLoginController.php:41-90,628-655`; `api\UserManagementApiController.php:196-199,150-156`; `api\NewLMS_ApiController.php:583-593`, `api\NewLMS_StudentApiController.php:261-283`; migration `2023_03_05_115658_create_tbluser_table.php:36` (`plain_password`); `Auth\ForgotPasswordController.php:96`
**Function/Method:** `loginController::authenticate`, `verifyAndUpgradePassword`, `UserManagementApiController::values/show`
**Problem:** Staff passwords are stored and compared as **plaintext** on the Blade login (`where(['email'=>$email,'password'=>$password])`), students as unsalted **md5**; the API login upgrades to bcrypt only after a successful legacy match, so unmigrated rows stay plaintext. The `tbluser.plain_password` column is populated with the raw password on every create/update through `UserManagementApiController::values()` **and** `GET /api/users/{id}` returns the entire `tbluser` row (`select *`: `password`, `plain_password`, `otp`, `account_no`, `ifsc_code`, `pan_no`, …) to any admin — or to the user themself. New-school signup sets password `'admin'`; students `'student'`. The reset flow stores the new password plaintext and updates every row with that email.
**Evidence:** `$values['password'] = Hash::make($request->input('password')); $values['plain_password'] = $request->input('password');` ; `show()` returns `['user' => $user, …]` where `$user = DB::table('tbluser')->where('id',$id)…->first()`.
**Impact:** Database/backup/SQLi read = immediate credential compromise for all staff (plaintext) and cheap cracking for students; plaintext copies are being *created* by the new API; default passwords `admin`/`student`; password reuse across the ecosystem.
**Expected Behavior:** Only salted hashes stored; sensitive columns never serialised.
**Recommended Fix:** Migrate every row to bcrypt (batch re-hash on login is not enough — force reset for stale rows), drop `plain_password`, stop writing it, whitelist columns returned by user APIs, remove default passwords and force change on first login, use `Hash::make` in reset and `superAdmin-store`.
**Verification:** `SELECT COUNT(*) FROM tbluser WHERE password NOT LIKE '$2y$%'` = 0; `GET /api/users/{id}` contains no `password*`/`otp`/bank fields.

## BE-15
**Severity:** High   **Type:** Confirmed   **Category:** Security
**Module:** Legacy mobile OTP login
**Location:** `D:\next_lms_erp\app\Http\Controllers\api\apiController.php:72-135,161-183,204-260,991-1007`; `api\adminapiController.php:39-232`; `routes/api.php:75-86`, `routes/adminapi.php:20-21` (no throttle)
**Function/Method:** `login`, `login_hills`, `check_otp`, `teacherlogin`, `teacher_check_otp`, `admin_login`, `admin_check_otp`
**Problem:** Hard-coded backdoor OTP `"123456"` for specific mobiles (`9979***`, `9824***`); for 12 hard-coded tenants (328–341, 61) the OTP **is the user's date of birth** (`date('dmy', strtotime(dob))`) and no SMS is sent; other OTPs are stored plaintext in `tbluser.otp`/`tblstudent.otp`, **never expire**, are re-used if already set, have no attempt counter, are 6 digits, and `admin_check_otp` returns the OTP in its JSON. The `adminapi`/`teacherapi` routes have no `api` group so even the 1000/min throttle is absent. The admin token payload contains `user_id` (not `id`), so it cannot pass `api.session`, but it does pass the Tier B `jwtToken()->validate()` checks (BE-11).
**Evidence:** `if ($mobile == '9979176562' || $mobile == '9824154142') { $otp = "123456"; } else if(in_array($sub_institute_id,$sub_Array)) { $otp = date('dmy', strtotime($data[0]->dob)); }`; `$send_data['otp'] = $data['otp'];`
**Impact:** Account takeover of any parent/student/staff in those tenants with public knowledge (DOB) or brute force; a permanent backdoor number.
**Expected Behavior:** Random, short-lived, single-use OTPs, hashed at rest, attempt-limited, never returned.
**Recommended Fix:** Remove hard-coded numbers/tenant branches; store `hash(otp)`+`expires_at`+`attempts`; throttle by mobile+IP; put these routes in the `api` group (or retire them if the mobile apps moved to `/api/api-login`).
**Verification:** Test OTP reuse, expiry, and lockout; grep for `123456`.

## BE-16
**Severity:** High   **Type:** Confirmed   **Category:** Security
**Module:** JWT design
**Location:** `D:\next_lms_erp\app\Http\Controllers\api\ApiLoginController.php:424-434`; `app\Http\Middleware\Concerns\HydratesLegacyApiSession.php:64-120`; `app\Http\Middleware\Brain\BrainAuthenticate.php:52-84`; `app\Http\Middleware\Brain\BrainAuthenticate.php:41-46` (`?token=`)
**Function/Method:** token issue/validation
**Problem:** (a) No expiry unless `JWT_TTL_MINUTES>0` (unset in `.env.example`; with `config:cache` `env()` in a controller returns null so it can never be enabled — 112 `env()` calls in `app/`). (b) No revocation, no `jti`; `hydrateSessionFromClaims` never re-checks `tbluser.status`/`expire_date`, so deactivating a user (`UserManagementApiController::destroy` sets `status=0`) does not end their access. (c) The same token is accepted by every family (`api.session`, `lms.auth`, `pal.auth`, `McpAuth`, controller-level validators). (d) Brain also accepts tokens signed with `config('app.key')` as well as `JWT_SECRET`/`BRAIN_JWT_SECRETS`, and takes `?token=` from the query string (ends up in access/proxy logs). (e) Payload trust: `is_admin`, `user_profile_id`, `is_student` inside the token are used as-is — safe only while the secret is strong (`JWT_SECRET=` blank in example; length NOT VERIFIED).
**Evidence:** `$ttlMinutes = (int) env('JWT_TTL_MINUTES', 0); if ($ttlMinutes > 0) { $payload['exp']… }`; `[(string) env('JWT_SECRET',''), (string) config('app.key')]`.
**Impact:** A leaked token (localStorage, logs, referer) works forever; fired employees keep access; APP_KEY compromise = forged Brain admin tokens.
**Expected Behavior:** Short-lived access token + refresh/rotation; server-side status check; one secret per purpose.
**Recommended Fix:** Enforce `exp` (config value, not `env()` in code), add `jti`/token version column checked per request (cache), re-check `status`, drop APP_KEY acceptance and `?token=`.
**Verification:** Expired token → 401; deactivated user token → 401.

## BE-17
**Severity:** Medium   **Type:** Confirmed   **Category:** Security
**Module:** Brute-force / abuse protection
**Location:** `D:\next_lms_erp\app\Http\Kernel.php:45-49`; `routes/api.php:88` (`api-login`); `routes/adminapi.php`, `routes/teacherapi.php`, `routes/pal_api.php` (no group); `routes/web.php` (`forget-password`)
**Function/Method:** `ApiLoginController::login`, `ForgotPasswordController::submitForgetPasswordForm`
**Problem:** Login has no per-account/IP lockout, captcha or audit log; the only limiter is `throttle:1000,1` per IP on the `api` group (a single IP can try 1,000 passwords/min); mobile OTP APIs and PAL routes have none; `forget-password` (no throttle) sends unlimited e-mails and enumerates accounts through `exists:tbluser,email`. `throttle` is applied to only 3 routes in total.
**Evidence:** `Kernel.php`: `'api' => ['throttle:1000,1', SubstituteBindings]`; `configureRateLimiting()` commented out in `RouteServiceProvider`.
**Impact:** Password spraying, OTP brute force, email bombing, LLM cost abuse.
**Recommended Fix:** `RateLimiter::for('login', by email+ip, 5/min)`; captcha after failures; throttle OTP/reset; put every route file in the `api` group; audit login attempts.
**Verification:** 6th wrong password in a minute → 429.

## BE-18
**Severity:** High   **Type:** Confirmed   **Category:** Authorization
**Module:** Legacy user management (Blade controller, still routable)
**Location:** `D:\next_lms_erp\app\Http\Controllers\user\tbluserController.php:148-238` (`saveData`, `updateData`) and the HRMS sync `:176-215`
**Function/Method:** `saveData`, `updateData`
**Problem:** Both build `$finalArray` from **every** request key (only `_method,_token,submit,id` dropped) and call `tbluserModel::insert($finalArray)` / `->where(['id'=>$user_id])->update($finalArray)`. `sub_institute_id` is set first but **then overwritten** if the client sends it; `updateData` has **no tenant filter**, so any user with add/edit-user rights can change any user of any tenant (password, `is_admin`, `user_profile_id`, `client_id`) and insert users with arbitrary columns (`is_admin=1`). The tenant guard in `LogRouteMiddleware` for `add_user` `PUT` is skipped when `type=API`. Separately `saveData` POSTs the client's HRMS **DB host/user/password** and the new user's fields with cURL to `http://".$_SERVER['HTTP_HOST']."/add_user_hrms.php` — a spoofed `Host` header redirects those credentials to an attacker.
**Evidence:** `foreach ($newRequest as $key => $value) { … $finalArray[$key] = $value; } tbluserModel::insert($finalArray);` ; `return tbluserModel::where(['id' => $user_id])->update($finalArray);` ; `$url = "http://".$_SERVER['HTTP_HOST']."/add_user_hrms.php";`
**Impact:** Privilege escalation to platform admin, cross-tenant account takeover, DB credential leakage.
**Recommended Fix:** `$request->only(...)` whitelist; `where('sub_institute_id', session tenant)` on update; never accept `is_admin/client_id/sub_institute_id`; build the HRMS URL from config, not `HTTP_HOST`; delete `public/add_user_hrms.php` (BE-06).
**Verification:** Test update of a foreign-tenant id → 404; `is_admin` in body ignored.

## BE-19
**Severity:** High   **Type:** Confirmed   **Category:** Authorization
**Module:** AI console (`/api/ai/*`)
**Location:** `D:\next_lms_erp\app\Http\Controllers\AI\AiConfigurationController.php:95-135`; `AI\AiModuleModelController.php:281-380`; `AI\AiPolicyController.php:130-160`; `AI\AiTemplateController.php`; `AI\RecommendationController.php:65-90`; `routes/ai.php`
**Function/Method:** `store`, `storeCredential`, policy/template CRUD, `approve`
**Problem:** The AI route group authenticates any valid JWT (`McpAuth` maps students to role `student` but does not reject them) and hydrates tenant scope, but the config/credential/policy/template controllers contain no `isAdmin`/role check (grep: 0 for `AiPolicyController`, `AiTemplateController`, `ReportController`, `RecommendationController`; 1 unrelated 403 in `AiConfigurationController`). API keys are stored in plaintext (`ai_api_keys.api_key`) and audit fields are client-supplied (`decided_by_name`, `user_name`).
**Evidence:** `DB::table('ai_api_keys')->insertGetId([… 'api_key' => trim($data['api_key']), … 'sub_institute_id' => $institute …])` with no role test; `RecommendationController::approve` accepts `decided_by_name`.
**Impact:** Any logged-in student/teacher can add/replace the school's LLM provider keys (redirecting prompts/data to an attacker-controlled endpoint or exhausting quota), disable disclosure/plagiarism policies, approve AI recommendations that start workflows; falsified audit names.
**Recommended Fix:** `if (! $scope->isAdmin) return 403` (or permission map) in these controllers; encrypt `api_key` (`Crypt::encryptString`); take names from the token only.
**Verification:** Student token `POST /api/ai/configuration` → 403.

## BE-20
**Severity:** High   **Type:** Confirmed   **Category:** Authorization
**Module:** MCP tools / AI ask (prompt-injection trust boundary)
**Location:** `D:\next_lms_erp\app\Mcp\AbstractMcpTool.php:37-47,226-231`; `app\Mcp\ToolRegistry.php:77-138`; `app\Mcp\Tools\AdmissionsUpdateEnquiryTool.php:57-77`; `app\Mcp\Tools\FeesArrearsTool.php:53-58`; 93 tool files with `'required_permission' => …`
**Function/Method:** `AbstractMcpTool::authorize`, `ToolRegistry::execute`
**Problem:** `required_permission` (e.g. `fees.collect`, `admission.confirm`, Student Medical menu rights) is only an *annotation* exposed in `definition()`; nothing enforces it (grep: only `AbstractMcpTool::authorize` and one override in `AdmissionsConfirmTool`). `allowedRoles()` is `['admin','staff']` for all 96 tools, so **any staff account** (teacher, peon, librarian) can have the LLM read fee arrears, student medical/vaccination records, user-account and ID-card rosters, hostel/visitor/PTM data. `admissions.updateEnquiry` is a write tool (`isReadOnly=false`) that is **not** `ConfirmableMcpToolInterface`, so an LLM (or prompt-injected content read by the LLM) can modify admission enquiry fields without a preview/confirm step. `McpConfirmationService::consume` reads status then updates (non-atomic → replay race). `StudentMedicalService` docs claim the annotation is "the same menu rights the screens are protected by" — untrue.
**Evidence:** `protected function allowedRoles(): array { return ['admin','staff']; }`; `AdmissionsUpdateEnquiryTool::execute` → `$this->authorize($context); return $this->service->updateEnquiry($context,$arguments);`; `grep -rn "allowedRoles()" app` → one enforcement site.
**Impact:** Least-privilege violation and sensitive-data exposure through the assistant; the assistant is a confused deputy: tool arguments are chosen by an LLM from user (and retrieved) text, the only safeguard is the coarse role.
**Recommended Fix:** Enforce `required_permission` in `ToolRegistry::execute` via `PermissionService`; make every write tool confirmable; make `consume()` a single conditional `UPDATE … WHERE status='pending'`; log tool name + args hash + outcome for every call (present) and alert on write tools.
**Verification:** Teacher token calling `fees.arrears`/`student_medical.*` → 403.

## BE-21
**Severity:** Medium   **Type:** Confirmed   **Category:** Backend
**Module:** Mass assignment / request-driven writes
**Location:** `D:\next_lms_erp\app\Models\loginModel.php:15-47` (`$fillable` includes `is_admin`,`sub_institute_id`,`client_id`,`user_profile_id`,`otp`,`plain_password`); 35 models with `$guarded = []` (e.g. `Models/settings/organizationDetails.php`, `Models/lms/userActivityModel.php`, 22 H5P models, 8 `TalentManagement/Mobility*` models); `api\ImportApiController.php:165-170`; `api\PAL\NewPalGamificationController.php`, `PALAPIController.php`
**Problem:** Sensitive columns are mass-assignable; the import API builds insert columns from client-sent `fields[]` names (`$prepareData[$request->fields[$key]]`) so a user can target columns such as `is_admin` or `sub_institute_id` if the chosen table has them; `csv_data_file_id` is looked up by primary key without tenant/user check.
**Impact:** Privilege/tenant column overwrite through import or model `create/update($request->…)` paths.
**Recommended Fix:** Column allow-list per import table (`import_table_fields`), scope `csv_data` by tenant+user, remove sensitive columns from `$fillable`.
**Verification:** Import with `fields[0]=is_admin` rejected.

## BE-22
**Severity:** Medium   **Type:** Confirmed   **Category:** Security
**Module:** Audit logging
**Location:** `D:\next_lms_erp\app\Http\Middleware\LogRouteMiddleware.php:23-25,40-46`
**Function/Method:** `LogRouteMiddleware::handle`
**Problem:** The entire access-log write **and** the cross-tenant `add_user`/`add_student` PUT guard are inside `if type != API && != JSON`. Every request from lms_k12 carries `type=API`, so none of its traffic is ever access-logged and it never reaches that guard. Additionally `fullUrl()` (query strings incl. `?token=`/`?ticket=`) is persisted for web requests, and `Accesslog::insert` runs on every web request (write amplification).
**Impact:** No forensic trail for the SPA; guard bypass by adding `type=API`.
**Recommended Fix:** Log at the `api.session` layer (user, tenant, route, status), redact query secrets, apply tenant guard regardless of `type`.
**Verification:** SPA call produces an `access_log` row.

## BE-23
**Severity:** Medium   **Type:** Confirmed   **Category:** Security
**Module:** Error handling / debug output
**Location:** ≈484 `getMessage()` sites in responses (e.g. `admission\admissionEnquiryController.php:51,143,377,731,818,925`, `admissionFormController.php:40,108,227,309,424`, `UserFormbuilderController.php:49`, `Auth\ForgotPasswordController.php:63`, `WhatsappController.php:508`); 42 active `exit;` and 30 `print_r`/11 `echo "<pre>` debug leftovers in 27 files; `.env.example:2,4` `APP_ENV=local`, `APP_DEBUG=true`; `config/session.php:171` `secure` only when `APP_ENV=production`; `public/123.php`
**Problem:** Exception messages (SQL text, file paths) are returned to clients; debug leftovers abort responses; the shipped example enables debug and disables secure cookies.
**Impact:** SQL/schema leakage aiding injection (amplifies BE-01); broken responses; if production copies the example: full Ignition/whoops pages.
**Recommended Fix:** Return generic messages, log details (pattern already used in `AiController::handle`); remove leftovers; make `.env.example` production-safe; **verify live `APP_DEBUG=false`** (NOT VERIFIED).
**Verification:** Force a DB error → generic 500 JSON.

## BE-24
**Severity:** Medium   **Type:** Confirmed   **Category:** Security
**Module:** CSRF exclusions and cookie sessions
**Location:** `D:\next_lms_erp\app\Http\Middleware\VerifyCsrfToken.php:22-56`; `config/session.php:199` (`same_site=lax`)
**Problem:** `fees/*` (149 cookie-session routes incl. collect/cancel/refund), `circular/*`, `api/*` and three `lms/pal/*` paths are CSRF-exempt; absolute-URL entries (`https://erp.triz.co.in/*`, `http://127.0.0.1:8000/*`) never match Laravel's path check (dead config).
**Impact:** With `SameSite=Lax` only top-level GET-style navigation is exposed, but any subdomain/legacy browser/`SameSite` change reopens CSRF on financial mutations.
**Recommended Fix:** Exempt only gateway callback paths, not the whole `fees/*`; remove dead entries.
**Verification:** Cross-site form POST to `fees/fees_collect` → 419.

## BE-25
**Severity:** Medium   **Type:** Confirmed   **Category:** Database
**Module:** Migrations, schema hygiene
**Location:** `D:\next_lms_erp\database\migrations` (1,084 files: 373 from 2023, 598 from 2026)
**Problem:** 708 tables created by migrations; 84 tables are `Schema::create`d by more than one migration (e.g. `2023_05_10_233617_add_foreign_key_into_access_log_route_table.php` re-creates ≥30 tables from `2023_03_05_115658_*`); 492 of 573 create-migrations lack a `hasTable` guard; 167 use raw DDL; 2 have empty `down()`; only 217 FK declarations in all create bodies; 264 migration-declared tables do not mention `sub_institute_id` (migrations are known drifted — e.g. `fees_collect`, `attendance_student`, `fees_payment` are filtered by `sub_institute_id` everywhere in code, so the live tables have it); hot tables (`fees_collect`, `fees_payment`, `attendance_student`, `result_marks`, `homework`, `timetable`, `tbluser`, `hrms_emp_leaves`, `lms_question_master`, `tbl*_rights`) show **no index involving `sub_institute_id`** in any migration (199 tables do; live indexes NOT VERIFIED). `migrate` would attempt 408 pending creations (project memory) — any CI/CD or new-environment `migrate` is unsafe, and there is no reproducible schema (a 1-file `database/pal_schema_full.sql` exists for PAL only).
Sensitive columns declared in plaintext: `tbluser` (`password`,`plain_password`,`otp`,`aadhar_no`,`pan_no`,`pancard`,`account_no`,`ifsc_code`), `tblstudent` (`password`,`otp`,`aadhar_document_upload`,`pan_card`,`ifsc_code`), `ai_api_keys.api_key`, `fees_razorpay.key_secret`, `fees_hdffc.working_code`, `fees_axis.checksum_key/encryption_key`, `fees_icici.enc_key`, `fees_aggre_pay.api_key/salt_key`, `smtp_details.password`, WhatsApp tokens; no application-level encryption (`Crypt::` used only for two fee URL params).
**Impact:** No trustworthy schema source; environment rebuilds fail; potential slow tenant-scoped queries; secrets at rest readable by anyone with DB/SQLi (BE-01).
**Recommended Fix:** Snapshot the live schema as a baseline migration, mark historical migrations as applied, add composite indexes `(sub_institute_id, syear, …)` on the hot tables after verifying with `EXPLAIN`, encrypt gateway/SMTP/AI secrets (cast `encrypted`), add FKs where data is clean.
**Verification:** `migrate:status` shows 0 pending on a copy; `SHOW INDEX` for the hot tables.

## BE-26
**Severity:** Medium   **Type:** Potential   **Category:** Backend
**Module:** Jobs, events, scheduler
**Location:** `D:\next_lms_erp\config\queue.php:16` (`QUEUE_CONNECTION` default `sync`); `app\Jobs\Evaluate*Job.php` (4: `tries=2`, `timeout` 300–600, `failed()` present, no `backoff`, no `ShouldBeUnique`/`WithoutOverlapping`); `app\Console\Kernel.php:29-92`; `app\Listeners\CareerIntelligence\GenerateAssessmentEvidenceListener.php` (queued)
**Problem:** With the default `sync` driver the four AI-grading jobs run inside the HTTP request (60–600 s); controllers dispatch from several endpoints (`reprocess`, `ai-status`, resubmit) without unique locks, so duplicate evaluation is possible; jobs carry `sub_institute_id` but `ExamSubmitted` carries none (student id is global so acceptable). Scheduler holds three tasks (`neo4j:drain`, reconcile, two sweeps) and depends on cron; the `bootstrap()` guard logs full argv (may include secrets) and blocks any argv containing "schema|fresh|refresh|db:seed" (project memory). `Log::info` ×153.
**Impact:** Request timeouts/duplicate grading and LLM spend if queue not configured; silent stall if cron missing (already happened 2026-08-21 per Kernel comment).
**Recommended Fix:** Require `QUEUE_CONNECTION=database|redis` in prod, add `ShouldBeUnique` keyed by submission id, `backoff`, failed-job alerting.
**Verification:** `php artisan queue:work` processes; unique key test.

## BE-27
**Severity:** Medium   **Type:** Confirmed   **Category:** Security
**Module:** Outbound integrations (SMS, e-mail, WhatsApp, gateways)
**Location:** `D:\next_lms_erp\app\Http\Controllers\api\apiController.php:817-866` (`sendSMS`, `CURLOPT_SSL_VERIFYPEER,0`, template id hard-coded for tenants 244–265); `Helpers/Helper.php:1830-1832`; 20 `VERIFYPEER 0/false` and 19 `withoutVerifying/'verify'=>false` occurrences; `easy_com/SmtpApiController.php`, `SmsApiMasterApiController.php`, `WhatsappApiConfigApiController.php`
**Problem:** TLS verification is disabled for SMS/FCM/other calls; SMS gateway URL/params and SMTP passwords are stored plaintext per tenant (API responses do mask them — good); SMS URLs are built by concatenating tenant config and message text; WhatsApp Meta webhooks (`api/incoming-message`, `api/update-message`) are unauthenticated and unsigned (`incomingMessage` inserts arbitrary rows; `updateDeliveryStatus` is a stub returning `true`); `WhatsappController` hard-codes tenant 1's token for CRM sends.
**Impact:** MITM of gateway traffic (OTP interception); forged inbound messages; secrets at rest.
**Recommended Fix:** Enable verification, verify Meta `X-Hub-Signature-256`, encrypt stored credentials, rate-limit send endpoints.
**Verification:** Webhook without signature → 401.

## BE-28
**Severity:** Medium   **Type:** Confirmed   **Category:** Security
**Module:** Password reset
**Location:** `D:\next_lms_erp\app\Http\Controllers\Auth\ForgotPasswordController.php:40-118`; `routes/web.php` (`forget-password`, `reset-password`)
**Problem:** `exists:tbluser,email` reveals registered e-mails; reset token stored in clear, no expiry enforced (`created_at` never compared), not tied to a tenant; new password saved plaintext; `update` applies to **all** `tbluser` rows with that e-mail (duplicate e-mails across tenants exist per project memory); `Mail::send` failure returns `$e->getMessage()`; students (`tblstudent`) cannot use it.
**Impact:** Account enumeration, long-lived reset links, cross-tenant password overwrite.
**Recommended Fix:** Use Laravel's broker (hashed, 60-min tokens), generic responses, per-tenant identification, `Hash::make`.
**Verification:** Reset token > 1 h old rejected.

## BE-29
**Severity:** Medium   **Type:** Confirmed   **Category:** Backend
**Module:** Login ambiguity on duplicate e-mails
**Location:** `D:\next_lms_erp\app\Http\Controllers\api\ApiLoginController.php:44-90`
**Problem:** `loginModel::where(['email'=>$email,'status'=>'1'])->first()` (no `ORDER BY`) picks one row; when several rows share an e-mail (documented for tenant 61) the password check runs against whichever row MySQL returns; students are only attempted if no staff row exists. The web login disambiguates with `AND password = ?`, the API does not, so behaviour differs between entry points.
**Impact:** Nondeterministic lock-outs; users may authenticate into the wrong tenant.
**Recommended Fix:** Query all candidate rows, verify password against each, and if several match require tenant selection; enforce unique `(email, sub_institute_id)`.
**Verification:** Two rows same e-mail, different passwords → each logs into its own tenant.

## BE-30
**Severity:** Medium   **Type:** Potential   **Category:** Security
**Module:** Dangerous sinks
**Location:** `D:\next_lms_erp\app\Http\Controllers\report\dynamic_report\dynamic_report_controller.php:163,197,240` (`unserialize($_REQUEST[...])`); `Helpers/Helper.php:1975-2060` (`exec('/usr/local/bin/wkhtmltopdf '.$htmlPath …)` with `--enable-local-file-access`); `AJAXController::pythonTimetable`, `admissionEnquiryController.php:1031` (`shell_exec('python3 /home/admission.py')`); `AJAXController.php:1509-1560` (`ajax_sendmail`: route has no `session`/rights middleware; it sends mail through the *session tenant's* SMTP account to any `email`/`subject`/`message`, i.e. an open relay for any logged-in browser session and an unauthenticated-by-design route)
**Problem:** PHP object injection on an authenticated report route; shell command construction without `escapeshellarg`; HTML rendered by wkhtmltopdf can read local files when it contains attacker-controlled markup; `ajax_sendmail` is an open mail relay for any session .
**Recommended Fix:** `json_decode`/`unserialize(...,['allowed_classes'=>false])`; `escapeshellarg`; sanitise HTML/disable local file access; restrict mail recipients.
**Verification:** static checks.

## BE-31
**Severity:** Medium   **Type:** Confirmed   **Category:** Backend
**Module:** Tenant hard-coding / institution-specific branches
**Location:** 218 conditionals in 34 files — `studentResultController.php` (36), `studentResultController2.php` (31), `studentCertificateController.php` (20), `fees_collect_controller.php` (17), `admissionFormController.php` (12), `apiController.php` (9), `Helper.php` (7), `online_fees_collect_controller.php:321,920` (`fees_hdffc where sub_institute_id = 76`); tenant ids 254 ×44, 47 ×40, 76 ×13, 61 ×13, 198 ×10
**Problem:** Business rules (OTP behaviour, templates, numbering, gateways, FCM keys) are keyed by hard-coded school ids; new tenants inherit defaults silently; payment handler for tenant 76 uses another session's tenant.
**Impact:** Behavioural drift and cross-tenant surprises; untestable.
**Recommended Fix:** Move to per-tenant configuration tables/feature flags.
**Verification:** grep for `sub_institute_id ==\s*\d`.

## BE-32
**Severity:** Low   **Type:** Confirmed   **Category:** Performance
**Module:** Pagination
**Location:** `api\InventoryApiController.php` (50 `get()`), `adminapiController` (34), `teacherapiController` (31), `HostelSetupApiController` (25), `TransportationApiController` (25), `UserManagementApiController::index` (returns all tenant users plus `bootstrap()` employee list on every call), `MenuRightsController` (21), `ApiLmsCourseController` (19)
**Problem:** 842 `->get()` vs 158 paginate/limit/take in `api/`,`HRMS/`,`G2gLms/`; `/table_data` returns whole tables; `tbluser`/`tblstudent` lists are unbounded.
**Impact:** Large tenants cause timeouts/memory exhaustion; amplifies BE-01 exfiltration.
**Recommended Fix:** Mandatory `per_page` (max 200, as in `LeaveRequestApiController`), cursor pagination for exports.
**Verification:** list endpoints return `pagination` meta.

## BE-33
**Severity:** Low   **Type:** Confirmed   **Category:** Backend
**Module:** Dead / broken routes and repo hygiene
**Location:** `routes/web.php:529-531` (`ResultAdminPermissionController` missing → breaks `route:list`); 16 route targets not resolvable by class basename (`lms\pedagogyEngineController` ×10 — file is `PedagogyEngineController.php`, breaks on Linux; `result\MarkUploadController` ×3; `ParaphraseController`; `H5pFlashcardController`; `TransportController`; `driver_masterController`; `vendor_masterController`; `report_module_controller`; `reportsnew.charts.*` views); 33 tracked dev scripts in repo root (`test_*.php`, `debug_*.php`, `check_*.php`, `fix_*.php`, `tmp_*.php`), `composer.lock.bak`, `controllers_not_in_routes.txt`; old copies `cbse_1t5_result_controller_OLD/OLD2`, `contentLibraryControllerOld`; `.gitignore` ignores all of `public/` while `public/*.php` is tracked
**Problem/Impact:** 500s, broken tooling (route caching impossible: closures + missing classes), dead code containing the same SQLi.
**Recommended Fix:** delete/repair, enable `route:cache` in CI to catch it.
**Verification:** `php artisan route:list` succeeds.

## BE-34
**Severity:** Low   **Type:** Confirmed   **Category:** Testing
**Module:** Backend tests
**Location:** `D:\next_lms_erp\tests` (124 files)
**Problem:** No tests for the anonymous API surface, `checkPermission`, tenant-token binding, leave/attendance, payment callbacks, uploads, `/lms_data`, `superAdmin`, login/OTP. New modules (Brain, PAL, MCP) are well tested.
**Recommended Fix:** A generated "every route requires auth / tenant mismatch → 403" test from the route inventory; per-gateway callback tests.
**Verification:** CI green with route-matrix test.

---

**Positive controls observed (verified in code, keep):** `UserManagementApiController::context()` pattern (token↔request tenant/user comparison + active-user reload + rights); `PalApiAuth` learner ownership; `BrainTenantScope`; `McpContextResolver` allow-list for institute switching; `McpConfirmationService` binding to tool/user/institute with TTL; `MobileWebHandoffApiController` hashed single-use tickets; Razorpay signature verification; `ExamEvaluationStorage` mime whitelist with random names; masked secrets in Smtp/Whatsapp config APIs; `AiController::handle` generic 500s; `AiAssistanceTicketController` admin gates; `LeaveRequestApiController` bounded pagination; scoped `throttle.qgen`/`throttle.contentgen`; parameter binding in the newer controllers.

ISSUE COUNTS: C=9 H=10 M=12 L=3 I=0

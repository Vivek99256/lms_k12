# part07 - Students, Admissions, Attendance, Timetable-adjacent, Academic year, Parent communication

Auditor scope: `D:\lms_k12` frontend (dirs listed in the brief) traced through `/api/proxy` / direct calls into the Laravel app in `D:\next_lms_erp`.
Method: read-only static analysis. No `.env*` read, no servers run, no DB access. Anything that depends on live DB rows / live `.env` is marked `NOT VERIFIED`.
Issue prefix: `STU`.

Headline: the frontend in this scope is thin and mostly well-formed, but the Laravel endpoints it calls fall into two groups. A small set of recently written controllers (`ClassTeacherApiController`, `TeacherTransferApiController`, `AcademicSetupApiController`, `TeacherDailyReportApiController`, `UserLogReportApiController`, `UserManagementApiController`, `Documents\DocumentAggregationController`, `RoleDashboardApiController`) bind the JWT to the tenant/user and check rights. Everything else in student/admission/attendance either has no authentication at all, or validates the JWT signature and then trusts a client-supplied `sub_institute_id` / `user_id` / `student_id` (cross-tenant IDOR), and several endpoints contain SQL injection. Those are the dominant findings.

---

## 1. Scope & coverage

Counts are `git ls-files` counts. "ai-stack" = the per-module `ai-stack/` config/screens (boilerplate; not reviewed line by line).

| Area/dir | Files in scope | Read fully | Skimmed | Not reviewed | Notes |
|---|---|---|---|---|---|
| app/student | 63 (20 ai-stack) | student-admin-api.ts, add_student, setup-api.ts, student-care-api.ts, StudentCareModule (partial), bulk api.ts, infirmary api.ts, student_attendance (save/load/default paths), my_icard, cert/icard print+preview paths, all one-line report/page wrappers, dicipline/health/hw/vaccination/optional-subject pages | daywise/monthwise/yearly attendance pages, StudentReportModule (1322), StudentCertificateModule (1371), student_icard (783), TeacherIcardModule (689) - read only fetch/dangerouslySetInnerHTML/print paths | `student/page.tsx` (2080 lines, this is the student "My Course/LMS" portal - LMS agent), 20 ai-stack files | |
| app/students | 40 (2 ai-stack) | search_student/api.ts, page.tsx, StudentProfilesTab (list/dead buttons), requests/api.ts (headers), health_medical/discipline/house/ICards api.ts (endpoint lines), dashboard route wiring | StudentDetailDrawer, StudentProfilesDashboard, document components | charts/metric card components | |
| app/admissions | 40 (12 ai-stack) | admission_registration/workflow.ts, admission-Enquiry flow, admission_enquiry/page.tsx (endpoint + payload + enquiry-number logic) | admission_reports/api.ts, config.ts, followUpApi.ts, follow-up-agenda-api.ts, admission-form-api.ts, confirmation/page.tsx, registration/[id]/edit | AdmissionReportWorkspace (695), sideDrawer (614), ai-stack (12) | |
| app/admission-Enquiry | 1 | 1 (partial: lines 1-200 + submit path) | 0 | 0 | Target of the `/admission-enquiry` rewrite |
| app/attendance | 18 (12 ai-stack) | _lib/attendance-api.ts, attendance_dashboard/page.tsx (load/save/date paths) | DailyRegister, MonthlyOverview, MetricCard | ai-stack (12) | |
| app/dashboard | 11 | page.tsx, resolveDashboardRole.ts, dashboard-api.ts | Admin/Teacher/Student dashboards, preferences | chart primitives | |
| app/academic_setup | 10 | api.ts, create_batch, one-line pages | AcademicSetupPage.tsx | | |
| app/classteacher + classteacherReport | 3 | api.ts endpoints, report page head | page bodies | | |
| app/teachertransfer | 2 | 0 fully (endpoint line) | api.ts, page.tsx | | Backend read fully |
| app/teacher_daily_report | 2 | 0 | endpoint line only | body | Backend read (auth block) |
| app/proxy_master | 2 | api.ts fully | page.tsx | | |
| app/proxy_report, app/todays_proxy_report | 2 | 0 | imports/endpoint use | bodies | Reuse proxy_master/api.ts |
| app/documents | 6 | document-access.ts | documents-api.ts endpoints | components | Backend gate read |
| app/reports | 4 | 4 (all are `MigrationModulePage` wrappers) | | | See STU-33 |
| app/user, app/user_log | 9 (2 ai-stack) | api.ts endpoints, add_user/page.tsx (head) | user_report, user_log pages | ai-stack (2) | |
| app/api/{students,admissions,dashboard}/**/route.ts | 8 | students summary route, teacher-icard route | others diffed vs those | | |
| lib/* named in brief (students, admissions, attendance, timetable, student-requests, student-medical, student-icard, user-icard, complaint, consent, circulars, ptm, parent-communication, communication, certificate, institute) | 16 | 0 | 0 | 16 | All 16 files are `*-ai-stack.ts` config; contain no data logic. Not reviewed. |
| lib/erp-client.ts, lib/erp-legacy.ts, lib/academic-year.ts, lib/date-only.ts, lib/class-options.ts, lib/session/internal-access.ts | 6 | 6 | | | |
| docs/student-menu-report.md, docs/teacher-user-journey.md, docs/user-journey/* | 4 | student-menu-report.md | teacher-user-journey.md (772 lines, headings only), user-journey/* | | |
| Adjacent, outside dir list but required by the brief's checks: app/front_desk (circular, parent_communication), app/admin-services (complaint, consent, ptm), app/Utility/rollover | ~25 | 0 frontend | backend traced | frontend | Backend controllers read (circularController, parentCommunicationController, ComplaintApiController, rollOverController::create) |
| Laravel (read-only, traced) | ~35 controllers/routes/middleware | studentAttendanceController (whole), 7 adminapi student controllers, admission API controllers (3), admissionEnquiryController::store/paymentProof, proxyController, TeacherTransfer/ClassTeacher/AcademicSetup (write paths), hydrator trait, checkPermission, VerifyCsrfToken, RouteServiceProvider, routes student/adminapi/admission/api/documents | | | |

Totals (frontend): ~250 files in the named dirs; about 60 read fully or in their network/state-critical portions; ~55 skimmed; ~50 ai-stack + presentational not reviewed.

Unreviewed and important: `admission_reports/_components/AdmissionReportWorkspace.tsx`, `admissions/admission_registration/components/sideDrawer.tsx`, `students/search_student/components/StudentDetailDrawer.tsx`, `student/report/StudentReportModule.tsx`, `teacher_daily_report/page.tsx`, `user_log/page.tsx`. Their backends were reviewed; UI-only defects in them may exist.

---

## 2. Module inventory (your scope)

Menus are role-dynamic from `/api/menu-rights` (see docs/student-menu-report.md); there is no static menu list in the frontend. "Menu entry" below is the route the screen is registered under in `app/_lib/module-screens.generated.ts`.

| Module | Backend (Laravel) | Frontend pages/components | DB tables (traced) | API endpoints | Permissions/roles | Menu entry | Status |
|---|---|---|---|---|---|---|---|
| Student list / search / profile edit | `api\StudentSearchApiController` (routes/adminapi.php:104-105) | app/students/search_student | tblstudent, tblstudent_enrollment, standard, division, academic_section, student_quota | POST get_adminStudentSearch, PUT get_adminStudentSearch/{id} | JWT signature only; tenant from client | /students/search_student | Partially complete (Add modal is a stub, row Edit/Delete dead; STU-32) |
| Add student | `api\StudentRegistrationApiController` | app/student/add_student, student-admin-api.ts | tblstudent, tblstudent_enrollment, student_quota, house_master | GET student-registration/metadata, GET next-enrollment-no, POST student-registration | JWT signature only | /student/add_student | Mostly complete; reduced field set (no photo/docs/mother name/religion), gender vocab bug (STU-18) |
| Student delete / withdraw | legacy `tblstudentController::destroy` (student/add_student/{id} DELETE) | none in Next | tblstudent(status=0), tblstudent_enrollment(end_date) | not called from Next | menu rights if route in tblmenumaster | - | Missing in UI; backend soft-delete un-scoped (STU-17) |
| Bulk student update | `api\BulkStudentApiController` | app/student/bulk_student_update | tblstudent, tblstudent_enrollment | GET bulk-students/metadata, POST /search, PUT bulk-students | JWT only | /student/bulk_student_update | Complete but unsafe (STU-19) |
| Student master setup (house, quota) | `api\StudentSetupApiController` | student/add_house, student/student_quota | house_master, student_quota | GET/POST/PUT/DELETE student-setup/{quota|house} | JWT only | /student/add_house, /student/student_quota | Complete; deletes unchecked (STU-24) |
| Optional subject mapping | `api\StudentOptionalSubjectApiController` | student/student_optional_subject | student_optional_subject, sub_std_map | POST student-optional-subject/search, PUT student-optional-subject | JWT only | /student/student_optional_subject | Complete |
| Health / vaccination / height-weight / discipline | `api\StudentCareApiController` | student_health, student_vaccination, student_hw, dicipline (all `StudentCareModule`) | student_health, student_vaccination, student_height_weight, dicipline | GET/POST/PUT/DELETE student-care/{module} | JWT only | /student/student_* | Complete but leaks medical PII (STU-20) |
| Infirmary | `api\StudentInfirmaryApiController` | student/student_infirmary | student_infirmary | GET/POST/PUT/DELETE student-infirmary, GET student-infirmary/students | JWT only | /student/student_infirmary | Complete, same authz gap |
| Student document uploads / missing-doc report | `tblstudentDocumentController`, `missingDocumentReportController` | students/student_documents (report only) | student_document | proxy student/missing_document_report/create | session mw + menu rights | /students/student_documents | Report only in Next; upload not in Next |
| Student requests (change requests) | `studentRequestController` | students/requests | student_change_request, student_change_req_type | student/student_request_fixed, student_request, student_request/{id}/status, student_request/create | session mw | /students/requests | Complete; approval un-scoped (STU-37) |
| Student reports (age-wise, inactive, strength, health, discipline, request, missing docs) | several legacy controllers | student/report/* | | student/agewise, show_student_health_report, student_strength_report/create, front_desk/dicipline_report/create, student_request_report_fixed/create | session mw | /student/report/* | Complete (tenant trust pattern, STU-06) |
| Student attendance marking | `studentAttendanceController` | app/attendance/attendance_dashboard, app/student/student_attendance | attendance_student, class_teacher, calendar_events, academic_year | GET student/student_attendance, POST show_student_attendance, POST save_student_attendance | JWT signature + client ids | /attendance/attendance_dashboard, /student/student_attendance | Works; multiple high issues (STU-04, 10-12, 39) |
| Attendance reports (day/month/year) | same + `yearly_attendance_controller` | student/daywise_, monthwise_, yearly_student_attendance | attendance_student | student/show_daywise_student_attendance, show_monthwise_student_attendance, yearly_student_attendance, get_batch | JWT + client ids; get_batch has no auth mw | /student/*_attendance | Works; SQLi (STU-04); batch dropdown likely dead (STU-41) |
| Certificates | `StudentCertificateApiController` extends `studentCertificateController` | student/student_certificate | certificate_history, template_master | student/api/student_certificate/{templates,search,preview,save,history} | NONE | /student/student_certificate | Works; unauthenticated (STU-03) |
| ID cards (student, teacher, user) | `StudentIcardApiController`, `TeacherIcardApiController` (+ `api\TeacherIcardApiController::mine` for self service) | student/student_icard, teacher_icard, my_icard, students/ICards | tblstudent, tbluser, template_master | student/api/student_icard/*, student/api/teacher_icard/*, POST teacher-icard/mine | student/teacher_icard: NONE; mine: api.session, staff-only | /student/student_icard etc. | Admin tools unauthenticated (STU-03); self-service correct |
| Admissions: enquiry/registration/confirmation | `api\admissionEnquiryAPIController`, `admissionRegistrationAPIController`, `onlineAdmissionConfirmAPIController` | admissions/admission_enquiry, admission_registration, confirmation, registration/[id]/edit | admission_enquiry, admission_form, admission_registration, new_admission_inquiry_registration, tblstudent | /api/admission_enquiry, /api/admission_registration, /api/admission_student, /api/online_admission_confirm | NONE (no auth middleware, no JWT check) | /admissions/* | Works but unauthenticated (STU-01, 02) |
| Admissions follow-up, reports, master | `admissionFollowUpController`, `admissionReportController`, `admissionMasterController` | admission_followUp, admission_reports, admission_form | admission_follow_up, admission_* | admission/admission_follow_up, admission/*_report, admission/admission_master | session mw | /admissions/admission_followup etc. | Works; follow-up IDOR (STU-06) |
| Public admission pages (`/admission-enquiry`, `/admission-registration`, `/admission-confirmation`) | n/a | app/admission-Enquiry, admissions/registration, admissions/confirmation | | | Behind login (ConditionalApp renders LoginPage when unauthenticated) | rewrites in next.config.ts | NOT public in Next; enquiry page broken (STU-27) |
| Public Laravel admission forms | `admissionEnquiryController::create/store(type=webForm)/paymentProof`, routes `onlineEnquiryFirst`, `processOnlineEnquiry`, `receipt` | Blade | admission_enquiry | admission_enquiry, admission_enquiry/store, admission_enquiry/payment_proof, admission/online-admission* | none | n/a | 3 routes point at methods that do not exist (STU-13) |
| Academic setup | `api\AcademicSetupApiController` | academic_setup/* | std_div_map, sub_std_map, period, period_details, batch, division_capacity_master, subject | GET/POST/PUT/DELETE api/academic-setup/{module} | token bound to tenant+user, rights checked | /academic_setup/* | Complete; destructive ops unchecked (STU-24) |
| Subject-elective mapping | `MigrationModulesApiController` | academic_setup/subject-elective-mapping, reports/* | subject_elective, result_marks, report_module_data | GET api/migration-modules/{module} | JWT + client ids | /academic_setup/subject-elective-mapping, /reports/* | Read-only generic table dump; stub (STU-33) |
| Class teacher master/report | `api\ClassTeacherApiController` | classteacher, classteacherReport | class_teacher | api/class-teachers | bound + rights | /classteacher, /classteacherReport | Complete; id validation gaps (STU-23) |
| Teacher transfer | `api\TeacherTransferApiController` | teachertransfer | timetable | GET/POST api/teacher-transfer | bound + rights | /teachertransfer | Complete; incomplete transfer semantics (STU-22) |
| Proxy (substitution) master/report/today | `school_setup\proxyController` (+ report controllers) | proxy_master, proxy_report, todays_proxy_report | proxy_master, timetable | school_setup/proxy_master*, ajax_getproxyperiod | JWT + client tenant | /proxy_master etc. | Works; IDOR + no conflict checks (STU-21) |
| Teacher daily report / user log | `TeacherDailyReportApiController`, `UserLogReportApiController` | teacher_daily_report, user_log | timetable, lms diary tables, access log | api/teacher-daily-reports/*, api/user-logs/* | bound + rights | /teacher_daily_report, /user_log | Complete |
| Users / profiles | `UserManagementApiController` | user/* | tbluser, tbluserprofilemaster | api/users*, user-profiles*, user-reports* | bound + rights | /user/* | Complete; plaintext password stored (STU-34) |
| Role dashboards | `RoleDashboardApiController` | dashboard/* | | POST admin|teacher|student-dashboard/summary via /api/dashboard/* | api.session, role-checked | /dashboard | Complete; SSRF-able proxy (STU-30) |
| Students / Admissions module dashboards | `StudentsDashboardApiController`, `AdmissionsDashboardApiController` | students/dashboard, admissions/dashboard | | POST api/students-dashboard/summary, api/admissions-dashboard/summary | NONE | /students/dashboard, /admissions/dashboard | Works; unauthenticated (STU-29) |
| Documents aggregation | `api\Documents\DocumentAggregationController` | documents/* | student_document, staff_document | GET api/documents, /sources, /recent | api.session + denyUnlessAdministrator | /documents | Complete and correct |
| Student rollover / promotion | `student\rollOverController` | app/Utility/rollover (outside dir list) | many | student/rollover(/create) | session mw | /utility/rollover | Works; issues STU-14, STU-25 |
| Circulars | `front_desk\circular\circularController` | front_desk/circular (outside list) | circular | front_desk/circular, circular/fetchData, TeacherFetchData | mixed | | Issues STU-35 |
| Parent communication | `parentCommunicationController` | front_desk/parent_communication | parent_communication | front_desk/parent_communication, studentParentcommunicationListAPI, add_communicationAPI | mixed | | STU-08 |
| Complaints / consent | `ComplaintApiController`, `ConsentApiController` | admin-services/* (outside list) | complaint, consent | api/complaints*, api/consents* | JWT + client tenant | | Same pattern as STU-06 |
| PTM | not traced beyond menu | admin-services/ptm-* | | | | | Not reviewed |
| Timetable | classwise/facultywise timetable are in front_desk (outside dir list) | | | | | | Only proxy/teacher-transfer/class-teacher touched |
| lib/{students,admissions,attendance,timetable,...}-ai-stack.ts | none | ai-stack screens | | | | | Config only |

Flags:
- Backend-without-UI: student delete/withdraw, student document upload, student transfer (Utility), promotion of a single student, `online_admission_confirm` API (no Next caller found in scope), `admission_enquiry` DELETE API.
- UI-without-backend / stubs: Add Student modal in `/students/search_student` (STU-32); `/reports/*` and `/academic_setup/subject-elective-mapping` are generic dumps (STU-33).
- Menu/rewrite pointing at the wrong thing: `next.config.ts` rewrites `/admission-enquiry`, `/admission-registration`, `/admission-confirmation` to authenticated internal pages, not public forms (STU-27).
- Duplicate modules under different names: attendance dashboard (`/attendance/attendance_dashboard`) vs `/student/student_attendance` (two UIs, opposite defaults, STU-12); enquiry create in `/admissions/admission_enquiry` vs `/admission-enquiry` (STU-27); two student search/list surfaces (`/students/search_student` and Laravel Blade `search_student`).
- Dead Laravel routes: `admission/online-admission/{id}/{title}` -> `onlineEnquiryFirst`, `admission/process-admission-enquiry` -> `processOnlineEnquiry`, `admission/admission-receipt` -> `receipt` (grep shows no such methods in `admissionEnquiryController`; these routes will 500).

---

## 3. Role / access-control findings (frontend gating vs backend enforcement)

Frontend
- There is no `middleware.ts` / `proxy.ts`. The only page-level gate is `app/components/ConditionalApp.tsx`, which renders `LoginPage` for any route while `!isAuthenticated` (client-side, localStorage-derived). Nothing role-gates the student/admission/attendance/admin pages: grep for `RequireStaff|useMenuRights|isStudentSession|canAccess` in this scope finds only `documents/*` (`canAccessDocuments`), `dashboard/page.tsx` (role -> dashboard), and `student/my_icard` (`isStudentSession` redirect). A student who types `/students/search_student`, `/student/bulk_student_update`, `/admissions/admission_enquiry`, `/user/add_user` gets the full UI; the only barrier is the backend.
- docs/student-menu-report.md explicitly states these modules are "staff/admin screens ... do not grant them to the student role" and relies on server-side menu grants. That is a menu-visibility control, not an authorization control.
- `resolveDashboardRole` maps any unrecognized `user_profile_name` (Parent, Accountant, Principal, HR...) to the Admin dashboard component (`app/dashboard/_lib/resolveDashboardRole.ts:20-21`). Data is still server-scoped by `RoleDashboardApiController`, so this is a UX defect, not a leak.

Backend enforcement per module

| Module | Enforcement actually present |
|---|---|
| Admission APIs (`/api/admission_enquiry`, `/api/admission_registration*`, `/api/admission_student`, `/api/online_admission_confirm*`) | None. No middleware, no JWT check, no rights. STU-01/02. |
| `student/api/student_certificate|student_icard|teacher_icard/*` | None. STU-03. |
| adminapi student controllers (`get_adminStudentSearch`, `bulk-students`, `student-care`, `student-infirmary`, `student-setup`, `student-optional-subject`, `student-registration`) | JWT signature valid = allowed. No role check (a student token works), no rights check, tenant from request body. STU-05. |
| Legacy `student/*`, `school_setup/proxy_master`, `admission/*`, `front_desk/*` via `session` middleware | JWT validated and session hydrated from claims (good), then `checkPermission` runs only if the route name has a `tblmenumaster` row (`checkPermission.php:44`, fails open otherwise), and controllers frequently override the verified tenant with `$request->sub_institute_id` for `type=API`. STU-06, STU-15. |
| `ClassTeacherApiController`, `TeacherTransferApiController`, `AcademicSetupApiController`, `TeacherDailyReportApiController`, `UserLogReportApiController`, `UserManagementApiController` | Correct: token id/tenant must equal request `user_id`/`sub_institute_id`, actor must be active in tenant, `tblindividual_rights`/`tblgroupwise_rights` checked per action. Note the hard-coded bypass for profile names `admin`/`super admin` in AcademicSetup (`AcademicSetupApiController.php:105`); `School Admin` relies on rights rows. |
| Role dashboards, `teacher-icard/mine`, Documents | Correct (api.session, is_student rejected, admin profile list). |
| Students / Admissions module dashboards | None. STU-29. |
| Complaints / Consent / other stateless APIs | JWT signature only, tenant + `user_id` from client (`ComplaintApiController.php:45-72`, `store` uses `COMPLAINT_BY = request user_id`). Same class as STU-06. |

Tests exist for the hydrator (`tests/Feature/Security/SessionMiddlewareAuthBypassTest.php`) and RBAC (`RbacEnforcementTest.php`) but they do not exercise these controllers; the hydrator being safe is defeated by controllers re-reading request input.

---

## 4. Tenant / school / academic-year scoping findings

- Client sends: `sub_institute_id`, `syear`, `user_id`, `term_id`, `user_profile_id`, `user_profile_name`, `client_id` and even the JWT as a `token` param, on every call (`lib/erp-client.ts:190-203`, `lib/erp-legacy.ts:100-118`, `app/fees/_lib/fees-api.ts:186-206`). The values come from `localStorage.userData/menuContext/sessionData` (trivially editable).
- Server trust:
  - Trusted from token (correct): everything behind `api.session` (`HydratesLegacyApiSession.php:66-90`) for `sub_institute_id`, `user_id`, `user_profile_id`, `is_admin`, `is_student`. The trait does NOT trust a client `sub_institute_id` (test proves it).
  - Trusted from client (wrong): the adminapi student endpoints (`$request->input('sub_institute_id')` after only `jwtToken()->validate()`), the legacy controllers' `type=API` branches, the three admission API controllers (no auth at all), `studentAttendanceController::saveStudentAttendance` (`teacher_id`, `user_profile_id`, `sub_institute_id`, `syear` from the body, line ~275-283), `proxyController::update/destroy` (id only), `circularController::store` (`action=API` switches to `$_REQUEST` ids), `tblstudentController::destroy` (id only), `studentRequestController::updateStatus` (id only).
  - Academic year: `HydratesLegacyApiSession.php:80-81,128` puts the client `syear`/`term_id` into the server session with no validation; that session value is then string-concatenated into raw SQL in several controllers (STU-14).
- Client-side year resolution is inconsistent between two helper stacks: `lib/erp-client.ts::buildSessionContext` picks the active term year and ignores stale `selectedAcademicYear` (comment lines 102-110), while `app/fees/_lib/fees-api.ts::getFeesSession` (used by students/student/dashboard modules) falls back to `academicYears[0]` = "earliest year on file (often empty of data)" (`fees-api.ts:152-156`). Screens can therefore query different years in the same session (STU-31).
- Data-model notes: `attendance_student` and `tblstudent_enrollment` carry `syear` + `sub_institute_id`; `tblstudent` carries `sub_institute_id` only (memory: `roll_no` is on enrollment, `roll_no_1` on `tblstudent` - the Next code correctly reads roll from enrollment). `admission_form.enquiry_id` stores `enquiry_no` while `admission_registration.enquiry_id` stores the numeric id (per `AdmissionsDashboardApiController` comment) - joins between them depend on that inconsistency.
- `proxy_master` list ignores `syear` although the controller reads it (`proxyController.php:36-77`): all years' proxies are listed for the tenant.

---

## 5. API endpoints consumed or exposed

`Auth` column: NONE = no authentication whatsoever; JWT-only = signature validated, identity/tenant taken from request; BOUND = JWT bound to tenant/user + rights.

### 5.1 Next.js route handlers in scope (exposed)

| Method | URL | Auth | Validation | Notes |
|---|---|---|---|---|
| POST | /api/students/dashboard/summary | forwards client Bearer; none of its own | requires sub_institute_id + syear only | base URL from client header `x-laravel-base-url` (SSRF, STU-30) |
| POST | /api/admissions/dashboard/summary | same | same | same |
| POST | /api/dashboard/{admin,teacher,student,teacher-fee-dues,teacher-icard,teacher-timetable} | forwards Bearer; teacher-icard requires token present | headers only | same SSRF pattern (`route.ts:42`) |
| GET/POST/PUT/PATCH/DELETE | /api/proxy?path=... | none of its own | only `path` non-empty | Forwards Authorization+Cookie to any Laravel path; owned by another audit part |
| POST | /api/proxy-file?path=... | none of its own | none | multipart forwarder |

### 5.2 Laravel endpoints consumed from this scope

adminapi (routes/adminapi.php; no route middleware, no `web` group so no CSRF):

| Method | URL | Called from | Auth | Validation | Notes |
|---|---|---|---|---|---|
| POST | get_adminStudentSearch | students/search_student/api.ts:115, ICards, house, health, discipline | JWT-only | tenant/syear required; filters typed | returns `tblstudent.*` + `tblstudent_enrollment.*` (incl. `password` hash); student scoping keyed on client `user_profile_name` (STU-05) |
| PUT | get_adminStudentSearch/{id} | search_student/api.ts:150 | JWT-only | fields validated loosely; no unique check on enrollment_no | name split, gender vocab (STU-18) |
| POST | get_adminAcademicSection / get_adminStandard / get_adminDivision | search_student/api.ts | JWT-only | | |
| GET | bulk-students/metadata | bulk_student_update/api.ts:56 | JWT-only | | |
| POST | bulk-students/search | :95 | JWT-only | | |
| PUT | bulk-students | :116 | JWT-only | field whitelist yes; no cross-field/dup/capacity validation | STU-19 |
| GET/POST/PUT/DELETE | student-infirmary, student-infirmary/students, student-infirmary/{id} | student_infirmary/api.ts | JWT-only | | STU-20 |
| GET/POST/PUT/DELETE | student-care/{module}[/{id}] | student-care-api.ts | JWT-only | student_id not tenant-checked; file upload ext from client | STU-20/39 |
| GET/POST/PUT/DELETE | student-setup/{quota|house}[/{id}] | setup-api.ts | JWT-only | delete unchecked | STU-24 |
| POST / PUT | student-optional-subject/search, student-optional-subject | student-admin-api.ts:11-12 | JWT-only | | |
| GET / GET / POST | student-registration/metadata, /next-enrollment-no, student-registration | student-admin-api.ts:8-10, students/house | JWT-only | email not unique-checked; division capacity not checked; default password md5 | STU-16 |

Legacy (`web` group; `session` middleware validates JWT for `type=API`; `check_permissions` fails open):

| Method | URL | Called from | Notes |
|---|---|---|---|
| GET | student/student_attendance | attendance-api.ts (direct to host), student_attendance/page.tsx | lists `class_teacher` rows for client `user_id` |
| POST | student/show_student_attendance | same | SQLi via `batch_sel` (non-teacher profiles), roster cross-tenant (STU-04/06) |
| POST | student/save_student_attendance | same | STU-10 |
| POST | student/show_daywise_student_attendance | daywise page:301 | SQLi (`syear`, `date` concatenated) |
| POST | student/show_monthwise_student_attendance | monthwise page:677 + attendance-api.ts | SQLi (`month`) |
| POST | student/yearly_student_attendance | yearly page:348 | not reviewed in detail |
| GET | get_batch | monthwise page:524 | no middleware, reads empty session (STU-41) |
| GET/POST | student/missing_document_report/create, student/student_request_report_fixed/create, student/show_student_health_report, front_desk/dicipline_report/create, student/student_strength_report/create, student/agewise, student/add_student | student-report.ts, student_documents/api.ts | tenant from client in API branch |
| GET/POST | student/student_request_fixed, student/student_request, student/student_request/create, student/student_request/{id}/status | students/requests/api.ts | STU-37 |
| GET/POST | student/api/student_certificate/{templates,search,preview,save,history} | StudentCertificateModule.tsx | NONE (STU-03) |
| GET/POST | student/api/student_icard/{metadata,search,preview}, student/api/teacher_icard/{metadata,search,preview} | student_icard/page.tsx, TeacherIcardModule.tsx | NONE (STU-03) |
| GET/POST | school_setup/proxy_master (+_method PUT/DELETE), proxy_master/create, ajax_getproxyperiod | proxy_master/api.ts | STU-21 |
| GET/POST | admission/admission_follow_up | followUpApi.ts, follow-up-agenda-api.ts | index: enquiry_id un-scoped |
| GET/POST | admission/admission_enquiry (list), admission/admission_master | follow-up agenda, admission-form | |
| ANY | admission/{admission_enquiry_followup_report, admission_enquiry_report, admission_registration_report, admission_without_con_report, admission_confirmation_report_v2}, admission/admission_registration_report_v2[/{id}/edit] | admission_reports/api.ts | tenant from session (hydrated) |

api group (`/api/...`):

| Method | URL | Auth | Notes |
|---|---|---|---|
| GET/POST/PUT/PATCH/DELETE | /api/admission_enquiry[/{id}] | NONE | STU-01 |
| GET | /api/admission_registration, /api/admission_registration/{id}/edit; PUT/PATCH /{id}; POST /api/admission_student; GET /api/ajax_getDivision; GET /api/admission_without_confirmation_report_v2[/{id}/edit] | NONE | STU-01/02 |
| GET/POST/PUT/PATCH/DELETE | /api/online_admission_confirm[/{id}] | NONE | STU-01 |
| POST | /api/admissions-dashboard/summary, /api/students-dashboard/summary | NONE | STU-29 |
| apiResource | /api/class-teachers | BOUND | |
| GET/POST | /api/teacher-transfer | BOUND | STU-22 |
| POST/GET | /api/teacher-daily-reports/search, /{teacherId}/details; /api/user-logs/bootstrap, /search | BOUND | |
| GET/POST/PUT/PATCH/DELETE | /api/academic-setup/{module}[/{id}] | BOUND | STU-24 |
| GET/POST | /api/users*, /api/user-profiles*, /api/user-reports/* | BOUND | STU-34 |
| GET | /api/documents, /api/documents/sources, /api/documents/recent | api.session + admin profile list | correct |
| POST | /api/admin-dashboard/summary, teacher-dashboard, student-dashboard, teacher-timetable, teacher-fee-dues, teacher-icard/mine | api.session, role checked | correct |
| GET/POST/DELETE | /api/migration-modules/{module}[/{id}] | JWT-only | students-marks, dynamic-reports, bazar*; STU-33 |
| GET/POST | /api/complaints*, /api/consents* | JWT-only + client tenant/user | not owned here |

Mobile/legacy endpoints in routes/student.php (not called by Next but same trust issues; exposed on the same host): `/studentAttendanceAPI`, `/studentTeacherListAPI`, `/studentHealthAPI`, `/studentDisciplineAPI`, `/studentLeaveApplicationAPI`, `/studentCertificateAPI`, `/notificationHubAPI`, `/teacherStudentListAPI`, `/allStudentListAPI`, `/studentParentcommunicationListAPI`, `/teacherParentcommunicationListAPI`, `/add_communicationAPI`, `circular/fetchData`, `circular/TeacherFetchData`, `/studentInfirmaryAPI`, `/studentVaccinationAPI`, `/studentHWAPI` - JWT-only with all identifiers from the body, except `studentParentcommunicationListAPI` which skips JWT unless `type=API` (STU-08).

---

## 6. Business-logic notes (Input -> Validation -> Rule -> DB change -> Side effect -> Output)

### 6.1 Student create (Next: `/student/add_student`)
- Input: GR no. (auto), section/standard/division, names, DOB, mobile, email, gender (`Male|Female|Other`), blood group, quota, house, address.
- Validation: server (`StudentRegistrationApiController::store`): first_name/enrollment_no/gender required, `grade/standard/division` integer only (no existence, no tenant, no grade<->standard<->division consistency, no `std_div_map` membership, no capacity check), `dob` date only (no future/age bound), `mobile` 10 digits, `email` format only.
- Rule: GR no. unique per tenant (pre-check + DB unique index `tblstudent_sub_institute_enrollment_no_unique`; the migration silently skips the index when duplicates already exist, so live enforcement is `NOT VERIFIED`). Frontend retries up to 3 times on "GR No. already exists" with a fresh number (good).
- DB: `tblstudent` row (`password = md5(env('DEFAULT_STUDENT_PASSWORD','student'))`, `status=1`, `admission_year = syear`) + `tblstudent_enrollment` row in one transaction; then `GraphSync::flushRecord`.
- Gaps: duplicate email allowed (login is by email, STU-16); gender stored as `Male` while every legacy consumer expects `M/F/O` (STU-18); no photo, documents, parent contact, religion, category, transport; no audit log; user profile id `Student` looked up per tenant (null if tenant has none, then inserted as NULL).

### 6.2 Student edit (Next search_student drawer -> PUT get_adminStudentSearch/{id})
- One string `name` is re-split into first/middle/last (first token, last token, remainder = middle) and overwrites all three columns. `enrollment_no` is overwritten with `admission_no` (null-able, no uniqueness check -> DB error 500 or silent duplicate if index absent). `class_name`/`section_name` are resolved by NAME (`standard.name = ?`), first match wins; a class change updates enrollment for the current `syear` only and does not check capacity, fees, timetable or optional-subject consequences.

### 6.3 Student delete/withdraw
- Only the legacy Blade path exists: `tblstudentController::destroy` sets `tblstudent.status=0` (no tenant filter) and `tblstudent_enrollment.end_date=today` for the session `syear`, logs an AuditLog. Soft delete: good. No check for fee dues, attendance, exam marks, transport, library; earlier-year enrollments remain open (`end_date` null) so the student still appears in prior-year lists; no undo path in Next (no UI at all).

### 6.4 Student list/search
- Next loads ALL students of the tenant+year including inactive in one POST on mount (`search_student/page.tsx:79-92`, `including_inactive=Yes`), returns full `tblstudent.*` rows, then filters/sorts/paginates in the browser (`page.tsx:156-170`). Pagination footer uses `students.length` (unfiltered) not `filteredStudents.length` (`StudentProfilesTab.tsx:417`). Fields `attendance`, `docsMissing`, `vaccination`, `allergy`, `infirmary`, `lastActive` are read from keys the API never returns (always 0/blank), so those dashboard columns show fabricated zeros.

### 6.5 Admission workflow (enquiry -> registration -> confirmation -> student)
- Enquiry create (Next `/admissions/admission_enquiry`): POST `/api/admission_enquiry` (no auth). Server validates only `sub_institute_id`,`syear`; body is mass-assigned into `admissionEnquiryModel` (`id`, `sub_institute_id`, `created_by` are fillable). The Blade controller's duplicate guard (first+last+mobile), mobile regex, DOB bounds and server-side `enquiry_no` generation are all bypassed on this path. Next computes `enquiry_no` client-side as `max(roster)+1` (`admission_enquiry/page.tsx:813-825`) -> duplicates when two users add at once; `/admission-enquiry` sends `enquiry_no: ''` (STU-27/28).
- Registration: `PUT /api/admission_registration/{id}` updates enquiry columns (`where id AND sub_institute_id` from client) then updates/inserts `admission_registration` (`data = request->except(...)`, mass assignment into `admission_registration`).
- Confirmation: `POST /api/admission_student` `saveStudent`: requires a registration row, `admission_standard` resolves, `student_quota` non-empty; duplicate guard by `(sub_institute_id, admission_id)`; GR number = MAX+1 with a 20-try existence loop (not atomic; relies on the unique index); inserts `tblstudent` (no password set -> admitted students cannot log in until credentials are provisioned elsewhere) and `tblstudent_enrollment` (`section_id = admission_division`, unvalidated). No status column transition on enquiry/registration is recorded; no fee-receipt/payment check; no age-eligibility check against `admissionAgeValidation`.
- Follow-up: `admissionFollowUpController::store` was hardened to session tenant but still mass-assigns `request->except(...)`, so `enquiry_id` can point at another tenant's enquiry; `index` reads any `enquiry_id`.
- Public unauthenticated forms exist only in Laravel Blade (`admission_enquiry` GET/`store` with `type=webForm`, `payment_proof`): no captcha, no throttle beyond global `throttle:1000,1` on `api` group (the `web` group has none), tenant chosen by URL, mass assignment, duplicate guard on name+mobile only (bypassable by any variation). Confirmation numbers/receipts are keyed by sequential integer ids (`enquiry_id` in `paymentProof`), i.e. IDOR.

### 6.6 Attendance marking
- Input: `date`, `standard_division`, `student[id]=P|A`, `teacher_id`, `user_profile_id`.
- Validation (`showStudent` only, not `save`): date inside `post_start_date..post_end_date` of the academic year, not a holiday (`calendar_events`), not Sunday. `saveStudentAttendance` re-checks none of these and does not check: code in {P,A}, student enrolled in that class/tenant, teacher is class teacher or timetable teacher for it, date not future, back-dating window, existing lock.
- Rule: upsert per student = SELECT then UPDATE/INSERT, 2 queries per student, no transaction, no unique key on `attendance_student(sub_institute_id, syear, student_id, attendance_date)` (migration has none) -> duplicate rows under double-click/concurrent teachers; `data[0]` is updated and other duplicates persist, so reports may read the wrong copy.
- Side effect: `sendNotificationAtt` runs only on a NEW row when `date == today` (server timezone); an "A" also queues an in-app notification; corrections (A->P) are silent; if the student or teacher is not found in the tenant it dereferences null after the row was already inserted (partial save + 500). `$request->attendance` P sends a push containing "is present ... Attendance Taken by ...".
- UI: dashboard default for unmarked students is ABSENT (STU-12); legacy page default is PRESENT (`student_attendance/page.tsx:656`); dashboard only lists sections from `class_teacher` for the logged-in user, so admins, subject teachers and proxy/substitute teachers cannot mark (STU-39). Date sent = `selectedDate.toISOString().slice(0,10)` (STU-11).

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

## 7. Test / documentation coverage for your scope

- Frontend: 42 tracked test files, none under `app/student*`, `app/admissions`, `app/attendance`, `app/proxy_master`, `app/classteacher`, `app/academic_setup`, `app/dashboard`. `lib/session/internal-access.ts` claims a test (`internal-access.test.ts`) that is not tracked. Zero coverage of the payload builders/mappers (`normalizeStudent`, `statusFromCode`, workflow.ts).
- Backend tests relevant to scope: `tests/Unit/AdmissionsFlowTest.php` (AI flow only), `tests/Feature/Security/SessionMiddlewareAuthBypassTest.php`, `RbacEnforcementTest.php` (generic middleware). No feature tests for attendance, student create/update, admission APIs, proxy, certificates.
- Documentation: `docs/student-menu-report.md` (2026-08-27) accurately says student/students are admin modules but does not note that the backend does not enforce that; `docs/teacher-user-journey.md`, `docs/user-journey/*` are narrative and were not compared line by line. Code comments repeatedly describe controls that do not exist on the endpoint being described (e.g. `AdmissionsDashboardApiController` "no session required so it can live on the plain api group", `routes/documents.php` header says authorisation is not gated while the controller does gate).

---

## 8. NOT VERIFIED items

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

## 9. Second-pass results

Grep over `app/{student,students,admissions,admission-Enquiry,attendance,dashboard,academic_setup,classteacher*,teachertransfer,teacher_daily_report,proxy_*,todays_proxy_report,documents,reports,user,user_log}` excluding `ai-stack`:

| Pattern | Count | Material hits |
|---|---|---|
| TODO/FIXME/HACK/XXX | 0 | none |
| console.log/error/warn | 16 | `students/search_student/page.tsx:87,101,113,...` swallow load errors with `console.error` only - list silently empty, no user message (part of STU-32) |
| debugger / eval / innerHTML / window.location | 0 | none |
| dangerouslySetInnerHTML | 5 | `student/my_icard/page.tsx:133`, `student/student_certificate/StudentCertificateModule.tsx:275,1132`, `student/student_icard/page.tsx:771`, `student/teacher_icard/TeacherIcardModule.tsx:677` - server HTML with unescaped student fields (STU-09) |
| document.write into `window.open('')` | 4 | `my_icard:80`, `StudentCertificateModule:236`, `student_icard:302`, `TeacherIcardModule:246` (same-origin popup executes any script in the HTML; `title` also unescaped) |
| window.open with noopener | 3 | `student/page.tsx:1145`, `student_icard:681`, `TeacherIcardModule:591` fine |
| localStorage/sessionStorage | 26 | all read session (`userData`, `menuContext`, `selectedAcademicYear`); `student/page.tsx:1149` writes `learningManagementAudienceMode`. JWT lives in localStorage (part of platform-level concern) |
| fetch( direct to `session.baseUrl`/`hostName` | attendance-api.ts, admission* pages, documents-api.ts, student_attendance get_admin* calls | baseUrl derived from `userData.host_name` in localStorage (editable) and used to send the bearer token |
| `return []` | 27 | benign empty-state returns in mappers; `fetchDivisions`/`fetchStandards` return `[]` on missing id (fine) |
| Hard-coded literals | 3 | `admission-Enquiry/page.tsx:19-37` class labels (Nursery..12th) posted as `admission_standard` (STU-27); `search_student/page.tsx:419-495` Add modal hard-codes classes 9-12 and sections A-C (STU-32); `admission-Enquiry` religions list |
| Hard-coded ids/URLs/emails/phones | 0 material (one placeholder email, one w3.org svg namespace) |
| Raw `x-laravel-base-url` header | 8 route handlers in scope, 20+ repo-wide | SSRF (STU-30) |
| `user_profile_id` / `user_profile_name` sent from client | `fees-api.ts:186-206` for every student-module call; server reads `user_profile_name === 'Student'` from body in `StudentSearchApiController:107` (STU-05) |
| `token` sent in query string / form body | `appendSessionParams/FormData` (`fees-api.ts:192,204`) on GET URLs such as `student-registration/metadata&...token=<jwt>` (STU-31) |

Laravel-side greps that produced findings: `whereRaw(` with concatenated input (attendance x6, admission API x3, circular x1, certificate x2, Helper `getStudents`), `$request->sub_institute_id` overrides in `student/*` (12+ controllers), `except([...])` mass assignment into `admission_enquiry`, `admission_registration`, `admission_follow_up`.

---

## 10. ISSUES

## STU-01
**Severity:** Critical   **Type:** Confirmed
**Category:** Security
**Module:** Admissions (enquiry / registration / online confirmation APIs)
**Location:** `D:\next_lms_erp\routes\api.php:424-453`; `D:\next_lms_erp\app\Http\Controllers\api\admissionEnquiryAPIController.php:35-161`; `...\admissionRegistrationAPIController.php:30-70,78-135,372-430,433-625`; `...\onlineAdmissionConfirmAPIController.php:12-167`; frontend callers `D:\lms_k12\app\admissions\admission_enquiry\page.tsx:568,1039,1113`, `admission_registration\workflow.ts:146,211,268`
**Function/Method:** `index/show/store/update/destroy` (enquiry), `index/edit/update/saveStudent` (registration), all methods (online confirm)
**Problem:** The three admission API controllers are registered at top level of `routes/api.php` with no middleware other than the group `throttle:1000,1`, and the controllers never call `jwtToken()->validate()` or read the session. Tenant scoping is whatever `sub_institute_id` the caller supplies (or none: `show`, `update`, `destroy`, and `saveStudent`'s first query use only `id`). The Next frontend sends a Bearer token, but nothing consumes it.
**Evidence:** `Route::controller(admissionEnquiryAPIController::class)->group(... Route::get('admission_enquiry','index'); Route::post('admission_enquiry','store'); Route::match(['put','patch'],'admission_enquiry/{id}','update'); Route::delete('admission_enquiry/{id}','destroy'))` at top level; `update()` does `admissionEnquiryModel::where('id',$id)->first(); $record->fill($request->except([...])); $record->save();` and the model `$fillable` includes `id` and `sub_institute_id`. `saveStudent` reads `$request->input('sub_institute_id')`, `id`, `term_id` and inserts into `tblstudent` and `tblstudent_enrollment`.
**Impact:** Anyone on the internet can (a) read every admission enquiry of any school (child names, DOB, parents' names, mobile, email, address, religion, previous school) by iterating `sub_institute_id`+`syear`; (b) modify or soft-delete any enquiry by sequential id, and move a record to another tenant by sending `sub_institute_id`; (c) create fake enquiries/registrations at scale; (d) turn an enquiry into a live `tblstudent` + enrollment row in any tenant via `POST /api/admission_student`; (e) delete online admission confirmations. This is a full unauthenticated read/write on admissions PII across all tenants (DPDP/GDPR-class exposure of minors' data).
**Expected Behavior:** Every admission endpoint sits behind `api.session` (or the bound-token pattern used by `ClassTeacherApiController`), takes tenant/user from the verified token, checks module rights per action, and scopes every query (including `show/update/destroy`) by tenant.
**Recommended Fix:** Wrap the three controller groups in `Route::middleware(['api.session','check_permissions'])`; replace `$request->input('sub_institute_id')` with `session('sub_institute_id')`; add `->where('sub_institute_id', $tenant)` to `show/update/destroy/saveStudent`; whitelist mass-assignment (remove `id`, `sub_institute_id`, `created_by` from what clients can set); keep a separate throttled, captcha-protected public endpoint if public enquiries are a requirement.
**Verification:** `curl` (no Authorization) `GET /api/admission_enquiry?sub_institute_id=1&syear=2026` currently returns rows; after fix must be 401. Feature test: token of tenant A cannot read/update enquiry id of tenant B.

## STU-02
**Severity:** Critical   **Type:** Confirmed
**Category:** Security
**Module:** Admissions
**Location:** `D:\next_lms_erp\app\Http\Controllers\api\admissionRegistrationAPIController.php:59,135,271` (and same construct in `admission\admissionReportController.php:61,227,381,446,534,606,694`, `admissionFormController.php:74`, `student\tblstudentController.php:~322`)
**Function/Method:** `index()`, `edit()`, related custom-field lookups
**Problem:** SQL injection through `sub_institute_id`. On the unauthenticated `/api/admission_registration` and `/api/admission_registration/{id}/edit` endpoints the value is concatenated into a `whereRaw`.
**Evidence:** `->whereRaw('(sub_institute_id = '.$sub_institute_id.' OR common_to_all = 1) and user_type="" ')` where `$sub_institute_id = $request->input('sub_institute_id')`.
**Impact:** Unauthenticated blind/UNION SQL injection into the shared multi-tenant MySQL database (all schools' students, staff, password columns). Combined with STU-01 this needs no account at all.
**Expected Behavior:** Bound parameters only; the input is an integer taken from the token.
**Recommended Fix:** `->where(function($q) use ($tenant){ $q->where('sub_institute_id',$tenant)->orWhere('common_to_all',1); })->where('user_type','')`; cast tenant to int; add a grep/CI rule against `whereRaw(` with `.` concatenation.
**Verification:** `GET /api/admission_registration?sub_institute_id=1)%20OR%201=1--%20&syear=2026` must not change the result set; add a test that a non-numeric tenant returns 422.

## STU-03
**Severity:** Critical   **Type:** Confirmed
**Category:** Security
**Module:** Student certificates / ID cards (student, teacher)
**Location:** `D:\next_lms_erp\routes\student.php:266-285`; `...\app\Http\Controllers\student\StudentCertificateApiController.php:8-173`, `StudentIcardApiController.php:12-310`, `TeacherIcardApiController.php`; `student\studentCertificateController.php:100-110,946-1016`; `app\Helpers\Helper.php:1616-1640`; frontend `D:\lms_k12\app\student\student_certificate\StudentCertificateModule.tsx:488-898`, `student_icard\page.tsx:359-549`, `teacher_icard\TeacherIcardModule.tsx`
**Function/Method:** `bootstrapRequestContext`, `templates/search/preview/save/history`, `getStudents`
**Problem:** `Route::prefix('student/api/student_certificate' | 'student/api/student_icard' | 'student/api/teacher_icard')` are declared outside every middleware group. `bootstrapRequestContext()` builds the tenant/user/profile context from `$request->input(...)` and then writes it into the session. There is no token check. Further, student ids are imploded into raw SQL and `template` is concatenated into raw SQL.
**Evidence:** `'sub_institute_id' => (string) $request->input('sub_institute_id', $request->session()->get('sub_institute_id'))`, `$request->session()->put($key,$value)`; `getStudents()`: `$stud_arr = implode(',', $student_ids); $extra_where = "s.id in (" . $stud_arr . ")";`; certificate: `WHERE module_name ="'.$template.'" AND sub_institute_id = ...` with `$template = $request->input('template')`.
**Impact:** Unauthenticated access to student search results and ID-card/certificate HTML for any tenant (name, DOB, address, mobile, parents, blood group, photo path), ability to issue certificate rows (`save` inserts `certificate_history`) for arbitrary student ids, and two unauthenticated SQL injections (`students[]` element, `template`). The same routes are reachable through the Next `/api/proxy` without logging in to the app.
**Expected Behavior:** Behind `api.session` + rights; tenant/year/user from token; ids validated as integers and tenant-owned; parameter binding.
**Recommended Fix:** Add `Route::middleware(['api.session','check_permissions'])` to the three prefixes; remove `bootstrapRequestContext`'s input-first resolution (session only); in `getStudents` use `whereIn('s.id', array_map('intval',$ids))->where('s.sub_institute_id',$tenant)`; bind `$template`.
**Verification:** `curl -X POST .../student/api/student_icard/search -d 'sub_institute_id=1&syear=2026&type=API'` returns students today; must be 401 after fix. Try `template=x" OR 1=1 -- ` on `preview`.

## STU-04
**Severity:** Critical   **Type:** Confirmed
**Category:** Security
**Module:** Attendance
**Location:** `D:\next_lms_erp\app\Http\Controllers\student\studentAttendanceController.php:150-156` (`batch_sel`), `:429,437` (`syear`,`date`), `:551,560,569` (`month`)
**Function/Method:** `showStudent`, `showDaywiseStudentAttendance`, `showMonthwiseStudentAttendance`
**Problem:** Request parameters are concatenated into raw SQL. Only a valid JWT (any user, including a student) is needed.
**Evidence:** `$extraRaw.=" AND batch.id='".$request->batch_sel."'";` then `->whereRaw($extraRaw)`; `->whereRaw("s.id = se.student_id AND se.syear = '" . $syear . "' ...")` and `a.attendance_date = '" . $date . "'`; `->whereRaw("month(school_date) = " . $month)` (unquoted). For Teacher profiles `$extraRaw` is overwritten by the class-teacher clause, so the injection is live for every non-Teacher profile (student, parent, admin).
**Impact:** Authenticated SQL injection reachable from any student/parent login, allowing extraction of any table across tenants (tbluser plaintext `plain_password`, tblstudent password hashes, fees).
**Expected Behavior:** Bound parameters, validated `date_format:Y-m-d`, `integer` month/year, `integer` batch id.
**Recommended Fix:** Replace with `->where('batch.id',$request->batch_sel)`; `Validator` rules; `whereMonth`/`whereRaw('month(school_date)=?',[(int)$month])`; bind `$syear`, `$date` in joins with `->where()`.
**Verification:** POST `student/show_student_attendance` with `batch_sel=x' OR '1'='1` and a non-teacher token: today returns all students; after fix 422.

## STU-05
**Severity:** Critical   **Type:** Confirmed
**Category:** Authorization
**Module:** Students (adminapi endpoints)
**Location:** `D:\next_lms_erp\routes\adminapi.php:104-126`; `app\Http\Controllers\api\StudentSearchApiController.php:16-139,140-260`, `BulkStudentApiController.php:45-240`, `StudentCareApiController.php:45-125`, `StudentInfirmaryApiController.php:17-205`, `StudentSetupApiController.php:20-68`, `StudentOptionalSubjectApiController.php:14-61`, `StudentRegistrationApiController.php:14-128`
**Function/Method:** every action; guard is `if (! $this->jwtToken()->validate()) ...` then `$request->input('sub_institute_id')`
**Problem:** These controllers validate that the bearer JWT is signed, then take `sub_institute_id`, `syear`, `user_id`, and (for search) `user_profile_name` from the request body. The verified token payload (`sub_institute_id`, `user_profile_id`, `is_student`) is never compared. There is no role check and no rights check (routes have no middleware). Contrast `TeacherTransferApiController`/`ClassTeacherApiController`, which do bind the token.
**Evidence:** `StudentSearchApiController.php:79` `->where('tblstudent_enrollment.sub_institute_id', $request->input('sub_institute_id'))`; `:107` `$request->input('user_profile_name') === 'Student' && $request->filled('user_id')` (self-scoping keyed on a client field); `StudentRegistrationApiController::guard()` only validates presence of `sub_institute_id`,`syear`; `BulkStudentApiController::update` updates `tblstudent` where `id` and client tenant.
**Impact:** Any authenticated principal of any tenant (a student, a parent, a teacher of another school) can: list all students of any school with `tblstudent.*` (includes `password` hash, parents' names/mobiles, address, Aadhaar-like columns per model fillable), edit or bulk-edit any student, create students in any school, read/write/delete medical (health, vaccination, infirmary) and discipline records, and add/delete houses and quotas of any school.
**Expected Behavior:** Tenant, user and profile taken from the verified claims; staff-only; rights checked per action (`view/add/edit/delete`), as in `ClassTeacherApiController::authorizeRequest`.
**Recommended Fix:** Put the routes behind `['api.session','staff.only','check_permissions']` (or copy the bound-token helper), drop request-supplied tenant/user/profile, add `->select` with an explicit safe column list (no `tblstudent.*`).
**Verification:** With tenant-A student token: `POST get_adminStudentSearch` with `sub_institute_id=B` returns B's students today; must be 403 after fix.

## STU-06
**Severity:** Critical   **Type:** Confirmed
**Category:** Authorization
**Module:** Attendance / Students legacy / Proxy / Circulars / Parent communication / Complaints
**Location:** representative: `studentAttendanceController.php:71-84,253-283` (save uses body `teacher_id`,`user_profile_id`,`sub_institute_id`,`syear`), `:623-690` (`studentAttendanceAPI` any `student_id`), `:878-` (`studentAttendanceChatAPI`); `studentRequestController.php:24-28,90-94,193-198,229-234`; `studentReportController.php:45-49,77-82`; `InactiveStudentReportController.php:48-51,87-90`; `missingDocumentReportController.php:39-42`; `school_setup\proxyController.php:36-77,486-522,523-547`; `front_desk\circular\circularController.php:123,214,265`; `parentCommunicationController.php:182,311,526`; `api\ComplaintApiController.php:45-72,185-235`; `admission\admissionFollowUpController.php:20-38`
**Function/Method:** the `if ($type == "API") { $sub_institute_id = $request->sub_institute_id; ... }` branches
**Problem:** The `session` middleware validates the JWT and hydrates a correct tenant from the token, but each controller then overwrites it with the request value when `type=API`. Identity fields (`teacher_id`, `user_id`, `user_profile_id`, `student_id`) are likewise client-supplied. The mobile-style endpoints (`studentAttendanceAPI`, `notificationHubAPI`, `allStudentListAPI`, `teacherStudentListAPI`, ...) accept any `student_id`/`teacher_id` with a valid token.
**Evidence:** `studentRequestController::index`: `$sub_institute_id = $request->session()->get('sub_institute_id'); if (in_array($type, ["API","JSON"])) { $sub_institute_id = $request->sub_institute_id; ... }`; `saveStudentAttendance`: `$user_id = $request->input('teacher_id'); $user_profile_id = $request->input('user_profile_id'); $sub_institute_id = $request->input('sub_institute_id');`; `studentAttendanceAPI` selects `attendance_student` where `student_id = input`.
**Impact:** Cross-tenant read and write across roster (`tblstudent.*` returned by `showStudent`), attendance rows, student change requests, proxy assignments, circulars, parent communication threads and complaints. A student can read any other student's attendance/absence notifications and can post attendance for any class in any school. `created_by`/`teacher_id` are forgeable so audit trails are unreliable.
**Expected Behavior:** Use only the hydrated session/claims for tenant and actor; ignore body values (or reject mismatch, as `ClassTeacherApiController` does with 403).
**Recommended Fix:** Replace all `$request->sub_institute_id`/`->user_id` reads in `type=API` branches with `session()` values; add a shared middleware that rejects requests whose `sub_institute_id`/`user_id` differ from the token; for student/parent tokens enforce `student_id == token id` (or sibling mapping).
**Verification:** Tenant-A teacher token posting `sub_institute_id=B` to `student/save_student_attendance` must be rejected; student token requesting another id on `/studentAttendanceAPI` must 403.

## STU-07
**Severity:** High   **Type:** Confirmed
**Category:** Security
**Module:** Students (data exposure)
**Location:** `D:\next_lms_erp\app\Http\Controllers\api\StudentSearchApiController.php:61-64`; `student\studentAttendanceController.php:167-181` (`tblstudent.*`); model `app\Models\student\tblstudentModel.php` (no `$hidden`)
**Function/Method:** `search()`, `showStudent()`
**Problem:** Queries select `tblstudent.*` and `tblstudent_enrollment.*` and return them verbatim; the Eloquent model defines no `$hidden`. Students' `password` (MD5, or bcrypt after upgrade), `otp`, `username`, Aadhaar/document columns, father/mother mobile are included.
**Evidence:** `tblstudentModel::select('tblstudent.*','tblstudent_enrollment.*', ...)` + `response()->json(['data'=>$students])`.
**Impact:** Combined with STU-05/06, any authenticated user obtains password hashes (MD5, offline-crackable, and the default `md5('student')` is shared by all newly created students) and OTPs for any student.
**Expected Behavior:** Explicit column allow-list for API output; `$hidden = ['password','otp']` on the model.
**Recommended Fix:** Whitelist columns in these selects; add `$hidden` to `tblstudentModel` and `loginModel`; rotate default passwords.
**Verification:** Call `get_adminStudentSearch` and confirm no `password`/`otp` key in the payload.

## STU-08
**Severity:** Critical   **Type:** Confirmed
**Category:** Security
**Module:** Parent communication
**Location:** `D:\next_lms_erp\app\Http\Controllers\front_desk\parentCommunication\parentCommunicationController.php:507-552`; route `routes\student.php:243`
**Function/Method:** `studentParentcommunicationListAPI`
**Problem:** The JWT check is executed only `if ($type == 'API')`, where `$type` is a client parameter. Omit `type` and the method returns parent-teacher messages and replies for any `student_id`/`sub_institute_id`/`syear` with no authentication. The POST route sits outside every middleware group and the CSRF exemption list contains full-URL patterns (`https://erp.triz.co.in/*`, `https://dev.triz.co.in/*`) that make it CSRF-exempt on those hosts.
**Evidence:** `$type = $request->input("type"); if ($type == 'API') { try { if (! $this->jwtToken()->validate()) ... } } $student_id = $request->input("student_id"); ... DB::table("parent_communication as pc") ... ->where("pc.student_id","=",$student_id)->where("pc.sub_institute_id","=",$sub_institute_id)`.
**Impact:** Unauthenticated enumeration (sequential ids) of private messages between parents and school staff for every child in every tenant.
**Expected Behavior:** Always authenticate; bind `student_id` to the caller (or their children).
**Recommended Fix:** Move JWT validation out of the conditional and add ownership checks; better, put all legacy mobile routes behind a single middleware.
**Verification:** `curl -X POST /studentParentcommunicationListAPI -d 'student_id=1&sub_institute_id=1&syear=2026'` (no header) must be 401.

## STU-09
**Severity:** High   **Type:** Confirmed
**Category:** Security
**Module:** Certificates / ID cards (stored XSS)
**Location:** frontend `D:\lms_k12\app\student\student_certificate\StudentCertificateModule.tsx:230-252,275,1132`; `student\student_icard\page.tsx:296-316,771`; `student\teacher_icard\TeacherIcardModule.tsx:246,677`; `student\my_icard\page.tsx:80,133`; backend `student\StudentIcardApiController.php:153-177`, `studentCertificateController` template fill
**Function/Method:** `openPrintWindow`, `openCertificatePrintWindow`, preview panes, `buildStudentCardHtml`
**Problem:** The server substitutes student/staff fields (name, father_name, address, mobile, enrollment_no) into the template with `str_replace` and no HTML escaping. The Next UI renders the result with `dangerouslySetInnerHTML` and prints it by `window.open('')` + `document.write(...)` (an about:blank popup shares the app origin, so injected script can read `localStorage` including the JWT). `title` is also interpolated unescaped.
**Evidence:** `$cardHtml = str_replace(htmlspecialchars('<<student_name>>'), \App\Helpers\sortStudentName($value['student_name'] ?? ''), $cardHtml);`; `printWindow.document.write(\`<html><head><title>${title}</title>...<body onload="window.print()">${html}</body></html>\`)`.
**Impact:** Any field an unprivileged actor can set becomes stored XSS in an administrator's browser. Realistic chain: unauthenticated enquiry (`first_name` = `<img src=x onerror=...>`, STU-01) -> admin confirms admission (copied into `tblstudent.first_name`) -> admin previews/prints an ID card or certificate -> token theft for the admin/School Admin session.
**Expected Behavior:** Escape all substituted values server-side (`e()`), sanitize template HTML (DOMPurify) client-side, render previews in a sandboxed iframe (`srcdoc` + `sandbox`), escape `title`.
**Recommended Fix:** `htmlspecialchars` every value in the `str_replace` chain; in Next replace `dangerouslySetInnerHTML` with `<iframe sandbox srcDoc=...>` and print from that iframe.
**Verification:** Create a student named `<img src=x onerror=alert(document.domain)>`, open ID-card preview; alert must not fire.

## STU-10
**Severity:** High   **Type:** Confirmed
**Category:** Business Logic
**Module:** Attendance
**Location:** `D:\next_lms_erp\app\Http\Controllers\student\studentAttendanceController.php:253-338`; migration `database\migrations\2023_03_05_115658_create_attendance_student_table.php:17-30`
**Function/Method:** `saveStudentAttendance`
**Problem:** Server-side validation that exists in `showStudent` (academic-year window, holiday, Sunday) is absent from `save`. There is no check that: the student is enrolled in the posted `standard_division` of the tenant; the caller teaches/owns that class; the date is not future or outside a back-dating window; `attendance_code` is `P`/`A` (column is `varchar(50)`, any string is stored). Upsert is SELECT-then-INSERT/UPDATE per student with no transaction and no unique index on `(sub_institute_id, syear, student_id, attendance_date)`.
**Evidence:** `foreach ($students as $student_id => $attendance) { $data = DB::table("attendance_student")->where($attendanceArray)->get()->toArray(); ... if (count($data) > 0) update(['id'=>$data[0]->id]) else insert }`; `$attendanceArray['attendance_code'] = $attendance;`.
**Impact:** Direct API calls can mark attendance for holidays/Sundays/future or out-of-year dates, for students not in the class or in another tenant, with arbitrary codes; double submits/concurrent teachers create duplicate rows (reports then read whichever row a query returns first). Attendance feeds notifications, reports, PAL risk/AI signals and result "days present".
**Expected Behavior:** Re-run the same date/holiday/academic-year checks at save, enforce class ownership (class teacher, timetable teacher or approved proxy), whitelist codes, wrap in one transaction with `INSERT ... ON DUPLICATE KEY UPDATE` backed by a unique index.
**Recommended Fix:** Extract the `showStudent` checks into a shared validator; add unique key migration (after de-duplicating); validate `student[]` ids against `tblstudent_enrollment` for the tenant/class/year; bulk upsert.
**Verification:** Post a holiday/Sunday/future date and an invalid code with a valid token; today accepted, must be rejected. Send two concurrent identical saves and confirm one row per student/day.

## STU-11
**Severity:** High   **Type:** Confirmed
**Category:** Business Logic
**Module:** Attendance (date handling)
**Location:** `D:\lms_k12\app\attendance\attendance_dashboard\page.tsx:141,191,228`; `D:\lms_k12\app\student\student_attendance\page.tsx:385-387`; also `student\student_infirmary\page.tsx:22`, `_components\StudentCareModule.tsx:41`, `admissions\admission_followUp\page.tsx:16`, `follow-up-agenda-api.ts:47`
**Function/Method:** `loadAttendance`, `handleSaveAttendance`, `getTodayIsoDate`
**Problem:** `selectedDate.toISOString().slice(0,10)` converts a local-midnight/now Date to UTC before formatting. For IST users (UTC+5:30) between 00:00 and 05:30 local time, "today" becomes yesterday; picking a date via prev/next buttons that create local midnight dates yields the previous day at all times. `lib/date-only.ts` exists precisely to prevent this ("this is data corruption, not a display quirk") but these pages do not use it.
**Evidence:** `const dateStr = selectedDate.toISOString().slice(0, 10);` at 141 (load) and 228 (save); `new Date().toISOString().slice(0, 10)` in `getTodayIsoDate`.
**Impact:** Attendance is loaded and saved against the wrong calendar day (permanently, in a DATE column); the "today" notification branch (`$date == date('Y-m-d')`) fires or not incorrectly; care/infirmary/follow-up records get date-shifted defaults.
**Expected Behavior:** Use `toDateOnly()`/`todayDateOnly()` from `lib/date-only.ts` everywhere a date-only value is produced.
**Recommended Fix:** Replace the six occurrences; add an ESLint `no-restricted-syntax` rule for `.toISOString().slice(0, 10)`.
**Verification:** Set the OS timezone to Asia/Kolkata, time 01:00; open the dashboard; request payload `date` must equal the local date. Unit test with `TZ=Asia/Kolkata`.

## STU-12
**Severity:** High   **Type:** Confirmed
**Category:** Business Logic
**Module:** Attendance
**Location:** `D:\lms_k12\app\attendance\_lib\attendance-api.ts:78-80,149`; `D:\lms_k12\app\attendance\attendance_dashboard\page.tsx:164-167,215-220`; contrast `D:\lms_k12\app\student\student_attendance\page.tsx:656`
**Function/Method:** `statusFromCode`, `fetchDailyRegister`, `handleSaveAttendance`
**Problem:** The dashboard maps any code that is not `P` (including empty/unmarked) to `absent`, and Save submits every row. A teacher who opens an unmarked day and presses Save records the whole class absent; the backend then queues an "absent" notification per student on first insert. The legacy page does the opposite (`attendanceByStudent[id] || 'P'`, unmarked = present). Two UIs for the same operation apply opposite silent defaults, and neither distinguishes "not yet marked".
**Evidence:** `function statusFromCode(code){ return code.trim().toUpperCase()==='P' ? 'present' : 'absent'; }`; legacy `accumulator[student.id] = result.attendanceByStudent[student.id] || 'P'`.
**Impact:** Mass false absences (with parent push/in-app notifications) or mass false presences; monthly overview charts count `L/H/other` codes as absent.
**Expected Behavior:** Three states (unmarked/present/absent); require an explicit action before enabling Save; consistent across UIs; support the codes the backend can store.
**Recommended Fix:** Add `unmarked` status; disable Save until all rows are decided or "Mark all present" is pressed; unify the two screens onto one component.
**Verification:** Open a date with no rows; confirm no student is preselected and Save is disabled.

## STU-13
**Severity:** High   **Type:** Confirmed
**Category:** Security
**Module:** Admissions (Laravel public forms)
**Location:** `D:\next_lms_erp\routes\admission.php:63-81`; `app\Http\Controllers\admission\admissionEnquiryController.php:361-470,1057-1077`
**Function/Method:** `store` (`type=webForm`), `paymentProof`
**Problem:** Public (unauthenticated) routes `admission_enquiry/store` and `admission_enquiry/payment_proof`: tenant/year come from the query/body; `store` mass-assigns `$request->except([...])` into `admission_enquiry` (any column); `paymentProof` stores `attachment` to the DigitalOcean disk with `public` ACL under `{enquiry_id}.{client extension}` and updates `admission_enquiry where id = enquiry_id` with no tenant/ownership check. No CAPTCHA/throttle (the `web` group has none). Three sibling routes (`onlineEnquiryFirst`, `processOnlineEnquiry`, `receipt`) point to controller methods that do not exist.
**Evidence:** `$file_name = $request->enquiry_id.'.'.$ext; Storage::disk('digitalocean')->putFileAs('public/admission_payment/', $file, $file_name, 'public'); admissionEnquiryModel::where(['id'=>$request->enquiry_id])->update(['payment_attachment'=>$file_name]);`; `grep processOnlineEnquiry|onlineEnquiryFirst|function receipt` finds only the route file.
**Impact:** Spam/PII injection at scale; anyone can overwrite any enquiry's payment proof (sequential ids) and host arbitrary content (html/svg/php extension) publicly on the Spaces bucket; broken public flow returns 500 for three advertised URLs.
**Expected Behavior:** Server-generated unguessable file names, extension/MIME allow-list and size limit, signed/short-lived tokens tying `enquiry_id` to the submitter, CAPTCHA + per-IP throttle, explicit column whitelist.
**Recommended Fix:** Validate `attachment` (`mimes:jpg,png,pdf|max:2048`), name with a random UUID and store the enquiry->file mapping only if a signed token matches; add `throttle:10,1` and CAPTCHA; remove or implement the three dead routes.
**Verification:** Upload `x.svg` with `enquiry_id` of another record; must be rejected. Hit the three dead URLs and confirm handled responses.

## STU-14
**Severity:** High   **Type:** Confirmed
**Category:** Security
**Module:** Academic year handling / Rollover / Admission reports
**Location:** `D:\next_lms_erp\app\Http\Middleware\Concerns\HydratesLegacyApiSession.php:80-81,128`; sinks `student\rollOverController.php:155-300` (string-concatenated `$to_next_syear`, `$from_current_syear`), `admission\admissionReportController.php:252`, `studentAttendanceController.php:429,437`
**Function/Method:** `hydrateSessionFromClaims`, `rollOverController::create`
**Problem:** The hydrator takes `syear` and `term_id` straight from the request and stores them in the server session with no validation that they belong to the tenant or are numeric. Legacy controllers treat `session('syear')` as trusted and concatenate it into SQL (`INSERT INTO academic_year ... SELECT ... '".$to_next_syear."' ... WHERE syear = '".$from_current_syear."'`).
**Evidence:** `$syear = $request->input('syear'); $termId = $request->input('term_id'); if (empty($syear) || empty($termId)) {... lookup ...}` then `$store->put('syear',$syear);` and `rollOverController`: `$to_next_syear = (session()->get('syear') + 1)` used in `DB::INSERT("... '".$to_next_syear."' ...")`.
**Impact:** A token holder with access to the rollover/report routes can inject SQL through `syear` (second-order via session), or select a foreign/arbitrary academic year. Also, rollover computed from a client-chosen year can create wrong-year data.
**Expected Behavior:** Validate `syear` is an integer and exists in `academic_year` for the token's tenant before storing it; controllers must bind, not concatenate.
**Recommended Fix:** In the trait: `abort 422` unless `DB::table('academic_year')->where(tenant)->where('syear',$syear)->exists()`; refactor rollover to `DB::insert(..., [?,...])` bindings.
**Verification:** Send `syear=2026' OR '1'='1` to `student/rollover/create` (GET) with a valid token; today executes; after fix 422.

## STU-15
**Severity:** High   **Type:** Architectural
**Category:** Authorization
**Module:** Permission middleware
**Location:** `D:\next_lms_erp\app\Http\Middleware\checkPermission.php:44-93`; routes without middleware (`routes\adminapi.php`, `routes\student.php:179-260`, `routes\api.php:424-453`)
**Function/Method:** `checkPermission::handle`
**Problem:** Rights are enforced only when the current route NAME matches a `tblmenumaster.link` row (`if($menu_id!='')`). Any route that is not a menu link (ajax/API helpers such as `save_student_attendance`, `show_student_attendance`, `student_request.status`, `ajax_getproxyperiod`) gets no check and falls open. The action inference is by URL substring (`str_contains(path,'delete'|'update'|'store'|'add'|'save')`) and HTTP method, so, for example, a POST search (`show_...`) requires `can_add`. Many API routes carry no `check_permissions` at all.
**Evidence:** `$menu_id = DB::table('tblmenumaster')->where('status',1)->where('link',$currentRouteName)->value('id'); if($menu_id!=''){ ... }` with no else branch; `//                if (empty($permissions)) { throw new AuthorizationException(...) }` is commented out.
**Impact:** Authorization is data-dependent: new/renamed routes are open by default; permission coverage cannot be audited from code. `NOT VERIFIED` which routes in this scope have menu rows.
**Expected Behavior:** Deny by default; explicit per-route permission keys (the newer `perm:`/bound-token helpers).
**Recommended Fix:** Invert the default (403 when no rights row for a mutating route), add route-level permission metadata, and add a CI check listing routes without `check_permissions`.
**Verification:** Enumerate routes lacking a menu row and assert a low-privilege token gets 403.

## STU-16
**Severity:** High   **Type:** Confirmed
**Category:** Business Logic
**Module:** Student create / login
**Location:** `D:\next_lms_erp\app\Http\Controllers\api\StudentRegistrationApiController.php:52-118` (`insertStudent`); `api\ApiLoginController.php:64-90`; `tblstudentController.php:463`; `.env.example:23`
**Function/Method:** `store`, `insertStudent`, `ApiLoginController::login`
**Problem:** (a) No email uniqueness check although login is by email and `first()` picks the first matching student (legacy `ajax_checkEmailExist` exists but the new API does not call it). (b) Every new student gets the same default password `md5(env('DEFAULT_STUDENT_PASSWORD','student'))`. (c) Students created via admission confirmation get no password at all.
**Evidence:** `->where(['email' => $email, 'status' => '1']); $studentData = $studentQuery->first();` then `verifyAndUpgradePassword`; insert `'password' => md5(env('DEFAULT_STUDENT_PASSWORD','student'))`, `'email' => $request->email` (nullable).
**Impact:** Siblings sharing a parent email (very common) collide: whoever matches first authenticates, other children cannot log in, and one student can read another's data through the platform's student session. Shared default password lets any student log in as any classmate created in the same batch whose email they know. Empty-blank `.env` value would yield `md5('')` (NOT VERIFIED).
**Expected Behavior:** Unique login identifier per student (username/enrollment+tenant), per-student generated password or first-login reset, credentials provisioned consistently for admission-confirmed students.
**Recommended Fix:** Enforce unique `(sub_institute_id,email)`; require a change on first login; generate random passwords and deliver via SMS/email; add tenant to the login lookup.
**Verification:** Create two students with the same email; log in with the default password and see which account opens.

## STU-17
**Severity:** High   **Type:** Confirmed
**Category:** Authorization
**Module:** Student delete / withdraw
**Location:** `D:\next_lms_erp\app\Http\Controllers\student\tblstudentController.php:1659-1697`; route `routes\student.php:63`
**Function/Method:** `destroy`
**Problem:** `tblstudentModel::where(["id" => $id])->update(['status'=>"0"])` has no tenant filter; the enrollment update is by `student_id`+session `syear`; there is no dependency check (fee dues, attendance, marks, transport, library, hostel) and earlier-year enrollments remain open. Frontend has no delete UI, yet the API is reachable with any delete-right user, and the DELETE path depends on a menu row (STU-15).
**Evidence:** `tblstudentModel::where(["id" => $id])->update($fields); tblstudentEnrollmentModel::where(["student_id" => $id, "syear" => $syear])->update($fields);`.
**Impact:** A user with delete right in school A can deactivate a student of school B by id; students with outstanding fees/attendance can be silently withdrawn; soft delete leaves inconsistent per-year enrollment state. (Soft-delete itself is the correct approach.)
**Expected Behavior:** Tenant-scoped, guarded (block or warn on dues/open records), records `end_date` on all open enrollments, audit-logged, reversible.
**Recommended Fix:** Add `where('sub_institute_id', session tenant)`; call a service that checks fees/library/hostel; end all open enrollments.
**Verification:** As tenant-A admin, DELETE `student/add_student/{idOfTenantB}` -> today 200; expected 404.

## STU-18
**Severity:** Medium   **Type:** Confirmed
**Category:** Database
**Module:** Student create/edit (data integrity)
**Location:** `D:\lms_k12\app\student\add_student\page.tsx` (gender options `Male|Female|Other`); `D:\lms_k12\app\students\search_student\api.ts:31-36,110-135` (`normalizeGender` then PUT `gender`); `D:\next_lms_erp\app\Http\Controllers\api\StudentSearchApiController.php:195-225`; consumers `studentAttendanceController.php:429-441` (`s.gender = 'M'`/`'F'`); legacy form `add_student_cn.blade.php:258-270` stores `M/F/O`
**Function/Method:** `updateStudent`, `normalizeStudent`, `StudentRegistrationApiController::store`, `StudentSearchApiController::update`
**Problem:** Legacy and bulk-update use `M/F/O`; Next add-student and profile edit write `Male/Female/Other`. Daywise attendance counts boys/girls with `gender='M'|'F'`. Profile edit also re-splits a single `name` into first/middle/last, overwrites `enrollment_no` with `admission_no` without a uniqueness check, and resolves class/section by NAME.
**Evidence:** `SUM(CASE WHEN s.gender = 'M' THEN 1 ELSE 0 END) AS BOY`; `body.set('gender', student.gender)` where `student.gender = normalizeGender(...)` returns `'Male'`.
**Impact:** Students created/edited in the new UI vanish from gender-based reports and totals; middle/last names are reshuffled on every edit (a two-word surname changes); duplicate GR numbers can be written by edit; ambiguous class names pick the wrong standard.
**Expected Behavior:** One canonical gender vocabulary at the API boundary; separate name fields in the edit form; uniqueness validation on update.
**Recommended Fix:** Map `Male/Female/Other` -> `M/F/O` in both API controllers (accept both, store canonical), backfill affected rows, edit first/middle/last separately, send ids not names for class/section.
**Verification:** Add a student via Next, then run daywise attendance; BOY/GIRL totals must include them.

## STU-19
**Severity:** Medium   **Type:** Confirmed
**Category:** Business Logic
**Module:** Bulk student update
**Location:** `D:\next_lms_erp\app\Http\Controllers\api\BulkStudentApiController.php:162-224`; frontend `D:\lms_k12\app\student\bulk_student_update\api.ts`
**Function/Method:** `update`
**Problem:** Whitelisted fields are updated without: uniqueness of `enrollment_no`/`uniqueid`, consistency between `grade`, `standard`, `division` ids, tenant ownership of those ids, division capacity, email/mobile format, or audit trail. A failing statement throws inside the transaction and surfaces as a 500 with SQL text. Enrollment update is scoped to the client `syear`.
**Evidence:** `foreach ($row['values'] as $field => $value) { ... $studentValues[$field] = $value === '' ? null : $value; ...} DB::table('tblstudent')->where('id',$studentId)->where('sub_institute_id',$tenantId)->update($studentValues);`.
**Impact:** Mass corruption (student moved into a standard of another grade or another school's division id, blanked GR numbers, duplicate GR numbers) with no undo.
**Expected Behavior:** Per-field validation rules, ownership checks, capacity check, audit log with old/new values.
**Recommended Fix:** Validate each field against a rules map; verify ids belong to the tenant and hierarchy; write to `AuditLog::record`.
**Verification:** Bulk-set `standard=<id from other tenant>`; must be rejected.

## STU-20
**Severity:** High   **Type:** Confirmed
**Category:** Security
**Module:** Student medical & discipline (PII)
**Location:** `D:\next_lms_erp\app\Http\Controllers\api\StudentCareApiController.php:45-125,142-160`, `StudentInfirmaryApiController.php:17-205`; frontend `D:\lms_k12\app\student\_components\student-care-api.ts`, `student_infirmary\api.ts`, `students\health_medical\api.ts`, `students\discipline\api.ts`
**Function/Method:** `index/store/update/destroy`
**Problem:** Health records (vaccination, height/weight, remarks, uploaded health documents, infirmary cases) and discipline notes for an entire tenant are returned by a single GET to any valid JWT (student/parent included, any tenant per STU-05). `store` accepts `student_id` without checking it belongs to the tenant, `update` lets `student_id` be re-assigned, and `created_by`/`name` come from the client `user_id`. Health documents are base64 in the JSON body with no size cap and no type check (see STU-38).
**Evidence:** `DB::table($config['table'].' as r')->join('tblstudent as s',...)->where('r.sub_institute_id', $request->input('sub_institute_id'))->get()`; `$data['student_id'] = $request->input('student_id'); $data['created_by'] = $request->input('user_id');`.
**Impact:** Sensitive minors' medical and behavioural data readable/alterable by any authenticated person; records can be attached to students of another school.
**Expected Behavior:** Staff/medical roles only with rights checks; ownership checks; upload validation.
**Recommended Fix:** Same remediation as STU-05 plus: validate `student_id` via `Rule::exists('tblstudent','id')->where(tenant)`, limit `file_data` to 5 MB and allow-listed MIME.
**Verification:** Student token GET `student-care/health?sub_institute_id=<own>` must return 403.

## STU-21
**Severity:** High   **Type:** Confirmed
**Category:** Business Logic
**Module:** Proxy / substitution teacher
**Location:** `D:\next_lms_erp\app\Http\Controllers\school_setup\proxyController.php:36-77 (index unscoped by syear), 176-312, 340-400 (store), 486-522 (update), 523-547 (destroy)`; frontend `D:\lms_k12\app\proxy_master\api.ts:104-249`
**Function/Method:** `getData`, `store`, `update`, `destroy`
**Problem:** `update` and `destroy` operate by `id` only (`proxyModel::where(["id" => $id])->update/delete()`), a cross-tenant IDOR (STU-06 pattern). `store` trusts client `date/timetable_id` keys and `teacher_id[]`: no check that the proxy teacher is free at that slot at save time (availability is computed only in `getproxyperiod`), that the date's weekday matches `timetable.week_day`, that the slot is not already proxied (no unique key), that the date is not in the past, or that the proxy teacher is an active teacher of the tenant. `$t_data[0]` is dereferenced without existence check (500 on a stale id). The list ignores `syear`.
**Evidence:** `proxyModel::where(["id" => $id])->delete();`; `$t_data = timetableModel::where([...])->get()->toArray(); $t_data = $t_data[0];`.
**Impact:** Cross-school deletion/reassignment of substitutions; double-booked or duplicated proxies; teachers assigned to substitute classes they cannot teach.
**Expected Behavior:** Tenant+syear scoped writes, conflict detection under lock, weekday/date validation, foreign-key validation.
**Recommended Fix:** Add tenant/syear to all queries; re-run availability query inside the store transaction; add unique key `(sub_institute_id, proxy_date, timetable_id)`.
**Verification:** Double-submit the same selection; expect one row. Delete a proxy id of another tenant; expect 404.

## STU-22
**Severity:** Medium   **Type:** Confirmed
**Category:** Business Logic
**Module:** Teacher transfer
**Location:** `D:\next_lms_erp\app\Http\Controllers\api\TeacherTransferApiController.php:171-214`
**Function/Method:** `store`
**Problem:** Transfer is `UPDATE timetable SET teacher_id = new WHERE teacher_id = left ...` only. It does not move `class_teacher`, `proxy_master` (both teacher columns), homework/diary ownership, attendance `teacher_id`, does not detect clashes where the receiving teacher already has a lecture in the same day/period, has no history/audit entry, and `syear` is client-supplied.
**Evidence:** `DB::table('timetable')->where('teacher_id', left)->where('sub_institute_id',$tenantId)->where('syear', $request->integer('syear'))->update(['teacher_id' => new])`.
**Impact:** After a "successful" transfer the departed teacher still owns class-teacher rights (attendance marking) and proxies; the new teacher can be double-booked; no way to see or reverse the change.
**Expected Behavior:** Transactional transfer across all teacher-keyed tables with clash detection and an audit record.
**Recommended Fix:** Extend the transaction, add clash query and `AuditLog::record`, validate `syear` belongs to the tenant.
**Verification:** Transfer a class teacher and confirm class_teacher/proxy rows follow.

## STU-23
**Severity:** Medium   **Type:** Confirmed
**Category:** Backend
**Module:** Class teacher master
**Location:** `D:\next_lms_erp\app\Http\Controllers\api\ClassTeacherApiController.php:230-330`
**Function/Method:** `store`, `update`
**Problem:** `grade_id`, `standard_id`, `division_id`, `teacher_id` are only `integer`; they are not verified to belong to the tenant, to be a mapped standard/division pair, or to be an active teacher. Duplicate detection is a check-then-insert with no unique index. (Authorization itself is correct.)
**Impact:** A class can be assigned a foreign or non-teacher user; concurrent creates duplicate class teachers, and class-teacher rows drive who can mark attendance (`class_teacher` is the only linkage the attendance UI uses).
**Recommended Fix:** `Rule::exists(...)->where(tenant)` for every id, check `std_div_map`, add unique index `(sub_institute_id,syear,grade_id,standard_id,division_id)`.
**Verification:** POST with a teacher id from another tenant; expect 422.
**Expected Behavior:** Only in-tenant, mapped, active entities can be linked.

## STU-24
**Severity:** Medium   **Type:** Confirmed
**Category:** Business Logic
**Module:** Academic setup / student master data
**Location:** `D:\next_lms_erp\app\Http\Controllers\api\AcademicSetupApiController.php:302-333 (destroy), 335-368 (std_div_map)`; `StudentSetupApiController.php:50-56`
**Function/Method:** `destroy`, `saveStandardDivisionMappings`, `StudentSetupApiController::destroy`
**Problem:** Subjects, periods (and `period_details`), batches, division capacities, subject-standard maps, houses and quotas are hard-deleted with no dependency check (timetable, marks, attendance, `tblstudent.studentbatch`, `tblstudent_enrollment.student_quota/house_id`, fee breakoff by quota). The standard-division mapping "save" deletes every `std_div_map` row of the tenant (not year-scoped) and re-inserts the posted set, changing all row ids.
**Evidence:** `DB::table($table)->where('id',$id)->where('sub_institute_id',$tenantId)->delete();`; `DB::table('std_div_map')->where('sub_institute_id',$tenantId)->delete(); DB::table('std_div_map')->insert($insert);`.
**Impact:** Orphaned timetable/student/fee records; an accidental partial payload wipes the tenant's class structure.
**Expected Behavior:** Block or soft-delete when referenced; year-scoped, diff-based updates.
**Recommended Fix:** Add `exists` checks per table before delete, switch to soft delete/`status`, upsert diff for `std_div_map`.
**Verification:** Delete a quota used by enrollments and confirm it is refused.

## STU-25
**Severity:** Medium   **Type:** Confirmed
**Category:** Business Logic
**Module:** Rollover / promotion
**Location:** `D:\next_lms_erp\app\Http\Controllers\student\rollOverController.php:155-300`; frontend `D:\lms_k12\app\Utility\rollover\api.ts:24-25,107-128`
**Function/Method:** `create`
**Problem:** The rollover that mutates data is a GET (`student/rollover/create`), so it has no CSRF protection semantics, can be repeated by refresh/prefetch/retry, and is logged as a read. Idempotency is "target year has zero rows in this table" per table, so one manual row in the target year permanently skips copying that table; year dates are copied with `date_add(..., INTERVAL 365 DAY)` (a leap year shifts every date by a day); the next year is derived from the client-influenced `syear` (STU-14). Student enrollment rollover was not reviewed in depth.
**Impact:** Partial/duplicate or silently skipped year setup; wrong term dates after leap years.
**Recommended Fix:** POST + confirmation token, per-row idempotency keys (rollover_id), `INTERVAL 1 YEAR`, audit log with counts.
**Verification:** Run twice; second run must report "already rolled over".
**Expected Behavior:** State-changing operation is POST, idempotent per row, and year arithmetic uses calendar years.

## STU-26
**Severity:** Medium   **Type:** Confirmed
**Category:** Business Logic
**Module:** Certificates
**Location:** `D:\next_lms_erp\app\Http\Controllers\student\studentCertificateController.php:956-972,1001-1013`
**Function/Method:** `ajax_saveData`
**Problem:** The duplicate-issue guard passes an array (`$student_ids = explode(',', ...)`) to `->where('a.student_id',$student_ids)`, so it does not match per student; the number generator `MAX(certificate_number)+1` is not locked (duplicate certificate numbers under concurrency); the TC guard is keyed by `syear`, allowing re-issue next year; `getStudents($student_ids)` is unscoped by tenant (STU-03).
**Impact:** Duplicate Transfer Certificates and duplicate certificate numbers (legal documents).
**Recommended Fix:** Loop per id with `whereIn`, unique index `(sub_institute_id, certificate_type, certificate_number)` + retry, drop the year from the TC guard.
**Verification:** Issue a TC for two students twice; the second must be refused.
**Expected Behavior:** One active TC per student; unique certificate numbers.

## STU-27
**Severity:** High   **Type:** Confirmed
**Category:** Frontend
**Module:** Admissions (public enquiry page)
**Location:** `D:\lms_k12\next.config.ts:50-61`; `D:\lms_k12\app\admission-Enquiry\page.tsx:19-37,101-118,157-175`; `D:\lms_k12\app\components\ConditionalApp.tsx:36-42`
**Function/Method:** rewrites; `buildEnquiryPayload`; `handleSubmitEnquiry`
**Problem:** The rewrites `/admission-enquiry`, `/admission-registration`, `/admission-confirmation` suggest public parent-facing pages, but `ConditionalApp` renders the login screen for any unauthenticated visitor and the enquiry page itself requires `session.subInstituteId/syear/token`. The form posts class LABELS (`Nursery`, `LKG`, `1st`, ...) as `admission_standard`, while the database and every downstream join/`saveStudent` treat it as a `standard.id`. `enquiry_no` is sent empty. After success it redirects to `/admissions/registration` (a staff list) rather than a thank-you page.
**Evidence:** `admission_standard: values.admissionStandard` where options come from `const standards = ['Nursery','LKG',...]`; `enquiry_no: values.enquiryNumber` (initial `''`).
**Impact:** Enquiries from this page carry a non-id standard (join to `standard` fails, later "select an admission standard" error or a strict-mode SQL error), and have no enquiry number; the "public" flow cannot be used by prospective parents at all.
**Expected Behavior:** Either a genuinely public, rate-limited, captcha-protected tenant-keyed form using ids from an unauthenticated lookup, or removal of the misleading rewrites.
**Recommended Fix:** Load standards from the API (ids), server-generate `enquiry_no`, decide the public/private design and build it once (likely a small public Next route + throttled Laravel endpoint).
**Verification:** Submit the form and inspect the stored `admission_standard`.

## STU-28
**Severity:** Medium   **Type:** Confirmed
**Category:** Business Logic
**Module:** Admissions workflow
**Location:** `D:\lms_k12\app\admissions\admission_enquiry\page.tsx:813-825,1076`; `D:\next_lms_erp\app\Http\Controllers\api\admissionEnquiryAPIController.php:66-98`; `admissionRegistrationAPIController.php:433-625`
**Function/Method:** `nextEnquiryNumber`, `store`, `saveStudent`
**Problem:** Enquiry numbers are computed in the browser from the loaded roster (`max+1`) and trusted by the API; the API `store` skips the Blade controller's duplicate check (name+mobile), mobile regex, DOB validation and `get_enquiry_no`. There is no status/state field transition (enquiry -> registered -> confirmed) recorded, no payment/document/age-eligibility gate before student creation, and `saveStudent` reads `admission_division` unvalidated into `section_id`; GR number is MAX+1 with a 20-try loop.
**Impact:** Duplicate enquiry numbers and duplicate people; students created without division/eligibility checks.
**Expected Behavior:** Server-generated sequence, one validation set shared by all entry paths, explicit status column with allowed transitions.
**Recommended Fix:** Reuse the Blade validator/`get_enquiry_no` in the API (wrapped in a locked sequence), add `status` transitions and required-field gate in `saveStudent`.
**Verification:** Two browsers create an enquiry simultaneously; numbers must differ.

## STU-29
**Severity:** High   **Type:** Confirmed
**Category:** Security
**Module:** Students / Admissions dashboards
**Location:** `D:\next_lms_erp\routes\api.php:140-141`; `app\Http\Controllers\api\StudentsDashboardApiController.php:19-96`, `AdmissionsDashboardApiController.php`; frontend `D:\lms_k12\app\students\_lib\students-dashboard-api.ts`, `admissions\_lib\admissions-dashboard-api.ts`
**Function/Method:** `summary`
**Problem:** The two dashboard endpoints require no authentication (`$request->validate(['sub_institute_id','syear'])` only). The students summary returns enrollment counts, gender breakdown, drop-out reasons and `recent_enrollments` including student full names, class and division.
**Evidence:** `Route::post('students-dashboard/summary', ...)` at top level (not under `api.session`); response `recent_enrollments` selectRaw `CONCAT_WS(' ', ts.first_name, ts.last_name) as student_name`.
**Impact:** Unauthenticated disclosure of any school's headcount, drop-out reasons and newest students' names.
**Expected Behavior:** `api.session` + staff rights, tenant from token (as `RoleDashboardApiController` does).
**Recommended Fix:** Move under the existing `Route::middleware('api.session')` group with `staff.only`, ignore body tenant.
**Verification:** `curl -X POST /api/students-dashboard/summary -d '{"sub_institute_id":1,"syear":2026}'` returns data today; expect 401.

## STU-30
**Severity:** Medium   **Type:** Confirmed
**Category:** Security
**Module:** Next.js dashboard proxy route handlers
**Location:** `D:\lms_k12\app\api\students\dashboard\summary\route.ts:52`, `admissions\dashboard\summary\route.ts:55`, `dashboard\{admin,student,teacher,teacher-fee-dues,teacher-icard,teacher-timetable}\route.ts:42`; same header in 12 other handlers (`fees`, `hostel`, `library`, `transportation`, `pal/submit`, `forgot-password`, `google-auth`, `lib/laravel-category-proxy.ts:55`, `lib/agents/acting-user.ts:39`)
**Function/Method:** `POST`
**Problem:** The upstream host is taken from the client-controlled header `x-laravel-base-url` (falls back to env). The handler then `fetch`es `${baseUrl}/api/...` server-side with a POST body and forwards the caller's cookie and bearer token.
**Evidence:** `const baseUrl = readHeader(request, 'x-laravel-base-url') || getDefaultBaseUrl();` ... `fetch(\`${baseUrl}${LARAVEL_PATH}\`, {method:'POST', headers:{Authorization, Cookie}, body})`.
**Impact:** Server-side request forgery (POST) to arbitrary or internal hosts from the Next server (internal admin panels, cloud metadata over POST-tolerant services), and exfiltration of the visitor's `Cookie` to an attacker-chosen host when the victim is tricked (header cannot be set cross-site, so mainly SSRF and internal probing).
**Expected Behavior:** Base URL only from server env (or an allow-list of configured hosts).
**Recommended Fix:** Remove the header override or validate against an allow-list; strip `Cookie` forwarding.
**Verification:** Send `x-laravel-base-url: http://127.0.0.1:9` and observe the server-side connection attempt in logs.

## STU-31
**Severity:** Medium   **Type:** Confirmed
**Category:** Frontend
**Module:** Session/year helpers and JWT in URLs
**Location:** `D:\lms_k12\app\fees\_lib\fees-api.ts:152-156,186-206`; `D:\lms_k12\lib\erp-client.ts:102-136`; `D:\lms_k12\app\student\student-admin-api.ts:8-9`, `_components\setup-api.ts:17`, `student-care-api.ts:21`
**Function/Method:** `getFeesSession`, `appendSessionParams`
**Problem:** (a) Two session readers resolve `syear` differently: `buildSessionContext` picks the active term year and ignores stale `selectedAcademicYear`; `getFeesSession` falls back to `academicYears[0]`, which the other helper's own comment describes as "the earliest year on file (often empty of data)". (b) `appendSessionParams` sets `token=<JWT>` in the query string of GET calls (`student-registration/metadata&...`, `student-setup/...`, `student-care/...`) and forwards it through `/api/proxy`.
**Impact:** Modules built on the fees helper (students, admissions dashboards, student master data) can silently query a different year than modules on `erp-client` (empty screens/wrong data after first login). JWT appears in URLs, therefore in Next/Laravel/CDN access logs and Referer headers.
**Recommended Fix:** Use one helper (erp-client) everywhere; send the token only in the `Authorization` header.
**Verification:** Clear `selectedAcademicYear`, login as a user with several years; compare `syear` sent by `/students/search_student` and `/attendance/attendance_dashboard`.
**Expected Behavior:** One year-resolution rule; no secrets in URLs.

## STU-32
**Severity:** Medium   **Type:** Confirmed
**Category:** Frontend
**Module:** Student list (`/students/search_student`)
**Location:** `D:\lms_k12\app\students\search_student\page.tsx:79-92,156-170,418-495`; `components\StudentProfilesTab.tsx:385-405,417`; `api.ts:88-89`
**Function/Method:** page component, `normalizeStudent`
**Problem:** (1) "Add New Student" modal is a static form: inputs have no state/handlers, hard-coded classes 9-12 and sections A-C, and the "Add Student" button only closes the modal - the user thinks a student was added. (2) Row "Edit" and "Delete" buttons have no `onClick`. (3) The page fetches every student of the tenant/year including inactive, with `tblstudent.*`, on mount and searches/paginates client-side; load errors are only `console.error`ed (empty table, no message). (4) The footer shows `students.length` (unfiltered) as the total. (5) Columns `attendance`, `docsMissing`, `vaccination`, `allergy`, `infirmary` are mapped from keys the API never returns, so they render as 0/blank.
**Impact:** Misleading UI (fake success, dead controls, fabricated zero metrics), heavy payload for large schools, incorrect counts.
**Recommended Fix:** Remove or implement the modal (link to `/student/add_student`), wire or remove dead buttons, server-side pagination/search, surface errors, fix count.
**Verification:** Click Add Student and check network tab for a request.
**Expected Behavior:** Every visible control performs or is absent; totals match the filter.

## STU-33
**Severity:** Medium   **Type:** Confirmed
**Category:** Backend
**Module:** Generic migrated modules (`/reports/*`, subject-elective mapping)
**Location:** `D:\lms_k12\app\reports\{students-marks,dynamic-report-builder,broken-link-finder,nomenclature}\page.tsx`, `academic_setup\subject-elective-mapping\page.tsx`, `app\migration-modules\MigrationModulePage.tsx:16-49`; `D:\next_lms_erp\app\Http\Controllers\api\MigrationModulesApiController.php:17-70`
**Function/Method:** `MigrationModulePage`, `index`, `studentMarks`
**Problem:** These menu screens are one shared component that GETs `/api/migration-modules/{module}` and dumps the first 10 columns of raw records in a table (`students-marks`, `subject-electives`, `dynamic-reports`...). There is no filter UI, no create/edit/delete UI although the backend supports POST/DELETE, no pagination. The backend `guard` validates a JWT but takes tenant/user from the body; `students-marks` returns `result_marks` joined with students for the tenant to any token; `dynamic-reports` unions every tenant's `privacy=1` definitions; `bazar*` tables are not tenant-scoped at all.
**Impact:** Screens titled "Subject - Standard Elective Mapping", "Students Marks Report", "Dynamic Report Builder" do not provide those features (Stub); marks data is accessible to any authenticated user of any tenant.
**Recommended Fix:** Build real screens or hide the menu entries; apply STU-05's authorization to this controller; tenant-scope every module.
**Verification:** Student token GET `/api/migration-modules/students-marks?sub_institute_id=<n>&user_id=1&syear=2026`.
**Expected Behavior:** Feature screens do what their titles claim, behind rights checks.

## STU-34
**Severity:** High   **Type:** Confirmed
**Category:** Security
**Module:** User management
**Location:** `D:\next_lms_erp\app\Http\Controllers\api\UserManagementApiController.php:189-201`; `ApiLoginController.php:47,69` (selects `plain_password`)
**Function/Method:** `values()`
**Problem:** The newly written API hashes the password (`Hash::make`) and also stores the raw password in `tbluser.plain_password`.
**Evidence:** `$values['password'] = Hash::make($request->input('password')); $values['plain_password'] = $request->input('password');`.
**Impact:** Any read access to `tbluser` (including via the SQL injections in STU-02/04) reveals every staff password in clear text; hashing is defeated.
**Expected Behavior:** Never persist plaintext.
**Recommended Fix:** Stop writing `plain_password`, null out existing values, drop the column after legacy dependencies are removed.
**Verification:** Create a user via `/user/add_user` and inspect `plain_password`.

## STU-35
**Severity:** High   **Type:** Confirmed
**Category:** Security
**Module:** Circulars
**Location:** `D:\next_lms_erp\app\Http\Controllers\front_desk\circular\circularController.php:96-135,260-300,493-520`
**Function/Method:** `fetchData`, `store`, `destroy`, `searchCircularTitle`
**Problem:** `destroy` hard-deletes `circular` by `Id` only (no tenant); `searchCircularTitle` concatenates input into `LIKE "%...%"` (SQL injection); `store` switches to client `syear/sub_institute_id/user_id` when `action=API`, takes `standard[]`/`division[]` from `$_REQUEST` without tenant validation (or all standards x all divisions with `allstd`), and stores attachments with a client extension under a predictable name; `fetchData` returns circulars for any `student_id` with only a valid token.
**Evidence:** `DB::table('circular')->where(["Id" => $id])->delete();`, `->whereRaw('circular.title LIKE "%'.$searchValue.'%"')`.
**Impact:** Cross-tenant circular deletion, SQL injection, wrong-audience notifications, arbitrary file upload.
**Recommended Fix:** Tenant-scope, bind, validate ids belong to the tenant and to `std_div_map`, allow-list extensions.
**Verification:** DELETE `front_desk/circular/{id-of-other-tenant}`.
**Expected Behavior:** Only own-tenant circulars deletable; audience limited to mapped classes.

## STU-36
**Severity:** Medium   **Type:** Confirmed
**Category:** Business Logic
**Module:** Attendance notifications
**Location:** `D:\next_lms_erp\app\Http\Controllers\student\studentAttendanceController.php:322-334,806-876`
**Function/Method:** `saveStudentAttendance`, `sendNotificationAtt`
**Problem:** Notification is sent only on a new row when `date == date('Y-m-d')` (server timezone); a corrected mark never notifies, a wrong first mark already did. `sendNotificationAtt` dereferences `$getStudent->student_name` and `$getCreatedBy->full_name` without null checks after the attendance row was inserted, so an unknown student/teacher produces a 500 with a partial save. Present marks also trigger pushes.
**Impact:** Parents get false absent alerts that are never corrected; partial saves on bad input.
**Recommended Fix:** Notify on state change, null-safe lookups, queue asynchronously, do not couple notification failure to save.
**Verification:** Save A then P for one student; only the first triggers a notification.
**Expected Behavior:** Notifications reflect the final state; failures do not break saves.

## STU-37
**Severity:** Medium   **Type:** Confirmed
**Category:** Business Logic
**Module:** Student requests
**Location:** `D:\next_lms_erp\app\Http\Controllers\student\studentRequestController.php:151-184`; frontend `D:\lms_k12\app\students\requests\api.ts:80`
**Function/Method:** `updateStatus`
**Problem:** Approval/rejection updates `student_change_request` by `ID` only, with `DECIDED_BY` from the client `user_id`, no tenant filter, no state machine (Approved can flip to Rejected and back), and no restriction on who may decide (route has no confirmed menu row; `NOT VERIFIED` per STU-15). Also see `store` (creates rows for any `student_request[]` ids).
**Impact:** Cross-tenant tampering and forged approver identity; decisions are not final.
**Recommended Fix:** Scope by tenant, allow transitions only from `Pending`, take decider from token, require approve right.
**Verification:** POST status for an id of another tenant.
**Expected Behavior:** One decision per request by an authorized in-tenant user.

## STU-38
**Severity:** Medium   **Type:** Confirmed
**Category:** Security
**Module:** File uploads (student photo, parents' photos, student documents, health documents, circular attachments)
**Location:** `D:\next_lms_erp\app\Http\Controllers\student\tblstudentController.php:246-320,1430-1484`; `tblstudentDocumentController.php:48-60`; `api\StudentCareApiController.php:88-98`; `circularController.php:275-300`
**Function/Method:** `store`, `update`, `payload`
**Problem:** Extension is taken from the client filename (`File::extension($originalname)` / `pathinfo`), files are written to public storage (`storeAs('public/student/'...)`) or Spaces with `public` ACL; parent images are named `father_{enrollment_no}_{tenant}.ext` (predictable); `oldFatherImage`/`oldMotherImage` from the request are appended to the delete path; documents have no size/type limit; `tblstudentController::store` uses undefined `$id` for the student photo name (`$name = $id;` in a method with no `$id`) which raises an error under Laravel's error handling and breaks photo upload on the legacy add-student path.
**Impact:** Stored HTML/SVG/PHP-extension files served from the app/bucket domain; enumerable parent photos; possible deletion of unintended keys; broken legacy photo upload.
**Recommended Fix:** Server-generated random names, extension from MIME sniffing with allow-list, private disk + signed URLs for documents/health files, validate `old*` names.
**Verification:** Upload `test.svg` containing script as a student document and load its public URL.
**Expected Behavior:** Only allow-listed types are stored, under unguessable names, and private by default.

## STU-39
**Severity:** Medium   **Type:** Confirmed
**Category:** Backend
**Module:** Attendance UX scope / permissions model
**Location:** `D:\lms_k12\app\attendance\_lib\attendance-api.ts:105-125`; `D:\next_lms_erp\app\Http\Controllers\student\studentAttendanceController.php:31-58`
**Function/Method:** `fetchClassSections`, `index`
**Problem:** The attendance dashboard lists only sections from `class_teacher` for the logged-in `user_id`. Admin/Principal, subject teachers (timetable), and proxy/substitute teachers therefore see an empty class list and cannot mark attendance, although `proxy_master` and `timetable` model exactly those cases; the legacy page instead lists all classes for non-teachers. The only code-level linkage between teachers and marking is `class_teacher` (per memory, teacher->standard linkage is otherwise via `timetable`).
**Impact:** Substitute cover and admin corrections cannot be recorded in the new UI; users fall back to the legacy page with the opposite defaults (STU-12).
**Recommended Fix:** Return classes from `class_teacher` UNION `timetable` (today) UNION `proxy_master` (today) and allow admin roles all classes; enforce the same on save (STU-10).
**Verification:** Log in as an admin and as a proxy teacher; the section list must be non-empty.
**Expected Behavior:** Anyone entitled to take a class can do so, and only them.

## STU-40
**Severity:** Medium   **Type:** Confirmed
**Category:** Security
**Module:** CSRF configuration (Laravel)
**Location:** `D:\next_lms_erp\app\Http\Middleware\VerifyCsrfToken.php:17-45`
**Function/Method:** `$except`
**Problem:** `$except` contains full-URL patterns for `https://erp.triz.co.in/*`, `https://dev.triz.co.in/*`, `http://127.0.0.1:8000/*`. `VerifyCsrfToken::inExceptArray` tests `fullUrlIs`, so on those hosts CSRF is disabled for every `web`-group route, including cookie-session Blade routes (student, admission, fees, fee receipts), not just the JWT ones. It also explains why all the student routes above accept POST without a token.
**Impact:** Session-authenticated staff can be cross-site-request-forged on production (add/delete/update actions on any legacy route).
**Recommended Fix:** Exempt only `api/*`-style stateless paths; remove host-wide entries; give the Next proxy a stateless prefix.
**Verification:** Cross-origin form POST to a Blade route while logged in.
**Expected Behavior:** CSRF enforced for cookie-authenticated routes.

## STU-41
**Severity:** Medium   **Type:** Confirmed
**Category:** Frontend
**Module:** Attendance UI consistency
**Location:** `D:\lms_k12\app\attendance\attendance_dashboard\page.tsx`, `app\student\student_attendance\page.tsx`, `monthwise_student_attendance\page.tsx:524`; `D:\next_lms_erp\routes\student.php` (`get_batch`)
**Function/Method:** page components; `get_batch`
**Problem:** Two competing attendance-marking screens; the monthwise page's batch dropdown calls `get_batch`, a route outside the `session` middleware group that reads `$request->session()->get(...)` - with no hydrated session it always returns batches for a null tenant (empty). Attendance only supports `P`/`A` (`varchar(50)` column, comment in attendance-api.ts) and every other stored code is displayed as absent.
**Impact:** Batch filter for month reports is dead (`NOT VERIFIED` at runtime); duplicate screens diverge.
**Recommended Fix:** Move `get_batch` under `session`; consolidate the UIs.
**Verification:** Open monthwise page, choose a class with batches, inspect `get_batch` response.
**Expected Behavior:** One attendance experience; batch filter functional.

## STU-42
**Severity:** Low   **Type:** Confirmed
**Category:** Security
**Module:** Unauthenticated legacy student routes
**Location:** `D:\next_lms_erp\routes\student.php:213-260`
**Function/Method:** `add_students` (GET), `add_students/store`, `checkExists`, `dicipline_alone/*`, `search_students`, `ajax_checkEmailExist`, `ajax_checkDivisionCapacity`, `document_details`
**Problem:** Routes are outside any auth group; they read tenant/year from the (empty) session, so they mostly return nothing, but `add_students/store` and `dicipline_alone/store` are unauthenticated write entry points and the `add_students?sub_institute_id=257&syear=2024&type=web` comment documents a design where the tenant comes from the URL.
**Impact:** Currently low (session empty) but any change that reads request input would turn these into open write endpoints.
**Recommended Fix:** Remove or protect.
**Verification:** POST `add_students/store` unauthenticated and inspect the outcome.
**Expected Behavior:** No unauthenticated write routes.

## STU-43
**Severity:** Medium   **Type:** Confirmed
**Category:** Testing
**Module:** Whole scope
**Location:** `D:\lms_k12` (42 test files, none in scope); `D:\next_lms_erp\tests` (no attendance/student/admission API tests)
**Function/Method:** n/a
**Problem:** No automated coverage of the student, admission, attendance, proxy, certificate, transfer flows; the hydrator/RBAC tests do not exercise these controllers, which is how the token-vs-request tenant defects survived.
**Impact:** Regressions and the authorization defects above are undetected.
**Recommended Fix:** Add Laravel feature tests per controller (401 without token, 403 on cross-tenant, 403 for student token, happy path) and unit tests for `statusFromCode`, `normalizeStudent`, date helpers.
**Verification:** CI red on cross-tenant request.
**Expected Behavior:** Every mutating endpoint has an authorization test.

## STU-44
**Severity:** Low   **Type:** Improvement
**Category:** Frontend
**Module:** Maintainability
**Location:** `D:\lms_k12\app\student\add_student\page.tsx`, `student\student-admin-api.ts`, `student\student_optional_subject\page.tsx` (whole components in 1-5 minified lines); `app\dashboard\_lib\resolveDashboardRole.ts:20-21`
**Function/Method:** page components; `resolveDashboardRole`
**Problem:** Critical write flows are hand-minified single-line components that cannot be code-reviewed or diffed; unknown profile names (Parent, Accountant, Principal) render the Admin dashboard shell.
**Impact:** Review/maintenance risk; confusing empty admin dashboard for non-admin roles (data is server-scoped).
**Recommended Fix:** Reformat with Prettier and enforce in CI; map unknown profiles to a neutral landing.
**Verification:** n/a.
**Expected Behavior:** Readable code; unknown roles do not get an admin shell.

## STU-45
**Severity:** Medium   **Type:** Potential
**Category:** Security
**Module:** Token lifetime
**Location:** `D:\next_lms_erp\app\Http\Controllers\api\ApiLoginController.php:426-434`
**Function/Method:** `login`
**Problem:** JWT `exp` is only set when `JWT_TTL_MINUTES > 0`; default 0 means tokens never expire. Given the token is kept in `localStorage` and is passed in URLs (STU-31), a leaked token is valid forever. `NOT VERIFIED` whether production sets it.
**Impact:** Permanent access after any token leak; stolen tokens survive password changes.
**Recommended Fix:** Default to a finite TTL and refresh flow.
**Verification:** Decode a production token and check for `exp`.
**Expected Behavior:** Short-lived tokens.

ISSUE COUNTS: C=7 H=16 M=20 L=2 I=0

# part12 - Uploads / Imports & Exports / Notifications / Jobs & Scheduler / Third-party integrations (Phases 13-17)

Scope: static analysis of `D:\next_lms_erp` (Laravel) and `D:\lms_k12` (Next.js). Read-only. No server was contacted, no `.env*` was read, no command was run other than `grep`/`ls`/`sed`/`git ls-files`/`git diff`. Issue prefix `INT`. Existing reports were read first and are **extended, not repeated**: part06 (FIN-01/26/38/51/77), part08 (HR-15/19/21/31), part10 (BE-03/05/06/08/09/26/27), part04 (LMS-15/16), part07 (STU-38), part02/03 (LLM proxies, env, `integration-configs` mock). Where an existing issue already covers a fact it is cross-referenced (e.g. "see BE-05") and only the new evidence is added.

Baseline note: the Laravel working tree has **uncommitted changes** (`git status`: `app/Http/Middleware/RequireApiJwt.php`, `config/api_guard.php`, `routes/api.php`, `routes/pal_api.php`, `app/Http/Kernel.php`, `.env.example`, `tests/Feature/Security/ApiGuardTest.php`). They add an *opt-in* JWT guard for a list of `api/*` paths. All findings below were verified against the working tree; where the uncommitted guard changes the picture it is stated (see INT-36).

Auth-tier legend used in every table:

* **T0** anonymous (route has no auth middleware; only the `web` group CSRF, or the `api` group throttle).
* **T1** web group `['session','menu','logRoute','check_permissions']`. `SessionMiddleware` accepts `type=API|JSON` with a bearer JWT, so the Next.js SPA reaches these routes. `checkPermission` enforces menu rights **only when the route name matches a `tblmenumaster.link` row** (`checkPermission.php:34-48`); otherwise it is a no-op.
* **T2** `api.session` (JWT hydrates a legacy session; any role, incl. student/parent; some add `staff.only`).
* **T3** `api` group only; controller self-checks a JWT or nothing; tenant taken from the request body.
* **T4** `lms.auth` + `perm:*`.
* Disks: **PUB** = Laravel `public` disk (`storage/app/public`, exposed at `/storage` by `storage:link`), **DO** = `digitalocean` S3 disk written with ACL `public`, **WEB** = `public_path()` (directly in the web root), **PRIV** = `storage/app` (not web served).

---

## 1. Scope & coverage

| Area/dir | Files in scope | Read fully | Skimmed | Not reviewed | Notes |
|---|---|---|---|---|---|
| Laravel upload / write-to-disk sites (`->move(`, `storeAs(`, `Storage::put`, `putFileAs`, `file_put_contents`) | 296 raw grep hits in 141 files; 202 real upload/write sites in ~100 controller files after removing `app/Console`, `app/Domain` store() name collisions and comments | ~30 controllers (all high-risk ones) | ~70 (by targeted context extraction: 28 lines before each site for validation/filename/route) | `result_master`/`result_book_master` logos, `hostel_master`, `add_driver`, `book_list` internals (pattern identical, verified by grep only) | Route tier resolved per route file and group (RouteServiceProvider + each `routes/*.php`). |
| `config/filesystems.php`, `public/.htaccess`, `.gitignore` | 3 | 3 | - | Live web-server config (nginx/Apache PHP-in-`/storage` handler) | `NOT VERIFIED` - REASON: server config not in repo. |
| Standalone PHP under `public/` (`excel_upload/*.php`, `*_integration.php`, `getworkflow.php`, `123.php`...) | 30+ | 10 (`excel_upload/ajax.php`, `db.php`, `export_xlsx.php`, `map_student_document_data.php`, `bulk_question_data.php`, heads of the other bulk scripts) | 15 | `public/library/*`, vendored PHPExcel/`auth/vendor` | part10 (BE-06) covered the credential/`$_REQUEST` census; this report adds the import scripts. |
| Import controllers (API + web + standalone + Maatwebsite) | 14 | 9 | 5 | - | `ImportApiController`, `Import\ImportController`, `fees_reconciliation_upload_sheet_controller`, `bulkUploadSheetController`, `studentBulkUpdateController`, `LeaveImport`, `BulkTaskController`, `G2gLms\GovernanceController`, `AssignmentsController`, `MigrationModulesApiController::bazarUpload`, NACH S2/S4 (see FIN-38), `public/excel_upload/*`. |
| Export code (PDF/Excel/CSV) | Laravel 16 dompdf call sites, 2 `Excel::download`, 2 `fputcsv`, 6 wkhtmltopdf helpers, NACH S1/S3; frontend `lib/table-export.ts` + 20 own `new Blob(` exporters + 7 jsPDF/html2canvas files | 12 | 20 | jsPDF layout internals | |
| Notifications (SMS / e-mail / WhatsApp / FCM / in-app) | `app/Mail` (3), `app/Notifications` (0 - dir does not exist), `Helper.php` senders, 11 copies of `sendSMS`, `WhatsappController`, `easy_com` (web 6 + api 14), 22 controllers calling `send_FCM_Notification`, `api/Platform/NotificationController`, `config/platform_services.php` | 14 | 25 | e-mail/SMS Blade views, mobile-app notification list endpoints | |
| Jobs / Events / Listeners / Observers / Scheduler / Commands | `app/Jobs` (4), `app/Events` (1), `app/Listeners` (1), `app/Observers` (0 - dir does not exist), `app/Console` (91 files), `Kernel.php`, `routes/console.php`, `config/queue.php`, `EventServiceProvider` | Kernel, routes/console, queue config, 4 jobs (headers), listener, 8 commands | remaining ~80 commands (signature list + guard grep) | body of the 15 `SyncONet*` commands (identical template; credential lines grepped) | |
| Third-party integrations | 60+ env keys, 45 outbound hosts, `config/{services,ai,claude,deepseek,gemini,openrouter,gamma,neo4j,mcp,mobile_page_builder,platform_services}.php`, ~12 integration classes | 12 | 25 | live provider dashboards, webhooks configured at providers, real env values | Every env value is `NOT VERIFIED` (rule 2). |
| Frontend (Next) | `app/layout.tsx`, `next.config.ts`, `lib/table-export.ts`, `components/ui/file-upload.tsx`, `app/import-data/page.tsx`, `app/api/{import/*,proxy-file,integration-configs,google-auth}`, 69 `type="file"` inputs, 85 CSV/XLS download files | 9 | 60 | individual upload pages' business logic (other agents) | |
| **Totals** | ~450 files touched | ~90 read fully | ~200 skimmed by targeted extraction | see notes | 0 files modified except this report |

Unreviewed and why: (a) live web-server/PHP handler config (repo has none); (b) provider-side webhook settings; (c) the 12 one-off `next:*` tenant-257 commands beyond their header/`where` clauses; (d) the mobile-app consumption of `app_notification` rows.

---

## 2. Module inventory (your scope)

### 2.1 Phase 13 - File uploads / storage

| Module | Backend | Frontend | DB tables | API endpoints | Permissions/roles | Menu entry | Status |
|---|---|---|---|---|---|---|---|
| Student photo / parent photos / student documents / health docs | `student\tblstudentController`, `tblstudentDocumentController`, `studentHealthController`, `bulkStudentController` | `app/student/*`, `StudentCareModule.tsx` | `tblstudent`, `tblstudent_document`, `student_health` | `student/*` (T1), `student-care/{module}` (T3) | menu rights only | yes | Mostly complete; validation missing (INT-11) |
| Staff documents / payslips / resumes / offer letters / onboarding / compliance evidence | `user\tbluserController@addUserDocument`, `EmployeeDirectoryController@uploadDocument`, `PayrollController`, `JobApplicationController`, `OfferController`, `OnboardingDocumentController`, `ComplianceEvidenceController`, `FileController` | `organization-management/employee-directory/.../upload-doc-tab.tsx`, `talent-management/*` | `staff_document`, `hp_*` | `organization-management/*`, `talent-management/*` (T2 `staff.only`), `user/*` (T1) | see HR-31 | yes | Complete but public-ACL storage (INT-07) |
| LMS content / homework / H5P / teacher resources / question-paper assets | `lms\contentController`, `ApiLmsCourseController`, `StudentHomeworkApiController`, `HomeworkSubmissionApiController`, `lms\h5p\*`, `TeacherResourceApiController`, `ContentUploadService` | `app/course-master`, `app/lms/homework`, `app/h5p` | `lms_*`, `homework*` | `lms/*` (T1), `api/lms-*` (T2/T4), `lms-homework/*` in `api_guard.protect` | LMS-15/16 | yes | Mixed: 2 hardened services, ~20 inline sinks |
| Front desk / visitor / petty cash / inward-outward / complaints / gallery / circular | `frontdesk\*`, `implementation\frontdesk\*` (duplicate of `frontdesk`), `api\{FrontDesk,Complaint,PettyCash,PhotoVideoGallary}ApiController`, `visitor_management\*`, `inward_outward\*` | `app/admin-services/*`, `app/front_desk`, `app/inward_outward` | `frontdesk`, `petty_cash`, `visitor_master`, ... | T1 web + T3 api | part06 FIN-77 | yes | Complete; T3 endpoints unauthenticated (INT-10) |
| Fees uploads (receipt-book logos, fee config images, NACH S2/S4, reconciliation sheet) | `fees\*` | `app/fees/master/*`, `NACH_s*` | `fees_*`, `fees_reconciliation` | `fees/*` (T1) | FIN-38 | yes | See INT-13 |
| Settings / school logos / announcements / result masters / driver photo | `settings\*`, `school_setup\schoolController`, `result\*`, `transportation\add_driver` | - | - | T1 | - | yes | Pattern-identical sinks |
| Face attendance (student capture photos) | `front_desk\studentFaceAttendanceController`, `classFaceAttendanceController`, `adminapiController` | - | `student_capture_attendance` | T1 + adminapi (T3) | - | yes | Biometric images sent to 3rd party (INT-14) |
| Rich-text editor upload | `CkeditorFileUploadController` | legacy blade | - | `POST /ckeditor` (T0) | - | n/a | BE-05 |
| Downloads / zips | `FileController`, `sqaa_controller`, `monthwiseReceiptPdfController`, `ExamEvaluationApiController@file`, `TaskAttachmentVersionController@download`, `AiAssistanceTicketController@screenshot`, `ApiQuestionPaperController@pdf`, `H5P*@export` | - | - | mixed | - | - | INT-35 |

Flags: **backend-without-UI**: `transferDocs`/`convertDoc`, `download-folder`, `unlink-file`, `crm-whatsapp` (external CRM caller). **UI-without-backend**: none new. **Duplicate modules**: `implementation\frontdesk\*` duplicates `frontdesk\*` (identical upload code, 4 controllers); `contentLibraryControllerOld` not routed but present; `result_controller_OLD/OLD2` copies.

### 2.2 Phase 14 - Import / export

| Module | Backend | Frontend | DB tables | Endpoints | Permissions | Menu | Status |
|---|---|---|---|---|---|---|---|
| Generic import (tbluser, tblstudent, fees_collect, result_marks, result_personalize_marks, ...) | `api\ImportApiController` (API), `Import\ImportController` (web) | `app/import-data/page.tsx`, `app/api/import/{parse,process}` (Next proxies, **unused by the page**) | `csv_data`, `import_table_fields` | `POST api/import/{tables,parse,match-fields,process}` (T2); `/import_parse`, `/import_process` (T0) | none beyond `api.session` | `import-data` | Partially complete; design defects (INT-05, INT-12) |
| Bulk student edit / active-inactive / bulk photo | `student\bulkStudentController`, `studentBulkUpdateController` | `app/student/*` | `tblstudent*` | T1 | menu rights | yes | Works; no transaction |
| Fees reconciliation sheet | `fees_reconciliation_upload_sheet_controller` | fees pages | `fees_reconciliation` | T1 | menu | yes | Wrong amount (INT-13) |
| NACH S1-S4 | `fees\NACH\*` | `NACH_s2excel_import`, `NACH_s4excel_import` | `bank_master` etc. | T1 | menu | yes | FIN-38, INT-08 |
| Bazar uploads (share-market position/margin/pnl) | `bazar\bulkUploadSheetController`, `MigrationModulesApiController` | `app/bazar/bulk-upload` | `sharebazar_*` | T1 / `migration-modules/{module}` | menu | yes | Data loss (INT-29) |
| Leave import | `leave\ApplyLeaveController@importOldLeave`, `Imports\LeaveImport` | - | `hrms_emp_leave` | `POST /import-leave` (T1) | menu | yes | INT-28 |
| Bulk task CSV, G2G assign/governance CSV | `BulkTaskController`, `G2gLms\AssignmentsController`, `GovernanceController` | task-management, capability pages | `task`, `tbluser` | T2 `staff.only` | staff | yes | Best-practice examples (row errors, tenant scoped) |
| Standalone PHPExcel scripts | `public/excel_upload/*.php` | Blade links (`bulk_chapter_upload.blade.php`), `ImplementationManagementPage.tsx:94` | `chapter_master`, `topic_master`, `lms_question_master`... | direct URLs (T0) | **none** | link only | INT-04 |
| Exports | `lib/table-export.ts` (64 pages), 20 own Blob exporters, `Excel::download` x2, `PDF::loadHTML` x16, wkhtmltopdf helpers x6 | - | - | - | tenant filter server-side | - | INT-30, INT-32 |

### 2.3 Phase 15 - Notifications

| Channel | Where sending code lives | Per-tenant credentials | Trigger tier | Queue? | Status |
|---|---|---|---|---|---|
| SMS | `Helper.php:2062 sendSMS` + 10 copy-pasted `sendSMS()` methods (`apiController:817`, `adminapiController:2923`, `send_sms_parents_controller:113`, `send_sms_staff:196`, `send_email_other:175`, `send_email_parents:188`, `feesStatusController:269`, `s4excel_importController:686`, `send_late_sms:111`, `visitor_masterController:561`) | `sms_api_details` (URL + query params + key, plaintext) via `manage_sms_api` | T1/T2 (bulk), T0 (`Resend_otp`) | no (sync curl, no timeout) | Working but fragile (INT-23) |
| E-mail | PHPMailer with per-tenant `smtp_details` in 6 controllers; Laravel `Mail::` only for signup/forgot-password/offer letter/MCP report/broken-links; Mailables: `OfferLetterMail`, `StudentReportNotice`, `BrokenLinksNotification` | `smtp_details` (plaintext password) | T1/T2, T1-no-perm (`ajax_sendmail`) | only `ReportSender` uses `->queue()` | INT-06 |
| WhatsApp | `WhatsappController` (Meta Cloud API v25), `easy_com\SendWhatsappParentsApiController`, legacy Twilio `SyncWPDeliveryStatus` | `whatapp_user_details` (`cloud_api_access_token`, `cloud_api_phone_number_id`, plaintext) | T1/T2; **T0 `crm-whatsapp`** | no | INT-01, INT-22 |
| FCM push | `Helper.php:1799 send_FCM_Notification2` (legacy keys, hard-coded), `:1842 send_FCM_Notification` (v1, service-account JSON in `public/firebase/`) called inline from 22 controllers | 3 hard-coded legacy server keys + 4 service-account file names keyed on tenant ids 254/76/48/default | T1/T2 | no | BE-09 + INT-23 |
| In-app | `sendNotification()` -> `appNotificationModel::insert` (mobile app), `TaskManagement\NotificationController`, Platform `NotificationController` (config matrix only) | - | - | no | INT-25 |
| Parent communication | `front_desk\parentCommunication\parentCommunicationController` (FCM + in-app), `easy_com\send_*` | - | T1 | no | ok |
| Laravel `app/Notifications` | **does not exist** (0 files). `app/Observers` also 0. | | | | |

### 2.4 Phase 16 - Jobs / events / scheduler

| Component | Location | Status |
|---|---|---|
| Queue default | `config/queue.php:16` `env('QUEUE_CONNECTION','sync')`; `retry_after` 90 on database/redis; `jobs` table migration `2026_08_20_000001`, `failed_jobs` `2019_08_19_000000` (live existence `NOT VERIFIED`) | INT-26 |
| Jobs (4) | `EvaluateAnswerSheetJob` (tries 2, timeout 600), `EvaluateAssignmentSubmissionJob` (2/300), `EvaluateHomeworkSubmissionJob` (2/600), `EvaluateHomeworkSubmissionV2Job` (2/300); all have `failed()`; none `ShouldBeUnique`/`WithoutOverlapping`/`backoff` | INT-26 |
| Events/Listeners | `ExamSubmitted` -> `GenerateAssessmentEvidenceListener` (`ShouldQueue`, tries 2, `failed()`), registered in `EventServiceProvider:23` | ok (runs inline under `sync`) |
| Observers | none | - |
| Scheduler | `Kernel.php:17-92` - exactly **3** scheduled items (`neo4j:drain` every minute `withoutOverlapping(5)`, `neo4j:reconcile` 02:30 `withoutOverlapping(120)`, two closures every 5 min `withoutOverlapping()`); `routes/console.php` only `inspire` | INT-27 |
| Commands (91 files, 86 commands) | 15 `SyncONet*` (manual), 12 `next:*` tenant-257 one-off migrations (`cnsports/`), 25 `pal:*`, 10 `neo4j:*`, `ai:*`, `lms:*`, `cai:*`, `brain:*`, `sync:deliveryStatus` (Twilio, unscheduled), `test`, `test:function` | INT-21, INT-37 |
| Web-reachable "cron" endpoints | `GET /send_birthday_notification` (T0), `GET /Resend_otp` (T0), `GET /convertDoc` (T0), `POST /transferDocs` (T0) | INT-20, INT-02 |
| Scheduled data mutators | **none** for fees: no Razorpay status job, no fee reminders, no attendance auto-close; `fetch_payment_status` endpoints are only invoked by the SPA / on demand | INT-17, INT-27 |

### 2.5 Phase 17 - Third-party integrations (full table)

| # | Integration | Direction / purpose | Config source | Secret storage (redacted) | Auth | Timeout / retry | TLS verify | Inbound webhook signature | Production readiness |
|---|---|---|---|---|---|---|---|---|---|
| 1 | Razorpay (`api.razorpay.com`, checkout.js) | Fee payments | per-tenant DB `fees_razorpay`, `fees_hdfcrazorpay` (`key_id`,`key_secret`) via `fees_online_maping` | plaintext DB columns | key/secret basic; return handler uses `verifyPaymentSignature` (`online_fees_collect_controller.php:3097,3382`) | SDK default | SDK default (ok) | **no webhook route**; browser-return + polling only | Partial (INT-17) |
| 2 | HDFC (`hdfc_*` handlers) | Fee payments | DB `fees_hdffc`; hard-coded tenant 76 in handler (`:321,:920`) | plaintext | AES request/response | n/a | n/a (form POST) | **none** (FIN-01/BE-08) | Broken (FIN-01) |
| 3 | ICICI Eazypay (`eazypay.icicibank.com`) | Fee payments | DB `fees_icici` (`merchant_id`,`enc_key`); tenant 2440 hard-coded to UAT host `:1246` | plaintext | AES + verify call `EazyPGVerify` | none set (`CURLOPT_TIMEOUT` absent) | default | none | Broken (FIN-01) |
| 4 | ICICI Orange / PayPhi-style (`pgpay.icicibank.com`) | Fee payments | DB `fees_icici` | plaintext | HMAC-SHA256 secureHash on request only | 30 s | **verify off** (`:1659,:1863`) | **none** (comment "Omitted for brevity") | **initiate hits UAT** (INT-16) |
| 5 | PayPhi (`secure-ptg.payphi.com`) | Fee payments | DB `fees_payphi` | plaintext | HMAC request | `CURLOPT_TIMEOUT => 0` (infinite) | default | none | Broken (FIN-01) |
| 6 | AggrePay | Fee payments | DB `fees_aggre_pay` (`salt_key`) | plaintext | salt hash computed but **ignored** (`:2229-2233`) | - | - | hash not enforced | Broken (FIN-01) |
| 7 | Axis | Fee payments | DB | plaintext | - | - | - | none | Broken (FIN-01) |
| 8 | CCAvenue (`api.ccavenue.com`) split payout | Fee split | env `CCAVENUE_ACCESS_CODE` + DB | env / DB | AES enc_request | 30 s | **verify off** (`:621-622`) | - | Risky |
| 9 | SMS gateway (any HTTP-GET vendor) | OTP, parent SMS | per-tenant DB `sms_api_details` (`url`,`pram`,`mobile_var`,`text_var`,`last_var`) | plaintext | key in URL/query | **none** | **off** in 9 places | n/a | Fragile (INT-23) |
| 10 | E-mail SMTP | Parent/staff mail | per-tenant DB `smtp_details` (`gmail`,`password`,`server_address`,`port`); global env `MAIL_*` for `Mail::` | plaintext DB | SMTP auth | PHPMailer default | PHPMailer default | n/a | INT-06 |
| 11 | WhatsApp Meta Cloud API (`graph.facebook.com/v25.0`) | Parent messages, CRM | per-tenant DB `whatapp_user_details`; **tenant 1's token hard-selected for `crm-whatsapp`** | plaintext | Bearer | Guzzle default (no timeout) | default | **none** (`incoming-message`, `update-message`) | INT-01/INT-22 |
| 12 | Twilio (WhatsApp status sync) | legacy | env `TWILIO_SID`,`TWILIO_AUTH_TOKEN`; DB `user_whatsapp_sid/token` | env/DB | basic | - | default | - | Dead (INT-33) |
| 13 | FCM legacy (`fcm.googleapis.com/fcm/send`) | Push | 3 hard-coded server keys `Helper.php:1808,1813,1818` (`AAAA***`) | source | key header | none | **off** | n/a | Retired API (BE-09) |
| 14 | FCM v1 + Google OAuth (`oauth2.googleapis.com/token`) | Push | service-account JSONs `public/firebase/*.json` (4 fixed names; dir absent in checkout; not gitignored) | files | JWT-bearer assertion | none; **new access token per call** | **off, incl. the token exchange** (`Helper.php:1950-1951`) | n/a | Fragile |
| 15 | Google Sign-In (GSI client + `api/google-auth`) | Login | `NEXT_GOOGLE_CLIENT_ID` (non-`NEXT_PUBLIC_`) | env | ID token | - | - | - | Broken (part01/02) |
| 16 | Google Maps Distance Matrix | Transport distance | env `GOOGLE_API_KEY` | env | key in query | none | **off** (`tblstudentController:1338`) | n/a | Risky |
| 17 | Google Analytics Universal API (`ga.php`, `HomeController`) | Users-online widget polled every 3 s by `export_xlsx.php` | `.p12` service account | file | JWT | none | **off** | n/a | **Dead** (UA API sunset) |
| 18 | YouTube Data API | Content search | env `YOUTUBE_API_KEY` | env | key | `retry(0)` | default | - | ok |
| 19 | DigitalOcean Spaces (`s3-triz.fra1.cdn.digitaloceanspaces.com`) | All uploads (154 `disk('digitalocean')` refs, 83 with ACL `public`) | env `DO_SPACES_*` | env | S3 key/secret | SDK default | default | n/a | Public ACL everywhere, one shared bucket (INT-11) |
| 20 | AWS S3/SQS/SES | configured only | env `AWS_*` | env | - | - | - | - | unused |
| 21 | OpenAI (`api.openai.com`) - `OpenAIService` | Content, PDF, insights | env `OPENAI_API_KEY` | env | Bearer | 10-120 s (mixed) | **off in 14 calls** (`OpenAIService.php:40,152,225,324,494,745,785,845,1088,1394,1720,1949,2186,2276`) | n/a | Risky (INT-15) |
| 22 | OpenRouter | LLM proxy | env `OPENROUTER_API_KEY`, `OPENROUTER_MODEL` | env | Bearer | `timeout` set | default (except H5PIndex/Scenario) | n/a | ok |
| 23 | Gemini | LLM | env `GEMINI_API_KEY`/`GOOGLE_API_KEY` | env | key | 60-120 s, `retry` with backoff (`GeminiClient:224`) | default | n/a | ok |
| 24 | DeepSeek | LLM | env `DEEPSEEK_API_KEY` | env | Bearer | `timeout_seconds` | default | n/a | ok |
| 25 | Anthropic Claude | LLM | env `ANTHROPIC_API_KEY` | env | key | `CLAUDE_TIMEOUT_SECONDS` | default | n/a | ok |
| 26 | Gamma (`public-api.gamma.app`) | Presentation generation | env `GAMMA_API_KEY` | env | key | 30-120 s | default | n/a | ok |
| 27 | Neo4j (bolt) | Graph projection | env `NEO4J_*` | env | basic | bolt timeout; outbox+drain | n/a | n/a | memory: auth currently broken (`gotcha_neo4j_auth_broken`) |
| 28 | O*NET (`services.onetcenter.org`) | Occupation sync | env `ONET_USERNAME/PASSWORD` (10 uses) **and hard-coded in 28 places** | source (`trizinnovation:4225***`) | Basic | none | default | n/a | Secret in source (INT-18) |
| 29 | HuggingFace Space `harshit20991999-multi-face-detection-modal.hf.space` | Class-photo face matching | hard-coded URL `classFaceAttendanceController.php:45` | none | **none** | none | **off** | n/a | Privacy (INT-14) |
| 30 | HuggingFace Space `moncey10-homework-validation-system.hf.space` | Homework validation + annotated PDF host | hard-coded `studentHomeworkSubmissionController.php:169,199` | none | **none** | none | **off** | n/a | Privacy (INT-14) |
| 31 | HuggingFace `trizk-12-agenticai.hf.space` | Agent library (commented out) | `agentLibraryController.php:26` | - | - | - | - | - | dead |
| 32 | Cloud Run `getbloomslevel-*.a.run.app` | Bloom taxonomy classifier | hard-coded `AJAXController.php:2417`, `public/excel_upload/bulk_question_data.php:66` | none | none | none | **off** | n/a | Fragile |
| 33 | `kgenkit.vercel.app/api/genkit-k12` | Conversational AI (enrollment_no, sub_institute_id in query) | hard-coded `settings\conversationalAIController.php:138`, `Livewire\ConversationalAIV2.php:101` | none | none | - | default | n/a | Privacy |
| 34 | n8n webhook | Task assignment notification | `config('services.n8n.task_webhook')` - **key not defined in `config/services.php` or `.env.example`** | - | - | `Http::timeout(5)` | default | outbound only | **No-op** (INT-33) |
| 35 | Stripe / Mailgun / Postmark / SparkPost / Ably / Pusher / Papertrail / Slack log | config only | env | env | - | - | - | - | no code uses Stripe |
| 36 | ERP/Attendance API (`erp.triz.co.in/student/studentAttendanceChatAPI`) | MCP tool | env `ERP_API_*`, `ATTENDANCE_API_*` | env | token | - | default | - | ok |
| 37 | Vercel-hosted skill-ontology iframe `skill-ontology-neo4j.vercel.app` | Capability explorer | hard-coded `taxonomy-ontology.tsx:38`; passes `sub_institute_id` in query | - | none | 6 s load grace | browser | n/a | `sandbox` without `allow-same-origin` (good) |
| 38 | jsdelivr `@mdi/font@7.4.47` + `verify.min.js`, Google GSI, Razorpay checkout.js, YouTube embeds, `cdn.simpleicons.org`, `view.officeapps.live.com` | Frontend CDNs | hard-coded in `app/layout.tsx:35,41`, `login/page.tsx:41`, `fees/online-payment/[gateway]/page.tsx:82` | - | - | - | browser | - | No SRI, no CSP (INT-34) |
| 39 | `POST /api/integration-configs` (Next) | "Integration Center" persistence | in-memory `records[]` array | process memory | any `Authorization` header | - | - | - | **mock** (part02) |

---

## 3. Role / access-control findings (frontend gating vs backend enforcement)

| Module | Frontend gating | Backend enforcement | Finding |
|---|---|---|---|
| Import (`app/import-data/page.tsx`) | none (no role/permission check in file) | `api.session` only | any role can bulk-create `tbluser`/`tblstudent` (HR-15, INT-12) |
| Send SMS/WhatsApp/e-mail (`app/easy_com`) | menu only | `api.session` only (HR-21) | INT-24 |
| `POST /unlink-file` | none (legacy Blade) | route in T1 group but `check_permissions` skips unmapped names | INT-03 |
| `crm-whatsapp`, `transferDocs`, `convertDoc`, `send_birthday_notification`, `Resend_otp`, `/import_*` | n/a | **no auth** | INT-01/02/05/20 |
| Bulk document zip `missing_document_report/download-bulk` | menu | T1, tenant from session (good); all staff of tenant incl. Aadhaar/PAN zipped for any user with the menu right | INT-35 |
| `easy_com/smtp`, `sms-api`, `whatsapp-api` credential CRUD | menu | `api.session` only; responses mask passwords/URLs (good) | HR-21 |
| Platform Services (notification/scheduler/workflow) | `perm:*` on writes | `lms.auth` + `perm` (good) | but configuration is not consumed (INT-25) |
| Exam evaluation file/scan | tenant from request body | `exam-evaluation/*` is in `api_guard.protect` -> JWT school must equal `sub_institute_id` | good |

Frontend never restricts file upload/export by role; every enforcement point above is server side.

## 4. Tenant / school / academic-year scoping findings

* Upload paths are **not tenant-namespaced** in 96 of ~100 controllers (`public/student/<id>.<ext>`, `public/frontdesk/<timestamp>`, `public/inward/<timestamp>`, `public/lms_content_file/<date>` ...). Only `ContentUploadService` (`lms_content_file/<tenant>/<chapter>/<uuid>`), `MobilePageAssetUploadService` (`mobile_page_builder/<tenant>/<page>/<uuid>`), `ExamEvaluationStorage` (generated names) and parent photos (`father_<enrollment>_<tenant>.ext`) embed a tenant. Library uploads use a shared name-keyed folder (FIN-51).
* `sub_institute_id` from the client is trusted in: T3 upload/notify controllers (`PettyCash`, `FrontDesk`, `Complaint`, `PhotoVideoGallary`, `StudentCare`), `tblstudentDocumentController::store` when `type=API|JSON` (`:44-46`), `Import*::process` for `tblstudent` via a mapped `sub_institute_id` column (INT-12), `public/excel_upload/*.php` (`$_REQUEST['sub_institute_id']`, INT-04), `crm-whatsapp` (hard-selects tenant 1's WhatsApp token for any anonymous caller).
* `csv_data` (import staging, `longText`) has **no tenant column**; `process` loads by primary key (`ImportApiController.php:146`), so another tenant's staged file can be processed (HR-15).
* `fees_reconciliation` duplicate check ignores tenant (`fees_reconciliation_upload_sheet_controller.php:80`), `sharebazar_*` tables and `MigrationModulesApiController::bazarReport` have no tenant, `LeaveImport` name lookup has no tenant (INT-28), `incoming_messages` chat read by number only (`WhatsappController::whatsappShowReply:566`).
* `syear`: import defaults to the session `syear` but `prepareData['syear']` from the CSV overrides it for students/fees; reconciliation joins `tblstudent_enrollment` **without** `syear` (INT-13).
* Exports: all server exports read tenant from session/JWT (good). Client exports operate on already-fetched rows.

---

## 5. API endpoints consumed or exposed

### 5.1 Phase 13 - Upload / write-to-disk sites (classification of all sites)

Columns: controller@method (file:line of the write) | route (file) and tier | validation | filename source | disk : path | served how | tenant in path | download authorization. `ext-client` = extension from `getClientOriginalName()/File::extension/getClientOriginalExtension()`. "none" validation means no `mimes:`/`max:` on that file input in the method (verified by 28-line look-back).

| # | Site | Route / tier | Validation | Filename | Disk : path | Served | Tenant path | Download authz |
|---|---|---|---|---|---|---|---|---|
| 1 | `CkeditorFileUploadController@store` :30 | `POST /ckeditor` (web.php:488) **T0** | none | `rand(1000,9999).clientName` | WEB `lms_editor_upload/` | direct | no | none (BE-05) |
| 2 | `oldDocumentTransfer@storeImagesToDigitalOcean` :63 | `POST /transferDocs` (web.php:654) **T0** | none | source file names | DO `public/<digi_directory>/` (request-chosen) | CDN public | no | none (**INT-02**) |
| 3 | `oldDocumentTransfer@ConvertBinaryData` :234 | `GET /convertDoc` (web.php:655) **T0** | none | JSON file names | DO `public/student_document/` | CDN | no | none (INT-02) |
| 4 | `WhatsappController@whatsappCRM` :596 | `GET /api/crm-whatsapp` (api.php:183) **T0** | none | `basename($file_url)` | WEB `whatsapp/wp_sent_files/` | direct | no | none (**INT-01**) |
| 5 | `admissionEnquiryController@paymentProof` :1067 | `POST /admission_enquiry/payment_proof` (admission.php:81) **T0** | none | `<enquiry_id>.<ext-client>` | DO `public/admission_payment/` | CDN | no | none (INT-10) |
| 6 | `admissionRegistrationHillController@sendEmail` :410 | admission.php T1 | none | `date('YmdHis').ext-client` | PUB `email/` | /storage | no | none |
| 7 | `api\adminapiController` :872,2143 (delegates), :1140 (mail attachment), :1592,:1713 (front desk), :2708,:2734,:2803 (face capture) | adminapi.php **T3** (JWT check per method) | `Validator::make` present on some; no mimes | ext-client + `date`/`rand(10000,99999)` | PUB `email/`, `frontdesk/`, `capture_photos/<student>`, `capture_attendance/<date>/<std>-<div>` | /storage | student id / std only | none |
| 8 | `api\teacherapiController` :446,:1463 (DO `lms_content_file`), :734 (`lms_teacher_resource`), :1581,:1817 (front desk) | teacherapi.php **T3** | `Validator::make` partial; no mimes | `date('Y-m-d_h-i-s').ext-client` | DO + PUB | public | no | none |
| 9 | `api\ApiLmsCourseController` :997,:1500 (base64 put), :1009,:1531 | `api/lms-chapter-content/upload` (T4 `lms.auth`+perm), `lms-store-content` (T4) | presentation branch `mimes:pdf,ppt,pptx|max:102400` (`:1583`); other branch `max:10240` only | `date('Y-m-d_h-i-s')` + ext-client | DO `public/lms_content_file/` | CDN | no | none |
| 10 | `lms\contentController` :319,:499,:511,:781 | lms.php T1 | none | `date('Y-m-d_h-i-s')` + ext-client | DO `public/lms_content_file/` | CDN | no | none |
| 11 | `Services\lms\Content\ContentUploadService::store` | `lms-*` authoring (T4) | **extension allow-list per type + 100 MB cap + sha256 + exists() verify** | `Str::uuid()` | DO `lms_content_file/<tenant>/<chapter>/` (**ACL public**) | CDN | **yes** | none (public) - model implementation |
| 12 | `lms\content_library\contentLibraryController` :211,:314 (+ `...Old` :192,:328 unrouted) | lms.php T1 | `Validator::make` (no mimes) | `time()`+ clientName | DO `public/content_library/` | CDN | no | none |
| 13 | `lms\h5p\H5PContentTypeController` :430/:440, `H5PDragDropController` :371/:381, `H5PTextActivityController` :435/:445, `H5PInteractiveVideoController` :85/:97,:231/:243, `H5PScenarioController` :77/:90,:207/:220 | lms.php T1 | image `mimes:jpg,jpeg,png,gif,webp|max:8192`, video `mimes:mp4,...|max:1024000` (1 GB), audio; scenario image **only `isValid()`** | `date('Y-m-d_H-i-s')` + ext-client (+uniqid on video) | DO `public/h5p_content/` **and** local fallback `public/h5p_content` (WEB) | CDN / direct | no | none (LMS-15) |
| 14 | `lms\lmsDoubtController` :102, `lmsPortfolioController` :163,:258, `virtualclassroomController` :210, `teacher_resource\lms_teacherResourceController` :165,:306, `TeacherResourceApiController` :292, `school_setup\sub_std_mapController` :105,:226 | lms.php / web T1 | none | `date('Y-m-d_h-i-s')` + ext-client | DO `public/lms_doubts|lms_portfolio|lms_content_file|lms_teacher_resource|SubStdMapping/` | CDN | no | none |
| 15 | `lms\assignment\assignmentSubmissionController` :83, `api\lms\LmsAssignmentApiController` :379 (QP pdf), :759 (submission) | lms.php T1; `lms-assignment/*` in `api_guard.protect` | none | `date('YmdHis')`+ext-client / `time().uniqid()` | PUB `lms_assignment_submission/`, `QuestionPaper/` | /storage | no | none |
| 16 | `api\lms\StudentHomeworkApiController` :187,:838,:1187 (base64), `HomeworkSubmissionApiController` :321 | `lms-homework/*` T3 (`api_guard.protect` -> JWT) | submission: `files.*` `mimes:pdf,jpg,jpeg,png|max:10240` (`HomeworkSubmissionApi:280`); `StudentHomework` store: none | `date`+ext-client / `time()`; base64 path `uniqid` | PUB `student/`, `<directory>/` | /storage | no | `submission-file/{id}` returns URL for **any** homework id (INT-35) |
| 17 | `student\studentHomeworkController` :209, `studentHomeworkSubmissionController` :151 (+ HF call) | student.php T1 | none | date | PUB `student/` | /storage | no | none |
| 18 | `student\tblstudentController` :262,:267,:341,:1430,:1506 (photo) / :296,:320,:1460,:1484 (parents) | student.php T1 | photo: 500 KB check on `student_image` only (`:250`); others none | `<id>.<ext>` / `<user_name><YmdHis>.<ext>` | PUB `student/`; DO `public/parents_image/` | /storage, CDN | parents only (`father_<enr>_<tenant>`) | none; enumerable ids (STU-38) |
| 19 | `student\tblstudentDocumentController@store` :58 | student.php T1 + `type=API` tenant from request | none | `<student_id><YmdHis>.<ext>` | DO `public/student_document/` | CDN | no | none (INT-10) |
| 20 | `student\bulkStudentController@bulkUpdate` :557-622 | student.php T1 | none | `<id>.<ext>` or `<field>_<id>_<date>_<clientName>` | PUB `student/`; DO `parents_image/` | /storage | no | none |
| 21 | `student\studentBulkUpdateController` :151 | student.php T1 | `ext in [xlsx,xls]` (client name, case-sensitive) | `student_active_inactive_list_<time>.<ext>` | PUB `student_active_inactive_list/` | /storage, **never deleted** | no | none |
| 22 | `student\studentHealthController` :99,:180; `api\StudentCareApiController` :118 (base64 `file_data`, ext from client `file_name`) | T1 / adminapi T3 | none | date / `health_document_<date>_<uniqid>.<ext-client or bin>` | PUB `frontdesk/` | /storage | no | none |
| 23 | `user\tbluserController` :134,:447 (photo), :550 (staff doc) | user.php T1 | none | `<user_name><YmdHis>.<ext>` | PUB `user/`; DO `public/staff_document/` | /storage, CDN | no | none |
| 24 | `api\OrganizationManagement\EmployeeDirectory\EmployeeDirectoryController` :931 (doc), :1228 (photo) | T2 `staff.only` | validator present (HR-31); ext-client | `<userid><YmdHis>.<ext>` / `<user_name><YmdHis>.<ext>` | PUB `staff_document/`, `employee_directory/` | /storage | no | none (HR-31) |
| 25 | `Payroll\PayrollController` :1503 (payslip PDF) | hrms.php T1 | n/a (generated) | **`emp_<id>_payslip_<month>_<year>.pdf`** | DO `public/staff_document/` ACL public | CDN | no | none (**INT-07**) |
| 26 | `TalentManagement\Recruitment\JobApplicationController` :109,:289 (resume) | T2 `staff.only` | `mimes:pdf,doc,docx|max:5120` | `resume_<tenant>_<first>_<middle>_<last>.<ext>` | DO `public/hp_resume/` | CDN | partial | none (HR-19) |
| 27 | `Recruitment\OfferController` :196 (offer letter PDF) + local copy `storage/app/public/<file>.pdf` | T2 | n/a | `offer_letter_<id>_<name>.pdf` | DO `public/offerLetter/` + PUB | CDN, /storage | no | none (INT-07) |
| 28 | `Competency\CertificationController` :976; `Onboarding\OnboardingDocumentController` :318; `Performance\PerformanceActivityController` :478; `Compliance\ComplianceEvidenceController` :78; `ComplianceLibraryController` :643 | T2 `staff.only` | certification `mimes:pdf,jpg,jpeg,png,doc,docx|max:10240` (`:948`); onboarding/performance validated partially (`uniqid('onb_'/'perf_')` names, good); compliance `max:20480` | uniqid / `time()`+name | DO `competency_certifications/` / PUB `...` | CDN / /storage | partial | none |
| 29 | `TaskManagement\TaskAttachmentVersionController@store` :65 / `@download` :101 | T2 `staff.only` + `task.permission` | `max:20480` | storeAs (custom) | private disk (`self::DISK`) | **authorised download** | yes | tenant/row check (good) |
| 30 | `api\PettyCashApiController@storeBill` :121 | `petty-cash` (api.php:833) **T3, no auth in controller** | none | `<userId>-<time()>.<ext-client>` | WEB `pettycash/` | direct | no | none (BE-05/FIN-77) |
| 31 | `frontdesk\PettyCashController` :82, `implementation\frontdesk\PettyCashController` :76 | T1 | none | `time()`+ext | WEB `pettycash/` | direct | no | none |
| 32 | `api\FrontDeskApiController@storePhoto` :125, `ComplaintApiController@storeAttachment` :98, `PhotoVideoGallaryApiController` :157,:236 | `front-desk`, `complaints`, `front-desk/photo-video-gallery` (api.php:788-820) **T3 - no auth** | none | `date('YmdHis')`/`time().uniqid()` + ext-client | PUB `frontdesk/`, `photo_video_gallary/` | /storage | no | none (INT-10) |
| 33 | `frontdesk\{complaint,frontdesk,task}Controller` (6 sites) and `implementation\frontdesk\*` (6 sites) | T1 | none | `date('YmdHis')` + ext-client | PUB `frontdesk/` (shared by 5 modules) | /storage | no | none |
| 34 | `front_desk\circular\circularController` :286, `exam_schedule` :89, `leave_application` :327, `photo_video_gallary` :269, `syllabus` :134 (DO) / :155 (dompdf PDF DO), `book_list` :156, `classworkAttachmentController` :232 | student.php / frontdesk.php T1 | leave application `Validator::make` only; others none | `date('YmdHis')` + ext-client | PUB or DO `public/<module>/` | /storage / CDN | no | none |
| 35 | `front_desk\studentFaceAttendanceController` :150,:176, `classFaceAttendanceController` :95 | frontdesk.php T1 | none | ext-client + `rand(10000,99999)` | PUB `capture_photos/<student>/`, `capture_attendance/<date>/<std>-<div>/` | /storage | student id | none (**faces**, INT-14) |
| 36 | `visitor_management\visitor_masterController` :208,:303 | T1 + teacherapi T3 | none | `visitor_<Y-m-d_h-i-s>.<ext-client>` | PUB `visitor_photo/` | /storage | no | none |
| 37 | `inward_outward\inwardController` :129,:238, `outwardController` :128,:231 | T1 | none | `date('YmdHis')`+ext | PUB `inward/`, `outward/` | /storage (guessable) | no | none (FIN-77) |
| 38 | `inventory\inventory_item_masterController` :90,:182, `inventory_master_setupController` :68,:144, `api\InventoryApiController@saveMaster` :1042,:1053 | T1 / T3 (`InventoryApiController:73` verifies JWT) | `max:255`/`max:50` only | ext-client | PUB `inventory_item/`, `inventory_master/` | /storage | no | none (FIN-51) |
| 39 | `library\BookController` :268,:275 | web.php T1 | none | **client file name** | disk `books` = WEB `uploads/books/` | direct | no (cross-tenant overwrite) | none (FIN-51) |
| 40 | `fees\feesReceiptBookMasterController` :216,:225, `tblfeesConfigController` :84,:205 | fees.php T1 | none | `date('YmdHis')`+ext | PUB `fees/` | /storage | no | none (FIN-38) |
| 41 | `fees\NACH\s2excel_import` :55, `s4excel_import` :104 | fees.php T1 | none | `NACH_S4_Import_<date>.<ext-client>` | PUB `NachExcel/Uploads/` | /storage, retained | no | none (FIN-38) |
| 42 | `fees\fees_reconciliation\...@store_fees_reconciliation_data` :58 | fees.php T1 | ext in [xlsx,xls,csv] | `fees_reconciliation_<time>.<ext>` | PUB `fees_reconciliation/` | /storage, retained | no | none (INT-13) |
| 43 | `bazar\bulkUploadSheetController` :65,:176,:277 | lms.php `bazar` T1 | ext in [xlsx,xls] | `bazar_<kind>_<time>.<ext>` | PUB `bazar/` | /storage, retained | no | none |
| 44 | `api\ImportApiController@parse` :43, `Import\ImportController` :47,:128 | `api/import/parse` T2; `/import_parse`,`/custom_import_parse` **T0** | `mimes:csv,xlsx` (API) / `mimes:csv` (custom) / **none** (`parseImport`) | `<tenant>_<syear>_<rand5>.<ext-client>` | WEB `import/` | direct, **never deleted** (13 files present in working copy) | prefix only | none (INT-05/INT-12) |
| 45 | `result\result_master` :102-271 (6), `result_book_master` :129-237 (4), `upload_result_controller` :156, `school_setup\schoolController` :53,:115, `settings\manageInstituteController` :80,:234 (WEB `admin_dep/images` + PUB `user/`), `announcementController` :104,:195 (DO), `organizationDetailsController` :159,:208 (DO), `instituteDetailController` :188,:319 (DO `compliance_library`) | result.php / settings.php / web.php T1 | none / validator | `date('YmdHis')`+ext | PUB or DO or WEB | mixed | no | none |
| 46 | `hostel_management\hostel_masterController` :114,:136, `transportation\add_driver_controller` :74,:158 | T1 | none | date+ext | PUB `hostel_master/`, `driver/` | /storage | no | none |
| 47 | `custom_module\CustomModuleController` :798,:809,:814 | custom_module.php T1 | `->validate(` (other fields) | `time().ext-client` | WEB `images/` | direct | no | none (FIN-77) |
| 48 | `sqaa\sqaa_controller@generatePdf` :233, `sqaa_controller@unlink_file`, `sqaa\sqaaReportController` :153, `sqaa_controller` :157, `api\sqaa\SqaaApiController` :154 | web.php T1 / resultapi T2 | API `mimes:pdf,xlsx,doc,docx`; web none | `<tenant>_pdf_menu<req>_doc<req>.pdf` (request pieces) | WEB `sqaa/`; DO `public/sqaa/` | direct / CDN | tenant prefix | none (INT-03/INT-35) |
| 49 | `BlogController` :60,:115 | web.php (T1 or T0 - `blogs` routes) | `max:2048` | `date('YmdHis')`+clientName | DO `public/blogs/` | CDN | no | none |
| 50 | `G2gLms\CourseBuilderController` :386, `LearningCatalogController` :607 | g2g T2 `staff.only` | image validation | `date`+ext | PUB `lms_course/`, `hp_course/` | /storage | no | none |
| 51 | `easy_com\send_email_parents` :115, `send_email_other` :93, `api\easy_com\SendEmailParentsApiController` :238 | result.php/student.php T1; easycomapi T2 | API: `mimes:pdf,doc,docx,xls,xlsx,csv,txt,png,jpg,jpeg,zip...|max:10240`; web none | `date('YmdHis')`/stored name | PUB `email/` | /storage, retained | no | none |
| 52 | `api\AiSopGenerationController` :397 (SOP PDF), Jobs `Evaluate*` (:151/:226/:206/:321 annotated PDFs), `ContentGenerationService` :284, `LmsSocialCollaborativeService` :149 | T2 / jobs | n/a (generated) | generated | DO `public/...` | CDN | partial | none |
| 53 | `api\NewLMS_ApiController` :348/:350, `settings\manageInstituteController` :82,:236 (logo -> PUB `user/` + WEB) | web/api | none | `time()` | PUB/WEB | direct | no | none |
| 54 | `AI\AiAssistanceTicketController@storeScreenshot` :190 | ai.php (`McpAuth`) | `Str::random(8)` name, `local` disk | random | **PRIV** | admin-only, tenant-checked (`:151`) | yes | **authorised** - model |
| 55 | `Services\Evaluation\ExamEvaluationStorage::putSheet` :54 | `exam-evaluation/*` (api_guard + tenant) | `finfo` allow-list pdf/jpg/png + 20 MB (note: `detectMime` also accepts `getClientMimeType`) | `batch-<id>-<random24>.<ext>` | **PRIV** `storage/app/exam_evaluation/` | `GET .../file` tenant-checked | yes | **authorised** - model |
| 56 | AJAX/report renderers `AJAXController` :1618,:1720,:1887,:1989,:3235, `monthwiseReceiptPdfController` :152, `cbse_1t5_*` x8, `TemplateResult` x2, `allResultController` :78, `adminapiController` :2620, `questionpaperController` :395,:433,:1825 (HTML + PDF of receipts/result cards/question papers) | T1 / T2 | n/a | `<student_id>_<YmdHis>.html/.pdf` etc. | WEB `storage/mail_receipt_pdf/`, `storage/test_PDF/`, `zip_pdf/<tenant>/`, `pdf_folder` | direct, **never deleted** | partial | none (INT-08) |
| 57 | NACH S1/S3 export `s1excel_exportController` :255, `s3excel_exportController` :272 | fees.php T1 | n/a | `NACH_S1_EXPORT_<Y_m_d_H_i_s>.xlsx` | WEB `storage/NachExcel/` (dir `mkdir 0777`, `chmod 0777`) | direct, **never deleted** | no | none (INT-08) |
| 58 | `Helper::accesslog_json` :2881 | every logged request | n/a | `<Y-M>.json` | PUB `access_log/<tenant>/` | /storage | tenant folder | none (INT-09) |
| 59 | `learning_outcome\lo_marks_greport2Controller` :154 | result.php T1 | n/a | fixed `data.json` | PUB `data.json` (shared file, race) | /storage | no | none |
| 60 | `Services\EmailTemplateService` :295, `OpenAIService` :434,:483,:1050,:1067,:1193,:1326, `palController` :536 | T1/T2 | n/a | generated | local temp/public | - | no | - |

Counts: 202 write sites; 60 rows above cover every controller/service file (repeated identical sinks listed by file:line inside one row). **Only 27 `mimes:`/`mimetypes:` rules exist in 18 files under `app/Http`** against **306 uses of client name/extension in 103 files**; 83 `'public'`-ACL puts to DO; 0 `temporaryUrl()` uses (no signed URLs anywhere); 0 uses of `Storage::disk('private')`.

Frontend upload components (69 `type="file"` inputs): 54 have `accept=`, **15 have none** (`admin-services/complaint-management/page.tsx:211`, `course-master/[courseId]/chapters/page.tsx:4999`, `easy_com/_components/EntryPage.tsx:443`, `Inventory/_components/InventoryPage.tsx:93`, `library/book_resources/page.tsx:994,1064`, `lms/book-list/page.tsx:388`, `lms/homework/submission/page.tsx:297`, `lms/lmsAssignment_submission/page.tsx:262`, `lms/social-collaborative/page.tsx:340`, `organization_managment/Department/Component/sops.tsx:415`, `result/upload-result/page.tsx:68`, `student/_components/StudentCareModule.tsx:160`, `talent-management/onboarding/components/onboarding-sheets.tsx:1015`, `talent-management/performance-reviews-and-appraisals/components/performance-center.tsx:2078`). Client-side size checks exist in only 6 places (`lms/homework/page.tsx:111` 10 MB, `SubmitHomeworkDialog.tsx:24` 10 MB x5 files, `course-master chapters:434-465` 50-500 MB, `h5p_interactive_video` 500 MB x2, `components/ui/file-upload.tsx` default 10 MB); everything else relies on the server, which validates almost nothing. Multipart uploads through the Next server go through `app/api/proxy-file/route.ts` (`request.formData()` buffers the whole body) and `app/api/import/{parse,process}` (the import page itself calls Laravel directly).

### 5.2 Phase 14 - Import / export endpoints (full list)

| Import | Endpoint / tier | Validation | Duplicate handling | Error reporting | Memory / batch | Transaction | Tenant | Uploaded-file cleanup |
|---|---|---|---|---|---|---|---|---|
| `ImportApiController@parse` | `POST api/import/parse` T2 | `csv_file` `file|mimes:csv,xlsx`, `tablename` required (no allow-list of tables) | none at parse | `status/message` | **whole spreadsheet loaded** (`IOFactory::load`, `->toArray()`), then `json_encode` of all rows into `csv_data.csv_data` longText (`:47-92`) | no | prefix in file name only; `csv_data` untenanted | **never deleted** (`public/import/`) |
| `ImportApiController@matchFields`/`@process` | `POST api/import/match-fields`, `/process` T2 | `fields[]` free strings (columns of any table); `custom_text[]` | `is_skip` 1/2 stored on `csv_data` via `matchFields`; conditions built with `===` against a value that may arrive as string (INT-12) | counts + row numbers for skip/overwrite/failed; per-row exceptions **uncaught** (500 aborts the loop mid-way) | row-by-row queries (3-6 SELECTs per row) | **none** | mapped `sub_institute_id` honoured for `tblstudent` | n/a |
| `Import\ImportController` (web) | `/import_parse`, `/custom_import_parse`, `/import_parse_fields`, `/import_process` **T0** | `custom` `mimes:csv`; `parseImport`/`processImport` none | same | Blade summary | same | none | session (null when anonymous) | never |
| `public/excel_upload/bulk_{chapter,topic,lo,content,question}_data.php`, `fees.php`, `Import_xlsx_data.php` | direct URL **T0** | ext in [xlsx,xls] (client) | `SELECT` before insert on title | HTML echo of failing rows | PHPExcel loads full file (unmaintained lib) | none | `$_REQUEST`/`$_SESSION['SUB_INSTITUTE_ID']` set from query string | not stored (tmp) |
| `student\studentBulkUpdateController` (active/inactive xlsx) | `student/bulk_update...` T1 | ext client [xlsx,xls] | already active/inactive/not-found arrays returned | yes (3 lists) | full sheet + N queries | none | session | retained |
| `fees_reconciliation_upload_sheet_controller` | `fees/...store_fees_reconciliation_data` T1 | ext [xlsx,xls,csv] | `reference_no`+`payer_opted_mode` **without tenant** | none | full sheet | none | insert uses session tenant | retained |
| `bazar\bulkUploadSheetController` x3, `MigrationModulesApiController::bazarUpload` | `bazar/store_*_data` T1 / `migration-modules/bazarUpload` | ext [xlsx,xls] / `mimes:xls,xlsx` | none | `success` flag only; `catch` swallows | full sheet | none | **no tenant column** | retained |
| `leave\ApplyLeaveController@importOldLeave` + `LeaveImport` | `POST /import-leave` T1 | `upload_file` required only | `updateOrCreate` on (user, from, to) | JSON exception message | Maatwebsite (non-chunked `ToModel`) | per row | **none** (name match across tenants) | Maatwebsite temp |
| NACH S2/S4 | fees.php T1 | see FIN-38 | UTR-less | HTML summary rendered with `dangerouslySetInnerHTML` (`NACH_s4excel_import/page.tsx:167`) | full sheet | none | session | retained |
| `BulkTaskController@import` | T2 `staff.only` | `BulkTaskImportRequest` + `SafeCsvFile` (ext `.csv` + MIME allow-list) | resolves user by name/dept/role in tenant | **per-row `skipped_tasks` with reasons** | `fgetcsv($h,1000)` streaming (lines >1000 chars truncated) | per-task | context tenant | tmp |
| `G2gLms\GovernanceController` user CSV | T2 `staff.only` | `mimes:csv,txt|max:5120`, whitelist `IMPORTABLE_USER_COLUMNS`, role exists in tenant, duplicate e-mail and in-file duplicate detection, per-row `errors[]` | yes | yes | streaming | see code (batch insert) | tenant | tmp |
| `G2gLms\AssignmentsController` assignment CSV | T2 `staff.only` | `mimes:csv,txt|max:5120` | - | - | `file()` loads all lines | - | tenant | tmp |
| H5P package import (8 controllers) | lms.php T1 | `H5PPackageArchive::guardArchive` (size, entry count, uncompressed size, per-entry path check) | - | yes | bounded | - | tenant | tmp |

| Export | Endpoint / component | Format | Tenant filter | PII | Formula neutralisation |
|---|---|---|---|---|---|
| Generic table export | `lib/table-export.ts:20-26,44-56` used by 64 pages | CSV (`text/csv`), "Excel" = HTML table as `.xls`, print/PDF | server rows already tenant-filtered | student/fee/staff data | **none** (FIN-26) |
| Own Blob CSV exporters | 20 files (`hrit/leave-management/*`, `hrit/_components/payroll-shell.tsx:138`, `employee-directory.tsx:124`, `certifications-center.tsx:1008`, `onboarding-center.tsx:413`, `capability-library/*`, `competency-*`, `learning-catalog.tsx:154`, `easy_com/_components/ReportPage.tsx:143`, `Inventory/_components/InventoryPage.tsx:82`, `sessions-calendar.tsx:157`, `certifications-records.tsx:90`, `exam-creation/page.tsx:622` HTML, `library-module-utils.ts:35`, ...) | CSV/HTML | server | payroll CSV, staff directory | **none** (`grep` for `=+-@` guards = 0 hits) |
| PDF (client) | `jspdf` + `html2canvas-pro` in `ChatbotPanel.tsx`, `library-module-utils.ts`, `lms/exam/_assessment-blueprint/pdf.tsx`, `_question-paper-templates/pdf.tsx`, `document-template/blocks/A4PageBlock.tsx`, `editor/Topbar.tsx`, `lib/question-paper/images.ts` | PDF | n/a | n/a | n/a (no cells) |
| Laravel `Excel::download` | `Import\ExcelDownloadController@create`, `questionExcelDownloadController@index` | xlsx (Maatwebsite) | `sub_institute_id` from session | roll/enrollment | n/a |
| Laravel CSV | `HRMS\departmentController@export:972` (`fputcsv`, **no neutralisation**), `TaskManagement\AuditLogController:56` (**`csvSafe()` neutralises `=+-@`** - the only one) | CSV | session/context | staff | 1 of 2 |
| Laravel `.xls` via `header()` | `result\cbse_result\result_report_controller:978` | HTML as xls | session | student marks | none |
| dompdf | 16 call sites (`OpenAIService` 4, `PayrollController` 4, `LibraryReportController` 2, `EmailTemplateService`, `RendersGeneratedContent`, `sqaa_controller`, `questionpaperController`, `syllabusController`, `AiSopGenerationController`, `MyLearningController`); `isRemoteEnabled=true` in 5 (`questionpaperController:425`, `RendersGeneratedContent:54`, `EmailTemplateService:289`, `OpenAIService:377`...) | PDF | session | payslips, results | n/a |
| wkhtmltopdf | `Helper.php:1985-2057` (6 helpers, `exec`, unquoted args, `--enable-local-file-access`) | PDF saved under web root | session | receipts/result cards | n/a (see part10, INT-08) |
| NACH S1/S3 | `fees\NACH\s1excel_export`, `s3excel_export` | xlsx via PHPExcel | fees session | **bank a/c no., IFSC, UMRN** | cells written `setCellValueExplicit(...,'s')` (string) - safe |
| Bulk documents zip | `FileController@downloadBulkDocuments` | zip (streamed then `deleteFileAfterSend`) | session tenant | Aadhaar/PAN docs | n/a |
| `download-folder` | `GET /download-folder` (T0) | zip of all `he_staff_document/` | none | staff docs | BE-03 |

### 5.3 Phase 15 - Notification endpoints (who can trigger)

| Endpoint | Tier | Sync/async | Cost/authorisation controls | Notes |
|---|---|---|---|---|
| `POST api/easy_com/send-sms-parents`, `send-sms-staff`, `send-whatsapp-parents`, `send-email-parents`, `send-notification-parents` | T2 `api.session` only (HR-21) | **sync loop in request** (`SendSmsParentsApiController:150`) | `smsText max:1000`, recipients must belong to the searched class; **no per-user/tenant quota**, no template registry, only `throttle:1000,1` | provider errors ignored -> logged "sent" (INT-23) |
| `POST api/easy_com/sms-api`, `smtp`, `whatsapp-api` (+`smtp/test`) | T2 | - | any role may replace gateway config | SSRF/credential capture (HR-21) |
| web `easy_com/send_*` | T1 (menu rights) | sync | menu | 3 duplicate `sendSMS()` |
| `POST /ajax_sendmail` | **web only (no `session`/`check_permissions`)** | sync | any logged-in web user | attaches arbitrary server path (INT-06) |
| `GET /api/crm-whatsapp`, `GET /api/crm-whatsapp-update` | **T0** (`withoutMiddleware(Authenticate)`, in `api_guard.public`) | sync | none | INT-01 |
| `POST /api/incoming-message`, `/api/update-message`, `/api/whats-send-app`, `/api/whats-comming-app` | **T0** (`api_guard.public`, `TODO(V1.1): verify a shared secret`) | - | none | INT-22 |
| `GET /Resend_otp` | **T0** | sync | none, sends from tenant 1's gateway | INT-20 |
| `GET /send_birthday_notification` | **T0** | sync, all tenants | none | INT-20 |
| `POST /api/check_otp`, `login`, `teacherlogin` (OTP SMS) | T0 (now `throttle:20,1` / `10,1` in the uncommitted diff) | sync | rate limit only | INT-19 |
| `visitor_management/sendOtpVisitor` | T1 | sync | menu | returns OTP in response (INT-19) |
| FCM from 22 controllers (fees status, circular, marks entry, attendance, homework, infirmary, leave, virtual classroom, photo gallery, van report, classwork, questionpaper, NACH S4...) | T1/T2 | sync | menu | one OAuth token exchange **per call**, one HTTP request per device |
| `api/platform/notifications` GET/PUT, `/channels` | T4 `lms.auth` + `perm:platform.notification,update` | - | perm | configuration only (INT-25) |
| MCP `ReportSender` (`ai.reports.send`) | `McpAuth` | `Mail::to()->queue()` | preview + recipient-count confirm, per-recipient own figures | the only queued mail |

### 5.4 Phase 16 - Job / command / scheduler inventory

See 2.4. Additional facts: `Kernel::bootstrap()` (`Kernel.php:120-147`) logs the **full argv** of every artisan invocation to the `daily` log (could contain `--password=`/tokens) and refuses any command line matching `\b(db:seed|schema|fresh|refresh)\b`; it does not block `migrate`, `db:wipe`, `tinker`, `ai:seed-demo --purge`, `neo4j:reset-graph --skip-backup-check`. No `schedule:run`/queue-worker/supervisor artefact exists in the repo (only a Windows Task Scheduler snippet in `docs/neo4j-live-sync.md:128`). Commands with a `--dry-run`: 13; with a production guard: 1 (`pal:seed-student-demo`).

### 5.5 Phase 17 - see 2.5 (39-row integration table) and INT-15 for the TLS-off list.

---

## 6. Business-logic notes

**Generic import (API)**: Input `csv_file`+`tablename` -> Validation `mimes:csv,xlsx` -> file moved to `public/import/<tenant>_<syear>_<rand>.<ext>` -> parsed fully in memory -> `csv_data` row (`csv_header`, JSON `csv_data`; no tenant) -> `match-fields` (`is_skip` 1 skip/2 overwrite stored on the row) -> `process` loops rows building `$prepareData[column]=value` from client-chosen columns -> per-table branch (`tbluser`, `result_personalize_marks`, `fees_collect`, `tblstudent`, `result_marks`; **any other `table_name` silently does nothing** but still returns success with `total_rows`) -> INSERT/UPDATE row by row, no transaction -> counts returned. Side effects: rows created in whichever tenant the mapped `sub_institute_id` column names (for `tblstudent`); files remain public.

**Fee reconciliation upload**: file -> for each row `SELECT` by `(reference_no, payer_opted_mode)` (global) -> insert `fees_reconciliation` with literal `'Null'` strings in `student_id/term_id/receipt_no/standard_id/paymode/bank_detail/amount/updated_at` -> match to `fees_collect`/`fees_paid_other` on `cheque_no` (tenant+syear) joining `tblstudent_enrollment` on `student_id` only (all years) -> `amount = amount + amount` (`:205`).

**NACH**: S1/S3 generate bank mandate sheets into the web root; S4 reads bank return files and posts fees (FIN-38).

**Notification send (SMS)**: Input class + `smsText` -> validation -> `sendSMS()` builds `url . pram . mobile_var . <mobile> . text_var . urlencode(text) . last_var` from the tenant row -> `curl` GET (verify off, no timeout) -> **response body and HTTP status never inspected**; only a transport-level cURL error marks failure -> `saveParentLog` writes `sent` -> summary. **Push**: `sendNotification()` inserts an `app_notification` row, then `send_FCM_Notification($tokens,...)` (one OAuth exchange, N sequential HTTP posts, results discarded).

**Scheduler**: only Neo4j outbox/reconcile/sweeps run; fee reminders, defaulter statements, WhatsApp delivery-status sync, birthdays and payment-status polling rely on humans or external cron hitting URLs.

**Payments**: initiate -> gateway -> browser return `*_response_handler` (public; FIN-01/BE-08) -> `pay_fees`; the only asynchronous recovery is `*_fetch_payment_status` called by the SPA or an operator (`reconciliation_status_api_controller`); no webhook, no scheduler.

---

## 7. Test / documentation coverage

* Tests touching this scope: `tests/Feature/Security/ApiGuardTest.php` (uncommitted; guard only). No test for any upload sink, import, export, notification sender, job, command, or webhook (`grep -l` over `tests/` for `Storage::fake|UploadedFile|Mail::fake|Queue::fake|Notification::fake|Bus::fake` = 0 files in this scope). Frontend: 42 test files, none for `table-export`, `import-data`, upload components.
* Documentation: `docs/neo4j-live-sync.md` documents the only cron; `.env.example` (uncommitted diff adds `API_GUARD_ENFORCE`, `STRIPE_*`, `TWILIO_AUTH_TOKEN`); nothing documents `QUEUE_CONNECTION=database` + worker, DLT templates, SMS gateway parameter layout, `storage:link`, the `public/firebase` service-account convention or the cron for `send_birthday_notification`.

## 8. NOT VERIFIED items

1. Whether the production web server executes PHP under `/storage/*`, `/import/`, `/pettycash/`, `/lms_editor_upload/`, `/images/` (RCE severity of every WEB/PUB upload) - REASON: no server config in repo.
2. Real values of `QUEUE_CONNECTION`, `FILESYSTEM_DISK`, `MAIL_*`, gateway credentials, `DO_SPACES_*` bucket policy/listing permission, CORS - REASON: `.env` not readable.
3. Whether `check_permissions` skips `unlink-file`, `transferDocs` etc. in production - depends on whether `tblmenumaster.link` contains those route names - REASON: no DB access (T1 result is a no-op if unmapped, which is what the code shows for unmapped names).
4. Whether `import_table_fields` exposes `sub_institute_id`/`is_admin` (irrelevant to exploitability because `process` does not consult it).
5. Whether `public/firebase/*.json` exists on the server (absent in checkout, not gitignored).
6. Whether the `storage:link` symlink and DO ACLs are as the code implies (bucket may be private with CDN rules).
7. Whether `failed_jobs`/`jobs` tables exist live (memory `gotcha_student_schema_drift`: migrations disagree with reality).
8. Runtime of `Excel::download`, PHPExcel behaviour on hostile xlsx (XXE) - REASON: no execution.
9. The Vercel deployment's body-size limit (INT-31) - REASON: hosting not confirmed from repo.
10. Whether `tblstudent.otp` is an int/string column and PDO native types (affects the `is_skip === 1` comparison in INT-12) - REASON: no DB.
11. Whether the two HuggingFace Spaces and the Cloud Run classifier are private/owned by the company - REASON: no network.
12. Contents of `tblmenumaster` rows for `import-data`, `easy_com/*`, `whatsapp-*` menus (who is granted them).

## 9. Second-pass results

| Check | Count | Material hits |
|---|---|---|
| `TODO|FIXME|HACK|XXX` in scope files (Console, Jobs, Listeners, easy_com, Import, NACH, Helper, Whatsapp, FileController, ImportApi, EmailTemplateService) | 0 | but `config/api_guard.php` carries `TODO(V1.1): verify a shared secret` for the 6 public webhook paths |
| `dd(`/`var_dump`/`print_r`/`exit;`/`die(` in the same controllers (non-comment) | 4 | `s2excel_importController:63`, `s4excel_importController:619` `die()` mid-request |
| `console.log`/`debugger` in import/export/upload frontend files | 0 | - |
| `dangerouslySetInnerHTML` (whole frontend) | 65 | `NACH_s4excel_import/page.tsx:167` renders HTML built from spreadsheet cells (FIN-38) |
| `getClientOriginalExtension|File::extension|getClientOriginalName` | 306 in 103 files | INT-11 |
| `mimes:`/`mimetypes:` | 27 in 18 files | INT-11 |
| `Storage::disk('digitalocean')` | 154 refs; 83 puts with ACL `'public'`; `temporaryUrl` 0 | INT-11 |
| `CURLOPT_SSL_VERIFY*=0/false`, Guzzle `'verify'=>false` | 42 call sites in 27 files (+2 mirrored copies under untracked `public/public/`) | INT-15 |
| Hard-coded secrets in tracked Laravel source | FCM x3 (`Helper.php:1808,1813,1818`, BE-09), O*NET Basic auth x28 (`trizinnovation:4225***`), 9 DB credentials in `public/*.php` (BE-06) | INT-18 |
| Hard-coded secrets in `D:\lms_k12` tracked source (`AIza`, `sk-`, `AKIA`, `ghp_`, `xox`, `rzp_`, private keys) | 0 | - |
| Hard-coded tenant ids in senders | `apiController:830-838` (244-265 DLT template `1507166607307092495`, 47), `Helper.php:1800-1848` (254/48/76), `check_otp` 328-341/61 list, `online_fees_collect_controller:321,:920,:1246` (76, 2440), `WhatsappController:580,624` (tenant 1) | INT-19/INT-16/INT-01 |
| Hard-coded personal phone numbers / e-mails | 3 distinct mobile numbers in `apiController:82,165,998`, `NewLMS`, `find_broken_link_Controller:80` (4 e-mail addresses incl. personal gmail) | INT-19 |
| `localStorage` in upload/import frontend | not material | - |
| `fetch(`/axios in scope | `import-data/page.tsx` 4 direct calls to `API_BASE_URL`; Next proxies `import/*`, `proxy-file` | INT-31 |
| Empty/stub handlers | `WhatsappController::updateDeliveryStatus` `return true;` (`:359`), `updateMessageStatus` empty, routes `whats-send-app`/`whats-comming-app` only log, `MarkUploadController` routes point at a **non-existent class** (`web.php:535-537`), `api/integration-configs` in-memory mock | INT-22, INT-33 |
| Duplicated code | `sendSMS()` x11, `frontdesk` vs `implementation\frontdesk` x4 controllers, `result_controller_OLD/OLD2`, `contentLibraryControllerOld` | INT-23 |

---

## 10. ISSUES

## INT-01
**Severity:** Critical   **Type:** Confirmed
**Category:** Security
**Module:** WhatsApp CRM endpoint / file upload
**Location:** `D:\next_lms_erp\routes\api.php:183-184` (`crm-whatsapp`, `crm-whatsapp-update`, both `->withoutMiddleware([Authenticate::class])`); `D:\next_lms_erp\config\api_guard.php` (`public` list: `'crm-whatsapp'`, `'crm-whatsapp-update'`); `D:\next_lms_erp\app\Http\Controllers\WhatsappController.php:577-620,622-645`
**Function/Method:** `WhatsappController::whatsappCRM`, `updateCRMWhatsappStatus`
**Problem:** `GET /api/crm-whatsapp?number=a,b&message=...&file_url=...` needs no authentication and always uses `WhatappUserDetail::where('sub_institute_id', 1)` (tenant 1's WhatsApp Business token). Besides sending, it fetches `file_url` with `file_get_contents()` and writes the result to `public/whatsapp/wp_sent_files/<basename($file_url)>`.
**Evidence:** `$fileContents = file_get_contents($file_url); $fileName = basename($file_url); $filePath = public_path('whatsapp/wp_sent_files/' . $fileName); ... file_put_contents($filePath, $fileContents);` and `foreach ($numArr as $value) { $this->sendWhatsappCloudApi('91' . trim($value), $message, $token->cloud_api_access_token, ...`. `updateCRMWhatsappStatus` interpolates the caller's `messageIds` into `https://graph.facebook.com/v25.0/{$messageId}?fields=status` with tenant 1's Bearer token.
**Impact:** (1) **Unauthenticated arbitrary file write into the web root**: `file_url=https://attacker/x.php` stores `public/whatsapp/wp_sent_files/x.php` (RCE if PHP executes there - NOT VERIFIED) and `file_url=file:///...` copies any local file readable by PHP into a public folder (arbitrary local file read), plus SSRF to internal hosts. (2) Anyone can send WhatsApp messages (phishing, spam) from the school's verified business number at the school's cost and risk the number being banned. (3) Graph API path injection with the token.
**Expected Behavior:** External CRM callers authenticate with a signed request/shared secret; the URL is validated (https allow-list), never written to the web root; recipients and message templates are limited.
**Recommended Fix:** Remove `crm-whatsapp*` from the `public` list and `withoutMiddleware`; require an HMAC/shared secret; drop the local copy (pass the URL to Meta); validate `messageId` as digits/`wamid.`; rate limit; run per-tenant token selection from the authenticated caller.
**Verification:** `curl` without auth returns 401; a `file_url` to a `.php` file is rejected; no file appears under `public/whatsapp`.

## INT-02
**Severity:** Critical   **Type:** Confirmed
**Category:** Security
**Module:** Legacy document-transfer utility
**Location:** `D:\next_lms_erp\routes\web.php:654-655`; `D:\next_lms_erp\app\Http\Controllers\oldDocumentTransfer.php:47-75,150-260`
**Function/Method:** `storeImagesToDigitalOcean`, `ConvertBinaryData`
**Problem:** Both routes sit outside every auth group (only the `web` group's CSRF token, obtainable with any GET). `POST /transferDocs` takes `directory` (+ `type=storage`) and `digi_directory` from the request, lists that server directory (`public_path($request->directory)`, no containment), and uploads **every file in it to the public DigitalOcean bucket** under `public/<digi_directory>/` with ACL `public`. `GET /convertDoc` reads `public/converted_json.json` if present, deletes and rewrites objects under `public/student_document/`, inserts `tblstudent_document` rows and calls `file_get_contents($value['mediumBlob'])` on data from the file (SSRF).
**Evidence:** `$directory = public_path($request->directory); ... $files = File::files($directory); foreach ($files as $file) { ... Storage::disk('digitalocean')->putFileAs('public/'.$request->digi_directory.'/', $filePath, $filename, 'public');`
**Impact:** An anonymous caller can pass `directory=..` (or `..` chains), causing `.env`, `composer.json`, `artisan` and every non-recursive file of an arbitrary directory to be mirrored to a public CDN URL of the caller's choosing (secret disclosure: DB, JWT, gateway, DO keys). `convertDoc` can delete/overwrite student documents.
**Expected Behavior:** One-off migration helpers are removed after use, or run as artisan commands with an explicit path allow-list.
**Recommended Fix:** Delete both routes and the controller; if still required, convert to a console command, `realpath()`-contain the source under an allow-listed directory and restrict to `sub_institute_id`.
**Verification:** Routes return 404; `git grep transferDocs` empty; bucket access logs reviewed for `public/<unknown>/` objects and keys rotated if any exist.

## INT-03
**Severity:** Critical   **Type:** Confirmed
**Category:** Security
**Module:** SQAA PDF / file deletion
**Location:** `D:\next_lms_erp\routes\web.php:290`; `D:\next_lms_erp\app\Http\Controllers\sqaa\sqaa_controller.php:254-263` (`unlink_file`), `:229-252` (`generatePdf`); `D:\next_lms_erp\app\Http\Middleware\checkPermission.php:34-48`; `resources/views/sqaa/generatePdf.blade.php:61`
**Function/Method:** `sqaa_controller::unlink_file`, `generatePdf`
**Problem:** `POST /unlink-file` deletes any path given in the request: `if (file_exists($request->file)) { if (unlink($request->file)) ...`. The route is inside the T1 group, but `checkPermission` only checks rights when the route name resolves to a `tblmenumaster` menu; for an unmapped name (`unlink-file`) it does nothing. `SessionMiddleware` accepts any valid bearer JWT with `type=API`, so any logged-in user (including a student/parent token) qualifies. `generatePdf` renders `html_content` from the request with `PDF::loadHTML`, names the file `<tenant>_pdf_menu<menu_id_pdf>_doc<doc_id_pdf>.pdf` from request fields and saves it under `public/sqaa/`.
**Evidence:** `public function unlink_file(Request $request){ if (file_exists($request->file)) { if (unlink($request->file)) { echo 'File deleted successfully.'; ...`; `$filename = $sub_institute_id.'_pdf_menu'.$menu_id.'_doc'.$doc_id.'.pdf'; $pdf->save(public_path('sqaa/' . $filename));`
**Impact:** Arbitrary file deletion as the PHP user: `.env` (app outage), `public/index.php`, `storage/logs`, uploaded documents and generated receipts, or another tenant's files. Client-controlled filename fragments in `generatePdf` allow writing PDFs to unintended relative locations and the file name is predictable/public.
**Expected Behavior:** Deletion only of a server-recorded attachment id belonging to the caller's tenant; permission check on the route.
**Recommended Fix:** Remove `unlink-file`; if the SQAA screen needs it, delete by `sqaa_document.id` scoped by tenant and `storage_path` prefix check with `realpath`; sanitise `menu_id/doc_id` to integers; make the route name a mapped menu or add explicit `RequirePermission`.
**Verification:** `POST /unlink-file?file=/tmp/x` with a student JWT returns 403/404 and the file remains.

## INT-04
**Severity:** Critical   **Type:** Confirmed
**Category:** Security
**Module:** Standalone bulk-import scripts (extends BE-06)
**Location:** `D:\next_lms_erp\public\excel_upload\{bulk_chapter_data,bulk_topic_data,bulk_lo_data,bulk_content_data,bulk_question_data,Import_xlsx_data,fees,ajax,export_xlsx,map_student_document_data}.php`; linked from `resources/views/lms/bulk_chapter_upload.blade.php:35-43`, `AJAXController.php:1463`, `MenuRightsController.php:346`, `D:\lms_k12\app\general\implementation_management\ImplementationManagementPage.tsx:94`
**Function/Method:** top-level script code
**Problem:** These 10 PHP files are served directly by the web server (`public/.htaccess` only rewrites non-existent paths), bypass Laravel middleware and have **no authentication** (none reads `$_SESSION` for identity). `db.php` boots Laravel and connects with the production DB credentials. Tenant, year and user come from `$_REQUEST`/`$_SESSION['SUB_INSTITUTE_ID']` (which `export_xlsx.php:4-5` sets from `?sub_institute_iderp=`). SQL is built by concatenation of `$_REQUEST['grade'|'standard'|'subject'|'chapter'|'topic'|'sub_institute_id'|'syear'|'user_id']` and unescaped spreadsheet cells (`bulk_chapter_data.php:62-69`, `bulk_topic_data`, `bulk_lo_data`, `ajax.php:5-70`). `map_student_document_data.php` runs a one-off migration for hard-coded tenant `47` on every visit. `bulk_question_data.php:66-73` posts each question to a Cloud Run classifier with TLS verification off. `export_xlsx.php:186-192` echoes `$_REQUEST['fileName']` into an `href` and probes `assets/<fileName>` (path probe, reflected XSS when the file exists). The uploaded workbook is parsed with the unmaintained PHPExcel.
**Evidence:** `bulk_chapter_data.php:68`: `values('" . $_REQUEST['syear'] . "','" . $_REQUEST['sub_institute_id'] . "','" . $_REQUEST['grade'] . "', '" . $_REQUEST['standard'] . "','" . $_REQUEST['subject'] . "','" . $value['ChapterName'] . "'`; `ajax.php:8`: `WHERE sub_institute_id = '" . $sub_institute_id . "' AND grade_id = '" . $grade . "'`.
**Impact:** Unauthenticated SQL injection (read/modify the whole production DB, all tenants) and unauthenticated bulk write of chapters/topics/questions/LOs/content into any tenant; XXE surface via PHPExcel; migration replay.
**Expected Behavior:** No standalone entry points; import goes through authenticated, tenant-scoped Laravel controllers.
**Recommended Fix:** Delete `public/excel_upload/*.php` (the Blade links and Next link `apps.triz.co.in/excel_upload/export_xlsx.php` must be re-pointed to an authenticated endpoint), move imports to `ImportApiController`-style controllers using bindings and PhpSpreadsheet, deny direct PHP in `public/` at the web server.
**Verification:** `GET /excel_upload/ajax.php` -> 404; `git ls-files public/excel_upload` has no `.php` scripts; regression test for the replacement endpoint.

## INT-05
**Severity:** Critical   **Type:** Confirmed
**Category:** Security
**Module:** Web import routes
**Location:** `D:\next_lms_erp\routes\web.php:299-304`; `D:\next_lms_erp\app\Http\Controllers\Import\ImportController.php:29-211` (`customParseImport`, `parseImport`), `:214-600` (`processImport`)
**Function/Method:** `getImport`, `Import`, `customParseImport`, `parseImport`, `matchFields`, `processImport`
**Problem:** The six import routes are registered after the closing `});` of the auth group (line 297), so they have only `web` middleware (CSRF, obtainable by any GET). `parseImport` has no validation at all, moves the upload to `public/import/<tenant>_<syear>_<rand>.<ext-client>` (with an empty session the name is `__NNNNN.ext`), `matchFields` updates `csv_data` by an arbitrary `csv_file_id` and `processImport` inserts/updates `tbluser`, `tblstudent`, `fees_collect`, `result_marks`, `result_personalize_marks` using **column names supplied by the caller** (`$request->fields[$key]`). For `tblstudent` the tenant is `isset($prepareData['sub_institute_id']) ? $prepareData['sub_institute_id'] : session()` (`:401`), i.e. chosen by the caller; `tbluser` rows can carry `is_admin`, `user_profile_id`, `password`.
**Evidence:** `Route::post('/import_parse', [ImportController::class,'parseImport'])...` (no middleware) directly below the `});` at `web.php:297`; `$prepareData[$request->fields[$key]] = $request->custom_text[$key] ?? $row[$key];`.
**Impact:** Anonymous bulk creation/overwrite of students and users (including admin accounts) in any tenant, staging of attacker files under `public/import/`, and reads of other tenants' staged rows via `csv_data` ids.
**Expected Behavior:** Same guard as every other web module; column names validated against `import_table_fields`; tenant only from the authenticated session.
**Recommended Fix:** Move the routes into the T1 group (or delete them, the SPA uses `api/import/*`); whitelist columns; ignore `sub_institute_id`/`is_admin`/`user_profile_id` unless the caller is a platform admin; add `csv_data.sub_institute_id`.
**Verification:** Anonymous POST returns 302/401; a student token cannot create a `tbluser` row with `is_admin=1`.

## INT-06
**Severity:** High   **Type:** Confirmed
**Category:** Security
**Module:** E-mail (AJAX send)
**Location:** `D:\next_lms_erp\routes\web.php:481`; `D:\next_lms_erp\app\Http\Controllers\AJAXController.php:1509-1561`
**Function/Method:** `ajax_sendmail`
**Problem:** `POST /ajax_sendmail` has no `session`/`check_permissions` middleware. It takes the caller's tenant SMTP row, then sends to any `email` with any `subject`/`message` and **`addAttachment($request->get('attachment'))` with a caller-supplied server path**.
**Evidence:** `$attachment = $request->get('attachment'); $mail->addAttachment($attachment);` (`:1549-1551`).
**Impact:** Any account with a web session (any staff role) can e-mail `/var/www/.../.env`, `storage/logs/laravel.log`, other tenants' uploaded files or `/etc/passwd` to an external mailbox (arbitrary local file read + exfiltration), and relay mail through the school SMTP identity.
**Expected Behavior:** Attachments only from uploaded files or known storage ids; permission-gated route.
**Recommended Fix:** Remove the `attachment` parameter, restrict to `storage/app/public/email/<file>` after `realpath` containment, put the route in the T1 group with `check_permissions`, add per-user rate limit.
**Verification:** Request with `attachment=/etc/passwd` is rejected; request without a session returns 302/401.

## INT-07
**Severity:** High   **Type:** Confirmed
**Category:** Security
**Module:** Payslips / offer letters / staff documents (extends HR-19, HR-31)
**Location:** `D:\next_lms_erp\app\Http\Controllers\Payroll\PayrollController.php:1495-1503`; `Recruitment\OfferController.php:186-200`; `user\tbluserController.php:550`; `FileController.php:11-37`
**Function/Method:** payslip generation, `OfferController::send`, `addUserDocument`
**Problem:** Payslip PDFs are stored on the public DigitalOcean bucket with ACL `public` at **`public/staff_document/emp_<employee_id>_payslip_<month>_<year>.pdf`** - a key made only of sequential employee ids and month/year (no random/timestamp component, unlike HR-31's upload path). Offer letters use `offer_letter_<offer_id>_<name>.pdf` under `public/offerLetter/` and a second copy under `storage/app/public/<file>.pdf`. There is no signed-URL mechanism anywhere (`temporaryUrl` = 0 uses).
**Evidence:** `$fileName = 'emp_' . $id . '_payslip_'.$month.'_'.$year.'.pdf'; $file_path = 'public/staff_document/' . $fileName; ... Storage::disk('digitalocean')->put($file_path, $pdfContent, 'public', ['Cache-Control' => 'max-age=0, no-cache, no-store']);`
**Impact:** Salary, deductions and bank data of every employee are retrievable by anyone who can enumerate `emp_<id>_payslip_<m>_<y>.pdf` on the CDN host (bucket listing not required).
**Expected Behavior:** Private bucket/ACL, served through an authenticated, owner-checked download or short-lived signed URL.
**Recommended Fix:** Store with private visibility under `tenant/<id>/payslips/<uuid>.pdf`, add an authenticated `GET payslip/{id}` that checks owner/HR role and returns `Storage::temporaryUrl`; back-fill and move existing objects; rotate nothing else.
**Verification:** Anonymous GET of an existing key returns 403; owner download works.

## INT-08
**Severity:** High   **Type:** Confirmed
**Category:** Security
**Module:** Generated PDFs, NACH bank exports and report artefacts in public paths
**Location:** `fees\NACH\s1excel_exportController.php:243-258`, `s3excel_exportController.php:268-275` (`storage/NachExcel/NACH_S1|S3_EXPORT_<Y_m_d_H_i_s>.xlsx`, `mkdir 0777`, `chmod 0777`); `AJAXController.php:1601-1618,1720,1887,1989,3232-3245` (`storage/mail_receipt_pdf/<student_id>_<YmdHis>.pdf|.html`, `storage/test_PDF/<tenant>_<YmdHis>.pdf`); `fees_report\monthwiseReceiptPdfController.php:140-172` (`zip_pdf/<tenant>/`, `public/bulk_receipt.zip`); `adminapiController.php:2618`; `questionpaperController.php:392-433`; `cbse_result/*` (8 sites); `student\studentBulkUpdateController.php:151`; `bazar`, `fees_reconciliation`, `email/` attachments; local evidence: `public/storage/NachExcel/NACH_S1_EXPORT_2026_07_17_17_36_57.xlsx`, 13 files in `public/import/`
**Function/Method:** export/PDF generators
**Problem:** Sensitive output is written under the web root/`public` disk, named from `date()` (1-second resolution) or sequential ids, and **never deleted** (`unlink` commented out at `AJAXController:3239-3240`). NACH S1/S3 contain each payer's bank account number, IFSC, UMRN (`s3excel_exportController.php:108-114`). Fee receipts and result cards are saved both as HTML and PDF. `monthwiseReceiptPdfController` builds one shared `public/bulk_receipt.zip` (concurrent users overwrite each other's zip, then `deleteFileAfterSend`). The repo `.gitignore` contains bare `public`, `storage`, `vendor` patterns so these artefacts never show in `git status`.
**Evidence:** `$name = "NACH_S3_EXPORT_".date("Y_m_d_H_i_s"); ... $objWriter->save("storage/NachExcel/$name.xlsx");`; `file_put_contents($html_file_path, $html); htmlToPDF($html_file_path, $pdf_file_path);` with `// unlink($html_file_path);`.
**Impact:** Bank-account data and student fee/result documents are enumerable by time or student id at `/storage/...` (given the symlink), with no expiry.
**Expected Behavior:** Generate to a private temp disk, stream, delete after send; randomised names.
**Recommended Fix:** `Storage::disk('local')` + `response()->download(...)->deleteFileAfterSend()`; scheduled purge of legacy folders; remove `chmod 0777`; unique per-request zip name.
**Verification:** After export the file no longer exists; `/storage/NachExcel/...` returns 404.

## INT-09
**Severity:** High   **Type:** Confirmed
**Category:** Security
**Module:** Audit log written to the public disk
**Location:** `D:\next_lms_erp\app\Helpers\Helper.php:2872-2915` (`accesslog_json`); `front_desk\user_log\user_logController.php:99`; evidence `storage/app/public/access_log/254/2026-Sep.json`
**Function/Method:** `accesslog_json`
**Problem:** Every logged write appends `{query, bindings, time}` (the full SQL with **all bound values**) to `storage/app/public/access_log/<tenant>/<Y-M>.json`, i.e. a predictable file under the publicly served `storage` disk. The existing file shows `update tblstudent set ... password=?...` with bindings containing the student's password hash, mobile numbers, DOB, e-mail and address. The function also does a read-decode-append-rewrite of the whole JSON file on every request (O(n) per request, lost updates under concurrency, unbounded growth).
**Evidence:** `File::put($filePath, json_encode($existingData));` where `$existingData` was read from the same file; sample: `..."bindings":[254,"cd73...",1,"Aarav","Pritesh","Patel",...,"8866375706",...,"Rinkunow@gmail.com"...`.
**Impact:** Anyone able to request `/storage/access_log/<tenant>/<YYYY>-<Mon>.json` reads a running dump of PII and credential hashes; performance collapse and log corruption on busy tenants.
**Expected Behavior:** Audit trail in the `access_log_route` table (already exists) or a private disk; bindings redacted.
**Recommended Fix:** Move to `storage/logs` or the DB, drop bindings for `password/otp/aadhaar/mobile` columns, use append-only line-delimited JSON with `LOCK_EX`, rotate.
**Verification:** `/storage/access_log/...` 404; sample log lines contain no `password` binding.

## INT-10
**Severity:** High   **Type:** Confirmed
**Category:** Authorization
**Module:** Upload endpoints that trust client tenant / record ids (extends FIN-77, STU-38)
**Location:** `D:\next_lms_erp\routes\admission.php:81` -> `admissionEnquiryController.php:1057-1075`; `student\tblstudentDocumentController.php:44-71`; `routes\api.php:788-835` -> `api\PettyCashApiController.php:114-128`, `FrontDeskApiController.php:122-126`, `ComplaintApiController.php:95-99`, `PhotoVideoGallaryApiController.php:137-237`; `StudentCareApiController.php:81-125`
**Function/Method:** `paymentProof`, `tblstudentDocumentController::store`, T3 API `store/update`
**Problem:** (a) `POST /admission_enquiry/payment_proof` is public ("for hills standalone"): the file is stored as `<enquiry_id>.<ext-client>` in the public bucket and `admissionEnquiryModel::where(['id'=>$request->enquiry_id])->update(['payment_attachment'=>...])` runs with no tenant/ownership check - any anonymous caller can replace any enquiry's payment proof with an arbitrary-type file. (b) `tblstudentDocumentController::store` takes `sub_institute_id` from the request when `type=API|JSON` and never checks that `student_id` belongs to that tenant. (c) The petty-cash, front-desk, complaint and gallery API controllers are in the bare `api` group (not in `api_guard.protect`), have no authentication in the controller and read `sub_institute_id` from the body; their uploads land in the web root/`public` disk.
**Evidence:** `admission.php:81 Route::post('admission_enquiry/payment_proof', ...) // for hills standalone`; `if(in_array($type,["API","JSON"])){ $sub_institute_id = $request->sub_institute_id; }`; `PettyCashApiController:121 $image->move(public_path('/'.self::BILL_DIRECTORY), $fileName)`.
**Impact:** Unauthenticated file planting and record tampering across tenants; document IDOR.
**Expected Behavior:** Tenant from the verified token only; ownership check on the parent row; public endpoint (if kept) creates a new row rather than editing an id.
**Recommended Fix:** Add these path patterns to `api_guard.protect` (or `api.session`), derive tenant from the JWT, verify `student_id`/`enquiry_id` belong to it, constrain uploads per INT-11.
**Verification:** Unauthenticated calls return 401; cross-tenant `student_id` returns 404.

## INT-11
**Severity:** High   **Type:** Confirmed
**Category:** Security
**Module:** Upload validation / storage architecture (census; extends BE-05, FIN-38/51/77, LMS-15, STU-38, HR-19/31)
**Location:** see table 5.1 (60 rows); central facts: 306 uses of client name/extension in 103 files vs 27 `mimes:` rules in 18 files; 83 DO puts with ACL `public`; `config/filesystems.php` (`public`, `books` = `public_path('/uploads/books')`, `digitalocean` with no `visibility` default); `.gitignore` lists `/public/pettycash` etc.
**Function/Method:** all upload handlers
**Problem:** New sinks not enumerated before: face-capture photos (`studentFaceAttendanceController:150,176`, `adminapiController:2708-2803`), visitor photos (`visitor_masterController:208,303`), admission payment proofs, `Payroll` payslips, offer letters, `StudentCareApiController` base64 uploads (extension from client `file_name`, fallback `.bin`), `CustomModuleController:798-814` into `public/images`, `sqaa`, SOP PDFs, WhatsApp `wp_sent_files`, settings/result logos, blog images. Except for `ContentUploadService`, `MobilePageAssetUploadService`, `ExamEvaluationStorage`, `AiAssistanceTicketController` and `TaskAttachmentVersionController`, files are stored under a client-derived extension (`.php/.html/.svg/.phtml` accepted) in web-served directories or in one shared public bucket, with sequential/time-based names, flat (no tenant) paths, no size limit (PHP defaults) and no antivirus. `ExamEvaluationStorage::detectMime` accepts a file if **any** of `mime_content_type`, `getMimeType` or the client-declared type matches, so a hostile file with a forged client MIME is admitted. Student photo size (500 KB) is enforced in exactly one of ~15 student image paths.
**Evidence:** `$ext = File::extension($originalname); $file_name = $name.'.'.$ext; $file->storeAs('public/student/', $file_name);` (`tblstudentController:265-267`); `ExamEvaluationStorage.php:106-116`.
**Impact:** Stored XSS/HTML/SVG hosting, script upload (RCE depending on server config, NOT VERIFIED), cross-tenant overwrite by name collision, enumeration of every uploaded student/parent/visitor/document by id or timestamp, unbounded disk use.
**Expected Behavior:** One `UploadService`: MIME sniff + extension allow-list per use case, `Str::uuid()` names under `tenant/<id>/<area>/`, private disk + signed/authorised delivery, size caps, image re-encode for photos.
**Recommended Fix:** Promote `ContentUploadService` to the shared service (its own header says the shared service "lands" later - `app/Services/Uploads` is an empty folder), migrate the ~60 rows in 5.1 in priority order (WEB/T0/T3 first), set bucket default ACL private, deny script execution under `storage/`, `import/`, `pettycash/`, `images/`, `lms_editor_upload/`, `uploads/`.
**Verification:** Uploading `x.php`/`x.svg` is rejected everywhere; `grep -c "'public')"` for DO puts drops to the deliberate set; feature tests with `Storage::fake`.

## INT-12
**Severity:** High   **Type:** Confirmed
**Category:** Business Logic
**Module:** Generic import engine (extends HR-15)
**Location:** `D:\next_lms_erp\app\Http\Controllers\api\ImportApiController.php:27-92` (parse), `:130-330` (process), `:307` (tenant choice); `Import\ImportController.php` (same code)
**Function/Method:** `parse`, `process`
**Problem:** Beyond HR-15 (client column names, public file retention): (1) for `tblstudent` the tenant is `isset($prepareData['sub_institute_id']) ? $prepareData['sub_institute_id'] : session(...)`, so any authenticated importer can map a CSV column to `sub_institute_id` and create/overwrite students **in another tenant** (both `tblstudent` and `tblstudent_enrollment` rows are written with it); (2) no transaction: a failure mid-loop leaves a partial import and returns HTTP 500 with no counts; (3) the whole file is read into memory (`$worksheet->toArray()`), JSON-encoded into a `longText` and re-decoded on `process`; per-row 3-6 queries; (4) `is_skip` comparisons mix `=== 1` (when building the match `$condition`) with `== 1`: if the column is returned as a string the `$condition` stays empty (`sub_institute_id` only), so "skip" treats every row as an existing duplicate and "overwrite" updates the first matching user/student of the tenant for every row (Potential - depends on PDO native types, NOT VERIFIED); (5) any `table_name` not hard-coded (e.g. `tblstudent_document`) returns `status 1` with `total_rows` and does nothing; (6) `fees_collect` import inserts fee ledger rows with a caller-supplied amount and no receipt numbering; (7) `utf8_encode` is deprecated (PHP 8.2); (8) `csv_data` has no tenant column and rows persist forever with all PII.
**Evidence:** `$sub_institute_id = isset($prepareData['sub_institute_id']) ? $prepareData['sub_institute_id'] : session()->get('sub_institute_id');` (`ImportApiController.php:307`); `DB::table($request->table_name)->where($condition)->where('sub_institute_id', $sub_institute_id)->update($prepareData);`.
**Impact:** Cross-tenant student creation/overwrite, half-applied imports with no way to tell, memory exhaustion on large sheets, silent no-op imports.
**Expected Behavior:** Column whitelist from `import_table_fields`, tenant only from the token, chunked read (`ReadFilter`/`fgetcsv` streaming), transaction per batch, per-row error report, delete staged file/`csv_data` after processing.
**Recommended Fix:** Rewrite `process` around a per-table importer class; wrap in `DB::transaction` per 500 rows; enforce `(int)$data->is_skip` comparisons; add `csv_data.sub_institute_id` and TTL purge; queue large imports.
**Verification:** Import with a `sub_institute_id` column is rejected; killing PHP mid-import leaves no partial rows; 100k-row file imports within memory limit.

## INT-13
**Severity:** High   **Type:** Confirmed
**Category:** Business Logic
**Module:** Fees reconciliation upload
**Location:** `D:\next_lms_erp\app\Http\Controllers\fees\fees_reconciliation\fees_reconciliation_upload_sheet_controller.php:80,121,205`
**Function/Method:** `store_fees_reconciliation_data`
**Problem:** (1) The reconciled amount is doubled: `$amount = $get_fees_collect[0]['amount'] + $get_fees_collect[0]['amount'];`. (2) The `SUM(fc.amount)` subquery joins `tblstudent_enrollment te ON te.student_id = fc.student_id` without `syear`/tenant, multiplying the sum by the number of enrollment rows (one per academic year). (3) The duplicate check `where(['reference_no'=>..., 'payer_opted_mode'=>...])` has no `sub_institute_id`, so another school's identical reference suppresses the insert and the later `UPDATE` targets that other tenant's row (`check_fees[0]->id`). (4) Inserts write the **string** `'Null'` into `student_id`, `term_id`, `receipt_no`, `standard_id`, `paymode`, `bank_detail`, `amount` and `updated_at`. (5) No transaction; whole sheet loaded; the uploaded file stays in `storage/app/public/fees_reconciliation/`.
**Evidence:** `'student_id' => 'Null', 'term_id' => 'Null', ... 'updated_at' => 'Null',` and the `amount + amount` line above.
**Impact:** Reconciliation report shows wrong paid amounts, cross-tenant row corruption, unusable NULL semantics.
**Expected Behavior:** Exact match on (tenant, reference, mode); amount from a single `fees_collect` aggregate for the year; real NULLs.
**Recommended Fix:** Fix the arithmetic, add tenant/syear to the join and duplicate check, use `null`, wrap in a transaction, delete the upload after import.
**Verification:** Unit test with two enrollment years and two tenants sharing a reference.

## INT-14
**Severity:** High   **Type:** Confirmed
**Category:** Security
**Module:** Third-party AI services receiving student data
**Location:** `D:\next_lms_erp\app\Http\Controllers\front_desk\classFaceAttendanceController.php:45-72` (`harshit20991999-multi-face-detection-modal.hf.space`); `student\studentHomeworkSubmissionController.php:169-200` (`moncey10-homework-validation-system.hf.space`); `AJAXController.php:2417`, `public/excel_upload/bulk_question_data.php:66` (Cloud Run `getbloomslevel-*.a.run.app`); `settings\conversationalAIController.php:138`, `Livewire\ConversationalAIV2.php:101` (`kgenkit.vercel.app`)
**Function/Method:** `classFaceAttendance`, homework submission validation, Bloom classifier, conversational AI
**Problem:** Class photos of children (biometric face data), homework files together with `student_id`, and `enrollment_no`+`sub_institute_id` are POSTed to hard-coded third-party endpoints that appear to be personal HuggingFace Spaces/Vercel apps, with no authentication, TLS verification disabled (`new \GuzzleHttp\Client(['verify' => false])`), no timeout, and no data-processing agreement visible in the repo. The homework flow stores the returned annotated-PDF link **on the HF Space host** (`https://moncey10-homework-validation-system.hf.space/storage/<file>`) in `ai_generated_file`, so student work lives on infrastructure the school does not control and breaks when the space sleeps. Captured photos are also kept publicly in `storage/app/public/capture_attendance/`.
**Evidence:** `$client = new \GuzzleHttp\Client(['verify' => false]); ... $multipart[] = ['name'=>'files','contents'=>fopen($image->getRealPath(),'r')...]` and `$annotedPDF = 'https://moncey10-homework-validation-system.hf.space/storage/' . $body['annotated_pdf'];`.
**Impact:** Uncontrolled processing/retention of minors' biometric and academic data by unknown third parties (privacy/regulatory exposure, e.g. DPDP), MITM on unverified TLS, feature outage when the space is paused.
**Expected Behavior:** Self-hosted or contractually covered inference behind auth, TLS verified, results persisted locally, consent recorded.
**Recommended Fix:** Move inference into the company's infra or an agreed vendor, put URLs in config, enable TLS verification, copy annotated PDFs to the school's storage, minimise data sent (no student ids), add consent flags.
**Verification:** No `hf.space`/`vercel.app`/`run.app` literals in `app/`; calls fail closed on invalid certificate.

## INT-15
**Severity:** High   **Type:** Confirmed
**Category:** Security
**Module:** Outbound TLS verification disabled (extends BE-27)
**Location:** 42 call sites - `Helper.php:1827-1828` (FCM legacy), `:1884-1885` (FCM v1), `:1950-1951` (Google OAuth token exchange), `:2078-2079` (`sendSMS`); `AJAXController.php:2423-2424`; `adminapiController.php:2949-2950`; `apiController.php:850-851`; `easy_com\send_email_other_controller.php:189-190`, `send_email_parents_controller.php:202-203`, `send_sms_parents_controller.php:137-138`, `send_sms_staff_controller.php:212-213`; `fees\fees_report\feesStatusController.php:294-295`; `fees\NACH\s4excel_importController.php:702-703`; `fees\online_fees\online_fees_collect_controller.php:621-622` (CCAvenue), `:1659` (ICICI Orange initiate), `:1863` (ICICI Orange status); `front_desk\classFaceAttendanceController.php:47`; `lms\h5p\H5PIndexController.php:198`, `H5PScenarioController.php:397`; `school_setup\ga.php:845`, `HomeController.php:849`; `student\studentHomeworkSubmissionController.php:178`, `tblstudentController.php:1338` (Google Maps); `transportation\send_late_sms_controller.php:125-126`; `visitor_management\visitor_masterController.php:565-566`; `Services\OpenAIService.php:40,152,225,324,494,745,785,845,1088,1394,1720,1949,2186,2276` (14); `public/excel_upload/bulk_question_data.php:72-73`; `public/getworkflow.php:317-318`; plus mirrored copies in untracked `public/public/`
**Function/Method:** cURL / Guzzle calls
**Problem:** Every listed call turns off peer/host verification. It includes payment-gateway traffic (ICICI Orange, CCAvenue), the Google OAuth JWT-bearer exchange that mints FCM access tokens, OTP/SMS URLs carrying gateway API keys in the query, and OpenAI/OpenRouter Bearer keys. BE-27 counted ~39; this is the exhaustive list (42 unique + 2 mirrored).
**Evidence:** `curl_setopt($ch, CURLOPT_SSL_VERIFYPEER, 0);` (all C sites); `'verify' => false` (Guzzle sites).
**Impact:** A network-position attacker can read/modify OTPs, SMS content, gateway requests/responses, service-account assertions and LLM keys.
**Expected Behavior:** Default verification everywhere; CA bundle configured if the host lacks one.
**Recommended Fix:** Delete the options (or centralise HTTP calls in one client), set `curl.cainfo`; CI grep gate for `VERIFYPEER`/`'verify' => false`.
**Verification:** `grep -rnE "VERIFYPEER|'verify' *=> *false" app public` returns nothing.

## INT-16
**Severity:** High   **Type:** Confirmed
**Category:** Business Logic
**Module:** ICICI Orange payment gateway
**Location:** `D:\next_lms_erp\app\Http\Controllers\fees\online_fees\online_fees_collect_controller.php:1649-1650` (initiate), `:1853-1854` (status), `:1246-1247` (Eazypay)
**Function/Method:** `icici_orange_request_handler`, `orange_pg_fetch_payment_status`, `icici_request_handler`
**Problem:** Orange payment initiation posts to the **UAT** host `https://pgpayuat.icicibank.com/tsp/pg/api/v2/initiateSale` (the production URL is commented out with the note "Production"), while the status check calls the **production** `https://pgpay.icicibank.com/pg/api/command`. Eazypay hard-codes tenant `2440` (a likely typo for 244) to the UAT host `eazypayuat.icicibank.com`.
**Evidence:** `//$initiateURL = "https://pgpay.icicibank.com/pg/api/v2/initiateSale"; // Production` / `$initiateURL = "https://pgpayuat.icicibank.com/tsp/pg/api/v2/initiateSale"; // Development`; `$statusURL = "https://pgpay.icicibank.com/pg/api/command"; //Production`.
**Impact:** In a production deployment Orange payments are created in the bank sandbox and can never be confirmed by the production status call, or (if a merchant id exists in both) reconcile against the wrong environment; tenant 2440 (if real) pays into UAT.
**Expected Behavior:** Endpoint chosen from configuration per environment, consistently for initiate and status.
**Recommended Fix:** Put base URLs in `config/services.php` keyed by `APP_ENV`, remove the tenant-id special case.
**Verification:** Unit test asserting both URLs share the same base per environment.

## INT-17
**Severity:** High   **Type:** Missing
**Category:** Business Logic
**Module:** Payment confirmation / reconciliation
**Location:** `routes\fees.php:265-314`, `routes\web.php:538-544` (`*_fetch_payment_status`), `app\Http\Controllers\fees\online_fees\reconciliation_status_api_controller.php`, `Kernel.php`
**Function/Method:** n/a
**Problem:** There is no inbound webhook route for any gateway (grep for `webhook|X-Razorpay-Signature|hash_equals` finds none in payment code) and nothing scheduled: payment completion depends on the payer's browser returning to `*_response_handler` (Razorpay verifies the signature; the other gateways do not, FIN-01) or on someone calling `*_fetch_payment_status`, which the SPA triggers only while the page is open. The Kernel schedules only Neo4j tasks.
**Evidence:** `Kernel.php:30-92` (3 items, no fees); no `Route::post(...'webhook')` under `routes/`.
**Impact:** Payments captured at the gateway when the payer closes the tab stay `pending` in `fees_payment` until manual reconciliation; no independent server-to-server confirmation (also the mitigation missing for FIN-01/BE-08).
**Expected Behavior:** Signed webhooks per gateway plus a scheduled sweep that re-queries all `pending` payments older than N minutes (idempotent).
**Recommended Fix:** Implement Razorpay webhook (`X-Razorpay-Signature`), schedule `fees:reconcile-pending` every 10 minutes with `withoutOverlapping` and per-tenant gateway credentials, reuse `pay_fees` idempotently.
**Verification:** Simulated closed-tab payment becomes `PS` without user action.

## INT-18
**Severity:** High   **Type:** Confirmed
**Category:** Security
**Module:** Secrets in source and at rest (extends BE-09, BE-27)
**Location:** `app/Console/Commands/SyncONetOccupationData.php:35,55` and 13 sibling files (28 occurrences of `base64_encode('trizinnovation:4225***')`); `Helper.php:1808,1813,1818`; per-tenant plaintext tables `fees_razorpay`/`fees_hdfcrazorpay` (`key_id`,`key_secret`), `fees_icici` (`merchant_id`,`enc_key`), `fees_aggre_pay` (`salt_key`), `smtp_details.password`, `sms_api_details.url/pram`, `whatapp_user_details.cloud_api_access_token`; `.gitignore` has no `public/firebase` entry while `send_FCM_Notification` reads `public/firebase/*.json`; `find_broken_link_Controller.php:80` (4 hard-coded staff e-mail addresses)
**Function/Method:** n/a
**Problem:** The O*NET API username/password are embedded 28 times although `env('ONET_USERNAME'/'ONET_PASSWORD')` is used in 10 other places. Payment-gateway secrets, SMTP passwords, SMS gateway URLs (API key inside the query string) and the WhatsApp access token are stored in clear text per tenant. Firebase service-account files are expected inside the web root and are not gitignored (a committed key would be public at `/firebase/*.json`).
**Evidence:** `'Authorization' => 'Basic ' . base64_encode('trizinnovation:4225***')`; `$mail->Password = $smtp->password;`.
**Impact:** Anyone with repo or DB read access holds every school's payment, mail, SMS and WhatsApp credentials.
**Expected Behavior:** Per-tenant secrets encrypted (`Crypt`/KMS), platform secrets only in the environment.
**Recommended Fix:** Rotate the O*NET credential, replace all literals with `config('services.onet')`, use `Crypt::encryptString` casts for gateway/SMTP/WhatsApp columns, add `public/firebase` and `*.json` service accounts to `.gitignore` and move them outside `public/`.
**Verification:** `grep -rn "trizinnovation:" app` empty; secrets columns unreadable in a DB dump.

## INT-19
**Severity:** High   **Type:** Confirmed
**Category:** Security
**Module:** SMS OTP login / visitor pickup OTP
**Location:** `D:\next_lms_erp\app\Http\Controllers\api\apiController.php:60-118,161-196,204-262,817-866`; `visitor_management\visitor_masterController.php:432-482`
**Function/Method:** `login`, `teacherlogin`, `check_otp`, `sendSMS`, `sendOTPVisitor`
**Problem:** (1) Two hard-coded mobile numbers always get OTP `123456` (`:82`, `:165`, and a third pair at `:998` for `login_hills`); (2) for 12 hard-coded tenants (`$sub_Array = [328,329,...,341,61]`) the OTP is the student's date of birth `date('dmy', strtotime($dob))` and **no SMS is sent**; (3) the OTP is generated once and **reused** while the `tblstudent.otp` column is non-empty (`if($data[0]->otp == null || ...) $otp = rand(...) else $otp = $data[0]->otp`), never expires (the SMS text claims "valid for 5 minutes") and is stored in clear text; (4) `sendOTPVisitor` sends the same stored OTP and **returns it in the JSON response** (`$response['otp'] = $otp`), then `confirmOTP` compares `tblstudent.otp` with no tenant check - so the pickup flow discloses the student's login OTP to whoever calls it with `student_id`+`mobile`; (5) SMS gateway result is ignored except a string-compare that can never match (`$res["error"] == $errorMessage`), so a dead gateway silently leaves the old OTP in place; (6) legacy per-tenant special cases (template id `1507166607307092495` for tenants 244-265, `?template_id=`, MMIS 47 parameter order) live in code.
**Evidence:** `if ($mobile == '9979***' || $mobile == '9824***') { $otp = "123456"; } else if(in_array($sub_institute_id, $sub_Array)){ $otp = date('dmy', strtotime($data[0]->dob));`; `$response['otp'] = $otp;`.
**Impact:** Parent/student account takeover with public knowledge (child's DOB) for the listed tenants, known backdoor numbers, OTP disclosure via the visitor API, and no real second factor.
**Expected Behavior:** Random single-use OTP with 5-minute expiry stored hashed, attempt limits, never returned by an API.
**Recommended Fix:** Add `otp_hash`/`otp_expires_at`/`otp_attempts`, remove all static/DOB/backdoor branches, stop returning the OTP, read template ids from tenant config.
**Verification:** Two consecutive logins yield different OTPs; expired OTP rejected; visitor endpoint response has no `otp`.

## INT-20
**Severity:** High   **Type:** Confirmed
**Category:** Security
**Module:** Anonymous notification triggers
**Location:** `routes\web.php:505` (`Resend_otp`), `:520` (`send_birthday_notification`); `routes\api.php:63-69` (`whats-send-app`, `whats-comming-app`); `NewLMS_ApiController.php:1110-1125`; `easy_com\send_birthday_notification\send_birthday_notification_controller.php:12-121`
**Function/Method:** `Resend_otp`, `send_birthday_notification`
**Problem:** (1) `GET /Resend_otp?mobile=<any>` sends an SMS through **tenant 1's** gateway to any number, unauthenticated, unthrottled, and does not even store the OTP it sends (SMS-pumping / cost abuse). (2) `GET /send_birthday_notification` runs the whole birthday job for **all tenants** on each anonymous call (a "cron by URL"): every call inserts new `app_notification` rows and pushes again (no dedupe); the staff branch passes the row object instead of a token array (`send_FCM_Notification($user, ...)` iterates the object's properties as device tokens) so staff pushes never work. `$_SERVER['APP_URL']` is used for the image URL (normally unset). (3) `POST /api/whats-send-app` and `/whats-comming-app` are anonymous closures that `Log::info(json_encode($request->all()))`.
**Evidence:** `Route::get('Resend_otp', [NewLMS_ApiController::class, 'Resend_otp'])`; `$pushStatus = send_FCM_Notification($user, $message, $user->sub_institute_id);`.
**Impact:** SMS/FCM cost abuse and user spam, log flooding with attacker-controlled PII, silent failure of staff birthday pushes.
**Expected Behavior:** Cron-only console command; OTP endpoints authenticated/captcha + rate limited.
**Recommended Fix:** Convert to `php artisan notify:birthdays` scheduled daily with a `sent_on` guard; add `throttle:3,10` + captcha to any public OTP; delete the two log-only routes.
**Verification:** Anonymous call returns 404/429; scheduler runs once per day.

## INT-21
**Severity:** High   **Type:** Confirmed
**Category:** Backend
**Module:** Console commands (destructive seeding)
**Location:** `D:\next_lms_erp\app\Console\Commands\SeedAiDemoDataCommand.php:154-160` (purge before guard), `:214-232` (`guardTenant`), `:57-70` (`OWNED_TABLES`), `:249-330` (`purge`)
**Function/Method:** `handle`, `purge`
**Problem:** The class docblock promises it "writes only to a dedicated sub_institute_id, never to one holding real records", and `guardTenant()` refuses non-synthetic tenants - but `if ($this->option('purge')) { return $this->purge($institute); }` executes **before** `guardTenant`. `php artisan ai:seed-demo --institute=<real id> --purge` therefore deletes `attendance_student`, `homework`, `tblstudent_enrollment`, `admission_*`, `sub_std_map`, **`tblstudent`, `tbluser`, `subject`, `standard`, `division`, `academic_section`** and the tenant's `tblgroupwise_rights` for a real school (no confirmation prompt, no `--force`, no dry-run). `Kernel::bootstrap()`'s guard only matches `db:seed|schema|fresh|refresh`, so `ai:seed-demo` is not blocked.
**Evidence:** `if ($this->option('purge')) { return $this->purge($institute); } if (! $this->guardTenant($institute)) { return self::FAILURE; }`.
**Impact:** One mistyped tenant id irreversibly wipes a live school's master and people data.
**Expected Behavior:** Guard first; purge only rows that carry the synthetic marker (`@synthetic.invalid`).
**Recommended Fix:** Call `guardTenant()` (or a `isSynthetic()` check) before `purge`; delete only synthetic-marked rows; add `--dry-run` default.
**Verification:** `--institute=61 --purge` prints "Refusing" and deletes nothing.

## INT-22
**Severity:** Medium   **Type:** Confirmed
**Category:** Security
**Module:** WhatsApp inbound webhooks & delivery status (extends BE-27)
**Location:** `routes\api.php:69-72`; `WhatsappController.php:359-362` (`updateDeliveryStatus` = `return true;`), `:553-564` (`incomingMessage`), `:566-575` (`whatsappShowReply`); `Console\Commands\SyncWPDeliveryStatus.php`
**Function/Method:** `incomingMessage`, `updateDeliveryStatus`, `whatsappShowReply`, `sync:deliveryStatus`
**Problem:** Meta's webhook endpoints are public, unsigned and stubbed: `updateDeliveryStatus` does nothing; `incomingMessage` stores any posted body with no tenant and no `X-Hub-Signature-256` check, no GET verification handshake (`hub.challenge`) exists. The only status updater is a **Twilio** command (`user_whatsapp_sid/token`, `$client->messages($sid)->fetch()`) that is not scheduled and cannot resolve Meta message ids, so `whatsapp_sent_message.message_status` stays whatever the send call returned (`accepted`/`unknown`). `whatsappShowReply($wid)` reads `IncomingMessage::where('whatsapp_number',$wid)` with no tenant filter and marks them seen. `whatsappCRM` logs each payload (`Log::info('WhatsApp Payload', $payload)` - recipient numbers and text).
**Evidence:** `public function updateDeliveryStatus(Request $request) { return true; }`; `$incommigMessage->whatsapp_number = isset($request->WaId) ? "+" . $request->WaId : ($request->from ?? null);`.
**Impact:** Forged inbound messages, cross-tenant chat visibility, reports that show messages as delivered/unknown forever, PII in logs.
**Recommended Fix:** Implement the Meta verify + signature check, write statuses by `wamid` per tenant, scope chats by tenant, drop or replace the Twilio command.
**Verification:** Unsigned POST -> 401; delivery callback updates `message_status`.

## INT-23
**Severity:** Medium   **Type:** Confirmed
**Category:** Backend
**Module:** Notification delivery mechanics
**Location:** `Helper.php:2062-2101` and 10 copies of `sendSMS()`; `Helper.php:1799-1976`; callers in 22 controllers (e.g. `feesStatusController:220-232`, `circularController:359-372,453-466`, `studentAttendanceController:864-868`)
**Function/Method:** `sendSMS`, `send_FCM_Notification`, `send_FCM_Notification2`
**Problem:** All sending is synchronous in the HTTP request. SMS: no `CURLOPT_TIMEOUT`/`CONNECTTIMEOUT` (a slow gateway pins a PHP worker), `$mobile` is concatenated into the URL without validation/encoding in the legacy copies (parameter injection via `&`), the HTTP status/body is never read so a rejected DLT template or bad key is recorded as `sent`, `apiController::sendSMS` sets `CURLOPT_FOLLOWLOCATION` (redirect to internal hosts), and the gateway API key travels in the query string (visible in proxy/gateway logs). FCM v1: a fresh OAuth token exchange for every call, one HTTP request per token, `$result` discarded, invalid/expired tokens never pruned, the `if($sub_institute_id == 254)` key selection duplicated three times. No retries, no idempotency/dedupe key, no per-message status. PHPMailer loops in `send_email_*` run inline too.
**Evidence:** `curl_setopt($ch, CURLOPT_URL, $url); $output = curl_exec($ch); if (curl_errno($ch)) { $isError = true; ...` (response `$output` unused).
**Impact:** Request timeouts on class-sized sends, false "sent" reports, wasted spend, worker exhaustion.
**Expected Behavior:** One `SmsGateway` service with timeouts, response parsing, retries/backoff, queued jobs with per-recipient status.
**Recommended Fix:** Create a `SendSmsJob`/`SendPushJob`, centralise the 11 copies, cache the FCM access token (55 min), batch via `sendMulticast`/topic, log provider responses.
**Verification:** Force a gateway 401 -> log shows failed, not sent.

## INT-24
**Severity:** Medium   **Type:** Missing
**Category:** Backend
**Module:** Bulk-send cost controls, consent and templates (extends HR-21)
**Location:** `routes\easycomapi.php:36-95`; `api\easy_com\SendSmsParentsApiController.php:83-176`; `SendWhatsappParentsApiController`; `WhatsappController::mediaFound/getWhatsappTemplateName`
**Function/Method:** send endpoints
**Problem:** HR-21 covers who can send. Additional gaps: no per-tenant/user/day quota or credit balance (only the API group's `throttle:1000,1`); free-text `smsText` without a DLT-template registry (Indian carriers reject unregistered templates, and the code cannot tell); WhatsApp uses free text mapped to template names by string parsing with hard-coded country code `91` and a 10-digit rule; **no opt-out/consent/DND handling** (grep for `opt_out|unsubscribe|dnd` finds only the config-only Platform tables), `consent_master` is unrelated; messages contain no unsubscribe or message-type distinction (transactional vs promotional).
**Evidence:** `'smsText' => 'required|string|max:1000'`; `'91' . $student['mobile']` (`WhatsappController:246`).
**Impact:** Unbounded spend, regulatory exposure (TRAI/DLT, WhatsApp policy), inability to honour opt-outs.
**Recommended Fix:** Per-tenant message ledger with daily caps, template table (id, DLT id, variables) with approval, preference table consulted by every sender, `--dry-run` count endpoint before send.
**Verification:** Sending beyond the daily cap returns 429; opted-out recipient is skipped and reported.

## INT-25
**Severity:** Medium   **Type:** Missing
**Category:** Architectural
**Module:** Platform Services - Communication and Scheduler consoles
**Location:** `config\platform_services.php` (>=50 events such as `fees.defaulter.due_date_reminder`, `attendance.student.absent`); `app\Http\Controllers\api\Platform\{NotificationController,SchedulerController}.php`; `app\Models\Platform\{PlatformNotificationPreference,PlatformNotificationChannel,PlatformScheduledTask}.php`; `D:\lms_k12\app\platform-services\{notification,scheduler}\*`
**Function/Method:** `update`, `updateChannel`, scheduler `update`
**Problem:** The consoles let admins switch channels and edit cron schedules per tenant, but **no runtime code reads those tables**: `grep` shows the models are referenced only by their own controllers, `Kernel::schedule()` never consults `platform_scheduled_tasks`, and none of the 22 legacy senders checks `platform_notification_preferences/channels`. The registry lists events (`fees.defaulter.due_soon`, `attendance.student.not_marked`, ...) that nothing raises.
**Evidence:** `Kernel.php:30-92` (3 static tasks); zero references to `PlatformNotificationPreference` outside `app/Models` and `Platform/NotificationController`.
**Impact:** Administrators believe a reminder or channel is on/off when it is not; audit entries record changes with no effect.
**Recommended Fix:** Either label the consoles "planned" or wire a dispatcher that resolves `(tenant, event)` -> channels and a scheduler that materialises `platform_scheduled_tasks` (with `onOneServer()`).
**Verification:** Disabling SMS for `fees.receipt.issued` suppresses the SMS in a feature test.

## INT-26
**Severity:** Medium   **Type:** Potential
**Category:** DevOps
**Module:** Queue configuration (extends BE-26)
**Location:** `config\queue.php:16,19-35`; `app\Jobs\Evaluate*Job.php` (`$timeout` 300/600, `$tries` 2); `EventServiceProvider.php:23`
**Function/Method:** queue config, jobs
**Problem:** Beyond the `sync` default (BE-26): with `database`/`redis` the `retry_after` is **90 s** while the jobs declare `$timeout` 300-600 s. A job still running at 90 s is released and picked up by a second worker, so the same submission can be graded twice concurrently (duplicate LLM spend and duplicate score writes); none implements `ShouldBeUnique`/`WithoutOverlapping`/`backoff`. `EvaluateAnswerSheetJob::refreshBatch` and controllers re-dispatch on `reprocess`. No supervisor/systemd/Horizon file or docs for `queue:work`; failed jobs are only readable via the Event Bus reader. `after_commit` is false on every connection while controllers dispatch immediately after DB writes.
**Evidence:** `'retry_after' => 90` with `public int $timeout = 600;` (`EvaluateHomeworkSubmissionJob:62`).
**Impact:** Duplicate grading and spend once a worker is introduced; silent stall when no worker exists.
**Recommended Fix:** Set `retry_after` > max timeout (e.g. 700), `ShouldBeUnique` keyed by submission id, `backoff`, `after_commit`, document/ship a supervisor unit, alert on `failed_jobs`.
**Verification:** A 200 s job is not re-run by a second worker.

## INT-27
**Severity:** Medium   **Type:** Missing
**Category:** DevOps
**Module:** Scheduler and Kernel guard
**Location:** `D:\next_lms_erp\app\Console\Kernel.php:17-92,120-147`; `routes\console.php`
**Function/Method:** `schedule`, `bootstrap`
**Problem:** Only Neo4j tasks are scheduled. Business jobs that the product implies do not exist as scheduled tasks: payment-status reconciliation, fee/defaulter reminders, WhatsApp status sync, birthday push (URL instead), attendance not-marked alerts, `pal:*` calibration (`pal:derive-irt`, `pal:sync-badges`, `pal:flow-assign` are manual), document-expiry alerts. `bootstrap()` logs every artisan command line (full argv, user, host) at warning level and hard-fails any command line containing `db:seed|schema|fresh|refresh` even for read-only invocations (memory note: "Kernel guard kills any artisan line containing schema"), while not blocking `migrate`, `db:wipe`, `neo4j:reset-graph --skip-backup-check` or `ai:seed-demo --purge`. The Neo4j closures use `withoutOverlapping()` without `onOneServer()`.
**Evidence:** `if (preg_match('/\b(db:seed|schema|fresh|refresh)\b/i', $cmd)) { fwrite(STDERR, ...); exit(1); }`; `Log::channel('daily')->warning('Artisan command executed', ['command' => implode(' ', $argv), ...]);`.
**Impact:** Operational duties rely on people; argv secrets land in logs; the guard gives a false sense of protection.
**Recommended Fix:** Add the missing scheduled commands with `withoutOverlapping()->onOneServer()`, redact argv, replace the regex with an env-based deny list plus `--force` prompts for destructive commands.
**Verification:** `php artisan schedule:list` shows the new tasks.

## INT-28
**Severity:** Medium   **Type:** Confirmed
**Category:** Business Logic
**Module:** Leave import
**Location:** `D:\next_lms_erp\app\Imports\LeaveImport.php:17-42`; `leave\ApplyLeaveController.php:225-236`; `routes\web.php:555`
**Function/Method:** `LeaveImport::model`, `importOldLeave`
**Problem:** The employee lookup is `tbluserModel::where('first_name', <first word>)->orwhere('last_name', <second word>)->where('status',1)->first()` - the `OR` makes the `status` filter apply to one branch only, there is **no `sub_institute_id` filter**, and the first employee of any school with that first name wins. `HrmsLeaveType::where('leave_type','like','%'.$row['type'].'%')` is also untenanted. `to_date` = `from_date + leave` days (off by one for whole-day leave), `$row['leave']` and `$row['slot']` unvalidated, `str_contains($row['slot'],'first')` throws on null. `importOldLeave` validates only `upload_file required` (no mimes/size) and returns exception messages to the client.
**Evidence:** `->where('first_name', explode(' ', $row['employee_name'])[0] ?? '')->orwhere('last_name', explode(' ', $row['employee_name'])[1] ?? '')->where('status',1)->first()->id ?? ''`.
**Impact:** Leave rows attached to another school's (or an inactive) employee; corrupted leave balances.
**Recommended Fix:** Match by employee code/e-mail within the tenant, validate columns, add `mimes:xlsx,xls,csv|max:`, wrap in a transaction with a row-level error report.
**Verification:** Import with a duplicate first name in another tenant maps only to the caller's tenant.

## INT-29
**Severity:** Medium   **Type:** Confirmed
**Category:** Business Logic
**Module:** Bazar (share-market) uploads
**Location:** `bazar\bulkUploadSheetController.php:65-100,176-200,277-300`; `api\MigrationModulesApiController.php:67-68`
**Function/Method:** `store_position_data`, `store_margin_data`, `store_pnl_data`, `bazarUpload`, `bazarReport`
**Problem:** `for ($i = 0; $i < $rowCount - 1; $i++)` ("Exclude the last row") always drops the last data row, inserts run one row at a time with the exception swallowed and only a `success` flag returned (earlier rows stay), the three `sharebazar_*` tables have no `sub_institute_id` so every tenant's upload and report is shared (`bazarReport` filters only by date), and the workbook stays in `storage/app/public/bazar/`. A trading-account module lives in a school ERP with no access separation.
**Evidence:** `for ($i = 0; $i < $rowCount - 1; $i++) { // Exclude the last row`.
**Impact:** Missing records, cross-tenant financial data visibility, partial uploads.
**Recommended Fix:** Add tenant column, transaction, remove the `-1`, or retire the module from the school product.
**Verification:** N-row file yields N rows; other tenant sees none.

## INT-30
**Severity:** Medium   **Type:** Confirmed
**Category:** Security
**Module:** CSV / formula injection (extends FIN-26)
**Location:** `lib/table-export.ts:20-26` (64 pages); own CSV builders in 20 files (`hrit/leave-management/leave-reports/page.tsx:279`, `leave-requests/page.tsx:225`, `hrit/_components/payroll-shell.tsx:138`, `employee-directory.tsx:124`, `certifications-center.tsx:1008`, `onboarding-center.tsx:413`, `capability-library/library-tab.tsx:109`, `competency-library.tsx:256`, `framework-mapping.tsx:328`, `easy_com/_components/ReportPage.tsx:143`, `Inventory/_components/InventoryPage.tsx:82`, `learning-catalog.tsx:154`, `certifications-records.tsx:90`, `sessions-calendar.tsx:157`, ...); `D:\next_lms_erp\app\Http\Controllers\HRMS\departmentController.php:972-990`; `result\cbse_result\result_report_controller.php:978`
**Function/Method:** CSV exporters
**Problem:** FIN-26 reported `table-export.ts`; the same defect exists in 20 bespoke exporters (payroll, staff directory, leave, easy_com reports) and in the Laravel department CSV. Only one exporter in the whole estate neutralises formulas (`AuditLogController::csvSafe`, `AuditLogController.php:79-84`). Excel "exports" are HTML tables saved as `.xls` (macros-free but Excel warns and evaluates cell content).
**Evidence:** `const escape = (value: unknown) => \`"${String(value ?? '').replace(/"/g, '""')}"\`` (`learning-catalog.tsx:133`) - quote-doubling only.
**Impact:** A student/employee name or remark starting with `=`, `+`, `-`, `@` executes when HR/finance opens the export.
**Recommended Fix:** One shared `csvCell()` that prefixes `'` for `=+-@\t\r` and use it in all 21 places; server-side `csvSafe` in `departmentController`.
**Verification:** Unit test on `csvCell('=cmd|...')`.

## INT-31
**Severity:** Medium   **Type:** Potential
**Category:** Frontend
**Module:** Frontend upload components and proxy transport
**Location:** 15 `type="file"` inputs without `accept` (list in 5.1); `app/api/proxy-file/route.ts:8-35` (`request.formData()`), `app/api/import/{parse,process}/route.ts`; `components/ui/file-upload.tsx`; `next.config.ts` (no `bodySizeLimit`/`experimental` upload config)
**Function/Method:** upload UIs, `POST` proxy handlers
**Problem:** 15 of 69 inputs have no `accept`; size limits exist in 6 places only; everything is client-side advice. Multipart uploads issued through the Next route handlers are fully buffered (`formData()`), re-serialised and re-sent; on a serverless host (the app's default CORS origin is `lms-k12.vercel.app`) request bodies above the platform limit (about 4.5 MB on Vercel functions) are rejected before the handler runs, breaking the 10-500 MB limits the pages advertise (H5P video 500 MB, chapter content 500 MB). `NOT VERIFIED` on the actual deployment. Errors are surfaced as `err.message` from a proxied upstream.
**Impact:** Large uploads fail in production while passing locally; no protection against oversized uploads.
**Recommended Fix:** Upload directly from the browser to Laravel (as `import-data` already does) or to a signed DO URL; add `accept` + size guards to the 15 inputs; keep server validation authoritative.
**Verification:** 20 MB upload succeeds from the deployed origin.

## INT-32
**Severity:** Medium   **Type:** Potential
**Category:** Security
**Module:** PDF rendering of user HTML (extends part10 wkhtmltopdf note)
**Location:** `lms\questionpaperController.php:424-425` (`isRemoteEnabled=true`), `Services\Content\RendersGeneratedContent.php:54`, `EmailTemplateService.php:289`, `OpenAIService.php:377`; `Helper.php:1985-2057` (`exec('/usr/local/bin/wkhtmltopdf ...')` with `--enable-local-file-access`, unquoted paths)
**Function/Method:** PDF generators
**Problem:** HTML authored by users or produced by an LLM (question text, e-mail/letter templates, report-card remarks, AI content) is rendered with remote resources enabled and, for wkhtmltopdf, local file access, so `<img src="http://169.254.169.254/...">`, `<iframe src="file:///etc/passwd">` or `@import` in a remark can pull internal resources into the PDF the user then downloads (SSRF/LFI-into-document). File paths are interpolated into the shell command without `escapeshellarg`.
**Impact:** Internal metadata/local file disclosure through generated PDFs.
**Recommended Fix:** Disable remote/local access in dompdf (`chroot` + allow-listed hosts), sanitise HTML (HTMLPurifier) before rendering, switch to `Process` with argument arrays, drop `--enable-local-file-access`.
**Verification:** A template containing an internal URL renders without fetching it.

## INT-33
**Severity:** Medium   **Type:** Confirmed
**Category:** Backend
**Module:** Dead / unwired integrations
**Location:** `config\services.php` (Stripe, Mailgun, Postmark, SparkPost) and `.env.example` (`STRIPE_*`, `TWILIO_AUTH_TOKEN`) with no Stripe code; `TaskManagement\LegacyTaskController.php:151` and `SessionController.php:112` read `config('services.n8n.task_webhook')` which is **not defined** in `config/services.php` or `.env.example`; `school_setup\ga.php`, `HomeController.php:845` (Google Analytics Universal Analytics API, discontinued) polled every 3 s by `public/excel_upload/export_xlsx.php:236-244`; `SyncWPDeliveryStatus` (Twilio); `web.php:535-537` routes to non-existent `result\MarkUploadController`; `D:\lms_k12\app\api\integration-configs\route.ts` (in-memory mock, part02)
**Function/Method:** n/a
**Problem:** Several integrations exist only as config or partial code: the n8n task webhook silently never fires (`if ($url === '') return;`), the Integration Center in the SPA persists to a per-process array, the GA widget requests a dead API repeatedly, three web routes point at a missing controller (route caching or `route:list` fails - matches the memory note that `route:list` is broken).
**Impact:** Features appear implemented but do nothing; wasted requests; broken route cache.
**Recommended Fix:** Define `services.n8n.task_webhook` or remove the calls; remove dead routes/config/UA code; back the Integration Center with a real table.
**Verification:** `php artisan route:list` succeeds; n8n receives the task event.

## INT-34
**Severity:** Medium   **Type:** Confirmed
**Category:** Security
**Module:** Frontend third-party scripts / CSP
**Location:** `D:\lms_k12\app\layout.tsx:35,41` (jsdelivr `@mdi/font` CSS and `verify.min.js` loaded async without `integrity`/`crossorigin`), `app\login\page.tsx:40-46` (Google GSI), `app\fees\online-payment\[gateway]\page.tsx:81-82` (Razorpay checkout.js), YouTube embeds (`h5p/scenario_based/[id]/page.tsx:45`, `lms/*`), `cdn.simpleicons.org` images, `view.officeapps.live.com`, iframe `taxonomy-ontology.tsx:38,164` (vercel-hosted skill ontology; passes `sub_institute_id` in the query), `ai-reports`/`TemplateView` sandboxed `srcDoc`; `next.config.ts` (no `headers()`), no `middleware.ts`, no `vercel.json`
**Function/Method:** layout/head scripts
**Problem:** No Content-Security-Policy, X-Frame-Options/`frame-ancestors`, `Referrer-Policy`, `Permissions-Policy` or HSTS is set anywhere; a third-party script (`verify.min.js`) executes on every page without SRI; auth tokens are held by the SPA (part01), so any XSS or CDN compromise reads them. The `verify.min.js` include is also the source of the known `require is not defined` console error (memory note). Positive: the ontology iframe uses `sandbox` without `allow-same-origin` and `referrerPolicy="no-referrer"`; report previews use `sandbox=""`.
**Impact:** Supply-chain and XSS blast radius is unbounded.
**Recommended Fix:** Add a `headers()` block (CSP with explicit `script-src` for Razorpay/Google, `frame-ancestors 'self'`, `Referrer-Policy`, HSTS), self-host `@mdi/font` or add SRI, drop `verify.min.js`.
**Verification:** Response headers include the CSP; console shows no inline/unknown-origin violations.

## INT-35
**Severity:** Medium   **Type:** Confirmed
**Category:** Authorization
**Module:** Download endpoints without ownership checks
**Location:** `api\lms\HomeworkSubmissionApiController.php:672-705` (`downloadFile`); `api\ApiQuestionPaperController.php:715-750` (`pdf`); `FileController.php:41-148` (`downloadBulkDocuments`); `sqaa\sqaa_controller.php:229-252`; `ExamEvaluationApiController.php:517-535` (tenant from request, guarded by `api_guard`)
**Function/Method:** `downloadFile`, `pdf`, `downloadBulkDocuments`
**Problem:** `downloadFile` returns the storage URL for any homework id (`studentHomeworkModel::find($homeworkId)`, no tenant/student/teacher check); `ApiQuestionPaperController@pdf` returns or **renders** any question paper by id across tenants (`questionpaperModel::find($id)`), and on a miss renders and writes it; `downloadBulkDocuments` zips every staff member's documents of the tenant (Aadhaar/PAN) for any user holding the menu right, using `Storage::disk('digitalocean')->get()` per file in memory with `set_time_limit(0)`; the frontend/API cannot use signed links because all files are public objects anyway (INT-11).
**Impact:** Cross-tenant paper/homework access by id enumeration; large zips can exhaust memory.
**Recommended Fix:** Scope by tenant and role, stream zips, move to private storage with authorised download.
**Verification:** Cross-tenant id returns 404.

## INT-36
**Severity:** Medium   **Type:** Architectural
**Category:** Authorization
**Module:** Opt-in `api_guard` coverage (uncommitted change)
**Location:** `D:\next_lms_erp\config\api_guard.php:35-97`, `app\Http\Middleware\RequireApiJwt.php`, `app\Http\Kernel.php:44,51`
**Function/Method:** `RequireApiJwt::isProtected`
**Problem:** The new guard protects only the listed `api/*` patterns (`lms-homework/*`, `lms-assignment/*`, `exam-evaluation/*`, `question-paper/*`, `get-*`, ...). Of the routes in this report it does **not** cover `petty-cash*`, `front-desk*`, `complaints*`, `front-desk/photo-video-gallery*`, `student-care/*`, `migration-modules/*`, `import/*` (has `api.session`), `whats-send-app`, `whats-comming-app`, `incoming-message`, `update-message`, `crm-whatsapp*` (explicitly public with `TODO(V1.1)`), and the web-route holes (INT-01..06, INT-20). The guard is off if `API_GUARD_ENFORCE=false`, and lives only in the working tree.
**Impact:** The hardening gives false assurance for uploads/notifications.
**Recommended Fix:** Invert to deny-by-default for `api/*` with an explicit public allow-list; add the patterns above; commit with tests.
**Verification:** `ApiGuardTest` extended with these paths.

## INT-37
**Severity:** Low   **Type:** Improvement
**Category:** DevOps
**Module:** Legacy / one-off commands
**Location:** `app/Console/Commands/cnsports/*` (12 commands `next:fees_*`, `next:academic_year`, `next:house_master`, `next:student_enrollment` with hard-coded `sub_institute_id=257`, years 2023/2024), `TestFunction.php` (`test`), `TestFunction1.php` (`test:function`, 28 O*NET literals), 15 copy-pasted `SyncONet*` commands, `SyncWPDeliveryStatus`
**Problem:** One-off tenant migrations, test commands and duplicated sync code ship in production; several mutate fee data using `updateOrInsert` with hard-coded ids.
**Impact:** Accidental re-execution; secret duplication (INT-18).
**Recommended Fix:** Remove or move to `database/scripts`, consolidate O*NET sync into one parameterised command.
**Verification:** `php artisan list` shows no `test`, `next:*`.

## INT-38
**Severity:** Low   **Type:** Confirmed
**Category:** Security
**Module:** Diagnostic route
**Location:** `D:\next_lms_erp\routes\web.php:146-148`
**Function/Method:** `/neo4j-test`
**Problem:** Anonymous route returns `Neo4jService::testConnection()`, which returns `$e->getMessage()` on failure (bolt URI/auth errors).
**Impact:** Infrastructure detail disclosure.
**Recommended Fix:** Remove or protect with an admin permission.
**Verification:** Route returns 404 for anonymous callers.

## INT-39
**Severity:** Info   **Type:** Improvement
**Category:** Other
**Module:** Good patterns already in the codebase (to reuse)
**Location:** `Services\Evaluation\ExamEvaluationStorage.php`, `Services\lms\H5P\H5PPackageArchive.php:152-176` (zip bomb/entry path guards), `Services\lms\Content\ContentUploadService.php`, `Services\MobilePage\MobilePageAssetUploadService.php`, `Rules\TaskManagement\SafeCsvFile.php`, `AuditLogController::csvSafe`, `AI\AiAssistanceTicketController@screenshot` (private disk, admin + tenant check, `no-store`), `TaskAttachmentVersionController@download`, `Services\Mcp\ReportSender` (preview + recipient-count confirmation, per-recipient queued mail), `BulkTaskController`/`GovernanceController` (per-row error reporting), `FeeAuditService::logCallbackReceived`.
**Problem/Recommendation:** These are the templates the 60 upload rows, 14 import paths and 22 senders should converge on; `app/Services/Uploads/` exists but is empty.
**Verification:** Number of inline `storeAs` sites trends to zero.

---

ISSUE COUNTS: C=5 H=16 M=15 L=2 I=1

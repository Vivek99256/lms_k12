# PART 06 - Fees / Finance / Operations audit (`part06-fees-finance-operations`, PREFIX `FIN`)

Auditor scope: `app/fees`, `app/Inventory`, `app/hostel`, `app/Transportation`, `app/library`, `app/inward_outward`,
`app/front_desk`, `app/Utility`, `app/bazar`, `app/dashboard` (module dashboards), `lib/fees|petty-cash|inventory|hostel|transport|library|inward|front-desk|visitor|utility`, `lib/table-export.ts`.
Backend traced in `D:\next_lms_erp` (read-only). All findings are static-analysis only; no server/DB was touched.
Method note: the money flows (regular fee collect, cancel, refund, other fees, online payment, reports, audit) were traced
personally end to end. Inventory / Transportation / Hostel / Library and Front-desk / Inward-outward / Utility / Bazar were traced by two
delegated sub-auditors; their evidence was folded in (see sections 2, 5, 10 and the "Source" tag on each issue).

Key backend facts established first (they drive most findings below):
* `App\Http\Middleware\SessionMiddleware` + `Concerns\HydratesLegacyApiSession` validates the bearer JWT and puts **tenant/user/profile from the token** into an in-memory session for `type=API`. `syear`/`term_id` are taken from the client.
* BUT many controllers then **re-read `sub_institute_id` (and `user_id`) from the request** (`$request->input('sub_institute_id')`, `$_REQUEST[...]`) and ignore the hydrated session (about 55 sites in `app/Http/Controllers/fees`, listed in FIN-05).
* `App\Http\Middleware\checkPermission` (alias `check_permissions`) only enforces rights when `Route::currentRouteName()` **exactly equals a `tblmenumaster.link`**. Menu links are route names of the *index* pages (e.g. `fees_config_master.index`, see `app/data/routeMapper.ts:885-898`). Resource sub-routes (`*.store`, `*.update`, `*.destroy`, `*.edit`) and every unnamed route therefore fall through with **no rights check** (`checkPermission.php:36-49`).
* `VerifyCsrfToken` excludes `fees/*` and `api/*`.
* `LogRouteMiddleware` normalises date fields with `strtotime` **only for non-API requests** (`LogRouteMiddleware.php:22,60-90`); the Next.js frontend always sends `type=API`, so those date inputs reach the raw-SQL concatenations unsanitised.
* The Next.js app has **no route gating** beyond "is logged in" (`app/components/ConditionalApp.tsx:45`), and no fees page checks `can_add/can_edit/can_delete` or profile name (grep of `app/fees`: zero hits outside `_lib` session readers and AI-stack screens).

---

## 1. Scope & coverage

| Area/dir | Files in scope | Read fully | Skimmed / grep-traced | Not reviewed | Notes |
|---|---|---|---|---|---|
| app/fees (pages, `_lib`, `_components`) | 85 | 9 (`_lib/fees-api.ts`, `collect/[studentId]/page.tsx`, `online-payment/[gateway]/page.tsx`, `online-fees-settings/page.tsx`, `_lib/fees-report-utils.ts` (90-260), `_lib/fees-screen-registry.tsx`, `reports/receipt-reprint/page.tsx`, `audit-trail/page.tsx`, `collect/page.tsx` 1-700) | 30 (`collect/page.tsx` rest, `cancel-refund/page.tsx` 150-350 & 690-840, `other_fees_collect/page.tsx` 225-330, `master/fees-breakoff`, the other `master/*`, `reports/*`, NACH x4, `circulars`, `map_year`, `update-fees-breakoff`, `online_fees_collect`, `other_fees_cancel`, `teacher-dues`, `dashboard`) via targeted grep/read of fetch/POST bodies | 46 (`ai-stack/**` 13 files ~5.6k lines, `intelligence/**` 6 files ~3.5k lines, `help-guide-support`, `communication`, `onboarding/workflow/scheduler/sop-task/operations/process-builder` thin wrappers, `_components/fees-charts.tsx`, `fees-ai-assist.tsx`) | AI-stack/intelligence are AI-config/analytics UIs not on a money path |
| app/api/fees/* (Next handlers, other agent owns) | 22 | 4 (`reports/_lib/fees-report-proxy.ts`, `dashboard/summary/route.ts`, `online-payment/[gateway]/route.ts`, thin route wrappers) | 18 one-liner wrappers | 0 | read only to trace flow |
| app/dashboard (fees/hostel/library/transport dashboards) | 11 | 3 (`page.tsx`, `resolveDashboardRole.ts`, `dashboard-api.ts` head) | 8 | 0 | |
| lib/fees, petty-cash, inventory, hostel, transport, library, inward, front-desk, visitor, utility | 10 | 1 (`fees-ai-stack.ts` outline) | 9 (each is an *AI-stack registry*, not business logic) | 0 | `lib/petty-cash` is only an AI-stack registry - no petty-cash module exists in the frontend (see section 2) |
| lib/table-export.ts | 1 | 1 | 0 | 0 | |
| app/Inventory (33) | 33 | 33 (sub-audit A: api.ts, configs.ts, all components/pages, ai-stack) | 0 | 0 | delegated; INV-01 route shadowing reproduced with a router replica |
| app/Transportation (21) | 21 | 10 (api.ts, configs.ts, TransportationPage, student_transport_mapping, add_transport_rate, dashboard) | 11 (ai-stack, intelligence, wrappers) | 0 | delegated |
| app/hostel (38) | 38 | 33 (api.ts, setup-api.ts, configs.ts, HostelModulePage, VisitorModulePage, wrappers) | 2 (dashboard page/api partial) | 3 (hostel-dashboard.tsx, ai-stack screens, intelligence) | delegated |
| app/library (17) | 17 | 5 (library-module-utils, quick_return, scan_book, add_book_remark, book_resources) | 9 (reports, print_barcode, dashboard) | 3 (ai-stack, intelligence) | delegated |
| app/front_desk (25) | 25 | 9 (`_lib/api,modules,reports`, `ModuleWorkbench`, `GalleryAlbums`, `create-timetable/api`, thin pages) | 3 (create-timetable page partial, classwise api) | 13 (ai-stack screens) | delegated |
| app/inward_outward (15) | 15 | 9 (`_lib/api`, `types`, `RegisterPage`, `ReportPage`, wrappers) | 1 (`MasterPage` grep) | 5 (`shared.tsx`, ai-stack) | delegated |
| app/Utility (21) | 21 | 12 (`_lib/*`, `page.tsx`, all `api.ts`, rollover page) | 5 (breakoff, student-transfer, transfer-student, update-all-data, custom-module pages partial) | 4 (`ClassFilters`, ai-stack, rest of custom-module page) | delegated |
| app/bazar (3) | 3 | 3 | 0 | 0 | delegated; report component `MigrationModulePage` not read |
| Laravel (traced, read-only) | - | `fees_collect_controller.php` (60-1220, 1637-1880, 2002-2040, 2277-2400, 2996-3190, 3285-3400), `feesCancelController.php` (all), `feesRefundController.php` (300-670), `online_fees/*` (payment API, settings, reprint, audit, reconciliation, razorpay/hdfc/icici/axis/aggre/payphi handlers), `feesDefaulterReportController.php`, `FeesDashboardApiController.php`, `FeesRefundApiController.php`, `TeacherFeeDuesApiController.php`, `HostelDashboardApiController.php`, `LibraryDashboardApiController.php`, `AJAXController.php` (receipt reprint & mobile lookup), `checkPermission.php`, `SessionMiddleware.php`, `HydratesLegacyApiSession.php`, `VerifyCsrfToken.php`, `LogRouteMiddleware.php`, `routes/fees.php`, `routes/api.php` (fees/dashboards) | grep of all other fees controllers for tenant source and raw SQL | - | |

Totals (scope): 380 frontend files in the requested dirs (+22 Next handlers read for tracing). Read fully or in the money-critical parts: about 30. Grep/skim-traced: about 70 in fees + delegated modules. Not reviewed: about 50 (AI-stack / intelligence / help screens).
Unreviewed on purpose: `app/fees/ai-stack/**`, `app/fees/intelligence/**`, `app/fees/help-guide-support/**`, `_components/fees-charts.tsx` (charts only).

---

## 2. Module inventory (your scope)

Menu note: the Laravel menu tree (`tblmenumaster.link` = route name, e.g. `fees_collect.index`) is served by `/api/menu-rights`; specific rows were NOT VERIFIED (no DB access). Frontend paths below are the resolved pages.

| Module | Backend (Laravel controller / route) | Frontend pages/components | DB tables (traced) | API endpoints | Permissions / roles | Menu entry | Status |
|---|---|---|---|---|---|---|---|
| Fee collection (regular) | `fees_collect_controller` `show_student`, `edit`, `store`->`pay_fees` (`routes/fees.php:119,176`) | `app/fees/collect/page.tsx`, `collect/[studentId]/page.tsx` | `fees_collect`, `fees_receipt`, `fees_breackoff`, `fees_title`, `fees_receipt_book_master`, `fees_config_master`, `student_quota`, `tblstudent(_enrollment)` | POST `/fees/fees_collect/show_student`, GET `/fees/fees_collect/{id}/edit`, POST `/fees/fees_collect` | route-name rights only (bypassed for `.store/.edit`); no FE gating | `fees_collect.index` | **Partially complete**: discount and fine typed in the UI are dropped by the server (FIN-06); late-fee automation dead (FIN-22) |
| Fee cancel | `feesCancelController` (`routes/fees.php:188`, `routes/api.php:544`) | `app/fees/cancel-refund/page.tsx` (cancel tab) | `fees_collect.is_deleted/is_waved`, `fees_paid_other.is_deleted`, `fees_cancel` | POST `/api/fees-cancel/search`, POST `/fees/fees_cancel` | none FE; BE trusts client tenant/user (FIN-04) | `fees_cancel.index` | **Broken security** (cross-tenant), functional otherwise |
| Fee refund | `FeesRefundApiController` -> `feesRefundController` (`routes/api.php:164-168`) | `cancel-refund/page.tsx` (`RefundWorkflow`) | `fees_refund`, `fees_collect` | POST `/api/fees-refund/search|detail/{id}|save` | BE `denyUnlessAllowed` (admin names or menu link `fees_refund`) - only place with explicit role gate | `fees_refund.index` | Mostly complete; over-refund possible (FIN-09); refund receipt never shown |
| Other fees collect / cancel / titles / mapping | `other_fees_collect_controller`, `other_fees_cancel_controller`, `other_fees_title_controller`, `other_fee_map_controller` | `other_fees_collect`, `other_fees_cancel`, `master/other-fees-title`, `master/additional-fees-mapping` | `fees_other_collection`, `fees_paid_other`, `fees_title`, `fees_breakoff_other` | via `/api/proxy?path=fees/other_fees_*` and direct `/fees/other_fee_map` | none | `other_fees_*.index` | Mostly complete; amounts wholly client-defined (FIN-15) |
| Online fee collection (Next flow) | `online_fees_payment_api_controller` (`initiate`, `preview`), gateway handlers in `online_fees_collect_controller` | `online_fees_collect/page.tsx`, `online-payment/[gateway]/page.tsx`, `app/api/fees/online-payment/[gateway]/route.ts` | `fees_payment`, `fees_online_maping`, `fees_razorpay`, `fees_hdffc`, `fees_icici`, `fees_axis`, `fees_aggre_pay`, `fees_payphi` | GET `/fees/online_fees_payment_api/{gw}/preview`, POST `/fees/online_fees_payment_api/{gw}` (+ public gateway callbacks) | JWT only | `online_fees_collect.index` | **Broken**: only Razorpay creates an order, and no payment-confirmation call exists (FIN-07); 4 gateway callbacks forgeable (FIN-01) |
| Online payment settings | `online_fees_settigs_controller` (`online_fees_settings_api` resource) | `online-fees-settings/page.tsx` | `fees_online_maping` + per-gateway tables (plaintext secrets) | GET/POST/DELETE via `/api/proxy?path=fees/online_fees_settings_api` | none | `online_fees.index` | Complete UI; no role gate (FIN-16) |
| Fee structure / masters | `fees_breackoff_controller`, `tblfeesConfigController`, `tblfeesLateController`, `feesReceiptBookMasterController`, `fees_title_controller`, `feesMonthHeadercontroller`, `update_fees_breackoff_*`, `map_year_controller` | `master/*`, `update-fees-breakoff`, `map_year` | `fees_breackoff`, `fees_config_master`, `fees_late_master`, `fees_receipt_book_master`, `fees_title`, `map_year` | direct `/fees/...` | none FE; BE tenant from request in most (FIN-05) | `fees_*_master.index` | Mostly complete |
| Fee reports | `fees_report/*` (collection, defaulter, cancel, structure, type-wise, datewise, other-fees, student breakoff) | `reports/*` + Next proxies `app/api/fees/reports/*` | `fees_collect`, `fees_paid_other`, `fees_cancel`, `fees_breackoff` | POST/GET `/api/fees/reports/*` -> `/fees/*_report` | none FE; BE tenant from request (FIN-05), raw SQL (FIN-03) | `fees_*_report.index` | Mostly complete |
| Receipt reprint / audit logs / online payments / reconciliation | `receipt_reprint_api_controller`, `fees_audit_log_api_controller`, `online_payments_api_controller`, `reconciliation_status_api_controller` | `reports/receipt-reprint`, `reports/audit-logs`, `reports/online-payments`, `reports/reconciliation-status` | `system_audit_logs`, `fees_payment` | GET `/fees/receipt/reprint`, `/fees/audit_logs`, `/fees/online_payments[/id]`, `/fees/reconciliation/status` | none; **no tenant scoping** (FIN-11) | (report menus) | Complete but unsafe |
| NACH bank mandate export/import | `NACH/s1..s4` controllers | `NACH_s1..s4` pages | `tblstudent_bank_detail`, `NACH_MASTER`, `S2_LOG` | direct `/fees/NACH_*` | none | fees transactional | Complete; PII + raw SQL (FIN-03/FIN-05) |
| Fee circulars | `feesCircular*Controller` | `circulars`, `master/fees-circular-master` | `fees_circular_log` | `/api/fees-circular/*` | `check_permissions` (route unnamed => none) | | Mostly complete (page 1252 lines, skimmed) |
| Fees dashboard / teacher dues | `FeesDashboardApiController`, `TeacherFeeDuesApiController` | `fees/dashboard`, `collect` KPI cards, `teacher-dues`, `app/dashboard/AdminDashboard.tsx` | `fees_breackoff`, `fees_collect` | POST `/api/fees-dashboard/summary|defaulters`, `/api/teacher-fee-dues/summary` | teacher dues: profile check ok; dashboard summary: none + client tenant (FIN-05) | fees dashboard | Complete |
| Backend fee modules with **no Next.js UI** | `cheque_cash`, `cheque_reconciliation`, `bank_master`, `fees_modification`, `tally_export_fees_report`, `daily_voucher`, `fees_payout_report`, `fees_monthly_report`, `fees_status_report` (+ SMS reminder), `fees_overall_*`, `fees_fine_discount_report`, `institute_wise_fees_paid_report`, `imprest_fees_cancel`, `imprest_refund_report`, `college_fees_collect`, `online_fees_split`, `confirm_online_fees`, `monthly_breakoff`, `monthwise receipt pdf`, `fees_donation_records`, `fees_refund_report` | none (grep of `app`, `lib`, `components`: 0 hits for these names) | many | routes exist in `routes/fees.php` | - | menu rows may exist -> would resolve to missing pages (NOT VERIFIED) | **Backend-without-UI** (in particular cheque bounce handling and reconciliation confirm are unreachable from the new UI) |
| Module dashboards (library, hostel, transport, admissions, students) | `LibraryDashboardApiController`, `HostelDashboardApiController`, `TransportationDashboardApiController`, ... | `app/library/dashboard`, `app/hostel/dashboard`, `app/Transportation/dashboard` | | POST `/api/{library,hostel,transportation}-dashboard/summary` | **no auth middleware at all** (FIN-13) | | Complete but unauthenticated |
| Petty cash | `PettyCashApiController` (`routes/api.php:820-829`, JWT-validity only, tenant/user from request) + Blade controllers `frontdesk/PettyCash*` | frontend EXISTS outside the listed dirs: `app/admin-services/petty-cash`, `petty-cash-master`, `petty-cash-report`, `_lib/pettyCash.ts`; `lib/petty-cash/` holds only the AI-stack registry | `petty_cash`, `petty_cash_master` | `api/petty-cash*` | none beyond JWT | (admin-services) | **Partially complete**; only the API controller was skimmed by sub-audit B, balance calculation NOT VERIFIED (FIN-85) |
| Inventory | `InventoryApiController` (`routes/api.php:482-488`, in-controller JWT + rights) | `app/Inventory/*` (InventoryPage config components, RequisitionForm, RequisitionApproval, ItemQuotation, GeneratePo, NegotiatePo, item_receivable, ItemDirectPurchase) | `inventory_requisition_details`, `inventory_item_quotation_details`, `inventory_generate_po_details`, `inventory_negotiate_po_details`, `inventory_item_receivable_details`, `inventory_item_master` | `api/inventory/{module}[/{id}]` | rights by legacy menu link (admin names bypass) | legacy `*.index` links | **Partially complete**: receive step unreachable (FIN-45), no stock ledger (FIN-46); Item Lost pages **Missing** |
| Transportation | `TransportationApiController` (`api/transportation-setup/*`), legacy `map_student_controller` (`routes/tranceport.php`) | `app/Transportation/*` | `transport_map_student`, `transport_school_shift`, `transport_kilometer_rate` | `api/transportation-setup/*`, `/map_student/fetchData` | JWT in-controller; several legacy routes unauthenticated | `map_student.index` etc. | **Partially complete** (FIN-56/57/58); `transportation` page is an alias of vehicles; send_late_sms Missing |
| Hostel | `HostelSetupApiController` (`api/hostel-setup/*`, `api.session`), `HostelDashboardApiController` | `app/hostel/*` (25+ wrapper dirs, 12 duplicate hyphen/underscore pairs) | `hostel_room_allocation`, `hostel_room_master` | `/api/proxy?path=hostel-setup/*` | JWT bound in-controller (positive control) | `hostel_*` | **Broken** for allocation (FIN-53); no capacity/fee link (FIN-54) |
| Library | legacy web controllers `BookController`, `itemScanController`, `LibraryReportController`, `LostandDamage` (`routes/web.php:579-611`) | `app/library/*` | `library_books`, `library_items`, `library_book_circulations`, `item_scan_details` | `/api/proxy?path=books|scan_books|library_report...` | `session` + route-name rights (bypass FIN-14/41) | `books.index` etc. | **Partially complete**: no issue/return circulation UI, no fines (FIN-59/61) |
| Front desk (gallery, circular, calendar, exam schedule, parent communication, leave, timetable) | `PhotoVideoGallaryApiController`, `circularController`, `calendar_api_controller`, `exam_scheduleController`, `timetableController::*Api` | `app/front_desk/*` | gallery/circular/calendar/timetable tables | `api/front-desk/photo-video-gallery`, `front_desk/*`, `calendar/*`, `school_setup/ajax_*Timetable*` | JWT-validity only; client tenant (FIN-76) | `front_desk/*` | **Partially complete** (list/create only for most) |
| Visitor / gate pass | `visitor_masterController`, `adminapiController::get_adminVisitorListAPI` | `app/hostel/_components/VisitorModulePage.tsx` (+ `app/admin-services/visitor*`, not audited) | `visitor_master`, `visitor_type` | `add_visitorAPI`, `get_adminVisitorListAPI`, `get_visitorTypeAPI` | none / tenant from request | hostel visitor menus | **Partially complete + unsafe** (FIN-39/40/66-68); OTP pickup backend-only |
| Inward / Outward | `inwardController`, `outwardController`, `place_masterController`, `physical_file_locationController` | `app/inward_outward/*` | `inward`, `outward`, `place_master` | `inward_outward/add_*` | route-name rights; client tenant | `add_inward.index` etc. | **Broken/likely broken**: add, numbering, delete (FIN-78/79) |
| Utility (rollover, breakoff rollover, student transfer, promote, update-all-data, custom-module) | `rollOverController`, `studentTransferController`, `transferStudentController`, `studentBulkUpdateController`, `CustomModuleController` | `app/Utility/*` | enrolment, fees_*, custom tables | `student/rollover*`, `student/student_transfer*`, `student/student_bulk_update`, `custom-module/*` | mostly none effective (FIN-70) | `rollover.index` etc. | **Partial and dangerous** (FIN-64..74, FIN-81) |
| Bazar bulk upload | `MigrationModulesApiController` | `app/bazar/*` | `sharebazar_position/_margin/_pnl` | `api/migration-modules/bazar-*` | JWT-validity only | bazar menus | **Partial** (FIN-82) |

Duplicate/alias notes: `app/hostel/*` has 12 hyphen/underscore duplicate page dirs (`app/data/routeMapper.ts:238-263`); `app/Transportation/transportation` aliases the vehicles config; `HostelGapPage` is dead code; inventory route `add_vendor_master_setup` points at a non-existent controller class (`routes/inventory.php:60`, sub-audit A). Backend-without-UI: inventory Item Lost / Lost report, transport `send_late_sms`, library issue/return/item modal/`item_verification_status`, visitor pickup OTP flow, gate pass, enquiry, `timetableAI*`, `add_cast`, `dicipline-Master`, `face_attendance`, `add_implementation`.

Inventory page -> API (all `api/inventory/...`): requisition_form -> `requisitions`; requisition_form_approved -> `requisition-approvals`; item_quotation -> `quotations`; generate_po -> `purchase-orders`; negotiate_po -> `purchase-order-negotiations`; item_receivable -> `receivables`, `receivables/items` (shadowed), `receivables/multiple` (shadowed); item_direct_purchase -> `direct-purchases`; inventory_allocation -> `allocations`; inventory_return -> `returns`; inventory_defective -> `defectives`; masters -> `master-setups, item-categories, item-sub-categories, items, taxes, vendors`; reports -> `reports/*`. Transport: drivers, vehicles, routes, stops, shifts, route-buses, route-stops, rates, student-mappings (+bulk, bulk-delete), van reports (`api/transportation-setup/*`). Library page -> legacy route: book_resources -> `books`; quick_return -> `quick_return`; scan_book -> `scan_books`; add_book_remark -> `scan_books_remarks[/store]`; report -> `library_report`/`show_library_report`; issue_overdue_report -> `book_issue_report`; print_barcode -> `print_barcode`/`generateBarcodePdf`; lost_damage_report -> `Lost_and_Damage`; scanned/pending reports -> `verified_book_report[_pending]`.

---

## 3. Role / access-control findings (frontend gating vs backend enforcement)

| Module | Frontend gating | Backend enforcement | Verdict |
|---|---|---|---|
| Whole app | `ConditionalApp.tsx:45` only checks `isAuthenticated`; sidebar hides menus by rights but direct URL works | n/a | client-side hiding only |
| Fee collect (`/fees/collect*`) | none | `check_permissions` skipped for `fees_collect.store/edit` (route name is not a menu link); `show_student` named `fees_collect.show_student` likewise | any authenticated JWT (student/teacher/parent) can call collect endpoints if menu rows do not exist for these route names (NOT VERIFIED - DB). Discount / back-date / fine have no role gate anywhere |
| Fee cancel | none; no confirm dialog (`cancel-refund/page.tsx:242-315`) | `feesCancelController::store` validates the JWT but reads tenant/user/syear from request (`feesCancelController.php:256-260`) | authorisation absent; tenant spoofable |
| Refund | none | `FeesRefundApiController::denyUnlessAllowed` (`FeesRefundApiController.php:15-28`): allows names `super admin/admin/school admin`, else menu rights for link `fees_refund` / `fees/fees_refund` (real links are route names such as `fees_refund.index`) so non-admin roles with granted rights are probably denied - functional bug, secure default | only correctly gated money action |
| Online payment settings | none | resource routes, name `online_fees_settings_api.store` => no menu => no rights check | any staff/parent JWT can add/delete gateway merchant credentials (redirecting settlements) |
| Fee structure masters (config/late/receipt book/breakoff/title) | none | as above + tenant from request | same |
| Reports (collection/defaulter/cancel/structure) | none | tenant from request; rights by index route only | same |
| Audit logs / online payments / reconciliation | none | no rights check, no tenant scope | any JWT sees every tenant |
| Module dashboards (library, hostel, transport, admissions, students) | dashboard role resolver falls back to `admin` for unknown profiles (`resolveDashboardRole.ts:20-21`) | **no middleware** (`routes/api.php:140-144`) | unauthenticated |
| Teacher fee dues | profile check in BE | teacher only, class scoping = cross product of standard x division (FIN-29) | over-exposure within tenant |
| Inventory / Transportation / Hostel (API controllers) | hostel hides add/edit/delete using server `permissions`; inventory/transport pages ungated | In-controller `guard()`/`context()` bind actor + tenant to the JWT and check rights by legacy menu link (admin names bypass; deny by default when link missing) - best-enforced modules; `syear` client-supplied (FIN-44); no maker-checker in inventory (FIN-48) | server-side good, functional gaps |
| Library | delete gated only by `userProfileName.toUpperCase()==='ADMIN'` (`book_resources/page.tsx:696`) | web routes `session` + route-name `check_permissions`; `submit=Search` bypass (FIN-41); IDOR (FIN-60) | weak |
| Visitor / front desk / inward / utility / custom-module / bazar | none (`window.confirm` only, 15 sites) | mutators have different route names than menu links, custom-module and front-desk groups have no `check_permissions`, visitor create is public | effectively open (FIN-39, 66, 70, 76, 81, 82) |

---

## 4. Tenant / school / academic-year scoping findings

* Frontend always sends `sub_institute_id`, `syear`, `user_id`, `term_id`, `user_profile_id`, `user_profile_name`, `client_id` in the body **and, for GET report calls, in the URL together with the bearer `token`** (`app/fees/_lib/fees-api.ts:186-196`, `app/api/fees/reports/_lib/fees-report-proxy.ts:46-56,59-67`). Values are read from `localStorage`/`sessionStorage` (`fees-api.ts:64-169`) - any XSS or extension can change them.
* Laravel side, JWT-hydrated tenant is **correctly used** by: `fees_collect_controller::show_student/pay_fees/edit/getBk` (session), `feesRefundController` (session), `FeesRefundApiController`, `TeacherFeeDuesApiController`, `RoleDashboardApiController`.
* Laravel side, client-supplied tenant **overrides** the JWT in ~55 places (grep result, `app/Http/Controllers/fees`): `feesCancelController.php:96,258`, `fees_collect_controller.php:2026,3292` (`studentFeesDetailAPI` even `session()->put('sub_institute_id', <client>)`), `feesDefaulterReportController.php:32,60`, `feesReportController.php:68,144,327,570`, `feesModificationController.php:62,264`, `feesStructureReportController.php:51`, `feesTypewiseReportController.php:31,68`, `otherNewfeesReportController.php:33,61`, `otherNew_CancelFeesReportController.php:32,60`, `studentBreakoffReportController.php:35,70`, `monthwiseReceiptPdfController.php:35`, `NACH/s1,s3,s4` (six sites), `other_fees_collect_controller.php:26,54,161`, `other_fees_cancel_controller.php:35,64,164`, `other_fees_title_controller.php:39,56,72,120,141`, `other_fee_map_controller.php:23`, `tblfeesConfigController.php:26,66,112,137,173,188`, `tblfeesLateController.php:77,144,266,333,404`, `feesReceiptBookMasterController.php:24`, `fees_breackoff_controller.php:24`, `feesMonthHeadercontroller.php:30,129`, `confirmOnlineFeesController.php:40,144,260`, `online_fees_collect_controller.php:549 (?? 76),2506`, `AJAXController::ajax_PDF_FeesReceipt` (`AJAXController.php:1802-1804`), `FeesDashboardApiController::summary`.
* Never scoped at all: `fees_audit_log_api_controller::index` (tenant filter only if client passes one; `module` also client-chosen), `online_payments_api_controller::index/show`, `reconciliation_status_api_controller::index`, `fees_online_maping`-less `get_fees` (student lookup by id only, `online_fees_collect_controller.php:58-68`), `createRazorpayOrder` student lookup (`online_fees_payment_api_controller.php:56-63`), `getStudentFromMobile` (mobile -> student ids across every tenant, `AJAXController.php:1345-1364`).
* Hard-coded per-tenant business rules in fee maths: `sub_institute_id` 254, 48, 61, 76, 47, 49, 200, 257, 253 (`fees_collect_controller.php:258,266,1154,1191,2348,3105,3109`, `feesCancelController.php:135`, `feesReportController.php:259`, `online_fees_collect_controller.php:92,321,549`). `hdfc_response_handler` decrypts every tenant's callback with tenant **76**'s working key (`online_fees_collect_controller.php:320-323`).
* `syear` is client-controlled everywhere (also by design "year switcher"). `pay_fees` accepts any past/future `syear` (`fees_collect_controller.php:403`) and any `receiptdate` (`:793`): back-dated receipts and payments into closed years are possible; no period-lock exists in the code read.

Operations modules (sub-audits A and B): tenant is validated against the JWT in `InventoryApiController`, `TransportationApiController`, `HostelSetupApiController`, `ClassTeacherApiController` (`:73-77`) and the timetable `*Api` methods (session). It is taken from the request in: `BookController::show/allBookLists/store-edit`, `itemScanController` (all actions), the library/hostel/transportation dashboards (unauthenticated), `map_student/fetchData`, `visitor_masterController` (all), `adminapiController::get_adminVisitorListAPI`, `PhotoVideoGallaryApiController`, `calendar_api_controller`, `circularController`, `CircularReportController`, `parentCommunicationController`, `exam_scheduleController` (destroy unscoped), `FrontDeskApiController`, `PettyCashApiController`, `inwardController`/`outwardController`/`place_masterController`, `CustomModuleController`/`DynamicModel` (global table names), `MigrationModulesApiController` (bazar: no tenant column), `studentTransferController` (`to_sub_institute_id`). `syear` is client-controlled in every module (`HydratesLegacyApiSession`), so rollover/bulk operations can target any year (FIN-83).

---

## 5. API endpoints consumed or exposed

Fees / finance (money flows). Auth column: **JWT** = `session`/`api.session` middleware validated the bearer token; **rights** = `check_permissions` (route-name based, see top of file); **-** = none.

| Method | URL (Laravel) | Called from | Auth | Validation | Notes |
|---|---|---|---|---|---|
| POST | `/fees/fees_collect/show_student` | `collect/page.tsx:209,320` (twice per search) | JWT + rights(`fees_collect.show_student` likely unmatched) | none | runs `getBk` per student (N+1), unpaginated server side |
| GET | `/fees/fees_collect/{id}/edit` | `collect/page.tsx:421`, `[studentId]:291` | JWT + rights(unmatched) | none | returns student PII + dues + bank list |
| POST | `/fees/fees_collect` | `[studentId]:519` | JWT + rights(unmatched) | none (uses `$_REQUEST`) | FIN-06/08/10/15 |
| GET | `/fees/fees_collect/{id}/ledger` | (no caller found) | JWT | none | backend-without-UI |
| POST | `/api/fees-cancel/search` | `cancel-refund:198` | api.session + rights | none | tenant from body (FIN-04) |
| POST | `/fees/fees_cancel` | `cancel-refund:286` | JWT + rights(unmatched) | required-only | tenant+user from body (FIN-04) |
| POST | `/api/fees-refund/search`, `/detail/{id}`, `/save` | `cancel-refund:747-774` | api.session + explicit gate | per-head cap | FIN-09 |
| POST | `/fees/other_fees_collect` | via `/api/proxy` | JWT | none | FIN-15 |
| POST/DELETE | `/fees/other_fees_cancel` | via `/api/proxy` | JWT | none | FIN-20 |
| GET | `/fees/online_fees_payment_api/{gw}/preview` | `online-payment/[gateway]:110` via proxy | api.session | student id only | FIN-12 IDOR |
| POST | `/fees/online_fees_payment_api/{gw}` | `app/api/fees/online-payment/[gateway]/route.ts` | api.session | Razorpay only meaningful | FIN-07 |
| POST | `/fees/razorpay|hdfc|axis|aggre_pay|icici|payphi|hdfcrazorpay|icici_orange/...RequestHandler|ResponseHandler` | gateway browser redirects | **- (public)** | signature only for Razorpay | FIN-01 |
| POST | `/fees/get_online_receipt` | mobile app | **- (public)** | opaque token | FIN-02 |
| POST | `/studentFeesDetailAPI` | mobile app | JWT | none | FIN-02/12 |
| GET | `/fees/hdfc/getUTR`, `/fees/hdfc/createSplitPayout` | (cron/manual) | **- (public)** | none | FIN-16 |
| GET | `/fees/receipt/reprint` | `receipt-reprint` page | api.session | requires ids | SQLi + cross-tenant (FIN-03/17) |
| GET | `/fees/audit_logs` | `reports/audit-logs` | api.session | none | FIN-11 |
| GET | `/fees/online_payments`, `/{id}`, `/fees/reconciliation/status` | reports | api.session | none | FIN-11 |
| POST | `/fees/fees_defaulter_report` and 12 other report POSTs/GETs | `fees-report-utils.ts` via Next proxies | JWT | none | FIN-03/05 |
| POST | `/api/fees-dashboard/summary`, `/defaulters` | `fees-dashboard-api.ts`, `collect/page.tsx:228` | api.session | `required` only | FIN-05 |
| POST | `/api/{library,hostel,transportation,admissions,students}-dashboard/summary` | module dashboards | **-** | `required` only | FIN-13 |
| GET/POST/DELETE | `/fees/online_fees_settings_api` | `online-fees-settings` via proxy | api.session | client-side only | FIN-16 |
| GET/POST | `/fees/fees_config_master`, `fees_late_master`, `fees_receipt_book_master`, `fees_title`, `fees_breackoff`, `update_fees_breackoff(_api)`, `map_year`, `other_fee_map`, `NACH_*` | master pages | JWT + rights(index only) | mostly none | FIN-05/14 |

Operations (sub-audits A and B; Auth: J = JWT via `session`/`api.session` with token tenant, Jv = `jwtToken()->validate()` only with tenant from request, None = no auth):

| Method | URL | Auth | Notes |
|---|---|---|---|
| GET/POST/PUT/DELETE | `/api/inventory/{module}[/{id}]` (`routes/api.php:482-488`) | in-controller JWT + rights | `receivables/items`, `receivables/multiple` shadowed (FIN-45); `syear` client |
| GET/POST/PUT/DELETE | `/api/transportation-setup/{module}[/{id}]`, `student-mappings/bulk`, `bulk-delete` | in-controller JWT + rights | fare trusted (FIN-56) |
| GET/POST/PUT/DELETE | `/api/hostel-setup/{module}[/{id}]` (`routes/api_hostel.php`) | `api.session` + in-controller | allocation POST 403 (FIN-53) |
| POST | `/api/{library,hostel,transportation,admissions,students}-dashboard/summary` | **None** | FIN-13 |
| POST | `/add_visitorAPI` (`teacherapi.php:87`), `/visitor_management/add_visitor_master` | **None** | FIN-39/66 |
| POST | `/get_adminVisitorListAPI`, `/get_visitorTypeAPI`, `/get_visitorAPI` | Jv | FIN-40 |
| GET/POST | `/visitor_management/sendOtpVisitor`, `confirmOtp`, `get_student` | J | OTP echoed (FIN-67) |
| GET | `/map_student/fetchData` (`tranceport.php:38`) | **None** | FIN-57 |
| DELETE/GET | `/map_student/bulk-delete`; `api/get-bus-list`, `api/get-stop-list`, `transportationLists/studentLists/{t_id}/{t_s_id}` | web group only | FIN-58 |
| GET/POST/DELETE | `/books*`, `/quick_return`, `/check_issue`, `/check_item_availability`, `/all_book_lists`, `/scan_books*`, `/library_report`, `/show_library_report`, `/book_issue_report`, `/print_barcode`, `/generateBarcodePdf`, `/Lost_and_Damage*`, `/verified_book_report*` (`routes/web.php:579-611`) | `session` + route-name rights | FIN-59/60/62 |
| GET/POST | `/student/rollover[/create]`, `/student/student_transfer[...]`, `/student/show_student`, `/student/transfer_student`, `/student/student_bulk_update` | J + rights only if route name = menu link | FIN-69..74 |
| GET/POST/DELETE | `/custom-module/*` (11 routes); `GET /menuLevel2` | J, no rights (`menuLevel2` none) | FIN-64/65/81 |
| GET/POST | `/api/front-desk/photo-video-gallery[...]`, `/front_desk/circular[...]`, `/front_desk/exam_schedule`, `/calendar/calendar-api-*`, `/front_desk/parent_communication/create`, `/front_desk/leave_application/create` | Jv/J, client tenant | FIN-76 |
| POST | `/school_setup/ajax_getTimetable*`, `ajax_saveTimetableEntry`, `ajax_deleteTimetableEntry`, `ajax_getClasswiseTimetableApi`, `ajax_getFacultywiseTimetableApi` | `api.session` (tenant from session) | FIN-84 |
| resource | `/inward_outward/add_inward, add_outward, add_place_master, add_physical_file_location, show_*_report` | J + route-name rights, client tenant | FIN-78..80 |
| GET/POST | `/api/migration-modules/bazar-reports`, `bazar-upload`; `/api/petty-cash*` | Jv | FIN-82/85 |
| ANY | `/api/proxy?path=...`, `/api/proxy-file?path=...` (Next) | none at Next layer | FIN-43 |

---

## 6. Business-logic notes (Input -> Validation -> Rule -> DB change -> Side effect -> Output)

### 6.1 Regular fee collection (`fees_collect_controller::pay_fees`, `collect/[studentId]/page.tsx::saveCollection`)
* **Input**: per-head `fees_data[head]=amount`, `hid_fees_data` (ignored), `months[id]`, `total`, `totalDis`, `totalFin`, payment mode/bank fields, `receiptdate`, student identity fields (name, enrollment, father, roll, medium...), `send_sms`.
* **Client validation** (`saveCollection`, `:415-442`): at least one selected month with amount, per-particular amount <= due, mode/receipt date required, bank fields for non-cash. UI clamps amounts to `[0,due]` (`:394-409`) but `Discount`/`Fine` inputs only use `min="0"` HTML attribute (`:799-802`) and `readNumber` accepts negatives.
* **Server validation**: none (no `validate()`); only `if ($arr != 0)` (`fees_collect_controller.php:386-390`). Negative `fees_data` values pass and are inserted as-is (`:476-481` else-branch `insert_amount = fees_data`).
* **Rule**: per head, the amount is allocated across selected months in ascending order, capped at each month's *remaining* (`FeeBreakoffHeadWise`: `breakoff - sum(paid, is_deleted='N')`, `helper.php:1186-1205`); excess beyond total remaining is silently dropped (not an error). Discount is applied only from `discount_data[head]` or (`totalDis` **only if** `discount_data` is present, `:1006-1010`); fine only from `fine_data[head]` or `fees_data['fine']` (`:1081-1145`). `totalFin` is not read anywhere. Late fee auto-calculation is dead code (`:3018-3058`, `$config_late_fine` stays 0).
* **DB change**: `fees_collect` rows per (month, receipt-book) + `fees_paid_other` + one `fees_receipt` row inside `DB::transaction` (`:752-883`). `amount` decimal(10,0) per migration `2023_03_05_115658_create_fees_collect_table.php:35-37`; fine>0 forces `(int)` cast of amount (`:760-767`). Receipt number = `MAX(...)+1` computed **before** the transaction with no lock (`:633`, `gunrate_receipt_number` `:1151-1219`); `fees_receipt` has no unique key in its migration.
* **Side effects**: `AuditLog RECEIPT_GENERATED` + `PAYMENT_RECEIVED` (`:875,894`), receipt HTML built from raw `$_REQUEST` fields and stored in `fees_collect.fees_html` (`:1652-1820`), optional SMS. Client also fires `logFeesOperation('fee_collection', ...)` fire-and-forget (`[studentId]:537`).
* **Output**: JSON `{data: html, paper, css, receipt_id_html}`; page renders it with `dangerouslySetInnerHTML` and prints; on missing HTML it throws "saved, but receipt HTML not found" leaving the form re-submittable (`:556-561`).
* **Defects**: FIN-06 (discount/fine silently ignored), FIN-08 (duplicate receipt numbers / no idempotency), FIN-10 (identity from client, XSS), FIN-15 (negative/unbounded inputs), FIN-21 (rounding), FIN-22 (late fee), FIN-25 (UTC date).

### 6.2 Fee cancellation (`feesCancelController::store`)
* Input: receipt tokens `no####studentId`, cancel type/remark per receipt (regular only), `sub_institute_id`, `syear`, `user_id` from client.
* Validation: only "at least one receipt". No reason required server-side; no check that period is open; no role check.
* Rule/DB: regular -> insert `fees_cancel` audit row then `UPDATE fees_collect SET is_deleted='Y', is_waved=<cancel type>` (`:308-341`; column repurposed); other fees -> `UPDATE fees_paid_other SET is_deleted='Y'` and **the `fees_cancel` insert is commented out** (`:288`). No transaction. `fees_receipt` untouched, no `AuditLog::record` call.
* Output: "Fees Deleted Successfully" always (even when nothing matched).
* Defects: FIN-04, FIN-20.

### 6.3 Refund (`feesRefundController::saveFeesRefund`)
* Input per-head `refund_amount[head]`. Rule: `refund <= paid_for_title` where paid = sum of non-deleted `fees_collect` head columns (`:337-366`) - **prior refunds are not subtracted**. Receipt no `syear/(MAX+1)` unlocked (`:463-468`). Inserts `fees_refund` + `AuditLog fee_refund`. UI never shows the refund receipt (`payload.str` ignored, `cancel-refund/page.tsx:774-778`) and does not clear amounts after success => a second click refunds again. Defect FIN-09.

### 6.4 Online payment
* Razorpay (Next flow): preview (`get_fees`, any student id) -> `createRazorpayOrder` (client `pay_amount`, no dues check, no tenant check) -> `fees_payment(PR)` + `FeeAuditService::logOrderCreated`; browser opens Razorpay Checkout **without `handler`/`callback_url`** (`online-payment/[gateway]/page.tsx:61-70`); nothing calls `razorpay_response_handler` (signature-verifying) afterwards. The only other path is `razorpay_fetch_payment_status` (cron-style GET behind `session` middleware, `routes/web.php:541`; no scheduler entry found in `app/Console` -> **NOT VERIFIED** whether an external cron calls it). Where it does run it credits `fees_payment.amount/100` (server-recorded, good), but marks only `razorpay_dashboard_ps`, not `razorpay_payment_status`.
* Legacy gateways: ICICI/PayPhi/AggrePay callbacks trust unsigned POST/GET fields and credit `fees_payment.amount` (or POSTed `amount` for AggrePay/Axis); replay guard exists for hdfc/icici/payphi/razorpay ("prevent second time success", read-then-write, racy) but **not** for axis or aggre_pay. Defects: FIN-01, FIN-02, FIN-07, FIN-12, FIN-35.

### 6.5 Receipt reprint
GET `/fees/receipt/reprint?student_id&receipt_id_html&sub_institute_id&syear&action` -> `AJAXController::ajax_PDF_FeesReceipt`: deletes **every** file in `storage/print_receipt_pdf/*`, loads stored HTML via raw-SQL `RECEIPT_ID_n = '<input>'` (no `is_deleted` filter, tenant from request), renders PDF to `storage/print_receipt_pdf/<studentId>_<YmdHis>.pdf`, returns `https://<HTTP_HOST>/storage/...`; logs `RECEIPT_REPRINTED`. Defects FIN-03, FIN-17.

### 6.6 Defaulter report
`showFeesDefaulter`: enrolled students (tenant from request) -> `getBk()` **per student** (N+1) -> per month `bk/paid/discount/remain`; totals via `'-'` key. `first_name/last_name` concatenated into raw SQL (`:91-97`). Excludes `status != 1` students. Amount rules delegated to `getBk`; report is only as correct as `getBk` (which is patched with tenant-specific branches, `fees_collect_controller.php:258-278`). Defects FIN-03, FIN-05, FIN-24.

### 6.7 Operations flows (condensed from sub-audits A and B)

**Inventory requisition -> approval -> quotation -> PO -> negotiate -> receive -> issue**

| Step | Input | Validation | Rule | DB change | Side effect / Output |
|---|---|---|---|---|---|
| Requisition | `items[]`, number, requester | own-user unless admin, active-item allow-list, number == next (only when `items[]` present, FIN-49) | status 1 | `inventory_requisition_details` | none on stock |
| Approval | approvals[] | rights `requisition_approved.index`; no cap/status check (FIN-48) | `approved_qty`, status as sent | update approval columns | nothing reserved |
| Quotation | vendor, items | vendor/item in tenant | auto `approved_status=2` | insert | - |
| PO | vendor, items, price/discount/tax | numeric only; price not compared with quotation | totals recomputed | insert | not linked to requisition |
| Negotiate | po no., status | required only | status written to all lines | negotiate rows | re-editable after approval |
| Receive | po no., received qty | (route shadowed, FIN-45) | cumulative check, but row overwritten (FIN-50) | receipt row | no stock increment |
| Direct purchase | vendor, bill, items | required | amount recomputed | insert + `opening_stock += qty` | replayable (FIN-47) |
| Allocation / Return | requester, item, qty | approved requisition exists / cumulative return <= approved | none on stock | insert | no decrement / increment (FIN-46) |

**Hostel allotment**: grid row -> POST `hostel-setup/hostel-room-allocation` with `user_id` overwritten by the allocatee -> `context()` 403 (FIN-53); if it passed: only per-(user, group, syear, tenant) uniqueness, no capacity/bed/gender check (FIN-54) -> upsert `hostel_room_allocation` -> AuditLog -> message; no fee.

**Transport mapping**: selected grid rows (pickup/drop shift, vehicle, stop, distance, client-computed amount) -> ids exist in tenant, capacity on pickup vehicle only -> delete+insert per student -> `transport_map_student`; no fee/notification/audit (FIN-56).

**Library issue/return**: issue not in Next UI; legacy `books/issue` validates only student existence (FIN-59); quick return sets `return_date=now()` for the first open loan of `item_code`, no fine (FIN-61); return by id is an unscoped GET (FIN-60); lost/damaged via scan remarks flips `library_items.item_status` by bare `item_code` across tenants (FIN-60); copies count only grows (`no_of_items`), dashboard counts ignore soft-deleted books (FIN-62).

**Year rollover (`GET student/rollover/create?tables[]=...`)**: tables[] + client syear -> no server validation -> per table `INSERT..SELECT` next year if count==0, enrolment loop per active enrolment (skip if same-class row exists; silently skips unmapped `next_grade_id`), then the advance-fee block runs on every call (FIN-71) -> ~12 tables changed, no transaction/audit -> output status by an off-by-one counter (FIN-83).

**Breakoff delete** (`POST student_bulk_update {bk_month[]}`): archive to `fees_breackoff_logs` (section 0) then delete, no paid-fees check (FIN-71). **Student transfer**: FIN-73. **Promotion (`transfer_student`)**: FIN-72.

**Visitor / gate pass**: create (public, FIN-39) -> `visitor_master` + photo + welcome SMS; pickup: `getStudent` -> `sendOtpVisitor` (OTP stored on `tblstudent.otp`, echoed) -> `confirmOtp` inserts a pickup visit with immediate `out_time` (FIN-67); check-out only via Blade `update()`.

**Inward/outward numbering**: FE opens create -> BE computes max+1 in a Blade share (absent from JSON) -> FE submits empty number -> `store()` writes client value, no lock/unique (FIN-79). **Petty cash balance**: NOT VERIFIED (API controller only skimmed).

---

## 7. Test / documentation coverage for your scope

* Frontend: of the repo's 42 test files, only `lib/brain/fees-intelligence.test.ts` touches fees (AI intelligence), none cover `app/fees/**` money flows (`saveCollection` payload/maths, `toMonths`, cancel/refund, online payment). **Missing**.
* Laravel (`D:
ext_lms_erp	ests\Feature\Fees`): `CollectFeeTest` (partial/full payment lowers ledger, second student unaffected), `CollectFeeTransactionAtomicityTest` (crash rolls back rows, retry clean), `ReceiptGenerationTest` (sequential numbers in single-threaded runs), `GenerateFeeDemandTest`, `StudentFeeLedgerTest`. **Not covered**: discount/fine paths, negative amounts, concurrency/duplicate receipt numbers, cancel, refund, other fees, every gateway callback (signature/replay), tenant isolation, report SQL inputs. The sequential-number test passes precisely because it never races (FIN-08).
* Documentation: contract doc referenced by `app/api/fees/dashboard/summary/route.ts` (`next_lms_erp/docs/fees-api/fees-dashboard-contract.md`) - not opened. No documentation of the discount/fine field contract between the Next collect page and `pay_fees` (root cause of FIN-06).

Operations modules: no frontend tests in scope (none of the 42 test files touch inventory, hostel, transport, library, front-desk, inward, utility or bazar). Sub-audits did not search `D:\next_lms_erp\tests` for operations modules (NOT VERIFIED).

---

## 8. NOT VERIFIED items

1. Live DB: whether `tblmenumaster` has rows whose `link` equals `fees_collect.store`, `fees_cancel.store`, `fees_config_master.store`, etc. (decides how broad FIN-14 is). REASON: no DB access.
2. Live column types (`fees_collect.amount decimal(10,0)`, `cheque_no integer`, `receipt_no integer`) - migrations are known to drift from the real schema (memory note). REASON: migrations only; FIN-21/FIN-34 are Potential.
3. Whether an external scheduler calls `razorpay_fetch_payment_status` / `createSplitPayout` / `getUTR`. REASON: no `app/Console` entry, server cron not visible.
4. Whether ICICI/PayPhi/AggrePay gateways sign responses in a field this code ignores (ICICI eazypay sends `RS`/signature; PayPhi `secureHash`). REASON: gateway docs not consulted; code verifiably does not check.
5. Real merchant secrets: values of `NEXT_PUBLIC_API_BASE_URL_*`, `CCAVENUE_ACCESS_CODE`, `.env*`. REASON: env files not readable by rule.
6. Whether the SQL-injection sinks are exploitable given DB user privileges / WAF. REASON: static only; injection into a `WHERE` (and `UNION` for reprint) is proven from code.
7. The `menu` -> `/fees/...` resolution for menus whose Laravel link has no Next page (list in section 2). REASON: menu rows not readable.
8. `app/fees/circulars/page.tsx` (1252 lines), master pages, NACH pages: request bodies were grepped, business rules not fully read.

9. Operations items (from sub-audits): live `tblmenumaster` links for inventory/hostel/transport/library/utility routes (decides whether rights ever apply); `JWT_HEADER_ONLY` env (if true all Library pages that send `token` in query/body break); web-server PHP execution for `public/uploads/books`, `public/storage/*`, `public/visitor_photo`, `public/images`, `public_path('pettycash')` (RCE vs stored XSS); unique indexes on `transport_map_student`, `hostel_room_allocation`, `inventory_item_receivable_details`; live `library_items.item_status` semantics; inward/outward NOT NULL columns and `CAST(x AS INT)` acceptance; `tblstudent.password`/`otp` columns; `studentTransferController.php:212` array update (assumed fatal); Excel-HTML `.xls` formula evaluation; `intelligence`/`ai-stack` screens; legacy Blade controllers; petty-cash balance/report logic; `MigrationModulePage` (bazar report render); `app/admin-services/*` visitor/front-desk/petty-cash pages.

---

## 9. Second-pass results

Grep over the whole requested frontend scope (`.ts/.tsx`): `TODO|FIXME|HACK|XXX` = 0; `debugger` = 0; `eval(`/`new Function` = 0; `axios` = 0; `window.location` = 0.
`console.log` = 3 hits, all `app/fees/master/other-fees-title/page.tsx:255,256,383` (logs the full API response and the submit payload incl. `created_by`/`user_id`) - LOW (FIN-32).
`dangerouslySetInnerHTML` = 7 hits in 5 files: `fees/collect/[studentId]/page.tsx:669,898` (server receipt HTML), `fees/cancel-refund/page.tsx:815` (stored receipt HTML), `fees/circulars/page.tsx:857,859`, `fees/NACH_s4excel_import/page.tsx:167`, `fees/_components/fees-shared.tsx:235` - none sanitised (FIN-10).
`localStorage|sessionStorage` = 36 hits in 13 files: token, `sub_institute_id`, user profile and academic year read from storage (`fees-api.ts:64-169`, every collect/cancel page); `collect/page.tsx:436` caches the whole student fee payload (PII) in `sessionStorage` keyed by student id, removed on read.
`fetch(` = 98 call sites in 45 files (direct Laravel calls from browser: collect, cancel, refund, masters, NACH; via Next proxies: reports, dashboards, online payment; via generic `/api/proxy`: settings, other fees, map_year).
`sub_institute_id|subInstituteId` = 196 hits/57 files; `syear|academicYear` = 322/72; `user_profile*` = 32/9 (all only *sent*, never used for gating).
`new Date().toISOString().slice(0,10)` = 10 hits/6 files (UTC date used as local business date): `collect/[studentId]/page.tsx:139,253,1281`, `fees-api.ts:301`, `cancel-refund/page.tsx:769`, `library/issue_overdue_report/page.tsx:84-85`, `hostel/api.ts:202,219`, `inward_outward/_components/RegisterPage.tsx:14` (FIN-25).
`return []` = 34 hits (adapter default values; not stubs). Hard-coded URLs: `fees/help-guide-support/_components/help-guide-grid.tsx:30,43,69` (vendor help PDF/CRM/YouTube links, INFO), Razorpay checkout script, `front_desk/_lib/api.ts:161` (YouTube embed).
Laravel second pass (fees): raw-SQL string concatenation of request input = **76 occurrences in 23 files** (`grep` in `app/Http/Controllers/fees`); client-supplied `sub_institute_id` = ~55 sites; `$_REQUEST` used as the input source in `pay_fees`/receipt building; hard-coded tenant ids = 9 distinct; 2 hard-coded gateway secrets (redacted below).

Operations frontend (sub-audits): `TODO|FIXME` 0; `console.*` 0; `dangerouslySetInnerHTML` 0 (but `document.write` 9 and `window.open` 9 in `app/library/*` print helpers - FIN-63); `localStorage|sessionStorage` 4-5 direct hits (plus `lib/erp-client.ts` reads for every module); `window.confirm` 15 (Utility 12, inward/outward 2, front desk 1); `fetch(` 33 in inventory/transport/hostel/library and 7 in front desk/inward/bazar; hard-coded tenant ids: frontend 3 (`library/report/page.tsx` x2, `book_resources/page.tsx`), backend 47/254/49/232/233/76/48/61 etc.; `eslint-disable` 21 (react-hooks effects). Whole-scope figures at the head of this section already include these directories.

---

## 10. ISSUES

## FIN-01
**Severity:** Critical   **Type:** Confirmed
**Category:** Security
**Module:** Fees / Online payment gateways
**Location:** `D:\next_lms_erp\app\Http\Controllers\fees\online_fees\online_fees_collect_controller.php:1449-1499` (ICICI `icici_response_handler`), `:1713-1786` (ICICI Orange `icici_orange_response_handler`), `:3965-4026` (PayPhi `payphi_response_handler`), `:2215-2277` (AggrePay `aggre_pay_response_handler`), `:2026-2099` (Axis `axis_response_handler`); routes `D:\next_lms_erp\routes\fees.php:265-314` (public group, only `check_permissions`)
**Function/Method:** `*_response_handler` -> `pay_fees()` (`:2279`)
**Problem:** The payment-success callbacks of four gateways accept unauthenticated requests and mark the payment `PS` and post the fee receipt purely from fields in the request. There is no signature/hash verification and no server-to-server status check.
**Evidence:**
* ICICI: `$response = $_REQUEST; ... if ($response["Response_Code"] == "E000") { $payment_status = "PS"; }` (`:1454,1462`) then `pay_fees(..., $get_all_data[0]->amount, $response["ReferenceNo"], ...)` (`:1491`). The route is `Route::get('fees/online_fees_iciciresponsehandler', ...)->middleware('check_permissions')` (`routes/fees.php:295`) - a plain GET.
* ICICI Orange: comment in code `// (Optional) Verify response secureHash ... Omitted for brevity` (`:1749-1751`); status from `$response["responseCode"] === "0000"`.
* PayPhi: `if ($response["responseCode"] == "0000") $payment_status = "PS";` (`:3981`).
* AggrePay: the HMAC is computed and stored as `$response['valid_hash'] = 'Yes'|'No'` (`:2230`) but never used in any condition; success = `$response["response_message"] == "Transaction successful"` (`:2247`) and the credited amount is the POSTed `$response["amount"]` (`:2266`).
* Axis: payload is AES-decrypted (needs key) but there is **no "prevent second time success" guard** (present in hdfc/icici/payphi/razorpay, absent here) so replaying the same browser-return URL `?i=<enc>` re-runs `pay_fees` each time (`:2074-2093`).
**Impact:** Anyone who knows or guesses an open order reference (`ReferenceNo` / `merchantTxnNo` / `order_id`, sequential or timestamp-like) can call the callback URL and have the fee recorded as paid without paying (`pay_fees` credits against the student's real dues, receipt issued, SMS sent). Direct financial loss and falsified ledger. For AggrePay an attacker also chooses the amount. Axis callbacks are replayable.
**Expected Behavior:** Verify the gateway signature/secure-hash (or re-query the gateway status API server-side) before changing `fees_payment` state; check that returned amount == stored amount; make the transition `PR -> PS` atomic and idempotent for every gateway.
**Recommended Fix:** Implement per-gateway verification (Razorpay handler at `:3097` already does `verifyPaymentSignature` - use it as the model); reject when `valid_hash != 'Yes'`; compare amounts to `fees_payment.amount`; wrap in `DB::transaction` with `lockForUpdate()` on the `fees_payment` row and only proceed if the status was `PR`; add the missing guard to Axis/AggrePay.
**Verification:** POST/GET a crafted callback with a known `ReferenceNo` in staging and confirm no receipt is created; unit-test each handler with a bad signature.

## FIN-02
**Severity:** Critical   **Type:** Confirmed
**Category:** Security
**Module:** Fees / Mobile "GPay" self-reported payment
**Location:** `fees_collect_controller.php:3285-3300,3389-3396` (`studentFeesDetailAPI`, route `routes/fees.php:327`), `online_fees_collect_controller.php:2502-2663` (`OnlineReceipt`, route `routes/fees.php:316` inside the public group)
**Function/Method:** `studentFeesDetailAPI`, `OnlineReceipt`
**Problem:** `POST /fees/get_online_receipt` posts fee receipts based on client-supplied `amount`, `transactionid`, `bank_name`, `sub_institute_id`, `syear` and a student-bound token, with no payment verification and no idempotency. The token is minted by `studentFeesDetailAPI` for any `student_id`/`sub_institute_id` the caller passes (it even overwrites the hydrated session tenant with the client's value: `$request->session()->put('sub_institute_id', $sub_institute_id)`, `:3297`), never expires and is not bound to amount, tenant or transaction.
**Evidence:** `$token_student_id = Crypt::decryptString($token_data['student_id']); if(($token_student_id!=$student_id) ...` (`:2523-2526`) is the only check; then allocation of `$amount` across dues and `$controller->pay_fees($request)` with `PAYMENT_MODE => 'Online'`, `cheque_no => $transactionid` (`:2617-2640`). Token creation: `Crypt::encryptString($fees_data['stu_data']['student_id'])` (`:3389-3396`).
**Impact:** Any logged-in user (a student is enough) can (1) call `studentFeesDetailAPI` with another student's id and tenant to obtain a token, then (2) call the public `get_online_receipt` with any `transactionid` to mark that student's dues (up to the outstanding balance) as paid with an "Online" receipt and no money movement. Repeatable per call; no duplicate-transaction check.
**Expected Behavior:** Receipts for online payments must be created only from a verified gateway confirmation bound to a `fees_payment` row.
**Recommended Fix:** Remove or protect the endpoint: require JWT identity == token student, look up the pending `fees_payment` by server-issued order id, verify with the gateway, reject reused `transactionid` (unique index), take tenant from the JWT only, add expiry to the token.
**Verification:** As student A call `studentFeesDetailAPI` for student B (other tenant) and observe token issuance; then `get_online_receipt` with `amount=1000&transactionid=x`.

## FIN-03
**Severity:** Critical   **Type:** Confirmed
**Category:** Security
**Module:** Fees (controllers) - SQL injection
**Location:** 76 string-concatenated inputs in 23 files under `D:\next_lms_erp\app\Http\Controllers\fees` (count from grep). Highest-impact sinks: `D:\next_lms_erp\app\Http\Controllers\AJAXController.php:2135-2137` and `fees_collect_controller.php:3588-3603` (`receipt_id_html`); `feesDefaulterReportController.php:92,96` (`first_name`, `last_name`); `feesCancelController.php:128-134` (`from_date`,`to_date`); `feesRefundController.php:208-214`; `feesModificationController.php:97-119`; `feesTypewiseReportController.php:107+`; `feesReportController.php:167-183`; `feesMonthlyReportController.php:121-122`; `daily_voucherController.php:51-80`; `tallyExportReportController.php` (5); `NACH/s1excel_exportController.php:64`; `other_fees_collect_controller.php:86,90`; `other_fees_cancel_controller.php:99,103`; `online_fees_collect_controller.php:2859` (`razorpay_request_handler`, `e.student_id = '" . $student_id . "'`) and `:3357` (`hdfcrazorpay_verify_payment`)
**Function/Method:** report/search methods listed; `AJAXController::get_FeesHtml`
**Problem:** Request values are concatenated into `whereRaw`/`selectRaw`/`DB::select` strings without binding.
**Evidence:**
* `->whereRaw("(fr.RECEIPT_ID_1 = '" . $receipt_id . "' OR fr.RECEIPT_ID_2 = '" . $receipt_id . "' ...` (`AJAXController.php:2135`), `$receipt_id = $request->input('receipt_id_html')` (`:1800`) - reachable from `GET /fees/receipt/reprint`. The result set is rendered as receipt HTML, so a `UNION SELECT` returns arbitrary table content into the PDF.
* `$extraSearchArrayRaw .= "  AND tblstudent.first_name like '%" . $first_name . "%' ";` (`feesDefaulterReportController.php:92`), same in 8 more report controllers.
* Dates: `LogRouteMiddleware` only sanitises `from_date/to_date/receiptdate/...` with `strtotime` when `type` is not `API` (`LogRouteMiddleware.php:22,60-90`), so through the Next.js client (always `type=API`) they are raw.
* `razorpay_request_handler` is a **public** route (`routes/fees.php:302`); `$student_id = $_REQUEST["student_id"]` is concatenated at `:2859` before any authentication (unauthenticated injection, blind/time-based).
**Impact:** Authenticated users (any student/teacher JWT) - and for the razorpay request handler, anonymous internet users - can read or modify any table in the shared multi-tenant database: student PII, bank details, gateway secrets, other tenants' financial data.
**Expected Behavior:** All user input bound as parameters; dates validated as dates.
**Recommended Fix:** Replace concatenation with bindings (`whereRaw('... = ?', [..])`, `where('first_name','like',"%{$v}%")`), validate `date`/`integer`; add a static-analysis rule (Larastan / semgrep) failing on `whereRaw(".. . $`.
**Verification:** `receipt_id_html=' OR 1=1 -- ` against `/fees/receipt/reprint` in staging; sqlmap on the listed endpoints.

## FIN-04
**Severity:** Critical   **Type:** Confirmed
**Category:** Authorization
**Module:** Fees / Receipt cancellation
**Location:** `D:\next_lms_erp\app\Http\Controllers\fees\fees_cancel\feesCancelController.php:96-97` (search), `:256-260` (`store`); `routes/api.php:544`; frontend `D:\lms_k12\app\fees\cancel-refund\page.tsx:263-292`
**Function/Method:** `feesCancelController::create/search`, `::store`
**Problem:** For `type=API` the controller replaces the JWT-hydrated tenant and user with client values, then cancels/searches receipts.
**Evidence:** `if($type=="API"){ ... $sub_institute_id = $request->get('sub_institute_id'); $syear = $request->get('syear'); $user_id = $request->get('user_id'); }` (`:256-260`) after only `jwtToken()->validate()`; search: `$syear = $request->syear; $sub_institute_id = $request->sub_institute_id;` (`:96-97`). The frontend sends these in FormData (`cancel-refund/page.tsx:265-267`).
**Impact:** A valid token of any school user can (a) list every receipt (names, enrollment, mobile-linked data, amounts, receipt HTML) of any other school and (b) **cancel any school's receipts** (`is_deleted='Y'`), re-opening the student's dues, and (c) attribute the cancellation to any `user_id` in `fees_cancel.cancelled_by` (audit-trail forgery). No role check exists either (see FIN-14).
**Expected Behavior:** Tenant/user only from the verified session; explicit "cancel receipt" permission and reason required; cancellation audited.
**Recommended Fix:** Delete the API overrides; use `session()->get(...)`; add a role check (admin/accountant) and mandatory `cancel_type`/`cancel_remark`; wrap in a transaction and write `AuditLog::record` (see FIN-20).
**Verification:** With tenant-A token post `sub_institute_id=<B>` and a known receipt number to `/fees/fees_cancel`.

## FIN-05
**Severity:** High   **Type:** Confirmed
**Category:** Authorization
**Module:** Fees (all report / master / other-fees / NACH / dashboard controllers)
**Location:** ~55 sites (full list in section 4 of this report); representative: `feesDefaulterReportController.php:32,60`, `feesReportController.php:68,144,327,570`, `other_fees_collect_controller.php:26,54,161`, `tblfeesConfigController.php:26-188`, `tblfeesLateController.php:77-404`, `NACH/s1excel_exportController.php:30,47`, `FeesDashboardApiController::summary` (`sub_institute_id` from body, `routes/api.php:133`), `AJAXController.php:1802-1804`
**Function/Method:** see list
**Problem:** Multi-tenancy is enforced by trusting `sub_institute_id` from the request although the JWT already provides it. Many of these are write endpoints (other-fees collect/cancel, fee config, late master, receipt-book master, breakoff, month header, NACH import).
**Evidence:** `$sub_institute_id = $request->input('sub_institute_id', session()->get('sub_institute_id'));` (`other_fees_collect_controller.php:26`); `$subInstituteId = (string) $validated['sub_institute_id'];` (`FeesDashboardApiController.php:32`); the NACH export returns `bd.*` bank-account rows (`s1excel_exportController.php:100-110`).
**Impact:** Cross-tenant read of fee collections, defaulter lists (names, mobile, dues), student bank-account details, and cross-tenant modification of fee configuration and other-fee collections by any authenticated user of any school.
**Expected Behavior:** Tenant taken from the token only; request value ignored.
**Recommended Fix:** Central helper `tenantId()` returning `session('sub_institute_id')`; grep-remove all `$request->...('sub_institute_id')`; add a test that a token for tenant A cannot see tenant B.
**Verification:** Replay each listed endpoint with a foreign `sub_institute_id`.

## FIN-06
**Severity:** High   **Type:** Confirmed
**Category:** Business Logic
**Module:** Fees / Collection
**Location:** `D:\lms_k12\app\fees\collect\[studentId]\page.tsx:324-325,499-505,799-807`; `D:\next_lms_erp\app\Http\Controllers\fees\fees_collect\fees_collect_controller.php:1006-1010,1042-1059,1081-1145`
**Function/Method:** `saveCollection` (client), `add_discount`, `add_fine` (server)
**Problem:** The Next.js page sends only aggregate `totalDis` and `totalFin`; the server ignores `totalFin` entirely and drops `totalDis` unless per-head `discount_data[]` is also posted. Discount and fine typed by the cashier are therefore silently discarded, while the UI "Grand Total" (`total - discount + fine`) is what the cashier collects from the parent.
**Evidence:** Client: `form.append('total', String(totalAmount)); form.append('totalFin', String(fine)); form.append('totalDis', String(discount));` (`:501-504`); no `discount_data[...]`/`fine_data[...]` fields are appended. Server: `if (isset($_REQUEST['discount_data']) && isset($_REQUEST['totalDis']) && ...) { unset(discount_data) } else { unset($_REQUEST['totalDis']); }` (`:1006-1010`) - with `discount_data` absent the else-branch deletes `totalDis`; `fine` is read only from `$_REQUEST['fine_data']` or `$_REQUEST['fees_data']['fine']` (`:1081,1139`); `grep totalFin` in the controller: 0 reads. The legacy blade posts `discount_data[head]`/`fine_data[head]` (`resources/views/fees/fees_collect/fees_collect.blade.php:380-381`).
**Impact:** (a) Fine: parent pays `total + fine` in cash but the ledger records `total` - un-booked cash, receipt understates the payment. (b) Discount: parent pays `total - discount` but the ledger records the full head amounts collected with zero discount, and the printed receipt shows the full amount - dues/receipt mismatch and cash-book shortfall. Both are silent (no error).
**Expected Behavior:** Discount and fine either reach the server in the format it reads, or the server validates and rejects unknown fields; the printed receipt must match the amount collected.
**Recommended Fix:** Send `discount_data[headId]` and `fine_data[headId]` (or add server support for `totalDis`/`totalFin` as first-class inputs with caps and role checks); reconcile Grand Total with the server response before printing; add a contract test.
**Verification:** Enter discount 100 and fine 50 on a collect screen; compare `fees_collect.fees_discount`/`fine` and the receipt HTML.

## FIN-07
**Severity:** High   **Type:** Confirmed
**Category:** Business Logic
**Module:** Fees / Online payment (Next.js flow)
**Location:** `D:\lms_k12\app\fees\online-payment\[gateway]\page.tsx:52-88,141-168`; `D:\lms_k12\app\api\fees\online-payment\[gateway]\route.ts:9-17`; `D:\next_lms_erp\app\Http\Controllers\fees\online_fees\online_fees_payment_api_controller.php:38-56`
**Function/Method:** `submitPayment`, `openCheckout`, `initiate`
**Problem:** (1) The Razorpay checkout options contain no `handler`, `callback_url` or `redirect`, so after a successful capture nothing in the Next app calls `razorpay_response_handler`; the fee is only posted if some external job runs `razorpay_fetch_payment_status` (behind `session` middleware, no scheduler entry found). (2) For the other 7 gateways `initiate()` calls the legacy method which returns an HTML view; the Next route proxies the HTML, `response.json()` fails, is swallowed (`.catch(() => ({}))`) and the UI sets `paymentOrder` to `{}` and shows "Payment order created in the Next.js flow. Order ID: -".
**Evidence:** `new window.Razorpay({ key, amount, currency:'INR', name, description, order_id, prefill, theme })` (no handler) `:61-70`; `const payload = await response.json().catch(() => ({})); if (!response.ok || String(payload.status ?? '1') !== '1') throw ...; setPaymentOrder(payload.data || payload);` (`:161-165`).
**Impact:** Parents can be charged with no receipt/ledger entry (reconciliation only through the unverified cron), and for 7 gateways "Pay now" silently does nothing while displaying a success-style message; the button is then disabled (`Boolean(paymentOrder)`), blocking retry.
**Expected Behavior:** Order creation -> checkout -> server-side verification -> receipt, or an explicit "gateway not supported in this UI" state.
**Recommended Fix:** Add Razorpay `handler` that POSTs `razorpay_payment_id/order_id/signature` to a JWT-protected verify endpoint (use `razorpay_response_handler` logic); disable unsupported gateways in the UI; treat empty `payload` as error.
**Verification:** In test mode pay with Razorpay and check `fees_collect`; select `hdfc` and observe the UI message.

## FIN-08
**Severity:** High   **Type:** Confirmed
**Category:** Business Logic
**Module:** Fees / receipts & idempotency
**Location:** `fees_collect_controller.php:633,752-883,1151-1219`; `other_fees_collect_controller.php:279-283`; `feesRefundController.php:463-468`; `D:\lms_k12\app\fees\collect\[studentId]\page.tsx:415-575`
**Function/Method:** `gunrate_receipt_number`, `pay_fees`, `saveCollection`
**Problem:** Receipt numbers are `MAX(existing)+1` read outside the write transaction, with no lock and (per migration `2023_03_05_115658_create_fees_receipt_table.php`) no unique constraint; the client has no idempotency key and no re-entrancy guard beyond the `saving` React state.
**Evidence:** `$receipt_number = $this->gunrate_receipt_number($sub_institute_id,$syear);` (`:633`) precedes `DB::transaction(` (`:752`); the query is `ifnull(max(cast(fr.RECEIPT_ID_n as UNSIGNED)),last) as rid` then `+ 1` (`:1206-1215`). Same pattern for refunds (`IFNULL(MAX(...),0)`, `:463-468`) and other-fees (`:279-283`). Frontend: single `setSaving(true)` (`:444`), no request id; on network timeout the user sees an error while the server may have committed, and on "saved but receipt HTML not found" the form stays submittable (`:556-561`).
**Impact:** Two cashiers (or one double click / retry) collecting at the same time get identical receipt numbers; partial payments double-submitted are booked twice (server recomputes remaining per request, but concurrent requests both read the same remaining). Duplicate receipt numbers break audit and reconciliation. Prefixed receipt numbers (`receipt_prefix`) are inserted into integer `fees_collect.receipt_no` (migration `:22`) - live behaviour NOT VERIFIED.
**Expected Behavior:** Gap-free/unique sequence allocated inside the transaction (`SELECT ... FOR UPDATE` on `fees_receipt_book_master` counter or a sequence table) with a unique index; client sends an idempotency key and the server de-duplicates.
**Recommended Fix:** Move number allocation into the transaction with `lockForUpdate`, add `UNIQUE(sub_institute_id, syear, receipt_no)`, add `Idempotency-Key` header stored on `fees_receipt`; on the client keep an in-flight ref and disable on first click.
**Verification:** Fire two parallel POSTs for one student in staging and compare receipt numbers.

## FIN-09
**Severity:** High   **Type:** Confirmed
**Category:** Business Logic
**Module:** Fees / Refund
**Location:** `D:\next_lms_erp\app\Http\Controllers\fees\fees_cancel\feesRefundController.php:334-366,463-468`; `D:\lms_k12\app\fees\cancel-refund\page.tsx:761-778,786`
**Function/Method:** `saveFeesRefund`, `RefundWorkflow.save/loadDetail`
**Problem:** The refund cap is "amount paid per head" and prior refunds are never subtracted; the UI shows the same paid amount as `max` and does not reset or reload after a successful save.
**Evidence:** `$paid_amount_title_wise` is summed only from `fees_collect` rows with `is_deleted='N'` (`:337-354`) and compared `$refund_amount[...] > $paid_for_title` (`:359`); no read of `fees_refund`. UI: `<Input type="number" min="0" max={head.amount} ...>` (`:786`); after `save()` success only `setNotice(...)` (`:777`).
**Impact:** The same refund can be paid out repeatedly (each up to the full paid amount); no linkage between refunds and dues/ledger. Refund receipt is generated but never shown or printed by the UI (`payload.str` ignored).
**Expected Behavior:** Refundable = paid - already refunded; one refund action per confirmation with idempotency; show/print the refund receipt.
**Recommended Fix:** Subtract `SUM(fees_refund.<head>)` in the cap query inside a transaction with row lock; reload heads after save; render `str`.
**Verification:** Save a full refund twice in a row.

## FIN-10
**Severity:** High   **Type:** Confirmed
**Category:** Security
**Module:** Fees / Receipt generation and display
**Location:** `fees_collect_controller.php:1652-1820` (`gunrate_receipt`); `D:\lms_k12\app\fees\collect\[studentId]\page.tsx:669,898`, `app\fees\cancel-refund\page.tsx:815`, `app\fees\_components\fees-shared.tsx:235`
**Function/Method:** `gunrate_receipt`, receipt preview components
**Problem:** The printed/stored receipt takes student identity, remarks and bank fields from `$_REQUEST` (client input) instead of the database, without HTML escaping; the stored HTML is later rendered with `dangerouslySetInnerHTML` (also on reprint/cancel screens).
**Evidence:** `$first_name = $_REQUEST['first_name'] ?? '-'; ... $enrollment = $_REQUEST['enrollment']; $roll_no = ...` (`:1685-1693`), `str_replace(htmlspecialchars("<<student_name_value>>"), sortStudentName($_REQUEST['full_name']), ...)`, `<<discount_remarks>>` <- `$_REQUEST['remarks']`, `<<bank_name>>` <- `$_REQUEST['bank_name']` (`:1700-1783`); result persisted `fees_collect.fees_html` (`:1849-1854`). Client component: `dangerouslySetInnerHTML={{ __html: printableReceiptHtml }}`.
**Impact:** (1) A cashier or API caller can print a valid, numbered receipt with another person's name/enrollment/father name, or altered bank/cheque text. (2) `remarks`, `bank_name`, `cheque_no` with `<script>`/`<img onerror>` become stored XSS executed for every admin who opens the receipt, cancel list or reprint (token is in `localStorage`, so full account takeover).
**Expected Behavior:** Identity from the DB by `student_id`; all interpolated values `e()`-escaped; frontend sanitises (DOMPurify) or renders in a sandboxed iframe.
**Recommended Fix:** Load student data server-side; escape every replacement value; sanitise before `dangerouslySetInnerHTML`.
**Verification:** Submit `remarks=<img src=x onerror=alert(1)>` and reopen the receipt in the reprint/cancel UI.

## FIN-11
**Severity:** High   **Type:** Confirmed
**Category:** Authorization
**Module:** Fees / audit logs, online payments, reconciliation
**Location:** `D:\next_lms_erp\app\Http\Controllers\fees\fees_audit_log_api_controller.php:30-53`; `online_fees\online_payments_api_controller.php:21-40,81`; `online_fees\reconciliation_status_api_controller.php:59-71`
**Function/Method:** `index`, `show`
**Problem:** These read APIs have no tenant scope: filter by `sub_institute_id` only if the caller sends one; `show($id)` looks up `fees_payment` by primary key only; the audit endpoint also lets the caller choose `module`.
**Evidence:** `$query = DB::table('system_audit_logs')->where('module', $request->input('module', 'fees')); if ($request->filled('sub_institute_id')) {...}` ; `DB::table('fees_payment')->where('id', $id)->first()` (`online_payments_api_controller.php:81`); frontend `app/api/fees/audit-logs/route.ts` simply proxies.
**Impact:** Any authenticated user reads every tenant's audit trail (actor names, IPs, old/new values of fee changes) for any module, every tenant's gateway payments (student ids, amounts, order ids, statuses) and the reconciliation gaps.
**Expected Behavior:** Always `where sub_institute_id = session tenant`; admin-only; whitelist `module`.
**Recommended Fix:** Force the tenant predicate from session; add role check; restrict `module` to fees.
**Verification:** Call `/fees/audit_logs?module=auth` and `/fees/online_payments/1` with a low-privilege token.

## FIN-12
**Severity:** High   **Type:** Confirmed
**Category:** Authorization
**Module:** Fees / Online fee lookup (IDOR)
**Location:** `online_fees_collect_controller.php:51-149` (`get_fees` used by `preview`), `online_fees_payment_api_controller.php:56-63` (`createRazorpayOrder`), `AJAXController.php:1345-1364` (`getStudentFromMobile`), `:1367-1385` (`ajax_checkFeesBreakoff`), `fees_collect_controller.php:3292-3300` (`studentFeesDetailAPI`)
**Function/Method:** as listed
**Problem:** Student fee/PII lookups accept any `student_id` (or mobile) with no check that the student belongs to the caller's tenant or to the caller.
**Evidence:** `DB::table("tblstudent as s")->join(...)->where("s.id", $studentId)->get()` (`:58-68`); `createRazorpayOrder` reads `tblstudent` by `t.id` only and inserts `fees_payment` with **session** tenant (`:56-63,84-91`), so an order can be created for a student of another school; `getStudentFromMobile` returns `id, name-shortcode, sub_institute_id` of every enrolled student with that mobile in all tenants.
**Impact:** Enumeration of students by id/mobile across all schools; disclosure of student name, mobile, email, father/mother name, enrollment number and dues; mismatched tenant on payment rows.
**Expected Behavior:** Parent/student token can only access linked children; staff limited to own tenant.
**Recommended Fix:** Join `s.sub_institute_id = session tenant` (or guardian link), use non-guessable order references.
**Verification:** Request `preview?student_id=<id of other school>`.

## FIN-13
**Severity:** Critical   **Type:** Confirmed
**Category:** Security
**Module:** Library / Hostel / Transportation / Admissions / Students dashboards
**Location:** `D:\next_lms_erp\routes\api.php:140-144`; `LibraryDashboardApiController.php:56-60`; frontend callers `D:\lms_k12\app\library\_lib\library-dashboard-api.ts`, `app\hostel\_lib\hostel-dashboard-api.ts`, `app\Transportation\_lib\transportation-dashboard-api.ts`
**Function/Method:** `summary`
**Problem:** The routes are declared with no middleware ("stateless: tenant/year travel in the request body and there's no permission check", `routes/api.php:138-139`). The `api` group has only throttling (`Kernel.php:45-50`).
**Evidence:** `Route::post('library-dashboard/summary', ...)` (`routes/api.php:142`); library summary returns `recent_issues` with `CONCAT_WS(' ', s.first_name, s.last_name) as student_name, lb.title as book_title, issued_date, due_date` (`LibraryDashboardApiController.php:56-60`); hostel/transport give occupancy and per-vehicle student counts.
**Impact:** Anonymous callers can iterate `sub_institute_id` and read student names with borrowed book titles and dates, and hostel/transport/admission/student statistics for every school. `throttle:1000,1` is the only guard. (Also found independently by sub-audit A as X-01.)
**Expected Behavior:** Same `api.session` (JWT) protection and tenant-from-token as the admin dashboard.
**Recommended Fix:** Wrap in `Route::middleware(['api.session','staff.only'])`, drop `sub_institute_id` from the request.
**Verification:** `curl -X POST /api/library-dashboard/summary -d 'sub_institute_id=1&syear=2025'` without Authorization.

## FIN-14
**Severity:** High   **Type:** Architectural
**Category:** Authorization
**Module:** Fees (all resource controllers) / Permissions
**Location:** `D:\next_lms_erp\app\Http\Middleware\checkPermission.php:36-49,63-90`; `routes/fees.php:70-138`; frontend `D:\lms_k12\app\components\ConditionalApp.tsx:45`
**Function/Method:** `checkPermission::handle`
**Problem:** (Additionally `checkPermission.php:76` skips ALL rights checks when the request field `submit` contains "Search" - see FIN-41.) Rights are looked up only when the *current route name* equals a `tblmenumaster.link`; menu links are index route names (e.g. `fees_config_master.index`, `app/data/routeMapper.ts:885-898`), so `*.store`, `*.update`, `*.destroy`, `*.edit` and every unnamed route (`fees/PaidUnpaid`, `fees/audit_logs`, `fees/receipt/reprint`, `online_fees_settings_api`...) get no can_add/can_edit/can_delete check. Path-substring heuristics (`str_contains($path,'update')`) run only inside the found-menu branch. The Next.js pages perform no rights check either.
**Evidence:** `$menu_id = DB::table('tblmenumaster')->where('status',1)->where('link',$currentRouteName)->value('id'); if($menu_id!=''){ ...enforce... }` and nothing in the else path (`:36-90`). Only `FeesRefundApiController::denyUnlessAllowed` does an explicit gate.
**Impact:** Any authenticated JWT (student, parent, teacher) can potentially collect fees, cancel receipts, change gateway credentials, edit fee structure, view reports. Exact reach depends on `tblmenumaster` rows (NOT VERIFIED) but the default is open.
**Expected Behavior:** Deny by default; permission keyed by controller action (or middleware `perm:fees.collect,create`), enforced server-side and mirrored in the UI.
**Recommended Fix:** Map every route/name to a permission (the repo already has `perm:` and `staff.only` middleware for the LMS routes) and add negative tests; hide/disable actions in the UI by rights.
**Verification:** Call `POST /fees/fees_collect` (type=API) with a student token.

## FIN-15
**Severity:** High   **Type:** Confirmed
**Category:** Business Logic
**Module:** Fees / server trusts client amounts and dates
**Location:** `fees_collect_controller.php:386-391,449-487,793`; `other_fees_collect_controller.php:161-176,329-440`; `D:\lms_k12\app\fees\other_fees_collect\page.tsx:270-283`
**Function/Method:** `pay_fees`, `other_fees_collect_controller::store`
**Problem:** Amounts, dates and years come from the client with no server validation: negative `fees_data` passes the `!= 0` filter and is inserted; other-fees amounts are arbitrary (`amount_of_deduction[studentId]`, no title cap, no eligibility check); `receiptdate`, `syear`, `created_by`/`user_id` are client-controlled.
**Evidence:** `foreach ($_REQUEST['fees_data'] as $id => $arr) { if ($arr != 0) $fees_data[$id] = $arr; }` (`:386-390`) then `insert_amount = fees_data[title]` when not greater than remaining (`:476-481`); other-fees `'deduction_amount' => $amount_of_deduction[$student_id]` inserted directly (`:439-441` region); `$created_by = $request->input('user_id', session()->get('user_id'))` (`other_fees_collect_controller.php:172`).
**Impact:** A negative amount posts a negative "collection" (ledger reversal without approval); other-fees receipts can be issued for any amount to any student list; back-dated receipts and payments into past years are possible; `created_by` can impersonate.
**Expected Behavior:** Server-side `validate()` (numeric, >0, <= remaining, date within open period), created_by from session.
**Recommended Fix:** Add FormRequest validation for every money endpoint; reject negatives/zeros; enforce period lock; use the session user.
**Verification:** POST `fees_data[tution_fee]=-500` in staging.

## FIN-16
**Severity:** High   **Type:** Confirmed
**Category:** Security
**Module:** Fees / Gateway secrets in source
**Location:** `D:\next_lms_erp\app\Http\Controllers\fees\online_fees\online_fees_collect_controller.php:435` (`$working_code = '0E3D***...'`), `:438` (`env('CCAVENUE_ACCESS_CODE','AVDY***...')`), `:321` (`sub_institute_id => 76` hard-coded key row)
**Function/Method:** `getUTR`, `hdfc_response_handler`
**Problem:** CCAvenue working key (32 hex) is hard-coded in tracked source and the access code has a hard-coded fallback; code comments admit "remains in git history and must be rotated". `hdfc_response_handler` always decrypts with tenant 76's key. Gateway credentials in DB (`fees_razorpay.key_secret`, `fees_hdffc.working_code`, `fees_axis.encryption_key`, `fees_aggre_pay.salt_key`) are plaintext columns.
**Evidence:** `$working_code = '0E3D***';` (redacted), `env('CCAVENUE_ACCESS_CODE', 'AVDY***')`.
**Impact:** Anyone with repo access can forge/decrypt CCAvenue traffic for the merchant account and call payout APIs; rotation not confirmed.
**Expected Behavior:** Secrets only in env/secret manager, encrypted at rest, per-tenant lookup.
**Recommended Fix:** Rotate the key and access code, remove literals and fallback, look up credentials by the tenant of the `fees_payment` row (not 76), encrypt DB secrets (`Crypt`).
**Verification:** grep repo for the redacted prefixes after rotation.

## FIN-17
**Severity:** High   **Type:** Confirmed
**Category:** Security
**Module:** Fees / Receipt reprint and PDF storage
**Location:** `AJAXController.php:1777-1907`; `receipt_reprint_api_controller.php:20-73`; frontend `D:\lms_k12\app\fees\reports\receipt-reprint\page.tsx:22-36,49-58`
**Function/Method:** `ajax_PDF_FeesReceipt`, `reprint`
**Problem:** (1) Any authenticated user reprints any tenant's receipt (student_id + receipt number + client `sub_institute_id` - the UI even renders "Sub institute ID" as an editable input). (2) The PDF is written to the publicly served `storage/print_receipt_pdf/<studentId>_<YmdHis>.pdf` (guessable name). (3) Every call first deletes **all files** in that shared folder (`glob(...*)` + `unlink`), racing with other users' pending downloads. (4) The lookup has no `is_deleted='N'` condition, so cancelled receipts reprint as normal receipts with no "CANCELLED" mark. (5) SQL injection (FIN-03).
**Evidence:** `$files = glob($folder_path); foreach ($files as $file) { if (is_file($file)) unlink($file); }` (`:1788-1793`); `$pdf_filename = $student_id . '_' . $CUR_TIME . ".pdf"` (`:1863-1864`); `$PDF_path_for_open = "https://" . $_SERVER['HTTP_HOST'] . '/storage/print_receipt_pdf/' . $pdf_filename` (`:1889`); `if($request->has('type') && $request->input('type')=="API"){ $sub_institute_id = $request->input('sub_institute_id'); ...}` (`:1802-1804`).
**Impact:** Cross-tenant disclosure of receipts (name, class, amounts), predictable public URLs, intermittent broken reprints when two users print, and cancelled receipts reusable as proof of payment.
**Expected Behavior:** Tenant from token, unique random file names served through an authenticated download, per-request temp file, cancelled receipts watermarked or refused.
**Recommended Fix:** Use `Str::uuid()` names in a private disk with signed URLs; delete only own file; filter `is_deleted='N'` or render "CANCELLED".
**Verification:** Reprint a cancelled receipt; fetch `/storage/print_receipt_pdf/` URL without auth.

## FIN-18
**Severity:** High   **Type:** Confirmed
**Category:** Security
**Module:** Next.js fees report proxies and hostel/library/transportation dashboard proxies (traced; Next handlers are audited by another agent)
**Location:** `D:\lms_k12\app\api\fees\reports\_lib\fees-report-proxy.ts:30-32,124-166,216-249`; `D:\lms_k12\app\api\fees\dashboard\summary\route.ts:64-70,99-106`; caller headers `D:\lms_k12\app\fees\_lib\fees-report-utils.ts:151-165`; same code at `D:\lms_k12\app\api\{transportation,hostel,library}\dashboard\summary\route.ts:50,88-112` (sub-audit A, X-06)
**Function/Method:** `readSession`, `proxyFeesReportGet/Post/TextGet`, dashboard `POST`
**Problem:** The proxy takes the upstream base URL from the request header `x-laravel-base-url` and forwards the caller's `Cookie` and bearer token to it; on non-JSON responses it echoes the first 500 characters of the upstream body.
**Evidence:** `const baseUrl = readHeader(request, 'x-laravel-base-url') || getDefaultBaseUrl();` (`fees-report-proxy.ts:31`); `fetch(targetUrl...)`; `preview: summarizeHtml(text)` (`:155-159`); `proxyFeesReportTextGet` returns the whole upstream body (`:239-245`). No authentication on these Next route handlers.
**Impact:** Unauthenticated server-side request forgery from the Next server to internal hosts (cloud metadata, admin panels) with partial response disclosure, and credential exfiltration by pointing the base URL at an attacker host.
**Expected Behavior:** Base URL from server env only.
**Recommended Fix:** Ignore the header, use `API_BASE_URL`; require a valid token before proxying.
**Verification:** `curl -H 'x-laravel-base-url: http://169.254.169.254' .../api/fees/reports/fees-collection`.

## FIN-19
**Severity:** Medium   **Type:** Confirmed
**Category:** Security
**Module:** Fees / session parameters
**Location:** `D:\lms_k12\app\fees\_lib\fees-api.ts:186-196`; `fees-report-proxy.ts:46-56`
**Function/Method:** `appendSessionParams`, `appendSessionSearchParams`
**Problem:** (Library pages do the same through `/api/proxy?path=...&token=<JWT>` - `library-module-utils.ts:206`, `add_book_remark:133-141`, `book_resources:378-383`.) The bearer token (`token`) plus `sub_institute_id`, `user_id`, `user_profile_id` are put in the query string of GET requests (report GETs, `/api/proxy?...` calls).
**Evidence:** `if (session.token) params.set('token', session.token);` (`:192`).
**Impact:** JWTs land in Laravel/nginx access logs, browser history, Referer headers and proxy logs.
**Expected Behavior:** Token only in `Authorization` header.
**Recommended Fix:** Drop `token` from URL/params (the header is already sent); send other context via header/body.
**Verification:** Inspect Network tab for `?token=`.

## FIN-20
**Severity:** Medium   **Type:** Confirmed
**Category:** Business Logic
**Module:** Fees / Cancellation audit trail
**Location:** `feesCancelController.php:288-330,341-358`; `D:\lms_k12\app\fees\cancel-refund\page.tsx:242-315`
**Function/Method:** `store`
**Problem:** Cancellation of "other fees" writes no `fees_cancel` row (`// DB::table('fees_cancel')->insert($feesCancelLog);` commented out at `:311`), nothing is written to `system_audit_logs` for any cancellation (receipt creation, reprint and refund are audited; cancel is not), `is_waved` is overloaded with the cancel type (`:358`), no transaction, always returns success, and the UI has no confirmation dialog and sends no reason for OTHER rows (`cancel-refund/page.tsx:280-283`).
**Evidence:** see lines above.
**Impact:** Money-affecting reversals without trace or reason; partial failure leaves receipts half cancelled.
**Expected Behavior:** Every cancel = audited, reasoned, atomic, confirmed.
**Recommended Fix:** Add `AuditLog::record` (RECEIPT_CANCELLED), mandatory reason server-side, transaction, confirmation modal.
**Verification:** Cancel an other-fees receipt and inspect `fees_cancel` / `system_audit_logs`.

## FIN-21
**Severity:** Medium   **Type:** Potential
**Category:** Business Logic
**Module:** Fees / rounding and currency handling
**Location:** `D:\lms_k12\app\fees\collect\[studentId]\page.tsx:115-119,324-325,1329-1332`; `fees_collect_controller.php:760-767`; migration `2023_03_05_115658_create_fees_collect_table.php:35-37`; `online_fees_payment_api_controller.php:82-84`
**Function/Method:** client totals, `pay_fees`
**Problem:** Money uses JS `Number` (floating) summed with `reduce` and no rounding; UI currency shows 0 fraction digits (`maximumFractionDigits: 0`); server casts `(int)` when a fine exists (`$amount = (int)$amount;`) and, per the migration, columns are `decimal(10,0)` so paise are dropped; Razorpay uses `(int) round($amount*100)`. `readNumber` in the collect page accepts `NaN`-safe numbers but also negatives.
**Evidence:** `$table->decimal('amount', 10, 0)`, `$amount = (int)$amount; $fine = (int)$fine;`.
**Impact:** Sub-rupee amounts are truncated/rounded inconsistently between UI, receipt and ledger (only if fee heads or discounts are fractional); live column type NOT VERIFIED (schema drift).
**Expected Behavior:** Integer paise or `decimal(12,2)` throughout with one rounding rule.
**Recommended Fix:** Store minor units, round once server-side, display exact values.
**Verification:** Collect 100.50 on a head in staging and compare UI, receipt and `fees_collect`.

## FIN-22
**Severity:** Medium   **Type:** Missing
**Category:** Business Logic
**Module:** Fees / Late fee
**Location:** `fees_collect_controller.php:2956,3018-3058`; `D:\lms_k12\app\fees\master\fees-late-master\page.tsx`; `collect/[studentId]/page.tsx` (no use of `config_late_fine`)
**Function/Method:** `getBk`/`edit` late-fine block
**Problem:** The query that fills `$getLateData` is commented out ("no migration found"), so `$config_late_fine` remains `0`; the Next collect page never reads `config_late_fine` or `fees_config_data.late_fees_amount`. The Late Fee Master screen therefore configures rules nothing consumes; fines are only free-typed (and dropped, FIN-06).
**Evidence:** `// $getLateDatas = DB::table('fees_late_master')->where(...)` (`:3028`), `$config_late_fine = 0;` (`:2956`).
**Impact:** No automatic late fees; inconsistent policy enforcement.
**Expected Behavior:** Late fee computed server-side from `fees_late_master` and applied/displayed at collection.
**Recommended Fix:** Restore the lookup (add migration), compute in `pay_fees`, show read-only in UI.
**Verification:** Configure a late rule, collect after the due date.

## FIN-23
**Severity:** Medium   **Type:** Architectural
**Category:** Backend
**Module:** Fees / tenant-specific hard-coding
**Location:** `fees_collect_controller.php:258,266,1154,1191,2348,3105,3109`; `feesCancelController.php:135`; `feesReportController.php:259`; `online_fees_collect_controller.php:92,321,549`; `AJAXController.php:1829`
**Function/Method:** `show_student`, `getBk`, `edit`, `gunrate_receipt_number`, others
**Problem:** Fee maths and receipt behaviour branch on literal tenant ids (254, 48, 61, 76, 47, 49, 200, 257, 253).
**Evidence:** `if ($remain > 0 && $sub_institute_id==254){ $arr->bkoff = ($remain + $previous); } ... if(in_array($sub_institute_id,[48,61])){ $arr->bkoff = $remain; }` (`:258-271`).
**Impact:** The same student data yields different dues per tenant with no configuration; unreviewable and untestable; any tenant id reuse or new onboarding silently changes behaviour.
**Expected Behavior:** Behaviour driven by per-tenant configuration rows.
**Recommended Fix:** Move to `fees_config_master` flags; add characterization tests before refactor.
**Verification:** n/a (code inspection).

## FIN-24
**Severity:** Medium   **Type:** Confirmed
**Category:** Performance
**Module:** Fees / list, defaulter, verification
**Location:** `fees_collect_controller.php:222-281` (`show_student`), `feesDefaulterReportController.php:137-182`; `D:\lms_k12\app\fees\collect\page.tsx:209,320`; `app\fees\_lib\fees-verification.ts` (probes)
**Function/Method:** `show_student`, `showFeesDefaulter`
**Problem:** For every matched student the server runs `FeeBreackoff`, `OtherBreackOff` and the heavy `getBk` (multiple queries) - no server-side pagination; the collect page calls this endpoint twice per search (once for KPI "dashboard rows", once for the table) and only paginates client-side. The onboarding verification drawer runs the defaulter report unfiltered.
**Evidence:** `foreach ($result as $id => $arr) { $paid_result = $this->getBk($request, $bk_stu_id,$bk_std_id); ...}` (`:245-250`).
**Impact:** Seconds-to-minutes response and DB load for a school-wide search; browser stalls (the collect page comment admits "the unfiltered student list is slow enough that loading it on mount stalls the page").
**Expected Behavior:** Server-side pagination and set-based aggregation.
**Recommended Fix:** Paginate `show_student`, precompute dues with grouped SQL, cache the KPI call.
**Verification:** Time a school-wide search with 3-5k students.

## FIN-25
**Severity:** Medium   **Type:** Confirmed
**Category:** Frontend
**Module:** Fees / dates
**Location:** `D:\lms_k12\app\fees\collect\[studentId]\page.tsx:139,253,1281`; `cancel-refund\page.tsx:769`; `_lib\fees-api.ts:301`; also `app\library\issue_overdue_report\page.tsx:84-85`, `app\hostel\api.ts:202,219`, `app\inward_outward\_components\RegisterPage.tsx:14`
**Function/Method:** `useState(() => new Date().toISOString().slice(0, 10))`
**Problem:** The default receipt date / "today" is the UTC date; in IST (UTC+5:30) between 00:00 and 05:30 it is yesterday. Also `toInputDateString` re-serialises dates via UTC.
**Evidence:** `new Date().toISOString().slice(0, 10)`.
**Impact:** Early-morning receipts, refunds, library/hostel/inward entries are dated the previous day, shifting daily collection totals.
**Expected Behavior:** Local date (`new Date().toLocaleDateString('en-CA')`) or server date.
**Recommended Fix:** Central `todayLocalIso()` helper; use server time for receipts.
**Verification:** Set system clock to 02:00 IST and open collect.

## FIN-26
**Severity:** Medium   **Type:** Confirmed
**Category:** Security
**Module:** Exports (all fee/report pages using `lib/table-export.ts`)
**Location:** `D:\lms_k12\lib\table-export.ts:20-26,44-56`; users: `app/fees/reports/*` (collection, defaulter, cancel, structure, type-wise, datewise, audit-logs), `master/fees-config-master`
**Function/Method:** `escapeCsvValue`, `exportRowsAsCsv`
**Problem:** (Confirmed independently by sub-audit B, X-1: also used by `inward_outward/_components/ReportPage.tsx:179` where Subject/Description are user text; headers are affected too; the print/PDF path escapes correctly.) CSV cells beginning with `=`, `+`, `-`, `@` (or tab/CR) are not neutralised; only quotes/commas are escaped. Excel "export" is an HTML table saved as `.xls` (`application/vnd.ms-excel`).
**Evidence:** `if (/[",\n]/.test(normalized)) return \`"${...}"\`; return normalized;`.
**Impact:** A student name/remark/receipt field like `=HYPERLINK(...)` or `=cmd|...` executes when an accountant opens the CSV (CSV/formula injection). Exports are client-side of already-returned data (tenant filter is server side), size unbounded.
**Expected Behavior:** Prefix risky cells with `'`.
**Recommended Fix:** Add formula-prefix escaping; generate real `.xlsx`.
**Verification:** Put `=1+1` in a student's last name and export.

## FIN-27
**Severity:** Low   **Type:** Improvement
**Category:** Business Logic
**Module:** Fees / month selection
**Location:** `D:\lms_k12\app\fees\collect\[studentId]\page.tsx:411-413,246`
**Function/Method:** `toggleMonth`
**Problem:** Cashiers can untick earlier due months and collect a later month; nothing enforces oldest-first, and partially collected `collectionAmount` per head is allowed with no minimum or approval.
**Evidence:** `setSelectedMonthIds` toggling; server honours `months[]` as posted (`fees_collect_controller.php:456-461`).
**Impact:** Selective settlement can hide arrears/defaulters and complicate late-fee logic.
**Expected Behavior:** Configurable oldest-first rule with override permission.
**Recommended Fix:** Enforce order server-side unless flagged.
**Verification:** Deselect the first month and save.

## FIN-28
**Severity:** Medium   **Type:** Potential
**Category:** Business Logic
**Module:** Fees / gateway callback idempotency
**Location:** `online_fees_collect_controller.php:405-411,1477-1482,3135-3141,2929-3044`
**Function/Method:** `hdfc_response_handler`, `icici_response_handler`, `razorpay_response_handler`, `razorpay_fetch_payment_status`
**Problem:** The "prevent second time success" guard is a read of `*_payment_status == 'PS'` followed by an unlocked update and `pay_fees`; concurrent browser-return + retry (or browser-return + status cron) both pass and post duplicate receipts. The Razorpay cron marks only `razorpay_dashboard_ps='captured'` and rewrites `razorpay_order_id` with the payment id, which then makes a later browser callback fail with 422 order-mismatch rather than being recognised as already processed.
**Evidence:** `if($get_all_data[0]->razorpay_payment_status == 'PS'){ ... return }` then `DB::table("fees_payment")->...update(...)` then `pay_fees(...)` (`:3135-3150`).
**Impact:** Double-credit on races; inconsistent state between browser and cron paths.
**Expected Behavior:** Atomic compare-and-set of the payment state plus unique index on gateway payment id.
**Recommended Fix:** `lockForUpdate` within a transaction, unique `(gateway, payment_id)`.
**Verification:** Replay the same callback twice concurrently.

## FIN-29
**Severity:** Medium   **Type:** Confirmed
**Category:** Authorization
**Module:** Fees / Teacher fee dues
**Location:** `D:\next_lms_erp\app\Http\Controllers\api\TeacherFeeDuesApiController.php:82-96`
**Function/Method:** `summary`
**Problem:** Class scoping uses independent `whereIn(standard_id)` and `whereIn(section_id)`, i.e. a cross product; a teacher of (Std 5, Div A) and (Std 6, Div B) also sees dues for (5,B) and (6,A).
**Evidence:** `->whereIn('se.standard_id', $standardIds)->whereIn('se.section_id', $divisionIds)`.
**Impact:** Teachers see financial data of students outside their classes.
**Expected Behavior:** Match pairs.
**Recommended Fix:** OR of (standard AND division) pairs.
**Verification:** Teacher with two non-aligned class assignments.

## FIN-30
**Severity:** Low   **Type:** Potential
**Category:** Authorization
**Module:** Fees / Refund permission
**Location:** `D:\next_lms_erp\app\Http\Controllers\api\FeesRefundApiController.php:15-28`
**Function/Method:** `denyUnlessAllowed`
**Problem:** Non-admin profiles are authorised via menu link `fees_refund` or `fees/fees_refund`, whereas menu links are route names (`fees_refund.index`); accountants granted rights in the UI are likely denied (functional gap), while the hard-coded name list `super admin/admin/school admin` is the only working path.
**Evidence:** `->whereIn('link', ['fees_refund', 'fees/fees_refund'])->value('id')`.
**Impact:** Role model diverges from menu rights (NOT VERIFIED against DB).
**Expected Behavior:** One permission source.
**Recommended Fix:** Reuse the common rights resolver.
**Verification:** Grant refund rights to a non-admin profile and call `/api/fees-refund/save`.

## FIN-31
**Severity:** Low   **Type:** Confirmed
**Category:** Frontend
**Module:** Fees / dead or placeholder UI
**Location:** `collect/[studentId]/page.tsx:716-719` ("Paid History" button without `onClick`), `:883-886` (commented-out "Save" button), `collect/page.tsx:142` (`feeHeadFilter` state never set), `cancel-refund/page.tsx:774-778` (refund receipt never shown), `fees/reports/fees-collection` etc.
**Function/Method:** n/a
**Problem:** Non-functional controls and unused state.
**Evidence:** `<Button ...><History .../>Paid History</Button>` no handler.
**Impact:** Users click buttons that do nothing; only "Save & Print" exists (a cashier cannot save without printing).
**Expected Behavior:** Wire or remove.
**Recommended Fix:** Implement paid history (ledger endpoint exists: `/fees/fees_collect/{id}/ledger`), restore Save-only.
**Verification:** Click "Paid History".

## FIN-32
**Severity:** Low   **Type:** Confirmed
**Category:** Frontend
**Module:** Fees / Other fees title
**Location:** `D:\lms_k12\app\fees\master\other-fees-title\page.tsx:255,256,383`
**Function/Method:** `loadRecords`, `handleSubmit`
**Problem:** `console.log` of the full API payload and the submit payload (incl. `created_by`, `user_id`, `sub_institute_id`).
**Evidence:** `console.log('Other Fees Title submit payload:', Object.fromEntries(requestPayload.entries()))`.
**Impact:** Data in browser consoles/support screenshots.
**Expected Behavior:** No debug logging.
**Recommended Fix:** Remove.
**Verification:** Open the page with devtools.

## FIN-33
**Severity:** Medium   **Type:** Missing
**Category:** Frontend
**Module:** Fees / backend features without UI
**Location:** `D:\next_lms_erp\routes\fees.php` (cheque_cash `:112`, cheque_reconciliation `:135`, bank_master `:118`, fees_modification `:89`, tally export `:95`, daily_voucher `:85`, payout report `:78`, monthly report, status report `:100` + SMS reminder `:104`, overall reports, fine/discount report, imprest cancel/refund, college_fees_collect, online_fees_split, confirm_online_fees, monthly_breakoff, `fees_collect/{id}/ledger`)
**Function/Method:** n/a
**Problem:** Grep of `app`, `lib`, `components` finds no caller/page for these; notably cheque bounce/reconciliation, manual online-payment confirmation and Tally export cannot be done from the new UI.
**Evidence:** section 2 table (0 hits).
**Impact:** Feature parity gap for finance staff; menus (if present) point to non-existent pages (NOT VERIFIED).
**Expected Behavior:** Either migrate or hide the menus.
**Recommended Fix:** Inventory the menu rows, port or hide.
**Verification:** Compare `tblmenumaster` fees rows with `FEES_SCREENS` registry (`fees-screen-registry.tsx:39-79`).

## FIN-34
**Severity:** Medium   **Type:** Potential
**Category:** Database
**Module:** Fees / online payment reconciliation
**Location:** `reconciliation_status_api_controller.php:16-21,100-108`; `fees_collect_controller.php:794` (`cheque_no`); migration `2023_03_05_115658_create_fees_collect_table.php:29`
**Function/Method:** `transform`, `pay_fees`
**Problem:** Gateway payment ids (`pay_...`, `order_...`) are stored in the integer `cheque_no` (per migration), the reconciliation view's own comment says it is "only reliable for HDFC/ICICI/Axis/AggrePay"; for Razorpay/PayPhi `ledger_finalized` is always false so `looks_stuck` over-reports, and in strict SQL mode the insert may fail (capturing money without receipt).
**Evidence:** "Known limitation: fees_collect.cheque_no is an integer column..." (`:16-21`).
**Impact:** Wrong reconciliation status; possible failed receipt inserts for Razorpay (live schema NOT VERIFIED).
**Expected Behavior:** String reference column, unique per gateway id.
**Recommended Fix:** Migrate `cheque_no` to varchar, add `payment_ref` unique.
**Verification:** Check `SHOW COLUMNS FROM fees_collect` in staging.

## FIN-35
**Severity:** Medium   **Type:** Confirmed
**Category:** Security
**Module:** Fees / client-controlled API host
**Location:** `D:\lms_k12\app\fees\collect\page.tsx:184-209,296-320,421`, `[studentId]/page.tsx:1111-1130`, `cancel-refund/page.tsx:837`
**Function/Method:** `getSessionContext`
**Problem:** Several fee pages send the bearer token and student data to `userData.host_name` read from `localStorage`, ignoring the configured `API_BASE_URL` used elsewhere (`fees-api.ts:171-173`).
**Evidence:** `hostName = readString(userData.host_name); ... fetch(`${hostName.replace(/\/$/, '')}/fees/fees_collect/show_student`...` with `Authorization: Bearer ${token}`.
**Impact:** Any XSS or tampered storage redirects tokens/PII to an arbitrary host; inconsistent API base between screens.
**Expected Behavior:** Single trusted base URL.
**Recommended Fix:** Use the shared `getApiBaseUrl`; validate host against an allow-list.
**Verification:** Edit `userData.host_name` in devtools and watch requests.

## FIN-36
**Severity:** High   **Type:** Confirmed
**Category:** Security
**Module:** Fees / payout & UTR endpoints
**Location:** `routes/fees.php:279-280` (`fees/hdfc/createSplitPayout`, `fees/hdfc/getUTR` public GET), `online_fees_collect_controller.php:546-660,1659,1863` (`CURLOPT_SSL_VERIFYPEER => false`)
**Function/Method:** `createSplitPayout`, `getUTR`, `callCCAvenueAPI`
**Problem:** State-changing bank-side calls (CCAvenue split-payout creation, UTR sync) are triggered by anonymous GET requests; the tenant comes from `?sub_institute_id=` (default 76) and results (including decrypted gateway responses) are returned to the caller; TLS certificate verification is disabled for gateway calls (also ICICI Orange initiateSale pointing to the UAT URL `pgpayuat.icicibank.com` at `:1650`).
**Evidence:** `$sub_institute_id = $request->sub_institute_id ?? 76;` `CURLOPT_SSL_VERIFYPEER => false, CURLOPT_SSL_VERIFYHOST => false`; the route file comment says these are "server-to-server callback" routes.
**Impact:** Anyone can trigger payout instructions and probe merchant data; man-in-the-middle on gateway calls; ICICI Orange orders go to the UAT gateway from this code path.
**Expected Behavior:** Cron/CLI or signed internal endpoint; TLS verification on; environment-specific gateway URL.
**Recommended Fix:** Move to a scheduled command, require an internal token, enable TLS verification, config-driven URLs.
**Verification:** `curl /fees/hdfc/createSplitPayout?sub_institute_id=76` unauthenticated.

## FIN-37
**Severity:** High   **Type:** Confirmed
**Category:** Authorization
**Module:** Fees / Online fees settings (merchant credentials)
**Location:** `routes/fees.php:125-126`; `online_fees_settigs_controller.php:96-190`; frontend `D:\lms_k12\app\fees\online-fees-settings\page.tsx:107-161`
**Function/Method:** `store`, `destroy`
**Problem:** Any authenticated caller reaching the route (route name `online_fees_settings_api.store/destroy` has no menu row => no rights check, FIN-14) can create/delete the school's payment-gateway mapping and store new merchant ids/keys/`fees_type`; secrets are saved in plaintext; UI has only a `window.confirm`.
**Evidence:** `'key_secret' => $request->get('enc_key')`, `'salt_key' => $request->get('salt_key')` inserted directly; the page has no role gating.
**Impact:** Redirecting online fee settlements to an attacker-controlled merchant account, or disabling online fees.
**Expected Behavior:** Finance-admin only, audited, secrets encrypted.
**Recommended Fix:** Add explicit role check + AuditLog; encrypt columns.
**Verification:** POST `map_company=razorpay&merchant_id=..&enc_key=..` with a teacher token.


## FIN-38
**Severity:** High   **Type:** Confirmed
**Category:** Security
**Module:** Fees / file uploads (NACH S2/S4 import, receipt-book logos) and import summary HTML
**Location:** `D:\next_lms_erp\app\Http\Controllers\fees\NACH\s4excel_importController.php:99-104,160-200,296-330`; `NACH\s2excel_importController.php:51-55`; `fees\feesReceiptBookMasterController.php:212-225`; frontend `D:\lms_k12\app\fees\NACH_s4excel_import\page.tsx:113-119,164-168`
**Function/Method:** `store` (import), receipt-book `store`; `handleUpload`
**Problem:** Uploads are stored under `storage/app/public/...` (web-served through the `storage` symlink) with an extension taken from the **client file name** and no `mimes`/size validation (`$ext = \File::extension($originalname); $file->storeAs('public/NachExcel/Uploads/', $name.'.'.$ext)`; same for receipt logos to `public/fees/`). The S4 import then builds an HTML summary by concatenating spreadsheet cell values (`$fees_paid_str.="<td>" . $value[$i] . "</td>"`) and returns it as `message`, which the page renders with `dangerouslySetInnerHTML`. S4 rows also drive `pay_fees` (fee postings) from file content, tenant from request (FIN-05).
**Evidence:** see lines above; frontend `<div ... dangerouslySetInnerHTML={{ __html: summaryHtml }} />`.
**Impact:** (1) If the web server executes scripts under `/storage` an attacker with any fee-staff token can upload a `.php` file (potential RCE - server config NOT VERIFIED); bank return files with student/bank data sit publicly under predictable names `NACH_S4_Import_Y_m_d_H_i_s.<ext>`. (2) A crafted xlsx injects script into the accountant's browser (stored in the response, executed on render). (3) Re-uploading the same bank file relies on "already paid" detection only.
**Expected Behavior:** Whitelist `xls/xlsx/png/jpg`, random names on a private disk, escape values, duplicate-file/`UTR` check, transaction per import.
**Recommended Fix:** `$request->validate(['s4file'=>'required|mimes:xls,xlsx|max:5120'])`, store on `local` disk, `e()` every cell, sanitise on the client, add a batch id unique per file hash.
**Verification:** Upload `test.php` as `s4file`; import an xlsx containing `<img src=x onerror=alert(1)>` in a name cell.

## FIN-39
**Severity:** Critical   **Type:** Confirmed   (Source: sub-audit A, X-02; route/controller lines re-checked)
**Category:** Security
**Module:** Hostel / Visitor (school gate visitor) API
**Location:** `D:\lms_k12\app\hostel\api.ts:178-199` (`createVisitor` -> `add_visitorAPI`); `D:\next_lms_erp\routes\teacherapi.php:87`; `D:\next_lms_erp\app\Http\Controllers\visitor_management\visitor_masterController.php:153-253`
**Function/Method:** `visitor_masterController::store`
**Problem:** `POST /add_visitorAPI` requires no authentication (JWT validation block commented out at `:162-172`; `mapTeacherApiRoutes` applies no middleware). Tenant and creator come from input (`$sub_institute_id = $request->input('sub_institute_id'); $created_by = $request->input('user_id')`). A photo is stored with the client extension (`getClientOriginalExtension`, `storeAs('public/visitor_photo/', ...)`) and an SMS is triggered (`get_sms_setting($visitor_id,'Welcome')`).
**Evidence:** as above.
**Impact:** (Also reachable as the public `POST /visitor_management/add_visitor_master`, see FIN-66.) Anonymous data injection into any tenant, arbitrary-extension upload into web-served storage (stored XSS; RCE if PHP executes there - NOT VERIFIED), SMS cost abuse and PII creation (visitor name/contact/ID card/photo).
**Expected Behavior:** JWT required, tenant from token, image mime whitelist, rate limit.
**Recommended Fix:** Restore the JWT check, derive tenant/user from the token, `mimes:jpg,jpeg,png|max:2048`, throttle.
**Verification:** `curl -F sub_institute_id=1 -F photo=@x.php https://.../add_visitorAPI` without Authorization.

## FIN-40
**Severity:** High   **Type:** Confirmed   (sub-audit A, X-03)
**Category:** Authorization
**Module:** Visitor list / type APIs
**Location:** `D:\next_lms_erp\app\Http\Controllers\adminapiController.php:943-993` (`get_adminVisitorListAPI`); `visitor_masterController.php:581-605` (`get_visitorTypeAPI`); frontend `app/hostel/api.ts:146-175`
**Function/Method:** as listed
**Problem:** JWT is validated but `sub_institute_id` is taken from the body and never compared with the token payload.
**Evidence:** `$sub_institute_id = $request->input("sub_institute_id")`.
**Impact:** Any logged-in user (even a student) reads any tenant's visitors: name, contact, email, ID card, photo URL (photo URL built from `$_SERVER['SERVER_NAME']` with hard-coded `https://`).
**Expected Behavior:** Tenant from token.
**Recommended Fix:** Compare with payload or drop the parameter.
**Verification:** Replay with another tenant id.

## FIN-41
**Severity:** High   **Type:** Confirmed   (sub-audit A, X-04; I saw the same line)
**Category:** Authorization
**Module:** Permissions middleware
**Location:** `D:\next_lms_erp\app\Http\Middleware\checkPermission.php:76` (`if (!Str::contains($request->submit, 'Search')) { ...all can_delete/can_edit/can_add/can_view checks... }`); frontend evidence `app/library/report/page.tsx` (~190) and `issue_overdue_report/page.tsx:114-117` send `submit=Search` deliberately
**Function/Method:** `checkPermission::handle`
**Problem:** Any request whose `submit` field contains "Search" skips every rights check.
**Evidence:** line above.
**Impact:** On routes whose name matches a menu link (inventory/hostel/transport/library web groups) a client adds `submit=Search` to a POST/PUT/DELETE and bypasses can_add/can_edit/can_delete/can_view.
**Expected Behavior:** No client-controlled bypass.
**Recommended Fix:** Remove; use an allow-list of read-only route names.
**Verification:** DELETE a resource with `submit=Search` and a low-rights token.

## FIN-42
**Severity:** High   **Type:** Architectural   (sub-audit A, X-05; file read by me)
**Category:** Security
**Module:** CSRF configuration
**Location:** `D:\next_lms_erp\app\Http\Middleware\VerifyCsrfToken.php` (`$except` includes `'fees/*'`, `'api/*'`, `'https://erp.triz.co.in/*'`, `'https://dev.triz.co.in/*'`, `'http://127.0.0.1:8000/*'`)
**Function/Method:** `$except`
**Problem:** Full-URL wildcard entries make CSRF verification a no-op for the entire production/dev host (`fullUrlIs`), and `fees/*` disables it for all fee routes (including cookie-session Blade users).
**Evidence:** file content.
**Impact:** State-changing GET/POST (e.g. `books/{id}/reutrn`, `fees/fees_cancel`) are exposed to cross-site request forgery for cookie-authenticated browser sessions.
**Expected Behavior:** Exempt only stateless JWT paths.
**Recommended Fix:** Remove host wildcards; exempt `api/*` only.
**Verification:** Cross-origin form POST to a web route with a logged-in cookie.

## FIN-43
**Severity:** Medium   **Type:** Confirmed   (sub-audit A, X-07)
**Category:** Backend
**Module:** Next generic proxy (`/api/proxy`) - used by library, hostel visitor photo, fees settings
**Location:** `D:\lms_k12\app\api\proxy\route.ts:91,104` (`await request.text()`); users `app/library/book_resources/page.tsx:628-640`, `app/hostel/api.ts:195-197`
**Function/Method:** `forwardWithBody`
**Problem:** Multipart bodies are read as text and re-sent, corrupting binary uploads (images/PDF) - also `app/inward_outward/_lib/api.ts:126-133` (inward/outward attachments; sub-audit B I-4) and `app/hostel/api.ts:94-104,197`; `/api/proxy` also relays any client-chosen `path` to the backend (open relay).
**Evidence:** `const bodyText = await request.text(); ... body: bodyText`.
**Impact:** Uploaded book covers, attachments and visitor photos are silently corrupted.
**Expected Behavior:** Stream the raw body (`request.arrayBuffer()`), as `app/api/proxy-file/route.ts` does.
**Recommended Fix:** Forward `arrayBuffer`; restrict `path` allow-list.
**Verification:** Upload a PNG through library add-book and download it.

## FIN-44
**Severity:** Medium   **Type:** Confirmed   (sub-audit A, X-09; also section 4)
**Category:** Business Logic
**Module:** Inventory / Transportation / Hostel APIs
**Location:** `InventoryApiController.php:64-68,478-479`, `TransportationApiController.php`, `HostelSetupApiController.php` (`context()`)
**Function/Method:** `context`
**Problem:** Tenant and user are validated against the token, but `syear` is taken from input for writes.
**Evidence:** `context()` reads `syear` from request.
**Impact:** Writes into arbitrary academic years of the caller's own tenant.
**Expected Behavior:** Year validated against `academic_year` for the tenant and current-period rules.
**Recommended Fix:** Whitelist years.
**Verification:** POST with `syear=1999`.

## FIN-45
**Severity:** High   **Type:** Confirmed   (sub-audit A, INV-01, reproduced with a route-table replica)
**Category:** Backend
**Module:** Inventory / Item receivable
**Location:** `D:\next_lms_erp\routes\api.php:482-486`; `D:\lms_k12\app\Inventory\api.ts:129,162`; `app\Inventory\item_receivable\page.tsx:56,83`
**Function/Method:** `poItems`, `saveReceivables`
**Problem:** `Route::get('inventory/{module}')->where('module','^(?!reports$).+')` (matches slashes) is declared before `inventory/receivables/items` and `POST inventory/{module}` before `receivables/multiple`, so both specific routes are shadowed and answer 404 "Unknown Inventory module."
**Evidence:** replica output `GET api/inventory/receivables/items => index params={"module":"receivables/items"}`.
**Impact:** The PO-to-receipt step cannot be completed from the Next UI; the UI shows "Backend API required for this Inventory menu."
**Expected Behavior:** Specific routes win.
**Recommended Fix:** Reorder or constrain `module` to `[^/]+`.
**Verification:** Open Item Receivable and receive a PO.

## FIN-46
**Severity:** High   **Type:** Confirmed   (sub-audit A, INV-02, INV-04)
**Category:** Business Logic
**Module:** Inventory / stock
**Location:** `InventoryApiController.php:436,498,710,727-728,898-945,1083-1096`
**Function/Method:** direct purchase, allocations, returns, destroy
**Problem:** There is no stock ledger. `opening_stock` is changed only by item master edit and direct purchase; allocation, return and receive never change it; `direct_purchase_stock` is overwritten (not accumulated); deleting a purchase does not reverse stock; edit `decrement('opening_stock', old_qty)` has no floor (negative stock); allocation inserts on every call without a de-duplication guard; return has no stock effect.
**Evidence:** `update(['direct_purchase_stock' => $quantity])` (`:728`); `decrement('opening_stock', ...)` (`:710`).
**Impact:** Stock figures are unreliable; approval screen greys rows on `opening_stock === 0` (client-side only); the same requisition can be allocated repeatedly.
**Expected Behavior:** Movement ledger with balance checks.
**Recommended Fix:** Introduce `inventory_stock_ledger`; increment on receive/return, decrement on allocate; forbid negative.
**Verification:** Direct purchase twice, allocate, compare `opening_stock`.

## FIN-47
**Severity:** Medium   **Type:** Confirmed   (sub-audit A, INV-03)
**Category:** Business Logic
**Module:** Inventory / Direct purchase
**Location:** `InventoryApiController.php:691-735`; `app\Inventory\item_direct_purchase\ItemDirectPurchasePage.tsx:104`
**Function/Method:** `saveDirectPurchases`
**Problem:** No uniqueness on (vendor, bill_no, challan_no); button disabled only while busy.
**Evidence:** insert + `opening_stock` increment per POST.
**Impact:** Double-click/retry doubles purchase and stock.
**Expected Behavior:** Idempotent.
**Recommended Fix:** Unique key + idempotency key.
**Verification:** Double-submit.

## FIN-48
**Severity:** High   **Type:** Confirmed   (sub-audit A, INV-05/06/08/10/11)
**Category:** Business Logic
**Module:** Inventory / approval chain (requisition -> quotation -> PO)
**Location:** `InventoryApiController.php:737-768` (bulk approval), `:677-681,860` (quotation auto-approved), `:510-538` (PO), `:557-643,881-897` (negotiation/receive); `RequisitionApprovalPage.tsx:49,65-77,89`; `GeneratePoPage.tsx:18-24,75-80`
**Function/Method:** `saveRequisitionApprovals`, `saveQuotations`, `savePurchaseOrder`, `saveNegotiatePo`
**Problem:** (a) No maker-checker: requisition_by is never compared to the approver; `po_approved_by` = whoever posts. (b) Bulk approval skips the `approved_qty <= item_qty` check the single path has (`approved_qty` `nullable|numeric`, negatives allowed) and stores `requisition_status` unvalidated/NULL. (c) Quotations are inserted with `approved_status = 2, approved_by = $user` (auto-approved). (d) PO `dis_per`/`tax_per` are `numeric|min:0` with no max and unit price is not compared with the quotation (totals recomputed but inputs trusted; `dis_per=150` -> negative payable). (e) Negotiation can rewrite price/qty after approval; generic receive path does not require approved status. (f) Status ids 1/2 hard-coded.
**Evidence:** listed lines.
**Impact:** Purchasing controls can be bypassed by one user end-to-end; tampered price/discount accepted.
**Expected Behavior:** Segregation of duties, bounded inputs, price = quotation.
**Recommended Fix:** Server-side rules per step, status master validation, caps.
**Verification:** Post approvals with negative quantity; PO with `dis_per=150`.

## FIN-49
**Severity:** Medium   **Type:** Confirmed   (sub-audit A, INV-07/09)
**Category:** Business Logic
**Module:** Inventory / requisition creation and numbering
**Location:** `InventoryApiController.php:200-208,462-505,787-800,838-858`
**Function/Method:** `save`, `nextRequisitionNumber`
**Problem:** Omitting `items[]` sends the request to the generic workflow path that skips the own-user and active-item checks (`requisition_by` any integer); numbering breaks at the 100th requisition (`REQ-2026100` read back as `202610`) and `(int)"REQ-001"` is 0.
**Evidence:** listed lines.
**Impact:** Requisitions for other users/inactive items; duplicate/jumping numbers.
**Expected Behavior:** One validated path; robust sequence.
**Recommended Fix:** Remove generic path for requisitions; use a counter table.
**Verification:** Post without `items[]`.

## FIN-50
**Severity:** Medium   **Type:** Confirmed   (sub-audit A, INV-12/15)
**Category:** Database
**Module:** Inventory / reports and receipts
**Location:** `InventoryApiController.php:428-439` (overall item report), `:961-1014,1113-1116` (receive)
**Function/Method:** `reports/overall-items`, `saveReceivablesForModule`, `poItems`
**Problem:** The overall report left-joins one-to-many tables and sums (multiplied totals; `lost_sold_qty`/`returned_qty` count rows). Receive overwrites `ACTUAL_RECEIVED_QTY` with the last delivery (not cumulative) and joins receipts by item+PO number only (no tenant/year), leaking other tenants' receipts.
**Evidence:** listed lines.
**Impact:** Wrong closing inventory value; over-receipt possible; cross-tenant leakage in "previous received".
**Expected Behavior:** Pre-aggregated subqueries; cumulative receipts scoped by tenant.
**Recommended Fix:** Subquery aggregation; add tenant/year to joins.
**Verification:** Two receipts against one PO.

## FIN-51
**Severity:** High   **Type:** Potential   (sub-audit A, INV-13, LIB-07)
**Category:** Security
**Module:** Inventory / Library uploads
**Location:** `InventoryApiController.php:1040-1061` (`storeAs('public/inventory_item', ...)`, `logo`), `app\Inventory\_components\InventoryPage.tsx:93`; `library\BookController.php:265-277` (`Storage::disk('books')->put($clientName, ...)`, disk root `public_path('/uploads/books')`)
**Function/Method:** `saveMaster`, `BookController::store`
**Problem:** No mime/extension/size validation; library keeps the client filename in a directly served folder (no tenant namespace - same name overwrites another tenant's file).
**Evidence:** listed.
**Impact:** `.php/.html/.svg` uploads: RCE or stored XSS depending on web-server config (NOT VERIFIED); cross-tenant overwrite.
**Expected Behavior:** Whitelist, random names, private disk.
**Recommended Fix:** `mimes` + `max`, `Str::uuid()` names.
**Verification:** Upload `x.svg` with script.

## FIN-52
**Severity:** Low   **Type:** Confirmed   (sub-audit A, INV-14, TRN-05, TRN-06, HST-05)
**Category:** Backend
**Module:** Inventory / Transportation / Hostel masters
**Location:** `InventoryApiController.php:118-160,239,1083-1096`; `TransportationApiController.php:126-131,252,617-633`; `HostelSetupApiController.php:339-378`
**Function/Method:** `options`, `destroy`, vendor `index`
**Problem:** Deletes have no reference checks (hard delete hostel/room/route/vehicle/item/vendor even when referenced; list joins then drop rows); `options()` runs ~35 queries per page and returns every active user's name/id, every enrolled student (id, name, enrollment_no) and vendors with `bank_account_no`, `pan_no`, `bank_ifsc_code` to any viewer of any single module; `po_items` key defined twice.
**Evidence:** listed.
**Impact:** Referential breaks, PII/financial data over-exposure inside the tenant, slow pages.
**Expected Behavior:** Soft delete/reference check; least-data options.
**Recommended Fix:** Guard deletes; split options per module.
**Verification:** Delete a room with an allocation.

## FIN-53
**Severity:** High   **Type:** Confirmed   (sub-audit A, HST-01)
**Category:** Business Logic
**Module:** Hostel / Room allocation
**Location:** `D:\lms_k12\app\hostel\setup-api.ts:185-195`; `app\hostel\_components\HostelModulePage.tsx:239-250`; `D:\next_lms_erp\app\Http\Controllers\api\HostelSetupApiController.php:75-78,686-697,708`
**Function/Method:** `saveAllocation`, `context`
**Problem:** The JSON body carries the actor in `user_id` but the allocation form overwrites it with the allocatee's id; `context()` requires `user_id == token id`, so saves fail 403 "Token context does not match the request." unless a user allocates themselves (body wins over query on JSON requests in Laravel 12).
**Evidence:** `{..., user_id: session.userId, ..., ...body}` then `values.user_id = allocatee`.
**Impact:** The core hostel allotment workflow cannot be completed from the Next UI (static reasoning, not executed).
**Expected Behavior:** Distinct `allocatee_id` field.
**Recommended Fix:** Rename the body field.
**Verification:** Allocate a student to a room.

## FIN-54
**Severity:** High   **Type:** Confirmed   (sub-audit A, HST-02, HST-03)
**Category:** Business Logic
**Module:** Hostel / capacity and double booking
**Location:** `HostelSetupApiController.php:682-749,809-811`; `HostelDashboardApiController.php`; migration `2023_03_05_115658_create_hostel_room_master_table.php`; `HostelModulePage.tsx:418-427`
**Function/Method:** `saveAllocation`, `availableRoomReport`
**Problem:** Uniqueness only per (user, group, year, tenant); no room capacity column, no bed uniqueness (`bed_no` free string), no room-in-hostel consistency, no allocatee-in-tenant/profile check, no gender rule; reports hard-code `1 as total_capacity`; dashboard `occupancy_rate = allocations/rooms*100` can exceed 100. No hostel fee link exists anywhere in hostel code.
**Evidence:** listed.
**Impact:** Unlimited people per room/bed; wrong availability; no billing.
**Expected Behavior:** Capacity, bed unique index, fee generation.
**Recommended Fix:** Add capacity and unique(room_id,bed_no,syear); link to fee heads.
**Verification:** Allocate two students to one bed.

## FIN-55
**Severity:** Medium   **Type:** Confirmed   (sub-audit A, HST-04/06)
**Category:** Frontend
**Module:** Hostel / visitor pages and wrappers
**Location:** `app/hostel/api.ts:146-198`; `routes/hostel_management.php:22,28`; `app/hostel/*` (12 hyphen/underscore duplicate dirs, `app/data/routeMapper.ts:238-263`); `HostelGapPage.tsx` (unused); `HostelOverviewPage.tsx`
**Function/Method:** n/a
**Problem:** Hostel visitor pages call the school gate-visitor APIs (visitor_master), not the hostel visitor tables that exist (`hostel_visitor_master`, `show_hostel_visitor_report`); duplicated route dirs; dead component; overview claims "12 Active Modules" while allocation is broken.
**Evidence:** listed.
**Impact:** Data mixed into the school log; maintenance duplication.
**Expected Behavior:** Correct backend, single route per page.
**Recommended Fix:** Wire to hostel visitor endpoints; dedupe.
**Verification:** Add a hostel visitor, check table.

## FIN-56
**Severity:** Medium   **Type:** Confirmed   (sub-audit A, TRN-01/02/03/04)
**Category:** Business Logic
**Module:** Transportation / student mapping and fare
**Location:** `D:\lms_k12\app\Transportation\student_transport_mapping\page.tsx:150-156,209-245`; `D:\next_lms_erp\app\Http\Controllers\api\TransportationApiController.php:455-461,512,527,574-601,679-703`
**Function/Method:** `priced`, `bulkStore`, `capacityError`
**Problem:** Fare (`amount`, `distance`) is computed in the browser and stored as sent (`nullable|numeric|min:0`); the two rate systems are disconnected (`transport_kilometer_rate` slabs never price a mapping; mapping uses shift rate/km amount) and no fee is generated from a mapping (only a tenant-specific hack in fees code); server does not check that the stop belongs to the bus, the drop bus to the drop shift, or drop-vehicle capacity; one-mapping-per-student and capacity are check-then-act without locks/unique index; `start_date`/`end_date` dropped versus legacy.
**Evidence:** listed.
**Impact:** Any caller can map with `amount:0`; overbooked vehicles; transport never billed.
**Expected Behavior:** Server-computed fare, consistency checks, fee link, unique key.
**Recommended Fix:** Compute fare server-side; validate stop/vehicle relations; unique(student_id,syear); create `fees_breakoff_other`.
**Verification:** POST mapping with `amount=0` and a stop from another bus.

## FIN-57
**Severity:** Critical   **Type:** Confirmed   (sub-audit A, TRN-07)
**Category:** Security
**Module:** Transportation / student route details
**Location:** `D:\next_lms_erp\routes\tranceport.php:38` (outside the auth group `:21-34`); `map_student_controller.php:284-325`
**Function/Method:** `fetchData`
**Problem:** `GET map_student/fetchData` has no session/JWT; tenant, student and year come from input; it returns driver and conductor names/mobiles, pickup/drop stops and the fare.
**Evidence:** query selects `fd.first_name from_driver, fd.mobile from_driver_mobile, fc.mobile from_conductor_mobile, tfs.stop_name from_stop, ..., tms.amount`.
**Impact:** Unauthenticated disclosure of a child's route plus driver/conductor phone numbers for any student id (child-safety relevant).
**Expected Behavior:** Authenticated, tenant from session, parent/teacher scope.
**Recommended Fix:** Move into the `session`+`check_permissions` group.
**Verification:** `GET /map_student/fetchData?sub_institute_id=1&student_id=1&syear=2025` anonymously.

## FIN-58
**Severity:** Medium   **Type:** Confirmed   (sub-audit A, TRN-08)
**Category:** Authorization
**Module:** Transportation / routes outside auth group
**Location:** `routes/tranceport.php:36-37,39,40,42`; `AJAXController.php:784-806`; `map_student_controller.php:521-553`
**Function/Method:** `getStopList`, `destroy`, student lists
**Problem:** `api/get-bus-list`, `api/get-stop-list` (no tenant filter), `ajaxCheckRemainCapacity`, `DELETE map_student/bulk-delete` (no `session`/`check_permissions`) and `transportationLists/studentLists/{t_id}/{t_s_id}` (names, mobile, address) sit outside the permission group.
**Evidence:** listed.
**Impact:** Any cookie session (even a student) can unmap students or list bus rosters; stop names leak across tenants.
**Expected Behavior:** All under session + permission.
**Recommended Fix:** Move routes into the guarded group.
**Verification:** Call bulk-delete as a student.

## FIN-59
**Severity:** High   **Type:** Confirmed   (sub-audit A, LIB-01)
**Category:** Business Logic
**Module:** Library / issue and availability
**Location:** `D:\next_lms_erp\app\Http\Controllers\library\BookController.php:505-582,697-713`; frontend: no issue UI (`app/library/book_resources/page.tsx:45-52`)
**Function/Method:** `issueBook`, `checkItemAvailability`
**Problem:** Issue validates only `student_id exists:tblstudent,id` (global) and dates; no availability, item-status (lost/damaged can be issued), tenant or copy-belongs-to-book check; duplicate check is student+book+item so the same copy can go to two students; re-issuing an open item just rewrites dates (unlimited renewal); `checkItemAvailability` queries `item_code` while circulations store `library_items.id`, so it never matches.
**Evidence:** listed.
**Impact:** Copies double-issued; copy counts meaningless; issue/return flows are absent in the Next UI (Missing).
**Expected Behavior:** Availability + status + tenant checks, renewal limits.
**Recommended Fix:** Fix column, add locks/unique open-loan index, implement UI.
**Verification:** Issue one copy to two students via legacy route.

## FIN-60
**Severity:** High   **Type:** Confirmed   (sub-audit A, LIB-02/04/05/06)
**Category:** Authorization
**Module:** Library / IDOR and tenant trust
**Location:** `BookController.php:478-495,453-470,202-204,246,391-425,670-695`; `itemScanController.php:71-73,250-256`; `itemVerificationController` update/destroy; frontend `book_resources/page.tsx:696`
**Function/Method:** `returnBook`, `destroy`, `deleteItem`, `store`, `show`, `allBookLists`, scan `store`, `remarksStore`
**Problem:** Unscoped `find($id)` for return/delete/edit/verification (state-changing GET `books/{id}/reutrn`, re-stamps `return_date`); `destroy` deletes any tenant's books by id list with only a client-side `ADMIN` name check; edit reassigns another tenant's book to the caller; `show`/`allBookLists` read tenant from the request and return full `tblstudent` rows; scan `store` takes tenant/year/user from the request (cross-tenant writes, spoofed `created_by`); `remarksStore` updates `library_items.item_status` by bare `item_code`, and item codes are per-tenant sequences starting `L00001`, so flagging one flips all schools.
**Evidence:** listed.
**Impact:** Cross-tenant read/modify/delete of library data and student records; audit forgery.
**Expected Behavior:** Tenant-scoped queries and role checks.
**Recommended Fix:** Add `where sub_institute_id = session`, POST/DELETE verbs, server role check.
**Verification:** Return/delete an id from another tenant.

## FIN-61
**Severity:** High   **Type:** Missing   (sub-audit A, LIB-03)
**Category:** Business Logic
**Module:** Library / fines
**Location:** `BookController.php:597-644` (`QuickReturnSearch`), `:478-495`; `lib/library/library-ai-stack.ts:24-27`
**Function/Method:** return handlers
**Problem:** No fine, penalty, late fee or lost/damage recovery exists; returns only set `return_date`; overdue is a report row, never an amount; return by id re-stamps date; quick return shows an empty table if the student has no enrollment this year.
**Evidence:** grep of controllers/models: no fine logic.
**Impact:** No revenue/recovery for overdue or lost books; copy accounting incomplete.
**Expected Behavior:** Due-date based fine with fee link.
**Recommended Fix:** Implement fine rules and post to fees.
**Verification:** Return a book 30 days late.

## FIN-62
**Severity:** Medium   **Type:** Confirmed   (sub-audit A, LIB-08/09/10/11/13/14)
**Category:** Backend
**Module:** Library / validation, counts, reports
**Location:** `BookController.php:190-331,291-311,344-357`; `LibraryDashboardApiController.php:41-66`; `LibraryReportController.php:158-170,262-284,290`; `book_resources/page.tsx:376`; `routes/api.php:883`
**Function/Method:** `store`, dashboard `summary`, `bookIssueDueReportCreate`, `PrintBarcodeCreate`
**Problem:** `store()` has no validation (`no_of_items` unbounded loop; shrinking count silently ignored; custom field names assigned dynamically; race-prone item codes; 5- vs 6-digit padding mismatch); dashboard counts ignore book soft-delete and drop earlier-year open loans; report name filter uses ungrouped `orWhere` (escapes other filters); barcode range loops unbounded and pads to 6 digits so 5-digit tenants find nothing; custom-field lookup calls `/fields-configuration` instead of `/api/fields-configuration` (custom fields never load); hard-coded tenants 47/254.
**Evidence:** listed.
**Impact:** Resource exhaustion, wrong counts, broken filters and printing.
**Expected Behavior:** Validated inputs, consistent counting.
**Recommended Fix:** FormRequest, group `orWhere`, cap ranges.
**Verification:** Post `no_of_items=9999999`.

## FIN-63
**Severity:** Medium   **Type:** Confirmed   (sub-audit A, LIB-12)
**Category:** Security
**Module:** Library / print helpers
**Location:** `app/library/quick_return/page.tsx:97`, `scan_book:94`, `add_book_remark:92`, `book_resources:319-332`, `issue_overdue_report:65` and 4 report pages
**Function/Method:** `printRows`
**Problem:** Print HTML built by string interpolation of student/book fields then `window.open('', '_blank')` + `document.write`.
**Evidence:** listed.
**Impact:** Stored XSS in a same-origin blank window (token in localStorage) if a title/name contains markup.
**Expected Behavior:** Escape values.
**Recommended Fix:** `escapeHtml` helper.
**Verification:** Book title `<img onerror=...>` then Print.

## FIN-64
**Severity:** Critical   **Type:** Confirmed   (sub-audit B, C-1)
**Category:** Security
**Module:** Utility / Custom module - arbitrary row deletion
**Location:** `D:\next_lms_erp\app\Http\Controllers\custom_module\CustomModuleController.php:857-876` (`viewDelete`); `D:\next_lms_erp\app\Models\DynamicModel.php:145-150` (`deleteRecord`); `routes/custom_module.php:6,30` (group has no `check_permissions`); frontend `D:\lms_k12\app\Utility\custom-module\api.ts:380-390`
**Function/Method:** `viewDelete`, `DynamicModel::deleteRecord`
**Problem:** `table_name` comes from the request and is passed to `DynamicModel::deleteRecord($request->table_name, $id)`; `initialize()` only checks `Schema::hasTable`. No tenant check, no `Z_` prefix check, no rights check.
**Evidence:** `if ($id > 0 && $request->table_name) { DynamicModel::deleteRecord($request->table_name, $id); }`
**Impact:** Any valid JWT (student included) can `DELETE custom-module/view-delete/{id}?table_name=tblstudent` (or `fees_collect`, `tbluser`) in any tenant.
**Expected Behavior:** Table resolved from a tenant-owned `CustomModuleTable` row only.
**Recommended Fix:** Resolve table server-side, require `Z_` prefix + tenant filter + rights.
**Verification:** Staging DELETE with `table_name=tblstudent`.

## FIN-65
**Severity:** Critical   **Type:** Confirmed injection (exploit chain Potential)   (sub-audit B, C-2)
**Category:** Security
**Module:** Utility / Custom module - DDL SQL injection
**Location:** `CustomModuleController.php:27,87-89,344,565,569,610,617,643-694`
**Function/Method:** `tableStore`, `tableDelete`, `createDBTable`, `tables`
**Problem:** Table/column names, types, lengths and defaults are interpolated into `CREATE/ALTER/DROP` and `SHOW TABLES LIKE` statements; only spaces are replaced and `Z_` prefixed (a name already starting `Z_` is kept verbatim).
**Evidence:** `DB::statement('DROP TABLE IF EXISTS ' . $table->table_name);` and `"DEFAULT '{$column['default']}'"`; e.g. `table_name = "Z_x, tbluser"` -> `DROP TABLE IF EXISTS Z_x, tbluser`. The `unique` rule validates the raw name not the stored `Z_` name (`:79`).
**Impact:** Drop or alter core tables; clone other tables via column-type injection. Stacked queries are off, so full exploitation is Potential.
**Expected Behavior:** Whitelisted identifiers, `Schema` builders.
**Recommended Fix:** `^Z_[A-Za-z0-9_]{1,50}$`, server-generated names, enum column types, quote identifiers.
**Verification:** Create a table named `Z_a, tblx` in staging.

## FIN-66
**Severity:** High   **Type:** Confirmed   (sub-audit B, V-1 remainder, V-2)
**Category:** Security
**Module:** Visitor management (public pages)
**Location:** `visitor_masterController.php:117-151,153-253,387,397,564-565`; `routes/visitor_management.php:18-25`; `resources/views/visitor_management/add_visitor_master.blade.php:238-252`
**Function/Method:** `create`, `store`, `get_sms_setting`, `send_sms`
**Problem:** Besides `add_visitorAPI` (FIN-39), the public `POST /visitor_management/add_visitor_master` and public `create()` page (`type=webForm`, tenant from query) render a `<datalist>` of every student's name and mobile number and the staff list for any tenant id; SMS gateway URL concatenates `$data->mobile_var.$visitor_contact` unencoded (parameter injection) and `send_sms()` disables TLS verification.
**Evidence:** as above.
**Impact:** Anonymous enumeration of student names + parent mobiles for any school; SMS abuse.
**Expected Behavior:** Authenticated or captcha/rate-limited kiosk with server-side search.
**Recommended Fix:** Remove lists, `urlencode` gateway params, verify TLS.
**Verification:** Open the public form with another tenant id.

## FIN-67
**Severity:** High   **Type:** Confirmed   (sub-audit B, V-3)
**Category:** Security
**Module:** Visitor pickup ("gate pass") OTP
**Location:** `visitor_masterController.php:432-486,488-559` (routes `visitor_management.php:12-15`; no frontend)
**Function/Method:** `sendOtpVisitor`, `confirmOtp`
**Problem:** The OTP is returned in the response (`$response['otp'] = $otp`, `:482`), an existing OTP is reused and never expires or clears despite the "valid 5 minutes" SMS, no attempt limit, student lookup has no tenant filter (`:513`), loose `==` compare (`:515`), `rand()`, hard-coded `visitor_type => 10` with immediate `out_time`.
**Evidence:** listed.
**Impact:** Any authenticated user can obtain the OTP and record a child "pickup"; replay indefinitely (child-safety relevant).
**Expected Behavior:** Single-use hashed OTP, TTL, attempt cap, never echoed.
**Recommended Fix:** Redesign with `random_int`, expiry column, throttling, tenant scope.
**Verification:** Call `sendOtpVisitor` and read the OTP in the JSON.

## FIN-68
**Severity:** High   **Type:** Confirmed   (sub-audit B, V-4, V-6)
**Category:** Security
**Module:** Visitor master update/delete
**Location:** `visitor_masterController.php:259,292-306,326,529-530`; `adminapiController.php:972-976`; frontend `app/hostel/_components/VisitorModulePage.tsx` (no check-out action)
**Function/Method:** `edit`, `update`, `destroy`
**Problem:** `unlink('storage/visitor_photo'.$request->input('hid_photo'))` with client-controlled name (arbitrary file delete via `../`); `update/destroy/edit` use `where(id)`/`find($id)` without tenant and `update` reassigns `sub_institute_id` to the caller; `date('h:i:s')` (12-hour) for `out_time` and photo names (AM/PM collision) vs `H:i:s` for in_time; pickup rows join `tbluser` on `to_meet` = student id and vanish from the list; UI has no check-out ("205 of 463 visits have no exit time" per the frontend descriptor).
**Evidence:** listed.
**Impact:** Arbitrary file deletion (e.g. `.env`), cross-tenant takeover, wrong visit durations.
**Expected Behavior:** Tenant-scoped, `basename()`, `Storage::delete`, 24-hour times, check-out UI.
**Recommended Fix:** As listed.
**Verification:** POST update with `hid_photo=/../../.env`.

## FIN-69
**Severity:** High   **Type:** Confirmed   (sub-audit B, U-1, U-2)
**Category:** Security
**Module:** Utility / Year rollover and student promotion
**Location:** `D:\next_lms_erp\app\Http\Controllers\student\rollOverController.php:690-704,720-837,867-875`; `transferStudentController.php:144-192,175-184`
**Function/Method:** `rollOverController::store`, `transferStudentController::transferStudent`
**Problem:** `from_current_syear`, `to_next_syear`, `to_academic_section`, `to_standard`, `to_division`, `students[]` / `stud_ids[]` are concatenated into `INSERT ... SELECT` SQL.
**Evidence:** `SELECT '".$to_next_syear."',...,".$to_academic_section.",".$to_standard.",".$to_division.",...WHERE se.student_id = '".$student_id."' AND se.syear = '".$from_current_syear."'`.
**Impact:** Injection into a bulk enrolment write; cross-tenant class ids; no rights gate (FIN-70).
**Expected Behavior:** Bound parameters, validated year/class ownership.
**Recommended Fix:** Bindings; validate `to_next_syear = syear+1` and class in tenant.
**Verification:** Post a quote in `stud_ids[]` in staging.

## FIN-70
**Severity:** High   **Type:** Potential (menu rows NOT VERIFIED)   (sub-audit B, U-3, U-4)
**Category:** Authorization
**Module:** Utility mutators / custom-module / front desk
**Location:** `checkPermission.php:38-44`; `app/data/routeMapper.ts:316-330` (menu links `rollover.index`, `student_transfer.index`, `student_bulk_update.index`, `transfer_student.index`); `rollOverController@create` (GET performs rollover, `:155-562`); `custom-module/create-db-table/{id}` (`routes/custom_module.php:19`); `routes/custom_module.php:6` and `student.php:206` groups without `check_permissions`; frontend `app/Utility/rollover/api.ts:114,125,140`
**Function/Method:** route groups
**Problem:** Mutating routes (`rollover.create/store`, `student_transfer.store`, `student_bulk_update.store`, `transfer_student`, `show_student`) have different names from the menu links, so `check_permissions` does not enforce; custom-module and front-desk groups have no permission middleware at all; several state changes (rollover, DDL) are GET requests.
**Evidence:** listed.
**Impact:** Any token (student/parent/teacher) can potentially run rollover, mass deactivation, transfers; GET mutators are prefetchable / CSRF-able (FIN-42).
**Expected Behavior:** Admin-only middleware, POST + confirmation.
**Recommended Fix:** Explicit `role:admin` middleware per route; convert GET mutators to POST.
**Verification:** Call `GET student/rollover/create?tables[]=...` with a teacher token in staging.

## FIN-71
**Severity:** High   **Type:** Confirmed logic (runtime NOT VERIFIED)   (sub-audit B, U-7, U-15)
**Category:** Business Logic
**Module:** Utility / Breakoff rollover - fee duplication
**Location:** `rollOverController.php:417,419-422,499,523-546,275-279,283,800`; `studentBulkUpdateController.php:103,115`; frontend claim `app/Utility/breakoff-rollover/api.ts:24`
**Function/Method:** `create` (advance-fee block), breakoff delete
**Problem:** `if($request->has('tables')=='fees_breackoff' && $request->has('tables')=='advance_fees')` compares a bool to strings, so the advance-fee block runs whenever `tables` is present; its `fees_collect` inserts have the idempotency check commented out; `if(count($config_check) > 0){ insert fees_config_master }` is inverted; breakoff rollover can produce NULL `month_id`; breakoff delete archives `section_id=0` and deletes without checking collected fees. The frontend says the flow "refuses to run twice", which the backend does not do.
**Evidence:** listed.
**Impact:** Duplicate `fees_collect` rows (financial), duplicate fee config, unrecoverable deleted fee structure.
**Expected Behavior:** Idempotent, guarded, transactional.
**Recommended Fix:** Fix condition, unique keys, transaction, paid-fees guard.
**Verification:** Run breakoff rollover twice in staging and count `fees_collect`.

## FIN-72
**Severity:** High   **Type:** Confirmed   (sub-audit B, U-8, U-2 duplicates)
**Category:** Business Logic
**Module:** Utility / Rollover and promotion - duplicate enrolments
**Location:** `rollOverController.php:849-863`; `transferStudentController.php:175-184,131,149-171`; frontend `app/Utility/_lib/students.ts:44` (`alreadyExists: false` hard-coded), `StudentSelectionTable.tsx:44-88`
**Function/Method:** `store`, `transferStudent`
**Problem:** Duplicate check covers only the same target class; rolling a student to a different class inserts a second next-year enrolment; mid-loop error returns after earlier students were inserted (no transaction); promote inserts ALL of a student's historical enrolment rows with `syear = current+1` (no `syear`/`end_date` filter, target class from client `hid_standardid`) and has no server idempotency; frontend lock logic is dead.
**Evidence:** listed.
**Impact:** Duplicate/incorrect enrolments after year-end, doubling fee demand for affected students.
**Expected Behavior:** One enrolment per (student, syear), per-student target class, transaction.
**Recommended Fix:** As listed + unique(student_id, syear, sub_institute_id).
**Verification:** Promote the same student twice.

## FIN-73
**Severity:** High   **Type:** Confirmed   (sub-audit B, U-9)
**Category:** Business Logic
**Module:** Utility / Inter-institute student transfer
**Location:** `studentTransferController.php:53,79-112,144-351` (esp. `:151,178-214,226-248`); frontend `app/Utility/student-transfer/page.tsx:100`
**Function/Method:** `create`, `index`, `store`
**Problem:** `to_sub_institute_id` never checked to belong to the same client; `create()`/`index()` leak any tenant's sections/standards/divisions/`school_setup` rows; the enrolment update filters only tenant+student (no `syear`) and rewrites ALL historical enrolments; `user_profile_id` update receives an array of objects (likely fatal); undefined `$get_new_student_quota_id`; fee check only for `from_syear`; no transaction/audit; the UI loads destination classes with a foreign tenant id, which the class-teacher API rejects (403) so submit is unreachable.
**Evidence:** listed.
**Impact:** Cross-tenant data disclosure and history destruction if reachable; feature unusable from Next UI.
**Expected Behavior:** Same-client validation, scoped updates, transaction, audit.
**Recommended Fix:** As listed.
**Verification:** Attempt a transfer with two tenants in staging.

## FIN-74
**Severity:** High   **Type:** Confirmed   (sub-audit B, U-6, U-13, U-14)
**Category:** Business Logic
**Module:** Utility / Update-all-data (bulk deactivate, Excel activate, leave rollover)
**Location:** `studentBulkUpdateController.php:68-80,133-151,216,222-264,285,334,397,423-424`; frontend `app/Utility/update-all-data/page.tsx:100`
**Function/Method:** `store`
**Problem:** Mass deactivation end-dates every active enrolment of the tenant for a client-supplied `syear`, without dry-run/transaction/audit, and always reports success (`empty()` on a Collection is never true); it does not update `tblstudent.status` (Excel path does); Excel upload stores to public dir with client extension and returns raw strings that the frontend renders as a green success; overwrites `end_date` of inactive rows; casual-leave branch reads `Earned Leave` (copy-paste), hard-coded leave type ids.
**Evidence:** listed.
**Impact:** Whole-school deactivation by one click (only `window.confirm`), inconsistent student status, wrong leave balances.
**Expected Behavior:** Preview count, admin-only, transaction, audit.
**Recommended Fix:** As listed.
**Verification:** Run bulk inactive in staging and compare `tblstudent.status`.

## FIN-75
**Severity:** High   **Type:** Potential (live columns NOT VERIFIED)   (sub-audit B, U-10, F-7)
**Category:** Security
**Module:** Student search results (rollover/transfer/parent communication)
**Location:** `app/Helpers/Helper.php:847` (`SearchStudent` `ts.*`); `rollOverController.php:622`; `studentTransferController.php:86`; `parentCommunicationController.php:85` (`s.*`); `studentBulkUpdateController.php:38,48`; migration `2023_03_05_115658_create_tblstudent_table.php:33` (`password`)
**Function/Method:** `SearchStudent`
**Problem:** Full student rows (possibly password, aadhaar, LC number...) are returned to the browser though the UI reads a few fields.
**Evidence:** listed.
**Impact:** Sensitive PII/credentials in network responses.
**Expected Behavior:** Explicit column lists.
**Recommended Fix:** Select needed columns; count queries.
**Verification:** Inspect the JSON of `student/show_student`.

## FIN-76
**Severity:** High   **Type:** Confirmed   (sub-audit B, F-1, G-3)
**Category:** Authorization
**Module:** Front desk (gallery, calendar, circular, exam schedule, parent communication) / petty cash
**Location:** `PhotoVideoGallaryApiController.php:16-35,66,137,210,263` (`routes/api.php:806-809`, no `session` mw); `calendar_api_controller.php:24-97`; `circularController.php:46-47,262-265,493-503`; `CircularReportController.php:14-16`; `parentCommunicationController.php:54-56`; `exam_scheduleController.php:163-170`; `FrontDeskApiController` (`isAdmin($userId,...)` uses client `user_id`); `PettyCashApiController` (`routes/api.php:820-829`)
**Function/Method:** listed
**Problem:** These validate only that a JWT exists (`Jv`) and use tenant/year/user from the request; `destroy` of exam schedule and circular has no tenant filter; front-desk admin check trusts a client `user_id`; petty-cash takes tenant/user from the request (spoofed `created_by`) and `amount` is an integer column.
**Evidence:** listed.
**Impact:** Any school user can read/create/delete another school's gallery, calendar, circulars (which trigger push notifications), exam schedule and petty-cash records.
**Expected Behavior:** Tenant/user from token.
**Recommended Fix:** Use the hydrated session / compare to JWT payload (as `ClassTeacherApiController.php:73-77` does).
**Verification:** Replay with another tenant id.

## FIN-77
**Severity:** High   **Type:** Potential (web-server config NOT VERIFIED)   (sub-audit B, F-2, C-3, B-4, I-5; also FIN-38, FIN-51)
**Category:** Security
**Module:** Uploads across front desk / inward / custom-module / bazar / petty cash
**Location:** `PhotoVideoGallaryApiController.php:153-157,231-237`; `circularController.php:282-286`; `exam_scheduleController.php:84-89`; `FrontDeskApiController.php:122-125`; `PettyCashApiController.php:119-122`; `visitor_masterController.php:201-208`; `inwardController.php:122-130,231-239`; `studentBulkUpdateController.php:137-151`; `CustomModuleController.php:778-813` (`move(public_path('images'), time().'.'.$clientExt)`); `routes/lms.php:361-371` (bazar); frontend limits only `accept="image/*"` (`front_desk/_lib/modules.ts:230`, `inward_outward/_components/RegisterPage.tsx:105`)
**Function/Method:** upload handlers
**Problem:** Extension from client name, no mime/size validation, public web-served directories, predictable names (`date('YmdHis')`/`time()`), attachments not deleted on replace; inward files at `/storage/inward/<timestamp>.<ext>` are guessable so documents are readable unauthenticated.
**Evidence:** listed.
**Impact:** `.php/.html/.svg` upload leads to RCE or stored XSS depending on server config; unauthenticated read of inward documents; DoS by size.
**Expected Behavior:** Whitelist, random names, private disk with authenticated download.
**Recommended Fix:** `mimes` + `max`, `Str::uuid()`.
**Verification:** Upload an `.svg` with script through gallery.

## FIN-78
**Severity:** High   **Type:** Confirmed   (sub-audit B, I-1)
**Category:** Frontend
**Module:** Inward/Outward masters and registers - Delete
**Location:** `D:\lms_k12\app\inward_outward\_lib\api.ts:126-139`; backend `inwardController.php:202-253`, `outwardController`, `Helper.php:87-122`
**Function/Method:** `deleteResource`, `mutateForm`
**Problem:** `deleteResource` sets `_method=DELETE` then calls `mutateForm(path,'PUT',form)` whose `if (method === 'PUT') form.set('_method','PUT')` overwrites it, so the request runs `update()` with null fields; inward/outward `update()` has no validation and non-strict MySQL (`config/database.php:59 'strict' => false`) stores `''`/`0`; masters exit with a plain-text validation message.
**Evidence:** listed.
**Impact:** Clicking Delete blanks the record instead of deleting it (live effect NOT VERIFIED).
**Expected Behavior:** Real DELETE.
**Recommended Fix:** Fix method handling; validate in `update()`.
**Verification:** Delete an inward entry in staging.

## FIN-79
**Severity:** High   **Type:** Confirmed / Potential   (sub-audit B, I-2, I-3)
**Category:** Business Logic
**Module:** Inward/Outward numbering and add
**Location:** `inwardController.php:86-95,135`; `D:\lms_k12\app\inward_outward\_lib\api.ts:122`; `_components/RegisterPage.tsx:101`; migration `2023_03_05_115658_create_inward_table.php`
**Function/Method:** `create`, `store`, `beginCreate`
**Problem:** Next number is computed with `CAST(inward_number AS INT)` (invalid MySQL) and handed to Blade via `view()->share`, so the JSON never contains it; the frontend submits an empty read-only number and never sends `acedemic_year` (NOT NULL in migration); numbering is picked at form-open, saved from client input, with no lock/unique index (duplicates).
**Evidence:** listed.
**Impact:** Adding inward/outward entries from the Next UI likely fails or produces blank/duplicate numbers.
**Expected Behavior:** Number assigned inside a transaction on save.
**Recommended Fix:** Counter table with unique key; send year.
**Verification:** Add an inward entry in staging.

## FIN-80
**Severity:** High   **Type:** Confirmed   (sub-audit B, I-6)
**Category:** Authorization
**Module:** Inward/Outward tenant scoping
**Location:** `inwardController.php:44-45,80-81,118-119,185,247,273`; `outwardController.php:239,265`; `place_masterController.php:24-28,87,100`; `physical_file_locationController`
**Function/Method:** index/store/edit/update/destroy
**Problem:** Request tenant used; `update/destroy/edit` unscoped by tenant; deleting a master row hides dependent rows (INNER JOIN listing).
**Evidence:** listed.
**Impact:** Cross-tenant read/modify/delete of correspondence registers.
**Expected Behavior:** Tenant from token; FK checks.
**Recommended Fix:** As listed.
**Verification:** Update an id of another tenant.

## FIN-81
**Severity:** High   **Type:** Confirmed   (sub-audit B, C-4, C-5)
**Category:** Authorization
**Module:** Utility / Custom module - IDOR, rights and menu side effects
**Location:** `CustomModuleController.php:83,105,329,331-340,398-402,413,451,478-482,484,493-547,552,741,762`; `DynamicModel.php:101-113`; `routes/custom_module.php:6,39`; frontend `custom-module/api.ts:361`
**Function/Method:** table/column/crud actions
**Problem:** Lookups by `find($id)` without tenant (edit reassigns `sub_institute_id` to the caller); `DynamicModel::readRecords/updateRecord/readSingleRecord` unscoped and table names global, so tenant B can map a module to tenant A's physical table and list its rows; `tableDelete` deletes `tblmenumaster/tblgroupwise_rights/tblindividual_rights/tblprofilewise_menu` by user-controlled `access_link` (a link equal to a core menu deletes that menu and all tenants' rights); `createDBTable` inserts menu/rights rows using client-supplied tenant/user/profile; frontend never sends `user_profile_id`, so new modules get `profile_id` NULL rights (unusable for non-super-admin). `menuLevel2` is unauthenticated.
**Evidence:** listed.
**Impact:** Cross-tenant data access, deletion of core menus/rights, broken feature.
**Expected Behavior:** Tenant-prefixed tables, scoped lookups, rights on every route.
**Recommended Fix:** As listed.
**Verification:** Delete a custom table whose `access_link` equals `rollover.index`.

## FIN-82
**Severity:** High   **Type:** Confirmed   (sub-audit B, B-1..B-4)
**Category:** Security
**Module:** Bazar bulk upload
**Location:** `D:\next_lms_erp\app\Http\Controllers\api\MigrationModulesApiController.php:17-23,64,67-68`; `routes/api.php:173-174`; `routes/lms.php:361-371`; frontend `D:\lms_k12\app\bazar\bulk-upload\BazarUploadPage.tsx:38`
**Function/Method:** `bazarUpload`, `bazarReport`, `guard`
**Problem:** Data written to `sharebazar_position/_margin/_pnl` carries no `sub_institute_id` or uploader; the report reads the whole table for any token (student included); `guard()` checks only JWT validity plus client tenant/user; upload validates `mimes:xls,xlsx` but no `max`, loads the whole sheet in memory, imports the trailing totals row (legacy skipped it: `$rowCount - 1`), positional `array_combine` with no numeric validation, no duplicate guard; `destroy` filters tenant for only 4 modules; frontend posts directly to `localStorage.host_name` with the bearer token; legacy `store_position_data` route stores to public `public/bazar` with client extension.
**Evidence:** listed.
**Impact:** Any user reads/uploads market/financial position data; duplicated uploads and doubled totals; token exposure on tampered host.
**Expected Behavior:** Tenant/owner columns, admin-only, checksum de-dup.
**Recommended Fix:** As listed.
**Verification:** Upload the same file twice; read report as a student.

## FIN-83
**Severity:** Medium   **Type:** Confirmed   (sub-audit B, U-5, U-11, U-15, U-16)
**Category:** Business Logic
**Module:** Utility / year-end misc
**Location:** `HydratesLegacyApiSession.php` (`syear` from input); `rollOverController.php:159,192-193,275-279,308,374-415,553-556,698`; `LogRouteMiddleware.php:22`; `lib/utility/utility-ai-stack.ts`
**Function/Method:** rollover, context hydration
**Problem:** `syear`/`to_next_syear` not validated against the tenant's `academic_year`; academic-year dates advanced by `INTERVAL 365 DAY` (leap drift); message counts overcount by one and re-run returns status "0"; students without `next_grade_id` silently skipped so `remaining` never reaches 0; master tables idempotent only via `count(next-year rows)==0` (race, single row blocks table); `create()` and `store()` implement different optional-subject logic; hard-coded tenant 254; no rollover/transfer/bulk-update audit log at all (LogRoute skips API; the frontend descriptor admits "No rollover log, no transfer log, no bulk-update audit exists anywhere").
**Evidence:** listed.
**Impact:** Year-end data quality and traceability risk.
**Expected Behavior:** Validated years, audit rows, idempotent per-table keys.
**Recommended Fix:** As listed.
**Verification:** Run rollover twice; check counts and logs.

## FIN-84
**Severity:** Medium   **Type:** Confirmed   (sub-audit B, F-3, F-4, F-5, F-6)
**Category:** Backend
**Module:** Front desk / Gallery, calendar, timetable
**Location:** `PhotoVideoGallaryApiController.php:148-181,161,230`; `ModuleWorkbench.tsx:163-165`; `calendar_api_controller.php:54`; `timetableController.php:1005-1015,1061-1160`; frontend `create-timetable/page.tsx:266-289`, `GalleryAlbums.tsx:349`
**Function/Method:** gallery store, calendar store, `saveTimetableEntryApi`
**Problem:** Gallery re-stores every attachment per std x div but keeps only the last file name (multi-photo albums lose photos, storage duplicated); `youtube_link` unvalidated and rendered as a link; calendar date sent as client-local epoch ms converted with server timezone; timetable save validates only presence/weekday - ids not verified to belong to tenant, subject not mapped to standard, teacher not a Teacher, teacher-load join lacks `syear`, conflict check + insert not transactional, batch change inserts a new row, frontend fires N parallel saves and does not roll back partial success.
**Evidence:** listed.
**Impact:** Lost media, wrong dates, inconsistent timetables.
**Expected Behavior:** Validated, atomic saves.
**Recommended Fix:** As listed.
**Verification:** Upload 3 photos to an album; save a timetable with a foreign teacher id.

## FIN-85
**Severity:** Medium   **Type:** Confirmed   (sub-audit B, G-6, P-1)
**Category:** Backend
**Module:** Implementation master / Petty cash
**Location:** `implementation_MasterController.php:64-126` (`saveData`); `PettyCashApiController.php:119-122`; frontend `app/admin-services/petty-cash*`, `admin-services/_lib/pettyCash.ts`
**Function/Method:** `saveData`, petty-cash `store`
**Problem:** `saveData` copies every request key into the insert after setting tenant/year from session, so client keys override tenant/year and become column names; `store()` deletes the tenant's rows first without a transaction. Petty cash (frontend exists under `app/admin-services`, outside the listed dirs) accepts client tenant/user, stores bills with client extension, `amount` INT (fractions rejected); only the API controller was skimmed, so balance calculation and the Blade reports are NOT VERIFIED.
**Evidence:** listed.
**Impact:** Mass-assignment/tenant override; spoofed petty-cash creator.
**Expected Behavior:** Whitelisted columns, token identity.
**Recommended Fix:** `only([...])`; session identity.
**Verification:** Post `sub_institute_id=<other>` to implementation save.

## FIN-86
**Severity:** Low   **Type:** Confirmed   (sub-audit A and B minor items)
**Category:** Other
**Module:** Misc low / info
**Location:** `visitor_masterController.php:453-457,519`; `rollOverController.php:308`; `ClassTeacherApiController.php:92-118` (menu link `/classteacher`); `app/Utility/*` `window.confirm` only guard (15 sites); `routes/custom_module.php:21-25,39`; `ValidateInsertData` (`Helper.php:87-122`, prints text and `exit`s); `reports.ts` dead `createTimetable` config; `MigrationModulesApiController.php:64` (tenant filter only for 4 modules); `app/api/proxy/route.ts:58,120` (error body leaks backend URL `target`)
**Function/Method:** n/a
**Problem:** Hard-coded tenant/type ids (254, 49/232/233/47, visitor_type 10, leave types 9/1); every Utility class filter requires `can_view` on menu link `/classteacher` (admins without it see empty filters, NOT VERIFIED); confirmation is only `window.confirm`; custom-module reads `custom_module_tables` on every request and user data defines route names (collision can shadow routes); helper validation exits with non-JSON; dead frontend config; proxy error leaks backend URL.
**Evidence:** listed.
**Impact:** Maintainability and small disclosure issues.
**Expected Behavior:** Config-driven, JSON errors.
**Recommended Fix:** Clean up.
**Verification:** n/a.


ISSUE COUNTS: C=9 H=45 M=26 L=6 I=0

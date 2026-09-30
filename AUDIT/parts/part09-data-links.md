# part09 data - Link integrity, orphan pages, duplicates, case hazards

Method: every string literal in 2,071 tracked TS/TSX/JS files (excluding K-12 ERP Design System, g2g, .kilo, .codex, .claude) was extracted with the TypeScript AST (163,392 literals; template literals with same-file / exported constants resolved). Literals beginning with "/" in navigation contexts were resolved against the 676-route inventory, case-sensitively, applying the next.config.ts rewrites.

Nav-context literals examined: 2360 (2004 resolve, 356 do not; of the latter 60 resolve only case-insensitively - all of these are lower-cased lookup KEYS in registries, not navigation targets). Strong navigation contexts in non-API files: 678, unresolved 29.

## 1. Broken internal navigation links (confirmed navigations)

| # | Link | Context | File:line | Why it breaks |
|---|---|---|---|---|
| 1 | `/fees` | jsx-href QuickActionLink | app/dashboard/AdminDashboard.tsx:107 | app/fees has no page.tsx at its root (51 pages beneath it, none at /fees) |
| 2 | `/reports` | jsx-href QuickActionLink | app/dashboard/AdminDashboard.tsx:108 | app/reports has 4 sub-pages, no root page.tsx |
| 3 | `/settings` | jsx-href QuickActionLink | app/dashboard/AdminDashboard.tsx:109 | only app/settings/biomatrix/page.tsx exists |
| 4 | `/module/hrit-solutions/leave-management/${submenu}${query}` | router.push | app/hrit/leave-management/leave-dashboard/page.tsx:203 | no /module (singular) route; the dynamic module route is /modules/[moduleKey]/[categoryKey] |
| 5 | `/module/talent-management/onboarding/onboarding` | router.push | app/talent-management/recruitment/components/recruitment-center.tsx:1019 | same - /module/... does not exist |
| 6 | `/hrit` | router.push | app/talent-management/onboarding/components/onboarding-center.tsx:1118 | app/hrit has layout.tsx but no root page.tsx (handler `onViewEmployee`) |
| 7 | `/content/Jobrole-library` | router.push | app/talent-management/recruitment/components/job-posting-form.tsx:307 | no /content route at all ("Add New Job Role" button) |

### 1b. Module-root routes used as prefixes but with no page (components/intelligence/module/registry.ts, prop `route`)

These are used as `${route}/intelligence`, so they only break if something navigates to the bare module root: /fees (:216), /attendance (:365), /students (:395), /academic_setup (:436), /admissions (:457, has dashboard etc.), /exam (:477), /library (:504), /Transportation (:547), /user (:564), /easy_com (:651), /Inventory (:687), /admin-services/visitor (:704), /inward_outward (:731). None has a root page.tsx (see route table). Canonical Intelligence routes are /modules/<slug>/intelligence (valid via the dynamic route).

## 2. Menu-link mapper: mapApiLinkToRoute() outputs that resolve to non-existent pages

How menus work: the sidebar is data-driven (Laravel `tblmenumaster.link` returned at login, mapped by app/data/routeMapper.ts `mapApiLinkToRoute`). The function was executed (tsx, pure function) over the 553 string keys found in the file (map keys, case clauses) plus the 80 link values seeded by Laravel migrations (570 distinct keys). 517 of 553 file keys resolve to an existing page; the 36 below map to pages that do not exist (the app has /result/marks-entry etc. - hyphenated - while the early-return maps still emit the legacy underscore paths):

| # | Menu link key (DB link) | mapApiLinkToRoute() returns | Existing page that was probably intended |
|---|---|---|---|
| 1 | `marks_entry.index` | `/result/marks_entry` | /result/marks-entry |
| 2 | `co_scholastic_marks_entry.index` | `/result/co_scholastic_marks_entry` | /result/co-scholastic-marks |
| 3 | `result-template.index` | `/result/result-template` | /result/templates |
| 4 | `student-result.index` | `/result/student-result` | /result/report-card |
| 5 | `result_activity_marks.index` | `/result/result_activity_marks` | /result/hpc-activity-entry |
| 6 | `result_activity_marks_v1.index` | `/result/result_activity_marks_V1` | /result/hpc-entry-v1 |
| 7 | `approve_mobile_result.index` | `/result/approve_mobile_result` | /result/approve-mobile-result |
| 8 | `upload_result.index` | `/result/upload_result` | /result/upload-result |
| 9 | `exam_master.index` | `/result/exam_master` | /result/master/exam-master |
| 10 | `exam_type_master.index` | `/result/exam_master` | /result/master/exam-master |
| 11 | `exam_creation.index` | `/result/exam_creation` | /result/master/[slug] |
| 12 | `grade_master.index` | `/result/grade_master` | /result/master/grade-master |
| 13 | `std_grd_maping.index` | `/result/std_grd_maping` | /result/master/[slug] |
| 14 | `result_master.index` | `/result/result_master` | /result/master/[slug] |
| 15 | `result_book_master.index` | `/result/result_book_master` | /result/master/[slug] |
| 16 | `result_remark_master.index` | `/result/result_remark_master` | /result/master/[slug] |
| 17 | `co_scholastic_master.index` | `/result/co_scholastic_master` | /result/master/[slug] |
| 18 | `working_day_master.index` | `/result/working_day_master` | /result/master/[slug] |
| 19 | `student_attendance_master.index` | `/result/student_attendance_master` | /result/student-attendance |
| 20 | `result_skillset.index` | `/result/result_skillset` | /result/master/[slug] |
| 21 | `result_activity_master.index` | `/result/result_activity_master` | /result/master/[slug] |
| 22 | `show_result_report` | `/result/result_report` | /result/reports |
| 23 | `result/show_result_report` | `/result/result_report` | /result/reports |
| 24 | `marks_approval_report.index` | `/result/marks_approval_report` | /result/reports/marks-approval |
| 25 | `classwise_grade_report.index` | `/result/classwise_grade_report` | /result/reports/classwise-grade |
| 26 | `student_result_remarks.index` | `/result/student_result_remarks` | /result/student-result-remarks |
| 27 | `student-result-remarks.index` | `/result/student_result_remarks` | /result/student-result-remarks |
| 28 | `consolidate_report.index` | `/result/consolidate_report` | /result/reports/consolidate |
| 29 | `wrt_report.index` | `/result/WRT_report` | /result/reports/wrt |
| 30 | `wrt_progress_report.index` | `/result/WRT_progress_report` | /result/reports/wrt-progress |
| 31 | `result/wrt_report` | `/result/WRT_report` | /result/reports/wrt |
| 32 | `result/wrt_progress_report` | `/result/WRT_progress_report` | /result/reports/wrt-progress |
| 33 | `cbse_result.index` | `/result/cbse_result` | /result/report-card/cbse-1t5 |
| 34 | `cbse_result_t2.index` | `/result/cbse_result_t2` | /result/report-card/cbse-t2 |
| 35 | `cbse_11_result.index` | `/result/cbse_11_result` | /result/report-card/cbse-11 |
| 36 | `cnse_11_result.index` | `/result/cnse_11_result` | /result/report-card/cnse-11 |

Severity note: a later, more specific override map inside the same function (`resultRoutes`, routeMapper.ts ~L1060-1150) corrects the `result/<name>` (path-style) keys, so only the Laravel *route-name* style keys above (e.g. `marks_entry.index`) are affected. Legacy Laravel menus store route names in `tblmenumaster.link` (the `check_permissions` middleware matches `link` against route names), so these are likely live - NOT VERIFIED against production data.

## 3. Menu links seeded by Laravel migrations that resolve to no page

Harvested from `'link' => '...'` in D:\next_lms_erp\database (80 distinct values; older menu rows predating the migrations are not in the repo). Resolved through mapApiLinkToRoute(): 63 resolve, 17 do not:

| # | Seeded link | Mapped route | Note |
|---|---|---|---|
| 1 | `ai_admin` | `/ai_admin` | AI Admin module: no /ai_admin pages exist (AI screens live under /ai/*) |
| 2 | `ai_admin.agents` | `/ai_admin.agents` | AI Admin module: no /ai_admin pages exist (AI screens live under /ai/*) |
| 3 | `ai_admin.audit-logs` | `/ai_admin.audit-logs` | AI Admin module: no /ai_admin pages exist (AI screens live under /ai/*) |
| 4 | `ai_admin.knowledge-graph` | `/ai_admin.knowledge-graph` | AI Admin module: no /ai_admin pages exist (AI screens live under /ai/*) |
| 5 | `ai_admin.ontology` | `/ai_admin.ontology` | AI Admin module: no /ai_admin pages exist (AI screens live under /ai/*) |
| 6 | `ai_admin.templates` | `/ai_admin.templates` | AI Admin module: no /ai_admin pages exist (AI screens live under /ai/*) |
| 7 | `ai_admin.workflows` | `/ai_admin.workflows` | AI Admin module: no /ai_admin pages exist (AI screens live under /ai/*) |
| 8 | `employee_salary_structure.index` | `/employee_salary_structure.index` | HRIT payroll/attendance legacy route name not in the mapper |
| 9 | `form16.index` | `/form16.index` | HRIT payroll/attendance legacy route name not in the mapper |
| 10 | `hrit_attendance_management.index` | `/hrit_attendance_management.index` | HRIT payroll/attendance legacy route name not in the mapper |
| 11 | `hrit_leave_management.index` | `/hrit_leave_management.index` | HRIT payroll/attendance legacy route name not in the mapper |
| 12 | `hrit_payroll_management.index` | `/hrit_payroll_management.index` | HRIT payroll/attendance legacy route name not in the mapper |
| 13 | `hrms_attendance.index` | `/hrms_attendance.index` | HRIT payroll/attendance legacy route name not in the mapper |
| 14 | `hrms_attendance_report.index` | `/hrms_attendance_report.index` | HRIT payroll/attendance legacy route name not in the mapper |
| 15 | `hrms_salary_certificate.index` | `/hrms_salary_certificate.index` | HRIT payroll/attendance legacy route name not in the mapper |
| 16 | `payroll_deduction.index` | `/payroll_deduction.index` | HRIT payroll/attendance legacy route name not in the mapper |
| 17 | `payroll_type.index` | `/payroll_type.index` | HRIT payroll/attendance legacy route name not in the mapper |

The generated registry (app/_lib/module-screens.generated.ts header comment) states "54 of the seeded menus point at legacy Laravel route names with nothing behind them" - consistent with the above; the production count is NOT VERIFIED (no DB access).

## 4. app/lib/routes.ts (ROUTES registry)

81 string entries, 31 of which point at non-existent pages (the whole `result.*` block uses legacy underscore paths e.g. `/result/marks_entry`, plus `students.searchStudent` etc.). The registry is imported by only 2 files (app/Utility/page.tsx, app/admin-services/page.tsx) and only `ROUTES.utility.*` / `ROUTES.adminServices.*` are read, so the broken entries are dead data - a maintenance trap rather than a live bug.

## 5. Case-sensitivity hazards (Linux / Vercel are case-sensitive; the team develops on Windows)

- Tracked directories/pages with upper-case characters in the URL path: **62 routes** (Inventory 23, Transportation 15, Utility 8, admission-Enquiry 1, admissions/admission_followUp, classteacherReport, fees/NACH_* x4, lms/lmsAnnotate_assignment(+[id]), lmsAssignment, lmsAssignment_submission, lmsProject, lmsWorksheet, lms_teacherResource, organization_managment/Department, students/ICards). Full list in the route table (flag UPPERCASE-in-path).
- git has no case-only path collisions (`git ls-files | lower | uniq -d` = empty) and **0 import specifiers differ in case from the file on disk** (2,223 files, 7,620 edges checked with a case-sensitive resolver) - so the build itself is safe on Linux.
- Runtime lookups are case-insensitive by design in the module registry (`normalizeScreenRoute` lower-cases; keys in module-screens.generated.ts are lower-case, e.g. `/inventory/generate_po` -> `@/app/Inventory/generate_po/page`), which masks the problem for tabs. But any menu link or `router.push` that uses the lower-case form (`/inventory/...`, `/transportation/...`, `/utility/...`) as a URL will 404 on a case-sensitive host: Next matches route segments case-sensitively.
- The mixed-case folder `app/admission-Enquiry` is why next.config.ts needs the rewrite `/admission-enquiry` -> `/admission-Enquiry`; any external/bookmarked `/admission-enquiry` link relies on that rewrite.
- routeMapper maps DB links such as `transportation/add_route` to `/Transportation/add_route` explicitly (RESULT_ROUTE_NAME_MAP etc.) - a sign the issue was met and patched per-route rather than fixed by renaming the folders.

## 6. Near-duplicate / duplicate routes

### 6a. Identical hyphen/underscore twins - app/hostel (12 pairs, all 5-line wrappers around HostelModulePage, byte-identical except floor-master/floor_master which differ by one line)

| kebab-case route | snake_case route |
|---|---|
| `/hostel/admission-category-master` | `/hostel/admission_category_master` |
| `/hostel/available-room-report` | `/hostel/available_room_report` |
| `/hostel/building-master` | `/hostel/building_master` |
| `/hostel/floor-master` | `/hostel/floor_master` |
| `/hostel/hostel-master` | `/hostel/hostel_master` |
| `/hostel/hostel-report` | `/hostel/hostel_report` |
| `/hostel/hostel-room-allocation` | `/hostel/hostel_room_allocation` |
| `/hostel/room-master` | `/hostel/room_master` |
| `/hostel/room-type-master` | `/hostel/room_type_master` |
| `/hostel/type-master` | `/hostel/type_master` |
| `/hostel/visitor-details` | `/hostel/visitor_details` |
| `/hostel/visitor-report` | `/hostel/visitor_report` |

### 6b. Other same-purpose route pairs (line counts from wc -l; diff lines from diff)

| Route A | Route B | Relationship |
|---|---|---|
| /pal/framework (18 lines) | /pal/frameworks (20 lines) | near-identical (26 differing lines) |
| /exam/marks-entry (654) | /result/marks-entry (447) | two independent implementations of marks entry (1,101 differing lines) |
| /exam/exam-master (516) | /result/master/exam-master (46) | two exam-master screens |
| /Utility/student-transfer (389) | /Utility/transfer-student (192) | two student-transfer screens; both linked from routeMapper |
| /admission-Enquiry (384) | /admissions/admission_enquiry (1,892) | legacy public enquiry form vs staff enquiry manager; rewrite maps the lower-case URL to the former |
| /admissions/admission_registration (504) | /admissions/registration (3) | registration is a 3-line wrapper, rewrite /admission-registration -> /admissions/registration |
| /admissions/confirmation (699) | /admissions/admission_confirmation (1) | 1-line wrapper |
| /organization-management/* | /organization_managment/* | two modules with different pages (Department 2,152 lines, oragnization_profile) - "managment"/"oragnization" misspelt folder names; organization-management has 5 pages (ai-stack, compliance-library, disciplinary-library, employee-directory, role-and-permissions) |
| /student/* (35 pages) | /students/* (12 pages) | two sibling modules (student master/attendance/ICard vs students dashboard/ICards/house/leave/requests) - /student/student_attendance vs /result/student-attendance also duplicate |
| /sqaa (ai-stack only) | /sqaa_master , /sqaa_document_report | three separate top-level folders for one SQAA module |
| /classteacher (428) | /classteacherReport (462) | separate pages (different purpose) |
| /proxy_report (677) | /todays_proxy_report (304) | separate pages; note /proxy_master too - 3 top-level proxy* folders |
| /integration/online-fees-settings (19) | /fees/online-fees-settings (199) | integration one is a thin wrapper |
| /integration/whatsapp-api (19) | /easy_com/whatsapp_api (39) | wrapper vs page |
| /admin-services/visitor-report (141) | /hostel/visitor-report (5) | different modules, same name |
| /fees/{communication,help-guide-support,master-setup,onboarding,operations,process-builder,reports,scheduler,workflow} | /teach-learn/{same} | same-named category pages duplicated across fees and teach-learn (several are orphans, see section 7) |

### 6c. Same leaf name across modules (33 groups, mechanical) - top offenders

ai-stack x33 routes, intelligence x17, dashboard x10, onboarding x4, report(s) x9, create x14 (h5p). Full grouping in scratch output.

## 7. Orphan pages (80) - no static reference from any link, menu registry, mapper output or rewrite

Definition: no T1-T4 reference (see legend in part09-data-frontend-routes.md). Because the sidebar is DB-driven (tblmenumaster), a page listed here can still be reachable if a DB menu row points at its path (mapApiLinkToRoute default is "/" + link). "generated-registry-only" = present in module-screens.generated.ts so it can render inside a module category tab if a menu row references it, but nothing in code links to it. 28 are absent even from that registry.

| # | Route | File | Also in generated registry |
|---|---|---|---|
| 1 | `/Inventory/generate_po` | app/Inventory/generate_po/page.tsx | yes |
| 2 | `/Inventory/inventory_allocation` | app/Inventory/inventory_allocation/page.tsx | yes |
| 3 | `/Inventory/inventory_defective` | app/Inventory/inventory_defective/page.tsx | yes |
| 4 | `/Inventory/inventory_item_master` | app/Inventory/inventory_item_master/page.tsx | yes |
| 5 | `/Inventory/inventory_master_setup` | app/Inventory/inventory_master_setup/page.tsx | yes |
| 6 | `/Inventory/inventory_return` | app/Inventory/inventory_return/page.tsx | yes |
| 7 | `/Inventory/item_category_master` | app/Inventory/item_category_master/page.tsx | yes |
| 8 | `/Inventory/item_delivery_status_report` | app/Inventory/item_delivery_status_report/page.tsx | yes |
| 9 | `/Inventory/item_quotation` | app/Inventory/item_quotation/page.tsx | yes |
| 10 | `/Inventory/item_receivable` | app/Inventory/item_receivable/page.tsx | yes |
| 11 | `/Inventory/item_sub_category_master` | app/Inventory/item_sub_category_master/page.tsx | yes |
| 12 | `/Inventory/item_wise_report` | app/Inventory/item_wise_report/page.tsx | yes |
| 13 | `/Inventory/negotiate_po` | app/Inventory/negotiate_po/page.tsx | yes |
| 14 | `/Inventory/overall_item_report` | app/Inventory/overall_item_report/page.tsx | yes |
| 15 | `/Inventory/requisition_form` | app/Inventory/requisition_form/page.tsx | yes |
| 16 | `/Inventory/requisition_form_approved` | app/Inventory/requisition_form_approved/page.tsx | yes |
| 17 | `/Inventory/requisition_report` | app/Inventory/requisition_report/page.tsx | yes |
| 18 | `/Inventory/staff_wise_report` | app/Inventory/staff_wise_report/page.tsx | yes |
| 19 | `/Inventory/tax_master` | app/Inventory/tax_master/page.tsx | yes |
| 20 | `/Inventory/vendor_master` | app/Inventory/vendor_master/page.tsx | yes |
| 21 | `/Transportation/intelligence` | app/Transportation/intelligence/page.tsx | NO |
| 22 | `/Transportation/transportation` | app/Transportation/transportation/page.tsx | yes |
| 23 | `/academic_setup/intelligence` | app/academic_setup/intelligence/page.tsx | NO |
| 24 | `/admin-services/visitor/intelligence` | app/admin-services/visitor/intelligence/page.tsx | NO |
| 25 | `/admissions/admission_followUp` | app/admissions/admission_followUp/page.tsx | yes |
| 26 | `/admissions/admission_form` | app/admissions/admission_form/page.tsx | yes |
| 27 | `/admissions/registration/[id]/edit` | app/admissions/registration/[id]/edit/page.tsx | NO |
| 28 | `/ai-journey` | app/ai-journey/page.tsx | yes |
| 29 | `/ai-platforms` | app/ai-platforms/page.tsx | yes |
| 30 | `/ai/[capability]` | app/ai/[capability]/page.tsx | NO |
| 31 | `/course-master/lesson-plan/[courseId]/chapters` | app/course-master/lesson-plan/[courseId]/chapters/page.tsx | NO |
| 32 | `/easy_com/intelligence` | app/easy_com/intelligence/page.tsx | NO |
| 33 | `/fees/help-guide-support` | app/fees/help-guide-support/page.tsx | yes |
| 34 | `/fees/onboarding` | app/fees/onboarding/page.tsx | NO |
| 35 | `/fees/process-builder` | app/fees/process-builder/page.tsx | NO |
| 36 | `/fees/reports/audit-logs` | app/fees/reports/audit-logs/page.tsx | yes |
| 37 | `/fees/reports/online-payments` | app/fees/reports/online-payments/page.tsx | yes |
| 38 | `/fees/reports/receipt-reprint` | app/fees/reports/receipt-reprint/page.tsx | yes |
| 39 | `/fees/reports/reconciliation-status` | app/fees/reports/reconciliation-status/page.tsx | yes |
| 40 | `/fees/scheduler` | app/fees/scheduler/page.tsx | NO |
| 41 | `/fees/sop-task` | app/fees/sop-task/page.tsx | NO |
| 42 | `/fees/workflow` | app/fees/workflow/page.tsx | NO |
| 43 | `/general/bulk_upload` | app/general/bulk_upload/page.tsx | yes |
| 44 | `/general/form_builder` | app/general/form_builder/page.tsx | yes |
| 45 | `/general/native_dynamic_pages` | app/general/native_dynamic_pages/page.tsx | yes |
| 46 | `/general/template_management` | app/general/template_management/page.tsx | yes |
| 47 | `/general/user_profile_masters` | app/general/user_profile_masters/page.tsx | yes |
| 48 | `/inward_outward/intelligence` | app/inward_outward/intelligence/page.tsx | NO |
| 49 | `/lms/lesson-plan` | app/lms/lesson-plan/page.tsx | yes |
| 50 | `/lms/reports` | app/lms/reports/page.tsx | yes |
| 51 | `/onboarding/lms` | app/onboarding/lms/page.tsx | NO |
| 52 | `/organization_managment/Department` | app/organization_managment/Department/page.tsx | yes |
| 53 | `/organization_managment/oragnization_profile` | app/organization_managment/oragnization_profile/page.tsx | yes |
| 54 | `/pal/adaptive/concept/[conceptId]/result` | app/pal/adaptive/concept/[conceptId]/result/page.tsx | NO |
| 55 | `/pal/framework/ulu` | app/pal/framework/ulu/page.tsx | NO |
| 56 | `/pal/personalize-marks` | app/pal/personalize-marks/page.tsx | yes |
| 57 | `/student/curriculum/[subjectId]` | app/student/curriculum/[subjectId]/page.tsx | NO |
| 58 | `/student/daywise_student_attendance` | app/student/daywise_student_attendance/page.tsx | yes |
| 59 | `/student/monthwise_student_attendance` | app/student/monthwise_student_attendance/page.tsx | yes |
| 60 | `/student/student_certificate_report` | app/student/student_certificate_report/page.tsx | yes |
| 61 | `/student/teacher_icard` | app/student/teacher_icard/page.tsx | yes |
| 62 | `/student/yearly_student_attendance` | app/student/yearly_student_attendance/page.tsx | yes |
| 63 | `/students/ICards` | app/students/ICards/page.tsx | yes |
| 64 | `/students/discipline` | app/students/discipline/page.tsx | yes |
| 65 | `/students/health_medical` | app/students/health_medical/page.tsx | yes |
| 66 | `/students/house` | app/students/house/page.tsx | yes |
| 67 | `/students/intelligence` | app/students/intelligence/page.tsx | NO |
| 68 | `/students/leave` | app/students/leave/page.tsx | NO |
| 69 | `/students/requests/new` | app/students/requests/new/page.tsx | NO |
| 70 | `/students/student_documents` | app/students/student_documents/page.tsx | yes |
| 71 | `/teach-learn/communication` | app/teach-learn/communication/page.tsx | NO |
| 72 | `/teach-learn/help-guide-support` | app/teach-learn/help-guide-support/page.tsx | NO |
| 73 | `/teach-learn/master-setup` | app/teach-learn/master-setup/page.tsx | NO |
| 74 | `/teach-learn/onboarding` | app/teach-learn/onboarding/page.tsx | NO |
| 75 | `/teach-learn/operations` | app/teach-learn/operations/page.tsx | NO |
| 76 | `/teach-learn/process-builder` | app/teach-learn/process-builder/page.tsx | NO |
| 77 | `/teach-learn/reports` | app/teach-learn/reports/page.tsx | NO |
| 78 | `/user/add_user_profile` | app/user/add_user_profile/page.tsx | yes |
| 79 | `/user/intelligence` | app/user/intelligence/page.tsx | NO |
| 80 | `/user/user_report` | app/user/user_report/page.tsx | yes |

### 7b. Weakly referenced pages (69): reachable only if a substring of their path appears in some other string (e.g. concatenated href) - review manually

`/Inventory/ai-stack`, `/Inventory/intelligence`, `/Transportation/ai-stack`, `/Utility/ai-stack`, `/Utility`, `/admin-services/complaint-ai-stack`, `/admin-services/consent-ai-stack`, `/admin-services`, `/admin-services/petty-cash-ai-stack`, `/admin-services/ptm-ai-stack`, `/admin-services/visitor-ai-stack`, `/admissions/ai-stack`, `/ai/prompts/[id]`, `/attendance/ai-stack`, `/career-explorer/expert-advice`, `/career-explorer/explore-sectors`, `/classteacher`, `/document-templates/ai-stack`, `/easy_com/ai-stack`, `/engagement/ai-stack`, `/exam/ai-stack`, `/fees/online-fees-settings`, `/fees/reports`, `/forgot-password`, `/front_desk/ai-stack`, `/front_desk/circular/ai-stack`, `/front_desk/create-timetable/ai-stack`, `/front_desk/parent_communication/ai-stack`, `/h5p/h5p_arithmetic_quiz/[id]`, `/h5p/h5p_blanks/[id]`, `/h5p/h5p_course_presentation/[id]`, `/h5p/h5p_drag_drop/[id]`, `/h5p/h5p_drag_text/[id]`, `/h5p/h5p_image_hotspots/[id]`, `/h5p/h5p_interactive_video/[id]`, `/h5p/h5p_mark_the_words/[id]`, `/h5p/h5p_memory_game/[id]`, `/h5p/h5p_single_choice_set/[id]`, `/h5p/h5p_true_false/[id]`, `/h5p/scenario_based/[id]`, `/interactions/ai-stack`, `/inward_outward/ai-stack`, `/library/ai-stack`, `/lms/ai-stack`, `/lms/curriculum-planning/ai-stack`, `/lms/curriculum-planning`, `/migration-modules/[module]`, `/mobile-apps/ai-stack`, `/organization-management/ai-stack`, `/pal/eso/knowledge-map/[conceptId]`, `/pal/framework`, `/pal/frameworks/[slug]`, `/pal/intervention`, `/pal/ulu/[slug]`, `/proxy_master`, `/sqaa/ai-stack`, `/student/ai-stack`, `/student/student_attendance`, `/student/student_certificate/ai-stack`, `/student/student_certificate`, `/student/student_icard/ai-stack`, `/student/student_icard`, `/student/student_infirmary/ai-stack`, `/student/user_icard/ai-stack`, `/student/user_icard`, `/students/requests/ai-stack`, `/task-management/ai-stack`, `/teach-learn/[categoryKey]`, `/user/ai-stack`

Pages referenced only through the DB-menu mapper (T2) or registry, not by any code link: 1.

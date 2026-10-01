# K12 ERP terminology and UX-copy review

**Date:** 2026-09-30 · **Type:** review only — no code, functionality or business logic was changed.
**Written for:** product owner, UX writer and engineering leads who will approve and apply the wording changes.

## How this review was done, and its limits

Four reviewers each read the user-facing strings of a group of modules under `app/` (shell and navigation; students, admissions and academics; fees, HR, organisation and admin; LMS, PAL, AI and career). Every quoted string below was taken from source, with `file:line`.

- **Sidebar menu names are not in the code.** They come from the backend table `tblmenumaster`, so main menus and submenus can only be reviewed for the few labels the frontend renames or hardcodes (`app/data/menuMappers.ts`, `app/components/Header.tsx`, `RightFloatingToolbar.tsx`). **Action needed:** export the `tblmenumaster` menu names and run the standard in section 5 over them. Fix them in the database, not in code.
- This is a **targeted scan, not a full inventory.** Counts are lower bounds. Not covered in depth: `bazar`, `reports`, `integration`, `migration-modules`, `mobile-apps`, `mobile-bridge`, `platform-administration`, `platform-roadmap`, `admin-services`, `ai-journey`, `ai-platforms`, `career-awareness`, `teach-learn`, and the top-level `components/` trees.
- Rows marked "confirm" need a decision from someone who knows the school domain before editing.

---

## 1. The biggest problems (fix these first)

| # | Problem | Scale | Why it matters |
|---|---|---|---|
| 1 | **Developer text shown to users**: "Laravel", "legacy", "parity", "payload", "backend", `php artisan …`, `config/pal_architecture.php`, `sub_institute_id`, HTTP status codes, `NEXT_GOOGLE_CLIENT_ID`, "deploy the latest backend … run its migrations" | ~50+ strings (25 "Laravel/legacy" in fees and general; ~25 in PAL and Enterprise Brain; 3 HTTP prefixes; 17 printed export subtitles "Legacy parity export") | Confusing and unprofessional for schools; leaks internals; printed on PDFs. |
| 2 | **Blame-y, inconsistent error tone**: ~140 "Failed to …", ~30 "Unable to …", "Could not …", "Something went wrong." | ~200 strings | Four styles for one situation; no next step. |
| 3 | **Same concept, several names**: student ID (GR / Enrollment / Admission / Registration), Standard vs Grade vs Class, Pending vs Outstanding vs Remaining vs Due, Homework vs Assignment, Exam vs Test vs Quiz vs Assessment, Staff vs Employee vs Teacher | See section 3 | Users cannot tell if two labels are the same thing. |
| 4 | **Internal product jargon as user labels**: RBAC, Event Bus, AI Stack, Pedagogy Engine, Unified Learning Units (ULU), Enterprise Brain, Intelligence, PAL, ESO, SQAA, KASBA, DOK, Bloom, RIASEC, KPI, velocity, misconception, "control plane" | ~60 strings | Not natural for teachers, parents or administrators. |
| 5 | **Typos users can see**: "Assesment", `organization_managment`, `oragnization_profile`, "consolidate report", "DateWise", "SrNo." | ~10 | Damages trust. |
| 6 | **Title Case vs the project's sentence-case standard** (CLAUDE.md) | ~130 in LMS/capability, ~60 in `organization_managment`, ~60 in fees, plus hostel, library, inventory, transport, academic setup | Inconsistent look; breaks the design system rule. |
| 7 | **Placeholder data shown as real**: `Sarah Patel` (fallback user name), `Admin User` / `Premium Plan` (sidebar footer) | 3 | Wrong for teachers, parents and students. |

---

## 2. Findings by area

Priority: **H** = fix before release, **M** = fix in the next pass, **L** = polish. Paths are under `app/` unless noted.

### 2.1 Menus, submenus and shell

| Current text | Recommended text | Reason | Pri | Where |
|---|---|---|---|---|
| Exam & Assesment | Exams and assessments | Spelling; also collides with the renamed "Exam" hub. Fix in `tblmenumaster`. | H | modules/_lib/module-static-screens.tsx:101 |
| Exam (rename of "Student Homework") | Exams hub (rename in DB, not code) | One word "Exam" names three different things in the sidebar. Hardcoded rename is fragile per tenant. | M | data/menuMappers.ts:172-186 |
| organization_managment / oragnization_profile (folder, route) | organization-management / organization-profile | Two typos; duplicates the real `organization-management`. Route change needs a redirect. | H | data/routeMapper.ts:503,852 |
| RBAC | Roles and permissions | Acronym; the route is already `role-and-permissions`. | H | components/Header.tsx (~198) |
| Event Bus | Activity feed (or System events) | Developer jargon. | H | components/Header.tsx |
| AI STACK - Conversational AI / Generative AI / Knowledge Graph / Recommendation Engine | AI assistant / AI content creator / Knowledge map / Recommendations | ALL CAPS, technical names, title repeated 3× per item. | H | components/RightFloatingToolbar.tsx:32-74 |
| AI Stack (PAL tab and toolbar) | AI tools | "Stack" is developer jargon (~8 uses). | M | components/DashboardShell.tsx:170 |
| Intelligence (synthetic level-3 item) / AI & Intelligence | AI insights / AI and insights | Unclear to school staff. | M | data/menuMappers.ts (~283); Header.tsx:301 |
| Content Model / Unified Learning Units / Pedagogy Engine | Content structure / Learning units / Teaching methods | Jargon. | M | components/DashboardShell.tsx:145-155 |
| Scheduler / Notification / Workflow / Integration / Document / Template | Schedules / Notifications / Workflows / Integrations / Documents / Templates | Singular vs plural mix. | L | components/Header.tsx (~228-245) |
| Add Process; Fields Configuration; Group-wise Rights; Individual Rights; Mobile App Rights; Platform Administration; Platform Services; What's Coming | Add process; Field settings; Group-wise rights; Individual rights; Mobile app rights; Platform administration; Platform services; What's coming | Sentence case; "configuration" is jargon. | M | components/Header.tsx:78-149,288 |
| Category / Module / Screen (search-result levels) | Menu / Section / Page (or drop) | Three unexplained hierarchy words. | L | components/HeaderMenuSearch.tsx:14 |
| Sarah Patel (fallback name) | User (or hide) | Fake person shown as real. | H | components/Header.tsx:582 |
| Admin User / Premium Plan | Real user name and role; remove plan | Hardcoded; wrong for other roles. | H | components/Sidebar.tsx:392-393 |
| Toggle Chatbot | Open AI assistant | "Chatbot" vs "AI assistant" elsewhere. | M | components/Header.tsx:552 |
| No menu rights found. | You don't have access to any menus yet. Contact your school administrator. | "Rights" is jargon; gives no next step. | H | components/Sidebar.tsx:327 |
| Retry menu / Retry | Try again | Matches error pages. | M | components/Sidebar.tsx:315,319 |
| Loading master menu... | Loading menu… | "Master menu" is internal. | M | components/Level3Subheader.tsx:310 |
| Failed to fetch master menu rights | We couldn't load your menu. Please try again. | Developer message. | M | components/DashboardShell.tsx:451 |
| No items in this category | No pages in this category | "items/screens/pages" drift. | L | components/Level3Subheader.tsx:360 |
| Drag to resize · arrow keys to nudge | Drag or use the arrow keys to resize | "Nudge" unclear. | L | components/DashboardShell.tsx:833 |
| Search menus and screens... | Search menus and pages… | Use "page"; use `…` character. | L | components/HeaderMenuSearch.tsx:150 |
| No active session found. Sign in again to load this module. / No module is configured under "${moduleSlug}". | Your session has ended. Please sign in again. / This section isn't set up for your school. | Exposes slug and "module". | M | modules/_components/module-category-page.tsx:95,157 |
| Unable to load this module. | We couldn't load this section. Please try again. | "Module" is jargon. | M | modules/_components/module-category-page.tsx:111,151 |
| Loading screens… / Choose a screen to open it. / No screens available yet | Use "pages"; empty state "Nothing here yet." | screen/page mix. | M | modules/_components/module-category-page.tsx (~144-198) |

### 2.2 Sign-in, errors, dashboards, users

| Current text | Recommended text | Reason | Pri | Where |
|---|---|---|---|---|
| Google sign-in is not configured. Set NEXT_GOOGLE_CLIENT_ID and try again. | Google sign-in isn't available right now. Please use your email and password. | Env variable shown to users. | H | login/page.tsx:75 |
| Invalid credentials. Please try again. | Email or password is incorrect. Please try again. | Clearer. | M | login/page.tsx:56 |
| Learn without boundaries. / Access premium courses … educators. | Everything your school needs, in one place. | Generic e-learning copy; this is an ERP for staff and parents. | M | login/page.tsx:175-181 |
| Enter your credentials to access your account | Sign in with your email and password | Plainer. | L | login/page.tsx:218 |
| Signed in — taking you in | Signed in. Taking you to your dashboard… | Awkward. | L | login/page.tsx:398 |
| No worries - enter the email … | Enter the email linked to your account and we'll send you a reset link. | Casual tone; hyphen as dash. | L | login/page.tsx:548 |
| Unable to send reset link. / Network error. | We couldn't send the reset link. Please try again. / Check your internet connection and try again. | Tone; vague. | L | login/page.tsx:492-501 |
| Page Not Found; Go Back; Go to Dashboard | Page not found; Go back; Go to dashboard | Sentence case. | M | not-found.tsx:20,37,44 |
| Reference: {digest} vs "quote reference" | Error code (both) | One term. | L | error.tsx:28; global-error.tsx:25 |
| Unable to load your PAL dashboard. | We couldn't load your learning dashboard. | PAL unexplained. | H | dashboard/StudentDashboard.tsx:47 |
| Hello, {name} vs Welcome back, {name} | Welcome back, {name} everywhere | One greeting. | L | dashboard/StudentDashboard.tsx:73 |
| This page shows where you are, and all students start from the same concept. | See where you are. Every student starts from the same concept. | Comma splice. | M | dashboard/StudentDashboard.tsx:74 |
| Concept diagnostic content isn't available … | Diagnostic questions aren't available for your subjects yet. Please check back soon. | Jargon. | M | dashboard/StudentDashboard.tsx:94 |
| KPI cards | Summary cards | Jargon. | M | dashboard/_components/CustomizeDashboard.tsx:12 |
| Collect fee / Fees collected today / Fee dues (my class) | Collect fees / Fees collected today / Fee dues for my class | Fee/Fees; parentheses in label. | M | dashboard/AdminDashboard.tsx:18,107; TeacherDashboard.tsx:109 |
| Recent circulars vs "Notices sent to your classes" | Pick "Circulars" or "Notices" (confirm) | Two terms, one thing. | M | dashboard/TeacherDashboard.tsx:187 |
| User Master | Users | "Master" is developer jargon; Title Case. | H | user/add_user/page.tsx:61 |
| Fields marked required match the Laravel workflow. | Fields marked * are required. | Framework name shown. | H | user/add_user/page.tsx:65 |
| Suffix | Title (Mr, Mrs, Dr) | Wrong word: it is a title before the name. | H | user/add_user/page.tsx:67 |
| Parent profile | Reports to (or Parent role) | Clashes with "parent" = student's guardian. | H | user/add_user_profile/page.tsx:37 |
| Total lectures | Lectures per week (confirm meaning) | Unclear without a period. | M | user/add_user/page.tsx:82 |
| Delete profile ${name}? | Delete the profile "${name}"? This can't be undone. | No consequence stated. | M | user/add_user_profile/page.tsx:30 |
| Birth date / Mobile / Pincode / Id | Date of birth / Mobile number / PIN code / ID | Standard labels. | L | user/add_user/page.tsx:73-95 |
| Audit / User Log / User Log Report | Choose "Audit log" or "User log" | Three names for one feature. | M | data/menuMappers.ts; user_log/page.tsx:279 |
| From date / To date | Start date / End date | Matches other forms. | L | user_log/page.tsx:201,212 |
| Show my LMS dashboard progress; What is in my activity stream today? | Show my learning progress; What's new today? | "LMS", "activity stream" jargon. | M | components/ChatbotPanel.tsx:153-156 |
| Ask about homework, dashboard, results, fees, or workflows... | Ask about homework, results, fees, or attendance… | "Workflows" jargon. | M | components/ChatbotPanel.tsx:1115 |
| Hide agent activity / Agent working | Hide details / Working… | "Agent" is AI jargon. | M | components/ChatbotPanel.tsx:970 |

### 2.3 Admissions, students, attendance, exams and results

| Current text | Recommended text | Reason | Pri | Where |
|---|---|---|---|---|
| Admission Inquiry; Inquiry Follow-up Report; Admission Inquiry Report; Inquiry linked / Inquiry # | Admission enquiry; Enquiry follow-up report; Admission enquiry report; Enquiry linked / Enquiry no. | 5 stray "Inquiry" among ~60 "Enquiry". | H | admission-Enquiry/page.tsx:207; admissions/admission_reports/config.ts:28,39; admissions/admission_registration/components/sideDrawer.tsx:575-576 |
| Enquiry Number / Enquiry No. / Enquiry no. | Enquiry no. | Three forms. | M | admission-Enquiry/page.tsx:234 and 4 others |
| Enrollment No / Enrolment no. / Admission No / Registration No | See ID standard in section 5 | Four labels for student IDs. | M | admissions/registration/[id]/edit/page.tsx:667; student/ai-stack/_screens/students-templates-screen.tsx:105 |
| GR No. / GR No / GR Number (~37) | GR no. | One form. | M | many (e.g. students/search_student/page.tsx:365) |
| Grade (as a filter beside Standard) | Standard | Same concept, two names. | M | Transportation/student_transport_mapping/page.tsx:344-352; academic_setup/create_periods/page.tsx:13; library/issue_overdue_report/page.tsx |
| Enrollment by grade | Enrolment by standard | Grade/Standard; spelling. | M | students/search_student/components/StudentProfilesDashboard.tsx:251 |
| Roll No / Roll No. / Roll Number | Roll no. | Three forms. | L | students/search_student/components/StudentDetailDrawer.tsx:116,348,561 |
| Student Name (29) / Student name (30) | Student name | Sentence case. | M | e.g. students/search_student/page.tsx:434 |
| Father Name / Father's Name | Father's name | Grammar; sentence case. | L | admission-Enquiry/page.tsx:242 |
| Guardian Details / Primary Guardian vs "Parent communication" | Choose Parent or Guardian (recommend Parent) | Two terms for one role. | M | students/search_student/components/StudentDetailDrawer.tsx:584-592 |
| Type student name or GR No. | Search by student name or GR no. | Clearer. | M | student/_components/StudentCareModule.tsx:149 |
| Sr No / Sr. No. / Sr.No. / SrNo. (~45 across app) | No. | 8+ variants. | M | exam/exam-master/page.tsx:291 and many |
| HTTP ${status}: Failed to save marks | Couldn't save marks. Try again. | Status code shown. | H | exam/marks-entry/page.tsx:216 |
| Failed to save result HTML | Couldn't save the result. | "HTML" leaks implementation. | H | result/report-card/page.tsx:210 (+4 files) |
| Failed to load the consolidate report. | Couldn't load the consolidated report. | Grammar. | M | result/reports/consolidate/page.tsx:152 |
| Failed to load the WRT report. | Spell out "WRT" (confirm expansion) | Acronym. | M | result/reports/wrt/page.tsx:93 |
| No records were returned for the selected criteria. | No records match your filters. | "Returned" is API-speak. | M | result/reports/page.tsx:248 |
| Nothing to show / Nothing selected / Nothing to publish | No data to show / No students selected / No results to publish | Vague. | L | result/hpc-entry-v1/page.tsx:341 |
| Failed to load class sections. | Couldn't load classes. | "Class sections" is a 4th name for Standard + Division. | M | attendance/attendance_dashboard/page.tsx:118 |
| Nothing is waiting at this gate. | No items waiting for approval. | "Gate" is internal. | M | attendance/ai-stack/_screens/attendance-automations-screen.tsx:777 |
| Photo video gallery | Photo and video gallery | Missing "and". | M | front_desk/_lib/modules.ts:41 |
| Match fields / Map fields (adjacent steps) | Match columns / Set defaults | Near-identical step names. | M | import-data/page.tsx:58-59 |
| Absent Teacher / Proxy Teacher | Absent teacher / Proxy teacher (confirm "Substitute teacher") | Case differs between two pages; "proxy" is jargon. | M | todays_proxy_report/page.tsx:41-42; proxy_master/page.tsx:52-53 |
| Load; Allow Grades; Elective Subject vs Optional Type | Weekly load; add help text; pick Elective or Optional | Unclear/duplicate. | M | academic_setup/subject_standard_mapping/page.tsx:13-19 |
| HTTP ${status}: Unable to load the library dashboard summary. / Transportation equivalent; "non-JSON response" messages | Couldn't load the dashboard. Try again. | Raw technical error. | H | library/_lib/library-dashboard-api.ts:93,99; Transportation/_lib/transportation-dashboard-api.ts:86,92; hostel/_lib/hostel-dashboard-api.ts:90 |
| Your login session is missing transport API credentials. | Your session has expired. Sign in again. | Developer wording. | H | Transportation/api.ts:171 |
| The Document Templates API is not available … Deploy the latest backend … run its migrations. | Document templates are not available yet. Contact your administrator. | Deployment instructions to end users. | H | document-templates/api.ts:130-131 |
| Transport rates could not be loaded. | Couldn't load transport rates. | Third error style in one module. | L | Transportation/add_transport_rate/page.tsx:81 |
| Transportation (29) vs Transport (4) | Transport (labels); module name to be decided | Mixed. | L | Transportation/* |
| Title Case in hostel/inventory/library/transport/academic setup (Visitor Details, Room Master, Opening Stock, Create Subject, Class Teacher Report …) | Sentence case | Design-system rule. | M | hostel/_components/HostelOverviewPage.tsx:10-21; Inventory/configs.ts:101; academic_setup/create_subject/page.tsx:6-19; classteacherReport/page.tsx:48 |
| Type Master / Room Master / Hostel Master … "Master" | Hostel types / Rooms / Hostels (or "… setup") | "Master" is developer jargon (confirm with users who may know it). | M | hostel/_components/HostelOverviewPage.tsx:13-19 |

### 2.4 Fees, HR, organisation, general

| Current text | Recommended text | Reason | Pri | Where |
|---|---|---|---|---|
| "…through Laravel", "…from Laravel", "…Laravel payment gateway", "Laravel will soft-delete…" (~25 strings) | Remove the word; e.g. "Cancel the selected receipts." | Backend name in user copy. | H | fees/NACH_s1excel_export/page.tsx:110; NACH_s2excel_import:72; NACH_s4excel_import:124; online_fees_collect:212; other_fees_cancel:271; other_fees_collect:290; online-fees-settings:172; talent-management/recruitment/components/recruitment-center.tsx:890; general/groupwise_rights:325; general/individual_rights:408 |
| Legacy parity export / Legacy parity print view (17 subtitles) | Report period and academic year | Printed on PDFs. | H | fees/reports/fees-cancel/page.tsx:181-182 and 7 other reports |
| Legacy parity includes receipt grouping …; exactly from the legacy Laravel calculations | Includes receipt grouping, month labels, bank details and payment-mode totals. | Developer jargon. | H | fees/reports/fees-collection/page.tsx:356; fees-defaulter:190 |
| Failed to … (${response.status}) (receipt book, late fee, mapping filters, breakoff matrix) | Couldn't {verb} the {object}. Try again. | Status code shown; jargon "matrix". | H | fees/master/fees-receipt-book-master/page.tsx:833; fees-late-master:411; additional-fees-mapping:302; fees-breakoff:402 |
| Pending Fees / Remaining / Outstanding / Due / Balance | **Outstanding** for money owed; **Pending** for workflow states only | 5 names for one balance. | H | fees/collect/[studentId]/page.tsx:654,693,706; fees/collect/page.tsx:508-533; fees/intelligence/_components/fees-intelligence-charts.tsx:183 |
| Selected remain | Selected outstanding | Ungrammatical. | M | fees/circulars/page.tsx:484 |
| Total Payable Fees / Total Collected Fees / Total Pending Fees / Paid Students / Pending Students / Collection Rate | Total payable / Total collected / Total outstanding / Paid students / Students with dues / Collection rate | Case; redundancy. | H | fees/collect/page.tsx:508-533 |
| Fees Cancel / Refund; Fees Cancel Report; Other Fees Cancel Report | Cancel or refund fees; Fee cancellation report; Other fee cancellation report | Fee/Fees; "Cancel" as a noun. | M | fees/cancel-refund/page.tsx:369; fees/reports/fees-cancel/page.tsx:175 |
| Eligible to cancel / Blocked online / Selected value | Can be cancelled / Paid online (can't cancel here) / Selected amount | "Blocked" jargon. | M | fees/cancel-refund/page.tsx:361-363 |
| Fees Receipt Template / Fees Bank Challan Template / Fees Config Master / Fees Collect | Fee receipt template / Bank challan template / Fee configuration / Fee collection | Fee/Fees; Title Case; "Master". | M | fees/master/fees-config-master/page.tsx:927,1403,1432; general/implementation_management/ImplementationManagementPage.tsx:142 |
| Late Fees Amount / Fine Type / Fine counting type is required | Late fee amount / Fine type / Select a fine calculation type. | "Late fee" and "Fine" both used (confirm one). | M | fees/master/fees-late-master/page.tsx:369,552,558 |
| DateWise Summary Report / Fees Type Wise Report | Date-wise summary report / Fee type-wise report | Typos. | M | fees/reports/datewise-summary/page.tsx:274; fees-type-wise:210 |
| Cheque/DD Date vs Cheque/DD date | Cheque/DD date | Same label, two cases. | M | fees/collect/[studentId]/page.tsx:834; fees/other_fees_collect/page.tsx:368 |
| Delete this map year record? | Delete this academic year mapping? This can't be undone. | Jargon. | M | fees/map_year/page.tsx:65 |
| Sanity: Students with pending fees | Students with outstanding fees | "Sanity" is a dev word. | M | fees/teacher-dues/page.tsx |
| en-US currency/date formatting | en-IN (₹, DD MMM YYYY) | Fees mostly correct; HR/AI screens use en-US/en-GB. | M | fees/ai-stack/_screens/fees-usage-cost-screen.tsx:458; hrit/_lib/hrit-utils.ts:115,126; hrit/attendance-management/attendance-tracking/page.tsx:84 |
| The legacy module only supports … under sub_institute_id = 1. | Only the Student, Admin and Teacher profiles are supported. | DB column shown. | H | general/mobile_app_rights/MobileAppRightsPage.tsx:656 |
| …cascades … the old Laravel controller does / …legacy ERP rules | Updates the selected record and all records in the same group. | Backend leak. | H | general/mobile_app_rights/MobileAppRightsPage.tsx:593,708,799 |
| Deactivate "x"? Any menu row pointing at it will fall back to native. | Deactivate x? Menu items that link to it will use the built-in page. | Jargon. | M | general/mobile_page_builder/MobilePageBuilderListPage.tsx:168 |
| Something went wrong. | Couldn't complete that action. Try again. | Generic. | H | mobile/custom/[slug]/page.tsx:158 |
| Job Role / Designation | Designation | Two terms in one label. | M | organization-management/employee-directory/components/employee-directory-sheets.tsx:290 |
| Staff Document / Male Staff / Staff Data / Staff (option) | Employee document / Male employees / Employee data / Employee | Staff vs Employee. | M | organization-management/employee-directory/components/edit-employee/upload-doc-tab.tsx:139; general/configs.ts:50-51; general/fields_configuration/page.tsx:634 |
| Select Dept / Dept: | Select department / Department: | Abbreviation. | M | talent-management/mobility-and-succession/components/mobility-center.tsx:2216,2225,889 |
| Declined (3) vs Rejected (24) | Rejected | One status word. | M | hrit, talent-management (grep `'Declined'`) |
| Approved By / Approved by; Rejected Requests / Rejected requests | Approved by; Rejected requests | Same string, two cases. | M | hrit/leave-management (grep) |
| Failed to update job posting. (browser alert()) | Couldn't update the job posting. (inline message) | Tone; `alert()` popup. | H | talent-management/mobility-and-succession/components/mobility-center.tsx:416,546,670 |
| Are you sure you want to delete …? (23 variants) | One template: Delete {name}? This can't be undone. | Inconsistent confirmations. | L | e.g. hrit/leave-management/leave-configuration/components/HolidayCalendarTab.tsx:439 |
| Organisation-wide (only British form) | Follow the spelling decision in section 5 | 1 vs 21. | M | talent-management/certifications/components/certifications-center.tsx:529 |
| Organization Type / Organization Profile / Organization Setup | Sentence case | Title Case. | M | organization_managment/oragnization_profile/page.tsx:907,1117,1195 |
| INR - Indian Rupee / USD - US Dollar | Indian rupee (₹) | Name first, symbol. | L | organization_managment/oragnization_profile/page.tsx:113 |
| Steps whose actor is Teacher or Teacher + AI | Steps done by a teacher, or a teacher with AI | "Actor" jargon. | L | general/add_process/_components/StepTasks.tsx:43 |

### 2.5 LMS, PAL, AI, Enterprise Brain, capability, SQAA

| Current text | Recommended text | Reason | Pri | Where |
|---|---|---|---|---|
| The backend did not return a gamification payload. (8 variants) | We couldn't load this page right now. Please try again. | Developer wording. | H | pal/new/gamification/page.tsx:76 (+7 sibling pages) |
| Deploy the New PAL Administration module and run its migrations on the API. | Nothing is set up here yet. Contact your administrator. | Deployment instruction. | H | pal/new/administration/page.tsx:102 |
| …Check that config/pal_architecture.php is deployed | This section has no content yet. | File path in UI. | H | pal/new/administration/[subsystem]/page.tsx:152 |
| Run `php artisan pal:install-pedagogy-engine` … | No teaching rules are set up yet. Ask your administrator to enable them. | CLI command in UI. | H | pal/pedagogy-engine/_components/PedagogyEngine.tsx:188 |
| Nothing was saved - the API is not deployed. / The PAL V4 API is unavailable. | We couldn't save your changes. Please try again later. / PAL isn't available right now. | Developer wording. | H | pal/intervention/page.tsx:409; pal/intelligence/page.tsx:137 |
| …derived from the same semantic_intelligence payload … | This view is built from the chapter's concepts and skills. | Field name shown. | H | pal/frameworks/page.tsx:14; pal/ulu/page.tsx:14 |
| PAL Intelligence / …velocity, risk prediction and misconception analysis. | Student insights / How each student is progressing, who may need support, and common mistakes. | Jargon. | H | pal/intelligence/page.tsx:228-230 |
| The PAL V4 architecture control plane … this estate | Set up and monitor PAL's nine building blocks for your school. | Heavy jargon. | H | pal/new/administration/page.tsx:117 |
| Learning velocity / Active misconceptions / Learner id | Learning pace / Current common mistakes / Student ID | Jargon; Learner vs Student. | M | pal/intelligence/page.tsx:283,456,461 |
| Unified Learning Units / ULU; ESO; Coherence map; Pedagogy Engine | Learning units; (spell out or rename ESO); Concept map (with tooltip); Teaching methods | Unexplained acronyms/jargon. | M | pal/ulu/page.tsx:13; pal/new/_components/NewPalNav.tsx:66,75; pal/page.tsx:821 |
| DOK / Bloom / Bloom ceiling / Building Bloom x DOK blueprint | Depth of knowledge (DOK) / Thinking level (Bloom) / Planning question difficulty levels | Explain on first use. | M | pal/new/content-model/chapter/page.tsx:234; lms/exam/page.tsx:3692; course-master/[courseId]/chapters/GenerationPipeline.tsx:252 |
| Built from RIASEC signals … | Built from the student's work over time, not one questionnaire. | Unexplained acronym. | M | pal/new/gamification/career-quest/page.tsx:187 |
| Served by the API from the specification … (2 dev notes) | Delete | Developer note in UI. | M | pal/new/gamification/streaks/page.tsx:183; team-challenges/page.tsx:179 |
| Student Homework Submission Report / subtitle "Assignment submissions" | Homework submission report / Homework submissions | Homework vs Assignment mixed in one report. | H | lms/homework/submission-report/page.tsx:355,369-370 |
| Invalid homework/submission/assignment reference. | This homework link isn't valid. Go back and try again. | Developer wording. | H | lms/homework/[id]/page.tsx:76 (+2) |
| Something went wrong. (raw `error.message` passthrough, ~12 LMS pages, H5P) | One shared helper with a friendly fallback; never show backend text | Backend text can reach teachers. | H | lms/activity-stream/page.tsx:23; lms/dashboard/page.tsx:53; lms/leader-board/page.tsx:32; h5p/components/content-type-list.tsx:336 |
| Leader board / Leader Board Master | Leaderboard / Leaderboard setup | One word; "Master". | M | lms/leader-board/page.tsx:273; lms/leader-board-master/page.tsx:221 |
| Test (tab) | Exams (or Quizzes) | Exam/Test/Quiz mix. | M | course-master/page.tsx:52 |
| Instructor: | Teacher: | Term mismatch. | M | course-master/lesson-plan/[courseId]/chapters/page.tsx:281 |
| Failed to load course data | We couldn't load the subjects. | Course vs Subject. | M | lms/exam/page.tsx:2111 |
| HTTP ${status}: Failed to load divisions | We couldn't load the classes. | Status code shown. | H | course-master/lesson-plan/[courseId]/page.tsx:1159 |
| Current session is missing API host, token, or institute. | Your session has expired. Please sign in again. | Developer wording. | H | course-master/lesson-plan/[courseId]/page.tsx:1130 |
| Planned Date / Execution Date | Planned date / Date taught | "Execution" unnatural. | M | lms/teacher-diary/page.tsx:49,65 |
| Enterprise Brain could not load this screen; Projected into Brain; What the Brain has found… | We couldn't load this page. / Added to insights / What we've found… | Internal product name and anthropomorphism. | H | enterprise-brain/_components/primitives.tsx:286; foundation/departments/page.tsx:73; foundation/students/page.tsx:23 |
| Enterprise Brain · Overview | School insights (confirm name) | Not natural for schools. | M | enterprise-brain/page.tsx:135 |
| KASBA Explorer | Skills explorer (KASBA = Knowledge, Attitude, Skill, Behaviour, Ability) | Unexplained. | H | enterprise-brain/knowledge/kasba/page.tsx:45 |
| Business Unit / Job Family / Work Function | Department / Role group (confirm) | Corporate terms in a school ERP. | M | capability-intelligence/dashboard/components/command-center.tsx:325-341 |
| Behavior / Behaviour / Behavioural in one file | One spelling | Mix. | M | capability-intelligence/competency-library/components/competency-library.tsx:141,675 |
| Gamma could not render these slides. | We couldn't create the slides. | Vendor name. | M | capability-intelligence/capability-library/components/course-builder-panel.tsx:150 |
| SQAA Entry / SQAA Document Report (23 uses) | Expand once: "… (SQAA)" — confirm the expansion with the product owner | Acronym never explained. | H | sqaa/_components/EntryPage.tsx:103,106 |
| Select the SQAA standard and review its derived score. | Choose a standard to see its score. | Jargon. | M | sqaa/_components/EntryPage.tsx:103 |
| `Panel table="hpbrain_…"` (14 raw table names) | Friendly label or hide from non-admins | DB names visible. | M | enterprise-brain/capabilities/page.tsx:223 |
| Max output tokens / Input cost per 1K tokens | Add helper text (admin-only) | Jargon for non-technical admins. | M | ai/_components/ModelManager.tsx:265-286 |
| Failed to change publish state; Failed to import package | We couldn't publish or unpublish this activity. / We couldn't import the file. | "State", "package". | H | h5p/components/content-type-form.tsx:301; content-type-list.tsx:367 |

---

## 3. Duplicate or conflicting terms (with occurrence evidence)

| Concept | Terms found | Recommended | Notes |
|---|---|---|---|
| Student's school ID | GR no. (~37), Enrollment no. (~10), Enrolment no., Admission no. (4), Registration no. (2) | **GR no.** = student's permanent ID; **Admission no.** = admission record; **Registration no.** = pre-admission only. Drop "Enrollment". | Confirm what schools actually call the permanent ID. |
| Class grouping | Standard (73), Division (63), Grade (37), Class (14), Section (11), "class sections" | **Standard** + **Division** in admin screens; **Class** as the plain word for the pair ("My classes"). "Grade" only for marks/grade bands. | Dashboard uses "class" over `standard_name`; fine if consistent. |
| Enquiry | Enquiry (~60), Inquiry (5) | **Enquiry** | Routes already use it. |
| Homework vs assignment | Both used in one dashboard/report | **Homework** = routine take-home task; **Assignment** = graded/long-form. Never mix in one report. | Keep both modules; add hint text. |
| Assessments | Exam (63), Assessment (40), Quiz (21), Test (3) | **Exam** = formal; **Quiz** = short/in-class; **Assessment** = umbrella only; retire "Test". | |
| Fee balance | Pending, Outstanding, Remaining, Due, Balance | **Outstanding** (money); **Pending** (approvals/workflow) | |
| Fee vs Fees | Fee collection / Fees Collect / Fees Cancel | "Fee" as modifier; "Fees" only as module name | |
| Discount / concession | Discount (7), Concession (2) | Confirm with schools; "Concession" is usual in Indian schools | |
| Late fee / fine | Both | Pick one | |
| Staff / employee / teacher | Employee (190), Staff (11), Teacher (9) | **Employee** on HR screens; **Teacher** for the classroom role; retire "Staff" as a noun | |
| Designation / role | Designation, Job Role, Position, Role | **Designation** (HR title); **Role** (permissions) | |
| Parent / guardian | Both | **Parent** (umbrella) | |
| Circular / notice | Both on one dashboard | Confirm; recommend **Circular** (school-native) | |
| Subject / course | Subject (91), Course (61) | **Subject**; keep "course" only for career courses | |
| Chapter / lesson / topic / unit / concept | All five | Subject → Chapter → Topic → Concept; "Lesson" = a taught session; drop "Unit" | |
| Student / learner | Learner in PAL UI | **Student** | |
| Teacher / instructor | Instructor (2) | **Teacher** | |
| Insights / intelligence / analytics | "Intelligence" 64× | **Insights** for anything a teacher reads; **Reports** for tables | |
| Audit / user log | Audit, User Log, User Log Report | **Audit log** | |
| Proxy / substitute | Proxy | Confirm "Substitute teacher" | |
| Transport / transportation | Both | One | |
| Reject / decline | Rejected 24, Declined 3 | **Rejected** | |
| Screen / page / module | All three | **Page** for users; avoid "module" and "screen" | |
| Leaderboard | Leader board | **Leaderboard** | |
| Brand | Teach Connect / Teach/Learn / Teach Learn | One name | |

---

## 4. Style issues

| Issue | Evidence | Fix |
|---|---|---|
| Capitalisation | ~130 Title Case in LMS/capability; `organization_managment` 60 vs 41; fees 62 vs 297; talent 53 vs 206; hostel, library, inventory, transport, academic setup mostly Title Case | Sentence case everywhere (CLAUDE.md). Search: `(title\|label\|placeholder)[=:] ?["'][A-Z][a-z]+( [A-Z][a-z]+)+["']` |
| Spelling mix (US/UK) | Organization 21 vs Organisation 1; Cancelled ~27 (UK); Personalized 17 vs Personalise; Color 146 (mostly code) vs Colour 16; Behavior/Behaviour; Analyse/Analyze; Centre/Center; Programmes; Counselling | Adopt one standard (section 5) |
| Numbering label | "Sr No", "Sr. No.", "Sr.No.", "SrNo.", "S. No.", "#" | **No.** |
| Receipt no. | Receipt no (14), No (3), no. (1), number (2) | **Receipt no.** |
| Employee ID | Employee ID (13), Code (3), Emp ID (1), Employee number, Employee no | **Employee ID** |
| Ellipsis | `...` (~8+) vs `…` | `…` |
| Ampersand in prose | "Select module & upload" | "and" |
| Required marker | Literal `*` inside label text vs styled marker | One component |
| Loading/empty text | ~8 empty-state phrasings | "No X yet." (empty) and "No records match your filters." (filtered) |
| Confirmations | 23 variants of "Are you sure…" | "Delete {name}? This can't be undone." |
| Dates / currency | en-US, en-GB, en-IN mixed | `en-IN`, ₹, DD MMM YYYY |
| Field name inconsistencies | Birth date vs Date of birth; Mobile vs Mobile number; Pincode; Id vs ID | Date of birth; Mobile number; PIN code; ID |

---

## 5. Recommended terminology standard

### 5.1 House rules
1. **Sentence case** for every label, heading, button, tab, column and menu item. Capitalise only the first word and proper nouns/acronyms.
2. **English variant: Indian/British English** (recommended). It already matches Enquiry, Standard, Division, Cancelled, Counselling, Programme. This means Organisation, Enrolment, Personalised, Colour, Behaviour, Centre, Customise. **Needs owner confirmation** — the most common form in code today is US "Organization"; whichever you choose, apply it everywhere. URL slugs and code identifiers are exempt.
3. **Voice:** *you* for the user, impersonal system voice, no "Oops", no blame.
4. **Buttons are verbs** ("Save changes", "Collect fees", "Approve"). Use "Cancel" only to dismiss a dialog; use "Cancel receipt" for the receipt action.
5. **Errors:** "Couldn't {verb} {object}. {Next step}." Example: "Couldn't save marks. Try again." Never show HTTP codes, "backend", "API", "payload", "Laravel", "legacy", file paths, column names or raw `error.message`.
6. **Empty states:** "No {things} yet." / "No records match your filters."
7. **Confirmations:** "{Verb} {name}? {Consequence}." e.g. "Delete “Term 1 fee”? This can't be undone."
8. **Loading:** "Loading {thing}…" (with `…`).
9. **Acronyms:** spell out on first use or add a tooltip: PAL, SQAA, KASBA, DOK, Bloom, WRT, GR, UMRN, NACH, DD. Avoid ESO, ULU, RBAC, KPI, RIASEC in the UI.
10. **Money and dates:** `₹42,500` (Indian grouping), `15 Jul 2026`; IDs and receipt numbers in mono.

### 5.2 Glossary

| Concept | Use | Do not use |
|---|---|---|
| The learner | **Student** | Learner, pupil |
| Classroom professional | **Teacher** | Instructor, faculty, educator |
| Any person employed | **Employee** | Staff (noun), member |
| Student's guardian | **Parent** | Guardian (except legal forms) |
| Job title | **Designation** | Job role, position |
| Permission bundle | **Role** | Profile (for permissions), rights |
| Class level | **Standard** | Grade (except for marks), Class in admin tables |
| Section of a standard | **Division** | Section (unless confirmed) |
| Class (plain speech) | **Class** ("My classes") | Class section |
| Permanent student ID | **GR no.** | GR number, Enrollment no. |
| Admission record ID | **Admission no.** | |
| Pre-admission ID | **Registration no.** | |
| Prospective family contact | **Enquiry** / **Enquiry no.** | Inquiry |
| Routine take-home task | **Homework** | |
| Graded long-form task | **Assignment** | |
| Formal test | **Exam** | Test |
| Short in-class test | **Quiz** | |
| Umbrella | **Assessment** | |
| Academic hierarchy | **Subject → Chapter → Topic → Concept** | Course (for subject), Unit |
| Teaching plan | **Lesson plan** | |
| Ranking | **Leaderboard** | Leader board |
| Money still owed | **Outstanding** | Pending, Remaining, Due, Balance |
| Workflow waiting | **Pending** | |
| Positive/negative decision | **Approved / Rejected** | Declined, Authorised |
| Money received document | **Receipt** (**Receipt no.**) | Voucher |
| Bank payment slip | **Challan** (confirm) | |
| Fee reduction | **Concession** (confirm vs Discount) | |
| Late charge | **Late fee** (confirm vs Fine) | |
| Communication to families | **Circular** (confirm vs Notice) | |
| Insights for teachers | **Insights** | Intelligence, analytics |
| AI feature names | **AI assistant**, **AI tools** | AI Stack, Chatbot, Agent, Copilot |
| App area | **Page**, **section** | Screen, module |
| Numbering column | **No.** | Sr No, S. No. |
| Look-up setup data | **Setup** ("Hostel setup") | Master (confirm — long-standing ERP term) |
| Unable to complete | **Couldn't** | Failed to, Unable to, Could not |

### 5.3 Suggested menu-name clean-ups (apply in `tblmenumaster`)
- "Exam & Assesment" → **Exams and assessments**; rename the hub currently shown as "Exam" (was "Student Homework") to **Exams hub**.
- "User Master" → **Users**; "User Log" / "Audit" → **Audit log**.
- "Fees Config Master" → **Fee configuration**; "… Master" screens → **Setup** wording where the users agree.
- "Organization Management" duplicate modules (`organization_managment` vs `organization-management`) → merge or clearly separate (e.g. **Organisation profile** vs **Employee directory**).
- Platform items: RBAC → **Roles and permissions**; Event Bus → **Activity feed**; Scheduler → **Schedules**.
- AI menus: "AI Stack" → **AI tools**; "Intelligence" → **Insights**.

---

## 6. Suggested order of work
1. **Remove developer text from user copy** (section 1, problem 1) — one search per keyword: `Laravel`, `legacy`, `parity`, `backend`, `payload`, `php artisan`, `migrations`, `HTTP \${`, `sub_institute_id`, `NEXT_`.
2. **Create one shared error-message helper** so "Couldn't … Try again." replaces ~200 messages and raw `error.message` never reaches users.
3. **Confirm the open decisions** (spelling variant; GR/Admission/Enrolment; Concession vs Discount; Late fee vs Fine; Circular vs Notice; Proxy vs Substitute; "Master"; Standard/Division vs Class; the expansions of SQAA, WRT, ESO, KASBA).
4. **Fix menu names in the database**, then the hardcoded labels in `Header.tsx`, `RightFloatingToolbar.tsx`, `DashboardShell.tsx`, `menuMappers.ts`.
5. **Mechanical passes:** sentence case; "Sr No" → "No."; Enquiry; Receipt no.; ellipsis; date/currency locale.
6. **Route typos** (`organization_managment`, `oragnization_profile`) — needs redirects and a separate change.

Adopting this as a lint rule (forbidden words in JSX strings) after the first pass will stop the drift.

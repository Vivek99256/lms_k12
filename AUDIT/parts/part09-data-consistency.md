# part09 data - Cross-module consistency (Phase 23)

Counts are regex/AST counts over 2,071 tracked source files excluding tests, K-12 ERP Design System, g2g, .kilo, .codex, .claude (occurrence count / number of files).

## 1. Tenant / institute identity

| Variant | Occurrences | Files |
|---|---|---|
| `sub_institute_id` | 785 | 246 |
| `subInstituteId` | 762 | 232 |
| `subInstitute (other camel)` | 0 | 0 |
| `sub-institute-id (header)` | 29 | 29 |
| `institute_id` | 5 | 5 |
| `instituteId` | 78 | 29 |
| `tenantId` | 39 | 7 |
| `tenant_id` | 28 | 7 |
| `school_id` | 0 | 0 |
| `schoolId` | 0 | 0 |
| `client_id` | 63 | 21 |
| `x-mcp-institute-id` | 13 | 10 |

Reading: snake_case `sub_institute_id` (785 in 246 files) is the wire name; camelCase `subInstituteId` (762 in 232 files) is the client session name; `instituteId` (78/29), `tenantId` (39/7 - Brain/Agents), `tenant_id` (28/7 - agents ActingUser) and `client_id` (63/21) are additional spellings. The HTTP header form is `x-sub-institute-id` (29 files) but the MCP/AI stack uses `x-mcp-institute-id` (10 files).

## 2. Academic year / term

| Variant | Occurrences | Files |
|---|---|---|
| `syear` | 1013 | 252 |
| `academic_year` | 52 | 35 |
| `academicYear (camel)` | 92 | 42 |
| `academicYearId` | 207 | 65 |
| `selectedAcademicYear` | 66 | 35 |
| `year_id` | 0 | 0 |
| `yearId` | 0 | 0 |
| `term_id` | 113 | 64 |
| `termId` | 161 | 55 |
| `academic_year_id` | 31 | 23 |
| `sYear (camel S)` | 0 | 0 |
| `session_year` | 0 | 0 |

Reading: `syear` is the wire name (1,013/252). The client holds it as `syear`, `academicYear`, `academicYearId` (207/65 - a *year string*, not an id), `selectedAcademicYear` (also a localStorage key) or `academic_year` (API rows). Terms: `term_id` 113/64 vs `termId` 161/55 vs `selectedAcademicTerm` key. lib/erp-client.ts resolves the year from `academicTerms[0]` (active term) with regex 4-digit normalisation (`normalizeAcademicYear`), but lib/result/api.ts, lib/brain/api.ts and most `getXSession` readers take `localStorage.selectedAcademicYear ?? userData.syear ?? menuContext.syear` - two different precedence orders for the same value.

## 3. User identity

| Variant | Occurrences | Files |
|---|---|---|
| `user_id` | 559 | 196 |
| `userId` | 606 | 189 |
| `x-user-id header` | 29 | 29 |
| `staff_id` | 9 | 3 |
| `staffId` | 0 | 0 |
| `teacher_id` | 24 | 15 |
| `teacherId` | 62 | 12 |
| `employee_id` | 55 | 16 |
| `employeeId` | 184 | 32 |
| `created_by` | 40 | 24 |
| `student_id` | 228 | 90 |
| `studentId` | 576 | 99 |
| `learner_id` | 21 | 11 |
| `learnerId` | 281 | 29 |
| `enrollment_no` | 139 | 77 |

## 4. Role / profile

| Variant | Occurrences | Files |
|---|---|---|
| `user_profile_id` | 107 | 36 |
| `userProfileId` | 78 | 24 |
| `profile_id` | 36 | 26 |
| `profileId` | 74 | 21 |
| `user_profile_name` | 185 | 63 |
| `userProfileName` | 123 | 41 |
| `x-user-profile-name` | 10 | 10 |
| `is_admin` | 11 | 7 |
| `isAdmin` | 70 | 18 |
| `is_student` | 2 | 1 |
| `isStudent` | 54 | 12 |
| `user_type` | 17 | 4 |
| `userType` | 9 | 2 |
| `role (word)` | 15 | 4 |
| `profile_name` | 42 | 31 |
| `Super Admin (literal)` | 0 | 0 |
| `super_admin (literal)` | 2 | 2 |

Reading: role is expressed as `user_profile_id` (107/36) + `userProfileId` (78/24), `profile_id`/`profileId`, `user_profile_name` (185/63) + `userProfileName` (123/41), `is_admin`/`isAdmin` (11/7, 70/18), `is_student`/`isStudent`, `user_type`/`userType`. Name-based role checks (`user_profile_name === 'Super Admin'`-style string comparisons) coexist with id-based ones; the sidebar/permissions use DB rights (usePermission/useMenuRights) while agents use `profile_name` header strings. Literal 'Super Admin' occurs 0 times as a quoted literal, `super_admin`-like 2.

## 5. Token handling

| Variant | Occurrences | Files |
|---|---|---|
| `user_token` | 74 | 43 |
| `access_token` | 1 | 1 |
| `accessToken` | 0 | 0 |
| `.token (prop read)` | 505 | 201 |
| `jwt` | 40 | 38 |
| `Authorization: Bearer` | 122 | 83 |
| `x-laravel-token header` | 29 | 29 |
| `token in URL/query (token=)` | 7 | 1 |
| `Authorization header (any)` | 145 | 98 |

Reading: the JWT is read as `userData.user_token ?? userData.token ?? menuContext.user_token ?? menuContext.token` (lib/result/api.ts:45, lib/erp-client.ts), forwarded as `Authorization: Bearer` (122 sites/83 files), as header `x-laravel-token` (29 files - Next handlers), and - in lib/result/api.ts:68,113,150 - **also as a `token` query/body parameter**, so the JWT lands in URLs (access logs, Referer, browser history) for every Result-module GET.

## 6. Browser storage

| Variant | Occurrences | Files |
|---|---|---|
| `localStorage.getItem` | 191 | 85 |
| `localStorage.setItem` | 16 | 9 |
| `localStorage.removeItem` | 13 | 5 |
| `sessionStorage.getItem` | 11 | 8 |
| `sessionStorage.setItem` | 3 | 3 |
| `document.cookie` | 3 | 1 |
| `cookies() next/headers` | 0 | 0 |

### 6b. localStorage / sessionStorage keys (literal keys)

| Key | Uses | Files | Sample files |
|---|---|---|---|
| `userData` | 68 | 53 | app/Utility/student-transfer/api.ts; app/admissions/admission_enquiry/page.tsx; app/components/ChatbotPanel.tsx |
| `menuContext` | 45 | 38 | app/admissions/admission_enquiry/page.tsx; app/components/ChatbotPanel.tsx; app/components/DashboardShell.tsx |
| `selectedAcademicYear` | 24 | 19 | app/admissions/admission_enquiry/page.tsx; app/components/ChatbotPanel.tsx; app/course-master/data/curriculum.ts |
| `masterMenuOpen` | 3 | 1 | app/components/Level3Subheader.tsx |
| `selectedMasterCategory` | 3 | 1 | app/components/Level3Subheader.tsx |
| `feesCollectData:${studentId}` | 3 | 2 | app/fees/collect/[studentId]/page.tsx; app/fees/collect/page.tsx |
| `token` | 2 | 2 | app/ai-reports/[id]/page.tsx; components/intelligence/AiInsightsPanel.tsx |
| `selectedAcademicTerm` | 2 | 2 | app/components/Header.tsx; app/course-master/lesson-plan/[courseId]/page.tsx |
| `selectedMenuBranch` | 2 | 1 | app/login/page.tsx |
| `pendingTasksCount` | 2 | 1 | app/task-management/my-tasks/components/create-task-modal.tsx |
| `syear` | 2 | 1 | lib/erp-client.ts |
| `auth` | 1 | 1 | app/h5p/data/h5p.ts |
| `qbankDebug` | 1 | 1 | app/h5p/question-bank-library/debug.ts |
| `learningManagementAudienceMode` | 1 | 1 | app/student/page.tsx |
| `sub_institute_id` | 1 | 1 | lib/erp-client.ts |
| `term_id` | 1 | 1 | lib/erp-client.ts |

Plus 47 storage accesses through named constants (e.g. ACADEMIC_YEAR_STORAGE_KEY in lib/academic-year.ts). The auth token/session lives in `userData` (53 files read it directly) and `menuContext` (38 files) as full JSON blobs in **localStorage** (survives tab close; readable by any XSS). contexts/AuthContext.tsx:38-41,187-209 writes only `auth`, `menuContext`, `userData` (the complete login payload including the JWT `user_token`, `host_name` and academic terms) and `sessionDate`. Other spellings that readers probe for - `sessionData`, `sessiondata`, `session`, `user_data`, `academicSession`, `academicData` - are never written anywhere in the repo, yet are probed by app/fees/_lib/fees-api.ts:93, app/general/onboarding/api.ts:272, app/hooks/useMenuRights.ts:81, app/library/_lib/library-module-utils.ts:174, app/student/monthwise_student_attendance/page.tsx:314 and lib/erp-client.ts (8 files probe 'sessiondata', 7 probe 'user_data'). Other keys read directly: `token` (never written anywhere; referenced only in a comment at app/ai-reports/[id]/page.tsx:104 and by the dead components/intelligence/AiInsightsPanel.tsx:66), `syear`, `sub_institute_id`, `term_id` (lib/erp-client.ts), `auth` (app/h5p/data/h5p.ts).

### 6c. Session-reader re-implementations

Besides the shared `buildSessionContext()` (lib/erp-client.ts; used by 232 files), **60 separate functions** across 46 distinct names read the same localStorage blobs and rebuild {token, subInstituteId, syear, userId}:

| Function name | Definitions | Files |
|---|---|---|
| readSession | 8 | app/api/fees/reports/_lib/fees-report-proxy.ts; hooks/use-ai-workspace.ts; lib/intelligence/ai-capabilities.ts; lib/intelligence/ai-configuration.ts |
| getSessionContext | 4 | app/fees/cancel-refund/page.tsx; app/fees/circulars/page.tsx; app/fees/collect/[studentId]/page.tsx; app/fees/collect/page.tsx |
| getCurriculumSession | 2 | app/course-master/data/curriculum.ts; app/student/page.tsx |
| buildSessionContext | 2 | app/fees/master/fees-config-master/page.tsx; lib/erp-client.ts |
| getTimetableSession | 2 | app/front_desk/classwisetimetable/api.ts; app/front_desk/create-timetable/api.ts |
| readSessionExtras | 2 | app/pal/data/pal-legacy.ts; app/pal/data/pal-lookups.ts |
| getInventorySession | 1 | app/Inventory/api.ts |
| getTransportationSession | 1 | app/Transportation/api.ts |
| getAcademicSetupSession | 1 | app/academic_setup/api.ts |
| getAdmissionEnquirySession | 1 | app/admissions/admission_enquiry/page.tsx |
| readStoredSession | 1 | app/components/ChatbotPanel.tsx |
| getSessionData | 1 | app/course-master/lesson-plan/[courseId]/page.tsx |
| resolveSessionTermId | 1 | app/course-master/lesson-plan/[courseId]/page.tsx |
| getExamSession | 1 | app/exam/exam-master/page.tsx |
| getMarksSession | 1 | app/exam/marks-entry/page.tsx |
| getSessionSources | 1 | app/fees/_lib/fees-api.ts |
| getFeesSession | 1 | app/fees/_lib/fees-api.ts |
| getGeneralSession | 1 | app/general/api.ts |
| getUserIdentity | 1 | app/h5p/data/h5p.ts |
| getHostelSession | 1 | app/hostel/api.ts |
| getHostelSetupSession | 1 | app/hostel/setup-api.ts |
| getQuestionPaperSession | 1 | app/lms/_shared/question-paper-grid.tsx |
| getReportsSession | 1 | app/lms/reports/page.tsx |
| getAiGenerationSession | 1 | app/organization_managment/Department/Component/ai-generation-drawer.tsx |
| getSopSession | 1 | app/organization_managment/Department/Component/sops.tsx |
| getDepartmentSession | 1 | app/organization_managment/Department/page.tsx |
| readSessionSummary | 1 | app/pal/new/data/gamification.ts |
| getProxySession | 1 | app/proxy_master/api.ts |
| resolveMonthwiseSession | 1 | app/student/monthwise_student_attendance/page.tsx |
| resolveStudentCertificateSession | 1 | app/student/student_certificate/StudentCertificateModule.tsx |
| resolveStudentIcardSession | 1 | app/student/student_icard/page.tsx |
| resolveTeacherIcardSession | 1 | app/student/teacher_icard/TeacherIcardModule.tsx |
| resolveSession | 1 | app/talent-management/_lib/use-performance.ts |
| getTaskSession | 1 | app/task-management/_lib/task-session.ts |
| resolveTaskSession | 1 | app/task-management/_lib/task-session.ts |
| getStoredSessionDetails | 1 | components/search-dropdown/SearchDropdown.tsx |
| readAdmissionsWorkspaceSession | 1 | lib/admissions/admissions-ai-stack.ts |
| readRequestSession | 1 | lib/agents/acting-user.ts |
| readAgentBrowserSession | 1 | lib/agents/client.ts |
| buildSessionHeaders | 1 | lib/agents/client.ts |
| readAiSession | 1 | lib/ai/session.ts |
| readAttendanceWorkspaceSession | 1 | lib/attendance/attendance-ai-stack.ts |
| getBrainSession | 1 | lib/brain/api.ts |
| readModuleWorkspaceSession | 1 | lib/module-ai/module-ai-stack.ts |
| getResultSession | 1 | lib/result/api.ts |
| readStudentsWorkspaceSession | 1 | lib/students/students-ai-stack.ts |

### 6d. Files that read `userData` straight from storage (53) instead of through buildSessionContext

- app/Utility/student-transfer/api.ts
- app/admissions/admission_enquiry/page.tsx
- app/components/ChatbotPanel.tsx
- app/components/DashboardShell.tsx
- app/components/Header.tsx
- app/components/Sidebar.tsx
- app/course-master/[courseId]/chapters/sideDrawer.tsx
- app/course-master/data/curriculum.ts
- app/course-master/lesson-plan/[courseId]/page.tsx
- app/course-master/page.tsx
- app/exam/data/aiPaper.ts
- app/exam/data/onlineExam.ts
- app/exam/data/progressReport.ts
- app/exam/exam-master/page.tsx
- app/exam/marks-entry/page.tsx
- app/fees/cancel-refund/page.tsx
- app/fees/collect/[studentId]/page.tsx
- app/fees/collect/page.tsx
- app/fees/master/fees-config-master/page.tsx
- app/general/implementation_management/api.ts
- app/general/onboarding/api.ts
- app/h5p/data/h5p.ts
- app/hostel/setup-api.ts
- app/lms/_shared/question-paper-grid.tsx
- app/lms/book-list/api.ts
- app/lms/dashboard/page.tsx
- app/lms/data/activityStream.ts
- app/lms/exam/_question-paper-templates/api.ts
- app/lms/homework/api.ts
- app/lms/lmsAnnotate_assignment/api.ts
- app/lms/lmsAssignment/api.ts
- app/lms/lmsAssignment_submission/api.ts
- app/lms/reports/page.tsx
- app/organization-management/_lib/use-employee-directory.ts
- app/organization-management/employee-directory/components/employee-directory.tsx
- app/organization_managment/Department/Component/ai-generation-drawer.tsx
- app/organization_managment/Department/Component/sops.tsx
- app/organization_managment/Department/page.tsx
- app/pal/data/pal-legacy.ts
- app/pal/data/pal-lookups.ts
- app/student/page.tsx
- app/students/ICards/api.ts
- app/talent-management/_lib/recruitment-session-extras.ts
- app/task-management/_lib/my-tasks-api.ts
- lib/brain/api.ts
- lib/intelligence/ai-capabilities.ts
- lib/intelligence/ai-configuration.ts
- lib/intelligence/ai-generate.ts
- lib/intelligence/ai-module.ts
- lib/intelligence/ai-policies.ts
- lib/intelligence/ai-templates.ts
- lib/result/api.ts
- lib/session/internal-access.ts

## 7. API response-shape assumptions

| Pattern | Occurrences | Files |
|---|---|---|
| .data.data | 2 | 1 |
| payload/json/result/response.data (any) | 717 | 214 |
| ?? / \|\| fallback chains on .data | 238 | 114 |
| status === 1 / '1' / == 1 | 151 | 61 |
| status_code | 208 | 72 |
| .success (truthy/=== true) | 84 | 56 |
| unwrapData-like helper definitions | 18 | 18 |
| recordArray/toCollection/toArray/asArray/asRecord/toRecord helper defs | 175 | 105 |

Envelope conventions observed simultaneously: (a) flat legacy envelope `{status:1|0|'1', message, <payload keys>}` (lib/erp-legacy.ts explicitly reads from the root), (b) `{status_code:1|0, message, data}` (Laravel mobile-style), (c) `{success:true|false, data}` (result REST, api-login), (d) `{status:1|0,'status_code':'1'}` strings vs numbers. There are **18 distinct unwrap/normalise helper definitions** and 175 isRecord/toRecord/readString-style helper definitions in 105 files - the same 6-10 primitives (readString, readNumber, asRecord, toCollection, recordArray) are re-declared per module instead of imported (lib/erp-client.ts and lib/erp-legacy.ts export them and are imported by 189 / 38 files).

## 8. Date formatting

| Pattern | Occurrences | Files |
|---|---|---|
| toLocaleDateString( | 86 | 63 |
| toLocaleDateString('en-IN' | 16 | 11 |
| toLocaleDateString('en-GB' | 21 | 18 |
| toLocaleDateString('en-US' | 31 | 18 |
| toLocaleDateString(undefined\|[]\|no locale) | 17 | 16 |
| toLocaleString( | 190 | 77 |
| toLocaleTimeString( | 7 | 6 |
| Intl.DateTimeFormat | 20 | 12 |
| date-fns format( | 19 | 19 |
| toISOString().slice(0, 10) / split('T')[0] | 45 | 31 |
| literal DD-MM-YYYY / DD/MM/YYYY tokens | 5 | 1 |
| literal YYYY-MM-DD tokens | 47 | 26 |
| date helper function definitions (format*Date*\|to*Date*) | 76 | 66 |

Four visible-date locales are in use at once (en-IN 16, en-GB 21, en-US 31, browser default 17 call sites of toLocaleDateString), so the same date renders DD/MM/YYYY in some screens and MM/DD/YYYY in others; **76 locally-defined date helper functions in 66 files**; the shared date-only helper lib/date-only.ts (toDateOnly/fromDateOnly/todayDateOnly) is imported by only **2** files whereas the ISO-slice idiom `toISOString().slice(0,10)` (UTC based - off by one day around midnight IST) appears 45 times in 31 files. lib/academic-year.ts (readSelectedAcademicYear) is imported by 7 files.

## 9. Currency / number formatting

| Pattern | Occurrences | Files |
|---|---|---|
| literal ₹ | 29 | 13 |
| 'INR' | 27 | 14 |
| toFixed(2) | 42 | 25 |
| toFixed( any ) | 105 | 56 |
| Intl.NumberFormat | 25 | 19 |
| Intl.NumberFormat('en-IN' | 20 | 14 |
| Intl.NumberFormat other locale | 5 | 5 |
| toLocaleString('en-IN' | 100 | 35 |
| toLocaleString('en-US' | 2 | 2 |
| toLocaleString() no locale | 82 | 38 |
| currency helper function definitions | 22 | 16 |

22 currency/number helper definitions in 16 files (formatCurrency/formatMoney/formatINR/formatAmount/... ) - no single shared money formatter. Three families coexist: Intl.NumberFormat('en-IN', {style:'currency'}) (20), `toLocaleString('en-IN')` (100, Indian digit grouping) and locale-less `toLocaleString()` (82, grouping follows the server/browser locale - a US-locale browser prints 1,234,567 instead of 12,34,567), plus manual `'₹' + x.toFixed(2)` concatenation (29 ₹ literals). Money is handled as JS floating point everywhere (`toFixed` 105 times) - no minor-unit integers.

## 10. Status vocabularies (exact string literals; case/format variants)

| Concept | Total | Variants (literal: count/files) |
|---|---|---|
| active | 477 | "active": 324/122f; "Active": 153/66f |
| success | 399 | "success": 387/183f; "Success": 7/3f; "SUCCESS": 5/5f |
| completed | 328 | "completed": 210/102f; "Completed": 96/51f; "COMPLETED": 22/7f |
| pending | 297 | "pending": 201/81f; "Pending": 83/45f; "PENDING": 13/7f |
| in_progress | 206 | "in_progress": 57/30f; "In Progress": 49/23f; "in-progress": 46/17f; "In progress": 38/22f; "IN-PROGRESS": 14/8f; "IN PROGRESS": 2/2f |
| draft | 186 | "draft": 129/66f; "Draft": 57/34f |
| inactive | 176 | "inactive": 103/40f; "Inactive": 73/40f |
| rejected | 165 | "rejected": 125/62f; "Rejected": 40/28f |
| approved | 164 | "approved": 113/53f; "Approved": 51/31f |
| failed | 96 | "failed": 93/43f; "Failed": 3/3f |
| published | 93 | "published": 78/39f; "Published": 15/13f |
| open | 93 | "Open": 48/28f; "open": 31/21f; "OPEN": 14/6f |
| closed | 68 | "Closed": 46/16f; "closed": 22/11f |
| present | 63 | "present": 39/15f; "Present": 24/15f |
| absent | 61 | "absent": 37/17f; "Absent": 24/15f |
| overdue | 57 | "Overdue": 34/17f; "overdue": 23/11f |
| partial | 46 | "partial": 41/19f; "Partial": 5/5f |
| cancelled | 44 | "Cancelled": 27/16f; "cancelled": 17/14f |
| late | 38 | "late": 25/12f; "Late": 13/11f |
| expired | 33 | "expired": 22/12f; "Expired": 11/6f |
| on_hold | 32 | "ON HOLD": 14/8f; "On Hold": 9/6f; "on_hold": 6/4f; "on-hold": 3/3f |
| paid | 25 | "paid": 18/4f; "Paid": 7/3f |
| submitted | 22 | "Submitted": 12/9f; "submitted": 10/7f |
| resolved | 18 | "Resolved": 10/6f; "resolved": 8/7f |
| scheduled | 16 | "Scheduled": 9/6f; "scheduled": 7/4f |
| confirmed | 10 | "Confirmed": 5/2f; "confirmed": 5/3f |
| accepted | 8 | "Accepted": 6/3f; "accepted": 2/2f |
| declined | 5 | "Declined": 5/3f |
| unpaid | 1 | "unpaid": 1/1f |
| waiting | 1 | "Waiting": 1/1f |

On top of casing, statuses are also numeric/letter coded in wire data (`status === 1` / `'1'` 151 hits, `status_code` 208, `.success` 84). "in progress" alone has six spellings ("in_progress", "In Progress", "in-progress", "In progress", "IN-PROGRESS", "IN PROGRESS"); active/inactive use "active"/"Active"; attendance uses present/Present/absent/Absent plus the single-letter P/A codes (app/attendance/_lib/attendance-api.ts:84-88, app/student/student_attendance/page.tsx:54). No shared status enum or label map exists.

## 11. Files that deviate - minority spellings by file (variants used in 30 files or fewer)

| Variant | Files (occurrences) |
|---|---|
| `institute_id` (5 in 5 files) | app/career-explorer/_lib/types.ts (1); app/components/ChatbotPanel.tsx (1); lib/ai/mcp-client.ts (1); lib/intelligence/client.ts (1); lib/intelligence/workspace.ts (1) |
| `instituteId` (78 in 29 files) | lib/intelligence/client.ts (7); app/components/ai-workspace/ActionsTab.tsx (6); lib/intelligence/workspace.ts (6); lib/ai/mcp-client.ts (4); lib/intelligence/ai-capabilities.ts (4); lib/intelligence/ai-configuration.ts (4); lib/intelligence/ai-generate.ts (4); lib/intelligence/ai-module.ts (4); lib/intelligence/ai-policies.ts (4); lib/intelligence/ai-templates.ts (4); app/h5p/data/question-bank-library.ts (3); lib/agents/executors.ts (3); app/_components/ai-stack/knowledge-base-screen.tsx (2); app/admissions/ai-stack/_screens/admissions-knowledge-base-screen.tsx (2); app/ai-journey/page.tsx (2); app/ai-reports/[id]/page.tsx (2); app/attendance/ai-stack/_screens/attendance-knowledge-base-screen.tsx (2); app/student/ai-stack/_screens/students-knowledge-base-screen.tsx (2); lib/ai/session.ts (2); lib/intelligence/template-engine.ts (2); app/api/agents/_lib/handler.ts (1); app/api/mcp/tools/call/route.ts (1); app/fees/ai-stack/_screens/fees-knowledge-base-screen.tsx (1); components/intelligence/AiInsightsPanel.tsx (1); hooks/use-ai-workspace.ts (1); lib/admissions/admissions-ai-stack.ts (1); lib/attendance/attendance-ai-stack.ts (1); lib/module-ai/module-ai-stack.ts (1); lib/students/students-ai-stack.ts (1) |
| `tenantId` (39 in 7 files) | lib/agents/store.ts (19); lib/brain/api.ts (13); app/enterprise-brain/settings/page.tsx (2); app/fees/intelligence/_lib/fees-intelligence-api.ts (2); app/enterprise-brain/ingestion/page.tsx (1); app/enterprise-brain/knowledge/ai-assistant/page.tsx (1); app/enterprise-brain/knowledge/kasba/page.tsx (1) |
| `tenant_id` (28 in 7 files) | lib/agents/engine.ts (9); lib/agents/store.ts (8); app/enterprise-brain/automation/agents/_components/AgentManagement.tsx (3); lib/agents/acting-user.ts (3); lib/agents/types.ts (3); app/api/agents/_lib/handler.ts (1); app/enterprise-brain/settings/page.tsx (1) |
| `client_id` (63 in 21 files) | app/course-master/page.tsx (5); app/general/onboarding/api.ts (5); app/hooks/useMenuRights.ts (5); app/student/page.tsx (5); app/course-master/data/chapters.ts (4); app/hostel/setup-api.ts (4); contexts/AuthContext.tsx (4); app/course-master/data/lmsCourses.ts (3); app/fees/_lib/fees-api.ts (3); app/pal/data/pal-legacy.ts (3); app/student/monthwise_student_attendance/page.tsx (3); app/student/student_certificate/StudentCertificateModule.tsx (3); app/student/student_icard/page.tsx (3); app/student/teacher_icard/TeacherIcardModule.tsx (3); app/components/ChatbotPanel.tsx (2); app/course-master/lesson-plan/[courseId]/curriculum/page.tsx (2); app/subjects/_lib/subjects-api.ts (2); app/api/fees/reports/_lib/fees-report-proxy.ts (1); app/data/menuMappers.ts (1); app/library/_lib/library-module-utils.ts (1); app/login/page.tsx (1) |
| `x-mcp-institute-id` (13 in 10 files) | app/api/ai/ask/stream/route.ts (2); lib/intelligence/ai-capabilities.ts (2); lib/intelligence/ai-templates.ts (2); app/components/ChatbotPanel.tsx (1); lib/intelligence/ai-configuration.ts (1); lib/intelligence/ai-generate.ts (1); lib/intelligence/ai-module.ts (1); lib/intelligence/ai-policies.ts (1); lib/intelligence/client.ts (1); lib/intelligence/workspace.ts (1) |
| `academic_year_id` (31 in 23 files) | app/student/page.tsx (3); app/admissions/admission_enquiry/page.tsx (2); app/course-master/page.tsx (2); app/fees/cancel-refund/page.tsx (2); app/fees/circulars/page.tsx (2); app/fees/master/fees-config-master/page.tsx (2); app/lms/_shared/question-paper-grid.tsx (2); app/academic_setup/create_periods/page.tsx (1); app/components/ChatbotPanel.tsx (1); app/course-master/data/curriculum.ts (1); app/fees/_lib/fees-api.ts (1); app/fees/collect/[studentId]/page.tsx (1); app/fees/collect/page.tsx (1); app/lms/reports/page.tsx (1); app/student/monthwise_student_attendance/page.tsx (1); app/student/student_certificate/StudentCertificateModule.tsx (1); app/student/student_icard/page.tsx (1); hooks/use-ai-workspace.ts (1); lib/admissions/admissions-ai-stack.ts (1); lib/attendance/attendance-ai-stack.ts (1); lib/erp-client.ts (1); lib/module-ai/module-ai-stack.ts (1); lib/students/students-ai-stack.ts (1) |
| `academicYear (camel)` (92 in 42 files) | app/easy_com/_components/EntryPage.tsx (11); app/enterprise-brain/page.tsx (8); lib/agents/client.ts (5); app/library/lost_damage_report/page.tsx (4); lib/ai/mcp-client.ts (4); lib/intelligence/client.ts (4); app/fees/intelligence/_components/fees-intelligence-screen.tsx (3); app/fees/master/new-fees-title-master/page.tsx (3); app/inward_outward/_components/ReportPage.tsx (3); lib/agents/executors.ts (3); lib/intelligence/workspace.ts (3); app/_components/ai-stack/knowledge-base-screen.tsx (2); app/admissions/admission_enquiry/page.tsx (2); app/admissions/ai-stack/_screens/admissions-knowledge-base-screen.tsx (2); app/attendance/ai-stack/_screens/attendance-knowledge-base-screen.tsx (2); app/easy_com/_components/ReportPage.tsx (2); app/easy_com/_lib/types.ts (2); app/student/ai-stack/_screens/students-knowledge-base-screen.tsx (2); components/intelligence/module/ModuleIntelligence.tsx (2); components/intelligence/module/contracts/fees.ts (2); lib/intelligence/template-engine.ts (2); app/ai-journey/page.tsx (1); app/ai-reports/[id]/page.tsx (1); app/api/agents/_lib/handler.ts (1); app/api/mcp/tools/call/route.ts (1); app/easy_com/notification_report/page.tsx (1); app/easy_com/send_notification_parents/page.tsx (1); app/easy_com/send_sms_report/page.tsx (1); app/fees/ai-stack/_screens/fees-knowledge-base-screen.tsx (1); app/fees/intelligence/_lib/fees-intelligence-api.ts (1) ...(+12 more) |
| `staff_id` (9 in 3 files) | lib/agents/executors.ts (5); lib/agents/registry.ts (3); lib/front-desk/front-desk-ai-stack.ts (1) |
| `employee_id` (55 in 16 files) | app/hrit/_lib/payroll-api.ts (11); app/hrit/_lib/attendance-api.ts (8); app/hrit/_lib/leave-api.ts (7); app/talent-management/offboarding/components/offboarding-center.tsx (7); app/talent-management/_lib/onboarding-api.ts (4); app/organization-management/disciplinary-library/components/disciplinary-management.tsx (3); app/talent-management/_lib/development-career-api.ts (3); app/hrit/_lib/leave-mappers.ts (2); app/hrit/leave-management/leave-reports/page.tsx (2); app/organization-management/_lib/disciplinary-library-api.ts (2); app/hrit/leave-management/leave-requests/page.tsx (1); app/talent-management/_lib/offboarding-api.ts (1); app/talent-management/_lib/use-development-career.ts (1); app/talent-management/development-and-career-paths/components/development-career-center.tsx (1); app/talent-management/onboarding/components/onboarding-sidebar.tsx (1); lib/agents/executors.ts (1) |
| `learner_id` (21 in 11 files) | app/pal/data/pal-intervention.ts (5); app/h5p/data/h5p-model.ts (3); app/pal/new/data/gamification.ts (3); app/pal/new/gamification/_components/GamificationScope.tsx (2); components/domain/lms/sessions-calendar/sessions-calendar-service.ts (2); app/h5p/data/h5p.ts (1); app/pal/data/pal-eso.ts (1); app/pal/intervention/page.tsx (1); app/pal/new/data/coherence-map.ts (1); components/intelligence/module/registry.ts (1); lib/agents/registry.ts (1) |
| `userType` (9 in 2 files) | app/student/report/_lib/student-report.ts (5); app/student/report/StudentReportModule.tsx (4) |
| `user_type` (17 in 4 files) | app/general/fields_configuration/page.tsx (14); app/library/book_resources/page.tsx (1); app/student/report/_lib/student-report.ts (1); app/students/student_documents/api.ts (1) |
| `role (word)` (15 in 4 files) | app/task-management/my-tasks/components/create-task-modal.tsx (8); app/capability-intelligence/competency-framework/components/framework-mapping.tsx (3); app/hrit/_lib/leave-api.ts (3); app/hrit/leave-management/leave-configuration/components/RolesAccessTab.tsx (1) |
| `is_student` (2 in 1 files) | app/documents/_lib/document-access.ts (2) |
| `access_token` (1 in 1 files) | app/task-management/administration/integration/components/integration-providers.ts (1) |
| `jwt` (40 in 38 files) | app/general/onboarding/_lib/onboarding-api.ts (2); app/pal/_components/AdaptiveLearningButton.tsx (2); app/admin-services/_lib/visitor.ts (1); app/api/dashboard/admin/route.ts (1); app/api/dashboard/student/route.ts (1); app/api/dashboard/teacher-fee-dues/route.ts (1); app/api/dashboard/teacher-icard/route.ts (1); app/api/dashboard/teacher-timetable/route.ts (1); app/api/dashboard/teacher/route.ts (1); app/attendance/_lib/attendance-api.ts (1); app/course-master/data/chapters.ts (1); app/dashboard/_lib/dashboard-preferences.ts (1); app/documents/_lib/document-access.ts (1); app/documents/_lib/documents-api.ts (1); app/easy_com/_lib/api.ts (1); app/h5p/data/h5p-model.ts (1); app/lms/data/leaderBoard.ts (1); app/lms/data/socialCollaborative.ts (1); app/organization_managment/_lib/department-management-api.ts (1); app/pal/data/pal-content.ts (1); app/pal/data/pal-eso.ts (1); app/pal/data/pal-v4.ts (1); app/pal/eso/knowledge-map/[conceptId]/page.tsx (1); app/pal/eso/mastery/[conceptId]/page.tsx (1); app/pal/eso/page.tsx (1); app/pal/new/data/administration.ts (1); app/pal/new/data/coherence-map.ts (1); app/pal/new/data/content-model.ts (1); app/pal/new/data/gamification.ts (1); app/pal/new/gamification/_components/GamificationScope.tsx (1) ...(+8 more) |

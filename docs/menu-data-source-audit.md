# Menu Data-Source Audit

**Repository:** lms_k12 (Teach Connect LMS)
**Date:** 2026-08-22 (updated)
**Scope:** All 54 top-level menus (app modules) under `app/`

---

## Summary

**14 of the 54 top-level menus contain static/hardcoded data.** The remaining 40 are fully API-driven (39 verified live API + 1 empty placeholder, `admission-Enquiry`).

> The sidebar menu **structure itself** is fully dynamic — `app/data/menuItems.ts` is an empty array populated from the menu API at runtime (see `app/data/menuMappers.ts`). This audit covers the **data rendered by each menu's screens**, not the navigation tree.

| Verdict | Menus | Share |
|---|---|---|
| API-driven (live backend) | 39 | 72% |
| Fully static / hardcoded | 5 | 9% |
| Mixed (API + some hardcoded screens) | 8 | 15% |
| Static data present only as dead code | 1 | 2% |
| Empty placeholder | 1 | 2% |
| **Total** | **54** | 100% |

This revision adds, for every static-data screen: the **menu path** (the route as it appears under its sidebar module), the **field shape** the hardcoded data currently renders, and a **sample/dummy row** in that shape — so the API contract each screen needs is unambiguous. Every flagged screen already ships with hardcoded sample rows except `organization-management/compliance-library`'s record table (that table is genuinely API-driven; only its department/employee lookup is static) — dummy rows are supplied there too, marked accordingly.

> **Correction to the original audit:** the SOP "recent activity" finding was mis-attributed to a menu called `Institute_Detail`, which does not exist in the current tree. The file actually lives at `app/organization_managment/Department/Component/sops.tsx` — under the **`organization_managment`** menu, a distinct module from the hyphenated `organization-management` (compliance-library, disciplinary-library, employee-directory, role-and-permissions). This revision reclassifies the finding under `organization_managment` and treats the two as separate menus, as the codebase does.

---

## Method

1. Scanned all ~700 `.ts` / `.tsx` files across the 54 menu directories under `app/`.
2. Built a whole-repo import graph to detect API usage:
   - Direct network calls: `fetch(`, `axios`, `API_BASE_URL`, `buildSessionContext`, `erpGet/erpPost`, `apiClient`, `useSWR`, `XMLHttpRequest`.
   - Propagated through **relative and `@/` alias imports** into shared data layers (e.g. `lib/result/api`, `app/fees/_lib/fees-api`, `lib/erp-client`).
3. Flagged hardcoded record arrays (inline `const rows = [ {...}, {...} ]`, `useState([ {...} ])`) and explicit `mock data` / `hardcoded` / `demo data` comments.
4. Manually verified every flagged file to exclude:
   - UI configuration (nav links, tab lists, table column definitions, dropdown option lists, form field configs).
   - Arrays derived from API-fetched props/state.
   - Historical/negative comments (e.g. *"never hardcoded"*, *"replaces the hardcoded list the legacy screen shipped with"*).
5. **(This revision)** For each flagged file, traced its route(s) — either the `page.tsx` itself or, for shared data modules, every page that imports it — and extracted the exact field shape of the rendered records, so each row below is a ready-made API response contract.

---

## Findings

### A. Fully static menus — 5 (no API integration at all)

#### `ai-platforms` — menu path: `/ai-platforms`
**File:** `app/ai-platforms/page.tsx` (5 hardcoded tool cards)
- Fields: `name, description, category, website, logo, accent, surface, Icon`
- Sample dummy row:
  ```json
  { "name": "Gamma", "description": "Create presentations, documents, and web pages with AI-powered design assistance.", "category": "Presentation generation", "website": "https://gamma.app", "accent": "#2553B5" }
  ```

#### `attendance` — menu path: `/attendance/attendance_dashboard`
**File:** `app/attendance/attendance_dashboard/page.tsx` (10 hardcoded students + an 8-point trend series)
- Fields (student register): `id, name, rollNo, class, section, status, admissionNo`
- Fields (trend chart): `attendanceTrendData` — `labels[], present[], absent[], late[], leave[]`
- Sample dummy row:
  ```json
  { "id": "STU001", "name": "Kiara Kapoor", "rollNo": "4", "class": "9", "section": "A", "status": "present", "admissionNo": "ADM-2026-0424" }
  ```

#### `chapters` — menu path: `/chapters`
**File:** `app/chapters/page.tsx` (5 hardcoded chapters + 1 fixed assessment card)
- Fields: `title, progress, lessons[], pdfName, simulatorName, takeaway, content`
- Sample dummy row:
  ```json
  { "title": "Matter Around Us", "progress": 100, "lessons": ["States of Matter", "Properties", "Changes in State"], "pdfName": "Chapter_1_Matter_Notes.pdf", "simulatorName": "Particle Physics Simulator" }
  ```

#### `quiz` — menu path: `/quiz/create`
**File:** `app/quiz/create/page.tsx` (2 subjects / 5 chapters, 1 seeded question, fixed quiz-details block)
- Fields (subjects): `id, name, chapters[{id, name}]`
- Fields (questions): `id, text, options[], correctOptionIndex`
- Fields (quizDetails): `title, timeLimit, passingScore`
- Sample dummy row (subject): `{ "id": 1, "name": "Science", "chapters": [{"id": 101, "name": "Matter Around Us"}] }`
- Sample dummy row (question): `{ "id": 1, "text": "Which state of matter has a definite volume but no definite shape?", "options": ["Solid","Liquid","Gas","Plasma"], "correctOptionIndex": 1 }`

#### `subjects` — menu paths: `/subjects`, `/subjects/categories`
**Files:** `app/subjects/page.tsx` (21 subjects), `app/subjects/categories/page.tsx` (6 categories)
- Fields (`/subjects`): `name, chapters, progress, emoji, color`
- Sample dummy row: `{ "name": "Mathematics", "chapters": 12, "progress": 80, "emoji": "📐", "color": "#6366F1" }`
- Fields (`/subjects/categories`): `name, count, emoji, color`
- Sample dummy row: `{ "name": "Arts", "count": 24, "emoji": "🎨", "color": "#6366F1" }`

---

### B. Mixed menus — 8 (API-driven, but specific screens render hardcoded data)

#### `students` — 5 mock screens
| Menu path | File | Fields | Sample dummy row |
|---|---|---|---|
| `/students/health_medical` | `app/students/health_medical/page.tsx` (8 rows) | `initials, name, grade, section, bloodGroup, condition, allergies, vaccination, infirmaryVisits` | `{"initials":"AS","name":"Aarav Sharma","grade":"6","section":"A","bloodGroup":"O+","condition":"—","allergies":"None","vaccination":"Overdue","infirmaryVisits":0}` |
| `/students/discipline` | `app/students/discipline/page.tsx` (5 rows) | `date, initials, name, grade, section, category, demeritPoints, status` | `{"date":"28 Jun","initials":"IR","name":"Ira Reddy","grade":"9","section":"B","category":"Late to class","demeritPoints":-2,"status":"Resolved"}` |
| `/students/house` | `app/students/house/page.tsx` (4 houses, 7 members each) | `id, name, points, captain{name,initials}, memberCount, members[{id,initials}], color, borderColor` | `{"id":"aravali","name":"Aravali","points":820,"captain":{"name":"Aarav Sharma","initials":"AS"},"memberCount":25,"members":[{"id":"1","initials":"AS"}]}` |
| `/students/student_documents` | `app/students/student_documents/page.tsx` (6 rows) | `id, name, class, section, admissionNo, verifiedDocs, totalDocs, pendingDocs, missingDocs, status, lastUpdated` | `{"id":"STU001","name":"Aarav Sharma","class":"6","section":"A","admissionNo":"ADM-2026-0421","verifiedDocs":4,"totalDocs":6,"pendingDocs":2,"missingDocs":0,"status":"pending","lastUpdated":"2024-01-15"}` |
| `/students/ICards` | `app/students/ICards/page.tsx` (1 preview record, not a list) | `schoolName, cardTitle, name, admissionNo, gradeClass, house, bloodGroup, emergencyContact, validTill, initials, photoUrl` | `{"schoolName":"Hills High School","cardTitle":"STUDENT IDENTITY CARD","name":"Kiara Kapoor","admissionNo":"ADM-2026-0424","gradeClass":"Grade 9 - A","house":"Vindhya","bloodGroup":"AB+","emergencyContact":"+91 9800112519","validTill":"31 Mar 2027","initials":"KK"}` |

> Note: `house.members` lists only 7 entries per house while `memberCount` claims 25 — the dummy payload should either populate all 25 members or the API should return `memberCount` as a derived count of the actual `members[]` length, not an independent field.

#### `hrit` — menu paths: `/hrit/attendance-management/attendance-reports`, `/hrit/leave-management/leave-reports`
**File:** `app/hrit/attendance-management/attendance-reports/services/report-data.ts` — consumed by `app/hrit/attendance-management/attendance-reports/page.tsx`
- `earlyGoingMockData` (15 rows) — Fields: `id, employee, employeeId, department, date, punchIn, punchOut, expectedOut, earlyBy, earlyByMin, status`
  - Sample: `{"id":"1","employee":"Amit Sharma","employeeId":"EMP001","department":"Engineering","date":"2026-06-20","punchIn":"09:00 AM","punchOut":"01:30 PM","expectedOut":"06:00 PM","earlyBy":"4h 30m","earlyByMin":270,"status":"present"}`
- `departmentReportMockData` (5 rows) — Fields: `id, department, totalEmployees, present, absent, late, earlyGoing, averageWorkingHours, attendancePercentage`
  - Sample: `{"id":"1","department":"Engineering","totalEmployees":45,"present":42,"absent":2,"late":1,"earlyGoing":8,"averageWorkingHours":"7h 45m","attendancePercentage":93.3}`
- `employeeReportMockData` (5 rows) — Fields: `id, date, employeeId, punchIn, punchOut, expectedIn, expectedOut, workingHours, lateBy, earlyBy, status`
  - Sample: `{"id":"1","date":"2026-06-20","employeeId":"EMP001","punchIn":"09:00 AM","punchOut":"06:00 PM","expectedIn":"09:30 AM","expectedOut":"06:00 PM","workingHours":"8h 0m","lateBy":"30m","earlyBy":"--","status":"late"}`
- `departments` / `employees` / `savedReports` — dropdown option lists (`{value,label}` pairs), 5 / 15 / 3 rows

**File:** `app/hrit/leave-management/leave-reports/services/leave-reports-data.ts` — consumed by `app/hrit/leave-management/leave-reports/page.tsx` and `.../components/LeaveReportsSections.tsx`
- `reports` (15 rows) — Fields: `id, title, description, category, icon, tone, saved`
  - Sample: `{"id":"leave-summary","title":"Leave Summary Report","description":"Summary of leave requests by status, type and department.","category":"Leave Request Reports","icon":"FileBarChart","tone":"bg-primary/10 text-primary","saved":true}`
- `categories` (6 strings), `selectOptions.dateRange` (4), `selectOptions.employeeStatus` (3) — static filter/dropdown options
- Leave types, departments, employees and statuses are **already** sourced live from `/api/leave/options` — only the report catalog and these filter option lists are hardcoded.

#### `course-master` — menu paths: `/course-master`, `/course-master/[courseId]/chapters`, `/course-master/lesson-plan/[courseId]`, `/course-master/lesson-plan/[courseId]/curriculum`, `/course-master/lesson-plan/[courseId]/chapters`
**File:** `app/course-master/data/courses.ts` (24 hardcoded courses)
- Fields: `id, title, code, subject, category, classGrade, status, chapters, enrollments, progress, instructor, createdAt, accentColor, icon`
- Sample dummy row:
  ```json
  { "id": "c1", "title": "Social Science Fundamentals", "code": "SS-101", "subject": "Social Sciences", "category": "My Course", "classGrade": "Class 8", "status": "Active", "chapters": 12, "enrollments": 340, "progress": 78, "instructor": "Mrs. Sharma", "createdAt": "2024-06-15", "accentColor": "#F59E0B", "icon": "globe" }
  ```
- `categories` (3 fixed strings — "My Course", "SEL", "STEM Resources") is an independent hardcoded filter list; `subjects` and `classGrades` are derived at runtime from `courses` via `new Set(...)`, so they need no separate dummy data once `courses` is API-backed.

#### `admissions` — menu paths: `/admissions/admission_form`, `/admissions/admission_followUp`
**File:** `app/admissions/admission_form/page.tsx` (3 form templates)
- Fields: `id, title, grades, status, fieldsCount, ageRule, fields[{name,type,required}]`
- Sample dummy row: `{"id":"AF","title":"Admission form 2026–27","grades":"Primary · Grades 1–5","status":"Published","fieldsCount":7,"ageRule":"5y 10m – 7y (Grade 1)"}`

**File:** `app/admissions/admission_followUp/page.tsx`
- `tasks` (6 rows) — Fields: `id, day, weekday, time, type, title`
  - Sample: `{"id":"t1","day":"04","weekday":"FRI","time":"10:00","type":"Call","title":"Call — Diya Menon (Grade 6)"}`
- `communicationLogs` (4 rows) — Fields: `id, initials, actor, actionText, target, timeAgo, bgColor, textColor`
  - Sample: `{"id":"c1","initials":"PN","actor":"Priya N.","actionText":"logged a call with","target":"Diya Menon","timeAgo":"12m ago"}`

#### `lms` — menu paths: `/lms/reports`, `/lms/exam`
**File:** `app/lms/reports/page.tsx` — entirely static, 5 separate hardcoded arrays, no API calls at all
- `summaryStats` (4 rows) — Fields: `label, value, helper, progress, color` — sample: `{"label":"Overall completion","value":"40%","helper":"19 of 48 topics","progress":40}`
- `subjectCompletion` (6 rows) — Fields: `subject, percent, color` — sample: `{"subject":"Mathematics","percent":62}`
- `lessonStatuses` (3 rows) — Fields: `label, value, percent, color` — sample: `{"label":"Completed","value":126,"percent":62}`
- `monthlyLessons` (12 rows) — Fields: `month, value, forecast?, current?` — sample: `{"month":"Jul","value":25}`
- `scheduleRows` (6 rows) — Fields: `subject, color, planned, delivered, status` — sample: `{"subject":"Mathematics","planned":32,"delivered":32,"status":"On track"}`

**File:** `app/lms/exam/page.tsx` — mixes live API data (teacher-facing `apiExams`) with hardcoded student-facing datasets:
- `studentChapterProgressData` (1 chapter, 4 nested concepts) — Fields: `chapterId, chapterTitle, badgeLabel, chapterMastery, conceptsMastered, averageMastery, practiceAttempts, masteryThreshold, concepts[]`
- `studentPracticeAssessments` (2 rows, nested questions) — Fields: `conceptId, durationMinutes, masteryTarget, questions[]`
- `studentOnlineExams` (3 rows) — Fields: `id, name, standard, subject, classLabel, chapter, availabilityWindow, questions, marks, durationMinutes, attempts, status, actionLabel` — sample: `{"id":"ONL-301","name":"Sound - term paper","standard":"Grade 8","subject":"Science","status":"Available"}`
- `studentOnlineQuestionPapers` (1 exam, 5 nested questions)
- `createExamSteps` (4 rows, UI wizard config — not data to API-back)

#### `organization_managment` — menu path: `/organization_managment/Department`
**File:** `app/organization_managment/Department/Component/sops.tsx` (the SOP list itself is already live from `/api/ai-sop`; only "recent activity" is hardcoded)
- `recentActivity` (3 rows) — Fields: `id, icon, user, text, date`
- Sample dummy row: `{"id":"act-1","user":"Priya Nair","text":"uploaded SOP Employee Onboarding Workflow","date":"12 Jun 2025"}`

#### `organization-management` — menu path: `/organization-management/compliance-library`
**File:** `app/organization-management/compliance-library/components/compliance-library-management-shared.tsx`
- `departments` (5 rows) — Fields: `label, value, employees[]` — sample: `{"label":"Human Resources","value":"Human Resources","employees":["Aarav Mehta","Priya Sharma","Neha Kapoor"]}`
- `frequencyOptions` (7 fixed strings: One-Time, Daily, Weekly, Monthly, Quarterly, Yearly, Custom) — dropdown config, not row data
- The actual `ComplianceRecord` table on this screen is already API-driven with **no local fallback rows**. Suggested dummy row for reference/testing once the department lookup above is wired to the same source as the record API:
  ```json
  { "id": "CMP-2026-0031", "title": "Fire Safety Certification Renewal", "department": "Human Resources", "assignedTo": "Aarav Mehta", "frequency": "Yearly", "dueDate": "2026-12-01", "status": "Pending" }
  ```

#### `talent-management` — menu paths: `/talent-management/recruitment` (and other panels using the shared profile view), `/talent-management/administration`
**File:** `app/talent-management/_components/talent-profile-data.ts` (`mockProfileData`, 1 record) — consumed by `talent-profile-view.tsx`, used from `app/talent-management/recruitment/components/recruitment-center.tsx` and `app/talent-management/_components/competency-focus-banner.tsx`
- Fields: `id, name, avatarInitials, status, role, department, employeeId, joinedDate, location, businessUnit, grade, reportsTo, employeeType, workEmail, dateOfBirth, gender, phone, personalEmail, employmentStatus, probationStatus, nextReview, aadhaarNo, pan, pfNumber, bloodGroup, nationality, maritalStatus, dateInCurrentRole, totalExperience, skills[], timeline[], teamMembers[], tags[], attachments[]`
- Sample dummy row (trimmed): `{"id":"EMP12345","name":"Priya Sharma","role":"Senior Product Manager","department":"Product Management","status":"Active Employee"}`

**File:** `app/talent-management/administration/components/admin-data.ts` — consumed by `app/talent-management/administration/components/admin-center.tsx`
- `mockAdminKPIs` (5 rows, **actually rendered on the live page**) — Fields: `id, title, value, linkText, icon` — sample: `{"id":"kpi-1","title":"Active Workflows","value":"28","linkText":"View all workflows"}`
- `mockWorkflows` (8 rows) — Fields: `id, name, module, status, version, description, createdBy, lastUpdated, updatedBy, stages[], approvers[]` — sample: `{"id":"wf-1","name":"Job Requisition Approval","module":"Recruitment","status":"Active","version":"1.3","createdBy":"Admin","lastUpdated":"May 12, 2025"}`. This array is currently unused dead code — `AdminCenter` already calls `AdminService.getWorkflows` for the workflow list — so only `mockAdminKPIs` needs an API replacement; `mockWorkflows` should be deleted per the group-C guidance below rather than integrated.

---

### C. Static data present only as dead code — 1 (plus 2 related dead files under `talent-management`)

| Menu | File | Note |
|---|---|---|
| `pal` | `app/pal/content-model-data.ts` | Orphaned — **no importers**. All live PAL pages (`/pal/report`, `/pal/result`, `/pal/new/*`) fetch from the API. Data shape: `palParentModules` (2 rows, fields: `slug, title, subtitle, icon, accent, bullets, href`), `frameworkModules`/`uluModules` (7 + 4 rows, fields: `slug, title, subtitle, icon, accent, bullets, coverage, implementation, gap`). Sample: `{"slug":"casel-sel-integration","title":"CASEL / SEL Integration","implementation":"Not Implemented","gap":"No CASEL tagging and no SEL evidence collection."}`. **No integration needed — recommend deletion.** |
| `talent-management` | `app/talent-management/mobility-and-succession/components/mobility-data.ts` | Orphaned — `mobility-center.tsx` (menu path `/talent-management/mobility-and-succession`) uses the live `mobilityService` instead. `mockMobilityKPIs` (6 rows: `id, title, value, trend{value,isPositive/isNeutral}, icon, action`) and `mockInternalJobs` (7 rows: `id, jobId, title, department, location, grade, postedOn, applications, status` — sample: `{"jobId":"INT-2024-018","title":"Senior Product Manager","department":"Product","location":"Bengaluru","grade":"G7","postedOn":"12 May 2024","applications":24,"status":"Open"}`). **No integration needed — recommend deletion.** |
| `talent-management` | `app/talent-management/offboarding/components/offboarding-data.ts` | Orphaned — `offboarding-center.tsx` (menu path `/talent-management/offboarding`) uses the live `offboarding-api.ts` instead. `mockOffboardingKPIs` (6 rows: `id, title, value, subtitle, icon`) and `mockExitCases` (8 rows: `id, caseId, employee{name,id,initials,title,manager,doj}, department, lastWorkingDay, exitReason, status, owner, updatedOn` — sample: `{"caseId":"EC-2025-00123","employee":{"name":"Arjun Mehta","id":"EMP10023","title":"Product Engineer II","manager":"Rohit Verma","doj":"15 Jan 2022"},"department":"Product Engineering","status":"Notice Period"}`). **No integration needed — recommend deletion.** |

### D. Verified API-driven menus — 39

`Inventory`, `Transportation`, `Utility`, `academic_setup`, `admin-services`, `bazar`, `career-counselling`, `classteacher`, `classteacherReport`, `dashboard`, `document-templates`, `easy_com`, `exam`, `fees`, `front_desk`, `general`, `h5p`, `hostel`, `import-data`, `inward_outward`, `learning-outcome`, `library`, `login`, `migration-modules`, `proxy_master`, `proxy_report`, `reports`, `result`, `settings`, `sqaa`, `sqaa_document_report`, `sqaa_master`, `student`, `task-management`, `teacher_daily_report`, `teachertransfer`, `todays_proxy_report`, `user`, `user_log`, and `organization-management`*

\* `organization-management` is API-driven overall but counted in group B due to the hardcoded `compliance-library` department/employee lookup. `organization_managment` (the distinct, underscored menu — see the correction note above) is similarly API-driven aside from its hardcoded SOP activity feed. The same "otherwise API-driven" caveat applies to the other group-B menus.

### E. Empty placeholder — 1

`admission-Enquiry` — a single placeholder page with no data source.

---

## Notes & caveats

- The codebase is self-documenting about mock data — many files carry header comments such as *"Mock data extracted directly from the design system specifications"* (`app/students/health_medical/page.tsx`), so `grep -rn "mock data\|hardcoded" app/` recovers most of the list.
- `app/lms/message/page.tsx` is an intentional "Not yet available" placeholder: the legacy Laravel source has no controller logic or data model, so there is nothing to integrate. Not counted as static data.
- Some "hardcoded" mentions are negative assertions of good practice (e.g. `app/fees/_components/fees-charts.tsx`: *"they come from the response, never hardcoded"*; `app/hrit/_lib/use-salary-certificate.ts` documents a hardcoded list that was **replaced** by an API). These were excluded.
- A file is counted as "static" only when the hardcoded data is actually rendered or consumed by a live page; orphaned mock files are listed separately in group C.
- This revision surfaced a naming collision the original pass missed: `app/organization-management/` and `app/organization_managment/` are two different, unrelated modules (compliance/disciplinary/roles vs. department/org-profile). Anyone integrating APIs from this document should double-check the hyphen vs. underscore before wiring an endpoint to the wrong screen.

## Recommended follow-ups

1. **Prioritise group A** (`attendance`, `subjects`, `chapters`, `quiz`, `ai-platforms`) for API integration — these menus show entirely fabricated data to users. Use the field shapes and sample rows above as the initial API response contract for each.
2. **Replace the `students` mock screens** (health, discipline, house, documents, ID cards) — they display realistic-looking personal/medical data that could be mistaken for real records. Fix the `house.members`/`memberCount` mismatch noted above when wiring the API.
3. **Wire `hrit` attendance/leave reports** to the backend, or clearly mark them as demo data in the UI. The `departments`/`employees`/`savedReports`/`categories` option lists can likely reuse existing lookup endpoints elsewhere in the app rather than new ones.
4. **Delete dead mock files**: `pal/content-model-data.ts`, `talent-management/mobility-and-succession/components/mobility-data.ts`, `talent-management/offboarding/components/offboarding-data.ts`, and `talent-management/administration/components/admin-data.ts`'s unused `mockWorkflows` export — none of these are rendered by any live page, so there is nothing to integrate, only to remove.
5. **Move `course-master/data/courses.ts`** behind the course API, since live pages currently mix it with fetched data across five routes.
6. **Split the `organization-management` vs `organization_managment` follow-up work** into two separate tickets given they are unrelated modules that happen to share a near-identical name.

---

*Audit produced by an automated source scan (import-graph API detection + hardcoded-array detection) with manual verification of every flagged file. This revision adds menu-path mapping, field-shape extraction, and dummy sample rows via targeted re-reads of every flagged file and its route consumers.*

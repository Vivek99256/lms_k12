# Role-Based User Journey — EduERP

A menu-wise, screen-flow map of the live system for the three roles tested: **Admin**, **Teacher**, **Student**. No screenshots — this is the navigation logic: which menus each role sees, which sub-menu leads to which screen, and what the user does next at each step.

Built by logging into the running app as each role and walking every sidebar group, every mega-menu module, and every screen tab programmatically, so the menu lists below are exact — not estimated.

---

## 0. How navigation works for every role (read this first)

All three roles share **one shell** with the same click pattern; only the *contents* differ per role, decided entirely by the backend based on the logged-in account's permissions.

```
Login  →  Dashboard  →  Sidebar group  →  Mega-menu module  →  Screen tab  →  Action  →  Result
```

1. **Login** — one shared screen (email + password) for every role. On success the app always redirects to `/dashboard`.
2. **Dashboard** — same route (`/dashboard`) for everyone, but the backend returns role-specific content: an Admin sees school-wide KPIs, a Teacher sees their own classes, a Student sees their own subjects/homework. The **sidebar menu itself is also role-specific** — it's built from the same backend response, not hardcoded per role in the frontend.
3. **Sidebar group** — clicking a top-level group (e.g. "Institute ERP") opens a **mega-menu flyout** listing every module in that group. A `+N` badge next to a module name means "this module has N more screens once you open it."
4. **Mega-menu module** — clicking a module (e.g. "Fees") opens a horizontal **tab bar** under the top bar, listing every screen inside that module (e.g. `Fees Collect | Fees Cancel/Refund | Fees Circular | ...`). The first tab loads automatically.
5. **Screen tab** — the actual working screen: a filter panel + table (search/report screens), or a form (entry/create screens). Every module also carries a **"Master"** tab — the setup/configuration screen that feeds the dropdowns used elsewhere in that module (grades, categories, templates, etc.).
6. **Action → Result** — from here the pattern is consistent across nearly every module in the system:
   - **List/Search screens** → filter → **Search** → table of results → click a row → opens the detail/edit view for that record.
   - **Entry/Create screens** → fill the form → **Save/Submit** → returns to the list, or shows a confirmation.
   - **Report screens** → set filters (class/date/status/etc.) → **Search** → table renders → **Export** where offered.
   - **Master/Setup tabs** → configure the reference data other tabs in the same module depend on.

Keep this pattern in mind — it's called out once here instead of being repeated for all ~200 screens below.

---

## 1. Admin journey

**Login:** `kalpesh@triz.co.in` → **Dashboard:** school-wide KPIs (total students, staff, classes, fees collected today, admissions this year, pending parent messages) + Quick actions (Add student, Collect fee, View reports, Manage settings).

**Sidebar groups visible:** Dashboard, **Institute ERP**, **LMS + PAL**, **People & Competency**, **Career Counseling**, **Reports** — all 6, the full set. Admin is the only role with unrestricted access to every group.

### 1.1 Institute ERP (36 modules — the core day-to-day operations menu)

| Module (mega-menu) | Screens inside (tab bar, in order) | Lands on |
|---|---|---|
| **Student** | Search/Edit Student, Student Documents, Bulk Student Update, Master | `/students/search_student` |
| **Fees** | Fees Collect, Fees Cancel/Refund, Fees Circular, Other Fees Collect, Other Fees Cancel, Export NACH Excel, Import NACH Excel (x2 more), Master | `/fees/collect` |
| **Users** | (single screen — add/manage system users) | `/user/add_user` |
| **Attendance** | Student Attendance, Master | `/student/student_attendance` |
| **Mobile Apps** | Calendar, Photo Video Gallery, Leave Application, Exam Schedule, Master | `/front_desk/calendar` |
| **Student I-card** | Student I-card, Master | `/student/student_icard` |
| **Certificate** | Student Certificate, Master | `/student/student_certificate` |
| **Communication** | Send SMS Parents, Send SMS Staff, Send Notification Parents, Send Email Parents, Send WhatsApp Parents, Master | `/easy_com/send_sms_parents` |
| **Timetable** | Assign Class Teacher, Proxy Management, Create Timetable, Master | `/classteacher` |
| **Student Medical** | Student Infirmary, Student Vaccination, Student Height/Weight, Student Health, Master | `/student/student_infirmary` |
| **Exam** | Mark Entry, Co-scholastic Mark, Upload Result, HPC Activity Entry, Master | `/exam/marks-entry` |
| **Admission** | Admission Inquiry, Admission Registration, Admission Confirmation, Master | `/admissions/admission_enquiry` |
| **Student Request** | Student Request, Master | `/students/requests` |
| **Inward Outward** | Add Inward, Add Outward, Master | `/inward_outward/add_inward` |
| **User I-card** | User I-card, Master | `/student/user_icard` |
| **Petty Cash** | Petty Cash, Master | `/admin-services/petty-cash` |
| **Circular** | (single screen) | `/front_desk/circular` |
| **Hostel** | Hostel Room Allocation, Visitor Details, Master | `/hostel/hostel-room-allocation` |
| **Parent Communication** | (single screen) | `/front_desk/parent_communication` |
| **Consent** | Master | routes to dashboard shell (light module) |
| **PTM** | PTM Attended Status, Master, PPTM Setup | `/admin-services/ptm-attended-status` |
| **Student Discipline** | (single screen) | `/student/dicipline` |
| **Teacher Transfer Utility** | (single screen) | `/teachertransfer` |
| **Visitor Management** | Add Visitor, Master, AAPI Settings | `/admin-services/add-visitor` |
| **Transport** | Student Transport Mapping, Master, Transportation Setup | `/Transportation/student_transport_mapping` |
| **Inventory** | Requisition Form, Requisition Approved, Item Direct Purchase, Item Quotation, Generate PO, Negotiate PO, Item Receivable, Inventory Allocation, Inventory Return, Inventory Defective, Master, Inventory Setup | `/Inventory/requisition_form` |
| **Template Management** | Add Template | `/general/template_management` |
| **Institute Detail** | Institute Profile, Department, Master | `/Institute_Detail/Institute_profile` |
| **SQAA** | (single screen) | `/sqaa_master` |
| **Front Desk** | Front Desk, Master, AAPI Settings | `/admin-services/front-desk` |
| **Task Management** | Task Management, Master, General Setup | `/task.index` |
| **Complaint** | Complaint Management, Master, General Setup | `/admin-services/complaint-management` |
| **Utility** | Rollover, Breakoff Rollover, Update All Data, Student Transfer, Form Builder, Custom Module, Master | `/Utility/rollover` |
| **Result Template** | (single screen) | `/result/result-template` |
| **Donation Management** | Donation Collection, Donation Report, Master | `/donation_collection.index` |
| **Document Templates** | All Templates, Certificates, ID Cards, Fee Documents, Admission Documents, Master | `/document-templates` |

**Sample end-to-end flow — enrolling a student (the most common Admin journey):**

```
Login → Dashboard
  → Sidebar: Institute ERP
    → Mega-menu: Admission
      → Tab: Admission Inquiry        (screen: enquiry roster + funnel/source charts)
        → Action: click "+ Enquiry" or open an existing enquiry row
        → Next: Tab "Admission Registration"   (screen: convert enquiry → registration form)
          → Action: fill registration form → Save
          → Next: Tab "Admission Confirmation"  (screen: confirm seat, generate GR number)
            → Action: Confirm → student record created
            → Next: Sidebar → Institute ERP → Student → Search/Edit Student
              (the new student now appears in the roster; admin edits documents/profile from here)
```

**Sample end-to-end flow — collecting a fee:**

```
Login → Dashboard → Quick action "Collect fee"  (same destination as the menu path below)
  → Sidebar: Institute ERP → Mega-menu: Fees → Tab: Fees Collect
    → Screen: filter by student/section/standard/date/status
      → Action: search student → select pending fee record
        → Next: fee collection form opens → enter amount/mode → Save
          → Result: receipt generated; record now shows in Fees Report (Reports group)
```

**Sample flow — taking attendance:**

```
Login → Dashboard → Sidebar: Institute ERP → Mega-menu: Attendance → Tab: Student Attendance
  → Screen: select standard → division → date → Search
    → Action: register loads with student rows → Mark All Present/Absent or mark individually
      → Next action: Save Attendance → confirmation → (optionally) Sidebar → Reports → Student Report → Attendance reports to verify
```

**Sample flow — entering exam marks:**

```
Login → Dashboard → Sidebar: Institute ERP → Mega-menu: Exam → Tab: Mark Entry
  → Screen: cascading filters — term → section → standard → division → subject → exam master → exam → Search
    → Action: marks grid loads → enter marks per student → Save
      → Next: Tab "Upload Result" (bulk-publish results) or Sidebar → Reports → Student Report → result-related reports
```

### 1.2 LMS + PAL (7 modules — content, testing, engagement)

| Module | Screens inside | Lands on |
|---|---|---|
| **Teach/Learn** | Course Catalog, Master, LMS Setup | `/course-master` |
| **Test** | Exam, Assignment, Assignment Submission, PAL, Online Exam, Exam-wise Progress Report, Question Wise Report, Master, General Setup | `/lms/exam` |
| **Engagement** | Leader Board, Master | `/lms/leader-board` |
| **Interactions** | Activity Stream, Message, Student Analysis Report, LMS Dashboard, Master | `/lms/activity-stream` |
| **Curriculum Planning** | Curriculum Plan, Monthly, Lesson Planning, Reports, Teacher Diary, Book List, Syllabus Plan, Master | `/lms/curriculum-planning` |
| **Homework** | Student Homework, Homework Submission, Student Homework Report, Homework Submission Report, Master | `/lms/homework` |
| **New PAL** | Content Model, Administration, Gamification, Master | `/pal/new/content-model` |

**Sample flow — assigning homework:**

```
Login → Dashboard → Sidebar: LMS + PAL → Mega-menu: Homework → Tab: Student Homework
  → Screen: filter by section/standard/division/subject → Search students
    → Action: select students → assign homework (title/instructions/due date) → Save
      → Next: Tab "Homework Submission" (review what students turned in)
        → Next: Tab "Student Homework Report" / "Homework Submission Report" (track completion)
```

### 1.3 People & Competency

Sidebar group is present, but opening it returned **no mega-menu items** for this account — either an empty/unconfigured module for this tenant, or a permission gap specific to this login. Flag this for a follow-up with real HR-admin credentials before treating it as "no HR module exists."

### 1.4 Career Counseling (1 module)

```
Login → Dashboard → Sidebar: Career Counseling → Mega-menu: Career Counseling
  → Screen: `/career-counselling` (no further sub-tabs — a single working screen for counseling workflows)
```

### 1.5 Reports (13 report groups, ~90 individual reports)

| Report group | Individual reports inside | Lands on |
|---|---|---|
| **Student Report** | Student Report, Student Strength, Agewise, Student Request, Student Certificate, Student Health, Student Homework, Student Homework Submission, Van Wise, Van Summary, Student Discipline, Missing Document, In-active Student, Boys/Girls Daywise Attendance, Monthwise Attendance, Yearly Attendance, Master (16 reports) | `/student/report/student_report` |
| **Admission Report** | Inquiry Followup, Admission Inquiry, Admission Registration, Admission Without Confirmation, Admission Confirmation, Master | `/admissions/admission_reports/inquiry-followup` |
| **Institute Report** | View Classwise Timetable, View Facultywise Timetable, Class Teacher Report, Today's Proxy Report, Proxy Report, Circular Report, Master | `/front_desk/classwisetimetable` |
| **Fees Report** | Fees Collection, Other Fees, Other Fees Cancel, Datewise Summary, Fees Structure, Fees Monthly, Fees Cancel, Fees Type Wise, Fees Defaulter, Student Breakoff, Master | `/fees/reports/fees-collection` |
| **Hostel Report** | Visitor Report, Hostel Report, Available Room Report, Master | `/show_hostel_visitor_report.index` |
| **Inward Outward Report** | Inward Report, Master | `/inward_outward/show_inward_report` |
| **Communication Report** | Email, Send SMS, Register Parent, Notification, WhatsApp, Master | `/easy_com/email_report` |
| **Exam Report** | (result-focused reports) | `/result/student-result` |
| **LMS Report** | LMS Dashboard, Student Analysis, Examwise Progress, Question Wise, PAL Report, Master | `/lms/dashboard` |
| **Inventory Report** | Staff Wise, Item Delivery Status, Requisition, Item Wise, Overall Item, Master | `/Inventory/staff_wise_report` |
| **HRMS Report** | Attendance, New Attendance, Early Going, Dept-wise Attendance, Leave, Leave Summary, Leave Encashment, Salary Structure, Monthly Payroll, Payroll, Payroll Type, Bankwise Payroll, User Payroll History, Monthly Attendance (14 reports) | `/hrms_attendance_report.index` |
| **SQAA Report** | SQAA Document Report, Master | `/sqaa_document_report` |
| **Other Reports** | User Log, User Report, Dynamic Report, Complaint Report, Petty Cash Report, Front Desk Report, Consent Report, Teacher Wise Daily Report, Visitor Report, PTM Report | `/user_log` |

**Sample flow — pulling a report:**

```
Login → Dashboard → Sidebar: Reports → Mega-menu: Fees Report → Tab: Fees Collection Report
  → Screen: filter by date range / class / status → Search
    → Action: table renders → Export (where offered)
      → Next: switch tabs within the same report group (e.g. "Fees Defaulter Report") without re-navigating the sidebar
```

**Known gap:** the Admin dashboard's "Manage settings" quick action currently points to `/settings`, which returns a 404 — it isn't reachable through the sidebar/mega-menu system at all, only through that one dashboard shortcut.

---

## 2. Teacher journey

**Login:** `teacher@gmail.com` → **Dashboard:** classroom-focused — My classes, My students, Subjects, Homework to review, Assignments to grade, Quick actions (Take attendance, Post homework, Grade assignments, Post circular). This particular account isn't assigned as a class teacher this year, so several dashboard panels show an empty state rather than data.

**Sidebar groups visible:** **Dashboard, Institute ERP only.** No LMS + PAL, People & Competency, Career Counseling, or Reports — a materially smaller menu than Admin, same shell.

### 2.1 Institute ERP (12 modules — a filtered subset of Admin's 36)

| Module | Screens inside | Lands on |
|---|---|---|
| **Student** | Search/Edit Student, Bulk Student Update, Master | `/students/search_student` |
| **Users** | (single screen) | `/user/add_user` |
| **Attendance** | Student Attendance, Master | `/student/student_attendance` |
| **Mobile Apps** | Exam Schedule, Master | `/front_desk/exam_schedule` |
| **Certificate** | Student Certificate, Master | `/student/student_certificate` |
| **Student Medical** | Student Infirmary, Student Vaccination, Student Height/Weight, Student Health, Master | `/student/student_infirmary` |
| **Exam** | HPC Entry v1, Master | `/result/result_activity_marks_V1` |
| **Student Request** | Student Request, Master | `/students/requests` |
| **User I-card** | User I-card, Master | `/student/user_icard` |
| **Circular** | (single screen) | `/front_desk/circular` |
| **Student Discipline** | (single screen) | `/student/dicipline` |
| **Teacher Transfer Utility** | (single screen) | `/teachertransfer` |

**What's missing versus Admin, and why it matters for the journey:** no Fees, Admission, Timetable-authoring, Communication, Inventory, Hostel, Transport, Front Desk, Donation, or any of the LMS+PAL/Reports/Career groups. A teacher's entire journey is bounded to *their own students* — attendance, certificates, medical records, discipline notes, and exam mark entry for the subjects/classes they're assigned to. The **screens themselves are identical** to the Admin versions (same route, same UI) — the backend scopes the *data* (only their classes) rather than the frontend rendering a different screen.

**Sample flow — taking attendance (identical mechanics to Admin, scoped data):**

```
Login → Dashboard → Sidebar: Institute ERP → Mega-menu: Attendance → Tab: Student Attendance
  → Screen: select standard/division (limited to teacher's assigned classes) → date → Search
    → Action: mark present/absent → Save Attendance
      → Result: reflected on the teacher's own dashboard "My classes" panel next login
```

**Sample flow — entering marks:**

```
Login → Dashboard → Sidebar: Institute ERP → Mega-menu: Exam → Tab: HPC Entry v1
  → Screen: select class/subject (own assignments only) → Search
    → Action: enter marks/HPC activity scores → Save
```

---

## 3. Student journey

**Login:** `student1@gmail.com` → **Dashboard:** personal — "Welcome back, student1 · 7-C", enrolled subjects, pending homework, pending assignments, "My subjects" chips (Hindi-A, Hindi Grammar), recent circulars for their class.

**Sidebar groups visible:** **Dashboard, LMS + PAL, Career Counseling.** No Institute ERP at all — students have zero access to the operational/administrative menu; their entire journey lives inside learning content and counseling.

### 3.1 LMS + PAL (5 modules — a learning-only subset of Admin's 7)

| Module | Screens inside | Lands on |
|---|---|---|
| **Teach/Learn** | Course Catalog, Master | `/course-master` |
| **Test** | Exam, Assignment, Assignment Submission, PAL, Master | `/lms/exam` |
| **Engagement** | Leader Board, Social & Collaborative, Portfolio, Virtual Classroom, Master | `/lms/leader-board` |
| **Interactions** | Activity Stream, Message, Master | `/lms/activity-stream` |
| **Curriculum Planning** | Monthly, Lesson Planning, Reports, Master | `/lms/dashboard` |

Note what's absent versus Admin/Teacher: no **Homework** module in the sidebar (homework is *authored* by teachers/admin; students instead reach their homework through the **Test → Assignment / Assignment Submission** tabs, and via the dashboard's "Pending homework" tile) and no **New PAL** admin/content-authoring module — students consume PAL content through **Test → PAL**, not administer it.

**Sample flow — taking an adaptive (PAL) test, the core student journey:**

```
Login → Dashboard
  → Sidebar: LMS + PAL → Mega-menu: Test → Tab: PAL
    → Screen: pick a chapter (e.g. "Sound - Chapter 3") → shows chapter mastery %, concepts mastered, adaptive-learning loop
      → Action: click "Learn content" on a not-yet-mastered concept
        → Next: content/lesson view for that concept
          → Action: click "Practice assessment"
            → Next: mastery-check quiz for that concept → submit
              → Result: mastery % updates; next concept in the chapter unlocks once threshold (75%) is met
      → Alternative tabs in the same module: "Online Exam" / "Offline Exam" for scheduled exams; "Assignment" / "Assignment Submission" for teacher-set homework
```

**Sample flow — checking homework:**

```
Login → Dashboard  (dashboard tile: "Pending homework")
  → Action: click tile OR Sidebar: LMS + PAL → Mega-menu: Test → Tab: Assignment
    → Screen: list of assigned homework/assignments
      → Action: open one → complete/submit
        → Next: Tab "Assignment Submission" shows submission status
```

### 3.2 Career Counseling (1 module — same as every other role)

```
Login → Dashboard → Sidebar: Career Counseling → Mega-menu: Career Counseling
  → Screen: `/career-counselling` — self-service counseling access, no further sub-tabs
```

---

## 4. Front desk / Staff — not directly tested

No dedicated front-desk credential was available for this crawl. From the Admin's Institute ERP menu we can see **Front Desk** exists as its own module (`Front Desk`, `Master`, `AAPI Settings` tabs, landing on `/admin-services/front-desk`), alongside **Visitor Management** and **Inward Outward** — the modules a front-desk role would most plausibly need. Based on the Teacher pattern (same shell, backend-filtered subset of Institute ERP), a front-desk account most likely gets: Dashboard → a scoped Institute ERP menu centered on Front Desk, Visitor Management, Inward Outward, and possibly Admission Inquiry — but this is inferred, not confirmed. **Recommend a follow-up crawl with a real front-desk login** to replace this with an exact menu map like the other three roles have.

---

## 5. Role comparison — menu access at a glance

| Sidebar group | Admin | Teacher | Student |
|---|:---:|:---:|:---:|
| Dashboard | ✅ (school-wide) | ✅ (own classes) | ✅ (own subjects) |
| Institute ERP | ✅ 36 modules | ✅ 12 modules (scoped) | ❌ |
| LMS + PAL | ✅ 7 modules | ❌ | ✅ 5 modules (learning-only) |
| People & Competency | ⚠️ present, empty for this account | ❌ | ❌ |
| Career Counseling | ✅ | ❌ | ✅ |
| Reports | ✅ 13 report groups (~90 reports) | ❌ | ❌ |

**The one rule that explains every difference above:** there is exactly one frontend shell (`Login → /dashboard → sidebar → mega-menu → tab bar → screen`), and the backend's permission model decides everything downstream of login — which sidebar groups render, which modules appear inside each mega-menu, which tabs exist inside each module, and which rows of data populate each screen. A new role or a changed permission doesn't need new screens built; it slots into the same shell with a different menu payload.

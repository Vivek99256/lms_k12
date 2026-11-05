# Data Model Overview

Last updated: 2026-11-04
Generated from commit: `8fe500dc` (frontend) / `86261072` (backend)

High-level table map for Scholar Suite v1. For complete column definitions, see the Laravel migration files in `F:\xampp\htdocs\next_lms_erp\database\migrations\`.

---

## 1. Multi-tenancy keys

Every table that holds school data carries at least one of these two keys:

| Key | Scope | Notes |
|---|---|---|
| `client_id` | All institutes under one client (school group) | Top-level tenant |
| `sub_institute_id` | One campus/branch | Most queries filter on this |

Super admin queries use `client_id`. All other queries use `sub_institute_id`.

---

## 2. Core ERP tables

### Authentication & users

| Table | Purpose |
|---|---|
| `tbluser` | Staff and admin users (login, profile, status) |
| `tblstudent` | Student accounts (login, GR no, roll no) |
| `tbluserprofilemaster` | Role/profile definitions per institute |
| `tblsubinstitutionmaster` | Institute master (name, address, logo) |
| `tblclientmaster` | Client (school group) master |

### RBAC

| Table | Purpose |
|---|---|
| `tblmenumaster` | Menu catalog — every screen in the platform |
| `tblgroupwise_rights` | Menu rights per profile |
| `tblindividual_rights` | Menu rights per user (overrides group) |

### Academic calendar

| Table | Purpose |
|---|---|
| `tblacademicyearmaster` | Academic year definitions |
| `tblacademictermmaster` | Term/semester definitions per year |
| `tblclassmaster` | Class/grade definitions |
| `tblsectionmaster` | Section/division per class |
| `tblsubjectmaster` | Subject definitions |

### Admissions

| Table | Purpose |
|---|---|
| `tblenquiry` | Admission enquiry records |
| `tblregistration` | Registration form submissions |
| `tbladmissionform` | Full admission form data |
| `tblstudentadmission` | Confirmed admissions |
| `tbladmissionfollowup` | Follow-up activity log |

### Students

| Table | Purpose |
|---|---|
| `tblstudent` | Student master (also auth — see above) |
| `tblstudentdetails` | Extended student profile |
| `tblparentdetails` | Parent/guardian details |
| `tblstudenttransfer` | Leaving certificate / TC records |
| `tblstudentdocuments` | Student document uploads |

### Fees

| Table | Purpose |
|---|---|
| `fees_master` | Fee head definitions |
| `fees_structure` | Fee structure per class/batch/year |
| `fees_collection` | Individual payment records |
| `fees_receipt` | Receipt documents |
| `fees_concession` | Concession/waiver records |
| `fees_refund` | Refund records |
| `fees_installment` | Instalment schedule per student |
| `fees_defaulter` | Overdue instalment flags |
| `fees_online_payment` | Online payment gateway transactions |
| `nach_mandate` | NACH mandate records |
| `nach_presentation` | NACH presentation batches |

### Attendance

| Table | Purpose |
|---|---|
| `tblstudentattendance` | Daily student attendance |
| `tbl_staff_attendance` | Staff attendance (manual + biometric) |
| `tblleavemaster` | Leave type definitions |
| `tblstaffleave` | Staff leave applications |

### Timetable

| Table | Purpose |
|---|---|
| `tbltimetable` | Timetable slots (class, subject, teacher, period) |
| `tblperiodmaster` | Period definitions per institute |

### Exams & Results

| Table | Purpose |
|---|---|
| `tblexammaster` | Exam definitions |
| `tblexamschedule` | Exam timetable |
| `tblresult` | Student result records |
| `tblmarksheet` | Marksheet generation metadata |
| `tblgradingmaster` | Grading scale definitions |
| `tblCCEmaster` | CCE / continuous evaluation definitions |

### Library

| Table | Purpose |
|---|---|
| `tbllibrarybookmaster` | Book catalog |
| `tbllibraryissue` | Book issue/return records |
| `tbllibrarypenalty` | Overdue penalty records |

### Hostel

| Table | Purpose |
|---|---|
| `tblhostelmaster` | Hostel and block definitions |
| `tblhostelroom` | Room definitions |
| `tblhostelallotment` | Student room allotments |
| `tblgatepass` | Gate pass requests and approvals |

### Transport

| Table | Purpose |
|---|---|
| `tblvehiclemaster` | Vehicle master |
| `tblroutemaster` | Route definitions |
| `tblstopmaster` | Stop points per route |
| `tbltransportallotment` | Student transport allotments |
| `tbltrip` | Trip records (live tracking) |

### Communication

| Table | Purpose |
|---|---|
| `tblcommunication` | Circular / announcement records |
| `tblcampaign` | Bulk message campaigns |
| `email_sent_parents` | Email delivery log |
| `whatsapp_sent_messages` | WhatsApp outbound log |
| `incoming_messages` | WhatsApp inbound log |

---

## 3. Platform services tables

| Table | Purpose |
|---|---|
| `app_notification` | Web/push notification queue and log |
| `gcm_users` | FCM push token registry |
| `AuditLog` | Audit trail for all significant actions |
| Platform workflow tables | Workflow run records (TBD — Platform/* models) |

---

## 4. Scholar Learn tables

| Table | Purpose |
|---|---|
| `tblcourse` | Course definitions |
| `tblchapter` | Course chapters |
| `tbllesson` | Lessons per chapter |
| `tblh5pcontent` | H5P interactive content records |
| `tblcourseprogress` | Student course progress |
| `tblpal_chapter` | PAL chapter definitions |
| `tblpal_concept` | Concept nodes in PAL knowledge graph |
| `tblpal_misconception` | Known misconception patterns |
| `tblpal_ulu` | Unit Learning Units |
| `tblpal_studentpath` | Per-student PAL learning path |

---

## 5. Scholar CCB tables

| Table | Purpose |
|---|---|
| `tblhremployee` | HR employee master |
| `tblpayroll` | Payroll run records |
| `tblsalarystructure` | Salary structure templates |
| `tblleave` | Leave policy and balances |
| `tblperformancereview` | Performance appraisal records |
| `tblcompetency` | Competency framework definitions |
| `tblorganization` | Org chart nodes |

---

## 6. Scholar Insight tables

| Table | Purpose |
|---|---|
| `tblreport` | Saved report configurations |
| `tblreportschedule` | Scheduled report delivery |
| `ai_conversations` | AI chatbot conversation history |
| `ai_api_keys` | AI provider API keys (write-only) |

---

## 7. Scholar Compass tables

| Table | Purpose |
|---|---|
| `tblcounselingsession` | Counseling session records |
| `tblcollegemaster` | College/university catalog |
| `tblcareerpath` | Career path definitions |
| `tblstudentassessment` | Career assessment results per student |

---

## 8. Key relationships

```
tblclientmaster (1) ──< (N) tblsubinstitutionmaster
tblsubinstitutionmaster (1) ──< (N) tbluser
tblsubinstitutionmaster (1) ──< (N) tblstudent
tblstudent (1) ──< (N) fees_collection
tblstudent (1) ──< (N) tblstudentattendance
tblstudent (1) ──< (N) tblresult
tblstudent (1) ──< (N) tblcourseprogress
tbluser (1) ──< (N) tblindividual_rights
tbluserprofilemaster (1) ──< (N) tblgroupwise_rights
tblmenumaster (1) ──< (N) tblgroupwise_rights
tblmenumaster (1) ──< (N) tblindividual_rights
fees_structure (1) ──< (N) fees_installment
fees_installment (1) ──< (N) fees_collection
```

---

## Source files

- `F:\xampp\htdocs\next_lms_erp\database\migrations\` — all migration files
- `F:\xampp\htdocs\next_lms_erp\app\Models\` — Eloquent models

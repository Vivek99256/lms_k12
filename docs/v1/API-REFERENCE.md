# API Reference — Scholar Suite v1

Last updated: 2026-11-04  
Generated from commit: `8fe500dc` (frontend) / `86261072` (backend)

> Consolidated API reference for the Scholar Suite backend. All routes are authenticated via Bearer JWT tokens and enforce granular institute tenant isolation.

---

## 1. Authentication & Session APIs

| Method | Endpoint | Description | Access Roles |
|---|---|---|---|
| `POST` | `/api/login` | Authenticate user credentials and return Bearer JWT token | Public |
| `POST` | `/api/logout` | Revoke current user session token | Authenticated |
| `GET` | `/api/user` | Fetch currently authenticated user profile and roles | Authenticated |
| `GET` | `/api/academic-terms` | Fetch list of active academic years and terms for current institute | Authenticated |
| `POST` | `/api/forgot-password` | Initiate password reset verification email or SMS | Public |

---

## 2. Scholar Core (ERP) APIs

### Admissions
| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/admission_enquiry` | List all student enquiries with filter and pagination |
| `POST` | `/api/admission_enquiry` | Create a new walk-in or digital enquiry lead |
| `PUT` | `/api/admission_enquiry/{id}` | Update enquiry status and schedule follow-up notes |
| `POST` | `/api/admission_registration` | Register formal student application with documents |
| `POST` | `/api/admission_confirmation` | Confirm application and auto-provision student record |

### Students & Attendance
| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/students/search` | Search student directory by name, roll no, or admission no |
| `POST` | `/api/student/add` | Provision new student master profile |
| `GET` | `/api/student/attendance` | Fetch attendance records for standard-division |
| `POST` | `/api/student/attendance` | Bulk record daily morning/afternoon attendance |
| `POST` | `/api/face_attendance/sync` | Biometric face recognition terminal sync |

### Fees Management
| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/fees/dashboard` | Fetch KPI totals, collection trends, and overdue balances |
| `GET` | `/api/fees/collect/{studentId}` | Fetch itemized fee ledger and concessions for student |
| `POST` | `/api/fees/collect` | Process fee payment transaction and generate receipt |
| `POST` | `/api/fees/cancel-refund` | Void receipt with audit reason and adjust balance |
| `GET` | `/api/fees/defaulters` | List defaulters categorized by class, term, and amount |

---

## 3. Scholar Learn (LMS & PAL) APIs

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/lms/lesson-plans` | Retrieve curriculum lesson plans for subject/standard |
| `POST` | `/api/lms/assignments` | Publish new student assignment with rubrics |
| `GET` | `/api/pal/coherence-map` | Fetch concept prerequisite nodes and mastery vectors |
| `POST` | `/api/pal/assessment-attempt` | Record student adaptive question response and recalculate mastery |
| `GET` | `/api/h5p/content/{id}` | Load H5P interactive learning object configuration |

---

## 4. Scholar CCB (People & Competency) APIs

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/hrit/staff` | Retrieve active staff directory and designations |
| `POST` | `/api/hrit/attendance` | Log daily faculty attendance and biometric events |
| `POST` | `/api/hrit/leave-request` | Submit staff leave application |
| `PUT` | `/api/hrit/leave-approval/{id}` | Department head approve or reject leave request |
| `POST` | `/api/hrit/payroll/generate` | Trigger monthly payroll calculation for institute |

---

## 5. Scholar Insight & Platform Services APIs

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/platform/registry` | Fetch master module and component registry |
| `GET` | `/api/platform/audit` | Query immutable platform audit log events |
| `GET` | `/api/platform/scheduler/tasks` | List registered cron jobs and last run status |
| `POST` | `/api/platform/scheduler/trigger` | Manually dispatch scheduled task execution |
| `GET` | `/api/ai/approvals` | Fetch pending agentic AI actions awaiting human sign-off |
| `POST` | `/api/ai/approvals/{id}/execute` | Authorize and execute gated agent action |


# Scholar Core — Product Overview

Last updated: 2026-11-04  
**Product:** Scholar Core  
**Scope:** Comprehensive Institute Resource Planning (ERP)

---

## 1. Executive Summary

**Scholar Core** is the foundational ERP backbone of the Scholar Suite. It unifies institutional operations from initial lead acquisition and admissions to student management, fee reconciliation, academic scheduling, attendance tracking, and alumni relations.

Core handles high-volume daily workflows for administrators, registrars, accountants, front-office personnel, teachers, parents, and students.

---

## 2. Key Modules & Sub-systems

| Module | Purpose | Key Routes | Key Entities & Tables |
|---|---|---|---|
| **Admissions** | Full student lifecycle onboarding: enquiry, registration, fee collection, document verification, and confirmation. | `/admissions/dashboard`, `/admissions/admission_enquiry`, `/admissions/registration` | `tbl_admission_enquiry`, `tbl_student_application` |
| **Student Management** | Comprehensive 360° student records, ID card generation, medical history, house allocation, discipline logs, and certificates. | `/students/dashboard`, `/student/add_student`, `/students/search_student`, `/student/student_documents` | `tblstudent`, `tblstudent_doc`, `tblstudent_health` |
| **Attendance** | Multi-mode attendance: manual roster, biometric sync, face recognition, and consolidated daily/monthly reporting. | `/student/student_attendance`, `/face_attendance/dashboard` | `tbl_attendance`, `biometric_logs` |
| **Academic Setup** | Batches, periods, master subjects, elective mapping, standard-division allocation, chapter catalogs, and class teacher assignments. | `/academic_setup/create_batch`, `/academic_setup/standard_division_mapping`, `/classteacher` | `batch`, `standard_division`, `tbl_subject` |
| **Timetable & Front Desk** | Dynamic timetable allocation, proxy management, circulars, parent communications, and visitor registration. | `/front_desk/create-timetable`, `/proxy_master`, `/front_desk/visitor-management` | `timetable`, `tbl_proxy`, `tbl_visitors` |
| **Fees & Accounting** | Fee structure definitions, fee collection rosters, online payment gateway reconciliation, concession management, NACH processing, and receipts. | `/fees/dashboard`, `/fees/collect`, `/fees/master-setup`, `/fees/scheduler` | `tbl_fees_master`, `tbl_fees_collection`, `tbl_receipt` |
| **Exam & Grading** | Exam schedules, marks entry, grading scales, assessment blueprints, and dynamic CBSE/State-board report card generation. | `/exam/schedule`, `/result/marks_entry`, `/result/report-cards` | `tbl_exam`, `tbl_marks_entry`, `tbl_grade_master` |
| **Support Services** | Library management, hostel accommodation, transport fleet routes and vehicle-student mappings, and inventory stores. | `/library/books`, `/hostel/rooms`, `/Transportation/transportation`, `/Inventory/inventory` | `library_books`, `hostel_rooms`, `tbl_transport_route` |

---

## 3. Integration Architecture

Scholar Core acts as the centralized source of truth for all student and staff identities, propagating events across:
- **Scholar Learn (LMS)**: Synchronizes course batches, student rosters, and teacher allocations.
- **Scholar CCB (HRIT)**: Synchronizes staff attendance, role designations, and payroll structures.
- **Scholar Insight (Enterprise Brain)**: Emits real-time administrative metrics for AI predictive analysis and defaulter intelligence.

---

## 4. Security & Access Control

Access within Scholar Core is governed strictly by institutional roles:
- `Super Admin` & `Admin`: Unrestricted module and financial configuration rights.
- `Accountant`: Dedicated fees collection, concession, and billing ledger rights.
- `Teacher`: Read-write access to attendance, marks entry, and assigned division records.
- `Front-Desk Staff`: Lead enquiries, visitor tracking, and inward/outward registers.


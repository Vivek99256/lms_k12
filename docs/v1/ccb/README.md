# Scholar CCB — Product Overview

Last updated: 2026-11-04  
**Product:** Scholar CCB (People & Competency)  
**Scope:** Human Resources, Capability Intelligence, Talent Development & Staff LMS

---

## 1. Executive Summary

**Scholar CCB (Competency & Capacity Building)** provides an integrated human capital and talent management solution tailored for educational organizations. It covers complete staff lifecycles: recruitment, onboarding, daily HRIT operations (attendance, leaves, payroll), professional development, and capability tracking.

CCB bridges traditional HR with active educator capacity building.

---

## 2. Key Modules & Sub-systems

| Module | Purpose | Key Routes | Key Entities & Tables |
|---|---|---|---|
| **HRIT Core** | Daily employee operations: biometric attendance tracking, shift planning, multi-tiered leave workflows, salary structures, and automated payroll runs. | `/hrit/attendance-tracking`, `/hrit/leave-management`, `/hrit/payroll-processing` | `tbl_staff`, `staff_attendance_logs`, `leave_requests`, `payroll_ledger` |
| **Talent Management** | End-to-end employee development: onboarding roadmaps, goal setting, 360° performance appraisal reviews, and offboarding settlements. | `/talent-management/recruitment`, `/talent-management/performance-reviews-and-appraisals` | `talent_appraisals`, `staff_kpi_targets` |
| **Capability Intelligence** | Institutional skill mapping, competency gap analysis, training needs identification, and leadership succession matrices. | `/capability-intelligence/skills-matrix`, `/capability-intelligence/gap-analysis` | `staff_competency_scores`, `training_programs` |
| **G2G LMS (Government-to-Gov / Staff Training)** | Professional development LMS designed for faculty and administrative upskilling, certifications, and compliance courses. | `/ccb/g2g-lms`, `/teach-learn/coursePresentation` | `g2g_course_catalog`, `staff_course_enrollments` |
| **Task Management** | Collaborative project management, department task delegation, dependencies, and accountability boards. | `/task-management/dashboard`, `/task-management/my-tasks` | `platform_tasks`, `task_workstreams` |

---

## 3. Workflow & Approval Architecture

CCB features built-in approval engines:
- **Leave Applications**: Subordinate &rarr; Department Head &rarr; Principal / HR Director.
- **Appraisal Cycles**: Self-appraisal &rarr; Peer Review &rarr; Evaluator Rating &rarr; Management Confirmation.
- **Payroll Auditing**: Automatic salary computation with manual HR verification before bank file export.


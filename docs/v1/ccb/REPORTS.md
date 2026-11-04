# Scholar CCB — Reports Catalog

Last updated: 2026-11-03
Generated from commit: `8fe500dc` (frontend) / `86261072` (backend)

> Catalog of all reports in Scholar CCB (People & Competency).

---

## HRIT — Attendance Reports

| Report Name | Module/Menu | Frontend Route | Roles | Key Filters | Export | Data Source |
|---|---|---|---|---|---|---|
| Staff Attendance Report | HRIT → Attendance | `/hrit/attendance-management/reports` | HR Admin, Principal | Date range, Department, Employee | Excel, PDF | `hrms_attendances` |
| Attendance Summary | HRIT → Attendance | `/hrit/attendance-management/*` | HR Admin | Month, Department | Excel | `hrms_attendances`, `hrms_in_out_times` |
| Late Arrivals Report | HRIT → Attendance | TBD | HR Admin | Date range, Shift | Excel | `hrms_attendances`, `tbluser_shift_records` |

---

## HRIT — Leave Reports

| Report Name | Module/Menu | Frontend Route | Roles | Key Filters | Export | Data Source |
|---|---|---|---|---|---|---|
| Leave Report | HRIT → Leave | `/hrit/leave-management/reports` | HR Admin, Manager | Date range, Employee, Leave type | Excel, PDF | `hrms_emp_leaves`, `hrms_leave_types` |
| Leave Balance Report | HRIT → Leave | `/hrit/leave-management/*` | HR Admin, Employee | Employee, Leave type, Year | Excel | `hrms_leave_allocation`, `hrms_emp_leaves` |
| Leave Requests Log | HRIT → Leave | `/hrit/leave-management/requests` | HR Admin | Date range, Status | Excel | `hrms_emp_leaves` |

---

## HRIT — Payroll Reports

| Report Name | Module/Menu | Frontend Route | Roles | Key Filters | Export | Data Source |
|---|---|---|---|---|---|---|
| Monthly Payroll Report | HRIT → Payroll | `/hrit/payroll-management/*` | HR Admin, Finance | Month, Year, Department | Excel, PDF | `employee_monthly_salary_data` |
| Salary Certificate | HRIT → Payroll | `/hrit/payroll-management/*` | HR Admin, Employee | Employee, Month | PDF | `hrms_salary_certificate` |
| Form 16 | HRIT → Payroll | `/hrit/payroll-management/*` | HR Admin | Employee, Financial year | PDF | `employee_monthly_salary_data` |
| Payroll Deduction Report | HRIT → Payroll | `/hrit/payroll-management/*` | HR Admin | Month, Deduction type | Excel | `hrms_emp_payroll_deduction` |

---

## Talent Management Reports

| Report Name | Module/Menu | Frontend Route | Roles | Key Filters | Export | Data Source |
|---|---|---|---|---|---|---|
| Recruitment Pipeline | Talent → Recruitment | `/talent-management/recruitment` | HR Admin, Recruiter | Date range, Department, Status | Excel | `talent_recruitment` |
| Onboarding Status | Talent → Onboarding | `/talent-management/onboarding` | HR Admin | Date range, Department | Excel | `talent_onboarding` |
| Performance Review Summary | Talent → Performance | `/talent-management/performance` | HR Admin, Manager | Review cycle, Department | Excel, PDF | `talent_performance` |
| Offboarding Report | Talent → Offboarding | `/talent-management/offboarding` | HR Admin | Date range, Department | Excel | `talent_offboarding` |

---

## Capability Intelligence Reports

| Report Name | Module/Menu | Frontend Route | Roles | Key Filters | Export | Data Source |
|---|---|---|---|---|---|---|
| Competency Gap Report | Capability → Framework | `/capability-intelligence/*` | HR Admin, Manager | Role, Department, Competency | Excel, PDF | `s_competency_frameworks`, `s_users_skills` |
| Skills Matrix | Capability → Library | `/capability-intelligence/competency-library` | HR Admin | Department, Skill | Excel | `s_skill_matrix`, `master_skills` |
| Employee Skills Report | Capability → Explorer | `/capability-intelligence/capability-explorer` | HR Admin, Employee | Employee, Skill domain | Excel | `tblemp_skills`, `s_users_skills` |

---

## G2G LMS Reports

| Report Name | Module/Menu | Frontend Route | Roles | Key Filters | Export | Data Source |
|---|---|---|---|---|---|---|
| Learning Progress Report | G2G LMS → My Learning | `/people-competency/lms/my-learning` | HR Admin, Employee | Employee, Course, Date range | Excel | G2G LMS tables |
| Certification Report | G2G LMS → Certifications | `/people-competency/lms/certifications` | HR Admin | Course, Date range | Excel, PDF | G2G LMS tables |
| Assignment Completion | G2G LMS → Assignments | `/people-competency/lms/assignments` | HR Admin, Manager | Assignment, Status | Excel | G2G LMS tables |
| Assessment Results | G2G LMS → Assessments | `/people-competency/lms/assessments` | HR Admin | Assessment, Department | Excel | G2G LMS tables |

---

## Task Management Reports

| Report Name | Module/Menu | Frontend Route | Roles | Key Filters | Export | Data Source |
|---|---|---|---|---|---|---|
| Task Report | Task Management | `/task-management/reports` | Admin, Manager | Project, Status, Assignee, Date range | Excel | `task_management_project` |
| Task Audit Log | Task Management → Admin | `/task-management/administration` | Admin | Date range, User | Excel | `task_status_history` |

---

> Detailed docs: `docs/v1/ccb/reports/<report-name>.md`

---

## Source files

- Frontend routes: `C:\rajesh\lms_k12\app\hrit\**\page.tsx`, `C:\rajesh\lms_k12\app\talent-management\**\page.tsx`
- Backend controllers: `F:\xampp\htdocs\next_lms_erp\app\Http\Controllers\HRMS\`, `F:\xampp\htdocs\next_lms_erp\app\Http\Controllers\Payroll\`
- Backend models: `F:\xampp\htdocs\next_lms_erp\app\Models\HRMS\`, `F:\xampp\htdocs\next_lms_erp\app\Models\TalentManagement\`

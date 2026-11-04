# Roles & Permissions Reference

Last updated: 2026-11-04
Generated from commit: `8fe500dc` (frontend) / `86261072` (backend)

This document is a cross-product role matrix. Detailed RBAC mechanics are in [_shared/rbac.md](./_shared/rbac.md).

---

## 1. How roles work

Scholar Suite does not ship with a fixed role list. Each institute defines its own profiles in `tbluserprofilemaster`. The names below are the conventional defaults; a school can rename or add more.

Rights are additive and menu-scoped:
- Group rights grant all users of a profile access to a menu item.
- Individual rights override a specific user (grant or revoke).
- There is no "deny" rule — rights can only be added, not negated per group.

---

## 2. Conventional role names (defaults)

| Profile name | Typical use | Typical modules |
|---|---|---|
| Super Admin | Client-level admin; sees all institutes | All |
| Admin | Institute-level admin | All (single institute) |
| Principal | School head; approves workflows | All (view + approve) |
| Vice Principal | Deputy head | Most academic modules |
| Teacher | Class/subject teacher | Attendance, Timetable, Exams, LMS |
| Accountant | Fee collection and reports | Fees, Reports |
| HR Manager | Staff records, payroll, leave | CCB (HR, Payroll) |
| Librarian | Library management | Library |
| Transport Manager | Routes, vehicles, trips | Transport |
| Hostel Warden | Hostel rooms, gate passes | Hostel |
| Student | Student self-service | Student portal, LMS (view) |
| Parent | Guardian | Fee receipts, Notifications, Reports |
| Counselor | Career guidance | Compass |
| Data Entry | Clerical entry | Limited modules |

---

## 3. Module-level access matrix (default)

Legend: **F** = Full (read + write + approve), **R** = Read-only, **A** = Approve only, **—** = No access

| Module | Super Admin | Admin | Principal | Teacher | Accountant | HR Manager | Student |
|---|---|---|---|---|---|---|---|
| Admissions | F | F | F | — | R | — | — |
| Fees | F | F | A | — | F | — | R |
| Student | F | F | R | R | — | — | R |
| Attendance | F | F | R | F | — | — | R |
| Timetable | F | F | R | R | — | — | R |
| Exams / Results | F | F | A | F | — | — | R |
| Library | F | F | — | R | — | — | R |
| Hostel | F | F | A | — | — | — | R |
| Transport | F | F | A | — | — | — | R |
| Communication | F | F | F | R | — | — | — |
| LMS (Scholar Learn) | F | F | R | F | — | — | R |
| PAL | F | F | R | R | — | — | R |
| HR / Payroll | F | F | A | — | — | F | — |
| Insight (reports) | F | F | F | R | R | R | — |
| Compass | F | F | R | — | — | — | R |
| Platform Services | F | F | — | — | — | — | — |

> This matrix shows typical defaults. Each institute configures the actual rights via `/general/groupwise_rights`.

---

## 4. Workflow approver types

| Type | How resolved | Example use |
|---|---|---|
| role | User with named profile | "Principal" approves result publish |
| user | Specific named user | "John Doe" approves payroll |
| reporting_manager | Derived from org chart at runtime | Manager approves leave |
| class_teacher | Derived from timetable at runtime | Class teacher approves gate pass |
| principal | Derived from institute record | Principal approves transfer |

---

## 5. Super admin vs admin

| Capability | Super Admin | Admin |
|---|---|---|
| Access multiple institutes | Yes | No (own institute only) |
| Create new institutes | Yes | No |
| Create profiles/roles | Yes | Yes (own institute) |
| View cross-institute reports | Yes | No |
| `is_admin` flag | 1 | 0 |
| `sub_institute_id` | 0 (global) | Specific institute ID |

---

## 6. Student & parent access

Students log in via `tblstudent`. They see only menus explicitly granted via their profile rights. Typical student-facing screens:

- Fee receipts and outstanding balance
- Attendance summary
- Results / report card
- LMS course content
- Scholar Compass (career guidance)

Parents (guardians) are notified via WhatsApp/SMS/email but do not have a separate login in v1.

---

## 7. Mobile app rights

The mobile app has a separate rights layer at `/general/mobile_app_rights`. A menu visible in the web app is not automatically visible in the mobile app — both must be granted.

---

## Source files

- `F:\xampp\htdocs\next_lms_erp\app\Http\Controllers\api\MenuRightsController.php`
- `F:\xampp\htdocs\next_lms_erp\database\migrations\*_create_tblmenumaster*`
- [_shared/rbac.md](./_shared/rbac.md)

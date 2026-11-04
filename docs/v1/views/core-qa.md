# Scholar Core — QA View

Last updated: 2025-11-04
Generated from commit: `8fe500dc` (frontend) / `86261072` (backend)

## Test Plan (Core)
| Module | Priority | Key Scenarios |
|---|---|---|
| Admissions | High | Enquiry->Registration->Form->Confirmation, followups |
| Fees | High | Collect fee, online fees, defaulters, cancellations/refunds |
| Student | High | Add/search student, documents, discipline, health |
| Attendance | High | Mark attendance, reports, face attendance |
| Exam/Result | High | Marks entry, approval, report card generation |
| Timetable | High | Create timetable, conflicts, teacher/student views |
| Library/Hostel/Transport/Inventory | Med-High | Core CRUD + reports |

## Regression checklist
- Academic year/session mapping
- Permissions/RBAC
- Exports (Excel/PDF)
- Validations

## Source files
- C:\rajesh\lms_k12\docs\v1\core\**`n

# Leave Application
**Product:** Scholar Core | **Module:** Timetable / Front Desk | **Frontend route:** `/front_desk/leave_application` | **v1 status:** Complete

| Field | Value |
|---|---|
| Backend routes | `GET front_desk/leave_application/create` (with `from_date`, `to_date` filters) |
| Roles | Admin, Class Teacher, Coordinator |
| Last updated | 2026-11-04 |
| Source commit | 8fe500dc (FE) / 86261072 (BE) |

## 1. Purpose & users
Report screen showing student leave requests submitted through the mobile app/parent portal, along with any replies and approval decisions. Used by class teachers and coordinators to review and track student absences.

## 2. Screens
**Leave application report** — `/front_desk/leave_application`
Filter bar: From date, To date (both optional). Table: Student name, Standard/Division, Mobile, Apply date, From date, To date, Title, Message, Reply, Status.

![](./screenshots/leave-application.png)

## 3. Features & business rules

| Column | Notes |
|---|---|
| Student name | Requesting student |
| Standard/Division | Class |
| Mobile | Parent contact |
| Apply date | When the request was submitted |
| From date / To date | Leave period |
| Title | Short reason |
| Message | Full leave reason from parent |
| Reply | Staff response |
| Status | Approval status (TBD values) |

- Filters `from_date` and `to_date` are optional (unlike parent communication where they are required).
- Read-only report — approval/reply actions are done in the mobile app or portal.

**Permissions:** Admin, class teacher, coordinator.

## 4. User flows

**Review leave requests:**
1. Enter optional date range → load.
2. Review requests, see replies and statuses.

## 5. Data model
Table: TBD (student leave table — expected columns: `student_name`, `std_div`, `mobile`, `apply_date`, `from_date`, `to_date`, `title`, `message`, `reply`, `status`, `sub_institute_id`).

## 6. APIs

| Method | Endpoint | Auth | Request | Response |
|---|---|---|---|---|
| GET | `front_desk/leave_application/create` | Session | `from_date` (optional), `to_date` (optional), session params | `{ data: [ leave rows ] }` |

## 7. UI components & design tokens
`ModuleWorkbench` with `reportModules.leave`. Report mode; filters optional.

## 8. Reports & exports
Print only.

## 9. Test cases

| ID | Scenario | Steps | Expected result | Type |
|---|---|---|---|---|
| LA01 | Load all requests | No date filter; submit | All requests shown | Happy |
| LA02 | Filter by date | Enter from/to dates | Only matching requests shown | Happy |
| LA03 | No requests | Date range with no leaves | Empty table | Edge |

## 10. Known issues, limitations & FAQs
- Approval/reject action is not available from the web ERP in v1 — only from the mobile app.
- No export.

## 11. Sales notes
- Centralised leave register replaces manual SMS/verbal communication.
- Demo: show submitted leave request with status and reply.

## 12. v1 status & v2 ideas
- v1: Read-only report complete.
- v2: Approve/reject from web ERP; email/push notification to parent on decision; leave balance deduction.

## Source files
- `C:\rajesh\lms_k12\app\front_desk\leave_application\page.tsx`
- `C:\rajesh\lms_k12\app\front_desk\_lib\reports.ts` (leave entry)

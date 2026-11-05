# Parent Communication
**Product:** Scholar Core | **Module:** Timetable / Front Desk | **Frontend route:** `/front_desk/parent_communication` | **v1 status:** Complete

| Field | Value |
|---|---|
| Backend routes | `GET front_desk/parent_communication/create` (report endpoint, with date filters) |
| Roles | Admin, Class Teacher, Coordinator |
| Last updated | 2026-11-04 |
| Source commit | 8fe500dc (FE) / 86261072 (BE) |

## 1. Purpose & users
Report screen showing parent messages sent through the mobile app along with the replies recorded by school staff. Used by coordinators and class teachers to monitor parent-school communication.

## 2. Screens
**Parent communication report** — `/front_desk/parent_communication`
Filter bar: From date, To date. Table columns: Student name, Standard/Division, Mobile, Date, Title, Message, Reply, Reply by, Reply on.

Also has an AI Stack sub-page at `/front_desk/parent_communication/ai-stack`.

![](./screenshots/parent-communication.png)

## 3. Features & business rules
- Read-only report; no submission from this screen.
- Filters: `from_date` (required), `to_date` (required).
- Both dates are required to load the report.
- Results include: original parent message and any staff reply.
- Messages originate from the mobile app parent portal.

**Permissions:** Read access for admin, class teacher, coordinator.

## 4. User flows

**Review parent messages:**
1. Enter From date and To date.
2. Report loads — all parent messages in that period.
3. See reply column — empty if not yet replied to.

## 5. Data model
Table: TBD (parent communication table, expected columns: `student_name`, `std_div`, `mobile`, `date_`, `title`, `message`, `reply`, `reply_by_name`, `reply_on`, `sub_institute_id`).

## 6. APIs

| Method | Endpoint | Auth | Request | Response |
|---|---|---|---|---|
| GET | `front_desk/parent_communication/create` | Session | `from_date`, `to_date`, `sub_institute_id`, `syear` | `{ data: [ communication rows ] }` |

## 7. UI components & design tokens
`ModuleWorkbench` with `reportModules.parentCommunication`. Report mode: `report: true`. No submit form — filter-only.

## 8. Reports & exports
Print only (no Excel/PDF export).

## 9. Test cases

| ID | Scenario | Steps | Expected result | Type |
|---|---|---|---|---|
| PC01 | Load messages | Enter date range; submit | Messages in that period shown | Happy |
| PC02 | No messages | Date range with no activity | Empty table | Edge |
| PC03 | Missing date | Submit without To date | Validation error (required) | Negative |

## 10. Known issues, limitations & FAQs
- No reply action from this screen — replies must be done in the mobile app or parent portal backend.
- No export to Excel.
- **FAQ:** "No messages showing" — parents must use the mobile app to send messages; they don't appear from SMS/WhatsApp.

## 11. Sales notes
- Full audit trail of parent-school communication.
- Demo: show messages with replies alongside.

## 12. v1 status & v2 ideas
- v1: Read-only report complete.
- v2: Reply directly from web portal; export to Excel; push notification to parent when staff replies.

## Source files
- `C:\rajesh\lms_k12\app\front_desk\parent_communication\page.tsx`
- `C:\rajesh\lms_k12\app\front_desk\_lib\reports.ts` (parentCommunication entry)

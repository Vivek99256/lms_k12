# PTM (Parent-Teacher Meeting)
**Product:** Scholar Core | **Module:** Admin Services | **Frontend route:** `/admin-services/ptm-time-slot-master`, `/admin-services/ptm-attended-status`, `/admin-services/ptm-report` | **v1 status:** Complete

| Field | Value |
|---|---|
| Backend routes | PTM API routes (via `_lib/ptm.ts`: `api/ptm-time-slots`, `api/ptm-booking`) |
| Roles | Admin, Class Teacher |
| Last updated | 2026-11-04 |
| Source commit | 8fe500dc (FE) / 86261072 (BE) |

## 1. Purpose & users
Manages PTM scheduling: staff create time slots for a class, parents book slots via the app, staff mark attendance at the meeting.

## 2. Screens

### PTM Time Slot Master (`/admin-services/ptm-time-slot-master`)
Class filter + slot creation form. Staff add multiple from-time/to-time rows per PTM date, then bulk-save. Existing slots listed in `RecordTable` with edit/delete.

### PTM Attended Status (`/admin-services/ptm-attended-status`)
Mark which parents actually attended their booked slot.

### PTM Report (`/admin-services/ptm-report`)
Report of bookings, attended count, and no-shows.

## 3. Features & business rules

**Time Slot form:**
| Field | Type | Required | Validation | Default |
|---|---|---|---|---|
| Standard / Division | ClassFilters | Yes | — | — |
| PTM title | Text | Yes | — | — |
| PTM date | Date | Yes | — | Today |
| From time / To time rows | Time pairs | Yes (at least one) | From < To | — |

Multiple slot rows can be added for a single PTM date (e.g., 9:00–9:15, 9:15–9:30).

## 4. User flows

1. Create slots: select class → set date, title → add time rows → save.
2. Parents book a slot via mobile app.
3. On PTM day: open Attended Status → mark attended.
4. Run PTM Report.

## 5. Data model

| Table | Key columns | Notes |
|---|---|---|
| `ptm_time_slots_master` | id, sub_institute_id, standard_id, division_id, title, ptm_date, from_time, to_time, created_by | Time slot definitions |
| `ptm_booking_master` | id, sub_institute_id, slot_id, student_id, booked_by, booking_time, attended | Parent bookings |

## 6. APIs

| Method | Endpoint | Auth | Request | Response |
|---|---|---|---|---|
| GET | `api/ptm-time-slots` | JWT | standardId, divisionId | slot list |
| POST | `api/ptm-time-slots` | JWT | `{ standardId, divisionId, title, ptmDate, slots[{fromTime,toTime}] }` | `{ success, message }` |
| POST | `api/ptm-time-slots/{id}` | JWT | updated slot | `{ success, message }` |
| POST | `api/ptm-time-slots/{id}/delete` | JWT | — | `{ success, message }` |

## 7. UI components & design tokens
- `ClassFilters`, `RecordTable`, `ErpPageHeader`, `ErpSection`
- Lucide: `CalendarClock`, `Plus`, `Save`, `Trash2`, `X`

## 8. Reports & exports
- `/admin-services/ptm-report`

## 9. Test cases

| ID | Scenario | Steps | Expected result | Type |
|---|---|---|---|---|
| TC-PTM-01 | Create slots for Std 8-A | Fill form, add 5 slots, save | 5 slots saved | Happy |
| TC-PTM-02 | Add slot with from > to | Enter invalid time | Validation error | Negative |
| TC-PTM-03 | Mark parent attended | Open attended status, mark | Booking updated | Happy |

## 10. Known issues, limitations & FAQs
- Parent booking is via mobile app; web portal booking not available in v1.
- **FAQ:** Can two parents book the same slot? TBD — slot capacity management not visible in FE code.

## 11. Sales notes
- Eliminates phone/manual PTM booking; parents self-schedule.
- Shows attendance rate in report.

## 12. v1 status & v2 ideas
- **Complete:** Slot creation, booking (mobile), attendance, report.
- **v2 ideas:** Slot capacity limits, teacher-wise slots, SMS reminders.

## Source files
- `C:\rajesh\lms_k12\app\admin-services\ptm-time-slot-master\page.tsx`
- `C:\rajesh\lms_k12\app\admin-services\_lib\ptm.ts`
- `F:\xampp\htdocs\next_lms_erp\database\migrations\2023_03_05_115658_create_ptm_booking_master_table.php`
- `F:\xampp\htdocs\next_lms_erp\database\migrations\2023_03_05_115658_create_ptm_time_slots_master_table.php`

# Visitor Management
**Product:** Scholar Core | **Module:** Admin Services | **Frontend route:** `/admin-services/add-visitor`, `/admin-services/visitor`, `/admin-services/visitor-report` | **v1 status:** Complete

| Field | Value |
|---|---|
| Backend routes | `POST visitor_management/add_visitor_master` (store), `PUT .../add_visitor_master/{id}` (update), `DELETE .../add_visitor_master/{id}`, `POST get_adminVisitorListAPI` (list), `POST api/admin-services/visitor/checkout/{id}` |
| Roles | Admin, Receptionist, Security |
| Last updated | 2026-11-04 |
| Source commit | 8fe500dc (FE) / 86261072 (BE) |

## 1. Purpose & users
Tracks all visitors entering the school premises. Receptionists log visitor entry and exit in real time. The screen shows today's visitor register and allows add, edit, delete, and check-out.

## 2. Screens

### Add Visitor (`/admin-services/add-visitor`)
Form + today's register table. Left panel: add/edit form. Right panel: `RecordTable` showing today's visitors with in-time, out-time, still-inside indicator.

**Check-out:** Clicking a visitor row (or a check-out button) records out-time.

### Visitor Report (`/admin-services/visitor-report`)
Date-range filtered report of all visits.

## 3. Features & business rules

| Field | Type | Required | Validation | Default |
|---|---|---|---|---|
| Appointment type | Radio | Yes | Direct / Prior / Pick-up student | Direct |
| Visitor type | Dropdown | Yes | From `visitor_type` table | — |
| Name | Text | Yes | — | — |
| Contact | Text | No | — | — |
| Email | Text | No | — | — |
| Coming from | Text | No | — | — |
| To meet | Dropdown (staff or student) | No | — | — |
| Relation | Text | No | — | — |
| Purpose | Text | No | — | — |
| Visitor ID card | Text | No | — | — |
| Photo | File | No | MAX_UPLOAD_BYTES | — |
| Meet date | Date | Yes | — | Today |
| In time | Time | Yes | — | Now |

**Pick-up student:** Appointment type "pickUp" triggers an OTP flow (details in visitor_management controller).

**`visitorTypeSourceMissing` flag:** Set when `GET visitor_management/add_visitor_master/create` fails (PHP 8 fatal on stdClass array access). The form falls back to a free-text visitor type field in that case.

## 4. User flows

**Check-in:**
1. Open Add Visitor.
2. Select appointment type, visitor type, fill name + purpose.
3. Click "Save" — visitor appears in today's register with in-time.

**Check-out:**
1. Find visitor row.
2. Click check-out action — out-time recorded; `stillInside` flag cleared.

**Pick-up:**
1. Select "Pick-up student", choose student.
2. OTP sent to parent. TBD — full OTP flow in controller.

## 5. Data model

| Table | Key columns | Notes |
|---|---|---|
| `visitor_master` | id, sub_institute_id, appointment_type, visitor_type, name, contact, email, coming_from, to_meet, relation, purpose, visitor_idcard, photo, meet_date, in_time, out_time, exit_msg_sent | Main visitor log |
| `visitor_type` | id, sub_institute_id, name | Visitor type master (parent, vendor, etc.) |
| `visitor_master_settings` | id, sub_institute_id, settings | Per-institute settings |

## 6. APIs

| Method | Endpoint | Auth | Request | Response |
|---|---|---|---|---|
| POST | `get_adminVisitorListAPI` | JWT | from_date, to_date | visitor list |
| POST | `visitor_management/add_visitor_master` | JWT (web) | visitor form fields | `{ success, message }` |
| PUT | `visitor_management/add_visitor_master/{id}` | JWT (web) | updated fields | `{ success, message }` |
| DELETE | `visitor_management/add_visitor_master/{id}` | JWT (web) | — | `{ success, message }` |
| POST | `get_adminStudentList` | JWT | — | student list for "to meet" |
| POST | `get_adminTeacherList` | JWT | — | staff list fallback |
| GET | `api/user-reports/bootstrap` | JWT | — | staff list (primary) |

## 7. UI components & design tokens
- `ErpPageHeader`, `ErpSection`, `ErpLoading`, `ErpAlert` (design system)
- `RecordTable` — sortable record list
- `erpInputClass`, `erpSelectClass` — standard input/select styles
- Lucide: `UserPlus`, `LogOut`, `Save`, `Trash2`

## 8. Reports & exports
- `/admin-services/visitor-report` — full visitor log with date filter, Excel export (TBD)

## 9. Test cases

| ID | Scenario | Steps | Expected result | Type |
|---|---|---|---|---|
| TC-VIS-01 | Add direct visitor | Fill form, save | Appears in today's register | Happy |
| TC-VIS-02 | Check out visitor | Click check-out | Out-time recorded | Happy |
| TC-VIS-03 | Add visitor with photo | Attach photo, save | Photo stored and displayed | Happy |
| TC-VIS-04 | Pick-up student — OTP | Select pick-up, choose student | OTP sent to parent | Happy |
| TC-VIS-05 | Visitor type list unavailable | visitorTypeSourceMissing = true | Free-text fallback shown | Edge |

## 10. Known issues, limitations & FAQs
- `GET visitor_management/add_visitor_master/create` is broken on PHP 8 (stdClass array access fatal). The frontend handles this with `visitorTypeSourceMissing` flag and shows a free-text fallback.
- Write routes still use the Blade/web controller (not a JWT-stateless API), which may cause issues in multi-instance deploys.
- **FAQ:** Can visitors self-register on a kiosk? Not in v1.

## 11. Sales notes
- Replaces paper visitor register; instant searchable digital log.
- Demo: add a visitor → show register → check out → show report.
- Differentiator: pick-up OTP flow for student safety.

## 12. v1 status & v2 ideas
- **Complete:** Add, edit, delete, check-out, report.
- **Partial:** OTP pick-up flow (controller exists, FE references it but full flow TBD).
- **v2 ideas:** Visitor ID badge print, recurring visitor fast-entry, QR code check-in.

## Source files
- `C:\rajesh\lms_k12\app\admin-services\add-visitor\page.tsx`
- `C:\rajesh\lms_k12\app\admin-services\_lib\visitor.ts`
- `F:\xampp\htdocs\next_lms_erp\database\migrations\2023_03_05_115658_create_visitor_master_table.php`
- `F:\xampp\htdocs\next_lms_erp\database\migrations\2023_03_05_115658_create_visitor_type_table.php`

# Hostel Visitor Management
**Product:** Scholar Core | **Module:** Hostel | **Frontend route:** `/hostel/visitor-details` | **v1 status:** Complete

| Field | Value |
|---|---|
| Backend routes | Blade: `hostel_management/hostel_visitor_master` |
| Roles | Hostel Admin, Receptionist, Super Admin |
| Last updated | 2026-11-04 |
| Source commit | 8fe500dc (FE) / 86261072 (BE) |

## 1. Purpose & users
Records visitors who come to the hostel to meet residents. Hostel Admin or receptionist logs entry/exit details for every visitor. Used for security and compliance. Visitor reports are generated for administration review.

## 2. Screens

**Visitor Log List** (`/hostel/visitor-details`)
Displays all visitor entries: name, contact, coming from, meeting, relation, date, in-time, out-time.

**Visitor Report** (`/hostel/visitor-report`)
Filtered view for reporting purposes.

**Add Visitor** (form / modal)
Quick entry form for new visitor.

![](./screenshots/hostel-visitor-list.png)

## 3. Features & business rules

| Field | Type | Required | Validation | Default |
|---|---|---|---|---|
| name | varchar(255) | Yes | — | — |
| contact | varchar(255) | Yes | — | — |
| email | varchar(255) | Yes | — | — |
| coming_from | varchar(255) | Yes | — | — |
| to_meet | varchar(255) | No | Resident name | — |
| relation | varchar(255) | Yes | e.g. Parent, Sibling | — |
| meet_date | varchar(255) | Yes | Date of visit | — |
| in_time | varchar(255) | Yes | — | — |
| out_time | varchar(255) | Yes | — | — |
| sub_institute_id | int | System | From session | Session |

- `meet_date`, `in_time`, `out_time` are stored as varchar — no time-delta calculation available without parsing.
- No link to `hostel_room_allocation` — visitor is not tied to a specific room/student record at DB level.

**Permissions:** View, Add via RBAC.

## 4. User flows

**Log a visitor:**
1. Visitor arrives at hostel gate.
2. Receptionist opens Visitor Details.
3. Enters visitor name, contact, email, coming from, relation, whom to meet, date, in-time.
4. Save — entry appears in log.
5. On exit, update out-time.

## 5. Data model

**hostel_visitor_master**
| Column | Type | Notes |
|---|---|---|
| id | bigint PK | — |
| sub_institute_id | int | Tenant |
| name | varchar(255) | Visitor name |
| contact | varchar(255) | Phone |
| email | varchar(255) | Email |
| coming_from | varchar(255) | City/place |
| to_meet | varchar(255) | Resident name (free text) |
| relation | varchar(255) | Relationship to resident |
| meet_date | varchar(255) | Date of visit |
| in_time | varchar(255) | Entry time |
| out_time | varchar(255) | Exit time |
| created_at / updated_at | timestamp | — |

## 6. APIs

| Method | Endpoint | Auth | Notes |
|---|---|---|---|
| Blade | `hostel_management/hostel_visitor_master` | Session | CRUD |
| Blade | `hostel_management/hostel_visitor_report` | Session | Report view |

## 7. UI components & design tokens
- Data table with date filter
- Inline edit for out_time
- Design tokens: `--surface-*`, `--content-*`

## 8. Reports & exports
See [hostel-reports.md](hostel-reports.md) — Visitor Report.

## 9. Test cases

| ID | Scenario | Steps | Expected result | Type |
|---|---|---|---|---|
| HV-001 | Log a visitor with all fields | Fill all required fields, save | Record appears in log | Happy |
| HV-002 | Log visitor without email | Leave email blank | Validation error (required in schema) | Negative |
| HV-003 | Filter visitor log by date | Set date filter | Only that day's visitors shown | Happy |
| HV-004 | Update out_time after entry | Edit existing record, set out_time | Record updated | Happy |

## 10. Known issues, limitations & FAQs
- `meet_date`, `in_time`, `out_time` stored as `varchar` — no date-time sorting or duration calculation.
- No foreign key to resident student — `to_meet` is free text, no auto-suggest.
- **FAQ:** Can visitors be tracked per hostel? Not directly — no `hostel_id` column in visitor table.

## 11. Sales notes
- **Selling point:** Digital visitor register replaces paper logbooks; instant report generation for security audit.
- **Demo flow:** (1) Log a visitor. (2) Set out time on exit. (3) Pull visitor report for the day.
- **Plan/pricing:** TBD

## 12. v1 status & v2 ideas
- v1: Visitor log and report complete.
- **v2:** Store `meet_date`/`in_time`/`out_time` as proper datetime; link visitor to `hostel_room_allocation` (resident lookup); add hostel_id FK; add photo capture for visitor.

## Source files
- Frontend: `C:\rajesh\lms_k12\app\hostel\visitor-details\page.tsx`, `C:\rajesh\lms_k12\app\hostel\visitor-report\page.tsx`
- Controllers: `F:\xampp\htdocs\next_lms_erp\app\Http\Controllers\hostel_management\hostel_visitor_masterController.php`, `hostel_visitor_reportController.php`
- Migration: `F:\xampp\htdocs\next_lms_erp\database\migrations\2023_03_05_115658_create_hostel_visitor_master_table.php`

# Student Transport Mapping
**Product:** Scholar Core | **Module:** Transportation | **Frontend route:** `/Transportation/student_transport_mapping` | **v1 status:** Complete

| Field | Value |
|---|---|
| Backend routes | `POST transportation-setup/student-mappings/bulk`, `POST transportation-setup/student-mappings/bulk-delete`, `GET/POST/PUT/DELETE transportation-setup/{module}` |
| Roles | Transport Admin, Super Admin |
| Last updated | 2026-11-04 |
| Source commit | 8fe500dc (FE) / 86261072 (BE) |

## 1. Purpose & users
Maps students to their pickup and drop routes, buses, and stops for each academic year. Also supports a start/end date per mapping (added in 2026 migration) for mid-year changes. Transport Admin uses this after routes and vehicles are configured.

## 2. Screens

**Student Transport Mapping** (`/Transportation/student_transport_mapping`)
Lists all student-transport assignments. Filter by route, bus, standard, division. Actions: Add, Edit, Delete, Bulk operations.

![](./screenshots/student-transport-mapping.png)

## 3. Features & business rules

**transport_map_student**
| Field | Type | Required | Notes |
|---|---|---|---|
| student_id | bigint FK | Yes | → tblstudent |
| from_shift_id | bigint | Yes | Morning shift |
| from_bus_id | bigint | Yes | Morning bus |
| from_stop | bigint | Yes | Morning pickup stop |
| to_shift_id | bigint | Yes | Afternoon shift |
| to_bus_id | bigint | Yes | Afternoon drop bus |
| to_stop | bigint | Yes | Afternoon drop stop |
| syear | bigint | Yes | Academic year |
| sub_institute_id | bigint | System | Tenant |
| start_date | date | No | Added 2026-08-17; mapping valid from date |
| end_date | date | No | Mapping valid until date |

- Supports separate from (pickup) and to (drop) bus/stop/shift — a student can have different morning and afternoon routes.
- Bulk store and bulk delete endpoints for processing multiple students at once.
- `start_date`/`end_date` allow mid-year transport changes without deleting old records.

**Permissions:** View, Add, Edit, Delete, Bulk via RBAC.

## 4. User flows

**Map a student:**
1. Open Student Transport Mapping.
2. Click Add.
3. Select student (search by name/admission no).
4. Select from_shift, from_bus, from_stop (morning pickup).
5. Select to_shift, to_bus, to_stop (afternoon drop).
6. Set academic year; optionally set start/end date.
7. Save.

**Bulk map students:**
1. Select multiple students (checkboxes).
2. Choose route/bus/stop.
3. Click Bulk Assign → POST to `transportation-setup/student-mappings/bulk`.

## 5. Data model

**transport_map_student** — see fields above.
Composite indexes:
- `(from_stop, to_stop)` — stop lookup
- `(from_bus_id, to_bus_id)` — bus lookup
- `(from_shift_id, to_shift_id)` — shift lookup

## 6. APIs

| Method | Endpoint | Auth | Notes |
|---|---|---|---|
| GET | `transportation-setup/{module}` | JWT | List mappings |
| POST | `transportation-setup/student-mappings/bulk` | JWT | Bulk create |
| POST | `transportation-setup/student-mappings/bulk-delete` | JWT | Bulk delete |
| POST | `transportation-dashboard/summary` | JWT | Dashboard counts |

## 7. UI components & design tokens
- Student search autocomplete
- Multi-select for bulk operations
- Cascading dropdowns (shift → bus → stop)
- Design tokens: `--action-primary`, `--surface-*`

## 8. Reports & exports
See [transport-reports.md](transport-reports.md) — Van-wise Report, Van Summary Report.

## 9. Test cases

| ID | Scenario | Steps | Expected result | Type |
|---|---|---|---|---|
| STM-001 | Map student to route | Select student, bus, stops, save | Mapping created | Happy |
| STM-002 | Map student twice same year | Repeat for same student, syear | TBD — no unique constraint on (student_id, syear) | Edge |
| STM-003 | Bulk map 50 students | Select 50, bulk assign | All 50 mapped | Happy |
| STM-004 | Delete mapping with active transport | Delete mid-year | Record deleted; no soft-delete | Edge |
| STM-005 | Map with start/end dates | Set start = today, end = 3 months | Mapping stored with dates | Happy |

## 10. Known issues, limitations & FAQs
- No unique constraint on `(student_id, syear)` — same student can be mapped twice.
- No fee auto-calculation on mapping (transport fees are managed in Fees module separately).
- **FAQ:** Can a student travel on different buses morning and afternoon? Yes — `from_*` and `to_*` are independent.

## 11. Sales notes
- **Selling point:** Separate morning and afternoon routes per student; bulk mapping for large institutes; date-range based changes.
- **Demo flow:** (1) Show route with stops. (2) Map 5 students in bulk. (3) Pull van-wise report to see students per bus.
- **Plan/pricing:** TBD

## 12. v1 status & v2 ideas
- v1: Mapping CRUD + bulk operations complete. Start/end date added in 2026.
- **v2:** Unique constraint on student+year; transport fee auto-link on mapping; parent notification on route change; live tracking per stop.

## Source files
- Frontend: `C:\rajesh\lms_k12\app\Transportation\student_transport_mapping\page.tsx`
- API: `F:\xampp\htdocs\next_lms_erp\routes\api.php` lines 504-509
- Migrations: `F:\xampp\htdocs\next_lms_erp\database\migrations\2023_03_05_115658_create_transport_map_student_table.php`, `2026_08_17_140000_add_start_end_date_to_transport_map_student_table.php`

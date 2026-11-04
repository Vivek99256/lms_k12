# Room Allocation
**Product:** Scholar Core | **Module:** Hostel | **Frontend route:** `/hostel/hostel-room-allocation` | **v1 status:** Complete

| Field | Value |
|---|---|
| Backend routes | Blade: `hostel_management/hostel_room_allocation` |
| Roles | Hostel Admin, Super Admin |
| Last updated | 2026-11-04 |
| Source commit | 8fe500dc (FE) / 86261072 (BE) |

## 1. Purpose & users
Allocates students (or staff) to specific hostel rooms for a given academic year and term. Hostel Admins use this at the start of each academic year or when a student joins mid-year. Also handles reassignment when students change rooms.

## 2. Screens

**Room Allocation List** (`/hostel/hostel-room-allocation`)
Shows existing allocations grouped by hostel/room. Filter by hostel, building, floor, room.

**Allocate Room** (form)
Select student, hostel, room, bed number, locker, table, bedsheet; set academic year and term.

![](./screenshots/room-allocation.png)

## 3. Features & business rules

| Field | Type | Required | Validation | Default |
|---|---|---|---|---|
| user_id | int FK → tblstudent/tbluser | Yes | Must exist | — |
| user_group_id | int | Yes | Role group | — |
| admission_category_id | int FK | No | → admission_category_master | — |
| hostel_id | int FK | Yes | → hostel_master | — |
| room_id | int FK | Yes | → hostel_room_master | — |
| bed_no | varchar(100) | No | — | — |
| locker_no | varchar(100) | No | — | — |
| table_no | varchar(100) | No | — | — |
| bedsheet_no | varchar(100) | No | — | — |
| term_id | int | No | — | — |
| syear | int | No | Academic year | — |
| sub_institute_id | int | System | From session | Session |

- No unique constraint on `(room_id, bed_no)` in migration — duplicate bed allocation not prevented at DB level.
- Academic year (`syear`) scopes the allocation so previous-year records are preserved.

**Permissions:** View, Add, Edit, Delete via RBAC menu rights.

## 4. User flows

**Allocate a student to a room:**
1. Open Room Allocation.
2. Click Allocate.
3. Select student from dropdown (filtered by user profile / admission category).
4. Select hostel → building → floor → room (cascading dropdowns).
5. Enter bed, locker, table, bedsheet numbers (optional).
6. Select academic year and term.
7. Save.

**Vacate a room:**
1. Find the allocation row.
2. Delete or update (depends on implementation — TBD from controller).

## 5. Data model

**hostel_room_allocation**
| Column | Type | Notes |
|---|---|---|
| id | bigint PK | — |
| user_id | int | Student or staff user ID |
| user_group_id | int | Role group |
| admission_category_id | int | Hostel admission category |
| hostel_id | int | FK → hostel_master |
| room_id | int | FK → hostel_room_master |
| bed_no | varchar(100) | Optional |
| locker_no | varchar(100) | Optional |
| table_no | varchar(100) | Optional |
| bedsheet_no | varchar(100) | Optional |
| term_id | int | Academic term |
| syear | int | Academic year |
| sub_institute_id | int | Tenant |
| created_on | timestamp | — |

**admission_category_master** (hostel-specific, different from admissions module)
Referenced by `admission_category_masterController` and `admission_category_masterModel` under hostel_management.

## 6. APIs

| Method | Endpoint | Auth | Notes |
|---|---|---|---|
| Blade | `hostel_management/hostel_room_allocation` (index) | Session | List allocations |
| Blade | `hostel_management/hostel_room_allocation` (store) | Session | Create allocation |

## 7. UI components & design tokens
- Cascading select dropdowns (Hostel → Building → Floor → Room)
- Student search / autocomplete
- Data table with filter
- Design tokens: `--surface-*`, `--action-primary`

## 8. Reports & exports
See [hostel-reports.md](hostel-reports.md) — Room Allocation Report.

## 9. Test cases

| ID | Scenario | Steps | Expected result | Type |
|---|---|---|---|---|
| RA-001 | Allocate student to room | Select student, hostel, room, save | Allocation record created | Happy |
| RA-002 | Allocate same student twice same year | Repeat allocation for same syear | TBD — no unique constraint found | Edge |
| RA-003 | Allocate without hostel selection | Submit without hostel | Validation error | Negative |
| RA-004 | Filter by hostel | Select hostel in filter | Only that hostel's allocations shown | Happy |
| RA-005 | Allocate staff to hostel | Use staff user_id | Should work if user_group_id supports it | Edge |

## 10. Known issues, limitations & FAQs
- No DB-level uniqueness on bed number — same bed can be allocated to two students.
- No occupancy capacity check on `hostel_room_master` (no capacity column in migration).
- **FAQ:** Can a student be in two hostels at once? Not prevented by DB constraints.

## 11. Sales notes
- **Selling point:** Tracks bed, locker, table, and bedsheet numbers per student — useful for boarding schools with strict asset management.
- **Demo flow:** (1) Show hostel hierarchy. (2) Allocate a student. (3) Show room allocation report with bed numbers.
- **Plan/pricing:** TBD

## 12. v1 status & v2 ideas
- v1: Allocation CRUD complete.
- **v2:** Add room capacity enforcement; unique constraint on (room, bed, syear); bulk allocation via import; room-change history log; hostel fee auto-link on allocation.

## Source files
- Frontend: `C:\rajesh\lms_k12\app\hostel\hostel-room-allocation\page.tsx`
- Controller: `F:\xampp\htdocs\next_lms_erp\app\Http\Controllers\hostel_management\tblhostelRoomAllocationController.php`
- Migration: `F:\xampp\htdocs\next_lms_erp\database\migrations\2023_03_05_115658_create_hostel_room_allocation_table.php`

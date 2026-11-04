# Hostel Master
**Product:** Scholar Core | **Module:** Hostel | **Frontend route:** `/hostel/hostel-master` | **v1 status:** Complete

| Field | Value |
|---|---|
| Backend routes | `GET/POST/PUT/DELETE hostel_management/*` (Blade-driven; API: `POST hostel-dashboard/summary`) |
| Roles | Hostel Admin, Super Admin |
| Last updated | 2026-11-04 |
| Source commit | 8fe500dc (FE) / 86261072 (BE) |

## 1. Purpose & users
Hostel Master is the top-level setup screen for hostel management. It lets Hostel Admins create and maintain hostel records (name, type, warden details) before buildings, floors, rooms, and allocations can be configured. Used once at institute setup and updated when a new hostel is added or warden changes.

## 2. Screens

**Hostel Master List** (`/hostel/hostel-master`)
Shows all hostels for the institute: hostel name, type, description, warden name, warden contact. Actions: Add, Edit, Delete.

**Add / Edit Hostel** (modal or inline)
Form to create or update a hostel record.

![](./screenshots/hostel-master-list.png)

## 3. Features & business rules

| Field | Type | Required | Validation | Default |
|---|---|---|---|---|
| hostel_type_id | FK → hostel_type_master | Yes | Must exist | — |
| code | varchar(255) | Yes | Unique per institute | — |
| name | varchar(255) | Yes | — | — |
| description | varchar(255) | No | — | — |
| warden | varchar(255) | Yes | — | — |
| warden_contact | varchar(255) | Yes | — | — |
| sub_institute_id | int | System | Injected from session | Session value |

- Supports custom fields via `tblcustomfieldsModel` (table_name = `hostel_master`).
- Filtered by `sub_institute_id` from session — multi-tenant safe.
- Hostel type must be created in Type Master before a hostel can be added.

**Permissions:** View, Add, Edit, Delete controlled by `tblgroupwise_rights` / `tblindividual_rights` for the hostel-master menu link.

## 4. User flows

**Add hostel (happy path):**
1. Go to Hostel Master.
2. Click "Add Hostel".
3. Select hostel type, enter code, name, description, warden name and contact.
4. Save — record appears in the list.

**Edit hostel:**
1. Click edit icon on a row.
2. Update fields, save.

**Delete hostel:**
1. Click delete icon — confirmation prompt.
2. Confirm — record removed (hard delete; no soft-delete found in migration).

## 5. Data model

**hostel_master**
| Column | Type | Notes |
|---|---|---|
| id | bigint PK | Auto-increment |
| sub_institute_id | int | Tenant scope |
| hostel_type_id | int FK | → hostel_type_master.id |
| code | varchar(255) | Unique identifier |
| name | varchar(255) | Display name |
| description | varchar(255) | — |
| warden | varchar(255) | Warden full name |
| warden_contact | varchar(255) | Phone number |
| created_at / updated_at | timestamp | — |

**hostel_type_master**
| Column | Type | Notes |
|---|---|---|
| id | bigint PK | — |
| sub_institute_id | int | Tenant scope |
| hostel_type | varchar(255) | e.g. Boys, Girls, Mixed |
| status | varchar(255) | Active / Inactive |
| description | varchar(255) | — |

**hostel_building_master** (child of hostel_master)
| Column | Type | Notes |
|---|---|---|
| id | bigint PK | — |
| hostel_type_id | int FK | — |
| hostel_id | int FK | → hostel_master.id |
| building_name | varchar(255) | — |

**hostel_floor_master** (child of building)
| Column | Type | Notes |
|---|---|---|
| building_id | int FK | → hostel_building_master.id |
| floor_name | varchar(255) | — |

**hostel_room_master** (child of floor)
| Column | Type | Notes |
|---|---|---|
| floor_id | int FK | → hostel_floor_master.id |
| room_name | varchar(255) | — |

## 6. APIs

| Method | Endpoint | Auth | Notes |
|---|---|---|---|
| POST | `hostel-dashboard/summary` | JWT | Returns dashboard summary counts |
| GET/POST/PUT/DELETE | Blade routes via `hostel_management/*` controller | Session | CRUD for hostel master |

## 7. UI components & design tokens
- Standard ERP data table (list view)
- Modal form for add/edit
- Lucide icons for actions
- Design tokens: `--surface-*`, `--content-*`, `--border-*`

## 8. Reports & exports
See [hostel-reports.md](hostel-reports.md).

## 9. Test cases

| ID | Scenario | Steps | Expected result | Type |
|---|---|---|---|---|
| H-001 | Add hostel with all fields | Fill all required fields, save | Record appears in list | Happy |
| H-002 | Add hostel without hostel type | Leave type blank, save | Validation error | Negative |
| H-003 | Duplicate code | Enter existing code, save | Validation error | Negative |
| H-004 | Edit warden contact | Change warden_contact, save | Updated in list | Happy |
| H-005 | Delete hostel with existing rooms | Try to delete | TBD — no FK cascade guard found in migration | Edge |

## 10. Known issues, limitations & FAQs
- No soft delete — hostel records are hard-deleted. Deleting a hostel with active allocations may orphan `hostel_room_allocation` records.
- `hostel_room_master` has only `floor_id` and `room_name` — no capacity, room type, or gender field. Room-level capacity must be inferred from allocations.
- **FAQ:** Can one hostel have multiple buildings? Yes — via hostel_building_master.

## 11. Sales notes
- **Selling point:** Full hierarchy — Hostel → Type → Building → Floor → Room → Bed, Locker, Table, Bedsheet number.
- **Demo flow:** (1) Create hostel type (Boys). (2) Create hostel record. (3) Add building. (4) Add floor. (5) Add rooms. (6) Show allocation screen auto-populating the hierarchy.
- **Plan/pricing:** TBD

## 12. v1 status & v2 ideas
- v1: Hostel master CRUD complete. Building, floor, room hierarchy complete.
- **v2:** Add room capacity field; add gender restriction per hostel; add soft delete with allocation check; add hostel fee integration.

## Source files
- Frontend: `C:\rajesh\lms_k12\app\hostel\hostel-master\page.tsx`
- Backend controller: `F:\xampp\htdocs\next_lms_erp\app\Http\Controllers\hostel_management\hostel_masterController.php`
- Migrations: `F:\xampp\htdocs\next_lms_erp\database\migrations\2023_03_05_115658_create_hostel_master_table.php`, `..._hostel_type_master_table.php`, `..._hostel_building_master_table.php`, `..._hostel_floor_master_table.php`, `..._hostel_room_master_table.php`

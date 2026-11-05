# Create Batch
**Product:** Scholar Core | **Module:** Academic Setup | **Frontend route:** `/academic_setup/create_batch` | **v1 status:** Complete

| Field | Value |
|---|---|
| Backend routes | `GET /academic-setup/batches`, `POST /academic-setup/batches`, `PUT /academic-setup/batches/{id}`, `DELETE /academic-setup/batches/{id}` |
| Roles | Admin, Academic Coordinator |
| Last updated | 2026-11-04 |
| Source commit | 8fe500dc (FE) / 86261072 (BE) |

## 1. Purpose & users
Batches divide a standard-division combination into smaller instructional groups (e.g. for science lab rotations or elective subjects). Academic administrators create and manage batches at the start of each academic year. Each batch is scoped to one standard + division + academic year.

## 2. Screens
**Batch list screen** — `/academic_setup/create_batch`
Shows a table of all batches grouped by Standard / Division. Columns: Standard, Division, Batches (comma-joined titles). Actions: add new, edit, delete.

![](./screenshots/batch-list.png)

**Add / edit form (inline panel)**
Opens when "Add" is clicked. Fields: Standard (dropdown), Division (dropdown, dependent on Standard), Batch name (text).

## 3. Features & business rules

| Field | Type | Required | Validation | Default |
|---|---|---|---|---|
| Standard | Select (from `standard` table) | Yes | Must be active | — |
| Division | Select (from `division` table, filtered by standard) | Yes | Must belong to selected standard | — |
| Batch name | Text | Yes | Duplicate check: same name + standard + division + syear rejected | — |

- Division dropdown is dependent on Standard selection (cascading).
- Duplicate batch (same title + standard + division + academic year) is blocked server-side — returns `status_code: 0`.
- Batches are scoped to `sub_institute_id` and `syear` (academic year from session).
- A `rollover_id` column is set when batches are copied during year rollover.

**Permissions:** View, Create, Edit, Delete — controlled by `tblgroupwise_rights` / `tblindividual_rights` for the menu link `academic_setup.batches`.

## 4. User flows

**Happy path — create batch:**
1. Navigate to Academic Setup → Create batch.
2. Select Standard → Division populates.
3. Select Division → enter Batch name.
4. Click "Add batch" → batch appears in list.

**Edit batch:**
1. Click edit icon on existing row → form pre-populates.
2. Change name → save.

**Delete batch:**
1. Click delete icon → confirmation → record removed.
2. Batches linked to timetable entries cannot be deleted (referential integrity check is implicit in timetable constraints).

## 5. Data model

**Table: `batch`**

| Column | Type | Notes |
|---|---|---|
| id | bigint PK | |
| title | varchar | Batch name |
| standard_id | int FK → `standard.id` | |
| division_id | int FK → `division.id` | |
| sub_institute_id | int | Tenant scope |
| syear | varchar | Academic year |
| rollover_id | int nullable | Source batch id from prior year rollover |
| marking_period_id | int nullable | Term scope (currently unused in batch logic) |
| created_at / updated_at | timestamp | |

**Related tables:** `standard`, `division`, `timetable` (references `batch.id` as `batch_id`).

## 6. APIs

| Method | Endpoint | Auth | Request body | Response |
|---|---|---|---|---|
| GET | `/api/academic-setup/batches` | JWT session | `sub_institute_id`, `syear` from session | `{ records, standards, divisions, … }` |
| POST | `/api/academic-setup/batches` | JWT session | `{ standard_id, division_id, title, sub_institute_id, syear }` | `{ status_code, message }` |
| PUT | `/api/academic-setup/batches/{id}` | JWT session | Same fields | `{ status_code, message }` |
| DELETE | `/api/academic-setup/batches/{id}` | JWT session | — | `{ status_code, message }` |

Error cases: duplicate batch → `status_code: 0`, "Batch already exists". Missing required field → validation error 400.

## 7. UI components & design tokens
- `AcademicSetupPage` shared component (`app/academic_setup/_components/AcademicSetupPage.tsx`) renders both the list table and the inline form for all Academic Setup screens.
- Uses `Card`, `Table`, `Input`, `Button`, `Label` from `components/ui/`.
- Icons: `Plus`, `Pencil`, `Trash2`, `Search`, `RefreshCw`, `X` from `lucide-react`.
- Design tokens: `--surface-*`, `--content-*`, `--border-*` from `styles.css`.

## 8. Reports & exports
No dedicated report for this menu. Batch data appears in timetable reports and student analysis. See [../timetable/create-timetable.md](../timetable/create-timetable.md).

## 9. Test cases

| ID | Scenario | Steps | Expected result | Type |
|---|---|---|---|---|
| B01 | Create valid batch | Select standard, division; enter unique name; save | Batch added; appears in list | Happy |
| B02 | Duplicate batch | Same standard, division, name, year | Error: "Batch already exists" | Negative |
| B03 | Missing standard | Submit without standard | Form blocks submission (required) | Negative |
| B04 | Division filters by standard | Select standard → check division list | Only divisions mapped to that standard shown | Edge |
| B05 | Edit batch name | Edit existing; change name; save | Updated name shown | Happy |
| B06 | Delete batch | Delete a batch not in timetable | Batch removed | Happy |

## 10. Known issues, limitations & FAQs
- `marking_period_id` is captured on `batch` but the controller code comments it out in queries — term-level batch isolation is not fully implemented in v1.
- No bulk import for batches.
- **FAQ:** "Why don't I see any divisions?" — Divisions must be mapped to the standard via Standard-Division Mapping first.

## 11. Sales notes
- Key selling point: batches enable split-class teaching (e.g. Science lab A/B groups) without needing separate divisions.
- Demo flow: (1) Create standard → (2) Create division → (3) Map them → (4) Create batch → (5) Assign batch in timetable.
- Pricing: included in Scholar Core base licence.

## 12. v1 status & v2 ideas
- v1: Complete. CRUD works; batch appears in timetable assignment.
- v2: Bulk batch creation; capacity limits per batch; term-level (marking period) batch isolation.

## Source files
- `C:\rajesh\lms_k12\app\academic_setup\create_batch\page.tsx`
- `C:\rajesh\lms_k12\app\academic_setup\_components\AcademicSetupPage.tsx`
- `C:\rajesh\lms_k12\app\academic_setup\api.ts`
- `F:\xampp\htdocs\next_lms_erp\app\Http\Controllers\school_setup\batchController.php`
- `F:\xampp\htdocs\next_lms_erp\app\Models\school_setup\batchModel.php`
- `F:\xampp\htdocs\next_lms_erp\routes\api.php` (lines 499–502: `academic-setup/{module}`)

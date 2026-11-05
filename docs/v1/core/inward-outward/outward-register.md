# Outward Register
**Product:** Scholar Core | **Module:** Inward/Outward | **Frontend route:** `/inward_outward/add_outward` | **v1 status:** Complete

| Field | Value |
|---|---|
| Backend routes | `GET /inward_outward/add_outward?type=API`, `POST /inward_outward/add_outward`, `PUT /inward_outward/add_outward/{id}`, `DELETE /inward_outward/add_outward/{id}` |
| Roles | Admin, Receptionist, Office Staff |
| Last updated | 2026-11-04 |
| Source commit | 8fe500dc (FE) / 86261072 (BE) |

## 1. Purpose & users
Tracks all documents, letters, and parcels sent out by the institute. Mirror of the Inward Register with `kind="outward"`. Used by front-office staff to maintain a dispatch log. "From place" label becomes "To place" for outward entries.

## 2. Screens

### Register screen — `/inward_outward/add_outward`
Same `RegisterPage` component as Inward, with `kind="outward"`. Behaviour is identical; labels swap:
- "From place" → "To place"
- "Inward date" → "Outward date"
- "Inward number" → "Outward number"

![](./screenshots/outward-register.png)

### Outward report — `/inward_outward/show_outward_report`
Filterable report view.

## 3. Features & business rules
Identical to Inward Register (see `inward-register.md`) with these differences:
- Backend table: `outward` (separate table, same schema as `inward`).
- Controller: `outwardController` (mirrors `inwardController`).
- Auto-number sequence is per-table, independent of inward numbers.
- Label "To place" replaces "From place".

### Entry form fields

| Field | Type | Required | Notes |
|---|---|---|---|
| To place | Select (place_master) | Yes | Destination |
| Outward date | Date | Yes | Defaults to today |
| Outward number | Text (read-only) | Yes | Auto-increment |
| Subject | Text (max 255) | Yes | — |
| Description | Textarea (max 255) | Yes | — |
| File name | Select (physical_file_location) | Yes | — |
| Upload image | File (image/*) | Yes on create | — |

## 4. User flows
Identical to Inward Register. See `inward-register.md` §4.

## 5. Data model

### Table: `outward`
Same schema as `inward` table. Key column difference: `outward_number` and `outward_date` instead of `inward_number` / `inward_date`.

| Column | Type | Notes |
|---|---|---|
| id | int PK | — |
| place_id | int FK | → `place_master.id` (destination) |
| file_location_id | int FK | → `physical_file_location.id` |
| outward_number | varchar | Sequential per institute+year |
| title | varchar(255) | Subject |
| description | varchar(255) | — |
| attachment | varchar | Stored file name |
| outward_date | date | — |
| sub_institute_id | int | Tenant |
| syear | varchar | Academic year |

## 6. APIs

| Method | Endpoint | Auth | Notes |
|---|---|---|---|
| GET | `/inward_outward/add_outward?type=API` | JWT | List all outward entries |
| POST | `/inward_outward/add_outward?type=API` | JWT | Create entry |
| PUT | `/inward_outward/add_outward/{id}` | JWT | Update entry |
| DELETE | `/inward_outward/add_outward/{id}` | JWT | Hard delete |

## 7. UI components & design tokens
Identical to Inward Register. Same `RegisterPage`, `shared.tsx` components.

## 8. Reports & exports
- Outward report: `/inward_outward/show_outward_report`

## 9. Test cases

| ID | Scenario | Steps | Expected result | Type |
|---|---|---|---|---|
| OW-01 | Create outward entry | Fill all fields, attach image | Entry saved, number auto-assigned | Happy |
| OW-02 | Verify label shows "To place" | Open form | "To place" label shown (not "From place") | Edge |
| OW-03 | Outward number independent of inward | Check both registers | Sequences are separate | Edge |
| OW-04 | Delete entry | Confirm dialog | Entry permanently removed | Happy |

## 10. Known issues, limitations & FAQs
Same as Inward Register. See `inward-register.md` §10.
- Hard delete, no soft delete.
- Image attachments only.
- No pagination.

## 11. Sales notes
See Inward Register. Outward register is sold as part of the same Correspondence Management feature.

## 12. v1 status & v2 ideas
**Complete:** Full CRUD, auto-number, report view.
**v2 ideas:** Combined inward+outward dashboard; courier tracking integration; bulk dispatch entry.

## Source files
- `C:\rajesh\lms_k12\app\inward_outward\add_outward\page.tsx`
- `C:\rajesh\lms_k12\app\inward_outward\_components\RegisterPage.tsx`
- `F:\xampp\htdocs\next_lms_erp\app\Http\Controllers\inward_outward\outwardController.php`

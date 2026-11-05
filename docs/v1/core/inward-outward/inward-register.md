# Inward Register
**Product:** Scholar Core | **Module:** Inward/Outward | **Frontend route:** `/inward_outward/add_inward` | **v1 status:** Complete

| Field | Value |
|---|---|
| Backend routes | `GET /inward_outward/add_inward` (list), `POST /inward_outward/add_inward` (create), `PUT /inward_outward/add_inward/{id}` (update), `DELETE /inward_outward/add_inward/{id}` (delete) |
| Roles | Admin, Receptionist, Office Staff |
| Last updated | 2026-11-04 |
| Source commit | 8fe500dc (FE) / 86261072 (BE) |

## 1. Purpose & users
Tracks all documents, letters, parcels, and correspondence received by the institute. Each entry records who sent it, when it arrived, its subject, a file cabinet location, and an image attachment. Used by front-office and administrative staff to maintain a searchable inward correspondence log.

## 2. Screens

### Register screen — `/inward_outward/add_inward`
Shared `RegisterPage` component rendered with `kind="inward"`. Shows two areas:
- **Add entry panel** (toggled by "Add inward" button): inline form above the table.
- **Inward entries table**: all entries for the selected academic year, searchable by any column.

Main actions: Add, Edit, Delete, Download attachment (opens in new tab).

![](./screenshots/inward-register.png)

### Inward report — `/inward_outward/show_inward_report`
Filterable report view rendered by `ReportPage` component.

![](./screenshots/inward-report.png)

## 3. Features & business rules

### Entry form fields

| Field | Type | Required | Validation | Default |
|---|---|---|---|---|
| From place | Select (place_master) | Yes | Must select an existing place | — |
| Inward date | Date | Yes | — | Today |
| Inward number | Text (read-only) | Yes | Auto-incremented: `MAX(inward_number)+1` per institute+year | Auto |
| Subject | Text | Yes | Max 255 chars | — |
| Description | Textarea | Yes | Max 255 chars | — |
| File name | Select (physical_file_location) | Yes | Must select an existing file location | — |
| Upload image | File (image/*) | Yes on create; optional on edit | Image files only | — |

**Permission rules:**
- All roles with module access can create, edit, delete their institute's entries.
- Entries are scoped to `sub_institute_id` + `syear`; users cannot see other institutes' entries.
- JWT token validated on every API call.

**Business rules:**
- Inward number is system-generated and read-only; users cannot override it.
- Attachment is mandatory on create; on edit it is optional (leave blank to keep existing).
- Soft delete is NOT used — `deleteResource` calls a hard `DELETE` via the API.

## 4. User flows

**Create an inward entry:**
1. Open `/inward_outward/add_inward`.
2. Click "Add inward" — the add panel slides open.
3. Select from place, enter date (defaults to today), confirm auto-generated number.
4. Enter subject and description.
5. Select file name from location master.
6. Attach an image (required).
7. Click "Add inward" — entry is saved and table refreshes.

**Edit an entry:**
1. Click pencil icon on the row.
2. Form pre-fills with existing values; image upload becomes optional.
3. Save changes.

**Delete an entry:**
1. Click trash icon on the row.
2. Browser confirm dialog: "Delete inward entry {number}?"
3. On confirm, entry is permanently deleted.

## 5. Data model

### Table: `inward`

| Column | Type | Notes |
|---|---|---|
| id | int, PK | Auto-increment |
| place_id | int, FK | → `place_master.id` |
| file_location_id | int, FK | → `physical_file_location.id` |
| inward_number | varchar | System-generated sequential number |
| title | varchar(255) | Subject |
| description | varchar(255) | — |
| attachment | varchar | Stored filename (uploaded to `storage/public/inward/`) |
| attachment_size | int | Bytes |
| attachment_type | varchar | File extension |
| acedemic_year | varchar | Note: misspelling of "academic_year" in source |
| inward_date | date | — |
| sub_institute_id | int | Tenant scope |
| syear | varchar | Academic year scope |

### Supporting tables

| Table | Purpose |
|---|---|
| `place_master` | Lookup: origin places / senders |
| `physical_file_location` | Lookup: physical cabinet / file locations |

## 6. APIs

| Method | Endpoint | Auth | Request | Response |
|---|---|---|---|---|
| GET | `/inward_outward/add_inward?type=API` | JWT | `sub_institute_id`, `syear` | `{ status, data: [entries] }` |
| POST | `/inward_outward/add_inward?type=API` | JWT | Form fields + file | `{ status, message, data }` |
| GET | `/inward_outward/add_inward/{id}` | JWT | — | Single entry |
| PUT | `/inward_outward/add_inward/{id}` | JWT | Form fields (file optional) | `{ status, message }` |
| DELETE | `/inward_outward/add_inward/{id}` | JWT | — | `{ status, message }` |

**Error cases:** 401 if JWT invalid; 500 on DB failure.

## 7. UI components & design tokens
- `RegisterPage` (shared with Outward, `kind` prop switches behaviour)
- `PageFrame`, `PageHeader`, `Panel`, `Field`, `NativeSelect`, `Message`, `LoadingState` — all from `app/inward_outward/_components/shared.tsx`
- Lucide icons: `Plus`, `Pencil`, `Trash2`, `Search`, `ExternalLink`, `X`
- shadcn `Button`, `Input`, `Textarea`, `Table` family

## 8. Reports & exports
- Inward report: `/inward_outward/show_inward_report` (rendered by `ReportPage` component)

## 9. Test cases

| ID | Scenario | Steps | Expected result | Type |
|---|---|---|---|---|
| IW-01 | Create entry with all fields | Fill form, attach image, submit | Entry appears in table with auto-number | Happy |
| IW-02 | Create without attachment | Submit form without image | Error: "Choose an image attachment." | Negative |
| IW-03 | Edit existing entry without new image | Edit title, leave image blank | Entry updated, existing attachment kept | Happy |
| IW-04 | Search by subject | Type subject text in search box | Table filters to matching rows only | Happy |
| IW-05 | Delete entry | Click trash, confirm | Entry removed from table | Happy |
| IW-06 | Cancel delete | Click trash, cancel confirm dialog | Entry remains in table | Happy |
| IW-07 | Invalid JWT | Submit with expired token | 401 response, error message shown | Negative |
| IW-08 | Inward number uniqueness | Create two entries same year | Numbers are sequential, no duplicates | Edge |

## 10. Known issues, limitations & FAQs

- **Typo in DB column**: `acedemic_year` (source code spelling). Downstream queries must use this misspelled name.
- **Hard delete**: No soft delete — deleted entries are permanently gone with no audit trail.
- **Image only**: Attachment accepts `image/*` only. PDF/Word documents cannot be attached despite the "attachment" label.
- **No pagination**: All entries for the year are fetched and rendered in one table. Large institutes may see slow loads.
- **FAQ**: "Can I re-use inward numbers?" — No, numbers are auto-incremented and cannot be manually set.

## 11. Sales notes
**Key selling points:**
- Complete, searchable inward correspondence log — no paper register needed.
- Attachment directly linked to the entry; instant retrieval.
- Academic-year scoping keeps records organised.

**Demo flow (3 steps):**
1. Show empty register for current year.
2. Add an entry (letter from CBSE) with a photo attachment.
3. Search by sender name — entry appears instantly.

**Plan/pricing:** TBD

## 12. v1 status & v2 ideas
**Complete:** Create, read, update, delete, search, auto-number, attachment upload, report view.
**Partial:** Report screen details TBD (ReportPage component not read in full).
**v2 ideas:** PDF/Word attachment support; soft delete with recovery; pagination; barcode/QR scan on physical envelopes; email notification on inward receipt.

## Source files
- `C:\rajesh\lms_k12\app\inward_outward\add_inward\page.tsx`
- `C:\rajesh\lms_k12\app\inward_outward\_components\RegisterPage.tsx`
- `C:\rajesh\lms_k12\app\inward_outward\_components\shared.tsx`
- `F:\xampp\htdocs\next_lms_erp\app\Http\Controllers\inward_outward\inwardController.php`
- `F:\xampp\htdocs\next_lms_erp\app\Models\inward_outward\inwardModel.php` (referenced in controller)

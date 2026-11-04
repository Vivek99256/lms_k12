# Complaint Management
**Product:** Scholar Core | **Module:** Admin Services | **Frontend route:** `/admin-services/complaint-management`, `/admin-services/complaint-report` | **v1 status:** Complete

| Field | Value |
|---|---|
| Backend routes | `GET/POST api/complaints`, `POST api/complaints/{id}`, `POST api/complaints/{id}/delete` |
| Roles | Admin, Staff, Teacher |
| Last updated | 2026-11-04 |
| Source commit | 8fe500dc (FE) / 86261072 (BE) |

## 1. Purpose & users
Logs and tracks complaints raised by staff or parents within the institute. Each complaint can be assigned a solution and a resolution status. Report screen is the same filtered list.

## 2. Screens

### Complaint Management (`/admin-services/complaint-management`)
Two-panel layout: form (add/edit) + `RecordTable` list. No date filter on this screen — shows all complaints.

### Complaint Report (`/admin-services/complaint-report`)
Same endpoint with `from_date` / `to_date` filters. Allows date-range filtering and export.

## 3. Features & business rules

| Field | Type | Required | Validation | Default |
|---|---|---|---|---|
| Title | Text | Yes | — | — |
| Description | Text | No | — | — |
| Date | Date | Yes | — | Today |
| Attachment | File | No | MAX_UPLOAD_BYTES | — |
| Solution | Text | No | — | "PENDING" (seeded default) |
| Solution by | Dropdown (users) | No | From complaint board users list | — |

**Status flow:** New complaint created with `solution = "PENDING"`. Staff updates solution text and assigns resolver.

**Statuses:** From `complaint_status` rows of type `COMPLAIN` — dynamic list from backend.

**Blade routes avoided:** The old `frontdesk/complaint` store/update routes insert `$request->except([...])` verbatim, causing SQL errors on PHP 8 (unknown column `type`). All FE calls use `api/complaints` (stateless, JWT-guarded, explicit column whitelist).

## 4. User flows

**Log a complaint:**
1. Open Complaint Management.
2. Fill title, description, date.
3. Optionally attach evidence.
4. Save — appears in list with "PENDING" solution.

**Resolve:**
1. Click edit on a complaint.
2. Add solution text, assign resolver.
3. Save.

## 5. Data model

| Table | Key columns | Notes |
|---|---|---|
| `complaint` (inferred) | id, sub_institute_id, title, description, date, solution, solution_by_id, attachment, created_by | Main table (via `api/complaints`) |

Exact table name inferred from controller path. Migration not found with "complaint" — may be in an older batch or inside a combined migration.

## 6. APIs

| Method | Endpoint | Auth | Request | Response |
|---|---|---|---|---|
| GET | `api/complaints` | JWT | `from_date`, `to_date` (optional) | `{ data: { complaints[], statuses[], users[] } }` |
| POST | `api/complaints` | JWT | multipart: title, description, date, attachment | `{ success, message, data: ComplaintRecord }` |
| POST | `api/complaints/{id}` | JWT | multipart: updated fields | `{ success, message }` |
| POST | `api/complaints/{id}/delete` | JWT | — | `{ success, message }` |

## 7. UI components & design tokens
- `RecordTable`, `ErpPageHeader`, `ErpSection`, `ErpAlert`, `ErpLoading`
- `erpInputClass`, `erpSelectClass`
- Lucide: `MessageSquareWarning`, `Save`, `Trash2`, `LoaderCircle`

## 8. Reports & exports
- `/admin-services/complaint-report` — date-filtered list; export format TBD

## 9. Test cases

| ID | Scenario | Steps | Expected result | Type |
|---|---|---|---|---|
| TC-COMP-01 | Log new complaint | Fill form, save | Complaint appears with PENDING status | Happy |
| TC-COMP-02 | Resolve complaint | Edit, add solution, save | Solution text updated | Happy |
| TC-COMP-03 | Report with date filter | Set from/to date | Only matching complaints shown | Happy |
| TC-COMP-04 | Delete complaint | Click delete | Complaint removed from list | Happy |
| TC-COMP-05 | Save without title | Submit blank | Validation error | Negative |

## 10. Known issues, limitations & FAQs
- Migration for `complaint` table not found in named migrations; schema inferred from TypeScript types.
- **FAQ:** Can parents submit complaints? Not in v1 — staff only.
- **FAQ:** Is there an escalation workflow? Not in v1.

## 11. Sales notes
- Replaces complaint registers; searchable, auditable history.

## 12. v1 status & v2 ideas
- **Complete:** CRUD, report.
- **v2 ideas:** Parent-facing complaint submission, escalation workflow, SLA tracking.

## Source files
- `C:\rajesh\lms_k12\app\admin-services\complaint-management\page.tsx`
- `C:\rajesh\lms_k12\app\admin-services\_lib\complaint.ts`

# SQAA Documents
**Product:** Scholar Core | **Module:** SQAA | **Frontend route:** `/sqaa/*` (document upload screens) | **v1 status:** Partial

| Field | Value |
|---|---|
| Backend routes | TBD |
| Roles | Admin, Principal, SQAA Coordinator |
| Last updated | 2026-11-04 |
| Source commit | 8fe500dc (FE) / 86261072 (BE) |

## 1. Purpose & users
Upload and manage evidence documents for SQAA criteria nodes. Each document is linked to a criteria node (`menu_id`), has a title, reasons, availability status, and file attachment.

## 2. Screens
Document upload is embedded within the SQAA criteria hierarchy screens. See `sqaa-master.md` for the parent screen. The `DocumentReportPage` component from `app\sqaa\_components\DocumentReportPage.tsx` renders the document list per criteria.

## 3. Features & business rules

| Field | Type | Required | Notes |
|---|---|---|---|
| menu_id | FK | Yes | Links to sqaa_master.id |
| document_id | FK | No | Optional reference to document library |
| title | longtext | No | Evidence title |
| reasons | longtext | No | Justification |
| availability | varchar 20 | Yes | Availability status (values TBD) |
| file | varchar 255 | No | Uploaded file path |

## 4. User flows
1. Navigate to SQAA criteria node.
2. Add evidence document: title, reasons, upload file.
3. Set availability status.
4. Save.

## 5. Data model

| Table | Key columns |
|---|---|
| `sqaa_documents` | id, menu_id, document_id, title, reasons, availability, file, sub_institute_id, created_by |
| `sqaa_documant_master` | (from migration — structure TBD) |

## 6. APIs
TBD

## 7. UI components & design tokens
- `DocumentReportPage` (`app\sqaa\_components\DocumentReportPage.tsx`)
- `HierarchyFields` (`app\sqaa\_components\HierarchyFields.tsx`)

## 8. Reports & exports
- See `sqaa-reports.md`

## 9. Test cases

| ID | Scenario | Steps | Expected result | Type |
|---|---|---|---|---|
| TC-SQAA-DOC-01 | Upload evidence for criteria | Attach file, save | File linked to criteria | Happy |
| TC-SQAA-DOC-02 | Add document without file | Fill title only | Allowed (file optional) | Edge |

## 10. Known issues, limitations & FAQs
- `availability` column values not defined in migration (varchar 20 only).
- **FAQ:** Can multiple documents be attached to one criteria? Yes — multiple `sqaa_documents` rows per `menu_id`.

## 12. v1 status & v2 ideas
- **Partial:** Upload and listing functional; bulk upload and versioning not in v1.

## Source files
- `C:\rajesh\lms_k12\app\sqaa\_components\DocumentReportPage.tsx`
- `F:\xampp\htdocs\next_lms_erp\database\migrations\2023_09_06_162421_create_sqaa_documents_table.php`

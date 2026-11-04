# SQAA Master
**Product:** Scholar Core | **Module:** SQAA (School Quality Assurance & Accreditation) | **Frontend route:** `/sqaa_master`, `/sqaa/*` | **v1 status:** Partial

| Field | Value |
|---|---|
| Backend routes | TBD (sqaa routes in api.php not fully read) |
| Roles | Admin, Principal, SQAA Coordinator |
| Last updated | 2026-11-04 |
| Source commit | 8fe500dc (FE) / 86261072 (BE) |

## 1. Purpose & users
Manages the school's self-assessment framework for quality assurance and accreditation. Builds a hierarchical criteria tree (levels 1–n), assigns marks, and tracks supporting documents.

## 2. Screens

### SQAA Master (`/sqaa_master`)
Hierarchical tree of SQAA criteria. Each node has: title, description, parent, level, status, sort order.

### SQAA Module (`/sqaa/*`)
Sub-pages for entering marks and uploading evidence documents per criteria node.

### SQAA Document Report (`/sqaa_document_report`)
Report of uploaded documents per criteria, with availability and file links.

## 3. Features & business rules

**sqaa_master table structure (hierarchical):**
| Field | Type | Required | Notes |
|---|---|---|---|
| title | varchar 255 | No | Nullable |
| description | varchar 255 | No | Nullable |
| parent_id | bigint | Yes | 0 = root node |
| level | int | Yes | Hierarchy depth |
| status | int | Yes | Active/inactive |
| sort_order | int | Yes | Display order |
| sub_institute_id | bigint | Yes | Tenant scope |

**sqaa_documents:**
| Field | Type | Notes |
|---|---|---|
| menu_id | bigint | Links to sqaa_master node |
| document_id | bigint | Optional document reference |
| title | longtext | Evidence title |
| reasons | longtext | Justification text |
| availability | varchar 20 | Availability status |
| file | varchar 255 | Uploaded file path |

**sqaa_marks:**
| Fields | Inferred from migration | Per criteria marks |

## 4. User flows

1. Admin builds SQAA tree (top-level criteria → sub-criteria).
2. Coordinator enters marks per criteria.
3. Upload supporting documents.
4. Run SQAA Document Report to verify completeness.

## 5. Data model

| Table | Key columns | Notes |
|---|---|---|
| `sqaa_master` | id, title, description, parent_id, level, status, sort_order, sub_institute_id, created_by | Criteria hierarchy |
| `sqaa_marks` | (from migration 2023_09_02_120344) | Marks per criteria |
| `sqaa_documents` | id, menu_id, document_id, title, reasons, availability, file, sub_institute_id | Evidence documents |
| `sqaa_documant_master` (sic) | (from migration 2023_10_06_130947) | Document master for SQAA |

Note: `sqaa_documant_master` — "documant" is a typo in the migration filename (should be "document").

## 6. APIs
TBD — sqaa controller routes not read in this pass.

## 7. UI components & design tokens
- `DocumentReportPage`, `EntryPage`, `HierarchyFields` (from `app\sqaa\_components\`)
- Design system components TBD

## 8. Reports & exports
- `/sqaa_document_report` — evidence document report

## 9. Test cases

| ID | Scenario | Steps | Expected result | Type |
|---|---|---|---|---|
| TC-SQAA-01 | Add root criteria | Create level-1 node | Appears as top node | Happy |
| TC-SQAA-02 | Add sub-criteria | Create child of existing node | Appears nested | Happy |
| TC-SQAA-03 | Upload evidence document | Attach file to criteria | Appears in document report | Happy |
| TC-SQAA-04 | View document report | Open report | All criteria with doc count shown | Happy |

## 10. Known issues, limitations & FAQs
- `sqaa_documant_master` migration filename has a typo ("documant").
- **FAQ:** Which accreditation framework is supported? Framework is configurable via the SQAA master tree — not hardcoded to any specific body (NAAC, ISO, etc.).

## 11. Sales notes
- Supports any accreditation framework (NAAC, ISO, CBSE, state board).
- Digital evidence repository replaces physical binders.

## 12. v1 status & v2 ideas
- **Partial:** Master setup and document upload functional; full marks workflow and reporting TBD.
- **v2 ideas:** Automated evidence collection from other modules (attendance, results), accreditation body report templates.

## Source files
- `C:\rajesh\lms_k12\app\sqaa\` directory
- `F:\xampp\htdocs\next_lms_erp\database\migrations\2023_09_02_120300_create_sqaa_master_table.php`
- `F:\xampp\htdocs\next_lms_erp\database\migrations\2023_09_06_162421_create_sqaa_documents_table.php`
- `F:\xampp\htdocs\next_lms_erp\database\migrations\2023_09_02_120344_create_sqaa_marks_table.php`
- `F:\xampp\htdocs\next_lms_erp\database\migrations\2023_10_06_130947_create_sqaa_documant_master_table.php`

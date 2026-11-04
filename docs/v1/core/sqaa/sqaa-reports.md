# SQAA Reports
**Product:** Scholar Core | **Module:** SQAA | **Frontend route:** `/sqaa_document_report` | **v1 status:** Partial

| Field | Value |
|---|---|
| Backend routes | TBD |
| Roles | Admin, Principal, SQAA Coordinator |
| Last updated | 2026-11-04 |
| Source commit | 8fe500dc (FE) / 86261072 (BE) |

## 1. Purpose & users
Report of SQAA evidence documents across all criteria. Shows which criteria have supporting documents and which are missing evidence.

## 2. Screens

### SQAA Document Report (`/sqaa_document_report`)
Tabular view of SQAA criteria with document counts, availability status, and file download links.

## 3. Features & business rules
- Filters: TBD (academic year, criteria level)
- Shows criteria hierarchy with document status per node.
- File download links for uploaded evidence.

## 4. User flows
1. Open SQAA Document Report.
2. Browse criteria tree with document status.
3. Download individual documents.

## 5. Data model
Reads from `sqaa_documents` joined with `sqaa_master`.

## 6. APIs
TBD

## 7. UI components & design tokens
- `DocumentReportPage` component

## 8. Reports & exports
- PDF/Excel: TBD

## 9. Test cases

| ID | Scenario | Steps | Expected result | Type |
|---|---|---|---|---|
| TC-SQAA-RPT-01 | View report | Open page | All criteria listed with doc count | Happy |
| TC-SQAA-RPT-02 | Download document | Click file link | File downloads | Happy |

## 10. Known issues
- Full report structure TBD — backend controller not read in this pass.

## 12. v1 status & v2 ideas
- **Partial:** Basic document listing. Full marks/score report TBD.
- **v2 ideas:** Criteria completion percentage, accreditation readiness score, export as accreditation body report format.

## Source files
- `C:\rajesh\lms_k12\app\sqaa_document_report\page.tsx` (TBD — not read)
- `F:\xampp\htdocs\next_lms_erp\database\migrations\2023_09_06_162421_create_sqaa_documents_table.php`

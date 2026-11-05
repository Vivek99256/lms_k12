# Document Extraction
**Product:** Scholar Core | **Module:** Document Library | **Frontend route:** TBD | **v1 status:** Partial

| Field | Value |
|---|---|
| Backend routes | TBD |
| Roles | Admin, Principal |
| Last updated | 2026-11-04 |
| Source commit | 8fe500dc (FE) / 86261072 (BE) |

## 1. Purpose & users
AI-powered extraction of structured data from uploaded documents (e.g., extracting fields from a scanned form, invoice, or certificate). Backed by the `DocumentExtraction` model/table in the backend. No dedicated frontend route was found in v1 — extraction may be triggered from within the Document Library detail view or from other modules.

## 2. Screens
No standalone frontend route found in v1. Extraction may surface as a panel/modal within the Document Library (`/documents/[source]`) or via the AI Stack. TBD.

## 3. Features & business rules
- Extraction results are stored in `document_extractions` table.
- Linked to the source `document_master` record.
- Extraction logic (AI model, field mappings) is TBD from backend code — `DocumentExtraction` model found but controller not read.

## 4. User flows
TBD — no frontend route found.

## 5. Data model

### Model: `DocumentExtraction` — table: `document_extractions` (inferred from model name)

| Column | Type | Notes |
|---|---|---|
| id | int PK | — |
| document_id | int FK | → `document_master.id` |
| extracted_fields | json | Extracted key-value pairs |
| status | varchar | TBD (pending/completed/failed) |
| created_at | timestamp | — |

(Columns TBD — model file not read in full.)

## 6. APIs
TBD.

## 7. UI components & design tokens
TBD.

## 8. Reports & exports
TBD.

## 9. Test cases
TBD — no frontend route found to test against.

## 10. Known issues, limitations & FAQs
- No frontend route found in v1 — this feature may be in progress or backend-only.
- **FAQ**: "Where do I see extracted document data?" — TBD.

## 11. Sales notes
Potential v2 selling point: AI-extracted data from uploaded documents reduces manual data entry.

## 12. v1 status & v2 ideas
**v1 status:** Backend model exists; frontend route not found — treat as Stub/In-progress.
**v2 ideas:** Dedicated extraction UI; field mapping configuration; bulk extraction; integration with student/staff profile auto-fill.

## Source files
- `F:\xampp\htdocs\next_lms_erp\app\Models\Documents\DocumentMaster.php` (references extractions)
- Backend extraction model: TBD (not read)

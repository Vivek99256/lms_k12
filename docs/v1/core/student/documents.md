# Student Documents
**Product:** Scholar Core | **Module:** Student | **Frontend route:** `/students/student_documents` | **v1 status:** Complete

| Field | Value |
|---|---|
| Backend routes | `POST /api/proxy?path=get_adminStudentSearch` · TBD (document CRUD endpoints) |
| Roles | Admin, Coordinator, Class Teacher |
| Last updated | 2026-11-04 |
| Source commit | 8fe500dc (FE) / 86261072 (BE) |

## 1. Purpose & users
Tracks required documents (Aadhar, birth certificate, transfer certificate, etc.) submitted by students. Shows compliance metrics: how many students have submitted all required documents, which are missing. Used by admin and coordinators at enrollment time and during academic-year compliance audits.

## 2. Screens

**Student Documents** (`/students/student_documents`)
- Metric cards: total students, documents submitted, missing documents, compliance rate
- Document charts panel (compliance by type)
- Student document table: student name, class, section, documents status per type
- Per-student document card showing individual document status

![](./screenshots/student-documents.png)

## 3. Features & business rules

### Document types
Defined in `student_document_type` table (migration: `2023_03_05_115658_create_student_document_type_table.php`). The types are institute-configurable.

### Document record fields (`tblstudent_document`)
| Column | Type | Notes |
|---|---|---|
| id | bigint PK | |
| student_id | int FK → tblstudent | |
| document_type_id | int FK → student_document_type | |
| document_title | varchar(250) | |
| file_name | varchar(250) | Stored file path |
| sub_institute_id | int | Multi-tenant |
| created_on | timestamp | |

### Standard-mapping (`tblstudent_doc_std_mapping`)
Migration `2024_06_19_111651_create_tblstudent_doc_std_mapping_table.php` — maps required document types to standards (classes). Determines which documents are required for which class.

### Business rules
- A document is "missing" if the student has no `tblstudent_document` row for a required `document_type_id` for their standard.
- Compliance rate = (students with all required docs / total students) × 100.

## 4. User flows

**View document compliance**
1. Navigate to Students → Documents.
2. Page fetches student roster and document records.
3. Metric cards show overall compliance; table shows per-student status.

**Upload document**
1. Click on a student's document row.
2. Upload file (MIME type and size validated before sending to Laravel; max = `MAX_UPLOAD_BYTES` env var, default 50 MB).
3. Document saved; compliance count updates.

## 5. Data model

### `tblstudent_document`
| Column | Type | Notes |
|---|---|---|
| id | bigint PK | |
| student_id | int | FK → tblstudent |
| document_type_id | int | FK → student_document_type |
| document_title | varchar(250) | |
| file_name | varchar(250) | |
| sub_institute_id | int | |
| created_on | timestamp | |

### `tblstudent_doc_std_mapping`
Maps required document types to standards. Created 2024-06-19.

## 6. APIs
| Method | Endpoint | Auth | Request | Response | Errors |
|---|---|---|---|---|---|
| POST | `get_adminStudentSearch` | Session | Session params | Student roster | — |
| GET/POST | TBD (document list/upload) | Session | student_id, document_type_id, file | `{ status:1 }` | 413 file too large |

Document-specific API endpoints are managed by `tblstudentDocumentController.php` — exact routes TBD.

## 7. UI components & design tokens
- `DocumentCharts` — compliance chart panel
- `MetricsCards` — four KPI tiles
- `StudentDocumentCard` — per-student document status card
- `StudentTable` — paginated table

## 8. Reports & exports
See [../student/reports.md](reports.md) — "Missing Document Report" (`/student/report/missing_document_report`).

## 9. Test cases
| ID | Scenario | Steps | Expected result | Type |
|---|---|---|---|---|
| S-DOC-01 | View compliance | Navigate to /students/student_documents | Metric cards and table load | Happy |
| S-DOC-02 | Upload valid doc | Upload a PDF under 50 MB | Document saved; compliance updates | Happy |
| S-DOC-03 | Upload oversized file | Upload file > 50 MB | Error shown; upload rejected | Negative |
| S-DOC-04 | Student with all docs | Student has all required docs | 100% shown; no missing indicator | Happy |

## 10. Known issues, limitations & FAQs
- Document upload API endpoints were not found in `api.php` during this scan; they may be in Blade/web routes. Verify.
- File storage path is a plain string in `file_name`; no CDN or presigned-URL strategy visible in migrations.

## 11. Sales notes
**Selling points:** Automated compliance tracking; instant visibility of which students are missing which documents.

**Demo flow:**
1. Show compliance rate metric.
2. Drill into a student with missing docs.
3. Upload a document and show metric update.

Plan/pricing: TBD

## 12. v1 status & v2 ideas
**Complete:** Compliance metrics, document table, per-student status.
**Partial:** Upload UI (component exists; API route TBD).
**v2 ideas:** Automated reminders to parents for missing documents; bulk document download as ZIP.

## Source files
- `C:\rajesh\lms_k12\app\students\student_documents\page.tsx`
- `C:\rajesh\lms_k12\app\students\student_documents\api.ts`
- `C:\rajesh\lms_k12\app\students\student_documents\components\`
- `F:\xampp\htdocs\next_lms_erp\database\migrations\2023_03_05_115658_create_tblstudent_document_table.php`
- `F:\xampp\htdocs\next_lms_erp\database\migrations\2024_06_19_111651_create_tblstudent_doc_std_mapping_table.php`
- `F:\xampp\htdocs\next_lms_erp\app\Http\Controllers\student\tblstudentDocumentController.php`

# Document Library
**Product:** Scholar Core | **Module:** Document Library | **Frontend route:** `/documents`, `/documents/[source]` | **v1 status:** Complete

| Field | Value |
|---|---|
| Backend routes | `GET /api/documents/sources` (overview), `GET /api/documents/sources/{source}` (list by domain), `GET /api/documents/recent` (recent) |
| Roles | Admin, Principal, Teachers, HR — any role with module access |
| Last updated | 2026-11-04 |
| Source commit | 8fe500dc (FE) / 86261072 (BE) |

## 1. Purpose & users
A read-only aggregation layer that surfaces documents already created by other modules (fees receipts, admission forms, circulars, compliance records, etc.) in a single browsable library. Users can search, filter, and download — but cannot upload directly here. Uploads happen in the originating module.

> "THIS SCREEN OWNS NOTHING." — inline source comment, `documents-dashboard.tsx`

## 2. Screens

### Documents dashboard — `/documents`
Card grid showing document domains (sources). Each card shows:
- Domain name and icon
- Document count for the current academic year
- "Open" button → navigates to domain detail

Dashboard is customisable: users can hide cards via "Customize dashboard".

Access guard: `canAccessDocuments()` runs client-side. Users without access are redirected to `/dashboard`. Laravel enforces the real access control independently (returns 403 on API calls).

![](./screenshots/documents-dashboard.png)

### Domain detail — `/documents/[source]`
Table of documents for the selected domain/source. Shows recent documents with metadata and download links.

![](./screenshots/document-source.png)

## 3. Features & business rules

**Document domains (derived from `DOMAIN_ICONS` map in source):**

| Domain key | Icon | Description |
|---|---|---|
| graduation-cap | GraduationCap | Student documents |
| briefcase | Briefcase | Staff/HR documents |
| book-open | BookOpen | Academic documents |
| receipt-indian-rupee | ReceiptIndianRupee | Fee documents |
| megaphone | Megaphone | Circulars/communications |
| shield-check | ShieldCheck | Compliance documents |

**Permission rules:**
- Read-only: no create, edit, or delete from this module.
- Academic year scoped — counts reflect the selected year.
- Per-user widget visibility preferences saved to backend (`/api/dashboard-preferences/{key}`).

**Business rules:**
- Document counts are live reads from tables owned by other modules.
- "Recent" section shows the most recently created documents across all domains.
- Each row links back to the owning module for editing.

## 4. User flows

**Browse documents:**
1. Open `/documents`.
2. Dashboard loads with domain cards and counts.
3. Click a card → opens domain detail with document list.
4. Click a document row → opens or downloads the document, or navigates to the source module.

**Customise dashboard:**
1. Click "Customize dashboard".
2. Toggle domain cards on/off.
3. Preference is saved per user.

## 5. Data model

### Tables read (not owned by this module)

| Table | Domain | Owning module |
|---|---|---|
| `tblstudent_doc_std_mapping` | Student documents | Student |
| `hrms_attendances` / HRMS tables | Staff documents | CCB/HRIT |
| `tblfeescollect` | Fee documents | Fees |
| `circular_master` | Circulars | Communication |
| `org_compliance_library` | Compliance | Organization Management |
| TBD (academic) | Academic documents | Academic Setup / LMS |

### Documents module own models

| Model | Table | Purpose |
|---|---|---|
| `DocumentMaster` | `document_master` | Master registry of document metadata |
| `DocumentHistory` | `document_history` | Version/change history |

## 6. APIs

| Method | Endpoint | Auth | Response |
|---|---|---|---|
| GET | `/api/documents/sources` | JWT | `{ domains: [{ key, name, icon, count }], recent: [...] }` |
| GET | `/api/documents/sources/{source}` | JWT | `{ documents: [...], meta: {...} }` |
| GET | `/api/dashboard-preferences/documents-*` | JWT | User widget visibility preferences |
| PUT | `/api/dashboard-preferences/documents-*` | JWT | Save widget preferences |

## 7. UI components & design tokens
- `DocumentsDashboard`, `DocumentSourceTable`, `DocumentDetailPanel`, `IdmsLibrary` — from `app/documents/_components/`
- `UploadReviewModal`, `TrashDialog` (upload review and trash confirm — used in source modules, linked from here)
- `PageFrame`, `PageHeader`, `InlineMessage` — from `app/fees/_components/fees-shared` (reused)
- Lucide icons: `BookOpen`, `Briefcase`, `GraduationCap`, `ReceiptIndianRupee`, `Megaphone`, `ShieldCheck`, `FileText`, `AlertCircle`, `ArrowUpRight`, `ExternalLink`
- `CustomizeDashboard` from `app/dashboard/_components/`
- `useDashboardPreferences` hook

## 8. Reports & exports
No standalone reports. Each document links back to its source module's report/download.

## 9. Test cases

| ID | Scenario | Steps | Expected result | Type |
|---|---|---|---|---|
| DL-01 | Load dashboard | Open `/documents` | Cards shown with correct counts | Happy |
| DL-02 | No access | User without rights opens `/documents` | Redirect to `/dashboard` | Negative |
| DL-03 | Open domain | Click a domain card | Domain detail table loads | Happy |
| DL-04 | Hide widget | Customize, toggle off a card | Card hidden; preference saved | Happy |
| DL-05 | Restore widget | Customize, toggle card back on | Card reappears | Happy |
| DL-06 | Academic year change | Switch year in header | Counts update to new year | Edge |

## 10. Known issues, limitations & FAQs
- **Read-only by design**: cannot upload from this screen. Users sometimes expect to upload here.
- **Domain list is backend-driven**: adding a new domain requires backend changes to `/api/documents/sources`.
- **FAQ**: "Why can't I upload here?" — Upload from the originating module (e.g., upload fee receipts from Fees, compliance docs from Compliance Library).

## 11. Sales notes
**Key selling points:**
- One place to find any document from any module — no more hunting through menus.
- Customisable per user — hide irrelevant domains.
- Zero duplication: counts are live from source tables.

**Demo flow:**
1. Show dashboard with 6 domain cards and counts.
2. Click "Fee documents" → list of receipts appears.
3. Show "Customize dashboard" to hide/show cards.

**Plan/pricing:** TBD

## 12. v1 status & v2 ideas
**Complete:** Dashboard, domain detail, widget customisation, access guard.
**v2 ideas:** Global search across all domains; upload directly from library with module routing; document expiry alerts; bulk download by domain.

## Source files
- `C:\rajesh\lms_k12\app\documents\page.tsx`
- `C:\rajesh\lms_k12\app\documents\[source]\page.tsx`
- `C:\rajesh\lms_k12\app\documents\_components\documents-dashboard.tsx`
- `C:\rajesh\lms_k12\app\documents\_components\document-source-table.tsx`
- `C:\rajesh\lms_k12\app\documents\_components\document-detail-panel.tsx`
- `F:\xampp\htdocs\next_lms_erp\app\Models\Documents\DocumentMaster.php`
- `F:\xampp\htdocs\next_lms_erp\app\Models\Documents\DocumentHistory.php`

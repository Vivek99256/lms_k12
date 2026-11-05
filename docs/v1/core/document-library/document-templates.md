# Document Templates
**Product:** Scholar Core | **Module:** Document Library | **Frontend route:** `/document-templates`, `/document-templates/editor/[templateId]` | **v1 status:** Complete

| Field | Value |
|---|---|
| Backend routes | `GET /api/document-templates` (list), `POST /api/document-templates` (create), `PUT /api/document-templates/{id}` (update), `DELETE /api/document-templates/{id}` (delete), `POST /api/document-templates/{id}/duplicate`, `GET /api/document-templates/{id}/pdf` (download) |
| Roles | Admin, Principal, HR (create/edit/delete); all staff (view/download) |
| Last updated | 2026-11-04 |
| Source commit | 8fe500dc (FE) / 86261072 (BE) |

## 1. Purpose & users
A gallery and editor for reusable document templates — certificates, ID cards, fee documents, admission letters, circulars, exam documents, and AI-generated templates. Admins create and publish templates; end users generate documents from them in their respective modules.

## 2. Screens

### Template gallery — `/document-templates`
Card grid of all templates, filterable by category and status. Each card shows name, category badge, status badge, and actions (edit, duplicate, download PDF, delete).

![](./screenshots/document-templates-gallery.png)

### Template editor — `/document-templates/editor/[templateId]`
Rich editor for creating/editing a template. Linked from gallery card "Edit" action.

![](./screenshots/document-templates-editor.png)

### AI Stack — `/document-templates/ai-stack`
Module-level AI automation screen for document template intelligence.

## 3. Features & business rules

### Template categories

| Category key | Label |
|---|---|
| all | All categories |
| certificate | Certificates |
| id_card | ID cards |
| fees | Fee documents |
| admission | Admission documents |
| exam | Exam documents |
| circular | Circulars |
| ai | AI templates |
| general | General |

### Template statuses

| Status | Badge style |
|---|---|
| draft | Slate (grey) |
| published | Emerald (green) |
| archived | Amber (yellow) |

**Permission rules:**
- Create / Edit / Delete: Admin, Principal, HR.
- Download PDF: all roles with module access.
- Duplicate: creates a draft copy; name prefixed "Copy of …" (TBD from API).

**Business rules:**
- Only `published` templates are available for use in other modules.
- `archived` templates are read-only; they can be un-archived (TBD if supported in v1).
- Duplicate always creates a `draft`.
- `downloadTemplatePdf` calls the Platform API client, not the ERP client directly.

## 4. User flows

**Create a template:**
1. Open `/document-templates`.
2. Click "New template" (or equivalent action — TBD from editor page).
3. Select category, write content in editor, set status to `published`.
4. Save — template appears in gallery.

**Generate a document from a template:**
1. In the target module (e.g., Fees), select a student.
2. Choose the published template.
3. System fills placeholders and generates PDF — TBD (placeholder fill logic is in respective modules).

**Duplicate a template:**
1. Click the duplicate icon on a gallery card.
2. A draft copy is created immediately.
3. Edit the copy and publish when ready.

## 5. Data model

### Model: `DocumentTemplate` — table: `document_templates`

| Column | Type | Notes |
|---|---|---|
| id | int PK | — |
| name | varchar | Template name |
| category | varchar | One of the 8 category keys |
| status | varchar | draft / published / archived |
| content | longtext | Template HTML/JSON body |
| sub_institute_id | int | Tenant scope |
| created_by | int FK | → users |
| updated_by | int FK | → users |

### Model: `DocumentTemplateVersion` — table: `document_template_versions`
Stores version history for each template (columns: TBD from migration).

## 6. APIs

| Method | Endpoint | Auth | Request | Response |
|---|---|---|---|---|
| GET | `/api/document-templates` | JWT | `?category=&status=` | `{ templates: [TemplateSummary] }` |
| POST | `/api/document-templates` | JWT | `{ name, category, content, status }` | Created template |
| PUT | `/api/document-templates/{id}` | JWT | Partial update | Updated template |
| DELETE | `/api/document-templates/{id}` | JWT | — | `{ success }` |
| POST | `/api/document-templates/{id}/duplicate` | JWT | — | New draft template |
| GET | `/api/document-templates/{id}/pdf` | JWT | — | PDF binary (via Platform API) |

**Error cases:** `PlatformApiError` thrown on PDF download failure; shown to user as toast.

## 7. UI components & design tokens
- `DocumentTemplatesGallery` — inline in `document-templates/page.tsx`
- `ErpAlert`, `ErpEmpty`, `ErpLoading`, `ErpPageHeader`, `erpCardClass` — from `components/erp/erp-ui`
- `Button` from `components/ui/button`
- Lucide: `Copy`, `FileText`, `Files`, `Pencil`, `Plus`, `Search`, `Trash2`, `FileDown`, `Loader2`
- Status badge colours: slate (draft), emerald (published), amber (archived) — inline Tailwind classes, not design tokens

## 8. Reports & exports
- PDF download per template via `/api/document-templates/{id}/pdf`.

## 9. Test cases

| ID | Scenario | Steps | Expected result | Type |
|---|---|---|---|---|
| DT-01 | Create a certificate template | New → fill fields → publish | Template appears in gallery with green badge | Happy |
| DT-02 | Filter by category | Select "Certificates" | Only certificate templates shown | Happy |
| DT-03 | Duplicate template | Click duplicate on a card | Draft copy created with "Copy of …" name | Happy |
| DT-04 | Download PDF | Click download icon | PDF file downloaded | Happy |
| DT-05 | Delete template | Click delete, confirm | Template removed from gallery | Happy |
| DT-06 | PDF download failure | Backend error on PDF endpoint | `PlatformApiError` shown to user | Negative |
| DT-07 | Filter by status=draft | — | Only draft templates shown | Happy |

## 10. Known issues, limitations & FAQs
- **Status badge uses hardcoded Tailwind classes** — not design-system tokens; could diverge if theme changes.
- **Editor page not fully read** — editor internals (Tiptap integration, placeholder syntax) are TBD.
- **Archived templates**: whether they can be un-archived is TBD from the API.
- **FAQ**: "Why can't I find my template in Fees?" — Make sure the template status is `published` and its category is `fees`.

## 11. Sales notes
**Key selling points:**
- Centralised template library — no more per-module template scattered maintenance.
- Category-based filtering makes finding the right template fast.
- AI templates category: generate template content with AI assistance.
- One-click PDF preview before publishing.

**Demo flow:**
1. Show gallery with existing templates across categories.
2. Filter to "Certificates" — show certificate templates.
3. Duplicate a template, edit name, publish it.
4. Download PDF preview.

**Plan/pricing:** TBD

## 12. v1 status & v2 ideas
**Complete:** Gallery, CRUD, duplicate, PDF download, category/status filter, AI Stack screen.
**Partial:** Editor internals (Tiptap/placeholder fill logic) — not read in full.
**v2 ideas:** Template versioning UI; placeholder preview with real student data; AI-assisted template generation from prompts; template sharing across sub-institutes.

## Source files
- `C:\rajesh\lms_k12\app\document-templates\page.tsx`
- `C:\rajesh\lms_k12\app\document-templates\editor\[templateId]\page.tsx`
- `C:\rajesh\lms_k12\app\document-templates\api.ts` (referenced in imports)
- `F:\xampp\htdocs\next_lms_erp\app\Models\DocumentTemplate.php`

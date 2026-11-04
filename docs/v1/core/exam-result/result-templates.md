# Result Templates
**Product:** Scholar Core | **Module:** Exam / Result | **Frontend route:** `/result/templates` | **v1 status:** Complete

| Field | Value |
|---|---|
| Backend routes | GET/POST/PUT/DELETE api/result/result-template, GET api/result/result-template/tags |
| Roles | Admin, Exam Coordinator |
| Last updated | 2026-11-04 |
| Source commit | 8fe500dc (FE) / 86261072 (BE) |

## 1. Purpose & users
CRUD management of HTML report card templates. Each template contains HTML markup with server-side placeholder tags that are substituted with student data at report generation time. Used by Admin to create/maintain different templates for different boards, classes or exam types.

## 2. Screens

### Result Templates
Route: `/result/templates`

Standard MasterCrud table with columns: Id, Module name, Title, Created by, Created on.
Add/Edit form: Module name (text), Result type/Title (text), HTML content (rich editor).
Action button: "View default tags" — opens api/result/result-template/tags in a new tab.

![](./screenshots/result-templates.png)

## 3. Features & business rules

| Field | Type | Required | Validation | Default |
|---|---|---|---|---|
| module_name | text | Yes | max 255 | — |
| title (result type) | text | Yes | max 255 | — |
| html_content | rich HTML editor | Yes | Server validates non-empty | — |

**Rules:**
- Templates use placeholder tags to inject student data. Available tags shown via "View default tags" button (api/result/result-template/tags).
- PUT/DELETE use Laravel method-override (MasterCrud sends spoofed POST with _method field) because native PUT/DELETE routes work via Laravel's method field convention.
- Template is selected by name in the report card screen.

**Permissions:** Only Admin / Exam Coordinator can create, edit, delete templates.

## 4. User flows

**Add a template:**
1. Result -> Entry -> Result templates -> Add.
2. Enter Module name + Result type + paste HTML content with placeholders -> Save.
3. Template appears in report card dropdown.

**Edit:**
1. Click edit icon -> modify HTML content -> Save.

## 5. Data model

| Table | Key columns | Notes |
|---|---|---|
| result_template_master | id, module_name, title, html_content, user_created, created_at, sub_institute_id | One row per template |

## 6. APIs

| Method | Endpoint | Auth | Request | Response |
|---|---|---|---|---|
| GET | api/result/result-template | JWT | — | { data: Template[] } |
| POST | api/result/result-template | JWT | module_name, title, html_content | { success, message } |
| PUT | api/result/result-template | JWT | id, module_name, title, html_content | { success, message } |
| DELETE | api/result/result-template | JWT | id | { success, message } |
| GET | api/result/result-template/tags | JWT | — | Default placeholder tag list |

Controller: templateController.php

## 7. UI components & design tokens
- MasterCrud — components/result/MasterCrud.tsx (generic CRUD table + form)
- PageHeader — breadcrumb + title
- Editor field (type: 'editor') in MasterCrud form for HTML content
- Lucide: FileCode2, ExternalLink

## 8. Reports & exports
No direct export. Templates are consumed by Report Card generation.

## 9. Test cases

| ID | Scenario | Steps | Expected result | Type |
|---|---|---|---|---|
| RT-01 | Add valid template | Enter name + type + HTML -> Save | Template appears; available in report card dropdown | Happy |
| RT-02 | Edit HTML content | Edit existing template -> Save | Updated HTML used in next report card generation | Happy |
| RT-03 | Delete template | Delete existing -> confirm | Removed from list and report card dropdown | Happy |
| RT-04 | View default tags | Click "View default tags" | Opens tags list in new tab | Happy |
| RT-05 | Save with empty HTML | Leave html_content blank -> Save | Server returns validation error | Negative |

## 10. Known issues, limitations & FAQs
- No template preview — the HTML is a raw editor; preview requires generating a sample report card.
- No versioning — overwriting a template cannot be undone.
- FAQ: What placeholders are available? Use "View default tags" button to see the full list served by api/result/result-template/tags.

## 11. Sales notes
- Unlimited custom report card designs per institute — CBSE, ICSE, state board, custom in-house.
- Demo: Show two templates with different branding -> generate report cards with each.
- Pricing: TBD (included in Scholar Core).

## 12. v1 status & v2 ideas
- v1: Complete.
- v2: Template versioning; live preview with sample student data; template library/marketplace.

## Source files
- C:\rajesh\lms_k12\app\result\templates\page.tsx
- C:\rajesh\lms_k12\lib\result\masters.ts (screen definition reference)
- F:\xampp\htdocs\next_lms_erp\app\Http\Controllers\result\templateController.php
- F:\xampp\htdocs\next_lms_erp\app\Models\result\result_template.php
- Migration: 2023_09_08_145910_create_result_template_master_table.php

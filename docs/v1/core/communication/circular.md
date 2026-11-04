# Circular
**Product:** Scholar Core | **Module:** Communication (Easy Com) / Timetable | **Frontend route:** `/front_desk/circular`, `/front_desk/circular/report` | **v1 status:** Complete

| Field | Value |
|---|---|
| Backend routes | TBD (front_desk circular routes) |
| Roles | Admin, Principal, Communication Staff |
| Last updated | 2026-11-04 |
| Source commit | 8fe500dc (FE) / 86261072 (BE) |

## 1. Purpose & users
Issue official school circulars to students, parents, or staff. Circulars are formal notices (academic calendar, holiday declarations, policy changes). Stored with type, target audience, and date.

## 2. Screens

### Create Circular (`/front_desk/circular`)
Form to create a new circular: title, type, date, content (rich text), attachment, target audience (all / standard / division), publish action.

### Circular Report (`/front_desk/circular/report`)
Paginated list of issued circulars with filters for date range and type. Supports PDF download of individual circulars.

AI Stack added in migration `2026_09_22_100200_add_circular_ai_stack_menu_category.php` with AI templates published in `2026_09_22_100100`.

## 3. Features & business rules

| Field | Type | Required | Validation | Default |
|---|---|---|---|---|
| Title | Text | Yes | — | — |
| Circular type | Dropdown | Yes | From `circular_type` table | — |
| Date | Date | Yes | — | Today |
| Content | Rich text | Yes | Sanitised via isomorphic-dompurify | — |
| Attachment | File | No | MAX_UPLOAD_BYTES | — |
| Target | Radio (All/Standard/Division) | Yes | — | All |

## 4. User flows
1. Open Create Circular.
2. Fill title, type, date, content.
3. Set target audience.
4. Optionally attach PDF.
5. Publish — circular stored and notification triggered.

## 5. Data model

| Table | Key columns | Notes |
|---|---|---|
| `circular` | id, sub_institute_id, title, circular_type_id, date, content, file, target, created_by, created_at | Main table |
| `circular_type` | id, sub_institute_id, name | Types e.g. Academic, Holiday, General |
| `fees_circular_master` | (separate) | Fees-specific circulars — different table |
| `fees_circular_log` | (separate) | Fees circular send log |

## 6. APIs
TBD — front_desk circular controller endpoints not read in this pass.

## 7. UI components & design tokens
- Rich text editor (Tiptap)
- `ErpPageHeader`, `ErpSection` from design system
- Lucide icons: TBD

## 8. Reports & exports
- `/front_desk/circular/report` — circular list with date filter
- Individual circular: PDF download

## 9. Test cases

| ID | Scenario | Steps | Expected result | Type |
|---|---|---|---|---|
| TC-CIRC-01 | Create circular for all students | Fill form, publish | Circular saved, visible in report | Happy |
| TC-CIRC-02 | Create circular for one division | Set target to division | Only that division sees it | Happy |
| TC-CIRC-03 | Missing required field | Submit without title | Validation error | Negative |

## 10. Known issues, limitations & FAQs
- **FAQ:** Is circular pushed to parents automatically? TBD — depends on notification trigger configuration.
- Fees circulars are a separate entity (`fees_circular_master`) and managed from the Fees module.

## 11. Sales notes
- Paperless circular distribution; auto-notification to parents and staff.
- Demo: create "Diwali holiday notice" → publish → all parents notified in one click.

## 12. v1 status & v2 ideas
- **Complete:** Create, list, report, PDF.
- **v2 ideas:** Acknowledgement tracking (parent confirms receipt), multi-language circulars.

## Source files
- `C:\rajesh\lms_k12\app\front_desk\circular\page.tsx`
- `F:\xampp\htdocs\next_lms_erp\database\migrations\2023_03_05_115658_create_circular_table.php`
- `F:\xampp\htdocs\next_lms_erp\database\migrations\2023_03_05_115658_create_circular_type_table.php`
- `F:\xampp\htdocs\next_lms_erp\database\migrations\2026_09_22_100200_add_circular_ai_stack_menu_category.php`

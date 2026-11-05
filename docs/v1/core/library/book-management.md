# Book Management
**Product:** Scholar Core | **Module:** Library | **Frontend route:** `/library/book_resources` | **v1 status:** Complete

| Field | Value |
|---|---|
| Backend routes | GET/POST/PUT/DELETE (via BookController, web routes) |
| Roles | Librarian, Admin |
| Last updated | 2026-11-04 |
| Source commit | 8fe500dc (FE) / 86261072 (BE) |

## 1. Purpose & users
Master catalog of all books and library items. Librarians add, edit and search books. Supports filtering by subject, author, publisher, ISBN/ISSN, classification number and item code. Each book record links to one or more physical item copies.

## 2. Screens

### Book Resources
Route: `/library/book_resources`
DataTables-powered list of all library books.
Filters: Subject, Publisher, Author, Item code, Classification no, ISBN/ISSN, Book status (issued/due/overdue).
Actions: Add, Edit, Delete, Print barcode (`/library/print_barcode`), Add remark (`/library/add_book_remark`).

### Print Barcode
Route: `/library/print_barcode`
Generates printable barcodes (PNG) for item codes via Picqer barcode library.

### Add Book Remark
Route: `/library/add_book_remark`
Adds a remark to a book record.

![](./screenshots/book-management.png)

## 3. Features & business rules

| Field | Type | Required | Validation | Default |
|---|---|---|---|---|
| Title | text | Yes | — | — |
| Author name | text | No | Grouped for filter | — |
| Publisher name | text | No | Grouped for filter | — |
| Subject | text | No | Grouped for filter | — |
| ISBN/ISSN | text | No | — | — |
| Classification no | text | No | — | — |
| Material resource type | text | No | Grouped for filter | — |
| Language | text | No | Grouped for filter | — |

**Book status filter values:** issued (issued_date NOT NULL AND return_date IS NULL), due (due_date = today AND return_date IS NULL), overdue (due_date < today AND return_date IS NULL) — computed via JOIN on library_book_circulations.

**Permissions:** Librarian and Admin can add/edit/delete.

## 4. User flows

**Add a book:**
1. Library -> Book resources -> Add.
2. Enter title, author, publisher, subject, ISBN, classification -> Save.
3. Add item copies (item code, barcode) via item management.
4. Print barcode labels for physical tagging.

**Search overdue books:**
1. Book resources -> Book status filter: Overdue -> Apply.

## 5. Data model

| Table | Key columns | Notes |
|---|---|---|
| library_books | id, title, author_name, publisher_name, subject, isbn_issn, classification, material_resource_type, language, sub_institute_id | Master catalog |
| library_items | id, library_book_id, item_code, sub_institute_id | Physical copies per book |
| library_book_circulations | id, library_item_id, student_id, issued_date, due_date, return_date, sub_institute_id | Issue/return log |
| mst_item_status | id, item_status_name, sub_institute_id | Item status lookup |

Relations: library_books hasMany library_items; library_items hasMany library_book_circulations.

## 6. APIs
Backend uses Laravel web routes (session-based, not JWT). DataTables AJAX: GET with request()->ajax() check in BookController::index().

| Method | Endpoint | Auth | Notes |
|---|---|---|---|
| GET | library/book_resources (DataTables AJAX) | Session | Paginated; supports column filters |
| POST | library/book_resources | Session | Add book |
| PUT | library/book_resources/{id} | Session | Edit book |
| DELETE | library/book_resources/{id} | Session | Delete book |
| POST | scan_books | Session (via /api/proxy) | Barcode scan |

Controller: BookController.php, itemScanController.php

## 7. UI components & design tokens
- fees-shared PageFrame, PageHeader, SectionPanel (reused by library pages)
- Lucide: Download, FileText, Printer, Search, Loader2
- Picqer barcode library (backend PNG generation)

## 8. Reports & exports
- Library Report: /library/report (see library-reports.md)
- Issue/Overdue Report: /library/issue_overdue_report
- Lost/Damage Report: /library/lost_damage_report
- Scanned Book Report: /library/scanned_book_report

## 9. Test cases

| ID | Scenario | Steps | Expected result | Type |
|---|---|---|---|---|
| BM-01 | Add a book | Enter all fields -> Save | Book appears in list | Happy |
| BM-02 | Search by author | Filter author name | Only matching books shown | Happy |
| BM-03 | Filter overdue | Book status = Overdue | Only books past due date with no return | Edge |
| BM-04 | Print barcode | Select item -> Print barcode | PNG barcode generated | Happy |
| BM-05 | Delete book with active issues | Try to delete a book currently issued | Should fail or warn | Negative |

## 10. Known issues, limitations & FAQs
- Library pages use session-based auth (backend web routes), not JWT API routes — different from most other modules.
- Book resources and scan_book pages both import from fees/_lib/fees-api.ts for session utilities (reuse by convention, not architecture).
- FAQ: How do I add more copies of a book? Add items (item codes) through the items sub-screen linked to the book record.

## 11. Sales notes
- Full library catalog with barcode-based circulation tracking.
- Demo: Add a book -> print barcode -> issue to student -> view overdue report.
- Pricing: TBD (included in Scholar Core).

## 12. v1 status & v2 ideas
- v1: Complete. CRUD, barcode, circulation all functional.
- v2: QR code support; bulk import from ISBN API; digital resource (ebook) support.

## Source files
- C:\rajesh\lms_k12\app\library\book_resources\page.tsx
- C:\rajesh\lms_k12\app\library\print_barcode\page.tsx
- C:\rajesh\lms_k12\app\library\add_book_remark\page.tsx
- F:\xampp\htdocs\next_lms_erp\app\Http\Controllers\library\BookController.php
- F:\xampp\htdocs\next_lms_erp\app\Models\LibraryBook.php
- F:\xampp\htdocs\next_lms_erp\app\Models\LibraryItem.php
- Migrations: 2023_06_01_234714_create_library_books_table.php, 2023_06_01_235854_create_library_items_table.php

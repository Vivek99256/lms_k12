# Circulation (Issue & Return)
**Product:** Scholar Core | **Module:** Library | **Frontend route:** `/library/quick_return` | **v1 status:** Complete

| Field | Value |
|---|---|
| Backend routes | POST/GET (via BookController, LibraryReportController, session-based) |
| Roles | Librarian, Admin |
| Last updated | 2026-11-04 |
| Source commit | 8fe500dc (FE) / 86261072 (BE) |

## 1. Purpose & users
Tracks the issue and return of library items (books) to students. Librarians issue a book by scanning/entering the item code, linking it to a student. Returns are logged with a return date. Quick return screen handles fast barcode-scan return workflows.

## 2. Screens

### Quick Return
Route: `/library/quick_return`
Quick return by item code — enter/scan item code, system logs return date.

### Issue (via book_resources or dedicated issue screen)
Issue is managed from the main book resources or through a DataTables action on a book record (LibraryReportController handles issue/return operations).

![](./screenshots/circulation.png)

## 3. Features & business rules

| Field | Type | Required | Validation | Notes |
|---|---|---|---|---|
| Item code | text/scan | Yes | Must exist in library_items | Accepts barcode scanner input |
| Student | select/search | Yes (issue) | Must exist in tblstudent | — |
| Issued date | date | Yes (issue) | — | Defaults to today |
| Due date | date | Yes (issue) | > issued_date | Set per library policy |
| Return date | date | Yes (return) | >= issued_date | Set on return |

**Rules:**
- An item cannot be issued if it already has an open circulation (issued_date NOT NULL, return_date IS NULL).
- Overdue = due_date < today AND return_date IS NULL.
- Quick return: scan item code -> system finds open circulation -> marks return_date = today.

**Permissions:** Librarian and Admin only.

## 4. User flows

**Issue a book:**
1. Library -> (book record or issue screen) -> Issue.
2. Select student, enter due date -> Confirm.
3. Circulation row created.

**Quick return:**
1. Library -> Quick return.
2. Scan or type item code -> Submit.
3. Return date stamped; circulation closed.

## 5. Data model

| Table | Key columns | Notes |
|---|---|---|
| library_book_circulations | id, library_item_id, student_id, issued_date, due_date, return_date, item_code, sub_institute_id | One row per issue transaction |
| library_items | id, library_book_id, item_code | Physical copy reference |

## 6. APIs
Session-based Laravel web routes. Direct AJAX calls via DataTables or form submit in BookController and LibraryReportController.

## 7. UI components & design tokens
- fees-shared PageFrame, PageHeader, SectionPanel, Field, InlineMessage (shared with fees and scan modules)
- Lucide: Loader2

## 8. Reports & exports
- Issue/Overdue Report: /library/issue_overdue_report
- Scanned Book Report: /library/scanned_book_report (see item-scan.md)

## 9. Test cases

| ID | Scenario | Steps | Expected result | Type |
|---|---|---|---|---|
| CI-01 | Issue a book | Select student + due date -> Issue | Circulation row created | Happy |
| CI-02 | Quick return | Scan item code with open circulation | Return date stamped | Happy |
| CI-03 | Issue already-issued book | Try to issue item with open circulation | Should warn/block | Negative |
| CI-04 | Return with wrong item code | Enter non-existent code | Error message | Negative |

## 10. Known issues, limitations & FAQs
- item_code was added to library_book_circulations in a later migration (2024_02_27) — older records may not have this column populated.
- FAQ: How do I see all currently issued books? Use Issue/Overdue Report filtered for no return date.

## 11. Sales notes
- Barcode-scanner-ready circulation desk workflow.
- Real-time overdue tracking.

## 12. v1 status & v2 ideas
- v1: Complete. Quick return, issue, overdue tracking all functional.
- v2: SMS/push notification for overdue reminders; self-checkout kiosk mode; fine calculation.

## Source files
- C:\rajesh\lms_k12\app\library\quick_return\page.tsx
- F:\xampp\htdocs\next_lms_erp\app\Http\Controllers\library\BookController.php
- F:\xampp\htdocs\next_lms_erp\app\Models\LibraryBookCirculation.php
- Migrations: 2023_06_18_165836_create_library_book_circulations_table.php, 2024_02_27_151323_add_column_item_code_library_book_circulation.php

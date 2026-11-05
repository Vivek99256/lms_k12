# Fee Collection
**Product:** Scholar Core | **Module:** Fees | **Frontend route:** `/fees/collect`, `/fees/collect/[studentId]` | **v1 status:** Complete

| Field | Value |
|---|---|
| Backend routes | `POST /fees/fees_collect/show_student`, `GET /fees/fees_collect/{studentId}/edit`, `POST /fees/fees_collect/{studentId}/update` |
| Roles | Admin, Accountant, Fees Collector |
| Last updated | 2026-11-04 |
| Source commit | 8fe500dc (FE) / 86261072 (BE) |

## 1. Purpose & users
Allows the accounts staff to search for students, view their fee dues, and collect payment. The main list screen shows all students with outstanding fees; the detail screen (per student) allows entering payment for one or more fee heads in a single receipt.

## 2. Screens

### Fee Collection List (`/fees/collect`)
Searchable, filterable list of all students and their fee status. Shows summary KPI cards above the table.

**Filters available:**
- Search: student name, GR No, mobile number, admission number
- Section / Standard / Division (via SearchDropdown)
- Status: All / overdue / partial / paid / due
- Include inactive students (checkbox)

**Table columns:** Student name + admission no, Class, Fee head, Due date, Pending amount, Status badge, Collect/View action.

**KPI summary cards (shown after first search):** Total payable, Total collected, Total outstanding, Paid students, Students with dues, Collection rate.

**Pagination:** 10 rows per page, server-side. Progressive streaming used — rows appear as they arrive from Laravel.

![](./screenshots/fees-collect-list.png)

### Fee Collection Detail (`/fees/collect/[studentId]`)
Per-student fee collection form. Data is pre-loaded from `sessionStorage` keyed `feesCollectData:{studentId}` (populated by the list screen before navigation).

**Actions:** Enter payment amount, select payment mode, generate receipt.

![](./screenshots/fees-collect-detail.png)

## 3. Features & business rules

**Search smart-routing (client-side, in `appendStudentSearchFilters`):**
| Input pattern | Sent as |
|---|---|
| Starts with `ADM-` | `grno` (admission format) |
| Exactly 10 digits | `mobile` |
| All digits | `grno` |
| Otherwise | `stu_name` |

**Fee status values:**

| Status | Meaning |
|---|---|
| `paid` | Full amount collected |
| `partial` | Some amount collected |
| `due` | Nothing collected yet, within due date |
| `overdue` | Nothing collected, past due date |

**Pagination:** 10 rows (`PAGE_SIZE`) per page, using server-side `page` / `per_page` / `limit` / `offset` params. The backend supports DataTables-style params (`draw`, `start`, `length`, `recordsTotal`).

**Include inactive:** Sends `including_inactive=Yes` to include TC'd / left students.

**localStorage keys read:** `userData` (token, sub_institute_id, host_name), `menuContext` (sub_institute_id), `selectedAcademicYear`.

**Receipt data handoff:** Before navigating to `/fees/collect/{studentId}`, fee data is fetched from `GET /fees/fees_collect/{studentId}/edit?...` and stored in `sessionStorage` as `feesCollectData:{studentId}`.

**Permission rules:**
- `api.session` middleware validates JWT.
- `check_permissions` enforces RBAC.

## 4. User flows

**Happy path — collect fee:**
1. Navigate to `/fees/collect`.
2. Enter student name or GR number, select class filters, click "Apply filters".
3. Table loads with student rows and status badges.
4. Click "Collect" on a student row.
5. Frontend calls `GET /fees/fees_collect/{studentId}/edit`, stores result in sessionStorage.
6. Navigates to `/fees/collect/{studentId}`.
7. Accountant enters amount and payment mode, submits.
8. Receipt is generated.

**Alternate — no results:**
- Empty state: "No dues found for the selected filters."

**Alternate — before first search:**
- Empty state: "Apply filters above to load student dues." (Performance optimization: list is not fetched on page mount.)

**Alternate — load more pages:**
- Next page button loads 10 more rows via `append: true` mode without clearing existing rows.

## 5. Data model

**Table: `fees_collect`**

| Column | Type | Notes |
|---|---|---|
| `id` | bigint | PK |
| `student_id` | int | FK → `tblstudent` |
| `term_id` | int | Month-year ID (e.g. `42024`) |
| `syear` | int | Academic year |
| `sub_institute_id` | int | Tenant |
| `receipt_no` | varchar | Auto-generated receipt number |
| `amount` | decimal | Total collected |
| `payment_mode` | varchar | Cash / Cheque / DD / Online |
| `bank_branch` | varchar | For cheque/DD |
| `cheque_no` | varchar | For cheque/DD |
| `bank_name` | varchar | For cheque/DD |
| `cheque_date` | date | For cheque/DD |
| `receiptdate` | date | Date of collection |
| `fine` | decimal | Late fee penalty |
| `fees_discount` | decimal | Discount applied |
| `is_deleted` | tinyint | Soft delete |
| `is_waved` | tinyint | Fee waiver flag |
| `tution_fee` through `title_12` | decimal | Per-head amounts (12 configurable heads + legacy named heads) |
| `created_by` | int | User who collected |
| `created_ip_address` | varchar | Collector's IP |
| `fees_html` | text | Receipt HTML snapshot |

**Related tables:** `fees_breakoff` (installment schedule), `fees_title` (fee head definitions), `tblstudent_enrollment` (grade/standard/division), `tblstudent` (name, GR no, mobile).

## 6. APIs

| Method | Endpoint | Auth | Request | Response |
|---|---|---|---|---|
| POST | `/fees/fees_collect/show_student` | JWT Bearer | `sub_institute_id`, `syear`, `stu_name`/`grno`/`mobile`, `grade`, `standard`, `division`, `status`, `page`, `per_page`, `including_inactive` | `{ stu_data: StudentRow[], total: int }` or DataTables format |
| GET | `/fees/fees_collect/{studentId}/edit` | JWT Bearer | `sub_institute_id`, `syear` as query params | Per-student fee detail JSON |

**Error cases:**
- `400` — missing required params.
- `401` — expired/missing JWT.
- `404` — student not found.
- Network error shown as amber inline banner.

## 7. UI components & design tokens

| Component | Source |
|---|---|
| `SearchDropdown` | `components/search-dropdown` |
| `Button` | `components/ui/button` |
| `Card`, `CardContent`, `CardHeader`, `CardTitle` | `components/ui/card` |
| `MetricCard` | Inline in `page.tsx` |
| `StatusBadge` | Inline in `page.tsx` |
| `SortableHeader` | Inline in `page.tsx` |
| `Loader2`, `Search`, `ReceiptText`, `Eye`, etc. | lucide-react |

**Currency formatting:** `Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' })`.

## 8. Reports & exports
See [../reports/collection-report.md](../reports/collection-report.md) for the Fee Collection Report.

## 9. Test cases

| ID | Scenario | Steps | Expected result | Type |
|---|---|---|---|---|
| FC-01 | Search by name | Type student name, click Apply | Matching students appear | Happy |
| FC-02 | Search by 10-digit mobile | Enter mobile, click Apply | Correct student shown | Happy |
| FC-03 | Filter by overdue status | Select status = overdue, Apply | Only overdue rows shown | Happy |
| FC-04 | Collect fee for student | Click Collect on a row | Navigates to `/fees/collect/{id}` | Happy |
| FC-05 | No session data | Clear localStorage, navigate | Error message shown | Negative |
| FC-06 | Load more pages | Go to page 2 | Next 10 rows append to list | Happy |
| FC-07 | Include inactive | Check "In-active", Apply | TC'd students appear | Edge |

## 10. Known issues, limitations & FAQs

- Server-side filtering is authoritative; client adds only status and fee-head filters. Prior double-filtering bug (search emptied results) was fixed — the code comment explains the history.
- `fees_html` column stores a full HTML snapshot of each receipt — large, not queryable.
- `title_1` through `title_12` are dynamic fee-head columns; their labels come from `fees_title` master, not from column names.
- No bulk-collect action on the list screen (select multiple students → collect in one go) — v2 idea.

**FAQ:**
- *"Student doesn't appear in search"* — check the enrollment record exists in `tblstudent_enrollment` for the current year.
- *"Collect button is spinner and doesn't navigate"* — the `GET /fees/fees_collect/{id}/edit` call failed; check JWT and sub_institute_id.

## 11. Sales notes

**Selling points:**
1. Progressive streaming: list appears as data arrives, no waiting for full query.
2. Smart search routing — type a name, GR No, or mobile; the system routes automatically.
3. Per-student receipt with configurable fee heads (up to 12 custom titles).

**Demo flow (4 steps):**
1. Go to Fees → Collect fee.
2. Type a student name, select class → Apply filters.
3. Show KPI summary cards (total payable, collected, outstanding).
4. Click Collect on a row — show per-student fee detail page.

## 12. v1 status & v2 ideas

**v1 complete:** List with filters, progressive streaming, KPI cards, navigate-to-collect.
**v1 partial:** Bulk collection (multi-select → collect) is not implemented.
**v2 ideas:**
- Bulk collect for selected students.
- WhatsApp/SMS receipt after collection from this screen.
- Export visible list to Excel.

## Source files
- `C:\rajesh\lms_k12\app\fees\collect\page.tsx`
- `C:\rajesh\lms_k12\app\fees\collect\[studentId]\page.tsx`
- `C:\rajesh\lms_k12\app\fees\_lib\fees-api.ts` (referenced)
- `F:\xampp\htdocs\next_lms_erp\app\Http\Controllers\fees\fees_collect\fees_collect_controller.php`
- `F:\xampp\htdocs\next_lms_erp\app\Models\fees\fees_collect\fees_collect.php`

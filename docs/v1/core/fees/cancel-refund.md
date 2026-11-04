# Cancel & Refund
**Product:** Scholar Core | **Module:** Fees | **Frontend route:** `/fees/cancel-refund` | **v1 status:** Complete

| Field | Value |
|---|---|
| Backend routes | `POST /api/fees-cancel/search`, `POST /fees/fees_cancel/index`, `POST /fees/fees_cancel/create`, `POST /fees/fees_refund/save` |
| Roles | Admin, Accountant, Super Admin |
| Last updated | 2026-11-04 |
| Source commit | 8fe500dc (FE) / 86261072 (BE) |

## 1. Purpose & users
Allows the accounts team to cancel a previously issued fee receipt or process a refund for an overpayment. Used when a wrong amount was collected, a student has left, or a cheque bounced.

## 2. Screens

### Cancel & Refund (`/fees/cancel-refund`)
Search for a student's receipts, then cancel or initiate a refund.

**Search fields:** Student name, GR No, enrollment no, standard, division.
**Receipt table columns:** Receipt no, Student, Enrollment no, Grade, Standard, Division, Total amount, Receipt date, Payment mode, Fee type (REGULAR / OTHER), Actions (Cancel / Refund / View).

**Actions:**
- **Cancel** — marks the receipt as cancelled; creates a row in `fees_cancel`.
- **Refund** — processes a refund back to the student; creates a row in `fees_refund`.
- **View** — opens the receipt preview (sanitized HTML from `fees_html`).

![](./screenshots/fees-cancel-refund.png)

## 3. Features & business rules

**Receipt types handled:**
- `REGULAR` — regular fee receipt (from `fees_collect`)
- `OTHER` — other/additional fee receipt (from `fees_other_collection`)

**Cancel fields (`fees_cancel` table):**

| Field | Type | Required | Notes |
|---|---|---|---|
| `reciept_id` | int | Yes | FK → `fees_collect.id` |
| `cancel_type` | varchar | Yes | Type of cancellation |
| `cancel_remark` | text | Yes | Reason for cancellation |
| `cancelled_by` | int | Yes | User who cancelled |
| `cancel_date` | date | Yes | Auto-set to today |
| `amountpaid` | decimal | Yes | From original receipt |
| `syear` | int | Yes | Academic year |
| `sub_institute_id` | int | Yes | Tenant |

**Refund fields (`fees_refund` table):** Same structure as `fees_collect` with same head columns (`tution_fee` through `title_12`), representing the amount being refunded.

**Receipt HTML is sanitized** using `sanitizeHtml` (via `isomorphic-dompurify`) before display — no raw `dangerouslySetInnerHTML`.

**Cancel is not a soft-delete of `fees_collect`** — it creates a separate `fees_cancel` record. The original receipt row remains with `is_deleted = 0`; cancellation is tracked via `fees_cancel.reciept_id`.

**Imprest cancel** (`imprestFeesCancelController`) handles cancellation for imprest/petty-cash-type fees — separate flow, same screen routing.

## 4. User flows

**Happy path — cancel a receipt:**
1. Navigate to `/fees/cancel-refund`.
2. Search for student by name or GR No.
3. Table loads matching receipts.
4. Click Cancel on a receipt.
5. Enter cancel type and remark, confirm.
6. `POST /api/fees-cancel/search` → `feesCancelController::create` saves `fees_cancel` row.
7. Success toast shown; receipt row updates to show cancelled status.

**Happy path — refund:**
1. Same search, click Refund.
2. Enter refund amount per head and payment mode.
3. Submit → `feesRefundController` saves `fees_refund` row.
4. Receipt is generated for the refund.

**Alternate — no receipts found:**
- Empty state shown.

## 5. Data model

**Table: `fees_cancel`**

| Column | Type | Notes |
|---|---|---|
| `id` | bigint | PK |
| `reciept_id` | int | FK → `fees_collect.id` (note typo in column name) |
| `syear` | int | Academic year |
| `sub_institute_id` | int | Tenant |
| `student_id` | int | FK → `tblstudent` |
| `standard_id` | int | FK → `standard` |
| `term_id` | int | Month-year key |
| `amountpaid` | decimal | Amount cancelled |
| `received_date` | date | Original receipt date |
| `cancel_date` | date | Cancellation date |
| `cancel_type` | varchar | Type of cancel |
| `cancel_remark` | text | Reason |
| `cancelled_by` | int | FK → user |
| `ip_address` | varchar | Canceller's IP |

**Table: `fees_refund`** — Same structure as `fees_collect` (all head columns). `receipt_no` is a new refund receipt number.

**Table: `fees_other_collection`** (for OTHER type receipts):

| Column | Type | Notes |
|---|---|---|
| `receipt_id` | int | PK |
| `deduction_head_id` | int | FK → `other_fees_title` |
| `deduction_amount` | decimal | Amount |
| `payment_mode` | varchar | Cash / Cheque / DD / Online |
| `is_deleted` | tinyint | Soft delete |

## 6. APIs

| Method | Endpoint | Auth | Request | Response |
|---|---|---|---|---|
| POST | `/api/fees-cancel/search` | JWT | `sub_institute_id`, `syear`, `first_name`/`last_name`/`grno`/`enrollment_no`, `standard`, `division` | `{ data: CancelReceiptRow[] }` |
| POST | `/fees/fees_cancel/create` | JWT | Receipt id, cancel type, remark | `{ status_code, message }` |
| POST | `/fees-refund/search` | JWT | `sub_institute_id`, `syear`, `studentId` | Refund-eligible receipts |
| POST | `/fees-refund/save` | JWT | Refund amounts per head, `payment_mode` | `{ status_code, message, receipt_no }` |

## 7. UI components & design tokens

| Component | Source |
|---|---|
| `Table`, `TableBody`, `TableHead`, etc. | `components/ui/table` |
| `Button` | `components/ui/button` |
| `Input`, `Label`, `Textarea` | `components/ui/` |
| `SearchDropdown` | `components/search-dropdown` |
| `AiFieldAssistant` | `components/ai/AiFieldAssistant` |
| `sanitizeHtml` | `lib/security/sanitize-html` (wraps dompurify) |
| Icons | lucide-react (Ban, CheckCircle2, Eye, WalletCards, etc.) |

## 8. Reports & exports
See [../reports/collection-report.md](../reports/collection-report.md) — cancellation data included in the report via `feesCancelReportController`.

## 9. Test cases

| ID | Scenario | Steps | Expected result | Type |
|---|---|---|---|---|
| FCR-01 | Cancel regular receipt | Search student → Cancel → enter remark → submit | `fees_cancel` row created; receipt shows cancelled | Happy |
| FCR-02 | Cancel OTHER fees receipt | Same for an OTHER type receipt | Same, using `other_fees_cancel` flow | Happy |
| FCR-03 | Refund processing | Click Refund → enter amounts → submit | `fees_refund` row created; refund receipt generated | Happy |
| FCR-04 | View receipt HTML | Click View | Sanitized HTML shown; no raw script tags | Happy |
| FCR-05 | Cancel already-cancelled receipt | Attempt to cancel same receipt twice | TBD — no unique constraint found in model | Negative |
| FCR-06 | Refund amount > original | Enter refund > original collected | TBD — backend validation not confirmed | Negative |

## 10. Known issues, limitations & FAQs

- `reciept_id` column name is a typo (should be `receipt_id`) — preserved for backward compatibility.
- No unique constraint on `fees_cancel(reciept_id)` found in model — double cancellation may be possible.
- Refund flow for OTHER fees uses `other_fees_cancel_controller` separately; both flows are on the same screen.

**FAQ:**
- *"Receipt not appearing in cancel search"* — the receipt may be from a different academic year (`syear`).
- *"Can I undo a cancellation?"* — no undo in v1. The `fees_cancel` row would need to be manually deleted from DB.

## 11. Sales notes

**Selling points:**
1. Separate audit trail — original receipt is never deleted; cancellation is a separate record with remark and actor.
2. Handles both regular and other fee types in one screen.
3. Refund receipt generation with same configurable template.

**Demo flow (3 steps):**
1. Search a student, show receipt list.
2. Click Cancel — enter reason — confirm.
3. Show that the original receipt still exists and the cancellation has a timestamp and user.

## 12. v1 status & v2 ideas

**v1 complete:** Cancel and refund for regular and other fees. Receipt HTML preview.
**v1 partial:** Validation for refund amount vs original amount not confirmed in code.
**v2 ideas:**
- Approval workflow before cancel (maker/checker).
- Refund amount cannot exceed original — add backend validation.
- Fix `reciept_id` column name in a migration.

## Source files
- `C:\rajesh\lms_k12\app\fees\cancel-refund\page.tsx`
- `F:\xampp\htdocs\next_lms_erp\app\Http\Controllers\fees\fees_cancel\feesCancelController.php`
- `F:\xampp\htdocs\next_lms_erp\app\Http\Controllers\fees\fees_cancel\feesRefundController.php`
- `F:\xampp\htdocs\next_lms_erp\app\Http\Controllers\fees\imprest_fees_cancel\imprestFeesCancelController.php`
- `F:\xampp\htdocs\next_lms_erp\app\Models\fees\fees_cancel\feesCancelModel.php`
- `F:\xampp\htdocs\next_lms_erp\app\Models\fees\fees_cancel\feesRefundModel.php`
- `F:\xampp\htdocs\next_lms_erp\app\Models\fees\other_fees_cancel\other_fees_cancel.php`
- `F:\xampp\htdocs\next_lms_erp\routes\api.php` (line 594)

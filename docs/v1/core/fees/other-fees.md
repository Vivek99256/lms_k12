# Other Fees
**Product:** Scholar Core | **Module:** Fees | **Frontend route:** `/fees/other_fees_collect`, `/fees/other_fees_cancel` | **v1 status:** Complete

| Field | Value |
|---|---|
| Backend routes | `POST /fees/other_fees_collect/index`, `POST /fees/other_fees_collect/store`, `POST /fees/other_fees_cancel/index`, `POST /fees/other_fees_cancel/store` |
| Roles | Admin, Accountant |
| Last updated | 2026-11-04 |
| Source commit | 8fe500dc (FE) / 86261072 (BE) |

## 1. Purpose & users
Handles collection and cancellation of one-off or additional fees that fall outside the regular fee schedule: uniform fees, trip fees, book fees, fine, etc. Used by accountants throughout the year for ad-hoc charges.

## 2. Screens

### Other Fees Collection (`/fees/other_fees_collect`)
Search a student, select an other-fee type, enter amount, collect.

### Other Fees Cancellation (`/fees/other_fees_cancel`)
Search for an other-fees receipt and cancel it, with a remark.

![](./screenshots/fees-other.png)

## 3. Features & business rules

**Other fee head defined in `other_fees_title`:**

| Field | Type | Required | Notes |
|---|---|---|---|
| `deduction_head_name` | varchar | Yes | Name shown to accountant (e.g. "Uniform Fee") |
| `syear` | int | Yes | Academic year |
| `sub_institute_id` | int | Yes | Tenant |
| `is_deleted` | tinyint | — | Soft delete |

**Collection fields (`fees_other_collection` / `other_fees_collect` model):**

| Field | Type | Required | Notes |
|---|---|---|---|
| `student_id` | int | Yes | FK → `tblstudent` |
| `deduction_head_id` | int | Yes | FK → `other_fees_title` |
| `deduction_amount` | decimal | Yes | Amount collected |
| `deduction_remarks` | text | No | Optional note |
| `payment_mode` | varchar | Yes | Cash / Cheque / DD / Online |
| `bank_name` | varchar | No | For cheque/DD |
| `bank_branch` | varchar | No | For cheque/DD |
| `cheque_dd_no` | varchar | No | For cheque/DD |
| `cheque_dd_date` | date | No | For cheque/DD |
| `deduction_date` | date | Yes | Date of collection |
| `is_deleted` | tinyint | — | Soft delete |
| `receipt_id` | int | — | Auto-generated receipt number |
| `created_by` | int | — | User |
| `paid_fees_html` | text | — | Receipt HTML snapshot |

**Cancellation (`other_fees_cancel` model):** Records the reversal; `other_fees_collect.is_deleted` is set to 1.

**Other fee mapping (`other_fee_map`):** Maps which other fee types apply to which standards/divisions.

## 4. User flows

**Happy path — collect other fee:**
1. Navigate to `/fees/other_fees_collect`.
2. Search for student by name or GR No.
3. Select other fee type from dropdown.
4. Enter amount, payment mode, date.
5. Submit → `other_fees_collect_controller::store`.
6. Receipt generated with `paid_fees_html`.

**Happy path — cancel other fee:**
1. Navigate to `/fees/other_fees_cancel`.
2. Search for other-fees receipt.
3. Enter cancellation remark, submit.
4. `other_fees_cancel` row created; `fees_other_collection.is_deleted = 1`.

## 5. Data model

**Table: `fees_other_collection`** — See field table in section 3.

**Table: `other_fees_title`**

| Column | Type | Notes |
|---|---|---|
| `id` | bigint | PK |
| `deduction_head_name` | varchar | Fee type name |
| `syear` | int | Academic year |
| `sub_institute_id` | int | Tenant |
| `is_deleted` | tinyint | Soft delete |

**Table: `other_fees_cancel`** — Tracks cancelled other-fees receipts (mirror of `fees_cancel`).

## 6. APIs

| Method | Endpoint | Auth | Notes |
|---|---|---|---|
| POST | `/fees/other_fees_collect/index` | JWT | List/search students for other fees |
| POST | `/fees/other_fees_collect/store` | JWT | Save other fee collection |
| POST | `/fees/other_fees_cancel/index` | JWT | Search for other fee receipts |
| POST | `/fees/other_fees_cancel/store` | JWT | Cancel other fee receipt |

## 7. UI components & design tokens
TBD — these screens use legacy Blade views wrapped in the Next.js route.

## 8. Reports & exports
See `docs/v1/core/REPORTS.md` → Other Fees Report (`otherfeesReportController`, `otherNewfeesReportController`, `otherNew_CancelFeesReportController`).

## 9. Test cases

| ID | Scenario | Steps | Expected result | Type |
|---|---|---|---|---|
| FOF-01 | Collect uniform fee | Search student → select "Uniform Fee" → enter ₹500 → submit | Receipt generated | Happy |
| FOF-02 | Cancel other fee | Search receipt → enter remark → submit | `is_deleted = 1`; cancellation record created | Happy |
| FOF-03 | Invalid amount | Enter negative amount | TBD — validation not confirmed | Negative |
| FOF-04 | Fee type not mapped | Select a head not mapped to student's standard | TBD | Edge |

## 10. Known issues, limitations & FAQs

- `paid_fees_html` stores full receipt HTML per row — high disk usage on large institutes.
- No approval workflow for other-fees cancellation in v1.

**FAQ:**
- *"Other fee type not appearing in dropdown"* — ensure the type is created in Other Fees Title master and mapped to the student's standard.

## 11. Sales notes

**Selling points:**
1. Unlimited other fee types — uniform, trip, library, fine, etc.
2. Full receipt for every other-fees transaction.
3. Cancel with remark maintains clean audit trail.

**Demo flow:**
1. Go to Other Fees Collect → search student → show fee type dropdown.
2. Enter trip fee, submit → show receipt.

## 12. v1 status & v2 ideas

**v1 complete:** Collection, cancellation, receipt.
**v2 ideas:**
- Bulk other-fee collection for a whole class (e.g. trip fee for Class 7A).
- Online payment option for other fees.

## Source files
- `C:\rajesh\lms_k12\app\fees\other_fees_collect\page.tsx`
- `C:\rajesh\lms_k12\app\fees\other_fees_cancel\page.tsx`
- `F:\xampp\htdocs\next_lms_erp\app\Http\Controllers\fees\other_fees_collect\other_fees_collect_controller.php`
- `F:\xampp\htdocs\next_lms_erp\app\Http\Controllers\fees\other_fees_cancel\other_fees_cancel_controller.php`
- `F:\xampp\htdocs\next_lms_erp\app\Models\fees\other_fees_collect\other_fees_collect.php`
- `F:\xampp\htdocs\next_lms_erp\app\Models\fees\other_fees_cancel\other_fees_cancel.php`
- `F:\xampp\htdocs\next_lms_erp\app\Models\fees\other_fees_title\other_fees_title.php`

# Fees Master Setup
**Product:** Scholar Core | **Module:** Fees | **Frontend route:** `/fees/master-setup`, `/fees/master/*` | **v1 status:** Complete

| Field | Value |
|---|---|
| Backend routes | `POST /fees/fees_title/...`, `POST /fees/fees_config_master/...`, `POST /fees/fees_late_master/...`, `POST /fees/fees_month_header/...`, `POST /fees/other_fees_title/...` |
| Roles | Admin, Super Admin |
| Last updated | 2026-11-04 |
| Source commit | 8fe500dc (FE) / 86261072 (BE) |

## 1. Purpose & users
Defines the foundation of the fees system: fee head names, amounts per standard, late-fee rules, receipt template, NACH/bank config, and other fee types. Set up once per academic year by the admin before any fee collection begins.

## 2. Screens

### Fee Head (Title) Master (`/fees/master/fees-title` or via `/fees/master-setup`)
Create and manage fee heads (e.g. Tuition Fee, Activity Fee, Deposit). Each head maps to a column in `fees_collect` (`title_1` through `title_12`).

### Fees Config Master (`/fees/master/fees-config-master`)
Institute-level fee settings: late fee amount, SMS/email on collection, receipt template, bank details for NACH, PAN number.

### Late Fee Master (`/fees/master/fees-late-master`)
Grace period days and late fee penalty rules per standard.

### Fees Month Header (`/fees/master/fees-month-header`)
Defines which months (term_ids) are active for fee collection in the current academic year.

### Additional Fees Mapping (`/fees/master/additional-fees-mapping`)
Maps other/additional fee types to standards and divisions.

### Fees Breakoff (`/fees/master/fees-breakoff`)
Defines the installment schedule: how much of each fee head is due in each month.

![](./screenshots/fees-master-setup.png)

## 3. Features & business rules

**`fees_config_master` fields:**

| Field | Type | Required | Notes |
|---|---|---|---|
| `late_fees_amount` | decimal | No | Flat late fee penalty amount |
| `send_sms` | tinyint | No | 1 = send SMS on collection |
| `send_email` | tinyint | No | 1 = send email on collection |
| `fees_receipt_template` | varchar | Yes | Receipt paper size (A5, A4, etc.) |
| `fees_bank_challan_template` | varchar | No | Bank challan template |
| `fees_receipt_note` | text | No | Footer note printed on receipt |
| `institute_name` | varchar | Yes | Printed on receipt |
| `pan_no` | varchar | No | Institute PAN for NACH |
| `account_to_be_credited` | varchar | No | Bank account for NACH |
| `cms_client_code` | varchar | No | NACH CMS client code |
| `auto_head_counting` | tinyint | No | Auto-increment head count |
| `nach_account_type` | varchar | No | SB / CA |
| `nach_registration_charge` | decimal | No | NACH registration fee |
| `nach_transaction_charge` | decimal | No | NACH per-transaction fee |
| `nach_failed_charge` | decimal | No | NACH bounce fee |
| `bank_logo` | varchar | No | Bank logo file path |
| `syear` | int | Yes | Academic year |
| `sub_institute_id` | int | Yes | Tenant |

**Fee heads:** Up to 12 custom heads (`title_1`–`title_12`) plus legacy named columns (`tution_fee`, `admission_fee`, `activity_fee`, `term_fee`, `deposit`, `co_curriculam_fees`, `computer_fees`, `smart_class`, `security_charges`, `photograph`, `cal_misc`).

**Fee head type master (`tblfeesHeadTypeMasterModel`):** Classifies fee heads into types for reporting.

**Breakoff rule:** `fees_breakoff` table stores per-head per-month installment amounts. The helper `FeeBreackoff()` reads this to compute what is due in a given month.

## 4. User flows

**Happy path — set up fees for a new academic year:**
1. Admin goes to Fees → Master Setup.
2. Opens Fee Head (Title) Master → creates/edits fee heads with amounts per standard.
3. Opens Fees Config Master → sets receipt template, SMS/email flags, bank/NACH config.
4. Opens Late Fee Master → sets grace days and penalty.
5. Opens Fees Month Header → activates months for the year.
6. Opens Fees Breakoff → distributes head amounts across months.
7. Saves. System is ready for collection.

**Map Year (`/fees/map_year`):** Copies fee structure from one academic year to another. Used during annual rollover.

## 5. Data model

**Table: `fees_config_master`** — See field table in section 3.

**Table: `fees_title`**

| Column | Type | Notes |
|---|---|---|
| `id` | bigint | PK |
| `syear` | int | Academic year |
| `sub_institute_id` | int | Tenant |
| `title_name` | varchar | Fee head label shown on receipt |
| `grade_id` | int | Applies to this section/grade |
| `standard_id` | int | Applies to this standard |
| (amount columns) | decimal | Amounts per head per standard |

**Table: `fees_breakoff`**

| Column | Type | Notes |
|---|---|---|
| `month_id` | int | Month-year key |
| `syear` | int | Academic year |
| `sub_institute_id` | int | Tenant |
| (head amount columns) | decimal | Installment amounts per head |

**Table: `other_fees_title`** — Defines other/additional fee types (uniform, trip, etc.)

| Column | Type | Notes |
|---|---|---|
| `id` | bigint | PK |
| `syear` | int | Academic year |
| `sub_institute_id` | int | Tenant |
| `deduction_head_name` | varchar | Fee type name |
| `is_deleted` | tinyint | Soft delete |

## 6. APIs

| Method | Endpoint | Auth | Notes |
|---|---|---|---|
| POST | `/fees/fees_title/index` | JWT | List fee heads |
| POST | `/fees/fees_title/store` | JWT | Create fee head |
| POST | `/fees/fees_title/update` | JWT | Update fee head |
| POST | `/fees/fees_config_master/store` | JWT | Save config |
| POST | `/fees/fees_late_master/store` | JWT | Save late fee rule |
| POST | `/fees/fees_month_header/store` | JWT | Activate month |
| POST | `/fees/other_fees_title/store` | JWT | Create other fee type |
| POST | `/fees/map_year` | JWT | Copy year structure |

## 7. UI components & design tokens
TBD — master setup uses legacy PHP Blade views rendered inside the Next.js iframe pattern. The new `/fees/master-setup` Next.js route wraps these.

## 8. Reports & exports
See [../reports/collection-report.md](../reports/collection-report.md) — fee structure report uses `fees_title` as its source.

## 9. Test cases

| ID | Scenario | Steps | Expected result | Type |
|---|---|---|---|---|
| FM-01 | Create a fee head | Add title, amount for Std 1 | Head appears in collection screen | Happy |
| FM-02 | Save config with SMS on | Set `send_sms=1`, save | SMS sent on next collection | Happy |
| FM-03 | Map year | Select source year → destination year | Fee heads copied | Happy |
| FM-04 | Add late fee rule | Set 5 days grace, ₹50 penalty | Collection screen shows penalty after grace | Happy |
| FM-05 | Duplicate fee head | Create same head twice | TBD — no unique constraint found | Negative |

## 10. Known issues, limitations & FAQs

- `tution_fee` column name is a typo for "tuition fee" — preserved for backward compatibility.
- Up to 12 custom fee heads. If an institute needs more than 12, the schema must be extended.
- `fees_html` receipt snapshot duplicates data — disk usage grows with every receipt.

**FAQ:**
- *"Fee head doesn't appear in collection screen"* — ensure it is mapped to the correct `syear` and `sub_institute_id`.
- *"Map year didn't copy late fee rules"* — `tblfeesLateModel` rows must be copied separately; the map-year feature copies `fees_title` only.

## 11. Sales notes

**Selling points:**
1. Fully configurable fee heads — up to 12 custom heads plus 11 legacy heads.
2. NACH-ready config: registration/transaction/bounce charges, CMS client code stored in one place.
3. Annual rollover in one step via Map Year.

**Demo flow (3 steps):**
1. Go to Fees → Master Setup → show fee heads defined for each standard.
2. Open Config Master — show receipt template picker and bank details.
3. Show Fees Breakoff — installment schedule across months.

## 12. v1 status & v2 ideas

**v1 complete:** Fee head master, config master, late fee master, breakoff, map year, other fees title.
**v1 partial:** New Next.js `/fees/master-setup` route is a wrapper; underlying screens are still Blade.
**v2 ideas:**
- Native Next.js fee head setup form.
- Increase fee head limit beyond 12 via a proper `fee_heads` join table.
- Validation: prevent activating a month without a breakoff entry.

## Source files
- `C:\rajesh\lms_k12\app\fees\master-setup\page.tsx`
- `C:\rajesh\lms_k12\app\fees\master\` (subdirectories)
- `F:\xampp\htdocs\next_lms_erp\app\Http\Controllers\fees\tblfeesConfigController.php`
- `F:\xampp\htdocs\next_lms_erp\app\Http\Controllers\fees\tblfeesLateController.php`
- `F:\xampp\htdocs\next_lms_erp\app\Http\Controllers\fees\fees_title\fees_title_controller.php`
- `F:\xampp\htdocs\next_lms_erp\app\Http\Controllers\fees\fees_month_header\feesMonthHeadercontroller.php`
- `F:\xampp\htdocs\next_lms_erp\app\Models\fees\tblfeesConfigModel.php`
- `F:\xampp\htdocs\next_lms_erp\app\Models\fees\fees_title\fees_title.php`
- `F:\xampp\htdocs\next_lms_erp\app\Models\fees\fees_breackoff\fees_breackoff.php`
- `F:\xampp\htdocs\next_lms_erp\app\Models\fees\other_fees_title\other_fees_title.php`

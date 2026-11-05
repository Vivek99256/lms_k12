# NACH (Bank Mandate — S1 to S4)
**Product:** Scholar Core | **Module:** Fees | **Frontend routes:** `/fees/NACH_s1excel_export`, `/fees/NACH_s2excel_import`, `/fees/NACH_s3excel_export`, `/fees/NACH_s4excel_import` | **v1 status:** Complete

| Field | Value |
|---|---|
| Backend routes | `GET/POST /fees/NACH/s1_excel_export`, `POST /fees/NACH/s2_excel_import`, `GET/POST /fees/NACH/s3_excel_export`, `POST /fees/NACH/s4_excel_import` |
| Roles | Admin, Accountant |
| Last updated | 2026-11-04 |
| Source commit | 8fe500dc (FE) / 86261072 (BE) |

## 1. Purpose & users
Implements the National Automated Clearing House (NACH) mandate flow for auto-debit fee collection from parent bank accounts. Banks require a specific Excel format for mandate registration (S1/S2) and transaction execution (S3/S4). Used by the accounts team and bank liaison officer.

## 2. Screens

### NACH S1 — Mandate Registration Export (`/fees/NACH_s1excel_export`)
Generates the Excel file to submit to the bank for NACH mandate registration. Contains student and parent bank account details.

### NACH S2 — Mandate Registration Import (`/fees/NACH_s2excel_import`)
Imports the bank's response Excel (approved/rejected mandates) back into the system.

### NACH S3 — Transaction Export (`/fees/NACH_s3excel_export`)
Generates the Excel file of debit instructions to send to the bank for a given collection cycle.

### NACH S4 — Transaction Result Import (`/fees/NACH_s4excel_import`)
Imports the bank's transaction result Excel (success/failed debits) and updates `fees_collect` accordingly.

![](./screenshots/fees-nach.png)

## 3. Features & business rules

**NACH config (from `fees_config_master`):**

| Field | Notes |
|---|---|
| `pan_no` | Institute PAN — printed on mandate |
| `account_to_be_credited` | Institute bank account |
| `cms_client_code` | Bank-issued CMS client code |
| `nach_account_type` | SB (Savings) / CA (Current) |
| `nach_registration_charge` | Bank registration fee per mandate |
| `nach_transaction_charge` | Bank per-debit transaction fee |
| `nach_failed_charge` | Bank bounce/failed debit charge |

**Bank master (`bankmasterModel`):** Stores bank names and IFSC codes for validation.

**AC type master (`ac_typeModel`):** Account type lookup (SB/CA/CC/NRE/NRO etc.).

**S1 export logic (from `s1excel_exportController`):**
- Reads student + parent bank account details from NACH tables.
- Filters by `sub_institute_id`, `syear`, date range (`from_date`, `to_date`).
- Uses PHPExcel library to generate `.xlsx`.

**S2 import logic:** Reads bank response Excel, matches rows by mandate reference, updates mandate status (approved/rejected).

**S3 export logic:** Similar to S1 but for transaction debit instructions.

**S4 import logic:** Matches transaction results, marks successful debits as collected in `fees_collect`.

## 4. User flows

**NACH mandate cycle (full flow):**
1. Admin configures NACH settings in Fees → Master Setup (CMS code, bank account, charges).
2. **S1 Export:** Go to `/fees/NACH_s1excel_export`, select batch parameters, download Excel.
3. Submit Excel to bank.
4. **S2 Import:** Receive bank response Excel, go to `/fees/NACH_s2excel_import`, upload file. System updates mandate status.
5. **S3 Export:** At collection date, go to `/fees/NACH_s3excel_export`, generate debit instruction Excel. Submit to bank.
6. **S4 Import:** Bank sends result Excel. Go to `/fees/NACH_s4excel_import`, upload. System creates `fees_collect` rows for successful debits.

## 5. Data model

**Tables (from migrations `create_fees_NACH_*`, exact names from migration files):**
- NACH student mandate records (bank account, IFSC, mandate reference, status)
- NACH transaction records (debit date, amount, status)
- `fees_collect` — final row created on S4 import for successful debits

**Models:**
- `bankmasterModel` — `fees_bank_master` table
- `ac_typeModel` — `fees_nach_ac_type` table (or similar)

## 6. APIs

| Method | Endpoint | Auth | Notes |
|---|---|---|---|
| GET/POST | `/fees/NACH/s1_excel_export` | JWT | Filter params → returns `.xlsx` download |
| POST | `/fees/NACH/s2_excel_import` | JWT | Multipart file upload |
| GET/POST | `/fees/NACH/s3_excel_export` | JWT | Filter params → returns `.xlsx` download |
| POST | `/fees/NACH/s4_excel_import` | JWT | Multipart file upload |

## 7. UI components & design tokens
TBD — these screens use legacy Blade views. The Next.js routes are thin wrappers that render the Blade views inside the frame.

**Note:** PHPExcel library is used in backend (legacy library — `require('excel_upload/PHPExcel.php')`). This is a deprecated library; v2 should migrate to PhpSpreadsheet.

## 8. Reports & exports
The S1 and S3 steps themselves produce Excel exports. No separate report docs for NACH — data is included in the main collection report when S4 completes.

## 9. Test cases

| ID | Scenario | Steps | Expected result | Type |
|---|---|---|---|---|
| FN-01 | S1 Export | Select date range → download | Excel with correct student/bank columns | Happy |
| FN-02 | S2 Import — all approved | Upload bank response with all mandates approved | All mandate statuses updated to approved | Happy |
| FN-03 | S2 Import — some rejected | Upload with mixed results | Rejected mandates flagged | Edge |
| FN-04 | S4 Import — successful debits | Upload result file | `fees_collect` rows created for each success | Happy |
| FN-05 | S4 Import — bounce | Upload with some failed | Failed rows flagged; `nach_failed_charge` noted | Edge |
| FN-06 | Missing CMS code | No `cms_client_code` configured | TBD — form may still export | Negative |

## 10. Known issues, limitations & FAQs

- Uses deprecated PHPExcel library (`require('excel_upload/PHPExcel.php')`). Should migrate to PhpSpreadsheet.
- S1/S3 filter date range parameters (`from_date`, `to_date`) are passed directly in the request — no server-side validation found in `s1excel_exportController`.

**FAQ:**
- *"S1 export is empty"* — check that NACH student registrations exist for the selected year and date range.
- *"S4 import fails"* — check that the uploaded Excel matches the expected column format exactly (bank-specific format).

## 11. Sales notes

**Selling points:**
1. Full NACH lifecycle in one module — from mandate registration to transaction reconciliation.
2. Reduces manual fee collection for large volumes of ECS/NACH-enrolled families.
3. Failed-debit tracking with configurable bounce charges.

**Demo flow:**
1. Show NACH config (CMS code, bank account, charges).
2. Show S1 Export — download the mandate Excel.
3. Explain the S2→S3→S4 cycle in one diagram.

## 12. v1 status & v2 ideas

**v1 complete:** All four steps (S1–S4) functional.
**v2 ideas:**
- Migrate from PHPExcel to PhpSpreadsheet.
- Direct bank API integration (remove Excel round-trip).
- Automated S4 import via SFTP from bank.

## Source files
- `C:\rajesh\lms_k12\app\fees\NACH_s1excel_export\page.tsx`
- `C:\rajesh\lms_k12\app\fees\NACH_s2excel_import\page.tsx`
- `C:\rajesh\lms_k12\app\fees\NACH_s3excel_export\page.tsx`
- `C:\rajesh\lms_k12\app\fees\NACH_s4excel_import\page.tsx`
- `F:\xampp\htdocs\next_lms_erp\app\Http\Controllers\fees\NACH\s1excel_exportController.php`
- `F:\xampp\htdocs\next_lms_erp\app\Http\Controllers\fees\NACH\s2excel_importController.php`
- `F:\xampp\htdocs\next_lms_erp\app\Http\Controllers\fees\NACH\s3excel_exportController.php`
- `F:\xampp\htdocs\next_lms_erp\app\Http\Controllers\fees\NACH\s4excel_importController.php`
- `F:\xampp\htdocs\next_lms_erp\app\Models\fees\bank_master\bankmasterModel.php`
- `F:\xampp\htdocs\next_lms_erp\app\Models\fees\NACH\ac_typeModel.php`
- `F:\xampp\htdocs\next_lms_erp\app\Models\fees\tblfeesConfigModel.php`

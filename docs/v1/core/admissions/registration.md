# Admission Registration
**Product:** Scholar Core | **Module:** Admissions | **Frontend route:** `/admissions/admission_registration`, `/admissions/registration`, `/admissions/registration/[id]/edit` | **v1 status:** Complete

| Field | Value |
|---|---|
| Backend routes | `GET /api/admission_registration`, `GET /api/admission_registration/{id}/edit`, `PUT /api/admission_registration/{id}`, `DELETE /api/admission_registration/{id}`, `POST /api/admission_student` |
| Roles | Admin, Admissions Staff |
| Last updated | 2026-11-04 |
| Source commit | 8fe500dc (FE) / 86261072 (BE) |

## 1. Purpose & users

Admission Registration is step 2 of the admissions pipeline. Once an enquiry is qualified, the family fills a formal registration form (also called the admission form). This screen shows the registration pipeline — a list of enquiries that have been converted to registrations — and allows staff to view/edit registration details, pay the admission form fee, check the approval status, and trigger the "Confirm Admission" or "Add Student" actions.

**Primary users:** Admissions coordinator, Admin  
**When used:** After an enquiry is shortlisted; during active admission season.

## 2. Screens

### Registration Pipeline (list screen)
**Route:** `/admissions/admission_registration` and `/admissions/registration`  
**What is shown:**
- 4 KPI tiles: Total (count), Pending (count), Fee paid (count), Approved (count)
- Registration pipeline table with columns: Registration No., Enquiry No., Enquiry Date, First/Middle/Last Name, Mobile, Email, Status, Fee Status, Actions (Edit, Confirm, Add Student)
- Search bar, Status filter (All/Open/Closed/Approved/Pending), sort by any column
- Export options: CSV, Excel, PDF, Print

**Main actions:** Edit registration, Confirm admission, Add student from confirmed registration, Export.

![](./screenshots/registration-pipeline.png)

### Edit Registration (side drawer)
Opens as a slide-in drawer (`SideDrawer` component) from the pipeline row's edit action.  
Pre-populated with registration data; allows updating all fields.

**Route also:** `/admissions/registration/[id]/edit`

![](./screenshots/registration-edit.png)

## 3. Features & business rules

### Registration form fields

| Field | Type | Notes |
|---|---|---|
| Enquiry ID / Enquiry No. | read-only | Linked enquiry |
| Place of birth | varchar(50) | |
| Enrollment no. | int | |
| Amount (admission form fee) | int | Fee paid for the form |
| Payment mode | varchar(50) | Cash/Cheque/Online |
| Bank name | varchar(50) | For cheque payments |
| Bank branch | varchar(50) | |
| Cheque no. | int | |
| Cheque date | date | |
| Blood group | varchar(50) | |
| Aadhar number | varchar(50) | |
| Register number | int | |
| Mother name | varchar(50) | |
| Mother mobile number | int | |
| Admission date | date | |
| Admission division | varchar(50) | Division/section assigned |
| Remarks | varchar(50) | |
| Follow-up date | date | |
| Status | varchar(50) | OPEN / CLOSE |
| Student quota | bigint | |
| Admission status | varchar(50) | |
| Date of payment | date | |
| Cast | varchar | |
| Religion | varchar | |
| House name | varchar | |

### Status derivation (UI logic)
| Condition | Displayed status |
|---|---|
| `status == 'OPEN'` | Open |
| `status == 'CLOSE'` | Closed |
| `total_student_count > 0` | Approved |
| Default | Pending |

### Fee status derivation
| Condition | Fee status |
|---|---|
| `receipt_id` is non-empty | Paid |
| `admission_form_fee > 0` | Pending |
| Default | Pending |

### Confirm admission
- Button appears on each row; enabled only when status conditions are met.
- Calls `confirmAdmission()` function (from `workflow.ts`).
- Triggers backend to link the registration to a confirmed student record.

### Add student
- Appears after admission is confirmed.
- Calls `POST /api/admission_student` with the registration's data to create a `tblstudent` record.

### Exports
Supported: CSV, Excel, PDF, Print — using `lib/table-export` utilities (`exportRowsAsCsv`, `exportRowsAsExcel`, `exportRowsAsPdf`, `openPrintPreview`).

## 4. User flows

### Happy path — View registrations
1. Navigate to `/admissions/admission_registration`.
2. Pipeline list loads from `GET /api/admission_registration`.
3. Staff see all registrations for the academic year with status and fee status.

### Happy path — Edit registration
1. Click edit icon on a row.
2. Side drawer opens with pre-filled details.
3. Update fields → Save.
4. `PUT /api/admission_registration/{id}` sent.
5. Pipeline refreshes.

### Happy path — Confirm admission
1. Click "Confirm" button on an approved registration.
2. Confirm dialog shown.
3. `confirmAdmission()` calls backend.
4. Row's `isConfirmed` state updates; "Add Student" button becomes available.

### Happy path — Add student
1. After confirmation, click "Add Student".
2. `POST /api/admission_student` sends registration data.
3. Student record created in `tblstudent`.
4. Row's `hasStudent` flag updates.

## 5. Data model

### Table: `admission_registration`

| Column | Type | Notes |
|---|---|---|
| `id` | bigint PK | |
| `enquiry_id` | bigint | FK to `admission_enquiry.id` |
| `enquiry_no` | int | Denormalised enquiry number |
| `place_of_birth` | varchar(50) | |
| `enrollment_no` | int | |
| `amount` | int | Form fee paid |
| `payment_mode` | varchar(50) | |
| `bank_name`, `bank_branch` | varchar(50) | |
| `cheque_no` | int | |
| `cheque_date` | date | |
| `blood_group` | varchar(50) | |
| `aadhar_number` | varchar(50) | |
| `register_number` | int | |
| `mother_name` | varchar(50) | |
| `mother_mobile_number` | int | |
| `admission_date` | date | |
| `admission_division` | varchar(50) | |
| `remarks` | varchar(50) | |
| `followup_date` | date | |
| `status` | varchar(50) | OPEN / CLOSE |
| `student_quota` | bigint | |
| `admission_status` | varchar(50) | |
| `date_of_payment` | date | |
| `sub_institute_id` | int | Multi-tenant |
| `created_by` | int | |
| `created_on` | timestamp | |
| `cast`, `religion`, `house_name` | varchar | |

### Also references: `admission_form` table (for form details, receipt, docket number)

| Column | Type | Notes |
|---|---|---|
| `id` | bigint PK | |
| `enquiry_id` | varchar(50) | |
| `form_no` | varchar(100) | |
| `status` | varchar(50) | OPEN / CLOSE |
| `admission_form_fee` | varchar(100) | Fee charged for the form |
| `receipt_id` | varchar(100) | Receipt reference if paid |
| `admission_docket_no` | varchar(100) | |
| `registration_no` | varchar(100) | |
| `counciler_name` | varchar(50) | |

## 6. APIs

| Method | Endpoint | Auth | Request | Response |
|---|---|---|---|---|
| GET | `/api/admission_registration` | Bearer JWT | `?sub_institute_id=&syear=` | `{ status_code, data: [] }` |
| GET | `/api/admission_registration/{id}/edit` | Bearer JWT | — | `{ status_code, data: {} }` |
| PUT | `/api/admission_registration/{id}` | Bearer JWT | JSON body (registration fields) | `{ status_code }` |
| DELETE | `/api/admission_registration/{id}` | Bearer JWT | — | `{ status_code }` |
| POST | `/api/admission_student` | Bearer JWT | Registration data | `{ status_code }` — creates `tblstudent` |
| GET | `/api/admission_without_confirmation_report_v2` | Bearer JWT | Query params | Report data |
| GET | `/api/admission_without_confirmation_report_v2/{id}/edit` | Bearer JWT | — | Detail row |

## 7. UI components & design tokens

| Component | Used for |
|---|---|
| `SideDrawer` | Edit registration slide-in panel |
| `Card`, `CardContent`, `CardHeader`, `CardTitle` | Layout containers |
| `Table`, `TableBody`, `TableCell`, `TableHead`, `TableHeader`, `TableRow` | Pipeline table |
| `Input`, `Select` | Form controls |
| `Button` | Actions |
| `Pagination` (shadcn) | Table pagination |
| `exportRowsAsCsv`, `exportRowsAsExcel`, `exportRowsAsPdf`, `openPrintPreview` | Export utilities |
| `erp-client`: `appendCommonParams`, `buildSessionContext`, `createAuthHeaders` | Auth and API helpers |
| Lucide: `FileText, Clock, CreditCard, CheckCircle2, Search, Pencil, Loader2, AlertCircle, UserPlus, FileDown, FileSpreadsheet, Printer, Table2` | Icons |

## 8. Reports & exports

Export from the pipeline table: CSV, Excel, PDF, Print.  
Dedicated report: → [Admissions Reports — Registration Report](./reports.md)

## 9. Test cases

| ID | Scenario | Steps | Expected result | Type |
|---|---|---|---|---|
| AR-01 | Load pipeline | Navigate to registration page | All registrations listed with status and fee status | Happy |
| AR-02 | Edit registration | Click edit, change blood group, save | Blood group updates in record | Happy |
| AR-03 | Confirm admission | Click Confirm on an eligible row | `isConfirmed` state updates; Add Student button appears | Happy |
| AR-04 | Add student | After confirm, click Add Student | `tblstudent` row created; `hasStudent` flag updates | Happy |
| AR-05 | Filter by status | Select "Open" in status filter | Only Open registrations shown | Happy |
| AR-06 | Sort by registration number | Click column header | Rows sort ascending/descending | Happy |
| AR-07 | Export to Excel | Click Excel export | File downloaded with pipeline data | Happy |
| AR-08 | Search by name | Type surname in search | Matching rows highlighted/filtered | Happy |
| AR-09 | Cannot confirm already-confirmed | Confirm button on confirmed row | Button disabled or shows "Already confirmed" | Edge |

## 10. Known issues, limitations & FAQs

- **`admission_registration_v1` table:** A second migration `2024_10_08_151046_create_admission_registration_v1.php` was found. It may be an alternate schema for a Hills variant (`admissionRegistrationHillController`). The standard controller uses `admission_registration`.
- **Mother mobile stored as int:** Same issue as enquiry mobile — leading zeros lost.
- **Remarks column is varchar(50):** Very short; may truncate long notes.

**FAQ:**
- *What is the difference between registration and confirmation?* — Registration is when the family fills the formal form and pays the form fee. Confirmation is the school's decision to accept the student.
- *Can a registration be deleted?* — DELETE endpoint exists; UI may not expose it.

## 11. Sales notes

**Selling points:**
- Full audit trail from enquiry → registration → confirmation → student record creation.
- One-click "Add Student" creates the full student record from registration data.
- Exportable pipeline with customizable columns.

**Demo flow (3 steps):**
1. Show pipeline: "Here are all 85 registrations this year — 60 Open, 20 Approved, 5 Confirmed."
2. Open edit side drawer: "Staff fill additional details like blood group, payment mode."
3. Click Confirm → Add Student: "One click creates the student record — no double-entry."

**Pricing:** Included in Scholar Core.

## 12. v1 status & v2 ideas

**v1 complete:** Pipeline list, edit via side drawer, confirm admission, add student, export (CSV/Excel/PDF/Print), search, status filter, sort.

**v2 ideas:**
- Bulk confirm/reject.
- Online payment integration for admission form fee.
- Document upload (birth certificate, photo) on registration.
- Automatic SMS/email to parent on confirmation.

## Source files

- `C:\rajesh\lms_k12\app\admissions\admission_registration\page.tsx`
- `C:\rajesh\lms_k12\app\admissions\admission_registration\types.ts`
- `C:\rajesh\lms_k12\app\admissions\admission_registration\workflow.ts`
- `C:\rajesh\lms_k12\app\admissions\admission_registration\components\sideDrawer.tsx`
- `C:\rajesh\lms_k12\app\admissions\registration\page.tsx`
- `F:\xampp\htdocs\next_lms_erp\app\Http\Controllers\admission\admissionRegistrationController.php`
- `F:\xampp\htdocs\next_lms_erp\database\migrations\2023_03_05_115658_create_admission_registration_table.php`
- `F:\xampp\htdocs\next_lms_erp\database\migrations\2024_10_08_151046_create_admission_registration_v1.php`
- `F:\xampp\htdocs\next_lms_erp\routes\api.php` (lines 473–485)

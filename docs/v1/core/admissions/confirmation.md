# Admission Confirmation
**Product:** Scholar Core | **Module:** Admissions | **Frontend route:** `/admissions/admission_confirmation`, `/admissions/confirmation`, `/admissions/confirmation/[id]/follow-up` | **v1 status:** Complete

| Field | Value |
|---|---|
| Backend routes | `GET /api/admission_registration` (same source as registration), `POST /api/admission_student`, confirm action via `workflow.ts` |
| Roles | Admin, Admissions Staff |
| Last updated | 2026-11-04 |
| Source commit | 8fe500dc (FE) / 86261072 (BE) |

## 1. Purpose & users

Admission Confirmation is step 3 (final) in the admissions pipeline. It shows all registration records and provides the ability to:
1. **Confirm** an admission (school formally accepts the student).
2. **Add Student** (create the actual `tblstudent` record for the confirmed applicant).

This is the hand-off point from the Admissions module to the Student module.

**Primary users:** Admissions coordinator, Principal, Admin  
**When used:** After the registration payment is verified and the school is ready to accept students.

## 2. Screens

### Confirmation List
**Route:** `/admissions/admission_confirmation` (re-exports `/admissions/confirmation/page.tsx`)  
**What is shown:**
- Sortable, searchable table of registration records with columns: Action (Edit), Confirm, Add Student, Registration No., Enquiry No., Enquiry Date, Follow-up Date, First/Middle/Last Name, Mobile, Email, DOB, Age, Standard, Status.
- Status filter (All / Open / Closed / Approved/Pending), date filters, search bar.
- Export buttons: Table2, FileSpreadsheet, Printer.

**Main actions:**
- Edit registration detail (opens side drawer).
- Confirm admission → marks registration as confirmed.
- Add Student → creates `tblstudent` from registration data.

![](./screenshots/confirmation-list.png)

### Follow-up per Registration
**Route:** `/admissions/confirmation/[id]/follow-up`  
Allows recording a follow-up note for a specific confirmation record.

## 3. Features & business rules

### Confirm admission
- The "Confirm" button is enabled when `canConfirm === true` (computed from registration detail).
- On click, calls `confirmAdmission()` from `workflow.ts`.
- Once confirmed: `isConfirmed = true`, `hasStudent` may still be false until Add Student is clicked.
- A confirmed record cannot be re-confirmed.

### Add Student
- Enabled only when admission is confirmed (`isConfirmed === true`) and `canAddStudent === true`.
- Calls `POST /api/admission_student` with the registration's data.
- Creates a row in `tblstudent` with the student's details imported from admission data.
- After success: `hasStudent = true`; button becomes disabled.

### canConfirm logic (from `workflow.ts`, derived from registration detail)
- If `status === 'CLOSE'` → cannot confirm (closed record).
- If `total_student_count > 0` → already has a student; "Add Student" disabled with reason.
- Other conditions: TBD (full logic in `workflow.ts`).

### Columns displayed

| Column | Source | Sortable |
|---|---|---|
| Action | Edit button | No |
| Confirm | Confirm button | No |
| Add Student | Add Student button | No |
| Registration No. | `registrationNumber` | Yes |
| Enquiry No. | `enquiryNumber` | Yes |
| Enquiry Date | `inquiryDate` | Yes |
| Follow Up Date | `followUpDate` | Yes |
| First Name | `firstName` | Yes |
| Middle Name | `middleName` | Yes |
| Last Name | `lastName` | Yes |
| Mobile | `mobile` | Yes |
| Email | `email` | Yes |
| DOB | `dateOfBirth` | Yes |
| Age | `age` | Yes |
| Standard | `admissionStandard` | Yes |
| Status | `status` (derived) | Yes |

## 4. User flows

### Happy path — Confirm and add student
1. Navigate to `/admissions/confirmation`.
2. List loads from `GET /api/admission_registration`.
3. Find a registration ready for confirmation.
4. Click "Confirm" → confirmation action fires → row `isConfirmed` becomes true.
5. Click "Add Student" → `POST /api/admission_student` → `tblstudent` row created.
6. Student now appears in the Student module.

### Follow-up path
1. Navigate to `/admissions/confirmation/[id]/follow-up`.
2. Add a follow-up note for the specific registration.

## 5. Data model

Same source tables as Registration:
- `admission_registration` — primary data
- `admission_form` — form fee, receipt, docket, registration number
- `tblstudent` — target table when Add Student is clicked

### Key relationship
`admission_enquiry.id` → `admission_registration.enquiry_id` → `admission_form.enquiry_id` → `tblstudent` (created on confirm)

## 6. APIs

| Method | Endpoint | Auth | Request | Response |
|---|---|---|---|---|
| GET | `/api/admission_registration` | Bearer JWT | `?sub_institute_id=&syear=` | Registration list |
| GET | `/api/admission_registration/{id}/edit` | Bearer JWT | — | Detail for side drawer |
| PUT | `/api/admission_registration/{id}` | Bearer JWT | Updated fields | `{ status_code }` |
| POST | `/api/admission_student` | Bearer JWT | Registration data | `{ status_code }` — creates `tblstudent` |
| Confirm action | TBD (in `workflow.ts`) | Bearer JWT | Registration ID | `{ status_code }` |

## 7. UI components & design tokens

| Component | Used for |
|---|---|
| `Table`, `TableBody`… (shadcn) | List table |
| `Input`, `Select` (shadcn) | Search and filter |
| `Button` | Actions |
| `Pagination` | Table paging |
| `exportRowsAsCsv`, `exportRowsAsExcel` etc. | Exports |
| `format`, `parseISO` from `date-fns` | Date formatting |
| `cn` from `lib/utils` | Conditional class names |
| Lucide: `Search, Pencil, CheckCircle2, ArrowUpDown, FileDown, FileText, Table2, FileSpreadsheet, Printer, Loader2, AlertCircle, UserPlus` | Icons |

## 8. Reports & exports

Export from list: CSV, Excel, PDF, Print.  
Dedicated report: → [Admissions Reports — Confirmation Report](./reports.md)

## 9. Test cases

| ID | Scenario | Steps | Expected result | Type |
|---|---|---|---|---|
| AC-01 | Load confirmation list | Navigate to `/admissions/confirmation` | All registrations listed with action buttons | Happy |
| AC-02 | Confirm admission | Click Confirm on eligible row | `isConfirmed = true`; Add Student button appears | Happy |
| AC-03 | Add student | After confirm, click Add Student | `tblstudent` created; button disabled | Happy |
| AC-04 | Cannot re-confirm | Click Confirm on already-confirmed row | Button disabled or shows "Already confirmed" | Edge |
| AC-05 | Cannot add student twice | Click Add Student on row with `hasStudent = true` | Button disabled; reason shown | Edge |
| AC-06 | Sort by name | Click First Name column | Rows sort | Happy |
| AC-07 | Filter by status | Select "Approved" | Only approved rows shown | Happy |
| AC-08 | Export confirmation list | Click Excel button | Excel file downloaded | Happy |

## 10. Known issues, limitations & FAQs

- **`admission_confirmation/page.tsx` re-exports `confirmation/page.tsx`:** The `/admissions/admission_confirmation` route is a re-export of `/admissions/confirmation/page.tsx`. Both routes show the same screen.
- **`confirmAdmission()` exact endpoint:** Not confirmed from code scan alone; in `workflow.ts` — requires further reading to document exactly.

**FAQ:**
- *After I add a student, where does the student appear?* — In the Student module under the current academic year.
- *What data is copied to the student record?* — TBD (depends on `admission_student` controller logic).

## 11. Sales notes

**Selling points:**
- Seamless hand-off from admissions to student master — zero double-entry.
- Full audit trail: enquiry → registration → confirmation → student.
- Multi-step confirmation prevents accidental premature student creation.

**Demo flow (3 steps):**
1. Show confirmation list with 50 registrations in various states.
2. Click Confirm on one → it moves to Confirmed.
3. Click Add Student → show the student appearing in the Student module.

**Pricing:** Included in Scholar Core.

## 12. v1 status & v2 ideas

**v1 complete:** Confirmation list, confirm action, add student, edit via side drawer, sort, search, status filter, export.

**v2 ideas:**
- Bulk confirm multiple registrations.
- Auto-generate student GR number on add.
- Send welcome SMS/email to parent on confirmation.
- Document checklist (collect TC, birth certificate) before confirmation is allowed.

## Source files

- `C:\rajesh\lms_k12\app\admissions\confirmation\page.tsx`
- `C:\rajesh\lms_k12\app\admissions\admission_confirmation\page.tsx` (re-export)
- `C:\rajesh\lms_k12\app\admissions\confirmation\[id]\follow-up\page.tsx`
- `C:\rajesh\lms_k12\app\admissions\admission_registration\workflow.ts`
- `F:\xampp\htdocs\next_lms_erp\app\Http\Controllers\admission\admissionRegistrationController.php`
- `F:\xampp\htdocs\next_lms_erp\app\Http\Controllers\admission\onlineAdmissionConfirmController.php`
- `F:\xampp\htdocs\next_lms_erp\routes\api.php` (lines 473–485)

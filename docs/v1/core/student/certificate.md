# Student Certificate
**Product:** Scholar Core | **Module:** Student | **Frontend route:** `/student/student_certificate` | **v1 status:** Complete

| Field | Value |
|---|---|
| Backend routes | TBD (StudentCertificateApiController, studentCertificateController) |
| Roles | Admin, Principal |
| Last updated | 2026-11-04 |
| Source commit | 8fe500dc (FE) / 86261072 (BE) |

## 1. Purpose & users
Issues certificates to students — bonafide certificates, leaving/TC certificates, character certificates, and others. Admin and principal use this to generate and print official certificates. The page opens in "issue" mode by default.

A separate read route `/student/student_certificate_report` handles certificate history reporting.

## 2. Screens

**Student Certificate** (`/student/student_certificate`)
Renders `<StudentCertificateModule initialViewMode="issue" />`.

The module supports multiple view modes: `issue` (default), and potentially others (TBD — read `StudentCertificateModule` for all modes).

Also related:
- `/student/student_certificate_report` — TC/certificate history report

![](./screenshots/student-certificate.png)

## 3. Features & business rules
- Certificate types: TBD (read `StudentCertificateModule` component and backend controller).
- Issued certificates are logged in `certificate_history` table (migration: `create_certificate_history`).
- TC (Transfer Certificate): When issued, the student's enrollment may be marked as ended (`end_date` set) in `tblstudent_enrollment`.

### `certificate_history` table (inferred from migration name)
Exact columns: TBD.

## 4. User flows

**Issue a certificate**
1. Navigate to Student → Certificate.
2. Search for student.
3. Select certificate type.
4. Fill in required details (date, reason, etc.).
5. Generate/print certificate PDF.
6. Certificate logged in `certificate_history`.

## 5. Data model

### `certificate_history` (migration: `create_certificate_history`)
Exact columns TBD — read migration file for confirmation.

## 6. APIs
Managed by `StudentCertificateApiController` and `studentCertificateController`. Exact endpoints: TBD.

## 7. UI components & design tokens
- `StudentCertificateModule` — multi-mode certificate management component
- Exact UI: TBD (read component source)

## 8. Reports & exports
- Certificate history report: `/student/student_certificate_report`
- PDF generation for the certificate itself

## 9. Test cases
| ID | Scenario | Steps | Expected result | Type |
|---|---|---|---|---|
| S-CERT-01 | Issue bonafide | Search student, issue bonafide | PDF generated; logged in history | Happy |
| S-CERT-02 | Issue TC | Issue transfer certificate | Enrollment end_date set; certificate issued | Happy |
| S-CERT-03 | Student not found | Search with invalid GR | Error shown | Negative |

## 10. Known issues, limitations & FAQs
- Full component and API details are TBD — the page.tsx only imports `StudentCertificateModule`; the module file was not read in this scan.

**FAQ:** *Can a TC be cancelled after issue?* — TBD.

## 11. Sales notes
**Selling points:** One-click certificate generation with PDF print; full issuance log for compliance.

**Demo flow:**
1. Search student.
2. Select certificate type.
3. Show generated PDF.

Plan/pricing: TBD

## 12. v1 status & v2 ideas
**Complete:** Certificate issuance and history (inferred from controllers/migration).
**Partial:** Full feature details TBD — `StudentCertificateModule` not fully read.
**v2 ideas:** Digital signature; WhatsApp delivery of certificate; bulk TC for class rollover.

## Source files
- `C:\rajesh\lms_k12\app\student\student_certificate\page.tsx`
- `C:\rajesh\lms_k12\app\student\student_certificate\StudentCertificateModule.tsx` (not yet read)
- `F:\xampp\htdocs\next_lms_erp\app\Http\Controllers\student\studentCertificateController.php`
- `F:\xampp\htdocs\next_lms_erp\app\Http\Controllers\student\StudentCertificateApiController.php`

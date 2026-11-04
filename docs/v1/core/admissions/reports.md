# Admissions Reports
**Product:** Scholar Core | **Module:** Admissions | **Frontend route:** `/admissions/admission_reports` | **v1 status:** Complete

| Field | Value |
|---|---|
| Backend routes | See individual report endpoints below |
| Roles | Admin, Admissions Staff, Principal |
| Last updated | 2026-11-04 |
| Source commit | 8fe500dc (FE) / 86261072 (BE) |

## 1. Purpose & users

The Admissions Reports screen provides five downloadable, filterable reports covering the full admissions pipeline — from follow-up scheduling through to confirmation. Reports can be exported as CSV, Excel, or PDF and are the primary way schools extract admissions data for analysis or sharing with management.

**Primary users:** Admissions coordinator, Principal, Management, Auditors
**When used:** End of admission season, monthly reviews, management presentations.

## 2. Screens

### Report Hub
**Route:** `/admissions/admission_reports`
**What is shown:** Five report cards, each with a title, description, filter options, and an export/run button.

**Main actions:** Select filters -> run report -> view/export.

## 3. Reports

### Report 1 — Inquiry Follow-up Report

| Field | Value |
|---|---|
| Config key | `inquiry_followup` |
| Slug | `inquiry-followup` |
| Backend endpoint | `POST /admission/admission_enquiry_followup_report` |
| Controller | `admissionReportController::followUpReport` |
| Filter mode | `followup` — date range (from/to), user filter, follow-up status |
| Export | CSV, Excel, PDF |

**What it shows:** One row per enquiry with its most recent follow-up date, remarks, counsellor name, and enquiry status. Used to review which enquiries have been contacted and when.

**Columns (typical):** Enquiry No., Student Name, Mobile, Admission Standard, Counsellor, Enquiry Date, Follow-up Date, Follow-up Status, Remarks.

**Filters:** From date / To date, User / Counsellor, Follow-up status.

---

### Report 2 — Admission Enquiry Report

| Field | Value |
|---|---|
| Config key | `admission_inquiry` |
| Slug | `admission-inquiry` |
| Backend endpoint | `POST /admission/admission_enquiry_report` |
| Controller | `admissionReportController::enquiryReport` |
| Filter mode | `user` — user/counsellor filter |
| Export | CSV, Excel, PDF |

**What it shows:** Complete enquiry list with all standard fields — student details, source, standard, status, date, assigned counsellor.

**Columns (typical):** Enquiry No., Student Name, Father Name, Mobile, Email, Admission Standard, Source, Category, Status, Enquiry Date, Counsellor.

**Filters:** User / Counsellor.

---

### Report 3 — Admission Registration Report

| Field | Value |
|---|---|
| Config key | `admission_registration` |
| Slug | `admission-registration` |
| Backend endpoint | `POST /admission/admission_registration_report` |
| Controller | `admissionReportController::registrationReport` |
| Filter mode | `status` — OPEN / CLOSE |
| Field selection | `supportsFieldSelection: true` — user can choose which columns to export |
| Default fields | `first_name`, `middle_name`, `last_name`, `mobile`, `email` |
| Export | CSV, Excel, PDF |

**What it shows:** Registration records filtered by status. Supports custom field selection — the user picks which columns appear in the exported file.

**Filters:** Status: OPEN / CLOSE.

---

### Report 4 — Admissions Without Confirmation Report

| Field | Value |
|---|---|
| Config key | `admission_without_confirmation` |
| Slug | `admission-without-confirmation` |
| Backend endpoint | `POST /admission/admission_without_con_report` |
| Controller | `admissionReportController::withoutConfirmationReport` |
| Filter mode | `status` — OPEN / CLOSE |
| Export | CSV, Excel, PDF |

**What it shows:** Registrations that have NOT yet been confirmed. Used to identify students stuck in the pipeline.

**Columns (typical):** Registration No., Enquiry No., Student Name, Mobile, Email, Admission Standard, Registration Date, Status.

**Filters:** Status: OPEN / CLOSE.

---

### Report 5 — Admission Confirmation Report

| Field | Value |
|---|---|
| Config key | `admission_confirmation` |
| Slug | `admission-confirmation` |
| Backend endpoint | `POST /admission/admission_confirmation_report` |
| Controller | `admissionReportController::confirmationReport` |
| Filter mode | `status` — YES / NO (confirmed vs. not confirmed) |
| Export | CSV, Excel, PDF |

**What it shows:** Registration records with their confirmation status. YES = confirmed; NO = not yet confirmed.

**Columns (typical):** Registration No., Enquiry No., Student Name, Mobile, Email, Admission Standard, Confirmation Status, Admission Date, Division.

**Filters:** Status: YES (confirmed) / NO (not confirmed).

---

## 4. User flows

### Happy path — Run a report
1. Navigate to `/admissions/admission_reports`.
2. Click on the desired report card.
3. Set filters (date range, status, user, etc.).
4. Click "Run report".
5. Report rows render in a table.
6. Click CSV/Excel/PDF to download.

### Field selection (Registration Report only)
1. Open Admission Registration Report.
2. Click "Select fields".
3. Toggle desired columns.
4. Run report — only selected columns appear.

## 5. Data model

### Tables used

| Report | Source tables |
|---|---|
| Inquiry Follow-up | `admission_enquiry` JOIN `admission_follow_up` |
| Admission Enquiry | `admission_enquiry` |
| Admission Registration | `admission_registration` JOIN `admission_form` |
| Without Confirmation | `admission_registration` WHERE not confirmed |
| Confirmation | `admission_registration` JOIN confirmation status |

## 6. APIs

All calls go through `runAdmissionReport()` in `app/admissions/admission_reports/api.ts`, proxied via `/api/proxy`.

| Method | Endpoint | Auth | Key request fields | Response |
|---|---|---|---|---|
| POST | `/admission/admission_enquiry_followup_report` | JWT | `sub_institute_id, syear, fromDate, toDate, user, status, followUpStatus` | `{ status_code, data: row[] }` |
| POST | `/admission/admission_enquiry_report` | JWT | `sub_institute_id, syear, user` | `{ status_code, data: row[] }` |
| POST | `/admission/admission_registration_report` | JWT | `sub_institute_id, syear, status` | `{ status_code, data: row[] }` |
| POST | `/admission/admission_without_con_report` | JWT | `sub_institute_id, syear, status` | `{ status_code, data: row[] }` |
| POST | `/admission/admission_confirmation_report` | JWT | `sub_institute_id, syear, status` | `{ status_code, data: row[] }` |

## 7. Report summary table

| # | Report | Endpoint suffix | Filter | Field Select | Export |
|---|---|---|---|---|---|
| 1 | Inquiry follow-up | `admission_enquiry_followup_report` | Date range, user, status | No | CSV/Excel/PDF |
| 2 | Admission enquiry | `admission_enquiry_report` | User/counsellor | No | CSV/Excel/PDF |
| 3 | Admission registration | `admission_registration_report` | OPEN/CLOSE status | Yes | CSV/Excel/PDF |
| 4 | Without confirmation | `admission_without_con_report` | OPEN/CLOSE status | No | CSV/Excel/PDF |
| 5 | Admission confirmation | `admission_confirmation_report` | YES/NO confirmed | No | CSV/Excel/PDF |

## 8. Test cases

| ID | Scenario | Steps | Expected result | Type |
|---|---|---|---|---|
| ARPT-01 | Run follow-up report | Set date range, click Run | Rows with follow-up dates and remarks | Happy |
| ARPT-02 | Run enquiry report | No filters | All enquiries listed | Happy |
| ARPT-03 | Run registration report — Open | Filter = OPEN | Only open registrations | Happy |
| ARPT-04 | Field selection | Select only first_name + mobile | Only those columns in export | Happy |
| ARPT-05 | Run without-confirmation | Filter = OPEN | Unconfirmed registrations listed | Happy |
| ARPT-06 | Run confirmation — YES | Filter = YES | Only confirmed records shown | Happy |
| ARPT-07 | Export to Excel | Click Excel | File downloaded | Happy |
| ARPT-08 | Export to PDF | Click PDF | PDF generated | Happy |
| ARPT-09 | No results | Filters return empty set | "No data" state shown | Edge |
| ARPT-10 | Session missing | No sub_institute_id | Error shown; no API call | Negative |

## 9. Known issues, limitations & FAQs

- **No server-side pagination:** All rows returned at once. May be slow for large data sets.
- **Field selection only on Registration Report:** The other four do not support custom column selection in v1.
- **Filters are fixed per report:** Cannot combine filters (e.g., date AND status together) on most reports.

**FAQ:**
- *Which report generates the final acceptance list?* — Use the Admission Confirmation Report filtered to YES.
- *Which report shows un-followed-up enquiries?* — Run the Inquiry Follow-up Report; sort by Follow-up Date ascending; empty dates = no follow-up yet.
- *Can reports be scheduled automatically?* — Not in v1.

## 10. Sales notes

**Selling points:**
- Five purpose-built reports cover the full admissions pipeline in one place.
- Custom column selection on Registration Report lets schools match their MIS format.
- One-click Excel or PDF for instant management sharing.

**Demo flow (2 steps):**
1. Run Admission Enquiry Report — show all 240 enquiries — Export to Excel.
2. Run Confirmation Report (YES) — show the 95 confirmed students — Export PDF — "This is your first-day list."

**Pricing:** Included in Scholar Core.

## 11. v1 status & v2 ideas

**v1 complete:** All five reports with their filters and CSV/Excel/PDF export.

**v2 ideas:**
- Scheduled auto-email of weekly reports to Principal.
- Cross-report comparison (enquiries vs. registrations vs. confirmations in one view).
- Year-on-year comparison report.
- Custom date filter on all reports.
- Server-side pagination for large data sets.
- Save filter presets.

## Source files

- `C:\rajesh\lms_k12\app\admissions\admission_reports\config.ts`
- `C:\rajesh\lms_k12\app\admissions\admission_reports\api.ts`
- `C:\rajesh\lms_k12\app\admissions\admission_reports\page.tsx`
- `F:\xampp\htdocs\next_lms_erp\app\Http\Controllers\admission\admissionReportController.php`
- `F:\xampp\htdocs\next_lms_erp\routes\api.php` (admission report routes)

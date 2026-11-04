# Admission Enquiry
**Product:** Scholar Core | **Module:** Admissions | **Frontend route:** `/admissions/admission_enquiry` | **v1 status:** Complete

| Field | Value |
|---|---|
| Backend routes | `GET /api/admission_enquiry`, `POST /api/admission_enquiry`, `PUT /api/admission_enquiry/{id}`, `DELETE /api/admission_enquiry/{id}` |
| Roles | Admin, Admissions Staff, Counsellor |
| Last updated | 2026-11-04 |
| Source commit | 8fe500dc (FE) / 86261072 (BE) |

## 1. Purpose & users

Admission Enquiry is the first step in the admissions pipeline. It captures initial interest from parents/guardians before any formal application. Staff record the enquirer's contact details, the student's details, the source of enquiry, and schedule a follow-up. The screen also provides KPI tiles and analytics charts computed from the loaded enquiry data.

**Primary users:** Admissions coordinator, Counsellor, Front-desk staff  
**When used:** Whenever a parent walks in, calls, or contacts the school about admission.

## 2. Screens

### Enquiry Roster (main screen)
**Route:** `/admissions/admission_enquiry`  
**What is shown:**
- 4 KPI tiles: Total enquiries, New this week, Conversion rate, Follow-ups due
- 3 charts: Admissions funnel (bar), Enquiry sources (doughnut), Source quality (radar)
- Enquiry roster table with columns: Enquiry No., Student, Grade, Source, Status, Assigned (counsellor), Follow-up Date, Next Follow-up Date, Edit action
- Search bar, Status / Source / Grade filters, "Enquiry" (add) button

**Main actions:** Add enquiry, Edit enquiry, Schedule/view follow-up, Search/filter roster.

![](./screenshots/enquiry-roster.png)

### Add / Edit Enquiry Modal
Opened by clicking "Enquiry" (add) or the pencil icon (edit).  
**Fields collected:** See Features & business rules section.

![](./screenshots/enquiry-modal.png)

### Follow-up Modal
Opened from within the Edit modal via "Admission follow-up" button.  
**Shows:** Follow-up history table + form to add a new follow-up entry.

![](./screenshots/enquiry-followup-modal.png)

## 3. Features & business rules

### Enquiry form fields

| Field | Type | Required | Validation | Notes |
|---|---|---|---|---|
| Enquiry no. | number (auto) | Yes | Auto-generated; read-only on edit | `max(existing) + 1` or `{syear}001` |
| Student name (first) | text | Yes | — | |
| Middle name (Father's name) | text | Yes | — | Used as `father_name` fallback on create |
| Surname | text | Yes | — | |
| Mobile (SMS number) | tel | Yes | 10 digits, starts 6–9; pattern `[6-9]\d{9}` | Stripped of non-digits |
| Email | email | No | Standard email format | |
| Admission standard | select | Yes | Nursery, LKG, UKG, 1–12 | |
| Date of birth | date | Yes | — | Age auto-calculated from DOB |
| Age | number (auto) | No | Read-only; computed from DOB | |
| Address | textarea | Yes | — | |
| Father's name | text | Yes | — | |
| Mother name | text | Yes | — | |
| Father occupation | text | No | — | |
| Annual income | text | No | — | |
| Gender | radio | Yes | Male / Female | |
| Previous school name | text | No | — | |
| Previous standard | select | No | Nursery, LKG, UKG, 1–12 | |
| Follow-up date | date | No | — | Initial scheduled follow-up |
| Remarks | textarea | No | — | AI field assistant available |
| Source of enquiry | text | Yes | — | Free text: Website, Referral, etc. |
| Category | select | No | General, OBC, SC, ST, EWS, Other | |
| Send SMS | select | No | Yes / No | |
| Institute branch | select | No | Main, Primary, Secondary, Other | |
| Activity date | date | No | — | |
| Activity time | time | No | — | |
| Activity remarks | textarea | No | — | |
| Siblings | text | No | — | |
| Form number | text | No | — | Maps to `fees_circular_form_no` on save |
| Mobile number (Father) | tel | No | 10 digits, starts 6–9 | |
| Mobile number (Mother) | tel | No | 10 digits, starts 6–9 | |

### Status values
`New` → `Contacted` → `Visit Scheduled` → `Application Sent` → `Approved` / `Converted` / `Closed`

Status badge colours:
- Approved/Converted: green
- New: blue
- Visit Scheduled: amber
- Contacted: purple
- Application Sent: indigo
- Closed: slate

### KPI tiles (computed client-side from loaded data)

| Tile | Calculation |
|---|---|
| Total enquiries | `rosterData.length` |
| New this week | Rows where `created_on` is within last 7 days |
| Conversion rate | `(approved+converted) / total * 100`, rounded |
| Follow-ups due | Rows where `followup_date <= today` AND status is not Approved/Converted/Closed |

### Permission rules
- All authenticated users with Admissions module rights can view.
- Create / Edit: Admissions staff and Admin.
- Delete: TBD (endpoint exists: `DELETE /api/admission_enquiry/{id}`).
- Soft delete: `deleted_at` column was added in migration `2026_07_13_000001_add_deleted_at_to_admission_enquiry_table.php`.

## 4. User flows

### Happy path — Add enquiry
1. Navigate to `/admissions/admission_enquiry`.
2. Click "+ Enquiry" button.
3. Modal opens with auto-filled enquiry number.
4. Fill required fields: student name, mobile, standard, DOB, address, parents' names, source.
5. Click "Save Enquiry".
6. `POST /api/admission_enquiry?sub_institute_id=&syear=&type=API&user_id=` with JSON payload.
7. On success (`status_code === "1"`): modal closes, roster reloads.

### Happy path — Edit enquiry
1. Click pencil icon on any roster row.
2. Modal opens pre-populated with existing data.
3. Edit fields as needed.
4. Click "Update Enquiry".
5. `PUT /api/admission_enquiry/{id}?...` with updated payload.
6. On success: modal closes, roster reloads.

### Happy path — Schedule follow-up
1. Open Edit modal for an enquiry.
2. Click "Admission follow-up" button.
3. Follow-up modal opens showing history.
4. Enter Next Follow-up Date (required), Status (required), Remarks (required).
5. Click Save.
6. Follow-up is recorded; "Next Follow-up Date" column in roster updates.

### Error paths
- Mobile number not 10 digits → field-level inline error.
- Backend returns non-`1` status_code → error banner inside modal.
- Session missing → error shown; API not called.

## 5. Data model

### Table: `admission_enquiry`

| Column | Type | Notes |
|---|---|---|
| `id` | bigint PK | Auto-increment |
| `enquiry_no` | int | Sequential per year/institute |
| `first_name`, `middle_name`, `last_name` | varchar(50) | Student name parts |
| `gender` | varchar(50) | male / female |
| `mobile` | int | Primary contact (stored as int — validation in frontend) |
| `mobile_number_father` | int | |
| `mobile_number_mother` | int | |
| `email` | varchar(50) | |
| `address` | varchar(100) | |
| `date_of_birth` | date | |
| `age` | int | Computed from DOB |
| `syear` | int | Academic year ID |
| `sub_institute_id` | int | Multi-tenant key |
| `admission_standard` | int | Grade sought |
| `previous_school_name` | varchar(50) | |
| `previous_standard` | varchar(50) | |
| `remarks` | varchar(250) | |
| `followup_date` | date | Scheduled follow-up date |
| `source_of_enquiry` | varchar(50) | |
| `category` | varchar(50) | General/OBC/SC/ST/EWS/Other |
| `send_sms` | varchar(50) | yes/no |
| `father_name`, `mother_name` | varchar | |
| `father_occupation`, `mother_occupation` | varchar | |
| `annual_income` | varchar | |
| `guardian_name`, `counciler_name` | varchar | Assigned counsellor |
| `fees_circular_form_no` | varchar(150) | Form number |
| `receipt_id` | bigint | Fees receipt if form fee paid |
| `created_on` | timestamp | Auto |
| `created_by` | int | User ID |
| `deleted_at` | timestamp | Soft delete (added 2026-07-13) |

### Follow-up table: `tbl_admission_followup` (inferred from controller)
Exact schema: TBD (not found in scanned migrations; controller is `admissionFollowUpController`).

| Column | Purpose |
|---|---|
| `enquiry_id` | FK to `admission_enquiry.id` |
| `follow_up_date` | Scheduled date |
| `status` | Enquiry status at time of follow-up |
| `remarks` | Notes |
| `created_on` | Timestamp |

## 6. APIs

| Method | Endpoint | Auth | Request | Response | Errors |
|---|---|---|---|---|---|
| GET | `/api/admission_enquiry?sub_institute_id=&syear=&type=API` | Bearer JWT | Query params | `{ status_code: "1", data: AdmissionEnquiryApiRow[] }` | 401 JWT fail |
| POST | `/api/admission_enquiry?sub_institute_id=&syear=&type=API&user_id=` | Bearer JWT | JSON body (all enquiry fields) | `{ status_code: "1" }` | 400 validation |
| PUT | `/api/admission_enquiry/{id}?sub_institute_id=&syear=&type=API` | Bearer JWT | JSON body (update fields) | `{ status_code: "1" }` | 404 not found |
| DELETE | `/api/admission_enquiry/{id}` | Bearer JWT | — | `{ status_code: "1" }` | 404 not found |
| GET | `/api/admission_enquiry_followup?enquiry_id=` (inferred) | Bearer JWT | Query param | Follow-up list | — |
| POST | `/api/admission_enquiry_followup` (inferred) | Bearer JWT | `{ enquiry_id, follow_up_date, status, remarks }` | `{ status_code: "1" }` | — |

> Note: Follow-up API path is inferred from `admissionFollowUpController`; exact routes need verification in `routes/api.php` or web.php.

## 7. UI components & design tokens

| Component | Used for |
|---|---|
| `Bar`, `Doughnut`, `Radar` (react-chartjs-2) | Funnel, sources, quality charts |
| `AiFieldAssistant` (`components/ai/AiFieldAssistant`) | AI suggestion for Remarks field |
| `createPortal` | Enquiry and follow-up modals (rendered to document.body) |
| Tailwind utility classes | All layout and styling |
| `--primary-blue` CSS variable | Buttons, active states |
| Lucide icons: `Users, TrendingUp, Percent, Clock, Plus, Pencil, History, X, Search, SlidersHorizontal` | UI icons |

## 8. Reports & exports

The roster table itself does not have export buttons. Export is available from the dedicated reports screen:
→ [Admissions Reports](./reports.md): Enquiry Follow-up Report, Admission Enquiry Report.

## 9. Test cases

| ID | Scenario | Steps | Expected result | Type |
|---|---|---|---|---|
| AE-01 | Load roster | Navigate to `/admissions/admission_enquiry` | Roster loads with all current-year enquiries | Happy |
| AE-02 | Add enquiry — all required fields | Fill all required fields, click Save | Enquiry appears in roster; enquiry_no auto-assigned | Happy |
| AE-03 | Add enquiry — mobile invalid | Enter 9-digit mobile, click Save | Inline error on mobile field; no submit | Negative |
| AE-04 | Add enquiry — mobile starts with 5 | Enter 5XXXXXXXXX, click Save | Inline error (must start 6–9) | Negative |
| AE-05 | Edit enquiry | Click pencil icon, change source, save | Source updates in roster | Happy |
| AE-06 | Add follow-up | Open edit modal → Admission follow-up → fill form → Save | Follow-up appears in history; next follow-up date column updates | Happy |
| AE-07 | Follow-up missing required fields | Save follow-up with blank date | Error "Next followup date, remarks, and enquiry status are required" | Negative |
| AE-08 | Search roster | Type student name in search box | Roster filters to matching rows | Happy |
| AE-09 | Conversion rate KPI | Mix of approved and new enquiries | Rate = approved_count/total * 100 | Edge |
| AE-10 | Follow-ups due KPI | Some enquiries with followup_date in past, not closed | Count shown correctly | Edge |
| AE-11 | Age auto-calculate | Enter DOB | Age field updates immediately | Happy |

## 10. Known issues, limitations & FAQs

- **Mobile stored as int:** The DB column `mobile` is `int`, which loses leading zeros. Storing as varchar would be safer; the frontend enforces 10-digit validation but the DB may strip leading zeros on numeric parsing. This is a potential data integrity issue.
- **No pagination on roster:** All enquiries for the academic year are fetched in a single GET request. For large schools this could be slow and memory-heavy.
- **Filters are UI-only:** Status/Source/Grade filter buttons are rendered but have no connected filter logic (stub in v1).
- **Branch options hardcoded:** "Main Branch, Primary Branch, Secondary Branch, Other" are hardcoded in the frontend. Should come from institute configuration.

**FAQ:**
- *How is enquiry number assigned?* — `max(existing enquiry_no) + 1` for the year, or `{syear}001` if first.
- *Can I delete an enquiry?* — DELETE endpoint exists; UI delete button is TBD (not visible in v1 roster).
- *How is conversion rate calculated?* — Enquiries with status "Approved" or "Converted" ÷ total, as a percentage, calculated client-side.

## 11. Sales notes

**Selling points:**
- Complete enquiry lifecycle from first contact to conversion — all in one screen.
- AI-assisted remarks field helps counsellors write better notes faster.
- Real-time conversion funnel and source quality radar chart helps identify best lead sources.
- Follow-up scheduler ensures no enquiry falls through the cracks.

**Demo flow (5 steps):**
1. Show KPI tiles: "We have 240 enquiries this year, 68% conversion rate, and 12 follow-ups due today."
2. Click "+ Enquiry" → fill in a sample student → Save → watch it appear in the roster.
3. Click pencil → "Admission follow-up" → show the follow-up history modal.
4. Point to the Enquiry Sources doughnut chart: "Here you can see that Walk-ins account for 40% of enquiries."
5. Show Source Quality radar: "Referral leads have higher conversion — this helps focus your marketing."

**Pricing:** TBD — included in Scholar Core.

## 12. v1 status & v2 ideas

**v1 complete:** Add/Edit enquiry, full field set, follow-up scheduling and history, KPI tiles (client-side), 3 analytics charts, search, AI-assisted remarks field, soft delete.

**v1 partial / gaps:**
- Status/Source/Grade filter buttons are UI stubs (no functional filtering).
- No export from the roster directly.
- No pagination (all records loaded at once).

**v2 ideas:**
- Server-side pagination and advanced filtering.
- Bulk status update.
- WhatsApp/SMS send directly from roster.
- Duplicate detection (same mobile number).
- Counsellor assignment workflow.
- Export roster to Excel/PDF.

## Source files

- `C:\rajesh\lms_k12\app\admissions\admission_enquiry\page.tsx`
- `C:\rajesh\lms_k12\app\admissions\admission_enquiry\followUpApi.ts`
- `C:\rajesh\lms_k12\app\admissions\admission_followUp\_lib\follow-up-agenda-api.ts`
- `F:\xampp\htdocs\next_lms_erp\app\Http\Controllers\admission\admissionEnquiryController.php`
- `F:\xampp\htdocs\next_lms_erp\app\Http\Controllers\admission\admissionFollowUpController.php`
- `F:\xampp\htdocs\next_lms_erp\database\migrations\2023_03_05_115658_create_admission_enquiry_table.php`
- `F:\xampp\htdocs\next_lms_erp\database\migrations\2026_07_13_000001_add_deleted_at_to_admission_enquiry_table.php`
- `F:\xampp\htdocs\next_lms_erp\routes\api.php` (lines 457–461)

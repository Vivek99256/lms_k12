# Alumni Management (Staff Side)
**Product:** Scholar Core | **Module:** Alumni | **Frontend route:** `/alumni/dashboard`, `/alumni/list`, `/alumni/add`, `/alumni/directory`, `/alumni/batches`, `/alumni/conversion`, `/alumni/pending_verification`, `/alumni/import`, `/alumni/reports` | **v1 status:** Complete

| Field | Value |
|---|---|
| Backend routes | `GET/POST api/alumni/*` (inferred from migration comments and alumni-api client) |
| Roles | Admin, Alumni Coordinator |
| Last updated | 2026-11-04 |
| Source commit | 8fe500dc (FE) / 86261072 (BE) |

## 1. Purpose & users
Manages the school's alumni database. Staff can convert graduating students to alumni, manually add alumni, import bulk records, verify profiles, and view analytics. Alumni Module was added in October 2026 (migrations `2026_10_10_*` to `2026_10_15_*`).

## 2. Screens

### Dashboard (`/alumni/dashboard`)
Bar charts showing alumni counts by batch, year, industry, country. Metric tiles for total alumni, verified, employment status. Uses Recharts `BarChart` with `ResponsiveContainer`.

### List / Directory (`/alumni/list`, `/alumni/directory`)
Searchable, filterable alumni list. Filters: batch, passing year, status, country/state/city, industry.

### Add Alumni (`/alumni/add`)
Manual entry form for a single alumnus not in the student database.

### Edit (`/alumni/edit`)
Edit existing alumni profile.

### Conversion (`/alumni/conversion`)
Converts current/past students from `tblstudent` to alumni records. Idempotent — a student can only be converted once (unique constraint `alumni_tenant_student_uq`).

### Pending Verification (`/alumni/pending_verification`)
Queue of alumni with `status = 'pending_verification'`. Staff verify and update status.

### Import (`/alumni/import`)
Bulk import alumni from Excel/CSV. Uses `alumni_import` tables.

### Batches (`/alumni/batches`)
Group and browse alumni by graduation batch.

### Reports (`/alumni/reports`)
TBD — report structure not read in this pass.

## 3. Features & business rules

**Alumni record — key fields:**
| Field | Type | Notes |
|---|---|---|
| alumni_code | varchar 40 | Auto-generated, unique per tenant |
| student_id | FK (nullable) | Links to tblstudent; null for manual/imported |
| source | varchar 20 | auto \| manual \| self \| import |
| status | varchar 30 | registered → pending_verification → verified → active → inactive → blocked → deceased → opted_out |
| consent_email/sms/whatsapp/push | tinyint | All default 0; must be explicitly granted |
| passing_year | smallint | Denormalised snapshot for filtering |
| current_company / industry / job_title | varchar | Denormalised from latest `alumni_career` row |
| profile_completion | tinyint (0–100) | Percentage |

**Conversion idempotency:** `unique(sub_institute_id, student_id)` — converting same student twice returns the existing record.

**Consent defaults to 0:** An auto-converted student has NOT consented to contact until explicitly recorded.

**No payment gateway in v1:** Donations are recorded offline only.

## 4. User flows

**Convert students:**
1. Open Conversion screen.
2. Select academic year / batch.
3. Select students who have passed/left.
4. Confirm conversion — alumni rows created.

**Manual add:**
1. Open Add Alumni.
2. Fill personal details.
3. Save — status = `registered`.

**Verify:**
1. Open Pending Verification.
2. Review profile.
3. Approve or reject with remarks.

**Import:**
1. Open Import screen.
2. Upload Excel file.
3. Preview → confirm import.

## 5. Data model

| Table | Key columns | Notes |
|---|---|---|
| `alumni` | id, sub_institute_id, alumni_code, student_id, source, full_name, email, mobile, passing_year, batch, status, consent_*, profile_completion | Core record |
| `alumni_career` | alumni_id, company, industry, job_title, is_current, start_date | Career history |
| `alumni_education` | alumni_id, institution, degree, year | Education history |
| `alumni_activity` | alumni_id, activity_type, points, created_at | Engagement points log |
| `alumni_import_*` | (from 2026_10_13 migration) | Import staging tables |

Indexes: tenant+status, tenant+batch, tenant+passing_year, tenant+geo, tenant+industry, tenant+email, tenant+mobile.

## 6. APIs

Inferred from `alumni-api` client in `app/alumni/_lib/alumni-api.ts`:

| Method | Endpoint | Auth | Notes |
|---|---|---|---|
| GET | `api/alumni/dashboard` | JWT | Dashboard metrics |
| GET | `api/alumni` | JWT | List with filters |
| POST | `api/alumni` | JWT | Create |
| GET | `api/alumni/{id}` | JWT | Single record |
| POST | `api/alumni/{id}` | JWT | Update |
| POST | `api/alumni/convert` | JWT | Convert students |
| POST | `api/alumni/import` | JWT | Bulk import |

## 7. UI components & design tokens
- `AlumniStatusBadge`, `Banner`, `EmptyState`, `LoadingBlock`, `MetricTile`, `PageFrame`, `Panel` — custom alumni UI components (`app/alumni/_components/alumni-ui.tsx`)
- Recharts `BarChart`, `ResponsiveContainer`
- Lucide icons via design system

## 8. Reports & exports
- `/alumni/reports` — TBD
- `AlumniMasterExport.php` — Excel export of alumni master data

## 9. Test cases

| ID | Scenario | Steps | Expected result | Type |
|---|---|---|---|---|
| TC-ALU-01 | Convert graduating students | Select batch, convert | Alumni rows created | Happy |
| TC-ALU-02 | Convert same student twice | Repeat conversion | Existing record returned (idempotent) | Edge |
| TC-ALU-03 | Add manual alumni | Fill form, save | Record with source=manual | Happy |
| TC-ALU-04 | Verify pending alumni | Approve | Status → verified | Happy |
| TC-ALU-05 | Reject with remarks | Reject | Status unchanged, remarks stored | Happy |

## 10. Known issues, limitations & FAQs
- Alumni portal auth migration (`2026_10_14`) is marked "NOT APPLIED TO PRODUCTION: needs explicit approval".
- **FAQ:** Can alumni self-register? Via the alumni portal (`/alumni-portal`), but only once the auth migration is applied.
- **FAQ:** Is online donation supported? No — offline recording only in v1 (by design).

## 11. Sales notes
- Build a lifelong relationship with graduates; track career journeys.
- Demo: convert Std 12 batch → see dashboard populate with industry/location data.
- Differentiator: consent management built-in from day one.

## 12. v1 status & v2 ideas
- **Complete:** Conversion, manual add, directory, verification, import, dashboard, donation recording, engagement.
- **Partial:** Alumni portal auth (migration not yet applied to production).
- **v2 ideas:** Online donation gateway, LinkedIn sync, alumni event management, job board.

## Source files
- `C:\rajesh\lms_k12\app\alumni\dashboard\page.tsx`
- `C:\rajesh\lms_k12\app\alumni\_lib\alumni-api.ts` (inferred)
- `F:\xampp\htdocs\next_lms_erp\database\migrations\2026_10_10_100000_create_alumni_core_tables.php`
- `F:\xampp\htdocs\next_lms_erp\database\migrations\2026_10_11_100000_create_alumni_engagement_tables.php`
- `F:\xampp\htdocs\next_lms_erp\database\migrations\2026_10_13_100000_create_alumni_donation_tables.php`
- `F:\xampp\htdocs\next_lms_erp\app\Exports\AlumniMasterExport.php`

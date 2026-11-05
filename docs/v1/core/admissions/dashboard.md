# Admissions Dashboard
**Product:** Scholar Core | **Module:** Admissions | **Frontend route:** `/admissions/dashboard` | **v1 status:** Complete

| Field | Value |
|---|---|
| Backend routes | `POST /api/admissions-dashboard/summary` (via Next.js proxy `/api/admissions/dashboard/summary`) |
| Roles | Admin, Admissions Staff, Principal |
| Last updated | 2026-11-04 |
| Source commit | 8fe500dc (FE) / 86261072 (BE) |

## 1. Purpose & users

The Admissions Dashboard is the landing page for the Admissions module. It gives admissions staff and school leadership a real-time snapshot of the current academic year's enquiry pipeline — total enquiries, applications, registrations, and conversion rate — without navigating to individual lists. It is used daily during the admission season to monitor volume and pipeline health.

**Primary users:** Admissions coordinator, Principal, Management  
**When used:** Daily during admission season; at-a-glance throughout the year.

## 2. Screens

### Dashboard (single screen)
**Route:** `/admissions/dashboard`  
**What is shown:**
- 4 KPI tiles: Total enquiries, Total applications, Total registrations, Conversion rate
- Chart: Enquiries by standard (bar or count per grade)
- Chart: Registrations by status (funnel/count)
- Panel: Recent enquiries (latest 5–10 rows)
- Customize dashboard button (per-user widget visibility toggle)
- Refresh button

**Main actions:** Refresh data, customize visible widgets (show/hide individual KPI tiles and charts per user preference).

![](./screenshots/admissions-dashboard.png)

## 3. Features & business rules

### KPI Widgets

| Widget ID | Label | Calculation | Source |
|---|---|---|---|
| `kpi.enquiries` | Enquiries | Count of `admission_enquiry` rows for `syear` + `sub_institute_id` | Backend aggregate |
| `kpi.applications` | Applications | Count of `admission_form` rows | Backend aggregate |
| `kpi.registrations` | Registrations | Count of `admission_registration` rows | Backend aggregate |
| `kpi.conversion_rate` | Conversion rate | `(registrations / enquiries) * 100`, rounded | Backend aggregate |
| `chart.enquiries_by_grade` | Enquiries by grade | Group enquiries by `admission_standard` | Backend aggregate |
| `chart.registrations_by_status` | Registrations by status | Group registrations by `status` | Backend aggregate |
| `panel.recent_enquiries` | Recent enquiries | Last N enquiry rows ordered by `created_on` | Backend aggregate |

### Widget customization
- Each widget has a stable ID. User preferences are stored per user via `dashboard-preferences` API (`PUT /api/dashboard-preferences/module.admissions`).
- Hidden widgets never flash in on load — the page waits for both data and preferences before rendering.
- If all widgets are hidden, an "All widgets hidden" notice is shown with a restore option.

### Session requirements
- Requires `sub_institute_id` and `academic_year_id` in session (`localStorage: userData, menuContext, selectedAcademicYear`).
- If session is missing, an inline error is shown; no data is fetched.

### Caching
- Backend endpoint has a 60-second cache (`middleware('api.cache:60')`).

## 4. User flows

### Happy path
1. User navigates to Admissions → Dashboard.
2. Session is read from `localStorage`.
3. POST request is made to `/api/admissions/dashboard/summary` with `sub_institute_id`, `syear`, `user_id`.
4. User's widget preferences are loaded from `/api/dashboard-preferences/module.admissions`.
5. KPI tiles render with totals; charts and recent enquiries panel render below.
6. User can click Refresh to re-fetch data.

### Alternate: Customize widgets
1. User clicks "Customize dashboard".
2. Widget toggle panel opens.
3. User toggles individual widgets on/off.
4. Preferences are saved to backend immediately.
5. Dashboard re-renders showing only visible widgets.

### Error path
- If session is missing: inline error "No active session found. Sign in and pick an academic year."
- If API fails: inline error with message from Laravel response or generic "Couldn't load" message.

## 5. Data model

### Tables used (read-only by dashboard)

| Table | Key columns | Purpose |
|---|---|---|
| `admission_enquiry` | `id, syear, sub_institute_id, admission_standard, created_on` | Enquiry count + by-grade chart |
| `admission_form` | `id, sub_institute_id, syear` | Application count |
| `admission_registration` | `id, sub_institute_id, status` | Registration count + by-status chart |

### Dashboard preferences (per user)
- Stored via `UserDashboardPreferenceApiController`; key: `module.admissions`
- Widget IDs: `kpi.enquiries`, `kpi.applications`, `kpi.registrations`, `kpi.conversion_rate`, `chart.enquiries_by_grade`, `chart.registrations_by_status`, `panel.recent_enquiries`

## 6. APIs

| Method | Endpoint | Auth | Request body | Response |
|---|---|---|---|---|
| POST | `/api/admissions/dashboard/summary` (Next.js proxy) | Bearer JWT | `{ sub_institute_id, syear, user_id }` | `{ summary: { total_enquiries, total_applications, total_registrations, conversion_rate }, registrations_by_status[], enquiries_by_standard[], recent_enquiries[] }` |
| POST | `/api/admissions-dashboard/summary` (Laravel direct) | JWT | Same | Same |
| GET/PUT | `/api/dashboard-preferences/module.admissions` | JWT | `{ widgets: { [id]: boolean } }` | `{ preferences }` |

**Error cases:**
- 401: JWT invalid → "Token Auth Failed"
- 500: DB error → generic error message

## 7. UI components & design tokens

| Component | Source | Used for |
|---|---|---|
| `PageFrame`, `PageHeader`, `InlineMessage` | `app/fees/_components/fees-shared` | Page layout and error display |
| `AdmissionsDashboard` | `app/admissions/_components/admissions-dashboard` | KPI tiles |
| `EnquiriesByStandardPanel` | Same | Enquiries by grade chart |
| `AdmissionsFunnelPanel` | Same | Registrations by status chart |
| `RecentEnquiriesPanel` | Same | Recent enquiries table |
| `CustomizeDashboard`, `AllWidgetsHiddenNotice` | `app/dashboard/_components/CustomizeDashboard` | Widget visibility |
| `Button` | `components/ui/button` | Refresh, Customize |
| `Loader2`, `RefreshCw` | `lucide-react` | Loading and refresh icons |
| Design tokens | `--action-primary`, `--surface-*` | TBD — shared from `styles.css` |

## 8. Reports & exports

No reports or exports are generated from the dashboard itself. It is a read-only summary view. Navigate to [Admissions Reports](./reports.md) for exportable reports.

## 9. Test cases

| ID | Scenario | Steps | Expected result | Type |
|---|---|---|---|---|
| AD-D-01 | Dashboard loads with valid session | Log in, navigate to `/admissions/dashboard` | KPI tiles show counts, charts render | Happy |
| AD-D-02 | Refresh button re-fetches data | Click Refresh | Loading spinner shows, data updates | Happy |
| AD-D-03 | Missing session | Clear `localStorage`, navigate to dashboard | Inline error "No active session found" | Negative |
| AD-D-04 | Hide all widgets | Customize → toggle all off | "All widgets hidden" notice appears | Edge |
| AD-D-05 | Widget preference persists | Hide a widget, reload page | Widget remains hidden | Happy |
| AD-D-06 | API error | Backend returns 500 | Inline error message shown; no crash | Negative |

## 10. Known issues, limitations & FAQs

- **Conversion rate definition:** Currently calculated as `registrations / enquiries`. Schools may expect it to mean `confirmed admissions / enquiries`. Clarify with product owner.
- **No date filter:** Dashboard always shows the full current academic year. No drill-down by month.
- **Charts are non-interactive:** "Details" button on chart panels is present in the UI but does not navigate anywhere (stub).
- **Pagination in recent enquiries:** Shows a fixed recent count — no "see all" link to the roster.

**FAQ:**
- *Why do I see zero enquiries?* — Check that the correct academic year is selected in the session dropdown.
- *Can I export the dashboard?* — No. Use Admissions Reports for exports.

## 11. Sales notes

**Selling points:**
- Real-time admission funnel at a glance — no manual counting from spreadsheets.
- Per-user customizable widgets so each role sees only what matters to them.
- Charts show grade-wise demand and pipeline bottlenecks instantly.

**Demo flow (3 steps):**
1. Log in as Admissions Coordinator → land on the dashboard showing live totals.
2. Click "Customize dashboard" → hide conversion rate → show only enquiry and application KPIs.
3. Point to Enquiries by Grade chart → show which standard has the highest demand.

**Pricing:** TBD (included in Scholar Core base plan).

## 12. v1 status & v2 ideas

**v1 complete:** KPI tiles, by-grade chart, by-status chart, recent enquiries panel, widget customization, refresh, session guard, 60-second cache.

**v1 partial:** Chart "Details" buttons are present but non-functional (stub).

**v2 ideas:**
- Clickable charts that drill into filtered enquiry/registration lists.
- Date range filter (month/week/custom).
- Trend sparklines (this week vs. last week).
- Counsellor-wise performance breakdown.
- Conversion funnel with stage-by-stage drop-off rates.

## Source files

- `C:\rajesh\lms_k12\app\admissions\dashboard\page.tsx`
- `C:\rajesh\lms_k12\app\admissions\_lib\admissions-dashboard-api.ts`
- `C:\rajesh\lms_k12\app\admissions\_components\admissions-dashboard.tsx`
- `F:\xampp\htdocs\next_lms_erp\app\Http\Controllers\api\AdmissionsDashboardApiController.php`
- `F:\xampp\htdocs\next_lms_erp\routes\api.php` (line 149)

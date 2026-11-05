# Fees Dashboard
**Product:** Scholar Core | **Module:** Fees | **Frontend route:** `/fees/dashboard` | **v1 status:** Complete

| Field | Value |
|---|---|
| Backend routes | `POST /api/fees-dashboard/summary`, `POST /api/fees-dashboard/defaulters` |
| Roles | Admin, Accountant, Principal |
| Last updated | 2026-11-04 |
| Source commit | 8fe500dc (FE) / 86261072 (BE) |

## 1. Purpose & users
Gives a single-screen summary of fee collection health for the current academic year. Used by accountants and principals at the start of every working day to check how much has been collected, what is outstanding, and how many students are defaulters. The user can customize which widgets are shown.

## 2. Screens

### Fees Dashboard (main)
**Route:** `/fees/dashboard`
Shows four KPI cards and up to three charts. Data loads automatically on page mount using the active session's `subInstituteId` and `academicYearId`.

**KPI widgets (all hideable per user):**
- Collected this term (`kpi.collected_this_term`)
- Outstanding (`kpi.outstanding`)
- Collection rate (`kpi.collection_rate`)
- Defaulters count (`kpi.defaulters`)

**Chart widgets (all hideable per user):**
- Collection vs target (`chart.collection_vs_target`)
- Head-wise collected vs pending (`chart.headwise`)
- Payment mode mix (`chart.payment_mode_mix`)

**Actions:** Refresh button, Customize dashboard (show/hide widgets per user preference).

![](./screenshots/fees-dashboard.png)

## 3. Features & business rules

| Field | Type | Required | Validation | Default |
|---|---|---|---|---|
| `sub_institute_id` | string | Yes | From `userData` / `menuContext` in localStorage | Current institute |
| `syear` | string | Yes | From `selectedAcademicYear` in localStorage | Current year |
| `user_id` | string | Yes | From `userData` | Current user |
| `month_id` | string | No | If present, scopes "collected this term" to that fee-month bucket | null (whole year) |

**Permission rules:**
- Requires valid JWT + `api.session` middleware.
- `check_permissions` middleware enforces RBAC via `tblgroupwise_rights`.
- Response is cached for 60 seconds (`api.cache:60`).

**Widget preference storage:** Stored per user in `dashboard_preferences` via `PUT /api/dashboard-preferences/module.fees`. Widget IDs are stable — do not rename.

## 4. User flows

**Happy path:**
1. User navigates to `/fees/dashboard`.
2. Page reads `subInstituteId` and `academicYearId` from localStorage.
3. `POST /api/fees-dashboard/summary` is called with those values.
4. KPI cards populate with `collected_display`, `outstanding_display`, `collection_rate_display`, `defaulters_count`.
5. Charts populate from `collection_vs_target`, `headwise`, `payment_mode_mix` arrays.

**Alternate — no active session:**
- Error message: "No active session found. Sign in and pick an academic year to load the fees dashboard."

**Alternate — user hides all widgets:**
- `AllWidgetsHiddenNotice` component is shown.

## 5. Data model

**Table: `fees_collect`** (source for aggregates)

| Column | Type | Notes |
|---|---|---|
| `student_id` | int | FK → `tblstudent` |
| `term_id` | int | Month-year ID (e.g. `42024` = April 2024) |
| `syear` | int | Academic year |
| `sub_institute_id` | int | Tenant/institute |
| `amount` | decimal | Total amount collected in receipt |
| `payment_mode` | varchar | Cash / Cheque / DD / Online |
| `is_deleted` | int | Soft delete flag |

**Aggregates served by:** `FeesDashboardApiController::summary` — joins `fees_collect`, `fees_breakoff`, `tblstudent_enrollment`.

## 6. APIs

| Method | Endpoint | Auth | Request body | Response |
|---|---|---|---|---|
| POST | `/api/fees-dashboard/summary` | JWT (`api.session`) | `sub_institute_id`, `syear`, `user_id`, `month_id?`, `grade_id?`, `standard_id?`, `section_id?` | `{ summary: { collected_display, outstanding_display, collection_rate_display, defaulters_count }, collection_vs_target[], headwise[], payment_mode_mix[], context: { month_label } }` |
| POST | `/api/fees-dashboard/defaulters` | JWT (`api.session`) | `sub_institute_id`, `syear` | Defaulter list |
| GET/PUT | `/api/dashboard-preferences/module.fees` | JWT | Widget visibility map | Saved preferences |

**Error cases:**
- 401 — missing or expired JWT.
- 422 — missing `sub_institute_id` or `syear`.
- Graceful degradation: on network error, an inline amber error banner is shown.

## 7. UI components & design tokens

| Component | Source |
|---|---|
| `PageFrame`, `PageHeader`, `InlineMessage` | `app/fees/_components/fees-shared` |
| `FeesDashboard` (KPI cards) | `app/fees/_components/fees-dashboard` |
| `FeesCharts` | `app/fees/_components/fees-charts` |
| `CustomizeDashboard`, `AllWidgetsHiddenNotice` | `app/dashboard/_components/CustomizeDashboard` |
| `Button` | `components/ui/button` |
| `Loader2`, `RefreshCw` | lucide-react |

**Design tokens used:** `--action-primary`, `--surface-*`, `--content-*`, `--border-*` (from `styles.css`).

## 8. Reports & exports
No direct export from this screen. See [../reports/collection-report.md](../reports/collection-report.md) for detailed collection reports.

## 9. Test cases

| ID | Scenario | Steps | Expected result | Type |
|---|---|---|---|---|
| FD-01 | Dashboard loads with valid session | Log in, navigate to `/fees/dashboard` | KPI cards show non-zero values; charts render | Happy |
| FD-02 | No academic year selected | Clear `selectedAcademicYear` from localStorage, navigate | Error banner: "No active session found..." | Edge |
| FD-03 | Refresh button | Click Refresh | Spinner shows, data reloads | Happy |
| FD-04 | Hide all widgets | Click Customize, hide all widgets | `AllWidgetsHiddenNotice` shown | Edge |
| FD-05 | API returns 401 | Expire JWT, navigate | Error banner shown | Negative |

## 10. Known issues, limitations & FAQs

- `feesAIController` calls `python3 /home/fees_analysis_10_04.py` via `shell_exec` — hardcoded server path, not suitable for multi-server or cloud deployments.
- Dashboard does not support date-range filtering — always shows the full academic year or current term.
- Widget preferences are per-user per-device (localStorage-backed); clearing browser storage resets them.

**FAQ:**
- *"Dashboard shows ₹0 for everything"* — check that `selectedAcademicYear` is set in localStorage and the JWT has not expired.
- *"Collection rate shows 100% but there are defaulters"* — collection rate is demand-based; if demand is not set up in `fees_breakoff`, it may default to collected = 100%.

## 11. Sales notes

**Selling points:**
1. Real-time visibility into collection health without running a report.
2. Customizable widgets — each accountant sees only what they need.
3. AI intelligence button (`/fees/intelligence`) surfaces predictive defaulter analysis powered by Python model.

**Demo flow (3 steps):**
1. Log in as Admin → go to Fees → Dashboard.
2. Show four KPI cards: collected, outstanding, rate, defaulters.
3. Click Customize Dashboard — hide the Payment Mode Mix chart — show widget hide/show working.

**Pricing:** Included in Scholar Core base.

## 12. v1 status & v2 ideas

**v1 complete:** KPI cards, three charts, widget customization, refresh, AI stack link.
**v1 partial:** `feesAIController` Python integration is a proof of concept with a hardcoded file path.
**v2 ideas:**
- Date-range filter on the dashboard.
- Export dashboard snapshot to PDF.
- Push notification when collection rate drops below threshold.
- Replace Python `shell_exec` with a proper AI SDK integration.

## Source files
- `C:\rajesh\lms_k12\app\fees\dashboard\page.tsx`
- `C:\rajesh\lms_k12\app\fees\_components\fees-dashboard.tsx` (referenced)
- `C:\rajesh\lms_k12\app\fees\_components\fees-charts.tsx` (referenced)
- `C:\rajesh\lms_k12\app\fees\_lib\fees-dashboard-api.ts` (referenced)
- `F:\xampp\htdocs\next_lms_erp\app\Http\Controllers\fees\feesAIController.php`
- `F:\xampp\htdocs\next_lms_erp\routes\api.php` (lines 142, 145)

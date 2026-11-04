# Students Dashboard
**Product:** Scholar Core | **Module:** Student | **Frontend route:** `/students/dashboard` | **v1 status:** Complete

| Field | Value |
|---|---|
| Backend routes | `POST /api/students-dashboard/summary` (StudentsDashboardApiController::summary, cached 60s) |
| Roles | Admin, Principal, Coordinator |
| Last updated | 2026-11-04 |
| Source commit | 8fe500dc (FE) / 86261072 (BE) |

## 1. Purpose & users
Module landing page for the Students section. Shows a summary of key student metrics and charts. Used by admin and principal to get an at-a-glance view of enrollment, gender distribution, recent joiners, and attrition.

## 2. Screens

**Students Dashboard** (`/students/dashboard`)
- KPI row: Active students, Classes, Left this year, Retention rate
- Charts row (customizable): Students by class (bar), Gender breakdown (pie/bar)
- Lower row: Recently enrolled students panel, Students who left by reason chart
- "Customize dashboard" button — per-user widget visibility preferences

![](./screenshots/students-dashboard.png)

## 3. Features & business rules

### Widgets (all hideable per user)
| Widget ID | Label | Group |
|---|---|---|
| kpi.active_students | Active students | kpi |
| kpi.classes | Classes | kpi |
| kpi.left_this_year | Left this year | kpi |
| kpi.retention | Retention | kpi |
| chart.students_by_class | Students by class | chart |
| chart.gender_breakdown | Gender breakdown | chart |
| chart.left_by_reason | Students who left, by reason | chart |
| panel.recently_enrolled | Recently enrolled | panel |

Widget visibility is stored per user via `dashboard-preferences` API (`PUT /api/dashboard-preferences/module.students`).

When all widgets are hidden, an `AllWidgetsHiddenNotice` is shown with a "Customize dashboard" prompt.

## 4. User flows

**View dashboard**
1. Navigate to Students → Dashboard.
2. Dashboard loads, fetches session (FeesSession) + summary from `/api/students-dashboard/summary`.
3. KPI cards and charts render. Response is cached for 60 seconds.

**Customize widgets**
1. Click "Customize dashboard".
2. Toggle individual widget visibility.
3. Preferences saved to backend; persist across sessions.

**Refresh**
1. Click the Refresh button.
2. Forces a new `summary` fetch, bypassing cache.

## 5. Data model
Data is returned by `StudentsDashboardApiController::summary`. The exact columns returned are TBD (controller source not read). The frontend expects a `StudentsDashboardPayload` shape defined in `_lib/students-dashboard-api.ts`. Dashboard preferences stored in `user_dashboard_preferences` table (via `UserDashboardPreferenceApiController`).

## 6. APIs
| Method | Endpoint | Auth | Request | Response | Errors |
|---|---|---|---|---|---|
| POST | `/api/students-dashboard/summary` | Session token | Academic year, sub_institute_id | `StudentsDashboardPayload` | 401 session expired |
| GET | `/api/dashboard-preferences/module.students` | Session token | — | Widget visibility map | — |
| PUT | `/api/dashboard-preferences/module.students` | Session token | Widget map | 200 OK | — |

## 7. UI components & design tokens
- `StudentsDashboard` — main layout component
- `StudentsByClassPanel` — bar chart of enrollment by class
- `GenderBreakdownPanel` — gender distribution chart
- `RecentEnrollmentsPanel` — table of recent joiners
- `DropReasonsPanel` — chart of attrition by reason
- `CustomizeDashboard` — widget toggle modal
- `AllWidgetsHiddenNotice` — empty state
- `PageFrame`, `PageHeader` (shared fees/core design components)
- `Button` from `@/components/ui/button`
- Lucide: `Loader2`, `RefreshCw`

## 8. Reports & exports
No export from this screen. For detailed reports, navigate to Student Reports (`/student/report/*`).

## 9. Test cases
| ID | Scenario | Steps | Expected result | Type |
|---|---|---|---|---|
| S-DASH-01 | Dashboard loads | Navigate to /students/dashboard | KPIs and charts render within 3s | Happy |
| S-DASH-02 | Cache hit | Reload within 60s | No new API call (304 / cached) | Edge |
| S-DASH-03 | Hide a widget | Customize → toggle off "Active students" | KPI card disappears; preference saved | Happy |
| S-DASH-04 | Show all hidden | Hide all widgets | AllWidgetsHiddenNotice shown | Edge |
| S-DASH-05 | API error | Backend returns 500 | Error state shown with Refresh option | Negative |

## 10. Known issues, limitations & FAQs
- Summary endpoint is cached at the API layer for 60 seconds; real-time accuracy is limited.
- Widget preferences use the key `module.students` — do not rename without migrating existing preferences.

## 11. Sales notes
**Selling points:** Per-user customizable dashboard; at-a-glance attrition and retention visibility.

**Demo flow:**
1. Show KPI cards updating after adding a student.
2. Toggle widgets off and on to show personalization.

Plan/pricing: TBD

## 12. v1 status & v2 ideas
**Complete:** KPI cards, widget customization, summary API integration.
**Partial:** Chart data contents (need to verify StudentsDashboardPayload fields).
**v2 ideas:** Drill-down from each KPI; export dashboard as PDF; date-range selector.

## Source files
- `C:\rajesh\lms_k12\app\students\dashboard\page.tsx`
- `C:\rajesh\lms_k12\app\students\_components\students-dashboard.tsx`
- `C:\rajesh\lms_k12\app\students\_lib\students-dashboard-api.ts`
- `C:\rajesh\lms_k12\app\dashboard\_components\CustomizeDashboard.tsx`
- `F:\xampp\htdocs\next_lms_erp\routes\api.php` (line 150)

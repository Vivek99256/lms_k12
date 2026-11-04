# Attendance Dashboard
**Product:** Scholar Core | **Module:** Attendance | **Frontend route:** `/attendance/attendance_dashboard` | **v1 status:** Complete

| Field | Value |
|---|---|
| Backend routes | `GET /api/proxy?path=<attendance-api>` via `attendance/_lib/attendance-api.ts` |
| Roles | Admin, Class Teacher, Principal |
| Last updated | 2026-11-04 |
| Source commit | 8fe500dc (FE) / 86261072 (BE) |

## 1. Purpose & users

The Attendance Dashboard is the main landing screen for the student attendance module. It shows real-time attendance metrics, a 30-day attendance trend chart, a doughnut breakdown of present/absent, and a daily register for the selected class. Used by class teachers to quickly mark and monitor, and by the principal for school-wide situational awareness.

## 2. Screens

**Attendance Dashboard** — `/attendance/attendance_dashboard`

| Widget | Description |
|---|---|
| Metric cards | Total Students, Present, Absent counts for the selected class+date |
| Line chart | 30-day attendance trend (Chart.js, react-chartjs-2) |
| Doughnut chart | Present vs. Absent breakdown |
| Daily Register (list/grid toggle) | Student rows with P/A radio buttons; Save button |
| Monthly Overview | Calendar-style month view showing daily totals |
| Customize Dashboard | Show/hide widgets via `useDashboardPreferences` |
| AI Context | Registered via `useRegisterPageAiContext` for AI-stack integration |
| Navigation | Prev/Next date navigation (ChevronLeft/ChevronRight) |

![](./screenshots/attendance-dashboard.png)

## 3. Features & business rules

- Class sections loaded from `fetchClassSections` → returns classes the logged-in teacher is assigned to.
- Daily register loaded from `fetchDailyRegister` → students + existing P/A for the date.
- Attendance saved via `saveAttendance`.
- Trend data from `fetchAttendanceTrend` → 30-day line chart.
- Dashboard widgets are user-customizable and persisted via `useDashboardPreferences` → `GET/PUT /api/dashboard-preferences/attendance`.
- List vs. Grid view toggle for the daily register.
- Uses Chart.js: `CategoryScale`, `LinearScale`, `PointElement`, `LineElement`, `Filler`, `ArcElement` for Line and Doughnut charts.

## 4. User flows

**Happy path:**
1. Teacher opens Attendance Dashboard.
2. Their class(es) auto-load.
3. Today's register shows with existing P/A.
4. Teacher marks attendance, clicks Save.
5. Metric cards update.
6. Principal uses trend chart for the weekly overview.

## 5. Data model

Same `attendance_student` table as mark-attendance. Additional tables for dashboard preferences: TBD (see `dashboard-preferences` API).

## 6. APIs

| Method | Endpoint | Purpose |
|---|---|---|
| GET | `/api/proxy?path=fetchClassSections` | Load teacher's classes |
| GET | `/api/proxy?path=fetchDailyRegister` | Student list + existing P/A for date |
| POST | `/api/proxy?path=saveAttendance` | Save attendance |
| GET | `/api/proxy?path=fetchAttendanceTrend` | 30-day trend data |
| GET/PUT | `/api/dashboard-preferences/attendance` | Widget show/hide preferences |

(Exact proxy paths defined in `app/attendance/_lib/attendance-api.ts`)

## 7. UI components & design tokens

- `MetricCard` — `app/attendance/attendance_dashboard/components/MetricCard`
- `DailyRegister` — `app/attendance/attendance_dashboard/components/DailyRegister`
- `MonthlyOverview` — `app/attendance/attendance_dashboard/components/MonthlyOverview`
- `CustomizeDashboard`, `AllWidgetsHiddenNotice` — `app/dashboard/_components/CustomizeDashboard`
- `useDashboardPreferences` — `app/dashboard/_lib/useDashboardPreferences`
- Charts: `Line`, `Doughnut` from `react-chartjs-2`
- Icons: `ChevronLeft`, `ChevronRight`, `Download`, `Loader2`, `Save`, `Users`, `UserCheck`, `UserX`, `List`, `Grid` — Lucide

## 8. Reports & exports

Export: `Download` button present in UI. Format and backend route TBD (not yet wired in source).

See also:
- [Daywise Attendance Report](./daywise-report.md)
- [Monthwise Attendance Report](./monthwise-report.md)
- [Yearly Attendance Report](./yearly-report.md)

## 9. Test cases

| ID | Scenario | Steps | Expected result | Type |
|---|---|---|---|---|
| AD-01 | Dashboard loads for teacher | Log in as class teacher, open dashboard | Metric cards, charts, and register for assigned class | Happy |
| AD-02 | Customize dashboard | Click Customize, hide trend chart, reload | Trend chart hidden on reload (preference persisted) | Happy |
| AD-03 | Date navigation | Click ChevronRight to go to next day | Register updates for next date | Happy |
| AD-04 | Save attendance from dashboard | Mark some absent, save | Success message; metric cards update | Happy |
| AD-05 | All widgets hidden | Hide all widgets | `AllWidgetsHiddenNotice` shown | Edge |

## 10. Known issues, limitations & FAQs

- Download button present in UI but export endpoint TBD in source.
- Dashboard widget preferences are per-user via `/api/dashboard-preferences/attendance` — if that endpoint is unavailable, widget customization silently fails.
- **FAQ:** "My dashboard shows the wrong class." — The class list comes from `class_teacher` assignments. Update the assignment from Academic Setup.

## 11. Sales notes

**Selling points:**
- Trend chart and doughnut give the principal an instant visual snapshot.
- Customizable widgets per user.
- Inline attendance marking — no separate screen needed for teachers.

**Demo flow:**
1. Log in as a class teacher — show metric cards for today.
2. Mark a few students absent — show live counter update.
3. Switch to principal account — show school-wide trend chart.

**Plan/pricing:** TBD

## 12. v1 status & v2 ideas

**Complete:** Metric cards, trend chart, doughnut, daily register, monthly overview, widget customization, AI context registration.

**Partial:** Download/export not wired.

**v2 ideas:**
- Push absent-student alert to parents automatically on save.
- Heatmap calendar for monthly overview.
- Comparative trend: this week vs. same week last year.

## Source files

- Frontend page: `C:\rajesh\lms_k12\app\attendance\attendance_dashboard\page.tsx`
- API lib: `C:\rajesh\lms_k12\app\attendance\_lib\attendance-api.ts`
- Components: `C:\rajesh\lms_k12\app\attendance\attendance_dashboard\components\`

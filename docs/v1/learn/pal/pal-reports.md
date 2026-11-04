# PAL — Reports

Last updated: 2026-11-04
Generated from commit: `8fe500dc` (frontend) / `86261072` (backend)

> Source of truth: `app/pal/reports/activity/page.tsx`, `app/pal/reports/attainment/page.tsx`

---

## Activity & Performance Report

**Route:** `/pal/reports/activity`
**Audience:** Student (own), Teacher (via "view as")

### Summary Stats

| Stat | Source field |
|---|---|
| Nodes mastered | `masteryOverview.mastered` / `masteryOverview.nodesTotal` |
| Diagnostic attempts | `diagnosticPerformance.attemptsCount` |
| Adaptive accuracy | `adaptivePerformance.accuracy` (%) |

### Sections

| Section | Description |
|---|---|
| Scope | Learner name · Standard · Section · Subject |
| Mastery by chapter | Bar chart + detail table (mastered / learning / unseen per chapter) |
| Diagnostic performance over time | Trend chart (`diagnosticPerformance.trend`) |
| Top misconceptions | Chart + detail table: tag, description, corrective action, detection count |
| Engagement / Gamification | Placeholder card (shows "insufficient data" flag when data is sparse) |
| Learning intelligence | AI-generated narrative (`intelligence` field from API) |
| Recommendations | Bulleted list from API (`recommendations[]`) |

### Filters

| Filter | Type |
|---|---|
| Subject ID | Text input (all subjects if blank) |
| From date | Date picker |
| To date | Date picker |

### Export

Download as `.docx` via `fetchActivityReportDocx('student', studentId, syear, filters)`.

---

## Attainment Report

**Route:** `/pal/reports/attainment`
**Audience:** TBD

The attainment report page exists and mirrors the activity report's shape (Suspense wrapper, `syear` from `buildSessionContext()`, amber error cards). Full field details: TBD — source not read in full.

---

## Role Gate (both reports)

- Student: sees own report immediately on load
- Teacher: sees `StudentPicker` first; after selecting a learner, `ViewAsBanner` is shown and the report loads for that learner
- Role resolved from `isStudentSession()` in `app/pal/data/pal-lookups.ts`; persisted view from `pal-view-as.ts`

---

## API

| Function | Purpose |
|---|---|
| `fetchStudentActivityReport(studentId, syear, filters)` | Returns full `StudentActivityReport` |
| `fetchActivityReportDocx(type, id, syear, filters)` | Returns `.docx` blob for download |

Source: `app/pal/data/pal-activity-report.ts`

---

## Source Files

- `app/pal/reports/activity/page.tsx`
- `app/pal/reports/attainment/page.tsx`
- `app/pal/data/pal-activity-report.ts`
- `app/pal/reports/_components/ActivityMasteryChart.tsx`
- `app/pal/reports/_components/ActivityDiagnosticTrendChart.tsx`
- `app/pal/reports/_components/ActivityMisconceptionChart.tsx`
- `app/pal/reports/_components/EngagementPlaceholderCard.tsx`
- `app/pal/reports/_components/LearningIntelligenceSection.tsx`

# Enterprise Brain — Overview Dashboard

Last updated: 2026-11-04
Generated from commit: `8fe500dc` (frontend) / `86261072` (backend)

---

## Purpose

The home screen of the Enterprise Brain product. Presents a live, customisable summary of the intelligence state — KPIs, strengths/risks/opportunities, health scores, recent findings, and priority actions — derived from running the Intelligence Loop over the institute's LMS data.

---

## Menu path

Enterprise Brain → Dashboard (or: home route of the Enterprise Brain product)

---

## Frontend route

`/enterprise-brain`

Source: `app/enterprise-brain/page.tsx` (~1,000 lines)

---

## Customisation

Every widget on this dashboard can be hidden per user via `useDashboardPreferences('brain.home', HOME_WIDGETS)`. Preferences are stored server-side under the user's account; they persist across sessions and devices.

---

## Widgets

### KPI tiles

| Widget ID | Label | Metric |
|---|---|---|
| `kpi.departments` | Departments | Count of departments in the institute |
| `kpi.people` | People | Count of staff |
| `kpi.students` | Students | Count of enrolled students |
| `kpi.capabilities` | Capabilities | AI capabilities active in this institute |
| `kpi.signals` | Signals | Open intelligence signals |
| `kpi.evidence` | Evidence | Evidence records supporting current signals |
| `kpi.recommendations` | Recommendations | Active recommendations |
| `kpi.decisions` | Decisions | Decisions logged against recommendations |
| `kpi.executions` | Executions | Actions executed against decisions |
| `kpi.outcomes` | Outcomes | Outcomes recorded against executions |

### Organization intelligence panel

Three sub-panels showing what the Brain has concluded:

| Sub-panel | Description |
|---|---|
| Strengths | Dimensions where the institute is performing above baseline |
| Risks | Signals flagged as Watch or higher severity |
| Opportunities | Recommendations not yet actioned |

### Organization health

A set of dimension health dials. Each dimension has a score from 0–100 with four bands:

| Band | Score range | Colour |
|---|---|---|
| Good | 75–100 | Green |
| Watch | 50–74 | Amber |
| At risk | 25–49 | Orange |
| Critical | 0–24 | Red |

### What changed

A chronological list of signals whose status has changed (new, resolved, severity shifted) since the last loop run.

### At risk

A focused view of entities (departments, classes, individuals) currently in the At risk or Critical band.

### Class attendance intelligence

Attendance rate by class with a baseline comparison. Shows deviation from the institute's rolling average.

### Cross module

Findings that span more than one Scholar Suite module (e.g. a correlation between attendance drops and fee arrears).

### Top findings

The highest-severity open signals, ordered by severity then age.

### Priority actions

Recommendations ordered by the Brain's calculated impact score. Actionable from this panel (links to the Decision screen).

### Intelligence tools

Quick links to the full Intelligence Loop, Knowledge, Analytics, and Decision Intelligence screens.

---

## Data freshness indicator

The dashboard header shows two timestamps:
1. When the LMS data was last read (source freshness).
2. When the intelligence findings were last recomputed (loop freshness).

If the loop has not run in more than 24 hours, a stale-data warning is shown.

---

## RBAC

| Action | Required right |
|---|---|
| View Enterprise Brain | `enterprise_brain.dashboard` |
| Customize widget layout | Any authenticated user (per-user preference) |

---

## Source files

- Frontend: `app/enterprise-brain/page.tsx`
- Dashboard preferences: `app/dashboard/_lib/useDashboardPreferences.ts`
- API client: `lib/brain/api.ts`

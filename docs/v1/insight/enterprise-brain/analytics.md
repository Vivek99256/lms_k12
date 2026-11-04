# Analytics

Last updated: 2026-11-04
Generated from commit: `8fe500dc` (frontend) / `86261072` (backend)

---

## Purpose

Executive-level and decision intelligence views of the Enterprise Brain's findings. Provides structured reports for principal, director, and AI Admin roles.

---

## Menu path

Enterprise Brain → Analytics

---

## Frontend routes

| Route | Description |
|---|---|
| `/enterprise-brain/analytics/executive` | Executive summary dashboard |
| `/enterprise-brain/analytics/decision-intelligence` | Decision intelligence report |

Source: `app/enterprise-brain/analytics/executive/page.tsx`, `app/enterprise-brain/analytics/decision-intelligence/page.tsx`

---

## Executive analytics

### Component

`<ScreenView screen="executive" />` — a named screen view rendered by the Brain's screen-view framework. The framework loads the correct panel configuration for the `executive` screen identifier.

### Audience

Principal, Director, and senior leadership. This view summarises what the Brain has found without exposing the full reasoning chain (which is in the Intelligence Loop screen).

### Content (from screen view config)

- Overall health score with band indicator
- Top strengths (dimensions performing above baseline)
- Top risks (highest-severity open signals)
- Priority recommendations (highest impact, unanswered)
- Cross-module intelligence highlights
- Trend over the last 30 and 90 days

### Export

PDF export from this screen (see Reports Catalog: Executive Analytics Report).

---

## Decision intelligence

### Purpose

Tracks the lifecycle of decisions: which recommendations were acted upon, what was decided, how the execution went, and what the outcome was. Closes the feedback loop for the Brain's recommendations.

### Decision record fields

| Field | Notes |
|---|---|
| Recommendation | The Brain recommendation this decision responds to |
| Decision type | `approve`, `defer`, `reject`, `acknowledge` |
| Decided by | User |
| Decided at | Timestamp |
| Notes | Free-text rationale |
| Status | `open`, `in-execution`, `closed` |

### Execution record fields

| Field | Notes |
|---|---|
| Decision | Parent decision |
| Action taken | Description of what was done |
| Executed by | User |
| Executed at | Timestamp |
| Evidence | Supporting evidence records linked to this execution |

### Outcome record fields

| Field | Notes |
|---|---|
| Execution | Parent execution |
| Outcome description | What changed |
| Signal resolved | Boolean — whether the original signal was resolved |
| Measured at | Timestamp |

### View

The decision intelligence screen shows the full S→E→C→H→R→D→E→O chain for each signal, from signal to outcome, so the leadership can see whether actions taken actually resolved the Brain's findings.

---

## RBAC

| Action | Required right |
|---|---|
| View executive analytics | `enterprise_brain.analytics` |
| View decision intelligence | `enterprise_brain.analytics` |
| Record a decision | `enterprise_brain.decisions` (write) |
| Record an execution | `enterprise_brain.decisions` (write) |
| Record an outcome | `enterprise_brain.decisions` (write) |

---

## Source files

- Frontend: `app/enterprise-brain/analytics/executive/page.tsx`, `app/enterprise-brain/analytics/decision-intelligence/page.tsx`
- Backend tables: `decision_intelligence`, `eso_executions`, `eso_execution_evidence`

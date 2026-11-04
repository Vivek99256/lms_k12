# Intelligence Loop

Last updated: 2026-11-04
Generated from commit: `8fe500dc` (frontend) / `86261072` (backend)

---

## Purpose

Makes the Brain's reasoning fully auditable. Every signal has a traceable chain: the LMS rows that triggered it → the evidence records → the case built from that evidence → the hypothesis and its root-cause family → the numbered reasoning steps with confidence scores → the recommendation that follows. This screen exists to answer "how do you know, and why do you think that?" — not just to summarise findings.

---

## Menu path

Enterprise Brain → Intelligence Loop

---

## Frontend route

`/enterprise-brain/intelligence-loop`

Source: `app/enterprise-brain/intelligence-loop/page.tsx`

---

## Intelligence loop stages

The pipeline has eight named stages displayed as a strip at the top of the screen:

```
Signal → Evidence → Case → Hypothesis → Reasoning → Recommendation → Decision → Execution → Outcome
```

Each stage has a count (how many entities are currently at that stage) and a status indicator.

---

## What the screen shows

### Signal stream (left panel)

A list of all current signals. Each row shows:
- Signal title (the finding in plain language)
- Severity chip: `info`, `low`, `medium`, `high`, `critical`
- Headline metric (the number that drove the signal) and its change label
- Owner (the department or role responsible)

Clicking a signal opens the full reasoning chain in the right panel.

### Reasoning chain (right panel)

Opened on signal selection:

| Section | Contents |
|---|---|
| Intelligence card | The full signal record (expanded by default) |
| Metric tiles | Evidence count, reasoning step count, recommendation count |
| Reasoning steps | Numbered ordered list; each step is a plain-language description of one reasoning move |
| Root-cause family | The overarching pattern the Brain assigned (e.g. `ownership_gap`, `capacity_constraint`) |
| Evidence records | The actual LMS rows that support the signal, rendered as labelled key-value facts (not raw JSON) |
| Recommendations | One card per recommendation; shows title, description, scale, and a confidence meter |

### Checks currently failing (bottom left)

A table of rules whose conditions are currently true — these are the checks that generated the visible signals. Each row shows the rule key, its family, severity, and action.

### Checks that found nothing (bottom right)

A table of rules that evaluated but found no issue. This is intentional: an empty section would look like the engine had not run. Showing clean checks gives the administrator confidence that those dimensions are genuinely healthy.

---

## Run intelligence

A "Run intelligence" button at the top right re-evaluates all rules against the live LMS data. On completion, a banner shows:
- Rules evaluated
- New signals created
- Signals refreshed
- New recommendations produced
- Elapsed time (ms)

The page data is refreshed automatically after a run.

---

## Customisation

Widgets on this screen can be hidden per user via `useDashboardPreferences('brain.intelligence-loop', LOOP_WIDGETS)`. Hidden panels do not flash in on load.

Customisable widgets: Loop stages strip, four charts (by severity, by classification, by root-cause family, by recommendation category), Signal stream panel, Checks failing table, Checks passing table.

---

## Charts

| Chart | X-axis | Y-axis |
|---|---|---|
| How serious | Severity level | Signal count |
| What kind of finding | Classification | Signal count (top 8) |
| Why they happen | Root-cause family | Signal count (top 8) |
| What they ask for | Recommendation category | Recommendation count |

---

## RBAC

| Action | Required right |
|---|---|
| View Intelligence Loop | `enterprise_brain.intelligence_loop` |
| Run intelligence | `enterprise_brain.intelligence_loop` (write) |

---

## Source files

- Frontend: `app/enterprise-brain/intelligence-loop/page.tsx`
- API: `lib/brain/api.ts` — `fetchIntelligence`, `fetchSignalDetail`, `runIntelligence`
- Backend tables: `department_scoped_signals`, `evidence_ledger`, `eso_executions`

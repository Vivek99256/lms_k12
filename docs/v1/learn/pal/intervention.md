# PAL — Intervention (Support Cases)

Last updated: 2026-11-04
Generated from commit: `8fe500dc` (frontend) / `86261072` (backend)

> Source of truth: `app/pal/intervention/page.tsx`

---

## Purpose

The Intervention screen is the support-case queue for staff (teachers and admins). It lists every learner that the adaptive engine has escalated because it can no longer help them unaided. Staff review, take ownership, and close cases here.

A student who opens this URL sees an explanation card — not the queue — with a link back to their subjects.

---

## Who Sees What

| Role | View |
|---|---|
| Student | Explanation card: "Support cases are managed by your teacher." Link to `/pal`. |
| Teacher / Admin | Full queue |

---

## Case Lifecycle

Cases follow SOP 6.13 from `lib/process/sop-catalog.ts`:

```
created → open → (assigned / pending_approval) → closed
                                                 ↘ escalated
```

| Status | Meaning |
|---|---|
| `open` | Case created by engine, not yet assigned |
| `pending_approval` | Requires a governance approval before action |
| `approved` | Assigned to a staff member |
| `closed` | Resolved, escalated, or dismissed |

---

## Case Triggers (TRIGGER_LABELS)

Each case has a `trigger_kind` from `pal-intervention.ts`. Trigger labels are shown as chips in the queue list. Exact labels: TBD (defined in `app/pal/data/pal-intervention.ts`).

---

## Risk Levels

| Level | Chip colour |
|---|---|
| `high` | Rose / red |
| `medium` | Amber |
| `low` | Slate |

Cases are sorted by risk level (high first), then by opened date (oldest first).

---

## Queue Filters

| Filter | Options |
|---|---|
| Status | Open, Awaiting approval, Closed, All |
| Risk | All, High, Medium, Low |

---

## Summary Tallies

The queue header shows four tallies: Open, Awaiting approval, High risk, Closed.

---

## Case Row Actions

| Action | Condition |
|---|---|
| Take this | Opens the case to the current staff member |
| Approve | Available when `requires_approval` and `governance_passed = false` |
| Open the concept | Available when `concept_id` is set; links to `/pal/intervention/concept/[conceptId]` |
| Close case | Requires an outcome (Resolved / Escalated / Not needed) and a written closing note |

Closing note is mandatory — it is the auditable record for parent meetings.

---

## Read-Only Mode

If the write API routes are not deployed, the queue renders in read-only mode. An amber banner states the reason. All write actions are disabled with an explanatory tooltip.

---

## "View as Student" Support

Staff can optionally scope the queue to one learner using `StudentPicker` + `ViewAsBanner`. This shows only that learner's cases.

---

## API

| Function | Purpose |
|---|---|
| `fetchInterventions(filters, signal)` | Returns the case queue |
| `updateIntervention(id, { status })` | Updates case status |
| `closeIntervention(id, { outcome, note })` | Closes a case with outcome and note |

Source: `app/pal/data/pal-intervention.ts`

---

## Source Files

- `app/pal/intervention/page.tsx`
- `app/pal/data/pal-intervention.ts`
- `app/pal/_components/StudentPicker.tsx`
- `app/pal/_components/ViewAsBanner.tsx`
- `lib/process/sop-catalog.ts` (BR-06, SOP 6.13)

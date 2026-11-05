# PAL — Pedagogy Engine

Last updated: 2026-11-04
Generated from commit: `8fe500dc` (frontend) / `86261072` (backend)

> Source of truth: `app/pal/pedagogy-engine/page.tsx`

---

## Purpose

The Pedagogy Engine screen exposes the adaptive routing rules, intervention thresholds, and content-selection logic that drive the PAL learning loop. It is an administrative view — teachers and AI admins use it to inspect and (where permitted) configure engine behaviour.

---

## Architecture

The page is a thin server wrapper that delegates entirely to the `PedagogyEngine` client component. No engine logic lives in the page itself.

```
app/pal/pedagogy-engine/page.tsx
  └── <PedagogyEngine /> (client component)
        └── calls /api/pal/pedagogy-engine
```

---

## API

| Endpoint | Method | Purpose |
|---|---|---|
| `/api/pal/pedagogy-engine` | GET | Returns current engine rules, thresholds and configuration |
| `/api/pal/pedagogy-engine` | POST/PATCH | TBD — write routes not confirmed in source |

---

## Engine Responsibilities (from related source files)

The engine drives the following decisions at runtime:

1. **Diagnostic routing** — which diagnostic question to serve next for a given concept
2. **Mastery estimation** — BKT probability update after each attempt
3. **Adaptive practice selection** — selecting the next practice item based on mastery state
4. **Remediation** — switching to a remediation sequence when mastery probability drops below threshold
5. **Escalation** — opening a support case (intervention) when remediation cycles fail (see BR-06 in `lib/process/sop-catalog.ts`, SOP 6.13)
6. **Recall scheduling** — scheduling recall reviews for mastered concepts

---

## SOP Reference

The intervention escalation path is defined in `lib/process/sop-catalog.ts`:
- **BR-06**: Escalate to teacher after two failed remediation cycles
- **SOP 6.13**: Support case lifecycle — create, assign, monitor, close, escalate

---

## Source Files

- `app/pal/pedagogy-engine/page.tsx`
- `app/api/pal/pedagogy-engine/route.ts`
- `lib/process/sop-catalog.ts`

# Governance

Last updated: 2026-11-04
Generated from commit: `8fe500dc` (frontend) / `86261072` (backend)

---

## Purpose

AI governance dashboard — oversight of how AI capabilities are being used, what policies are active, whether policy thresholds are being breached, and what the audit trail shows across the institute.

---

## Menu path

Enterprise Brain → Governance

---

## Frontend route

`/enterprise-brain/governance`

---

## Screen areas

### Policy compliance overview

Shows active AI policies and their compliance status across the institute. For each policy:

| Column | Description |
|---|---|
| Policy name | From the AI Policies catalogue |
| Scope | Institute / department / class / assignment |
| Submissions checked | Total submissions that triggered this policy |
| Flagged | Submissions that exceeded the detection threshold |
| Compliance rate | Percentage below threshold |

### Recent governance events

A chronological feed of governance-relevant events:

- Policy created or retired
- Submission flagged by detection
- Student disclosure recorded
- Detection threshold exceeded
- Agent run against a governance-scoped rule

### AI usage health

Summary view of AI capability usage across modules — which capabilities are live, which are in-progress, and whether any are showing unusual usage patterns (e.g. token spike, error rate spike).

### Open findings

Intelligence Loop signals specifically tagged as governance-related (root-cause families: `policy_gap`, `compliance_risk`, `detection_anomaly`).

---

## Reports

The AI Governance Report (Excel/on-screen) is accessible from this screen. See the Insight Reports Catalog for column detail.

---

## RBAC

| Action | Required right |
|---|---|
| View Governance | `enterprise_brain.governance` |

---

## Related screens

- AI Administration → AI Policies — where policies are authored
- AI Administration → AI Audit — full interaction and admin event log
- Enterprise Brain → Intelligence Loop — full signal reasoning chain

---

## Source files

- Frontend: `app/enterprise-brain/governance/page.tsx`
- Backend table: `ai_governance`

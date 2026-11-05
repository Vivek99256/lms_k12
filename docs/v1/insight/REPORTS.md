# Scholar Insight — Reports Catalog

Last updated: 2026-11-03
Generated from commit: `8fe500dc` (frontend) / `86261072` (backend)

> Catalog of all reports in Scholar Insight (Enterprise Brain).

---

## AI Administration Reports

| Report Name | Module/Menu | Frontend Route | Roles | Key Filters | Export | Data Source |
|---|---|---|---|---|---|---|
| AI Usage & Cost Report | AI Admin → Usage & Cost | `/ai/usage-cost` | AI Admin, Super Admin | Date range, Model, Module, Tenant | Excel, On-screen | `ai_usage_events`, `ai_daily_used_api` |
| AI Audit Log | AI Admin → Audit | `/ai/audit` | AI Admin, Auditor | Date range, User, Module | Excel | `ai_interaction_logs`, `mcp_audit_logs` |
| AI Interaction Log | AI Admin → Audit | `/interactions/ai-stack` | AI Admin | Date range, Type | Excel | `ai_interaction_logs` |

---

## Enterprise Brain Reports

| Report Name | Module/Menu | Frontend Route | Roles | Key Filters | Export | Data Source |
|---|---|---|---|---|---|---|
| Executive Analytics | Enterprise Brain → Analytics | `/enterprise-brain/analytics/executive` | Principal, Director | Date range, Department | On-screen, PDF | Brain tables (intelligence_entities) |
| Decision Intelligence Report | Enterprise Brain → Analytics | `/enterprise-brain/analytics/decision-intelligence` | Principal, Director, AI Admin | Decision type, Date | On-screen | `decision_intelligence` |
| Intelligence Loop — Signals | Enterprise Brain → Intelligence Loop | `/enterprise-brain/intelligence-loop/signals` | AI Admin, Principal | Date range, Source module | On-screen | `department_scoped_signals` |
| Evidence Log | Enterprise Brain → Intelligence Loop | `/enterprise-brain/intelligence-loop/evidence` | AI Admin | Date range, Entity | On-screen, Excel | `evidence_ledger` |
| ESO Execution Report | Enterprise Brain → Intelligence Loop | `/enterprise-brain/intelligence-loop/executions` | AI Admin | Date range, ESO type | On-screen | `eso_executions`, `eso_execution_evidence` |
| AI Governance Report | Enterprise Brain → Governance | `/enterprise-brain/governance` | AI Admin, Auditor | Date range, Policy | On-screen | `ai_governance` |

---

## Dynamic Reports

| Report Name | Module/Menu | Frontend Route | Roles | Key Filters | Export | Data Source |
|---|---|---|---|---|---|---|
| Dynamic Report (custom) | Reports → Dynamic Report Builder | `/reports/dynamic-report-builder` | Admin, Analyst | User-defined (any table) | Excel, PDF, CSV | Any (`report_dynamic`) |
| AI-generated Report | AI Reports | `/ai-reports/[id]` | Admin, Analyst | TBD | TBD | TBD |
| Student Marks Report | Reports | `/reports/students-marks` | Admin, Teacher | Standard, Division, Exam | Excel | `result_marks*` |
| Nomenclature Report | Reports | `/reports/nomenclature` | Admin | Module | On-screen | TBD |
| Broken Link Finder | Reports | `/reports/broken-link-finder` | Admin | Module | On-screen | tblmenumaster |

---

## Agentic AI Reports

| Report Name | Module/Menu | Frontend Route | Roles | Key Filters | Export | Data Source |
|---|---|---|---|---|---|---|
| Agent Run Log | Enterprise Brain → Automation | `/enterprise-brain/automation/agents` | AI Admin | Date range, Agent, Status | On-screen, Excel | `agent_run_logs` (via agenticAI) |
| Agent Reflection Report | Automation | TBD | AI Admin | Agent, Date range | On-screen | `agentReflectionController` |

---

> Detailed docs: `docs/v1/insight/reports/<report-name>.md`

---

## Source files

- Frontend routes: `C:\rajesh\lms_k12\app\enterprise-brain\**\page.tsx`, `C:\rajesh\lms_k12\app\ai\**\page.tsx`
- Backend controllers: `F:\xampp\htdocs\next_lms_erp\app\Http\Controllers\AI\`, `F:\xampp\htdocs\next_lms_erp\app\Http\Controllers\Brain\`
- Backend models: `F:\xampp\htdocs\next_lms_erp\app\Models\Eso\`, `F:\xampp\htdocs\next_lms_erp\app\Models\mis\`

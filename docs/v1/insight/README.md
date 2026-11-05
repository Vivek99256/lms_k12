# Scholar Insight — Product Overview

Last updated: 2026-11-04  
**Product:** Scholar Insight  
**Scope:** Enterprise Brain, Central AI Infrastructure & Institutional Analytics

---

## 1. Executive Summary

**Scholar Insight** serves as the cognitive intelligence and governance engine for Scholar Suite. It hosts the **Enterprise Brain**, a centralized deliberation and orchestration system that powers Agentic AI, knowledge graph reasoning, dynamic multi-dimensional reporting, and cross-module automated audits.

Insight ensures that AI deployments remain strictly audited, cost-controlled, and grounded in institutional reality.

---

## 2. Key Modules & Sub-systems

| Module | Purpose | Key Routes | Key Entities & Capabilities |
|---|---|---|---|
| **Enterprise Brain** | Cross-platform orchestration plane connecting operational database records to institutional AI knowledge graphs. | `/enterprise-brain`, `/enterprise-brain/graph` | `brain_knowledge_nodes`, `brain_entity_relations` |
| **Agentic AI & Control Cards** | Module-specific autonomous agents (e.g. fee defaulter identification, attendance anomaly detection, lesson drafting). | `/ai/agents`, `/ai-journey`, `/ai/module-approval-queue` | `ai_agent_approvals`, `agent_control_cards` |
| **AI Administration & Governance** | Central model catalogue, API key isolation, system prompts, guardrails, and token cost tracking across providers (Gemini, Claude, OpenAI). | `/ai/models`, `/ai/guardrails`, `/ai/usage-cost`, `/ai/prompts` | `ai_api_keys`, `ai_model_registry`, `ai_token_budgets` |
| **Dynamic Analytics & BI** | Real-time drill-down dashboards, predictive dropout modeling, and comparative institutional benchmarking. | `/ai-reports`, `/reports/dashboard` | `institutional_kpis`, `predictive_scorecards` |

---

## 3. Human-in-the-Loop Approval Queue

Every agent action that affects persistent database records follows a **supervised** or **gated** workflow:
- The agent formulates a proposal (e.g., "Dispatch WhatsApp reminders to 42 fee defaulters").
- The action enters the pending queue at `/ai/module-approval-queue`.
- An authorized staff member reviews the target records and approves or rejects the execution.
- Executed actions write immutable audit rows to `platform_audit_log`.


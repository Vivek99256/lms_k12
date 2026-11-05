# Shared Platform — Architecture & Platform Services

Last updated: 2026-11-04  
**Product:** Shared Platform  
**Scope:** Authentication, RBAC, Platform Services & Institutional Governance

---

## 1. Executive Summary

The **Shared Platform** provides the unified foundation upon which all five Scholar products operate. It centralizes cross-cutting institutional concerns including identity and role-based access control (RBAC), multi-channel messaging, asynchronous job scheduling, document management, and centralized system audit logging.

By enforcing centralized platform rules, individual business modules avoid duplicating infrastructural components.

---

## 2. Core Platform Capabilities

| Capability | Scope & Function | Key Routes | Key Entities & Schemas |
|---|---|---|---|
| **Auth & Security** | JWT authentication, multi-factor verification, institute session isolation, password recovery, and login throttling. | `/login`, `/forgot-password`, `/user_log` | `users`, `personal_access_tokens`, `institute_sessions` |
| **RBAC (Roles & Permissions)** | Granular role assignment across Institute Admins, Teachers, Students, Parents, Accountants, and Custom Staff Roles. | `/general/role_access`, `/general/groupwise_rights` | `roles`, `permissions`, `tbl_role_permission_mapping` |
| **Workflow Engine** | State-machine workflow orchestrator for cross-departmental reviews, leave approvals, and fee waivers. | `/platform-services/workflow` | `platform_workflows`, `workflow_instances`, `workflow_steps` |
| **Notification Engine** | Multi-channel delivery platform supporting SMS, Email, WhatsApp Business API, and in-app push alerts. | `/platform-services/notification` | `notification_templates`, `notification_logs`, `dispatch_queue` |
| **Scheduler** | Asynchronous cron worker runner handling overdue fee checks, automated attendance reconciliations, and report compilations. | `/platform-services/scheduler` | `scheduled_jobs`, `job_execution_history` |
| **Audit Trail (Activity Feed)** | Immutable tamper-evident audit logging of all sensitive administrative, financial, and agentic mutations. | `/platform-services/audit`, `/platform-services/event-bus` | `platform_audit_log`, `sync_logs` |
| **Document Templates (IDMS)** | Dynamic template canvas, merge fields, PDF generation, digital signing, and certificate rendering. | `/document-templates`, `/documents_new` | `document_templates`, `uploaded_documents` |
| **Platform Roadmap** | Live view of deployed capabilities, pilot modules, and architectural roadmap milestones. | `/platform-administration`, `/platform-roadmap` | `lib/roadmap/registry.ts` |


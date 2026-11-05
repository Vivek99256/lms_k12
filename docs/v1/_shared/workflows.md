# Workflows

Product | Module | Frontend route | Backend routes | Roles | v1 status
--- | --- | --- | --- | --- | ---
Shared Platform | Workflows | `/platform-services/workflow` | Platform workflow APIs (registry driven) | Admin, Super Admin, Approvers | Complete

Last updated: 2025-11-04  
Generated from commit: `8fe500dc` (frontend) / `86261072` (backend)

## 1. Purpose & users
Platform workflow engine for multi-step approvals. Uses declarative definitions from `config/platform_services.php`.

**Users:** Admin, Super Admin, designated Approvers.

## 2. Screens
| Screen name | Route | What is shown | Main actions |
|---|---|---|---|
| Workflow Console | `/platform-services/workflow` | Workflows, runs, steps, approvers, escalation | Configure, inspect runs, review history |

![](./screenshots/workflows.png)

## 3. Features & business rules
**Approver types:** role, user, reporting_manager, class_teacher, principal  
**Escalation:** none, remind, escalate, auto_approve, auto_reject

**Permission rules:**
| Action | Who can | Notes |
|---|---|---|
| View | Admin, Super Admin | Read access |
| Configure | Super Admin/Admin (per rights) | Affects future runs |
| Approve/Reject | Designated approver for current step | Step-gated |

## 4. User flows
**Happy path:** Trigger action -> Run created -> Step pending -> Approver acts -> Next step/completed -> Audit logged  
**Alternates:** Escalation on timeout; Rejection stops run

## 5. Data model
| Table (inferred) | Key columns | Relations | Indexes |
|---|---|---|---|
| platform_workflow_runs | id, workflow_key, entity_type, entity_id, status, current_step | Has steps/approvals | (workflow_key,status) |
| platform_workflow_steps | id, run_id, step_key, status, assignees(json) | Belongs to run | (run_id,status) |
| platform_workflow_approvals | id, run_id, step_id, approver_id, action, remarks, acted_at | Belongs to run/step | (run_id,approver_id) |

## 6. APIs
| Method | Endpoint | Auth/Permission | Request | Response | Error cases |
|---|---|---|---|---|---|
| GET | `/api/platform/registry` | Authenticated | - | workflows[] | 401/403 |
| POST | Workflow action | Approver for step | {action,remarks} | Updated run | Not approver/invalid step |

## 7. UI components & design tokens
Tables, modals, forms, status badges via shared components.

## 8. Reports & exports
On-screen history in console. Exports TBD.

## 9. Test cases
| ID | Scenario | Steps | Expected result | Type |
|---|---|---|---|---|
| WF-01 | Start run | Trigger action | Run+step1 pending | happy |
| WF-02 | Approve | Approver approves | Next/completed, audited | happy |
| WF-03 | Reject | Approver rejects | Rejected, audited | happy |
| WF-04 | Unauthorized | Non-approver acts | Blocked | negative |

## 10. Known issues, limitations & FAQs
**Limitations:** Some modules use custom approvals.  
**FAQ:** Config-driven via registry; escalation supported.

## 11. Sales notes
**Selling points:** Central reusable approvals, config-driven, auditable, escalations.  
**Demo flow:** Console -> trigger -> approve -> history/audit.

## 12. v1 status & v2 ideas
**v1:** Complete (registry-driven console/runs/approvals/escalation).  
**v2:** Visual builder, branching/parallel, SLA dashboards, delegation.

## Source files
- Frontend: `C:\rajesh\lms_k12\app\platform-services\workflow\_components\WorkflowConsole.tsx`
- Config: `F:\xampp\htdocs\next_lms_erp\config\platform_services.php`
- Docs: `C:\rajesh\lms_k12\docs\v1\_shared\platform-services.md`

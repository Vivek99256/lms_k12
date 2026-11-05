# Platform Services

Product | Module | Frontend route | Backend routes | Roles | v1 status
--- | --- | --- | --- | --- | ---
Shared Platform | Platform Services | `/platform-services/*` | Platform service APIs, `config/platform_services.php` | Admin, Super Admin | Complete

Last updated: 2025-11-04  
Generated from commit: `8fe500dc` (frontend) / `86261072` (backend)

## 1. Purpose & users
Cross-cutting platform layer providing Notification, Scheduler, Workflow, Audit, Event Bus, Document, Integration, RBAC via central registry.

**Users:** Admin, Super Admin, Developers

## 2. Screens
| Screen name | Route | What is shown | Main actions |
|---|---|---|---|
| Platform Services Dashboard | `/platform-services/dashboard` | Overview of services | Navigate to services |
| Notification | `/platform-services/notification`, `/platform-services/notification/log` | Events/channels/logs | Configure |
| Scheduler | `/platform-services/scheduler` | Tasks/schedules/runs | Configure/enable |
| Workflow | `/platform-services/workflow` | Workflows/runs | Configure/inspect |
| Audit | `/platform-services/audit` | Audit logs | View/filter |

![](./screenshots/platform-services.png)

## 3. Features & business rules
Registry at `config/platform_services.php`. All services consume it.

**Permission rules:**
| Action | Who can | Notes |
|---|---|---|
| Access platform services | Admin, Super Admin (per rights) | Service-level access controlled |

## 4. User flows
**Happy path:** Configure via registry-driven UIs; services operate across modules

## 5. Data model
See `_shared/*.md` for each service and `DATA-MODEL.md`.

## 6. APIs
| Method | Endpoint | Auth/Permission | Request | Response | Error cases |
|---|---|---|---|---|---|
| GET | `/api/platform/registry` | Authenticated | - | Full registry | 401/403 |

## 7. UI components & design tokens
Shared platform components under `app/platform-services/_components/`.

## 8. Reports & exports
Varies per service.

## 9. Test cases
| ID | Scenario | Steps | Expected result | Type |
|---|---|---|---|---|
| PS-01 | Load registry | GET registry | All services present | happy |

## 10. Known issues, limitations & FAQs
Central source of truth for cross-cutting services.

## 11. Sales notes
**Selling points:** Unified platform services, consistent UX/config.  
**Demo flow:** Show registry-driven services.

## 12. v1 status & v2 ideas
**v1:** Complete.  
**v2:** Enhanced observability, service mesh features.

## Source files
- Frontend: `C:\rajesh\lms_k12\app\platform-services\**`
- Backend/Config: `F:\xampp\htdocs\next_lms_erp\config\platform_services.php`
- Docs: `C:\rajesh\lms_k12\docs\v1\_shared\*.md`

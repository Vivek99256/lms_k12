# Schedules

Product | Module | Frontend route | Backend routes | Roles | v1 status
--- | --- | --- | --- | --- | ---
Shared Platform | Schedules | `/platform-services/scheduler` | Platform scheduler APIs (registry driven) | Admin, Super Admin | Complete

Last updated: 2025-11-04  
Generated from commit: `8fe500dc` (frontend) / `86261072` (backend)

## 1. Purpose & users
Platform scheduler running cron tasks declared in registry with enable/disable and cron overrides.

**Users:** Admin, Super Admin

## 2. Screens
| Screen name | Route | What is shown | Main actions |
|---|---|---|---|
| Scheduler Console | `/platform-services/scheduler` | Tasks, schedules, status, last run | Enable/disable, override cron, view history |

![](./screenshots/schedules.png)

## 3. Features & business rules
**Rules:** Tasks `disabled_by_default: true` require opt-in. Cron overrides allowed. Runs audited.

**Permission rules:**
| Action | Who can | Notes |
|---|---|---|
| View | Admin, Super Admin | Read |
| Enable/Disable/Override | Super Admin/Admin (per rights) | Affects execution |

## 4. User flows
**Happy path:** Task enabled -> Runs per schedule -> Logs result -> Next run scheduled  
**Alternate:** Disabled skipped; override applied

## 5. Data model
| Table (inferred) | Key columns | Relations | Indexes |
|---|---|---|---|
| platform_scheduler_tasks | task_key, module, schedule_default, disabled_by_default, config(json) | Registry mapped | (task_key) |
| platform_scheduler_runs | id, task_key, status, started_at, finished_at, output(json) | Run history | (task_key, started_at) |

## 6. APIs
| Method | Endpoint | Auth/Permission | Request | Response | Error cases |
|---|---|---|---|---|---|
| GET | `/api/platform/registry` | Authenticated | - | tasks[] | 401/403 |
| GET/POST | Scheduler APIs | Authenticated + rights | Enable/cron/payload | Status/runs | Permission errors |

## 7. UI components & design tokens
Tables, toggles, cron inputs, status badges.

## 8. Reports & exports
Run history view; exports TBD.

## 9. Test cases
| ID | Scenario | Steps | Expected result | Type |
|---|---|---|---|---|
| SC-01 | Enable opt-in task | Enable disabled_by_default task | Scheduled to run | happy |
| SC-02 | Override cron | Change schedule | Next run uses override | happy |
| SC-03 | Disable task | Disable enabled task | Skipped going forward | happy |

## 10. Known issues, limitations & FAQs
**Limitations:** Some tasks depend on external services/credentials.  
**FAQ:** See `core/fees/scheduler.md` for fee-specific tasks.

## 11. Sales notes
**Selling points:** Central cron orchestration, safe defaults, auditable.  
**Demo flow:** View tasks -> enable/override -> check run history.

## 12. v1 status & v2 ideas
**v1:** Complete.  
**v2:** Job queue UI, retries/backoff, alerts.

## Source files
- Frontend: `C:\rajesh\lms_k12\app\platform-services\scheduler\**`
- Config: `F:\xampp\htdocs\next_lms_erp\config\platform_services.php`
- Docs: `C:\rajesh\lms_k12\docs\v1\core\fees\scheduler.md`

# Activity Feed

Product | Module | Frontend route | Backend routes | Roles | v1 status
--- | --- | --- | --- | --- | ---
Shared Platform | Activity Feed | Various module routes (contextual) | Activity/feed APIs (where used) | Authenticated users (role-scoped) | Complete

Last updated: 2025-11-04  
Generated from commit: `8fe500dc` (frontend) / `86261072` (backend)

## 1. Purpose & users
Shows recent actions/events across modules in a feed. Often module-scoped (e.g. admissions follow-ups).

**Users:** Authenticated users as per module permissions

## 2. Screens
| Screen name | Route | What is shown | Main actions |
|---|---|---|---|
| Activity Feed (contextual) | Embedded in module dashboards/pages | Recent activity list | View details (contextual) |

![](./screenshots/activity-feed.png)

## 3. Features & business rules
Role-scoped visibility. Aggregates relevant events.

**Permission rules:**
| Action | Who can | Notes |
|---|---|---|
| View | Users with module access | Scoped to permitted data |

## 4. User flows
**Happy path:** Actions occur -> Feed updates with recent items -> User views context

## 5. Data model
Derived from audit/events; no single dedicated table required (uses existing logs/events).

## 6. APIs
Module-dependent APIs returning recent activity.

## 7. UI components & design tokens
Feed/list components used across modules.

## 8. Reports & exports
N/A (in-screen)

## 9. Test cases
| ID | Scenario | Steps | Expected result | Type |
|---|---|---|---|---|
| AF-01 | View feed | Open module page with feed | Shows recent scoped items | happy |

## 10. Known issues, limitations & FAQs
**Limitations:** Scope depends on permissions/module.

## 11. Sales notes
**Selling points:** Quick visibility of recent actions.  
**Demo flow:** Show feed on dashboard.

## 12. v1 status & v2 ideas
**v1:** Complete (contextual usage).  
**v2:** Global feed, real-time updates.

## Source files
- Frontend: `C:\rajesh\lms_k12\components\**`, module pages
- Docs: `C:\rajesh\lms_k12\docs\v1\core\admissions\follow-up.md`

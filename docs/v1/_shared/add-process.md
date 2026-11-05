# Add Process

Product | Module | Frontend route | Backend routes | Roles | v1 status
--- | --- | --- | --- | --- | ---
Shared Platform | Add Process | `/general/add_process` | General/process APIs | Admin, Super Admin | Complete

Last updated: 2025-11-04  
Generated from commit: `8fe500dc` (frontend) / `86261072` (backend)

## 1. Purpose & users
Define and manage processes/configuration under General > Add Process.

**Users:** Admin, Super Admin

## 2. Screens
| Screen name | Route | What is shown | Main actions |
|---|---|---|---|
| Add Process Page | `/general/add_process` | Process definitions UI | Create/edit/manage processes |

![](./screenshots/add-process.png)

## 3. Features & business rules
Process configuration UI. Permissions apply as per RBAC.

**Permission rules:**
| Action | Who can | Notes |
|---|---|---|
| View/Manage | Admin, Super Admin (per rights) | Config changes affect setup |

## 4. User flows
**Happy path:** Define process -> Configure -> Save

## 5. Data model
Stored via general/configuration tables (as implemented).

## 6. APIs
General/process configuration APIs.

## 7. UI components & design tokens
Forms/tables per `AddProcessPage.tsx` and components.

## 8. Reports & exports
N/A

## 9. Test cases
| ID | Scenario | Steps | Expected result | Type |
|---|---|---|---|---|
| AP-01 | Create process | Add process config | Saved successfully | happy |

## 10. Known issues, limitations & FAQs
Part of Setup & Configuration.

## 11. Sales notes
**Selling points:** Flexible process setup.  
**Demo flow:** Configure a process.

## 12. v1 status & v2 ideas
**v1:** Complete.  
**v2:** Enhanced UI/workflow integration.

## Source files
- Frontend: `C:\rajesh\lms_k12\app\general\add_process\**`

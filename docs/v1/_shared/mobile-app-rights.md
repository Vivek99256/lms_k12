# Mobile App Rights

Product | Module | Frontend route | Backend routes | Roles | v1 status
--- | --- | --- | --- | --- | ---
Shared Platform | Mobile App Rights | `/mobile-apps/ai-stack` | Mobile app config APIs | Admin, Super Admin | Complete

Last updated: 2025-11-04  
Generated from commit: `8fe500dc` (frontend) / `86261072` (backend)

## 1. Purpose & users
Control mobile app access/rights.

**Users:** Admin, Super Admin

## 2. Screens
| Screen name | Route | What is shown | Main actions |
|---|---|---|---|
| Mobile Apps AI Stack | `/mobile-apps/ai-stack` | Mobile app configuration | Configure rights/access |

![](./screenshots/mobile-app-rights.png)

## 3. Features & business rules
Rights managed via RBAC/mobile app settings.

**Permission rules:**
| Action | Who can | Notes |
|---|---|---|
| Configure | Admin, Super Admin (per rights) | Affects mobile access |

## 4. User flows
**Happy path:** Configure mobile app rights -> Save

## 5. Data model
Related to rights/tables; see ROLES-PERMISSIONS.md section 7.

## 6. APIs
Mobile app configuration APIs.

## 7. UI components & design tokens
Forms/tables.

## 8. Reports & exports
N/A

## 9. Test cases
| ID | Scenario | Steps | Expected result | Type |
|---|---|---|---|---|
| MAR-01 | Set mobile rights | Configure rights | Applied to mobile users | happy |

## 10. Known issues, limitations & FAQs
Related to ROLES-PERMISSIONS.

## 11. Sales notes
**Selling points:** Granular mobile access control.  
**Demo flow:** Configure mobile rights.

## 12. v1 status & v2 ideas
**v1:** Complete.  
**v2:** App version control, device restrictions.

## Source files
- Frontend: `C:\rajesh\lms_k12\app\mobile-apps\**`
- Docs: `C:\rajesh\lms_k12\docs\v1\ROLES-PERMISSIONS.md`

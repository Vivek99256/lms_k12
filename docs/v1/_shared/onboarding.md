# Onboarding

Product | Module | Frontend route | Backend routes | Roles | v1 status
--- | --- | --- | --- | --- | ---
Shared Platform | Onboarding | `/general/onboarding/[module]`, `/general/implementation_management` | Onboarding/implementation APIs | Admin, Super Admin | Complete

Last updated: 2025-11-04  
Generated from commit: `8fe500dc` (frontend) / `86261072` (backend)

## 1. Purpose & users
Onboarding and implementation management flows.

**Users:** Admin, Super Admin, Implementation team

## 2. Screens
| Screen name | Route | What is shown | Main actions |
|---|---|---|---|
| Module Onboarding | `/general/onboarding/[module]` | Module-specific onboarding steps | Complete setup steps |
| Implementation Management | `/general/implementation_management` | Implementation tracking | Track setup progress |

![](./screenshots/onboarding.png)

## 3. Features & business rules
Guided setup flows per module.

**Permission rules:**
| Action | Who can | Notes |
|---|---|---|
| Manage onboarding | Admin, Super Admin | Setup access |

## 4. User flows
**Happy path:** Follow onboarding steps -> Complete module setup

## 5. Data model
Onboarding/implementation data as implemented.

## 6. APIs
Onboarding/implementation APIs.

## 7. UI components & design tokens
Wizards/steps.

## 8. Reports & exports
N/A

## 9. Test cases
| ID | Scenario | Steps | Expected result | Type |
|---|---|---|---|---|
| OB-01 | Complete onboarding step | Go through step | Marked complete | happy |

## 10. Known issues, limitations & FAQs
Part of Setup & Configuration.

## 11. Sales notes
**Selling points:** Guided implementation.  
**Demo flow:** Show onboarding flow.

## 12. v1 status & v2 ideas
**v1:** Complete.  
**v2:** Checklist templates, progress tracking.

## Source files
- Frontend: `C:\rajesh\lms_k12\app\general\onboarding\**`, `C:\rajesh\lms_k12\app\general\implementation_management\**`

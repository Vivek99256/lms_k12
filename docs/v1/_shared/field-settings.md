# Field Settings

Product | Module | Frontend route | Backend routes | Roles | v1 status
--- | --- | --- | --- | --- | ---
Shared Platform | Field Settings | `/general/fields_configuration` | General/field config APIs | Admin, Super Admin | Complete

Last updated: 2025-11-04  
Generated from commit: `8fe500dc` (frontend) / `86261072` (backend)

## 1. Purpose & users
Configure custom fields per module.

**Users:** Admin, Super Admin

## 2. Screens
| Screen name | Route | What is shown | Main actions |
|---|---|---|---|
| Field Configuration | `/general/fields_configuration` | Field settings by module | Configure fields |

![](./screenshots/field-settings.png)

## 3. Features & business rules
Module-scoped field configuration.

**Permission rules:**
| Action | Who can | Notes |
|---|---|---|
| Configure | Admin, Super Admin (per rights) | Affects forms/UI |

## 4. User flows
**Happy path:** Select module -> Configure fields -> Save

## 5. Data model
Field configuration tables as implemented.

## 6. APIs
General/field configuration APIs.

## 7. UI components & design tokens
Forms/tables.

## 8. Reports & exports
N/A

## 9. Test cases
| ID | Scenario | Steps | Expected result | Type |
|---|---|---|---|---|
| FS-01 | Configure field | Set field config | Saved and applied | happy |

## 10. Known issues, limitations & FAQs
Part of Setup & Configuration.

## 11. Sales notes
**Selling points:** Flexible form customization.  
**Demo flow:** Configure fields for a module.

## 12. v1 status & v2 ideas
**v1:** Complete.  
**v2:** Validation rules, conditional fields.

## Source files
- Frontend: `C:\rajesh\lms_k12\app\general\fields_configuration\**`

# Setup and Configuration

Product | Module | Frontend route | Backend routes | Roles | v1 status
--- | --- | --- | --- | --- | ---
Shared Platform | Setup and Configuration | `/general/*` (see sections) | General/configuration APIs | Admin, Super Admin | Complete

Last updated: 2025-11-04  
Generated from commit: `8fe500dc` (frontend) / `86261072` (backend)

## 1. Purpose & users
General setup/configuration tools under `app/general/`: processes, fields, forms, rights, onboarding, bulk upload, etc.

**Users:** Admin, Super Admin

## 2. Screens
| Screen name | Route | What is shown | Main actions |
|---|---|---|---|
| Add Process | `/general/add_process` | Process definitions | Define/manage processes |
| Field Settings | `/general/fields_configuration` | Field configuration | Configure fields |
| Form Builder | `/general/form_builder` | Custom forms | Build/manage forms |
| Groupwise Rights | `/general/groupwise_rights` | Role/group permissions | Assign rights |
| Individual Rights | `/general/individual_rights` | User-level permissions | Assign rights |
| Implementation/Onboarding | `/general/implementation_management`, `/general/onboarding/[module]` | Setup/onboarding | Manage setup flows |
| Bulk Upload | `/general/bulk_upload` | Bulk import | Upload/validate/import |

![](./screenshots/setup-configuration.png)

## 3. Features & business rules
Config-driven setup. Rights changes affect access immediately per system design.

**Permission rules:**
| Action | Who can | Notes |
|---|---|---|
| Configure setup/rights | Super Admin/Admin (per rights) | Sensitive operations |
| Use bulk upload | Admin (per rights) | Follow validation rules |

## 4. User flows
**Happy path:** Configure as needed -> Validate -> Save -> Applies to system  
**Alternate:** Rights assignment, bulk upload with validation

## 5. Data model
Rights stored in `tblgroupwise_rights`, `tblindividual_rights`; menus in `tblmenumaster` (see ROLES-PERMISSIONS, DATA-MODEL).

## 6. APIs
General configuration APIs; rights APIs under general/controllers.

## 7. UI components & design tokens
Forms, tables, modals, builders.

## 8. Reports & exports
Varies by area.

## 9. Test cases
| ID | Scenario | Steps | Expected result | Type |
|---|---|---|---|---|
| SCFG-01 | Assign group rights | Set rights for role | Users in role get access | happy |
| SCFG-02 | Bulk upload valid | Upload valid file | Imported successfully | happy |
| SCFG-03 | Bulk upload invalid | Upload invalid file | Validation errors shown | negative |

## 10. Known issues, limitations & FAQs
**Related:** RBAC, User Management, Onboarding

## 11. Sales notes
**Selling points:** Flexible configuration, role-based control.  
**Demo flow:** Show rights/form builder.

## 12. v1 status & v2 ideas
**v1:** Complete.  
**v2:** Enhanced UI, templates, better validation.

## Source files
- Frontend: `C:\rajesh\lms_k12\app\general\**`
- Docs: `C:\rajesh\lms_k12\docs\v1\ROLES-PERMISSIONS.md`, `C:\rajesh\lms_k12\docs\v1\_shared\rbac.md`, `C:\rajesh\lms_k12\docs\v1\_shared\user-management.md`

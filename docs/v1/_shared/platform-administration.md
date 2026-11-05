# Platform Administration

Product | Module | Frontend route | Backend routes | Roles | v1 status
--- | --- | --- | --- | --- | ---
Shared Platform | Platform Administration | `/general/groupwise_rights`, `/general/individual_rights`, `/users/*` | Rights/user/admin APIs | Super Admin, Admin (as per rights) | Complete

Last updated: 2025-11-04  
Generated from commit: `8fe500dc` (frontend) / `86261072` (backend)

## 1. Purpose & users
Platform-level administration: users, roles/groups, rights, settings, platform services.

**Users:** Super Admin, Admin

## 2. Screens
| Screen name | Route | What is shown | Main actions |
|---|---|---|---|
| Groupwise Rights | `/general/groupwise_rights` | Role/group permissions matrix | Assign rights by group |
| Individual Rights | `/general/individual_rights` | User-level permissions | Assign rights by user |
| User Management | `/users/*` | Users/roles | Manage users |

![](./screenshots/platform-administration.png)

## 3. Features & business rules
RBAC enforced. Changes affect access.

**Permission rules:**
| Action | Who can | Notes |
|---|---|---|
| Manage users/rights | Super Admin (primary), Admin as delegated | Sensitive |

## 4. User flows
**Happy path:** Create user/role -> Assign rights -> User gets access

## 5. Data model
`tblmenumaster`, `tblgroupwise_rights`, `tblindividual_rights`, `tbluser` (see DATA-MODEL, ROLES-PERMISSIONS)

## 6. APIs
Rights/user administration APIs.

## 7. UI components & design tokens
Permission matrices, forms, tables.

## 8. Reports & exports
Varies.

## 9. Test cases
| ID | Scenario | Steps | Expected result | Type |
|---|---|---|---|---|
| PA-01 | Grant group rights | Assign to role | Members get access | happy |
| PA-02 | Override individual rights | Grant/revoke individual | Overrides as per design | happy |

## 10. Known issues, limitations & FAQs
Related to RBAC and all _shared docs.

## 11. Sales notes
**Selling points:** Granular RBAC, platform-wide control.  
**Demo flow:** Show rights management.

## 12. v1 status & v2 ideas
**v1:** Complete.  
**v2:** Better UI, audit for rights changes.

## Source files
- Frontend: `C:\rajesh\lms_k12\app\general\**`, `C:\rajesh\lms_k12\app\users\**`
- Docs: `C:\rajesh\lms_k12\docs\v1\ROLES-PERMISSIONS.md`, `C:\rajesh\lms_k12\docs\v1\_shared\rbac.md`, `C:\rajesh\lms_k12\docs\v1\_shared\user-management.md`

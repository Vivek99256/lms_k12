# RBAC — Roles & Menu Permissions

Last updated: 2026-11-04
Generated from commit: `8fe500dc` (frontend) / `86261072` (backend)

**Product:** Shared Platform | **Module:** RBAC | **v1 status:** Complete

| Field | Value |
|---|---|
| Backend routes | `POST /api/menu-rights` |
| Roles | Admin, Super Admin |
| Last updated | 2026-11-04 |
| Source commit | 8fe500dc (FE) / 86261072 (BE) |

## 1. Purpose & users

The RBAC system controls which menus a user can open. It is built from three tables: `tblmenumaster` (the menu catalog), `tblgroupwise_rights` (rights granted to a user profile/group), and `tblindividual_rights` (rights granted to a specific user, overriding the group).

Used by: Admins who set up roles; the system itself to decide what appears in the sidebar.

## 2. Screens

| Screen | Route | Description |
|---|---|---|
| Group Rights | `/general/groupwise_rights` | Grant/revoke menus for an entire user profile (e.g., all Teachers) |
| Individual Rights | `/general/individual_rights` | Grant/revoke menus for a specific user, overriding their group |
| Mobile App Rights | `/general/mobile_app_rights` | Control which menus appear in the mobile app |

![](./screenshots/groupwise-rights.png)

## 3. How the RBAC system works

### Three-table model

```
tblmenumaster          tblgroupwise_rights        tblindividual_rights
─────────────          ───────────────────        ────────────────────
id (PK)                id (PK)                    id (PK)
name                   menu_id → tblmenumaster    menu_id → tblmenumaster
link (slug, unique)    profile_id → tbluserprofilemaster  user_id → tbluser/tblstudent
parent_menu_id         sub_institute_id           profile_id
level (1/2/3)                                     sub_institute_id
sub_institute_id
client_id
menu_type
sort_order
status
```

### Menu visibility logic

A menu item is visible to a user if:
1. `tblmenumaster.status = 1` (active)
2. `FIND_IN_SET(sub_institute_id, tblmenumaster.sub_institute_id)` — the item is enabled for this institute
3. At least one of:
   - A `tblgroupwise_rights` row exists for the user's `user_profile_id` and this `menu_id`
   - A `tblindividual_rights` row exists for the specific `user_id` and this `menu_id`

**Super admin exception:** If `is_admin = 1` and `sub_institute_id = 0`, the query uses `client_id` instead of `sub_institute_id`, granting access to all institutes under the client.

**Student vs staff:** Students are looked up in `tblstudent`; all other users are in `tbluser`. The `MenuRightsController` handles both branches.

### Menu levels

| Level | Meaning | Example |
|---|---|---|
| 1 | Top-level product/section | "Institute ERP", "AI & Intelligence" |
| 2 | Module | "Fees", "Student", "HRIT Management" |
| 3 | Sub-menu / menu item | "Collect Fee", "Fee Reports" |

### Adding a new menu item (required steps)

1. Run a Laravel migration inserting a row into `tblmenumaster`.
2. Run a migration inserting into `tblgroupwise_rights` for the super-admin profile (minimum).
3. Optionally run a migration for other profiles that should see it.
4. The frontend will automatically show the item once rights are granted — no frontend code change needed for the menu to appear.

## 4. User flows

**Granting group access:**
1. Admin opens `/general/groupwise_rights`.
2. Selects the user profile (e.g., "Teacher").
3. Checks the menu items to grant.
4. Saves → rows inserted into `tblgroupwise_rights`.
5. All users with that profile now see the menu items on next page load.

**Granting individual access:**
1. Admin opens `/general/individual_rights`.
2. Searches for the specific user.
3. Checks/unchecks menu items.
4. Saves → rows inserted/deleted from `tblindividual_rights`.
5. That user's menu updates on next load.

## 5. Data model

| Table | Key columns | Notes |
|---|---|---|
| `tblmenumaster` | `id`, `name`, `menu_title`, `link`, `parent_menu_id`, `level`, `status`, `sort_order`, `sub_institute_id`, `client_id`, `icon`, `menu_type`, `site_map_name`, `database_table` | Master menu catalog |
| `tblgroupwise_rights` | `id`, `menu_id`, `profile_id`, `sub_institute_id` | Group-level rights |
| `tblindividual_rights` | `id`, `menu_id`, `user_id`, `profile_id`, `sub_institute_id` | Per-user rights override |
| `tbluserprofilemaster` | `id`, `profile_name` | User profile types (roles) |

## 6. APIs

| Method | Endpoint | Auth | Request | Response |
|---|---|---|---|---|
| POST | `/api/menu-rights` | Bearer | `{ sub_institute_id, client_id, is_admin, user_id, user_profile_id, user_profile_name }` | `{ mainMenu[], subMenu[], subChildMenu[], quickMenu[] }` |

## 7. UI components & design tokens

- Checkbox tree for menu selection
- Search/filter for user/profile
- Design tokens: `--surface-*`, `--border-*`

## 8. Reports & exports

None.

## 9. Test cases

| ID | Scenario | Steps | Expected result | Type |
|---|---|---|---|---|
| R-01 | Group right grant | Grant "Collect Fee" to Teacher profile | All teachers see Fees → Collect Fee menu | Happy |
| R-02 | Individual override | Remove "Fee Reports" from one specific teacher | That teacher does not see Fee Reports; others do | Happy |
| R-03 | New menu without migration | Add frontend route without tblmenumaster row | Menu never appears for any user | Negative |
| R-04 | Super admin access | Log in as super admin (is_admin=1, sub_institute_id=0) | All menus visible across all institutes | Happy |
| R-05 | Student login | Student logs in | Only menus granted via tblstudent rights visible | Happy |

## 10. Known issues, limitations & FAQs

- **No deny rule:** Rights are additive only. You can grant a menu to a group and then grant the same menu individually — there is no "deny individual" to override a group grant.
- **Migration required:** Every new menu item requires a database migration. Developers who forget this step will find their new screen invisible to all users.
- `tblprofilewise_menu` exists in the schema but is not used by `MenuRightsController` — it is a decoy/legacy table.

**FAQ:** *Why can't I see a screen I just built?* The `tblmenumaster` row is probably missing, or the `tblgroupwise_rights` row for your profile is missing.

## 11. Sales notes

- Fully configurable menu access — no hardcoded roles.
- Per-user overrides mean one teacher can be given access a report that the rest cannot see, without creating a new profile.
- Multi-institute: `sub_institute_id` on each menu row means sister schools in the same client can have different menus.

## 12. v1 status & v2 ideas

**Complete:** Group rights, individual rights, mobile app rights, three-level menu hierarchy.

**v2 ideas:** UI-based "deny" override, field-level permissions (not just menu-level), audit log of rights changes, role cloning.

## Source files

- `F:\xampp\htdocs\next_lms_erp\app\Http\Controllers\api\MenuRightsController.php`
- `F:\xampp\htdocs\next_lms_erp\app\Models\tblmenumasterModel.php`
- `F:\xampp\htdocs\next_lms_erp\database\migrations\2023_03_05_115658_create_tblmenumaster_table.php`
- `C:\rajesh\lms_k12\app\general\groupwise_rights\page.tsx`
- `C:\rajesh\lms_k12\app\general\individual_rights\page.tsx`

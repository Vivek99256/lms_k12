# User Management

Last updated: 2026-11-04
Generated from commit: `8fe500dc` (frontend) / `86261072` (backend)

**Product:** Shared Platform | **Module:** User Management | **v1 status:** Complete

| Field | Value |
|---|---|
| Backend routes | `/api/user/*`, `/api/staff/*`, `/api/student/*` |
| Roles | Admin, Super Admin |
| Last updated | 2026-11-04 |

## 1. Purpose & users

User Management is the master registry for everyone who can log into Scholar Suite: staff (teachers, admin, support), students, and guardians. It bridges the HR/Academic records with the auth system.

Used by: Super Admin (creates institutes), Admin (creates/manages staff and students), self-service (password reset).

## 2. Screens

| Screen | Route | Description |
|---|---|---|
| Staff List | `/general/staff` | View, add, edit, deactivate staff |
| Student User | See Student module | Student accounts live under the Student module |
| User Profile Setup | `/general/user_profiles` | Define profile types (roles) for the institute |
| Change Password | `/general/change_password` | Self-service password change |
| Login History | `/general/login_history` | Audit log of login events |

## 3. Features & business rules

### User types

| Type | Table | Notes |
|---|---|---|
| Staff (teacher/admin) | `tbluser` | Has `user_profile_id`, `sub_institute_id`, `is_admin` flags |
| Student | `tblstudent` | Linked to academic record; login email = school-issued or parent email |
| Super Admin | `tbluser` with `is_admin=1`, `sub_institute_id=0` | Sees all institutes under the client |

### Account lifecycle

1. **Create**: Admin creates account; password set by admin or auto-generated.
2. **Activate**: `status=1` on `tbluser` / `tblstudent`.
3. **Login**: JWT issued on successful credentials check.
4. **Deactivate**: `status=0` — user cannot log in; record preserved.
5. **Delete**: Soft-delete only. Hard deletes are not permitted on staff or student records.

### Profile types (roles)

Defined in `tbluserprofilemaster`. Each institute can have its own set of profiles. A user can hold only one profile at a time. RBAC menu rights are granted per profile — see [rbac.md](./rbac.md).

### Password rules

- v1: No complexity enforcement; min length not enforced by frontend.
- Passwords are hashed (bcrypt) but also stored in `plain_password` column — known security issue.
- Password reset is admin-initiated; no self-service email reset in v1.

## 4. Data model

| Table | Key columns | Notes |
|---|---|---|
| `tbluser` | `id`, `name`, `email`, `password`, `plain_password`, `mobile`, `user_profile_id`, `sub_institute_id`, `client_id`, `is_admin`, `status`, `expire_date`, `photo` | Staff & admin users |
| `tblstudent` | `id`, `name`, `email`, `password`, `user_profile_id`, `sub_institute_id`, `gr_no`, `roll_no` | Student accounts |
| `tbluserprofilemaster` | `id`, `profile_name`, `sub_institute_id` | Role/profile definitions per institute |
| `tblsubinstitutionmaster` | `id`, `name`, `client_id` | Institutes under a client |

## 5. APIs

| Method | Endpoint | Description |
|---|---|---|
| GET | `/api/staff` | List staff for an institute |
| POST | `/api/staff` | Create staff user |
| PUT | `/api/staff/{id}` | Update staff user |
| DELETE | `/api/staff/{id}` | Soft-delete staff user |
| POST | `/api/change-password` | Change own password |

## 6. Test cases

| ID | Scenario | Expected result | Type |
|---|---|---|---|
| UM-01 | Create staff user | User appears in list; can log in | Happy |
| UM-02 | Deactivate user | User cannot log in; record still exists | Happy |
| UM-03 | Super admin cross-institute | Super admin sees all institutes | Happy |
| UM-04 | Student login with school email | Student authenticated via tblstudent | Happy |
| UM-05 | Delete staff with fee records | Soft-delete only; records preserved | Edge |

## 7. Known issues & v2 ideas

**Known issues:**
- `plain_password` column stores cleartext password — must be removed in v2.
- No self-service password reset via email.
- No MFA.

**v2 ideas:** Email-based password reset, MFA, password complexity rules, bulk user import via CSV, user deactivation scheduler (auto-deactivate on alumni/retirement), login history with device/IP details.

## Source files

- `F:\xampp\htdocs\next_lms_erp\app\Http\Controllers\api\staffController.php`
- `F:\xampp\htdocs\next_lms_erp\app\Models\User.php`
- `C:\rajesh\lms_k12\app\general\staff\`

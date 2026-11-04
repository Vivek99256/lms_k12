# Department Management
**Product:** Scholar Core (CCB overlap) | **Module:** Organization Management | **Frontend route:** `/organization_managment/Department` | **v1 status:** Complete

| Field | Value |
|---|---|
| Backend routes | TBD (via `API_BASE_URL` calls in component — exact routes not read) |
| Roles | Admin, HR Admin, Principal |
| Last updated | 2026-11-04 |
| Source commit | 8fe500dc (FE) / 86261072 (BE) |

## 1. Purpose & users
Manage the institute's department hierarchy. Each department has employees, job roles, policies, rules, SOPs, and an optional head-of-department. Admins can create new departments via a wizard, edit them, assign HoDs, and manage per-department policies and SOPs (with AI-generation support).

## 2. Screens

### Department list — `/organization_managment/Department`
- **Search & filter bar**: search by name, filter by status.
- **Department table**: paginated list of departments with badges.
- **Action menu** per row: View, Edit, Delete; and sub-panels for Employees, Job Roles.

### Side panels / tabs (within the same route)
- **Employees panel** (`DepartmentEmployeesPanel`): lists employees in the department.
- **Job Roles panel** (`DepartmentJobRolesPanel`): lists job roles.
- **Policies** (`PoliciesModule`): department-level policy documents.
- **Rules** (`RulesModule`): department rules.
- **SOPs** (`SopsModule`): Standard operating procedures; AI generation available.

### Create wizard — `DepartmentCreateWizard`
Multi-step wizard for creating a new department: name → HoD → employees → job roles.

### Edit dialog — `DepartmentEditDialog`
Quick-edit modal for updating department details.

### AI Generation drawer — `ai-generation-drawer.tsx`
Drawer for AI-assisted policy/SOP generation. Calls AI backend.

### Policy generation dialog — `policy-generation-dialog.tsx`
Dedicated dialog for generating a department policy using AI.

![](./screenshots/department-management.png)

## 3. Features & business rules

**Department fields (inferred from wizard and edit components):**

| Field | Type | Notes |
|---|---|---|
| Department name | Text | Required |
| Status | Select | Active / Inactive |
| Head of department | User picker | Optional |
| Employees | Multi-select | Assign staff |
| Job roles | Multi-select | Assign roles |

**Permission rules:**
- Admin, HR Admin, Principal: create, edit, delete.
- Other roles: view only (TBD).

**Business rules:**
- Departments are institute-scoped (`sub_institute_id`).
- AI-generated policies/SOPs are drafts; human review required before publishing (TBD if enforced).
- `HrmsDepartment` model is shared with HRIT (attendance/leave) and Talent Management — changes here affect those modules.

## 4. User flows

**Create a department:**
1. Click "Create department" (Plus icon).
2. Wizard opens: enter name, assign HoD.
3. Add employees and job roles.
4. Save — department appears in list.

**Generate a policy with AI:**
1. Open a department → Policies tab.
2. Click "Generate policy" (AI icon).
3. Policy generation dialog opens — enter intent/prompt.
4. AI returns draft policy content.
5. Review and save.

**Manage SOPs:**
1. Open a department → SOPs tab.
2. Add/edit SOPs manually or via AI generation drawer.

## 5. Data model

| Table | Purpose |
|---|---|
| `hrms_departments` (via `HrmsDepartment` model) | Department master |
| `hrms_departments_mapping` | Employee-department mapping |
| TBD (policies, rules, SOPs tables) | Per-department content |

## 6. APIs
Calls go to `API_BASE_URL` (Laravel backend). Exact routes TBD — not read from source.

## 7. UI components & design tokens
- `DepartmentCreateWizard`, `DepartmentEditDialog`, `HeadOfDepartmentPicker`, `DepartmentEmployeesPanel`, `DepartmentJobRolesPanel` — `app/organization_managment/Department/Component/`
- `PoliciesModule`, `RulesModule`, `SopsModule` — same directory
- `AiGenerationDrawer`, `PolicyGenerationDialog` — AI components
- `Button`, `Input`, `Badge`, `StatusBadge`, `Select`, `DropdownMenu`, `Table` — standard shadcn + EduERP
- Lucide: `Plus`, `Pencil`, `Trash2`, `Search`, `Filter`, `Download`, `Eye`, `Users`, `Folder`, `FolderOpen`, `UserPlus`, `MoreVertical`, `RefreshCw`, `RotateCcw`, `Info`, `CalendarDays`, `ChevronDown`, `ChevronRight`, `ChevronLeft`, `ChevronsUpDown`, `Loader2`, `X`, `UserRound`

## 8. Reports & exports
- Download button present (TBD — format not confirmed).

## 9. Test cases

| ID | Scenario | Steps | Expected result | Type |
|---|---|---|---|---|
| DM-01 | Create department | Wizard → save | Dept in list | Happy |
| DM-02 | Assign HoD | Pick from user list | HoD shown on dept card | Happy |
| DM-03 | Generate AI policy | Policy gen dialog → submit | Draft policy content returned | Happy |
| DM-04 | Add SOP manually | SOPs tab → add | SOP saved | Happy |
| DM-05 | Delete department | Action menu → delete | Dept removed | Happy |
| DM-06 | View employees | Employees panel | List of dept employees shown | Happy |

## 10. Known issues, limitations & FAQs
- **Route typo**: path is `organization_managment` (missing 'e'). Frontend and backend must match this spelling consistently.
- **AI generation**: policy/SOP generation requires the AI backend to be configured and the institute to have AI credits.
- **Shared model with HRIT**: `HrmsDepartment` changes affect attendance, leave, and payroll scoping.

## 11. Sales notes
**Key selling points:**
- Complete department hierarchy with employees, job roles, policies, and SOPs in one screen.
- AI-powered policy and SOP generation — faster documentation.
- Change-ready: edit the department structure without affecting HRIT data.

**Demo flow:**
1. Show department list with 3 departments.
2. Create a new department via wizard.
3. Open it → show Policies tab → generate a policy with AI.
4. Show employee and job role sub-panels.

**Plan/pricing:** TBD

## 12. v1 status & v2 ideas
**Complete:** CRUD, wizard, HoD picker, employee/job-role panels, policies, rules, SOPs, AI generation.
**Partial:** Export format TBD; API routes not fully read.
**v2 ideas:** Department org chart; policy version history; approval workflow for AI-generated content; KPI targets per department.

## Source files
- `C:\rajesh\lms_k12\app\organization_managment\Department\page.tsx`
- `C:\rajesh\lms_k12\app\organization_managment\Department\Component\` (all files)
- `C:\rajesh\lms_k12\app\organization_managment\oragnization_profile\page.tsx`
- `F:\xampp\htdocs\next_lms_erp\app\Models\OrganizationManagement\` (models)

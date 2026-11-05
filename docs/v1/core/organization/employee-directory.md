# Employee Directory
**Product:** Scholar Core (CCB overlap) | **Module:** Organization Management | **Frontend route:** `/organization-management/employee-directory` | **v1 status:** Complete

| Field | Value |
|---|---|
| Backend routes | `GET /organization-management/employee-directory` (list employees), `POST /organization-management/employee-directory` (create), `PUT /organization-management/employee-directory/{id}` (update) |
| Roles | Admin, HR Admin, Principal, Manager |
| Last updated | 2026-11-04 |
| Source commit | 8fe500dc (FE) / 86261072 (BE) |

## 1. Purpose & users
A searchable, filterable directory of all staff members. Displays pulse cards (summary stats) and a paginated data table. Managers and HR can view, add, and edit employee profiles including personal info, job role, competency ratings, expected competencies, skills, tasks, and uploaded documents.

## 2. Screens

### Employee directory — `/organization-management/employee-directory`
- **Pulse cards** (4 summary stats): TBD values from API.
- **Filter bar**: search by name, filter by department, job role, status.
- **Data table** (`PAGE_SIZE = 10`): columns include employee info, status badge, actions dropdown.
- **Add employee sheet** (lazy-loaded): `EmployeeDirectorySheets` — slide-over panel for adding a new employee.
- **Edit employee sheet**: multi-tab slide-over with tabs:
  - Personal info
  - Job role & skills
  - Job role tasks
  - Competency rating
  - Expected competency
  - Upload documents
  - LOR (Letter of Recommendation)

![](./screenshots/employee-directory.png)

## 3. Features & business rules

### Filter bar filters

| Filter | Type | Options |
|---|---|---|
| Search | Free text | Searches name and other employee fields |
| Department | Select | Populated from `HrmsDepartment` |
| Job role | Select | TBD |
| Status | Select | Active / Inactive / TBD |

### Employee data model tabs

| Tab | Purpose |
|---|---|
| Personal info | Name, contact, DOB, address |
| Job role & skills | Assigned job role, skill ratings |
| Job role tasks | Tasks associated with job role |
| Competency rating | Current competency levels |
| Expected competency | Target competency levels for the role |
| Upload documents | Document attachments (ID proof, certificates) |
| LOR | Letter of recommendation management |

**Permission rules:**
- HR Admin, Admin, Principal: full access (create, view, edit).
- Manager: view own department's employees; TBD if edit is restricted.
- Access guard: `canAccessDocuments()` / module RBAC via `tblgroupwise_rights`.

**Business rules:**
- Pagination: 10 employees per page.
- Free-text search is debounced (delay not read, but pattern used).
- Status badge uses `StatusBadge` component with `ShieldCheck` (active) / `ShieldAlert` (flagged) / `AlertCircle` icons.
- Transport layer: `useEmployeeDirectory()` hook calls `/organization-management/employee-directory` via `erp-client.ts`; uses `buildSessionContext()` for tenant+year scoping.

## 4. User flows

**Browse employees:**
1. Open `/organization-management/employee-directory`.
2. Pulse cards load with stats; employee table loads (page 1 of 10).
3. Filter by department or search by name.
4. Click a row to open the edit sheet.

**Add employee:**
1. Click "Add employee" (Plus icon).
2. Add sheet opens — fill personal info, assign job role.
3. Save — employee appears in table.

**Edit competency:**
1. Open edit sheet for an employee.
2. Switch to "Competency rating" tab.
3. Update ratings and save.

## 5. Data model
Employee data is sourced from the users table (`tbluserModel`) + organisation/HR tables. The directory endpoint joins multiple tables.

| Table | Purpose |
|---|---|
| `tbluserModel` (users) | Core employee record |
| `hrms_departments` | Department lookup |
| `s_users_skills` | Employee skill ratings |
| `s_competency_frameworks` | Competency framework |
| `tblemp_skills` | Individual skill-employee mapping |
| `master_skills` | Skill master list |

## 6. APIs

| Method | Endpoint | Auth | Notes |
|---|---|---|---|
| GET | `/organization-management/employee-directory` | JWT | Returns employee list with stats |
| POST | `/organization-management/employee-directory` | JWT | Create employee |
| PUT | `/organization-management/employee-directory/{id}` | JWT | Update employee |
| GET/PUT | `/api/dashboard-preferences/{key}` | JWT | Widget/column preferences |

Exact request/response shapes: TBD — `EmployeeDirectoryService` / `use-employee-directory.ts` not fully read.

## 7. UI components & design tokens
- `EmployeeDirectory`, `EmployeeDirectorySheets` — `app/organization-management/employee-directory/components/`
- `DataTable`, `FilterBar` — `components/ui/g2g/data-table`, `filter-bar` (G2G-ported components)
- `Button`, `Card`, `DropdownMenu` — `components/ui/g2g/` (G2G copies)
- `StatusBadge` — `components/ui/status-badge`
- Lucide: `Plus`, `Download`, `Upload`, `MoreHorizontal`, `User`, `ShieldAlert`, `ShieldCheck`, `UserPlus`, `Target`, `AlertCircle`

## 8. Reports & exports
- Download button (Download icon on toolbar) — TBD export format.
- Upload button — bulk employee import TBD.

## 9. Test cases

| ID | Scenario | Steps | Expected result | Type |
|---|---|---|---|---|
| ED-01 | Load directory | Open page | Pulse cards + table load | Happy |
| ED-02 | Search employee | Type name in search | Table filters | Happy |
| ED-03 | Filter by department | Select department | Only that dept's employees | Happy |
| ED-04 | Add employee | Click Add, fill form, save | Employee appears in list | Happy |
| ED-05 | Edit competency | Open edit sheet, change rating, save | Rating updated | Happy |
| ED-06 | Pagination | Navigate to page 2 | Next 10 employees load | Happy |
| ED-07 | No access | User without rights opens page | Redirected / 403 | Negative |

## 10. Known issues, limitations & FAQs
- **G2G port**: component is ported from an internal G2G design system; uses `components/ui/g2g/*` copies rather than the native EduERP design tokens directly.
- **Mock rows**: if no session, `useEmployeeDirectory` falls back to mock/empty rows (from source comment "loading only if a session exists").
- **Export format**: download button present but export format not confirmed from code.
- **FAQ**: "Why do I see mock data?" — Ensure you are logged in and the session is valid.

## 11. Sales notes
**Key selling points:**
- Complete staff directory with competency profiles — HR, Ops, and Academics in one place.
- Multi-tab employee record: personal info through LOR, all in a slide-over without leaving the list.
- Competency ratings linked directly to job roles and frameworks.

**Demo flow:**
1. Show directory with pulse cards (total staff, active, etc.).
2. Filter by department.
3. Open an employee — walk through the 7 tabs.
4. Update a competency rating and save.

**Plan/pricing:** TBD

## 12. v1 status & v2 ideas
**Complete:** Directory listing, filters, pagination, add/edit sheet, 7-tab employee form.
**Partial:** Export/import TBD; LOR tab internals TBD.
**v2 ideas:** Org chart view; bulk competency import; email employee directly from directory; skill gap heatmap overlay.

## Source files
- `C:\rajesh\lms_k12\app\organization-management\employee-directory\page.tsx`
- `C:\rajesh\lms_k12\app\organization-management\employee-directory\components\employee-directory.tsx`
- `C:\rajesh\lms_k12\app\organization-management\employee-directory\components\employee-directory-sheets.tsx`
- `C:\rajesh\lms_k12\app\organization-management\employee-directory\components\edit-employee\` (all tabs)

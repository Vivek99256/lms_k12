# Compliance Library
**Product:** Scholar Core (CCB overlap) | **Module:** Organization Management | **Frontend route:** `/organization-management/compliance-library` | **v1 status:** Complete

| Field | Value |
|---|---|
| Backend routes | TBD — `ComplianceLibraryRecord` model found; controller not read |
| Roles | Admin, HR Admin, Compliance Officer, Principal |
| Last updated | 2026-11-04 |
| Source commit | 8fe500dc (FE) / 86261072 (BE) |

## 1. Purpose & users
Tracks statutory and regulatory compliance obligations for the institute. Each record represents a compliance requirement with a due date, assignee, frequency, priority, and evidence attachments. Status auto-derives from due date unless manually overridden.

## 2. Screens

### Compliance library — `/organization-management/compliance-library`
Multi-view screen ported from G2G. Contains:
- **Dashboard** (`ComplianceDashboard`): summary stats of compliance by status.
- **Categories** (`ComplianceCategories`): browse by category.
- **Library management** (`ComplianceLibraryManagement`): full CRUD list with filters.
- **My compliances** (`ComplianceMy`): items assigned to the current user.
- **Overdue** (`ComplianceOverdue`): all overdue items.
- **Templates** (`ComplianceTemplates`): reusable compliance templates.
- **Calendar** (`ComplianceCalendar`): due dates on a calendar view.
- **Detail drawer** (`ComplianceDetailDrawer`): slide-over for viewing/editing a record.

![](./screenshots/compliance-library.png)

## 3. Features & business rules

### Record fields (`org_compliance_library` table)

| Field | Type | Required | Notes |
|---|---|---|---|
| name | varchar | Yes | Compliance item name |
| description | text | No | — |
| standard_name | varchar | No | Regulatory standard (e.g., CBSE guideline) |
| category_id | int FK | No | → `ComplianceCategory` |
| department / department_id | varchar / int FK | No | Free-text (legacy) + FK to `HrmsDepartment` |
| assigned_to | int FK | No | → `tbluserModel` |
| duedate | date | No | Triggers status auto-derivation |
| next_due_date | date | No | Auto-calculated for recurring items |
| frequency | varchar | No | One-Time / Daily / Weekly / Monthly / Quarterly / Half-Yearly / Yearly / Custom |
| custom_frequency_details | varchar | No | Used when frequency = Custom |
| status | varchar | No | 8 statuses (see below) |
| priority | varchar | No | Low / Medium / High / Critical |
| attachment | varchar | No | Evidence file |
| completed_at | datetime | No | — |
| completed_by | int FK | No | → users |
| parent_compliance_id | int FK | No | For recurring cycles |
| sub_institute_id | int | Yes | Tenant scope |

### Status values (8 statuses)

| Status | Trigger |
|---|---|
| Upcoming | Due date in future (> 30 days away) |
| Due Soon | Due date within 30 days |
| In Progress | Manually set |
| Pending Verification | Manually set |
| Completed | Manually set |
| Overdue | Due date in past (auto-derived) |
| Expired | Manually set |
| Not Applicable | Manually set |

**Rule:** `deriveStatus()` never overwrites a manually-controlled status (In Progress, Pending Verification, Completed, Expired, Not Applicable). Only Upcoming / Due Soon / Overdue are auto-computed.

### Priority values: Low, Medium, High, Critical

### Frequency & recurrence
- `calculateNextDueDate()` anchors the next cycle to the current cycle's due date (not completion date).
- One-Time: no next cycle generated.
- Custom: admin sets next date manually in `custom_frequency_details`.
- Recurring: `childCycles` relation chains history.

### Evidence
- `ComplianceEvidence` model: each record can have multiple evidence attachments.

**Permission rules:**
- Create / Edit / Delete: Admin, HR Admin, Compliance Officer.
- View: all roles with module access.
- Soft deletes (`SoftDeletes` trait): deleted records are hidden, not permanently removed.

## 4. User flows

**Create a compliance item:**
1. Open library management tab.
2. Click "Add compliance".
3. Fill name, standard, category, department, assignee, due date, frequency, priority.
4. Save — status auto-derives from due date.

**Mark completed:**
1. Open detail drawer.
2. Set status to "Completed".
3. Attach evidence.
4. Save — `completed_at` and `completed_by` recorded.

**Recurring cycle:**
1. Admin marks a Yearly compliance as "Completed".
2. Backend (TBD) generates a child cycle with `calculateNextDueDate()` result as new `duedate`.

## 5. Data model

| Table | Model | Notes |
|---|---|---|
| `org_compliance_library` | `ComplianceLibraryRecord` | Main compliance records |
| `org_compliance_categories` | `ComplianceCategory` | Category lookup |
| `org_compliance_evidence` | `ComplianceEvidence` | Evidence per record |
| `org_compliance_templates` | `ComplianceTemplate` | Reusable templates |
| `hrms_departments` | `HrmsDepartment` | Department FK |

## 6. APIs
TBD — `ComplianceLibraryManagement` component and its API client not read. Calls go to backend via `erp-client.ts` or G2G transport.

## 7. UI components & design tokens
- `ComplianceDashboard`, `ComplianceCategories`, `ComplianceLibraryManagement`, `ComplianceMy`, `ComplianceOverdue`, `ComplianceTemplates`, `ComplianceCalendar`, `ComplianceDetailDrawer` — `app/organization-management/compliance-library/components/`
- `ComplianceLibraryFiltersBar`, `ComplianceLibraryManagementDialogs`, `ComplianceLibraryManagementToolbar` — supporting components
- `compliance-theme.tsx` — module-specific theme/token overrides (content TBD)

## 8. Reports & exports
TBD — no explicit report route found.

## 9. Test cases

| ID | Scenario | Steps | Expected result | Type |
|---|---|---|---|---|
| CL-01 | Create a compliance item with due date 15 days away | Save | Status = "Due Soon" | Happy |
| CL-02 | Create with due date 60 days away | Save | Status = "Upcoming" | Happy |
| CL-03 | Create with past due date | Save | Status = "Overdue" | Happy |
| CL-04 | Manually set status to "In Progress" | Update | Status stays "In Progress" even if date passes | Edge |
| CL-05 | Soft delete | Delete record | Record hidden, not permanently removed | Happy |
| CL-06 | Recurring: mark yearly compliance complete | Complete + save | Next cycle created with duedate+1 year | Happy |
| CL-07 | Custom frequency with invalid date | Enter bad date in custom_frequency_details | `calculateNextDueDate()` returns null | Edge |
| CL-08 | Filter overdue | Open Overdue tab | Only overdue items shown | Happy |

## 10. Known issues, limitations & FAQs
- **New table, NOT `master_compliance`**: `org_compliance_library` is a new table. The old `master_compliance` SQAA table still exists separately — they are unrelated.
- **API routes TBD**: controller not read in this pass.
- **Recurrence generation**: `calculateNextDueDate()` is defined on the model but whether the backend auto-generates child cycles on completion is TBD.
- **FAQ**: "What is the difference between Compliance Library and SQAA?" — SQAA is school accreditation; Compliance Library tracks statutory obligations (CBSE norms, fire safety, labour law, etc.).

## 11. Sales notes
**Key selling points:**
- 8-status lifecycle with auto-derivation — never miss a deadline.
- Full recurrence engine: One-Time through Custom frequency.
- Evidence trail per item — audit-ready.
- Calendar view for a visual deadline overview.

**Demo flow:**
1. Show dashboard with status breakdown (overdue count in red).
2. Open an overdue item — show evidence tab.
3. Create a new Quarterly item — show how next_due_date auto-calculates.
4. Filter "My compliances" — show assigned items.

**Plan/pricing:** TBD

## 12. v1 status & v2 ideas
**Complete:** Data model, status engine, recurrence, evidence, 8 UI tabs.
**Partial:** API routes not read; recurrence auto-generation TBD.
**v2 ideas:** Email reminders to assignees; bulk import from regulatory database; compliance score dashboard; integration with audit platform.

## Source files
- `C:\rajesh\lms_k12\app\organization-management\compliance-library\page.tsx`
- `C:\rajesh\lms_k12\app\organization-management\compliance-library\components\` (all 11 files)
- `F:\xampp\htdocs\next_lms_erp\app\Models\OrganizationManagement\ComplianceLibraryRecord.php`
- `F:\xampp\htdocs\next_lms_erp\app\Models\OrganizationManagement\ComplianceCategory.php`
- `F:\xampp\htdocs\next_lms_erp\app\Models\OrganizationManagement\ComplianceEvidence.php`
- `F:\xampp\htdocs\next_lms_erp\app\Models\OrganizationManagement\ComplianceTemplate.php`

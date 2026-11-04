# Disciplinary Library
**Product:** Scholar Core (CCB overlap) | **Module:** Organization Management | **Frontend route:** `/organization-management/disciplinary-library` | **v1 status:** Complete

| Field | Value |
|---|---|
| Backend routes | TBD — `DisciplinaryRecord` model found; controller not read |
| Roles | Admin, HR Admin, Principal |
| Last updated | 2026-11-04 |
| Source commit | 8fe500dc (FE) / 86261072 (BE) |

## 1. Purpose & users
Records and tracks disciplinary incidents involving staff members. Each record captures the incident details, the employee involved, witness, action taken, and reporting metadata. HR admins and principals use this to maintain a disciplinary history per employee.

## 2. Screens

### Disciplinary library — `/organization-management/disciplinary-library`
Ported from G2G's `disciplinary-management.tsx`. Contains:
- **DisciplinaryManagement** component: list of disciplinary records with CRUD.
- **Management form** (`DisciplinaryManagementForm`): add/edit record form.

![](./screenshots/disciplinary-library.png)

## 3. Features & business rules

### Record fields (`org_disciplinary_library` table)

| Field | Type | Required | Notes |
|---|---|---|---|
| department_id | int FK | No | → `HrmsDepartment` |
| employee_id | int FK | Yes | → `tbluserModel` (employee involved) |
| incident_datetime | datetime | Yes | Date and time of incident |
| location | varchar | No | Where the incident occurred |
| misconduct_type | varchar | Yes | Type of misconduct |
| description | text | No | Full incident description |
| witness_id | int FK | No | → `tbluserModel` (witness) |
| action_taken | varchar/text | No | Disciplinary action applied |
| remarks | text | No | Additional remarks |
| reported_by | int FK | Yes | → `tbluserModel` |
| date_of_report | date | Yes | When the report was filed |
| sub_institute_id | int | Yes | Tenant scope |

**Permission rules:**
- HR Admin, Admin, Principal: full CRUD.
- Soft deletes (`SoftDeletes`): records are hidden, not permanently deleted.

**Bug fixed vs. G2G source (documented in model):**
G2G's `updatedUser()` and `deletedUser()` both incorrectly bound to `created_by`. This model correctly binds `updatedUser` → `updated_by` and `deletedUser` → `deleted_by`.

**Business rules:**
- Misconduct types are free-text in the model; a lookup list may exist in the UI (TBD from form component).
- `incident_datetime` is cast as datetime; `date_of_report` as date.
- Employee, witness, and reporter all link back to the main users table.

## 4. User flows

**Record a disciplinary incident:**
1. Open `/organization-management/disciplinary-library`.
2. Click "Add incident".
3. Select employee, fill incident datetime, location, misconduct type, description.
4. Optionally select a witness.
5. Enter action taken and remarks.
6. Save — record appears in list.

**Edit a record:**
1. Click edit on a row.
2. Management form pre-fills.
3. Update and save.

## 5. Data model

### Table: `org_disciplinary_library`

| Column | Type | Notes |
|---|---|---|
| id | bigint PK | Auto-increment |
| department_id | int FK | → `hrms_departments.id` |
| employee_id | int FK | → users |
| incident_datetime | datetime | — |
| location | varchar | — |
| misconduct_type | varchar | Free-text |
| description | text | — |
| witness_id | int FK | → users |
| action_taken | text | — |
| remarks | text | — |
| reported_by | int FK | → users |
| date_of_report | date | — |
| sub_institute_id | int | Tenant |
| created_by | int FK | → users |
| updated_by | int FK | → users |
| deleted_by | int FK | → users |
| deleted_at | timestamp | Soft delete |

## 6. APIs
TBD — controller not read.

## 7. UI components & design tokens
- `DisciplinaryManagement`, `DisciplinaryManagementForm` — `app/organization-management/disciplinary-library/components/`

## 8. Reports & exports
TBD.

## 9. Test cases

| ID | Scenario | Steps | Expected result | Type |
|---|---|---|---|---|
| DI-01 | Add incident | Fill all required fields, save | Record in list | Happy |
| DI-02 | Add without employee | Leave employee_id empty | Validation error | Negative |
| DI-03 | Soft delete | Delete record | Record hidden, recoverable | Happy |
| DI-04 | Edit action taken | Update action field | Updated value saved | Happy |
| DI-05 | View employee history | Filter by employee | Only that employee's records | Happy |

## 10. Known issues, limitations & FAQs
- **API routes TBD**: controller not read in this pass.
- **Misconduct types**: free-text in the model — no enforced lookup list found. May lead to inconsistent data.
- **FAQ**: "Is this the same as student discipline?" — No. This module tracks staff disciplinary incidents; student discipline is at `/students/discipline` under the Student module.

## 11. Sales notes
**Key selling points:**
- Structured disciplinary history per employee — replaces ad-hoc spreadsheets.
- Witness and reporter linked to user accounts — audit trail.
- Soft delete means records are never lost.

**Demo flow:**
1. Show empty disciplinary library.
2. Add a sample incident (misconduct type: "Late attendance", action: "Verbal warning").
3. Show how it links to the employee's directory record.

**Plan/pricing:** TBD

## 12. v1 status & v2 ideas
**Complete:** Data model, CRUD UI (ported from G2G), soft delete, bug fix on updatedUser/deletedUser.
**Partial:** API routes TBD; misconduct type lookup TBD.
**v2 ideas:** Misconduct type master (standardised lookup); escalation workflow; link to Talent Management performance records; HR notification on new record.

## Source files
- `C:\rajesh\lms_k12\app\organization-management\disciplinary-library\page.tsx`
- `C:\rajesh\lms_k12\app\organization-management\disciplinary-library\components\disciplinary-management.tsx`
- `C:\rajesh\lms_k12\app\organization-management\disciplinary-library\components\disciplinary-management-form.tsx`
- `F:\xampp\htdocs\next_lms_erp\app\Models\OrganizationManagement\DisciplinaryRecord.php`

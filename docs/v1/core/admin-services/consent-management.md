# Consent Management
**Product:** Scholar Core | **Module:** Admin Services | **Frontend route:** `/admin-services/consent-master`, `/admin-services/delete-consent-master`, `/admin-services/consent-report` | **v1 status:** Complete

| Field | Value |
|---|---|
| Backend routes | `GET api/consents/students`, `GET/POST api/consents`, `POST api/consents/delete` |
| Roles | Admin, Class Teacher |
| Last updated | 2026-11-04 |
| Source commit | 8fe500dc (FE) / 86261072 (BE) |

## 1. Purpose & users
Issues consent forms to students for field trips, events, or activities. Staff select a class, choose students, set consent title and date, and issue. Parents respond via the mobile app. Report and delete screens share the same endpoint.

## 2. Screens

### Consent Master (`/admin-services/consent-master`)
Class filter + student picker table + consent form (title, date, accountable status). Issues consents to selected students.

### Delete Consent Master (`/admin-services/delete-consent-master`)
Same as consent report but exposes a delete checkbox column per consent row.

### Consent Report (`/admin-services/consent-report`)
Date + class filtered read-only list of issued consents with parent response status.

## 3. Features & business rules

| Field | Type | Required | Validation | Default |
|---|---|---|---|---|
| Standard / Division | ClassFilters | Yes | — | — |
| Students | Checkbox table | Yes (at least one) | — | None selected |
| Title | Text | Yes | — | — |
| Date | Date | Yes | — | Today |
| Accountable status | Select | Yes | Accountable / Non accountable | Accountable |

**Accountable statuses:** `Accountable` or `Non_Accountable`. Controls how the parent's response is treated financially or legally.

**Parent response statuses:** `null` (no response yet) shown as "Pending" in ERP.

**Idempotency:** Backend `api/consents` does not duplicate-check; issuing consent twice creates two rows.

## 4. User flows

**Issue consent:**
1. Select class → load students.
2. Check students to include.
3. Fill title, date, accountable status.
4. Save — consent rows created per student.

**View responses:**
- Open Consent Report, filter by date/class.
- See parent status per student (Pending / Accepted / Rejected).

**Delete:**
- Open Delete Consent Master, select rows, delete.

## 5. Data model

| Table | Key columns | Notes |
|---|---|---|
| `consent_master` | id, sub_institute_id, student_id, enrollment_no, standard, title, consent_date, account_status, parent_status, amount, created_by | Main table |

## 6. APIs

| Method | Endpoint | Auth | Request | Response |
|---|---|---|---|---|
| GET | `api/consents/students` | JWT | grade, standard, division | student list |
| GET | `api/consents` | JWT | standard, division, from_date, to_date | consent list |
| POST | `api/consents` | JWT | `{ title, date, accountableStatus, standardId, divisionId, studentIds[] }` | `{ success, message }` |
| POST | `api/consents/delete` | JWT | `{ consentIds[] }` | `{ success, message }` |

## 7. UI components & design tokens
- `ClassFilters` — grade/standard/division selector
- `ErpPageHeader`, `ErpSection`, `ErpAlert`, `ErpLoading`
- `Table`, `TableHead`, `TableRow`, `TableCell` (shadcn)
- Lucide: `FileSignature`, `Save`, `Search`

## 8. Reports & exports
- `/admin-services/consent-report` — date/class filtered list; export TBD

## 9. Test cases

| ID | Scenario | Steps | Expected result | Type |
|---|---|---|---|---|
| TC-CON-01 | Issue consent to full class | Select all, fill form, save | Consent rows created for all | Happy |
| TC-CON-02 | Issue without selecting students | Save with no students | Validation error | Negative |
| TC-CON-03 | View pending responses | Open report | Shows "Pending" for unanswered | Happy |
| TC-CON-04 | Delete consent | Open delete screen, select, delete | Rows removed | Happy |

## 10. Known issues, limitations & FAQs
- No duplicate check on issue — issuing same consent twice creates two rows.
- **FAQ:** How does the parent respond? Via the student mobile app. No web parent portal in v1.
- **FAQ:** Can consent have an amount? `amount` column exists in schema but not in the issue form; likely for future use.

## 11. Sales notes
- Digital consent replaces paper slips that get lost.
- Audit trail shows which parents consented for school trips.

## 12. v1 status & v2 ideas
- **Complete:** Issue, report, delete.
- **v2 ideas:** Deadline enforcement, reminder notifications, digital signature.

## Source files
- `C:\rajesh\lms_k12\app\admin-services\consent-master\page.tsx`
- `C:\rajesh\lms_k12\app\admin-services\_lib\consent.ts`
- `F:\xampp\htdocs\next_lms_erp\database\migrations\2023_03_05_115658_create_consent_master_table.php`

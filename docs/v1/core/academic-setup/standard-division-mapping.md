# Standard Division Mapping
**Product:** Scholar Core | **Module:** Academic Setup | **Frontend route:** `/academic_setup/standard_division_mapping` | **v1 status:** Complete

| Field | Value |
|---|---|
| Backend routes | `GET /academic-setup/standard-division-mapping`, `POST /academic-setup/standard-division-mapping`, `PUT/DELETE /academic-setup/standard-division-mapping/{id}` |
| Roles | Admin, Academic Coordinator |
| Last updated | 2026-11-04 |
| Source commit | 8fe500dc (FE) / 86261072 (BE) |

## 1. Purpose & users
Maps which divisions are available under each standard (e.g. Standard 10 has Divisions A, B, C). This mapping controls what appears in class-picker dropdowns across the entire ERP — timetable, attendance, fees, admissions, results.

## 2. Screens
**Mapping screen** — `/academic_setup/standard_division_mapping`
Rendered in mapping mode: shows a matrix of standards (rows) × divisions (columns). Checkboxes enable/disable each combination. Auto-opens in form mode (no list; the form is the mapping grid itself).

![](./screenshots/standard-division-mapping.png)

## 3. Features & business rules
- The screen uses `mapping: true` in the `AcademicSetupPage` config — it shows the matrix instead of the standard add/list form.
- Each standard can have multiple divisions.
- Unchecking a mapping does not delete existing student enrollments — it only removes the combination from new pickers.
- Changes are saved as a batch update via `POST /academic-setup/standard-division-mapping`.
- The `std_div_mapping` table stores `standard_id → division_id` pairs per institute.

**Permissions:** Admin and academic coordinator only.

## 4. User flows

**Set up mappings:**
1. Navigate to Academic Setup → Standard division mapping.
2. Matrix loads: rows = standards, columns = divisions.
3. Check/uncheck combinations.
4. Save → updated mapping applies across all modules.

## 5. Data model

**Table: `std_div_mapping`** (via `std_div_mappingModel`)

| Column | Type | Notes |
|---|---|---|
| id | bigint PK | |
| standard_id | int FK → `standard.id` | |
| division_id | int FK → `division.id` | |
| sub_institute_id | int | Tenant |
| created_at / updated_at | timestamp | |

**Related tables:** `standard`, `division`.

## 6. APIs

| Method | Endpoint | Auth | Request | Response |
|---|---|---|---|---|
| GET | `/api/academic-setup/standard-division-mapping` | JWT session | session params | `{ standards, divisions, mappings: { standardId: [divisionId, …] } }` |
| POST | `/api/academic-setup/standard-division-mapping` | JWT session | `{ [standardId]: [divisionId, …] }` | `{ status_code, message }` |

## 7. UI components & design tokens
`AcademicSetupPage` with `mapping: true`. The form iterates `data.standards` and renders a checkbox row of `data.divisions` per standard. Uses `Card`, `Label`, checkboxes from `components/ui/`.

## 8. Reports & exports
No standalone report. This mapping drives class-picker dropdowns everywhere.

## 9. Test cases

| ID | Scenario | Steps | Expected result | Type |
|---|---|---|---|---|
| SD01 | Map std to division | Check Std 10 × Div A | Combination saved | Happy |
| SD02 | Unmap combination | Uncheck Std 10 × Div A | No longer in dropdowns | Happy |
| SD03 | Save without change | Open, save immediately | No error; data unchanged | Edge |
| SD04 | Division appears in timetable | Map Std 9 × Div B; go to timetable | Std 9 / Div B available | Happy |

## 10. Known issues, limitations & FAQs
- Unmapping an active combination does not warn the user that existing timetable/enrollment data references it.
- **FAQ:** "Division not showing in class picker" — it must be mapped here first.

## 11. Sales notes
- One-time setup that propagates to all modules instantly.
- Demo: add a new division → map it → show it in timetable dropdown within seconds.

## 12. v1 status & v2 ideas
- v1: Complete.
- v2: Warn before unmapping if active students/timetable entries exist for that combination.

## Source files
- `C:\rajesh\lms_k12\app\academic_setup\standard_division_mapping\page.tsx`
- `C:\rajesh\lms_k12\app\academic_setup\_components\AcademicSetupPage.tsx`
- `C:\rajesh\lms_k12\app\academic_setup\api.ts`
- `F:\xampp\htdocs\next_lms_erp\app\Http\Controllers\school_setup\std_divController.php`
- `F:\xampp\htdocs\next_lms_erp\app\Models\school_setup\std_div_mappingModel.php`

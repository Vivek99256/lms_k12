# Grade Master
**Product:** Scholar Core | **Module:** Exam / Result | **Frontend route:** `/result/master/grade-master` | **v1 status:** Complete

| Field | Value |
|---|---|
| Backend routes | `GET/POST/PUT/DELETE api/result/grade-master` (via MasterCrud), `api/result/grade-scale-master` |
| Roles | Admin, Exam Coordinator |
| Last updated | 2026-11-04 |
| Source commit | 8fe500dc (FE) / 86261072 (BE) |

## 1. Purpose & users
Defines grading scales (e.g., A1–E, 90–100 = A1) and their grade-data break-offs used to auto-assign grades during marks entry. Used by Admin and Exam Coordinators before any exam cycle begins. Must be configured before marks entry can produce correct grades.

## 2. Screens

### Grade Master (tabbed screen)
Route: `/result/master/grade-master`
Two tabs:
- **Grade scales** — named grade scales (e.g., CBSE 10-point, Percentage). Add, edit, delete scale types.
- **Grade data** — per-scale break-off ranges, GP (grade points) and optional comment per grade letter.

![](./screenshots/grade-master.png)

## 3. Features & business rules

### Grade Scales tab
| Field | Type | Required | Validation | Default |
|---|---|---|---|---|
| Scale name | text | Yes | max 255 | — |

### Grade Data tab
| Field | Type | Required | Validation | Default |
|---|---|---|---|---|
| Grade scale | select | Yes | Must exist in grade_master | — |
| Grade letter | text | Yes | max 10 | — |
| Min % | number | Yes | 0–100 | — |
| Max % | number | Yes | 0–100, > min | — |
| Grade point (GP) | number | No | — | — |
| Comment | text | No | max 255 | — |

**Rules:**
- Grade ranges must be non-overlapping within a scale.
- Marks entry uses `api/result/marks-entry/create` which returns `grd_data` (grade letter → percentage range array) for client-side grade derivation.
- Grade is recalculated client-side on every marks change using `Math.round(percentage)` lookup.
- Deleting a scale in use by an exam does not cascade — existing marks retain their grade letter strings.

**Permissions:** Only Admin / Exam Coordinator can create, edit or delete.

## 4. User flows

### Happy path — add a new grade scale
1. Navigate to Result → Masters → Grade master.
2. Click "Grade scales" tab → "Add" button.
3. Enter scale name → Save.
4. Switch to "Grade data" tab → "Add".
5. Select scale, enter grade letter, min %, max %, GP → Save.
6. Repeat step 5 for each grade band.

### Edit a grade break-off
1. Grade data tab → click edit icon on a row.
2. Modify min/max % → Save.

## 5. Data model

| Table | Key columns | Notes |
|---|---|---|
| `grade_master` | `id`, `sub_institute_id`, `grade_scale_name`, `created_by`, `created_at` | One row per scale |
| `grade_master_data` | `id`, `grade_master_id`, `grade`, `min_per`, `max_per`, `gp`, `comment`, `sub_institute_id` | Grade bands; FK → grade_master |

Relations: `grade_master` hasMany `grade_master_data`.
Index: `sub_institute_id` on both tables (inferred from multi-tenant pattern).

## 6. APIs

| Method | Endpoint | Auth | Request | Response |
|---|---|---|---|---|
| GET | `api/result/grade-master` | JWT | — | `{ data: GradeMaster[] }` |
| POST | `api/result/grade-master` | JWT | `{ grade_scale_name }` | `{ success, message }` |
| PUT | `api/result/grade-master` | JWT | `{ id, grade_scale_name }` | `{ success, message }` |
| DELETE | `api/result/grade-master` | JWT | `{ id }` | `{ success, message }` |
| GET | `api/result/grade-scale-master` | JWT | — | `{ data: GradeData[] }` |
| POST | `api/result/grade-scale-master` | JWT | `{ grade_master_id, grade, min_per, max_per, gp, comment }` | `{ success, message }` |

Controller: `GradeMasterController.php`

## 7. UI components & design tokens
- `MasterCrud` — generic CRUD table component (`components/result/MasterCrud.tsx`)
- `PageHeader` — breadcrumb + title bar (`components/result/PageHeader.tsx`)
- `Tabs` — tab switcher (`components/result/primitives`)
- Lucide icons: `Scale`, `Ruler`
- Design tokens: `--surface-*`, `--content-*`, `--border-*`

## 8. Reports & exports
No dedicated export. Grade data is used as reference in marks entry and report cards.

## 9. Test cases

| ID | Scenario | Steps | Expected result | Type |
|---|---|---|---|---|
| GM-01 | Add valid grade scale | Enter name → Save | Row appears in list | Happy |
| GM-02 | Add grade data with valid range | Select scale, enter 90–100 → Save | Row saved, marks entry picks up grade | Happy |
| GM-03 | Overlapping ranges | Add 80–100 then 90–100 same scale | Server or client should reject / warn | Edge |
| GM-04 | Delete scale in use | Delete scale linked to active exam | Existing marks retain grade string; no cascade error | Edge |
| GM-05 | Missing required field | Submit without scale name | Inline validation error | Negative |

## 10. Known issues, limitations & FAQs
- **No server-side overlap check** — overlapping grade ranges are not validated on the backend. The first matching range wins in `findGrade()`.
- **No bulk import** — grade scales must be entered one row at a time.
- FAQ: *Why is a student's grade showing "–" ?* — Either the subject's exam is not linked to a grade scale, or the marks value is non-numeric (AB, N.A., EX).

## 11. Sales notes
- **Selling point:** Supports any grading system — CBSE, ICSE, IB, percentage, GPA — from one screen.
- **Demo flow:** Show two scales (CBSE 10-point + percentage), then enter marks and watch grades auto-populate.
- Pricing: TBD (included in Scholar Core).

## 12. v1 status & v2 ideas
- v1: Complete. CRUD works; marks entry consumes grades correctly.
- Partial: No server-side overlap validation.
- v2: Add overlap detection; support grade import from Excel; link scales to board type.

## Source files
- `C:\rajesh\lms_k12\app\result\master\grade-master\page.tsx`
- `C:\rajesh\lms_k12\lib\result\masters.ts` (gradeScaleMaster, gradeDataMaster definitions)
- `F:\xampp\htdocs\next_lms_erp\app\Http\Controllers\result\GradeMasterController.php`
- `F:\xampp\htdocs\next_lms_erp\app\Models\result\GradeMaster.php`
- `F:\xampp\htdocs\next_lms_erp\app\Models\result\GradeMasterData.php`
- Migrations: `2023_03_05_115658_create_grade_master_table.php`, `2023_03_05_115658_create_grade_master_data_table.php`

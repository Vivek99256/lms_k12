# Bulk Student Update
**Product:** Scholar Core | **Module:** Student | **Frontend route:** `/student/bulk_student_update` | **v1 status:** Complete

| Field | Value |
|---|---|
| Backend routes | `GET /api/proxy?path=bulk-students/metadata` · `POST /api/proxy?path=bulk-students/search` · `PUT /api/proxy?path=bulk-students` |
| Roles | Admin |
| Last updated | 2026-11-04 |
| Source commit | 8fe500dc (FE) / 86261072 (BE) |

## 1. Purpose & users
Allows admin to edit multiple students' data fields simultaneously in a spreadsheet-style grid. Used for batch corrections (e.g. updating roll numbers at the start of the year, correcting addresses, assigning houses in bulk) without editing each student individually.

## 2. Screens

**Bulk Student Update** (`/student/bulk_student_update`)
- Filter bar: Section/Standard/Division cascade + Sort-by dropdown
- Field selector: checkboxes to choose which columns appear in the grid (default: enrollment_no, first_name, last_name, roll_no)
- Editable data grid: one row per student, editable cells for selected fields
- Save button

![](./screenshots/bulk-student-update.png)

## 3. Features & business rules

### Default fields shown
`enrollment_no`, `first_name`, `last_name`, `roll_no`

### Available fields
Loaded dynamically from `bulk-students/metadata`. Fields have types: `text`, `email`, `date`, `select`. Select fields have options loaded from metadata.

### Filter options
Section → Standard → Division cascade (same as Add Student).

### Sort options
Default `order_by = student_name`. Other options loaded from backend.

### Save behavior
- Sends only the currently selected fields for each student.
- `PUT /api/proxy?path=bulk-students` with JSON body `{ students: [{ id, values: { field: value } }] }`.
- One success/error banner after save.

### Permissions
Admin only — no teacher-level bulk edit.

## 4. User flows

**Bulk update roll numbers**
1. Navigate to Student → Bulk Update.
2. Select Section/Standard/Division.
3. Enable "roll_no" field in field selector.
4. Click Search — grid loads with students.
5. Edit roll numbers in grid cells.
6. Click Save — all updated rows sent in one PUT request.

## 5. Data model
Operates directly on `tblstudent` rows. No separate audit table for bulk edits in v1 (changes overwrite existing values directly).

## 6. APIs
| Method | Endpoint | Auth | Request | Response | Errors |
|---|---|---|---|---|---|
| GET | `bulk-students/metadata` | Session | Session params | `{ data: { fields:[BulkField[]], options:{} } }` | — |
| POST | `bulk-students/search` | Session | grade, standard, division, order_by, fields[] | `{ data: { students:[BulkStudentRow[]] } }` | — |
| PUT | `bulk-students` | Session | JSON: `{ students:[{ id, values:{} }] }` | `{ status:1, message:"Students updated." }` | 422 validation |

## 7. UI components & design tokens
- Cascading `Select` (from search_student/api)
- Field-selector checkboxes panel (toggled by Settings2 icon)
- Editable `<input>` cells in a table grid
- Lucide icons: `CheckSquare`, `Save`, `Search`, `Settings2`, `Users`

## 8. Reports & exports
No export from this screen. Changes are reflected in the student list reports.

## 9. Test cases
| ID | Scenario | Steps | Expected result | Type |
|---|---|---|---|---|
| S-BULK-01 | Update roll numbers | Search class, edit roll_no column, save | All changed values persisted | Happy |
| S-BULK-02 | Add field column | Toggle "dob" in field selector | DOB column appears in grid | Happy |
| S-BULK-03 | Save with no changes | Load grid, click Save | Success message; no data corruption | Edge |
| S-BULK-04 | Invalid email | Type "notanemail" in email field | Backend returns validation error | Negative |
| S-BULK-05 | Search with no division | Select section and standard only | Students across all divisions shown | Edge |

## 10. Known issues, limitations & FAQs
- No audit trail for bulk edits in v1 — changes overwrite without logging who changed what. Use Fees Audit or database backups for compliance.
- All students are loaded in one API call; very large classes may be slow.

**FAQ:** *Can I bulk update photos?* — No; photo upload is separate (Face Attendance capture).

## 11. Sales notes
**Selling points:** Spreadsheet-like editing for fast year-start data setup (roll numbers, house assignment, etc.); configurable column selection.

**Demo flow:**
1. Load a class.
2. Toggle field selector to show roll_no.
3. Edit three roll numbers.
4. Save and show confirmation.

Plan/pricing: TBD

## 12. v1 status & v2 ideas
**Complete:** Grid edit, metadata-driven field selection, cascade filters.
**Partial:** No audit trail.
**v2 ideas:** Audit log for bulk changes; CSV import/export for offline editing; undo last save.

## Source files
- `C:\rajesh\lms_k12\app\student\bulk_student_update\page.tsx`
- `C:\rajesh\lms_k12\app\student\bulk_student_update\api.ts`
- `F:\xampp\htdocs\next_lms_erp\app\Http\Controllers\student\studentBulkUpdateController.php`

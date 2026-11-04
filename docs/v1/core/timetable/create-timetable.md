# Create Timetable
**Product:** Scholar Core | **Module:** Timetable | **Frontend route:** `/front_desk/create-timetable` | **v1 status:** Complete

| Field | Value |
|---|---|
| Backend routes | `POST school_setup/ajax_getTimetableSections`, `POST school_setup/ajax_getTimetableStandards`, `POST school_setup/ajax_getTimetableDivisions`, `POST school_setup/ajax_getTimetableGrid`, `POST school_setup/ajax_saveTimetableEntry`, `DELETE school_setup/ajax_deleteTimetableEntry` |
| Roles | Admin, Academic Coordinator |
| Last updated | 2026-11-04 |
| Source commit | 8fe500dc (FE) / 86261072 (BE) |

## 1. Purpose & users
Allows academic coordinators to build and edit the weekly period timetable for each class (Section → Standard → Division). Each cell in the grid holds Subject + Teacher + optional Batch. Changes take effect immediately for that class's timetable view.

## 2. Screens
**Timetable editor** — `/front_desk/create-timetable`
1. Three cascading dropdowns: Section → Standard → Division.
2. On selection: grid loads with rows = Periods (sorted by `sort_order`), columns = Weekdays.
3. Each cell: Subject dropdown + Teacher dropdown + optional Batch dropdown.
4. Teacher dropdown shows `remainingLecture` count alongside name.
5. Save/Delete buttons per cell.

Also has an AI Stack sub-page at `/front_desk/create-timetable/ai-stack`.

![](./screenshots/create-timetable.png)

## 3. Features & business rules

| Field | Type | Required | Notes |
|---|---|---|---|
| Section (Grade) | Select | Yes | Cascades to Standard |
| Standard | Select | Yes | Cascades to Division |
| Division | Select | Yes | Loads timetable grid |
| Subject | Select per cell | Yes | Filtered to subjects mapped to this standard |
| Teacher | Select per cell | Yes | Shows remaining lecture count |
| Batch | Select per cell | No | Optional; for split-class batches |

- A cell can hold multiple entries (batch-based: different batches in the same slot).
- Saving a cell: if `entryId` is null → create; if non-null → update.
- Deleting a cell: `DELETE` with `entryId`.
- Timetable is scoped to `sub_institute_id`, `syear`, `academic_section_id` (term_id from session).
- The backend deduplicates: if an identical entry exists (same period + weekday + standard + division + no batch), it updates rather than duplicates.
- `remaining_lecture` is informational only; no hard cap enforced in v1.

**Permissions:** Create/edit restricted to admin and academic coordinator.

## 4. User flows

**Build timetable for a class:**
1. Select Section → Standard → Division.
2. Grid loads with current assignments (or blank cells).
3. For each slot: pick Subject → Teacher → (optional) Batch.
4. Save cell → assignment stored.

**Add batch-based slot (split class):**
1. Same period/weekday → add another row for a different batch.
2. Each batch row has its own Subject + Teacher.

**Delete an entry:**
1. Clear a cell → click delete → entry removed; cell goes blank.

## 5. Data model

**Table: `timetable`**

| Column | Type | Notes |
|---|---|---|
| id | bigint PK | |
| sub_institute_id | int | Tenant |
| syear | varchar | Academic year |
| academic_section_id | int | Grade (section) |
| standard_id | int FK → `standard.id` | |
| division_id | int FK → `division.id` | |
| batch_id | int FK → `batch.id` nullable | For split batches |
| period_id | int FK → `period.id` | |
| subject_id | int FK → `subject.id` | |
| teacher_id | int FK → `tbluser.id` | |
| week_day | varchar | e.g. "Monday" |
| merge | tinyint nullable | Merged slot flag |
| marking_period_id | int nullable | Term scope |
| created_at / updated_at | timestamp | |

## 6. APIs

All proxied via Next.js `/api/proxy?path=school_setup/…` → Laravel `school_setup/*Controller`.

| Method | Endpoint | Purpose |
|---|---|---|
| POST | `school_setup/ajax_getTimetableSections` | Load grade options |
| POST | `school_setup/ajax_getTimetableStandards` | Load standards for grade |
| POST | `school_setup/ajax_getTimetableDivisions` | Load divisions for standard |
| POST | `school_setup/ajax_getTimetableGrid` | Full grid: weekdays, periods, subjects, teachers, batches, entries |
| POST | `school_setup/ajax_saveTimetableEntry` | Save one slot |
| DELETE | `school_setup/ajax_deleteTimetableEntry` | Remove one slot |

Request body always includes `sub_institute_id`, `syear`, `type: "API"`.

## 7. UI components & design tokens
- Custom grid component (`CreateTimetablePage` in `create-timetable/page.tsx`).
- Uses `CalendarClock`, `LoaderCircle`, `Search`, `X` from `lucide-react`.
- `Button`, `Label` from `components/ui/`.
- `SearchDropdown` for class selection.
- Cell selects styled with inline `selectClass()` function (Tailwind utility string).

## 8. Reports & exports
- Classwise timetable view: [classwise-timetable.md](classwise-timetable.md)
- Facultywise timetable view: [facultywise-timetable.md](facultywise-timetable.md)

## 9. Test cases

| ID | Scenario | Steps | Expected result | Type |
|---|---|---|---|---|
| TT01 | Create slot | Select class, pick period/day/subject/teacher; save | Entry stored; visible in grid | Happy |
| TT02 | Batch slot | Add second entry same period/day with different batch | Both entries coexist | Happy |
| TT03 | Delete slot | Clear cell; delete | Entry removed | Happy |
| TT04 | Teacher remaining lectures | Open teacher dropdown | Remaining lecture count shown | Happy |
| TT05 | Load empty grid | New class with no entries | Blank grid with period/day labels | Edge |
| TT06 | Duplicate entry (no batch) | Save same subject/teacher to same slot twice | Server deduplicates (updates) | Edge |

## 10. Known issues, limitations & FAQs
- `marking_period_id` on `timetable` is set from session `term_id` but timetable queries comment it out — timetable is not term-isolated in v1.
- No conflict detection: same teacher assigned to two classes in the same slot is not flagged.
- **FAQ:** "Teacher dropdown is empty" — the teacher must have an active staff account scoped to this institute.

## 11. Sales notes
- Intuitive grid editor — no spreadsheet import needed.
- Batch slots support split-class teaching without duplicate divisions.
- Demo: (1) select a class → (2) fill a few slots → (3) show classwise view → (4) show teacher view.

## 12. v1 status & v2 ideas
- v1: Complete for basic create/edit/delete. No conflict detection.
- v2: Teacher conflict detection; auto-timetable generation; term-based timetable isolation; copy timetable across classes.

## Source files
- `C:\rajesh\lms_k12\app\front_desk\create-timetable\page.tsx`
- `C:\rajesh\lms_k12\app\front_desk\create-timetable\api.ts`
- `F:\xampp\htdocs\next_lms_erp\app\Http\Controllers\school_setup\timetableController.php`
- `F:\xampp\htdocs\next_lms_erp\app\Models\school_setup\timetableModel.php`

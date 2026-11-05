# Facultywise Timetable
**Product:** Scholar Core | **Module:** Timetable | **Frontend route:** `/front_desk/facultywisetimetable` | **v1 status:** Complete

| Field | Value |
|---|---|
| Backend routes | `POST school_setup/ajax_getFacultywiseTimetableApi` (param: `teacher_id`), teacher list from `school_setup/proxy_master/create` |
| Roles | Admin, Academic Coordinator, Teacher (own schedule) |
| Last updated | 2026-11-04 |
| Source commit | 8fe500dc (FE) / 86261072 (BE) |

## 1. Purpose & users
Shows the full weekly timetable for a selected teacher — all classes, periods and subjects they are assigned to. Used by admin to check teacher load and by teachers to see their own schedule.

## 2. Screens
**Faculty timetable viewer** — `/front_desk/facultywisetimetable`

Teacher dropdown (populated from `school_setup/proxy_master/create` → `teacher_data`). Select teacher → grid loads.

Grid: rows = Weekdays, columns = Periods. Each cell: Standard / Division / Subject / Batch.

Supports print.

![](./screenshots/facultywise-timetable.png)

## 3. Features & business rules
- Teacher list fetched from `proxy_master/create` endpoint (`teacher_data` key).
- Grid columns: Weekday, Period, Standard, Division, Subject, Batch.
- Same underlying timetable data as classwise view, filtered by `teacher_id`.

**Permissions:** Admin/coordinator can view any teacher. Teachers can view their own only (RBAC on this menu).

## 4. User flows

**Admin views teacher timetable:**
1. Select teacher from dropdown.
2. Grid loads with all assigned slots.
3. Print if needed.

## 5. Data model
Reads `timetable` joined with `period`, `standard`, `division`, `subject`, `batch`, filtered by `teacher_id`. See [create-timetable.md](create-timetable.md) §5.

## 6. APIs

| Method | Endpoint | Auth | Request | Response |
|---|---|---|---|---|
| POST | `school_setup/ajax_getFacultywiseTimetableApi` | JWT session | `teacher_id`, `sub_institute_id`, `syear` | `{ entries: [{ week_day, period, standard_name, division_name, subject_name, batch_name }] }` |
| POST | `school_setup/proxy_master/create` | JWT session | session params | `{ teacher_data: [ { id, name } ] }` |

## 7. UI components & design tokens
- Uses `ModuleWorkbench` / `reportModules.facultyTimetable` from `front_desk/_lib/reports.ts`.
- `supportsPrint: true` enables print button.
- Filter field: `teacher_id` select, `optionsEndpoint: 'school_setup/proxy_master/create'`, `optionsDataKey: 'teacher_data'`.

## 8. Reports & exports
Print only (browser print). No export in v1.

## 9. Test cases

| ID | Scenario | Steps | Expected result | Type |
|---|---|---|---|---|
| FT01 | Load teacher timetable | Select teacher; view | All their slots shown | Happy |
| FT02 | Teacher with no slots | Select teacher with empty timetable | Empty grid | Edge |
| FT03 | Print | View grid → print | Print renders correctly | Happy |

## 10. Known issues, limitations & FAQs
- No Excel export.
- **FAQ:** "Teacher not in dropdown" — teacher must have an active user account with a teacher profile in this institute.

## 11. Sales notes
- Admin can spot overloaded teachers at a glance.
- Demo: select teacher → show all their classes across the week.

## 12. v1 status & v2 ideas
- v1: Complete.
- v2: Lecture load summary (total periods per week); PDF export; workload balance report.

## Source files
- `C:\rajesh\lms_k12\app\front_desk\facultywisetimetable\page.tsx`
- `C:\rajesh\lms_k12\app\front_desk\_lib\reports.ts` (facultyTimetable entry)
- `F:\xampp\htdocs\next_lms_erp\app\Http\Controllers\school_setup\facultywisetimetableController.php`

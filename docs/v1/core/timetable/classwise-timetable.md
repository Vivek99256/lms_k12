# Classwise Timetable
**Product:** Scholar Core | **Module:** Timetable | **Frontend route:** `/front_desk/classwisetimetable` | **v1 status:** Complete

| Field | Value |
|---|---|
| Backend routes | `POST school_setup/ajax_getClasswiseTimetable` (params: `grade`, `standard`, `division`) |
| Roles | Admin, Academic Coordinator, Class Teacher, Teacher, Student, Parent |
| Last updated | 2026-11-04 |
| Source commit | 8fe500dc (FE) / 86261072 (BE) |

## 1. Purpose & users
Read-only view of the full weekly timetable for a selected class. Used by teachers and students to see their schedule. Students always see their own class automatically (the server resolves it from their enrolment). Supports print.

## 2. Screens
**Classwise timetable viewer** — `/front_desk/classwisetimetable`

For non-students: Section / Standard / Division picker → "Search" button → grid.
For students: grid loads automatically on page open (no picker needed).

Grid: columns = Periods, rows = Weekdays. Each cell: Subject name + Teacher name + Batch name (if applicable). Class label shown in header.

Supports browser print.

![](./screenshots/classwise-timetable.png)

## 3. Features & business rules
- Student profile: class is auto-resolved from server-side enrolment — picker is hidden.
- Non-student: requires Section + Standard + Division to search.
- `isStudentProfile()` check from `lib/ai/adapters/shared-utils` controls picker visibility.
- Grid uses same `TimetableEntry` type as the editor (weekDay, periodId, subjectName, teacherName, batchName).

**Permissions:** Read-only for all roles; role filtering via `tblgroupwise_rights`.

## 4. User flows

**Teacher/Admin views class timetable:**
1. Select Section / Standard / Division.
2. Click "Search" → grid loads.
3. Optionally print.

**Student views own timetable:**
1. Navigate to page → grid loads automatically for their enrolled class.

## 5. Data model
Reads from `timetable` table joined with `period`, `subject`, `tbluser`, `batch`. See [create-timetable.md](create-timetable.md) §5 for schema.

## 6. APIs

| Method | Endpoint | Auth | Request | Response |
|---|---|---|---|---|
| POST | `school_setup/ajax_getClasswiseTimetable` | JWT session | `grade`, `standard`, `division`, `sub_institute_id`, `syear` | `{ weekdays, periods, entries, className }` |

## 7. UI components & design tokens
- `ClasswiseTimetablePage` custom component (`classwisetimetable/page.tsx`).
- `SearchDropdown` from `components/search-dropdown/`.
- `PageHeader` from `components/result/PageHeader`.
- `CalendarClock`, `LoaderCircle`, `Search` icons.
- `Button` from `components/ui/`.

## 8. Reports & exports
- Print: browser print (`supportsPrint: true` in reports module definition).
- No Excel/PDF export in v1.

## 9. Test cases

| ID | Scenario | Steps | Expected result | Type |
|---|---|---|---|---|
| CW01 | Admin views class | Select Section/Std/Div; search | Grid shown | Happy |
| CW02 | Student auto-load | Student logs in; navigates to page | Their class timetable loads without picker | Happy |
| CW03 | Print | Click print | Browser print dialog opens; grid renders | Happy |
| CW04 | Class with no timetable | Select unmapped class | Empty grid or message | Edge |

## 10. Known issues, limitations & FAQs
- Student auto-load passes dummy ids (1, 1, 1) to the API — the server ignores them and resolves from session enrolment. This is intentional but could cause confusion during debugging.
- No export to PDF or Excel — print only.

## 11. Sales notes
- Students and parents can check schedules directly in the app.
- Demo: log in as student → show timetable auto-loading → print it.

## 12. v1 status & v2 ideas
- v1: Complete.
- v2: PDF/Excel export; calendar view; push to mobile app.

## Source files
- `C:\rajesh\lms_k12\app\front_desk\classwisetimetable\page.tsx`
- `C:\rajesh\lms_k12\app\front_desk\classwisetimetable\api.ts`
- `C:\rajesh\lms_k12\app\front_desk\_lib\reports.ts` (classwiseTimetable entry)
- `F:\xampp\htdocs\next_lms_erp\app\Http\Controllers\school_setup\classwisetimetableController.php`

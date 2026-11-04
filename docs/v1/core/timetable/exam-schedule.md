# Exam Schedule
**Product:** Scholar Core | **Module:** Timetable | **Frontend route:** `/front_desk/exam_schedule` | **v1 status:** Complete

| Field | Value |
|---|---|
| Backend routes | `GET front_desk/exam_schedule`, `POST front_desk/exam_schedule` (store), `POST front_desk/exam_schedule/{id}/delete` |
| Roles | Admin, Academic Coordinator |
| Last updated | 2026-11-04 |
| Source commit | 8fe500dc (FE) / 86261072 (BE) |

## 1. Purpose & users
Publishes exam schedule documents (PDF or image) to selected classes. Students and parents see the schedule in their app/portal. Each entry is targeted at a Section + Standard + Division combination (or multiple at once).

## 2. Screens
**Exam schedule list** — `/front_desk/exam_schedule`
Table: Academic year, Title, Date, Standard, Division, File (linked). Actions: add, delete.

**Add form:**
Fields: Date (required), Title (required), Schedule file (file upload — image or PDF, required). Class picker: Section + Standard + Division, multiple allowed.

![](./screenshots/exam-schedule.png)

## 3. Features & business rules

| Field | Type | Required | Validation | Notes |
|---|---|---|---|---|
| Date | Date | Yes | — | Exam date |
| Title | Text | Yes | — | e.g. "Half-yearly exam schedule" |
| Schedule file | File | Yes | image/* or application/pdf | Stored under `storage/exam_schedule/` folder |
| Section | Select | Yes | | Cascades to Standard |
| Standard | Select | Yes | | Cascades to Division |
| Division | Select | Yes | | Multiple allowed (`multipleClassFields: true`) |

- Files are stored server-side under a `fileFolder: 'exam_schedule'` Laravel storage disk path.
- File column in list is a clickable link when file is present.
- Multiple class combinations can be targeted in one submission.

**Permissions:** Admin, academic coordinator. Students/parents have read access via mobile/portal.

## 4. User flows

**Publish exam schedule:**
1. Navigate to Front Desk → Exam schedule.
2. Click "Add".
3. Select class(es), date, title, upload PDF/image.
4. Click "Publish schedule" → record created; file stored; visible to target classes.

**Delete schedule:**
1. Click delete icon → record and file reference removed.

## 5. Data model
Table: TBD (exam_schedule — not explicitly read; likely `tblexam_schedule` or similar based on front_desk pattern). Columns expected: `id`, `title`, `date_`, `std_name`, `div_name`, `syear`, `file_name`, `sub_institute_id`.

## 6. APIs

| Method | Endpoint | Auth | Request | Response |
|---|---|---|---|---|
| GET | `front_desk/exam_schedule` | Session | `sub_institute_id`, `syear` | `{ data: [ schedule rows ] }` |
| POST | `front_desk/exam_schedule` | Session | form-data: date_, title, attechment[], class fields | `{ status_code, message }` |
| POST | `front_desk/exam_schedule/{id}/delete` | Session | — | `{ status_code, message }` |

Note: field name `attechment` (typo in source — matches backend expectation).

## 7. UI components & design tokens
`ModuleWorkbench` with `frontDeskModules.examSchedule` config from `front_desk/_lib/modules.ts`. File field accepts `image/*,application/pdf`. Submit label: "Publish schedule".

## 8. Reports & exports
No separate report. Files are downloadable directly from the list.

## 9. Test cases

| ID | Scenario | Steps | Expected result | Type |
|---|---|---|---|---|
| ES01 | Publish schedule | Fill form with PDF; submit | Record in list; file link active | Happy |
| ES02 | Missing file | Submit without file | Validation error (required) | Negative |
| ES03 | Multiple classes | Select 3 divisions | Three records created | Happy |
| ES04 | Delete | Delete an entry | Record removed | Happy |

## 10. Known issues, limitations & FAQs
- Field name `attechment` (typo in `modules.ts`) must match the backend expectation exactly — do not "fix" the spelling without updating the backend.
- No edit action — only add and delete.

## 11. Sales notes
- Paperless exam schedule distribution to all classes with one upload.
- Demo: upload schedule PDF → show it appearing in student mobile app.

## 12. v1 status & v2 ideas
- v1: Complete (add + delete only).
- v2: Edit existing entry; push notification on publish; link to online exam configuration.

## Source files
- `C:\rajesh\lms_k12\app\front_desk\exam_schedule\page.tsx`
- `C:\rajesh\lms_k12\app\front_desk\_lib\modules.ts` (examSchedule entry)

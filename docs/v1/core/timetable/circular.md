# Circular
**Product:** Scholar Core | **Module:** Timetable / Front Desk | **Frontend route:** `/front_desk/circular` | **v1 status:** Complete

| Field | Value |
|---|---|
| Backend routes | `GET front_desk/circular`, `POST front_desk/circular` (store), `POST front_desk/circular/{id}/delete`, `GET circular/circular-types` |
| Roles | Admin, Academic Coordinator, Principal |
| Last updated | 2026-11-04 |
| Source commit | 8fe500dc (FE) / 86261072 (BE) |

## 1. Purpose & users
Publish official school circulars to selected classes or all standards. Circulars can carry a file attachment (image or PDF). Parents and students see published circulars in their portal/app. Includes a report view.

## 2. Screens
**Circular list** — `/front_desk/circular`
Table: Type, Title, Message, Date, Standard, Division, File. Actions: add, delete.

**Add form:**
Date (required), Title (required), Circular type (select, from `circular/circular-types` endpoint, required), Message (textarea), Attachment (file — image/PDF, optional), "Send to all standards" (checkbox).

**Circular report** — `/front_desk/circular/report`
Filtered report with date range and class picker. Supports print.

Also has an AI Stack sub-page at `/front_desk/circular/ai-stack`.

![](./screenshots/circular.png)

## 3. Features & business rules

| Field | Type | Required | Notes |
|---|---|---|---|
| Date | Date | Yes | Circular date |
| Title | Text | Yes | |
| Circular type | Select | Yes | Loaded from `circular/circular-types` |
| Message | Textarea | No | |
| Attachment | File | No | image/* or application/pdf; stored under `storage/circular/` |
| Send to all standards | Checkbox | No | Overrides class selection when checked |
| Section / Standard / Division | Select (class picker) | Yes (unless "all") | Multiple allowed |

- Circular types are master-data managed separately.
- `fileFolder: 'circular'` — file stored in Laravel storage, served as link in list.
- `allstd` checkbox: when checked, the circular is sent to all standards ignoring the class picker.
- Multiple class combinations can be targeted in one submission.

**Permissions:** Publish restricted to admin/coordinator. Read access for all roles.

## 4. User flows

**Publish circular:**
1. Front Desk → Circular → Add.
2. Enter date, title, select type, write message, optionally attach file.
3. Select target classes OR check "Send to all standards".
4. Click "Publish circular" → entry created; visible in portal.

**Delete circular:**
1. Delete icon → record removed.

**View circular report:**
1. Front Desk → Circular → Report sub-route.
2. Enter date range, optional class filter → list loads; print if needed.

## 5. Data model

**Tables:** `circular` (main), `circular_type` (types master)

| Column (circular) | Type | Notes |
|---|---|---|
| id | bigint PK | |
| title | varchar | |
| type | int FK → circular_type.id | |
| message | text | |
| date_ | date | |
| file_name | varchar nullable | |
| std_name / div_name | varchar | Denormalized class name |
| sub_institute_id | int | Tenant |
| syear | varchar | |
| allstd | tinyint | 1 = all standards |

## 6. APIs

| Method | Endpoint | Auth | Request | Response |
|---|---|---|---|---|
| GET | `front_desk/circular` | Session | session params | `{ data: [ circular rows ] }` |
| POST | `front_desk/circular` | Session | form-data: date_, title, type, message, attachment[], class fields, allstd | `{ status_code, message }` |
| POST | `front_desk/circular/{id}/delete` | Session | — | `{ status_code, message }` |
| GET | `circular/circular-types` | Session | — | `{ data: [ { id, name } ] }` |

Report endpoint: `GET front_desk/circular/report` with `from_date`, `to_date`, class params.

## 7. UI components & design tokens
`ModuleWorkbench` with `frontDeskModules.circular` config. File upload accepts `image/*,application/pdf`. Submit label "Publish circular". File column in list links to stored file.

## 8. Reports & exports
- Circular report: `/front_desk/circular/report` — filterable by date range and class; supports print.
- No Excel/PDF export in v1 (print only).

## 9. Test cases

| ID | Scenario | Steps | Expected result | Type |
|---|---|---|---|---|
| CIR01 | Publish with attachment | Fill form with PDF; select class; submit | Circular in list; file link active | Happy |
| CIR02 | Send to all standards | Check "Send to all" | Circular visible to all classes | Happy |
| CIR03 | No type selected | Submit without circular type | Validation error | Negative |
| CIR04 | Delete | Delete circular | Removed from list | Happy |
| CIR05 | Circular report | Filter by date range | Matching circulars shown | Happy |

## 10. Known issues, limitations & FAQs
- No edit after publish — delete and re-publish.
- Circular types must be pre-configured; there is no inline type creation on this screen.
- **FAQ:** "Circular not visible to parents" — check that the class combination was correctly targeted.

## 11. Sales notes
- Digital circular replaces paper; parents receive push notification.
- Demo: publish circular → show it in parent portal on mobile.
- All circulars are archived and searchable via the report.

## 12. v1 status & v2 ideas
- v1: Complete (publish + delete + report).
- v2: Edit/retract a published circular; scheduled publish date; read receipts.

## Source files
- `C:\rajesh\lms_k12\app\front_desk\circular\page.tsx`
- `C:\rajesh\lms_k12\app\front_desk\circular\report\page.tsx`
- `C:\rajesh\lms_k12\app\front_desk\_lib\modules.ts` (circular entry)
- `C:\rajesh\lms_k12\app\front_desk\_lib\reports.ts` (circularReport entry)
- `F:\xampp\htdocs\next_lms_erp\routes\api.php` lines 902–917

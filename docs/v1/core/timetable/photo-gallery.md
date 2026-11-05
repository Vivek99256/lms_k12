# Photo and Video Gallery
**Product:** Scholar Core | **Module:** Timetable / Front Desk | **Frontend route:** `/front_desk/photo_video_gallary` | **v1 status:** Complete

| Field | Value |
|---|---|
| Backend routes | `GET /api/front-desk/photo-video-gallery`, `POST /api/front-desk/photo-video-gallery`, `POST /api/front-desk/photo-video-gallery/{id}/delete`, `POST /api/front-desk/photo-video-gallery/{id}` (update) |
| Roles | Admin, Academic Coordinator |
| Last updated | 2026-11-04 |
| Source commit | 8fe500dc (FE) / 86261072 (BE) |

## 1. Purpose & users
Publish photo albums or YouTube video links to selected classes. Students and parents can view the gallery in the mobile app. Used for events, field trips, sports days, etc.

## 2. Screens
**Gallery list** — `/front_desk/photo_video_gallary`
Table: Album, Title, Type (Photo/Video), Date, Standard, Division, Status. Actions: add, update, delete.

**Add/update form:**
Date (required), Title (required), Album title (required), Type (Photo/Video — required), Photos (file upload, multiple, image only — shown when Type=Photo), YouTube link (text — shown when Type=Video). Class picker: Section + Standard + Division, multiple allowed.

![](./screenshots/photo-video-gallery.png)

## 3. Features & business rules

| Field | Type | Required | Validation | Notes |
|---|---|---|---|---|
| Date | Date | Yes | | |
| Title | Text | Yes | | |
| Album title | Text | Yes | | Groups photos |
| Type | Select | Yes | Photo or Video | Conditional fields |
| Photos | File (multiple) | Yes if Photo | `image/*` | Multiple images allowed |
| YouTube link | Text | Yes if Video | | Defaults to empty string (`defaultFormValues`) |
| Section/Standard/Division | Class picker | Yes | Multiple allowed | `multipleClassFields: true` |

- Photo uploads: multiple files, stored server-side.
- Video: YouTube link only (no direct video upload).
- `ai` column in list shows "Status" — purpose TBD from code.
- `defaultFormValues: { youtube_link: '' }` ensures the field is always sent even when hidden.
- API is a dedicated REST controller (`PhotoVideoGallaryApiController`) separate from the generic `FrontDeskApiController`.

**Permissions:** Publish restricted to admin/coordinator. Read for students/parents.

## 4. User flows

**Publish photos:**
1. Front Desk → Photo and video gallery → Add.
2. Select Date, Title, Album title, Type = Photo.
3. Upload images; select target classes.
4. Click "Publish media" → photos stored; visible in app.

**Publish video:**
1. Same flow; Type = Video; paste YouTube link.

**Update entry:**
1. Click update icon → form pre-fills → change fields → save.

## 5. Data model
Table: TBD (front-desk photo-video gallery — not explicitly read; expected columns: `id`, `album_title`, `title`, `type`, `date_`, `std_name`, `div_name`, `ai`, `sub_institute_id`, `syear`, file reference).

## 6. APIs

| Method | Endpoint | Auth | Request | Response |
|---|---|---|---|---|
| GET | `/api/front-desk/photo-video-gallery` | JWT session | `sub_institute_id`, `syear`, class params | `{ data: [ gallery rows ] }` |
| POST | `/api/front-desk/photo-video-gallery` | JWT session | form-data: date_, title, album_title, type, attachment[], youtube_link, class fields | `{ success, … }` |
| POST | `/api/front-desk/photo-video-gallery/{id}` | JWT session | Same fields | `{ success, … }` |
| POST | `/api/front-desk/photo-video-gallery/{id}/delete` | JWT session | — | `{ success, … }` |

API routes: `F:\xampp\htdocs\next_lms_erp\routes\api.php` lines 909–912.

## 7. UI components & design tokens
`ModuleWorkbench` with `frontDeskModules.gallery` config. File field: `multiple: true`, `accept: 'image/*'`. YouTube link field conditionally visible via `visibleWhen: { field: 'type', value: 'Video' }`.

## 8. Reports & exports
No report or export. Gallery is view-only via portal/app.

## 9. Test cases

| ID | Scenario | Steps | Expected result | Type |
|---|---|---|---|---|
| PG01 | Publish photo album | Type=Photo; upload 3 images; select class | Album created; photos visible | Happy |
| PG02 | Publish video | Type=Video; paste YouTube URL | Video link published | Happy |
| PG03 | Photo shown when Type=Photo | Select Photo type | Photo upload field appears | Happy |
| PG04 | YouTube shown when Type=Video | Select Video type | YouTube field appears; photo hidden | Happy |
| PG05 | Update | Change title of existing entry | Updated in list | Happy |
| PG06 | Delete | Delete entry | Removed | Happy |

## 10. Known issues, limitations & FAQs
- `ai` column meaning is unclear from code — purpose TBD.
- No video hosting — YouTube only.
- No reordering of photos within an album.

## 11. Sales notes
- Paperless event gallery — parents see photos/videos the same day.
- Demo: upload 5 event photos → show them appearing in parent mobile app gallery.

## 12. v1 status & v2 ideas
- v1: Complete (CRUD + photo/video).
- v2: Album reordering; direct video upload; thumbnail generation; parent share/download controls.

## Source files
- `C:\rajesh\lms_k12\app\front_desk\photo_video_gallary\page.tsx`
- `C:\rajesh\lms_k12\app\front_desk\_lib\modules.ts` (gallery entry)
- `F:\xampp\htdocs\next_lms_erp\routes\api.php` lines 909–912
- `F:\xampp\htdocs\next_lms_erp\app\Http\Controllers\api\PhotoVideoGallaryApiController.php`

# Face / Capture Attendance
**Product:** Scholar Core | **Module:** Attendance | **Frontend route:** `/face_attendance/class_face_attendance` | **v1 status:** Complete

| Field | Value |
|---|---|
| Backend routes | `GET /api/face-attendance/class-options`, `POST /api/face-attendance/capture`, `POST /api/face-attendance/save` |
| Middleware | `api.session`, `staff.only` |
| Roles | Staff (class teachers, admin) |
| Last updated | 2026-11-04 |
| Source commit | 8fe500dc (FE) / 86261072 (BE) |

## 1. Purpose & users

Allows staff to capture student attendance using facial recognition. The teacher selects a class, captures 3–5 photos of the classroom, and the system identifies which students are present. The result is saved as standard P/A attendance records. Used in schools where manual roll-call is replaced by camera-based capture.

## 2. Screens

**Class Face Attendance** — `/face_attendance/class_face_attendance`

| Element | Description |
|---|---|
| Standard dropdown | Grade/standard selector; loads from `class-options` |
| Division dropdown | Cascades from standard |
| Date picker | Attendance date; Sundays blocked |
| Photo capture slots | 3–5 photo upload slots (MIN_IMAGES=3, MAX_IMAGES=5) |
| Upload button per slot | Each slot accepts an image file; previewed as object URL |
| Capture / Recognize button | Sends photos to backend for AI face recognition |
| Attendance result table | Student rows with recognized P/A status |
| Save Attendance button | Persists the recognized attendance to `attendance_student` |

![](./screenshots/face-attendance.png)

## 3. Features & business rules

| Field | Type | Required | Validation | Default |
|---|---|---|---|---|
| Standard | Select | Yes | From class-options for logged-in staff | — |
| Division | Select | Yes | Cascades from standard | — |
| Date | Date | Yes | Cannot be Sunday; within academic year | Today |
| Photos | File (image) | Yes | Minimum 3, maximum 5 | — |

**Image capture rules:**
- `MIN_IMAGES = 3` — at least 3 photos required before recognition can run.
- `MAX_IMAGES = 5` — no more than 5 photos accepted per session.
- Each photo is stored as a local object URL (`URL.createObjectURL`) for preview; not uploaded until recognition is triggered.
- Supported formats: image files (MIME type validation on the backend).

**Attendance rules:**
- After recognition, each identified student receives `attendance_code = P`.
- Students not recognized receive `attendance_code = A`.
- Staff can manually override any P/A before saving.
- Sunday dates are blocked client-side.

**Route isolation:**
- These routes are **not** proxied through `/api/proxy`. They call `/api/face-attendance/*` directly.
- Middleware `staff.only` ensures only logged-in staff can access the backend endpoints.

## 4. User flows

**Happy path:**
1. Staff opens Class Face Attendance.
2. Selects standard → division.
3. Selects today's date.
4. Uploads 3–5 classroom photos using the photo slots.
5. Clicks Capture / Recognize.
6. Backend returns student recognition results.
7. Table shows each student as P (recognized) or A (not recognized).
8. Staff reviews, overrides any errors.
9. Clicks Save Attendance.
10. Records written to `attendance_student`.

**Error — fewer than 3 photos:**
1. Staff uploads only 2 photos and clicks Recognize.
2. Client shows: "Please upload at least 3 photos."
3. No API call made.

**Error — Sunday selected:**
1. Staff picks a Sunday.
2. Client blocks the date selection.

## 5. Data model

Writes to `attendance_student` (same schema as mark-attendance):

| Column | Value |
|---|---|
| `attendance_code` | `P` or `A` |
| `teacher_id` | Logged-in staff user id |
| `attendance_date` | Selected date |
| `standard_id`, `section_id` | From selected class |
| `sub_institute_id` | From session |

Face recognition model and face encodings storage: TBD (backend AI pipeline not fully traced in this reading).

## 6. APIs

**Direct routes** (not proxied — middleware: `api.session`, `staff.only`):

| Method | Endpoint | Purpose | Key request params | Key response fields |
|---|---|---|---|---|
| GET | `/api/face-attendance/class-options` | Load standard/division options for the logged-in staff | session headers | `classes[]` (standard_id, division_id, standard_name, division_name) |
| POST | `/api/face-attendance/capture` | Submit photos for face recognition | `photos[]` (multipart), `standard_id`, `division_id`, `date`, session params | `students[]` (student_id, name, attendance_code P/A), `message` |
| POST | `/api/face-attendance/save` | Save recognized attendance | `attendance[]` (student_id → P/A), `standard_id`, `division_id`, `date`, session params | `status_code`, `message` |

## 7. UI components & design tokens

- `PageFrame`, `PageHeader`, `SectionPanel`, `Field`, `NativeSelect`, `InlineMessage` — fees-shared
- `Button`, `Input`, `Table` — shadcn
- Photo slots: custom `<input type="file" accept="image/*">` with `URL.createObjectURL` preview
- Icons: `Camera`, `Upload`, `Loader2`, `UserCheck`, `UserX` — Lucide

## 8. Reports & exports

No inline report or export on this screen. Saved records appear in:
- [Daywise Attendance Report](./daywise-report.md)
- [Monthwise Attendance Report](./monthwise-report.md)
- [Yearly Attendance Report](./yearly-report.md)

## 9. Test cases

| ID | Scenario | Steps | Expected result | Type |
|---|---|---|---|---|
| FA-01 | Happy path | Select class, date, upload 4 photos, recognize, save | Attendance saved; students appear in mark-attendance | Happy |
| FA-02 | Fewer than 3 photos | Upload 2 photos, click Recognize | "Please upload at least 3 photos" error; no API call | Negative |
| FA-03 | Sunday blocked | Select a Sunday | Date picker blocks; no form submission | Edge |
| FA-04 | Manual override | Recognize → flip one student from P to A → save | Override persisted in DB | Happy |
| FA-05 | Unauthorized role | Student user tries `/api/face-attendance/capture` | 403 from `staff.only` middleware | Security |
| FA-06 | Invalid image type | Upload a PDF as a photo | Backend rejects; error message shown | Negative |

## 10. Known issues, limitations & FAQs

- Face encoding model details (which AI model, encoding storage table) are not fully traced in the source read — marked TBD.
- `MIN_IMAGES=3` / `MAX_IMAGES=5` are hard-coded constants in the frontend page component; they are not configurable via admin settings.
- Object URLs created by `URL.createObjectURL` are revoked on component unmount; if the page is left open long enough, previews may break in some browsers.
- **FAQ:** "A student was not recognized — what do I do?" — Manually flip their radio to P before saving.
- **FAQ:** "Can I re-run recognition after uploading more photos?" — Yes, re-upload and click Recognize again; the table updates.

## 11. Sales notes

**Selling points:**
- No manual roll-call — camera captures the whole class at once.
- 3-to-5 angle photos reduce missed recognitions.
- Same P/A data as manual attendance — reports and exports unchanged.
- Staff-only access, JWT-validated.

**Demo flow:**
1. Select a class and today's date.
2. Upload 3 sample classroom photos.
3. Click Recognize — show the table auto-populating with P/A.
4. Save — open Daywise Report to show the records are there.

**Plan/pricing:** TBD

## 12. v1 status & v2 ideas

**Complete:** Photo upload slots (3–5), face recognition call, attendance result table, manual override, save.

**Partial:** Face encoding model details TBD; image MIME validation details not fully traced.

**v2 ideas:**
- Configurable MIN/MAX photos via admin settings.
- Confidence score shown per recognized student.
- Auto-alert to parents for absent students after face-attendance save.
- Support video frame capture instead of static photos.

## Source files

- Frontend: `C:\rajesh\lms_k12\app\face_attendance\class_face_attendance\page.tsx`
- Backend routes: `F:\xampp\htdocs\next_lms_erp\routes\api.php` (prefix `face-attendance`)
- Backend controller: `F:\xampp\htdocs\next_lms_erp\app\Http\Controllers\FaceAttendanceApiController.php`

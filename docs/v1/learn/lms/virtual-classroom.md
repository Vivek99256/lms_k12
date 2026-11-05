# Virtual Classroom
**Product:** Scholar Learn | **Module:** LMS | **Frontend route:** `/lms/virtual-classroom` | **v1 status:** Complete

| Field | Value |
|---|---|
| Backend routes | `GET /lms/virtual-classroom` (TBD — via `lmsVirtualClassroomController`), `POST /lms/virtual-classroom` (create session) |
| Roles | Teacher (create/manage sessions), Student (join), Admin |
| Last updated | 2026-11-04 |
| Source commit | 8fe500dc (FE) / 86261072 (BE) |

## 1. Purpose & users
Teachers schedule virtual classroom sessions (e.g. Google Meet) with a room name, subject, chapter, topic, date/time, meeting URL, and passcode. Students see the upcoming sessions and join via the external meeting link. Supports recurring sessions (None/Daily/Weekly).

## 2. Screens

### Virtual Classroom list — `/lms/virtual-classroom`
Shows: list of scheduled sessions with subject, chapter, topic, date/time, meeting URL, passcode, status (upcoming/live/ended).
Main actions: schedule new session, copy join link, delete session.
![](./screenshots/virtual-classroom.png)

### Schedule Session modal
Shows: room name, subject, chapter, topic, description, date, from/to time, meeting URL, passcode, recurring setting.
Main actions: save session.

## 3. Features & business rules

| Field | Type | Required | Validation | Default |
|---|---|---|---|---|
| Session title / room name | Text | Yes | Non-empty | — |
| Subject | Text | No | — | `Physics` (default in code) |
| Chapter | Text | No | — | — |
| Topic | Text | No | — | — |
| Description | Textarea | No | — | — |
| Event date | Date | Yes | — | Today |
| From time | Time | Yes | — | `10:00 AM` |
| To time | Time | Yes | — | `11:00 AM` |
| Meeting URL | URL | Yes | — | `https://meet.google.com/live-room-join` (default in code — should be changed per school) |
| Passcode | Text | No | — | `CLASS2026` (default in code) |
| Recurring | Select | No | None / Daily / Weekly | `None` |

Note: meeting URL and passcode defaults in the code are placeholder values — schools must configure their own.

Role-based: students see session list (read-only join links); teachers see create/delete.

## 4. User flows

**Teacher schedules:**
1. Open `/lms/virtual-classroom`.
2. Click "+ Schedule session".
3. Fill modal — room name, subject, date/time, meeting URL.
4. Save → `POST` to virtual classroom API.
5. Session appears in list.

**Student joins:**
1. Open virtual classroom list.
2. Find upcoming session, click meeting URL → opens external meeting in new tab.

## 5. Data model

| Table | Key columns | Notes |
|---|---|---|
| (TBD — from `lmsVirtualClassroomController`) | `id`, `sub_institute_id`, `teacher_id`, `room_name`, `subject_name`, `chapter_name`, `topic_name`, `description`, `event_date`, `from_time`, `to_time`, `meeting_url`, `passcode`, `recurring`, `created_at` | TBD — exact table name from migration |

From `C:\rajesh\lms_k12\app\lms\data\virtualClassroom.ts`:
- `VirtualClassroomSession` type: `{ id, roomName, subjectName, chapterName, topicName, description, eventDate, fromTime, toTime, meetingUrl, passcode, recurring, createdAt }`
- `NewVirtualSession` type: same without `id`/`createdAt`

## 6. APIs

| Method | Endpoint | Auth | Notes |
|---|---|---|---|
| GET | (TBD) | JWT | List sessions — via `fetchVirtualSessions()` |
| POST | (TBD) | JWT | Create session — via `createVirtualSession()` |

Exact endpoints not visible from the page component; they are defined in `virtualClassroom.ts` data module.

## 7. UI components & design tokens
- `ScheduleVirtualModal` — inline modal component
- Lucide icons: `Calendar`, `Clock`, `ExternalLink`, `Key`, `Plus`, `RefreshCw`, `Search`, `User`, `Video`, `VideoOff`, `Volume2`, `X`
- `Skeleton` pulse component for loading state
- `isStudentProfile()` from `lib/ai/adapters/shared-utils` — controls create vs. read-only view

## 8. Reports & exports
No dedicated export. Session history viewable from list.

## 9. Test cases

| ID | Scenario | Steps | Expected result | Type |
|---|---|---|---|---|
| VC-01 | Teacher schedules | Fill modal, save | Session in list with correct time | Happy |
| VC-02 | Student views list | Log in as student | List shown, no create button | Happy |
| VC-03 | Join meeting | Click meeting URL | External meeting opens in new tab | Happy |
| VC-04 | Missing room name | Save without room name | Error "Please enter a session title" | Negative |
| VC-05 | Recurring daily | Set recurring = Daily | Multiple sessions appear | Edge |

## 10. Known issues, limitations & FAQs
- Default meeting URL (`meet.google.com/live-room-join`) and passcode (`CLASS2026`) are hard-coded placeholders — must be overwritten per session. No school-level default configuration exists in v1.
- No in-platform video — the system links to any external meeting URL (Google Meet, Zoom, Teams).

## 11. Sales notes
- **Selling point**: schedule and share live class links from within the LMS — no separate communication channel needed.
- **Demo flow**: (1) Teacher schedules Google Meet session for Physics, Grade 10; (2) session appears in student's view with join link; (3) student clicks to join.
- Plan/pricing: TBD.

## 12. v1 status & v2 ideas
- v1: Complete. Schedule, list, join link all functional.
- v2: Integrate with Google Meet / Zoom APIs to auto-create meeting rooms; attendance recording from virtual class; recording link storage.

## Source files
- `C:\rajesh\lms_k12\app\lms\virtual-classroom\page.tsx`
- `C:\rajesh\lms_k12\app\lms\data\virtualClassroom.ts`
- `F:\xampp\htdocs\next_lms_erp\app\Http\Controllers\lms\lmsVirtualClassroomController.php`

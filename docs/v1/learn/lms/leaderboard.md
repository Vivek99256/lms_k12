# Leaderboard
**Product:** Scholar Learn | **Module:** LMS | **Frontend route:** `/lms/leader-board` (view) · `/lms/leader-board-master` (config) | **v1 status:** Complete

| Field | Value |
|---|---|
| Backend routes | `GET /lms/leaderboard`, `GET /lms/leaderboard/filters`, `GET /lms/leaderboard/rankings`, `GET /lms/leaderboard/{userId}`, `GET /lms/leaderboard-master` (CRUD), `GET /lms/student-engagement` |
| Roles | Student (view), Teacher (view + configure master), Admin |
| Last updated | 2026-11-04 |
| Source commit | 8fe500dc (FE) / 86261072 (BE) |

## 1. Purpose & users
The Leaderboard shows students ranked by their engagement score (concepts practised, homework submitted, etc.). Students see their own rank and peers. Teachers can configure leaderboard parameters via the Leaderboard Master screen. Designed to motivate academic engagement through gamification.

## 2. Screens

### Leaderboard — `/lms/leader-board`
Shows: paginated rankings list (20 per page), student avatar + name + score, top-3 podium (Crown/Trophy/Medal icons), class filter, previous/next pagination.
Main actions: filter by class, paginate, view own rank.
![](./screenshots/leaderboard.png)

### Leaderboard Master — `/lms/leader-board-master`
Shows: CRUD interface for leaderboard configuration (scoring weights per activity type).
Main actions: create, edit, delete leaderboard configurations.

## 3. Features & business rules

Rankings source: `lms_student_engagement` table — engagement events (concepts practised, homework submitted) are aggregated per user. Leaderboard master defines scoring weights.

| Field | Type | Notes |
|---|---|---|
| Rankings per page | Constant | 20 (`PER_PAGE = 20`) |
| Filters | Class/division | Via `GET /lms/leaderboard/filters` |
| Rank display | Position + avatar + name + score | Crown (1st), Trophy (2nd), Medal (3rd) |

`isStudentSession()` check: student sees their own highlighted row; teacher sees all.

Leaderboard master CRUD:
- `GET /lms/leaderboard-master` — list configurations
- `POST /lms/leaderboard-master` — create
- `GET /lms/leaderboard-master/{id}` — detail
- `PUT /lms/leaderboard-master/{id}` — update
- `DELETE /lms/leaderboard-master/{id}` — delete

## 4. User flows

**Student views leaderboard:**
1. Open `/lms/leader-board`.
2. Filter dropdown → `GET /lms/leaderboard/filters`.
3. Rankings load → `GET /lms/leaderboard/rankings` (paginated, 20/page).
4. Student's own row is highlighted.
5. Click next/previous page for more.

## 5. Data model

| Table | Key columns | Notes |
|---|---|---|
| `lms_student_engagement` | `user_id`, `engagement_type`, `subject_id`, `chapter_id`, `score`, `created_at` | Source of rankings |
| `leaderboard_master` | `id`, `name`, `scoring_weights`, `active`, `created_at` | Configuration rows |

`LbRanking` type: `{ userId, name, avatarUrl, score, rank }`
`LbFilterOptions` type: class/division options for filter dropdown.

## 6. APIs

| Method | Endpoint | Auth | Middleware | Notes |
|---|---|---|---|---|
| GET | `/lms/leaderboard` | JWT | `api.session` | Main leaderboard data |
| GET | `/lms/leaderboard/filters` | JWT | `api.session` | Filter options |
| GET | `/lms/leaderboard/rankings` | JWT | `api.session` | Paginated rankings |
| GET | `/lms/leaderboard/{userId}` | JWT | `api.session` | Single user detail |
| GET/POST/PUT/DELETE | `/lms/leaderboard-master` | JWT | `api.session` + staff | Master CRUD |
| GET | `/lms/student-engagement` | JWT | `api.session` | Engagement events |

## 7. UI components & design tokens
- `Avatar` component — initials fallback when no image
- `Crown`, `Trophy`, `Medal` Lucide icons for top-3
- `Sparkles` icon for score display
- Pagination: `ChevronLeft`, `ChevronRight`
- `AlertTriangle` for error state
- `RefreshCw` for reload
- `isStudentSession()` from `app/pal/data/pal-lookups`

## 8. Reports & exports
No direct export from leaderboard. Engagement data accessible via `GET /lms/student-engagement`.

## 9. Test cases

| ID | Scenario | Steps | Expected result | Type |
|---|---|---|---|---|
| LB-01 | Rankings load | Open leaderboard | 20 students ranked, top-3 podium shown | Happy |
| LB-02 | Student highlight | Log in as student, open leaderboard | Own row highlighted | Happy |
| LB-03 | Pagination | Click next page | Next 20 students shown | Happy |
| LB-04 | Filter by class | Select class filter | Rankings update to that class | Happy |
| LB-05 | No engagements | Student with zero score | Appears at bottom with 0 score | Edge |

## 10. Known issues, limitations & FAQs
- Leaderboard is class-scoped — no school-wide leaderboard in v1.
- Score calculation happens in backend; if `lms_student_engagement` is not being written (e.g. PAL not active), all scores will be 0.

## 11. Sales notes
- **Selling point**: motivates students through visible rankings — gamification without games.
- **Demo flow**: (1) Show leaderboard with live scores; (2) highlight top-3 podium; (3) show student seeing their own rank; (4) teacher configures scoring weights in master.
- Plan/pricing: TBD.

## 12. v1 status & v2 ideas
- v1: Complete. View, filter, paginate, master config all functional.
- v2: Badges/achievements display on leaderboard; parent-visible rank card; opt-out for students who prefer not to be ranked.

## Source files
- `C:\rajesh\lms_k12\app\lms\leader-board\page.tsx`
- `C:\rajesh\lms_k12\app\lms\data\leaderBoard.ts`
- `F:\xampp\htdocs\next_lms_erp\app\Http\Controllers\api\lms\LmsLeaderboardApiController.php`
- `F:\xampp\htdocs\next_lms_erp\app\Http\Controllers\api\lms\LmsLeaderboardMasterApiController.php`
- `F:\xampp\htdocs\next_lms_erp\app\Http\Controllers\api\lms\StudentEngagementApiController.php`

# House
**Product:** Scholar Core | **Module:** Student | **Frontend route:** `/students/house` | **v1 status:** Complete

| Field | Value |
|---|---|
| Backend routes | `GET /api/proxy?path=student-care/houses` (inferred from `getHouses` call) |
| Roles | Admin, Coordinator, Principal |
| Last updated | 2026-11-04 |
| Source commit | 8fe500dc (FE) / 86261072 (BE) |

## 1. Purpose & users
Displays all school houses with their member counts and a radar chart scoring each house across five dimensions: Sports, Academics, Cultural, Discipline, Attendance. Used by coordinators and principals to compare house performance and assign students to houses.

House master setup (create/edit house names) is on a separate screen: `/student/add_house`.

## 2. Screens

**Houses** (`/students/house`)
- Radar chart: all houses plotted on 5 axes (Sports, Academics, Cultural, Discipline, Attendance)
- House cards: each house shows name, member count
- "Master Setup" button linking to house configuration

![](./screenshots/house.png)

## 3. Features & business rules

### House data (`HouseData` type)
| Field | Type | Notes |
|---|---|---|
| name | string | House name (e.g. Red, Blue) |
| memberCount | number | Students assigned to this house |

### Radar chart scoring
Score per axis = `Math.min(100, house.memberCount × 4)`. This is a **proxy calculation** — not actual performance data. The scores reflect only member count scaled to 100, not real sports/academic outcomes.

### House assignment
Students are assigned to a house at the time of Add Student (via the `house` field on `tblstudent`) or via enrollment (`house_id` on `tblstudent_enrollment`).

## 4. User flows

**View house overview**
1. Navigate to Students → House.
2. `getHouses` fetches house list with member counts.
3. Radar chart and house cards render.

**Configure houses**
1. Click "Master Setup".
2. Navigates to `/student/add_house` to create or rename houses.

## 5. Data model
Houses are stored in a `house_master` table (migration: `create_house_master`). `tblstudent.house` stores the house name as a string; `tblstudent_enrollment.house_id` stores an integer FK.

| Column | Table | Notes |
|---|---|---|
| house | tblstudent | House name string |
| house_id | tblstudent_enrollment | FK to house_master |

Exact `house_master` schema: TBD.

## 6. APIs
| Method | Endpoint | Auth | Request | Response | Errors |
|---|---|---|---|---|---|
| GET | `student-care/houses` (inferred) | Session | Session params | `{ status:1, data: [HouseData[]] }` | — |

Exact endpoint path confirmed from `app/students/house/api.ts` → `getHouses`.

## 7. UI components & design tokens
- `HousesContent` component
- Chart.js `Radar` via `react-chartjs-2`
- Chart.js modules registered: `RadialLinearScale`, `PointElement`, `LineElement`, `Filler`, `Tooltip`, `Legend`
- Lucide icons: `Settings`, `Users`

## 8. Reports & exports
No dedicated export. House assignment visible on student list export.

## 9. Test cases
| ID | Scenario | Steps | Expected result | Type |
|---|---|---|---|---|
| S-HOUSE-01 | View houses | Navigate to /students/house | Radar chart and house cards render | Happy |
| S-HOUSE-02 | House with 25 members | memberCount=25 | Score = min(100, 25×4) = 100 | Edge |
| S-HOUSE-03 | No houses configured | Backend returns empty array | Empty state shown | Edge |
| S-HOUSE-04 | Master setup link | Click "Master Setup" | Navigates to /student/add_house | Happy |

## 10. Known issues, limitations & FAQs
- Radar chart scores are based solely on member count (`memberCount × 4`), not actual house performance data. This is misleading and should be replaced with real performance metrics.
- House assignment uses both a string (`tblstudent.house`) and an integer FK (`tblstudent_enrollment.house_id`) — potential inconsistency.

**FAQ:** *How do I add a new house?* — Use Student → House → Master Setup (`/student/add_house`).

## 11. Sales notes
**Selling points:** Visual house performance comparison via radar chart; supports house-based competitions and gamification.

**Demo flow:**
1. Show radar chart with multiple houses.
2. Click Master Setup to show house configuration.

Plan/pricing: TBD

## 12. v1 status & v2 ideas
**Complete:** House list, radar chart, master setup link.
**Partial:** Radar scores are member-count proxies, not real performance.
**v2 ideas:** Real house points system (sports, cultural, academic event scores); house leaderboard on PAL gamification.

## Source files
- `C:\rajesh\lms_k12\app\students\house\page.tsx`
- `C:\rajesh\lms_k12\app\students\house\api.ts`
- `C:\rajesh\lms_k12\app\student\add_house\page.tsx`
- `F:\xampp\htdocs\next_lms_erp\app\Http\Controllers\student\houseController.php`

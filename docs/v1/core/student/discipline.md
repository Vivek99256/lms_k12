# Discipline
**Product:** Scholar Core | **Module:** Student | **Frontend route:** `/students/discipline` | **v1 status:** Complete

| Field | Value |
|---|---|
| Backend routes | `GET /api/proxy?path=student-care/discipline` · `POST /api/proxy?path=get_adminStudentSearch` |
| Roles | Admin, Coordinator, Principal, Class Teacher |
| Last updated | 2026-11-04 |
| Source commit | 8fe500dc (FE) / 86261072 (BE) |

## 1. Purpose & users
Tracks behavioral incidents for students — demerit points, incident categories, and resolution status. Provides at-a-glance metrics and a full incident log. Used by coordinators and principals to monitor student conduct and follow up on open incidents.

Also available as a legacy entry screen at `/student/dicipline` (note the spelling) which uses a different legacy page.

## 2. Screens

**Discipline Module** (`/students/discipline`)
- Metric cards: Incidents this term, Demerit points issued, Students flagged, Resolved
- Discipline chart (`DisciplineChart`) — incident trend or category breakdown
- Incidents table: Date, Student, Class, Section, Category, Demerit points, Status badge

![](./screenshots/discipline.png)

## 3. Features & business rules

### Incident fields
| Field | Type | Notes |
|---|---|---|
| date_ | date | Incident date |
| student_id | int FK → tblstudent | |
| student_name | varchar | |
| message / dicipline | varchar | Incident category/description |
| flag | int | >0 = Resolved, <0 = Open, 0 = Under review |

### Status derivation (client-side)
| `flag` value | Status |
|---|---|
| > 0 | Resolved |
| < 0 | Open |
| = 0 | Under review |

### Demerit points
`demeritPoints = Math.abs(flag)`. Totaled across all incidents for the "Demerit points issued" KPI.

### Metrics
- Incidents this term: total incident records for the period
- Demerit points issued: sum of `Math.abs(flag)` for all records
- Students flagged: count of distinct `student_id` values
- Resolved: count of incidents with `flag > 0`

## 4. User flows

**View discipline overview**
1. Navigate to Students → Discipline.
2. Page fetches student roster (`get_adminStudentSearch`) + discipline records (`student-care/discipline`) in parallel.
3. Roster is indexed by `student_id` to enrich discipline records with grade and section.
4. Metrics calculated client-side; table and chart rendered.

**Legacy entry** (`/student/dicipline`)
Separate legacy page for recording new incidents. See legacy controller `student/` dir.

## 5. Data model

### `tbldicipline` (inferred from controller name; exact columns TBD)
| Column | Type | Notes |
|---|---|---|
| id | bigint PK | |
| student_id | int FK → tblstudent | |
| date_ | date | Incident date |
| dicipline / message | varchar | Category/description |
| flag | int | Status encoding (see above) |
| sub_institute_id | int | |
| created_by | int | |
| created_on | timestamp | |

Exact columns TBD — read controller source for confirmation.

Also references: `tbldicipline_dd` (drop-down master for incident categories), `tbldicipline_master`.

## 6. APIs
| Method | Endpoint | Auth | Request | Response | Errors |
|---|---|---|---|---|---|
| POST | `get_adminStudentSearch` | Session | Session params | Student roster | — |
| GET | `student-care/discipline` | Session | Session params | `{ status:1, data:[{student_id, date_, flag, message, ...}] }` | 404 no records |

## 7. UI components & design tokens
- `DisciplineChart` — chart component (type TBD from component source)
- `IncidentsTable` — sortable table with status badge
- `MetricCard` — KPI tile (ShieldAlert, Ban, UserCheck, CheckCircle icons)
- Status badge colors: Resolved=green, Open=red, Under review=amber

## 8. Reports & exports
Export functionality: TBD. See [../student/reports.md](reports.md) for Discipline Report.

## 9. Test cases
| ID | Scenario | Steps | Expected result | Type |
|---|---|---|---|---|
| S-DISC-01 | View incidents | Navigate to /students/discipline | Metrics and table load | Happy |
| S-DISC-02 | Resolved incident | Incident with flag=5 | Status = "Resolved", demerit points = 5 | Happy |
| S-DISC-03 | Open incident | Incident with flag=-3 | Status = "Open", demerit points = 3 | Happy |
| S-DISC-04 | Under review | Incident with flag=0 | Status = "Under review", demerit points = 0 | Edge |
| S-DISC-05 | No incidents | No records returned | Zero metrics, empty table | Edge |
| S-DISC-06 | API error | Backend returns 500 | Error message shown | Negative |

## 10. Known issues, limitations & FAQs
- The `flag` encoding (positive=resolved, negative=open, zero=under review) is unusual and undocumented in code comments. Future developers must know this convention.
- The URL typo `/student/dicipline` (missing 's') is preserved for backward compatibility.
- No pagination on the incidents table in v1 — large incident logs may be slow.

**FAQ:** *Can a teacher record a new incident from this page?* — No; the new modern page (`/students/discipline`) is view-only. Recording goes through `/student/dicipline` (legacy).

## 11. Sales notes
**Selling points:** Real-time incident tracking with demerit-point system; at-a-glance resolution dashboard.

**Demo flow:**
1. Show metrics (incidents, demerit points, students flagged, resolved).
2. Show incident table with status badges.
3. Explain the flag system.

Plan/pricing: TBD

## 12. v1 status & v2 ideas
**Complete:** Metrics, incident table, status derivation.
**Partial:** New incident entry is on legacy page only.
**v2 ideas:** Inline incident creation on modern page; parent notification trigger on new incident; trend chart showing incidents over time.

## Source files
- `C:\rajesh\lms_k12\app\students\discipline\page.tsx`
- `C:\rajesh\lms_k12\app\students\discipline\api.ts`
- `C:\rajesh\lms_k12\app\students\discipline\components\DisciplineChart.tsx`
- `C:\rajesh\lms_k12\app\students\discipline\components\IncidentsTable.tsx`
- `C:\rajesh\lms_k12\app\students\discipline\components\MetricCard.tsx`
- `C:\rajesh\lms_k12\app\student\dicipline\page.tsx` (legacy entry page)
- `F:\xampp\htdocs\next_lms_erp\app\Http\Controllers\student\` (discipline-related controllers)

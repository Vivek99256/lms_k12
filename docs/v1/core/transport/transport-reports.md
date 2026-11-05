# Transportation Reports
**Product:** Scholar Core | **Module:** Transportation | **Frontend routes:** `/Transportation/van_summery_report`, `/Transportation/van_wise_report`, `/Transportation/dashboard` | **v1 status:** Partial

| Field | Value |
|---|---|
| Backend routes | `POST transportation-dashboard/summary`; Blade report controllers |
| Roles | Transport Admin, Principal, Super Admin |
| Last updated | 2026-11-04 |
| Source commit | 8fe500dc (FE) / 86261072 (BE) |

## 1. Purpose & users
Reports for transport administration: which students are on which bus, route-wise summaries, and dashboard KPIs for the principal.

## 2. Reports catalog

| Report | Route | Filters | Columns | Export |
|---|---|---|---|---|
| Van Summary Report | `/Transportation/van_summery_report` | Academic year, Bus | Bus name, Route, Total students, Driver | Excel, PDF |
| Van-wise Report | `/Transportation/van_wise_report` | Bus, Route, Standard | Student name, Stop, Shift, Class | Excel, PDF |
| Transport Dashboard | `/Transportation/dashboard` | — | Total students mapped, Routes, Vehicles | On-screen |

## 3. Data model
- `transport_map_student` — primary source for student lists per bus/route
- `transport_vehicle`, `transport_route`, `transport_stop` — reference data
- `transport_driver_detail` — driver details for van summary

## 4. Known issues
- Note: `van_summery_report` has a spelling inconsistency (`summery` vs `summary`) in the route — preserved as-is from source.
- Transport rate report (kilometer-rate based fee calculation) route not found in frontend scan.

## 5. v1 status & v2 ideas
- v1: Van summary and van-wise reports available.
- **v2:** Route-wise on-time performance report; driver attendance log report; parent-facing stop notification.

## Source files
- Frontend: `C:\rajesh\lms_k12\app\Transportation\van_summery_report\page.tsx`, `van_wise_report\page.tsx`, `dashboard\page.tsx`
- API: `F:\xampp\htdocs\next_lms_erp\routes\api.php` line 153

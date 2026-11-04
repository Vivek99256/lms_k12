# Hostel Reports
**Product:** Scholar Core | **Module:** Hostel | **Frontend routes:** `/hostel/hostel-report`, `/hostel/available-room-report`, `/hostel/visitor-report` | **v1 status:** Partial

| Field | Value |
|---|---|
| Backend routes | `hostel_management/hostel_report`, `hostel_management/hostel_visitor_report` |
| Roles | Hostel Admin, Principal, Super Admin |
| Last updated | 2026-11-04 |
| Source commit | 8fe500dc (FE) / 86261072 (BE) |

## 1. Purpose & users
Provides occupancy, allocation, and visitor summary reports for hostel administration and principal review.

## 2. Screens

**Hostel Report** (`/hostel/hostel-report`) — Student-wise allocation summary.
**Available Room Report** (`/hostel/available-room-report`) — Rooms with vacant capacity.
**Visitor Report** (`/hostel/visitor-report`) — Visitor log with date filter.

![](./screenshots/hostel-reports.png)

## 3. Reports catalog

| Report | Route | Filters | Columns | Export |
|---|---|---|---|---|
| Room Allocation Report | `/hostel/hostel-report` | Hostel, Building, Floor, Academic year | Student name, Room, Bed no, Locker, Term | Excel, PDF |
| Available Room Report | `/hostel/available-room-report` | Hostel, Building, Floor | Room name, Floor, Building, Status | Excel |
| Visitor Report | `/hostel/visitor-report` | Date range | Visitor name, Contact, Relation, In-time, Out-time | Excel |
| Dashboard Summary | `/hostel/dashboard` | — | Total students, Rooms occupied, Rooms available | On-screen |

## 4. Data model
- `hostel_room_allocation` → main source for allocation reports
- `hostel_room_master` → room list for available-room report
- `hostel_visitor_master` → visitor report source

## 5. Known issues
- Available-room report depends on `hostel_room_master` having no capacity column — availability is derived from absence of allocations, not a capacity field.
- Visitor report date filter may not work correctly due to `meet_date` being stored as varchar.

## 6. v1 status & v2 ideas
- v1: Basic reports available.
- **v2:** Add Excel/PDF export to available-room report; fix date filtering in visitor report; add occupancy percentage chart.

## Source files
- Frontend: `C:\rajesh\lms_k12\app\hostel\hostel-report\page.tsx`, `C:\rajesh\lms_k12\app\hostel\available-room-report\page.tsx`, `C:\rajesh\lms_k12\app\hostel\visitor-report\page.tsx`
- Controllers: `F:\xampp\htdocs\next_lms_erp\app\Http\Controllers\hostel_management\hostel_reportController.php`, `hostel_visitor_reportController.php`

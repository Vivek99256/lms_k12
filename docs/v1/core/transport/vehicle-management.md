# Vehicle Management
**Product:** Scholar Core | **Module:** Transportation | **Frontend route:** `/Transportation/add_vehicle`, `/Transportation/add_driver_conductor`, `/Transportation/add_shift` | **v1 status:** Complete

| Field | Value |
|---|---|
| Backend routes | `GET/POST/PUT/DELETE transportation-setup/{module}` |
| Roles | Transport Admin, Super Admin |
| Last updated | 2026-11-04 |
| Source commit | 8fe500dc (FE) / 86261072 (BE) |

## 1. Purpose & users
Manages the fleet of vehicles, drivers, conductors, and shifts used for school transport. Transport Admin sets this up at the start of the year and updates when drivers change or vehicles are added.

## 2. Screens

**Vehicle List** (`/Transportation/add_vehicle`) — All vehicles with number, type, capacity, driver, conductor.
**Driver/Conductor Master** (`/Transportation/add_driver_conductor`) — Staff who operate the vehicles.
**School Shift** (`/Transportation/add_shift`) — Morning/afternoon/custom shifts.
**Transport Rate** (`/Transportation/add_transport_rate`) — Per-KM rate configuration.

![](./screenshots/vehicle-management.png)

## 3. Features & business rules

**transport_vehicle**
| Field | Type | Required | Notes |
|---|---|---|---|
| title | varchar(50) | Yes | Vehicle display name |
| vehicle_number | varchar(50) | Yes | Registration number |
| vehicle_type | varchar(50) | Yes | Bus, Van, Auto, etc. |
| sitting_capacity | int | Yes | — |
| school_shift | bigint FK | Yes | → transport_school_shift |
| vehicle_identity_number | varchar(50) | Yes | Chassis/engine number |
| driver | bigint FK | Yes | → transport_driver_detail |
| conductor | bigint FK | No | → transport_driver_detail |
| sub_institute_id | bigint | System | Tenant |

**transport_driver_detail**
| Field | Type | Required | Notes |
|---|---|---|---|
| first_name | varchar(50) | Yes | — |
| last_name | varchar(50) | Yes | — |
| mobile | varchar(15) | Yes | — |
| type | varchar(15) | Yes | "driver" or "conductor" |
| icard_icon | varchar(100) | No | Photo path |
| sub_institute_id | bigint | System | Tenant |

**transport_school_shift** — from `create_transport_school_shift_table` migration (shift name, timing).
**transport_kilometer_rate** — per-KM fee rate configuration.

**Permissions:** View, Add, Edit, Delete via RBAC.

## 4. User flows

**Add a vehicle:**
1. First add driver and conductor in Driver/Conductor Master.
2. Set up school shifts.
3. Open Vehicle Master → Add Vehicle.
4. Enter vehicle details, assign driver, conductor, shift.
5. Save.

## 5. Data model
Relations:
- `transport_vehicle.driver` → `transport_driver_detail.id`
- `transport_vehicle.conductor` → `transport_driver_detail.id`
- `transport_vehicle.school_shift` → `transport_school_shift.id`
- `transport_route_bus.bus_id` → `transport_vehicle.id`

## 6. APIs

| Method | Endpoint | Auth | Notes |
|---|---|---|---|
| GET | `transportation-setup/vehicles` | JWT | List vehicles |
| POST | `transportation-setup/vehicles` | JWT | Create vehicle |
| PUT | `transportation-setup/vehicles/{id}` | JWT | Update |
| DELETE | `transportation-setup/vehicles/{id}` | JWT | Delete |

Same pattern for drivers, shifts via `{module}` parameter.

## 7. UI components & design tokens
- Form with foreign-key selects
- Data table
- Design tokens: standard ERP tokens

## 8. Reports & exports
See [transport-reports.md](transport-reports.md) — Van Summary Report, Van-wise Report.

## 9. Test cases

| ID | Scenario | Steps | Expected result | Type |
|---|---|---|---|---|
| VH-001 | Add vehicle with driver | Fill all required fields, save | Vehicle in list | Happy |
| VH-002 | Add vehicle without driver | Leave driver blank | Validation error | Negative |
| VH-003 | Assign same driver to two vehicles | Create second vehicle with same driver | TBD — no unique constraint on driver FK | Edge |
| VH-004 | Delete driver assigned to vehicle | Delete driver record | TBD — FK constraint behaviour | Edge |

## 10. Known issues, limitations & FAQs
- No unique constraint on `vehicle_number` per institute.
- Driver status (active/inactive) added in `2024_02_21_153213_add_status_to_transport_driver_detail_table.php` — available but UI support TBD.
- **FAQ:** Can a driver be assigned to multiple vehicles? No unique constraint prevents it.

## 11. Sales notes
- **Selling point:** Tracks vehicle capacity, driver/conductor contacts, shifts — full fleet management in one place.
- **Demo flow:** (1) Add driver. (2) Add vehicle. (3) Assign to route. (4) Pull van-wise report.
- **Plan/pricing:** TBD

## 12. v1 status & v2 ideas
- v1: Vehicle, driver, shift CRUD complete.
- **v2:** Unique constraint on vehicle_number; driver availability calendar; vehicle maintenance log; GPS integration.

## Source files
- Frontend: `C:\rajesh\lms_k12\app\Transportation\add_vehicle\page.tsx`, `add_driver_conductor\page.tsx`, `add_shift\page.tsx`
- API: `F:\xampp\htdocs\next_lms_erp\routes\api.php` lines 506-509
- Migrations: `F:\xampp\htdocs\next_lms_erp\database\migrations\2023_03_05_115658_create_transport_vehicle_table.php`, `..._transport_driver_detail_table.php`, `..._transport_school_shift_table.php`, `..._transport_kilometer_rate_table.php`

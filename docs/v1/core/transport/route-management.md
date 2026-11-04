# Route Management
**Product:** Scholar Core | **Module:** Transportation | **Frontend route:** `/Transportation/add_route`, `/Transportation/add_stop`, `/Transportation/map_route_stop` | **v1 status:** Complete

| Field | Value |
|---|---|
| Backend routes | `GET/POST/PUT/DELETE transportation-setup/{module}` via `TransportationApiController` |
| Roles | Transport Admin, Super Admin |
| Last updated | 2026-11-04 |
| Source commit | 8fe500dc (FE) / 86261072 (BE) |

## 1. Purpose & users
Defines the transport routes the institute runs — name, timing, stops, and buses assigned per route. Transport Admin sets this up once per academic year and updates when routes change. Routes are the foundation for student transport mapping.

## 2. Screens

**Route List** (`/Transportation/add_route`) — Lists all routes with name and timing.
**Stop Master** (`/Transportation/add_stop`) — Lists all bus stops.
**Map Route → Stop** (`/Transportation/map_route_stop`) — Assigns stops to a route with pickup/drop times.
**Map Route → Bus** (`/Transportation/map_route_bus`) — Assigns a vehicle to a route.

![](./screenshots/route-management.png)

## 3. Features & business rules

**transport_route**
| Field | Type | Required | Notes |
|---|---|---|---|
| route_name | varchar(50) | Yes | — |
| from_time | varchar(50) | Yes | Route start time |
| to_time | varchar(50) | Yes | Route end time |
| syear | bigint | Yes | Academic year scoped |
| sub_institute_id | bigint | System | Tenant |

**transport_stop**
| Field | Type | Required | Notes |
|---|---|---|---|
| stop_name | varchar(50) | Yes | — |
| syear | bigint | Yes | — |

**transport_route_stop** (mapping)
| Field | Type | Required | Notes |
|---|---|---|---|
| route_id | bigint FK | Yes | → transport_route |
| stop_id | bigint FK | Yes | → transport_stop |
| pickuptime | varchar(50) | No | — |
| droptime | varchar(50) | No | — |
| syear | bigint | Yes | — |

**transport_route_bus** (mapping)
| Field | Type | Required | Notes |
|---|---|---|---|
| route_id | bigint FK | Yes | → transport_route |
| bus_id | bigint FK | Yes | → transport_vehicle |
| syear | bigint | Yes | — |

- Times stored as varchar — no time validation at DB level.
- Routes, stops, and mappings are all year-scoped (`syear`).

**Permissions:** View, Add, Edit, Delete via RBAC.

## 4. User flows

**Set up a new route:**
1. Create stops (Stop Master).
2. Create route (Add Route) — name, from_time, to_time, academic year.
3. Map stops to route (Map Route → Stop) — assign pickup and drop times.
4. Map bus to route (Map Route → Bus).

## 5. Data model
See fields above. Relations:
- `transport_route` ← `transport_route_stop` → `transport_stop`
- `transport_route` ← `transport_route_bus` → `transport_vehicle`

## 6. APIs

| Method | Endpoint | Auth | Notes |
|---|---|---|---|
| GET | `transportation-setup/{module}` | JWT | List routes/stops/mappings |
| POST | `transportation-setup/{module}` | JWT | Create |
| PUT/PATCH | `transportation-setup/{module}/{id}` | JWT | Update |
| DELETE | `transportation-setup/{module}/{id}` | JWT | Delete |

`{module}` values correspond to route, stop, route-stop, route-bus, etc.

## 7. UI components & design tokens
- Cascading dropdowns (Route → Stop)
- Data table
- Design tokens: `--surface-*`, `--action-primary`

## 8. Reports & exports
See [transport-reports.md](transport-reports.md).

## 9. Test cases

| ID | Scenario | Steps | Expected result | Type |
|---|---|---|---|---|
| TR-001 | Create route with timing | Add route name, from/to time, save | Route in list | Happy |
| TR-002 | Map stop with pickup time | Link stop to route, enter pickuptime, save | Mapping saved | Happy |
| TR-003 | Delete stop that is mapped | Delete a stop assigned to route | TBD — no cascade guard found | Edge |
| TR-004 | Duplicate route name same year | Add same route_name, same syear | TBD — no unique constraint found | Edge |

## 10. Known issues, limitations & FAQs
- No unique constraint on route_name + syear — duplicates possible.
- Times are varchar — no validation of HH:MM format.
- **FAQ:** Can one bus serve multiple routes? Yes — `transport_route_bus` allows it at DB level.

## 11. Sales notes
- **Selling point:** Full stop-wise timing management; bulk student mapping by stop.
- **Demo flow:** (1) Create stops. (2) Create route. (3) Map stops with times. (4) Assign vehicle. (5) Map students.
- **Plan/pricing:** TBD

## 12. v1 status & v2 ideas
- v1: Route, stop, mapping CRUD complete.
- **v2:** Store times as proper time type; add route map visualization; GPS live tracking integration.

## Source files
- Frontend: `C:\rajesh\lms_k12\app\Transportation\add_route\page.tsx`, `add_stop\page.tsx`, `map_route_stop\page.tsx`, `map_route_bus\page.tsx`
- API: `F:\xampp\htdocs\next_lms_erp\routes\api.php` lines 506-509
- Migrations: `F:\xampp\htdocs\next_lms_erp\database\migrations\2023_03_05_115658_create_transport_route_table.php`, `..._transport_stop_table.php`, `..._transport_route_stop_table.php`, `..._transport_route_bus_table.php`

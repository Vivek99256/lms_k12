# Stock Management (Requisition, Allocation, Return, Defective)
**Product:** Scholar Core | **Module:** Inventory | **Frontend routes:** `/Inventory/requisition_form`, `/Inventory/requisition_form_approved`, `/Inventory/inventory_allocation`, `/Inventory/inventory_return`, `/Inventory/inventory_defective` | **v1 status:** Complete

| Field | Value |
|---|---|
| Backend routes | `GET/POST/PUT/DELETE inventory/{module}` |
| Roles | Store Keeper, Department Head (requisition), Admin (approval), Super Admin |
| Last updated | 2026-11-04 |
| Source commit | 8fe500dc (FE) / 86261072 (BE) |

## 1. Purpose & users
Manages internal stock movement after items arrive: staff or departments raise requisitions; Store Keeper allocates approved items; returned and defective items are tracked separately.

## 2. Screens

**Requisition Form** (`/Inventory/requisition_form`) — Department raises request for items.
**Requisition Approved** (`/Inventory/requisition_form_approved`) — Admin approves/rejects requisitions.
**Allocation** (`/Inventory/inventory_allocation`) — Store Keeper allocates approved items to requesters.
**Return** (`/Inventory/inventory_return`) — Records items returned to store.
**Defective** (`/Inventory/inventory_defective`) — Logs defective/damaged items written off.

![](./screenshots/stock-management.png)

## 3. Features & business rules

**inventory_requisition_details**
| Field | Type | Required | Notes |
|---|---|---|---|
| requisition_no | varchar(50) | Yes | Reference number |
| requisition_by | int FK | Yes | User who raised request |
| requisition_date | datetime | Yes | — |
| item_id | int FK | Yes | → inventory_item_master |
| item_qty | int | Yes | Requested quantity |
| item_unit | varchar(50) | No | Unit (pcs, kg, etc.) |
| approved_qty | int | No | May differ from requested |
| item_qty_in_stock | int | System | Stock at time of request |
| expected_delivery_time | datetime | No | — |
| requisition_status | int | System | 0=pending, 1=approved, 2=rejected |
| remarks / approval_remarks | varchar(50) | No | — |
| requisition_approved_by | int FK | System | — |
| requisition_approved_date | datetime | System | — |
| department_id | int FK | No | → department |
| user_group_id | int | No | — |
| marking_period_id | int | No | — |
| syear | varchar(50) | Yes | Academic year |

**inventory_allocation_details** — links requisition to actual allocation with location and responsible person.
**inventory_item_return_details** — tracks returned items (from `create_inventory_item_return_details_table`).
**inventory_item_defective_details** — logs defective/damaged items (from `create_inventory_item_defective_details_table`).
**inventory_item_lost_details** — logs lost items.

**Approval flow:** Requisition → `requisition_status=0` (pending) → Admin approves → `requisition_status=1` → Allocate → Stock decremented.

**Permissions:** Department head: raise requisition. Store Keeper: allocate. Admin: approve. RBAC-controlled.

## 4. User flows

**Raise and fulfil a requisition:**
1. Staff opens Requisition Form, selects item, enters quantity needed.
2. Admin reviews in Requisition Approved screen — sets approved_qty, approves.
3. Store Keeper opens Allocation — assigns LOCATION_OF_MATERIAL and PERSON_RESPONSIBLE, links to requisition.
4. Stock count updated.

**Record a return:**
1. Store Keeper opens Return screen.
2. Selects item, quantity, reason.
3. Save — stock count increases.

**Log defective item:**
1. Store Keeper opens Defective screen.
2. Records item, quantity, description of defect.
3. Save — item written off from stock.

## 5. Data model

**inventory_allocation_details**
| Column | Type | Notes |
|---|---|---|
| ID | bigint PK | Uppercase per migration |
| REQUISITION_DETAILS_ID | int | → inventory_requisition_details |
| REQUISITION_ID | int | — |
| LOCATION_OF_MATERIAL | varchar(50) | Where item is stored/sent |
| PERSON_RESPONSIBLE | varchar(50) | Who received it |
| ITEM_ID | int FK | → inventory_item_master |
| SYEAR / SUB_INSTITUTE_ID | varchar | Tenant/year (uppercase columns) |

Note: `inventory_allocation_details` uses UPPERCASE column names, unlike all other inventory tables — inconsistency from original migration.

## 6. APIs

| Method | Endpoint | Auth | Notes |
|---|---|---|---|
| GET | `inventory/requisition` | JWT | List requisitions |
| POST | `inventory/requisition` | JWT | Create requisition |
| PUT | `inventory/requisition/{id}` | JWT | Approve/update |
| GET | `inventory/allocation` | JWT | List allocations |
| POST | `inventory/allocation` | JWT | Create allocation |

## 7. UI components & design tokens
- Requisition list with status badge (Pending / Approved / Rejected)
- Approval action buttons
- Design tokens: `--status-warning` (pending), `--status-success` (approved), `--action-primary`

## 8. Reports & exports
See [inventory-reports.md](inventory-reports.md) — Requisition Report, Stock Report.

## 9. Test cases

| ID | Scenario | Steps | Expected result | Type |
|---|---|---|---|---|
| REQ-001 | Raise requisition | Select item, qty, save | Requisition with status=pending created | Happy |
| REQ-002 | Approve with reduced qty | Set approved_qty < item_qty | approved_qty saved, status=approved | Happy |
| REQ-003 | Allocate without approval | Try to allocate pending requisition | TBD — no guard found in migration | Edge |
| REQ-004 | Return item to store | Enter return qty, save | Stock increases | Happy |
| REQ-005 | Log defective items | Enter defective qty | Stock decreases, defective record created | Happy |

## 10. Known issues, limitations & FAQs
- `inventory_allocation_details` uses UPPERCASE column names — inconsistent with the rest of the schema; may cause query issues in ORM.
- No stock balance calculation found in migration — current stock is likely computed by summing opening_stock + receivables - allocations - returns - defectives at query time.
- **FAQ:** Is stock automatically updated when a PO is received? Yes — via `item_receivable` controller.

## 11. Sales notes
- **Selling point:** Full internal stock lifecycle — from requisition approval to allocation, return, and defective write-off; complete audit trail.
- **Demo flow:** (1) Staff raises requisition. (2) Admin approves. (3) Store Keeper allocates. (4) Pull stock balance report.
- **Plan/pricing:** TBD

## 12. v1 status & v2 ideas
- v1: Requisition, allocation, return, defective CRUD complete.
- **v2:** Normalize UPPERCASE column issue in allocation table; real-time stock balance view; low-stock auto-requisition trigger; barcode scan on allocation.

## Source files
- Frontend: `C:\rajesh\lms_k12\app\Inventory\requisition_form\page.tsx`, `requisition_form_approved\page.tsx`, `inventory_allocation\page.tsx`, `inventory_return\page.tsx`, `inventory_defective\page.tsx`
- API: `F:\xampp\htdocs\next_lms_erp\routes\api.php` lines 515-521
- Controllers: `F:\xampp\htdocs\next_lms_erp\app\Http\Controllers\inventory\requisitionController.php`, `requisitionApprovedController.php`, `inventory_item_allocationController.php`, `inventory_item_returnController.php`, `inventory_item_defectiveController.php`
- Migrations: `F:\xampp\htdocs\next_lms_erp\database\migrations\2023_03_05_115658_create_inventory_requisition_details_table.php`, `..._inventory_allocation_details_table.php`, `..._inventory_item_return_details_table.php`, `..._inventory_item_defective_details_table.php`, `..._inventory_item_lost_details_table.php`

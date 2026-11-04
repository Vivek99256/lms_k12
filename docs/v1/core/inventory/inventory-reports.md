# Inventory Reports
**Product:** Scholar Core | **Module:** Inventory | **Frontend routes:** `/Inventory/item_wise_report`, `/Inventory/overall_item_report`, `/Inventory/requisition_report`, `/Inventory/item_delivery_status_report` | **v1 status:** Partial

| Field | Value |
|---|---|
| Backend routes | `GET inventory/reports/{module}` |
| Roles | Store Keeper, Admin, Principal, Super Admin |
| Last updated | 2026-11-04 |
| Source commit | 8fe500dc (FE) / 86261072 (BE) |

## 1. Purpose & users
Provides stock visibility, requisition tracking, and procurement status reports for store management and administration review.

## 2. Reports catalog

| Report | Route | Filters | Columns | Export |
|---|---|---|---|---|
| Item-wise Report | `/Inventory/item_wise_report` | Category, Sub-category, Academic year | Item name, Opening stock, Received, Allocated, Returned, Defective, Balance | Excel, PDF |
| Overall Item Report | `/Inventory/overall_item_report` | Academic year | Category summary, Total stock value | Excel, PDF |
| Requisition Report | `/Inventory/requisition_report` | Date range, Status, Department | Requisition no, Item, Requested qty, Approved qty, Status | Excel |
| Delivery Status Report | `/Inventory/item_delivery_status_report` | PO number, Vendor | PO no, Item, Ordered qty, Received qty, Pending qty | Excel |
| Staff-wise Report | (via `inventory_staff_wise_reportController`) | Staff, Department, Date range | Staff name, Item, Qty allocated | Excel |
| Lost Item Report | (via `inventory_item_lost_reportController`) | Date range | Item, Qty lost, Responsible | Excel |

## 3. Data model
- `inventory_item_master` — item catalog
- `inventory_requisition_details` — requisition data
- `inventory_generate_po_details` — PO data
- `inventory_item_receivable_details` — receipt data
- `inventory_allocation_details` — allocation data
- `inventory_item_return_details` — return data
- `inventory_item_defective_details` — defective data
- Balance = opening_stock + receivables − allocations − returns − defectives − lost

## 4. Known issues
- Balance calculation depends on summing across multiple tables — no materialized stock balance column found.
- Staff-wise and lost-item report routes not found in frontend page scan — may be accessible from other navigation.

## 5. v1 status & v2 ideas
- v1: Item-wise, overall, requisition, delivery status reports available.
- **v2:** Scheduled stock reports via email; stock valuation report (qty × unit cost); low-stock dashboard widget.

## Source files
- Frontend: `C:\rajesh\lms_k12\app\Inventory\item_wise_report\page.tsx`, `overall_item_report\page.tsx`, `requisition_report\page.tsx`, `item_delivery_status_report\page.tsx`
- API: `F:\xampp\htdocs\next_lms_erp\routes\api.php` line 516
- Controllers: `F:\xampp\htdocs\next_lms_erp\app\Http\Controllers\inventory\inventory_item_wise_reportController.php`, `inventory_overall_item_reportController.php`, `inventory_requisition_reportController.php`, `inventory_delivery_status_reportController.php`, `inventory_staff_wise_reportController.php`, `inventory_item_lost_reportController.php`

# Purchase Order (Generate PO / Negotiate PO)
**Product:** Scholar Core | **Module:** Inventory | **Frontend routes:** `/Inventory/item_quotation`, `/Inventory/generate_po`, `/Inventory/negotiate_po`, `/Inventory/item_receivable`, `/Inventory/item_direct_purchase` | **v1 status:** Complete

| Field | Value |
|---|---|
| Backend routes | `GET/POST/PUT/DELETE inventory/{module}`, `GET inventory/receivables/items`, `POST inventory/receivables/multiple` |
| Roles | Store Keeper, Principal / Admin (approval), Super Admin |
| Last updated | 2026-11-04 |
| Source commit | 8fe500dc (FE) / 86261072 (BE) |

## 1. Purpose & users
Manages the full procurement cycle: quotation → purchase order → negotiation → receivable. Store Keeper raises quotations and POs; Principal or Admin approves them. Used whenever the school needs to purchase inventory items.

## 2. Screens

**Item Quotation** (`/Inventory/item_quotation`) — Request quotations from vendors for items.
**Generate PO** (`/Inventory/generate_po`) — Create a formal purchase order from an approved quotation.
**Negotiate PO** (`/Inventory/negotiate_po`) — Modify PO terms (price, qty) during negotiation.
**Item Receivable** (`/Inventory/item_receivable`) — Record items received against a PO.
**Direct Purchase** (`/Inventory/item_direct_purchase`) — Bypass PO for small/emergency purchases.

![](./screenshots/purchase-order.png)

## 3. Features & business rules

**inventory_generate_po_details**
| Field | Type | Required | Notes |
|---|---|---|---|
| po_number | varchar(50) | Yes | Unique PO reference |
| item_id | int FK | Yes | → inventory_item_master |
| vendor_id | int FK | Yes | → inventory_vendor_master |
| price | decimal(10) | Yes | Unit price |
| qty | int | Yes | Quantity ordered |
| amount | decimal(10) | Calculated | price × qty |
| dis_per / dis_amount_value | decimal | No | Discount % and value |
| after_dis_amount | decimal | Calculated | — |
| tax_per / tax_amount_value | decimal | No | Tax % and value |
| after_tax_amount | decimal | Calculated | Final amount |
| amount_per_item | decimal | Calculated | Per-item final cost |
| transportation_charge | varchar(50) | No | — |
| installation_charge | varchar(50) | No | — |
| payment_terms | mediumText | No | — |
| remarks | mediumText | No | — |
| delivery_time | datetime | No | Expected delivery |
| po_approval_status | int | System | 0=pending, 1=approved, etc. |
| po_approved_by | int FK | System | User who approved |
| po_approval_remark | mediumText | No | — |
| po_approved_date | datetime | System | — |
| po_place_of_delivery | varchar(50) | No | — |
| syear | decimal | Yes | Academic year |

**Approval workflow:** `po_approval_status` tracks pending/approved/rejected. Approval by authorized role updates `po_approved_by` and `po_approved_date`.

**inventory_item_quotation_details** — from `create_inventory_item_quotation_details_table` migration; similar structure for quotation stage.

**inventory_item_receivable_details** — records actual receipt against PO with quantities received.

**Direct purchase** (`inventory_item_direct_purchase`) — skips quotation/PO flow for petty purchases.

**Permissions:** Store Keeper: raise PO/quotation. Admin/Principal: approve PO. RBAC-controlled.

## 4. User flows

**Standard PO flow:**
1. Store Keeper raises Item Quotation for required items/vendors.
2. Admin reviews — selects best quotation.
3. Store Keeper generates PO — enters price, qty, discount, tax, delivery terms.
4. Admin approves PO (sets `po_approval_status = approved`).
5. Vendor delivers items.
6. Store Keeper records receivable (Item Receivable screen) — updates stock.

**Direct purchase:**
1. Store Keeper opens Direct Purchase.
2. Enters item, vendor, price, qty.
3. Saves — stock is updated immediately (no approval flow for direct purchase).

## 5. Data model
Key tables: `inventory_generate_po_details`, `inventory_item_quotation_details`, `inventory_item_receivable_details`, `inventory_negotiate_po_details`, `inventory_item_direct_purchase`.
All linked via `item_id` → `inventory_item_master`.

## 6. APIs

| Method | Endpoint | Auth | Notes |
|---|---|---|---|
| GET | `inventory/generate-po` | JWT | List POs |
| POST | `inventory/generate-po` | JWT | Create PO |
| GET | `inventory/receivables/items` | JWT | Items pending receipt |
| POST | `inventory/receivables/multiple` | JWT | Save multiple receivables at once |

## 7. UI components & design tokens
- Multi-line PO form with calculated fields (auto-compute discount/tax)
- Approval status badge
- Design tokens: `--action-primary`, `--surface-*`, `--content-secondary`

## 8. Reports & exports
See [inventory-reports.md](inventory-reports.md) — PO Report, Receivable Report.

## 9. Test cases

| ID | Scenario | Steps | Expected result | Type |
|---|---|---|---|---|
| PO-001 | Create PO with discount | Enter price, 10% discount, calculate | after_dis_amount computed correctly | Happy |
| PO-002 | Approve PO | Admin clicks approve | po_approval_status updated | Happy |
| PO-003 | Receive items against PO | Enter receivable qty, save | Stock updated | Happy |
| PO-004 | Receive more than PO qty | Enter qty > ordered | TBD — no over-receipt guard found | Edge |
| PO-005 | Direct purchase | Bypass PO, enter item+qty | Stock updated without approval | Happy |

## 10. Known issues, limitations & FAQs
- No over-receipt guard — receivable qty is not validated against PO qty at DB level.
- `po_number` stored as varchar with no unique constraint explicitly in migration — duplicates possible.
- **FAQ:** Can one PO cover multiple items from one vendor? TBD — `po_number` column suggests grouping by PO number is expected but multi-item PO structure depends on controller logic.

## 11. Sales notes
- **Selling point:** Full procurement audit trail — quotation → negotiation → PO approval → receipt; discount and tax calculation built in.
- **Demo flow:** (1) Raise quotation for lab equipment. (2) Generate PO. (3) Admin approves. (4) Record receipt. (5) Show updated stock.
- **Plan/pricing:** TBD

## 12. v1 status & v2 ideas
- v1: Full PO lifecycle implemented.
- **v2:** Unique PO number generation; over-receipt validation; e-mail PO to vendor; GRN (Goods Receipt Note) PDF; partial delivery tracking.

## Source files
- Frontend: `C:\rajesh\lms_k12\app\Inventory\item_quotation\page.tsx`, `generate_po\page.tsx`, `negotiate_po\page.tsx`, `item_receivable\page.tsx`, `item_direct_purchase\page.tsx`
- API: `F:\xampp\htdocs\next_lms_erp\routes\api.php` lines 515-521
- Controllers: `F:\xampp\htdocs\next_lms_erp\app\Http\Controllers\inventory\inventory_generate_poController.php`, `inventory_item_quotationController.php`, `inventory_item_receivableController.php`, `inventory_negotiate_poController.php`
- Migrations: `F:\xampp\htdocs\next_lms_erp\database\migrations\2023_03_05_115658_create_inventory_generate_po_details_table.php`, `..._inventory_item_quotation_details_table.php`, `..._inventory_item_receivable_details_table.php`

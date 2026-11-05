# Item Master
**Product:** Scholar Core | **Module:** Inventory | **Frontend route:** `/Inventory/inventory_item_master`, `/Inventory/item_category_master`, `/Inventory/item_sub_category_master`, `/Inventory/inventory_master_setup` | **v1 status:** Complete

| Field | Value |
|---|---|
| Backend routes | `GET/POST/PUT/DELETE inventory/{module}`, `GET inventory/reports/{module}` |
| Roles | Store Keeper, Admin, Super Admin |
| Last updated | 2026-11-04 |
| Source commit | 8fe500dc (FE) / 86261072 (BE) |

## 1. Purpose & users
Item Master is the foundation of inventory — all items (stationery, lab equipment, furniture, books, etc.) are registered here before they can be requisitioned, purchased, or allocated. Categories and sub-categories organize the catalog. Store Keeper and Admin use this for initial setup and when new item types are added.

## 2. Screens

**Item Master** (`/Inventory/inventory_item_master`) — Full item catalog with stock levels.
**Category Master** (`/Inventory/item_category_master`) — Item categories.
**Sub-Category Master** (`/Inventory/item_sub_category_master`) — Sub-categories under each category.
**Master Setup** (`/Inventory/inventory_master_setup`) — Tax master, vendor master, and other config.

![](./screenshots/item-master.png)

## 3. Features & business rules

**inventory_item_master**
| Field | Type | Required | Validation | Default |
|---|---|---|---|---|
| category_id | int FK | Yes | → inventory_item_category_master | — |
| sub_category_id | int FK | Yes | → inventory_item_sub_category_master | — |
| item_type_id | int FK | Yes | → inventory_item_type | — |
| title | varchar(255) | Yes | — | — |
| description | varchar(255) | No | — | — |
| opening_stock | int | No | — | 0 |
| minimum_stock | int | No | Alert threshold | 0 |
| direct_purchase_stock | int | No | — | 0 |
| item_attachment | varchar(255) | No | File path | — |
| item_status | varchar(255) | Yes | Active/Inactive | — |
| syear | int | Yes | Academic year | — |
| sub_institute_id | int | System | Tenant | Session |

- `minimum_stock` can be used to trigger low-stock alerts (UI/alert implementation TBD).
- `item_status` controls whether item appears in requisition/PO screens.
- Items are year-scoped (`syear`).

**inventory_vendor_master** — full vendor profile including PAN, bank details, TIN, GST info.
**inventory_tax_master** — tax rate setup.

**Permissions:** View, Add, Edit, Delete via RBAC.

## 4. User flows

**Add an item:**
1. Create Category (if new).
2. Create Sub-Category.
3. Open Item Master → Add Item.
4. Fill title, description, category, sub-category, item type, opening stock, minimum stock.
5. Attach image/file (optional).
6. Set status = Active. Save.

## 5. Data model

**inventory_item_master** — see fields above.

**inventory_item_category_master** (from `inventory_item_category_masterController`)
| Column | Type |
|---|---|
| id | bigint PK |
| sub_institute_id | int |
| category_name | varchar |
| status | varchar |

**inventory_item_sub_category_master**
| Column | Type |
|---|---|
| category_id | int FK |
| sub_category_name | varchar |

**inventory_vendor_master** — vendor_name, contact_number, address, email, PAN, bank details (see migration for full list).

## 6. APIs

| Method | Endpoint | Auth | Notes |
|---|---|---|---|
| GET | `inventory/item-master` | JWT | List items |
| POST | `inventory/item-master` | JWT | Create item |
| PUT | `inventory/item-master/{id}` | JWT | Update item |
| DELETE | `inventory/item-master/{id}` | JWT | Delete item |
| GET | `inventory/reports/item-wise` | JWT | Item-wise report |

`{module}` resolves to the actual module slug (e.g. `item-master`, `category-master`).

## 7. UI components & design tokens
- Searchable data table
- Category/sub-category cascading select
- File upload for item attachment
- Design tokens: `--surface-*`, `--action-primary`, `--content-*`

## 8. Reports & exports
See [inventory-reports.md](inventory-reports.md).

## 9. Test cases

| ID | Scenario | Steps | Expected result | Type |
|---|---|---|---|---|
| IM-001 | Add item with all fields | Fill required fields, save | Item in catalog | Happy |
| IM-002 | Add item without category | Leave category blank | Validation error | Negative |
| IM-003 | Set minimum_stock | Enter 10, save | Alert threshold set | Happy |
| IM-004 | Deactivate an item | Set status = Inactive | Item hidden from requisition dropdown | Edge |
| IM-005 | Add vendor with PAN | Fill PAN field | Vendor saved with PAN | Happy |

## 10. Known issues, limitations & FAQs
- No low-stock notification mechanism found in migration or controller — `minimum_stock` is stored but alert trigger is TBD.
- `serivce_tax_no` and `serivce_tax_date` in vendor master have typo (`serivce` vs `service`) — preserved from migration.
- **FAQ:** Can the same item exist in multiple years? Yes — items are `syear`-scoped.

## 11. Sales notes
- **Selling point:** Covers full vendor profile including PAN, GSTIN, bank details for purchase orders; opening-stock import at year start.
- **Demo flow:** (1) Create category (Stationery). (2) Add item (A4 Paper, opening stock 500). (3) Create vendor. (4) Raise purchase order.
- **Plan/pricing:** TBD

## 12. v1 status & v2 ideas
- v1: Item, category, sub-category, vendor, tax master CRUD complete.
- **v2:** Low-stock alert notification; barcode/QR scan for item tracking; vendor rating; GSTIN validation.

## Source files
- Frontend: `C:\rajesh\lms_k12\app\Inventory\inventory_item_master\page.tsx`, `item_category_master\page.tsx`, `item_sub_category_master\page.tsx`, `inventory_master_setup\page.tsx`
- API: `F:\xampp\htdocs\next_lms_erp\routes\api.php` lines 515-521
- Controllers: `F:\xampp\htdocs\next_lms_erp\app\Http\Controllers\inventory\inventory_item_masterController.php`, `inventory_item_category_masterController.php`, `inventory_vendor_masterController.php`
- Migrations: `F:\xampp\htdocs\next_lms_erp\database\migrations\2023_03_05_115658_create_inventory_item_master_table.php`, `..._inventory_item_category_master_table.php`, `..._inventory_vendor_master_table.php`, `..._inventory_tax_master_table.php`

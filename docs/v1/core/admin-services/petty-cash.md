# Petty Cash
**Product:** Scholar Core | **Module:** Admin Services | **Frontend route:** `/admin-services/petty-cash`, `/admin-services/petty-cash-master`, `/admin-services/petty-cash-report` | **v1 status:** Complete

| Field | Value |
|---|---|
| Backend routes | `GET api/petty-cash/heads`, `POST api/petty-cash/heads`, `POST api/petty-cash/heads/{id}`, `POST api/petty-cash/heads/{id}/delete`, `GET api/petty-cash`, `POST api/petty-cash`, `POST api/petty-cash/{id}`, `POST api/petty-cash/{id}/delete`, `GET api/petty-cash/report` |
| Roles | Admin, Accountant, Store Keeper |
| Last updated | 2026-11-04 |
| Source commit | 8fe500dc (FE) / 86261072 (BE) |

## 1. Purpose & users
Records small cash expenses (stationary, maintenance, refreshments). Staff log each spend against an expense head with date, amount, description, and optional bill image. Report screen provides date + head filtered summaries.

## 2. Screens

### Petty Cash Entry (`/admin-services/petty-cash`)
Form + entry list. Add/edit/delete petty cash entries. Bill image upload supported.

### Petty Cash Master (`/admin-services/petty-cash-master`)
Manage expense heads (add, rename, delete). A head cannot be deleted while it has entries.

### Petty Cash Report (`/admin-services/petty-cash-report`)
Date range + head filtered report of all entries. Same `GET api/petty-cash/report` endpoint.

## 3. Features & business rules

**Entry form:**
| Field | Type | Required | Validation | Default |
|---|---|---|---|---|
| Date | Date | Yes | — | Today |
| Expense head | Select | Yes | From `petty_cash_master` heads | — |
| Amount | Number (integer) | Yes | Whole numbers only (`petty_cash.amount` is INT) | — |
| Description | Textarea | No | — | — |
| Bill image | File | No | MAX_UPLOAD_BYTES | — |

**Head management:**
| Field | Type | Required | Notes |
|---|---|---|---|
| Title | Text | Yes | Unique per institute |

Heads cannot be deleted while entries reference them (server enforces).

**Amount:** Integer column — no paise/decimal tracking in v1.

## 4. User flows

**Add entry:**
1. Open Petty Cash.
2. Select head, enter date, amount, description.
3. Optionally attach bill scan.
4. Save.

**Add head:**
1. Open Petty Cash Master.
2. Enter new head name, save.

**Report:**
1. Open Petty Cash Report.
2. Set date range and optionally filter by head.
3. View filtered entries.

## 5. Data model

| Table | Key columns | Notes |
|---|---|---|
| `petty_cash` | id, sub_institute_id, title_id, amount (INT), description, bill_date, bill_image, created_by | Entries |
| `petty_cash_master` | id, sub_institute_id, title | Expense heads |

## 6. APIs

| Method | Endpoint | Auth | Request | Response |
|---|---|---|---|---|
| GET | `api/petty-cash/heads` | JWT | — | heads list |
| POST | `api/petty-cash/heads` | JWT | `{ title }` | created head |
| POST | `api/petty-cash/heads/{id}` | JWT | `{ title }` | updated head |
| POST | `api/petty-cash/heads/{id}/delete` | JWT | — | success / error "in use" |
| GET | `api/petty-cash` | JWT | — | `{ entries[], heads[] }` |
| POST | `api/petty-cash` | JWT | multipart: createdOn, titleId, amount, description, billImage | created entry |
| POST | `api/petty-cash/{id}` | JWT | multipart: updated fields | updated entry |
| POST | `api/petty-cash/{id}/delete` | JWT | — | `{ success, message }` |
| GET | `api/petty-cash/report` | JWT | from_date, to_date, head_id | filtered entries |

## 7. UI components & design tokens
- `RecordTable`, `ErpPageHeader`, `ErpSection`, `ErpAlert`, `ErpLoading`
- `erpInputClass`, `erpSelectClass`
- Lucide: `Wallet`, `Save`, `Trash2`, `ImageIcon`

## 8. Reports & exports
- `/admin-services/petty-cash-report` — date + head filtered; export format TBD

## 9. Test cases

| ID | Scenario | Steps | Expected result | Type |
|---|---|---|---|---|
| TC-PC-01 | Add petty cash entry | Fill form, save | Entry appears in list | Happy |
| TC-PC-02 | Add fractional amount | Enter 100.50 | Stored as 100 (INT column) | Edge |
| TC-PC-03 | Delete head in use | Try to delete an active head | Server returns error | Negative |
| TC-PC-04 | Filter report by head | Select one head | Only that head's entries shown | Happy |
| TC-PC-05 | Attach bill image | Upload image, save | Image stored and linked | Happy |

## 10. Known issues, limitations & FAQs
- Amount is an integer — no paisa/cent tracking.
- **FAQ:** Is there approval workflow for petty cash? Not in v1.
- **FAQ:** Can petty cash be reconciled against accounts? Not in v1.

## 11. Sales notes
- Eliminates petty cash notebooks; searchable digital record with bill images.

## 12. v1 status & v2 ideas
- **Complete:** CRUD entries, head management, report.
- **v2 ideas:** Approval workflow, decimal amounts, integration with accounts module, monthly reconciliation.

## Source files
- `C:\rajesh\lms_k12\app\admin-services\petty-cash\page.tsx`
- `C:\rajesh\lms_k12\app\admin-services\_lib\pettyCash.ts`

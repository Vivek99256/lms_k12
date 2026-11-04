# Unmapped Items — Resolution Log

Last updated: 2026-11-03
Generated from commit: `8fe500dc` (frontend) / `86261072` (backend)

> All items originally flagged as unmapped have been resolved. This file records the final decisions.
> No outstanding unmapped items remain.

---

## Resolved — Product Assignments

| Item | Resolution | Product | Notes |
|---|---|---|---|
| `/bazar/*` | Not required | — | Excluded from documentation scope |
| `ShareBazar` tables (`sharebazar_position`, `sharebazar_margin`, `sharebazar_pnl`) | Not required | — | Excluded from documentation scope |
| `BlogController` / `Blog` model | Not required | — | Excluded from documentation scope |
| `/teach-learn/*` | **Scholar Learn** | `learn` | Added to learn module map |
| Task Management (`/task-management/*`) | **Scholar CCB** | `ccb` | Already in CCB; confirmed |
| SQAA (`/sqaa/*`) | **Scholar Core** | `core` | Added to core module map |
| Alumni (`/alumni/*`, `/alumni-portal/*`) | **Scholar Core** | `core` | Added to core module map |
| `/engagement/activity` | **Scholar Learn** | `learn` | Added to learn module map |

## Resolved — Ambiguous Assignments (confirmed)

| Item | Product | Notes |
|---|---|---|
| Organization Management | `ccb` (primary) + `core` (employee directory overlap) | Confirmed CCB ownership |
| `/reports/broken-link-finder`, `/reports/nomenclature` | `insight` | Admin tooling under Insight |
| Teacher ID Card (`/student/teacher_icard`) | `core` | Under core Student module |
| User ID Card (`/student/user_icard`) | `core` | Under core Student module |
| `/interactions/ai-stack` | `insight` | Confirmed Insight |
| `/mobile-apps/ai-stack` | `_shared` | Shared platform configuration |
| `tourController` | `_shared` | ERP onboarding tour |
| `reuirementController` | `_shared` | Requirements/implementation tool |

---

> No items remain unmapped. All future new routes/controllers should be classified at the time of creation.

## Source files

- Original scan: `C:\rajesh\lms_k12\app\**\page.tsx`
- Backend migrations: `F:\xampp\htdocs\next_lms_erp\database\migrations\`
- Backend controllers: `F:\xampp\htdocs\next_lms_erp\app\Http\Controllers\`

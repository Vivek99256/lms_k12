# Scholar Compass — Reports Catalog

Last updated: 2026-11-03
Generated from commit: `8fe500dc` (frontend) / `86261072` (backend)

> Catalog of all reports in Scholar Compass (Career Counselling).

---

## Career Counselling Reports

| Report Name | Module/Menu | Frontend Route | Roles | Key Filters | Export | Data Source |
|---|---|---|---|---|---|---|
| Interest Profile Report | Career Counselling | `/career-counselling/interest-profile` | Counsellor, Admin | Student, Class, Standard | PDF, Excel | `lms_counselling` tables |
| Student Self-Awareness Report | Career Counselling | `/career-counselling/knowing-yourself` | Counsellor, Student | Student | PDF | `lms_counselling` tables |

---

## Career Awareness Reports

| Report Name | Module/Menu | Frontend Route | Roles | Key Filters | Export | Data Source |
|---|---|---|---|---|---|---|
| Career Alignment Report | Career Awareness | `/career-awareness/alignment` | Counsellor, Admin | Standard, Division | Excel | O*NET + student data |
| Career Ambition Report | Career Awareness | `/career-awareness/ambition` | Counsellor, Admin | Standard | Excel | O*NET + student data |
| Career Certainty Score | Career Awareness | `/career-awareness/certainty` | Counsellor, Admin | Standard | On-screen | O*NET + student data |
| Originality Index | Career Awareness | `/career-awareness/originality` | Counsellor, Admin | Standard | On-screen | O*NET + student data |

---

## Career Explorer Reports

| Report Name | Module/Menu | Frontend Route | Roles | Key Filters | Export | Data Source |
|---|---|---|---|---|---|---|
| Sector Exploration Report | Career Explorer | `/career-explorer/sectors` | Counsellor, Admin | Sector, Standard | Excel | `onet_explore_sector` |
| College Exploration Report | Career Explorer | `/career-explorer/college` | Counsellor, Admin | Standard | Excel | `onet_courses`, `onet_institute_data` |
| Course Exploration Report | Career Explorer | `/career-explorer/courses` | Counsellor, Admin | Interest domain | Excel | `onet_courses` |

---

## Career Intelligence Reports

| Report Name | Module/Menu | Frontend Route | Roles | Key Filters | Export | Data Source |
|---|---|---|---|---|---|---|
| Career Intelligence Summary | Career Intelligence | `/career-intelligence` | Principal, Counsellor | Standard, Date range | On-screen, PDF | Brain + O*NET tables |

---

> Note: O*NET data is sourced from the US Department of Labor's O*NET database, loaded into local tables (`onet_*`).
> Detailed docs: `docs/v1/compass/reports/<report-name>.md`

---

## Source files

- Frontend routes: `C:\rajesh\lms_k12\app\career-counselling\**\page.tsx`, `C:\rajesh\lms_k12\app\career-awareness\**\page.tsx`, `C:\rajesh\lms_k12\app\career-explorer\**\page.tsx`
- Backend controllers: `F:\xampp\htdocs\next_lms_erp\app\Http\Controllers\lms\counselling\`, `F:\xampp\htdocs\next_lms_erp\app\Http\Controllers\ONetOnlineDataController.php`
- Backend models: `F:\xampp\htdocs\next_lms_erp\app\Models\ONet*`

# Scholar Core — Fees Module
**Product:** Scholar Core | **v1 status:** Complete

The Fees module is the financial backbone of Scholar Core. It handles the full lifecycle of school fee management: structure setup, collection, online payments, NACH bank mandates, cancellations, refunds, automated reminders, and reporting.

---

## Module map

| Screen | File | Route | Status |
|---|---|---|---|
| Dashboard | [dashboard.md](dashboard.md) | `/fees/dashboard` | ✅ |
| Collect Fee | [collect-fee.md](collect-fee.md) | `/fees/collect` | ✅ |
| Master Setup | [master-setup.md](master-setup.md) | `/fees/master-setup`, `/fees/fees-config` | ✅ |
| Cancel & Refund | [cancel-refund.md](cancel-refund.md) | `/fees/cancel-refund` | ✅ |
| Online Fees | [online-fees.md](online-fees.md) | `/fees/online_fees_collect`, `/pay/[code]` | ✅ |
| Other Fees | [other-fees.md](other-fees.md) | `/fees/other_fees_collect`, `/fees/other_fees_cancel` | ✅ |
| NACH (S1–S4) | [nach.md](nach.md) | `/fees/NACH_s1excel_export` … `s4excel_import` | ✅ |
| Audit Trail | [audit-trail.md](audit-trail.md) | `/fees/audit-trail` | ✅ |
| Communication | [communication.md](communication.md) | `/fees/communication` | ✅ |
| Scheduler | [scheduler.md](scheduler.md) | `/fees/scheduler` | ✅ |
| Collection Report | [reports/collection-report.md](reports/collection-report.md) | `/fees/collection_report` and 12+ sub-reports | ✅ |
| Defaulter Report | [reports/defaulters-report.md](reports/defaulters-report.md) | `/fees/fees_defaulter_report` | ✅ |

---

## Key architectural notes

### Fee heads
`fees_collect` has 11 legacy named columns (`tution_fee` ← typo, `admission_fee`, `activity_fee`, `term_fee`, `deposit`, `co_curriculam_fees`, `computer_fees`, `smart_class`, `security_charges`, `photograph`, `cal_misc`) plus 12 configurable custom columns (`title_1`–`title_12`). Head names come from `fees_title` master.

### Progressive streaming
The collect-fee screen uses a custom JSON stream parser that renders student rows as the server streams them. This avoids waiting for the full result set before rendering, critical for large institutes. See [collect-fee.md](collect-fee.md) §3.

### Receipt HTML snapshots
`fees_collect.fees_html` and `fees_other_collection.paid_fees_html` store full HTML snapshots of each receipt at collection time. These are sanitized with `isomorphic-dompurify` before display. Template is configurable in `fees_config_master.fees_receipt_template`.

### NACH Excel round-trip
Bank mandate management uses a 4-step Excel round-trip (S1 export → bank → S2 import → S3 export → bank → S4 import). Backend uses the deprecated PHPExcel library. See [nach.md](nach.md).

### AI insight
The defaulter report's AI analysis is backed by a Python script (`/home/fees_analysis_10_04.py`) invoked via `shell_exec()` in `feesAIController`. The script path is hardcoded. See [reports/defaulters-report.md](reports/defaulters-report.md) §10.

### Known typos (preserved for backward compatibility)
| Typo | Location | Correct spelling |
|---|---|---|
| `reciept_id` | `fees_cancel` table column | `receipt_id` |
| `tution_fee` | `fees_collect` table column | `tuition_fee` |
| `schedular` | `tblmenumaster` entry + `categoryKey` | `scheduler` |
| `co_curriculam_fees` | `fees_collect` table column | `co_curricular_fees` |
| `online_fees_settigs_controller` | Laravel controller filename | `online_fees_settings_controller` |

---

## Primary backend controllers

| Controller | Purpose |
|---|---|
| `FeesDashboardApiController` | Dashboard KPI summary |
| `fees_collect_controller` | Collection list + streaming |
| `feesCancelController` | Cancel search + create |
| `feesRefundController` | Refund save |
| `feesReportController` | Collection report |
| `feesDefaulterReportController` | Defaulter list |
| `feesAIController` | AI insight (Python bridge) |
| `confirmOnlineFeesController` | Online payment confirmation |
| `s1excel_exportController` | NACH S1 export |
| `fees_audit_log_api_controller` | Audit log |

---

## Primary database tables

| Table | Purpose |
|---|---|
| `fees_collect` | Main collection rows |
| `fees_cancel` | Cancellation records |
| `fees_refund` | Refund records |
| `fees_other_collection` | Other/ad-hoc fee collection |
| `fees_config_master` | Module config (NACH, gateway, receipt template) |
| `fees_title` | Fee head names (title_1–title_12) |
| `fees_breakoff` | Term/month breakoff schedule |
| `other_fees_title` | Other fee type names |
| `system_audit_logs` | Audit trail (shared across modules) |

---

## Reports in this module
See [docs/v1/core/REPORTS.md](../REPORTS.md) for the full list of ~15 report controllers in the Fees module.

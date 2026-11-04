# Fees Scheduler
**Product:** Scholar Core | **Module:** Fees | **Frontend route:** `/fees/scheduler` | **v1 status:** Complete

| Field | Value |
|---|---|
| Backend routes | `GET/POST /api/platform-services/scheduler/fees/*` |
| Roles | Admin, Super Admin |
| Last updated | 2026-11-04 |
| Source commit | 8fe500dc (FE) / 86261072 (BE) |

## 1. Purpose & users
Schedules automated fee-related tasks: due-date reminders, late-fee application, automatic defaulter reports, end-of-term reconciliation runs. Used by admin to set up recurring automation without manual triggers.

## 2. Screens

### Fees Scheduler (`/fees/scheduler`)
Rendered by `ModuleCategoryPage` with `categoryKey="schedular"` (note: DB spelling typo — `schedular` instead of `scheduler`) and `platformModuleKey="fees"`.

The page renders scheduler jobs scoped to the fees module via the Platform Services Scheduler registry. Available job types are defined in `config/platform_services.php` under the `scheduler` service for the `fees` module.

![](./screenshots/fees-scheduler.png)

## 3. Features & business rules

**`categoryKey = "schedular"` (typo is intentional — matches the DB `tblmenumaster` entry and `platform_services.php` key).** Do not correct the spelling without a coordinated migration.

**Scheduler jobs available for fees:**

| Job key | Trigger | Action |
|---|---|---|
| `fees_due_reminder` | Daily / N days before due date | Send fee reminder SMS/email to pending families |
| `late_fee_apply` | Daily after due date | Calculate and apply late fee charges per `fees_config_master.late_fees_amount` |
| `defaulter_report` | Weekly / Monthly | Generate defaulter report and email to admin |
| `end_of_term_reconcile` | Term-end date | Auto-reconcile collected vs expected fees |

**Job configuration fields:**
- `cron_expression` — standard 5-part cron string.
- `enabled` — toggle.
- `parameters` — JSON blob (e.g. `{ "days_before": 3, "min_outstanding": 500 }`).
- `last_run_at` — timestamp of last execution.
- `next_run_at` — computed from cron expression.

**Late fee application rule:** Reads `fees_config_master.late_fees_amount` as the per-day penalty amount. Applied to `fees_collect` rows where the due date has passed and `is_deleted = 0`.

## 4. User flows

**Happy path — set up due-date reminder:**
1. Navigate to `/fees/scheduler`.
2. Find "Fee Due Reminder" job card.
3. Set `days_before = 3`, enable toggle.
4. Save → `POST /api/platform-services/scheduler/fees/fees_due_reminder`.
5. Scheduler runs daily at the configured time and sends reminders 3 days before each due date.

**Happy path — apply late fees automatically:**
1. Enable "Late Fee Apply" job.
2. Set cron to run at 00:01 daily.
3. After due date, the job applies the late fee amount from config.

**Alternate — Platform Services Scheduler not active:**
- UI shows banner: "Scheduler service is not active for this tenant."

## 5. Data model

**Tables (Platform Services Scheduler):**
- `platform_scheduler_jobs` — job definitions per module
- `platform_scheduler_logs` — execution history

**Fees-specific interaction:**
- Late fee job writes to `fees_fine_discount` or updates `fees_collect` (exact table from `feesFineDiscountReportController`).
- Reminder job inserts into the Platform Services notifications queue.

## 6. APIs

| Method | Endpoint | Auth | Notes |
|---|---|---|---|
| GET | `/api/platform-services/scheduler/fees` | JWT (Admin) | List fees scheduler jobs |
| POST | `/api/platform-services/scheduler/fees/{job_key}` | JWT (Admin) | Create / update a scheduler job |
| DELETE | `/api/platform-services/scheduler/fees/{job_key}` | JWT (Admin) | Delete a job |
| POST | `/api/platform-services/scheduler/fees/{job_key}/run` | JWT (Admin) | Manual trigger (for testing) |

## 7. UI components & design tokens

| Component | Source |
|---|---|
| `ModuleCategoryPage` | `app/_components/module-category-page` |
| Scheduler job cards | Rendered inside `ModuleCategoryPage` via Platform Services Scheduler UI |

## 8. Reports & exports
Job execution history visible in Audit Trail. No separate export.

## 9. Test cases

| ID | Scenario | Steps | Expected result | Type |
|---|---|---|---|---|
| FSC-01 | Enable reminder job | Configure + enable → wait for cron | Reminder SMS sent on schedule | Happy |
| FSC-02 | Manual trigger | Click "Run now" on late-fee job | Late fees applied; log entry created | Happy |
| FSC-03 | Disable job | Toggle off | Job no longer executes | Happy |
| FSC-04 | Scheduler service off | Platform Services Scheduler not licensed | Banner shown; no crash | Edge |
| FSC-05 | Invalid cron expression | Enter `* * * *` (4-part) | Validation error | Negative |

## 10. Known issues, limitations & FAQs

- `categoryKey = "schedular"` — typo from the DB `tblmenumaster` entry. Any correction requires a coordinated DB migration + code change.
- Exact cron job behavior depends on the Laravel scheduler (`app/Console/Kernel.php`) being wired up and running.

**FAQ:**
- *"Late fees not being applied automatically"* — check that the Laravel scheduler is running (`php artisan schedule:work` or server cron calling `artisan schedule:run` every minute).
- *"Scheduler page is empty"* — `platform_services.php` may not define scheduler jobs for the fees module in this environment.

## 11. Sales notes

**Selling points:**
1. Zero manual intervention — fees module runs on autopilot after setup.
2. Late fee automation eliminates the daily manual calculation.
3. Scheduled defaulter reports to inbox — admin always informed without logging in.

**Demo flow:**
1. Show the scheduler screen — job cards for reminder and late-fee.
2. Click "Run now" on the reminder job — show it triggers.
3. Explain the cron config (3 days before due date example).

## 12. v1 status & v2 ideas

**v1 complete:** Job configuration, enable/disable, manual trigger.
**v2 ideas:**
- In-app execution log with per-row results (how many students triggered).
- Conditional job: skip reminder if payment already received.
- Fix `schedular` typo in a coordinated migration.

## Source files
- `C:\rajesh\lms_k12\app\fees\scheduler\page.tsx`
- `C:\rajesh\lms_k12\app\_components\module-category-page.tsx`
- `F:\xampp\htdocs\next_lms_erp\config\platform_services.php` (scheduler section, fees module)
- `F:\xampp\htdocs\next_lms_erp\app\Console\Kernel.php`

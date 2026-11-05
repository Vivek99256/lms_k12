# Fees Communication
**Product:** Scholar Core | **Module:** Fees | **Frontend route:** `/fees/communication` | **v1 status:** Complete

| Field | Value |
|---|---|
| Backend routes | `POST /api/fees/communication/*` (via Platform Services Notification) |
| Roles | Admin, Communication Manager |
| Last updated | 2026-11-04 |
| Source commit | 8fe500dc (FE) / 86261072 (BE) |

## 1. Purpose & users
Sends fee-related SMS, email, and push notifications to parents and students — fee reminders, collection confirmations, receipt delivery, and defaulter notices. Admin / communication team configure templates and trigger campaigns.

## 2. Screens

### Fees Communication (`/fees/communication`)
Rendered by `ModuleCategoryPage` with `staticScreens={FEES_COMMUNICATION_SCREENS}`. Each screen in the array maps to a tab/card in the category layout.

**Static screens defined in `app/fees/communication/_screens/communication-screens.tsx`:**

| Screen key | Title | Purpose |
|---|---|---|
| `fee_reminder` | Fee reminder | Bulk SMS/email to families with pending dues |
| `receipt_notification` | Receipt notification | Auto-send receipt after collection |
| `defaulter_notice` | Defaulter notice | Formal notice for long-overdue fees |
| `notification_settings` | Notification settings | Configure SMS gateway, email sender, templates |

### Notification Settings sub-screen
Rendered by `FeesNotificationSettings` component. Configures per-channel settings (SMS / Email / Push) for the fees module.

![](./screenshots/fees-communication.png)

## 3. Features & business rules

**Notification channels:** SMS, Email, Push (depends on Platform Services Notification module being active).

**Fee reminder campaign:**
- Select standard/division or all.
- Filter by outstanding amount threshold.
- Preview count before sending.
- Sends via `NotificationService` (Platform Services).

**Receipt notification:**
- Triggers automatically after a successful `fees_collect` write.
- Template uses `fees_receipt_template` from `fees_config_master`.
- SMS is controlled by `send_sms` flag; email by `send_email` flag in `fees_config_master`.

**Defaulter notice:**
- Generates a formatted notice (PDF or SMS/email) for students beyond a configurable overdue period.
- Overdue threshold configurable in `fees_config_master.late_fees_amount` (days or amount — config-dependent).

**Template variables available in notification templates:**
`{student_name}`, `{enrollment_no}`, `{standard}`, `{division}`, `{amount_due}`, `{receipt_no}`, `{due_date}`, `{institute_name}`.

## 4. User flows

**Happy path — send fee reminder:**
1. Navigate to `/fees/communication` → Fee reminder tab.
2. Select target (all, by standard, by minimum outstanding).
3. Click Preview → shows count of recipients.
4. Click Send → notification dispatched via Platform Services Notification queue.
5. Success count shown in response.

**Happy path — configure receipt notification:**
1. Go to Notification Settings.
2. Enable/disable SMS, email toggles.
3. Edit receipt SMS template.
4. Save → updates `fees_config_master.send_sms` and `send_email`.

**Alternate — Notification module disabled:**
- Send buttons are disabled; info banner: "Platform Services Notification is not active."

## 5. Data model

**`fees_config_master` (notification-relevant fields):**

| Column | Notes |
|---|---|
| `send_sms` | 1 / 0 — send SMS on collection |
| `send_email` | 1 / 0 — send email on collection |
| `fees_receipt_template` | Receipt template key |

**Notification queue:** Managed by Platform Services Notification module (`notifications` table). Fees inserts rows; Notification service dispatches them.

## 6. APIs

| Method | Endpoint | Auth | Notes |
|---|---|---|---|
| POST | `/api/fees/communication/reminder/send` | JWT (Admin) | Sends fee reminder to filtered list |
| GET | `/api/fees/communication/settings` | JWT | Get notification config |
| POST | `/api/fees/communication/settings/save` | JWT (Admin) | Save notification config |
| POST | `/api/fees/communication/defaulter-notice/send` | JWT (Admin) | Send defaulter notice |

## 7. UI components & design tokens

| Component | Source |
|---|---|
| `ModuleCategoryPage` | `app/_components/module-category-page` |
| `FeesNotificationSettings` | `app/fees/communication/_components/fees-notification-settings` |
| `Switch` | `components/ui/switch` |
| `Textarea` | `components/ui/textarea` |

## 8. Reports & exports
No separate report. Send logs visible in Audit Trail.

## 9. Test cases

| ID | Scenario | Steps | Expected result | Type |
|---|---|---|---|---|
| FCC-01 | Send fee reminder | Select all → Send | Notification rows created in queue | Happy |
| FCC-02 | Receipt auto-notification | Collect fee with SMS enabled | SMS dispatched after collection | Happy |
| FCC-03 | Notification disabled | `send_sms = 0` | No SMS sent | Edge |
| FCC-04 | Notification module off | Platform Services Notification inactive | UI shows disabled state; no crash | Edge |
| FCC-05 | Template with invalid variable | `{unknown_var}` in template | Sent as literal or silently removed | Negative |

## 10. Known issues, limitations & FAQs

- Communication screens are defined as a static array in `communication-screens.tsx` — adding a new screen requires a code change.
- No delivery status tracking in v1 (sent ≠ delivered).
- Template editor is basic — no rich text or preview with live data.

**FAQ:**
- *"Parents not receiving SMS"* — check `send_sms = 1` in Fees Config Master and that the SMS gateway is configured in Platform Services.
- *"Receipt email not sending"* — check `send_email = 1` and that `fees_receipt_template` is set.

## 11. Sales notes

**Selling points:**
1. Automated receipt delivery — zero manual work after every collection.
2. Bulk fee reminder campaign — one click reaches all defaulters.
3. Formal defaulter notice generation — reduces manual follow-up calls.

**Demo flow:**
1. Show Notification Settings — toggle SMS on.
2. Go to Fee Reminder — set filter, click Preview (show count), click Send.
3. Explain that receipt SMS fires automatically on each collection.

## 12. v1 status & v2 ideas

**v1 complete:** Reminder campaigns, receipt auto-notification, defaulter notice, notification settings.
**v2 ideas:**
- Delivery status dashboard (sent / delivered / failed per campaign).
- WhatsApp Business API channel.
- Scheduled reminders (send on a specific date, not on-demand).

## Source files
- `C:\rajesh\lms_k12\app\fees\communication\page.tsx`
- `C:\rajesh\lms_k12\app\fees\communication\_screens\communication-screens.tsx`
- `C:\rajesh\lms_k12\app\fees\communication\_components\fees-notification-settings.tsx`
- `C:\rajesh\lms_k12\app\_components\module-category-page.tsx`
- `F:\xampp\htdocs\next_lms_erp\app\Http\Controllers\fees\communication\` (controllers)

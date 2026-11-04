# Push Notifications (Send to Parents)
**Product:** Scholar Core | **Module:** Communication (Easy Com) | **Frontend route:** `/easy_com/send_notification_parents`, `/easy_com/notification_report` | **v1 status:** Complete

| Field | Value |
|---|---|
| Backend routes | `POST api/easy_com/send-notification-parents`, `GET api/easy_com/send-notification-parents/options` |
| Roles | Admin, Communication Staff |
| Last updated | 2026-11-04 |
| Source commit | 8fe500dc (FE) / 86261072 (BE) |

## 1. Purpose & users
Sends in-app push notifications to parents via FCM (Firebase Cloud Messaging). Used for instant alerts, homework reminders, event notifications. Parents must have the school mobile app installed and registered.

## 2. Screens

### Send Notification — Parents (`/easy_com/send_notification_parents`)
Shared `EntryPage` with `academicYear: true` flag. Includes academic year filter in addition to standard/division. Contact column shows mobile number. Message field labelled "Notification text", max 1000 chars.

### Notification Report (`/easy_com/notification_report`)
Log of sent push notifications with delivery status.

## 3. Features & business rules

| Field | Type | Required | Validation | Default |
|---|---|---|---|---|
| Academic year | Dropdown | No | Loaded from `send-notification-parents/options` | Current year |
| Standard / Division | Dropdown | Yes | — | — |
| Recipients | Checkbox list | Yes | Keyed by contact (mobile) | All selected |
| Notification text | Textarea | Yes | Max 1000 chars | — |

Recipients only receive notifications if they have a valid FCM token registered in `gcm_users`. Those without a token are skipped.

## 4. User flows
1. Select academic year (optional), standard, division.
2. Load recipients.
3. Type notification text.
4. Send — summary shows sent / skipped (no FCM token).

## 5. Data model

| Table | Key columns | Notes |
|---|---|---|
| `app_notification` | id, sub_institute_id, student_id, message, sent_at, type | Student/parent notification log |
| `app_notification_teacher` | id, sub_institute_id, teacher_id, message, sent_at | Teacher notification log |
| `gcm_users` | id, sub_institute_id, student_id, gcm_token, platform, created_at | FCM device tokens |

## 6. APIs

| Method | Endpoint | Auth | Request | Response |
|---|---|---|---|---|
| GET | `api/easy_com/send-notification-parents/options` | JWT | — | `{ data: { academicYears[] } }` |
| GET | `api/easy_com/send-notification-parents/recipients` | JWT | standard, division, academicYear | `{ data: Recipient[] }` |
| POST | `api/easy_com/send-notification-parents` | JWT | `{ sendNotification[], notificationText }` | send summary |

## 7. UI components & design tokens
- Shared `EntryPage` (`BellRing` icon)
- Lucide: `BellRing`

## 8. Reports & exports
- `/easy_com/notification_report` — sent log

## 9. Test cases

| ID | Scenario | Steps | Expected result | Type |
|---|---|---|---|---|
| TC-NOTIF-01 | Send push to class with all tokens | Select class, send | All delivered | Happy |
| TC-NOTIF-02 | Parent has no FCM token | Send | Skipped with reason | Edge |
| TC-NOTIF-03 | Text > 1000 chars | Type long text | Truncated / error | Edge |

## 10. Known issues, limitations & FAQs
- Parents must have the mobile app installed; no fallback channel in v1.
- **FAQ:** Why did a parent not receive the notification? They may not have the app installed or have denied notification permissions.

## 11. Sales notes
- Instant zero-cost notifications to parents with the app installed.
- Works offline-queue; delivers when the app is next opened.

## 12. v1 status & v2 ideas
- **Complete:** Send to parents by class.
- **v2 ideas:** Deep-link notifications (tap to open homework), scheduled push, topic-based subscriptions.

## Source files
- `C:\rajesh\lms_k12\app\easy_com\send_notification_parents\page.tsx`
- `C:\rajesh\lms_k12\app\easy_com\_components\EntryPage.tsx`
- `F:\xampp\htdocs\next_lms_erp\database\migrations\2023_03_05_115658_create_app_notification_table.php`
- `F:\xampp\htdocs\next_lms_erp\database\migrations\2023_03_05_115658_create_gcm_users_table.php`

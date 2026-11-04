# SMS & Email (Send to Parents / Staff)
**Product:** Scholar Core | **Module:** Communication (Easy Com) | **Frontend route:** `/easy_com/send_sms_parents`, `/easy_com/send_email_parents`, `/easy_com/send_sms_staff` | **v1 status:** Complete

| Field | Value |
|---|---|
| Backend routes | `POST api/easy_com/send-sms-parents`, `POST api/easy_com/send-email-parents`, `POST api/easy_com/send-sms-staff` |
| Roles | Admin, Communication Staff, Class Teacher |
| Last updated | 2026-11-04 |
| Source commit | 8fe500dc (FE) / 86261072 (BE) |

## 1. Purpose & users
Allows school staff to send bulk SMS or email messages to parents (or staff groups) for a selected class. Used for announcements, reminders, event notices, and emergency alerts. Class teachers use it for their own division; admins use it across all classes.

## 2. Screens

### Send SMS — Parents (`/easy_com/send_sms_parents`)
Shared `EntryPage` component. User selects academic section (grade / standard / division), loads recipient list, selects individual recipients by checkbox, composes message (max 1000 characters), and sends.

### Send Email — Parents (`/easy_com/send_email_parents`)
Same `EntryPage` with `email: true` flag. Additional fields: subject line, rich-text body, optional attachment. Contact column shows email address.

### Send SMS — Staff (`/easy_com/send_sms_staff`)
Same `EntryPage` with `staff: true` flag. Filter is staff group dropdown (fetched from `send-sms-staff/groups`) instead of class filter.

### Reports
- `/easy_com/send_sms_report` — paginated log of sent SMS
- `/easy_com/email_report` — paginated log of sent emails

## 3. Features & business rules

### SMS
| Field | Type | Required | Validation | Default |
|---|---|---|---|---|
| Standard / Division | Dropdown (SearchDropdown) | Yes | Must select before searching | — |
| Recipients | Checkbox list | Yes (at least one) | Loaded from backend | All selected |
| SMS text | Textarea | Yes | Max 1000 chars | — |

### Email
| Field | Type | Required | Validation | Default |
|---|---|---|---|---|
| Standard / Division | Dropdown | Yes | — | — |
| Recipients | Checkbox list | Yes | — | All selected |
| Email content | Rich text / textarea | Yes | No max set in FE | — |
| Subject | Text | No | — | — |
| Attachment | File | No | Validated by MAX_UPLOAD_BYTES | — |

**Permission:** Staff can only message within their assigned institute (tenant-scoped via JWT). No role-based send restriction found in FE code; controlled by `tblgroupwise_rights` on the menu.

**Send summary:** Response includes `{ sent, requested, failed[], skipped[] }`. FE shows a `SendSummary` panel with per-recipient failure reasons.

## 4. User flows

**Happy path — SMS to parents:**
1. Open Send SMS Parents.
2. Select Grade → Standard → Division.
3. Click "Search" — recipient list loads with names and mobile numbers.
4. Optionally deselect recipients.
5. Type SMS text.
6. Click "Send" — spinner shows, summary panel appears with sent/failed counts.

**Alternate — Send to Staff:**
1. Select staff group from dropdown.
2. Recipient list loads.
3. Compose and send as above.

## 5. Data model

| Table | Key columns | Notes |
|---|---|---|
| `email_sent_parents` | id, sub_institute_id, standard_id, division_id, message, sent_by, sent_at, status | Sent email log |
| `gcm_users` | id, sub_institute_id, student_id, gcm_token, platform | Push / FCM registration tokens |

SMS send logs: stored server-side via SMS provider; local log table TBD (not found in migrations).

## 6. APIs

| Method | Endpoint | Auth | Request | Response |
|---|---|---|---|---|
| GET | `api/easy_com/send-sms-parents/recipients` | JWT | standard, division, section params | `{ data: Recipient[] }` |
| POST | `api/easy_com/send-sms-parents` | JWT | `{ sendsms[], smsText }` | `{ success, message, data: { sent, requested, failed[], skipped[] } }` |
| GET | `api/easy_com/send-email-parents/recipients` | JWT | standard, division params | `{ data: Recipient[] }` |
| POST | `api/easy_com/send-email-parents` | JWT | multipart: `sendsms[], content, subject, attachment` | `{ success, message, data: summary }` |
| GET | `api/easy_com/send-sms-staff/groups` | JWT | — | `{ data: [{ id, name }] }` |
| POST | `api/easy_com/send-sms-staff` | JWT | `{ sendsms[], smsText, group_id }` | `{ success, message, data: summary }` |

## 7. UI components & design tokens
- `EntryPage` (shared `easy_com/_components/EntryPage.tsx`) — drives all send screens
- `SearchDropdown` — class / section filter
- `Checkbox`, `EmptyState`, `Button`, `Textarea`, `Input` from design system
- `AiFieldAssistant` — AI message drafting helper on message field
- `SendSummary` — post-send result panel
- Lucide icons: `MessageSquareText`, `Mail`, `Send`, `Search`

## 8. Reports & exports
- SMS report: `/easy_com/send_sms_report`
- Email report: `/easy_com/email_report`
- Register parent report: `/easy_com/register_parent_report`

## 9. Test cases

| ID | Scenario | Steps | Expected result | Type |
|---|---|---|---|---|
| TC-COM-01 | Send SMS to all parents of Std 5-A | Select class, load, send | Summary shows sent = recipient count | Happy |
| TC-COM-02 | Send with no recipients selected | Deselect all, click Send | Validation error or empty send prevented | Negative |
| TC-COM-03 | SMS text exceeds 1000 chars | Type > 1000 chars | Input truncated or error shown | Edge |
| TC-COM-04 | Send email with attachment | Attach file, send | Email delivered with attachment | Happy |
| TC-COM-05 | SMS provider not configured | Send SMS | Per-recipient "skipped – provider not configured" in summary | Edge |

## 10. Known issues, limitations & FAQs

- SMS send log table not confirmed in migrations; reporting may rely on the SMS provider's delivery records.
- Attachment validation relies on `MAX_UPLOAD_BYTES` env var; file type validation not visible in FE code.
- **FAQ:** Can I schedule an SMS for later? No — sends are immediate. Scheduling is via the Fees scheduler for fee reminders only.
- **FAQ:** Can I send to individual parents? No — selection is class-level with per-student checkbox opt-out.

## 11. Sales notes
- **Selling point:** One screen to reach all parents of a class by SMS, email or WhatsApp in under a minute.
- **Demo flow:** Select Std 10-B → load recipients (30 parents) → type "Exam tomorrow 9 AM" → send → show summary (28 sent, 2 no mobile).
- **Plan/pricing:** TBD

## 12. v1 status & v2 ideas
- **Complete:** SMS to parents, email to parents, SMS to staff.
- **v2 ideas:** Schedule sends, delivery receipts from provider, reply tracking, send history per student.

## Source files
- `C:\rajesh\lms_k12\app\easy_com\send_sms_parents\page.tsx`
- `C:\rajesh\lms_k12\app\easy_com\send_email_parents\page.tsx`
- `C:\rajesh\lms_k12\app\easy_com\send_sms_staff\page.tsx`
- `C:\rajesh\lms_k12\app\easy_com\_components\EntryPage.tsx`
- `C:\rajesh\lms_k12\app\easy_com\_lib\api.ts`
- `F:\xampp\htdocs\next_lms_erp\app\Http\Controllers\easy_com\send_email_parents\`
- `F:\xampp\htdocs\next_lms_erp\database\migrations\2023_03_05_115658_create_email_sent_parents_table.php`

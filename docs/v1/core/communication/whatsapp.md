# WhatsApp (Send to Parents)
**Product:** Scholar Core | **Module:** Communication (Easy Com) | **Frontend route:** `/easy_com/send_whatsapp_parents`, `/easy_com/whatsapp_api`, `/easy_com/whatsapp_report` | **v1 status:** Complete

| Field | Value |
|---|---|
| Backend routes | `POST api/easy_com/send-whatsapp-parents`, webhook `GET/POST api/whatsapp/webhook` |
| Roles | Admin, Communication Staff |
| Last updated | 2026-11-04 |
| Source commit | 8fe500dc (FE) / 86261072 (BE) |

## 1. Purpose & users
Sends WhatsApp Cloud API messages to parents of a selected class. Also handles inbound WhatsApp messages from parents (CRM view). Requires a configured WhatsApp Business API provider.

## 2. Screens

### Send WhatsApp — Parents (`/easy_com/send_whatsapp_parents`)
Same shared `EntryPage` component. `selectionKey: 'studentId'`, `contactLabel: 'WhatsApp mobile'`. Filter by standard/division, load recipients, compose message, send.

### WhatsApp API Settings (`/easy_com/whatsapp_api`)
Configuration screen for WhatsApp Business API credentials (phone number ID, token). TBD — full implementation not read.

### WhatsApp Report (`/easy_com/whatsapp_report`)
Log of sent WhatsApp messages with delivery status.

## 3. Features & business rules

| Field | Type | Required | Validation | Default |
|---|---|---|---|---|
| Standard / Division | Dropdown | Yes | — | — |
| Recipients | Checkbox list | Yes | Keyed by student ID | All selected |
| Message | Textarea | Yes | No max set in FE | — |

Inbound messages handled by `WhatsappWebhookController`: webhook verification (GET) and message receipt (POST). Incoming messages stored in `incoming_messages` table. CRM view available at `/easy_com/intelligence`.

**Delivery tracking:** `WhatsappController@updateDeliveryStatus` updates `whatsapp_sent_messages.status` on delivery callbacks from the provider.

## 4. User flows

**Send:**
1. Select class → load recipients → compose message → send.
2. Response shows send summary (sent / skipped — skipped if no WhatsApp number).

**Inbound:**
1. Parent replies on WhatsApp → provider sends webhook POST.
2. `WhatsappWebhookController` stores to `incoming_messages`.
3. Staff views conversation in CRM view.

## 5. Data model

| Table | Key columns | Notes |
|---|---|---|
| `whatsapp_sent_messages` | id, sub_institute_id, student_id, mobile, message, status, sent_at | Outbound log |
| `incoming_messages` | id, sub_institute_id, from_number, message, received_at | Inbound from parents |

Columns added in `2024_08_22` and `2024_09_05` migrations (delivery receipt fields).

## 6. APIs

| Method | Endpoint | Auth | Request | Response |
|---|---|---|---|---|
| GET | `api/easy_com/send-whatsapp-parents/recipients` | JWT | standard, division | `{ data: Recipient[] }` |
| POST | `api/easy_com/send-whatsapp-parents` | JWT | `{ sendNotification[], message }` | send summary |
| POST | `api/update-message` | Webhook (provider) | delivery status | 200 OK |
| GET | `api/whatsapp/webhook` | Query param token | provider verification | challenge string |
| POST | `api/whatsapp/webhook` | — | inbound message payload | 200 OK |

## 7. UI components & design tokens
- Shared `EntryPage` component (`MessageCircleMore` icon)
- Lucide: `MessageCircleMore`

## 8. Reports & exports
- `/easy_com/whatsapp_report` — sent messages log with status

## 9. Test cases

| ID | Scenario | Steps | Expected result | Type |
|---|---|---|---|---|
| TC-WA-01 | Send WhatsApp to class | Select class → send | Summary shows sent count | Happy |
| TC-WA-02 | Student has no WhatsApp number | Send to such a student | Skipped with reason in summary | Edge |
| TC-WA-03 | Provider not configured | Attempt send | Skipped / error response | Negative |
| TC-WA-04 | Inbound message received | Parent replies | Stored in incoming_messages | Happy |

## 10. Known issues, limitations & FAQs
- WhatsApp API requires pre-approved message templates for certain message types (business policy). Template management TBD.
- **FAQ:** Can parents reply and have a conversation? Read via CRM view; two-way conversation UI is not a full chat interface in v1.

## 11. Sales notes
- Highest open-rate channel for parent communication.
- Demo: send "School closed tomorrow" to all Std 1 parents in 30 seconds.

## 12. v1 status & v2 ideas
- **Complete:** Outbound send, inbound receive, delivery status tracking.
- **v2 ideas:** Template library, two-way conversation threads, automated replies.

## Source files
- `C:\rajesh\lms_k12\app\easy_com\send_whatsapp_parents\page.tsx`
- `C:\rajesh\lms_k12\app\easy_com\_components\EntryPage.tsx`
- `F:\xampp\htdocs\next_lms_erp\app\Http\Controllers\WhatsappController.php`
- `F:\xampp\htdocs\next_lms_erp\database\migrations\2024_04_08_150853_create_whatsapp_sent_messages_table.php`

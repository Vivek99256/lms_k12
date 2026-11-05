# Integrations

Last updated: 2026-11-04
Generated from commit: `8fe500dc` (frontend) / `86261072` (backend)

**Product:** Shared Platform | **Module:** Integrations | **v1 status:** Partial

## 1. Purpose & users

Integrations connects Scholar Suite to third-party services: payment gateways, messaging providers, biometric devices, Google Workspace, and the K12 mobile app. Each integration is configured once and used across modules.

Used by: Admin, Super Admin.

## 2. Integrations catalog

### 2.1 Payment Gateways

| Gateway | Status | Used by |
|---|---|---|
| Razorpay | v1 complete | Fees → Online Payment |
| PayU | v1 complete | Fees → Online Payment |
| CCAvenue | Partial | Fees → Online Payment |
| NACH / eMandate | v1 complete | Fees → NACH module |

**How it works:** Gateway credentials stored server-side. The frontend redirects to the gateway's hosted checkout or loads their JS SDK. Payment confirmation webhook received by Laravel; fee record updated atomically.

---

### 2.2 SMS Gateways

| Provider | Status |
|---|---|
| MSG91 | v1 complete |
| 2Factor | v1 complete |
| Textlocal | v1 complete |

Credentials configured at `/general/sms_gateway`. Used by Notification service for SMS events.

---

### 2.3 WhatsApp Business

| Provider | Status |
|---|---|
| Gupshup | v1 complete |
| 2Factor WhatsApp | v1 complete |

Credentials at `/general/whatsapp_settings`. Inbound messages stored in `incoming_messages` table. Outbound via REST API call from platform notification service.

---

### 2.4 Email (SMTP)

Configured at `/general/email_settings`. All transactional emails (fee receipts, result notifications, admission confirmations) route through this. No proprietary email provider — any SMTP server works.

---

### 2.5 Google OAuth

Configured via `NEXT_PUBLIC_GOOGLE_CLIENT_ID`. Allows "Sign in with Google" on the login page. See [auth.md](./auth.md).

---

### 2.6 FCM (Firebase Cloud Messaging)

Mobile push notifications. FCM tokens stored per-user in `gcm_users` table. Sent by the Notification service when a push event fires.

---

### 2.7 Biometric Devices

| Integration | Status |
|---|---|
| Attendance via biometric device | v1 partial |

Staff attendance can be synced from biometric (fingerprint/face) devices. The integration reads device logs and updates `tbl_staff_attendance`. Specific device models supported depend on the school's hardware.

---

### 2.8 K12 Mobile App (WebView handoff)

The K12 mobile app can open web screens in a WebView with a single-use ticket. The ticket exchange flow is documented in [auth.md](./auth.md) under "Mobile WebView handoff".

---

### 2.9 AI Provider (Google Gemini)

Configured server-side in `config/ai.php` (Laravel). The frontend never holds API keys. All AI calls route through `/api/ai/ask/stream` on Next.js, which proxies to Laravel, which calls the model.

## 3. Data model

| Table | Purpose |
|---|---|
| `tblsmsgateway` | SMS provider credentials |
| `tblwhatsappconfig` | WhatsApp credentials |
| `gcm_users` | FCM push tokens per user |
| `email_sent_parents` | Email delivery log |
| `whatsapp_sent_messages` | WhatsApp outbound log |
| `incoming_messages` | WhatsApp inbound log |
| `ai_api_keys` | AI provider keys (write-only; read returns masked preview) |

## 4. Known issues & v2 ideas

**Known issues:**
- Payment gateway webhooks do not have retry logic — a failed webhook can leave a payment unconfirmed.
- Biometric sync is manual (admin-triggered); not real-time.

**v2 ideas:** Webhook retry queue, real-time biometric sync via persistent connection, Zapier/webhook outbound integration for custom automations, Microsoft 365 SSO.

## Source files

- `F:\xampp\htdocs\next_lms_erp\app\Http\Controllers\api\apiController.php`
- `F:\xampp\htdocs\next_lms_erp\config\ai.php`
- `C:\rajesh\lms_k12\app\integration\`

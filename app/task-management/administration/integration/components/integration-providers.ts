/**
 * Integration Providers — static registry.
 *
 * Add new providers here; the shell, cards and config forms render
 * dynamically from this list, so no core UI changes are needed to support
 * additional integrations. Every provider's `route` is the nested
 * /integration path its card navigates to — see app/integration (routes).
 */

import type { IntegrationProviderDef } from '@/app/task-management/_lib/integration-types'

export const INTEGRATION_PROVIDERS: IntegrationProviderDef[] = [
  // ── Communication ──────────────────────────────────────────────────────
  {
    key: 'sms_gateway',
    name: 'SMS Gateway',
    category: 'Communication',
    description: 'Generic SMS gateway for sending transactional and promotional text messages.',
    icon: 'MessageSquare',
    // Reuses the existing /easy_com/sms_api screen and API.
    route: '/integration/sms-gateway',
    fields: [
      { key: 'api_key', label: 'API Key', type: 'password', required: true, placeholder: 'Enter API key' },
      { key: 'sender_id', label: 'Sender ID', type: 'text', required: true, placeholder: 'e.g. TXTSCHL' },
      { key: 'route', label: 'Route', type: 'select', options: [
        { label: 'Transactional', value: 'transactional' },
        { label: 'Promotional', value: 'promotional' },
      ]},
      { key: 'country', label: 'Country', type: 'text', required: true, placeholder: 'e.g. IN, US' },
    ],
  },
  {
    key: 'whatsapp_api',
    name: 'WhatsApp API',
    category: 'Communication',
    description: 'WhatsApp Business API for customer messaging and notifications.',
    icon: 'MessageCircle',
    // Reuses the existing /easy_com/whatsapp_api screen and API.
    route: '/integration/whatsapp-api',
    fields: [
      { key: 'access_token', label: 'Access Token', type: 'password', required: true, placeholder: 'Enter access token' },
      { key: 'phone_number_id', label: 'Phone Number ID', type: 'text', required: true, placeholder: 'Enter phone number ID' },
      { key: 'business_account_id', label: 'Business Account ID', type: 'text', required: true, placeholder: 'Enter business account ID' },
      { key: 'webhook_url', label: 'Webhook URL', type: 'text', required: true, placeholder: 'https://example.com/webhook' },
    ],
  },
  {
    key: 'email_smtp',
    name: 'Email SMTP',
    category: 'Communication',
    description: 'Standard SMTP email service for transactional and bulk emails.',
    icon: 'Mail',
    // Reuses the existing /easy_com/smtp screen and API.
    route: '/integration/email-smtp',
    fields: [
      { key: 'host', label: 'Host', type: 'text', required: true, placeholder: 'smtp.example.com' },
      { key: 'port', label: 'Port', type: 'number', required: true, placeholder: '587' },
      { key: 'username', label: 'Username', type: 'text', required: true, placeholder: 'user@example.com' },
      { key: 'password', label: 'Password', type: 'password', required: true, placeholder: 'Enter password' },
      { key: 'encryption', label: 'Encryption Type', type: 'select', options: [
        { label: 'None', value: 'none' },
        { label: 'TLS', value: 'tls' },
        { label: 'SSL', value: 'ssl' },
      ]},
      { key: 'from_email', label: 'From Email', type: 'text', required: true, placeholder: 'noreply@example.com' },
      { key: 'from_name', label: 'From Name', type: 'text', required: true, placeholder: 'Your Institution Name' },
    ],
  },
  {
    key: 'push_notification',
    name: 'Push Notification Service',
    category: 'Communication',
    description: 'Firebase Cloud Messaging or similar push notification service.',
    icon: 'Bell',
    // No dedicated settings screen exists yet — placeholder config page
    // built from the same generic IntegrationConfigForm as every other
    // unimplemented provider, not a new one-off form.
    route: '/integration/push-notification',
    fields: [
      { key: 'service_account_key', label: 'Service Account Key (JSON)', type: 'textarea', required: true, placeholder: 'Paste your service account JSON key here...' },
      { key: 'project_id', label: 'Project ID', type: 'text', required: true, placeholder: 'my-project-id' },
    ],
  },

  // ── Payment Gateways ───────────────────────────────────────────────────
  {
    key: 'razorpay',
    name: 'Razorpay',
    category: 'Payment Gateways',
    description: 'Razorpay payment gateway for Indian payment processing.',
    icon: 'CreditCard',
    // Real settings live in the Fees module's online-fees-settings screen
    // (shared with HDFC, ICICI, Axis, AggrePay and PayPhi) — reused here
    // instead of duplicated, so this card navigates there rather than
    // opening the generic config form below.
    route: '/integration/online-fees-settings',
    fields: [
      { key: 'key_id', label: 'Key ID', type: 'text', required: true, placeholder: 'rzp_live_...' },
      { key: 'key_secret', label: 'Key Secret', type: 'password', required: true, placeholder: 'Enter key secret' },
      { key: 'webhook_secret', label: 'Webhook Secret', type: 'password', required: true, placeholder: 'Enter webhook secret' },
    ],
  },

  // ── Attendance Systems ─────────────────────────────────────────────────
  {
    key: 'biometric_attendance',
    name: 'Biometric Attendance',
    category: 'Attendance Systems',
    description: 'Connect biometric attendance devices to automatically sync employee and student attendance records.',
    icon: 'Fingerprint',
    // No dedicated settings screen exists yet — same placeholder pattern as
    // Push Notification, above.
    route: '/integration/biometric-attendance',
    fields: [
      { key: 'device_ip', label: 'Device IP Address', type: 'text', required: true, placeholder: 'e.g. 192.168.1.50' },
      { key: 'device_port', label: 'Device Port', type: 'number', required: true, placeholder: 'e.g. 4370' },
      { key: 'device_serial_number', label: 'Device Serial Number', type: 'text', required: true, placeholder: 'Enter device serial number' },
      { key: 'sync_interval', label: 'Sync Interval', type: 'select', options: [
        { label: 'Every 5 minutes', value: '5' },
        { label: 'Every 15 minutes', value: '15' },
        { label: 'Every 30 minutes', value: '30' },
        { label: 'Every 60 minutes', value: '60' },
      ]},
    ],
  },
]

export const INTEGRATION_CATEGORIES = Array.from(
  new Set(INTEGRATION_PROVIDERS.map((p) => p.category)),
)
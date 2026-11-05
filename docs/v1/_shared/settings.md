# Settings

Last updated: 2026-11-04
Generated from commit: `8fe500dc` (frontend) / `86261072` (backend)

**Product:** Shared Platform | **Module:** Settings | **v1 status:** Complete

## 1. Purpose & users

Settings covers all institute-wide configuration: branding, academic calendar, SMS/email credentials, payment gateway keys, and feature toggles. Changes here affect every user in the institute.

Used by: Super Admin, Admin.

## 2. Screens

| Screen | Route | Description |
|---|---|---|
| Institute Profile | `/general/institute_profile` | Name, logo, address, contact |
| Academic Year Setup | `/general/academic_year` | Define academic years |
| Academic Term Setup | `/general/academic_term` | Define terms/semesters per year |
| SMS Gateway | `/general/sms_gateway` | Configure SMS provider credentials |
| Email Settings | `/general/email_settings` | SMTP/email gateway credentials |
| WhatsApp Settings | `/general/whatsapp_settings` | WhatsApp Business credentials |
| Payment Gateway | `/general/payment_gateway` | Online fee payment credentials |
| Notification Preferences | `/platform-services/notification` | Per-event channel on/off/locked |
| Scheduler Config | `/platform-services/scheduler` | Enable/disable and override cron schedules |
| Workflow Config | `/platform-services/workflow` | Customize approval chains |

## 3. Features & business rules

### Academic year / term

- Academic years and terms define the temporal scope for all data: fees, attendance, results, timetables.
- The active academic year is stored in `selectedAcademicYear` localStorage key; changed by the Header year switcher.
- Term IDs are passed in every API call that is scoped to a term (`termId` in `SessionContext`).
- Multiple institutes (sub-institutes) under one client can have different academic year calendars.

### Branding

- Institute logo is stored server-side; returned as `logo` in the login payload and displayed in the Header.
- School name appears in report headers, certificates, and ID cards.

### SMS/Email/WhatsApp credentials

- Stored encrypted on the backend.
- Never returned to the frontend in full; only connection status is shown.
- WhatsApp: requires a WhatsApp Business API provider (e.g. Gupshup, 2Factor). The platform sends messages via the provider's REST API.

### Payment gateway

- Supported gateways depend on the `fees.online_payment` module configuration.
- Credentials (API key, merchant ID) stored server-side only.

## 4. Data model

| Table | Purpose |
|---|---|
| `tblsubinstitutionmaster` | Institute master: name, address, logo path |
| `tblacademicyearmaster` | Academic year definitions |
| `tblacademictermmaster` | Term/semester definitions per year |
| `tblsmsgateway` | SMS provider credentials |
| `tblwhatsappconfig` | WhatsApp API credentials |
| `tblpaymentgateway` | Payment gateway credentials |

## 5. Test cases

| ID | Scenario | Expected result | Type |
|---|---|---|---|
| S-01 | Change institute logo | New logo appears in header and reports | Happy |
| S-02 | Add academic year | Year appears in year switcher | Happy |
| S-03 | Configure SMS gateway | Test SMS sent; logs success | Happy |
| S-04 | Invalid SMTP credentials | Error shown; email not sent | Negative |

## 6. Known issues & v2 ideas

**v2 ideas:** Multi-language support, custom theme per institute, feature-flag UI for beta features, credential health check (automated test of gateway connectivity).

## Source files

- `F:\xampp\htdocs\next_lms_erp\app\Http\Controllers\api\instituteController.php`
- `F:\xampp\htdocs\next_lms_erp\app\Http\Controllers\api\academicYearController.php`
- `C:\rajesh\lms_k12\app\general\`

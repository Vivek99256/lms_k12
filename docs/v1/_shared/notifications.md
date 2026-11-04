# Notifications

Product | Module | Frontend route | Backend routes | Roles | v1 status
--- | --- | --- | --- | --- | ---
Shared Platform | Notifications | `/platform-services/notification`, `/platform-services/notification/log` | Platform notification APIs (registry driven) | Admin, Super Admin | Complete

Last updated: 2025-11-04  
Generated from commit: `8fe500dc` (frontend) / `86261072` (backend)

## 1. Purpose & users
Central notification service delivering events via web, email, mobile push, SMS, WhatsApp with per-event channel rules.

**Users:** Admin, Super Admin

## 2. Screens
| Screen name | Route | What is shown | Main actions |
|---|---|---|---|
| Notification Config | `/platform-services/notification` | Events by module, channels, on/off/locked | Configure per-event channels |
| Notification Log | `/platform-services/notification/log` | Delivery history/logs | Filter/search delivery logs |

![](./screenshots/notifications.png)

## 3. Features & business rules
**Channels:** web, email, mobile, SMS, WhatsApp  
**States:** on, off, locked  
**Mandatory events:** Cannot be disabled (e.g. fees.receipt.issued, admissions.confirmation.admitted)

**Permission rules:**
| Action | Who can | Notes |
|---|---|---|
| View config/logs | Admin, Super Admin | Read access |
| Configure channels | Super Admin/Admin (per rights) | Affects delivery |

## 4. User flows
**Happy path:** Event fires -> Channels resolved (on/locked) -> Delivered per enabled channels -> Logged  
**Alternate:** Disabled channel skipped; locked always delivered

## 5. Data model
| Table (inferred) | Key columns | Relations | Indexes |
|---|---|---|---|
| platform_notifications_config | module, event_key, channel, status | Per event/channel | (module,event_key,channel) |
| platform_notifications_log | id, event_key, recipient_id, channel, status, sent_at, meta | Delivery log | (event_key,sent_at), (recipient_id) |

## 6. APIs
| Method | Endpoint | Auth/Permission | Request | Response | Error cases |
|---|---|---|---|---|---|
| GET | `/api/platform/registry` | Authenticated | - | notifications[] | 401/403 |
| GET/POST | Notification config/log APIs | Authenticated + rights | Filters/payload | Config/logs | Permission errors |

## 7. UI components & design tokens
Tables, toggles, badges, filters.

## 8. Reports & exports
Notification log is viewable; exports TBD.

## 9. Test cases
| ID | Scenario | Steps | Expected result | Type |
|---|---|---|---|---|
| NT-01 | Configure channel | Toggle event/channel | Saved, applied to future events | happy |
| NT-02 | Mandatory locked | Try disable locked event | Disabled/prevented | negative |
| NT-03 | Delivery logged | Trigger event | Appears in notification log | happy |

## 10. Known issues, limitations & FAQs
**Limitations:** SMS/WhatsApp require credentials/gateway config.  
**FAQ:** Locked events cannot be turned off for compliance/safety.

## 11. Sales notes
**Selling points:** Multi-channel, rule-based, auditable delivery.  
**Demo flow:** Config events -> trigger -> check log.

## 12. v1 status & v2 ideas
**v1:** Complete (channels/rules/logs).  
**v2:** Templates per channel, scheduling, analytics.

## Source files
- Frontend: `C:\rajesh\lms_k12\app\platform-services\notification\**`
- Config: `F:\xampp\htdocs\next_lms_erp\config\platform_services.php`
- Docs: `C:\rajesh\lms_k12\docs\v1\_shared\platform-services.md`, `C:\rajesh\lms_k12\docs\v1\_shared\settings.md`

# Audit Log

Product | Module | Frontend route | Backend routes | Roles | v1 status
--- | --- | --- | --- | --- | ---
Shared Platform | Audit Log | `/platform-services/audit` | Platform audit APIs | Admin, Super Admin, Auditor (as per rights) | Complete

Last updated: 2025-11-04  
Generated from commit: `8fe500dc` (frontend) / `86261072` (backend)

## 1. Purpose & users
Central audit trail for platform and module actions (user, action, entity, IP/context, timestamps).

**Users:** Admin, Super Admin, Auditor

## 2. Screens
| Screen name | Route | What is shown | Main actions |
|---|---|---|---|
| Platform Audit Log | `/platform-services/audit` | Audit entries with filters | Filter, search, view details |

![](./screenshots/audit-log.png)

## 3. Features & business rules
All significant actions logged. Entries retained as per policy.

**Permission rules:**
| Action | Who can | Notes |
|---|---|---|
| View | Admin, Super Admin, Auditor | Read-only |
| Export | As per rights | If enabled |

## 4. User flows
**Happy path:** Action occurs -> Audit entry written -> Visible in audit log with filters

## 5. Data model
| Table (inferred) | Key columns | Relations | Indexes |
|---|---|---|---|
| platform_audit_log | id, user_id, action, module, entity_type, entity_id, ip, user_agent, meta(json), created_at | Links to users | (module,created_at), (user_id,created_at), (entity_type,entity_id) |

## 6. APIs
| Method | Endpoint | Auth/Permission | Request | Response | Error cases |
|---|---|---|---|---|---|
| GET | Platform audit APIs | Authenticated + rights | Filters (date/user/module/entity) | Paginated entries | Permission errors |

## 7. UI components & design tokens
Tables, filters, detail modal.

## 8. Reports & exports
In-screen log; Excel export may be available per rights.

## 9. Test cases
| ID | Scenario | Steps | Expected result | Type |
|---|---|---|---|---|
| AL-01 | Action logged | Perform audited action | Entry appears in log | happy |
| AL-02 | Filter by date/user | Apply filters | Correct results | happy |

## 10. Known issues, limitations & FAQs
**Related:** AI Audit (`insight/ai-admin/ai-audit.md`), Fees Audit Trail (`core/fees/audit-trail.md`)

## 11. Sales notes
**Selling points:** Full traceability, compliance-friendly.  
**Demo flow:** Perform action -> show audit entry.

## 12. v1 status & v2 ideas
**v1:** Complete.  
**v2:** Advanced search, retention policies, alerts.

## Source files
- Frontend: `C:\rajesh\lms_k12\app\platform-services\audit\**`
- Docs: `C:\rajesh\lms_k12\docs\v1\DATA-MODEL.md`, `C:\rajesh\lms_k12\docs\v1\core\fees\audit-trail.md`, `C:\rajesh\lms_k12\docs\v1\insight\ai-admin\ai-audit.md`

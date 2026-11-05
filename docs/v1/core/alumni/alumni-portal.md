# Alumni Portal (Self-Service)
**Product:** Scholar Core | **Module:** Alumni | **Frontend route:** `/alumni-portal/login`, `/alumni-portal/register`, `/alumni-portal/forgot-password`, `/alumni-portal/reset-password`, `/alumni-portal/verify-email`, `/alumni-portal/invite` | **v1 status:** Partial (auth migration not applied to production)

| Field | Value |
|---|---|
| Backend routes | `POST api/alumni-portal/login`, `POST api/alumni-portal/register`, `POST api/alumni-portal/verify-email`, `POST api/alumni-portal/forgot-password`, `POST api/alumni-portal/reset-password`, `POST api/alumni-portal/invite/{token}` |
| Roles | Alumni (self) |
| Last updated | 2026-11-04 |
| Source commit | 8fe500dc (FE) / 86261072 (BE) |

## 1. Purpose & users
Separate self-service portal for alumni. Alumni log in independently from staff ERP using their own account. They can view and update their profile, explore opportunities, and connect with the institution.

## 2. Screens

### Login (`/alumni-portal/login`)
Email + password login. Session stored in `localStorage` under key `alumniPortalSession`. Completely separate from staff ERP session (`auth` key).

### Register (`/alumni-portal/register`)
New alumni self-registration.

### Invite Acceptance (`/alumni-portal/invite`)
Alumni accept a staff-sent invitation link (single-use token).

### Verify Email (`/alumni-portal/verify-email`)
Email verification step after registration.

### Forgot / Reset Password (`/alumni-portal/forgot-password`, `/alumni-portal/reset-password`)
Standard password reset via emailed token.

## 3. Security & auth rules

- Portal tokens are NEVER sent to staff ERP endpoints and vice versa.
- All portal API calls go via `/api/proxy?path=api/alumni-portal/*`.
- Requests include `Authorization: Bearer <portal_token>` or `Authorization: Bearer` (empty) for public endpoints — prevents staff token from riding along.
- Tokens stored only as SHA-256 hash server-side; plaintext token exists only in the emailed link.
- Login session stores hash of current and previous refresh token (for stolen-token detection on rotation).
- Account lockout: `failed_attempts` tracked; `locked_until` set after threshold.
- `alumni_auth_tokens.purpose` values: `invite` | `verify_email` | `reset_password` — single-use each.

**Production status:** Migration `2026_10_14_100000_create_alumni_auth_tables.php` explicitly notes "NOT APPLIED TO PRODUCTION: needs explicit approval." Portal auth is designed but not live.

## 4. User flows

**Staff-invited flow:**
1. Staff sends invite from Alumni Management.
2. Alumni receives email with single-use invite link.
3. Alumni opens `/alumni-portal/invite?token=...` → sets password.
4. Email verified automatically.

**Self-registration flow:**
1. Alumni opens `/alumni-portal/register`.
2. Fills name, email, alumni code or GR number.
3. Receives verification email.
4. Verifies email → account active.

**Staff-side:** Alumni accounts managed from `/alumni/` screens (disable, resend invite, etc.).

## 5. Data model

| Table | Key columns | Notes |
|---|---|---|
| `alumni_accounts` | id, sub_institute_id, alumni_id, email, password_hash, email_verified_at, status (invited/unverified/active/disabled), failed_attempts, locked_until | Portal accounts |
| `alumni_auth_tokens` | id, account_id, purpose, token_hash (sha256), expires_at, used_at | Single-use tokens |
| `alumni_sessions` | (from migration) | Refresh token rotation with previous hash |

## 6. APIs

| Method | Endpoint | Auth | Request | Response |
|---|---|---|---|---|
| POST | `api/alumni-portal/login` | None | `{ email, password, institute_code }` | `{ access, refresh, expiresAt }` |
| POST | `api/alumni-portal/register` | None | `{ name, email, alumni_code/gr_no, ... }` | `{ message }` |
| POST | `api/alumni-portal/verify-email` | Token | `{ token }` | `{ message }` |
| POST | `api/alumni-portal/forgot-password` | None | `{ email }` | `{ message }` |
| POST | `api/alumni-portal/reset-password` | Token | `{ token, password }` | `{ message }` |
| POST | `api/alumni-portal/invite/{token}` | None | `{ password }` | `{ access, refresh, expiresAt }` |

## 7. UI components & design tokens
- `portal-ui.tsx` — custom portal UI components
- `portal-api.ts` — API client with separate token storage

## 8. Reports & exports
N/A (alumni self-service, no reports in portal)

## 9. Test cases

| ID | Scenario | Steps | Expected result | Type |
|---|---|---|---|---|
| TC-PORTAL-01 | Accept invite | Open invite link, set password | Account active, logged in | Happy |
| TC-PORTAL-02 | Use invite token twice | Re-use invite link | Token rejected (single-use) | Negative |
| TC-PORTAL-03 | Login with staff token | Try staff JWT on portal endpoint | Rejected (separate auth) | Security |
| TC-PORTAL-04 | Account lockout | 5 failed logins | Account locked until time | Edge |

## 10. Known issues, limitations & FAQs
- **Auth tables not applied to production** — portal login will fail until migration is run.
- **FAQ:** Can alumni log in now? Not until the production migration is applied.
- **FAQ:** Is the portal a separate app? No — it's part of the same Next.js frontend at different routes, with completely separate session storage.

## 11. Sales notes
- Alumni self-service reduces admin workload for profile updates.
- Self-registration with institute code lookup.

## 12. v1 status & v2 ideas
- **Partial:** Auth designed and built; not live in production pending migration approval.
- **v2 ideas:** Social profile, job board, event registration, donation from portal.

## Source files
- `C:\rajesh\lms_k12\app\alumni-portal\login\page.tsx`
- `C:\rajesh\lms_k12\app\alumni-portal\_lib\portal-api.ts`
- `C:\rajesh\lms_k12\app\alumni-portal\_components\portal-ui.tsx`
- `F:\xampp\htdocs\next_lms_erp\database\migrations\2026_10_14_100000_create_alumni_auth_tables.php`

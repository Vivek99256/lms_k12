# Authentication

Last updated: 2026-11-04
Generated from commit: `8fe500dc` (frontend) / `86261072` (backend)

**Product:** Shared Platform | **Module:** Auth | **v1 status:** Complete

| Field | Value |
|---|---|
| Backend routes | `POST /api/api-login`, `POST /api/google-auth` (Next.js proxy), `GET /api/mobile/web-handoff/claims`, `GET /api/academic-terms` |
| Roles | All |
| Last updated | 2026-11-04 |
| Source commit | 8fe500dc (FE) / 86261072 (BE) |

## 1. Purpose & users

Authentication is the entry gate for all users. Three login paths exist: email+password, Google OAuth, and mobile WebView handoff. All three produce the same session shape and persist to `localStorage`.

## 2. Screens

| Screen | Route | Description |
|---|---|---|
| Login | `/login` | Email/password form + Google sign-in button |
| Forgot Password | `/forgot-password` | Password reset request |
| Mobile Bridge | `/mobile-bridge` | Receives a single-use handoff ticket from the K12 mobile app's WebView and exchanges it for a full session |

![](./screenshots/login.png)

## 3. Features & business rules

### localStorage keys written on login

| Key | Contents |
|---|---|
| `auth` | `{ name, email, avatar? }` — user display info |
| `menuContext` | `{ sub_institute_id, user_id, user_profile_name, user_profile_id, client_id }` |
| `userData` | Full login payload: JWT token (`user_token`), academic years, academic terms, `host_name`, `is_admin`, etc. |
| `selectedAcademicYear` | Active academic year (synced by the year switcher in Header) |

### Session rules
- No idle timeout. Sessions end only on explicit logout or server rejection.
- On logout: **all** localStorage, sessionStorage, caches and cookies on the origin are purged, then the page reloads. This ensures the next login gets the latest deployed build.
- On deploy: `syncAppBuild()` runs on every page load. If the build ID in the bundle differs from the one in localStorage, the client state is purged and the page reloads. No manual "clear your cache" step is needed.
- Academic terms are scoped to the active year at login. Switching the year in the Header calls `refreshAcademicTerms(syear)` to reload terms for the new year.

### CAPTCHA
- Login form validates a captcha. The expected answer is set in `CAPTCHA` env var on Laravel.
- If `captchaText` matches `env('CAPTCHA')`, the laravel-captcha library check is skipped.

### Academic year resolution (erp-client.ts)
Priority order:
1. `selectedAcademicYear` from localStorage (only if it matches a valid year for this session)
2. Active year from `academicTerms[0]`
3. Active year from `academicYears[0]`
4. Raw `syear` field from `userData`

## 4. User flows

**Happy path — email/password login:**
1. User enters email + password + captcha on `/login`.
2. Frontend POSTs to `${API_BASE_URL}/api/api-login` with `{ email, password, type: 'API' }`.
3. Laravel validates credentials against `tbluser` (staff) or `tblstudent` (student).
4. On success: JWT token, academic years, terms, institute details returned.
5. `persistLoginPayload()` writes `auth`, `menuContext`, `userData` to localStorage.
6. User is redirected to `/dashboard`.

**Google OAuth:**
1. User clicks "Sign in with Google".
2. Google Identity Services returns a credential token.
3. Frontend POSTs to `/api/google-auth` (Next.js proxy).
4. Next.js proxy relays to Laravel; Laravel validates the Google token and returns the same payload as email login.
5. Same `persistLoginPayload()` flow.

**Mobile WebView handoff:**
1. K12 mobile app opens a URL containing `?ticket=<single-use-token>`.
2. `/mobile-bridge` page reads the ticket from query params.
3. `loginFromHandoffTicket(ticket)` calls `GET /api/mobile/web-handoff/claims?ticket=...`.
4. Laravel validates the ticket (one-use, bound to a user and tenant), returns session payload.
5. Session is established; user is redirected to `redirect_path` from the response.

## 5. Data model

| Table | Key columns | Notes |
|---|---|---|
| `tbluser` | `id`, `email`, `password`, `plain_password`, `user_profile_id`, `sub_institute_id`, `client_id`, `is_admin`, `status`, `expire_date` | Staff/admin users |
| `tblstudent` | `id`, `email`, `password`, `user_profile_id`, `sub_institute_id` | Student users (unified login) |
| `tbluserprofilemaster` | `id`, `profile_name` | Defines user profile types (roles) |

The `loginController` queries both tables and uses a union to support a single login endpoint for all user types.

## 6. APIs

| Method | Endpoint | Auth | Request | Response |
|---|---|---|---|---|
| POST | `/api/api-login` | None | `{ email, password, type: 'API' }` | `{ user_token, name, email, sub_institute_id, user_profile_id, user_profile_name, client_id, is_admin, academicTerms[], academicYears[], host_name, logo, ... }` |
| POST | `/api/google-auth` | None | `{ credential: <google-id-token> }` | Same as api-login |
| GET | `/api/mobile/web-handoff/claims` | None | `?ticket=<token>` | Same as api-login + `{ redirect_path }` |
| GET | `/api/academic-terms` | Bearer | `?type=API&sub_institute_id=&syear=` | `{ data: AcademicTerm[] }` |

**Error cases:**
- Wrong credentials → `{ status_code: 0, message: 'Invalid credentials' }`
- Invalid captcha → `{ status_code: 0, message: 'Invalid Captcha' }`
- Expired/used ticket → `{ status: 0, message: 'This link has expired.' }`

## 7. UI components & design tokens

- Login form: `react-hook-form` + Zod validation
- Google button: Google Identity Services GSI library
- Error display: Toast (from design system)
- Loading state: Spinner component
- Design tokens: `--action-primary` for the login button, `--surface-*` for form card

## 8. Reports & exports

None. Auth has no reports.

## 9. Test cases

| ID | Scenario | Steps | Expected result | Type |
|---|---|---|---|---|
| A-01 | Valid email+password login | Enter correct credentials → submit | Redirected to dashboard; `auth`, `menuContext`, `userData` written to localStorage | Happy |
| A-02 | Wrong password | Enter wrong password → submit | Error toast: "Invalid credentials. Please try again." | Negative |
| A-03 | Google OAuth happy path | Click Google → select account | Redirected to dashboard | Happy |
| A-04 | Mobile handoff valid ticket | Open URL with valid ticket | Session established; redirected to `redirect_path` | Happy |
| A-05 | Mobile handoff expired ticket | Open URL with used/expired ticket | Error: "This link has expired." | Negative |
| A-06 | Logout | Click logout | All storage cleared, page reloads to `/` | Happy |
| A-07 | Build version change | Load page with stale build ID | Storage purged, page reloads with latest build | Edge |
| A-08 | Academic year switch | Switch year in Header | `refreshAcademicTerms` called; term dropdowns update | Happy |

## 10. Known issues, limitations & FAQs

- `plain_password` column exists in `tbluser`. Passwords appear to be stored in plaintext in this column alongside the hashed version. This is a security risk.
- The `CAPTCHA` env var is a static text value, not a true image captcha. Easily bypassed.
- No multi-factor authentication (MFA) in v1.
- Session has no server-side expiry check; a revoked token still works until the client next makes a call that the server rejects.

**FAQ:** *Why does logging out reload the entire page?* Because client-side route navigation reuses the in-memory JavaScript bundle. A full reload ensures the new login starts with the latest deployed code.

## 11. Sales notes

- **Google SSO**: Users can sign in with their Google Workspace (school Gmail) accounts — no separate password needed.
- **Mobile handoff**: Teachers and parents using the K12 mobile app can tap a link and open web screens in a WebView without signing in again.
- **Demo flow**: (1) Show the login page → (2) sign in with Google → (3) show dashboard loads in <2s → (4) switch academic year → (5) show terms refresh automatically.

## 12. v1 status & v2 ideas

**Complete:** Email login, Google OAuth, mobile bridge, localStorage session, academic year/term refresh.

**Partial:** Server-side token revocation is not enforced client-side.

**v2 ideas:** MFA support, password hashing enforcement (remove `plain_password`), session management screen (view/revoke active sessions), SSO via SAML for enterprise schools.

## Source files

- `C:\rajesh\lms_k12\contexts\AuthContext.tsx`
- `C:\rajesh\lms_k12\lib\erp-client.ts`
- `C:\rajesh\lms_k12\app\login\page.tsx`
- `C:\rajesh\lms_k12\app\mobile-bridge\page.tsx`
- `F:\xampp\htdocs\next_lms_erp\app\Http\Controllers\loginController.php`
- `F:\xampp\htdocs\next_lms_erp\app\Http\Controllers\api\apiController.php`

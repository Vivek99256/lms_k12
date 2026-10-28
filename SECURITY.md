# SECURITY.md — Scholar Suite

Security reference for developers and the DevOps/infra team.
Derived from the September 2026 security audit (`docs/security-hardening.md`).

---

## 1. Required environment variables

### Next.js app (`C:\rajesh\lms_k12`)

| Variable | Required in | Value / Notes |
|---|---|---|
| `NEXT_PUBLIC_APP_ENV` | All | `production` / `staging` / `development` — controls which backend is selected |
| `LARAVEL_JWT_SECRET` | Server only | Same as Laravel `JWT_SECRET`. Server routes use this to verify JWT signatures. **Never `NEXT_PUBLIC_`** |
| `TRUSTED_BACKEND_ORIGINS` | Server only | Comma-separated list of allowed backend URLs (SSRF guard). e.g. `https://erp.triz.co.in,https://dev.triz.co.in` |
| `FRAME_ANCESTORS` | Server only | CSP `frame-ancestors` allowlist. Empty unless something embeds the app in a frame |
| `MAX_UPLOAD_BYTES` | Server only | Upload cap for relay routes. Default: `52428800` (50 MB) |
| `NEXT_PUBLIC_GOOGLE_CLIENT_ID` | Frontend | OAuth **Client ID** only (ends in `.apps.googleusercontent.com`). Not an API key |

**Remove from every `.env`**: `NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY`, `HP_*`, `GAMMA_API_KEY`, `LLM_API_KEY`, `NEXT_PUBLIC_DB_*`, and any other secret with the `NEXT_PUBLIC_` prefix. The build warns on these patterns — treat warnings as errors.

### Laravel backend

| Variable | Value |
|---|---|
| `APP_DEBUG` | `false` in staging and production |
| `APP_ENV` | `production` in production |
| `CORS_ALLOWED_ORIGINS` | LMS frontend origins only (not `*`) |
| `JWT_TTL_MINUTES` | `720` (12 hours) |
| `SESSION_SECURE_COOKIE` | `true` in production |
| `CAPTCHA` | Empty in production. Non-empty bypasses captcha — developer convenience only |

---

## 2. SSRF guard

All Next.js server routes that proxy to the Laravel backend validate the target URL against `TRUSTED_BACKEND_ORIGINS` before forwarding the request. This prevents a malicious session from redirecting requests to an internal network host.

**Rules:**
- Never add a parameter that accepts an arbitrary backend URL.
- `TRUSTED_BACKEND_ORIGINS` must list exact origins (scheme + host + optional port). Wildcards are not supported.
- If `TRUSTED_BACKEND_ORIGINS` is not set, the proxy falls back to the configured default backend — it does not accept an arbitrary URL.

---

## 3. Secret handling

- **API keys** are stored in `ai_api_keys` (Laravel). They are write-only — the read endpoint returns a masked preview only.
- **JWT secrets** are server-only environment variables. They are never read by client-side code.
- **No secret in a `NEXT_PUBLIC_` variable.** The build guards against the patterns `SERVICE_ROLE`, `SECRET`, `PRIVATE`, `PASSWORD`, `API_KEY` — do not suppress these warnings.
- **`.env.local` and `.env.production` must never be committed to git.** Add them to `.gitignore` and verify they are not tracked.
- Rotate any key that has been in a shared or developer `.env.local`. Check the git history for accidentally committed secrets.

---

## 4. XSS prevention

- All user-supplied HTML (rich text from Tiptap, student documents, chatbot responses) must be sanitised with `isomorphic-dompurify` before `dangerouslySetInnerHTML`.
- Lucide icons are safe — they are SVG elements rendered by a trusted library.
- Dynamic route parameters (student names, fee comments) must be rendered as text nodes, not HTML.
- Content Security Policy is set in the Next.js headers configuration. Report-only mode is not acceptable in production.

---

## 5. Authentication and session management

- Sessions are JWT-based. The frontend stores the token in `localStorage` under the `auth` key.
- Server-side routes verify the JWT signature using `LARAVEL_JWT_SECRET` before processing any request.
- The mobile web-bridge handoff (`/api/mobile-bridge`) uses a single-use ticket — it cannot be replayed.
- `JWT_TTL_MINUTES=720` sets a 12-hour expiry. The frontend's idle timeout is 30 minutes, reset on activity.
- Google OAuth uses the client ID only — never the client secret — on the browser side.
- On sign-out: `localStorage` is cleared and the `clearTeachAssistantStorage()` function purges the chatbot storage.

---

## 6. RBAC

- Every API route must check the user's `sub_institute_id` and compare it to the requested resource's `sub_institute_id`. Cross-tenant reads are a security defect.
- Laravel Policies (`app/Policies/`) enforce object-level access. Use them — do not inline role checks in controllers.
- The frontend's menu visibility is role-filtered but is **not** the access control layer. The backend enforces permissions independently.
- New screens need both a `tblmenumaster` row and a `tblgroupwise_rights` row. A screen without rights rows is inaccessible to all users — including admins — until the rights rows exist.

---

## 7. File uploads

- Validate MIME type server-side using the actual file content (Laravel's `mimes:` rule inspects the file, not just the `Content-Type` header).
- Never store uploaded files in `public/` — use `storage/app/private` or S3.
- Enforce the `MAX_UPLOAD_BYTES` limit on relay routes.
- Image uploads go through `intervention/image` for resizing and format normalisation before storage.
- Reject files with dangerous extensions (`.php`, `.exe`, `.sh`, `.bat`) regardless of MIME type.

---

## 8. SQL injection

- Use Eloquent or Query Builder parameterised queries everywhere. Never concatenate user input into a raw query string.
- Raw queries (`DB::select(DB::raw(...))`) are permitted only with bound parameters. Review any `DB::raw` usage carefully.
- Use `Rule::exists()` and `Rule::unique()` in Form Requests for foreign key and uniqueness validation — never trust a client-supplied ID without verifying it belongs to the right institute.

---

## 9. AI-specific security

- **Prompt injection**: user-supplied text (student names, fee notes, comments) is always passed as a data parameter in template variables. Never interpolated directly into a system prompt string.
- **Credential isolation**: AI models are called through the central `ai_api_keys` resolver. No module holds a raw API key.
- **Guardrails**: configured in the AI Hub (AI → Guardrails). Applied at the platform level before any AI response reaches the user.
- **Audit**: every AI-assisted write action is logged to `platform_audit_log` with the agent ID, model, template ID, and approving user.
- **Rate limiting**: per-agent API call budgets are enforced in the agent definition. Exceeding the budget stops the run.
- **The chatbot cannot take actions without human approval** for any write that affects a record. The approval gate in `ai_agent_approvals` is not bypassable from the frontend.

---

## 10. Infrastructure actions (DevOps)

- Make the GitHub repository (`Vivek99256/lms_k12`) **private**. Enable secret scanning and branch protection on `master` (require PR + CI status check).
- Purge `.kilo/conversational-ai/` and `.codex/` from git history using `git filter-repo`, then force-push and ask all contributors to re-clone.
- `apps.triz.co.in` runs PHP 5.3 / Apache 2.2 over HTTP. Take `excel_upload/export_xlsx.php` offline or put it behind login + HTTPS. Decommission this host.
- HTTPS everywhere. All backend and frontend origins must use TLS. The `SESSION_SECURE_COOKIE=true` setting requires HTTPS.
- Set `CORS_ALLOWED_ORIGINS` in Laravel to the exact frontend origins — not `*`.
- Enable PHP 8.2+ opcache and disable `expose_php` in `php.ini`.
- Regular `composer audit` and `npm audit` — fix high/critical vulnerabilities before the next release.

---

## 11. Incident response checklist

If a security incident is suspected:

1. Rotate all AI provider API keys in `ai_api_keys` immediately.
2. Rotate `LARAVEL_JWT_SECRET` — this invalidates all active sessions.
3. Check `platform_audit_log` for the affected time window.
4. Check `ai_agent_approvals` for any unauthorised agent actions.
5. Check the `failed_jobs` table for queued jobs that should not have run.
6. Review `Log Viewer` at `/log-viewer` for error patterns.
7. If a `NEXT_PUBLIC_*` secret was exposed: rotate it, remove it from the env, rebuild and redeploy.
8. Notify affected users if personal data was accessed.

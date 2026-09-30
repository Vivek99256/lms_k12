# Security hardening — settings and server-side actions

This is what the September 2026 security audit changed in the product, what each
deployment must configure, and what the server/infra team still has to do. The code
changes are safe by default: with none of the settings below, the app behaves as it
did before, only with the new checks in place.

## 1. Settings every deployment must set (Next.js app)

| Variable | Why | Value |
|---|---|---|
| `NEXT_PUBLIC_APP_ENV` | Picks the backend explicitly instead of guessing from the hostname (a staging host used to talk to PROD). | `production` / `staging` / `development` |
| `LARAVEL_JWT_SECRET` | Lets server routes verify the session token's signature and trust its user/institute. Without it they only check a token is present. | Same value as Laravel `JWT_SECRET`. Server-only. |
| `TRUSTED_BACKEND_ORIGINS` | Backends a browser session may name (its `host_name`). Others fall back to the configured backend (SSRF guard). | e.g. `https://erp.triz.co.in,https://dev.triz.co.in` |
| `FRAME_ANCESTORS` | Origins allowed to embed the app in a frame. | Empty unless something embeds it. |
| `MAX_UPLOAD_BYTES` | Upload cap on relay routes. | Default 50 MB. |
| `NEXT_PUBLIC_GOOGLE_CLIENT_ID` | Google sign-in button. Must be an OAuth **Client ID**, not an API key. | `….apps.googleusercontent.com` |

Remove from every `.env`: any `NEXT_PUBLIC_*` secret (the build now warns about
`NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY`), and unused keys (`HP_*`, `GAMMA_API_KEY`,
`LLM_API_KEY`, `DB_*`, Supabase). **Rotate** every key that has been in a shared or
developer `.env.local`.

## 2. Settings for the Laravel backend (`next_lms_erp`)

| Variable | Effect | Suggested |
|---|---|---|
| `CORS_ALLOWED_ORIGINS` | Replaces `Access-Control-Allow-Origin: *`. | The LMS frontend origin(s), comma-separated |
| `JWT_TTL_MINUTES` | Session tokens expire (they never did). The frontend's own idle timeout is 30 minutes and it resets daily. | `720` |
| `SESSION_SECURE_COOKIE` | Adds the `Secure` flag to `laravel_session` / `XSRF-TOKEN`. | `true` |
| `APP_DEBUG` | Must be `false` in production (debug pages leak env and stack traces). | `false` |

## 3. Server / infrastructure actions (not doable from code)

1. **GitHub**: make `Vivek99256/lms_k12` private; purge `.kilo/conversational-ai/` and
   `.codex/` from history (`git filter-repo --path .kilo/conversational-ai --path .codex --invert-paths`,
   then force-push and ask everyone to re-clone); protect `master` (PR review + the
   `CI / checks` status check); enable secret scanning.
2. **apps.triz.co.in**: PHP 5.3 / Apache 2.2 over HTTP. Take `excel_upload/export_xlsx.php`
   offline or put it behind login + HTTPS; decommission the host.
3. **erp / dev servers**: move off CentOS 7 / OpenSSL 1.0.2; enable TLS 1.3; add
   `Strict-Transport-Security: max-age=31536000; includeSubDomains` once every
   `*.triz.co.in` host is HTTPS; hide `Server` / `X-Powered-By` versions.
4. **Certificate**: `*.triz.co.in` expires **10 Nov 2026** — renew and automate; use
   separate certificates for dev and prod.
5. **DigitalOcean Spaces**: make the `public/hp_staff_document` and `public/sqaa`
   prefixes private and serve files through signed, expiring URLs from Laravel.
6. **Database**: allow MySQL only from the app servers (the configured host is a public IP).
7. **Access**: SSH keys only, no password login, MFA on hosting and GitHub accounts.
8. **Backups**: daily encrypted off-site DB + storage backups; test a restore quarterly.
   Include the Next.js `.data/` folder (agents, AI project settings) until it moves to Laravel.
9. **Monitoring**: point an uptime monitor at `GET /api/health`; add error tracking
   (e.g. Sentry) and alerting.
10. **Rate limits**: the app limits per instance in memory. For several instances, add
    an edge/WAF limit on `/api/forgot-password`, `/api/google-auth`, `/api/screenCandidate`,
    `/api/process/convert` and Laravel `/api/api-login`.
11. **n8n**: `create-task-modal` posts to a `/webhook-test/` URL, which only answers
    while the workflow editor is open — switch to the production `/webhook/` URL
    with a shared secret; accept POST for the recruitment webhook instead of GET query strings.

## 4. Backend code work still open (coordinated change)

- **Passwords**: staff passwords are stored and compared in plain text, student
  passwords as unsalted MD5, and forgot-password writes plain text. Every login path
  (web `loginController`, `ApiLoginController`, mobile `NewLMS_*` controllers,
  forgot/reset, user creation, bulk import, `superAdminController`) must move to
  `Hash::make` / `Hash::check` together, with rehash-on-login for old values and
  forced resets for default passwords (`student`, `admin`, `Triz@2020`). Changing one
  path alone would lock users out of the others.
- **API authentication**: `SessionMiddleware` skips all checks for `type=API|JSON`,
  and the registered `jwt` middleware is on no route. Put API routes in one group
  that validates the token and takes `sub_institute_id` from the token, and protect
  `/api/compliance/*`.
- **Logout**: add a token-revocation endpoint and call it from the frontend logout.
- **`/api/permissions`** exists on the backend `development` branch but not on
  `rajesh_triz`; the agent engine denies every action until it is deployed.

## 5. Follow-ups inside the product

- A full `Content-Security-Policy` (`script-src` etc.) needs a testing pass; today's
  policy restricts framing, plugins and `<base>` only.
- Move the session token from `localStorage` to an HttpOnly cookie. This touches
  ~70 files that read `userData` and every direct browser → Laravel call, so it is
  a planned project, not a patch.
- Move `.data/*.json` stores to Laravel before running more than one Next.js instance.

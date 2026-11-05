# Architecture Decisions

Last updated: 2026-11-04
Generated from commit: `8fe500dc` (frontend) / `86261072` (backend)

Non-obvious design decisions made in v1 that future developers need to know before changing anything. Each entry has the decision, the reason, and the consequence of reversing it.

---

## D-01 — Single platform_services.php registry (no per-module copies)

**Decision:** All notification events, scheduled tasks, and workflow points for every module are declared in one file: `config/platform_services.php`. No module has its own private copy.

**Why:** Avoids N copies of the same list drifting out of sync. Admin UI reads one source; validation code checks one source.

**Consequence of reversal:** Notification admin UI would need to merge N sources; validation would need to query N files; risk of a module quietly registering a duplicate event key.

---

## D-02 — tblmenumaster is the authoritative menu, not frontend nav files

**Decision:** The sidebar menu is built entirely from the RBAC query result (`POST /api/menu-rights`), not from any hardcoded frontend navigation array. A screen is invisible to all users until a `tblmenumaster` row exists AND at least one rights row exists.

**Why:** Multi-tenant, multi-role platform. Frontend cannot know which menus a user should see without the server-side rights check.

**Consequence of reversal:** Hardcoding menus in the frontend would bypass RBAC entirely; every new page would need a nav file edit; rights management would be split between DB and code.

---

## D-03 — JWT stored in localStorage, not HttpOnly cookie

**Decision:** The JWT (`user_token`) is stored in `localStorage` under the `userData` key.

**Why:** The frontend is a Next.js SPA that runs across many browser tabs and sub-paths. LocalStorage is accessible from JS, making it easy to read the token for API calls. The app also hosts a mobile WebView handoff flow where the token must be accessible to the page.

**Consequence of reversal:** Moving to HttpOnly cookies would require all API proxy routes to forward the cookie, complicating the Next.js → Laravel proxy. The mobile handoff flow would need redesign.

**Known risk:** XSS can steal tokens from localStorage. Mitigated by strict CSP and `isomorphic-dompurify` on all rendered HTML. MFA and session revocation are v2 work.

---

## D-04 — Next.js API routes are thin proxies only

**Decision:** No business logic lives in `app/api/` Next.js route handlers. They only: (1) validate the JWT, (2) forward the request to Laravel, (3) translate SSE for the AI SDK.

**Why:** Keeps the single source of truth for business rules in Laravel. Prevents logic duplication that would diverge over time.

**Consequence of reversal:** If business logic is added to Next.js routes, it must be kept in sync with Laravel. This always fails eventually.

---

## D-05 — All AI calls route through /api/ai/ask/stream

**Decision:** The AI chatbot (`ChatbotPanel.tsx`) has no model ID, no API key, no tool definitions. It streams from `/api/ai/ask/stream`. The Next.js route proxies to Laravel, which calls the model.

**Why:** API keys never reach the browser. Model selection is centralised in `config/ai.php`. Rate limiting and tenant isolation happen server-side.

**Consequence of reversal:** Putting a model ID or key in the frontend would expose credentials. Hardcoding model IDs in the frontend would break when the model is retired or upgraded.

---

## D-06 — Academic year scoping via syear parameter, not session

**Decision:** Every API call that is year-scoped passes `syear` as a query or body parameter. The year is not derived from a server-side session.

**Why:** The Header year switcher lets users change the active year without logging out. The server must accept the year from the client, not from a session variable, to support this.

**Consequence of reversal:** Moving year to server session would prevent the year switcher from working without a re-login.

---

## D-07 — Soft deletes on all student, staff, and fee records

**Decision:** `SoftDeletes` trait is used on student, staff, and fee models. Hard deletes are blocked.

**Why:** Audit requirements, fee record integrity, and alumni lookup all require records to survive "deletion". A student who leaves still has fee history and results that must be accessible.

**Consequence of reversal:** Hard-deleting fee records would corrupt balance reports. Hard-deleting student records would orphan related data (attendance, results, certificates).

---

## D-08 — RBAC has no deny rule (additive only)

**Decision:** Menu rights are additive. You can grant a menu to a group and to an individual, but you cannot grant a menu to a group and then deny it to one member.

**Why:** The original design assumed profile-level rights are base and individual overrides are additive grants only. The complexity of a deny rule was deferred.

**Consequence of reversal:** Adding deny rules requires a third row type in `tblindividual_rights` (e.g. `is_denied` flag) and changing the `MenuRightsController` query. All existing rights management UI would need to surface a deny option.

---

## D-09 — plain_password column in tbluser (known technical debt)

**Decision (not a decision — a known issue):** `tbluser` has a `plain_password` column that stores the cleartext password alongside the bcrypt hash.

**Why this was added:** Unknown — appears to be legacy. No v1 feature uses it.

**v2 action required:** Drop the column and remove all code that writes to it. This is a security risk.

---

## D-10 — Google OAuth credential token validated server-side by Laravel

**Decision:** The `credential` token from Google Identity Services is sent to Laravel (`/api/google-auth`), not decoded in Next.js.

**Why:** Public key validation and audience verification should happen server-side. The frontend cannot be trusted to validate its own login credentials.

**Consequence of reversal:** Client-side validation of Google tokens is not acceptable for production authentication.

---

## D-11 — Mobile WebView handoff via single-use ticket, not raw JWT

**Decision:** The K12 mobile app does not pass the raw JWT in the URL. It generates a single-use ticket via `/api/mobile/web-handoff/claims` and passes only the ticket.

**Why:** Raw JWTs in URLs end up in server logs, browser history, and referrer headers. A single-use ticket expires on first use, limiting the exposure window.

**Consequence of reversal:** Passing the JWT in the URL would leak credentials to any server that sees the request.

---

## D-12 — syncAppBuild() auto-purges stale client state on deploy

**Decision:** On every page load, `syncAppBuild()` compares the current bundle's build ID against the one stored in localStorage. On mismatch, it clears all client state and reloads.

**Why:** After a deploy, old localStorage state (e.g. a stale menu structure, an old JWT format) can cause subtle bugs. Auto-purging ensures the client always starts fresh after a deploy.

**Consequence of reversal:** Users would need to manually clear cache after deploys, or accept intermittent bugs from stale state.

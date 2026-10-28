# Scholar Suite — Frontend CLAUDE.md
> Persistent project instructions for Claude Code. Read this before touching any file.

---

## 1. Project identity

| Item | Value |
|---|---|
| Product | Scholar Suite — cloud-based multi-tenant K–12 school ERP |
| Frontend | Next.js 16 (App Router) · React 19 · TypeScript 5 (strict) |
| Styling | Tailwind CSS 4 · class-variance-authority · tailwind-merge |
| UI primitives | Radix UI · shadcn · Base UI |
| Forms | react-hook-form 7 · Zod 4 |
| Charts | Recharts · Chart.js / react-chartjs-2 |
| Rich text | Tiptap 3 |
| AI SDK | Vercel AI SDK 7 (`ai` package) · `@ai-sdk/google` |
| Auth | JWT stored in `localStorage` (`auth` key) · `AuthContext` · Google OAuth |
| Backend | Laravel 12 (PHP 8.2) — see `BACKEND.md` for setup; **called remotely via the URL in `NEXT_PUBLIC_APP_ENV`** — never hardcode `localhost` or any absolute path |
| Monorepo | `packages/ai-intelligence-core`, `packages/conversational-ai-core` as internal workspace packages |
| Tests | Node built-in test runner via `tsx`; run with `npm test` |
| Type check | `npm run typecheck` (tsc --noEmit) |
| Lint | `npm run lint` (ESLint 9) |

---

## 2. Before you change anything

1. **Read the existing implementation first.** Never assume — grep the codebase, read the component, check the API route.
2. **Check memory files** in the Claude project memory directory for prior architectural decisions.
3. **Read `docs/`** for the area you are working in. Key files:
   - `docs/universal-conversational-ai-platform.md` — AI/chatbot architecture
   - `docs/security-hardening.md` — security constraints, environment variables
   - `docs/conversational-ai-architecture.md` — chatbot lifecycle
4. **Run `npm run typecheck` and `npm run lint`** before reporting a task as done.
5. **Never introduce a breaking change** to an existing API route, component prop signature, or `localStorage` key without checking all call sites first.

---

## 3. Architecture decisions (do not override)

### 3.1 API calls
- All Laravel API calls go through `lib/erp-client.ts`. Use `SessionContext` helpers (`readString`, `readNumber`, `normalizeNumericId`).
- The base URL is resolved by `app/components/utils/api_url.tsx`. **Never hardcode a URL.**
- Next.js API routes under `app/api/` are thin proxies only — no business logic lives there. They relay to Laravel and translate SSE for the AI SDK.
- The backend is at `https://dev.triz.co.in` for development. `NEXT_PUBLIC_APP_ENV` controls which backend is used.

### 3.2 Auth
- Session state lives in `AuthContext` (`contexts/AuthContext.tsx`). Read it with `useAuth()`.
- `localStorage` keys: `auth` (user object), `menuContext`, `userData`, `selectedAcademicYear`, `selectedAcademicTerm`.
- JWT is validated server-side using `LARAVEL_JWT_SECRET`. Never skip this check in new server routes.
- Mobile web handoff uses a single-use ticket via `/api/mobile/web-handoff/claims` — do not expose raw tokens.

### 3.3 Menu / RBAC
- Menu items come from `tblmenumaster` in Laravel. A new screen is invisible until a `tblmenumaster` row exists **and** `tblgroupwise_rights` / `tblindividual_rights` rows grant access.
- The header user-menu items (`platformServicesItems`, `platformSetupItems`, `aiIntelligenceItems`) are defined in `app/components/Header.tsx` and driven by `packages/ai-intelligence-core/src/registry.ts`.
- **Never add a menu item by editing only the frontend.** The Laravel migration also needs to exist.

### 3.4 AI capabilities
- All AI capability metadata lives in `packages/ai-intelligence-core/src/registry.ts`. Add or rename capabilities there — no other file changes should be needed for the menu to update.
- Per-module AI Stack screens are built by `app/_components/ai-stack/build-ai-stack-screens.tsx`. Add new modules there.
- The chatbot (`app/components/ChatbotPanel.tsx`) is a presentation component — it contains no model, no tool list, no key. It streams from `/api/ai/ask/stream`.
- AI model configuration is in `config/ai.php` (Laravel). The frontend reads the active model from the central catalogue — never hardcode a model ID in frontend code.

### 3.5 Platform services
- All eight platform services (RBAC, Workflow, Notification, Scheduler, Document, Integration, Audit, Event Bus) read a single registry at `config/platform_services.php`. Do not create module-specific versions.

### 3.6 PAL / adaptive learning
- PAL content (chapters, concepts, misconceptions, ULUs) is authored and stored in Laravel. The Next.js PAL routes under `app/pal/` are read-only consumers.
- Adaptive routing logic lives in `packages/ai-intelligence-core`. Do not duplicate it in page components.

---

## 4. Code quality rules

### TypeScript
- `strict: true` is set in `tsconfig.json`. No `any` without an explicit cast and a comment explaining why.
- Use the path alias `@/*` for project-root imports. Use `@shared/ai-intelligence-core` for the AI registry.
- Prefer `unknown` over `any` for API responses; narrow with type guards or Zod schemas.
- Never use `// @ts-ignore` — fix the type.

### React / Next.js
- App Router only. No Pages Router patterns.
- Mark components `'use client'` only when they need browser APIs, hooks or event handlers. Server components are the default.
- Keep client components small. Lift data fetching to Server Components or dedicated API route handlers.
- Never call `localStorage` at module level — wrap in `useEffect` or `typeof window !== 'undefined'` guards (SSR).
- Use `isomorphic-dompurify` (already in deps) before rendering any HTML string. No raw `dangerouslySetInnerHTML` without sanitisation.

### Styling
- Tailwind utility classes only. No inline `style={{}}` for design tokens.
- Use the EduERP design system tokens (`--action-primary`, `--surface-*`, `--content-*`, `--border-*`) defined in `styles.css` and `tokens/`. Never hardcode hex colours.
- Follow the design language: sentence case labels, no gradients, no glassmorphism. See `CLAUDE.md` in the `ERP Design System/` directory for full rules.

### Components
- Prefer the existing component library (`components/`, `app/_components/`, design system under `components/`). Check the anti-duplication map in `ERP Design System/components/05_component_library.yaml` before creating a new component.
- Keep components focused. Extract when a component exceeds ~200 lines or handles more than one responsibility.
- Every icon-only button needs an `aria-label`. Every interactive element needs a visible `:focus-visible` ring.

### Naming
- Files: `kebab-case.tsx` for pages and components, `camelCase.ts` for utilities and hooks.
- Hooks: `use-` prefix, kebab-case file name, camelCase export.
- Route segments: `kebab-case`.
- React components: PascalCase export.

---

## 5. Security (non-negotiable)

- **Never expose secrets in `NEXT_PUBLIC_*` variables.** The build warns on `SERVICE_ROLE`, `SECRET`, `PRIVATE`, `PASSWORD`, `API_KEY` patterns — fix the warning, do not suppress it.
- **Never log auth tokens, JWT payloads, or personally identifiable data** in `console.log` or error messages.
- **Sanitise all HTML** with `isomorphic-dompurify` before `dangerouslySetInnerHTML`.
- **SSRF guard**: the backend URL is validated against `TRUSTED_BACKEND_ORIGINS`. Never bypass this check or accept an arbitrary backend URL from user input.
- **Upload validation**: all file uploads must validate MIME type and size before sending to Laravel. Use the `MAX_UPLOAD_BYTES` env var (default 50 MB).
- **Rate limiting**: new AI-facing API routes must respect the rate limits set in `config/ai.php` on the Laravel side. Do not call AI endpoints in loops.
- **Frame embedding**: the `FRAME_ANCESTORS` env var controls `Content-Security-Policy: frame-ancestors`. Do not remove or weaken this header.
- **`APP_DEBUG=false`** must be set in any non-development Laravel environment. The Next.js proxy must not forward raw PHP stack traces to the browser.
- Input coming from URL params, query strings, or `localStorage` must be validated before use. Use Zod schemas at system boundaries.

---

## 6. Performance

- **Route-level code splitting** is automatic via App Router. Do not import heavy libraries (jspdf, html2canvas-pro, recharts) at the top of a page — use dynamic `import()` with `{ ssr: false }`.
- **Images**: use `next/image` for school logos and avatars. Never render a raw `<img>` for user-supplied content without width/height constraints.
- **API pagination**: all list endpoints from Laravel are paginated. Never fetch unbounded lists. Use cursor or page-based pagination in `erp-client.ts` helpers.
- **Caching**: Laravel API responses can be cached at the `Cache-Control` layer. Do not cache authentication-sensitive responses. Use `revalidate` options on server fetches.
- **Bundle size**: run `next build` and inspect bundle output before adding a new dependency. If a package adds more than ~50 KB gzipped for a single feature, evaluate a lighter alternative.
- **Framer Motion**: `framer-motion` is available for premium interactions. Use it only for the approved interactive patterns (press-scale, sliding indicators, scale-in overlays). Do not animate layout-heavy properties (`width`, `height`, `top`, `left`).
- **`prefers-reduced-motion`**: all motion must collapse to instant under this media query. Duration tokens in `tokens/motion.css` zero out automatically — use them.

---

## 7. Database & backend (Laravel — see `BACKEND.md` for local path)

> Frontend engineers: changes here require coordination with the backend. Leave a comment in the PR if a new screen needs a migration.

- **Migrations** are numbered `YYYY_MM_DD_HHMMSS_description.php`. Every new menu item needs a migration that inserts into `tblmenumaster` and seeds `tblgroupwise_rights` for the super-admin group.
- **Eloquent models** go in `app/Models/`. Use `$fillable` — never `$guarded = []` in production models.
- **Indexes**: any column used in a `WHERE`, `JOIN`, or `ORDER BY` on a large table (`tblstudent`, `fees_*`, `ai_*`) needs a migration that adds the index.
- **Transactions**: fee collection, payroll, and any multi-table write must be wrapped in `DB::transaction()`.
- **Soft deletes**: use `SoftDeletes` on all student, staff, and fee records — never hard-delete.
- **AI keys** (`ai_api_keys` table): credentials are write-only. The read endpoint must return only a masked preview. The central `config/ai.php` maps retired model IDs forward — never use a raw model string in a Laravel controller.

---

## 8. Error handling

- **API routes**: return structured JSON `{ success: boolean, message: string, data?: unknown }`. Use HTTP status codes correctly (400 validation, 401 auth, 403 RBAC, 404 not found, 500 server).
- **Client side**: wrap API calls in try/catch. Show the `message` field from the envelope to the user via `Toast`. Never show a raw exception message or stack trace.
- **AI routes**: if a model call fails, return a non-streaming error response with a safe message. Log the full error server-side with the module name and the template ID.
- **Streaming**: SSE streams from `/api/ai/ask/stream` must close cleanly on error. The `ChatbotPanel` already handles `error` events — do not swallow them.
- **Form validation errors**: use react-hook-form + Zod. Field-level errors display inline, not as toasts.
- **Loading states**: every async operation needs a Skeleton or Spinner. Use the `Skeleton` and `Spinner` components from the design system.

---

## 9. Testing

- Test files live alongside source: `lib/foo.test.ts`, `packages/*/src/*.test.ts`.
- Run with `npm test` (Node built-in test runner via tsx).
- **Before completing any task**: run `npm run typecheck` and `npm run lint`. Fix all errors — do not ignore them.
- Unit tests are required for: pure utility functions in `lib/`, AI registry logic in `packages/`, and any validation logic using Zod schemas.
- Integration tests are required for: new `app/api/` route handlers that talk to Laravel.
- **Do not mock the database** in backend tests — use a real test database connection.

---

## 10. API design (Next.js route handlers)

- Route handler files: `app/api/[resource]/route.ts`.
- Always validate the request body with a Zod schema at the top of the handler.
- Always verify the JWT with `LARAVEL_JWT_SECRET` before processing.
- Return `{ success: true, data: ... }` or `{ success: false, message: '...' }`.
- **AI streaming routes**: use the Vercel AI SDK's `streamText` / `createStreamableValue`. Never write raw SSE manually.
- Rate-limit all AI-facing routes. Use the `x-institute-id` header for per-tenant rate limiting.
- New routes need a corresponding Laravel endpoint — do not replicate business logic in Next.js.

---

## 11. Dependency management

- Before adding a package: check if the existing deps already provide the capability (e.g. `date-fns` for dates, `zod` for validation, `isomorphic-dompurify` for sanitisation).
- Do not add: jQuery, Lodash (use native ES2017+), Moment.js (use `date-fns`), Axios (use native `fetch`).
- Pin major versions. Check `npm audit` after adding any package.
- Packages with known security vulnerabilities must be updated or replaced before merging to `master`.

---

## 12. Environment variables

| Variable | Where | Purpose |
|---|---|---|
| `NEXT_PUBLIC_APP_ENV` | Frontend | `production` / `staging` / `development` |
| `LARAVEL_JWT_SECRET` | Server only | JWT signature verification |
| `TRUSTED_BACKEND_ORIGINS` | Server only | SSRF allowlist |
| `FRAME_ANCESTORS` | Server only | CSP frame-ancestors |
| `MAX_UPLOAD_BYTES` | Server only | Upload size cap |
| `NEXT_PUBLIC_GOOGLE_CLIENT_ID` | Frontend | Google OAuth client ID only — not an API key |

**Never** put `NEXT_PUBLIC_*` on secrets. **Never** commit `.env.local` or `.env.production`.

---

## 13. Git and PR hygiene

- Branch from `master`. Name branches `<type>/<short-description>` (e.g. `feat/fees-online-gateway`, `fix/pal-diagnostic-score`).
- Commit messages: `<type>(<scope>): <what changed>` (e.g. `feat(fees): add NACH S2 import`).
- Every PR needs: a description of what changed and why, a test plan, and a note if a Laravel migration is required.
- Do not commit: `node_modules/`, `.env.*`, `.next/`, `.kilo/`, `AUDIT/`, `*.docx`, large binary files.
- Run `npm run typecheck && npm run lint && npm test` before pushing.

---

## 14. Design system compliance

This project ships with the EduERP Design System under `ERP Design System/` (read-only) and its compiled output in `tokens/`, `components/`, `styles.css`.

- **Sentence case** everywhere — labels, buttons, headings, menu items. Never Title Case or ALL CAPS except overline roles.
- **No emoji** in UI text. Meaning is carried by text + Lucide icon.
- **Buttons are verbs**: "Collect fee", "Approve", "Add student" — not "OK", "Submit", "Yes".
- **Currency**: `₹` with Indian grouping (`₹18.4L`, `₹42,500`). Tabular figures for amounts.
- **IDs**: monospace (`ADM-2026-0421`, `FEE-2026-0912`).
- Icons from Lucide (`lucide-react`). Sized at 16px inline, 20px in controls. Never replace text with icon alone without an `aria-label`.
- Themes: light / dark / high-contrast light / dark via `data-theme` on `<html>`. Density: comfortable / cozy / compact via `data-density`. Use semantic tokens — never hardcode a colour.
- **No gradients, no glassmorphism, no blur, no neumorphism.** Flat surfaces, hairline borders, subtle shadows only.

---

## 15. AI coding guidelines

1. **Analyse before coding.** Read the existing module's page, components, API routes and types before writing anything.
2. **Make focused changes.** Fix the specific bug or add the specific feature. Do not refactor surrounding code unless it is blocking the task.
3. **Never assume requirements.** If a requirement is ambiguous (e.g. "add AI to fees"), ask which specific capability is needed.
4. **Explain non-obvious decisions.** Leave a one-line comment when you make a technical choice that is not self-evident (a workaround, an invariant, a deliberate constraint). Do not comment what the code does.
5. **No half-finished work.** A feature either works end-to-end or is not committed. Stub components with a `TODO` comment are acceptable in a draft PR but not in `master`.
6. **Preserve architectural decisions.** The patterns in this file exist for a reason. Do not introduce a new pattern (e.g. a second auth system, a second state manager, a second HTTP client) without explicit agreement.
7. **Check the AI registry** (`packages/ai-intelligence-core/src/registry.ts`) before adding AI-related UI. The capability may already be defined.
8. **The chatbot is a presentation component.** `ChatbotPanel.tsx` has no model, no tool, no key. Never add AI calls to it directly.

# BACKEND.md — Scholar Suite Laravel Backend

> Instructions for working on the Laravel 12 / PHP 8.2 backend.
> The backend project root path varies per environment — use the path configured on your machine.
> Read alongside `CLAUDE.md` (frontend rules) and `AGENTS.md` (agent rules).

---

## Stack

| Item | Value |
|---|---|
| Framework | Laravel 12 |
| PHP | 8.2+ |
| Database | MySQL (via `DB_CONNECTION=mysql`) |
| Queue | Database queue driver (`QUEUE_CONNECTION=database`) |
| Auth | JWT (`generationtux/jwt-artisan`) + Laravel Sanctum |
| AI | `anthropic-ai/sdk` · Gemini via `@ai-sdk/google` proxy · `config/ai.php` for model management |
| Graph DB | Neo4j (`laudis/neo4j-php-client`) — Enterprise Brain knowledge graph |
| Storage | Local + AWS S3 (`league/flysystem-aws-s3-v3`) |
| PDF | `barryvdh/laravel-dompdf` |
| Excel | `maatwebsite/excel` |
| MCP | `laravel/mcp` (MCP tool server) |
| APM | Inspector APM (`inspector-apm/inspector-laravel`) |
| Logs | `opcodesio/log-viewer` at `/log-viewer` |

---

## Directory map

```
app/
  Agents/           Agent definitions and tool registries
  Brain/            Enterprise Brain deliberation, execution, signal processing
  CareerIntelligence/  Career module domain logic
  Domain/           Shared domain services
  Events/ Listeners/ Jobs/  Async event handling
  Helpers/          Global helper functions
  Http/
    Controllers/
      AI/           AI generation controllers
      Brain/        Enterprise Brain HTTP layer
      G2gLms/       Staff LMS (G2G) controllers
      HRMS/         HR management controllers
      MIS/          Management information controllers
      Mcp/          MCP tool handlers
      agenticAI/    Agent orchestration
      admission/ fees/ student/ lms/ …  Module controllers
    Middleware/
  Models/           Eloquent models
  Policies/         RBAC policies
config/
  ai.php            Model catalogue, provider mapping, retired model forwarding
  platform_services.php  Shared platform service registry
database/
  migrations/       One migration per schema change (YYYY_MM_DD_HHMMSS_*)
  seeders/
routes/
  api.php           All API routes (no web.php routes used by the Next.js app)
docs/               Architecture and design documents
```

---

## Migrations

- **Every new screen** needs a migration that inserts into `tblmenumaster` and seeds `tblgroupwise_rights` for the super-admin group (minimum). Without these rows the menu item is invisible to all users.
- Migration naming: `YYYY_MM_DD_HHMMSS_<action>_<table_or_feature>.php`. Use the actual timestamp, not a placeholder.
- **Never modify a deployed migration** — create a new one.
- Large data migrations (millions of rows) must use chunked queries (`LazyCollection`, `chunkById`). Never load an unbounded set into memory.
- Index migrations: add indexes in a separate migration from the table creation migration so they can be rolled back independently.

### Required columns on all new tables

| Column | Type | Notes |
|---|---|---|
| `id` | `bigIncrements` | Primary key |
| `sub_institute_id` | `unsignedBigInteger` | Multi-tenant isolation |
| `created_at` | `timestamp` | Standard Laravel |
| `updated_at` | `timestamp` | Standard Laravel |
| `deleted_at` | `timestamp nullable` | Soft deletes (SoftDeletes trait) |

---

## Controllers

- Controllers are thin: validate → call service/model → return response. No business logic in controllers.
- All controllers extend `App\Http\Controllers\Controller`.
- Use Form Requests for validation (`php artisan make:request`). Do not validate with `$request->validate()` inline for complex rules.
- Return format for all API responses:

```php
// Success
return response()->json(['status' => 1, 'message' => 'Done', 'data' => $result]);

// Error
return response()->json(['status' => 0, 'message' => 'Human-readable reason'], $httpStatus);
```

- Never return raw exception messages or stack traces to the client. Catch `\Exception` and return a safe message. Log the full exception with `Log::error()`.

---

## Models

- All models use `$fillable` (never `$guarded = []`).
- All student, staff, and fee models use the `SoftDeletes` trait.
- Scope multi-tenant queries by `sub_institute_id` in every query. Add a global scope or always include `->where('sub_institute_id', $id)`.
- Use `$casts` for boolean, datetime, and JSON columns — never cast manually in controllers.
- Relationships: define `belongsTo` / `hasMany` / `belongsToMany` in the model. Never join in a controller.

---

## AI integration rules

- **Model resolution**: always call through `config('ai')` or the `AiModelResolver` service. Never hardcode `'gemini-3.6-flash'` or any model string in a controller.
- **Retired model forwarding**: `config/ai.php` maps retired Gemini IDs to their replacements. Keep this map up to date when Google retires a model.
- **Credentials**: read from `ai_api_keys` table, not from `.env` in application code. The `config/ai.php` bootstraps the initial key from `.env` only.
- **Template rendering**: use `TemplateRegistry` to substitute `{{variables}}` in prompt templates. Never interpolate user data directly into a prompt string.
- **Timeouts**: set `document_timeout` for document-processing calls (default 90s). Batch generation jobs default to 600s.
- **Fallback models**: implement `$geminiFallbackModel` from `config/ai.php` for document evaluation routes.
- **AI audit**: every AI call that affects a stored record must write to `platform_audit_log` with `agent_id`, `model_used`, `template_id`, `token_count`.

---

## RBAC and menus

- Menu visibility: a screen is invisible until `tblmenumaster` has a row for it AND at least one `tblgroupwise_rights` or `tblindividual_rights` row grants access.
- `tblprofilewise_menu` is a display-layer cache — it is not the access control layer.
- Every new module migration must seed the super-admin group's rights.
- Role checks in controllers: use Laravel Policies (`app/Policies/`) not inline `if ($user->role === 'admin')` checks.

---

## Queue and jobs

- Long-running jobs (exam evaluation, bulk AI generation, import/export) must be dispatched to the queue, not run synchronously.
- Job visibility timeout in `.env`: must be longer than the slowest job (currently 600s for exam answer-sheet evaluation). Default recommendation: `QUEUE_TIMEOUT=660`.
- Failed jobs go to `failed_jobs` table. Set up `php artisan queue:failed` monitoring.
- Jobs that send external requests (SMS, email, WhatsApp, AI) must implement `ShouldBeUnique` or check for a duplicate record before executing to prevent double-sends on retry.

---

## Security

- `APP_DEBUG=false` in all non-local environments. Debug mode leaks `.env` values and stack traces.
- `CORS_ALLOWED_ORIGINS`: list only the LMS frontend origins. Never `*`.
- `JWT_TTL_MINUTES=720` — session tokens expire after 12 hours.
- `SESSION_SECURE_COOKIE=true` in production.
- Input validation: use Form Requests for all POST/PUT/PATCH. Use `Rule::exists()` for foreign key references. Use `Rule::unique()` with `ignore()` for updates.
- File uploads: validate MIME type with `mimes:` rule (not just the client-supplied `Content-Type`). Store in S3 or `storage/app/private` — never in `public/`.
- SQL: always use Eloquent or Query Builder parameterised queries. Never concatenate user input into a query string.
- Captcha: `CAPTCHA` env var must be **empty** in production. A non-empty value bypasses captcha — it is for developer convenience only.

---

## Performance

- Eager load relationships to prevent N+1: `with(['student', 'fees'])` before looping.
- Use `chunkById()` for large batch operations. Never `->get()` on an unbounded student or fee table.
- Cache expensive aggregates (fee collection totals, attendance summaries) in the database query cache with a short TTL (5–15 minutes). Invalidate on write.
- Use database indexes on every column in `WHERE`, `JOIN`, and `ORDER BY` clauses. Check with `EXPLAIN` before merging a query-heavy feature.
- Queue AI jobs — never call an LLM synchronously from an HTTP request unless the route explicitly streams back to the client via SSE.

---

## Logging and monitoring

- Use `Log::info()` for significant operations, `Log::error()` for exceptions (always include context: `module`, `action`, `user_id`, `institute_id`).
- Never log: JWT tokens, API keys, passwords, full student personal records.
- Inspector APM is configured — performance bottlenecks and exceptions are tracked automatically.
- Log Viewer is at `/log-viewer` (admin-only). Do not expose it publicly.
- Queue health: monitor `failed_jobs` table. Alert if it grows.

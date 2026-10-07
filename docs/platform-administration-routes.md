# Platform administration: where to check each service

Summary page: <http://localhost:3000/platform-administration>

These routes are hidden in V1. To see them, set `NEXT_PUBLIC_SHOW_DEFERRED_MODULES=true` in `.env.local` and restart the dev server.

Backend: Laravel at `F:\xampp\htdocs\next_lms_erp`, branch `rajesh_triz`. Platform API prefix: `/api/platform`. Verified by calling the controllers against the database; not yet over HTTP with a session token.

| Service | Status | Frontend route | Backend endpoints | RBAC key |
|---|---|---|---|---|
| Authentication | Live | `/login` | existing login API | n/a |
| Roles and permissions | Live | `/settings` | `/api/permissions` | n/a |
| Audit trail | Live | `/platform-services/audit` | `GET /audit`, `GET /audit/summary` | `platform.audit` |
| Approval workflows | Live | `/platform-services/workflow` (chains), `/platform-services/workflow/runs` (requests) | `GET/POST /workflow`, `GET/POST /workflow/runs`, `POST /workflow/runs/{id}/approve\|reject\|delegate` | `platform.workflow` |
| Notifications | Live | `/platform-services/notification` (settings), `/platform-services/notification/log` (delivery log) | `GET/PUT /notifications`, `GET /notifications/log`, `POST /notifications/test-send` | `platform.notification` |
| Templates and documents | Live | `/document-templates` (Download PDF on each card) | `/api/document-templates/*`, `POST /templates/{id}/pdf` | existing template menu |
| Scheduler | Live | `/platform-services/scheduler` (Run now on each task) | `GET/PUT /scheduler`, `POST /scheduler/run-now` | `platform.scheduler` |
| File storage | Live | `/platform-services/files` | `GET/POST /files`, `GET /files/{id}/download`, `DELETE /files/{id}` | `platform.document` |
| Integrations | Live | `/integration` | `GET/POST /integrations`, `GET/PUT/DELETE /integrations/{id}`, `POST /integrations/{id}/test` | `platform.integration` |
| Reporting engine | Live | `/platform-services/reports` | `GET /reports`, `GET /reports/{key}/export`, `GET/POST/PUT/DELETE /reports/schedules`, `POST /reports/schedules/{id}/run-now` | `platform.report` |
| Data import | Live | `/import-data` | `/api/import/*` (tables, parse, match-fields, process) | n/a |
| Dashboard engine | Live | `/platform-services/dashboard` | `GET /dashboard`, `PUT /dashboard/layout` | per-widget rights |
| Student evidence store | In progress | none yet | backend only | n/a |
| Event bus (internal) | In progress | `/platform-services/event-bus` | `GET /events/*` | `platform.eventbus` |

## What "Live" means here, and its limits

- **Notifications:** web and email are sent. SMS, WhatsApp and mobile are recorded as skipped with the reason until a provider driver exists.
- **Scheduler:** one job is registered today (notification retry). Any other configured task is reported as not run, never as ok.
- **Template PDF:** merge values come from the caller; the gallery download leaves them blank.
- **Sample data:** rows seeded for demonstration carry `is_sample = 1` and show a "Sample data" marker.

## Running the scheduler

`php artisan platform:schedule-run` runs every minute from `app/Console/Kernel.php`. On a server, the usual Laravel cron entry (`php artisan schedule:run` every minute) must be in place.

## Database note

The backend database is shared and remote. Never run a plain `php artisan migrate` there. Run a single file with `php artisan migrate --path=database/migrations/<file>.php`.

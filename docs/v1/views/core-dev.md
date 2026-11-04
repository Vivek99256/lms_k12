# Scholar Core — Developer View

Last updated: 2025-11-04
Generated from commit: `8fe500dc` (frontend) / `86261072` (backend)

## Architecture
Next.js frontend (app router) + Laravel backend (F:\xampp\htdocs\next_lms_erp). API routes in outes/api.php/outes/web.php. Controllers in pp/Http/Controllers/. Models follow project conventions.

## Key modules structure
See per-module docs under core/. Migrations in backend database/migrations/. Models in pp/Models/ or controllers reference tables directly.

## Conventions
- Routes organized by module under pp/ (frontend)
- Backend follows Laravel MVC
- Permissions via RBAC tables (	blmenumaster, 	blgroupwise_rights, 	blindividual_rights)

## Source files
- Frontend: C:\rajesh\lms_k12\app\**, C:\rajesh\lms_k12\components\**`n- Backend: F:\xampp\htdocs\next_lms_erp\app\**, F:\xampp\htdocs\next_lms_erp\routes\**`n

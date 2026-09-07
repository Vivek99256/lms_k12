# INTEGRATION AUDIT — Enterprise Brain → K-12 LMS

Produced by reading all three repositories. `hp-enterprise-brain` was read only;
nothing in it was created, edited, moved or executed.

---

## 1. Repository paths

| Role | Path | Stack | Status |
|---|---|---|---|
| Enterprise Brain (reference) | `C:\Users\omshivay\Desktop\ADK\hp-enterprise-brain` | Laravel 11 / PHP 8.2 API + Vite React 18 SPA (`web/`) | **READ-ONLY** — git `f32a783`, clean tree |
| K-12 LMS frontend | `C:\Users\omshivay\Desktop\ADK\lms_k12` | Next.js 16 (App Router) / React 19 / Tailwind 4 | Target |
| K-12 LMS backend | `C:\Users\omshivay\Desktop\ADK\next_lms_erp` | Laravel 9 / PHP ^8.0 | Target |

Scale of the reference implementation: **81 API controllers**, **117 migrations
defining 105 `hpbrain_*` tables**, **~45,700 LOC** of frontend TypeScript across
244 files.

---

## 2. LMS frontend architecture (`lms_k12`)

- **Framework**: Next.js 16 App Router, `app/` directory, `'use client'` pages.
  `app/layout.tsx` → `AuthProvider` → `ConditionalApp` → `DashboardShell`.
- **Shell**: `app/components/DashboardShell.tsx` (539 lines) composes
  `Sidebar` + `Header` + `Level3Subheader` + `ChatbotPanel` + `RightFloatingToolbar`.
- **Sidebar**: `app/components/Sidebar.tsx` (451 lines). Collapsed icon rail that
  expands; level-2 items open in a portalled popup panel positioned against the
  viewport; level-3 items render in `Level3Subheader`.
- **Navigation data**: **entirely database-driven**. `app/hooks/useMenuRights.ts`
  POSTs to `{API_BASE_URL}/api/menu-rights` and `app/data/menuMappers.ts`
  (`buildMenuTree`) folds the level-1/2/3 response into `MenuItem[]`.
  `app/data/menuItems.ts` deliberately exports an **empty** static array.
- **Precedent for declared nav**: `DashboardShell.tsx` defines
  `NEW_PAL_LEVEL3_ITEMS` statically and *gates it on the rights-filtered menu
  tree*. So the codebase already has a pattern for "declared in code, authorised
  by the server".
- **Routing of API links**: `app/data/routeMapper.ts` (889 lines) maps Laravel
  route names returned by the menu API onto Next.js paths.
- **API base**: `app/components/utils/api_url.tsx` → `API_BASE_URL`, chosen from
  `NEXT_PUBLIC_API_BASE_URL_DEV` (`https://dev.triz.co.in`) or `..._PROD`.
- **Auth**: `contexts/AuthContext.tsx`. `POST /api/api-login` → localStorage keys
  `auth`, `menuContext`, `userData`, `sessionDate`; 30-minute inactivity timeout
  and a daily reset. `menuContext` = `{sub_institute_id, user_id,
  user_profile_name, user_profile_id, client_id}`.
- **Existing intelligence surface**: `lib/intelligence/*` and
  `app/capability-intelligence/*` already exist. They target a *different*
  API family (`/api/ai/...`) that is **not present in this `next_lms_erp`
  checkout** — they are an LMS-native AI feature, not a Brain port. They are
  left untouched.

## 3. LMS backend architecture (`next_lms_erp`)

- **Framework**: Laravel 9, `"php": "^8.0"`. No `declare(strict_types=1)`,
  no enums, no readonly properties anywhere in `app/` — the codebase targets
  PHP 8.0 syntax.
- **Size**: 466 controllers, 96 models, 555 migrations, 27 route files.
- **Route registration**: `app/Providers/RouteServiceProvider.php` has one
  `mapXxxRoutes()` method per route file, each calling
  `Route::middleware(...)->namespace($this->namespace)->group(base_path('routes/x.php'))`.
  New modules are added by adding a file plus a mapper method — this is the
  established extension seam.
- **Middleware aliases** (`app/Http/Kernel.php`): `session`, `menu`,
  `mastersetup_menu`, `logRoute`, `jwt` (GenTux), `check_permissions`.
- **Auth**: `app/Http/Controllers/api/ApiLoginController.php::login()` verifies
  credentials and mints a **HS256 JWT** via `GenTux\Jwt\JwtToken::createToken()`
  with claims `{id, sub_institute_id, is_admin, client_id, user_profile_id,
  is_student}`, returned as `data.user_token`. Signed with `JWT_SECRET` from
  `.env`.
- **Menu/authorisation tables**: `tblmenumaster` (`id, parent_menu_id, level,
  name, link, menu_type, sub_institute_id` CSV, `client_id` CSV, `sort_order`,
  `status`), `tblgroupwise_rights` (`profile_id, menu_id, sub_institute_id`),
  `tblindividual_rights` (`user_id, profile_id, menu_id, sub_institute_id`).
  `MenuRightsController::getMenuRightsLevelWise()` joins `tbluser` →
  rights → `tblmenumaster` with `FIND_IN_SET(sub_institute_id, m.sub_institute_id)`.
- **Database**: MySQL `vivek_erp` on `202.47.117.220`.

## 4. Enterprise Brain architecture (`hp-enterprise-brain`)

- **Backend**: Laravel 11. `routes/api.php` (860 lines) registers everything
  under `/api/v1`, in three bands:
  - public, throttled: `auth/login`, `auth/logout`, `auth/refresh`, `auth/signup`
  - authenticated: `middleware(['jwt','tenant','permission:read'])`
  - each mutating route additionally states its verb
    (`permission:create|update|delete`) or a governance permission
    (`decision.approve`, `eso.execute`, `settings.manage`, `events.manage`,
    `tenant.manage`).
- **Middleware**:
  - `AuthenticateJwt` — HS256 bearer, requires `type=access`, stashes
    `auth.userId` (`sub`), `auth.tenantId`, `auth.role` on request attributes.
  - `EnsureTenantScope` — the token's tenant is the *only* tenant usable; a
    `{tenantId}` route parameter may only *match* it, never switch it. Sets
    `tenantId`.
  - `RequirePermission` — role→permission table, **fails closed**, and writes
    every denial to `hpbrain_audit_logs` inside a `try/catch` so an audit
    failure can never turn a 403 into a 500.
- **Domain**: 26 domains under `app/Domain/` (Capability, Signals, Evidence,
  Reasoning, Recommendation, Cases, CaseFile, Eso, Knowledge, Learning, Metrics,
  Operations, Policy, Graph, Ingestion, Intelligence, Kasba, Industry, Ai,
  Authorization, Tenancy, Universal, Verbs, Events, Organization, People,
  School).
- **Frontend**: React 18 SPA. **Not** react-router — `web/src/App.tsx` (819
  lines) is a state machine over a `View` string union of 31 views, with
  `React.lazy`-style dynamic imports per screen. `web/src/shell/viewMeta.ts` is
  the single source of nav truth (label, section, icon, `requiresOrg`,
  breadcrumb); `web/src/shell/roleAccess.ts` holds per-role view allow-lists and
  is explicitly documented as *advisory only* — the API re-checks.

## 5–7. LMS Organization / Department / People implementation

The LMS owns these in its own ERP tables, keyed by `sub_institute_id`:

| Concept | LMS table | Tenant key |
|---|---|---|
| Organization | `institute_detail` (+ `org_details` profile, `school_setup` for school-shaped installs) | `sub_institute_id` |
| Department | `hrms_departments` | `sub_institute_id` |
| Person | `tbluser` (+ `tbluserprofilemaster` profile) | `sub_institute_id` |
| Position | `hrms_job_titles` | `sub_institute_id` |
| Student | `tblstudent` | `sub_institute_id` |

All five are confirmed present in `next_lms_erp/database/migrations`.

## 8. Brain Capabilities implementation

- **Route family** (11 routes): `capabilities/{tenantId}` (index),
  `/search`, `POST capabilities`, `/{id}`, `PATCH /{id}`, `/{id}/version`,
  `/{id}/versions`, `/{id}/archive`, `/{id}/assign`, `/{id}/assignments`,
  `/{id}/audit`.
- **Controller**: `app/Http/Controllers/Api/CapabilityController.php` (235
  lines), query-builder only (`DB::table`), plus `CapabilityRepository`.
- **Tables**: `hpbrain_capabilities`, `hpbrain_capability_versions`,
  `hpbrain_capability_assignments` (polymorphic
  `target_type ∈ {Person, Department, JobRole, Organization}` + `target_id`),
  `hpbrain_capability_proficiency`, `hpbrain_capability_tasks`,
  `hpbrain_job_role_capability_requirements`.
- **KASBA**: capabilities carry five JSON columns — `knowledge`, `ability`,
  `skill`, `behaviour`, `attitude`.
- **Versioning is append-only** by design, so historical assessments stay
  interpretable.
- **Frontend**: `web/src/components/capability/` — 8 files, 1,139 LOC.

## 9. Brain dependency tree (as found in the source)

```
Organization / OrganizationUnit / Person / Position / Student
        (resolved to ERP tables via hpbrain_entity_mappings)
                         │
                         ▼
                   Capabilities ──────────────► KASBA (proficiency, tasks, heatmap)
                         │                            │
                         ▼                            ▼
                    Ingestion ───────────────►  Signals ──► Evidence
                (files + internal sources)          │            │
                                                    ▼            ▼
                                              Reasoning ──► Hypotheses ──► Cases
                                                                  │
                                                                  ▼
                                                          Recommendations
                                                                  │
                                                                  ▼
                                                            Decisions
                                                        (decision.approve)
                                                                  │
                                                                  ▼
                                                       ESO definitions/executions
                                                          (eso.execute)
                                                                  │
                                                                  ▼
                                                   Outcomes ──► Learnings
                                                                  │
                        ┌─────────────────────────────────────────┤
                        ▼                                         ▼
                    Analytics                            Organizational Memory
        (executive-summary, decision-intelligence,      Knowledge Library
         trend, reports, overviews)                     Mental Models, Graph
                                                                  │
                                                                  ▼
                                                     Automation: Policies,
                                                     Executors, Tasks, Agents
```

## 10. Brain modules after Capabilities (all discovered, by section)

- **Foundation**: Capabilities, Ingestion *(Organization/Departments/People
  excluded — reused from the LMS, per §4 of the brief)*
- **Intelligence Loop**: Signals, Evidence, Deliberation (cases + hypotheses),
  Intelligence Workspace, Execution Center (ESO)
- **Analytics**: Executive Dashboard, Decision Analytics, Decision Intelligence,
  Organizational Knowledge (mental models)
- **Knowledge**: Graph Explorer, KASBA Explorer, Knowledge Library, Memory,
  AI Assistant, ESO Library
- **Automation**: Agent Monitor, Task Orchestrator, Policy Management
- **Account**: Settings

## 11. Database comparison

**The decisive finding.** The Brain was architected from day one to *share a
database with the institute ERP*. Verbatim from
`database/migrations/2026_01_01_000400_capability.php`:

> "every table is `hpbrain_`-prefixed (the Brain shares a database with the
> institute ERP and must not collide with it)"

And `app/Domain/Universal/EntityResolver.php` resolves the universal vocabulary
(`Organization`, `OrganizationUnit`, `Person`, `Position`, `OrganizationProfile`,
`PersonProfile`, `Student`) to **whatever tables a tenant actually keeps them
in**, via `hpbrain_entity_mappings`. `EntityMappingSeeder` already maps those
names to `institute_detail`, `hrms_departments`, `tbluser`, `hrms_job_titles`,
`org_details`, `tbluserprofilemaster`, `tblstudent` — **the LMS's own tables**,
tenant-keyed on `sub_institute_id`.

Consequences:

- No `hpbrain_*` table collides with any LMS `tbl*` / `hrms_*` table.
- Organization, Departments, People, Positions and Students are **not**
  duplicated — the Brain reads the LMS rows through the resolver.
- `EntityResolver` **fails closed**: an unmapped entity throws rather than
  defaulting to another tenant's tables.
- `hpbrain_organizations`, `hpbrain_departments`, `hpbrain_people`,
  `hpbrain_students` exist in the reference schema but are legacy/satellite —
  the resolver path is the live one.

**Only the 105 `hpbrain_*` tables need to be added to `vivek_erp`.**

## 12. Authentication comparison

| | Brain | LMS |
|---|---|---|
| Mechanism | HS256 JWT, bearer | HS256 JWT (GenTux), `data.user_token` |
| Issued by | `POST /api/v1/auth/login` against `hpbrain_auth_users` | `POST /api/api-login` against `tbluser` |
| Claims | `sub`, `tenantId`, `role`, `type`, `jti`, `iat`, `exp` | `id`, `sub_institute_id`, `is_admin`, `client_id`, `user_profile_id`, `is_student` |
| Secret | `JWT_SECRET` | `JWT_SECRET` |

Both sides are the same algorithm and the same claim *shape*, differing only in
claim *names*. That makes a genuine bridge possible: the LMS token already
carries the tenant (`sub_institute_id`) and the identity (`id`).

**Decision**: no second login, no `hpbrain_auth_users` row required. A
`BrainAuthenticate` middleware verifies the **LMS's own** token and maps
`id → auth.userId`, `sub_institute_id → auth.tenantId`, and derives
`auth.role` from `user_profile_id` / `is_admin`.

## 13. Authorization comparison

- Brain: five roles (`admin`, `tenant_admin`, `manager`, `analyst`, `viewer`,
  falling back to `member`) × a permission set (`read`, `create`, `update`,
  `delete`, `decision.approve`, `eso.execute`, `settings.manage`,
  `events.manage`, `tenant.manage`). Enforced by `RequirePermission`, fails
  closed, audits denials.
- LMS: `tbluserprofilemaster` profiles × `tblgroupwise_rights` /
  `tblindividual_rights` per `tblmenumaster` row.

**Decision**: keep the Brain's permission model (it is what the route table is
written against) and *derive* the Brain role from the LMS profile, so LMS
profiles remain the single place a role is administered. Menu visibility stays
under LMS rights (`tblmenumaster` + `tblgroupwise_rights`).

## 14. Tenant architecture

One key on both sides: `sub_institute_id`. Every `hpbrain_*` table carries
`tenant_id VARCHAR(36)`; the Brain writes the tenant from the token and
`EnsureTenantScope` refuses any route parameter that disagrees. Mapped ERP
reads are additionally constrained by `ResolvedSource::$tenantKey`, which is
`sub_institute_id` for every LMS entity. So a single value flows
LMS login → JWT → middleware → every Brain query.

## 15. Files that can be reused / adapted

**Adapted near-verbatim** (query-builder only, no Laravel-11-specific API):
- migrations — raw `DB::unprepared` SQL with `CREATE TABLE IF NOT EXISTS`,
  portable as-is
- `app/Domain/Universal/*` (EntityResolver, ResolvedSource, SourceSchema)
- `app/Repositories/*`
- most `app/Http/Controllers/Api/*` bodies

**Must be rewritten for PHP 8.0 / Laravel 9**:
- `declare(strict_types=1)`, `final class`, `readonly` promoted properties
- `App\Domain\Authorization\Role` / `Permission` **enums** → class constants
- first-class callable / `match` where used

**Frontend — re-authored, not copied**: the Brain SPA is a `View`-union state
machine with its own CSS design tokens. The LMS is App Router + Tailwind 4 +
shadcn. Screens are re-implemented as Next.js routes against the same API
contracts and the same data.

## 16. Backend changes required (`next_lms_erp`)

1. Migrations creating the `hpbrain_*` schema (idempotent, `IF NOT EXISTS`).
2. `app/Brain/` — Support (JWT bridge), Authorization (Role/Permission),
   Universal (EntityResolver + friends), Repositories, Services.
3. `app/Http/Middleware/Brain/*` — `BrainAuthenticate`, `BrainTenantScope`,
   `BrainRequirePermission`; aliases in `Kernel.php`.
4. `app/Http/Controllers/Brain/*` — the ported controllers.
5. `routes/brain.php` + `mapBrainRoutes()` in `RouteServiceProvider`.
6. Seeders: entity mappings pointed at LMS tables; `tblmenumaster` rows +
   `tblgroupwise_rights` for the sidebar.
7. `/api/brain/access` — reports whether the caller may see the module.

## 17. Frontend changes required (`lms_k12`)

1. `app/enterprise-brain/**` — layout + one route per Brain view.
2. `lib/brain/*` — API client (LMS token + `API_BASE_URL`), types, nav map.
3. Sidebar: an "Enterprise Brain" level-1 entry, server-authorised.
4. `app/data/routeMapper.ts` — map the Brain menu link to `/enterprise-brain`.

## 18. Database changes required

Add the 105 `hpbrain_*` tables to `vivek_erp`. **No LMS table is altered, and
no LMS data is duplicated.** Seed `hpbrain_entity_mappings` per
`sub_institute_id` from `institute_detail`.

## 19. Risks

| Risk | Mitigation |
|---|---|
| **`next_lms_erp` has no `vendor/`** — cannot run `artisan migrate`, seeders or PHPUnit locally | Ship migrations/seeders as code; document the exact commands. Verified by static review + frontend type-check instead. |
| Direct MySQL access to `202.47.117.220` was **blocked by the environment's command classifier** | Could not execute or verify DDL. Migrations are written idempotently (`IF NOT EXISTS`) so they are safe to run. |
| PHP 8.0 target vs Brain's 8.2 syntax | All ported code written without enums/readonly/`never`. |
| Laravel 9 vs 11 | Ported code uses only `DB::table`, `Request`, `response()->json`, `Route::` — stable across both. |
| Tenant leak via route parameter | `BrainTenantScope` refuses a mismatch, exactly as the reference does. |
| Menu rows are DB-seeded; sidebar would be empty until the seeder runs | Sidebar entry is *declared in code* (the existing `NEW_PAL_LEVEL3_ITEMS` precedent) and *authorised by the server* via `/api/brain/access`, so it works before and after seeding. |
| N+1 on capability/assignment joins | Aggregate counts fetched in one grouped query, not per row. |

## 20. Implementation plan

1. Brain schema migrations → `next_lms_erp/database/migrations`
2. Brain kernel: JWT bridge, tenant scope, permissions, entity resolver
3. `routes/brain.php` + provider wiring
4. Controllers: Capabilities → Ingestion → Intelligence Loop → Analytics →
   Knowledge → Automation → Settings
5. Seeders: entity mappings, menu rows + rights
6. `lms_k12`: Brain API client, shell layout, one page per view
7. Sidebar entry + route mapping
8. Type-check / lint / test; verify no `hp-enterprise-brain` file changed

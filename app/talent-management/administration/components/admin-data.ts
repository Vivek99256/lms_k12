/**
 * Talent Management "Administration & Governance" — KPI card config.
 *
 * G2G's `mockAdminKPIs`/`mockWorkflows` (ported here unchanged, then found to
 * have no real backing) have been removed. `mockWorkflows` had zero
 * consumers — `AdminCenter`'s workflow table is driven entirely by
 * `AdminService.getWorkflows` — and G2G never wired the KPI cards to a real
 * endpoint either: there is no `/talent/admin/kpis` route, and the target
 * backend's `AdminWorkflowController` only exposes `index`/`show` for the
 * workflow list (see that controller's own docblock).
 *
 * Of the five KPIs, only "Active Workflows" is backed by real data — it's
 * the same `pagination.total` `AdminCenter` already receives from
 * `AdminService.getWorkflows`, computed in `admin-center.tsx`. The other
 * four (Templates, User Roles, Integrations, Audit Events) have no table or
 * endpoint anywhere in this module, so their cards render "—" rather than a
 * fabricated count. Only the label/icon/link text below is static — that's
 * UI configuration, not data.
 */

import type { AdminKPI } from '../../_lib/talent-types'

export type { AdminKPI, Workflow, WorkflowApprover, WorkflowStage } from '../../_lib/talent-types'

export type AdminKpiConfig = Omit<AdminKPI, 'value'>

export const adminKpiConfig: AdminKpiConfig[] = [
  { id: 'kpi-1', title: 'Active Workflows', linkText: 'View all workflows', icon: 'git-merge' },
  { id: 'kpi-2', title: 'Templates', linkText: 'View all templates', icon: 'file-text' },
  { id: 'kpi-3', title: 'User Roles', linkText: 'View all roles', icon: 'users' },
  { id: 'kpi-4', title: 'Integrations', linkText: 'View all integrations', icon: 'plug' },
  { id: 'kpi-5', title: 'Audit Events (30 Days)', linkText: 'View audit logs', icon: 'shield-check' },
]

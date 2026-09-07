/**
 * Administration & Governance — types.
 *
 * Ported from g2gv0's `services/lms/governance.ts`. Shapes are preserved
 * exactly; only the transport (services/lms/governance.ts's apiClient calls)
 * was re-pointed, in administration-governance-service.ts, at this repo's
 * erp-client conventions and the `api/g2g-lms/administration-governance/*`
 * endpoint contract.
 */

export interface GovernanceKpis {
  users: number
  active_users: number
  roles: number
  permissions: number
  trainers: number
  vendors: number
  integrations: number
  /** Audit events in the last 30 days, scoped to this tenant. */
  audit_logs: number
}

export interface GovernanceUser {
  id: number
  user_name: string | null
  first_name: string | null
  middle_name: string | null
  last_name: string | null
  full_name: string
  initials: string
  email: string | null
  mobile: string | null
  employee_no: string | null
  /** 1 active, 0 inactive. */
  status: number
  last_login: string | null
  user_profile_id: number | null
  profile_name: string | null
  department_id: number | null
  department_name: string | null
  image: string | null
  created_at: string | null
}

export interface UserPayload {
  first_name: string
  last_name?: string | null
  middle_name?: string | null
  email: string
  mobile?: string | null
  employee_no?: string | null
  user_profile_id: number
  department_id?: number | null
  status?: number
  /** Required on create only; omitted on update to leave the password alone. */
  user_name?: string
  password?: string
}

export interface UserQuery {
  page?: number
  perPage?: number
  search?: string
  status?: string
  profileId?: number | string
  departmentId?: number | string
  sortBy?: 'name' | 'email' | 'status' | 'last_login'
  sortDir?: 'asc' | 'desc'
}

export interface GovernanceRole {
  id: number
  name: string
  description: string | null
  parent_id: number | null
  sort_order: number | null
  status: number
  user_count: number
  permission_count: number
}

export interface RolePayload {
  name: string
  description?: string | null
  parent_id?: number | null
  sort_order?: number | null
  status?: number
}

/** One row of the permission matrix: a menu plus this role's four flags. */
export interface PermissionRow {
  id: number
  menu_name: string
  parent_id: number | null
  level: number | null
  access_link: string | null
  icon: string | null
  sort_order: number | null
  can_view: boolean
  can_add: boolean
  can_edit: boolean
  can_delete: boolean
}

export interface PermissionUpdate {
  menu_id: number
  can_view: boolean
  can_add: boolean
  can_edit: boolean
  can_delete: boolean
}

export type TrainerType = 'internal' | 'external'

export interface Trainer {
  id: number
  name: string
  email: string | null
  phone: string | null
  trainer_type: TrainerType | string
  vendor_id: number | null
  vendor_name: string | null
  user_id: number | null
  specialisation: string | null
  bio: string | null
  qualifications: string | null
  hourly_rate: string | number | null
  currency: string | null
  status: number
  session_count: number
  linked_session_count: number
  unlinked_session_count: number
  created_at: string | null
}

export interface TrainerPayload {
  name: string
  email?: string | null
  phone?: string | null
  trainer_type?: TrainerType
  vendor_id?: number | null
  user_id_link?: number | null
  specialisation?: string | null
  bio?: string | null
  qualifications?: string | null
  hourly_rate?: number | null
  currency?: string | null
  status?: boolean
}

/** Derived from contract_end, never stored, so it cannot go stale. */
export type ContractState = 'open' | 'active' | 'expiring' | 'expired'

export interface Vendor {
  id: number
  name: string
  vendor_code: string | null
  contact_person: string | null
  email: string | null
  phone: string | null
  website: string | null
  address: string | null
  service_type: string | null
  contract_start: string | null
  contract_end: string | null
  contract_value: string | number | null
  currency: string | null
  status: number
  notes: string | null
  trainer_count: number
  contract_state: ContractState
  /** Negative once the contract has lapsed. Null when open-ended. */
  days_to_expiry: number | null
}

export interface VendorPayload {
  name: string
  vendor_code?: string | null
  contact_person?: string | null
  email?: string | null
  phone?: string | null
  website?: string | null
  address?: string | null
  service_type?: string | null
  contract_start?: string | null
  contract_end?: string | null
  contract_value?: number | null
  currency?: string | null
  status?: boolean
  notes?: string | null
}

export type IntegrationStatus = 'connected' | 'disconnected' | 'error'

export interface Integration {
  id: number
  provider: string
  display_name: string
  category: string | null
  description: string | null
  status: IntegrationStatus | string
  connected_at: string | null
  last_sync_at: string | null
  last_error: string | null
  /** Non-sensitive settings only — no tokens or keys are stored. */
  config: Record<string, unknown> | null
  created_at: string | null
}

export interface IntegrationPayload {
  provider: string
  display_name: string
  category?: string | null
  description?: string | null
  status?: IntegrationStatus
  config?: Record<string, unknown> | null
}

export interface AuditLog {
  /** UUID-keyed. */
  id: string
  entity_type: string | null
  entity_id: string | number | null
  action: string | null
  actor_id: number | null
  actor_name: string | null
  ip_address: string | null
  status: string | null
  source: string | null
  created_at: string | null
}

export interface AuditQuery {
  page?: number
  perPage?: number
  search?: string
  action?: string
  entityType?: string
  from?: string
  to?: string
}

/** Each check is actually performed; 'unknown' means it could not be. */
export type HealthStatus = 'healthy' | 'warning' | 'error' | 'unknown'

export interface HealthCheck {
  key: string
  label: string
  status: HealthStatus | string
  detail: string
}

export interface GovernanceResponse<T> {
  status: boolean
  message?: string
  data: T
}

export interface GovernancePaginatedResponse<T> {
  status: boolean
  data: T[]
  meta: {
    current_page: number
    last_page: number
    per_page: number
    total: number
    journey_events?: number
  }
  filters?: { actions: string[]; entity_types: string[] }
}

/** Minimal department shape the users tab needs — see organizationService. */
export interface GovernanceDepartment {
  id: number
  department: string
}

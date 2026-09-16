/**
 * Integration Management — types.
 *
 * These types model editable integration configurations stored in the
 * task-management backend, separate from the read-only server-side
 * `IntegrationStatus` entries.
 */

export interface IntegrationProviderDef {
  key: string
  name: string
  category: string
  description: string
  icon: string
  fields: IntegrationFieldDef[]
  /**
   * When set, clicking this provider's card navigates to this route instead
   * of opening the generic inline config form — for providers (e.g.
   * Razorpay) whose real settings screen already exists elsewhere and is
   * reused as-is rather than duplicated here.
   */
  route?: string
}

export interface IntegrationFieldDef {
  key: string
  label: string
  type: 'text' | 'password' | 'number' | 'select' | 'toggle' | 'textarea'
  required?: boolean
  placeholder?: string
  options?: Array<{ label: string; value: string }>
}

export interface IntegrationConfig {
  id: number
  provider_key: string
  display_name: string
  category: string
  description: string
  status: 'active' | 'inactive' | 'error'
  config: Record<string, string | number | boolean | null>
  last_tested_at: string | null
  last_tested_by: string | null
  last_updated_at: string | null
  last_updated_by: string | null
  created_at: string | null
}

export interface IntegrationConfigPayload {
  provider_key: string
  display_name: string
  category?: string | null
  description?: string | null
  status?: 'active' | 'inactive' | 'error'
  config: Record<string, string | number | boolean | null>
}

export interface IntegrationConfigsResponse {
  status: 1
  message: string
  data: { configs: IntegrationConfig[] }
}

export interface IntegrationConfigResponse {
  status: 1
  message: string
  data: IntegrationConfig
}

export interface IntegrationTestResponse {
  status: 1
  message: string
  success: boolean
}

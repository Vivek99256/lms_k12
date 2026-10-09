'use client'

/**
 * Integration Management — API.
 *
 * Talks to the persisted Platform integrations store in Laravel
 * (/api/platform/integrations, via lib/platform/client.ts), which keeps one row
 * per provider per institute and encrypts every credential at rest. The old
 * in-memory stub under app/api/integration-configs is gone: it lost everything
 * on a server restart and could only pretend to test a connection.
 *
 * This file only adapts shapes, so the existing Integration screens keep their
 * `IntegrationConfig` type. Secrets come back masked as `********`; the form
 * round-trips that value untouched and the server keeps the stored secret.
 */

import {
  createIntegration,
  deleteIntegration,
  fetchIntegrations,
  testIntegration,
  updateIntegration,
} from '@/lib/platform/client'
import type { PlatformIntegration } from '@/lib/platform/types'
import type {
  IntegrationConfig,
  IntegrationConfigPayload,
  IntegrationTestResponse,
} from './integration-types'

/**
 * The screens group providers by a display category ("Communication"); the
 * store keys them by what the provider does. Keyed by provider, not by the
 * display group, because "Communication" covers four different store categories.
 */
const STORE_CATEGORY: Record<string, string> = {
  sms_gateway: 'sms',
  whatsapp_api: 'whatsapp',
  email_smtp: 'email',
  push_notification: 'push',
  razorpay: 'payment',
  biometric_attendance: 'biometric',
}

function storeCategory(payload: IntegrationConfigPayload): string {
  return STORE_CATEGORY[payload.provider_key] ?? payload.category ?? 'sms'
}

function toConfig(row: PlatformIntegration): IntegrationConfig {
  return {
    id: row.id,
    provider_key: row.provider_key,
    display_name: row.display_name,
    category: row.category,
    description: row.description ?? '',
    status: row.status,
    config: row.config,
    last_tested_at: row.last_tested_at,
    last_tested_by: row.last_tested_by,
    last_updated_at: row.updated_at,
    last_updated_by: row.updated_by,
    created_at: row.created_at,
    is_sample: row.is_sample,
  }
}

export async function fetchIntegrationConfigs(): Promise<IntegrationConfig[]> {
  const rows = await fetchIntegrations()
  return rows.map(toConfig)
}

export async function createIntegrationConfig(payload: IntegrationConfigPayload): Promise<IntegrationConfig> {
  const row = await createIntegration({
    provider_key: payload.provider_key,
    display_name: payload.display_name,
    category: storeCategory(payload),
    description: payload.description ?? '',
    status: payload.status ?? 'inactive',
    config: payload.config,
  })
  return toConfig(row)
}

export async function updateIntegrationConfig(
  id: number,
  payload: IntegrationConfigPayload,
): Promise<IntegrationConfig> {
  const row = await updateIntegration(id, {
    display_name: payload.display_name,
    description: payload.description ?? '',
    status: payload.status ?? 'inactive',
    config: payload.config,
  })
  return toConfig(row)
}

export async function deleteIntegrationConfig(id: number): Promise<void> {
  await deleteIntegration(id)
}

/**
 * Test a SAVED configuration. The server tests what it has stored (that is the
 * only place the real secrets live), so the result describes the saved settings,
 * not unsaved edits in the form.
 */
export async function testIntegrationConnection(id: number): Promise<IntegrationTestResponse> {
  const result = await testIntegration(id)
  return {
    status: 1,
    message: result.message,
    success: result.ok,
  }
}

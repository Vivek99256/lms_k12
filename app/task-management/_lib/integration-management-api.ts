'use client'

/**
 * Integration Management — API.
 *
 * Calls the Next.js API routes under `/api/integration-configs` because the
 * Laravel backend does not yet expose `/task-management/integration-configs`.
 * The Next.js route handlers provide the CRUD surface with in-memory storage
 * so the dashboard is fully functional until the backend is extended.
 */

import {
  buildSessionContext,
  createAuthHeaders,
  type SessionContext,
} from '@/lib/erp-client'
import type {
  IntegrationConfigPayload,
  IntegrationConfigResponse,
  IntegrationConfigsResponse,
  IntegrationTestResponse,
} from './integration-types'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function apiGet<T>(path: string): Promise<T> {
  const session = buildSessionContext()
  if (!session.token || !session.subInstituteId) {
    throw new Error('Your session could not be resolved. Please sign in again.')
  }

  const url = new URL(path, window.location.origin)
  const response = await fetch(url.toString(), {
    method: 'GET',
    headers: {
      ...createAuthHeaders(session),
      Accept: 'application/json',
    },
    cache: 'no-store',
  })

  const payload = (await response.json().catch(() => ({}))) as unknown
  if (!response.ok) {
    const message =
      (payload as { message?: string } | null)?.message || `API Error: ${response.status} ${response.statusText}`
    throw new Error(message)
  }
  return payload as T
}

async function apiSend<T>(path: string, method: 'POST' | 'PUT' | 'PATCH' | 'DELETE', body: unknown): Promise<T> {
  const session = buildSessionContext()
  if (!session.token || !session.subInstituteId) {
    throw new Error('Your session could not be resolved. Please sign in again.')
  }

  const url = new URL(path, window.location.origin)
  const response = await fetch(url.toString(), {
    method,
    headers: {
      ...createAuthHeaders(session),
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify(body),
    cache: 'no-store',
  })

  const payload = (await response.json().catch(() => ({}))) as unknown
  if (!response.ok) {
    const message =
      (payload as { message?: string } | null)?.message || `API Error: ${response.status} ${response.statusText}`
    throw new Error(message)
  }
  return payload as T
}

// ---------------------------------------------------------------------------
// List
// ---------------------------------------------------------------------------

export async function fetchIntegrationConfigs(): Promise<IntegrationConfigsResponse> {
  return apiGet<IntegrationConfigsResponse>('/api/integration-configs')
}

// ---------------------------------------------------------------------------
// Create / Update / Delete
// ---------------------------------------------------------------------------

export async function createIntegrationConfig(
  payload: IntegrationConfigPayload,
): Promise<IntegrationConfigResponse> {
  return apiSend<IntegrationConfigResponse>('/api/integration-configs', 'POST', payload)
}

export async function updateIntegrationConfig(
  id: number,
  payload: IntegrationConfigPayload,
): Promise<IntegrationConfigResponse> {
  return apiSend<IntegrationConfigResponse>(`/api/integration-configs/${id}`, 'PUT', payload)
}

export async function deleteIntegrationConfig(
  id: number,
): Promise<{ status: 1; message: string }> {
  return apiSend<{ status: 1; message: string }>(`/api/integration-configs/${id}`, 'DELETE', {})
}

// ---------------------------------------------------------------------------
// Test connection
// ---------------------------------------------------------------------------

export async function testIntegrationConnection(
  providerKey: string,
  config: Record<string, unknown>,
): Promise<IntegrationTestResponse> {
  return apiSend<IntegrationTestResponse>('/api/integration-configs/test', 'POST', {
    provider_key: providerKey,
    config,
  })
}

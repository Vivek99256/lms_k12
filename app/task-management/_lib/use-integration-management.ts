'use client'

/**
 * Integration Management — state hook.
 *
 * One hook wrapping the new integration-management API, following the same
 * load/save lifecycle pattern as the other task-management hooks.
 */

import { useCallback, useEffect, useMemo, useState } from 'react'

import { resolveTaskSession, toMessage, TASK_SESSION_ERROR } from './task-session'
import type { IntegrationConfig, IntegrationConfigPayload } from './integration-types'
import {
  createIntegrationConfig,
  deleteIntegrationConfig,
  fetchIntegrationConfigs,
  testIntegrationConnection,
  updateIntegrationConfig,
} from './integration-management-api'

export function useIntegrationManagement() {
  const [configs, setConfigs] = useState<IntegrationConfig[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [testing, setTesting] = useState(false)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')

  const session = useMemo(() => resolveTaskSession(), [])
  const canAdminister =
    session !== null &&
    (session.isAdmin === '1' || session.isAdmin === 'true' || session.isAdmin === '1.0')

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    setMessage('')
    try {
      const response = await fetchIntegrationConfigs()
      setConfigs(response.data.configs)
    } catch (reason) {
      setError(toMessage(reason, 'Unable to load integration configs.'))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    queueMicrotask(() => {
      void load()
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const save = useCallback(
    async (payload: IntegrationConfigPayload, id?: number) => {
      if (!session) {
        setError(TASK_SESSION_ERROR)
        return
      }
      setSaving(true)
      setError('')
      setMessage('')
      try {
        const response = id
          ? await updateIntegrationConfig(id, payload)
          : await createIntegrationConfig(payload)
        setMessage(response.message)
        await load()
      } catch (reason) {
        setError(toMessage(reason, 'Unable to save the integration config.'))
      } finally {
        setSaving(false)
      }
    },
    [load, session],
  )

  const remove = useCallback(
    async (id: number) => {
      if (!session) {
        setError(TASK_SESSION_ERROR)
        return
      }
      setSaving(true)
      setError('')
      setMessage('')
      try {
        const response = await deleteIntegrationConfig(id)
        setMessage(response.message)
        await load()
      } catch (reason) {
        setError(toMessage(reason, 'Unable to remove the integration config.'))
      } finally {
        setSaving(false)
      }
    },
    [load, session],
  )

  const testConnection = useCallback(
    async (providerKey: string, config: Record<string, unknown>): Promise<{ success: boolean; message: string }> => {
      if (!session) {
        return { success: false, message: TASK_SESSION_ERROR }
      }
      setTesting(true)
      try {
        const response = await testIntegrationConnection(providerKey, config)
        return { success: response.success, message: response.message }
      } catch (reason) {
        return { success: false, message: toMessage(reason, 'Connection test failed.') }
      } finally {
        setTesting(false)
      }
    },
    [session],
  )

  return {
    configs,
    loading,
    saving,
    testing,
    error,
    message,
    canAdminister,
    save,
    remove,
    testConnection,
    reload: load,
    dismiss: () => {
      setError('')
      setMessage('')
    },
  }
}

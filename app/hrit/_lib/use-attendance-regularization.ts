'use client'

import { useCallback, useEffect, useState } from 'react'
import {
  cancelRegularization,
  getRegularizationRequests,
  submitRegularization,
  subscribeRegularizationStore,
  type RegularizationApplyPayload,
  type RegularizationRequest,
} from './attendance-regularization-api'

/**
 * Thin React binding over the in-memory store in attendance-regularization-api.ts.
 * See that file's header for why this isn't a real API-backed hook yet.
 */
export function useAttendanceRegularization() {
  const [requests, setRequests] = useState<RegularizationRequest[]>(() => getRegularizationRequests())
  const [processing, setProcessing] = useState(false)
  const [message, setMessage] = useState<string | null>(null)

  useEffect(() => subscribeRegularizationStore(() => setRequests(getRegularizationRequests())), [])

  const apply = useCallback(async (payload: RegularizationApplyPayload) => {
    setProcessing(true)
    try {
      const result = await submitRegularization(payload)
      setMessage(result.message)
      return result
    } finally {
      setProcessing(false)
    }
  }, [])

  const cancel = useCallback(async (id: string) => {
    setProcessing(true)
    try {
      const result = await cancelRegularization(id)
      setMessage(result.message)
      return result
    } finally {
      setProcessing(false)
    }
  }, [])

  return {
    requests,
    processing,
    message,
    clearMessage: () => setMessage(null),
    apply,
    cancel,
  }
}

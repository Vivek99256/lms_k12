'use client'

/**
 * Ported from G2G's `tm-reports.tsx`, which fetched directly inline (no
 * separate hook existed in G2G — this file factors that logic out only
 * because this project's ported pages follow a component/hook split, per
 * `use-recruitment.ts` / `app/hrit/_lib/use-payroll.ts`). Behaviour is
 * unchanged: `load()` fetches productivity + delays in parallel, then the LMS
 * learning bridge separately — a 404 there ("no rejected tasks") is treated
 * as an answer, not an error, exactly like G2G.
 */

import { useCallback, useEffect, useState } from 'react'

import { resolveTaskSession, toMessage } from './task-session'
import { reportsService } from './reports-api'
import type { DelayReport, ProductivityRow } from './task-types'

export function useReports() {
  const [productivity, setProductivity] = useState<ProductivityRow[]>([])
  const [delays, setDelays] = useState<DelayReport | null>(null)
  const [learning, setLearning] = useState<unknown>(null)
  const [learningMessage, setLearningMessage] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    const session = resolveTaskSession()
    if (!session) {
      setError('Your ERP session is unavailable. Please sign in again.')
      setLoading(false)
      return
    }
    setLoading(true)
    setError('')
    try {
      const [productivityResponse, delaysResponse] = await Promise.all([
        reportsService.getProductivityReport(session),
        reportsService.getDelaysReport(session),
      ])
      setProductivity(productivityResponse.data.rows)
      setDelays(delaysResponse.data)

      // The LMS bridge 404s when the user has no rejected tasks - that is an
      // answer ("nothing to recommend"), not an error.
      try {
        const learningResponse = await reportsService.getRejectedTaskLearning(session)
        setLearning(learningResponse.data ?? null)
        setLearningMessage(learningResponse.message ?? '')
      } catch {
        setLearning(null)
        setLearningMessage('No rejected tasks — no learning recommendations right now.')
      }
    } catch (reason) {
      setError(toMessage(reason, 'Unable to load reports.'))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    // Deferred so the load's first setState lands after this render.
    queueMicrotask(() => {
      void load()
    })
  }, [load])

  return { productivity, delays, learning, learningMessage, loading, error, refresh: load }
}

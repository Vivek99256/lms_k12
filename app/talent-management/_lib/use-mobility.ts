'use client'

/**
 * Talent Management - Mobility & Succession hooks.
 *
 * G2G's `mobility-center.tsx` has no dedicated hook file: it calls
 * `mobilityService` directly from local `useState`/`useEffect` inside the
 * component itself (see `services/talent/mobility.ts`). Per this project's
 * convention (`app/hrit/_lib/use-payroll.ts`, `app/hrit/_lib/use-leave.ts`),
 * this file provides that structural wrapper as a set of per-resource hooks —
 * loading/processing/error/actionMessage/retry/save/remove, mirroring
 * `usePayrollTypes()`'s shape — one hook per sub-area of the Mobility &
 * Succession Center (overview+filters, jobs, applications, transfers,
 * promotions, successions, pools, pool members).
 *
 * `mobility-and-succession/components/mobility-center.tsx` itself was ported
 * using `mobilityService` + `buildSessionContext()` directly (the other
 * option this migration allows), matching G2G's own direct-service-call
 * structure line for line - the source component's single `fetchListData`
 * effect fans out to whichever resource the active tab needs, shares one
 * loading/error pair across all of them, and keeps a "selected job" side
 * panel driven by a second effect; splitting that into independent
 * per-resource hooks here would change *when* each request fires relative to
 * the others, which is a behavior change the migration explicitly rules out.
 * These hooks remain available for any future screen that only needs one
 * resource at a time.
 */

import { useCallback, useEffect, useState } from 'react'

import {
  buildSessionContext,
  isMobilitySessionReady,
  mobilityService,
  type MobilityApplication,
  type MobilityFiltersData,
  type MobilityJob,
  type MobilityOverviewData,
  type MobilityPromotion,
  type MobilitySuccessionPlan,
  type MobilityTalentPool,
  type MobilityTransfer,
  type SessionContext,
  type TalentPoolMember,
} from './mobility-api'

function toMessage(error: unknown, fallback: string) {
  return error instanceof Error && error.message ? error.message : fallback
}

/** The session context is rebuilt per call - it reads live storage, not React state. */
function useMobilitySession() {
  return useCallback(() => buildSessionContext(), [])
}

/* ------------------------------------------------------------------ *
 * Overview + shared filter options
 * ------------------------------------------------------------------ */

export function useMobilityOverview() {
  const resolveSession = useMobilitySession()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [overview, setOverview] = useState<MobilityOverviewData | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)

    const session = resolveSession()
    if (!isMobilitySessionReady(session)) {
      setOverview(null)
      setError('Your session could not be resolved. Please sign in again.')
      setLoading(false)
      return
    }

    try {
      const response = await mobilityService.getOverview(session)
      setOverview(response.status === 1 ? response.data : null)
    } catch (loadError) {
      setError(toMessage(loadError, 'Failed to load the mobility overview.'))
      setOverview(null)
    } finally {
      setLoading(false)
    }
  }, [resolveSession])

  useEffect(() => {
    queueMicrotask(() => {
      load()
    })
  }, [load])

  return { loading, error, overview, retry: load }
}

export function useMobilityFilters() {
  const resolveSession = useMobilitySession()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [filters, setFilters] = useState<MobilityFiltersData | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)

    try {
      const response = await mobilityService.getFilters(resolveSession())
      setFilters(response.status === 1 ? response.data : null)
    } catch (loadError) {
      setError(toMessage(loadError, 'Failed to load mobility filters.'))
      setFilters(null)
    } finally {
      setLoading(false)
    }
  }, [resolveSession])

  useEffect(() => {
    queueMicrotask(() => {
      load()
    })
  }, [load])

  return { loading, error, filters, retry: load }
}

/* ------------------------------------------------------------------ *
 * Internal Jobs
 * ------------------------------------------------------------------ */

export function useMobilityJobs(filters?: Record<string, string>) {
  const resolveSession = useMobilitySession()
  const [loading, setLoading] = useState(true)
  const [processing, setProcessing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [actionMessage, setActionMessage] = useState<string | null>(null)
  const [jobs, setJobs] = useState<MobilityJob[]>([])
  const [total, setTotal] = useState(0)

  const filterKey = JSON.stringify(filters ?? {})

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)

    try {
      const response = await mobilityService.getJobs(resolveSession(), JSON.parse(filterKey))
      if (response.status === 1) {
        setJobs(response.data)
        setTotal(response.total)
      }
    } catch (loadError) {
      setError(toMessage(loadError, 'Failed to load internal jobs.'))
      setJobs([])
      setTotal(0)
    } finally {
      setLoading(false)
    }
  }, [filterKey, resolveSession])

  useEffect(() => {
    queueMicrotask(() => {
      load()
    })
  }, [load])

  const run = useCallback(
    async <T,>(action: (session: SessionContext) => Promise<{ status: number; data: T }>, fallback: string) => {
      setProcessing(true)
      setError(null)
      setActionMessage(null)

      try {
        const response = await action(resolveSession())
        if (response.status !== 1) throw new Error(fallback)
        await load()
        return { ok: true as const, data: response.data }
      } catch (actionError) {
        const message = toMessage(actionError, fallback)
        setError(message)
        return { ok: false as const, message }
      } finally {
        setProcessing(false)
      }
    },
    [load],
  )

  return {
    loading,
    processing,
    error,
    actionMessage,
    jobs,
    total,
    retry: load,
    clearMessages: () => {
      setError(null)
      setActionMessage(null)
    },
    create: (data: Partial<MobilityJob>) =>
      run((session) => mobilityService.createJob(session, data), 'Failed to create job posting.'),
    update: (id: number, data: Partial<MobilityJob>) =>
      run((session) => mobilityService.updateJob(session, id, data), 'Failed to update job posting.'),
    close: (id: number) =>
      run((session) => mobilityService.updateJob(session, id, { status: 'Closed' }), 'Failed to close job.'),
    remove: (id: number) =>
      run(
        (session) => mobilityService.deleteJob(session, id).then((response) => ({ ...response, data: undefined })),
        'Failed to delete job posting.',
      ),
  }
}

/* ------------------------------------------------------------------ *
 * Applications
 * ------------------------------------------------------------------ */

export function useMobilityApplications(filters?: Record<string, string>) {
  const resolveSession = useMobilitySession()
  const [loading, setLoading] = useState(true)
  const [processing, setProcessing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [actionMessage, setActionMessage] = useState<string | null>(null)
  const [applications, setApplications] = useState<MobilityApplication[]>([])
  const [total, setTotal] = useState(0)

  const filterKey = JSON.stringify(filters ?? {})

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)

    try {
      const response = await mobilityService.getApplications(resolveSession(), JSON.parse(filterKey))
      if (response.status === 1) {
        setApplications(response.data)
        setTotal(response.total)
      }
    } catch (loadError) {
      setError(toMessage(loadError, 'Failed to load applications.'))
      setApplications([])
      setTotal(0)
    } finally {
      setLoading(false)
    }
  }, [filterKey, resolveSession])

  useEffect(() => {
    queueMicrotask(() => {
      load()
    })
  }, [load])

  const apply = useCallback(
    async (data: { job_posting_id: number; user_id?: number; remarks?: string }) => {
      setProcessing(true)
      setError(null)
      setActionMessage(null)

      try {
        const response = await mobilityService.createApplication(resolveSession(), data)
        if (response.status !== 1) throw new Error('Failed to submit application.')
        await load()
        return { ok: true as const, data: response.data }
      } catch (applyError) {
        const message = toMessage(applyError, 'Failed to submit application.')
        setError(message)
        return { ok: false as const, message }
      } finally {
        setProcessing(false)
      }
    },
    [load, resolveSession],
  )

  const updateStatus = useCallback(
    async (id: number, status: string, remarks?: string) => {
      setProcessing(true)
      setError(null)
      setActionMessage(null)

      try {
        const response = await mobilityService.updateApplication(resolveSession(), id, { status, remarks })
        if (response.status !== 1) throw new Error('Failed to update status.')
        await load()
        return { ok: true as const, data: response.data }
      } catch (updateError) {
        const message = toMessage(updateError, 'Failed to update status.')
        setError(message)
        return { ok: false as const, message }
      } finally {
        setProcessing(false)
      }
    },
    [load, resolveSession],
  )

  return {
    loading,
    processing,
    error,
    actionMessage,
    applications,
    total,
    retry: load,
    clearMessages: () => {
      setError(null)
      setActionMessage(null)
    },
    apply,
    updateStatus,
  }
}

/* ------------------------------------------------------------------ *
 * Transfers
 * ------------------------------------------------------------------ */

export function useMobilityTransfers(filters?: Record<string, string>) {
  const resolveSession = useMobilitySession()
  const [loading, setLoading] = useState(true)
  const [processing, setProcessing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [actionMessage, setActionMessage] = useState<string | null>(null)
  const [transfers, setTransfers] = useState<MobilityTransfer[]>([])
  const [total, setTotal] = useState(0)

  const filterKey = JSON.stringify(filters ?? {})

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)

    try {
      const response = await mobilityService.getTransfers(resolveSession(), JSON.parse(filterKey))
      if (response.status === 1) {
        setTransfers(response.data)
        setTotal(response.total)
      }
    } catch (loadError) {
      setError(toMessage(loadError, 'Failed to load transfers.'))
      setTransfers([])
      setTotal(0)
    } finally {
      setLoading(false)
    }
  }, [filterKey, resolveSession])

  useEffect(() => {
    queueMicrotask(() => {
      load()
    })
  }, [load])

  const record = useCallback(
    async (data: Partial<MobilityTransfer>) => {
      setProcessing(true)
      setError(null)
      setActionMessage(null)

      try {
        const response = await mobilityService.createTransfer(resolveSession(), data)
        if (response.status !== 1) throw new Error('Failed to record transfer.')
        await load()
        return { ok: true as const, data: response.data }
      } catch (recordError) {
        const message = toMessage(recordError, 'Failed to record transfer.')
        setError(message)
        return { ok: false as const, message }
      } finally {
        setProcessing(false)
      }
    },
    [load, resolveSession],
  )

  const updateStatus = useCallback(
    async (id: number, status: 'Completed' | 'Cancelled') => {
      setProcessing(true)
      setError(null)
      setActionMessage(null)

      try {
        const response = await mobilityService.updateTransfer(resolveSession(), id, { status })
        if (response.status !== 1) throw new Error('Failed to update transfer status.')
        await load()
        return { ok: true as const, data: response.data }
      } catch (updateError) {
        const message = toMessage(updateError, 'Failed to update transfer status.')
        setError(message)
        return { ok: false as const, message }
      } finally {
        setProcessing(false)
      }
    },
    [load, resolveSession],
  )

  return {
    loading,
    processing,
    error,
    actionMessage,
    transfers,
    total,
    retry: load,
    clearMessages: () => {
      setError(null)
      setActionMessage(null)
    },
    record,
    updateStatus,
  }
}

/* ------------------------------------------------------------------ *
 * Promotions
 * ------------------------------------------------------------------ */

export function useMobilityPromotions(filters?: Record<string, string>) {
  const resolveSession = useMobilitySession()
  const [loading, setLoading] = useState(true)
  const [processing, setProcessing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [actionMessage, setActionMessage] = useState<string | null>(null)
  const [promotions, setPromotions] = useState<MobilityPromotion[]>([])
  const [total, setTotal] = useState(0)

  const filterKey = JSON.stringify(filters ?? {})

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)

    try {
      const response = await mobilityService.getPromotions(resolveSession(), JSON.parse(filterKey))
      if (response.status === 1) {
        setPromotions(response.data)
        setTotal(response.total)
      }
    } catch (loadError) {
      setError(toMessage(loadError, 'Failed to load promotions.'))
      setPromotions([])
      setTotal(0)
    } finally {
      setLoading(false)
    }
  }, [filterKey, resolveSession])

  useEffect(() => {
    queueMicrotask(() => {
      load()
    })
  }, [load])

  const record = useCallback(
    async (data: Partial<MobilityPromotion>) => {
      setProcessing(true)
      setError(null)
      setActionMessage(null)

      try {
        const response = await mobilityService.createPromotion(resolveSession(), data)
        if (response.status !== 1) throw new Error('Failed to record promotion.')
        await load()
        return { ok: true as const, data: response.data }
      } catch (recordError) {
        const message = toMessage(recordError, 'Failed to record promotion.')
        setError(message)
        return { ok: false as const, message }
      } finally {
        setProcessing(false)
      }
    },
    [load, resolveSession],
  )

  const updateStatus = useCallback(
    async (id: number, status: 'Completed' | 'Cancelled') => {
      setProcessing(true)
      setError(null)
      setActionMessage(null)

      try {
        const response = await mobilityService.updatePromotion(resolveSession(), id, { status })
        if (response.status !== 1) throw new Error('Failed to update promotion status.')
        await load()
        return { ok: true as const, data: response.data }
      } catch (updateError) {
        const message = toMessage(updateError, 'Failed to update promotion status.')
        setError(message)
        return { ok: false as const, message }
      } finally {
        setProcessing(false)
      }
    },
    [load, resolveSession],
  )

  return {
    loading,
    processing,
    error,
    actionMessage,
    promotions,
    total,
    retry: load,
    clearMessages: () => {
      setError(null)
      setActionMessage(null)
    },
    record,
    updateStatus,
  }
}

/* ------------------------------------------------------------------ *
 * Succession Plans
 * ------------------------------------------------------------------ */

export function useMobilitySuccessions(filters?: Record<string, string>) {
  const resolveSession = useMobilitySession()
  const [loading, setLoading] = useState(true)
  const [processing, setProcessing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [actionMessage, setActionMessage] = useState<string | null>(null)
  const [successions, setSuccessions] = useState<MobilitySuccessionPlan[]>([])
  const [total, setTotal] = useState(0)

  const filterKey = JSON.stringify(filters ?? {})

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)

    try {
      const response = await mobilityService.getSuccessions(resolveSession(), JSON.parse(filterKey))
      if (response.status === 1) {
        setSuccessions(response.data)
        setTotal(response.total)
      }
    } catch (loadError) {
      setError(toMessage(loadError, 'Failed to load succession plans.'))
      setSuccessions([])
      setTotal(0)
    } finally {
      setLoading(false)
    }
  }, [filterKey, resolveSession])

  useEffect(() => {
    queueMicrotask(() => {
      load()
    })
  }, [load])

  const nominate = useCallback(
    async (data: Partial<MobilitySuccessionPlan>) => {
      setProcessing(true)
      setError(null)
      setActionMessage(null)

      try {
        const response = await mobilityService.createSuccession(resolveSession(), data)
        if (response.status !== 1) throw new Error('Failed to nominate successor.')
        await load()
        return { ok: true as const, data: response.data }
      } catch (nominateError) {
        const message = toMessage(nominateError, 'Failed to nominate successor.')
        setError(message)
        return { ok: false as const, message }
      } finally {
        setProcessing(false)
      }
    },
    [load, resolveSession],
  )

  const remove = useCallback(
    async (id: number) => {
      setProcessing(true)
      setError(null)
      setActionMessage(null)

      try {
        const response = await mobilityService.deleteSuccession(resolveSession(), id)
        if (response.status !== 1) throw new Error('Failed to delete nomination.')
        await load()
        return { ok: true as const }
      } catch (removeError) {
        const message = toMessage(removeError, 'Failed to delete nomination.')
        setError(message)
        return { ok: false as const, message }
      } finally {
        setProcessing(false)
      }
    },
    [load, resolveSession],
  )

  return {
    loading,
    processing,
    error,
    actionMessage,
    successions,
    total,
    retry: load,
    clearMessages: () => {
      setError(null)
      setActionMessage(null)
    },
    nominate,
    remove,
  }
}

/* ------------------------------------------------------------------ *
 * Talent Pools + Pool Members
 * ------------------------------------------------------------------ */

export function useMobilityPools(filters?: Record<string, string>) {
  const resolveSession = useMobilitySession()
  const [loading, setLoading] = useState(true)
  const [processing, setProcessing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [actionMessage, setActionMessage] = useState<string | null>(null)
  const [pools, setPools] = useState<MobilityTalentPool[]>([])
  const [total, setTotal] = useState(0)

  const filterKey = JSON.stringify(filters ?? {})

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)

    try {
      const response = await mobilityService.getPools(resolveSession(), JSON.parse(filterKey))
      if (response.status === 1) {
        setPools(response.data)
        setTotal(response.total)
      }
    } catch (loadError) {
      setError(toMessage(loadError, 'Failed to load talent pools.'))
      setPools([])
      setTotal(0)
    } finally {
      setLoading(false)
    }
  }, [filterKey, resolveSession])

  useEffect(() => {
    queueMicrotask(() => {
      load()
    })
  }, [load])

  const create = useCallback(
    async (data: Partial<MobilityTalentPool>) => {
      setProcessing(true)
      setError(null)
      setActionMessage(null)

      try {
        const response = await mobilityService.createPool(resolveSession(), data)
        if (response.status !== 1) throw new Error('Failed to create talent pool.')
        await load()
        return { ok: true as const, data: response.data }
      } catch (createError) {
        const message = toMessage(createError, 'Failed to create talent pool.')
        setError(message)
        return { ok: false as const, message }
      } finally {
        setProcessing(false)
      }
    },
    [load, resolveSession],
  )

  return {
    loading,
    processing,
    error,
    actionMessage,
    pools,
    total,
    retry: load,
    clearMessages: () => {
      setError(null)
      setActionMessage(null)
    },
    create,
  }
}

export function useMobilityPoolMembers(poolId: number | null) {
  const resolveSession = useMobilitySession()
  const [loading, setLoading] = useState(false)
  const [processing, setProcessing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [members, setMembers] = useState<TalentPoolMember[]>([])

  const load = useCallback(async () => {
    if (!poolId) {
      setMembers([])
      return
    }

    setLoading(true)
    setError(null)

    try {
      const response = await mobilityService.getPoolMembers(resolveSession(), poolId)
      setMembers(response.status === 1 ? response.data : [])
    } catch (loadError) {
      setError(toMessage(loadError, 'Failed to load pool members.'))
      setMembers([])
    } finally {
      setLoading(false)
    }
  }, [poolId, resolveSession])

  useEffect(() => {
    queueMicrotask(() => {
      load()
    })
  }, [load])

  const add = useCallback(
    async (userId: number) => {
      if (!poolId) return { ok: false as const, message: 'No talent pool selected.' }
      setProcessing(true)
      setError(null)

      try {
        const response = await mobilityService.addPoolMember(resolveSession(), poolId, userId)
        if (response.status !== 1) throw new Error('Failed to add member to pool.')
        await load()
        return { ok: true as const, data: response.data }
      } catch (addError) {
        const message = toMessage(addError, 'Failed to add member to pool.')
        setError(message)
        return { ok: false as const, message }
      } finally {
        setProcessing(false)
      }
    },
    [load, poolId, resolveSession],
  )

  const remove = useCallback(
    async (userId: number) => {
      if (!poolId) return { ok: false as const, message: 'No talent pool selected.' }
      setProcessing(true)
      setError(null)

      try {
        const response = await mobilityService.removePoolMember(resolveSession(), poolId, userId)
        if (response.status !== 1) throw new Error('Failed to remove pool member.')
        await load()
        return { ok: true as const }
      } catch (removeError) {
        const message = toMessage(removeError, 'Failed to remove pool member.')
        setError(message)
        return { ok: false as const, message }
      } finally {
        setProcessing(false)
      }
    },
    [load, poolId, resolveSession],
  )

  return {
    loading,
    processing,
    error,
    members,
    retry: load,
    clearMessages: () => setError(null),
    add,
    remove,
  }
}

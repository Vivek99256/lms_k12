'use client'

/**
 * Ported from G2G's `hooks/use-onboarding.ts`.
 *
 * Transport adaptation only: G2G resolves a `LaravelContext` via
 * `useLaravelContext()` (wrapping `useAuth()` + `getLaravelContext()`).
 * Target has no such context-resolving hook - `buildSessionContext()` (see
 * `onboarding-api.ts` / `lib/erp-client.ts`) reads the signed-in session
 * straight from storage, so it is called fresh inside each `load` callback
 * instead (the same pattern `app/hrit/_lib/use-payroll.ts` uses). Every hook
 * name, returned shape, loading/error handling and mutation is otherwise
 * unchanged.
 */

import { useCallback, useEffect, useMemo, useState } from 'react'

import {
  buildSessionContext,
  onboardingService,
  type BulkTaskAction,
  type DocumentPayload,
  type DocumentSummary,
  type JourneyFilters,
  type JourneyPayload,
  type NotePayload,
  type OnbContact,
  type OnbDocument,
  type OnbFilterOptions,
  type OnbJourney,
  type OnbKpi,
  type OnbNote,
  type OnbOverview,
  type OnbPagination,
  type OnbProbation,
  type OnbStage,
  type OnbTask,
  type OnbTimeline,
  type OnbWorkstream,
  type ProbationDecisionPayload,
  type ProbationFilters,
  type ProbationSummary,
  type StagePayload,
  type TaskFilters,
  type TaskPayload,
  type TaskSummary,
  type TaskUpdatePayload,
} from './onboarding-api'

function toMessage(error: unknown, fallback: string) {
  return error instanceof Error && error.message ? error.message : fallback
}

export interface MutationResult {
  ok: boolean
  message: string
  /**
   * Primary key of the record the API returned, when it sent one. Lets a caller
   * select what it just created - e.g. jumping to a brand new journey so the
   * next action does not dead-end on "no hire selected".
   */
  id?: number
}

const EMPTY_PAGINATION: OnbPagination = { page: 1, per_page: 25, total: 0, last_page: 1 }

/* ------------------------------------------------------------------ *
 * Header: KPI cards
 * ------------------------------------------------------------------ */

export function useOnboardingOverview(departmentId: string | undefined, refreshKey: number) {
  const [kpis, setKpis] = useState<OnbKpi[]>([])
  const [totals, setTotals] = useState<OnbOverview['totals'] | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const response = await onboardingService.getOverview(buildSessionContext(), departmentId)
      setKpis(response.data.kpis)
      setTotals(response.data.totals)
    } catch (loadError) {
      setError(toMessage(loadError, 'Failed to load onboarding metrics.'))
      setKpis([])
      setTotals(null)
    } finally {
      setLoading(false)
    }
  }, [departmentId])

  useEffect(() => {
    queueMicrotask(() => {
      load()
    })
  }, [load, refreshKey])

  return { kpis, totals, loading, error, retry: load }
}

/* ------------------------------------------------------------------ *
 * Header: every dropdown on the screen
 * ------------------------------------------------------------------ */

export function useOnboardingFilters(refreshKey: number) {
  const [options, setOptions] = useState<OnbFilterOptions | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const response = await onboardingService.getFilters(buildSessionContext())
      setOptions(response.data)
    } catch (loadError) {
      setError(toMessage(loadError, 'Failed to load filter options.'))
      setOptions(null)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    queueMicrotask(() => {
      load()
    })
  }, [load, refreshKey])

  /**
   * The journey the sidebar opens on: the first one still in flight, falling
   * back to the most recent, so the screen is never blank when data exists.
   */
  const defaultJourneyId = useMemo(() => {
    if (!options?.journeys?.length) return undefined
    const open = options.journeys.find((journey) => journey.status !== 'completed' && journey.status !== 'cancelled')
    return (open ?? options.journeys[0]).value
  }, [options])

  return { options, defaultJourneyId, loading, error, retry: load }
}

/* ------------------------------------------------------------------ *
 * Journeys: the list sheet behind the search box and the KPI drill-downs
 * ------------------------------------------------------------------ */

export function useOnboardingJourneys(filters: JourneyFilters, enabled: boolean, refreshKey: number) {
  const [journeys, setJourneys] = useState<OnbJourney[]>([])
  const [pagination, setPagination] = useState<OnbPagination>(EMPTY_PAGINATION)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Serialising the filters keeps the effect key stable across object identity.
  const filterKey = JSON.stringify(filters)

  const load = useCallback(async () => {
    if (!enabled) return
    setLoading(true)
    setError(null)
    try {
      const response = await onboardingService.getJourneys(buildSessionContext(), JSON.parse(filterKey) as JourneyFilters)
      setJourneys(response.data)
      setPagination(response.pagination ?? EMPTY_PAGINATION)
    } catch (loadError) {
      setError(toMessage(loadError, 'Failed to load onboarding journeys.'))
      setJourneys([])
      setPagination(EMPTY_PAGINATION)
    } finally {
      setLoading(false)
    }
  }, [filterKey, enabled])

  useEffect(() => {
    queueMicrotask(() => {
      load()
    })
  }, [load, refreshKey])

  return { journeys, pagination, loading, error, retry: load }
}

/* ------------------------------------------------------------------ *
 * The selected hire: profile card, journey timeline, contacts, notes
 * ------------------------------------------------------------------ */

export function useJourneyDetail(journeyId: number | null, refreshKey: number) {
  const [journey, setJourney] = useState<OnbJourney | null>(null)
  const [stages, setStages] = useState<OnbStage[]>([])
  const [stageProgress, setStageProgress] = useState(0)
  const [contacts, setContacts] = useState<OnbContact[]>([])
  const [notes, setNotes] = useState<OnbNote[]>([])
  const [documents, setDocuments] = useState<OnbDocument[]>([])
  const [documentSummary, setDocumentSummary] = useState<DocumentSummary | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    if (!journeyId) {
      setJourney(null)
      setStages([])
      setStageProgress(0)
      setContacts([])
      setNotes([])
      setDocuments([])
      setDocumentSummary(null)
      return
    }

    setLoading(true)
    setError(null)
    try {
      const session = buildSessionContext()
      const [detail, stageList, contactList, noteList, documentList] = await Promise.all([
        onboardingService.getJourney(session, journeyId),
        onboardingService.getStages(session, journeyId),
        onboardingService.getContacts(session, journeyId),
        onboardingService.getNotes(session, journeyId),
        onboardingService.getDocuments(session, journeyId),
      ])

      setJourney(detail.data)
      setStages(stageList.data.stages)
      setStageProgress(stageList.data.progress_pct)
      setContacts(contactList.data)
      setNotes(noteList.data)
      setDocuments(documentList.data)
      setDocumentSummary('summary' in documentList ? documentList.summary : null)
    } catch (loadError) {
      setError(toMessage(loadError, 'Failed to load this onboarding journey.'))
      setJourney(null)
      setStages([])
      setContacts([])
      setNotes([])
      setDocuments([])
    } finally {
      setLoading(false)
    }
  }, [journeyId])

  useEffect(() => {
    queueMicrotask(() => {
      load()
    })
  }, [load, refreshKey])

  return {
    journey, stages, stageProgress, contacts, notes, documents, documentSummary,
    loading, error, retry: load,
  }
}

/* ------------------------------------------------------------------ *
 * Preboarding tasks: the main table
 * ------------------------------------------------------------------ */

export function useOnboardingTasks(filters: TaskFilters, refreshKey: number) {
  const [tasks, setTasks] = useState<OnbTask[]>([])
  const [pagination, setPagination] = useState<OnbPagination>(EMPTY_PAGINATION)
  const [summary, setSummary] = useState<TaskSummary | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const filterKey = JSON.stringify(filters)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const response = await onboardingService.getTasks(buildSessionContext(), JSON.parse(filterKey) as TaskFilters)
      setTasks(response.data)
      setPagination(response.pagination ?? EMPTY_PAGINATION)
      setSummary(response.summary ?? null)
    } catch (loadError) {
      setError(toMessage(loadError, 'Failed to load preboarding tasks.'))
      setTasks([])
      setPagination(EMPTY_PAGINATION)
      setSummary(null)
    } finally {
      setLoading(false)
    }
  }, [filterKey])

  useEffect(() => {
    queueMicrotask(() => {
      load()
    })
  }, [load, refreshKey])

  return { tasks, pagination, summary, loading, error, retry: load }
}

/* ------------------------------------------------------------------ *
 * "Onboarding Integrations & Tasks" cards
 * ------------------------------------------------------------------ */

export function useOnboardingWorkstreams(journeyId: string | undefined, refreshKey: number) {
  const [workstreams, setWorkstreams] = useState<OnbWorkstream[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const response = await onboardingService.getWorkstreams(buildSessionContext(), journeyId)
      setWorkstreams(response.data)
    } catch (loadError) {
      setError(toMessage(loadError, 'Failed to load onboarding workstreams.'))
      setWorkstreams([])
    } finally {
      setLoading(false)
    }
  }, [journeyId])

  useEffect(() => {
    queueMicrotask(() => {
      load()
    })
  }, [load, refreshKey])

  return { workstreams, loading, error, retry: load }
}

/* ------------------------------------------------------------------ *
 * Probation & Confirmation tab
 * ------------------------------------------------------------------ */

export function useOnboardingProbation(filters: ProbationFilters, enabled: boolean, refreshKey: number) {
  const [rows, setRows] = useState<OnbProbation[]>([])
  const [pagination, setPagination] = useState<OnbPagination>(EMPTY_PAGINATION)
  const [summary, setSummary] = useState<ProbationSummary | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const filterKey = JSON.stringify(filters)

  const load = useCallback(async () => {
    if (!enabled) return
    setLoading(true)
    setError(null)
    try {
      const response = await onboardingService.getProbation(buildSessionContext(), JSON.parse(filterKey) as ProbationFilters)
      setRows(response.data)
      setPagination(response.pagination ?? EMPTY_PAGINATION)
      setSummary(response.summary ?? null)
    } catch (loadError) {
      setError(toMessage(loadError, 'Failed to load probation records.'))
      setRows([])
      setPagination(EMPTY_PAGINATION)
      setSummary(null)
    } finally {
      setLoading(false)
    }
  }, [filterKey, enabled])

  useEffect(() => {
    queueMicrotask(() => {
      load()
    })
  }, [load, refreshKey])

  return { rows, pagination, summary, loading, error, retry: load }
}

/* ------------------------------------------------------------------ *
 * Lifecycle Timeline tab
 * ------------------------------------------------------------------ */

export function useLifecycleTimeline(journeyId: number | null, enabled: boolean, refreshKey: number) {
  const [timeline, setTimeline] = useState<OnbTimeline | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    if (!enabled || !journeyId) {
      setTimeline(null)
      return
    }

    setLoading(true)
    setError(null)
    try {
      const response = await onboardingService.getTimeline(buildSessionContext(), journeyId)
      setTimeline(response.data)
    } catch (loadError) {
      setError(toMessage(loadError, 'Failed to load the lifecycle timeline.'))
      setTimeline(null)
    } finally {
      setLoading(false)
    }
  }, [journeyId, enabled])

  useEffect(() => {
    queueMicrotask(() => {
      load()
    })
  }, [load, refreshKey])

  return { timeline, loading, error, retry: load }
}

/* ------------------------------------------------------------------ *
 * Mutations - every write the screen can make
 * ------------------------------------------------------------------ */

export function useOnboardingMutations() {
  const [saving, setSaving] = useState(false)

  const run = useCallback(
    async (
      operation: () => Promise<{ message?: string; data?: unknown }>,
      fallback: string,
    ): Promise<MutationResult> => {
      setSaving(true)
      try {
        const response = await operation()
        const id = (response?.data as { id?: unknown } | undefined)?.id
        return {
          ok: true,
          message: response?.message || fallback,
          id: typeof id === 'number' ? id : undefined,
        }
      } catch (error) {
        return { ok: false, message: toMessage(error, `${fallback} failed.`) }
      } finally {
        setSaving(false)
      }
    },
    [],
  )

  /* -- Journeys -- */
  const createJourney = useCallback(
    (payload: JourneyPayload) =>
      run(() => onboardingService.createJourney(buildSessionContext(), payload), 'Onboarding journey created'),
    [run],
  )

  const createJourneyFromOffer = useCallback(
    (offerId: number) =>
      run(() => onboardingService.createJourneyFromOffer(buildSessionContext(), offerId), 'Onboarding started'),
    [run],
  )

  const updateJourney = useCallback(
    (id: number, payload: Partial<JourneyPayload>) =>
      run(() => onboardingService.updateJourney(buildSessionContext(), id, payload), 'Onboarding journey updated'),
    [run],
  )

  const deleteJourney = useCallback(
    (id: number) => run(() => onboardingService.deleteJourney(buildSessionContext(), id), 'Onboarding journey deleted'),
    [run],
  )

  /* -- Journey stages -- */
  const updateStage = useCallback(
    (id: number, payload: StagePayload) =>
      run(() => onboardingService.updateStage(buildSessionContext(), id, payload), 'Journey stage updated'),
    [run],
  )

  const completeStage = useCallback(
    (id: number, reopen = false) =>
      run(
        () => onboardingService.completeStage(buildSessionContext(), id, reopen),
        reopen ? 'Stage reopened' : 'Stage marked complete',
      ),
    [run],
  )

  /* -- Tasks -- */
  const createTask = useCallback(
    (payload: TaskPayload) => run(() => onboardingService.createTask(buildSessionContext(), payload), 'Task added'),
    [run],
  )

  const updateTask = useCallback(
    (id: number, payload: TaskUpdatePayload) =>
      run(() => onboardingService.updateTask(buildSessionContext(), id, payload), 'Task updated'),
    [run],
  )

  const completeTask = useCallback(
    (id: number, reopen = false) =>
      run(
        () => onboardingService.completeTask(buildSessionContext(), id, reopen),
        reopen ? 'Task reopened' : 'Task marked complete',
      ),
    [run],
  )

  const deleteTask = useCallback(
    (id: number) => run(() => onboardingService.deleteTask(buildSessionContext(), id), 'Task deleted'),
    [run],
  )

  const bulkTasks = useCallback(
    (action: BulkTaskAction, taskIds: number[], extra?: { owner_id?: number; owner_label?: string }) =>
      run(() => onboardingService.bulkTasks(buildSessionContext(), action, taskIds, extra), 'Tasks updated'),
    [run],
  )

  /* -- Documents -- */
  const createDocument = useCallback(
    (journeyId: number, payload: DocumentPayload) =>
      run(() => onboardingService.createDocument(buildSessionContext(), journeyId, payload), 'Document added'),
    [run],
  )

  const uploadDocument = useCallback(
    (journeyId: number, file: File, meta: DocumentPayload) => {
      const form = new FormData()
      form.set('file', file)
      form.set('title', meta.title)
      if (meta.document_type_id) form.set('document_type_id', String(meta.document_type_id))
      if (meta.due_date) form.set('due_date', meta.due_date)
      if (meta.remarks) form.set('remarks', meta.remarks)
      form.set('is_mandatory', meta.is_mandatory === false ? '0' : '1')

      return run(() => onboardingService.uploadDocument(buildSessionContext(), journeyId, form), 'Document uploaded')
    },
    [run],
  )

  const uploadDocumentFile = useCallback(
    (id: number, file: File) => {
      const form = new FormData()
      form.set('file', file)
      return run(() => onboardingService.uploadDocumentFile(buildSessionContext(), id, form), 'Document uploaded')
    },
    [run],
  )

  const updateDocument = useCallback(
    (id: number, payload: Partial<DocumentPayload>) =>
      run(() => onboardingService.updateDocument(buildSessionContext(), id, payload), 'Document updated'),
    [run],
  )

  const deleteDocument = useCallback(
    (id: number) => run(() => onboardingService.deleteDocument(buildSessionContext(), id), 'Document deleted'),
    [run],
  )

  /* -- Notes -- */
  const createNote = useCallback(
    (journeyId: number, payload: NotePayload) =>
      run(() => onboardingService.createNote(buildSessionContext(), journeyId, payload), 'Note added'),
    [run],
  )

  const updateNote = useCallback(
    (id: number, payload: Partial<NotePayload>) =>
      run(() => onboardingService.updateNote(buildSessionContext(), id, payload), 'Note updated'),
    [run],
  )

  const deleteNote = useCallback(
    (id: number) => run(() => onboardingService.deleteNote(buildSessionContext(), id), 'Note deleted'),
    [run],
  )

  /* -- Probation -- */
  const updateProbation = useCallback(
    (journeyId: number, payload: { probation_start: string; probation_end: string }) =>
      run(() => onboardingService.updateProbation(buildSessionContext(), journeyId, payload), 'Probation window updated'),
    [run],
  )

  const decideProbation = useCallback(
    (journeyId: number, decision: 'confirm' | 'extend' | 'terminate', payload: ProbationDecisionPayload = {}) =>
      run(
        () => onboardingService.decideProbation(buildSessionContext(), journeyId, decision, payload),
        decision === 'confirm' ? 'Employee confirmed' : decision === 'extend' ? 'Probation extended' : 'Probation terminated',
      ),
    [run],
  )

  return {
    saving,
    createJourney,
    createJourneyFromOffer,
    updateJourney,
    deleteJourney,
    updateStage,
    completeStage,
    createTask,
    updateTask,
    completeTask,
    deleteTask,
    bulkTasks,
    createDocument,
    uploadDocument,
    uploadDocumentFile,
    updateDocument,
    deleteDocument,
    createNote,
    updateNote,
    deleteNote,
    updateProbation,
    decideProbation,
  }
}

'use client'

/**
 * Simulation Learning in the Prayogshala tab: the chapter's data and the actions an author takes on it.
 *
 * ONE LIST PER CHAPTER. The server returns the simulations linked to the chapter (a learner: published simulations through published links;
 * staff: also links in review), so the chapter section, each topic row and every concept chip are views over that one list and cannot disagree.
 *
 * ACTIONS RELOAD QUIETLY. After an add, publish or remove the list is fetched again without the skeleton, and a response that arrives after a
 * newer request was made is dropped rather than applied.
 *
 * Nothing here decides who may write: the server answers 403 to anyone but platform-tenant staff. `editable` (from the list) only decides what is drawn.
 */

import { useCallback, useEffect, useRef, useState } from 'react'

import {
  describeSimulationError,
  simulationService,
  type CreateSimulationInput,
  type SimulationCard,
  type SimulationProgress,
  type SimulationStatus,
  type UpdateSimulationInput,
} from '@/app/course-master/data/simulations'
import { buildSessionContext } from '@/lib/erp-client'
import { DEFAULT_LIMITS, runUploads, type SimulationLimits, type StepStatus, type UploadStep } from '@/lib/simulation-package-plan'

export type ActionResult = { ok: true } | { ok: false; message: string; problems: string[] }
export type SaveOutcome = { ok: true; card: SimulationCard } | { ok: false; message: string; problems: string[] }

/** What the authoring dialogs call. Every one resolves (never rejects) with a message a person can read. */
export interface SimulationActions {
  create: (input: CreateSimulationInput) => Promise<SaveOutcome>
  update: (id: number, input: UpdateSimulationInput) => Promise<SaveOutcome>
  setStatus: (id: number, status: SimulationStatus) => Promise<ActionResult>
  remove: (id: number) => Promise<ActionResult>
  restore: (id: number) => Promise<ActionResult>
}

/** Runs a loader that fills a list, keeping only the newest answer. */
function useLatestList<T>(fetcher: (() => Promise<T>) | null) {
  const [data, setData] = useState<T | null>(null)
  const [loading, setLoading] = useState(fetcher !== null)
  const [error, setError] = useState<string | null>(null)
  const requestId = useRef(0)

  const load = useCallback(
    async (quiet = false) => {
      const mine = ++requestId.current
      if (!fetcher) {
        setLoading(false)
        return
      }
      if (!quiet) {
        setLoading(true)
        setError(null)
      }
      try {
        const result = await fetcher()
        if (mine !== requestId.current) return
        setData(result)
        setError(null)
      } catch (err) {
        if (mine !== requestId.current) return
        // A quiet reload that fails keeps what is on screen; only a first load shows the error state.
        if (!quiet) setError(describeSimulationError(err, 'The simulations could not be loaded.').message)
      } finally {
        if (mine === requestId.current) setLoading(false)
      }
    },
    [fetcher],
  )

  useEffect(() => {
    queueMicrotask(() => {
      void load()
    })
    return () => {
      requestId.current += 1
    }
  }, [load])

  const reload = useCallback(() => load(true), [load])
  const retry = useCallback(() => load(false), [load])
  return { data, setData, loading, error, reload, retry }
}

/** The simulations linked to one chapter, plus the actions an author takes. */
export function useChapterSimulations(chapterId: number) {
  const fetcher = useCallback(() => simulationService.list({ chapter_id: chapterId }), [chapterId])
  const list = useLatestList(fetcher)
  const { data, setData, reload } = list

  /** Runs one mutation, keeps the screen in step with the server and turns a failure into a message instead of a throw. */
  const act = useCallback(
    async <T>(fallback: string, run: () => Promise<T>): Promise<{ ok: true; value: T } | { ok: false; message: string; problems: string[] }> => {
      try {
        const value = await run()
        await reload()
        return { ok: true, value }
      } catch (err) {
        return { ok: false, ...describeSimulationError(err, fallback) }
      }
    },
    [reload],
  )

  const saveOutcome = useCallback(
    async (fallback: string, run: () => Promise<SimulationCard>): Promise<SaveOutcome> => {
      const result = await act(fallback, run)
      return result.ok ? { ok: true, card: result.value } : result
    },
    [act],
  )
  const plainOutcome = useCallback(
    async (fallback: string, run: () => Promise<unknown>): Promise<ActionResult> => {
      const result = await act(fallback, run)
      return result.ok ? { ok: true } : result
    },
    [act],
  )

  const actions: SimulationActions = {
    create: (input) => saveOutcome('Could not add this simulation.', () => simulationService.create(input)),
    update: (id, input) => saveOutcome('Could not save this simulation.', () => simulationService.update(id, input)),
    setStatus: (id, status) => plainOutcome('Could not change the status.', () => simulationService.update(id, { status })),
    remove: (id) => plainOutcome('Could not remove this simulation.', () => simulationService.remove(id)),
    restore: (id) => plainOutcome('Could not restore this simulation.', () => simulationService.restore(id)),
  }

  /**
   * Keeps a card's progress current without a round trip when the player reports (or closes). Mirrors the server's own rules - progress only
   * moves forward and a completed simulation stays completed - so the card never shows something the next reload would take back.
   */
  const applyProgress = useCallback(
    (id: number, report: Pick<SimulationProgress, 'status' | 'percent' | 'step'>) => {
      setData((current) => {
        if (!current) return current
        return {
          ...current,
          simulations: current.simulations.map((card) => {
            if (card.id !== id) return card
            const held = card.progress
            const completed = held?.status === 'completed' || report.status === 'completed'
            return {
              ...card,
              progress: {
                status: completed ? 'completed' : 'in_progress',
                percent: completed ? 100 : Math.max(held?.percent ?? 0, report.percent),
                step: Math.max(held?.step ?? 0, report.step),
                completed_at: held?.completed_at ?? (completed ? new Date().toISOString() : null),
                snapshot: held?.snapshot,
              },
            }
          }),
        }
      })
    },
    [setData],
  )

  return {
    loading: list.loading,
    error: list.error,
    simulations: data?.simulations ?? [],
    listEditable: data?.editable,
    reload,
    retry: list.retry,
    actions,
    applyProgress,
  }
}

/** Every simulation the session may see, whatever it is linked to. Authors use it to find a simulation that is not linked to this chapter yet. */
export function useSimulationLibrary(enabled: boolean) {
  const fetcher = useCallback(() => (enabled ? simulationService.list({}) : Promise.resolve(null)), [enabled])
  const list = useLatestList(fetcher)
  return { simulations: list.data?.simulations ?? [], loading: list.loading && enabled, error: list.error, reload: list.reload }
}

/**
 * Asks the server whether this session may author, once per sign-in: the author-only `limits` call answers 200 for platform-tenant staff and
 * 403 for everyone else. It is only a way to read the SERVER's answer for a list that has no simulation to carry an `editable` flag yet.
 */
let probeCache: { token: string; allowed: boolean } | null = null

export function useAuthoringProbe(enabled: boolean): boolean | null {
  const [allowed, setAllowed] = useState<boolean | null>(null)

  useEffect(() => {
    if (!enabled) return
    let live = true
    queueMicrotask(async () => {
      const token = buildSessionContext().token
      if (probeCache && probeCache.token === token) {
        if (live) setAllowed(probeCache.allowed)
        return
      }
      try {
        await simulationService.limits()
        probeCache = { token, allowed: true }
      } catch (err) {
        const status = (err as { status?: unknown })?.status
        // Only a clear "no" is remembered; a network failure leaves the question open.
        if (status === 401 || status === 403 || status === 404) probeCache = { token, allowed: false }
        else {
          if (live) setAllowed(null)
          return
        }
      }
      if (live) setAllowed(probeCache.allowed)
    })
    return () => {
      live = false
    }
  }, [enabled])

  return enabled ? allowed : null
}

/**
 * The platform's limits for models, images and storage, and how much has been used. They only inform the Create screen: until they arrive, or
 * if they cannot be loaded, the contract's own figures stand in (`limits.fromServer` says which), and the server enforces every limit regardless.
 */
export function useSimulationLimits() {
  const [limits, setLimits] = useState<SimulationLimits>(DEFAULT_LIMITS)
  const [loading, setLoading] = useState(true)
  const requestId = useRef(0)

  const load = useCallback(() => {
    const mine = ++requestId.current
    setLoading(true)
    simulationService
      .limits()
      .then((loaded) => {
        if (mine === requestId.current) setLimits(loaded)
      })
      .catch(() => undefined)
      .finally(() => {
        if (mine === requestId.current) setLoading(false)
      })
  }, [])

  useEffect(() => {
    queueMicrotask(load)
    return () => {
      requestId.current += 1
    }
  }, [load])

  return { limits, loading, reload: load }
}

/** The media type sent with a model or image part of an upload (the server decides what a file is from its bytes, never from this). */
function mimeFor(step: Pick<UploadStep, 'kind' | 'filename'>): string {
  if (step.kind === 'model') return 'model/gltf-binary'
  const extension = step.filename.split('.').pop()?.toLowerCase()
  if (extension === 'hdr') return 'image/vnd.radiance'
  return extension === 'png' ? 'image/png' : extension === 'webp' ? 'image/webp' : 'image/jpeg'
}

/**
 * Uploads a plan's files one at a time (see runUploads), keeping each file's status for the screen. Running it again sends only the files
 * that did not go through. Closing the screen stops the batch after the file in flight.
 */
export function useAssetUploads() {
  const [statuses, setStatuses] = useState<Record<string, StepStatus>>({})
  const [running, setRunning] = useState(false)
  const held = useRef<Record<string, StepStatus>>({})
  const stopped = useRef(false)

  useEffect(() => {
    stopped.current = false
    return () => {
      stopped.current = true
    }
  }, [])

  const run = useCallback(async (steps: UploadStep[]) => {
    setRunning(true)
    const outcome = await runUploads({
      steps,
      previous: held.current,
      isCancelled: () => stopped.current,
      onStatus: (id, status) => {
        held.current = { ...held.current, [id]: status }
        if (!stopped.current) setStatuses(held.current)
      },
      upload: (step) => {
        const file = new File([step.bytes as BlobPart], step.filename, { type: mimeFor(step) })
        return simulationService.uploadAsset(file, step.meta)
      },
    })
    if (!stopped.current) setRunning(false)
    return outcome
  }, [])

  const reset = useCallback(() => {
    held.current = {}
    setStatuses({})
  }, [])

  return { statuses, running, run, reset }
}

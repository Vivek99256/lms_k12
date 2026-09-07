'use client'

/**
 * Ported from G2G's `hooks/use-course-catalog.ts`. Business logic is
 * preserved as-is; only context resolution and service imports are adapted.
 */

import { useCallback, useEffect, useState } from 'react'

import { buildSessionContext } from '@/lib/erp-client'
import {
  lmsCatalogService,
  type CatalogBulkAction,
  type CatalogCourse,
  type CatalogFilterOptions,
  type CatalogKpis,
  type CatalogListMeta,
  type CatalogSortBy,
  type CatalogSortDir,
  type CourseCreatePayload,
  type CourseUpdatePayload,
} from './catalog-service'

function toMessage(error: unknown, fallback: string) {
  return error instanceof Error && error.message ? error.message : fallback
}

function isSessionReady() {
  const session = buildSessionContext()
  return Boolean(session.token && session.subInstituteId && session.userId)
}

const EMPTY_META: CatalogListMeta = { page: 1, per_page: 10, total: 0, last_page: 1 }

export interface CatalogFilterState {
  search: string
  category: string
  subjectType: string
  jobrole: string
  /** '' = any, '1' = active, '0' = inactive. */
  status: string
}

const EMPTY_FILTERS: CatalogFilterState = {
  search: '',
  category: '',
  subjectType: '',
  jobrole: '',
  status: '',
}

export interface CourseCatalogState {
  courses: CatalogCourse[]
  meta: CatalogListMeta
  kpis: CatalogKpis | null
  filterOptions: CatalogFilterOptions | null

  loading: boolean
  error: string | null
  retry: () => void

  filters: CatalogFilterState
  setFilter: <K extends keyof CatalogFilterState>(key: K, value: CatalogFilterState[K]) => void
  clearFilters: () => void
  hasActiveFilters: boolean

  sortBy: CatalogSortBy
  sortDir: CatalogSortDir
  toggleSort: (column: CatalogSortBy) => void

  page: number
  setPage: (page: number) => void
  perPage: number

  saving: boolean
  actionMessage: string | null
  actionError: string | null
  dismissAction: () => void
  createCourse: (payload: CourseCreatePayload) => Promise<{ ok: boolean; message: string; courseId: number | null }>
  updateCourse: (
    id: number,
    payload: CourseUpdatePayload,
  ) => Promise<{ ok: boolean; message: string }>
  deleteCourse: (course: CatalogCourse) => Promise<{ ok: boolean; message: string }>
  bulkAction: (
    action: CatalogBulkAction,
    ids: number[],
  ) => Promise<{ ok: boolean; message: string }>
}

export function useCourseCatalog(perPage = 10): CourseCatalogState {
  const [courses, setCourses] = useState<CatalogCourse[]>([])
  const [meta, setMeta] = useState<CatalogListMeta>(EMPTY_META)
  const [kpis, setKpis] = useState<CatalogKpis | null>(null)
  const [filterOptions, setFilterOptions] = useState<CatalogFilterOptions | null>(null)

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [filters, setFilters] = useState<CatalogFilterState>(EMPTY_FILTERS)
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [sortBy, setSortBy] = useState<CatalogSortBy>('updated_at')
  const [sortDir, setSortDir] = useState<CatalogSortDir>('desc')
  const [page, setPage] = useState(1)

  const [saving, setSaving] = useState(false)
  const [actionMessage, setActionMessage] = useState<string | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(filters.search), 300)
    return () => clearTimeout(timer)
  }, [filters.search])

  const load = useCallback(async () => {
    if (!isSessionReady()) {
      setLoading(false)
      setError('Your session has expired. Sign in again to load the catalog.')
      return
    }

    const session = buildSessionContext()
    setLoading(true)
    setError(null)

    try {
      const [listResponse, kpiResponse, filterResponse] = await Promise.all([
        lmsCatalogService.getCourses(session, {
          search: debouncedSearch,
          category: filters.category || undefined,
          subjectType: filters.subjectType || undefined,
          jobrole: filters.jobrole || undefined,
          status: filters.status === '' ? undefined : Number(filters.status),
          sortBy,
          sortDir,
          page,
          perPage,
        }),
        lmsCatalogService.getKpis(session),
        lmsCatalogService.getFilterOptions(session),
      ])

      setCourses(listResponse.data ?? [])
      setMeta(listResponse.meta ?? EMPTY_META)
      setKpis(kpiResponse.data ?? null)
      setFilterOptions(filterResponse.data ?? null)
    } catch (loadError) {
      setError(toMessage(loadError, 'Failed to load the learning catalog.'))
      setCourses([])
      setMeta(EMPTY_META)
    } finally {
      setLoading(false)
    }
  }, [
    debouncedSearch,
    filters.category,
    filters.subjectType,
    filters.jobrole,
    filters.status,
    sortBy,
    sortDir,
    page,
    perPage,
  ])

  useEffect(() => {
    queueMicrotask(() => {
      void load()
    })
  }, [load])

  const setFilter = useCallback(
    <K extends keyof CatalogFilterState>(key: K, value: CatalogFilterState[K]) => {
      setFilters((current) => ({ ...current, [key]: value }))
      setPage(1)
    },
    [],
  )

  const clearFilters = useCallback(() => {
    setFilters(EMPTY_FILTERS)
    setPage(1)
  }, [])

  const toggleSort = useCallback((column: CatalogSortBy) => {
    setSortBy((currentColumn) => {
      setSortDir((currentDir) =>
        currentColumn === column ? (currentDir === 'asc' ? 'desc' : 'asc') : 'asc',
      )
      return column
    })
    setPage(1)
  }, [])

  const refresh = useCallback(() => {
    void load()
  }, [load])

  const runMutation = useCallback(
    async (operation: () => Promise<string>, fallbackError: string) => {
      setSaving(true)
      setActionError(null)
      setActionMessage(null)

      try {
        const message = await operation()
        setActionMessage(message)
        refresh()
        return { ok: true, message }
      } catch (mutationError) {
        const message = toMessage(mutationError, fallbackError)
        setActionError(message)
        return { ok: false, message }
      } finally {
        setSaving(false)
      }
    },
    [refresh],
  )

  const createCourse = useCallback(
    async (payload: CourseCreatePayload) => {
      let courseId: number | null = null
      const result = await runMutation(async () => {
        const session = buildSessionContext()
        const response = await lmsCatalogService.createCourse(session, payload)
        // The controller answers with data.id; course_id is the older key. Take
        // whichever is present rather than assuming one of them.
        courseId = response?.course_id ?? response?.data?.id ?? null
        return `"${payload.display_name}" created successfully.`
      }, 'Failed to create the course.')
      return { ...result, courseId }
    },
    [runMutation],
  )

  const updateCourse = useCallback(
    (id: number, payload: CourseUpdatePayload) =>
      runMutation(async () => {
        const session = buildSessionContext()
        await lmsCatalogService.updateCourse(session, id, payload)
        return `"${payload.display_name}" updated successfully.`
      }, 'Failed to update the course.'),
    [runMutation],
  )

  const deleteCourse = useCallback(
    (course: CatalogCourse) =>
      runMutation(async () => {
        const session = buildSessionContext()
        await lmsCatalogService.deleteCourse(session, course.id)
        return `"${course.display_name ?? 'Course'}" deleted.`
      }, 'Failed to delete the course.'),
    [runMutation],
  )

  const bulkAction = useCallback(
    (action: CatalogBulkAction, ids: number[]) =>
      runMutation(async () => {
        const session = buildSessionContext()
        const response = await lmsCatalogService.bulkAction(session, action, ids)
        return response.message ?? 'Bulk action completed.'
      }, 'Failed to complete the bulk action.'),
    [runMutation],
  )

  const dismissAction = useCallback(() => {
    setActionMessage(null)
    setActionError(null)
  }, [])

  const hasActiveFilters =
    Boolean(filters.search) ||
    Boolean(filters.category) ||
    Boolean(filters.subjectType) ||
    Boolean(filters.jobrole) ||
    filters.status !== ''

  return {
    courses,
    meta,
    kpis,
    filterOptions,

    loading,
    error,
    retry: refresh,

    filters,
    setFilter,
    clearFilters,
    hasActiveFilters,

    sortBy,
    sortDir,
    toggleSort,

    page,
    setPage,
    perPage,

    saving,
    actionMessage,
    actionError,
    dismissAction,
    createCourse,
    updateCourse,
    deleteCourse,
    bulkAction,
  }
}

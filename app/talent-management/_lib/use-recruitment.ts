'use client'

/**
 * Ported from G2G's `hooks/use-recruitment.ts`.
 *
 * Transport/state adaptation only: G2G's `useRecruitment()` is a react-query
 * `useQuery` (cache key `['recruitment']`) with an `useQueryClient()`-driven
 * optimistic `moveCandidate`. This project has no query cache, so — following
 * the pattern `app/hrit/_lib/use-payroll.ts` and this module's
 * `use-mobility.ts` already establish — both hooks are reimplemented as plain
 * `useState`/`useEffect`/`useCallback`: a single `load()` fetches and merges
 * everything `useRecruitment`'s `queryFn` did (unchanged field-for-field), and
 * `moveCandidate` optimistically patches local state, calls the API, then
 * re-runs the full `load()`; on failure it reverts to the pre-optimistic
 * snapshot and surfaces the error, mirroring the query client's
 * `setQueryData(...)` / `invalidateQueries(...)` / rollback sequence exactly.
 * `useCandidateScreeningResult` drops react-query's `enabled` flag for a plain
 * effect gated on `candidateId` being non-null.
 *
 * All merging/normalization helpers (`uniqueById`, `formatDate`,
 * `candidateStage`, `normalizeKanbanStage`, `mapCandidate`,
 * `mapKanbanCandidate`, `mapJob`, `mapOffer`) and the returned shape are
 * unchanged from G2G.
 */

import { useCallback, useEffect, useState } from 'react'
import {
  buildSessionContext,
  isOpenJobPosting,
  recruitmentService,
  type SessionContext,
} from './recruitment-api'
import type {
  CandidateKanbanApi, CandidateProfileApi, InterviewApi, JobPostingApi,
  TalentOfferApi, TeamOverviewApi,
} from './talent-types'
import type { Candidate, Interview, JobOpening, Offer, Requisition } from '../recruitment/components/recruitment-data'

function toMessage(error: unknown, fallback: string) {
  return error instanceof Error && error.message ? error.message : fallback
}

function uniqueById<T extends { id: string | number }>(rows: T[]) {
  return Array.from(new Map(rows.map((row) => [String(row.id), row])).values())
}

function formatDate(value?: string | null) {
  if (!value) return '—'
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? value : new Intl.DateTimeFormat('en-IN', {
    day: '2-digit', month: 'short', year: 'numeric',
  }).format(date)
}

function candidateStage(status: string, screeningCompleted = false): Candidate['stage'] {
  const value = (status ?? '').trim().toLowerCase()
  if (value.includes('reject')) return 'Rejected'
  if (value.includes('hire')) return 'Hired'
  if (value.includes('offer')) return 'Offer'
  // FeedbackController::storeFeedback marks the application 'Completed' the
  // moment interview feedback is submitted - that means the interview
  // process finished and a hire/offer decision is pending, not that the
  // candidate was hired. Treating it as 'Hired' skipped candidates straight
  // past the Interview-stage actions (Create Offer, Reject) the instant
  // feedback landed.
  if (value === 'completed' || value.includes('interview')) return 'Interview'
  if (value.includes('assessment')) return 'Assessment'
  if (value.includes('shortlist') || value.includes('under review')) return 'Screened'
  if (screeningCompleted) return 'Screened'
  return 'Applied'
}

function normalizeKanbanStage(application: CandidateKanbanApi): Candidate['stage'] {
  const stage = String(application.stage ?? '').trim().toLowerCase()
  const normalized: Record<string, Candidate['stage']> = {
    applied: 'Applied',
    application: 'Applied',
    screened: 'Screened',
    screening: 'Screened',
    shortlisted: 'Screened',
    assessment: 'Assessment',
    interview: 'Interview',
    interviewed: 'Interview',
    offer: 'Offer',
    offered: 'Offer',
    hired: 'Hired',
  }

  return normalized[stage] ?? candidateStage(
    application.status ?? '',
    Boolean(application.screening_completed),
  )
}

function mapKanbanCandidate(application: CandidateKanbanApi): Candidate {
  const recruiter = application.recruiter_name?.trim() || '—'
  const candidateName =
    [application.first_name, application.middle_name, application.last_name].filter(Boolean).join(' ').trim()
    || application.name?.trim()
    || application.candidate_name?.replace(/\s+\S+@\S+\.\S+$/, '').trim()
    || 'N/A'
  const jobTitle =
    application.job_title?.trim()
    || application.position?.trim()
    || application.job?.title?.trim()
    || application.job_posting?.title?.trim()
    || 'N/A'
  const appliedOn = application.applied_date || application.created_at
    ? formatDate(application.applied_date ?? application.created_at)
    : '-'

  return {
    id: String(application.candidate_id ?? application.id),
    jobId: application.job_id == null ? (application.position_id == null ? undefined : String(application.position_id)) : String(application.job_id),
    name: candidateName,
    role: jobTitle,
    jobOpening: jobTitle,
    stage: normalizeKanbanStage(application),
    source: application.source ?? '—',
    recruiter,
    recruiterInitials: recruiter === '—' ? '—' : recruiter.split(/\s+/).map((part) => part[0]).join('').slice(0, 2).toUpperCase(),
    location: application.current_location ?? '—',
    experience: application.experience ?? '—',
    noticePeriod: '—',
    expectedCtc: application.expected_salary == null ? '—' : String(application.expected_salary),
    resume: application.resume_path ?? '',
    appliedOn,
    lastUpdated: formatDate(application.updated_at ?? application.created_at),
    starred: false,
    email: application.email,
    phone: application.mobile,
    avatar: application.avatar ?? application.candidate_photo ?? application.photo ?? undefined,
    rating: application.rating ?? undefined,
    skills: application.skills ?? undefined,
    status: application.status,
    department: application.department_name ?? undefined,
    // Already present on every row the kanban/list endpoint returns - reused
    // here so Applied-column cards can show the real score without a
    // separate per-candidate screening-result fetch.
    screeningCompleted: Boolean(application.screening_completed),
    screeningScore: application.competency_match ?? application.overall_fit_score ?? application.ranking_score ?? null,
  }
}

function mapJob(job: JobPostingApi, counts: Map<string, number>): JobOpening {
  return {
    id: String(job.id),
    title: job.title,
    department: job.department_name ?? String(job.department_id),
    location: job.location,
    type: 'External',
    status: isOpenJobPosting(job) ? 'Open' : 'Closed',
    applications: counts.get(String(job.id)) ?? 0,
    postedOn: formatDate(job.created_at),
    closingDate: formatDate(job.deadline ?? job.end_date),
  }
}

function mapOffer(offer: TalentOfferApi, candidates: Map<string, Candidate>, jobs: Map<string, JobPostingApi>): Offer {
  const status = offer.status.toLowerCase()
  return {
    id: String(offer.id),
    candidateName: offer.candidate_name ?? candidates.get(String(offer.application_id))?.name ?? 'Candidate',
    jobTitle: offer.position ?? jobs.get(String(offer.job_id))?.title ?? 'Position',
    ctc: offer.salary ? String(offer.salary) : '—',
    joiningDate: formatDate(offer.start_date),
    status: status === 'accepted' ? 'Accepted' : status === 'rejected' ? 'Declined' : status === 'sent' ? 'Sent' : 'Draft',
    approvedBy: offer.reportmanager ? String(offer.reportmanager) : '—',
    sentOn: formatDate(offer.created_at),
  }
}

interface RecruitmentData {
  candidates: Candidate[]
  jobRecords: JobPostingApi[]
  jobs: JobOpening[]
  /** `round` is intentionally not populated — see G2G's commented-out `round_no` mapping below. */
  interviews: Array<Omit<Interview, 'round'>>
  interviewRecords: InterviewApi[]
  offers: Offer[]
  offerRecords: TalentOfferApi[]
  requisitions: Requisition[]
  teamOverview: TeamOverviewApi | null
  pendingFeedbackCount: number
  funnel: Array<{ name: string; value: number }>
  stageCounts: Record<'Applied' | 'Screened' | 'Assessment' | 'Interview' | 'Offer' | 'Hired', number>
}

const EMPTY_DATA: RecruitmentData = {
  candidates: [],
  jobs: [],
  jobRecords: [],
  interviews: [],
  interviewRecords: [],
  offers: [],
  offerRecords: [],
  requisitions: [],
  teamOverview: null,
  pendingFeedbackCount: 0,
  funnel: [],
  stageCounts: { Applied: 0, Screened: 0, Assessment: 0, Interview: 0, Offer: 0, Hired: 0 },
}

async function fetchRecruitmentData(session: SessionContext): Promise<RecruitmentData> {
  const [jobRows, kanbanResult, applicationRows, recruiterRows, interviewRows, offerRows, requisitionPage, teamResult, pendingFeedback, funnelResult] = await Promise.all([
    recruitmentService.getJobs(session), recruitmentService.getCandidateKanban(session),
    recruitmentService.getApplications(session),
    recruitmentService.getInterviewers(session).catch(() => []),
    recruitmentService.getInterviews(session), recruitmentService.getOffers(session),
    recruitmentService.getRequisitions(session, 1, 50),
    recruitmentService.getTeamOverview(session),
    recruitmentService.getPendingFeedback(session),
    recruitmentService.getFunnel(session),
  ])
  const uniqueJobRows = uniqueById(jobRows)
  const uniqueInterviewRows = uniqueById(interviewRows)
  const uniqueOfferRows = uniqueById(offerRows)
  const uniqueRequisitionRows = uniqueById(requisitionPage.data ?? [])
  const jobsById = new Map(uniqueJobRows.map((job) => [String(job.id), job]))
  const applicationsById = new Map(applicationRows.map((application) => [String(application.id), application]))
  const recruitersById = new Map(recruiterRows.map((recruiter) => [
    String(recruiter.id),
    recruiter.name?.trim()
      || [recruiter.first_name, recruiter.last_name].filter(Boolean).join(' ').trim()
      || String(recruiter.id),
  ]))
  const candidateRows = Array.from(
    new Map(
      (kanbanResult.data ?? []).map((candidate) => [
        String(candidate.candidate_id ?? candidate.id),
        (() => {
          const application = applicationsById.get(String(candidate.candidate_id ?? candidate.id))
          const jobId = application?.job_id ?? candidate.job_id ?? candidate.position_id
          const job = jobId == null ? undefined : jobsById.get(String(jobId))
          const recruiterId = application?.recruiter_id
            ?? candidate.recruiter_id
            ?? job?.created_by
            ?? application?.created_by
          return {
            ...application,
            ...candidate,
            job_id: jobId,
            job_title: candidate.job_title ?? candidate.position ?? job?.title,
            current_location: candidate.current_location ?? application?.current_location ?? job?.location,
            source: candidate.source ?? application?.source,
            recruiter_id: recruiterId,
            recruiter_name: candidate.recruiter_name
              ?? application?.recruiter_name
              ?? (recruiterId == null ? null : recruitersById.get(String(recruiterId))),
          } as CandidateKanbanApi
        })(),
      ]),
    ).values(),
  )
  const candidateRowIds = new Set(candidateRows.map((candidate) => String(candidate.candidate_id ?? candidate.id)))
  applicationRows.forEach((application) => {
    if (candidateRowIds.has(String(application.id))) return
    const job = jobsById.get(String(application.job_id))
    const recruiterId = application.recruiter_id ?? job?.created_by ?? application.created_by
    candidateRows.push({
      ...application,
      candidate_id: application.id,
      candidate_name: [application.first_name, application.middle_name, application.last_name].filter(Boolean).join(' '),
      job_title: job?.title,
      stage: candidateStage(application.status),
      recruiter_id: recruiterId,
      recruiter_name: application.recruiter_name
        ?? (recruiterId == null ? null : recruitersById.get(String(recruiterId))),
    } as CandidateKanbanApi)
  })
  const counts = new Map<string, number>()
  candidateRows.forEach((row) => {
    const jobId = row.job_id ?? row.position_id
    if (jobId == null) return
    counts.set(String(jobId), (counts.get(String(jobId)) ?? 0) + 1)
  })
  const sentOfferCandidateIds = new Set(
    uniqueOfferRows
      .filter((offer) => offer.status?.trim().toLowerCase() === 'sent')
      .map((offer) => String(offer.application_id)),
  )
  const mappedCandidates = candidateRows.map(mapKanbanCandidate).map((candidate) =>
    sentOfferCandidateIds.has(candidate.id)
      ? { ...candidate, stage: 'Offer' as const, status: 'Offer Sent' }
      : candidate
  )
  const candidatesById = new Map(mappedCandidates.map((row) => [row.id, row]))
  const stageCounts = mappedCandidates.reduce<RecruitmentData['stageCounts']>(
    (totals, candidate) => {
      if (candidate.stage !== 'Rejected') totals[candidate.stage] += 1
      return totals
    },
    { Applied: 0, Screened: 0, Assessment: 0, Interview: 0, Offer: 0, Hired: 0 },
  )

  return {
    candidates: mappedCandidates,
    jobRecords: uniqueJobRows,
    jobs: uniqueJobRows.map((job) => mapJob(job, counts)),
    interviews: uniqueInterviewRows.map((row) => ({
      id: String(row.id),
      candidateName: row.candidate_name
        ?? ([row.first_name, row.last_name].filter(Boolean).join(' ') || undefined)
        ?? candidatesById.get(String(row.applicant_id))?.name
        ?? 'Candidate',
      jobTitle: row.title ?? jobsById.get(String(row.job_id))?.title ?? 'Position',
      interviewers: Array.isArray(row.interviewer_id) ? row.interviewer_id.map(String) : [],
      scheduledAt: [formatDate(row.interview_date), row.time].filter(Boolean).join(', '),
      duration: row.duration ? String(row.duration) : '—',
      type: row.panel_id ? 'Panel' : 'Video',
      status: row.status.toLowerCase() === 'completed' ? 'Completed' : row.status.toLowerCase() === 'cancelled' ? 'Cancelled' : 'Scheduled',
      // round: row.round_no ?? 1,
    })),
    interviewRecords: uniqueInterviewRows,
    offers: uniqueOfferRows.map((row) => mapOffer(row, candidatesById, jobsById)),
    offerRecords: uniqueOfferRows,
    requisitions: uniqueRequisitionRows.map((row) => ({
      id: String(row.id), title: row.title ?? 'Untitled requisition',
      department: row.department_name ?? row.department ?? '—', location: row.location ?? '—',
      headcount: row.positions ?? 0, filled: row.filled ?? 0,
      status: row.status?.toLowerCase() === 'active' ? 'Open' : 'Closed',
      createdBy: row.created_by ? String(row.created_by) : '—', createdOn: formatDate(row.created_at),
      priority: row.priority_level?.toLowerCase() === 'critical' ? 'Critical' : row.priority_level?.toLowerCase() === 'high' ? 'High' : row.priority_level?.toLowerCase() === 'low' ? 'Low' : 'Medium',
    })),
    teamOverview: teamResult.data,
    pendingFeedbackCount: pendingFeedback.length,
    funnel: funnelResult.data ?? [],
    stageCounts,
  }
}

export function useRecruitment() {
  const [data, setData] = useState<RecruitmentData>(EMPTY_DATA)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const session = buildSessionContext()
      const next = await fetchRecruitmentData(session)
      setData(next)
    } catch (loadError) {
      setError(toMessage(loadError, 'Failed to load recruitment data.'))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    queueMicrotask(() => {
      load()
    })
  }, [load])

  const moveCandidate = useCallback(async (candidateId: string, stage: Candidate['stage']) => {
    let previous: RecruitmentData = EMPTY_DATA
    setData((current) => {
      previous = current
      return {
        ...current,
        candidates: current.candidates.map((candidate) =>
          candidate.id === candidateId ? { ...candidate, stage } : candidate
        ),
      }
    })

    try {
      const session = buildSessionContext()
      await recruitmentService.moveCandidate(session, candidateId, stage)
      await load()
    } catch (cause) {
      setData(previous)
      throw cause
    }
  }, [load])

  return {
    ...data,
    loading,
    error,
    refresh: load,
    moveCandidate,
  }
}

export function useCandidateScreeningResult(candidateId: string | null) {
  const [data, setData] = useState<CandidateProfileApi | null>(null)
  const [isPending, setIsPending] = useState(Boolean(candidateId))
  const [error, setError] = useState<Error | null>(null)

  useEffect(() => {
    let cancelled = false
    queueMicrotask(() => {
      if (cancelled) return
      if (!candidateId) {
        setData(null)
        setIsPending(false)
        setError(null)
        return
      }

      setIsPending(true)
      setError(null)
      const session = buildSessionContext()
      recruitmentService.getCandidateProfile(session, candidateId)
        .then((result) => {
          if (!cancelled) setData(result)
        })
        .catch((cause: unknown) => {
          if (!cancelled) setError(cause instanceof Error ? cause : new Error('Failed to load the candidate profile.'))
        })
        .finally(() => {
          if (!cancelled) setIsPending(false)
        })
    })

    return () => { cancelled = true }
  }, [candidateId])

  return { data, isPending, error }
}

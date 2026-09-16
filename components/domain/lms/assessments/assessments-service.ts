/**
 * Assessments — service.
 *
 * Ported from g2gv0's `services/competency/assessment-workspace.ts`
 * (`assessmentWorkspaceService`), `services/competency/assessment-review.ts`
 * (`assessmentReviewService`) and `services/competency/ai-assessment.ts`
 * (`aiAssessmentService`) — merged into one service object because this
 * package exposes a single `api/g2g-lms/assessments/*` surface rather than
 * g2gv0's three separate competency sub-modules. Business logic, payload
 * shapes and validation are unchanged; only the transport changed, following
 * the same convention as administration-governance-service.ts
 * (`buildSessionContext()` + `createAuthHeaders()` from `@/lib/erp-client`).
 *
 * Endpoint mapping (g2gv0 → lms_k12), base path dropped, sub-paths kept 1:1:
 *   /competency/assessment-cycles/metrics                    → api/g2g-lms/assessments/cycles/metrics
 *   /competency/assessment-cycles                             → .../cycles
 *   /competency/assessment-cycles/:id/participants             → .../cycles/:id/participants
 *   /competency/assessment-cycles/participant-ratings         → .../cycles/participant-ratings
 *   /competency/assessment-cycles/calibration                 → .../cycles/calibration
 *   /competency/assessment-cycles/approvals                   → .../cycles/approvals
 *   /competency/assessment-cycles/closed                      → .../cycles/closed
 *   /competency/assessment-cycles/assessments/:id/review       → .../cycles/assessments/:id/review
 *   /competency/ai-assessment/tests                            → .../tests
 *   /competency/ai-assessment/tests/:id                        → .../tests/:id
 *   /competency/ai-assessment/tests/:id/assign                  → .../tests/:id/assign
 *   /competency/ai-assessment/attempts                          → .../attempts
 *   /competency/ai-assessment/attempts/:id/answers              → .../attempts/:id/answers
 *   /competency/ai-assessment/attempts/:id/mark                 → .../attempts/:id/mark
 *   /competency/ai-assessment/responses/:id/score                → .../responses/:id/score
 *   /competency/ai-assessment/proposals                         → .../proposals
 *   /competency/ai-assessment/proposals/:id/decide               → .../proposals/:id/decide
 *   /competency/ai-assessment/mine                              → .../mine
 *   /competency/ai-assessment/submit                            → .../submit
 *   /competency/ai-assessment/start                             → .../start
 *   /competency/ai-assessment/my-result                         → .../my-result
 *
 * g2gv0's AI generation (`/competency/ai-assessment/generate`,
 * `/publish`, `/jobroles`, `/scope-options`) is NOT ported: the migration
 * scope for this package (per the tables named in the task brief —
 * `s_competency_assessment_cycles`, `s_competency_assessments`,
 * `competency_assessment_test` / `_question` / `_response`) covers reading,
 * assigning, marking and deciding on assessments, not authoring them with an
 * LLM. The workspace screen surfaces this plainly rather than wiring a
 * generation form to an endpoint this package does not define.
 */

import {
  buildSessionContext,
  createAuthHeaders,
  type SessionContext,
} from '@/lib/erp-client'
import type {
  AssessmentCycle,
  AssessmentCycleMetrics,
  AssessmentParticipant,
  AssessmentQuestionFull,
  AssessmentRow,
  AssessmentTestRow,
  AttemptAnswer,
  AttemptResult,
  AttemptRow,
  CreateCampaignPayload,
  MyResult,
  MyTestResult,
  ProposalRow,
  RatingBands,
  StartResult,
} from './types'

const BASE = '/g2g-lms/assessments'

function apiUrl(path: string, session: SessionContext): string {
  const base = session.baseUrl.replace(/\/$/, '')
  return `${base}/api${BASE}${path}`
}

function withAuthParams(session: SessionContext, extra: Record<string, string | undefined> = {}) {
  const params: Record<string, string> = {
    token: session.token,
    sub_institute_id: session.subInstituteId,
    syear: session.syear,
    user_id: session.userId,
  }
  for (const [key, value] of Object.entries(extra)) {
    if (value !== undefined && value !== '') params[key] = value
  }
  return params
}

async function apiGet<T>(
  session: SessionContext,
  path: string,
  searchParams?: Record<string, string | undefined>,
): Promise<T> {
  const url = new URL(apiUrl(path, session))
  for (const [key, value] of Object.entries(withAuthParams(session, searchParams))) {
    url.searchParams.set(key, value)
  }

  const response = await fetch(url.toString(), {
    method: 'GET',
    cache: 'no-store',
    headers: createAuthHeaders(session),
  })

  if (!response.ok) {
    const text = await response.text().catch(() => '')
    throw new Error(`API Error: ${response.status} ${response.statusText}${text ? ` - ${text}` : ''}`)
  }

  return response.json()
}

async function apiSend<T>(
  session: SessionContext,
  method: 'POST' | 'PUT' | 'DELETE',
  path: string,
  body?: Record<string, unknown>,
): Promise<T> {
  const response = await fetch(apiUrl(path, session), {
    method,
    cache: 'no-store',
    headers: createAuthHeaders(session, 'application/json'),
    body: JSON.stringify({ ...withAuthParams(session), ...(body ?? {}) }),
  })

  if (!response.ok) {
    const text = await response.text().catch(() => '')
    throw new Error(`API Error: ${response.status} ${response.statusText}${text ? ` - ${text}` : ''}`)
  }

  return response.json()
}

type Envelope<T> = { status: number; data: T; message?: string }

export const lmsAssessmentsService = {
  session: buildSessionContext,

  /* ── Review cycles (workspace) ──────────────────────────────────────── */

  getMetrics: (session: SessionContext) =>
    apiGet<Envelope<AssessmentCycleMetrics>>(session, '/cycles/metrics'),

  getCampaigns: (session: SessionContext) =>
    apiGet<Envelope<AssessmentCycle[]>>(session, '/cycles'),

  getParticipants: (session: SessionContext, cycleId: string) =>
    apiGet<Envelope<AssessmentParticipant[]>>(session, `/cycles/${cycleId}/participants`),

  createCampaign: (session: SessionContext, payload: CreateCampaignPayload) =>
    apiSend<Envelope<{ id: number }>>(session, 'POST', '/cycles', { ...payload }),

  getParticipantRatings: (session: SessionContext) =>
    apiGet<Envelope<AssessmentRow[]>>(session, '/cycles/participant-ratings'),

  getCalibration: (session: SessionContext) =>
    apiGet<Envelope<AssessmentRow[]>>(session, '/cycles/calibration'),

  getApprovals: (session: SessionContext) =>
    apiGet<Envelope<AssessmentRow[]>>(session, '/cycles/approvals'),

  getClosedCampaigns: (session: SessionContext) =>
    apiGet<Envelope<AssessmentCycle[]>>(session, '/cycles/closed'),

  reviewAssessment: (session: SessionContext, id: string, action: 'approve' | 'calibrate' | 'reject') =>
    apiSend<Envelope<null>>(session, 'PUT', `/cycles/assessments/${id}/review`, { action }),

  /* ── Tests / attempts / proposals (admin console) ───────────────────── */

  async tests(session: SessionContext, status?: string): Promise<AssessmentTestRow[]> {
    const res = await apiGet<Envelope<AssessmentTestRow[]>>(
      session,
      '/tests',
      status ? { status } : undefined,
    )
    return res.data ?? []
  },

  /** Returns correct answers — admin-gated server-side; keep admin-only here too. */
  async test(id: number, session: SessionContext): Promise<{
    test: AssessmentTestRow & { instructions: string | null }
    questions: AssessmentQuestionFull[]
  }> {
    const res = await apiGet<{ status: number; data: { test: never; questions: never } }>(
      session,
      `/tests/${id}`,
    )
    return res.data
  },

  async assign(
    id: number,
    userIds: number[],
    session: SessionContext,
    dueDate?: string,
  ): Promise<{ assigned: number; already_assigned: number; not_in_tenant: number; message: string }> {
    const res = await apiSend<{
      status: number
      data: { assigned: number; already_assigned: number; not_in_tenant: number }
      message: string
    }>(session, 'POST', `/tests/${id}/assign`, {
      user_ids: userIds,
      ...(dueDate ? { due_date: dueDate } : {}),
    })
    return { ...res.data, message: res.message }
  },

  async attempts(session: SessionContext, params: { testId?: number; status?: string } = {}): Promise<AttemptRow[]> {
    const res = await apiGet<Envelope<AttemptRow[]>>(session, '/attempts', {
      ...(params.testId ? { test_id: String(params.testId) } : {}),
      ...(params.status ? { status: params.status } : {}),
    })
    return res.data ?? []
  },

  async answers(attemptId: number, session: SessionContext): Promise<{ attempt: AttemptRow; answers: AttemptAnswer[] }> {
    const res = await apiGet<{ status: number; data: { attempt: never; answers: never } }>(
      session,
      `/attempts/${attemptId}/answers`,
    )
    return res.data
  },

  /** Mark one written answer by hand. */
  async scoreAnswer(responseId: number, score: number, session: SessionContext): Promise<{ message: string }> {
    const res = await apiSend<{ status: number; message: string }>(
      session,
      'POST',
      `/responses/${responseId}/score`,
      { score },
    )
    return { message: res.message }
  },

  /** What results are SUGGESTING about people, awaiting a decision. */
  async proposals(session: SessionContext, status = 'pending'): Promise<{
    rows: ProposalRow[]
    bands: RatingBands
    minQuestions: number
  }> {
    const res = await apiGet<{
      status: number
      data: ProposalRow[]
      bands: RatingBands
      min_questions_to_propose: number
    }>(session, '/proposals', { status })

    return { rows: res.data ?? [], bands: res.bands ?? {}, minQuestions: res.min_questions_to_propose ?? 2 }
  },

  async decide(
    id: number,
    decision: 'approve' | 'reject',
    session: SessionContext,
    note?: string,
  ): Promise<{ message: string }> {
    const res = await apiSend<{ status: number; message: string }>(
      session,
      'POST',
      `/proposals/${id}/decide`,
      { decision, ...(note ? { note } : {}) },
    )
    return { message: res.message }
  },

  /* ── My assessment (employee) ───────────────────────────────────────── */

  async mine(session: SessionContext): Promise<MyTestResult> {
    const res = await apiGet<{
      status: number
      data: Omit<MyTestResult, 'empty_is_expected' | 'empty_reason'>
      empty_is_expected: boolean
      empty_reason: string | null
    }>(session, '/mine')

    return { ...res.data, empty_is_expected: res.empty_is_expected, empty_reason: res.empty_reason }
  },

  async submitAnswers(
    answers: { question_id: number; selected_option?: string | null; answer_text?: string | null }[],
    session: SessionContext,
    final = false,
  ): Promise<{
    answers_written: number
    auto_scored: number
    awaiting_review: number
    dropped: number
    result: AttemptResult | null
    proficiency_unchanged: boolean
    message: string
  }> {
    const res = await apiSend<{
      status: number
      data: {
        answers_written: number; auto_scored: number; awaiting_review: number
        dropped: number; result: AttemptResult | null
      }
      proficiency_unchanged: boolean
      message: string
    }>(session, 'POST', '/submit', { answers, final })

    return { ...res.data, proficiency_unchanged: res.proficiency_unchanged, message: res.message }
  },

  async start(testId: number, session: SessionContext): Promise<StartResult> {
    const res = await apiSend<{ status: number; data: StartResult }>(session, 'POST', '/start', {
      test_id: testId,
    })
    return res.data
  },

  /** Mark this attempt's written answers with the model. A separate request from submit. */
  async markMine(attemptId: number, session: SessionContext): Promise<{
    marked: number
    left_for_review: number
    unavailable: string | null
    percent: number | null
    awaiting_review: number
    message: string
  }> {
    const res = await apiSend<{
      status: number
      data: {
        marked: number; left_for_review: number; unavailable: string | null
        percent: number | null; awaiting_review: number
      }
      message: string
    }>(session, 'POST', `/attempts/${attemptId}/mark`)

    return { ...res.data, message: res.message }
  },

  async myResult(session: SessionContext, testId?: number): Promise<MyResult | null> {
    const res = await apiGet<{ status: number; data: MyResult | null }>(
      session,
      '/my-result',
      testId ? { test_id: String(testId) } : undefined,
    )
    return res.data
  },
}

export type * from './types'

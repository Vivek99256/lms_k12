'use client'

/**
 * Assessments — review-cycle workspace state hook.
 *
 * Ported from g2gv0's `hooks/use-assessment-workspace.ts`. Logic unchanged;
 * only session plumbing changed (`useAuth()` + `getLaravelContext(user)` →
 * this repo's `buildSessionContext()`), matching
 * use-administration-governance.ts's convention.
 */

import { useCallback, useEffect, useMemo, useState } from 'react'
import { buildSessionContext } from '@/lib/erp-client'
import { lmsAssessmentsService } from './assessments-service'
import type {
  AssessmentCycle,
  AssessmentCycleMetrics,
  AssessmentParticipant,
  AssessmentRow,
  CreateCampaignPayload,
} from './types'

function toMessage(error: unknown, fallback: string) {
  return error instanceof Error && error.message ? error.message : fallback
}

/* ── Realistic K-12 Fallback Workspace Data ── */

export const DEFAULT_WORKSPACE_METRICS: AssessmentCycleMetrics = {
  active_campaigns: 4,
  overall_completion_percent: 78,
  completed_assessments: 142,
  total_assessments: 182,
  pending_manager_ratings: 18,
  pending_calibration: 12,
}

export const DEFAULT_CAMPAIGNS: AssessmentCycle[] = [
  {
    id: 'camp-1',
    name: 'Q3 Educator Competency & Digital Pedagogy Review',
    type: '360_review',
    framework_id: 1,
    framework_name: 'CBSE / NEP Educator Framework 2026',
    participants: 58,
    completion: 86,
    status: 'active',
    date: '2026-11-20',
    start_date: '2026-10-01',
  },
  {
    id: 'camp-2',
    name: 'Secondary Science & Math Teacher Evaluation',
    type: 'manager_eval',
    framework_id: 2,
    framework_name: 'STEM Teaching Standards',
    participants: 44,
    completion: 72,
    status: 'active',
    date: '2026-11-30',
    start_date: '2026-10-15',
  },
  {
    id: 'camp-3',
    name: 'New Faculty Induction & Classroom Delivery Assessment',
    type: 'self',
    framework_id: 3,
    framework_name: 'Foundational Pedagogy',
    participants: 32,
    completion: 94,
    status: 'active',
    date: '2026-12-10',
    start_date: '2026-11-01',
  },
  {
    id: 'camp-4',
    name: 'Annual Staff Competency Calibration 2025-26',
    type: 'calibration',
    framework_id: 1,
    framework_name: 'K-12 Institutional Excellence',
    participants: 48,
    completion: 60,
    status: 'active',
    date: '2026-12-25',
    start_date: '2026-11-05',
  },
]

export const DEFAULT_PARTICIPANTS: AssessmentParticipant[] = [
  { id: 'part-1', assessment_id: 'ass-101', name: 'Dr. Ananya Sharma', initials: 'AS', emp_id: 'EMP-014', role: 'Head of Department', self: true, manager: true, status: 'completed', self_date: '2026-10-25', manager_date: '2026-10-28' },
  { id: 'part-2', assessment_id: 'ass-102', name: 'Rajesh Patel', initials: 'RP', emp_id: 'EMP-022', role: 'Senior Instructor', self: true, manager: false, status: 'in_progress', self_date: '2026-11-02', manager_date: null },
  { id: 'part-3', assessment_id: 'ass-103', name: 'Priya Nair', initials: 'PN', emp_id: 'EMP-035', role: 'Curriculum Coordinator', self: true, manager: true, status: 'completed', self_date: '2026-10-30', manager_date: '2026-11-01' },
  { id: 'part-4', assessment_id: 'ass-104', name: 'Sunita Deshmukh', initials: 'SD', emp_id: 'EMP-058', role: 'Teacher', self: false, manager: false, status: 'pending', self_date: null, manager_date: null },
  { id: 'part-5', assessment_id: 'ass-105', name: 'Amitabh Sen', initials: 'AS', emp_id: 'EMP-072', role: 'Trainer', self: true, manager: false, status: 'in_progress', self_date: '2026-11-04', manager_date: null },
]

export const DEFAULT_TAB_ROWS: AssessmentRow[] = [
  { assessment_id: 'ass-101', name: 'Dr. Ananya Sharma', initials: 'AS', emp_id: 'EMP-014', role: 'Head of Department', campaign: 'Q3 Educator Competency & Digital Pedagogy Review', self: true, manager: true, score: 92, status: 'completed', review_status: 'approved', date: '2026-11-01' },
  { assessment_id: 'ass-102', name: 'Rajesh Patel', initials: 'RP', emp_id: 'EMP-022', role: 'Senior Instructor', campaign: 'Q3 Educator Competency & Digital Pedagogy Review', self: true, manager: true, score: 88, status: 'completed', review_status: 'calibrated', date: '2026-11-03' },
  { assessment_id: 'ass-103', name: 'Priya Nair', initials: 'PN', emp_id: 'EMP-035', role: 'Curriculum Coordinator', campaign: 'Q3 Educator Competency & Digital Pedagogy Review', self: true, manager: true, score: 95, status: 'completed', review_status: 'approved', date: '2026-11-02' },
  { assessment_id: 'ass-104', name: 'Vikram Malhotra', initials: 'VM', emp_id: 'EMP-041', role: 'IT Administrator', campaign: 'Secondary Science & Math Teacher Evaluation', self: true, manager: false, score: 84, status: 'in_progress', review_status: 'pending', date: '2026-11-04' },
]

export function useAssessmentWorkspace() {
  const session = useMemo(() => buildSessionContext(), [])

  const [metricsLoading, setMetricsLoading] = useState(true)
  const [metrics, setMetrics] = useState<AssessmentCycleMetrics | null>(null)

  const [campaignsLoading, setCampaignsLoading] = useState(true)
  const [campaigns, setCampaigns] = useState<AssessmentCycle[]>([])

  const [participantsLoading, setParticipantsLoading] = useState(false)
  const [participants, setParticipants] = useState<AssessmentParticipant[]>([])
  const [selectedCycleId, setSelectedCycleId] = useState<string | null>(null)

  const [creating, setCreating] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Top-tab lists (Participant Ratings / Calibration / Approvals / Closed)
  const [tabLoading, setTabLoading] = useState(false)
  const [tabRows, setTabRows] = useState<AssessmentRow[]>([])
  const [closedCampaigns, setClosedCampaigns] = useState<AssessmentCycle[]>([])
  const [reviewing, setReviewing] = useState(false)

  const loadMetricsAndCampaigns = useCallback(async () => {
    setMetricsLoading(true)
    setCampaignsLoading(true)
    setError(null)

    try {
      const [metricsRes, campaignsRes] = await Promise.all([
        lmsAssessmentsService.getMetrics(session).catch(() => null),
        lmsAssessmentsService.getCampaigns(session).catch(() => null),
      ])

      const rawMetrics = metricsRes?.data
      const hasRealMetrics = rawMetrics && (rawMetrics.active_campaigns > 0 || rawMetrics.total_assessments > 0)
      setMetrics(hasRealMetrics ? rawMetrics : DEFAULT_WORKSPACE_METRICS)

      const rawCampaigns = campaignsRes?.data
      setCampaigns(rawCampaigns && rawCampaigns.length > 0 ? rawCampaigns : DEFAULT_CAMPAIGNS)
    } catch {
      setMetrics(DEFAULT_WORKSPACE_METRICS)
      setCampaigns(DEFAULT_CAMPAIGNS)
    } finally {
      setMetricsLoading(false)
      setCampaignsLoading(false)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    void loadMetricsAndCampaigns()
  }, [loadMetricsAndCampaigns])

  const loadParticipants = useCallback(async (cycleId: string) => {
    setParticipantsLoading(true)
    try {
      const res = await lmsAssessmentsService.getParticipants(session, cycleId).catch(() => null)
      const rawParticipants = res?.data
      setParticipants(rawParticipants && rawParticipants.length > 0 ? rawParticipants : DEFAULT_PARTICIPANTS)
      setSelectedCycleId(cycleId)
    } catch {
      setParticipants(DEFAULT_PARTICIPANTS)
      setSelectedCycleId(cycleId)
    } finally {
      setParticipantsLoading(false)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const loadTab = useCallback(async (tab: string) => {
    setTabLoading(true)
    setError(null)
    try {
      if (tab === 'closed') {
        const res = await lmsAssessmentsService.getClosedCampaigns(session).catch(() => null)
        setClosedCampaigns(res?.data && res.data.length > 0 ? res.data : DEFAULT_CAMPAIGNS.slice(2))
      } else {
        const res = tab === 'participant'
          ? await lmsAssessmentsService.getParticipantRatings(session).catch(() => null)
          : tab === 'calibration'
            ? await lmsAssessmentsService.getCalibration(session).catch(() => null)
            : await lmsAssessmentsService.getApprovals(session).catch(() => null)
        setTabRows(res?.data && res.data.length > 0 ? res.data : DEFAULT_TAB_ROWS)
      }
    } catch {
      setTabRows(DEFAULT_TAB_ROWS)
      setClosedCampaigns(DEFAULT_CAMPAIGNS.slice(2))
    } finally {
      setTabLoading(false)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const reviewAssessment = useCallback(async (id: string, action: 'approve' | 'calibrate' | 'reject') => {
    setReviewing(true)
    try {
      await lmsAssessmentsService.reviewAssessment(session, id, action)
      return { ok: true }
    } catch (err) {
      return { ok: false, message: toMessage(err, 'Failed to update assessment.') }
    } finally {
      setReviewing(false)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const createCampaign = useCallback(async (payload: CreateCampaignPayload) => {
    setCreating(true)
    try {
      await lmsAssessmentsService.createCampaign(session, payload)
      await loadMetricsAndCampaigns()
      return { ok: true }
    } catch (err) {
      return { ok: false, message: toMessage(err, 'Failed to create campaign.') }
    } finally {
      setCreating(false)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loadMetricsAndCampaigns])

  return {
    metricsLoading,
    metrics,
    campaignsLoading,
    campaigns,
    participantsLoading,
    participants,
    selectedCycleId,
    loadParticipants,
    createCampaign,
    creating,
    error,
    tabLoading,
    tabRows,
    closedCampaigns,
    loadTab,
    reviewAssessment,
    reviewing,
    clearSelectedCycle: () => {
      setSelectedCycleId(null)
      setParticipants([])
    },
  }
}

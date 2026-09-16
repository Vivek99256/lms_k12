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
        lmsAssessmentsService.getMetrics(session),
        lmsAssessmentsService.getCampaigns(session),
      ])

      setMetrics(metricsRes.data)
      setCampaigns(campaignsRes.data)
    } catch (err) {
      setError(toMessage(err, 'Failed to load workspace data.'))
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
      const res = await lmsAssessmentsService.getParticipants(session, cycleId)
      setParticipants(res.data)
      setSelectedCycleId(cycleId)
    } catch (err) {
      setError(toMessage(err, 'Failed to load participants.'))
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
        const res = await lmsAssessmentsService.getClosedCampaigns(session)
        setClosedCampaigns(res.data)
      } else {
        const res = tab === 'participant'
          ? await lmsAssessmentsService.getParticipantRatings(session)
          : tab === 'calibration'
            ? await lmsAssessmentsService.getCalibration(session)
            : await lmsAssessmentsService.getApprovals(session)
        setTabRows(res.data)
      }
    } catch (err) {
      setError(toMessage(err, 'Failed to load data.'))
      setTabRows([])
      setClosedCampaigns([])
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

'use client'

/**
 * Ported from G2G's
 * `components/domain/talent/recruitment/candidate-detail-panel.tsx`. Markup
 * and behavior unchanged. Adaptations:
 *
 * - `@/components/ui/*` -> the shared `@/components/ui/g2g/*` (Button,
 *   Select) for the primitives that diverge from target's native versions;
 *   StatusBadge, Sheet and Skeleton are unchanged, identical target
 *   primitives.
 * - `recruitmentService` calls take a `SessionContext` first argument
 *   (`buildSessionContext()`), per `_lib/recruitment-api.ts`.
 * - `useCandidateScreeningResult` now returns a plain `{data, isPending, error}`
 *   object from `_lib/use-recruitment.ts` (no react-query) — same field
 *   names as the query result this component already destructured, so no
 *   call-site logic changed.
 */

import React, { useEffect, useMemo, useState } from 'react'
import {
  Mail,
  Phone,
  CalendarDays,
  MoreHorizontal,
  Star,
  Download,
  FileText,
  ArrowRight,
  Clock,
  CheckCircle2,
  MessageSquare,
  Maximize2,
  Eye,
  MapPin,
  Briefcase,
  GraduationCap,
  User,
} from 'lucide-react'
import { Button } from '@/components/ui/g2g/button'
import { Select } from '@/components/ui/g2g/select'
import { StatusBadge } from '@/components/ui/status-badge'
import { Sheet, SheetContent } from '@/components/ui/sheet'
import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'
import type { Candidate, CandidateStage } from './recruitment-data'
import { canProgressCandidate, PIPELINE_STAGES } from './recruitment-data'
import { buildSessionContext, recruitmentService } from '../../_lib/recruitment-api'
import type { FeedbackApi, InterviewApi, InterviewerApi, TalentOfferApi } from '../../_lib/talent-types'
import { useCandidateScreeningResult } from '../../_lib/use-recruitment'

interface CandidateDetailPanelProps {
  candidate: Candidate | null
  onClose: () => void
  onViewProfile?: () => void
  onSaved?: () => void
  onSchedule?: (candidate: Candidate) => void
}

const stageOptions = PIPELINE_STAGES.map((s) => ({ label: s.label, value: s.id }))

const stageVariantMap: Record<CandidateStage, string> = {
  Applied: 'default',
  Screened: 'processing',
  Assessment: 'pending',
  Interview: 'processing',
  Offer: 'active',
  Hired: 'active',
  Rejected: 'error',
}

const timelineIconMap: Record<string, React.ElementType> = {
  stage_change: ArrowRight,
  interview: CalendarDays,
  assessment: CheckCircle2,
  note: MessageSquare,
  email: Mail,
}

/** "20 Aug 2026, 10:30 AM" from separate `interview_date` ("2026-08-20") and
 *  `time` ("10:30") columns - `talent_interview_schedules` stores them apart. */
function formatScheduledAt(date?: string | null, time?: string | null) {
  if (!date) return ''
  const parsed = new Date(time ? `${date}T${time}` : date)
  if (Number.isNaN(parsed.getTime())) return [date, time].filter(Boolean).join(', ')
  const datePart = new Intl.DateTimeFormat('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }).format(parsed)
  if (!time) return datePart
  const timePart = new Intl.DateTimeFormat('en-IN', { hour: 'numeric', minute: '2-digit', hour12: true }).format(parsed)
  return `${datePart}, ${timePart}`
}

/** `talent_interview_schedules.interviewer_id` is a JSON-encoded array
 *  column (e.g. `["9347","9342","9296"]`) - it arrives as that literal
 *  string, not a parsed array, so a plain comma-split would mangle it into
 *  `["9347"`, `"9342"`, `9296"]` quote-and-bracket garbage. Try JSON first. */
function parseInterviewerIds(value: InterviewApi['interviewer_id']): string[] {
  if (Array.isArray(value)) return value.map(String)
  if (!value) return []
  try {
    const parsed = JSON.parse(value) as unknown
    if (Array.isArray(parsed)) return parsed.map(String)
  } catch {
    // Not JSON - fall through to comma-separated.
  }
  return value.split(',').map((id) => id.trim()).filter(Boolean)
}

/** One submitted evaluation, enriched with the scheduled-interview details
 *  (round, date/time, location, interviewer names) the evaluation form
 *  itself doesn't store. `talent_evaluation_form` carries no schedule_id, so
 *  the match is best-effort: same candidate + job + panel, preferring the
 *  schedule row closest in time to when the feedback was submitted. */
interface InterviewHistoryEntry {
  feedback: FeedbackApi
  schedule: InterviewApi | null
  interviewerNames: string[]
}

function buildInterviewHistory(
  feedbackRows: FeedbackApi[],
  schedules: InterviewApi[],
  interviewers: InterviewerApi[],
): InterviewHistoryEntry[] {
  const interviewerName = (id: string) => {
    const match = interviewers.find((item) => String(item.id) === id)
    return match?.name ?? ([match?.first_name, match?.last_name].filter(Boolean).join(' ') || null)
  }
  return [...feedbackRows]
    .sort((a, b) => new Date(b.created_at ?? 0).getTime() - new Date(a.created_at ?? 0).getTime())
    .map((row) => {
      const candidates = schedules.filter((schedule) =>
        String(schedule.job_id) === String(row.job_id) && String(schedule.panel_id) === String(row.panel_id))
      const schedule = candidates.length <= 1
        ? candidates[0] ?? null
        : [...candidates].sort((a, b) => {
          const feedbackTime = new Date(row.created_at ?? 0).getTime()
          return Math.abs(new Date(a.interview_date ?? 0).getTime() - feedbackTime)
            - Math.abs(new Date(b.interview_date ?? 0).getTime() - feedbackTime)
        })[0]
      const interviewerIds = parseInterviewerIds(schedule?.interviewer_id)
      return {
        feedback: row,
        schedule,
        interviewerNames: interviewerIds.map(interviewerName).filter((name): name is string => Boolean(name)),
      }
    })
}

export function CandidateDetailPanel({ candidate, onClose, onViewProfile, onSaved, onSchedule }: CandidateDetailPanelProps) {
  const [activeTab, setActiveTab] = useState<'timeline' | 'interviews' | 'assessments' | 'offer' | 'notes'>('timeline')
  const [feedback, setFeedback] = useState<FeedbackApi | null>(null)
  const [interviewHistory, setInterviewHistory] = useState<InterviewHistoryEntry[]>([])
  const [offer, setOffer] = useState<TalentOfferApi | null>(null)
  const [loadingDetails, setLoadingDetails] = useState(false)
  const profileQuery = useCandidateScreeningResult(candidate?.id ?? null)
  const application = profileQuery.data?.application ?? null
  const screening = profileQuery.data?.screening ?? null

  useEffect(() => {
    queueMicrotask(() => {
      if (candidate?.stage === 'Screened') setActiveTab('assessments')
    })
  }, [candidate?.id, candidate?.stage])

  useEffect(() => {
    if (!candidate) return
    queueMicrotask(() => {
      setLoadingDetails(true)
      const session = buildSessionContext()
      void Promise.allSettled([
        recruitmentService.getCandidateFeedback(session, candidate.id),
        recruitmentService.getOffers(session),
        recruitmentService.getFeedback(session),
        recruitmentService.getInterviews(session),
        recruitmentService.getInterviewers(session),
      ]).then(([feedbackResult, offersResult, allFeedbackResult, interviewsResult, interviewersResult]) => {
        if (feedbackResult.status === 'fulfilled') setFeedback(feedbackResult.value.data ?? null)
        if (offersResult.status === 'fulfilled') setOffer(offersResult.value.find((item) => String(item.application_id) === candidate.id) ?? null)
        const candidateFeedback = allFeedbackResult.status === 'fulfilled'
          ? allFeedbackResult.value.filter((row) => String(row.candidate_id) === candidate.id)
          : []
        const candidateSchedules = interviewsResult.status === 'fulfilled'
          ? interviewsResult.value.filter((row) => String(row.applicant_id) === candidate.id)
          : []
        const interviewers = interviewersResult.status === 'fulfilled' ? interviewersResult.value : []
        setInterviewHistory(buildInterviewHistory(candidateFeedback, candidateSchedules, interviewers))
      }).finally(() => setLoadingDetails(false))
    })
  }, [candidate])

  const timeline = useMemo(() => {
    if (!candidate) return []
    const events = [
      { id: 'applied', type: 'stage_change', title: 'Application received', description: candidate.jobOpening, timestamp: candidate.appliedOn },
    ]
    if (screening) events.push({ id: 'screening', type: 'assessment', title: 'Screening completed', description: `Competency match: ${screening.competency_match ?? '—'}`, timestamp: candidate.lastUpdated })
    if (feedback) events.push({ id: 'feedback', type: 'note', title: 'Interview feedback submitted', description: feedback.recommendation ?? 'Feedback recorded', timestamp: feedback.updated_at ?? feedback.created_at ?? candidate.lastUpdated })
    if (offer) events.push({ id: 'offer', type: 'email', title: 'Offer created', description: offer.status, timestamp: offer.created_at ?? candidate.lastUpdated })
    return events
  }, [candidate, feedback, offer, screening])

  if (!candidate) return null

  const tabs = [
    { id: 'timeline' as const, label: 'Timeline' },
    { id: 'interviews' as const, label: 'Interviews' },
    { id: 'assessments' as const, label: 'Screening' },
    { id: 'offer' as const, label: 'Offer' },
    { id: 'notes' as const, label: 'Notes' },
  ]

  const detailRows = [
    { label: 'Current Stage', value: candidate.stage, isStage: true },
    { label: 'Recruiter', value: candidate.recruiter },
    { label: 'Source', value: candidate.source },
    { label: 'Location', value: application?.current_location ?? candidate.location },
    { label: 'Experience', value: application?.experience ?? candidate.experience },
    { label: 'Qualification', value: application?.qualification ?? application?.education ?? '—' },
    { label: 'Notice Period', value: candidate.noticePeriod },
    { label: 'Expected CTC', value: candidate.expectedCtc },
    { label: 'Resume', value: application?.resume_path ?? candidate.resume, isResume: true },
  ]
  const screeningMetrics = [
    { label: 'Skills Match', value: screening?.scoringPipeline?.detailed_matches?.skills_match, color: 'bg-primary' },
    { label: 'Experience', value: screening?.scoringPipeline?.detailed_matches?.experience_match, color: 'bg-success' },
    { label: 'Education', value: screening?.scoringPipeline?.detailed_matches?.education_match, color: 'bg-warning' },
    {
      label: 'Cultural Fit',
      value: screening?.scoringPipeline?.competency_scoring?.culturalFitIndex ?? screening?.cultural_fit,
      color: 'bg-purple-500',
    },
  ]
  const candidateSkills = (application?.skills ?? '').split(/[,;|\n]/).map((skill) => skill.trim()).filter(Boolean)
  const resumeUrl = application?.resume_path ?? candidate.resume

  const downloadResume = () => {
    if (!resumeUrl) return
    const link = document.createElement('a')
    link.href = resumeUrl
    link.download = `${candidate.name.replace(/\s+/g, '-')}-resume`
    link.rel = 'noopener noreferrer'
    document.body.appendChild(link)
    link.click()
    link.remove()
  }

  return (
    <Sheet open={true} onOpenChange={(open) => !open && onClose()}>
        <SheetContent side="right" className="w-full sm:max-w-md p-0 flex flex-col gap-0 border-l border-border/80 h-full overflow-hidden">
        {/* Header */}
        <div className="flex items-start justify-between p-5 pb-4 border-b border-border/40">
          <div className="flex flex-col gap-1">
            <div className="flex items-center gap-2">
              <h3 className="text-lg font-bold text-foreground">{candidate.name}</h3>
              <div className="size-2 rounded-full bg-success" title="Active" />
            </div>
            <p className="text-sm text-muted-foreground font-medium">{candidate.role}</p>
            <p className="text-xs text-muted-foreground">Applied on {candidate.appliedOn}</p>
          </div>
          {/* SheetContent has its own close button, but we can keep Maximize if we want. For now just removing the custom close button */}
          <div className="flex items-center gap-1 mr-6">
            <Button size="icon" variant="ghost" className="p-1.5 text-muted-foreground">
              <Maximize2 className="size-4" />
            </Button>
          </div>
        </div>

      {/* Quick Actions */}
      <div className="flex items-center justify-around px-5 py-3 border-b border-border/40">
        {[
          { icon: Mail, label: 'Email', href: `mailto:${candidate.email}` },
          { icon: Phone, label: 'Call', href: `tel:${candidate.phone}` },
          { icon: CalendarDays, label: 'Schedule' },
          { icon: MoreHorizontal, label: 'More' },
        ].filter((action) => action.label !== 'Schedule' || canProgressCandidate(candidate)).map((action) => (
          <a
            key={action.label}
            href={action.href}
            onClick={(event) => {
              if (action.label !== 'Schedule') return
              event.preventDefault()
              onSchedule?.(candidate)
            }}
            className="flex flex-col items-center gap-1 text-muted-foreground hover:text-primary transition-colors cursor-pointer group"
          >
            <div className="p-2 rounded-lg group-hover:bg-primary/5 transition-colors">
              <action.icon className="size-4" />
            </div>
            <span className="text-[10px] font-semibold">{action.label}</span>
          </a>
        ))}
      </div>

      {/* Details */}
      <div className="flex-1 overflow-y-auto">
        <div className="p-5 space-y-3">
          {detailRows.map((row) => (
            <div key={row.label} className="flex items-center justify-between gap-4">
              <span className="text-xs font-semibold text-muted-foreground whitespace-nowrap">{row.label}</span>
              {'isStage' in row && row.isStage ? (
                <Select
                  value={candidate.stage}
                  onChange={(stage) => {
                    void recruitmentService.moveCandidate(buildSessionContext(), candidate.id, stage).then(() => onSaved?.())
                  }}
                  options={stageOptions}
                  size="sm"
                  className="w-32"
                />
              ) : 'isResume' in row && row.isResume ? (
                <div className="flex items-center gap-2">
                  <span className="text-sm text-primary font-medium truncate max-w-[160px]">{row.value as string}</span>
                  <button onClick={() => row.value && window.open(row.value as string, '_blank', 'noopener,noreferrer')} className="text-muted-foreground hover:text-primary transition-colors">
                    <Download className="size-3.5" />
                  </button>
                </div>
              ) : (
                <span className="text-sm text-foreground font-medium text-right truncate max-w-[180px]">{row.value as string}</span>
              )}
            </div>
          ))}
        </div>

        {/* Tabs */}
        <div className="border-t border-border/40">
          <div className="flex gap-0 px-5">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={cn(
                  'px-3 py-2.5 text-xs font-semibold transition-colors border-b-2 whitespace-nowrap',
                  activeTab === tab.id
                    ? 'text-primary border-primary'
                    : 'text-muted-foreground border-transparent hover:text-foreground'
                )}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {/* Tab Content */}
        <div className="p-5">
          {activeTab === 'timeline' && (
            <div className="relative">
              <div className="absolute left-[11px] top-2 bottom-2 w-px bg-border/60" />
              <div className="flex flex-col gap-5">
                {timeline.map((event) => {
                  const EventIcon = timelineIconMap[event.type] || Clock
                  return (
                    <div key={event.id} className="flex gap-3 relative">
                      <div className={cn(
                        'size-6 rounded-full flex items-center justify-center shrink-0 z-10 border',
                        event.type === 'stage_change' ? 'bg-primary/10 border-primary/30 text-primary' :
                        event.type === 'assessment' ? 'bg-success/10 border-success/30 text-success' :
                        'bg-muted border-border/60 text-muted-foreground'
                      )}>
                        <EventIcon className="size-3" />
                      </div>
                      <div className="flex flex-col gap-0.5 flex-1 min-w-0">
                        <span className="text-sm font-medium text-foreground">{event.title}</span>
                        <span className="text-xs text-muted-foreground">{event.description}</span>
                      </div>
                      <span className="text-[10px] font-medium text-muted-foreground whitespace-nowrap shrink-0 pt-0.5">{event.timestamp}</span>
                    </div>
                  )
                })}
              </div>
            </div>
          )}
          {activeTab === 'interviews' && (
            loadingDetails ? (
              <div className="space-y-3">
                <Skeleton className="h-32 w-full" />
                <Skeleton className="h-32 w-full" />
              </div>
            ) : interviewHistory.length ? (
              <div className="space-y-4">
                {interviewHistory.map((entry, index) => {
                  const scores = entry.feedback.evaluation_criteria ?? []
                  const overallScore = scores.length
                    ? Math.round((scores.reduce((sum, criterion) => sum + (Number(criterion.score) || 0), 0) / scores.length) * 10) / 10
                    : null
                  const scheduledAt = formatScheduledAt(entry.schedule?.interview_date, entry.schedule?.time)
                  const interviewType = entry.schedule ? (entry.schedule.panel_id ? 'Panel' : 'Video') : null
                  const typeAndLocation = entry.schedule?.location
                    ? (interviewType ? `${interviewType} — ${entry.schedule.location}` : entry.schedule.location)
                    : interviewType
                  return (
                    <div key={String(entry.feedback.id)} className="rounded-lg border border-border/60 bg-card p-4 space-y-3">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="text-sm font-bold text-foreground">
                            Round {entry.schedule?.round_no ?? index + 1}
                          </p>
                          <p className="text-xs text-muted-foreground">{entry.feedback.job_title ?? candidate.jobOpening}</p>
                        </div>
                        <StatusBadge variant={
                          entry.feedback.status === 'approved' ? 'active'
                            : entry.feedback.status === 'rejected' ? 'error'
                            : entry.feedback.status === 'draft' ? 'pending' : 'processing'
                        }>
                          {entry.feedback.status ?? 'submitted'}
                        </StatusBadge>
                      </div>

                      <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-xs">
                        <div>
                          <p className="font-semibold text-muted-foreground">Interview Panel</p>
                          <p className="font-medium text-foreground">{entry.feedback.panel_name ?? '—'}</p>
                        </div>
                        <div>
                          <p className="font-semibold text-muted-foreground">Interviewer(s)</p>
                          <p className="font-medium text-foreground">{entry.interviewerNames.length ? entry.interviewerNames.join(', ') : '—'}</p>
                        </div>
                        <div>
                          <p className="font-semibold text-muted-foreground">Date & Time</p>
                          <p className="font-medium text-foreground">{scheduledAt || '—'}</p>
                        </div>
                        <div>
                          <p className="font-semibold text-muted-foreground">Type / Location</p>
                          <p className="font-medium text-foreground">{typeAndLocation || '—'}</p>
                        </div>
                        <div>
                          <p className="font-semibold text-muted-foreground">Interview Status</p>
                          <p className="font-medium text-foreground">{entry.feedback.application_status ?? entry.schedule?.status ?? '—'}</p>
                        </div>
                      </div>

                      {overallScore != null && (
                        <div className="flex items-center justify-between rounded-md bg-muted/40 px-3 py-2">
                          <span className="text-xs font-semibold text-muted-foreground">Overall Score</span>
                          <span className="text-sm font-bold text-primary">{overallScore}/10</span>
                        </div>
                      )}

                      {!!scores.length && (
                        <div className="grid grid-cols-2 gap-2">
                          {scores.map((criterion) => (
                            <div key={criterion.name} className="rounded-md border border-border/50 px-2 py-1.5 text-center">
                              <p className="text-[10px] text-muted-foreground">{criterion.name}</p>
                              <p className="text-sm font-bold text-foreground">{criterion.score}/10</p>
                            </div>
                          ))}
                        </div>
                      )}

                      {entry.feedback.recommendation && (
                        <div className="text-xs">
                          <span className="font-semibold text-muted-foreground">Recommendation: </span>
                          <span className="font-semibold text-foreground">{entry.feedback.recommendation}</span>
                        </div>
                      )}

                      {entry.feedback.key_strengths && (
                        <div className="text-xs">
                          <p className="font-semibold text-muted-foreground">Strengths</p>
                          <p className="text-foreground">{entry.feedback.key_strengths}</p>
                        </div>
                      )}

                      {entry.feedback.areas_of_concern && (
                        <div className="text-xs">
                          <p className="font-semibold text-muted-foreground">Areas for Improvement</p>
                          <p className="text-foreground">{entry.feedback.areas_of_concern}</p>
                        </div>
                      )}

                      {(entry.feedback.additional_comments || entry.feedback.notes) && (
                        <div className="text-xs">
                          <p className="font-semibold text-muted-foreground">Interview Feedback / Comments</p>
                          <p className="whitespace-pre-wrap text-foreground">{entry.feedback.additional_comments || entry.feedback.notes}</p>
                        </div>
                      )}

                      <p className="text-[10px] text-muted-foreground">Submitted {entry.feedback.created_at ?? '—'}</p>
                    </div>
                  )
                })}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-8 text-center">
                <CalendarDays className="size-8 text-muted-foreground/40 mb-2" />
                <p className="text-sm font-medium">{application?.status ?? candidate.stage}</p>
                <p className="text-xs text-muted-foreground">No interview feedback submitted yet.</p>
              </div>
            )
          )}
          {activeTab === 'assessments' && (
            <div className="py-2">
              {profileQuery.isPending ? (
                <div className="w-full space-y-3">
                  <Skeleton className="h-16 w-full" />
                  <Skeleton className="h-20 w-full" />
                  <Skeleton className="h-24 w-full" />
                </div>
              ) : (
                <div className="space-y-4 text-left text-sm">
                {screening ? (
                <div className="space-y-4">
                  <div className="flex items-start gap-3">
                    <div className="size-10 shrink-0 overflow-hidden rounded-full bg-primary/10 text-primary flex items-center justify-center">
                      {(application?.candidate_photo ?? application?.photo) ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={application?.candidate_photo ?? application?.photo ?? ''} alt={candidate.name} className="size-full object-cover" />
                      ) : <User className="size-5" />}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-bold text-foreground">{candidate.name}</span>
                        <span className="font-black text-primary">{screening.competency_match ?? 0}%</span>
                      </div>
                      <p className="text-xs text-muted-foreground">Applied for {candidate.jobOpening}</p>
                      <div className="mt-1 flex flex-wrap gap-3 text-[11px] text-muted-foreground">
                        <span className="flex items-center gap-1"><MapPin className="size-3" />{application?.current_location ?? candidate.location}</span>
                        <span className="flex items-center gap-1"><Briefcase className="size-3" />{application?.experience ?? candidate.experience}</span>
                        <span className="flex items-center gap-1"><GraduationCap className="size-3" />{application?.qualification ?? application?.education ?? '—'}</span>
                      </div>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    {screeningMetrics.map((metric) => {
                      const numericValue = typeof metric.value === 'number' ? metric.value : Number(metric.value)
                      const percentage = Number.isFinite(numericValue) ? Math.min(100, Math.max(0, numericValue)) : 0
                      return <div key={metric.label} className="text-center">
                        <div className="font-bold">{metric.value ?? '—'}{typeof metric.value === 'number' ? '%' : ''}</div>
                        <div className="my-1 h-1.5 overflow-hidden rounded-full bg-muted"><div className={cn('h-full rounded-full', metric.color)} style={{ width: `${percentage}%` }} /></div>
                        <div className="text-[10px] text-muted-foreground">{metric.label}</div>
                      </div>
                    })}
                  </div>
                  <div className="flex gap-6">
                    <div><strong>{screening.predicted_success ?? '—'}</strong><p className="text-xs text-muted-foreground">Predicted Success</p></div>
                    <div><strong>{screening.ranking_score ?? screening.scoringPipeline?.competency_scoring?.rankingScore ?? '—'}/100</strong><p className="text-xs text-muted-foreground">Ranking Score</p></div>
                  </div>
                  {!!screening.skill_gaps?.length && <div><p className="mb-2 font-semibold">Skill Gaps</p><div className="flex flex-wrap gap-1.5">{screening.skill_gaps.map((gap, index) => <span key={`${gap}-${index}`} className="rounded-full bg-destructive/10 px-2 py-1 text-[10px] font-semibold text-destructive">{gap}</span>)}</div></div>}
                  {!!screening.strengths?.length && <div><p className="mb-2 font-semibold">Key Strengths</p><div className="flex flex-wrap gap-1.5">{screening.strengths.map((strength, index) => <span key={`${strength}-${index}`} className="rounded-full bg-primary px-2 py-1 text-[10px] font-semibold text-primary-foreground">{strength}</span>)}</div></div>}
                  {!!candidateSkills.length && <div><p className="mb-2 font-semibold">Candidate Key Skills</p><div className="flex flex-wrap gap-1.5">{candidateSkills.map((skill, index) => <span key={`${skill}-${index}`} className="rounded-full bg-muted px-2 py-1 text-[10px] font-semibold">{skill}</span>)}</div></div>}
                  <div className="flex flex-wrap justify-end gap-2 border-t border-border/40 pt-3">
                    {application?.profile_url && <Button size="sm" variant="outline" onClick={() => window.open(application.profile_url!, '_blank', 'noopener,noreferrer')}><Eye className="mr-1.5 size-3.5" />View Profile</Button>}
                    <Button size="sm" variant="outline" disabled={!resumeUrl} onClick={() => resumeUrl && window.open(resumeUrl, '_blank', 'noopener,noreferrer')}><Eye className="mr-1.5 size-3.5" />View Resume</Button>
                    <Button size="sm" variant="outline" disabled={!resumeUrl} onClick={downloadResume}><Download className="mr-1.5 size-3.5" />Download Resume</Button>
                  </div>
                </div>
                ) : <p className="py-8 text-center text-sm text-muted-foreground font-medium">{profileQuery.error instanceof Error ? profileQuery.error.message : 'No screening result found'}</p>}
                {/* Always visible, screening result or not - a candidate can
                    be moved to Screened (Shortlist) or Rejected without a
                    stored screening result (e.g. shortlisted manually), and
                    the action must still be reachable here. Same status
                    update as the Applied card's three-dot menu
                    (recruitment-center.tsx's shortlistCandidate/rejectCandidate) -
                    only flips `status`, never re-runs screening, so any
                    screening result shown above stays exactly as it was.
                    "Schedule Interview" reuses the same `onSchedule` callback
                    the header Quick Actions bar already calls - the drawer it
                    opens (RecruitmentActionDrawer) already prefills the
                    candidate and job fields from `preselectedCandidate`. */}
                <div className="flex flex-wrap justify-end gap-2 border-t border-border/40 pt-3 mt-4">
                  {canProgressCandidate(candidate) && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => onSchedule?.(candidate)}
                    >
                      <CalendarDays className="mr-1.5 size-3.5" />Schedule Interview
                    </Button>
                  )}
                  {canProgressCandidate(candidate) && (
                    <Button
                      size="sm"
                      onClick={() => void recruitmentService.updateApplication(buildSessionContext(), candidate.id, { status: 'Shortlisted' }).then(() => onSaved?.())}
                    >
                      <CheckCircle2 className="mr-1.5 size-3.5" />Shortlist
                    </Button>
                  )}
                  <Button
                    size="sm"
                    variant="destructive"
                    onClick={() => void recruitmentService.updateApplication(buildSessionContext(), candidate.id, { status: 'Rejected' }).then(() => onSaved?.())}
                  >
                    Reject
                  </Button>
                </div>
                </div>
              )}
            </div>
          )}
          {activeTab === 'offer' && (
            <div className="flex flex-col items-center justify-center py-8 text-center">
              <FileText className="size-8 text-muted-foreground/40 mb-2" />
              {offer ? <div className="space-y-1 text-sm"><p className="font-semibold">{offer.position}</p><p>{offer.salary ?? '—'}</p><StatusBadge variant="processing">{offer.status}</StatusBadge></div> : <p className="text-sm text-muted-foreground font-medium">No offer found</p>}
            </div>
          )}
          {activeTab === 'notes' && (
            <div className="flex flex-col items-center justify-center py-8 text-center">
              <MessageSquare className="size-8 text-muted-foreground/40 mb-2" />
              <p className="text-sm text-muted-foreground font-medium">{feedback?.additional_comments ?? feedback?.notes ?? 'No feedback notes found'}</p>
            </div>
          )}
        </div>
      </div>

      {/* Footer */}
      <div className="p-4 border-t border-border/40">
        <Button className="w-full bg-background text-foreground border border-input shadow-sm hover:bg-muted font-bold py-5" onClick={onViewProfile}>
          View Full Profile
        </Button>
      </div>
      </SheetContent>
    </Sheet>
  )
}

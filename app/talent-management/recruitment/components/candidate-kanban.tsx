'use client'

/**
 * Ported as-is from G2G's
 * `components/domain/talent/recruitment/candidate-kanban.tsx`. Only import
 * paths changed: `@/components/ui/button` -> the shared
 * `@/components/ui/g2g/button`, `./recruitment-data` unchanged (still a
 * sibling file).
 */

import React from 'react'
import { Star, MoreVertical } from 'lucide-react'
import { StatusBadge } from '@/components/ui/status-badge'
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from '@/components/ui/g2g/dropdown-menu'
import { cn } from '@/lib/utils'
import { canProgressCandidate, type Candidate, type CandidateStage } from './recruitment-data'

interface CandidateCardProps {
  candidate: Candidate
  onClick: (candidate: Candidate) => void
  onShortlist: (candidate: Candidate) => void
  onReject: (candidate: Candidate) => void
  onScheduleInterview: (candidate: Candidate) => void
  onInterviewFeedback: (candidate: Candidate) => void
  onReschedule: (candidate: Candidate) => void
  onCreateOffer: (candidate: Candidate) => void
}

/** Rounds to a whole percentage; screening scores can arrive as strings too. */
function formatScore(score: number | string | null | undefined) {
  const numeric = typeof score === 'number' ? score : Number(score)
  return Number.isFinite(numeric) ? `${Math.round(numeric)}% match` : 'Screened'
}

export function CandidateCard({ candidate, onClick, onShortlist, onReject, onScheduleInterview, onInterviewFeedback, onReschedule, onCreateOffer }: CandidateCardProps) {
  return (
    <div
      draggable
      onDragStart={(event) => {
        event.dataTransfer.effectAllowed = 'move'
        event.dataTransfer.setData('text/recruitment-candidate-id', candidate.id)
      }}
      onClick={() => onClick(candidate)}
      className="group flex flex-col gap-2 rounded-lg border border-border/60 bg-card p-3 shadow-sm cursor-pointer transition-all duration-200 hover:shadow-md hover:border-primary/30 hover:-translate-y-0.5"
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex flex-col gap-0.5 min-w-0">
          <span className="text-sm font-semibold text-foreground truncate">{candidate.name}</span>
          <span className="text-xs text-muted-foreground truncate">{candidate.role}</span>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          {candidate.starred && <Star className="size-3.5 text-warning fill-warning" />}
          <DropdownMenu modal={false}>
            <DropdownMenuTrigger
              className="p-0.5 size-6 rounded text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity outline-none cursor-pointer flex items-center justify-center hover:bg-muted"
              onClick={(e) => { e.stopPropagation() }}
            >
              <MoreVertical className="size-3.5" />
            </DropdownMenuTrigger>
            <DropdownMenuContent onClick={(e) => e.stopPropagation()}>
              <DropdownMenuItem onClick={() => onClick(candidate)}>View application</DropdownMenuItem>
              {candidate.stage === 'Applied' && (
                <DropdownMenuItem onClick={() => onShortlist(candidate)}>Shortlist</DropdownMenuItem>
              )}
              {candidate.stage === 'Interview' ? (
                <>
                  <DropdownMenuItem onClick={() => onInterviewFeedback(candidate)}>Interview Feedback</DropdownMenuItem>
                  <DropdownMenuItem onClick={() => onReschedule(candidate)}>Reschedule</DropdownMenuItem>
                  <DropdownMenuItem onClick={() => onCreateOffer(candidate)}>Create Offer</DropdownMenuItem>
                  <DropdownMenuItem onClick={() => onReject(candidate)}>Reject</DropdownMenuItem>
                </>
              ) : (
                <>
                  {candidate.stage !== 'Applied' && canProgressCandidate(candidate) && (
                    <DropdownMenuItem onClick={() => onScheduleInterview(candidate)}>Schedule interview</DropdownMenuItem>
                  )}
                  {candidate.stage !== 'Screened' && (
                    <DropdownMenuItem onClick={() => onReject(candidate)}>Reject</DropdownMenuItem>
                  )}
                </>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
      <div className="flex items-center justify-between gap-2">
        <span className="text-[11px] text-muted-foreground">{candidate.appliedOn}</span>
        {/* The Applied column holds both screened and not-yet-screened
            candidates (see candidatesByStage in recruitment-center.tsx): a
            completed screening shows its score right here instead of a
            generic "Screened" tag, reusing the score the kanban list
            endpoint already returns - no extra screening call. Any other
            stage has already moved past screening and gets no tag. */}
        {candidate.screeningCompleted ? (
          <StatusBadge variant="active" size="sm">{formatScore(candidate.screeningScore)}</StatusBadge>
        ) : candidate.stage === 'Applied' ? (
          <StatusBadge variant="pending" size="sm">Screening pending</StatusBadge>
        ) : null}
      </div>
    </div>
  )
}

interface KanbanColumnProps {
  stage: { id: CandidateStage; label: string; color: string }
  candidates: Candidate[]
  count: number
  onCandidateClick: (candidate: Candidate) => void
  onCandidateApply: () => void
  onCandidateMove: (candidateId: string, stage: CandidateStage) => void
  onShortlist: (candidate: Candidate) => void
  onReject: (candidate: Candidate) => void
  onScheduleInterview: (candidate: Candidate) => void
  onInterviewFeedback: (candidate: Candidate) => void
  onReschedule: (candidate: Candidate) => void
  onCreateOffer: (candidate: Candidate) => void
}

export function KanbanColumn({ stage, candidates, count, onCandidateClick, onCandidateApply, onCandidateMove, onShortlist, onReject, onScheduleInterview, onInterviewFeedback, onReschedule, onCreateOffer }: KanbanColumnProps) {
  return (
    <div
      className="flex flex-col min-w-[200px] w-[200px] shrink-0"
      onDragOver={(event) => {
        event.preventDefault()
        event.dataTransfer.dropEffect = 'move'
      }}
      onDrop={(event) => {
        event.preventDefault()
        const candidateId = event.dataTransfer.getData('text/recruitment-candidate-id')
        if (candidateId) onCandidateMove(candidateId, stage.id)
      }}
    >
      {/* Column header */}
      <div className="flex items-center gap-2 mb-3 px-1">
        <div className={cn('size-2 rounded-full', stage.color.replace('/20', '').replace('/30', ''))} />
        <span className="text-sm font-semibold text-foreground">{stage.label}</span>
        <span className="text-xs font-bold text-muted-foreground ml-auto tabular-nums">{count}</span>
      </div>
      {/* Column body */}
      <div className="flex flex-col gap-2 flex-1 overflow-y-auto max-h-[400px] pr-1 scrollbar-thin">
        {candidates.map((candidate) => (
          <CandidateCard
            key={candidate.id}
            candidate={candidate}
            onClick={onCandidateClick}
            onShortlist={onShortlist}
            onReject={onReject}
            onScheduleInterview={onScheduleInterview}
            onInterviewFeedback={onInterviewFeedback}
            onReschedule={onReschedule}
            onCreateOffer={onCreateOffer}
          />
        ))}
        {candidates.length === 0 && (
          <div className="flex items-center justify-center h-20 rounded-lg border border-dashed border-border/60 text-xs text-muted-foreground">
            No candidates
          </div>
        )}
      </div>
      {/* Candidate application entry point */}
      {/* <Button onClick={onCandidateApply} variant="ghost" size="sm" className="flex items-center gap-1.5 mt-2 px-2 py-1.5 text-xs text-muted-foreground font-medium hover:text-primary hover:bg-primary/5 h-auto">
        <Plus className="size-3.5" /> Candidate Apply
      </Button> */}
    </div>
  )
}

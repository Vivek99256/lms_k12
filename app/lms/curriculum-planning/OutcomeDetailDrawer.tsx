'use client';

// The Outcome Detail drawer: full outcome statement, curriculum context,
// delivery/assessment/achievement evidence, mapped concepts with their own
// PAL mastery (where it exists), the gap explanation, and links out to the
// existing Concept Intelligence / Coherence Map / Question Bank screens -
// this never re-implements those, only deep-links into them.

import Link from 'next/link';
import { AlertCircle, ArrowUpRight, Loader2 } from 'lucide-react';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { buttonVariants } from '@/components/ui/button';
import { SectionHeading, NotProvided } from './shared';
import { useOutcomeDetail, type OutcomeFilters } from './useOutcomeAnalytics';
import { Pill, RESOURCE_TYPE_LABEL, StatusDot, achievementTierLabel, achievementTone, deliveryStatusTone, formatAchievementValue } from './outcomes-shared';

export function OutcomeDetailDrawer({
  outcomeId,
  filters,
  onClose,
}: {
  outcomeId: number;
  filters: OutcomeFilters;
  onClose: () => void;
}) {
  const { detail, isLoading, loadError } = useOutcomeDetail(outcomeId, filters);

  return (
    <Sheet open onOpenChange={(open) => !open && onClose()}>
      <SheetContent side="right" className="w-full overflow-y-auto sm:max-w-xl">
        {isLoading ? (
          <div className="flex items-center gap-2 py-10 text-sm text-[#77716b]">
            <Loader2 size={15} className="animate-spin" />
            Loading outcome detail...
          </div>
        ) : loadError ? (
          <div className="flex items-start gap-2 py-6 text-sm text-[#a33a2a]">
            <AlertCircle size={15} className="mt-0.5 shrink-0" />
            {loadError}
          </div>
        ) : !detail ? (
          <div className="py-6 text-sm text-[#9a958e]">No detail found for this outcome.</div>
        ) : (
          <>
            <SheetHeader>
              <div className="flex flex-wrap items-baseline gap-2">
                {detail.code ? (
                  <span className="rounded bg-[#dcecff] px-1.5 py-0.5 font-mono text-[11px] font-semibold text-[#114f8f]">
                    {detail.code}
                  </span>
                ) : null}
                {detail.type ? (
                  <span className="text-[11px] uppercase tracking-wide text-[#a09a93]">{detail.type}</span>
                )
                  : null}
              </div>
              <SheetTitle className="text-base leading-snug">{detail.description || 'No description recorded'}</SheetTitle>
            </SheetHeader>

            <div className="space-y-5 pb-4">
              {detail.parent ? (
                <p className="text-xs text-[#77716b]">
                  Under goal{' '}
                  <span className="font-mono font-semibold text-[#5c574f]">{detail.parent.code}</span>
                  {detail.parent.description ? ` — ${detail.parent.description}` : ''}
                </p>
              ) : null}

              {detail.chapter ? (
                <p className="text-xs text-[#77716b]">
                  Curriculum location: <span className="font-medium text-[#3c3833]">{detail.chapter.chapter_name}</span>
                </p>
              ) : null}

              {/* Gap insight first - this is the one sentence a teacher needs before anything else. */}
              <div className="rounded-lg border border-[#e5e1da] bg-[#faf9f7] px-3 py-2.5">
                <SectionHeading>Gap analysis</SectionHeading>
                <p className="text-sm leading-relaxed text-[#3c3833]">{detail.gap_explanation}</p>
              </div>

              <div>
                <SectionHeading>Delivered</SectionHeading>
                {detail.delivery ? (
                  <div className="flex flex-wrap items-center gap-2 text-sm text-[#3c3833]">
                    <Pill tone={deliveryStatusTone(detail.delivery.status)}>{detail.delivery.status}</Pill>
                    <span>{detail.delivery.completed_periods} of {detail.delivery.total_periods} periods completed</span>
                    {detail.delivery.start_date ? (
                      <span className="text-xs text-[#9a958e]">
                        {detail.delivery.start_date} – {detail.delivery.end_date ?? '…'}
                      </span>
                    ) : null}
                  </div>
                ) : (
                  <NotProvided label="This is a curriculum-level outcome with no single chapter to deliver." />
                )}
              </div>

              <div>
                <SectionHeading>Assessment</SectionHeading>
                {detail.assessment ? (
                  <p className="text-sm text-[#3c3833]">
                    {detail.assessment.chapter_question_count} question(s) in the chapter&apos;s bank
                    {detail.assessment.concept_level_question_count > 0 ? (
                      <span className="text-xs text-[#9a958e]"> · {detail.assessment.concept_level_question_count} tagged to this outcome&apos;s concepts specifically</span>
                    ) : null}
                  </p>
                ) : (
                  <NotProvided />
                )}
              </div>

              <div>
                <SectionHeading>Linked Resources</SectionHeading>
                {detail.resources ? (
                  detail.resources.chapter_resource_count === 0 ? (
                    <p className="text-sm italic text-[#a09a93]">No resources attached to this chapter yet.</p>
                  ) : (
                    <div className="flex flex-wrap gap-1.5">
                      {Object.entries(detail.resources.breakdown).map(([type, count]) => (
                        <span key={type} className="rounded-full bg-[#e8e4fb] px-2.5 py-1 text-xs font-medium text-[#473aa5]">
                          {count} {RESOURCE_TYPE_LABEL[type] ?? type}
                        </span>
                      ))}
                    </div>
                  )
                ) : (
                  <NotProvided />
                )}
              </div>

              <div>
                <SectionHeading>Achievement, Mastery &amp; Status</SectionHeading>
                <div className="flex flex-wrap items-end gap-4">
                  <div>
                    <p className="text-[11px] uppercase tracking-wide text-[#a09a93]">Achievement</p>
                    <span className="text-2xl font-semibold text-[#1f1d19]">{formatAchievementValue(detail.achievement.value)}</span>
                  </div>
                  {detail.achievement.mastery !== null ? (
                    <div>
                      <p className="text-[11px] uppercase tracking-wide text-[#a09a93]">Mastery</p>
                      <span className="text-2xl font-semibold text-[#1f1d19]">{detail.achievement.mastery}%</span>
                    </div>
                  ) : null}
                  <div className="pb-1.5">
                    <StatusDot status={detail.achievement.status} />
                  </div>
                </div>
                <div className="mt-2 flex items-center gap-2">
                  <Pill tone={achievementTone(detail.achievement.tier)}>
                    {achievementTierLabel(detail.achievement.tier)}
                  </Pill>
                </div>
                {detail.achievement.source ? (
                  <p className="mt-1 text-xs text-[#9a958e]">{detail.achievement.source}</p>
                ) : null}
                {detail.achievement.secondary ? (
                  <p className="mt-2 text-xs text-[#706b64]">
                    Exam-based comparison: <span className="font-medium">{detail.achievement.secondary.value}%</span>
                    <span className="text-[#9a958e]"> ({detail.achievement.secondary.source})</span>
                  </p>
                ) : null}
              </div>

              {detail.mapped_concepts.length > 0 ? (
                <div>
                  <SectionHeading>Mapped concepts ({detail.mapped_concepts.length})</SectionHeading>
                  <ul className="space-y-1.5">
                    {detail.mapped_concepts.map((concept) => (
                      <li key={concept.concept_id} className="flex items-center justify-between gap-2 rounded-md bg-[#faf9f7] px-2.5 py-1.5 text-sm">
                        <span className="min-w-0 truncate text-[#3c3833]">{concept.concept_name ?? `Concept #${concept.concept_id}`}</span>
                        <span className="shrink-0 text-xs text-[#9a958e]">
                          {concept.pal_mastery_pct !== null ? `${concept.pal_mastery_pct}% mastery` : 'No mastery evidence'}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}

              {detail.links ? (
                <div className="flex flex-wrap gap-2 border-t border-[#e9e5de] pt-4">
                  <Link href={detail.links.concept_intelligence} className={buttonVariants({ variant: 'outline', size: 'sm' })}>
                    Concept Intelligence <ArrowUpRight size={13} />
                  </Link>
                  <Link href={detail.links.coherence_map} className={buttonVariants({ variant: 'outline', size: 'sm' })}>
                    Coherence Map <ArrowUpRight size={13} />
                  </Link>
                  <Link href={detail.links.question_bank} className={buttonVariants({ variant: 'outline', size: 'sm' })}>
                    Question Bank <ArrowUpRight size={13} />
                  </Link>
                </div>
              ) : null}
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}

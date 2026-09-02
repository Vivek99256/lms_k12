'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowRight, BookOpen, CheckCircle2, Circle, ListChecks, Lock, MessageSquareText, Target } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { EmptyState, SectionPanel, StatCard } from '@/app/dashboard/_components/DashboardPrimitives';
import { type ChapterDashboard, type ChapterSection, type ChapterSectionStatus, type MasterySignal } from '@/app/pal/data/pal-eso';

/**
 * The "Hello, {name}" chapter-level PAL dashboard content — everything
 * below the page shell. Shared by the chapter-scoped route
 * (app/pal/eso/chapter/[chapterId]/page.tsx) and the main student dashboard
 * (app/dashboard/StudentDashboard.tsx, which auto-picks the chapter via
 * fetchAutoStudentDashboard). Every field is driven by `data`, which both
 * callers get from the same EsoPolicyService::chapterDashboard() response
 * shape — nothing here is static.
 */
export default function ChapterDashboardView({
  studentName,
  data,
  learnerId,
  onGoToSubject,
  onOpenConcept,
}: {
  studentName?: string;
  data: ChapterDashboard;
  learnerId: string;
  onGoToSubject: (subjectId: number) => void;
  onOpenConcept: (conceptId: number) => void;
}) {
  const router = useRouter();
  const [showWhy, setShowWhy] = useState(false);
  const initialMasteryConceptId = data.currentConceptId ?? data.chapterSections[0]?.conceptId ?? null;

  return (
    <>
      <DashboardHeader
        studentName={studentName}
        data={data}
        onGoToSubject={onGoToSubject}
        onSeeMasteryDetails={() =>
          initialMasteryConceptId &&
          router.push(`/pal/eso/mastery/${initialMasteryConceptId}?learnerId=${learnerId}&chapterId=${data.chapterId}`)
        }
      />

      <div className="my-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Mastered concepts"
          value={`${data.masteredConcepts} of ${data.totalConceptsInCurriculum}`}
          icon={ListChecks}
          tone={data.masteredConcepts > 0 ? 'positive' : 'default'}
        />
        <StatCard label="Current concept" value={data.currentConceptName ?? 'Chapter complete'} icon={Target} />
        <StatCard label="Responses on this concept" value={data.responsesOnCurrentConcept} icon={MessageSquareText} />
        <StatCard label="All responses" value={data.allResponses} icon={BookOpen} />
      </div>

      {data.nextStep && (
        <NextStepPanel
          nextStep={data.nextStep}
          conceptId={data.currentConceptId}
          onStart={() => data.currentConceptId && onOpenConcept(data.currentConceptId)}
          showWhy={showWhy}
          onToggleWhy={() => setShowWhy((v) => !v)}
        />
      )}

      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-2">
        <SectionPanel
          title={`Sections in this chapter (${data.chapterSections.length})`}
          description={`This shows every section in ${data.chapterName}.`}
        >
          <ChapterSectionsList sections={data.chapterSections} onOpen={onOpenConcept} />
        </SectionPanel>

        <SectionPanel title="What PAL has seen so far" description="Evidence gathered on your current concept.">
          <MasterySignalsList signals={data.masterySignals} />
        </SectionPanel>
      </div>
    </>
  );
}

function DashboardHeader({
  studentName,
  data,
  onGoToSubject,
  onSeeMasteryDetails,
}: {
  studentName?: string;
  data: ChapterDashboard;
  onGoToSubject: (subjectId: number) => void;
  onSeeMasteryDetails: () => void;
}) {
  return (
    <div>
      <h1 className="text-2xl font-bold text-slate-900">Hello, {studentName || 'Student'}</h1>
      <p className="mt-1 text-sm text-slate-500">This page shows where you are, and all students start from the same concept.</p>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <span className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-medium text-slate-600">{data.chapterName}</span>
        {data.currentConceptName && (
          <span className="rounded-full border border-indigo-200 bg-indigo-50 px-3 py-1 text-xs font-medium text-indigo-700">
            Starting point &middot; {data.currentConceptName}
          </span>
        )}
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        <Button onClick={() => onGoToSubject(data.subjectId)} className="bg-indigo-600 text-white hover:bg-indigo-700">
          Go to {data.subjectName || 'subject'}
          <ArrowRight className="h-3.5 w-3.5" />
        </Button>
        <Button variant="outline" onClick={onSeeMasteryDetails} className="border-indigo-200 text-indigo-700 hover:bg-indigo-50">
          See mastery details
        </Button>
      </div>
    </div>
  );
}

/**
 * `ruleFired` is the engine's own internal audit code ("D1".."D5" — see
 * EsoPolicyService's D1-D5 policy) — accurate for the decision-log audit
 * trail, but meaningless to a student on its own. This translates it into
 * the plain-language reason a student can actually read; the raw code is
 * still available to teachers/parents via the decision-log endpoint.
 */
function ruleFiredExplanation(ruleFired: string): string {
  const code = ruleFired.split(':')[0].trim();
  switch (code) {
    case 'D1':
      return "Why: based on your diagnostic answers (or this being your first time on this part of the concept).";
    case 'D2':
      return 'Why: an earlier concept this one builds on still needs more work first.';
    case 'D3':
      return 'Why: one of your recent answers pointed at a common mix-up, so PAL wants to clear that up before moving on.';
    case 'D4':
      return "Why: based on your accuracy and how much you've practiced this concept so far.";
    case 'D5':
      return "Why: it's been a few days since you mastered this, so PAL wants a quick check that it's still solid.";
    default:
      return 'Why: based on your recorded progress on this concept.';
  }
}

function NextStepPanel({
  nextStep,
  conceptId,
  onStart,
  showWhy,
  onToggleWhy,
}: {
  nextStep: NonNullable<ChapterDashboard['nextStep']>;
  conceptId: number | null;
  onStart: () => void;
  showWhy: boolean;
  onToggleWhy: () => void;
}) {
  return (
    <SectionPanel
      title="Next Step"
      className="mt-6"
      action={
        <span
          className={`shrink-0 rounded-full px-2.5 py-0.5 text-xs font-semibold ${
            nextStep.hasEvidence ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-500'
          }`}
        >
          {nextStep.hasEvidence ? 'Evidence recorded' : 'No evidence yet'}
        </span>
      }
    >
      <h4 className="text-base font-semibold text-slate-900">{nextStep.title}</h4>
      <p className="mt-1 text-sm text-slate-600">{nextStep.subtitle}</p>

      {nextStep.reasons.length > 0 && (
        <ul className="mt-3 space-y-1.5">
          {nextStep.reasons.map((reason, index) => (
            <li key={index} className="flex items-start gap-1.5 text-xs text-slate-500">
              <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-slate-400" />
              {reason}
            </li>
          ))}
        </ul>
      )}

      <div className="mt-4 flex flex-wrap items-center gap-2">
        {nextStep.ctaLabel && conceptId && (
          <Button onClick={onStart} className="bg-indigo-600 text-white hover:bg-indigo-700">
            {nextStep.ctaLabel}
          </Button>
        )}
        <Button variant="outline" size="sm" onClick={onToggleWhy} className="border-indigo-200 text-indigo-700 hover:bg-indigo-50">
          See why
        </Button>
      </div>

      {showWhy && (
        <div className="mt-3 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-600">
          {ruleFiredExplanation(nextStep.ruleFired)}
        </div>
      )}
    </SectionPanel>
  );
}

const SECTION_STATUS_LABEL: Record<ChapterSectionStatus, string> = {
  locked: 'Locked',
  not_started: 'Not started',
  in_progress: 'In progress',
  mastered: 'Mastered',
};

const SECTION_STATUS_STYLE: Record<ChapterSectionStatus, string> = {
  locked: 'bg-slate-100 text-slate-500',
  not_started: 'bg-slate-100 text-slate-600',
  in_progress: 'bg-amber-50 text-amber-700',
  mastered: 'bg-emerald-50 text-emerald-700',
};

function ChapterSectionsList({ sections, onOpen }: { sections: ChapterSection[]; onOpen: (conceptId: number) => void }) {
  if (sections.length === 0) {
    return <EmptyState message="No sections are ready for adaptive learning in this chapter yet." />;
  }

  return (
    <div className="divide-y divide-slate-100">
      {sections.map((section) => {
        const clickable = section.status !== 'locked';
        return (
          <button
            key={section.conceptId}
            type="button"
            disabled={!clickable}
            onClick={() => clickable && onOpen(section.conceptId)}
            className={`flex w-full items-center justify-between gap-3 py-3 text-left ${
              clickable ? 'hover:bg-slate-50' : 'cursor-not-allowed opacity-70'
            }`}
          >
            <span className="flex items-center gap-2 text-sm font-medium text-slate-900">
              {section.status === 'locked' ? (
                <Lock className="h-3.5 w-3.5 shrink-0 text-slate-400" />
              ) : section.status === 'mastered' ? (
                <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-emerald-500" />
              ) : (
                <Circle className="h-3.5 w-3.5 shrink-0 text-slate-300" />
              )}
              {section.name}
            </span>
            <span className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-semibold ${SECTION_STATUS_STYLE[section.status]}`}>
              {SECTION_STATUS_LABEL[section.status]}
            </span>
          </button>
        );
      })}
    </div>
  );
}

function MasterySignalsList({ signals }: { signals: MasterySignal[] }) {
  if (signals.length === 0) {
    return <EmptyState message="No signals recorded yet." />;
  }

  return (
    <div className="space-y-3">
      {signals.map((signal) => {
        const percent = signal.hasEvidence ? Math.round((signal.value ?? 0) * 100) : 0;
        return (
          <div key={signal.key}>
            <div className="flex items-center justify-between gap-2 text-sm">
              <span className="text-slate-700">{signal.label}</span>
              <span className="shrink-0 text-xs text-slate-400">{signal.hasEvidence ? `${percent}%` : 'Not enough evidence'}</span>
            </div>
            <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-slate-100">
              <div className="h-full rounded-full bg-indigo-500" style={{ width: `${percent}%` }} />
            </div>
          </div>
        );
      })}
    </div>
  );
}

'use client';

import { Suspense, useCallback, useEffect, useState } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { ArrowLeft, ArrowRight, Circle, Loader2 } from 'lucide-react';

import { DashboardError } from '@/app/dashboard/_components/DashboardPrimitives';
import { Button } from '@/components/ui/button';
import {
  defaultLearnerId,
  fetchChapterDashboard,
  fetchConceptMasteryDetails,
  type ChapterSection,
  type ChapterSectionStatus,
  type ConceptMasteryDetails,
  type MasterySignal,
} from '@/app/pal/data/pal-eso';
import { useViewAsStudent } from '@/app/pal/data/pal-view-as';

/**
 * "Mastery details" — a dedicated page rather than the modal it used to be,
 * so it has its own URL and a proper Back button. Same data, same
 * EsoPolicyService::conceptMasteryDetails() / chapterDashboard() calls the
 * modal used, just laid out as a full screen instead of an overlay.
 */
export default function MasteryDetailsPage() {
  return (
    <Suspense fallback={<CenteredSpinner label="Loading..." />}>
      <MasteryDetailsPageContent />
    </Suspense>
  );
}

function CenteredSpinner({ label }: { label: string }) {
  return (
    <div className="flex min-h-[50vh] items-center justify-center text-sm text-slate-500">
      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
      {label}
    </div>
  );
}

function Alert({ children }: { children: React.ReactNode }) {
  return <div className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{children}</div>;
}

function MasteryDetailsPageContent() {
  const params = useParams();
  const searchParams = useSearchParams();
  const router = useRouter();
  const viewAsStudent = useViewAsStudent();

  const routeConceptId = Number((params?.conceptId as string) || '0');
  // Same convention as the knowledge-map and chapter-dashboard pages: the
  // real entry point never puts learnerId in the URL for a student — it
  // resolves to defaultLearnerId(), the authenticated session's own id.
  // `?learnerId=` only matters for a staff "view as student" session; the
  // backend independently derives and enforces the learner from the
  // caller's own JWT regardless of what this resolves to.
  const learnerId = searchParams.get('learnerId') || viewAsStudent?.studentId || defaultLearnerId();
  // Optional — when the caller already knows the chapter (every real entry
  // point does), this lets the concept-details and chapter-sections calls
  // run in parallel instead of waiting on each other. Falls back to a
  // sequential fetch (details first, to learn its chapterId) when absent,
  // e.g. someone opens this URL directly without the query param.
  const chapterIdParam = searchParams.get('chapterId');

  const [selectedConceptId, setSelectedConceptId] = useState<number>(routeConceptId);
  // Keep in sync with the route param (e.g. browser back/forward) without an
  // effect — the React-recommended "adjust state during render" pattern.
  const [syncedRouteConceptId, setSyncedRouteConceptId] = useState(routeConceptId);
  if (routeConceptId !== syncedRouteConceptId) {
    setSyncedRouteConceptId(routeConceptId);
    setSelectedConceptId(routeConceptId);
  }
  const [details, setDetails] = useState<ConceptMasteryDetails | null>(null);
  const [sections, setSections] = useState<ChapterSection[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(
    (signal?: AbortSignal) => {
      if (!selectedConceptId || !learnerId) {
        setLoading(false);
        return;
      }
      setLoading(true);
      setError(null);

      const run = async () => {
        if (chapterIdParam) {
          const [d, dashboard] = await Promise.all([
            fetchConceptMasteryDetails(learnerId, selectedConceptId, signal),
            fetchChapterDashboard(learnerId, Number(chapterIdParam), signal),
          ]);
          setDetails(d);
          setSections(dashboard.chapterSections);
        } else {
          const d = await fetchConceptMasteryDetails(learnerId, selectedConceptId, signal);
          setDetails(d);
          const dashboard = await fetchChapterDashboard(learnerId, d.chapterId, signal);
          setSections(dashboard.chapterSections);
        }
      };

      run()
        .catch((reason: unknown) => {
          if (signal?.aborted) return;
          setError(reason instanceof Error ? reason.message : 'Unable to load mastery details.');
        })
        .finally(() => {
          if (!signal?.aborted) setLoading(false);
        });
    },
    [learnerId, selectedConceptId, chapterIdParam]
  );

  useEffect(() => {
    const controller = new AbortController();
    // Deferred to a microtask so setLoading/setError inside load() don't
    // fire synchronously within the effect body — same convention used
    // throughout app/pal/eso/*.
    queueMicrotask(() => load(controller.signal));
    return () => controller.abort();
  }, [load]);

  if (!routeConceptId) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-10">
        <Alert>A concept must be selected to open mastery details (missing conceptId in the URL).</Alert>
      </div>
    );
  }

  const onSelectConcept = (id: number) => {
    setSelectedConceptId(id);
    const query = new URLSearchParams();
    if (learnerId) query.set('learnerId', learnerId);
    if (details) query.set('chapterId', String(details.chapterId));
    const qs = query.toString();
    router.replace(`/pal/eso/mastery/${id}${qs ? `?${qs}` : ''}`);
  };

  // The one and only place a student may start or continue a concept — the
  // existing adaptive-learning entry point, unchanged.
  const onOpenConcept = (id: number) => router.push(`/pal/eso?conceptId=${id}${learnerId ? `&learnerId=${learnerId}` : ''}`);

  return (
    <div className="mx-auto px-4 py-6 sm:px-6">
      <button type="button" onClick={() => router.back()} className="mb-3 flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-700">
        <ArrowLeft className="h-3.5 w-3.5" />
        Back
      </button>

      <p className="text-xs font-semibold uppercase tracking-widest text-slate-400">Mastery details</p>
      <h1 className="mt-1 text-2xl font-bold text-slate-900">{details ? details.conceptName : 'Loading…'}</h1>

      {sections.length > 1 && (
        <div className="mt-4 flex flex-wrap gap-1.5">
          {sections.map((section) => {
            const clickable = section.status !== 'locked';
            const selected = section.conceptId === selectedConceptId;
            return (
              <button
                key={section.conceptId}
                type="button"
                disabled={!clickable}
                onClick={() => clickable && onSelectConcept(section.conceptId)}
                className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
                  selected
                    ? 'border-indigo-600 bg-indigo-600 text-white'
                    : clickable
                      ? 'border-slate-200 bg-white text-slate-600 hover:border-indigo-200 hover:bg-indigo-50'
                      : 'cursor-not-allowed border-slate-100 bg-slate-50 text-slate-300'
                }`}
              >
                {section.name}
              </button>
            );
          })}
        </div>
      )}

      <div className="mt-6">
        {loading && <CenteredSpinner label="Loading mastery details..." />}
        {!loading && error && <DashboardError message={error} onRetry={() => load()} />}
        {!loading && !error && details && (
          <MasteryDetailsContent
            details={details}
            onDoNext={() => onOpenConcept(details.conceptId)}
            knowledgeMapHref={`/pal/eso/knowledge-map/${details.conceptId}?learnerId=${learnerId}`}
          />
        )}
      </div>
    </div>
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

function MasteryDetailsContent({
  details,
  onDoNext,
  knowledgeMapHref,
}: {
  details: ConceptMasteryDetails;
  onDoNext: () => void;
  knowledgeMapHref: string;
}) {
  const missingSignals = details.masterySignals.filter((s) => !s.hasEvidence);

  return (
    <div className="space-y-6">
      <div>
        <div className="flex items-center gap-2">
          <h4 className="text-xl font-bold text-slate-900">{SECTION_STATUS_LABEL[details.status]}</h4>
          <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${SECTION_STATUS_STYLE[details.status]}`}>
            {SECTION_STATUS_LABEL[details.status]}
          </span>
        </div>
        <p className="mt-1 text-sm text-slate-600">{details.confidenceNote}</p>
        <p className="mt-2 flex items-start gap-1.5 text-xs text-indigo-700">
          <span className="mt-0.5 shrink-0">&#8505;</span>
          Each response nudges this estimate up or down a little — right answers raise it, wrong answers lower it.
        </p>
      </div>

      <div>
        <h5 className="text-sm font-semibold text-slate-900">How PAL checks mastery</h5>
        <p className="text-xs text-slate-500">PAL looks at 6 things separately, because they can move apart.</p>
        <div className="mt-3 space-y-3">
          {details.masterySignals.map((signal: MasterySignal) => {
            const percent = signal.hasEvidence ? Math.round((signal.value ?? 0) * 100) : 0;
            return (
              <div key={signal.key}>
                <div className="flex items-center justify-between gap-2 text-sm">
                  <span className="font-medium text-slate-800">{signal.label}</span>
                  <span className="shrink-0 text-xs text-slate-400">
                    {signal.hasEvidence ? `${percent}%` : `Not enough evidence · ${signal.responseCount} response${signal.responseCount === 1 ? '' : 's'}`}
                  </span>
                </div>
                <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-slate-100">
                  <div className="h-full rounded-full bg-indigo-500" style={{ width: `${percent}%` }} />
                </div>
                <p className="mt-1 text-xs text-slate-500">{signal.description}</p>
              </div>
            );
          })}
        </div>
      </div>

      <div>
        <h5 className="text-sm font-semibold text-slate-900">Working with and without support</h5>
        <p className="text-xs text-slate-500">
          {details.supportWithHint.count === 0 && details.supportIndependent.count === 0
            ? 'Nothing recorded yet.'
            : 'Mastery needs work without support, so this is tracked separately from whether the answers were right.'}
        </p>
        <div className="mt-2 grid grid-cols-2 gap-3">
          <SupportBox title="With a hint or a frame" bucket={details.supportWithHint} />
          <SupportBox title="On your own" bucket={details.supportIndependent} />
        </div>
      </div>

      <div>
        <h5 className="text-sm font-semibold text-slate-900">What this concept rests on</h5>
        {details.misconceptions.length === 0 ? (
          <p className="mt-1 text-xs text-slate-500">No mix-ups recorded yet.</p>
        ) : (
          <div className="mt-2 space-y-2">
            {details.misconceptions.map((m, index) => (
              <div key={index} className="rounded-lg border border-slate-200 px-3 py-2 text-xs">
                <span className="text-slate-700">{m.description}</span>
                <span className={`ml-2 font-medium ${m.corrected ? 'text-emerald-600' : 'text-amber-600'}`}>
                  {m.corrected ? 'Corrected' : 'Still active'}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      <div>
        <h5 className="text-sm font-semibold text-slate-900">Still missing for mastery</h5>
        {missingSignals.length === 0 ? (
          <p className="mt-1 text-xs text-emerald-600">Nothing missing — every signal has enough evidence.</p>
        ) : (
          <ul className="mt-2 space-y-1.5">
            {missingSignals.map((s) => (
              <li key={s.key} className="flex items-start gap-2 text-xs">
                <Circle className="mt-0.5 h-3 w-3 shrink-0 text-slate-300" />
                <span>
                  <span className="font-medium text-slate-700">{s.label}</span>
                  <span className="text-slate-400"> — not enough responses of this kind yet</span>
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div>
        <h5 className="text-sm font-semibold text-slate-900">Recent responses on this concept</h5>
        {details.recentResponses.length === 0 ? (
          <p className="mt-1 text-xs text-slate-500">No questions answered on this concept yet. Anything you do here will show up in this list.</p>
        ) : (
          <div className="mt-2 divide-y divide-slate-100 rounded-lg border border-slate-200">
            {details.recentResponses.map((r, index) => (
              <div key={index} className="flex items-center justify-between gap-3 px-3 py-2 text-xs">
                <span className="min-w-0 flex-1 truncate text-slate-700">{r.question}</span>
                <span className={`shrink-0 font-medium ${r.correct ? 'text-emerald-600' : 'text-rose-600'}`}>{r.correct ? 'Correct' : 'Incorrect'}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Button onClick={onDoNext} className="bg-indigo-600 text-white hover:bg-indigo-700">
          What should I do next?
          <ArrowRight className="h-3.5 w-3.5" />
        </Button>
        <a
          href={knowledgeMapHref}
          className="inline-flex items-center gap-1.5 rounded-lg border border-indigo-200 px-2.5 py-1.5 text-sm font-medium text-indigo-700 transition-colors hover:bg-indigo-50"
        >
          See the knowledge map
        </a>
      </div>
    </div>
  );
}

function SupportBox({ title, bucket }: { title: string; bucket: { count: number; correct: number } }) {
  return (
    <div className="rounded-lg border border-slate-200 px-3 py-2.5">
      <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">{title}</div>
      {bucket.count === 0 ? (
        <>
          <div className="mt-1 font-mono text-sm text-slate-400">None yet</div>
          <div className="text-xs text-slate-400">Nothing on record</div>
        </>
      ) : (
        <>
          <div className="mt-1 text-sm font-semibold text-slate-900">
            {bucket.correct}/{bucket.count} correct
          </div>
          <div className="text-xs text-slate-500">
            {bucket.count} response{bucket.count === 1 ? '' : 's'}
          </div>
        </>
      )}
    </div>
  );
}

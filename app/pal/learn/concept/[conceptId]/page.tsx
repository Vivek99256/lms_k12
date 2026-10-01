'use client';

import { Suspense, useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import {
  AlertTriangle,
  ArrowRight,
  BookOpen,
  ExternalLink,
  FileText,
  Loader2,
  MonitorPlay,
  Play,
  Presentation,
  Puzzle,
  School,
} from 'lucide-react';

import { Button, buttonVariants } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  acknowledgeConceptLearn,
  fetchConceptLearn,
  type ConceptLearn,
  type LearnResourceItem,
  type LearnResourceSection,
} from '@/app/pal/data/pal-diagnostic';
import {
  CompletedBadge,
  CompletedConceptPanel,
  ReadOnlyBadge,
  useConceptCompletion,
} from '@/app/pal/_components/CompletionState';
import { COMPLETED_THROUGH_CHECK, JourneyRail, stagesBefore } from '@/app/pal/_components/JourneyRail';
import { PalRailSection, PalRailStat, PalWorkspace } from '@/app/pal/_components/PalWorkspace';

/**
 * Stage 6 - Learn.
 *
 * ---------------------------------------------------------------------------
 * WHY THIS PAGE EXISTS
 * ---------------------------------------------------------------------------
 * "Learn it" used to link at /pal/eso?conceptId=N, which asks the engine what
 * to do next and renders whatever comes back. The engine legitimately answers
 * "practice" for a concept it considers already taught, so the button could not
 * keep its promise - it routinely opened a quiz.
 *
 * This reads the material directly from a read-only endpoint that stamps
 * nothing and moves nobody, so the lesson always opens. The engine is still the
 * only thing that can advance the learner: the CTA at the bottom hands them
 * back to it.
 *
 * ---------------------------------------------------------------------------
 * EXCEPT ON A COMPLETED CONCEPT
 * ---------------------------------------------------------------------------
 * A concept cleared to hard and signed off shows its mastery instead of its
 * lesson. The bottom CTA writes (`acknowledgeConceptLearn` stamps taught_at and
 * hands the learner to the engine), so a completed concept must not reach a
 * screen that carries it. Completion is therefore resolved before the lesson is
 * requested - see app/pal/data/pal-completion.ts for the rule.
 */

export default function ConceptLearnPage() {
  return (
    <Suspense fallback={<Centered>Loading the lesson…</Centered>}>
      <ConceptLearnView />
    </Suspense>
  );
}

function Centered({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-[50vh] items-center justify-center text-sm text-slate-500">
      <Loader2 aria-hidden className="mr-2 h-4 w-4 animate-spin" />
      {children}
    </div>
  );
}

function ConceptLearnView() {
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  const conceptId = String(params?.conceptId ?? '');
  const chapterHint = searchParams.get('chapterId');

  const [data, setData] = useState<ConceptLearn | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [continuing, setContinuing] = useState(false);
  const [continueError, setContinueError] = useState<string | null>(null);

  const {
    result: completedResult,
    completed,
    loading: checkingCompletion,
  } = useConceptCompletion(conceptId);

  const load = useCallback(() => {
    const controller = new AbortController();
    queueMicrotask(() => {
      setLoading(true);
      setError(null);
      fetchConceptLearn(conceptId, controller.signal)
        .then(setData)
        .catch((reason: unknown) => {
          if (controller.signal.aborted) return;
          setError(reason instanceof Error ? reason.message : 'The lesson couldn’t be loaded.');
        })
        .finally(() => {
          if (!controller.signal.aborted) setLoading(false);
        });
    });

    return () => controller.abort();
  }, [conceptId]);

  useEffect(() => {
    if (checkingCompletion || completed) return;
    return load();
  }, [load, checkingCompletion, completed]);

  /**
   * Record that the lesson was read, then let the engine decide the screen.
   *
   * Deliberately does NOT navigate straight to practice. Once taught_at is
   * stamped the engine answers `practice` by itself, and going through it keeps
   * D0's diagnostic diversion and D2's prerequisite gate intact - a hardcoded
   * jump would have silently overridden both.
   *
   * A concept with no guided-learning node has nothing for the engine to move,
   * and so no practice, check or mastery to go on to - that one returns to the
   * plan rather than re-opening the concept diagnostic as if it were practice.
   */
  const continueToNextStep = useCallback(async () => {
    setContinuing(true);
    setContinueError(null);

    try {
      const outcome = await acknowledgeConceptLearn(conceptId);

      const planChapterId = data?.chapterId || chapterHint;
      router.push(
        outcome.reason === 'no_eso_nodes'
          ? planChapterId
            ? `/pal/plan/chapter/${planChapterId}`
            : '/pal'
          : `/pal/eso?conceptId=${conceptId}`,
      );
    } catch (reason: unknown) {
      // Left on the page with the reason, rather than pushed into a screen that
      // would show the lesson again because the acknowledgement never landed.
      setContinueError(
        reason instanceof Error ? reason.message : 'That couldn’t be recorded. Try again.',
      );
      setContinuing(false);
    }
  }, [conceptId, router, data, chapterHint]);

  if (checkingCompletion) return <Centered>Loading this concept…</Centered>;

  // Read-only: mastery in place of the lesson, and no CTA that would stamp
  // taught_at or hand the learner back to the engine.
  if (completed && completedResult) {
    const masteryChapterId = completedResult.chapterId || chapterHint || '';

    return (
      <PalWorkspace
        eyebrow="Concept mastery"
        title={completedResult.conceptName || 'Concept'}
        description="This concept is completed. Everything below is a record of how you got there."
        backHref={masteryChapterId ? `/pal/plan/chapter/${masteryChapterId}` : '/pal'}
        backLabel={masteryChapterId ? 'Back to my plan' : 'Back to subjects'}
        actions={
          <>
            <CompletedBadge />
            <ReadOnlyBadge />
          </>
        }
        rail={
          <PalRailSection title="Your journey">
            <JourneyRail
              current="mastery"
              completed={COMPLETED_THROUGH_CHECK}
              bypassed={['intervention']}
              orientation="vertical"
              chapterId={masteryChapterId}
              conceptId={conceptId}
              conceptName={completedResult.conceptName}
            />
          </PalRailSection>
        }
      >
        <CompletedConceptPanel result={completedResult} />
      </PalWorkspace>
    );
  }

  if (loading) return <Centered>Loading the lesson…</Centered>;

  if (error || !data) {
    return (
      <div className="mx-auto w-full space-y-5 p-4 sm:p-6">
        <Card className="border-rose-200 bg-rose-50">
          <CardContent className="flex flex-wrap items-center justify-between gap-3 pt-5">
            <p className="text-sm text-rose-800">{error ?? 'The lesson couldn’t be loaded.'}</p>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={load}>
                Try again
              </Button>
              <Link href="/pal" className={buttonVariants({ size: 'sm' })}>
                Back to subjects
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  const chapterId = data.chapterId || Number(chapterHint) || 0;
  const backHref = chapterId ? `/pal/plan/chapter/${chapterId}` : '/pal';
  // There may be no guided LESSON while there is still plenty to read. Saying
  // "nothing has been prepared" above a list of nine resources is worse than
  // saying nothing at all.
  const hasResources = data.resources.sections.length > 0;

  // What the learner has available, summarised beside the lesson rather than
  // only discoverable by scrolling the list.
  const rail = (
    <>
      <PalRailSection title="Your journey">
        <JourneyRail
          current="learn"
          completed={stagesBefore('learn')}
          orientation="vertical"
          chapterId={chapterId}
          conceptId={conceptId}
          conceptName={data.conceptName}
        />
      </PalRailSection>

      {hasResources && (
        <PalRailSection title="Material">
          {data.resources.sections.map((section) => (
            <PalRailStat key={section.key} label={section.label} value={section.count} />
          ))}
          {data.resources.totals.conceptScoped > 0 && (
            <p className="mt-2 text-xs text-slate-500">
              {data.resources.totals.conceptScoped} matched to this concept; the rest cover the
              whole chapter.
            </p>
          )}
        </PalRailSection>
      )}

      {chapterId > 0 && (
        <PalRailSection title="Go to">
          <div className="space-y-2">
            <Link
              href={`/pal/mastery/chapter/${chapterId}`}
              className={cn(
                buttonVariants({ variant: 'outline', size: 'sm' }),
                'w-full justify-start',
              )}
            >
              My mastery
            </Link>
          </div>
        </PalRailSection>
      )}
    </>
  );

  return (
    <PalWorkspace
      eyebrow="Learn"
      title={data.conceptName || 'Learn'}
      description={
        data.attempt > 0
          ? 'A different explanation of the same idea — the last one did not quite land.'
          : 'Work through this, then practise it.'
      }
      backHref={backHref}
      backLabel={chapterId ? 'Back to my plan' : 'Back to subjects'}
      rail={rail}
    >
      {/* What tripped this learner up here specifically — routed by
          MisconceptionLibraryService off a wrong diagnostic or practice
          answer (see palController::learnContent()'s own note). Leads the
          page: this is the most targeted material there is, ahead of the
          chapter-wide resources below. */}
      {data.misconceptions.length > 0 && (
        <div className="mb-5 space-y-3">
          {data.misconceptions.map((item) => (
            <Card key={item.misconceptionTag} className="border-amber-200 bg-amber-50">
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-2 text-base text-amber-900">
                  <AlertTriangle aria-hidden className="h-4 w-4 shrink-0" />
                  {item.title}
                </CardTitle>
                <CardDescription className="text-amber-800">
                  What tripped you up on this concept
                </CardDescription>
              </CardHeader>
              {item.body && (
                <CardContent className="text-sm text-amber-900">{item.body}</CardContent>
              )}
            </Card>
          ))}
        </div>
      )}

      {!hasResources && (
        // Only when there is nothing at all. Ordinary on this estate - most
        // concepts have no material authored - so it is said plainly rather
        // than dressed up as an error, and nothing is invented to fill it.
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <BookOpen aria-hidden className="h-4 w-4 text-slate-500" />
              Nothing prepared for this one yet
            </CardTitle>
            <CardDescription>
              No material has been written for this concept. Continue below to go straight to
              practice — each answer tells you where you stand.
            </CardDescription>
          </CardHeader>
        </Card>
      )}

      {data.resources.sections.length > 0 && (
        <div className="space-y-5">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h2 className="text-base font-semibold text-slate-900">Everything for this topic</h2>
            <p className="text-xs text-slate-500">
              {data.resources.totals.items}{' '}
              {data.resources.totals.items === 1 ? 'resource' : 'resources'}
              {data.resources.totals.conceptScoped > 0 &&
                ` · ${data.resources.totals.conceptScoped} matched to this concept`}
            </p>
          </div>

          {data.resources.sections.map((section) => (
            <ResourceSection key={section.key} section={section} />
          ))}
        </div>
      )}

      {/* Always shown. It used to be gated on there being a lesson card above
          it, which is gone - and "I have read this" is what records the lesson
          as read and moves the learner to practice, so it must not disappear
          just because a concept has nothing authored. */}
      <div className="mt-6 border-t border-slate-200 pt-5">
        {continueError && (
          <div className="mb-3">
            <p className="text-sm text-rose-700">{continueError}</p>
          </div>
        )}

        <div className="flex flex-wrap items-center justify-end gap-3">
          {/* Records that the lesson was read, THEN hands over to the engine.
                Without the first step taught_at stays null, the engine serves
                `teach` again, and the learner gets a second lesson screen
                showing one video they have just worked through. */}
          <Button onClick={() => void continueToNextStep()} disabled={continuing}>
            {continuing && <Loader2 aria-hidden className="mr-1.5 h-4 w-4 animate-spin" />}I have
            read this — continue
            {!continuing && <ArrowRight aria-hidden className="ml-1.5 h-4 w-4" />}
          </Button>
        </div>
      </div>
    </PalWorkspace>
  );
}

/**
 * How each kind of material reads: its icon, the colour that ties its cards
 * together, and the wash a card falls back to when it has no thumbnail.
 * Keyed by `LearnResourceItem['section']` / `LearnResourceSection['key']`.
 */
interface SectionStyle {
  icon: typeof FileText;
  gradient: string;
  accent: string;
  border: string;
  chip: string;
}

const SECTION_STYLE: Record<string, SectionStyle> = {
  video: {
    icon: MonitorPlay,
    gradient: 'from-indigo-500 to-indigo-700',
    accent: 'text-indigo-600',
    border: 'hover:border-indigo-300',
    chip: 'bg-indigo-600',
  },
  presentation: {
    icon: Presentation,
    gradient: 'from-amber-500 to-amber-600',
    accent: 'text-amber-600',
    border: 'hover:border-amber-300',
    chip: 'bg-amber-600',
  },
  notes: {
    icon: FileText,
    gradient: 'from-sky-500 to-sky-700',
    accent: 'text-sky-600',
    border: 'hover:border-sky-300',
    chip: 'bg-sky-600',
  },
  classroom: {
    icon: School,
    gradient: 'from-violet-500 to-violet-700',
    accent: 'text-violet-600',
    border: 'hover:border-violet-300',
    chip: 'bg-violet-600',
  },
  h5p: {
    icon: Puzzle,
    gradient: 'from-fuchsia-500 to-fuchsia-700',
    accent: 'text-fuchsia-600',
    border: 'hover:border-fuchsia-300',
    chip: 'bg-fuchsia-600',
  },
  other: {
    icon: BookOpen,
    gradient: 'from-slate-400 to-slate-600',
    accent: 'text-slate-600',
    border: 'hover:border-slate-300',
    chip: 'bg-slate-600',
  },
};

function sectionStyle(key: string): SectionStyle {
  return SECTION_STYLE[key] ?? SECTION_STYLE.other;
}

const FILE_TYPE_LABEL: Record<string, string> = {
  pdf: 'PDF',
  pptx: 'Slides',
  ppt: 'Slides',
  docx: 'Document',
  doc: 'Document',
  mp4: 'Video',
  mp3: 'Audio',
  link: 'Web link',
  video: 'Video',
  h5p: 'Interactive',
  jpg: 'Image',
};

function formatDuration(seconds: number): string {
  const minutes = Math.round(seconds / 60);

  return minutes < 1 ? 'Under a minute' : `${minutes} min`;
}

/**
 * One kind of resource.
 *
 * The scope badge is not decoration. Only videos are tagged to a concept; the
 * rest is reachable by chapter only, so the same items appear under every
 * concept in that chapter. Saying "for the whole chapter" is the difference
 * between a useful list and a misleading one.
 */
function ResourceSection({ section }: { section: LearnResourceSection }) {
  const { icon: Icon, accent } = sectionStyle(section.key);

  return (
    <section>
      <div className="mb-2.5 flex flex-wrap items-center gap-2">
        <span className={cn('inline-flex h-6 w-6 items-center justify-center rounded-full bg-slate-100', accent)}>
          <Icon aria-hidden className="h-3.5 w-3.5" />
        </span>
        <h3 className="text-sm font-semibold text-slate-900">{section.label}</h3>
        <span className="text-xs text-slate-500">{section.count}</span>
        {section.scope === 'chapter' && (
          <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-600">
            For the whole chapter
          </span>
        )}
        {section.scope === 'concept' && (
          <span className="rounded-full bg-indigo-50 px-2 py-0.5 text-[11px] font-medium text-indigo-700">
            Matched to this concept
          </span>
        )}
      </div>

      {/* A grid rather than a list. The workspace gave the main column real
          width, and a card carries what a row could not: the still, the
          description, and the tagging - all of which were being fetched and
          then thrown away by a single truncated line. */}
      <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {section.items.map((item) => (
          <li key={item.id} className="flex">
            <ResourceCard item={item} sectionKey={section.key} />
          </li>
        ))}
      </ul>
    </section>
  );
}

function ResourceCard({ item, sectionKey }: { item: LearnResourceItem; sectionKey: string }) {
  const { icon: Icon, gradient, border, chip } = sectionStyle(sectionKey);
  const typeLabel = item.fileType
    ? (FILE_TYPE_LABEL[item.fileType] ?? item.fileType.toUpperCase())
    : null;

  const difficulty =
    item.tags.difficulty === 'advance'
      ? 'Advanced'
      : item.tags.difficulty === 'basic'
        ? 'Foundational'
        : null;

  // Duration rides on the thumbnail, the way a video site would show it, when
  // there is a thumbnail to sit on; with no image to overlay it falls back
  // into the meta line below instead of disappearing.
  const durationOnThumbnail = Boolean(item.thumbnailUrl && item.durationSeconds);
  const meta = [
    !durationOnThumbnail && item.durationSeconds ? formatDuration(item.durationSeconds) : null,
    item.provider,
    item.h5pType ? item.h5pType.replace(/_/g, ' ') : null,
  ].filter(Boolean) as string[];

  const inner = (
    <>
      <div className="relative aspect-video w-full shrink-0 overflow-hidden bg-slate-100">
        {item.thumbnailUrl ? (
          // 105 of 109 approved videos carry a still. Decorative alt: the
          // title sits directly beneath, so announcing it twice helps nobody.
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={item.thumbnailUrl}
            alt=""
            loading="lazy"
            className="h-full w-full object-cover transition-transform duration-500 ease-out group-hover:scale-[1.04]"
          />
        ) : (
          // A coloured wash, not a placeholder image: inventing a picture for
          // a PDF would be ornament, and the icon already says what kind of
          // thing this is.
          <div className={cn('flex h-full w-full items-center justify-center bg-gradient-to-br', gradient)}>
            <Icon aria-hidden className="h-9 w-9 text-white/85" />
          </div>
        )}

        {typeLabel && (
          <span className="absolute left-2.5 top-2.5 inline-flex items-center gap-1 rounded-full bg-black/55 px-2 py-0.5 text-[10px] font-semibold text-white backdrop-blur-sm">
            <Icon aria-hidden className="h-3 w-3" />
            {typeLabel}
          </span>
        )}

        {durationOnThumbnail && (
          <span className="absolute bottom-2 right-2 rounded bg-black/70 px-1.5 py-0.5 text-[10px] font-semibold tabular-nums text-white">
            {formatDuration(item.durationSeconds as number)}
          </span>
        )}

        {item.url && sectionKey === 'video' && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/0 transition-colors duration-300 group-hover:bg-black/25">
            <span className="flex h-10 w-10 scale-90 items-center justify-center rounded-full bg-white/95 text-slate-900 opacity-0 shadow-md transition-all duration-300 group-hover:scale-100 group-hover:opacity-100">
              <Play aria-hidden className="ml-0.5 h-4 w-4 fill-current" />
            </span>
          </div>
        )}
      </div>

      <div className="flex flex-1 flex-col p-4">
        <div className="mb-1.5 flex items-center justify-between gap-2">
          <span className="truncate text-[11px] font-semibold uppercase tracking-wide text-slate-500">
            {item.category}
          </span>
          {difficulty && (
            <span
              className={cn(
                'shrink-0 rounded-full px-1.5 py-0.5 text-[10px] font-semibold',
                difficulty === 'Advanced' ? 'bg-amber-50 text-amber-700' : 'bg-emerald-50 text-emerald-700',
              )}
            >
              {difficulty}
            </span>
          )}
        </div>

        <p className="line-clamp-2 text-sm font-semibold leading-snug text-slate-900">{item.title}</p>

        {item.description && (
          <p className="mt-1 line-clamp-2 text-xs text-slate-500">{item.description}</p>
        )}

        {meta.length > 0 && (
          <p className="mt-1.5 text-[11px] text-slate-500">{meta.join(' · ')}</p>
        )}

        {item.tags.metaTags && item.tags.metaTags.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-1">
            {item.tags.metaTags.slice(0, 3).map((tag) => (
              <span key={tag} className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] text-slate-600">
                {tag}
              </span>
            ))}
          </div>
        )}

        {item.attribution && (
          <p className="mt-1.5 truncate text-[11px] text-slate-400">{item.attribution}</p>
        )}

        {/* mt-auto pins the footer to the bottom so cards in a row line up
            however much description each one happens to have. */}
        <div className="mt-auto flex items-center justify-between gap-2 pt-3.5">
          <span className="inline-flex items-center gap-1.5 text-[11px] font-medium text-slate-500">
            <span
              aria-hidden
              className={cn('h-1.5 w-1.5 rounded-full', item.scope === 'concept' ? 'bg-indigo-500' : 'bg-slate-300')}
            />
            {item.scope === 'concept' ? 'This concept' : 'Whole chapter'}
          </span>

          {item.url ? (
            <span
              className={cn(
                'inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-semibold text-white',
                chip,
              )}
            >
              Open
              <ExternalLink aria-hidden className="h-3 w-3" />
            </span>
          ) : (
            <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-medium text-slate-400">
              Not available yet
            </span>
          )}
        </div>
      </div>
    </>
  );

  const shell = cn(
    'group flex h-full w-full flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white text-left shadow-sm transition-all duration-300',
    item.url && ['hover:-translate-y-0.5 hover:shadow-lg', border],
  );

  // No url means H5P, which has nothing to open yet. Rendered as a plain card
  // rather than a dead link - a control that goes nowhere is worse than none.
  if (!item.url) {
    return <div className={shell}>{inner}</div>;
  }

  return (
    <Link
      href={item.url}
      target="_blank"
      rel="noreferrer"
      className={cn(
        shell,
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2',
        'motion-reduce:transition-none',
      )}
    >
      {inner}
    </Link>
  );
}

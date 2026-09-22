'use client';

import { Suspense, useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import {
  ArrowRight,
  BookOpen,
  ExternalLink,
  FileText,
  Loader2,
  MonitorPlay,
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
import { JourneyRail } from '@/app/pal/_components/JourneyRail';
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

  const load = useCallback(() => {
    const controller = new AbortController();
    queueMicrotask(() => {
      setLoading(true);
      setError(null);
      fetchConceptLearn(conceptId, controller.signal)
        .then(setData)
        .catch((reason: unknown) => {
          if (controller.signal.aborted) return;
          setError(reason instanceof Error ? reason.message : 'The lesson could not be loaded.');
        })
        .finally(() => {
          if (!controller.signal.aborted) setLoading(false);
        });
    });

    return () => controller.abort();
  }, [conceptId]);

  useEffect(() => load(), [load]);

  /**
   * Record that the lesson was read, then let the engine decide the screen.
   *
   * Deliberately does NOT navigate straight to practice. Once taught_at is
   * stamped the engine answers `practice` by itself, and going through it keeps
   * D0's diagnostic diversion and D2's prerequisite gate intact - a hardcoded
   * jump would have silently overridden both.
   *
   * A concept with no guided-learning node has nothing for the engine to move,
   * so that one goes to the question set instead of an engine that has no
   * opinion about it.
   */
  const continueToNextStep = useCallback(async () => {
    setContinuing(true);
    setContinueError(null);

    try {
      const outcome = await acknowledgeConceptLearn(conceptId);

      router.push(
        outcome.reason === 'no_eso_nodes'
          ? `/pal/adaptive/concept/${conceptId}`
          : `/pal/eso?conceptId=${conceptId}`,
      );
    } catch (reason: unknown) {
      // Left on the page with the reason, rather than pushed into a screen that
      // would show the lesson again because the acknowledgement never landed.
      setContinueError(
        reason instanceof Error ? reason.message : 'That could not be recorded. Try again.',
      );
      setContinuing(false);
    }
  }, [conceptId, router]);

  if (loading) return <Centered>Loading the lesson…</Centered>;

  if (error || !data) {
    return (
      <div className="mx-auto w-full space-y-5 p-4 sm:p-6">
        <Card className="border-rose-200 bg-rose-50">
          <CardContent className="flex flex-wrap items-center justify-between gap-3 pt-5">
            <p className="text-sm text-rose-800">{error ?? 'The lesson could not be loaded.'}</p>
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
          completed={['diagnostic', 'adaptive', 'plan']}
          orientation="vertical"
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

      <PalRailSection title="Go to">
        <div className="space-y-2">
          <Link
            href={`/pal/adaptive/concept/${conceptId}`}
            className={cn(
              buttonVariants({ variant: 'outline', size: 'sm' }),
              'w-full justify-start',
            )}
          >
            Extra practice questions
          </Link>
          {chapterId > 0 && (
            <Link
              href={`/pal/mastery/chapter/${chapterId}`}
              className={cn(
                buttonVariants({ variant: 'outline', size: 'sm' }),
                'w-full justify-start',
              )}
            >
              My mastery
            </Link>
          )}
        </div>
      </PalRailSection>
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
              No material has been written for this concept. Practising the questions is the best
              way in — each answer tells you where you stand.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Link href={`/pal/adaptive/concept/${conceptId}`} className={buttonVariants()}>
              Practise this concept
              <ArrowRight aria-hidden className="ml-1.5 h-4 w-4" />
            </Link>
          </CardContent>
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

        <div className="flex flex-wrap items-center justify-between gap-3">
          <Link
            href={`/pal/adaptive/concept/${conceptId}`}
            className={buttonVariants({ variant: 'outline' })}
          >
            Extra practice questions
          </Link>

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

const SECTION_ICON: Record<string, typeof FileText> = {
  video: MonitorPlay,
  presentation: Presentation,
  notes: FileText,
  classroom: School,
  h5p: Puzzle,
  other: BookOpen,
};

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
  const Icon = SECTION_ICON[section.key] ?? BookOpen;

  return (
    <section>
      <div className="mb-2.5 flex flex-wrap items-center gap-2">
        <Icon aria-hidden className="h-4 w-4 text-slate-500" />
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
          width, and a card carries what a row could not: the video still, the
          description, and the tagging - all of which were being fetched and
          then thrown away by a single truncated line. */}
      <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
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
  const Icon = SECTION_ICON[sectionKey] ?? BookOpen;
  const typeLabel = item.fileType
    ? (FILE_TYPE_LABEL[item.fileType] ?? item.fileType.toUpperCase())
    : null;

  const meta = [
    item.tags.difficulty === 'advance'
      ? 'Advanced'
      : item.tags.difficulty === 'basic'
        ? 'Foundational'
        : null,
    item.durationSeconds ? formatDuration(item.durationSeconds) : null,
    item.provider,
    item.h5pType ? item.h5pType.replace(/_/g, ' ') : null,
  ].filter(Boolean) as string[];

  const inner = (
    <>
      {item.thumbnailUrl ? (
        // 105 of 109 approved videos carry a still. Decorative alt: the title
        // sits directly beneath, so announcing it twice helps nobody.
        <div className="aspect-video w-full overflow-hidden rounded-t-lg border-b border-slate-200 bg-slate-100">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={item.thumbnailUrl}
            alt=""
            loading="lazy"
            className="h-full w-full object-cover"
          />
        </div>
      ) : (
        // A flat band, not a placeholder image: inventing a picture for a PDF
        // would be ornament, and the icon already says what kind of thing it is.
        <div className="flex h-16 w-full items-center justify-center rounded-t-lg border-b border-slate-200 bg-slate-50">
          <Icon aria-hidden className="h-5 w-5 text-slate-400" />
        </div>
      )}

      <div className="flex flex-1 flex-col p-3.5">
        <div className="mb-1.5 flex items-center gap-1.5">
          <span className="truncate text-[11px] font-medium uppercase tracking-wide text-slate-500">
            {item.category}
          </span>
          {typeLabel && (
            <span className="ml-auto shrink-0 rounded border border-slate-200 bg-white px-1.5 py-0.5 text-[10px] font-semibold text-slate-600">
              {typeLabel}
            </span>
          )}
        </div>

        <p className="line-clamp-2 text-sm font-medium text-slate-900">{item.title}</p>

       

        {meta.length > 0 && (
          <p className="mt-1.5 text-[11px] text-slate-500">{meta.join(' \u00b7 ')}</p>
        )}

        {item.tags.metaTags && item.tags.metaTags.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-1">
            {item.tags.metaTags.slice(0, 3).map((tag) => (
              <span
                key={tag}
                className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] text-slate-600"
              >
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
        <div className="mt-auto flex items-center justify-between gap-2 pt-3">
          <span
            className={cn(
              'text-[11px] font-medium',
              item.scope === 'concept' ? 'text-indigo-700' : 'text-slate-500',
            )}
          >
            {item.scope === 'concept' ? 'This concept' : 'Whole chapter'}
          </span>

          {item.url ? (
            <span className="inline-flex items-center gap-1 text-xs font-medium text-indigo-700">
              Open
              <ExternalLink aria-hidden className="h-3 w-3" />
            </span>
          ) : (
            <span className="text-[11px] text-slate-400">Not openable yet</span>
          )}
        </div>
      </div>
    </>
  );

  const shell =
    'flex h-full w-full flex-col overflow-hidden rounded-lg border border-slate-200 bg-white text-left shadow-sm';

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
        'transition-colors duration-200 hover:border-indigo-300 hover:bg-indigo-50/30',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2',
        'motion-reduce:transition-none',
      )}
    >
      {inner}
    </Link>
  );
}

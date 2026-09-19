'use client';

import { Suspense, useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import {
  ArrowLeft,
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
import { isDirectMediaFile, looksLikeFile, toEmbedUrl } from '@/lib/video-embed';

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
          : `/pal/eso?conceptId=${conceptId}`
      );
    } catch (reason: unknown) {
      // Left on the page with the reason, rather than pushed into a screen that
      // would show the lesson again because the acknowledgement never landed.
      setContinueError(
        reason instanceof Error ? reason.message : 'That could not be recorded. Try again.'
      );
      setContinuing(false);
    }
  }, [conceptId, router]);

  if (loading) return <Centered>Loading the lesson…</Centered>;

  if (error || !data) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-6 sm:px-6">
        <Card className="border-rose-200 bg-rose-50">
          <CardContent className="flex flex-wrap items-center justify-between gap-3 pt-5">
            <p className="text-sm text-rose-800">{error ?? 'The lesson could not be loaded.'}</p>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={load}>Try again</Button>
              <Link href="/pal" className={buttonVariants({ size: 'sm' })}>Back to subjects</Link>
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

  return (
    <div className="mx-auto max-w-3xl px-4 py-6 sm:px-6">
      <div className="mb-4">
        <Link href={backHref} className={cn(buttonVariants({ variant: 'ghost', size: 'sm' }), '-ml-2 text-slate-600')}>
          <ArrowLeft aria-hidden className="mr-1.5 h-4 w-4" />
          {chapterId ? 'Back to my plan' : 'Back to subjects'}
        </Link>
      </div>

      <header className="mb-4">
        <h1 className="text-lg font-semibold text-slate-900">{data.conceptName || 'Learn'}</h1>
        <p className="mt-1 text-sm text-slate-600">
          {data.attempt > 0
            ? 'A different explanation of the same idea — the last one did not quite land.'
            : 'Work through this, then practise it.'}
        </p>
      </header>

      <JourneyRail current="learn" completed={['diagnostic', 'adaptive', 'plan']} className="mb-5" />

      {data.reason === 'no_eso_nodes' ? (
        <Card className="border-amber-200 bg-amber-50">
          <CardHeader>
            <CardTitle className="text-base text-amber-900">
              {hasResources ? 'No step-by-step lesson for this one' : 'Guided learning is not set up yet'}
            </CardTitle>
            <CardDescription className="text-amber-800">
              {hasResources
                ? 'There is no guided lesson prepared, but the material below covers this topic. Work through it, then practise.'
                : 'This concept has no guided-learning material prepared. You can still practise the questions for it.'}
            </CardDescription>
          </CardHeader>
          {!hasResources && (
            <CardContent>
              <Link href={`/pal/adaptive/concept/${conceptId}`} className={buttonVariants()}>
                Practise this concept
                <ArrowRight aria-hidden className="ml-1.5 h-4 w-4" />
              </Link>
            </CardContent>
          )}
        </Card>
      ) : data.content === null ? (
        // Ordinary on this estate - most concepts have nothing authored. Said
        // plainly rather than dressed up as an error, and never invented.
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <BookOpen aria-hidden className="h-4 w-4 text-slate-500" />
              {hasResources
                ? 'No step-by-step lesson for this one'
                : 'No lesson written for this concept yet'}
            </CardTitle>
            <CardDescription>
              {hasResources
                ? 'Nobody has written a guided lesson for this concept, but the material below covers it.'
                : 'Nothing has been prepared for this one. Practising the questions is the best way in — each answer tells you where you stand.'}
            </CardDescription>
          </CardHeader>
          {!hasResources && (
            <CardContent>
              <Link href={`/pal/adaptive/concept/${conceptId}`} className={buttonVariants()}>
                Practise this concept
                <ArrowRight aria-hidden className="ml-1.5 h-4 w-4" />
              </Link>
            </CardContent>
          )}
        </Card>
      ) : (
        <LessonCard content={data.content} />
      )}

      {data.resources.sections.length > 0 && (
        <div className="mt-6 space-y-5">
          <div className="flex flex-wrap items-baseline justify-between gap-2 border-t border-slate-200 pt-5">
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

      {(data.content !== null || data.reason === null || hasResources) && (
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
              {continuing && <Loader2 aria-hidden className="mr-1.5 h-4 w-4 animate-spin" />}
              I have read this — continue
              {!continuing && <ArrowRight aria-hidden className="ml-1.5 h-4 w-4" />}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

function LessonCard({ content }: { content: NonNullable<ConceptLearn['content']> }) {
  const url = content.mediaUrl;
  const embed = url ? toEmbedUrl(url) : null;
  const isFile = url ? isDirectMediaFile(url) || looksLikeFile(url) : false;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{content.title || 'Your lesson'}</CardTitle>
        <CardDescription>
          {content.formatLabel}
          {content.attribution && ` · ${content.attribution}`}
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-4">
        {url && embed && !isFile && (
          <div className="aspect-video w-full overflow-hidden rounded-lg border border-slate-200 bg-slate-950">
            <iframe
              src={embed.src}
              title={content.title || embed.title}
              className="h-full w-full"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
            />
          </div>
        )}

        {url && isFile && (
          <video controls className="w-full rounded-lg border border-slate-200 bg-slate-950">
            <source src={url} />
            Your browser cannot play this video.
          </video>
        )}

        {url && !embed && !isFile && (
          <Link
            href={url}
            // Not an embeddable provider and not a media file - hand it over
            // rather than framing something that will not play.
            target="_blank"
            rel="noreferrer"
            className={buttonVariants({ variant: 'outline' })}
          >
            Open the material
            <ExternalLink aria-hidden className="ml-1.5 h-3.5 w-3.5" />
          </Link>
        )}

        {/* Supporting text under the player, when the content model has any.
            Split on its own blank lines so it reads as prose rather than a wall. */}
        {content.body && (
          <div className="space-y-2.5 text-[15px] leading-relaxed text-slate-800">
            {content.body
              .split(/\n\s*\n/)
              .map((part) => part.trim())
              .filter(Boolean)
              .map((paragraph, index) => (
                <p key={index}>{paragraph}</p>
              ))}
          </div>
        )}
      </CardContent>
    </Card>
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
      <div className="mb-2 flex flex-wrap items-center gap-2">
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

      <ul className="space-y-2">
        {section.items.map((item) => (
          <li key={item.id}>
            <ResourceRow item={item} />
          </li>
        ))}
      </ul>
    </section>
  );
}

function ResourceRow({ item }: { item: LearnResourceItem }) {
  const meta = [
    item.fileType ? (FILE_TYPE_LABEL[item.fileType] ?? item.fileType.toUpperCase()) : null,
    item.category,
    item.tags.difficulty === 'advance'
      ? 'Advanced'
      : item.tags.difficulty === 'basic'
        ? 'Foundational'
        : null,
    item.durationSeconds ? formatDuration(item.durationSeconds) : null,
    item.provider,
    item.h5pType ? item.h5pType.replace(/_/g, ' ') : null,
  ].filter(Boolean) as string[];

  const body = (
    <>
      <div className="min-w-0">
        <p className="truncate text-sm font-medium text-slate-900">{item.title}</p>
        {item.description && (
          <p className="mt-0.5 line-clamp-2 text-xs text-slate-600">{item.description}</p>
        )}
        {meta.length > 0 && (
          <p className="mt-1 text-[11px] uppercase tracking-wide text-slate-400">{meta.join(' · ')}</p>
        )}
        {item.tags.metaTags && item.tags.metaTags.length > 0 && (
          <div className="mt-1.5 flex flex-wrap gap-1">
            {item.tags.metaTags.map((tag) => (
              <span key={tag} className="rounded bg-slate-100 px-1.5 py-0.5 text-[11px] text-slate-600">
                {tag}
              </span>
            ))}
          </div>
        )}
        {item.attribution && <p className="mt-1 text-[11px] text-slate-400">{item.attribution}</p>}
      </div>
      {item.url && (
        <ExternalLink aria-hidden className="ml-3 mt-0.5 h-3.5 w-3.5 shrink-0 text-slate-400" />
      )}
    </>
  );

  // No url means H5P, which has no file to open yet. Rendered as a plain row
  // rather than a dead link - a control that goes nowhere is worse than none.
  if (!item.url) {
    return (
      <div className="flex items-start justify-between rounded-lg border border-slate-200 px-3 py-2.5">
        {body}
      </div>
    );
  }

  return (
    <Link
      href={item.url}
      target="_blank"
      rel="noreferrer"
      className="flex items-start justify-between rounded-lg border border-slate-200 px-3 py-2.5 transition-colors hover:border-indigo-300 hover:bg-indigo-50/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2"
    >
      {body}
    </Link>
  );
}

'use client';

import { useEffect, useState } from 'react';
import { ArrowLeft, ArrowRight, Eye, ExternalLink, Loader2, Maximize2, Sparkles, Trophy, X } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { fetchConceptImage, type ConceptImage } from '@/app/pal/data/pal-diagnostic';
import { PracticeStep } from './interactive-journey/PracticeStep';

/**
 * "Learn this concept visually" — the primary teaching surface.
 *
 * Reads the concept's own real name (+ description, when it has one) and asks
 * the backend to find one real, openly-licensed educational image for it —
 * `palController::learnConceptImage()`, backed by `ConceptImageSearchService`
 * (Openverse, restricted to Wikimedia Commons, ranked and relevance-floored so
 * an unrelated image is refused rather than shown — see that service's own
 * notes). This is a real web image with real attribution, never an
 * AI-generated picture and never a hand-drawn substitute.
 *
 * Any failure — no usable image found for this concept (an ordinary, expected
 * outcome, not an error), a network error, anything — calls `onUnavailable()`
 * and renders nothing, so the Learn page falls back to the existing
 * rule-based journey (`generateJourneyRecipe`/`JourneyPlayer`) exactly as it
 * already works, in place, without the student seeing an error screen.
 */
export function WebConceptVisual({
  conceptId,
  conceptName,
  description,
  onExit,
  onUnavailable,
  onContinue,
  continuing,
  continueError,
}: {
  conceptId: string;
  conceptName: string;
  description: string | null;
  onExit: () => void;
  onUnavailable: () => void;
  onContinue: () => void;
  continuing: boolean;
  continueError: string | null;
}) {
  const [step, setStep] = useState<'loading' | 'teach' | 'practice' | 'complete'>('loading');
  const [image, setImage] = useState<ConceptImage | null>(null);
  const [observed, setObserved] = useState(false);
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    let cancelled = false;

    fetchConceptImage(conceptId, description)
      .then((result) => {
        if (cancelled) return;

        if (!result.success || !result.image) {
          onUnavailable();
          return;
        }

        setImage(result.image);
        setStep('teach');
      })
      .catch((error: unknown) => {
        if (cancelled) return;
        // No usable web image, a network error, anything — all fall back the
        // same way. The student never sees this; only the console does.
        console.warn('[WebConceptVisual] falling back to the rule-based journey:', error);
        onUnavailable();
      });

    return () => {
      cancelled = true;
    };
    // Re-runs only if the student opens a different concept's visual.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [conceptId]);

  if (step === 'loading') {
    return (
      <div className="space-y-5">
        <BackLink onClick={onExit} />
        <div className="flex flex-col items-center justify-center gap-3 rounded-2xl border border-slate-200 bg-white px-6 py-20 text-center">
          <Loader2 aria-hidden className="h-6 w-6 animate-spin text-indigo-600" />
          <p className="text-sm text-slate-500">Finding a visual for this concept…</p>
        </div>
      </div>
    );
  }

  if (step === 'practice') {
    return <PracticeStep conceptId={conceptId} onDone={() => setStep('complete')} />;
  }

  if (step === 'complete') {
    return (
      <section className="space-y-4">
        <div className="flex flex-col items-center gap-2 rounded-2xl border border-emerald-200 bg-emerald-50 px-6 py-10 text-center">
          <span className="flex h-12 w-12 items-center justify-center rounded-full bg-emerald-100 text-emerald-600">
            <Trophy aria-hidden className="h-6 w-6" />
          </span>
          <p className="mt-1 text-base font-semibold text-emerald-900">Topic complete</p>
          <p className="max-w-sm text-sm text-emerald-800">
            You worked through {conceptName.toLowerCase()} — the visual, what it shows, and a chance to
            practise it for real.
          </p>
        </div>

        {continueError && (
          <p className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">{continueError}</p>
        )}

        <div className="flex justify-end">
          <Button onClick={onContinue} disabled={continuing}>
            {continuing && <Loader2 aria-hidden className="mr-1.5 h-4 w-4 animate-spin" />}
            Continue to next topic
            {!continuing && <ArrowRight aria-hidden className="ml-1.5 h-4 w-4" />}
          </Button>
        </div>
      </section>
    );
  }

  // step === 'teach'
  // Never a fabricated claim about what the image specifically depicts — we
  // don't have model-grounded knowledge of that, only the image's own title.
  // A real authored description is used verbatim when this concept has one;
  // otherwise an honest, concept-agnostic observation prompt, never invented
  // detail.
  const explanation =
    description && description.trim() !== ''
      ? description
      : `Look closely at the image above. What do you notice that connects to ${conceptName.toLowerCase()}? Think it through, then continue.`;

  return (
    <div className="space-y-5">
      <BackLink onClick={onExit} />

      <div>
        <p className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-indigo-600">
          <Sparkles aria-hidden className="h-3.5 w-3.5" />
          Learn this concept visually
        </p>
        <h2 className="mt-0.5 text-lg font-semibold text-slate-900">{conceptName}</h2>
      </div>

      <button
        type="button"
        onClick={() => setExpanded(true)}
        className="group relative block w-full overflow-hidden rounded-2xl border border-slate-200 bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2"
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={image?.url ?? ''}
          alt={image?.title ?? `An educational image for ${conceptName}`}
          className="max-h-[420px] w-full object-contain"
        />
        <span className="absolute bottom-2.5 right-2.5 inline-flex items-center gap-1 rounded-full bg-black/60 px-2.5 py-1 text-[11px] font-medium text-white opacity-0 backdrop-blur-sm transition-opacity group-hover:opacity-100">
          <Maximize2 aria-hidden className="h-3 w-3" />
          Explore the visual
        </span>
      </button>

      <Attribution image={image} />

      {observed ? (
        <p className="rounded-xl border border-slate-200 bg-white p-4 text-sm leading-relaxed text-slate-700">
          {explanation}
        </p>
      ) : (
        <button
          type="button"
          onClick={() => setObserved(true)}
          className="flex w-full items-center gap-2.5 rounded-xl border border-indigo-200 bg-indigo-50/60 px-4 py-3 text-left text-sm font-semibold text-indigo-700 transition-colors hover:bg-indigo-50"
        >
          <Eye aria-hidden className="h-4 w-4 shrink-0" />
          What do you notice? Tap to see the explanation.
        </button>
      )}

      <div className="flex justify-end">
        <Button size="sm" onClick={() => setStep('practice')}>
          Continue to practice
          <ArrowRight aria-hidden className="ml-1.5 h-3.5 w-3.5" />
        </Button>
      </div>

      {expanded && (
        <Lightbox image={image} conceptName={conceptName} onClose={() => setExpanded(false)} />
      )}
    </div>
  );
}

function BackLink({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex items-center gap-1.5 text-sm font-medium text-indigo-600 transition-colors hover:text-indigo-700"
    >
      <ArrowLeft aria-hidden className="h-4 w-4" />
      Back to learning
    </button>
  );
}

/**
 * Real provenance, shown unobtrusively — a single small line, not a card of
 * its own. This is what makes showing a web image to a student defensible:
 * every image Openverse returns carries real license/creator metadata, and
 * this is where it actually reaches the screen.
 */
function Attribution({ image }: { image: ConceptImage | null }) {
  if (!image) return null;

  const byline = [image.title, image.creator ? `by ${image.creator}` : null, image.license]
    .filter(Boolean)
    .join(' · ');

  if (!byline) return null;

  return (
    <p className="flex items-center gap-1 text-[11px] text-slate-400">
      <span className="truncate">{byline}</span>
      <a
        href={image.sourceUrl}
        target="_blank"
        rel="noreferrer"
        className="inline-flex shrink-0 items-center gap-0.5 text-slate-400 hover:text-indigo-600"
      >
        <ExternalLink aria-hidden className="h-3 w-3" />
        Source
      </a>
    </p>
  );
}

/**
 * A closer look at the same image — the honest version of "explore" for a
 * static web image: nothing here is fabricated interactivity layered on top
 * of it, it is the same image at a size worth actually studying, with its
 * attribution carried along.
 */
function Lightbox({
  image,
  conceptName,
  onClose,
}: {
  image: ConceptImage | null;
  conceptName: string;
  onClose: () => void;
}) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 p-4 animate-in fade-in duration-150"
      role="dialog"
      aria-modal="true"
      aria-label={`${conceptName}, enlarged`}
      onClick={onClose}
    >
      <div className={cn('relative max-h-full max-w-4xl')} onClick={(event) => event.stopPropagation()}>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="absolute -top-10 right-0 rounded-lg p-2 text-white/80 transition-colors hover:bg-white/10 hover:text-white"
        >
          <X className="h-5 w-5" />
        </button>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={image?.url ?? ''}
          alt={image?.title ?? `An educational image for ${conceptName}`}
          className="max-h-[80vh] w-auto rounded-xl object-contain"
        />
        {image && (
          <p className="mt-2 text-center text-xs text-white/70">
            {[image.title, image.creator ? `by ${image.creator}` : null, image.license].filter(Boolean).join(' · ')}
          </p>
        )}
      </div>
    </div>
  );
}

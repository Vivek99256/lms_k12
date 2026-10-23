'use client';

import { useEffect, useRef, useState } from 'react';

import {
  fetchCpFit,
  fetchCpOptions,
  fetchCpPreflight,
  type CpCoverage,
  type CpFit,
  type CpImages,
  type CpOptions,
  type CpPreflight,
  type CpSourceStatus,
  type CpSuitability,
} from '@/lib/coursePresentation/api';
import { panelKey } from '@/lib/coursePresentation/panelKey';
import { CHAPTER_DATA_PREVIEW_TITLE as PREVIEW_TITLE, previewAddress } from '@/lib/coursePresentation/previewAddress';
import { storedHeading } from '@/lib/coursePresentation/runChoice';
import { carriesEarlierChoice, startState, type CpState } from '@/lib/coursePresentation/urlState';
import { resolveSelectedContent } from '@/lib/coursePresentation/contentRoute';
import { GenerationPanel } from '@/components/coursePresentation/GenerationPanel';
import { cn } from '@/lib/utils';

const STATUS_LABEL: Record<CpSourceStatus, string> = {
  present: 'Available',
  incomplete: 'Incomplete',
  missing: 'Missing',
  conflicting: 'Needs review',
};

/** For content that may or may not exist yet, "missing" is not a fault, so it is worded as what it is. */
const EXISTING_LABEL: Record<CpSourceStatus, string> = { ...STATUS_LABEL, present: 'Stored', missing: 'None stored', incomplete: 'Draft failed validation' };

const STATUS_STYLE: Record<CpSourceStatus, string> = {
  present: 'bg-emerald-100 text-emerald-800',
  incomplete: 'bg-amber-100 text-amber-900',
  missing: 'bg-slate-200 text-slate-700',
  conflicting: 'bg-red-100 text-red-800',
};

const SUITABILITY_HEADLINE: Record<CpSuitability['verdict'], string> = {
  suitable: 'Suitable fit.',
  not_suitable: 'Not a suitable fit.',
  unconfirmed: 'Not confirmed as a suitable fit.',
  unknown: 'Cannot be checked.',
};

/** The answer to "is this teaching method suitable for this chapter?", with a way to switch to a better one. */
function SuitabilityNotice({ suitability, onUse }: { suitability: CpSuitability; onUse?: (key: string) => void }) {
  const good = suitability.verdict === 'suitable';
  return (
    <div
      data-testid="cp-suitability"
      data-verdict={suitability.verdict}
      role={good ? 'status' : 'alert'}
      className={cn('mt-3 rounded-md px-3 py-2 text-sm', good ? 'bg-emerald-50 text-emerald-900' : suitability.verdict === 'not_suitable' ? 'bg-amber-50 text-amber-900' : 'bg-slate-100 text-slate-800')}
    >
      <p>
        <span className="font-semibold">{SUITABILITY_HEADLINE[suitability.verdict]}</span> {suitability.message}
      </p>
      {onUse && suitability.recommendation && suitability.recommendation.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-2">
          {suitability.recommendation.map((r) => (
            <button key={r.key} type="button" onClick={() => onUse(r.key)} className="rounded-md border border-current px-2 py-1 text-xs font-medium hover:bg-white/60">
              Use {r.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

/** What the picture library holds for the chapter, and what an earlier draft says about its pictures. Read only. */
function PicturesSection({ images }: { images: CpImages }) {
  const d = images.earlier_draft;
  const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`;
  return (
    <div data-testid="cp-pictures" className="mt-2 rounded-md border border-slate-200 px-3 py-2 text-sm">
      <p>
        <span className="font-medium">Picture library for this chapter:</span> {images.library.stored} stored ({plural(images.library.drawn_diagrams, 'drawn diagram')}, {plural(images.library.photographs, 'photograph')}); {images.library.used_by_a_stored_deck} used by a stored deck.
      </p>
      {d.found ? (
        <>
          <p className="mt-1 text-slate-700">
            The earlier draft has {plural(d.slides_with_a_picture, 'slide picture')} ({plural(d.drawn_diagrams, 'drawn diagram')}, {plural(d.photographs, 'photograph')}); {d.found_in_the_library} of them can be read from the library. {d.status}
          </p>
          {d.photographs_not_found.length > 0 && (
            <details className="mt-1">
              <summary className="cursor-pointer text-slate-700">{d.photographs_not_found.length} planned photograph(s) were not found</summary>
              <ul className="mt-1 list-disc space-y-0.5 pl-5 text-xs text-slate-600">
                {d.photographs_not_found.map((m) => (
                  <li key={m.slide}>
                    Slide {m.slide}
                    {m.concepts.length ? ` (${m.concepts.join('; ')})` : ''}: {m.reason}
                  </li>
                ))}
              </ul>
            </details>
          )}
        </>
      ) : (
        <p className="mt-1 text-slate-700">There is no earlier draft with pictures to check.</p>
      )}
      <p className="mt-1 text-xs text-slate-500">{images.reuse_rule}</p>
      <p className="mt-1 text-xs text-slate-500">{images.requirements_note}</p>
    </div>
  );
}

/**
 * Does the chosen format have a template that opens from the stored data? If so, open it (no AI call). If not, say what
 * it would need; the Create section below is then the way forward, and says whether creating is possible.
 */
function TemplatePanel({ template, viewerLabel, onOpen }: { template: CpFit['template']; viewerLabel: string | null; onOpen: () => void }) {
  return (
    <section data-testid="cp-template" data-available={template.available ? 'yes' : 'no'} className="mt-4 rounded-md border border-slate-200 px-3 py-3 text-sm">
      {template.available ? (
        <>
          <h3 className="font-semibold">{PREVIEW_TITLE}</h3>
          <p className="mt-1 text-slate-600">
            Opens {viewerLabel ?? 'the viewer'} with the chapter&rsquo;s stored concepts, learning outcomes, intelligence and verified pictures in the order of the teaching method you chose. Nothing is generated or stored: this is a preview of the chapter&rsquo;s data, not the generated classroom presentation and not an approved or published one. Create below makes the generated presentation. Anything the data cannot supply is listed, not invented.
          </p>
          <button type="button" data-testid="cp-open-template" onClick={onOpen} className="mt-3 rounded-md border border-indigo-600 px-3 py-1.5 font-medium text-indigo-700 hover:bg-indigo-50">
            Open chapter data preview
          </button>
        </>
      ) : (
        <>
          {template.registered ? (
            <div data-testid="cp-registered-template" className="mb-2 rounded-md bg-indigo-50 px-2 py-1.5 text-xs text-indigo-900">
              <span className="font-semibold">{template.registered.name}</span> (version {template.registered.version}), {template.registered.source === 'template_master' ? 'from Template Management' : 'built-in default, not yet saved in Template Management'}. The story is written for this chapter and shown in the study-deck story player.
            </div>
          ) : null}
          <h3 className="font-semibold">{template.registered ? 'What this format needs' : 'No template for this format yet'}</h3>
          <ul className="mt-1 list-disc space-y-0.5 pl-5 text-slate-700">
            {[...template.requirements, ...template.blocked_by].map((r) => (
              <li key={r}>{r}</li>
            ))}
          </ul>
          <p className="mt-1 text-xs text-slate-500">Where a format can be created, Create below is the way forward.</p>
        </>
      )}
    </section>
  );
}

/** Every concept of the chapter and where its explanation comes from. A concept with no intelligence of its own is still explained from its stored concept record. */
function CoverageSection({ coverage }: { coverage: CpCoverage }) {
  const s = coverage.summary;
  const pct = s.total_concepts === 0 ? 0 : Math.round((s.renderable / s.total_concepts) * 100);
  const SOURCE: Record<CpCoverage['concepts'][number]['source'], string> = {
    semantic: 'Intelligence',
    concept_record: 'Concept record',
    unresolved: 'Unresolved',
  };
  const TIER: Record<CpCoverage['concepts'][number]['semantic'], string> = { concept: 'own intelligence', topic: 'topic-level intelligence only', none: 'no intelligence' };
  return (
    <div data-testid="cp-coverage" className="mt-2 rounded-md border border-slate-200 px-3 py-2 text-sm">
      <p>
        <span className="font-medium">Overall: {s.renderable} of {s.total_concepts} concepts can be shown ({pct}%).</span>{' '}
        {s.unresolved > 0 ? `${s.unresolved} could not be tied to any source and ${s.unresolved === 1 ? 'is' : 'are'} listed below.` : 'None is left out.'}
      </p>
      <ul className="mt-1 list-disc space-y-0.5 pl-5 text-slate-700">
        <li data-testid="cp-coverage-semantic">
          Intelligence: {s.semantic_concept_level} concepts have their own ({s.semantic_exact} by exact name, {s.semantic_contained} by a contained name); {s.semantic_topic_level_only} more only through their topic; {s.no_semantic} have none.
        </li>
        <li data-testid="cp-coverage-sources">
          Explained from: intelligence {s.from_intelligence}; the stored concept record alone {s.from_concept_record_only}; unresolved {s.unresolved}.
        </li>
        <li>
          Pictures: {coverage.pictures.with_a_verified_picture} concepts have a verified picture, {coverage.pictures.without} do not (their slides still show; a picture is attached only when verified).
        </li>
      </ul>
      {coverage.unresolved.length > 0 && (
        <ul className="mt-1 list-disc space-y-0.5 pl-5 text-amber-900">
          {coverage.unresolved.map((u) => (
            <li key={u.name}>
              {u.name}: {u.reason}
            </li>
          ))}
        </ul>
      )}
      {coverage.intelligence_entries_not_mapped.length > 0 && (
        <p className="mt-1 text-xs text-slate-600">Intelligence entries that name no concept or topic of this chapter: {coverage.intelligence_entries_not_mapped.join(', ')}.</p>
      )}
      <details className="mt-1">
        <summary className="cursor-pointer text-slate-700">Concept by concept ({coverage.concepts.length})</summary>
        <ul className="mt-1 max-h-64 space-y-0.5 overflow-y-auto text-xs text-slate-700">
          {coverage.concepts.map((c) => (
            <li key={c.name} data-source-group={c.source}>
              <span className="font-medium">{c.name}</span> <span className="text-slate-500">({c.topic})</span>: {SOURCE[c.source]}; {TIER[c.semantic]}
              {c.picture ? '; verified picture' : ''}
            </li>
          ))}
        </ul>
      </details>
      {coverage.learning_outcomes ? <p className="mt-1 text-xs text-slate-500">Learning outcomes are {coverage.learning_outcomes}.</p> : null}
    </div>
  );
}

const FIT_HEADLINE: Record<CpFit['fit_status'], string> = {
  suitable: 'Suitable combination.',
  partially_suitable: 'Partly suitable combination.',
  unsuitable: 'Not a suitable combination.',
  unsupported: 'Not supported yet.',
};

const FIT_STYLE: Record<CpFit['fit_status'], string> = {
  suitable: 'bg-emerald-50 text-emerald-900',
  partially_suitable: 'bg-sky-50 text-sky-900',
  unsuitable: 'bg-amber-50 text-amber-900',
  unsupported: 'bg-slate-100 text-slate-800',
};

/** The server's verdict on the two choices together, why, and alternatives the teacher can switch to. */
function FitNotice({ fit, onUse }: { fit: CpFit; onUse?: (r: CpFit['recommendations'][number]) => void }) {
  return (
    <div
      data-testid="cp-fit"
      data-fit={fit.fit_status}
      role={fit.fit_status === 'suitable' ? 'status' : 'alert'}
      className={cn('mt-3 rounded-md px-3 py-2 text-sm', FIT_STYLE[fit.fit_status])}
    >
      <p>
        <span className="font-semibold">{FIT_HEADLINE[fit.fit_status]}</span> {fit.reason}
      </p>
      {fit.fit_status === 'unsupported' && <p className="mt-1">You can still continue to see what a template for this format would need, and whether it can be created.</p>}
      {fit.missing_sources.length > 0 && (
        <p className="mt-1">Missing required material: {fit.missing_sources.map((m) => m.label).join(', ')}.</p>
      )}
      {onUse && fit.recommendations.length > 0 && (
        <div className="mt-2">
          <p className="text-xs font-semibold">Try instead:</p>
          <ul className="mt-1 space-y-1">
            {fit.recommendations.map((r) => (
              <li key={`${r.type}-${r.key}`} className="flex flex-wrap items-center gap-2">
                <button type="button" onClick={() => onUse(r)} className="rounded-md border border-current px-2 py-1 text-xs font-medium hover:bg-white/60">
                  Use {r.label}
                </button>
                <span className="text-xs">{r.type === 'method' ? 'Teaching method. ' : 'Delivery format. '}{r.reason}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

/**
 * The Course Presentation card's screen: two choices (how to teach, what students experience), a server-side fit
 * check of the two together, then a read-only pre-flight of the chapter's sources and what the existing generators
 * and viewers can do with the choice. Continue is allowed only when the server says the combination may continue.
 *
 * Choosing and checking only GET lms/course-presentation/{options,fit,preflight}. Generating, approving and discarding a
 * draft are the GenerationPanel's, and every rule behind them is the server's. The state (both choices, which screen) is
 * mirrored to the URL via `onMirror`.
 */
export function CoursePresentationFlow({
  chapterId,
  initial,
  onMirror,
  onClose,
  onOpenPresentation,
  onOpenPreview,
}: {
  chapterId: number;
  /** What the URL said when the screen opened. Never restored: the screen always opens at the empty choice form (see startState). */
  initial: CpState;
  /** Told after every change, so the caller can keep the URL in step. The screen itself never waits for it. */
  onMirror: (next: CpState) => void;
  onClose: () => void;
  /** Opens a stored presentation in the study-deck viewer (the page owns navigation). */
  onOpenPresentation: (deepLink: string) => void;
  /** Opens the existing study-deck viewer on a template filled from stored data (the page owns navigation). */
  onOpenPreview: (address: string) => void;
}) {
  // The choices live here so a click is instant; the URL follows (the page reloads its data on every URL change).
  // Every opening starts at the empty choice form: whatever the address says about an earlier visit is ignored (and cleared below).
  const [state, setState] = useState<CpState>(startState);
  useEffect(() => {
    if (carriesEarlierChoice(initial)) onMirror(startState());
    // Once, on opening: `initial` is what the address held when the screen opened.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  // Choices come in quick succession and every URL change reloads the page's data, so the URL is written once they
  // settle: an older update can never land after a newer one.
  const mirrorTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const onState = (next: CpState) => {
    setState(next);
    if (mirrorTimer.current) clearTimeout(mirrorTimer.current);
    mirrorTimer.current = setTimeout(() => onMirror(next), 250);
  };
  const close = () => {
    if (mirrorTimer.current) clearTimeout(mirrorTimer.current);
    onClose();
  };
  const [options, setOptions] = useState<CpOptions | null>(null);
  // The pre-flight answer is kept with the request it answers, so a stale answer is never shown for new choices.
  const [answer, setAnswer] = useState<{ key: string; data: CpPreflight | null; error: string } | null>(null);
  const [optionsError, setOptionsError] = useState('');
  const firstRadio = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    (async () => {
      try {
        const res = await fetchCpOptions(chapterId, controller.signal);
        if (controller.signal.aborted) return;
        if (!Array.isArray(res.pedagogies) || !Array.isArray(res.formats)) throw new Error('The service gave an unexpected answer. Please try again.');
        setOptions(res);
      } catch (e) {
        if (!controller.signal.aborted) setOptionsError(e instanceof Error ? e.message : 'Something went wrong.');
      }
    })();
    return () => controller.abort();
  }, [chapterId]);

  // The pre-flight is fetched whenever both choices are made, so we know what content exists and can offer to open it directly.
  const showingPreflight = state.stage === 'preflight' && state.pedagogy !== null && state.format !== null;
  const bothChosen = state.pedagogy !== null && state.format !== null;
  const requestKey = `${chapterId}:${state.pedagogy}:${state.format}`;
  useEffect(() => {
    if (!bothChosen || state.pedagogy === null || state.format === null) return;
    const controller = new AbortController();
    const key = requestKey;
    (async () => {
      try {
        const data = await fetchCpPreflight(chapterId, state.pedagogy as string, state.format as string, controller.signal);
        if (!controller.signal.aborted) setAnswer({ key, data, error: '' });
      } catch (e) {
        if (!controller.signal.aborted) setAnswer({ key, data: null, error: e instanceof Error ? e.message : 'Something went wrong.' });
      }
    })();
    return () => {
      controller.abort();
      // Leaving the pre-flight (or changing a choice) drops its answer, so the next visit starts from "checking" and never presents
      // the run an earlier visit saw as the current one.
      setAnswer(null);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chapterId, bothChosen, state.pedagogy, state.format]);

  // The fit of the two choices together, asked of the server whenever both are chosen.
  const [fitAnswer, setFitAnswer] = useState<{ key: string; fit: CpFit | null; error: string } | null>(null);
  useEffect(() => {
    if (!bothChosen || state.pedagogy === null || state.format === null) return;
    const controller = new AbortController();
    const key = requestKey;
    (async () => {
      try {
        const res = await fetchCpFit(chapterId, state.pedagogy as string, state.format as string, controller.signal);
        if (!controller.signal.aborted) setFitAnswer({ key, fit: res.fit, error: '' });
      } catch (e) {
        if (!controller.signal.aborted) setFitAnswer({ key, fit: null, error: e instanceof Error ? e.message : 'Something went wrong.' });
      }
    })();
    return () => controller.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chapterId, bothChosen, state.pedagogy, state.format]);
  const chooseFit = fitAnswer !== null && fitAnswer.key === requestKey ? fitAnswer : null;
  const fit = chooseFit?.fit ?? null;
  const fitError = chooseFit?.error ?? '';

  /** Switch to a recommended method or format. */
  const useRecommendation = (r: CpFit['recommendations'][number]) =>
    onState(r.type === 'method' ? { ...state, pedagogy: r.key } : { ...state, format: r.key });

  const current = answer !== null && answer.key === requestKey ? answer : null;
  const preflight = current?.data ?? null;
  const loading = showingPreflight && current === null;
  const error = (showingPreflight ? current?.error : optionsError) || '';
  const checking = bothChosen && (chooseFit === null || current === null);
  const resolvedContent = resolveSelectedContent(chapterId, state.pedagogy, state.format, preflight);
  // Only content made for exactly this choice is opened as the lesson. The no-AI source preview is the same text for every teaching method,
  // so it is never the primary action: Create generates the lesson for the chosen method, and the preview is offered apart, labelled as what it is.
  const storedContent = resolvedContent && resolvedContent.kind !== 'template_preview' ? resolvedContent : null;
  const previewContent = resolvedContent && resolvedContent.kind === 'template_preview' ? resolvedContent : null;

  useEffect(() => {
    firstRadio.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      if (mirrorTimer.current) clearTimeout(mirrorTimer.current);
      onClose();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose, showingPreflight]);

  // Continue needs both choices AND the server's word that the combination may continue.
  const ready = bothChosen && fit?.continue_allowed === true;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-slate-900/40 p-4" role="presentation">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="cp-title"
        data-testid="course-presentation-flow"
        className="my-4 w-full max-w-3xl rounded-xl bg-white p-5 shadow-xl"
      >
        {!showingPreflight ? (
          <>
            <h2 id="cp-title" className="text-lg font-semibold">Plan the Course Presentation</h2>
            <p className="mt-1 text-sm text-slate-600">Choose how you want to teach and what students should experience. Nothing is created yet.</p>
            {error && <p role="alert" className="mt-2 rounded-md bg-red-50 px-3 py-2 text-sm text-red-800">{error}</p>}

            <fieldset className="mt-4">
              <legend className="text-sm font-semibold">How should I teach?</legend>
              <div role="radiogroup" aria-label="Teaching method" className="mt-2 grid gap-1.5 sm:grid-cols-2">
                {(options?.pedagogies ?? []).map((p, i) => (
                  <label
                    key={p.key}
                    className={cn('flex cursor-pointer items-center gap-2 rounded-md border px-3 py-2 text-sm', state.pedagogy === p.key ? 'border-indigo-600 bg-indigo-50' : 'border-slate-200 hover:bg-slate-50')}
                  >
                    <input
                      ref={i === 0 ? firstRadio : undefined}
                      type="radio"
                      name="cp-pedagogy"
                      value={p.key}
                      checked={state.pedagogy === p.key}
                      onChange={() => onState({ ...state, pedagogy: p.key })}
                    />
                    <span>{p.label}</span>
                  </label>
                ))}
              </div>
            </fieldset>

            {!bothChosen && state.pedagogy !== null && options?.suitability?.[state.pedagogy] && (
              <SuitabilityNotice suitability={options.suitability[state.pedagogy]} onUse={(key) => onState({ ...state, pedagogy: key })} />
            )}

            <fieldset className="mt-4">
              <legend className="text-sm font-semibold">What should students experience?</legend>
              <div role="radiogroup" aria-label="Delivery format" className="mt-2 grid gap-1.5 sm:grid-cols-2">
                {(options?.formats ?? []).map((f) => (
                  <label
                    key={f.key}
                    className={cn('flex cursor-pointer items-center gap-2 rounded-md border px-3 py-2 text-sm', state.format === f.key ? 'border-indigo-600 bg-indigo-50' : 'border-slate-200 hover:bg-slate-50')}
                  >
                    <input type="radio" name="cp-format" value={f.key} checked={state.format === f.key} onChange={() => onState({ ...state, format: f.key })} />
                    <span>
                      {f.label}
                      {!f.generator_exists && <span className="ml-1 text-xs text-slate-500">(no generator yet)</span>}
                    </span>
                  </label>
                ))}
              </div>
            </fieldset>

            {bothChosen && fit === null && !fitError && <p role="status" className="mt-3 text-sm text-slate-600">Checking whether this combination suits the chapter&hellip;</p>}
            {bothChosen && fitError && <p role="alert" className="mt-3 rounded-md bg-red-50 px-3 py-2 text-sm text-red-800">{fitError}</p>}
            {bothChosen && fit !== null && <FitNotice fit={fit} onUse={useRecommendation} />}

            <div className="mt-5 flex flex-wrap items-center justify-end gap-2">
              {!bothChosen && <p className="mr-auto text-xs text-slate-500">Choose one of each to continue.</p>}
              {bothChosen && fit !== null && !fit.continue_allowed && <p className="mr-auto text-xs text-slate-500">Choose a different method or format to continue.</p>}
              {bothChosen && previewContent && (
                <button
                  type="button"
                  data-testid="cp-open-preview"
                  title="Built from the chapter's stored data; the lesson text is the same for every teaching method"
                  onClick={() => {
                    if (mirrorTimer.current) clearTimeout(mirrorTimer.current);
                    onOpenPreview(previewContent.url);
                  }}
                  className="text-xs font-medium text-slate-600 underline hover:text-slate-900"
                >
                  Preview the source material (same for every teaching method)
                </button>
              )}
              {bothChosen && storedContent && (
                <button
                  type="button"
                  onClick={() => onState({ ...state, stage: 'preflight' })}
                  className="mr-auto text-xs font-medium text-indigo-600 hover:underline"
                >
                  View pre-flight details
                </button>
              )}
              <button type="button" onClick={close} className="rounded-md border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50">
                Cancel
              </button>
              {bothChosen && storedContent ? (
                <button
                  type="button"
                  data-testid="cp-open-content"
                  onClick={() => {
                    if (mirrorTimer.current) clearTimeout(mirrorTimer.current);
                    onOpenPresentation(storedContent.url);
                  }}
                  className="rounded-md bg-indigo-600 px-3.5 py-1.5 text-sm font-medium text-white shadow-sm hover:bg-indigo-700"
                >
                  {storedContent.label}
                </button>
              ) : (
                <button
                  type="button"
                  disabled={!ready || checking}
                  data-testid="cp-continue"
                  onClick={() => ready && !checking && onState({ ...state, stage: 'preflight' })}
                  className={cn(
                    'rounded-md px-3 py-1.5 text-sm font-medium',
                    ready && !checking ? 'bg-indigo-600 text-white hover:bg-indigo-700' : 'cursor-not-allowed bg-slate-200 text-slate-500',
                  )}
                >
                  {checking ? 'Checking availability…' : 'Continue'}
                </button>
              )}
            </div>
          </>
        ) : (
          <>
            <h2 id="cp-title" className="text-lg font-semibold">What this chapter has</h2>
            {preflight && (
              <p className="mt-1 text-sm text-slate-600">
                {preflight.selection.pedagogy.label} · {preflight.selection.format.label}
              </p>
            )}
            {error && <p role="alert" className="mt-2 rounded-md bg-red-50 px-3 py-2 text-sm text-red-800">{error}</p>}
            {loading && <p role="status" className="mt-3 text-sm text-slate-600">Checking the chapter&rsquo;s material&hellip;</p>}

            {preflight && (
              <>
                <FitNotice fit={preflight.fit} />
                <h3 className="mt-4 text-sm font-semibold">Source material</h3>
                <ul className="mt-2 space-y-2">
                  {preflight.sources.map((s) => (
                    <li key={s.key} data-source={s.key} data-status={s.status} className="rounded-md border border-slate-200 px-3 py-2 text-sm">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-medium">{s.label}</span>
                        <span className={cn('rounded-full px-2 py-0.5 text-xs font-medium', STATUS_STYLE[s.status])}>{s.status_label ?? STATUS_LABEL[s.status]}</span>
                        {s.needed_for_slides && <span className="text-xs text-slate-500">needed to generate slides</span>}
                      </div>
                      <p className="mt-1 text-slate-700">{s.summary}</p>
                      {s.status !== 'present' && <p className="mt-0.5 text-xs text-slate-500">{s.impact}</p>}
                    </li>
                  ))}
                </ul>

                <h3 className="mt-4 text-sm font-semibold">Concept coverage</h3>
                <CoverageSection coverage={preflight.coverage} />

                <h3 className="mt-4 text-sm font-semibold">Pictures</h3>
                <PicturesSection images={preflight.images} />

                <h3 className="mt-4 text-sm font-semibold">Existing content (not source material)</h3>
                <ul className="mt-2 space-y-2">
                  {preflight.existing_content.map((s) => (
                    <li key={s.key} data-existing={s.key} data-status={s.status} className="rounded-md border border-slate-200 px-3 py-2 text-sm">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-medium">{s.label}</span>
                        <span className={cn('rounded-full px-2 py-0.5 text-xs font-medium', STATUS_STYLE[s.status])}>{EXISTING_LABEL[s.status]}</span>
                      </div>
                      <p className="mt-1 text-slate-700">{s.summary}</p>
                      {s.status !== 'present' && <p className="mt-0.5 text-xs text-slate-500">{s.impact}</p>}
                    </li>
                  ))}
                </ul>

                <TemplatePanel
                  template={preflight.fit.template}
                  viewerLabel={preflight.fit.viewer_label}
                  onOpen={() => onOpenPreview(previewAddress(chapterId, { pedagogy: preflight.selection.pedagogy.key, format: preflight.selection.format.key }))}
                />

                <GenerationPanel
                  key={panelKey(requestKey, preflight.run)}
                  chapterId={chapterId}
                  pedagogy={preflight.selection.pedagogy.key}
                  format={preflight.selection.format.key}
                  fit={preflight.fit}
                  initialRun={preflight.run}
                  onOpenPresentation={onOpenPresentation}
                />
                <h3 className="mt-4 text-sm font-semibold">{storedHeading(preflight.selection.format.key)}</h3>
                {preflight.existing_resources.length === 0 ? (
                  <p className="mt-1 text-sm text-slate-600">None are stored for this chapter yet.</p>
                ) : (
                  <ul className="mt-2 space-y-1.5 pl-0 text-sm text-slate-700">
                    {preflight.existing_resources.map((r) => (
                      <li key={`${r.type}-${r.title}`} className="flex items-center justify-between rounded-md border border-slate-200 px-3 py-1.5">
                        <span className="font-medium">{r.title}</span>
                        {typeof r.ref === 'number' && (
                          <button
                            type="button"
                            onClick={() => {
                              if (mirrorTimer.current) clearTimeout(mirrorTimer.current);
                              onOpenPresentation(`/student/study-deck/${chapterId}?content=${r.ref}`);
                            }}
                            className="ml-2 rounded-md bg-indigo-600 px-2.5 py-1 text-xs font-medium text-white hover:bg-indigo-700 shadow-sm"
                          >
                            Open
                          </button>
                        )}
                      </li>
                    ))}
                  </ul>
                )}

                {preflight.not_used.length > 0 && (
                  <>
                    <h3 className="mt-4 text-sm font-semibold">Not used here</h3>
                    <ul className="mt-1 space-y-1 text-sm text-slate-700">
                      {preflight.not_used.map((n) => (
                        <li key={n.key}>
                          {n.label} ({n.count}; {n.detail}). {n.reason}
                        </li>
                      ))}
                    </ul>
                  </>
                )}
              </>
            )}

            <div className="mt-5 flex flex-wrap justify-end gap-2">
              <button
                type="button"
                onClick={() => onState({ ...state, stage: 'choose' })}
                className="rounded-md border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
              >
                Change choices
              </button>
              <button type="button" onClick={close} className="rounded-md bg-indigo-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-indigo-700">
                Close
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

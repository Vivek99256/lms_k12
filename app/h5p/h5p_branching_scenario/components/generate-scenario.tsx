'use client';

import { friendlyError } from '@/lib/user-messages';

import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { AlertTriangle, Check, ChevronDown, Info, Loader2, Sparkles } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { estimateMinutes, normalizeScenario, type RawScenario } from '@/lib/h5p/branching-scenario';
import { h5pContextQuery, type H5pContext } from '../../data/h5p';
import {
  branchingScenarioApi,
  fetchBranchingSources,
  generateBranchingScenario,
  type BranchingLength,
  type BranchingReport,
  type BranchingScenarioSavePayload,
  type BranchingSourcesResult,
} from '../../data/h5p-branching';
import { InlineBanner } from '../../components/shared';
import { BranchingScenarioPlayer } from './player';
import { StoryMap } from './story-map';

/**
 * Generate a branching scenario from a chapter — for REVIEW, not for storing.
 *
 * THREE STEPS, AND NOTHING IS WRITTEN UNTIL THE LAST.
 *
 *   1. Choose what it is built from: the chapter's topics and concepts (or let
 *      the generator pick the ones that suit a decision best), how long it
 *      should be, and whether to reuse questions from the bank as checks.
 *   2. Wait, honestly. It takes minutes, there is no real progress to report,
 *      and a made-up progress bar would be a lie, so the screen says that and
 *      shows the time that has passed.
 *   3. Review: play the draft exactly as a student would, see how many paths
 *      and endings it has and what the checks found, and only then save it.
 *
 * Saving makes an ordinary DRAFT through the same call the editor uses. It is
 * not visible to students and is published by a separate act, from the list or
 * the editor, which runs the server's check again.
 */

const LENGTHS: { value: BranchingLength; label: string; hint: string }[] = [
  { value: 'short', label: 'Short', hint: 'About 6 to 8 minutes. 2 or 3 decisions.' },
  { value: 'standard', label: 'Standard', hint: 'About 10 to 15 minutes. 3 to 5 decisions.' },
  { value: 'extended', label: 'Extended', hint: 'About 20 minutes. 5 or more decisions.' },
];

type Phase = 'choose' | 'working' | 'failed' | 'review';

function formatElapsed(seconds: number): string {
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
}

export function GenerateScenarioButton({ ctx, reload, notify }: { ctx: H5pContext; reload: () => void; notify: (message: string) => void }) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-1.5 rounded-xl border border-indigo-200 bg-indigo-50 px-3.5 py-2 text-xs font-semibold text-indigo-700 transition hover:bg-indigo-100"
      >
        <Sparkles className="h-3.5 w-3.5" aria-hidden="true" />
        Generate with AI
      </button>

      {/* Mounted only while open, so closing it forgets a draft that was not saved. */}
      {open ? (
        <GenerateDialog
          ctx={ctx}
          onClose={() => setOpen(false)}
          onSaved={(message) => {
            setOpen(false);
            notify(message);
            reload();
          }}
        />
      ) : null}
    </>
  );
}

function GenerateDialog({ ctx, onClose, onSaved }: { ctx: H5pContext; onClose: () => void; onSaved: (message: string) => void }) {
  const router = useRouter();

  const [phase, setPhase] = useState<Phase>('choose');
  const [sources, setSources] = useState<BranchingSourcesResult | null>(null);
  const [loadError, setLoadError] = useState('');

  const [conceptIds, setConceptIds] = useState<number[]>([]);
  const [length, setLength] = useState<BranchingLength>('standard');
  const [focus, setFocus] = useState('');
  const [useQuestions, setUseQuestions] = useState(true);

  const [elapsed, setElapsed] = useState(0);
  const abort = useRef<AbortController | null>(null);
  const [failure, setFailure] = useState<{ message: string; errors: string[] } | null>(null);
  const [draft, setDraft] = useState<{ scenario: BranchingScenarioSavePayload; report: BranchingReport } | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');

  // What the chapter offers. Read once, when the dialog opens.
  useEffect(() => {
    const controller = new AbortController();
    fetchBranchingSources(ctx, controller.signal)
      .then((result) => {
        if (!controller.signal.aborted) setSources(result);
      })
      .catch((err: unknown) => {
        if (!controller.signal.aborted) setLoadError(friendlyError(err, 'We couldn’t load this chapter’s topics and concepts. Please try again.'));
      });
    return () => controller.abort();
  }, [ctx]);

  // The clock on the waiting screen.
  useEffect(() => {
    if (phase !== 'working') return;
    const started = Date.now();
    const timer = window.setInterval(() => setElapsed(Math.floor((Date.now() - started) / 1000)), 1000);
    return () => window.clearInterval(timer);
  }, [phase]);

  const limit = sources?.sources.limits.max_concepts ?? 8;
  const toggleConcept = (id: number) =>
    setConceptIds((current) => (current.includes(id) ? current.filter((x) => x !== id) : current.length >= limit ? current : [...current, id]));

  const toggleTopic = (topicConceptIds: number[]) =>
    setConceptIds((current) => {
      const all = topicConceptIds.every((id) => current.includes(id));
      if (all) return current.filter((id) => !topicConceptIds.includes(id));
      const merged = [...current, ...topicConceptIds.filter((id) => !current.includes(id))];
      return merged.slice(0, limit);
    });

  const start = async () => {
    const controller = new AbortController();
    abort.current = controller;
    setPhase('working');
    setElapsed(0);
    setFailure(null);

    try {
      const result = await generateBranchingScenario(
        ctx,
        { topic_ids: [], concept_ids: conceptIds, focus: focus.trim(), length, use_questions: useQuestions },
        controller.signal
      );
      if (controller.signal.aborted) return;

      if (result.ok) {
        setDraft({ scenario: result.scenario, report: result.report });
        setPhase('review');
      } else {
        setFailure({ message: result.message, errors: result.errors });
        setPhase('failed');
      }
    } catch (err: unknown) {
      if (controller.signal.aborted) return;
      setFailure({ message: friendlyError(err, 'We couldn’t generate a scenario. Please try again.'), errors: [] });
      setPhase('failed');
    }
  };

  const cancel = () => {
    abort.current?.abort();
    setPhase('choose');
  };

  const save = async (thenEdit: boolean) => {
    if (!draft) return;
    setSaving(true);
    setSaveError('');
    try {
      const result = await branchingScenarioApi.create(ctx, draft.scenario as BranchingScenarioSavePayload & Record<string, unknown>);
      if (thenEdit && result.id) {
        router.push(`/h5p/h5p_branching_scenario/${result.id}/edit?${h5pContextQuery(ctx)}`);
        return;
      }
      onSaved('Saved as a draft. Open it to read it through, then publish it when you are happy with it.');
    } catch (err: unknown) {
      setSaveError(friendlyError(err, 'We couldn’t save the scenario. Please try again.'));
      setSaving(false);
    }
  };

  const playable = useMemo(() => (draft ? normalizeScenario(draft.scenario as unknown as RawScenario) : null), [draft]);

  return (
    <Dialog open onOpenChange={(next) => (!next && !saving ? (abort.current?.abort(), onClose()) : undefined)}>
      <DialogContent className="max-h-[92vh] w-[min(64rem,96vw)] max-w-none overflow-y-auto p-5 sm:p-7">
        <DialogHeader>
          <DialogTitle>Generate a branching scenario</DialogTitle>
          <DialogDescription>
            A decision-based lesson built from this chapter: a real situation, choices, the consequence of each explained, and different endings.
          </DialogDescription>
        </DialogHeader>

        {/* min-width 0: a dialog is a grid, and the story map is wider than any dialog; without this the map widens the whole panel and clips the player. */}
        <div style={{ minWidth: 0 }}>
        {phase === 'choose' ? (
          <Chooser
            sources={sources}
            loadError={loadError}
            limit={limit}
            conceptIds={conceptIds}
            toggleConcept={toggleConcept}
            toggleTopic={toggleTopic}
            clear={() => setConceptIds([])}
            length={length}
            setLength={setLength}
            focus={focus}
            setFocus={setFocus}
            useQuestions={useQuestions}
            setUseQuestions={setUseQuestions}
            onStart={() => void start()}
            onClose={onClose}
          />
        ) : null}

        {phase === 'working' ? (
          <div className="py-10 text-center" role="status" aria-live="polite">
            <Loader2 className="mx-auto h-8 w-8 animate-spin text-indigo-600" aria-hidden="true" />
            <p className="mt-4 text-sm font-semibold text-slate-900">Writing your scenario…</p>
            <p className="mx-auto mt-1 max-w-md text-xs text-slate-600">
              It reads the chapter, plans the paths, writes each step and checks every route. This usually takes two to ten minutes. Please keep this window open.
            </p>
            <p className="mt-3 text-xs tabular-nums text-slate-500">Time so far {formatElapsed(elapsed)}</p>
            <button type="button" onClick={cancel} className="mt-5 rounded-xl border border-slate-200 px-3.5 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50">
              Cancel
            </button>
          </div>
        ) : null}

        {phase === 'failed' && failure ? (
          <div className="space-y-4">
            <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900" role="alert">
              <p className="flex items-start gap-2 font-medium">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
                {failure.message}
              </p>
              {failure.errors.length > 0 ? (
                <ul className="mt-2 list-disc space-y-0.5 pl-6 text-xs">
                  {failure.errors.slice(0, 8).map((error) => (
                    <li key={error}>{error}</li>
                  ))}
                </ul>
              ) : null}
            </div>
            <p className="text-xs text-slate-600">Nothing was saved. You can try again, choose different concepts, or ask for a shorter scenario.</p>
            <div className="flex justify-end gap-2">
              <button type="button" onClick={onClose} className="rounded-xl border border-slate-200 px-3.5 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50">
                Close
              </button>
              <button type="button" onClick={() => setPhase('choose')} className="rounded-xl bg-indigo-600 px-3.5 py-2 text-xs font-semibold text-white hover:bg-indigo-700">
                Change and try again
              </button>
            </div>
          </div>
        ) : null}

        {phase === 'review' && draft && playable ? (
          <Review
            draft={draft}
            playable={playable}
            ctx={ctx}
            saving={saving}
            saveError={saveError}
            onSave={() => void save(false)}
            onSaveAndEdit={() => void save(true)}
            onRetry={() => setPhase('choose')}
            onDiscard={onClose}
          />
        ) : null}
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ---------------------------------------------------------------------------
// Step 1
// ---------------------------------------------------------------------------

function Chooser({
  sources,
  loadError,
  limit,
  conceptIds,
  toggleConcept,
  toggleTopic,
  clear,
  length,
  setLength,
  focus,
  setFocus,
  useQuestions,
  setUseQuestions,
  onStart,
  onClose,
}: {
  sources: BranchingSourcesResult | null;
  loadError: string;
  limit: number;
  conceptIds: number[];
  toggleConcept: (id: number) => void;
  toggleTopic: (ids: number[]) => void;
  clear: () => void;
  length: BranchingLength;
  setLength: (value: BranchingLength) => void;
  focus: string;
  setFocus: (value: string) => void;
  useQuestions: boolean;
  setUseQuestions: (value: boolean) => void;
  onStart: () => void;
  onClose: () => void;
}) {
  if (loadError) return <InlineBanner kind="error" message={loadError} />;
  if (!sources) {
    return (
      <div className="flex items-center justify-center gap-2 py-12 text-sm text-slate-500" role="status">
        <Loader2 className="h-4 w-4 animate-spin text-indigo-500" aria-hidden="true" />
        Reading the chapter…
      </div>
    );
  }

  const { chapter, topics, concepts } = sources.sources;
  const enabled = sources.generation.enabled && chapter.has_text;
  const reason = !sources.generation.enabled
    ? (sources.generation.reason ?? 'AI generation is not switched on for this chapter.')
    : !chapter.has_text
      ? 'This chapter has no chapter text yet, and every fact in a scenario has to come from it.'
      : '';
  const byId = new Map(concepts.map((c) => [c.id, c]));
  // When nearly every concept scores the same, "suits a scenario" tells the teacher nothing, so it is only shown if scores differ.
  const distinguishes = new Set(concepts.map((c) => c.suitability)).size > 2;

  return (
    <div className="space-y-5">
      <p className="text-xs text-slate-600">
        <span className="font-semibold text-slate-800">{chapter.name}</span> · {chapter.subject} · {chapter.standard}
      </p>

      {reason ? (
        <div className="flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs text-amber-900" role="alert">
          <Info className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
          {reason}
        </div>
      ) : null}

      <section aria-labelledby="gen-concepts">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h3 id="gen-concepts" className="text-sm font-semibold text-slate-900">
            What should it teach?
          </h3>
          <span className="text-xs text-slate-500" aria-live="polite">
            {conceptIds.length === 0 ? 'Nothing chosen: the concepts that suit a decision best will be picked.' : `${conceptIds.length} of ${limit} concepts chosen`}
            {conceptIds.length > 0 ? (
              <button type="button" onClick={clear} className="ml-2 font-semibold text-indigo-700 underline">
                Clear
              </button>
            ) : null}
          </span>
        </div>

        <div className="mt-2 max-h-72 space-y-3 overflow-y-auto rounded-xl border border-slate-200 p-3">
          {topics.map((topic) => {
            const list = topic.concept_ids.map((id) => byId.get(id)).filter((c): c is NonNullable<typeof c> => Boolean(c));
            if (list.length === 0) return null;
            const all = list.every((c) => conceptIds.includes(c.id));
            return (
              <fieldset key={topic.id} className="space-y-1">
                <legend className="flex w-full items-center gap-2 text-xs font-semibold text-slate-800">
                  <input
                    type="checkbox"
                    checked={all}
                    onChange={() => toggleTopic(list.map((c) => c.id))}
                    aria-label={`Choose every concept in ${topic.name}`}
                    className="h-4 w-4 rounded border-slate-300 text-indigo-600"
                  />
                  {topic.name}
                </legend>
                <ul className="ml-6 space-y-1">
                  {list.map((c) => {
                    const checked = conceptIds.includes(c.id);
                    const full = !checked && conceptIds.length >= limit;
                    return (
                      <li key={c.id}>
                        <label className={`flex items-start gap-2 text-xs ${full ? 'opacity-50' : ''}`}>
                          <input
                            type="checkbox"
                            checked={checked}
                            disabled={full}
                            onChange={() => toggleConcept(c.id)}
                            className="mt-0.5 h-4 w-4 shrink-0 rounded border-slate-300 text-indigo-600"
                          />
                          <span className="min-w-0 flex-1 text-slate-700">{c.name}</span>
                          <span className="flex shrink-0 gap-1">
                            {distinguishes && c.suitability >= 8 ? <Chip tone="good">Suits a scenario</Chip> : null}
                            {!c.has_material ? <Chip tone="warn">Little material</Chip> : null}
                            {c.questions > 0 ? <Chip>{c.questions} {c.questions === 1 ? 'question' : 'questions'}</Chip> : null}
                          </span>
                        </label>
                      </li>
                    );
                  })}
                </ul>
              </fieldset>
            );
          })}
        </div>
      </section>

      <section aria-labelledby="gen-length" className="grid gap-5 sm:grid-cols-2">
        <div>
          <h3 id="gen-length" className="text-sm font-semibold text-slate-900">
            How long?
          </h3>
          <div className="mt-2 space-y-1.5" role="radiogroup" aria-labelledby="gen-length">
            {LENGTHS.map((option) => (
              <label key={option.value} className={`flex cursor-pointer items-start gap-2 rounded-lg border px-3 py-2 text-xs ${length === option.value ? 'border-indigo-300 bg-indigo-50' : 'border-slate-200 hover:bg-slate-50'}`}>
                <input type="radio" name="gen-length" checked={length === option.value} onChange={() => setLength(option.value)} className="mt-0.5 text-indigo-600" />
                <span>
                  <span className="font-semibold text-slate-800">{option.label}</span>
                  <span className="block text-slate-500">{option.hint}</span>
                </span>
              </label>
            ))}
          </div>
        </div>

        <div className="space-y-3">
          <div>
            <label htmlFor="gen-focus" className="text-sm font-semibold text-slate-900">
              Anything it should be about? <span className="font-normal text-slate-500">(optional)</span>
            </label>
            <textarea
              id="gen-focus"
              value={focus}
              maxLength={400}
              rows={3}
              onChange={(e) => setFocus(e.target.value)}
              placeholder="For example: set it on a school sports day, or in a kitchen."
              className="mt-2 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-100"
            />
          </div>
          <label className="flex items-start gap-2 text-xs text-slate-700">
            <input type="checkbox" checked={useQuestions} onChange={(e) => setUseQuestions(e.target.checked)} className="mt-0.5 h-4 w-4 rounded border-slate-300 text-indigo-600" />
            <span>
              <span className="font-semibold">Use questions from the question bank as knowledge checks</span>
              <span className="block text-slate-500">Only questions that make sense on their own. They are copied word for word, never rewritten.</span>
            </span>
          </label>
        </div>
      </section>

      <p className="text-xs text-slate-500">
        It takes a few minutes. Nothing is saved until you have played it and chosen to save it, and a saved scenario is a draft that students cannot see.
      </p>

      <div className="flex justify-end gap-2">
        <button type="button" onClick={onClose} className="rounded-xl border border-slate-200 px-3.5 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50">
          Cancel
        </button>
        <button
          type="button"
          onClick={onStart}
          disabled={!enabled}
          className="inline-flex items-center gap-1.5 rounded-xl bg-indigo-600 px-4 py-2 text-xs font-semibold text-white transition hover:bg-indigo-700 disabled:opacity-50"
        >
          <Sparkles className="h-3.5 w-3.5" aria-hidden="true" />
          Generate
        </button>
      </div>
    </div>
  );
}

function Chip({ children, tone = 'plain' }: { children: ReactNode; tone?: 'plain' | 'good' | 'warn' }) {
  const style = tone === 'good' ? 'bg-emerald-50 text-emerald-700' : tone === 'warn' ? 'bg-amber-50 text-amber-700' : 'bg-slate-100 text-slate-600';
  return <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${style}`}>{children}</span>;
}

// ---------------------------------------------------------------------------
// Step 3
// ---------------------------------------------------------------------------

function Review({
  draft,
  playable,
  ctx,
  saving,
  saveError,
  onSave,
  onSaveAndEdit,
  onRetry,
  onDiscard,
}: {
  draft: { scenario: BranchingScenarioSavePayload; report: BranchingReport };
  playable: ReturnType<typeof normalizeScenario>;
  ctx: H5pContext;
  saving: boolean;
  saveError: string;
  onSave: () => void;
  onSaveAndEdit: () => void;
  onRetry: () => void;
  onDiscard: () => void;
}) {
  const { scenario, report } = draft;
  const s = report.stats;
  const [showMap, setShowMap] = useState(false);

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-lg font-semibold text-slate-900">{scenario.title}</h3>
        <p className="mt-1 text-sm text-slate-600">{scenario.description}</p>
      </div>

      <ul className="flex flex-wrap gap-2 text-xs" aria-label="What this scenario contains">
        {[
          `${s.nodes} steps`,
          `${s.decisions} decisions`,
          `${s.endings} endings`,
          `${s.paths_capped ? 'more than 5,000' : s.paths} possible paths`,
          `about ${estimateMinutes(playable)} min`,
          `${s.concepts_covered} of ${s.concepts} concepts taught`,
          s.bank_questions > 0 ? `${s.bank_questions} question${s.bank_questions === 1 ? '' : 's'} from the bank` : 'no bank questions used',
        ].map((fact) => (
          <li key={fact} className="rounded-full border border-slate-200 bg-white px-2.5 py-1 font-medium text-slate-700">
            {fact}
          </li>
        ))}
      </ul>

      <div className="flex items-start gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-2.5 text-xs text-emerald-900" role="status">
        <Check className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
        <span>
          Every path was checked: each choice leads somewhere, every step can be reached, and every path ends. <strong>Nothing has been saved yet.</strong> Play it below, then decide.
        </span>
      </div>

      {report.warnings.length > 0 ? (
        <Disclosure title={`${report.warnings.length} ${report.warnings.length === 1 ? 'note' : 'notes'} to look at`}>
          <ul className="list-disc space-y-1 pl-5 text-xs text-slate-700">
            {report.warnings.map((w) => (
              <li key={w}>{w}</li>
            ))}
          </ul>
        </Disclosure>
      ) : null}

      {report.suggestions.length > 0 ? (
        <Disclosure title={`${report.suggestions.length} places a picture would help`}>
          <p className="mb-2 text-xs text-slate-500">
            None are added for you, because a picture has to be one you have the right to use. Add them in the editor.
          </p>
          <ul className="space-y-1.5 text-xs text-slate-700">
            {report.suggestions.map((sg) => (
              <li key={sg.node}>
                <span className="font-semibold">{sg.title}.</span> {sg.idea}
              </li>
            ))}
          </ul>
        </Disclosure>
      ) : null}

      <div>
        <button type="button" onClick={() => setShowMap((v) => !v)} aria-expanded={showMap} className="inline-flex items-center gap-1 text-xs font-semibold text-indigo-700 hover:text-indigo-900">
          <ChevronDown className={`h-3.5 w-3.5 transition ${showMap ? 'rotate-180' : ''}`} aria-hidden="true" />
          {showMap ? 'Hide' : 'See'} the map of paths
        </button>
        {showMap ? (
          <div className="mt-2">
            <StoryMap scenario={scenario} selected={null} problems={new Set()} onSelect={() => undefined} />
          </div>
        ) : null}
      </div>

      <div className="rounded-2xl border border-slate-200 bg-[color:var(--h5p-surface-sunken,#f8fafc)] p-3 sm:p-5">
        <BranchingScenarioPlayer scenario={playable} contentId={null} ctx={ctx} preview embedded />
      </div>

      {saveError ? <InlineBanner kind="error" message={saveError} /> : null}

      <div className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-200 pt-4">
        <div className="flex gap-2">
          <button type="button" onClick={onDiscard} disabled={saving} className="rounded-xl border border-slate-200 px-3.5 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50 disabled:opacity-50">
            Discard
          </button>
          <button type="button" onClick={onRetry} disabled={saving} className="rounded-xl border border-slate-200 px-3.5 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50 disabled:opacity-50">
            Change and generate again
          </button>
        </div>
        <div className="flex gap-2">
          <button type="button" onClick={onSaveAndEdit} disabled={saving} className="rounded-xl border border-indigo-200 bg-indigo-50 px-3.5 py-2 text-xs font-semibold text-indigo-700 hover:bg-indigo-100 disabled:opacity-50">
            Save and edit
          </button>
          <button type="button" onClick={onSave} disabled={saving} className="inline-flex items-center gap-1.5 rounded-xl bg-indigo-600 px-4 py-2 text-xs font-semibold text-white hover:bg-indigo-700 disabled:opacity-50">
            {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" /> : null}
            Save as draft
          </button>
        </div>
      </div>
    </div>
  );
}

function Disclosure({ title, children }: { title: string; children: ReactNode }) {
  return (
    <details className="rounded-xl border border-slate-200 bg-white px-4 py-2.5">
      <summary className="cursor-pointer text-xs font-semibold text-slate-800">{title}</summary>
      <div className="mt-2">{children}</div>
    </details>
  );
}

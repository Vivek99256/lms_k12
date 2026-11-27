'use client';

import { CheckCircle2, Clock, Loader2, RefreshCw, XCircle } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { assessFairTest, type Trial } from '@/lib/virtual-lab/sim/dissolving';
import type { LabConfig, LabSnapshot } from '@/lib/virtual-lab/types';
import type { LabEvaluation, LabNotebook, LabProgress } from '@/app/pal/data/pal-virtual-lab';

import { DrawingPad } from './DrawingPad';

/**
 * The stages that are not the 3D bench: mission, prediction, comparing results,
 * the notebook, the questions and the feedback. Each takes the saved progress
 * and a patch function; none of them touches the simulation.
 */

const FIELD =
  'w-full rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-sm text-slate-900 placeholder:text-slate-400 focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500 disabled:bg-slate-50';

const PRIMARY = 'bg-sky-700 text-sm font-semibold text-white hover:bg-sky-800';

function Heading({ children, sub }: { children: React.ReactNode; sub?: string }) {
  return (
    <div className="space-y-1">
      <h2 className="text-lg font-bold text-slate-900">{children}</h2>
      {sub ? <p className="text-sm text-slate-600">{sub}</p> : null}
    </div>
  );
}

function Bullets({ items }: { items: string[] }) {
  return (
    <ul className="list-disc space-y-1 pl-5 text-sm text-slate-700">
      {items.map((item, i) => (
        <li key={i}>{item}</li>
      ))}
    </ul>
  );
}

// --- 1. Mission ---------------------------------------------------------------------

export function IntroPanel({ config, resumed, onStart }: { config: LabConfig; resumed: boolean; onStart: () => void }) {
  return (
    <div className="space-y-5">
      <Heading sub={config.subtitle}>{config.title}</Heading>
      <section className="space-y-1">
        <h3 className="text-xs font-bold uppercase tracking-wide text-slate-500">Your role</h3>
        <p className="text-sm text-slate-700">{config.scenario}</p>
      </section>
      <section className="space-y-1">
        <h3 className="text-xs font-bold uppercase tracking-wide text-slate-500">Your mission</h3>
        <p className="text-sm font-semibold text-slate-900">{config.mission}</p>
      </section>
      <section className="space-y-1">
        <h3 className="text-xs font-bold uppercase tracking-wide text-slate-500">You will learn to</h3>
        <Bullets items={config.objectives} />
      </section>
      <div className="flex flex-wrap items-center gap-2">
        {config.vocabulary.map((word) => (
          <span key={word} className="rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-medium text-emerald-800">
            {word}
          </span>
        ))}
      </div>
      <p className="flex items-center gap-1.5 text-xs text-slate-500">
        <Clock className="h-3.5 w-3.5" aria-hidden />
        About {config.estimatedMinutes} minutes. You can leave and come back: your work is saved.
      </p>
      <Button onClick={onStart} className={PRIMARY}>
        {resumed ? 'Continue my lab' : 'Start the investigation'}
      </Button>
    </div>
  );
}

// --- 2. Prediction ------------------------------------------------------------------

export function PredictPanel({
  config,
  progress,
  update,
  locked,
  onNext,
}: {
  config: LabConfig;
  progress: LabProgress;
  update: (patch: Partial<LabProgress>) => void;
  locked: boolean;
  onNext: () => void;
}) {
  const choice = progress.prediction.choice;
  return (
    <div className="space-y-5">
      <Heading sub="A prediction is a careful guess. There is no wrong answer yet: the experiment will give you evidence.">
        {config.prediction.prompt}
      </Heading>
      <div role="radiogroup" aria-label="Your prediction" className="grid gap-2 sm:grid-cols-3">
        {config.prediction.options.map((o) => (
          <button
            key={o.id}
            type="button"
            role="radio"
            aria-checked={choice === o.id}
            disabled={locked}
            onClick={() => update({ prediction: { ...progress.prediction, choice: o.id } })}
            className={`rounded-xl border-2 px-4 py-4 text-left text-sm font-semibold transition ${
              choice === o.id ? 'border-sky-600 bg-sky-50 text-sky-900' : 'border-slate-200 bg-white text-slate-700 hover:border-sky-300'
            }`}
          >
            {o.label}
          </button>
        ))}
      </div>
      <label className="block space-y-1">
        <span className="text-sm font-semibold text-slate-800">
          Why do you think so?{config.prediction.reasonRequired ? '' : ' (optional)'}
        </span>
        <textarea
          rows={3}
          value={progress.prediction.reason}
          disabled={locked}
          onChange={(e) => update({ prediction: { ...progress.prediction, reason: e.target.value } })}
          className={FIELD}
          placeholder="Because…"
        />
      </label>
      <Button
        onClick={onNext}
        disabled={!choice || (!!config.prediction.reasonRequired && progress.prediction.reason.trim().length < 8)}
        className={PRIMARY}
      >
        Save my prediction and go to the lab
      </Button>
      {config.prediction.reasonRequired && choice && progress.prediction.reason.trim().length < 8 ? (
        <p className="text-xs text-slate-500">Write a few words about why you think so.</p>
      ) : null}
    </div>
  );
}

// --- 5. Compare ---------------------------------------------------------------------

export function ComparePanel({
  config,
  progress,
  snap,
  onBack,
  onNext,
}: {
  config: LabConfig;
  progress: LabProgress;
  snap: LabSnapshot | null;
  onBack: () => void;
  onNext: () => void;
}) {
  // A lab that hands over its own results (columns, rows, fairness checks) is shown as given.
  if (snap?.results) {
    const r = snap.results;
    const predictedLabel = config.prediction.options.find((o) => o.id === progress.prediction.choice)?.label;
    return (
      <div className="space-y-5">
        <Heading sub="This is what your experiment recorded. Look at it carefully before you fill in your observation table.">Your results</Heading>
        {predictedLabel ? (
          <p className="rounded-lg bg-slate-50 px-3 py-2 text-sm text-slate-700">
            You predicted: <strong>{predictedLabel}</strong>
          </p>
        ) : null}
        <div className="overflow-x-auto rounded-lg border border-slate-200">
          <table className="w-full min-w-[420px] border-collapse text-sm">
            <thead>
              <tr className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
                <th className="px-3 py-2" />
                {r.columns.map((c) => (
                  <th key={c} className="px-3 py-2">
                    {c}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {r.rows.map((row) => (
                <tr key={row.label} className="border-t border-slate-100">
                  <td className="px-3 py-2 font-semibold text-slate-800">{row.label}</td>
                  {row.values.map((v, i) => (
                    <td key={i} className="px-3 py-2">
                      {v}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {r.note ? <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">{r.note}</p> : null}
        {r.checks.length > 0 ? (
          <section className="space-y-2">
            <h3 className="text-xs font-bold uppercase tracking-wide text-slate-500">Was it a fair test?</h3>
            <ul className="space-y-1.5">
              {r.checks.map((c) => (
                <li key={c.id} className="flex items-start gap-2 text-sm text-slate-700">
                  {c.ok ? (
                    <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" aria-hidden />
                  ) : (
                    <XCircle className="mt-0.5 h-4 w-4 shrink-0 text-rose-600" aria-hidden />
                  )}
                  <span>{c.text}</span>
                </li>
              ))}
            </ul>
          </section>
        ) : null}
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={onBack} className="text-sm">
            Back to the lab
          </Button>
          <Button onClick={onNext} className={PRIMARY}>
            Fill in my observation table
          </Button>
        </div>
      </div>
    );
  }

  const trials = Object.values((snap?.trials ?? {}) as Record<string, Trial>)
    .filter((t) => t.firstSugarAt !== null)
    .sort((a, b) => (a.tempC ?? 0) - (b.tempC ?? 0));
  const fair = assessFairTest(trials);
  const maxTime = Math.max(1, ...trials.map((t) => t.dissolveSeconds ?? 0));
  const predicted = config.prediction.options.find((o) => o.id === progress.prediction.choice)?.label;

  return (
    <div className="space-y-5">
      <Heading sub="This is what your experiment recorded. Look at it carefully before you write your notebook.">
        Compare your results
      </Heading>
      {predicted ? (
        <p className="rounded-lg bg-slate-50 px-3 py-2 text-sm text-slate-700">
          You predicted: <strong>{predicted}</strong>
        </p>
      ) : null}

      {trials.length === 0 ? (
        <p className="text-sm text-slate-600">No sugar was added yet, so there are no results. Go back to the lab.</p>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-slate-200">
          <table className="w-full min-w-[480px] border-collapse text-sm">
            <thead>
              <tr className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
                <th className="px-3 py-2">Beaker</th>
                <th className="px-3 py-2">Water temp</th>
                <th className="px-3 py-2">Water</th>
                <th className="px-3 py-2">Sugar</th>
                <th className="px-3 py-2">Time to dissolve</th>
              </tr>
            </thead>
            <tbody>
              {trials.map((t) => (
                <tr key={t.beakerId} className="border-t border-slate-100">
                  <td className="px-3 py-2 font-semibold text-slate-800">{t.beakerId.replace('beaker', 'Beaker ')}</td>
                  <td className="px-3 py-2">{t.tempC !== null ? `${t.tempC} °C` : '–'}</td>
                  <td className="px-3 py-2">{t.waterMl !== null ? `${t.waterMl} mL` : '–'}</td>
                  <td className="px-3 py-2">{t.sugarG.toFixed(1)} g</td>
                  <td className="px-3 py-2">
                    {t.dissolveSeconds !== null ? (
                      <div className="space-y-1">
                        <span className="font-semibold">{t.dissolveSeconds} s</span>
                        <div className="h-2 rounded bg-slate-100">
                          <div
                            className="h-2 rounded bg-sky-600"
                            style={{ width: `${Math.max(4, (t.dissolveSeconds / maxTime) * 100)}%` }}
                          />
                        </div>
                      </div>
                    ) : (
                      <span className="text-amber-700">still dissolving</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {fair.ready ? (
        <section className="space-y-2">
          <h3 className="text-xs font-bold uppercase tracking-wide text-slate-500">Was it a fair test?</h3>
          <ul className="space-y-1.5">
            {fair.checks.map((c) => (
              <li key={c.id} className="flex items-start gap-2 text-sm text-slate-700">
                {c.ok ? (
                  <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" aria-hidden />
                ) : (
                  <XCircle className="mt-0.5 h-4 w-4 shrink-0 text-rose-600" aria-hidden />
                )}
                <span>{c.text}</span>
              </li>
            ))}
          </ul>
          {!fair.fair ? (
            <p className="text-sm text-amber-800">
              Some things were not controlled. You can go back and run the experiment again with a fresh set-up.
            </p>
          ) : null}
        </section>
      ) : null}

      <div className="flex flex-wrap gap-2">
        <Button variant="outline" onClick={onBack} className="text-sm">
          Back to the lab
        </Button>
        <Button onClick={onNext} disabled={trials.length === 0} className={PRIMARY}>
          Open my notebook
        </Button>
      </div>
    </div>
  );
}

// --- 6. Notebook --------------------------------------------------------------------

export function NotebookPanel({
  config,
  progress,
  update,
  locked,
  onNext,
}: {
  config: LabConfig;
  progress: LabProgress;
  update: (patch: Partial<LabProgress>) => void;
  locked: boolean;
  onNext: () => void;
}) {
  const nb = progress.notebook;
  const set = (patch: Partial<LabNotebook>) => update({ notebook: { ...nb, ...patch } });
  const setCell = (r: number, c: number, v: string) => {
    const table = nb.table.map((row) => [...row]);
    if (!table[r]) return;
    table[r][c] = v;
    set({ table });
  };
  const beakerCols = config.notebookColumns.slice(1);

  return (
    <div className="space-y-5">
      <Heading sub="Write down what you saw and measured in your own words and numbers. Your teacher will read this.">
        Your lab notebook
      </Heading>

      <section className="space-y-2">
        <h3 className="text-xs font-bold uppercase tracking-wide text-slate-500">Measurements</h3>
        <div className="overflow-x-auto rounded-lg border border-slate-200">
          <table className="w-full min-w-[420px] border-collapse text-sm">
            <thead>
              <tr className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
                <th className="px-3 py-2">{config.notebookColumns[0]}</th>
                {beakerCols.map((c) => (
                  <th key={c} className="px-3 py-2">
                    {c}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {config.notebookRows.map((label, r) => (
                <tr key={label} className="border-t border-slate-100">
                  <td className="px-3 py-1.5 font-medium text-slate-700">{label}</td>
                  {beakerCols.map((c, col) => (
                    <td key={c} className="p-1">
                      <input
                        value={nb.table[r]?.[col] ?? ''}
                        disabled={locked}
                        onChange={(e) => setCell(r, col, e.target.value)}
                        aria-label={`${label}, ${c}`}
                        className={FIELD}
                      />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="grid gap-3 sm:grid-cols-2">
        {beakerCols.map((c, i) => (
          <label key={c} className="block space-y-1">
            <span className="text-sm font-semibold text-slate-800">What did you observe in {c}?</span>
            <textarea
              rows={4}
              value={i === 0 ? nb.observationA : nb.observationB}
              disabled={locked}
              onChange={(e) => set(i === 0 ? { observationA: e.target.value } : { observationB: e.target.value })}
              className={FIELD}
              placeholder={config.observationPlaceholder}
            />
          </label>
        ))}
      </section>

      <label className="block space-y-1">
        <span className="text-sm font-semibold text-slate-800">How do the two beakers compare?</span>
        <textarea
          rows={3}
          value={nb.comparison}
          disabled={locked}
          onChange={(e) => set({ comparison: e.target.value })}
          className={FIELD}
        />
      </label>

      <section className="space-y-2">
        <h3 className="text-sm font-semibold text-slate-800">
          {config.diagramPrompt}
        </h3>
        <DrawingPad value={nb.diagram} onChange={(diagram) => set({ diagram })} disabled={locked} />
      </section>

      <Button onClick={onNext} className={PRIMARY}>
        Go to the questions
      </Button>
    </div>
  );
}

// --- 7. Questions -------------------------------------------------------------------

const SKILL_LABEL: Record<string, string> = {
  what: 'WHAT',
  how: 'HOW',
  why: 'WHY',
  variable: 'VARIABLES',
  evidence: 'EVIDENCE',
};

export function AssessPanel({
  config,
  progress,
  update,
  locked,
  onNext,
}: {
  config: LabConfig;
  progress: LabProgress;
  update: (patch: Partial<LabProgress>) => void;
  locked: boolean;
  onNext: () => void;
}) {
  const setAnswer = (id: string, value: string | string[]) => update({ answers: { ...progress.answers, [id]: value } });
  const answered = config.questions.every((q) => {
    const a = progress.answers[q.id];
    return Array.isArray(a) ? a.length > 0 : (a ?? '').trim() !== '';
  });

  return (
    <div className="space-y-5">
      <Heading sub="A WHAT question asks what you saw. A HOW or WHY question asks you to explain it with science. Use your evidence.">
        Think like a scientist
      </Heading>
      <div className="space-y-5">
        {config.questions.map((q, index) => (
          <fieldset key={q.id} className="space-y-2">
            <legend className="text-sm font-semibold text-slate-900">
              <span className="mr-2 rounded bg-sky-100 px-1.5 py-0.5 text-[10px] font-bold text-sky-800">
                {SKILL_LABEL[q.skill]}
              </span>
              {index + 1}. {q.prompt}
            </legend>
            {q.type === 'text' ? (
              <textarea
                rows={3}
                value={(progress.answers[q.id] as string) ?? ''}
                disabled={locked}
                onChange={(e) => setAnswer(q.id, e.target.value)}
                className={FIELD}
                placeholder="Write your answer…"
              />
            ) : null}
            {q.type === 'choice'
              ? q.options?.map((o) => (
                  <label key={o.id} className="flex items-center gap-2 text-sm text-slate-700">
                    <input
                      type="radio"
                      name={q.id}
                      checked={progress.answers[q.id] === o.id}
                      disabled={locked}
                      onChange={() => setAnswer(q.id, o.id)}
                    />
                    {o.label}
                  </label>
                ))
              : null}
            {q.type === 'multi'
              ? q.options?.map((o) => {
                  const current = (progress.answers[q.id] as string[] | undefined) ?? [];
                  return (
                    <label key={o.id} className="flex items-center gap-2 text-sm text-slate-700">
                      <input
                        type="checkbox"
                        checked={current.includes(o.id)}
                        disabled={locked}
                        onChange={() => setAnswer(q.id, current.includes(o.id) ? current.filter((x) => x !== o.id) : [...current, o.id])}
                      />
                      {o.label}
                    </label>
                  );
                })
              : null}
          </fieldset>
        ))}
      </div>

      <label className="block space-y-1">
        <span className="text-sm font-semibold text-slate-900">
          <span className="mr-2 rounded bg-emerald-100 px-1.5 py-0.5 text-[10px] font-bold text-emerald-800">CONCLUSION</span>
          {config.conclusionPrompt}
        </span>
        <textarea
          rows={4}
          value={progress.conclusion}
          disabled={locked}
          onChange={(e) => update({ conclusion: e.target.value })}
          className={FIELD}
        />
      </label>

      <Button onClick={onNext} disabled={!answered} className={PRIMARY}>
        Review my work
      </Button>
      {!answered ? <p className="text-xs text-slate-500">Answer every question to continue.</p> : null}
    </div>
  );
}

// --- 8. Feedback --------------------------------------------------------------------

export function FeedbackPanel({
  config,
  progress,
  evaluation,
  submitted,
  persisted,
  busy,
  message,
  onSubmit,
  onBack,
}: {
  config: LabConfig;
  progress: LabProgress;
  evaluation: LabEvaluation | null;
  submitted: boolean;
  persisted: boolean;
  busy: boolean;
  message: string | null;
  onSubmit: () => void;
  onBack: () => void;
}) {
  if (!submitted) {
    const answered = config.questions.filter((q) => {
      const a = progress.answers[q.id];
      return Array.isArray(a) ? a.length > 0 : (a ?? '').trim() !== '';
    }).length;
    return (
      <div className="space-y-5">
        <Heading sub="Read through what you are handing in. After you submit you cannot change it.">Review and submit</Heading>
        <ul className="space-y-1 text-sm text-slate-700">
          <li>Prediction: {config.prediction.options.find((o) => o.id === progress.prediction.choice)?.label ?? 'not chosen'}</li>
          <li>Notebook observations: {progress.notebook.observationA.trim() || progress.notebook.observationB.trim() ? 'written' : 'empty'}</li>
          <li>Diagram: {progress.notebook.diagram ? 'drawn' : 'none'}</li>
          <li>
            Questions answered: {answered} of {config.questions.length}
          </li>
          <li>Conclusion: {progress.conclusion.trim() ? 'written' : 'empty'}</li>
        </ul>
        {!persisted ? (
          <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
            Submitting is not available yet because the server cannot store lab work. Your work is kept in this browser.
          </p>
        ) : null}
        {message ? <p className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-800">{message}</p> : null}
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={onBack} disabled={busy} className="text-sm">
            Back to the questions
          </Button>
          <Button onClick={onSubmit} disabled={busy || !persisted} className="gap-1.5 bg-emerald-700 text-sm font-semibold text-white hover:bg-emerald-800">
            {busy ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : null}
            {busy ? 'Submitting and marking…' : 'Submit my investigation'}
          </Button>
        </div>
      </div>
    );
  }

  const e = evaluation;
  return (
    <div className="space-y-5" aria-live="polite">
      <div className="flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm font-semibold text-emerald-900">
        <CheckCircle2 className="h-4 w-4" aria-hidden /> Investigation submitted.
      </div>
      {!e ? (
        <div className="space-y-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-3 text-sm text-slate-700">
          <p>Your work is saved, but the marking is not ready yet.</p>
          {message ? <p className="text-rose-700">{message}</p> : null}
          <Button variant="outline" onClick={onSubmit} disabled={busy} className="gap-1.5 text-sm">
            {busy ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <RefreshCw className="h-4 w-4" aria-hidden />}
            Get my feedback
          </Button>
        </div>
      ) : (
        <>
          <div className="rounded-lg border border-sky-200 bg-sky-50 px-4 py-3">
            <p className="text-3xl font-bold text-sky-900">{e.scorePercent}%</p>
            <p className="text-sm text-sky-800">
              {e.pointsAwarded} of {e.maxPoints} points
            </p>
          </div>

          {e.prediction ? (
            <p className="text-sm text-slate-700">
              Your prediction (<strong>{config.prediction.options.find((o) => o.id === e.prediction?.choice)?.label}</strong>)
              {e.prediction.outcome === 'matched'
                ? ' matched what the experiment showed.'
                : e.prediction.outcome === 'different'
                  ? ' was different from what the experiment showed. That is useful: scientists learn from surprises.'
                  : ' could not be compared with the results.'}
            </p>
          ) : null}

          {e.experimentChecks.length > 0 ? (
            <section className="space-y-2">
              <h3 className="text-xs font-bold uppercase tracking-wide text-slate-500">Your experiment set-up (recorded by the simulation)</h3>
              <ul className="space-y-1.5">
                {e.experimentChecks.map((c) => (
                  <li key={c.id} className="flex items-start gap-2 text-sm text-slate-700">
                    {c.ok ? (
                      <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" aria-hidden />
                    ) : (
                      <XCircle className="mt-0.5 h-4 w-4 shrink-0 text-rose-600" aria-hidden />
                    )}
                    {c.text}
                  </li>
                ))}
              </ul>
            </section>
          ) : null}

          <section className="space-y-2">
            <h3 className="text-xs font-bold uppercase tracking-wide text-slate-500">How you did on each part</h3>
            {e.criteria.map((c) => (
              <div key={c.criterion} className="rounded-lg border border-slate-200 px-3 py-2 text-sm">
                <p className="font-semibold text-slate-800">
                  {c.criterion} <span className="font-normal text-slate-500">{c.pointsAwarded} / {c.maxPoints}</span>
                </p>
                {c.comment ? <p className="mt-0.5 text-slate-600">{c.comment}</p> : null}
              </div>
            ))}
          </section>

          {e.feedback ? <p className="text-sm text-slate-700">{e.feedback}</p> : null}
          {e.wentWell.length > 0 ? (
            <section className="space-y-1">
              <h3 className="text-xs font-bold uppercase tracking-wide text-slate-500">What you did well</h3>
              <Bullets items={e.wentWell} />
            </section>
          ) : null}
          {e.incorrectOrUnclear.length > 0 ? (
            <section className="space-y-1">
              <h3 className="text-xs font-bold uppercase tracking-wide text-slate-500">Needs another look</h3>
              <Bullets items={e.incorrectOrUnclear} />
            </section>
          ) : null}
          {e.misconceptions.length > 0 ? (
            <section className="space-y-1">
              <h3 className="text-xs font-bold uppercase tracking-wide text-slate-500">Ideas to clear up</h3>
              <Bullets items={e.misconceptions} />
            </section>
          ) : null}
          {e.improvements.length > 0 ? (
            <section className="space-y-1">
              <h3 className="text-xs font-bold uppercase tracking-wide text-slate-500">How to improve</h3>
              <Bullets items={e.improvements} />
            </section>
          ) : null}
          {e.nextAction ? <p className="text-sm text-slate-700"><strong>Next step:</strong> {e.nextAction}</p> : null}
          <p className="text-xs text-slate-500">{e.evidenceStatement}</p>
        </>
      )}
    </div>
  );
}

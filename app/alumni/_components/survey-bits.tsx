'use client';

import { useState, type FormEvent } from 'react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { alumniApi, AlumniApiError, type SurveyQuestion } from '../_lib/alumni-api';
import { AudienceFilters, type AudienceValue } from './audience';
import { Banner, FormField, Panel, humanize, inputClass } from './alumni-ui';

const TONE: Record<string, string> = {
  draft: 'bg-slate-100 text-slate-600 ring-slate-200', published: 'bg-emerald-50 text-emerald-800 ring-emerald-200', closed: 'bg-blue-50 text-blue-800 ring-blue-200',
};
export function SurveyStatus({ value }: { value: string }) {
  return <span className={cn('inline-flex rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset', TONE[value] ?? TONE.draft)}>{humanize(value)}</span>;
}

export const QUESTION_TYPES: [string, string][] = [
  ['text', 'Free text'], ['single_choice', 'Single choice'], ['multiple_choice', 'Multiple choice'], ['rating', 'Rating (1–5)'], ['yes_no', 'Yes / No'], ['scale', 'Number scale'],
];
const needsOptions = (t: string) => t === 'single_choice' || t === 'multiple_choice';

type DraftQuestion = { question_type: string; prompt: string; optionsText: string; required: boolean; scale_min: string; scale_max: string };
const blankQuestion = (): DraftQuestion => ({ question_type: 'text', prompt: '', optionsText: '', required: true, scale_min: '1', scale_max: '10' });
const fromQuestion = (q: SurveyQuestion): DraftQuestion => ({
  question_type: q.question_type, prompt: q.prompt, optionsText: q.options.join('\n'), required: !!q.required, scale_min: String(q.scale_min ?? 1), scale_max: String(q.scale_max ?? 10),
});

export function SurveyForm({ types, surveyId, initial, questions, locked, onSaved }: {
  types: { key: string; label: string }[]; surveyId?: number; locked?: boolean; onSaved: () => void; questions?: SurveyQuestion[];
  initial?: { title: string; survey_type: string; description: string; anonymous: boolean; opens_at: string; closes_at: string; audience?: AudienceValue };
}) {
  const [f, setF] = useState(initial ?? { title: '', survey_type: 'alumni_satisfaction', description: '', anonymous: false, opens_at: '', closes_at: '' });
  const [audience, setAudience] = useState<AudienceValue>(initial?.audience ?? {});
  const [qs, setQs] = useState<DraftQuestion[]>(questions?.length ? questions.map(fromQuestion) : [blankQuestion()]);
  const [errors, setErrors] = useState<Record<string, string[]>>({});
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const setQ = (i: number, patch: Partial<DraftQuestion>) => setQs((list) => list.map((q, idx) => (idx === i ? { ...q, ...patch } : q)));

  async function submit(event: FormEvent) {
    event.preventDefault();
    setErrors({}); setError('');
    const missing: Record<string, string[]> = {};
    if (!f.title.trim()) missing.title = ['Give the survey a title.'];
    const filled = qs.filter((q) => q.prompt.trim());
    if (!locked && filled.length === 0) missing.questions = ['Add at least one question.'];
    for (const q of filled) if (needsOptions(q.question_type) && q.optionsText.split('\n').filter((o) => o.trim()).length < 2) { missing.questions = [`“${q.prompt}” needs at least two options, one per line.`]; break; }
    if (Object.keys(missing).length) { setErrors(missing); return; }
    setBusy(true);
    try {
      const body: Record<string, unknown> = {
        title: f.title.trim(), survey_type: f.survey_type, description: f.description || null, anonymous: f.anonymous,
        opens_at: f.opens_at ? f.opens_at.replace('T', ' ') : null, closes_at: f.closes_at ? f.closes_at.replace('T', ' ') : null,
        filters: Object.keys(audience).length ? audience : {},
      };
      if (!locked) {
        body.questions = filled.map((q) => ({
          question_type: q.question_type, prompt: q.prompt.trim(), required: q.required,
          options: needsOptions(q.question_type) ? q.optionsText.split('\n').map((o) => o.trim()).filter(Boolean) : [],
          ...(q.question_type === 'scale' ? { scale_min: Number(q.scale_min), scale_max: Number(q.scale_max) } : {}),
        }));
      }
      await alumniApi.saveSurvey(body, surveyId);
      onSaved();
    } catch (reason) {
      if (reason instanceof AlumniApiError) { setErrors(reason.fieldErrors); setError(reason.message); } else setError("Couldn't save the survey. Try again.");
    } finally { setBusy(false); }
  }

  return (
    <Panel title={surveyId ? 'Edit survey' : 'New survey'}>
      <form onSubmit={submit} noValidate className="space-y-4">
        {error ? <Banner>{error}</Banner> : null}
        {locked ? <Banner tone="info">This survey already has responses, so its questions are locked. You can still change the title, dates and audience.</Banner> : null}
        <div className="grid gap-4 md:grid-cols-3">
          <div className="md:col-span-2"><FormField label="Title" required error={errors.title?.[0]}><input className={inputClass} value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} /></FormField></div>
          <FormField label="Type" required error={errors.survey_type?.[0]}><select className={inputClass} value={f.survey_type} onChange={(e) => setF({ ...f, survey_type: e.target.value })}>{types.map((t) => <option key={t.key} value={t.key}>{t.label}</option>)}</select></FormField>
          <FormField label="Opens" error={errors.opens_at?.[0]}><input className={inputClass} type="datetime-local" value={f.opens_at} onChange={(e) => setF({ ...f, opens_at: e.target.value })} /></FormField>
          <FormField label="Closes" error={errors.closes_at?.[0]}><input className={inputClass} type="datetime-local" value={f.closes_at} onChange={(e) => setF({ ...f, closes_at: e.target.value })} /></FormField>
          <label className="flex items-center gap-2 pt-6 text-sm text-slate-700"><input type="checkbox" checked={f.anonymous} disabled={locked} onChange={(e) => setF({ ...f, anonymous: e.target.checked })} /> Anonymous (answers are not linked to a person)</label>
          <div className="md:col-span-3"><FormField label="Introduction"><textarea className={inputClass + ' h-20 py-2'} value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} /></FormField></div>
        </div>
        <div>
          <h3 className="mb-2 text-sm font-medium text-slate-700">Who should be asked?</h3>
          <AudienceFilters value={audience} onChange={setAudience} />
        </div>
        <fieldset disabled={locked} className="space-y-3">
          <legend className="text-sm font-medium text-slate-700">Questions</legend>
          {errors.questions?.[0] ? <p className="text-xs text-red-700" role="alert">{errors.questions[0]}</p> : null}
          {qs.map((q, i) => (
            <div key={i} className="rounded-md border border-slate-200 p-3">
              <div className="grid gap-3 md:grid-cols-4">
                <div className="md:col-span-2"><FormField label={`Question ${i + 1}`}><input className={inputClass} value={q.prompt} onChange={(e) => setQ(i, { prompt: e.target.value })} /></FormField></div>
                <FormField label="Answer type"><select className={inputClass} value={q.question_type} onChange={(e) => setQ(i, { question_type: e.target.value })}>{QUESTION_TYPES.map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select></FormField>
                <label className="flex items-center gap-2 pt-6 text-sm text-slate-700"><input type="checkbox" checked={q.required} onChange={(e) => setQ(i, { required: e.target.checked })} /> Required</label>
                {needsOptions(q.question_type) ? <div className="md:col-span-4"><FormField label="Options (one per line)"><textarea className={inputClass + ' h-20 py-2'} value={q.optionsText} onChange={(e) => setQ(i, { optionsText: e.target.value })} /></FormField></div> : null}
                {q.question_type === 'scale' ? <>
                  <FormField label="From"><input className={inputClass} type="number" value={q.scale_min} onChange={(e) => setQ(i, { scale_min: e.target.value })} /></FormField>
                  <FormField label="To"><input className={inputClass} type="number" value={q.scale_max} onChange={(e) => setQ(i, { scale_max: e.target.value })} /></FormField>
                </> : null}
              </div>
              {qs.length > 1 ? <Button type="button" size="sm" variant="ghost" className="mt-2" aria-label={`Remove question ${i + 1}`} onClick={() => setQs((list) => list.filter((_, idx) => idx !== i))}>Remove</Button> : null}
            </div>
          ))}
          <Button type="button" variant="outline" size="sm" onClick={() => setQs((list) => [...list, blankQuestion()])}>Add question</Button>
        </fieldset>
        <Button type="submit" className="h-9" disabled={busy}>{surveyId ? 'Save changes' : 'Create survey'}</Button>
      </form>
    </Panel>
  );
}

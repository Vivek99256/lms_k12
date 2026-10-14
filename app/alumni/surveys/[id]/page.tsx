'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { alumniApi, type CommMeta, type SurveyDetail, type SurveyResults } from '../../_lib/alumni-api';
import { AlumniPicker, type Picked } from '../../_components/entity-picker';
import { ChannelPicker } from '../../_components/audience';
import { SurveyForm, SurveyStatus } from '../../_components/survey-bits';
import { Banner, FormField, LoadingBlock, MetricTile, PageFrame, Panel, ProgressBar, formatDate, humanize, inputClass } from '../../_components/alumni-ui';

const TABS = [['overview', 'Overview'], ['results', 'Results'], ['participation', 'Participation']] as const;
type Tab = (typeof TABS)[number][0];

export default function SurveyDetailPage() {
  const params = useParams<{ id: string }>();
  const id = Number(params.id);
  const [tab, setTab] = useState<Tab>('overview');
  const [detail, setDetail] = useState<SurveyDetail | null>(null);
  const [types, setTypes] = useState<{ key: string; label: string }[]>([]);
  const [error, setError] = useState('');

  const load = useCallback((signal?: AbortSignal) => alumniApi.survey(id, signal).then((d) => { setDetail(d); setError(''); }).catch((reason: unknown) => {
    if (reason instanceof DOMException && reason.name === 'AbortError') return;
    setError(reason instanceof Error ? reason.message : "Couldn't load the survey. Try again.");
  }), [id]);
  useEffect(() => {
    const c = new AbortController();
    void load(c.signal);
    alumniApi.surveys({}, c.signal).then((r) => setTypes(r.types)).catch(() => undefined);
    return () => c.abort();
  }, [load]);

  if (!detail) return <PageFrame title="Survey">{error ? <Banner>{error}</Banner> : <LoadingBlock label="Loading survey…" />}</PageFrame>;
  const s = detail.survey;
  return (
    <PageFrame title={s.title} description={`${humanize(s.survey_type)}${s.anonymous ? ' · anonymous' : ''}`}
      actions={<><SurveyStatus value={s.status} /><Link href="/alumni/surveys" className="ml-3 text-sm text-indigo-700 hover:underline">All surveys</Link></>}>
      <div role="tablist" aria-label="Survey sections" className="flex gap-1 border-b border-slate-200">
        {TABS.map(([key, label]) => (
          <button key={key} role="tab" type="button" aria-selected={tab === key} onClick={() => setTab(key)}
            className={cn('border-b-2 px-3 py-2 text-sm font-medium', tab === key ? 'border-indigo-600 text-indigo-700' : 'border-transparent text-slate-600 hover:text-slate-900')}>{label}</button>
        ))}
      </div>
      {tab === 'overview' ? <Overview detail={detail} types={types} onChanged={() => void load()} /> : null}
      {tab === 'results' ? <Results id={id} /> : null}
      {tab === 'participation' ? <Participation detail={detail} onChanged={() => void load()} /> : null}
    </PageFrame>
  );
}

function Overview({ detail, types, onChanged }: { detail: SurveyDetail; types: { key: string; label: string }[]; onChanged: () => void }) {
  const s = detail.survey;
  const [editing, setEditing] = useState(false);
  const [meta, setMeta] = useState<CommMeta | null>(null);
  const [channels, setChannels] = useState<string[]>(['email', 'web']);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);
  useEffect(() => { const c = new AbortController(); alumniApi.commMeta(c.signal).then(setMeta).catch(() => undefined); return () => c.abort(); }, []);

  async function run(label: string, fn: () => Promise<unknown>, confirmText?: string) {
    if (confirmText && !window.confirm(confirmText)) return;
    setBusy(true); setError(''); setNotice('');
    try { await fn(); setNotice(label); onChanged(); } catch (reason) { setError(reason instanceof Error ? reason.message : 'Something went wrong. Try again.'); } finally { setBusy(false); }
  }
  const toLocal = (v: string | null) => (v ? v.slice(0, 16).replace(' ', 'T') : '');

  return (
    <div className="space-y-4">
      {notice ? <Banner tone="success">{notice}</Banner> : null}
      {error ? <Banner>{error}</Banner> : null}
      <div className="grid gap-3 md:grid-cols-4">
        <MetricTile label="Responses" value={s.response_count} /><MetricTile label="Questions" value={s.question_count} />
        <MetricTile label="Opens" value={s.opens_at ? formatDate(s.opens_at) : 'Immediately'} /><MetricTile label="Closes" value={s.closes_at ? formatDate(s.closes_at) : 'No end date'} />
      </div>
      <Panel title="Questions">
        <ol className="list-decimal space-y-2 pl-5 text-sm text-slate-800">
          {detail.questions.map((q, i) => (
            <li key={q.id ?? i}>{q.prompt}{q.required ? ' *' : ''}<div className="text-xs text-slate-500">{humanize(q.question_type)}{q.options.length ? ` · ${q.options.join(', ')}` : ''}</div></li>
          ))}
        </ol>
      </Panel>
      <div className="flex flex-wrap gap-2">
        {s.status === 'draft' ? <Button className="h-9" disabled={busy} onClick={() => run('Survey published.', () => alumniApi.surveyAction(s.id, 'publish'))}>Publish</Button> : null}
        {s.status !== 'closed' ? <Button variant="outline" className="h-9" onClick={() => setEditing((v) => !v)}>{editing ? 'Close editor' : 'Edit survey'}</Button> : null}
        {s.status === 'published' ? <Button variant="outline" className="h-9" disabled={busy} onClick={() => run('Survey closed.', () => alumniApi.surveyAction(s.id, 'close'), 'Close this survey? No more responses will be accepted.')}>Close survey</Button> : null}
        {s.status === 'draft' ? <Button variant="ghost" className="h-9" disabled={busy} onClick={() => run('Survey deleted.', () => alumniApi.surveyAction(s.id, 'delete'), 'Delete this draft survey?')}>Delete draft</Button> : null}
      </div>
      {editing ? (
        <SurveyForm key={s.id} types={types} surveyId={s.id} locked={detail.locked} questions={detail.questions} onSaved={() => { setEditing(false); setNotice('Changes saved.'); onChanged(); }}
          initial={{ title: s.title, survey_type: s.survey_type, description: s.description ?? '', anonymous: !!s.anonymous, opens_at: toLocal(s.opens_at), closes_at: toLocal(s.closes_at), audience: detail.audience }} />
      ) : null}
      {s.status === 'published' ? (
        <Panel title="Ask alumni to respond">
          <p className="mb-3 text-sm text-slate-600">Sends a request to eligible alumni in this survey&apos;s audience who have agreed to be contacted on the chosen channels. People who already responded are not asked again.</p>
          <ChannelPicker meta={meta} value={channels} onChange={setChannels} />
          <Button className="mt-3 h-9" disabled={busy || channels.length === 0} onClick={() => run('Requests sent. See Communication → Campaigns for delivery results.', () => alumniApi.sendSurvey(s.id, channels), 'Send the survey request now?')}>Send request</Button>
        </Panel>
      ) : null}
    </div>
  );
}

function Results({ id }: { id: number }) {
  const [r, setR] = useState<SurveyResults | null>(null);
  const [error, setError] = useState('');
  useEffect(() => {
    const c = new AbortController();
    alumniApi.surveyResults(id, c.signal).then(setR).catch((reason: unknown) => {
      if (reason instanceof DOMException && reason.name === 'AbortError') return;
      setError(reason instanceof Error ? reason.message : "Couldn't load results. Try again.");
    });
    return () => c.abort();
  }, [id]);
  if (!r) return error ? <Banner>{error}</Banner> : <LoadingBlock />;
  return (
    <div className="space-y-4">
      <div className="grid gap-3 md:grid-cols-3">
        <MetricTile label="Responses" value={r.responses} /><MetricTile label="Invited audience" value={r.audience} />
        <MetricTile label="Response rate" value={r.response_rate === null ? '—' : `${r.response_rate}%`} />
      </div>
      {r.responses === 0 ? <Banner tone="info">No responses yet.</Banner> : null}
      {r.questions.map((q) => (
        <Panel key={q.id} title={q.prompt}>
          <p className="mb-2 text-xs text-slate-500">{humanize(q.question_type)} · {q.answered} answered</p>
          {q.counts ? (
            <ul className="space-y-2 text-sm">
              {q.counts.map((c) => (
                <li key={c.option}><div className="flex justify-between"><span>{c.option}</span><span className="tabular-nums text-slate-600">{c.count} · {c.percent}%</span></div><ProgressBar percent={c.percent} /></li>
              ))}
            </ul>
          ) : null}
          {q.distribution ? (
            <ul className="space-y-2 text-sm">
              {q.average != null ? <li className="font-medium">Average {q.average}{q.min != null ? ` (range ${q.min}–${q.max})` : ''}</li> : null}
              {q.distribution.map((d) => <li key={d.rating} className="flex justify-between"><span>{d.rating}</span><span className="tabular-nums text-slate-600">{d.count}</span></li>)}
            </ul>
          ) : null}
          {!q.counts && !q.distribution && q.average != null ? <p className="text-sm font-medium">Average {q.average}{q.min != null ? ` (range ${q.min}–${q.max})` : ''}</p> : null}
          {q.texts ? (
            q.texts.length === 0 ? <p className="text-sm text-slate-500">No written answers.</p> : (
              <ul className="divide-y divide-slate-100 text-sm">{q.texts.map((t, i) => <li key={i} className="py-2">{t.answer}{t.by ? <span className="ml-2 text-xs text-slate-500">— {t.by}</span> : null}</li>)}</ul>
            )
          ) : null}
        </Panel>
      ))}
    </div>
  );
}

function Participation({ detail, onChanged }: { detail: SurveyDetail; onChanged: () => void }) {
  const s = detail.survey;
  const [data, setData] = useState<Awaited<ReturnType<typeof alumniApi.surveyParticipation>> | null>(null);
  const [who, setWho] = useState<Picked | null>(null);
  const [answers, setAnswers] = useState<Record<string, unknown>>({});
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);

  const load = useCallback((signal?: AbortSignal) => alumniApi.surveyParticipation(s.id, signal).then(setData).catch((reason: unknown) => {
    if (reason instanceof DOMException && reason.name === 'AbortError') return;
    setError(reason instanceof Error ? reason.message : "Couldn't load participation. Try again.");
  }), [s.id]);
  useEffect(() => { const c = new AbortController(); void load(c.signal); return () => c.abort(); }, [load]);

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!who) { setError('Choose who is responding.'); return; }
    setBusy(true); setError(''); setNotice('');
    try { await alumniApi.recordSurveyResponse(s.id, who.id, answers); setNotice('Response recorded.'); setWho(null); setAnswers({}); await load(); onChanged(); }
    catch (reason) { setError(reason instanceof Error ? reason.message : "Couldn't record the response. Try again."); } finally { setBusy(false); }
  }

  return (
    <div className="space-y-4">
      {notice ? <Banner tone="success">{notice}</Banner> : null}
      {error ? <Banner>{error}</Banner> : null}
      {!data ? <LoadingBlock /> : (
        <>
          <div className="grid gap-3 md:grid-cols-2"><MetricTile label="Responded" value={data.responded} /><MetricTile label="Yet to respond" value={data.pending} /></div>
          <Panel title="Yet to respond">
            {data.pending_alumni.length === 0 ? <p className="text-sm text-slate-500">Everyone in the audience has responded.</p> : (
              <ul className="divide-y divide-slate-100 text-sm">
                {data.pending_alumni.map((a) => <li key={a.id} className="py-2"><Link className="text-indigo-700 hover:underline" href={`/alumni/profile/${a.id}`}>{a.full_name}</Link> <span className="text-xs text-slate-500">{a.alumni_code}{a.batch ? ` · ${a.batch}` : ''}</span></li>)}
              </ul>
            )}
            {data.pending > data.pending_alumni.length ? <p className="mt-2 text-xs text-slate-500">Showing the first {data.pending_alumni.length} of {data.pending}.</p> : null}
          </Panel>
        </>
      )}
      {s.status === 'published' ? (
        <Panel title="Record a response on someone's behalf">
          <form onSubmit={submit} className="space-y-3" noValidate>
            <FormField label="Alumnus" required><AlumniPicker value={who} onChange={setWho} /></FormField>
            {detail.questions.map((q) => {
              const key = String(q.id);
              const label = `${q.prompt}${q.required ? ' *' : ''}`;
              if (q.question_type === 'single_choice' || q.question_type === 'yes_no') {
                const opts = q.question_type === 'yes_no' ? ['yes', 'no'] : q.options;
                return <FormField key={key} label={label}><select className={inputClass} value={String(answers[key] ?? '')} onChange={(e) => setAnswers({ ...answers, [key]: e.target.value })}><option value="">Choose…</option>{opts.map((o) => <option key={o} value={o}>{humanize(o)}</option>)}</select></FormField>;
              }
              if (q.question_type === 'multiple_choice') {
                const cur = (answers[key] as string[] | undefined) ?? [];
                return (
                  <fieldset key={key}><legend className="text-sm font-medium text-slate-700">{label}</legend>
                    {q.options.map((o) => <label key={o} className="mr-4 inline-flex items-center gap-1.5 text-sm"><input type="checkbox" checked={cur.includes(o)} onChange={(e) => setAnswers({ ...answers, [key]: e.target.checked ? [...cur, o] : cur.filter((x) => x !== o) })} />{o}</label>)}
                  </fieldset>
                );
              }
              const numeric = q.question_type === 'rating' || q.question_type === 'scale';
              return <FormField key={key} label={label}><input className={inputClass} type={numeric ? 'number' : 'text'} value={String(answers[key] ?? '')} onChange={(e) => setAnswers({ ...answers, [key]: numeric && e.target.value !== '' ? Number(e.target.value) : e.target.value })} /></FormField>;
            })}
            <Button type="submit" className="h-9" disabled={busy}>Record response</Button>
          </form>
        </Panel>
      ) : null}
    </div>
  );
}

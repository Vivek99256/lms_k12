'use client';

import dynamic from 'next/dynamic';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { CheckCircle2, FlaskConical, Loader2, RefreshCw, Sparkles, XCircle } from 'lucide-react';

import { Button } from '@/components/ui/button';
import {
  approveLab,
  checkSpecText,
  fetchStudioIndex,
  fetchStudioLab,
  generateLab,
  rejectLab,
  saveSpecText,
  type LabDetail,
  type LabStatus,
  type LabVersionRow,
  type StudioIndex,
  type Validation,
} from '@/app/pal/data/pal-lab-studio';
import { specToModel } from '@/lib/experiment-builder/spec';

// The same experiment students use; large, so it is loaded only when a teacher opens the preview.
const ExperimentBuilderWorkspace = dynamic(() => import('../experiment-builder/ExperimentBuilderWorkspace').then((m) => m.ExperimentBuilderWorkspace), { ssr: false });

/**
 * Lab Studio, for teachers and admins.
 *
 * Nothing reaches students from here except through approval. An AI draft, or an edit of an approved lab, is saved as a
 * new DRAFT version; the teacher can run it exactly as a student would, see the expected results and the scientific key,
 * read the automatic checks, and only then approve. A lab that fails the checks cannot be approved. The approved version
 * stays live until its replacement is approved.
 */

const STATUS: Record<LabStatus, { label: string; cls: string }> = {
  approved: { label: 'Live for students', cls: 'bg-emerald-100 text-emerald-800' },
  draft: { label: 'Draft (not shown to students)', cls: 'bg-amber-100 text-amber-800' },
  retired: { label: 'Replaced', cls: 'bg-slate-100 text-slate-600' },
  rejected: { label: 'Rejected', cls: 'bg-rose-100 text-rose-800' },
};

type Tab = 'preview' | 'results' | 'checks' | 'edit';

const FIELD = 'w-full rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-sm text-slate-900 focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500';

function Checks({ v }: { v: Validation }) {
  return (
    <div className="space-y-3" data-testid="checks">
      {v.errors.length === 0 ? (
        <p className="flex items-center gap-1.5 rounded-lg bg-emerald-50 px-3 py-2 text-sm font-semibold text-emerald-800"><CheckCircle2 className="h-4 w-4" aria-hidden /> All automatic checks passed.</p>
      ) : (
        <div className="rounded-lg border border-rose-200 bg-rose-50 p-3">
          <p className="flex items-center gap-1.5 text-sm font-bold text-rose-800"><XCircle className="h-4 w-4" aria-hidden /> {v.errors.length} problem{v.errors.length === 1 ? '' : 's'} to fix before this can be approved</p>
          <ul className="mt-1 list-disc space-y-0.5 pl-5 text-xs text-rose-900">{v.errors.map((e) => <li key={e}>{e}</li>)}</ul>
        </div>
      )}
      {v.warnings.length > 0 ? (
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-3">
          <p className="text-sm font-bold text-amber-900">Please look at these</p>
          <ul className="mt-1 list-disc space-y-0.5 pl-5 text-xs text-amber-900">{v.warnings.map((e) => <li key={e}>{e}</li>)}</ul>
        </div>
      ) : null}
      {v.stats.combinations ? (
        <p className="text-xs text-slate-600">
          Every one of the {v.stats.combinations.toLocaleString()} combinations of settings was calculated: results range from {v.stats.min} to {v.stats.max}
          {v.stats.clamped ? `; ${v.stats.clamped} hit the limit.` : '.'}
        </p>
      ) : null}
      <p className="text-xs text-slate-500">The checks cover structure, settings, units, result boundaries, missing configuration and whether the key agrees with the model. They cannot judge the science itself: that is your review.</p>
    </div>
  );
}

function ResultsAndKey({ d }: { d: LabDetail }) {
  const p = d.preview;
  if (!p) return <p className="text-sm text-slate-600">The expected results appear once the lab passes the automatic checks.</p>;
  return (
    <div className="space-y-4" data-testid="results-key">
      <div className="rounded-xl border border-violet-200 bg-violet-50 p-3 text-xs text-violet-900">
        <p className="font-bold">Teacher key: not shown to students</p>
        <p className="mt-1">{p.conceptFocus}</p>
        <p className="mt-1">Measured: <strong>{p.measure}</strong> ({p.unit}). With every setting at its default the result is <strong>{p.baseline} {p.unit}</strong>.</p>
      </div>
      {p.settings.map((s) => {
        const lo = Math.min(...s.options.map((o) => o.result));
        const hi = Math.max(...s.options.map((o) => o.result));
        return (
          <div key={s.key} className="rounded-xl border border-slate-200 bg-white p-3">
            <p className="text-sm font-bold text-slate-900">{s.label} <span className="font-normal text-slate-500">({s.item})</span></p>
            <div className="mt-2 space-y-1">
              {s.options.map((o) => (
                <div key={o.value} className="flex items-center gap-2 text-xs">
                  <span className="w-40 shrink-0 text-slate-700">{o.label}{o.value === s.default ? ' (default)' : ''}</span>
                  <div className="h-3 flex-1 rounded bg-slate-100"><div className="h-3 rounded bg-sky-500" style={{ width: `${hi > 0 ? Math.max(3, (o.result / hi) * 100) : 0}%` }} /></div>
                  <span className="w-20 shrink-0 text-right font-mono text-slate-800">{o.result} {p.unit}</span>
                </div>
              ))}
            </div>
            {s.keyEffect ? (
              <p className="mt-2 rounded-lg bg-slate-50 px-2.5 py-1.5 text-xs text-slate-700">
                <strong>Key ({s.keyDirection === 'decrease' ? '↓' : '↑'} from “{s.options.find((o) => o.value === s.keyFrom)?.label ?? s.options[0].label}” to “{s.options.find((o) => o.value === s.keyTo)?.label ?? s.options[s.options.length - 1].label}”):</strong> {s.keyEffect}
              </p>
            ) : (
              <p className="mt-2 text-xs text-amber-800">{hi - lo > 1e-9 ? 'This setting changes the result but the key has no explanation for it.' : 'This setting has no effect on the result.'}</p>
            )}
          </div>
        );
      })}
      {p.smallest && p.largest ? (
        <div className="grid gap-2 sm:grid-cols-2 text-xs">
          <div className="rounded-xl border border-slate-200 bg-white p-3"><p className="font-bold text-slate-900">Smallest result: {p.smallest.value} {p.unit}</p><p className="mt-1 text-slate-600">{Object.entries(p.smallest.settings).map(([k, v]) => `${k}: ${v}`).join(' · ')}</p></div>
          <div className="rounded-xl border border-slate-200 bg-white p-3"><p className="font-bold text-slate-900">Largest result: {p.largest.value} {p.unit}</p><p className="mt-1 text-slate-600">{Object.entries(p.largest.settings).map(([k, v]) => `${k}: ${v}`).join(' · ')}</p></div>
        </div>
      ) : null}
    </div>
  );
}

export function LabStudio({ initialChapter }: { initialChapter: string }) {
  const [chapterInput, setChapterInput] = useState(initialChapter);
  const [chapterId, setChapterId] = useState(initialChapter);
  const [index, setIndex] = useState<StudioIndex | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [detail, setDetail] = useState<LabDetail | null>(null);
  const [tab, setTab] = useState<Tab>('preview');
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [text, setText] = useState('');
  const [live, setLive] = useState<Validation | null>(null);
  const [reason, setReason] = useState('');

  const loadIndex = useCallback((id: string) => {
    if (!id) return;
    setLoading(true);
    setError(null);
    fetchStudioIndex(id)
      .then((i) => setIndex(i))
      .catch((e: unknown) => {
        setIndex(null);
        setError(e instanceof Error ? e.message : 'Couldn’t open the chapter.');
      })
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (!chapterId) return;
    // Promise-based so the state updates happen after the request starts, not during the effect.
    Promise.resolve().then(() => loadIndex(chapterId));
  }, [chapterId, loadIndex]);

  const open = (row: LabVersionRow) => {
    setBusy('open');
    setMessage(null);
    (row.id !== null ? fetchStudioLab({ id: row.id }) : fetchStudioLab({ key: row.labKey }))
      .then((d) => {
        setDetail(d);
        setText(JSON.stringify(d.spec, null, 2));
        setLive(d.validation);
        setTab('preview');
      })
      .catch((e: unknown) => setMessage(e instanceof Error ? e.message : 'Couldn’t open that version.'))
      .finally(() => setBusy(null));
  };

  const adopt = (d: LabDetail) => {
    setDetail(d);
    setText(JSON.stringify(d.spec, null, 2));
    setLive(d.validation);
    loadIndex(chapterId);
  };

  const generate = () => {
    if (!index) return;
    setBusy('generate');
    setMessage(null);
    generateLab(index.chapter.id, note)
      .then((d) => {
        adopt(d);
        setTab('checks');
        setMessage('A draft was made. Preview it, read the checks, then approve or reject. Students cannot see it yet.');
      })
      .catch((e: unknown) => setMessage(e instanceof Error ? e.message : 'The AI could not draft a lab.'))
      .finally(() => setBusy(null));
  };

  const check = () => {
    setBusy('check');
    checkSpecText(text)
      .then((r) => setLive(r.validation))
      .catch((e: unknown) => setMessage(e instanceof Error ? e.message : 'Couldn’t check that.'))
      .finally(() => setBusy(null));
  };

  const save = () => {
    setBusy('save');
    setMessage(null);
    saveSpecText(text)
      .then((d) => {
        adopt(d);
        setTab('checks');
        setMessage(`Saved as version ${d.version}, a draft. It needs approving before students see it${detail?.status === 'approved' ? `; they keep using version ${detail.version} until then` : ''}.`);
      })
      .catch((e: unknown) => setMessage(e instanceof Error ? e.message : 'Couldn’t save.'))
      .finally(() => setBusy(null));
  };

  const approve = () => {
    if (!detail?.id) return;
    if (!window.confirm('Approve this lab? Students of this chapter will use it from now on.')) return;
    setBusy('approve');
    setMessage(null);
    approveLab(detail.id)
      .then((d) => {
        adopt(d);
        setMessage('Approved. Students now use this version.');
      })
      .catch((e: unknown) => setMessage(e instanceof Error ? e.message : 'It cannot be approved yet.'))
      .finally(() => setBusy(null));
  };

  const reject = () => {
    if (!detail?.id) return;
    setBusy('reject');
    rejectLab(detail.id, reason)
      .then(() => fetchStudioLab({ id: detail.id! }))
      .then(adopt)
      .catch((e: unknown) => setMessage(e instanceof Error ? e.message : 'Couldn’t reject.'))
      .finally(() => setBusy(null));
  };

  const model = useMemo(() => {
    if (!detail || detail.validation.errors.length > 0) return null;
    try {
      return specToModel(detail.spec, detail.version);
    } catch {
      return null;
    }
  }, [detail]);

  const canApprove = !!detail && detail.id !== null && detail.status === 'draft' && detail.validation.errors.length === 0;

  return (
    <div className="mx-auto max-w-6xl space-y-4 p-4">
      <header className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-violet-200 bg-violet-50 px-4 py-3">
        <div>
          <h1 className="flex items-center gap-2 text-lg font-bold text-slate-900"><FlaskConical className="h-5 w-5 text-violet-700" aria-hidden /> Lab Studio</h1>
          <p className="text-xs text-slate-600">Prepare, preview and approve the virtual science labs students use in the Application Lab. Teachers and admins only.</p>
        </div>
        <form className="flex items-center gap-2" onSubmit={(e) => { e.preventDefault(); setChapterId(chapterInput.trim()); setDetail(null); }}>
          <label className="text-xs font-semibold text-slate-700" htmlFor="chapter-id">Chapter id</label>
          <input id="chapter-id" inputMode="numeric" value={chapterInput} onChange={(e) => setChapterInput(e.target.value)} className="w-28 rounded-lg border border-slate-300 px-2 py-1 text-sm" />
          <Button type="submit" size="sm" className="bg-violet-700 text-xs text-white hover:bg-violet-800">Open</Button>
        </form>
      </header>

      {loading ? <p className="flex items-center gap-2 text-sm text-slate-600" role="status"><Loader2 className="h-4 w-4 animate-spin" aria-hidden /> Opening the chapter…</p> : null}
      {error ? (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800" role="alert">
          <span>{error}</span>
          <Button size="sm" variant="outline" onClick={() => loadIndex(chapterId)} className="h-8 gap-1.5 bg-white text-xs"><RefreshCw className="h-3.5 w-3.5" /> Try again</Button>
        </div>
      ) : null}

      {index ? (
        <>
          <section className="rounded-xl border border-slate-200 bg-white p-4">
            <h2 className="text-sm font-bold text-slate-900">{index.chapter.name}</h2>
            <p className="text-xs text-slate-600">{index.chapter.subject} · {index.chapter.standard}</p>
            <p className="mt-2 text-xs font-semibold text-slate-700">Concepts a lab can assess</p>
            <p className="text-xs text-slate-600">{index.chapter.concepts.map((c) => c.name).join(' · ') || 'This chapter has no concepts yet.'}</p>
            {!index.storageReady ? <p className="mt-2 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-900">Lab storage is not ready (the database migration has not been applied), so drafts cannot be saved yet. Built-in labs can still be previewed.</p> : null}
          </section>

          <section className="rounded-xl border border-slate-200 bg-white p-4">
            <h2 className="flex items-center gap-1.5 text-sm font-bold text-slate-900"><Sparkles className="h-4 w-4 text-violet-600" aria-hidden /> Generate a lab with AI</h2>
            <p className="text-xs text-slate-600">The AI drafts the equipment, settings, result model and your key from this chapter’s concepts. It is saved as a draft and students cannot see it until you approve it.</p>
            <div className="mt-2 flex flex-wrap items-start gap-2">
              <textarea rows={2} value={note} onChange={(e) => setNote(e.target.value)} className={`${FIELD} sm:max-w-xl`} placeholder="Optional note for the AI, e.g. “focus on conduction through different materials”" aria-label="Note for the AI" />
              <Button onClick={generate} disabled={busy !== null || !index.storageReady || index.chapter.concepts.length === 0} className="gap-1.5 bg-violet-700 text-sm font-semibold text-white hover:bg-violet-800" data-testid="generate">
                {busy === 'generate' ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <Sparkles className="h-4 w-4" aria-hidden />}
                {busy === 'generate' ? 'Drafting (up to 2 minutes)…' : 'Generate lab'}
              </Button>
            </div>
          </section>

          <section className="rounded-xl border border-slate-200 bg-white p-4">
            <h2 className="text-sm font-bold text-slate-900">Versions</h2>
            {index.versions.length === 0 ? <p className="mt-1 text-xs text-slate-600">No lab yet for this chapter. Students use the guided design form until one is approved.</p> : null}
            <ul className="mt-2 divide-y divide-slate-100" data-testid="versions">
              {index.versions.map((v) => (
                <li key={`${v.labKey}-${v.version}-${v.id}`} className="flex flex-wrap items-center justify-between gap-2 py-2">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-slate-900">{v.title} <span className="font-normal text-slate-500">· v{v.version} · {v.source === 'builtin' ? 'built-in' : v.source === 'ai' ? 'AI draft' : 'edited'}</span></p>
                    <span className={`inline-block rounded-full px-2 py-0.5 text-[11px] font-semibold ${STATUS[v.status]?.cls ?? ''}`}>{STATUS[v.status]?.label ?? v.status}</span>
                    {v.rejectReason ? <span className="ml-2 text-[11px] text-slate-500">“{v.rejectReason}”</span> : null}
                  </div>
                  <Button size="sm" variant="outline" onClick={() => open(v)} disabled={busy !== null} className="h-8 text-xs">Open</Button>
                </li>
              ))}
            </ul>
          </section>
        </>
      ) : null}

      {message ? <p role="status" className="rounded-lg border border-sky-200 bg-sky-50 px-3 py-2 text-xs text-sky-900">{message}</p> : null}

      {detail ? (
        <section className="space-y-3 rounded-xl border-2 border-violet-200 bg-white p-4" data-testid="detail">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h2 className="text-base font-bold text-slate-900">{detail.spec.title} <span className="text-sm font-normal text-slate-500">version {detail.version}</span></h2>
              <span className={`inline-block rounded-full px-2 py-0.5 text-[11px] font-semibold ${STATUS[detail.status]?.cls ?? ''}`}>{STATUS[detail.status]?.label ?? detail.status}</span>
            </div>
            {detail.status === 'draft' && detail.id !== null ? (
              <div className="flex flex-wrap items-center gap-2">
                <input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Reason, if rejecting" className="w-44 rounded-lg border border-slate-300 px-2 py-1 text-xs" aria-label="Reason for rejecting" />
                <Button size="sm" variant="outline" onClick={reject} disabled={busy !== null} className="h-8 text-xs text-rose-700">Reject</Button>
                <Button size="sm" onClick={approve} disabled={!canApprove || busy !== null} className="h-8 bg-emerald-700 text-xs font-semibold text-white hover:bg-emerald-800" data-testid="approve">
                  {busy === 'approve' ? 'Approving…' : 'Approve for students'}
                </Button>
              </div>
            ) : null}
          </div>
          {detail.status === 'draft' && detail.validation.errors.length > 0 ? <p className="text-xs text-rose-700">This draft cannot be approved until the problems under “Checks” are fixed.</p> : null}

          <div className="flex flex-wrap gap-1.5" role="tablist" aria-label="Lab views">
            {([['preview', 'Run it as a student'], ['results', 'Expected results and key'], ['checks', `Checks${detail.validation.errors.length ? ` (${detail.validation.errors.length})` : ''}`], ['edit', 'Edit']] as [Tab, string][]).map(([id, label]) => (
              <button key={id} type="button" role="tab" aria-selected={tab === id} onClick={() => setTab(id)} className={`rounded-lg border px-3 py-1 text-xs font-semibold ${tab === id ? 'border-violet-600 bg-violet-600 text-white' : 'border-slate-300 bg-white text-slate-700'}`}>{label}</button>
            ))}
          </div>

          {tab === 'preview' ? (
            model ? (
              <div data-testid="lab-preview">
                <p className="mb-2 rounded-lg bg-violet-50 px-3 py-2 text-xs text-violet-900">This is the working experiment, exactly as a student gets it. Nothing here is saved or marked.</p>
                <ExperimentBuilderWorkspace key={`${detail.labKey}:${detail.version}`} chapterId={String(index?.chapter.id ?? chapterId)} chapterName={index?.chapter.name ?? ''} scope={{ type: 'chapter', concepts: [] }} model={model} preview />
              </div>
            ) : (
              <p className="text-sm text-slate-600">The experiment can be run once the lab passes the automatic checks. See “Checks”.</p>
            )
          ) : null}
          {tab === 'results' ? <ResultsAndKey d={detail} /> : null}
          {tab === 'checks' ? <Checks v={live ?? detail.validation} /> : null}
          {tab === 'edit' ? (
            <div className="space-y-2">
              <p className="rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-900">
                {detail.status === 'approved'
                  ? `Changing this lab saves a NEW version that needs approving again. Students keep using version ${detail.version} until the new one is approved.`
                  : 'Saving creates a new draft version. It needs approving before students see it.'}
              </p>
              <textarea value={text} onChange={(e) => setText(e.target.value)} rows={22} spellCheck={false} className={`${FIELD} font-mono text-xs`} aria-label="Lab specification (JSON)" data-testid="spec-text" />
              <div className="flex flex-wrap gap-2">
                <Button variant="outline" onClick={check} disabled={busy !== null} className="text-sm">Check</Button>
                <Button onClick={save} disabled={busy !== null || !index?.storageReady} className="bg-violet-700 text-sm font-semibold text-white hover:bg-violet-800" data-testid="save-version">Save as a new version</Button>
              </div>
              {live ? <Checks v={live} /> : null}
            </div>
          ) : null}
        </section>
      ) : null}
    </div>
  );
}

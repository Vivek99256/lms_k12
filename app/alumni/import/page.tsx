'use client';

import Link from 'next/link';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { alumniApi, AlumniApiError, type ImportBatch, type ImportMeta, type ImportRow, type ImportUpload, type Pagination } from '../_lib/alumni-api';
import { Banner, EmptyState, LoadingBlock, MetricTile, PageFrame, Panel, formatDate, humanize, inputClass } from '../_components/alumni-ui';

type Step = 'upload' | 'map' | 'review' | 'done';
const STEPS: [Step, string][] = [['upload', '1. Upload'], ['map', '2. Match columns'], ['review', '3. Check'], ['done', '4. Done']];
const ROW_TONE: Record<string, string> = { error: 'text-red-700', duplicate: 'text-amber-700', valid: 'text-emerald-700', imported: 'text-emerald-700', skipped: 'text-amber-700', failed: 'text-red-700' };

export default function ImportPage() {
  const [step, setStep] = useState<Step>('upload');
  const [meta, setMeta] = useState<ImportMeta | null>(null);
  const [history, setHistory] = useState<ImportBatch[] | null>(null);
  const [upload, setUpload] = useState<ImportUpload | null>(null);
  const [mapping, setMapping] = useState<Record<string, string>>({});
  const [batch, setBatch] = useState<ImportBatch | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const picker = useRef<HTMLInputElement>(null);

  const loadHistory = useCallback((signal?: AbortSignal) => alumniApi.importHistory(signal).then(setHistory).catch(() => undefined), []);
  useEffect(() => {
    const controller = new AbortController();
    alumniApi.importMeta(controller.signal).then(setMeta).catch(() => undefined);
    void loadHistory(controller.signal);
    return () => controller.abort();
  }, [loadHistory]);

  function fail(reason: unknown, fallback: string) {
    setError(reason instanceof AlumniApiError ? (Object.values(reason.fieldErrors)[0]?.[0] ?? reason.message) : reason instanceof Error ? reason.message : fallback);
  }

  async function onFile(file: File | undefined) {
    if (!file) return;
    setBusy(true); setError('');
    try {
      const r = (await alumniApi.uploadImport(file)).data;
      setUpload(r); setBatch(r.batch);
      setMapping(Object.fromEntries(Object.entries(r.suggested).map(([k, v]) => [k, String(v)])));
      setStep('map');
    } catch (reason) { fail(reason, "Couldn't read that file. Try again."); }
    finally { setBusy(false); if (picker.current) picker.current.value = ''; }
  }

  async function check() {
    if (!batch) return;
    setBusy(true); setError('');
    try {
      const body: Record<string, number> = {};
      for (const [k, v] of Object.entries(mapping)) if (v !== '') body[k] = Number(v);
      setBatch((await alumniApi.previewImport(batch.id, body)).data);
      setStep('review');
    } catch (reason) { fail(reason, "Couldn't check the file. Try again."); }
    finally { setBusy(false); }
  }

  // The server imports 100 rows per request and says how many are left, so a big file never hits a time limit and a closed tab can be resumed.
  async function runConfirm(start: ImportBatch) {
    setBusy(true); setError(''); setBatch(start); setStep('review'); setProgress({ done: 0, total: start.valid_count });
    try {
      let current = start;
      for (;;) {
        current = (await alumniApi.confirmImport(current.id)).data;
        setBatch(current);
        setProgress({ done: Math.max(0, current.valid_count - (current.remaining ?? 0)), total: current.valid_count });
        if ((current.remaining ?? 0) === 0) break;
      }
      setStep('done'); void loadHistory();
    } catch (reason) { fail(reason, "The import stopped part-way. Nothing is lost: use “Finish import” under Recent imports to continue."); void loadHistory(); }
    finally { setBusy(false); setProgress(null); }
  }

  async function confirm() {
    if (!batch) return;
    if (!window.confirm(`Import ${batch.valid_count} alumni now? Duplicates and rows with problems will be skipped.`)) return;
    await runConfirm(batch);
  }

  async function cancel() {
    if (batch && !window.confirm('Discard this upload? Nothing has been imported.')) return;
    setBusy(true);
    try { if (batch && batch.status !== 'completed') await alumniApi.cancelImport(batch.id); } catch { /* already gone */ }
    reset(); void loadHistory(); setBusy(false);
  }

  function reset() { setStep('upload'); setUpload(null); setBatch(null); setMapping({}); setError(''); }

  return (
    <PageFrame title="Import alumni" description="Bring alumni in from Excel or CSV. You see exactly what will happen before anything is saved.">
      <ol className="flex flex-wrap gap-2 text-sm" aria-label="Progress">
        {STEPS.map(([key, label]) => <li key={key} aria-current={key === step ? 'step' : undefined} className={cn('rounded-full px-3 py-1', key === step ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-600')}>{label}</li>)}
      </ol>
      {error ? <Banner>{error}</Banner> : null}

      {step === 'upload' ? (
        <div className="space-y-4">
          <Panel title="Choose a file">
            <div className="space-y-3 text-sm text-slate-700">
              <p>Upload a <strong>.csv</strong> or <strong>.xlsx</strong> file. The first row must be the column headings. Up to {meta?.max_rows.toLocaleString('en-IN') ?? '…'} rows and {meta?.max_mb ?? '…'} MB.</p>
              <ul className="list-disc space-y-1 pl-5 text-slate-600">
                <li>Alumni who already exist are <strong>never changed</strong> — they are reported as duplicates and skipped.</li>
                <li>Everyone you import starts as <strong>Registered</strong> with <strong>no consent</strong> to be contacted. Consent is recorded later, by the alumnus or by you with their agreement.</li>
                <li>Each row needs a first name and an email, mobile number, enrollment no., GR no. or student ID.</li>
              </ul>
              <div className="flex flex-wrap gap-2">
                <input ref={picker} type="file" accept=".csv,.xlsx" className="sr-only" aria-label="Choose a CSV or XLSX file" onChange={(e) => void onFile(e.target.files?.[0])} />
                <Button className="h-9" disabled={busy} onClick={() => picker.current?.click()}>{busy ? 'Reading…' : 'Choose file'}</Button>
                <Button variant="outline" className="h-9" onClick={() => void alumniApi.downloadImportTemplate().catch((r) => fail(r, "Couldn't download the template."))}>Download a template</Button>
              </div>
            </div>
          </Panel>
          <Panel title="Recent imports">
            {history === null ? <LoadingBlock /> : history.length === 0 ? <EmptyState title="No imports yet" /> : (
              <div className="overflow-x-auto"><table className="w-full min-w-[640px] text-left text-sm">
                <thead className="text-xs uppercase tracking-wider text-slate-500"><tr><th className="py-2 pr-4 font-medium">File</th><th className="py-2 pr-4 font-medium">When</th><th className="py-2 pr-4 font-medium">Status</th><th className="py-2 pr-4 text-right font-medium">Rows</th><th className="py-2 pr-4 text-right font-medium">Imported</th><th className="py-2 pr-4 text-right font-medium">Skipped</th><th className="py-2"><span className="sr-only">Actions</span></th></tr></thead>
                <tbody className="divide-y divide-slate-100">{history.map((h) => (
                  <tr key={h.id}><td className="py-2 pr-4 text-slate-800">{h.original_name}</td><td className="py-2 pr-4 text-slate-600">{formatDate(h.confirmed_at ?? h.created_at)}</td><td className="py-2 pr-4">{humanize(h.status)}</td>
                    <td className="py-2 pr-4 text-right tabular-nums">{h.total_rows}</td><td className="py-2 pr-4 text-right tabular-nums">{h.imported_count}</td><td className="py-2 pr-4 text-right tabular-nums">{h.skipped_count + h.error_count}</td>
                    <td className="py-2 text-right">{h.status === 'importing' ? <Button size="sm" variant="outline" disabled={busy} onClick={() => void runConfirm(h)}>Finish import</Button> : null}</td></tr>
                ))}</tbody></table></div>
            )}
          </Panel>
        </div>
      ) : null}

      {step === 'map' && upload && meta ? (
        <Panel title="Match your columns to alumni fields">
          <div className="space-y-4">
            {upload.previously_imported_at ? <Banner tone="info">This exact file was already imported on {formatDate(upload.previously_imported_at)}. Anyone already in the list will be skipped as a duplicate.</Banner> : null}
            <p className="text-sm text-slate-600">We matched what we could by the column headings. Check each one, and choose “Don&apos;t import” for columns you do not want. {upload.batch.total_rows.toLocaleString('en-IN')} rows found in {upload.batch.original_name}.</p>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[640px] text-left text-sm">
                <thead className="text-xs uppercase tracking-wider text-slate-500"><tr><th className="py-2 pr-4 font-medium">Alumni field</th><th className="py-2 pr-4 font-medium">Column in your file</th><th className="py-2 font-medium">Example from your file</th></tr></thead>
                <tbody className="divide-y divide-slate-100">
                  {meta.fields.map((f) => {
                    const idx = mapping[f.key] ?? '';
                    return (
                      <tr key={f.key}>
                        <td className="py-2 pr-4 text-slate-800"><label htmlFor={`map-${f.key}`}>{f.label}{f.required ? <span className="text-red-600"> *</span> : null}</label></td>
                        <td className="py-2 pr-4">
                          <select id={`map-${f.key}`} className={inputClass} value={idx} onChange={(e) => setMapping({ ...mapping, [f.key]: e.target.value })}>
                            <option value="">Don&apos;t import</option>
                            {upload.headers.map((h, i) => <option key={i} value={String(i)}>{h || `(column ${i + 1}, no heading)`}</option>)}
                          </select>
                        </td>
                        <td className="py-2 text-slate-500">{idx !== '' ? (upload.sample[0]?.[Number(idx)] ?? '') : ''}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <div className="flex gap-2">
              <Button className="h-9" disabled={busy} onClick={() => void check()}>{busy ? 'Checking every row…' : 'Check my file'}</Button>
              <Button variant="ghost" className="h-9" disabled={busy} onClick={() => void cancel()}>Cancel</Button>
            </div>
            <p className="text-xs text-slate-500">Checking does not save anything.</p>
          </div>
        </Panel>
      ) : null}

      {step === 'review' && batch ? <Review batch={batch} busy={busy} progress={progress} onBack={() => setStep('map')} onConfirm={() => void confirm()} onCancel={() => void cancel()} /> : null}

      {step === 'done' && batch ? (
        <Panel title="Import finished">
          <div className="space-y-4">
            <Banner tone="success">{batch.imported_count} alumni were added. They are listed as Registered, with no consent to be contacted yet.</Banner>
            <div className="grid gap-3 md:grid-cols-4">
              <MetricTile label="Added" value={batch.imported_count} /><MetricTile label="Skipped (already in the list)" value={batch.skipped_count} />
              <MetricTile label="Not imported (problems)" value={batch.error_count} /><MetricTile label="Failed to save" value={batch.failed_count} />
            </div>
            <div className="flex flex-wrap gap-2">
              <Link href="/alumni/list" className="inline-flex h-9 items-center rounded-md bg-indigo-600 px-4 text-sm font-medium text-white hover:bg-indigo-700">Open the alumni list</Link>
              {batch.error_count + batch.skipped_count + batch.failed_count > 0 ? <Button variant="outline" className="h-9" onClick={() => void alumniApi.downloadImportProblems(batch.id).catch((r) => fail(r, "Couldn't download."))}>Download rows that need attention</Button> : null}
              <Button variant="ghost" className="h-9" onClick={reset}>Import another file</Button>
            </div>
          </div>
        </Panel>
      ) : null}
    </PageFrame>
  );
}

function Review({ batch, busy, progress, onBack, onConfirm, onCancel }: { batch: ImportBatch; busy: boolean; progress: { done: number; total: number } | null; onBack: () => void; onConfirm: () => void; onCancel: () => void }) {
  const [filter, setFilter] = useState<'problems' | 'duplicate' | 'valid'>(batch.error_count > 0 ? 'problems' : batch.duplicate_count > 0 ? 'duplicate' : 'valid');
  const [page, setPage] = useState(1);
  const [data, setData] = useState<{ rows: ImportRow[]; pagination: Pagination } | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    const controller = new AbortController();
    alumniApi.importRows(batch.id, { status: filter === 'problems' ? 'error' : filter, page }, controller.signal).then((r) => { setData(r); setError(''); }).catch((reason: unknown) => {
      if (reason instanceof DOMException && reason.name === 'AbortError') return;
      setError(reason instanceof Error ? reason.message : "Couldn't load the rows. Try again.");
    });
    return () => controller.abort();
  }, [batch.id, filter, page]);

  return (
    <div className="space-y-4">
      <div className="grid gap-3 md:grid-cols-4">
        <MetricTile label="Rows in the file" value={batch.total_rows} /><MetricTile label="Ready to import" value={batch.valid_count} />
        <MetricTile label="Already in the list or repeated" value={batch.duplicate_count} hint="skipped" /><MetricTile label="Problems" value={batch.error_count} hint="not imported" />
      </div>
      {progress ? <div role="status"><Banner tone="info">Importing… {progress.done} of {progress.total} done. Keep this page open; if it closes, continue from Recent imports.</Banner></div>
        : <Banner tone="info">Nothing has been saved yet. Import adds only the {batch.valid_count} ready rows.</Banner>}
      <div role="tablist" aria-label="Rows" className="flex gap-1 border-b border-slate-200">
        {([['problems', `Problems (${batch.error_count})`], ['duplicate', `Duplicates (${batch.duplicate_count})`], ['valid', `Ready (${batch.valid_count})`]] as const).map(([key, label]) => (
          <button key={key} role="tab" type="button" aria-selected={filter === key} onClick={() => { setFilter(key); setPage(1); setData(null); }}
            className={cn('border-b-2 px-3 py-2 text-sm font-medium', filter === key ? 'border-indigo-600 text-indigo-700' : 'border-transparent text-slate-600 hover:text-slate-900')}>{label}</button>
        ))}
      </div>
      {error ? <Banner>{error}</Banner> : null}
      <section className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
        {data === null ? <LoadingBlock /> : data.rows.length === 0 ? <EmptyState title="Nothing here" /> : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] text-left text-sm">
              <thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase tracking-wider text-slate-500"><tr><th className="px-4 py-2.5 font-medium">Row</th><th className="px-4 py-2.5 font-medium">Person</th><th className="px-4 py-2.5 font-medium">What we found</th></tr></thead>
              <tbody className="divide-y divide-slate-100">
                {data.rows.map((r) => (
                  <tr key={r.row_no}>
                    <td className="px-4 py-2.5 tabular-nums text-slate-600">{r.row_no}</td>
                    <td className="px-4 py-2.5 text-slate-800">{r.name ?? '—'}<div className="text-xs text-slate-500">{[r.email, r.mobile, r.batch].filter(Boolean).join(' · ')}</div></td>
                    <td className={cn('px-4 py-2.5', ROW_TONE[r.status])}>
                      {Object.entries(r.errors).length > 0 ? <ul>{Object.entries(r.errors).map(([f, m]) => <li key={f}><span className="font-medium">{humanize(f)}:</span> {m.join(' ')}</li>)}</ul> : (r.note ?? 'Ready to import')}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {data && data.pagination.last_page > 1 ? (
          <div className="flex items-center justify-end gap-2 border-t border-slate-100 px-4 py-3 text-sm text-slate-600">
            <Button variant="outline" size="sm" disabled={data.pagination.page <= 1} onClick={() => setPage(data.pagination.page - 1)}>Previous</Button>
            <span className="tabular-nums">Page {data.pagination.page} of {data.pagination.last_page}</span>
            <Button variant="outline" size="sm" disabled={data.pagination.page >= data.pagination.last_page} onClick={() => setPage(data.pagination.page + 1)}>Next</Button>
          </div>
        ) : null}
      </section>
      <div className="flex flex-wrap gap-2">
        <Button className="h-9" disabled={busy || batch.valid_count === 0} onClick={onConfirm}>{batch.valid_count === 0 ? 'Nothing to import' : `Import ${batch.valid_count} alumni`}</Button>
        <Button variant="outline" className="h-9" disabled={busy} onClick={onBack}>Change the column matching</Button>
        {batch.error_count + batch.duplicate_count > 0 ? <Button variant="outline" className="h-9" onClick={() => void alumniApi.downloadImportProblems(batch.id).catch((r) => setError(r instanceof Error ? r.message : "Couldn't download."))}>Download rows that need attention</Button> : null}
        <Button variant="ghost" className="h-9" disabled={busy} onClick={onCancel}>Cancel import</Button>
      </div>
    </div>
  );
}

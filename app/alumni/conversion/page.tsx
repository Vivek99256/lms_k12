'use client';

import { useCallback, useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { alumniApi, AlumniApiError, type AlumniMeta, type ConversionPreview } from '../_lib/alumni-api';
import { Banner, EmptyState, LoadingBlock, PageFrame, Panel, formatDate, humanize, inputClass } from '../_components/alumni-ui';

const RULE_TEXT: Record<string, string> = {
  lc_or_final_enrollment_ended: 'A leaving certificate has been issued, or the final-standard enrollment has ended',
  lc_issued: 'A leaving certificate has been issued',
  lc_or_inactive: 'A leaving certificate has been issued, or the student is inactive with an inactive date',
};

export default function ConvertStudentsPage() {
  const [preview, setPreview] = useState<ConversionPreview | null>(null);
  const [meta, setMeta] = useState<AlumniMeta | null>(null);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const load = useCallback((signal?: AbortSignal) => {
    return alumniApi
      .conversionPreview(signal)
      .then((result) => {
        setPreview(result);
        setSelected(new Set());
        setError('');
      })
      .catch((reason: unknown) => {
        if (reason instanceof DOMException && reason.name === 'AbortError') return;
        setError(reason instanceof Error ? reason.message : "Couldn't load eligible students. Try again.");
      })
      .finally(() => {
        if (!signal?.aborted) setLoading(false);
      });
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    void load(controller.signal);
    alumniApi.meta(controller.signal).then(setMeta).catch(() => undefined);
    return () => controller.abort();
  }, [load]);

  async function changeRule(rule: string) {
    setError('');
    try {
      await alumniApi.saveSettings({ eligibility_rule: rule });
      await load();
    } catch (reason) {
      setError(reason instanceof AlumniApiError ? reason.message : "Couldn't change the rule. Try again.");
    }
  }

  async function convert(all: boolean) {
    setBusy(true);
    setError('');
    setNotice('');
    try {
      const result = await alumniApi.conversionRun(all ? { confirm_all: true } : { student_ids: [...selected] });
      const skipped = result.data.skipped.length;
      setNotice(`${result.data.created} student(s) converted to alumni.${skipped ? ` ${skipped} skipped: ${result.data.skipped.slice(0, 3).map((s) => `#${s.student_id} ${s.reason}`).join('; ')}.` : ''}`);
      await load();
    } catch (reason) {
      setError(reason instanceof AlumniApiError ? reason.message : "Couldn't convert students. Try again.");
    } finally {
      setBusy(false);
    }
  }

  const candidates = preview?.candidates ?? [];
  const allShown = candidates.length > 0 && candidates.every((c) => selected.has(c.student_id));

  return (
    <PageFrame title="Convert students to alumni" description="Review who is eligible under your rule, then convert. Converting twice never creates a duplicate.">
      {notice ? <Banner tone="success">{notice}</Banner> : null}
      {error ? <Banner>{error}</Banner> : null}

      <Panel title="Eligibility rule">
        <div className="flex flex-wrap items-end gap-3">
          <label className="block space-y-1">
            <span className="text-sm font-medium text-slate-700">A student becomes eligible when</span>
            <select className={inputClass + ' min-w-80'} value={preview?.rule ?? ''} onChange={(event) => changeRule(event.target.value)} disabled={!meta}>
              {(meta?.eligibility_rules ?? [preview?.rule ?? 'lc_or_final_enrollment_ended']).map((rule) => (
                <option key={rule} value={rule}>{RULE_TEXT[rule] ?? humanize(rule)}</option>
              ))}
            </select>
          </label>
          <p className="text-sm text-slate-500">The ERP has no “passed out” flag, so this rule decides who counts as a former student.</p>
        </div>
      </Panel>

      <section className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 px-4 py-3">
          <p className="text-sm text-slate-700">
            {preview ? `${preview.total.toLocaleString('en-IN')} eligible student(s) not yet alumni` : 'Checking…'}
            {preview && preview.total > candidates.length ? ` (showing the first ${candidates.length})` : ''}
          </p>
          <div className="flex gap-2">
            <Button variant="outline" className="h-9" disabled={busy || selected.size === 0} onClick={() => convert(false)}>
              Convert {selected.size} selected
            </Button>
            <Button className="h-9" disabled={busy || !preview || preview.total === 0}
              onClick={() => { if (window.confirm(`Convert all ${preview?.total} eligible students to alumni?`)) void convert(true); }}>
              Convert all eligible
            </Button>
          </div>
        </div>

        {loading && !preview ? (
          <LoadingBlock label="Finding eligible students…" />
        ) : candidates.length === 0 ? (
          <EmptyState title="No students are waiting to be converted" hint="Students who match the rule and aren't alumni yet will appear here." />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-left text-sm">
              <thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase tracking-wider text-slate-500">
                <tr>
                  <th className="w-10 px-4 py-2.5">
                    <input type="checkbox" aria-label="Select all shown" checked={allShown}
                      onChange={(event) => setSelected(event.target.checked ? new Set(candidates.map((c) => c.student_id)) : new Set())} />
                  </th>
                  <th className="px-4 py-2.5 font-medium">Student</th>
                  <th className="px-4 py-2.5 font-medium">Enrollment no.</th>
                  <th className="px-4 py-2.5 font-medium">Contact</th>
                  <th className="px-4 py-2.5 font-medium">Left on</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {candidates.map((c) => (
                  <tr key={c.student_id} className="hover:bg-slate-50">
                    <td className="px-4 py-3">
                      <input type="checkbox" aria-label={`Select ${c.first_name} ${c.last_name ?? ''}`} checked={selected.has(c.student_id)}
                        onChange={(event) => setSelected((current) => { const next = new Set(current); if (event.target.checked) next.add(c.student_id); else next.delete(c.student_id); return next; })} />
                    </td>
                    <td className="px-4 py-3 font-medium text-slate-900">{[c.first_name, c.last_name].filter(Boolean).join(' ')}<div className="font-mono text-xs font-normal text-slate-500">ID {c.student_id}</div></td>
                    <td className="px-4 py-3 text-slate-700">{c.enrollment_no || '—'}</td>
                    <td className="px-4 py-3 text-slate-700">{c.email || c.mobile || '—'}</td>
                    <td className="px-4 py-3 text-slate-700">{formatDate(c.leaving_date)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </PageFrame>
  );
}

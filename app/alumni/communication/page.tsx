'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import {
  alumniApi, AlumniApiError, type AudiencePreview, type Campaign, type CampaignDetail, type CommMeta, type HistoryRow, type MessageTemplate, type Pagination,
} from '../_lib/alumni-api';
import { AudienceFilters, CHANNEL_LABEL, ChannelPicker, type AudienceValue } from '../_components/audience';
import { Banner, EmptyState, FormField, LoadingBlock, PageFrame, Panel, formatDate, humanize, inputClass } from '../_components/alumni-ui';

const TONE: Record<string, string> = {
  sent: 'bg-emerald-50 text-emerald-800 ring-emerald-200', skipped: 'bg-amber-50 text-amber-800 ring-amber-200', failed: 'bg-red-50 text-red-800 ring-red-200',
  queued: 'bg-blue-50 text-blue-800 ring-blue-200', sending: 'bg-blue-50 text-blue-800 ring-blue-200', draft: 'bg-slate-100 text-slate-600 ring-slate-200',
  scheduled: 'bg-indigo-50 text-indigo-800 ring-indigo-200', cancelled: 'bg-slate-100 text-slate-600 ring-slate-200',
};
const TABS = [['send', 'Send'], ['campaigns', 'Campaigns'], ['templates', 'Templates'], ['history', 'History']] as const;
type Tab = (typeof TABS)[number][0];

function Chip({ value }: { value: string }) {
  return <span className={cn('inline-flex rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset', TONE[value] ?? TONE.draft)}>{humanize(value)}</span>;
}

export default function CommunicationPage() {
  const [tab, setTab] = useState<Tab>('send');
  const [meta, setMeta] = useState<CommMeta | null>(null);
  const [result, setResult] = useState('');   // kept here so it survives the switch from Send to Campaigns
  useEffect(() => {
    const controller = new AbortController();
    alumniApi.commMeta(controller.signal).then(setMeta).catch(() => undefined);
    return () => controller.abort();
  }, []);

  return (
    <PageFrame title="Communication" description="Send announcements, invitations and newsletters to the right alumni, and see exactly what was delivered.">
      <div role="tablist" aria-label="Communication sections" className="flex gap-1 border-b border-slate-200">
        {TABS.map(([key, label]) => (
          <button key={key} role="tab" type="button" aria-selected={tab === key} onClick={() => { setTab(key); setResult(''); }}
            className={cn('border-b-2 px-3 py-2 text-sm font-medium', tab === key ? 'border-indigo-600 text-indigo-700' : 'border-transparent text-slate-600 hover:text-slate-900')}>{label}</button>
        ))}
      </div>
      {tab === 'send' ? <Compose meta={meta} onSent={(message) => { setResult(message); setTab('campaigns'); }} /> : null}
      {tab === 'campaigns' ? <Campaigns result={result} /> : null}
      {tab === 'templates' ? <Templates meta={meta} /> : null}
      {tab === 'history' ? <History meta={meta} /> : null}
    </PageFrame>
  );
}

// ---------------------------------------------------------------------- compose

function Compose({ meta, onSent }: { meta: CommMeta | null; onSent: (message: string) => void }) {
  const [templates, setTemplates] = useState<MessageTemplate[]>([]);
  const [commType, setCommType] = useState('announcement');
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [channels, setChannels] = useState<string[]>(['email', 'web']);
  const [filters, setFilters] = useState<AudienceValue>({});
  const [when, setWhen] = useState('');
  const [preview, setPreview] = useState<AudiencePreview | null>(null);
  const [errors, setErrors] = useState<Record<string, string[]>>({});
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    alumniApi.templates(controller.signal).then(setTemplates).catch(() => undefined);
    return () => controller.abort();
  }, []);

  // the preview is only valid for the audience and channels it was made for, so changing either clears it
  const changeFilters = (next: AudienceValue) => { setFilters(next); setPreview(null); };
  const changeChannels = (next: string[]) => { setChannels(next); setPreview(null); };

  function applyTemplate(id: string) {
    const t = templates.find((x) => String(x.id) === id);
    if (!t) return;
    setCommType(t.comm_type);
    setSubject(t.subject);
    setBody(t.body);
  }

  async function doPreview() {
    setError('');
    if (channels.length === 0) { setErrors({ channels: ['Choose at least one channel.'] }); return; }
    setBusy(true);
    try { setPreview(await alumniApi.previewAudience({ channels, filters })); setErrors({}); }
    catch (reason) { setError(reason instanceof Error ? reason.message : "Couldn't check the audience. Try again."); }
    finally { setBusy(false); }
  }

  async function submit(event: FormEvent, mode: 'now' | 'schedule' | 'draft') {
    event.preventDefault();
    setErrors({}); setError('');
    const missing: Record<string, string[]> = {};
    if (!subject.trim()) missing.subject = ['Write a subject.'];
    if (!body.trim()) missing.body = ['Write the message.'];
    if (channels.length === 0) missing.channels = ['Choose at least one channel.'];
    if (mode === 'schedule' && !when) missing.scheduled_at = ['Choose when to send it.'];
    if (Object.keys(missing).length) { setErrors(missing); return; }
    if (mode === 'now' && !window.confirm(`Send this message now to ${preview ? preview.matched.toLocaleString('en-IN') + ' alumni' : 'the chosen group'}?`)) return;
    setBusy(true);
    try {
      const result = await alumniApi.sendCampaign({
        comm_type: commType, subject: subject.trim(), body, channels, filters,
        scheduled_at: mode === 'schedule' ? when.replace('T', ' ') : undefined, save_as_draft: mode === 'draft',
      });
      const c = result.data;
      let message = mode === 'draft' ? 'Draft saved.' : mode === 'schedule' ? 'Scheduled.'
        : `Done: ${c.sent_count} sent, ${c.skipped_count} skipped, ${c.failed_count} failed, ${c.no_consent_count} not contacted for lack of consent.`;
      if (mode === 'now' && c.status !== 'sent') message = `Sending (${humanize(c.status)}). Check the list below for the result.`;
      onSent(message);
    } catch (reason) {
      if (reason instanceof AlumniApiError) { setErrors(reason.fieldErrors); setError(reason.message); } else setError("Couldn't send the message. Try again.");
    } finally { setBusy(false); }
  }

  return (
    <form className="space-y-4" noValidate onSubmit={(e) => submit(e, 'now')}>
      {error ? <Banner>{error}</Banner> : null}

      <Panel title="Message">
        <div className="grid gap-4 md:grid-cols-3">
          <FormField label="Start from a template">
            <select className={inputClass} defaultValue="" onChange={(e) => applyTemplate(e.target.value)}>
              <option value="">None</option>{templates.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
            </select>
          </FormField>
          <FormField label="Type" required error={errors.comm_type?.[0]}>
            <select className={inputClass} value={commType} onChange={(e) => setCommType(e.target.value)}>{meta?.types.map((t) => <option key={t.key} value={t.key}>{t.label}</option>)}</select>
          </FormField>
          <FormField label="Subject" required error={errors.subject?.[0]}><input className={inputClass} value={subject} onChange={(e) => setSubject(e.target.value)} /></FormField>
          <div className="md:col-span-3">
            <FormField label="Message" required error={errors.body?.[0]} hint={`You can use ${meta?.placeholders.map((p) => `{{${p}}}`).join(', ') ?? 'placeholders'}. Each person gets their own details.`}>
              <textarea className={inputClass + ' h-40 py-2'} value={body} onChange={(e) => setBody(e.target.value)} />
            </FormField>
          </div>
        </div>
      </Panel>

      <Panel title="Who should get it?">
        <AudienceFilters value={filters} onChange={changeFilters} />
        <div className="mt-4"><ChannelPicker meta={meta} value={channels} onChange={changeChannels} /></div>
        {errors.channels?.[0] ? <p className="mt-2 text-xs text-red-700" role="alert">{errors.channels[0]}</p> : null}
        {errors.filters?.[0] ? <p className="mt-2 text-xs text-red-700" role="alert">{errors.filters[0]}</p> : null}
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <Button type="button" variant="outline" className="h-9" disabled={busy} onClick={doPreview}>Check who will be reached</Button>
          {preview ? (
            <p className="text-sm text-slate-700" role="status">
              {preview.matched.toLocaleString('en-IN')} eligible alumni match ({preview.audience_label}).{' '}
              {Object.entries(preview.channels).map(([ch, v]) => `${CHANNEL_LABEL[ch] ?? ch}: ${v.reachable.toLocaleString('en-IN')} reachable, ${v.no_consent.toLocaleString('en-IN')} without consent`).join(' · ')}
            </p>
          ) : null}
        </div>
      </Panel>

      <div className="flex flex-wrap items-end gap-3">
        <Button type="submit" className="h-9" disabled={busy}>Send now</Button>
        <FormField label="Or send later" error={errors.scheduled_at?.[0]}>
          <input className={inputClass + ' w-56'} type="datetime-local" value={when} onChange={(e) => setWhen(e.target.value)} />
        </FormField>
        <Button type="button" variant="outline" className="h-9" disabled={busy} onClick={(e) => submit(e as unknown as FormEvent, 'schedule')}>Schedule</Button>
        <Button type="button" variant="ghost" className="h-9" disabled={busy} onClick={(e) => submit(e as unknown as FormEvent, 'draft')}>Save as draft</Button>
      </div>
    </form>
  );
}

// -------------------------------------------------------------------- campaigns

function Campaigns({ result }: { result: string }) {
  const [page, setPage] = useState(1);
  const [rows, setRows] = useState<Campaign[] | null>(null);
  const [pagination, setPagination] = useState<Pagination | null>(null);
  const [open, setOpen] = useState<number | null>(null);
  const [error, setError] = useState('');

  const load = useCallback((signal?: AbortSignal) =>
    alumniApi.campaigns(page, signal).then((r) => { setRows(r.rows); setPagination(r.pagination); setError(''); }).catch((reason: unknown) => {
      if (reason instanceof DOMException && reason.name === 'AbortError') return;
      setError(reason instanceof Error ? reason.message : "Couldn't load campaigns. Try again.");
    }), [page]);
  useEffect(() => { const c = new AbortController(); void load(c.signal); return () => c.abort(); }, [load]);

  return (
    <div className="space-y-4">
      {result ? <div role="status"><Banner tone="success">{result}</Banner></div> : null}
      {error ? <Banner>{error}</Banner> : null}
      <section className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
        {rows === null ? <LoadingBlock label="Loading campaigns…" /> : rows.length === 0 ? <EmptyState title="No campaigns yet" hint="Messages you send appear here with their delivery results." /> : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[820px] text-left text-sm">
              <thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase tracking-wider text-slate-500">
                <tr><th className="px-4 py-2.5 font-medium">Campaign</th><th className="px-4 py-2.5 font-medium">Audience</th><th className="px-4 py-2.5 font-medium">Status</th><th className="px-3 py-2.5 text-right font-medium">Sent</th><th className="px-3 py-2.5 text-right font-medium">Skipped</th><th className="px-3 py-2.5 text-right font-medium">Failed</th><th className="px-3 py-2.5 text-right font-medium">No consent</th><th className="px-4 py-2.5"><span className="sr-only">Open</span></th></tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {rows.map((c) => (
                  <tr key={c.id} className={cn('hover:bg-slate-50', open === c.id && 'bg-indigo-50/50')}>
                    <td className="px-4 py-3"><span className="font-medium text-slate-900">{c.name}</span><div className="text-xs text-slate-500">{humanize(c.comm_type)} · {c.channels.split(',').map((x) => CHANNEL_LABEL[x] ?? x).join(', ')} · {formatDate(c.created_at)}</div></td>
                    <td className="px-4 py-3 text-slate-700">{c.audience_label}</td>
                    <td className="px-4 py-3"><Chip value={c.status} />{c.scheduled_at && c.status === 'scheduled' ? <div className="text-xs text-slate-500">{formatDate(c.scheduled_at)}</div> : null}</td>
                    <td className="px-3 py-3 text-right tabular-nums">{c.sent_count}</td><td className="px-3 py-3 text-right tabular-nums">{c.skipped_count}</td>
                    <td className="px-3 py-3 text-right tabular-nums">{c.failed_count}</td><td className="px-3 py-3 text-right tabular-nums">{c.no_consent_count}</td>
                    <td className="px-4 py-3 text-right"><Button variant="outline" size="sm" aria-label={`Details of ${c.name}`} onClick={() => setOpen(open === c.id ? null : c.id)}>{open === c.id ? 'Hide' : 'Details'}</Button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {pagination && pagination.last_page > 1 ? (
          <div className="flex items-center justify-end gap-2 border-t border-slate-100 px-4 py-3 text-sm text-slate-600">
            <Button variant="outline" size="sm" disabled={pagination.page <= 1} onClick={() => setPage(pagination.page - 1)}>Previous</Button>
            <span className="tabular-nums">Page {pagination.page} of {pagination.last_page}</span>
            <Button variant="outline" size="sm" disabled={pagination.page >= pagination.last_page} onClick={() => setPage(pagination.page + 1)}>Next</Button>
          </div>
        ) : null}
      </section>
      {open !== null ? <CampaignDetailPanel key={open} id={open} onChanged={() => void load()} /> : null}
    </div>
  );
}

function CampaignDetailPanel({ id, onChanged }: { id: number; onChanged: () => void }) {
  const [d, setD] = useState<CampaignDetail | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const load = useCallback((signal?: AbortSignal) => alumniApi.campaign(id, signal).then(setD).catch((reason: unknown) => {
    if (reason instanceof DOMException && reason.name === 'AbortError') return;
    setError(reason instanceof Error ? reason.message : "Couldn't load the campaign. Try again.");
  }), [id]);
  useEffect(() => { const c = new AbortController(); void load(c.signal); return () => c.abort(); }, [load]);

  async function act(fn: () => Promise<unknown>) {
    setBusy(true); setError('');
    try { await fn(); await load(); onChanged(); } catch (reason) { setError(reason instanceof Error ? reason.message : 'Something went wrong. Try again.'); } finally { setBusy(false); }
  }
  if (!d) return error ? <Banner>{error}</Banner> : <LoadingBlock />;
  const c = d.campaign;
  const groups = d.breakdown.reduce<Record<string, { status: string; total: number }[]>>((acc, r) => { (acc[r.channel] ||= []).push({ status: r.status, total: r.total }); return acc; }, {});

  return (
    <Panel title={c.name} actions={<Chip value={c.status} />}>
      <div className="space-y-4 text-sm">
        {error ? <Banner>{error}</Banner> : null}
        <p className="text-slate-700"><span className="font-medium">Subject:</span> {c.subject}</p>
        <p className="whitespace-pre-wrap rounded-md bg-slate-50 p-3 text-slate-700">{c.body}</p>
        {c.last_error ? <Banner>{c.last_error}</Banner> : null}
        <div>
          <h3 className="mb-1 font-semibold text-slate-800">Delivery by channel</h3>
          {Object.keys(groups).length === 0 ? <p className="text-slate-500">Nothing has been attempted yet.</p> : (
            <ul className="space-y-1">
              {Object.entries(groups).map(([ch, list]) => (
                <li key={ch}>{CHANNEL_LABEL[ch] ?? ch}: {list.map((x) => `${x.total} ${x.status}`).join(', ')}</li>
              ))}
            </ul>
          )}
        </div>
        {d.reasons.length > 0 ? (
          <div>
            <h3 className="mb-1 font-semibold text-slate-800">Why some were not delivered</h3>
            <ul className="space-y-1 text-slate-600">{d.reasons.map((r, i) => <li key={i}>{CHANNEL_LABEL[r.channel] ?? r.channel}: {r.reason} ({r.total})</li>)}</ul>
          </div>
        ) : null}
        <div className="flex flex-wrap gap-2">
          {(c.status === 'draft' || c.status === 'failed') ? <Button className="h-9" disabled={busy} onClick={() => act(() => alumniApi.sendDraftCampaign(id))}>{c.status === 'failed' ? 'Retry sending' : 'Send now'}</Button> : null}
          {(c.status === 'draft' || c.status === 'scheduled') ? <Button variant="outline" className="h-9" disabled={busy} onClick={() => { if (window.confirm('Cancel this campaign?')) void act(() => alumniApi.cancelCampaign(id)); }}>Cancel campaign</Button> : null}
        </div>
      </div>
    </Panel>
  );
}

// -------------------------------------------------------------------- templates

function Templates({ meta }: { meta: CommMeta | null }) {
  const [rows, setRows] = useState<MessageTemplate[] | null>(null);
  const [editing, setEditing] = useState<MessageTemplate | 'new' | null>(null);
  const [f, setF] = useState({ name: '', comm_type: 'announcement', subject: '', body: '' });
  const [errors, setErrors] = useState<Record<string, string[]>>({});
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);

  const load = useCallback((signal?: AbortSignal) => alumniApi.templates(signal).then(setRows).catch((reason: unknown) => {
    if (reason instanceof DOMException && reason.name === 'AbortError') return;
    setError(reason instanceof Error ? reason.message : "Couldn't load templates. Try again.");
  }), []);
  useEffect(() => { const c = new AbortController(); void load(c.signal); return () => c.abort(); }, [load]);

  function open(t: MessageTemplate | 'new') {
    setEditing(t); setErrors({}); setError(''); setNotice('');
    setF(t === 'new' ? { name: '', comm_type: 'announcement', subject: '', body: '' } : { name: t.name, comm_type: t.comm_type, subject: t.subject, body: t.body });
  }
  async function save(event: FormEvent) {
    event.preventDefault();
    setBusy(true); setErrors({}); setError('');
    try {
      await alumniApi.saveTemplate(f, editing !== 'new' && editing ? editing.id : undefined);
      setNotice('Template saved.'); setEditing(null); await load();
    } catch (reason) {
      if (reason instanceof AlumniApiError) { setErrors(reason.fieldErrors); setError(reason.message); } else setError("Couldn't save the template. Try again.");
    } finally { setBusy(false); }
  }

  return (
    <div className="space-y-4">
      {notice ? <Banner tone="success">{notice}</Banner> : null}
      {error ? <Banner>{error}</Banner> : null}
      <div className="flex justify-end"><Button className="h-9" onClick={() => (editing ? setEditing(null) : open('new'))}>{editing ? 'Close form' : 'New template'}</Button></div>
      {editing ? (
        <Panel title={editing === 'new' ? 'New template' : `Edit ${editing.name}`}>
          <form onSubmit={save} className="grid gap-4 md:grid-cols-3" noValidate>
            <FormField label="Name" required error={errors.name?.[0]}><input className={inputClass} value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} /></FormField>
            <FormField label="Type" required error={errors.comm_type?.[0]}><select className={inputClass} value={f.comm_type} onChange={(e) => setF({ ...f, comm_type: e.target.value })}>{meta?.types.map((t) => <option key={t.key} value={t.key}>{t.label}</option>)}</select></FormField>
            <FormField label="Subject" required error={errors.subject?.[0]}><input className={inputClass} value={f.subject} onChange={(e) => setF({ ...f, subject: e.target.value })} /></FormField>
            <div className="md:col-span-3"><FormField label="Message" required error={errors.body?.[0]} hint={`Placeholders: ${meta?.placeholders.map((p) => `{{${p}}}`).join(', ') ?? ''}`}><textarea className={inputClass + ' h-32 py-2'} value={f.body} onChange={(e) => setF({ ...f, body: e.target.value })} /></FormField></div>
            <div><Button type="submit" className="h-9" disabled={busy}>Save template</Button></div>
          </form>
        </Panel>
      ) : null}
      <section className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
        {rows === null ? <LoadingBlock /> : (
          <ul className="divide-y divide-slate-100">
            {rows.map((t) => (
              <li key={t.id} className="flex flex-wrap items-start justify-between gap-3 px-4 py-3">
                <div><p className="font-medium text-slate-900">{t.name} {t.is_system ? <span className="ml-1 text-xs font-normal text-slate-500">built in</span> : null}</p><p className="text-xs text-slate-500">{humanize(t.comm_type)} · {t.subject}</p></div>
                <div className="flex gap-1">
                  <Button size="sm" variant="outline" onClick={() => open(t)} aria-label={`Edit ${t.name}`}>Edit</Button>
                  {t.is_system ? null : <Button size="sm" variant="ghost" aria-label={`Delete ${t.name}`} onClick={() => { if (window.confirm(`Delete “${t.name}”?`)) void alumniApi.deleteTemplate(t.id).then(() => load()).catch((r) => setError(r instanceof Error ? r.message : 'Try again.')); }}>Delete</Button>}
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

// ---------------------------------------------------------------------- history

function History({ meta }: { meta: CommMeta | null }) {
  const [f, setF] = useState({ channel: '', status: '', comm_type: '' });
  const [page, setPage] = useState(1);
  const [rows, setRows] = useState<HistoryRow[] | null>(null);
  const [pagination, setPagination] = useState<Pagination | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    const controller = new AbortController();
    alumniApi.history({ channel: f.channel || undefined, status: f.status || undefined, comm_type: f.comm_type || undefined, page }, controller.signal)
      .then((r) => { setRows(r.rows); setPagination(r.pagination); setError(''); })
      .catch((reason: unknown) => {
        if (reason instanceof DOMException && reason.name === 'AbortError') return;
        setError(reason instanceof Error ? reason.message : "Couldn't load history. Try again.");
      });
    return () => controller.abort();
  }, [f, page]);

  return (
    <div className="space-y-4">
      {error ? <Banner>{error}</Banner> : null}
      <div className="grid gap-2 md:grid-cols-3">
        <select aria-label="Filter by channel" className={inputClass} value={f.channel} onChange={(e) => { setF({ ...f, channel: e.target.value }); setPage(1); }}><option value="">All channels</option>{Object.entries(CHANNEL_LABEL).map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select>
        <select aria-label="Filter by status" className={inputClass} value={f.status} onChange={(e) => { setF({ ...f, status: e.target.value }); setPage(1); }}><option value="">All statuses</option>{['sent', 'skipped', 'failed', 'queued'].map((s) => <option key={s} value={s}>{humanize(s)}</option>)}</select>
        <select aria-label="Filter by type" className={inputClass} value={f.comm_type} onChange={(e) => { setF({ ...f, comm_type: e.target.value }); setPage(1); }}><option value="">All types</option>{meta?.types.map((t) => <option key={t.key} value={t.key}>{t.label}</option>)}</select>
      </div>
      <section className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
        {rows === null ? <LoadingBlock label="Loading history…" /> : rows.length === 0 ? <EmptyState title="No messages yet" hint="Every message attempt is listed here, with its status and the reason when it was not delivered." /> : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[860px] text-left text-sm">
              <thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase tracking-wider text-slate-500">
                <tr><th className="px-4 py-2.5 font-medium">Date</th><th className="px-4 py-2.5 font-medium">Alumnus</th><th className="px-4 py-2.5 font-medium">Message</th><th className="px-4 py-2.5 font-medium">Channel</th><th className="px-4 py-2.5 font-medium">Status</th><th className="px-4 py-2.5 font-medium">Group</th></tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {rows.map((r) => (
                  <tr key={r.id}>
                    <td className="px-4 py-3 text-slate-600">{formatDate(r.created_at)}</td>
                    <td className="px-4 py-3"><Link href={`/alumni/profile/${r.alumni_id}`} className="text-indigo-700 hover:underline">{r.full_name}</Link></td>
                    <td className="px-4 py-3 text-slate-700">{r.subject}<div className="text-xs text-slate-500">{humanize(r.comm_type)}{r.is_transactional ? ' · notice' : ''}</div></td>
                    <td className="px-4 py-3 text-slate-700">{CHANNEL_LABEL[r.channel] ?? r.channel}</td>
                    <td className="px-4 py-3"><Chip value={r.status} />{r.reason ? <div className="mt-1 max-w-xs text-xs text-slate-500">{r.reason}</div> : null}</td>
                    <td className="px-4 py-3 text-slate-600">{r.recipient_group ?? r.campaign_name ?? 'Automatic'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {pagination && pagination.last_page > 1 ? (
          <div className="flex items-center justify-end gap-2 border-t border-slate-100 px-4 py-3 text-sm text-slate-600">
            <Button variant="outline" size="sm" disabled={pagination.page <= 1} onClick={() => setPage(pagination.page - 1)}>Previous</Button>
            <span className="tabular-nums">Page {pagination.page} of {pagination.last_page}</span>
            <Button variant="outline" size="sm" disabled={pagination.page >= pagination.last_page} onClick={() => setPage(pagination.page + 1)}>Next</Button>
          </div>
        ) : null}
      </section>
    </div>
  );
}

'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import {
  alumniApi, AlumniApiError, type DonationCampaign, type DonationDetail, type DonationReceipt, type DonationRow, type DonationSummary, type Pagination,
} from '../_lib/alumni-api';
import { DonorPicker, type Picked } from '../_components/entity-picker';
import { Banner, EmptyState, FormField, LoadingBlock, MetricTile, PageFrame, Panel, ProgressBar, formatDate, humanize, inputClass } from '../_components/alumni-ui';

const TONE: Record<string, string> = {
  pledged: 'bg-slate-100 text-slate-700 ring-slate-200', pending_verification: 'bg-amber-50 text-amber-800 ring-amber-200', verified: 'bg-emerald-50 text-emerald-800 ring-emerald-200',
  rejected: 'bg-red-50 text-red-800 ring-red-200', cancelled: 'bg-slate-100 text-slate-500 ring-slate-200', partially_refunded: 'bg-blue-50 text-blue-800 ring-blue-200', refunded: 'bg-blue-50 text-blue-800 ring-blue-200',
};
const STATUS_LABEL: Record<string, string> = { pending_verification: 'Awaiting verification', partially_refunded: 'Partly refunded' };
const money = (v: string | number | null | undefined) => `₹${Number(v ?? 0).toLocaleString('en-IN', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;
const today = () => new Date().toISOString().slice(0, 10);

function Chip({ value }: { value: string }) {
  return <span className={cn('inline-flex rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset', TONE[value] ?? TONE.pledged)}>{STATUS_LABEL[value] ?? humanize(value)}</span>;
}

const TABS = [['donations', 'Donations'], ['campaigns', 'Campaigns'], ['summary', 'Summary']] as const;
type Tab = (typeof TABS)[number][0];

export default function DonationsPage() {
  const [tab, setTab] = useState<Tab>('donations');
  return (
    <PageFrame title="Donations" description="Record gifts received by cash, cheque or transfer, confirm them, and issue receipts. Online payment is not enabled.">
      <Banner tone="info">Money is counted only after a person verifies it. Pledges and unverified entries are shown separately and never count as raised.</Banner>
      <div role="tablist" aria-label="Donation sections" className="flex gap-1 border-b border-slate-200">
        {TABS.map(([key, label]) => (
          <button key={key} role="tab" type="button" aria-selected={tab === key} onClick={() => setTab(key)}
            className={cn('border-b-2 px-3 py-2 text-sm font-medium', tab === key ? 'border-indigo-600 text-indigo-700' : 'border-transparent text-slate-600 hover:text-slate-900')}>{label}</button>
        ))}
      </div>
      {tab === 'donations' ? <Donations /> : null}
      {tab === 'campaigns' ? <Campaigns /> : null}
      {tab === 'summary' ? <Summary /> : null}
    </PageFrame>
  );
}

// -------------------------------------------------------------------- donations

function Donations() {
  const [filters, setFilters] = useState({ status: '', q: '' });
  const [page, setPage] = useState(1);
  const [data, setData] = useState<{ rows: DonationRow[]; modes: { key: string; label: string }[]; pagination: Pagination } | null>(null);
  const [campaigns, setCampaigns] = useState<DonationCampaign[]>([]);
  const [open, setOpen] = useState<number | null>(null);
  const [adding, setAdding] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const load = useCallback((signal?: AbortSignal) =>
    alumniApi.donations({ status: filters.status || undefined, q: filters.q || undefined, page }, signal).then((r) => { setData(r); setError(''); }).catch((reason: unknown) => {
      if (reason instanceof DOMException && reason.name === 'AbortError') return;
      setError(reason instanceof Error ? reason.message : "Couldn't load donations. Try again.");
    }), [filters, page]);
  useEffect(() => { const c = new AbortController(); void load(c.signal); return () => c.abort(); }, [load]);
  useEffect(() => { const c = new AbortController(); alumniApi.donationCampaigns(c.signal).then(setCampaigns).catch(() => undefined); return () => c.abort(); }, []);

  return (
    <div className="space-y-4">
      {notice ? <Banner tone="success">{notice}</Banner> : null}
      {error ? <Banner>{error}</Banner> : null}
      <div className="flex flex-wrap items-center gap-2">
        <input aria-label="Search donations" placeholder="Search donor, receipt or reference" className={inputClass + ' max-w-xs'} value={filters.q} onChange={(e) => { setFilters({ ...filters, q: e.target.value }); setPage(1); }} />
        <select aria-label="Filter by status" className={inputClass + ' max-w-[14rem]'} value={filters.status} onChange={(e) => { setFilters({ ...filters, status: e.target.value }); setPage(1); }}>
          <option value="">All statuses</option>
          {['pledged', 'pending_verification', 'verified', 'rejected', 'cancelled', 'partially_refunded', 'refunded'].map((s) => <option key={s} value={s}>{STATUS_LABEL[s] ?? humanize(s)}</option>)}
        </select>
        <Button className="ml-auto h-9" onClick={() => setAdding((v) => !v)}>{adding ? 'Close form' : 'Record donation'}</Button>
      </div>
      {adding ? <DonationForm modes={data?.modes ?? []} campaigns={campaigns.filter((c) => c.status !== 'closed')} onSaved={(m) => { setAdding(false); setNotice(m); void load(); }} /> : null}

      <section className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
        {data === null ? <LoadingBlock label="Loading donations…" /> : data.rows.length === 0 ? <EmptyState title="No donations found" hint="Record a gift or a pledge to get started." /> : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[820px] text-left text-sm">
              <thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase tracking-wider text-slate-500">
                <tr><th className="px-4 py-2.5 font-medium">Donor</th><th className="px-4 py-2.5 text-right font-medium">Amount</th><th className="px-4 py-2.5 font-medium">Campaign</th><th className="px-4 py-2.5 font-medium">Date</th><th className="px-4 py-2.5 font-medium">Status</th><th className="px-4 py-2.5 font-medium">Receipt</th><th className="px-4 py-2.5"><span className="sr-only">Open</span></th></tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {data.rows.map((d) => (
                  <tr key={d.id} className={cn('hover:bg-slate-50', open === d.id && 'bg-indigo-50/50')}>
                    <td className="px-4 py-3"><Link href={`/alumni/profile/${d.alumni_id}`} className="font-medium text-indigo-700 hover:underline">{d.full_name}</Link><div className="text-xs text-slate-500">{d.alumni_code}{d.anonymous ? ' · anonymous' : ''}</div></td>
                    <td className="px-4 py-3 text-right tabular-nums">{money(d.amount)}{Number(d.refunded_amount) > 0 ? <div className="text-xs text-slate-500">{money(d.refunded_amount)} refunded</div> : null}</td>
                    <td className="px-4 py-3 text-slate-700">{d.campaign_name ?? '—'}</td>
                    <td className="px-4 py-3 text-slate-700">{formatDate(d.received_on ?? d.pledged_on)}</td>
                    <td className="px-4 py-3"><Chip value={d.status} /></td>
                    <td className="px-4 py-3 text-slate-700">{d.receipt_no ?? '—'}</td>
                    <td className="px-4 py-3 text-right"><Button size="sm" variant="outline" aria-label={`Open donation ${d.id} from ${d.full_name}`} onClick={() => setOpen(open === d.id ? null : d.id)}>{open === d.id ? 'Hide' : 'Open'}</Button></td>
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
      {open !== null ? <DonationPanel key={open} id={open} modes={data?.modes ?? []} onChanged={() => void load()} /> : null}
    </div>
  );
}

function DonationForm({ modes, campaigns, onSaved }: { modes: { key: string; label: string }[]; campaigns: DonationCampaign[]; onSaved: (message: string) => void }) {
  const [who, setWho] = useState<Picked | null>(null);
  const [f, setF] = useState({ amount: '', campaign_id: '', purpose: '', payment_mode: '', received_on: '', reference_no: '', anonymous: false, notes: '' });
  const [errors, setErrors] = useState<Record<string, string[]>>({});
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setErrors({}); setError('');
    const missing: Record<string, string[]> = {};
    if (!who) missing.alumni_id = ['Choose the donor.'];
    if (!f.amount || Number(f.amount) <= 0) missing.amount = ['Enter an amount greater than zero.'];
    if (!!f.payment_mode !== !!f.received_on) missing[f.payment_mode ? 'received_on' : 'payment_mode'] = ['Give both the payment mode and the date received, or leave both empty for a pledge.'];
    if (Object.keys(missing).length) { setErrors(missing); return; }
    setBusy(true);
    try {
      const body: Record<string, unknown> = { alumni_id: who!.id, amount: Number(f.amount), anonymous: f.anonymous };
      for (const k of ['campaign_id', 'purpose', 'payment_mode', 'received_on', 'reference_no', 'notes'] as const) if (f[k]) body[k] = k === 'campaign_id' ? Number(f[k]) : f[k];
      await alumniApi.recordDonation(body);
      onSaved(f.payment_mode ? 'Donation recorded. It now needs to be verified before it counts.' : 'Pledge recorded.');
    } catch (reason) {
      if (reason instanceof AlumniApiError) { setErrors(reason.fieldErrors); setError(reason.message); } else setError("Couldn't save the donation. Try again.");
    } finally { setBusy(false); }
  }

  return (
    <Panel title="Record a donation or pledge">
      <form onSubmit={submit} noValidate className="space-y-4">
        {error ? <Banner>{error}</Banner> : null}
        <div className="grid gap-4 md:grid-cols-4">
          <div className="md:col-span-2"><FormField label="Donor" required error={errors.alumni_id?.[0]}><DonorPicker value={who} onChange={setWho} /></FormField></div>
          <FormField label="Amount (₹)" required error={errors.amount?.[0]}><input className={inputClass} type="number" min="0" step="0.01" value={f.amount} onChange={(e) => setF({ ...f, amount: e.target.value })} /></FormField>
          <FormField label="Campaign" error={errors.campaign_id?.[0]}><select className={inputClass} value={f.campaign_id} onChange={(e) => setF({ ...f, campaign_id: e.target.value })}><option value="">None</option>{campaigns.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select></FormField>
          <FormField label="Payment mode" error={errors.payment_mode?.[0]} hint="Leave empty for a pledge"><select className={inputClass} value={f.payment_mode} onChange={(e) => setF({ ...f, payment_mode: e.target.value })}><option value="">Not received yet</option>{modes.map((m) => <option key={m.key} value={m.key}>{m.label}</option>)}</select></FormField>
          <FormField label="Date received" error={errors.received_on?.[0]}><input className={inputClass} type="date" max={today()} value={f.received_on} onChange={(e) => setF({ ...f, received_on: e.target.value })} /></FormField>
          <FormField label="Cheque no. / transaction id" error={errors.reference_no?.[0]}><input className={inputClass} value={f.reference_no} onChange={(e) => setF({ ...f, reference_no: e.target.value })} /></FormField>
          <FormField label="Purpose"><input className={inputClass} value={f.purpose} onChange={(e) => setF({ ...f, purpose: e.target.value })} /></FormField>
          <div className="md:col-span-3"><FormField label="Notes"><input className={inputClass} value={f.notes} onChange={(e) => setF({ ...f, notes: e.target.value })} /></FormField></div>
          <label className="flex items-center gap-2 pt-6 text-sm text-slate-700"><input type="checkbox" checked={f.anonymous} onChange={(e) => setF({ ...f, anonymous: e.target.checked })} /> Donor wishes to stay anonymous</label>
        </div>
        <Button type="submit" className="h-9" disabled={busy}>{f.payment_mode ? 'Record donation' : 'Record pledge'}</Button>
      </form>
    </Panel>
  );
}

type Mode = null | 'received' | 'reject' | 'cancel' | 'refund' | 'edit';

function DonationPanel({ id, modes, onChanged }: { id: number; modes: { key: string; label: string }[]; onChanged: () => void }) {
  const [d, setD] = useState<DonationDetail | null>(null);
  const [mode, setMode] = useState<Mode>(null);
  const [f, setF] = useState({ reason: '', amount: '', date: today(), payment_mode: 'cash', reference_no: '' });
  const [errors, setErrors] = useState<Record<string, string[]>>({});
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);
  const [receipt, setReceipt] = useState<DonationReceipt | null>(null);

  const load = useCallback((signal?: AbortSignal) => alumniApi.donation(id, signal).then(setD).catch((reason: unknown) => {
    if (reason instanceof DOMException && reason.name === 'AbortError') return;
    setError(reason instanceof Error ? reason.message : "Couldn't load the donation. Try again.");
  }), [id]);
  useEffect(() => { const c = new AbortController(); void load(c.signal); return () => c.abort(); }, [load]);

  async function run(label: string, fn: () => Promise<unknown>) {
    setBusy(true); setError(''); setNotice(''); setErrors({});
    try { await fn(); setNotice(label); setMode(null); await load(); onChanged(); }
    catch (reason) { if (reason instanceof AlumniApiError) { setErrors(reason.fieldErrors); setError(reason.message); } else setError('Something went wrong. Try again.'); }
    finally { setBusy(false); }
  }
  function open(next: Exclude<Mode, null>) {
    setMode(next); setErrors({}); setError(''); setNotice('');
    setF({ reason: '', amount: '', date: today(), payment_mode: d?.donation.payment_mode ?? 'cash', reference_no: d?.donation.reference_no ?? '' });
  }

  if (!d) return error ? <Banner>{error}</Banner> : <LoadingBlock />;
  const x = d.donation;
  const left = Number(x.amount) - Number(x.refunded_amount);

  return (
    <Panel title={`${money(x.amount)} from ${d.alumnus?.full_name ?? 'donor'}`} actions={<Chip value={x.status} />}>
      <div className="space-y-4 text-sm">
        {notice ? <Banner tone="success">{notice}</Banner> : null}
        {error ? <Banner>{error}</Banner> : null}
        <dl className="grid gap-x-6 gap-y-2 md:grid-cols-3">
          <div><dt className="text-slate-500">Payment</dt><dd>{x.payment_mode ? `${humanize(x.payment_mode)}${x.reference_no ? ` · ${x.reference_no}` : ''}` : 'Not received yet (pledge)'}</dd></div>
          <div><dt className="text-slate-500">{x.received_on ? 'Received' : 'Pledged'}</dt><dd>{formatDate(x.received_on ?? x.pledged_on)}</dd></div>
          <div><dt className="text-slate-500">Receipt</dt><dd>{x.receipt_no ?? 'Issued after verification'}</dd></div>
          {x.purpose ? <div><dt className="text-slate-500">Purpose</dt><dd>{x.purpose}</dd></div> : null}
          {x.notes ? <div className="md:col-span-2"><dt className="text-slate-500">Notes</dt><dd>{x.notes}</dd></div> : null}
          {x.decision_note ? <div className="md:col-span-3"><dt className="text-slate-500">Reason recorded</dt><dd>{x.decision_note}</dd></div> : null}
        </dl>
        {d.refunds.length > 0 ? (
          <div><h3 className="mb-1 font-semibold text-slate-800">Refunds</h3>
            <ul className="space-y-1 text-slate-600">{d.refunds.map((r) => <li key={r.id}>{money(r.amount)} on {formatDate(r.refunded_on)} — {r.reason}</li>)}</ul></div>
        ) : null}

        <div className="flex flex-wrap gap-2">
          {x.status === 'pledged' ? <Button className="h-9" onClick={() => open('received')}>Mark as received</Button> : null}
          {(x.status === 'pledged' || x.status === 'pending_verification') ? <Button variant="outline" className="h-9" onClick={() => open('edit')}>Correct details</Button> : null}
          {x.status === 'pending_verification' ? <Button className="h-9" disabled={busy} onClick={() => { if (window.confirm(`Confirm that ${money(x.amount)} was really received? A receipt number will be issued and cannot be undone.`)) void run('Verified. Receipt issued.', () => alumniApi.donationAction(id, 'verify')); }}>Verify and issue receipt</Button> : null}
          {x.status === 'pending_verification' ? <Button variant="outline" className="h-9" onClick={() => open('reject')}>Reject</Button> : null}
          {(x.status === 'pledged' || x.status === 'pending_verification') ? <Button variant="ghost" className="h-9" onClick={() => open('cancel')}>Cancel</Button> : null}
          {(x.status === 'verified' || x.status === 'partially_refunded') && left > 0 ? <Button variant="outline" className="h-9" onClick={() => open('refund')}>Record a refund</Button> : null}
          {x.receipt_no ? <Button variant="outline" className="h-9" disabled={busy} onClick={() => void alumniApi.donationReceipt(id).then(setReceipt).catch((r) => setError(r instanceof Error ? r.message : 'Try again.'))}>View receipt</Button> : null}
        </div>

        {mode ? (
          <form noValidate className="grid gap-3 rounded-md border border-slate-200 p-3 md:grid-cols-4" onSubmit={(e) => {
            e.preventDefault();
            if (mode === 'received') void run('Marked as received. It still needs to be verified.', () => alumniApi.donationAction(id, 'received', { payment_mode: f.payment_mode, reference_no: f.reference_no || null, received_on: f.date }));
            if (mode === 'edit') void run('Details updated.', () => alumniApi.updateDonation(id, { payment_mode: f.payment_mode || null, reference_no: f.reference_no || null }));
            if (mode === 'reject' || mode === 'cancel') void run(mode === 'reject' ? 'Donation rejected.' : 'Donation cancelled.', () => alumniApi.donationAction(id, mode, { reason: f.reason }));
            if (mode === 'refund') void run('Refund recorded.', () => alumniApi.donationAction(id, 'refund', { amount: Number(f.amount), reason: f.reason, refunded_on: f.date }));
          }}>
            {(mode === 'received' || mode === 'edit') ? <>
              <FormField label="Payment mode" error={errors.payment_mode?.[0]}><select className={inputClass} value={f.payment_mode} onChange={(e) => setF({ ...f, payment_mode: e.target.value })}>{modes.map((m) => <option key={m.key} value={m.key}>{m.label}</option>)}</select></FormField>
              <FormField label="Cheque no. / transaction id" error={errors.reference_no?.[0]}><input className={inputClass} value={f.reference_no} onChange={(e) => setF({ ...f, reference_no: e.target.value })} /></FormField>
              {mode === 'received' ? <FormField label="Date received" error={errors.received_on?.[0]}><input className={inputClass} type="date" max={today()} value={f.date} onChange={(e) => setF({ ...f, date: e.target.value })} /></FormField> : null}
            </> : null}
            {mode === 'refund' ? <>
              <FormField label={`Amount (up to ${money(left)})`} required error={errors.amount?.[0]}><input className={inputClass} type="number" min="0" step="0.01" value={f.amount} onChange={(e) => setF({ ...f, amount: e.target.value })} /></FormField>
              <FormField label="Refund date" error={errors.refunded_on?.[0]}><input className={inputClass} type="date" max={today()} value={f.date} onChange={(e) => setF({ ...f, date: e.target.value })} /></FormField>
            </> : null}
            {(mode === 'reject' || mode === 'cancel' || mode === 'refund') ? <div className="md:col-span-2"><FormField label="Reason" required error={errors.reason?.[0]}><input className={inputClass} value={f.reason} onChange={(e) => setF({ ...f, reason: e.target.value })} /></FormField></div> : null}
            <div className="flex items-end gap-2"><Button type="submit" className="h-9" disabled={busy}>Confirm</Button><Button type="button" variant="ghost" className="h-9" onClick={() => setMode(null)}>Close</Button></div>
          </form>
        ) : null}

        {receipt ? <ReceiptView receipt={receipt} onClose={() => setReceipt(null)} /> : null}
      </div>
    </Panel>
  );
}

function ReceiptView({ receipt: r, onClose }: { receipt: DonationReceipt; onClose: () => void }) {
  return (
    <div className="rounded-md border border-slate-300 bg-white p-5" id="alumni-receipt">
      <p className="text-xs uppercase tracking-widest text-slate-500">{r.kind}</p>
      <h3 className="text-lg font-semibold text-slate-900">{r.institute}</h3>
      <dl className="mt-3 grid gap-2 md:grid-cols-2">
        <div><dt className="text-slate-500">Receipt number</dt><dd className="font-medium">{r.receipt_no}</dd></div>
        <div><dt className="text-slate-500">Issued</dt><dd>{formatDate(r.issued_at)}</dd></div>
        <div><dt className="text-slate-500">Received from</dt><dd>{r.donor?.name ?? '—'}{r.donor ? ` (${r.donor.alumni_code})` : ''}</dd></div>
        <div><dt className="text-slate-500">Amount</dt><dd className="font-medium">{money(r.amount)}</dd></div>
        <div><dt className="text-slate-500">Mode</dt><dd>{humanize(r.payment_mode)}{r.reference_no ? ` · ${r.reference_no}` : ''}</dd></div>
        <div><dt className="text-slate-500">Date received</dt><dd>{formatDate(r.received_on)}</dd></div>
        {r.campaign || r.purpose ? <div className="md:col-span-2"><dt className="text-slate-500">For</dt><dd>{[r.campaign, r.purpose].filter(Boolean).join(' · ')}</dd></div> : null}
        {r.refunded_amount > 0 ? <div className="md:col-span-2"><dt className="text-slate-500">Refunded since</dt><dd>{money(r.refunded_amount)}</dd></div> : null}
      </dl>
      <p className="mt-3 text-xs text-slate-500">This is an acknowledgement of a gift received. It is not a tax-exemption certificate.</p>
      <div className="mt-3 flex gap-2 print:hidden"><Button className="h-9" onClick={() => window.print()}>Print</Button><Button variant="ghost" className="h-9" onClick={onClose}>Close</Button></div>
    </div>
  );
}

// -------------------------------------------------------------------- campaigns

function Campaigns() {
  const [rows, setRows] = useState<DonationCampaign[] | null>(null);
  const [editing, setEditing] = useState<DonationCampaign | 'new' | null>(null);
  const [f, setF] = useState({ name: '', purpose: '', goal_amount: '', starts_on: '', ends_on: '', status: 'active', description: '' });
  const [errors, setErrors] = useState<Record<string, string[]>>({});
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);

  const load = useCallback((signal?: AbortSignal) => alumniApi.donationCampaigns(signal).then(setRows).catch((reason: unknown) => {
    if (reason instanceof DOMException && reason.name === 'AbortError') return;
    setError(reason instanceof Error ? reason.message : "Couldn't load campaigns. Try again.");
  }), []);
  useEffect(() => { const c = new AbortController(); void load(c.signal); return () => c.abort(); }, [load]);

  function open(c: DonationCampaign | 'new') {
    setEditing(c); setErrors({}); setError(''); setNotice('');
    setF(c === 'new' ? { name: '', purpose: '', goal_amount: '', starts_on: '', ends_on: '', status: 'active', description: '' }
      : { name: c.name, purpose: c.purpose ?? '', goal_amount: c.goal_amount ?? '', starts_on: c.starts_on?.slice(0, 10) ?? '', ends_on: c.ends_on?.slice(0, 10) ?? '', status: c.status, description: c.description ?? '' });
  }
  async function save(event: FormEvent) {
    event.preventDefault();
    setErrors({}); setError('');
    if (!f.name.trim()) { setErrors({ name: ['Give the campaign a name.'] }); return; }
    setBusy(true);
    try {
      const body: Record<string, unknown> = { ...f, goal_amount: f.goal_amount ? Number(f.goal_amount) : null };
      for (const k of Object.keys(body)) if (body[k] === '') body[k] = null;
      await alumniApi.saveDonationCampaign(body, editing && editing !== 'new' ? editing.id : undefined);
      setNotice('Campaign saved.'); setEditing(null); await load();
    } catch (reason) { if (reason instanceof AlumniApiError) { setErrors(reason.fieldErrors); setError(reason.message); } else setError("Couldn't save the campaign. Try again."); }
    finally { setBusy(false); }
  }

  return (
    <div className="space-y-4">
      {notice ? <Banner tone="success">{notice}</Banner> : null}
      {error ? <Banner>{error}</Banner> : null}
      <div className="flex justify-end"><Button className="h-9" onClick={() => (editing ? setEditing(null) : open('new'))}>{editing ? 'Close form' : 'New campaign'}</Button></div>
      {editing ? (
        <Panel title={editing === 'new' ? 'New campaign' : `Edit ${editing.name}`}>
          <form onSubmit={save} noValidate className="grid gap-4 md:grid-cols-4">
            <div className="md:col-span-2"><FormField label="Name" required error={errors.name?.[0]}><input className={inputClass} value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} /></FormField></div>
            <FormField label="Purpose" error={errors.purpose?.[0]}><input className={inputClass} value={f.purpose} onChange={(e) => setF({ ...f, purpose: e.target.value })} /></FormField>
            <FormField label="Goal (₹)" error={errors.goal_amount?.[0]}><input className={inputClass} type="number" min="0" value={f.goal_amount} onChange={(e) => setF({ ...f, goal_amount: e.target.value })} /></FormField>
            <FormField label="Starts" error={errors.starts_on?.[0]}><input className={inputClass} type="date" value={f.starts_on} onChange={(e) => setF({ ...f, starts_on: e.target.value })} /></FormField>
            <FormField label="Ends" error={errors.ends_on?.[0]}><input className={inputClass} type="date" value={f.ends_on} onChange={(e) => setF({ ...f, ends_on: e.target.value })} /></FormField>
            <FormField label="Status"><select className={inputClass} value={f.status} onChange={(e) => setF({ ...f, status: e.target.value })}><option value="draft">Draft</option><option value="active">Active</option><option value="closed">Closed</option></select></FormField>
            <div className="md:col-span-4"><FormField label="Description"><textarea className={inputClass + ' h-20 py-2'} value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} /></FormField></div>
            <div><Button type="submit" className="h-9" disabled={busy}>Save campaign</Button></div>
          </form>
        </Panel>
      ) : null}
      <section className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
        {rows === null ? <LoadingBlock /> : rows.length === 0 ? <EmptyState title="No campaigns yet" hint="Create one to group donations towards a goal." /> : (
          <ul className="divide-y divide-slate-100">
            {rows.map((c) => (
              <li key={c.id} className="space-y-2 px-4 py-3">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div><p className="font-medium text-slate-900">{c.name} <span className="ml-1 text-xs font-normal text-slate-500">{humanize(c.status)}</span></p><p className="text-xs text-slate-500">{c.purpose ?? ''}{c.ends_on ? ` · ends ${formatDate(c.ends_on)}` : ''}</p></div>
                  <Button size="sm" variant="outline" aria-label={`Edit ${c.name}`} onClick={() => open(c)}>Edit</Button>
                </div>
                <p className="text-sm text-slate-700">{money(c.raised)} raised{c.goal_amount ? ` of ${money(c.goal_amount)}` : ''}</p>
                {c.percent !== null ? <ProgressBar percent={c.percent} /> : null}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

// ---------------------------------------------------------------------- summary

function Summary() {
  const [range, setRange] = useState({ from: '', to: '' });
  const [s, setS] = useState<DonationSummary | null>(null);
  const [error, setError] = useState('');
  useEffect(() => {
    const c = new AbortController();
    alumniApi.donationSummary({ from: range.from || undefined, to: range.to || undefined }, c.signal).then((r) => { setS(r); setError(''); }).catch((reason: unknown) => {
      if (reason instanceof DOMException && reason.name === 'AbortError') return;
      setError(reason instanceof Error ? reason.message : "Couldn't load the summary. Try again.");
    });
    return () => c.abort();
  }, [range]);

  return (
    <div className="space-y-4">
      {error ? <Banner>{error}</Banner> : null}
      <div className="grid gap-3 md:grid-cols-4">
        <FormField label="From"><input className={inputClass} type="date" value={range.from} onChange={(e) => setRange({ ...range, from: e.target.value })} /></FormField>
        <FormField label="To"><input className={inputClass} type="date" value={range.to} onChange={(e) => setRange({ ...range, to: e.target.value })} /></FormField>
      </div>
      {!s ? <LoadingBlock /> : (
        <>
          <div className="grid gap-3 md:grid-cols-4">
            <MetricTile label="Raised (verified, net of refunds)" value={money(s.raised)} hint={`${s.verified_count} donations from ${s.donors} donors`} />
            <MetricTile label="Refunded" value={money(s.refunded)} />
            <MetricTile label="Awaiting verification" value={money(s.pending_amount)} hint={`${s.pending_count} entries — not counted`} />
            <MetricTile label="Pledged" value={money(s.pledged_amount)} hint={`${s.pledged_count} pledges — not counted`} />
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <Panel title="By campaign">
              {s.by_campaign.length === 0 ? <p className="text-sm text-slate-500">No verified donations yet.</p> : <ul className="divide-y divide-slate-100 text-sm">{s.by_campaign.map((c) => <li key={c.name} className="flex justify-between py-2"><span>{c.name} <span className="text-xs text-slate-500">{c.donations} gifts</span></span><span className="tabular-nums">{money(c.net)}</span></li>)}</ul>}
            </Panel>
            <Panel title="Top donors">
              {s.top_donors.length === 0 ? <p className="text-sm text-slate-500">No verified donations yet.</p> : <ul className="divide-y divide-slate-100 text-sm">{s.top_donors.map((d, i) => <li key={i} className="flex justify-between py-2"><span>{d.alumni_id ? <Link className="text-indigo-700 hover:underline" href={`/alumni/profile/${d.alumni_id}`}>{d.name}</Link> : d.name}</span><span className="tabular-nums">{money(d.net)}</span></li>)}</ul>}
            </Panel>
            <Panel title="By month" className="md:col-span-2">
              {s.by_month.length === 0 ? <p className="text-sm text-slate-500">No verified donations yet.</p> : <ul className="divide-y divide-slate-100 text-sm">{s.by_month.map((m) => <li key={m.month} className="flex justify-between py-2"><span>{m.month} <span className="text-xs text-slate-500">{m.donations} gifts</span></span><span className="tabular-nums">{money(m.net)}</span></li>)}</ul>}
            </Panel>
          </div>
        </>
      )}
    </div>
  );
}

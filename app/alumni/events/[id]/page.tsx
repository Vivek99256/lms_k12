'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import {
  alumniApi, AlumniApiError, type CommMeta, type EventDetail, type EventRegistration, type EventReport,
} from '../../_lib/alumni-api';
import { AlumniPicker, type Picked } from '../../_components/entity-picker';
import { ChannelPicker } from '../../_components/audience';
import { EventForm, EventStatus } from '../../_components/event-bits';
import { Banner, EmptyState, FormField, LoadingBlock, MetricTile, PageFrame, Panel, formatDate, humanize, inputClass } from '../../_components/alumni-ui';

const TABS = [['overview', 'Overview'], ['registrations', 'Registrations'], ['checkin', 'Check-in'], ['report', 'Report and feedback'], ['files', 'Files']] as const;
type Tab = (typeof TABS)[number][0];

export default function EventDetailPage() {
  const params = useParams<{ id: string }>();
  const id = Number(params.id);
  const [tab, setTab] = useState<Tab>('overview');
  const [detail, setDetail] = useState<EventDetail | null>(null);
  const [error, setError] = useState('');

  const load = useCallback((signal?: AbortSignal) => alumniApi.event(id, signal).then((d) => { setDetail(d); setError(''); }).catch((reason: unknown) => {
    if (reason instanceof DOMException && reason.name === 'AbortError') return;
    setError(reason instanceof Error ? reason.message : "Couldn't load the event. Try again.");
  }), [id]);
  useEffect(() => { const c = new AbortController(); void load(c.signal); return () => c.abort(); }, [load]);

  if (!detail) return <PageFrame title="Event">{error ? <Banner>{error}</Banner> : <LoadingBlock label="Loading event…" />}</PageFrame>;
  const e = detail.event;

  return (
    <PageFrame title={e.name} description={`${humanize(e.event_type)} · ${formatDate(e.event_date)}${e.venue ? ` · ${e.venue}` : ''}`}
      actions={<><EventStatus value={e.status} /><Link href="/alumni/events" className="ml-3 text-sm text-indigo-700 hover:underline">All events</Link></>}>
      <div role="tablist" aria-label="Event sections" className="flex flex-wrap gap-1 border-b border-slate-200">
        {TABS.map(([key, label]) => (
          <button key={key} role="tab" type="button" aria-selected={tab === key} onClick={() => setTab(key)}
            className={cn('border-b-2 px-3 py-2 text-sm font-medium', tab === key ? 'border-indigo-600 text-indigo-700' : 'border-transparent text-slate-600 hover:text-slate-900')}>{label}</button>
        ))}
      </div>
      {tab === 'overview' ? <Overview detail={detail} onChanged={() => void load()} /> : null}
      {tab === 'registrations' ? <Registrations detail={detail} onChanged={() => void load()} /> : null}
      {tab === 'checkin' ? <CheckIn detail={detail} /> : null}
      {tab === 'report' ? <Report detail={detail} /> : null}
      {tab === 'files' ? <Files detail={detail} onChanged={() => void load()} /> : null}
    </PageFrame>
  );
}

// --------------------------------------------------------------------- overview

function Overview({ detail, onChanged }: { detail: EventDetail; onChanged: () => void }) {
  const e = detail.event;
  const [editing, setEditing] = useState(false);
  const [meta, setMeta] = useState<CommMeta | null>(null);
  const [types, setTypes] = useState<{ key: string; label: string }[]>([]);
  const [channels, setChannels] = useState<string[]>(['email', 'web']);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const c = new AbortController();
    alumniApi.commMeta(c.signal).then(setMeta).catch(() => undefined);
    alumniApi.events({}, c.signal).then((r) => setTypes(r.types)).catch(() => undefined);
    return () => c.abort();
  }, []);

  async function run(label: string, fn: () => Promise<unknown>, confirmText?: string) {
    if (confirmText && !window.confirm(confirmText)) return;
    setBusy(true); setError(''); setNotice('');
    try { await fn(); setNotice(label); onChanged(); } catch (reason) { setError(reason instanceof Error ? reason.message : 'Something went wrong. Try again.'); } finally { setBusy(false); }
  }

  const open = e.status === 'draft' || e.status === 'published';
  return (
    <div className="space-y-4">
      {notice ? <Banner tone="success">{notice}</Banner> : null}
      {error ? <Banner>{error}</Banner> : null}
      <div className="grid gap-3 md:grid-cols-4">
        <MetricTile label="Seats used" value={e.capacity ? `${e.seats_used} / ${e.capacity}` : String(e.seats_used)} hint={e.capacity ? undefined : 'No capacity limit'} />
        <MetricTile label="Mode" value={humanize(e.mode)} />
        <MetricTile label="Fee" value={Number(e.fee_amount) > 0 ? `₹${Number(e.fee_amount).toLocaleString('en-IN')}` : 'Free'} />
        <MetricTile label="Audience" value={e.audience_label ?? 'All alumni'} />
      </div>
      <Panel title="Details">
        <dl className="grid gap-x-6 gap-y-2 text-sm md:grid-cols-2">
          <div><dt className="text-slate-500">When</dt><dd>{formatDate(e.event_date)} {e.start_time ?? ''}{e.end_time ? ` – ${e.end_time}` : ''}</dd></div>
          <div><dt className="text-slate-500">Register by</dt><dd>{e.registration_deadline ? formatDate(e.registration_deadline) : 'Until the event'}</dd></div>
          <div><dt className="text-slate-500">Organizer</dt><dd>{e.organizer ?? '—'}</dd></div>
          <div><dt className="text-slate-500">Contact</dt><dd>{[e.contact_person, e.contact_phone, e.contact_email].filter(Boolean).join(' · ') || '—'}</dd></div>
          {e.online_link ? <div className="md:col-span-2"><dt className="text-slate-500">Online link</dt><dd className="break-all">{e.online_link}</dd></div> : null}
          {e.description ? <div className="md:col-span-2"><dt className="text-slate-500">About</dt><dd className="whitespace-pre-wrap">{e.description}</dd></div> : null}
        </dl>
      </Panel>

      <div className="flex flex-wrap gap-2">
        {e.status === 'draft' ? <Button className="h-9" disabled={busy} onClick={() => run('Event published.', () => alumniApi.eventAction(e.id, 'publish'))}>Publish</Button> : null}
        {open ? <Button variant="outline" className="h-9" onClick={() => setEditing((v) => !v)}>{editing ? 'Close editor' : 'Edit event'}</Button> : null}
        {e.status === 'published' ? <Button variant="outline" className="h-9" disabled={busy} onClick={() => run('Event marked completed.', () => alumniApi.eventAction(e.id, 'complete'), 'Mark this event as completed? Registered people who were not checked in will count as no-shows.')}>Mark completed</Button> : null}
        {open ? <Button variant="ghost" className="h-9" disabled={busy} onClick={() => run('Event cancelled.', () => alumniApi.eventAction(e.id, 'cancel'), 'Cancel this event? Registrations will be cancelled too.')}>Cancel event</Button> : null}
      </div>

      {editing ? (
        <EventForm key={e.id} types={types} eventId={e.id} onSaved={() => { setEditing(false); setNotice('Changes saved.'); onChanged(); }}
          initial={{
            name: e.name, event_type: e.event_type, event_date: e.event_date.slice(0, 10), start_time: e.start_time ?? '', end_time: e.end_time ?? '', venue: e.venue ?? '', mode: e.mode,
            online_link: e.online_link ?? '', capacity: e.capacity ? String(e.capacity) : '', registration_required: !!e.registration_required, auto_confirm: !!e.auto_confirm,
            registration_deadline: e.registration_deadline?.slice(0, 10) ?? '', organizer: e.organizer ?? '', contact_person: e.contact_person ?? '', contact_phone: e.contact_phone ?? '',
            contact_email: e.contact_email ?? '', fee_amount: Number(e.fee_amount) > 0 ? String(e.fee_amount) : '', description: e.description ?? '',
          }} />
      ) : null}

      {e.status === 'published' ? (
        <Panel title="Invite alumni">
          <p className="mb-3 text-sm text-slate-600">Sends the invitation to eligible alumni in this event&apos;s audience who have agreed to be contacted on the chosen channels.</p>
          <ChannelPicker meta={meta} value={channels} onChange={setChannels} />
          <Button className="mt-3 h-9" disabled={busy || channels.length === 0}
            onClick={() => run('Invitations sent. See Communication → Campaigns for delivery results.', () => alumniApi.inviteToEvent(e.id, channels), 'Send invitations now?')}>Send invitations</Button>
        </Panel>
      ) : null}
    </div>
  );
}

// ---------------------------------------------------------------- registrations

function Registrations({ detail, onChanged }: { detail: EventDetail; onChanged: () => void }) {
  const e = detail.event;
  const [rows, setRows] = useState<EventRegistration[] | null>(null);
  const [alumniId, setAlumniId] = useState<Picked | null>(null);
  const [participants, setParticipants] = useState('1');
  const [guests, setGuests] = useState('');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);

  const load = useCallback((signal?: AbortSignal) => alumniApi.eventRegistrations(e.id, signal).then(setRows).catch((reason: unknown) => {
    if (reason instanceof DOMException && reason.name === 'AbortError') return;
    setError(reason instanceof Error ? reason.message : "Couldn't load registrations. Try again.");
  }), [e.id]);
  useEffect(() => { const c = new AbortController(); void load(c.signal); return () => c.abort(); }, [load]);

  async function add(event: FormEvent) {
    event.preventDefault();
    if (!alumniId) { setError('Choose an alumnus to register.'); return; }
    setBusy(true); setError(''); setNotice('');
    try {
      const r = await alumniApi.registerForEvent(e.id, { alumni_id: alumniId.id, participants: Number(participants) || 1, guest_details: guests || undefined });
      setNotice(r.message || 'Registered.'); setAlumniId(null); setGuests(''); await load(); onChanged();
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Couldn't register. Try again."); } finally { setBusy(false); }
  }
  async function act(reg: EventRegistration, action: 'confirm' | 'cancel' | 'payment', body: Record<string, unknown> = {}) {
    setError(''); setNotice('');
    try { await alumniApi.registrationAction(e.id, reg.id, action, body); await load(); onChanged(); } catch (reason) { setError(reason instanceof Error ? reason.message : 'Something went wrong. Try again.'); }
  }

  const canRegister = e.status === 'published';
  return (
    <div className="space-y-4">
      {notice ? <Banner tone="success">{notice}</Banner> : null}
      {error ? <Banner>{error}</Banner> : null}
      {canRegister ? (
        <Panel title="Register an alumnus">
          <form onSubmit={add} className="grid gap-3 md:grid-cols-4" noValidate>
            <div className="md:col-span-2"><FormField label="Alumnus" required><AlumniPicker value={alumniId} onChange={setAlumniId} /></FormField></div>
            <FormField label="People attending"><input className={inputClass} type="number" min={1} max={20} value={participants} onChange={(ev) => setParticipants(ev.target.value)} /></FormField>
            <FormField label="Guest details"><input className={inputClass} value={guests} onChange={(ev) => setGuests(ev.target.value)} /></FormField>
            <div><Button type="submit" className="h-9" disabled={busy}>Register</Button></div>
          </form>
          <p className="mt-2 text-xs text-slate-500">When the event is full, registrations join the waiting list and are promoted automatically as seats free up.</p>
        </Panel>
      ) : <Banner tone="info">Registrations open once the event is published.</Banner>}

      <section className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
        {rows === null ? <LoadingBlock /> : rows.length === 0 ? <EmptyState title="No registrations yet" /> : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[820px] text-left text-sm">
              <thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase tracking-wider text-slate-500">
                <tr><th className="px-4 py-2.5 font-medium">Alumnus</th><th className="px-4 py-2.5 font-medium">Registration</th><th className="px-3 py-2.5 font-medium">People</th><th className="px-4 py-2.5 font-medium">Status</th><th className="px-4 py-2.5 font-medium">Payment</th><th className="px-4 py-2.5"><span className="sr-only">Actions</span></th></tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {rows.map((r) => (
                  <tr key={r.id}>
                    <td className="px-4 py-3"><Link className="text-indigo-700 hover:underline" href={`/alumni/profile/${r.alumni_id}`}>{r.full_name}</Link><div className="text-xs text-slate-500">{r.alumni_code}{r.batch ? ` · ${r.batch}` : ''}</div></td>
                    <td className="px-4 py-3 text-slate-700">{r.registration_no}{r.attended_at ? <div className="text-xs text-emerald-700">Attended {formatDate(r.attended_at)}</div> : null}</td>
                    <td className="px-3 py-3 tabular-nums">{r.participants}</td>
                    <td className="px-4 py-3 text-slate-700">{humanize(r.status)}</td>
                    <td className="px-4 py-3">
                      {Number(e.fee_amount) > 0 ? (
                        <select aria-label={`Payment status for ${r.full_name}`} className={inputClass + ' h-8 w-28'} value={r.payment_status} onChange={(ev) => act(r, 'payment', { payment_status: ev.target.value })}>
                          <option value="pending">Pending</option><option value="paid">Paid</option><option value="waived">Waived</option>
                        </select>
                      ) : <span className="text-slate-500">No fee</span>}
                    </td>
                    <td className="space-x-1 px-4 py-3 text-right">
                      {r.status === 'registered' ? <Button size="sm" variant="outline" aria-label={`Confirm ${r.full_name}`} onClick={() => act(r, 'confirm')}>Confirm</Button> : null}
                      {['registered', 'confirmed', 'waitlisted'].includes(r.status) ? <Button size="sm" variant="ghost" aria-label={`Cancel registration of ${r.full_name}`} onClick={() => { if (window.confirm(`Cancel ${r.full_name}'s registration?`)) void act(r, 'cancel'); }}>Cancel</Button> : null}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}

// -------------------------------------------------------------------- check-in

const METHODS: [string, string, string][] = [
  ['qr', 'Scan QR code', 'Type or scan the code printed on the pass'], ['registration_no', 'Registration number', 'For example EV00001-0002'],
  ['mobile', 'Mobile number', 'The mobile number the alumnus registered with'], ['alumni_id', 'Alumni ID', 'The alumni code, for example ALM-…'],
];

function CheckIn({ detail }: { detail: EventDetail }) {
  const e = detail.event;
  const [method, setMethod] = useState('registration_no');
  const [value, setValue] = useState('');
  const [message, setMessage] = useState<{ tone: 'success' | 'error' | 'info'; text: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  const [now] = useState(() => Date.now());   // fixed at mount: only used to say whether check-in has opened

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!value.trim()) { setMessage({ tone: 'error', text: 'Enter the code or number first.' }); return; }
    setBusy(true); setMessage(null);
    try {
      const r = await alumniApi.checkIn(e.id, { method, value: value.trim() });
      const name = r.data.alumnus?.full_name ?? 'The alumnus';
      setMessage(r.data.already_checked_in ? { tone: 'info', text: `${name} was already checked in.` } : { tone: 'success', text: `${name} is checked in.` });
      setValue(''); input.current?.focus();
    } catch (reason) {
      setMessage({ tone: 'error', text: reason instanceof AlumniApiError ? reason.message : "Couldn't check in. Try again." });
    } finally { setBusy(false); }
  }

  if (!['published', 'completed'].includes(e.status)) return <Banner tone="info">Check-in opens once the event is published.</Banner>;
  const opensOn = new Date(`${e.event_date.slice(0, 10)}T00:00:00`);
  opensOn.setDate(opensOn.getDate() - 1);
  const notYet = e.status === 'published' && opensOn.getTime() > now;
  return (
    <Panel title="Check in an attendee">
      {notYet ? <div className="mb-3"><Banner tone="info">Check-in opens the day before the event, on {opensOn.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}.</Banner></div> : null}
      <form onSubmit={submit} className="grid gap-3 md:grid-cols-4" noValidate>
        <FormField label="Find them by">
          <select className={inputClass} value={method} onChange={(ev) => setMethod(ev.target.value)}>{METHODS.map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select>
        </FormField>
        <div className="md:col-span-2"><FormField label="Value" hint={METHODS.find((m) => m[0] === method)?.[2]}><input ref={input} className={inputClass} value={value} onChange={(ev) => setValue(ev.target.value)} autoComplete="off" /></FormField></div>
        <div className="pt-6"><Button type="submit" className="h-9" disabled={busy}>Check in</Button></div>
      </form>
      {message ? <div className="mt-3" role="status"><Banner tone={message.tone}>{message.text}</Banner></div> : null}
      <p className="mt-3 text-xs text-slate-500">To check someone in by hand, open Registrations. Only confirmed registrations can be checked in.</p>
    </Panel>
  );
}

// ---------------------------------------------------------------------- report

function Report({ detail }: { detail: EventDetail }) {
  const e = detail.event;
  const [report, setReport] = useState<EventReport | null>(null);
  const [alumniId, setAlumniId] = useState<Picked | null>(null);
  const [rating, setRating] = useState('5');
  const [comments, setComments] = useState('');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const load = useCallback((signal?: AbortSignal) => alumniApi.eventReport(e.id, signal).then(setReport).catch((reason: unknown) => {
    if (reason instanceof DOMException && reason.name === 'AbortError') return;
    setError(reason instanceof Error ? reason.message : "Couldn't load the report. Try again.");
  }), [e.id]);
  useEffect(() => { const c = new AbortController(); void load(c.signal); return () => c.abort(); }, [load]);

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!alumniId) { setError('Choose who the feedback is from.'); return; }
    setError(''); setNotice('');
    try { await alumniApi.eventFeedback(e.id, { alumni_id: alumniId.id, rating: Number(rating), comments: comments || undefined }); setNotice('Feedback saved.'); setAlumniId(null); setComments(''); await load(); }
    catch (reason) { setError(reason instanceof Error ? reason.message : "Couldn't save feedback. Try again."); }
  }

  if (!report) return error ? <Banner>{error}</Banner> : <LoadingBlock />;
  return (
    <div className="space-y-4">
      {notice ? <Banner tone="success">{notice}</Banner> : null}
      {error ? <Banner>{error}</Banner> : null}
      <div className="grid gap-3 md:grid-cols-4">
        <MetricTile label="Registered" value={report.registered} /><MetricTile label="Confirmed" value={report.confirmed} />
        <MetricTile label="Waiting list" value={report.waitlisted} /><MetricTile label="Cancelled" value={report.cancelled} />
        <MetricTile label="Attended" value={report.attended} hint={`${report.participants_attended} people including guests`} />
        <MetricTile label="No-shows" value={report.no_show} hint={report.absent === null ? 'Known after the event is completed' : undefined} />
        <MetricTile label="Seats used" value={report.capacity ? `${report.seats_used} / ${report.capacity}` : report.seats_used} />
        <MetricTile label="Average rating" value={report.feedback_average === null ? '—' : report.feedback_average.toFixed(1)} hint={`${report.feedback_count} responses`} />
      </div>
      <Panel title="Feedback">
        {report.feedback.length === 0 ? <p className="text-sm text-slate-500">No feedback yet.</p> : (
          <ul className="divide-y divide-slate-100 text-sm">
            {report.feedback.map((f, i) => <li key={i} className="py-2"><span className="font-medium text-slate-900">{f.full_name}</span> · {f.rating}/5{f.comments ? <p className="text-slate-600">{f.comments}</p> : null}</li>)}
          </ul>
        )}
        {e.status === 'completed' ? (
          <form onSubmit={submit} className="mt-4 grid gap-3 border-t border-slate-100 pt-4 md:grid-cols-4" noValidate>
            <div className="md:col-span-2"><FormField label="From" required><AlumniPicker value={alumniId} onChange={setAlumniId} /></FormField></div>
            <FormField label="Rating"><select className={inputClass} value={rating} onChange={(ev) => setRating(ev.target.value)}>{[5, 4, 3, 2, 1].map((n) => <option key={n} value={n}>{n}</option>)}</select></FormField>
            <FormField label="Comments"><input className={inputClass} value={comments} onChange={(ev) => setComments(ev.target.value)} /></FormField>
            <div><Button type="submit" className="h-9">Add feedback</Button></div>
          </form>
        ) : <p className="mt-3 text-xs text-slate-500">Feedback can be recorded once the event is completed, and only for people who attended.</p>}
      </Panel>
    </div>
  );
}

// ----------------------------------------------------------------------- files

function Files({ detail, onChanged }: { detail: EventDetail; onChanged: () => void }) {
  const e = detail.event;
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const picker = useRef<HTMLInputElement>(null);

  async function upload(file: File | undefined) {
    if (!file) return;
    setBusy(true); setError('');
    try { await alumniApi.uploadEventFile(e.id, file); onChanged(); } catch (reason) { setError(reason instanceof Error ? reason.message : "Couldn't upload. Try again."); } finally { setBusy(false); if (picker.current) picker.current.value = ''; }
  }
  async function download(fileId: number) {
    setError('');
    try {
      await alumniApi.downloadEventFile(e.id, fileId);
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Couldn't download. Try again."); }
  }

  return (
    <Panel title="Photos, brochures and gallery" actions={<><input ref={picker} type="file" className="sr-only" aria-label="Upload an event file" onChange={(ev) => void upload(ev.target.files?.[0])} /><Button className="h-9" disabled={busy} onClick={() => picker.current?.click()}>Upload file</Button></>}>
      {error ? <Banner>{error}</Banner> : null}
      {detail.files.length === 0 ? <p className="text-sm text-slate-500">No files yet.</p> : (
        <ul className="divide-y divide-slate-100 text-sm">
          {detail.files.map((f) => (
            <li key={f.id} className="flex items-center justify-between gap-3 py-2">
              <span className="text-slate-800">{f.original_name} <span className="text-xs text-slate-500">{Math.max(1, Math.round(f.size_bytes / 1024))} KB</span></span>
              <span className="space-x-1">
                <Button size="sm" variant="outline" aria-label={`Download ${f.original_name}`} onClick={() => void download(f.id)}>Download</Button>
                <Button size="sm" variant="ghost" aria-label={`Delete ${f.original_name}`} onClick={() => { if (window.confirm(`Delete ${f.original_name}?`)) void alumniApi.deleteEventFile(e.id, f.id).then(onChanged).catch((r) => setError(r instanceof Error ? r.message : 'Try again.')); }}>Delete</Button>
              </span>
            </li>
          ))}
        </ul>
      )}
    </Panel>
  );
}

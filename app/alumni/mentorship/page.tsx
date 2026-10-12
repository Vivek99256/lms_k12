'use client';

import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import {
  alumniApi, AlumniApiError, type MentorMatch, type MentorRow, type MentorshipDetail, type MentorshipRequestRow, type Pagination,
} from '../_lib/alumni-api';
import { AlumniPicker, StudentPicker, type Picked } from '../_components/entity-picker';
import { Banner, EmptyState, FormField, LoadingBlock, PageFrame, Panel, formatDate, humanize, inputClass } from '../_components/alumni-ui';

const STATUS_TONE: Record<string, string> = {
  open: 'bg-amber-50 text-amber-800 ring-amber-200',
  matched: 'bg-blue-50 text-blue-800 ring-blue-200',
  accepted: 'bg-indigo-50 text-indigo-800 ring-indigo-200',
  completed: 'bg-emerald-50 text-emerald-800 ring-emerald-200',
  cancelled: 'bg-slate-100 text-slate-600 ring-slate-200',
  scheduled: 'bg-blue-50 text-blue-800 ring-blue-200',
  no_show: 'bg-red-50 text-red-800 ring-red-200',
  active: 'bg-emerald-50 text-emerald-800 ring-emerald-200',
  paused: 'bg-slate-100 text-slate-600 ring-slate-200',
};
const DAYS = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'];

function Chip({ value }: { value: string }) {
  return <span className={cn('inline-flex rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset', STATUS_TONE[value] ?? STATUS_TONE.cancelled)}>{humanize(value)}</span>;
}

const studentName = (r: { student_first?: string | null; student_last?: string | null }) => [r.student_first, r.student_last].filter(Boolean).join(' ') || 'Student';

export default function MentorshipPage() {
  const [tab, setTab] = useState<'requests' | 'mentors'>('requests');
  return (
    <PageFrame title="Mentorship" description="Match students with alumni mentors, schedule sessions and collect feedback.">
      <div role="tablist" aria-label="Mentorship sections" className="flex gap-1 border-b border-slate-200">
        {([['requests', 'Requests'], ['mentors', 'Mentors']] as const).map(([key, label]) => (
          <button key={key} role="tab" type="button" aria-selected={tab === key} onClick={() => setTab(key)}
            className={cn('border-b-2 px-3 py-2 text-sm font-medium', tab === key ? 'border-indigo-600 text-indigo-700' : 'border-transparent text-slate-600 hover:text-slate-900')}>
            {label}
          </button>
        ))}
      </div>
      {tab === 'requests' ? <RequestsTab /> : <MentorsTab />}
    </PageFrame>
  );
}

// ------------------------------------------------------------------- requests

function RequestsTab() {
  const [status, setStatus] = useState('');
  const [page, setPage] = useState(1);
  const [rows, setRows] = useState<MentorshipRequestRow[] | null>(null);
  const [pagination, setPagination] = useState<Pagination | null>(null);
  const [selected, setSelected] = useState<number | null>(null);
  const [adding, setAdding] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const load = useCallback((signal?: AbortSignal) =>
    alumniApi.mentorshipRequests({ status: status || undefined, page }, signal)
      .then((result) => { setRows(result.rows); setPagination(result.pagination); setError(''); })
      .catch((reason: unknown) => {
        if (reason instanceof DOMException && reason.name === 'AbortError') return;
        setError(reason instanceof Error ? reason.message : "Couldn't load requests. Try again.");
      }), [status, page]);

  useEffect(() => {
    const controller = new AbortController();
    void load(controller.signal);
    return () => controller.abort();
  }, [load]);

  return (
    <div className="space-y-4">
      {notice ? <Banner tone="success">{notice}</Banner> : null}
      {error ? <Banner>{error}</Banner> : null}

      <div className="flex flex-wrap items-center justify-between gap-2">
        <select aria-label="Filter by status" className={inputClass + ' w-48'} value={status} onChange={(event) => { setStatus(event.target.value); setPage(1); }}>
          <option value="">All requests</option>
          {['open', 'matched', 'accepted', 'completed', 'cancelled'].map((s) => <option key={s} value={s}>{humanize(s)}</option>)}
        </select>
        <Button className="h-9" onClick={() => setAdding((v) => !v)}>{adding ? 'Close form' : 'New request'}</Button>
      </div>

      {adding ? <NewRequest onDone={(message) => { setAdding(false); setNotice(message); void load(); }} /> : null}

      <section className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
        {rows === null ? <LoadingBlock label="Loading requests…" /> : rows.length === 0 ? (
          <EmptyState title="No mentorship requests" hint="Requests from students, or ones you log for them, appear here." />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] text-left text-sm">
              <thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase tracking-wider text-slate-500">
                <tr><th className="px-4 py-2.5 font-medium">Student</th><th className="px-4 py-2.5 font-medium">Career area</th><th className="px-4 py-2.5 font-medium">Status</th><th className="px-4 py-2.5 font-medium">Mentor</th><th className="px-4 py-2.5 font-medium">Requested</th><th className="px-4 py-2.5"><span className="sr-only">Open</span></th></tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {rows.map((row) => (
                  <tr key={row.id} className={cn('hover:bg-slate-50', selected === row.id && 'bg-indigo-50/50')}>
                    <td className="px-4 py-3 font-medium text-slate-900">{studentName(row)}</td>
                    <td className="px-4 py-3 text-slate-700">{row.career_area}</td>
                    <td className="px-4 py-3"><Chip value={row.status} /></td>
                    <td className="px-4 py-3 text-slate-700">{row.mentor_name ?? '—'}</td>
                    <td className="px-4 py-3 text-slate-600">{formatDate(row.created_at)}</td>
                    <td className="px-4 py-3 text-right">
                      <Button variant="outline" size="sm" aria-label={`Open request from ${studentName(row)} about ${row.career_area}`} onClick={() => setSelected(selected === row.id ? null : row.id)}>
                        {selected === row.id ? 'Hide' : 'Open'}
                      </Button>
                    </td>
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

      {selected !== null ? <RequestDetail key={selected} id={selected} onChanged={() => void load()} /> : null}
    </div>
  );
}

function NewRequest({ onDone }: { onDone: (message: string) => void }) {
  const [student, setStudent] = useState<Picked | null>(null);
  const [area, setArea] = useState('');
  const [guidance, setGuidance] = useState('');
  const [date, setDate] = useState('');
  const [errors, setErrors] = useState<Record<string, string[]>>({});
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setErrors({});
    setError('');
    const missing: Record<string, string[]> = {};
    if (!student) missing.student_id = ['Choose a student.'];
    if (!area.trim()) missing.career_area = ['Enter the career area.'];
    if (Object.keys(missing).length) { setErrors(missing); return; }
    setBusy(true);
    try {
      await alumniApi.createMentorshipRequest({ student_id: student!.id, career_area: area.trim(), guidance_needed: guidance.trim() || null, preferred_date: date || null });
      onDone(`Mentorship request logged for ${student!.label}.`);
    } catch (reason) {
      if (reason instanceof AlumniApiError) { setErrors(reason.fieldErrors); setError(reason.message); } else setError("Couldn't save the request. Try again.");
    } finally { setBusy(false); }
  }

  return (
    <Panel title="Log a request for a student">
      {error ? <div className="mb-3"><Banner>{error}</Banner></div> : null}
      <form onSubmit={submit} className="grid gap-4 md:grid-cols-2" noValidate>
        <StudentPicker value={student} onChange={setStudent} error={errors.student_id?.[0]} />
        <FormField label="Career area" required error={errors.career_area?.[0]}><input className={inputClass} value={area} onChange={(e) => setArea(e.target.value)} placeholder="For example: Data science" /></FormField>
        <FormField label="Guidance needed" error={errors.guidance_needed?.[0]}><textarea className={inputClass + ' h-20 py-2'} value={guidance} onChange={(e) => setGuidance(e.target.value)} /></FormField>
        <FormField label="Preferred date" error={errors.preferred_date?.[0]}><input className={inputClass} type="date" min={new Date().toISOString().slice(0, 10)} value={date} onChange={(e) => setDate(e.target.value)} /></FormField>
        <div><Button type="submit" className="h-9" disabled={busy}>Save request</Button></div>
      </form>
    </Panel>
  );
}

function RequestDetail({ id, onChanged }: { id: number; onChanged: () => void }) {
  const [detail, setDetail] = useState<MentorshipDetail | null>(null);
  const [matches, setMatches] = useState<MentorMatch[] | null>(null);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState('');
  const [when, setWhen] = useState('');
  const [minutes, setMinutes] = useState('45');
  const [mode, setMode] = useState('online');
  const [where, setWhere] = useState('');

  const load = useCallback((signal?: AbortSignal) =>
    alumniApi.mentorshipRequest(id, signal).then(setDetail).catch((reason: unknown) => {
      if (reason instanceof DOMException && reason.name === 'AbortError') return;
      setError(reason instanceof Error ? reason.message : "Couldn't load the request. Try again.");
    }), [id]);

  useEffect(() => {
    const controller = new AbortController();
    void load(controller.signal);
    return () => controller.abort();
  }, [load]);

  async function run(action: () => Promise<unknown>, done: string) {
    setBusy(true); setError(''); setNotice('');
    try { await action(); setNotice(done); setMatches(null); setNote(''); await load(); onChanged(); }
    catch (reason) { setError(reason instanceof Error ? reason.message : 'Something went wrong. Try again.'); }
    finally { setBusy(false); }
  }

  if (!detail) return error ? <Banner>{error}</Banner> : <LoadingBlock label="Loading request…" />;
  const req = detail.request;
  const finished = req.status === 'completed' || req.status === 'cancelled';
  const hasCompleted = detail.sessions.some((s) => s.status === 'completed');

  return (
    <Panel title={`Request: ${detail.student ? `${detail.student.first_name} ${detail.student.last_name ?? ''}` : 'Student'} · ${req.career_area}`} actions={<Chip value={req.status} />}>
      <div className="space-y-5">
        {notice ? <Banner tone="success">{notice}</Banner> : null}
        {error ? <Banner>{error}</Banner> : null}

        <dl className="grid gap-3 text-sm md:grid-cols-3">
          <div><dt className="text-xs uppercase tracking-wider text-slate-500">Guidance needed</dt><dd className="mt-0.5 text-slate-900">{req.guidance_needed || '—'}</dd></div>
          <div><dt className="text-xs uppercase tracking-wider text-slate-500">Preferred date</dt><dd className="mt-0.5 text-slate-900">{formatDate(req.preferred_date)}</dd></div>
          <div><dt className="text-xs uppercase tracking-wider text-slate-500">Mentor</dt><dd className="mt-0.5 text-slate-900">{detail.mentor ? `${detail.mentor.full_name} (${detail.mentor.alumni_code})` : 'Not matched yet'}</dd></div>
        </dl>
        {req.response_note ? <p className="text-sm text-slate-600">Mentor&apos;s note: {req.response_note}</p> : null}

        {req.status === 'open' ? (
          <div className="space-y-3">
            <Button variant="outline" className="h-9" disabled={busy} onClick={() => alumniApi.mentorMatches(id).then(setMatches).catch((r) => setError(r instanceof Error ? r.message : 'Try again.'))}>Find mentors</Button>
            {matches ? (matches.length === 0 ? <p className="text-sm text-slate-600">No available mentor fits yet. Register more mentors, or free up a mentor&apos;s slots.</p> : (
              <ul className="divide-y divide-slate-100 rounded-md border border-slate-200">
                {matches.map((m) => (
                  <li key={m.alumni_id} className="flex flex-wrap items-center justify-between gap-3 px-3 py-2.5 text-sm">
                    <div>
                      <p className="font-medium text-slate-900">{m.full_name} <span className="font-normal text-slate-500">· {[m.job_role, m.industry].filter(Boolean).join(', ')}</span></p>
                      <p className="text-xs text-slate-500">{m.matched_on.length ? `Matches: ${m.matched_on.join(', ')}` : 'No shared keywords'}{m.preferred_by_student ? ' · requested by the student' : ''} · {m.open_slots} free slot{m.open_slots === 1 ? '' : 's'}</p>
                    </div>
                    <Button size="sm" disabled={busy} aria-label={`Match ${m.full_name}`} onClick={() => run(() => alumniApi.matchMentor(id, m.alumni_id), `Matched with ${m.full_name}. Waiting for the mentor to accept.`)}>Match</Button>
                  </li>
                ))}
              </ul>
            )) : null}
          </div>
        ) : null}

        {req.status === 'matched' ? (
          <div className="flex flex-wrap items-end gap-2">
            <FormField label="Mentor's note (required if declining)"><input className={inputClass + ' w-72'} value={note} onChange={(e) => setNote(e.target.value)} /></FormField>
            <Button className="h-9" disabled={busy} onClick={() => run(() => alumniApi.respondToRequest(id, 'accept', note.trim() || undefined), 'Mentor accepted the request.')}>Mentor accepts</Button>
            <Button variant="outline" className="h-9" disabled={busy || !note.trim()} onClick={() => run(() => alumniApi.respondToRequest(id, 'decline', note.trim()), 'Mentor declined. The request is open again.')}>Mentor declines</Button>
          </div>
        ) : null}

        {req.status === 'accepted' ? (
          <form className="grid gap-3 md:grid-cols-5" noValidate onSubmit={(event) => { event.preventDefault(); if (!when) { setError('Choose a date and time for the session.'); return; } void run(() => alumniApi.scheduleSession(id, { scheduled_at: when.replace('T', ' '), duration_minutes: Number(minutes) || 45, mode, location: where || undefined }), 'Session scheduled.'); }}>
            <FormField label="Date and time" required><input className={inputClass} type="datetime-local" value={when} onChange={(e) => setWhen(e.target.value)} /></FormField>
            <FormField label="Minutes"><input className={inputClass} type="number" min={10} max={480} value={minutes} onChange={(e) => setMinutes(e.target.value)} /></FormField>
            <FormField label="Mode"><select className={inputClass} value={mode} onChange={(e) => setMode(e.target.value)}><option value="online">Online</option><option value="offline">In person</option></select></FormField>
            <FormField label="Link or place"><input className={inputClass} value={where} onChange={(e) => setWhere(e.target.value)} /></FormField>
            <div className="flex items-end"><Button type="submit" className="h-9" disabled={busy}>Schedule session</Button></div>
          </form>
        ) : null}

        {detail.sessions.length > 0 ? (
          <div>
            <h3 className="mb-2 text-sm font-semibold text-slate-800">Sessions</h3>
            <ul className="divide-y divide-slate-100 rounded-md border border-slate-200">
              {detail.sessions.map((s) => (
                <li key={s.id} className="space-y-2 px-3 py-2.5 text-sm">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="text-slate-900">{formatDate(s.scheduled_at)} · {new Date(s.scheduled_at.replace(' ', 'T')).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })} · {s.duration_minutes} min · {humanize(s.mode)}{s.location ? ` · ${s.location}` : ''} <Chip value={s.status} /></span>
                    {s.status === 'scheduled' ? (
                      <span className="flex gap-1">
                        <Button size="sm" disabled={busy} aria-label={`Mark session on ${formatDate(s.scheduled_at)} completed`} onClick={() => run(() => alumniApi.updateSession(s.id, 'completed'), 'Session marked completed. The mentor has been credited.')}>Completed</Button>
                        <Button size="sm" variant="outline" disabled={busy} onClick={() => run(() => alumniApi.updateSession(s.id, 'no_show'), 'Marked as no show.')}>No show</Button>
                        <Button size="sm" variant="outline" disabled={busy} onClick={() => run(() => alumniApi.updateSession(s.id, 'cancelled'), 'Session cancelled.')}>Cancel</Button>
                      </span>
                    ) : null}
                  </div>
                  {s.feedback.map((f) => <p key={f.id} className="text-xs text-slate-600">{humanize(f.from_role)} feedback: {f.rating}/5{f.comments ? ` — ${f.comments}` : ''}</p>)}
                  {s.status === 'completed' ? <FeedbackForm session={s} busy={busy} onSave={(role, rating, comments) => run(() => alumniApi.sessionFeedback(s.id, role, rating, comments), 'Feedback saved.')} /> : null}
                </li>
              ))}
            </ul>
          </div>
        ) : null}

        {!finished ? (
          <div className="flex flex-wrap gap-2 border-t border-slate-100 pt-4">
            {req.status === 'accepted' ? <Button className="h-9" disabled={busy || !hasCompleted} onClick={() => run(() => alumniApi.completeMentorshipRequest(id), 'Mentorship completed.')}>Complete mentorship</Button> : null}
            <Button variant="outline" className="h-9" disabled={busy} onClick={() => { if (window.confirm('Cancel this mentorship request? Any scheduled sessions are cancelled too.')) void run(() => alumniApi.cancelMentorshipRequest(id), 'Request cancelled.'); }}>Cancel request</Button>
          </div>
        ) : null}
      </div>
    </Panel>
  );
}

function FeedbackForm({ session, busy, onSave }: { session: MentorshipDetail['sessions'][number]; busy: boolean; onSave: (role: 'student' | 'mentor', rating: number, comments?: string) => void }) {
  const given = new Set(session.feedback.map((f) => f.from_role));
  const [role, setRole] = useState<'student' | 'mentor'>(given.has('student') ? 'mentor' : 'student');
  const [rating, setRating] = useState('5');
  const [comments, setComments] = useState('');
  if (given.has('student') && given.has('mentor')) return null;
  return (
    <div className="flex flex-wrap items-end gap-2">
      <label className="text-xs text-slate-600">From
        <select className={inputClass + ' mt-1 h-8 w-28 text-xs'} value={role} onChange={(e) => setRole(e.target.value as 'student' | 'mentor')} aria-label="Feedback from">
          {!given.has('student') ? <option value="student">Student</option> : null}{!given.has('mentor') ? <option value="mentor">Mentor</option> : null}
        </select>
      </label>
      <label className="text-xs text-slate-600">Rating
        <select className={inputClass + ' mt-1 h-8 w-20 text-xs'} value={rating} onChange={(e) => setRating(e.target.value)} aria-label="Rating">{[5, 4, 3, 2, 1].map((n) => <option key={n} value={n}>{n}</option>)}</select>
      </label>
      <label className="text-xs text-slate-600">Comments
        <input className={inputClass + ' mt-1 h-8 w-64 text-xs'} value={comments} onChange={(e) => setComments(e.target.value)} />
      </label>
      <Button size="sm" variant="outline" disabled={busy} onClick={() => onSave(role, Number(rating), comments.trim() || undefined)}>Save feedback</Button>
    </div>
  );
}

// -------------------------------------------------------------------- mentors

function MentorsTab() {
  const [rows, setRows] = useState<MentorRow[] | null>(null);
  const [adding, setAdding] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);

  const load = useCallback((signal?: AbortSignal) => alumniApi.mentors(signal).then(setRows).catch((reason: unknown) => {
    if (reason instanceof DOMException && reason.name === 'AbortError') return;
    setError(reason instanceof Error ? reason.message : "Couldn't load mentors. Try again.");
  }), []);
  useEffect(() => { const c = new AbortController(); void load(c.signal); return () => c.abort(); }, [load]);

  async function run(action: () => Promise<unknown>, done: string) {
    setBusy(true); setError(''); setNotice('');
    try { await action(); setNotice(done); await load(); } catch (reason) { setError(reason instanceof Error ? reason.message : 'Something went wrong. Try again.'); } finally { setBusy(false); }
  }

  return (
    <div className="space-y-4">
      {notice ? <Banner tone="success">{notice}</Banner> : null}
      {error ? <Banner>{error}</Banner> : null}
      <div className="flex justify-end"><Button className="h-9" onClick={() => setAdding((v) => !v)}>{adding ? 'Close form' : 'Register a mentor'}</Button></div>
      {adding ? <MentorForm onDone={(m) => { setAdding(false); setNotice(m); void load(); }} /> : null}
      <section className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
        {rows === null ? <LoadingBlock label="Loading mentors…" /> : rows.length === 0 ? (
          <EmptyState title="No mentors registered" hint="Register verified or active alumni who are willing to mentor students." />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] text-left text-sm">
              <thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase tracking-wider text-slate-500">
                <tr><th className="px-4 py-2.5 font-medium">Mentor</th><th className="px-4 py-2.5 font-medium">Expertise</th><th className="px-4 py-2.5 font-medium">Available</th><th className="px-4 py-2.5 font-medium">Students</th><th className="px-4 py-2.5 font-medium">Status</th><th className="px-4 py-2.5"><span className="sr-only">Actions</span></th></tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {rows.map((m) => (
                  <tr key={m.id}>
                    <td className="px-4 py-3"><span className="font-medium text-slate-900">{m.full_name}</span><div className="text-xs text-slate-500">{m.alumni_code}{m.batch ? ` · ${m.batch}` : ''}</div></td>
                    <td className="px-4 py-3 text-slate-700">{m.expertise || '—'}<div className="text-xs text-slate-500">{[m.job_role, m.industry].filter(Boolean).join(' · ')}</div></td>
                    <td className="px-4 py-3 text-slate-700">{m.available_days ? m.available_days.split(',').map(humanize).join(', ') : 'Any day'}<div className="text-xs text-slate-500">{humanize(m.mode)}</div></td>
                    <td className="px-4 py-3 tabular-nums text-slate-700">{m.load} of {m.capacity}</td>
                    <td className="px-4 py-3"><Chip value={m.status} /></td>
                    <td className="px-4 py-3 text-right">
                      <span className="flex justify-end gap-1">
                        <Button size="sm" variant="outline" disabled={busy} onClick={() => run(() => alumniApi.saveMentor({ status: m.status === 'active' ? 'paused' : 'active' }, m.id), m.status === 'active' ? 'Mentor paused.' : 'Mentor active again.')}>{m.status === 'active' ? 'Pause' : 'Resume'}</Button>
                        <Button size="sm" variant="ghost" disabled={busy} aria-label={`Remove ${m.full_name} as a mentor`} onClick={() => { if (window.confirm(`Remove ${m.full_name} as a mentor?`)) void run(() => alumniApi.deleteMentor(m.id), 'Mentor removed.'); }}>Remove</Button>
                      </span>
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

function MentorForm({ onDone }: { onDone: (message: string) => void }) {
  const [alumnus, setAlumnus] = useState<Picked | null>(null);
  const [f, setF] = useState({ expertise: '', industry: '', job_role: '', preferred_topics: '', mode: 'both', experience_years: '', capacity: '3' });
  const [days, setDays] = useState<string[]>([]);
  const [errors, setErrors] = useState<Record<string, string[]>>({});
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const set = (key: keyof typeof f, value: string) => setF({ ...f, [key]: value });

  async function submit(event: FormEvent) {
    event.preventDefault();
    setErrors({}); setError('');
    if (!alumnus) { setErrors({ alumni_id: ['Choose an alumnus.'] }); return; }
    setBusy(true);
    try {
      await alumniApi.saveMentor({ alumni_id: alumnus.id, ...f, experience_years: f.experience_years || null, capacity: Number(f.capacity) || 3, available_days: days });
      onDone(`${alumnus.label} is now a mentor.`);
    } catch (reason) {
      if (reason instanceof AlumniApiError) { setErrors(reason.fieldErrors); setError(reason.message); } else setError("Couldn't register the mentor. Try again.");
    } finally { setBusy(false); }
  }

  return (
    <Panel title="Register a mentor">
      {error ? <div className="mb-3"><Banner>{error}</Banner></div> : null}
      <form onSubmit={submit} className="grid gap-4 md:grid-cols-3" noValidate>
        <AlumniPicker value={alumnus} onChange={setAlumnus} error={errors.alumni_id?.[0]} />
        <FormField label="Expertise" error={errors.expertise?.[0]}><input className={inputClass} value={f.expertise} onChange={(e) => set('expertise', e.target.value)} placeholder="For example: data analytics, product design" /></FormField>
        <FormField label="Industry" error={errors.industry?.[0]}><input className={inputClass} value={f.industry} onChange={(e) => set('industry', e.target.value)} /></FormField>
        <FormField label="Job role" error={errors.job_role?.[0]}><input className={inputClass} value={f.job_role} onChange={(e) => set('job_role', e.target.value)} /></FormField>
        <FormField label="Preferred topics" error={errors.preferred_topics?.[0]}><input className={inputClass} value={f.preferred_topics} onChange={(e) => set('preferred_topics', e.target.value)} /></FormField>
        <FormField label="Mode"><select className={inputClass} value={f.mode} onChange={(e) => set('mode', e.target.value)}><option value="both">Online or in person</option><option value="online">Online</option><option value="offline">In person</option></select></FormField>
        <FormField label="Years of experience" error={errors.experience_years?.[0]}><input className={inputClass} type="number" min={0} value={f.experience_years} onChange={(e) => set('experience_years', e.target.value)} /></FormField>
        <FormField label="Students at once" error={errors.capacity?.[0]}><input className={inputClass} type="number" min={1} max={50} value={f.capacity} onChange={(e) => set('capacity', e.target.value)} /></FormField>
        <fieldset><legend className="text-sm font-medium text-slate-700">Available days</legend>
          <div className="mt-1 flex flex-wrap gap-3">{DAYS.map((d) => (
            <label key={d} className="flex items-center gap-1.5 text-sm text-slate-700"><input type="checkbox" checked={days.includes(d)} onChange={(e) => setDays(e.target.checked ? [...days, d] : days.filter((x) => x !== d))} />{humanize(d)}</label>
          ))}</div>
        </fieldset>
        <div><Button type="submit" className="h-9" disabled={busy}>Register mentor</Button></div>
      </form>
    </Panel>
  );
}

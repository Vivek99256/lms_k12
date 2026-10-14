'use client';

import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { ExternalLink } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import {
  alumniApi, AlumniApiError, type BoardRow, type Pagination, type StudentMentor, type StudentRequest,
} from '../_lib/alumni-api';
import { Banner, EmptyState, FormField, LoadingBlock, PageFrame, Panel, formatDate, humanize, inputClass } from '../_components/alumni-ui';

/**
 * Student view: the opportunity board and mentorship. Everything is bound to the signed-in student by the API,
 * and alumni contact details are never shown - students reach a mentor through the coordinator.
 */
export default function StudentAlumniPage() {
  const [tab, setTab] = useState<'board' | 'mentorship'>('board');
  return (
    <PageFrame title="Alumni opportunities" description="Jobs and internships shared by alumni, and mentoring from people who have been where you are heading.">
      <div role="tablist" aria-label="Sections" className="flex gap-1 border-b border-slate-200">
        {([['board', 'Opportunities'], ['mentorship', 'Mentorship']] as const).map(([key, label]) => (
          <button key={key} role="tab" type="button" aria-selected={tab === key} onClick={() => setTab(key)}
            className={cn('border-b-2 px-3 py-2 text-sm font-medium', tab === key ? 'border-indigo-600 text-indigo-700' : 'border-transparent text-slate-600 hover:text-slate-900')}>{label}</button>
        ))}
      </div>
      {tab === 'board' ? <Board /> : <Mentorship />}
    </PageFrame>
  );
}

function safeLink(url: string | null): string | null {
  return url && /^https?:\/\//i.test(url) ? url : null;   // the server refuses anything else; checked again before it becomes a link
}

function Board() {
  const [type, setType] = useState('');
  const [q, setQ] = useState('');
  const [text, setText] = useState('');
  const [page, setPage] = useState(1);
  const [rows, setRows] = useState<BoardRow[] | null>(null);
  const [types, setTypes] = useState<string[]>([]);
  const [pagination, setPagination] = useState<Pagination | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    const timer = window.setTimeout(() => { setQ(text); setPage(1); }, 350);
    return () => window.clearTimeout(timer);
  }, [text]);

  useEffect(() => {
    const controller = new AbortController();
    alumniApi.studentOpportunities({ type: type || undefined, q: q || undefined, page }, controller.signal)
      .then((r) => { setRows(r.rows); setTypes(r.types); setPagination(r.pagination); setError(''); })
      .catch((reason: unknown) => {
        if (reason instanceof DOMException && reason.name === 'AbortError') return;
        setError(reason instanceof Error ? reason.message : "Couldn't load opportunities. Try again.");
      });
    return () => controller.abort();
  }, [type, q, page]);

  return (
    <div className="space-y-4">
      {error ? <Banner>{error}</Banner> : null}
      <div className="grid gap-2 md:grid-cols-3">
        <input type="search" aria-label="Search opportunities" className={inputClass + ' md:col-span-2'} placeholder="Search by title, company or skill" value={text} onChange={(e) => setText(e.target.value)} />
        <select aria-label="Filter by type" className={inputClass} value={type} onChange={(e) => { setType(e.target.value); setPage(1); }}>
          <option value="">All types</option>{types.map((t) => <option key={t} value={t}>{humanize(t)}</option>)}
        </select>
      </div>
      {rows === null ? <LoadingBlock label="Loading opportunities…" /> : rows.length === 0 ? (
        <section className="rounded-lg border border-slate-200 bg-white shadow-sm"><EmptyState title="No opportunities right now" hint="Check back soon. New ones are added as alumni share them." /></section>
      ) : (
        <ul className="grid gap-3 md:grid-cols-2">
          {rows.map((o) => (
            <li key={o.id} className="space-y-2 rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
              <p className="text-xs font-medium uppercase tracking-wider text-indigo-700">{humanize(o.type)}</p>
              <p className="font-medium text-slate-900">{o.title}</p>
              <p className="text-sm text-slate-700">{o.company}{o.location ? ` · ${o.location}` : ''}</p>
              <p className="text-sm text-slate-600">{[o.experience, o.qualification, o.salary].filter(Boolean).join(' · ')}</p>
              {o.skills ? <p className="text-sm text-slate-600">Skills: {o.skills}</p> : null}
              {o.description ? <p className="line-clamp-3 text-sm text-slate-600">{o.description}</p> : null}
              <p className="text-xs text-slate-500">{o.shared_by ? `Shared by ${o.shared_by}${o.shared_by_batch ? ` (${o.shared_by_batch})` : ''} · ` : ''}{o.last_date ? `Apply by ${formatDate(o.last_date)}` : 'Open until filled'}{o.contact_person ? ` · Contact ${o.contact_person}` : ''}</p>
              {safeLink(o.application_url) ? (
                <a href={safeLink(o.application_url)!} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-sm font-medium text-indigo-700 hover:underline">
                  Apply <ExternalLink className="size-3.5" aria-hidden /><span className="sr-only"> for {o.title} (opens in a new tab)</span>
                </a>
              ) : null}
            </li>
          ))}
        </ul>
      )}
      {pagination && pagination.last_page > 1 ? (
        <div className="flex items-center justify-end gap-2 text-sm text-slate-600">
          <Button variant="outline" size="sm" disabled={pagination.page <= 1} onClick={() => setPage(pagination.page - 1)}>Previous</Button>
          <span className="tabular-nums">Page {pagination.page} of {pagination.last_page}</span>
          <Button variant="outline" size="sm" disabled={pagination.page >= pagination.last_page} onClick={() => setPage(pagination.page + 1)}>Next</Button>
        </div>
      ) : null}
    </div>
  );
}

function Mentorship() {
  const [mentors, setMentors] = useState<StudentMentor[] | null>(null);
  const [requests, setRequests] = useState<StudentRequest[] | null>(null);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);
  const [area, setArea] = useState('');
  const [guidance, setGuidance] = useState('');
  const [date, setDate] = useState('');
  const [preferred, setPreferred] = useState('');
  const [errors, setErrors] = useState<Record<string, string[]>>({});

  const load = useCallback((signal?: AbortSignal) =>
    Promise.all([alumniApi.studentMentors(signal), alumniApi.studentRequests(signal)])
      .then(([m, r]) => { setMentors(m); setRequests(r); setError(''); })
      .catch((reason: unknown) => {
        if (reason instanceof DOMException && reason.name === 'AbortError') return;
        setError(reason instanceof Error ? reason.message : "Couldn't load mentorship. Try again.");
      }), []);

  useEffect(() => { const c = new AbortController(); void load(c.signal); return () => c.abort(); }, [load]);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setErrors({}); setError(''); setNotice('');
    if (!area.trim()) { setErrors({ career_area: ['Tell us which career area you want guidance on.'] }); return; }
    setBusy(true);
    try {
      await alumniApi.studentCreateRequest({ career_area: area.trim(), guidance_needed: guidance.trim() || null, preferred_date: date || null, preferred_mentor_alumni_id: preferred ? Number(preferred) : null });
      setNotice('Request sent. A coordinator will match you with a mentor.');
      setArea(''); setGuidance(''); setDate(''); setPreferred('');
      await load();
    } catch (reason) {
      if (reason instanceof AlumniApiError) { setErrors(reason.fieldErrors); setError(reason.message); } else setError("Couldn't send the request. Try again.");
    } finally { setBusy(false); }
  }

  async function act(action: () => Promise<unknown>, done: string) {
    setBusy(true); setError(''); setNotice('');
    try { await action(); setNotice(done); await load(); } catch (e) { setError(e instanceof Error ? e.message : 'Something went wrong. Try again.'); } finally { setBusy(false); }
  }

  return (
    <div className="space-y-4">
      {notice ? <Banner tone="success">{notice}</Banner> : null}
      {error ? <Banner>{error}</Banner> : null}

      <Panel title="Ask for a mentor">
        <form onSubmit={submit} className="grid gap-4 md:grid-cols-2" noValidate>
          <FormField label="Career area" required error={errors.career_area?.[0]}><input className={inputClass} value={area} onChange={(e) => setArea(e.target.value)} placeholder="For example: Medicine, Software, Law" /></FormField>
          <FormField label="Preferred mentor" error={errors.preferred_mentor_alumni_id?.[0]} hint="Optional.">
            <select className={inputClass} value={preferred} onChange={(e) => setPreferred(e.target.value)}>
              <option value="">No preference</option>{mentors?.map((m) => <option key={m.alumni_id} value={m.alumni_id}>{m.full_name}</option>)}
            </select>
          </FormField>
          <FormField label="What guidance do you need?" error={errors.guidance_needed?.[0]}><textarea className={inputClass + ' h-20 py-2'} value={guidance} onChange={(e) => setGuidance(e.target.value)} /></FormField>
          <FormField label="Preferred date" error={errors.preferred_date?.[0]}><input className={inputClass} type="date" min={new Date().toISOString().slice(0, 10)} value={date} onChange={(e) => setDate(e.target.value)} /></FormField>
          <div><Button type="submit" className="h-9" disabled={busy}>Send request</Button></div>
        </form>
      </Panel>

      <Panel title="My requests">
        {requests === null ? <LoadingBlock /> : requests.length === 0 ? <EmptyState title="No requests yet" hint="Send a request above to get matched with an alumnus." /> : (
          <ul className="divide-y divide-slate-100">
            {requests.map((r) => (
              <li key={r.id} className="space-y-2 py-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-sm font-medium text-slate-900">{r.career_area} <span className="font-normal text-slate-500">· {humanize(r.status)}{r.mentor_name ? ` · mentor ${r.mentor_name}` : ''}</span></p>
                  {['open', 'matched', 'accepted'].includes(r.status) ? (
                    <Button size="sm" variant="outline" disabled={busy} aria-label={`Cancel request about ${r.career_area}`} onClick={() => act(() => alumniApi.studentCancelRequest(r.id), 'Request cancelled.')}>Cancel request</Button>
                  ) : null}
                </div>
                {r.sessions.map((s) => (
                  <div key={s.id} className="flex flex-wrap items-center justify-between gap-2 rounded-md bg-slate-50 px-3 py-2 text-sm">
                    <span>{formatDate(s.scheduled_at)} · {s.duration_minutes} min · {humanize(s.mode)}{s.location ? ` · ${s.location}` : ''} · {humanize(s.status)}</span>
                    {s.status === 'completed' ? (s.my_rating ? <span className="text-slate-600">You rated it {s.my_rating}/5</span> : <RateSession sessionId={s.id} busy={busy} onSave={(rating, comments) => act(() => alumniApi.studentSessionFeedback(s.id, rating, comments), 'Thank you for the feedback.')} />) : null}
                  </div>
                ))}
              </li>
            ))}
          </ul>
        )}
      </Panel>

      <Panel title="Mentors you can ask for">
        {mentors === null ? <LoadingBlock /> : mentors.length === 0 ? <EmptyState title="No mentors have a free slot" hint="Your coordinator can still take your request." /> : (
          <ul className="grid gap-3 md:grid-cols-2">
            {mentors.map((m) => (
              <li key={m.alumni_id} className="rounded-md border border-slate-200 p-3 text-sm">
                <p className="font-medium text-slate-900">{m.full_name}{m.batch ? <span className="font-normal text-slate-500"> · batch {m.batch}</span> : null}</p>
                <p className="text-slate-700">{[m.job_role, m.industry].filter(Boolean).join(' · ')}</p>
                {m.expertise ? <p className="text-slate-600">Can help with: {m.expertise}</p> : null}
                <p className="text-xs text-slate-500">{humanize(m.mode)}{m.available_days ? ` · ${m.available_days.split(',').map(humanize).join(', ')}` : ''}</p>
              </li>
            ))}
          </ul>
        )}
      </Panel>
    </div>
  );
}

function RateSession({ sessionId, busy, onSave }: { sessionId: number; busy: boolean; onSave: (rating: number, comments?: string) => void }) {
  const [rating, setRating] = useState('5');
  const [comments, setComments] = useState('');
  return (
    <span className="flex flex-wrap items-center gap-2">
      <select aria-label={`Rating for session ${sessionId}`} className={inputClass + ' h-8 w-20 text-xs'} value={rating} onChange={(e) => setRating(e.target.value)}>{[5, 4, 3, 2, 1].map((n) => <option key={n} value={n}>{n}</option>)}</select>
      <input aria-label={`Comments for session ${sessionId}`} className={inputClass + ' h-8 w-52 text-xs'} placeholder="Comments (optional)" value={comments} onChange={(e) => setComments(e.target.value)} />
      <Button size="sm" disabled={busy} onClick={() => onSave(Number(rating), comments.trim() || undefined)}>Rate session</Button>
    </span>
  );
}

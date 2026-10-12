'use client';

import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { alumniApi, AlumniApiError, type OpportunityRow, type Pagination } from '../_lib/alumni-api';
import { AlumniPicker, type Picked } from '../_components/entity-picker';
import { Banner, EmptyState, FormField, LoadingBlock, PageFrame, Panel, formatDate, humanize, inputClass } from '../_components/alumni-ui';

const TYPES = ['job', 'internship', 'apprenticeship', 'project', 'freelance'];
const TONE: Record<string, string> = {
  published: 'bg-emerald-50 text-emerald-800 ring-emerald-200',
  pending_approval: 'bg-amber-50 text-amber-800 ring-amber-200',
  rejected: 'bg-red-50 text-red-800 ring-red-200',
  closed: 'bg-slate-100 text-slate-600 ring-slate-200',
  expired: 'bg-slate-100 text-slate-600 ring-slate-200',
};

export default function OpportunitiesPage() {
  const [filters, setFilters] = useState({ status: '', type: '', q: '' });
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [rows, setRows] = useState<OpportunityRow[] | null>(null);
  const [pagination, setPagination] = useState<Pagination | null>(null);
  const [approval, setApproval] = useState(true);
  const [editing, setEditing] = useState<OpportunityRow | 'new' | null>(null);
  const [rejecting, setRejecting] = useState<number | null>(null);
  const [reason, setReason] = useState('');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const timer = window.setTimeout(() => { setFilters((c) => (c.q === search ? c : { ...c, q: search })); setPage(1); }, 350);
    return () => window.clearTimeout(timer);
  }, [search]);

  const load = useCallback((signal?: AbortSignal) =>
    alumniApi.opportunities({ status: filters.status || undefined, type: filters.type || undefined, q: filters.q || undefined, page }, signal)
      .then((r) => { setRows(r.rows); setPagination(r.pagination); setApproval(r.approval_required); setError(''); })
      .catch((reason: unknown) => {
        if (reason instanceof DOMException && reason.name === 'AbortError') return;
        setError(reason instanceof Error ? reason.message : "Couldn't load opportunities. Try again.");
      }), [filters, page]);

  useEffect(() => { const c = new AbortController(); void load(c.signal); return () => c.abort(); }, [load]);

  async function run(action: () => Promise<unknown>, done: string) {
    setBusy(true); setError(''); setNotice('');
    try { await action(); setNotice(done); setRejecting(null); setReason(''); await load(); } catch (e) { setError(e instanceof Error ? e.message : 'Something went wrong. Try again.'); } finally { setBusy(false); }
  }

  return (
    <PageFrame
      title="Jobs and internships"
      description={approval ? 'Opportunities offered by alumni are shown to students after you approve them.' : 'Approval is switched off, so opportunities are shown to students as soon as they are saved.'}
      actions={<Button className="h-9" onClick={() => setEditing(editing ? null : 'new')}>{editing ? 'Close form' : 'Add opportunity'}</Button>}
    >
      {notice ? <Banner tone="success">{notice}</Banner> : null}
      {error ? <Banner>{error}</Banner> : null}
      {editing ? <OpportunityForm initial={editing === 'new' ? null : editing} onDone={(m) => { setEditing(null); setNotice(m); void load(); }} /> : null}

      <Panel>
        <div className="grid gap-2 md:grid-cols-3">
          <input type="search" aria-label="Search opportunities" className={inputClass} placeholder="Search title, company or skills" value={search} onChange={(e) => setSearch(e.target.value)} />
          <select aria-label="Filter by status" className={inputClass} value={filters.status} onChange={(e) => { setFilters({ ...filters, status: e.target.value }); setPage(1); }}>
            <option value="">All statuses</option>{['pending_approval', 'published', 'rejected', 'closed', 'expired'].map((s) => <option key={s} value={s}>{humanize(s)}</option>)}
          </select>
          <select aria-label="Filter by type" className={inputClass} value={filters.type} onChange={(e) => { setFilters({ ...filters, type: e.target.value }); setPage(1); }}>
            <option value="">All types</option>{TYPES.map((t) => <option key={t} value={t}>{humanize(t)}</option>)}
          </select>
        </div>
      </Panel>

      <section className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
        {rows === null ? <LoadingBlock label="Loading opportunities…" /> : rows.length === 0 ? (
          <EmptyState title="No opportunities" hint="Add a job, internship, apprenticeship, project or freelance opportunity for students." />
        ) : (
          <ul className="divide-y divide-slate-100">
            {rows.map((o) => (
              <li key={o.id} className="space-y-2 px-4 py-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-medium text-slate-900">{o.title} <span className="font-normal text-slate-500">at {o.company}</span></p>
                    <p className="text-sm text-slate-600">{[humanize(o.type), o.location, o.experience, o.salary].filter(Boolean).join(' · ')}</p>
                    <p className="text-xs text-slate-500">
                      {o.alumni_name ? `Offered by ${o.alumni_name} · ` : 'Posted by the institute · '}{o.last_date ? `Apply by ${formatDate(o.last_date)}` : 'No closing date'}
                    </p>
                    {o.review_remarks ? <p className="text-xs text-slate-500">Review note: {o.review_remarks}</p> : null}
                  </div>
                  <span className={cn('inline-flex rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset', TONE[o.effective_status] ?? TONE.closed)}>{humanize(o.effective_status)}</span>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  {o.status === 'pending_approval' ? (
                    <>
                      <Button size="sm" disabled={busy} aria-label={`Approve ${o.title}`} onClick={() => run(() => alumniApi.reviewOpportunity(o.id, 'approve'), 'Opportunity approved and published.')}>Approve</Button>
                      {rejecting === o.id ? (
                        <>
                          <input className={inputClass + ' h-8 w-64 text-xs'} placeholder="Reason for rejecting" aria-label={`Reason for rejecting ${o.title}`} value={reason} onChange={(e) => setReason(e.target.value)} />
                          <Button size="sm" variant="destructive" disabled={busy || !reason.trim()} onClick={() => run(() => alumniApi.reviewOpportunity(o.id, 'reject', reason.trim()), 'Opportunity rejected.')}>Reject opportunity</Button>
                          <Button size="sm" variant="ghost" onClick={() => { setRejecting(null); setReason(''); }}>Cancel</Button>
                        </>
                      ) : <Button size="sm" variant="outline" disabled={busy} aria-label={`Reject ${o.title}`} onClick={() => setRejecting(o.id)}>Reject</Button>}
                    </>
                  ) : null}
                  {o.status !== 'closed' ? <Button size="sm" variant="outline" disabled={busy} onClick={() => setEditing(o)}>Edit</Button> : null}
                  {o.status === 'published' ? <Button size="sm" variant="outline" disabled={busy} onClick={() => run(() => alumniApi.closeOpportunity(o.id), 'Opportunity closed.')}>Close</Button> : null}
                  <Button size="sm" variant="ghost" disabled={busy} aria-label={`Delete ${o.title}`} onClick={() => { if (window.confirm(`Delete “${o.title}”? This can't be undone.`)) void run(() => alumniApi.deleteOpportunity(o.id), 'Opportunity deleted.'); }}>Delete</Button>
                </div>
              </li>
            ))}
          </ul>
        )}
        {pagination && pagination.last_page > 1 ? (
          <div className="flex items-center justify-end gap-2 border-t border-slate-100 px-4 py-3 text-sm text-slate-600">
            <Button variant="outline" size="sm" disabled={pagination.page <= 1} onClick={() => setPage(pagination.page - 1)}>Previous</Button>
            <span className="tabular-nums">Page {pagination.page} of {pagination.last_page}</span>
            <Button variant="outline" size="sm" disabled={pagination.page >= pagination.last_page} onClick={() => setPage(pagination.page + 1)}>Next</Button>
          </div>
        ) : null}
      </section>
    </PageFrame>
  );
}

function OpportunityForm({ initial, onDone }: { initial: OpportunityRow | null; onDone: (message: string) => void }) {
  const [alumnus, setAlumnus] = useState<Picked | null>(initial?.alumni_id ? { id: initial.alumni_id, label: initial.alumni_name ?? 'Alumnus' } : null);
  const [f, setF] = useState({
    type: initial?.type ?? 'internship', company: initial?.company ?? '', title: initial?.title ?? '', location: initial?.location ?? '', experience: initial?.experience ?? '',
    qualification: initial?.qualification ?? '', skills: initial?.skills ?? '', salary: initial?.salary ?? '', last_date: initial?.last_date?.slice(0, 10) ?? '',
    application_url: initial?.application_url ?? '', contact_person: initial?.contact_person ?? '', description: initial?.description ?? '',
  });
  const [errors, setErrors] = useState<Record<string, string[]>>({});
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const set = (key: keyof typeof f, value: string) => setF({ ...f, [key]: value });
  const text = (key: keyof typeof f, label: string, opts: { type?: string; required?: boolean; hint?: string } = {}) => (
    <FormField label={label} required={opts.required} error={errors[key]?.[0]} hint={opts.hint}>
      <input className={inputClass} type={opts.type ?? 'text'} value={f[key]} onChange={(e) => set(key, e.target.value)} aria-invalid={Boolean(errors[key])} />
    </FormField>
  );

  async function submit(event: FormEvent) {
    event.preventDefault();
    setErrors({}); setError(''); setBusy(true);
    const body: Record<string, unknown> = { ...f };
    Object.keys(body).forEach((k) => { if (body[k] === '') body[k] = null; });
    if (!initial && alumnus) body.alumni_id = alumnus.id;
    try {
      await alumniApi.saveOpportunity(body, initial?.id);
      onDone(initial ? 'Opportunity updated.' : 'Opportunity saved.');
    } catch (reason) {
      if (reason instanceof AlumniApiError) { setErrors(reason.fieldErrors); setError(reason.message); } else setError("Couldn't save the opportunity. Try again.");
    } finally { setBusy(false); }
  }

  return (
    <Panel title={initial ? 'Edit opportunity' : 'Add an opportunity'}>
      {error ? <div className="mb-3"><Banner>{error}</Banner></div> : null}
      <form onSubmit={submit} className="grid gap-4 md:grid-cols-3" noValidate>
        <FormField label="Type" required error={errors.type?.[0]}>
          <select className={inputClass} value={f.type} onChange={(e) => set('type', e.target.value)}>{TYPES.map((t) => <option key={t} value={t}>{humanize(t)}</option>)}</select>
        </FormField>
        {text('company', 'Company', { required: true })}
        {text('title', 'Job title', { required: true })}
        {text('location', 'Location')}
        {text('experience', 'Experience')}
        {text('qualification', 'Qualification')}
        {text('skills', 'Skills', { hint: 'Separate with commas.' })}
        {text('salary', 'Salary or CTC', { hint: 'Optional.' })}
        {text('last_date', 'Last date to apply', { type: 'date' })}
        {text('application_url', 'Application link', { hint: 'Must start with http:// or https://' })}
        {text('contact_person', 'Contact person')}
        {!initial ? <AlumniPicker label="Offered by (optional)" value={alumnus} onChange={setAlumnus} error={errors.alumni_id?.[0]} /> : null}
        <div className="md:col-span-3"><FormField label="Description" error={errors.description?.[0]}><textarea className={inputClass + ' h-24 py-2'} value={f.description} onChange={(e) => set('description', e.target.value)} /></FormField></div>
        <div><Button type="submit" className="h-9" disabled={busy}>{initial ? 'Save changes' : 'Save opportunity'}</Button></div>
      </form>
    </Panel>
  );
}

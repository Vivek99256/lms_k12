'use client';

import Link from 'next/link';
import { use, useCallback, useEffect, useState } from 'react';
import { Pencil } from 'lucide-react';
import { Button, buttonVariants } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import {
  alumniApi, AlumniApiError, type AcademicRow, type AlumniProfile, type AlumniStatus, type AlumnusEngagement, type AlumnusEvent, type HistoryRow, type PortalAccount, type PortalInvite,
} from '../../_lib/alumni-api';
import {
  AlumniStatusBadge, Banner, EmptyState, LoadingBlock, PageFrame, Panel, ProgressBar, STATUS_LABEL, formatDate, humanize, inputClass,
} from '../../_components/alumni-ui';
import { CHILD_CONFIGS, ChildSection } from '../../_components/child-section';
import { DocumentsPanel } from '../../_components/documents-panel';
import { PrivacyPanel } from '../../_components/privacy-panel';

const TABS = [
  { key: 'overview', label: 'Overview' },
  { key: 'academic', label: 'Academic history' },
  { key: 'career', label: 'Education and career' },
  { key: 'skills', label: 'Skills and achievements' },
  { key: 'engagement', label: 'Engagement' },
  { key: 'communication', label: 'Communication' },
  { key: 'events', label: 'Events' },
  { key: 'donations', label: 'Donations' },
  { key: 'portal', label: 'Portal access' },
  { key: 'documents', label: 'Documents' },
  { key: 'privacy', label: 'Privacy and consent' },
  { key: 'timeline', label: 'Activity timeline' },
] as const;
type TabKey = (typeof TABS)[number]['key'];

const COMPLETION_LABEL: Record<string, string> = {
  personal: 'Personal details', contact: 'Contact details', academic: 'Academic details', education: 'Higher education',
  career: 'Career', linkedin: 'LinkedIn profile', skills: 'Skills',
};

function Detail({ label, value }: { label: string; value: string | number | null | undefined }) {
  return (
    <div>
      <dt className="text-xs font-medium uppercase tracking-wider text-slate-500">{label}</dt>
      <dd className="mt-0.5 text-sm text-slate-900">{value === null || value === undefined || value === '' ? '—' : String(value)}</dd>
    </div>
  );
}

function CommunicationTab({ alumniId }: { alumniId: number }) {
  const [rows, setRows] = useState<HistoryRow[] | null>(null);
  const [error, setError] = useState('');
  useEffect(() => {
    const controller = new AbortController();
    alumniApi.alumnusHistory(alumniId, controller.signal).then((r) => setRows(r.rows)).catch((reason: unknown) => {
      if (reason instanceof DOMException && reason.name === 'AbortError') return;
      setError(reason instanceof Error ? reason.message : "Couldn't load messages. Try again.");
    });
    return () => controller.abort();
  }, [alumniId]);
  if (error) return <Banner>{error}</Banner>;
  if (!rows) return <LoadingBlock />;
  return (
    <Panel title="Messages sent to this alumnus">
      {rows.length === 0 ? <EmptyState title="No messages yet" hint="Anything sent from Communication, or automatically (birthdays, verification), is listed here." /> : (
        <ul className="divide-y divide-slate-100 text-sm">
          {rows.map((r) => (
            <li key={r.id} className="py-2.5">
              <p className="font-medium text-slate-900">{r.subject ?? humanize(r.comm_type)}</p>
              <p className="text-xs text-slate-500">{formatDate(r.created_at)} · {humanize(r.channel)} · {humanize(r.status)}{r.reason ? ` — ${r.reason}` : ''}</p>
            </li>
          ))}
        </ul>
      )}
    </Panel>
  );
}

function DonationsTab({ alumniId }: { alumniId: number }) {
  const [rows, setRows] = useState<Awaited<ReturnType<typeof alumniApi.alumnusDonations>> | null>(null);
  const [error, setError] = useState('');
  useEffect(() => {
    const controller = new AbortController();
    alumniApi.alumnusDonations(alumniId, controller.signal).then(setRows).catch((reason: unknown) => {
      if (reason instanceof DOMException && reason.name === 'AbortError') return;
      setError(reason instanceof AlumniApiError && reason.status === 403 ? 'Donation records are visible to finance users only.' : reason instanceof Error ? reason.message : "Couldn't load donations. Try again.");
    });
    return () => controller.abort();
  }, [alumniId]);
  if (error) return <Banner tone="info">{error}</Banner>;
  if (!rows) return <LoadingBlock />;
  return (
    <Panel title="Donations" actions={<Link href="/alumni/donations" className="text-sm text-indigo-700 hover:underline">Open Donations</Link>}>
      {rows.length === 0 ? <EmptyState title="No donations yet" hint="Gifts and pledges recorded for this alumnus appear here." /> : (
        <ul className="divide-y divide-slate-100 text-sm">
          {rows.map((r) => (
            <li key={r.id} className="py-2.5">
              <p className="font-medium text-slate-900">₹{Number(r.amount).toLocaleString('en-IN')} · {humanize(r.status)}</p>
              <p className="text-xs text-slate-500">{formatDate(r.received_on ?? r.pledged_on)}{r.campaign_name ? ` · ${r.campaign_name}` : ''}{r.receipt_no ? ` · receipt ${r.receipt_no}` : ''}{Number(r.refunded_amount) > 0 ? ` · ₹${Number(r.refunded_amount).toLocaleString('en-IN')} refunded` : ''}</p>
            </li>
          ))}
        </ul>
      )}
    </Panel>
  );
}

const ACCOUNT_LABEL: Record<string, string> = {
  invited: 'Invited - has not chosen a password yet', unverified: 'Waiting for the email address to be confirmed', active: 'Active', disabled: 'Disabled',
};

function PortalAccessTab({ alumniId, hasEmail }: { alumniId: number; hasEmail: boolean }) {
  const [account, setAccount] = useState<PortalAccount | null | undefined>(undefined);   // undefined = loading, null = none
  const [invite, setInvite] = useState<PortalInvite | null>(null);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);

  const load = useCallback((signal?: AbortSignal) => alumniApi.alumnusAccount(alumniId, signal).then((a) => { setAccount(a); setError(''); }).catch((reason: unknown) => {
    if (reason instanceof DOMException && reason.name === 'AbortError') return;
    setError(reason instanceof Error ? reason.message : "Couldn't load portal access. Try again.");
  }), [alumniId]);
  useEffect(() => { const c = new AbortController(); void load(c.signal); return () => c.abort(); }, [load]);

  async function run(label: string, fn: () => Promise<unknown>, confirmText?: string) {
    if (confirmText && !window.confirm(confirmText)) return;
    setBusy(true); setError(''); setNotice('');
    try { await fn(); setNotice(label); await load(); } catch (reason) { setError(reason instanceof Error ? reason.message : 'Something went wrong. Try again.'); } finally { setBusy(false); }
  }

  if (account === undefined) return error ? <Banner>{error}</Banner> : <LoadingBlock />;
  return (
    <Panel title="Alumni portal access">
      <div className="space-y-4 text-sm">
        {notice ? <Banner tone="success">{notice}</Banner> : null}
        {error ? <Banner>{error}</Banner> : null}
        {account === null ? (
          <p className="text-slate-600">This alumnus has no portal account. Invite them to let them sign in, update their own contact details and register for events.</p>
        ) : (
          <dl className="grid gap-x-6 gap-y-2 md:grid-cols-2">
            <div><dt className="text-slate-500">Status</dt><dd>{ACCOUNT_LABEL[account.status] ?? humanize(account.status)}</dd></div>
            <div><dt className="text-slate-500">Sign-in email</dt><dd>{account.email}</dd></div>
            <div><dt className="text-slate-500">Last signed in</dt><dd>{account.last_login_at ? formatDate(account.last_login_at) : 'Never'}</dd></div>
            <div><dt className="text-slate-500">How it was created</dt><dd>{account.created_via === 'invite' ? 'Invited by staff' : 'Registered by the alumnus'}</dd></div>
            {account.locked ? <div className="md:col-span-2"><Banner tone="info">Locked for a few minutes after too many wrong passwords.</Banner></div> : null}
            {account.disabled_reason ? <div className="md:col-span-2"><dt className="text-slate-500">Reason it was disabled</dt><dd>{account.disabled_reason}</dd></div> : null}
          </dl>
        )}

        <div className="flex flex-wrap gap-2">
          {(account === null || account.status === 'invited') ? (
            <Button className="h-9" disabled={busy || !hasEmail} onClick={() => run('Invitation created.', async () => setInvite((await alumniApi.inviteAlumnus(alumniId)).data))}>{account === null ? 'Send an invitation' : 'Send a new invitation'}</Button>
          ) : null}
          {account?.status === 'unverified' ? <Button variant="outline" className="h-9" disabled={busy} onClick={() => run('A new confirmation link was sent.', () => alumniApi.accountAction(account.id, 'resend-verification'))}>Resend the confirmation email</Button> : null}
          {account && account.status !== 'disabled' ? <Button variant="outline" className="h-9" disabled={busy} onClick={() => run('Signed out everywhere.', () => alumniApi.accountAction(account.id, 'revoke-sessions'), 'Sign this alumnus out of every device?')}>Sign out everywhere</Button> : null}
          {account && account.status !== 'disabled' ? <Button variant="ghost" className="h-9" disabled={busy} onClick={() => { const reason = window.prompt('Why is this account being disabled? (optional)'); if (reason !== null) void run('Account disabled.', () => alumniApi.accountAction(account.id, 'disable', { reason: reason || undefined })); }}>Disable access</Button> : null}
          {account?.status === 'disabled' ? <Button className="h-9" disabled={busy} onClick={() => run('Account enabled.', () => alumniApi.accountAction(account.id, 'enable'))}>Enable access</Button> : null}
        </div>
        {!hasEmail && account === null ? <p className="text-xs text-slate-500">Add an email address to this alumnus before inviting them.</p> : null}

        {invite ? (
          <div className="rounded-md border border-amber-300 bg-amber-50 p-3" role="status">
            <p className="font-medium text-amber-900">{invite.email_status === 'sent' ? `Invitation emailed to ${invite.email}.` : `The email could not be delivered (${invite.email_status}). Give this link to the alumnus yourself.`}</p>
            <p className="mt-1 text-xs text-amber-900">This link is shown only now and works once, for {invite.expires_in_days} days. It is not stored anywhere you can look it up later.</p>
            <input readOnly aria-label="Invitation link" className={inputClass + ' mt-2'} value={invite.link} onFocus={(e) => e.currentTarget.select()} />
            <div className="mt-2 flex gap-2"><Button size="sm" variant="outline" onClick={() => void navigator.clipboard?.writeText(invite.link)}>Copy link</Button><Button size="sm" variant="ghost" onClick={() => setInvite(null)}>Hide</Button></div>
          </div>
        ) : null}
        <p className="text-xs text-slate-500">Staff verify who a self-registered person is from Pending verification; signing in is the alumnus&apos;s own. Staff can never see or set a password.</p>
      </div>
    </Panel>
  );
}

function EventsTab({ alumniId }: { alumniId: number }) {
  const [rows, setRows] = useState<AlumnusEvent[] | null>(null);
  const [error, setError] = useState('');
  useEffect(() => {
    const controller = new AbortController();
    alumniApi.alumnusEvents(alumniId, controller.signal).then(setRows).catch((reason: unknown) => {
      if (reason instanceof DOMException && reason.name === 'AbortError') return;
      setError(reason instanceof Error ? reason.message : "Couldn't load events. Try again.");
    });
    return () => controller.abort();
  }, [alumniId]);
  if (error) return <Banner>{error}</Banner>;
  if (!rows) return <LoadingBlock />;
  return (
    <Panel title="Events">
      {rows.length === 0 ? <EmptyState title="No events yet" hint="Registrations and attendance appear here." /> : (
        <ul className="divide-y divide-slate-100 text-sm">
          {rows.map((r) => (
            <li key={r.event_id} className="py-2.5">
              <Link href={`/alumni/events/${r.event_id}`} className="font-medium text-indigo-700 hover:underline">{r.name}</Link>
              <p className="text-xs text-slate-500">{formatDate(r.event_date)} · {humanize(r.status)}{r.attended_at ? ' · attended' : ''} · {r.registration_no}</p>
            </li>
          ))}
        </ul>
      )}
    </Panel>
  );
}

function EngagementTab({ alumniId }: { alumniId: number }) {
  const [data, setData] = useState<AlumnusEngagement | null>(null);
  const [error, setError] = useState('');
  useEffect(() => {
    const controller = new AbortController();
    alumniApi.alumnusEngagement(alumniId, controller.signal).then(setData).catch((reason: unknown) => {
      if (reason instanceof DOMException && reason.name === 'AbortError') return;
      setError(reason instanceof Error ? reason.message : "Couldn't load engagement. Try again.");
    });
    return () => controller.abort();
  }, [alumniId]);
  if (error) return <Banner>{error}</Banner>;
  if (!data) return <LoadingBlock label="Loading engagement…" />;
  return (
    <Panel title="Engagement">
      <div className="mb-4 flex flex-wrap items-center gap-4">
        <div><p className="text-xs font-medium uppercase tracking-wider text-slate-500">Engagement score</p><p className="text-3xl font-semibold tabular-nums text-slate-900">{data.score}<span className="text-base font-normal text-slate-500"> / 100</span></p></div>
        <div><p className="text-xs font-medium uppercase tracking-wider text-slate-500">Level</p><p className="text-lg font-medium text-slate-900">{data.level_label}</p></div>
        <p className="text-sm text-slate-500">Counts the last {data.window_months} months.</p>
      </div>
      {data.recent.length === 0 ? <EmptyState title="No engagement yet" hint="Record a guest lecture, campus visit or other involvement from the Engagement page." /> : (
        <ul className="divide-y divide-slate-100">
          {data.recent.map((item) => (
            <li key={item.id} className="flex justify-between gap-3 py-2.5 text-sm"><span className="text-slate-900">{item.title}<span className="ml-2 text-xs text-slate-500">{formatDate(item.occurred_at)}</span></span><span className="tabular-nums text-slate-700">+{item.points}</span></li>
          ))}
        </ul>
      )}
    </Panel>
  );
}

/** Verify or reject an achievement, optionally attaching one of the alumnus's uploaded documents as evidence. */
function AchievementActions({ alumniId, row, documents, onChanged }: {
  alumniId: number;
  row: Record<string, string | number | null>;
  documents: AlumniProfile['documents'];
  onChanged: () => void;
}) {
  const [evidence, setEvidence] = useState(row.document_id ? String(row.document_id) : '');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const status = String(row.verification_status ?? 'pending');

  async function decide(decision: 'verified' | 'rejected') {
    setBusy(true);
    setMessage('');
    try {
      await alumniApi.verifyAchievement(alumniId, Number(row.id), decision, evidence ? Number(evidence) : undefined);
      onChanged();
    } catch (reason) {
      setMessage(reason instanceof Error ? reason.message : "Couldn't update. Try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mt-2 flex flex-wrap items-center gap-2">
      {documents.length > 0 ? (
        <select aria-label={`Evidence for ${String(row.title)}`} className={inputClass + ' h-8 w-56 text-xs'} value={evidence} onChange={(event) => setEvidence(event.target.value)}>
          <option value="">No evidence attached</option>
          {documents.map((doc) => <option key={doc.id} value={doc.id}>{doc.original_name}</option>)}
        </select>
      ) : null}
      {status !== 'verified' ? <Button variant="outline" size="sm" disabled={busy} onClick={() => decide('verified')}>Verify</Button> : null}
      {status !== 'rejected' ? <Button variant="outline" size="sm" disabled={busy} onClick={() => decide('rejected')}>Reject</Button> : null}
      {message ? <span className="text-xs text-red-700" role="alert">{message}</span> : null}
    </div>
  );
}

export default function AlumniProfilePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [profile, setProfile] = useState<AlumniProfile | null>(null);
  const [history, setHistory] = useState<{ linked: boolean; rows: AcademicRow[] } | null>(null);
  const [tab, setTab] = useState<TabKey>('overview');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [status, setStatus] = useState<AlumniStatus | ''>('');
  const [remarks, setRemarks] = useState('');
  const [busy, setBusy] = useState(false);

  const load = useCallback(
    (signal?: AbortSignal) =>
      alumniApi
        .show(id, signal)
        .then((result) => {
          setProfile(result);
          setError('');
        })
        .catch((reason: unknown) => {
          if (reason instanceof DOMException && reason.name === 'AbortError') return;
          setError(reason instanceof Error ? reason.message : "Couldn't load the profile. Try again.");
        }),
    [id],
  );

  useEffect(() => {
    const controller = new AbortController();
    void load(controller.signal);
    return () => controller.abort();
  }, [load]);

  useEffect(() => {
    if (tab !== 'academic' || history) return;
    const controller = new AbortController();
    alumniApi.academicHistory(id, controller.signal).then(setHistory).catch((reason: unknown) => {
      if (reason instanceof DOMException && reason.name === 'AbortError') return;
      setError(reason instanceof Error ? reason.message : "Couldn't load academic history. Try again.");
    });
    return () => controller.abort();
  }, [tab, history, id]);

  async function changeStatus() {
    if (!status) return;
    setBusy(true);
    setNotice('');
    try {
      await alumniApi.setStatus(id, status, remarks.trim() || undefined);
      setNotice(`Status changed to ${STATUS_LABEL[status].toLowerCase()}.`);
      setStatus('');
      setRemarks('');
      await load();
    } catch (reason) {
      setError(reason instanceof AlumniApiError ? reason.message : "Couldn't change the status. Try again.");
    } finally {
      setBusy(false);
    }
  }

  if (error && !profile) return <PageFrame title="Alumni profile"><Banner>{error}</Banner></PageFrame>;
  if (!profile) return <PageFrame title="Alumni profile"><LoadingBlock label="Loading profile…" /></PageFrame>;

  const a = profile.alumni;
  const initials = a.full_name.split(/\s+/).filter(Boolean).map((p) => p[0]).join('').slice(0, 2).toUpperCase();
  const missing = profile.completion.sections.filter((s) => !s.done);

  return (
    <PageFrame
      title={a.full_name}
      description={`${a.alumni_code}${a.batch ? ` · Batch ${a.batch}` : ''}${a.passing_year ? ` · Passed ${a.passing_year}` : ''}`}
      actions={
        <>
          <Link href="/alumni/list" className={cn(buttonVariants({ variant: 'ghost' }), 'h-9')}>Back to list</Link>
          <Link href={`/alumni/edit/${a.id}`} className={cn(buttonVariants(), 'h-9')}><Pencil className="size-4" aria-hidden /> Edit</Link>
        </>
      }
    >
      {notice ? <Banner tone="success">{notice}</Banner> : null}
      {error ? <Banner>{error}</Banner> : null}

      <Panel>
        <div className="flex flex-wrap items-center gap-4">
          <div className="flex size-14 items-center justify-center rounded-full bg-indigo-50 text-lg font-semibold text-indigo-700" aria-hidden>{initials}</div>
          <div className="min-w-48 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <AlumniStatusBadge status={a.status as string} />
              <span className="text-sm text-slate-600">{[a.current_job_title, a.current_company].filter(Boolean).join(' at ') || humanize(a.employment_status as string) || 'Work not recorded'}</span>
            </div>
            <p className="mt-1 text-sm text-slate-500">{[a.city, a.country].filter(Boolean).join(', ') || 'Location not recorded'}</p>
          </div>
          <div>
            <p className="text-xs font-medium uppercase tracking-wider text-slate-500">Profile completion</p>
            <ProgressBar percent={profile.completion.percent} />
            {missing.length > 0 ? <p className="mt-1 text-xs text-slate-500">Missing: {missing.map((s) => COMPLETION_LABEL[s.key] ?? s.key).join(', ')}</p> : null}
          </div>
        </div>
        <div className="mt-4 flex flex-wrap items-end gap-2 border-t border-slate-100 pt-4">
          <label className="block space-y-1">
            <span className="text-xs font-medium text-slate-600">Change status</span>
            <select className={inputClass + ' w-52'} value={status} onChange={(e) => setStatus(e.target.value as AlumniStatus | '')}>
              <option value="">Select a status</option>
              {(Object.keys(STATUS_LABEL) as AlumniStatus[]).filter((s) => s !== a.status).map((s) => <option key={s} value={s}>{STATUS_LABEL[s]}</option>)}
            </select>
          </label>
          <label className="block space-y-1">
            <span className="text-xs font-medium text-slate-600">Remarks (optional)</span>
            <input className={inputClass + ' w-64'} value={remarks} onChange={(e) => setRemarks(e.target.value)} />
          </label>
          <Button variant="outline" className="h-9" disabled={!status || busy} onClick={changeStatus}>Update status</Button>
        </div>
      </Panel>

      <div role="tablist" aria-label="Profile sections" className="flex gap-1 overflow-x-auto border-b border-slate-200">
        {TABS.map((t) => (
          <button
            key={t.key}
            role="tab"
            type="button"
            aria-selected={tab === t.key}
            onClick={() => setTab(t.key)}
            className={cn('whitespace-nowrap border-b-2 px-3 py-2 text-sm font-medium', tab === t.key ? 'border-indigo-600 text-indigo-700' : 'border-transparent text-slate-600 hover:text-slate-900')}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div role="tabpanel" className="space-y-4">
        {tab === 'overview' ? (
          <>
            <Panel title="Personal and contact information">
              <dl className="grid gap-4 md:grid-cols-3">
                <Detail label="Gender" value={a.gender} />
                <Detail label="Date of birth" value={a.dob ? formatDate(String(a.dob)) : null} />
                <Detail label="Blood group" value={a.blood_group} />
                <Detail label="Email" value={a.email} />
                <Detail label="Mobile" value={a.mobile} />
                <Detail label="Alternate mobile" value={a.alt_mobile} />
                <Detail label="Current address" value={a.current_address} />
                <Detail label="Permanent address" value={a.permanent_address} />
                <Detail label="City, state, country" value={[a.city, a.state, a.country].filter(Boolean).join(', ')} />
                <Detail label="LinkedIn" value={a.linkedin_url} />
              </dl>
            </Panel>
            <Panel title="Institute details">
              <dl className="grid gap-4 md:grid-cols-3">
                <Detail label="Student ID" value={a.student_id} />
                <Detail label="GR number" value={a.gr_no} />
                <Detail label="Enrollment number" value={a.enrollment_no} />
                <Detail label="Last class" value={[a.last_class, a.division].filter(Boolean).join(' ')} />
                <Detail label="Admission year" value={a.admission_year} />
                <Detail label="Passing year" value={a.passing_year} />
                <Detail label="Leaving date" value={a.leaving_date ? formatDate(String(a.leaving_date)) : null} />
                <Detail label="Source" value={humanize(a.source as string)} />
                <Detail label="Verified on" value={a.verified_at ? formatDate(String(a.verified_at)) : null} />
              </dl>
            </Panel>
            <Panel title="Contact consent">
              <dl className="grid gap-4 md:grid-cols-4">
                <Detail label="Email" value={Number(a.consent_email) ? 'Allowed' : 'Not recorded'} />
                <Detail label="SMS" value={Number(a.consent_sms) ? 'Allowed' : 'Not recorded'} />
                <Detail label="WhatsApp" value={Number(a.consent_whatsapp) ? 'Allowed' : 'Not recorded'} />
                <Detail label="App notifications" value={Number(a.consent_push) ? 'Allowed' : 'Not recorded'} />
              </dl>
            </Panel>
          </>
        ) : null}

        {tab === 'academic' ? (
          <Panel title="Academic history">
            {!history ? (
              <LoadingBlock label="Loading academic history…" />
            ) : !history.linked ? (
              <EmptyState title="Not linked to a student record" hint="This alumnus has no student ID, so there is no ERP history to show. Add a student ID by editing the profile." />
            ) : history.rows.length === 0 ? (
              <EmptyState title="No enrollment records found" hint="The linked student has no enrollment rows for this institute." />
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[480px] text-left text-sm">
                  <thead className="border-b border-slate-200 text-xs uppercase tracking-wider text-slate-500">
                    <tr><th className="py-2 pr-4 font-medium">Academic year</th><th className="py-2 pr-4 font-medium">Class</th><th className="py-2 pr-4 font-medium">Division</th><th className="py-2 pr-4 font-medium">Start</th><th className="py-2 font-medium">End</th></tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {history.rows.map((row) => (
                      <tr key={`${row.syear}-${row.class_name}`}>
                        <td className="py-2.5 pr-4">{row.syear}</td><td className="py-2.5 pr-4">{row.class_name ?? '—'}</td><td className="py-2.5 pr-4">{row.division ?? '—'}</td>
                        <td className="py-2.5 pr-4">{formatDate(row.start_date)}</td><td className="py-2.5">{formatDate(row.end_date)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Panel>
        ) : null}

        {tab === 'career' ? CHILD_CONFIGS.filter((c) => ['education', 'career', 'business'].includes(c.kind)).map((config) => (
          <ChildSection key={config.kind} alumniId={a.id} config={config} rows={profile.children[config.kind]} onChanged={() => void load()} />
        )) : null}

        {tab === 'skills' ? CHILD_CONFIGS.filter((c) => ['skills', 'achievements'].includes(c.kind)).map((config) => (
          <ChildSection
            key={config.kind}
            alumniId={a.id}
            config={config}
            rows={profile.children[config.kind]}
            onChanged={() => void load()}
            renderExtra={config.kind === 'achievements' ? (row) => (
              <AchievementActions alumniId={a.id} row={row} documents={profile.documents} onChanged={() => void load()} />
            ) : undefined}
          />
        )) : null}

        {tab === 'engagement' ? <EngagementTab alumniId={a.id} /> : null}

        {tab === 'communication' ? <CommunicationTab alumniId={a.id} /> : null}

        {tab === 'events' ? <EventsTab alumniId={a.id} /> : null}

        {tab === 'donations' ? <DonationsTab alumniId={a.id} /> : null}

        {tab === 'portal' ? <PortalAccessTab alumniId={a.id} hasEmail={!!a.email} /> : null}

        {tab === 'documents' ? <DocumentsPanel alumniId={a.id} onChanged={() => void load()} /> : null}

        {tab === 'privacy' ? <PrivacyPanel alumniId={a.id} onChanged={() => void load()} /> : null}

        {tab === 'timeline' ? (
          <Panel title="Activity timeline">
            {profile.timeline.length === 0 ? (
              <EmptyState title="No activity yet" />
            ) : (
              <ol className="space-y-3">
                {profile.timeline.map((item) => (
                  <li key={item.id} className="flex gap-3 text-sm">
                    <span className="mt-1.5 size-2 shrink-0 rounded-full bg-indigo-500" aria-hidden />
                    <div>
                      <p className="text-slate-900">{item.title}</p>
                      <p className="text-xs text-slate-500">{formatDate(item.occurred_at)}</p>
                    </div>
                  </li>
                ))}
              </ol>
            )}
          </Panel>
        ) : null}
      </div>
    </PageFrame>
  );
}

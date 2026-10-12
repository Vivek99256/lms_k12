'use client';

import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { Banner, EmptyState, FormField, LoadingBlock, Panel, ProgressBar, formatDate, humanize, inputClass } from '@/app/alumni/_components/alumni-ui';
import { PortalApiError, portalApi, portalSession, type PortalEvent, type PortalMe, type PortalPrivacy } from './_lib/portal-api';
import { PASSWORD_HINT, firstError } from './_components/portal-ui';

const TABS = [['profile', 'My details'], ['privacy', 'Privacy and contact'], ['events', 'Events'], ['password', 'Password']] as const;
type Tab = (typeof TABS)[number][0];

const FIELD_LABEL: Record<string, string> = {
  mobile: 'Mobile', alt_mobile: 'Alternate mobile', current_address: 'Current address', permanent_address: 'Permanent address', city: 'City', state: 'State', country: 'Country',
  pincode: 'Pincode', linkedin_url: 'LinkedIn profile', employment_status: 'What are you doing now?',
};
const EMPLOYMENT = ['student', 'job_seeking', 'employed', 'self_employed', 'entrepreneur', 'freelancer', 'government_employee', 'retired', 'other'];
const CONSENT_LABEL: Record<string, string> = { consent_email: 'Email', consent_sms: 'SMS', consent_whatsapp: 'WhatsApp', consent_push: 'App notifications' };
const LEVEL_LABEL: Record<string, string> = { public: 'Everyone', alumni_only: 'Other alumni and the institute', institution_only: 'The institute only', private: 'Only me', default: 'Use the institute\'s default' };

export default function PortalHomePage() {
  const router = useRouter();
  const [me, setMe] = useState<PortalMe | null>(null);
  const [tab, setTab] = useState<Tab>('profile');
  const [error, setError] = useState('');

  const load = useCallback((signal?: AbortSignal) =>
    portalApi.me(signal).then((r) => { setMe(r); setError(''); }).catch((reason: unknown) => {
      if (reason instanceof DOMException && reason.name === 'AbortError') return;
      if (reason instanceof PortalApiError && reason.status === 401) { router.replace('/alumni-portal/login'); return; }
      setError(reason instanceof Error ? reason.message : "Couldn't load your details. Please try again.");
    }), [router]);

  useEffect(() => {
    if (!portalSession.isSignedIn()) { router.replace('/alumni-portal/login'); return; }
    const controller = new AbortController();
    void load(controller.signal);
    return () => controller.abort();
  }, [load, router]);

  async function signOut() {
    await portalApi.logout();
    router.replace('/alumni-portal/login');
  }

  if (!me) {
    return <main className="mx-auto max-w-3xl px-4 py-10">{error ? <Banner>{error}</Banner> : <LoadingBlock label="Loading your details…" />}</main>;
  }
  const p = me.profile;

  return (
    <main className="mx-auto w-full max-w-3xl space-y-4 px-4 py-8">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest text-indigo-600">Alumni portal</p>
          <h1 className="text-2xl font-semibold text-slate-900">{p.full_name}</h1>
          <p className="text-sm text-slate-600">{p.alumni_code}{p.batch ? ` · Batch ${p.batch}` : ''}{p.course ? ` · ${p.course}` : ''}</p>
        </div>
        <Button variant="outline" className="h-9" onClick={() => void signOut()}>Sign out</Button>
      </header>

      {me.standing.message ? <Banner tone="info">{me.standing.message}</Banner> : null}
      {error ? <Banner>{error}</Banner> : null}

      <div role="tablist" aria-label="Portal sections" className="flex flex-wrap gap-1 border-b border-slate-200">
        {TABS.map(([key, label]) => (
          <button key={key} role="tab" type="button" aria-selected={tab === key} onClick={() => setTab(key)}
            className={cn('border-b-2 px-3 py-2 text-sm font-medium', tab === key ? 'border-indigo-600 text-indigo-700' : 'border-transparent text-slate-600 hover:text-slate-900')}>{label}</button>
        ))}
      </div>

      {tab === 'profile' ? <ProfileTab me={me} onSaved={setMe} /> : null}
      {tab === 'privacy' ? <PrivacyTab /> : null}
      {tab === 'events' ? <EventsTab enabled={me.standing.features_enabled} /> : null}
      {tab === 'password' ? <PasswordTab onChanged={() => void load()} /> : null}
    </main>
  );
}

function ProfileTab({ me, onSaved }: { me: PortalMe; onSaved: (me: PortalMe) => void }) {
  const p = me.profile;
  const [f, setF] = useState<Record<string, string>>(() => Object.fromEntries(me.editable_fields.map((k) => [k, String((p as unknown as Record<string, unknown>)[k] ?? '')])));
  const [errors, setErrors] = useState<Record<string, string[]>>({});
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);
  const locked = !me.standing.features_enabled;

  async function save(event: FormEvent) {
    event.preventDefault();
    setErrors({}); setError(''); setNotice(''); setBusy(true);
    try {
      onSaved(await portalApi.updateMe(Object.fromEntries(Object.entries(f).map(([k, v]) => [k, v.trim() === '' ? null : v.trim()]))));
      setNotice('Your details are saved.');
    } catch (reason) {
      if (reason instanceof PortalApiError) { setErrors(reason.fieldErrors); setError(reason.message); } else setError("Couldn't save. Please try again.");
    } finally { setBusy(false); }
  }

  return (
    <div className="space-y-4">
      <Panel title="Your record at the institute">
        <dl className="grid gap-x-6 gap-y-2 text-sm md:grid-cols-2">
          <div><dt className="text-slate-500">Name</dt><dd>{p.full_name}</dd></div>
          <div><dt className="text-slate-500">Sign-in email</dt><dd>{p.email}</dd></div>
          <div><dt className="text-slate-500">Batch</dt><dd>{p.batch ?? '—'}</dd></div>
          <div><dt className="text-slate-500">Year you left</dt><dd>{p.passing_year ?? '—'}</dd></div>
          {p.current_company ? <div><dt className="text-slate-500">Works at</dt><dd>{p.current_company}{p.current_job_title ? ` · ${p.current_job_title}` : ''}</dd></div> : null}
        </dl>
        <p className="mt-3 text-xs text-slate-500">Your name, batch and email are kept by the institute. To correct them, contact the institute.</p>
        <div className="mt-3"><p className="mb-1 text-xs text-slate-500">Profile completeness</p><ProgressBar percent={p.profile_completion} /></div>
      </Panel>

      <Panel title="Contact details you can update">
        <form onSubmit={save} noValidate className="grid gap-4 md:grid-cols-2">
          {notice ? <div className="md:col-span-2"><Banner tone="success">{notice}</Banner></div> : null}
          {error ? <div className="md:col-span-2"><Banner>{error}</Banner></div> : null}
          {me.editable_fields.map((k) => (
            <FormField key={k} label={FIELD_LABEL[k] ?? humanize(k)} error={firstError(errors, k)}>
              {k === 'employment_status' ? (
                <select className={inputClass} value={f[k]} disabled={locked} onChange={(e) => setF({ ...f, [k]: e.target.value })}><option value="">Not set</option>{EMPLOYMENT.map((o) => <option key={o} value={o}>{humanize(o)}</option>)}</select>
              ) : (
                <input className={inputClass} value={f[k]} disabled={locked} onChange={(e) => setF({ ...f, [k]: e.target.value })} />
              )}
            </FormField>
          ))}
          <div className="md:col-span-2"><Button type="submit" className="h-9" disabled={busy || locked}>Save changes</Button></div>
        </form>
      </Panel>
    </div>
  );
}

function PrivacyTab() {
  const [data, setData] = useState<PortalPrivacy | null>(null);
  const [levels, setLevels] = useState<Record<string, string>>({});
  const [consents, setConsents] = useState<Record<string, boolean>>({});
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);

  const apply = (d: PortalPrivacy) => {
    setData(d);
    setLevels(Object.fromEntries(d.fields.map((x) => [x.key, x.is_default ? 'default' : x.level])));
    setConsents(d.consents);
  };
  useEffect(() => {
    const controller = new AbortController();
    portalApi.privacy(controller.signal).then(apply).catch((reason: unknown) => {
      if (reason instanceof DOMException && reason.name === 'AbortError') return;
      setError(reason instanceof Error ? reason.message : "Couldn't load your choices. Please try again.");
    });
    return () => controller.abort();
  }, []);

  async function save() {
    setBusy(true); setError(''); setNotice('');
    try { const r = await portalApi.savePrivacy(levels, consents); apply(r.data); setNotice('Your choices are saved.'); }
    catch (reason) { setError(reason instanceof Error ? reason.message : "Couldn't save. Please try again."); }
    finally { setBusy(false); }
  }

  if (!data) return error ? <Banner>{error}</Banner> : <LoadingBlock />;
  return (
    <div className="space-y-4">
      {notice ? <Banner tone="success">{notice}</Banner> : null}
      {error ? <Banner>{error}</Banner> : null}
      <Panel title="Who can see your details">
        <p className="mb-3 text-sm text-slate-600">The institute always keeps your record. These choices decide what other people can see in the alumni directory.</p>
        <div className="grid gap-3 md:grid-cols-2">
          {data.fields.map((x) => (
            <FormField key={x.key} label={x.label}>
              <select className={inputClass} value={levels[x.key]} onChange={(e) => setLevels({ ...levels, [x.key]: e.target.value })}>
                {['default', ...data.levels].map((l) => <option key={l} value={l}>{LEVEL_LABEL[l] ?? humanize(l)}</option>)}
              </select>
            </FormField>
          ))}
        </div>
      </Panel>
      <Panel title="How the institute may contact you">
        <p className="mb-3 text-sm text-slate-600">Announcements and invitations are only sent on the channels you tick. Important account messages (such as password resets) are always sent by email.</p>
        <div className="flex flex-wrap gap-4">
          {Object.entries(CONSENT_LABEL).map(([key, label]) => (
            <label key={key} className="flex items-center gap-2 text-sm text-slate-800"><input type="checkbox" checked={!!consents[key]} onChange={(e) => setConsents({ ...consents, [key]: e.target.checked })} /> {label}</label>
          ))}
        </div>
      </Panel>
      <Button className="h-9" disabled={busy} onClick={() => void save()}>Save my choices</Button>
    </div>
  );
}

function EventsTab({ enabled }: { enabled: boolean }) {
  const [events, setEvents] = useState<PortalEvent[] | null>(null);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState<number | null>(null);

  const load = useCallback((signal?: AbortSignal) => {
    if (!enabled) return Promise.resolve();
    return portalApi.events(signal).then((r) => { setEvents(r); setError(''); }).catch((reason: unknown) => {
      if (reason instanceof DOMException && reason.name === 'AbortError') return;
      setError(reason instanceof Error ? reason.message : "Couldn't load events. Please try again.");
    });
  }, [enabled]);
  useEffect(() => { const c = new AbortController(); void load(c.signal); return () => c.abort(); }, [load]);

  async function act(id: number, fn: () => Promise<{ message: string }>) {
    setBusy(id); setError(''); setNotice('');
    try { setNotice((await fn()).message); await load(); } catch (reason) { setError(reason instanceof Error ? reason.message : 'Something went wrong. Please try again.'); } finally { setBusy(null); }
  }

  if (!enabled) return <Banner tone="info">Events open up once the institute has verified your registration.</Banner>;
  if (events === null) return error ? <Banner>{error}</Banner> : <LoadingBlock label="Loading events…" />;
  return (
    <div className="space-y-3">
      {notice ? <Banner tone="success">{notice}</Banner> : null}
      {error ? <Banner>{error}</Banner> : null}
      {events.length === 0 ? <EmptyState title="No upcoming events" hint="Events you can join will appear here." /> : events.map((e) => (
        <Panel key={e.id} title={e.name}>
          <div className="space-y-2 text-sm text-slate-700">
            <p>{formatDate(e.event_date)}{e.start_time ? ` · ${e.start_time}` : ''}{e.venue ? ` · ${e.venue}` : ''}{e.mode !== 'offline' ? ` · ${humanize(e.mode)}` : ''}</p>
            {e.description ? <p className="whitespace-pre-wrap text-slate-600">{e.description}</p> : null}
            {e.fee_amount > 0 ? <p>Fee: ₹{e.fee_amount.toLocaleString('en-IN')} — pay the institute directly; your registration is confirmed once they record it.</p> : null}
            {e.online_link ? <p>Link: <span className="break-all">{e.online_link}</span></p> : null}
            {e.my_registration ? (
              <div className="flex flex-wrap items-center gap-3">
                <span className="font-medium text-emerald-700">You are {e.my_registration.status === 'waitlisted' ? 'on the waiting list' : 'registered'} ({e.my_registration.registration_no})</span>
                <Button size="sm" variant="outline" disabled={busy === e.id} onClick={() => { if (window.confirm('Cancel your registration?')) void act(e.id, () => portalApi.cancelEvent(e.id).then((r) => ({ message: r.message }))); }}>Cancel registration</Button>
              </div>
            ) : (
              <Button size="sm" disabled={busy === e.id} onClick={() => void act(e.id, () => portalApi.registerForEvent(e.id, 1).then((r) => ({ message: r.message })))}>Register</Button>
            )}
          </div>
        </Panel>
      ))}
    </div>
  );
}

function PasswordTab({ onChanged }: { onChanged: () => void }) {
  const [f, setF] = useState({ current: '', next: '', again: '' });
  const [errors, setErrors] = useState<Record<string, string[]>>({});
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setErrors({}); setError(''); setNotice('');
    if (f.next !== f.again) { setErrors({ again: ['The two passwords are not the same.'] }); return; }
    setBusy(true);
    try { setNotice((await portalApi.changePassword(f.current, f.next)).message); setF({ current: '', next: '', again: '' }); onChanged(); }
    catch (reason) { if (reason instanceof PortalApiError) { setErrors(reason.fieldErrors); setError(reason.message); } else setError("Couldn't change your password. Please try again."); }
    finally { setBusy(false); }
  }

  return (
    <Panel title="Change your password">
      <form onSubmit={submit} noValidate className="max-w-md space-y-4">
        {notice ? <Banner tone="success">{notice}</Banner> : null}
        {error ? <Banner>{error}</Banner> : null}
        <FormField label="Current password" error={firstError(errors, 'current_password')}><input className={inputClass} type="password" value={f.current} onChange={(e) => setF({ ...f, current: e.target.value })} autoComplete="current-password" /></FormField>
        <FormField label="New password" hint={PASSWORD_HINT} error={firstError(errors, 'password')}><input className={inputClass} type="password" value={f.next} onChange={(e) => setF({ ...f, next: e.target.value })} autoComplete="new-password" /></FormField>
        <FormField label="Type it again" error={firstError(errors, 'again')}><input className={inputClass} type="password" value={f.again} onChange={(e) => setF({ ...f, again: e.target.value })} autoComplete="new-password" /></FormField>
        <Button type="submit" className="h-9" disabled={busy}>Change password</Button>
        <p className="text-xs text-slate-500">Other devices are signed out when you change it.</p>
      </form>
    </Panel>
  );
}

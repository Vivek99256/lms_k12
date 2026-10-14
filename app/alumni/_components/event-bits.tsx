'use client';

import { useState, type FormEvent } from 'react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { alumniApi, AlumniApiError } from '../_lib/alumni-api';
import { AudienceFilters, type AudienceValue } from './audience';
import { Banner, FormField, Panel, humanize, inputClass } from './alumni-ui';

const TONE: Record<string, string> = {
  draft: 'bg-slate-100 text-slate-600 ring-slate-200', published: 'bg-emerald-50 text-emerald-800 ring-emerald-200',
  completed: 'bg-blue-50 text-blue-800 ring-blue-200', cancelled: 'bg-red-50 text-red-800 ring-red-200',
};
export function EventStatus({ value }: { value: string }) {
  return <span className={cn('inline-flex rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset', TONE[value] ?? TONE.draft)}>{humanize(value)}</span>;
}

const BLANK = {
  name: '', event_type: 'alumni_meet', event_date: '', start_time: '', end_time: '', venue: '', mode: 'offline', online_link: '', capacity: '',
  registration_required: true, auto_confirm: true, registration_deadline: '', organizer: '', contact_person: '', contact_phone: '', contact_email: '', fee_amount: '', description: '',
};

export function EventForm({ types, initial, eventId, onSaved }: { types: { key: string; label: string }[]; initial?: Partial<typeof BLANK>; eventId?: number; onSaved: () => void }) {
  const [f, setF] = useState({ ...BLANK, ...initial });
  const [audience, setAudience] = useState<AudienceValue>({});
  const [errors, setErrors] = useState<Record<string, string[]>>({});
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const set = (key: keyof typeof BLANK, value: string | boolean) => setF((p) => ({ ...p, [key]: value }));
  const text = (key: keyof typeof BLANK, label: string, type = 'text', required = false) => (
    <FormField label={label} required={required} error={errors[key]?.[0]}>
      <input className={inputClass} type={type} value={String(f[key])} onChange={(e) => set(key, e.target.value)} />
    </FormField>
  );

  async function submit(event: FormEvent) {
    event.preventDefault();
    setErrors({}); setError('');
    const missing: Record<string, string[]> = {};
    if (!f.name.trim()) missing.name = ['Give the event a name.'];
    if (!f.event_date) missing.event_date = ['Choose the event date.'];
    if (Object.keys(missing).length) { setErrors(missing); return; }
    setBusy(true);
    try {
      const body: Record<string, unknown> = { ...f, capacity: f.capacity ? Number(f.capacity) : null, fee_amount: f.fee_amount ? Number(f.fee_amount) : 0 };
      for (const k of Object.keys(body)) if (body[k] === '') body[k] = null;
      if (Object.keys(audience).length) body.filters = audience;
      await alumniApi.saveEvent(body, eventId);
      onSaved();
    } catch (reason) {
      if (reason instanceof AlumniApiError) { setErrors(reason.fieldErrors); setError(reason.message); } else setError("Couldn't save the event. Try again.");
    } finally { setBusy(false); }
  }

  return (
    <Panel title={eventId ? 'Edit event' : 'New event'}>
      <form onSubmit={submit} noValidate className="space-y-4">
        {error ? <Banner>{error}</Banner> : null}
        <div className="grid gap-4 md:grid-cols-4">
          <div className="md:col-span-2">{text('name', 'Event name', 'text', true)}</div>
          <FormField label="Type" required error={errors.event_type?.[0]}>
            <select className={inputClass} value={f.event_type} onChange={(e) => set('event_type', e.target.value)}>{types.map((t) => <option key={t.key} value={t.key}>{t.label}</option>)}</select>
          </FormField>
          <FormField label="Mode" error={errors.mode?.[0]}>
            <select className={inputClass} value={f.mode} onChange={(e) => set('mode', e.target.value)}><option value="offline">In person</option><option value="online">Online</option><option value="hybrid">Hybrid</option></select>
          </FormField>
          {text('event_date', 'Date', 'date', true)}{text('start_time', 'Starts', 'time')}{text('end_time', 'Ends', 'time')}{text('registration_deadline', 'Register by', 'date')}
          <div className="md:col-span-2">{text('venue', 'Venue')}</div>{text('online_link', 'Online link')}{text('capacity', 'Capacity (blank = unlimited)', 'number')}
          {text('organizer', 'Organizer')}{text('contact_person', 'Contact person')}{text('contact_phone', 'Contact phone')}{text('contact_email', 'Contact email', 'email')}
          {text('fee_amount', 'Fee (₹, 0 = free)', 'number')}
          <label className="flex items-center gap-2 pt-6 text-sm text-slate-700"><input type="checkbox" checked={f.registration_required} onChange={(e) => set('registration_required', e.target.checked)} /> Registration required</label>
          <label className="flex items-center gap-2 pt-6 text-sm text-slate-700"><input type="checkbox" checked={f.auto_confirm} onChange={(e) => set('auto_confirm', e.target.checked)} /> Confirm automatically</label>
          <div className="md:col-span-4"><FormField label="Description" error={errors.description?.[0]}><textarea className={inputClass + ' h-24 py-2'} value={f.description} onChange={(e) => set('description', e.target.value)} /></FormField></div>
        </div>
        <div>
          <h3 className="mb-2 text-sm font-medium text-slate-700">Who is it for? (used when you send invitations)</h3>
          <AudienceFilters value={audience} onChange={setAudience} />
        </div>
        <Button type="submit" className="h-9" disabled={busy}>{eventId ? 'Save changes' : 'Create event'}</Button>
      </form>
    </Panel>
  );
}

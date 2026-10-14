'use client';

import { useEffect, useState } from 'react';
import { alumniApi, type AlumniMeta, type CommMeta } from '../_lib/alumni-api';
import { FormField, inputClass } from './alumni-ui';

export type AudienceValue = Record<string, string>;

/**
 * "Who is this for?" - the same filters the alumni list uses, plus a passing-year range. Used by campaigns, events and
 * surveys. Only eligible alumni (registered, verified or active) are ever reached, whatever is chosen here.
 */
export function AudienceFilters({ value, onChange }: { value: AudienceValue; onChange: (value: AudienceValue) => void }) {
  const [meta, setMeta] = useState<AlumniMeta | null>(null);
  useEffect(() => {
    const controller = new AbortController();
    alumniApi.meta(controller.signal).then(setMeta).catch(() => undefined);
    return () => controller.abort();
  }, []);

  const set = (key: string, next: string) => {
    const copy = { ...value };
    if (next) copy[key] = next;
    else delete copy[key];
    onChange(copy);
  };
  const select = (key: string, label: string, options: (string | number)[] = []) => (
    <FormField label={label}>
      <select className={inputClass} value={value[key] ?? ''} onChange={(event) => set(key, event.target.value)}>
        <option value="">Any</option>
        {options.map((option) => <option key={String(option)} value={String(option)}>{String(option)}</option>)}
      </select>
    </FormField>
  );
  const text = (key: string, label: string, type = 'text') => (
    <FormField label={label}>
      <input className={inputClass} type={type} value={value[key] ?? ''} onChange={(event) => set(key, event.target.value)} />
    </FormField>
  );

  return (
    <div className="grid gap-3 md:grid-cols-4">
      {select('batch', 'Batch', meta?.batches)}
      {text('passing_year_from', 'Passing year from', 'number')}
      {text('passing_year_to', 'Passing year to', 'number')}
      {select('country', 'Country', meta?.countries)}
      {select('city', 'City', meta?.cities)}
      {select('industry', 'Industry', meta?.industries)}
      {text('company', 'Company')}
      {text('skill', 'Skill')}
    </div>
  );
}

const STATE_TONE: Record<string, string> = {
  live: 'text-emerald-700', file_only: 'text-amber-700', not_configured: 'text-slate-500', driver_missing: 'text-amber-700', off: 'text-slate-500',
};
const STATE_LABEL: Record<string, string> = {
  live: 'Live', file_only: 'Not delivered', not_configured: 'Not configured', driver_missing: 'No driver yet', off: 'Switched off',
};
export const CHANNEL_LABEL: Record<string, string> = { email: 'Email', sms: 'SMS', whatsapp: 'WhatsApp', mobile: 'Mobile app', web: 'In-app inbox' };

/** Channel checkboxes that say, per channel, whether a message would really be delivered today. */
export function ChannelPicker({ meta, value, onChange }: { meta: CommMeta | null; value: string[]; onChange: (value: string[]) => void }) {
  return (
    <fieldset>
      <legend className="text-sm font-medium text-slate-700">Channels</legend>
      <p className="text-xs text-slate-500">Only alumni who have consented to a channel are messaged on it. A channel that is not set up records the message as skipped and says why.</p>
      <ul className="mt-2 grid gap-2 md:grid-cols-2 xl:grid-cols-5">
        {(meta?.channels ?? []).map((channel) => (
          <li key={channel.key} className="rounded-md border border-slate-200 p-2.5">
            <label className="flex items-center gap-2 text-sm font-medium text-slate-800">
              <input type="checkbox" checked={value.includes(channel.key)} onChange={(event) => onChange(event.target.checked ? [...value, channel.key] : value.filter((c) => c !== channel.key))} />
              {CHANNEL_LABEL[channel.key] ?? channel.key}
            </label>
            <p className={`mt-1 text-xs ${STATE_TONE[channel.state] ?? ''}`}>{STATE_LABEL[channel.state] ?? channel.state}</p>
            <p className="text-xs text-slate-500">{channel.note}</p>
          </li>
        ))}
      </ul>
    </fieldset>
  );
}

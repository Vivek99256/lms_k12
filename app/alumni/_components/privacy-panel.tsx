'use client';

import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { alumniApi, AlumniApiError, type PrivacyPayload } from '../_lib/alumni-api';
import { Banner, LoadingBlock, Panel, inputClass } from './alumni-ui';

const LEVEL_LABEL: Record<string, string> = {
  public: 'Public',
  alumni_only: 'Alumni only',
  institution_only: 'Institution only',
  private: 'Private',
};

const LEVEL_HELP: Record<string, string> = {
  public: 'Anyone who can see the directory.',
  alumni_only: 'Other alumni and the institute.',
  institution_only: 'The institute only, not other alumni.',
  private: 'Only the alumnus. Left out of the directory and of exports.',
};

const CONSENTS: { key: keyof PrivacyPayload['consents']; label: string }[] = [
  { key: 'consent_email', label: 'Email' },
  { key: 'consent_sms', label: 'SMS' },
  { key: 'consent_whatsapp', label: 'WhatsApp' },
  { key: 'consent_push', label: 'App notifications' },
];

export function PrivacyPanel({ alumniId, onChanged }: { alumniId: number; onChanged?: () => void }) {
  const [data, setData] = useState<PrivacyPayload | null>(null);
  const [levels, setLevels] = useState<Record<string, string>>({});
  const [consents, setConsents] = useState<PrivacyPayload['consents'] | null>(null);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    alumniApi
      .privacy(alumniId, controller.signal)
      .then((result) => {
        setData(result);
        setLevels(Object.fromEntries(result.fields.map((field) => [field.key, field.level])));
        setConsents(result.consents);
      })
      .catch((reason: unknown) => {
        if (reason instanceof DOMException && reason.name === 'AbortError') return;
        setError(reason instanceof Error ? reason.message : "Couldn't load privacy settings. Try again.");
      });
    return () => controller.abort();
  }, [alumniId]);

  async function save() {
    if (!data || !consents) return;
    setBusy(true);
    setError('');
    setNotice('');
    try {
      const result = await alumniApi.savePrivacy(alumniId, { fields: levels, consents });
      setData(result.data);
      setLevels(Object.fromEntries(result.data.fields.map((field) => [field.key, field.level])));
      setConsents(result.data.consents);
      setNotice('Privacy and consent settings saved.');
      onChanged?.();
    } catch (reason) {
      setError(reason instanceof AlumniApiError ? reason.message : "Couldn't save. Try again.");
    } finally {
      setBusy(false);
    }
  }

  if (error && !data) return <Banner>{error}</Banner>;
  if (!data || !consents) return <LoadingBlock label="Loading privacy settings…" />;

  return (
    <div className="space-y-4">
      {notice ? <Banner tone="success">{notice}</Banner> : null}
      {error ? <Banner>{error}</Banner> : null}

      <Panel title="Who can see each detail">
        <p className="mb-3 text-sm text-slate-500">Record the choices the alumnus has asked for. Name, Alumni ID, batch and passing year are always visible.</p>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[520px] text-left text-sm">
            <thead className="border-b border-slate-200 text-xs uppercase tracking-wider text-slate-500">
              <tr><th className="py-2 pr-4 font-medium">Detail</th><th className="py-2 pr-4 font-medium">Visible to</th><th className="py-2 font-medium">What that means</th></tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {data.fields.map((field) => (
                <tr key={field.key}>
                  <td className="py-2.5 pr-4 text-slate-900">{field.label}</td>
                  <td className="py-2.5 pr-4">
                    <select aria-label={`Who can see ${field.label}`} className={inputClass + ' w-44'} value={levels[field.key]} onChange={(event) => setLevels({ ...levels, [field.key]: event.target.value })}>
                      {data.levels.map((level) => <option key={level} value={level}>{LEVEL_LABEL[level] ?? level}</option>)}
                    </select>
                    {field.is_default && levels[field.key] === field.level ? <span className="ml-2 text-xs text-slate-500">Default</span> : null}
                  </td>
                  <td className="py-2.5 text-slate-500">{LEVEL_HELP[levels[field.key]]}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>

      <Panel title="Contact consent">
        <p className="mb-3 text-sm text-slate-500">Nobody is contacted on a channel without consent.</p>
        <div className="flex flex-wrap gap-4">
          {CONSENTS.map((consent) => (
            <label key={consent.key} className="flex items-center gap-2 text-sm text-slate-700">
              <input type="checkbox" checked={consents[consent.key]} onChange={(event) => setConsents({ ...consents, [consent.key]: event.target.checked })} />
              {consent.label}
            </label>
          ))}
        </div>
      </Panel>

      <div className="flex justify-end">
        <Button className="h-9" disabled={busy} onClick={save}>Save privacy settings</Button>
      </div>
    </div>
  );
}

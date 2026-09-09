'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { Check, Copy, KeyRound, MessageSquareText, RefreshCw, Save, Server } from 'lucide-react';

import { fetchProjects, rotateProjectToken, saveProjectSettings } from '@/lib/ai/conversational-admin/client';
import {
  CHANNEL_LANGUAGES,
  SUGGESTED_PROMPT_SOURCES,
  type ChannelSettingsInput,
  type ProjectAdminRow,
  type ProjectChannelSettings,
} from '@/lib/ai/conversational-admin/types';

import { Card, ErrorState, HeroHeader, LoadingState, Pill } from '../../../_components/primitives';
import { useBrainResource } from '../../../_components/useBrainResource';

/**
 * Conversational AI administration.
 *
 * Three panels, top to bottom: the adapters the project resolver has registered
 * (read straight from the registry — the screen cannot show a project the
 * endpoint would not serve), each project's channel settings, and the service
 * tokens external projects present. A token's plaintext appears once, at
 * rotation; afterwards only its masked form is known, the way stored secrets
 * are shown elsewhere in the ERP.
 */

function formatWhen(iso: string | null): string {
  if (!iso) return 'Never';
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? iso : date.toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' });
}

export function ConversationalAiAdmin() {
  const projects = useBrainResource(fetchProjects, []);
  const [note, setNote] = useState<{ tone: 'ok' | 'error'; text: string } | null>(null);

  const rows = projects.data ?? [];
  const externalRows = rows.filter((row) => row.adapter.kind === 'external');

  const onSaved = useCallback(
    (settings: ProjectChannelSettings) => {
      projects.setData((current) =>
        (current ?? []).map((row) => (row.adapter.projectId === settings.project_id ? { ...row, settings } : row)),
      );
      setNote({ tone: 'ok', text: `Settings saved for ${settings.project_id}.` });
    },
    [projects],
  );

  const body = (() => {
    if (projects.loading && !projects.data) return <LoadingState label="Loading project adapters" />;
    if (projects.error && !projects.data) return <ErrorState message={projects.error} onRetry={projects.refresh} />;

    return (
      <div className="space-y-6">
        {note && (
          <div
            role="status"
            className={`rounded-xl border px-4 py-3 text-sm ${
              note.tone === 'ok' ? 'border-emerald-200 bg-emerald-50 text-emerald-800' : 'border-red-200 bg-red-50 text-red-700'
            }`}
          >
            {note.text}
          </div>
        )}

        <AdapterRegistry rows={rows} />

        <section>
          <h2 className="mb-3 text-sm font-semibold text-slate-900">Channel settings</h2>
          <div className="grid gap-4 lg:grid-cols-2">
            {rows.map((row) => (
              <SettingsCard key={row.adapter.projectId} row={row} onSaved={onSaved} onError={(text) => setNote({ tone: 'error', text })} />
            ))}
          </div>
        </section>

        <ServiceTokens rows={externalRows} onRotated={projects.refresh} onError={(text) => setNote({ tone: 'error', text })} />
      </div>
    );
  })();

  return (
    <div className="p-6">
      <HeroHeader
        breadcrumb="Administration · AI & Intelligence"
        title="Conversational AI"
        description="The project adapters behind the shared assistant endpoint, how each project's channel behaves, and the service tokens external projects use to call it."
        meta={
          <>
            <span className="flex items-center gap-1.5">
              <Server size={14} /> {rows.length} registered
            </span>
            <span className="flex items-center gap-1.5">
              <KeyRound size={14} /> {externalRows.filter((row) => row.token).length} of {externalRows.length} external tokens issued
            </span>
          </>
        }
        actions={
          <button
            type="button"
            onClick={projects.refresh}
            disabled={projects.refreshing}
            className="flex items-center gap-2 rounded-xl border border-white/20 bg-white/10 px-3 py-2 text-xs font-bold text-white transition-colors hover:bg-white/20 disabled:opacity-60"
          >
            <RefreshCw size={14} className={projects.refreshing ? 'animate-spin' : ''} />
            Refresh
          </button>
        }
      />
      {body}
    </div>
  );
}

function AdapterRegistry({ rows }: { rows: ProjectAdminRow[] }) {
  return (
    <section>
      <h2 className="mb-3 text-sm font-semibold text-slate-900">Registered project adapters</h2>
      <Card>
        {rows.length === 0 ? (
          <p className="px-4 py-6 text-sm text-slate-400">No project adapters are registered in lib/ai/project-resolver.ts.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-full border-collapse text-left text-sm">
              <thead className="bg-gray-50/95">
                <tr>
                  {['Project id', 'Label', 'Kind', 'Adapter', 'Description'].map((label) => (
                    <th
                      key={label}
                      className="whitespace-nowrap border-b border-gray-200 px-4 py-2.5 text-[11px] font-bold uppercase tracking-widest text-gray-500"
                    >
                      {label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {rows.map(({ adapter }) => (
                  <tr key={adapter.projectId} className="transition-colors hover:bg-gray-50/70">
                    <td className="px-4 py-2.5 font-mono text-[13px] text-slate-800">{adapter.projectId}</td>
                    <td className="px-4 py-2.5 text-slate-700">{adapter.label}</td>
                    <td className="px-4 py-2.5">
                      <Pill tone={adapter.kind === 'host' ? 'blue' : 'gray'}>{adapter.kind === 'host' ? 'Host' : 'External'}</Pill>
                    </td>
                    <td className="px-4 py-2.5">
                      <Pill tone={adapter.implemented ? 'green' : 'amber'}>{adapter.implemented ? 'Wired' : 'Declared only'}</Pill>
                    </td>
                    <td className="max-w-[28rem] px-4 py-2.5 text-slate-600">{adapter.description}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </section>
  );
}

function SettingsCard({
  row,
  onSaved,
  onError,
}: {
  row: ProjectAdminRow;
  onSaved: (settings: ProjectChannelSettings) => void;
  onError: (message: string) => void;
}) {
  const { adapter, settings } = row;
  const [draft, setDraft] = useState<ChannelSettingsInput>(() => pick(settings));
  const [saving, setSaving] = useState(false);

  // A refresh from the server replaces the draft; an unsaved edit is not worth
  // more than the stored truth on an administration screen.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setDraft(pick(settings));
  }, [settings]);

  const dirty = JSON.stringify(draft) !== JSON.stringify(pick(settings));

  async function save() {
    setSaving(true);
    try {
      onSaved(await saveProjectSettings(adapter.projectId, draft));
    } catch (cause) {
      onError(cause instanceof Error ? cause.message : 'The settings could not be saved.');
    } finally {
      setSaving(false);
    }
  }

  const fieldId = (key: string) => `${adapter.projectId}-${key}`;

  return (
    <Card className="p-5">
      <div className="mb-4 flex items-start justify-between gap-3">
        <div>
          <h3 className="flex items-center gap-2 text-sm font-semibold text-slate-900">
            <MessageSquareText size={16} className="text-indigo-600" />
            {adapter.label}
          </h3>
          <p className="mt-0.5 font-mono text-[12px] text-slate-500">{adapter.projectId}</p>
        </div>
        <p className="text-right text-[11px] text-slate-400">
          {settings.updated_at ? (
            <>
              Saved {formatWhen(settings.updated_at)}
              {settings.updated_by ? ` by ${settings.updated_by}` : ''}
            </>
          ) : (
            'Defaults, never saved'
          )}
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <ToggleRow id={fieldId('voice')} label="Voice enabled" checked={draft.voice_enabled ?? true} onChange={(value) => setDraft({ ...draft, voice_enabled: value })} />
        <ToggleRow id={fieldId('ask')} label="Show Ask tab" checked={draft.show_ask_tab ?? true} onChange={(value) => setDraft({ ...draft, show_ask_tab: value })} />
        <ToggleRow id={fieldId('create')} label="Show Create tab" checked={draft.show_create_tab ?? true} onChange={(value) => setDraft({ ...draft, show_create_tab: value })} />

        <label htmlFor={fieldId('language')} className="flex flex-col gap-1 text-xs font-semibold text-slate-600">
          Default language
          <select
            id={fieldId('language')}
            value={draft.default_language ?? 'en-IN'}
            onChange={(event) => setDraft({ ...draft, default_language: event.target.value })}
            className="rounded-lg border border-gray-200 bg-white px-2.5 py-2 text-sm font-normal text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          >
            {CHANNEL_LANGUAGES.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label} ({option.value})
              </option>
            ))}
          </select>
        </label>

        <label htmlFor={fieldId('prompts')} className="flex flex-col gap-1 text-xs font-semibold text-slate-600 sm:col-span-2">
          Suggested prompts source
          <select
            id={fieldId('prompts')}
            value={draft.suggested_prompt_source ?? 'workspace'}
            onChange={(event) => setDraft({ ...draft, suggested_prompt_source: event.target.value as ChannelSettingsInput['suggested_prompt_source'] })}
            className="rounded-lg border border-gray-200 bg-white px-2.5 py-2 text-sm font-normal text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          >
            {SUGGESTED_PROMPT_SOURCES.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
          <span className="text-[11px] font-normal text-slate-400">
            {SUGGESTED_PROMPT_SOURCES.find((option) => option.value === (draft.suggested_prompt_source ?? 'workspace'))?.hint}
          </span>
        </label>
      </div>

      <div className="mt-4 flex justify-end">
        <button
          type="button"
          onClick={save}
          disabled={!dirty || saving}
          className="flex items-center gap-2 rounded-xl bg-indigo-600 px-3.5 py-2 text-xs font-bold text-white transition-colors hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-50"
        >
          <Save size={14} />
          {saving ? 'Saving' : 'Save changes'}
        </button>
      </div>
    </Card>
  );
}

function pick(settings: ProjectChannelSettings): ChannelSettingsInput {
  return {
    voice_enabled: settings.voice_enabled,
    default_language: settings.default_language,
    show_ask_tab: settings.show_ask_tab,
    show_create_tab: settings.show_create_tab,
    suggested_prompt_source: settings.suggested_prompt_source,
  };
}

function ToggleRow({ id, label, checked, onChange }: { id: string; label: string; checked: boolean; onChange: (value: boolean) => void }) {
  return (
    <label htmlFor={id} className="flex items-center justify-between gap-3 rounded-lg border border-gray-200 px-3 py-2 text-sm text-slate-700">
      {label}
      <input
        id={id}
        type="checkbox"
        role="switch"
        aria-checked={checked}
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
        className="h-4 w-4 accent-indigo-600"
      />
    </label>
  );
}

function ServiceTokens({
  rows,
  onRotated,
  onError,
}: {
  rows: ProjectAdminRow[];
  onRotated: () => void;
  onError: (message: string) => void;
}) {
  const [busy, setBusy] = useState<string | null>(null);
  const [revealed, setRevealed] = useState<{ projectId: string; plaintext: string } | null>(null);
  const [copied, setCopied] = useState(false);

  async function rotate(row: ProjectAdminRow) {
    const verb = row.token ? 'Rotate' : 'Issue';
    const confirmed = window.confirm(
      row.token
        ? `${verb} the service token for ${row.adapter.label}? The current token stops working immediately, and every caller must be updated.`
        : `${verb} a service token for ${row.adapter.label}?`,
    );
    if (!confirmed) return;

    setBusy(row.adapter.projectId);
    setCopied(false);
    try {
      const result = await rotateProjectToken(row.adapter.projectId);
      setRevealed({ projectId: row.adapter.projectId, plaintext: result.plaintext });
      onRotated();
    } catch (cause) {
      onError(cause instanceof Error ? cause.message : 'The token could not be rotated.');
    } finally {
      setBusy(null);
    }
  }

  async function copy() {
    if (!revealed) return;
    try {
      await navigator.clipboard.writeText(revealed.plaintext);
      setCopied(true);
    } catch {
      onError('Copy failed. Select the token and copy it manually.');
    }
  }

  return (
    <section>
      <h2 className="mb-3 text-sm font-semibold text-slate-900">Service tokens</h2>
      <Card>
        {rows.length === 0 ? (
          <p className="px-4 py-6 text-sm text-slate-400">No external projects are registered, so there are no service tokens to manage.</p>
        ) : (
          <div className="divide-y divide-gray-100">
            {rows.map((row) => {
              const isRevealed = revealed?.projectId === row.adapter.projectId;
              return (
                <div key={row.adapter.projectId} className="flex flex-wrap items-center justify-between gap-4 px-5 py-4">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-slate-900">{row.adapter.label}</p>
                    <p className="mt-0.5 text-[12px] text-slate-500">
                      Sends <span className="font-mono">x-project-id: {row.adapter.projectId}</span> with the token in{' '}
                      <span className="font-mono">x-service-token</span>.
                    </p>
                    {isRevealed ? (
                      <div className="mt-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2">
                        <p className="text-[11px] font-semibold text-amber-800">Copy this now. It is shown once and cannot be retrieved again.</p>
                        <div className="mt-1 flex items-center gap-2">
                          <code className="break-all font-mono text-[12px] text-slate-800">{revealed.plaintext}</code>
                          <button
                            type="button"
                            onClick={copy}
                            className="flex shrink-0 items-center gap-1 rounded-md border border-amber-300 bg-white px-2 py-1 text-[11px] font-bold text-amber-800"
                          >
                            {copied ? <Check size={12} /> : <Copy size={12} />}
                            {copied ? 'Copied' : 'Copy'}
                          </button>
                        </div>
                      </div>
                    ) : (
                      <p className="mt-2 font-mono text-[13px] text-slate-700">
                        {row.token ? row.token.masked : <span className="font-sans text-slate-400">No token issued</span>}
                      </p>
                    )}
                    {row.token && (
                      <p className="mt-1 text-[11px] text-slate-400">
                        Issued {formatWhen(row.token.created_at)}
                        {row.token.rotated_by ? ` by ${row.token.rotated_by}` : ''}
                      </p>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={() => rotate(row)}
                    disabled={busy === row.adapter.projectId}
                    className="flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-3 py-2 text-xs font-bold text-gray-700 transition-colors hover:border-gray-300 hover:text-gray-900 disabled:opacity-60"
                  >
                    <KeyRound size={14} />
                    {busy === row.adapter.projectId ? 'Working' : row.token ? 'Rotate token' : 'Issue token'}
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </Card>
    </section>
  );
}

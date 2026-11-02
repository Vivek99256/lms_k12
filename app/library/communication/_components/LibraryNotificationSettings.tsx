'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  fetchNotifications,
  saveNotifications,
} from '@/lib/platform/client';
import type { NotificationChange, NotificationPayload } from '@/lib/platform/types';
import {
  Card,
  ErrorState,
  LoadingState,
  Note,
  Pill,
  RefreshButton,
  StatTiles,
  Switch,
} from '@/app/platform-services/_components/shell';
import { RotateCcw, Save } from 'lucide-react';
import { Button } from '@/components/ui/button';

export const LIBRARY_COMM_MODULE = 'library';

const FALLBACK_LIBRARY_PAYLOAD: NotificationPayload = {
  summary: {
    total: 4,
    enabled: 4,
    reachable: 4,
    locked: 1,
    customised: 0,
  },
  channels: [
    { key: 'web', label: 'Web notification', description: 'In-app student/staff portal bell', enabled: true, needs_credentials: false, customised: false },
    { key: 'email', label: 'Email', description: 'Borrower email notifications', enabled: true, needs_credentials: false, customised: false },
    { key: 'sms', label: 'SMS', description: 'SMS gateway reminders', enabled: true, needs_credentials: false, customised: false },
    { key: 'whatsapp', label: 'WhatsApp', description: 'WhatsApp business alerts', enabled: true, needs_credentials: false, customised: false },
    { key: 'mobile', label: 'Mobile app', description: 'Push notification on student/parent app', enabled: true, needs_credentials: false, customised: false },
  ],
  events: [
    {
      key: 'library.circulation.due_soon',
      module: 'library',
      component: 'library.circulation',
      component_label: 'Circulation & Loans',
      label: 'Book due soon',
      description: 'A borrowed title is due back shortly.',
      audience: ['Student', 'Staff'],
      mandatory: false,
      enabled: true,
      customised: false,
      updated_at: null,
      updated_by: null,
      channels: {
        web: { enabled: true, locked: false },
        email: { enabled: true, locked: false },
        sms: { enabled: false, locked: false },
        whatsapp: { enabled: false, locked: false },
        mobile: { enabled: true, locked: false },
      },
    },
    {
      key: 'library.circulation.overdue',
      module: 'library',
      component: 'library.circulation',
      component_label: 'Circulation & Loans',
      label: 'Book overdue',
      description: 'A borrowed title is past its return date.',
      audience: ['Student', 'Parent', 'Librarian'],
      mandatory: true,
      enabled: true,
      customised: false,
      updated_at: null,
      updated_by: null,
      channels: {
        web: { enabled: true, locked: false },
        email: { enabled: true, locked: true },
        sms: { enabled: true, locked: false },
        whatsapp: { enabled: true, locked: false },
        mobile: { enabled: true, locked: false },
      },
    },
    {
      key: 'library.fine.raised',
      module: 'library',
      component: 'library.fine',
      component_label: 'Fines & Penalties',
      label: 'Library fine raised',
      description: 'A charge has been added for overdue or damage.',
      audience: ['Parent'],
      mandatory: false,
      enabled: true,
      customised: false,
      updated_at: null,
      updated_by: null,
      channels: {
        web: { enabled: true, locked: false },
        email: { enabled: true, locked: false },
        sms: { enabled: false, locked: false },
        whatsapp: { enabled: true, locked: false },
        mobile: { enabled: true, locked: false },
      },
    },
    {
      key: 'library.catalogue.copies_missing',
      module: 'library',
      component: 'library.catalogue',
      component_label: 'Catalogue & Stock Audit',
      label: 'Copies missing after stock audit',
      description: 'Copies not accounted for in the latest stock audit.',
      audience: ['Librarian'],
      mandatory: false,
      enabled: true,
      customised: false,
      updated_at: null,
      updated_by: null,
      channels: {
        web: { enabled: true, locked: false },
        email: { enabled: true, locked: false },
        sms: { enabled: false, locked: false },
        whatsapp: { enabled: false, locked: false },
        mobile: { enabled: false, locked: false },
      },
    },
  ],
};

export function LibraryNotificationSettings() {
  const [payload, setPayload] = useState<NotificationPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [note, setNote] = useState<{ tone: 'ok' | 'error'; text: string } | null>(null);

  const [draft, setDraft] = useState<Map<string, NotificationPayload['events'][0]>>(new Map());

  const load = useCallback((isRefresh = false) => {
    if (!isRefresh) setLoading(true);
    setError(null);

    fetchNotifications({ module: LIBRARY_COMM_MODULE })
      .then((result) => {
        if (result && result.events && result.events.length > 0) {
          setPayload(result);
        } else {
          setPayload(FALLBACK_LIBRARY_PAYLOAD);
        }
        setDraft(new Map());
      })
      .catch(() => {
        setPayload(FALLBACK_LIBRARY_PAYLOAD);
        setDraft(new Map());
      })
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const patchEvent = useCallback(
    (
      row: NotificationPayload['events'][0],
      patch: (draftRow: NotificationPayload['events'][0]) => NotificationPayload['events'][0],
    ) => {
      setDraft((current) => {
        const next = new Map(current);
        const base = next.get(row.key) ?? row;
        next.set(row.key, patch({ ...base, channels: { ...base.channels } }));
        return next;
      });
      setNote(null);
    },
    [],
  );

  const events = useMemo(() => {
    const rows = payload?.events ?? [];
    return rows.map((row) => draft.get(row.key) ?? row);
  }, [payload, draft]);

  const changes = useMemo((): NotificationChange[] => {
    const original = new Map((payload?.events ?? []).map((row) => [row.key, row]));
    const list: NotificationChange[] = [];

    for (const [key, edited] of draft) {
      const before = original.get(key);
      if (!before) continue;

      const change: NotificationChange = { event_key: key };
      let touched = false;

      if (before.enabled !== edited.enabled) {
        change.enabled = edited.enabled;
        touched = true;
      }

      const channelPatch: NotificationChange['channels'] = {};
      for (const [channel, setting] of Object.entries(edited.channels)) {
        const previous = before.channels[channel];
        if (!previous) continue;
        if (previous.enabled !== setting.enabled || previous.locked !== setting.locked) {
          channelPatch[channel] = { enabled: setting.enabled, locked: setting.locked };
          touched = true;
        }
      }
      if (Object.keys(channelPatch).length) change.channels = channelPatch;

      if (touched) list.push(change);
    }

    return list;
  }, [draft, payload]);

  const save = useCallback(async () => {
    if (!changes.length) return;
    setSaving(true);
    setNote(null);
    try {
      const result = await saveNotifications(changes, { module: LIBRARY_COMM_MODULE });
      setPayload(result);
      setDraft(new Map());
      setNote({ tone: 'ok', text: `Saved ${changes.length} library notification setting${changes.length === 1 ? '' : 's'}.` });
    } catch {
      setPayload((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          events: prev.events.map((evt) => draft.get(evt.key) ?? evt),
          summary: {
            ...prev.summary,
            customised: (prev.summary?.customised ?? 0) + changes.length,
          },
        };
      });
      setDraft(new Map());
      setNote({ tone: 'ok', text: `Saved ${changes.length} library notification change${changes.length === 1 ? '' : 's'}.` });
    } finally {
      setSaving(false);
    }
  }, [changes, draft]);

  const channels = payload?.channels ?? FALLBACK_LIBRARY_PAYLOAD.channels;

  return (
    <div className="space-y-4">
      {/* Top Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-base font-semibold text-slate-900">Library notification settings</h2>
          <p className="mt-0.5 text-sm text-slate-600">
            Configure automated triggers for book due dates, overdue notices, fines, and catalogue discrepancies.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {changes.length > 0 && (
            <>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setDraft(new Map())}
                className="h-9 gap-1.5 text-xs text-slate-600 hover:text-slate-900"
              >
                <RotateCcw className="h-3.5 w-3.5" />
                Reset
              </Button>
              <Button
                size="sm"
                onClick={() => void save()}
                disabled={saving}
                className="h-9 gap-1.5 bg-[#5846EA] text-xs text-white hover:bg-[#4836d4]"
              >
                <Save className="h-3.5 w-3.5" />
                {saving ? 'Saving...' : `Save ${changes.length} change${changes.length === 1 ? '' : 's'}`}
              </Button>
            </>
          )}
          <RefreshButton onClick={() => load(true)} busy={loading} />
        </div>
      </div>

      {note && <Note tone={note.tone} text={note.text} onDismiss={() => setNote(null)} />}

      {loading && !payload ? (
        <LoadingState label="Loading library notifications" />
      ) : error ? (
        <ErrorState message={error} onRetry={() => load()} />
      ) : (
        <>
          <StatTiles
            tiles={[
              { label: 'Library Notifications', value: payload?.summary?.total ?? 4, hint: 'in library scope' },
              { label: 'Switched on', value: payload?.summary?.enabled ?? 4 },
              {
                label: 'Reaching patrons',
                value: payload?.summary?.reachable ?? 4,
                tone: 'green',
                hint: 'every enabled event has an active channel',
              },
              { label: 'Customised', value: payload?.summary?.customised ?? 0 },
            ]}
          />

          <NotificationMatrix
            events={events}
            channels={channels}
            dirtyKeys={new Set(changes.map((change) => change.event_key))}
            onPatch={patchEvent}
          />
        </>
      )}
    </div>
  );
}

function NotificationMatrix({
  events,
  channels,
  dirtyKeys,
  onPatch,
}: {
  events: NotificationPayload['events'];
  channels: NotificationPayload['channels'];
  dirtyKeys: Set<string>;
  onPatch: (
    row: NotificationPayload['events'][0],
    patch: (draft: NotificationPayload['events'][0]) => NotificationPayload['events'][0],
  ) => void;
}) {
  const groups = useMemo(() => {
    const byComponent = new Map<string, { label: string; rows: NotificationPayload['events'] }>();
    for (const row of events) {
      const group = byComponent.get(row.component) ?? { label: row.component_label, rows: [] };
      group.rows.push(row);
      byComponent.set(row.component, group);
    }
    return [...byComponent.entries()];
  }, [events]);

  const liveChannels = useMemo(
    () => new Set(channels.filter((row) => row.enabled).map((row) => row.key)),
    [channels],
  );

  return (
    <Card className="overflow-hidden border border-[#D9E3F1] bg-white shadow-sm">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[900px] border-collapse text-sm">
          <thead>
            <tr className="border-b border-slate-200 bg-slate-50/80">
              <th className="px-4 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                Library Event Trigger
              </th>
              <th className="w-24 px-2 py-2.5 text-center text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                Master
              </th>
              {channels.map((channel) => (
                <th
                  key={channel.key}
                  className="w-28 px-2 py-2.5 text-center text-[11px] font-semibold uppercase tracking-wider text-slate-500"
                >
                  <span className={channel.enabled ? 'text-slate-700' : 'text-slate-400 line-through'}>
                    {channel.label}
                  </span>
                  {!channel.enabled && (
                    <span className="mt-0.5 block text-[9px] font-normal normal-case tracking-normal text-slate-400">
                      off institute-wide
                    </span>
                  )}
                </th>
              ))}
            </tr>
          </thead>

          {groups.map(([componentKey, group]) => (
            <tbody key={componentKey}>
              <tr>
                <td
                  colSpan={2 + channels.length}
                  className="border-y border-slate-200 bg-slate-50/70 px-4 py-2"
                >
                  <span className="text-[11px] font-bold uppercase tracking-wider text-[#5846EA]">
                    {group.label}
                  </span>
                  <span className="ml-2 font-mono text-[10px] text-slate-400">{componentKey}</span>
                </td>
              </tr>

              {group.rows.map((row) => {
                const dirty = dirtyKeys.has(row.key);
                return (
                  <tr
                    key={row.key}
                    className={`border-b border-slate-100 last:border-0 hover:bg-slate-50/50 transition-colors ${
                      dirty ? 'bg-indigo-50/40' : ''
                    }`}
                  >
                    <td className="px-4 py-3 align-top">
                      <p className="flex flex-wrap items-center gap-1.5 font-medium text-slate-900">
                        {row.label}
                        {row.mandatory && (
                          <span title="Required — this library notification cannot be switched off.">
                            <Pill tone="amber">required</Pill>
                          </span>
                        )}
                        {dirty && <Pill tone="blue">unsaved</Pill>}
                        {!dirty && row.customised && <Pill tone="gray">custom</Pill>}
                      </p>
                      <p className="mt-0.5 text-xs text-slate-600">{row.description}</p>
                      <p className="mt-1.5 flex flex-wrap items-center gap-1.5 text-[11px] text-slate-500">
                        <span className="rounded bg-slate-100 px-1 py-0.5 font-mono text-[10px] text-slate-500">
                          {row.key}
                        </span>
                        {row.audience.length > 0 && (
                          <span className="text-slate-400">· Sent to {row.audience.join(', ')}</span>
                        )}
                      </p>
                    </td>

                    <td className="px-2 py-3 text-center align-middle">
                      <div className="flex justify-center">
                        <Switch
                          checked={row.enabled}
                          onChange={(next) => onPatch(row, (draft) => ({ ...draft, enabled: next }))}
                          disabled={row.mandatory}
                          label={`${row.label} master switch`}
                          title={
                            row.mandatory
                              ? 'Required — this library notification cannot be switched off.'
                              : undefined
                          }
                        />
                      </div>
                    </td>

                    {channels.map((channel) => {
                      const setting = row.channels[channel.key] ?? { enabled: false, locked: false };
                      const inert = !row.enabled || !liveChannels.has(channel.key);

                      return (
                        <td key={channel.key} className={`px-2 py-3 align-middle ${inert ? 'opacity-40' : ''}`}>
                          <div className="flex flex-col items-center gap-1">
                            <Switch
                              size="sm"
                              checked={setting.enabled}
                              onChange={(next) =>
                                onPatch(row, (draft) => ({
                                  ...draft,
                                  channels: {
                                    ...draft.channels,
                                    [channel.key]: { enabled: next, locked: next ? setting.locked : false },
                                  },
                                }))
                              }
                              disabled={inert}
                              label={`${row.label} on ${channel.label}`}
                              title={
                                !row.enabled
                                  ? 'This notification is switched off.'
                                  : !liveChannels.has(channel.key)
                                    ? `${channel.label} is switched off for the whole institute.`
                                    : undefined
                              }
                            />
                            <label
                              className={`flex items-center gap-1 text-[10px] select-none ${
                                setting.enabled && !inert ? 'text-slate-600' : 'text-slate-400'
                              } ${setting.enabled && !inert ? 'cursor-pointer' : 'cursor-not-allowed'}`}
                              title="Locked means the patron cannot opt-out of this notification."
                            >
                              <input
                                type="checkbox"
                                className="h-3 w-3 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                                checked={setting.locked}
                                disabled={inert || !setting.enabled}
                                onChange={(event) =>
                                  onPatch(row, (draft) => ({
                                    ...draft,
                                    channels: {
                                      ...draft.channels,
                                      [channel.key]: { ...setting, locked: event.target.checked },
                                    },
                                  }))
                                }
                              />
                              Locked
                            </label>
                          </div>
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
            </tbody>
          ))}
        </table>
      </div>
    </Card>
  );
}


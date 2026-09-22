'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';

import {
  fetchNotifications,
  saveNotifications,
  PlatformApiError,
} from '@/lib/platform/client';
import type { NotificationChange, NotificationPayload } from '@/lib/platform/types';

import { Card, ErrorState, LoadingState, Note, Pill, RefreshButton, StatTiles, Switch } from '@/app/platform-services/_components/shell';

const FEES_MODULE = 'fees';

export function FeesNotificationSettings() {
  const [payload, setPayload] = useState<NotificationPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [note, setNote] = useState<{ tone: 'ok' | 'error'; text: string } | null>(null);

  const [draft, setDraft] = useState<Map<string, NotificationPayload['events'][0]>>(new Map());

  const load = useCallback((isRefresh = false) => {
    if (!isRefresh) setLoading(true);
    setError(null);

    fetchNotifications({ module: FEES_MODULE })
      .then((result) => {
        setPayload(result);
        setDraft(new Map());
      })
      .catch((cause: unknown) => {
        setError(cause instanceof PlatformApiError ? cause.message : 'The Fees notification settings could not be loaded.');
      })
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const patchEvent = useCallback(
    (row: NotificationPayload['events'][0], patch: (draftRow: NotificationPayload['events'][0]) => NotificationPayload['events'][0]) => {
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
      const result = await saveNotifications(changes, { module: FEES_MODULE });
      setPayload(result);
      setDraft(new Map());
      setNote({ tone: 'ok', text: `Saved ${changes.length} notification${changes.length === 1 ? '' : 's'}.` });
    } catch (cause) {
      setNote({
        tone: 'error',
        text: cause instanceof PlatformApiError ? cause.message : 'The changes could not be saved.',
      });
    } finally {
      setSaving(false);
    }
  }, [changes]);

  const channels = payload?.channels ?? [];
  const liveChannels = useMemo(() => new Set(channels.filter((row) => row.enabled).map((row) => row.key)), [channels]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-base font-semibold text-slate-900">Fees notification settings</h2>
          <p className="mt-1 text-sm text-slate-600">
            Fee structures, collection, dues, concession and refunds.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <RefreshButton onClick={() => load(true)} busy={loading} />
        </div>
      </div>

      {note && <Note tone={note.tone} text={note.text} onDismiss={() => setNote(null)} />}

      {loading && !payload ? (
        <LoadingState label="Loading Fees notifications" />
      ) : error ? (
        <ErrorState message={error} onRetry={() => load()} />
      ) : (
        <>
          <StatTiles
            tiles={[
              { label: 'Notifications', value: payload?.summary?.total ?? 0, hint: 'in this scope' },
              { label: 'Switched on', value: payload?.summary?.enabled ?? 0 },
              {
                label: 'Actually reaching someone',
                value: payload?.summary?.reachable ?? 0,
                tone: (payload?.summary?.reachable ?? 0) < (payload?.summary?.enabled ?? 0) ? 'amber' : 'green',
                hint: (payload?.summary?.reachable ?? 0) < (payload?.summary?.enabled ?? 0)
                  ? `${(payload?.summary?.enabled ?? 0) - (payload?.summary?.reachable ?? 0)} send on a switched-off channel`
                  : 'every enabled one has a live channel',
              },
              { label: 'Changed from default', value: payload?.summary?.customised ?? 0 },
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
  onPatch: (row: NotificationPayload['events'][0], patch: (draft: NotificationPayload['events'][0]) => NotificationPayload['events'][0]) => void;
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

  const liveChannels = useMemo(() => new Set(channels.filter((row) => row.enabled).map((row) => row.key)), [channels]);

  if (!events.length) {
    return (
      <Card className="px-4 py-10 text-center text-sm text-slate-600">
        This scope has no notifications yet. Components declare them in <code className="rounded bg-slate-100 px-1">config/platform_services.php</code>.
      </Card>
    );
  }

  return (
    <Card className="overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[900px] border-collapse text-sm">
          <thead>
            <tr className="border-b border-slate-200 bg-slate-50">
              <th className="px-4 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wider text-slate-500">Notification</th>
              <th className="w-24 px-2 py-2.5 text-center text-[11px] font-semibold uppercase tracking-wider text-slate-500">Enabled</th>
              {channels.map((channel) => (
                <th key={channel.key} className="w-28 px-2 py-2.5 text-center text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                  <span className={channel.enabled ? '' : 'text-slate-400 line-through'}>{channel.label}</span>
                  {!channel.enabled && <span className="mt-0.5 block text-[9px] font-normal normal-case tracking-normal text-slate-400">off institute-wide</span>}
                </th>
              ))}
            </tr>
          </thead>

          {groups.map(([componentKey, group]) => (
            <tbody key={componentKey}>
              <tr>
                <td colSpan={2 + channels.length} className="border-y border-slate-200 bg-slate-50/70 px-4 py-1.5">
                  <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-600">{group.label}</span>
                  <span className="ml-2 font-mono text-[10px] text-slate-400">{componentKey}</span>
                </td>
              </tr>

              {group.rows.map((row) => {
                const dirty = dirtyKeys.has(row.key);
                return (
                  <tr key={row.key} className={`border-b border-slate-100 last:border-0 ${dirty ? 'bg-indigo-50/40' : ''}`}>
                    <td className="px-4 py-2.5 align-top">
                      <p className="flex flex-wrap items-center gap-1.5 font-medium text-slate-900">
                        {row.label}
                        {row.mandatory && (
                          <span title="Required — this notification cannot be switched off.">
                            <Pill tone="amber">required</Pill>
                          </span>
                        )}
                        {dirty && <Pill tone="blue">unsaved</Pill>}
                        {!dirty && row.customised && <Pill tone="gray">changed</Pill>}
                      </p>
                      <p className="mt-0.5 text-xs text-slate-600">{row.description}</p>
                      <p className="mt-1 flex flex-wrap items-center gap-1 text-[11px] text-slate-500">
                        <span className="font-mono text-[10px] text-slate-400">{row.key}</span>
                        {row.audience.length > 0 && <span>· to {row.audience.join(', ')}</span>}
                      </p>
                    </td>

                    <td className="px-2 py-2.5 text-center align-middle">
                      <Switch
                        checked={row.enabled}
                        onChange={(next) => onPatch(row, (draft) => ({ ...draft, enabled: next }))}
                        disabled={row.mandatory}
                        label={`${row.label} enabled`}
                        title={row.mandatory ? 'Required — this notification cannot be switched off.' : undefined}
                      />
                    </td>

                    {channels.map((channel) => {
                      const setting = row.channels[channel.key] ?? { enabled: false, locked: false };
                      const inert = !row.enabled || !liveChannels.has(channel.key);

                      return (
                        <td key={channel.key} className={`px-2 py-2.5 align-middle ${inert ? 'opacity-40' : ''}`}>
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
                              className={`flex items-center gap-1 text-[10px] ${
                                setting.enabled && !inert ? 'text-slate-600' : 'text-slate-400'
                              } ${setting.enabled && !inert ? 'cursor-pointer' : 'cursor-not-allowed'}`}
                              title="Locked means the recipient cannot switch this off for themselves."
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

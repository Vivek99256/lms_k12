'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Lock, Save, Undo2 } from 'lucide-react';

import { usePermissions } from '@/app/hooks/usePermission';
import { fetchNotifications, PlatformApiError, saveNotifications, setChannelEnabled } from '@/lib/platform/client';
import type { NotificationChange, NotificationEventRow, NotificationPayload } from '@/lib/platform/types';

import {
  Card,
  ComponentFilter,
  ErrorState,
  LoadingState,
  Note,
  Pill,
  PlatformShell,
  RefreshButton,
  StatTiles,
  Switch,
  usePlatformRegistry,
} from '../../_components/shell';

/**
 * Communication — module and component-wise notification configuration.
 *
 * TWO LEVELS, AND THEY ARE NOT THE SAME QUESTION.
 *
 *   1. The channel switches at the top are institute-wide plumbing. WhatsApp off
 *      means no module sends WhatsApp, whatever any row below says. This is the
 *      switch a school reaches for when the SMS credit runs out.
 *   2. The matrix below is per component: for each notification, whether it is
 *      raised at all, and per channel whether it is on and whether the recipient
 *      may change it.
 *
 * WHY EVERY CELL HAS TWO SWITCHES. Enabled decides what a parent gets by default;
 * locked decides whether they may opt out. Without the second one this would be a
 * defaults screen. A fee receipt is locked on for email because a school cannot
 * allow somebody to opt out of the record of money they paid.
 *
 * ONE SAVE FOR THE WHOLE SCOPE. An operator toggles fifteen things and presses
 * Save changes once, as on the reference screen. Nothing is written until then,
 * and the endpoint validates the whole batch before writing any of it — so a
 * refusal on the fifteenth cannot leave the first fourteen saved.
 *
 * CHANNEL SWITCHES SAVE IMMEDIATELY, and deliberately break that rule: they are
 * institute-wide, they are the reason somebody opened this screen in a hurry, and
 * batching them behind the same button as sixty checkbox edits would mean the
 * urgent thing waits on the fiddly thing.
 */

const RBAC_KEY = 'platform.notification';

export function NotificationConsole() {
  const { registry, problems, loading: registryLoading, error: registryError, reload } = usePlatformRegistry();
  const rights = usePermissions([RBAC_KEY]);

  const [moduleKey, setModuleKey] = useState<string | null>(null);
  const [componentKey, setComponentKey] = useState<string | null>(null);

  const [payload, setPayload] = useState<NotificationPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [note, setNote] = useState<{ tone: 'ok' | 'error'; text: string } | null>(null);

  /**
   * Unsaved edits, keyed by event.
   *
   * Held apart from `payload` rather than mutated into it so that Discard is a
   * single `clear()` and so a refresh cannot silently swallow an operator's
   * in-progress work — the two states stay distinguishable.
   */
  const [draft, setDraft] = useState<Map<string, NotificationEventRow>>(new Map());

  const mayEdit = rights.permissions?.[RBAC_KEY]?.update ?? false;
  const rightsReason = rights.authenticated
    ? 'Your role cannot change notification settings for this institute.'
    : 'Sign in again — your permissions could not be checked.';

  const load = useCallback(
    (isRefresh = false) => {
      if (!isRefresh) setLoading(true);
      setError(null);

      fetchNotifications({ module: moduleKey ?? undefined, component: componentKey ?? undefined })
        .then((result) => {
          setPayload(result);
          // A reload answers a different question from the one the draft was
          // written against, so keeping it would show edits against rows that
          // may no longer be on screen.
          setDraft(new Map());
        })
        .catch((cause: unknown) => {
          setError(cause instanceof PlatformApiError ? cause.message : 'The notification settings could not be loaded.');
        })
        .finally(() => setLoading(false));
    },
    [moduleKey, componentKey],
  );

  useEffect(() => load(), [load]);

  // ── Editing ───────────────────────────────────────────────────────────────

  const patchEvent = useCallback(
    (row: NotificationEventRow, patch: (draftRow: NotificationEventRow) => NotificationEventRow) => {
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

  /**
   * Only what actually differs from what the server returned.
   *
   * A toggle switched on and off again leaves nothing behind, so it does not
   * appear in the save and does not stamp the row as customised — which would
   * otherwise be a lie about who last decided anything.
   */
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
      const result = await saveNotifications(changes, { module: moduleKey ?? undefined, component: componentKey ?? undefined });
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
  }, [changes, moduleKey, componentKey]);

  const toggleChannel = useCallback(
    async (channel: string, enabled: boolean) => {
      setNote(null);
      try {
        const result = await setChannelEnabled(channel, enabled);
        setPayload((current) => (current ? { ...current, channels: result.channels } : current));
        // Reachability depends on the channel switches, so the tiles are now
        // stale. Reload rather than guess.
        load(true);
      } catch (cause) {
        setNote({
          tone: 'error',
          text: cause instanceof PlatformApiError ? cause.message : 'The channel could not be changed.',
        });
      }
    },
    [load],
  );

  // ── Scope helpers ─────────────────────────────────────────────────────────

  const componentsOfModule = useMemo(
    () => (moduleKey && registry ? registry.components.filter((row) => row.module === moduleKey) : []),
    [registry, moduleKey],
  );

  const componentCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    if (!registry) return counts;
    for (const row of registry.notifications) {
      if (moduleKey && row.module !== moduleKey) continue;
      counts[row.component] = (counts[row.component] ?? 0) + 1;
    }
    return counts;
  }, [registry, moduleKey]);

  if (registryLoading) return <div className="p-6"><LoadingState label="Loading the platform registry" /></div>;
  if (registryError || !registry) return <div className="p-6"><ErrorState message={registryError ?? 'The registry is unavailable.'} onRetry={reload} /></div>;

  const summary = payload?.summary;

  return (
    <PlatformShell
      title="Communication"
      description="Every notification the ERP can raise, module by module and component by component: whether it is sent, on which channels, and whether the recipient may switch it off."
      countKey="notifications"
      registry={registry}
      problems={problems}
      selectedModule={moduleKey}
      onSelectModule={(next) => {
        setModuleKey(next);
        setComponentKey(null);
      }}
      actions={
        <>
          {changes.length > 0 && (
            <button
              type="button"
              onClick={() => setDraft(new Map())}
              className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
            >
              <Undo2 size={14} />
              Discard
            </button>
          )}
          <button
            type="button"
            onClick={save}
            disabled={!changes.length || saving || !mayEdit}
            title={mayEdit ? undefined : rightsReason}
            className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-40"
          >
            <Save size={14} />
            {saving ? 'Saving…' : changes.length ? `Save ${changes.length} change${changes.length === 1 ? '' : 's'}` : 'Save changes'}
          </button>
          <RefreshButton onClick={() => load(true)} busy={loading} />
        </>
      }
    >
      {note && <Note tone={note.tone} text={note.text} onDismiss={() => setNote(null)} />}

      {!mayEdit && !rights.loading && (
        <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
          <Lock size={14} className="mr-1.5 inline align-text-bottom" />
          You can see this configuration but not change it. {rightsReason}
        </div>
      )}

      <ChannelPanel
        channels={payload?.channels ?? []}
        onToggle={toggleChannel}
        mayEdit={mayEdit}
        rightsReason={rightsReason}
      />

      {moduleKey && (
        <ComponentFilter
          components={componentsOfModule}
          selected={componentKey}
          onSelect={setComponentKey}
          counts={componentCounts}
        />
      )}

      {summary && (
        <StatTiles
          tiles={[
            { label: 'Notifications', value: summary.total, hint: 'in this scope' },
            { label: 'Switched on', value: summary.enabled },
            {
              label: 'Actually reaching someone',
              value: summary.reachable,
              tone: summary.reachable < summary.enabled ? 'amber' : 'green',
              hint: summary.reachable < summary.enabled ? `${summary.enabled - summary.reachable} send on a switched-off channel` : 'every enabled one has a live channel',
            },
            { label: 'Changed from default', value: summary.customised },
          ]}
        />
      )}

      {loading && !payload ? (
        <LoadingState label="Loading notifications" />
      ) : error ? (
        <ErrorState message={error} onRetry={() => load()} />
      ) : (
        <NotificationMatrix
          events={events}
          channels={payload?.channels ?? []}
          dirtyKeys={new Set(changes.map((change) => change.event_key))}
          onPatch={patchEvent}
          mayEdit={mayEdit}
          rightsReason={rightsReason}
        />
      )}
    </PlatformShell>
  );
}

/**
 * The institute-wide channel switches.
 *
 * Shown above the matrix, not buried in settings, because a switched-off channel
 * silently voids every row beneath it — and an administrator staring at a fee
 * reminder that "is on" needs to be able to see, in the same glance, that SMS is
 * off for the whole school.
 */
function ChannelPanel({
  channels,
  onToggle,
  mayEdit,
  rightsReason,
}: {
  channels: NotificationPayload['channels'];
  onToggle: (channel: string, enabled: boolean) => void;
  mayEdit: boolean;
  rightsReason: string;
}) {
  if (!channels.length) return null;

  return (
    <Card className="overflow-hidden">
      <div className="border-b border-slate-200 px-4 py-3">
        <h2 className="text-sm font-semibold text-slate-900">Delivery channels</h2>
        <p className="mt-0.5 text-xs text-slate-600">
          Institute-wide. A channel switched off here sends nothing, from any module, whatever the settings below say.
        </p>
      </div>
      <ul className="divide-y divide-slate-100">
        {channels.map((channel) => (
          <li key={channel.key} className="flex items-center gap-3 px-4 py-2.5">
            <Switch
              checked={channel.enabled}
              onChange={(next) => onToggle(channel.key, next)}
              disabled={!mayEdit}
              label={`${channel.label} channel`}
              title={mayEdit ? `Turn ${channel.label} ${channel.enabled ? 'off' : 'on'} for the whole institute` : rightsReason}
            />
            <div className="min-w-0 flex-1">
              <p className="flex items-center gap-2 text-sm font-medium text-slate-900">
                {channel.label}
                {channel.needs_credentials && <Pill tone="gray">needs credentials</Pill>}
                {channel.customised && <Pill tone="blue">changed</Pill>}
              </p>
              <p className="truncate text-xs text-slate-600">{channel.description}</p>
            </div>
          </li>
        ))}
      </ul>
    </Card>
  );
}

/**
 * The matrix, grouped by component.
 *
 * GROUPED BY COMPONENT because that is the level the configuration is actually
 * at: "Fee collection" and "Receipt" are different things a school reasons about
 * separately, and a flat list of sixty notifications sorted by name hides which
 * part of the module they belong to.
 */
function NotificationMatrix({
  events,
  channels,
  dirtyKeys,
  onPatch,
  mayEdit,
  rightsReason,
}: {
  events: NotificationEventRow[];
  channels: NotificationPayload['channels'];
  dirtyKeys: Set<string>;
  onPatch: (row: NotificationEventRow, patch: (draft: NotificationEventRow) => NotificationEventRow) => void;
  mayEdit: boolean;
  rightsReason: string;
}) {
  const groups = useMemo(() => {
    const byComponent = new Map<string, { label: string; rows: NotificationEventRow[] }>();
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
                  {/* A column whose channel is off institute-wide is struck
                      through, so the cells below it are visibly inert rather
                      than misleadingly on. */}
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
                          <span title="Required — this notification cannot be switched off. Its channels can still be changed.">
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
                        disabled={!mayEdit || row.mandatory}
                        label={`${row.label} enabled`}
                        title={
                          row.mandatory
                            ? 'Required — this notification cannot be switched off.'
                            : mayEdit
                              ? undefined
                              : rightsReason
                        }
                      />
                    </td>

                    {channels.map((channel) => {
                      const setting = row.channels[channel.key] ?? { enabled: false, locked: false };
                      // A row that is off entirely, or a channel that is off for
                      // the institute, makes the cell inert. Left interactive it
                      // would let somebody "turn on" something that cannot send.
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
                                    // Turning a channel off releases its lock:
                                    // "locked off" and "off" are the same state,
                                    // and leaving the lock set would resurrect it
                                    // the next time somebody switches the channel
                                    // back on.
                                    [channel.key]: { enabled: next, locked: next ? setting.locked : false },
                                  },
                                }))
                              }
                              disabled={!mayEdit || inert}
                              label={`${row.label} on ${channel.label}`}
                              title={
                                !row.enabled
                                  ? 'This notification is switched off.'
                                  : !liveChannels.has(channel.key)
                                    ? `${channel.label} is switched off for the whole institute.`
                                    : mayEdit
                                      ? undefined
                                      : rightsReason
                              }
                            />
                            <label
                              className={`flex items-center gap-1 text-[10px] ${
                                setting.enabled && !inert ? 'text-slate-600' : 'text-slate-400'
                              } ${mayEdit && setting.enabled && !inert ? 'cursor-pointer' : 'cursor-not-allowed'}`}
                              title="Locked means the recipient cannot switch this off for themselves."
                            >
                              <input
                                type="checkbox"
                                className="h-3 w-3 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                                checked={setting.locked}
                                disabled={!mayEdit || inert || !setting.enabled}
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

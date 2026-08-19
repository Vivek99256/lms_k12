'use client';

import { useMemo, useState } from 'react';
import { Check, Loader2, RotateCcw, TriangleAlert } from 'lucide-react';

import { Button } from '@/components/ui/button';
import KnowledgeGraphView from '@/app/pal/new/_components/KnowledgeGraphView';
import {
  humanise,
  toneClasses,
  type CareerVocabularyGroup,
  type FieldDescriptor,
  type GraphSchemaNode,
  type GraphSchemaRelationship,
  type HealthMetric,
  type LivePayload,
  type MatrixAxis,
  type Panel,
  type SettingsValue,
  type SubsystemHealth,
} from '@/app/pal/new/data/administration';

/**
 * New PAL → Administration — panel renderers.
 *
 * The API describes each subsystem as a list of panels; these five components
 * are the complete set of kinds it can emit. Nothing here knows what a BKT
 * parameter or an HPC stage is: a panel arrives with its fields, ranges and
 * option lists already declared, so adding a parameter to the blueprint is a
 * backend-only change and this file does not move.
 *
 * Editing is DRAFT-THEN-SAVE rather than save-on-change. These settings decide
 * how every learner on the estate is assessed, so a half-typed number must not
 * reach the engine; the panel tracks its own draft, shows what is dirty, and
 * only writes when the administrator commits.
 */

// ══════════════════════════════════════════════════════════════════════════
// Shared chrome
// ══════════════════════════════════════════════════════════════════════════

// Matches the Pedagogy Engine's card treatment so Administration reads as the
// same module family rather than a bolt-on.
const CARD = 'rounded-[26px] border border-slate-200 bg-white p-6 shadow-sm';
const INPUT =
  'h-9 rounded-lg border border-slate-200 px-2.5 text-sm text-slate-800 outline-none transition-colors focus:border-violet-400 disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-400';

function PanelShell({
  title,
  help,
  customised,
  actions,
  children,
}: {
  title: string;
  help?: string | null;
  customised?: boolean;
  actions?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className={CARD}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <h2 className="text-[15px] font-bold text-slate-900">{title}</h2>
            {customised ? (
              <span className="rounded-full border border-violet-200 bg-violet-50 px-2 py-0.5 text-[11px] font-medium text-violet-700">
                Customised
              </span>
            ) : null}
          </div>
          {help ? <p className="mt-1 max-w-3xl text-xs text-slate-500">{help}</p> : null}
        </div>
        {actions ? <div className="flex shrink-0 items-center gap-2">{actions}</div> : null}
      </div>
      <div className="mt-4">{children}</div>
    </section>
  );
}

/** Save / reset controls shared by every editable panel. */
function EditActions({
  dirty,
  busy,
  canWrite,
  customised,
  needsConfirm,
  onSave,
  onReset,
}: {
  dirty: boolean;
  busy: boolean;
  canWrite: boolean;
  customised: boolean;
  needsConfirm: boolean;
  onSave: () => void;
  onReset: () => void;
}) {
  if (!canWrite) {
    return <span className="text-xs text-slate-400">Read only</span>;
  }

  return (
    <>
      {customised ? (
        <Button variant="outline" size="sm" onClick={onReset} disabled={busy}>
          <RotateCcw className="mr-1.5 h-3.5 w-3.5" />
          Reset to default
        </Button>
      ) : null}
      <Button size="sm" onClick={onSave} disabled={!dirty || busy}>
        {busy ? (
          <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
        ) : (
          <Check className="mr-1.5 h-3.5 w-3.5" />
        )}
        {needsConfirm && dirty ? 'Save — affects learners' : 'Save'}
      </Button>
    </>
  );
}

/** One value editor, chosen by the descriptor's declared type. */
function FieldInput({
  field,
  value,
  disabled,
  onChange,
  compact,
}: {
  field: FieldDescriptor;
  value: unknown;
  disabled: boolean;
  onChange: (next: unknown) => void;
  compact?: boolean;
}) {
  const width = compact
    ? field.width === 'narrow'
      ? 'w-24'
      : field.width === 'wide'
        ? 'w-full min-w-[18rem]'
        : 'w-full min-w-[10rem]'
    : 'w-full max-w-sm';

  switch (field.type) {
    case 'toggle':
      return (
        <label className="inline-flex cursor-pointer items-center gap-2">
          <input
            type="checkbox"
            checked={value === true}
            disabled={disabled}
            onChange={(e) => onChange(e.target.checked)}
            className="h-4 w-4 rounded border-slate-300 text-violet-600 accent-violet-600 disabled:cursor-not-allowed"
          />
          <span className="text-sm text-slate-600">{value === true ? 'On' : 'Off'}</span>
        </label>
      );

    case 'select':
      return (
        <select
          value={String(value ?? '')}
          disabled={disabled}
          onChange={(e) => onChange(e.target.value)}
          className={`${INPUT} ${width}`}
        >
          {field.options.map((option) => (
            <option key={option} value={option}>
              {humanise(option)}
            </option>
          ))}
        </select>
      );

    case 'number':
      return (
        <input
          type="number"
          value={value === null || value === undefined ? '' : String(value)}
          disabled={disabled}
          min={field.min ?? undefined}
          max={field.max ?? undefined}
          step={field.step ?? 1}
          onChange={(e) => onChange(e.target.value === '' ? '' : Number(e.target.value))}
          className={`${INPUT} ${width} font-mono tabular-nums`}
        />
      );

    case 'tags':
      return (
        <input
          type="text"
          value={Array.isArray(value) ? value.join(', ') : String(value ?? '')}
          disabled={disabled}
          placeholder="comma separated"
          onChange={(e) =>
            onChange(
              e.target.value
                .split(',')
                .map((item) => item.trim())
                .filter(Boolean)
            )
          }
          className={`${INPUT} ${width}`}
        />
      );

    case 'code':
      return (
        <span className="block truncate font-mono text-[12px] text-slate-500" title={String(value ?? '')}>
          {String(value ?? '—')}
        </span>
      );

    default:
      return (
        <input
          type="text"
          value={String(value ?? '')}
          disabled={disabled}
          onChange={(e) => onChange(e.target.value)}
          className={`${INPUT} ${width}`}
        />
      );
  }
}

/**
 * Re-seed a panel's draft when the saved settings change identity.
 *
 * A successful save replaces `value` with the server's own version; the draft
 * has to follow so "dirty" clears and a server-side coercion (3.0 → 3, or a
 * clamped range) is what the administrator ends up looking at rather than their
 * rejected input. This is React's adjust-state-during-render pattern rather than
 * an effect: the reset happens before paint, so the stale draft is never shown.
 */
function useDraft<T>(saved: T): [T, React.Dispatch<React.SetStateAction<T>>] {
  const [draft, setDraft] = useState<T>(saved);
  const [seed, setSeed] = useState<T>(saved);

  if (!Object.is(seed, saved)) {
    setSeed(saved);
    setDraft(saved);
  }

  return [draft, setDraft];
}

/** Read-only display for a non-editable column. */
function ReadOnlyCell({ field, value }: { field: FieldDescriptor; value: unknown }) {
  if (field.type === 'code') {
    const text = String(value ?? '—');
    return (
      <span className="block max-w-[22rem] truncate font-mono text-[12px] text-slate-500" title={text}>
        {text.includes('\\') ? text.split('\\').pop() : text}
      </span>
    );
  }

  if (field.type === 'tags' && Array.isArray(value)) {
    return (
      <div className="flex flex-wrap gap-1">
        {value.map((tag) => (
          <span
            key={String(tag)}
            className="rounded-full bg-slate-50 px-2 py-0.5 font-mono text-[11px] text-slate-600"
          >
            {String(tag)}
          </span>
        ))}
      </div>
    );
  }

  if (field.type === 'toggle') {
    return <span className="text-sm text-slate-600">{value === true ? 'Yes' : 'No'}</span>;
  }

  return <span className="text-sm text-slate-700">{String(value ?? '—')}</span>;
}

// ══════════════════════════════════════════════════════════════════════════
// live — what the configuration actually produces
// ══════════════════════════════════════════════════════════════════════════

/**
 * The computed output panel.
 *
 * Declared first on every subsystem so the page opens on what the settings
 * DO, not on the settings themselves. When the runtime cannot compute a
 * subsystem it says why in plain terms — that is a real finding for an
 * administrator, so it gets a panel of its own rather than an empty space.
 */
export function LivePanel({ panel, live }: { panel: Panel; live: LivePayload }) {
  if (!live.available) {
    return (
      <PanelShell title={panel.title}>
        <div className="flex items-start gap-2.5 rounded-xl border border-dashed border-amber-200 bg-amber-50/60 px-4 py-3.5 text-sm leading-6 text-amber-900">
          <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" />
          <p>{live.reason || 'This subsystem cannot be computed on this estate yet.'}</p>
        </div>
      </PanelShell>
    );
  }

  return (
    <PanelShell title={panel.title} help={panel.help}>
      {live.headline.length > 0 ? (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {live.headline.map((metric) => (
            <div
              key={metric.label}
              className="rounded-xl border border-violet-100 bg-violet-50/40 p-4"
            >
              <p className="text-[12px] font-medium text-slate-500">{metric.label}</p>
              <p className={`mt-2 font-mono text-[22px] font-bold leading-none tabular-nums ${metricColour(metric.tone)}`}>
                {metric.value}
              </p>
              {metric.note ? <p className="mt-1.5 text-[11px] text-slate-400">{metric.note}</p> : null}
            </div>
          ))}
        </div>
      ) : null}

      {live.graph ? (
        <div className="mt-5">
          <h3 className="text-[13px] font-semibold text-slate-800">Prerequisite graph</h3>
          <p className="mt-1 max-w-4xl text-xs leading-5 text-slate-500">
            Projected from the extracted chapter intelligence. Reads left to right: a concept can
            only be reached once everything pointing into it is mastered.
          </p>
          <div className="mt-2.5">
            <KnowledgeGraphView graph={live.graph} />
          </div>
        </div>
      ) : null}

      {live.tables.map((table) => (
        <div key={table.title} className="mt-5">
          <h3 className="text-[13px] font-semibold text-slate-800">{table.title}</h3>
          {table.note ? <p className="mt-1 max-w-4xl text-xs leading-5 text-slate-500">{table.note}</p> : null}

          <div className="mt-2.5 overflow-x-auto rounded-xl border border-slate-100">
            <table className="w-full min-w-[760px] text-sm">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50/60 text-left text-[11px] uppercase tracking-wide text-slate-400">
                  {table.columns.map((column) => (
                    <th
                      key={column.key}
                      className={`px-3 py-2.5 font-semibold ${column.numeric ? 'text-right' : ''}`}
                    >
                      {column.label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {table.rows.length === 0 ? (
                  <tr>
                    <td colSpan={table.columns.length} className="px-3 py-6 text-center text-xs text-slate-400">
                      Nothing to show.
                    </td>
                  </tr>
                ) : (
                  table.rows.map((row, index) => (
                    <tr key={index} className="border-b border-slate-50 last:border-0 hover:bg-slate-50/40">
                      {table.columns.map((column) => (
                        <td
                          key={column.key}
                          className={`px-3 py-2.5 ${column.numeric ? 'text-right font-mono tabular-nums' : ''} ${
                            column.emphasis ? 'font-semibold text-slate-900' : 'text-slate-600'
                          }`}
                        >
                          {row[column.key] || <span className="text-slate-300">—</span>}
                        </td>
                      ))}
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      ))}

      {live.notes.map((note) => (
        <p key={note} className="mt-3 max-w-4xl text-xs leading-5 text-slate-500">
          {note}
        </p>
      ))}
    </PanelShell>
  );
}

function metricColour(tone: string): string {
  switch (tone) {
    case 'good':
      return 'text-emerald-600';
    case 'warn':
      return 'text-amber-600';
    case 'critical':
      return 'text-rose-600';
    default:
      return 'text-slate-700';
  }
}

// ══════════════════════════════════════════════════════════════════════════
// metrics
// ══════════════════════════════════════════════════════════════════════════

export function MetricsPanel({
  panel,
  health,
}: {
  panel: Panel;
  health: SubsystemHealth;
}) {
  return (
    <PanelShell title={panel.title} help={health.summary}>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {health.metrics.map((metric: HealthMetric) => (
          <div key={metric.label} className="rounded-xl border border-slate-100 bg-slate-50/50 p-4">
            <p className="text-[12px] font-medium text-slate-500">{metric.label}</p>
            <p
              className={`mt-2 font-mono text-[22px] font-semibold leading-none tabular-nums ${
                metric.tone === 'good'
                  ? 'text-emerald-600'
                  : metric.tone === 'warn'
                    ? 'text-amber-600'
                    : metric.tone === 'critical'
                      ? 'text-rose-600'
                      : 'text-slate-700'
              }`}
            >
              {metric.value}
            </p>
            {metric.note ? <p className="mt-1.5 text-[11px] text-slate-400">{metric.note}</p> : null}
          </div>
        ))}
      </div>
    </PanelShell>
  );
}

// ══════════════════════════════════════════════════════════════════════════
// params
// ══════════════════════════════════════════════════════════════════════════

export function ParamsPanel({
  panel,
  value,
  canWrite,
  customised,
  needsConfirm,
  busy,
  onSave,
  onReset,
}: {
  panel: Panel;
  value: SettingsValue;
  canWrite: boolean;
  customised: boolean;
  needsConfirm: boolean;
  busy: boolean;
  onSave: (next: Record<string, unknown>) => void;
  onReset: () => void;
}) {
  const saved = useMemo(() => (Array.isArray(value) ? {} : value), [value]);
  const [draft, setDraft] = useDraft<Record<string, unknown>>(saved);

  const dirty = useMemo(
    () => panel.fields.some((field) => !Object.is(draft[field.key], saved[field.key])),
    [draft, saved, panel.fields]
  );

  return (
    <PanelShell
      title={panel.title}
      help={panel.help}
      customised={customised}
      actions={
        <EditActions
          dirty={dirty}
          busy={busy}
          canWrite={canWrite}
          customised={customised}
          needsConfirm={needsConfirm}
          onSave={() => onSave(draft)}
          onReset={onReset}
        />
      }
    >
      <dl className="divide-y divide-slate-100">
        {panel.fields.map((field) => (
          <div key={field.key} className="grid gap-2 py-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-start sm:gap-6">
            <div className="min-w-0">
              <dt className="text-sm font-medium text-slate-700">{field.label}</dt>
              {field.help ? <dd className="mt-0.5 text-xs text-slate-500">{field.help}</dd> : null}
            </div>
            <dd className="sm:justify-self-end">
              <FieldInput
                field={field}
                value={draft[field.key]}
                disabled={!canWrite || busy}
                onChange={(next) => setDraft((prev) => ({ ...prev, [field.key]: next }))}
              />
            </dd>
          </div>
        ))}
      </dl>
    </PanelShell>
  );
}

// ══════════════════════════════════════════════════════════════════════════
// records
// ══════════════════════════════════════════════════════════════════════════

export function RecordsPanel({
  panel,
  value,
  health,
  canWrite,
  customised,
  needsConfirm,
  busy,
  onSave,
  onReset,
}: {
  panel: Panel;
  value: SettingsValue;
  health: SubsystemHealth;
  canWrite: boolean;
  customised: boolean;
  needsConfirm: boolean;
  busy: boolean;
  onSave: (next: Record<string, unknown>[]) => void;
  onReset: () => void;
}) {
  const saved = useMemo(
    () => (Array.isArray(value) ? value : []) as Record<string, unknown>[],
    [value]
  );
  const [draft, setDraft] = useDraft<Record<string, unknown>[]>(saved);

  const editable = panel.columns.filter((column) => column.editable);
  const hasStatus = Object.keys(health.rowStatus).length > 0;

  const dirty = useMemo(
    () =>
      draft.some((row, index) =>
        editable.some((column) => {
          const before = saved[index]?.[column.key];
          const after = row[column.key];
          return Array.isArray(before) || Array.isArray(after)
            ? JSON.stringify(before ?? []) !== JSON.stringify(after ?? [])
            : !Object.is(before, after);
        })
      ),
    [draft, saved, editable]
  );

  const setCell = (index: number, key: string, next: unknown) =>
    setDraft((prev) => prev.map((row, i) => (i === index ? { ...row, [key]: next } : row)));

  return (
    <PanelShell
      title={panel.title}
      help={panel.help}
      customised={customised}
      actions={
        editable.length > 0 ? (
          <EditActions
            dirty={dirty}
            busy={busy}
            canWrite={canWrite}
            customised={customised}
            needsConfirm={needsConfirm}
            onSave={() => onSave(draft)}
            onReset={onReset}
          />
        ) : null
      }
    >
      <div className="overflow-x-auto">
        <table className="w-full min-w-[900px] text-sm">
          <thead>
            <tr className="border-b border-slate-100 text-left text-[11px] uppercase tracking-wide text-slate-400">
              {panel.columns.map((column) => (
                <th key={column.key} className="px-3 py-2.5 font-semibold">
                  {column.label}
                </th>
              ))}
              {hasStatus ? <th className="px-3 py-2.5 font-semibold">Live</th> : null}
            </tr>
          </thead>
          <tbody>
            {draft.map((row, index) => {
              const rowKey = String(row.key ?? index);
              const status = health.rowStatus[rowKey];

              return (
                <tr key={rowKey} className="border-b border-slate-50 align-top hover:bg-slate-50/40">
                  {panel.columns.map((column) => (
                    <td key={column.key} className="px-3 py-2.5">
                      {column.editable ? (
                        <FieldInput
                          field={column}
                          value={row[column.key]}
                          disabled={!canWrite || busy}
                          onChange={(next) => setCell(index, column.key, next)}
                          compact
                        />
                      ) : (
                        <ReadOnlyCell field={column} value={row[column.key]} />
                      )}
                    </td>
                  ))}
                  {hasStatus ? (
                    <td className="px-3 py-2.5">
                      {status ? (
                        <span
                          className={`inline-block whitespace-nowrap rounded-full border px-2 py-0.5 text-[11px] font-medium ${toneClasses(status.tone)}`}
                        >
                          {status.label}
                        </span>
                      ) : (
                        <span className="text-xs text-slate-300">—</span>
                      )}
                    </td>
                  ) : null}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </PanelShell>
  );
}

// ══════════════════════════════════════════════════════════════════════════
// matrix
// ══════════════════════════════════════════════════════════════════════════

export function MatrixPanel({
  panel,
  value,
  canWrite,
  customised,
  needsConfirm,
  busy,
  onSave,
  onReset,
}: {
  panel: Panel;
  value: SettingsValue;
  canWrite: boolean;
  customised: boolean;
  needsConfirm: boolean;
  busy: boolean;
  onSave: (next: Record<string, Record<string, string>>) => void;
  onReset: () => void;
}) {
  const saved = useMemo(() => {
    const source = Array.isArray(value) ? {} : value;
    const out: Record<string, Record<string, string>> = {};
    panel.rows.forEach((row: MatrixAxis) => {
      const cells = (source[row.key] ?? {}) as Record<string, unknown>;
      out[row.key] = {};
      panel.matrixColumns.forEach((column) => {
        out[row.key][column.key] = String(cells[column.key] ?? '');
      });
    });
    return out;
  }, [value, panel.rows, panel.matrixColumns]);

  const [draft, setDraft] = useDraft(saved);

  const dirty = useMemo(
    () =>
      panel.rows.some((row) =>
        panel.matrixColumns.some((column) => draft[row.key]?.[column.key] !== saved[row.key]?.[column.key])
      ),
    [draft, saved, panel.rows, panel.matrixColumns]
  );

  return (
    <PanelShell
      title={panel.title}
      help={panel.help}
      customised={customised}
      actions={
        <EditActions
          dirty={dirty}
          busy={busy}
          canWrite={canWrite}
          customised={customised}
          needsConfirm={needsConfirm}
          onSave={() => onSave(draft)}
          onReset={onReset}
        />
      }
    >
      <div className="overflow-x-auto">
        <table className="w-full min-w-[900px] border-separate border-spacing-0 text-sm">
          <thead>
            <tr className="text-left text-[11px] uppercase tracking-wide text-slate-400">
              <th className="border-b border-slate-100 px-3 py-2.5 font-semibold">
                {panel.rowLabel || 'Dimension'}
              </th>
              {panel.matrixColumns.map((column) => (
                <th key={column.key} className="border-b border-slate-100 px-3 py-2.5 font-semibold">
                  {column.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {panel.rows.map((row) => (
              <tr key={row.key} className="align-top">
                <th
                  scope="row"
                  className="w-40 border-b border-slate-50 px-3 py-3 text-left align-top"
                >
                  <span className="block text-sm font-semibold text-slate-700">{row.label}</span>
                  {row.sublabel ? (
                    <span className="mt-0.5 block text-[11px] text-slate-400">{row.sublabel}</span>
                  ) : null}
                </th>
                {panel.matrixColumns.map((column) => (
                  <td key={column.key} className="border-b border-slate-50 px-3 py-3">
                    <textarea
                      rows={4}
                      value={draft[row.key]?.[column.key] ?? ''}
                      disabled={!canWrite || busy}
                      onChange={(e) =>
                        setDraft((prev) => ({
                          ...prev,
                          [row.key]: { ...prev[row.key], [column.key]: e.target.value },
                        }))
                      }
                      className="w-full min-w-[15rem] resize-y rounded-lg border border-slate-200 p-2.5 text-[13px] leading-relaxed text-slate-700 outline-none transition-colors focus:border-violet-400 disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-500"
                    />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </PanelShell>
  );
}

// ══════════════════════════════════════════════════════════════════════════
// catalog — read-only reference, probed at request time
// ══════════════════════════════════════════════════════════════════════════

export function GraphSchemaPanel({
  panel,
  nodes,
  relationships,
  probed,
}: {
  panel: Panel;
  nodes: GraphSchemaNode[];
  relationships: GraphSchemaRelationship[];
  probed: boolean;
}) {
  return (
    <PanelShell title={panel.title} help={panel.help}>
      {!probed ? (
        <div className="mb-4 flex items-start gap-2.5 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" />
          <span>
            The graph could not be reached, so presence could not be checked. The labels below are the
            schema the blueprint defines, not what exists.
          </span>
        </div>
      ) : null}

      <h3 className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">Node labels</h3>
      <div className="mt-2 grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
        {nodes.map((node) => (
          <div
            key={node.label}
            className="flex items-start justify-between gap-2 rounded-xl border border-slate-100 px-3 py-2"
          >
            <div className="min-w-0">
              <p className="font-mono text-[12px] font-semibold text-slate-700">:{node.label}</p>
              <p className="mt-0.5 text-[11px] text-slate-500">{node.note}</p>
            </div>
            {node.present === null ? null : (
              <span
                className={`shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-medium ${toneClasses(
                  node.present ? 'good' : 'neutral'
                )}`}
              >
                {node.present ? 'Present' : 'Absent'}
              </span>
            )}
          </div>
        ))}
      </div>

      <h3 className="mt-6 text-[11px] font-semibold uppercase tracking-wide text-slate-400">
        Relationships
      </h3>
      <div className="mt-2 overflow-x-auto">
        <table className="w-full min-w-[700px] text-sm">
          <thead>
            <tr className="border-b border-slate-100 text-left text-[11px] uppercase tracking-wide text-slate-400">
              <th className="px-3 py-2.5 font-semibold">Edge</th>
              <th className="px-3 py-2.5 font-semibold">From → to</th>
              <th className="px-3 py-2.5 font-semibold">Meaning</th>
            </tr>
          </thead>
          <tbody>
            {relationships.map((relationship) => (
              <tr key={relationship.type} className="border-b border-slate-50">
                <td className="px-3 py-2.5 font-mono text-[12px] font-semibold text-violet-600">
                  [:{relationship.type}]
                </td>
                <td className="whitespace-nowrap px-3 py-2.5 font-mono text-[12px] text-slate-500">
                  :{relationship.from} → :{relationship.to}
                </td>
                <td className="px-3 py-2.5 text-slate-600">{relationship.note}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </PanelShell>
  );
}

export function VocabularyPanel({
  panel,
  groups,
}: {
  panel: Panel;
  groups: CareerVocabularyGroup[];
}) {
  return (
    <PanelShell title={panel.title} help={panel.help}>
      <div className="grid gap-4 lg:grid-cols-2">
        {groups.map((group) => (
          <div key={group.group} className="rounded-xl border border-slate-100 p-4">
            <div className="flex items-baseline justify-between gap-2">
              <h3 className="text-sm font-bold text-slate-900">{group.group.toUpperCase()}</h3>
              <span className="text-xs text-slate-400">{group.values.length} values</span>
            </div>
            <div className="mt-2.5 flex flex-wrap gap-1.5">
              {group.values.map((item) => (
                <span
                  key={item}
                  className="rounded-full bg-slate-50 px-2 py-0.5 font-mono text-[11px] text-slate-600"
                >
                  {item}
                </span>
              ))}
            </div>
          </div>
        ))}
      </div>
    </PanelShell>
  );
}

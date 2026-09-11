'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { AlertTriangle, Check, ChevronRight, Loader2, RefreshCw, Search, X } from 'lucide-react';

import { fetchRegistry, PlatformApiError } from '@/lib/platform/client';
import type { PlatformRegistry, RegistryComponent, RegistryModule } from '@/lib/platform/types';

/**
 * The frame all three platform-service screens share.
 *
 * WHY THEY SHARE ONE. Communication, Scheduler and Workflow ask the same question
 * of the same catalogue — *what should happen for this component?* — so they get
 * the same navigation: pick a module on the left, narrow to a component, act on
 * the rows. Three screens that each invented their own module picker would drift,
 * and an administrator moving between them would have to relearn the shape every
 * time.
 *
 * THE MODULE LIST IS FETCHED, NEVER DECLARED HERE. It comes from
 * GET /api/platform/registry, which is the same catalogue the write endpoints
 * validate against — so this UI physically cannot offer a setting the API would
 * refuse. See lib/platform/types.ts for why there is no copy of it in TypeScript.
 */

// ── Small pieces ────────────────────────────────────────────────────────────

export function Card({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return <div className={`rounded-xl border border-slate-200 bg-white shadow-sm ${className}`}>{children}</div>;
}

export function LoadingState({ label = 'Loading' }: { label?: string }) {
  return (
    <div className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-10 text-sm text-slate-600">
      <Loader2 size={16} className="animate-spin" />
      {label}…
    </div>
  );
}

export function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-5 text-sm text-red-800">
      <div className="flex items-start gap-2">
        <AlertTriangle size={16} className="mt-0.5 shrink-0" />
        <div className="space-y-2">
          <p>{message}</p>
          {onRetry && (
            <button
              type="button"
              onClick={onRetry}
              className="rounded-lg border border-red-300 bg-white px-3 py-1.5 text-xs font-medium text-red-700 hover:bg-red-100"
            >
              Try again
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

/**
 * A saved / failed message.
 *
 * Kept as one component with a tone rather than two, because the two must sit in
 * exactly the same place: an operator who has just pressed Save is looking at one
 * spot, and a failure that renders somewhere else reads as nothing having
 * happened.
 */
export function Note({ tone, text, onDismiss }: { tone: 'ok' | 'error'; text: string; onDismiss?: () => void }) {
  return (
    <div
      role="status"
      className={`flex items-start justify-between gap-3 rounded-xl border px-4 py-3 text-sm ${
        tone === 'ok' ? 'border-emerald-200 bg-emerald-50 text-emerald-800' : 'border-red-200 bg-red-50 text-red-700'
      }`}
    >
      <span className="flex items-start gap-2">
        {tone === 'ok' ? <Check size={16} className="mt-0.5 shrink-0" /> : <AlertTriangle size={16} className="mt-0.5 shrink-0" />}
        {text}
      </span>
      {onDismiss && (
        <button type="button" onClick={onDismiss} className="shrink-0 rounded p-0.5 hover:bg-black/5" aria-label="Dismiss">
          <X size={14} />
        </button>
      )}
    </div>
  );
}

export function Pill({
  tone = 'gray',
  children,
}: {
  tone?: 'gray' | 'blue' | 'green' | 'amber' | 'red';
  children: React.ReactNode;
}) {
  const tones = {
    gray: 'bg-slate-100 text-slate-700 border-slate-200',
    blue: 'bg-indigo-50 text-indigo-700 border-indigo-200',
    green: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    amber: 'bg-amber-50 text-amber-800 border-amber-200',
    red: 'bg-red-50 text-red-700 border-red-200',
  } as const;

  return (
    <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-medium ${tones[tone]}`}>
      {children}
    </span>
  );
}

export function StatTiles({ tiles }: { tiles: Array<{ label: string; value: number | string; hint?: string; tone?: 'gray' | 'amber' | 'red' | 'green' }> }) {
  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      {tiles.map((tile) => (
        <Card key={tile.label} className="px-4 py-3">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">{tile.label}</p>
          <p
            className={`mt-1 text-2xl font-semibold tabular-nums ${
              tile.tone === 'red' ? 'text-red-600' : tile.tone === 'amber' ? 'text-amber-600' : tile.tone === 'green' ? 'text-emerald-600' : 'text-slate-900'
            }`}
          >
            {tile.value}
          </p>
          {tile.hint && <p className="mt-0.5 text-xs text-slate-500">{tile.hint}</p>}
        </Card>
      ))}
    </div>
  );
}

/**
 * A switch.
 *
 * Disabled rather than hidden when the operator lacks rights, and it carries the
 * reason as its title. A silently missing control reads as a broken product; a
 * disabled one that says why reads as a permission boundary.
 */
export function Switch({
  checked,
  onChange,
  disabled = false,
  label,
  title,
  size = 'md',
}: {
  checked: boolean;
  onChange: (next: boolean) => void;
  disabled?: boolean;
  label: string;
  title?: string;
  size?: 'sm' | 'md';
}) {
  const dimensions = size === 'sm' ? { track: 'h-4 w-8', knob: 'h-3 w-3', shift: 'translate-x-4' } : { track: 'h-5 w-9', knob: 'h-4 w-4', shift: 'translate-x-4' };

  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      title={title ?? label}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={`relative inline-flex shrink-0 items-center rounded-full transition-colors ${dimensions.track} ${
        checked ? 'bg-indigo-600' : 'bg-slate-300'
      } ${disabled ? 'cursor-not-allowed opacity-40' : 'cursor-pointer hover:opacity-90'} focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2`}
    >
      <span
        className={`inline-block transform rounded-full bg-white shadow transition-transform ${dimensions.knob} ${
          checked ? dimensions.shift : 'translate-x-0.5'
        }`}
      />
    </button>
  );
}

export function RefreshButton({ onClick, busy }: { onClick: () => void; busy?: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={busy}
      className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
    >
      <RefreshCw size={14} className={busy ? 'animate-spin' : ''} />
      Refresh
    </button>
  );
}

/** A date the way an administrator reads one, or a plain "Never". */
export function formatWhen(iso: string | null | undefined): string {
  if (!iso) return 'Never';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return date.toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' });
}

// ── The registry ────────────────────────────────────────────────────────────

export interface RegistryState {
  registry: PlatformRegistry | null;
  problems: string[];
  loading: boolean;
  error: string | null;
  reload: () => void;
}

/**
 * Load the catalogue once per screen.
 *
 * Deliberately not cached across screens: it is one small request, and a cache
 * shared between three consoles is a cache that shows a stale module list after
 * somebody edits the config — which is precisely the failure the single-registry
 * design exists to prevent.
 */
export function usePlatformRegistry(): RegistryState {
  const [registry, setRegistry] = useState<PlatformRegistry | null>(null);
  const [problems, setProblems] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [nonce, setNonce] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);

    fetchRegistry()
      .then((result) => {
        if (cancelled) return;
        setRegistry(result.registry);
        setProblems(result.problems);
      })
      .catch((cause: unknown) => {
        if (cancelled) return;
        setError(cause instanceof PlatformApiError ? cause.message : 'The platform registry could not be loaded.');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [nonce]);

  return { registry, problems, loading, error, reload: useCallback(() => setNonce((n) => n + 1), []) };
}

// ── Module picker ───────────────────────────────────────────────────────────

export type CountKey = 'notifications' | 'tasks' | 'workflows';

/**
 * The left rail: every module, grouped, with the count of things THIS screen can
 * configure in it.
 *
 * The count is per-service on purpose. Fees has six notifications and two
 * workflow points; showing one number on both screens would send an administrator
 * looking for approvals into a module that has none.
 */
export function ModulePicker({
  modules,
  countKey,
  selected,
  onSelect,
}: {
  modules: RegistryModule[];
  countKey: CountKey;
  selected: string | null;
  onSelect: (moduleKey: string | null) => void;
}) {
  const [query, setQuery] = useState('');

  const groups = useMemo(() => {
    const term = query.trim().toLowerCase();
    const matching = modules.filter(
      (row) => !term || row.label.toLowerCase().includes(term) || row.description.toLowerCase().includes(term),
    );

    const byGroup = new Map<string, RegistryModule[]>();
    for (const row of matching) {
      const list = byGroup.get(row.group) ?? [];
      list.push(row);
      byGroup.set(row.group, list);
    }
    return [...byGroup.entries()].sort(([a], [b]) => a.localeCompare(b));
  }, [modules, query]);

  const total = modules.reduce((sum, row) => sum + row.counts[countKey], 0);

  return (
    <Card className="flex h-full flex-col overflow-hidden">
      <div className="border-b border-slate-200 p-3">
        <label className="relative block">
          <Search size={14} className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Find a module"
            className="w-full rounded-lg border border-slate-300 py-1.5 pl-8 pr-2 text-sm placeholder:text-slate-400 focus:border-indigo-400 focus:outline-none focus:ring-1 focus:ring-indigo-400"
          />
        </label>
      </div>

      <nav className="flex-1 overflow-y-auto p-2">
        {/* Every module at once. Useful for "where is SMS switched on across the
            whole school", which no single module can answer. */}
        <button
          type="button"
          onClick={() => onSelect(null)}
          className={`mb-1 flex w-full items-center justify-between rounded-lg px-3 py-2 text-left text-sm ${
            selected === null ? 'bg-indigo-50 font-medium text-indigo-800' : 'text-slate-700 hover:bg-slate-50'
          }`}
        >
          <span>All modules</span>
          <span className="tabular-nums text-xs text-slate-500">{total}</span>
        </button>

        {groups.map(([group, rows]) => (
          <div key={group} className="mb-2">
            <p className="px-3 pb-1 pt-2 text-[10px] font-semibold uppercase tracking-wider text-slate-400">{group}</p>
            {rows.map((row) => {
              const count = row.counts[countKey];
              const active = selected === row.key;
              return (
                <button
                  key={row.key}
                  type="button"
                  onClick={() => onSelect(row.key)}
                  title={row.description}
                  className={`flex w-full items-center justify-between gap-2 rounded-lg px-3 py-2 text-left text-sm ${
                    active ? 'bg-indigo-50 font-medium text-indigo-800' : 'text-slate-700 hover:bg-slate-50'
                  }`}
                >
                  <span className="truncate">{row.label}</span>
                  {/* Zero is shown, not hidden: "this module has nothing to
                      configure here" is an answer, and an absent number reads
                      as a loading bug. */}
                  <span className={`tabular-nums text-xs ${count === 0 ? 'text-slate-300' : 'text-slate-500'}`}>{count}</span>
                </button>
              );
            })}
          </div>
        ))}

        {groups.length === 0 && <p className="px-3 py-4 text-sm text-slate-500">No module matches that.</p>}
      </nav>
    </Card>
  );
}

/**
 * Component chips under the module heading.
 *
 * This is the second half of "module and component level": the module picker
 * chooses the module, these choose the component within it. Rendered only when
 * a module is selected, because "all components of all modules" is what the
 * unfiltered list already is.
 */
export function ComponentFilter({
  components,
  selected,
  onSelect,
  counts,
}: {
  components: RegistryComponent[];
  selected: string | null;
  onSelect: (componentKey: string | null) => void;
  /** Rows per component, so a component with nothing to show says so. */
  counts: Record<string, number>;
}) {
  if (components.length === 0) return null;

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <span className="mr-1 text-xs font-medium text-slate-500">Component</span>
      <button
        type="button"
        onClick={() => onSelect(null)}
        className={`rounded-full border px-3 py-1 text-xs font-medium ${
          selected === null ? 'border-indigo-300 bg-indigo-50 text-indigo-800' : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
        }`}
      >
        All
      </button>
      {components.map((component) => {
        const count = counts[component.key] ?? 0;
        return (
          <button
            key={component.key}
            type="button"
            onClick={() => onSelect(component.key)}
            title={component.description}
            disabled={count === 0}
            className={`rounded-full border px-3 py-1 text-xs font-medium disabled:cursor-not-allowed disabled:opacity-40 ${
              selected === component.key
                ? 'border-indigo-300 bg-indigo-50 text-indigo-800'
                : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
            }`}
          >
            {component.label}
            <span className="ml-1.5 tabular-nums text-slate-400">{count}</span>
          </button>
        );
      })}
    </div>
  );
}

// ── The page frame ──────────────────────────────────────────────────────────

export function PlatformShell({
  title,
  description,
  countKey,
  registry,
  problems,
  selectedModule,
  onSelectModule,
  actions,
  children,
}: {
  title: string;
  description: string;
  countKey: CountKey;
  registry: PlatformRegistry;
  problems: string[];
  selectedModule: string | null;
  onSelectModule: (moduleKey: string | null) => void;
  actions?: React.ReactNode;
  children: React.ReactNode;
}) {
  const activeModule = selectedModule ? registry.modules.find((row) => row.key === selectedModule) ?? null : null;

  return (
    <div className="min-h-screen bg-slate-50 p-6">
      <header className="mb-5">
        <p className="flex items-center gap-1 text-xs font-medium text-slate-500">
          Platform services <ChevronRight size={12} /> {title}
        </p>
        <div className="mt-1 flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-xl font-semibold text-slate-900">{title}</h1>
            <p className="mt-1 max-w-3xl text-sm text-slate-600">{description}</p>
          </div>
          {actions && <div className="flex items-center gap-2">{actions}</div>}
        </div>
      </header>

      {/* A misconfigured registry is reported where an administrator will see
          it, rather than showing up as a row silently missing from a screen. */}
      {problems.length > 0 && (
        <div className="mb-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          <p className="mb-1 flex items-center gap-2 font-medium">
            <AlertTriangle size={15} />
            The platform registry has {problems.length} problem{problems.length === 1 ? '' : 's'}
          </p>
          <ul className="ml-6 list-disc space-y-0.5 text-xs">
            {problems.slice(0, 6).map((problem) => (
              <li key={problem}>{problem}</li>
            ))}
          </ul>
          <p className="mt-1.5 text-xs">Fix these in <code className="rounded bg-amber-100 px-1">config/platform_services.php</code>.</p>
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-[260px_minmax(0,1fr)]">
        <aside className="lg:sticky lg:top-6 lg:max-h-[calc(100vh-3rem)]">
          <ModulePicker modules={registry.modules} countKey={countKey} selected={selectedModule} onSelect={onSelectModule} />
        </aside>

        <main className="min-w-0 space-y-4">
          {activeModule && (
            <div>
              <h2 className="text-base font-semibold text-slate-900">{activeModule.label}</h2>
              <p className="text-sm text-slate-600">{activeModule.description}</p>
            </div>
          )}
          {children}
        </main>
      </div>
    </div>
  );
}

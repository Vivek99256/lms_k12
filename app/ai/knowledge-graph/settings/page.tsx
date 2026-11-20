'use client';

/**
 * Knowledge Graph — centralized settings.
 *
 * One switch per module, in this school: on by default (nothing here ever
 * grants something a module did not already have), and the only thing a
 * toggle can do is take a module's Knowledge Graph tab away. The resolved
 * state below is read live from `KnowledgeGraphSettingsResolver`, the same
 * seam every module itself reads before rendering — this screen does not
 * keep its own copy of the decision, it changes the one copy that exists.
 *
 * The platform default (set directly in the database, not from this screen)
 * is shown for context but is not editable here — see
 * `KnowledgeGraphSettingsController`'s docblock for why a per-school admin
 * screen can never reach it.
 */

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, ChevronDown, ChevronRight, Loader2, RotateCcw, Search, ShieldAlert } from 'lucide-react';

import { Switch } from '@/components/ui/switch';
import {
  clearKnowledgeGraphSetting,
  clearKnowledgeGraphTreeSetting,
  fetchKnowledgeGraphLiveInventory,
  fetchKnowledgeGraphSettings,
  fetchKnowledgeGraphTree,
  saveKnowledgeGraphSetting,
  saveKnowledgeGraphTreeSetting,
  type KnowledgeGraphModuleSetting,
  type KnowledgeGraphSettingsOverview,
  type KnowledgeGraphTreeModule,
  type KnowledgeGraphTreeOverview,
} from '@/lib/intelligence/ai-knowledge-graph-settings';

export default function KnowledgeGraphSettingsPage() {
  const [overview, setOverview] = useState<KnowledgeGraphSettingsOverview | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState('');
  const [busy, setBusy] = useState<string | null>(null);
  const [notice, setNotice] = useState<{ tone: 'ok' | 'error'; text: string } | null>(null);

  const load = () => {
    setLoading(true);
    setError(null);
    fetchKnowledgeGraphSettings()
      .then((data) => {
        setOverview(data);
        setLoading(false);
      })
      .catch((cause: unknown) => {
        setError(cause instanceof Error ? cause.message : 'The request failed.');
        setLoading(false);
      });
  };

  useEffect(() => {
    // Initial load, the same pattern ConversationalAiAdmin.tsx uses for its own mount fetch.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
  }, []);

  const modules = useMemo(() => {
    const rows = overview?.modules ?? [];
    const needle = filter.trim().toLowerCase();
    if (!needle) return rows;
    return rows.filter(
      (row) => row.module_label.toLowerCase().includes(needle) || row.module.toLowerCase().includes(needle)
    );
  }, [overview, filter]);

  async function toggleModule(row: KnowledgeGraphModuleSetting, next: boolean) {
    setBusy(row.module);
    try {
      await saveKnowledgeGraphSetting(row.module, next);
      setOverview((current) =>
        current
          ? {
              ...current,
              modules: current.modules.map((candidate) =>
                candidate.module === row.module
                  ? { ...candidate, enabled: next, source: 'institute_module' }
                  : candidate
              ),
            }
          : current
      );
      setNotice({ tone: 'ok', text: `Knowledge Graph ${next ? 'enabled' : 'disabled'} for ${row.module_label}.` });
    } catch (cause) {
      setNotice({ tone: 'error', text: cause instanceof Error ? cause.message : 'The setting could not be saved.' });
    } finally {
      setBusy(null);
    }
  }

  async function resetModule(row: KnowledgeGraphModuleSetting) {
    setBusy(row.module);
    try {
      await clearKnowledgeGraphSetting(row.module);
      // The source after clearing depends on the rest of the chain (this
      // school's wildcard, the platform's module row, or the platform's own
      // wildcard) — simplest and correct is to re-read the resolved overview
      // rather than guess which level now applies.
      load();
      setNotice({ tone: 'ok', text: `${row.module_label} now follows the rest of this school's setting.` });
    } catch (cause) {
      setNotice({ tone: 'error', text: cause instanceof Error ? cause.message : 'The override could not be cleared.' });
    } finally {
      setBusy(null);
    }
  }

  async function toggleInstituteDefault(next: boolean) {
    setBusy('__institute_default__');
    try {
      await saveKnowledgeGraphSetting(null, next);
      setNotice({
        tone: 'ok',
        text: `This school's default is now ${next ? 'enabled' : 'disabled'} for every module without its own override.`,
      });
      load();
    } catch (cause) {
      setNotice({ tone: 'error', text: cause instanceof Error ? cause.message : 'The default could not be saved.' });
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="min-h-full px-6 py-5">
      <div className="mx-auto max-w-[1100px]">
        <Link
          href="/ai/knowledge-graph"
          className="inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground"
        >
          <ArrowLeft className="size-3.5" />
          Knowledge Graph
        </Link>

        <header className="mt-3">
          <h1 className="text-2xl font-semibold text-foreground">Knowledge Graph — Settings</h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
            Centralized management, decentralized execution: flip a module off here and its Knowledge
            Graph tab stops rendering everywhere it appears — nothing needs its own setting.
          </p>
        </header>

        {notice && (
          <div
            role="status"
            className={`mt-4 rounded-lg border px-4 py-3 text-sm ${
              notice.tone === 'ok'
                ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
                : 'border-destructive/30 bg-destructive/5 text-destructive'
            }`}
          >
            {notice.text}
          </div>
        )}

        {loading && !overview ? (
          <div className="mt-6 flex items-center gap-2 rounded-lg border border-border bg-card p-6 text-sm text-muted-foreground">
            <Loader2 className="size-4 animate-spin" />
            Loading…
          </div>
        ) : error && !overview ? (
          <div className="mt-6 rounded-lg border border-destructive/30 bg-destructive/5 p-6 text-sm text-destructive">
            <p className="flex items-center gap-2 font-medium">
              <ShieldAlert className="size-4" />
              {error}
            </p>
          </div>
        ) : overview ? (
          <>
            <section className="mt-6 grid gap-4 sm:grid-cols-2">
              <div className="rounded-lg border border-border bg-card p-4">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <h2 className="text-sm font-semibold text-foreground">This school&apos;s default</h2>
                    <p className="mt-1 text-xs text-muted-foreground">
                      Applies to every module here without its own override.
                    </p>
                  </div>
                  <Switch
                    checked={overview.institute_default?.enabled ?? overview.platform_default?.enabled ?? true}
                    disabled={busy === '__institute_default__'}
                    onChange={(event) => toggleInstituteDefault(event.target.checked)}
                  />
                </div>
              </div>
              <div className="rounded-lg border border-dashed border-border bg-card/50 p-4">
                <h2 className="text-sm font-semibold text-foreground">Platform default</h2>
                <p className="mt-1 text-xs text-muted-foreground">
                  {overview.platform_default
                    ? `Set to ${overview.platform_default.enabled ? 'enabled' : 'disabled'} across every school. Not editable from here.`
                    : 'Enabled across every school (nothing set). Not editable from here.'}
                </p>
              </div>
            </section>

            <section className="mt-6">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <h2 className="text-sm font-semibold text-foreground">Modules</h2>
                <div className="relative w-full max-w-xs">
                  <Search className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
                  <input
                    value={filter}
                    onChange={(event) => setFilter(event.target.value)}
                    placeholder="Filter modules…"
                    className="w-full rounded-md border border-border bg-background py-1.5 pl-8 pr-3 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                  />
                </div>
              </div>

              <div className="mt-3 overflow-hidden rounded-lg border border-border bg-card">
                <div className="overflow-x-auto">
                  <table className="w-full min-w-full border-collapse text-left text-sm">
                    <thead>
                      <tr>
                        <th className="border-b border-border px-4 py-2.5 text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
                          Module
                        </th>
                       
                        <th className="border-b border-border px-4 py-2.5 text-[11px] font-semibold uppercase tracking-widest text-muted-foreground" />
                        <th className="border-b border-border px-4 py-2.5 text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
                          Enabled
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {modules.length === 0 ? (
                        <tr>
                          <td colSpan={4} className="px-4 py-6 text-center text-muted-foreground">
                            No modules match &ldquo;{filter}&rdquo;.
                          </td>
                        </tr>
                      ) : (
                        modules.map((row) => (
                          <tr key={row.module}>
                            <td className="px-4 py-2.5 text-foreground">
                              {row.module_label}
                              {/* <span className="ml-2 font-mono text-[11px] text-muted-foreground">{row.module}</span> */}
                            </td>
                            {/* <td className="px-4 py-2.5 text-muted-foreground">{SOURCE_LABEL[row.source]}</td> */}
                            <td className="px-4 py-2.5">
                              {row.source === 'institute_module' && (
                                <button
                                  type="button"
                                  onClick={() => resetModule(row)}
                                  disabled={busy === row.module}
                                  title="Return to this school's default"
                                  className="inline-flex items-center gap-1 rounded-md border border-border bg-background px-2 py-1 text-[11px] font-medium text-muted-foreground transition-colors hover:text-foreground disabled:opacity-50"
                                >
                                  <RotateCcw className="size-3" />
                                  Reset
                                </button>
                              )}
                            </td>
                            <td className="px-4 py-2.5">
                              <Switch
                                checked={row.enabled}
                                disabled={busy === row.module}
                                onChange={(event) => toggleModule(row, event.target.checked)}
                              />
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </section>

            <ExplorerTreeSection />
          </>
        ) : null}
      </div>
    </div>
  );
}

/**
 * The Explorer's own browse tree — module -> submodule -> node types.
 *
 * A separate section, a separate fetch, a separate table on the backend: this
 * governs whether a branch of the Centralized Explorer itself
 * (GraphModuleBrowser::erpModules()/erpSubmodules()) is browsable, not
 * whether a product module's tab renders at all (the section above). A
 * module switched off here takes every submodule under it with it, whatever
 * that submodule's own switch says.
 */
function ExplorerTreeSection() {
  const [tree, setTree] = useState<KnowledgeGraphTreeOverview | null>(null);
  const [liveCounts, setLiveCounts] = useState<Map<string, number>>(new Map());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [notice, setNotice] = useState<{ tone: 'ok' | 'error'; text: string } | null>(null);

  const load = () => {
    setLoading(true);
    setError(null);
    Promise.all([fetchKnowledgeGraphTree(), fetchKnowledgeGraphLiveInventory().catch(() => null)])
      .then(([data, inventory]) => {
        setTree(data);
        if (inventory) {
          setLiveCounts(new Map(inventory.labels.map((row) => [row.label, row.count])));
        }
        setLoading(false);
      })
      .catch((cause: unknown) => {
        setError(cause instanceof Error ? cause.message : 'The request failed.');
        setLoading(false);
      });
  };

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
  }, []);

  function toggleExpanded(moduleLabel: string) {
    setExpanded((current) => {
      const next = new Set(current);
      if (next.has(moduleLabel)) {
        next.delete(moduleLabel);
      } else {
        next.add(moduleLabel);
      }
      return next;
    });
  }

  async function toggleModule(moduleLabel: string, next: boolean) {
    setBusy(moduleLabel);
    try {
      await saveKnowledgeGraphTreeSetting(moduleLabel, null, next);
      load();
      setNotice({ tone: 'ok', text: `Explorer ${next ? 'enabled' : 'disabled'} for ${moduleLabel}.` });
    } catch (cause) {
      setNotice({ tone: 'error', text: cause instanceof Error ? cause.message : 'The setting could not be saved.' });
    } finally {
      setBusy(null);
    }
  }

  async function toggleSubmodule(moduleLabel: string, submoduleLabel: string, next: boolean) {
    const key = `${moduleLabel}::${submoduleLabel}`;
    setBusy(key);
    try {
      await saveKnowledgeGraphTreeSetting(moduleLabel, submoduleLabel, next);
      load();
      setNotice({ tone: 'ok', text: `Explorer ${next ? 'enabled' : 'disabled'} for ${submoduleLabel}.` });
    } catch (cause) {
      setNotice({ tone: 'error', text: cause instanceof Error ? cause.message : 'The setting could not be saved.' });
    } finally {
      setBusy(null);
    }
  }

  async function resetModule(moduleLabel: string) {
    setBusy(moduleLabel);
    try {
      await clearKnowledgeGraphTreeSetting(moduleLabel, null);
      load();
      setNotice({ tone: 'ok', text: `${moduleLabel} now follows the platform default.` });
    } catch (cause) {
      setNotice({ tone: 'error', text: cause instanceof Error ? cause.message : 'The override could not be cleared.' });
    } finally {
      setBusy(null);
    }
  }

  async function resetSubmodule(moduleLabel: string, submoduleLabel: string) {
    const key = `${moduleLabel}::${submoduleLabel}`;
    setBusy(key);
    try {
      await clearKnowledgeGraphTreeSetting(moduleLabel, submoduleLabel);
      load();
      setNotice({ tone: 'ok', text: `${submoduleLabel} now follows ${moduleLabel}'s setting.` });
    } catch (cause) {
      setNotice({ tone: 'error', text: cause instanceof Error ? cause.message : 'The override could not be cleared.' });
    } finally {
      setBusy(null);
    }
  }

  async function toggleNodeType(moduleLabel: string, submoduleLabel: string, nodeType: string, next: boolean) {
    const key = `${moduleLabel}::${submoduleLabel}::${nodeType}`;
    setBusy(key);
    try {
      await saveKnowledgeGraphTreeSetting(moduleLabel, submoduleLabel, next, nodeType);
      load();
      setNotice({ tone: 'ok', text: `Explorer ${next ? 'enabled' : 'disabled'} for ${nodeType}.` });
    } catch (cause) {
      setNotice({ tone: 'error', text: cause instanceof Error ? cause.message : 'The setting could not be saved.' });
    } finally {
      setBusy(null);
    }
  }

  async function resetNodeType(moduleLabel: string, submoduleLabel: string, nodeType: string) {
    const key = `${moduleLabel}::${submoduleLabel}::${nodeType}`;
    setBusy(key);
    try {
      await clearKnowledgeGraphTreeSetting(moduleLabel, submoduleLabel, nodeType);
      load();
      setNotice({ tone: 'ok', text: `${nodeType} now follows ${submoduleLabel}'s setting.` });
    } catch (cause) {
      setNotice({ tone: 'error', text: cause instanceof Error ? cause.message : 'The override could not be cleared.' });
    } finally {
      setBusy(null);
    }
  }

  return (
    <section className="mt-8">
      <h2 className="text-sm font-semibold text-foreground">Explorer tree</h2>
      <p className="mt-1 max-w-2xl text-xs text-muted-foreground">
        What the Centralized Explorer itself can browse — the same Module → Submodule tree it shows,
        with the real node types each submodule resolves to. A module switched off here takes every
        submodule under it with it.
      </p>

      {notice && (
        <div
          role="status"
          className={`mt-3 rounded-lg border px-4 py-3 text-sm ${
            notice.tone === 'ok'
              ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
              : 'border-destructive/30 bg-destructive/5 text-destructive'
          }`}
        >
          {notice.text}
        </div>
      )}

      {loading && !tree ? (
        <div className="mt-3 flex items-center gap-2 rounded-lg border border-border bg-card p-6 text-sm text-muted-foreground">
          <Loader2 className="size-4 animate-spin" />
          Loading…
        </div>
      ) : error && !tree ? (
        <div className="mt-3 rounded-lg border border-destructive/30 bg-destructive/5 p-6 text-sm text-destructive">
          <p className="flex items-center gap-2 font-medium">
            <ShieldAlert className="size-4" />
            {error}
          </p>
        </div>
      ) : tree ? (
        <div className="mt-3 divide-y divide-border rounded-lg border border-border bg-card">
          {tree.modules.length === 0 ? (
            <p className="px-4 py-6 text-center text-sm text-muted-foreground">No modules are visible here.</p>
          ) : (
            tree.modules.map((module) => (
              <ExplorerTreeModuleRow
                key={module.label}
                module={module}
                liveCounts={liveCounts}
                isExpanded={expanded.has(module.label)}
                onToggleExpanded={() => toggleExpanded(module.label)}
                busy={busy}
                onToggleModule={(next) => toggleModule(module.label, next)}
                onResetModule={() => resetModule(module.label)}
                onToggleSubmodule={(submoduleLabel, next) => toggleSubmodule(module.label, submoduleLabel, next)}
                onResetSubmodule={(submoduleLabel) => resetSubmodule(module.label, submoduleLabel)}
                onToggleNodeType={(submoduleLabel, nodeType, next) => toggleNodeType(module.label, submoduleLabel, nodeType, next)}
                onResetNodeType={(submoduleLabel, nodeType) => resetNodeType(module.label, submoduleLabel, nodeType)}
              />
            ))
          )}
        </div>
      ) : null}
    </section>
  );
}

function ExplorerTreeModuleRow({
  module,
  liveCounts,
  isExpanded,
  onToggleExpanded,
  busy,
  onToggleModule,
  onResetModule,
  onToggleSubmodule,
  onResetSubmodule,
  onToggleNodeType,
  onResetNodeType,
}: {
  module: KnowledgeGraphTreeModule;
  liveCounts: Map<string, number>;
  isExpanded: boolean;
  onToggleExpanded: () => void;
  busy: string | null;
  onToggleModule: (next: boolean) => void;
  onResetModule: () => void;
  onToggleSubmodule: (submoduleLabel: string, next: boolean) => void;
  onResetSubmodule: (submoduleLabel: string) => void;
  onToggleNodeType: (submoduleLabel: string, nodeType: string, next: boolean) => void;
  onResetNodeType: (submoduleLabel: string, nodeType: string) => void;
}) {
  return (
    <div>
      <div className="flex items-center gap-3 px-4 py-2.5">
        <button
          type="button"
          onClick={onToggleExpanded}
          className="flex size-5 shrink-0 items-center justify-center text-muted-foreground hover:text-foreground"
          aria-label={isExpanded ? 'Collapse' : 'Expand'}
        >
          {isExpanded ? <ChevronDown className="size-4" /> : <ChevronRight className="size-4" />}
        </button>
        <button type="button" onClick={onToggleExpanded} className="flex-1 text-left text-sm font-medium text-foreground">
          {module.label}
          <span className="ml-2 text-xs font-normal text-muted-foreground">
            {module.submodules.length} submodule{module.submodules.length === 1 ? '' : 's'}
          </span>
        </button>
        <button
          type="button"
          onClick={onResetModule}
          disabled={busy === module.label}
          title="Return to the platform default"
          className="inline-flex items-center gap-1 rounded-md border border-border bg-background px-2 py-1 text-[11px] font-medium text-muted-foreground transition-colors hover:text-foreground disabled:opacity-50"
        >
          <RotateCcw className="size-3" />
          Reset
        </button>
        <Switch
          checked={module.enabled}
          disabled={busy === module.label}
          onChange={(event) => onToggleModule(event.target.checked)}
        />
      </div>

      {isExpanded && (
        <div className="divide-y divide-border border-t border-border bg-muted/30 pl-11">
          {module.submodules.length === 0 ? (
            <p className="px-4 py-4 text-xs text-muted-foreground">This module has no submodules here.</p>
          ) : (
            module.submodules.map((submodule) => {
              const key = `${module.label}::${submodule.label}`;
              return (
                <div key={submodule.label} className="flex items-start gap-3 px-4 py-2.5">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm text-foreground">
                      {submodule.label}
                      {submodule.linked_module_key && (
                        <span
                          className="ml-2 rounded-full border border-indigo-200 bg-indigo-50 px-2 py-0.5 text-[10px] font-medium text-indigo-700"
                          title="Switching either one off switches both off"
                        >
                          also controls {submodule.linked_module_key} tab
                        </span>
                      )}
                    </p>
                    {submodule.mapped ? (
                      <div className="mt-1 flex flex-wrap gap-1.5">
                        {submodule.node_types.map((nodeType) => {
                          const count = liveCounts.get(nodeType.label);
                          const nodeKey = `${module.label}::${submodule.label}::${nodeType.label}`;
                          return (
                            <span
                              key={nodeType.label}
                              className="inline-flex items-center gap-1.5 rounded-full border border-border bg-background py-0.5 pl-2 pr-1.5 text-[10px] text-muted-foreground"
                            >
                              <span
                                title={count === undefined ? 'Live count unavailable' : `${count.toLocaleString()} live in Neo4j`}
                              >
                                {nodeType.label}
                                {count !== undefined && <span className="ml-1 text-foreground">{count.toLocaleString()}</span>}
                              </span>
                              <button
                                type="button"
                                onClick={() => onResetNodeType(submodule.label, nodeType.label)}
                                disabled={busy === nodeKey || !submodule.enabled}
                                title="Return to this submodule's setting"
                                className="text-muted-foreground transition-colors hover:text-foreground disabled:opacity-50"
                              >
                                <RotateCcw className="size-2.5" />
                              </button>
                              <Switch
                                size="sm"
                                checked={nodeType.enabled}
                                disabled={busy === nodeKey || !submodule.enabled}
                                onChange={(event) => onToggleNodeType(submodule.label, nodeType.label, event.target.checked)}
                              />
                            </span>
                          );
                        })}
                      </div>
                    ) : (
                      <p className="mt-1 text-[11px] text-muted-foreground">Not mapped to the graph yet.</p>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={() => onResetSubmodule(submodule.label)}
                    disabled={busy === key || !module.enabled}
                    title="Return to this module's setting"
                    className="inline-flex shrink-0 items-center gap-1 rounded-md border border-border bg-background px-2 py-1 text-[11px] font-medium text-muted-foreground transition-colors hover:text-foreground disabled:opacity-50"
                  >
                    <RotateCcw className="size-3" />
                    Reset
                  </button>
                  <Switch
                    checked={submodule.enabled}
                    disabled={busy === key || !module.enabled}
                    onChange={(event) => onToggleSubmodule(submodule.label, event.target.checked)}
                  />
                </div>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}

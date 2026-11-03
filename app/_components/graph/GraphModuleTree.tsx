'use client';

/**
 * The centralized explorer's left panel — the Gapstogrowth-style
 * hierarchical module explorer: every real ERP module (tblmenumaster
 * level-1), expand/collapse into its real submodules (level-2), a search
 * box that filters both levels by label text.
 *
 * Deliberately a controlled tree over data the parent already fetched for
 * the top level (`modules`) — this component owns only submodule fetching
 * (lazy, on first expand) and local expand/collapse/search UI state, so the
 * parent stays the single source of truth for "what's selected."
 *
 * Organization Management gets one extra synthetic leaf — "Staff,
 * Department & Role" — representing PR #988's own Institute/Department/
 * Role/Staff graph (`organizationStaffGraph`), alongside its ordinary
 * GraphSchema-mapped submodules, never instead of them.
 */

import { useEffect, useRef, useState } from 'react';
import { ChevronDown, ChevronRight, Loader2, Search } from 'lucide-react';

import { listErpSubmodules } from '@/lib/intelligence/client';
import type { IntelligenceContext } from '@/lib/intelligence/client';
import type { ErpModule, ErpSubmodule } from '@/lib/intelligence/types';

export type TreeSubmodule = ErpSubmodule & { kind?: 'organization-staff' };

const ORG_MANAGEMENT_STAFF_SUBMODULE: TreeSubmodule = {
  id: -1,
  label: 'Staff, Department & Role',
  mapped: true,
  kind: 'organization-staff',
};

function isOrganizationManagement(label: string): boolean {
  return label.toLowerCase().includes('organization management');
}

export default function GraphModuleTree({
  session,
  modules,
  selectedModuleId,
  selectedSubmoduleId,
  initialFocusModuleLabel,
  onSelectModule,
  onSelectSubmodule,
}: {
  session: IntelligenceContext;
  modules: ErpModule[];
  selectedModuleId: number | null;
  selectedSubmoduleId: number | null;
  /** UI convenience only — pre-expands/highlights the matching module on first load, never filters what's reachable. */
  initialFocusModuleLabel?: string;
  onSelectModule: (module: ErpModule) => void;
  onSelectSubmodule: (module: ErpModule, submodule: TreeSubmodule) => void;
}) {
  const [searchTerm, setSearchTerm] = useState('');
  const [expanded, setExpanded] = useState<Set<number>>(new Set());
  const [submodulesByModule, setSubmodulesByModule] = useState<Record<number, TreeSubmodule[] | 'loading' | 'error'>>({});
  const focusedOnce = useRef(false);

  const loadSubmodules = async (moduleId: number) => {
    if (submodulesByModule[moduleId]) return;
    setSubmodulesByModule((prev) => ({ ...prev, [moduleId]: 'loading' }));
    try {
      const payload = await listErpSubmodules(session, moduleId);
      const module = modules.find((m) => m.id === moduleId);
      const extra = module && isOrganizationManagement(module.label) ? [ORG_MANAGEMENT_STAFF_SUBMODULE] : [];
      setSubmodulesByModule((prev) => ({ ...prev, [moduleId]: [...extra, ...payload.submodules] }));
    } catch {
      setSubmodulesByModule((prev) => ({ ...prev, [moduleId]: 'error' }));
    }
  };

  const toggleModule = (module: ErpModule) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(module.id)) next.delete(module.id);
      else next.add(module.id);
      return next;
    });
    void loadSubmodules(module.id);
    onSelectModule(module);
  };

  // Pre-expand/select the focus module once, when it first appears in `modules` — never re-runs, never filters.
  useEffect(() => {
    if (focusedOnce.current || !initialFocusModuleLabel || modules.length === 0) return;
    const match = modules.find((m) => m.label.toLowerCase() === initialFocusModuleLabel.toLowerCase());
    if (match) {
      focusedOnce.current = true;
      setExpanded(new Set([match.id]));
      void loadSubmodules(match.id);
      onSelectModule(match);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [modules, initialFocusModuleLabel]);

  const term = searchTerm.trim().toLowerCase();
  const visibleModules = term
    ? modules.filter(
        (m) =>
          m.label.toLowerCase().includes(term) ||
          (Array.isArray(submodulesByModule[m.id]) &&
            (submodulesByModule[m.id] as TreeSubmodule[]).some((s) => s.label.toLowerCase().includes(term)))
      )
    : modules;

  return (
    <div className="flex h-full flex-col">
      <div className="relative px-2 pb-2 pt-1">
        <Search className="absolute left-4 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
        <input
          value={searchTerm}
          onChange={(event) => setSearchTerm(event.target.value)}
          placeholder="Filter modules…"
          className="w-full rounded-md border border-slate-200 py-1.5 pl-8 pr-2 text-sm"
        />
      </div>

      <div className="flex-1 overflow-y-auto px-1">
        {visibleModules.length === 0 && <p className="px-3 py-6 text-center text-sm text-slate-400">No modules match &ldquo;{searchTerm}&rdquo;.</p>}

        {visibleModules.map((module) => {
          const isExpanded = term.length > 0 || expanded.has(module.id);
          const submodules = submodulesByModule[module.id];
          const visibleSubmodules =
            Array.isArray(submodules) && term
              ? submodules.filter((s) => s.label.toLowerCase().includes(term) || module.label.toLowerCase().includes(term))
              : submodules;

          return (
            <div key={module.id} className="mb-0.5">
              <button
                type="button"
                onClick={() => toggleModule(module)}
                className={`flex w-full items-center gap-1.5 rounded-md px-2 py-1.5 text-left text-sm font-medium hover:bg-slate-50 ${
                  selectedModuleId === module.id && selectedSubmoduleId === null ? 'bg-blue-50 text-blue-700' : 'text-slate-700'
                }`}
              >
                {isExpanded ? <ChevronDown className="h-3.5 w-3.5 shrink-0" /> : <ChevronRight className="h-3.5 w-3.5 shrink-0" />}
                <span className="truncate">{module.label}</span>
                {module.submodule_count > 0 && (
                  <span className="ml-auto shrink-0 text-xs text-slate-400">{module.submodule_count}</span>
                )}
              </button>

              {isExpanded && (
                <div className="ml-5 border-l border-slate-100 pl-2">
                  {submodules === 'loading' && (
                    <p className="flex items-center gap-1.5 px-2 py-1.5 text-xs text-slate-400">
                      <Loader2 className="h-3 w-3 animate-spin" /> Loading…
                    </p>
                  )}
                  {submodules === 'error' && <p className="px-2 py-1.5 text-xs text-slate-400">Couldn&apos;t load submodules.</p>}
                  {Array.isArray(visibleSubmodules) &&
                    visibleSubmodules.map((submodule) => (
                      <button
                        key={submodule.id}
                        type="button"
                        onClick={() => onSelectSubmodule(module, submodule)}
                        disabled={!submodule.mapped}
                        className={`flex w-full items-center gap-1.5 rounded-md px-2 py-1.5 text-left text-sm disabled:cursor-not-allowed disabled:text-slate-300 ${
                          selectedSubmoduleId === submodule.id ? 'bg-blue-50 font-medium text-blue-700' : 'text-slate-600 hover:bg-slate-50'
                        }`}
                        title={submodule.mapped ? undefined : 'Not mapped to the graph yet'}
                      >
                        <span className="truncate">{submodule.label}</span>
                        {!submodule.mapped && <span className="ml-auto shrink-0 text-[10px] text-slate-300">unmapped</span>}
                      </button>
                    ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

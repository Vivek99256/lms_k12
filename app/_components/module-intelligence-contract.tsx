'use client';

import { useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';

import { ModuleIntelligence as ContractIntelligence } from '@/components/intelligence/module/ModuleIntelligence';
import type { ModuleIntelligenceContract } from '@/components/intelligence/module/contract';
import {
  INTELLIGENCE_MODULES,
  resolveIntelligenceModuleForMenu,
  type RegisteredIntelligenceModule,
} from '@/components/intelligence/module/registry';

/**
 * The bridge between a module's category bar and its own Intelligence contract.
 *
 * ── WHY THIS EXISTS ─────────────────────────────────────────────────────────
 *
 * `app/_components/module-intelligence.tsx` renders the Brain's loop filtered to
 * one module — the same signals every module gets, in the Brain's own card. This
 * renders something different and strictly richer: the module's OWN contract,
 * with its own coverage, position, breakdowns, findings, Module Integration and
 * Cross-Module Workflow, through the shared `ModuleIntelligence` renderer.
 *
 * A module with a contract should never fall back to the generic view, because
 * the generic view cannot show a single figure from that module's own tables.
 * Without this file nothing in `app/` reaches the registry at all, and all
 * twenty-one contracts are unreachable from the menu — which is exactly the
 * state this restores from.
 *
 * ── HOW A MODULE IS MATCHED, AND THE ORDER IS DELIBERATE ────────────────────
 *
 * 1. `moduleSlug` — an exact equality against the module's own
 *    `fees_menu_categories.module_name`. Deterministic, per-tenant-safe, and
 *    immune to the substring defect that once gave
 *    `/capability-intelligence/competency-library` the Library contract.
 * 2. Only then the label/href matcher, for the modules that declare no slug.
 *
 * Trying the slug first matters because the matcher returns the FIRST entry in
 * array order, so two plausible matches are resolved by registry position
 * rather than by which one is actually this module.
 *
 * ── IT RENDERS NOTHING RATHER THAN GUESSING ─────────────────────────────────
 *
 * A module with no registry entry, or an entry with no `loadContract`, returns
 * null so the caller keeps its existing generic tab. Showing an empty premium
 * shell for a module that has no contract would claim a screen exists where one
 * does not.
 */

/** The registry entry for this module, or undefined. Exported for the caller's own check. */
export function intelligenceEntryFor(
  moduleSlug: string,
  label: string,
  hrefs: string[],
): RegisteredIntelligenceModule | undefined {
  const slug = (moduleSlug || '').trim().toLowerCase();

  if (slug) {
    // The canonical slug first, then any additional slug the entry declares it
    // serves. Both are exact equality against `fees_menu_categories.module_name`,
    // so neither can mis-route the way label guessing can.
    const bySlug = INTELLIGENCE_MODULES.find(
      (entry) =>
        (entry.moduleSlug || '').trim().toLowerCase() === slug ||
        (entry.moduleSlugs ?? []).some((alias) => alias.trim().toLowerCase() === slug),
    );
    if (bySlug) return bySlug;
  }

  /*
   * THE SLUG IS PASSED AS THE MENU LINK, and that is the fix for a whole class
   * of "The Brain does not watch this menu".
   *
   * The matcher is a predicate over (label, legacy link, level-3 routes). This
   * bridge could only offer a label DERIVED from the slug — `users` became
   * "Users", `ptm` became "Ptm" — and an empty href list, because the
   * Intelligence category has no level-3 menus of its own. So a module whose
   * registry entry is recognised by its link or its route family could never
   * match here, and fell through to the Enterprise Brain fallback even though
   * the same module resolves correctly in the sidebar, where buildMenuTree
   * passes the real link.
   *
   * `fees_menu_categories.module_name` IS that identifier, so handing it over as
   * the link gives the matcher the same evidence the menu tree has. The
   * singular/plural pair is tried because the two spellings are both in use —
   * the slug is `user` in one place and `users` in another.
   */
  const spaced = slug.replace(/[-_]+/g, ' ');
  const candidates = [slug, spaced, spaced.replace(/s$/, ''), `${spaced}s`].filter(
    (value, index, all) => value !== '' && all.indexOf(value) === index,
  );

  /*
   * Each candidate is offered as the LABEL, the LINK and a ROUTE, because the
   * predicates use all three and a module is recognised by whichever its
   * registry entry happens to test. HR, for example, matches `label === 'user'`
   * or an href inside the `/user/` family — never the link — so feeding the
   * slug only as a link could never have matched it.
   *
   * The synthetic `/<slug>/` route is the module's own path prefix, which is
   * what `fees_menu_categories.route` already spells for it. It is appended to
   * the real hrefs rather than replacing them, so a genuine level-3 route still
   * wins where one exists.
   */
  for (const candidate of candidates) {
    const matched =
      resolveIntelligenceModuleForMenu(candidate, candidate, [...hrefs, `/${candidate}/`]) ??
      resolveIntelligenceModuleForMenu(label, candidate, hrefs);
    if (matched) return matched;
  }

  return resolveIntelligenceModuleForMenu(label, '', hrefs);
}

export function ModuleIntelligenceContractScreen({
  moduleSlug,
  label,
  hrefs,
}: {
  moduleSlug: string;
  label: string;
  hrefs: string[];
}) {
  const entry = intelligenceEntryFor(moduleSlug, label, hrefs);
  const [contract, setContract] = useState<ModuleIntelligenceContract | null>(null);
  const [failed, setFailed] = useState(false);

  // Importing the contract is a subscribe-to-an-external-system effect, and it
  // sets state only from the promise's callbacks — never synchronously in the
  // body — so a module with no contract re-renders nothing and the linter's
  // cascading-render rule is satisfied rather than suppressed.
  useEffect(() => {
    const load = entry?.loadContract;
    if (!load) return;

    let cancelled = false;

    load()
      .then((loaded) => {
        if (!cancelled) setContract(loaded);
      })
      .catch(() => {
        // A contract that fails to import is reported, not swallowed into an
        // empty screen: "this module has no intelligence" and "its contract
        // could not be loaded" are opposite news.
        if (!cancelled) setFailed(true);
      });

    return () => {
      cancelled = true;
    };
  }, [entry]);

  if (!entry?.loadContract) return null;

  if (failed) {
    return (
      <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-6 text-sm text-red-800">
        {label} Intelligence could not be loaded. Its contract failed to import.
      </div>
    );
  }

  if (!contract) {
    return (
      <div className="flex items-center gap-2 px-1 py-16 text-[13px] text-slate-500">
        <Loader2 className="h-4 w-4 animate-spin" />
        Opening {label} Intelligence…
      </div>
    );
  }

  return <ContractIntelligence contract={contract} />;
}

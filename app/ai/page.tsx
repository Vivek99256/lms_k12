'use client';

/**
 * The AI & Intelligence console.
 *
 * One screen listing every AI capability, what state it is in, and which of the
 * three products consume it today. It is a view over
 * `packages/ai-intelligence-core` — nothing is written here, so this page cannot
 * disagree with the menu, the capability pages, or a copy of the console running
 * inside G2G or Enterprise Brain.
 *
 * WHY IT SITS BESIDE PLATFORM ADMINISTRATION RATHER THAN INSIDE IT
 *
 * Platform Administration answers "what does the platform provide, and is it
 * ready" for services and AI together, in one line each, from the roadmap
 * registry. This console answers "what does this capability do for each of the
 * three products, and what is left before it can" — the sharing question, which
 * the roadmap registry has no field for. Two different questions over two
 * registries; folding them into one screen would mean one registry losing.
 */

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { ArrowUpRight } from 'lucide-react';

import { fetchCapabilities, type CapabilitySummary } from '@/lib/intelligence/ai-capabilities';

import {
  AI_CAPABILITIES,
  SOLUTIONS,
  capabilityHref,
  capabilityStatusCounts,
} from '@shared/ai-intelligence-core';

import { ConsumptionPill, StatusChip } from './_components/console-ui';

export default function AiConsolePage() {
  const counts = capabilityStatusCounts();

  /**
   * Live record counts for the signed-in school, keyed by capability slug.
   *
   * Kept beside the registry status rather than replacing it: the status is a
   * product statement ("this is still being built"), the count is what this
   * particular institute actually has. They answer different questions, and a
   * capability can honestly be in progress and already holding rows.
   *
   * Failure is silent by design — the table is useful without the counts, and an
   * error banner over a working list would overstate what went wrong.
   */
  const [live, setLive] = useState<Record<string, CapabilitySummary>>({});

  useEffect(() => {
    let cancelled = false;

    fetchCapabilities()
      .then((data) => {
        if (cancelled) return;
        setLive(Object.fromEntries(data.capabilities.map((row) => [row.key, row])));
      })
      .catch(() => {});

    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="min-h-full px-6 py-5">
      <div className="mx-auto max-w-[1100px]">
        <header>
          <h1 className="text-2xl font-semibold text-foreground">AI &amp; Intelligence</h1>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-muted-foreground">
            The AI capabilities the platform provides once and every product calls. LMS K-12 is where each
            one is implemented first; G2G and Enterprise Brain consume the same service rather than
            building their own.
          </p>
          <p className="mt-4 text-sm text-muted-foreground">
            {AI_CAPABILITIES.length} capabilities — {counts.live} live, {counts['in-progress']} in progress,{' '}
            {counts['coming-soon']} coming soon.
          </p>
        </header>

        <div className="mt-6 overflow-x-auto rounded-lg border border-border bg-card">
          <table className="w-full min-w-[52rem] border-collapse text-left text-sm">
            <thead>
              <tr>
                <th className="border-b border-border px-4 py-2.5 text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
                  Capability
                </th>
                <th className="whitespace-nowrap border-b border-border px-4 py-2.5 text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
                  Status
                </th>
                <th className="whitespace-nowrap border-b border-border px-4 py-2.5 text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
                  In this institute
                </th>
                {SOLUTIONS.map((solution) => (
                  <th
                    key={solution.id}
                    className="whitespace-nowrap border-b border-border px-4 py-2.5 text-[11px] font-semibold uppercase tracking-widest text-muted-foreground"
                  >
                    {solution.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {AI_CAPABILITIES.map((capability) => (
                <tr key={capability.id} className="transition-colors hover:bg-muted/40">
                  <td className="px-4 py-3 align-top">
                    <Link
                      href={`/ai/${capability.slug}`}
                      className="group inline-flex items-center gap-1.5 font-medium text-card-foreground hover:underline"
                    >
                      {capability.name}
                      <ArrowUpRight className="size-3.5 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" />
                    </Link>
                    <p className="mt-1 max-w-md text-xs leading-5 text-muted-foreground">{capability.purpose}</p>
                    {/* The capability's own screen, where it has one. Reached from
                        the row rather than replacing the row's link, so the
                        description stays one click away from a live feature too. */}
                    {capability.href && (
                      <Link
                        href={capabilityHref(capability)}
                        className="mt-1.5 inline-block text-xs font-medium text-primary hover:underline"
                      >
                        Open {capability.name}
                      </Link>
                    )}
                  </td>
                  <td className="px-4 py-3 align-top">
                    <StatusChip status={capability.status} roadmapId={capability.roadmapId} size="sm" />
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 align-top tabular-nums">
                    <LiveCount summary={live[capability.slug]} />
                  </td>
                  {SOLUTIONS.map((solution) => (
                    <td key={solution.id} className="px-4 py-3 align-top">
                      <ConsumptionPill state={capability.solutions[solution.id].today} />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <section className="mt-6 rounded-lg border border-border bg-card p-5">
          <h2 className="text-sm font-semibold text-card-foreground">How the three products share these</h2>
          <ul className="mt-3 space-y-3">
            {SOLUTIONS.map((solution) => (
              <li key={solution.id} className="flex flex-col gap-1 sm:flex-row sm:items-baseline sm:gap-3">
                <span className="w-40 shrink-0 text-sm font-medium text-card-foreground">{solution.label}</span>
                <span className="text-sm leading-6 text-muted-foreground">
                  {solution.description}{' '}
                  {solution.kind === 'host'
                    ? 'Hosts the shared endpoint; its scope rides on the signed-in user.'
                    : 'Identifies itself with the x-project-id header and a service token.'}
                </span>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </div>
  );
}

/**
 * One capability's live record count for the signed-in school.
 *
 * Renders a dash rather than a zero until the counts arrive, because "0" is a
 * claim about the data and an unanswered request is not one.
 */
function LiveCount({ summary }: { summary?: CapabilitySummary }) {
  if (!summary) return <span className="text-muted-foreground/50">—</span>;

  if (summary.state === 'unavailable') {
    return (
      <span
        className="text-xs text-muted-foreground"
        title={`Not installed: ${(summary.missing_tables ?? []).join(', ')}`}
      >
        Not installed
      </span>
    );
  }

  if (summary.count === 0) {
    return <span className="text-xs text-muted-foreground">No records</span>;
  }

  return (
    <span className="text-sm font-medium text-foreground">
      {summary.count.toLocaleString('en-IN')}
    </span>
  );
}

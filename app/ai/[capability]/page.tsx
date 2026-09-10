'use client';

/**
 * One AI capability, described from the shared registry.
 *
 * WHAT THIS REPLACES
 *
 * Ten of the twelve AI & Intelligence menu entries pointed at
 * `/general/coming-soon?module=<label>`, which reads a name out of the query
 * string and prints "<name> Under Construction. <name> is currently being built.
 * It will provide advanced configuration capabilities in a future update." The
 * same eleven words for every capability, telling a customer nothing about any of
 * them — and telling a colleague in G2G or Enterprise Brain nothing at all.
 *
 * This page leads with what the capability actually holds for the signed-in school,
 * then the registry record: what it is for, why it has to be shared rather than
 * rebuilt per product, what LMS K-12 does about it today, and what centralising it
 * needs. Every capability gets the same structure, because every capability has the
 * same record behind it.
 *
 * The per-solution breakdown that used to close the page is deliberately gone. It
 * answered a portfolio question — which of the three products consume this — on a
 * screen an administrator opens to look at their own school. That comparison still
 * lives on the console index at `/ai`, where it is the point of the table.
 *
 * `/general/coming-soon` is deliberately left in place — Platform Services still
 * uses it, and this change is scoped to AI & Intelligence.
 */

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { ArrowLeft, ArrowUpRight, LayoutGrid } from 'lucide-react';

import { capabilityStatusLabel, getCapabilityBySlug } from '@shared/ai-intelligence-core';

import { CapabilityLiveData } from '../_components/CapabilityLiveData';
import { PointList, SectionCard, StatusChip } from '../_components/console-ui';

export default function AiCapabilityPage() {
  const params = useParams<{ capability: string }>();
  const slug = Array.isArray(params?.capability) ? params.capability[0] : params?.capability;
  const capability = slug ? getCapabilityBySlug(slug) : undefined;

  if (!capability) return <UnknownCapability slug={slug} />;

  return (
    <div className="min-h-full px-6 py-5">
      <div className="mx-auto max-w-[1100px]">
        <Link
          href="/ai"
          className="inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground"
        >
          <ArrowLeft className="size-3.5" />
          AI &amp; Intelligence
        </Link>

        <header className="mt-3 flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0">
            <h1 className="text-2xl font-semibold text-foreground">{capability.name}</h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">{capability.purpose}</p>
          </div>
          <StatusChip status={capability.status} roadmapId={capability.roadmapId} />
        </header>

        {/* A capability with a working screen says so at the top. Burying the
            link under four explanatory sections would make a live feature look
            like a description of one. */}
        {capability.href && (
          <Link
            href={capability.href}
            className="mt-5 inline-flex items-center gap-2 rounded-lg border border-border bg-card px-4 py-2 text-sm font-medium text-foreground shadow-sm transition-colors hover:bg-muted"
          >
            Open {capability.name}
            <ArrowUpRight className="size-4" />
          </Link>
        )}

        {/* Live records lead. What the capability holds for this school is the
            thing an administrator opened the screen for; the explanation below is
            context for it, not a substitute. */}
        <CapabilityLiveData slug={capability.slug} name={capability.name} />

       

        {/*  */}
      </div>
    </div>
  );
}

/**
 * A slug the registry does not know.
 *
 * Says which name failed rather than showing a generic empty state — a renamed
 * capability leaves bookmarks behind, and the person following one needs to know
 * that the name changed, not that something broke.
 */
function UnknownCapability({ slug }: { slug?: string }) {
  return (
    <div className="flex h-full items-center justify-center px-6 py-10">
      <div className="flex max-w-md flex-col items-center rounded-lg border border-dashed border-border bg-card p-8 text-center">
        <span
          className="mb-4 flex size-12 items-center justify-center rounded-full bg-muted text-muted-foreground"
          aria-hidden="true"
        >
          <LayoutGrid className="size-5" />
        </span>
        <h1 className="text-lg font-semibold text-foreground">No such AI capability</h1>
        <p className="mt-2 text-sm leading-6 text-muted-foreground">
          {slug ? `"${slug}" is not in the AI capability registry.` : 'No capability was named.'} It may have
          been renamed.
        </p>
        <Link
          href="/ai"
          className="mt-6 inline-flex items-center gap-2 rounded-lg border border-border bg-card px-4 py-2 text-sm font-medium text-foreground shadow-sm transition-colors hover:bg-muted"
        >
          <ArrowLeft className="size-4" />
          All AI capabilities
        </Link>
      </div>
    </div>
  );
}

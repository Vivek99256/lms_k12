'use client';

/**
 * The capability page's frame, extracted so a managed capability keeps it.
 *
 * `/ai/providers` and `/ai/models` are now static routes with their own management UI,
 * which in Next takes precedence over `app/ai/[capability]/page.tsx`. Without this
 * component they would each have to re-create the header, the back link, the status
 * chip and the live-data panel — four copies of a layout that has to stay identical
 * across twelve capabilities, and the first one that drifts is the one nobody notices.
 *
 * So the dynamic page and the two managed pages render the same shell and differ only
 * in what they put inside it. Nothing that was on those screens before is lost: the
 * registry description and `CapabilityLiveData` are still here, above the controls.
 */

import Link from 'next/link';
import { ArrowLeft, ArrowUpRight } from 'lucide-react';

import { getCapabilityBySlug } from '@shared/ai-intelligence-core';

import { CapabilityLiveData } from './CapabilityLiveData';
import { StatusChip } from './console-ui';

export function CapabilityShell({
  slug,
  children,
}: {
  slug: string;
  children?: React.ReactNode;
}) {
  const capability = getCapabilityBySlug(slug);

  if (!capability) return null;

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
            <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
              {capability.purpose}
            </p>
          </div>
          <StatusChip status={capability.status} roadmapId={capability.roadmapId} />
        </header>

        {capability.href && (
          <Link
            href={capability.href}
            className="mt-5 inline-flex items-center gap-2 rounded-lg border border-border bg-card px-4 py-2 text-sm font-medium text-foreground shadow-sm transition-colors hover:bg-muted"
          >
            Open {capability.name}
            <ArrowUpRight className="size-4" />
          </Link>
        )}

        {/* Live records lead, exactly as they did on the dynamic page — what the
            capability holds for this school is what the administrator opened the
            screen for. The controls below act on the same rows. */}
        <CapabilityLiveData slug={capability.slug} name={capability.name} />

        {children}
      </div>
    </div>
  );
}

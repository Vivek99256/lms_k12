'use client';

import { notFound } from 'next/navigation';

import {
  PalContextHero,
  PalEmptyState,
  PalModuleDetail,
  type PalSurfaceVariant,
} from '@/app/pal/_components/PalContentView';
import { usePalContentModel } from '@/app/pal/_components/usePalContentModel';
import type { PalModuleView } from '@/app/pal/data/pal-content-model';
import {
  firstValue,
  queryStringFromSearchParams,
  type RouteSearchParams,
} from '@/app/pal/_lib/searchParams';

/**
 * The detail (slug) page shared by PAL's taxonomy routes.
 *
 * /pal/frameworks/[slug] and /pal/ulu/[slug] were identical apart from the
 * same handful of values their parent pages differed by: the slug map used to
 * validate the route, which slice of the model to read, the hero's
 * eyebrow/description, the back path, and the styling variant.
 *
 * This was left alone when the parents were consolidated, on the assumption
 * that detail pages carried more per-taxonomy variation. Reading them showed
 * they do not — the only differences are labels — so the same extraction
 * applies.
 */

export interface TaxonomyDetailPageProps {
  slug: string;
  searchParams: RouteSearchParams;
  /** Shown when no semantic intelligence is available for this taxonomy. */
  emptyTitle: string;
  eyebrow: string;
  description: string;
  /** Where "back" goes, before the query string is appended. */
  basePath: string;
  variant: PalSurfaceVariant;
}

/** The route page 404s an unknown slug against the taxonomy's slug map before rendering this. */
export default function PalTaxonomyDetailPage({
  slug,
  searchParams,
  emptyTitle,
  eyebrow,
  description,
  basePath,
  variant,
}: TaxonomyDetailPageProps) {
  const queryString = queryStringFromSearchParams(searchParams);
  const backHref = queryString ? `${basePath}?${queryString}` : basePath;

  const model = usePalContentModel(firstValue(searchParams.chapterId), firstValue(searchParams.concept));

  if (!model) {
    return <div className="px-6 py-10 text-sm text-slate-500">Loading…</div>;
  }

  if (!model.isReady || !model.context) {
    return (
      <PalEmptyState
        title={emptyTitle}
        message={model.error || 'No semantic intelligence is available for PAL yet.'}
        backHref={backHref}
      />
    );
  }

  const modules: Record<string, PalModuleView> = variant === 'framework' ? model.frameworkModules : model.uluModules;
  const selectedModule = modules[slug];

  // The slug is registered but this concept's extraction has nothing behind it.
  if (!selectedModule) notFound();

  return (
    <div className="min-h-full px-4 py-5 sm:px-6">
      <div className="mx-auto w-full max-w-[1800px] space-y-6">
        <PalContextHero
          eyebrow={eyebrow}
          title={selectedModule.title}
          description={description}
          context={model.context}
          variant={variant}
        />
        <PalModuleDetail module={selectedModule} backHref={backHref} variant={variant} />
      </div>
    </div>
  );
}

import { notFound } from 'next/navigation';

import {
  PalContextHero,
  PalEmptyState,
  PalModuleDetail,
  type PalSurfaceVariant,
} from '@/app/pal/_components/PalContentView';
import {
  getPalContentModel,
  type PalContentModelResponse,
  type PalModuleView,
} from '@/app/pal/data/pal-content-model';
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
  /** The taxonomy's slug map. Membership decides whether the route exists. */
  meta: Record<string, unknown>;
  /** Shown when no semantic intelligence is available for this taxonomy. */
  emptyTitle: string;
  eyebrow: string;
  description: string;
  /** Where "back" goes, before the query string is appended. */
  basePath: string;
  variant: PalSurfaceVariant;
  selectModules: (model: PalContentModelResponse) => Record<string, PalModuleView>;
}

export default async function PalTaxonomyDetailPage({
  slug,
  searchParams,
  meta,
  emptyTitle,
  eyebrow,
  description,
  basePath,
  variant,
  selectModules,
}: TaxonomyDetailPageProps) {
  // An unknown slug is a 404 before anything is loaded — a taxonomy's slug map
  // is the definition of which detail routes exist.
  if (!(slug in meta)) notFound();

  const queryString = queryStringFromSearchParams(searchParams);
  const backHref = queryString ? `${basePath}?${queryString}` : basePath;

  const model = await getPalContentModel({
    chapterId: firstValue(searchParams.chapterId),
    concept: firstValue(searchParams.concept),
  });

  if (!model.isReady || !model.context) {
    return (
      <PalEmptyState
        title={emptyTitle}
        message={model.error || 'No semantic intelligence is available for PAL yet.'}
        backHref={backHref}
      />
    );
  }

  const selectedModule = selectModules(model)[slug];

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

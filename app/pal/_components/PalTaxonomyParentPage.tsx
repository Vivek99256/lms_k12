import {
  PalContextHero,
  PalEmptyState,
  PalModuleGrid,
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
 * The parent (index) page shared by PAL's taxonomy routes.
 *
 * /pal/frameworks and /pal/ulu were byte-for-byte identical apart from six
 * values: the empty-state title, which slice of the content model to list, the
 * hero's eyebrow/title/description, the grid's basePath, and the styling
 * variant. Both read the same `semantic_intelligence` payload through the same
 * loader and render the same three components in the same wrapper.
 *
 * Keeping two copies meant every change to the context-loading behaviour had
 * to be made twice, and the two had already drifted — their descriptions
 * described the same mechanism in different words.
 */

export interface TaxonomyParentPageProps {
  searchParams: RouteSearchParams;
  /** Shown when no semantic intelligence is available for this taxonomy. */
  emptyTitle: string;
  eyebrow: string;
  title: string;
  description: string;
  /** Prefix each module card links under, e.g. `/pal/ulu`. */
  basePath: string;
  /** Styling variant understood by PalContextHero and PalModuleGrid. */
  variant: PalSurfaceVariant;
  /** Which slice of the loaded model this taxonomy lists. */
  selectModules: (model: PalContentModelResponse) => Record<string, PalModuleView>;
}

export default async function PalTaxonomyParentPage({
  searchParams,
  emptyTitle,
  eyebrow,
  title,
  description,
  basePath,
  variant,
  selectModules,
}: TaxonomyParentPageProps) {
  const queryString = queryStringFromSearchParams(searchParams);
  const chapterId = firstValue(searchParams.chapterId);
  const concept = firstValue(searchParams.concept);

  const model = await getPalContentModel({ chapterId, concept });

  if (!model.isReady || !model.context) {
    return (
      <PalEmptyState
        title={emptyTitle}
        message={model.error || 'No semantic intelligence is available for PAL yet.'}
      />
    );
  }

  const modules = Object.values(selectModules(model));

  return (
    <div className="min-h-full px-4 py-5 sm:px-6">
      <div className="mx-auto w-full max-w-[1800px] space-y-6">
        <PalContextHero
          eyebrow={eyebrow}
          title={title}
          description={description}
          context={model.context}
          variant={variant}
        />
        <PalModuleGrid
          modules={modules}
          basePath={basePath}
          queryString={queryString}
          variant={variant}
        />
      </div>
    </div>
  );
}

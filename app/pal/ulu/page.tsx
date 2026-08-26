import { PalContextHero, PalEmptyState, PalModuleGrid } from '@/app/pal/_components/PalContentView';
import { getPalContentModel } from '@/app/pal/data/pal-content-model';

function queryStringFromSearchParams(searchParams: Record<string, string | string[] | undefined>) {
  const query = new URLSearchParams();
  Object.entries(searchParams).forEach(([key, value]) => {
    if (Array.isArray(value)) {
      value.forEach((entry) => {
        if (entry) query.append(key, entry);
      });
      return;
    }
    if (value) query.set(key, value);
  });
  return query.toString();
}

export default async function PalUluParentPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const resolvedSearchParams = await searchParams;
  const queryString = queryStringFromSearchParams(resolvedSearchParams);
  const chapterId = Array.isArray(resolvedSearchParams.chapterId)
    ? resolvedSearchParams.chapterId[0]
    : resolvedSearchParams.chapterId;
  const concept = Array.isArray(resolvedSearchParams.concept)
    ? resolvedSearchParams.concept[0]
    : resolvedSearchParams.concept;

  const model = await getPalContentModel({ chapterId, concept });

  if (!model.isReady || !model.context) {
    return (
      <PalEmptyState
        title="Unified Learning Units intelligence is not available"
        message={model.error || 'No semantic intelligence is available for PAL yet.'}
      />
    );
  }

  const modules = Object.values(model.uluModules);

  return (
    <div className="min-h-full px-4 py-5 sm:px-6">
      <div className="mx-auto w-full max-w-[1800px] space-y-6">
        <PalContextHero
          eyebrow="Unified Learning Units"
          title="Unified Learning Units"
          description="This Unified Learning Units view is dynamically assembled from semantic_intelligence. When no chapter is selected, PAL automatically loads the latest available semantic record."
          context={model.context}
          variant="ulu"
        />
        <PalModuleGrid modules={modules} basePath="/pal/ulu" queryString={queryString} variant="ulu" />
      </div>
    </div>
  );
}

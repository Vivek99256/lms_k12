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

export default async function PalFrameworkParentPage({
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
        title="Framework intelligence is not available"
        message={model.error || 'No semantic intelligence is available for PAL yet.'}
      />
    );
  }

  const modules = Object.values(model.frameworkModules);

  return (
    <div className="min-h-full px-4 py-5 sm:px-6">
      <div className="mx-auto w-full max-w-[1800px] space-y-6">
        <PalContextHero
          eyebrow="Framework"
          title="Framework"
          description="This Framework view is dynamically derived from the same semantic_intelligence payload used by Concept Intelligence. When no chapter is selected, PAL automatically loads the latest available semantic record."
          context={model.context}
          variant="framework"
        />
        <PalModuleGrid modules={modules} basePath="/pal/frameworks" queryString={queryString} variant="framework" />
      </div>
    </div>
  );
}

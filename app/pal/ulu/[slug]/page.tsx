import { notFound } from 'next/navigation';
import { PalContextHero, PalEmptyState, PalModuleDetail } from '@/app/pal/_components/PalContentView';
import { getPalContentModel, type UluSlug, ULU_META } from '@/app/pal/data/pal-content-model';

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

export default async function UluDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { slug } = await params;
  if (!(slug in ULU_META)) notFound();

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
        title="ULU intelligence is not available"
        message={model.error || 'No semantic intelligence is available for PAL yet.'}
        backHref={queryString ? `/pal/ulu?${queryString}` : '/pal/ulu'}
      />
    );
  }

  const selectedModule = model.uluModules[slug as UluSlug];
  if (!selectedModule) notFound();

  return (
    <div className="min-h-full px-4 py-5 sm:px-6">
      <div className="mx-auto w-full max-w-[1800px] space-y-6">
        <PalContextHero
          eyebrow="ULU"
          title={selectedModule.title}
          description="This ULU detail page is assembled from live semantic_intelligence data for the selected concept."
          context={model.context}
          variant="ulu"
        />
        <PalModuleDetail module={selectedModule} backHref={queryString ? `/pal/ulu?${queryString}` : '/pal/ulu'} variant="ulu" />
      </div>
    </div>
  );
}

import PalTaxonomyDetailPage from '@/app/pal/_components/PalTaxonomyDetailPage';
import { ULU_META } from '@/app/pal/data/pal-content-model';

export default async function UluDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { slug } = await params;

  return (
    <PalTaxonomyDetailPage
      slug={slug}
      searchParams={await searchParams}
      meta={ULU_META}
      emptyTitle="Unified Learning Units intelligence is not available"
      eyebrow="Unified Learning Units"
      description="This Unified Learning Units detail page is assembled from live semantic_intelligence data for the selected concept."
      basePath="/pal/ulu"
      variant="ulu"
      selectModules={(model) => model.uluModules}
    />
  );
}

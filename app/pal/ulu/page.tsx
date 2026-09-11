import PalTaxonomyParentPage from '@/app/pal/_components/PalTaxonomyParentPage';

export default async function PalUluParentPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  return (
    <PalTaxonomyParentPage
      searchParams={await searchParams}
      emptyTitle="Unified Learning Units intelligence is not available"
      eyebrow="Unified Learning Units"
      title="Unified Learning Units"
      description="This Unified Learning Units view is dynamically assembled from semantic_intelligence. When no chapter is selected, PAL automatically loads the latest available semantic record."
      basePath="/pal/ulu"
      variant="ulu"
      selectModules={(model) => model.uluModules}
    />
  );
}

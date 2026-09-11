import PalTaxonomyParentPage from '@/app/pal/_components/PalTaxonomyParentPage';

export default async function PalFrameworkParentPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  return (
    <PalTaxonomyParentPage
      searchParams={await searchParams}
      emptyTitle="Framework intelligence is not available"
      eyebrow="Framework"
      title="Framework"
      description="This Framework view is dynamically derived from the same semantic_intelligence payload used by Concept Intelligence. When no chapter is selected, PAL automatically loads the latest available semantic record."
      basePath="/pal/frameworks"
      variant="framework"
      selectModules={(model) => model.frameworkModules}
    />
  );
}

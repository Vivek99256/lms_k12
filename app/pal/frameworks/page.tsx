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
      description="This view is built from the chapter’s concepts and skills. When no chapter is selected, PAL loads the latest available chapter."
      basePath="/pal/frameworks"
      variant="framework"
      selectModules={(model) => model.frameworkModules}
    />
  );
}

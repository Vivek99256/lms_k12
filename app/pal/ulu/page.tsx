import PalTaxonomyParentPage from '@/app/pal/_components/PalTaxonomyParentPage';

export default async function PalUluParentPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  return (
    <PalTaxonomyParentPage
      searchParams={await searchParams}
      emptyTitle="Learning units aren’t available"
      eyebrow="Learning units"
      title="Learning units"
      description="This view is built from the chapter’s concepts and skills. When no chapter is selected, PAL loads the latest available chapter."
      basePath="/pal/ulu"
      variant="ulu"
      selectModules={(model) => model.uluModules}
    />
  );
}

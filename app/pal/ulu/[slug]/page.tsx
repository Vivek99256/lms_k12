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
      emptyTitle="Learning units aren’t available"
      eyebrow="Learning units"
      description="This view is built from the selected concept’s concepts and skills."
      basePath="/pal/ulu"
      variant="ulu"
      selectModules={(model) => model.uluModules}
    />
  );
}

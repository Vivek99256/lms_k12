import PalTaxonomyDetailPage from '@/app/pal/_components/PalTaxonomyDetailPage';
import { FRAMEWORK_META } from '@/app/pal/data/pal-content-model';

export default async function FrameworkDetailPage({
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
      meta={FRAMEWORK_META}
      emptyTitle="Framework intelligence is not available"
      eyebrow="Framework"
      description="This view is built from the selected concept’s concepts and skills."
      basePath="/pal/frameworks"
      variant="framework"
      selectModules={(model) => model.frameworkModules}
    />
  );
}

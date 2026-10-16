import { notFound } from 'next/navigation';
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
  if (!(slug in FRAMEWORK_META)) notFound();

  return (
    <PalTaxonomyDetailPage
      slug={slug}
      searchParams={await searchParams}
      emptyTitle="Framework intelligence is not available"
      eyebrow="Framework"
      description="This view is built from the selected concept’s concepts and skills."
      basePath="/pal/frameworks"
      variant="framework"
    />
  );
}

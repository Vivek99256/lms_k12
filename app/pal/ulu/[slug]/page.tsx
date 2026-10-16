import { notFound } from 'next/navigation';
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
  if (!(slug in ULU_META)) notFound();

  return (
    <PalTaxonomyDetailPage
      slug={slug}
      searchParams={await searchParams}
      emptyTitle="Learning units aren’t available"
      eyebrow="Learning units"
      description="This view is built from the selected concept’s concepts and skills."
      basePath="/pal/ulu"
      variant="ulu"
    />
  );
}

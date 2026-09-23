import { TeachLearnCategoryPage } from '@/app/teach-learn/_components/teach-learn-category-page';

export default async function Page({
  params,
}: {
  params: Promise<{ categoryKey: string }>;
}) {
  const { categoryKey } = await params;
  return <TeachLearnCategoryPage categoryKey={categoryKey} />;
}

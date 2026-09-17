import { ModuleCategoryPage } from '@/app/_components/module-category-page';

export default async function Page({
  params,
}: {
  params: Promise<{ categoryKey: string }>;
}) {
  const { categoryKey } = await params;
  return <ModuleCategoryPage moduleName="teach_learn" categoryKey={categoryKey} />;
}

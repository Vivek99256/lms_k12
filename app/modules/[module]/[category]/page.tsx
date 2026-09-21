import { ModuleCategoryPage } from '@/app/modules/_components/module-category-page';

/**
 * `/modules/<module-slug>/<category>` — one module category's page.
 *
 * Both segments are database values: `fees_menu_categories.module_name` and
 * `.category_key`, whose own `route` column spells this exact path for all 64
 * configured modules. Nothing is hardcoded here and no list of modules or
 * categories exists in the frontend — an unknown pair resolves to nothing and
 * says so.
 *
 * `/modules/<slug>/intelligence` is answered by its own static route next to
 * this one, which Next resolves first.
 */
export default async function Page({
  params,
}: {
  params: Promise<{ module: string; category: string }>;
}) {
  const { module, category } = await params;
  return <ModuleCategoryPage moduleSlug={module} categoryKey={category} />;
}

'use client';

import { ModuleCategoryPage } from '@/app/_components/module-category-page';

/**
 * Teach/Learn → ai-stack. One of the ten Teach/Learn category pages; all ten
 * share ModuleCategoryPage and differ only by which category they render.
 */
export default function Page() {
  return <ModuleCategoryPage moduleName="teach_learn" categoryKey="ai-stack" />;
}

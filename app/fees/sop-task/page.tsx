'use client';

import { ModuleCategoryPage } from '@/app/_components/module-category-page';

/**
 * Fees → sop-task. One of the seven Fees category pages; all seven share
 * ModuleCategoryPage and differ only by which category they render.
 */
export default function Page() {
  return <ModuleCategoryPage moduleName="fees" categoryKey="sop-task" />;
}

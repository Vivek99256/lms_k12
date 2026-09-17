'use client';

import { ModuleCategoryPage } from '@/app/_components/module-category-page';

/**
 * Fees → operations (formerly "Transactional Data"). One of the Fees category
 * pages; all of them share ModuleCategoryPage and differ only by which category
 * they render.
 */
export default function Page() {
  return <ModuleCategoryPage moduleName="fees" categoryKey="operations" />;
}

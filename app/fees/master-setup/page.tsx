'use client';

import { ModuleCategoryPage } from '@/app/_components/module-category-page';

/**
 * Fees → master-setup. One of the seven Fees category pages; all seven share
 * ModuleCategoryPage and differ only by which category they render.
 */
export default function Page() {
  return <ModuleCategoryPage moduleName="fees" categoryKey="master-setup" />;
}

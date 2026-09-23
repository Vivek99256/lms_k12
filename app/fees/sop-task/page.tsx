'use client';

import { FeesCategoryPage } from '@/app/fees/_components/fees-category-page';

/**
 * Fees → sop-task. One of the seven Fees category pages; all seven share
 * FeesCategoryPage and differ only by which category they render.
 */
export default function Page() {
  return <FeesCategoryPage categoryKey="sop-task" />;
}

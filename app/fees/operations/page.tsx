'use client';

import { FeesCategoryPage } from '@/app/fees/_components/fees-category-page';

/**
 * Fees → operations (formerly "Transactional Data"). One of the Fees category
 * pages; all of them share FeesCategoryPage and differ only by which category
 * they render.
 */
export default function Page() {
  return <FeesCategoryPage categoryKey="operations" />;
}

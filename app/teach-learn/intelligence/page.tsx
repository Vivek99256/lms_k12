'use client';

import { TeachLearnCategoryPage } from '@/app/teach-learn/_components/teach-learn-category-page';

/**
 * Teach/Learn → intelligence. One of the ten Teach/Learn category pages; all ten
 * share TeachLearnCategoryPage and differ only by which category they render.
 */
export default function Page() {
  return <TeachLearnCategoryPage categoryKey="intelligence" />;
}

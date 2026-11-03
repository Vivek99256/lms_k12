'use client';

import { ModuleCategoryPage } from '@/app/_components/module-category-page';

/**
 * Admissions → Scheduler (standard English spelling).
 */
export default function Page() {
  return (
    <ModuleCategoryPage
      moduleName="admission"
      categoryKey="schedular"
      platformModuleKey="admissions"
    />
  );
}


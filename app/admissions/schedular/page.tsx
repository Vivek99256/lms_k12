'use client';

import { ModuleCategoryPage } from '@/app/_components/module-category-page';

/**
 * Admissions → Schedular.
 *
 * Mounts the Platform Scheduler console scoped to admissions ('admissions'),
 * enabling admissions counsellors and administrators to monitor and adjust
 * recurring tasks (enquiry follow-up scans, registration reviews, and seat syncs).
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


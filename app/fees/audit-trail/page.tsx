'use client';

import { ModuleCategoryPage } from '@/app/_components/module-category-page';

/**
 * Fees → Audit trail.
 *
 * The screen itself moved to app/_components/module-audit-trail.tsx and is now
 * supplied by ModuleCategoryPage as this category's Activity tab, so all 64
 * bars show one implementation instead of this page being copied per module.
 * Which access-log rows it shows comes from the category row's prefixes.
 *
 * 'fees' is the fallback for an installation that has not yet run the migration
 * that fills `audit_module_keys`; it is the literal this page used to hardcode.
 */
export default function Page() {
  return (
    <ModuleCategoryPage
      moduleName="fees"
      categoryKey="audit-trail"
      auditModuleKeys={['fees']}
    />
  );
}

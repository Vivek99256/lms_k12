'use client';

import { ModuleCategoryPage } from '@/app/_components/module-category-page';

/**
 * Fees → Workflow. Shares ModuleCategoryPage with the other Fees categories,
 * which now supplies the Approvals tab itself — the central workflow console
 * scoped to the module named by the category row — so Fees and the other 63
 * bars show one screen rather than one per module. Any real menu the user has
 * rights to still comes from the database and follows it.
 *
 * 'fees' is the fallback for an installation that has not yet run the migration
 * that fills `platform_module_key`; it is the key this page used to hardcode.
 */
export default function Page() {
  return <ModuleCategoryPage moduleName="fees" categoryKey="workflow" platformModuleKey="fees" />;
}

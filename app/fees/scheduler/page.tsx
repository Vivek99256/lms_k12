'use client';

import { ModuleCategoryPage } from '@/app/_components/module-category-page';

/**
 * Fees → Schedular. The twin of Fees → Workflow beside it: ModuleCategoryPage
 * supplies the Scheduled tasks tab — the central scheduler console scoped to the
 * module named by the category row — so every module's Schedular menu shows one
 * screen rather than one per module. Any real menu the user has rights to still
 * comes from the database and follows it.
 *
 * The category key is the menu data's spelling, 'schedular'; this route keeps
 * the spelling it shipped with. 'fees' is the fallback for an installation that
 * has not yet run the migration that fills `platform_module_key`.
 */
export default function Page() {
  return <ModuleCategoryPage moduleName="fees" categoryKey="schedular" platformModuleKey="fees" />;
}

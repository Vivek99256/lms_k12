'use client';

import { ModuleCategoryPage } from '@/app/_components/module-category-page';

/**
 * Fees → Process Builder.
 *
 * Not a tab strip over Fees menus: building a process is the same SOP → Process,
 * Workflow and Tasks converter everywhere, already built and backed by real data
 * under /general/add_process. ModuleCategoryPage now renders that screen for
 * every module's Process Builder category, so this route goes through it rather
 * than mounting the converter itself — one implementation, 64 bars.
 *
 * It still opens on the Fees module, because that is the module the person
 * navigated through to get here; the key comes from the category row, with
 * 'fees' as the fallback this page used to hardcode. The Module dropdown still
 * offers every registered module (`lib/process/module-registry.ts`) — arriving
 * from Fees sets the default, it does not restrict the list.
 */
export default function Page() {
  return (
    <ModuleCategoryPage moduleName="fees" categoryKey="process-builder" platformModuleKey="fees" />
  );
}

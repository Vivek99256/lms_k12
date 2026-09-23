'use client';

import { ModuleIntelligence } from '@/components/intelligence/module';
import { teachLearnIntelligenceContract } from '@/components/intelligence/module/contracts/teach-learn';

/**
 * Teach/Learn → Intelligence.
 *
 * This route is what `fees_menu_categories` already points the module's
 * Intelligence category at (`module_name = 'teach_learn'`, row 16), so the
 * address is unchanged — only what it renders is. It used to mount
 * `TeachLearnCategoryPage`, a tab bar over whatever level-3 menus a tenant had
 * filed under "Intelligence"; Teach/Learn has none, so the category rendered
 * empty and the module appeared to have no Intelligence at all.
 *
 * The other nine Teach/Learn category pages still share
 * `TeachLearnCategoryPage` and are untouched.
 */
export default function Page() {
  return <ModuleIntelligence contract={teachLearnIntelligenceContract} />;
}

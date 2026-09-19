'use client';

import { ModuleCategoryPage, type ModuleStaticScreen } from '@/app/_components/module-category-page';
import { ATTENDANCE_AI_STACK_SCREENS } from '@/app/attendance/ai-stack/_screens/ai-stack-screens';

/**
 * The built screens a module's category page renders inline, for the modules that have
 * some.
 *
 * WHY THIS EXISTS
 *
 * `/modules/[moduleKey]/[categoryKey]` serves the 62 seeded modules from one route, and
 * it is a server component. A static screen is a `render: () => ReactNode` closure, which
 * cannot cross the server/client boundary as a prop — so the dynamic route delegates to
 * this client component, which looks the screens up by module and category.
 *
 * FEES AND TEACH/LEARN ARE NOT IN HERE, AND SHOULD NOT BE. They predate this route and
 * keep their own pages under `/fees/…` and `/teach-learn/…`, passing their screens to
 * `ModuleCategoryPage` directly. The seeded `route` column is what points each module's
 * bar at the right place, so both conventions coexist. Folding a working module into this
 * table would be a change to a working module for no gain.
 *
 * A MODULE ABSENT FROM THIS TABLE BEHAVES EXACTLY AS IT DID BEFORE: no static tabs, and
 * the category's database menus alone. Adding a module here is additive by construction.
 */
const STATIC_SCREENS: Record<string, ModuleStaticScreen[]> = {
  'attendance:ai-stack': ATTENDANCE_AI_STACK_SCREENS,
};

export function ModuleCategoryRoute({
  moduleKey,
  categoryKey,
}: {
  moduleKey: string;
  categoryKey: string;
}) {
  const screens = STATIC_SCREENS[`${moduleKey}:${categoryKey}`];

  return (
    <ModuleCategoryPage
      moduleName={moduleKey}
      categoryKey={categoryKey}
      staticScreens={screens}
      // 'before' is the default and is right here: the AI Stack category has no database
      // menus of its own, so these tabs are what the category opens on. A category that
      // did have menus would need 'after', or a static tab would quietly take over its
      // landing screen.
    />
  );
}

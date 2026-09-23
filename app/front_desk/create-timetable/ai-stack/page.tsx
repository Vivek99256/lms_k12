'use client';

import { ModuleCategoryPage } from '@/app/modules/_components/module-category-page';
import { TIMETABLE_AI_STACK_SCREENS } from '@/app/front_desk/create-timetable/ai-stack/_screens/ai-stack-screens';

/**
 * Time Table -> ai-stack, at the module's own route.
 *
 * The seeded menu row points at `/modules/timetable/ai-stack`, which serves the same tabs
 * through the shared dynamic route. This page exists so the direct path works too, and it
 * renders the identical screen list - there is no second AI Stack to keep in step.
 *
 * It sits beside the timetable builder at `/front_desk/create-timetable`, which is where
 * `routeMapper` sends `timetable.index`. That path is more specific than the front_desk
 * module's `/front_desk/**`, so it resolves here without front_desk losing anything.
 *
 * The module's other two level-3 menus - Assign Class Teacher and Proxy Management - point
 * at `/classteacher` and `/proxy_master`, which belong to the classteacher and proxy
 * modules. Neither is claimed by this route.
 *
 * `moduleSlug="timetable"` is the MENU slug and the AI module key is also `timetable`.
 */
export default function Page() {
  return (
    <ModuleCategoryPage
      moduleSlug="timetable"
      categoryKey="ai-stack"
      staticScreens={TIMETABLE_AI_STACK_SCREENS}
    />
  );
}

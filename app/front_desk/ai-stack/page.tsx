'use client';

import { ModuleCategoryPage } from '@/app/modules/_components/module-category-page';
import { FRONT_DESK_AI_STACK_SCREENS } from '@/app/front_desk/ai-stack/_screens/ai-stack-screens';

/**
 * Front Desk -> ai-stack, at the module's own route.
 *
 * The seeded menu row points at `/modules/front-desk/ai-stack`, which serves the same tabs
 * through the shared dynamic route. This page exists so the direct path works too, and it
 * renders the identical screen list - there is no second AI Stack to keep in step.
 *
 * It sits at the head of the front_desk tree, which the module's own row already claims as
 * `/front_desk/**`.
 *
 * Two pages inside that tree belong to other modules and are NOT affected:
 * `/front_desk/circular` is the Circular module's and `/front_desk/create-timetable` is
 * Time Table's, both registered earlier with literal patterns that already beat this
 * module's wildcard. `RouteMatcher` scores a literal segment above a wildcard, so each
 * keeps its own page.
 *
 * `moduleSlug="front-desk"` is the MENU slug; the AI module key is `front_desk`.
 */
export default function Page() {
  return (
    <ModuleCategoryPage
      moduleSlug="front-desk"
      categoryKey="ai-stack"
      staticScreens={FRONT_DESK_AI_STACK_SCREENS}
    />
  );
}

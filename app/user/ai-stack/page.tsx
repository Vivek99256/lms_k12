'use client';

import { ModuleCategoryPage } from '@/app/_components/module-category-page';
import { USERS_AI_STACK_SCREENS } from '@/app/user/ai-stack/_screens/ai-stack-screens';

/**
 * Users -> ai-stack, at the module's own route.
 *
 * The seeded menu row points at `/modules/user/ai-stack`, which serves the same tabs
 * through the shared dynamic route. This page exists so the direct path works too, and it
 * renders the identical screen list - there is no second AI Stack to keep in step.
 *
 * It sits beside the user screens at `/user`, which the module's own row already claims as
 * `/user/**`.
 *
 * `/student/user_icard` next door belongs to the SEPARATE User I-Card module and is not
 * claimed here. Both read `tbluser`; this one reads the ACCOUNT fields and that one the
 * fields an identity card prints.
 *
 * `moduleName="user"` is the MENU slug and the AI module key is also `user`.
 */
export default function Page() {
  return (
    <ModuleCategoryPage
      moduleName="user"
      categoryKey="ai-stack"
      staticScreens={USERS_AI_STACK_SCREENS}
    />
  );
}

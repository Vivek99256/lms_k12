'use client';

import { ModuleCategoryPage } from '@/app/modules/_components/module-category-page';
import { DOCUMENT_TEMPLATES_AI_STACK_SCREENS } from '@/app/document-templates/ai-stack/_screens/ai-stack-screens';

/**
 * Document Templates -> ai-stack, at the module's own route.
 *
 * The seeded menu row points at `/modules/document-templates/ai-stack`, which serves the same tabs
 * through the shared dynamic route. This page exists so the direct path works too, and it
 * renders the identical screen list - there is no second AI Stack to keep in step.
 *
 * It sits beside the template editor at `/document-templates`, which the module's own row
 * already claims as `/document-templates/**`.
 *
 * `moduleSlug="document-templates"` is the MENU slug and the AI module key is the same
 * string - hyphen and all, because that is how `ai_modules` has spelled it since the
 * workspace was seeded. Everything downstream builds from the key verbatim.
 */
export default function Page() {
  return (
    <ModuleCategoryPage
      moduleSlug="document-templates"
      categoryKey="ai-stack"
      staticScreens={DOCUMENT_TEMPLATES_AI_STACK_SCREENS}
    />
  );
}

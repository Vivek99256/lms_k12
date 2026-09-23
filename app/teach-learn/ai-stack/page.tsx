'use client';

import { TeachLearnCategoryPage } from '@/app/teach-learn/_components/teach-learn-category-page';
import { TEACH_LEARN_AI_STACK_SCREENS } from '@/app/teach-learn/ai-stack/_screens/ai-stack-screens';

/**
 * Teach/Learn → ai-stack. One of the ten Teach/Learn category pages; all ten
 * share TeachLearnCategoryPage and differ only by which category they render.
 *
 * `moduleSlug="teach_learn"` is the MENU slug, which is what `ModuleCategoryPage` looks
 * the category up by. The AI module key is also `teach_learn`, and it is never typed into
 * a screen: every screen takes it from the descriptor in
 * `lib/teach-learn/teach-learn-ai-stack.ts`.
 */
export default function Page() {
  return <TeachLearnCategoryPage categoryKey="ai-stack" staticScreens={TEACH_LEARN_AI_STACK_SCREENS} />;
}

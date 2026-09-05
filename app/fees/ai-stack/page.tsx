'use client';

import { FeesCategoryPage } from '@/app/fees/_components/fees-category-page';
import { FEES_AI_STACK_SCREENS } from '@/app/fees/ai-stack/_screens/ai-stack-screens';

/**
 * Fees → ai-stack. Shares FeesCategoryPage with the other Fees categories and
 * supplies its own tabs, which are static placeholders until these screens are
 * built. Any real menu the user has rights to still comes from the database and
 * follows them.
 */
export default function Page() {
  return <FeesCategoryPage categoryKey="ai-stack" staticScreens={FEES_AI_STACK_SCREENS} />;
}

'use client';

import type { ModuleStaticScreen } from '@/app/modules/_components/module-category-page';
import { buildAiStackScreens } from '@/app/_components/ai-stack/build-ai-stack-screens';
import { LIBRARY_AI_STACK } from '@/lib/library/library-ai-stack';

/**
 * Library -> AI Stack tabs.
 *
 * The AI services and automation behind the Library module. This is the plumbing view -
 * what the module runs on - as distinct from Intelligence, which is what that plumbing
 * produces. Nothing here touches the separate AI Administration module.
 *
 * ALL NINE TABS ARE LIVE, AND ALL NINE ARE LIBRARY-ONLY.
 *
 * One catalogue row is a TITLE and not a book on the shelf - this estate holds 35,663
 * titles and a different number of physical copies - so every tab reports the copy count
 * beside the title and never presents one as the other.
 *
 * Overdue is exact: a loan out past a recorded due date. A loan with no due date is
 * undated and is excluded. No fine, reservation or renewal is recorded anywhere, so no tab
 * states what a borrower owes, and none describes a named child as unreliable.
 *
 * The list is built from one shared implementation and the Library descriptor; see
 * `app/_components/ai-stack/build-ai-stack-screens.tsx` for what each tab reads and why
 * none of them duplicates another.
 */
export const LIBRARY_AI_STACK_SCREENS: ModuleStaticScreen[] = buildAiStackScreens(LIBRARY_AI_STACK);

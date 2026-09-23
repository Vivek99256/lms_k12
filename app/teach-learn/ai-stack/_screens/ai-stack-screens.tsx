'use client';

import type { ModuleStaticScreen } from '@/app/modules/_components/module-category-page';
import { buildAiStackScreens } from '@/app/_components/ai-stack/build-ai-stack-screens';
import { TEACH_LEARN_AI_STACK } from '@/lib/teach-learn/teach-learn-ai-stack';

/**
 * Teach/Learn -> AI Stack tabs.
 *
 * ALL NINE TABS ARE LIVE, AND ALL NINE ARE TEACH/LEARN-ONLY. The list is built from one
 * shared implementation and the Teach/Learn descriptor; see
 * `app/_components/ai-stack/build-ai-stack-screens.tsx` for what each tab reads and why
 * none of them duplicates another.
 */
export const TEACH_LEARN_AI_STACK_SCREENS: ModuleStaticScreen[] = buildAiStackScreens(TEACH_LEARN_AI_STACK);

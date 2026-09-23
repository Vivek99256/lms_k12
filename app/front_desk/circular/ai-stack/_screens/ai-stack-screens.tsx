'use client';

import type { ModuleStaticScreen } from '@/app/_components/module-category-page';
import { buildAiStackScreens } from '@/app/_components/ai-stack/build-ai-stack-screens';
import { CIRCULAR_AI_STACK } from '@/lib/circulars/circulars-ai-stack';

/**
 * Circular -> AI Stack tabs.
 *
 * The AI services and automation behind the Circular module. This is the plumbing view -
 * what the module runs on - as distinct from Intelligence, which is what that plumbing
 * produces. Nothing here touches the separate AI Administration module.
 *
 * ALL NINE TABS ARE LIVE, AND ALL NINE ARE CIRCULAR-ONLY. The list is built from one
 * shared implementation and the Circular descriptor; see
 * `app/_components/ai-stack/build-ai-stack-screens.tsx` for what each tab reads and why
 * none of them duplicates another.
 */
export const CIRCULAR_AI_STACK_SCREENS: ModuleStaticScreen[] = buildAiStackScreens(CIRCULAR_AI_STACK);

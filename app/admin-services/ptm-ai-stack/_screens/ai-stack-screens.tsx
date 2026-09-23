'use client';

import type { ModuleStaticScreen } from '@/app/_components/module-category-page';
import { buildAiStackScreens } from '@/app/_components/ai-stack/build-ai-stack-screens';
import { PTM_AI_STACK } from '@/lib/ptm/ptm-ai-stack';

/**
 * PTM -> AI Stack tabs.
 *
 * The AI services and automation behind the PTM module. This is the plumbing view - what
 * the module runs on - as distinct from Intelligence, which is what that plumbing
 * produces. Nothing here touches the separate AI Administration module.
 *
 * ALL NINE TABS ARE LIVE, AND ALL NINE ARE PTM-ONLY. The list is built from one shared
 * implementation and the PTM descriptor; see
 * `app/_components/ai-stack/build-ai-stack-screens.tsx` for what each tab reads and why
 * none of them duplicates another.
 */
export const PTM_AI_STACK_SCREENS: ModuleStaticScreen[] = buildAiStackScreens(PTM_AI_STACK);

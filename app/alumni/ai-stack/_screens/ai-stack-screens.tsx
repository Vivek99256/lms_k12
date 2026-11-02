'use client';

import type { ModuleStaticScreen } from '@/app/modules/_components/module-category-page';
import { buildAiStackScreens } from '@/app/_components/ai-stack/build-ai-stack-screens';
import { ALUMNI_AI_STACK } from '@/lib/alumni/alumni-ai-stack';

/**
 * Alumni Management -> AI Stack tabs.
 *
 * The AI services and automation behind the Alumni module. This is the plumbing view -
 * what the module runs on - as distinct from Intelligence, which is what that plumbing
 * produces. Nothing here touches the separate AI Administration module.
 *
 * ALL NINE TABS ARE LIVE, AND ALL NINE ARE ALUMNI-ONLY.
 *
 * Every tab keeps a blank employment or employer as "not recorded", never as unemployed,
 * and none of them can show a contact detail: the Alumni read tools withhold them.
 *
 * The list is built from one shared implementation and the Alumni descriptor; see
 * `app/_components/ai-stack/build-ai-stack-screens.tsx` for what each tab reads and why
 * none of them duplicates another.
 */
export const ALUMNI_AI_STACK_SCREENS: ModuleStaticScreen[] = buildAiStackScreens(ALUMNI_AI_STACK);

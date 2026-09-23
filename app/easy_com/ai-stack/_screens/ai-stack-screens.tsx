'use client';

import type { ModuleStaticScreen } from '@/app/_components/module-category-page';
import { buildAiStackScreens } from '@/app/_components/ai-stack/build-ai-stack-screens';
import { COMMUNICATION_AI_STACK } from '@/lib/communication/communication-ai-stack';

/**
 * Communication -> AI Stack tabs.
 *
 * The AI services and automation behind the Communication module. This is the plumbing view -
 * what the module runs on - as distinct from Intelligence, which is what that plumbing
 * produces. Nothing here touches the separate AI Administration module.
 *
 * ALL NINE TABS ARE LIVE, AND ALL NINE ARE COMMUNICATION-ONLY.
 *
 * Only WhatsApp records a delivery outcome. No tab here reports reach, receipt or an open
 * rate for SMS or app notifications, because none is recorded.
 *
 * The list is built from one shared implementation and the Communication descriptor; see
 * `app/_components/ai-stack/build-ai-stack-screens.tsx` for what each tab reads and why
 * none of them duplicates another.
 */
export const COMMUNICATION_AI_STACK_SCREENS: ModuleStaticScreen[] = buildAiStackScreens(COMMUNICATION_AI_STACK);

'use client';

import type { ModuleStaticScreen } from '@/app/_components/module-category-page';
import { buildAiStackScreens } from '@/app/_components/ai-stack/build-ai-stack-screens';
import { PARENT_COMMUNICATION_AI_STACK } from '@/lib/parent-communication/parent-communication-ai-stack';

/**
 * Parent Communication -> AI Stack tabs.
 *
 * The AI services and automation behind the Parent Communication module. This is the plumbing view -
 * what the module runs on - as distinct from Intelligence, which is what that plumbing
 * produces. Nothing here touches the separate AI Administration module.
 *
 * ALL NINE TABS ARE LIVE, AND ALL NINE ARE PARENT COMMUNICATION-ONLY.
 *
 * This is the INBOUND direction - what parents wrote to the school. The Communication
 * module records what the school sends, is a different table, and is read by no tab here;
 * no tab gives one total for both.
 *
 * A message with no reply means nobody has answered it yet, never that the school refused.
 * And a read covering more than one family gets no message bodies at all: the service does
 * not select the column unless the read names one student or one message.
 *
 * The list is built from one shared implementation and the Parent Communication descriptor; see
 * `app/_components/ai-stack/build-ai-stack-screens.tsx` for what each tab reads and why
 * none of them duplicates another.
 */
export const PARENT_COMMUNICATION_AI_STACK_SCREENS: ModuleStaticScreen[] = buildAiStackScreens(PARENT_COMMUNICATION_AI_STACK);

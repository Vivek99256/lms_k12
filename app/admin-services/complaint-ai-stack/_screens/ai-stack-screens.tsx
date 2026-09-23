'use client';

import type { ModuleStaticScreen } from '@/app/_components/module-category-page';
import { buildAiStackScreens } from '@/app/_components/ai-stack/build-ai-stack-screens';
import { COMPLAINT_AI_STACK } from '@/lib/complaint/complaint-ai-stack';

/**
 * Complaint -> AI Stack tabs.
 *
 * The AI services and automation behind the Complaint module. This is the plumbing view -
 * what the module runs on - as distinct from Intelligence, which is what that plumbing
 * produces. Nothing here touches the separate AI Administration module.
 *
 * ALL NINE TABS ARE LIVE, AND ALL NINE ARE COMPLAINT-ONLY.
 *
 * No tab reports how a complaint was resolved, because nothing records it. The column
 * named COMPLAINT_SOLUTION is the status field - it holds the words PENDING and COMPLETE
 * and nothing else - so the tabs report a status and say plainly that no resolution text
 * exists.
 *
 * No tab ranks a complaint or calls one urgent either. This table records no priority, no
 * severity, no due date, no SLA and no escalation of any kind.
 *
 * The list is built from one shared implementation and the Complaint descriptor; see
 * `app/_components/ai-stack/build-ai-stack-screens.tsx` for what each tab reads and why
 * none of them duplicates another.
 */
export const COMPLAINT_AI_STACK_SCREENS: ModuleStaticScreen[] = buildAiStackScreens(COMPLAINT_AI_STACK);

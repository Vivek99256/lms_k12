'use client';

import type { ModuleStaticScreen } from '@/app/_components/module-category-page';
import { buildAiStackScreens } from '@/app/_components/ai-stack/build-ai-stack-screens';
import { VISITOR_AI_STACK } from '@/lib/visitor/visitor-ai-stack';

/**
 * Visitor Management -> AI Stack tabs.
 *
 * The AI services and automation behind the Visitor Management module. This is the plumbing view -
 * what the module runs on - as distinct from Intelligence, which is what that plumbing
 * produces. Nothing here touches the separate AI Administration module.
 *
 * ALL NINE TABS ARE LIVE, AND ALL NINE ARE VISITOR-ONLY.
 *
 * Every tab keeps three states apart: an exit was recorded, an entry was recorded and no
 * exit was, or no entry was recorded at all. No tab presents the middle state as somebody
 * being in the building - on one live institute 205 of 463 visits have no exit time, most
 * from days long past.
 *
 * The register records no approval of any kind, so nothing here is pending approval. The
 * Hostel module's separate visitor register is not read by any tab.
 *
 * The list is built from one shared implementation and the Visitor Management descriptor; see
 * `app/_components/ai-stack/build-ai-stack-screens.tsx` for what each tab reads and why
 * none of them duplicates another.
 */
export const VISITOR_AI_STACK_SCREENS: ModuleStaticScreen[] = buildAiStackScreens(VISITOR_AI_STACK);

'use client';

import type { ModuleStaticScreen } from '@/app/modules/_components/module-category-page';
import { buildAiStackScreens } from '@/app/_components/ai-stack/build-ai-stack-screens';
import { INWARD_AI_STACK } from '@/lib/inward/inward-ai-stack';

/**
 * Inward -> AI Stack tabs.
 *
 * The AI services and automation behind the Inward module. This is the plumbing view -
 * what the module runs on - as distinct from Intelligence, which is what that plumbing
 * produces. Nothing here touches the separate AI Administration module.
 *
 * ALL NINE TABS ARE LIVE, AND ALL NINE ARE INWARD-ONLY.
 *
 * The inward register records no status, owner or due date, so no tab here reports one.
 * Where a person would expect "pending", the module shows where the register itself has a
 * gap - a record with no physical file location, or no scan attached - and says which it
 * is. The outward register is a separate record and no tab reads it.
 *
 * The list is built from one shared implementation and the Inward descriptor; see
 * `app/_components/ai-stack/build-ai-stack-screens.tsx` for what each tab reads and why
 * none of them duplicates another.
 */
export const INWARD_AI_STACK_SCREENS: ModuleStaticScreen[] = buildAiStackScreens(INWARD_AI_STACK);

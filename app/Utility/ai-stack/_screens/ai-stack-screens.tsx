'use client';

import type { ModuleStaticScreen } from '@/app/modules/_components/module-category-page';
import { buildAiStackScreens } from '@/app/_components/ai-stack/build-ai-stack-screens';
import { UTILITY_AI_STACK } from '@/lib/utility/utility-ai-stack';

/**
 * Utility -> AI Stack tabs.
 *
 * The AI services and automation behind the Utility module. This is the plumbing view -
 * what the module runs on - as distinct from Intelligence, which is what that plumbing
 * produces. Nothing here touches the separate AI Administration module.
 *
 * ALL NINE TABS ARE LIVE, AND ALL NINE ARE UTILITY-ONLY.
 *
 * Utility here is bulk data operations - student transfer, academic-year rollover,
 * breakoff rollover, bulk update and the custom-module builder. It is NOT electricity,
 * water, gas, meter readings or utility bills: this estate holds no table for any of them,
 * and every tab says so rather than estimating one.
 *
 * Nor does any tab report that an operation has run. No rollover log, no transfer log and
 * no bulk-update audit exists anywhere, so what is readable describes what an operation
 * would act ON rather than what it has DONE.
 *
 * The list is built from one shared implementation and the Utility descriptor; see
 * `app/_components/ai-stack/build-ai-stack-screens.tsx` for what each tab reads and why
 * none of them duplicates another.
 */
export const UTILITY_AI_STACK_SCREENS: ModuleStaticScreen[] = buildAiStackScreens(UTILITY_AI_STACK);

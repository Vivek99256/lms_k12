'use client';

import type { ModuleStaticScreen } from '@/app/_components/module-category-page';
import { buildAiStackScreens } from '@/app/_components/ai-stack/build-ai-stack-screens';
import { INVENTORY_AI_STACK } from '@/lib/inventory/inventory-ai-stack';

/**
 * Inventory -> AI Stack tabs.
 *
 * The AI services and automation behind the Inventory module. This is the plumbing view -
 * what the module runs on - as distinct from Intelligence, which is what that plumbing
 * produces. Nothing here touches the separate AI Administration module.
 *
 * ALL NINE TABS ARE LIVE, AND ALL NINE ARE INVENTORY-ONLY.
 *
 * No tab reports what is on a shelf. This estate keeps no running stock balance: the stock
 * column is increased by a purchase and never decreased when stock is issued, so it
 * overstates what is there. The tabs report that figure under the name `recorded_stock`,
 * beside the reorder level and the quantity requisitions have approved, and say plainly
 * that the two have never been reconciled.
 *
 * Both published prompts on the Prompts tab carry `requires_review` - the only module in
 * this batch that does, because somebody orders stock on this output.
 *
 * The list is built from one shared implementation and the Inventory descriptor; see
 * `app/_components/ai-stack/build-ai-stack-screens.tsx` for what each tab reads and why
 * none of them duplicates another.
 */
export const INVENTORY_AI_STACK_SCREENS: ModuleStaticScreen[] = buildAiStackScreens(INVENTORY_AI_STACK);

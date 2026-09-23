'use client';

import type { ModuleStaticScreen } from '@/app/modules/_components/module-category-page';
import { buildAiStackScreens } from '@/app/_components/ai-stack/build-ai-stack-screens';
import { FRONT_DESK_AI_STACK } from '@/lib/front-desk/front-desk-ai-stack';

/**
 * Front Desk -> AI Stack tabs.
 *
 * The AI services and automation behind the Front Desk module. This is the plumbing view -
 * what the module runs on - as distinct from Intelligence, which is what that plumbing
 * produces. Nothing here touches the separate AI Administration module.
 *
 * ALL NINE TABS ARE LIVE, AND ALL NINE ARE FRONT DESK-ONLY.
 *
 * The register behind them holds ONE row across this entire estate. The visitor log the
 * schools actually use belongs to the separate Visitor Management module, which no tab
 * here reads - so an empty answer on any of these tabs means this register is empty and
 * never that nobody visited the school.
 *
 * A non-admin sees only the visits they were the subject of, which is the rule the front
 * desk screen applies. The tabs say which scope they used rather than presenting a
 * restricted list as the whole day.
 *
 * The list is built from one shared implementation and the Front Desk descriptor; see
 * `app/_components/ai-stack/build-ai-stack-screens.tsx` for what each tab reads and why
 * none of them duplicates another.
 */
export const FRONT_DESK_AI_STACK_SCREENS: ModuleStaticScreen[] = buildAiStackScreens(FRONT_DESK_AI_STACK);

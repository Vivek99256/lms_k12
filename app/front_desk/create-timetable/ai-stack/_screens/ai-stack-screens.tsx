'use client';

import type { ModuleStaticScreen } from '@/app/modules/_components/module-category-page';
import { buildAiStackScreens } from '@/app/_components/ai-stack/build-ai-stack-screens';
import { TIMETABLE_AI_STACK } from '@/lib/timetable/timetable-ai-stack';

/**
 * Time Table -> AI Stack tabs.
 *
 * The AI services and automation behind the Time Table module. This is the plumbing view -
 * what the module runs on - as distinct from Intelligence, which is what that plumbing
 * produces. Nothing here touches the separate AI Administration module.
 *
 * ALL NINE TABS ARE LIVE, AND ALL NINE ARE TIME TABLE-ONLY.
 *
 * The table records no room and no teacher availability, so the only conflict any tab here
 * reports is a teacher booked into two different classes at once.
 *
 * The list is built from one shared implementation and the Time Table descriptor; see
 * `app/_components/ai-stack/build-ai-stack-screens.tsx` for what each tab reads and why
 * none of them duplicates another.
 */
export const TIMETABLE_AI_STACK_SCREENS: ModuleStaticScreen[] = buildAiStackScreens(TIMETABLE_AI_STACK);

'use client';

import type { ModuleStaticScreen } from '@/app/_components/module-category-page';
import { buildAiStackScreens } from '@/app/_components/ai-stack/build-ai-stack-screens';
import { TRANSPORT_AI_STACK } from '@/lib/transport/transport-ai-stack';

/**
 * Transport -> AI Stack tabs.
 *
 * The AI services and automation behind the Transport module. This is the plumbing view -
 * what the module runs on - as distinct from Intelligence, which is what that plumbing
 * produces. Nothing here touches the separate AI Administration module.
 *
 * ALL NINE TABS ARE LIVE, AND ALL NINE ARE TRANSPORT-ONLY.
 *
 * Seats against students assigned is the one judgement any tab here makes, and it is
 * counted per leg: the morning and afternoon runs are different trips, and adding them
 * would double-count every child who rides the same bus both ways.
 *
 * Nothing records a boarding, a live position, a delay, or a vehicle's fitness, insurance
 * or permit, so no tab reports any of them. Route times are the published schedule.
 *
 * The list is built from one shared implementation and the Transport descriptor; see
 * `app/_components/ai-stack/build-ai-stack-screens.tsx` for what each tab reads and why
 * none of them duplicates another.
 */
export const TRANSPORT_AI_STACK_SCREENS: ModuleStaticScreen[] = buildAiStackScreens(TRANSPORT_AI_STACK);

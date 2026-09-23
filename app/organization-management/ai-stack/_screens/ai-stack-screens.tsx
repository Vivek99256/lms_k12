'use client';

import type { ModuleStaticScreen } from '@/app/_components/module-category-page';
import { buildAiStackScreens } from '@/app/_components/ai-stack/build-ai-stack-screens';
import { INSTITUTE_AI_STACK } from '@/lib/institute/institute-ai-stack';

/**
 * Institute -> AI Stack tabs.
 *
 * The AI services and automation behind the Institute module. This is the plumbing view -
 * what the module runs on - as distinct from Intelligence, which is what that plumbing
 * produces. Nothing here touches the separate AI Administration module.
 *
 * ALL NINE TABS ARE LIVE, AND ALL NINE ARE INSTITUTE-ONLY.
 *
 * They read the SHAPE of the school - sections, standards, divisions and departments - and
 * not the people in it. No enrolment, fee, result or attendance tool is bound, so no tab
 * states how many students or staff are in anything without being given the figure, none
 * names anybody, and none judges the structure as good or efficient.
 *
 * The list is built from one shared implementation and the Institute descriptor; see
 * `app/_components/ai-stack/build-ai-stack-screens.tsx` for what each tab reads and why
 * none of them duplicates another.
 */
export const INSTITUTE_AI_STACK_SCREENS: ModuleStaticScreen[] = buildAiStackScreens(INSTITUTE_AI_STACK);

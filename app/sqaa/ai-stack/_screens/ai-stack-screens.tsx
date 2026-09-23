'use client';

import type { ModuleStaticScreen } from '@/app/_components/module-category-page';
import { buildAiStackScreens } from '@/app/_components/ai-stack/build-ai-stack-screens';
import { SQAA_AI_STACK } from '@/lib/sqaa/sqaa-ai-stack';

/**
 * Quality assurance -> AI Stack tabs.
 *
 * The AI services and automation behind the Quality assurance module. This is the plumbing view -
 * what the module runs on - as distinct from Intelligence, which is what that plumbing
 * produces. Nothing here touches the separate AI Administration module.
 *
 * ALL NINE TABS ARE LIVE, AND ALL NINE ARE SQAA-ONLY.
 *
 * No tab scores the school. No rubric, weighting or grade boundary is recorded anywhere
 * and the marks table holds six rows across the whole estate, so nothing here states a
 * score, a rating, a band or a readiness for assessment, and nothing judges whether a
 * piece of evidence is good enough.
 *
 * Every tab reports the number of document slots beside the number of uploads. On this
 * estate that is 1,534 against 86: the second figure alone reads as progress when it is
 * mostly absence.
 *
 * The list is built from one shared implementation and the Quality assurance descriptor; see
 * `app/_components/ai-stack/build-ai-stack-screens.tsx` for what each tab reads and why
 * none of them duplicates another.
 */
export const SQAA_AI_STACK_SCREENS: ModuleStaticScreen[] = buildAiStackScreens(SQAA_AI_STACK);

'use client';

import type { ModuleStaticScreen } from '@/app/_components/module-category-page';
import { buildAiStackScreens } from '@/app/_components/ai-stack/build-ai-stack-screens';
import { STUDENT_ICARD_AI_STACK } from '@/lib/student-icard/student-icard-ai-stack';

/**
 * Student I-Card -> AI Stack tabs.
 *
 * The AI services and automation behind the Student I-Card module. This is the plumbing view -
 * what the module runs on - as distinct from Intelligence, which is what that plumbing
 * produces. Nothing here touches the separate AI Administration module.
 *
 * ALL NINE TABS ARE LIVE, AND ALL NINE ARE STUDENT I-CARD-ONLY.
 *
 * The module reads only the fields a card prints. It binds no student directory tool, so
 * it is not a second route into the student file for anybody who can print a card.
 *
 * The list is built from one shared implementation and the Student I-Card descriptor; see
 * `app/_components/ai-stack/build-ai-stack-screens.tsx` for what each tab reads and why
 * none of them duplicates another.
 */
export const STUDENT_ICARD_AI_STACK_SCREENS: ModuleStaticScreen[] = buildAiStackScreens(STUDENT_ICARD_AI_STACK);

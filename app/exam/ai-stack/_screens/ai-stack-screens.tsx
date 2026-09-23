'use client';

import type { ModuleStaticScreen } from '@/app/_components/module-category-page';
import { buildAiStackScreens } from '@/app/_components/ai-stack/build-ai-stack-screens';
import { EXAM_AI_STACK } from '@/lib/exam/exam-ai-stack';

/**
 * Exam -> AI Stack tabs.
 *
 * The AI services and automation behind the Exam module. This is the plumbing view - what
 * the module runs on - as distinct from Intelligence, which is what that plumbing
 * produces. Nothing here touches the separate AI Administration module.
 *
 * ALL NINE TABS ARE LIVE, AND ALL NINE ARE EXAM-ONLY. The list is built from one shared
 * implementation and the Exam descriptor; see
 * `app/_components/ai-stack/build-ai-stack-screens.tsx` for what each tab reads and why
 * none of them duplicates another.
 */
export const EXAM_AI_STACK_SCREENS: ModuleStaticScreen[] = buildAiStackScreens(EXAM_AI_STACK);

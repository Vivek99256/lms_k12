'use client';

import type { ModuleStaticScreen } from '@/app/_components/module-category-page';
import { buildAiStackScreens } from '@/app/_components/ai-stack/build-ai-stack-screens';
import { LMS_AI_STACK } from '@/lib/lms-ai/lms-ai-stack';

/**
 * Learning -> AI Stack tabs.
 *
 * The AI services and automation behind the Learning module. This is the plumbing view -
 * what the module runs on - as distinct from Intelligence, which is what that plumbing
 * produces. Nothing here touches the separate AI Administration module.
 *
 * ALL NINE TABS ARE LIVE, AND ALL NINE ARE LEARNING-ONLY.
 *
 * The records behind them are CONFIGURATION - which courses exist, for which classes, with
 * what activities against them. They record nothing about what any child learned or how
 * well, and no tab here says otherwise.
 *
 * A course with no activity recorded is a course with no activity RECORDED, not a
 * neglected one. Results belong to the Exam module and attendance to Attendance; neither
 * is read by any tab here.
 *
 * The list is built from one shared implementation and the Learning descriptor; see
 * `app/_components/ai-stack/build-ai-stack-screens.tsx` for what each tab reads and why
 * none of them duplicates another.
 */
export const LMS_AI_STACK_SCREENS: ModuleStaticScreen[] = buildAiStackScreens(LMS_AI_STACK);

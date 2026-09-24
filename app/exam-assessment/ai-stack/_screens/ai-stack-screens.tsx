'use client';

import type { ModuleStaticScreen } from '@/app/_components/module-category-page';
import { buildAiStackScreens } from '@/app/_components/ai-stack/build-ai-stack-screens';
import { EXAM_ASSESSMENT_AI_STACK } from '@/lib/exam-assessment/exam-assessment-ai-stack';

/**
 * Exam & Assessment -> AI Stack tabs.
 *
 * The AI services and automation behind the Exam & Assessment module (online exams,
 * homework, assignments, worksheets, projects) — distinct from the Exam (Mark Entry /
 * Results) module's own AI Stack. Built from the same shared implementation as Exam and
 * New PAL; see `app/_components/ai-stack/build-ai-stack-screens.tsx` for what each tab
 * reads and why none of them duplicates another.
 */
export const EXAM_ASSESSMENT_AI_STACK_SCREENS: ModuleStaticScreen[] = buildAiStackScreens(EXAM_ASSESSMENT_AI_STACK);

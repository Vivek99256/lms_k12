'use client';

import type { ModuleStaticScreen } from '@/app/modules/_components/module-category-page';
import { buildAiStackScreens } from '@/app/_components/ai-stack/build-ai-stack-screens';
import { STUDENT_MEDICAL_AI_STACK } from '@/lib/student-medical/student-medical-ai-stack';

/**
 * Student Medical -> AI Stack tabs.
 *
 * The AI services and automation behind the Student Medical module. This is the plumbing view -
 * what the module runs on - as distinct from Intelligence, which is what that plumbing
 * produces. Nothing here touches the separate AI Administration module.
 *
 * ALL NINE TABS ARE LIVE, AND ALL NINE ARE STUDENT MEDICAL-ONLY.
 *
 * This is the most restricted module in the product. The read tool withholds clinical
 * detail from any summary covering more than one student, every published prompt requires
 * a person to read its output, and the module offers no tool that writes text at all.
 *
 * The list is built from one shared implementation and the Student Medical descriptor; see
 * `app/_components/ai-stack/build-ai-stack-screens.tsx` for what each tab reads and why
 * none of them duplicates another.
 */
export const STUDENT_MEDICAL_AI_STACK_SCREENS: ModuleStaticScreen[] = buildAiStackScreens(STUDENT_MEDICAL_AI_STACK);

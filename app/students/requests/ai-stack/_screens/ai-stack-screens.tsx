'use client';

import type { ModuleStaticScreen } from '@/app/_components/module-category-page';
import { buildAiStackScreens } from '@/app/_components/ai-stack/build-ai-stack-screens';
import { STUDENT_REQUEST_AI_STACK } from '@/lib/student-requests/student-requests-ai-stack';

/**
 * Student Request -> AI Stack tabs.
 *
 * The AI services and automation behind the Student Request module. This is the plumbing
 * view - what the module runs on - as distinct from Intelligence, which is what that
 * plumbing produces. Nothing here touches the separate AI Administration module.
 *
 * ALL NINE TABS ARE LIVE, AND ALL NINE ARE STUDENT-REQUEST-ONLY. They are scoped to the
 * `student_request` module, which is NOT the `students` module that owns the directory:
 * the two have separate keys, separate policies, separate templates and separate ledgers,
 * and this stack's tool binding deliberately omits `students.directory` so that reading
 * the request queue is not a second route into the student directory.
 *
 * The list is built from one shared implementation and the Student Request descriptor; see
 * `app/_components/ai-stack/build-ai-stack-screens.tsx` for what each tab reads and why
 * none of them duplicates another.
 */
export const STUDENT_REQUEST_AI_STACK_SCREENS: ModuleStaticScreen[] =
  buildAiStackScreens(STUDENT_REQUEST_AI_STACK);

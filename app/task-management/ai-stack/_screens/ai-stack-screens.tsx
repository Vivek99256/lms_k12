'use client';

import type { ModuleStaticScreen } from '@/app/_components/module-category-page';
import { buildAiStackScreens } from '@/app/_components/ai-stack/build-ai-stack-screens';
import { TASK_MANAGEMENT_AI_STACK } from '@/lib/task-management/task-management-ai-stack';

/**
 * Task Management -> AI Stack tabs.
 *
 * The AI services and automation behind the Task Management module. This is the plumbing view -
 * what the module runs on - as distinct from Intelligence, which is what that plumbing
 * produces. Nothing here touches the separate AI Administration module.
 *
 * ALL NINE TABS ARE LIVE, AND ALL NINE ARE TASK MANAGEMENT-ONLY.
 *
 * Every count on every tab is made on a normalised status, because the column holds two
 * spellings of the same state - COMPLETE on 570 rows and COMPLETED on two. A count
 * matching one spelling would be wrong, and those two finished tasks would sit in an
 * overdue list forever. The raw spellings are reported beside the figures so the office
 * can see what needs tidying.
 *
 * Nothing here says why a task is late or ranks the people it is allocated to. Neither is
 * recorded.
 *
 * The list is built from one shared implementation and the Task Management descriptor; see
 * `app/_components/ai-stack/build-ai-stack-screens.tsx` for what each tab reads and why
 * none of them duplicates another.
 */
export const TASK_MANAGEMENT_AI_STACK_SCREENS: ModuleStaticScreen[] = buildAiStackScreens(TASK_MANAGEMENT_AI_STACK);

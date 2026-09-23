'use client';

import type { ModuleStaticScreen } from '@/app/_components/module-category-page';
import { buildAiStackScreens } from '@/app/_components/ai-stack/build-ai-stack-screens';
import { CURRICULUM_PLANNING_AI_STACK } from '@/lib/curriculum-planning/curriculum-planning-ai-stack';

/**
 * Curriculum Planning -> AI Stack tabs. All nine tabs are Curriculum Planning-only,
 * built from one shared implementation and this module's descriptor.
 */
export const CURRICULUM_PLANNING_AI_STACK_SCREENS: ModuleStaticScreen[] = buildAiStackScreens(CURRICULUM_PLANNING_AI_STACK);

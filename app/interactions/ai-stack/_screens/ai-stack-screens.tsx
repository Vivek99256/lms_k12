'use client';

import type { ModuleStaticScreen } from '@/app/_components/module-category-page';
import { buildAiStackScreens } from '@/app/_components/ai-stack/build-ai-stack-screens';
import { INTERACTIONS_AI_STACK } from '@/lib/interactions/interactions-ai-stack';

/**
 * Interactions -> AI Stack tabs. All nine tabs are Interactions-only, built from one
 * shared implementation and this module's descriptor.
 */
export const INTERACTIONS_AI_STACK_SCREENS: ModuleStaticScreen[] = buildAiStackScreens(INTERACTIONS_AI_STACK);

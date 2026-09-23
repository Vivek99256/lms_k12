'use client';

import type { ModuleStaticScreen } from '@/app/modules/_components/module-category-page';
import { buildAiStackScreens } from '@/app/_components/ai-stack/build-ai-stack-screens';
import { ENGAGEMENT_AI_STACK } from '@/lib/engagement/engagement-ai-stack';

/**
 * Engagement -> AI Stack tabs. All nine tabs are Engagement-only, built from one shared
 * implementation and this module's descriptor.
 */
export const ENGAGEMENT_AI_STACK_SCREENS: ModuleStaticScreen[] = buildAiStackScreens(ENGAGEMENT_AI_STACK);

'use client';

import type { ModuleStaticScreen } from '@/app/modules/_components/module-category-page';
import { buildAiStackScreens } from '@/app/_components/ai-stack/build-ai-stack-screens';
import { NEW_PAL_AI_STACK } from '@/lib/new-pal/new-pal-ai-stack';

/**
 * New PAL -> AI Stack tabs. All nine tabs are New PAL-only, built from one shared
 * implementation and this module's descriptor — never the older `pal` module's records.
 */
export const NEW_PAL_AI_STACK_SCREENS: ModuleStaticScreen[] = buildAiStackScreens(NEW_PAL_AI_STACK);

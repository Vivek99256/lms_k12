'use client';

import type { ModuleStaticScreen } from '@/app/_components/module-category-page';
import { buildAiStackScreens } from '@/app/_components/ai-stack/build-ai-stack-screens';
import { MOBILE_APPS_AI_STACK } from '@/lib/mobile-apps/mobile-apps-ai-stack';

/**
 * Users Mobile Apps -> AI Stack tabs.
 *
 * The AI services and automation behind the Users Mobile Apps module. This is the plumbing view -
 * what the module runs on - as distinct from Intelligence, which is what that plumbing
 * produces. Nothing here touches the separate AI Administration module.
 *
 * ALL NINE TABS ARE LIVE, AND ALL NINE ARE MOBILE-APPS-ONLY.
 *
 * The module's records are the apps' configured navigation, per user profile. Nothing in
 * this estate records a session, a device or a login, so no tab here reports app usage.
 *
 * The list is built from one shared implementation and the Users Mobile Apps descriptor; see
 * `app/_components/ai-stack/build-ai-stack-screens.tsx` for what each tab reads and why
 * none of them duplicates another.
 */
export const MOBILE_APPS_AI_STACK_SCREENS: ModuleStaticScreen[] = buildAiStackScreens(MOBILE_APPS_AI_STACK);

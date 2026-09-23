'use client';

import type { ModuleStaticScreen } from '@/app/modules/_components/module-category-page';
import { buildAiStackScreens } from '@/app/_components/ai-stack/build-ai-stack-screens';
import { CERTIFICATE_AI_STACK } from '@/lib/certificate/certificate-ai-stack';

/**
 * Certificate -> AI Stack tabs.
 *
 * The AI services and automation behind the Certificate module. This is the plumbing view -
 * what the module runs on - as distinct from Intelligence, which is what that plumbing
 * produces. Nothing here touches the separate AI Administration module.
 *
 * ALL NINE TABS ARE LIVE, AND ALL NINE ARE CERTIFICATE-ONLY.
 *
 * The printed certificate text is stored but is never given to a model, so no tab here can
 * quote or paraphrase what a certificate says about a child.
 *
 * The list is built from one shared implementation and the Certificate descriptor; see
 * `app/_components/ai-stack/build-ai-stack-screens.tsx` for what each tab reads and why
 * none of them duplicates another.
 */
export const CERTIFICATE_AI_STACK_SCREENS: ModuleStaticScreen[] = buildAiStackScreens(CERTIFICATE_AI_STACK);

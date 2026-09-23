'use client';

import type { ModuleStaticScreen } from '@/app/modules/_components/module-category-page';
import { buildAiStackScreens } from '@/app/_components/ai-stack/build-ai-stack-screens';
import { CONSENT_AI_STACK } from '@/lib/consent/consent-ai-stack';

/**
 * Consent -> AI Stack tabs.
 *
 * The AI services and automation behind the Consent module. This is the plumbing view -
 * what the module runs on - as distinct from Intelligence, which is what that plumbing
 * produces. Nothing here touches the separate AI Administration module.
 *
 * ALL NINE TABS ARE LIVE, AND ALL NINE ARE CONSENT-ONLY.
 *
 * Every tab keeps three states apart: a decision is recorded, no decision is recorded, or
 * the consent does not exist for that student. An empty decision means nobody has answered
 * and is never reported as a refusal - which is why both published prompts on the Prompts
 * tab carry `requires_review`, the only module in this batch that does.
 *
 * Nothing here reports an expiry or a reminder. The register records neither.
 *
 * The list is built from one shared implementation and the Consent descriptor; see
 * `app/_components/ai-stack/build-ai-stack-screens.tsx` for what each tab reads and why
 * none of them duplicates another.
 */
export const CONSENT_AI_STACK_SCREENS: ModuleStaticScreen[] = buildAiStackScreens(CONSENT_AI_STACK);

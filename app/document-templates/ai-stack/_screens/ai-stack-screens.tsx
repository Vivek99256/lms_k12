'use client';

import type { ModuleStaticScreen } from '@/app/_components/module-category-page';
import { buildAiStackScreens } from '@/app/_components/ai-stack/build-ai-stack-screens';
import { DOCUMENT_TEMPLATES_AI_STACK } from '@/lib/document-templates/document-templates-ai-stack';

/**
 * Document Templates -> AI Stack tabs.
 *
 * The AI services and automation behind the Document Templates module. This is the plumbing view -
 * what the module runs on - as distinct from Intelligence, which is what that plumbing
 * produces. Nothing here touches the separate AI Administration module.
 *
 * ALL NINE TABS ARE LIVE, AND ALL NINE ARE DOCUMENT TEMPLATES-ONLY.
 *
 * The tables behind them are empty across this entire estate, and that is the point of the
 * module's central rule: an empty list is the most tempting thing for a model to fill in.
 * No tab describes templates a school might want, proposes a library to create, or says
 * what schools usually hold. An empty register is a complete answer.
 *
 * No tab returns a document body either. The reads measure it and parse the merge fields
 * actually present in it; the letter itself is read on the template screen.
 *
 * The list is built from one shared implementation and the Document Templates descriptor; see
 * `app/_components/ai-stack/build-ai-stack-screens.tsx` for what each tab reads and why
 * none of them duplicates another.
 */
export const DOCUMENT_TEMPLATES_AI_STACK_SCREENS: ModuleStaticScreen[] = buildAiStackScreens(DOCUMENT_TEMPLATES_AI_STACK);

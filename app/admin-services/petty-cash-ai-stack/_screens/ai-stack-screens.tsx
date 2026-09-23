'use client';

import type { ModuleStaticScreen } from '@/app/_components/module-category-page';
import { buildAiStackScreens } from '@/app/_components/ai-stack/build-ai-stack-screens';
import { PETTY_CASH_AI_STACK } from '@/lib/petty-cash/petty-cash-ai-stack';

/**
 * Petty Cash -> AI Stack tabs.
 *
 * The AI services and automation behind the Petty Cash module. This is the plumbing view -
 * what the module runs on - as distinct from Intelligence, which is what that plumbing
 * produces. Nothing here touches the separate AI Administration module.
 *
 * ALL NINE TABS ARE LIVE, AND ALL NINE ARE PETTY CASH-ONLY.
 *
 * Two columns are missing from this book and both shape every tab. There is no approval -
 * no approver, no approved-at, no rejection, and no approval table in the estate - so
 * nothing here is ever awaiting approval. And there is no opening float, top-up or
 * reimbursement, so no balance exists to report: the totals are money recorded as going
 * out, and they say so.
 *
 * The list is built from one shared implementation and the Petty Cash descriptor; see
 * `app/_components/ai-stack/build-ai-stack-screens.tsx` for what each tab reads and why
 * none of them duplicates another.
 */
export const PETTY_CASH_AI_STACK_SCREENS: ModuleStaticScreen[] = buildAiStackScreens(PETTY_CASH_AI_STACK);

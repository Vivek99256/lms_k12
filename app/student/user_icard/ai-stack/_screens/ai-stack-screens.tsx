'use client';

import type { ModuleStaticScreen } from '@/app/modules/_components/module-category-page';
import { buildAiStackScreens } from '@/app/_components/ai-stack/build-ai-stack-screens';
import { USER_ICARD_AI_STACK } from '@/lib/user-icard/user-icard-ai-stack';

/**
 * User I-Card -> AI Stack tabs.
 *
 * The AI services and automation behind the User I-Card module. This is the plumbing view -
 * what the module runs on - as distinct from Intelligence, which is what that plumbing
 * produces. Nothing here touches the separate AI Administration module.
 *
 * ALL NINE TABS ARE LIVE, AND ALL NINE ARE USER I-CARD-ONLY.
 *
 * The module reads the staff master record, which also holds bank, PAN, Aadhaar, provident
 * fund, salary and contract details. None of it is reachable from any tab here: the
 * service selects an explicit column list and the two bound tools return nothing else.
 *
 * No card issue date, card expiry or print history exists anywhere in this estate, so no
 * tab reports one. The account expiry shown on the print list is the ERP account's, which
 * is a different fact about a different thing.
 *
 * The list is built from one shared implementation and the User I-Card descriptor; see
 * `app/_components/ai-stack/build-ai-stack-screens.tsx` for what each tab reads and why
 * none of them duplicates another.
 */
export const USER_ICARD_AI_STACK_SCREENS: ModuleStaticScreen[] = buildAiStackScreens(USER_ICARD_AI_STACK);

'use client';

import type { ModuleStaticScreen } from '@/app/_components/module-category-page';
import { buildAiStackScreens } from '@/app/_components/ai-stack/build-ai-stack-screens';
import { USERS_AI_STACK } from '@/lib/users/users-ai-stack';

/**
 * Users -> AI Stack tabs.
 *
 * The AI services and automation behind the Users module. This is the plumbing view -
 * what the module runs on - as distinct from Intelligence, which is what that plumbing
 * produces. Nothing here touches the separate AI Administration module.
 *
 * ALL NINE TABS ARE LIVE, AND ALL NINE ARE USERS-ONLY.
 *
 * The tabs read the ACCOUNT fields of the staff record: profile, status, administrator and
 * portal flags, the join and expiry dates and the last login. The same table also holds
 * salary, bank, PAN, Aadhaar and contract columns, and no tab here can reach any of them -
 * the service selects an explicit column list.
 *
 * The last login is the only activity this system records. No tab says how much anybody
 * uses the system, who is most active, or that anybody is not doing their work, and both
 * published prompts carry `requires_review` because this output is about named colleagues.
 *
 * The list is built from one shared implementation and the Users descriptor; see
 * `app/_components/ai-stack/build-ai-stack-screens.tsx` for what each tab reads and why
 * none of them duplicates another.
 */
export const USERS_AI_STACK_SCREENS: ModuleStaticScreen[] = buildAiStackScreens(USERS_AI_STACK);

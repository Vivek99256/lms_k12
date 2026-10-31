'use client';

import { ModuleIntelligence } from '@/components/intelligence/module/ModuleIntelligence';
import { careerIntelligenceContract } from '@/components/intelligence/module/contracts/career';

/**
 * Career -> Intelligence (the Brain's module screen).
 *
 * Distinct from `/career-intelligence`, the counselling workspace: that is one
 * student at a time, this is the Grade 9-10 cohort's evidence readiness. The
 * path must keep matching the `career` registry entry's `intelligenceHref`;
 * lib/brain/intelligence-navigation.test.ts pins the pair.
 */
export default function Page() {
  return <ModuleIntelligence contract={careerIntelligenceContract} />;
}

'use client';

import { ModuleIntelligence } from '@/components/intelligence/module';
import { admissionsIntelligenceContract } from '@/components/intelligence/module/contracts/admissions';

export default function Page() {
  return <ModuleIntelligence contract={admissionsIntelligenceContract} />;
}


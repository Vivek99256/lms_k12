'use client';

import { ModuleIntelligence } from '@/components/intelligence/module';
import { correspondenceIntelligenceContract } from '@/components/intelligence/module/contracts/correspondence';

export default function Page() {
  return <ModuleIntelligence contract={correspondenceIntelligenceContract} />;
}

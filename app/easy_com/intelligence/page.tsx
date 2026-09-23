'use client';

import { ModuleIntelligence } from '@/components/intelligence/module';
import { communicationIntelligenceContract } from '@/components/intelligence/module/contracts/communication';

export default function Page() {
  return <ModuleIntelligence contract={communicationIntelligenceContract} />;
}


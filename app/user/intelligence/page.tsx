'use client';

import { ModuleIntelligence } from '@/components/intelligence/module';
import { hrIntelligenceContract } from '@/components/intelligence/module/contracts/hr';

export default function Page() {
  return <ModuleIntelligence contract={hrIntelligenceContract} />;
}


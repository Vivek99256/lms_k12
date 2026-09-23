'use client';

import { ModuleIntelligence } from '@/components/intelligence/module';
import { visitorIntelligenceContract } from '@/components/intelligence/module/contracts/visitor';

export default function Page() {
  return <ModuleIntelligence contract={visitorIntelligenceContract} />;
}

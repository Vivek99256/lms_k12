'use client';

import { ModuleIntelligence } from '@/components/intelligence/module';
import { inventoryIntelligenceContract } from '@/components/intelligence/module/contracts/inventory';

export default function Page() {
  return <ModuleIntelligence contract={inventoryIntelligenceContract} />;
}


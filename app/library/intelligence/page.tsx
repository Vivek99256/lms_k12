'use client';

import { ModuleIntelligence } from '@/components/intelligence/module';
import { libraryIntelligenceContract } from '@/components/intelligence/module/contracts/library';

export default function Page() {
  return <ModuleIntelligence contract={libraryIntelligenceContract} />;
}


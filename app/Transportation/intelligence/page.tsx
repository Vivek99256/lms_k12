'use client';

import { ModuleIntelligence } from '@/components/intelligence/module';
import { transportIntelligenceContract } from '@/components/intelligence/module/contracts/transport';

export default function Page() {
  return <ModuleIntelligence contract={transportIntelligenceContract} />;
}


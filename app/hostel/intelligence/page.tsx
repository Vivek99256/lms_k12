'use client';

import { ModuleIntelligence } from '@/components/intelligence/module';
import { hostelIntelligenceContract } from '@/components/intelligence/module/contracts/hostel';

export default function Page() {
  return <ModuleIntelligence contract={hostelIntelligenceContract} />;
}


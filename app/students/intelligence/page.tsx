'use client';

import { ModuleIntelligence } from '@/components/intelligence/module';
import { studentIntelligenceContract } from '@/components/intelligence/module/contracts/student';

export default function Page() {
  return <ModuleIntelligence contract={studentIntelligenceContract} />;
}


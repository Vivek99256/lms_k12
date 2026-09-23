'use client';

import { ModuleIntelligence } from '@/components/intelligence/module';
import { academicIntelligenceContract } from '@/components/intelligence/module/contracts/academic';

export default function Page() {
  return <ModuleIntelligence contract={academicIntelligenceContract} />;
}


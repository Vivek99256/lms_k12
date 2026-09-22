'use client';

import { ModuleIntelligence } from '@/components/intelligence/module';
import { homeworkIntelligenceContract } from '@/components/intelligence/module/contracts/homework';

export default function Page() {
  return <ModuleIntelligence contract={homeworkIntelligenceContract} />;
}


'use client';

import { ModuleIntelligence } from '@/components/intelligence/module';
import { attendanceIntelligenceContract } from '@/components/intelligence/module/contracts/attendance';

export default function Page() {
  return <ModuleIntelligence contract={attendanceIntelligenceContract} />;
}


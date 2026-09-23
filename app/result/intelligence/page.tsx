'use client';

import { ModuleIntelligence } from '@/components/intelligence/module';
import { resultIntelligenceContract } from '@/components/intelligence/module/contracts/result';

/**
 * Result → Intelligence.
 *
 * Three lines, because everything that makes this screen is either in the
 * contract or in the shared renderer. A top-level dynamic route could not
 * replace this file — Next resolves `/result/intelligence` inside the existing
 * `app/result/` segment, so the file has to exist — but three lines is a cheap
 * floor to pay per module.
 */
export default function Page() {
  return <ModuleIntelligence contract={resultIntelligenceContract} />;
}

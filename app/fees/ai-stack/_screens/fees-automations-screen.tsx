'use client';

import { AiStackAutomationsScreen } from '@/app/_components/ai-stack/automations-screen';
import { FEES_AI_STACK } from '@/lib/fees/fees-ai-module';

/**
 * Fees → AI Stack → Automations.
 *
 * Same layout as the other modules: the live database-grounded Fees pipeline (Agent 1 ➔ 2 ➔ 3),
 * then "Fees tool agents" and "Fees agent management", both fetched from the central Agent
 * Management engine scoped to module = fees.
 */
export function FeesAutomationsScreen() {
  return <AiStackAutomationsScreen module={FEES_AI_STACK} />;
}

'use client';

/**
 * Fees → AI Stack → Models.
 *
 * WHAT THIS TAB IS NOW
 *
 * The model Fees runs on, chosen in Fees, saved in Fees, and applying to Fees alone.
 * There is no link out of this screen and no navigation to AI & Intelligence: a person
 * who opens Fees → AI Stack → Models to change a model finishes that job here.
 *
 * WHAT IT REPLACED, AND WHY THAT WAS WRONG
 *
 * This file used to be a 587-line editor over `ai_api_keys` — the central credential
 * table — filtered by `ai_module = 'fees'`. Two things were wrong with it, and both
 * matter more than its size:
 *
 *   1. `ai_api_keys.ai_module` is not the product module. It carries the AI *capability*
 *      key (`conversational_ai`, `generative_ai`, `agent_reasoning`), so a row saved as
 *      "Fees" was a row the resolver would never look at under that name.
 *   2. Even had the column meant what the file assumed, it is the central table. Editing
 *      it from inside a module is exactly the mixing of the two areas that must not
 *      happen — a save in Fees would have moved a row the AI & Intelligence console owns.
 *
 * The tab was therefore unrouted rather than shipped, and the Fees stack carried no
 * Models tab at all. Now it carries this one, which writes to `ai_module_model_bindings`
 * — product module × capability, a table the central console does not edit — so the two
 * consoles never touch the same row and neither can silently undo the other.
 *
 * WHY IT IS FOUR LINES
 *
 * Because the screen is the same screen every other module's AI Stack shows, given the
 * Fees descriptor. A module's model choice differs from another module's by which module
 * it is; nothing about Fees changes how a provider is picked, so nothing about this file
 * should differ either. The shared screen resolves the capabilities Fees actually uses
 * from the backend and offers only those.
 */

import { AiStackModelsScreen } from '@/app/_components/ai-stack/models-screen';
import { FEES_MODULE } from '@/lib/fees/fees-ai-stack';

export function FeesModelsScreen() {
  return <AiStackModelsScreen module={{ key: FEES_MODULE, label: 'Fees' }} />;
}

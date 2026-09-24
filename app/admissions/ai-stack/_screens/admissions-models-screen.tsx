'use client';

/**
 * Admission → AI Stack → Models.
 *
 * The model Admission runs on, chosen here and applying to Admission alone.
 *
 * WHAT THIS REPLACED
 *
 * A read-only mirror of the central console, whose every write control was a link to
 * `/ai/models` or `/ai/providers`. It reported the truth — which provider an Admission
 * call would resolve to, computed by the real resolver — but a person who came here to
 * change a model was sent to AI & Intelligence to do it, which is leaving the module to
 * configure the module.
 *
 * The tab now writes, and what it writes is a binding of its own: a row in
 * `ai_module_model_bindings` keyed by product module × capability. That table is not the
 * central one. AI & Intelligence keeps owning `ai_models` and `ai_api_keys`; this tab
 * owns Admission's override of them, and clearing the override puts Admission back on
 * whatever the estate uses. Neither console can move the other's row.
 *
 * The screen is shared with every other module's AI Stack, given the Admission
 * descriptor — see `app/_components/ai-stack/models-screen.tsx`.
 */

import { AiStackModelsScreen } from '@/app/_components/ai-stack/models-screen';
import { ADMISSIONS_MODULE } from '@/lib/admissions/admissions-ai-stack';

export function AdmissionsModelsScreen() {
  return <AiStackModelsScreen module={{ key: ADMISSIONS_MODULE, label: 'Admission' }} />;
}

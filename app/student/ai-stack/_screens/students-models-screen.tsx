'use client';

/**
 * Student → AI Stack → Models.
 *
 * The model the Student module runs on, chosen here and applying to Student alone.
 *
 * WHAT THIS REPLACED
 *
 * A read-only mirror of the central console. Its own header said as much: it "shows
 * links, and never saves. Every write button lives on `/ai/models` and `/ai/providers`."
 * That is a signpost out of the module sitting where the module's own configuration
 * belongs — open Student → AI Stack → Models to manage a model and you were moved to AI
 * & Intelligence to manage it.
 *
 * THE TWO REGISTRIES CALLED "MODULE" ARE STILL NOT THE SAME THING
 *
 *   `ai_modules`        PRODUCT modules — Student, Fees, Hostel. What a page is about.
 *   `AiModuleRegistry`  AI CAPABILITY modules — conversational, generative, agent
 *                       reasoning. What a request IS.
 *
 * A binding is the intersection of the two, which is why the rows on this tab are
 * capabilities while the module is fixed to Student. It is stored in
 * `ai_module_model_bindings`, a table the central console does not write, so this tab and
 * AI & Intelligence never contend for one row. Student with no binding inherits the
 * estate default, as it always did.
 *
 * The screen is shared with every other module's AI Stack, given the Student
 * descriptor — see `app/_components/ai-stack/models-screen.tsx`.
 */

import { AiStackModelsScreen } from '@/app/_components/ai-stack/models-screen';
import { STUDENTS_MODULE } from '@/lib/students/students-ai-stack';

export function StudentsModelsScreen() {
  return <AiStackModelsScreen module={{ key: STUDENTS_MODULE, label: 'Student' }} />;
}

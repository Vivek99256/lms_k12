'use client';

/**
 * Attendance → AI Stack → Models.
 *
 * The model Attendance runs on, chosen here and applying to Attendance alone.
 *
 * WHAT THIS REPLACED
 *
 * A read-only mirror of the central console: it reported which provider Attendance
 * resolved to and then sent you to `/ai/models` and `/ai/providers` to change anything.
 * That reading was deliberate at the time — a per-module editor looked like a second
 * place to change one estate-wide setting — but it made the module's Models tab a
 * signpost out of the module, which is the one thing a decentralised AI Stack must not
 * be. Opening Attendance → AI Stack → Models and being moved to AI & Intelligence is
 * leaving the module to configure the module.
 *
 * The objection is answered by scope rather than by removing the tab. A module choosing
 * its own model is not a second way to edit the estate's default; it is a different
 * setting, and it now lives in a different table (`ai_module_model_bindings`, keyed by
 * product module × capability) that the central console never writes. Attendance with no
 * binding still inherits the estate default exactly as it did when this screen was a
 * mirror.
 *
 * The screen itself is shared with every other module's AI Stack, given the Attendance
 * descriptor — see `app/_components/ai-stack/models-screen.tsx`.
 */

import { AiStackModelsScreen } from '@/app/_components/ai-stack/models-screen';
import { ATTENDANCE_MODULE } from '@/lib/attendance/attendance-ai-stack';

export function AttendanceModelsScreen() {
  return <AiStackModelsScreen module={{ key: ATTENDANCE_MODULE, label: 'Attendance' }} />;
}

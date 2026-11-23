import { appendCommonParams, buildSessionContext, createAuthHeaders } from '@/lib/erp-client';
import { specToModel, type LabSpec } from '@/lib/experiment-builder/spec';
import type { ExperimentModel } from '@/lib/experiment-builder/types';

/**
 * The approved lab specification for a chapter, as a student may see it.
 *
 *   GET /lms/pal/application-lab/lab-spec/chapter/{chapterId}
 *
 * The server answers with lab = null when the chapter has no approved lab (then the guided design form is used) and
 * never includes the marker's key. Only approved specifications are ever served to students.
 */
export async function fetchLabModel(chapterId: string | number, signal?: AbortSignal): Promise<ExperimentModel | null> {
  const ctx = buildSessionContext();
  if (!ctx.baseUrl) throw new Error('Session data is missing. Please sign in again.');
  const params = new URLSearchParams();
  appendCommonParams(params, ctx);
  if (ctx.userId) params.set('user_id', ctx.userId);
  const response = await fetch(`${ctx.baseUrl}/lms/pal/application-lab/lab-spec/chapter/${encodeURIComponent(String(chapterId))}?${params.toString()}`, {
    headers: { ...createAuthHeaders(ctx), 'X-Requested-With': 'XMLHttpRequest' },
    signal,
  });
  if (!response.ok) throw new Error('Couldn’t load the lab for this chapter.');
  const payload = (await response.json()) as { lab?: { version?: number; spec?: LabSpec } | null };
  const lab = payload.lab;
  if (!lab?.spec || !Array.isArray(lab.spec.items) || !lab.spec.model) return null;
  return specToModel(lab.spec, Number(lab.version) || 1);
}

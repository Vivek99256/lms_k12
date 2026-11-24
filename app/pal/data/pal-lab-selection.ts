import { appendCommonParams, buildSessionContext, createAuthHeaders, readNumber, readString } from '@/lib/erp-client';
import { addScope, type ActivityScope } from '@/app/pal/data/pal-activity-scope';
import { specToModel, type LabSpec } from '@/lib/experiment-builder/spec';
import type { ExperimentModel } from '@/lib/experiment-builder/types';

/**
 * Which experiment each card of the Application Lab offers THIS student, for the scope they chose.
 *
 *   GET /lms/pal/application-lab/lab-selection/chapter/{chapterId}
 *
 * The server chooses from the student's studied concepts (the scope), the approved labs of the chapter and what they have already
 * done: several labs per chapter, a whole-chapter experiment only for a whole-chapter scope, the two cards never the same
 * experiment, a finished experiment not repeated while another suitable one exists. When there is nothing new it says why.
 */

export type LabState = 'new' | 'in_progress' | 'completed';

export interface DoneExperiment {
  format: 'design' | 'mission';
  key: string;
  title: string;
  status: string;
  score: number | null;
  scopeLabel: string | null;
  finishedAt: string | null;
}

export interface LabSelection {
  design: { key: string; version: number; state: LabState; model: ExperimentModel } | null;
  mission: { key: string; title: string; state: LabState } | null;
  /** Both cards show the same experiment because no other approved experiment matches these concepts yet. */
  shared: boolean;
  /** How many more new experiments the student could be offered after these. */
  moreDesign: number;
  moreMission: number;
  designNote: string | null;
  missionNote: string | null;
  history: DoneExperiment[];
}

const rec = (v: unknown): Record<string, unknown> => (v && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : {});
const arr = (v: unknown): unknown[] => (Array.isArray(v) ? v : []);
const state = (v: unknown): LabState => (v === 'in_progress' || v === 'completed' ? v : 'new');

export async function fetchLabSelection(chapterId: string | number, scope: ActivityScope, signal?: AbortSignal): Promise<LabSelection> {
  const ctx = buildSessionContext();
  if (!ctx.baseUrl) throw new Error('Session data is missing. Please sign in again.');
  const params = new URLSearchParams();
  appendCommonParams(params, ctx);
  if (ctx.userId) params.set('user_id', ctx.userId);
  addScope(params, scope);
  const response = await fetch(`${ctx.baseUrl}/lms/pal/application-lab/lab-selection/chapter/${encodeURIComponent(String(chapterId))}?${params.toString()}`, {
    headers: { ...createAuthHeaders(ctx), 'X-Requested-With': 'XMLHttpRequest' },
    signal,
  });
  if (!response.ok) throw new Error('Couldn’t choose your experiments. Try again.');
  const p = rec(await response.json());

  const d = rec(p.design);
  const spec = d.spec as LabSpec | undefined;
  const design =
    spec && Array.isArray(spec.items) && spec.model
      ? { key: readString(d.key), version: readNumber(d.version) || 1, state: state(d.state), model: specToModel(spec, readNumber(d.version) || 1) }
      : null;
  const m = rec(p.mission);
  const mission = m.key ? { key: readString(m.key), title: readString(m.title), state: state(m.state) } : null;

  return {
    design,
    mission,
    shared: p.shared === true,
    moreDesign: readNumber(p.more_design),
    moreMission: readNumber(p.more_mission),
    designNote: readString(p.design_note) || null,
    missionNote: readString(p.mission_note) || null,
    history: arr(p.history).map((h) => {
      const r = rec(h);
      return {
        format: r.format === 'mission' ? 'mission' : 'design',
        key: readString(r.key),
        title: readString(r.title) || readString(r.key),
        status: readString(r.status),
        score: typeof r.score === 'number' ? r.score : null,
        scopeLabel: readString(r.scope_label) || null,
        finishedAt: readString(r.finished_at) || null,
      };
    }),
  };
}

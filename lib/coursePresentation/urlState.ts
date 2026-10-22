/**
 * The Course Presentation screen is addressed by the URL, so a reload, Back and a copied link land where the
 * teacher was. Keys are namespaced `cp*` so they never collide with the page's own parameters.
 */
export type CpStage = 'choose' | 'preflight';

export interface CpState {
  open: boolean;
  pedagogy: string | null;
  format: string | null;
  stage: CpStage;
}

const KEYS = ['cpOpen', 'cpPedagogy', 'cpFormat', 'cpStage'] as const;
const SAFE = /^[a-z][a-z0-9_]{0,63}$/;

type Params = Pick<URLSearchParams, 'get'>;

const safe = (v: string | null): string | null => (v !== null && SAFE.test(v) ? v : null);

export function readCpState(params: Params | null | undefined): CpState {
  const open = params?.get('cpOpen') === '1';
  const pedagogy = safe(params?.get('cpPedagogy') ?? null);
  const format = safe(params?.get('cpFormat') ?? null);
  // The pre-flight needs both choices; a link claiming otherwise falls back to choosing.
  const stage: CpStage = params?.get('cpStage') === 'preflight' && pedagogy !== null && format !== null ? 'preflight' : 'choose';
  return { open, pedagogy, format, stage };
}

/**
 * What the screen shows every time it is opened: the choice form with nothing chosen. A reload, Back or a copied link never
 * restores an earlier teaching method, format or pre-flight screen: the teacher chooses again, so what is shown always follows
 * the choice made now.
 */
export function startState(): CpState {
  return { open: true, pedagogy: null, format: null, stage: 'choose' };
}

/** True when the address still carries a choice (or the pre-flight screen) from an earlier visit. */
export function carriesEarlierChoice(state: CpState): boolean {
  return state.pedagogy !== null || state.format !== null || state.stage !== 'choose';
}

export function withoutCpState(params: URLSearchParams): URLSearchParams {
  const next = new URLSearchParams(params.toString());
  KEYS.forEach((k) => next.delete(k));
  return next;
}

export function withCpState(params: URLSearchParams, state: CpState): URLSearchParams {
  const next = withoutCpState(params);
  if (!state.open) return next;
  next.set('cpOpen', '1');
  if (state.pedagogy) next.set('cpPedagogy', state.pedagogy);
  if (state.format) next.set('cpFormat', state.format);
  if (state.stage === 'preflight' && state.pedagogy && state.format) next.set('cpStage', 'preflight');
  return next;
}

import type { ExperimentModel } from './types';

/**
 * The lab to offer for the scope the student chose, given the approved lab the server has for the chapter (or null).
 * A whole-chapter scope always counts; otherwise the scope must touch one of the concepts the lab assesses (a lab that
 * names none fits any). With no lab, the guided design form is used instead.
 */
export function modelForScope(model: ExperimentModel | null, scopeConcepts: string[], wholeChapter: boolean): ExperimentModel | null {
  if (!model) return null;
  if (wholeChapter || model.concepts.length === 0) return model;
  const wanted = scopeConcepts.map((c) => c.toLowerCase());
  return model.concepts.some((c) => wanted.includes(c.toLowerCase())) ? model : null;
}

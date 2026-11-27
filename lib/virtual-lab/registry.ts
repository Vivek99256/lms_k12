import { DISSOLVING_LAB } from './labs/dissolving.config';
import { ICE_MELTING_LAB } from './labs/iceMelting.config';
import { createIceMeltingSimulation } from './sim/iceMelting';
import { createDissolvingSimulation } from './sim/dissolving';
import type { LabConfig, LabSimulation } from './types';

/**
 * Every lab the engine can run. Adding an experiment means adding a config
 * and a simulation here, plus a kit (see kits/index.ts) for any new object
 * kinds. The scene, controls, stages, notebook and saving are shared.
 */
export const VIRTUAL_LABS: LabConfig[] = [DISSOLVING_LAB, ICE_MELTING_LAB];

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function createSimulation(config: LabConfig): LabSimulation<any> {
  switch (config.simulationId) {
    case 'dissolving':
      return createDissolvingSimulation(config);
    case 'ice_melting':
      return createIceMeltingSimulation(config);
    default:
      throw new Error(`No simulation registered for "${config.simulationId}".`);
  }
}

export function getLab(id: string): LabConfig | null {
  return VIRTUAL_LABS.find((lab) => lab.id === id) ?? null;
}

/** The labs that belong to a chapter: by id first, by name keyword as a fallback. */
export function labsForChapter(chapterId: string | number, chapterName: string): LabConfig[] {
  const id = Number(chapterId);
  const name = chapterName.toLowerCase();
  return VIRTUAL_LABS.filter(
    (lab) => lab.chapterIds.includes(id) || lab.chapterKeywords.some((word) => name.includes(word))
  );
}

/**
 * The lab to offer for a chapter and the scope the student chose: a lab written for the chapter whose
 * concepts the scope touches (any scope on the whole chapter counts), or null.
 */
export function labForScope(chapterId: string | number, chapterName: string, scopeConcepts: string[], wholeChapter: boolean): LabConfig | null {
  const wanted = scopeConcepts.map((c) => c.toLowerCase());
  return (
    labsForChapter(chapterId, chapterName).find(
      (lab) => wholeChapter || !lab.concepts || lab.concepts.some((c) => wanted.includes(c.toLowerCase()))
    ) ?? null
  );
}

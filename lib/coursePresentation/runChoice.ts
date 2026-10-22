import type { CpRun, CpRunCoverage } from './api';

/**
 * A generation run belongs to ONE teaching method and ONE content format. The screen shows, polls, approves and discards a run only
 * for exactly the choice the teacher made; the current selection is the source of truth, never a run id left over from another one.
 */

/** True when the run was made for exactly this teaching method and format. A run with no recorded format is an interactive-slides run. */
export function runMatchesChoice(run: Pick<CpRun, 'method'> & { format?: string | null }, pedagogy: string, format: string): boolean {
  return run.method === pedagogy && (run.format ?? 'interactive_slides') === format;
}

/** The run to show for this choice: the given one if it belongs to it (and was not discarded), otherwise none. */
export function runForChoice(run: CpRun | null | undefined, pedagogy: string, format: string): CpRun | null {
  if (!run || run.state === 'discarded') return null;
  return runMatchesChoice(run, pedagogy, format) ? run : null;
}

/** The heading of the list of what is already stored, named for the format the teacher chose (the list holds that format only). */
export function storedHeading(format: string): string {
  if (format === 'branching_scenario') return 'Story lessons already stored';
  if (format === 'interactive_slides') return 'Presentations already stored';
  return 'Already stored in this format';
}

/**
 * What to tell the teacher about how much of the chapter a draft covers. Only a coverage the server actually compared with the
 * chapter's own concept list is described as covering the chapter; otherwise it says plainly that this was not checked.
 */
export function coverageSentence(coverage: CpRunCoverage | null | undefined, ownConcepts: number | null): { verified: boolean; text: string } {
  if (coverage?.checked && coverage.source_concepts !== null) {
    return coverage.missing.length === 0
      ? { verified: true, text: `It teaches all ${coverage.source_concepts} concepts of this chapter's own concept list.` }
      : { verified: true, text: `It teaches ${coverage.taught} of the chapter's ${coverage.source_concepts} concepts; missing: ${coverage.missing.join(', ')}.` };
  }
  return {
    verified: false,
    text: `Its coverage of the chapter's own concept list could not be checked${ownConcepts !== null ? `; the draft lists ${ownConcepts} concepts of its own` : ''}.`,
  };
}

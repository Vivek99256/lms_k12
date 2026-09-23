/**
 * Scoring for H5P Drag and Drop (H5P.DragQuestion).
 *
 * Lives in `lib/` rather than beside the player so it can be tested without a
 * browser, a fetch stub or a React tree. It has no imports for the same reason:
 * the inputs are structural, so `app/h5p/data/h5p.ts` can satisfy them with its
 * own richer row types without either side depending on the other.
 *
 * This was pulled out after a report of "you scored 0 out of 1" on a task whose
 * items were being dropped into the right zones. The cause was authored data --
 * no zone had a correct draggable set -- not the arithmetic here. But the
 * arithmetic was the first suspect and could not be checked in isolation, which
 * is a bad property for the code that decides a student's mark.
 */

export interface ScorableZone {
  id: number;
  /** Draggables that are correct here. The authored answer key. */
  correct_element_ids: number[] | null;
}

export interface ScorableElement {
  id: number;
  /** Zones this draggable may enter. Empty means "anywhere". */
  drop_zone_ids: number[] | null;
  multiple: boolean;
}

export interface ScorableTask {
  zones?: ScorableZone[];
  elements?: ScorableElement[];
  pass_percentage: number;
  apply_penalties: boolean;
  single_point: boolean;
}

export interface DragDropAttemptResult {
  /**
   * Whether the activity has any correct answer defined at all.
   *
   * An author can save a task where every draggable is droppable but none is
   * marked correct. That task is not "worth zero" -- it is unmarkable, and
   * reporting it as 0/1 tells the learner they got it wrong when in fact
   * nothing was ever right. The player branches on this instead of showing a
   * score, and publish is refused server-side for the same reason.
   */
  scoreable: boolean;
  /** Draggables sitting in a zone that accepts them. */
  correct: number;
  /** Draggables sitting in a zone that does not. */
  incorrect: number;
  /** Correct placements the learner did not make. */
  missed: number;
  score: number;
  maxScore: number;
  percentage: number;
  passed: boolean;
  /** Element id -> whether its current placement is correct. Drives the ticks. */
  perElement: Record<number, boolean>;
}

/** Element id -> the zone ids it currently sits in. */
export type DragDropPlacements = Record<number, number[]>;

/**
 * Score one attempt.
 *
 * Deliberately mirrors H5P.DragQuestion rather than inventing a scheme:
 *
 *  - maxScore is the number of correct (element, zone) PAIRS, not the number of
 *    draggables. A one-to-many element that belongs in three zones is worth
 *    three, which is what makes a partly-completed one-to-many task score
 *    proportionally instead of all-or-nothing.
 *  - with `apply_penalties`, a wrong placement subtracts one, floored at zero.
 *    Without it, wrong placements are simply not counted -- which is the right
 *    setting for a young cohort, and why it is an authoring option.
 *  - with `single_point`, the whole task is worth 1 and is awarded only at or
 *    above the pass mark.
 *
 * Everything is compared by numeric id. No label, caption or alt text is read
 * here, so renaming a zone cannot change what is correct, and trailing
 * whitespace or casing in a label cannot make a right answer read as wrong.
 */
export function scoreDragDropAttempt(
  task: ScorableTask,
  placements: DragDropPlacements
): DragDropAttemptResult {
  const zones = task.zones ?? [];
  const elements = task.elements ?? [];

  // Every (element, zone) pair the author marked correct.
  const correctPairs = new Set<string>();
  for (const zone of zones) {
    for (const elementId of zone.correct_element_ids ?? []) {
      correctPairs.add(`${Number(elementId)}:${Number(zone.id)}`);
    }
  }

  let correct = 0;
  let incorrect = 0;
  const perElement: Record<number, boolean> = {};

  for (const element of elements) {
    const placedIn = placements[element.id] ?? [];
    if (placedIn.length === 0) continue;

    let elementAllCorrect = true;
    for (const zoneId of placedIn) {
      if (correctPairs.has(`${Number(element.id)}:${Number(zoneId)}`)) {
        correct += 1;
      } else {
        incorrect += 1;
        elementAllCorrect = false;
      }
    }
    perElement[element.id] = elementAllCorrect;
  }

  // Floored at 1 only to keep the division below finite. When there are no
  // correct pairs at all, `scoreable` is false and no caller shows this number.
  const maxScore = Math.max(1, correctPairs.size);
  const missed = Math.max(0, correctPairs.size - correct);

  const rawScore = task.apply_penalties ? correct - incorrect : correct;
  const boundedScore = Math.max(0, Math.min(maxScore, rawScore));
  const percentage = Math.round((boundedScore / maxScore) * 100);
  const passed = correctPairs.size > 0 && percentage >= (task.pass_percentage ?? 100);

  return {
    scoreable: correctPairs.size > 0,
    correct,
    incorrect,
    missed,
    score: task.single_point ? (passed ? 1 : 0) : boundedScore,
    maxScore: task.single_point ? 1 : maxScore,
    percentage,
    passed,
    perElement,
  };
}

/** The correct placement map, for "Show solution". */
export function dragDropSolution(task: ScorableTask): DragDropPlacements {
  const solution: DragDropPlacements = {};
  for (const zone of task.zones ?? []) {
    for (const elementId of zone.correct_element_ids ?? []) {
      solution[elementId] = [...(solution[elementId] ?? []), zone.id];
    }
  }
  return solution;
}

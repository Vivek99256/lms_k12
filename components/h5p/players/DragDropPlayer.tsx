'use client';

import { MatchingPlayer } from './MatchingPlayer';
import { NotPlayable } from './shared';
import type { PlayerProps } from './types';

/**
 * Drag and drop — and the honest account of why it is a thin wrapper.
 *
 * WHAT H5P.DragQuestion NEEDS AND THE BANK DOES NOT HAVE. A drag question is a
 * background image, a set of draggable elements and a set of DROP ZONES, each
 * with an x, a y, a width and a height on that canvas. The zones are the
 * question: they are what makes one place on the image right and every other
 * place wrong.
 *
 * `lms_question_master` stores none of it. A question's figures carry
 * `url, sha256, width, height, caption, ocr_text, page` — the size of the
 * picture, never a position within it — and 11 of 1,211 rows in a measured
 * chapter carry a figure at all. There is no coordinate anywhere in the
 * schema, so a drag question cannot be derived: it would have to be AUTHORED,
 * which is the manual step this architecture removes.
 *
 * WHAT THIS DOES INSTEAD. A "match the following" question is a drag
 * interaction whose targets are labels rather than places on an image, and
 * that IS derivable. So a match question renders through `MatchingPlayer`,
 * and anything else says plainly what is missing rather than drawing an empty
 * canvas a learner cannot answer.
 *
 * TO MAKE THIS REAL, one of two things has to happen first: drop zones become
 * a stored part of an image question (a schema change plus an authoring
 * surface), or an existing authored `h5p_drag_drop` activity is referenced by
 * the question rather than derived from it.
 */
export function DragDropPlayer(props: PlayerProps) {
  const { question } = props;
  const hasFigure = Array.isArray(question.figures) && question.figures.length > 0;
  const hasImage = hasFigure || /<img/i.test(String(question.question ?? ''));

  // A match question is a drag interaction with label targets: derivable, and
  // already built.
  const code = String(question.question_type_code ?? '').toLowerCase();
  if (code === 'match_following') {
    return <MatchingPlayer {...props} />;
  }

  return (
    <NotPlayable
      reason={
        hasImage
          ? 'This question carries an image but no drop zones. A drag question needs a position on that image for every answer, and the question bank stores image dimensions only — never a coordinate. It has to be authored, or the schema has to carry zones.'
          : 'Only match-the-following questions can be derived as a drag interaction. Everything else needs drop zones, which the question bank does not store.'
      }
    />
  );
}

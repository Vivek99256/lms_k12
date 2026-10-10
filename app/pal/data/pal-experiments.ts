import {
  fetchPrayogshalaForChapter,
  PrayogshalaApiError,
  type PrayogshalaActivity,
  type PrayogshalaChapterContext,
} from '@/app/course-master/data/prayogshala';
import { isEligiblePrayogshalaCard } from '@/lib/prayogshala/cardEligibility';

/**
 * The PAL journey's Experiment step, as data.
 *
 * ---------------------------------------------------------------------------
 * THERE IS NO EXPERIMENT CONTENT TYPE HERE, ON PURPOSE
 * ---------------------------------------------------------------------------
 * Experiments already exist: they are Prayogshala activities, authored and
 * published from Course master and stored in `lms_prayogshala_activity`. This
 * file adds nothing to that. It calls the one existing client
 * (`fetchPrayogshalaForChapter`, i.e. `lms/prayogshala`) and applies the one
 * existing eligibility rule (`isEligiblePrayogshalaCard`) that Course master
 * itself applies before drawing a card, so the journey shows exactly the
 * experiments Course master shows for the same chapter — no more, no fewer.
 *
 * Who sees what is the server's decision, not this file's: a learner is sent
 * published, visible activities only; staff are also sent drafts, and each
 * activity carries its `status` so the UI can label one rather than pass it off
 * as live.
 *
 * ---------------------------------------------------------------------------
 * WHY THE CHAPTER ID IS ENOUGH
 * ---------------------------------------------------------------------------
 * PAL's chapter id and Prayogshala's are the same `chapter_master.id`. The
 * server derives standard and subject from the chapter and answers with them
 * (`chapter.subject_name`), so nothing here names a subject, and a chapter this
 * estate has never seen needs no change.
 */

export interface ChapterExperiments {
  /** The chapter, with its standard and subject by name, as the server resolved it. */
  chapter: PrayogshalaChapterContext;
  /** The chapter's experiments, in the order Course master lists them. */
  experiments: PrayogshalaActivity[];
}

export async function fetchChapterExperiments(
  chapterId: string | number
): Promise<ChapterExperiments> {
  const id = Number(chapterId);
  if (!Number.isInteger(id) || id <= 0) {
    throw new PrayogshalaApiError('This chapter could not be identified.', 400);
  }

  const data = await fetchPrayogshalaForChapter(id);

  return {
    chapter: data.chapter,
    experiments: (data.activities ?? []).filter((activity) =>
      isEligiblePrayogshalaCard({ prayogshala: activity }, id)
    ),
  };
}

export { PrayogshalaApiError };

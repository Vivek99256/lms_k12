'use client';

/**
 * The class-wide counterpart to `app/pal/journey/data/pal-journey.ts`'s
 * single-student `fetchJourneyData()` — never a server-side
 * reimplementation of "which milestone is this student on" (that logic has
 * exactly one home, `currentMilestoneIndex()`/`fetchJourneyData()`), just a
 * batched caller of it, once per student in a class.
 */

import { fetchNewChapterMaster } from '@/app/course-master/data/chapters';
import {
  fetchJourneyData,
  currentMilestoneIndex,
  MILESTONE_ORDER,
  type MilestoneKey,
  type MilestoneStatus,
} from '@/app/pal/journey/data/pal-journey';

export interface ChapterOption {
  id: string;
  name: string;
}

/** Thin wrapper around the course-master chapter list, for the chapter picker — chapters are standard+subject scoped, not division-scoped. */
export async function fetchChapterOptions(params: {
  subInstituteId: number;
  standardId: number;
  subjectId: number;
}): Promise<ChapterOption[]> {
  const response = await fetchNewChapterMaster({
    sub_institute_id: params.subInstituteId,
    standard_id: params.standardId,
    subject_id: params.subjectId,
  });

  return response.data
    .map((chapter, index) => ({
      id: String(chapter.chapter_id ?? chapter.id ?? ''),
      name: chapter.chapter_name || `Chapter ${index + 1}`,
      sortOrder: Number(chapter.sort_order) || index + 1,
    }))
    .filter((chapter) => chapter.id !== '')
    .sort((a, b) => a.sortOrder - b.sortOrder)
    .map(({ id, name }) => ({ id, name }));
}

export interface ClassBoardPosition {
  studentId: string;
  name: string | null;
  status: MilestoneStatus;
}

export interface ClassJourneyResult {
  positionsByMilestone: Record<MilestoneKey, ClassBoardPosition[]>;
  loadedCount: number;
  failedCount: number;
  totalCount: number;
}

function emptyPositions(): Record<MilestoneKey, ClassBoardPosition[]> {
  const positions = {} as Record<MilestoneKey, ClassBoardPosition[]>;
  MILESTONE_ORDER.forEach((key) => {
    positions[key] = [];
  });
  return positions;
}

/**
 * Fans `fetchJourneyData()` out across a class roster, batched (not all at
 * once — a 25-30 student class times fetchJourneyData's own ~6-8 sub-requests
 * is 150-240 requests) and progressive (`onProgress` fires after every batch
 * so the board fills in rather than blocking on the whole class). A known v1
 * limit, not solved here: if this proves too slow in practice the follow-up
 * is a real bulk backend endpoint, not a bigger batch size.
 */
export async function fetchClassJourneyPositions(
  chapterId: string,
  students: Array<{ studentId: string; name: string | null }>,
  onProgress: (partial: ClassJourneyResult) => void,
  signal?: AbortSignal,
  batchSize = 6
): Promise<ClassJourneyResult> {
  const positionsByMilestone = emptyPositions();
  let loadedCount = 0;
  let failedCount = 0;

  for (let start = 0; start < students.length; start += batchSize) {
    if (signal?.aborted) break;
    const batch = students.slice(start, start + batchSize);

    const results = await Promise.allSettled(
      batch.map((student) => fetchJourneyData(chapterId, signal, student.studentId))
    );

    results.forEach((result, i) => {
      if (result.status === 'fulfilled') {
        const data = result.value;
        const milestone = data.milestones[currentMilestoneIndex(data)];
        positionsByMilestone[milestone.key].push({
          studentId: batch[i].studentId,
          name: batch[i].name,
          status: milestone.status,
        });
        loadedCount += 1;
      } else {
        failedCount += 1;
      }
    });

    if (signal?.aborted) break;
    onProgress({ positionsByMilestone, loadedCount, failedCount, totalCount: students.length });
  }

  return { positionsByMilestone, loadedCount, failedCount, totalCount: students.length };
}

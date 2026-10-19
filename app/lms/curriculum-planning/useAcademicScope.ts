'use client';

// Standard/Subject/Curriculum(/Chapter) selection shared across the Curriculum
// Exploration, CG/LO Analysis and Lesson Plans tabs, lifted out of OutcomesTab
// (which used to own this privately) so switching tabs never resets it.
//
// chapterOptions is derived from the curriculum tree already in memory - no
// second fetch. Chapter scope is deliberately NOT sent to the outcomes API
// (CurriculumOutcomesApiController has no chapter_id parameter; chapter_id is
// 0 on every goal/competency row), so chapterId only matters to the
// Curriculum Exploration and Lesson Plans tabs.

import { useEffect, useMemo, useState } from 'react';
import type { ApiChapter, ApiCurriculum } from './types';

export type ScopeOption = { id: string; label: string; value: string };

export type AcademicScope = {
  standardId: number | null;
  subjectId: number | null;
  curriculumId: number | null;
  chapterId: number | null;
  setChapterId: (id: number | null) => void;
  activeCurriculum: ApiCurriculum | null;
  chapterOptions: ApiChapter[];
  standardOptions: ScopeOption[];
  subjectOptions: ScopeOption[];
  curriculumOptions: ScopeOption[];
  handleStandardChange: (value: string) => void;
  handleSubjectChange: (value: string) => void;
  handleCurriculumChange: (value: string) => void;
};

export function useAcademicScope(curricula: ApiCurriculum[]): AcademicScope {
  const [standardId, setStandardId] = useState<number | null>(null);
  const [subjectId, setSubjectId] = useState<number | null>(null);
  const [curriculumId, setCurriculumId] = useState<number | null>(null);
  const [chapterId, setChapterId] = useState<number | null>(null);

  // There is no reliable "current class" to default to (see useLmsSession's
  // own note on this) - default to the first curriculum once the list
  // arrives, same as every other filtered page in this app.
  useEffect(() => {
    if (curriculumId !== null || curricula.length === 0) return;
    const first = curricula[0];
    setStandardId(first.standard_id);
    setSubjectId(first.subject_id);
    setCurriculumId(first.curriculum_id);
  }, [curricula, curriculumId]);

  // Chapter selection only makes sense within the active curriculum.
  useEffect(() => {
    setChapterId(null);
  }, [standardId, subjectId, curriculumId]);

  const standardOptions = useMemo<ScopeOption[]>(() => {
    const seen = new Map<number, string>();
    curricula.forEach((c) => {
      if (!seen.has(c.standard_id)) seen.set(c.standard_id, c.standard_name ?? `Std ${c.standard_id}`);
    });
    return Array.from(seen.entries()).map(([id, label]) => ({ id: String(id), label, value: String(id) }));
  }, [curricula]);

  const subjectOptions = useMemo<ScopeOption[]>(() => {
    const seen = new Map<number, string>();
    curricula
      .filter((c) => standardId === null || c.standard_id === standardId)
      .forEach((c) => {
        if (!seen.has(c.subject_id)) seen.set(c.subject_id, c.subject_name);
      });
    return Array.from(seen.entries()).map(([id, label]) => ({ id: String(id), label, value: String(id) }));
  }, [curricula, standardId]);

  const curriculumOptions = useMemo<ScopeOption[]>(
    () =>
      curricula
        .filter((c) => (standardId === null || c.standard_id === standardId) && (subjectId === null || c.subject_id === subjectId))
        .map((c) => ({ id: String(c.curriculum_id), label: c.curriculum_name || `Curriculum #${c.curriculum_id}`, value: String(c.curriculum_id) })),
    [curricula, standardId, subjectId]
  );

  const activeCurriculum = useMemo(
    () => curricula.find((c) => c.curriculum_id === curriculumId) ?? null,
    [curricula, curriculumId]
  );

  const chapterOptions = useMemo<ApiChapter[]>(
    () => activeCurriculum?.units.flatMap((u) => u.chapters) ?? [],
    [activeCurriculum]
  );

  const handleStandardChange = (value: string) => {
    const id = Number(value) || null;
    setStandardId(id);
    const match = curricula.find((c) => c.standard_id === id);
    setSubjectId(match?.subject_id ?? null);
    setCurriculumId(match?.curriculum_id ?? null);
  };

  const handleSubjectChange = (value: string) => {
    const id = Number(value) || null;
    setSubjectId(id);
    const match = curricula.find((c) => c.standard_id === standardId && c.subject_id === id);
    setCurriculumId(match?.curriculum_id ?? null);
  };

  const handleCurriculumChange = (value: string) => {
    setCurriculumId(Number(value) || null);
  };

  return {
    standardId,
    subjectId,
    curriculumId,
    chapterId,
    setChapterId,
    activeCurriculum,
    chapterOptions,
    standardOptions,
    subjectOptions,
    curriculumOptions,
    handleStandardChange,
    handleSubjectChange,
    handleCurriculumChange,
  };
}

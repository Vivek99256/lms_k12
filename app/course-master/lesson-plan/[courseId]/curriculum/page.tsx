'use client';

import { useEffect, useMemo, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import {
  BookOpen,
  CalendarDays,
  ChevronDown,
  ChevronRight,
  FlaskConical,
  GraduationCap,
  List,
} from 'lucide-react';
import { getRequestContext, getSyear } from '../../../page';
import { getSubjectAndChapters, type Chapter, type SubjectWithChapters } from '../../../data/chapters';
import type { Course } from '../../../data/courses';
import { fetchLmsCourses, type LmsSubject } from '../../../data/lmsCourses';
import {
  fetchCurriculumData,
  getCurriculumLabel,
  getCurriculumSession,
  type CurriculumApiResult,
  type OutcomeNode,
} from '../../../data/curriculum';

type ResolvedCurriculumTarget = {
  subjectId: string;
  standardId?: string;
  subjectData: SubjectWithChapters | null;
};

function getCourseGradeLabel(standardName?: string | null) {
  // Matches the Lesson plans and Chapters tabs: with no grade to show, render
  // nothing rather than a bare "Grade" with no number after it.
  const grade = String(standardName ?? '').replace('Class', '').trim();
  return grade ? `Grade ${grade}` : '';
}

/**
 * Concepts stored for a chapter, counted the same way the Lesson plans tab
 * counts them: prefer the expanded concept rows, else the semantic total.
 */
function getChapterConceptCount(chapter: Chapter): number {
  const conceptRows = chapter.concepts?.length ?? 0;
  if (conceptRows > 0) return conceptRows;

  const semanticTotal = Number(chapter.semantic?.total_concepts);
  return Number.isFinite(semanticTotal) && semanticTotal > 0 ? semanticTotal : 0;
}

function normalizeNumericString(value?: string | null): string | undefined {
  if (!value) return undefined;
  return /^\d+$/.test(value) ? value : undefined;
}

function parseUnitChapters(value: string | string[] | null): string[] {
  if (Array.isArray(value)) return value.filter(Boolean);
  if (!value) return [];

  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === 'string') : [];
  } catch {
    return [];
  }
}


async function resolveCurriculumTarget(
  rawCourseId: string,
  fallbackCourse?: Course
): Promise<ResolvedCurriculumTarget | null> {
  const courseIdParts = rawCourseId.includes('-') ? rawCourseId.split('-', 2) : [rawCourseId];
  const routeSubjectId = normalizeNumericString(courseIdParts[0]);
  const routeStandardId = normalizeNumericString(courseIdParts[1]);

  if (routeSubjectId) {
    const subjectData = await getSubjectAndChapters(routeSubjectId, routeStandardId);
    if (subjectData.subject) {
      return {
        subjectId: String(subjectData.subject.subject_id),
        standardId: String(subjectData.subject.standard_id),
        subjectData,
      };
    }
  }

  const requestContext = getRequestContext();
  if (!requestContext || !fallbackCourse) {
    return null;
  }

  const response = await fetchLmsCourses({
    type: 'API',
    sub_institute_id: requestContext.sub_institute_id,
    syear: getSyear(),
    user_id: requestContext.user_id,
    user_profile_name: requestContext.user_profile_name,
    user_profile_id: requestContext.user_profile_id,
    client_id: requestContext.client_id,
  });

  const fallbackGrade = fallbackCourse.classGrade.replace('Class', '').trim();
  const matchedSubject = response.lms_subject.find((subject: LmsSubject) => {
    const sameSubject = subject.subject_name.toLowerCase() === fallbackCourse.subject.toLowerCase();
    const sameStandard = String(subject.standard_name).trim() === fallbackGrade;
    return sameSubject && sameStandard;
  });

  if (!matchedSubject) {
    return null;
  }

  const subjectData = await getSubjectAndChapters(
    String(matchedSubject.subject_id),
    String(matchedSubject.standard_id)
  );

  return {
    subjectId: String(matchedSubject.subject_id),
    standardId: String(matchedSubject.standard_id),
    subjectData,
  };
}

function buildLiveCourse(
  courseId: string,
  subjectData: SubjectWithChapters | null,
  fallbackCourse?: Course
): Course | undefined {
  if (subjectData?.subject) {
    return {
      id: courseId,
      title: subjectData.subject.subject_name,
      code: '',
      subject: subjectData.subject.subject_name,
      category: subjectData.subject.content_category,
      classGrade: `Class ${subjectData.subject.standard_name}`,
      status: 'Active',
      chapters: subjectData.chapters.length ?? 0,
      enrollments: 0,
      progress: 0,
      instructor: '',
      createdAt: '',
      accentColor: '#5648E8',
      icon: 'book-open',
    };
  }

  return fallbackCourse;
}

function OutcomeTree({
  nodes,
  level = 0,
}: {
  nodes: OutcomeNode[];
  level?: number;
}) {
  return (
    <div className={level === 0 ? 'mt-3' : 'mt-4 border-l border-[#E2E8F0] pl-4'}>
      {nodes.map((node, index) => (
        <div
          key={node.id}
          className={index === 0 ? 'overflow-visible' : 'overflow-visible border-t border-[#E2E8F0] pt-4'}
        >
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex min-w-12 items-center justify-center rounded-md border border-[#D8E1F0] bg-[#F8FAFC] px-2.5 py-1 text-[12px] font-semibold text-[#475569]">
              {node.code || 'No code'}
            </span>
            {node.type ? (
              <span className="rounded-full bg-[#EEF2FF] px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.08em] text-[#4F46E5]">
                {node.type}
              </span>
            ) : null}
          </div>

          <div className="group relative mt-2 min-w-0 overflow-visible">
            <p className="truncate text-[14px] leading-6 text-[#0F172A] sm:text-[15px]">
              {node.description || 'No description available'}
            </p>
            <div
              className={`pointer-events-none absolute left-0 z-[9999] hidden w-max max-w-[420px] whitespace-normal rounded-lg bg-slate-900 px-3 py-2 text-xs leading-5 text-white shadow-xl group-hover:block ${
                index >= nodes.length - 2 ? 'bottom-full mb-2' : 'top-full mt-2'
              }`}
            >
              {node.description || 'No description available'}
            </div>
          </div>

          {node.children?.length > 0 ? (
            <OutcomeTree nodes={node.children} level={level + 1} />
          ) : null}
        </div>
      ))}
    </div>
  );
}

export default function CurriculumPage() {
  const router = useRouter();
  const params = useParams();
  const courseIdParam = params?.courseId;
  const courseId = Array.isArray(courseIdParam) ? courseIdParam[0] : String(courseIdParam ?? '');
  const [subjectData, setSubjectData] = useState<SubjectWithChapters | null>(null);
  const [curriculumResponse, setCurriculumResponse] = useState<CurriculumApiResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [openUnitId, setOpenUnitId] = useState<number | null>(null);
  const [openOutcomeId, setOpenOutcomeId] = useState<number | null>(null);

  // Same courseId parsing the Lesson plans tab uses: "<subjectId>-<standardId>",
  // passed through verbatim rather than through normalizeNumericString, which
  // drops any part that is not purely digits.
  const courseIdParts = courseId.includes('-') ? courseId.split('-', 2) : [];
  const subjectId = courseIdParts[0] ?? '';
  const standardId = courseIdParts[1];
  const isLmsRoute = Boolean(subjectId && standardId);

  // The heading names the subject and grade exactly like Lesson plans and
  // Chapters, so it loads on its own. Previously the only path to the subject
  // ran inside the curriculum effect below, behind a getCurriculumSession()
  // guard that returns early — with no session, or with a curriculum record
  // that fails to load, the header was left with no subject and no grade.
  useEffect(() => {
    if (!isLmsRoute) return;
    let cancelled = false;

    getSubjectAndChapters(subjectId, standardId).then((data) => {
      if (!cancelled && data.subject) setSubjectData(data);
    });

    return () => {
      cancelled = true;
    };
  }, [isLmsRoute, subjectId, standardId]);

  useEffect(() => {
    let cancelled = false;

    async function loadCurriculum() {
      const session = getCurriculumSession();

      if (!session || !courseId) {
        if (!cancelled) {
          setError('Unable to load curriculum data.');
          setLoading(false);
        }
        return;
      }

      setLoading(true);
      setError(null);

      try {
        const target = await resolveCurriculumTarget(courseId);
        if (!target) {
          throw new Error('Curriculum target not resolved');
        }

        if (cancelled) return;

        // Publish the subject as soon as it resolves. The heading reads the
        // subject and grade from here, so holding it back until the curriculum
        // call returns leaves the header blank whenever that call fails or
        // returns nothing — Lesson plans and Chapters name the subject
        // regardless of their own content loading.
        if (target.subjectData?.subject) {
          setSubjectData(target.subjectData);
        }

        const curriculumResult = await fetchCurriculumData(
          session,
          target.subjectId,
          target.standardId
        );

        if (cancelled) return;

        setCurriculumResponse(curriculumResult);
        setOpenUnitId(curriculumResult.unit_data[0]?.unit_number ?? null);
        setOpenOutcomeId(curriculumResult.outcomes[0]?.id ?? null);
      } catch {
        if (!cancelled) {
          setError('Unable to load curriculum data.');
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    void loadCurriculum();

    return () => {
      cancelled = true;
    };
  }, [courseId]);

  const course = buildLiveCourse(courseId, subjectData);
  const curriculumData = curriculumResponse?.curriculum_data ?? null;
  const unitData = curriculumResponse?.unit_data ?? [];
  const outcomes = curriculumResponse?.outcomes ?? [];
  const gradeLabel = getCourseGradeLabel(subjectData?.subject?.standard_name ?? course?.classGrade);

  // "Mathematics - Grade 7", identical to the Lesson plans and Chapters tabs.
  // Only when the subject has not resolved do we fall back to naming the
  // curriculum, so the header is never left as a bare "Grade".
  const headerTitle =
    [course?.subject, gradeLabel].filter(Boolean).join(' - ') ||
    curriculumData?.curriculum_name ||
    'Curriculum';

  // "16 chapters - 406 key concepts - CBSE curriculum", the same three parts the
  // other two tabs show beneath the heading. The board comes from the tenant's
  // curriculum record, so when there is none the label is dropped rather than
  // replaced with a placeholder.
  const headerMeta = useMemo(() => {
    const chapters = subjectData?.chapters ?? [];
    const conceptCount = chapters.reduce(
      (total, chapter) => total + getChapterConceptCount(chapter),
      0
    );
    const curriculumLabel = curriculumResponse ? getCurriculumLabel(curriculumData) : '';

    return [
      `${chapters.length} chapters`,
      `${conceptCount} key concepts`,
      curriculumLabel,
    ]
      .filter(Boolean)
      .join(' - ');
  }, [subjectData?.chapters, curriculumResponse, curriculumData]);

  if (!courseId) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50/50">
        <div className="text-center">
          <h2 className="mb-2 text-xl font-semibold text-slate-900">Course not found</h2>
          <p className="text-slate-500">The requested course could not be found.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen rounded-t-3xl bg-[#E9EEF7]">
      <div className="mx-auto max-w-[1480px] px-4 py-6 sm:px-6 lg:px-8">
        <div className="mb-5 flex flex-wrap items-center gap-2 text-[15px] text-[#475569]">
          <span className="inline-flex items-center gap-2">
            <BookOpen size={14} className="text-[#475569]" />
            Teach / learn
          </span>
          <ChevronRight size={14} className="text-[#94A3B8]" />
          <span>Subjects</span>
          <ChevronRight size={14} className="text-[#94A3B8]" />
          <span className="font-medium text-[#0F172A]">
            {headerTitle}
          </span>
        </div>

        <div className="mb-5 rounded-[18px] bg-transparent">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div className="flex items-start gap-4">
              <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-[14px] bg-white text-[#4F46E5] shadow-[0_1px_6px_rgba(15,23,42,0.06)]">
                <FlaskConical size={26} />
              </div>
              <div>
                <h1 className="text-[30px] font-semibold tracking-tight text-[#0F172A] sm:text-[34px]">
                  {headerTitle}
                </h1>
                {headerMeta ? (
                  <p className="mt-1 text-[15px] text-[#475569] sm:text-[16px]">{headerMeta}</p>
                ) : null}
                
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {curriculumData?.internal_marks != null ? (
                <span className="rounded-full bg-white px-4 py-2 text-[13px] font-semibold text-[#4F46E5] shadow-[0_1px_6px_rgba(15,23,42,0.06)]">
                  Internal marks {curriculumData.internal_marks}
                </span>
              ) : null}
              {curriculumData?.status ? (
                <span className="rounded-full border border-[#D8E1F0] bg-white px-4 py-2 text-[13px] font-semibold capitalize text-[#334155] shadow-[0_1px_6px_rgba(15,23,42,0.06)]">
                  {curriculumData.status}
                </span>
              ) : null}
            </div>
          </div>
        </div>

        <div className="mb-4 border-b border-[#D8E1F0]">
          <div className="flex flex-wrap items-center gap-8">
            <button
              type="button"
              onClick={() => router.push(`/course-master/lesson-plan/${courseId}`)}
              className="pb-3 text-[15px] font-medium text-[#334155] transition hover:text-[#0F172A]"
            >
              <span className="inline-flex items-center gap-2">
                <CalendarDays size={16} />
                Lesson plans
              </span>
            </button>
            <button
              type="button"
              className="border-b-2 border-[#4F46E5] pb-3 text-[15px] font-medium text-[#4F46E5]"
            >
              <span className="inline-flex items-center gap-2">
                <GraduationCap size={16} />
                Curriculum
              </span>
            </button>
            <button
              type="button"
              onClick={() => router.push(`/course-master/${courseId}/chapters`)}
              className="pb-3 text-[15px] font-medium text-[#334155] transition hover:text-[#0F172A]"
            >
              <span className="inline-flex items-center gap-2">
                <List size={16} />
                Chapters
              </span>
            </button>
          </div>
        </div>

        {loading ? (
          <div className="rounded-[18px] border border-[#D8E1F0] bg-white px-6 py-14 text-center text-[15px] text-[#64748B] shadow-[0_2px_10px_rgba(15,23,42,0.05)]">
            Loading curriculum...
          </div>
        ) : error ? (
          <div className="rounded-[18px] border border-[#D8E1F0] bg-white px-6 py-14 text-center text-[15px] text-[#64748B] shadow-[0_2px_10px_rgba(15,23,42,0.05)]">
            {error}
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-5 xl:grid-cols-2">
            <section className="flex min-h-[560px] flex-col overflow-hidden rounded-[18px] border border-[#D8E1F0] bg-white shadow-[0_2px_10px_rgba(15,23,42,0.05)]">
              <div className="flex-1 overflow-y-auto px-4 py-4 sm:px-5">
                {unitData.length === 0 ? (
                  <div className="rounded-2xl border border-dashed border-[#D8E1F0] bg-[#F8FAFC] px-5 py-12 text-center text-[14px] text-[#64748B]">
                    No units available.
                  </div>
                ) : (
                  <div className="space-y-3">
                    {unitData.map((unit) => {
                      const isOpen = openUnitId === unit.unit_number;
                      const unitChapters = parseUnitChapters(unit.unit_chapters);
                      const ToggleIcon = isOpen ? ChevronDown : ChevronRight;
                      const subtitleParts = [
                        unitChapters.length > 0 ? `${unitChapters.length} chapter${unitChapters.length === 1 ? '' : 's'}` : null,
                        unit.total_marks != null ? `${unit.total_marks} marks` : null,
                        unit.planned_periods ? String(unit.planned_periods) : null,
                      ].filter(Boolean);

                      return (
                        <div
                          key={`${unit.unit_number}-${unit.name}`}
                          className="overflow-hidden rounded-[16px] border border-[#D8E1F0] bg-white"
                        >
                          <button
                            type="button"
                            onClick={() =>
                              setOpenUnitId((current) =>
                                current === unit.unit_number ? null : unit.unit_number
                              )
                            }
                            className="flex w-full items-start gap-3 px-4 py-4 text-left sm:px-5"
                          >
                            <span className="mt-0.5 shrink-0 text-[#64748B]">
                              <ToggleIcon size={18} />
                            </span>
                            <div className="min-w-0 flex-1">
                              <h3 className="text-[16px] font-bold leading-6 text-[#0F172A] sm:text-[17px]">
                                Unit {unit.unit_number} · {unit.name || `Unit ${unit.unit_number}`}
                              </h3>
                              {subtitleParts.length > 0 ? (
                                <p className="mt-1 text-[13px] leading-5 text-[#64748B] sm:text-[14px]">
                                  {subtitleParts.join(' · ')}
                                </p>
                              ) : null}
                            </div>
                          </button>

                          {isOpen ? (
                            <div className="border-t border-[#E2E8F0] px-4 py-5 sm:px-5">
                              <p className="text-[12px] font-semibold uppercase tracking-[0.14em] text-[#64748B]">
                                Chapters
                              </p>
                              {unitChapters.length === 0 ? (
                                <p className="mt-3 text-[14px] text-[#64748B]">No chapters available.</p>
                              ) : (
                                <div className="mt-3 space-y-3">
                                  {unitChapters.map((chapterName, index) => (
                                    <div
                                      key={`${unit.unit_number}-${chapterName}-${index}`}
                                      className="py-2 text-[14px] text-[#0F172A] sm:text-[15px]"
                                    >
                                      <span className="leading-6">{chapterName}</span>
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>
                          ) : null}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </section>

            <section className="flex min-h-[560px] flex-col overflow-visible rounded-[18px] border border-[#D8E1F0] bg-white shadow-[0_2px_10px_rgba(15,23,42,0.05)]">
              <div className="flex-1 overflow-y-auto overflow-x-visible px-4 py-4 sm:px-5">
                {outcomes.length === 0 ? (
                  <div className="rounded-2xl border border-dashed border-[#D8E1F0] bg-[#F8FAFC] px-5 py-12 text-center text-[14px] text-[#64748B]">
                    No outcomes available.
                  </div>
                ) : (
                  <div className="space-y-3">
                    {outcomes.map((outcome) => {
                      const isOpen = openOutcomeId === outcome.id;
                      const ToggleIcon = isOpen ? ChevronDown : ChevronRight;
                      const childCount = outcome.children?.length ?? 0;
                      const subtitle =
                        childCount > 0
                          ? `${childCount} ${childCount === 1 ? 'competency' : 'competencies'}`
                          : null;

                      return (
                        <div
                          key={outcome.id}
                          className="overflow-visible rounded-[16px] border border-[#D8E1F0] bg-white"
                        >
                          <button
                            type="button"
                            onClick={() =>
                              setOpenOutcomeId((current) => (current === outcome.id ? null : outcome.id))
                            }
                            className="flex w-full items-start gap-3 px-4 py-4 text-left sm:px-5"
                          >
                            <span className="mt-0.5 shrink-0 text-[#64748B]">
                              <ToggleIcon size={18} />
                            </span>
                            <div className="min-w-0 flex-1">
                              <h3 className="text-[16px] font-bold leading-6 text-[#0F172A] sm:text-[17px]">
                                {(outcome.code || 'No code')} · {outcome.description || 'No description available'}
                              </h3>
                              {subtitle ? (
                                <p className="mt-1 text-[13px] leading-5 text-[#64748B] sm:text-[14px]">
                                  {subtitle}
                                </p>
                              ) : null}
                            </div>
                          </button>

                          {isOpen && childCount > 0 ? (
                            <div className="overflow-visible border-t border-[#E2E8F0] px-4 py-5 sm:px-5">
                              <p className="text-[12px] font-semibold uppercase tracking-[0.14em] text-[#64748B]">
                                Competencies
                              </p>
                              {childCount > 0 ? (
                                <OutcomeTree nodes={outcome.children} />
                              ) : (
                                <p className="text-[14px] text-[#64748B]">No child outcomes available.</p>
                              )}
                            </div>
                          ) : null}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </section>
          </div>
        )}
      </div>
    </div>
  );
}

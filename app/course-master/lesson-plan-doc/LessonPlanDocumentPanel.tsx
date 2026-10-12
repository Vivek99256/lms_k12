'use client';

/**
 * The actual Lesson Plan content for one chapter, sourced from
 * lms_lesson_plan / lms_lessonplan_dayswise via GET /api/lesson-plan-doc.
 *
 * Shared between its own page (app/course-master/lesson-plan-doc/[courseId])
 * and the "Lesson Plan" tab embedded in the AI Lesson Intelligence page
 * (app/course-master/lesson-plan/[courseId]) - one implementation, two call
 * sites, so the two never drift apart. Chapter list and chapter selection are
 * owned by the host page; this component only needs the result.
 *
 * Interaction model intentionally mirrors the old K12 ERP's lesson plan
 * screen, redesigned: a compact label grid across the five categories
 * (Summary / Teaching / Learning / Day Planning / Map & Alignment). Clicking
 * a label expands that same grid cell in place to show its value - no
 * separate panel elsewhere on the page. A per-row control expands/collapses
 * every field in that row together, and a global control expands/collapses
 * everything at once. Day Planning entries (a variable-length list, unlike
 * the other four fixed categories) get their own section below with the same
 * expand-in-place treatment per day.
 */

import { useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import {
  NotebookText,
  CalendarCheck,
  ChevronDown,
  ChevronsDownUp,
  ChevronsUpDown,
  Timer,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { EmptyState } from '@/components/ui/empty-state';
import { ErrorState } from '@/components/ui/error-state';
import { sanitizeHtml } from '@/lib/security/sanitize-html';
import { cn } from '@/lib/utils';
import type { Chapter } from '../data/chapters';
import { getCurriculumSession } from '../data/curriculum';
import { fetchLessonPlanDocument, type LessonPlanActivity, type LessonPlanDocument } from '../data/lessonPlanDocument';

type Category = 'summary' | 'teaching' | 'learning' | 'map';

const CATEGORY_META: Record<Category, { label: string; accent: string; soft: string; border: string }> = {
  summary: { label: 'Summary', accent: '#5648E8', soft: '#F1F0FE', border: '#D9D5FB' },
  teaching: { label: 'Teaching', accent: '#0284C7', soft: '#EDF8FF', border: '#BEE4FB' },
  learning: { label: 'Learning', accent: '#16A34A', soft: '#EFFBF3', border: '#C3EDD2' },
  map: { label: 'Map & Alignment', accent: '#D97706', soft: '#FFF7E8', border: '#FBE3B8' },
};

const DAY_META = { label: 'Day Planning', accent: '#9333EA', soft: '#F8F1FE', border: '#E6D3FB' };

interface FieldDef {
  key: string;
  label: string;
  content: () => React.ReactNode;
  hasContent: boolean;
}

function textField(key: string, label: string, value: string | number | null | undefined): FieldDef {
  const hasContent = value !== null && value !== undefined && String(value).trim() !== '';
  return {
    key,
    label,
    hasContent,
    content: () => (
      <p className={hasContent ? 'text-[15px] text-slate-800' : 'text-sm italic text-slate-400'}>
        {hasContent ? value : 'Not provided yet.'}
      </p>
    ),
  };
}

function htmlField(key: string, label: string, html: string | null | undefined, activities?: LessonPlanActivity[]): FieldDef {
  const hasContent = Boolean(html && html.trim());
  return {
    key,
    label,
    hasContent: hasContent || Boolean(activities?.length),
    content: () => (
      <div>
        {hasContent ? (
          <div
            className="prose prose-sm max-w-none text-slate-700 prose-p:my-1.5"
            dangerouslySetInnerHTML={{ __html: sanitizeHtml(html) }}
          />
        ) : (
          <p className="text-sm italic text-slate-400">Not provided yet.</p>
        )}
        {activities?.length ? (
          <div className="mt-3 flex flex-wrap gap-1.5">
            {activities.map((item) => (
              <Badge key={item.id} variant="outline">
                {item.title || `#${item.id}`}
              </Badge>
            ))}
          </div>
        ) : null}
      </div>
    ),
  };
}

function mappingField(plan: LessonPlanDocument): FieldDef {
  const mapping = plan.summary.mapping;
  return {
    key: 'summary.mapping',
    label: 'Mapping',
    hasContent: mapping.length > 0,
    content: () =>
      mapping.length ? (
        <div className="flex flex-wrap gap-1.5">
          {mapping.map((entry, index) => (
            <Badge key={index} variant="secondary">
              {entry.type ? `${entry.type}: ` : ''}
              {entry.value ?? 'Unknown'}
            </Badge>
          ))}
        </div>
      ) : (
        <p className="text-sm italic text-slate-400">No mapping values set.</p>
      ),
  };
}

interface FieldRow {
  summary?: FieldDef;
  teaching?: FieldDef;
  learning?: FieldDef;
  map?: FieldDef;
}

function buildRows(plan: LessonPlanDocument): FieldRow[] {
  return [
    {
      summary: textField('summary.standard', 'Standard', plan.standard_name),
      teaching: htmlField('teaching.focus_point', 'Focus Point', plan.teaching.focus_point),
      learning: htmlField('learning.objective', 'Learning Objective', plan.learning.learning_objective),
      map: htmlField('map.hard_word', 'Hard Word With Image', plan.map_and_alignment.hard_word),
    },
    {
      summary: textField('summary.subject', 'Subject', plan.subject_name),
      teaching: htmlField('teaching.pedagogy', 'Pedagogical process', plan.teaching.pedagogical_process),
      learning: htmlField('learning.knowledge', 'Learning outcome : knowledge', plan.learning.learning_knowledge),
      map: htmlField('map.tag', 'Tag & Metatag', plan.map_and_alignment.tag_metatag),
    },
    {
      summary: textField('summary.chapter', 'Chapter', plan.chapter_name),
      teaching: htmlField('teaching.resource', 'Resource', plan.teaching.resource),
      learning: htmlField('learning.skill', 'Learning outcome : skill', plan.learning.learning_skill),
      map: htmlField('map.value', 'Value integrations', plan.map_and_alignment.value_integration),
    },
    {
      summary: textField('summary.periods', 'Number of period', plan.summary.number_of_periods),
      teaching: htmlField(
        'teaching.presentation',
        'Classroom presentation',
        plan.teaching.classroom_presentation,
        plan.teaching.classroom_activity
      ),
      learning: htmlField('learning.prerequisite', 'Prerequisite Lessons', plan.learning.prerequisite),
      map: htmlField('map.global', 'Global connection', plan.map_and_alignment.global_connection),
    },
    {
      summary: textField('summary.teaching_time', 'Teaching time', plan.summary.teaching_time),
      teaching: htmlField('teaching.diversity', 'Classroom diversity', plan.teaching.classroom_diversity),
      learning: htmlField(
        'learning.self_study',
        'Self-Study & Homework',
        plan.learning.self_study_homework,
        plan.learning.self_study_activity
      ),
      map: htmlField('map.cross_curriculum', 'Cross curriculum', plan.map_and_alignment.cross_curriculum),
    },
    {
      summary: textField('summary.assessment_time', 'Assessment time', plan.summary.assessment_time),
      learning: htmlField('learning.assessment', 'Assessment', plan.learning.assessment, plan.learning.assessment_activity),
      map: htmlField('map.sel', 'SEL (Social & emotional learning)', plan.map_and_alignment.sel),
    },
    {
      summary: textField('summary.learning_time', 'Learning Time', plan.summary.learning_time),
      map: htmlField('map.stem', 'STEM', plan.map_and_alignment.stem),
    },
    {
      summary: htmlField('summary.assessment_qualifying', 'Assessment Qualifying', plan.summary.assessment_qualifying),
      map: htmlField('map.vocational', 'Vocational training', plan.map_and_alignment.vocational_training),
    },
    {
      summary: mappingField(plan),
      map: htmlField('map.simulation', 'Simulation', plan.map_and_alignment.simulation),
    },
    { map: htmlField('map.games', 'Games', plan.map_and_alignment.games) },
    { map: htmlField('map.activities', 'Activities', plan.map_and_alignment.activities) },
    {
      map: htmlField('map.real_life', 'Real-Life Application', plan.map_and_alignment.real_life_application),
    },
  ];
}

/**
 * One cell in the field index. Collapsed, it's a compact label chip; clicking
 * it expands the same cell in place to show the field's value - no separate
 * panel elsewhere on the page. The surrounding CSS grid row grows to fit it,
 * other cells in that row just stay top-aligned at their normal height.
 */
function GridChip({
  field,
  category,
  expanded,
  onToggle,
  registerRef,
}: {
  field?: FieldDef;
  category: Category;
  expanded: boolean;
  onToggle: (key: string) => void;
  registerRef: (key: string, el: HTMLDivElement | null) => void;
}) {
  if (!field) return <div className="min-h-[40px] self-start" />;
  const meta = CATEGORY_META[category];

  return (
    <div ref={(el) => registerRef(field.key, el)} className="self-start">
      <AnimatePresence initial={false} mode="wait">
        {expanded ? (
          <motion.div
            key="expanded"
            initial={{ opacity: 0, scale: 0.97 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.97 }}
            transition={{ duration: 0.16 }}
            className="overflow-hidden rounded-lg border shadow-sm"
            style={{ borderColor: meta.accent, backgroundColor: meta.soft }}
          >
            <button
              type="button"
              onClick={() => onToggle(field.key)}
              className="flex w-full items-center justify-between gap-2 px-3 py-2 text-left"
            >
              <span className="flex min-w-0 items-center gap-1.5 text-[13px] font-semibold" style={{ color: meta.accent }}>
                <span className="h-1.5 w-1.5 shrink-0 rounded-full" style={{ backgroundColor: meta.accent }} />
                <span className="truncate">{field.label}</span>
              </span>
              <ChevronDown className="h-3.5 w-3.5 shrink-0 rotate-180 text-slate-400" />
            </button>
            <div className="px-3 pb-3 text-[13px]">{field.content()}</div>
          </motion.div>
        ) : (
          <motion.button
            key="collapsed"
            type="button"
            initial={{ opacity: 0, scale: 0.97 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.97 }}
            transition={{ duration: 0.16 }}
            onClick={() => onToggle(field.key)}
            className={cn(
              'flex w-full items-center justify-between gap-2 rounded-lg border px-3 py-2 text-left text-[13px] font-medium transition hover:shadow-sm',
              field.hasContent ? 'text-slate-800' : 'text-slate-400'
            )}
            style={{
              backgroundColor: field.hasContent ? `${meta.soft}99` : '#FAFBFC',
              borderColor: field.hasContent ? meta.border : '#E7EAF0',
            }}
          >
            <span className="truncate">{field.label}</span>
            {field.hasContent ? (
              <span
                className="h-1.5 w-1.5 shrink-0 rounded-full"
                style={{ backgroundColor: meta.accent }}
                aria-hidden="true"
              />
            ) : null}
          </motion.button>
        )}
      </AnimatePresence>
    </div>
  );
}

export interface LessonPlanDocumentPanelProps {
  subjectId: string;
  standardId: string;
  chapters: Chapter[];
  chapterId: string;
  onChapterIdChange: (chapterId: string) => void;
}

export function LessonPlanDocumentPanel({
  subjectId,
  standardId,
  chapters,
  chapterId,
  onChapterIdChange,
}: LessonPlanDocumentPanelProps) {
  const [plan, setPlan] = useState<LessonPlanDocument | null>(null);
  const [planLoading, setPlanLoading] = useState(false);
  const [planError, setPlanError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const fieldRefs = useRef(new Map<string, HTMLDivElement>());

  useEffect(() => {
    if (!chapterId || !subjectId || !standardId) return;

    const session = getCurriculumSession();
    if (!session) {
      setPlanError('Your session is missing or expired. Please sign in again.');
      return;
    }

    let cancelled = false;
    setPlanLoading(true);
    setPlanError(null);
    setExpanded(new Set());

    fetchLessonPlanDocument(session, {
      subjectId,
      standardId,
      chapterId,
      subInstituteId: session.subInstituteId,
    })
      .then((data) => {
        if (!cancelled) setPlan(data);
      })
      .catch((err: unknown) => {
        if (!cancelled) setPlanError(err instanceof Error ? err.message : 'Failed to load the lesson plan.');
      })
      .finally(() => {
        if (!cancelled) setPlanLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [chapterId, subjectId, standardId]);

  const rows = useMemo(() => (plan ? buildRows(plan) : []), [plan]);
  const dayFields = useMemo(
    () =>
      (plan?.days ?? []).map((day) => ({
        key: `day.${day.day}`,
        day,
      })),
    [plan]
  );

  const allKeys = useMemo(() => {
    const keys: string[] = [];
    rows.forEach((row) => {
      (['summary', 'teaching', 'learning', 'map'] as Category[]).forEach((cat) => {
        if (row[cat]) keys.push(row[cat]!.key);
      });
    });
    dayFields.forEach((d) => keys.push(d.key));
    return keys;
  }, [rows, dayFields]);

  const allExpanded = allKeys.length > 0 && allKeys.every((key) => expanded.has(key));

  function registerRef(key: string, el: HTMLDivElement | null) {
    if (el) fieldRefs.current.set(key, el);
    else fieldRefs.current.delete(key);
  }

  // Single-click behaviour is exclusive, like a classic FAQ accordion: opening
  // one field closes whatever else was open, so reading stays focused.
  // "Expand this row" and "Expand all" are the explicit overrides for seeing
  // several fields at once.
  function toggleKey(key: string, scrollTo = true) {
    setExpanded((prev) => (prev.size === 1 && prev.has(key) ? new Set() : new Set([key])));
    if (scrollTo) {
      requestAnimationFrame(() => {
        fieldRefs.current.get(key)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      });
    }
  }

  function toggleColumn(category: Category) {
    const keys = rows.map((row) => row[category]?.key).filter((key): key is string => Boolean(key));
    const allOpen = keys.length > 0 && expanded.size === keys.length && keys.every((key) => expanded.has(key));
    setExpanded(allOpen ? new Set() : new Set(keys));
  }

  function toggleAll() {
    setExpanded(allExpanded ? new Set() : new Set(allKeys));
  }

  const selectedChapterName = chapters.find((chapter) => chapter.id === chapterId)?.title ?? '';

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-slate-200/60 bg-white p-4 shadow-sm sm:p-5">
        <p className="mb-2 text-[13px] font-medium text-[#52637A]">Chapter</p>
        <Select
          value={chapterId || undefined}
          onValueChange={(value) => {
            if (value) onChapterIdChange(value);
          }}
        >
          <SelectTrigger className="h-11 w-full rounded-xl border-slate-200 px-4 text-[15px] text-slate-900 sm:w-96">
            {/* Base UI's SelectValue shows the raw value string unless told how to
                resolve a label for it - chapter ids aren't meant to be read directly. */}
            <SelectValue placeholder="Select a chapter">
              {(value: string) => {
                const match = chapters.find((chapter) => chapter.id === value);
                return match ? `${match.number}. ${match.title}` : 'Select a chapter';
              }}
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            {chapters.map((chapter) => (
              <SelectItem key={chapter.id} value={chapter.id}>
                {chapter.number}. {chapter.title}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {!chapterId ? (
        <EmptyState title="No chapters available" description="This subject has no chapters to show a lesson plan for." />
      ) : planLoading ? (
        <div className="space-y-4">
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-64 w-full" />
        </div>
      ) : planError ? (
        <ErrorState title="Couldn't load this lesson plan" description={planError} />
      ) : !plan ? (
        <EmptyState
          icon={<NotebookText className="h-8 w-8" />}
          title="No lesson plan yet"
          description={`A lesson plan has not been authored for "${selectedChapterName}" yet.`}
        />
      ) : (
        <>
          {/* Field index grid */}
          <div className="rounded-2xl border border-slate-200/60 bg-white p-4 shadow-sm sm:p-5">
            <div className="mb-4 flex items-center justify-between gap-3">
              <h2 className="text-[16px] font-semibold text-slate-900">Field index</h2>
              <button
                type="button"
                onClick={toggleAll}
                className="inline-flex items-center gap-1.5 rounded-full border border-[#D8E0EB] bg-white px-3.5 py-1.5 text-[13px] font-semibold text-[#334155] transition hover:border-[#5648E8] hover:text-[#5648E8]"
              >
                {allExpanded ? <ChevronsDownUp className="h-3.5 w-3.5" /> : <ChevronsUpDown className="h-3.5 w-3.5" />}
                {allExpanded ? 'Collapse all' : 'Expand all'}
              </button>
            </div>

            <div className="grid grid-cols-4 gap-x-2 gap-y-1 sm:gap-x-3">
              {(['summary', 'teaching', 'learning', 'map'] as Category[]).map((cat) => {
                const columnKeys = rows.map((row) => row[cat]?.key).filter((key): key is string => Boolean(key));
                const columnExpanded = columnKeys.length > 0 && columnKeys.every((key) => expanded.has(key));
                return (
                  <div key={cat} className="mb-1 flex items-center justify-between gap-2 px-1">
                    <span
                      className="text-[12px] font-semibold uppercase tracking-wide"
                      style={{ color: CATEGORY_META[cat].accent }}
                    >
                      {CATEGORY_META[cat].label}
                    </span>
                    <button
                      type="button"
                      title={columnExpanded ? `Collapse ${CATEGORY_META[cat].label}` : `Expand ${CATEGORY_META[cat].label}`}
                      onClick={() => toggleColumn(cat)}
                      disabled={columnKeys.length === 0}
                      className="flex h-5 w-5 shrink-0 items-center justify-center rounded text-slate-400 transition hover:bg-slate-100 hover:text-slate-700 disabled:opacity-0"
                    >
                      <motion.span animate={{ rotate: columnExpanded ? 180 : 0 }} transition={{ duration: 0.2 }}>
                        <ChevronDown className="h-3.5 w-3.5" />
                      </motion.span>
                    </button>
                  </div>
                );
              })}

              {rows.map((row, index) => {
                return (
                  <div key={index} className="contents">
                    <GridChip field={row.summary} category="summary" expanded={row.summary ? expanded.has(row.summary.key) : false} onToggle={(key) => toggleKey(key, false)} registerRef={registerRef} />
                    <GridChip field={row.teaching} category="teaching" expanded={row.teaching ? expanded.has(row.teaching.key) : false} onToggle={(key) => toggleKey(key, false)} registerRef={registerRef} />
                    <GridChip field={row.learning} category="learning" expanded={row.learning ? expanded.has(row.learning.key) : false} onToggle={(key) => toggleKey(key, false)} registerRef={registerRef} />
                    <GridChip field={row.map} category="map" expanded={row.map ? expanded.has(row.map.key) : false} onToggle={(key) => toggleKey(key, false)} registerRef={registerRef} />
                  </div>
                );
              })}
            </div>

            {plan.days.length > 0 ? (
              <button
                type="button"
                onClick={() => {
                  const firstDayKey = dayFields[0]?.key;
                  if (firstDayKey) toggleKey(firstDayKey);
                }}
                className="mt-3 inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-[13px] font-medium"
                style={{ backgroundColor: DAY_META.soft, borderColor: DAY_META.border, color: DAY_META.accent }}
              >
                <CalendarCheck className="h-3.5 w-3.5" />
                Day Planning · {plan.days.length} {plan.days.length === 1 ? 'day' : 'days'}
              </button>
            ) : null}
          </div>

          {plan.days.length > 0 ? (
            <div className="space-y-2.5">
              <h3 className="px-1 text-[12px] font-semibold uppercase tracking-wide" style={{ color: DAY_META.accent }}>
                Day Planning
              </h3>
              {dayFields.map(({ key, day }) => (
                <div
                  key={key}
                  ref={(el) => registerRef(key, el)}
                  className="overflow-hidden rounded-xl border bg-white"
                  style={{ borderColor: expanded.has(key) ? DAY_META.accent : '#E7EAF0' }}
                >
                  <button
                    type="button"
                    onClick={() => toggleKey(key, false)}
                    className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left"
                  >
                    <span className="flex items-center gap-2.5">
                      <span className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: DAY_META.accent }} />
                      <span className="text-[14px] font-semibold text-slate-800">
                        Day {day.day}
                        {day.topic_name ? ` · ${day.topic_name}` : ''}
                      </span>
                      {day.class_time ? (
                        <Badge variant="outline" className="gap-1">
                          <Timer className="h-3 w-3" /> {day.class_time} min
                        </Badge>
                      ) : null}
                    </span>
                    <motion.span animate={{ rotate: expanded.has(key) ? 180 : 0 }} transition={{ duration: 0.2 }}>
                      <ChevronDown className="h-4 w-4 text-slate-400" />
                    </motion.span>
                  </button>
                  <AnimatePresence initial={false}>
                    {expanded.has(key) ? (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.22, ease: 'easeInOut' }}
                        className="overflow-hidden"
                      >
                        <div className="grid grid-cols-1 gap-4 border-t border-slate-100 px-4 py-3 md:grid-cols-2">
                          {[
                            ['During Content', day.during_content],
                            ['Learning Objective', day.learning_objective],
                            ['Learning Outcome', day.learning_outcome],
                            ['Pedagogical Process', day.pedagogical_process],
                            ['Resource', day.resource],
                            ['Closure', day.closure],
                            ['Assessment Qualifying', day.assessment_qualifying],
                          ].map(([label, html]) => (
                            <div key={label}>
                              <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</p>
                              {html ? (
                                <div
                                  className="prose prose-sm max-w-none text-slate-700 prose-p:my-1.5"
                                  dangerouslySetInnerHTML={{ __html: sanitizeHtml(html) }}
                                />
                              ) : (
                                <p className="text-sm italic text-slate-400">Not provided yet.</p>
                              )}
                            </div>
                          ))}
                          <div>
                            <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-500">
                              Self-Study & Homework
                            </p>
                            {day.self_study_homework ? (
                              <div
                                className="prose prose-sm max-w-none text-slate-700 prose-p:my-1.5"
                                dangerouslySetInnerHTML={{ __html: sanitizeHtml(day.self_study_homework) }}
                              />
                            ) : (
                              <p className="text-sm italic text-slate-400">Not provided yet.</p>
                            )}
                            {day.self_study_activity.length ? (
                              <div className="mt-2 flex flex-wrap gap-1.5">
                                {day.self_study_activity.map((item) => (
                                  <Badge key={item.id} variant="outline">
                                    {item.title || `#${item.id}`}
                                  </Badge>
                                ))}
                              </div>
                            ) : null}
                          </div>
                          <div>
                            <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-500">Assessment</p>
                            {day.assessment ? (
                              <div
                                className="prose prose-sm max-w-none text-slate-700 prose-p:my-1.5"
                                dangerouslySetInnerHTML={{ __html: sanitizeHtml(day.assessment) }}
                              />
                            ) : (
                              <p className="text-sm italic text-slate-400">Not provided yet.</p>
                            )}
                            {day.assessment_activity.length ? (
                              <div className="mt-2 flex flex-wrap gap-1.5">
                                {day.assessment_activity.map((item) => (
                                  <Badge key={item.id} variant="outline">
                                    {item.title || `#${item.id}`}
                                  </Badge>
                                ))}
                              </div>
                            ) : null}
                          </div>
                        </div>
                      </motion.div>
                    ) : null}
                  </AnimatePresence>
                </div>
              ))}
            </div>
          ) : null}
        </>
      )}
    </div>
  );
}

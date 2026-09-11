'use client';

// The structural half of the curriculum, which until now the API returned and
// the page threw away: curriculum header -> goals and competencies -> units ->
// declared vs extracted chapters -> one chapter opened out.
//
// Where the database is empty the gap is named rather than hidden. That is the
// point of the screen as much as the data is: a unit that declares fifteen
// chapters and has none extracted should say so.

import { useState } from 'react';
import { AlertTriangle, ChevronDown, ChevronRight, CircleCheck } from 'lucide-react';
import type { ApiCurriculum, ApiOutcomeGoal, ApiUnit, ApiUnmappedGroup } from './types';
import { ChapterDetailPanel } from './ChapterDetailPanel';
import { NotProvided, SectionHeading, formatMarks, subjectColorAt } from './shared';

const DETAIL_LABELS: Array<[keyof ApiCurriculum['details'], string]> = [
  ['objective', 'Objective'],
  ['curriculum_alignment', 'Curriculum alignment'],
  ['holistic_curriculum', 'Holistic curriculum'],
  ['model_integration', 'Model integration'],
  ['chapter', 'Chapter notes'],
  ['outcome', 'Outcome'],
  ['assessment_tool', 'Assessment tool'],
];

const chapterStatusClassName: Record<string, string> = {
  Done: 'bg-[#def4d2] text-[#3f7b2b]',
  'In progress': 'bg-[#dcecff] text-[#1761a7]',
  Upcoming: 'bg-[#e3e1de] text-[#706b64]',
};

export function CurriculumTab({
  curricula,
  unmapped,
  isLoading,
  loadError,
}: {
  curricula: ApiCurriculum[];
  unmapped: ApiUnmappedGroup[];
  isLoading: boolean;
  loadError: string | null;
}) {
  if (isLoading) {
    return (
      <div className="rounded-lg border border-[#ddd9d2] bg-white px-4 py-10 text-center text-sm text-[#9a958e]">
        Loading curriculum...
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="rounded-lg border border-[#e8cdc7] bg-[#fdf3f1] px-4 py-6 text-center text-sm text-[#a33a2a]">
        {loadError}
      </div>
    );
  }

  if (curricula.length === 0 && unmapped.length === 0) {
    return (
      <div className="rounded-lg border border-[#ddd9d2] bg-white px-4 py-10 text-center text-sm text-[#9a958e]">
        No curriculum data found for this institute yet.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {curricula.map((curriculum, index) => (
        <CurriculumCard
          key={curriculum.curriculum_id}
          curriculum={curriculum}
          accent={subjectColorAt(index).dotColor}
        />
      ))}

      {unmapped.map((group) => (
        <UnmappedCard key={`${group.standard_id}-${group.subject_id}`} group={group} />
      ))}
    </div>
  );
}

function CurriculumCard({ curriculum, accent }: { curriculum: ApiCurriculum; accent: string }) {
  const [isOpen, setIsOpen] = useState(true);

  const marks = formatMarks(curriculum.total_marks, curriculum.internal_marks);
  const { declared_chapters: declared, extracted_chapters: extracted, chapters_with_intelligence: withIntel } =
    curriculum.coverage;

  const chips = [
    curriculum.board,
    curriculum.framework,
    marks,
    curriculum.status,
  ].filter(Boolean) as string[];

  return (
    <section className="overflow-hidden rounded-lg border border-[#ddd9d2] bg-white shadow-[0_8px_18px_rgba(23,22,15,0.08)]">
      <button
        type="button"
        onClick={() => setIsOpen((open) => !open)}
        className="flex w-full items-start gap-3 px-4 py-4 text-left transition-colors hover:bg-[#faf9f7]"
      >
        <span className="mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: accent }} />

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
            <h2 className="text-base font-semibold tracking-[0] text-[#24211d]">
              {curriculum.subject_name}
              {curriculum.standard_name ? ` - Std ${curriculum.standard_name}` : ''}
            </h2>
            {curriculum.curriculum_name ? (
              <span className="text-sm text-[#77716b]">{curriculum.curriculum_name}</span>
            ) : null}
          </div>

          <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
            {chips.map((chip) => (
              <span key={chip} className="rounded-full bg-[#efeeec] px-2 py-0.5 text-[11px] text-[#5c574f]">
                {chip}
              </span>
            ))}
          </div>

          {/* The coverage line is the honest summary: what the syllabus asks for
              against what actually exists. */}
          <p className="mt-2 text-xs text-[#77716b]">
            {extracted} of {declared || extracted} declared chapters extracted
            {declared > extracted ? (
              <span className="ml-1 font-medium text-[#a8710f]">
                · {declared - extracted} still missing
              </span>
            ) : null}
            <span className="ml-1">· {withIntel} with intelligence</span>
            <span className="ml-1">· {curriculum.units.length} units</span>
          </p>
        </div>

        {isOpen ? (
          <ChevronDown size={16} className="mt-1 shrink-0 text-[#8a847d]" />
        ) : (
          <ChevronRight size={16} className="mt-1 shrink-0 text-[#8a847d]" />
        )}
      </button>

      {isOpen ? (
        <div className="space-y-5 border-t border-[#e9e5de] px-4 py-5">
          <CurriculumDetails details={curriculum.details} />
          <OutcomeTree goals={curriculum.outcomes} />

          <div>
            <SectionHeading>Units ({curriculum.units.length})</SectionHeading>
            {curriculum.units.length === 0 ? (
              <NotProvided label="No units have been recorded for this curriculum." />
            ) : (
              <div className="space-y-2">
                {curriculum.units.map((unit) => (
                  <UnitRow key={unit.unit_id} unit={unit} />
                ))}
              </div>
            )}
          </div>
        </div>
      ) : null}
    </section>
  );
}

function CurriculumDetails({ details }: { details: ApiCurriculum['details'] }) {
  const provided = DETAIL_LABELS.filter(([key]) => details[key]);

  return (
    <div>
      <SectionHeading>
        Curriculum details ({provided.length} of {DETAIL_LABELS.length} provided)
      </SectionHeading>
      <dl className="grid gap-3 md:grid-cols-2">
        {DETAIL_LABELS.map(([key, label]) => (
          <div key={key} className="rounded-lg border border-[#e5e1da] bg-[#faf9f7] px-3 py-2.5">
            <dt className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[#8a847d]">{label}</dt>
            <dd className="mt-1">
              {details[key] ? (
                // Stored as authored HTML by the Blade editor these fields came from.
                <div
                  className="prose-sm text-sm leading-relaxed text-[#3c3833]"
                  dangerouslySetInnerHTML={{ __html: details[key] as string }}
                />
              ) : (
                <NotProvided />
              )}
            </dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

/**
 * Curricular goals with their competencies beneath.
 *
 * These have existed in the database all along - 259 rows of NCF goals and
 * competencies - but the API looked them up by chapter_id, which is 0 on every
 * row, so the tree has never once rendered.
 */
function OutcomeTree({ goals }: { goals: ApiOutcomeGoal[] }) {
  const competencyCount = goals.reduce((total, goal) => total + goal.competencies.length, 0);

  return (
    <div>
      <SectionHeading>
        Goals and competencies ({goals.length} goals, {competencyCount} competencies)
      </SectionHeading>

      {goals.length === 0 ? (
        <NotProvided label="No curricular goals have been recorded for this curriculum." />
      ) : (
        <div className="space-y-2">
          {goals.map((goal, index) => (
            <div
              key={goal.id ?? `goal-${index}`}
              className="rounded-lg border border-[#e5e1da] bg-[#faf9f7] px-3 py-2.5"
            >
              <div className="flex flex-wrap items-baseline gap-2">
                {goal.code ? (
                  <span className="rounded bg-[#dcecff] px-1.5 py-0.5 font-mono text-[11px] font-semibold text-[#114f8f]">
                    {goal.code}
                  </span>
                ) : null}
                <span className="text-sm font-medium text-[#2d2924]">
                  {goal.description || 'No description recorded'}
                </span>
              </div>

              {goal.competencies.length > 0 ? (
                <ul className="mt-2 space-y-1.5 border-l-2 border-[#ddd9d2] pl-3">
                  {goal.competencies.map((competency) => (
                    <li key={competency.id} className="flex flex-wrap items-baseline gap-2">
                      {competency.code ? (
                        <span className="rounded bg-[#e8e4fb] px-1.5 py-0.5 font-mono text-[11px] font-semibold text-[#473aa5]">
                          {competency.code}
                        </span>
                      ) : null}
                      <span className="text-xs leading-relaxed text-[#5c574f]">
                        {competency.description || 'No description recorded'}
                      </span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="mt-1.5 pl-3 text-xs italic text-[#a09a93]">
                  No competencies recorded under this goal.
                </p>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function UnitRow({ unit }: { unit: ApiUnit }) {
  const [isOpen, setIsOpen] = useState(false);
  const [openChapterId, setOpenChapterId] = useState<number | null>(null);

  const missing = unit.declared_chapter_count - unit.extracted_chapter_count;

  return (
    <div className="overflow-hidden rounded-lg border border-[#e5e1da]">
      <button
        type="button"
        onClick={() => setIsOpen((open) => !open)}
        className="flex w-full items-center gap-3 bg-[#faf9f7] px-3 py-2.5 text-left transition-colors hover:bg-[#f1f0ed]"
      >
        {isOpen ? (
          <ChevronDown size={15} className="shrink-0 text-[#8a847d]" />
        ) : (
          <ChevronRight size={15} className="shrink-0 text-[#8a847d]" />
        )}

        <span className="min-w-0 flex-1 text-sm font-medium text-[#2d2924]">
          {unit.unit_number !== null ? `Unit ${unit.unit_number} · ` : ''}
          {unit.unit_name || 'Untitled unit'}
        </span>

        <span className="flex shrink-0 flex-wrap items-center gap-1.5 text-[11px]">
          {unit.total_marks !== null ? (
            <span className="rounded-full bg-[#fae8c7] px-2 py-0.5 text-[#6f470c]">{unit.total_marks} marks</span>
          ) : null}
          {unit.planned_periods !== null ? (
            <span className="rounded-full bg-[#efeeec] px-2 py-0.5 text-[#706b64]">
              {unit.planned_periods} periods
            </span>
          ) : null}
          <span className="rounded-full bg-[#efeeec] px-2 py-0.5 text-[#706b64]">
            {unit.extracted_chapter_count}/{unit.declared_chapter_count || unit.extracted_chapter_count} chapters
          </span>
        </span>
      </button>

      {isOpen ? (
        <div className="space-y-4 border-t border-[#e9e5de] bg-white px-3 py-4">
          <div>
            <SectionHeading>Syllabus chapters ({unit.declared_chapter_count})</SectionHeading>
            {unit.declared_chapters.length === 0 ? (
              <NotProvided label="The syllabus does not list chapters for this unit." />
            ) : (
              <ul className="space-y-1">
                {unit.declared_chapters.map((name, index) => (
                  <li key={`${name}-${index}`} className="flex items-start gap-2 text-sm text-[#3c3833]">
                    <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-[#c9c4bd]" />
                    {name}
                  </li>
                ))}
              </ul>
            )}

            {/* Deliberately a count, not a per-chapter tick. Declared and
                extracted names diverge ("Circles" against "I'm Up and Down, and
                Round and Round"), so matching them by name would invent links
                that do not exist. unit_id is the only real join. */}
            {missing > 0 ? (
              <p className="mt-2 flex items-center gap-1.5 text-xs font-medium text-[#a8710f]">
                <AlertTriangle size={13} />
                {missing} of these {missing === 1 ? 'has' : 'have'} no extracted content yet
              </p>
            ) : unit.declared_chapter_count > 0 ? (
              <p className="mt-2 flex items-center gap-1.5 text-xs font-medium text-[#3f7b2b]">
                <CircleCheck size={13} />
                All declared chapters have extracted content
              </p>
            ) : null}
          </div>

          <div>
            <SectionHeading>Extracted chapters ({unit.chapters.length})</SectionHeading>
            {unit.chapters.length === 0 ? (
              <NotProvided label="No chapter content has been extracted for this unit yet." />
            ) : (
              <div className="space-y-2">
                {unit.chapters.map((chapter) => (
                    <div key={chapter.chapter_id} className="overflow-hidden rounded-lg border border-[#e5e1da]">
                      <button
                        type="button"
                        onClick={() =>
                          setOpenChapterId((current) =>
                            current === chapter.chapter_id ? null : chapter.chapter_id
                          )
                        }
                        className="flex w-full items-start gap-2.5 px-3 py-2.5 text-left transition-colors hover:bg-[#faf9f7]"
                      >
                        {openChapterId === chapter.chapter_id ? (
                          <ChevronDown size={15} className="mt-0.5 shrink-0 text-[#8a847d]" />
                        ) : (
                          <ChevronRight size={15} className="mt-0.5 shrink-0 text-[#8a847d]" />
                        )}

                        <span className="min-w-0 flex-1">
                          <span className="block text-sm font-medium text-[#2d2924]">
                            {chapter.chapter_name}
                          </span>
                          <span className="mt-1 flex flex-wrap items-center gap-1.5 text-[11px] text-[#706b64]">
                            <span>{chapter.topic_count} topics</span>
                            <span>· {chapter.concept_count} concepts</span>
                            <span>· {chapter.key_concept_count} key concepts</span>
                            {chapter.has_intelligence ? (
                              <span className="rounded-full bg-[#e8e4fb] px-2 py-0.5 text-[#473aa5]">
                                intelligence ready
                              </span>
                            ) : (
                              <span className="rounded-full bg-[#f7e6d4] px-2 py-0.5 text-[#8a5a1a]">
                                no intelligence
                              </span>
                            )}
                          </span>
                        </span>

                        <span
                          className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-medium ${
                            chapterStatusClassName[chapter.status] ?? chapterStatusClassName.Upcoming
                          }`}
                        >
                          {chapter.status}
                        </span>
                      </button>

                      {openChapterId === chapter.chapter_id ? (
                        <ChapterDetailPanel
                          chapterId={chapter.chapter_id}
                          learningOutcomes={chapter.learning_outcomes}
                        />
                      ) : null}
                    </div>
                ))}
              </div>
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}

/**
 * Chapters that exist but that no curriculum unit claims.
 *
 * Shown separately rather than folded in, because that is exactly what they are
 * not part of. An institute with no curriculum row at all has every one of its
 * chapters here, and used to see nothing but "No curriculum plan data found".
 */
function UnmappedCard({ group }: { group: ApiUnmappedGroup }) {
  const [isOpen, setIsOpen] = useState(false);
  const [openChapterId, setOpenChapterId] = useState<number | null>(null);

  return (
    <section className="overflow-hidden rounded-lg border border-dashed border-[#d3c9b6] bg-[#fdfbf6]">
      <button
        type="button"
        onClick={() => setIsOpen((open) => !open)}
        className="flex w-full items-start gap-3 px-4 py-4 text-left transition-colors hover:bg-[#f8f4ea]"
      >
        <AlertTriangle size={16} className="mt-0.5 shrink-0 text-[#a8710f]" />

        <div className="min-w-0 flex-1">
          <h2 className="text-base font-semibold tracking-[0] text-[#24211d]">
            {group.subject_name || 'Unknown subject'}
            {group.standard_name ? ` - Std ${group.standard_name}` : ''}
          </h2>
          <p className="mt-1 text-xs text-[#77716b]">
            {group.chapter_count} chapters not assigned to any curriculum unit · {group.concept_count} concepts
            · {group.chapters_with_intelligence} with intelligence
          </p>
        </div>

        {isOpen ? (
          <ChevronDown size={16} className="mt-1 shrink-0 text-[#8a847d]" />
        ) : (
          <ChevronRight size={16} className="mt-1 shrink-0 text-[#8a847d]" />
        )}
      </button>

      {isOpen ? (
        <div className="space-y-2 border-t border-[#e9e2d2] px-4 py-4">
          {group.chapters.map((chapter) => (
            <div key={chapter.chapter_id} className="overflow-hidden rounded-lg border border-[#e5e1da] bg-white">
              <button
                type="button"
                onClick={() =>
                  setOpenChapterId((current) => (current === chapter.chapter_id ? null : chapter.chapter_id))
                }
                className="flex w-full items-start gap-2.5 px-3 py-2.5 text-left transition-colors hover:bg-[#faf9f7]"
              >
                {openChapterId === chapter.chapter_id ? (
                  <ChevronDown size={15} className="mt-0.5 shrink-0 text-[#8a847d]" />
                ) : (
                  <ChevronRight size={15} className="mt-0.5 shrink-0 text-[#8a847d]" />
                )}

                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-medium text-[#2d2924]">{chapter.chapter_name}</span>
                  <span className="mt-1 flex flex-wrap items-center gap-1.5 text-[11px] text-[#706b64]">
                    <span>{chapter.topic_count} topics</span>
                    <span>· {chapter.concept_count} concepts</span>
                    <span>· {chapter.key_concept_count} key concepts</span>
                    {chapter.has_intelligence ? (
                      <span className="rounded-full bg-[#e8e4fb] px-2 py-0.5 text-[#473aa5]">
                        intelligence ready
                      </span>
                    ) : (
                      <span className="rounded-full bg-[#f7e6d4] px-2 py-0.5 text-[#8a5a1a]">
                        no intelligence
                      </span>
                    )}
                  </span>
                </span>
              </button>

              {openChapterId === chapter.chapter_id ? (
                <ChapterDetailPanel
                  chapterId={chapter.chapter_id}
                  learningOutcomes={[]}
                />
              ) : null}
            </div>
          ))}
        </div>
      ) : null}
    </section>
  );
}

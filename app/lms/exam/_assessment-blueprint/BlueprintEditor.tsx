'use client';

// ---------------------------------------------------------------------------
// The blueprint editor.
//
// Controlled throughout: it owns no blueprint state of its own, so the list
// screen decides what is being edited and when it is saved. Everything here is
// an immutable update on the draft it was handed.
//
// Nothing in this editor refuses input. A blueprint is partial until it is
// finished, and a form that will not let a coordinator save half a design is a
// form they will fill in on paper instead. What does not add up is SHOWN —
// beside the field that causes it — and saved anyway.
// ---------------------------------------------------------------------------

import { useCallback, useMemo } from 'react';
import { AlertTriangle, ChevronDown, Plus, Trash2 } from 'lucide-react';
import type {
  Blueprint,
  BlueprintOptions,
  BlueprintRow,
  BlueprintSection,
  ChapterOption,
  CompetencyWeight,
  ContentWeight,
  RegularDraft,
} from './types';

/**
 * Marks-based blueprints only. Narrowed to `RegularDraft` rather than taking
 * the union, so an HPC definition cannot reach a form built entirely around
 * sections and totals — HpcBlueprintEditor is the other half of that pair.
 */
type Props = {
  draft: RegularDraft;
  options: BlueprintOptions;
  chapters: ChapterOption[];
  chaptersLoading: boolean;
  onChange: (draft: RegularDraft) => void;
};

const CLASS_BANDS = ['I-II', 'III-V', 'VI-VIII', 'IX-X', 'IX-XII', 'XI-XII'];

/**
 * A short id that does not need a library.
 *
 * Only ever used for React keys and for matching a row to its edits within one
 * open editor — the server re-issues ids on normalise, so these never have to
 * survive a round trip.
 */
function newId(prefix: string): string {
  return `${prefix}-${Math.random().toString(36).slice(2, 10)}`;
}

function trimNumber(value: number): string {
  return String(Math.round(value * 100) / 100);
}

/** count x (subparts or 1) x marks-each — what the row's own pieces come to. */
export function computedRowMarks(row: BlueprintRow): number {
  const units = Math.max(1, row.subparts || 0);

  return Math.round(row.count * units * row.marks_each * 100) / 100;
}

export function sectionMarks(section: BlueprintSection): number {
  return Math.round(section.rows.reduce((sum, row) => sum + row.total_marks, 0) * 100) / 100;
}

export function totalSectionMarks(sections: BlueprintSection[]): number {
  return Math.round(sections.reduce((sum, section) => sum + sectionMarks(section), 0) * 100) / 100;
}

export default function BlueprintEditor({
  draft,
  options,
  chapters,
  chaptersLoading,
  onChange,
}: Props) {
  const definition = draft.definition;

  const patch = useCallback(
    (changes: Partial<RegularDraft>) => onChange({ ...draft, ...changes }),
    [draft, onChange]
  );

  const patchDefinition = useCallback(
    (changes: Partial<RegularDraft['definition']>) =>
      onChange({ ...draft, definition: { ...draft.definition, ...changes } }),
    [draft, onChange]
  );

  // -- Sections ------------------------------------------------------------

  const updateSection = useCallback(
    (sectionId: string, changes: Partial<BlueprintSection>) =>
      patchDefinition({
        sections: definition.sections.map((section) =>
          section.id === sectionId ? { ...section, ...changes } : section
        ),
      }),
    [definition.sections, patchDefinition]
  );

  const updateRow = useCallback(
    (sectionId: string, rowId: string, changes: Partial<BlueprintRow>) =>
      patchDefinition({
        sections: definition.sections.map((section) =>
          section.id !== sectionId
            ? section
            : {
                ...section,
                rows: section.rows.map((row) => (row.id === rowId ? { ...row, ...changes } : row)),
              }
        ),
      }),
    [definition.sections, patchDefinition]
  );

  const marksTally = useMemo(() => totalSectionMarks(definition.sections), [definition.sections]);
  const marksGap = Math.round((marksTally - draft.total_marks) * 100) / 100;

  const contentTally = useMemo(
    () => Math.round(definition.content_weightage.reduce((sum, area) => sum + area.marks, 0) * 100) / 100,
    [definition.content_weightage]
  );

  const competencyTally = useMemo(
    () =>
      Math.round(
        definition.competency_distribution.reduce((sum, band) => sum + band.weight_pct, 0) * 100
      ) / 100,
    [definition.competency_distribution]
  );

  const difficultyTally =
    Math.round(
      (definition.difficulty_distribution.easy +
        definition.difficulty_distribution.average +
        definition.difficulty_distribution.difficult) *
        100
    ) / 100;

  return (
    <div className="flex flex-col gap-4">
      {/* ---- Details ---------------------------------------------------- */}
      <Panel title="Details">
        <div className="grid gap-3 md:grid-cols-2">
          <Field label="Blueprint name">
            <input
              value={draft.name}
              onChange={(event) => patch({ name: event.target.value })}
              placeholder="e.g. Class 7 Science — Term 1"
              className={inputClass}
            />
          </Field>

          <Field label="Status">
            <Select
              value={draft.status}
              onChange={(value) => patch({ status: value as RegularDraft['status'] })}
              options={options.statuses.map((status) => ({ value: status, label: status }))}
            />
          </Field>
        </div>

        <Field label="Description">
          <input
            value={draft.description}
            onChange={(event) => patch({ description: event.target.value })}
            placeholder="What this design is for"
            className={inputClass}
          />
        </Field>

        <div className="grid gap-3 md:grid-cols-4">
          <Field label="Board">
            <Select
              value={draft.board}
              onChange={(value) => patch({ board: value })}
              options={[{ value: '', label: '—' }, ...options.boards.map((b) => ({ value: b, label: b }))]}
            />
          </Field>

          <Field label="Class band">
            <Select
              value={draft.class_band}
              onChange={(value) => patch({ class_band: value })}
              options={[{ value: '', label: '—' }, ...CLASS_BANDS.map((b) => ({ value: b, label: b }))]}
            />
          </Field>

          <Field label="Assessment type">
            <Select
              value={draft.assessment_type}
              onChange={(value) => patch({ assessment_type: value })}
              options={[
                { value: '', label: '—' },
                ...options.assessment_types.map((t) => ({ value: t, label: t })),
              ]}
            />
          </Field>

          <Field label="Academic year">
            <input
              value={draft.academic_year}
              onChange={(event) => patch({ academic_year: event.target.value })}
              placeholder="2025-26"
              className={inputClass}
            />
          </Field>
        </div>

        <div className="grid gap-3 md:grid-cols-3">
          <Field label="Subject">
            <input
              value={draft.subject_label}
              onChange={(event) => patch({ subject_label: event.target.value })}
              placeholder="e.g. Science"
              className={inputClass}
            />
          </Field>

          <Field label="Total marks" hint={marksGap === 0 ? '' : `Sections add up to ${trimNumber(marksTally)}`}>
            <input
              type="number"
              min={0}
              step={1}
              value={draft.total_marks}
              onChange={(event) => patch({ total_marks: Number(event.target.value) || 0 })}
              className={inputClass}
            />
          </Field>

          <Field label="Duration (minutes)">
            <input
              type="number"
              min={0}
              step={5}
              value={draft.duration_minutes ?? ''}
              onChange={(event) =>
                patch({ duration_minutes: event.target.value ? Number(event.target.value) : null })
              }
              placeholder="e.g. 180"
              className={inputClass}
            />
          </Field>
        </div>
      </Panel>

      {/* ---- Paper structure -------------------------------------------- */}
      <Panel
        title="Paper structure"
        subtitle="The sections a board prints, and what each one is made of. A question split into parts keeps a count of 1 — four sub-parts is not four questions."
        tally={`${trimNumber(marksTally)} / ${trimNumber(draft.total_marks)} marks`}
        tallyWarn={marksGap !== 0 && draft.total_marks > 0}
        onAdd={() =>
          patchDefinition({
            sections: [
              ...definition.sections,
              {
                id: newId('section'),
                name: `Section ${String.fromCharCode(65 + definition.sections.length)}`,
                note: '',
                rows: [
                  {
                    id: newId('row'),
                    question_type: 'mcq',
                    label: '',
                    question_numbers: '',
                    count: 1,
                    subparts: 0,
                    marks_each: 1,
                    total_marks: 1,
                    note: '',
                  },
                ],
              },
            ],
          })
        }
        addLabel="Add section"
      >
        <div className="flex flex-col gap-3">
          {definition.sections.map((section) => (
            <div key={section.id} className="rounded-[14px] border border-[#E4E9F2] bg-[#FAFBFE] p-3">
              <div className="flex flex-wrap items-center gap-2">
                <input
                  value={section.name}
                  onChange={(event) => updateSection(section.id, { name: event.target.value })}
                  placeholder="Section name"
                  className="h-9 w-[150px] rounded-[9px] border border-[#E4E9F2] bg-white px-2.5 text-[13px] font-semibold text-[#172554]"
                />
                <input
                  value={section.note}
                  onChange={(event) => updateSection(section.id, { note: event.target.value })}
                  placeholder="Note printed under the section heading"
                  className="h-9 min-w-[200px] flex-1 rounded-[9px] border border-[#E4E9F2] bg-white px-2.5 text-[12.5px] text-[#334155]"
                />
                <span className="rounded-full border border-[#E4E9F2] bg-white px-2.5 py-1 text-[11.5px] font-semibold text-[#334155]">
                  {trimNumber(sectionMarks(section))} marks
                </span>
                <button
                  type="button"
                  onClick={() =>
                    patchDefinition({
                      sections: definition.sections.filter((entry) => entry.id !== section.id),
                    })
                  }
                  disabled={definition.sections.length <= 1}
                  className="rounded-[8px] border border-[#E4E9F2] bg-white p-1.5 text-[#98A4B6] transition hover:bg-red-50 hover:text-[#B91C1C] disabled:opacity-40"
                  aria-label="Remove section"
                >
                  <Trash2 size={14} />
                </button>
              </div>

              <div className="mt-2.5 overflow-x-auto">
                <table className="w-full min-w-[820px] border-collapse text-left">
                  <thead>
                    <tr className="text-[10.5px] font-semibold uppercase tracking-[0.1em] text-[#7A889D]">
                      <th className="px-1.5 pb-1.5">Type</th>
                      <th className="px-1.5 pb-1.5">Label on the paper</th>
                      <th className="px-1.5 pb-1.5 w-[74px]">Q. nos</th>
                      <th className="px-1.5 pb-1.5 w-[64px]">Count</th>
                      <th className="px-1.5 pb-1.5 w-[74px]">Sub-parts</th>
                      <th className="px-1.5 pb-1.5 w-[74px]">Marks ea.</th>
                      <th className="px-1.5 pb-1.5 w-[86px]">Total</th>
                      <th className="px-1.5 pb-1.5 w-[34px]" />
                    </tr>
                  </thead>
                  <tbody>
                    {section.rows.map((row) => {
                      const computed = computedRowMarks(row);
                      const mismatch = Math.abs(computed - row.total_marks) > 0.01;

                      return (
                        <tr key={row.id}>
                          <td className="px-1.5 py-1">
                            <Select
                              value={row.question_type}
                              onChange={(value) => updateRow(section.id, row.id, { question_type: value })}
                              options={options.question_types.map((type) => ({
                                value: type.code,
                                label: type.label,
                              }))}
                              compact
                            />
                          </td>
                          <td className="px-1.5 py-1">
                            <input
                              value={row.label}
                              onChange={(event) =>
                                updateRow(section.id, row.id, { label: event.target.value })
                              }
                              placeholder="As the board words it"
                              className={cellClass}
                            />
                          </td>
                          <td className="px-1.5 py-1">
                            <input
                              value={row.question_numbers}
                              onChange={(event) =>
                                updateRow(section.id, row.id, { question_numbers: event.target.value })
                              }
                              placeholder="2-5"
                              className={cellClass}
                            />
                          </td>
                          <td className="px-1.5 py-1">
                            <NumberCell
                              value={row.count}
                              onChange={(value) => updateRow(section.id, row.id, { count: value })}
                            />
                          </td>
                          <td className="px-1.5 py-1">
                            <NumberCell
                              value={row.subparts}
                              onChange={(value) => updateRow(section.id, row.id, { subparts: value })}
                            />
                          </td>
                          <td className="px-1.5 py-1">
                            <NumberCell
                              value={row.marks_each}
                              step={0.5}
                              onChange={(value) => updateRow(section.id, row.id, { marks_each: value })}
                            />
                          </td>
                          <td className="px-1.5 py-1">
                            <div className="flex items-center gap-1">
                              <NumberCell
                                value={row.total_marks}
                                step={0.5}
                                onChange={(value) =>
                                  updateRow(section.id, row.id, { total_marks: value })
                                }
                              />
                              {mismatch ? (
                                <button
                                  type="button"
                                  title={`Works out to ${trimNumber(computed)} — click to use that`}
                                  onClick={() =>
                                    updateRow(section.id, row.id, { total_marks: computed })
                                  }
                                  className="shrink-0 text-amber-600"
                                >
                                  <AlertTriangle size={14} />
                                </button>
                              ) : null}
                            </div>
                          </td>
                          <td className="px-1.5 py-1">
                            <button
                              type="button"
                              onClick={() =>
                                updateSection(section.id, {
                                  rows: section.rows.filter((entry) => entry.id !== row.id),
                                })
                              }
                              disabled={section.rows.length <= 1}
                              className="rounded-[8px] p-1 text-[#98A4B6] transition hover:bg-red-50 hover:text-[#B91C1C] disabled:opacity-40"
                              aria-label="Remove row"
                            >
                              <Trash2 size={13} />
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              <button
                type="button"
                onClick={() =>
                  updateSection(section.id, {
                    rows: [
                      ...section.rows,
                      {
                        id: newId('row'),
                        question_type: 'mcq',
                        label: '',
                        question_numbers: '',
                        count: 1,
                        subparts: 0,
                        marks_each: 1,
                        total_marks: 1,
                        note: '',
                      },
                    ],
                  })
                }
                className="mt-1.5 inline-flex items-center gap-1.5 text-[12px] font-semibold text-[#5846EA]"
              >
                <Plus size={13} /> Add question row
              </button>
            </div>
          ))}
        </div>
      </Panel>

      {/* ---- Chapter weightage ------------------------------------------ */}
      <Panel
        title="Chapter weightage"
        subtitle={
          draft.standard_id && draft.subject_id
            ? 'Pick a chapter to bind a weighting to something the question bank can be counted against.'
            : 'Name content areas in words, or set this blueprint against a class and subject on the list screen to pick real chapters.'
        }
        tally={`${trimNumber(contentTally)} marks`}
        tallyWarn={contentTally > 0 && Math.abs(contentTally - marksTally) > 0.01}
        onAdd={() =>
          patchDefinition({
            content_weightage: [
              ...definition.content_weightage,
              { id: newId('area'), name: '', chapter_id: null, marks: 0, weight_pct: 0, note: '' },
            ],
          })
        }
        addLabel="Add area"
      >
        {definition.content_weightage.length === 0 ? (
          <Empty>
            No chapter weightage set. The two Delhi DoE references do not prescribe one either — the
            Directorate leaves it to the school, against the chapters actually taught.
          </Empty>
        ) : (
          <div className="flex flex-col gap-2">
            {definition.content_weightage.map((area) => (
              <ContentRow
                key={area.id}
                area={area}
                chapters={chapters}
                chaptersLoading={chaptersLoading}
                totalMarks={draft.total_marks}
                onChange={(changes) =>
                  patchDefinition({
                    content_weightage: definition.content_weightage.map((entry) =>
                      entry.id === area.id ? { ...entry, ...changes } : entry
                    ),
                  })
                }
                onRemove={() =>
                  patchDefinition({
                    content_weightage: definition.content_weightage.filter((entry) => entry.id !== area.id),
                  })
                }
              />
            ))}
          </div>
        )}
      </Panel>

      {/* ---- Competency -------------------------------------------------- */}
      <Panel
        title="Competency weightage"
        subtitle="What share of marks tests which cognitive demand. Use your board's own bands, Bloom's levels, or whatever standard set your curriculum names — nothing here is fixed to one board."
        tally={`${trimNumber(competencyTally)}%`}
        tallyWarn={competencyTally > 0 && Math.abs(competencyTally - 100) > 0.01}
        onAdd={() =>
          patchDefinition({
            competency_distribution: [
              ...definition.competency_distribution,
              { id: newId('competency'), code: '', label: '', weight_pct: 0 },
            ],
          })
        }
        addLabel="Add band"
      >
        {definition.competency_distribution.length === 0 ? (
          <Empty>No competency split set.</Empty>
        ) : (
          <div className="flex flex-col gap-2">
            {definition.competency_distribution.map((band) => (
              <CompetencyRow
                key={band.id}
                band={band}
                onChange={(changes) =>
                  patchDefinition({
                    competency_distribution: definition.competency_distribution.map((entry) =>
                      entry.id === band.id ? { ...entry, ...changes } : entry
                    ),
                  })
                }
                onRemove={() =>
                  patchDefinition({
                    competency_distribution: definition.competency_distribution.filter(
                      (entry) => entry.id !== band.id
                    ),
                  })
                }
              />
            ))}
          </div>
        )}
      </Panel>

      {/* ---- Difficulty and notes ---------------------------------------- */}
      <Panel
        title="Difficulty and choice"
        tally={difficultyTally > 0 ? `${trimNumber(difficultyTally)}%` : ''}
        tallyWarn={difficultyTally > 0 && Math.abs(difficultyTally - 100) > 0.01}
      >
        <div className="grid gap-3 md:grid-cols-4">
          {(['easy', 'average', 'difficult'] as const).map((level) => (
            <Field key={level} label={`${level[0].toUpperCase()}${level.slice(1)} %`}>
              <input
                type="number"
                min={0}
                max={100}
                value={definition.difficulty_distribution[level]}
                onChange={(event) =>
                  patchDefinition({
                    difficulty_distribution: {
                      ...definition.difficulty_distribution,
                      [level]: Number(event.target.value) || 0,
                    },
                  })
                }
                className={inputClass}
              />
            </Field>
          ))}

          <Field label="Internal choice %">
            <input
              type="number"
              min={0}
              max={100}
              value={definition.internal_choice_pct}
              onChange={(event) =>
                patchDefinition({ internal_choice_pct: Number(event.target.value) || 0 })
              }
              className={inputClass}
            />
          </Field>
        </div>

        <Field label="Notes">
          <textarea
            value={definition.notes}
            onChange={(event) => patchDefinition({ notes: event.target.value })}
            rows={4}
            placeholder="Anything a teacher building a paper from this needs to know"
            className={`${inputClass} h-auto py-2 leading-6`}
          />
        </Field>
      </Panel>
    </div>
  );
}

// -- Small pieces ------------------------------------------------------------

const inputClass =
  'h-10 w-full rounded-[10px] border border-[#E4E9F2] bg-white px-3 text-[13px] text-[#172554] placeholder:text-[#A8B3C4]';

const cellClass =
  'h-9 w-full rounded-[9px] border border-[#E4E9F2] bg-white px-2 text-[12.5px] text-[#172554] placeholder:text-[#A8B3C4]';

function Panel({
  title,
  subtitle,
  tally,
  tallyWarn,
  onAdd,
  addLabel,
  children,
}: {
  title: string;
  subtitle?: string;
  tally?: string;
  tallyWarn?: boolean;
  onAdd?: () => void;
  addLabel?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-[18px] border border-[#E4E9F2] bg-white p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <h4 className="text-[14px] font-semibold text-[#172554]">{title}</h4>
          {subtitle ? (
            <p className="mt-0.5 max-w-3xl text-[12px] leading-5 text-[#7A889D]">{subtitle}</p>
          ) : null}
        </div>

        <div className="flex items-center gap-2">
          {tally ? (
            <span
              className={`rounded-full border px-2.5 py-1 text-[11.5px] font-semibold ${
                tallyWarn
                  ? 'border-amber-200 bg-amber-50 text-amber-700'
                  : 'border-[#E4E9F2] bg-[#F8FAFC] text-[#334155]'
              }`}
            >
              {tally}
            </span>
          ) : null}
          {onAdd ? (
            <button
              type="button"
              onClick={onAdd}
              className="inline-flex items-center gap-1.5 rounded-[9px] border border-[#E4E9F2] px-2.5 py-1.5 text-[12px] font-semibold text-[#5846EA] transition hover:bg-[#F5F4FF]"
            >
              <Plus size={13} /> {addLabel ?? 'Add'}
            </button>
          ) : null}
        </div>
      </div>

      <div className="mt-3 flex flex-col gap-3">{children}</div>
    </section>
  );
}

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[#7A889D]">
        {label}
      </span>
      {children}
      {hint ? <span className="text-[11.5px] text-amber-700">{hint}</span> : null}
    </label>
  );
}

function Select({
  value,
  onChange,
  options,
  compact,
}: {
  value: string;
  onChange: (value: string) => void;
  options: Array<{ value: string; label: string }>;
  compact?: boolean;
}) {
  return (
    <div className="relative">
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className={`${
          compact ? 'h-9 text-[12.5px]' : 'h-10 text-[13px]'
        } w-full appearance-none rounded-[9px] border border-[#E4E9F2] bg-white pl-2.5 pr-7 text-[#172554]`}
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
      <ChevronDown
        size={14}
        className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-[#98A4B6]"
      />
    </div>
  );
}

function NumberCell({
  value,
  onChange,
  step = 1,
}: {
  value: number;
  onChange: (value: number) => void;
  step?: number;
}) {
  return (
    <input
      type="number"
      min={0}
      step={step}
      value={value}
      onChange={(event) => onChange(Number(event.target.value) || 0)}
      className={`${cellClass} text-right`}
    />
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return (
    <p className="rounded-[12px] border border-dashed border-[#D7DEEA] px-3.5 py-3 text-[12.5px] leading-5 text-[#7A889D]">
      {children}
    </p>
  );
}

function ContentRow({
  area,
  chapters,
  chaptersLoading,
  totalMarks,
  onChange,
  onRemove,
}: {
  area: ContentWeight;
  chapters: ChapterOption[];
  chaptersLoading: boolean;
  totalMarks: number;
  onChange: (changes: Partial<ContentWeight>) => void;
  onRemove: () => void;
}) {
  return (
    <div className="grid items-center gap-2 rounded-[12px] border border-[#E4E9F2] bg-[#FAFBFE] px-3 py-2 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_88px_88px_34px]">
      <input
        value={area.name}
        onChange={(event) => onChange({ name: event.target.value })}
        placeholder="Content area or chapter name"
        className={cellClass}
      />

      <Select
        value={area.chapter_id ? String(area.chapter_id) : ''}
        onChange={(value) => {
          const chapterId = value ? Number(value) : null;
          const chapter = chapters.find((entry) => entry.id === chapterId);

          // Picking a chapter fills the name too, but only while the name is
          // empty or still the previously picked chapter's — a coordinator who
          // typed their own wording keeps it.
          onChange({
            chapter_id: chapterId,
            name: chapter && (area.name === '' || chapters.some((c) => c.name === area.name))
              ? chapter.name
              : area.name,
          });
        }}
        options={[
          { value: '', label: chaptersLoading ? 'Loading chapters…' : 'No chapter bound' },
          ...chapters.map((chapter) => ({ value: String(chapter.id), label: chapter.name })),
        ]}
        compact
      />

      <input
        type="number"
        min={0}
        step={0.5}
        value={area.marks}
        onChange={(event) => {
          const marks = Number(event.target.value) || 0;

          onChange({
            marks,
            // Percent follows marks so the two cannot drift apart; it is still
            // editable on its own for a blueprint expressed only in percentages.
            weight_pct: totalMarks > 0 ? Math.round((marks / totalMarks) * 10000) / 100 : area.weight_pct,
          });
        }}
        placeholder="Marks"
        className={`${cellClass} text-right`}
      />

      <input
        type="number"
        min={0}
        max={100}
        step={0.5}
        value={area.weight_pct}
        onChange={(event) => onChange({ weight_pct: Number(event.target.value) || 0 })}
        placeholder="%"
        className={`${cellClass} text-right`}
      />

      <button
        type="button"
        onClick={onRemove}
        className="justify-self-end rounded-[8px] p-1.5 text-[#98A4B6] transition hover:bg-red-50 hover:text-[#B91C1C]"
        aria-label="Remove area"
      >
        <Trash2 size={14} />
      </button>
    </div>
  );
}

function CompetencyRow({
  band,
  onChange,
  onRemove,
}: {
  band: CompetencyWeight;
  onChange: (changes: Partial<CompetencyWeight>) => void;
  onRemove: () => void;
}) {
  return (
    <div className="grid items-center gap-2 rounded-[12px] border border-[#E4E9F2] bg-[#FAFBFE] px-3 py-2 md:grid-cols-[minmax(0,1fr)_180px_88px_34px]">
      <input
        value={band.label}
        onChange={(event) => onChange({ label: event.target.value })}
        placeholder="e.g. Demonstrate Knowledge and Understanding"
        className={cellClass}
      />
      <input
        value={band.code}
        onChange={(event) => onChange({ code: event.target.value })}
        placeholder="code (optional)"
        className={cellClass}
      />
      <input
        type="number"
        min={0}
        max={100}
        step={0.5}
        value={band.weight_pct}
        onChange={(event) => onChange({ weight_pct: Number(event.target.value) || 0 })}
        placeholder="%"
        className={`${cellClass} text-right`}
      />
      <button
        type="button"
        onClick={onRemove}
        className="justify-self-end rounded-[8px] p-1.5 text-[#98A4B6] transition hover:bg-red-50 hover:text-[#B91C1C]"
        aria-label="Remove band"
      >
        <Trash2 size={14} />
      </button>
    </div>
  );
}

export type { Blueprint };

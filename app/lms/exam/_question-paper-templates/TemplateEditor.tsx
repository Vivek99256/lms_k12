'use client';

// ---------------------------------------------------------------------------
// The blueprint editor — how a school shapes a template to its own house style.
//
// Every control here edits *layout*. There is nowhere to type a school name, a
// subject or a question, because those are never part of a template: the editor
// offers `{{placeholders}}` instead, which the renderer fills from the signed-in
// school and the selected paper.
// ---------------------------------------------------------------------------

import { useMemo } from 'react';
import { ChevronDown, ChevronUp, Plus, Trash2 } from 'lucide-react';
import { fallbackTypeLabel, foldTypeToken } from '@/lib/question-paper/question-types';
import type {
  Blueprint,
  BlueprintSection,
  MetaField,
  SectionSourceMode,
  TemplateOptions,
} from './types';

const INPUT_CLASS =
  'h-9 w-full rounded-[8px] border border-[#CFD9E6] bg-white px-3 text-[13px] text-[#172554] outline-none focus:border-[#7C6CF4]';
const SELECT_CLASS = `${INPUT_CLASS} appearance-none pr-8`;
const LABEL_CLASS = 'text-[11px] font-semibold uppercase tracking-wide text-[#5F7087]';

const SOURCE_MODE_LABELS: Record<SectionSourceMode, string> = {
  types: 'Questions of chosen types',
  points: 'Questions worth chosen marks',
  chapters: 'Questions from chosen chapters',
  rest: 'Everything not yet placed',
  all: 'Every question in the paper',
  manual: 'Specific question ids',
};

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
    <label className="flex flex-col gap-1">
      <span className={LABEL_CLASS}>{label}</span>
      {children}
      {hint ? <span className="text-[11px] text-[#7A889D]">{hint}</span> : null}
    </label>
  );
}

function Toggle({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (value: boolean) => void;
}) {
  return (
    <label className="flex items-center gap-2 text-[13px] text-[#334155]">
      <input
        type="checkbox"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
        className="h-4 w-4 rounded border-[#CFD9E6] accent-[#5846EA]"
      />
      {label}
    </label>
  );
}

/** One Question type the editor offers, and the value it stores when chosen. */
type QuestionTypeChoice = {
  key: string;
  /** Written into the blueprint — a `question_type_catalog.code`. */
  value: string;
  /** Shown on the chip — the label the catalogue configures for that code. */
  label: string;
};

/**
 * The Question type choices for one section: every row the
 * `question_type_catalog` offers, plus anything the section already asks for
 * that the catalogue does not list.
 *
 * That second group matters. A template saved before this dropdown was fed
 * from the catalogue stores a grading name ("multiple"), and a catalogue row
 * can be retired after a template has been saved against it. Either way the
 * value still selects questions when the paper is rendered, so it has to stay
 * visible here -- otherwise a teacher opening the template cannot see what it
 * asks for, and the first save would silently drop it.
 */
function questionTypeChoices(
  catalogue: TemplateOptions['question_types'],
  selected: readonly string[]
): QuestionTypeChoice[] {
  const choices: QuestionTypeChoice[] = [];
  const seen = new Set<string>();

  (catalogue ?? []).forEach((type) => {
    const value = (type.code ?? '').trim();
    const token = foldTypeToken(value);

    if (token === '' || seen.has(token)) return;

    seen.add(token);
    choices.push({
      key: `catalog-${type.id}-${value}`,
      value,
      label: (type.label ?? '').trim() || fallbackTypeLabel(value),
    });
  });

  (selected ?? []).forEach((value) => {
    const token = foldTypeToken(value);

    if (token === '' || seen.has(token)) return;

    seen.add(token);
    choices.push({ key: `saved-${token}`, value, label: fallbackTypeLabel(value) });
  });

  return choices;
}

function linesToList(value: string): string[] {
  return value
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);
}

function numbersToList(value: string): number[] {
  return value
    .split(',')
    .map((part) => Number(part.trim()))
    .filter((part) => Number.isFinite(part) && part > 0);
}

function MetaRows({
  label,
  rows,
  onChange,
}: {
  label: string;
  rows: MetaField[];
  onChange: (rows: MetaField[]) => void;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <span className={LABEL_CLASS}>{label}</span>

      {rows.map((row, index) => (
        <div key={index} className="flex items-center gap-1.5">
          <input
            value={row.label}
            placeholder="Label"
            onChange={(event) => {
              const next = [...rows];
              next[index] = { ...row, label: event.target.value };
              onChange(next);
            }}
            className={`${INPUT_CLASS} max-w-[120px]`}
          />
          <input
            value={row.value}
            placeholder="{{duration}}"
            onChange={(event) => {
              const next = [...rows];
              next[index] = { ...row, value: event.target.value };
              onChange(next);
            }}
            className={INPUT_CLASS}
          />
          <button
            type="button"
            aria-label={`Remove ${label} row`}
            onClick={() => onChange(rows.filter((_, rowIndex) => rowIndex !== index))}
            className="shrink-0 rounded-[8px] border border-[#E4E9F2] p-2 text-[#94A3B8] hover:text-[#DC2626]"
          >
            <Trash2 size={14} />
          </button>
        </div>
      ))}

      <button
        type="button"
        onClick={() => onChange([...rows, { label: '', value: '' }])}
        className="inline-flex w-fit items-center gap-1 text-[12px] font-semibold text-[#5846EA] hover:underline"
      >
        <Plus size={13} /> Add line
      </button>
    </div>
  );
}

function SectionCard({
  section,
  index,
  total,
  options,
  onChange,
  onMove,
  onRemove,
}: {
  section: BlueprintSection;
  index: number;
  total: number;
  options: TemplateOptions;
  onChange: (section: BlueprintSection) => void;
  onMove: (direction: -1 | 1) => void;
  onRemove: () => void;
}) {
  const patch = (changes: Partial<BlueprintSection>) => onChange({ ...section, ...changes });

  const typeChoices = useMemo(
    () => questionTypeChoices(options.question_types, section.source.questionTypes),
    [options.question_types, section.source.questionTypes]
  );

  return (
    <div className="rounded-[14px] border border-[#E4E9F2] bg-[#FBFCFE] p-4">
      <div className="mb-3 flex items-center justify-between gap-2">
        <p className="text-[13px] font-semibold text-[#172554]">
          Section {index + 1}
          {section.title ? ` — ${section.title}` : ''}
        </p>

        <div className="flex items-center gap-1">
          <button
            type="button"
            aria-label="Move section up"
            disabled={index === 0}
            onClick={() => onMove(-1)}
            className="rounded-[8px] border border-[#E4E9F2] bg-white p-1.5 text-[#64748B] disabled:opacity-40"
          >
            <ChevronUp size={14} />
          </button>
          <button
            type="button"
            aria-label="Move section down"
            disabled={index === total - 1}
            onClick={() => onMove(1)}
            className="rounded-[8px] border border-[#E4E9F2] bg-white p-1.5 text-[#64748B] disabled:opacity-40"
          >
            <ChevronDown size={14} />
          </button>
          <button
            type="button"
            aria-label="Remove section"
            disabled={total === 1}
            onClick={onRemove}
            className="rounded-[8px] border border-[#E4E9F2] bg-white p-1.5 text-[#94A3B8] hover:text-[#DC2626] disabled:opacity-40"
          >
            <Trash2 size={14} />
          </button>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Section title" hint="Blank prints no heading. Placeholders allowed.">
          <input
            value={section.title}
            onChange={(event) => patch({ title: event.target.value })}
            placeholder="SECTION A"
            className={INPUT_CLASS}
          />
        </Field>

        <Field label="Subtitle">
          <input
            value={section.subtitle}
            onChange={(event) => patch({ subtitle: event.target.value })}
            placeholder="Multiple choice questions"
            className={INPUT_CLASS}
          />
        </Field>

        <Field label="Marks label" hint="e.g. {{section_marks}} marks">
          <input
            value={section.marksLabel}
            onChange={(event) => patch({ marksLabel: event.target.value })}
            className={INPUT_CLASS}
          />
        </Field>

        <Field label="Note under the heading">
          <input
            value={section.note}
            onChange={(event) => patch({ note: event.target.value })}
            className={INPUT_CLASS}
          />
        </Field>
      </div>

      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        <Field label="Take questions" hint="Sections fill in order; each takes from what is left.">
          <select
            value={section.source.mode}
            onChange={(event) =>
              patch({ source: { ...section.source, mode: event.target.value as SectionSourceMode } })
            }
            className={SELECT_CLASS}
          >
            {options.source_modes.map((mode) => (
              <option key={mode} value={mode}>
                {SOURCE_MODE_LABELS[mode] ?? mode}
              </option>
            ))}
          </select>
        </Field>

        <Field label="Maximum questions" hint="0 places every match.">
          <input
            type="number"
            min={0}
            value={section.source.limit}
            onChange={(event) =>
              patch({
                source: { ...section.source, limit: Math.max(0, Number(event.target.value) || 0) },
              })
            }
            className={INPUT_CLASS}
          />
        </Field>

        {section.source.mode === 'types' ? (
          <div className="sm:col-span-2">
            <span className={LABEL_CLASS}>Question types</span>
            <div className="mt-1.5 flex flex-wrap gap-1.5">
              {typeChoices.length === 0 ? (
                <p className="text-[12px] text-[#7A889D]">
                  No question types are configured in the question type catalogue yet.
                </p>
              ) : (
                typeChoices.map((choice) => {
                  const token = foldTypeToken(choice.value);
                  const active = section.source.questionTypes.some(
                    (name) => foldTypeToken(name) === token
                  );

                  return (
                    <button
                      key={choice.key}
                      type="button"
                      onClick={() =>
                        patch({
                          source: {
                            ...section.source,
                            // The catalogue's own `code` is what gets stored,
                            // so the blueprint stays keyed to the table rather
                            // than to a label a school may later reword.
                            questionTypes: active
                              ? section.source.questionTypes.filter(
                                  (name) => foldTypeToken(name) !== token
                                )
                              : [...section.source.questionTypes, choice.value],
                          },
                        })
                      }
                      className={`rounded-full border px-3 py-1 text-[12px] transition ${
                        active
                          ? 'border-[#5846EA] bg-[#EEF0FF] font-semibold text-[#5846EA]'
                          : 'border-[#D9E3F0] bg-white text-[#5F7087] hover:border-[#B9C6DC]'
                      }`}
                    >
                      {choice.label}
                    </button>
                  );
                })
              )}
            </div>
          </div>
        ) : null}

        {section.source.mode === 'points' ? (
          <Field label="Marks to match" hint="Comma separated, e.g. 2, 3">
            <input
              value={section.source.points.join(', ')}
              onChange={(event) =>
                patch({ source: { ...section.source, points: numbersToList(event.target.value) } })
              }
              className={INPUT_CLASS}
            />
          </Field>
        ) : null}

        {section.source.mode === 'chapters' ? (
          <Field label="Chapter ids" hint="Comma separated chapter ids from the syllabus.">
            <input
              value={section.source.chapterIds.join(', ')}
              onChange={(event) =>
                patch({
                  source: { ...section.source, chapterIds: numbersToList(event.target.value) },
                })
              }
              className={INPUT_CLASS}
            />
          </Field>
        ) : null}

        {section.source.mode === 'manual' ? (
          <Field label="Question ids" hint="Comma separated, printed in the order given.">
            <input
              value={section.source.questionIds.join(', ')}
              onChange={(event) =>
                patch({
                  source: { ...section.source, questionIds: numbersToList(event.target.value) },
                })
              }
              className={INPUT_CLASS}
            />
          </Field>
        ) : null}
      </div>

      <div className="mt-3 grid gap-3 sm:grid-cols-3 lg:grid-cols-5">
        <Field label="Number prefix">
          <input
            value={section.numbering.prefix}
            onChange={(event) =>
              patch({ numbering: { ...section.numbering, prefix: event.target.value } })
            }
            placeholder="Q."
            className={INPUT_CLASS}
          />
        </Field>

        <Field label="Number style">
          <select
            value={section.numbering.style}
            onChange={(event) =>
              patch({
                numbering: {
                  ...section.numbering,
                  style: event.target.value as BlueprintSection['numbering']['style'],
                },
              })
            }
            className={SELECT_CLASS}
          >
            <option value="decimal">1, 2, 3</option>
            <option value="upper-alpha">A, B, C</option>
            <option value="lower-alpha">a, b, c</option>
            <option value="roman">I, II, III</option>
          </select>
        </Field>

        <Field label="Start at">
          <input
            type="number"
            min={1}
            value={section.numbering.start}
            onChange={(event) =>
              patch({
                numbering: {
                  ...section.numbering,
                  start: Math.max(1, Number(event.target.value) || 1),
                },
              })
            }
            className={INPUT_CLASS}
          />
        </Field>

        <Field label="Part letters" hint="Used when the section is numbered once.">
          <select
            value={section.numbering.subStyle}
            onChange={(event) =>
              patch({
                numbering: {
                  ...section.numbering,
                  subStyle: event.target.value as BlueprintSection['numbering']['subStyle'],
                },
              })
            }
            className={SELECT_CLASS}
          >
            <option value="upper-alpha">(A) (B) (C)</option>
            <option value="lower-alpha">(a) (b) (c)</option>
            <option value="decimal">(1) (2) (3)</option>
            <option value="roman">(I) (II) (III)</option>
            <option value="none">No part letters</option>
          </select>
        </Field>

        <Field label="Layout">
          <select
            value={section.layout}
            onChange={(event) =>
              patch({ layout: event.target.value as BlueprintSection['layout'] })
            }
            className={SELECT_CLASS}
          >
            <option value="list">One per line</option>
            <option value="compact">Compact list</option>
            <option value="table">Table with marks column</option>
          </select>
        </Field>
      </div>

      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        <Field label="Answer space">
          <select
            value={section.answerSpace.mode}
            onChange={(event) =>
              patch({
                answerSpace: {
                  ...section.answerSpace,
                  mode: event.target.value as BlueprintSection['answerSpace']['mode'],
                },
              })
            }
            className={SELECT_CLASS}
          >
            <option value="none">None — answered in a separate book</option>
            <option value="lines">Ruled lines</option>
            <option value="box">Blank box</option>
            <option value="grid">Graph grid</option>
          </select>
        </Field>

        <Field label="Lines / height">
          <input
            type="number"
            min={0}
            value={section.answerSpace.lines}
            onChange={(event) =>
              patch({
                answerSpace: {
                  ...section.answerSpace,
                  lines: Math.max(0, Number(event.target.value) || 0),
                },
              })
            }
            className={INPUT_CLASS}
          />
        </Field>
      </div>

      <div className="mt-3 flex flex-wrap gap-x-5 gap-y-2">
        <Toggle
          label="Show marks per question"
          checked={section.showMarks}
          onChange={(value) => patch({ showMarks: value })}
        />
        <Toggle
          label="Show question type"
          checked={section.showQuestionType}
          onChange={(value) => patch({ showQuestionType: value })}
        />
        <Toggle
          label="Continue numbering from previous section"
          checked={!section.numbering.restart}
          onChange={(value) => patch({ numbering: { ...section.numbering, restart: !value } })}
        />
        <Toggle
          label="Number the section once, letter the questions as parts"
          checked={section.numbering.groupAsParts}
          onChange={(value) =>
            patch({ numbering: { ...section.numbering, groupAsParts: value } })
          }
        />
        <Toggle
          label="Optional questions"
          checked={section.optional.enabled}
          onChange={(value) => patch({ optional: { ...section.optional, enabled: value } })}
        />
      </div>

      {section.optional.enabled ? (
        <div className="mt-3 grid gap-3 rounded-[10px] border border-[#E4E9F2] bg-white p-3 sm:grid-cols-3">
          <Field label="Attempt">
            <input
              type="number"
              min={0}
              value={section.optional.attempt}
              onChange={(event) =>
                patch({
                  optional: {
                    ...section.optional,
                    attempt: Math.max(0, Number(event.target.value) || 0),
                  },
                })
              }
              className={INPUT_CLASS}
            />
          </Field>

          <Field label="Out of" hint="Also caps how many print.">
            <input
              type="number"
              min={0}
              value={section.optional.outOf}
              onChange={(event) =>
                patch({
                  optional: {
                    ...section.optional,
                    outOf: Math.max(0, Number(event.target.value) || 0),
                  },
                })
              }
              className={INPUT_CLASS}
            />
          </Field>

          <Field label="Label" hint="{{attempt}} and {{outOf}} are filled in.">
            <input
              value={section.optional.label}
              onChange={(event) =>
                patch({ optional: { ...section.optional, label: event.target.value } })
              }
              className={INPUT_CLASS}
            />
          </Field>
        </div>
      ) : null}

      <div className="mt-3">
        <Field label="Section instructions" hint="One per line.">
          <textarea
            value={section.instructions.join('\n')}
            onChange={(event) => patch({ instructions: linesToList(event.target.value) })}
            rows={2}
            className="w-full rounded-[8px] border border-[#CFD9E6] bg-white px-3 py-2 text-[13px] text-[#172554] outline-none focus:border-[#7C6CF4]"
          />
        </Field>
      </div>
    </div>
  );
}

export default function TemplateEditor({
  name,
  description,
  blueprint,
  options,
  onNameChange,
  onDescriptionChange,
  onBlueprintChange,
}: {
  name: string;
  description: string;
  blueprint: Blueprint;
  options: TemplateOptions;
  onNameChange: (value: string) => void;
  onDescriptionChange: (value: string) => void;
  onBlueprintChange: (blueprint: Blueprint) => void;
}) {
  const patch = (changes: Partial<Blueprint>) => onBlueprintChange({ ...blueprint, ...changes });

  const placeholderHint = useMemo(
    () => options.placeholders.map((item) => item.token).join('  '),
    [options.placeholders]
  );

  const updateSection = (index: number, section: BlueprintSection) => {
    const next = [...blueprint.sections];
    next[index] = section;
    patch({ sections: next });
  };

  return (
    <div className="flex flex-col gap-5">
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Template name">
          <input
            value={name}
            onChange={(event) => onNameChange(event.target.value)}
            placeholder="Half-yearly paper"
            className={INPUT_CLASS}
          />
        </Field>

        <Field label="Description">
          <input
            value={description}
            onChange={(event) => onDescriptionChange(event.target.value)}
            placeholder="What this layout is used for"
            className={INPUT_CLASS}
          />
        </Field>
      </div>

      <div className="rounded-[12px] border border-[#D8E5FF] bg-[#F5F8FF] px-4 py-3">
        <p className="text-[12px] font-semibold text-[#3C4E86]">
          Placeholders — filled from the school and the exam you print
        </p>
        <p className="mt-1 break-words font-mono text-[11px] leading-5 text-[#4C63A8]">
          {placeholderHint}
        </p>
      </div>

      <details open className="rounded-[14px] border border-[#E4E9F2] p-4">
        <summary className="cursor-pointer text-[13px] font-semibold text-[#172554]">
          Page and header
        </summary>

        <div className="mt-3 grid gap-3 sm:grid-cols-4">
          <Field label="Page size">
            <select
              value={blueprint.page.size}
              onChange={(event) => patch({ page: { ...blueprint.page, size: event.target.value } })}
              className={SELECT_CLASS}
            >
              <option value="A4">A4</option>
              <option value="Letter">Letter</option>
              <option value="Legal">Legal</option>
              <option value="A3">A3</option>
            </select>
          </Field>

          <Field label="Orientation">
            <select
              value={blueprint.page.orientation}
              onChange={(event) =>
                patch({
                  page: {
                    ...blueprint.page,
                    orientation: event.target.value as Blueprint['page']['orientation'],
                  },
                })
              }
              className={SELECT_CLASS}
            >
              <option value="portrait">Portrait</option>
              <option value="landscape">Landscape</option>
            </select>
          </Field>

          <Field label="Margin">
            <input
              value={blueprint.page.margin}
              onChange={(event) =>
                patch({ page: { ...blueprint.page, margin: event.target.value } })
              }
              placeholder="16mm"
              className={INPUT_CLASS}
            />
          </Field>

          <Field label="Body size (pt)">
            <input
              type="number"
              min={8}
              max={18}
              value={blueprint.page.fontSize}
              onChange={(event) =>
                patch({
                  page: {
                    ...blueprint.page,
                    fontSize: Math.min(18, Math.max(8, Number(event.target.value) || 11)),
                  },
                })
              }
              className={INPUT_CLASS}
            />
          </Field>
        </div>

        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <Field label="Title" hint="e.g. {{exam_name}}">
            <input
              value={blueprint.header.title}
              onChange={(event) =>
                patch({ header: { ...blueprint.header, title: event.target.value } })
              }
              className={INPUT_CLASS}
            />
          </Field>

          <Field label="Subtitle" hint="e.g. {{subject}} — {{standard}}">
            <input
              value={blueprint.header.subtitle}
              onChange={(event) =>
                patch({ header: { ...blueprint.header, subtitle: event.target.value } })
              }
              className={INPUT_CLASS}
            />
          </Field>

          <Field label="Typeface">
            <select
              value={blueprint.page.fontFamily}
              onChange={(event) =>
                patch({
                  page: {
                    ...blueprint.page,
                    fontFamily: event.target.value as Blueprint['page']['fontFamily'],
                  },
                })
              }
              className={SELECT_CLASS}
            >
              <option value="serif">Serif</option>
              <option value="sans">Sans serif</option>
            </select>
          </Field>

          <Field label="Rule under the header">
            <select
              value={blueprint.header.rule}
              onChange={(event) =>
                patch({
                  header: {
                    ...blueprint.header,
                    rule: event.target.value as Blueprint['header']['rule'],
                  },
                })
              }
              className={SELECT_CLASS}
            >
              <option value="none">None</option>
              <option value="single">Single line</option>
              <option value="double">Double line</option>
              <option value="dashed">Dashed</option>
            </select>
          </Field>
        </div>

        <div className="mt-3 grid gap-4 sm:grid-cols-2">
          <MetaRows
            label="Left of the header"
            rows={blueprint.header.metaLeft}
            onChange={(rows) => patch({ header: { ...blueprint.header, metaLeft: rows } })}
          />
          <MetaRows
            label="Right of the header"
            rows={blueprint.header.metaRight}
            onChange={(rows) => patch({ header: { ...blueprint.header, metaRight: rows } })}
          />
        </div>

        <div className="mt-3 flex flex-wrap gap-x-5 gap-y-2">
          <Toggle
            label="School logo"
            checked={blueprint.header.showLogo}
            onChange={(value) => patch({ header: { ...blueprint.header, showLogo: value } })}
          />
          <Toggle
            label="School name"
            checked={blueprint.header.showSchoolName}
            onChange={(value) => patch({ header: { ...blueprint.header, showSchoolName: value } })}
          />
          <Toggle
            label="Student detail strip"
            checked={blueprint.header.showStudentFields}
            onChange={(value) =>
              patch({ header: { ...blueprint.header, showStudentFields: value } })
            }
          />
          <Toggle
            label="Align header left"
            checked={blueprint.header.align === 'left'}
            onChange={(value) =>
              patch({ header: { ...blueprint.header, align: value ? 'left' : 'center' } })
            }
          />
        </div>

        {blueprint.header.showStudentFields ? (
          <div className="mt-3">
            <Field label="Student fields" hint="One per line — printed as blanks to fill in.">
              <textarea
                value={blueprint.header.studentFields.join('\n')}
                onChange={(event) =>
                  patch({
                    header: {
                      ...blueprint.header,
                      studentFields: linesToList(event.target.value),
                    },
                  })
                }
                rows={3}
                className="w-full rounded-[8px] border border-[#CFD9E6] bg-white px-3 py-2 text-[13px] text-[#172554] outline-none focus:border-[#7C6CF4]"
              />
            </Field>
          </div>
        ) : null}
      </details>

      <details className="rounded-[14px] border border-[#E4E9F2] p-4">
        <summary className="cursor-pointer text-[13px] font-semibold text-[#172554]">
          Instructions and footer
        </summary>

        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <Field label="Instructions heading">
            <input
              value={blueprint.instructions.title}
              onChange={(event) =>
                patch({ instructions: { ...blueprint.instructions, title: event.target.value } })
              }
              className={INPUT_CLASS}
            />
          </Field>

          <Field label="Numbering">
            <select
              value={blueprint.instructions.numbering}
              onChange={(event) =>
                patch({
                  instructions: {
                    ...blueprint.instructions,
                    numbering: event.target.value as Blueprint['instructions']['numbering'],
                  },
                })
              }
              className={SELECT_CLASS}
            >
              <option value="decimal">1. 2. 3.</option>
              <option value="paren">(1) (2) (3)</option>
              <option value="lower-alpha">a. b. c.</option>
              <option value="roman">I. II. III.</option>
              <option value="bullet">Bullets</option>
              <option value="none">No markers</option>
            </select>
          </Field>
        </div>

        <div className="mt-3">
          <Field label="Instructions" hint="One per line.">
            <textarea
              value={blueprint.instructions.items.join('\n')}
              onChange={(event) =>
                patch({
                  instructions: {
                    ...blueprint.instructions,
                    items: linesToList(event.target.value),
                  },
                })
              }
              rows={4}
              className="w-full rounded-[8px] border border-[#CFD9E6] bg-white px-3 py-2 text-[13px] text-[#172554] outline-none focus:border-[#7C6CF4]"
            />
          </Field>
        </div>

        <div className="mt-3">
          <Field label="Footer line">
            <input
              value={blueprint.footer.text}
              onChange={(event) =>
                patch({ footer: { ...blueprint.footer, text: event.target.value } })
              }
              placeholder="*******"
              className={INPUT_CLASS}
            />
          </Field>
        </div>
      </details>

      <div className="flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <p className="text-[13px] font-semibold text-[#172554]">Sections</p>
          <button
            type="button"
            onClick={() =>
              patch({
                sections: [
                  ...blueprint.sections,
                  {
                    ...options.defaults.sections[0],
                    id: `section-${Date.now()}`,
                    title: '',
                    source: { ...options.defaults.sections[0].source, mode: 'rest' },
                  },
                ],
              })
            }
            className="inline-flex items-center gap-1 rounded-[8px] border border-[#CFD9E6] bg-white px-3 py-1.5 text-[12px] font-semibold text-[#5846EA]"
          >
            <Plus size={14} /> Add section
          </button>
        </div>

        {blueprint.sections.map((section, index) => (
          <SectionCard
            key={section.id}
            section={section}
            index={index}
            total={blueprint.sections.length}
            options={options}
            onChange={(next) => updateSection(index, next)}
            onMove={(direction) => {
              const target = index + direction;
              if (target < 0 || target >= blueprint.sections.length) return;
              const next = [...blueprint.sections];
              [next[index], next[target]] = [next[target], next[index]];
              patch({ sections: next });
            }}
            onRemove={() =>
              patch({ sections: blueprint.sections.filter((_, order) => order !== index) })
            }
          />
        ))}
      </div>
    </div>
  );
}

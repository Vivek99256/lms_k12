'use client';

// ---------------------------------------------------------------------------
// The HPC blueprint editor.
//
// A Holistic Progress Card has no marks, so there is no total to reconcile and
// nothing here adds up to anything. What it designs instead is: what gets
// looked at (areas → curricular goals → competencies → learning outcomes),
// what a judgement may say (the proficiency scale), whose judgement counts
// (self, peer, teacher, parent), and what the judgement rests on (activities
// and evidence).
//
// The proficiency scale is editable rather than fixed because the published
// cards genuinely disagree: the Foundational card reads Beginner / Progressive
// / Proficient, the Middle Stage card reads Beginner / Proficient / Advanced.
// Hardcoding either would misreport the other.
//
// Controlled throughout, and nothing refuses input — an HPC design is built up
// across a term, and what is still missing is reported, never blocked.
// ---------------------------------------------------------------------------

import { useCallback } from 'react';
import { ChevronDown, ChevronRight, Plus, Trash2 } from 'lucide-react';
import type {
  CodeLabel,
  HpcArea,
  HpcCompetency,
  HpcCurricularGoal,
  HpcDraft,
  HpcOptions,
  HpcPartA,
  HpcStage,
  ProficiencyLevel,
} from './types';

type Props = {
  draft: HpcDraft;
  options: HpcOptions;
  onChange: (draft: HpcDraft) => void;
};

const inputClass =
  'h-10 w-full rounded-[10px] border border-[#E4E9F2] bg-white px-3 text-[13px] text-[#172554] placeholder:text-[#A8B3C4]';

const cellClass =
  'h-9 w-full rounded-[9px] border border-[#E4E9F2] bg-white px-2.5 text-[12.5px] text-[#172554] placeholder:text-[#A8B3C4]';

function newId(prefix: string): string {
  return `${prefix}-${Math.random().toString(36).slice(2, 10)}`;
}

/**
 * What a stage's areas are actually called on its own card.
 *
 * The Foundational card lists development DOMAINS; from the Middle Stage the
 * same slot lists curricular AREAS. Same structure, different word, and using
 * the wrong one makes the screen read like it belongs to another document.
 */
function areaNoun(stage: HpcStage): { singular: string; plural: string } {
  // Only the Foundational card lists development DOMAINS. From Preparatory
  // upwards the same slot lists curricular AREAS — six of them at Preparatory,
  // nine at Middle, and at Secondary a single group project the learner picks
  // subjects for.
  return stage === 'Foundational'
    ? { singular: 'domain', plural: 'Development domains' }
    : { singular: 'area', plural: 'Curricular areas' };
}

export default function HpcBlueprintEditor({ draft, options, onChange }: Props) {
  const definition = draft.definition;
  const nouns = areaNoun(definition.stage);

  const patch = useCallback(
    (changes: Partial<HpcDraft>) => onChange({ ...draft, ...changes } as HpcDraft),
    [draft, onChange]
  );

  const patchDefinition = useCallback(
    (changes: Partial<HpcDraft['definition']>) =>
      onChange({ ...draft, definition: { ...draft.definition, ...changes } }),
    [draft, onChange]
  );

  const updateArea = useCallback(
    (areaId: string, changes: Partial<HpcArea>) =>
      patchDefinition({
        areas: definition.areas.map((area) => (area.id === areaId ? { ...area, ...changes } : area)),
      }),
    [definition.areas, patchDefinition]
  );

  return (
    <div className="flex flex-col gap-4">
      {/* ---- Details ---------------------------------------------------- */}
      <Panel title="Details">
        <div className="grid gap-3 md:grid-cols-2">
          <Field label="Blueprint name">
            <input
              value={draft.name}
              onChange={(event) => patch({ name: event.target.value })}
              placeholder="e.g. HPC — Grade 7, Term 1"
              className={inputClass}
            />
          </Field>

          <Field label="Status">
            <Select
              value={draft.status}
              onChange={(value) => patch({ status: value as HpcDraft['status'] })}
              options={options.defaults ? ['Draft', 'Active', 'Archived'].map((s) => ({ code: s, label: s })) : []}
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

        <div className="grid gap-3 md:grid-cols-3">
          <Field
            label="Stage"
            hint="Changing the stage does not rewrite the scale or the areas — those stay as you set them."
          >
            <Select
              value={definition.stage}
              onChange={(value) => {
                // `stage` lives on the row as a filterable facet AND inside the
                // definition, so both move together or the list would sort a
                // blueprint into the wrong stage.
                patch({ stage: value });
                patchDefinition({ stage: value as HpcStage });
              }}
              options={options.stages.map((stage) => ({ code: stage, label: stage }))}
            />
          </Field>

          <Field label="Class band">
            <input
              value={draft.class_band}
              onChange={(event) => patch({ class_band: event.target.value })}
              placeholder="e.g. VI-VIII"
              className={inputClass}
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
      </Panel>

      {/* ---- Proficiency scale ------------------------------------------ */}
      <Panel
        title="Proficiency scale"
        subtitle="What a judgement is allowed to say. There are no marks anywhere in an HPC — this scale is the whole vocabulary of achievement, so it is worth writing the descriptors out in the words your teachers will actually use."
        onAdd={() =>
          patchDefinition({
            proficiency_scale: [
              ...definition.proficiency_scale,
              { code: newId('level'), label: '', descriptor: '' },
            ],
          })
        }
        addLabel="Add level"
      >
        <div className="flex flex-col gap-2">
          {definition.proficiency_scale.map((level, index) => (
            <LevelRow
              key={`${level.code}-${index}`}
              level={level}
              onChange={(changes) =>
                patchDefinition({
                  proficiency_scale: definition.proficiency_scale.map((entry, entryIndex) =>
                    entryIndex === index ? { ...entry, ...changes } : entry
                  ),
                })
              }
              onRemove={() =>
                patchDefinition({
                  proficiency_scale: definition.proficiency_scale.filter(
                    (_, entryIndex) => entryIndex !== index
                  ),
                })
              }
              canRemove={definition.proficiency_scale.length > 2}
            />
          ))}
        </div>
      </Panel>

      {/* ---- Who assesses ------------------------------------------------ */}
      <Panel
        title="Who assesses"
        subtitle="An HPC is meant to carry more than one voice: the student reflects, a peer responds, the teacher observes, and the parent contributes from home."
      >
        <CheckGroup
          options={options.assessors}
          selected={definition.assessors}
          onChange={(assessors) => patchDefinition({ assessors })}
        />
      </Panel>

      {/* ---- Abilities ---------------------------------------------------- */}
      <Panel
        title="Abilities scored per activity"
        subtitle='The Middle Stage rubric scores three strands per activity, named per subject on the card — Language Education reads "Literary Awareness". Leave this empty for a stage whose card does not use them.'
        onAdd={() =>
          patchDefinition({
            abilities: [...definition.abilities, { id: newId('ability'), code: '', label: '' }],
          })
        }
        addLabel="Add ability"
      >
        {definition.abilities.length === 0 ? (
          <Empty>No abilities set — judgements will be recorded against competencies alone.</Empty>
        ) : (
          <div className="flex flex-col gap-2">
            {definition.abilities.map((ability) => (
              <div
                key={ability.id}
                className="grid items-center gap-2 rounded-[12px] border border-[#E4E9F2] bg-[#FAFBFE] px-3 py-2 md:grid-cols-[minmax(0,1fr)_180px_34px]"
              >
                <input
                  value={ability.label}
                  onChange={(event) =>
                    patchDefinition({
                      abilities: definition.abilities.map((entry) =>
                        entry.id === ability.id ? { ...entry, label: event.target.value } : entry
                      ),
                    })
                  }
                  placeholder="e.g. Awareness"
                  className={cellClass}
                />
                <input
                  value={ability.code}
                  onChange={(event) =>
                    patchDefinition({
                      abilities: definition.abilities.map((entry) =>
                        entry.id === ability.id ? { ...entry, code: event.target.value } : entry
                      ),
                    })
                  }
                  placeholder="code (optional)"
                  className={cellClass}
                />
                <button
                  type="button"
                  onClick={() =>
                    patchDefinition({
                      abilities: definition.abilities.filter((entry) => entry.id !== ability.id),
                    })
                  }
                  className="justify-self-end rounded-[8px] p-1.5 text-[#98A4B6] transition hover:bg-red-50 hover:text-[#B91C1C]"
                  aria-label="Remove ability"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            ))}
          </div>
        )}
      </Panel>

      {/* ---- Areas -------------------------------------------------------- */}
      <Panel
        title={nouns.plural}
        subtitle="Each one carries the NCF chain the card is filled against: curricular goal → competency → learning outcomes. The published cards print these as blanks, so they come from the NCF for your stage, not from the card."
        tally={`${countCompetencies(definition.areas)} competencies`}
        onAdd={() =>
          patchDefinition({
            areas: [
              ...definition.areas,
              { id: newId('area'), name: '', code: '', note: '', curricular_goals: [] },
            ],
          })
        }
        addLabel={`Add ${nouns.singular}`}
      >
        <div className="flex flex-col gap-3">
          {definition.areas.map((area) => (
            <AreaBlock
              key={area.id}
              area={area}
              assessors={options.assessors}
              evidenceModes={options.evidence_modes}
              onChange={(changes) => updateArea(area.id, changes)}
              onRemove={() =>
                patchDefinition({ areas: definition.areas.filter((entry) => entry.id !== area.id) })
              }
              canRemove={definition.areas.length > 1}
            />
          ))}
        </div>
      </Panel>

      {/* ---- Activity and evidence ---------------------------------------- */}
      <Panel
        title="Activities and evidence"
        subtitle="How a judgement is arrived at. At the Foundational Stage the guide names just two methods as appropriate: observing the child, and analysing the evidence they produce."
      >
        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-[0.14em] text-[#7A889D]">
              Approach of the activity
            </p>
            <CheckGroup
              options={options.activity_approaches}
              selected={definition.activity_approaches}
              onChange={(activity_approaches) => patchDefinition({ activity_approaches })}
            />
          </div>

          <div>
            <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-[0.14em] text-[#7A889D]">
              Evidence gathered from
            </p>
            <CheckGroup
              options={options.evidence_modes}
              selected={definition.evidence_modes}
              onChange={(evidence_modes) => patchDefinition({ evidence_modes })}
            />
          </div>
        </div>
      </Panel>

      {/* ---- Part A ------------------------------------------------------- */}
      <Panel
        title="The child's own pages"
        subtitle="Part A of the card, before any subject is assessed. Goal setting and the ambition card start from the Middle Stage."
      >
        <CheckGroup
          options={options.part_a_elements}
          selected={Object.entries(definition.part_a)
            .filter(([, on]) => on)
            .map(([key]) => key)}
          onChange={(selected) =>
            patchDefinition({
              part_a: Object.fromEntries(
                options.part_a_elements.map((element) => [element.code, selected.includes(element.code)])
              ) as unknown as HpcPartA,
            })
          }
        />

        <Field label="Notes">
          <textarea
            value={definition.notes}
            onChange={(event) => patchDefinition({ notes: event.target.value })}
            rows={4}
            placeholder="Anything a teacher filling this card needs to know"
            className={`${inputClass} h-auto py-2 leading-6`}
          />
        </Field>
      </Panel>
    </div>
  );
}

function countCompetencies(areas: HpcArea[]): number {
  return areas.reduce(
    (total, area) =>
      total + area.curricular_goals.reduce((goals, goal) => goals + goal.competencies.length, 0),
    0
  );
}

/**
 * One area and everything under it.
 *
 * Collapsed by default: the Middle Stage card has nine areas, and nine
 * expanded NCF trees is a screen nobody can find anything in.
 */
function AreaBlock({
  area,
  assessors,
  evidenceModes,
  onChange,
  onRemove,
  canRemove,
}: {
  area: HpcArea;
  assessors: CodeLabel[];
  evidenceModes: CodeLabel[];
  onChange: (changes: Partial<HpcArea>) => void;
  onRemove: () => void;
  canRemove: boolean;
}) {
  const competencies = area.curricular_goals.reduce(
    (total, goal) => total + goal.competencies.length,
    0
  );

  const updateGoal = (goalId: string, changes: Partial<HpcCurricularGoal>) =>
    onChange({
      curricular_goals: area.curricular_goals.map((goal) =>
        goal.id === goalId ? { ...goal, ...changes } : goal
      ),
    });

  return (
    <details className="group rounded-[14px] border border-[#E4E9F2] bg-[#FAFBFE] p-3 [&_summary::-webkit-details-marker]:hidden">
      <summary className="flex cursor-pointer flex-wrap items-center gap-2">
        <ChevronRight
          size={15}
          className="shrink-0 text-[#98A4B6] transition group-open:rotate-90"
        />
        <input
          value={area.name}
          onClick={(event) => event.preventDefault()}
          onChange={(event) => onChange({ name: event.target.value })}
          placeholder="Area or domain name"
          className="h-9 min-w-[200px] flex-1 rounded-[9px] border border-[#E4E9F2] bg-white px-2.5 text-[13px] font-semibold text-[#172554]"
        />
        <span className="rounded-full border border-[#E4E9F2] bg-white px-2.5 py-1 text-[11.5px] font-semibold text-[#334155]">
          {area.curricular_goals.length} goals · {competencies} competencies
        </span>
        {canRemove ? (
          <button
            type="button"
            onClick={(event) => {
              event.preventDefault();
              onRemove();
            }}
            className="rounded-[8px] border border-[#E4E9F2] bg-white p-1.5 text-[#98A4B6] transition hover:bg-red-50 hover:text-[#B91C1C]"
            aria-label="Remove area"
          >
            <Trash2 size={14} />
          </button>
        ) : null}
      </summary>

      {area.note ? (
        <p className="mt-2 text-[11.5px] leading-5 text-[#7A889D]">{area.note}</p>
      ) : null}

      <div className="mt-2.5 flex flex-col gap-2.5">
        {area.curricular_goals.length === 0 ? (
          <Empty>
            No curricular goals yet. Take them from the NCF for this stage — the published card
            prints them as blanks for the teacher to choose.
          </Empty>
        ) : (
          area.curricular_goals.map((goal) => (
            <GoalBlock
              key={goal.id}
              goal={goal}
              assessors={assessors}
              evidenceModes={evidenceModes}
              onChange={(changes) => updateGoal(goal.id, changes)}
              onRemove={() =>
                onChange({
                  curricular_goals: area.curricular_goals.filter((entry) => entry.id !== goal.id),
                })
              }
            />
          ))
        )}

        <button
          type="button"
          onClick={() =>
            onChange({
              curricular_goals: [
                ...area.curricular_goals,
                { id: newId('cg'), code: '', name: '', competencies: [] },
              ],
            })
          }
          className="inline-flex w-fit items-center gap-1.5 text-[12px] font-semibold text-[#5846EA]"
        >
          <Plus size={13} /> Add curricular goal
        </button>
      </div>
    </details>
  );
}

function GoalBlock({
  goal,
  assessors,
  evidenceModes,
  onChange,
  onRemove,
}: {
  goal: HpcCurricularGoal;
  assessors: CodeLabel[];
  evidenceModes: CodeLabel[];
  onChange: (changes: Partial<HpcCurricularGoal>) => void;
  onRemove: () => void;
}) {
  return (
    <div className="rounded-[12px] border border-[#E4E9F2] bg-white p-2.5">
      <div className="flex flex-wrap items-center gap-2">
        <input
          value={goal.code}
          onChange={(event) => onChange({ code: event.target.value })}
          placeholder="CG-1"
          className={`${cellClass} w-[84px] flex-none`}
        />
        <input
          value={goal.name}
          onChange={(event) => onChange({ name: event.target.value })}
          placeholder="Curricular goal, as the NCF words it"
          className={`${cellClass} min-w-[220px] flex-1`}
        />
        <button
          type="button"
          onClick={onRemove}
          className="rounded-[8px] p-1.5 text-[#98A4B6] transition hover:bg-red-50 hover:text-[#B91C1C]"
          aria-label="Remove goal"
        >
          <Trash2 size={14} />
        </button>
      </div>

      <div className="mt-2 flex flex-col gap-2 border-l-2 border-[#EEF1F6] pl-3">
        {goal.competencies.map((competency) => (
          <CompetencyRow
            key={competency.id}
            competency={competency}
            assessors={assessors}
            evidenceModes={evidenceModes}
            onChange={(changes) =>
              onChange({
                competencies: goal.competencies.map((entry) =>
                  entry.id === competency.id ? { ...entry, ...changes } : entry
                ),
              })
            }
            onRemove={() =>
              onChange({
                competencies: goal.competencies.filter((entry) => entry.id !== competency.id),
              })
            }
          />
        ))}

        <button
          type="button"
          onClick={() =>
            onChange({
              competencies: [
                ...goal.competencies,
                {
                  id: newId('c'),
                  code: '',
                  name: '',
                  learning_outcomes: [],
                  assessors: [],
                  evidence_modes: [],
                },
              ],
            })
          }
          className="inline-flex w-fit items-center gap-1.5 text-[12px] font-semibold text-[#5846EA]"
        >
          <Plus size={13} /> Add competency
        </button>
      </div>
    </div>
  );
}

function CompetencyRow({
  competency,
  assessors,
  evidenceModes,
  onChange,
  onRemove,
}: {
  competency: HpcCompetency;
  assessors: CodeLabel[];
  evidenceModes: CodeLabel[];
  onChange: (changes: Partial<HpcCompetency>) => void;
  onRemove: () => void;
}) {
  return (
    <div className="rounded-[10px] border border-[#EEF1F6] bg-[#FAFBFE] p-2.5">
      <div className="flex flex-wrap items-center gap-2">
        <input
          value={competency.code}
          onChange={(event) => onChange({ code: event.target.value })}
          placeholder="C-1"
          className={`${cellClass} w-[72px] flex-none`}
        />
        <input
          value={competency.name}
          onChange={(event) => onChange({ name: event.target.value })}
          placeholder="Competency — what the child can be seen doing"
          className={`${cellClass} min-w-[200px] flex-1`}
        />
        <button
          type="button"
          onClick={onRemove}
          className="rounded-[8px] p-1.5 text-[#98A4B6] transition hover:bg-red-50 hover:text-[#B91C1C]"
          aria-label="Remove competency"
        >
          <Trash2 size={13} />
        </button>
      </div>

      <label className="mt-2 block">
        <span className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[#7A889D]">
          Learning outcomes
        </span>
        <textarea
          value={competency.learning_outcomes.join('\n')}
          onChange={(event) =>
            onChange({
              // One outcome per line — the cards list them as bullets, and a
              // teacher typing them wants a textarea, not a row builder.
              learning_outcomes: event.target.value
                .split('\n')
                .map((line) => line.trim())
                .filter((line) => line !== ''),
            })
          }
          rows={2}
          placeholder="One per line"
          className={`${cellClass} mt-1 h-auto py-1.5 leading-5`}
        />
      </label>

      <div className="mt-2 grid gap-2 md:grid-cols-2">
        <div>
          <p className="mb-1 text-[11px] font-semibold uppercase tracking-[0.12em] text-[#7A889D]">
            Assessed by
          </p>
          <CheckGroup
            compact
            options={assessors}
            selected={competency.assessors}
            onChange={(selected) => onChange({ assessors: selected })}
          />
        </div>
        <div>
          <p className="mb-1 text-[11px] font-semibold uppercase tracking-[0.12em] text-[#7A889D]">
            Evidence
          </p>
          <CheckGroup
            compact
            options={evidenceModes}
            selected={competency.evidence_modes}
            onChange={(selected) => onChange({ evidence_modes: selected })}
          />
        </div>
      </div>
    </div>
  );
}

function LevelRow({
  level,
  onChange,
  onRemove,
  canRemove,
}: {
  level: ProficiencyLevel;
  onChange: (changes: Partial<ProficiencyLevel>) => void;
  onRemove: () => void;
  canRemove: boolean;
}) {
  return (
    <div className="grid items-start gap-2 rounded-[12px] border border-[#E4E9F2] bg-[#FAFBFE] px-3 py-2 md:grid-cols-[170px_minmax(0,1fr)_34px]">
      <input
        value={level.label}
        onChange={(event) => onChange({ label: event.target.value })}
        placeholder="e.g. Proficient"
        className={`${cellClass} font-semibold`}
      />
      <input
        value={level.descriptor}
        onChange={(event) => onChange({ descriptor: event.target.value })}
        placeholder="What a child at this level can be seen doing"
        className={cellClass}
      />
      <button
        type="button"
        onClick={onRemove}
        disabled={!canRemove}
        className="justify-self-end rounded-[8px] p-1.5 text-[#98A4B6] transition hover:bg-red-50 hover:text-[#B91C1C] disabled:opacity-40"
        aria-label="Remove level"
      >
        <Trash2 size={14} />
      </button>
    </div>
  );
}

// -- Small pieces ------------------------------------------------------------

function CheckGroup({
  options,
  selected,
  onChange,
  compact,
}: {
  options: CodeLabel[];
  selected: string[];
  onChange: (selected: string[]) => void;
  compact?: boolean;
}) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {options.map((option) => {
        const on = selected.includes(option.code);

        return (
          <button
            key={option.code}
            type="button"
            onClick={() =>
              onChange(
                on ? selected.filter((code) => code !== option.code) : [...selected, option.code]
              )
            }
            className={`rounded-full border px-3 py-1 font-semibold transition ${
              compact ? 'text-[11.5px]' : 'text-[12.5px]'
            } ${
              on
                ? 'border-[#5846EA] bg-[#F5F4FF] text-[#5846EA]'
                : 'border-[#E4E9F2] bg-white text-[#5F7087] hover:border-[#C3CDE0]'
            }`}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}

function Panel({
  title,
  subtitle,
  tally,
  onAdd,
  addLabel,
  children,
}: {
  title: string;
  subtitle?: string;
  tally?: string;
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
            <span className="rounded-full border border-[#E4E9F2] bg-[#F8FAFC] px-2.5 py-1 text-[11.5px] font-semibold text-[#334155]">
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
      {hint ? <span className="text-[11.5px] text-[#98A4B6]">{hint}</span> : null}
    </label>
  );
}

function Select({
  value,
  onChange,
  options,
}: {
  value: string;
  onChange: (value: string) => void;
  options: CodeLabel[];
}) {
  return (
    <div className="relative">
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="h-10 w-full appearance-none rounded-[10px] border border-[#E4E9F2] bg-white pl-3 pr-8 text-[13px] text-[#172554]"
      >
        {options.map((option) => (
          <option key={option.code} value={option.code}>
            {option.label}
          </option>
        ))}
      </select>
      <ChevronDown
        size={14}
        className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-[#98A4B6]"
      />
    </div>
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return (
    <p className="rounded-[12px] border border-dashed border-[#D7DEEA] px-3.5 py-3 text-[12.5px] leading-5 text-[#7A889D]">
      {children}
    </p>
  );
}

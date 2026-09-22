// ---------------------------------------------------------------------------
// Blueprint — the shared vocabulary.
//
// A blueprint is the DESIGN of a paper: how many marks go to which chapter, how
// many questions of which type, what share is easy and what share is hard —
// settled before a single question is chosen.
//
// It is NOT the layout. `_question-paper-templates` owns that: page size,
// header, numbering, how a paper prints. The two share the word "blueprint" in
// school usage and nothing else in this codebase, which is why they are
// separate folders, separate tables and separate endpoints.
//
// These types mirror App\Domain\Exam\AssessmentBlueprint on the ERP side; that
// class is the authority and normalises anything it is handed, so a blueprint
// saved by an older build still loads here.
// ---------------------------------------------------------------------------

export type BlueprintStatus = 'Draft' | 'Active' | 'Archived';

/**
 * Blueprints come in two categories, and they are genuinely different objects
 * behind the same lifecycle:
 *
 *  - `regular` — the marks-based paper design: sections, question types, marks
 *    by chapter, difficulty split.
 *  - `hpc` — a Holistic Progress Card design. No marks at all: curricular
 *    goals, competencies and learning outcomes judged against a proficiency
 *    scale by more than one assessor.
 *
 * `Blueprint` is a discriminated union on `kind`, so narrowing on it gives the
 * right `definition` shape and the editor cannot be handed the wrong one.
 */
export type BlueprintKind = 'regular' | 'hpc';

/**
 * One line of a section's table: "n questions of this type, m marks each".
 *
 * `subparts` is its own field because "1 question with 4 sub-parts at 2 marks"
 * and "4 questions at 2 marks" are the same marks and a different paper — the
 * Delhi Class III–V Maths design turns on exactly that distinction.
 *
 * `total_marks` is what the published document PRINTS; the count × sub-parts ×
 * marks-each product is shown beside it as a check. Where a board's arithmetic
 * and ours disagree, the board's number is the one a school is accountable to.
 */
export type BlueprintRow = {
  id: string;
  question_type: string;
  label: string;
  /** e.g. "2-5" — the question numbers this row covers on the printed paper. */
  question_numbers: string;
  count: number;
  /** 0 means the question is not split into parts. */
  subparts: number;
  marks_each: number;
  total_marks: number;
  note: string;
};

export type BlueprintSection = {
  id: string;
  name: string;
  note: string;
  rows: BlueprintRow[];
};

/** Marks against a chapter or a named content area (e.g. "Biology"). */
export type ContentWeight = {
  id: string;
  name: string;
  /** Set only where a school picked a real chapter; references name areas in words. */
  chapter_id: number | null;
  marks: number;
  weight_pct: number;
  note: string;
};

/**
 * What share of marks tests which cognitive demand.
 *
 * Free-form {code, label, weight} on purpose: a school can load CBSE's own
 * bands, Bloom's levels, or a foreign standard set without any of them being
 * hardcoded — which is what lets one engine serve more than one curriculum.
 */
export type CompetencyWeight = {
  id: string;
  code: string;
  label: string;
  weight_pct: number;
};

export type DifficultySplit = {
  easy: number;
  average: number;
  difficult: number;
};

export type BlueprintDefinition = {
  version: number;
  sections: BlueprintSection[];
  content_weightage: ContentWeight[];
  competency_distribution: CompetencyWeight[];
  difficulty_distribution: DifficultySplit;
  internal_choice_pct: number;
  notes: string;
};

// -- HPC ---------------------------------------------------------------------

/** The four NCF stages an HPC is published for. */
export type HpcStage = 'Foundational' | 'Preparatory' | 'Middle' | 'Secondary';

/**
 * One level a judgement can land on.
 *
 * Stored rather than assumed because it differs by stage: the Foundational
 * card reads Beginner / Progressive / Proficient, the Middle Stage card reads
 * Beginner / Proficient / Advanced.
 */
export type ProficiencyLevel = {
  code: string;
  label: string;
  descriptor: string;
};

/** What actually gets judged. The NCF chain the card is filled against. */
export type HpcCompetency = {
  id: string;
  code: string;
  name: string;
  learning_outcomes: string[];
  /** Whose judgement is recorded for this one; defaults to the design's own. */
  assessors: string[];
  evidence_modes: string[];
};

export type HpcCurricularGoal = {
  id: string;
  code: string;
  name: string;
  competencies: HpcCompetency[];
};

/**
 * A development domain (Foundational Stage) or a curricular area (Middle Stage
 * onwards) — the same slot in the design, named differently by each card.
 */
export type HpcArea = {
  id: string;
  name: string;
  code: string;
  note: string;
  curricular_goals: HpcCurricularGoal[];
};

/** The Awareness / Sensitivity / Creativity strands the rubric scores. */
export type HpcAbility = {
  id: string;
  code: string;
  label: string;
};

export type HpcPartA = {
  attendance: boolean;
  interest: boolean;
  all_about_me: boolean;
  /** The Secondary card's structured self-assessment, in place of All About Me. */
  self_assessment: boolean;
  goal_setting: boolean;
  ambition_card: boolean;
};

export type HpcDefinition = {
  version: number;
  stage: HpcStage;
  proficiency_scale: ProficiencyLevel[];
  /** Codes from options.hpc.assessors — self / peer / teacher / parent. */
  assessors: string[];
  abilities: HpcAbility[];
  areas: HpcArea[];
  activity_approaches: string[];
  evidence_modes: string[];
  part_a: HpcPartA;
  strengths: string[];
  barriers: string[];
  notes: string;
};

// -- The row -----------------------------------------------------------------

type BlueprintBase = {
  /** null for a published reference that has not been copied into the school. */
  id: number | null;
  stage: string;
  is_preset: boolean;
  preset_key: string | null;
  /** The blueprint of ours this was copied from, when it was one of ours. */
  parent_id: number | null;
  version: number;
  name: string;
  description: string;
  academic_year: string;
  board: string;
  class_band: string;
  assessment_type: string;
  standard_id: number | null;
  standard_name: string;
  subject_id: number | null;
  subject_name: string;
  /** For a reference, which covers a band and cannot point at one school's subject row. */
  subject_label: string;
  /** Always 0 on an HPC — having no marks is the point of one. */
  total_marks: number;
  duration_minutes: number | null;
  source: string;
  source_url: string;
  status: BlueprintStatus;
  /** What the sections actually add up to, from the server. 0 on an HPC. */
  section_marks: number;
  /** Advisory only — a blueprint is partial until it is finished. */
  warnings: string[];
  updated_at: string | null;
};

export type RegularBlueprint = BlueprintBase & {
  kind: 'regular';
  definition: BlueprintDefinition;
};

export type HpcBlueprintRow = BlueprintBase & {
  kind: 'hpc';
  definition: HpcDefinition;
};

export type Blueprint = RegularBlueprint | HpcBlueprintRow;

export type CodeLabel = { code: string; label: string };
export type QuestionTypeOption = CodeLabel;

/** The published vocabularies the HPC editor offers, straight from the ERP. */
export type HpcOptions = {
  stages: HpcStage[];
  assessors: CodeLabel[];
  activity_approaches: CodeLabel[];
  evidence_modes: CodeLabel[];
  part_a_elements: CodeLabel[];
  strengths: string[];
  barriers: string[];
  defaults: HpcDefinition;
  /** Which option lists this school has taken over; drives the "customised" badge. */
  customised_types: HpcOptionType[];
};

/**
 * One option in a school's own HPC list.
 *
 * `code` is the stable machine name a blueprint stores; `label` is what the
 * school calls it. Renaming a label never orphans the blueprints that already
 * selected the code, which is why the two are separate.
 */
export type HpcSchoolOption = {
  code: string;
  label: string;
  description: string;
  /** The school added this itself, rather than keeping a published option. */
  is_custom: boolean;
  /** Coming from the published NCERT list because the school has not overridden this type. */
  is_default: boolean;
};

/** The four lists a school can take over. Stages are national and stay fixed. */
export type HpcOptionType =
  | 'assessor'
  | 'activity_approach'
  | 'evidence_mode'
  | 'part_a_element';

export type HpcSchoolOptions = {
  options: Record<HpcOptionType, HpcSchoolOption[]>;
  /** The published list each type would revert to. */
  defaults: Record<HpcOptionType, CodeLabel[]>;
  /** Which types this school has taken over from the published list. */
  customised_types: HpcOptionType[];
  types: HpcOptionType[];
};

export type BlueprintOptions = {
  question_types: QuestionTypeOption[];
  assessment_types: string[];
  boards: string[];
  statuses: BlueprintStatus[];
  defaults: BlueprintDefinition;
  hpc: HpcOptions;
};

export type BlueprintIndex = {
  blueprints: Blueprint[];
  presets: Blueprint[];
  options: BlueprintOptions;
};

export type ChapterOption = {
  id: number;
  name: string;
  periods: number | null;
};

type DraftBase = {
  id: number | null;
  stage: string;
  name: string;
  description: string;
  academic_year: string;
  board: string;
  class_band: string;
  assessment_type: string;
  standard_id: number | null;
  subject_id: number | null;
  subject_label: string;
  total_marks: number;
  duration_minutes: number | null;
  status: BlueprintStatus;
  source: string;
  source_url: string;
  preset_key: string | null;
  parent_id: number | null;
};

/**
 * The editable half of a blueprint, as sent on save.
 *
 * Split on `kind` the same way the row is, so the marks-based editor can never
 * be handed an HPC definition or the other way round.
 */
export type RegularDraft = DraftBase & { kind: 'regular'; definition: BlueprintDefinition };
export type HpcDraft = DraftBase & { kind: 'hpc'; definition: HpcDefinition };
export type BlueprintDraft = RegularDraft | HpcDraft;

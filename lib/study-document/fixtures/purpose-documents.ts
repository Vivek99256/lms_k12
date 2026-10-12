/**
 * Two small study documents in the "purpose" design, written to the frozen schema (a revision notes document with topic,
 * glossary and check parts; a remedial class with diagnostic, gaps, units, clinic, independent, exit and teacher parts).
 *
 * They are what the API sends, before `parseDocument` has filled anything in. Each call returns a fresh object (parsing changes
 * it, and a test may break one on purpose). They are typed, so a drift from the interfaces in types.ts fails the type check.
 *
 * The chapter is the same one as study-documents-golden.json: two topics (10 Models, 11 Laws and theories) of two concepts each.
 */

import type { DeckActivity } from '../../study-deck/types';
import type {
  CheckPart,
  ClinicPart,
  DiagnosticPart,
  ExitPart,
  GapsPart,
  GlossaryPart,
  IndependentPart,
  RemedialDocument,
  RemedialOverviewPart,
  RemedialUnitPart,
  RevisionNotesDocument,
  RevisionOverviewPart,
  RevisionTopicPart,
  TeacherPart,
} from '../types';

const chapter = { id: 1, name: 'Ideas in exploration', standard_id: 9, subject_id: 2, standard_name: '9', subject_name: 'Science' };

const concept = (id: number, name: string, topicId: number) => ({ id, name, topic_id: topicId, requires: [], related: [], definition: null });

const concepts = {
  '1': concept(1, 'Models', 10),
  '2': concept(2, 'Ignoring details', 10),
  '3': concept(3, 'Laws', 11),
  '4': concept(4, 'Theories', 11),
};

const outline = [
  { topic_id: 10, name: 'Models', concept_ids: [1, 2] },
  { topic_id: 11, name: 'Laws and theories', concept_ids: [3, 4] },
];

const purpose = { min_pages: 5, max_pages: 15, pages: { revision: 6, practice: 7 } };

/** A bank question, asked about a concept. */
function ask(questionId: number, conceptId: number): DeckActivity {
  return {
    source: 'bank',
    question_id: questionId,
    concept_id: conceptId,
    as: 'single_choice_set',
    default_as: 'single_choice_set',
    pattern: null,
    decision: false,
    connects_concept: null,
    label: 'Check',
    bloom: 'apply',
    difficulty: 'medium',
    dok: 2,
    why: "the question's own form",
  };
}

/** The keys every part has, fresh for each part; a part spreads this and says what is different. */
const base = () => ({ block: 'explain', topic_id: null, concept_ids: [] as number[], taught_concept_ids: [] as number[], image: null, interaction: null, question_ids: [] as number[], activities: [] as DeckActivity[] });

export function purposeRevisionDocument(): RevisionNotesDocument {
  const overview: RevisionOverviewPart = {
    ...base(),
    n: 0,
    type: 'overview',
    block: 'intro',
    title: 'Ideas in exploration',
    content: {
      summary: 'Models simplify a real system. Laws describe patterns and theories explain them.',
      topics: [
        { topic_id: 10, name: 'Models', gist: 'A model keeps what matters.' },
        { topic_id: 11, name: 'Laws and theories', gist: 'A law says what; a theory says why.' },
      ],
    },
  };

  const models: RevisionTopicPart = {
    ...base(),
    n: 1,
    type: 'topic',
    title: 'Models',
    topic_id: 10,
    concept_ids: [1, 2],
    taught_concept_ids: [1, 2],
    content: {
      big_idea: 'A model is a simplified picture of something real.',
      rows: [
        { concept_id: 1, name: 'Models', essential: 'A model is a simplified representation.', terms: ['model'] },
        { concept_id: 2, name: 'Ignoring details', essential: 'A model leaves some details out on purpose.', terms: [] },
      ],
      compare: { title: 'Model and real system', columns: ['', 'Model', 'Real system'], rows: [['Detail', 'Some', 'All']] },
      mixups: [{ wrong_idea: 'A model is an exact copy.', correct: 'A model keeps only what is needed.' }],
      recall: ['A model is simpler than the real thing.'],
      checklist: ['I can say what a model is.', 'I can say why a model leaves details out.'],
      minutes: 4,
    },
  };

  const laws: RevisionTopicPart = {
    ...base(),
    n: 2,
    type: 'topic',
    title: 'Laws and theories',
    topic_id: 11,
    concept_ids: [3, 4],
    taught_concept_ids: [3, 4],
    content: {
      big_idea: 'A law describes a pattern. A theory explains it.',
      rows: [
        { concept_id: 3, name: 'Laws', essential: 'A law describes a repeated pattern.', terms: ['law'] },
        { concept_id: 4, name: 'Theories', essential: 'A theory explains why a pattern occurs.', terms: ['theory'] },
      ],
      compare: null,
      mixups: [],
      recall: [],
      checklist: ['I can tell a law from a theory.'],
      minutes: 4,
    },
  };

  const glossary: GlossaryPart = {
    ...base(),
    n: 3,
    type: 'glossary',
    title: 'Key terms',
    content: {
      terms: [
        { term: 'Law', meaning: 'A statement of a repeated pattern.', concept_id: 3, topic_id: 11 },
        { term: 'Model', meaning: 'A simplified representation of a real system.', concept_id: 1, topic_id: 10 },
        { term: 'Theory', meaning: 'An explanation of why a pattern occurs.', concept_id: 4, topic_id: 11 },
      ],
    },
  };

  const check: CheckPart = {
    ...base(),
    n: 4,
    type: 'check',
    title: 'Test yourself',
    concept_ids: [1, 3],
    content: { intro: 'Answer these without looking back.', note: 'Each answer is explained after you choose.' },
    question_ids: [101, 103],
    activities: [ask(103, 3), ask(101, 1)],
  };

  const doc: RevisionNotesDocument = {
    version: 1,
    kind: 'revision_notes',
    category: 'Revision Notes',
    profile: 'purpose',
    purpose,
    chapter,
    chapter_id: 1,
    title: 'Ideas in exploration',
    lede: 'Revise models, laws and theories.',
    scope: { all: true, concept_ids: [1, 2, 3, 4] },
    section_count: 5,
    outline,
    concepts,
    sections: [overview, models, laws, glossary, check],
    taught_by: { '1': [1], '2': [1], '3': [2], '4': [2] },
    concept_questions: { '1': [101], '3': [103] },
    stats: { topics: 2 },
  };

  return structuredClone(doc);
}

export function purposeRemedialDocument(): RemedialDocument {
  const overview: RemedialOverviewPart = {
    ...base(),
    n: 0,
    type: 'overview',
    block: 'intro',
    title: 'Ideas in exploration',
    content: {
      method: [{ label: 'Find the gap', text: 'Start with the quick check.' }],
      focus: [{ concept_id: 2, name: 'Ignoring details', difficulty: null }],
      objectives: [{ topic_id: 10, name: 'Models', text: 'I can say why a model leaves details out.' }],
      pathway: [
        { n: 1, type: 'diagnostic', title: 'Where to start' },
        { n: 3, type: 'unit', title: 'Ignoring details' },
      ],
    },
  };

  const diagnostic: DiagnosticPart = {
    ...base(),
    n: 1,
    type: 'diagnostic',
    title: 'Where to start',
    concept_ids: [2, 4],
    content: {
      intro: 'Answer these to see where to start.',
      scoring: 'If you miss a question, take the unit named beside it.',
      items: [
        { question_id: 201, concept_id: 2, topic_id: 10, if_missed: [{ n: 3, title: 'Ignoring details' }] },
        { question_id: 202, concept_id: 4, topic_id: 11, if_missed: [] },
      ],
    },
    question_ids: [201, 202],
    activities: [ask(201, 2), ask(202, 4)],
  };

  const gaps: GapsPart = {
    ...base(),
    n: 2,
    type: 'gaps',
    title: 'Where it may be hard',
    concept_ids: [1, 2, 3, 4],
    content: {
      note: 'These are possible difficulties worked out from the chapter, not results from a class.',
      rows: [
        { concept_id: 2, name: 'Ignoring details', topic_id: 10, priority: 'higher', reasons: ['It sounds like a mistake.'], check_first: ['Models'], covered_in: 'Unit 3' },
        { concept_id: 4, name: 'Theories', topic_id: 11, priority: 'medium', reasons: ['It is easy to mix up with a law.'], check_first: [], covered_in: 'Unit 4' },
      ],
      others: ['Models', 'Laws'],
    },
  };

  const unit = (n: number, conceptId: number, name: string, topicId: number, guided: RemedialUnitPart['content']['guided'], activities: DeckActivity[]): RemedialUnitPart => ({
    ...base(),
    n,
    type: 'unit',
    title: name,
    topic_id: topicId,
    concept_ids: [conceptId],
    taught_concept_ids: [conceptId],
    content: {
      prerequisites: [],
      simple_explanation: `${name} in plain words.`,
      steps: [{ id: 'i1', label: 'Start', text: 'Begin with the idea.' }],
      real_life: null,
      worked_example: null,
      mistakes: [],
      guided,
      follow_up: [],
      win: `You can now explain ${name.toLowerCase()}.`,
      bloom: 'understand',
      dok: 2,
      minutes: 6,
    },
    question_ids: activities.map((a) => a.question_id as number),
    activities,
  });

  const detail = unit(3, 2, 'Ignoring details', 10, [{ level: 1, label: 'With a hint', question_id: 211, hint: 'Think about what a model keeps.', not_options: {} }, { level: 2, label: 'With a little help', question_id: 212, hint: '', not_options: {} }], [ask(211, 2), ask(212, 2)]);
  const theories = unit(4, 4, 'Theories', 11, [{ level: 1, label: 'With a hint', question_id: 213, hint: 'A theory explains.', not_options: {} }], [ask(213, 4)]);

  const clinic: ClinicPart = {
    ...base(),
    n: 5,
    type: 'clinic',
    title: 'Common mix-ups',
    concept_ids: [2, 4],
    content: {
      intro: 'Decide whether each idea is right.',
      items: [
        { concept_id: 2, wrong_idea: 'A model that leaves things out is wrong.', why_it_seems_true: 'Leaving things out sounds careless.', correction: 'It is done on purpose, to keep the useful parts.', check_it: 'Name one thing a map leaves out.', unit: 3 },
        { concept_id: 4, wrong_idea: 'A theory is a guess.', why_it_seems_true: 'People say "just a theory".', correction: 'A theory is a tested explanation.', check_it: 'Name one thing a theory explains.', unit: null },
      ],
    },
  };

  const independent: IndependentPart = {
    ...base(),
    n: 6,
    type: 'independent',
    title: 'On your own',
    concept_ids: [2],
    content: { intro: 'Try these without hints.' },
    question_ids: [221],
    activities: [ask(221, 2)],
  };

  const exit: ExitPart = {
    ...base(),
    n: 7,
    type: 'exit',
    title: 'Exit check',
    concept_ids: [2, 4],
    content: {
      intro: 'Show what you can do now.',
      criteria: [{ text: 'I can say why a model leaves details out.' }],
      ready_at: 1,
      total: 2,
      revisit: [{ concept_id: 2, name: 'Ignoring details', n: 3 }],
    },
    question_ids: [231, 232],
    activities: [ask(231, 2), ask(232, 4)],
  };

  const teacher: TeacherPart = {
    ...base(),
    n: 8,
    type: 'teacher',
    title: 'Teacher guide',
    content: {
      purpose: 'Run this as a short class for learners who need another go.',
      how_to_run: ['Give the quick check.', 'Send each learner to the unit named beside a missed question.'],
      pacing: [{ n: 3, title: 'Ignoring details', minutes: 6 }],
      total_minutes: 6,
      interventions: [{ concept_id: 2, name: 'Ignoring details', n: 3, look_for: 'Saying a model is wrong.', try_this: 'Show a map.', if_still_stuck: 'Use a second example.' }],
    },
  };

  const doc: RemedialDocument = {
    version: 1,
    kind: 'remedial',
    category: 'Remedial Class',
    profile: 'purpose',
    purpose,
    chapter,
    chapter_id: 1,
    title: 'Ideas in exploration',
    lede: 'Another go at the ideas that are hardest.',
    scope: { all: true, concept_ids: [1, 2, 3, 4] },
    section_count: 9,
    outline,
    concepts,
    sections: [overview, diagnostic, gaps, detail, theories, clinic, independent, exit, teacher],
    taught_by: { '2': [3], '4': [4] },
    concept_questions: { '2': [201, 211, 212, 221, 231], '4': [202, 213, 232] },
    stats: { units: 2 },
  };

  return structuredClone(doc);
}

/**
 * Plain-English explanations for everything shown in Concept Intelligence.
 *
 * The panel is generated from the extraction pipeline's schema
 * (`backend/app/semantic_intelligence/schemas.py`), which speaks in assessment
 * jargon — DOK, Bloom's, coverage score, necessity, quality band. A teacher
 * opening the panel for the first time should not have to already know that
 * vocabulary.
 *
 * Rules for writing anything in this file:
 *   - Short sentences. One idea each.
 *   - Everyday words. "Very important", not "central to the chapter".
 *   - Say what to DO, not just what it is.
 *   - Give an example whenever the idea is abstract. Knowledge vs Abilities vs
 *     Skills vs Competencies is the thing people get stuck on, so those four
 *     carry examples from one single concept (boiling water) that build on each
 *     other — the contrast is what teaches the difference.
 *   - No emoji. Sentence case.
 */

export interface TabGuide {
  /** What the tab holds. One short sentence. */
  what: string;
  /** What to do with it. */
  use: string;
  /** A concrete example, for the tabs whose idea is abstract. */
  example?: string;
}

/** Keyed by the tab ids in ConceptIntelligenceTabs. */
export const TAB_GUIDE: Record<string, TabGuide> = {
  overview: {
    what: 'A short summary of this concept.',
    use: 'Start here. It tells you how hard the concept is and how important it is.',
  },
  knowledge: {
    what: 'What students must KNOW. The facts, meanings and rules.',
    use: 'Teach these first.',
    example: 'Water boils at 100°C.',
  },
  abilities: {
    what: 'What students must be able to DO with those facts.',
    use: 'Turn each one into a classroom task.',
    example: 'Measure the boiling point of water.',
  },
  skills: {
    what: 'Things students can do well on their own, after enough practice.',
    use: 'Give practice again and again until it becomes easy for them.',
    example: 'Using a thermometer correctly every time.',
  },
  competencies: {
    what: 'Using knowledge, abilities and skills together to handle a real situation.',
    use: 'This is what you finally judge the student on.',
    example: 'Plan an experiment, run it, and explain the result.',
  },
  blooms: {
    what: 'How much thinking this concept needs — from just remembering, up to creating something new.',
    use: 'If it is mostly "Remember", add some harder questions to your test.',
  },
  dok: {
    what: 'How deep the thinking goes. The scale runs from 1 to 4.',
    use: 'Set questions at the levels shown here.',
    example: 'Level 1 is recalling a fact. Level 4 is a long project.',
  },
  prerequisites: {
    what: 'What students must learn BEFORE this concept.',
    use: 'If the class looks confused, go back and revise these.',
  },
  misconceptions: {
    what: 'Common mistakes students make, why they make them, and how to fix them.',
    use: 'Clear these up in class, before the exam.',
  },
  realworld: {
    what: 'Where this concept is used in real life.',
    use: 'Start your lesson with one of these. It answers "why are we learning this?"',
  },
  pedagogy: {
    what: 'The best ways to teach this concept, and why they work.',
    use: 'Pick one when you plan your lesson.',
  },
  objectives: {
    what: 'What YOU plan to teach.',
    use: 'Write these into your lesson plan.',
  },
  outcomes: {
    what: 'What the STUDENT can do after your lesson.',
    use: 'Use these to check whether the lesson worked.',
  },
  blueprint: {
    what: 'A plan for your test — which questions to ask, how hard, and how many marks.',
    use: 'Follow it when you make a question paper.',
  },
  rubrics: {
    what: 'Ready-made questions, with answers and marking rules.',
    use: 'Use it so every student is marked the same way.',
  },
  relationships: {
    what: 'How this concept is linked to other concepts.',
    use: 'Use it to decide what to teach next.',
  },
  evidence: {
    what: 'The exact lines from the book that this analysis came from.',
    use: 'Check here if you want to confirm anything on the other tabs.',
  },
  reasoning: {
    what: 'The AI explaining how it worked all of this out.',
    use: 'Read it to decide how much to trust the analysis.',
  },
};

/**
 * One-line explanations for individual fields.
 *
 * Keys are `<area>.<field>` so the same field name can be explained differently
 * where it means different things (a concept's difficulty is about students; an
 * exam item's difficulty is about the question).
 */
export const FIELD_GUIDE: Record<string, string> = {
  // Overview
  'concept.name': 'The concept being explained here. Every tab describes this one concept.',
  'concept.type': 'What kind of concept it is — a definition, a formula, a process, and so on.',
  'concept.definition': 'The meaning, in simple words.',
  'concept.difficulty': 'How hard students of this class usually find it.',
  'concept.importance': 'How important this concept is in the chapter.',
  'concept.confidence': 'How sure the AI is. If it is below 70%, please check the textbook.',

  // Knowledge
  'knowledge.type': 'What kind of fact this is.',
  'knowledge.confidence': 'How sure the AI is that this belongs to the concept.',

  // Abilities, skills, competencies
  'ability.verb': 'The action word. "List" is easy. "Evaluate" is much harder.',
  'ability.knowledgeRefs': 'The facts from the Knowledge tab a student needs before doing this.',
  'skill.abilityRefs': 'The items from the Abilities tab that build up this skill.',
  'competency.statement': 'Written as "I can…", the way you would explain it to a parent.',
  'competency.refs': 'The knowledge, abilities and skills that come together here.',

  // Bloom's and DOK
  'bloom.level': 'One of the six thinking levels, from easy to hard.',
  'bloom.coverage': 'How much of this concept sits at this level. All the levels together make 100%.',
  'dok.level': 'How deep the thinking is. 1 is the easiest, 4 is the deepest.',

  // Prerequisites
  'prerequisite.type': 'Is it a fact, an action, a skill, or a whole concept?',
  'prerequisite.necessity': 'How badly students need it before you start this concept.',

  // Misconceptions
  'misconception.rootCause': 'Why students think this. Fixing the reason works better than just correcting the answer.',
  'misconception.correction': 'What to say or show in class to put it right.',

  // Real world
  'realworld.type': 'Which part of life this example comes from.',
  'realworld.relevance': 'How closely the example matches the concept.',

  // Pedagogy
  'pedagogy.why': 'Why this way of teaching works for this concept.',
  'pedagogy.characteristics': 'What it is about this concept that makes the method suit it.',

  // Objectives and outcomes
  'objective.type': 'Does it aim at a fact, an action, a skill, or a competency?',
  'objective.priority': 'Teach the high ones first if you are short of time.',
  'outcome.type': 'Does it show a fact, an action, a skill, or a competency?',
  'outcome.measurable': 'You can check whether the student has reached it.',
  'outcome.assessmentReady': 'You can use it as an exam question just as it is written.',

  // Assessment
  'assessment.type': 'The question type — MCQ, short answer, case study, and so on.',
  'assessment.marks': 'Marks for this question.',
  'assessment.bloom': 'How much thinking the question asks for.',
  'assessment.dok': 'How deep the question goes. 1 is the easiest, 4 is the deepest.',
  'assessment.difficulty': 'How hard this question will be for the class.',
  'assessment.objectives': 'The syllabus objective codes this question checks.',

  // Rubrics
  'rubric.teachingNotes': 'Help for teaching these questions, and for marking them.',
  'rubric.answerKey': 'Every option, with the reason it is right or wrong.',
  'rubric.rationale': 'Why this option is right — or why students wrongly pick it.',
  'rubric.misconceptionTested': 'If a student picks this, they probably believe this wrong idea.',
  'rubric.acceptablePoints': 'Points that get marks. The order and the wording can be different.',
  'rubric.alternatives': 'Other ways of saying the same thing. Give the same marks.',
  'rubric.indicativeContent': 'What a good answer should include. It is not a strict checklist.',
  'rubric.levelDescriptors': 'What an answer looks like at each mark level, so marking stays fair.',
  'rubric.thresholdConditions': 'The answer must meet these before it can get that level.',
  'rubric.commonErrors': 'Mistakes you will see while marking.',

  // Relationships, evidence, reasoning
  'relationship.type': 'How the two concepts are connected.',
  'evidence.sourceType': 'Where this line came from.',
  'reasoning.section': 'The AI’s own notes, written before it produced this part.',
};

/** Explanations for enumerated values, so the value itself teaches its meaning. */
export const VALUE_GUIDE: Record<string, Record<string, string>> = {
  difficulty: {
    easy: 'Most students understand it quickly.',
    medium: 'Most students need examples and some practice.',
    hard: 'Expect to teach it again. Keep extra time for it.',
  },
  importance: {
    core: 'Very important. Do not skip it.',
    important: 'Needed to understand the chapter fully.',
    supporting: 'Helps explain the main ideas.',
    optional: 'Extra. You can skip it if time is short.',
  },
  necessity: {
    mandatory: 'Must be taught before this concept.',
    recommended: 'Revise it quickly first. It helps a lot.',
    helpful: 'Good to know, but not needed.',
  },
  bloom: {
    remember: 'Recall facts.',
    understand: 'Explain it in their own words.',
    apply: 'Use it in a new question.',
    analyze: 'Break it into parts and see how they connect.',
    analyse: 'Break it into parts and see how they connect.',
    evaluate: 'Judge it and give reasons.',
    create: 'Make something new with it.',
  },
  dok: {
    '1': 'Remember a fact, or follow steps you have shown them.',
    '2': 'Use what they learnt in a familiar question that takes a few steps.',
    '3': 'Think it through and give reasons. There is no one fixed method.',
    '4': 'A long task or project that joins several ideas together.',
  },
  relevance: {
    high: 'A clear, everyday example.',
    medium: 'A good link, but you will need to explain it.',
    low: 'A weak link. Just mention it in passing.',
  },
  priority: {
    high: 'Teach this first.',
    medium: 'Teach it after the high ones.',
    low: 'Teach it if time is left.',
  },
  relation: {
    depends_on: 'needs this first',
    part_of: 'is a part of',
    causes: 'leads to',
    uses: 'makes use of',
    extends: 'builds further on',
    related_to: 'is connected to',
  },
  sourceType: {
    curriculum: 'Taken from the syllabus.',
    textbook: 'Taken from the textbook.',
    both: 'Found in both the syllabus and the textbook.',
    inferred: 'The AI worked this out. It is not written anywhere. Please check it.',
  },
  reasoning: {
    cognitive: 'These notes produced the Knowledge, Abilities, Skills and Competencies tabs.',
    pedagogy: 'These notes produced the Pedagogy and Misconceptions tabs.',
    assessment: 'These notes produced the Blueprint tab.',
    rubrics: 'These notes produced the Rubrics tab.',
  },
};

/**
 * Headings for the AI reasoning sections.
 *
 * The raw keys are the pipeline's internal agent names — "cognitive",
 * "rubrics" — which mean nothing to a teacher and render lowercase.
 */
export const REASONING_TITLES: Record<string, string> = {
  cognitive: 'How it decided what students must know and do',
  pedagogy: 'How it chose the teaching methods',
  assessment: 'How it planned the questions',
  rubrics: 'How it made the marking rules',
};

/** "1 mark", "2 marks" — the plural was wrong on every one-mark question. */
export function marksLabel(raw: string): string {
  const value = Number(raw);
  if (!Number.isFinite(value)) return `${raw} marks`;
  return `${raw} ${Math.abs(value) === 1 ? 'mark' : 'marks'}`;
}

/** Look up a value explanation without worrying about case or spacing. */
export function explainValue(group: keyof typeof VALUE_GUIDE | string, value: string): string {
  const table = VALUE_GUIDE[group];
  if (!table) return '';
  return table[value.trim().toLowerCase().replace(/\s+/g, '_')] ?? table[value.trim().toLowerCase()] ?? '';
}

/**
 * Turn a confidence score into a percentage plus a word.
 *
 * The pipeline writes confidence as a 0–1 float, but the same field has been
 * seen already multiplied out, so anything above 1 is read as a percentage
 * rather than rendered as 9500%.
 */
export function describeConfidence(raw: string): { percent: string; band: string; tone: 'high' | 'medium' | 'low' } | null {
  const value = Number(raw);
  if (!Number.isFinite(value)) return null;

  const fraction = value > 1 ? value / 100 : value;
  const percent = `${Math.round(fraction * 100)}%`;

  if (fraction >= 0.85) return { percent, band: 'the AI is very sure', tone: 'high' };
  if (fraction >= 0.6) return { percent, band: 'the AI is fairly sure', tone: 'medium' };
  return { percent, band: 'the AI is not sure — please check', tone: 'low' };
}

/**
 * Bloom's coverage arrives either as a 0–1 fraction (the agent normalises the
 * scores to sum to 1) or as a percentage summing to 100, depending on which
 * pipeline version wrote the row. Reading both keeps old chapters correct.
 */
export function toCoveragePercent(raw: unknown): number | null {
  const value = Number(raw);
  if (!Number.isFinite(value)) return null;
  return Math.round(value > 1 ? value : value * 100);
}

/** "Recall and Reproduction" -> the plain sentence for DOK level 1. */
export function explainDokLevel(level: string): string {
  return explainValue('dok', level);
}

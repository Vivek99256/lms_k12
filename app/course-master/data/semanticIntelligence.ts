import { courses } from './courses';
import { getChaptersByCourseid } from './chapters';
import { getChapterKeyConcepts, type KeyConcept } from './chapterKeyConcepts';

export interface SemanticCard {
  title: string;
  description: string;
  category: string;
  confidence: string;
}

export interface SemanticSection {
  id: string;
  title: string;
  description: string;
  cards: SemanticCard[];
}

export interface SemanticIntelligenceContent {
  courseTitle: string;
  courseCode: string;
  chapterTitle: string;
  chapterSummary: string;
  concept: KeyConcept;
  conceptIndex: number;
  totalConcepts: number;
  sections: SemanticSection[];
}

function getChapterConceptContext(concepts: KeyConcept[], selectedIndex: number) {
  const previous = concepts.slice(Math.max(0, selectedIndex - 2), selectedIndex);
  const next = concepts.slice(selectedIndex + 1, selectedIndex + 3);
  return { previous, next };
}

function confidenceLabel(index: number, base: number) {
  const confidence = Math.max(72, Math.min(98, base - index * 2));
  return `${confidence}%`;
}

function buildSection(
  id: string,
  title: string,
  description: string,
  cards: SemanticCard[]
): SemanticSection {
  return { id, title, description, cards };
}

function buildCards(
  items: Array<{ title: string; description: string; category: string; confidence: string }>
) {
  return items;
}

function createFallbackContext(
  chapterTitle: string,
  conceptTitle: string,
  conceptDescription: string,
  methodologies: string[]
) {
  return {
    summary: conceptDescription,
    application: `${conceptTitle} helps learners interpret ${chapterTitle.toLowerCase()} with confidence and classroom clarity.`,
    skill: `Learners practise reading cues, making connections, and explaining ${conceptTitle.toLowerCase()} using evidence from the chapter.`,
    competency: `Supports chapter-level understanding, response quality, and transfer of learning in ${chapterTitle}.`,
    misconceptions: [
      `Students may think ${conceptTitle.toLowerCase()} is only a memorisation task instead of an applied concept.`,
      `Learners may overlook how ${conceptTitle.toLowerCase()} connects to the wider ideas in ${chapterTitle}.`,
      `A common gap is confusing the observable evidence with the underlying principle.`,
    ],
    pedagogy: methodologies.slice(0, 4).map((method) => ({
      title: method,
      description: `${method} can be used to surface, discuss, and apply ${conceptTitle.toLowerCase()} in class.`,
    })),
  };
}

export function getSemanticIntelligenceForSelection(
  courseId: string,
  chapterId: string,
  conceptTitle: string
): SemanticIntelligenceContent | null {
  const course = courses.find((item) => item.id === courseId);
  const chapter = getChaptersByCourseid(courseId).find((item) => item.id === chapterId);
  const chapterConcepts = getChapterKeyConcepts(courseId, chapterId);

  if (!course || !chapter || !chapterConcepts) {
    return null;
  }

  const selectedIndex = chapterConcepts.concepts.findIndex((concept) => concept.title === conceptTitle);
  const concept = chapterConcepts.concepts[selectedIndex >= 0 ? selectedIndex : 0];
  if (!concept) {
    return null;
  }

  const conceptIndex = selectedIndex >= 0 ? selectedIndex : 0;
  const { previous, next } = getChapterConceptContext(chapterConcepts.concepts, conceptIndex);
  const context = createFallbackContext(
    chapter.title,
    concept.title,
    concept.description,
    chapter.teachingMethodologies
  );

  const knowledgeCards = buildCards([
    {
      title: 'Concept Overview',
      description: context.summary,
      category: 'Knowledge',
      confidence: confidenceLabel(conceptIndex, 96),
    },
    {
      title: 'Key Idea',
      description: `This concept anchors understanding of ${chapter.title.toLowerCase()} and acts as a checkpoint for learning progression.`,
      category: 'Knowledge',
      confidence: confidenceLabel(conceptIndex + 1, 92),
    },
    {
      title: 'Chapter Link',
      description: previous.length
        ? `${concept.title} builds on ${previous.map((item) => item.title).join(' and ')} and prepares learners for ${next.map((item) => item.title).join(' and ') || 'the next concept'}.`
        : `${concept.title} introduces the foundational understanding needed for the rest of ${chapter.title}.`,
      category: 'Knowledge',
      confidence: confidenceLabel(conceptIndex + 2, 88),
    },
  ]);

  const abilityCards = buildCards([
    {
      title: 'Explain',
      description: `Learners can explain ${concept.title.toLowerCase()} in their own words using the chapter description as evidence.`,
      category: 'Ability',
      confidence: confidenceLabel(conceptIndex, 91),
    },
    {
      title: 'Identify',
      description: `Learners can identify real examples of ${concept.title.toLowerCase()} in textbook, classroom, and daily-life contexts.`,
      category: 'Ability',
      confidence: confidenceLabel(conceptIndex + 1, 89),
    },
    {
      title: 'Differentiate',
      description: `Learners can differentiate ${concept.title.toLowerCase()} from related ideas in the same chapter.`,
      category: 'Ability',
      confidence: confidenceLabel(conceptIndex + 2, 87),
    },
  ]);

  const skillCards = buildCards([
    {
      title: 'Observe and Infer',
      description: `Use observation prompts to infer how ${concept.title.toLowerCase()} appears in examples and situations.`,
      category: 'Skill',
      confidence: confidenceLabel(conceptIndex, 90),
    },
    {
      title: 'Apply in Context',
      description: `Apply the concept in practice tasks, discussion responses, and quick classroom checks.`,
      category: 'Skill',
      confidence: confidenceLabel(conceptIndex + 1, 88),
    },
    {
      title: 'Communicate Clearly',
      description: `Describe the concept using precise vocabulary, short evidence statements, and structured reasoning.`,
      category: 'Skill',
      confidence: confidenceLabel(conceptIndex + 2, 86),
    },
  ]);

  const competencyCards = buildCards([
    {
      title: 'Concept Mastery',
      description: `Demonstrates strong conceptual understanding of ${concept.title.toLowerCase()} within ${chapter.title}.`,
      category: 'Competency',
      confidence: confidenceLabel(conceptIndex, 92),
    },
    {
      title: 'Assessment Readiness',
      description: `Supports short-answer and evidence-based classroom assessment tasks with confidence.`,
      category: 'Competency',
      confidence: confidenceLabel(conceptIndex + 1, 89),
    },
    {
      title: 'Transfer of Learning',
      description: `Helps learners transfer the idea to new examples, higher-order questions, and revision tasks.`,
      category: 'Competency',
      confidence: confidenceLabel(conceptIndex + 2, 88),
    },
  ]);

  const bloomCards = ['Remember', 'Understand', 'Apply', 'Analyse', 'Evaluate', 'Create'].map((level, index) => ({
    title: level,
    description:
      level === 'Remember'
        ? `Recall the definition and key facts connected to ${concept.title.toLowerCase()}.`
        : level === 'Understand'
          ? `Summarise the meaning of ${concept.title.toLowerCase()} and explain it in simple language.`
          : level === 'Apply'
            ? `Use the concept in examples, worksheets, and classroom discussion.`
            : level === 'Analyse'
              ? `Break the idea into parts and compare it with related concepts in the chapter.`
              : level === 'Evaluate'
                ? `Judge the accuracy of examples and decide when the concept has been demonstrated correctly.`
                : `Use what has been learned to build a response, model, or explanation.`,
    category: 'Bloom\'s Taxonomy',
    confidence: confidenceLabel(index, 93),
  }));

  const dokCards = [
    {
      title: 'DOK 1 - Recall',
      description: `Identify the term, facts, and basic indicators for ${concept.title.toLowerCase()}.`,
      category: 'DOK',
      confidence: confidenceLabel(0, 94),
    },
    {
      title: 'DOK 2 - Skill/Concept',
      description: `Compare examples and explain how the idea works inside ${chapter.title}.`,
      category: 'DOK',
      confidence: confidenceLabel(1, 91),
    },
    {
      title: 'DOK 3 - Strategic Thinking',
      description: `Reason through classroom cases and justify why the concept applies.`,
      category: 'DOK',
      confidence: confidenceLabel(2, 88),
    },
    {
      title: 'DOK 4 - Extended Thinking',
      description: `Connect the concept to multi-step tasks, extended responses, and synthesis activities.`,
      category: 'DOK',
      confidence: confidenceLabel(3, 84),
    },
  ];

  const prerequisiteCards = previous.length
    ? previous.map((item, index) => ({
        title: item.title,
        description: item.description,
        category: 'Prerequisite',
        confidence: confidenceLabel(index, 87),
      }))
    : [
        {
          title: 'Chapter Foundation',
          description: `A general understanding of ${chapter.title} helps learners approach ${concept.title.toLowerCase()} successfully.`,
          category: 'Prerequisite',
          confidence: '86%',
        },
      ];

  const misconceptionsCards = context.misconceptions.map((item, index) => ({
    title: `Misconception ${index + 1}`,
    description: item,
    category: 'Misconception',
    confidence: confidenceLabel(index, 82),
  }));

  const realWorldCards = [
    {
      title: 'Classroom Use',
      description: `Teachers can anchor discussion, quick checks, and exit tickets around ${concept.title.toLowerCase()}.`,
      category: 'Real World',
      confidence: confidenceLabel(0, 90),
    },
    {
      title: 'Daily Life',
      description: `The idea helps learners notice and interpret similar patterns in everyday situations.`,
      category: 'Real World',
      confidence: confidenceLabel(1, 88),
    },
    {
      title: 'Future Learning',
      description: `It supports future chapter study, revision, and performance in related subjects.`,
      category: 'Real World',
      confidence: confidenceLabel(2, 86),
    },
  ];

  const pedagogyCards = chapter.teachingMethodologies.slice(0, 6).map((method, index) => ({
    title: method,
    description: `${method} can be used to make ${concept.title.toLowerCase()} visible through discussion, examples, and practice.`,
    category: 'Pedagogy',
    confidence: confidenceLabel(index, 89),
  }));

  const sections = [
    buildSection('knowledge', 'Knowledge', 'Understand the idea and how it is structured in the chapter.', knowledgeCards),
    buildSection('ability', 'Ability', 'What learners can explain, identify, and compare after studying this concept.', abilityCards),
    buildSection('skill', 'Skill', 'Practical thinking and communication behaviours built through the concept.', skillCards),
    buildSection('competency', 'Competency', 'Observable performance outcomes for classwork and assessment.', competencyCards),
    buildSection("bloom", "Bloom's Taxonomy", 'Progressive cognitive actions aligned to the concept.', bloomCards),
    buildSection('dok', 'DOK', 'Depth of Knowledge levels that frame task complexity.', dokCards),
    buildSection('prerequisites', 'Prerequisites', 'Earlier ideas that support understanding this concept.', prerequisiteCards),
    buildSection('misconceptions', 'Misconceptions', 'Likely misunderstandings to address during instruction.', misconceptionsCards),
    buildSection('real-world', 'Real World', 'Ways the idea appears in classroom and everyday life.', realWorldCards),
    buildSection('pedagogy', 'Pedagogy', 'Teaching approaches that work well for this chapter.', pedagogyCards),
  ];

  return {
    courseTitle: course.title,
    courseCode: course.code,
    chapterTitle: chapter.title,
    chapterSummary:
      chapter.title === 'Introduction to Social Science'
        ? 'This chapter introduces the structure of social science, its major branches, and its importance in understanding human life, society, and the environment.'
        : `This chapter explores ${chapter.title.toLowerCase()} through chapter-specific key ideas, classroom practice, and real-world connections.`,
    concept,
    conceptIndex,
    totalConcepts: chapterConcepts.count,
    sections,
  };
}

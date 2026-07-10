import { getConceptIntelligenceData, type Chapter } from './chapters';
import type { KeyConcept } from './chapterKeyConcepts';

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

function asString(value: unknown): string {
  if (value === null || value === undefined) return '';
  return String(value).trim();
}

function makeCard(title: string, description: string, category: string, confidence = '—'): SemanticCard {
  return { title, description, category, confidence };
}

function coverageToConfidence(coverage: number | undefined): string {
  if (typeof coverage !== 'number' || Number.isNaN(coverage)) return '—';
  const percent = Math.round(coverage * 100);
  return `${Math.min(100, Math.max(0, percent))}%`;
}

function toKeyConcept(concept: { title: string; description?: string }): KeyConcept {
  return {
    title: concept.title,
    description: concept.description ?? '',
    mastery: '—',
    time: '—',
  };
}

export function getSemanticIntelligenceForSelection(
  chapter: Chapter,
  conceptTitle: string,
  courseMeta?: { title: string; code: string }
): SemanticIntelligenceContent | null {
  if (!chapter) return null;

  const intel = getConceptIntelligenceData(chapter, conceptTitle);
  const concepts = chapter.concepts ?? [];
  const selectedIndex = concepts.findIndex((concept) => concept.title === conceptTitle);
  const activeConcept = concepts[selectedIndex >= 0 ? selectedIndex : 0];

  if (!activeConcept && concepts.length === 0) {
    return null;
  }

  const concept = toKeyConcept(activeConcept ?? { title: conceptTitle });
  const conceptIndex = selectedIndex >= 0 ? selectedIndex : 0;
  const totalConcepts = intel.totalConcepts;

  const previous = concepts.slice(Math.max(0, selectedIndex - 2), selectedIndex);
  const next = concepts.slice(selectedIndex + 1, selectedIndex + 3);

  const knowledgeCards: SemanticCard[] = [];
  if (concept.description) {
    knowledgeCards.push(makeCard('Concept Overview', concept.description, 'Knowledge'));
  }
  intel.knowledge.forEach((value) => {
    if (value) knowledgeCards.push(makeCard(value, value, 'Knowledge'));
  });

  const abilityCards = intel.abilities.map((item) => {
    const ability = asString(item?.ability);
    const refs = (item?.knowledge_refs ?? []).filter(Boolean).join(', ');
    const description = [asString(item?.description), refs].filter(Boolean).join(' · ') || ability;
    return makeCard(ability, description, 'Ability');
  });

  const skillCards = intel.skills.map((item) => {
    const skill = asString(item?.skill);
    const refs = (item?.ability_refs ?? []).filter(Boolean).join(', ');
    const description = refs ? `Linked abilities: ${refs}` : skill;
    return makeCard(skill, description, 'Skill');
  });

  const competencyCards = (intel.competencies ?? []).map((item) =>
    makeCard(asString(item?.competency), asString(item?.competency), 'Competency')
  );

  const bloomCards = (intel.blooms ?? []).map((item) => {
    const level = asString(item?.level) || 'Unknown';
    const score = typeof item?.coverage_score === 'number' ? item.coverage_score : undefined;
    return makeCard(
      level,
      `Concept coverage for "${level}" as reported by the intelligence API.`,
      "Bloom's Taxonomy",
      coverageToConfidence(score)
    );
  });

  const dokCards = (intel.dok ?? []).map((item) => {
    const level = asString(item?.level) || '1';
    return makeCard(
      `DOK ${level}`,
      asString(item?.description) || `Depth of Knowledge level ${level}.`,
      'DOK'
    );
  });

  const prerequisiteCards: SemanticCard[] =
    (intel.prerequisites ?? []).length > 0
      ? (intel.prerequisites ?? []).map((item) => makeCard(asString(item), asString(item), 'Prerequisite'))
      : [
          makeCard(
            'Chapter Foundation',
            `A general understanding of ${chapter.title} supports learning ${concept.title.toLowerCase()}.`,
            'Prerequisite'
          ),
        ];

  const misconceptionCards = (intel.misconceptions ?? []).map((item, index) =>
    makeCard(`Misconception ${index + 1}`, asString(item?.misconception), 'Misconception')
  );

  const realWorldCards = (intel.realWorld ?? []).map((item) =>
    makeCard(asString(item?.application_type), asString(item?.application ?? item?.example), 'Real World')
  );

  const assessmentCards = (intel.assessmentBlueprint ?? []).map((item) => {
    const title = asString(item?.assessment_type);
    const description = asString(item?.recommended_question);
    const category = [asString(item?.bloom_level), asString(item?.dok_level), asString(item?.difficulty)]
      .filter(Boolean)
      .join(' · ');
    const confidence = item?.marks != null ? `${item.marks} marks` : '—';
    return makeCard(title, description, category || 'Assessment', confidence);
  });

  const pedagogyCards = (intel.pedagogy ?? []).map((item) => {
    const strategy = asString(item?.strategy);
    return makeCard(strategy, asString(item?.activity) || strategy, 'Pedagogy');
  });

  const contextNote = previous.length
    ? `${concept.title} builds on ${previous.map((item) => item.title).join(' and ')} and prepares learners for ${
        next.map((item) => item.title).join(' and ') || 'the next concept'
      }.`
    : `${concept.title} introduces the foundational understanding needed for the rest of ${chapter.title}.`;

  const sections: SemanticSection[] = [
    {
      id: 'knowledge',
      title: 'Knowledge',
      description: 'Understand the idea and how it is structured in the chapter, sourced from the intelligence API.',
      cards: knowledgeCards,
    },
    {
      id: 'ability',
      title: 'Ability',
      description: 'What learners can explain, identify, and compare after studying this concept.',
      cards: abilityCards,
    },
    {
      id: 'skill',
      title: 'Skill',
      description: 'Practical thinking and communication behaviours built through the concept.',
      cards: skillCards,
    },
    {
      id: 'competency',
      title: 'Competency',
      description: 'Observable performance outcomes for classwork and assessment.',
      cards: competencyCards,
    },
    {
      id: 'bloom',
      title: "Bloom's Taxonomy",
      description: 'Cognitive action levels aligned to the concept, with coverage from the API.',
      cards: bloomCards,
    },
    {
      id: 'dok',
      title: 'DOK',
      description: 'Depth of Knowledge levels that frame task complexity.',
      cards: dokCards,
    },
    {
      id: 'prerequisites',
      title: 'Prerequisites',
      description: 'Earlier ideas that support understanding this concept.',
      cards: prerequisiteCards,
    },
    {
      id: 'misconceptions',
      title: 'Misconceptions',
      description: 'Likely misunderstandings to address during instruction.',
      cards: misconceptionCards,
    },
    {
      id: 'real-world',
      title: 'Real World',
      description: 'Ways the idea appears in classroom and everyday life.',
      cards: realWorldCards,
    },
    {
      id: 'pedagogy',
      title: 'Pedagogy',
      description: 'Teaching approaches that work well for this chapter.',
      cards: pedagogyCards,
    },
    {
      id: 'assessment',
      title: 'Assessment',
      description: 'Assessment blueprint with recommended questions aligned to Bloom’s and DOK.',
      cards: assessmentCards,
    },
  ];

  const chapterSummary = intel.learningObjective || contextNote;

  return {
    courseTitle: courseMeta?.title ?? '',
    courseCode: courseMeta?.code ?? '',
    chapterTitle: chapter.title,
    chapterSummary,
    concept,
    conceptIndex,
    totalConcepts,
    sections,
  };
}

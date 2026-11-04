'use client';

/**
 * Knowledge Graph Explorer's data layer — a facade, not a new backend
 * client. Three existing, independently-built data modules already cover
 * everything this screen needs; this file re-exports them under one
 * consistent naming scheme (and resolves the type-name collisions between
 * them) rather than writing a fourth graph client:
 *
 *   - Curriculum → Unit → Chapter → Topic → Concept: the MariaDB Coherence
 *     Map (`app/course-master/data/{curriculum,coherenceMap}.ts`). This is
 *     the authoritative hierarchy — it already has the Unit level the Neo4j
 *     graph is still missing — and it's curator-reviewable (draft/approved
 *     edge status), not a read-only AI suggestion.
 *   - Concept-to-concept relationships for one concept: the ESO engine's
 *     own chapter knowledge map (`app/pal/data/pal-eso.ts`), which merges
 *     curator-authored prerequisites with AI-suggested ones (human wins)
 *     and already crosses chapter/standard boundaries. Reached here via
 *     fetchKnowledgeMapForViewer() — the teacher/admin-readable sibling of
 *     the student's own in-lesson fetchKnowledgeMap().
 *   - The optional "AI-suggested" overlay: the Neo4j Coherence Map
 *     (`app/pal/new/data/coherence-map.ts`). Its own edges are almost all
 *     unreviewed AI drafts and the graph can contain cycles — every caller
 *     of fetchAiSuggestedOverlay()/fetchAiOverlayHealth() must show the
 *     caveat these two were built to report, never hide it.
 *
 * Nothing here computes a relationship, a mastery state or a curriculum
 * fact — every one of those stays exactly where it already lived.
 */

export {
  getCurriculumSession,
  type CurriculumSession,
} from '@/app/course-master/data/curriculum';

export {
  fetchCoherenceMap as fetchCurriculumHierarchy,
  fetchCoherenceMapForConcept as fetchCurriculumHierarchyForConcept,
  isReviewableEdge as isReviewableHierarchyEdge,
  type CoherenceMap as CurriculumGraph,
  type CoherenceNode as CurriculumNode,
  type CoherenceEdge as CurriculumEdge,
  type CoherenceNodeType as CurriculumNodeType,
  type CoherenceEdgeStatus as CurriculumEdgeStatus,
  type CoherenceEdgeKind as CurriculumEdgeKind,
} from '@/app/course-master/data/coherenceMap';

export {
  fetchKnowledgeMapForViewer as fetchConceptRelationships,
  type KnowledgeMap as ConceptRelationshipMap,
  type KnowledgeMapConcept,
  type KnowledgeMapEdge,
  type KnowledgeMapNodeStatus,
  type KnowledgeMapEdgeType,
} from '@/app/pal/data/pal-eso';

export {
  fetchCoherenceScopes as fetchAiOverlayScopes,
  fetchCoherenceMap as fetchAiSuggestedOverlay,
  fetchCoherenceHealth as fetchAiOverlayHealth,
  type CoherenceScope as AiOverlayScope,
  type CoherenceMap as AiOverlayGraph,
  type CoherenceNode as AiOverlayNode,
  type CoherenceEdge as AiOverlayEdge,
  type CoherenceHealth as AiOverlayHealth,
} from '@/app/pal/new/data/coherence-map';

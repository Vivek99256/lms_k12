export type CareerRecord = Record<string, unknown>;

export type CareerSection =
  | 'plan'
  | 'match'
  | 'intelligence';

export interface RequestState<T> {
  data: T;
  loading: boolean;
  error: string;
}

export type CertaintyLevel = 'not_sure' | 'somewhat_sure' | 'very_sure';

export interface AspirationSnapshot {
  id: number;
  student_id: string;
  grade: number;
  academic_year: string;
  occupation_id: string | null;
  occupation_name: string | null;
  expectation_age_30: string | null;
  certainty: number | null;
  parent_occupation_id: string | null;
  parent_occupation_name: string | null;
  preferred_stream: string | null;
  source: string;
  is_current: boolean;
  captured_at: string;
}

export interface AspirationInput {
  occupation_id?: string;
  occupation_name?: string;
  expectation_age_30: string;
  certainty: CertaintyLevel;
  parent_occupation_id?: string;
  parent_occupation_name?: string;
}

export type AlignmentStatus = 'ALIGNED' | 'MISALIGNED' | 'INSUFFICIENT_DATA';

export interface AlignmentExam {
  exam_id: string;
  name: string;
}

export interface AlignmentBreakPoint {
  current_stream: string | null;
  required_stream: string | null;
  missing_subjects: string[];
  required_exams: AlignmentExam[];
  deadline_date: string | null;
  days_remaining: number | null;
}

export interface AlignmentStatedAmbition {
  occupation_id: string | null;
  occupation_name: string | null;
  certainty_score: number | null;
}

/**
 * Mirrors App\CareerIntelligence\CaiCoreService::evaluate()'s return shape
 * exactly (Laravel repo, Phase 3) — assembled from cai_core.cypher's own
 * RETURN clause plus the field names CI-SPEC-CONSOLE-001 documents binding
 * to. The real CI-SPEC-CAI-001 doc wasn't available when that was built, so
 * treat this as provisional and re-check field names against it if/when it
 * turns up.
 */
export interface AlignmentPayload {
  student_id: string;
  alignment_status: AlignmentStatus;
  misalignment_codes: string[];
  stated_ambition: AlignmentStatedAmbition | null;
  break_point: AlignmentBreakPoint | null;
  evidence_summary: unknown | null;
  insufficient_data_reason?: string;
}

/**
 * Phase-1 Career Intelligence is evidence-first: it surfaces what evidence
 * exists and where it's missing, never a match score or AI recommendation.
 * These types describe the `studentCareerEvidence` endpoint's response,
 * backed by CareerEvidenceService (Laravel repo) reading student_aspirations
 * and evidence_events directly, with CaiCoreService consulted for
 * career-specific missing-subject detection where a seeded occupation graph
 * exists.
 *
 * `EvidenceLevel` matches evidence_events.performance_level's real DB enum
 * exactly (see the table's migration) — it is never 'no evidence', only how
 * strong the evidence is. A subject with genuinely no evidence simply has no
 * entry in `evidence_summary` at all; that absence is what `missing_subjects`
 * and the coverage helpers in `_lib/evidence.ts` are for.
 */
export type EvidenceLevel = 'demonstrated' | 'developing' | 'emerging' | 'insufficient';

export interface EvidenceSourceRef {
  source_type: string;
  source_label: string;
}

export interface EvidenceSummaryItem {
  subject: string;
  level: EvidenceLevel;
  source_count: number;
  sources: EvidenceSourceRef[];
}

export interface EvidenceEvent {
  id: string;
  event_date: string;
  subject: string;
  level: EvidenceLevel;
  source: EvidenceSourceRef;
}

export type CoverageStatus = 'strong' | 'partial' | 'limited' | 'no_evidence';

export type CareerEvidenceStatus = 'complete' | 'partial' | 'insufficient' | 'no_evidence';

export interface CareerEvidencePayload {
  student_id: string;
  aspiration: AspirationSnapshot | null;
  evidence_summary: EvidenceSummaryItem[];
  evidence_events: EvidenceEvent[];
  evidence_status: CareerEvidenceStatus;
  missing_subjects: string[];
  insufficient_data_reason?: string;
}

/**
 * Knowledge-Based Career Recommendation Engine (Laravel repo:
 * App\CareerIntelligence\KnowledgeMatchService / AlternativeOccupationRecommender
 * / AlignmentBandClassifier / CareerRecommendationExplainer). Backs the
 * `careerRecommendation` endpoint used by "Explore Adjacent Careers".
 *
 * `alignmentBand` is a presentation-layer label over `matchPercentage` — a
 * counsellor-facing interpretation, never a second scoring pass — so it is
 * only ever one of these three configured bands.
 */
export type AlignmentBand = 'Strong Match' | 'Partial Match' | 'Weak Match';

export interface CareerRecommendationAspiration {
  occupation_code: string;
  occupation_name: string | null;
  matchPercentage: number;
  alignmentBand: AlignmentBand;
}

export interface RelatedCareer {
  occupation_code: string;
  occupation_name: string;
  matchPercentage: number;
  scoreImprovement: number;
  topMatchedKnowledgeDomains: string[];
}

export interface KnowledgeDevelopmentArea {
  knowledge: string;
  importance: number;
  level: number;
}

export interface CareerRecommendationNarrative {
  alignmentSummary: string | null;
  relatedCareersGuidance: string | null;
  knowledgeDevelopmentIntro: string | null;
}

export interface CareerRecommendationPayload {
  student_id: string;
  currentAspiration: CareerRecommendationAspiration | null;
  relatedCareersWithBetterAlignment: RelatedCareer[];
  knowledgeDevelopmentAreas: KnowledgeDevelopmentArea[];
  narrative: CareerRecommendationNarrative;
  alignment: AlignmentStatus | 'INSUFFICIENT_DATA';
  insufficient_data_reason?: string;
}

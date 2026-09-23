/**
 * The shared module-intelligence layer.
 *
 * A module's Intelligence route needs exactly two things from here:
 *
 *   import { ModuleIntelligence } from '@/components/intelligence/module';
 *   import { resultIntelligenceContract } from '@/components/intelligence/module/contracts/result';
 *
 * Contracts are NOT re-exported from this barrel on purpose: each one pulls in
 * its own module's API client, and a barrel that exported all of them would
 * pull every module's client into every bundle that imports anything here.
 */

export { ModuleIntelligence } from './ModuleIntelligence';

export {
  defineContract,
  defaultSections,
  sectionsWith,
  MAX_EXTRA_CARDS,
  type DecisionVerdict,
  type ExtraCard,
  type ModuleIntelligenceActions,
  type ModuleIntelligenceContract,
  type SectionConfig,
  type SectionCopy,
  type SectionKey,
} from './contract';

export {
  count,
  decimal,
  duration,
  EM_DASH,
  formatValue,
  money,
  moneyExact,
  percent,
  timestamp,
} from './format';

export {
  AccentButton,
  ConfidencePill,
  EvidenceGrid,
  MetricTile,
  Section,
  SeverityChip,
  SeverityRail,
  Surface,
  Unavailable,
  toneFor,
  toneForResult,
} from './primitives';

export {
  IntelligenceSectionNav,
  SECTION_NAV_LABELS,
  type IntelligenceNavSection,
} from './section-nav';

export {
  findIntelligenceModule,
  liveIntelligenceModules,
  INTELLIGENCE_MODULES,
  type ModuleIntelligenceStatus,
  type RegisteredIntelligenceModule,
} from './registry';

export type {
  Breakdown,
  BreakdownColumn,
  BreakdownRow,
  Confidence,
  Coverage,
  DataQuality,
  DataQualityCheck,
  DecisionTrailEntry,
  EvidencePoint,
  Finding,
  Impact,
  Learning,
  MeasuredOutcome,
  Metric,
  MetricGroup,
  ModuleIntelligencePayload,
  OutcomeState,
  Priority,
  Recommendation,
  RuleStatus,
  SummaryBlock,
  Tone,
  ValueFormat,
} from './payload';

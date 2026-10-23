import type { SectionKey } from '@/components/intelligence/module/contract';
import type { ModuleIntelligencePayload } from '@/components/intelligence/module/payload';

/**
 * The Intelligence screen's navigation, in one place.
 *
 * Every module's Intelligence screen has exactly these five tabs, in this order:
 * Summary, Recommendations, Decisions, Module Integration, Cross-Module Workflow.
 *
 * The contract still declares eleven sections (`SectionKey`) and every module's payload still
 * carries all of their data. Nothing was removed. Six of the eleven - Position, Breakdowns,
 * Findings, Priorities, Data quality and Learning - are no longer tabs of their own: they are
 * labelled, collapsible parts of the Summary tab, rendered by the same section components with the
 * same data. `SECTION_HOME` records where every section lives, and it is a `Record<SectionKey, ...>`
 * so adding a twelfth section without deciding where it goes is a compile error rather than a
 * section that silently has no home.
 */

export type IntelligenceTabKey = 'summary' | 'recommendations' | 'decisions' | 'integration' | 'workflow';

export interface IntelligenceTab {
  key: IntelligenceTabKey;
  label: string;
}

/** The five tabs. Order and labels are the product requirement; do not reorder or add to this list. */
export const INTELLIGENCE_TABS: readonly IntelligenceTab[] = [
  { key: 'summary', label: 'Summary' },
  { key: 'recommendations', label: 'Recommendations' },
  { key: 'decisions', label: 'Decisions' },
  { key: 'integration', label: 'Module Integration' },
  { key: 'workflow', label: 'Cross-Module Workflow' },
];

/** The sections that now live inside the Summary tab, in reading order. `summary` is its head. */
export const SUMMARY_PART_KEYS = ['summary', 'position', 'breakdowns', 'findings', 'priorities', 'dataQuality', 'learning'] as const;
export type SummaryPartKey = (typeof SUMMARY_PART_KEYS)[number];

export interface SummaryPart {
  key: SummaryPartKey;
  /** Name in the in-page navigation and on the part's header. */
  label: string;
  /** DOM id of the part, the target of the in-page navigation and of an old section link. */
  anchorId: string;
}

export const SUMMARY_PARTS: readonly SummaryPart[] = [
  { key: 'summary', label: 'Management summary', anchorId: 'intel-summary' },
  { key: 'position', label: 'Current position', anchorId: 'intel-position' },
  { key: 'breakdowns', label: 'Performance breakdowns', anchorId: 'intel-breakdowns' },
  { key: 'findings', label: 'Key findings', anchorId: 'intel-findings' },
  { key: 'priorities', label: 'Priorities', anchorId: 'intel-priorities' },
  { key: 'dataQuality', label: 'Data quality', anchorId: 'intel-data-quality' },
  { key: 'learning', label: 'Learning', anchorId: 'intel-learning' },
];

export function summaryPart(key: SummaryPartKey): SummaryPart {
  return SUMMARY_PARTS.find((part) => part.key === key)!;
}

/** Where each of the eleven sections is shown now. Exhaustive on purpose. */
export const SECTION_HOME: Record<SectionKey, { tab: IntelligenceTabKey; part?: SummaryPartKey }> = {
  summary: { tab: 'summary', part: 'summary' },
  position: { tab: 'summary', part: 'position' },
  breakdowns: { tab: 'summary', part: 'breakdowns' },
  findings: { tab: 'summary', part: 'findings' },
  priorities: { tab: 'summary', part: 'priorities' },
  dataQuality: { tab: 'summary', part: 'dataQuality' },
  learning: { tab: 'summary', part: 'learning' },
  recommendations: { tab: 'recommendations' },
  decisions: { tab: 'decisions' },
  integration: { tab: 'integration' },
  workflow: { tab: 'workflow' },
};

export interface IntelligenceTarget {
  tab: IntelligenceTabKey;
  /** The Summary part to scroll to, when the request named one of the old section tabs. */
  part: SummaryPartKey | null;
}

/** Spellings an old link or bookmark might carry, normalised to a `SectionKey`. */
const ALIASES: Record<string, SectionKey> = {
  summary: 'summary',
  position: 'position',
  breakdowns: 'breakdowns',
  breakdown: 'breakdowns',
  findings: 'findings',
  finding: 'findings',
  priorities: 'priorities',
  priority: 'priorities',
  dataquality: 'dataQuality',
  learning: 'learning',
  recommendations: 'recommendations',
  recommendation: 'recommendations',
  decisions: 'decisions',
  decision: 'decisions',
  decisionrecord: 'decisions',
  integration: 'integration',
  integrations: 'integration',
  moduleintegration: 'integration',
  workflow: 'workflow',
  workflows: 'workflow',
  crossmoduleworkflow: 'workflow',
  crossmoduleworkflows: 'workflow',
};

/**
 * Map any section name - current or from before the five-tab layout - to where it lives now.
 *
 * Returns null for something that is not a section name at all (an unrelated `#hash`), so a caller
 * can leave the page alone instead of guessing. Never throws and never returns a tab that does not
 * exist: the old six resolve to Summary plus the part to scroll to.
 */
export function resolveIntelligenceTarget(requested: string | null | undefined): IntelligenceTarget | null {
  if (!requested) return null;
  const normalised = requested.trim().replace(/^#/, '').replace(/^intel-/, '').toLowerCase().replace(/[^a-z]/g, '');
  const key = ALIASES[normalised];
  if (!key) return null;
  const home = SECTION_HOME[key];

  return { tab: home.tab, part: home.part && home.tab === 'summary' ? home.part : null };
}

/* ----------------------------------------------------------- part headers */

export interface PartBadge {
  text: string;
  /** True when the part holds something a person should look at, so it can be flagged in the navigation. */
  attention: boolean;
}

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

/**
 * A short count for a part's header and its in-page link, from the data that part already shows.
 * It counts rows the section renders; it computes no figure and never replaces the section's own
 * content or its own empty-state reason.
 */
export function summaryPartBadge(key: SummaryPartKey, data: ModuleIntelligencePayload): PartBadge | null {
  switch (key) {
    case 'position': {
      const n = data.position?.available ? (data.position.metrics ?? []).length : 0;
      return n > 0 ? { text: plural(n, 'measure', 'measures'), attention: false } : { text: 'Unavailable', attention: false };
    }
    case 'breakdowns': {
      const n = (data.breakdowns ?? []).length;
      return n > 0 ? { text: plural(n, 'breakdown', 'breakdowns'), attention: false } : null;
    }
    case 'findings': {
      const n = (data.findings ?? []).length;
      return n > 0 ? { text: plural(n, 'finding', 'findings'), attention: true } : { text: 'None raised', attention: false };
    }
    case 'priorities': {
      const n = (data.priorities ?? []).length;
      return n > 0 ? { text: plural(n, 'priority', 'priorities'), attention: true } : { text: 'None flagged', attention: false };
    }
    case 'dataQuality': {
      if (!data.dataQuality?.available || (data.dataQuality.checks ?? []).length === 0) return { text: 'Unavailable', attention: false };
      const review = data.dataQuality.checks.filter((check) => check.state === 'attention').length;
      return review > 0 ? { text: `${review} to review`, attention: true } : { text: 'All clear', attention: false };
    }
    case 'learning': {
      const n = data.learning?.available ? (data.learning.entries ?? []).length : 0;
      return n > 0 ? { text: plural(n, 'entry', 'entries'), attention: false } : { text: 'Nothing yet', attention: false };
    }
    default:
      return null;
  }
}

/**
 * The Summary parts a contract shows: always the head, then each of the six former tabs the
 * contract declares. A module that deliberately omitted a section does not get one invented.
 */
export function summaryPartsFor(declared: readonly string[]): SummaryPart[] {
  return SUMMARY_PARTS.filter((part) => part.key === 'summary' || declared.includes(part.key));
}

import type {
  CareerEvidenceStatus, CoverageStatus, EvidenceEvent, EvidenceLevel, EvidenceSummaryItem,
} from './types';

export const EVIDENCE_LEVEL_LABEL: Record<EvidenceLevel, string> = {
  demonstrated: 'Demonstrated',
  developing: 'Developing',
  emerging: 'Emerging',
  insufficient: 'Insufficient evidence',
};

export const COVERAGE_STATUS_LABEL: Record<CoverageStatus, string> = {
  strong: 'Strong',
  partial: 'Partial',
  limited: 'Limited',
  no_evidence: 'No evidence',
};

export const CAREER_EVIDENCE_STATUS_LABEL: Record<CareerEvidenceStatus, string> = {
  complete: 'Full evidence available',
  partial: 'Partial evidence available',
  insufficient: 'Insufficient evidence available',
  no_evidence: 'No evidence available yet',
};

/**
 * Buckets a subject's real level + source count into a coverage status.
 * Deliberately a fixed, deterministic mapping over fields the backend already
 * returns — not a score, and nothing here is inferred or predicted. A subject
 * absent from evidence_summary entirely (no `item`) is the only "no evidence"
 * case; every present item, even 'insufficient', is at least "limited"
 * coverage since a real evidence_events row exists for it.
 */
export function computeCoverageStatus(item: EvidenceSummaryItem | undefined): CoverageStatus {
  if (!item || item.source_count <= 0) return 'no_evidence';
  if (item.level === 'demonstrated' && item.source_count >= 2) return 'strong';
  if (item.level === 'demonstrated' || item.level === 'developing') return 'partial';
  return 'limited';
}

export function groupEventsByMonth(events: EvidenceEvent[]) {
  const sorted = [...events].sort((a, b) => (a.event_date < b.event_date ? 1 : -1));
  const groups: Array<{ key: string; label: string; events: EvidenceEvent[] }> = [];
  for (const event of sorted) {
    const date = new Date(event.event_date);
    const valid = !Number.isNaN(date.getTime());
    const key = valid ? `${date.getFullYear()}-${date.getMonth()}` : 'unknown';
    const label = valid
      ? date.toLocaleDateString('en-IN', { month: 'short', year: 'numeric' })
      : 'Date unavailable';
    let group = groups.find((item) => item.key === key);
    if (!group) {
      group = { key, label, events: [] };
      groups.push(group);
    }
    group.events.push(event);
  }
  return groups;
}

export function formatEventDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
}

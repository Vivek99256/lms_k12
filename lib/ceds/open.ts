import type { CedsResources, FormatRow } from '@/lib/ceds/api';

/**
 * Which CEDS resource format a card of the Classroom Resource list is, so pressing Open on it can ask for a
 * teaching method. Only the five card types that ARE one of the six formats are listed; every other card
 * (videos, worksheets, lesson plans, H5P, teacher training...) has no CEDS format and keeps opening as before.
 * (D1, Classroom Content, is met by the Presentation and the Revision Notes, so it is chosen, not clicked.)
 */
const FORMAT_BY_CARD_TYPE: Record<string, string> = {
  'Classroom presentation': 'D2',
  'Classroom activity': 'D3',
  Prayogshala: 'D4',
  'Revision notes': 'D5',
  'Remedial class': 'D6',
};

export function formatCodeFor(cardType: string | null | undefined): string | null {
  return (cardType && FORMAT_BY_CARD_TYPE[cardType]) || null;
}

/** The fit row of one format in the response asked for a given method, or undefined when it is not there. */
export function fitRowFor(resources: CedsResources | null, format: string): FormatRow | undefined {
  return resources?.formats.find((f) => f.format === format);
}

/**
 * What to say about a pairing before the teacher goes on. A weak fit is explained once and the teacher decides:
 * nothing is blocked, and nothing is hidden.
 */
export function fitMessage(row: FormatRow | undefined): { tone: 'ok' | 'weak' | 'unknown'; text: string; confirmLabel: string } {
  if (!row || !row.fit) return { tone: 'unknown', text: '', confirmLabel: 'Show lesson flow' };
  if (row.fit === 'W') {
    const better = row.alternative_formats?.length ? ` Better suited to this method: ${row.alternative_formats.join(', ')}.` : '';
    const other = row.alternative_pedagogies?.length ? ` Or choose a different method: ${row.alternative_pedagogies.join(', ')}.` : '';
    return { tone: 'weak', text: `${row.warning ?? 'This pairing is a weak fit.'}${better}${other} You can still present it.`, confirmLabel: 'Present anyway' };
  }
  return { tone: 'ok', text: row.fit === 'S' ? 'Strong fit.' : 'Possible fit.', confirmLabel: 'Show lesson flow' };
}

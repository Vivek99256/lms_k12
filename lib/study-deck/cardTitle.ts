/**
 * Headings for the cards of an interactive slide, derived from what a card says.
 *
 * NO REACT HERE. This is the TypeScript twin of next_lms_erp `App\Services\StudyDeck\CardTitle`, which the server uses when it
 * builds new decks; both are checked against the same real cases (lib/study-deck/fixtures/card-titles.json). It exists for decks
 * STORED BEFORE that fix: a numbered placeholder ("Key idea 1", "Card 3") on such a deck is replaced, for DISPLAY ONLY, by a heading
 * drawn from the card's own text. Nothing is written back to the stored deck and no model is called.
 *
 * Order: 1 the source's own short line, 2 a concise heading compressed from the card's text, 3 the concept and the kind of
 * knowledge, 4 a neutral description. A numbered label is never produced.
 */

import type { DeckSlide, StudyDeck } from './types';

export const MAX_WORDS = 10;
const MIN_WORDS = 2;

const TRAILING = ['a', 'an', 'the', 'of', 'to', 'in', 'on', 'at', 'by', 'for', 'with', 'from', 'and', 'or', 'but', 'as', 'that', 'which', 'is', 'are', 'be', 'can', 'may', 'must', 'should', 'will', 'such', 'per', 'than', 'into', 'over', 'using', 'about', 'so', 'when', 'while', 'rather'];
const PREPOSITIONS = ['from', 'to', 'for', 'with', 'by', 'over', 'under', 'as', 'into', 'through', 'across', 'during', 'after', 'before', 'than'];
const DANGLING = ['comes', 'goes', 'arises', 'arise', 'depends', 'depend', 'relies', 'results', 'result', 'differs', 'applies', 'moves', 'grows', 'gives', 'leads', 'refers', 'made', 'built', 'used', 'based', 'shaped', 'defined', 'known', 'called', 'found', 'observed', 'expressed', 'described', 'derived', 'related', 'linked', 'connected', 'applied', 'ran', 'run', 'differ', 'vary', 'varies', 'belong', 'belongs', 'come', 'change', 'changes', 'act', 'acts', 'depends'];
const CLAUSE_STARTERS = ['so', 'which', 'because', 'while', 'whereas', 'but', 'not', 'although', 'since', 'where', 'thus', 'meaning', 'making', 'helping', 'rather'];
const BREAK = ['because', 'so', 'which', 'that', 'when', 'while', 'whereas', 'such', 'using', 'by', 'from', 'to', 'for', 'with', 'over', 'under', 'as', 'and', 'or', 'but', 'into', 'through', 'across', 'during', 'after', 'before', 'than', 'can', 'may', 'must', 'should', 'will', 'is', 'are', 'was', 'were', 'helps', 'gives', 'makes', 'provides', 'requires', 'shows', 'allows', 'rather'];
const OPENERS = ['in', 'on', 'for', 'when', 'if', 'as', 'at', 'during', 'by', 'with', 'after', 'before', 'while', 'once', 'because', 'although'];
const TYPE_PHRASE: Record<string, string> = {
  definition: 'What it means',
  fact: 'A fact to know',
  process: 'How it works',
  rule: 'The rule',
  principle: 'The principle',
  relationship: 'How it connects',
  classification: 'How it is classified',
  law: 'The law',
};

const words = (s: string): string[] => s.trim().split(/\s+/u).filter(Boolean);
const key = (s: string): string => s.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ').trim();
const stripEnd = (w: string): string => w.replace(/[,;:]+$/u, '').toLowerCase();

/**
 * True for a numbered placeholder: "Key idea 1", "Key points 2", "Point 3", "Item 4", "Card 1", "Idea 2", or a bare number.
 * A meaningful title that merely contains a number ("Newton's 2nd law", "Step 2 of the water cycle") is not generic.
 */
export function isGenericLabel(label: string | null | undefined): boolean {
  const s = (label ?? '').trim();
  if (s === '') return true;

  return (
    /^(?:key\s+(?:ideas?|points?|takeaways?)|ideas?|points?|items?|cards?|tabs?)\s*[#:.\-–]?\s*\d{1,3}$/iu.test(s) ||
    /^#?\d{1,3}[.)]?$/u.test(s) ||
    /^(?:untitled|heading|title)$/iu.test(s)
  );
}

/** A concise heading for a sentence, or null when it cannot be made reliably. */
export function compressHeading(text: string): string | null {
  let s = text.replace(/\([^)]*\)/gu, '').replace(/\s+/gu, ' ').trim();
  s = s.replace(/^[\s"'“”‘’]+|[\s"'“”‘’]+$/gu, '').replace(/[.!?;:\s]+$/u, '');
  if (s === '') return null;

  const clause = /^(.+?)\s*(?:[,;:]|\s[—–-]\s)\s*(\S+)/u.exec(s);
  if (clause) {
    const first = words(clause[1]);
    const next = clause[2].toLowerCase();
    const list = /\b(?:such as|for example|including|like)\b/iu.test(clause[1]);
    if (first.length >= 3 && !list && !OPENERS.includes(first[0].toLowerCase()) && (CLAUSE_STARTERS.includes(next) || /[;:]|\s[—–-]\s/u.test(clause[0]))) {
      s = clause[1];
    }
  }

  let w = words(s);
  const original = w.length;
  if (w.length > MAX_WORDS) {
    let cut: number | null = null;
    for (let i = MAX_WORDS; i >= 5; i--) {
      const next = (w[i] ?? '').toLowerCase();
      if (!BREAK.includes(next)) continue;
      if (PREPOSITIONS.includes(next) && DANGLING.includes(stripEnd(w[i - 1]))) continue;
      cut = i;
      break;
    }
    if (cut === null) {
      for (let j = MAX_WORDS + 3; j >= 4; j--) {
        if (w[j] !== undefined && w[j].endsWith(',')) {
          cut = j + 1;
          break;
        }
      }
    }
    w = w.slice(0, cut ?? Math.min(w.length, MAX_WORDS + 4));
    const stub = /^(.{12,}),\s*(\S+(?:\s+\S+)?)$/u.exec(w.join(' '));
    if (stub && words(stub[1]).length >= 3) w = words(stub[1]);
  }
  const ragged = original > w.length ? [...TRAILING, ...DANGLING, 'exactly', 'nearly'] : TRAILING;
  while (w.length > 0 && ragged.includes(stripEnd(w[w.length - 1]))) w.pop();
  if (w.length < MIN_WORDS) return null;
  const h = w.join(' ').replace(/[,;:]+$/u, '');

  return h.charAt(0).toUpperCase() + h.slice(1);
}

export interface CardSource {
  statement?: string;
  knowledge?: string;
  type?: string;
}

/** The heading of one card and which level of the fallback order produced it (1 best, 4 weakest). */
export function resolveHeading(card: CardSource, concept = '', taken: readonly string[] = []): { title: string; level: 1 | 2 | 3 | 4 } {
  const statement = (card.statement ?? '').trim();
  const short = (card.knowledge ?? '').trim();
  const free = (t: string | null): boolean => t !== null && t !== '' && !isGenericLabel(t) && !taken.includes(key(t));

  if (short !== '' && words(short.replace(/\.+$/u, '')).length <= MAX_WORDS && key(short) !== key(statement)) {
    const t = compressHeading(short);
    if (t !== null && free(t)) return { title: t, level: 1 };
  }
  for (const source of [short, statement]) {
    const t = source !== '' ? compressHeading(source) : null;
    if (t !== null && free(t)) return { title: t, level: 2 };
  }
  const phrase = TYPE_PHRASE[(card.type ?? '').trim().toLowerCase()];
  if (concept !== '' && phrase && free(`${phrase}: ${concept}`)) return { title: `${phrase}: ${concept}`, level: 3 };
  let t = concept !== '' ? `More about ${concept}` : 'More about this idea';
  if (!free(t)) t += ' (continued)';

  return { title: t, level: 4 };
}

/** True when a card's heading is just the opening of its own text, so a closed card need not show that opening a second time. */
export function headingRepeatsText(label: string, text: string): boolean {
  const a = key(label);

  return a.length > 0 && key(text).startsWith(a);
}

/** Headings for a slide's cards, all different from each other. */
export function resolveAllHeadings(cards: readonly CardSource[], concept = ''): Array<{ title: string; level: 1 | 2 | 3 | 4 }> {
  const taken: string[] = [];

  return cards.map((card) => {
    const r = resolveHeading(card, concept, taken);
    taken.push(key(r.title));

    return r;
  });
}

/**
 * For a deck stored with numbered card labels: give each such card a heading drawn from its own text, for display only. A card whose
 * text is too thin to say anything keeps its label (nothing is invented). Cards with real labels are never touched.
 * Returns how many labels were replaced.
 */
export function repairGenericLabels(slide: DeckSlide, deck: Pick<StudyDeck, 'concepts'>): number {
  const interaction = slide.interaction;
  if (!interaction || !(interaction.kind === 'reveal' || interaction.kind === 'steps' || interaction.kind === 'timeline' || interaction.kind === 'compare')) return 0;
  if (!interaction.items.some((item) => isGenericLabel(item.label))) return 0;

  const concept = slide.taught_concept_ids.length === 1 ? (deck.concepts[String(slide.taught_concept_ids[0])]?.name ?? '') : '';
  const taken = interaction.items.filter((item) => !isGenericLabel(item.label)).map((item) => key(item.label));
  let changed = 0;

  for (const item of interaction.items) {
    if (!isGenericLabel(item.label)) continue;
    const heading = compressHeading(item.text ?? '');
    if (heading !== null && !isGenericLabel(heading) && !taken.includes(key(heading)) && words(item.text ?? '').length >= 5) {
      item.label = heading;
      taken.push(key(heading));
      changed += 1;
    }
  }
  // A card that could not be headed from its own text takes the neutral heading only when the concept is known.
  for (const item of interaction.items) {
    if (!isGenericLabel(item.label) || concept === '') continue;
    const r = resolveHeading({ statement: item.text }, concept, taken);
    if (r.level >= 3) {
      item.label = r.title;
      taken.push(key(r.title));
      changed += 1;
    }
  }

  return changed;
}

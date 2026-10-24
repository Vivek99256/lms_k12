/**
 * A Vocabulary Class deck: the single JSON document stored in one content_master row (see the Laravel
 * `VocabularyClassDeck`). Everything here is pure, so it can be tested without React.
 */

export interface VocabularyImage {
  src: string;
  alt: string;
  caption?: string;
  credit?: string;
}

export interface VocabularyCard {
  id: string;
  /** The card number printed in the source document, kept for review; order on screen is the list order. */
  sourceNumber?: number;
  term: string;
  definition: string;
  image: VocabularyImage | null;
}

export interface VocabularyTopic {
  id: string;
  code?: string;
  chapter_id: number;
  title: string;
  cards: VocabularyCard[];
}

export interface VocabularyDeck {
  type: 'vocabulary_class';
  version: 1;
  title: string;
  topics: VocabularyTopic[];
  source?: { file?: string; note?: string; omitted?: { term: string; reason: string }[] };
}

/** A card with the topic it belongs to and its place in the whole deck. */
export interface PlayableCard extends VocabularyCard {
  topicId: string;
  topicTitle: string;
  topicNumber: number;
  chapterId: number;
  /** Zero-based position in the whole deck. */
  index: number;
}

function text(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

/**
 * Check a document and return it typed. Throws a plain-language Error when the document is not a deck the player can
 * rely on, so a half-readable deck is never shown as if it were complete.
 */
export function parseVocabularyDeck(raw: unknown): VocabularyDeck {
  const deck = raw as Partial<VocabularyDeck> | null;
  if (!deck || typeof deck !== 'object' || deck.type !== 'vocabulary_class' || deck.version !== 1) {
    throw new Error('This is not a vocabulary class.');
  }
  if (!Array.isArray(deck.topics) || deck.topics.length === 0) {
    throw new Error('This vocabulary class has no topics.');
  }
  const seen = new Set<string>();
  for (const topic of deck.topics) {
    if (!text(topic?.id) || !text(topic?.title) || !Array.isArray(topic?.cards) || topic.cards.length === 0) {
      throw new Error('A topic in this vocabulary class is incomplete.');
    }
    for (const card of topic.cards) {
      const id = text(card?.id);
      if (!id || seen.has(id) || !text(card?.term) || !text(card?.definition)) {
        throw new Error('A card in this vocabulary class is incomplete.');
      }
      seen.add(id);
      if (card.image && (!text(card.image.src) || !text(card.image.alt))) {
        throw new Error('A picture in this vocabulary class has no address.');
      }
    }
  }
  return deck as VocabularyDeck;
}

/**
 * The deck as one chapter sees it: only the topics that belong to that chapter, so a chapter never shows another
 * chapter's words. Throws when the deck has nothing for the chapter.
 */
export function deckForChapter(deck: VocabularyDeck, chapterId: number): VocabularyDeck {
  const topics = deck.topics.filter((topic) => Number(topic.chapter_id) === Number(chapterId));
  if (topics.length === 0) {
    throw new Error('There is no vocabulary for this chapter.');
  }
  return { ...deck, topics };
}

/** Every card in deck order (topic by topic, card by card), each knowing its topic. */
export function playableCards(deck: VocabularyDeck): PlayableCard[] {
  const cards: PlayableCard[] = [];
  deck.topics.forEach((topic, t) => {
    for (const card of topic.cards) {
      cards.push({
        ...card,
        image: card.image ?? null,
        topicId: topic.id,
        topicTitle: topic.title,
        topicNumber: t + 1,
        chapterId: topic.chapter_id,
        index: cards.length,
      });
    }
  });
  return cards;
}

/** Where the player opens: the first card of the topic for the chapter the learner came from, else the first card. */
export function startIndexForChapter(cards: readonly PlayableCard[], chapterId: number): number {
  const first = cards.find((card) => card.chapterId === chapterId);
  return first ? first.index : 0;
}

/** The index of the first card of a topic. */
export function firstIndexOfTopic(cards: readonly PlayableCard[], topicId: string): number {
  const first = cards.find((card) => card.topicId === topicId);
  return first ? first.index : 0;
}

/**
 * What a learner typed, made comparable: case, spacing, hyphens and surrounding punctuation do not make an answer wrong.
 */
export function normaliseAnswer(value: string): string {
  return value
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[-–—_]/g, ' ')
    .replace(/[^a-z0-9 ]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

export function isCorrectAnswer(typed: string, term: string): boolean {
  const answer = normaliseAnswer(typed);
  return answer !== '' && answer === normaliseAnswer(term);
}

/** A clue that helps without giving the word away: the first letter and how long the word is. */
export function hintFor(term: string): string {
  const words = term.trim().split(/\s+/);
  const letters = words.map((word) => `${word.length}`).join(' + ');
  const first = term.trim().charAt(0).toUpperCase();
  return words.length > 1 ? `Starts with “${first}”; ${words.length} words (${letters} letters)` : `Starts with “${first}”; ${term.trim().length} letters`;
}

export type CardResult = 'correct' | 'revealed' | undefined;

/** The score line: cards answered correctly out of the whole deck. */
export function score(results: Readonly<Record<string, CardResult>>, total: number): { correct: number; total: number; percent: number } {
  const correct = Object.values(results).filter((result) => result === 'correct').length;
  return { correct, total, percent: total === 0 ? 0 : Math.round((correct / total) * 100) };
}

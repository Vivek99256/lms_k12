'use client';

/**
 * The Chapter -> Topic -> Concept split, shared by the teacher's chapter list and
 * the student's.
 *
 * Both sections show the same hierarchy over the same chapters, so the rule for
 * when a topic level appears at all lives here rather than in either page. The
 * two differ only in what a "concept" is to them — the teacher addresses concepts
 * by their index into `content_categories`, the student by the concept row — so
 * this is generic over the concept item.
 */

export const UNGROUPED_TOPIC_ID = '__ungrouped__';

export type ChapterTopicRef = {
  id: string;
  title: string;
  description: string;
};

export type TopicGroup<TConcept> = ChapterTopicRef & {
  concepts: TConcept[];
};

/**
 * Split a chapter's concepts across its topics.
 *
 * Chapters extracted before the topic split have no topic_master rows, and even
 * where topics exist some concepts still carry no topic_id. No case may hide a
 * concept: partly-tagged chapters collect the rest under an "Other concepts" row,
 * while a chapter whose topics hold no concepts at all (no topic rows, or none of
 * its concepts tagged) returns an empty list, so the caller lists its concepts
 * directly rather than burying them behind a screen of empty topics.
 */
export function groupConceptsByTopic<TConcept>(
  topics: ReadonlyArray<ChapterTopicRef> | undefined,
  concepts: ReadonlyArray<TConcept>,
  topicIdOf: (concept: TConcept) => string | null | undefined
): Array<TopicGroup<TConcept>> {
  if (!topics || topics.length === 0) return [];

  const rows = new Map<string, TopicGroup<TConcept>>(
    topics.map((topic) => [
      topic.id,
      { id: topic.id, title: topic.title, description: topic.description, concepts: [] },
    ])
  );

  const ungrouped: TConcept[] = [];
  concepts.forEach((concept) => {
    const topicId = topicIdOf(concept);
    const row = topicId ? rows.get(String(topicId)) : undefined;
    if (row) row.concepts.push(concept);
    else ungrouped.push(concept);
  });

  // Topics that account for none of the chapter's concepts would be nothing but
  // dead ends, so the topic level only appears once the data backs it.
  if (ungrouped.length === concepts.length) return [];

  const result = Array.from(rows.values());
  if (ungrouped.length > 0) {
    result.push({
      id: UNGROUPED_TOPIC_ID,
      title: 'Other concepts',
      description: 'Concepts that are not mapped to a topic yet.',
      concepts: ungrouped,
    });
  }

  return result;
}

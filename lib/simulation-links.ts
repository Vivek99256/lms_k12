/**
 * Simulation Learning in the Prayogshala tab: the pure rules the screens rely on.
 *
 *   - what a link between a simulation and a concept is, and what the screen may send about one (`buildLinksPayload`);
 *   - how a list request is written (`buildSimulationQuery`);
 *   - who sees what (`visibleLinks`, `simulationsForChapter`, `simulationsForTopic`, `isPendingReview`);
 *   - whether the authoring controls are shown at all (`authoringAllowed`, `cardEditable`).
 *
 * Nothing here is a security boundary. The server decides who may read and who may write (tenant 1 staff only) and answers 403 to anyone
 * else; these helpers only decide what the page draws, from facts the SERVER sent (`editable`, `review_status`).
 */

export type LinkRole = 'primary' | 'supporting'
export type LinkReviewStatus = 'review' | 'published'

/** One link between a simulation and a concept, as the API returns it. The chapter, topic, standard and subject are the server's copies. */
export interface SimulationLink {
  id: number
  concept_id: number
  concept_name: string | null
  chapter_id: number | null
  chapter_name: string | null
  topic_id: number | null
  topic_name: string | null
  standard_id: number | null
  subject_id: number | null
  role: LinkRole
  citation: string | null
  reason: string | null
  review_status: LinkReviewStatus
}

export const CITATION_MAX = 255
export const REASON_MAX = 500
export const QUERY_TEXT_MAX = 100
export const LINK_ROLES: readonly LinkRole[] = ['primary', 'supporting']

/* ------------------------------------------------------------------------------------------------------------------ list queries */

/** What the list endpoint can be narrowed by. Ids that are not positive whole numbers are dropped; text is trimmed and capped. */
export interface SimulationFilter {
  chapter_id?: number | null
  topic_id?: number | null
  concept_id?: number | null
  standard_id?: number | null
  subject_id?: number | null
  q?: string | null
}

const positiveId = (value: unknown): number | null => (typeof value === 'number' && Number.isInteger(value) && value > 0 ? value : null)

/** `?chapter_id=3&q=pendulum`, or '' when nothing is set. The keys are the contract's, in a fixed order, so the same filter is the same URL. */
export function buildSimulationQuery(filter: SimulationFilter = {}): string {
  const params = new URLSearchParams()
  for (const key of ['chapter_id', 'topic_id', 'concept_id', 'standard_id', 'subject_id'] as const) {
    const id = positiveId(filter[key])
    if (id !== null) params.set(key, String(id))
  }
  const text = typeof filter.q === 'string' ? filter.q.trim().slice(0, QUERY_TEXT_MAX) : ''
  if (text !== '') params.set('q', text)
  const query = params.toString()
  return query === '' ? '' : `?${query}`
}

/** The concept picker's query: the chapter it is restricted to, and what the person typed. A picker without a chapter asks for nothing. */
export function buildConceptQuery(chapterId: number | null | undefined, q?: string | null): string | null {
  const chapter = positiveId(chapterId)
  if (chapter === null) return null
  return buildSimulationQuery({ chapter_id: chapter, q })
}

/* ------------------------------------------------------------------------------------------------------------------ link payloads */

/** A link as the editor holds it while it is being changed. */
export interface LinkDraft {
  /** Set for a link that already exists on the server. */
  id?: number
  concept_id: number
  /** For display only; never sent. */
  concept_name?: string | null
  topic_name?: string | null
  chapter_id?: number | null
  chapter_name?: string | null
  role: LinkRole
  citation: string
  reason: string
  /** The server's review state of an existing link; never sent (the server keeps it for an unchanged link and starts a new one in review). */
  review_status?: LinkReviewStatus
}

export interface LinkPayloadItem {
  concept_id: number
  role: LinkRole
  citation?: string
  reason?: string
  sort_order: number
}

export function draftsFromLinks(links: readonly SimulationLink[]): LinkDraft[] {
  return links.map((link) => ({
    id: link.id,
    concept_id: link.concept_id,
    concept_name: link.concept_name,
    topic_name: link.topic_name,
    chapter_id: link.chapter_id,
    chapter_name: link.chapter_name,
    role: link.role === 'supporting' ? 'supporting' : 'primary',
    citation: link.citation ?? '',
    reason: link.reason ?? '',
    review_status: link.review_status,
  }))
}

/** What is wrong with a set of drafts, one sentence each; empty when the set may be saved. */
export function linkDraftProblems(drafts: readonly LinkDraft[]): string[] {
  const problems: string[] = []
  const seen = new Set<number>()
  for (const draft of drafts) {
    const name = draft.concept_name?.trim() || `Concept ${draft.concept_id}`
    if (!positiveId(draft.concept_id)) problems.push(`${name} is not a valid concept.`)
    if (seen.has(draft.concept_id)) problems.push(`${name} is linked more than once.`)
    seen.add(draft.concept_id)
    if (draft.citation.trim().length > CITATION_MAX) problems.push(`The textbook section for ${name} is longer than ${CITATION_MAX} characters.`)
    if (draft.reason.trim().length > REASON_MAX) problems.push(`The reason for ${name} is longer than ${REASON_MAX} characters.`)
  }
  return problems
}

/**
 * The body of PUT /{id}/links. It carries ONLY the concept id, the role, the two texts and the order: the chapter, topic, standard and
 * subject are worked out by the server from the concept, and the review status is the server's, so none of them can be sent from here.
 * A concept named twice is sent once (the first wins), blank texts are left out, and the order is the order of the list.
 */
export function buildLinksPayload(drafts: readonly LinkDraft[]): { links: LinkPayloadItem[] } {
  const seen = new Set<number>()
  const links: LinkPayloadItem[] = []
  for (const draft of drafts) {
    const conceptId = positiveId(draft.concept_id)
    if (conceptId === null || seen.has(conceptId)) continue
    seen.add(conceptId)
    const citation = draft.citation.trim().slice(0, CITATION_MAX)
    const reason = draft.reason.trim().slice(0, REASON_MAX)
    links.push({
      concept_id: conceptId,
      role: draft.role === 'supporting' ? 'supporting' : 'primary',
      ...(citation !== '' ? { citation } : {}),
      ...(reason !== '' ? { reason } : {}),
      sort_order: links.length,
    })
  }
  return { links }
}

/** Whether the drafts differ from the links the server holds, in anything the person can change (so Save is offered only when it means something). */
export function linksChanged(drafts: readonly LinkDraft[], saved: readonly SimulationLink[]): boolean {
  if (drafts.length !== saved.length) return true
  const byConcept = new Map(saved.map((link) => [link.concept_id, link]))
  return drafts.some((draft, index) => {
    const link = byConcept.get(draft.concept_id)
    if (!link || saved[index]?.concept_id !== draft.concept_id) return true
    return link.role !== draft.role || (link.citation ?? '').trim() !== draft.citation.trim() || (link.reason ?? '').trim() !== draft.reason.trim()
  })
}

/* ------------------------------------------------------------------------------------------------------------------ who sees what */

export const isPendingReview = (link: Pick<SimulationLink, 'review_status'>): boolean => link.review_status !== 'published'

/** The words of the flag drawn on a simulation that no published link maps to a concept and topic yet. */
export const NOT_MAPPED_LABEL = 'Not mapped yet to a concept and topic'

/** True only on the server's word (`mapped: false`): an answer without the field is never flagged. */
export const isUnmapped = (card: { mapped?: boolean | null }): boolean => card.mapped === false

/** Mapped simulations first, the unmapped (flagged) ones after them; within each group the order the server gave. */
export function mappedFirst<C extends { mapped?: boolean | null }>(cards: readonly C[]): C[] {
  return [...cards].sort((a, b) => Number(isUnmapped(a)) - Number(isUnmapped(b)))
}

/** A learner sees published links only; staff also see the ones still in review (drawn as pending). The server already filters; this keeps the page honest if it ever did not. */
export function visibleLinks<L extends Pick<SimulationLink, 'review_status'>>(links: readonly L[] | null | undefined, staff: boolean): L[] {
  return (links ?? []).filter((link) => staff || !isPendingReview(link))
}

interface Linked {
  links?: readonly SimulationLink[] | null
  mapped?: boolean | null
}

/** Simulations with at least one visible link satisfying `match`, in the order given. */
function withLink<C extends Linked>(cards: readonly C[], staff: boolean, match: (link: SimulationLink) => boolean): C[] {
  return cards.filter((card) => visibleLinks(card.links, staff).some(match))
}

/** Mirrors the server's chapter filter: the simulations linked to this chapter, plus every one NOT MAPPED yet (they show in every chapter, flagged). */
export const simulationsForChapter = <C extends Linked>(cards: readonly C[], chapterId: number, staff: boolean): C[] =>
  cards.filter((card) => isUnmapped(card) || visibleLinks(card.links, staff).some((link) => link.chapter_id === chapterId))

export const simulationsForTopic = <C extends Linked>(cards: readonly C[], topicId: number, staff: boolean): C[] =>
  withLink(cards, staff, (link) => link.topic_id === topicId)

/** The concept chips of a card within a scope (the chapter, or the topic): primary before supporting, then by name; one chip per concept. */
export function conceptChipsFor(
  card: Linked,
  scope: { chapterId?: number | null; topicId?: number | null },
  staff: boolean,
): SimulationLink[] {
  const inScope = visibleLinks(card.links, staff).filter(
    (link) => (scope.topicId == null || link.topic_id === scope.topicId) && (scope.chapterId == null || link.chapter_id === scope.chapterId),
  )
  const unique = new Map<number, SimulationLink>()
  for (const link of inScope) if (!unique.has(link.concept_id)) unique.set(link.concept_id, link)
  const rank = (link: SimulationLink) => (link.role === 'primary' ? 0 : 1)
  return [...unique.values()].sort((a, b) => rank(a) - rank(b) || (a.concept_name ?? '').localeCompare(b.concept_name ?? ''))
}

/** How many of a card's links in a scope still wait for a reviewer; always 0 for a learner (they never receive such links). */
export function pendingReviewCount(card: Linked, scope: { chapterId?: number | null; topicId?: number | null }, staff: boolean): number {
  if (!staff) return 0
  return conceptChipsFor(card, scope, true).filter(isPendingReview).length
}

/* ------------------------------------------------------------------------------------------------------------------ authoring gate */

/**
 * Whether the page draws the authoring controls (Add simulation). It is decided only from what the SERVER said: the list's own `editable`
 * flag, a card the server marked `editable`, or a successful answer to the author-only `limits` call (`probe`). Never from a role or tenant
 * the page guessed. `false` in the list is the server's explicit "no" and is not overridden. Even when this is true every write is checked
 * again on the server, which answers 403 to anyone outside the platform tenant.
 */
export function authoringAllowed({
  listEditable,
  cards,
  probe,
}: {
  listEditable?: boolean | null
  cards: readonly { editable?: boolean | null }[]
  probe?: boolean | null
}): boolean {
  if (listEditable === true) return true
  if (listEditable === false) return false
  return cards.some((card) => card.editable === true) || probe === true
}

/** Whether one card's author controls (Edit, Link to concepts, Remove) show. A card the server marked decides for itself; otherwise the list-wide answer stands. */
export function cardEditable(card: { editable?: boolean | null }, authoring: boolean): boolean {
  return typeof card.editable === 'boolean' ? card.editable : authoring
}

/** Whether the page should ask the server the author-only question: only a person the permission model lets create content, and only when the list did not already say. */
export function shouldProbeAuthoring({ canCreateContent, listEditable, cards }: { canCreateContent: boolean | undefined; listEditable?: boolean | null; cards: readonly { editable?: boolean | null }[] }): boolean {
  if (canCreateContent !== true) return false
  if (typeof listEditable === 'boolean') return false
  return !cards.some((card) => card.editable === true)
}

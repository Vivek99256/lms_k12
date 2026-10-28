/**
 * Simulation Learning in the Prayogshala tab: the pure rules behind the screens, checked without a browser.
 *
 *  - the list query (which ids and text are sent, in what order, and what is dropped);
 *  - the body of PUT /{id}/links (only what the contract lets the client say; never the chapter, topic, standard, subject or review status);
 *  - who sees what (a learner sees published links; staff also see links in review, marked pending);
 *  - whether the authoring controls are drawn (only from what the server said).
 */
import { strict as assert } from 'node:assert'
import { describe, it } from 'node:test'

import { coverSrc } from './simulation-format'
import {
  CITATION_MAX,
  REASON_MAX,
  authoringAllowed,
  buildConceptQuery,
  buildLinksPayload,
  buildSimulationQuery,
  cardEditable,
  conceptChipsFor,
  draftsFromLinks,
  isPendingReview,
  linkDraftProblems,
  linksChanged,
  pendingReviewCount,
  shouldProbeAuthoring,
  simulationsForChapter,
  simulationsForTopic,
  visibleLinks,
  type LinkDraft,
  type SimulationLink,
} from './simulation-links'

const link = (over: Partial<SimulationLink> = {}): SimulationLink => ({
  id: 1,
  concept_id: 10,
  concept_name: 'Time period of a pendulum',
  chapter_id: 100,
  chapter_name: 'Oscillations',
  topic_id: 1000,
  topic_name: 'Pendulum',
  standard_id: 7,
  subject_id: 3,
  role: 'primary',
  citation: null,
  reason: null,
  review_status: 'published',
  ...over,
})

const draft = (over: Partial<LinkDraft> = {}): LinkDraft => ({ concept_id: 10, role: 'primary', citation: '', reason: '', ...over })

describe('the list query', () => {
  it('is empty when nothing is asked, and names each filter once, in a fixed order', () => {
    assert.equal(buildSimulationQuery(), '')
    assert.equal(buildSimulationQuery({}), '')
    assert.equal(buildSimulationQuery({ q: 'pendulum', chapter_id: 3, topic_id: 9 }), '?chapter_id=3&topic_id=9&q=pendulum')
    assert.equal(buildSimulationQuery({ subject_id: 2, standard_id: 8, concept_id: 5, chapter_id: 3 }), '?chapter_id=3&concept_id=5&standard_id=8&subject_id=2')
  })

  it('drops an id that is not a positive whole number, so a bad value never reaches the server', () => {
    for (const bad of [0, -1, 1.5, Number.NaN, Number.POSITIVE_INFINITY, null, undefined]) {
      assert.equal(buildSimulationQuery({ chapter_id: bad as number }), '', String(bad))
    }
  })

  it('trims the text, drops blank text, caps its length and encodes it', () => {
    assert.equal(buildSimulationQuery({ q: '   ' }), '')
    assert.equal(buildSimulationQuery({ q: '  a b&c=d  ' }), '?q=a+b%26c%3Dd')
    assert.equal(buildSimulationQuery({ q: 'x'.repeat(500) }), `?q=${'x'.repeat(100)}`)
  })

  it('writes the concept picker query only for a chapter', () => {
    assert.equal(buildConceptQuery(3, 'ey'), '?chapter_id=3&q=ey')
    assert.equal(buildConceptQuery(3), '?chapter_id=3')
    assert.equal(buildConceptQuery(null, 'ey'), null)
    assert.equal(buildConceptQuery(0), null)
  })
})

describe('the body of a links save', () => {
  it('carries the concept, role, texts and order, and nothing the server works out', () => {
    const body = buildLinksPayload([
      draft({ id: 5, concept_id: 10, concept_name: 'Time period', chapter_id: 100, chapter_name: 'X', topic_name: 'T', review_status: 'published', citation: ' 3.2 ', reason: ' Because. ' }),
      draft({ concept_id: 11, role: 'supporting' }),
    ])
    assert.deepEqual(body, {
      links: [
        { concept_id: 10, role: 'primary', citation: '3.2', reason: 'Because.', sort_order: 0 },
        { concept_id: 11, role: 'supporting', sort_order: 1 },
      ],
    })
    const keys = new Set(body.links.flatMap((item) => Object.keys(item)))
    for (const forbidden of ['id', 'chapter_id', 'topic_id', 'standard_id', 'subject_id', 'review_status', 'reviewed_by', 'concept_name', 'sub_institute_id']) {
      assert.ok(!keys.has(forbidden), `${forbidden} must not be sent`)
    }
  })

  it('sends a concept once (the first wins), skips an invalid id, and keeps the order of the list', () => {
    const body = buildLinksPayload([draft({ concept_id: 11, reason: 'first' }), draft({ concept_id: 0 }), draft({ concept_id: 12 }), draft({ concept_id: 11, reason: 'second' })])
    assert.deepEqual(
      body.links.map((item) => [item.concept_id, item.sort_order, item.reason]),
      [
        [11, 0, 'first'],
        [12, 1, undefined],
      ],
    )
  })

  it('turns an unknown role into primary and cuts the texts to the column sizes', () => {
    const body = buildLinksPayload([draft({ role: 'owner' as never, citation: 'c'.repeat(400), reason: 'r'.repeat(900) })])
    assert.equal(body.links[0].role, 'primary')
    assert.equal(body.links[0].citation?.length, CITATION_MAX)
    assert.equal(body.links[0].reason?.length, REASON_MAX)
  })

  it('sends an empty set as an empty list (that removes every link)', () => {
    assert.deepEqual(buildLinksPayload([]), { links: [] })
  })

  it('names what is wrong before a save is sent', () => {
    assert.deepEqual(linkDraftProblems([draft()]), [])
    assert.equal(linkDraftProblems([draft({ concept_name: 'A' }), draft({ concept_name: 'A' })]).length, 1)
    assert.match(linkDraftProblems([draft({ concept_name: 'A', citation: 'c'.repeat(CITATION_MAX + 1) })])[0], /textbook section for A/)
    assert.match(linkDraftProblems([draft({ concept_name: 'A', reason: 'r'.repeat(REASON_MAX + 1) })])[0], /reason for A/)
    assert.match(linkDraftProblems([draft({ concept_id: 0 })])[0], /not a valid concept/)
  })

  it('reads the saved links back into drafts and sees whether anything changed', () => {
    const saved = [link({ id: 1, concept_id: 10, citation: '3.2', reason: 'r' }), link({ id: 2, concept_id: 11, role: 'supporting' })]
    const drafts = draftsFromLinks(saved)
    assert.deepEqual(drafts[0], {
      id: 1,
      concept_id: 10,
      concept_name: 'Time period of a pendulum',
      topic_name: 'Pendulum',
      chapter_id: 100,
      chapter_name: 'Oscillations',
      role: 'primary',
      citation: '3.2',
      reason: 'r',
      review_status: 'published',
    })
    assert.equal(linksChanged(drafts, saved), false)
    assert.equal(linksChanged([drafts[0]], saved), true, 'a link was removed')
    assert.equal(linksChanged([...drafts, draft({ concept_id: 12 })], saved), true, 'a link was added')
    assert.equal(linksChanged([{ ...drafts[0], role: 'supporting' }, drafts[1]], saved), true, 'a role changed')
    assert.equal(linksChanged([{ ...drafts[0], citation: ' 3.2 ' }, drafts[1]], saved), false, 'spaces are not a change')
    assert.equal(linksChanged([drafts[1], drafts[0]], saved), true, 'the order changed')
  })
})

describe('who sees which links', () => {
  const published = link({ id: 1, concept_id: 10 })
  const review = link({ id: 2, concept_id: 11, review_status: 'review' })

  it('shows a learner published links only, and staff the ones in review too', () => {
    assert.deepEqual(visibleLinks([published, review], false), [published])
    assert.deepEqual(visibleLinks([published, review], true), [published, review])
    assert.deepEqual(visibleLinks(undefined, true), [])
    assert.equal(isPendingReview(review), true)
    assert.equal(isPendingReview(published), false)
  })

  it('finds the simulations of a chapter or a topic through links the viewer may see', () => {
    const pendulum = { id: 1, links: [published] }
    const inReview = { id: 2, links: [review] }
    const elsewhere = { id: 3, links: [link({ id: 3, chapter_id: 200, topic_id: 2000 })] }
    const unlinked = { id: 4, links: [] as SimulationLink[] }
    const all = [pendulum, inReview, elsewhere, unlinked]
    assert.deepEqual(simulationsForChapter(all, 100, false).map((c) => c.id), [1])
    assert.deepEqual(simulationsForChapter(all, 100, true).map((c) => c.id), [1, 2])
    assert.deepEqual(simulationsForTopic(all, 1000, false).map((c) => c.id), [1])
    assert.deepEqual(simulationsForTopic(all, 1000, true).map((c) => c.id), [1, 2])
    assert.deepEqual(simulationsForTopic(all, 2000, true).map((c) => c.id), [3])
    assert.deepEqual(simulationsForChapter(all, 999, true), [])
  })

  it('draws one chip per concept, main concepts first, within the scope asked', () => {
    const card = {
      links: [
        link({ id: 1, concept_id: 12, concept_name: 'Zeta', role: 'supporting' }),
        link({ id: 2, concept_id: 10, concept_name: 'Beta', role: 'primary' }),
        link({ id: 3, concept_id: 11, concept_name: 'Alpha', role: 'primary' }),
        link({ id: 4, concept_id: 10, concept_name: 'Beta', role: 'primary' }),
        link({ id: 5, concept_id: 13, concept_name: 'Other chapter', chapter_id: 200, topic_id: 2000 }),
        link({ id: 6, concept_id: 14, concept_name: 'Draft concept', review_status: 'review' }),
      ],
    }
    assert.deepEqual(conceptChipsFor(card, { chapterId: 100 }, false).map((l) => l.concept_name), ['Alpha', 'Beta', 'Zeta'])
    assert.deepEqual(conceptChipsFor(card, { chapterId: 100 }, true).map((l) => l.concept_name), ['Alpha', 'Beta', 'Draft concept', 'Zeta'])
    assert.deepEqual(conceptChipsFor(card, { topicId: 2000 }, false).map((l) => l.concept_name), ['Other chapter'])
    assert.equal(conceptChipsFor(card, {}, false).length, 4)
  })

  it('counts pending links for staff and never for a learner', () => {
    const card = { links: [link({ id: 1, concept_id: 10 }), link({ id: 2, concept_id: 11, review_status: 'review' }), link({ id: 3, concept_id: 12, review_status: 'review' })] }
    assert.equal(pendingReviewCount(card, { chapterId: 100 }, true), 2)
    assert.equal(pendingReviewCount(card, { chapterId: 100 }, false), 0)
    assert.equal(pendingReviewCount(card, { chapterId: 999 }, true), 0)
  })
})

describe('whether the authoring controls are drawn', () => {
  it('follows the list\'s own flag, a card the server marked editable, or the server\'s answer to the author-only call', () => {
    assert.equal(authoringAllowed({ listEditable: true, cards: [] }), true)
    assert.equal(authoringAllowed({ cards: [{ editable: true }] }), true)
    assert.equal(authoringAllowed({ cards: [], probe: true }), true)
  })

  it('is off by default and for every answer that is not a clear yes', () => {
    assert.equal(authoringAllowed({ cards: [] }), false)
    assert.equal(authoringAllowed({ cards: [{ editable: false }, {}] }), false)
    assert.equal(authoringAllowed({ cards: [], probe: false }), false)
    assert.equal(authoringAllowed({ cards: [], probe: null }), false)
    assert.equal(authoringAllowed({ listEditable: null, cards: [] }), false)
  })

  it('does not let a probe or a card override the list\'s explicit no', () => {
    assert.equal(authoringAllowed({ listEditable: false, cards: [{ editable: true }], probe: true }), false)
  })

  it('lets a card decide for itself, and falls back to the list-wide answer only for a card that does not say', () => {
    assert.equal(cardEditable({ editable: false }, true), false)
    assert.equal(cardEditable({ editable: true }, false), true)
    assert.equal(cardEditable({}, true), true)
    assert.equal(cardEditable({ editable: undefined }, false), false)
  })

  it('asks the server only on behalf of a person who may create content and only when the list did not say', () => {
    assert.equal(shouldProbeAuthoring({ canCreateContent: true, cards: [] }), true)
    assert.equal(shouldProbeAuthoring({ canCreateContent: false, cards: [] }), false)
    assert.equal(shouldProbeAuthoring({ canCreateContent: undefined, cards: [] }), false)
    assert.equal(shouldProbeAuthoring({ canCreateContent: true, listEditable: false, cards: [] }), false)
    assert.equal(shouldProbeAuthoring({ canCreateContent: true, listEditable: true, cards: [] }), false)
    assert.equal(shouldProbeAuthoring({ canCreateContent: true, cards: [{ editable: true }] }), false)
  })
})

describe('the cover address', () => {
  it('accepts a path under this site and an https address, and nothing else', () => {
    assert.equal(coverSrc('simulations/covers/pendulum-lab.webp'), '/simulations/covers/pendulum-lab.webp')
    assert.equal(coverSrc('/simulations/covers/eye-lab.webp'), '/simulations/covers/eye-lab.webp')
    assert.equal(coverSrc('https://cdn.example.org/a.webp'), 'https://cdn.example.org/a.webp')
    for (const bad of ['javascript:alert(1)', 'data:image/svg+xml;base64,AAAA', 'http://example.org/a.webp', '//evil.example/a.webp', '../secret.png', 'a/../../b.png', '', '   ', null, undefined]) {
      assert.equal(coverSrc(bad), null, String(bad))
    }
  })
})

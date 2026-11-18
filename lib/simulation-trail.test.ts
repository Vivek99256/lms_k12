/**
 * The player's Standard -> Subject -> Chapter -> Topic trail: built from what the page and the simulation's links already say, leaving out
 * whatever is not known.
 */
import { strict as assert } from 'node:assert'
import { describe, it } from 'node:test'

import { buildSimulationTrail, standardLabel, topicNamesFor } from './simulation-trail'

const link = (chapter_id: number | null, topic_name: string | null) => ({ chapter_id, topic_name })

describe('buildSimulationTrail', () => {
  it('gives the full trail, in order', () => {
    const trail = buildSimulationTrail({
      standard: '9',
      subject: 'Science',
      chapter: 'Describing Motion Around Us',
      chapterId: 8600,
      links: [link(8600, 'Oscillatory Motion')],
    })
    assert.deepEqual(
      trail.map((s) => [s.kind, s.label]),
      [
        ['standard', 'Class 9'],
        ['subject', 'Science'],
        ['chapter', 'Describing Motion Around Us'],
        ['topic', 'Oscillatory Motion'],
      ],
    )
  })

  it('names the topic only from links to the chapter it was opened from', () => {
    const trail = buildSimulationTrail({ standard: '9', subject: 'Science', chapter: 'Motion', chapterId: 1, links: [link(2, 'Elsewhere')] })
    assert.deepEqual(trail.map((s) => s.kind), ['standard', 'subject', 'chapter'])
  })

  it('shortens several topics and keeps them all in the tooltip', () => {
    const trail = buildSimulationTrail({ chapter: 'C', chapterId: 5, links: [link(5, 'A'), link(5, 'B'), link(5, 'A'), link(5, 'C')] })
    const topic = trail.find((s) => s.kind === 'topic')
    assert.equal(topic?.label, 'A +2 more')
    assert.equal(topic?.title, 'A · B · C')
  })

  it('leaves out what is not known and never throws', () => {
    assert.deepEqual(buildSimulationTrail({}), [])
    assert.deepEqual(buildSimulationTrail({ subject: '  Science  ', standard: '', chapter: null }).map((s) => s.label), ['Science'])
    assert.doesNotThrow(() => buildSimulationTrail({ links: [link(null, null)], chapterId: null }))
  })
})

describe('helpers', () => {
  it('labels standards', () => {
    assert.equal(standardLabel('10'), 'Class 10')
    assert.equal(standardLabel('CBSE-SR'), 'CBSE-SR')
    assert.equal(standardLabel(' Class 9 '), 'Class 9')
    assert.equal(standardLabel(null), '')
  })
  it('lists distinct topic names for a chapter', () => {
    assert.deepEqual(topicNamesFor([link(1, 'X'), link(1, ' X '), link(2, 'Y')], 1), ['X'])
    assert.deepEqual(topicNamesFor(undefined, 1), [])
  })
})

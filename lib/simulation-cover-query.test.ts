/**
 * Cover search phrases: a simulation / chapter / topic name becomes photo phrases that fit it, deterministically, with sensible fallbacks.
 */
import { strict as assert } from 'node:assert'
import { describe, it } from 'node:test'

import { buildCoverQueries, coverRouteUrl, readCoverParams } from './simulation-cover-query'

describe('buildCoverQueries', () => {
  it('pictures the four existing labs by what they are', () => {
    assert.equal(buildCoverQueries({ title: 'Pendulum Lab' })[0], 'pendulum swinging')
    assert.equal(buildCoverQueries({ title: 'Projectile Lab' })[0], 'cannon ball')
    assert.equal(buildCoverQueries({ title: 'Ramp Lab', subtitle: 'A baseball on a plank' })[0], 'ball rolling ramp')
    assert.equal(buildCoverQueries({ title: 'How the Eye Sees', subtitle: 'Light, lens and retina' })[0], 'human eye close up')
  })

  it('reads the simulation name before its chapter', () => {
    const q = buildCoverQueries({ title: 'Pendulum Lab', chapter: 'Describing Motion Around Us', subject: 'Science' })
    assert.equal(q[0], 'pendulum swinging')
  })

  it('works for a topic nobody listed, from its name alone', () => {
    assert.equal(buildCoverQueries({ title: 'Photosynthesis in Leaves' })[0], 'green leaf sunlight')
    assert.equal(buildCoverQueries({ chapter: 'The Making of the National Movement: 1870s-1947' })[0], 'historic fort architecture')
    assert.equal(buildCoverQueries({ chapter: 'Linear Equations in One Variable', subject: 'Mathematics' })[0], 'chalkboard mathematics equations')
  })

  it('falls back to the plain words, then the subject, then a classroom', () => {
    const q = buildCoverQueries({ title: 'Zorblax Quantum', subject: 'Science' })
    assert.deepEqual(q.slice(0, 1), ['zorblax quantum'])
    assert.ok(q.includes('science laboratory experiment'))
    assert.equal(q[q.length - 1], 'school classroom learning')
    assert.deepEqual(buildCoverQueries({}), ['school classroom learning'])
  })

  it('is deterministic, de-duplicated and bounded', () => {
    const ctx = { title: 'Sound and light waves', tags: ['wave', 'light', 'sound'] }
    assert.deepEqual(buildCoverQueries(ctx), buildCoverQueries(ctx))
    const q = buildCoverQueries(ctx)
    assert.equal(new Set(q).size, q.length)
    assert.ok(q.length <= 6)
    assert.ok(q.every((p) => p.length <= 80))
  })

  it('survives junk input', () => {
    assert.doesNotThrow(() => buildCoverQueries({ title: 'x'.repeat(5000), tags: ['', '  ', 'a'.repeat(900)] }))
    assert.doesNotThrow(() => buildCoverQueries({ title: null, subtitle: undefined, tags: null }))
  })
})

describe('coverRouteUrl / readCoverParams', () => {
  it('round-trips and gives equal topics one address', () => {
    const ctx = { title: 'Pendulum Lab', category: 'Physics', tags: ['pendulum', 'motion'], chapter: 'Motion' }
    const url = coverRouteUrl(ctx)
    assert.ok(url.startsWith('/api/sim-cover?'))
    const back = readCoverParams(new URL(url, 'https://x.test').searchParams)
    assert.equal(back.title, 'Pendulum Lab')
    assert.deepEqual(back.tags, ['pendulum', 'motion'])
    assert.equal(coverRouteUrl({ ...ctx }), url)
  })

  it('leaves out what is empty', () => {
    assert.equal(coverRouteUrl({ title: 'A' }), '/api/sim-cover?t=A')
  })
})

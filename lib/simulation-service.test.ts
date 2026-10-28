/**
 * Simulation Learning API client: what is sent, with which credentials, and how answers are read - checked against a stubbed `fetch`.
 *
 *  - every call carries the learner's bearer token and names no tenant or user (the server reads both from the token);
 *  - a call without a session never reaches the network;
 *  - the list, the card and the links are read defensively (either envelope, missing lists, junk links);
 *  - the write calls send exactly the contract's bodies, and a 403 reaches the screen as an error with the server's sentence;
 *  - the token never travels toward the sandboxed frame: the messages built from a downloaded file carry bytes, a kind, a type and a credit only.
 */
import { strict as assert } from 'node:assert'
import { afterEach, beforeEach, describe, it } from 'node:test'

import { SimulationApiError, readCard, readLinks, readList, simulationService } from '../app/course-master/data/simulations'
import { answerAssetRequest, createAssetLoader, type HostMessage } from './simulation-host'

const A = 'a'.repeat(64)
const TOKEN = 'secret-learner-token-123'

function signIn(token: string | null = TOKEN): void {
  const store: Record<string, string> = token ? { userData: JSON.stringify({ user_token: token, sub_institute_id: '7', user_id: '42' }) } : {}
  const storage = { getItem: (key: string) => store[key] ?? null }
  const stubs = { window: { location: { hostname: 'localhost' } }, localStorage: storage, sessionStorage: storage }
  for (const [name, value] of Object.entries(stubs)) Object.defineProperty(globalThis, name, { value, configurable: true, writable: true })
}

type Call = { url: URL; init: RequestInit; headers: Headers }
const realFetch = globalThis.fetch
const calls: Call[] = []
const respondWith = (make: () => Response) => {
  calls.length = 0
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    calls.push({ url: new URL(typeof input === 'string' ? input : input instanceof URL ? input.href : input.url, 'http://localhost'), init: init ?? {}, headers: new Headers(init?.headers) })
    return make()
  }) as typeof fetch
}
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })

const wire = (over: Record<string, unknown> = {}) => ({
  id: 3,
  slug: 'pendulum-lab',
  title: 'Pendulum Lab',
  minutes: 15,
  difficulty: 'intro',
  cover_url: 'simulations/covers/pendulum-lab.webp',
  status: 'published',
  version: 2,
  missions: 2,
  tags: ['pendulum'],
  editable: false,
  progress: { status: 'in_progress', percent: 40, step: 2 },
  links: [{ id: 9, concept_id: 10, concept_name: 'Time period', chapter_id: 100, topic_id: 1000, role: 'primary', review_status: 'published' }],
  ...over,
})

beforeEach(() => signIn())
afterEach(() => {
  globalThis.fetch = realFetch
})

describe('the credentials of a call', () => {
  it('sends the bearer token to the API and names no tenant or user anywhere', async () => {
    respondWith(() => json({ success: true, data: [wire()] }))
    await simulationService.list({ chapter_id: 100 })
    assert.equal(calls.length, 1)
    assert.equal(calls[0].headers.get('authorization'), `Bearer ${TOKEN}`)
    assert.equal(calls[0].url.pathname, '/api/lms/prayogshala/simulations')
    assert.equal(calls[0].url.search, '?chapter_id=100')
    assert.equal(calls[0].init.method, 'GET')
    assert.equal(calls[0].init.body, undefined)
    for (const name of ['sub_institute_id', 'user_id', 'tenant', 'institute_id']) {
      assert.ok(!calls[0].url.search.includes(name), `${name} must not be in the address`)
    }
  })

  it('never reaches the network without a session', async () => {
    signIn(null)
    respondWith(() => json({ success: true, data: [] }))
    await assert.rejects(simulationService.list(), (err: unknown) => err instanceof SimulationApiError && err.status === 401)
    await assert.rejects(simulationService.putLinks(3, []), (err: unknown) => err instanceof SimulationApiError && err.status === 401)
    assert.equal(calls.length, 0)
  })
})

describe('reading the answers', () => {
  it('reads a list that is a bare array or an object with `simulations` and a list-wide `editable`', async () => {
    respondWith(() => json({ success: true, data: [wire({ id: 1 }), wire({ id: 2, editable: true })] }))
    const bare = await simulationService.list()
    assert.deepEqual(bare.simulations.map((c) => [c.id, c.editable]), [[1, false], [2, true]])
    assert.equal(bare.editable, undefined)
    respondWith(() => json({ success: true, data: { simulations: [wire()], editable: true } }))
    const wrapped = await simulationService.list()
    assert.equal(wrapped.simulations.length, 1)
    assert.equal(wrapped.editable, true)
  })

  it('also understands the hp_erp and Prayogshala spellings of the envelope', async () => {
    respondWith(() => json({ status: true, data: [wire()] }))
    assert.equal((await simulationService.list()).simulations.length, 1)
    respondWith(() => json({ status_code: 1, data: [wire()] }))
    assert.equal((await simulationService.list()).simulations.length, 1)
  })

  it('fills in what the server left out and drops what is not a simulation or a link', () => {
    const card = readCard({ id: 5, title: 'Bare', links: [{ id: 1 }, { concept_id: 3 }, { id: 2, concept_id: 4, role: 'owner', review_status: 'whatever' }, 'junk', null] })
    assert.deepEqual(card.tags, [])
    assert.equal(card.status, 'published')
    assert.equal(card.progress, null)
    assert.equal(card.editable, undefined)
    assert.equal(card.links.length, 1)
    assert.equal(card.links[0].role, 'primary')
    assert.equal(card.links[0].review_status, 'review', 'anything but "published" is still waiting')
    assert.deepEqual(readList({ simulations: [{ title: 'no id' }, { id: 1 }] }).simulations.map((c) => c.id), [1])
    assert.deepEqual(readLinks('nope'), [])
    assert.equal(readLinks({ links: [{ id: 1, concept_id: 2 }] }).length, 1)
  })

  it('reads the backend list flag `can_manage`, also for an EMPTY library where no card can say `editable`', () => {
    assert.equal(readList({ simulations: [], can_manage: true }).editable, true)
    assert.equal(readList({ simulations: [], can_manage: false }).editable, false)
    assert.equal(readList({ simulations: [], editable: true }).editable, true, 'the older spelling still works')
    assert.equal(readList({ simulations: [], can_manage: false, editable: true }).editable, false, 'can_manage wins')
    assert.equal(readList({ simulations: [] }).editable, undefined, 'no flag at all stays unknown (the probe decides)')
  })

  it('keeps progress inside 0 to 100 and whole', () => {
    assert.equal(readCard({ id: 1, progress: { status: 'in_progress', percent: 250, step: -3 } }).progress?.percent, 100)
    assert.equal(readCard({ id: 1, progress: { status: 'in_progress', percent: 250, step: -3 } }).progress?.step, 0)
    assert.equal(readCard({ id: 1, progress: { status: 'completed', percent: 33.6, step: 2.4 } }).progress?.percent, 34)
  })
})

describe('the write calls', () => {
  it('replaces the links with exactly the contract\'s body', async () => {
    respondWith(() => json({ success: true, data: [{ id: 9, concept_id: 10 }] }))
    const links = await simulationService.putLinks(3, [{ concept_id: 10, role: 'primary', citation: '3.2', sort_order: 0 }])
    assert.equal(calls[0].init.method, 'PUT')
    assert.equal(calls[0].url.pathname, '/api/lms/prayogshala/simulations/3/links')
    assert.deepEqual(JSON.parse(String(calls[0].init.body)), { links: [{ concept_id: 10, role: 'primary', citation: '3.2', sort_order: 0 }] })
    assert.equal(calls[0].headers.get('content-type'), 'application/json')
    assert.equal(links[0].concept_id, 10)
  })

  it('publishes or unpublishes a link by its own address', async () => {
    respondWith(() => json({ success: true, data: {} }))
    await simulationService.reviewLink(3, 9, 'published')
    assert.equal(calls[0].init.method, 'POST')
    assert.equal(calls[0].url.pathname, '/api/lms/prayogshala/simulations/3/links/9/review')
    assert.deepEqual(JSON.parse(String(calls[0].init.body)), { status: 'published' })
  })

  it('asks the concept picker for one chapter and returns nothing for no chapter', async () => {
    respondWith(() => json({ success: true, data: [{ id: 10, name: 'Time period', topic_id: 1000, topic_name: 'Pendulum', chapter_id: 100, review_status: 'flagged' }, { name: 'no id' }] }))
    const found = await simulationService.concepts(100, 'time')
    assert.equal(calls[0].url.pathname, '/api/lms/prayogshala/simulations/concepts')
    assert.equal(calls[0].url.search, '?chapter_id=100&q=time')
    assert.deepEqual(found, [{ id: 10, name: 'Time period', topic_id: 1000, topic_name: 'Pendulum', chapter_id: 100, review_status: 'flagged' }])
    calls.length = 0
    assert.deepEqual(await simulationService.concepts(0), [])
    assert.equal(calls.length, 0)
  })

  it('sends a new simulation and its changes to the contract\'s addresses', async () => {
    respondWith(() => json({ success: true, data: wire({ id: 8 }) }, 201))
    const created = await simulationService.create({ spec: { schema: 'g2g.sim/1' }, status: 'draft' })
    assert.equal(created.id, 8)
    assert.equal(calls[0].init.method, 'POST')
    assert.equal(calls[0].url.pathname, '/api/lms/prayogshala/simulations')
    respondWith(() => json({ success: true, data: wire() }))
    await simulationService.update(3, { status: 'published' })
    assert.equal(calls[0].init.method, 'PUT')
    assert.equal(calls[0].url.pathname, '/api/lms/prayogshala/simulations/3')
    respondWith(() => json({ success: true, data: { id: 3, deleted: true } }))
    await simulationService.remove(3)
    assert.equal(calls[0].init.method, 'DELETE')
    respondWith(() => json({ success: true, data: wire() }))
    await simulationService.restore(3)
    assert.equal(calls[0].url.pathname, '/api/lms/prayogshala/simulations/3/restore')
    assert.equal(calls[0].init.method, 'POST')
  })

  it('turns a refusal into an error with the server\'s sentence, and never shows an HTML page', async () => {
    respondWith(() => json({ success: false, message: 'Only platform staff can change simulations.' }, 403))
    await assert.rejects(simulationService.update(3, { status: 'draft' }), (err: unknown) => err instanceof SimulationApiError && err.status === 403 && err.message === 'Only platform staff can change simulations.')
    respondWith(() => new Response('<html><body>Whoops</body></html>', { status: 500 }))
    await assert.rejects(simulationService.update(3, { status: 'draft' }), (err: unknown) => err instanceof SimulationApiError && err.status === 500 && !/html/i.test(err.message))
  })

  it('reads the reasons of a 422', async () => {
    respondWith(() => json({ success: false, message: 'Concept 99 is not a concept of this platform.', errors: { links: ['Concept 99 is not a concept of this platform.'] } }, 422))
    await assert.rejects(simulationService.putLinks(3, [{ concept_id: 99, role: 'primary', sort_order: 0 }]), (err: unknown) => {
      const failure = err as SimulationApiError
      return failure.status === 422 && /Concept 99/.test(failure.message) && failure.problems[0].includes('99')
    })
  })
})

describe('what reaches the sandboxed frame', () => {
  it('is the file, its kind, its type and its credit - never the token', async () => {
    respondWith(() => new Response(new Uint8Array([103, 108, 84, 70]), { status: 200, headers: { 'Content-Type': 'model/gltf-binary' } }))
    const loader = createAssetLoader((sha256) => simulationService.assetFile(3, sha256))
    const sent: { message: HostMessage; transfer?: Transferable[] }[] = []
    await answerAssetRequest({
      spec: { assets: { models: [{ id: 'eye', sha256: A }] } },
      assets: [{ sha256: A, kind: 'model', name: 'Eye', credit: 'Jo', licence: 'CC BY 4.0', source_url: 'https://example.org/eye' }],
      models: [{ id: 'eye', sha256: A }],
      loader,
      reply: (message, transfer) => {
        sent.push({ message, transfer })
        return true
      },
    })
    assert.equal(calls[0].headers.get('authorization'), `Bearer ${TOKEN}`, 'the download itself is authenticated')
    assert.equal(sent.length, 1)
    const message = sent[0].message as Extract<HostMessage, { type: 'asset' }>
    assert.equal(message.type, 'asset')
    assert.deepEqual(message.credit, { title: 'Eye', author: 'Jo', licence: 'CC BY 4.0', source: 'https://example.org/eye' })
    const readable = JSON.stringify({ ...message, bytes: undefined })
    assert.ok(!readable.includes(TOKEN), 'the token must not be in a message to the frame')
    assert.ok(!/authorization|bearer/i.test(readable))
  })
})

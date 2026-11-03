'use client'

/**
 * Organization Management Knowledge Graph.
 *
 * A live, physics-driven map of the school read from Neo4j, drawn as plain SVG (no graph library):
 * glowing orbs joined by soft curved lines. Nodes spring and settle by themselves. Grab any node
 * and drag it and its neighbours follow; let go and it stays put (double-click to release). Click a
 * role or department to open what is inside it, click a person to see their details. Drag the
 * background to pan and scroll to zoom.
 */

import { useCallback, useEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react'
import { ChevronsDownUp, ChevronsUpDown, Loader2, Maximize2, Moon, Network, RefreshCw, Search, Shuffle, Sun, Users, Layers, ShieldCheck, X } from 'lucide-react'
import { BLUE_THEME } from '../../_lib/blue-theme'
import { fetchOrgGraph, fetchStaffCard, type GraphNode, type GraphNodeType, type OrgGraph, type StaffCard } from '../../_lib/knowledge-graph-api'

type Mode = 'dark' | 'light'

const TYPE_LABEL: Record<GraphNodeType, string> = {
  institute: 'School',
  role: 'Role',
  department: 'Department',
  staff: 'Staff',
  subject: 'Subject',
  fact: 'Detail',
}

const BASE_COLOR: Record<GraphNodeType, string> = {
  institute: '#3b82f6',
  role: '#8b5cf6',
  department: '#10b981',
  staff: '#60a5fa',
  subject: '#f59e0b',
  fact: '#94a3b8',
}

/** The kinds of detail a person opens into, each with its own colour and short code. */
const FACETS: Record<string, { label: string; color: string; code: string }> = {
  department: { label: 'Department', color: '#10b981', code: 'DP' },
  jobRole: { label: 'Job role', color: '#a855f7', code: 'JR' },
  manager: { label: 'Reports to', color: '#06b6d4', code: 'RT' },
  class: { label: 'Class teacher of', color: '#f59e0b', code: 'CL' },
  subject: { label: 'Teaches', color: '#eab308', code: 'SB' },
  leave: { label: 'Leave type', color: '#ef4444', code: 'LV' },
  email: { label: 'Email', color: '#3b82f6', code: '@' },
  phone: { label: 'Phone', color: '#22c55e', code: 'PH' },
  employee: { label: 'Employee no.', color: '#64748b', code: '#' },
  city: { label: 'City', color: '#14b8a6', code: 'CT' },
}

/** One colour per role, so a person is recognisable by the colour of the thread above them. */
const ROLE_COLORS = ['#8b5cf6', '#ec4899', '#06b6d4', '#f97316', '#6366f1', '#84cc16', '#f43f5e', '#14b8a6']

const SURFACE: Record<Mode, { canvas: string; bg: string; card: string; cardBorder: string; text: string; sub: string; grid: string; panel: string; edge: number }> = {
  dark: {
    canvas: 'radial-gradient(ellipse at 50% 45%, #14245a 0%, #0a1230 45%, #050914 100%)',
    bg: '#0a1230',
    card: 'rgba(255,255,255,0.08)',
    cardBorder: 'rgba(255,255,255,0.16)',
    text: '#f1f5f9',
    sub: '#94a3b8',
    grid: 'rgba(148,163,184,0.16)',
    panel: 'rgba(10,18,48,0.78)',
    edge: 0.6,
  },
  light: {
    canvas: 'radial-gradient(ellipse at 50% 45%, #ffffff 0%, #eef4ff 55%, #dfe9fb 100%)',
    bg: '#eef4ff',
    card: 'rgba(255,255,255,0.92)',
    cardBorder: 'rgba(15,23,42,0.10)',
    text: '#0f172a',
    sub: '#64748b',
    grid: 'rgba(100,116,139,0.22)',
    panel: 'rgba(255,255,255,0.86)',
    edge: 0.75,
  },
}

/** Diameter of each kind of circle. The physics treats a node as a disc of half this size. */
const SIZE: Record<GraphNodeType, number> = { institute: 132, role: 94, department: 84, staff: 40, subject: 36, fact: 46 }

/** How hard each kind pushes its neighbours away, so big nodes keep a clear space around them. */
const CHARGE: Record<GraphNodeType, number> = { institute: 1800, role: 1100, department: 800, staff: 190, subject: 160, fact: 230 }

const initials = (label: string) =>
  label
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('') || '?'

/** Mix a #rrggbb colour toward white (amount > 0) or black (amount < 0). */
function shade(hex: string, amount: number): string {
  const n = parseInt(hex.slice(1), 16)
  const target = amount >= 0 ? 255 : 0
  const mix = (channel: number) => Math.round(channel + (target - channel) * Math.abs(amount))
  return `rgb(${mix((n >> 16) & 255)},${mix((n >> 8) & 255)},${mix(n & 255)})`
}

const gradientId = (hex: string) => `kg-${hex.slice(1)}`

/* ------------------------------------------------------------------------------------------------
 * A small force simulation (no dependency). Every node repels every other, links act as springs,
 * and a weak pull keeps the whole thing centred. `alpha` is the energy: it decays to rest, and
 * dragging or expanding pumps it back up so the picture rearranges and settles again.
 * ---------------------------------------------------------------------------------------------- */

interface SimNode {
  id: string
  kind: GraphNodeType
  x: number
  y: number
  vx: number
  vy: number
  /** Set while a node is dragged or pinned: the simulation holds it here. */
  fx: number | null
  fy: number | null
}

interface SimLink {
  a: string
  b: string
  length: number
  strength: number
}

function linkSpec(edge: OrgGraph['edges'][number], from: GraphNode | undefined): { length: number; weight: number } {
  if (edge.label === 'IN_DEPARTMENT') return { length: 200, weight: 0.1 }
  if (edge.label === 'FACT') return { length: 95, weight: 1 }
  if (edge.label === 'TEACHES_SUBJECT') return { length: 100, weight: 0.5 }
  if (from?.type === 'institute') return { length: 260, weight: 1 }
  if (from?.type === 'role') return { length: 105, weight: 1 }
  return { length: 140, weight: 1 }
}

function tick(sim: Map<string, SimNode>, links: SimLink[], alpha: number): void {
  const list = [...sim.values()]

  for (let i = 0; i < list.length; i++) {
    const a = list[i]
    for (let j = i + 1; j < list.length; j++) {
      const b = list[j]
      let dx = b.x - a.x
      let dy = b.y - a.y
      let d2 = dx * dx + dy * dy
      if (d2 > 360000) continue
      if (d2 < 1) {
        dx = (Math.random() - 0.5) * 2
        dy = (Math.random() - 0.5) * 2
        d2 = dx * dx + dy * dy + 1
      }
      const d = Math.sqrt(d2)
      // Distance is floored for the push so two nodes that start on top of each other are not flung out.
      const push = (((CHARGE[a.kind] + CHARGE[b.kind]) / 2) * alpha) / Math.max(d2, 900)
      a.vx -= dx * push
      a.vy -= dy * push
      b.vx += dx * push
      b.vy += dy * push

      // Collision: never let two circles overlap.
      const min = (SIZE[a.kind] + SIZE[b.kind]) / 2 + 10
      if (d < min) {
        const overlap = (Math.min(min - d, 30) / Math.max(d, 1)) * 0.5
        a.x -= dx * overlap
        a.y -= dy * overlap
        b.x += dx * overlap
        b.y += dy * overlap
      }
    }
  }

  for (const link of links) {
    const a = sim.get(link.a)
    const b = sim.get(link.b)
    if (!a || !b) continue
    const dx = b.x - a.x
    const dy = b.y - a.y
    const d = Math.sqrt(dx * dx + dy * dy) || 1
    const pull = ((d - link.length) / d) * link.strength * alpha
    a.vx += dx * pull
    a.vy += dy * pull
    b.vx -= dx * pull
    b.vy -= dy * pull
  }

  for (const n of list) {
    n.vx -= n.x * 0.012 * alpha
    n.vy -= n.y * 0.012 * alpha
    if (n.fx !== null && n.fy !== null) {
      n.x = n.fx
      n.y = n.fy
      n.vx = 0
      n.vy = 0
      continue
    }
    n.vx *= 0.62
    n.vy *= 0.62
    // Speed limit: whatever the forces say, a node moves at most this far in one frame.
    const speed = Math.hypot(n.vx, n.vy)
    if (speed > 28) {
      n.vx = (n.vx / speed) * 28
      n.vy = (n.vy / speed) * 28
    }
    n.x = Math.max(-2500, Math.min(2500, n.x + n.vx))
    n.y = Math.max(-2500, Math.min(2500, n.y + n.vy))
    // A node can never leave the world: this also stops any numeric blow-up from hiding the graph.
    if (!Number.isFinite(n.x) || !Number.isFinite(n.y)) {
      n.x = 0
      n.y = 0
      n.vx = 0
      n.vy = 0
    }
  }
}

const PER_ROLE_OPTIONS = [10, 25, 50, 100]

const formatDate = (value: string | null) => {
  if (!value) return null
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? value : date.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })
}

/** The person card shown in the details panel when a staff node is picked. */
function StaffDetails({ data, color, surface }: { data: StaffCard; color: string; surface: (typeof SURFACE)[Mode] }) {
  const rows: Array<[string, string | null]> = [
    ['Role', data.profile],
    ['Job role', data.jobRole],
    ['Department', data.department],
    ['Employee no.', data.employeeNo || null],
    ['Joined', formatDate(data.joined)],
    ['Experience', data.experience ? String(data.experience) : null],
    ['Qualification', data.qualification],
    ['Reports to', data.reportsTo],
    ['City', data.city],
    ['Last login', formatDate(data.lastLogin)],
  ]
  const chips = (title: string, list: string[]) =>
    list.length > 0 ? (
      <div className="mt-3">
        <div className="text-[10px] font-semibold uppercase tracking-[0.12em]" style={{ color: surface.sub }}>
          {title}
        </div>
        <div className="mt-1 flex flex-wrap gap-1">
          {list.map((item) => (
            <span key={item} className="rounded-full px-2 py-0.5 text-[11px] font-medium" style={{ background: `${color}22`, color }}>
              {item}
            </span>
          ))}
        </div>
      </div>
    ) : null

  return (
    <div>
      <div className="flex items-center gap-3">
        <div
          className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full text-base font-bold text-white"
          style={{ background: `linear-gradient(145deg, ${color}, ${color}b3)`, boxShadow: `0 0 20px ${color}66` }}
        >
          {initials(data.name)}
        </div>
        <div className="min-w-0">
          <span
            className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold"
            style={{ background: data.active ? 'rgba(16,185,129,0.18)' : 'rgba(148,163,184,0.2)', color: data.active ? '#10b981' : surface.sub }}
          >
            <span className="h-1.5 w-1.5 rounded-full" style={{ background: data.active ? '#10b981' : '#94a3b8' }} />
            {data.active ? 'Active' : 'Inactive'}
          </span>
          {data.email ? (
            <a href={`mailto:${data.email}`} className="mt-1 block truncate text-xs underline-offset-2 hover:underline" style={{ color: surface.text }}>
              {data.email}
            </a>
          ) : null}
          {data.mobile ? (
            <a href={`tel:${data.mobile}`} className="block text-xs underline-offset-2 hover:underline" style={{ color: surface.sub }}>
              {data.mobile}
            </a>
          ) : null}
        </div>
      </div>

      <dl className="mt-4 grid grid-cols-2 gap-x-3 gap-y-2">
        {rows.map(([label, value]) => (
          <div key={label} className="min-w-0">
            <dt className="text-[10px] uppercase tracking-wide" style={{ color: surface.sub }}>
              {label}
            </dt>
            <dd className="truncate text-xs font-medium" style={{ color: value ? surface.text : surface.sub }} title={value ?? undefined}>
              {value || '—'}
            </dd>
          </div>
        ))}
      </dl>

      {chips('Class teacher of', data.graph.classTeacherOf)}
      {chips('Teaches', data.graph.subjects)}
      {chips('Leave types taken', data.graph.leaveTypes)}
    </div>
  )
}

interface View {
  x: number
  y: number
  k: number
}

export default function OrgKnowledgeGraph() {
  const [perRole, setPerRole] = useState(25)
  const [graph, setGraph] = useState<OrgGraph | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [hiddenRoles, setHiddenRoles] = useState<string[]>([])
  const [expanded, setExpanded] = useState<string[]>([])
  const [pinned, setPinned] = useState<string[]>([])
  const [term, setTerm] = useState('')
  const [picked, setPicked] = useState<string | null>(null)
  // The person whose own details are open as nodes around them.
  const [openStaff, setOpenStaff] = useState<string | null>(null)
  const [hovered, setHovered] = useState<string | null>(null)
  const [mode, setMode] = useState<Mode>('dark')
  const [positions, setPositions] = useState<Map<string, { x: number; y: number }>>(new Map())
  const [view, setView] = useState<View>({ x: 0, y: 0, k: 0.8 })
  const [gliding, setGliding] = useState(false)

  const stage = useRef<HTMLDivElement | null>(null)
  const sim = useRef<Map<string, SimNode>>(new Map())
  const links = useRef<SimLink[]>([])
  const alpha = useRef(0)
  const dragging = useRef(false)
  const raf = useRef<number | null>(null)
  const viewRef = useRef<View>(view)
  const glideTimer = useRef<number | null>(null)

  useEffect(() => {
    viewRef.current = view
  }, [view])

  const load = useCallback(async (count: number) => {
    setLoading(true)
    setError(null)
    try {
      const data = await fetchOrgGraph(count)
      setGraph(data)
      // Start with the biggest role open so the first picture already has people in it.
      const biggest = data.nodes.filter((n) => n.type === 'role').sort((a, b) => (b.count ?? 0) - (a.count ?? 0))[0]
      setExpanded(biggest ? [biggest.id] : [])
      setPinned([])
      sim.current = new Map()
    } catch (value: unknown) {
      setGraph(null)
      setError(value instanceof Error ? value.message : "Couldn't load the knowledge graph. Try again.")
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- fetch on mount and when the sample size changes
    void load(perRole)
  }, [load, perRole])

  // The person's card is fetched when their node is opened, and an answer for a person who is no
  // longer open is thrown away. It feeds both the side panel and the detail nodes around them.
  const [card, setCard] = useState<{ id: string; data: StaffCard | null; error: string | null } | null>(null)
  useEffect(() => {
    if (!openStaff) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- clear the card when no person is open
      setCard(null)
      return
    }
    let live = true
    setCard({ id: openStaff, data: null, error: null })
    fetchStaffCard(openStaff.slice(6))
      .then((data) => live && setCard({ id: openStaff, data, error: null }))
      .catch((value: unknown) => live && setCard({ id: openStaff, data: null, error: value instanceof Error ? value.message : "Couldn't load this person's details." }))
    return () => {
      live = false
    }
  }, [openStaff])

  const s = SURFACE[mode]
  const dark = mode === 'dark'
  /** The open person's own details as extra nodes, each joined to them by a line. */
  const facts = useMemo(() => {
    const nodes: GraphNode[] = []
    const edges: OrgGraph['edges'] = []
    const data = card?.id === openStaff ? card?.data : null
    if (!openStaff || !data) return { nodes, edges }
    const add = (facet: string, value: string | null | undefined, index = 0) => {
      const text = (value ?? '').toString().trim()
      if (!text) return
      const id = `fact-${openStaff}-${facet}-${index}`
      nodes.push({ id, type: 'fact', facet, label: text })
      edges.push({ from: openStaff, to: id, label: 'FACT' })
    }
    add('department', data.department)
    add('jobRole', data.jobRole)
    add('manager', data.reportsTo)
    data.graph.classTeacherOf.forEach((value, i) => add('class', value, i))
    data.graph.subjects.forEach((value, i) => add('subject', value, i))
    data.graph.leaveTypes.forEach((value, i) => add('leave', value, i))
    add('email', data.email)
    add('phone', data.mobile)
    add('employee', data.employeeNo)
    add('city', data.city)
    return { nodes, edges }
  }, [card, openStaff])

  const byId = useMemo(() => new Map([...(graph?.nodes ?? []), ...facts.nodes].map((n) => [n.id, n])), [graph, facts])
  const roles = useMemo(() => (graph?.nodes ?? []).filter((n) => n.type === 'role'), [graph])
  const roleColor = useMemo(() => new Map(roles.map((r, i) => [r.id, ROLE_COLORS[i % ROLE_COLORS.length]])), [roles])
  const biggestRole = Math.max(1, ...roles.map((r) => r.count ?? 0))

  /** What each role / department would reveal when opened. */
  const childrenOf = useMemo(() => {
    const map = new Map<string, string[]>()
    for (const node of graph?.nodes ?? []) if (node.type === 'staff' && node.role) map.set(node.role, [...(map.get(node.role) ?? []), node.id])
    for (const edge of graph?.edges ?? []) {
      if (edge.label === 'HAS_DEPARTMENT' && edge.from !== 'institute') map.set(edge.from, [...(map.get(edge.from) ?? []), edge.to])
    }
    return map
  }, [graph])

  const visible = useMemo(() => {
    if (!graph) return { nodes: [] as GraphNode[], edges: [] as OrgGraph['edges'] }
    const open = new Set(expanded)
    const parentOfDept = new Map<string, string>()
    graph.edges.forEach((e) => e.label === 'HAS_DEPARTMENT' && e.from !== 'institute' && parentOfDept.set(e.to, e.from))

    const nodes = graph.nodes.filter((n) => {
      if (n.type === 'institute') return true
      if (n.type === 'role') return !hiddenRoles.includes(n.id)
      if (n.type === 'department') return !parentOfDept.has(n.id) || open.has(parentOfDept.get(n.id) ?? '')
      if (n.type === 'staff') return open.has(n.role ?? '') && !hiddenRoles.includes(n.role ?? '')
      return true
    })
    const ids = new Set(nodes.map((n) => n.id))
    const showFacts = openStaff !== null && ids.has(openStaff)
    return {
      nodes: showFacts ? [...nodes, ...facts.nodes] : nodes,
      edges: [...graph.edges.filter((e) => ids.has(e.from) && ids.has(e.to)), ...(showFacts ? facts.edges : [])],
    }
  }, [graph, expanded, hiddenRoles, openStaff, facts])

  /* Keep the simulation in step with what is on screen: new nodes appear next to their parent,
     gone nodes leave, links are rebuilt, and the energy is pumped up so it rearranges. */
  useEffect(() => {
    const map = sim.current
    const keep = new Set(visible.nodes.map((n) => n.id))
    for (const id of [...map.keys()]) if (!keep.has(id)) map.delete(id)

    const parentPos = (node: GraphNode): { x: number; y: number } => {
      const edge = visible.edges.find((e) => e.to === node.id && e.label !== 'IN_DEPARTMENT')
      const parent = edge ? map.get(edge.from) : undefined
      return parent ? { x: parent.x, y: parent.y } : { x: 0, y: 0 }
    }
    const headIndex = new Map(visible.nodes.filter((n) => n.type === 'role' || n.type === 'department').map((n, i) => [n.id, i]))

    for (const node of visible.nodes) {
      if (map.has(node.id)) continue
      let { x, y } = node.id === 'institute' ? { x: 0, y: 0 } : parentPos(node)
      if (node.type === 'role' || node.type === 'department') {
        const angle = ((headIndex.get(node.id) ?? 0) / Math.max(1, headIndex.size)) * Math.PI * 2
        x += Math.cos(angle) * 240
        y += Math.sin(angle) * 240
      } else if (node.type !== 'institute') {
        const angle = Math.random() * Math.PI * 2
        x += Math.cos(angle) * 70
        y += Math.sin(angle) * 70
      }
      const anchor = node.id === 'institute'
      map.set(node.id, { id: node.id, kind: node.type, x, y, vx: 0, vy: 0, fx: anchor ? 0 : null, fy: anchor ? 0 : null })
    }

    const degree = new Map<string, number>()
    visible.edges.forEach((e) => {
      degree.set(e.from, (degree.get(e.from) ?? 0) + 1)
      degree.set(e.to, (degree.get(e.to) ?? 0) + 1)
    })
    links.current = visible.edges.map((e) => {
      const spec = linkSpec(e, byId.get(e.from))
      return { a: e.from, b: e.to, length: spec.length, strength: Math.min(0.3, spec.weight / Math.min(degree.get(e.from) ?? 1, degree.get(e.to) ?? 1)) }
    })

    for (const node of map.values()) {
      if (pinned.includes(node.id) && node.fx === null) {
        node.fx = node.x
        node.fy = node.y
      }
    }
    alpha.current = Math.max(alpha.current, 0.9)
    setPositions(new Map([...map].map(([id, node]) => [id, { x: node.x, y: node.y }])))
  }, [visible, byId, pinned])

  // The animation loop runs only while there is energy to burn.
  useEffect(() => {
    const step = () => {
      if (dragging.current) alpha.current = Math.max(alpha.current, 0.3)
      if (alpha.current > 0.012) {
        tick(sim.current, links.current, alpha.current)
        alpha.current *= 0.986
        setPositions(new Map([...sim.current].map(([id, node]) => [id, { x: node.x, y: node.y }])))
      }
      raf.current = requestAnimationFrame(step)
    }
    raf.current = requestAnimationFrame(step)
    return () => {
      if (raf.current !== null) cancelAnimationFrame(raf.current)
    }
  }, [])

  /** Zoom and move the view so every node is on screen, with a short glide. */
  const fit = useCallback((padding = 90) => {
    const box = stage.current?.getBoundingClientRect()
    const nodes = [...sim.current.values()]
    if (!box || nodes.length === 0) return
    let minX = Infinity
    let minY = Infinity
    let maxX = -Infinity
    let maxY = -Infinity
    for (const n of nodes) {
      const r = SIZE[n.kind] / 2 + 24
      minX = Math.min(minX, n.x - r)
      maxX = Math.max(maxX, n.x + r)
      minY = Math.min(minY, n.y - r)
      maxY = Math.max(maxY, n.y + r)
    }
    const k = Math.max(0.15, Math.min(1.3, Math.min((box.width - padding) / (maxX - minX), (box.height - padding) / (maxY - minY))))
    setGliding(true)
    setView({ k, x: box.width / 2 - ((minX + maxX) / 2) * k, y: box.height / 2 - ((minY + maxY) / 2) * k })
    if (glideTimer.current !== null) window.clearTimeout(glideTimer.current)
    glideTimer.current = window.setTimeout(() => setGliding(false), 750)
  }, [])

  // First picture: let the layout spread out for a moment, then frame it.
  useEffect(() => {
    if (!graph) return
    const timer = window.setTimeout(() => fit(), 1300)
    return () => window.clearTimeout(timer)
  }, [graph, fit])

  // Scroll to zoom around the pointer. Attached by hand because React's wheel handler is passive.
  useEffect(() => {
    const element = stage.current
    if (!element) return
    const onWheel = (event: WheelEvent) => {
      event.preventDefault()
      const box = element.getBoundingClientRect()
      const mx = event.clientX - box.left
      const my = event.clientY - box.top
      setGliding(false)
      setView((current) => {
        const k = Math.max(0.12, Math.min(2.6, current.k * Math.exp(-event.deltaY * 0.0015)))
        return { k, x: mx - ((mx - current.x) * k) / current.k, y: my - ((my - current.y) * k) / current.k }
      })
    }
    element.addEventListener('wheel', onWheel, { passive: false })
    return () => element.removeEventListener('wheel', onWheel)
  }, [])

  const needle = term.trim().toLowerCase()
  const focus = picked ?? hovered
  const neighbours = useMemo(() => {
    const set = new Set<string>()
    if (!focus) return set
    set.add(focus)
    visible.edges.forEach((e) => {
      if (e.from === focus) set.add(e.to)
      if (e.to === focus) set.add(e.from)
    })
    return set
  }, [focus, visible.edges])

  const colorOf = useCallback(
    (n: GraphNode) =>
      n.type === 'role'
        ? (roleColor.get(n.id) ?? BASE_COLOR.role)
        : n.type === 'staff'
          ? (roleColor.get(n.role ?? '') ?? BASE_COLOR.staff)
          : n.type === 'fact'
            ? (FACETS[n.facet ?? '']?.color ?? BASE_COLOR.fact)
            : BASE_COLOR[n.type],
    [roleColor],
  )

  const toggleOpen = useCallback((id: string) => setExpanded((current) => (current.includes(id) ? current.filter((value) => value !== id) : [...current, id])), [])

  const release = (id: string) => {
    const node = sim.current.get(id)
    if (node && id !== 'institute') {
      node.fx = null
      node.fy = null
    }
    setPinned((current) => current.filter((value) => value !== id))
    alpha.current = Math.max(alpha.current, 0.7)
  }

  /* Pointer handling: a press on a node either becomes a click (no movement) or a drag (moves the
     node and pins it); a press on the background pans the view. */
  const worldPoint = (clientX: number, clientY: number) => {
    const box = stage.current?.getBoundingClientRect()
    const v = viewRef.current
    return { x: (clientX - (box?.left ?? 0) - v.x) / v.k, y: (clientY - (box?.top ?? 0) - v.y) / v.k }
  }

  const onNodePointerDown = (event: ReactPointerEvent, node: GraphNode) => {
    event.stopPropagation()
    const startX = event.clientX
    const startY = event.clientY
    const start = sim.current.get(node.id)
    const grab = start ? { dx: start.x - worldPoint(startX, startY).x, dy: start.y - worldPoint(startX, startY).y } : { dx: 0, dy: 0 }
    let moved = false
    setGliding(false)

    const move = (e: PointerEvent) => {
      if (!moved && Math.hypot(e.clientX - startX, e.clientY - startY) < 4) return
      moved = true
      dragging.current = true
      const target = sim.current.get(node.id)
      if (!target) return
      const point = worldPoint(e.clientX, e.clientY)
      target.fx = point.x + grab.dx
      target.fy = point.y + grab.dy
      target.x = target.fx
      target.y = target.fy
    }
    const up = () => {
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', up)
      dragging.current = false
      if (moved) {
        // A dropped node stays where it was put until it is double-clicked.
        if (node.type !== 'institute') setPinned((current) => (current.includes(node.id) ? current : [...current, node.id]))
        return
      }
      setPicked((current) => (current === node.id ? null : node.id))
      // A person opens into their own details, and closes again on a second click.
      if (node.type === 'staff') setOpenStaff((current) => (current === node.id ? null : node.id))
      if ((node.type === 'role' || node.type === 'department') && (childrenOf.get(node.id)?.length ?? 0) > 0) toggleOpen(node.id)
    }
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', up)
  }

  const onBackgroundPointerDown = (event: ReactPointerEvent) => {
    const startX = event.clientX
    const startY = event.clientY
    const origin = viewRef.current
    let moved = false
    setGliding(false)
    const move = (e: PointerEvent) => {
      if (!moved && Math.hypot(e.clientX - startX, e.clientY - startY) < 4) return
      moved = true
      setView({ ...origin, x: origin.x + e.clientX - startX, y: origin.y + e.clientY - startY })
    }
    const up = () => {
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', up)
      if (!moved) {
        setPicked(null)
        setOpenStaff(null)
      }
    }
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', up)
  }

  const expandable = useMemo(() => [...childrenOf.keys()], [childrenOf])
  const expandAll = () => {
    setExpanded(expandable)
    window.setTimeout(() => fit(120), 1500)
  }
  const collapseAll = () => {
    setExpanded([])
    window.setTimeout(() => fit(200), 1000)
  }
  const reshuffle = () => {
    for (const node of sim.current.values()) {
      if (node.id === 'institute') continue
      node.fx = null
      node.fy = null
      node.x += (Math.random() - 0.5) * 140
      node.y += (Math.random() - 0.5) * 140
    }
    setPinned([])
    alpha.current = 1
    window.setTimeout(() => fit(), 1500)
  }

  const pickedNode = picked ? byId.get(picked) : null
  const linked = useMemo(
    () =>
      picked
        ? [...(graph?.edges ?? []), ...facts.edges].filter((e) => e.from === picked || e.to === picked).map((e) => byId.get(e.from === picked ? e.to : e.from)).filter((n): n is GraphNode => Boolean(n))
        : [],
    [picked, graph, byId, facts],
  )

  const toggleRole = (id: string) => setHiddenRoles((current) => (current.includes(id) ? current.filter((value) => value !== id) : [...current, id]))
  const shownStaff = visible.nodes.filter((n) => n.type === 'staff').length
  const matches = (n: GraphNode) => needle !== '' && n.label.toLowerCase().includes(needle)

  // Every colour in use gets one shared radial gradient, so a node is a lit sphere rather than a flat disc.
  const palette = useMemo(() => [...new Set([...Object.values(BASE_COLOR), ...ROLE_COLORS, ...Object.values(FACETS).map((f) => f.color)])], [])
  const pins = new Set(pinned)
  const open = new Set(expanded)
  const showNames = view.k > 0.75

  const iconButton = 'flex h-9 w-9 cursor-pointer items-center justify-center rounded-xl border backdrop-blur-md transition-transform hover:scale-105 active:scale-95'
  const pill = 'flex h-9 cursor-pointer items-center gap-1.5 rounded-xl border px-3 text-xs font-medium backdrop-blur-md transition-transform hover:scale-[1.03] active:scale-95'

  return (
    <div style={BLUE_THEME} className="w-full space-y-4 p-6 md:p-8">
      <style>{`@keyframes kg-flow { to { stroke-dashoffset: calc(var(--period) * -1); } } @keyframes kg-pulse { 0%,100% { opacity: .22; transform: scale(1); } 50% { opacity: .08; transform: scale(1.12); } }`}</style>

      {/* Hero */}
      <div className="relative overflow-hidden rounded-2xl border p-5 text-white shadow-sm md:p-6" style={{ background: 'linear-gradient(120deg, #1e3a8a 0%, #2563eb 55%, #4f46e5 100%)', borderColor: 'rgba(255,255,255,0.12)' }}>
        <div className="pointer-events-none absolute -right-10 -top-16 h-56 w-56 rounded-full bg-white/10 blur-2xl" />
        <div className="pointer-events-none absolute -bottom-20 left-1/3 h-48 w-48 rounded-full bg-cyan-300/10 blur-3xl" />
        <div className="relative flex flex-wrap items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-blue-100">
              <Network className="h-4 w-4" /> Knowledge Graph
            </div>
            <h1 className="mt-1 text-2xl font-semibold tracking-tight">Organization map</h1>
            <p className="mt-1 max-w-xl text-sm text-blue-100">Drag any circle to move it. Click a role or department to open what is inside it. Click a person to see their details.</p>
          </div>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {[
              { label: 'Staff', value: graph?.stats.staffTotal, icon: Users },
              { label: 'Roles', value: graph?.stats.roles, icon: ShieldCheck },
              { label: 'Departments', value: graph?.stats.departments, icon: Layers },
              { label: 'Connections', value: graph?.stats.edges, icon: Network },
            ].map((stat) => (
              <div key={stat.label} className="min-w-28 rounded-xl border border-white/20 bg-white/10 px-3 py-2 backdrop-blur">
                <div className="flex items-center gap-1.5 text-[11px] text-blue-100">
                  <stat.icon className="h-3.5 w-3.5" /> {stat.label}
                </div>
                <div className="text-xl font-bold leading-tight">{loading ? '…' : (stat.value ?? 0)}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {error ? (
        <div role="alert" className="rounded-lg border border-destructive/20 bg-destructive/5 px-4 py-3 text-sm text-destructive">
          {error}
        </div>
      ) : null}

      {/* Canvas */}
      <div ref={stage} className="relative h-[74vh] min-h-[32rem] touch-none select-none overflow-hidden rounded-2xl border shadow-lg" style={{ background: s.canvas, borderColor: s.cardBorder }}>
        {loading ? (
          <div className="absolute inset-0 z-20 flex items-center justify-center text-sm backdrop-blur-sm" style={{ color: s.text, background: dark ? 'rgba(5,9,20,0.6)' : 'rgba(255,255,255,0.6)' }}>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Reading the graph...
          </div>
        ) : null}

        {!loading && graph && graph.nodes.length <= 1 ? (
          <div className="absolute inset-0 z-10 flex items-center justify-center text-sm" style={{ color: s.sub }}>
            The graph has no organization data for this school yet.
          </div>
        ) : null}

        <svg className="absolute inset-0 h-full w-full" onPointerDown={onBackgroundPointerDown} style={{ cursor: 'grab' }}>
          <defs>
            {palette.map((hex) => (
              <radialGradient key={hex} id={gradientId(hex)} cx="32%" cy="26%" r="80%">
                <stop offset="0%" stopColor={shade(hex, 0.55)} />
                <stop offset="45%" stopColor={hex} />
                <stop offset="100%" stopColor={shade(hex, -0.38)} />
              </radialGradient>
            ))}
            <filter id="kg-glow" x="-60%" y="-60%" width="220%" height="220%">
              <feGaussianBlur stdDeviation="9" />
            </filter>
          </defs>

          {/* A faint dot grid that pans and zooms with the picture. */}
          <pattern id="kg-grid" width={32 * view.k} height={32 * view.k} patternUnits="userSpaceOnUse" x={view.x} y={view.y}>
            <circle cx={1.2} cy={1.2} r={1.2} fill={s.grid} />
          </pattern>
          <rect width="100%" height="100%" fill="url(#kg-grid)" />

          <g style={{ transform: `translate(${view.x}px, ${view.y}px) scale(${view.k})`, transformOrigin: '0 0', transition: gliding ? 'transform .7s cubic-bezier(.22,.8,.3,1)' : 'none' }}>
            {/* Lines first, so every orb sits on top of them. */}
            {visible.edges.map((e) => {
              const a = positions.get(e.from)
              const b = positions.get(e.to)
              const target = byId.get(e.to)
              const source = byId.get(e.from)
              if (!a || !b || !target || !source) return null
              const color = target.type === 'fact' ? (FACETS[target.facet ?? '']?.color ?? '#94a3b8') : target.type === 'staff' ? (roleColor.get(target.role ?? '') ?? '#64748b') : target.type === 'role' ? (roleColor.get(target.id) ?? '#64748b') : '#10b981'
              const lit = focus === null || (neighbours.has(e.from) && neighbours.has(e.to))
              const core = source.type === 'institute'
              const dept = e.label === 'IN_DEPARTMENT'
              // The lines of the node you hover or select glow and thicken; no line is ever faded.
              const hot = focus !== null && lit
              const width = (core ? 3.4 : dept ? 2.2 : 2.6) + (hot ? 1.2 : 0)
              // A gentle bend, always to the same side, so lines read as soft arcs instead of ruler strokes.
              const mx = (a.x + b.x) / 2
              const my = (a.y + b.y) / 2
              const bend = Math.min(36, Math.hypot(b.x - a.x, b.y - a.y) * 0.12)
              const nx = -(b.y - a.y)
              const ny = b.x - a.x
              const nl = Math.hypot(nx, ny) || 1
              const d = `M${a.x.toFixed(1)},${a.y.toFixed(1)} Q${(mx + (nx / nl) * bend).toFixed(1)},${(my + (ny / nl) * bend).toFixed(1)} ${b.x.toFixed(1)},${b.y.toFixed(1)}`
              return (
                <g key={`${e.from}>${e.to}>${e.label}`}>
                  <path
                    d={d}
                    fill="none"
                    stroke={color}
                    strokeWidth={width}
                    strokeLinecap="round"
                    // Even dashes with rounded ends: the dash is a little longer than the line is thick, the gap a little more than twice.
                    strokeDasharray={`${(width * 1.3).toFixed(1)} ${(width * 2.4).toFixed(1)}`}
                    opacity={dept && !hot ? 0.6 : Math.max(s.edge, core || hot ? 0.95 : 0.8)}
                    className="kg-line"
                    // The dashes march from the parent toward the child; the lines of the node in focus run faster.
                    style={
                      {
                        '--period': `${(width * 3.7).toFixed(1)}px`,
                        animation: `kg-flow ${hot ? 0.6 : core ? 0.9 : 1.2}s linear infinite`,
                        filter: hot || core ? `drop-shadow(0 0 4px ${color})` : undefined,
                      } as React.CSSProperties
                    }
                  />
                </g>
              )
            })}

            {visible.nodes.map((n) => {
              const at = positions.get(n.id)
              if (!at) return null
              const r = SIZE[n.type] / 2
              const color = colorOf(n)
              const dim = needle !== '' && !matches(n) && n.type === 'staff'
              const lit = focus === n.id || matches(n)
              const kids = childrenOf.get(n.id)?.length ?? 0
              const head = n.type === 'role' || n.type === 'department'
              const labelText = n.label.length > 24 ? `${n.label.slice(0, 23)}…` : n.label
              const showLabel = n.type === 'institute' ? false : head || n.type === 'fact' || showNames || lit

              return (
                <g
                  key={n.id}
                  transform={`translate(${at.x.toFixed(1)},${at.y.toFixed(1)})`}
                  opacity={dim ? 0.3 : 1}
                  style={{ cursor: 'grab' }}
                  onPointerDown={(event) => onNodePointerDown(event, n)}
                  onDoubleClick={() => release(n.id)}
                  onPointerEnter={() => setHovered(n.id)}
                  onPointerLeave={() => setHovered(null)}
                >
                  {/* Halo */}
                  {n.type === 'institute' || head ? (
                    <circle r={r + 12} fill={color} opacity={lit ? 0.55 : 0.3} filter="url(#kg-glow)" style={n.type === 'institute' ? { animation: 'kg-pulse 3.4s ease-in-out infinite', transformBox: 'fill-box', transformOrigin: 'center' } : undefined} />
                  ) : (
                    <circle r={r + (lit ? 9 : 5)} fill={color} opacity={lit ? 0.5 : 0.2} />
                  )}
                  {/* Orb */}
                  <circle r={r} fill={`url(#${gradientId(color)})`} stroke={lit ? '#ffffff' : 'rgba(255,255,255,0.55)'} strokeWidth={lit ? 2.6 : 1.6} />
                  {/* A soft highlight, to read as glass */}
                  <ellipse cx={-r * 0.28} cy={-r * 0.42} rx={r * 0.5} ry={r * 0.26} fill="#fff" opacity={0.22} />

                  {n.type === 'institute' ? (
                    <>
                      <text y={-6} textAnchor="middle" fill="#fff" fontSize={12} fontWeight={700} style={{ pointerEvents: 'none' }}>
                        {n.label.length > 16 ? `${n.label.slice(0, 15)}…` : n.label}
                      </text>
                      <text y={13} textAnchor="middle" fill="#dbeafe" fontSize={11} style={{ pointerEvents: 'none' }}>
                        {n.count} staff
                      </text>
                    </>
                  ) : n.type === 'fact' ? (
                    <text y={4} textAnchor="middle" fill="#fff" fontSize={12} fontWeight={800} style={{ pointerEvents: 'none' }}>
                      {FACETS[n.facet ?? '']?.code ?? '•'}
                    </text>
                  ) : head ? (
                    <text y={6} textAnchor="middle" fill="#fff" fontSize={19} fontWeight={800} style={{ pointerEvents: 'none' }}>
                      {n.count ?? 0}
                    </text>
                  ) : (
                    <text y={4} textAnchor="middle" fill="#fff" fontSize={n.type === 'staff' ? 12 : 11} fontWeight={700} style={{ pointerEvents: 'none' }}>
                      {initials(n.label)}
                    </text>
                  )}

                  {head && kids > 0 ? (
                    <g transform={`translate(${r * 0.74},${-r * 0.74})`} style={{ pointerEvents: 'none' }}>
                      <circle r={12} fill={open.has(n.id) ? s.bg : '#ffffff'} stroke={color} strokeWidth={2} />
                      <text y={4} textAnchor="middle" fontSize={open.has(n.id) ? 15 : 10} fontWeight={800} fill={open.has(n.id) ? s.text : color}>
                        {open.has(n.id) ? '−' : `+${kids}`}
                      </text>
                    </g>
                  ) : null}

                  {pins.has(n.id) ? <circle cx={-r * 0.74} cy={-r * 0.74} r={4.5} fill="#fff" stroke={color} strokeWidth={2} style={{ pointerEvents: 'none' }} /> : null}

                  {showLabel ? (
                    <text
                      y={r + 16}
                      textAnchor="middle"
                      fontSize={head ? 13 : 11}
                      fontWeight={head ? 700 : 600}
                      fill={s.text}
                      stroke={s.bg}
                      strokeWidth={4}
                      strokeLinejoin="round"
                      paintOrder="stroke"
                      style={{ pointerEvents: 'none' }}
                    >
                      {labelText}
                    </text>
                  ) : null}
                </g>
              )
            })}
          </g>
        </svg>

        {/* Toolbar */}
        <div className="absolute left-3 right-3 top-3 z-10 flex flex-wrap items-center gap-2">
          <div className="relative">
            <Search className="absolute left-3 top-2.5 h-4 w-4" style={{ color: s.sub }} />
            <input
              type="text"
              value={term}
              onChange={(event) => setTerm(event.target.value)}
              placeholder="Find a person..."
              aria-label="Find a person in the graph"
              className="h-9 w-52 rounded-xl border pl-9 pr-3 text-sm backdrop-blur-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              style={{ background: s.panel, borderColor: s.cardBorder, color: s.text }}
            />
          </div>
          <label className="flex h-9 items-center gap-2 rounded-xl border px-3 text-xs backdrop-blur-md" style={{ background: s.panel, borderColor: s.cardBorder, color: s.sub }}>
            Staff per role
            <select
              value={perRole}
              onChange={(event) => setPerRole(Number(event.target.value))}
              className="rounded-md border bg-transparent px-1 py-0.5 text-sm font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              style={{ borderColor: s.cardBorder, color: s.text }}
            >
              {PER_ROLE_OPTIONS.map((n) => (
                <option key={n} value={n} style={{ color: '#0f172a' }}>
                  {n}
                </option>
              ))}
            </select>
          </label>
          <button type="button" onClick={expandAll} className={pill} style={{ background: s.panel, borderColor: s.cardBorder, color: s.text }}>
            <ChevronsUpDown className="h-4 w-4" /> Expand all
          </button>
          <button type="button" onClick={collapseAll} className={pill} style={{ background: s.panel, borderColor: s.cardBorder, color: s.text }}>
            <ChevronsDownUp className="h-4 w-4" /> Collapse
          </button>
          <div className="ml-auto flex items-center gap-2">
            <button type="button" onClick={reshuffle} aria-label="Shake the layout and release pinned nodes" title="Shake the layout and release pinned nodes" className={iconButton} style={{ background: s.panel, borderColor: s.cardBorder, color: s.text }}>
              <Shuffle className="h-4 w-4" />
            </button>
            <button type="button" onClick={() => fit()} aria-label="Fit everything on screen" title="Fit everything on screen" className={iconButton} style={{ background: s.panel, borderColor: s.cardBorder, color: s.text }}>
              <Maximize2 className="h-4 w-4" />
            </button>
            <button type="button" onClick={() => void load(perRole)} aria-label="Reload the graph" title="Reload" className={iconButton} style={{ background: s.panel, borderColor: s.cardBorder, color: s.text }}>
              <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            </button>
            <button
              type="button"
              onClick={() => setMode(dark ? 'light' : 'dark')}
              aria-label={dark ? 'Switch to the light canvas' : 'Switch to the dark canvas'}
              className={iconButton}
              style={{ background: s.panel, borderColor: s.cardBorder, color: s.text }}
            >
              {dark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            </button>
          </div>
        </div>

        {/* Roles panel */}
        {roles.length > 0 ? (
          <div className="absolute bottom-3 left-3 z-10 hidden w-60 rounded-2xl border p-3 backdrop-blur-md md:block" style={{ background: s.panel, borderColor: s.cardBorder }}>
            <div className="mb-2 text-[10px] font-semibold uppercase tracking-[0.14em]" style={{ color: s.sub }}>
              Roles · tap to show or hide
            </div>
            <ul className="space-y-1.5">
              {roles.map((role) => {
                const off = hiddenRoles.includes(role.id)
                const color = roleColor.get(role.id) ?? '#64748b'
                return (
                  <li key={role.id}>
                    <button type="button" aria-pressed={!off} onClick={() => toggleRole(role.id)} className="w-full cursor-pointer text-left" style={{ opacity: off ? 0.4 : 1 }}>
                      <div className="flex items-center justify-between text-xs">
                        <span className="flex items-center gap-2 font-medium" style={{ color: s.text }}>
                          <span className="h-2.5 w-2.5 rounded-full" style={{ background: color, boxShadow: `0 0 8px ${color}` }} />
                          {role.label}
                        </span>
                        <span style={{ color: s.sub }}>{role.count}</span>
                      </div>
                      <div className="mt-1 h-1 overflow-hidden rounded-full" style={{ background: dark ? 'rgba(255,255,255,0.1)' : 'rgba(15,23,42,0.08)' }}>
                        <div className="h-full rounded-full" style={{ width: `${Math.max(3, ((role.count ?? 0) / biggestRole) * 100)}%`, background: color }} />
                      </div>
                    </button>
                  </li>
                )
              })}
            </ul>
            {graph ? (
              <div className="mt-3 border-t pt-2 text-[11px]" style={{ borderColor: s.cardBorder, color: s.sub }}>
                Showing {shownStaff} of {graph.stats.staffTotal} staff · double-click a pinned node to release it
              </div>
            ) : null}
          </div>
        ) : null}

        {/* Details drawer */}
        {pickedNode ? (
          <aside className="absolute bottom-3 right-3 top-16 z-10 w-80 overflow-y-auto rounded-2xl border backdrop-blur-md" style={{ background: s.panel, borderColor: s.cardBorder, color: s.text }} onPointerDown={(event) => event.stopPropagation()}>
            <div className="flex items-start justify-between gap-2 border-b p-4" style={{ borderColor: s.cardBorder }}>
              <div className="min-w-0">
                <div className="text-[10px] font-semibold uppercase tracking-[0.14em]" style={{ color: colorOf(pickedNode) }}>
                  {pickedNode.type === 'fact' ? (FACETS[pickedNode.facet ?? '']?.label ?? 'Detail') : TYPE_LABEL[pickedNode.type]}
                </div>
                <div className="truncate text-lg font-bold">{pickedNode.label}</div>
                {pickedNode.count !== undefined ? (
                  <div className="text-xs" style={{ color: s.sub }}>
                    {pickedNode.count} staff
                  </div>
                ) : null}
              </div>
              <button type="button" aria-label="Close details" onClick={() => {
                  setPicked(null)
                  setOpenStaff(null)
                }} className="cursor-pointer rounded-lg p-1 transition-colors hover:bg-white/10" style={{ color: s.sub }}>
                <X className="h-4 w-4" />
              </button>
            </div>
            {pickedNode.type === 'staff' ? (
              <div className="border-b p-4" style={{ borderColor: s.cardBorder }}>
                {card?.id === picked && card.data ? (
                  <StaffDetails data={card.data} color={roleColor.get(pickedNode.role ?? '') ?? BASE_COLOR.staff} surface={s} />
                ) : card?.id === picked && card.error ? (
                  <div className="text-xs text-red-400">{card.error}</div>
                ) : (
                  <div className="flex items-center gap-2 text-xs" style={{ color: s.sub }}>
                    <Loader2 className="h-3.5 w-3.5 animate-spin" /> Loading details...
                  </div>
                )}
              </div>
            ) : null}
            <div className="p-4">
              <div className="text-xs font-semibold" style={{ color: s.sub }}>
                Connected to ({linked.length})
              </div>
              <ul className="mt-2 max-h-48 space-y-1 overflow-auto pr-1">
                {linked.slice(0, 60).map((node) => (
                  <li key={node.id}>
                    <button
                      type="button"
                      onClick={() => {
                        // Jumping to a person who is not showing opens the role they sit under.
                        if (node.type === 'staff' && node.role && !expanded.includes(node.role)) setExpanded((current) => [...current, node.role as string])
                        setPicked(node.id)
                        if (node.type === 'staff') setOpenStaff(node.id)
                      }}
                      className="flex w-full cursor-pointer items-center gap-2 rounded-lg px-2 py-1.5 text-left text-xs transition-colors hover:bg-white/10"
                    >
                      <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: colorOf(node) }} />
                      <span className="truncate">{node.label}</span>
                      <span className="ml-auto text-[10px]" style={{ color: s.sub }}>
                        {TYPE_LABEL[node.type]}
                      </span>
                    </button>
                  </li>
                ))}
                {linked.length > 60 ? (
                  <li className="px-2 text-[11px]" style={{ color: s.sub }}>
                    and {linked.length - 60} more
                  </li>
                ) : null}
              </ul>
            </div>
          </aside>
        ) : null}
      </div>

      <p className="text-xs text-muted-foreground">Drag a circle to move it; it stays where you drop it. Double-click to let it go. Scroll to zoom, drag the background to move around.</p>
    </div>
  )
}

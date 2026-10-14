'use client'

/**
 * Capability Explorer — the occupational skill / job-role taxonomy, as a graph.
 *
 * Replaces an embedded third-party demo (`skill-ontology-neo4j.vercel.app`)
 * that carried its own on-screen disclaimer that it was "not built from your
 * organisation's own role and competency mapping." This reads this LMS's own
 * Neo4j graph instead — 16k+ Skill nodes, 5.8k+ JobRole nodes, 170k+
 * REQUIRES_SKILL edges between them — through the same `/api/brain/{tenant}/graph`
 * endpoint the Enterprise Brain's own org-chart Graph Explorer already uses.
 * `GraphExplorer::skillNodes()/jobRoleNodes()/expandSkill()/expandJobRole()`
 * added two node types to that existing, working contract; nothing new was
 * invented on the wire.
 *
 * The taxonomy itself is global, not scoped to this institute — it is a
 * reference occupational ontology (Singapore SkillsFuture / O*NET sourced),
 * not something this school authored. A Brain session is still required to
 * call the endpoint at all; it just never changes what the endpoint returns.
 */

import { useCallback, useEffect, useMemo, useState, Fragment } from 'react'
import { ChevronRight, Network, RefreshCw, Search } from 'lucide-react'

import { Button } from '@/components/ui/g2g/button'
import { EmptyState } from '@/components/ui/empty-state'
import { Skeleton } from '@/components/ui/skeleton'
import { buildSessionContext } from '../../_lib/command-center-api'
import { fetchGraph, type BrainGraphExpansion, type BrainGraphNode } from '@/lib/brain/api'

type TaxonomyType = 'jobrole' | 'skill'

const ROOTS: Array<{ type: TaxonomyType; label: string }> = [
  { type: 'jobrole', label: 'Job roles' },
  { type: 'skill', label: 'Skills' },
]

type Crumb = { type: string; id: string; label: string }

export function TaxonomyOntology() {
  const subInstituteId = useMemo(() => buildSessionContext().subInstituteId, [])

  const [type, setType] = useState<TaxonomyType>('jobrole')
  const [term, setTerm] = useState('')
  const [nodes, setNodes] = useState<BrainGraphNode[]>([])
  const [selected, setSelected] = useState<BrainGraphExpansion | null>(null)
  const [trail, setTrail] = useState<Crumb[]>([])
  const [listLoading, setListLoading] = useState(true)
  const [detailLoading, setDetailLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const browse = useCallback(async (nextType: TaxonomyType, search = '') => {
    setListLoading(true)
    setError(null)
    try {
      const payload = await fetchGraph({ type: nextType, q: search })
      setType(nextType)
      setNodes(payload.nodes ?? [])
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Couldn't load the taxonomy.")
    } finally {
      setListLoading(false)
    }
  }, [])

  const expand = useCallback(async (node: Crumb, resetTrail = false) => {
    setDetailLoading(true)
    setError(null)
    try {
      const payload = await fetchGraph({ type: node.type, id: node.id })
      setSelected(payload)
      setTrail((current) => {
        if (resetTrail) return [node]
        const existing = current.findIndex((step) => step.type === node.type && step.id === node.id)
        return existing >= 0 ? current.slice(0, existing + 1) : [...current, node]
      })
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Couldn't open that node.")
    } finally {
      setDetailLoading(false)
    }
  }, [])

  useEffect(() => {
    if (!subInstituteId) {
      setListLoading(false)
      return
    }
    void browse('jobrole')
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [subInstituteId])

  const switchRoot = useCallback(
    (nextType: TaxonomyType) => {
      setTerm('')
      setSelected(null)
      setTrail([])
      void browse(nextType)
    },
    [browse],
  )

  if (!subInstituteId) {
    return (
      <EmptyState
        icon={<Network className="h-8 w-8" />}
        title="No organisation selected"
        description="The taxonomy explorer needs an active session to load."
      />
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3 rounded-2xl border border-primary/10 bg-card/50 p-5 shadow-sm backdrop-blur-xl">
        <div className="flex min-w-0 items-start gap-3">
          <span className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <Network className="h-5 w-5" />
          </span>
          <div className="min-w-0">
            <h2 className="text-lg font-bold tracking-tight text-foreground">Capability Explorer</h2>
            <p className="mt-1 max-w-2xl text-sm leading-relaxed text-muted-foreground">
              The occupational skill and job-role taxonomy this LMS's own graph holds — walk from a
              job role to the skills it requires, or from a skill to every role that needs it.
            </p>
          </div>
        </div>

        <Button
          variant="outline"
          onClick={() => void browse(type, term.trim())}
          className="h-9 shrink-0 gap-2 rounded-lg font-semibold"
        >
          <RefreshCw className="h-4 w-4" /> Refresh
        </Button>
      </div>

      {error && (
        <div
          role="alert"
          className="rounded-xl border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs text-destructive"
        >
          {error}
        </div>
      )}

      <div className="flex gap-2">
        {ROOTS.map((root) => (
          <Button
            key={root.type}
            variant={type === root.type ? 'default' : 'outline'}
            onClick={() => switchRoot(root.type)}
            className="h-9 rounded-lg font-semibold"
          >
            {root.label}
          </Button>
        ))}
      </div>

      {trail.length > 0 && (
        <nav className="flex flex-wrap items-center gap-1 text-xs text-muted-foreground">
          {trail.map((step, index) => (
            <Fragment key={`${step.type}-${step.id}`}>
              {index > 0 && <ChevronRight className="h-3.5 w-3.5 text-muted-foreground/60" />}
              <button
                type="button"
                onClick={() => void expand(step)}
                className={index === trail.length - 1 ? 'font-semibold text-foreground' : 'hover:text-foreground'}
              >
                {step.label}
              </button>
            </Fragment>
          ))}
        </nav>
      )}

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[20rem_minmax(0,1fr)]">
        {/* ----------------------------------------------------- node browser */}
        <div className="overflow-hidden rounded-2xl border border-border bg-card/40">
          <div className="border-b border-border/60 p-3">
            <form
              onSubmit={(event) => {
                event.preventDefault()
                void browse(type, term.trim())
              }}
              className="flex items-center gap-2 rounded-xl border border-border bg-background px-3 py-1.5"
            >
              <Search className="h-3.5 w-3.5 text-muted-foreground" />
              <input
                value={term}
                onChange={(event) => setTerm(event.target.value)}
                placeholder={type === 'jobrole' ? 'Search job roles' : 'Search skills'}
                className="w-full bg-transparent text-xs text-foreground outline-none placeholder:text-muted-foreground"
              />
            </form>
          </div>

          <div className="max-h-[34rem] divide-y divide-border/60 overflow-auto">
            {listLoading ? (
              <div className="space-y-3 p-4">
                {[0, 1, 2, 3, 4].map((i) => (
                  <Skeleton key={i} className="h-10 w-full rounded-lg" />
                ))}
              </div>
            ) : nodes.length === 0 ? (
              <p className="px-4 py-8 text-xs text-muted-foreground">Nothing matches that search.</p>
            ) : (
              nodes.map((node) => (
                <button
                  key={`${node.type}-${node.id}`}
                  type="button"
                  onClick={() => void expand({ type: node.type, id: node.id, label: node.label }, true)}
                  className="flex w-full flex-col gap-1 px-4 py-2.5 text-left transition-colors hover:bg-muted/60"
                >
                  <span className="truncate text-sm font-medium text-foreground">{node.label}</span>
                  <span className="flex flex-wrap gap-x-3 text-[11px] text-muted-foreground">
                    {node.metrics.map((metric) => (
                      <span key={metric.label}>
                        {metric.label}: <span className="font-semibold text-foreground/80">{metric.value}</span>
                      </span>
                    ))}
                  </span>
                </button>
              ))
            )}
          </div>
        </div>

        {/* ------------------------------------------------------- expansion */}
        <div className="space-y-4">
          {detailLoading && !selected ? (
            <div className="rounded-2xl border border-border bg-card/40 p-5">
              <Skeleton className="h-24 w-full rounded-xl" />
            </div>
          ) : !selected?.available ? (
            <div className="flex min-h-[16rem] flex-col items-center justify-center rounded-2xl border border-border bg-card/40 p-8 text-center">
              <Network className="mb-3 h-7 w-7 text-muted-foreground/60" />
              <p className="text-sm text-muted-foreground">
                {selected?.reason ?? 'Pick a job role or skill on the left to explore it.'}
              </p>
            </div>
          ) : (
            <>
              <div className="rounded-2xl border border-border bg-card/40 p-5">
                <p className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">
                  {selected.node?.type === 'jobrole' ? 'Job role' : 'Skill'}
                </p>
                <h2 className="mt-1 text-lg font-semibold text-foreground">{selected.node?.label}</h2>
                {selected.node?.metrics?.length ? (
                  <div className="mt-4 flex flex-wrap gap-x-6 gap-y-3">
                    {selected.node.metrics.map((metric) => (
                      <div key={metric.label}>
                        <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                          {metric.label}
                        </p>
                        <p className="mt-0.5 text-sm font-semibold text-foreground">{metric.value}</p>
                      </div>
                    ))}
                  </div>
                ) : null}
              </div>

              {selected.edges?.map((edge) => (
                <div key={edge.label} className="overflow-hidden rounded-2xl border border-border bg-card/40">
                  <div className="flex items-baseline justify-between gap-3 border-b border-border/60 px-5 py-3">
                    <p className="text-sm font-semibold text-foreground">{edge.label}</p>
                    <p className="text-[11px] text-muted-foreground">
                      {edge.shown < edge.total ? `${edge.shown} of ${edge.total.toLocaleString()}` : edge.total.toLocaleString()}
                    </p>
                  </div>
                  <div className="max-h-72 divide-y divide-border/60 overflow-auto">
                    {edge.nodes.map((node) => (
                      <button
                        key={`${node.type}-${node.id}`}
                        type="button"
                        onClick={() => void expand({ type: node.type, id: node.id, label: node.label })}
                        className="flex w-full items-center justify-between gap-3 px-5 py-2.5 text-left transition-colors hover:bg-muted/60"
                      >
                        <div className="min-w-0">
                          <p className="truncate text-sm text-foreground">{node.label}</p>
                          <p className="flex flex-wrap gap-x-3 text-[11px] text-muted-foreground">
                            {node.metrics.map((metric) => (
                              <span key={metric.label}>
                                {metric.label}: <span className="font-semibold text-foreground/80">{metric.value}</span>
                              </span>
                            ))}
                          </p>
                        </div>
                        <ChevronRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground/60" />
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </>
          )}
        </div>
      </div>
    </div>
  )
}

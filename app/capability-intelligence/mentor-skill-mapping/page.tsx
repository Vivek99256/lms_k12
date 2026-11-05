'use client'

import { useCallback, useEffect, useState } from 'react'
import { AlertCircle, CheckCircle2, GitMerge, LoaderCircle, RefreshCw, Search, Trash2, Users } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import {
  deleteMentorMapping, loadMentorCrosswalk, saveMentorMapping,
} from '../../career-intelligence/_lib/api'
import type { MentorCrosswalkPayload } from '../../career-intelligence/_lib/types'

/**
 * HR page for the Career Counseling "Suggested mentors" crosswalk: link each
 * staff skill to the O*NET skill/knowledge element it corresponds to. The
 * elements listed are text-similarity SUGGESTIONS; nothing is saved until
 * "Confirm" is pressed. "Dismiss" only hides a suggestion in this browser
 * session and is not stored.
 */
export default function MentorSkillMappingPage() {
  const [data, setData] = useState<MentorCrosswalkPayload | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [search, setSearch] = useState('')
  const [busy, setBusy] = useState('')
  const [dismissed, setDismissed] = useState<Record<string, true>>({})

  const refresh = useCallback(async (term?: string) => {
    setLoading(true)
    setError('')
    try {
      setData(await loadMentorCrosswalk(term))
    } catch (err) {
      setData(null)
      setError(err instanceof Error ? err.message : 'Could not load staff skills.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void refresh()
  }, [refresh])

  const run = async (key: string, action: () => Promise<void>) => {
    setBusy(key)
    setError('')
    try {
      await action()
      await refresh(search)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'That change could not be saved.')
    } finally {
      setBusy('')
    }
  }

  const canWrite = Boolean(data?.can_write)

  return (
    <div className="mx-auto space-y-6 p-4 md:p-6" style={{ ['--primary' as string]: '#4F46E5' }}>
      {/* Header card with subtle primary accent */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between rounded-2xl border border-border bg-card p-5 shadow-xs">
        <div className="flex min-w-0 items-start gap-3">
          <span className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 border border-primary/20 text-primary shadow-xs">
            <GitMerge className="h-5 w-5" />
          </span>
          <div className="min-w-0">
            <h1 className="text-lg font-bold tracking-tight text-foreground">Mentor Skill Mapping</h1>
            <p className="mt-1 max-w-2xl text-sm leading-relaxed text-muted-foreground">
              Link staff skills to the O*NET skills and knowledge careers require, so Career Counseling can
              suggest mentors. Suggested elements are text-similarity guesses: confirm only the ones that are
              genuinely the same capability.
            </p>
          </div>
        </div>

        <Button
          variant="outline"
          onClick={() => void refresh(search)}
          disabled={loading}
          className="h-9 shrink-0 gap-2 rounded-xl font-semibold border-border bg-background hover:bg-muted hover:text-primary transition-colors shadow-xs"
        >
          <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} /> Refresh
        </Button>
      </div>

      {/* Search Bar */}
      <form
        className="flex gap-2"
        onSubmit={(event) => { event.preventDefault(); void refresh(search) }}
      >
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search staff skills by title or keyword..."
            className="pl-9 h-10 rounded-xl border-border bg-background focus-visible:ring-primary shadow-xs"
          />
        </div>
        <Button
          type="submit"
          className="h-10 px-5 gap-2 rounded-xl bg-primary hover:bg-primary/90 text-primary-foreground font-semibold shadow-xs transition-colors"
        >
          <Search className="h-4 w-4" />
          Search
        </Button>
      </form>

      {/* Error Callout */}
      {error && (
        <div
          role="alert"
          className="flex items-center gap-2 rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive"
        >
          <AlertCircle className="h-4 w-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Loading state */}
      {loading && (
        <div className="flex items-center justify-center gap-2.5 py-12 text-sm text-muted-foreground">
          <LoaderCircle className="h-5 w-5 animate-spin text-primary" />
          <span>Loading staff skills & mappings…</span>
        </div>
      )}

      {/* Crosswalk not ready */}
      {!loading && data && !data.crosswalk_ready && (
        <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-border bg-card p-10 text-center shadow-xs">
          <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-muted text-muted-foreground mb-3">
            <GitMerge className="h-6 w-6" />
          </span>
          <h3 className="text-base font-semibold text-foreground">Mentor Matching Not Set Up</h3>
          <p className="mt-1 text-sm text-muted-foreground max-w-md">
            The mentor crosswalk table is not migrated or initialized yet for this institute.
          </p>
        </div>
      )}

      {/* Main mapping content */}
      {!loading && data?.crosswalk_ready && (
        <div className="space-y-6">
          {!canWrite && (
            <div className="flex items-center gap-2 rounded-xl border border-border bg-muted/50 px-4 py-2.5 text-xs text-muted-foreground">
              <span>You have read-only access to view mappings. Changes require elevated privileges.</span>
            </div>
          )}

          {/* Section: Unmapped staff skills */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-bold tracking-tight text-foreground flex items-center gap-2">
                Unmapped staff skills
                <Badge variant="secondary" className="rounded-full px-2 py-0.5 text-xs font-semibold bg-primary/10 text-primary">
                  {data.unmapped.length}
                </Badge>
              </h2>
            </div>

            {data.unmapped.length === 0 && (
              <div className="rounded-xl border border-border bg-card p-6 text-center text-sm text-muted-foreground shadow-xs">
                Every staff skill in use has at least one confirmed mapping.
              </div>
            )}

            <div className="grid gap-3">
              {data.unmapped.map((skill) => {
                const visible = skill.suggestions.filter((s) => !dismissed[`${skill.id}:${s.element_id}`])
                return (
                  <Card key={skill.id} className="rounded-xl border-border bg-card shadow-xs transition-shadow hover:shadow-sm">
                    <CardContent className="space-y-3 p-4">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="min-w-0">
                          <p className="text-sm font-semibold text-foreground">
                            {skill.title}
                            {skill.category && (
                              <span className="ml-2 inline-block rounded-md bg-muted px-2 py-0.5 text-xs font-normal text-muted-foreground">
                                {skill.category}
                              </span>
                            )}
                          </p>
                        </div>
                        <Badge variant="outline" className="gap-1.5 rounded-lg border-border text-xs text-muted-foreground">
                          <Users className="h-3 w-3" />
                          {skill.holder_count} staff
                        </Badge>
                      </div>

                      {visible.length === 0 && (
                        <p className="text-xs text-muted-foreground italic">
                          No similar O*NET element found. Nothing to confirm.
                        </p>
                      )}

                      {visible.map((suggestion) => {
                        const key = `${skill.id}:${suggestion.element_id}`
                        return (
                          <div
                            key={key}
                            className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border/80 bg-muted/30 p-2.5 transition-colors hover:bg-muted/50"
                          >
                            <div className="flex items-center gap-2 min-w-0">
                              <Badge className="shrink-0 rounded-md bg-primary/10 text-primary hover:bg-primary/20 border-transparent text-xs font-medium">
                                Suggestion
                              </Badge>
                              <span className="text-sm font-medium text-foreground truncate">
                                {suggestion.element_name}
                              </span>
                              <span className="text-xs text-muted-foreground shrink-0">
                                ({suggestion.element_type}, similarity {Math.round(suggestion.similarity * 100)}%)
                              </span>
                            </div>

                            {canWrite && (
                              <div className="flex items-center gap-2 shrink-0">
                                <Button
                                  size="sm"
                                  disabled={busy === key}
                                  onClick={() => void run(key, () => saveMentorMapping(skill.id, suggestion.element_id))}
                                  className="h-8 gap-1.5 rounded-lg bg-primary hover:bg-primary/90 text-primary-foreground font-semibold px-3 text-xs shadow-xs"
                                >
                                  {busy === key ? <LoaderCircle className="h-3.5 w-3.5 animate-spin" /> : <CheckCircle2 className="h-3.5 w-3.5" />}
                                  Confirm
                                </Button>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => setDismissed((current) => ({ ...current, [key]: true }))}
                                  className="h-8 rounded-lg border-border bg-background hover:bg-muted px-3 text-xs font-medium"
                                >
                                  Dismiss
                                </Button>
                              </div>
                            )}
                          </div>
                        )
                      })}
                    </CardContent>
                  </Card>
                )
              })}
            </div>
          </div>

          {/* Section: Confirmed mappings */}
          <div className="space-y-3 pt-2">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-bold tracking-tight text-foreground flex items-center gap-2">
                Confirmed mappings
                <Badge variant="secondary" className="rounded-full px-2 py-0.5 text-xs font-semibold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                  {data.mapped.length}
                </Badge>
              </h2>
            </div>

            {data.mapped.length === 0 && (
              <div className="rounded-xl border border-dashed border-border bg-card p-6 text-center text-sm text-muted-foreground shadow-xs">
                Nothing confirmed yet.
              </div>
            )}

            <div className="grid gap-2">
              {data.mapped.map((mapping) => (
                <div
                  key={mapping.id}
                  className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-card p-3 text-sm shadow-xs transition-colors hover:bg-muted/30"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="font-semibold text-foreground">
                      {mapping.skill_title ?? `Skill #${mapping.skill_id}`}
                    </span>
                    <span className="text-muted-foreground">→</span>
                    <span className="font-medium text-foreground">
                      {mapping.element_name ?? mapping.element_id}
                    </span>
                    <span className="rounded-md bg-muted px-1.5 py-0.5 text-xs text-muted-foreground">
                      {mapping.element_type}
                    </span>
                  </div>

                  {canWrite && (
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={busy === `del:${mapping.id}`}
                      onClick={() => void run(`del:${mapping.id}`, () => deleteMentorMapping(mapping.id))}
                      className="h-8 gap-1.5 rounded-lg border-border text-xs text-muted-foreground hover:bg-destructive/10 hover:border-destructive/30 hover:text-destructive transition-colors"
                    >
                      {busy === `del:${mapping.id}` ? (
                        <LoaderCircle className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <Trash2 className="h-3.5 w-3.5" />
                      )}
                      Remove
                    </Button>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

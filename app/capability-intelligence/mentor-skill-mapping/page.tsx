'use client'

import { useCallback, useEffect, useState } from 'react'
import { LoaderCircle, RefreshCw, Trash2 } from 'lucide-react'
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
    <div className="mx-auto max-w-5xl space-y-4 p-4 md:p-6">
      <div>
        <h1 className="text-xl font-semibold">Mentor skill mapping</h1>
        <p className="text-sm text-muted-foreground">
          Link staff skills to the O*NET skills and knowledge careers require, so Career Counseling can
          suggest mentors. Suggested elements are text-similarity guesses: confirm only the ones that are
          genuinely the same capability.
        </p>
      </div>

      <form
        className="flex gap-2"
        onSubmit={(event) => { event.preventDefault(); void refresh(search) }}
      >
        <Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search staff skills" />
        <Button type="submit" variant="outline"><RefreshCw />Search</Button>
      </form>

      {error && <p role="alert" className="text-sm text-red-600">{error}</p>}
      {loading && (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <LoaderCircle className="size-4 animate-spin" />Loading staff skills…
        </div>
      )}

      {!loading && data && !data.crosswalk_ready && (
        <p className="text-sm text-muted-foreground">Mentor matching is not set up yet.</p>
      )}

      {!loading && data?.crosswalk_ready && (
        <>
          {!canWrite && (
            <p className="text-sm text-muted-foreground">You can view mappings but not change them.</p>
          )}
          <h2 className="text-sm font-semibold">Unmapped staff skills ({data.unmapped.length})</h2>
          {data.unmapped.length === 0 && (
            <p className="text-sm text-muted-foreground">Every staff skill in use has at least one mapping.</p>
          )}
          {data.unmapped.map((skill) => {
            const visible = skill.suggestions.filter((s) => !dismissed[`${skill.id}:${s.element_id}`])
            return (
              <Card key={skill.id}>
                <CardContent className="space-y-2 p-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="text-sm font-medium">
                      {skill.title}
                      {skill.category && <span className="ml-2 text-xs text-muted-foreground">{skill.category}</span>}
                    </p>
                    <Badge variant="outline">{skill.holder_count} staff</Badge>
                  </div>
                  {visible.length === 0 && (
                    <p className="text-xs text-muted-foreground">No similar O*NET element found. Nothing to confirm.</p>
                  )}
                  {visible.map((suggestion) => {
                    const key = `${skill.id}:${suggestion.element_id}`
                    return (
                      <div key={key} className="flex flex-wrap items-center justify-between gap-2 rounded-md border p-2">
                        <p className="text-sm">
                          <Badge variant="secondary" className="mr-2">Suggestion</Badge>
                          {suggestion.element_name}
                          <span className="ml-2 text-xs text-muted-foreground">
                            {suggestion.element_type}, similarity {Math.round(suggestion.similarity * 100)}%
                          </span>
                        </p>
                        {canWrite && (
                          <div className="flex gap-2">
                            <Button
                              size="sm"
                              disabled={busy === key}
                              onClick={() => void run(key, () => saveMentorMapping(skill.id, suggestion.element_id))}
                            >
                              Confirm
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => setDismissed((current) => ({ ...current, [key]: true }))}
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

          <h2 className="pt-2 text-sm font-semibold">Confirmed mappings ({data.mapped.length})</h2>
          {data.mapped.length === 0 && <p className="text-sm text-muted-foreground">Nothing confirmed yet.</p>}
          {data.mapped.map((mapping) => (
            <div key={mapping.id} className="flex flex-wrap items-center justify-between gap-2 rounded-md border p-2 text-sm">
              <span>
                {mapping.skill_title ?? `Skill #${mapping.skill_id}`} → {mapping.element_name ?? mapping.element_id}
                <span className="ml-2 text-xs text-muted-foreground">{mapping.element_type}</span>
              </span>
              {canWrite && (
                <Button
                  size="sm"
                  variant="outline"
                  disabled={busy === `del:${mapping.id}`}
                  onClick={() => void run(`del:${mapping.id}`, () => deleteMentorMapping(mapping.id))}
                >
                  <Trash2 />Remove
                </Button>
              )}
            </div>
          ))}
        </>
      )}
    </div>
  )
}

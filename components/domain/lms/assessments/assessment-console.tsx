'use client'

/**
 * THE ADMINISTRATOR'S CONSOLE for assessments — read a draft before
 * publishing it, see who has sat what, and decide what a result means.
 *
 * Ported from g2gv0's `components/domain/competency/cm-assessment-console.tsx`
 * (`CmAssessmentConsole`) verbatim in JSX/logic, renamed `AssessmentConsole`,
 * with two changes:
 *   - Session plumbing: `useAuth()` + `getLaravelContext(user)` →
 *     `buildSessionContext()`.
 *   - `AssignDialog`'s people list: g2gv0 read it from `taskService
 *     .getAssignmentUsers` (a Task module this package does not own). This
 *     package already lists tenant users for the Users tab of Administration
 *     & Governance, so `AssignDialog` reuses
 *     `lmsAdministrationGovernanceService.users()` instead of introducing a
 *     new out-of-scope dependency.
 *   - The publish/unpublish action (`aiAssessmentService.publish`) has no
 *     mapped endpoint in this package's scope (see assessments-service.ts —
 *     AI generation and publishing were not ported). The publish button is
 *     kept but disabled, honestly labelled, rather than wired to nothing.
 *
 * ⚠ THIS COMPONENT RENDERS CORRECT ANSWERS. Mount it only behind an
 * administer-gated tab, matching g2gv0's `profile:admin,hr` route guard.
 */

import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  AlertTriangle, CheckCircle2, ClipboardList, Eye, FileQuestion, Send, Users, XCircle,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { StatusBadge } from '@/components/ui/status-badge'
import {
  Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle,
} from '@/components/ui/sheet'
import { cn } from '@/lib/utils'
import { buildSessionContext, type SessionContext } from '@/lib/erp-client'
import { lmsAssessmentsService } from './assessments-service'
import { lmsAdministrationGovernanceService } from '@/components/domain/lms/administration-governance/administration-governance-service'
import type {
  AssessmentQuestionFull, AssessmentTestRow, AttemptAnswer,
  AttemptRow, ProposalRow, RatingBands,
} from './types'
import { LoadState } from './load-state'

type Tab = 'tests' | 'results' | 'proposals'

const TABS: Array<{ id: Tab; label: string; icon: typeof FileQuestion }> = [
  { id: 'tests', label: 'Assessments', icon: FileQuestion },
  { id: 'results', label: 'Results', icon: ClipboardList },
  { id: 'proposals', label: 'Rating proposals', icon: CheckCircle2 },
]

export function AssessmentConsole() {
  const session = useMemo(() => buildSessionContext(), [])
  const [tab, setTab] = useState<Tab>('tests')
  const [notice, setNotice] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  return (
    <section className="rounded-2xl border border-primary/10 bg-card/90 p-5 shadow-sm">
      <div className="mb-4 flex flex-wrap items-baseline justify-between gap-3">
        <div>
          <h2 className="text-sm font-bold uppercase tracking-wider text-foreground">
            Assessment console
          </h2>
          <p className="text-xs text-muted-foreground">
            Read a draft before publishing it, see who has sat what, and decide what a result means.
          </p>
        </div>
      </div>

      <div role="tablist" aria-label="Assessment console" className="mb-4 flex gap-1 rounded-lg bg-muted p-1">
        {TABS.map(({ id, label, icon: Icon }) => (
          <button key={id} type="button" role="tab" aria-selected={tab === id}
            onClick={() => { setTab(id); setNotice(null); setError(null) }}
            className={cn('flex flex-1 items-center justify-center gap-2 rounded-md px-3 py-1.5 text-sm font-medium transition-colors',
              tab === id ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground')}>
            <Icon className="size-4" aria-hidden="true" />
            {label}
          </button>
        ))}
      </div>

      {error && (
        <p className="mb-3 rounded-xl border border-destructive/30 bg-destructive/5 px-4 py-2.5 text-sm font-medium text-destructive">
          {error}
        </p>
      )}
      {notice && (
        <p className="mb-3 rounded-xl border border-success/30 bg-success/10 px-4 py-2.5 text-sm font-medium text-success">
          {notice}
        </p>
      )}

      {tab === 'tests' && <TestsTab session={session} onNotice={setNotice} onError={setError} />}
      {tab === 'results' && <ResultsTab session={session} onNotice={setNotice} onError={setError} />}
      {tab === 'proposals' && <ProposalsTab session={session} onNotice={setNotice} onError={setError} />}
    </section>
  )
}

/* ────────────────────────────── ASSESSMENTS ───────────────────────────── */

function TestsTab({ session, onNotice, onError }: TabProps) {
  const [rows, setRows] = useState<AssessmentTestRow[] | null>(null)
  const [open, setOpen] = useState<AssessmentTestRow | null>(null)

  const [failure, setFailure] = useState<string | null>(null)

  const load = useCallback(() => {
    setFailure(null)
    lmsAssessmentsService.tests(session)
      .then(setRows)
      .catch((e) => setFailure(e instanceof Error ? e.message : 'Assessments could not be loaded.'))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => { load() }, [load])

  return (
    <LoadState error={failure} rows={rows} onRetry={load}
      emptyIcon={<FileQuestion className="size-10" />}
      emptyTitle="No assessments yet"
      emptyDescription="Assessments published for a job role appear here once they exist.">
      <div className="overflow-hidden rounded-xl border border-border bg-background">
        <table className="w-full text-left text-sm">
          <thead className="bg-muted/50 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            <tr>
              <th className="px-4 py-2.5">Assessment</th>
              <th className="px-4 py-2.5">Scope</th>
              <th className="px-4 py-2.5 text-right">Questions</th>
              <th className="px-4 py-2.5 text-right">Sat</th>
              <th className="px-4 py-2.5">Status</th>
              <th className="px-4 py-2.5" />
            </tr>
          </thead>
          <tbody>
            {(rows ?? []).map((t) => (
              <tr key={t.id} className="border-t border-border">
                <td className="px-4 py-2.5">
                  <p className="font-medium text-foreground">{t.title}</p>
                  <p className="text-xs text-muted-foreground">
                    {t.jobrole ?? 'no role'}
                    {t.time_limit_minutes ? ` · ${t.time_limit_minutes} min` : ' · untimed'}
                    {t.pass_percent !== null ? ` · pass ${t.pass_percent}%` : ' · no pass mark'}
                    {t.is_open ? ' · open to everyone' : ''}
                  </p>
                </td>
                <td className="px-4 py-2.5 text-xs">
                  {t.scope_type === 'competency' ? (t.competency_name ?? 'one competency')
                    : t.scope_type === 'kasba_item' ? 'one KASBA item'
                    : 'whole job role'}
                </td>
                <td className="px-4 py-2.5 text-right tabular-nums">{t.questions}</td>
                <td className="px-4 py-2.5 text-right tabular-nums">
                  {t.submitted} / {t.assigned}
                  {t.awaiting_review > 0 && (
                    <span className="ml-1.5 rounded bg-warning/15 px-1.5 py-0.5 text-[11px] text-warning">
                      {t.awaiting_review} to mark
                    </span>
                  )}
                </td>
                <td className="px-4 py-2.5">
                  <StatusPill status={t.status} />
                </td>
                <td className="px-4 py-2.5 text-right">
                  <Button variant="ghost" size="sm" onClick={() => setOpen(t)}>
                    <Eye className="size-3.5" aria-hidden="true" />
                    Review
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <TestDrawer test={open} session={session} onClose={() => setOpen(null)}
        onChanged={(m) => { onNotice(m); load() }} onError={onError} />
    </LoadState>
  )
}

/** The draft, readable — questions WITH their answers. */
function TestDrawer({ test, session, onClose, onChanged, onError }: {
  test: AssessmentTestRow | null
  session: SessionContext
  onClose: () => void
  onChanged: (message: string) => void
  onError: (message: string) => void
}) {
  const [questions, setQuestions] = useState<AssessmentQuestionFull[] | null>(null)
  const [assignOpen, setAssignOpen] = useState(false)

  useEffect(() => {
    if (!test) { setQuestions(null); setAssignOpen(false); return }
    let active = true
    lmsAssessmentsService.test(test.id, session)
      .then((r) => { if (active) setQuestions(r.questions) })
      .catch((e) => { if (active) { setQuestions([]); onError(e instanceof Error ? e.message : 'Questions could not be loaded.') } })
    return () => { active = false }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [test])

  if (!test) return null

  return (
    <Sheet open onOpenChange={(o) => { if (!o) onClose() }}>
      <SheetContent side="right" className="flex w-full flex-col p-0 sm:max-w-3xl">
        <SheetHeader className="shrink-0 border-b px-6 py-4">
          <SheetTitle className="pr-10">{test.title}</SheetTitle>
          <SheetDescription>
            {test.questions} question(s) · written by {test.model ?? 'an unknown model'} · <StatusPill status={test.status} inline />
          </SheetDescription>
        </SheetHeader>

        <div className="flex-1 space-y-4 overflow-y-auto p-6">
          <p className="flex items-start gap-2 rounded-md border border-warning/40 bg-warning/5 p-3 text-xs">
            <AlertTriangle className="mt-0.5 size-3.5 shrink-0 text-warning" aria-hidden="true" />
            <span>
              A language model wrote these questions and the answers they are marked against.
              <strong> Read them before publishing</strong> — once published, people are assessed on them.
            </span>
          </p>

          {questions === null && <Skeleton className="h-40 w-full" />}

          {questions?.map((q, index) => (
            <div key={q.id} className="rounded-xl border border-border bg-background p-4">
              <div className="flex items-start gap-3">
                <span className="mt-0.5 w-5 shrink-0 text-xs tabular-nums text-muted-foreground">{index + 1}</span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-foreground">{q.question_text}</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {q.cited_item_label ?? 'capability item'}
                    {q.cited_kasba_type ? ` · ${q.cited_kasba_type}` : ''}
                    {q.cited_competency_name ? ` · ${q.cited_competency_name}` : ''}
                    {q.cited_required_proficiency ? ` · needs level ${q.cited_required_proficiency}` : ''}
                    {' · '}{q.max_score} mark{q.max_score === 1 ? '' : 's'}
                  </p>

                  {q.format === 'mcq' && q.options ? (
                    <ul className="mt-2 space-y-1">
                      {q.options.map((opt) => {
                        const correct = opt === q.correct_option
                        return (
                          <li key={opt} className={cn('flex items-center gap-2 rounded px-2 py-1 text-sm',
                            correct ? 'bg-success/10 font-medium text-success' : 'text-muted-foreground')}>
                            {correct
                              ? <CheckCircle2 className="size-3.5 shrink-0" aria-hidden="true" />
                              : <span className="size-3.5 shrink-0" />}
                            {opt}
                          </li>
                        )
                      })}
                      {!q.options.includes(q.correct_option ?? '') && (
                        <li className="text-xs text-destructive">
                          This question has no correct option among its choices and cannot be scored.
                        </li>
                      )}
                    </ul>
                  ) : (
                    <div className="mt-2 rounded border border-border bg-muted/30 p-2 text-xs">
                      <p className="font-medium text-foreground">Marked against:</p>
                      <p className="mt-0.5 text-muted-foreground">{q.model_answer ?? 'no reference answer — marked on the question alone'}</p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>

        <div className="flex shrink-0 flex-wrap items-center gap-2 border-t bg-background p-4">
          {test.status === 'published' ? (
            <Button onClick={() => setAssignOpen(true)}>
              <Users className="size-4" aria-hidden="true" />
              Assign to people
            </Button>
          ) : (
            <Button
              disabled
              title="Publishing is not available in this package — assessment authoring stays with the source that generated it."
            >
              <Send className="size-4" aria-hidden="true" />
              Publish
            </Button>
          )}
          <Button variant="ghost" onClick={onClose}>Close</Button>
        </div>

        {assignOpen && (
          <AssignDialog testId={test.id} session={session} onClose={() => setAssignOpen(false)}
            onDone={(m) => { setAssignOpen(false); onChanged(m); onClose() }} onError={onError} />
        )}
      </SheetContent>
    </Sheet>
  )
}

function AssignDialog({ testId, session, onClose, onDone, onError }: {
  testId: number
  session: SessionContext
  onClose: () => void
  onDone: (message: string) => void
  onError: (message: string) => void
}) {
  const [people, setPeople] = useState<Array<{ id: number; name: string }>>([])
  const [picked, setPicked] = useState<number[]>([])
  const [due, setDue] = useState('')
  const [search, setSearch] = useState('')
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    // Reused from Administration & Governance's own user list, rather than a
    // new out-of-scope Task module dependency (see file header).
    lmsAdministrationGovernanceService.users(session, { perPage: 200 })
      .then((res) => setPeople((res.data ?? []).map((u) => ({ id: u.id, name: u.full_name || u.user_name || `User ${u.id}` }))))
      .catch(() => setPeople([]))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const visible = useMemo(() => {
    const q = search.trim().toLowerCase()
    return q ? people.filter((p) => p.name.toLowerCase().includes(q)) : people
  }, [people, search])

  async function assign() {
    setBusy(true)
    try {
      const res = await lmsAssessmentsService.assign(testId, picked, session, due || undefined)
      onDone(res.message)
    } catch (e) {
      onError(e instanceof Error ? e.message : 'These people could not be assigned.')
    } finally { setBusy(false) }
  }

  return (
    <div className="absolute inset-0 z-50 flex flex-col bg-background">
      <div className="border-b p-4">
        <h3 className="text-sm font-semibold">Assign this assessment</h3>
        <p className="mt-0.5 text-xs text-muted-foreground">
          Assigned people see it in their own list. Anyone whose job role the assessment targets can
          already take it without being assigned.
        </p>
      </div>
      <div className="flex flex-1 flex-col gap-3 overflow-y-auto p-4">
        <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search people…" className="h-9" />
        <label className="text-xs font-medium text-muted-foreground">
          Due date (optional)
          <Input type="date" value={due} onChange={(e) => setDue(e.target.value)} className="mt-1 h-9" />
        </label>
        <div className="overflow-hidden rounded-md border border-border">
          {visible.map((p) => (
            <label key={p.id} className="flex items-center gap-2 border-b border-border px-3 py-1.5 text-sm last:border-b-0">
              <input type="checkbox" checked={picked.includes(p.id)}
                onChange={(e) => setPicked((c) => e.target.checked ? [...c, p.id] : c.filter((i) => i !== p.id))} />
              {p.name}
            </label>
          ))}
          {visible.length === 0 && <p className="p-3 text-xs text-muted-foreground">Nobody matches that.</p>}
        </div>
      </div>
      <div className="flex items-center gap-2 border-t p-4">
        <Button disabled={busy || picked.length === 0} onClick={() => void assign()}>
          {busy ? 'Assigning…' : `Assign to ${picked.length} person(s)`}
        </Button>
        <Button variant="outline" onClick={onClose}>Cancel</Button>
      </div>
    </div>
  )
}

/* ──────────────────────────────── RESULTS ─────────────────────────────── */

function ResultsTab({ session, onNotice, onError }: TabProps) {
  const [rows, setRows] = useState<AttemptRow[] | null>(null)
  const [open, setOpen] = useState<AttemptRow | null>(null)

  const [failure, setFailure] = useState<string | null>(null)

  const load = useCallback(() => {
    setFailure(null)
    lmsAssessmentsService.attempts(session)
      .then(setRows)
      .catch((e) => setFailure(e instanceof Error ? e.message : 'Results could not be loaded.'))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => { load() }, [load])

  return (
    <LoadState error={failure} rows={rows} onRetry={load}
      emptyIcon={<ClipboardList className="size-10" />}
      emptyTitle="Nobody has sat an assessment yet"
      emptyDescription="Once an assessment is assigned and taken, results appear here.">
      <div className="overflow-hidden rounded-xl border border-border bg-background">
        <table className="w-full text-left text-sm">
          <thead className="bg-muted/50 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            <tr>
              <th className="px-4 py-2.5">Person</th>
              <th className="px-4 py-2.5">Assessment</th>
              <th className="px-4 py-2.5 text-right">Score</th>
              <th className="px-4 py-2.5">State</th>
              <th className="px-4 py-2.5" />
            </tr>
          </thead>
          <tbody>
            {(rows ?? []).map((a) => (
              <tr key={a.id} className="border-t border-border">
                <td className="px-4 py-2.5 font-medium text-foreground">{a.employee || `User ${a.user_id}`}</td>
                <td className="px-4 py-2.5 text-xs text-muted-foreground">{a.title}</td>
                <td className="px-4 py-2.5 text-right tabular-nums">
                  {a.submitted_at
                    ? <>{a.percent !== null ? `${Number(a.percent).toFixed(0)}%` : '—'}
                        <span className="ml-1 text-xs text-muted-foreground">({a.total_score}/{a.max_score})</span></>
                    : <span className="text-xs text-muted-foreground">not submitted</span>}
                </td>
                <td className="px-4 py-2.5">
                  {a.awaiting_review > 0
                    ? <span className="rounded bg-warning/15 px-1.5 py-0.5 text-[11px] text-warning">{a.awaiting_review} to mark</span>
                    : <StatusPill status={a.status} />}
                </td>
                <td className="px-4 py-2.5 text-right">
                  <Button variant="ghost" size="sm" disabled={!a.submitted_at} onClick={() => setOpen(a)}>
                    <Eye className="size-3.5" aria-hidden="true" />
                    Answers
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <AnswersDrawer attempt={open} session={session} onClose={() => setOpen(null)}
        onChanged={(m) => { onNotice(m); load() }} onError={onError} />
    </LoadState>
  )
}

/** Every answer, with the reference beside it, so a written one can be marked. */
function AnswersDrawer({ attempt, session, onClose, onChanged, onError }: {
  attempt: AttemptRow | null
  session: SessionContext
  onClose: () => void
  onChanged: (message: string) => void
  onError: (message: string) => void
}) {
  const [answers, setAnswers] = useState<AttemptAnswer[] | null>(null)
  const [marks, setMarks] = useState<Record<number, string>>({})
  const [busy, setBusy] = useState<number | null>(null)

  const load = useCallback(() => {
    if (!attempt) return
    lmsAssessmentsService.answers(attempt.id, session)
      .then((r) => setAnswers(r.answers))
      .catch((e) => { setAnswers([]); onError(e instanceof Error ? e.message : 'Answers could not be loaded.') })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [attempt])

  useEffect(() => { if (attempt) load(); else setAnswers(null) }, [attempt, load])

  async function mark(responseId: number, score: number) {
    setBusy(responseId)
    try {
      const res = await lmsAssessmentsService.scoreAnswer(responseId, score, session)
      onChanged(res.message)
      load()
    } catch (e) {
      onError(e instanceof Error ? e.message : 'That mark could not be saved.')
    } finally { setBusy(null) }
  }

  if (!attempt) return null

  return (
    <Sheet open onOpenChange={(o) => { if (!o) onClose() }}>
      <SheetContent side="right" className="flex w-full flex-col p-0 sm:max-w-3xl">
        <SheetHeader className="shrink-0 border-b px-6 py-4">
          <SheetTitle className="pr-10">{attempt.employee || `User ${attempt.user_id}`}</SheetTitle>
          <SheetDescription>
            {attempt.title} · {attempt.percent !== null ? `${Number(attempt.percent).toFixed(0)}%` : 'not scored'}
            {attempt.awaiting_review > 0 ? ` · ${attempt.awaiting_review} still to mark` : ''}
          </SheetDescription>
        </SheetHeader>

        <div className="flex-1 space-y-3 overflow-y-auto p-6">
          {answers === null && <Skeleton className="h-40 w-full" />}
          {answers?.map((a, index) => {
            const unmarked = a.score === null
            return (
              <div key={a.question_id} className="rounded-xl border border-border bg-background p-4">
                <div className="flex items-start gap-3">
                  <span className="mt-0.5 w-5 shrink-0 text-xs tabular-nums text-muted-foreground">{index + 1}</span>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-foreground">{a.question_text}</p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {a.cited_item_label ?? 'capability item'} · {a.max_score} mark{a.max_score === 1 ? '' : 's'}
                    </p>

                    <div className="mt-2 rounded border border-border bg-muted/20 p-2 text-sm">
                      <p className="text-xs font-medium text-muted-foreground">Their answer</p>
                      <p className="mt-0.5 text-foreground">
                        {a.answer_text || a.selected_option || <span className="text-muted-foreground">not answered</span>}
                      </p>
                    </div>

                    {a.format === 'mcq' ? (
                      <p className="mt-1.5 text-xs text-muted-foreground">Correct answer: <strong>{a.correct_option}</strong></p>
                    ) : (
                      <p className="mt-1.5 text-xs text-muted-foreground">
                        Marked against: {a.model_answer ?? 'no reference answer'}
                      </p>
                    )}

                    <div className="mt-2 flex flex-wrap items-center gap-2">
                      <span className={cn('text-xs font-medium', unmarked ? 'text-warning' : 'text-foreground')}>
                        {unmarked
                          ? (a.answered_at ? 'Not marked yet' : 'Not answered')
                          : `${Number(a.score)} / ${a.max_score}${a.scored_by ? ` · ${a.scored_by === 'auto' ? 'automatic' : a.scored_by === 'ai' ? 'AI' : 'by a person'}` : ''}`}
                      </span>

                      {a.format !== 'mcq' && a.response_id && (
                        <span className="flex items-center gap-1.5">
                          <Input type="number" min={0} max={a.max_score} step="0.5"
                            value={marks[a.response_id] ?? (a.score !== null ? String(a.score) : '')}
                            onChange={(e) => setMarks((m) => ({ ...m, [a.response_id as number]: e.target.value }))}
                            className="h-8 w-20" />
                          <Button size="sm" variant="outline"
                            disabled={busy === a.response_id || (marks[a.response_id] ?? '') === ''}
                            onClick={() => void mark(a.response_id as number, Number(marks[a.response_id as number]))}>
                            {busy === a.response_id ? 'Saving…' : 'Mark'}
                          </Button>
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            )
          })}
        </div>

        <div className="shrink-0 border-t bg-background p-4">
          <Button variant="outline" onClick={onClose}>Close</Button>
        </div>
      </SheetContent>
    </Sheet>
  )
}

/* ─────────────────────────────── PROPOSALS ────────────────────────────── */

function ProposalsTab({ session, onNotice, onError }: TabProps) {
  const [rows, setRows] = useState<ProposalRow[] | null>(null)
  const [bands, setBands] = useState<RatingBands>({})
  const [minQ, setMinQ] = useState(2)
  const [busy, setBusy] = useState<number | null>(null)

  const [failure, setFailure] = useState<string | null>(null)

  const load = useCallback(() => {
    setFailure(null)
    lmsAssessmentsService.proposals(session)
      .then((r) => { setRows(r.rows); setBands(r.bands); setMinQ(r.minQuestions) })
      .catch((e) => setFailure(e instanceof Error ? e.message : 'Proposals could not be loaded.'))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => { load() }, [load])

  async function decide(id: number, decision: 'approve' | 'reject') {
    setBusy(id)
    try {
      const res = await lmsAssessmentsService.decide(id, decision, session)
      onNotice(res.message)
      load()
    } catch (e) {
      onError(e instanceof Error ? e.message : 'That decision could not be saved.')
    } finally { setBusy(null) }
  }

  return (
    <LoadState error={failure} rows={rows} onRetry={load}
      emptyIcon={<CheckCircle2 className="size-10" />}
      emptyTitle="Nothing waiting on you"
      emptyDescription="When someone completes an assessment, the rating it suggests waits here for your decision.">
    <div className="flex flex-col gap-3">
      <p className="rounded-xl border border-border bg-muted/30 p-3 text-xs text-muted-foreground">
        Nothing here has changed anyone&apos;s record. Approving writes the rating with its source
        recorded as an assessment, so it stays distinguishable from one a person typed. An item scored
        on fewer than <strong>{minQ}</strong> questions proposes no rating at all —
        {' '}too little evidence is reported as such, not as a low score.
      </p>

      <div className="overflow-hidden rounded-xl border border-border bg-background">
        <table className="w-full text-left text-sm">
          <thead className="bg-muted/50 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            <tr>
              <th className="px-4 py-2.5">Person</th>
              <th className="px-4 py-2.5">Capability item</th>
              <th className="px-4 py-2.5 text-right">Evidence</th>
              <th className="px-4 py-2.5 text-center">Now → suggested</th>
              <th className="px-4 py-2.5" />
            </tr>
          </thead>
          <tbody>
            {(rows ?? []).map((p) => (
              <tr key={p.id} className="border-t border-border">
                <td className="px-4 py-2.5 font-medium text-foreground">{p.employee || `User ${p.user_id}`}</td>
                <td className="px-4 py-2.5">
                  <p className="text-foreground">{p.item_label ?? 'capability item'}</p>
                  <p className="text-xs text-muted-foreground">
                    {p.kasba_type}{p.competency_name ? ` · ${p.competency_name}` : ''}
                    {p.test_title ? ` · ${p.test_title}` : ''}
                  </p>
                </td>
                <td className="px-4 py-2.5 text-right text-xs tabular-nums">
                  {p.scored_percent !== null ? `${Number(p.scored_percent).toFixed(0)}%` : '—'}
                  <span className="text-muted-foreground"> on {p.questions}q</span>
                </td>
                <td className="px-4 py-2.5 text-center">
                  {p.proposed_rating === null ? (
                    <span className="text-xs text-muted-foreground">too little evidence</span>
                  ) : (
                    <span className="text-sm tabular-nums">
                      <span className="text-muted-foreground">{p.current_rating ?? '–'}</span>
                      {' → '}
                      <strong className={cn(p.current_rating !== null && p.proposed_rating < p.current_rating
                        ? 'text-warning' : 'text-success')}>{p.proposed_rating}</strong>
                      <span className="ml-1.5 text-[11px] text-muted-foreground">
                        {bands[String(p.proposed_rating)]?.label?.split(' - ')[0]}
                      </span>
                    </span>
                  )}
                </td>
                <td className="px-4 py-2.5 text-right">
                  <span className="inline-flex gap-1">
                    <Button size="sm" variant="ghost" disabled={busy === p.id || p.proposed_rating === null}
                      onClick={() => void decide(p.id, 'approve')} title="Write this rating">
                      <CheckCircle2 className="size-3.5 text-success" aria-hidden="true" />
                      Approve
                    </Button>
                    <Button size="sm" variant="ghost" disabled={busy === p.id}
                      onClick={() => void decide(p.id, 'reject')} title="Keep the current rating">
                      <XCircle className="size-3.5 text-muted-foreground" aria-hidden="true" />
                      Reject
                    </Button>
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
    </LoadState>
  )
}

/* ──────────────────────────────── shared ──────────────────────────────── */

interface TabProps {
  session: SessionContext
  onNotice: (message: string) => void
  onError: (message: string) => void
}

function StatusPill({ status, inline }: { status: string; inline?: boolean }) {
  const variant = status === 'published' ? 'success'
    : status === 'superseded' ? 'inactive'
    : status === 'awaiting_review' ? 'warning'
    : status === 'scored' ? 'success'
    : 'processing'

  return (
    <StatusBadge
      variant={variant}
      label={status.replace(/_/g, ' ')}
      size="sm"
      className={cn('capitalize', inline && 'ml-1')}
    />
  )
}

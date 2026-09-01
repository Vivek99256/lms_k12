'use client';

import { Suspense, useCallback, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { AlertTriangle, CheckCircle2, Loader2, Lock, Sparkles, Target } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import {
  defaultLearnerId,
  fetchDiagnosticItems,
  fetchNextAction,
  fetchPracticeItem,
  fetchRetrievalItems,
  recordAttempt,
  renderInstruction,
  submitDiagnostic,
  submitRetrievalCheck,
  type DiagnosticItem,
  type EsoAction,
  type EsoQuestion,
  type PracticeItem,
} from '@/app/pal/data/pal-eso';
import { useViewAsStudent } from '@/app/pal/data/pal-view-as';

/**
 * The Adaptive Learning Engine's guided concept flow — Developer Brief v1,
 * Phase 11/§H. Sequences diagnostic -> skip/teach -> misconception
 * correction -> practice -> mastery -> retention as ONE screen, calling
 * app/pal/data/pal-eso.ts throughout. This screen never decides what to
 * teach; it only renders whatever `action`/`llmInstruction` the engine
 * returns (see EsoPolicyService on the backend) — Pal's rendered text is a
 * courtesy, the plain instruction is always shown as a fallback.
 */
export default function EsoConceptFlowPage() {
  return (
    <Suspense fallback={<CenteredSpinner label="Loading..." />}>
      <EsoConceptFlow />
    </Suspense>
  );
}

function CenteredSpinner({ label }: { label: string }) {
  return (
    <div className="flex min-h-[50vh] items-center justify-center text-sm text-slate-500">
      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
      {label}
    </div>
  );
}

function EsoConceptFlow() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const viewAsStudent = useViewAsStudent();

  const conceptId = Number(searchParams.get('conceptId') || '0');
  // The real student entry point (AdaptiveLearningButton) never puts
  // learnerId in this URL — it always resolves to defaultLearnerId(), the
  // authenticated session's own id. `?learnerId=` is read here only for
  // backward compatibility with any old link; it is never authoritative —
  // the backend independently derives and enforces the learner from the
  // caller's own JWT for every route below (EsoStudentOnlyAuth), so a
  // student-role caller passing anyone else's id is rejected regardless of
  // what this resolves to, and a staff/admin caller is rejected outright.
  const learnerId = searchParams.get('learnerId') || viewAsStudent?.studentId || defaultLearnerId();

  const [action, setAction] = useState<EsoAction | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!conceptId || !learnerId) return;
    setLoading(true);
    setError(null);
    try {
      setAction(await fetchNextAction(learnerId, conceptId));
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Unable to load the next learning step.');
    } finally {
      setLoading(false);
    }
  }, [learnerId, conceptId]);

  useEffect(() => {
    // Deferred to a microtask so the setLoading/setError calls inside
    // refresh() don't fire synchronously within the effect body — same
    // convention as pal-view-as.ts's useViewAsStudent().
    queueMicrotask(() => {
      void refresh();
    });
  }, [refresh]);

  if (!conceptId) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-10">
        <Alert>A concept must be selected to start the adaptive flow (add ?conceptId=... to the URL).</Alert>
      </div>
    );
  }

  return (
    <div className="mx-auto  px-4 py-6 sm:px-6">
      <div className="mb-4 flex items-center gap-2 text-sm text-slate-500">
        <Sparkles className="h-4 w-4 text-violet-500" />
        Adaptive learning
      </div>

      {loading && <CenteredSpinner label="Deciding what you need next..." />}
      {!loading && error && <Alert tone="error">{error}</Alert>}

      {!loading && !error && action && (
        <div data-eso-action={action.action} data-eso-node-id={action.nodeId ?? ''}>
          <FlowStep
            key={`${action.action}-${action.nodeId ?? ''}-${action.conceptId ?? conceptId}`}
            action={action}
            learnerId={learnerId}
            conceptId={conceptId}
            onAdvance={refresh}
            onNavigateToConcept={(id) => router.push(`/pal/eso?conceptId=${id}${learnerId ? `&learnerId=${learnerId}` : ''}`)}
          />
        </div>
      )}
    </div>
  );
}

function Alert({ children, tone = 'info' }: { children: React.ReactNode; tone?: 'info' | 'error' }) {
  return (
    <div
      className={`rounded-lg border px-4 py-3 text-sm ${
        tone === 'error' ? 'border-rose-200 bg-rose-50 text-rose-700' : 'border-slate-200 bg-slate-50 text-slate-600'
      }`}
    >
      {children}
    </div>
  );
}

function FlowStep({
  action,
  learnerId,
  conceptId,
  onAdvance,
  onNavigateToConcept,
}: {
  action: EsoAction;
  learnerId: string;
  conceptId: number;
  onAdvance: () => void;
  onNavigateToConcept: (conceptId: number) => void;
}) {
  switch (action.action) {
    case 'diagnostic':
      return <DiagnosticStep learnerId={learnerId} conceptId={conceptId} onAdvance={onAdvance} />;
    case 'remediate_prerequisite':
      return <PrerequisiteStep action={action} onNavigateToConcept={onNavigateToConcept} />;
    case 'teach':
    case 'practice':
      return <TeachOrPracticeStep action={action} learnerId={learnerId} conceptId={conceptId} onAdvance={onAdvance} />;
    case 'serve_contrast_pair':
      return <ContrastPairStep action={action} learnerId={learnerId} conceptId={conceptId} onAdvance={onAdvance} />;
    case 'mastered_stop_practice':
      return <MasteredStep action={action} />;
    case 'retrieval_due':
      return <RetrievalDueStep action={action} learnerId={learnerId} conceptId={conceptId} onAdvance={onAdvance} />;
    case 'no_nodes_defined':
      return (
        <Alert>
          This concept has no Knowledge/Ability/Skill nodes tagged yet — Phase 0 content tagging has not reached it.
        </Alert>
      );
    default:
      return <Alert>{action.action}</Alert>;
  }
}

// ── D1: diagnostic ───────────────────────────────────────────────────────

function DiagnosticStep({ learnerId, conceptId, onAdvance }: { learnerId: string; conceptId: number; onAdvance: () => void }) {
  const [items, setItems] = useState<DiagnosticItem[] | null>(null);
  const [answers, setAnswers] = useState<Record<number, number>>({});
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetchDiagnosticItems(learnerId, conceptId)
      .then((data) => {
        if (!cancelled) setItems(data);
      })
      .catch((reason) => {
        if (!cancelled) setError(reason instanceof Error ? reason.message : 'Unable to load the diagnostic.');
      });
    return () => {
      cancelled = true;
    };
  }, [learnerId, conceptId]);

  if (error) return <Alert tone="error">{error}</Alert>;
  if (items === null) return <CenteredSpinner label="Building your diagnostic..." />;
  if (items.length === 0) {
    return <Alert>No diagnostic questions are tagged for this concept yet — Phase 0 tagging is still in progress.</Alert>;
  }

  const answeredCount = Object.keys(answers).length;

  const submit = async () => {
    setSubmitting(true);
    setError(null);
    try {
      await submitDiagnostic(
        learnerId,
        conceptId,
        items.map((item) => ({ nodeId: item.nodeId, answerMasterId: answers[item.questionId] })).filter((r) => r.answerMasterId != null)
      );
      onAdvance();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Unable to submit the diagnostic.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Quick diagnostic</CardTitle>
        <CardDescription>A few questions to find out what you already know, so we can skip it.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {items.map((item, index) => (
          <div key={item.questionId} data-eso-question-id={item.questionId} data-eso-node-id={item.nodeId} className="rounded-lg border border-slate-200 p-4">
            <div className="mb-2 flex items-center gap-2">
              <span className="flex h-6 w-6 items-center justify-center rounded-full bg-violet-50 text-xs font-semibold text-violet-600">
                {index + 1}
              </span>
              <Badge variant="secondary">{item.nodeType}</Badge>
            </div>
            <div className="text-sm font-medium text-slate-900" dangerouslySetInnerHTML={{ __html: item.title }} />
            <div className="mt-2 space-y-1.5">
              {item.options.map((option) => (
                <label
                  key={option.id}
                  data-eso-option-id={option.id}
                  className={`flex cursor-pointer items-center gap-2.5 rounded-lg border px-3 py-2 text-sm transition-colors ${
                    answers[item.questionId] === option.id ? 'border-violet-400 bg-violet-50' : 'border-slate-200 hover:bg-slate-50'
                  }`}
                >
                  <input
                    type="radio"
                    name={`diagnostic-${item.questionId}`}
                    checked={answers[item.questionId] === option.id}
                    onChange={() => setAnswers((prev) => ({ ...prev, [item.questionId]: option.id }))}
                    className="h-4 w-4 accent-violet-600"
                  />
                  <span dangerouslySetInnerHTML={{ __html: option.answer }} />
                </label>
              ))}
            </div>
          </div>
        ))}

        {error && <Alert tone="error">{error}</Alert>}

        <div className="flex items-center justify-between">
          <span className="text-xs text-slate-500">
            {answeredCount} of {items.length} answered
          </span>
          <Button data-eso-submit onClick={submit} disabled={submitting || answeredCount === 0}>
            {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Target className="h-4 w-4" />}
            Submit diagnostic
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

// ── D2: prerequisite gate ────────────────────────────────────────────────

function PrerequisiteStep({ action, onNavigateToConcept }: { action: EsoAction; onNavigateToConcept: (id: number) => void }) {
  return (
    <Card className="border-amber-200 bg-amber-50">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-amber-900">
          <Lock className="h-5 w-5" />
          A prerequisite needs work first
        </CardTitle>
        <CardDescription className="text-amber-700">
          You&apos;re not quite ready for this concept yet — a concept it builds on isn&apos;t solid.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Button onClick={() => action.prerequisiteConceptId && onNavigateToConcept(action.prerequisiteConceptId)}>
          Review the prerequisite
        </Button>
      </CardContent>
    </Card>
  );
}

// ── Pal instruction rendering (the one LLM call) ────────────────────────

function usePalRendering(learnerId: string, instruction: string | null) {
  // The plain instruction is the initial value (shown immediately) — the
  // effect below only ever upgrades it via an async callback, never sets
  // state synchronously in its body.
  const [rendered, setRendered] = useState<string | null>(instruction);

  useEffect(() => {
    if (!instruction) return;
    let cancelled = false;
    renderInstruction(learnerId, instruction)
      .then(({ rendered: text }) => {
        if (!cancelled && text) setRendered(text);
      })
      .catch(() => {
        /* keep the plain-instruction fallback already shown */
      });
    return () => {
      cancelled = true;
    };
  }, [learnerId, instruction]);

  return rendered;
}

// ── D1 (teach) / D4 (practice) ───────────────────────────────────────────

function TeachOrPracticeStep({
  action,
  learnerId,
  conceptId,
  onAdvance,
}: {
  action: EsoAction;
  learnerId: string;
  conceptId: number;
  onAdvance: () => void;
}) {
  const message = usePalRendering(learnerId, action.llmInstruction);
  const [item, setItem] = useState<PracticeItem | null | 'loading'>('loading');
  const [selected, setSelected] = useState<number | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // `item` already initializes to 'loading'; this effect only needs to
    // resolve it via the async .then() callback, never synchronously.
    if (!action.nodeId) return;
    fetchPracticeItem(learnerId, action.nodeId).then(setItem);
  }, [learnerId, action.nodeId]);

  const submit = async () => {
    if (!action.nodeId || selected == null) return;
    setSubmitting(true);
    setError(null);
    try {
      await recordAttempt(learnerId, action.nodeId, {
        conceptId,
        answerMasterId: selected,
        mode: action.practiceMode,
      });
      onAdvance();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Unable to submit your answer.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>{action.action === 'teach' ? "Let's learn this" : 'Practice'}</CardTitle>
        {action.practiceMode && <Badge variant="outline">{action.practiceMode} practice</Badge>}
      </CardHeader>
      <CardContent className="space-y-4">
        {message && (
          <div className="rounded-lg border border-violet-200 bg-violet-50 px-4 py-3 text-sm text-violet-900">{message}</div>
        )}

        {item === 'loading' && <CenteredSpinner label="Finding a question..." />}
        {item === null && (
          <Alert>No tagged practice question is available for this node yet — Phase 0 content tagging is still in progress.</Alert>
        )}
        {item && item !== 'loading' && (
          <div data-eso-question-id={item.questionId} className="rounded-lg border border-slate-200 p-4">
            <div className="text-sm font-medium text-slate-900" dangerouslySetInnerHTML={{ __html: item.title }} />
            <div className="mt-2 space-y-1.5">
              {item.options.map((option) => (
                <label
                  key={option.id}
                  data-eso-option-id={option.id}
                  className={`flex cursor-pointer items-center gap-2.5 rounded-lg border px-3 py-2 text-sm transition-colors ${
                    selected === option.id ? 'border-violet-400 bg-violet-50' : 'border-slate-200 hover:bg-slate-50'
                  }`}
                >
                  <input
                    type="radio"
                    name="practice-option"
                    checked={selected === option.id}
                    onChange={() => setSelected(option.id)}
                    className="h-4 w-4 accent-violet-600"
                  />
                  <span dangerouslySetInnerHTML={{ __html: option.answer }} />
                </label>
              ))}
            </div>
            {error && <div className="mt-2"><Alert tone="error">{error}</Alert></div>}
            <div className="mt-3 flex justify-end">
              <Button data-eso-submit onClick={submit} disabled={selected == null || submitting}>
                {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                Submit
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ── D3: misconception contrast pair ──────────────────────────────────────

function ContrastPairStep({
  action,
  learnerId,
  conceptId,
  onAdvance,
}: {
  action: EsoAction;
  learnerId: string;
  conceptId: number;
  onAdvance: () => void;
}) {
  const message = usePalRendering(learnerId, action.llmInstruction);
  const [explanation, setExplanation] = useState('');
  const [readyToRetest, setReadyToRetest] = useState(false);
  const [item, setItem] = useState<PracticeItem | null | 'loading'>('loading');
  const [selected, setSelected] = useState<number | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // `item` already initializes to 'loading' and nothing else sets it
    // before this point, so the resolution below is the only setState here.
    if (!readyToRetest || !action.nodeId) return;
    fetchPracticeItem(learnerId, action.nodeId).then(setItem);
  }, [readyToRetest, learnerId, action.nodeId]);

  const submit = async () => {
    if (!action.nodeId || selected == null) return;
    setSubmitting(true);
    setError(null);
    try {
      await recordAttempt(learnerId, action.nodeId, { conceptId, answerMasterId: selected });
      onAdvance();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Unable to submit your answer.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Card className="border-rose-200">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-rose-900">
          <AlertTriangle className="h-5 w-5" />
          Let&apos;s clear up a mix-up
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {message && <div className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-900">{message}</div>}

        {action.contrastPair?.body && (
          <div
            className="rounded-lg border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700"
            dangerouslySetInnerHTML={{ __html: action.contrastPair.body }}
          />
        )}

        {!readyToRetest && (
          <div className="space-y-2">
            <label className="text-xs font-medium text-slate-600">
              In your own words, what&apos;s the difference between the example and the non-example?
            </label>
            <Textarea value={explanation} onChange={(e) => setExplanation(e.target.value)} rows={3} />
            <Button data-eso-ready-to-retest onClick={() => setReadyToRetest(true)} disabled={explanation.trim().length === 0}>
              I understand — retest me
            </Button>
          </div>
        )}

        {readyToRetest && item === 'loading' && <CenteredSpinner label="Preparing a fresh question..." />}
        {readyToRetest && item === null && (
          <Alert>No fresh practice question is tagged for this node yet — Phase 0 content tagging is still in progress.</Alert>
        )}
        {readyToRetest && item && item !== 'loading' && (
          <div data-eso-question-id={item.questionId} className="rounded-lg border border-slate-200 p-4">
            <div className="text-sm font-medium text-slate-900" dangerouslySetInnerHTML={{ __html: item.title }} />
            <div className="mt-2 space-y-1.5">
              {item.options.map((option) => (
                <label
                  key={option.id}
                  data-eso-option-id={option.id}
                  className={`flex cursor-pointer items-center gap-2.5 rounded-lg border px-3 py-2 text-sm transition-colors ${
                    selected === option.id ? 'border-violet-400 bg-violet-50' : 'border-slate-200 hover:bg-slate-50'
                  }`}
                >
                  <input
                    type="radio"
                    name="retest-option"
                    checked={selected === option.id}
                    onChange={() => setSelected(option.id)}
                    className="h-4 w-4 accent-violet-600"
                  />
                  <span dangerouslySetInnerHTML={{ __html: option.answer }} />
                </label>
              ))}
            </div>
            {error && <div className="mt-2"><Alert tone="error">{error}</Alert></div>}
            <div className="mt-3 flex justify-end">
              <Button data-eso-submit onClick={submit} disabled={selected == null || submitting}>
                {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                Retest
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ── D4/D5: mastery + retention ───────────────────────────────────────────

function MasteredStep({ action }: { action: EsoAction }) {
  const router = useRouter();

  return (
    <Card className="border-emerald-200 bg-emerald-50">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-emerald-900">
          <CheckCircle2 className="h-5 w-5" />
          Mastered
        </CardTitle>
        <CardDescription className="text-emerald-700">
          You&apos;ve cleared this concept — practice stops here. A short review will show up in a few days to lock it in.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex gap-4 text-sm text-emerald-800">
          {action.knowledgeMastery != null && <div>Knowledge: {Math.round(action.knowledgeMastery * 100)}%</div>}
          {action.applicationMastery != null && <div>Application: {Math.round(action.applicationMastery * 100)}%</div>}
        </div>
        <Button onClick={() => router.push('/pal')}>Back to subjects</Button>
      </CardContent>
    </Card>
  );
}

// ── D5: delayed retrieval check ──────────────────────────────────────────

function RetrievalDueStep({
  action,
  learnerId,
  conceptId,
  onAdvance,
}: {
  action: EsoAction;
  learnerId: string;
  conceptId: number;
  onAdvance: () => void;
}) {
  const [items, setItems] = useState<EsoQuestion[] | null>(null);
  const [answers, setAnswers] = useState<Record<number, number>>({});
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<EsoAction | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!action.nodeId) return;
    fetchRetrievalItems(learnerId, action.nodeId)
      .then(setItems)
      .catch((reason) => setError(reason instanceof Error ? reason.message : 'Unable to load the review.'));
  }, [learnerId, action.nodeId]);

  const submit = async () => {
    if (!action.nodeId || !items) return;
    setSubmitting(true);
    setError(null);
    try {
      const responses = items.map((item) => ({ answerMasterId: answers[item.questionId] })).filter((r) => r.answerMasterId != null);
      const outcome = await submitRetrievalCheck(learnerId, action.nodeId, conceptId, responses);
      setResult(outcome);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Unable to submit the review.');
    } finally {
      setSubmitting(false);
    }
  };

  if (result) {
    const retained = result.action === 'retained';
    return (
      <Card className={retained ? 'border-emerald-200 bg-emerald-50' : 'border-amber-200 bg-amber-50'}>
        <CardHeader>
          <CardTitle className={retained ? 'text-emerald-900' : 'text-amber-900'}>
            {retained ? 'Retained' : "Let's revisit this"}
          </CardTitle>
          <CardDescription className={retained ? 'text-emerald-700' : 'text-amber-700'}>
            {retained
              ? 'You still had it a few days later — this is locked in.'
              : 'This one slipped — just this part re-loops, nothing else in the chapter is affected.'}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button onClick={onAdvance}>Continue</Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-violet-500" />
          Quick review
        </CardTitle>
        <CardDescription>A short check to make sure this is still solid a few days later.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {error && <Alert tone="error">{error}</Alert>}
        {!items && !error && <CenteredSpinner label="Loading your review..." />}
        {items && items.length === 0 && <Alert>No review items are tagged for this node yet.</Alert>}
        {items?.map((item, index) => (
          <div key={item.questionId} data-eso-question-id={item.questionId} className="rounded-lg border border-slate-200 p-4">
            <div className="mb-1 text-xs text-slate-400">Item {index + 1}</div>
            <div className="text-sm font-medium text-slate-900" dangerouslySetInnerHTML={{ __html: item.title }} />
            <div className="mt-2 space-y-1.5">
              {item.options.map((option) => (
                <label
                  key={option.id}
                  data-eso-option-id={option.id}
                  className={`flex cursor-pointer items-center gap-2.5 rounded-lg border px-3 py-2 text-sm transition-colors ${
                    answers[item.questionId] === option.id ? 'border-violet-400 bg-violet-50' : 'border-slate-200 hover:bg-slate-50'
                  }`}
                >
                  <input
                    type="radio"
                    name={`retrieval-${item.questionId}`}
                    checked={answers[item.questionId] === option.id}
                    onChange={() => setAnswers((prev) => ({ ...prev, [item.questionId]: option.id }))}
                    className="h-4 w-4 accent-violet-600"
                  />
                  <span dangerouslySetInnerHTML={{ __html: option.answer }} />
                </label>
              ))}
            </div>
          </div>
        ))}
        {items && items.length > 0 && (
          <div className="flex justify-end">
            <Button data-eso-submit onClick={submit} disabled={submitting || Object.keys(answers).length === 0}>
              {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              Submit
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

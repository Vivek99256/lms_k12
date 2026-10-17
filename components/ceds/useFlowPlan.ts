'use client';

import { useCallback, useEffect, useState } from 'react';

import { fetchLessonFlow, minutesOf, parseMinutes, type FlowResponse } from '@/lib/ceds/flow';

/** What the teacher confirmed: a method, a topic and a period, plus any timings they have since changed. */
export interface FlowPlan {
  pedagogy: string;
  topicId: number;
  period: number;
  minutes: number[] | null;
}

export type FlowState = { phase: 'loading' } | { phase: 'error'; message: string } | { phase: 'ready'; data: FlowResponse };

/**
 * The state behind a lesson-flow view: the confirmed plan, the flow the server built for it, and the
 * minutes the teacher is typing. Read only: it only ever GETs lms/ceds/lesson-flow. A change to a timing is
 * sent after a short pause; a change of method, topic or period (or "reset") asks for the suggested timings.
 */
export function useFlowPlan(chapterId: number | null) {
  const [plan, setPlan] = useState<FlowPlan | null>(null);
  const [flowState, setFlowState] = useState<FlowState>({ phase: 'loading' });
  const [draft, setDraft] = useState<string[]>([]);
  const [resetCount, setResetCount] = useState(0);

  useEffect(() => {
    if (chapterId === null || plan === null) return;
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      try {
        const data = await fetchLessonFlow(
          { chapterId, pedagogy: plan.pedagogy, topicId: plan.topicId, period: plan.period, minutes: plan.minutes ?? undefined },
          controller.signal,
        );
        if (controller.signal.aborted) return;
        setFlowState({ phase: 'ready', data });
        if (plan.minutes === null && data.flow) setDraft(minutesOf(data.flow.phases).map(String));
      } catch (error) {
        if (!controller.signal.aborted) setFlowState({ phase: 'error', message: error instanceof Error ? error.message : 'Something went wrong.' });
      }
    }, plan.minutes === null ? 0 : 350);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [chapterId, plan, resetCount]);

  const begin = useCallback((choice: { pedagogy: string; topicId: number; period: number }) => {
    setFlowState({ phase: 'loading' });
    setPlan({ ...choice, minutes: null });
  }, []);

  const changeMinutes = useCallback(
    (index: number, value: string) => {
      if (!plan || flowState.phase !== 'ready' || !flowState.data.flow) return;
      const next = draft.map((d, i) => (i === index ? value : d));
      setDraft(next);
      const parsed = next.map((d) => parseMinutes(d));
      if (parsed.every((m): m is number => m !== null)) setPlan({ ...plan, minutes: parsed });
    },
    [plan, flowState, draft],
  );

  const resetTimings = useCallback(() => {
    if (!plan) return;
    setPlan({ ...plan, minutes: null });
    setResetCount((c) => c + 1);
  }, [plan]);

  const setPeriod = useCallback((period: number) => setPlan((p) => (p ? { ...p, period, minutes: null } : p)), []);

  const clear = useCallback(() => {
    setPlan(null);
    setFlowState({ phase: 'loading' });
  }, []);

  return { plan, flowState, draft, begin, changeMinutes, resetTimings, setPeriod, clear };
}

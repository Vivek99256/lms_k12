'use client';

import { useEffect, useState } from 'react';

import { fetchCpWorkflow, type CpWorkflow } from '@/lib/coursePresentation/api';

/**
 * The staged pedagogical workflow of the chosen teaching method, for the teacher to review before generating.
 * Shown only where the server enabled the workflow for the chapter; the stages come from the server, never from this file.
 */
export function WorkflowStages({ chapterId, method, format }: { chapterId: number; method: string; format: string | null }) {
  const [answer, setAnswer] = useState<{ key: string; workflow: CpWorkflow | null; error: string } | null>(null);
  const key = `${chapterId}:${method}:${format ?? ''}`;

  useEffect(() => {
    const controller = new AbortController();
    (async () => {
      try {
        const res = await fetchCpWorkflow(chapterId, method, format, controller.signal);
        if (!controller.signal.aborted) setAnswer({ key, workflow: res.workflow, error: '' });
      } catch (e) {
        if (!controller.signal.aborted) setAnswer({ key, workflow: null, error: e instanceof Error ? e.message : 'Something went wrong.' });
      }
    })();
    return () => controller.abort();
  }, [chapterId, method, format, key]);

  const current = answer !== null && answer.key === key ? answer : null;
  if (current === null) return <p role="status" className="mt-4 text-sm text-slate-600">Loading the teaching stages&hellip;</p>;
  if (current.workflow === null) return <p role="alert" className="mt-4 rounded-md bg-red-50 px-3 py-2 text-sm text-red-800">{current.error}</p>;
  const wf = current.workflow;

  return (
    <section aria-labelledby="cp-workflow-title" data-testid="cp-workflow" className="mt-4 rounded-md border border-slate-200 p-3">
      <h3 id="cp-workflow-title" className="text-sm font-semibold">
        {wf.name}: {wf.stages.length} stages, about {wf.total_minutes} minutes
      </h3>
      <p className="mt-1 text-xs text-slate-600">{wf.description}</p>
      <dl className="mt-2 grid gap-x-4 gap-y-1 text-xs text-slate-700 sm:grid-cols-2">
        <div><dt className="font-semibold">Teacher</dt><dd>{wf.teacher_role}</dd></div>
        <div><dt className="font-semibold">Students</dt><dd>{wf.student_role}</dd></div>
      </dl>
      <ol className="mt-3 space-y-1.5">
        {wf.stages.map((s) => (
          <li key={s.number} className="rounded-md bg-slate-50 px-3 py-2">
            <details>
              <summary className="cursor-pointer text-sm font-medium focus-visible:outline focus-visible:outline-2 focus-visible:outline-indigo-600">
                {s.number}. {s.name} <span className="text-xs font-normal text-slate-500">({s.minutes} min)</span>
              </summary>
              <dl className="mt-2 space-y-1 text-xs text-slate-700">
                <div><dt className="inline font-semibold">Learning objective: </dt><dd className="inline">{s.objective}</dd></div>
                <div><dt className="inline font-semibold">Activity: </dt><dd className="inline">{s.activity}</dd></div>
                <div><dt className="inline font-semibold">Teacher: </dt><dd className="inline">{s.teacher}</dd></div>
                <div><dt className="inline font-semibold">Students: </dt><dd className="inline">{s.student}</dd></div>
                <div><dt className="inline font-semibold">Questions: </dt><dd className="inline">{s.questions.join(' ')}</dd></div>
                <div><dt className="inline font-semibold">Interactions: </dt><dd className="inline">{s.interactions}</dd></div>
                <div><dt className="inline font-semibold">Visual: </dt><dd className="inline">{s.visual}</dd></div>
                <div><dt className="inline font-semibold">Expected outcome: </dt><dd className="inline">{s.outcome}</dd></div>
              </dl>
            </details>
          </li>
        ))}
      </ol>
      <p className="mt-2 text-xs text-slate-600"><span className="font-semibold">Assessment:</span> {wf.assessment}</p>
    </section>
  );
}

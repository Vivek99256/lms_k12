'use client';

import { useEffect, useRef } from 'react';

import { fetchCpStatus, type CpRun } from '@/lib/coursePresentation/api';
import { startRunPoller, type CpWatch } from '@/lib/coursePresentation/poller';
import { finishedOutcome } from '@/lib/coursePresentation/progress';
import { runForChoice } from '@/lib/coursePresentation/runChoice';

/**
 * Keeps asking how a generation is getting on after its window was closed, so the page can say when it finishes. It renders
 * nothing, makes one request at a time at the same pace as the window, and stops as soon as the run is over, the watch is
 * cleared (the window was reopened, which follows the run itself) or the page goes away.
 */
export function RunWatcher({ watch, onFinished }: { watch: CpWatch | null; onFinished: (run: CpRun, outcome: 'completed' | 'failed', watch: CpWatch) => void }) {
  const callback = useRef(onFinished);
  useEffect(() => {
    callback.current = onFinished;
  });

  const key = watch ? `${watch.chapterId}:${watch.run}:${watch.pedagogy}:${watch.format}` : '';
  useEffect(() => {
    if (!watch) return;
    const w = watch;
    // What was last seen is "being made": the first answer that says otherwise is the news.
    let previous = { run: w.run, state: 'running' } as CpRun;
    let done = false;
    const poller = startRunPoller({
      initial: previous,
      load: async (signal) => runForChoice((await fetchCpStatus(w.chapterId, { run: w.run, pedagogy: w.pedagogy, format: w.format }, signal)).run, w.pedagogy, w.format),
      onRun: (next) => {
        const outcome = finishedOutcome(previous, next);
        previous = next;
        if (outcome && !done) {
          done = true;
          callback.current(next, outcome, w);
        }
      },
      onOffline: () => undefined,
      // Session ended or the run is gone: nothing more can be said from here, and the window shows the truth when reopened.
      onFatal: () => undefined,
      isHidden: () => typeof document !== 'undefined' && document.hidden,
    });
    return () => poller.stop();
    // The key stands for the whole watch.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  return null;
}

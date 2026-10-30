import { CoursePresentationApiError, type CpRun } from './api';
import { nextPollDelay, OFFLINE_AFTER_FAILURES } from './progress';

/** A generation the screen was watching when it was closed, so the page can say when it finishes. */
export interface CpWatch {
  chapterId: number;
  run: string;
  pedagogy: string;
  format: string;
}

export interface RunPoller {
  /** Stops the loop, cancels the request in flight and any timer. Safe to call twice. */
  stop: () => void;
  /** Ask now (the tab became visible again) instead of waiting for the timer. */
  wake: () => void;
}

interface Options {
  load: (signal: AbortSignal) => Promise<CpRun | null>;
  initial: CpRun | null;
  onRun: (run: CpRun) => void;
  /** True after a few failed requests in a row; false again on the next answer. The run itself is unaffected. */
  onOffline: (offline: boolean) => void;
  /** The server refused (session ended, run gone, wrong choice): asking again cannot help, so polling stops. */
  onFatal: (error: unknown) => void;
  isHidden?: () => boolean;
  timers?: { set: (fn: () => void, ms: number) => unknown; clear: (id: unknown) => void };
}

/**
 * Asks the server how a run is getting on for as long as the run is live. One request at a time, quick while something changes,
 * slower while it waits or the tab is hidden, backing off after failures, and silent once the run is finished or failed.
 */
export function startRunPoller(options: Options): RunPoller {
  const timers = options.timers ?? { set: (fn, ms) => setTimeout(fn, ms), clear: (id) => clearTimeout(id as ReturnType<typeof setTimeout>) };
  const controller = new AbortController();
  let latest = options.initial;
  let failures = 0;
  let stopped = false;
  let inFlight = false;
  let timer: unknown = null;

  const schedule = () => {
    if (stopped) return;
    const delay = nextPollDelay(latest, failures, options.isHidden?.() ?? false);
    if (delay === null) return;
    timer = timers.set(tick, delay);
  };

  const tick = async () => {
    if (stopped || inFlight) return;
    inFlight = true;
    timer = null;
    try {
      const next = await options.load(controller.signal);
      if (stopped) return;
      failures = 0;
      options.onOffline(false);
      if (next) {
        latest = next;
        options.onRun(next);
      }
    } catch (error) {
      if (stopped || (error instanceof Error && error.name === 'AbortError')) return;
      if (error instanceof CoursePresentationApiError && [401, 403, 404, 422].includes(error.status)) {
        stopped = true;
        options.onFatal(error);
        return;
      }
      failures += 1;
      if (failures >= OFFLINE_AFTER_FAILURES) options.onOffline(true);
    } finally {
      inFlight = false;
    }
    schedule();
  };

  schedule();

  return {
    stop: () => {
      stopped = true;
      controller.abort();
      if (timer !== null) timers.clear(timer);
      timer = null;
    },
    wake: () => {
      if (stopped || inFlight) return;
      if (timer !== null) timers.clear(timer);
      void tick();
    },
  };
}

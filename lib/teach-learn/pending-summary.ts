/** What the background resources (presentations, study documents) have really reached, as the server reports it. */
export interface PendingProgress {
  total: number;
  stored: number;
  failed: number;
  /** The screen stopped asking after its long wait; whatever is still unresolved is not counted as stored. */
  gaveUp?: boolean;
  /** One entry per failed item: what it was and why it was not stored. */
  failures?: { label: string; reason: string }[];
  /** Keys of the items that are stored or failed (nothing more will happen to them). */
  finishedKeys?: string[];
}

export type BackgroundStatus = 'in_progress' | 'completed' | 'issues' | 'failed';

const MAX_REASON = 180;

/**
 * The sentence the AI Stack execution summary uses for the resources started in the background, from what the server says has
 * really been stored so far. It never claims more than that, and once an item has failed it says which one and why.
 */
export function pendingSummary(total: number, stored: number, failed: number, failures: { label: string; reason: string }[] = []): string {
  const running = Math.max(0, total - stored - failed);
  const parts = [`Generated and stored ${stored} of ${total} background resource(s) in Classroom Resource.`];
  if (running > 0) parts.push(`${running} still generating; each is stored automatically once it passes validation.`);
  if (failed > 0) {
    parts.push(`${failed} could not be stored.`);
    for (const f of failures) {
      const reason = f.reason.length > MAX_REASON ? `${f.reason.slice(0, MAX_REASON).trimEnd()}...` : f.reason;
      parts.push(`${f.label}: ${reason}`);
    }
  }
  return parts.join(' ');
}

/**
 * The one status the top badge and the Agent 3 box show.
 *   in_progress  something is still generating or queued
 *   completed    everything is stored
 *   issues       finished, something failed, and something (here or already stored by Agent 3) is stored
 *   failed       finished, and nothing at all is stored
 *
 * `immediateStored` is what Agent 3 stored during the request itself (the chapter assessment), which counts as stored.
 */
export function backgroundStatus(p: PendingProgress, immediateStored = 0): BackgroundStatus {
  const running = Math.max(0, p.total - p.stored - p.failed);
  if (running > 0 && !p.gaveUp) return 'in_progress';
  const unresolved = p.gaveUp ? running : 0;
  if (p.failed + unresolved === 0) return 'completed';
  return p.stored + immediateStored > 0 ? 'issues' : 'failed';
}

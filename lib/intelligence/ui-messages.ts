import type { UIMessage } from 'ai';
import {
  toStreamingReply,
  withStreamedTrace,
  type ChatShapedReply,
} from './ask-adapter';
import type { AnswerAction, AnswerSection, TraceStage } from './types';

/**
 * How a governed lifecycle turn is carried inside an AI SDK UI message.
 *
 * The SDK owns the message protocol, the streaming state and aborts; it does not own
 * what a turn *means*. So the answer prose travels as ordinary text parts — which is
 * what makes it stream a word at a time — and everything the lifecycle produces that
 * has no equivalent in a chat protocol travels as typed data parts beside it.
 *
 * Two data parts, and the split between them is the point:
 *
 *   - `stage` arrives **while the turn runs**, one part per lifecycle stage, as the
 *     backend finishes each one. The ladder fills in live rather than appearing whole
 *     at the end, which is the difference between watching an agent work and watching
 *     a spinner. Each carries the stage key as its part `id`, so a stage that reports
 *     twice updates its row instead of adding a second one.
 *
 *   - `ask` arrives **once, at the end**, and carries the finished answer: citations,
 *     offered actions, the module that answered, and the settled trace. It is written
 *     server-side by the same adapter the panel used before this transport existed, so
 *     the render layer did not have to learn a new shape to gain streaming.
 */
export type AskDataParts = {
  stage: TraceStage;
  ask: {
    /**
     * The backend's thread id for this conversation. It is minted on the first turn
     * and has to be sent back on every later one, or "why is she at risk?" resolves
     * against nothing.
     */
    conversationId: number | null;
    reply: ChatShapedReply;
  };
};

export type AskUIMessage = UIMessage<unknown, AskDataParts>;

/**
 * What the panel draws.
 *
 * Deliberately the shape the panel already spoke before the SDK arrived: the render
 * did not change when the transport did, so a regression in the streaming layer shows
 * up as missing data rather than as a differently-shaped bug in the JSX.
 */
export type PanelMessage = {
  id: string;
  role: 'system' | 'user' | 'assistant';
  content: string;
  module?: string;
  citations: ChatShapedReply['response']['citations'];
  actions: AnswerAction[];
  followUps: string[];
  lifecycleTrace: TraceStage[];
  /**
   * The answer's structured sections, when the turn has finished.
   *
   * Empty while streaming — the backend composes the answer at the end, so there is
   * nothing structured to draw until `done`. The streamed text carries the turn until
   * then, which is why both exist.
   */
  sections: AnswerSection[];
  /**
   * The records this turn touched — `enquiry_id`, `student_id`, `case_id` and so on.
   *
   * What the panel turns into a "open this in its module" hand-off. The backend names
   * the record; this application decides the route.
   */
  links: Record<string, unknown>;
  /**
   * Whether the backend's final answer has arrived for this turn.
   *
   * False means one of two things — still arriving, or stopped before it finished —
   * and the panel tells them apart by whether a request is in flight. It reads this to
   * keep the ladder open while it fills in: a trace that is still growing is the one
   * moment the twelve rows are worth more than the answer, and collapsing it by
   * default there would hide the thing streaming exists to show.
   */
  isComplete: boolean;
};

/** The finished-answer part, if this turn has got that far. */
export function askDataOf(message: AskUIMessage): AskDataParts['ask'] | null {
  for (let index = message.parts.length - 1; index >= 0; index -= 1) {
    const part = message.parts[index];

    if (part.type === 'data-ask') return part.data;
  }

  return null;
}

/**
 * The stages this turn has reported so far, in ladder order.
 *
 * Sorted by the stage's own `order` rather than by arrival, because a stage that
 * reports late must not jump to the bottom of a ladder a reader is scanning by number.
 */
export function stagesOf(message: AskUIMessage): TraceStage[] {
  const stages = message.parts
    .filter((part): part is { type: 'data-stage'; id?: string; data: TraceStage } =>
      part.type === 'data-stage')
    .map((part) => part.data);

  return [...stages].sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
}

/** Every text part, joined — the answer as the user reads it. */
export function textOf(message: Pick<AskUIMessage, 'parts'>): string {
  return message.parts
    .filter((part): part is { type: 'text'; text: string; state?: 'streaming' | 'done' } =>
      part.type === 'text')
    .map((part) => part.text)
    .join('');
}

/**
 * One UI message as the panel wants to draw it.
 *
 * Both branches go through the adapter, which is the file that knows what a governed
 * turn looks like on screen. This one only decides *which* turn it is holding: a
 * finished one, whose `ask` part carries the backend's settled answer, or one still
 * arriving, drawn from the text and stages that have reached the browser so far.
 */
export function toPanelMessage(message: AskUIMessage): PanelMessage {
  const ask = askDataOf(message);
  const streamedStages = stagesOf(message);
  const content = textOf(message);

  const reply = ask
    ? withStreamedTrace(ask.reply, streamedStages)
    : toStreamingReply({ messageId: message.id, text: content, stages: streamedStages });

  return {
    id: message.id,
    role: message.role,
    // The streamed text is what the reader is watching arrive, so it wins over the
    // composed copy in a finished reply — they are the same words, and swapping one
    // for the other on the last chunk would re-render the bubble for no reason.
    content: content || reply.message.content,
    module: reply.response.data.module,
    citations: reply.response.citations,
    actions: reply.actions,
    followUps: reply.response.followUpSuggestions,
    lifecycleTrace: reply.response.data.lifecycleTrace ?? [],
    sections: reply.response.data.sections ?? [],
    links: reply.response.data.links ?? {},
    isComplete: message.role !== 'assistant' || ask !== null,
  };
}

/**
 * Drop anything in storage that is not a UI message.
 *
 * A thread persisted by an earlier build of this panel is a different shape entirely —
 * `{role, content}` with no `parts`. Rendering one would throw on the first `.filter`,
 * so a stale key costs the old transcript rather than the panel.
 */
export function usableStoredMessages(stored: unknown[]): AskUIMessage[] {
  return stored.filter((entry): entry is AskUIMessage => {
    if (!entry || typeof entry !== 'object') return false;

    const candidate = entry as Partial<AskUIMessage>;

    return typeof candidate.id === 'string'
      && typeof candidate.role === 'string'
      && Array.isArray(candidate.parts);
  });
}

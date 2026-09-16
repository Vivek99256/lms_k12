import type { InferUIMessageChunk } from 'ai';
import { toChatShapedReply } from './ask-adapter';
import { readSseEvents } from './sse';
import type { AskUIMessage } from './ui-messages';
import type { AskResult, TraceStage } from './types';

/**
 * Laravel's SSE dialect, translated into the AI SDK's.
 *
 * Kept out of the route so the translation can be tested against a scripted stream
 * rather than a live backend — every bug that matters here is a wrong chunk shape or
 * a missing `text-end`, and neither is visible from reading the code.
 *
 * The mapping, and why each side is what it is:
 *
 *   `stage` → `data-stage`, one part per lifecycle stage, keyed by stage so a stage
 *   that reports twice updates its row. This is what makes the ladder fill in live.
 *
 *   `token` → `text-delta`. Only turns whose answer is generated emit these; most
 *   lifecycle answers are composed from rows and arrive whole.
 *
 *   `done`  → the composed answer as text if nothing streamed, then `data-ask` with
 *   the finished reply. The adapter runs here, server-side, so the panel renders the
 *   same shape it did before this transport existed.
 *
 *   `error` → `error`, with the backend's own sentence when it gave one. Laravel
 *   already keeps that message generic; the detail lives in the trace.
 */

/** The id every text chunk of one answer shares. One answer, one text part. */
export const ANSWER_PART_ID = 'answer';

export async function* askUiChunks(
  body: ReadableStream<Uint8Array>
): AsyncGenerator<InferUIMessageChunk<AskUIMessage>> {
  let textOpened = false;
  let streamedText = false;
  let answered = false;

  yield { type: 'start' };

  for await (const event of readSseEvents(body)) {
    const data = parseData(event.data);

    if (data === null) continue;

    switch (event.event) {
      case 'stage': {
        const stage = data as TraceStage;

        yield {
          type: 'data-stage',
          id: `stage-${stage.key ?? stage.order}`,
          data: stage,
        };
        break;
      }

      case 'token': {
        const delta = (data as { delta?: unknown }).delta;

        if (typeof delta !== 'string' || delta === '') break;

        if (!textOpened) {
          yield { type: 'text-start', id: ANSWER_PART_ID };
          textOpened = true;
        }

        streamedText = true;
        yield { type: 'text-delta', id: ANSWER_PART_ID, delta };
        break;
      }

      case 'done': {
        const result = data as AskResult;
        const reply = toChatShapedReply(result, ANSWER_PART_ID);

        // A turn that streamed no tokens still has an answer — most are composed from
        // rows rather than generated, and that composed text is the whole reply.
        if (!streamedText && reply.message.content) {
          if (!textOpened) {
            yield { type: 'text-start', id: ANSWER_PART_ID };
            textOpened = true;
          }

          yield { type: 'text-delta', id: ANSWER_PART_ID, delta: reply.message.content };
        }

        if (textOpened) {
          yield { type: 'text-end', id: ANSWER_PART_ID };
          textOpened = false;
        }

        yield {
          type: 'data-ask',
          id: 'ask',
          data: { conversationId: result.conversation?.id ?? null, reply },
        };
        answered = true;
        break;
      }

      case 'error': {
        const message = (data as { message?: unknown }).message;

        answered = true;

        if (textOpened) {
          yield { type: 'text-end', id: ANSWER_PART_ID };
          textOpened = false;
        }

        yield {
          type: 'error',
          errorText:
            typeof message === 'string' && message
              ? message
              : 'The question could not be answered.',
        };
        break;
      }

      default:
        // An event this build does not know about is not an error — the backend may
        // have grown one. Ignoring it keeps an old client working against a newer
        // server.
        break;
    }
  }

  // A stream cut off mid-answer still has to close the part it opened, or the panel
  // renders a message that never stops streaming.
  if (textOpened) {
    yield { type: 'text-end', id: ANSWER_PART_ID };
  }

  // The upstream stopped without ever answering.
  //
  // This is not hypothetical: a cohort scan that runs past PHP's execution limit dies
  // mid-stream, and Laravel writes an HTML error page into the middle of the SSE
  // frames. Every byte after that is unparseable, so the turn would otherwise end with
  // a half-drawn ladder, an empty bubble, and no indication that anything went wrong —
  // which reads as an agent that quietly gave up. Say so instead.
  if (!answered) {
    yield {
      type: 'error',
      errorText:
        'The assistant stopped before it finished answering. The stages above are what '
        + 'it completed; nothing was written.',
    };
  }

  yield { type: 'finish' };
}

/**
 * The same answer, from the JSON route instead of the stream.
 *
 * `/ask` and `/ask/stream` return identical payloads — the streaming route's `done`
 * event carries exactly what the JSON route puts in `data`, which was a deliberate
 * property of the backend contract. That is what makes this fallback honest rather
 * than a degraded second implementation: the panel renders the same reply and the same
 * twelve-stage ladder, it simply gets them in one delivery instead of progressively.
 *
 * The stages are emitted before the text so the ladder is already drawn when the
 * answer appears, which is the order a reader expects even when nothing was gradual.
 */
export async function* askUiChunksFromResult(
  result: AskResult
): AsyncGenerator<InferUIMessageChunk<AskUIMessage>> {
  yield { type: 'start' };

  for (const stage of result.trace ?? []) {
    yield {
      type: 'data-stage',
      id: `stage-${stage.key ?? stage.order}`,
      data: stage,
    };
  }

  const reply = toChatShapedReply(result, ANSWER_PART_ID);

  if (reply.message.content) {
    yield { type: 'text-start', id: ANSWER_PART_ID };
    yield { type: 'text-delta', id: ANSWER_PART_ID, delta: reply.message.content };
    yield { type: 'text-end', id: ANSWER_PART_ID };
  }

  yield {
    type: 'data-ask',
    id: 'ask',
    data: { conversationId: result.conversation?.id ?? null, reply },
  };

  yield { type: 'finish' };
}

function parseData(raw: string): unknown {
  try {
    return JSON.parse(raw);
  } catch {
    // A malformed frame is one lost event, not a lost turn.
    return null;
  }
}

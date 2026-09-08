/**
 * Reading Server-Sent Events off a response body.
 *
 * Laravel's `/ask/stream` speaks named SSE events — `stage`, `token`, `done`, `error`
 * — while the AI SDK speaks its own UI message stream, which is also SSE but with a
 * single unnamed event carrying a typed chunk. Something has to sit between the two,
 * and this is the half that reads.
 *
 * Written by hand rather than pulled from a package because the parsing rules that
 * matter here are few and the failure mode of getting them wrong is subtle: an event
 * split across two network chunks arrives as two partial lines, and a parser that
 * assumes a chunk is a message drops half a stage. So the buffer is kept across reads
 * and only complete records — terminated by a blank line — are yielded.
 */

export type SseEvent = {
  /** The event name. `message` when the producer sent none, per the spec. */
  event: string;
  /** The joined `data:` lines, still unparsed. */
  data: string;
};

/**
 * Yield each complete SSE record from a byte stream.
 *
 * The stream is always released, including when the consumer breaks out of the loop
 * early — which is exactly what happens when the user aborts a question, so it is not
 * a tidy-up detail but the path that keeps a cancelled turn from holding a connection.
 */
export async function* readSseEvents(
  body: ReadableStream<Uint8Array>
): AsyncGenerator<SseEvent> {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  try {
    for (;;) {
      const { done, value } = await reader.read();

      if (done) break;

      // `stream: true` matters: a multi-byte character can straddle two reads, and
      // decoding each read independently turns it into two replacement characters.
      buffer += decoder.decode(value, { stream: true });

      // Normalised so a producer using CRLF parses the same as one using LF.
      buffer = buffer.replace(/\r\n/g, '\n');

      let boundary = buffer.indexOf('\n\n');

      while (boundary !== -1) {
        const record = buffer.slice(0, boundary);
        buffer = buffer.slice(boundary + 2);

        const parsed = parseRecord(record);

        if (parsed) yield parsed;

        boundary = buffer.indexOf('\n\n');
      }
    }

    // A producer that ends without a trailing blank line still meant to send its last
    // record. Dropping it would lose the `done` event — the one that carries the answer.
    const trailing = parseRecord(buffer.replace(/\r\n/g, '\n'));

    if (trailing) yield trailing;
  } finally {
    reader.releaseLock();
  }
}

function parseRecord(record: string): SseEvent | null {
  const lines = record.split('\n');
  let event = 'message';
  const data: string[] = [];

  for (const line of lines) {
    // A line starting with a colon is a comment — heartbeats arrive this way.
    if (line === '' || line.startsWith(':')) continue;

    const colon = line.indexOf(':');
    const field = colon === -1 ? line : line.slice(0, colon);
    // One optional space after the colon is part of the framing, not the value.
    const value = colon === -1 ? '' : line.slice(colon + 1).replace(/^ /, '');

    if (field === 'event') {
      event = value;
    } else if (field === 'data') {
      data.push(value);
    }
    // `id` and `retry` are meaningful to EventSource reconnection, which this
    // consumer does not do — a half-finished lifecycle turn must not silently
    // restart and write to the database twice.
  }

  if (data.length === 0) return null;

  return { event, data: data.join('\n') };
}

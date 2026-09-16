import type {
  AnswerAction,
  AnswerPayload,
  AnswerSection,
  AskResult,
  TraceStage,
} from "./types";

/**
 * Renders a governed `/ask` answer into the shape the assistant panel already speaks —
 * whether the turn has finished or is still arriving.
 *
 * Two entry points, one composition. `toChatShapedReply` draws a finished turn from
 * the backend's whole result; `toStreamingReply` draws the same shape from whatever
 * has arrived so far, so a turn is watchable while it runs rather than appearing whole
 * at the end. Everything below the two — how a section becomes text, which tools count
 * as sources, what a blocked stage means — is shared, because a partial turn drawn by
 * different rules than a finished one would change appearance at the moment it
 * completed, and a reader would have no way to tell a re-render from a new fact.
 *
 * The panel retains its established reply shape — bubbles, follow-up chips, citations
 * and a navigation hand-off — while Laravel owns the answer. Rewriting rendering and
 * transport together would make a regression impossible to attribute.
 *
 * So the transport changes and the render does not. A turn answered by the twelve-stage
 * pipeline arrives at the panel looking like a turn it already knows how to draw, and
 * the parts that have no equivalent — the lifecycle trace, the offered actions with
 * their pinned record ids — come through as additions rather than as replacements.
 *
 * Two things deliberately do NOT map:
 *
 *   - **Tool confirmations.** The chat route asks the user to authorise a tool and
 *     replays the same sentence with `confirmedTools`. The lifecycle has no equivalent
 *     and should not grow one: approving is a *question*, carrying the id of the record
 *     it applies to, and it goes through the human approval stage like any other turn.
 *     Those arrive as `actions`, not as a confirmation prompt.
 *
 *   - **Multi-bubble replies.** The lifecycle composes one answer with titled sections.
 *     Splitting it into several bubbles to match the old shape would lose the structure
 *     that makes the sections worth having.
 */

/** What the panel consumes from the Laravel lifecycle transport. */
export interface ChatShapedReply {
  message: { id: string; content: string };
  response: {
    message: string;
    status: string;
    conversationType: string;
    activeTools: string[];
    followUpSuggestions: string[];
    citations: Array<{
      tool: string;
      module?: string;
      available: boolean;
      unavailableSignals?: string[];
    }>;
    data: {
      module?: string;
      pipeline?: string;
      depthReached?: number;
      /** Present so the panel can render the ladder beside the reply. */
      lifecycleTrace?: TraceStage[];
      /**
       * The answer's sections, structured, exactly as the backend composed them.
       *
       * `message` above is the same content flattened to text, and for a long time it
       * was the *only* thing that crossed this boundary — which is why the panel could
       * only ever render a wall of prose. A `records` section arrived as bullet points
       * and a `key_values` section as "- label: value", so a ranked list of students
       * could not become a table and a percentage could not become a progress bar: the
       * structure was destroyed here, one layer before the component that needed it.
       *
       * Both now travel. The text remains the fallback and the thing worth storing in
       * a transcript; these are what the panel draws when it can.
       */
      sections?: AnswerSection[];
      /**
       * The records this turn touched, keyed by kind — `enquiry_id`, `student_id`,
       * `case_id`, `recommendation_id`, `workflow_run_id`.
       *
       * The backend deliberately does not know this application's routes, so it names
       * *which record* rather than *which page*. Turning that into a destination is the
       * panel's job, and keeping the split means renaming a route never becomes a
       * backend deploy.
       */
      links?: Record<string, unknown>;
    };
  };
  /**
   * Buttons the answer offered. Each is the next question with its subject pinned, so
   * clicking one and typing the sentence produce the same trace.
   */
  actions: AnswerAction[];
}

/** One section as plain text, titled the way the console titles it. */
function renderSection(section: AnswerSection): string | null {
  const title = section.title?.trim();
  const heading = title ? `**${title}**\n` : "";

  if (section.type === "text") {
    return section.body?.trim() ? `${heading}${section.body.trim()}` : null;
  }

  if (section.type === "key_values") {
    // A list of {label, value}, not a keyed object. Reading it with Object.entries
    // produced "- 0: [object Object]" for every row.
    const lines = (section.items ?? [])
      .filter((item) => item?.value != null && String(item.value).trim() !== "")
      .map((item) => `- ${item.label}: ${item.value}`);

    return lines.length ? `${heading}${lines.join("\n")}` : null;
  }

  if (section.type === "records") {
    const lines = (section.items ?? []).map((raw) => {
      const item = raw as {
        title?: string;
        badge?: string;
        lines?: string[];
        meta?: Record<string, string>;
      };

      const head = [item.title, item.badge ? `(${item.badge})` : null]
        .filter(Boolean)
        .join(" ");
      const detail = (item.lines ?? []).map((line) => `    ${line}`);
      const meta = item.meta
        ? Object.entries(item.meta)
            .map(([k, v]) => `${k} ${v}`)
            .join(" · ")
        : "";

      return [`- ${head}`, ...detail, meta ? `    ${meta}` : ""]
        .filter(Boolean)
        .join("\n");
    });

    return lines.length ? `${heading}${lines.join("\n")}` : null;
  }

  if (section.type === "evidence") {
    const lines = (section.items ?? []).map((row) => {
      // `source` is a formatted string from the backend — "attendance_student #4821".
      // Reading it as `source.table` yielded undefined every time and printed
      // "computed" for rows that came straight out of a table, which quietly removed
      // the only reason to trust the sentence above it.
      const mark = row.verified ? "✓" : "○";
      const value = row.value ? ` = ${row.value}` : "";
      const generated = row.is_generated ? " [generated]" : "";

      return `- ${mark} ${row.summary ?? ""}${value} (${row.source})${generated}`;
    });

    return lines.length ? `${heading}${lines.join("\n")}` : null;
  }

  if (section.type === "steps") {
    const lines = (section.items ?? []).map((raw) => {
      const step = raw as { label?: string; step_key?: string; status?: string };

      return `- ${step.label ?? step.step_key ?? ""} — ${step.status ?? "pending"}`;
    });

    return lines.length ? `${heading}${lines.join("\n")}` : null;
  }

  if (section.type === "comparison") {
    const lines = (section.items ?? []).map((raw) => {
      const row = raw as Record<string, unknown>;

      return `- ${Object.entries(row)
        .map(([k, v]) => `${k}: ${String(v)}`)
        .join(" · ")}`;
    });

    return lines.length ? `${heading}${lines.join("\n")}` : null;
  }

  return null;
}

/** The whole answer as one block of text. */
export function renderAnswer(answer: AnswerPayload): string {
  const body = (answer.sections ?? [])
    .map(renderSection)
    .filter((part): part is string => Boolean(part));

  const headline = answer.headline?.trim() ?? "";

  return [headline, ...body].filter(Boolean).join("\n\n");
}

/**
 * Which MCP tools genuinely ran, read from the Laravel MCP stage.
 *
 * Read from the trace rather than from the plan on purpose: a plan names candidates
 * and a turn selects by actually calling, and showing a candidate as a source would
 * credit the answer to a tool that never ran.
 */
export function executedTools(trace: TraceStage[]): string[] {
  const stage = trace.find((entry) => entry.key === "laravel_mcp");
  const tools = (stage?.data as { tools?: unknown })?.tools;

  return Array.isArray(tools) ? tools.filter((t): t is string => typeof t === "string") : [];
}

/**
 * Sources for the reply, one per tool call that actually happened.
 *
 * A refused call is reported as unavailable rather than omitted: "Laravel MCP turned
 * this down" is a governance decision the user is entitled to see, and hiding it makes
 * a partial answer look complete.
 */
function citationsFrom(trace: TraceStage[], moduleKey?: string) {
  const stage = trace.find((entry) => entry.key === "laravel_mcp");
  const calls = (stage?.data as { calls?: unknown })?.calls;

  if (!Array.isArray(calls)) return [];

  return calls.map((raw) => {
    const call = raw as { tool?: string; status?: string; error?: string };
    const available = call.status === "completed";

    return {
      tool: call.tool ?? "unknown",
      module: moduleKey,
      available,
      unavailableSignals: available || !call.error ? undefined : [call.error],
    };
  });
}

/**
 * The status the panel colours a bubble by.
 *
 * A blocked stage means the turn genuinely stopped somewhere, which the user should
 * see as a refusal rather than as an ordinary answer.
 */
function statusFrom(trace: TraceStage[]): string {
  return trace.some((stage) => stage.status === "blocked") ? "blocked" : "ok";
}

/**
 * Convert one governed turn into the panel's reply shape.
 */
export function toChatShapedReply(result: AskResult, messageId: string): ChatShapedReply {
  // `??` is not enough here. A turn recorded by the previous pipeline carries its
  // ladder under `trace` and an *empty array* under `lifecycle_trace` — which is not
  // nullish, so a nullish-coalescing fallback silently kept the empty one and the
  // reply lost every tool and citation it had.
  const trace =
    result.lifecycle_trace?.length ? result.lifecycle_trace : result.trace ?? [];
  const moduleKey = result.module?.key;
  const content = renderAnswer(result.answer);

  return {
    message: { id: messageId, content },
    response: {
      message: content,
      status: statusFrom(trace),
      conversationType: result.intent?.key ?? "unknown",
      activeTools: executedTools(trace),
      followUpSuggestions: result.answer.follow_ups ?? [],
      citations: citationsFrom(trace, moduleKey),
      data: {
        module: moduleKey,
        pipeline: result.pipeline,
        depthReached: result.depth_reached,
        lifecycleTrace: trace,
        sections: result.answer.sections ?? [],
        links: result.links ?? {},
      },
    },
    actions: result.answer.actions ?? [],
  };
}

/* -------------------------------------------------------------------------- */
/* A turn that has not finished yet                                            */
/* -------------------------------------------------------------------------- */

/**
 * What a turn has produced so far.
 *
 * The backend reports each lifecycle stage as it completes and, for a generated
 * answer, each token as it arrives. Both are partial views of the same turn, and this
 * is what the panel has to draw from until `done`.
 */
export interface StreamingTurn {
  messageId: string;
  /** The answer text that has arrived. Empty for a turn still choosing its tools. */
  text: string;
  /** The stages that have reported, in ladder order. */
  stages: TraceStage[];
}

/** The status of a turn that is still running. Not an outcome — a state. */
export const STREAMING_STATUS = "streaming";

/**
 * Render a turn that is still arriving.
 *
 * The point of this function is that a lifecycle turn is *watchable*. A cohort scan
 * reads three detectors across a live database and takes real seconds; showing a
 * spinner for all of them and then the finished ladder hides the one thing a person
 * most wants to see, which is the agent working. So the same composition that draws a
 * finished turn also draws an unfinished one, and the ladder fills in row by row.
 *
 * What it deliberately does NOT do is offer anything to act on. Actions and follow-up
 * chips stay empty until the turn is finished, because an Approve button rendered from
 * a half-built trace would let somebody approve a recommendation the pipeline has not
 * finished drafting. Sources, by contrast, appear the moment the MCP stage reports:
 * they describe what has already happened, so showing them early is honest.
 */
export function toStreamingReply(turn: StreamingTurn): ChatShapedReply {
  const trace = inLadderOrder(turn.stages);

  return {
    message: { id: turn.messageId, content: turn.text },
    response: {
      message: turn.text,
      // A stage that blocked has already decided the turn, even mid-stream — that is
      // a refusal the reader should see now rather than at the end.
      status: trace.some((stage) => stage.status === "blocked")
        ? statusFrom(trace)
        : STREAMING_STATUS,
      conversationType: "unknown",
      activeTools: executedTools(trace),
      followUpSuggestions: [],
      // The module is settled by the backend and travels with the finished answer, so
      // citations are labelled by tool alone until then.
      citations: citationsFrom(trace),
      data: { lifecycleTrace: trace },
    },
    actions: [],
  };
}

/**
 * A finished reply, with the streamed ladder kept if the backend sent none.
 *
 * The settled trace is the backend's final word and normally wins outright. But a turn
 * can finish carrying an empty one — the previous pipeline did exactly that — and
 * discarding rows the reader has been watching fill in, to replace them with nothing,
 * is the worst of both. So the streamed ladder is the floor, never an override.
 */
export function withStreamedTrace(
  reply: ChatShapedReply,
  streamed: TraceStage[]
): ChatShapedReply {
  if (reply.response.data.lifecycleTrace?.length || streamed.length === 0) {
    return reply;
  }

  return {
    ...reply,
    response: {
      ...reply.response,
      data: { ...reply.response.data, lifecycleTrace: inLadderOrder(streamed) },
    },
  };
}

/**
 * Stages by their own position in the ladder, not by arrival.
 *
 * Stages complete out of order — a stage that reports late must not jump to the bottom
 * of a ladder somebody is reading by number.
 */
function inLadderOrder(stages: TraceStage[]): TraceStage[] {
  return [...stages].sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
}

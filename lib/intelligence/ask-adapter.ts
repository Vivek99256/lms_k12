import type {
  AnswerAction,
  AnswerPayload,
  AnswerSection,
  AskResult,
  TraceStage,
} from "./types";

/**
 * Renders a governed `/ask` answer into the shape the assistant panel already speaks.
 *
 * This exists so the two AI stacks can become one without a flag day. The panel was
 * built against the model-driven `/api/ai/chat` route and knows its response shape
 * intimately — bubbles, follow-up chips, citations, a navigation hand-off. Rewriting
 * all of that at the same time as changing which backend answers would mean two
 * risky changes landing together, with no way to tell which one broke a reply.
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

/** What the panel consumes. Mirrors the `/api/ai/chat` response shape. */
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

  return {
    message: { id: messageId, content: renderAnswer(result.answer) },
    response: {
      message: renderAnswer(result.answer),
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
      },
    },
    actions: result.answer.actions ?? [],
  };
}

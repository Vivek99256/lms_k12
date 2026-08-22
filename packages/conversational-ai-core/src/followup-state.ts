/**
 * Follow-up state for the Conversational AI.
 *
 * Every chat request is stateless: the browser sends the message transcript, so
 * only the *text* of previous answers survives. That is not enough to answer
 * "Why?" or "which employees are affected?", because the entity the previous
 * answer was about — and the filters behind it — are gone.
 *
 * This module remembers, per session, the last few data-backed queries: which
 * tool ran, which filters it ran with, which real backend records came back, and
 * which record the answer was actually *about*. That last part is the focus
 * entity, and it is what a pronoun in the next message resolves against.
 *
 * In-memory, per process, bounded — the same lifetime as the message history
 * store next to it.
 */

/** The record a previous answer was about, so "that department" can resolve. */
export interface ConversationFocusEntity {
  /** "department", "class", "student", "teacher", "standard", … */
  kind: string;
  id?: string;
  name: string;
  /** Real backend fields carried forward, so a follow-up can explain the record. */
  attributes?: Record<string, unknown>;
}

export interface FollowUpQueryState {
  /** Internal tool name. Prompt-only — never shown to the user. */
  tool: string;
  module?: string;
  filters: Record<string, unknown>;
  /** The single record the answer centred on, when there was one. */
  focus?: ConversationFocusEntity;
  /** Every record the answer could have been about, for name matching. */
  candidates: ConversationFocusEntity[];
  resolvedEntities: Array<{ kind: string; query: string; id: string; name: string }>;
  rowCount?: number;
  status: string;
  at: string;
}

export interface FollowUpSessionState {
  sessionId: string;
  userId: string;
  /** Most recent first. */
  queries: FollowUpQueryState[];
  updatedAt: string;
}

const MAX_TRACKED_QUERIES = 5;
const MAX_CANDIDATES = 40;
const MAX_SESSIONS = 500;

const followUpSessions = new Map<string, FollowUpSessionState>();

function getSessionKey(userId: string, sessionId: string) {
  return `${userId}:${sessionId}`;
}

/** Cheap FIFO eviction so a long-running server cannot grow unbounded. */
function evictIfNeeded() {
  if (followUpSessions.size <= MAX_SESSIONS) {
    return;
  }

  const oldestKey = followUpSessions.keys().next().value;
  if (oldestKey) {
    followUpSessions.delete(oldestKey);
  }
}

export function recordFollowUpQuery(
  params: { userId: string; sessionId: string },
  query: Omit<FollowUpQueryState, "at" | "candidates"> & {
    candidates?: ConversationFocusEntity[];
  }
) {
  const key = getSessionKey(params.userId, params.sessionId);
  const current = followUpSessions.get(key);

  const entry: FollowUpQueryState = {
    ...query,
    candidates: (query.candidates || []).slice(0, MAX_CANDIDATES),
    at: new Date().toISOString(),
  };

  const next: FollowUpSessionState = {
    sessionId: params.sessionId,
    userId: params.userId,
    queries: [entry, ...(current?.queries ?? [])].slice(0, MAX_TRACKED_QUERIES),
    updatedAt: entry.at,
  };

  followUpSessions.delete(key);
  followUpSessions.set(key, next);
  evictIfNeeded();

  return next;
}

export function getFollowUpState(userId: string, sessionId: string) {
  return followUpSessions.get(getSessionKey(userId, sessionId)) || null;
}

export function clearFollowUpState(userId: string, sessionId?: string) {
  if (sessionId) {
    followUpSessions.delete(getSessionKey(userId, sessionId));
    return;
  }

  for (const key of [...followUpSessions.keys()]) {
    if (key.startsWith(`${userId}:`)) {
      followUpSessions.delete(key);
    }
  }
}

/* -------------------------------------------------------------------------- */
/* Coreference                                                                */
/* -------------------------------------------------------------------------- */

function normalizeName(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9\s]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * True when the message cannot stand on its own — a bare "Why?", a pronoun
 * ("that department", "those students", "their names"), or an elliptical
 * continuation ("and for Standard 8?"). These are the messages whose subject has
 * to come from the previous turn rather than from the words in front of us.
 */
export function isContextualFollowUp(message: string) {
  const text = message.trim().toLowerCase().replace(/[?.!]+$/, "");

  if (!text) {
    return false;
  }

  // A bare interrogative or acknowledgement carries no subject at all.
  if (/^(why|why not|how so|how come|explain|elaborate|go on|tell me more|more detail|details|and|so)$/.test(text)) {
    return true;
  }

  // A demonstrative only points backwards when it sits in front of a record
  // noun. "this year" and "this month" name a period, not a previous answer.
  if (
    /\b(that|those|these|this)\s+(department|departments|class|classes|division|divisions|standard|standards|section|student|students|teacher|teachers|staff|employee|employees|subject|subjects|course|courses|record|records|one|ones|group)\b/.test(
      text
    )
  ) {
    return true;
  }

  // Pronouns and possessives referring to something already named.
  if (/\b(it|its|they|them|their|theirs|him|her|hers|his|the same)\b/.test(text)) {
    return true;
  }

  // Elliptical continuations: "and for Standard 8", "what about Division C".
  if (/^(and|what about|how about|ok what about|also)\b/.test(text)) {
    return true;
  }

  // A short "why/what/which/who" question is a follow-up only when it names no
  // subject of its own. "Which subjects are mapped to Standard 7?" carries its
  // own scope and must be answered on its own terms; "Which division is lowest?"
  // does not, so it belongs to the previous turn.
  const namesOwnScope =
    /\b(standard|std|class|grade|division|section)\s*[-:]?\s*(\d+|[a-z]\b)/.test(text) ||
    /\b\d{4}-\d{2}-\d{2}\b/.test(text);

  if (
    /^(why|what|which|who|how)\b/.test(text) &&
    text.split(/\s+/).length <= 8 &&
    !namesOwnScope
  ) {
    return true;
  }

  return false;
}

/**
 * Resolves the entity a follow-up refers to. An explicitly named record wins;
 * otherwise the focus of the most recent data-backed answer is used. Returns
 * null when the session has nothing to point at, so the caller can ask rather
 * than guess.
 */
export function resolveConversationFocus(
  state: FollowUpSessionState | null,
  message: string,
  preferredKind?: string
): { focus: ConversationFocusEntity; query: FollowUpQueryState } | null {
  if (!state?.queries.length) {
    return null;
  }

  const normalizedMessage = normalizeName(message);
  const queries = preferredKind
    ? [
        ...state.queries.filter((query) =>
          [query.focus?.kind, ...query.candidates.map((entity) => entity.kind)].includes(
            preferredKind
          )
        ),
        ...state.queries,
      ]
    : state.queries;

  // 1. The message names one of the records the previous answers listed.
  for (const query of queries) {
    const pool = [query.focus, ...query.candidates].filter(
      (entity): entity is ConversationFocusEntity => Boolean(entity?.name)
    );

    for (const entity of pool) {
      const normalizedEntity = normalizeName(entity.name);
      if (normalizedEntity.length > 2 && normalizedMessage.includes(normalizedEntity)) {
        return { focus: entity, query };
      }
    }
  }

  // 2. Otherwise the subject of the most recent answer that had one.
  for (const query of queries) {
    if (query.focus?.name) {
      return { focus: query.focus, query };
    }
  }

  return null;
}

/** The most recent query, whatever it was about. */
export function getLastFollowUpQuery(state: FollowUpSessionState | null) {
  return state?.queries[0] || null;
}

/* -------------------------------------------------------------------------- */
/* Prompt rendering                                                           */
/* -------------------------------------------------------------------------- */

function describeFilters(filters: Record<string, unknown>) {
  const entries = Object.entries(filters).filter(
    ([, value]) =>
      value !== undefined &&
      value !== null &&
      value !== "" &&
      !(Array.isArray(value) && value.length === 0)
  );

  if (!entries.length) {
    return "none";
  }

  return entries
    .map(([key, value]) => `${key}=${Array.isArray(value) ? value.join("|") : String(value)}`)
    .join(", ");
}

/**
 * Renders the remembered queries for the system prompt. Terse on purpose — this
 * is context for the model, not text for the user, and the style rules forbid
 * repeating any of it verbatim in an answer.
 */
export function describeFollowUpState(state: FollowUpSessionState | null): string | null {
  if (!state?.queries.length) {
    return null;
  }

  const lines = state.queries.map((query, index) => {
    const parts = [
      `${index === 0 ? "most recent" : `${index + 1} turns back`}: asked about ${query.module || "data"}`,
      `filters=${describeFilters(query.filters)}`,
      `outcome=${query.status}`,
    ];

    if (query.rowCount !== undefined) {
      parts.push(`rows=${query.rowCount}`);
    }

    if (query.focus?.name) {
      parts.push(`the answer was about: ${query.focus.kind} "${query.focus.name}"`);
    }

    if (query.candidates.length) {
      parts.push(
        `records mentioned: ${query.candidates
          .slice(0, 8)
          .map((entity) => entity.name)
          .join("; ")}`
      );
    }

    if (query.resolvedEntities.length) {
      parts.push(
        `resolved=${query.resolvedEntities
          .map((entity) => `${entity.kind} "${entity.query}" -> ${entity.name}`)
          .join("; ")}`
      );
    }

    return `- ${parts.join(", ")}`;
  });

  return lines.join("\n");
}

/**
 * Shared record-selection resolver for every conversational module.
 *
 * When a tool returns backend rows the conversation stores them as
 * {@link SelectableEntity} values in the workflow state. The user can then pick
 * one with a number, a name, a reference, or any combination that was rendered
 * in the selection list ("Zeel J Tank, 7, 233"). This module is the single place
 * that turns that free-text reply back into the structured backend record, so
 * Admissions, Fees, Homework and every future module resolve selections
 * identically.
 */

export interface SelectableEntity {
  id?: string;
  label?: string;
  reference?: string;
  secondary?: string;
  metadata?: Record<string, unknown>;
  [key: string]: unknown;
}

export type EntitySelectionStatus = "resolved" | "ambiguous" | "unresolved";

export interface EntitySelectionResult<TEntity extends SelectableEntity> {
  status: EntitySelectionStatus;
  entity: TEntity | null;
  index: number;
  matchType:
    | "index"
    | "ordinal"
    | "label"
    | "identifier"
    | "label_and_identifier"
    | "none";
  candidates: TEntity[];
}

/** Label-bearing keys, in priority order, on either the summary or the record. */
const LABEL_KEYS = [
  "label",
  "studentName",
  "student_name",
  "fullName",
  "full_name",
  "name",
  "title",
];

/** Identifier keys that may be typed back verbatim by the user. */
const IDENTIFIER_KEYS = [
  "reference",
  "enrollmentNo",
  "enrollment_no",
  "enrollment",
  "grNo",
  "gr_no",
  "grno",
  "enquiryNo",
  "enquiry_no",
  "admissionNo",
  "admission_no",
  "rollNo",
  "roll_no",
  "mobileNo",
  "mobile_no",
  "mobile",
  "uniqueId",
  "unique_id",
  "homeworkId",
  "homework_id",
  "studentId",
  "student_id",
  "enquiryId",
  "enquiry_id",
  "registrationId",
  "registration_id",
  "id",
];

/** Weak context keys (standard/division/subject) that only refine a match. */
const SECONDARY_KEYS = [
  "secondary",
  "standard",
  "standardName",
  "standard_name",
  "division",
  "divisionName",
  "division_name",
  "subject",
  "subjectName",
  "subject_name",
];

const ORDINAL_PATTERNS: Array<[RegExp, number]> = [
  [/\b(first|1st)\b/i, 0],
  [/\b(second|2nd)\b/i, 1],
  [/\b(third|3rd)\b/i, 2],
  [/\b(fourth|4th)\b/i, 3],
  [/\b(fifth|5th)\b/i, 4],
  [/\b(sixth|6th)\b/i, 5],
  [/\b(seventh|7th)\b/i, 6],
  [/\b(eighth|8th)\b/i, 7],
  [/\b(ninth|9th)\b/i, 8],
  [/\b(tenth|10th)\b/i, 9],
];

const WORD_NUMBERS: Record<string, number> = {
  one: 0,
  two: 1,
  three: 2,
  four: 3,
  five: 4,
  six: 5,
  seven: 6,
  eight: 7,
  nine: 8,
  ten: 9,
};

const MINIMUM_MATCH_SCORE = 3;

export function normalizeSelectionText(value: unknown) {
  return String(value ?? "")
    .toLowerCase()
    .replace(/[^a-z0-9\s]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function tokenize(value: unknown) {
  const normalized = normalizeSelectionText(value);
  return normalized ? normalized.split(" ") : [];
}

function readEntityValue(entity: SelectableEntity, key: string) {
  const direct = entity[key];
  if (typeof direct === "string" && direct.trim()) {
    return direct.trim();
  }
  if (typeof direct === "number" && Number.isFinite(direct)) {
    return String(direct);
  }

  const metadata = entity.metadata;
  if (metadata && typeof metadata === "object") {
    const nested = (metadata as Record<string, unknown>)[key];
    if (typeof nested === "string" && nested.trim()) {
      return nested.trim();
    }
    if (typeof nested === "number" && Number.isFinite(nested)) {
      return String(nested);
    }
  }

  return "";
}

function readFirstEntityValue(entity: SelectableEntity, keys: string[]) {
  for (const key of keys) {
    const value = readEntityValue(entity, key);
    if (value) {
      return value;
    }
  }
  return "";
}

function collectEntityValues(entity: SelectableEntity, keys: string[]) {
  const values = new Set<string>();
  for (const key of keys) {
    const value = normalizeSelectionText(readEntityValue(entity, key));
    if (value) {
      values.add(value);
    }
  }
  return [...values];
}

/** Reads an explicit "4", "#4", "option 4", or "select the 4th one" style pick. */
function readExplicitIndex(message: string, total: number) {
  const normalized = message.trim();

  const bareNumber = normalized.match(/^\s*(?:#|no\.?|number|option|record|item|choose|select|pick)?\s*(\d{1,3})\s*[.)]?\s*$/i);
  if (bareNumber) {
    const index = Number(bareNumber[1]) - 1;
    return index >= 0 && index < total ? index : -1;
  }

  const labelledNumber = normalized.match(
    /\b(?:option|number|record|item|no\.?|#|choose|select|pick)\s*[:#-]?\s*(\d{1,3})\b/i
  );
  if (labelledNumber) {
    const index = Number(labelledNumber[1]) - 1;
    return index >= 0 && index < total ? index : -1;
  }

  return -1;
}

function readOrdinalIndex(message: string, total: number) {
  if (/\blast\b/i.test(message) && total > 0) {
    return total - 1;
  }

  for (const [pattern, index] of ORDINAL_PATTERNS) {
    if (pattern.test(message) && index < total) {
      return index;
    }
  }

  const tokens = tokenize(message);
  if (tokens.length === 1) {
    const wordIndex = WORD_NUMBERS[tokens[0]];
    if (wordIndex != null && wordIndex < total) {
      return wordIndex;
    }
  }

  return -1;
}

interface ScoredEntity<TEntity extends SelectableEntity> {
  entity: TEntity;
  index: number;
  score: number;
  matchedLabel: boolean;
  matchedIdentifier: boolean;
}

function scoreEntity<TEntity extends SelectableEntity>(
  entity: TEntity,
  index: number,
  messageNormalized: string,
  messageTokens: string[]
): ScoredEntity<TEntity> {
  let score = 0;
  let matchedLabel = false;
  let matchedIdentifier = false;

  const label = normalizeSelectionText(readFirstEntityValue(entity, LABEL_KEYS));
  if (label) {
    const labelTokens = label.split(" ").filter(Boolean);
    const reverseContained =
      messageNormalized.length >= 4 && label.includes(messageNormalized);

    if (messageNormalized.includes(label) || reverseContained) {
      score += 6;
      matchedLabel = true;
    } else {
      const matchedTokens = labelTokens.filter((token) =>
        messageTokens.includes(token)
      ).length;

      if (labelTokens.length > 0 && matchedTokens === labelTokens.length) {
        score += 5;
        matchedLabel = true;
      } else if (matchedTokens >= 2) {
        score += 3;
        matchedLabel = true;
      } else if (matchedTokens === 1 && labelTokens.length === 1) {
        score += 3;
        matchedLabel = true;
      }
    }
  }

  for (const identifier of collectEntityValues(entity, IDENTIFIER_KEYS)) {
    // Single-token identifiers (a GR number) must match a whole token so "233"
    // never matches "1233"; multi-token identifiers ("ENQ-2026-0042") match as a
    // phrase.
    const matched = identifier.includes(" ")
      ? messageNormalized.includes(identifier)
      : messageTokens.includes(identifier);

    if (matched) {
      score += 4;
      matchedIdentifier = true;
    }
  }

  for (const secondary of collectEntityValues(entity, SECONDARY_KEYS)) {
    if (messageTokens.includes(secondary)) {
      score += 1;
    }
  }

  return { entity, index, score, matchedLabel, matchedIdentifier };
}

/**
 * Resolves the user's reply against the records that were already returned by a
 * previous tool call. Never invents a record: it can only return one of the
 * supplied backend rows.
 */
export function resolveEntitySelection<TEntity extends SelectableEntity>(
  message: string,
  entities: TEntity[]
): EntitySelectionResult<TEntity> {
  const list = Array.isArray(entities) ? entities.filter(Boolean) : [];

  if (list.length === 0) {
    return {
      status: "unresolved",
      entity: null,
      index: -1,
      matchType: "none",
      candidates: [],
    };
  }

  const explicitIndex = readExplicitIndex(message, list.length);
  if (explicitIndex >= 0) {
    return {
      status: "resolved",
      entity: list[explicitIndex],
      index: explicitIndex,
      matchType: "index",
      candidates: [list[explicitIndex]],
    };
  }

  const messageNormalized = normalizeSelectionText(message);
  const messageTokens = messageNormalized ? messageNormalized.split(" ") : [];

  const scored = list
    .map((entity, index) => scoreEntity(entity, index, messageNormalized, messageTokens))
    .filter((candidate) => candidate.score >= MINIMUM_MATCH_SCORE)
    .sort((left, right) => right.score - left.score);

  if (scored.length > 0) {
    const best = scored[0];
    const tied = scored.filter((candidate) => candidate.score === best.score);

    if (tied.length > 1) {
      return {
        status: "ambiguous",
        entity: null,
        index: -1,
        matchType: best.matchedLabel && best.matchedIdentifier
          ? "label_and_identifier"
          : best.matchedLabel
            ? "label"
            : "identifier",
        candidates: tied.map((candidate) => candidate.entity),
      };
    }

    return {
      status: "resolved",
      entity: best.entity,
      index: best.index,
      matchType:
        best.matchedLabel && best.matchedIdentifier
          ? "label_and_identifier"
          : best.matchedLabel
            ? "label"
            : "identifier",
      candidates: [best.entity],
    };
  }

  const ordinalIndex = readOrdinalIndex(message, list.length);
  if (ordinalIndex >= 0) {
    return {
      status: "resolved",
      entity: list[ordinalIndex],
      index: ordinalIndex,
      matchType: "ordinal",
      candidates: [list[ordinalIndex]],
    };
  }

  return {
    status: "unresolved",
    entity: null,
    index: -1,
    matchType: "none",
    candidates: [],
  };
}

/**
 * Backwards-compatible helper used by the workflow router: returns the matched
 * record or null.
 */
export function selectEntityOrNull<TEntity extends SelectableEntity>(
  message: string,
  entities: TEntity[]
): TEntity | null {
  const result = resolveEntitySelection(message, entities);
  return result.status === "resolved" ? result.entity : null;
}

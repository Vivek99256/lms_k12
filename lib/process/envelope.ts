/**
 * Storage format for converted processes.
 *
 * The legacy screen stored one CKEditor HTML blob per menu in
 * `requirement_gathering.requirements`, upserted on (menu_id, sub_institute_id).
 * That row is where converted processes go too - as a JSON envelope rather than
 * HTML - which is why this feature needs no migration against a shared
 * production database and why the old rows keep rendering.
 *
 * Two consequences the rest of the code depends on:
 *
 *   - One row holds *many* procedures. The controller upserts per menu, so an
 *     envelope carries a `processes[]` and `upsertProcess` merges by reference.
 *     Converting 6.9.5 later must not overwrite 6.9.4.
 *   - Anything that is not our envelope is legacy HTML. `decodeEnvelope`
 *     reports that case rather than throwing, so a menu with an old free-text
 *     process still opens - it is simply shown as legacy content that has not
 *     been converted yet.
 *
 * The column is MySQL `text`, so ~64 KB after encoding. `ENVELOPE_BUDGET_BYTES`
 * is checked before every write; exceeding it is a real error to surface, not a
 * silent truncation halfway through a step table.
 */

import type { ProcessSpec, ProcessSpecEnvelope } from './types'

/** MySQL TEXT holds 65,535 bytes. Leave headroom for the surrounding payload. */
export const ENVELOPE_BUDGET_BYTES = 60_000

export type DecodedValue =
  | { kind: 'envelope'; envelope: ProcessSpecEnvelope }
  /** Pre-conversion content: CKEditor HTML or plain text. */
  | { kind: 'legacy'; html: string }
  | { kind: 'empty' }
  /** Valid JSON, wrong shape - worth showing rather than silently overwriting. */
  | { kind: 'unreadable'; reason: string; raw: string }

function isEnvelope(value: unknown): value is ProcessSpecEnvelope {
  if (!value || typeof value !== 'object') return false
  const candidate = value as Partial<ProcessSpecEnvelope>
  return candidate.__processSpec === 1 && Array.isArray(candidate.processes)
}

export function decodeEnvelope(raw: string): DecodedValue {
  const trimmed = raw?.trim() ?? ''
  if (!trimmed) return { kind: 'empty' }

  // Legacy values are HTML or prose; only try JSON when it could be JSON.
  if (!trimmed.startsWith('{')) return { kind: 'legacy', html: trimmed }

  let parsed: unknown
  try {
    parsed = JSON.parse(trimmed)
  } catch {
    return { kind: 'legacy', html: trimmed }
  }

  if (!isEnvelope(parsed)) {
    return {
      kind: 'unreadable',
      reason: 'The stored value is JSON but not a process document.',
      raw: trimmed,
    }
  }

  return { kind: 'envelope', envelope: parsed }
}

export function encodeEnvelope(envelope: ProcessSpecEnvelope): string {
  return JSON.stringify(envelope)
}

export function createEnvelope(params: {
  module: string
  sop: ProcessSpecEnvelope['sop']
  now?: string
}): ProcessSpecEnvelope {
  return {
    __processSpec: 1,
    module: params.module,
    sop: params.sop,
    processes: [],
    updatedAt: params.now ?? new Date().toISOString(),
  }
}

/**
 * Insert or replace one process by reference, leaving the others untouched.
 * Returns a new envelope - callers hold React state, so nothing is mutated.
 */
export function upsertProcess(
  envelope: ProcessSpecEnvelope,
  spec: ProcessSpec,
  now?: string
): ProcessSpecEnvelope {
  const index = envelope.processes.findIndex((process) => process.ref === spec.ref)
  const processes =
    index === -1
      ? [...envelope.processes, spec]
      : envelope.processes.map((process, position) => (position === index ? spec : process))

  return {
    ...envelope,
    processes: processes.sort((left, right) => compareRefs(left.ref, right.ref)),
    updatedAt: now ?? new Date().toISOString(),
  }
}

export function removeProcess(
  envelope: ProcessSpecEnvelope,
  ref: string,
  now?: string
): ProcessSpecEnvelope {
  return {
    ...envelope,
    processes: envelope.processes.filter((process) => process.ref !== ref),
    updatedAt: now ?? new Date().toISOString(),
  }
}

/** '6.9.4' sorts after '6.9.3' and before '6.10.1' - numeric, segment by segment. */
export function compareRefs(left: string, right: string): number {
  const leftParts = left.split('.').map(Number)
  const rightParts = right.split('.').map(Number)
  for (let index = 0; index < Math.max(leftParts.length, rightParts.length); index += 1) {
    const difference = (leftParts[index] ?? 0) - (rightParts[index] ?? 0)
    if (difference) return difference
  }
  return 0
}

/**
 * Which legacy row a process lives in: one row per procedure.
 *
 * The screen this replaced keyed its row by menu, because a menu was what it
 * stored - one free-text process per ERP screen. Reusing that key for converted
 * processes was wrong in three ways, all of which this fixes:
 *
 *   - Size. A converted procedure is ~14 KB, so barely four fit in the `TEXT`
 *     column. This SOP alone has 131 procedures.
 *   - Safety. `OnboardingApiController` and `tourController` both read this
 *     table by `menu_name` and strip the value to plain text for display.
 *     Writing a JSON envelope onto a menu they know about would render the raw
 *     JSON to users. A synthetic name no menu can have keeps them clear of it.
 *   - Sense. A procedure's identity is its module and its number, not whichever
 *     menu someone picked from a list of hundreds.
 *
 * `menu_id` stays 0 - the same "global default" scope the legacy rows use - and
 * the name carries the identity. The controller upserts on
 * (menu_id, menu_name, sub_institute_id), so re-saving a procedure updates its
 * own row and touches nothing else.
 */
export function storageKeyFor(spec: Pick<ProcessSpec, 'module' | 'ref'>): {
  menuId: string
  menuName: string
  /** The `id/name` pair the legacy store endpoint splits on `/`. */
  menuDetails: string
} {
  // The controller explodes on '/', so neither half may contain one.
  const menuName = `${spec.module} ${spec.ref}`.replace(/\//g, '-').slice(0, 250)
  return { menuId: '0', menuName, menuDetails: `0/${menuName}` }
}

export interface SizeCheck {
  bytes: number
  withinBudget: boolean
  budget: number
}

export function checkSize(envelope: ProcessSpecEnvelope): SizeCheck {
  const bytes = new TextEncoder().encode(encodeEnvelope(envelope)).length
  return { bytes, withinBudget: bytes <= ENVELOPE_BUDGET_BYTES, budget: ENVELOPE_BUDGET_BYTES }
}
